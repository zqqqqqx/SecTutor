/**
 * sim-flag.js — 通过 `node -r` 预加载，在无 Docker 的开发 / 前端联调场景
 * 默认开启仿真模式（DOCKER_SIMULATE=1），免去手动设置环境变量。
 * 若已显式设置 DOCKER_SIMULATE 则尊重原值。
 */
if (!process.env.DOCKER_SIMULATE) {
  process.env.DOCKER_SIMULATE = '1';
}
