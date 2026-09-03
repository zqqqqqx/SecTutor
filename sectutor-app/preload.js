'use strict';
/**
 * preload.js — 在隔离上下文中把主进程的 IPC 能力安全地暴露给渲染进程（前端页面）。
 * 仅暴露「后端启停 / 语言同步 / 自动更新」三类调用，不暴露 Node 其它能力，
 * 符合 Electron 安全最佳实践（contextIsolation + 最小权限暴露）。
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

  // —— 自动更新（v1.2.0 起）——
  // 仅暴露「查状态 / 检查 / 下载 / 安装」四个动作，不暴露版本来源与实际下载路径，
  // 渲染进程拿不到文件系统与子进程能力。

  // 查询当前更新状态快照
  updateState: () => ipcRenderer.invoke('sectutor:update-state'),
  // 手动检查更新（返回 { ok, state }）
  checkUpdate: () => ipcRenderer.invoke('sectutor:check-update'),
  // 下载更新包
  downloadUpdate: () => ipcRenderer.invoke('sectutor:download-update'),
  // 安装并重启应用
  installUpdate: () => ipcRenderer.invoke('sectutor:install-update'),
  // 主进程推送更新状态（检查中 / 有新版本 / 下载进度 / 已就绪 / 出错）
  // 返回反注册函数，便于调用方清理，避免重复叠加监听。
  onUpdateState: (cb) => {
    const listener = (_e, state) => cb(state);
    ipcRenderer.on('sectutor:update-state', listener);
    return () => ipcRenderer.removeListener('sectutor:update-state', listener);
  },
});
