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

const { app, BrowserWindow, ipcMain, Tray, Menu, dialog, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');
// 自动更新的纯判定逻辑（形态 / 错误分类 / 节流 / 安装守卫），随 app.asar 打包。
const updaterCore = require('./updater-core');
// commit hash 等，封包时生成；开发态没有这个文件，退化为只显示版本号。
let buildInfo = {};
try { buildInfo = require('./build-info'); } catch (e) {}

// —— 落盘日志（v1.2.2）——
// 只记 warn/error 级别，按天一个文件。同步 appendFile 量大时会堵 IO，先凑合。
// TODO: 换异步写入 + 大小截断（超 5MB 重开文件）。
const LOG_DIR = path.join(app.getPath('userData'), 'logs');
function appLog(level, msg) {
  const line = new Date().toISOString() + ' [' + level + '] ' + msg + '\n';
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(path.join(LOG_DIR, 'app-' + new Date().toISOString().slice(0, 10) + '.log'), line);
  } catch (e) { /* 写不进去就算了，不能为日志把应用搞崩 */ }
  if (level !== 'info') console.log('[SecTutor][' + level + ']', msg);
}

// 全局兜底：崩了留痕 + 给个说法，别死得无声无息。
process.on('uncaughtException', (err) => {
  appLog('error', 'uncaughtException: ' + (err && err.stack || err));
  try {
    dialog.showErrorBox('SecTutor 遇到了问题',
      '应用内部出现了一个错误，一般不需要重装。\n建议从托盘菜单「退出 SecTutor」后重新打开。\n\n详细日志位于：' + LOG_DIR);
  } catch (e) {}
});
process.on('unhandledRejection', (reason) => {
  appLog('error', 'unhandledRejection: ' + (reason && reason.stack || reason));
});

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

// ============================================================================
// 自动更新（electron-updater + GitHub Releases）
// ============================================================================
// 设计原则（对齐「一键零失败」UX：绝不弹意外窗口、绝不需要管理员）：
//  1. 仅在「打包并已安装」的桌面版生效。开发态（npm start）与免安装版直接跳过，
//     不报错、不打扰，主功能零影响。
//  2. 启动 8 秒后静默检查一次；发现新版本只提示，不自动下载（autoDownload=false），
//     避免占用带宽、避免打断正在进行的靶场练习。
//  3. 用户点「下载更新」才下载；下载完成后提示「安装并重启」。
//  4. autoInstallOnAppQuit=true：下载完但用户没装就退出时，退出即静默安装，
//     把更新摊到「本来就要关程序」的时刻，用户无需额外操作。
//  5. 任何异常（离线 / 仓库不可达 / 未签名）都转成 error 事件吞掉，绝不影响主功能。
//
// 发版前置条件（不满足则更新检测永远失败）：
//  - electron-builder 必须生成 latest.yml（由 build.publish 配置驱动）。
//  - 发版时须把 latest.yml 与 SecTutor-Setup-<version>.exe 一并上传到 GitHub Release，
//    且该 Release 不能是 draft / prerelease（electron-updater 只读 /releases/latest）。
// ============================================================================

// 仅在打包态加载；未打包时 autoUpdater 保持 null，后续统一用 updaterReady() 守卫。
let autoUpdater = null;
if (app.isPackaged) {
  try {
    autoUpdater = require('electron-updater').autoUpdater;
  } catch (e) {
    console.error('[SecTutor] electron-updater 加载失败，自动更新不可用:', (e && e.message) || e);
  }
}

// 当前运行形态是否支持自动更新（判定逻辑见 updater-core.js，可单测）：
//  - 开发态 npm start（!isPackaged）→ dev：不启用
//  - Portable 免安装版（electron-builder 会设 PORTABLE_EXECUTABLE_DIR）→ portable：不启用。
//    electron-updater 的 NSIS 更新只对「安装版」有效，Portable 强开会在 quitAndInstall
//    时失败，还会误导用户以为能自动升级。
//  - electron-updater 加载失败 → loader：不启用
//  - 安装版 → ok：启用
const EDITION = updaterCore.classifyEdition({
  isPackaged: app.isPackaged,
  portable: !!process.env.PORTABLE_EXECUTABLE_DIR,
  loaded: !!autoUpdater,
});

// 更新状态机：单一数据源，主进程 → 渲染进程单向推送，UI 只消费不回写。
let updateState = {
  enabled: EDITION.updatable,  // 自动更新是否可用（安装版为 true）
  reason: EDITION.reason,      // 不可用时的原因：dev / portable / loader / ok
  checking: false,     // 正在检查
  available: false,    // 发现新版本
  version: null,       // 新版本号
  currentVersion: app.getVersion(),
  downloading: false,  // 正在下载
  progress: 0,         // 下载进度 0-100
  downloaded: false,   // 已下载，待重启安装
  error: null,         // 错误原文（可为 null）
  errorKind: null,     // 错误分类（network/ratelimit/forbidden/unreleased/corrupt/unknown）
  checkedAt: null,     // 上次检查时间戳
};

function updaterReady() {
  return EDITION.updatable && !!autoUpdater;
}

// 状态变更 → 广播给渲染进程 + 刷新托盘（托盘文案随状态变化）。
// 放在此处：mainWindow 已在上方声明，refreshTray 为函数声明可提升，无 TDZ 风险。
// 把内部状态压缩成一个「阶段」，用于判断是否需要重建菜单。
function updatePhase() {
  if (updateState.downloaded) return 'downloaded';
  if (updateState.downloading) return 'downloading';
  if (updateState.checking) return 'checking';
  if (updateState.available) return 'available';
  return 'idle';
}

let lastUpdatePhase = 'idle';

function setUpdateState(patch) {
  const prevPhase = updatePhase();
  updateState = Object.assign({}, updateState, patch || {});
  const phase = updatePhase();

  // 下载进度每 0.1% 就推一次，顶部菜单没必要跟着重建（且重建会打断用户正在展开的菜单）。
  // 只在「阶段」真正变化时重建；托盘则每次都刷，因为进度百分比要实时显示在文案里。
  if (phase !== prevPhase && phase !== lastUpdatePhase) {
    lastUpdatePhase = phase;
    try { Menu.setApplicationMenu(buildAppMenu()); } catch (e) { /* 菜单尚未初始化，忽略 */ }
  }

  try {
    if (mainWindow && mainWindow.webContents && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('sectutor:update-state', updateState);
    }
  } catch (e) { /* 窗口可能正在关闭，忽略 */ }
  refreshTray();
}

// —— 更新重试 + 周期复查（v1.2.1）——
// 4h 一查够用了：GitHub 无令牌限流 60 次/h，一天才 6 次请求
const PERIODIC_CHECK_MS = 4 * 60 * 60 * 1000;
const MAX_AUTO_RETRY = 3;
let updateRetryCount = 0;
let retryTimer = null;
let periodicCheckTimer = null;

// 只有断网/被限流才值得自动重试，别的错重试也没用，让用户自己点
// 退避策略放在 updater-core.retryDelay，那边是纯函数好测
function scheduleUpdateRetry(kind) {
  // 原来这里写 if (kind !== 'network' && kind !== 'ratelimit') return;
  // 后来挪进 retryDelay 统一判了，留个痕迹
  if (updateRetryCount >= MAX_AUTO_RETRY) return;
  if (retryTimer) return; // 已经排了就不再排
  const delay = updaterCore.retryDelay(kind, updateRetryCount + 1);
  if (delay == null) return;
  updateRetryCount++;
  console.log('[SecTutor] 检查更新失败(' + kind + '),' + Math.round(delay / 1000) + 's 后重试('
    + updateRetryCount + '/' + MAX_AUTO_RETRY + ')');
  retryTimer = setTimeout(() => {
    retryTimer = null;
    checkUpdate(true); // force 跳过 30s 节流，忙锁还在所以不会并发
  }, delay);
}

// 检查出了明确结果（有新版/没新版/下载完）就清零，说明链路是通的，之前只是偶发
function resetUpdateRetry() {
  updateRetryCount = 0;
  if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
}

// 退出前把定时器清了，免得停后端/销托盘那会儿定时器还在跑
function clearUpdateTimers() {
  if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
  if (periodicCheckTimer) { clearInterval(periodicCheckTimer); periodicCheckTimer = null; }
}

function setupAutoUpdater() {
  // enabled / reason 以 EDITION 为准（setupAutoUpdater 在 whenReady 后调用，广播前先落位，
  // 前端首帧拉 updateState() 即可拿到正确形态）
  updateState.enabled = EDITION.updatable;
  updateState.reason = EDITION.reason;
  if (!updaterReady()) {
    console.log('[SecTutor] 自动更新不可用（reason=' + EDITION.reason + '），本次运行不启用。');
    return;
  }

  autoUpdater.autoDownload = false;      // 先告知，用户决定何时下载
  autoUpdater.allowDowngrade = true;     // 允许回退到旧版本
  autoUpdater.autoInstallOnAppQuit = true; // 已下载未安装 → 退出时静默安装
  // 收敛日志：debug 全部丢弃，避免把本地路径与请求细节刷进控制台。
  autoUpdater.logger = {
    info: (m) => console.log('[Updater]', m),
    warn: (m) => console.warn('[Updater]', m),
    error: (m) => console.error('[Updater]', m),
    debug: () => {},
  };

  autoUpdater.on('checking-for-update', () => {
    setUpdateState({ checking: true, error: null, errorKind: null });
  });

  autoUpdater.on('update-available', (info) => {
    resetUpdateRetry();
    setUpdateState({
      checking: false, available: true, downloading: false, downloaded: false,
      progress: 0, version: (info && info.version) || null, error: null, errorKind: null,
      checkedAt: Date.now(),
    });
    console.log('[SecTutor] 发现新版本:', updateState.version);
  });

  autoUpdater.on('update-not-available', () => {
    resetUpdateRetry();
    setUpdateState({
      checking: false, available: false, downloading: false, downloaded: false,
      progress: 0, version: null, error: null, errorKind: null, checkedAt: Date.now(),
    });
  });

  autoUpdater.on('download-progress', (p) => {
    const pct = p && typeof p.percent === 'number' ? p.percent : 0;
    setUpdateState({ downloading: true, progress: Math.round(pct * 10) / 10 });
  });

  autoUpdater.on('update-downloaded', (info) => {
    resetUpdateRetry();
    setUpdateState({
      checking: false, downloading: false, downloaded: true, progress: 100,
      version: (info && info.version) || updateState.version, error: null, errorKind: null,
    });
    console.log('[SecTutor] 更新已下载:', updateState.version);
  });

  autoUpdater.on('error', (e) => {
    const msg = (e && e.message) || String(e || '未知错误');
    const errorKind = updaterCore.classifyError(e);
    console.error('[SecTutor] 自动更新出错（已忽略，不影响使用）:', msg, '(' + errorKind + ')');
    setUpdateState({ checking: false, downloading: false, error: msg, errorKind, checkedAt: Date.now() });
    // 网络类/限流类自动重试，其它不重试
    scheduleUpdateRetry(errorKind);
  });
}

// —— 更新动作（供托盘菜单 / 顶部菜单 / IPC 共用）——
// electron-updater 的 checkForUpdates 同一时刻只能跑一次（重复调用会抛
// "checkForUpdates already in progress"），且 GitHub API 无令牌限流 60 次/小时。
// 用「忙锁 + 30s 最短间隔」双层保护（判定见 updater-core.js）：
//   - 忙锁：任何来源（启动静默 / 托盘 / 菜单 / IPC）同时只有一个检查在跑
//   - 节流：用户手动点按（force=true）跳过间隔；启动静默 / 重复触发被 30s 间隔挡住
let checkingBusy = false;
const checkThrottle = updaterCore.createThrottle(30000);

function checkUpdate(force) {
  if (!updaterReady()) return;
  if (checkingBusy) {
    console.log('[SecTutor] 检查更新忙锁：忽略重复触发');
    return;
  }
  if (!checkThrottle.ok(Date.now(), !!force)) {
    console.log('[SecTutor] 检查更新节流：距上次检查不足 30s，忽略');
    return;
  }
  checkingBusy = true;
  checkThrottle.mark();
  setUpdateState({ checking: true, error: null, errorKind: null });
  autoUpdater.checkForUpdates()
    .catch((e) => {
      // 'error' 事件通常已 setUpdateState；这里兜底 catch（事件与 reject 可能二选一）
      const errorKind = updaterCore.classifyError(e);
      console.warn('[SecTutor] 检查更新失败（已忽略）:', (e && e.message) || e);
      setUpdateState({ checking: false, error: (e && e.message) || String(e), errorKind, checkedAt: Date.now() });
    })
    .finally(() => { checkingBusy = false; });
}

function downloadUpdate() {
  if (!updaterReady()) return;
  setUpdateState({ downloading: true, progress: 0, error: null, errorKind: null });
  autoUpdater.downloadUpdate().catch((e) => {
    const errorKind = updaterCore.classifyError(e);
    // 下载失败后回到「有新版本」态（available 保持 true），用户可重新点下载
    setUpdateState({ downloading: false, error: (e && e.message) || String(e), errorKind });
  });
}

// 立即退出并安装。先停后端、销毁托盘，避免安装器因文件占用 / 残留托盘失败。
// quitAndInstall(false, true)：显示安装进度，装完自动拉起新版。
// 返回布尔：true=已进入安装流程；false=被守卫拦截（未下载 / 已有错误 / 禁用态）。
function installUpdate() {
  if (!updaterReady() || !updaterCore.canInstall(updateState)) {
    console.warn('[SecTutor] 安装更新被守卫拦截：当前状态不可安装'
      + '（enabled=' + updateState.enabled
      + ', downloaded=' + updateState.downloaded
      + ', error=' + (updateState.error ? 'yes' : 'no') + '）');
    return false;
  }
  setImmediate(() => {
    quitting = true;
    clearUpdateTimers();
    stopServer().then(() => {
      if (tray) { tray.destroy(); tray = null; }
      autoUpdater.quitAndInstall(false, true);
    });
  });
  return true;
}

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

  // 渲染进程崩溃：留痕 + 弹框 + 自动重载一次，别让窗口直接白掉。
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    appLog('error', 'render-process-gone: ' + JSON.stringify(details));
    dialog.showErrorBox('SecTutor 页面崩溃',
      '页面意外崩溃（' + ((details && details.reason) || 'unknown') + '）。\n点击确定后尝试自动恢复；若仍异常请重启应用。');
    try { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.reload(); } catch (e) {}
  });
  mainWindow.webContents.on('preload-error', (_e, p, err) => {
    appLog('error', 'preload-error: ' + p + ' :: ' + (err && err.stack || err));
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

// 托盘更新区：按当前状态只给出「此刻唯一该做的那一个动作」，
// 而不是堆一排灰掉的可选项，让用户随时知道下一步能点什么。
function updateTrayItems() {
  if (!updateState.enabled) return [];
  if (updateState.downloaded) {
    return [
      { type: 'separator' },
      { label: `安装更新 ${updateState.version || ''} 并重启`, click: () => installUpdate() },
    ];
  }
  if (updateState.downloading) {
    return [
      { type: 'separator' },
      { label: `下载更新中… ${updateState.progress}%`, enabled: false },
    ];
  }
  if (updateState.checking) {
    return [
      { type: 'separator' },
      { label: '正在检查更新…', enabled: false },
    ];
  }
  if (updateState.available) {
    return [
      { type: 'separator' },
      { label: `下载新版本 ${updateState.version || ''}`, click: () => downloadUpdate() },
    ];
  }
  return [
    { type: 'separator' },
    { label: '检查更新…', click: () => checkUpdate(true) },
  ];
}

function buildTrayMenu() {
  const running = !!server;
  return Menu.buildFromTemplate([
    { label: '显示主界面', click: () => showWindow() },
    { type: 'separator' },
    { label: running ? '后端状态：运行中 ●' : '后端状态：已停止 ○', enabled: false },
    { label: '启动后端', enabled: !running, click: async () => { await startServer(); } },
    { label: '停止后端', enabled: running, click: async () => { await stopServer(); } },
    ...updateTrayItems(),
    { type: 'separator' },
    { label: '退出 SecTutor', click: () => quitApp() },
  ]);
}

// 托盘悬停能看到更新进度，不用点开菜单。没更新进行中就给默认文案
function updateToolTip() {
  const en = currentLang === 'en';
  const base = en ? 'SecTutor Cybersecurity Training' : 'SecTutor 网络安全实战训练';
  const s = updateState;
  if (!s || !s.enabled) return base;
  const pct = Math.round(s.progress || 0);
  if (s.downloaded) return base + ' — ' + (en ? 'update ' : '更新 ') + (s.version || '') + (en ? ' ready' : ' 已就绪');
  if (s.downloading) return base + ' — ' + (en ? 'downloading ' : '正在下载 ') + pct + '%';
  if (s.checking) return base + ' — ' + (en ? 'checking for updates…' : '正在检查更新…');
  if (s.available) return base + ' — ' + (en ? 'new version ' : '发现新版本 ') + (s.version || '');
  return base;
}

function refreshTray() {
  if (!tray) return;
  tray.setContextMenu(buildTrayMenu());
  tray.setToolTip(updateToolTip());
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
  tray.setToolTip(updateToolTip());
  tray.setContextMenu(buildTrayMenu());
  tray.on('double-click', () => showWindow());
  tray.on('click', () => showWindow());
}

function quitApp() {
  quitting = true;
  clearUpdateTimers();
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
    checkUpdate: '检查更新…',
    updateNone: '当前已是最新版本',
    updateFound: '发现新版本',
    updateDownload: '下载更新',
    updateInstall: '安装更新并重启',
  },
  en: {
    file: 'File', fileQuit: 'Quit SecTutor',
    edit: 'Edit', undo: 'Undo', redo: 'Redo', cut: 'Cut', copy: 'Copy', paste: 'Paste', selectAll: 'Select All',
    view: 'View', reload: 'Reload', resetZoom: 'Actual Size', zoomIn: 'Zoom In', zoomOut: 'Zoom Out', devTools: 'Developer Tools',
    settings: 'Settings', language: 'Language',
    zhLabel: '中文', enLabel: 'English',
    help: 'Help', about: 'About SecTutor',
    checkUpdate: 'Check for Updates…',
    updateNone: 'You are up to date',
    updateFound: 'A new version is available',
    updateDownload: 'Download Update',
    updateInstall: 'Install and Restart',
  },
};

function showAbout() {
  // commit 截 7 位够定位了；开发态没 build-info.json 就只显示版本号。
  const commit = buildInfo && buildInfo.commit ? String(buildInfo.commit).slice(0, 7) : '';
  dialog.showMessageBox(mainWindow, {
    title: 'SecTutor',
    message: 'SecTutor 网络安全实战训练',
    detail: `版本 ${app.getVersion()}${commit ? '（' + commit + '）' : ''}\n本地优先的网络安全学习工具。\n仅用于合法授权范围内的安全学习与防御研究。`,
    icon: loadIcon('icon.png') || undefined,
    buttons: ['确定'],
  });
}

// 顶部「帮助」菜单的更新项：与托盘同源，文案走 i18n。
// 未启用自动更新（开发态 / 免安装版）时返回空数组，连分隔线都不留，避免菜单出现空档。
function updateMenuItems(t) {
  if (!updateState.enabled) return [];
  const sep = [{ type: 'separator' }];
  if (updateState.downloaded) {
    return sep.concat([{ label: t.updateInstall, click: () => installUpdate() }]);
  }
  if (updateState.downloading) {
    return sep.concat([{ label: `${t.updateDownload}… ${updateState.progress}%`, enabled: false }]);
  }
  if (updateState.available) {
    return sep.concat([
      { label: `${t.updateFound} ${updateState.version || ''}`, enabled: false },
      { label: t.updateDownload, click: () => downloadUpdate() },
    ]);
  }
  return sep.concat([{ label: t.checkUpdate, click: () => checkUpdate(true) }]);
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
        ...updateMenuItems(t),
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
    // 自动更新：放在 createTray 之后（内部会刷新托盘），随后重建菜单让更新项按
    // enabled 状态真正出现；再延迟 8 秒静默检查一次，避开启动高峰。
    setupAutoUpdater();
    Menu.setApplicationMenu(buildAppMenu());
    setTimeout(checkUpdate, 8000);
    // 之后每 4h 静默查一次，不弹窗，有新版才在托盘/侧栏亮出来
    periodicCheckTimer = setInterval(() => checkUpdate(false), PERIODIC_CHECK_MS);
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
// 渲染进程异常上报（window.onerror / onunhandledrejection 转发过来落盘）
ipcMain.on('sectutor:renderer-error', (_e, msg) => {
  appLog('error', 'renderer: ' + String(msg).slice(0, 2000));
});
// 设置面板「打开日志文件夹」
ipcMain.handle('sectutor:open-log-dir', async () => {
  try { if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true }); } catch (e) {}
  return shell.openPath(LOG_DIR);
});
ipcMain.on('sectutor:notify-lang', (_e, lang) => {
  if (lang !== 'zh' && lang !== 'en') return;
  if (lang !== currentLang) {
    currentLang = lang;
    Menu.setApplicationMenu(buildAppMenu());
  }
});

// —— IPC：自动更新 ——
// 渲染进程只能触发这四个动作，拿不到文件系统 / 进程等任何其它能力。
// 动作统一委托给 checkUpdate / downloadUpdate / installUpdate（与托盘、菜单同一入口），
// 忙锁 / 节流 / 安装守卫在此天然生效，杜绝多入口各判一套。
ipcMain.handle('sectutor:update-state', async () => updateState);

// 用户手动点按 → force=true（跳过 30s 节流，忙锁仍生效）
ipcMain.handle('sectutor:check-update', async () => {
  if (!updaterReady()) return { ok: false, reason: 'unavailable', state: updateState };
  const busy = checkingBusy;
  const throttled = !busy && !checkThrottle.ok(Date.now(), true);
  if (!busy && !throttled) checkUpdate(true);
  return { ok: true, accepted: !busy && !throttled, busy, throttled, state: updateState };
});

ipcMain.handle('sectutor:download-update', async () => {
  if (!updaterReady()) return { ok: false, reason: 'unavailable', state: updateState };
  if (updateState.downloaded) return { ok: true, already: true, state: updateState };
  downloadUpdate();
  return { ok: true, state: updateState };
});

// 安装并重启：canInstall 守卫（未下载 / 有错误 / 禁用态一律拒绝，返回 not-ready）。
ipcMain.handle('sectutor:install-update', async () => {
  if (!updaterReady()) return { ok: false, reason: 'unavailable' };
  const started = installUpdate();
  return { ok: started, reason: started ? null : 'not-ready', state: updateState };
});
