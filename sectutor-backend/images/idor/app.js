/*
 * 授权训练靶机：越权访问 IDOR（故意脆弱）
 * ⚠️ 仅用于 SecTutor 隔离实验环境，严禁部署到任何非授权/生产网络。
 *
 * 安全说明：数据全在内存里（虚构订单），不读写真实文件与数据库；
 * 卡号只显示后四位，避免出现任何真实可用的敏感数据。
 */
const express = require('express');

const app = express();
app.use(express.urlencoded({ extended: true }));

// 虚构数据：两个用户的订单
const ORDERS = {
  1001: { id: 1001, owner: 'alice', item: '笔记本支架', amount: 129, card: '**** 4111' },
  1002: { id: 1002, owner: 'alice', item: '机械键盘', amount: 599, card: '**** 4111' },
  2001: { id: 2001, owner: 'bob', item: '服务器托管年费', amount: 12800, card: '**** 8802' },
  2002: { id: 2002, owner: 'bob', item: '运维服务合同', amount: 45000, card: '**** 8802' },
};
const ME = 'alice';   // 你当前登录的身份

function page(id, note) {
  const o = ORDERS[id];
  const isMine = o && o.owner === ME;
  return `<!doctype html><meta charset=utf-8>
  <h3>订单中心（授权训练）</h3>
  <p>当前登录：<b>${ME}</b>　｜　你会看到的订单都应该是自己的。</p>
  <form method=get action=/order>
    订单号：<input name=id value="${id || ''}" placeholder="试试 1001 / 2001">
    <button>查看</button>
  </form>
  ${o ? `<div style="border:1px solid #ccc;padding:10px;margin-top:10px">
      <p><b>#${o.id}</b> ${o.item}　¥${o.amount}</p>
      <p>归属：${o.owner}　卡号：${o.card}</p>
      ${isMine
        ? '<p style="color:#0a0">✓ 这是你的订单</p>'
        : `<p style="color:#c00">⚠ 你看到了 <b>${o.owner}</b> 的订单 —— 服务端没有校验归属（越权）</p>
           <p>FLAG{sectutor-idor-missing-ownership-check}</p>`}
    </div>` : '<p>订单不存在</p>'}
  ${note ? '<p>' + note + '</p>' : ''}
  <p>提示：把订单号从 1001 改成 2001（顺序猜号）——同一个人能看到别人的订单。</p>`;
}

app.get('/', (req, res) => {
  const mine = Object.values(ORDERS).filter((o) => o.owner === ME).map((o) => o.id).join(', ');
  res.send(page(null, '你的订单号：' + mine));
});

// 故意脆弱：只按 id 取订单，**不校验归属**
app.get('/order', (req, res) => {
  const id = parseInt(req.query.id, 10);
  res.send(page(Number.isFinite(id) ? id : null, null));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log('[lab-idor] listening on ' + PORT));
