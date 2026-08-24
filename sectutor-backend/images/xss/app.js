/*
 * 授权训练靶机：反射型 XSS（故意脆弱）
 * ⚠️ 仅用于 SecTutor 隔离实验环境，严禁部署到任何非授权/生产网络。
 */
const express = require('express');
const app = express();

function escapeAttr(s) {
  return String(s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])
  );
}

app.get('/', (req, res) => {
  const q = req.query.q || '';
  // 注意：<p> 中直接输出 q（未编码）→ 反射型 XSS 演示点
  res.send(`<!doctype html><meta charset=utf-8>
  <h3>反射型 XSS 靶机（授权训练）</h3>
  <form method=get action=/>
    输入: <input name=q value="${escapeAttr(q)}"> <button>提交</button>
  </form>
  <p>你输入的是：${q}</p>
  <p>试着输入 <code>&lt;script&gt;alert(1)&lt;/script&gt;</code> 或 <code>&lt;img src=x onerror=alert(1)&gt;</code>。</p>`);
});

app.listen(3000, () => console.log('xss lab listening on 3000'));
