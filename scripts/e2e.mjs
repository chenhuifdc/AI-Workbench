/**
 * 端到端冒烟脚本（无需任何真实 API KEY / 外网）
 *
 * 做法：本地起一个假的 Ollama 上游（NDJSON 流），让真实服务进程把 provider=ollama
 * 指到这个假上游，从而对 /api/chat/stream 的 SSE 契约做端到端断言：
 *   1. 正常流：delta 逐帧到达 + 末帧 done 携带全文/tokens/latency
 *   2. 停止：客户端中途断开 → 服务端 res.on('close') 必须中断上游连接（不能继续烧 token）
 *   3. 参数缺失：prompt 为空 → 400
 *   4. 不支持的 provider：gemini 无流式 → 501 stream_unsupported（前端据此回退）
 *
 * 运行：npm run e2e     （等价 node scripts/e2e.mjs）
 */

import http from 'node:http';
import { spawn } from 'node:child_process';
import net from 'node:net';

const APP_PORT = Number(process.env.E2E_PORT || 3919);
const APP_BASE = `http://127.0.0.1:${APP_PORT}`;

const results = [];
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

const freePort = () =>
  new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });

const waitForHttp = async (url, timeoutMs = 60000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      return true;
    } catch {
      await new Promise(r => setTimeout(r, 250));
    }
  }
  return false;
};

/** 假 Ollama 上游：按 token 逐条推 NDJSON，并记录客户端是否中途断开 */
function startFakeOllama(port) {
  const state = { requests: 0, abortedMidStream: 0, completed: 0 };
  const TOKENS = ['第一', '段', '回答', '内容', '。'];
  const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || !req.url.startsWith('/api/chat')) {
      res.writeHead(404).end();
      return;
    }
    state.requests += 1;
    let closed = false;
    let i = 0;
    res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
    const timer = setInterval(() => {
      if (closed) return;
      if (i < TOKENS.length) {
        res.write(JSON.stringify({ message: { content: TOKENS[i] }, done: false }) + '\n');
        i += 1;
        return;
      }
      clearInterval(timer);
      res.write(JSON.stringify({ done: true, prompt_eval_count: 20, eval_count: 25 }) + '\n');
      res.end();
      state.completed += 1;
    }, 60);
    res.on('close', () => {
      if (i < TOKENS.length) state.abortedMidStream += 1;
      closed = true;
      clearInterval(timer);
    });
  });
  return new Promise(resolve => server.listen(port, '127.0.0.1', () => resolve({ server, state, tokens: TOKENS })));
}

/** 读取 SSE：回调每帧，返回 { frames, fullText, doneFrame, ended } */
async function readSse(response, { onDelta, abortAfter = Infinity } = {}) {
  const frames = [];
  let fullText = '';
  let doneFrame = null;
  let ended = false;
  const decoder = new TextDecoder();
  let buf = '';
  let deltaCount = 0;
  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        let frame;
        try { frame = JSON.parse(payload); } catch { continue; }
        frames.push(frame);
        if (typeof frame.delta === 'string') {
          deltaCount += 1;
          fullText += frame.delta;
          if (onDelta) onDelta(frame.delta);
          if (deltaCount >= abortAfter) {
            // 模拟前端“停止生成”：直接断开连接
            await reader.cancel();
            return { frames, fullText, doneFrame, ended: false, cancelled: true };
          }
        }
        if (frame.done) doneFrame = frame;
      }
    }
    ended = true;
  } catch {
    /* 客户端取消导致的读取异常属预期 */
  }
  return { frames, fullText, doneFrame, ended };
}

const postStream = (body, signal) =>
  fetch(`${APP_BASE}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

async function main() {
  const upstreamPort = await freePort();
  const { server: fake, state, tokens } = await startFakeOllama(upstreamPort);
  const endpoint = `http://127.0.0.1:${upstreamPort}`;

  const app = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(APP_PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let appLog = '';
  app.stdout.on('data', d => { appLog += d.toString(); });
  app.stderr.on('data', d => { appLog += d.toString(); });

  const cleanup = () => {
    try { app.kill(); } catch { /* ignore */ }
    try { fake.close(); } catch { /* ignore */ }
  };

  try {
    const ready = await waitForHttp(`${APP_BASE}/api/chat/stream`);
    if (!ready) {
      record('服务进程可启动', false, `60s 内未监听 ${APP_BASE}\n${appLog.slice(-800)}`);
      return;
    }
    record('服务进程可启动', true, `监听 ${APP_PORT}`);

    // 1) 正常流
    {
      const resp = await postStream({ provider: 'ollama', endpoint, model: 'e2e-model', prompt: '端到端冒烟', command: 'we' });
      const okStatus = resp.status === 200;
      const ct = resp.headers.get('content-type') || '';
      const { frames, doneFrame, ended } = okStatus ? await readSse(resp) : { frames: [], doneFrame: null, ended: false };
      const deltas = frames.filter(f => typeof f.delta === 'string');
      record('流式：HTTP 200 + text/event-stream', okStatus && ct.includes('text/event-stream'), `status=${resp.status} ct=${ct}`);
      record('流式：delta 逐帧到达', deltas.length >= 2, `delta 帧=${deltas.length}`);
      record('流式：末帧 done 带全文', Boolean(doneFrame && typeof doneFrame.text === 'string' && doneFrame.text.length > 0), doneFrame ? `text=${JSON.stringify(String(doneFrame.text).slice(0, 24))}` : '无 done 帧');
      record('流式：done 带 tokensUsed / latencyMs', Boolean(doneFrame && doneFrame.tokensUsed > 0 && doneFrame.latencyMs >= 0), doneFrame ? `tokens=${doneFrame.tokensUsed} latency=${doneFrame.latencyMs}ms` : '无 done 帧');
      record('流式：连接正常收尾', ended === true, ended ? '' : 'SSE 未正常结束');
      void tokens;
    }

    // 2) 停止：客户端在第 2 个 delta 后断开，服务端必须掐断上游
    {
      const before = state.abortedMidStream;
      const resp = await postStream({ provider: 'ollama', endpoint, model: 'e2e-model', prompt: '停止测试', command: 'we' });
      const { cancelled } = resp.status === 200
        ? await readSse(resp, { abortAfter: 2 })
        : { cancelled: false };
      await new Promise(r => setTimeout(r, 600));
      record('停止：客户端中途断开生效', cancelled === true, `status=${resp.status}`);
      record('停止：服务端同步中断上游连接', state.abortedMidStream > before, `上游中途断开次数=${state.abortedMidStream}`);
    }

    // 3) 参数缺失
    {
      const resp = await postStream({ provider: 'ollama', endpoint });
      record('契约：prompt 缺失返回 400', resp.status === 400, `status=${resp.status}`);
      await resp.text().catch(() => '');
    }

    // 4) 不支持的 provider（前端据此回退到 /api/chat）
    {
      const resp = await postStream({ provider: 'gemini', prompt: 'x', command: 'we', history: [] });
      const body = await resp.text().catch(() => '');
      record('契约：gemini 无流式返回 501 stream_unsupported', resp.status === 501 && body.includes('stream_unsupported'), `status=${resp.status} body=${body.slice(0, 60)}`);
    }
  } finally {
    cleanup();
  }

  const failed = results.filter(r => !r.ok);
  console.log(`\n# e2e: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log('# 失败项：' + failed.map(f => f.name).join(' | '));
    process.exitCode = 1;
  }
}

main().catch(err => {
  console.error('# e2e 运行异常:', err);
  process.exitCode = 1;
});
