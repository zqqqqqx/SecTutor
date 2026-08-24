/*
 * 授权训练靶机：命令注入（故意脆弱）
 * ⚠️ 仅用于 SecTutor 隔离实验环境，严禁部署到任何非授权/生产网络。
 */
const express = require('express');
const { exec } = require('child_process');
const app = express();
app.use(express.urlencoded({ extended: true }));

function escape(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

app.get('/', (req, res) => {
  res.send(`<!doctype html><meta charset=utf-8>
  <h3>命令注入靶机（授权训练）</h3>
  <form method=post action=/ping>
    host: <input name=h placeholder="127.0.0.1">
    <button>ping</button>
  </form>
  <p>试着输入 <code>127.0.0.1; id</code> 或 <code>127.0.0.1 && cat /etc/passwd</code>。</p>`);
});

// 故意脆弱：直接把用户输入拼进 shell
app.post('/ping', (req, res) => {
  const h = req.body.h || '';
  exec('ping -c 1 ' + h, (err, stdout) => {
    if (err) return res.send('<pre>' + escape(String(err)) + '</pre>');
    res.send('<pre>' + escape(stdout) + '</pre>');
  });
});

app.listen(3000, () => console.log('cmdi lab listening on 3000'));
