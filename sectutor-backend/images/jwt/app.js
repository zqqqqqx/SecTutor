/*
 * 授权训练靶机：JWT 弱密钥与篡改（故意脆弱）
 * ⚠️ 仅用于 SecTutor 隔离实验环境，严禁部署到任何非授权/生产网络。
 *
 * 安全说明：这里**不实现真实 JWT 库**，只演示三个教学点：
 *   ① JWT 的 payload 只是 base64（不是加密，谁都能读）
 *   ② 签名用弱密钥时，可被离线猜出来
 *   ③ 一旦能签名，就能把 role 改成 admin 拿到越权
 * 密钥是内置的弱口令列表，签名算法用 Node 内置 crypto，不涉及真实系统。
 */
const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.urlencoded({ extended: true }));

const WEAK_SECRETS = ['secret', '123456', 'password', 'jwt', 'admin', 'sectutor'];
const REAL_SECRET = '123456';           // 故意使用弱密钥

function b64u(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64uDecode(s) {
  const p = String(s).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(p + '='.repeat((4 - (p.length % 4)) % 4), 'base64').toString('utf8');
}
function sign(payload, secret) {
  const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  // 允许直接传对象（内部统一 stringify）：否则 /crack 传解析后的对象会抛 ERR_INVALID_ARG_TYPE
  const body = b64u(typeof payload === 'string' ? payload : JSON.stringify(payload));
  const sig = b64u(crypto.createHmac('sha256', secret).update(head + '.' + body).digest());
  return head + '.' + body + '.' + sig;
}

app.get('/', (req, res) => {
  const token = sign(JSON.stringify({ user: 'guest', role: 'guest' }), REAL_SECRET);
  res.send(`<!doctype html><meta charset=utf-8>
  <h3>JWT 靶机（授权训练）</h3>
  <p>你拿到的令牌（role=guest）：</p>
  <pre style="background:#eee;padding:8px;overflow:auto">${token}</pre>
  <ol>
    <li>先 <a href="/decode?token=${token}">/decode</a> 看 payload —— 会发现它只是 base64，不是加密。</li>
    <li>试着用弱密钥猜签名：<a href="/crack?token=${token}">/crack</a></li>
    <li>把 role 改成 admin 并签名，再访问 <a href="/admin">/admin</a> 拿越权。</li>
  </ol>
  <form method=post action=/admin>
    <textarea name=token rows=3 cols=80>${token}</textarea><br>
    <button>带此令牌访问 /admin</button>
  </form>
  <p>提示：把 payload 改成 <code>{"user":"guest","role":"admin"}</code> 后重新 base64url 编码，
  再用猜到的密钥签一次即可。</p>`);
});

// 教学点①：payload 只是 base64，可读
app.get('/decode', (req, res) => {
  const parts = String(req.query.token || '').split('.');
  if (parts.length !== 3) return res.status(400).json({ ok: false, error: '令牌格式不对' });
  let payload;
  try { payload = JSON.parse(b64uDecode(parts[1])); } catch (e) { payload = { error: '解析失败' }; }
  return res.json({ ok: true, header: JSON.parse(b64uDecode(parts[0])), payload,
    tip: 'payload 未加密，只是 base64url —— 不要往 JWT 里放敏感信息' });
});

// 教学点②：弱密钥可被离线猜出
app.get('/crack', (req, res) => {
  const token = String(req.query.token || '');
  const found = WEAK_SECRETS.find((s) => sign(JSON.parse(b64uDecode(token.split('.')[1])), s) === token);
  return res.json({ ok: true, secret: found || null,
    tried: WEAK_SECRETS.length,
    tip: found ? '密钥被猜出来了：' + found + '（真实场景应使用足够长的高熵密钥）'
               : '这轮没猜出来（说明密钥强度够）' });
});

// 教学点③：能签名就能改 role（GET 走查询参数，POST 走表单体，不要重定向成死循环）
app.all('/admin', (req, res) => {
  const token = String((req.query && req.query.token) || (req.body && req.body.token) || '');
  const parts = token.split('.');
  let payload = null;
  let sigOk = false;
  if (parts.length === 3) {
    try { payload = JSON.parse(b64uDecode(parts[1])); } catch (e) { payload = null; }
    sigOk = parts[2] === b64u(crypto.createHmac('sha256', REAL_SECRET).update(parts[0] + '.' + parts[1]).digest());
  }
  if (sigOk && payload && payload.role === 'admin') {
    return res.send(`<h3>越权成功</h3><p>你以 <b>admin</b> 身份进入了管理页：FLAG{sectutor-jwt-weak-secret}</p>
      <p>根因：签名密钥是弱口令 + 服务端信任 payload 里的 role。</p>
      <p>防御：使用强密钥（≥32 字节随机）、校验 alg 不被降级为 none、角色从服务端查询而非信任令牌。</p>`);
  }
  return res.status(403).send(`<h3>拒绝访问</h3><p>签名有效=${sigOk}，role=${payload ? payload.role : '未知'}</p>
    <p>先 <a href="/crack?token=${token}">/crack</a> 拿到密钥，再改 role 重新签名。</p>`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log('[lab-jwt] listening on ' + PORT));
