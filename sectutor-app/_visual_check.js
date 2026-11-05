/**
 * visual_check.js —— 用项目自带的 Electron（Chromium）跑真实渲染，量出按钮的实际几何，并截图。
 * 用法：<项目>/sectutor-app/node_modules/electron/dist/electron.exe visual_check.js
 *
 * 为什么这么做：沙箱里没有浏览器，但项目自带 Electron —— 它就是用户运行应用的同一个引擎，
 * 比另装 Playwright 更贴近真实（且零下载）。
 */
const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

const CYBER = "C:/Users/ZQX/Desktop/NewAgent/cybersec-agent";
const OUT = "C:/Users/ZQX/Desktop/NewAgent/.workbuddy/visual";
try { fs.mkdirSync(OUT, { recursive: true }); } catch (e) {}

// 让应用有可展示的"今天的主线"步骤：给一些掌握状态 + 一份当天计划
const SEED = {
  sectutor_mastery: ["sqli", "xss", "csrf", "sym", "hash"],
  sectutor_mastery_dates: JSON.stringify({
    sqli: { t: Date.now() - 9 * 86400000, r: 0 },
    xss: { t: Date.now() - 5 * 86400000, r: 1 },
    csrf: { t: Date.now() - 3 * 86400000, r: 0 },
  }),
  sectutor_activity: [{ t: Date.now() - 3600000, type: "quiz", meta: null }],
  sectutor_user_level: "中级",
};

app.disableHardwareAcceleration();                 // 沙箱无 GPU：强制软件渲染
app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("disable-gpu-compositing");
app.commandLine.appendSwitch("disable-software-rasterizer");
app.commandLine.appendSwitch("in-process-gpu");
app.commandLine.appendSwitch("no-sandbox");
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1280, height: 900, show: false,
    webPreferences: { contextIsolation: false, nodeIntegration: false, offscreen: false },
  });
  const load = (u) => new Promise((res) => win.loadURL(u).then(res).catch(res));
  await load("file:///" + CYBER.replace(/\\/g, "/") + "/index.html");

  // ① 播种 localStorage（应用启动时会读它）→ 再重载一次
  await win.webContents.executeJavaScript(`(() => {
    const seed = ${JSON.stringify(SEED)};
    Object.keys(seed).forEach((k) => {
      const v = k === 'sectutor_mastery' || k === 'sectutor_mastery_dates' || k === 'sectutor_activity'
        ? JSON.stringify(seed[k]) : seed[k];
      localStorage.setItem(k, v);
    });
    return Object.keys(seed).length;
  })()`);
  await win.webContents.reload();
  await new Promise((r) => setTimeout(r, 1200));

  // ② 切到「今天」面板并等渲染
  await win.webContents.executeJavaScript(`(() => {
    const tab = document.querySelector('.rail-item[data-tab="today"]');
    if (tab) tab.click();
    return !!tab;
  })()`);
  await new Promise((r) => setTimeout(r, 600));

  // ③ 量两个按钮的真实几何
  const measure = await win.webContents.executeJavaScript(`(() => {
    const rows = [];
    document.querySelectorAll('.today-step').forEach((li, i) => {
      const go = li.querySelector('.today-go'), alt = li.querySelector('.today-alt');
      if (!go) return;
      const r = (el) => { const b = el.getBoundingClientRect(); return { x: +b.x.toFixed(2), y: +b.y.toFixed(2), w: +b.width.toFixed(2), h: +b.height.toFixed(2), bottom: +b.bottom.toFixed(2) }; };
      const cs = (el) => { const c = getComputedStyle(el); return [c.fontSize, c.fontWeight, c.paddingTop + '/' + c.paddingRight, c.verticalAlign, c.lineHeight].join(' | '); };
      rows.push({ step: i + 1, hasAlt: !!alt, go: r(go), alt: alt ? r(alt) : null, goCSS: cs(go), altCSS: alt ? cs(alt) : null });
    });
    return { count: rows.length, rows: rows, stepsHTML: (document.querySelector('#todaySteps') || {}).innerHTML ? 'yes' : 'no' };
  })()`);
  measure.rows.forEach((r) => {
    const f = (o) => o ? ('y=' + o.y + ' h=' + o.h + ' bottom=' + o.bottom + ' x=' + o.x + ' w=' + o.w) : '(无)';
    console.log('STEP' + r.step + '  go ' + f(r.go) + '   ||   alt ' + f(r.alt));
    console.log('     CSS go  = ' + r.goCSS);
    console.log('     CSS alt = ' + r.altCSS);
  });
  const r0 = measure.rows[0];
  if (r0 && r0.alt) console.log('DELTA  高度差=' + Math.abs(r0.go.h - r0.alt.h).toFixed(2) + 'px  底边差=' + Math.abs(r0.go.bottom - r0.alt.bottom).toFixed(2) + 'px');
  console.log('STEPS_COUNT=' + measure.count);

  // ④ 截图：整页 + 裁出第一个步骤区域
  const shot = await win.webContents.capturePage();
  fs.writeFileSync(path.join(OUT, "today-panel.png"), shot.toPNG());
  const first = measure.rows[0];
  if (first && first.alt) {
    const pad = 20;
    const x = Math.max(0, Math.floor(Math.min(first.go.x, first.alt.x)) - pad);
    const y = Math.max(0, Math.floor(Math.min(first.go.y, first.alt.y)) - 40);
    const w = Math.ceil(Math.max(first.go.x + first.go.w, first.alt.x + first.alt.w) - x + pad);
    const h = Math.ceil(Math.max(first.go.bottom, first.alt.bottom) - y + pad);
    const crop = await win.webContents.capturePage({ x: x, y: y, width: w, height: h });
    fs.writeFileSync(path.join(OUT, "pair-buttons.png"), crop.toPNG());
    console.log("裁剪区域:", JSON.stringify({ x: x, y: y, width: w, height: h }));
  }
  console.log("截图已保存到 " + OUT);
  app.quit();
});
