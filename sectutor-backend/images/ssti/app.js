/*
 * 授权训练靶机：服务端模板注入 SSTI（故意脆弱）
 * ⚠️ 仅用于 SecTutor 隔离实验环境，严禁部署到任何非授权/生产网络。
 *
 * 安全说明：**不调用 eval / new Function / vm**，不执行任意代码。
 * 这里实现一个"受限求值器"：只认少数演示用的表达式（算术、字符串拼接、config 泄漏），
 * 用来讲清"用户输入被当成模板语法执行"这件事本身。
 */
const express = require('express');

const app = express();
app.use(express.urlencoded({ extended: true }));

// 服务端"配置对象"——SSTI 的典型攻击目标（这里放的是假值）
const CONFIG = {
  appName: 'SectuTor Demo',
  secretKey: 'FLAG{sectutor-ssti-config-leak}',
  dbPassword: 'p@ssw0rd-demo',
  debug: true,
};

const TEMPLATE = '<h3>你好，{{name}}！</h3><p>本站共有 {{7*7}} 次访问。</p>';

/** 受限求值：只演示几类表达式，不做任意代码执行 */
function evalExpr(expr) {
  const e = String(expr).trim();
  if (/^-?\d+\s*([+\-*/])\s*-?\d+$/.test(e)) {
    const [a, op, b] = e.split(/\s*([+\-*/])\s*/);
    const x = Number(a), y = Number(b);
    const v = op === '+' ? x + y : op === '-' ? x - y : op === '*' ? x * y : y === 0 ? NaN : x / y;
    return String(v);
  }
  if (/^['"][^'"]*['"]\s*\+\s*['"][^'"]*['"]$/.test(e)) {
    return e.split('+').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).join('');
  }
  // 泄露配置（SSTI 最常见的利用点）
  const m = e.match(/^(?:config|settings)\.([A-Za-z_][A-Za-z0-9_]*)$/);
  if (m) return m[1] in CONFIG ? String(CONFIG[m[1]]) : '(undefined)';
  if (/^(?:config|settings)$/.test(e)) return JSON.stringify(CONFIG);
  // 其它一律原样返回，并标记未求值
  return '{{' + e + '}}';
}

function render(tpl, vars) {
  return String(tpl).replace(/\{\{([^{}]+)\}\}/g, (_, expr) => evalExpr(expr));
}

function page(input) {
  const tpl = input != null ? input : TEMPLATE;
  return `<!doctype html><meta charset=utf-8>
  <h3>名片页生成器（授权训练）</h3>
  <p>服务端把用户输入当模板渲染：<code>{{name}}</code> 会被替换成变量值。</p>
  <form method=post action=/>
    <textarea name=tpl rows=3 cols=80>${tpl.replace(/</g, '&lt;')}</textarea><br>
    <button>渲染</button>
  </form>
  <hr><div style="border:1px solid #ccc;padding:10px">${render(tpl, { name: '访客' })}</div>
  <p>提示：试着把模板里的 <code>{{name}}</code> 换成 <code>{{config.secretKey}}</code>；<code>{{7*7}}</code> 也会被算出来。</p>`;
}

app.get('/', (req, res) => res.send(page(null)));
app.post('/', (req, res) => res.send(page(req.body.tpl)));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log('[lab-ssti] listening on ' + PORT));
