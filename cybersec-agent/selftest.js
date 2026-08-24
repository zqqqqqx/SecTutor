/* SecTutor 自测：用 jsdom 加载页面并模拟交互，捕获运行时异常与逻辑断言 */
const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("C:/Users/ZQX/.workbuddy/binaries/node/workspace/node_modules/jsdom");

const dir = "C:/Users/ZQX/Desktop/NewAgent/cybersec-agent";
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
if (typeof window.fetch === "undefined") window.fetch = function () { return Promise.reject(new Error("no fetch in test harness")); };

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
const optBtn = $$("#quizMain .quiz-opt").find((b) => b.textContent.replace(/^\d+\.\s*/, "").trim() === ansText);
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
  assert($$("#modalOverlay .api-tabs .chip").length === 4, "含 4 个接入 Tab（LLM/情报/MCP/隐私）");
  const intelTab = $$("#modalOverlay .api-tabs .chip").find((b) => b.dataset.atab === "intel");
  if (intelTab) intelTab.click();
  const intelPane = $("#modalOverlay .api-pane[data-pane='intel']");
  assert(intelPane && !intelPane.classList.contains("hidden"), "可切换到「威胁情报（预留）」面板");
  $("#modalClose").click();
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
  assert($("#modalOverlay").classList.contains("hidden"), "点击搜索结果关闭弹窗并跳转");
  $("#btnReview").click();
  assert(!$("#modalOverlay").classList.contains("hidden"), "复习提醒弹窗打开");
  assert(!!$("#revStartBtn") || !!$("#modalBody .rev-empty"), "复习提醒含开始按钮或空态提示");
  $("#modalClose").click();
  assert($("#modalOverlay").classList.contains("hidden"), "复习提醒弹窗可关闭");
  $("#btnSettings").click();
  assert(!!$("#setPdf") && !!$("#setReset"), "设置弹窗含导出计划与重置入口");
  const themeBeforeSet = doc.documentElement.getAttribute("data-theme");
  const otherChip = $$("#modalBody .chip[data-th]").find((b) => b.getAttribute("data-th") !== themeBeforeSet);
  if (otherChip) otherChip.click();
  assert(doc.documentElement.getAttribute("data-theme") !== themeBeforeSet, "设置弹窗可切换主题");
  $("#modalClose").click();
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

  console.log("\n==== 自测结果 ====");
  results.forEach((r) => console.log(r));
if (errors.length) {
  console.log("\n---- 捕获的异常 ----");
  errors.forEach((e) => console.log(e));
}
console.log(`\n总计：通过 ${results.length - failed}/${results.length}，异常 ${errors.length} 条`);
process.exit(failed === 0 && errors.length === 0 ? 0 : 1);
})();
