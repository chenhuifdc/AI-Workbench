'use strict';
/**
 * main.js —— Electron 主进程
 *
 * 职责：
 *   1) 加载 .env（开发态读项目根，打包后读 exe 同级目录）
 *   2) 在空闲端口拉起 server.js（= src/server.ts 产物），渲染层同源访问 /api/*
 *   3) 创建窗口（contextIsolation + preload）
 *   4) 把渲染进程的流式 AI 请求转交 electron/ai 模块，并通过
 *      event.sender.send 把文本增量实时推回渲染进程（打字机效果）
 *      —— 注意：渲染层目前并未使用这些 IPC 通道，实际链路是 3) 里的本地 HTTP，
 *         该 IPC 桥属待清理的历史实现，改动前请先确认没有引用。
 *
 * IPC 通道（与 electron/ai/index.js 中的 IPC/CHANNELS 保持一致）：
 *   渲染 → 主：ai:call-stream   { channelId, payload }
 *              ai:abort-stream  { channelId }
 *   主 → 渲染：ai:chunk:<channelId>   文本增量 (string)
 *              ai:done:<channelId>    结束标记  ({ channelId, provider, model, deltas })
 *              ai:error:<channelId>   错误报告  ({ code, title, message, ... })
 *
 * 约束：CommonJS、不引入任何 AI SDK、不使用 Express（服务进程由 server.js 提供）。
 */

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const serverProc = require('./server-process');

// ---------------------------------------------------------------------------
// 1) .env 加载（必须在 require('./ai') 之前，保证 Key 已进入 process.env）
//
//    解析用 dotenv，不自写解析器：带引号的值、转义字符、行尾空格、export 前缀
//    等边界情况自写版本容易出 bug。
//
//    打包（zip 目标）后的目录结构：
//        release/win-unpacked/AI工作台.exe   ← 双击这个
//        release/win-unpacked/*.dll
//        release/win-unpacked/.env           ← .env 放这里，与 exe 同级
//    path.dirname(process.execPath) 在打包态正好是 win-unpacked/；
//    开发态 process.execPath 是 node.exe，故再回落到项目根 .env。
// ---------------------------------------------------------------------------

const ENV_KEYS = ['GEMINI_API_KEY', 'DEEPSEEK_API_KEY', 'OPENROUTER_API_KEY', 'OPENAI_API_KEY', 'OLLAMA_HOST'];
let envSource = null;
let envError = null;

/** 按优先级返回候选 .env 路径：exe 同级（打包态）→ 项目根（开发态）。 */
function envPaths() {
  const paths = [path.join(path.dirname(process.execPath), '.env')];
  if (!(app && app.isPackaged)) paths.push(path.join(__dirname, '..', '.env'));
  return paths;
}

/** 用 dotenv 加载 .env：不覆盖已存在的环境变量（override: false，即 shell 里显式设置优先）。 */
function loadEnv() {
  for (const file of envPaths()) {
    try {
      if (!fs.existsSync(file)) continue;
      const result = dotenv.config({ path: file, override: false, quiet: true });
      if (result && result.error) {
        envError = `${file}: ${result.error.message}`;
        console.error('[env] 读取失败:', envError);
        continue;
      }
      envSource = file;
      break;
    } catch (err) {
      envError = `${file}: ${(err && err.message) || err}`;
      console.error('[env] 读取失败:', envError);
    }
  }

  const present = ENV_KEYS.filter((k) => String(process.env[k] || '').trim());
  if (!envSource) {
    console.warn('[env] 未找到 .env，尝试的路径:', envPaths().join(' | '));
  } else {
    console.log('[env] 已加载:', envSource, '| 可用 Key:', present.join(', ') || '（无）');
  }
}

loadEnv();

const ai = require('./ai');
const { IPC, CHANNELS } = ai;

// ---------------------------------------------------------------------------
// 2) 窗口
// ---------------------------------------------------------------------------

/** channelId → 发起请求的 webContents，窗口关闭时据此中断其所有在飞的流 */
const activeStreams = new Map();

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0f1115',
    show: false,
    autoHideMenuBar: true,
    title: 'AI 工作台',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // preload 里要用 require('crypto').randomUUID() 生成 channelId，故关闭 sandbox
      sandbox: false,
      spellcheck: false
    }
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  // 新窗口一律走系统浏览器，避免在应用内打开外链
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  // 渲染进程销毁 → 把它发起的所有流全部取消，防止主进程继续占用并发 slot
  mainWindow.webContents.on('destroyed', () => abortStreamsOf(mainWindow && mainWindow.webContents));
  mainWindow.on('closed', () => { mainWindow = null; });

  const devUrl = process.env.VITE_DEV_SERVER_URL || process.env.ELECTRON_RENDERER_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else if (serverProc.getServerState().port) {
    // 同源加载：渲染层的相对路径 /api/* 直接命中本地 server.js
    mainWindow.loadURL(`http://127.0.0.1:${serverProc.getServerState().port}`);
  } else {
    // 理论上不可达（启动失败已在 whenReady 里拦截），兜底给用户一条可读信息
    mainWindow.loadURL(
      'data:text/html;charset=utf-8,' +
        encodeURIComponent('<h3>本地服务未启动</h3><p>请查看日志后重启应用。</p>')
    );
  }

  // 自动化外壳冒烟（仅 ELECTRON_SMOKE=1 时生效）：验证窗口真的加载了渲染层，
  // 且渲染层能用同源相对路径命中 /api/*。供 scripts/smoke-electron.mjs 调用。
  if (process.env.ELECTRON_SMOKE) {
    mainWindow.webContents.on('did-fail-load', (_e, code, desc) => {
      console.error(`[smoke] did-fail-load code=${code} desc=${desc}`);
      app.exit(1);
    });
    mainWindow.webContents.on('did-finish-load', async () => {
      try {
        const url = mainWindow.webContents.getURL();
        const probe = await mainWindow.webContents.executeJavaScript(
          "fetch('/api/engine/status').then(r => r.status).catch(e => 'ERR:' + e.message)"
        );
        console.log(`[smoke] url=${url} api=${probe}`);
        if (process.env.ELECTRON_SMOKE_FILE) {
          try {
            fs.writeFileSync(process.env.ELECTRON_SMOKE_FILE, `url=${url} api=${probe}\n`, 'utf8');
          } catch (_) { /* 忽略：仅测试钩子 */ }
        }
        app.exit(probe === 200 ? 0 : 1);
      } catch (err) {
        console.error(`[smoke] 探测失败: ${(err && err.message) || err}`);
        app.exit(1);
      }
    });
  }

  return mainWindow;
}

// ---------------------------------------------------------------------------
// 3) 流式 AI 的 IPC 桥
// ---------------------------------------------------------------------------

/**
 * 渲染进程可能已销毁。isDestroyed() 自检与 send 之间仍有竞态窗口（自检通过后
 * 窗口才被关掉），因此 send 必须用 try/catch 包住：失败就静默跳过，
 * 绝不把异常抛进流程，也绝不让主进程崩溃。
 */
function safeSend(sender, channel, payload) {
  if (!sender || typeof sender.send !== 'function') return false;
  try {
    if (typeof sender.isDestroyed === 'function' && sender.isDestroyed()) return false;
    sender.send(channel, payload);
    return true;
  } catch (err) {
    // 渲染进程已关闭/正在销毁：丢弃这一片即可，流本身继续走完清理逻辑
    console.warn('[ipc] 推送失败（渲染进程可能已关闭）:', channel, (err && err.message) || err);
    return false;
  }
}

function abortStreamsOf(sender) {
  for (const [channelId, s] of activeStreams) {
    if (s === sender) {
      activeStreams.delete(channelId);
      try { ai.abortAIStream(channelId); } catch (_) { /* 已结束 */ }
    }
  }
}

function registerIPC() {
  ipcMain.on(IPC.CALL, (event, args) => {
    const sender = event.sender;
    const payload = (args && args.payload) || {};
    const channelId = String((args && args.channelId) || payload.channelId || '').trim();

    if (!channelId) {
      safeSend(sender, CHANNELS.error(''), {
        code: 'BAD_REQUEST',
        title: '请求缺少 channelId',
        message: '主进程无法定位流式通道，已忽略本次请求。',
        retryable: false
      });
      return;
    }

    activeStreams.set(channelId, sender);

    ai.callAIStream(
      payload,
      // onChunk：文本增量，实时推送 → 前端可做打字机效果
      (text) => { safeSend(sender, CHANNELS.chunk(channelId), text); },
      // onError：统一故障报告
      (report) => {
        activeStreams.delete(channelId);
        safeSend(sender, CHANNELS.error(channelId), report);
      },
      // onDone：结束标记
      (info) => {
        activeStreams.delete(channelId);
        safeSend(sender, CHANNELS.done(channelId), info);
      },
      { channelId }
    ).catch((err) => {
      // 兜底：ai 模块本身承诺不会抛，但这里仍兜一层，绝不让异常冒到主进程
      activeStreams.delete(channelId);
      safeSend(sender, CHANNELS.error(channelId), {
        code: 'UNKNOWN',
        title: '未知错误',
        message: String((err && err.message) || err),
        retryable: false
      });
    });
  });

  ipcMain.on(IPC.ABORT, (event, args) => {
    const channelId = String((args && args.channelId) || '').trim();
    if (!channelId) return;
    activeStreams.delete(channelId);
    ai.abortAIStream(channelId);
  });
}

// ---------------------------------------------------------------------------
// 4) 生命周期
// ---------------------------------------------------------------------------

if (app && typeof app.whenReady === 'function') {
  app.whenReady().then(async () => {
    registerIPC();

    // 先起本地服务再开窗：窗口一旦加载就是可用状态，不会先闪一个连不上的白屏
    if (!process.env.VITE_DEV_SERVER_URL && !process.env.ELECTRON_RENDERER_URL) {
      const started = await serverProc.startServer();
      if (!started.ok) {
        dialog.showErrorBox(
          '本地服务启动失败',
          `无法启动内置服务（server.js）。\n\n${started.error || '未知原因'}`
        );
      }
    }

    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  for (const channelId of Array.from(activeStreams.keys())) {
    try { ai.abortAIStream(channelId); } catch (_) { /* 已结束 */ }
  }
  activeStreams.clear();
  // 关掉托管的 server.js，避免残留进程占着端口
  serverProc.stopServer();
});

module.exports = {
  loadEnv,
  envPaths,
  safeSend,
  activeStreams,
  createWindow,
  registerIPC,
  getEnvState: () => ({ source: envSource, error: envError })
};
