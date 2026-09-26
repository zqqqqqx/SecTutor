/*
 * labspecs.test.js — 靶场模板三处一致性单元测试（无需 Docker / 网络）。
 *
 * 为什么需要它：加一个靶场要同时改三处，少改一处就会出现"看起来有、实际用不了"的静默故障：
 *   ① src/labSpecs.js          —— 后端把前端 labId 映射到镜像
 *   ② images/<name>/           —— 镜像源码（build:images 依赖它）
 *   ③ scripts/build-images.js  —— 构建清单（漏了就不会被构建）
 *   ④ 前端 data.js 的 labs      —— labId 必须真实存在，否则这个 spec 永远不可达
 * 本测试把这四处对齐关系钉住。
 */
const fs = require('fs');
const path = require('path');

let pass = 0;
let fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); }
}

const ROOT = path.join(__dirname, '..');
const specsModule = require('../src/labSpecs');
const specs = specsModule.labSpecs || specsModule;
const specIds = Object.keys(specs);

// ---- ① spec 自身字段合法且唯一 ----
{
  assert(specIds.length >= 5, '靶场模板数量合理（' + specIds.length + ' 个）');
  const labIds = new Set();
  specIds.forEach((k) => {
    const s = specs[k];
    assert(s.labId === k, k + '：labId 与键名一致');
    assert(!labIds.has(s.labId), k + '：labId 不重复');
    labIds.add(s.labId);
    assert(typeof s.title === 'string' && s.title.length > 0, k + '：有 title');
    assert(/^sectutor\/lab-[a-z0-9-]+:latest$/.test(s.image), k + '：镜像名规范（' + s.image + '）');
    assert(Number.isInteger(s.internalPort) && s.internalPort > 0 && s.internalPort < 65536,
      k + '：internalPort 合法（' + s.internalPort + '）');
    assert(['http', 'tcp'].indexOf(s.accessMode) >= 0, k + '：accessMode 合法（' + s.accessMode + '）');
    assert(typeof s.note === 'string' && s.note.indexOf('授权靶机') >= 0,
      k + '：note 标明这是授权靶机（合规要求）');
  });
}

// ---- ② 每个 spec 都有配套镜像源码 ----
{
  specIds.forEach((k) => {
    const name = specs[k].image.replace(/^sectutor\/lab-/, '').replace(/:latest$/, '');
    const dir = path.join(ROOT, 'images', name);
    const ok = ['Dockerfile', 'app.js', 'package.json'].every((f) => fs.existsSync(path.join(dir, f)));
    assert(ok, k + '：images/' + name + '/ 含 Dockerfile + app.js + package.json');
    const df = fs.existsSync(path.join(dir, 'Dockerfile'))
      ? fs.readFileSync(path.join(dir, 'Dockerfile'), 'utf8') : '';
    assert(/FROM node:/.test(df) && /EXPOSE\s+3000/.test(df),
      k + '：Dockerfile 基础镜像与端口符合约定（node + EXPOSE 3000）');
    assert(/HEALTHCHECK/.test(df), k + '：Dockerfile 带 HEALTHCHECK（后端等容器就绪才代理）');
  });
}

// ---- ③ 构建清单与镜像目录双向一致（不能有孤儿） ----
{
  const buildSrc = fs.readFileSync(path.join(ROOT, 'scripts', 'build-images.js'), 'utf8');
  const m = buildSrc.match(/const LABS = \[([\s\S]*?)\];/);
  assert(!!m, 'build-images.js 里有 LABS 构建清单');
  const labs = m ? m[1].split(',').map((x) => x.trim().replace(/['"]/g, '')).filter(Boolean) : [];
  const specNames = specIds.map((k) => specs[k].image.replace(/^sectutor\/lab-/, '').replace(/:latest$/, ''));
  labs.forEach((l) => assert(specNames.indexOf(l) >= 0, '构建清单里的 ' + l + ' 在 labSpecs 中有登记（不会构建出没人用的镜像）'));
  specNames.forEach((n) => assert(labs.indexOf(n) >= 0, 'labSpecs 里的 ' + n + ' 在构建清单里（不会漏构建）'));
  const imgDirs = fs.readdirSync(path.join(ROOT, 'images')).filter((d) =>
    fs.statSync(path.join(ROOT, 'images', d)).isDirectory());
  imgDirs.forEach((d) => assert(labs.indexOf(d) >= 0, 'images/' + d + ' 在构建清单里（无孤儿镜像目录）'));
}

// ---- ④ spec 的 labId 必须真实存在于前端内容里（否则永远不可达） ----
{
  const dataJs = path.join(ROOT, '..', 'cybersec-agent', 'data.js');
  if (!fs.existsSync(dataJs)) {
    console.log('  (跳过前端对齐检查：未找到 ' + dataJs + ')');
  } else {
    const data = eval(fs.readFileSync(dataJs, 'utf8') + ';SEC_DATA');
    const frontLabIds = (data.labs || []).map((l) => l.id);
    assert(frontLabIds.length > 0, '前端已定义 labs（' + frontLabIds.length + ' 个）');
    specIds.forEach((k) => {
      assert(frontLabIds.indexOf(k) >= 0,
        k + '：前端存在同名 lab（否则这个模板永远不可达）');
    });
    // 反向提示：前端有但后端没 spec 的 lab 走前端仿真，属正常设计，仅统计
    const noSpec = frontLabIds.filter((id) => specIds.indexOf(id) < 0);
    console.log('  说明：前端另有 ' + noSpec.length + ' 个 lab 无后端 spec（' + noSpec.join(', ') + '），按设计走前端仿真。');
  }
}

console.log('\nlabspecs: 通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
