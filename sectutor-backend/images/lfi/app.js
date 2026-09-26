/*
 * 授权训练靶机：文件包含与目录穿越 LFI（故意脆弱）
 * ⚠️ 仅用于 SecTutor 隔离实验环境，严禁部署到任何非授权/生产网络。
 *
 * 安全说明：**不读真实文件系统**。所有"文件"都在内存里的虚拟目录表中，
 * 只有三个虚构条目（问候语 / 假的 passwd / flag），用来演示：
 *   ① 朴素过滤（只查 "../"）可被 ……// 与 URL 编码绕过
 *   ② 拼接用户输入做路径查找 = 目录穿越
 */
const express = require('express');

const app = express();
app.use(express.urlencoded({ extended: true }));

// 虚拟文件系统（只有这些内容，绝不触碰真实磁盘）
const VFS = {
  'public/hello.txt': '你好，这是给访客看的公开文件。',
  'public/about.html': '<p>本站是 SecTutor 的授权训练靶机。</p>',
  'etc/passwd': 'root:x:0:0:root:/root:/bin/bash\nwww-data:x:33:33:www-data:/var/www:/usr/sbin/nologin\napp:x:1000:1000::/home/app:/bin/sh',
  'flag.txt': 'FLAG{sectutor-lfi-naive-traversal-filter}',
  'private/secret-plan.md': '（虚构）下季度安全演练计划：……',
};

/** 朴素过滤：只拦字符串 "../" —— 这正是真实世界最常见的错误写法 */
function naiveFilter(p) {
  return String(p).indexOf('../') >= 0;
}

/** 归一化路径（模拟操作系统解析 ../ 的行为），并去掉开头的 / 与 ./ */
function resolveName(raw) {
  const decoded = decodeURIComponent(String(raw).replace(/\\/g, '/'));
  const parts = [];
  decoded.split('/').forEach((seg) => {
    if (seg === '' || seg === '.') return;
    if (seg === '..') { parts.pop(); return; }
    parts.push(seg);
  });
  return parts.join('/');
}

function page(name, out, blocked) {
  return `<!doctype html><meta charset=utf-8>
  <h3>帮助中心（授权训练）</h3>
  <p>本站按文件名读取"帮助文档"：<code>/read?file=public/hello.txt</code></p>
  <form method=get action=/read>
    文件名：<input name=file size=40 value="${name || ''}" placeholder="public/hello.txt">
    <button>读取</button>
  </form>
  ${blocked ? '<p style="color:#c00">被拦下了：检测到字面量 "../"（拒绝型过滤）。试试 URL 编码绕过：<code>%2e%2e%2f</code></p>' : ''}
  ${out != null ? '<pre style="background:#eee;padding:10px;white-space:pre-wrap">' + out.replace(/</g, '&lt;') + '</pre>' : ''}
  <p>提示：过滤只检查原文里的 <code>../</code>，用 <code>%2e%2e%2f</code> 编码就能绕过；
  也可以直接 <code>file=flag.txt</code> 看"任意文件可读"。</p>
  <p>另注：若服务端用的是「删除」型过滤（把 ../ 直接删掉），则 <code>....//</code> 删除后会还原成 <code>../</code> —— 两种写法都能出事。</p>`;
}

app.get('/', (req, res) => res.send(page(null, null, false)));

app.get('/read', (req, res) => {
  // ⚠️ 这里刻意复现真实漏洞的成因：**过滤的是原始串、使用的是解码后的值**。
  // express 会把 req.query 自动 URL 解码（%2e%2e%2f → ../），
  // 所以如果在 req.query 上做过滤，就只能拦住未编码的 ../，
  // 而编码写法照样通过 —— 这正是 LFI 绕过最常见的来源。
  const rawQuery = String(req.originalUrl || req.url).split('?')[1] || '';
  const m = /(?:^|&)file=([^&]*)/.exec(rawQuery);
  const rawValue = m ? m[1] : '';
  if (naiveFilter(rawValue)) return res.send(page(rawValue, null, true));   // 只查原始串里的字面量 ../
  const name = resolveName(rawValue);                                       // 这里才解码并归一化
  const content = VFS[name];
  if (content == null) return res.send(page(rawValue, '（虚拟目录中没有这个文件：' + name + '）', false));
  return res.send(page(rawValue, content, false));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log('[lab-lfi] listening on ' + PORT));
