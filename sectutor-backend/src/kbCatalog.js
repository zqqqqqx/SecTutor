/**
 * kbCatalog.js — 知识库目录与内容版本指纹。
 *
 * 用途（扩展后端应用场景）：
 *   1. 客户端（桌面版 / 浏览器版 / 将来其他端）启动或定时校验：
 *      本地内容版本是否与后端一致 → 决定要不要提示更新或重新拉取；
 *   2. 仪表盘/审计看板展示内容规模（领域 / 知识点 / 题库），不再靠前端自报；
 *   3. 为将来的「内容增量同步」预留稳定锚点（version + counts + 每领域细目）。
 *
 * 实现要点：
 *   - 直接读前端内容文件 data.js（打包时随 resources 一起发布），**不复制一份数据**，
 *     避免出现"两份内容不一致"的经典问题；
 *   - 用 data.js 的字节内容算 sha256 作为版本指纹：内容一变指纹就变；
 *   - 按 mtime+size 缓存，避免每次请求都重新解析（data.js 约 400 KB）；
 *   - 解析失败不抛 500，返回 ok:false + 原因，便于排障。
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function candidatePaths() {
  const list = [];
  if (process.env.SECTUTOR_DATA_JS) list.push(process.env.SECTUTOR_DATA_JS);
  // 打包后：resources/cybersec-agent/data.js（与本后端同级目录）
  list.push(path.join(__dirname, '..', '..', 'cybersec-agent', 'data.js'));
  // 开发时：仓库同级
  list.push(path.join(__dirname, '..', '..', '..', 'cybersec-agent', 'data.js'));
  return list;
}

let cache = { key: '', value: null };

function locate() {
  for (const p of candidatePaths()) {
    try {
      if (fs.existsSync(p)) return p;
    } catch (e) { /* 忽略 */ }
  }
  return null;
}

function parseDataJs(src) {
  // data.js 是纯数据脚本（`const SEC_DATA = {...}`），用函数求值比 eval 更可控。
  // eslint-disable-next-line no-new-func
  const fn = new Function(src + '\n;return (typeof SEC_DATA !== "undefined") ? SEC_DATA : null;');
  return fn();
}

/**
 * 读取目录信息（带缓存）。
 * @returns {{ok:boolean, error?:string, version?:string, counts?:object, domains?:Array, file?:string}}
 */
function readCatalog() {
  const file = locate();
  if (!file) {
    return { ok: false, error: '未找到内容文件 data.js（可用 SECTUTOR_DATA_JS 指定路径）' };
  }
  const st = fs.statSync(file);
  const key = file + '|' + st.mtimeMs + '|' + st.size;
  if (cache.key === key && cache.value) return cache.value;

  const buf = fs.readFileSync(file);
  const version = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
  let data;
  try {
    data = parseDataJs(buf.toString('utf8'));
  } catch (e) {
    return { ok: false, error: '内容文件解析失败：' + e.message, file };
  }
  if (!data || !Array.isArray(data.categories)) {
    return { ok: false, error: '内容文件结构异常（缺少 categories）', file };
  }
  const domains = data.categories.map((c) => ({
    id: c.id,
    name: c.name,
    topics: (c.topics || []).length,
    quizzes: (data.quizzes || []).filter((q) => q.cat === c.id).length,
  }));
  const counts = {
    domains: domains.length,
    topics: domains.reduce((a, d) => a + d.topics, 0),
    quizzes: (data.quizzes || []).length,
    ranges: (data.ranges || []).length,
    news: (data.news || []).length,
  };
  const value = {
    ok: true,
    version,                 // 内容指纹（sha256 前 16 位）：内容一变就变
    counts,
    domains,
    file: path.basename(file),
    sizeBytes: st.size,
    updatedAt: new Date(st.mtimeMs).toISOString(),
  };
  cache = { key, value };
  return value;
}

module.exports = { readCatalog, locate };
