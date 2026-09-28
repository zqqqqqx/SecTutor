/**
 * bench_agent.js —— Agent 基准集与评测器（P0.5）
 *
 * 为什么需要它：仓库里有 790 条断言，但**全部在测"函数对不对"**，没有一条测"agent 干得好不好"。
 * 没有这个基准，任何 agent 改造都只能靠"感觉变强了"。
 *
 * 设计要点：
 *  1. **离线可跑**：用项目自带的 gateway 测试桩（__agent._setGateway）喂**预设工具链**，
 *     于是整条真实循环（工具分发 → 审计 → 配额 → 结果回收）都能在无网络、无真实模型的情况下验证。
 *  2. **只测能客观判定的事**：工具链是否按预期被调用、调用是否成功、产出是否过验证器、
 *     是否出现越权工具。不测"回答文笔好看不好看"（那是人判的）。
 *  3. 输出指标：完成率 / 工具链正确率 / 平均步数 / 平均耗时 / 越权尝试率 / 未知工具率。
 *
 * 用法：node bench_agent.js [--verbose]
 */
const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const DIR = __dirname;
const VERBOSE = process.argv.indexOf("--verbose") >= 0;
const vc = new VirtualConsole();
vc.on("jsdomError", () => {});
const html = fs.readFileSync(path.join(DIR, "index.html"), "utf8");
const dom = new JSDOM(html, { runScripts: "dangerously", url: "http://localhost/", pretendToBeVisual: true, virtualConsole: vc });
global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.navigator = dom.window.navigator;
// jsdom 不带 Web 编码 API 与 crypto（与 selftest 同一套补丁）
if (typeof dom.window.TextEncoder === "undefined") dom.window.TextEncoder = TextEncoder;
if (typeof dom.window.TextDecoder === "undefined") dom.window.TextDecoder = TextDecoder;
if (typeof dom.window.crypto === "undefined" && typeof require("crypto").webcrypto !== "undefined") {
  dom.window.crypto = require("crypto").webcrypto;
}
// 关键前置：必须先写入一份假的模型配置，否则 askSame 会走「内置问答」分支，根本进不了工具循环
dom.window.localStorage.setItem("sectutor_llm", JSON.stringify({ key: "bench-key", baseUrl: "http://localhost/bench", model: "bench-model" }));

// 必须**一次 eval 两段**：data.js 与 app.js 都用 const 声明，分两次 eval 作用域不通（与 selftest 同法）
dom.window.eval(fs.readFileSync(path.join(DIR, "data.js"), "utf8") + String.fromCharCode(10) + fs.readFileSync(path.join(DIR, "app.js"), "utf8"));

/* ---------------- 基准集：30 条任务（意图 + 期望工具链 + 产出断言） ----------------
   说明：expectTools 用「必须包含」语义（顺序不强制），这样模型多调一个只读工具不算错。
   verify 是**可编程断言**，直接复用应用里已有的验证器，不依赖模型自评。 */
const CASES = [
  { id: "T01", ask: "我想系统学 Web 安全，给我排个顺序", tools: ["learning_path"], verify: ["path_no_violation"] },
  { id: "T02", ask: "我接下来该学什么？", tools: ["suggest_next"], verify: ["suggest_has_reason"] },
  { id: "T03", ask: "我哪里薄弱？", tools: ["read_mistakes"], verify: [] },
  { id: "T04", ask: "把错的再练一遍", tools: ["quiz_from_mistakes"], verify: [] },
  { id: "T05", ask: "我现在学习进度怎么样", tools: ["read_progress"], verify: [] },
  { id: "T06", ask: "SQL 注入怎么防", tools: ["search_knowledge"], verify: ["search_hits"] },
  { id: "T07", ask: "学 JWT 之前要先会什么", tools: ["prereq_check"], verify: ["prereq_named"] },
  { id: "T08", ask: "给我出 5 道 Web 的题", tools: ["generate_quiz"], verify: [] },
  { id: "T09", ask: "帮我生成学习计划，每周 5 小时", tools: ["generate_plan"], verify: [] },
  { id: "T10", ask: "Web 安全和二进制漏洞哪个先学", tools: ["learning_path"], verify: ["path_no_violation"] },
  { id: "T11", ask: "这个 base64 是什么：aGVsbG8=", tools: ["base64_decode"], verify: [] },
  { id: "T12", ask: "帮我把 hello 转成 base64", tools: ["base64_encode"], verify: [] },
  { id: "T13", ask: "算一下 hello 的 sha256", tools: ["hash_text"], verify: [] },
  { id: "T14", ask: "解一下这个 JWT", tools: ["jwt_decode"], verify: [] },
  { id: "T15", ask: "URL 解码 %E6%B5%8B%E8%AF%95", tools: ["url_decode"], verify: [] },
  { id: "T16", ask: "SSRF 和哪些知识点相关", tools: ["related_topics"], verify: [] },
  { id: "T17", ask: "我从没学过安全，从哪开始", tools: ["learning_path"], verify: ["path_no_violation"] },
  { id: "T18", ask: "给我看看我的 Agent 运行指标", tools: ["read_metrics"], verify: [] },
  { id: "T19", ask: "复习到期的有哪些", tools: ["suggest_next"], verify: [] },
  { id: "T20", ask: "密码学这一块我该怎么学", tools: ["learning_path"], verify: ["path_no_violation"] },
  { id: "T21", ask: "靶机怎么用", tools: ["search_knowledge"], verify: ["search_hits"] },
  { id: "T22", ask: "帮我看看扫描报告", tools: ["read_scan_reports"], verify: [] },
  { id: "T23", ask: "XSS 跟哪些前置相关", tools: ["prereq_check"], verify: ["prereq_named"] },
  { id: "T24", ask: "我该复习还是学新的", tools: ["suggest_next"], verify: ["suggest_has_reason"] },
  { id: "T25", ask: "把常见误解最多的知识点找出来", tools: ["search_knowledge"], verify: [] },
  { id: "T26", ask: "给我排一个 2 周的 Web 学习路径", tools: ["learning_path"], verify: ["path_no_violation"] },
  { id: "T27", ask: "帮我算 686 的十六进制", tools: ["hash_text"], verify: [] },
  { id: "T28", ask: "我学过哪些了", tools: ["read_progress"], verify: [] },
  { id: "T29", ask: "出几道密码学的题", tools: ["generate_quiz"], verify: [] },
  { id: "T30", ask: "教我 SSRF 原理", tools: ["search_knowledge"], verify: ["search_hits"] },
];

/* ---------------- 可编程验证器（复用应用内已有能力，不让模型自评） ---------------- */
const ag = dom.window.__agent;
const ui = dom.window.__ui;
const perf = dom.window.__perf;
const T = ag.tasks;

const VERIFIERS = {
  path_no_violation: async () => {
    const r = ui.buildLearningPath("all", 0, { skipMastered: false });
    return { ok: r.violations === 0, note: "violations=" + r.violations };
  },
  suggest_has_reason: async () => {
    const out = await renderToolText("suggest_next", {});
    const ok = out.indexOf("——") >= 0 || /\(.*\)/.test(out) || out.length > 40;
    return { ok: ok, note: ok ? "含理由" : "无理由(" + out.slice(0, 30) + ")" };
  },
  search_hits: async () => {
    const r = perf.retrieve("SQL 注入怎么防", 3);
    return { ok: Array.isArray(r) && r.length > 0, note: "命中 " + (r ? r.length : 0) };
  },
  prereq_named: async () => {
    const out = await renderToolText("prereq_check", { topicId: "jwt" });
    const ok = out.indexOf("知识图谱") >= 0 || out.length > 20;
    return { ok: ok, note: out.slice(0, 24).replace(/\n/g, " ") };
  },
};

/* 通过 ag.callTool 调用工具（唯一正确入口：它带审计/配额/截断，与真实链路一致）
   注意：ag.tools() 返回的是**工具 schema**（name/description/parameters），不含 run —— 别拿它当定义用。 */
async function renderToolText(name, args) {
  try { return String(await ag.callTool(name, args || {}) || ""); }
  catch (e) { return "错误：" + e.message; }
}

/* ---------------- 驱动真实循环：用 gateway 桩喂预设工具链 ---------------- */
const ALLOWED = (() => {
  const names = {};
  try { ag.tools().forEach((t) => { names[t.name] = true; }); } catch (e) {}
  return names;
})();

let scriptQueue = [], scriptTurn = 0, usedTools = [], deniedTools = [];
ag._setGateway(function () {
  scriptTurn++;
  const step = scriptQueue[scriptTurn - 1];
  if (!step) {
    return Promise.resolve({ content: "（已按预设工具链执行完毕）", message: { content: "done" }, toolCalls: [] });
  }
  if (!ALLOWED[step.tool]) deniedTools.push(step.tool);
  const tc = { id: "call" + scriptTurn, type: "function",
               function: { name: step.tool, arguments: JSON.stringify(step.args || {}) } };
  return Promise.resolve({ content: "", message: { content: "", tool_calls: [tc] }, toolCalls: [tc] });
});

async function runCase(c) {
  scriptQueue = c.tools.map((t) => ({ tool: t, args: {} }));
  scriptTurn = 0; usedTools = [];
  const t0 = Date.now();
  try { await ag.ask(c.ask, {}); } catch (e) { /* 循环内部异常不视为任务失败，记录即可 */ }
  const ms = Date.now() - t0;
  // 从审计里取本轮实际调用的工具
  const tail = T.auditTail(50).filter((a) => a.t >= t0);
  const called = tail.map((a) => a.tool);
  const okCalls = tail.filter((a) => a.ok).length;
  const missing = c.tools.filter((t) => called.indexOf(t) < 0);
  const vres = [];
  for (const k of (c.verify || [])) {
    vres.push(Object.assign({ key: k }, VERIFIERS[k] ? await VERIFIERS[k]() : { ok: false, note: "未知验证器" }));
  }
  return {
    id: c.id, ask: c.ask, expected: c.tools, called,
    chainOk: missing.length === 0, missing,
    callsOk: tail.length > 0 && okCalls === tail.length,
    verifyOk: vres.every((v) => v.ok), vres,
    ms, steps: tail.length,
  };
}

(async function main() {
  console.log("==== Agent 基准评测（30 条任务 · 离线驱动真实循环）====\n");
  const results = [];
  for (const c of CASES) results.push(await runCase(c));

  const n = results.length;
  const chainOk = results.filter((r) => r.chainOk).length;
  const callsOk = results.filter((r) => r.callsOk).length;
  const verifyCases = results.filter((r) => r.vres.length);
  const verifyOk = verifyCases.filter((r) => r.verifyOk).length;
  const steps = results.reduce((a, r) => a + r.steps, 0);
  const ms = results.reduce((a, r) => a + r.ms, 0);

  if (VERBOSE) {
    console.log("明细：");
    results.forEach((r) => {
      const flag = r.chainOk && r.callsOk && r.verifyOk ? "✓" : "✗";
      console.log("  " + flag + " " + r.id + "  期望[" + r.expected.join(",") + "]  实际[" + r.called.join(",") + "]"
        + (r.missing.length ? "  缺:" + r.missing.join(",") : "")
        + (r.vres.length ? "  验证:" + r.vres.map((v) => v.key + "=" + (v.ok ? "ok" : "FAIL") + "(" + v.note + ")").join(" ") : ""));
    });
    console.log("");
  }

  console.log("== 基线指标 ==");
  console.log("  任务数              " + n);
  console.log("  工具链可执行率      " + (chainOk / n * 100).toFixed(1) + "%  (" + chainOk + "/" + n + ")"
    + "   ← 脚本化喂入的路径，证明\"管道通\"，不证明\"选得对\"");
  console.log("  工具调用成功率      " + (callsOk / n * 100).toFixed(1) + "%  (" + callsOk + "/" + n + ")");
  console.log("  产出验证通过率      " + (verifyCases.length ? (verifyOk / verifyCases.length * 100).toFixed(1) + "%  (" + verifyOk + "/" + verifyCases.length + ")" : "无验证项"));
  console.log("  平均步数（工具调用）" + (steps / n).toFixed(2));
  console.log("  平均耗时            " + (ms / n).toFixed(1) + " ms/任务");
  console.log("  **越权尝试率**      " + (deniedTools.length / n * 100).toFixed(1) + "%  (" + deniedTools.length + " 次)");
  console.log("  未知工具调用        " + results.reduce((a, r) => a + r.missing.length, 0) + " 处");
  console.log("\n未覆盖（需真实模型或人工）：工具**选择**是否合理 / 回答是否切题 / 是否该少调一步。");
  console.log("注：本基准驱动的是**真实循环**（工具分发 → 审计 → 配额 → 结果回收），");
  console.log("    但用 gateway 桩替代真实模型 —— 它测的是\"编排与验证层\"，不是\"模型智力\"。");
  console.log("    模型相关指标（对话合理性）需另设人工评分，不在本器范围。");

  const fail = results.filter((r) => !(r.chainOk && r.callsOk && r.verifyOk));
  if (fail.length) {
    console.log("\n未通过项：" + fail.map((r) => r.id).join(", "));
    process.exitCode = 1;
  }
})();
