/**
 * scan-images.js — 用 Trivy 扫描靶机镜像中的高危/严重漏洞。
 *
 * 这是本平台的「合规门禁」：任何含 HIGH/CRITICAL 漏洞的镜像都禁止上线，
 * 防止脆弱靶机本身成为被利用的入口。退出码：
 *   0  全部通过
 *   1  发现高危/严重漏洞（禁止上线）
 *   75 未安装 Trivy（跳过，提醒运维补装）
 *
 * 用法：node scripts/scan-images.js   （需本机已安装 trivy）
 */
const { execFile } = require('child_process');

const LABS = ['sqli', 'cmdi', 'xss', 'traversal', 'nosql'];

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = execFile(cmd, args, { windowsHide: true }, (err, stdout, stderr) => {
      if (err) return reject(Object.assign(err, { stdout, stderr }));
      resolve(stdout);
    });
    if (p.stdout) p.stdout.on('data', (d) => process.stdout.write(d));
    if (p.stderr) p.stderr.on('data', (d) => process.stderr.write(d));
  });
}

async function trivyAvailable() {
  return new Promise((resolve) => {
    execFile('trivy', ['--version'], { windowsHide: true }, (err) => resolve(!err));
  });
}

(async () => {
  const ok = await trivyAvailable();
  if (!ok) {
    console.error('⚠️ 未检测到 Trivy。镜像漏洞扫描是本平台合规必做项。');
    console.error('   安装：https://trivy.dev ｜ brew install trivy ｜ apt-get install trivy');
    console.error('   本次跳过扫描（退出码 75）。');
    process.exit(75);
  }

  let failed = 0;
  for (const lab of LABS) {
    const tag = `sectutor/lab-${lab}:latest`;
    console.log(`\n==> 扫描 ${tag}`);
    try {
      await run('trivy', ['image', '--exit-code', '1', '--severity', 'HIGH,CRITICAL', '--no-progress', tag]);
      console.log(`✅ ${tag} 未发现高危/严重漏洞`);
    } catch (e) {
      if (e.code === 'ENOENT') {
        console.error('❌ 未找到 trivy 命令。');
        process.exit(75);
      }
      // trivy 在发现漏洞时会以退出码 1 返回
      console.error(`⚠️ ${tag} 存在高危/严重漏洞，禁止上线（详见上方 Trivy 输出）。`);
      failed++;
    }
  }

  if (failed) {
    console.error(`\n❌ ${failed} 个镜像存在高危/严重漏洞，请修复基础镜像与依赖后重新扫描。`);
    process.exit(1);
  }
  console.log('\n🎉 全部靶机镜像扫描通过，可上线。');
})();
