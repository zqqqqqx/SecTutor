/* 性能与检索质量基准：加载页面 → 计时核心算法 → 计算 P@1 / MRR
   用法：node _bench.js [标签] */
const fs = require("fs");
const path = require("path");
function loadJsdom() {
  try { return require("jsdom"); }
  catch (e) { return require("C:/Users/ZQX/.workbuddy/binaries/node/workspace/node_modules/jsdom"); }
}
const { JSDOM, VirtualConsole } = loadJsdom();
const dir = __dirname;
let html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
const dataJs = fs.readFileSync(path.join(dir, "data.js"), "utf8");
const appJs = fs.readFileSync(path.join(dir, "app.js"), "utf8");
html = html.replace(/<script src="data\.js"><\/script>/, "").replace(/<script src="app\.js"><\/script>/, "");

const vc = new VirtualConsole();
const dom = new JSDOM(html, { runScripts: "dangerously", url: "http://localhost/", pretendToBeVisual: true, virtualConsole: vc });
const { window } = dom;
const doc = window.document;
if (typeof window.fetch === "undefined") window.fetch = function () { return Promise.reject(new Error("no fetch")); };
function inject(code) { const s = doc.createElement("script"); s.textContent = code; doc.body.appendChild(s); }

inject(dataJs);
inject(appJs);
doc.dispatchEvent(new window.Event("DOMContentLoaded", { bubbles: true }));

const label = process.argv[2] || "run";

setTimeout(() => {
  const P = window.__perf;
  if (!P) { console.log("ERROR: window.__perf 未暴露"); process.exit(1); }

  const N_CORPUS = P.corpusSize();
  const topics = P.allTopics();
  const N_TOPICS = topics.length;

  // ---------- 计时工具 ----------
  function timeIt(fn, iters) {
    fn(); // 预热
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < iters; i++) fn();
    const t1 = process.hrtime.bigint();
    return Number(t1 - t0) / 1e6; // ms 总计
  }

  const QUERIES = [
    "SQL 注入怎么防御", "XSS 原理是什么", "缓冲区溢出", "对称加密和非对称加密区别",
    "怎么用 nmap 扫描端口", "CSRF 是什么", "权限提升", "容器逃逸",
    "勒索软件应急响应", "DNS 劫持", "JWT 安全", "最近的漏洞有哪些",
  ];

  const tRetrieve = timeIt(() => { for (const q of QUERIES) P.retrieve(q, 4); }, 200);
  const tAllTopics = timeIt(() => P.allTopics(), 2000);
  const tTokenize = timeIt(() => { for (const q of QUERIES) P.tokenize(q); }, 500);
  const tIntent = timeIt(() => { for (const q of QUERIES) P.detectIntent(q); }, 2000);
  const tMatch = timeIt(() => {
    const q = "注入";
    for (const t of topics) P.matchSearch(t, q);
  }, 300);
  // 相关推荐：对每个知识点算一次（模拟"打开详情"热点）
  const tRelated = timeIt(() => { for (const t of topics) P.relatedDocs(t); }, 20);

  // ---------- 检索质量：P@1 / MRR ----------
  // ground truth：以知识点名称作为查询，期望对应文档排第一
  let hit1 = 0, rrSum = 0, n = 0;
  const easyMisses = [];
  for (const t of topics) {
    const q = t.name;
    const res = P.retrieve(q, 10);
    const want = "topic:" + t.id;
    const idx = res.findIndex((d) => d.id === want);
    n++;
    if (idx === 0) hit1++;
    rrSum += idx >= 0 ? 1 / (idx + 1) : 0;
    if (idx !== 0) {
      // 标注歧义：若首位是一个「同名知识点」（数据里的重复条目），不算算法失败
      const top = res[0];
      const ambiguous = top && top.id !== want && top.title === t.name;
      easyMisses.push((ambiguous ? "  ~ 歧义 " : "  ✗ 真失败 ") + "「" + t.name + "」(" + t.id + ") 首位: " + (top ? top.id + "(" + top.title + ")" : "无"));
    }
  }
  const p1 = (hit1 / n) * 100;
  const mrr = (rrSum / n) * 100;

  console.log("==== 基准 [" + label + "] ====");
  console.log("语料文档数: " + N_CORPUS + " | 知识点数: " + N_TOPICS);
  console.log("");
  console.log("-- 耗时（总计 ms）--");
  console.log("retrieve   x" + (200 * QUERIES.length) + " 次: " + tRetrieve.toFixed(1));
  console.log("allTopics  x2000 次: " + tAllTopics.toFixed(1));
  console.log("tokenize   x" + (500 * QUERIES.length) + " 次: " + tTokenize.toFixed(1));
  console.log("detectIntent x" + (2000 * QUERIES.length) + " 次: " + tIntent.toFixed(1));
  console.log("matchSearch x" + (300 * N_TOPICS) + " 次: " + tMatch.toFixed(1));
  console.log("relatedDocs x" + (20 * N_TOPICS) + " 次: " + tRelated.toFixed(1));
  console.log("");
  console.log("-- 检索质量 A：标题原文查询（" + n + " 条，简单场景）--");
  console.log("P@1: " + p1.toFixed(1) + "%   MRR: " + mrr.toFixed(1) + "%");
  if (easyMisses.length) { console.log("未命中首位："); easyMisses.slice(0, 10).forEach((m) => console.log(m)); }

  // ---------- 检索质量 B：人工标注的「改写查询」（不含标题原文，真正考验算法） ----------
  const HARD = [
    ["攻击者让受害者的浏览器执行恶意脚本从而窃取 cookie", ["xss"]],
    ["在登录框里拼接数据库查询语句绕过身份验证", ["sqli"]],
    ["诱导已登录用户访问恶意页面，借用其身份发起请求", ["csrf"]],
    ["让服务器代为请求内网地址来探测内部服务", ["ssrf"]],
    ["上传木马文件到服务器进而获取权限", ["upload"]],
    ["函数调用栈里的返回地址被覆盖改写", ["stack", "mitigations", "rop"]],
    ["内存块被释放之后指针仍然被继续使用", ["uaf"]],
    ["用私钥签名、公钥验签的非对称体系", ["asym", "pki"]],
    ["每次加密都复用同一个初始向量会带来什么风险", ["blockmode", "crypto-misuse"]],
    ["已经拿到普通用户权限，如何进一步提权到系统管理员", ["privesc", "priv-esc"]],
    ["拿下内网一台机器后继续扩散控制其他主机", ["lateral", "net-lateral"]],
    ["容器里的进程突破隔离拿到了宿主机权限", ["container-escape"]],
    ["集群里 Pod 的服务账号权限配置过大", ["k8s", "iam"]],
    ["文件被加密勒索了应该怎么处理", ["ir"]],
    ["想摸清目标公司暴露在外的域名和子域名", ["recon", "osint"]],
    ["批量探测目标开放了哪些端口和服务版本", ["scan", "port-scan"]],
    ["篡改域名解析结果把用户引到假冒网站", ["arp-dns"]],
    ["令牌可以被随意伪造，服务端没有校验签名", ["jwt", "auth"]],
    ["随机数序列可以被预测导致密钥被推算出来", ["rand"]],
    ["在没有授权的情况下读取到别人的订单数据", ["idor", "api-sec"]],
  ];
  let h1 = 0, h4 = 0, h5 = 0, hrr = 0;
  const misses = [];
  for (const [q, want] of HARD) {
    const res = P.retrieve(q, 10);
    const rank = res.findIndex((d) => want.includes(d.id.replace(/^topic:/, "")));
    if (rank === 0) h1++;
    if (rank >= 0 && rank < 4) h4++;   // RAG 实际取 top-4，这是最关键的指标
    if (rank >= 0 && rank < 5) h5++;
    hrr += rank >= 0 ? 1 / (rank + 1) : 0;
    if (rank !== 0) misses.push("  ✗ 「" + q.slice(0, 22) + "…」期望 " + want.join("/") + "，实际首位: " + (res[0] ? res[0].id + "(" + res[0].title + ")" : "无"));
  }
  console.log("");
  console.log("-- 检索质量 B：改写查询（" + HARD.length + " 条人工标注，困难场景）--");
  console.log("P@1: " + (h1 / HARD.length * 100).toFixed(1) + "%   P@4(RAG实取): " + (h4 / HARD.length * 100).toFixed(1) + "%   P@5: " + (h5 / HARD.length * 100).toFixed(1) + "%   MRR: " + (hrr / HARD.length * 100).toFixed(1) + "%");
  if (misses.length) { console.log("未命中首位："); misses.slice(0, 8).forEach((m) => console.log(m)); }
  process.exit(0);
}, 800);
