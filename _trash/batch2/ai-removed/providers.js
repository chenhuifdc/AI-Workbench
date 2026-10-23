'use strict';
/**
 * providers.js —— 四家 API 的流式请求适配（Node 内置 fetch，无任何 SDK）
 *
 * 设计要点：
 * 1. 真流式：await fetch(...) 后立刻通过 response.body.getReader() 按 chunk 读取，
 *    绝不 await response.json() / response.text() 等整包返回。
 * 2. OpenAI / DeepSeek / OpenRouter 走 OpenAI 兼容的 SSE（body 里 stream:true，解析 data: 行）。
 *    Gemini 必须用 streamGenerateContent?alt=sse&key=...，否则默认返回 JSON 数组而不是 SSE 流，会解析失败。
 *    OpenRouter 额外带 HTTP-Referer、X-Title 请求头。
 * 3. 统一解析器 parseSSELine/parseDelta：从每个流片段里取出文本增量 textDelta。
 * 4. 两段式超时（不用 45 秒总超时，长回答不会被掐断）：
 *      首字节超时：连接后 firstByteMs（默认 30s）内没收到第一个数据分片 → 报错（可重试）
 *      空闲超时  ：两个数据分片之间超过 idleMs（默认 30s）没数据才报错（不可重试）
 *      无总时长限制。
 *   可用环境变量 AI_FIRST_BYTE_TIMEOUT_MS / AI_IDLE_TIMEOUT_MS 覆盖（自动化测试用）。
 *
 * CommonJS，零依赖。
 */

const { CODES, createError, fromHttpStatus, normalizeException } = require('./networkReport');

const DEFAULT_FIRST_BYTE_TIMEOUT_MS = 30000;
const DEFAULT_IDLE_TIMEOUT_MS = 30000;
const MAX_RETRY_AFTER_MS = 30000;

/** 供应商注册表：默认模型 / Key 环境变量 / 端点 */
const PROVIDERS = Object.freeze({
  openai: {
    id: 'openai',
    label: 'OpenAI',
    kind: 'openai',
    keyEnv: 'OPENAI_API_KEY',
    defaultModel: 'gpt-4o-mini',
    endpoint: 'https://api.openai.com/v1/chat/completions'
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    kind: 'openai',
    keyEnv: 'DEEPSEEK_API_KEY',
    defaultModel: 'deepseek-chat',
    endpoint: 'https://api.deepseek.com/chat/completions'
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    kind: 'openai',
    keyEnv: 'OPENROUTER_API_KEY',
    defaultModel: 'deepseek/deepseek-chat',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions'
  },
  gemini: {
    id: 'gemini',
    label: 'Gemini',
    kind: 'gemini',
    keyEnv: 'GEMINI_API_KEY',
    defaultModel: 'gemini-2.0-flash',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse'
  }
});

const DEFAULT_MODELS = Object.freeze(
  Object.keys(PROVIDERS).reduce((acc, id) => {
    acc[id] = PROVIDERS[id].defaultModel;
    return acc;
  }, {})
);

const KEY_ENV = Object.freeze(
  Object.keys(PROVIDERS).reduce((acc, id) => {
    acc[id] = PROVIDERS[id].keyEnv;
    return acc;
  }, {})
);

/** 解析两段式超时（options > env > 默认 30s） */
function resolveTimeouts(overrides) {
  const pick = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  const source = overrides || {};
  return {
    firstByteMs: pick(source.firstByteMs != null ? source.firstByteMs : process.env.AI_FIRST_BYTE_TIMEOUT_MS, DEFAULT_FIRST_BYTE_TIMEOUT_MS),
    idleMs: pick(source.idleMs != null ? source.idleMs : process.env.AI_IDLE_TIMEOUT_MS, DEFAULT_IDLE_TIMEOUT_MS)
  };
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((m) => m && typeof m === 'object')
    .map((m) => {
      const role = m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user';
      let content = m.content;
      if (Array.isArray(content)) {
        content = content.map((p) => (typeof p === 'string' ? p : (p && p.text) || '')).join('');
      } else if (content == null) {
        content = '';
      } else if (typeof content !== 'string') {
        content = String(content);
      }
      return { role, content };
    });
}

/** OpenAI 兼容请求体（stream:true 是关键） */
function toOpenAIBody(payload, model) {
  const body = { model, messages: normalizeMessages(payload.messages), stream: true };
  if (typeof payload.temperature === 'number') body.temperature = payload.temperature;
  return body;
}

/** Gemini 请求体：contents / systemInstruction / generationConfig */
function toGeminiBody(payload) {
  const contents = [];
  const systemTexts = [];
  for (const m of normalizeMessages(payload.messages)) {
    if (m.role === 'system') {
      systemTexts.push(m.content);
      continue;
    }
    const role = m.role === 'assistant' ? 'model' : 'user';
    const last = contents[contents.length - 1];
    if (last && last.role === role) last.parts.push({ text: m.content });
    else contents.push({ role, parts: [{ text: m.content }] });
  }
  const body = { contents };
  if (systemTexts.length) body.systemInstruction = { parts: systemTexts.map((t) => ({ text: t })) };
  if (typeof payload.temperature === 'number') body.generationConfig = { temperature: payload.temperature };
  return body;
}

function openRouterHeaders() {
  return {
    'HTTP-Referer': process.env.OPENROUTER_REFERER || 'https://ai-workbench.local',
    'X-Title': process.env.OPENROUTER_TITLE || 'AI工作台'
  };
}

/** 组装请求：返回 { url, method, headers, body, kind, model } */
function buildRequest(provider, payload, apiKey) {
  const cfg = PROVIDERS[provider];
  if (!cfg) {
    throw createError(CODES.BAD_REQUEST, {
      provider,
      detail: '未知的 AI 供应商：' + String(provider) + '（可用：' + Object.keys(PROVIDERS).join(' / ') + '）'
    });
  }
  const model = payload.model || cfg.defaultModel;

  if (cfg.kind === 'openai') {
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      Authorization: 'Bearer ' + apiKey
    };
    if (provider === 'openrouter') Object.assign(headers, openRouterHeaders());
    return {
      url: payload.endpoint || payload.baseUrl || cfg.endpoint,
      method: 'POST',
      headers,
      body: JSON.stringify(toOpenAIBody(payload, model)),
      kind: cfg.kind,
      model
    };
  }

  // Gemini：端点必须是 streamGenerateContent?alt=sse，key 走 query
  let url = payload.endpoint || payload.baseUrl || cfg.endpoint;
  url = url.replace('{model}', encodeURIComponent(model));
  url += (url.indexOf('?') === -1 ? '?' : '&') + 'key=' + encodeURIComponent(apiKey);
  return {
    url,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(toGeminiBody(payload)),
    kind: cfg.kind,
    model
  };
}

function parseRetryAfter(headerValue) {
  if (!headerValue) return null;
  const seconds = Number(headerValue);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
  const date = Date.parse(headerValue);
  if (Number.isFinite(date)) {
    const ms = date - Date.now();
    return ms > 0 ? Math.min(ms, MAX_RETRY_AFTER_MS) : null;
  }
  return null;
}

async function safeReadText(response) {
  try {
    const text = await response.text();
    return typeof text === 'string' ? text : '';
  } catch (_) {
    return '';
  }
}

/**
 * 打开流：只负责建立连接 + 校验 HTTP 状态，不做任何缓冲。
 * 失败时抛出带 retryable 标记的错误（由 retry.js 决定是否重试）。
 */
async function openStream(provider, payload, options) {
  const opts = options || {};
  const apiKey = opts.apiKey;
  if (!apiKey) throw createError(CODES.CONFIG, { provider });

  const request = buildRequest(provider, payload, apiKey);
  const timeouts = resolveTimeouts(opts.timeouts);

  // 每次尝试都用独立的 AbortController：超时只掐断本次尝试，绝不污染调用方 signal，
  // 否则一旦首字节超时，后续重试会全部挂在同一个已中止的 signal 上。
  const attempt = new AbortController();
  const callerSignal = opts.signal || null;
  const forwardAbort = () => { try { attempt.abort(); } catch (_) { /* 已中止 */ } };
  if (callerSignal) {
    if (callerSignal.aborted) throw createError(CODES.ABORTED, { provider, detail: '本次生成已被取消' });
    callerSignal.addEventListener('abort', forwardAbort, { once: true });
  }
  const detach = () => { if (callerSignal) callerSignal.removeEventListener('abort', forwardAbort); };

  // 连接/响应头阶段也要有上限：上游一直不返回响应头时不能无限等（首字节超时的第一段）
  let headersTimedOut = false;
  const headerTimer = setTimeout(() => {
    headersTimedOut = true;
    try { attempt.abort(); } catch (_) { /* 已中止 */ }
  }, timeouts.firstByteMs);

  let response;
  try {
    response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      signal: attempt.signal
    });
  } catch (err) {
    clearTimeout(headerTimer);
    detach();
    if (headersTimedOut) {
      throw createError(CODES.TIMEOUT, {
        provider,
        phase: 'first-byte',
        detail: '连接后 ' + timeouts.firstByteMs + 'ms 内未收到响应头',
        cause: err
      });
    }
    if (callerSignal && callerSignal.aborted) {
      throw createError(CODES.ABORTED, { provider, detail: '本次生成已被取消' });
    }
    throw normalizeException(err, provider, 'connect');
  }
  clearTimeout(headerTimer);

  if (!response.ok) {
    const bodyText = await safeReadText(response);
    detach();
    throw fromHttpStatus(response.status, bodyText, provider, {
      retryAfterMs: parseRetryAfter(response.headers && response.headers.get ? response.headers.get('retry-after') : null)
    });
  }
  if (!response.body || typeof response.body.getReader !== 'function') {
    detach();
    throw createError(CODES.SERVER, {
      provider,
      status: response.status,
      detail: '上游未返回可读的流式响应体（response.body 为空）'
    });
  }

  return {
    provider,
    model: request.model,
    kind: request.kind,
    request: { url: request.url, method: request.method, headers: request.headers },
    response,
    controller: attempt,
    detach
  };
}

/**
 * 从单个 SSE 行里取出文本增量（统一解析器）。
 * 返回 '' 表示该行没有文本增量（心跳、注释、[DONE]、角色帧等）。
 */
function parseSSELine(provider, rawLine) {
  if (typeof rawLine !== 'string') return '';
  let line = rawLine.trim();
  if (!line || line.charAt(0) === ':') return '';
  if (line.slice(0, 6) === 'event:') return '';
  if (line.slice(0, 5) === 'data:') line = line.slice(5).trim();
  else if (line.charAt(0) !== '{') return '';
  if (!line || line === '[DONE]') return '';
  let json;
  try {
    json = JSON.parse(line);
  } catch (_) {
    return '';
  }
  return parseDelta(provider, json);
}

/** 从已解析的 JSON 片段里取出 textDelta（OpenAI 兼容 + Gemini） */
function parseDelta(provider, json) {
  if (!json || typeof json !== 'object') return '';

  if (json.error) {
    const message = typeof json.error === 'string' ? json.error : json.error.message || JSON.stringify(json.error);
    throw createError(CODES.SERVER, { provider, detail: message });
  }

  if (provider === 'gemini') {
    if (json.promptFeedback && json.promptFeedback.blockReason) {
      throw createError(CODES.BAD_REQUEST, {
        provider,
        detail: '内容被 Gemini 安全策略拦截（' + json.promptFeedback.blockReason + '）'
      });
    }
    const candidate = Array.isArray(json.candidates) ? json.candidates[0] : null;
    if (!candidate) return '';
    const parts = (candidate.content && candidate.content.parts) || [];
    return parts.map((p) => (p && typeof p.text === 'string' ? p.text : '')).join('');
  }

  const choice = Array.isArray(json.choices) ? json.choices[0] : null;
  if (!choice) return '';
  const delta = choice.delta || choice.message || {};
  if (typeof delta.content === 'string' && delta.content) return delta.content;
  if (Array.isArray(delta.content)) {
    return delta.content.map((p) => (typeof p === 'string' ? p : (p && p.text) || '')).join('');
  }
  // DeepSeek R1 思维链（content 为空时才用，避免正文与思维链混在一起）
  if (typeof delta.reasoning_content === 'string' && delta.reasoning_content) return delta.reasoning_content;
  return '';
}

/**
 * 创建流会话：把 ReadableStream 包装成「按文本增量推进」的对象。
 * pullFirstDelta()：读到第一个文本增量（首字节超时在此期间生效，此时还没有任何 chunk 推给前端 → 可安全重试）
 * consume(onDelta)：从当前位置继续读到流结束（空闲超时在此期间生效）
 */
function createStreamSession(opened, options) {
  const opts = options || {};
  const provider = opened.provider;
  const timeouts = resolveTimeouts(opts.timeouts);
  const reader = opened.response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  const signal = opts.signal;
  // 尝试级 controller（由 openStream 创建）：超时只中止本次尝试
  const abortController = opts.abortController || opened.controller || null;

  const pending = [];
  const stats = { deltas: 0, chunks: 0, bytes: 0 };
  let buffer = '';
  let sawChunk = false;
  let finished = false;
  let timedOut = null;
  let timer = null;

  function clearTimer() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function armTimer(ms, phase) {
    clearTimer();
    timer = setTimeout(() => {
      timedOut = { ms, phase };
      // 超时必须把底层连接也掐断，否则 socket 会一直挂着占住并发位
      try {
        if (abortController) abortController.abort();
      } catch (_) {}
      try {
        const p = reader.cancel();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch (_) {}
    }, ms);
  }

  function classifyReadError(err) {
    // 调用方主动取消优先级最高（用户意图），其次才是超时
    if ((!err || err.name === 'AbortError') && signal && signal.aborted) {
      return createError(CODES.ABORTED, { provider, detail: '本次生成已被取消' });
    }
    if (timedOut) {
      const detail =
        timedOut.phase === 'first-byte'
          ? '连接建立后 ' + timedOut.ms + 'ms 内未收到第一个数据分片'
          : '两个数据分片之间空闲超过 ' + timedOut.ms + 'ms';
      return createError(CODES.TIMEOUT, { provider, phase: timedOut.phase, detail, cause: err });
    }
    if (err && err.name === 'AbortError') {
      if (signal && signal.aborted) return createError(CODES.ABORTED, { provider, detail: '本次生成已被取消' });
      return createError(CODES.NETWORK, { provider, detail: '连接被中断', cause: err });
    }
    return normalizeException(err, provider, 'stream');
  }

  function collect(line) {
    if (!line) return null;
    return parseSSELine(provider, line);
  }

  async function* pullChunks() {
    while (!finished) {
      armTimer(sawChunk ? timeouts.idleMs : timeouts.firstByteMs, sawChunk ? 'idle' : 'first-byte');
      let read;
      try {
        read = await reader.read();
      } catch (err) {
        clearTimer();
        finished = true;
        throw classifyReadError(err);
      }
      clearTimer();

      if (read.done) {
        // 超时/取消时 reader.cancel() 可能让 read() 以 done:true 正常返回，
        // 这里补一次判定，避免把「被掐断」误判成「正常结束」
        if (timedOut || (signal && signal.aborted)) {
          finished = true;
          throw classifyReadError(null);
        }
        finished = true;
        const rest = buffer + decoder.decode();
        buffer = '';
        for (const line of rest.split('\n')) {
          const delta = collect(line);
          if (delta) {
            stats.deltas += 1;
            yield delta;
          }
        }
        return;
      }
      if (!read.value || read.value.length === 0) continue;

      sawChunk = true;
      stats.chunks += 1;
      stats.bytes += read.value.length;
      buffer += decoder.decode(read.value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const delta = collect(line);
        if (delta) {
          stats.deltas += 1;
          yield delta;
        }
      }
    }
  }

  // 单个长驻迭代器：for-await 在提前 return 时会调用 generator.return() 关闭迭代器，
  // 丢掉「同一个 chunk 里尚未消费的行」，导致分片丢失。必须自己持有迭代器并用 next()。
  let iterator = null;
  function iteratorOf() {
    if (!iterator) iterator = pullChunks();
    return iterator;
  }

  async function pullFirstDelta() {
    if (pending.length) return pending[0];
    if (finished) return null;
    const it = iteratorOf();
    while (true) {
      const step = await it.next();
      if (step.done) return null;
      if (step.value) {
        pending.push(step.value);
        return step.value;
      }
    }
  }

  async function consume(onDelta) {
    while (pending.length) onDelta(pending.shift());
    const it = iteratorOf();
    while (true) {
      const step = await it.next();
      if (step.done) return;
      if (step.value) onDelta(step.value);
    }
  }

  async function dispose() {
    clearTimer();
    finished = true;
    if (typeof opened.detach === 'function') {
      try { opened.detach(); } catch (_) { /* 已解绑 */ }
    }
    try {
      const p = reader.cancel();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (_) {}
  }

  return {
    provider,
    kind: opened.kind,
    model: opened.model,
    request: opened.request,
    timeouts,
    pullFirstDelta,
    consume,
    dispose,
    stats,
    isFinished: () => finished,
    progress: () => ({ ...stats, finished, timedOut })
  };
}

module.exports = {
  PROVIDERS,
  DEFAULT_MODELS,
  KEY_ENV,
  STREAM_DEFAULTS: {
    firstByteMs: DEFAULT_FIRST_BYTE_TIMEOUT_MS,
    idleMs: DEFAULT_IDLE_TIMEOUT_MS
  },
  resolveTimeouts,
  normalizeMessages,
  buildRequest,
  openStream,
  createStreamSession,
  parseSSELine,
  parseDelta
};
