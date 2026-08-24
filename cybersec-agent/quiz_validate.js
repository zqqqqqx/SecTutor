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
console.log(bad === 0 ? "校验通过：全部题目结构合法" : ("发现 " + bad + " 处问题"));
process.exit(bad === 0 ? 0 : 1);
