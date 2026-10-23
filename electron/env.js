'use strict';
/**
 * env.js —— .env 定位与加载（显式路径，唯一真源）
 *
 * 为什么单独成模块：主进程（main.js）要读 Key 才能把配置透传给渲染层/服务，
 * 服务子进程（server-process.js）也要用同一个 .env 作为 cwd，否则打包后
 * 两边看到的配置不一致。以前两处各自猜路径，打包版就出现「主进程读不到 .env」。
 *
 * 解析优先级（显式、可预测，不再靠 cwd 猜）：
 *   1) AI_WORKBENCH_ENV_FILE —— 显式指定的绝对/相对路径（排障、多套配置时用）
 *   2) 打包态：<exe 所在目录>/.env        （用户把 .env 放在 exe 旁边）
 *   3) 开发态：<项目根>/.env
 *
 * 约束：CommonJS；只依赖 fs / path / dotenv。
 */

const path = require('path');
const fs = require('fs');

/** 应用资源根目录（打包后是 resources/app，开发态是项目根）。 */
const APP_ROOT = path.join(__dirname, '..');

/** 是否是打包态。app 可能尚不可用（个别脚本单测），故用 execPath 名兜底判断。 */
function isPackaged(app) {
  if (app && typeof app.isPackaged === 'boolean') return app.isPackaged;
  return !/^(node|electron)(\.exe)?$/i.test(path.basename(process.execPath));
}

/** exe 所在目录（打包态即 win-unpacked/，开发态是 node.exe 目录，不作为 .env 来源）。 */
function exeDir() {
  return path.dirname(process.execPath);
}

/**
 * 按优先级返回候选 .env 路径（去重、保留顺序）。
 * 显式指定的 AI_WORKBENCH_ENV_FILE 只认它一个，避免"以为改了 A 其实读到 B"。
 */
function envCandidates(app) {
  const explicit = String(process.env.AI_WORKBENCH_ENV_FILE || '').trim();
  if (explicit) return [path.resolve(APP_ROOT, explicit)];

  const out = [];
  if (isPackaged(app)) out.push(path.join(exeDir(), '.env'));
  out.push(path.join(APP_ROOT, '.env'));
  return out;
}

/** 返回第一个真实存在的 .env 路径；一个都没有则返回 null。 */
function resolveEnvFile(app) {
  for (const file of envCandidates(app)) {
    try {
      if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
    } catch (_) {
      /* 权限/竞态：当作不存在，继续下一个候选 */
    }
  }
  return null;
}

/**
 * 用 dotenv 把 .env 注入 process.env（override:false —— shell 里显式设置的值优先）。
 * 返回 { source, error }：source 为实际加载的路径，找不到为 null。
 */
function loadEnv(app, dotenv) {
  const file = resolveEnvFile(app);
  if (!file) return { source: null, error: null, candidates: envCandidates(app) };
  try {
    const result = dotenv.config({ path: file, override: false, quiet: true });
    if (result && result.error) {
      return { source: null, error: `${file}: ${result.error.message}`, candidates: envCandidates(app) };
    }
    return { source: file, error: null, candidates: envCandidates(app) };
  } catch (err) {
    return { source: null, error: `${file}: ${(err && err.message) || err}`, candidates: envCandidates(app) };
  }
}

module.exports = { APP_ROOT, exeDir, isPackaged, envCandidates, resolveEnvFile, loadEnv };
