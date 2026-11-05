/**
 * scan_pairs.js —— 扫描**所有面板**里"同一行并排的按钮"，逐个量出几何差，找出真正错位的那一对。
 * 用法：electron.exe --disable-gpu --in-process-gpu scan_pairs.js
 */
const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");
const CYBER = "C:/Users/ZQX/Desktop/NewAgent/cybersec-agent";
const OUT = "C:/Users/ZQX/Desktop/NewAgent/.workbuddy/visual";
try { fs.mkdirSync(OUT, { recursive: true }); } catch (e) {}

app.disableHardwareAcceleration();
["disable-gpu", "disable-gpu-compositing", "in-process-gpu", "no-sandbox"].forEach((f) => app.commandLine.appendSwitch(f));

const SEED = {
  sectutor_mastery: JSON.stringify(["sqli", "xss", "csrf", "sym", "hash"]),
  sectutor_mastery_dates: JSON.stringify({
    sqli: { t: Date.now() - 9 * 86400000, r: 0 },
    xss: { t: Date.now() - 5 * 86400000, r: 1 },
    csrf: { t: Date.now() - 3 * 86400000, r: 0 },
  }),
  sectutor_activity: JSON.stringify([{ t: Date.now() - 3600000, type: "quiz", meta: null }]),
  sectutor_user_level: "中级",
};

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1280, height: 900, show: false,
    webPreferences: { contextIsolation: false, nodeIntegration: false } });
  await win.loadURL("file:///" + CYBER + "/index.html");
  await win.webContents.executeJavaScript(`(() => { const s = ${JSON.stringify(SEED)};
    Object.keys(s).forEach((k) => localStorage.setItem(k, s[k])); return 1; })()`);
  await win.webContents.reload();
  await new Promise((r) => setTimeout(r, 1500));

  // 逐面板扫描：同一行（y 差 ≤3px）且相邻（水平间距 ≤24px）的两个按钮算一对
  const found = await win.webContents.executeJavaScript(`(() => {
    const out = [];
    document.querySelectorAll('.panel').forEach((panel) => {
      panel.classList.add('active');          // 逐个激活以便布局生效
      const btns = Array.from(panel.querySelectorAll('button')).filter((b) => {
        const r = b.getBoundingClientRect();
        return r.width > 0 && r.height > 0;   // 可见
      }).map((b) => {
        const r = b.getBoundingClientRect();
        const c = getComputedStyle(b);
        return {
          id: (b.id || '(无id)') + '[' + (b.textContent || '').trim().slice(0, 8) + ']',
          x: +r.x.toFixed(2), y: +r.y.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2), bottom: +r.bottom.toFixed(2),
          css: [c.fontSize, c.fontWeight, c.padding, c.lineHeight, c.verticalAlign, c.borderWidth].join(' | '),
          panel: panel.id.replace(/^panel-/, ''),
        };
      });
      for (let i = 0; i < btns.length; i++) {
        for (let j = i + 1; j < btns.length; j++) {
          const a = btns[i], b = btns[j];
          if (Math.abs(a.y - b.y) > 3) continue;                    // 必须同一行
          const gap = Math.abs(Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
          if (gap > 24) continue;                                    // 必须相邻（不是被大段内容隔开）
          out.push({ panel: a.panel, a: a, b: b,
            dY: +Math.abs(a.y - b.y).toFixed(2),
            dH: +Math.abs(a.h - b.h).toFixed(2),
            dBottom: +Math.abs(a.bottom - b.bottom).toFixed(2) });
        }
      }
      panel.classList.remove('active');
    });
    document.querySelector('.panel.active') || document.querySelectorAll('.panel')[0].classList.add('active');
    return out;
  })()`);

  console.log("=== 同排按钮对扫描（共 " + found.length + " 对）===");
  const bad = found.filter((p) => p.dH > 0.01 || p.dBottom > 0.01);
  found.forEach((p) => {
    const flag = (p.dH > 0.01 || p.dBottom > 0.01) ? "✗ 错位" : "✓ 齐平";
    console.log(flag + " [" + p.panel + "] " + p.a.id + "  vs  " + p.b.id);
    console.log("      高度差 " + p.dH + "px ｜ 底边差 " + p.dBottom + "px ｜ 顶部差 " + p.dY + "px");
    if (p.dH > 0.01 || p.dBottom > 0.01) {
      console.log("      A: " + p.a.css);
      console.log("      B: " + p.b.css);
    }
  });
  console.log("\n错位对数：" + bad.length + " / " + found.length);
  app.quit();
});
