'use strict';
/**
 * updater-core.js — 自动更新的纯逻辑层（可单测、不依赖 electron）
 *
 * 放在 main.js 同层、随 app.asar 一起打包。main.js 只负责把 electron 环境事实
 * （isPackaged / PORTABLE_EXECUTABLE_DIR / electron-updater 是否加载成功）喂进来，
 * 一切「能不能更新 / 什么错 / 多久查一次 / 能不能装」的判定都收敛在本模块，
 * 便于用普通 node 直接做单元测试，也避免把判定散落在 IPC / 事件回调里。
 *
 * 产出三类能力：
 *  1. classifyEdition —— 当前运行形态是否支持自动更新（普适性：Portable 不误启用）
 *  2. classifyError  —— 把 electron-updater 的原始错误归类成用户可理解的类型（稳定性）
 *  3. createThrottle / canInstall —— 检查节流与安装守卫（稳定性：防重复检查/越权安装）
 */

// —— 版本形态判定 ——
// isPackaged: app.isPackaged（开发态 = false）
// portable:   是否存在 PORTABLE_EXECUTABLE_DIR（electron-builder Portable 启动器会设置）
// loaded:     require('electron-updater') 是否成功
// 返回 { updatable:boolean, reason:'ok'|'dev'|'portable'|'loader' }
function classifyEdition({ isPackaged, portable, loaded }) {
  if (!isPackaged) return { updatable: false, reason: 'dev' };
  if (portable) return { updatable: false, reason: 'portable' };
  if (!loaded) return { updatable: false, reason: 'loader' };
  return { updatable: true, reason: 'ok' };
}

// —— 错误分类 ——
// electron-updater 的错误 message 五花八门（Chromium net:: 错误 / Node ENOTFOUND /
// GitHub HTTP 状态 / 校验失败），直接展示给用户既难懂又吓人。这里归成 6 类，
// 由前端按当前语言渲染成一句人话。
// 返回 'network' | 'ratelimit' | 'forbidden' | 'unreleased' | 'corrupt' | 'unknown'
function classifyError(err) {
  const msg = String((err && (err.message || err)) || '').toLowerCase();
  if (/(err_internet_disconnected|err_connection_refused|err_connection_reset|err_connection_timed_out|err_timed_out|err_name_not_resolved|err_address_unreachable|err_network_changed|enotfound|econnrefused|econnreset|etimedout|eai_again|networkerror|cannot connect|socket hang up|getaddrinfo|tunneling socket|proxy|offline)/.test(msg)) {
    return 'network';
  }
  if (/(rate limit|rate_limit|too many requests|429)/.test(msg)) return 'ratelimit';
  if (/(403|forbidden|access denied)/.test(msg)) return 'forbidden';
  if (/(404|cannot find latest\.yml|latest\.yml|no released|release .* not found|not found)/.test(msg)) return 'unreleased';
  if (/(sha512|checksum|integrity check|corrupt|validation failed|hash mismatch)/.test(msg)) return 'corrupt';
  return 'unknown';
}

// —— 检查节流 ——
// electron-updater 的 checkForUpdates 同一时刻只能跑一次，且 GitHub API 无令牌时
// 有 60 次/小时限流。用「忙锁 + 最短间隔」两层保护：
//   ok(now, force)   —— 是否允许发起检查；force=true 表示用户主动点按，跳过间隔限制
//   mark(now)        —— 发起检查后记录时间
//   since(now)       —— 距上次检查过了多久（毫秒）
function createThrottle(minIntervalMs) {
  let last = 0;
  return {
    ok(now, force) {
      if (force) return true;
      // last===0 表示从没查过，直接放行。别写成 (now - 0) >= minIntervalMs，
      // 那样小时间戳（测试里很常见）会被误判成刚查过——单测抓出来过这个坑
      if (last === 0) return true;
      const n = now || Date.now();
      return (n - last) >= minIntervalMs;
    },
    mark(now) { last = now || Date.now(); },
    since(now) { return last === 0 ? Infinity : (now || Date.now()) - last; },
  };
}

// —— 安装守卫 ——
// quitAndInstall 只应在「已下载完成」时调用。IPC 与托盘都经过这里，
// 防止任何状态（网络异常返回、前端误点、状态未刷新）在未下载时触发重启安装。
function canInstall(state) {
  return !!(state && state.enabled && state.downloaded && !state.error);
}

// 重试退避：network 指数退避 30/60/90s，ratelimit 固定 60s，其它不重试（返回 null）
// TODO: ratelimit 理论上可以解析 Retry-After 头，但 electron-updater 的错误对象里
// 不一定带，先固定 60s 凑合
function retryDelay(kind, attempt) {
  if (kind === 'ratelimit') return 60000;
  if (kind === 'network') return 30000 * Math.max(1, attempt | 0);
  return null;
}

module.exports = { classifyEdition, classifyError, createThrottle, canInstall, retryDelay };
