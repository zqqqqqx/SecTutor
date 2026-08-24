/**
 * fe-flag.js — 通过 `node -r` 预加载，默认把前端 cybersec-agent 同源自建服务于
 * 后端根路径（FRONTEND_DIR=../cybersec-agent），便于「打开一个 URL 即可前后端联调」。
 * 若已显式设置 FRONTEND_DIR 则尊重原值；设为 'off' 可强制关闭。
 */
if (!process.env.FRONTEND_DIR) {
  process.env.FRONTEND_DIR = '../cybersec-agent';
}
