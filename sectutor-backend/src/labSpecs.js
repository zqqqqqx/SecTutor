/**
 * labSpecs.js — 把前端「测试点」(labId) 映射到其对应的训练镜像规格。
 *
 * 前端 SecTutor 的每个可交互演练（lab）若需要真实隔离环境，
 * 则在此登记一条 LabSpec；纯前端计算的演练（如 Base64 / 凯撒 / 判断题）
 * 不在此登记，调用 createEnv 会返回 NO_SPEC，由前端继续走本地仿真。
 */
const labSpecs = {
  lab_sqli: {
    labId: 'lab_sqli',
    title: 'SQL 注入登录绕过',
    image: 'sectutor/lab-sqli:latest',
    internalPort: 3000,
    accessMode: 'http',
    note: '授权靶机：弱登录校验演示，仅用于理解 SQLi 原理与防御。',
  },
  lab_cmdi: {
    labId: 'lab_cmdi',
    title: '命令注入',
    image: 'sectutor/lab-cmdi:latest',
    internalPort: 3000,
    accessMode: 'http',
    note: '授权靶机：故意脆弱的 ping 工具，演示命令拼接注入。',
  },
  lab_xss: {
    labId: 'lab_xss',
    title: '反射型 XSS',
    image: 'sectutor/lab-xss:latest',
    internalPort: 3000,
    accessMode: 'http',
    note: '授权靶机：未编码的回显点，演示反射型 XSS。',
  },
  lab_traversal: {
    labId: 'lab_traversal',
    title: '路径遍历',
    image: 'sectutor/lab-traversal:latest',
    internalPort: 3000,
    accessMode: 'http',
    note: '授权靶机：未净化的文件读取，演示 ../ 越权读取。',
  },
  lab_nosql: {
    labId: 'lab_nosql',
    title: 'NoSQL 注入',
    image: 'sectutor/lab-nosql:latest',
    internalPort: 3000,
    accessMode: 'http',
    note: '授权靶机：MongoDB 风格查询构造，演示 $ne/$or 绕过。',
  },
};

/** 取某测试点的规格；不存在返回 null（即无需独立环境）。 */
function getSpec(labId) {
  return labSpecs[labId] || null;
}

/** 仅供前端参考：列出所有支持独立环境的测试点 id。 */
function supportedLabIds() {
  return Object.keys(labSpecs);
}

module.exports = { labSpecs, getSpec, supportedLabIds };
