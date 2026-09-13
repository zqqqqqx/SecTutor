// 校验 data.js 中 quizzes 的完备性与 answer 下标合法性（不依赖浏览器）
const fs = require("fs");
const path = require("path");
const code = fs.readFileSync(path.join(__dirname, "data.js"), "utf8");
const sandbox = {};
const vm = require("vm");
vm.createContext(sandbox);
vm.runInContext(code + "\n; this.__SD = SEC_DATA;", sandbox);
const SD = sandbox.__SD;
const quizzes = SD.quizzes;
const cats = new Set(SD.categories.map((c) => c.id));
const levels = new Set(["入门", "初级", "中级", "高级"]);
let bad = 0;
const idSeen = {};
const byCat = {};
const byLevel = {};
for (const q of quizzes) {
  const tag = q.id || "(no id)";
  if (idSeen[tag]) { console.log("重复 id:", tag); bad++; }
  idSeen[tag] = 1;
  if (!Array.isArray(q.options) || q.options.length !== 4) { console.log("选项数异常:", tag, q.options && q.options.length); bad++; }
  if (typeof q.answer !== "number" || q.answer < 0 || q.answer >= q.options.length) { console.log("answer 下标越界:", tag, q.answer); bad++; }
  if (!cats.has(q.cat)) { console.log("未知领域:", tag, q.cat); bad++; }
  if (!levels.has(q.level)) { console.log("未知档位:", tag, q.level); bad++; }
  if (typeof q.q !== "string" || !q.q.trim()) { console.log("题目为空:", tag); bad++; }
  if (typeof q.explain !== "string" || !q.explain.trim()) { console.log("解析为空:", tag); bad++; }
  byCat[q.cat] = (byCat[q.cat] || 0) + 1;
  byLevel[q.level] = (byLevel[q.level] || 0) + 1;
}
console.log("总题数:", quizzes.length);
console.log("按领域:", JSON.stringify(byCat));
console.log("按档位:", JSON.stringify(byLevel));

// —— 覆盖守门：每个领域都必须有题（v1.5.1 之前 network/cloud/blue 三个领域一道题都没有，
//    导致「自测」根本覆盖不到这些领域，却没有任何检查发现）——
const topicCount = {};
SD.categories.forEach((c) => { topicCount[c.id] = (c.topics || []).length; });
console.log("\n领域覆盖（题数 / 知识点数）:");
let thin = [];
SD.categories.forEach((c) => {
  const qn = byCat[c.id] || 0;
  const tn = topicCount[c.id] || 0;
  const flag = qn === 0 ? "  ← 零题目（不合格）" : (qn < tn ? "  ← 题量少于知识点" : "");
  if (qn === 0) { bad++; }
  else if (qn < tn) { thin.push(c.name); }
  console.log("  " + c.name.padEnd(20) + String(qn).padStart(4) + " / " + String(tn).padStart(3) + flag);
});
if (thin.length) console.log("提示（不判失败）：题量少于知识点数的领域 → " + thin.join("、"));
console.log(bad === 0 ? "校验通过：全部题目结构合法，且每个领域都有题" : ("发现 " + bad + " 处问题"));
process.exit(bad === 0 ? 0 : 1);
