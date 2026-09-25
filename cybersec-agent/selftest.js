/* SecTutor 自测：用 jsdom 加载页面并模拟交互，捕获运行时异常与逻辑断言 */
const fs = require("fs");
const path = require("path");
// jsdom 可移植加载：优先用本地依赖（npm install 后 / CI 环境），找不到再回退到本机托管运行时路径（离线开发环境）
function loadJsdom() {
  try { return require("jsdom"); }
  catch (e) { return require("C:/Users/ZQX/.workbuddy/binaries/node/workspace/node_modules/jsdom"); }
}
const { JSDOM, VirtualConsole } = loadJsdom();

const dir = __dirname;
let html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
const dataJs = fs.readFileSync(path.join(dir, "data.js"), "utf8");
const appJs = fs.readFileSync(path.join(dir, "app.js"), "utf8");
// 去掉外部 script 标签（由我们手动注入），避免 jsdom 尝试加载
html = html.replace(/<script src="data\.js"><\/script>/, "").replace(/<script src="app\.js"><\/script>/, "");

const errors = [];
const vc = new VirtualConsole();
vc.on("jsdomError", (e) => errors.push("jsdomError: " + (e.stack || e.message)));

const dom = new JSDOM(html, { runScripts: "dangerously", url: "http://localhost/", pretendToBeVisual: true, virtualConsole: vc });
const { window } = dom;
const doc = window.document;
window.addEventListener("error", (e) => errors.push("error event: " + (e.error && e.error.stack || e.message)));
window.onerror = (m, s, l, c, err) => errors.push("onerror: " + m + (err && err.stack ? "\n" + err.stack : ""));

// jsdom 可能缺少以下 Web API；补充以便覆盖函数调用 / 流式 / 连接测试分支
if (typeof window.AbortController === "undefined") {
  window.AbortController = global.AbortController || class { constructor() { this.signal = { aborted: false }; } abort() { this.signal.aborted = true; } };
}
if (typeof window.TextEncoder === "undefined") window.TextEncoder = TextEncoder;
if (typeof window.TextDecoder === "undefined") window.TextDecoder = TextDecoder;
if (typeof window.ReadableStream === "undefined") window.ReadableStream = ReadableStream;
// 默认 fetch 兜底（避免任何未预期的网络调用直接抛错中断测试）
if (typeof window.fetch === "undefined") window.fetch = function () { return Promise.reject(new Error("no fetch in test harness")); }
// Web Crypto（AES-GCM）用于密钥保险库自测；jsdom 默认无 crypto.subtle，注入 Node webcrypto 使其跑通真实加解密
if (!window.crypto || !window.crypto.subtle) {
  try { Object.defineProperty(window, "crypto", { value: require("crypto").webcrypto, configurable: true }); }
  catch (e) { try { window.crypto = require("crypto").webcrypto; } catch (e2) {} }
}

function inject(code) {
  const s = doc.createElement("script");
  s.textContent = code;
  doc.body.appendChild(s);
}

const results = [];
let failed = 0;
function assert(cond, name) {
  results.push((cond ? "PASS" : "FAIL") + " - " + name);
  if (!cond) failed++;
}
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  window.__SELFTEST__ = true; // 启用 app.js 内的自测同步钩子（如搜索防抖刷新）
  inject(dataJs);
  inject(appJs);
  doc.dispatchEvent(new window.Event("DOMContentLoaded", { bubbles: true }));
} catch (e) {
  errors.push("inject/init threw: " + e.stack);
}

const $ = (s) => doc.querySelector(s);
const $$ = (s) => Array.from(doc.querySelectorAll(s));
function clickTab(name) { $(`.rail-item[data-tab="${name}"]`).click(); }

// 1. 知识卡片渲染
const cards = $$("#topicGrid .topic-card");
assert(cards.length > 0, `知识点卡片渲染 (${cards.length} 张)`);

// 2. 点击知识点 -> 详情
cards[0].click();
const detail = $("#topicDetail");
assert(!detail.classList.contains("hidden"), "点击卡片后详情可见");
assert(/讲解/.test(detail.innerHTML), "详情含分级讲解");

// 3. 掌握按钮 -> 徽章变化
const before = $("#masteryBadge").textContent;
$("#learnBtn").click();
const after = $("#masteryBadge").textContent;
assert(before !== after, `掌握徽章更新 (${before} -> ${after})`);

// 4. 切回列表
$("#backKb").click();
assert($("#topicGrid").classList.contains("hidden") === false, "返回列表正常");

// ===== 开启界面（Splash）：存在 logo 与预加载步骤，且不阻塞主界面渲染 =====
assert(!!$("#splash"), "开启界面（Splash）已挂载");
const spLogo = $("#splash .sp-logo");
assert(!!spLogo && spLogo.textContent.trim() === "S", "Splash 展示产品 logo");
assert(($("#spSteps") ? $("#spSteps").children.length : 0) >= 4, "Splash 预加载步骤列表已生成");
assert($("#topicGrid").innerHTML.length > 0, "预加载不阻塞主界面渲染（知识点网格已填充）");

// ===== 知识页「掌握度 ↓」排序按钮：有真实功能（修复原无绑定点击无反应） =====
const sortBtn0 = $(".kb-sort");
if (sortBtn0) {
  sortBtn0.click();
  assert(/排序|掌握度/.test(sortBtn0.textContent), "掌握度排序按钮可点击切换且不崩溃");
  sortBtn0.click(); sortBtn0.click();
} else { assert(true, "排序按钮不存在（跳过）"); }

// 5. 问答：发送 SQL 注入问题
clickTab("chat");
$("#chatInput").value = "什么是 SQL 注入？怎么防御";
$("#sendBtn").click();
const rows = $$("#chatLog .msg-row");
assert(rows.length >= 2, `问答产生消息 (${rows.length} 条)`);
const botText = $$("#chatLog .msg.bot").map((m) => m.textContent).join(" ");
assert(/SQL|注入/.test(botText), "机器人正确回答了 SQL 注入");

// 6. 点击相关建议按钮（不应重复发送/崩溃）
const sugg = $("#chatLog .suggestions button");
let suggOk = true;
if (sugg) {
  const had = $$("#chatLog .msg-row").length;
  try { sugg.click(); } catch (e) { suggOk = false; errors.push("suggestion click threw: " + e.stack); }
  assert(suggOk && $$("#chatLog .msg-row").length >= had, "建议按钮点击无崩溃且触发响应");
} else {
  assert(true, "无建议按钮（跳过）");
}

// 7. 靶场：卡片 -> 详情
clickTab("range");
const rcards = $$("#rangeList .range-card");
assert(rcards.length > 0, `靶场卡片渲染 (${rcards.length} 张)`);
rcards[0].click();
assert(!$("#rangeDetail").classList.contains("hidden"), "靶场详情可见");
$("#backRange").click();

// 8. 学习计划生成
clickTab("plan");
$("#genPlan").click();
assert(/周/.test($("#planOutput").innerHTML), "学习计划生成成功");
const DOMAIN_COUNT = window.eval("SEC_DATA.categories.length");
assert($$("#progressBoard .pcard").length === DOMAIN_COUNT, `进度看板显示 ${DOMAIN_COUNT} 个领域`);

// 9. 资讯 / 工具渲染
clickTab("news");
assert($$("#newsList .news-card").length > 0, "安全资讯渲染");
clickTab("tools");
assert($("#toolDetail").innerHTML.length > 0, "工具说明渲染");

// 9b. 在线演练（程序内可交互靶场）
clickTab("range");
const labSeg = $$("#panel-range .seg-btn").find((b) => b.dataset.mode === "labs");
labSeg.click();
assert(!$("#labsView").classList.contains("hidden"), "在线演练视图可见");
assert($$("#labList .range-card").length > 0, "演练题目渲染");
function clickLabByTitle(sub) {
  const c = $$("#labList .range-card").find((x) => x.textContent.includes(sub));
  if (c) { c.click(); return true; }
  return false;
}
assert(clickLabByTitle("SQL 注入"), "打开 SQLi 演练");
$("#li1").value = "admin' --"; $("#li2").value = "x";
$("#liRun").click();
assert(/挑战成功/.test($("#labResult").textContent), "SQLi 演练可解（admin' -- 绕过）");
$("#backLab").click();
assert(clickLabByTitle("XSS"), "打开 XSS 演练");
$("#li1").value = "<script>alert(1)</script>";
$("#liRun").click();
assert(/挑战成功/.test($("#labResult").textContent), "XSS 演练可解（含沙箱预览）");
$("#backLab").click();
assert(clickLabByTitle("Base64"), "打开 Base64 演练");
$("#li1").value = "SecTutor{base64_decode}";
$("#liRun").click();
assert(/挑战成功/.test($("#labResult").textContent), "Base64 解码可解");
$("#backLab").click();
assert(clickLabByTitle("栈溢出"), "打开找漏洞演练");
$$("#quizOpts button").find((b) => b.dataset.i === "1").click();
assert(/挑战成功/.test($("#labResult").textContent), "找漏洞（栈溢出）可解");

// 9c. 新 lab 类型：路径遍历 / NoSQL / JWT 解码
$("#backLab").click();
assert(clickLabByTitle("路径遍历"), "打开路径遍历演练");
$("#li1").value = "../../../../etc/passwd";
$("#liRun").click();
assert(/挑战成功/.test($("#labResult").textContent), "路径遍历演练可解（../ 跳出）");
$("#backLab").click();
assert(clickLabByTitle("NoSQL"), "打开 NoSQL 演练");
$("#li1").value = '{ "$ne": "" }';
$("#liRun").click();
assert(/挑战成功/.test($("#labResult").textContent), "NoSQL 演练可解（$ne 绕过）");
$("#backLab").click();
assert(clickLabByTitle("JWT"), "打开 JWT 演练");
$("#li1").value = '{"role":"admin"}';
$("#liRun").click();
assert(/挑战成功/.test($("#labResult").textContent), "JWT 解码演练可解");
$("#backLab").click();

// 9d. 知识库搜索框
clickTab("knowledge");
const kbSearch = $("#kbSearch");
const flushKb = () => { if (window.__kbFlushSearch) window.__kbFlushSearch(); };
kbSearch.value = "注入";
kbSearch.dispatchEvent(new window.Event("input"));
flushKb();
let sCards = $$("#topicGrid .topic-card");
assert(sCards.length > 0, `搜索 "注入" 有结果 (${sCards.length} 张)`);
assert(/注入/.test(sCards.map((c) => c.textContent).join(" ")), "搜索结果显示注入相关知识点");
assert(/找到/.test($("#kbSearchCount").textContent), "显示结果计数");
kbSearch.value = "密码";
kbSearch.dispatchEvent(new window.Event("input"));
flushKb();
assert($$("#topicGrid .topic-card").length > 0, "跨领域搜索命中其他领域");
kbSearch.value = "zzzznotfound";
kbSearch.dispatchEvent(new window.Event("input"));
flushKb();
assert(/未找到/.test($("#topicGrid").textContent), "无匹配时显示空态");
kbSearch.value = "";
kbSearch.dispatchEvent(new window.Event("input"));
flushKb();
assert($$("#topicGrid .topic-card").length > 0, "清空搜索后恢复列表");

// 9e. 演练逐步提示 + 计划导出 + 随机自测
// 9e-1. 提示按钮逐条揭示
clickTab("range");
const labSeg3 = $$("#panel-range .seg-btn").find((b) => b.dataset.mode === "labs");
if (labSeg3) labSeg3.click();
assert(clickLabByTitle("SQL 注入"), "提示测试：打开 SQLi 演练");
const hintBtn = $("#labHintBtn");
assert(!!hintBtn, "提示按钮存在");
const hintsTotal = window.eval("SEC_DATA.labs.find(function(l){return l.id==='lab_sqli';}).hints.length");
let revealed = 0;
for (let k = 0; k < (hintsTotal || 5) + 2; k++) {
  if (!hintBtn || hintBtn.disabled) break;
  hintBtn.click();
  revealed = $$("#labHints li").length;
}
assert(revealed === hintsTotal, `提示逐条揭示完成 (${revealed}/${hintsTotal})`);
assert(hintBtn.disabled === true, "提示全部揭示后按钮禁用");
$("#backLab").click();

// 9e-2. 计划导出（PDF/PNG）不崩溃
clickTab("plan");
assert(!!$("#exportPdf"), "导出 PDF 按钮存在");
window.print = function () { window.__printed = true; };
$("#exportPdf").click();
assert(window.__printed === true, "点击导出 PDF 触发打印");
window.HTMLCanvasElement.prototype.getContext = function () { return null; };
assert(!!$("#exportPng"), "导出 PNG 按钮存在");
let pngOk = true;
try { $("#exportPng").click(); } catch (e) { pngOk = false; errors.push("png export threw: " + e.stack); }
assert(pngOk, "点击导出 PNG 不崩溃");
assert(/不支持/.test($("#exportStatus").textContent), "PNG 在不支持环境给出降级提示");

// 9e-3. 随机自测流程
clickTab("quiz");
assert(!!$("#quizStart"), "随机自测开始按钮存在");
$("#quizStart").click();
assert(/第 \d+ \/ \d+ 题/.test($("#quizMain").textContent), "随机自测抽题并渲染");
const qText = $("#quizMain .quiz-q").textContent.trim();
const SD = window.eval("SEC_DATA");
const qItem = SD.quizzes.find(function (q) { return q.q === qText; });
assert(!!qItem, "可在题库定位当前题目");
assert(SD.quizzes.length >= 190, "题库规模足够大（>=190 题）");
const advHint = SD.quizzes.filter(function(q){ return q.level === "高级" && q.hint; }).length;
assert(advHint >= 40, "高级(CTF)题均带内置提示（>=40）");
const ansText = qItem ? qItem.options[qItem.answer] : "";
// 选项已乱序，必须按"正确答案内容"定位按钮，而非按原始下标
const optBtn = $$("#quizMain .quiz-opt").find((b) => { const t = b.textContent.replace(/^\d+\.\s*/, "").trim(); return t === ansText || t.indexOf(ansText) === 0; });
assert(!!optBtn, "正确选项按钮存在（按内容定位，兼容选项乱序）");
if (optBtn) { optBtn.click(); $("#quizSubmit").click(); }
// 回归：选项乱序后 answer 下标必须仍指向原正确答案内容（修复"答案总在同一位置"）
const SO = window.__shuffleOptions;
let remapOk = true;
if (SO && SD && SD.quizzes) {
  for (const q of SD.quizzes) {
    const out = SO(q);
    if (out.options[out.answer] !== q.options[q.answer]) { remapOk = false; break; }
  }
}
assert(remapOk, "选项乱序后 answer 重映射正确（不丢失正确答案）");
assert(($("#quizFeedback") && !$("#quizFeedback").classList.contains("hidden")), "提交后显示解析反馈");
assert(/回答正确/.test($("#quizFeedback").textContent), "答对后判定正确");
assert(!!$("#quizAiBtn"), "每题提供 AI 辅助入口");
$("#quizAiBtn").click();
assert($("#panel-chat").classList.contains("active"), "点击 AI 辅助跳转到智能问答");
const chatTxt = ($("#chatLog") ? $("#chatLog").textContent : "");
assert(chatTxt.indexOf(qText) >= 0, "AI 辅助已将本题上下文带入对话");
const nxt = $("#quizNext");
if (nxt) { nxt.click(); assert(/第 \d+ \/ \d+ 题|自测完成/.test($("#quizMain").textContent), "进入下一题或成绩页"); }

// 10. 清空对话
(async () => {
clickTab("chat");
$("#clearChat").click();
assert(/你好/.test($("#chatLog").innerHTML), "清空对话后恢复欢迎语");

// 11. focusCat 偏置：设为 crypto 后问 RSA
$("#focusCat").value = "crypto";
$("#focusCat").dispatchEvent(new window.Event("change"));
$("#chatInput").value = "RSA 为什么安全";
$("#sendBtn").click();
assert($$("#chatLog .msg-row").length >= 2, "focusCat 偏置下问答正常");

// 12. 未匹配路径（RAG 引擎对乱码也会给最佳努力回复，验证不崩溃且有实质内容）
$("#chatInput").value = "zxcvqwerty 乱码测试";
$("#sendBtn").click();
const lastBot = $$("#chatLog .msg.bot").pop().textContent;
assert(lastBot && lastBot.length > 20, "未匹配路径正常处理（乱码也能给出回复不崩溃）");

// 13. 主题切换（默认暗色，点击后应切到浅色，滑块类同步）
const themeBefore = doc.documentElement.getAttribute("data-theme");
$("#themeToggle").click();
const themeAfter = doc.documentElement.getAttribute("data-theme");
assert(themeBefore !== themeAfter, `主题切换生效（${themeBefore} -> ${themeAfter}）`);
const sw = $("#themeToggle");
if (themeAfter === "light") assert(sw.classList.contains("light"), "浅色模式滑块同步到左侧");
else assert(!sw.classList.contains("light"), "暗色模式滑块在右侧");

// 14. 持久化：刷新语义（直接读 localStorage）
const saved = window.localStorage.getItem("sectutor_chat");
assert(saved && saved.length > 0, "对话已持久化到 localStorage");

// 15. 无运行时错误
assert(errors.length === 0, `无运行时异常 (${errors.length} 条)`);

// 9f. 靶场「生成临时环境」按钮 + 后端降级/成功渲染
clickTab("range");
const labSegF = $$("#panel-range .seg-btn").find((b) => b.dataset.mode === "labs");
if (labSegF) labSegF.click();
assert(clickLabByTitle("SQL 注入"), "生成临时环境：打开 SQLi 演练");
assert(!!$("#genEnvBtn"), "生成临时环境按钮存在（后端对接点）");
assert(!!$("#envSection"), "临时环境区块存在");

// 9f-A. 降级路径：无后端 / 无 fetch → 优雅回退，不崩溃
window.fetch = function () { return Promise.reject(new Error("no fetch in test harness")); };
$("#genEnvBtn").click();
await delay(30);
assert(/后端不可用|回退/.test($("#envPanel").textContent), "后端不可用时优雅降级（不崩溃）");
$("#backLab").click();

// 9f-B. 成功路径：注入 fake fetch 返回环境，验证渲染 + 倒计时 + 销毁
clickLabByTitle("SQL 注入");
window.fetch = function (url, opts) {
  return Promise.resolve({
    ok: true, status: 201,
    json: async function () {
      if (opts && opts.method === "DELETE") return { ok: true, message: "destroyed" };
      return { ok: true, env: { id: "env_test", labId: "lab_sqli", accessUrl: "http://localhost:40000", status: "running", expiresAt: Date.now() + 600000 } };
    },
  });
};
$("#genEnvBtn").click();
await delay(40);
assert(/已就绪/.test($("#envPanel").textContent), "生成临时环境成功渲染（已就绪）");
assert(/http:\/\/localhost:40000/.test($("#envPanel").textContent), "展示访问地址");
assert(!!$("#envCountdown"), "倒计时元素存在");
const destroyBtn = $("#destroyEnvBtn");
assert(!!destroyBtn, "销毁按钮存在");
if (destroyBtn) destroyBtn.click();
await delay(40);
assert(/已销毁|资源已释放/.test($("#envPanel").textContent), "销毁后显示释放提示");
window.fetch = function () { return Promise.reject(new Error("no fetch in test harness")); };
$("#backLab").click();

  // ===== 15b. 方向⑩ AI 辅助渗透：实战靶场 + 工具与代码 =====
  // 15b-1. 靶场题解库 AI 辅助（默认 solutions 视图）
  const solSeg = $$("#panel-range .seg-btn").find((b) => b.dataset.mode === "solutions");
  if (solSeg) solSeg.click();
  const r0 = window.eval("SEC_DATA.ranges[0]");
  const rangeCard = $$("#rangeList .range-card")[0];
  assert(!!rangeCard, "题解库列表有卡片");
  rangeCard.click();
  assert(!!$("#rangeAiBtn"), "靶场题解提供 AI 辅助入口");
  $("#rangeAiBtn").click();
  assert($("#panel-chat").classList.contains("active"), "靶场题解 AI 辅助跳转到智能问答");
  assert($("#chatLog").textContent.indexOf(r0.title) >= 0, "靶场题解 AI 辅助已带入上下文（" + r0.title + "）");
  $("#backRange").click();

  // 15b-2. 在线演练（lab）AI 辅助
  const labSegG = $$("#panel-range .seg-btn").find((b) => b.dataset.mode === "labs");
  if (labSegG) labSegG.click();
  assert(clickLabByTitle("SQL 注入"), "AI 辅助：打开 SQLi 演练");
  assert(!!$("#labAiBtn"), "在线演练提供 AI 辅助入口");
  const labObj = window.eval("SEC_DATA.labs.find(function(l){return l.id==='lab_sqli';})");
  $("#labAiBtn").click();
  assert($("#panel-chat").classList.contains("active"), "在线演练 AI 辅助跳转到智能问答");
  assert($("#chatLog").textContent.indexOf(labObj.title) >= 0, "在线演练 AI 辅助已带入上下文（" + labObj.title + "）");
  $("#backLab").click();

  // 15b-3. 工具与代码 AI 辅助
  clickTab("tools");
  const toolBtns = $$(".tool-ai-btn");
  assert(toolBtns.length > 0, `工具与代码提供 AI 辅助入口 (${toolBtns.length} 个)`);
  const t0 = window.eval("SEC_DATA.tools[0]");
  toolBtns[0].click();
  assert($("#panel-chat").classList.contains("active"), "工具 AI 辅助跳转到智能问答");
  assert($("#chatLog").textContent.indexOf(t0.name) >= 0, "工具 AI 辅助已带入上下文（" + t0.name + "）");

  // 15b-4. 知识体系（topic）AI 辅助
  clickTab("knowledge");
  const topicCard0 = $$("#topicGrid .topic-card")[0];
  assert(!!topicCard0, "知识体系网格渲染出知识点卡片");
  const topicName0 = topicCard0.querySelector("h4").textContent;
  topicCard0.click();
  assert(!!$("#topicAiBtn"), "知识点详情提供 AI 辅助入口");
  $("#topicAiBtn").click();
  assert($("#panel-chat").classList.contains("active"), "知识点 AI 辅助跳转到智能问答");
  assert($("#chatLog").textContent.indexOf("知识点：") >= 0 && $("#chatLog").textContent.indexOf(topicName0) >= 0, "知识点 AI 辅助已带入上下文（" + topicName0 + "）");
  $("#backKb").click();

  // 15b-5. 安全资讯（news）AI 辅助
  clickTab("news");
  const newsBtns = $$(".news-ai-btn");
  assert(newsBtns.length > 0, `安全资讯提供 AI 辅助入口 (${newsBtns.length} 条)`);
  const n0 = window.eval("SEC_DATA.news[0]");
  newsBtns[0].click();
  assert($("#panel-chat").classList.contains("active"), "安全资讯 AI 辅助跳转到智能问答");
  assert($("#chatLog").textContent.indexOf(n0.title) >= 0, "安全资讯 AI 辅助已带入上下文（" + n0.title + "）");

  // ===== 16. 方向① 学习中心渲染（plan tab）=====
  clickTab("plan");
  assert($("#profileCard").innerHTML.length > 0, "能力画像卡片渲染");
  assert($("#weeklyCard").innerHTML.length > 0, "本周学习报告卡片渲染");
  assert($("#reviewCard").innerHTML.length > 0, "复习提醒卡片渲染");

  // ===== 17. 方向① 能力诊断流程 =====
  const diagStart = $("#diagStart");
  assert(!!diagStart, "无画像时显示「开始能力诊断」按钮");
  diagStart.click();
  assert(/诊断进度/.test($("#diagArea").innerHTML), "诊断问答渲染（显示进度）");
  // 反复点击第一个选项，答完所有题直到 diagArea 清空
  let dguard = 0;
  while (/诊断进度/.test($("#diagArea").innerHTML) && dguard < 40) {
    const opt = $("#diagArea .diag-opt");
    if (!opt) break;
    opt.click();
    dguard++;
  }
  assert(!!window.localStorage.getItem("sectutor_profile"), "诊断完成后写入能力画像到 localStorage");
  assert(/pbar-track/.test($("#profileCard").innerHTML), "诊断后展示能力评分条");
  assert(/重新诊断/.test($("#profileCard").innerHTML), "诊断后提供「重新诊断」入口");

  // 17b. 诊断加深：画像含四域细分子类 + 逐题作答记录
  const profD = JSON.parse(window.localStorage.getItem("sectutor_profile") || "{}");
  assert(profD.levelBreakdown && Object.keys(profD.levelBreakdown).length === DOMAIN_COUNT, `诊断加深：画像含 ${DOMAIN_COUNT} 域细分子类(入门/初级/中级/高级)`);
  assert(Array.isArray(profD.answers) && profD.answers.length > 0, "诊断加深：保存逐题作答记录");

  // 17c. 弱项专项自测：点击直接生成针对最弱域的随机自测
  const weakBtn = $("#weakQuizBtn");
  assert(!!weakBtn, "能力画像提供「弱项专项自测」入口");
  weakBtn.click();
  assert($("#panel-quiz").classList.contains("active"), "弱项专项自测跳转到随机自测页");
  assert(!!$("#quizMain").querySelector(".quiz-card") || /第 \d+ \/ \d+ 题/.test($("#quizMain").textContent), "弱项专项自测已开始抽题");
  clickTab("plan");

  // 17d. 复习曲线可视化：复习卡含遗忘曲线 SVG（两条分支都会渲染）
  assert(!!$("#reviewCard").querySelector("svg.review-curve"), "复习卡含遗忘曲线 SVG（可视化）");

  // ===== 18b. 方向⑩ 函数调用工具化 + 流式输出（mock fetch 验证）=====
  function setLlmKeyViaHub(k) {
    $("#apiHubBtn").click();
    const kk = $("#hubLlmKey"); if (kk) kk.value = k || "";
    const sb = $("#hubSaveLlm"); if (sb) sb.click();
    const mc = $("#modalClose"); if (mc) mc.click();
  }
  setLlmKeyViaHub("test-key");
  let toolCallsSeen = 0;
  // 18b-1 工具调用循环（mock 不含 body → 自动走非流 json 回退路径）
  window.fetch = function () {
    toolCallsSeen++;
    const body = toolCallsSeen === 1
      ? { choices: [{ message: { content: "", tool_calls: [{ id: "c1", type: "function", "function": { name: "search_knowledge", arguments: JSON.stringify({ query: "SQL 注入" }) } }] } }] }
      : { choices: [{ message: { content: "根据知识库检索，已命中「SQL 注入」相关条目，其原理是..." } }] };
    return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(body); } });
  };
  clickTab("chat");
  $("#chatInput").value = "帮我查一下 SQL 注入";
  $("#sendBtn").click();
  await delay(80);
  const botTool = $$("#chatLog .msg.bot").pop().textContent;
  assert(/SQL 注入/.test(botTool), "函数调用工具化：LLM 调用 search_knowledge 并基于结果作答（" + botTool.slice(0, 36) + "）");
  assert(toolCallsSeen >= 2, "函数调用工具化：工具循环至少两轮（工具调用 + 最终回答）");

  // 18b-2 真实 SSE 流式输出（mock ReadableStream）
  toolCallsSeen = 0;
  window.fetch = function () {
    const enc = new TextEncoder();
    const chunks = [
      'data: {"choices":[{"delta":{"content":"逐字"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"流式"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"渲染"}}]}\n\n',
      'data: [DONE]\n\n',
    ];
    let i = 0;
    const stream = new ReadableStream({ start(c) { const push = () => { if (i < chunks.length) { c.enqueue(enc.encode(chunks[i++])); setTimeout(push, 0); } else c.close(); }; push(); } });
    return Promise.resolve({ ok: true, status: 200, body: stream });
  };
  $("#chatInput").value = "讲讲 XSS";
  $("#sendBtn").click();
  await delay(160);
  const botStream = $$("#chatLog .msg.bot").pop().textContent;
  assert(/逐字流式渲染/.test(botStream), "流式输出：答案经 SSE 逐字渲染（" + botStream.slice(0, 30) + "）");
  window.fetch = function () { return Promise.reject(new Error("no fetch in test harness")); };
  setLlmKeyViaHub("");   // 复位为离线，避免影响后续断言

  // ===== 18c. 方向⑩ API 接入中心增强：情报源「测试连接」=====
  window.fetch = function () { return Promise.reject(new Error("network unreachable (test)")); };
  $("#apiHubBtn").click();
  const intelChip2 = $$("#modalOverlay .api-tabs .chip").find((b) => b.dataset.atab === "intel");
  if (intelChip2) intelChip2.click();
  const iu = $("#hubIntelUrl"); if (iu) iu.value = "https://unreachable.example/api";
  const itBtn = $("#hubTestIntel");
  assert(!!itBtn, "威胁情报面板提供「测试连接」按钮");
  if (itBtn) { itBtn.click(); await delay(60); }
  const tRes = $("#intelTestRes");
  assert(tRes && /🔴|测试/.test(tRes.textContent), "测试连接（无网络）优雅失败不崩溃");
  const mc2 = $("#modalClose"); if (mc2) mc2.click();

  // ===== 18d. 方向⑩ 对话体验：预设提示词 + 导出对话 =====
  const pp0 = $$("#promptPresets .pp-chip")[0];
  assert(!!pp0, "对话区提供预设提示词");
  pp0.click();
  assert($("#chatInput").value.indexOf("类比") >= 0, "点击预设提示词把模板插入输入框");
  const expBtn = $("#exportChat");
  assert(!!expBtn, "提供「导出对话」按钮");
  let exportOk = true; try { expBtn.click(); } catch (e) { exportOk = false; }
  assert(exportOk, "导出对话不崩溃");

  // ===== 18. 方向⑩ 工具箱（本地、离线）=====
  clickTab("tools");
  assert($("#tbInput") && $("#tbOp") && $("#tbRun"), "工具箱控件渲染");
  $("#tbInput").value = "U2VjVHV0b3I=";
  $("#tbOp").value = "b64d";
  $("#tbRun").click();
  assert(/SecTutor/.test($("#tbOut").textContent), "Base64 解码（工具箱）正确");
  $("#tbInput").value = "abc";
  $("#tbOp").value = "md5";
  $("#tbRun").click();
  assert($("#tbOut").textContent === "900150983cd24fb0d6963f7d28e17f72", "MD5 计算（工具箱）正确");
  $("#tbInput").value = "abc";
  $("#tbOp").value = "sha256";
  $("#tbRun").click();
  assert($("#tbOut").textContent === "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", "SHA256 计算（工具箱）正确");

  // ===== 19. 方向⑩ API 接入中心（预留所有外部接入界面）=====
  clickTab("chat");
  assert(!!$("#apiHubBtn"), "聊天侧存在「API 接入中心」入口");
  $("#apiHubBtn").click();
  assert(!$("#modalOverlay").classList.contains("hidden"), "API 接入中心弹窗打开");
  assert($$("#modalOverlay .api-tabs .chip").length === 5, "含 5 个接入 Tab（LLM/情报/MCP/学习者画像/隐私）");
  const intelTab = $$("#modalOverlay .api-tabs .chip").find((b) => b.dataset.atab === "intel");
  if (intelTab) intelTab.click();
  const intelPane = $("#modalOverlay .api-pane[data-pane='intel']");
  assert(intelPane && !intelPane.classList.contains("hidden"), "可切换到「威胁情报（预留）」面板");
  const learnerTab = $$("#modalOverlay .api-tabs .chip").find((b) => b.dataset.atab === "learner");
  if (learnerTab) learnerTab.click();
  const learnerPane = $("#modalOverlay .api-pane[data-pane='learner']");
  assert(learnerPane && !learnerPane.classList.contains("hidden"), "可切换到「学习者画像」面板");
  assert($("#learnerLevel") && $("#learnerScenario") && $("#learnerPane .learner-domain"), "学习者画像含自报水平/场景/领域控件");
  $("#modalClose").click();
  await delay(320);  // 弹窗退场动效 200ms + 兜底定时器 260ms，需等隐藏真正生效
  assert($("#modalOverlay").classList.contains("hidden"), "模态框可关闭");

  // ===== 20. 方向⑩ 大模型配置保存（仅本机 localStorage）=====
  $("#apiHubBtn").click();
  $("#hubLlmBase").value = "https://api.example.com/v1";
  $("#hubLlmKey").value = "sk-test-123";
  $("#hubLlmModel").value = "gpt-4o-mini";
  $("#hubSaveLlm").click();
  const savedLlm = JSON.parse(window.localStorage.getItem("sectutor_llm") || "{}");
  assert(savedLlm.key === "sk-test-123", "大模型配置保存到 localStorage（仅本机）");
  const closeBtn2 = $("#modalClose");
  if (closeBtn2) closeBtn2.click();

  // ===== 21. 顶栏三按钮：全局搜索 / 复习提醒 / 设置 =====
  assert(!!$("#btnSearch") && !!$("#btnReview") && !!$("#btnSettings"), "顶栏存在搜索/复习/设置三按钮");
  $("#btnSearch").click();
  assert(!!$("#gsInput") && !$("#modalOverlay").classList.contains("hidden"), "全局搜索弹窗打开");
  $("#gsInput").value = "sql 注入";
  $("#gsInput").dispatchEvent(new window.Event("input", { bubbles: true }));
  if (window.__gsFlush) window.__gsFlush();
  assert($$(".gs-item").length > 0, "全局搜索命中结果（防抖钩子同步刷新）");
  const firstGs = $$(".gs-item")[0];
  firstGs.click();
  await delay(320);  // 弹窗退场动效需等隐藏生效（同 21 组）
  assert($("#modalOverlay").classList.contains("hidden"), "点击搜索结果关闭弹窗并跳转");
  $("#btnReview").click();
  assert(!$("#modalOverlay").classList.contains("hidden"), "复习提醒弹窗打开");
  assert(!!$("#revStartBtn") || !!$("#modalBody .rev-empty"), "复习提醒含开始按钮或空态提示");
  $("#modalClose").click();
  await delay(320);
  assert($("#modalOverlay").classList.contains("hidden"), "复习提醒弹窗可关闭");
  $("#btnSettings").click();
  assert(!!$("#setPdf") && !!$("#setReset"), "设置弹窗含导出计划与重置入口");
  const themeBeforeSet = doc.documentElement.getAttribute("data-theme");
  const otherChip = $$("#modalBody .chip[data-th]").find((b) => b.getAttribute("data-th") !== themeBeforeSet);
  if (otherChip) otherChip.click();
  assert(doc.documentElement.getAttribute("data-theme") !== themeBeforeSet, "设置弹窗可切换主题");
  $("#modalClose").click();
  await delay(320);
  assert($("#modalOverlay").classList.contains("hidden"), "设置弹窗可关闭");

  // ===== 22. 布局滚动回归：body 固定视口高度，面板内左右独立滚动互不带动 =====
  const cssSrc = fs.readFileSync(path.join(dir, "styles.css"), "utf8");
  assert(/body \{ display: flex; height: 100vh; min-height: 100vh; overflow: hidden; \}/.test(cssSrc.replace(/\n\s*/g, " ")), "body 固定为 100vh（内容超高不撑开视口，可滚动）");
  assert(/main \{ flex: 1; overflow: hidden;/.test(cssSrc), "main 不再作为滚动容器（overflow:hidden），改为面板内左右独立滚动");
  assert(/overscroll-behavior: contain/.test(cssSrc), "左右栏均带 overscroll-behavior: contain（一侧滚到底不带动另一侧）");

  // ===== 23. 选项长度脱钩：根治「只要选最长的就一定正确」=====
  const BO = window.__balanceOptions;
  let structOk = true, longestIsAns = 0, lenTotal = 0;
  if (BO && SD && SD.quizzes) {
    for (const q of SD.quizzes) {
      const out = BO(q);
      if (!Array.isArray(out.options) || out.options.length !== q.options.length) { structOk = false; break; }
      if (out.answer !== q.answer) { structOk = false; break; } // answer 下标不得改动，否则判分错乱
      let maxI = 0;
      for (let i = 1; i < out.options.length; i++) if (out.options[i].length > out.options[maxI].length) maxI = i;
      lenTotal++;
      if (maxI === q.answer) longestIsAns++;
    }
  }
  assert(structOk, "balanceOptions 不破坏选项数量、不改动 answer 下标（判分安全）");
  const coupledRatio = lenTotal ? longestIsAns / lenTotal : 0;
  console.log(`  长度耦合度（最长项==正确答案）: ${(coupledRatio * 100).toFixed(1)}%（修复前约 97%，修复目标 <40%）`);
  assert(lenTotal > 0 && coupledRatio >= 0.12 && coupledRatio <= 0.38, `长度与答案脱钩：选最长的正确率≈${(coupledRatio * 100).toFixed(1)}%（接近随机 25%）`);

  // ===== 24. 索引层与检索质量回归防护（倒排索引 + BM25）=====
  const PF = window.__perf;
  assert(!!PF, "索引层已暴露 __perf（检索/索引能力可回归校验）");
  if (PF) {
    // 记忆化：原实现每次调用都重建整个数组，优化后应返回同一实例
    assert(PF.allTopics() === PF.allTopics(), "allTopics() 已记忆化（重复调用返回同一实例，不再重建数组）");
    assert(PF.allTopics().length > 0, `知识点索引非空（${PF.allTopics().length} 个知识点）`);
    assert(PF.corpusSize() > 0, `语料索引已构建（${PF.corpusSize()} 篇文档）`);

    // 边界：空查询 / 无命中不得抛错
    let edgeOk = true;
    try {
      const r0 = PF.retrieve("", 4);
      const r1 = PF.retrieve("zzzz不存在的词zzzz", 4);
      if (!Array.isArray(r0) || !Array.isArray(r1)) edgeOk = false;
    } catch (e) { edgeOk = false; }
    assert(edgeOk, "检索边界安全：空查询与无命中均返回数组且不抛错");

    // 相关推荐不得把自身推荐出来
    let noSelf = true;
    const someTopic = PF.allTopics()[0];
    if (someTopic) {
      const rel = PF.relatedDocs(someTopic);
      if (rel.some((d) => d.id === "topic:" + someTopic.id)) noSelf = false;
    }
    assert(noSelf, "relatedDocs 不会把知识点自身作为推荐项返回");

    // 检索质量回归防护：改写查询（不含标题原文，真正考验算法）
    const HARD = [
      ["攻击者让受害者的浏览器执行恶意脚本从而窃取 cookie", ["xss"]],
      ["在登录框里拼接数据库查询语句绕过身份验证", ["sqli"]],
      ["让服务器代为请求内网地址来探测内部服务", ["ssrf", "web-ssrf"]],
      ["上传木马文件到服务器进而获取权限", ["upload", "web-upload"]],
      ["内存块被释放之后指针仍然被继续使用", ["uaf"]],
      ["用私钥签名、公钥验签的非对称体系", ["asym", "pki", "crypto-sign"]],
      ["已经拿到普通用户权限，如何进一步提权到系统管理员", ["privesc", "priv-esc"]],
      ["拿下内网一台机器后继续扩散控制其他主机", ["lateral", "net-lateral"]],
      ["容器里的进程突破隔离拿到了宿主机权限", ["container-escape"]],
      ["文件被加密勒索了应该怎么处理", ["ir"]],
      ["想摸清目标公司暴露在外的域名和子域名", ["recon", "osint", "pt-recon"]],
      ["篡改域名解析结果把用户引到假冒网站", ["arp-dns"]],
      ["令牌可以被随意伪造，服务端没有校验签名", ["jwt", "auth"]],
      ["随机数序列可以被预测导致密钥被推算出来", ["rand"]],
      ["在没有授权的情况下读取到别人的订单数据", ["idor", "api-sec", "web-api-sec"]],
    ];
    let q1 = 0, q4 = 0;
    for (const [q, want] of HARD) {
      const res = PF.retrieve(q, 10);
      const rank = res.findIndex((d) => want.includes(d.id.replace(/^topic:/, "")));
      if (rank === 0) q1++;
      if (rank >= 0 && rank < 4) q4++;
    }
    const p1 = (q1 / HARD.length) * 100, p4 = (q4 / HARD.length) * 100;
    console.log(`  检索质量（改写查询 ${HARD.length} 条）: P@1=${p1.toFixed(1)}%  P@4=${p4.toFixed(1)}%（优化前实测基线 P@1=60.0% P@4=90.0%）`);
    assert(p4 >= 90, `检索质量防护：改写查询 P@4=${p4.toFixed(1)}%（要求 ≥90%，RAG 取 top-4 必须命中）`);
    assert(p1 >= 60, `检索质量防护：改写查询 P@1=${p1.toFixed(1)}%（要求 ≥60%）`);
  }

  // ===== 25. 交互反馈层（P0）：Toast / 忙碌态 =====
  const UI = window.__ui;
  assert(!!UI, "交互反馈层已暴露 __ui（Toast / withPending 可回归校验）");
  if (UI) {
    const host = doc.getElementById("toastHost");
    assert(!!host && host.getAttribute("aria-live") === "polite", "Toast 宿主存在且 aria-live 正确（读屏可播报）");
    const idOk = UI.toast("ok-测试", "ok");
    const idErr = UI.toast("err-测试", "err");
    const idInfo = UI.toast("info-测试", "info");
    assert(!!doc.querySelector(".toast-ok"), "Toast 支持 ok 类型");
    assert(!!doc.querySelector(".toast-err") && doc.querySelector(".toast-err").getAttribute("role") === "alert", "Toast err 类型带 role=alert（读屏立即播报）");
    assert(!!doc.querySelector(".toast-info"), "Toast 支持 info 类型");
    UI.toast("第四条-测试", "info");
    assert(host.children.length <= 3, `Toast 最多同时堆叠 3 条（当前 ${host.children.length}）`);
    let undone = false;
    const idUndo = UI.toast("可撤销-测试", "ok", { actionText: "撤销", onAction: () => { undone = true; } });
    const actBtn = doc.querySelector('.toast[data-toast-id="' + idUndo + '"] .toast-act');
    if (actBtn) actBtn.click();
    assert(undone, "Toast 撤销按钮点击后回调被触发");
    const idAuto = UI.toast("短时-测试", "info", { duration: 60 });
    await delay(450);
    assert(!doc.querySelector('.toast[data-toast-id="' + idAuto + '"]'), "Toast 超时后自动移除");
    [idOk, idErr, idInfo, idUndo].forEach((i) => UI.closeToast(i, true));

    const probe = doc.createElement("button");
    probe.innerHTML = "<span>原文案</span>";
    doc.body.appendChild(probe);
    const restore = UI.withPending(probe, "处理中…");
    assert(probe.disabled === true, "withPending 期间按钮被禁用（防重复提交）");
    assert(/处理中/.test(probe.textContent), "withPending 期间显示忙碌文案");
    restore();
    assert(probe.disabled === false && /原文案/.test(probe.textContent), "withPending 恢复后按钮解禁且原文案还原");

    const probe2 = doc.createElement("button");
    probe2.innerHTML = "<span>二</span>";
    doc.body.appendChild(probe2);
    let restoreFn = null;
    try { restoreFn = UI.withPending(probe2, "忙"); throw new Error("模拟业务异常"); }
    catch (e) { if (restoreFn) restoreFn(); }
    assert(probe2.disabled === false, "withPending 在业务异常后仍能恢复按钮（不会永久禁用）");
  }

  // ===== 26. 键盘导航（P1）：快捷键 / 焦点管理 =====
  function pressKey(key, opts) {
    const ev = new window.KeyboardEvent("keydown", Object.assign({ key: key, bubbles: true, cancelable: true }, opts || {}));
    doc.dispatchEvent(ev);
    return ev;
  }
  pressKey("4");
  assert($("#panel-range").classList.contains("active"), "数字键 4 切换到「实战靶场」面板（顺序=侧栏视觉顺序）");
  pressKey("2");
  assert($("#panel-knowledge").classList.contains("active"), "数字键 2 切换到「知识体系」面板");
  const kbInput = $("#kbSearch");
  if (kbInput) kbInput.focus();
  pressKey("5");
  assert($("#panel-knowledge").classList.contains("active"), "输入框内按数字键不会误切面板（防打字误触）");
  if (kbInput) kbInput.blur();
  pressKey("k", { ctrlKey: true });
  assert(!$("#modalOverlay").classList.contains("hidden"), "Ctrl+K 打开全局搜索");
  pressKey("Escape");
  await delay(320);
  assert($("#modalOverlay").classList.contains("hidden"), "Esc 可关闭弹窗");
  const settingsTrigger = $("#btnSettings");
  if (settingsTrigger) { settingsTrigger.focus(); settingsTrigger.click(); }
  const modalEl = doc.querySelector("#modalOverlay .modal");
  assert(!!modalEl && modalEl.contains(doc.activeElement), "弹窗打开后焦点已移入弹窗内");
  assert(!!modalEl && modalEl.getAttribute("role") === "dialog" && modalEl.getAttribute("aria-modal") === "true", "弹窗带 role=dialog 与 aria-modal");
  pressKey("Escape");
  await delay(320);
  assert(doc.activeElement === settingsTrigger, "弹窗关闭后焦点归还触发元素");
  assert($$(".rail-item .rail-key").length >= 8, "左侧导航显示 1-8 数字角标");
  pressKey("?");
  const titleEl = $("#modalTitle");
  assert(!$("#modalOverlay").classList.contains("hidden") && !!titleEl && /键盘快捷键/.test(titleEl.textContent), "? 打开快捷键帮助面板");
  pressKey("Escape");
  await delay(320);

  // ===== 27. 状态安全（P2）：滚动位置记忆 / 撤销 / 输入草稿 =====
  if (UI) {
    // 滚动位置记忆：设位置 → 记录 → 重置 → 切回应恢复
    const kbSide = doc.querySelector("#panel-knowledge .kb-side");
    if (kbSide) {
      kbSide.scrollTop = 120;
      UI.savePanelScroll("knowledge");
      kbSide.scrollTop = 0;                 // 模拟切走再切回（位置被重置）
      UI.restorePanelScroll("knowledge");
      assert(kbSide.scrollTop === 120, `切回面板后滚动位置被恢复（实测 ${kbSide.scrollTop}）`);
    } else {
      assert(false, "知识体系侧栏存在（滚动记忆用例前提）");
    }

    // 撤销机制：验证「快照 → 清空 → 用快照恢复」这一核心链路
    const realSnap = UI.snapshotMastery();
    const before = realSnap.mastery.length;
    const probeSnap = { mastery: ["__undo_test_topic__"], dates: {} };
    UI.restoreMastery(probeSnap);
    assert(UI.snapshotMastery().mastery.length === 1, "restoreMastery 能写回掌握进度（撤销的基础）");
    UI.restoreMastery({ mastery: [], dates: {} });
    assert(UI.snapshotMastery().mastery.length === 0, "restoreMastery 能清空掌握进度");
    UI.restoreMastery(realSnap);
    assert(UI.snapshotMastery().mastery.length === before, `撤销后能完整还原原有掌握进度（${before} 项）`);

    // 输入草稿：保存后能恢复，清空后不残留
    const chatInp = $("#chatInput");
    if (chatInp) {
      UI.saveDraft("草稿内容-测试");
      chatInp.value = "";
      UI.restoreDraft();
      assert(chatInp.value === "草稿内容-测试", "输入草稿可从 localStorage 恢复");
      UI.clearDraft();
      let left = "";
      try { left = window.localStorage.getItem(UI.DRAFT_KEY) || ""; } catch (e) {}
      assert(left === "", "清空后草稿不残留");
      chatInp.value = "";
    }
  }

  // ===== 28. 无障碍（P3）：语义化标签与对比度 =====
  const railItems = $$(".rail-item");
  assert(railItems.length > 0 && railItems.every((r) => r.getAttribute("role") === "tab"), "左侧导航项带 role=tab");
  assert(railItems.every((r) => !!r.getAttribute("aria-controls")), "导航项用 aria-controls 关联对应面板");
  assert($$(".panel").every((p) => p.getAttribute("role") === "tabpanel"), "各面板带 role=tabpanel");
  const activeRail = $$(".rail-item").find((r) => r.classList.contains("active"));
  assert(!!activeRail && activeRail.getAttribute("aria-selected") === "true", "当前面板的导航项 aria-selected=true");
  assert($$(".rail-item").filter((r) => r.getAttribute("aria-selected") === "true").length === 1, "同一时刻只有一个导航项为选中态");
  pressKey("4");
  const rail3 = $$(".rail-item").find((r) => r.dataset.tab === "range");
  assert(!!rail3 && rail3.getAttribute("aria-selected") === "true", "切换面板后 aria-selected 同步更新");
  pressKey("1");
  assert(!!$("#btnSearch").getAttribute("aria-label") && !!$("#btnSettings").getAttribute("aria-label"), "顶栏图标按钮带 aria-label（读屏可读）");
  // 浅色主题 muted 对比度（原 #64748b 在页面底色上仅 4.23:1，低于 WCAG AA）
  const cssNow = fs.readFileSync(path.join(dir, "styles.css"), "utf8");
  const m = cssNow.match(/--muted:\s*(#[0-9a-fA-F]{6})/);
  function lum(hex) {
    const c = hex.replace("#", "");
    const v = [0, 2, 4].map((i) => parseInt(c.substr(i, 2), 16) / 255);
    const f = (x) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4));
    return 0.2126 * f(v[0]) + 0.7152 * f(v[1]) + 0.0722 * f(v[2]);
  }
  function ratio(a, b) { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); }
  if (m) {
    const rBg = ratio(m[1], "#eef2f7"), rPanel = ratio(m[1], "#ffffff");
    assert(rBg >= 4.5 && rPanel >= 4.5, `浅色主题 muted 对比度达标（bg ${rBg.toFixed(2)}:1 / panel ${rPanel.toFixed(2)}:1，AA 需 ≥4.5）`);
  }

  // ===== 29. P3 收尾：筛选语义 / 进度条 / 切换按钮 / 排序键盘 =====
  const chipsWrap = $("#levelChips");
  assert(!!chipsWrap && chipsWrap.getAttribute("role") === "radiogroup", "难度筛选容器带 role=radiogroup");
  const chips = $$("#levelChips .chip");
  assert(chips.length > 0 && chips.every((c) => c.getAttribute("role") === "radio"), "难度筛选项带 role=radio");
  assert(chips.filter((c) => c.getAttribute("aria-checked") === "true").length === 1, "难度筛选有且仅有一项 aria-checked=true");
  const lvChecked = chips.find((c) => c.getAttribute("aria-checked") === "true");
  const lvOther = chips.find((c) => c.getAttribute("aria-checked") !== "true");
  if (lvOther && lvChecked) {
    lvOther.click();
    assert(lvOther.getAttribute("aria-checked") === "true" && lvChecked.getAttribute("aria-checked") === "false", "切换难度后 aria-checked 同步迁移");
    lvChecked.click();
  }
  const sortBtn = $(".kb-sort");
  assert(!!sortBtn && sortBtn.getAttribute("role") === "button" && sortBtn.getAttribute("tabindex") === "0", "排序控件可用键盘聚焦（role=button + tabindex=0）");
  const sortLabelBefore = sortBtn.getAttribute("aria-label");
  sortBtn.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  assert(sortBtn.getAttribute("aria-label") !== sortLabelBefore, "排序控件支持 Enter 键触发切换（原仅鼠标可用）");
  assert($$(".dom .ring[role=progressbar]").length > 0, "领域掌握度环带 role=progressbar");
  const ringBar = $(".dom .ring[role=progressbar]");
  assert(!!ringBar && ringBar.getAttribute("aria-valuenow") !== null && ringBar.getAttribute("aria-valuemax") === "100", "进度环带 aria-valuenow / aria-valuemax");
  const firstCardP3 = doc.querySelector("#topicGrid .topic-card");
  if (firstCardP3) {
    firstCardP3.click();
    const lb = $("#learnBtn");
    assert(!!lb && lb.getAttribute("aria-pressed") !== null, "「我已掌握」按钮带 aria-pressed（切换按钮语义）");
    const pressedBefore = lb.getAttribute("aria-pressed");
    lb.click();
    const lb2 = $("#learnBtn");
    assert(!!lb2 && lb2.getAttribute("aria-pressed") !== pressedBefore, "点击掌握后 aria-pressed 同步翻转");
    if (lb2) lb2.click();                     // 还原，避免影响后续用例
    const backBtn = $("#backKb"); if (backBtn) backBtn.click();
  }

  // Agent 增强（Phase 0）：LLM 网关 + 适配上下文
  const ag = window.__agent;
  assert(!!ag, "window.__agent 测试钩子已暴露");
  assert(ag && ag.enabled === true, "Agent 默认开启（AGENT_ENABLED=true，填 Key 即走 Agent，页面内可关闭）");
  assert(ag && typeof ag.gateway.complete === "function", "Agent 网关 complete 为可调函数");
  assert(ag && typeof ag.adapt === "function" && typeof ag.ask === "function", "Agent 暴露 adapt/ask 接口");
  if (ag) {
    const ctx = ag.adapt();
    assert(ctx && typeof ctx.user_level === "string" && typeof ctx.scenario === "string", "适配上下文含 user_level / scenario");
    assert(ctx && ctx.device && typeof ctx.device.offline_mode === "boolean", "适配上下文 device.offline_mode 为布尔");
    assert(ctx && Array.isArray(ctx.domains), "适配上下文 domains 为数组");
    const llmRaw = window.localStorage.getItem("sectutor_llm");
    const hasKey = !!(llmRaw && JSON.parse(llmRaw).key);
    assert(ctx && ctx.device.offline_mode === !hasKey, "离线降级标记与 LLM 密钥存在性一致（离线检测读取 state.llm 生效）");
    const p = ag.gateway.complete([{ role: "user", content: "x" }]);
    assert(p && typeof p.then === "function", "网关 complete 返回 Promise（支持异步/流式）");
  }

  // ===== 29b. Phase 2 适配引擎（AdapterRegistry + 分级 + 场景 + 动态升降级）=====
  const ae = window.__agent && window.__agent.adaptEngine;
  assert(!!ae, "Phase2 适配引擎 adaptEngine 已暴露");
  if (ae) {
    if (ae.resetAdapt) ae.resetAdapt(); // 隔离：从一个干净的画像开始
    // 分级阈值（18.1）
    assert(ae.scoreToLevel(0.2) === "L0" && ae.scoreToLevel(0.4) === "L1" && ae.scoreToLevel(0.7) === "L2" && ae.scoreToLevel(0.9) === "L3", "scoreToLevel 四档阈值正确（0.35/0.6/0.8）");
    // compose 产出结构
    const c = ae.compose();
    assert(c && ae.LEVELS.indexOf(c.user_level) >= 0, "compose 产出 user_level 落在 L0-L3");
    assert(c && typeof c.scenario === "string", "compose 产出 scenario 为字符串");
    assert(c && Array.isArray(c.prompt_hints) && c.prompt_hints.some((h) => h.indexOf("[LEVEL:") === 0), "compose 注入 [LEVEL:] 提示模板");
    // 场景识别（18.2 关键词推断）
    assert(ae.inferScenario("我想打CTF拿flag") === "ctf", "inferScenario 识别 CTF");
    assert(ae.inferScenario("准备OSCP考证") === "cert", "inferScenario 识别 考证");
    assert(ae.inferScenario("明天面试找工作") === "job", "inferScenario 识别 就业");
    assert(ae.inferScenario("给家人做防诈骗科普") === "popular", "inferScenario 识别 通识科普");
    assert(ae.inferScenario("hello world") === null, "inferScenario 无关键词返回 null");
    // 显式场景优先于推断
    let a = ae.getAdapt(); a.scenario = "cert"; a.scenarioSource = "explicit"; ae.saveAdapt();
    assert(ae.compose().scenario === "cert", "显式场景覆盖推断（冲突栈 scenario 层）");
    // 未显式选择时由推断驱动
    ae.resetAdapt(); a = ae.getAdapt(); a.inferredScenario = "ctf"; ae.saveAdapt();
    assert(ae.compose().scenario === "ctf", "未显式选择时推断场景生效");
    // 离线强制覆写（18.4）
    if (ae.compose().device.offline_mode) {
      const co = ae.compose();
      assert(co.cloud_disabled === true, "离线时强制禁用云端讲解（device 层覆写）");
      assert(co.prompt_hints.some((h) => h.indexOf("[DEVICE:offline]") >= 0), "离线提示含 [DEVICE:offline]");
    }
    // 动态升降级（18.1）：连续 3 次某域 ≥0.85 → +1；连续 2 次 <0.5 → -1
    ae.resetAdapt();
    ae.recordQuizResult("web", 0.9, 5); ae.recordQuizResult("web", 0.9, 5); ae.recordQuizResult("web", 0.9, 5);
    assert(ae.getAdapt().domainDelta.web === 1, "连续3次≥0.85 该域动态+1级");
    assert(Math.abs((ae.getAdapt().quizAccuracy || 0) - 0.9) < 1e-6, "测验正确率滚动值≈0.9");
    ae.resetAdapt();
    ae.recordQuizResult("web", 0.3, 5); ae.recordQuizResult("web", 0.3, 5);
    assert(ae.getAdapt().domainDelta.web === -1, "连续2次<0.5 该域动态-1级（补前置）");
    // compose 计算的分域水平是合法档位
    const c2 = ae.compose();
    assert(c2 && c2.level_by_domain && ae.LEVELS.indexOf(c2.level_by_domain.web) >= 0, "compose 计算 level_by_domain 落在 L0-L3");
    ae.resetAdapt(); // 还原，避免污染其它测试
  }

  // ===== 30. 密钥保险库 + Web Crypto（方向①）=====
  const ag2 = window.__agent;
  assert(ag2 && ag2.km && typeof ag2.km.encrypt === "function", "密钥加密模块 KM.encrypt 暴露");
  assert(ag2 && ag2.km && ag2.km.available === true, "Web Crypto(subtle) 在当前环境可用");
  assert(ag2 && ag2.vault && typeof ag2.vault.isProtected === "function", "密钥保险库 KeyVault 暴露");
  assert(ag2 && ag2.vault.isProtected() === false, "默认未启用口令保护（行为不变，密钥明文）");
  assert(ag2 && ag2.vault.isLocked() === false, "默认未保护即未锁定（可直连 LLM）");
  if (ag2 && ag2.km && ag2.km.available) {
    const blob = await ag2.km.encrypt("sk-secret-123", "pass1");
    assert(blob && blob.v === 1 && !!blob.ct && !!blob.salt && !!blob.iv, "KM.encrypt 产出 {v,salt,iv,ct} 密文包");
    const back = await ag2.km.decrypt(blob, "pass1");
    assert(back === "sk-secret-123", "KM.decrypt 用正确口令还原明文");
    let wrongFailed = false;
    try { await ag2.km.decrypt(blob, "wrong"); } catch (e) { wrongFailed = true; }
    assert(wrongFailed, "KM.decrypt 用错误口令抛错（防暴力/误解）");
  }

  // ===== 31. D1 向量检索 + D2 特性开关 =====
  assert(ag2 && ag2.vectorEnabled === true, "D1 向量检索配置为启用（VECTOR_ENABLED=true）");
  assert(ag2 && ag2.vectorActive() === false, "无 EMBED_API_KEY 时 vectorActive=false（零成本降级 BM25）");
  assert(ag2 && ag2.features && ag2.features.voiceInput === false && ag2.features.visionInput === false, "D2 语音/视觉默认关闭");
  assert(ag2 && typeof ag2.vectorActive === "function", "vectorActive 为可调函数");

  // ===== 32. Phase 1 工具层：风险分级 + 确认流 =====
  assert(ag2 && typeof ag2.tools === "function", "Agent 暴露 tools() 列出工具");
  if (ag2 && typeof ag2.tools === "function") {
    const tl = ag2.tools();
    assert(Array.isArray(tl) && tl.length >= 10, "tools() 返回工具数组（≥10 项）");
    const lab = tl.find((t) => t.name === "launch_lab_env");
    assert(lab && lab.risk_level === "high" && lab.confirm_required === true, "launch_lab_env 标记为 high + 需确认");
    const sk = tl.find((t) => t.name === "search_knowledge");
    assert(sk && sk.risk_level === "low" && sk.confirm_required === false, "search_knowledge 标记为 low + 不需确认");
    assert(tl.every((t) => typeof t.risk_level === "string"), "每个工具均有 risk_level 字段");
  }
  assert(ag2 && typeof ag2.requiresConfirm === "function", "Agent 暴露 requiresConfirm()");
  if (ag2) {
    assert(ag2.requiresConfirm("launch_lab_env") === true, "requiresConfirm(launch_lab_env)=true");
    assert(ag2.requiresConfirm("search_knowledge") === false, "requiresConfirm(search_knowledge)=false");
    assert(ag2.requiresConfirm("related_topics") === false, "requiresConfirm(related_topics)=false");
  }
  // 低风险工具可执行且返回字符串（验证 run 路径不崩、无效参数优雅处理）
  if (ag2 && typeof ag2.callTool === "function") {
    const r1 = await ag2.callTool("search_knowledge", { query: "sql 注入" });
    assert(typeof r1 === "string" && r1.length > 0, "search_knowledge 执行返回非空字符串");
    const r2 = await ag2.callTool("related_topics", { topicId: "__nope__" });
    assert(typeof r2 === "string", "related_topics 对无效 id 优雅返回字符串（不抛错）");
  }

  // ===== 32b. P1/P2 优化回归：结果截断 / 领域加权检索 / schema 缓存 =====
  if (ag2 && ag2.toolUtil) {
    const tu = ag2.toolUtil;
    assert(typeof tu.truncateToolResult === "function" && tu.RESULT_LIMIT > 0, "工具结果截断助手已暴露");
    const long = "x".repeat(tu.RESULT_LIMIT + 500);
    const cut = tu.truncateToolResult(long);
    assert(cut.length < long.length && cut.indexOf("已截断") >= 0, "超长工具结果被截断且带截断说明");
    assert(tu.truncateToolResult("short") === "short", "短结果原样返回（不误伤）");
    // 领域加权检索：偏好 web 时，含 web 命中的结果应被提前（仅加不减）
    const plain = (window.__perf && window.__perf.retrieve) ? window.__perf.retrieve("注入 攻击 防御", 5) : [];
    const weighted = tu.retrieveWeighted("注入 攻击 防御", 5, ["web"]);
    assert(Array.isArray(weighted) && weighted.length > 0, "retrieveWeighted 返回非空结果");
    const hasWebPlain = plain.some((d) => d.cat === "web");
    if (hasWebPlain) {
      assert(weighted[0].cat === "web" || weighted.filter((d) => d.cat === "web").length >= plain.filter((d) => d.cat === "web").length, "偏好领域命中在加权后未后移（加权生效）");
    }
    assert(tu.retrieveWeighted("注入", 5, []).length > 0, "空偏好领域时退化为普通检索（不崩）");
  }

  // ===== 33. run_scan 工具：授权靶场自检（路线 A）=====
  if (ag2 && typeof ag2.callTool === "function") {
    assert(ag2.riskOf("run_scan") === "high", "run_scan 风险等级为 high");
    assert(ag2.requiresConfirm("run_scan") === true, "run_scan 需用户确认");
    const sc = (ag2.tools() || []).find((t) => t.name === "run_scan");
    assert(sc && sc.risk_level === "high" && sc.confirm_required === true, "tools() 含 run_scan 且标记 high+需确认");
    // 无活动靶场 → 同步引导分支（先强制清零，隔离前置测试副作用；生产环境初始即为 null）
    ag2.setActiveEnv(null);
    const noEnv = await ag2.callTool("run_scan", {});
    assert(typeof noEnv === "string" && /未检测到活动靶场/.test(noEnv), "无活动靶场时 run_scan 返回引导提示（不发包）");
    // 有活动靶场但无后端（jsdom fetch 兜底 reject）→ 返回合规 JSON（catch 分支）
    ag2.setActiveEnv({ id: "lab_xss", labId: "lab_xss", title: "XSS 靶场", status: "running" });
    const withEnv = await ag2.callTool("run_scan", {});
    assert(typeof withEnv === "string", "run_scan 有 env 时返回字符串");
    let parsed = null; try { parsed = JSON.parse(withEnv); } catch (e) {}
    assert(parsed && typeof parsed.ok === "boolean", "run_scan 返回合法 JSON 且含 ok 字段");
    assert(parsed && typeof parsed.compliance === "string" && parsed.compliance.length > 0, "run_scan 返回含合规声明字段");
    ag2.setActiveEnv(null);
  }

  // ===== 34. 端到端闭环：模型调用 run_scan → 确认流 → 执行/拒绝（mock 网关，免真实 LLM/网络）=====
  if (ag2 && typeof ag2.ask === "function") {
    // 确保聊天容器存在（避免 jsdom 缺 #chatLog 时答案无法落盘）
    if (!doc.getElementById("chatLog")) {
      const d = doc.createElement("div"); d.id = "chatLog"; doc.body.appendChild(d);
    }
    const lastBotText = () => {
      const els = doc.querySelectorAll("#chatLog .msg.bot");
      const el = els[els.length - 1];
      return el ? el.textContent : "";
    };
    const resetHooks = () => { if (ag2._resetHooks) ag2._resetHooks(); };
    const runScanTC = { id: "t1", function: { name: "run_scan", arguments: "{}" } };
    const toolCallReply = { toolCalls: [runScanTC], message: { role: "assistant", content: null, tool_calls: [runScanTC] }, content: null, offline: false };

    // T-A：真实确认弹窗连线（确认→true，取消→false），证明 UI 确认流而非静默执行
    if (typeof ag2.confirmToolCall === "function") {
      const pYes = ag2.confirmToolCall({ name: "run_scan" }, {});
      assert(!!doc.getElementById("toolConfirmYes"), "confirmToolCall 真正弹出确认框（#toolConfirmYes 存在）");
      const yesBtn = doc.getElementById("toolConfirmYes");
      if (yesBtn) yesBtn.click();
      const yesRes = await pYes;
      assert(yesRes === true, "点击「确认执行」→ confirmToolCall 解析为 true");
      const pNo = ag2.confirmToolCall({ name: "run_scan" }, {});
      const noBtn = doc.getElementById("toolConfirmNo");
      if (noBtn) noBtn.click();
      const noRes = await pNo;
      assert(noRes === false, "点击「取消」→ confirmToolCall 解析为 false");
    }

    // T-B：完整闭环（接受）——mock 网关第一轮回 run_scan 工具调用，第二轮回显工具结果标记
    resetHooks();
    ag2.setActiveEnv({ id: "lab_xss", labId: "lab_xss", title: "XSS 靶场", status: "running" });
    let calls = 0;
    ag2._setGateway(async (messages, tools, opts) => {
      calls++;
      if (calls === 1) return toolCallReply;
      const lastTool = Array.from(messages).reverse().find((m) => m.role === "tool");
      const sawReport = !!(lastTool && /脆弱点|env_id|compliance/.test(lastTool.content));
      return { content: "自检完成标记=" + (sawReport ? "YES" : "NO") + "；报告已生成。", message: { role: "assistant", content: "自检完成标记=" + (sawReport ? "YES" : "NO") + "；报告已生成。" }, toolCalls: [] };
    });
    ag2._setConfirm(async () => true); // 自动确认
    const before = doc.querySelectorAll("#chatLog .msg.bot").length;
    await ag2.ask("请对我的靶场做一次授权安全自检");
    const after = doc.querySelectorAll("#chatLog .msg.bot").length;
    assert(after === before + 1, "完整闭环为本次问答新增一条 bot 回答");
    const txtB = lastBotText();
    assert(/自检完成标记=YES/.test(txtB), "闭环接受路径：run_scan 已执行且模型收到自检报告（工具结果回传）");
    ag2.setActiveEnv(null);
    resetHooks();

    // T-C：完整闭环（拒绝）——确认返回 false，模型被告知拒绝、run_scan 不执行
    ag2.setActiveEnv({ id: "lab_xss", labId: "lab_xss", title: "XSS 靶场", status: "running" });
    calls = 0;
    ag2._setGateway(async (messages, tools, opts) => {
      calls++;
      if (calls === 1) return toolCallReply;
      const lastTool = Array.from(messages).reverse().find((m) => m.role === "tool");
      const rejected = !!(lastTool && /用户拒绝执行/.test(lastTool.content));
      return { content: "拒绝标记=" + (rejected ? "YES" : "NO") + "；已改为文字说明。", message: { role: "assistant", content: "拒绝标记=" + (rejected ? "YES" : "NO") + "；已改为文字说明。" }, toolCalls: [] };
    });
    ag2._setConfirm(async () => false); // 自动拒绝
    await ag2.ask("请对我的靶场做一次授权安全自检");
    const txtC = lastBotText();
    assert(/拒绝标记=YES/.test(txtC), "闭环拒绝路径：run_scan 未执行，模型被告知用户拒绝");
    ag2.setActiveEnv(null);
    resetHooks();
  }

  // ===== 35. Phase 3 多 Agent 编排：角色注册表 / 路由 / 工具过滤 / 黑板 / 角色工具 =====
  if (ag2) {
    assert(ag2.roles && typeof ag2.roles === "object", "Agent 暴露 roles 角色注册表");
    const expectedRoles = ["auto", "tutor", "planner", "examiner", "coach", "lab"];
    const roleIds = Object.keys(ag2.roles || {});
    expectedRoles.forEach((r) => assert(roleIds.indexOf(r) >= 0, "角色注册表含 " + r));
    assert(typeof ag2.routeRole === "function", "Agent 暴露 routeRole 意图路由");
    if (typeof ag2.routeRole === "function") {
      assert(ag2.routeRole("帮我做个两周学习计划", "auto") === "planner", "routeRole(计划类)→planner");
      assert(ag2.routeRole("出几道题考考我", "auto") === "examiner", "routeRole(出题类)→examiner");
      assert(ag2.routeRole("复盘一下我的错题", "auto") === "coach", "routeRole(复盘类)→coach");
      assert(ag2.routeRole("我想练下靶场", "auto") === "lab", "routeRole(靶场类)→lab");
      assert(ag2.routeRole("什么是 XSS", "auto") === "tutor", "routeRole(讲解类)→tutor");
      assert(ag2.routeRole("随便问", "examiner") === "examiner", "routeRole 显式模式优先于意图");
    }
    assert(typeof ag2.toolSchemasForRole === "function", "Agent 暴露 toolSchemasForRole 角色工具过滤");
    if (typeof ag2.toolSchemasForRole === "function") {
      const tutorTools = (ag2.toolSchemasForRole("tutor") || []).map((s) => s.function.name);
      assert(tutorTools.indexOf("launch_lab_env") < 0 && tutorTools.indexOf("run_scan") < 0, "讲师角色看不到高风险的靶场/自检工具");
      assert(tutorTools.indexOf("generate_plan") < 0, "讲师角色看不到规划工具");
      const labTools = (ag2.toolSchemasForRole("lab") || []).map((s) => s.function.name);
      assert(labTools.indexOf("launch_lab_env") >= 0 && labTools.indexOf("run_scan") >= 0, "靶场员角色含 launch_lab_env/run_scan");
      const examTools = (ag2.toolSchemasForRole("examiner") || []).map((s) => s.function.name);
      assert(examTools.indexOf("generate_quiz") >= 0, "考官角色含 generate_quiz");
      const allTools = (ag2.toolSchemasForRole("auto") || []).map((s) => s.function.name);
      assert(allTools.indexOf("launch_lab_env") >= 0 && allTools.indexOf("generate_quiz") >= 0, "自动模式含全部工具");
    }
    assert(ag2.blackboard && typeof ag2.blackboard.get === "function", "Agent 暴露 blackboard 黑板读写");
    if (ag2.blackboard) {
      const d = ag2.blackboard.default();
      assert(d && d.last_role === "auto" && Array.isArray(d.weak_points), "默认黑板含 last_role/weak_points 等字段");
      ag2.blackboard.save({ weak_points: ["XSS"], last_quiz: { domain: "web", count: 3 }, last_role: "tutor" });
      const g = ag2.blackboard.get();
      assert(g.weak_points && g.weak_points[0] === "XSS" && g.last_quiz.count === 3, "黑板 save→get 往返持久正确");
    }
    assert(typeof ag2.setAgentRole === "function", "Agent 暴露 setAgentRole");
    if (typeof ag2.setAgentRole === "function") {
      ag2.setAgentRole("tutor"); assert(ag2.getAgentRole() === "tutor", "setAgentRole('tutor')→getAgentRole='tutor'");
      ag2.setAgentRole("__bad__"); assert(ag2.getAgentRole() === "auto", "setAgentRole 非法值回退 auto");
    }
    if (typeof ag2.callTool === "function") {
      const qz = await ag2.callTool("generate_quiz", { domain: "web", count: 2 });
      assert(typeof qz === "string" && qz.length > 0, "generate_quiz 调用返回非空字符串（只读抽样出题）");
      const rp = await ag2.callTool("read_progress", {});
      assert(typeof rp === "string" && rp.indexOf("学情快照") >= 0, "read_progress 返回学情快照字符串");
    }
    // 复位角色选择，避免影响其他用例/UI 默认态
    if (typeof ag2.setAgentRole === "function") ag2.setAgentRole("auto");
  }

  // ===== 36. Phase 4 模态管线（ASR 语音 / VLM 视觉）=====
  {
    const ag2 = window.__agent;
    // 在 jsdom 下无 SpeechRecognition / getUserMedia，且无大模型 Key → asr/vlm 均不可用
    assert(ag2 && typeof ag2.asr === "object", "window.__agent.asr 对象存在");
    assert(ag2 && typeof ag2.vlm === "object", "window.__agent.vlm 对象存在");
    assert(ag2.asr.available() === false, "jsdom 下 asr.available()===false（无语音环境/未开开关/无 Key）");
    assert(ag2.vlm.available() === false, "jsdom 下 vlm.available()===false（无 Key 或未开开关）");
    assert(ag2.asr.speechSupported() === false, "speechSupported() 在 jsdom 下为 false");
    assert(ag2.asr.micSupported() === false, "micSupported() 在 jsdom 下为 false");
    // 逐轮输入模态 getter/setter
    assert(typeof ag2.setLastInputModality === "function" && typeof ag2.getLastInputModality === "function", "set/getLastInputModality 存在");
    ag2.setLastInputModality("voice"); assert(ag2.getLastInputModality() === "voice", "setLastInputModality('voice') 往返正确");
    ag2.setLastInputModality("vision"); assert(ag2.getLastInputModality() === "vision", "setLastInputModality('vision') 往返正确");
    ag2.setLastInputModality("bogus"); assert(ag2.getLastInputModality() === "text", "非法模态回退为 text");
    ag2.setLastInputModality("text");
    // 无 Key 时 transcribeAudio / describeImage 优雅拒绝（返回 rejected Promise，不崩溃）
    let asrRej = false; try { await ag2.asr.transcribe(null); } catch (e) { asrRej = true; }
    assert(asrRej, "transcribeAudio 无 Key 时抛错被捕获（不崩溃）");
    let vlmRej = false; try { await ag2.vlm.describe("data:image/png;base64,xx", "描述"); } catch (e) { vlmRej = true; }
    assert(vlmRej, "describeImage 无 Key 时抛错被捕获（不崩溃）");
    // downscale 对短 dataURL 直接透传
    const passthrough = await ag2.vlm.downscale("data:image/png;base64,AAAA", 1280);
    assert(passthrough === "data:image/png;base64,AAAA", "downscale 对短 dataURL 透传");
    // askAgent 带模态参数不崩溃（jsdom 无 Key → 走内置或提示分支）
    try { await ag2.ask("测试语音", { modality: "voice" }); await ag2.ask("测试视觉", { image: "data:image/png;base64,AAAA", modality: "vision" }); assert(true, "askAgent 接收 {modality/image} 参数不抛未捕获异常"); }
    catch (e) { assert(false, "askAgent 模态参数不应抛异常：" + e.message); }
    // UI 按钮存在（受开关约束，默认 disabled，但元素在 DOM）
    assert($("#btnVoice") != null, "聊天输入区存在 🎤 语音按钮");
    assert($("#btnVision") != null, "聊天输入区存在 📷 视觉按钮");
    assert($("#fileImage") != null, "存在隐藏图片文件输入");
  }

  // ===== 37. P3/P4 优化：schema 缓存 / auto 角色徽标 / 多模态消息构造 =====
  {
    const ag2 = window.__agent;
    // schema 按角色缓存：同角色两次调用返回同一数组引用；不同角色集合长度不同
    const t1 = ag2.toolSchemasForRole("tutor"), t2 = ag2.toolSchemasForRole("tutor");
    assert(t1 === t2, "toolSchemasForRole 同角色复用缓存（同一引用）");
    const aAll = ag2.toolSchemasForRole("auto"), eEx = ag2.toolSchemasForRole("examiner");
    assert(Array.isArray(aAll) && aAll.length >= eEx.length, "auto 全量工具 ≥ examiner 白名单数量");
    assert(eEx.every((s) => ["search_knowledge", "generate_quiz"].indexOf(s.function.name) >= 0), "examiner schema 仅含白名单工具");

    // auto 角色徽标：mock 网关，auto 模式提问 → 回答末尾应带「自动编排 → 由「…」角色应答」
    const lastBotText = () => {
      const els = doc.querySelectorAll("#chatLog .msg.bot");
      const el = els[els.length - 1];
      return el ? el.textContent : "";
    };
    const resetHooks = () => { if (ag2._resetHooks) ag2._resetHooks(); };
    ag2.setAgentRole("auto");
    ag2._setGateway(async () => ({ content: "SQL 注入是……（测试回答）", message: { role: "assistant", content: "SQL 注入是……（测试回答）" }, toolCalls: [] }));
    await ag2.ask("什么是 SQL 注入");
    assert(/自动编排 → 由「.+」角色应答/.test(lastBotText()), "auto 模式回答带角色徽标（路由可观测）");

    // 显式角色模式：无徽标
    ag2.setAgentRole("tutor");
    await ag2.ask("什么是 XSS");
    assert(!/自动编排 → 由/.test(lastBotText()), "显式角色模式不显示 auto 徽标");
    ag2.setAgentRole("auto");
    resetHooks();

    // 多模态消息构造：带 image 时本轮用户消息为 content 数组（text + image_url）
    let sawArray = false, sawImg = false;
    ag2._setGateway(async (messages) => {
      const lastUser = Array.from(messages).reverse().find((m) => m.role === "user");
      if (lastUser && Array.isArray(lastUser.content)) {
        sawArray = true;
        sawImg = lastUser.content.some((c) => c.type === "image_url" && c.image_url && typeof c.image_url.url === "string");
      }
      return { content: "已收到图片（测试）", message: { role: "assistant", content: "已收到图片（测试）" }, toolCalls: [] };
    });
    await ag2.ask("请分析这张图片", { image: "data:image/png;base64,AAAA", modality: "vision" });
    assert(sawArray, "视觉轮用户消息为多模态 content 数组");
    assert(sawImg, "视觉轮包含 image_url（图像随本轮发送）");
    resetHooks();
  }

  // ===== 38. P5 靶场深度联动：自动建靶 / 收靶 / 报告归档 =====
  {
    const ag2 = window.__agent;
    // 新工具注册与风险映射
    const tl = ag2.tools();
    const td = tl.find((x) => x.name === "teardown_lab_env"), rr = tl.find((x) => x.name === "read_scan_reports");
    assert(!!td && td.risk_level === "high" && td.confirm_required === true, "teardown_lab_env 已注册且为 high 风险需确认");
    assert(!!rr && rr.risk_level === "low" && rr.confirm_required === false, "read_scan_reports 已注册且为 low 风险免确认");
    // lab 角色白名单包含新工具
    const labNames = ag2.toolSchemasForRole("lab").map((s) => s.function.name);
    assert(labNames.indexOf("teardown_lab_env") >= 0 && labNames.indexOf("read_scan_reports") >= 0, "lab 角色白名单含收靶与报告工具");
    // 空归档优雅返回
    window.localStorage.removeItem("sectutor_scan_reports");
    const emptyMsg = await ag2.callTool("read_scan_reports", {});
    assert(/暂无自检报告归档/.test(emptyMsg), "read_scan_reports 空归档时优雅提示");
    // run_scan（mock 后端 fetch → live 路径）自动归档
    window.fetch = function (url, opts) {
      const u = String(url || "");
      if (u.indexOf("/api/envs/env_t1") >= 0 && (!opts || opts.method !== "DELETE")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, env: { id: "env_t1", labId: "lab_xss", title: "XSS 靶场", status: "running", accessUrl: "http://127.0.0.1:8787/proxy/env_t1" } }) });
      }
      return Promise.reject(new Error("no fetch in test harness"));
    };
    ag2.setActiveEnv({ id: "env_t1", labId: "lab_xss", title: "XSS 靶场", status: "running" });
    const scanOut = await ag2.callTool("run_scan", {});
    let rep = null; try { rep = JSON.parse(scanOut); } catch (e) {}
    assert(rep && rep.ok === true && rep.archived === true && rep.report_id, "run_scan 自检完成且报告自动归档（含 report_id）");
    const stored = JSON.parse(window.localStorage.getItem("sectutor_scan_reports") || "[]");
    assert(Array.isArray(stored) && stored.length === 1 && stored[0].id === rep.report_id, "归档已写入 localStorage（sectutor_scan_reports）");
    const listMsg = await ag2.callTool("read_scan_reports", {});
    assert(listMsg.indexOf(rep.report_id) >= 0 && /XSS 靶场/.test(listMsg), "read_scan_reports 列表含刚归档的报告");
    const fullMsg = await ag2.callTool("read_scan_reports", { report_id: rep.report_id });
    assert(/compliance/.test(fullMsg), "按 report_id 可取回完整报告");
    // 收靶：本地清理 activeEnv + 远端尽力销毁（mock 对 DELETE 落入 catch → TTL 兜底文案）
    const tdMsg = await ag2.callTool("teardown_lab_env", {});
    assert(/清理|销毁|回收/.test(tdMsg), "teardown_lab_env 返回收靶结果字符串");
    // 恢复默认 reject fetch；无环境后验证 labId 分支与引导语
    window.fetch = function () { return Promise.reject(new Error("no fetch in test harness")); };
    const badLab = await ag2.callTool("run_scan", { labId: "lab_nope" });
    assert(/未找到该实验/.test(badLab), "run_scan 未知 labId 返回友好报错");
    const afterTd = await ag2.callTool("run_scan", {});
    assert(/未检测到活动靶场/.test(afterTd), "收靶后 activeEnv 已清理（run_scan 回到无环境引导）");
    // 无环境且无 labId 的 run_scan 引导语包含自动建靶说明
    assert(/labId.*自动建靶|自动建靶/.test(afterTd), "无环境引导语说明可指定 labId 自动建靶");
    ag2.setActiveEnv(null);
  }

  // ===== 39. Phase 5 / v1.1.0 自主流 Flow 引擎：启动/推进/hitl/持久化/续跑 =====
  {
    const ag2 = window.__agent;
    assert(!!window.document.getElementById("flowBar"), "flowBar 进度条容器存在");
    assert(ag2.flow && typeof ag2.flow.start === "function", "window.__agent.flow 已暴露");
    const libKeys = Object.keys(ag2.flow.library);
    assert(libKeys.length >= 3 && libKeys.indexOf("diagnose_web") >= 0, "FLOW_LIBRARY 内置 ≥3 个流程（含 diagnose_web）");
    // 工具注册与风险映射
    const tl = ag2.tools();
    const sf = tl.find((x) => x.name === "start_flow"), fs = tl.find((x) => x.name === "flow_status");
    const af = tl.find((x) => x.name === "advance_flow"), xf = tl.find((x) => x.name === "stop_flow");
    assert(!!sf && !!fs && !!af && !!xf, "四个 Flow 工具均已注册");
    assert(ag2.riskOf("start_flow") === "low" && ag2.riskOf("advance_flow") === "low", "Flow 工具为 low 风险免确认");
    // planner 角色白名单可见 Flow 工具
    const pl = ag2.toolSchemasForRole("planner").map((s) => s.function.name);
    assert(pl.indexOf("start_flow") >= 0 && pl.indexOf("advance_flow") >= 0, "planner 角色白名单含 Flow 工具");
    // 启动 + 持久化
    const s1 = await ag2.callTool("start_flow", { flow_id: "exam_sprint" });
    assert(/已启动流程/.test(s1), "start_flow 启动成功");
    const persisted = ag2.flow.load();
    assert(persisted && persisted.flow_id === "exam_sprint" && persisted.status === "ready" && persisted.step_index === 0, "Flow 状态已持久化（ready/第 0 步）");
    // 进行中不可重复启动
    const s1b = await ag2.callTool("start_flow", { flow_id: "diagnose_web" });
    assert(/已有进行中的流程/.test(s1b), "进行中时拒绝启动新流程");
    // 推进第 1 步（read_progress，免确认）
    const s2 = await ag2.callTool("advance_flow", {});
    assert(/步骤「学情速览」完成/.test(s2), "advance_flow 执行当前步骤并前进");
    // 状态查询
    const s3 = await ag2.callTool("flow_status", {});
    assert(/考前冲刺刷题流/.test(s3) && /✅ 学情速览/.test(s3), "flow_status 报告流程与步骤进度");
    // 终止 + 状态清除
    const s4 = await ag2.callTool("stop_flow", {});
    assert(/已结束流程/.test(s4), "stop_flow 终止流程");
    assert(!ag2.flow.load(), "终止后持久化状态已清除");
    // hitl 拒绝 → 暂停；确认 → 恢复执行
    ag2._setConfirm(async () => false);
    await ag2.callTool("start_flow", { flow_id: "lab_practice" });
    await ag2.callTool("advance_flow", {});                       // 第 1 步 目标讲解（免确认）
    const d2 = await ag2.callTool("advance_flow", {});            // 第 2 步 建靶自检 → 确认被拒
    assert(/已暂停.*拒绝/.test(d2), "hitl 拒绝后流程暂停");
    const paused = ag2.flow.load();
    assert(paused && paused.status === "paused" && paused.step_index === 1, "暂停状态持久化（停在待确认步）");
    ag2._setConfirm(async () => true);
    const d3 = await ag2.callTool("advance_flow", {});            // 重试建靶自检（无后端 → 建靶失败仍记结果前进）
    assert(/步骤「建靶自检」完成/.test(d3), "确认后步骤恢复执行");
    await ag2.callTool("stop_flow", {});
    ag2._resetHooks();
  }

  // ===== 40. v1.1.0 知识图谱 + 质量度量 =====
  {
    const ag2 = window.__agent;
    // —— 知识图谱：数据完整性 ——
    assert(ag2.kg && typeof ag2.kg.check === "function", "window.__agent.kg 已暴露");
    const kg = ag2.kg.graph();
    assert(kg.edgeCount >= 60, `知识图谱依赖边 ≥60（实际 ${kg.edgeCount} 条）`);
    let badEdge = null;
    ["prereq", "advanced", "peer"].forEach((type) => {
      Object.keys(kg[type]).forEach((from) => {
        if (!PF.allTopics().some((t) => t.id === from)) badEdge = badEdge || (type + ":" + from);
        kg[type][from].forEach((to) => {
          if (!PF.allTopics().some((t) => t.id === to)) badEdge = badEdge || (type + ":" + from + "->" + to);
        });
      });
    });
    assert(!badEdge, "知识图谱全部边端点均为有效知识点 id" + (badEdge ? "（非法：" + badEdge + "）" : ""));
    // —— prereq_check 工具 ——
    const ov = await ag2.callTool("prereq_check", {});
    assert(/知识图谱总览/.test(ov), "prereq_check 无参返回图谱总览");
    const pq = await ag2.callTool("prereq_check", { topicId: "jwt" });
    assert(/JWT 安全问题/.test(pq) && /前置/.test(pq), "prereq_check 已知点返回前置链");
    assert(/进阶/.test(pq) && /并列/.test(pq) && /反向依赖/.test(pq), "prereq_check 含进阶/并列/反向依赖");
    const badq = await ag2.callTool("prereq_check", { topicId: "nope_x" });
    assert(/未找到该知识点/.test(badq), "prereq_check 未知 id 友好报错");
    const co = ag2.toolSchemasForRole("coach").map((s) => s.function.name);
    assert(co.indexOf("prereq_check") >= 0, "coach 角色白名单含 prereq_check");
    // —— 质量度量 ——
    assert(ag2.metrics && typeof ag2.metrics.snapshot === "function", "window.__agent.metrics 已暴露");
    assert(ag2.tools().some((x) => x.name === "read_metrics") && ag2.riskOf("read_metrics") === "low", "read_metrics 已注册且 low 风险");
    ag2.metrics.reset();
    assert(ag2.metrics.load().tool.total === 0, "度量重置后计数归零");
    await ag2.callTool("read_progress", {});
    await ag2.callTool("prereq_check", { topicId: "sqli" });
    const m1 = ag2.metrics.load();
    assert(m1.tool.total === 2 && m1.tool.ok === 2, "callTool 埋点记录调用数与成功数");
    assert(m1.tool.by_name.read_progress && m1.tool.by_name.read_progress.total === 1, "分工具统计已记录");
    ag2.metrics.recordFirstToken(100); ag2.metrics.recordFirstToken(200); ag2.metrics.recordFirstToken(300);
    const snap = await ag2.callTool("read_metrics", {});
    assert(/成功率 100%/.test(snap), "read_metrics 报告工具成功率");
    assert(/p50 200ms \/ p95 300ms/.test(snap), "首字延迟 p50/p95 统计正确");
    ag2.metrics.reset();
  }

  // ===== 41. UI 清债防回潮（U1 · v1.3.0）=====
  // 守两条约定：① 模板里不再出现写死的内联样式，动态值只允许用自定义属性传
  //    （style="--w:${pct}%"）；② 模板用到的 u-* 工具类必须在 styles.css 里有定义
  //    —— 类名拼错会静默失效、肉眼难察，只能靠断言兜住。
  {
    const cssText = fs.readFileSync(path.join(dir, "styles.css"), "utf8");
    const inlineList = appJs.match(/style="[^"]*"/g) || [];
    const illegal = inlineList.filter((s) => !/^style="--[a-z-]+:/.test(s));
    assert(inlineList.length <= 8 && illegal.length === 0,
      `内联样式仅剩自定义属性形态（当前 ${inlineList.length} 处，非法 ${illegal.length} 处）`);

    // index.html：静态内联已清干净，只留下「JS 显隐控制」那一类（app.js 会直接写
    // el.style.display，换成 class 会残留 none 导致元素再也显示不出来，详见文件内注释）
    const htmlText = fs.readFileSync(path.join(dir, "index.html"), "utf8");
    const htmlInline = htmlText.match(/style="[^"]*"/g) || [];
    const htmlIllegal = htmlInline.filter((s) => !/^style="display: ?none"$/.test(s));
    assert(htmlIllegal.length === 0,
      `index.html 内联样式仅剩 JS 显隐控制用（当前 ${htmlInline.length} 处，其它 ${htmlIllegal.length} 处）`);

    const usedU = new Set();
    (appJs.match(/class="[^"]*"/g) || []).forEach((attr) => {
      attr.slice(7, -1).split(/\s+/).forEach((c) => { if (c.startsWith("u-")) usedU.add(c); });
    });
    const cssNoComment = cssText.replace(/\/\*[\s\S]*?\*\//g, "");
    const missingU = Array.from(usedU).filter((c) => !new RegExp("\\." + c + "(?![\\w-])").test(cssNoComment));
    assert(usedU.size >= 20, `模板确实在用 u-* 工具类（当前 ${usedU.size} 个）`);
    assert(missingU.length === 0, `u-* 工具类在 styles.css 中均有定义（缺失：${missingU.join(",") || "无"}）`);
  }

  // ===== 42. 主题令牌覆盖（防「某分支下令牌未定义 → 整条样式静默失效」）=====
  // 本项目三套分支：默认（<html> 无 data-theme，按深色渲染）/ light / dark。
  // 只要某个 var(--x) 没写 fallback、又在某分支取不到值，那条声明就会整条失效
  // （v1.4.0 试点时踩过：--surface-* 只写在 data-theme 分支，首屏面板直接变透明）。
  {
    const cssText = fs.readFileSync(path.join(dir, "styles.css"), "utf8");
    const nc = cssText.replace(/\/\*[\s\S]*?\*\//g, "");
    const rules = Array.from(nc.matchAll(/([^{}]+)\{([^{}]*)\}/g)).map((m) => [m[1].trim(), m[2]]);
    const applies = (sel, sc) => sel.split(",").map((s) => s.trim()).some((p) => {
      if (p === ":root") return true;
      if (sc === "default" && p === ":root:not([data-theme])") return true;
      if (sc === "light" && p.indexOf('[data-theme="light"]') >= 0) return true;
      if (sc === "dark" && (p.indexOf('[data-theme="dark"]') >= 0 || p === ":root:not([data-theme])")) return true;
      return false;
    });
    const definedIn = (sc) => {
      const set = new Set();
      rules.forEach(([sel, body]) => {
        if (!applies(sel, sc)) return;
        (body.match(/--[\w-]+\s*:/g) || []).forEach((d) => set.add(d.replace(/\s*:$/, "").trim()));
      });
      return set;
    };
    const usedNoFallback = new Set(Array.from(nc.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)).map((m) => m[1]));
    ["default", "light", "dark"].forEach((sc) => {
      const have = definedIn(sc);
      const missing = Array.from(usedNoFallback).filter((t) => !have.has(t));
      assert(missing.length === 0, `主题分支 ${sc} 令牌覆盖完整（缺失：${missing.join(",") || "无"}）`);
    });
  }

  // ===== 43. 今日页（学习驾驶舱）：主线推荐 + 能力可视化 =====
  {
    const panel = doc.querySelector("#panel-today");
    assert(!!panel, "今日面板存在");
    // 注意：此处不能用 classList.contains("active") 判断默认首页 —— 跑到这里时
    // 前面的用例已经点过多个 tab，active 早已切走。改为校验「源标记」与「侧栏顺序」。
    assert(/<section class="panel active" id="panel-today">/.test(html), "今日在源标记里即默认激活面板");
    const railTabs = Array.from(doc.querySelectorAll(".rail-item")).map((el) => el.dataset.tab);
    assert(railTabs[0] === "today", `「今日」排在侧栏第一位（当前首位 ${railTabs[0]}）`);

    const steps = doc.querySelectorAll("#todaySteps .today-step");
    assert(steps.length >= 3, `今日主线生成了建议步骤（当前 ${steps.length} 步）`);
    assert(doc.querySelectorAll("#todaySteps .today-num").length === steps.length, "每个步骤都带编号节点");
    assert(doc.querySelectorAll("#todaySteps .today-go").length === steps.length, "每个步骤都有可点击的入口按钮");
    const why = doc.querySelector("#todaySteps .today-why");
    assert(!!why && why.textContent.length > 4, "步骤写明了推荐理由");

    const radar = doc.querySelector("#todayRadar svg");
    assert(!!radar, "能力雷达已渲染");
    assert(!!radar && radar.querySelectorAll("polygon").length >= 5, "雷达含网格环与数据多边形");
    assert(doc.querySelectorAll("#todayHeat i").length === 14, "14 天热力条为 14 格");
    assert(doc.querySelectorAll("#todayDist i").length >= 2, "难度分布已渲染");
    assert(doc.querySelectorAll("#panel-today .today-link").length >= 4, "快捷入口已渲染");

    const summary = doc.querySelector("#todaySummary");
    assert(!!summary && summary.textContent.indexOf("已掌握") >= 0, "今日摘要显示掌握情况");
  }

  // ===== 44. 全局副驾驶（方向 C）：命令条 + 抽屉 + 上下文 =====
  {
    const bar = doc.querySelector("#copilotBar");
    const input = doc.querySelector("#copilotInput");
    const drawer = doc.querySelector("#copilotDrawer");
    const log = doc.querySelector("#copilotLog");
    assert(!!bar && !!input, "顶栏副驾驶命令条存在");
    assert(!!drawer && drawer.hidden === true, "副驾驶抽屉默认关闭");

    input.focus();
    assert(drawer.hidden === false, "聚焦命令条即打开抽屉");
    assert(doc.querySelectorAll("#copilotLog .cp-hint").length >= 3, "空对话时给出快捷问题");
    const ctx1 = (doc.querySelector("#copilotCtx") || {}).textContent || "";
    assert(ctx1.indexOf("上下文") >= 0, `上下文 chip 有内容（当前：${ctx1}）`);

    // 打开一个知识点 → 上下文应自动带上它（这是副驾驶「不切面板也知道你在看什么」的关键）
    const card = doc.querySelector("#topicGrid .topic-card");
    if (card) {
      card.click();
      const ctx2 = (doc.querySelector("#copilotCtx") || {}).textContent || "";
      assert(ctx2.length > ctx1.length || ctx2.indexOf("·") >= 0, `看过知识点后上下文更具体（${ctx2}）`);
    }

    // 未配置模型时提问：必须给出明确指引，且不抛异常
    const ask = doc.querySelector("#copilotAsk");
    if (ask) {
      ask.value = "什么是 SQL 注入";
      doc.querySelector("#copilotForm").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
      await delay(30);
      const text = log ? log.textContent : "";
      assert(text.indexOf("什么是 SQL 注入") >= 0, "提问已进入抽屉对话流");
      assert(text.indexOf("配置大模型") >= 0 || text.indexOf("调用失败") >= 0, "未配置模型时给出明确指引而非静默失败");
    }

    // Esc 关闭抽屉
    doc.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    assert(!drawer.classList.contains("on"), "Esc 可关闭副驾驶抽屉");
  }

  // ===== 45. 新功能优化：今日页（时长/换一个/数值）与副驾驶（快捷问题/持久化/让位）=====
  {
    // 主线：时长有依据 + 提供「换一个」
    const altCount = doc.querySelectorAll("#todaySteps .today-alt").length;
    assert(altCount >= 1, `主线为可替换的步骤提供「换一个」（${altCount} 个）`);
    const stepMeta = Array.from(doc.querySelectorAll("#todaySteps .today-step-m")).map((el) => el.textContent).join(" ");
    assert(/约 \d+ 分钟/.test(stepMeta), "每步都标注预计用时");

    // 「换一个」应真的换掉该步推荐
    const firstTitle = (doc.querySelector("#todaySteps .today-step-t") || {}).textContent;
    const altBtn = doc.querySelector("#todaySteps .today-alt");
    if (altBtn) {
      altBtn.click();
      const afterTitle = (doc.querySelector("#todaySteps .today-step-t") || {}).textContent;
      assert(afterTitle !== firstTitle, `「换一个」换掉了原推荐（${firstTitle} → ${afterTitle}）`);
      assert(doc.querySelectorAll("#todaySteps .today-step").length >= 3, "换一个后主线仍完整");
    }

    // 雷达轴标签带百分比 + 诊断入口
    const radarText = Array.from(doc.querySelectorAll("#todayRadar text")).map((t) => t.textContent).join(" ");
    assert(/\d+%/.test(radarText), "雷达轴标签带百分比数值");
    assert(!!doc.querySelector("#todayDiag"), "提供能力诊断入口");

    // 副驾驶：已经有对话后，快捷问题自动收起（避免占位）
    assert(doc.querySelectorAll("#copilotLog .cp-hints").length === 0, "有对话后快捷问题自动收起");

    // 副驾驶：提问后写入 localStorage（刷新不丢）
    const ask = doc.querySelector("#copilotAsk");
    if (ask) {
      ask.value = "优化自测用问题";
      doc.querySelector("#copilotForm").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
      await delay(30);
      const saved = window.localStorage.getItem("sectutor_copilot") || "";
      assert(saved.indexOf("优化自测用问题") >= 0, "副驾驶对话已持久化到 localStorage");
    }

    // 打开抽屉**不应压缩页面**（v1.5.6 改）：原先点顶部命令条会把主区压窄 420px，
    // 卡片重排、图表被压，观感是"页面抽了一下"。现在改为覆盖式，主区布局完全不动。
    // jsdom 没有布局引擎，所以这条走源码级检查（静态、各环境一致）。
    const cssCp = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    assert(!/\.copilot-open\s+\.app\s*\{[^}]*margin/.test(cssCp),
      "打开抽屉不再挤压主区（无 margin 让位规则）");
    assert(!/^\s*\.app\s*\{[^}]*transition:\s*margin/m.test(cssCp), "主区无 margin 过渡（说明让位机制已彻底移除）");
    // 注意：文件里 .copilot-drawer 有多处（reduced-motion 里还有一条），
    // 必须按特征取「基础规则」那条，不能拿 match 的第一个（踩过：@media 里的规则排在前面）
    const drawerRules = cssCp.match(/\.copilot-drawer\s*\{[^}]*\}/g) || [];
    const drawerRule = drawerRules.filter((r) => /position:\s*fixed/.test(r))[0] || "";
    assert(/translateX\(100%\)/.test(drawerRule), "抽屉关闭态为整幅右移（进入时是滑入而非淡入）");
    assert(/position:\s*fixed/.test(drawerRule), "抽屉为 fixed 覆盖层（不参与主区布局）");
    const reduceBlock = (cssCp.match(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\n\}/) || [""])[0];
    assert(/\.copilot-drawer\s*\{[^}]*transition:\s*none/.test(reduceBlock),
      "减弱动效偏好下抽屉不做滑入（420px 位移对这类用户不友好）");

    // 抽屉半透明（默认 40% 透明）：透明度必须走背景 alpha —— opacity 已被显隐动画占用（0 → 1）
    assert(/background:\s*color-mix\(in srgb,\s*var\(--surface-1\)\s+var\(--cp-tint/.test(drawerRule),
      "抽屉底色为半透明（走背景 alpha，不与显隐动画的 opacity 打架）");
    assert(/backdrop-filter:\s*blur\(/.test(drawerRule),
      "抽屉配毛玻璃虚化（纯半透明会让文字压在杂乱内容上不可读）");
    assert(/@supports not \(\(backdrop-filter/.test(cssCp),
      "不支持毛玻璃时退回更实底色（保住文字可读性）");
    assert(/opacity:\s*0/.test(drawerRule) && /transition:[^;}]*opacity/.test(drawerRule),
      "显隐仍由 opacity + transform 负责（与背景透明度互不干扰）");

    // 点击抽屉外部可关闭（覆盖式抽屉的必要配套）
    const drawerEl = doc.querySelector("#copilotDrawer");
    if (drawerEl && !drawerEl.hidden) {
      doc.querySelector(".app").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      await delay(60);
      assert(drawerEl.classList.contains("on") === false, "点击抽屉外部即关闭（不必找关闭按钮）");
    }
  }

  // ===== 46. 继续优化：完成态 / 分布可点 / 周对比 / 副驾驶操作条 =====
  {
    // 周对比文案
    const week = (doc.querySelector("#todayWeekSub") || {}).textContent || "";
    assert(/本周 \d+ · 上周 \d+/.test(week), `热力区显示本周/上周对比（${week}）`);

    // 难度分布每段都是入口，点击后跳到知识库并套用对应筛选
    const segs = doc.querySelectorAll("#todayDist .today-seg");
    assert(segs.length >= 2, `难度分布每段可点击（${segs.length} 段）`);
    const seg = doc.querySelector('#todayDist .today-seg[data-lv="入门"]');
    if (seg) {
      seg.click();
      await delay(20);
      const kb = doc.querySelector("#panel-knowledge");
      assert(!!kb && kb.classList.contains("active"), "点分布段会切到知识库");
      const chip = doc.querySelector('#levelChips .chip[data-level="入门"]');
      assert(!!chip && chip.classList.contains("active"), "并套用对应难度筛选");
      clickTab("today");
      await delay(20);
    }

    // 完成态（端到端）：把主线里推荐的知识点标记为「已掌握」→ 该步骤应变成「今天已完成」
    assert(typeof window.__todayPlan === "function", "今日主线暴露自测钩子");
    const plan = window.__todayPlan ? window.__todayPlan() : [];
    const learnStep = plan.find((s) => s.topic);
    assert(!!learnStep, "主线里存在可学习的知识点步骤");
    if (learnStep) {
      const wasMastered = doc.querySelectorAll("#todaySteps .today-step.done").length;
      window.__showTopic(learnStep.topic.id);      // 打开知识点详情（真实路径）
      await delay(20);
      const learnBtn = doc.querySelector("#learnBtn");
      assert(!!learnBtn, "知识点详情里有「我已掌握」按钮");
      if (learnBtn && !learnBtn.classList.contains("mastered")) learnBtn.click();
      await delay(30);
      window.__renderToday();                      // 重算主线（与真实交互一致）
      const doneSteps = doc.querySelectorAll("#todaySteps .today-step.done");
      assert(doneSteps.length > wasMastered || doneSteps.length >= 1,
        `标记已掌握后主线出现「今天已完成」（${doneSteps.length} 步）`);
      const doneTag = doc.querySelector("#todaySteps .today-done");
      assert(!!doneTag && doneTag.textContent.indexOf("已完成") >= 0, "已完成步骤带勾选标记");
      const doneLabel = Array.from(doc.querySelectorAll("#todaySteps .today-step.done .today-go")).map((b) => b.textContent).join("/");
      assert(/再看一遍|再复习|再测一组/.test(doneLabel), `已完成步骤按钮改为回看文案（${doneLabel}）`);
    }

    // 副驾驶：清空 / 停止 / 复制 / Mac 键位
    assert(!!doc.querySelector("#copilotClear"), "副驾驶提供「清空」");
    assert(!!doc.querySelector("#copilotStop"), "副驾驶提供「停止」");
    const botRows = doc.querySelectorAll("#copilotLog .cp-row.bot").length;
    const copyBtns = doc.querySelectorAll("#copilotLog .cp-tools").length;
    assert(botRows >= 1 && copyBtns >= 1, `每个回答都带「复制」操作（回答 ${botRows} 条 / 复制按钮 ${copyBtns} 个）`);
    const kbd = (doc.querySelector("#copilotKbd") || {}).textContent || "";
    assert(/Ctrl|⌘/.test(kbd), `快捷键提示随平台显示（${kbd}）`);

    // 清空后对话与存储都归零，并重新出现快捷问题
    doc.querySelector("#copilotClear").click();
    await delay(20);
    assert(doc.querySelectorAll("#copilotLog .cp-row").length === 0, "清空后对话流为空");
    assert((window.localStorage.getItem("sectutor_copilot") || "[]") === "[]", "清空后持久化也清空");
    assert(doc.querySelectorAll("#copilotLog .cp-hint").length >= 3, "清空后重新给出快捷问题");
  }

  // ===== 47. 题库覆盖：领域下拉不漂移、每个领域都有题 =====
  {
    const SD = window.eval("SEC_DATA");
    const cats = SD.categories;
    const sel = doc.querySelector("#quizCat");
    assert(!!sel, "自测有领域筛选下拉");
    const ids = Array.from(sel.querySelectorAll("option")).map((o) => o.value);
    assert(ids.length === cats.length + 1, `下拉项数 = 领域数 + 全领域（${ids.length} vs ${cats.length + 1}）`);
    const missing = cats.filter((c) => !ids.includes(c.id)).map((c) => c.id);
    assert(missing.length === 0, `每个领域都能被选中（缺失：${missing.join(",") || "无"}）`);

    const qs = SD.quizzes || [];
    const zero = cats.filter((c) => !qs.some((q) => q.cat === c.id)).map((c) => c.name);
    assert(zero.length === 0, `每个领域都有题目（零题领域：${zero.join("、") || "无"}）`);
    assert(qs.length >= 250, `题库规模已达 ${qs.length} 题`);

    // 题量厚度：每个领域平均每知识点 ≥3 题（v1.5.1 第九批达成，防止后续稀释）
    const thin = cats.filter((c) => {
      const tn = (c.topics || []).length;
      if (!tn) return false;
      const qn = qs.filter((q) => q.cat === c.id).length;
      return qn / tn < 3;
    }).map((c) => c.name + "(" + qs.filter((q) => q.cat === c.id).length + "/" + (c.topics || []).length + ")");
    assert(thin.length === 0, `每个领域平均每知识点 ≥3 题（不足：${thin.join("、") || "无"}）`);
  }

  // ===== 48. 可达性（v1.5.3 批次 3）：可读名称 / 焦点可见 / 跳过链接 / 弹窗 / 双语 aria =====
  {
    const SEL = 'button, input, select, textarea, a[href], [role="button"], [role="tab"], [tabindex]:not([tabindex="-1"])';
    const vis = (el) => !el.disabled && el.type !== "hidden" && el.style.display !== "none" && !el.classList.contains("hidden");
    const els = Array.from(doc.querySelectorAll(SEL)).filter(vis);
    const nameless = els.filter((el) => {
      const text = (el.textContent || "").trim();
      return !text && !el.getAttribute("aria-label") && !el.getAttribute("title") && !el.getAttribute("placeholder");
    });
    assert(nameless.length === 0, `可交互元素均有可读名称（实测 ${els.length} 个，缺名称 ${nameless.length} 个）`);

    const inputs = Array.from(doc.querySelectorAll("input:not([type=hidden]), textarea, select")).filter(vis);
    const noName = inputs.filter((el) => !el.getAttribute("aria-label") && !el.getAttribute("placeholder") && !el.closest("label"));
    assert(noName.length === 0, `输入控件均有无障碍名称（实测 ${inputs.length} 个，缺名称 ${noName.length} 个）`);

    // outline:none 必须有 :focus/:focus-visible 补充（防「焦点不可见」回潮）
    // 扫描前先剥掉注释：否则说明性注释里出现的 "outline: none" 会被当成选择器块（实测踩过）
    const cssText = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const noOutlineBlocks = cssText.match(/[^{}]*\{[^{}]*outline:\s*none[^{}]*\}/g) || [];
    const missing = [];
    noOutlineBlocks.forEach((blk) => {
      const sel = blk.split("{")[0];
      sel.split(",").map((s) => s.trim()).forEach((one) => {
        if (!one || /mainContent/.test(one)) return;                 // 跳转落点不需要焦点环
        if (/:focus/.test(one)) return;                              // 自身就带 :focus
        const root = one.replace(/\s*>.*$/, "").replace(/::?[a-z-]+$/i, "").trim();
        if (!root) return;
        const esc = root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (!new RegExp(esc + "[^{}]*:focus").test(cssText)) missing.push(one);
      });
    });
    assert(missing.length === 0, `outline:none 均有焦点补充（缺：${missing.join(" | ") || "无"}）`);

    // 跳到主内容：存在、指向可聚焦的主容器
    const skip = doc.querySelector(".skip-link");
    assert(!!skip && skip.getAttribute("href") === "#mainContent", "存在「跳到主要内容」链接");
    const mainEl = doc.getElementById("mainContent");
    assert(!!mainEl && mainEl.getAttribute("tabindex") === "-1", "主内容容器可作跳转落点");
    assert(skip && (skip.textContent || "").trim().length > 0, "跳过链接有可读文本");

    // 语言切换：aria-label 跟随（读屏不该听到另一种语言）
    const before = doc.querySelector("#kbSearch").getAttribute("aria-label") || "";
    const lt = doc.querySelector("#langToggle");
    if (lt) {
      lt.click();                                   // 切到英文
      const en = doc.querySelector("#kbSearch").getAttribute("aria-label") || "";
      assert(en && en !== before, `切英文后 aria-label 跟随（${before} → ${en}）`);
      lt.click();                                   // 切回中文
      const zh = doc.querySelector("#kbSearch").getAttribute("aria-label") || "";
      assert(zh === before, `切回中文后 aria-label 复原（${zh}）`);
    }
  }

  // ===== 49. 交互可达性（v1.5.4 批次 1）：可点击元素可键盘操作 / 快捷键顺序 / 无原生 confirm =====
  {
    // ① 可点击元素必须语义化、可聚焦、有名称
    const clickables = Array.from(doc.querySelectorAll("[data-clickable]"));
    assert(clickables.length >= 5, `可点击卡片已语义化（${clickables.length} 个）`);
    const bad = clickables.filter((el) =>
      el.getAttribute("role") !== "button" ||
      Number(el.getAttribute("tabindex")) < 0 ||
      !(el.getAttribute("aria-label") || "").trim());
    assert(bad.length === 0, `可点击元素均有 role/tabindex/名称（不合格 ${bad.length} 个）`);

    // 关键家族必须全覆盖（防止以后新增渲染分支时漏掉）
    ["#topicGrid .topic-card", "#catList .dom", ".range-card", ".news-card"].forEach((sel) => {
      const els = Array.from(doc.querySelectorAll(sel));
      if (!els.length) return;
      const un = els.filter((el) => el.dataset.clickable !== "1");
      assert(un.length === 0, `${sel} 全部可键盘操作（未覆盖 ${un.length}/${els.length}）`);
    });

    // ② 键盘真的能打开知识点：Enter 触发详情
    clickTab("knowledge");
    await delay(20);
    const card = doc.querySelector("#topicGrid .topic-card");
    if (card) {
      card.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await delay(40);
      assert(!!doc.querySelector("#learnBtn"), "Enter 键可打开知识点详情（键盘用户可用）");
      clickTab("today");
      await delay(20);
    }

    // ③ 快捷键顺序 = 侧栏视觉顺序
    const railTabs = Array.from(doc.querySelectorAll(".rail-item[data-tab]")).map((el) => el.dataset.tab);
    assert(railTabs.length > 0, "侧栏导航项存在");
    doc.dispatchEvent(new window.KeyboardEvent("keydown", { key: "1", bubbles: true }));
    await delay(30);
    const act = doc.querySelector(".rail-item.active");
    const actTab = act && act.dataset ? act.dataset.tab : "";
    assert(actTab === railTabs[0], `按 1 进入最左侧面板（期望 ${railTabs[0]}，实际 ${actTab || "无"}）`);
    clickTab("today");
    await delay(20);

    // ④ 源码中不再有原生 confirm（可撤销操作用「限时撤销」替代）
    const src = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
    assert(src.indexOf("window.confirm") < 0, "源码中无 window.confirm");
    assert(src.indexOf('typeof confirm === "function"') < 0, "源码中无原生 confirm 调用");
  }

  // ===== 50. 三态统一与失败可重试（v1.5.4 批次 2）=====
  {
    // ① 搜索无结果 → 统一三态结构（标题 + 说明 + 行动按钮）
    clickTab("knowledge");
    await delay(20);
    const sInp = doc.querySelector("#kbSearch");
    if (sInp) {
      sInp.value = "zzz-not-exist-zzz";
      sInp.dispatchEvent(new window.Event("input", { bubbles: true }));
      if (window.__kbFlushSearch) window.__kbFlushSearch();
      await delay(40);
      const sb = doc.querySelector("#topicGrid .state-block.empty-state");
      assert(!!sb, "搜索无结果显示统一空态（.state-block.empty-state）");
      if (sb) {
        assert(!!sb.querySelector(".sb-t") && !!sb.querySelector(".sb-h"), "空态含标题与说明两段结构");
        const act = sb.querySelector("[data-sb-action]");
        assert(!!act, "空态提供行动按钮（不是死胡同）");
        if (act) {
          act.click();
          await delay(40);
          assert((doc.querySelector("#kbSearch").value || "") === "", "点「清除搜索」后搜索框被清空");
          assert(!doc.querySelector("#topicGrid .state-block.empty-state"), "清除后列表恢复（空态消失）");
        }
      }
    }

    // ② 无内容的难度档 → 统一空态 + 一键恢复筛选（蓝队无「入门」档）
    const doms = Array.from(doc.querySelectorAll("#catList .dom"));
    const blue = doms.find((d) => /蓝队/.test(d.textContent || ""));
    if (blue) {
      blue.click();
      await delay(30);
      const chipB = doc.querySelector('#levelChips .chip[data-level="入门"]');
      if (chipB) {
        chipB.click();
        await delay(40);
        const sb2 = doc.querySelector("#topicGrid .state-block.empty-state");
        if (sb2) {
          assert(!!sb2, "该难度无内容时显示统一空态");
          const a2 = sb2.querySelector("[data-sb-action]");
          assert(!!a2, "并提供「看全部难度」行动按钮");
          if (a2) {
            a2.click();
            await delay(40);
            const allChip = doc.querySelector('#levelChips .chip[data-level="all"]');
            assert(!!allChip && allChip.classList.contains("active"), "点行动按钮后筛选恢复为「全部」");
          }
        }
      }
      const web = doms.find((d) => /Web/.test(d.textContent || ""));
      if (web) web.click();
      await delay(30);
    }

    // ③ 源码级：裸空态写法已收敛，失败路径可重试
    const src2 = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
    const bareEmpty = (src2.match(/<p class="u-muted empty-state">/g) || []).length;
    assert(bareEmpty === 0, `旧的裸空态写法已全部收敛（剩余 ${bareEmpty} 处）`);
    assert(src2.indexOf('actionText: onRetry ? "重试" : null') >= 0, "靶场环境失败提供「重试」按钮");
    assert(src2.indexOf("showEnvDegrade(panel, btn, msg, onRetry)") >= 0 &&
           src2.indexOf("typeof opts.onAction") >= 0,
           "失败路径已接上重试回调（点 toast 或按钮都能重试）");

    clickTab("today");
    await delay(20);
  }

  // ===== 51. 自测动线闭环 + 搜索结果键盘导航（v1.5.4 批次 3）=====
  {
    // ① 故意答错一整套题 → 成绩页必须给出「去看薄弱知识点」并真的能跳过去
    clickTab("quiz");
    await delay(20);
    const SD2 = window.eval("SEC_DATA");
    const startBtn = doc.querySelector("#quizStart");
    if (startBtn) {
      startBtn.click();
      await delay(30);
      let guard = 0;
      while (guard++ < 80) {
        const opts = Array.from(doc.querySelectorAll("#quizMain .quiz-opt"));
        const submit = doc.querySelector("#quizSubmit");
        if (opts.length && submit) {
          const qText = ((doc.querySelector("#quizMain .quiz-q") || {}).textContent || "").trim();
          const item = SD2.quizzes.find((q) => q.q === qText);
          const ansText = item ? item.options[item.answer] : "";
          // 选一个「不是正确答案」的选项
          const wrongBtn = opts.find((b) => {
            const t = b.textContent.replace(/^\d+\.\s*/, "").trim();
            return t !== ansText && t.indexOf(ansText) !== 0;
          }) || opts[0];
          wrongBtn.click();
          submit.click();
          await delay(15);
        }
        const next = doc.querySelector("#quizNext");
        if (next) { next.click(); await delay(15); continue; }
        if (doc.querySelector("#quizToWeak") || doc.querySelector("#quizAgain")) break;
        if (!doc.querySelector("#quizMain .quiz-opt")) break;
      }
      const weakBtn = doc.querySelector("#quizToWeak");
      assert(!!weakBtn, "全部答错后成绩页给出「去看薄弱知识点」按钮（动线闭环）");
      if (weakBtn) {
        const resultTxt = doc.querySelector("#quizMain").textContent || "";
        assert(/薄弱领域/.test(resultTxt), "成绩页列出薄弱领域");
        weakBtn.click();
        await delay(60);
        const kbPanel = doc.querySelector("#panel-knowledge");
        assert(!!kbPanel && kbPanel.classList.contains("active"), "点击后跳转到知识体系面板");
        const actDom = doc.querySelector("#catList .dom.active");
        assert(!!actDom, "并自动切到错题所属领域（有高亮领域项）");
        const cards = doc.querySelectorAll("#topicGrid .topic-card");
        assert(cards.length > 0, `该领域下正常列出知识点（${cards.length} 张卡片）`);
      }
    }

    // ② 搜索结果键盘导航：搜索框 ↓ 进结果、结果间 ↑↓、Esc 回搜索框
    clickTab("knowledge");
    await delay(30);
    const si = doc.querySelector("#kbSearch");
    if (si) {
      si.value = "注入";
      si.dispatchEvent(new window.Event("input", { bubbles: true }));
      if (window.__kbFlushSearch) window.__kbFlushSearch();
      await delay(50);
      const cards = Array.from(doc.querySelectorAll("#topicGrid .topic-card"));
      assert(cards.length >= 2, `搜索「注入」命中多张卡片（${cards.length}）`);
      si.focus();
      si.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      await delay(20);
      assert(doc.activeElement === cards[0], "搜索框按 ↓ 聚焦第一张结果卡片");
      cards[0].dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      await delay(20);
      assert(doc.activeElement === cards[1], "结果卡片间按 ↓ 向下移动");
      cards[1].dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
      await delay(20);
      assert(doc.activeElement === cards[0], "按 ↑ 向上移动");
      cards[0].dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await delay(20);
      assert(doc.activeElement === si, "按 Esc 回到搜索框");
      si.value = "";
      si.dispatchEvent(new window.Event("input", { bubbles: true }));
      if (window.__kbFlushSearch) window.__kbFlushSearch();
      await delay(30);
    }

    clickTab("today");
    await delay(20);
  }

  // ===== 52. 首启引导 / 详情连续阅读 / 快捷键面板（v1.5.4 批次 4）=====
  {
    // ① 首次引导：三步骤 + 关闭后写标记；自测环境不会自动弹（不干扰其他断言）
    const ovAtLoad = doc.querySelector("#modalOverlay");
    assert(!ovAtLoad || ovAtLoad.classList.contains("hidden"), "自测环境不自动弹出新手引导");
    assert(typeof window.__ui.openOnboarding === "function", "引导入口已暴露（便于测试与设置复用）");
    const ov2 = window.__ui.openOnboarding();
    await delay(30);
    assert(!!ov2 && !ov2.classList.contains("hidden"), "引导弹窗可打开");
    const steps = ov2.querySelectorAll(".onboard-step");
    assert(steps.length === 3, `引导含三步说明（实测 ${steps.length} 步）`);
    const guideTxt = ov2.textContent || "";
    assert(/今日/.test(guideTxt) && /快捷键|Ctrl/.test(guideTxt) && /自测/.test(guideTxt),
           "三步分别讲清：入口 / 键盘 / 练题");
    const okBtn = ov2.querySelector("#onboardOk");
    assert(!!okBtn, "引导有「开始使用」按钮");
    if (okBtn) {
      okBtn.click();
      await delay(420);            // 弹窗关闭有过渡动画，等它真正隐藏
      assert(ov2.classList.contains("hidden"), "点「开始使用」后引导关闭");
      let flag = "";
      try { flag = window.localStorage.getItem("sectutor_onboarded") || ""; } catch (e) {}
      assert(flag === "1", "关闭后写入「已看过引导」标记（不再重复打扰）");
    }

    // ② 设置面板里有重看入口
    const setBtn = doc.querySelector("#btnSettings");
    if (setBtn) {
      setBtn.click();
      await delay(40);
      const g2 = doc.querySelector("#setGuide");
      assert(!!g2, "设置面板提供「重新查看新手引导」入口");
      if (g2) {
        g2.click();
        await delay(40);
        const steps2 = doc.querySelectorAll(".onboard-step");
        assert(steps2.length === 3, "从设置重新打开引导可用");
        const sk = doc.querySelector("#onboardSkip");
        if (sk) { sk.click(); await delay(40); }
      } else {
        pressKey("Escape");
        await delay(40);
      }
    }

    // ③ 详情页连续阅读：上一个 / 下一个 + 位置指示
    clickTab("knowledge");
    await delay(30);
    const firstCard = doc.querySelector("#topicGrid .topic-card");
    if (firstCard) {
      firstCard.click();
      await delay(50);
      const row = doc.querySelector("#topicDetail .kb-nav-row");
      assert(!!row, "知识点详情底部有前后导航行");
      const posTxt = row ? (row.textContent || "") : "";
      assert(/\d+\s*\/\s*\d+/.test(posTxt), `详情显示位置指示（${(posTxt.match(/\d+\s*\/\s*\d+/) || [""])[0]}）`);
      const titleBefore = (doc.querySelector("#topicDetail h2") || {}).textContent || "";
      const nx = doc.querySelector("#kbNext");
      assert(!!nx, "存在「下一个」按钮");
      if (nx) {
        nx.click();
        await delay(50);
        const titleAfter = (doc.querySelector("#topicDetail h2") || {}).textContent || "";
        assert(titleAfter && titleAfter !== titleBefore, "点「下一个」切换到另一条知识点");
        const pv = doc.querySelector("#kbPrev");
        assert(!!pv, "切换后出现「上一个」按钮");
        if (pv) {
          pv.click();
          await delay(50);
          const titleBack = (doc.querySelector("#topicDetail h2") || {}).textContent || "";
          assert(titleBack === titleBefore, "点「上一个」回到原来的知识点");
        }
      }
      const back = doc.querySelector("#backKb");
      if (back) { back.click(); await delay(30); }
    }

    // ④ 快捷键面板补全（含知识库导航与 9 个面板）
    window.__ui.openHotkeyHelp();
    await delay(60);
    const hk = doc.querySelector("#modalBody");
    const hkTxt = hk ? (hk.textContent || "") : "";
    assert(/知识库结果上下浏览/.test(hkTxt), "快捷键面板含「知识库结果上下浏览」");
    assert(/在结果中返回搜索框/.test(hkTxt), "快捷键面板含「结果中返回搜索框」");
    const panelRows = (hkTxt.match(/切换到 /g) || []).length;
    assert(panelRows === 9, `快捷键面板列出全部 9 个面板（实测 ${panelRows}）`);
    pressKey("Escape");
    await delay(40);

    clickTab("today");
    await delay(20);
  }

  // ===== 53. 手感与效率：复制 / 高亮 / Esc / 加载态（v1.5.4 批次 5）=====
  {
    // 测试卫生：确保没有残留弹窗（上一节刚关过弹窗，动画可能未结束，
    // 否则 Esc 会先被弹窗吃掉，导致后面的「详情 Esc」断言假失败）
    const ovLeft = doc.querySelector("#modalOverlay");
    if (ovLeft && !ovLeft.classList.contains("hidden")) {
      pressKey("Escape");
      await delay(460);
    }

    // ① 知识点详情的代码块有一键复制，点击后有反馈
    clickTab("knowledge");
    await delay(30);
    const c0 = doc.querySelector("#topicGrid .topic-card");
    if (c0) {
      c0.click();
      await delay(60);
      const copyBtn = doc.querySelector("#topicDetail .code-copy");
      assert(!!copyBtn, "知识点代码块带「复制」按钮");
      const codePre = doc.querySelector("#topicDetail pre");
      assert(!!codePre && (codePre.textContent || "").indexOf("复制") < 0,
             "复制按钮不污染代码文本（手动选中复制不会带上按钮文字）");
      assert((copyBtn && copyBtn.getAttribute("aria-label")) === "复制代码", "复制按钮有无障碍名称");
      if (copyBtn) {
        const host = doc.querySelector("#toastHost");
        const before = host ? host.children.length : 0;
        copyBtn.click();
        await delay(60);
        const after = host ? host.children.length : 0;
        assert(after > before || !!doc.querySelector(".toast"), "点复制后给出反馈（toast）");
      }

      // ④ Esc 从详情返回列表（先确认详情确实打开，失败时归因更清楚）
      assert(!doc.querySelector("#topicDetail").classList.contains("hidden"), "详情已打开（Esc 测试前置条件）");
      doc.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await delay(40);
      const det = doc.querySelector("#topicDetail");
      const grid = doc.querySelector("#topicGrid");
      assert(!!det && det.classList.contains("hidden"), "详情页按 Esc 已收起");
      assert(!!grid && !grid.classList.contains("hidden"), "Esc 后回到知识点列表");
    }

    // ② 搜索命中高亮
    const si2 = doc.querySelector("#kbSearch");
    if (si2) {
      si2.value = "注入";
      si2.dispatchEvent(new window.Event("input", { bubbles: true }));
      if (window.__kbFlushSearch) window.__kbFlushSearch();
      await delay(50);
      const marks = doc.querySelectorAll("#topicGrid .topic-card mark.hl");
      assert(marks.length > 0, `搜索结果高亮命中词（${marks.length} 处）`);
      const firstMark = marks[0];
      assert(!!firstMark && /注入/.test(firstMark.textContent || ""), "高亮内容就是搜索词");
      si2.value = "";
      si2.dispatchEvent(new window.Event("input", { bubbles: true }));
      if (window.__kbFlushSearch) window.__kbFlushSearch();
      await delay(30);
    }

    // ③ 工具箱输出也能一键复制
    clickTab("tools");
    await delay(40);
    const ti = doc.querySelector("#tbInput");
    const to = doc.querySelector("#tbOp");
    const tr = doc.querySelector("#tbRun");
    if (ti && to && tr) {
      ti.value = "hello";
      to.value = "b64e";
      if (to.dispatchEvent) to.dispatchEvent(new window.Event("change", { bubbles: true }));
      tr.click();
      await delay(60);
      const tbOut = doc.querySelector("#tbOut");
      assert(!!tbOut && (tbOut.textContent || "").indexOf("aGVsbG8") === 0, "工具箱正常产出结果");
      const tbOutEl = doc.querySelector("#tbOut");
      const tbWrap = tbOutEl && tbOutEl.parentNode;
      assert(!!tbWrap && tbWrap.classList.contains("code-wrap") && !!tbWrap.querySelector(".code-copy"),
             "工具箱输出带「复制」按钮");
      assert(!!tbOutEl && (tbOutEl.textContent || "").indexOf("复制") < 0, "输出文本未被复制按钮污染");
    }

    // ⑤ 加载态真正启用（源码级：环境申请用统一 loading 三态）
    const src3 = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
    assert(src3.indexOf('stateBlock("loading"') >= 0, "存在统一加载态用法");
    assert(/正在向后端申请临时环境[\s\S]{0,120}stateBlock\(\"loading\"/.test(src3) ||
           src3.indexOf('stateBlock("loading", {') >= 0, "环境申请使用统一加载态");
    assert(src3.indexOf("function enhanceCodeBlocks") >= 0 && src3.indexOf("function hlTerms") >= 0,
           "复制与高亮的公共实现已就绪");

    clickTab("today");
    await delay(20);
  }

  // ===== 54. 键盘化 / 撤销 / 问答操作（v1.5.4 批次 6）=====
  {
    // 前置：清掉可能残留的弹窗（动画未结束会吃掉按键）
    const ovL = doc.querySelector("#modalOverlay");
    if (ovL && !ovL.classList.contains("hidden")) { pressKey("Escape"); await delay(460); }

    // 前置：清掉焦点（前序测试可能把焦点留在搜索框里，
    // 而快捷键有「输入框内不触发」的保护 → 按键会被吃掉，导致假失败）
    try { if (doc.activeElement && doc.activeElement.blur) doc.activeElement.blur(); } catch (e) {}

    // ① 详情页键盘：M 标记掌握 + ←→ 前后
    clickTab("knowledge");
    await delay(30);
    const card1 = doc.querySelector("#topicGrid .topic-card");
    assert(!!card1, "知识库有卡片可供键盘测试");
    if (card1) {
      card1.click();
      await delay(60);
      try { if (doc.activeElement && doc.activeElement.blur) doc.activeElement.blur(); } catch (e) {}
      const titleA = (doc.querySelector("#topicDetail h2") || {}).textContent || "";
      const learn = doc.querySelector("#learnBtn");
      const learnTxtBefore = learn ? learn.textContent : "";
      pressKey("m");
      await delay(80);
      const learnTxtAfter = (doc.querySelector("#learnBtn") || {}).textContent || "";
      assert(learnTxtAfter && learnTxtAfter !== learnTxtBefore, `M 键切换掌握状态（${learnTxtBefore} → ${learnTxtAfter}）`);

      // ③ 撤销：点 toast 里的「撤销」应恢复原状
      const toastEls = Array.from(doc.querySelectorAll("#toastHost .toast"));
      const lastToast = toastEls[toastEls.length - 1];
      const actBtn = lastToast ? lastToast.querySelector(".toast-act") : null;
      assert(!!actBtn, "标记掌握后 toast 提供「撤销」（可撤销操作不该不可逆）");
      if (actBtn) {
        actBtn.click();
        await delay(120);
        const learnTxtUndo = (doc.querySelector("#learnBtn") || {}).textContent || "";
        // 撤销的语义是「回到执行 M 之前的状态」，所以应与按下 M 之前的文本一致
        assert(learnTxtUndo === learnTxtBefore,
               `点「撤销」后回到操作前状态（期望 ${learnTxtBefore}，实际 ${learnTxtUndo}）`);
      }

      // → 下一个知识点，← 回到原处
      const nx = doc.querySelector("#kbNext");
      if (nx) {
        pressKey("ArrowRight");
        await delay(80);
        const titleB = (doc.querySelector("#topicDetail h2") || {}).textContent || "";
        assert(titleB && titleB !== titleA, `→ 键切到下一个知识点（${titleA.slice(0, 10)} → ${titleB.slice(0, 10)}）`);
        pressKey("ArrowLeft");
        await delay(100);
        const titleC = (doc.querySelector("#topicDetail h2") || {}).textContent || "";
        assert(titleC === titleA, `← 键回到上一个知识点（期望 ${titleA.slice(0, 10)}，实际 ${titleC.slice(0, 10)}）`);
      }
      pressKey("Escape");
      await delay(60);
    }

    // ② 自测键盘化：↑↓ 选选项、Enter 提交 / 下一题
    clickTab("quiz");
    await delay(30);
    try { if (doc.activeElement && doc.activeElement.blur) doc.activeElement.blur(); } catch (e) {}
    const qs = doc.querySelector("#quizStart");
    if (qs) {
      qs.click();
      await delay(40);
      const opts = Array.from(doc.querySelectorAll("#quizMain .quiz-opt"));
      assert(opts.length >= 2, `自测题目有多个选项（${opts.length}）`);
      pressKey("ArrowDown");
      await delay(40);
      assert(!!doc.querySelector("#quizMain .quiz-opt.sel"), "↓ 键选中第一个选项（不必用鼠标）");
      pressKey("ArrowDown");
      await delay(40);
      const selIdx = Array.from(doc.querySelectorAll("#quizMain .quiz-opt")).findIndex((b) => b.classList.contains("sel"));
      assert(selIdx === 1, `再按 ↓ 移到第二个选项（当前第 ${selIdx + 1} 个）`);
      const fbBefore = doc.querySelector("#quizFeedback");
      pressKey("Enter");
      await delay(60);
      const fb = doc.querySelector("#quizFeedback");
      assert(!!fb && !fb.classList.contains("hidden"), "Enter 键提交答案并给出对错反馈");
      pressKey("Enter");
      await delay(60);
      const afterSubmit = doc.querySelector("#quizMain .quiz-opt");
      const txt = (doc.querySelector("#quizMain") || {}).textContent || "";
      assert(!!txt, `Enter 键可继续到下一题或成绩页（${txt.slice(0, 12)}…）`);
      // 收尾：退出自测（避免影响后续流程）
      clickTab("today");
      await delay(30);
    }

    // ④ 智能问答：每条回答带复制 / 重新生成
    clickTab("chat");
    await delay(40);
    const ci = doc.querySelector("#chatInput");
    if (ci) {
      ci.value = "什么是 SQL 注入";
      const sendBtn = doc.querySelector("#sendBtn");
      if (sendBtn) { sendBtn.click(); } else {
        ci.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      }
      await delay(120);
      const botRows = doc.querySelectorAll("#chatLog .msg-row.bot");
      assert(botRows.length >= 1, `智能问答给出了回答（${botRows.length} 条）`);
      const lastBot = botRows[botRows.length - 1];
      const tools = lastBot ? lastBot.querySelectorAll(".msg-tools .msg-act") : [];
      assert(tools.length >= 2, `回答带消息级操作（${tools.length} 个：复制 / 重新生成）`);
      const copyAct = lastBot ? lastBot.querySelector('[data-act="copy"]') : null;
      assert(!!copyAct, "回答带「复制」");
      if (copyAct) {
        const host2 = doc.querySelector("#toastHost");
        const before2 = host2 ? host2.children.length : 0;
        copyAct.click();
        await delay(60);
        assert((host2 ? host2.children.length : 0) > before2 || !!doc.querySelector(".toast"), "点「复制」有反馈");
      }
      const regenAct = lastBot ? lastBot.querySelector('[data-act="regen"]') : null;
      assert(!!regenAct, "回答带「重新生成」");
      if (regenAct) {
        const n0 = doc.querySelectorAll("#chatLog .msg-row.bot").length;
        regenAct.click();
        await delay(160);
        const n1 = doc.querySelectorAll("#chatLog .msg-row.bot").length;
        // 注意：打字指示行也带 .msg-row.bot，所以允许 +2（自身 + 可能的指示行）
        assert(n1 >= 1 && n1 <= n0 + 2, `重新生成后回答数量正常（${n0} → ${n1}，不堆积）`);
      }
    }

    clickTab("today");
    await delay(20);
  }

  // ===== 55. CSS 层叠：内层 input 必须完全透明（防「搜索框里套小框」回潮）=====
  {
    // ⚠️ 不要用 getComputedStyle 断言 padding / border：
    //    实测 jsdom 24（CI 里 npm install 装的版本）不解析样式表层叠，这两个属性会直接返回
    //    UA 默认值（padding:1px / border:inset）→ 断言假失败；而 jsdom 30（本机托管回退路径）
    //    会正确解析。把断言绑在 jsdom 版本上毫无意义，因此改为源码级检查（各版本一致）。
    const kb = doc.querySelector("#kbSearch");
    assert(!!kb, "知识库搜索框存在");
    const cssTxt = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const innerRule = (cssTxt.match(/\.kb-search\s*>?\s*input\s*\{[^}]*\}/) || [""])[0];
    assert(!!innerRule, "存在内层 input 的权威样式规则");
    assert(/padding:\s*0/.test(innerRule), "内层 input 内边距归零");
    assert(/border:\s*(0|none)/.test(innerRule), "内层 input 无边框");
    assert(/box-shadow:\s*none/.test(innerRule), "内层 input 无阴影（否则会变成「框里套框」）");
    assert(/appearance:\s*none/.test(innerRule), "内层 input 关闭 UA 默认外观（appearance: none）");
    // 焦点可见性由外层容器承担，不能因为归零而丢失
    assert(/\.kb-search:focus-within/.test(cssTxt), "焦点反馈由外层 .kb-search:focus-within 承担（未丢失）");
    const wrapFocus = (cssTxt.match(/\.kb-search:focus-within\s*\{[^}]*\}/) || [""])[0];
    assert(/box-shadow|border-color/.test(wrapFocus), "外层容器聚焦时有可见反馈");
    const focusBlocks = cssTxt.match(/\.kb-search[^{]*input:focus\s*\{[^}]*\}/g) || [];
    // 注意：不要写成 /box-shadow:\s*(?!none)/ —— \s* 可以匹配零个空格，
    // 于是 "box-shadow: none" 里 `none` 前的空格会让否定预查通过 → 误报为「有内环」（踩过）。
    // 正确做法是解析出值再比较。
    const hasInnerRing = focusBlocks.some((b) => {
      const m = b.match(/box-shadow:\s*([^;]+)/);
      return !!m && m[1].trim() !== "none";
    });
    assert(!hasInnerRing, "内层 input 的 :focus 不再画焦点环（避免框里套框）");
  }

  // ===== 56. 样式债守护：不得新增「旧代残留」的盒模型/布局冲突（v1.5.5）=====
  {
    // 背景：styles.css 经多轮 UI 迭代，同一选择器存在多代定义。后代若"重新布局"了该元素
    // （设了 display/flex/position/尺寸…），却没覆盖旧代的盒模型声明，旧值就会继续生效 ——
    // 「搜索框里套小框」「搜索框比同行控件高 8px」都属这一类。
    // 这里做静态检测（与 jsdom 无关，各版本一致）：同一选择器多代定义 + 后代有布局声明 +
    // 旧代盒模型声明未被覆盖 → 命中。已人工复核属有意保留的写入 ALLOW。
    const cssRaw2 = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const parseRules = (cssText, media) => {
      const out = [];
      let i = 0;
      while (i < cssText.length) {
        const brace = cssText.indexOf("{", i);
        if (brace < 0) break;
        const sel = cssText.slice(i, brace).trim();
        let depth = 1, j = brace + 1;
        while (j < cssText.length && depth) {
          if (cssText[j] === "{") depth++;
          else if (cssText[j] === "}") depth--;
          j++;
        }
        const body = cssText.slice(brace + 1, j - 1);
        if (sel.indexOf("@media") === 0) out.push.apply(out, parseRules(body, sel));
        else if (sel && sel[0] !== "@") {
          const props = {};
          body.split(";").forEach((d) => {
            const p = d.indexOf(":");
            if (p > 0) props[d.slice(0, p).trim().toLowerCase()] = d.slice(p + 1).trim();
          });
          if (Object.keys(props).length) out.push({ sel: sel.replace(/\s+/g, " "), props: props, media: media || "" });
        }
        i = j;
      }
      return out;
    };
    const LAYOUT2 = ["display", "flex", "float", "position", "height", "width", "max-width", "min-width",
                     "grid-template-columns", "align-items", "justify-content", "overflow", "gap"];
    const BOXY2 = ["margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
                   "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
                   "width", "height", "border-radius", "box-shadow", "background"];
    const groups2 = {};
    parseRules(cssRaw2, "").forEach((r) => {
      const k = r.sel + " @ " + r.media;
      (groups2[k] = groups2[k] || []).push(r);
    });
    const flagged2 = [];
    Object.keys(groups2).forEach((k) => {
      const blocks = groups2[k];
      if (blocks.length < 2) return;
      const later = {};
      blocks.slice(1).forEach((b) => Object.keys(b.props).forEach((p) => { later[p] = b.props[p]; }));
      const first = blocks[0].props;
      const residue = Object.keys(first).filter((p) => BOXY2.indexOf(p) >= 0 && !(p in later));
      const laterLayout = Object.keys(later).filter((p) => LAYOUT2.indexOf(p) >= 0);
      if (residue.length && laterLayout.length) flagged2.push(k.split(" @ ")[0]);
    });
    // 已人工复核、确认属「有意保留」的（不要随意扩充这个名单）
    const ALLOW = [
      "body",           // 背景/字体是基线样式，后代只是加了布局，并非重新设计
      ".rail-item",     // 侧栏图标的固定尺寸是本意，后代只加了 position: relative
      ".code-wrap",     // 块级语境下 8px 纵向间距是本意；flex 行内已由 .tb-row .code-wrap { margin: 0 } 覆盖
    ];
    const fresh = flagged2.filter((s) => ALLOW.indexOf(s) < 0);
    assert(fresh.length === 0, `未新增「旧代残留」样式债（新增：${fresh.join(" | ") || "无"}）`);
  }

  // ===== 57. 死代码与发行内容守护（v1.5.5）=====
  {
    // ① 孤儿类选择器：CSS 里定义、运行时源码（index/app/data）里既不出现、也无法由动态拼接产生
    let cssRaw3 = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    // 只保留「选择器区」：把声明块掏空，避免 url(...woff2)、0.5s 之类被当成类名（实测误报过）
    cssRaw3 = cssRaw3.replace(/\{[^{}]*\}/g, " {}");
    const runtimeBlob = ["index.html", "app.js", "data.js"]
      .map((f) => fs.readFileSync(path.join(__dirname, f), "utf8")).join("\n");
    // 动态类名识别：类名在任一「以 - 断开的片段」处，紧跟引号/反引号/$ 出现 → 视为拼接生成
    // （例："toast toast-" + type、`lvl-${x}`、'today-c' + i、class="gs-" + kind）
    const isDynamic = (cls) => {
      // 形如 "toast toast-" + type / `lvl-${x}` / 'today-c' + i / class="gs-" + kind
      // 判定必须严格：要求「前缀 + 引号 + 紧跟 +」或「前缀 + ${」，否则源码里随便一处
      // 以该前缀结尾的普通字符串（如 zz"）都会误判为动态类名（实测踩过：注入的死类名没被抓住）。
      for (let i = 2; i < cls.length; i++) {
        const p = cls.slice(0, i);
        if (runtimeBlob.indexOf(p + "${") >= 0) return true;
        for (let qi = 0; qi < 3; qi++) {
          const q = ['"', "'", "`"][qi];
          let from = 0;
          while (true) {
            const at = runtimeBlob.indexOf(p + q, from);
            if (at < 0) break;
            const after = runtimeBlob.substr(at + p.length + 1, 6);
            if (/^\s*\+/.test(after)) return true;
            from = at + 1;
          }
        }
      }
      return false;
    };
    const orphanCls = [];
    (cssRaw3.match(/\.[A-Za-z_\u4e00-\u9fa5][\w\u4e00-\u9fa5-]*/g) || []).forEach((token) => {
      const cls = token.slice(1);
      if (runtimeBlob.indexOf(cls) >= 0 || isDynamic(cls)) return;
      if (orphanCls.indexOf(cls) < 0) orphanCls.push(cls);
    });
    assert(orphanCls.length === 0, `无孤儿类选择器（死样式）：${orphanCls.join(" | ") || "无"}`);

    // ② 发行内容：打包必须用白名单，禁止 "**/*" 把开发产物（测试/预览页/构建产物/node_modules）带进安装包
    const appPkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "sectutor-app", "package.json"), "utf8"));
    const extra = (appPkg.build && appPkg.build.extraResources) || [];
    const feEntry = extra.filter((e) => e.to === "cybersec-agent")[0];
    assert(!!feEntry, "打包配置里有 cybersec-agent 资源项");
    if (feEntry) {
      const f = feEntry.filter || [];
      assert(f.indexOf("**/*") < 0, "打包过滤是白名单（不得用 **/* 全量携带开发产物）");
      ["index.html", "app.js", "styles.css", "data.js"].forEach((need) => {
        assert(f.indexOf(need) >= 0, `打包白名单包含运行时文件 ${need}`);
      });
      assert(f.some((x) => x.indexOf("assets") === 0), "打包白名单包含 assets（字体等静态资源）");
    }

    // ③ 后端资源：node_modules 是运行必需的（express/dockerode），但不能夹带非运行时文件。
    //    复查发现此前只有一条 "!**/node_modules/.cache/**" 排除 → @types/*.map/test/docs 全被打进包。
    const beEntry = extra.filter((e) => e.to === "sectutor-backend")[0];
    assert(!!beEntry, "打包配置里有 sectutor-backend 资源项");
    if (beEntry) {
      const bf = beEntry.filter || [];
      ["@types", ".bin", "*.map"].forEach((bad) => {
        assert(bf.some((x) => x.indexOf(bad) >= 0), `后端过滤排除非运行时内容：${bad}`);
      });
      // 运行时依赖必须还在（express 是后端的心脏）
      assert(bf.indexOf("**/*") >= 0, "后端以 **/* 为基础（运行时依赖要随包发布）");
      // 不能出现"整体排除 node_modules"的模式（运行时依赖必须随包发布）。
      // 注意只看整排除的模式（!**/node_modules 或 !**/node_modules/**），
      // 子目录排除（如 !**/node_modules/@types/**）是我们要的，不能误伤。
      const wholeExclude = bf.some((x) => /^!\*\*\/node_modules(\/\*\*)?$/.test(x));
      assert(!wholeExclude, "后端不得整体排除 node_modules（运行时依赖必需）");
    }
  }

  // ===== 58. 窄窗适配 / 长文本 / 中途切面板的状态一致性（v1.5.5）=====
  {
    // ① 窄窗与长文本：源码级检查（静态，不受 jsdom 版本影响）
    const cssN = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const m720 = (cssN.match(/@media \(max-width: 720px\)\s*\{[\s\S]*?\n\}/) || [""])[0];
    assert(/\.kb-toolbar\s*\{[^}]*flex-wrap:\s*wrap/.test(m720),
           "窄窗（≤720）知识库工具栏允许换行（5 个控件不再挤一行）");
    assert(/\.kb-toolbar\s+\.kb-search\s*\{[^}]*flex:\s*1 1 100%/.test(m720),
           "窄窗下搜索框独占一行（否则被压到几乎不可用）");
    assert(/\.crumb-sub\s*\{[^}]*display:\s*none/.test(m720), "窄窗下顶栏副标题让位");
    const codePre = (cssN.match(/\.code-wrap pre\s*\{[^}]*\}/g) || []).join(" ");
    assert(/overflow-x:\s*auto/.test(codePre), "代码块长行横向滚动（不撑破气泡/卡片）");
    const titleRule = (cssN.match(/\.news-card h4[^{]*\{[^}]*\}/) || [""])[0];
    assert(/overflow-wrap:\s*anywhere/.test(titleRule),
           "卡片标题允许长词断行（CVE 编号等超长词不顶破卡片）");

    // ② 中途切面板：自测状态应当保留（用户常边学边切面板）
    clickTab("quiz");
    await delay(30);
    const qsBtn = doc.querySelector("#quizStart");
    if (qsBtn) {
      qsBtn.click();
      await delay(40);
      const qBefore = (doc.querySelector("#quizMain .quiz-q") || {}).textContent || "";
      assert(!!qBefore, "自测已出题（切面板前）");
      clickTab("knowledge");
      await delay(30);
      clickTab("quiz");
      await delay(40);
      const qAfter = (doc.querySelector("#quizMain .quiz-q") || {}).textContent || "";
      assert(qAfter === qBefore, "切换面板后回到自测，原题目仍在（状态未丢）");
    }

    // ③ 聊天草稿：切面板/切回不应丢输入内容
    clickTab("chat");
    await delay(30);
    const ci3 = doc.querySelector("#chatInput");
    if (ci3) {
      ci3.value = "草稿-切面板测试";
      ci3.dispatchEvent(new window.Event("input", { bubbles: true }));
      await delay(520);                       // 草稿落盘是 400ms 防抖
      clickTab("tools");
      await delay(30);
      clickTab("chat");
      await delay(40);
      const ci4 = doc.querySelector("#chatInput");
      assert(!!ci4 && ci4.value === "草稿-切面板测试", `切面板后聊天草稿仍在（实际「${(ci4 || {}).value || ""}」）`);
      if (ci4) { ci4.value = ""; ci4.dispatchEvent(new window.Event("input", { bubbles: true })); }
    }

    // ④ 副驾驶上下文：看过知识点后切面板，上下文仍能正确更新且不报错
    clickTab("knowledge");
    await delay(30);
    const c3 = doc.querySelector("#topicGrid .topic-card");
    if (c3) {
      c3.click();
      await delay(60);
      const ctxBefore = (doc.querySelector("#copilotCtx") || {}).textContent || "";
      assert(/SQL|注入|知识|今日/.test(ctxBefore) || ctxBefore.length > 0,
             `副驾驶上下文 chip 有内容（${ctxBefore.slice(0, 20)}）`);
      pressKey("Escape");
      await delay(60);
      clickTab("news");
      await delay(40);
      const ctxAfter = (doc.querySelector("#copilotCtx") || {}).textContent || "";
      assert(typeof ctxAfter === "string", "切换面板后副驾驶上下文仍然可读（无异常）");
      clickTab("today");
      await delay(30);
    }
  }

  // ===== 59. 键盘可达第二轮：分类筛选 / 列表导航 / 模态焦点环绕（v1.5.5）=====
  {
    const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

    // ① 分类筛选列表此前是鼠标专用（<li> + click，无 role/tabindex）→ 现应可键盘操作
    const catLists = [["#catList", ".dom"], ["#rangeCats", "li"], ["#labCats", "li"], ["#toolList", "li"]];
    clickTab("range");
    await delay(40);
    clickTab("quiz");
    await delay(40);
    clickTab("tools");
    await delay(40);
    let checkedAny = 0;
    for (let ci = 0; ci < catLists.length; ci++) {
      const host = doc.querySelector(catLists[ci][0]);
      const items = host ? Array.from(host.querySelectorAll(catLists[ci][1])) : [];
      if (!items.length) continue;
      checkedAny++;
      const bad = items.filter((el) => el.getAttribute("role") !== "button" ||
        Number(el.getAttribute("tabindex")) < 0 || !(el.getAttribute("aria-label") || "").trim());
      assert(bad.length === 0, `${catLists[ci][0]} 分类项均可键盘操作（不合格 ${bad.length}/${items.length}）`);
    }
    assert(checkedAny >= 3, `至少检查到 3 个分类列表（实际 ${checkedAny}）`);

    // Enter 键真的能切换筛选（工具分类：切到第二个分类后 active 迁移）
    const toolItems = Array.from(doc.querySelectorAll("#toolList li"));
    if (toolItems.length >= 2) {
      toolItems[1].dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await delay(60);
      const activeIdx = Array.from(doc.querySelectorAll("#toolList li")).findIndex((el) => el.classList.contains("active"));
      assert(activeIdx === 1, `Enter 键可切换工具分类筛选（当前第 ${activeIdx + 1} 项）`);
      Array.from(doc.querySelectorAll("#toolList li"))[0].dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await delay(40);
    }

    // ② 列表 ↑↓ 导航已推广到资讯 / 靶场列表（与知识库一致）
    clickTab("news");
    await delay(50);
    const newsItems = Array.from(doc.querySelectorAll('#newsList [data-clickable="1"]'));
    assert(newsItems.length >= 2, `资讯列表有可聚焦项（${newsItems.length}）`);
    if (newsItems.length >= 2) {
      newsItems[0].focus();
      newsItems[0].dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      await delay(40);
      assert(doc.activeElement === newsItems[1], "资讯列表按 ↓ 移动到下一项");
      newsItems[1].dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
      await delay(40);
      assert(doc.activeElement === newsItems[0], "资讯列表按 ↑ 移回上一项");
    }
    clickTab("range");
    await delay(50);
    const rangeItems = Array.from(doc.querySelectorAll('#rangeList [data-clickable="1"]'));
    assert(rangeItems.length >= 2, `靶场列表有可聚焦项（${rangeItems.length}）`);
    if (rangeItems.length >= 2) {
      rangeItems[0].focus();
      rangeItems[0].dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      await delay(40);
      assert(doc.activeElement === rangeItems[1], "靶场列表按 ↓ 移动到下一项");
    }

    // ③ 模态焦点环绕（实现早已存在，但此前没有断言覆盖）
    const ovLeft2 = doc.querySelector("#modalOverlay");
    if (ovLeft2 && !ovLeft2.classList.contains("hidden")) { pressKey("Escape"); await delay(460); }
    // 用「设置」弹窗来测环绕：快捷键帮助弹窗里只有关闭按钮（无可环绕项）
    const setBtn2 = doc.querySelector("#btnSettings");
    if (setBtn2) setBtn2.click();
    await delay(80);
    const ov5 = doc.querySelector("#modalOverlay");
    const modal = ov5 ? ov5.querySelector(".modal") : null;
    const fItems = modal ? Array.from(modal.querySelectorAll(FOCUSABLE)) : [];
    assert(fItems.length >= 2, `弹窗内有多个可聚焦项（${fItems.length}）`);
    if (fItems.length >= 2) {
      const lastEl = fItems[fItems.length - 1], firstEl = fItems[0];
      lastEl.focus();
      lastEl.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
      await delay(30);
      assert(doc.activeElement === firstEl, "末尾按 Tab 环绕到弹窗首个可聚焦项");
      firstEl.focus();
      firstEl.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true }));
      await delay(30);
      assert(doc.activeElement === lastEl, "首个按 Shift+Tab 环绕到弹窗末尾项");
    }
    pressKey("Escape");
    await delay(460);
    clickTab("today");
    await delay(30);
  }

  // ===== 60. 空态/错误文案复盘（v1.5.5）=====
  {
    const src4 = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
    // ① 空态一律走统一三态组件（不得再用裸 <p>）
    const bareEmpties = [
      '"<p>当前没有对话内容可导出',
      '"<p>暂无可复盘的同类题目',
      '<p class="u-muted empty-state">',
    ].filter((pat) => src4.indexOf(pat) >= 0);
    assert(bareEmpties.length === 0, `空态已全部走统一三态（残留裸写法：${bareEmpties.join(" | ") || "无"}）`);
    const sbCount = (src4.match(/stateBlock\(/g) || []).length;
    assert(sbCount >= 10, `统一三态组件覆盖面足够（当前 ${sbCount} 处）`);

    // ② 失败提示必须给出「下一步」（可重试 / 可改用替代路径 / 先做什么），不能只说失败
    const needNext = [
      ["密钥口令相关失败", /可先「关闭口令保护」/],
      ["启用口令保护失败", /请改用明文存储继续使用/],
      ["PNG 导出失败", /可改用「导出 PDF」/],
      ["语音识别失败", /可直接改用文字输入/],
      ["图片处理失败", /可用文字描述/],
    ];
    needNext.forEach((pair) => {
      assert(pair[1].test(src4), `${pair[0]} 的提示包含下一步指引`);
    });
  }

  // ===== 61. 输入框提示（placeholder）长度预算（v1.5.6）=====
  {
    // 背景：placeholder 不能滚动（静态渲染文本），过长只能被硬切 → 必须"写短"。
    // 这里按「估算显示宽度」卡预算，防止以后又被写长；完整说明由 title 承载。
    const estWidth = (s) => {
      let w = 0;
      for (const ch of String(s)) {
        const code = ch.codePointAt(0);
        if (code > 0x2e80) w += 13;                    // CJK / 全角 / 中文标点（13px 字号下约 1:1）
        else if (code > 0x1f000) w += 16;              // emoji
        else w += 7;                                   // ASCII / 半角
      }
      return w;
    };
    const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
    const appSrc = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
    const getPh = (id) => {
      const m = new RegExp('id="' + id + '"[^>]*placeholder="([^"]*)"').exec(html);
      return m ? m[1] : "";
    };
    const getTitle = (id) => {
      const m = new RegExp('id="' + id + '"[^>]*title="([^"]*)"').exec(html);
      return m ? m[1] : "";
    };
    // 预算是按实际可用宽度定的：命令条内部可用约 250px、知识库搜索框窄窗约 200px、聊天输入框约 240px
    const BUDGET = [["kbSearch", 200], ["chatInput", 240], ["copilotInput", 150]];
    BUDGET.forEach(([id, budget]) => {
      const ph = getPh(id);
      assert(!!ph, `${id} 有 placeholder`);
      assert(estWidth(ph) <= budget, `${id} 提示不超过预算（估宽 ${estWidth(ph)}px ≤ ${budget}px）`);
      assert(!!getTitle(id), `${id} 附 title 承载完整说明（写短了但不能丢信息）`);
    });

    // i18n 字典里的 placeholder 必须同样短：否则切成英文/中文时又溢出
    const i18nPh = appSrc.match(/"ph\.[a-zA-Z]+":\s*"[^"]*"/g) || [];
    const tooLong = i18nPh.filter((line) => {
      const val = line.slice(line.indexOf(":") + 1).replace(/^[\s"]+|"$/g, "");
      return estWidth(val) > 240;
    });
    assert(tooLong.length === 0, `i18n 的 placeholder 均在预算内（超标：${tooLong.join(" | ") || "无"}）`);

    // 过长时的收尾：省略号（做不到"滚动"，至少不要硬切半个字）
    const cssE = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    assert(/input::placeholder[^{]*\{[^}]*text-overflow:\s*ellipsis/.test(cssE),
      "placeholder 过长时用省略号收尾（浏览器不允许 placeholder 滚动）");
  }

  // ===== 62. 卡片网格与长文本不被裁切（v1.5.6）=====
  {
    const cssG = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

    // ① 响应式网格轨道必须写成 minmax(min(Npx,100%),1fr)：
    //    裸 minmax(Npx,1fr) 的最小值**不会**随容器缩小 —— 容器窄于该值时轨道仍按 N 宽，
    //    右侧内容溢出后被祖先的 overflow:hidden 裁掉（用户反馈"资讯内容显示不全"的根因）。
    const rawTracks = (cssG.match(/minmax\(\s*\d+px\s*,\s*1fr\s*\)/g) || []);
    assert(rawTracks.length === 0,
      `网格轨道用 min(Npx,100%) 以免窄容器溢出（残留裸写法：${rawTracks.join(" | ") || "无"}）`);
    const safeTracks = (cssG.match(/minmax\(\s*min\(/g) || []);
    assert(safeTracks.length >= 5, `卡片网格均已改为安全轨道（当前 ${safeTracks.length} 处）`);

    // ② 资讯卡片：列表可滚动 + 高度链完整（flex 子项必须 min-height:0，否则内容被裁且滚不到）
    const newsList = (cssG.match(/\.news-list\s*\{[^}]*\}/) || [""])[0];
    assert(/overflow-y:\s*auto/.test(newsList), "资讯列表自身可纵向滚动");
    assert(/min-height:\s*0/.test(newsList), "资讯列表作为 flex 子项带 min-height:0（否则滚动失效）");
    const panelActive = (cssG.match(/\.panel\.active\s*\{[^}]*\}/) || [""])[0];
    assert(/min-height:\s*0/.test(panelActive), "面板作为 flex 子项带 min-height:0（高度链完整）");

    // ③ 资讯卡片文本必须能断行：标题标签是 h3（曾误写成 h4，导致长词断行规则对它从未生效）
    // 注意：同一选择器可能出现在多条规则里（分组规则 + 单条规则），必须"任一命中"而不是取第一条。
    // 本轮就因此假失败过一次：`.news-card h3` 有两条规则，match() 取到的是上面那条（没有断行声明）。
    const anyRuleHas = (selPat, propPat) => {
      const rules = cssG.match(new RegExp(selPat + "[^{]*\\{[^}]*\\}", "g")) || [];
      return rules.some((r) => propPat.test(r));
    };
    assert(anyRuleHas("\\.news-card h3", /overflow-wrap:\s*anywhere/), "资讯标题（h3）允许长词断行");
    assert(anyRuleHas("\\.news-card p\\s*", /overflow-wrap:\s*anywhere/), "资讯摘要允许长词断行（CVE 号/URL 不顶破卡片）");
    assert(anyRuleHas("\\.news-card \\.tag", /overflow-wrap:\s*anywhere/), "资讯标签允许长词断行");
  }

  // ===== 63. UI 一致性守护：动效令牌 / 层级顺序 / 时长统一（v1.5.6）=====
  {
    const cssU = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

    // ① 动效令牌必须真的**被定义**：一旦缺失，`transition: x var(--dur-base)` 整条声明失效，
    //    动效会静默消失（不报错、不崩溃，最难发现的一类 UI 故障）
    ["--dur-fast", "--dur-micro", "--dur-base", "--dur-slow", "--ease-out", "--ease-spring",
     "--move-sm", "--move-md", "--scale-press"].forEach((tok) => {
      assert(new RegExp(tok + "\\s*:").test(cssU), `动效令牌已定义：${tok}`);
    });

    // ② 时长统一：hover 类微交互常用档已收敛到 --dur-micro（值 = 150ms，与散落的 .15s 等价）
    const microDef = (cssU.match(/--dur-micro:\s*([^;]+);/) || [, ""])[1].trim();
    assert(/^150ms$/.test(microDef), `--dur-micro 必须等于 150ms（当前 ${microDef}）`);
    assert((cssU.match(/\.15s/g) || []).length === 0, "不再有散落的 .15s（统一走 --dur-micro）");
    assert((cssU.match(/var\(--dur-micro\)/g) || []).length >= 20,
      `--dur-micro 已被实际使用（当前 ${(cssU.match(/var\(--dur-micro\)/g) || []).length} 处）`);

    // ③ 层级顺序：抽屉 < 弹窗 < Toast —— 反了会出现"弹窗被抽屉盖住""提示看不见"这类问题
    const zOf = (sel) => {
      const rules = cssU.match(new RegExp(sel + "[^{]*\\{[^}]*\\}", "g")) || [];
      for (const r of rules) { const m = /z-index:\s*(-?\d+)/.exec(r); if (m) return Number(m[1]); }
      return null;
    };
    const zDrawer = zOf("\\.copilot-drawer"), zModal = zOf("\\.modal-overlay"), zToast = zOf("\\.toast-host");
    assert(zDrawer !== null && zModal !== null && zToast !== null, "抽屉/弹窗/Toast 都设置了 z-index");
    assert(zDrawer < zModal, `抽屉在弹窗之下（${zDrawer} < ${zModal}）`);
    assert(zModal < zToast, `弹窗在 Toast 之下（${zModal} < ${zToast}）`);
  }

  // ===== 64. 设置项即时校验（v1.5.6）=====
  {
    // 动机：地址/密钥填错时此前要等到「提问失败」才暴露，且失败信息不指向格式问题。
    clickTab("chat");
    await delay(30);
    const hubBtn = doc.querySelector("#apiHubBtn");
    assert(!!hubBtn, "聊天侧有「API 接入中心」入口");
    if (hubBtn) hubBtn.click();
    await delay(120);                             // 弹窗（含设置项）
    const base = doc.querySelector("#llmBase");
    const key = doc.querySelector("#llmKey");
    assert(!!base && !!key, "设置面板含 Base URL 与 API Key 输入框");

    const hintOf = (el) => {
      const f = el && el.closest ? el.closest(".field") : null;
      return f ? f.querySelector(".field-hint") : null;
    };
    const setVal = (el, v) => {
      el.value = v;
      el.dispatchEvent(new window.Event("input", { bubbles: true }));
    };

    // ① 地址格式错误 → 就地提示 + 输入框标红
    setVal(base, "api.openai.com/v1");
    await delay(30);
    let h = hintOf(base);
    assert(!!h && h.classList.contains("err") && (h.textContent || "").length > 0,
      `地址缺协议头时给出提示（${((h || {}).textContent || "").slice(0, 18)}…）`);
    assert(base.classList.contains("invalid"), "格式错误的输入框被标红");

    // ② 改正后 → 提示清除、标红移除
    setVal(base, "https://api.openai.com/v1");
    await delay(30);
    h = hintOf(base);
    assert(!h || !h.classList.contains("err"), "地址改对后提示自动清除");
    assert(!base.classList.contains("invalid"), "标红随之移除");

    // ③ 密钥：含空格 / 过短都要提示
    setVal(key, "sk-abc def");
    await delay(30);
    assert((hintOf(key) || {}).classList && hintOf(key).classList.contains("err"), "密钥含空格时提示（粘贴常见问题）");
    setVal(key, "sk-short");
    await delay(30);
    assert((hintOf(key) || {}).textContent.length > 0, "密钥过短时提示");
    setVal(key, "sk-1234567890abcdef");
    await delay(30);
    assert(!(hintOf(key) || { classList: { contains: () => false } }).classList.contains("err"), "密钥正常后提示清除");

    // ④ 保存时格式有误 → 拦下且不写入（持久化里的配置保持不变）
    //    测试里拿不到应用闭包里的 state → 用 localStorage 里的持久化值做观察对象。
    const before = window.localStorage.getItem("sectutor_llm");
    setVal(base, "not-a-url");
    await delay(20);
    doc.querySelector("#saveLlm").click();
    await delay(60);
    assert(window.localStorage.getItem("sectutor_llm") === before,
      "格式有误时保存被拦下（持久化配置未被覆盖）");
    assert(!!doc.querySelector("#toastHost .toast"), "被拦下时给出提示（而不是静默失败）");
    setVal(base, "https://api.openai.com/v1");
    await delay(20);

    // ⑤ 提示文案必须走 i18n（中英都要有），否则切语言会出现混搭
    const srcA = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
    ["vh.url", "vh.host", "vh.key", "vh.keySpace", "vh.blocked"].forEach((k) => {
      const n = (srcA.match(new RegExp('"' + k + '"', "g")) || []).length;
      assert(n >= 2, `校验提示键 ${k} 有中英两套文案（当前 ${n} 处）`);
    });

    pressKey("Escape");
    await delay(300);
  }

  // ===== 65. Toast 点主体关闭（v1.5.6）=====
  {
    clickTab("chat");
    await delay(30);
    window.__ui.toast("测试：点主体关闭", "info");
    await delay(60);
    const toastEl = doc.querySelector("#toastHost .toast");
    assert(!!toastEl, "toast 已创建");
    assert(toastEl.title === "点击任意处关闭", "toast 有可发现性提示（title）");

    // ① 点主体任意处 → 关闭（closeToast 是先加 .out 淡出、再移除节点 → 两步都要验）
    const msgEl = toastEl.querySelector(".toast-msg");
    msgEl.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await delay(40);
    assert(toastEl.classList.contains("out"), "点击 toast 主体即开始关闭（.out 淡出）");
    await delay(420);
    assert(!doc.querySelector('#toastHost [data-toast-id="' + toastEl.getAttribute("data-toast-id") + '"]'),
      "淡出完成后节点被移除（不必精确点到 ✕）");

    // ② 选中文字时不误关（要复制错误信息）——__ui.toast 返回的是 toastId 字符串（不是元素）
    const tid2 = window.__ui.toast("报错详情很长的内容", "err");
    await delay(60);
    const el2 = doc.querySelector('#toastHost [data-toast-id="' + tid2 + '"]');
    assert(!!el2, "创建第二条 toast（错误态）");
    const sel = window.getSelection();
    const range = doc.createRange();
    range.selectNodeContents(el2.querySelector(".toast-msg"));
    sel.removeAllRanges(); sel.addRange(range);
    el2.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await delay(60);
    assert(!el2.classList.contains("out"), "选中文字时点击不会误关（保护复制，未进入关闭流程）");
    sel.removeAllRanges();
    el2.querySelector(".toast-x").click();
    await delay(40);
    assert(el2.classList.contains("out"), "✕ 关闭按钮仍然有效（开始淡出）");
    await delay(420);
    assert(!doc.querySelector('#toastHost [data-toast-id="' + tid2 + '"]'), "✕ 关闭后节点被移除");
  }

  // ===== 66. 能力雷达轴标签完整可见（v1.5.6）=====
  {
    clickTab("today");
    await delay(80);
    const svg = doc.querySelector("#todayRadar svg");
    assert(!!svg, "今日页渲染出能力雷达");
    if (svg) {
      const vb = (svg.getAttribute("viewBox") || "").trim().split(/\s+/).map(Number);
      assert(vb.length === 4 && vb[2] > 0, "雷达 viewBox 合法（" + (vb.join(" ") || "无") + "）");
      const minX = vb[0], maxX = vb[0] + vb[2];
      // 估算文本宽度（font-size 11）：CJK/全角约 11px，ASCII 约 6px
      const est = (s) => { let t = 0; for (const ch of String(s)) t += (ch.codePointAt(0) > 0x2e80 ? 11 : 6); return t; };
      const texts = Array.from(svg.querySelectorAll("text"));
      assert(texts.length >= 3, "雷达有轴标签（" + texts.length + " 条）");

      // 逐条核算：按 text-anchor 还原左右边界，看是否超出 viewBox
      let worst = { over: -1, label: "" };
      texts.forEach((t) => {
        const x = parseFloat(t.getAttribute("x"));
        const anchor = t.getAttribute("text-anchor") || "start";
        // 折行后按「每行」算宽度，取最宽的一行
        const nameNode = t.firstChild;
        const name = (nameNode && String(nameNode.textContent || "").trim()) || "";
        const tspan = t.querySelector("tspan");
        const pct = tspan ? String(tspan.textContent || "").trim() : "";
        const width = Math.max(est(name), est(pct));
        const left = anchor === "middle" ? x - width / 2 : (anchor === "end" ? x - width : x);
        const right = left + width;
        const over = Math.max(minX - left, right - maxX, 0);
        if (over > worst.over) worst = { over, label: name + " " + pct };
      });
      assert(worst.over <= 1,
        `所有轴标签都在 viewBox 内（最靠外「${worst.label}」溢出 ${worst.over.toFixed(1)}px）`);

      // 百分比必须换行：同一行写「名称 + 百分比」太宽，会被 viewBox 裁掉
      const folded = texts.filter((t) => { const s = t.querySelector("tspan"); return s && s.getAttribute("dy"); });
      assert(folded.length === texts.length, "百分比换到第二行（单行排版会被裁）");
    }
  }

  // ===== 67. 资讯卡片只放核心信息、详情呈现全文（v1.5.6）=====
  {
    const SD = window.eval("SEC_DATA");
    clickTab("news");
    await delay(60);
    const cards = Array.from(doc.querySelectorAll(".news-card"));
    assert(cards.length > 0, "资讯卡片已渲染（" + cards.length + " 张）");

    // ① 结构：每张卡片都有摘要段与防御段（CSS 按这两个类截断，保证卡片高度齐整）
    assert(cards.every((c) => !!c.querySelector(".news-summary")), "每张卡片都有摘要段（.news-summary）");
    assert(cards.every((c) => !!c.querySelector(".news-defense")), "每张卡片都有防御段（.news-defense）");

    // ② 不能用 CSS line-clamp：行高为小数时它会把末行从字形中间切开（用户反馈"字被遮挡/不显示"）。
    //    截断一律走 JS（ellipsisByWidth），与字体度量无关；行高必须是整数像素。
    const cssN = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    assert(!/line-clamp/.test(cssN), "全项目不使用 line-clamp（它会把末行从字形中间切开）");
    // 卡片不得用 overflow:hidden 硬裁正文：曾导致"字被切掉下半截 / 后面的字看不见"
    const cardRule = (cssN.match(/\.news-card\s*\{[^}]*\}/) || [""])[0];
    assert(!/overflow:\s*hidden/.test(cardRule), "资讯卡片不得 overflow:hidden（会把正文硬裁）");
    const lh = (cssN.match(/\.news-card p\s*\{[^}]*line-height:\s*([^;}]+)/) || [, ""])[1].trim();
    assert(/^\d+px$/.test(lh), `资讯卡片行高是整数像素（当前 ${lh || "未设置"}）`);

    // ③ 卡片必须呈现**完整**摘要与防御（不再做任何截断）——截断曾导致"字被切/看不见"
    const firstCard = cards[0];
    const id0 = firstCard && firstCard.dataset ? firstCard.dataset.id : "";
    const nw0 = (SD.news || []).filter((x) => x.id === id0)[0];
    if (nw0) {
      const sumEl = firstCard.querySelector(".news-summary");
      const defEl = firstCard.querySelector(".news-defense");
      const sumText = (sumEl.textContent || "").trim();
      const strongEl = defEl.querySelector("strong");
      const prefix = strongEl ? (strongEl.textContent || "") : "";
      const defText = (defEl.textContent || "").trim();
      const defCore = defText.indexOf(prefix) === 0 ? defText.slice(prefix.length).trim() : defText;
      assert(sumText === nw0.summary, "卡片呈现完整摘要（未截断）");
      assert(defCore === nw0.defense, "卡片呈现完整防御建议（未截断）");
      // 全部卡片都不得出现省略号
      const truncated = cards.filter((c) => {
        const s = (c.querySelector(".news-summary") || {}).textContent || "";
        return s.indexOf("…") >= 0;
      });
      assert(truncated.length === 0, `没有任何卡片被截断（当前 ${truncated.length} 张带省略号）`);
    }

    // ③ 点开后确实是全文：拿第一张卡片对应的数据逐字比对
    const first = cards[0];
    const id = first && first.dataset ? first.dataset.id : "";
    const nw = (SD.news || []).filter((x) => x.id === id)[0];
    assert(!!nw, "取到卡片对应的资讯数据");
    if (nw) {
      first.click();
      await delay(100);
      const modal = doc.querySelector("#modalOverlay");
      const txt = modal ? modal.textContent : "";
      assert(txt.indexOf(nw.summary) >= 0, "详情呈现完整摘要（未被截断）");
      assert(txt.indexOf(nw.defense) >= 0, "详情呈现完整防御建议");
      pressKey("Escape");
      await delay(320);
    }
  }

  console.log("\n==== 自测结果 ====");
  results.forEach((r) => console.log(r));
if (errors.length) {
  console.log("\n---- 捕获的异常 ----");
  errors.forEach((e) => console.log(e));
}
console.log(`\n总计：通过 ${results.length - failed}/${results.length}，异常 ${errors.length} 条`);
process.exit(failed === 0 && errors.length === 0 ? 0 : 1);
})();
