'use strict';
/**
 * server-process.js —— 在 Electron 主进程内托管 Express 服务
 *
 * 为什么需要它：渲染层（src/）所有请求都走相对路径 `/api/...`，必须同源才不触发跨域
 * 与 Cookie 问题；而 Electron 里没有浏览器地址栏，因此由主进程在空闲端口上拉起
 * 打包好的 server.js（= src/server.ts 的产物），窗口直接 loadURL 到该端口。
 *
 * 关键约束：
 *   1) 子进程用 `ELECTRON_RUN_AS_NODE=1` + process.execPath 启动 —— 复用 Electron 自带的
 *      Node 运行时，打包后机器上不需要装 Node。
 *   2) cwd 必须是应用根目录：server.js 用 __dirname 解析 dist/ 静态目录，
 *      同时 .env / _kb_work 等相对路径也依赖它。
 *   3) 退出时必须 kill 子进程，否则关窗后 3000 端口会被僵尸进程占住。
 */

const net = require('net');
const path = require('path');
const { spawn } = require('child_process');

/** 应用根目录：开发态 = 项目根；打包态 = resources/app（asar 已关闭，是真实目录） */
const APP_ROOT = path.join(__dirname, '..');

const state = { child: null, port: 0, log: '', exited: false };

/** 向系统要一个空闲端口：listen(0) 拿到系统分配的端口后立刻关掉再交给子进程 */
function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

/** 轮询端口，直到服务真的能握手（比等日志字符串更可靠） */
function waitForPort(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve) => {
    const attempt = () => {
      if (state.exited) return resolve(false);
      if (Date.now() > deadline) return resolve(false);
      const socket = net.connect({ port, host: '127.0.0.1' }, () => {
        socket.destroy();
        resolve(true);
      });
      socket.on('error', () => {
        socket.destroy();
        setTimeout(attempt, 200);
      });
    };
    attempt();
  });
}

/**
 * 拉起 server.js 并等待端口就绪。
 * @returns {Promise<{ok: boolean, port: number, error?: string}>}
 */
async function startServer({ timeoutMs = 45000 } = {}) {
  if (state.child && state.port) return { ok: true, port: state.port };

  const port = await freePort();
  const entry = path.join(APP_ROOT, 'server.js');

  const child = spawn(process.execPath, [entry], {
    cwd: APP_ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      // 打包态必须显式 production：server.ts 非 production 会去 import('vite')，
      // 而 vite 是 devDependency 不在包内 —— 用户机器上没有 vite 时服务根本起不来（白屏）。
      NODE_ENV: 'production',
      // .env 由主进程解析后钉在这里（见 ./env.js 与 main.js loadEnv），显式传给子进程：
      // 打包态 cwd 是 resources/app，用户把 .env 放在 exe 旁边，只能靠这个变量告知。
      AI_WORKBENCH_ENV_FILE: process.env.AI_WORKBENCH_ENV_FILE || '',
      // 让 Electron 以纯 Node 模式运行本文件，而不是再开一个应用窗口
      ELECTRON_RUN_AS_NODE: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  state.child = child;
  state.port = port;
  state.exited = false;

  child.stdout.on('data', (d) => { state.log = (state.log + d.toString()).slice(-8000); });
  child.stderr.on('data', (d) => { state.log = (state.log + d.toString()).slice(-8000); });
  child.on('exit', (code, signal) => {
    state.exited = true;
    if (code !== 0 && code !== null) {
      state.log = (state.log + `\n[server-process] 子进程退出 code=${code} signal=${signal || ''}`).slice(-8000);
    }
  });
  child.on('error', (err) => {
    state.exited = true;
    state.log = (state.log + `\n[server-process] 启动失败: ${(err && err.message) || err}`).slice(-8000);
  });

  const ready = await waitForPort(port, timeoutMs);
  if (!ready) {
    return { ok: false, port, error: state.log.slice(-1200) || '服务未在超时内就绪' };
  }
  return { ok: true, port };
}

/** 关闭子进程（幂等）。Windows 下 spawn 出的 node 无子进程，直接 kill 即可。 */
function stopServer() {
  const child = state.child;
  state.child = null;
  if (!child || child.killed) return;
  try { child.kill(); } catch (_) { /* 已结束 */ }
}

const getServerState = () => ({ port: state.port, running: Boolean(state.child) && !state.exited, log: state.log });

// 最后一道保险：app.exit() / 未捕获异常 / 进程被信号终止时，before-quit 不会触发，
// 只有 process 'exit' 一定触发。没有它，关掉应用后 server 子进程会变成僵尸占着端口。
process.on('exit', () => { stopServer(); });
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => { stopServer(); process.exit(0); });
}

module.exports = { APP_ROOT, startServer, stopServer, getServerState, freePort, waitForPort };
