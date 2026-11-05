/**
 * check_plan.js —— 干净测量：只点开「学习计划」一次，量关键元素 + 截整个面板。
 * 不做任何面板切换，避免扫描器自身干扰布局。
 */
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const CYBER = process.env.CYBER_DIR || "C:/Users/ZQX/Desktop/NewAgent/cybersec-agent";
const OUT = "C:/Users/ZQX/Desktop/NewAgent/.workbuddy/visual";
const WIN_W = parseInt(process.env.WIN_W || "1440", 10);
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
  const win = new BrowserWindow({ width: WIN_W, height: 900, show: false,
    webPreferences: { contextIsolation: false, nodeIntegration: false } });
  await win.loadURL("file:///" + CYBER + "/index.html");
  await win.webContents.executeJavaScript(`(() => { const s = ${JSON.stringify(SEED)};
    Object.keys(s).forEach((k) => localStorage.setItem(k, s[k])); return 1; })()`);
  await win.webContents.reload();
  await new Promise((r) => setTimeout(r, 1500));
  // 只点一次「学习计划」
  await win.webContents.executeJavaScript(`document.querySelector('.rail-item[data-tab="plan"]').click(); 1`);
  await new Promise((r) => setTimeout(r, 900));

  const r = await win.webContents.executeJavaScript(`(() => {
    const g = (sel) => { const el = document.querySelector(sel); if (!el) return null;
      const b = el.getBoundingClientRect();
      return { sel: sel, x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1), bottom: +b.bottom.toFixed(1), right: +(b.x + b.width).toFixed(1) }; };
    const layout = getComputedStyle(document.querySelector('.plan-layout'));
    const res = {
      win: { w: window.innerWidth, h: window.innerHeight },
      planLayoutDisplay: layout.display,
      planLayoutCols: layout.gridTemplateColumns,
      panel: g('#panel-plan'), controls: g('.plan-controls'), main: g('.plan-main'),
      agentCenter: g('.agent-center'), profile: g('#profileCard'), review: g('#reviewCard'), weekly: g('#weeklyCard'),
      reviewStart: g('#reviewStart'), relBox: g('.rel-box'), diagStart: g('#diagStart'),
      planHours: g('#planHours'), exportPdf: g('#exportPdf'),
      chips: Array.from(document.querySelectorAll('#reviewCard .rel-chip')).map((b) => { const x = b.getBoundingClientRect(); return { t: b.textContent.trim().slice(0, 8), x: +x.x.toFixed(1), y: +x.y.toFixed(1), bottom: +x.bottom.toFixed(1) }; }),
    };
    // 关键判断：reviewStart 是否与 chips 重叠
    const rs = document.querySelector('#reviewStart'), rl = document.querySelector('#reviewCard .rel-box');
    if (rs && rl) {
      const a = rl.getBoundingClientRect(), b = rs.getBoundingClientRect();
      res.overlapRelBoxButton = { relBoxBottom: +a.bottom.toFixed(1), btnTop: +b.y.toFixed(1), gap: +(b.y - a.bottom).toFixed(1) };
    }
    return res;
  })()`);
  console.log(JSON.stringify(r, null, 1));

  const shot = await win.webContents.capturePage();
  fs.writeFileSync(OUT + "/plan-clean-" + WIN_W + ".png", shot.toPNG());
  if (r.panel) {
    const p = r.panel;
    const crop = await win.webContents.capturePage({ x: Math.max(0, Math.round(p.x)), y: Math.max(0, Math.round(p.y)), width: Math.round(p.w), height: Math.min(880 - Math.round(p.y), Math.round(p.h)) });
    fs.writeFileSync(OUT + "/plan-panel-only-" + WIN_W + ".png", crop.toPNG());
  }
  console.log("截图: plan-clean-" + WIN_W + ".png / plan-panel-only-" + WIN_W + ".png");
  app.quit();
});
