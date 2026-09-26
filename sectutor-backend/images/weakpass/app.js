/*
 * 授权训练靶机：弱口令与不可加盐哈希（故意脆弱）
 * ⚠️ 仅用于 SecTutor 隔离实验环境，严禁部署到任何非授权/生产网络。
 *
 * 安全说明：内置口令表只有 30 个常见弱口令，全部为演示用；
 * "爆破"发生在内存里、只对这个演示账号，不涉及任何外部系统。
 */
const crypto = require('crypto');
const express = require('express');

const app = express();
app.use(express.urlencoded({ extended: true }));

// 演示用弱口令表（真实攻防里叫"字典"）
const WORDLIST = [
  '123456', 'password', '12345678', 'qwerty', '123456789', '12345', '1234', '111111',
  '1234567', 'dragon', '123123', 'abc123', 'football', 'monkey', 'letmein', 'iloveyou',
  'admin', 'welcome', 'sunshine', 'princess', 'sectutor', 'root', 'toor', 'passw0rd',
  'P@ssw0rd', 'admin888', 'test123', 'hello', 'changeme', 'secret',
];

// 故意脆弱：MD5、不加盐
const USERS = [
  { name: 'alice', md5: crypto.createHash('md5').update('123456').digest('hex'), role: 'user' },
  { name: 'admin', md5: crypto.createHash('md5').update('P@ssw0rd').digest('hex'), role: 'admin' },
];
const SALTED = crypto.createHash('sha256').update('s3cr3t-salt::P@ssw0rd-强口令演示').digest('hex');

function page(rows) {
  return `<!doctype html><meta charset=utf-8>
  <h3>用户表（授权训练）</h3>
  <p>下面是从"数据库"里读出来的用户表——注意口令字段是 <b>MD5、无盐</b>：</p>
  <table border=1 cellpadding=6 style="border-collapse:collapse">
    <tr><th>用户</th><th>口令哈希</th><th>角色</th><th>操作</th></tr>
    ${USERS.map((u) => `<tr><td>${u.name}</td><td><code>${u.md5}</code></td><td>${u.role}</td>
      <td><a href="/crack?user=${u.name}">尝试还原</a></td></tr>`).join('')}
  </table>
  <p>提示：MD5 计算极快且无盐 → 字典一撞就出明文；换成加盐 + 慢哈希（bcrypt/argon2）后，
  同样的字典基本无效（见下方对比）。</p>
  ${rows || ''}`;
}

app.get('/', (req, res) => res.send(page(null)));

// 演示"字典还原"：只在这个演示词表里找，命中即返回明文
app.get('/crack', (req, res) => {
  const name = String(req.query.user || '');
  const u = USERS.find((x) => x.name === name);
  if (!u) return res.status(404).send(page('<p>没有这个用户</p>'));
  const t0 = Date.now();
  let hit = null;
  let tried = 0;
  for (const w of WORDLIST) {
    tried++;
    if (crypto.createHash('md5').update(w).digest('hex') === u.md5) { hit = w; break; }
  }
  const ms = Date.now() - t0;
  const out = hit
    ? `<p style="color:#c00">✓ 还原成功：<b>${u.name}</b> 的口令是 <code>${hit}</code>
        （试了 ${tried} 个候选，耗时 ${ms} 毫秒）</p>
       <p>FLAG{sectutor-weakpass-md5-no-salt}</p>`
    : `<p>试了 ${tried} 个候选没命中——说明口令不在常见字典里（这已经是好的开始，但还不够）。</p>`;
  return res.send(page(out));
});

// 对照：加盐 + 慢哈希后，同一字典无效（这里用 sha256(salt::pwd) 模拟"慢哈希"的教学替代）
app.get('/compare', (req, res) => {
  let found = null;
  const t0 = Date.now();
  for (const w of WORDLIST) {
    if (crypto.createHash('sha256').update('s3cr3t-salt::' + w).digest('hex') === SALTED) { found = w; break; }
  }
  res.send(page(`<h4>加盐 + 慢哈希对照</h4>
    <p>同样的字典去撞"加盐哈希"结果：${found ? '命中 ' + found : '未命中'}（耗时 ${Date.now() - t0} 毫秒）</p>
    <p>要点：① 盐让同一口令每次哈希都不同（彩虹表失效）；② 慢哈希让每次尝试都变贵
    （bcrypt/argon2 一次几十毫秒 → 字典攻击从"秒级"变"年级"）。</p>`));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log('[lab-weakpass] listening on ' + PORT));
