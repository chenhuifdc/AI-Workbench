'use strict';
/**
 * retry.js —— 流开始前的重试逻辑
 *
 * 规则：
 * 1. 最多 3 次重试（首次 + 3 次 = 共 4 次尝试）。
 * 2. 只有「流开始前」的错误可重试：连接失败、HTTP 429、HTTP 5xx、首字节超时。
 * 3. 一旦已经有 chunk 推给前端（isStreamStarted() 返回 true），立刻停止重试并抛出，
 *    否则前端会收到重复内容。
 * 4. 429 / 5xx 走指数退避 1s → 2s → 4s，并叠加最多 20% 随机抖动；
 *    若上游给了 Retry-After 则优先采用（上限 30s）。
 *
 * 注意：这里的 maxRetries/baseMs 均可被调用方覆盖，仅用于测试提速，默认值即生产值。
 *
 * CommonJS，零依赖。
 */

const { reportOf } = require('./networkReport');

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const MAX_RETRY_AFTER_MS = 30000;

/** 指数退避：1000ms → 2000ms → 4000ms，附带最多 20% 随机抖动 */
function backoffDelay(retryIndex, baseMs) {
  const base = (Number.isFinite(baseMs) && baseMs > 0 ? baseMs : BASE_DELAY_MS) * Math.pow(2, retryIndex);
  return Math.round(base + Math.random() * base * 0.2);
}

function sleep(ms, signal) {
  return new Promise(function (resolve, reject) {
    if (signal && signal.aborted) return reject(signal.reason || new Error('aborted'));
    const timer = setTimeout(function () {
      if (signal) signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(signal.reason || new Error('aborted'));
    }
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * @param {() => Promise<any>} task 返回「已建立连接、尚未向前端推送任何内容」的流会话
 * @param {object} options
 *   - maxRetries  重试次数，默认 3
 *   - baseMs      退避基数，默认 1000
 *   - signal      AbortSignal，取消时中断退避等待
 *   - provider    仅用于错误上报
 *   - onRetry     可选回调 ({ attempt, delayMs, code, error, report })
 *   - isStreamStarted 可选函数，返回 true 表示已向外部推送过内容 → 禁止重试
 */
async function withRetry(task, options) {
  const opts = options || {};
  const maxRetries = Number.isInteger(opts.maxRetries) && opts.maxRetries >= 0 ? opts.maxRetries : MAX_RETRIES;
  const baseMs = Number.isFinite(opts.baseMs) && opts.baseMs > 0 ? opts.baseMs : BASE_DELAY_MS;
  const signal = opts.signal;
  const isStreamStarted = typeof opts.isStreamStarted === 'function' ? opts.isStreamStarted : function () { return false; };
  const onRetry = typeof opts.onRetry === 'function' ? opts.onRetry : null;

  let attempt = 0;
  let lastError = null;

  while (true) {
    if (signal && signal.aborted) {
      const abortError = lastError || new Error('请求已被取消');
      abortError.attempts = Math.max(1, attempt + 1);
      throw abortError;
    }
    try {
      return await task(attempt);
    } catch (error) {
      lastError = error;
      const report = reportOf(error);
      // 流已开始推 chunk：绝不重试（否则前端收到重复内容）
      if (isStreamStarted()) break;
      if (!report.retryable || attempt >= maxRetries) break;

      const retryAfterMs = error && typeof error.retryAfterMs === 'number' && error.retryAfterMs > 0
        ? Math.min(error.retryAfterMs, MAX_RETRY_AFTER_MS)
        : 0;
      const delayMs = retryAfterMs > 0 ? Math.round(retryAfterMs) : backoffDelay(attempt, baseMs);

      if (onRetry) {
        try {
          onRetry({ attempt: attempt + 1, delayMs: delayMs, code: report.code, error: error, report: report });
        } catch (ignored) { /* 回调异常不影响重试流程 */ }
      }

      await sleep(delayMs, signal);
      attempt += 1;
    }
  }

  if (lastError) {
    lastError.attempts = attempt + 1;
    throw lastError;
  }
  throw new Error('withRetry 异常终止');
}

module.exports = {
  MAX_RETRIES: MAX_RETRIES,
  BASE_DELAY_MS: BASE_DELAY_MS,
  MAX_RETRY_AFTER_MS: MAX_RETRY_AFTER_MS,
  backoffDelay: backoffDelay,
  sleep: sleep,
  withRetry: withRetry
};
