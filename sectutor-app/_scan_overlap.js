/**
 * scan_overlap.js —— 检测**垂直重叠**（不只是同排错位）。
 * 针对用户反馈："学习计划里复习板块的按钮偏上，与上面的按钮重合"。
 * 做法：切到 plan 面板 → 把 #reviewCard 内所有可见元素量出来 → 两两求交 → 报告重叠。
 */
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const CYBER = "C:/Users/ZQX/Desktop/NewAgent/cybersec-agent";
const OUT = "C:/Users/ZQX/Desktop/NewAgent/.workbuddy/visual";
try { fs.mkdirSync(OUT, { recursive: true }); } catch (e) {}

app.disableHardwareAcceleration();
["disable-gpu", "disable-gpu-compositing", "in-process-gpu", "no-sandbox"].forEach((f) => app.commandLine.appendSwitch(f));

const SEED = {
  sectutor_mastery: JSON.stringify(["sqli", "xss", "csrf", "sym", "hash", "ssrf"]),
  sectutor_mastery_dates: JSON.stringify({
    sqli: { t: Date.now() - 9 * 86400000, r: 0 },
    xss: { t: Date.now() - 5 * 86400000, r: 1 },
    csrf: { t: Date.now() - 3 * 86400000, r: 0 },
    ssrf: { t: Date.now() - 2 * 86400000, r: 0 },
  }),
  sectutor_activity: JSON.stringify([{ t: Date.now() - 3600000, type: "quiz", meta: null }]),
  sectutor_user_level: "中级",
};

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 760, height: 900, show: false,
    webPreferences: { contextIsolation: false, nodeIntegration: false } });
  await win.loadURL("file:///" + CYBER + "/index.html");
  await win.webContents.executeJavaScript(`(() => { const s = ${JSON.stringify(SEED)};
    Object.keys(s).forEach((k) => localStorage.setItem(k, s[k])); return 1; })()`);
  await win.webContents.reload();
  await new Promise((r) => setTimeout(r, 1500));
  // 切到「学习计划」面板（reviewCard 在这里）
  await win.webContents.executeJavaScript(`(() => { const t = document.querySelector('.rail-item[data-tab="plan"]'); if (t) t.click(); return 1; })()`);
  await new Promise((r) => setTimeout(r, 800));

  const report = await win.webContents.executeJavaScript(`(() => {
    const card = document.querySelector('#panel-plan');
    if (!card) return { error: '#reviewCard 不存在' };
    const items = [];
    const walk = (el, depth) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const visible = r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
      if (!visible) return;
      items.push({
        tag: el.tagName.toLowerCase(),
        id: el.id || '', cls: (el.className || '').toString().slice(0, 40),
        text: (el.textContent || '').trim().slice(0, 14),
        x: +r.x.toFixed(2), y: +r.y.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2), bottom: +r.bottom.toFixed(2),
        pos: cs.position, disp: cs.display, mar: cs.margin, pad: cs.padding,
        hyd: cs.height, mh: cs.maxHeight, ov: cs.overflow, depth: depth,
        isSvg: el.tagName.toLowerCase() === 'svg',
      });
      Array.from(el.children).forEach((c) => walk(c, depth + 1));
    };
    walk(card, 0);
    // 两两求交（只报"有实际重叠面积"且不是父子关系的）
    const overlaps = [];
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i], b = items[j];
        // 排除父子（一个完全包含另一个且深度相邻）
        const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
        const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
        if (ix > 2 && iy > 2 && (a.tag === "button" || b.tag === "button")) {
          const contain = (a.y <= b.y + 2 && a.bottom >= b.bottom - 2) || (b.y <= a.y + 2 && b.bottom >= a.bottom - 2);
          overlaps.push({ a: a, b: b, ix: +ix.toFixed(2), iy: +iy.toFixed(2), contain: contain });
        }
      }
    }
    return { cardRect: (() => { const r = card.getBoundingClientRect(); return { x: +r.x.toFixed(2), y: +r.y.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2), bottom: +r.bottom.toFixed(2) }; })(),
             items: items, overlaps: overlaps };
  })()`);

  if (report.error) { console.log(report.error); app.quit(); return; }
  console.log("=== #reviewCard 内元素（" + report.items.length + " 个，按纵向顺序）===");
  report.items.slice().sort((a, b) => a.y - b.y || a.x - b.x).forEach((it) => {
    console.log("  y=" + String(it.y).padStart(7) + " h=" + String(it.h).padStart(6) + " bottom=" + String(it.bottom).padStart(7)
      + "  <" + it.tag + (it.id ? '#' + it.id : '') + (it.cls ? '.' + it.cls.split(' ')[0] : '') + "> " + it.text
      + (it.pos !== 'static' ? '  [position:' + it.pos + ']' : '')
      + (it.isSvg ? '  [SVG h=' + it.hyd + ']' : ''));
  });
  console.log("\n=== 重叠对（" + report.overlaps.length + "）===");
  console.log('=== 关键元素坐标 ===');
const pick = (pred) => report.items.filter(pred);
['#panel-plan','#planWeeks','#planHours','#exportPdf','#profileCard','#reviewCard','#diagStart'].forEach((n) => {
  const it = report.items.filter((x) => x.id === n.replace('#','') || x.id === n)[0];
  if (it) console.log('  ' + n + '  x=' + it.x + ' w=' + it.w + ' (右边缘 ' + (it.x + it.w).toFixed(2) + ')  y=' + it.y + ' h=' + it.h + ' bottom=' + it.bottom);
});
report.overlaps.forEach((o) => {
    console.log((o.contain ? "  (包含) " : "  ✗ 真重叠 ")
      + "<" + o.a.tag + (o.a.id ? '#' + o.a.id : '') + ">[" + o.a.text + "] × <" + o.b.tag + (o.b.id ? '#' + o.b.id : '') + ">[" + o.b.text + "]"
      + "  重叠 " + o.ix + "×" + o.iy + "px");
    if (!o.contain) {
      console.log("      A: y=" + o.a.y + " h=" + o.a.h + " bottom=" + o.a.bottom + " ｜ " + o.a.disp + " / " + o.a.pos + " / h=" + o.a.hyd + " / maxh=" + o.a.mh + " / ov=" + o.a.ov);
      console.log("      B: y=" + o.b.y + " h=" + o.b.h + " bottom=" + o.b.bottom + " ｜ " + o.b.disp + " / " + o.b.pos + " / h=" + o.b.hyd + " / maxh=" + o.b.mh + " / ov=" + o.b.ov);
    }
  });

  const shot = await win.webContents.capturePage();
  fs.writeFileSync(OUT + "/plan-panel.png", shot.toPNG());
  const cr = report.cardRect;
  if (cr.w > 0) {
    const crop = await win.webContents.capturePage({ x: Math.max(0, Math.floor(cr.x) - 8), y: Math.max(0, Math.floor(cr.y) - 8), width: Math.ceil(cr.w) + 16, height: Math.ceil(cr.h) + 16 });
    fs.writeFileSync(OUT + "/review-card.png", crop.toPNG());
    console.log("\n复习卡区域: " + JSON.stringify(cr));
  }
  app.quit();
});
