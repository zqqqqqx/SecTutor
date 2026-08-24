/*
 * 授权训练靶机：NoSQL 注入（故意脆弱）
 * ⚠️ 仅用于 SecTutor 隔离实验环境，严禁部署到任何非授权/生产网络。
 * 演示：把用户输入当查询对象构造，使 { pass: { $ne: "" } } 之类绕过认证。
 */
const express = require('express');
const app = express();
app.use(express.urlencoded({ extended: true }));

const USERS = [{ user: 'admin', pass: 's3cr3t' }];

function escape(s) {
  return String(s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])
  );
}

app.get('/', (req, res) => {
  res.send(`<!doctype html><meta charset=utf-8>
  <h3>NoSQL 注入靶机（授权训练）</h3>
  <form method=post action=/login>
    user: <input name=u value="admin"><br>
    pass(query JSON): <input name=p value='{"$ne":""}'><br>
    <button>登录</button>
  </form>
  <p>试着用密码字段 <code>{"$ne":""}</code> 绕过。</p>`);
});

app.post('/login', (req, res) => {
  const u = req.body.u || '';
  const p = req.body.p || '';
  let query;
  try {
    query = JSON.parse(p);
  } catch {
    query = p;
  }

  const match = (user) => {
    if (typeof query === 'object' && query !== null) {
      if (query.$ne !== undefined) return user.pass !== query.$ne;
      if (query.$or) return query.$or.some((c) => matchWith(user, c));
      return user.user === (query.user || u) && user.pass === query.pass;
    }
    return user.user === u && user.pass === p;
  };
  const matchWith = (user, c) =>
    Object.keys(c).every((k) =>
      c[k].$ne !== undefined ? user[k] !== c[k].$ne : user[k] === c[k]
    );

  const ok = USERS.some(match);
  res.send(
    `<p>查询对象：<code>${escape(JSON.stringify(query))}</code></p>` +
      (ok
        ? '<p style="color:green">✅ 登录成功（认证被绕过）</p>'
        : '<p style="color:red">❌ 登录失败</p>')
  );
});

app.listen(3000, () => console.log('nosql lab listening on 3000'));
