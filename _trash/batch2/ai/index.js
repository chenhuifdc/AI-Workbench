'use strict';
/**
 * index.js —— AI 流式调用的唯一对外入口
 *
 * 对外 API：
 *   callAIStream(payload, onChunk, onError, onDone, options?) -> Promise<void>
 *   abortAIStream(channelId) -> boolean            // 取消并清理 Map
 *   activeChannelIds() / getStatus()               // 观测用
 *
 * payload: { provider, model, messages, temperature, channelId? }
 *   provider: 'openai' | 'deepseek' | 'openrouter' | 'gemini'
 *   可选扩展：endpoint（自定义端点，便于内网代理/自动化测试）、timeouts。
 *
 * 分片回放约定（重要）：
 *   session.pullFirstDelta() 只负责“把首字节等出来”（两段式超时的第一段在此生效，
 *   此时还没有任何 chunk 推给前端，所以失败可以安全重试）；
 *   它取到的第一个增量会留在会话内部，由 consume() 原样回放。
 *   因此调用方只需在 consume() 的回调里 onChunk，绝不能再用 pullFirstDelta 的返回值
 *   emit 一次，否则前端会收到重复内容。
 */

const { createLimiter } = require('./limiter');
const { withRetry, MAX_RETRIES } = require('./retry');
const providers = require('./providers');
const { CODES, createError, reportOf } = require('./networkReport');

/** 最多同时跑 3 个 AI 请求（可用 AI_MAX_CONCURRENT 覆盖） */
const MAX_CONCURRENT = Number(process.env.AI_MAX_CONCURRENT) > 0 ? Number(process.env.AI_MAX_CONCURRENT) : 3;

const limiter = createLimiter(MAX_CONCURRENT);

/** Map<channelId, AbortController> —— 支持按 channel 取消 */
const controllers = new Map();

/** IPC 通道名（main.js / preload.js 共用，避免写错字符串） */
const IPC = Object.freeze({
  CALL: 'ai:call-stream',
  ABORT: 'ai:abort-stream'
});

const CHANNELS = Object.freeze({
  chunk: (channelId) => `ai:chunk:${channelId}`,
  done: (channelId) => `ai:done:${channelId}`,
  // channelId 缺失时退化为全局错误通道 'ai:error'，保证前端的全局监听也能收到
  error: (channelId) => (channelId ? `ai:error:${channelId}` : 'ai:error')
});

function apiKeyFor(provider) {
  const cfg = providers.PROVIDERS[provider];
  if (!cfg) return '';
  return String(process.env[cfg.keyEnv] || '').trim();
}

function abortAIStream(channelId) {
  if (!channelId) return false;
  const controller = controllers.get(channelId);
  if (!controller) return false;
  controllers.delete(channelId);
  try { controller.abort(); } catch (_) { /* 已中止 */ }
  return true;
}

function activeChannelIds() {
  return Array.from(controllers.keys());
}

function getStatus() {
  return Object.assign({}, limiter.stats(), { activeChannels: activeChannelIds() });
}

function callAIStream(payload, onChunk, onError, onDone, options) {
  const opts = options || {};
  const body = (payload && typeof payload === 'object') ? payload : {};
  const provider = String(body.provider || '').toLowerCase();

  const emitChunk = typeof onChunk === 'function' ? onChunk : () => {};
  const emitError = typeof onError === 'function' ? onError : () => {};
  const emitDone = typeof onDone === 'function' ? onDone : () => {};

  const channelId = body.channelId || opts.channelId || null;
  let settled = false;
  let dispatched = 0;

  const finish = (fn, arg) => {
    if (settled) return;
    settled = true;
    try { fn(arg); } catch (_) { /* 回调异常不影响清理 */ }
  };

  return (async () => {
    const cfg = providers.PROVIDERS[provider];
    if (!cfg) {
      finish(emitError, reportOf(createError(CODES.BAD_REQUEST, {
        provider: provider || null,
        detail: `未知的 AI 供应商：${body.provider}（可用：${Object.keys(providers.PROVIDERS).join(' / ')}）`
      })));
      return;
    }

    const apiKey = apiKeyFor(provider);
    if (!apiKey) {
      finish(emitError, reportOf(createError(CODES.CONFIG, {
        provider,
        detail: `未检测到 ${cfg.keyEnv}，请在程序同级目录的 .env 中配置后重启`
      })));
      return;
    }

    const model = body.model || cfg.defaultModel;
    const controller = new AbortController();
    const signal = controller.signal;
    if (channelId) {
      const prev = controllers.get(channelId);
      if (prev) { try { prev.abort(); } catch (_) { /* 忽略 */ } }
      controllers.set(channelId, controller);
    }

    let slot = null;
    let session = null;
    let streamStarted = false;

    try {
      // 1) 并发排队：超出 3 个的请求在此等待；signal 取消时排队项会被移出
      slot = await limiter.acquire(signal);

      // 2) 重试单元 = 建立连接 + 等到首字节（都是“流开始前”，可安全重试）
      session = await withRetry(async () => {
        const opened = await providers.openStream(provider, body, { apiKey, signal, timeouts: opts.timeouts });
        const s = providers.createStreamSession(opened, {
          signal,
          // 超时只中止「本次尝试」的连接（opened.controller），不动调用方 signal
          abortController: opened.controller,
          timeouts: opts.timeouts
        });
        try {
          await s.pullFirstDelta();
        } catch (err) {
          // 本次尝试失败要重试：先把这条连接关掉再抛，否则 socket 会一直挂着
          try { await s.dispose(); } catch (_) { /* 已关闭 */ }
          throw err;
        }
        return s;
      }, {
        maxRetries: Number.isInteger(opts.maxRetries) ? opts.maxRetries : MAX_RETRIES,
        baseMs: Number.isFinite(opts.baseMs) ? opts.baseMs : undefined,
        signal,
        provider,
        onRetry: typeof opts.onRetry === 'function' ? opts.onRetry : undefined,
        // 一旦有 chunk 推给前端就禁止重试（否则前端会收到重复内容）
        isStreamStarted: () => streamStarted
      });

      // 3) 持续推送增量（含回放首字节），chunk 间空闲超时在此生效
      await session.consume((text) => {
        if (settled) return;
        streamStarted = true;
        dispatched += 1;
        emitChunk(text);
      });

      finish(emitDone, {
        channelId,
        provider,
        model,
        deltas: dispatched,
        stats: session.stats
      });
    } catch (error) {
      finish(emitError, reportOf(error));
    } finally {
      // slot 的三条释放路径（正常结束 / 出错 / 取消）都收敛到这一个 finally
      if (slot) { try { slot.release(); } catch (_) { /* 已释放 */ } }
      if (channelId && controllers.get(channelId) === controller) controllers.delete(channelId);
      if (session && typeof session.dispose === 'function') { try { session.dispose(); } catch (_) { /* 忽略 */ } }
    }
  })().catch((error) => {
    // 兜底：任何未预期异常也必须走 onError，绝不留未处理拒绝
    finish(emitError, reportOf(error));
  });
}

module.exports = {
  callAIStream,
  abortAIStream,
  activeChannelIds,
  getStatus,
  limiter,
  IPC,
  CHANNELS,
  MAX_CONCURRENT,
  PROVIDERS: providers.PROVIDERS,
  DEFAULT_MODELS: providers.DEFAULT_MODELS,
  KEY_ENV: providers.KEY_ENV
};
