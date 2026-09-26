/*
 * kbcatalog.test.js — 知识库目录/内容指纹单元测试（确定性，无需网络与 Docker）。
 * 覆盖：
 *   - 能定位到真实的 data.js 并读出领域/知识点/题库统计
 *   - 内容指纹随内容变化（改一个字节就变）
 *   - 缓存生效（同一次读取命中缓存，不重复解析）
 *   - 文件缺失 / 结构异常时返回 ok:false 而不是抛错
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

let pass = 0;
let fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); }
}

const { readCatalog, locate } = require('../src/kbCatalog');

// ---- ① 真实内容可读 ----
{
  const kb = readCatalog();
  assert(kb.ok === true, '默认路径能读到内容文件（' + (locate() || '未找到') + '）');
  if (kb.ok) {
    assert(/^[0-9a-f]{16}$/.test(kb.version), '内容指纹是 16 位十六进制（sha256 前 16 位）');
    assert(kb.counts.domains >= 10, '领域数合理（' + kb.counts.domains + '）');
    assert(kb.counts.topics >= 200, '知识点数合理（' + kb.counts.topics + '）');
    assert(kb.counts.quizzes >= 700, '题库数合理（' + kb.counts.quizzes + '）');
    assert(Array.isArray(kb.domains) && kb.domains.length === kb.counts.domains, '每领域细目与领域数一致');
    const sum = kb.domains.reduce((a, d) => a + d.topics, 0);
    assert(sum === kb.counts.topics, '领域细目的知识点合计等于总数（' + sum + '）');
    const qsum = kb.domains.reduce((a, d) => a + d.quizzes, 0);
    assert(qsum === kb.counts.quizzes, '领域细目的题目合计等于总数（' + qsum + '）');
    assert(kb.domains.every((d) => d.topics > 0 && d.quizzes > 0), '每个领域都既有知识点也有题（覆盖守门）');
  }
}

// ---- ② 缓存：同一份内容连读两次，第二次是同一对象 ----
{
  const a = readCatalog();
  const b = readCatalog();
  assert(a === b, '连续读取命中缓存（返回同一对象，不重复解析 400KB）');
}

// ---- ③ 指纹随内容变化 ----
{
  const tmp = path.join(os.tmpdir(), 'sectutor-kb-test-' + Date.now(), 'data.js');
  fs.mkdirSync(path.dirname(tmp), { recursive: true });
  const sample = 'const SEC_DATA = { categories: [{ id: "x", name: "X", topics: [{ id: "t1", name: "n" }] }], quizzes: [{ id: "q1", cat: "x" }], ranges: [], news: [] };';
  fs.writeFileSync(tmp, sample, 'utf8');

  const prevEnv = process.env.SECTUTOR_DATA_JS;
  process.env.SECTUTOR_DATA_JS = tmp;
  // 清缓存（换路径后 key 不同，天然不复用；但为稳妥仍走一次读取）
  const v1 = readCatalog();
  assert(v1.ok && v1.version, '按 SECTUTOR_DATA_JS 指定路径可读（便于测试与自建）');
  assert(v1.counts.topics === 1 && v1.counts.quizzes === 1, '统计与样本内容一致');

  fs.writeFileSync(tmp, sample.replace('"n"', '"n2"'), 'utf8');
  const v2 = readCatalog();
  assert(v2.ok && v2.version !== v1.version, '内容改一个字节，指纹随之变化（版本校验可用）');

  fs.writeFileSync(tmp, 'const BROKEN = 1;', 'utf8');
  const v3 = readCatalog();
  assert(v3.ok === false && /结构/.test(v3.error), '结构异常时返回 ok:false（不抛 500）');

  fs.rmSync(tmp, { force: true });
  const v4 = readCatalog();
  assert(v4.ok === true && v4.file === 'data.js',
    'SECTUTOR_DATA_JS 指向的文件消失时回退到默认路径（不会因此不可用）');

  if (prevEnv === undefined) delete process.env.SECTUTOR_DATA_JS; else process.env.SECTUTOR_DATA_JS = prevEnv;
}

console.log('\nkbcatalog: 通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
