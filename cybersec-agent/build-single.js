/* SecTutor 单文件打包：把 index.html + styles.css + data.js + app.js 内联为一个离线 HTML
 * 用法：node build-single.js  ->  生成 sec-tutor.html
 * 注意：JS 字符串里可能出现 </script>，直接内联会提前闭合脚本块，需转义为 <\/script>
 */
const fs = require("fs");
const path = require("path");

const dir = __dirname;
let html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
const css = fs.readFileSync(path.join(dir, "styles.css"), "utf8");
let dataJs = fs.readFileSync(path.join(dir, "data.js"), "utf8");
let appJs = fs.readFileSync(path.join(dir, "app.js"), "utf8");

// 转义内联 JS 中的 </script>，避免提前闭合
const esc = (s) => s.replace(/<\/script>/gi, "<\\/script>");
dataJs = esc(dataJs);
appJs = esc(appJs);

// 用函数式替换，避免 $ 序列被 String.replace 当作特殊模式（否则 $$ 会变成 $ 导致重复声明）
html = html
  .replace(/<link rel="stylesheet" href="styles\.css" \/>/, () => `<style>\n${css}\n</style>`)
  .replace(/<script src="data\.js"><\/script>/, () => `<script>\n${dataJs}\n</script>`)
  .replace(/<script src="app\.js"><\/script>/, () => `<script>\n${appJs}\n</script>`);

const out = path.join(dir, "sec-tutor.html");
fs.writeFileSync(out, html, "utf8");
console.log("生成单文件:", out, `(${(fs.statSync(out).size / 1024).toFixed(1)} KB)`);
