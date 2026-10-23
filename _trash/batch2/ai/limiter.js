'use strict';
/**
 * limiter.js —— 轻量并发限制器（信号量 + FIFO 排队）
 *
 * 规则：最多同时运行 3 个 AI 请求，超出的排队等待。
 * 关键：slot 必须在【流正常结束】/【出错】/【被取消】三条路径上都释放，
 *      否则长流会永久占用并发位。因此对外统一提供 run()（内部 finally 释放），
 *      并且 release() 本身是幂等的（重复调用不会多释放）。
 *
 * CommonJS，零依赖。
 */

const { CODES, createError } = require('./networkReport');

const DEFAULT_MAX_CONCURRENT = 3;

function createLimiter(maxConcurrent) {
  const max = Number.isFinite(maxConcurrent) && maxConcurrent > 0 ? Math.floor(maxConcurrent) : DEFAULT_MAX_CONCURRENT;
  let active = 0;
  const queue = [];

  function makeSlot() {
    let released = false;
    return {
      release: function release() {
        if (released) return false; // 幂等：正常结束 / 出错 / 取消都调用，只真正释放一次
        released = true;
        active -= 1;
        dispatch();
        return true;
      },
      get released() {
        return released;
      }
    };
  }

  function dispatch() {
    while (active < max && queue.length > 0) {
      const waiter = queue.shift();
      if (waiter.done) continue;
      waiter.done = true;
      if (waiter.cleanup) waiter.cleanup();
      active += 1;
      waiter.resolve(makeSlot());
    }
  }

  function abortedError() {
    return createError(CODES.ABORTED, { detail: '请求在排队等待并发位时被取消' });
  }

  /** 申请一个并发位；signal 已取消或在排队中被取消都会 reject（且不会漏占并发位） */
  function acquire(signal) {
    if (signal && signal.aborted) return Promise.reject(abortedError());
    if (active < max) {
      active += 1;
      return Promise.resolve(makeSlot());
    }
    return new Promise(function (resolve, reject) {
      const waiter = { done: false, resolve: resolve, reject: reject, cleanup: null };
      if (signal) {
        const onAbort = function () {
          if (waiter.done) return;
          waiter.done = true;
          const index = queue.indexOf(waiter);
          if (index >= 0) queue.splice(index, 1);
          reject(abortedError());
        };
        signal.addEventListener('abort', onAbort, { once: true });
        waiter.cleanup = function () {
          signal.removeEventListener('abort', onAbort);
        };
      }
      queue.push(waiter);
    });
  }

  /** 申请 → 执行 → 无论成功/失败/取消都释放并发位 */
  async function run(task, signal) {
    const slot = await acquire(signal);
    try {
      return await task();
    } finally {
      slot.release();
    }
  }

  function stats() {
    return { max: max, active: active, pending: queue.length };
  }

  return { acquire: acquire, run: run, stats: stats };
}

const defaultLimiter = createLimiter(DEFAULT_MAX_CONCURRENT);

module.exports = {
  DEFAULT_MAX_CONCURRENT: DEFAULT_MAX_CONCURRENT,
  createLimiter: createLimiter,
  defaultLimiter: defaultLimiter
};
