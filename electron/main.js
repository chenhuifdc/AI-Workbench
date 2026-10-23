'use strict';
/**
 * main.js —— Electron 主进程
 *
 * 职责（只有三件）：
 *   1) 加载 .env（显式路径，见 ./env.js；打包态读 exe 同级 .env）
 *   2) 在空闲端口拉起 server.js（= src/server.ts 产物），窗口同源加载该端口，
 *      渲染层的相对路径 /api/* 直接命中本地服务
 *   3) 创建窗口 + 生命周期（关闭即停服，不留僵尸进程）
 *
 * 历史：曾有一套 ai:call-stream / ai:chunk:* 的 IPC 桥（electron/ai/*、preload.js），
 * 渲染层从未使用（src/ 内 window.ai / electronAPI 零引用），已随批次 2 移除，
 * 快照在 _trash/batch2/。若将来要恢复，先确认渲染层真有调用方。
 *
 * 约束：CommonJS、不引入任何 AI SDK、不使用 Express（HTTP 服务由 server.js 提供）。
 */

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const { app, BrowserWindow, shell, dialog } = require('electron');
const envLib = require('./env');
const serverProc = require('./server-process');

// ---------------------------------------------------------------------------
// 1) .env 加载（显式路径：AI_WORKBENCH_ENV_FILE → exe 同级 → 项目根）
// ---------------------------------------------------------------------------

const ENV_KEYS = ['GEMINI_API_KEY', 'DEEPSEEK_API_KEY', 'OPENROUTER_API_KEY', 'OPENAI_API_KEY', 'OLLAMA_HOST'];
let envSource = null;
let envError = null;

/** 候选路径（与 server-process 共用同一套解析，避免两处各猜一个）。 */
function envPaths() {
  return envLib.envCandidates(app);
}

function loadEnv() {
  const result = envLib.loadEnv(app, dotenv);
  envSource = result.source;
  envError = result.error;

  // 关键：把实际命中的 .env 绝对路径钉在环境变量上，随 spawn 传给 server.js。
  // 否则打包后子进程 cwd 在 resources/app，会去那里找 .env（那里没有）。
  if (envSource) process.env.AI_WORKBENCH_ENV_FILE = envSource;

  const present = ENV_KEYS.filter((k) => String(process.env[k] || '').trim());
  if (envError) {
    console.error('[env] 读取失败:', envError);
  } else if (!envSource) {
    console.warn('[env] 未找到 .env，尝试的路径:', result.candidates.join(' | '));
  } else {
    console.log('[env] 已加载:', envSource, '| 可用 Key:', present.join(', ') || '（无）');
  }
  return { source: envSource, error: envError };
}

loadEnv();

// ---------------------------------------------------------------------------
// 2) 窗口
// ---------------------------------------------------------------------------

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
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  // 新窗口一律走系统浏览器，避免在应用内打开外链
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

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
        // 同时探测 API 与首页：只测 /api 会漏掉「静态资源没挂上 → 白屏」这类故障
        const probe = await mainWindow.webContents.executeJavaScript(
          "Promise.all([fetch('/api/engine/status').then(r => r.status).catch(() => 'ERR')," +
            " fetch('/').then(r => r.status).catch(() => 'ERR')])" +
            ".then(([a, r]) => a + '|' + r)"
        );
        const [apiStatus, rootStatus] = String(probe).split('|');
        console.log(`[smoke] url=${url} api=${apiStatus} root=${rootStatus}`);
        if (process.env.ELECTRON_SMOKE_FILE) {
          try {
            fs.writeFileSync(
              process.env.ELECTRON_SMOKE_FILE,
              `url=${url} api=${apiStatus} root=${rootStatus}\n`,
              'utf8'
            );
          } catch (_) { /* 忽略：仅测试钩子 */ }
        }
        app.exit(apiStatus === '200' && rootStatus === '200' ? 0 : 1);
      } catch (err) {
        console.error(`[smoke] 探测失败: ${(err && err.message) || err}`);
        app.exit(1);
      }
    });
  }

  return mainWindow;
}

// ---------------------------------------------------------------------------
// 3) 生命周期
// ---------------------------------------------------------------------------

if (app && typeof app.whenReady === 'function') {
  app.whenReady().then(async () => {
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
  // 关掉托管的 server.js，避免残留进程占着端口
  serverProc.stopServer();
});

module.exports = {
  loadEnv,
  envPaths,
  createWindow,
  getEnvState: () => ({ source: envSource, error: envError }),
  getEnvCandidates: () => envLib.envCandidates(app)
};
