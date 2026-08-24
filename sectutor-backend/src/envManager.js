/**
 * envManager.js — 临时环境生命周期管理（创建 / 查询 / 销毁 / 回收）。
 *
 * 两条路径：
 *   1) 仿真模式（config.simulate === true）或 Docker 不可用时 → 仅内存登记，返回模拟地址。
 *   2) 真实 Docker 模式 → 用 dockerode 起独立容器，应用资源硬上限与最小权限。
 *
 * 内存登记（registry）是真实路径也依赖的「元数据真相」，便于配额/回收/TTL 判断。
 */
const crypto = require('crypto');
const config = require('../config');
const { getSpec } = require('./labSpecs');
const audit = require('./audit');

const registry = new Map(); // envId -> env 元数据
const usedPorts = new Set();

// 配额 / 并发协调单例：REDIS_URL 下有 Redis 实现，否则内存实现（计数直接从 registry 派生，
// 单一数据源，单实例场景零差异）。
const { getQuota } = require('./quota');
const quota = getQuota(() => registry);

const { getRuntime } = require('./runtimes'); // 可插拔运行时：docker（默认）/ k8s / firecracker。懒解析（不在加载时固化引用），使 setRuntime() 热切换/测试注入对 envManager 真正生效

function allocatePort() {
  for (let i = 0; i < config.portRange; i++) {
    const p = config.portBase + Math.floor(Math.random() * config.portRange);
    if (!usedPorts.has(p)) {
      usedPorts.add(p);
      return p;
    }
  }
  throw Object.assign(new Error('主机端口资源耗尽'), { code: 'PORT_EXHAUST', status: 503 });
}

function releasePort(p) {
  usedPorts.delete(p);
}

function touchEnv(id) {
  const e = registry.get(id);
  if (e) e.lastActiveAt = Date.now();
  return e;
}

/**
 * 创建临时环境。
 * @param {string} labId 前端测试点
 * @param {string} owner 用户标识（来自鉴权）
 */
async function createEnv(labId, owner) {
  const spec = getSpec(labId);
  if (!spec) {
    // 审计：即便 labId 不被支持（无需独立环境），创建尝试也应留痕，便于合规追溯与异常探测发现
    audit.record({ type: 'create_denied', owner, envId: null, labId, detail: 'NO_SPEC' });
    const err = new Error('该测试点无需独立环境（纯前端演练）或不支持');
    err.code = 'NO_SPEC';
    err.status = 400;
    throw err;
  }

  // 配额 / 全局并发校验（原子预约名额）。先生成 id，便于 Redis 实现记录 id->owner 映射，
  // 并在释放时幂等校验归属。
  const id = 'env_' + crypto.randomBytes(6).toString('hex');
  const q = await quota.tryCreate(owner, id);
  if (!q.ok) {
    audit.record({ type: 'create_denied', owner, envId: id, labId, detail: q.code }); // QUOTA / GLOBAL_CAP
    const err = new Error(q.error);
    err.code = q.code;
    err.status = q.status;
    throw err;
  }

  // 端口分配可能失败（资源耗尽）；此时需回退已预约的配额名额，避免计数漂移。
  let hostPort;
  try {
    hostPort = allocatePort();
  } catch (e) {
    audit.record({ type: 'create_denied', owner, envId: id, labId, detail: e.code || 'PORT_EXHAUST' });
    await quota.release(id, owner);
    throw e;
  }

  const now = Date.now();
  const env = {
    id,
    labId,
    owner,
    image: spec.image,
    hostPort,
    // 访问统一走后端鉴权反向代理（/api/envs/:id/proxy），而非容器直连端口
    accessUrl: `http://${config.host}:${config.port}/api/envs/${id}/proxy/`,
    status: 'pending', // pending -> running / error / destroyed
    createdAt: now,
    expiresAt: now + config.absoluteTtlMs,
    lastActiveAt: now,
    containerId: null,
    error: null,
  };
  registry.set(id, env);

  // —— 路径 1：仿真 ——
  if (config.simulate) {
    env.status = 'running';
    env.simulated = true;
    env.accessUrl = null; // 仿真无真实容器，前端据此显示本地仿真提示
    audit.record({ type: 'create', owner, envId: id, labId });
    return env;
  }

  // —— 路径 2：真实运行时（Docker / K8s / Firecracker，由 config.runtime 选择）——
  // 运行时负责在隔离运行时中启动靶机并返回后端代理可达地址（proxyHost:proxyPort）。
  let rt;
  try {
    rt = await getRuntime().create({ id, labId, spec, owner, hostPort, absoluteTtlMs: config.absoluteTtlMs });
  } catch (e) {
    const code = e.code || (config.runtime === 'docker' ? 'DOCKER_ERR' : 'RUNTIME_ERR');
    await quota.release(id, owner);
    releasePort(hostPort);
    registry.delete(id);
    audit.record({ type: 'error', owner, envId: id, labId, detail: code });
    throw Object.assign(new Error('环境创建失败：' + e.message), { code, status: e.status || 502 });
  }
  Object.assign(env, rt); // 写入 proxyHost / proxyPort / resourceId / networkName
  env.status = 'running';
  if (rt.ready === false) {
    env.warn = '实例已启动但健康检查未在超时内通过，访问地址可能暂不可达';
  }
  audit.record({ type: 'create', owner, envId: id, labId });
  return env;
}

function getEnv(id) {
  return registry.get(id) || null;
}

/** 列出某用户的环境（不含已销毁）。 */
function listEnvs(owner) {
  return [...registry.values()].filter(
    (e) => e.owner === owner && e.status !== 'destroyed'
  );
}

/** 列出全部（回收器用）。 */
function listAll() {
  return [...registry.values()];
}

/**
 * 销毁环境：停容器 + 删容器 + 释放端口 + 从登记移除。
 * @param {string} id
 * @param {string} owner 请求者
 * @param {boolean} admin 跳过归属校验（回收器调用）
 */
async function destroyEnv(id, owner, admin = false) {
  const env = registry.get(id);
  if (!env) {
    const err = new Error('环境不存在');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }
  if (!admin && env.owner !== owner) {
    const err = new Error('无权销毁该环境');
    err.code = 'FORBIDDEN';
    err.status = 403;
    throw err;
  }
  if (env.status === 'destroyed') return env;

  // 真实运行时：拆除实例与专属网络（由所选 RuntimeBackend 实现）
  if (!config.simulate && env.resourceId) {
    try {
      await getRuntime().destroy(env);
    } catch (e) {
      // 运行时清理失败不阻断元数据清理，仅记录
      env.warn = (env.warn ? env.warn + '; ' : '') + '运行时清理失败：' + e.message;
    }
  }
  env.status = 'destroyed';
  env.destroyedAt = Date.now();
  releasePort(env.hostPort);
  registry.delete(id);
  await quota.release(id, owner); // 释放配额名额（内存实现幂等无副作用，Redis 实现校验映射）
  audit.record({ type: 'destroy', owner, envId: id, labId: env.labId });
  return env;
}

module.exports = {
  createEnv,
  getEnv,
  listEnvs,
  listAll,
  destroyEnv,
  touchEnv,
  quota,
};
