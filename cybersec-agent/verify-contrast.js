#!/usr/bin/env node
/* 对比度检查（唯一实现）：直接解析 styles.css 里的真实主题令牌并实算 WCAG 对比度。
 *
 * 为什么改成从 CSS 解析：
 *   早先的 Python 版把颜色**硬编码**在脚本里，改了 tokens 它不会察觉 —— 检查器与真实样式会漂移。
 *   现在令牌取自 styles.css，颜色一改检查跟着变，`npm test` 即可拦住对比度回归。
 *
 * 阈值：
 *   文本 4.5:1（WCAG AA 正文）｜ 非文本 3:1（焦点指示器 2.4.13 / 控件边界 1.4.11）
 *   装饰性分隔线不适用上述阈值，仅作信息级输出（只看"能否看出边界"）。
 *
 * 用法：node verify-contrast.js        # 输出表格；有失败则退出码 1
 */
const fs = require("fs");
const path = require("path");

// 解析前先剥掉注释：主题块内的说明注释里含中文冒号（如「浅色：冷灰绿底」），
// 按 ; 切声明时会把注释里的冒号误当成键值分隔符，导致令牌全部解析失败（实测踩过）
const CSS = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/* ---------- 取色与对比度 ---------- */
function parseColor(v) {
  const s = String(v || "").trim();
  let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (m) {
    let h = m[1];
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
  }
  m = /^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*(?:[,/]\s*([\d.]+)\s*)?\)$/i.exec(s);
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
  return null;
}
function over(fg, bg) {                       // 半透明前景压在背景上的等效色
  if (!fg) return null;
  if (fg.a >= 1) return fg;
  return { r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 };
}
function hex(c) {
  const f = (x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, "0");
  return "#" + f(c.r) + f(c.g) + f(c.b);
}
function lum(c) {
  const ch = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
  return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
}
function ratio(a, b) {
  const la = lum(a), lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/* ---------- 解析 styles.css 的主题令牌 ---------- */
function tokensOf(blockText, inherited) {
  const out = Object.assign({}, inherited);
  blockText.split(";").forEach((decl) => {
    const i = decl.indexOf(":");
    if (i < 0) return;
    const k = decl.slice(0, i).trim();
    const v = decl.slice(i + 1).trim();
    if (k.indexOf("--") === 0) out[k] = v;
  });
  return out;
}
function blockBody(selectorPattern) {
  // 收集「同选择器的所有块」并拼接（按文档顺序，后者覆盖前者 —— 与同优先级下的层叠一致）。
  // 两个必须注意的点（都实测踩过）：
  //  ① 同一选择器可能被拆成多块（[data-theme="light"] 就有"调色块"与"surface-* 块"），只取第一块会漏令牌；
  //  ② 块体必须用 [^{}]* 限定 —— 若写成 [\s\S]*?\n}（要求 } 前有换行）：
  //     单行规则匹配不到，而且非贪婪匹配会**跨越规则边界**，把下一条规则的内容吞进来
  //     （实测：深色 surface 块吞到了浅色块的值 → 深色主题算出一堆浅色底）。
  const lit = selectorPattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(lit + "\\s*\\{([^{}]*)\\}", "gm");
  const parts = [];
  let m;
  while ((m = re.exec(CSS)) !== null) parts.push(m[1]);
  return parts.join("\n");
}
const lightBody = blockBody(':root, [data-theme="light"]') + "\n" + blockBody('[data-theme="light"] {'.slice(0, -1))
  + "\n" + blockBody('[data-theme="light"]');            // surface-* 令牌在另一块里
const darkBody = blockBody('[data-theme="dark"], :root:not([data-theme])')
  + "\n" + blockBody(':root, [data-theme="dark"]');      // surface-* 令牌在另一块里

const THEMES = [
  { id: "light", label: "浅色（data-theme=light）", tokens: tokensOf(lightBody) },
  { id: "dark", label: "深色 / 默认（data-theme=dark 与 :root 无 data-theme）", tokens: tokensOf(darkBody) },
];

// 抽屉/气泡的不透明度取自 CSS（--cp-tint / --cp-bubble，或 var(..., NN%) 的兜底值），改透明度自动重算
function alphaOf(name) {
  const m = new RegExp("--" + name + ":\\s*(\\d+(?:\\.\\d+)?)%").exec(CSS) ||
            new RegExp("var\\(--" + name + ",\\s*(\\d+(?:\\.\\d+)?)%\\)").exec(CSS);
  return m ? Number(m[1]) / 100 : 1;
}
const TINT_ALPHA = alphaOf("cp-tint");
const BUBBLE_ALPHA = alphaOf("cp-bubble");

/* ---------- 检查项定义 ---------- */
// ctx: bg=页面底色  panel=玻璃卡片（半透明已压底）  panel2=实色面板  brand=主色填充
function resolve(tk, name, base) {
  const c = parseColor(tk[name]);
  if (!c) return null;
  return base ? over(c, base) : c;
}
function buildPairs(tk) {
  const bg = resolve(tk, "--bg");
  const panel = over(parseColor(tk["--panel"]), bg) || bg;
  const panel2 = over(parseColor(tk["--panel-2"]), bg) || bg;
  const brand = parseColor(tk["--brand"]);
  const brandSoft = over(parseColor(tk["--brand-soft"]), panel) || panel;
  const badBg = over(parseColor(tk["--bad-bg"]), panel) || panel;
  const TEXT = 4.5, NON = 3.0;
  const pairs = [];
  const add = (name, fg, bkg, need) => { if (fg && bkg) pairs.push({ name, fg, bg: bkg, need }); };

  add("正文 ink on bg", resolve(tk, "--ink"), bg, TEXT);
  add("正文 ink on panel(玻璃)", resolve(tk, "--ink"), panel, TEXT);
  add("正文 ink on panel2", resolve(tk, "--ink"), panel2, TEXT);
  add("次要 muted on bg", resolve(tk, "--muted"), bg, TEXT);
  add("次要 muted on panel(玻璃)", resolve(tk, "--muted"), panel, TEXT);
  add("次要 muted on panel2", resolve(tk, "--muted"), panel2, TEXT);
  add("主色填充上的文字 on-brand", resolve(tk, "--on-brand"), brand, TEXT);
  add("链接 link on bg", resolve(tk, "--link"), bg, TEXT);
  add("链接 link on panel", resolve(tk, "--link"), panel, TEXT);
  add("强调 accent on panel", resolve(tk, "--accent"), panel, TEXT);
  add("成功 ok on panel", resolve(tk, "--ok"), panel, TEXT);
  add("警告 warn on panel", resolve(tk, "--warn"), panel, TEXT);
  add("危险 bad on panel", resolve(tk, "--bad"), panel, TEXT);
  add("搜索高亮 文字 on brand-soft", resolve(tk, "--ink"), brandSoft, TEXT);
  add("错误态 文字 on bad-bg", resolve(tk, "--bad"), badBg, TEXT);

  // 非文本：焦点指示器 + 控件边界
  add("焦点环 focus on bg", resolve(tk, "--focus"), bg, NON);
  add("焦点环 focus on panel", resolve(tk, "--focus"), panel, NON);
  add("焦点环 focus on panel2", resolve(tk, "--focus"), panel2, NON);
  add("控件边界 border on bg", resolve(tk, "--border"), bg, NON);

  // 信息级：装饰性分隔线（不适用 4.5/3，只看能否看出边界）
  add("装饰性分隔线 line on bg（信息级）", over(parseColor(tk["--line"]), bg), bg, 1.2);

  // 半透明表面（副驾驶抽屉）：文字压在「虚化后的真实页面」上，
  // 取值取最不利的两个底（页面底色 / 实色面板），两者都要达标才算过；
  // 透明度取自 CSS 的 var(--cp-tint, NN%)，改透明度会自动跟着重算。
  const tint = TINT_ALPHA;
  const drawerOver = (base) => over(Object.assign({}, parseColor(tk["--surface-1"]), { a: tint }), base);
  add("抽屉（半透明叠底）ink on 叠在 bg 上", resolve(tk, "--ink"), drawerOver(bg), TEXT);
  add("抽屉（半透明叠底）ink on 叠在 panel2 上", resolve(tk, "--ink"), drawerOver(panel2), TEXT);
  add("抽屉（半透明叠底）muted on 叠在 bg 上", resolve(tk, "--muted"), drawerOver(bg), TEXT);
  add("抽屉（半透明叠底）muted on 叠在 panel2 上", resolve(tk, "--muted"), drawerOver(panel2), TEXT);

  // 气泡层（对话文字真正的底）：气泡 = --surface-3 × --cp-bubble 叠在「抽屉叠在背后」之上。
  // 两层半透明叠加时，文字可读性最容易在这里出问题，所以必须单独守住。
  const bubbleOver = (base) => over(Object.assign({}, parseColor(tk["--surface-3"]), { a: BUBBLE_ALPHA }), drawerOver(base));
  add("气泡（两层叠底）ink on 叠在 bg 上", resolve(tk, "--ink"), bubbleOver(bg), TEXT);
  add("气泡（两层叠底）ink on 叠在 panel2 上", resolve(tk, "--ink"), bubbleOver(panel2), TEXT);
  add("气泡（两层叠底）muted on 叠在 bg 上", resolve(tk, "--muted"), bubbleOver(bg), TEXT);
  add("气泡（两层叠底）muted on 叠在 panel2 上", resolve(tk, "--muted"), bubbleOver(panel2), TEXT);
  return pairs;
}

/* ---------- 诊断：--dump 打印解析到的令牌（排查"某个令牌取错/取空"时很有用）---------- */
if (process.argv.indexOf("--dump") >= 0) {
  THEMES.forEach((t) => {
    console.log("\n== " + t.id + " 解析到的令牌 ==");
    Object.keys(t.tokens).sort().forEach((k) => console.log("  " + k + ": " + t.tokens[k]));
  });
  process.exit(0);
}

/* ---------- 输出与判定 ---------- */
let failed = 0, passed = 0, info = 0;
THEMES.forEach((t) => {
  console.log("\n== 对比度检查：" + t.label + " ==");
  if (!t.tokens["--bg"]) { console.log("  !! 未解析到主题令牌（选择器写法可能变了）"); failed++; return; }
  buildPairs(t.tokens).forEach((p) => {
    const r = ratio(p.fg, p.bg);
    const ok = r >= p.need;
    const mark = p.need < 1.5 ? (ok ? "ℹ️" : "❌") : (ok ? "✅" : "❌");
    if (ok) { p.need < 1.5 ? info++ : passed++; } else { failed++; }
    console.log("  " + mark + " " + p.name.padEnd(34) + hex(p.fg) + " on " + hex(p.bg) +
      " = " + r.toFixed(2) + "  (需≥" + p.need + ")");
  });
});
console.log("\n总计：通过 " + passed + " 项（文本/非文本）、信息级 " + info + " 项、失败 " + failed + " 项");
if (failed) {
  console.log("结论： ❌ 存在未达标的对比度组合（阈值：文本 4.5 / 非文本 3.0）");
  process.exit(1);
}
console.log("结论： ✅ 全部达标（文本 ≥4.5，焦点环与控件边界 ≥3.0）");
