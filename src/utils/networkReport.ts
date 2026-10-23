// 网络故障统一报告文案（服务端与前端共用同一措辞）
export const NETWORK_FAULT_REPORT = [
  '一、系统网络故障报告',
  '1. 当前已触发三次重试机制',
  '2. 服务器请求响应时间超出 300 秒限制',
  '3. 网络连接超时'
].join('\n');

export const MAX_RETRIES = 3;
export const REQUEST_TIMEOUT_MS = 300000; // 单次请求超时 300 秒
export const API_KEY_MISSING = '请配置API KEY';

/** 指数退避延迟：1s, 2s, 4s（附带最多 20% 随机抖动） */
export function backoffDelay(retryIndex: number): number {
  const base = 1000 * Math.pow(2, retryIndex);
  return base + Math.floor(Math.random() * base * 0.2);
}
