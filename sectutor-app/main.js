'use strict';
/**
 * main.js — SecTutor 桌面应用主进程
 *
 * 设计要点：
 *  - 后端（sectutor-backend 的 Express 实例）以「应用内进程」方式直接在本进程 listen，
 *    因此「启动 / 停止后端」按钮可通过 IPC 让主进程直接控制，浏览器沙箱限制被彻底绕开：
 *    无需自定义协议、无需管理员、无需强制开机自启、无需常驻 launcher。
 *  - 渲染进程加载 http://127.0.0.1:<port>/ ，该地址由内嵌后端同源托管 cybersec-agent 前端，
 *    前端所有既有 API 调用（含 /api/envs 代理）均同源，不再触发跨域预检。
 *  - 正经软件外壳：系统托盘常驻（关闭窗口仅最小化到托盘）、单实例锁、应用图标。
 *
 * 健壮性（v1.1）：
 *  - 后端加载 / 启动全程 try-catch，任何异常都给友好错误页，绝不白屏或静默无窗口。
 *  - 端口被占用（EADDRINUSE）时提示明确原因，而非连到一个不认识的服务或白屏。
 *  - 页面加载失败（did-fail-load）兜底显示错误页。
 */

const { app, BrowserWindow, ipcMain, Tray, Menu, dialog, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

// 资源目录：开发态（npm start）下在应用目录的上级；打包态（npm run dist）下
// 由 electron-builder 的 extraResources 放入 process.resourcesPath，必须分别解析，
// 否则打包后相对路径失效、后端/前端都加载不到。
const isPackaged = app.isPackaged;
const backendDir = isPackaged
  ? path.join(process.resourcesPath, 'sectutor-backend')
  : path.join(__dirname, '..', 'sectutor-backend');
const frontendDir = isPackaged
  ? path.join(process.resourcesPath, 'cybersec-agent')
  : path.join(__dirname, '..', 'cybersec-agent');

// 必须在 require 后端模块之前设定环境变量（config.js 在加载时读取）。
// 桌面版默认仿真模式（DOCKER_SIMULATE=1），无需本机安装 Docker 即可练习；
// 若你已安装 Docker 并想用真实靶机，可在启动前设 DOCKER_SIMULATE=0。
process.env.DOCKER_SIMULATE = process.env.DOCKER_SIMULATE || '1';
// 让内嵌后端同源托管 cybersec-agent 前端目录。
process.env.FRONTEND_DIR = frontendDir;

// 后端模块加载包一层 try-catch：加载失败（路径/依赖缺失）只影响后端能力，
// 不让整个应用无声崩溃。
let backendApp = null;
let config = { port: 8787, simulate: true };
let reclaim = { startReclaimer() {} };
try {
  backendApp = require(path.join(backendDir, 'src', 'index.js'));
  config = require(path.join(backendDir, 'config'));
  reclaim = require(path.join(backendDir, 'src', 'reclaim'));
} catch (e) {
  console.error('[SecTutor] 后端模块加载失败（应用仍会启动，但靶场后端不可用）:', e && e.stack || e);
  backendApp = null;
}

let mainWindow = null;
let server = null;
let starting = false;
let tray = null;
let quitting = false;
// 界面语言（全局设置，默认中文）。由顶部「设置 → 语言」菜单切换，
// 通过 IPC 推送给渲染进程，并随渲染进程 localStorage 双向同步勾选状态。
let currentLang = 'zh';

// 图标加载（容错：缺失不崩，仅降级为无图标）。
// 打包态优先读 extraResources 根目录的图标（Windows 托盘对 asar 内路径支持不佳）。
function loadIcon(file) {
  const candidates = [];
  if (isPackaged) candidates.push(path.join(process.resourcesPath, file));
  candidates.push(path.join(__dirname, 'assets', file));
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const img = nativeImage.createFromPath(p);
        if (img && !img.isEmpty()) return img;
      }
    } catch (e) { /* 图标缺失不影响运行 */ }
  }
  return null;
}

// 友好错误页（替代白屏）。
function errorPageHtml(title, msg) {
  const t = (title || '⚠️ SecTutor 启动未完成').replace(/[<>&]/g, ' ');
  const m = (msg || '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>SecTutor</title>
  <style>html,body{height:100%}body{font-family:system-ui,'Microsoft YaHei',sans-serif;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;margin:0}
  .card{max-width:540px;padding:28px 32px;background:#1e293b;border:1px solid #334155;border-radius:14px;text-align:center}
  h1{font-size:20px;margin:0 0 12px} p{color:#94a3b8;line-height:1.6;font-size:14px} code{background:#0f172a;padding:2px 6px;border-radius:6px;color:#f87171}</style></head>
  <body><div class="card"><h1>${t}</h1><p>${m}</p><p style="margin-top:16px;font-size:12px">如需帮助，请查看项目 README 或联系开发者。</p></div></body></html>`;
}

function startServer() {
  return new Promise((resolve) => {
    if (server || starting) { resolve({ ok: !!server, reason: 'already' }); return; }
    if (!backendApp) { resolve({ ok: false, reason: 'nohandler' }); return; }
    starting = true;
    try { reclaim.startReclaimer(); } catch (e) { console.error('[SecTutor] 回收器启动失败(已忽略):', e.message); }
    server = backendApp.listen(config.port, () => {
      starting = false;
      console.log(`[SecTutor] 后端已启动 :${config.port} (simulate=${config.simulate})`);
      refreshTray();
      resolve({ ok: true, reason: 'listening' });
    });
    server.on('error', (e) => {
      starting = false;
      console.error('[SecTutor] 后端启动失败:', e.message);
      server = null;
      resolve({ ok: false, reason: e.code || 'error' });
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (!server) { resolve({ ok: false, running: false }); return; }
    server.close(() => {
      server = null;
      console.log('[SecTutor] 后端已停止');
      refreshTray();
      resolve({ ok: true, running: false });
    });
  });
}

function showWindow() {
  if (!mainWindow) { createWindow(); return; }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createWindow() {
  const icon = loadIcon('icon.png');
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: 'SecTutor 网络安全实战训练',
    icon: icon || undefined,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // 页面加载失败兜底：连不上内嵌后端时给明确提示，而非白屏。
  mainWindow.webContents.on('did-fail-load', (_e, _code, desc) => {
    const msg = !server
      ? `后端未启动：端口 ${config.port} 可能被占用，请关闭占用该端口的程序后重启 SecTutor。`
      : `页面加载失败：${desc || '未知错误'}。可尝试从托盘菜单「退出 SecTutor」后重开。`;
    console.error('[SecTutor] 页面加载失败:', desc);
    mainWindow.loadURL(
      'data:text/html;charset=utf-8,' + encodeURIComponent(errorPageHtml(null, msg))
    );
  });

  // 后端未就绪（端口占用 / 模块加载失败）→ 直接显示错误页，绝不加载一个不认识的服务。
  if (!server) {
    const reason = !backendApp
      ? '后端模块加载失败（sectutor-backend 缺失或依赖不全），靶场后端不可用。'
      : `后端未能在端口 ${config.port} 启动（可能被占用或权限不足）。`;
    mainWindow.loadURL(
      'data:text/html;charset=utf-8,' + encodeURIComponent(errorPageHtml(null, reason))
    );
  } else {
    mainWindow.loadURL(`http://127.0.0.1:${config.port}/`);
  }
  mainWindow.once('ready-to-show', () => mainWindow.show());

  // 关闭窗口 → 最小化到托盘（应用不退出，内嵌后端继续运行）。
  mainWindow.on('close', (e) => {
    if (!quitting) {
      e.preventDefault();
      mainWindow.hide();
      return;
    }
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

function buildTrayMenu() {
  const running = !!server;
  return Menu.buildFromTemplate([
    { label: '显示主界面', click: () => showWindow() },
    { type: 'separator' },
    { label: running ? '后端状态：运行中 ●' : '后端状态：已停止 ○', enabled: false },
    { label: '启动后端', enabled: !running, click: async () => { await startServer(); } },
    { label: '停止后端', enabled: running, click: async () => { await stopServer(); } },
    { type: 'separator' },
    { label: '退出 SecTutor', click: () => quitApp() },
  ]);
}

function refreshTray() {
  if (tray) tray.setContextMenu(buildTrayMenu());
}

function createTray() {
  let trayIcon = loadIcon('icon.png');
  if (!trayIcon) {
    // 兜底：内置 1px 透明图标，避免无图标时报错。
    trayIcon = nativeImage.createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC'
    );
  }
  tray = new Tray(trayIcon);
  tray.setToolTip('SecTutor 网络安全实战训练');
  tray.setContextMenu(buildTrayMenu());
  tray.on('double-click', () => showWindow());
  tray.on('click', () => showWindow());
}

function quitApp() {
  quitting = true;
  stopServer().then(() => {
    if (tray) { tray.destroy(); tray = null; }
    app.quit();
  });
}

// —— 顶部原生菜单（中文，语言随全局设置切换）——
// 菜单文案随 currentLang 切换，做到「中英文切换是全局的」。
const MENU_I18N = {
  zh: {
    file: '文件', fileQuit: '退出 SecTutor',
    edit: '编辑', undo: '撤销', redo: '重做', cut: '剪切', copy: '复制', paste: '粘贴', selectAll: '全选',
    view: '视图', reload: '重新加载', resetZoom: '实际大小', zoomIn: '放大', zoomOut: '缩小', devTools: '开发者工具',
    settings: '设置', language: '语言',
    zhLabel: '中文', enLabel: 'English',
    help: '帮助', about: '关于 SecTutor',
  },
  en: {
    file: 'File', fileQuit: 'Quit SecTutor',
    edit: 'Edit', undo: 'Undo', redo: 'Redo', cut: 'Cut', copy: 'Copy', paste: 'Paste', selectAll: 'Select All',
    view: 'View', reload: 'Reload', resetZoom: 'Actual Size', zoomIn: 'Zoom In', zoomOut: 'Zoom Out', devTools: 'Developer Tools',
    settings: 'Settings', language: 'Language',
    zhLabel: '中文', enLabel: 'English',
    help: 'Help', about: 'About SecTutor',
  },
};

function showAbout() {
  dialog.showMessageBox(mainWindow, {
    title: 'SecTutor',
    message: 'SecTutor 网络安全实战训练',
    detail: '版本 1.0.0\n本地优先的网络安全学习工具。\n仅用于合法授权范围内的安全学习与防御研究。',
    icon: loadIcon('icon.png') || undefined,
    buttons: ['确定'],
  });
}

function buildAppMenu() {
  const t = MENU_I18N[currentLang === 'en' ? 'en' : 'zh'];
  const isZh = currentLang !== 'en';
  return Menu.buildFromTemplate([
    {
      label: t.file,
      submenu: [
        { label: t.fileQuit, click: () => quitApp() },
      ],
    },
    {
      label: t.edit,
      submenu: [
        { label: t.undo, role: 'undo' },
        { label: t.redo, role: 'redo' },
        { type: 'separator' },
        { label: t.cut, role: 'cut' },
        { label: t.copy, role: 'copy' },
        { label: t.paste, role: 'paste' },
        { label: t.selectAll, role: 'selectAll' },
      ],
    },
    {
      label: t.view,
      submenu: [
        { label: t.reload, role: 'reload' },
        { label: t.resetZoom, role: 'resetZoom' },
        { label: t.zoomIn, role: 'zoomIn' },
        { label: t.zoomOut, role: 'zoomOut' },
        { type: 'separator' },
        { label: t.devTools, role: 'toggleDevTools' },
      ],
    },
    {
      label: t.settings,
      submenu: [
        {
          label: t.language,
          submenu: [
            { label: t.zhLabel, type: 'radio', checked: isZh, click: () => applyLangFromMenu('zh') },
            { label: t.enLabel, type: 'radio', checked: !isZh, click: () => applyLangFromMenu('en') },
          ],
        },
      ],
    },
    {
      label: t.help,
      submenu: [
        { label: t.about, click: () => showAbout() },
      ],
    },
  ]);
}

// 顶部「设置 → 语言」菜单点击：更新全局语言、重建菜单勾选、推送命令给渲染进程。
function applyLangFromMenu(lang) {
  if (lang !== 'zh' && lang !== 'en') lang = 'zh';
  currentLang = lang;
  Menu.setApplicationMenu(buildAppMenu());
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('sectutor:lang-command', lang);
  }
}

// 注：按用户要求，不做任何开机自启（不弹窗、不注册）。如需开机启动，可自行在 Windows
// 「设置 → 应用 → 启动」中添加 SecTutor（或后续版本提供开关）。

// —— 单实例锁：避免重复启动多个实例，重复启动时聚焦已有窗口 ——
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showWindow());

  app.whenReady().then(async () => {
    const r = await startServer();
    if (!r.ok) {
      console.error('[SecTutor] 后端未能自动启动，reason =', r.reason, '；窗口将提示用户。');
    }
    createWindow();
    createTray();
    // 顶部原生菜单栏（中文，含「设置 → 语言」）。
    Menu.setApplicationMenu(buildAppMenu());
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
      else showWindow();
    });
  });

  // 关闭窗口已改为隐藏到托盘，不会真正退出；此处仅在主动退出时兜底。
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin' && quitting) app.quit();
  });
}

// —— IPC：前端按钮直接控制内嵌后端 ——
ipcMain.handle('sectutor:start', async () => {
  const r = await startServer();
  return { ok: r.ok, running: !!server, port: config.port };
});
ipcMain.handle('sectutor:stop', async () => {
  const ok = await stopServer();
  return { ok, running: !!server, port: config.port };
});
ipcMain.handle('sectutor:status', async () => {
  return { running: !!server, port: config.port, simulate: config.simulate };
});

// 渲染进程上报当前界面语言（init 时调用），用于同步菜单「语言」子菜单的勾选。
ipcMain.on('sectutor:notify-lang', (_e, lang) => {
  if (lang !== 'zh' && lang !== 'en') return;
  if (lang !== currentLang) {
    currentLang = lang;
    Menu.setApplicationMenu(buildAppMenu());
  }
});
