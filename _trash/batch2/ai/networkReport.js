'use strict';
/**
 * networkReport.js —— 统一故障文案与错误对象工厂
 *
 * 覆盖：超时 / 429 限流 / 401 认证失败 / 403 权限不足 / 5xx 服务端错误 /
 *       网络连接失败 / 密钥未配置 / 请求被上游拒绝 / 已取消 / 未知错误。
 *
 * CommonJS，零依赖。措辞与前端 src/utils/networkReport.ts 保持同一口径。
 */

/** 故障码 */
const CODES = Object.freeze({
  CONFIG: 'CONFIG',
  NETWORK: 'NETWORK',
  TIMEOUT: 'TIMEOUT',
  RATE_LIMIT: 'RATE_LIMIT',
  AUTH: 'AUTH',
  FORBIDDEN: 'FORBIDDEN',
  SERVER: 'SERVER',
  BAD_REQUEST: 'BAD_REQUEST',
  ABORTED: 'ABORTED',
  UNKNOWN: 'UNKNOWN'
});

const PROVIDER_LABELS = Object.freeze({
  openai: 'OpenAI',
  deepseek: 'DeepSeek',
  openrouter: 'OpenRouter',
  gemini: 'Gemini'
});

const TITLES = Object.freeze({
  CONFIG: '密钥未配置',
  NETWORK: '网络连接失败',
  TIMEOUT: '响应超时',
  RATE_LIMIT: '接口限流（429）',
  AUTH: '认证失败（401）',
  FORBIDDEN: '权限不足（403）',
  SERVER: '服务端错误（5xx）',
  BAD_REQUEST: '请求被上游拒绝（4xx）',
  ABORTED: '请求已取消',
  UNKNOWN: '未知错误'
});

const ADVICE = Object.freeze({
  CONFIG: '请在程序同级目录的 .env 中配置对应 API Key 后重启应用。',
  NETWORK: '请检查本机网络与代理设置，或切换供应商后重试。',
  TIMEOUT: '上游长时间无数据返回，已自动重试；仍失败请更换模型或供应商。',
  RATE_LIMIT: '已指数退避自动重试 3 次仍被限流，请稍后 1 分钟再试。',
  AUTH: 'API Key 无效或已过期，请在「模型与 API 配置」中更新密钥。',
  FORBIDDEN: '该 Key 无权访问此模型或区域，请更换模型或申请权限。',
  SERVER: '上游服务异常，已自动重试 3 次仍失败，请稍后再试。',
  BAD_REQUEST: '请求参数被上游拒绝，请检查模型名称与消息格式。',
  ABORTED: '本次生成已被取消，未产生完整内容。',
  UNKNOWN: '发生未识别错误，请重试；若持续出现请查看程序日志。'
});

/** 默认是否属于「流开始前」可安全重试的错误（TIMEOUT 还取决于阶段，见 createError） */
const RETRYABLE_DEFAULT = Object.freeze({
  CONFIG: false,
  NETWORK: true,
  TIMEOUT: true,
  RATE_LIMIT: true,
  AUTH: false,
  FORBIDDEN: false,
  SERVER: true,
  BAD_REQUEST: false,
  ABORTED: false,
  UNKNOWN: false
});

function providerLabel(provider) {
  if (!provider) return 'AI 服务';
  return PROVIDER_LABELS[provider] || String(provider);
}

/** 上游响应体裁剪为可读摘要 */
function summarizeUpstream(bodyText, limit = 240) {
  if (!bodyText) return '';
  const text = String(bodyText).replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length > limit ? text.slice(0, limit) + '…' : text;
}

/**
 * 创建统一错误对象。所有字段（code/status/provider/phase/retryable）都挂在 Error 上，
 * 便于上层判断是否重试。
 */
function createError(code, options) {
  const opts = options || {};
  const normalized = CODES[code] ? code : CODES.UNKNOWN;
  const detail = opts.detail || TITLES[normalized];
  const error = new Error(detail);
  error.name = 'AIStreamError';
  error.code = normalized;
  error.status = typeof opts.status === 'number' ? opts.status : null;
  error.provider = opts.provider || null;
  error.phase = opts.phase || null;
  error.retryAfterMs = typeof opts.retryAfterMs === 'number' && opts.retryAfterMs > 0 ? opts.retryAfterMs : null;
  if (opts.cause) error.cause = opts.cause;
  if (typeof opts.retryable === 'boolean') {
    error.retryable = opts.retryable;
  } else if (normalized === CODES.TIMEOUT) {
    // 首字节超时发生在「流开始前」→ 可重试；chunk 间空闲超时说明流已开始 → 不可重试
    error.retryable = opts.phase !== 'idle';
  } else {
    error.retryable = RETRYABLE_DEFAULT[normalized] === true;
  }
  return error;
}

/** 由 HTTP 状态码构造错误（429/401/403/5xx 及其它 4xx） */
function fromHttpStatus(status, bodyText, provider, extra) {
  const opts = {
    status: status,
    provider: provider || null,
    detail: summarizeUpstream(bodyText) || ('上游返回 HTTP ' + status),
    retryAfterMs: extra && extra.retryAfterMs ? extra.retryAfterMs : null
  };
  if (status === 429) return createError(CODES.RATE_LIMIT, opts);
  if (status === 401) return createError(CODES.AUTH, opts);
  if (status === 403) return createError(CODES.FORBIDDEN, opts);
  if (status >= 500) return createError(CODES.SERVER, opts);
  if (status >= 400) return createError(CODES.BAD_REQUEST, opts);
  return createError(CODES.UNKNOWN, opts);
}

const NETWORK_ERROR_HINTS = [
  'fetch failed',
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EPIPE',
  'socket hang up',
  'network'
];

function looksLikeNetworkError(err) {
  if (!err) return false;
  const name = String(err.name || '');
  if (name === 'TypeError') return true; // Node fetch 连接类失败统一抛 TypeError
  const code = String(err.code || err.errno || '');
  const message = String(err.message || '');
  return NETWORK_ERROR_HINTS.some(function (hint) {
    return code.indexOf(hint) >= 0 || message.toLowerCase().indexOf(hint.toLowerCase()) >= 0;
  });
}

/** 把底层异常归一为统一错误对象 */
function normalizeException(err, provider, phase) {
  if (err && err.name === 'AIStreamError') return err;
  if (err && String(err.name) === 'AbortError') {
    return createError(CODES.ABORTED, {
      provider: provider,
      phase: phase || null,
      detail: '请求已被取消',
      cause: err
    });
  }
  if (looksLikeNetworkError(err)) {
    return createError(CODES.NETWORK, {
      provider: provider,
      phase: phase || null,
      detail: '无法连接到上游服务：' + String((err && err.message) || err),
      cause: err
    });
  }
  return createError(CODES.UNKNOWN, {
    provider: provider,
    phase: phase || null,
    detail: String((err && err.message) || err || '未知错误'),
    cause: err
  });
}

/**
 * 生成给用户看的故障报告对象。
 * @returns {{code:string,title:string,message:string,retryable:boolean,status:number|null,provider:string|null,phase:string|null,attempts:number}}
 */
function reportOf(error) {
  const err = error && error.name === 'AIStreamError' ? error : normalizeException(error, null, null);
  const code = CODES[err.code] ? err.code : CODES.UNKNOWN;
  const title = TITLES[code];
  const label = providerLabel(err.provider);
  const attempts = typeof err.attempts === 'number' && err.attempts > 0 ? err.attempts : 1;
  const lines = ['【' + title + '】' + label + ' 流式调用失败'];
  lines.push('原因：' + String(err.message || title));
  lines.push('处理建议：' + ADVICE[code]);
  if (err.status) lines.push('HTTP 状态：' + err.status);
  if (err.phase === 'first-byte') lines.push('超时阶段：等待首字节');
  if (err.phase === 'idle') lines.push('超时阶段：数据分片之间空闲');
  if (attempts > 1) lines.push('已重试 ' + (attempts - 1) + ' 次（共 ' + attempts + ' 次尝试）');

  return {
    code: code,
    title: title,
    message: lines.join('\n'),
    retryable: err.retryable === true,
    status: err.status || null,
    provider: err.provider || null,
    phase: err.phase || null,
    attempts: attempts
  };
}

/** 是否属于「流开始前」可安全重试的错误（429 / 5xx / 连接失败 / 首字节超时） */
function isRetryable(error) {
  const err = error && error.name === 'AIStreamError' ? error : normalizeException(error, null, null);
  return err.retryable === true;
}

module.exports = {
  CODES: CODES,
  TITLES: TITLES,
  ADVICE: ADVICE,
  RETRYABLE_DEFAULT: RETRYABLE_DEFAULT,
  providerLabel: providerLabel,
  summarizeUpstream: summarizeUpstream,
  createError: createError,
  fromHttpStatus: fromHttpStatus,
  normalizeException: normalizeException,
  looksLikeNetworkError: looksLikeNetworkError,
  reportOf: reportOf,
  isRetryable: isRetryable
};
