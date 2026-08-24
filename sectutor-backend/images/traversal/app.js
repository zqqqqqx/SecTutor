/*
 * 授权训练靶机：路径遍历（故意脆弱）
 * ⚠️ 仅用于 SecTutor 隔离实验环境，严禁部署到任何非授权/生产网络。
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

function escape(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

app.get('/', (req, res) => {
  const f = req.query.file || 'welcome.txt';
  // 故意脆弱：未净化拼接路径（path.join 会规范化 ../）
  const target = path.join('/data', f);
  fs.readFile(target, (err, data) => {
    if (err) return res.send('读取失败: ' + escape(String(err.message)));
    res.send('<pre>' + escape(data.toString()) + '</pre>');
  });
});

app.listen(3000, () => console.log('traversal lab listening on 3000'));
