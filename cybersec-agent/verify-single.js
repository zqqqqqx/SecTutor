/* 校验单文件 sec-tutor.html：用 jsdom 加载内联脚本，确认可运行、可搜索、无异常 */
const fs = require("fs");
const path = require("path");
// jsdom 可移植加载：优先用本地依赖（npm install 后 / CI 环境），找不到再回退到本机托管运行时路径（离线开发环境）
function loadJsdom() {
  try { return require("jsdom"); }
  catch (e) { return require("C:/Users/ZQX/.workbuddy/binaries/node/workspace/node_modules/jsdom"); }
}
const { JSDOM, VirtualConsole } = loadJsdom();

const dir = __dirname;
const html = fs.readFileSync(path.join(dir, "sec-tutor.html"), "utf8");

const errors = [];
const vc = new VirtualConsole();
vc.on("jsdomError", (e) => errors.push("jsdomError: " + (e.stack || e.message)));

const dom = new JSDOM(html, {
  runScripts: "dangerously",
  url: "http://localhost/",
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(window) {
    // jsdom 的脚本 VM 不继承 Node 全局的 TextEncoder/TextDecoder，而单文件 app.js 顶层即用 new TextEncoder()。
    // 浏览器/Electron 本身自带该全局，此处仅为 jsdom 校验环境补齐（与 selftest.js 同法），不影响产品行为。
    const { TextEncoder, TextDecoder } = require("util");
    if (typeof window.TextEncoder === "undefined") window.TextEncoder = TextEncoder;
    if (typeof window.TextDecoder === "undefined") window.TextDecoder = TextDecoder;
  },
});
const { window } = dom;
const doc = window.document;
window.addEventListener("error", (e) => errors.push("error: " + (e.error && e.error.stack || e.message)));
window.onerror = (m, s, l, c, err) => errors.push("onerror: " + m + (err && err.stack ? "\n" + err.stack : ""));

// jsdom 自动派发 DOMContentLoaded，但保险起见再手动触发一次
setTimeout(() => {
  doc.dispatchEvent(new window.Event("DOMContentLoaded", { bubbles: true }));
  const $ = (s) => doc.querySelector(s);
  const $$ = (s) => Array.from(doc.querySelectorAll(s));
  const results = [];
  let failed = 0;
  const assert = (c, n) => { results.push((c ? "PASS" : "FAIL") + " - " + n); if (!c) failed++; };

  assert($$("#topicGrid .topic-card").length > 0, `单文件知识点卡片渲染 (${$$("#topicGrid .topic-card").length} 张)`);
  const kb = $("#kbSearch");
  kb.value = "注入";
  kb.dispatchEvent(new window.Event("input"));
  assert($$("#topicGrid .topic-card").length > 0, "单文件搜索可用");
  kb.value = "";
  kb.dispatchEvent(new window.Event("input"));
  assert($$("#topicGrid .topic-card").length > 0, "单文件清空搜索恢复列表");
  assert(doc.querySelectorAll('link[rel="stylesheet"]').length === 0, "单文件无外部 CSS 引用");
  assert(doc.querySelectorAll('script[src]').length === 0, "单文件无外部 JS 引用");
  assert(errors.length === 0, `单文件无运行时异常 (${errors.length} 条)`);

  console.log("\n==== 单文件校验 ====");
  results.forEach((r) => console.log(r));
  if (errors.length) { console.log("\n-- 异常 --"); errors.forEach((e) => console.log(e)); }
  console.log(`\n总计：通过 ${results.length - failed}/${results.length}`);
  process.exit(failed === 0 && errors.length === 0 ? 0 : 1);
}, 300);
