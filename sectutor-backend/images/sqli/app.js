/*
 * 授权训练靶机：SQL 注入登录绕过（故意脆弱）
 * ⚠️ 仅用于 SecTutor 隔离实验环境，严禁部署到任何非授权/生产网络。
 */
const express = require('express');
const app = express();
app.use(express.urlencoded({ extended: true }));

function escape(s) {
  return String(s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])
  );
}

app.get('/', (req, res) => {
  res.send(`<!doctype html><meta charset=utf-8>
  <h3>SQLi 靶机（授权训练）</h3>
  <form method=post action=/login>
    user: <input name=u><br>
    pass: <input name=p type=password><br>
    <button>登录</button>
  </form>
  <p>试着用 <code>admin' --</code> 或 <code>' OR '1'='1</code> 绕过。</p>`);
});

// 故意脆弱：字符串拼接构造 SQL，仅用于演示注入原理
app.post('/login', (req, res) => {
  const u = req.body.u || '';
  const p = req.body.p || '';
  const sql = `SELECT * FROM users WHERE username='${u}' AND password='${p}'`;

  const idxDashes = sql.indexOf('--');
  const idxHash = sql.indexOf('#');
  const ci = Math.min(
    idxDashes >= 0 ? idxDashes : Infinity,
    idxHash >= 0 ? idxHash : Infinity
  );
  const stripped = ci < Infinity ? sql.slice(0, ci) : sql;
  const commentBypass = /username='[^']*'\s*$/.test(stripped.replace(/\s+/g, ' '));
  const orBypass = /\bor\b\s+'?1'?(\s*=\s*'?1'?| like )/i.test(sql);

  res.send(
    `<p>执行的语句：<code>${escape(sql)}</code></p>` +
      (commentBypass || orBypass
        ? '<p style="color:green">✅ 登录成功（认证被绕过）</p>'
        : '<p style="color:red">❌ 登录失败</p>')
  );
});

app.listen(3000, () => console.log('sqli lab listening on 3000'));
