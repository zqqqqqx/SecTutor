/**
 * index.js — 运行时工厂：按 config.runtime 选择具体 RuntimeBackend 实现。
 *
 * 支持：docker（默认）/ k8s / firecracker。单例缓存，避免重复实例化。
 * setRuntime() 供测试注入 FakeRuntime，或未来运行时热切换。
 */
const config = require('../../config');

let instance = null;

function getRuntime() {
  if (instance) return instance;
  const name = (config.runtime || 'docker').toLowerCase();
  if (name === 'k8s' || name === 'kubernetes') {
    instance = require('./k8s');
  } else if (name === 'firecracker' || name === 'fc') {
    instance = require('./firecracker');
  } else {
    instance = require('./docker');
  }
  return instance;
}

/** 注入运行时（测试 / 热切换）。传 null 可清空缓存以便重新按 config 选择。 */
function setRuntime(r) {
  instance = r;
}

module.exports = { getRuntime, setRuntime };
