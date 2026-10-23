'use strict';
/**
 * preload.js —— 渲染进程与主进程之间的唯一桥
 *
 * 暴露 window.ai（contextIsolation 下经 contextBridge 注入）：
 *   startAIStream(payload[, channelId]) → channelId   // channelId 由前端生成（crypto.randomUUID()）
 *   abortAIStream(channelId)
 *   onAIChunk(channelId, cb) → unsubscribe()
 *   onAIDone(channelId, cb)  → unsubscribe()
 *   onAIError(channelId, cb) → unsubscribe()
 *   subscribeAI(channelId, { onChunk, onDone, onError }) → unsubscribeAll()
 *   disposeAI(channelId) / inspect()
 *
 * 监听器清理（防内存泄漏，两层保险）：
 *   1) 每个 onXxx 都返回取消订阅函数，内部 ipcRenderer.removeListener 精确解绑；
 *   2) 【自动清理】同一 channelId 的 done 或 error 一旦到达，该 channelId 名下的
 *      全部监听器（含本模块内部的收尾监听器）自动移除，不依赖前端手动调用。
 *      清理用 queueMicrotask 延后到本轮 emit 结束，保证用户自己的 onDone/onError
 *      回调先跑完再解绑，绝不会把用户回调一起吞掉。
 *
 * 通道名与 electron/ai/index.js 的 IPC/CHANNELS 完全一致（此处复刻常量，
 * preload 不 require 业务模块，避免把 Node 依赖带进渲染进程上下文）。
 */

const { contextBridge, ipcRenderer } = require('electron');
const crypto = require('crypto');

const IPC = Object.freeze({
  CALL: 'ai:call-stream',
  ABORT: 'ai:abort-stream'
});

const CHANNELS = Object.freeze({
  chunk: (channelId) => `ai:chunk:${channelId}`,
  done: (channelId) => `ai:done:${channelId}`,
  error: (channelId) => (channelId ? `ai:error:${channelId}` : 'ai:error')
});

/** 取消后的兜底回收时限：万一主进程没回 error（例如已被强杀），也不会永久残留监听器 */
const ABORT_GRACE_MS = 30000;

/** channelId → { entries:Set<{channel,listener}>, reapers:[{channel,listener}], timer, reaped } */
const groups = new Map();

function newChannelId() {
  if (crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // 兜底：极老的 Node 运行时
  return 'ch-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

/** 立即清理某 channelId 名下全部监听器（幂等） */
function reap(channelId) {
  const group = groups.get(channelId);
  if (!group) return 0;
  groups.delete(channelId);
  group.reaped = true;
  if (group.timer) { clearTimeout(group.timer); group.timer = null; }

  let removed = 0;
  for (const entry of group.entries) {
    try { ipcRenderer.removeListener(entry.channel, entry.listener); removed++; } catch (_) { /* ignore */ }
  }
  group.entries.clear();
  for (const entry of group.reapers) {
    try { ipcRenderer.removeListener(entry.channel, entry.listener); removed++; } catch (_) { /* ignore */ }
  }
  group.reapers.length = 0;
  return removed;
}

/** 取（或建）某 channelId 的监听器组；首次创建时挂上「终局即清理」的内部收尾监听器 */
function groupOf(channelId) {
  const key = String(channelId || '');
  let group = groups.get(key);
  if (group) return group;

  group = { entries: new Set(), reapers: [], timer: null, reaped: false };
  groups.set(key, group);

  for (const kind of ['done', 'error']) {
    const channel = CHANNELS[kind](key);
    const listener = () => {
      // 延后到本轮 emit 结束：用户的 onDone/onError 先执行，再统一解绑
      queueMicrotask(() => reap(key));
    };
    ipcRenderer.on(channel, listener);
    group.reapers.push({ channel, listener });
  }
  return group;
}

/** 订阅一个通道，返回取消订阅函数（幂等） */
function subscribe(channelId, kind, callback) {
  if (typeof callback !== 'function') {
    throw new TypeError('callback 必须是函数');
  }
  const key = String(channelId || '');
  const channel = CHANNELS[kind](key);
  const group = groupOf(key);

  const listener = (_event, data) => {
    try {
      callback(data);
    } catch (err) {
      // 用户回调里的异常不能影响自动清理，也不能打断其它监听器
      console.error('[ai] 回调异常:', (err && err.message) || err);
    }
  };
  ipcRenderer.on(channel, listener);
  const entry = { channel, listener };
  group.entries.add(entry);

  let off = false;
  return function unsubscribe() {
    if (off) return;
    off = true;
    const g = groups.get(key);
    if (!g || !g.entries.delete(entry)) return;
    try { ipcRenderer.removeListener(channel, listener); } catch (_) { /* ignore */ }
    // 该 channelId 已无人订阅 → 内部收尾监听器也没必要留着
    if (g.entries.size === 0) reap(key);
  };
}

const api = {
  /** 发起流式请求；channelId 由前端生成（不传则由本模块用 crypto.randomUUID() 生成），并回传给前端 */
  startAIStream(payload, channelId) {
    const id = String(channelId || newChannelId());
    reap(id);   // 复用同一 channelId 时，先清掉上一轮的残留监听器
    ipcRenderer.send(IPC.CALL, { channelId: id, payload: Object.assign({}, payload, { channelId: id }) });
    return id;
  },

  /** 取消某个流；主进程会回一条 ABORTED 错误报告，届时监听器自动清理 */
  abortAIStream(channelId) {
    if (!channelId) return false;
    const id = String(channelId);
    ipcRenderer.send(IPC.ABORT, { channelId: id });
    // 兜底：主进程因故没能回 error 时，超时后仍把监听器收掉
    const group = groups.get(id);
    if (group && !group.timer) {
      group.timer = setTimeout(() => reap(id), ABORT_GRACE_MS);
      if (typeof group.timer.unref === 'function') group.timer.unref();
    }
    return true;
  },

  /** 文本增量（打字机效果的数据源） */
  onAIChunk(channelId, callback) {
    return subscribe(channelId, 'chunk', callback);
  },

  /** 结束标记：{ channelId, provider, model, deltas } */
  onAIDone(channelId, callback) {
    return subscribe(channelId, 'done', callback);
  },

  /** 统一故障报告：{ code, title, message, status, retryable, ... } */
  onAIError(channelId, callback) {
    return subscribe(channelId, 'error', callback);
  },

  /** 便捷方法：一次性订阅三件套，返回统一取消订阅函数 */
  subscribeAI(channelId, handlers) {
    const h = handlers || {};
    const offs = [];
    if (typeof h.onChunk === 'function') offs.push(subscribe(channelId, 'chunk', h.onChunk));
    if (typeof h.onDone === 'function') offs.push(subscribe(channelId, 'done', h.onDone));
    if (typeof h.onError === 'function') offs.push(subscribe(channelId, 'error', h.onError));
    return function unsubscribeAll() {
      while (offs.length) {
        const off = offs.pop();
        try { off(); } catch (_) { /* 已解绑 */ }
      }
    };
  },

  /** 手动兜底清理（例如组件卸载时页面自己再收一次） */
  disposeAI(channelId) {
    return reap(String(channelId || ''));
  },

  /** 只读诊断：当前残留的 channelId 数与监听器总数，便于排查泄漏 */
  inspect() {
    let listeners = 0;
    for (const g of groups.values()) listeners += g.entries.size + g.reapers.length;
    return { channels: groups.size, listeners, ipc: IPC };
  }
};

contextBridge.exposeInMainWorld('ai', api);
