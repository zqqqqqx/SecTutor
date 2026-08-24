'use strict';
/**
 * preload.js — 在隔离上下文中把主进程的 IPC 能力安全地暴露给渲染进程（前端页面）。
 * 仅暴露三个与后端启停相关的调用，不暴露 Node 其它能力，符合 Electron 安全最佳实践。
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sectutor', {
  // 启动内嵌后端
  start: () => ipcRenderer.invoke('sectutor:start'),
  // 停止内嵌后端
  stop: () => ipcRenderer.invoke('sectutor:stop'),
  // 查询后端运行状态 { running, port, simulate }
  status: () => ipcRenderer.invoke('sectutor:status'),
  // 渲染进程把当前界面语言告知主进程（用于同步设置菜单的勾选）
  notifyLang: (lang) => ipcRenderer.send('sectutor:notify-lang', lang),
  // 主进程通过顶部「设置 → 语言」菜单切换语言时，向渲染进程推送命令
  onLangCommand: (cb) => ipcRenderer.on('sectutor:lang-command', (_e, lang) => cb(lang)),
});
