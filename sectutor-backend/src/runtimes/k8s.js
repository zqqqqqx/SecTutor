/**
 * k8s.js — K8sRuntime（RuntimeBackend 实现之一，骨架）。
 *
 * 把每个临时靶机放进一个**独立 Pod**，用 NetworkPolicy 实现与 Docker internal 网络等价的隔离：
 *   - podSelector 命中本 Pod + policyTypes 含 Egress 且**不写任何 egress 规则** ⇒ 默认全部拒绝出站
 *     （靶机无法主动访问公网/内网，防被当跳板或外泄数据）；
 *   - 同时含 Ingress 拒绝 ⇒ 环境间（及其它 Pod）互不可达；
 *   - securityContext：runAsNonRoot + readOnlyRootFilesystem + drop ALL caps + seccomp RuntimeDefault
 *     + allowPrivilegeEscalation:false ⇒ 最小权限；
 *   - resources 硬上限（内存/CPU）⇒ 防资源耗尽型 DoS；
 *   - automountServiceAccountToken:false ⇒ 不给靶机集群凭据。
 *
 * 后端代理：Pod 在集群内，后端（同样在集群内或经 Service）直连 PodIP:containerPort。
 *
 * 注意：本沙箱无 K8s 集群，create/destroy 的真实 API 调用无法实跑；
 *   - @kubernetes/client-node 在 create/destroy 内**懒加载**，模块顶层不依赖该 SDK，可在无 SDK 时加载；
 *   - buildPodSpec / buildDenyEgressPolicy 为纯函数，由契约测试直接校验结构（无需集群/SDK）。
 *   真链路需在装有 kubectl 可访问的隔离集群中验证。
 */
const config = require('../../config');

/** 纯函数：构造靶机 Pod manifest（无需 SDK/集群即可验证）。 */
function buildPodSpec(ctx) {
  const { id, spec, owner, absoluteTtlMs } = ctx;
  const name = 'sectutor-' + id;
  const port = spec.internalPort;
  const cpuMilli = Math.max(1, Math.round((config.container.cpuQuota || 50000) / 1000)); // cpuQuota 微核→毫核
  return {
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: {
      name,
      namespace: config.k8sNamespace,
      labels: { 'sectutor.dev/env': id, 'sectutor.dev/owner': owner },
      annotations: {
        'sectutor.dev/expiresAt': String(Date.now() + (absoluteTtlMs || config.absoluteTtlMs)),
      },
    },
    spec: {
      restartPolicy: 'Never',
      automountServiceAccountToken: false,
      containers: [
        {
          name: 'target',
          image: spec.image,
          ports: [{ containerPort: port }],
          securityContext: {
            runAsNonRoot: true,
            runAsUser: 1000,
            readOnlyRootFilesystem: true,
            allowPrivilegeEscalation: false,
            capabilities: { drop: ['ALL'], add: ['NET_BIND_SERVICE'] },
            seccompProfile: { type: 'RuntimeDefault' },
          },
          resources: {
            limits: {
              memory: String(config.container.memory),
              cpu: String(cpuMilli) + 'm',
            },
            requests: {
              memory: String(Math.floor(config.container.memory / 2)),
              cpu: '100m',
            },
          },
        },
      ],
    },
  };
}

/** 纯函数：构造「全封出站 + 拒绝入站」的 NetworkPolicy（无需 SDK/集群即可验证）。 */
function buildDenyEgressPolicy(ctx) {
  const { id } = ctx;
  return {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'NetworkPolicy',
    metadata: {
      name: 'sectutor-deny-egress-' + id,
      namespace: config.k8sNamespace,
    },
    spec: {
      podSelector: { matchLabels: { 'sectutor.dev/env': id } },
      // 不写 ingress/egress 规则 + policyTypes 同时含 Egress/Ingress
      // ⇒ 默认全部拒绝：出站全封锁（防数据外泄/跳板），且环境间互不可达。
      policyTypes: ['Ingress', 'Egress'],
    },
  };
}

async function waitForPodRunning(core, ns, name, timeoutMs) {
  const deadline = Date.now() + (timeoutMs || 15000);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let info;
    try {
      info = await core.readNamespacedPod(name, ns);
    } catch (e) {
      if (Date.now() >= deadline) return null;
      await new Promise((r) => setTimeout(r, 500));
      continue;
    }
    const phase = info.status && info.status.phase;
    if (phase === 'Running') return info.status.podIP;
    if (phase === 'Failed' || phase === 'Succeeded') {
      throw Object.assign(new Error('Pod 启动失败（phase=' + phase + '）'), { code: 'POD_FAILED', status: 502 });
    }
    if (Date.now() >= deadline) return info.status ? info.status.podIP || null : null;
    await new Promise((r) => setTimeout(r, 500));
  }
}

async function create(ctx) {
  // 懒加载 K8s SDK：模块可在未安装 @kubernetes/client-node 时正常加载
  const k8s = require('@kubernetes/client-node');
  const kc = new k8s.KubeConfig();
  if (config.k8sKubeconfig) kc.loadFromFile(config.k8sKubeconfig);
  else kc.loadFromDefault();
  const core = kc.makeApiClient(k8s.CoreV1Api);
  const net = kc.makeApiClient(k8s.NetworkingV1Api);

  const pod = buildPodSpec(ctx);
  const policy = buildDenyEgressPolicy(ctx);
  await core.createNamespacedPod(config.k8sNamespace, pod);
  try {
    await net.createNamespacedNetworkPolicy(config.k8sNamespace, policy);
  } catch (e) {
    // 策略创建失败也要回滚已建的 Pod，避免泄漏
    await core.deleteNamespacedPod(pod.metadata.name, config.k8sNamespace, { gracePeriodSeconds: 0 }).catch(() => {});
    throw e;
  }

  const podIp = await waitForPodRunning(core, config.k8sNamespace, pod.metadata.name, config.containerStartTimeoutMs);
  if (!podIp) {
    await core.deleteNamespacedPod(pod.metadata.name, config.k8sNamespace, { gracePeriodSeconds: 0 }).catch(() => {});
    await net.deleteNamespacedNetworkPolicy(policy.metadata.name, config.k8sNamespace).catch(() => {});
    const e = new Error('Pod 未在超时内进入 Running，访问地址可能暂不可达');
    e.code = 'POD_TIMEOUT';
    e.status = 502;
    throw e;
  }
  return {
    proxyHost: podIp, // 集群内直连 PodIP
    proxyPort: ctx.spec.internalPort,
    resourceId: pod.metadata.name,
    networkName: config.k8sNamespace,
    ready: true,
  };
}

async function destroy(env) {
  const k8s = require('@kubernetes/client-node');
  const kc = new k8s.KubeConfig();
  if (config.k8sKubeconfig) kc.loadFromFile(config.k8sKubeconfig);
  else kc.loadFromDefault();
  const core = kc.makeApiClient(k8s.CoreV1Api);
  const net = kc.makeApiClient(k8s.NetworkingV1Api);
  if (env.resourceId) {
    await core.deleteNamespacedPod(env.resourceId, env.networkName, { gracePeriodSeconds: 0 }).catch(() => {});
  }
  if (env.id) {
    await net.deleteNamespacedNetworkPolicy('sectutor-deny-egress-' + env.id, env.networkName).catch(() => {});
  }
}

async function inspect(env) {
  const k8s = require('@kubernetes/client-node');
  const kc = new k8s.KubeConfig();
  if (config.k8sKubeconfig) kc.loadFromFile(config.k8sKubeconfig);
  else kc.loadFromDefault();
  const core = kc.makeApiClient(k8s.CoreV1Api);
  try {
    const info = await core.readNamespacedPod(env.resourceId, env.networkName);
    return { running: !!(info.status && info.status.phase === 'Running') };
  } catch (e) {
    return { running: false };
  }
}

module.exports = { create, destroy, inspect, buildPodSpec, buildDenyEgressPolicy };
