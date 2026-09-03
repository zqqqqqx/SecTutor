'use strict';
/**
 * updater-core.test.js — updater-core 纯逻辑单元测试（node 直跑，不依赖 electron）
 *
 *   node sectutor-app/updater-core.test.js
 *
 * 覆盖五组判定：版本形态 / 错误分类 / 检查节流 / 安装守卫 / 重试策略。
 * 之所以单独成文件而不是散在 main.js：这些都是纯函数，脱离 Electron 也能验证，
 * 改判定逻辑时不必为了跑测试去打包一次应用。
 */
const core = require('./updater-core');

let pass = 0;
let fail = 0;
const fails = [];

function eq(actual, expected, name) {
  if (actual === expected) pass += 1;
  else {
    fail += 1;
    fails.push(name + '：期望 ' + JSON.stringify(expected) + '，实际 ' + JSON.stringify(actual));
  }
}

/* —— 1. classifyEdition：什么形态才允许自动更新 —— */
eq(core.classifyEdition({ isPackaged: false, portable: false, loaded: true }).reason, 'dev', '开发态 → dev');
eq(core.classifyEdition({ isPackaged: false, portable: false, loaded: true }).updatable, false, '开发态不可更新');
eq(core.classifyEdition({ isPackaged: true, portable: true, loaded: true }).reason, 'portable', '免安装版 → portable');
eq(core.classifyEdition({ isPackaged: true, portable: true, loaded: true }).updatable, false, '免安装版不可更新');
eq(core.classifyEdition({ isPackaged: true, portable: false, loaded: false }).reason, 'loader', '组件未加载 → loader');
eq(core.classifyEdition({ isPackaged: true, portable: false, loaded: false }).updatable, false, '组件未加载不可更新');
eq(core.classifyEdition({ isPackaged: true, portable: false, loaded: true }).reason, 'ok', '安装版 → ok');
eq(core.classifyEdition({ isPackaged: true, portable: false, loaded: true }).updatable, true, '安装版可更新');
// 判定顺序：未打包优先于免安装（开发态跑 Portable 也只应报 dev）
eq(core.classifyEdition({ isPackaged: false, portable: true, loaded: false }).reason, 'dev', 'dev 优先于 portable/loader');

/* —— 2. classifyError：把原始错误归成用户能懂的六类 —— */
eq(core.classifyError(new Error('getaddrinfo ENOTFOUND api.github.com')), 'network', 'DNS 失败 → network');
eq(core.classifyError(new Error('net::ERR_INTERNET_DISCONNECTED')), 'network', '断网 → network');
eq(core.classifyError(new Error('connect ETIMEDOUT')), 'network', '连接超时 → network');
eq(core.classifyError(new Error('socket hang up')), 'network', '连接被挂断 → network');
eq(core.classifyError(new Error('429 Too Many Requests')), 'ratelimit', '429 → ratelimit');
eq(core.classifyError(new Error('GitHub rate limit exceeded')), 'ratelimit', '限流文案 → ratelimit');
eq(core.classifyError(new Error('HttpError: 403 Forbidden')), 'forbidden', '403 → forbidden');
eq(core.classifyError(new Error('Cannot find latest.yml in the latest release')), 'unreleased', '缺清单 → unreleased');
eq(core.classifyError(new Error('HttpError: 404')), 'unreleased', '404 → unreleased');
eq(core.classifyError(new Error('sha512 checksum mismatch')), 'corrupt', '校验失败 → corrupt');
eq(core.classifyError(new Error('something totally unexpected')), 'unknown', '未识别 → unknown');
eq(core.classifyError(null), 'unknown', 'null 错误 → unknown（不抛异常）');
eq(core.classifyError(''), 'unknown', '空串错误 → unknown（不抛异常）');

/* —— 3. createThrottle：忙锁之外的第二层保护 —— */
const th = core.createThrottle(30000);
eq(th.ok(1000, false), true, '首次检查允许');
th.mark(1000);
eq(th.ok(15000, false), false, '15s 内被节流');
eq(th.ok(15000, true), true, 'force=true 跳过节流（用户手动点按）');
eq(th.ok(31000, false), true, '超过 30s 再次允许');
eq(th.since(31000), 30000, 'since 返回距上次的间隔');
const th2 = core.createThrottle(30000);
eq(th2.ok(0, false), true, '时间戳 0（从未检查）允许');
// 回归：曾误判「从未检查」为「刚检查过」，因为判定写成了 (now - 0) >= 30000
eq(th2.ok(1000, false), true, '小时间戳（计时器/测试）也允许首次检查');
eq(th2.since(12345), Infinity, '从未检查 → since = Infinity（不是距 1970 年的毫秒数）');

/* —— 4. canInstall：只有「已下载且无错误」才允许重启安装 —— */
eq(core.canInstall({ enabled: true, downloaded: true, error: null }), true, '已下载 → 可安装');
eq(core.canInstall({ enabled: true, downloaded: false, error: null }), false, '未下载 → 拒绝');
eq(core.canInstall({ enabled: false, downloaded: true, error: null }), false, '禁用态 → 拒绝');
eq(core.canInstall({ enabled: true, downloaded: true, error: 'boom' }), false, '有错误 → 拒绝');
eq(core.canInstall({ enabled: true, downloaded: false }), false, '缺 error 字段 → 拒绝');
eq(core.canInstall(null), false, 'null 状态 → 拒绝');
eq(core.canInstall(undefined), false, 'undefined 状态 → 拒绝');
eq(core.canInstall({}), false, '空对象 → 拒绝');

/* —— 5. retryDelay：哪些失败值得自动重试、等多久 —— */
eq(core.retryDelay('network', 1), 30000, 'network 第 1 次 → 30s');
eq(core.retryDelay('network', 2), 60000, 'network 第 2 次 → 60s');
eq(core.retryDelay('network', 3), 90000, 'network 第 3 次 → 90s');
eq(core.retryDelay('ratelimit', 1), 60000, 'ratelimit → 固定 60s');
eq(core.retryDelay('forbidden', 1), null, 'forbidden → 不重试');
eq(core.retryDelay('unreleased', 1), null, 'unreleased → 不重试');
eq(core.retryDelay('corrupt', 1), null, 'corrupt → 不重试');
eq(core.retryDelay('unknown', 1), null, 'unknown → 不重试');
eq(core.retryDelay('network', 0), 30000, 'attempt=0 兜底 30s（不会退化成 0）');
eq(core.retryDelay(null, 1), null, 'null 类型 → 不重试');

/* —— 6. 链路组合：真实错误串 → 分类 → 重试决策 —— */
eq(core.retryDelay(core.classifyError(new Error('getaddrinfo ENOTFOUND api.github.com')), 1), 30000,
  '链路：断网 → 30s 后重试');
eq(core.retryDelay(core.classifyError(new Error('429 Too Many Requests')), 1), 60000,
  '链路：限流 → 60s 后重试');
eq(core.retryDelay(core.classifyError(new Error('sha512 checksum mismatch')), 1), null,
  '链路：校验失败 → 不重试');
eq(core.retryDelay(core.classifyError(new Error('HttpError: 403')), 1), null,
  '链路：无权访问 → 不重试');

console.log('\n总计：通过 ' + pass + '/' + (pass + fail));
if (fail > 0) {
  console.log('失败项：');
  fails.forEach((f) => console.log('  x ' + f));
  process.exit(1);
}
console.log('updater-core 单测全部通过');
