'use strict';
// SecTutor 本地启动器（零依赖）：监听 127.0.0.1:8799，
// 供前端主页按钮通过普通 HTTP 请求启停本地后端，无需自定义协议 / 管理员 / 浏览器确认框。
const http = require('http');
const net = require('net');
const { spawn, exec } = require('child_process');

const PORT = 8799;
const BACKEND_PORT = 8787;
const DIR = __dirname;
let backendProc = null;

function corsHeaders() {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };
}

function respond(res, obj, code) {
  res.writeHead(code || 200, corsHeaders());
  res.end(JSON.stringify(obj));
}

function isBackendUp(cb) {
  const sock = new net.Socket();
  let done = false;
  const finish = (v) => { if (!done) { done = true; cb(v); } };
  sock.setTimeout(800);
  sock.once('connect', () => { sock.destroy(); finish(true); });
  sock.once('timeout', () => { sock.destroy(); finish(false); });
  sock.once('error', () => { finish(false); });
  sock.connect(BACKEND_PORT, '127.0.0.1');
}

function startBackend(res) {
  if (backendProc && !backendProc.killed) {
    respond(res, { ok: true, msg: '后端已在运行' });
    return;
  }
  const argv = process.platform === 'win32'
    ? ['/c', 'npm', 'run', 'dev:fe']
    : ['run', 'dev:fe'];
  const cmd = process.platform === 'win32' ? 'cmd.exe' : 'npm';
  const child = spawn(cmd, argv, {
    cwd: DIR,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  backendProc = child;
  child.unref();
  child.on('exit', () => { if (backendProc === child) backendProc = null; });
  respond(res, { ok: true, msg: '启动命令已下发，请稍候刷新状态' });
}

function stopBackend(res) {
  isBackendUp((up) => {
    if (!up) { respond(res, { ok: true, msg: '后端未在运行' }); return; }
    exec(`netstat -ano | findstr :${BACKEND_PORT} | findstr LISTENING`, (e, out) => {
      const lines = (out || '').split('\n').map((s) => s.trim()).filter(Boolean);
      let pid = null;
      for (const l of lines) {
        const parts = l.split(/\s+/);
        const p = parts[parts.length - 1];
        if (p && /^\d+$/.test(p)) { pid = p; break; }
      }
      if (!pid) { respond(res, { ok: false, msg: '未找到监听进程' }); return; }
      exec(`taskkill /PID ${pid} /F /T`, (e2) => {
        if (backendProc) { try { backendProc.kill(); } catch (_) {} backendProc = null; }
        respond(res, { ok: !e2, msg: e2 ? '结束失败' : '已停止后端' });
      });
    });
  });
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders()); res.end(); return; }
  const url = (req.url || '').split('?')[0];
  if (url === '/start') return startBackend(res);
  if (url === '/stop') return stopBackend(res);
  if (url === '/status') {
    return isBackendUp((up) => respond(res, { running: up, port: BACKEND_PORT }));
  }
  respond(res, { error: 'not found' }, 404);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[SecTutor launcher] http://127.0.0.1:${PORT} ready`);
});
