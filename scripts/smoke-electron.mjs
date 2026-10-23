/**
 * Electron 外壳冒烟（无需外网 / 无需 API KEY）
 *
 * 断言四件事：
 *   1) 主进程能拉起内置 server.js，并等到端口可用
 *   2) 窗口真的加载出渲染层（URL 是 http://127.0.0.1:<port>，不是 file://）
 *   3) 渲染层用相对路径 fetch('/api/engine/status') 拿到 200（同源链路通）
 *   4) 退出后托管的 server 子进程被清理（不留僵尸进程）
 *
 * 用法：node scripts/smoke-electron.mjs   （需先 npm run build 生成 dist/ 与 server.js）
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ELECTRON_BIN = path.join(
  ROOT,
  'node_modules',
  'electron',
  'dist',
  process.platform === 'win32' ? 'electron.exe' : 'electron'
);

const missing = ['dist/index.html', 'server.js', 'electron/main.js'].filter(
  (f) => !fs.existsSync(path.join(ROOT, f))
);
if (missing.length) {
  console.error(`✗ 缺少构建产物: ${missing.join(', ')}（先跑 npm run build）`);
  process.exit(1);
}

const started = () => new Promise((resolve, reject) => {
  const child = spawn(ELECTRON_BIN, ['.'], {
    cwd: ROOT,
    env: { ...process.env, ELECTRON_SMOKE: '1', ELECTRON_ENABLE_LOGGING: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  const timer = setTimeout(() => {
    child.kill();
    reject(new Error(`超时（45s）未收到 smoke 结果：\n${out.slice(-1500)}`));
  }, 45000);

  const onData = (d) => {
    out += d.toString();
    const m = out.match(/\[smoke\] url=(\S+) api=(\S+)(?: root=(\S+))?/);
    if (m) {
      clearTimeout(timer);
      resolve({ url: m[1], api: m[2], root: m[3] || 'n/a', child, out });
    }
  };
  child.stdout.on('data', onData);
  child.stderr.on('data', onData);
  child.on('exit', (code) => {
    clearTimeout(timer);
    if (/\[smoke\]/.test(out)) return; // 已由 onData 处理
    reject(new Error(`Electron 提前退出 code=${code}：\n${out.slice(-1500)}`));
  });
});

/** 端口占用探测：确认退出后没有僵死的 server 子进程 */
function portBusy(port) {
  return new Promise((resolve) => {
    const s = net.connect({ port, host: '127.0.0.1' }, () => { s.destroy(); resolve(true); });
    s.on('error', () => { s.destroy(); resolve(false); });
  });
}

const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};

try {
  const { url, api, root, child, out } = await started();

  check('窗口 URL 为本地服务的 http 源', /^http:\/\/127\.0\.0\.1:\d+\/?$/.test(url), url);
  check('渲染层同源 fetch /api/engine/status', api === '200', `status=${api}`);
  check('首页 / 返回 200（静态资源已挂载，非白屏）', root === '200', `status=${root}`);
  check('无 did-fail-load', !/did-fail-load/.test(out));

  const port = Number(new URL(url).port);
  child.kill();
  await new Promise((r) => setTimeout(r, 2500));
  const busy = await portBusy(port);
  check('退出后托管服务已清理', !busy, busy ? `端口 ${port} 仍被占用` : `端口 ${port} 已释放`);

  const failed = checks.filter((c) => !c.ok);
  console.log(`\n# electron smoke: ${checks.length - failed.length}/${checks.length} passed`);
  process.exit(failed.length ? 1 : 0);
} catch (err) {
  console.error(`✗ ${err.message}`);
  process.exit(1);
}
