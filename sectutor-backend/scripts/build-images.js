/**
 * build-images.js — 依次构建 5 个授权训练靶机镜像。
 *
 * 设计约束（合规必做）：
 *   - 仅使用本地预置的漏洞镜像模板，绝不允许运行时拉取任意镜像。
 *   - 镜像必须由运维在隔离主机上预先 build + scan 后方可被后端使用。
 *
 * 用法：node scripts/build-images.js   （需本机已安装 docker 且 daemon 可达）
 */
const { execFile } = require('child_process');
const path = require('path');

const LABS = ['sqli', 'cmdi', 'xss', 'traversal', 'nosql'];

function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const p = execFile(cmd, args, { cwd, windowsHide: true }, (err, stdout, stderr) => {
      if (err) return reject(Object.assign(err, { stdout, stderr }));
      resolve(stdout);
    });
    if (p.stdout) p.stdout.on('data', (d) => process.stdout.write(d));
    if (p.stderr) p.stderr.on('data', (d) => process.stderr.write(d));
  });
}

(async () => {
  for (const lab of LABS) {
    const tag = `sectutor/lab-${lab}:latest`;
    const cwd = path.join(__dirname, '..', 'images', lab);
    console.log(`\n==> 构建镜像 ${tag}`);
    try {
      await run('docker', ['build', '-t', tag, '.'], cwd);
      console.log(`✅ ${tag} 构建完成`);
    } catch (e) {
      if (e.code === 'ENOENT') {
        console.error('❌ 未找到 docker 命令。请先安装 Docker Desktop / Docker Engine 并确保 docker 在 PATH 中。');
        process.exit(2);
      }
      console.error(`❌ ${tag} 构建失败：`, (e.stderr || e.message || '').toString());
      process.exit(1);
    }
  }
  console.log('\n🎉 全部靶机镜像构建完成。部署前请运行 `npm run scan:images` 扫描漏洞。');
})();
