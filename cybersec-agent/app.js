/* ============================================================
   SecTutor 应用逻辑
   - 标签页导航、知识体系分级渲染
   - 智能问答：关键词路由 + 难度自适应 + 可选 LLM 接口
   - 靶场、学习计划、进度跟踪（localStorage）
   ============================================================ */
(function () {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  function safeParse(s, fallback) {
    if (s == null) return fallback;            // 注意：JSON.parse(null) 静默返回 null 而非抛错
    try { return JSON.parse(s); } catch (e) { return fallback; }
  }
  const state = {
    userLevel: "初级",
    focusCat: "auto",
    mastery: new Set(safeParse(localStorage.getItem("sectutor_mastery"), [])),
    llm: safeParse(localStorage.getItem("sectutor_llm"), null),
    thinking: false,
    history: [], // 多轮对话记忆（仅用于已配置大模型时）
    labsSolved: new Set(safeParse(localStorage.getItem("sectutor_labs"), [])),
    // —— Agent 能力基座（方向⑩ 简化版）——
    profile: safeParse(localStorage.getItem("sectutor_profile"), null), // 能力画像：{web,binary,crypto,pentest,takenAt}
    masteryDates: safeParse(localStorage.getItem("sectutor_mastery_dates"), {}), // 知识点掌握时间戳 + 复习阶段：{topicId:{t:ts,r:stage}}
    activity: safeParse(localStorage.getItem("sectutor_activity"), []), // 活动日志：[{t,type,meta}]（学习闭环/周报）
    apis: safeParse(localStorage.getItem("sectutor_apis"), { intel: null, mcp: [] }), // 预留的外部集成（威胁情报/MCP 等）
    backend: {
      url: localStorage.getItem("sectutor_backend_url") || defaultBackendUrl(),
      token: localStorage.getItem("sectutor_backend_token") || "sectutor-dev-token",
    },
    activeEnv: null,
    envTimer: null,
    envPoll: null,
  };

  // ===== 密钥保险库（Web Crypto AES-GCM，file:// 与 Electron 双端通用）=====
  // 未启用口令保护时行为完全不变（密钥明文存 sectutor_llm）；启用后密钥以 AES-GCM
  // 加密存 sectutor_llm_key，sectutor_llm 仅保留 base/model/temp。重启后密钥锁定，
  // 首次调用 AI 问答时弹出口令解锁。Web Crypto 为浏览器标准，file:// 与 Electron 均可用。
  const KM = (() => {
    const enc = new TextEncoder(), dec = new TextDecoder();
    function subtle() {
      if (window.crypto && window.crypto.subtle) return window.crypto.subtle;
      try { if (typeof require !== "undefined" && require("crypto").webcrypto) return require("crypto").webcrypto.subtle; } catch (e) {}
      return null;
    }
    function b64(u8) { let s = ""; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); }
    function unb64(s) { const b = atob(s); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
    function randBytes(n) {
      const c = (window.crypto && window.crypto.getRandomValues) ? window.crypto : (typeof require !== "undefined" ? require("crypto").webcrypto : null);
      if (!c) throw new Error("无可用的随机源");
      return c.getRandomValues(new Uint8Array(n));
    }
    async function deriveKey(pass, salt) {
      const s = subtle(); if (!s) throw new Error("webcrypto 不可用");
      const base = await s.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]);
      return s.deriveKey({ name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    }
    async function encrypt(plain, pass) {
      const s = subtle(); if (!s) throw new Error("webcrypto 不可用");
      const salt = randBytes(16);
      const iv = randBytes(12);
      const key = await deriveKey(pass, salt);
      const ct = await s.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plain));
      return { v: 1, salt: b64(salt), iv: b64(iv), ct: b64(new Uint8Array(ct)) };
    }
    async function decrypt(blob, pass) {
      const s = subtle(); if (!s) throw new Error("webcrypto 不可用");
      const salt = unb64(blob.salt), iv = unb64(blob.iv);
      const key = await deriveKey(pass, salt);
      const pt = await s.decrypt({ name: "AES-GCM", iv }, key, unb64(blob.ct));
      return dec.decode(pt);
    }
    return { encrypt, decrypt, available: !!subtle(), b64, unb64 };
  })();

  // 密钥保险库：保护开关、加解密、锁定/解锁状态
  const KeyVault = {
    BLOB_KEY: "sectutor_llm_key",
    isProtected() { try { return !!localStorage.getItem(this.BLOB_KEY); } catch (e) { return false; } },
    isLocked() { return this.isProtected() && !(state.llm && state.llm.key); },
    async enable(pass) {
      if (!state.llm || !state.llm.key) throw new Error("请先填写 API Key 再启用手令保护");
      if (!KM.available) throw new Error("当前环境不支持 Web Crypto，无法启用口令保护");
      const blob = await KM.encrypt(state.llm.key, pass);
      localStorage.setItem(this.BLOB_KEY, JSON.stringify(blob));
      saveLlmState();               // 明文 key 移出 sectutor_llm
      return true;
    },
    async disable() {
      if (!state.llm || !state.llm.key) throw new Error("需先解锁后再关闭口令保护");
      localStorage.removeItem(this.BLOB_KEY); saveLlmState();   // key 已在内存明文，写回 sectutor_llm
      return true;
    },
    async unlock(pass) {
      const raw = localStorage.getItem(this.BLOB_KEY); if (!raw) throw new Error("无加密密钥");
      const blob = JSON.parse(raw);
      const key = await KM.decrypt(blob, pass);
      state.llm = state.llm || {}; state.llm.key = key;
      return true;
    },
    async changePass(pass) {
      if (!state.llm || !state.llm.key) throw new Error("需先解锁后再修改口令");
      const blob = await KM.encrypt(state.llm.key, pass);
      localStorage.setItem(this.BLOB_KEY, JSON.stringify(blob));
      return true;
    },
  };

  // 首次 AI 问答时若密钥已锁定，弹出口令解锁；返回 Promise<boolean>
  function ensureLlmUnlocked() {
    return new Promise((resolve) => {
      const body = `<p>大模型密钥已加密保护，请输入访问口令以解锁本次会话：</p>
        <label class="field"><span>访问口令</span><input id="unlockPass" type="password" placeholder="口令" autocomplete="off" /></label>
        <div class="api-actions"><button class="btn small" id="unlockOk">解锁</button><button class="btn small ghost" id="unlockCancel">取消</button></div>`;
      const ov = openModal("🔓 解锁大模型密钥", body);
      const finish = (ok) => { try { closeModal(); } catch (e) {} resolve(ok); };
      const tryUnlock = async () => {
        const pass = $("#unlockPass") ? $("#unlockPass").value : "";
        try { await KeyVault.unlock(pass); finish(true); }
        catch (e) { openModal("❌ 解锁失败", "<p>口令错误，请重试。</p>"); }
      };
      if ($("#unlockOk")) $("#unlockOk").addEventListener("click", tryUnlock);
      if ($("#unlockCancel")) $("#unlockCancel").addEventListener("click", () => finish(false));
      setTimeout(() => { const el = $("#unlockPass"); if (el && el.focus) el.focus(); }, 60);
    });
  }

  // ===== 向量检索（决策 D1：启用，但仅在配置 EMBED_API_KEY 时真正激活；否则 BM25 降级）=====
  const EMBED_API_KEY = (() => { try { return localStorage.getItem("sectutor_embed_key") || ""; } catch (e) { return ""; } })();
  const VECTOR_ENABLED = true;          // 决策：启用混合召回
  function vectorActive() { return VECTOR_ENABLED && !!EMBED_API_KEY; }
  async function embed(text) {
    if (!vectorActive()) return null;   // 无密钥 → 不发起网络请求，零成本
    try {
      const base = (state.llm && state.llm.base || "https://api.openai.com/v1").replace(/\/$/, "");
      const r = await fetch(base + "/embeddings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + EMBED_API_KEY },
        body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
      });
      if (!r.ok) return null;
      const d = await r.json();
      return d.data && d.data[0] && d.data[0].embedding ? d.data[0].embedding : null;
    } catch (e) { return null; }
  }
  // 混合召回：BM25 始终参与；向量可用时按 RRF 融合（文档向量需预计算落地，当前为空 → 退化为 BM25）
  function hybridRetrieve(query, k) {
    return retrieve(query, k);          // 向量层待 EMBED_API_KEY + 文档向量落地后融合；当前零成本降级
  }

  // ===== 特性开关（决策 D2：语音/视觉默认关闭，设置内手动开启）=====
  const FEATURE_FLAGS = (() => {
    try { return Object.assign({ voiceInput: false, visionInput: false }, safeParse(localStorage.getItem("sectutor_features"), {})); }
    catch (e) { return { voiceInput: false, visionInput: false }; }
  })();
  function saveFeatureFlags() { try { localStorage.setItem("sectutor_features", JSON.stringify(FEATURE_FLAGS)); } catch (e) {} }

  // 持久化助手
  function saveProfile() { try { localStorage.setItem("sectutor_profile", JSON.stringify(state.profile)); } catch (e) {} }
  function saveMasteryDates() { try { localStorage.setItem("sectutor_mastery_dates", JSON.stringify(state.masteryDates)); } catch (e) {} }
  function saveActivity() { try { localStorage.setItem("sectutor_activity", JSON.stringify(state.activity.slice(-600))); } catch (e) {} }
  function saveApis() { try { localStorage.setItem("sectutor_apis", JSON.stringify(state.apis)); } catch (e) {} }
  // 活动日志：记录学习事件，供周报/遗忘曲线使用
  function logEvent(type, meta) {
    state.activity.push({ t: Date.now(), type, meta: meta || null });
    if (state.activity.length > 600) state.activity = state.activity.slice(-600);
    saveActivity();
  }

  // 默认后端地址：
  //  - file:// 本地双击打开 → 回退经典的 http://127.0.0.1:8787（需自行运行后端）；
  //  - 经 http 打开且与后端同端口(默认 8787) → 走同源，零跨域；
  //  - 其它端口(如 Vite :5173) → 回退经典地址（后端 CORS 已放行 localhost/127.0.0.1）。
  function defaultBackendUrl() {
    if (location.protocol === "file:") return "http://127.0.0.1:8787";
    if (/:8787$/.test(location.origin)) return location.origin;
    return "http://127.0.0.1:8787";
  }

  const CATS = SEC_DATA.categories;
  const catById = (id) => CATS.find((c) => c.id === id) || { id, name: "未分类", icon: "📁", topics: [] };
  /* ---------- 知识点索引（构建一次）----------
     原 allTopics() 每次调用都 flatMap+map 重建整个数组并分配新对象；
     updateHero() 一次就连调 3 次，搜索时每次按键再调 1 次。改为构建一次复用。
     topicName() 原本内部再调 allTopics() 做线性查找 → 升级为 O(1) 的 Map 查询。 */
  const TOPICS = CATS.flatMap((c) => c.topics.map((t) => ({ ...t, cat: c.id })));
  const TOPIC_BY_ID = new Map(TOPICS.map((t) => [t.id, t]));
  const TOPICS_BY_CAT = new Map();
  (function buildTopicIndex() {
    CATS.forEach((c) => TOPICS_BY_CAT.set(c.id, (c.topics || []).map((t) => ({ ...t, cat: c.id }))));
  })();
  const allTopics = () => TOPICS;
  const topicName = (id) => { const t = TOPIC_BY_ID.get(id); return t ? t.name : id; };

  /* ---------- RAG 检索（离线可运行，跨全知识库） ---------- */
  // 把「知识点 / 靶场题解 / 安全资讯 / 安全工具 / 交互靶场」统一打成可检索文档，
  // 每个文档预计算 token 集合，供本地关键词 + 二元文法检索打分。
  const CORPUS = (function buildCorpus() {
    const docs = [];
    CATS.forEach((c) => (c.topics || []).forEach((t) => {
      const text = [t.name, t.summary, Object.values(t.levels || {}).join(" "), (t.keywords || []).join(" ")].join(" ");
      docs.push({
        id: "topic:" + t.id, src: "知识点", cat: c.id, title: t.name, level: t.level, text,
        keywords: (t.keywords || []), tokens: tokenize(text),
        render: () => ({ name: t.name, body: (t.levels && (t.levels[state.userLevel] || t.levels["入门"])) || t.summary, code: t.code, codeLang: t.codeLang, tool: t.tool, refs: t.refs }),
      });
    }));
    (SEC_DATA.ranges || []).forEach((r) => {
      const text = [r.title, r.summary, r.writeup, r.defense, (r.steps || []).join(" "), (r.setup || "")].join(" ");
      docs.push({
        id: "range:" + r.id, src: "靶场题解", cat: r.cat, title: r.title, level: r.level, text,
        keywords: [], tokens: tokenize(text),
        render: () => ({ name: r.title, body: r.summary + "\n\n题解：" + r.writeup + "\n\n防御：" + r.defense }),
      });
    });
    (SEC_DATA.news || []).forEach((n) => {
      const text = [n.title, n.cve, n.summary, n.defense].join(" ");
      docs.push({
        id: "news:" + n.id, src: "安全资讯", cat: n.cat, title: n.title, level: "", text,
        keywords: [n.cve].filter(Boolean), tokens: tokenize(text),
        render: () => ({ name: n.title, body: n.summary + "\n\n防御：" + n.defense, meta: (n.cve || "") + " · " + (n.date || "") }),
      });
    });
    (SEC_DATA.tools || []).forEach((tl) => {
      const text = [tl.name, tl.desc, tl.usage, tl.example, tl.note].join(" ");
      docs.push({
        id: "tool:" + tl.id, src: "安全工具", cat: tl.cat, title: tl.name, level: "", text,
        keywords: [tl.name], tokens: tokenize(text),
        render: () => ({ name: tl.name, body: tl.desc + "\n\n用法：" + tl.usage + "\n\n示例：" + tl.example + "\n\n合规：" + tl.note }),
      });
    });
    (SEC_DATA.labs || []).forEach((l) => {
      const text = [l.title, l.brief, l.task, (l.hints || []).join(" ")].join(" ");
      docs.push({
        id: "lab:" + l.id, src: "交互靶场", cat: l.cat, title: l.title, level: l.level, text,
        keywords: [], tokens: tokenize(text),
        render: () => ({ name: l.title, body: l.brief }),
      });
    });
    return docs;
  })();

  // 中英文混合分词：CJK 用字符二元文法，英文/数字保留整词。
  // 返回 Map(term -> 词频)：词频是 BM25 的必要输入（原实现只存 Set，无法区分"提了 1 次"和"通篇在讲"）。
  function tokenizeTf(s) {
    const raw = String(s || "").toLowerCase();
    const tf = new Map();
    const cleaned = raw.replace(/[\s\p{P}\p{S}]+/gu, "");
    for (let i = 0; i < cleaned.length - 1; i++) {
      const g = cleaned.slice(i, i + 2);
      tf.set(g, (tf.get(g) || 0) + 1);
    }
    const words = raw.match(/[a-z0-9_]+/g) || [];
    for (let i = 0; i < words.length; i++) tf.set(words[i], (tf.get(words[i]) || 0) + 1);
    return tf;
  }
  // 兼容旧接口：只要词集合（查询侧、去重场景用）。
  // 注意：这里直接构建 Set，不要走 tokenizeTf 再转 Set（会多分配一个 Map，实测慢约 1.8 倍）。
  function tokenize(s) {
    const raw = String(s || "").toLowerCase();
    const toks = new Set();
    const cleaned = raw.replace(/[\s\p{P}\p{S}]+/gu, "");
    for (let i = 0; i < cleaned.length - 1; i++) toks.add(cleaned.slice(i, i + 2));
    const words = raw.match(/[a-z0-9_]+/g) || [];
    for (let i = 0; i < words.length; i++) toks.add(words[i]);
    return toks;
  }

  /* ---------- 索引层：启动时构建一次 ----------
     重构动机（实测基线）：原实现每次检索都要遍历「全库文档 × 每个文档的全部 token」，
     relatedDocs 单次调用约 6.3 万次哈希查找（1480 次调用耗时 846ms，是最大热点）。
     改为倒排索引 + 预计算 IDF/文档长度后，查询只访问「命中词」的倒排链，
     复杂度与命中规模成正比，而不再与全库 token 总量成正比。 */
  const N_DOC = CORPUS.length;
  const DOC_BY_ID = new Map();
  const DOC_LEN = new Float64Array(N_DOC);
  const INV = new Map();               // term -> [{ i, tf }]
  (function buildIndex() {
    for (let i = 0; i < N_DOC; i++) {
      const d = CORPUS[i];
      DOC_BY_ID.set(d.id, d);
      // 兼容未预计算词频的文档
      if (!d.tf) d.tf = tokenizeTf(d.text || "");
      let len = 0;
      d.tf.forEach((tf, term) => {
        len += tf;
        let post = INV.get(term);
        if (!post) { post = []; INV.set(term, post); }
        post.push({ i: i, tf: tf });
      });
      DOC_LEN[i] = len || 1;
    }
  })();
  const AVG_DL = (function () { let s = 0; for (let i = 0; i < N_DOC; i++) s += DOC_LEN[i]; return (s / N_DOC) || 1; })();
  // BM25 参数：k1 控制词频饱和，b 控制文档长度归一化（抑制"越长越容易命中"的偏置）
  const BM25_K1 = 1.2, BM25_B = 0.75;
  const IDF_CACHE = new Map();
  // IDF = ln(1 + (N - df + 0.5)/(df + 0.5))：出现在几乎所有文档里的高频词（"的时""一是"）权重趋零
  function idf(term) {
    let v = IDF_CACHE.get(term);
    if (v === undefined) {
      const post = INV.get(term);
      const df = post ? post.length : 0;
      v = Math.log(1 + (N_DOC - df + 0.5) / (df + 0.5));
      IDF_CACHE.set(term, v);
    }
    return v;
  }
  // 对倒排链累加 BM25 得分到 Map(docIndex -> score)；skipId 用于排除自身
  function accumulateBM25(tfMap, scores, skipId) {
    tfMap.forEach(function (qtf, term) {
      const idfv = idf(term);
      if (idfv <= 0) return;                 // 无区分度，剪枝（也是主要的性能来源）
      const post = INV.get(term);
      if (!post) return;
      for (let p = 0; p < post.length; p++) {
        const hit = post[p];
        if (skipId && CORPUS[hit.i].id === skipId) continue;
        const denom = hit.tf + BM25_K1 * (1 - BM25_B + BM25_B * (DOC_LEN[hit.i] / AVG_DL));
        const s = (idfv * hit.tf * (BM25_K1 + 1)) / denom;
        scores.set(hit.i, (scores.get(hit.i) || 0) + s);
      }
    });
    return scores;
  }

  // 意图识别：根据用户问法判断偏重（防御/工具/原理/实战/资讯），用于检索加权与答案组织
  function detectIntent(q) {
    const l = String(q || "").toLowerCase();
    return {
      defense: /防御|防护|怎么防|如何防|修复|缓解|加固|安全配置|防住|抵御/.test(q),
      tool: /工具|命令|用什么|怎么用|用法|扫描|检测工具|如何检测|推荐(工具|软件)|装什么/.test(q),
      principle: /是什么|原理|概念|定义|什么叫|介绍|解释|讲讲|概念/.test(q),
      example: /例子|示例|实战|演练|靶场|怎么做|如何利用|exp|poc|复现|手把手/.test(q),
      news: /cve-|通报|曝光|被攻击|影响版本|近期|事件|0day|nday|泄露|最新漏洞/.test(l),
    };
  }

  // 检索打分：关键词精确命中权重最高，其次二元文法重叠与标题子串命中；并按意图加权（仅加不减）
  function retrieve(q, k) {
    k = k || 4;
    const ql = String(q || "").toLowerCase().trim();
    if (!ql) return [];
    const qt = tokenize(ql);
    const intent = detectIntent(ql);
    // 1) BM25：只遍历查询词的倒排链（不再扫描全库 × 全 token）
    const scores = accumulateBM25(qt, new Map(), null);
    // 2) 精确命中信号与意图加权（原逻辑验证有效的部分，保留）
    const out = [];
    scores.forEach(function (s, i) {
      const d = CORPUS[i];
      let sc = s;
      (d.keywords || []).forEach((kw) => {
        const kwl = kw.toLowerCase();
        if (ql.includes(kwl) || kwl.split(/[\s,]+/).filter(Boolean).some((x) => ql.includes(x))) sc += 6;
      });
      if (ql.length > 1) {
        const tl = d.title.toLowerCase();
        if (tl.includes(ql)) sc += 8;
        else if (ql.includes(tl.slice(0, Math.min(tl.length, 6)))) sc += 5;
      }
      // 意图感知加权（仅加不减，提升常见诉求的命中精度）
      if (intent.defense && /防御|防护|缓解|修复|加固|安全/.test(d.text)) sc += 3;
      if (intent.tool && d.src === "安全工具") sc += 4;
      if (intent.principle && d.src === "知识点") sc += 2;
      if (intent.example && (d.src === "靶场题解" || d.src === "交互靶场")) sc += 3;
      if (intent.news && d.src === "安全资讯") sc += 4;
      out.push({ d: d, s: sc });
    });
    return out.sort((a, b) => b.s - a.s).slice(0, k).map((x) => x.d);
  }

  function trimHistory(max) {
    max = max || 12;
    if (state.history.length > max) state.history = state.history.slice(-max);
  }

  /* ---------- 工具函数 ---------- */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }
  // 处理 levels 文本中可能残留的 <code class='inline-code'> 标签
  function renderInline(text) {
    return text.replace(/<code class='inline-code'>([\s\S]*?)<\/code>/g,
      (_, c) => `<code class="inline-code">${escapeHtml(c)}</code>`);
  }
  function curLang() { return document.documentElement.getAttribute("lang") === "en" ? "en" : "zh"; }
  function t(k) { return (I18N[curLang()] && I18N[curLang()][k] != null) ? I18N[curLang()][k] : (I18N.zh[k] != null ? I18N.zh[k] : k); }

  /* ============================================================
     交互反馈层（P0）：Toast 通知 / 按钮忙碌态 / 骨架屏
     目标：让每一次操作都有即时、明确、可预期的回应。
     ============================================================ */
  const TOAST_ICON = { ok: "\u2713", err: "!", info: "i" };
  const TOAST_DUR = { ok: 3000, err: 5000, info: 3500 };
  const toastRecs = new Map();
  let toastSeq = 0;

  function toastHost() {
    let host = document.getElementById("toastHost");
    if (!host) {
      host = document.createElement("div");
      host.id = "toastHost";
      host.className = "toast-host";
      host.setAttribute("role", "status");
      host.setAttribute("aria-live", "polite");
      document.body.appendChild(host);
    }
    return host;
  }

  /* 统一通知入口。
     msg  提示文案 | type "ok" | "err" | "info"
     opts { actionText, onAction, duration }（带撤销按钮时默认 8 秒）
     返回 toastId，可用 closeToast(id) 手动关闭。 */
  function toast(msg, type, opts) {
    type = TOAST_ICON[type] ? type : "info";
    opts = opts || {};
    const host = toastHost();
    // 最多同时 3 条，超出移除最早的一条
    while (host.children.length >= 3) {
      const first = host.firstElementChild;
      if (!first) break;
      closeToast(first.getAttribute("data-toast-id"), true);
    }
    const id = "t" + (++toastSeq);
    const el = document.createElement("div");
    el.className = "toast toast-" + type;
    el.setAttribute("data-toast-id", id);
    el.setAttribute("role", type === "err" ? "alert" : "status");
    let html = `<span class="toast-ic">${TOAST_ICON[type]}</span><span class="toast-msg">${escapeHtml(msg)}</span>`;
    if (opts.actionText) html += `<button class="toast-act" type="button">${escapeHtml(opts.actionText)}</button>`;
    html += `<button class="toast-x" type="button" aria-label="\u5173\u95ed">\u2715</button>`;
    el.innerHTML = html;
    host.appendChild(el);

    const rec = { timer: null, el: el };
    toastRecs.set(id, rec);
    const dur = opts.duration || (opts.actionText ? 8000 : TOAST_DUR[type]);
    const start = function () { rec.timer = setTimeout(function () { closeToast(id); }, dur); };
    el.querySelector(".toast-x").addEventListener("click", function () { closeToast(id); });
    const actBtn = el.querySelector(".toast-act");
    if (actBtn) {
      actBtn.addEventListener("click", function () {
        closeToast(id);
        if (typeof opts.onAction === "function") opts.onAction();
      });
    }
    // 悬停暂停自动消失，移开重新计时
    el.addEventListener("mouseenter", function () { if (rec.timer) { clearTimeout(rec.timer); rec.timer = null; } });
    el.addEventListener("mouseleave", function () { if (!rec.timer) start(); });
    start();
    return id;
  }

  // immediate=true 时立即移除（不带退场动画），用于堆叠淘汰
  function closeToast(id, immediate) {
    const rec = toastRecs.get(id);
    if (!rec) return;
    toastRecs.delete(id);
    if (rec.timer) clearTimeout(rec.timer);
    const el = rec.el;
    if (immediate) { if (el.parentNode) el.parentNode.removeChild(el); return; }
    el.classList.add("out");
    let done = false;
    const remove = function () {
      if (done) return;
      done = true;
      if (el.parentNode) el.parentNode.removeChild(el);
    };
    // 关闭动效时不会触发 animationend，用定时器兜底
    el.addEventListener("animationend", remove, { once: true });
    setTimeout(remove, 320);
  }

  /* 把按钮置为忙碌态，返回「恢复函数」。
     必须在 try/finally 中调用恢复，否则异常会把按钮永久禁用。
     实现上只隐藏原有子元素并追加忙碌层，不替换 innerHTML，
     以保留按钮内的图标与子元素上已绑定的事件监听。 */
  function withPending(btn, busyText) {
    const el = typeof btn === "string" ? $(btn) : btn;
    if (!el) return function () {};
    const prevW = el.offsetWidth;
    if (prevW) el.style.minWidth = prevW + "px";
    const prevDisabled = !!el.disabled;
    Array.prototype.forEach.call(el.children, function (c) { c.style.display = "none"; });
    const busy = document.createElement("span");
    busy.className = "pending-wrap";
    busy.style.display = "inline-flex";
    busy.style.alignItems = "center";
    busy.style.gap = "6px";
    busy.innerHTML = `<span class="spinner"></span><span>${escapeHtml(busyText || "\u5904\u7406\u4e2d\u2026")}</span>`;
    el.appendChild(busy);
    el.disabled = true;
    let restored = false;
    return function restore() {
      if (restored) return;
      restored = true;
      if (busy.parentNode) busy.parentNode.removeChild(busy);
      Array.prototype.forEach.call(el.children, function (c) { c.style.display = ""; });
      el.disabled = prevDisabled;
      el.style.minWidth = "";
    };
  }

  /* 骨架屏：在容器显示 n 张占位卡，返回清除函数。
     清除时仅当骨架卡仍在（避免误删已经渲染好的真实内容）。 */
  function showSkeleton(container, n) {
    const box = typeof container === "string" ? $(container) : container;
    if (!box) return function () {};
    n = n || 6;
    let html = "";
    for (let i = 0; i < n; i++) {
      html += `<div class="sk-card"><div class="sk-line sk-shimmer" style="width:60%"></div>` +
        `<div class="sk-line sk-shimmer" style="width:100%"></div>` +
        `<div class="sk-line sk-shimmer" style="width:72%"></div></div>`;
    }
    box.innerHTML = html;
    return function clear() { if (box.querySelector(".sk-card")) box.innerHTML = ""; };
  }

  /* ============================================================
     撤销支持（P2）：破坏性操作改为「先快照 → 再执行 → 可撤销」
     原则：任何清空类操作都不应是单点误触就无法挽回的。
     ============================================================ */
  function snapshotMastery() {
    return {
      mastery: Array.from(state.mastery || []),
      dates: JSON.parse(JSON.stringify(state.masteryDates || {})),
    };
  }
  function restoreMastery(snap) {
    state.mastery.clear();
    (snap.mastery || []).forEach((id) => state.mastery.add(id));
    state.masteryDates = snap.dates || {};
    saveMastery();
    saveMasteryDates();
  }
  function clearMastery() {
    state.mastery.clear();
    state.masteryDates = {};
    saveMastery();
    saveMasteryDates();
  }
  // 重置掌握进度（带二次确认 + 限时撤销）
  function resetMasteryUndoable(confirmMsg) {
    if (typeof confirm === "function" && !confirm(confirmMsg)) return false;
    const snap = snapshotMastery();
    const n = snap.mastery.length;
    clearMastery();
    renderProgress();
    const out = $("#planOutput");
    if (out) out.innerHTML = "<p>进度已重置。</p>";
    toast(n ? "已清空 " + n + " 项掌握进度" : "当前没有已掌握的知识点", "info", {
      actionText: n ? "撤销" : null,
      onAction: function () {
        restoreMastery(snap);
        renderProgress();
        if (out) out.innerHTML = "";
        toast("已恢复 " + n + " 项掌握进度", "ok");
      },
    });
    return true;
  }

  function saveMastery() {
    localStorage.setItem("sectutor_mastery", JSON.stringify([...state.mastery]));
    updateBadge();
  }
  function updateBadge() {
    $("#masteryBadge").textContent = "✓ " + state.mastery.size;
    const rb = $("#reviewNotif");
    if (rb) rb.textContent = String(dueReviews().length);
  }
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem("sectutor_theme", t); } catch (e) {}
    const btn = $("#themeToggle");
    if (btn) btn.classList.toggle("light", t === "light");
  }
  const themeBtn = $("#themeToggle");
  if (themeBtn) themeBtn.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(cur);
  });

  /* ---------- 顶栏：全局搜索 / 复习提醒 / 设置 ---------- */
  function openGlobalSearch() {
    const body = `
      <div class="gs-wrap">
        <div class="gs-input-row">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-3.6-3.6"/></svg>
          <input id="gsInput" placeholder="搜索知识点 / 工具 / 靶场 / 实验（标题或关键词）…" />
        </div>
        <div id="gsResults" class="gs-results"></div>
      </div>`;
    openModal("🔍 全局搜索", body);
    const input = $("#gsInput");
    const results = $("#gsResults");
    if (!input || !results) return;
    const render = () => {
      const q = (input.value || "").trim().toLowerCase();
      if (!q) { results.innerHTML = `<p class="rev-empty">输入关键词开始搜索。可检索：知识点、工具、靶场与实战实验。</p>`; return; }
      const out = [];
      CATS.forEach((cat) => (cat.topics || []).forEach((t) => {
        const hay = ((t.name || "") + " " + (t.keywords || []).join(" ") + " " + (t.summary || "")).toLowerCase();
        if (hay.indexOf(q) >= 0) out.push({ type: "topic", id: t.id, name: t.name, cat: cat.name, tag: "知识点" });
      }));
      (SEC_DATA.tools || []).forEach((t) => {
        const hay = ((t.name || "") + " " + (t.desc || "") + " " + (t.usage || "")).toLowerCase();
        if (hay.indexOf(q) >= 0) out.push({ type: "tool", id: t.id, name: t.name, cat: (CATS.find((c) => c.id === t.cat) || {}).name || "", tag: "工具" });
      });
      (SEC_DATA.ranges || []).forEach((r) => {
        const hay = ((r.name || "") + " " + (r.desc || "")).toLowerCase();
        if (hay.indexOf(q) >= 0) out.push({ type: "range", id: r.id, name: r.name, cat: "靶场", tag: "靶场" });
      });
      (SEC_DATA.labs || []).forEach((l) => {
        const hay = ((l.name || "") + " " + (l.desc || "")).toLowerCase();
        if (hay.indexOf(q) >= 0) out.push({ type: "lab", id: l.id, name: l.name, cat: (CATS.find((c) => c.id === l.cat) || {}).name || "", tag: "实验" });
      });
      if (!out.length) { results.innerHTML = `<p class="rev-empty">未找到与「${escapeHtml(q)}」相关的内容。</p>`; return; }
      results.innerHTML = out.slice(0, 40).map((o) => `
        <button class="gs-item" data-type="${o.type}" data-id="${escapeAttr(o.id)}" data-cat="${escapeAttr(o.cat)}">
          <span class="gs-tag gs-${o.type}">${o.tag}</span>
          <span class="gs-name">${escapeHtml(o.name)}</span>
          <span class="gs-cat">${escapeHtml(o.cat)}</span>
        </button>`).join("");
      $$(".gs-item").forEach((b) => b.addEventListener("click", () => {
        const type = b.getAttribute("data-type"), id = b.getAttribute("data-id"), cat = b.getAttribute("data-cat");
        closeModal();
        if (type === "topic") { activateTab("knowledge"); showTopicDetail(id); }
        else if (type === "range") { activateTab("range"); showRange(id); }
        else if (type === "lab") { activateTab("range"); if (window.__openLabById) window.__openLabById(id); }
        else if (type === "tool") { activateTab("tools"); toolActiveCat = cat; renderToolCats(); renderTools(); }
      }));
    };
    let tmr;
    input.addEventListener("input", () => { clearTimeout(tmr); tmr = setTimeout(render, 120); });
    // 仅自测模式暴露同步刷新钩子，避免防抖影响断言时序（生产不挂此钩子）
    if (window.__SELFTEST__) window.__gsFlush = function () {
      if (tmr) { clearTimeout(tmr); tmr = null; render(); }
    };
    render();
  }

  function openReviewPanel() {
    const due = dueReviews();
    const revIds = due.length ? due.map((d) => d.id) : CATS.flatMap((c) => (c.topics || []).map((t) => t.id)).filter((id) => state.mastery.has(id));
    let body;
    if (due.length) {
      const chips = due.map((d) => `<button class="chip" data-id="${escapeAttr(d.id)}">${escapeHtml(topicName(d.id))}</button>`).join("");
      body = `
        <div class="review-curve-wrap">${reviewCurveSvg()}<p class="rev-empty">遗忘曲线（红点=复习检查点）：以下知识点已到复习节点。</p></div>
        <div class="rev-chips">${chips}</div>
        <button class="btn small" id="revStartBtn">开始复习（${due.length} 题）</button>`;
    } else {
      body = `<p class="rev-empty">暂无到期复习内容。已掌握的知识点会在记忆曲线到点时提醒你。</p>` +
        (revIds.length ? `<button class="btn small" id="revStartBtn">随机复习（${revIds.length} 个已掌握）</button>` : "");
    }
    openModal("🔔 复习提醒", body);
    const st = $("#revStartBtn");
    if (st) st.addEventListener("click", () => { closeModal(); startReview(revIds); });
    $$(".rev-chips .chip").forEach((c) => c.addEventListener("click", () => { closeModal(); activateTab("knowledge"); showTopicDetail(c.getAttribute("data-id")); }));
  }

  function openSettings() {
    const cur = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
    const body = `
      <div class="set-row"><span>主题外观</span>
        <div class="chips">
          <button class="chip ${cur === "dark" ? "active" : ""}" data-th="dark">🌑 深色</button>
          <button class="chip ${cur === "light" ? "active" : ""}" data-th="light">☀️ 浅色</button>
        </div>
      </div>
      <hr class="ctrl-divider" />
      <div class="set-row"><span>数据管理</span>
        <div class="chips">
          <button class="btn small" id="setPdf">📄 导出学习计划</button>
          <button class="btn small ghost" id="setChat">🗑 导出对话</button>
          <button class="btn small ghost" id="setReset">♻️ 重置进度</button>
        </div>
      </div>
      <hr class="ctrl-divider" />
      <p class="rev-empty">
        <b>SecTutor</b> · 本地优先的网络安全学习智能 Agent。<br>
        所有内容仅用于合法授权的安全学习与防御研究。后端配置、大模型接入位于「智能问答」侧栏。
      </p>`;
    openModal("⚙️ 设置", body);
    $$("#modalBody .chip[data-th]").forEach((b) => b.addEventListener("click", () => {
      applyTheme(b.getAttribute("data-th"));
      $$("#modalBody .chip[data-th]").forEach((x) => x.classList.toggle("active", x === b));
    }));
    const pdf = $("#setPdf"); if (pdf) pdf.addEventListener("click", () => { closeModal(); exportPlanPdf(); });
    const chat = $("#setChat"); if (chat) chat.addEventListener("click", () => { closeModal(); exportChat(); });
    const reset = $("#setReset"); if (reset) reset.addEventListener("click", () => {
      if (typeof confirm === "function" && !confirm("确定重置全部掌握进度并清空对话记录？重置后可在右下角提示条点击「撤销」恢复。")) return;
      const snap = snapshotMastery();
      let chatSnap = "";
      try { chatSnap = localStorage.getItem(CHAT_KEY) || ""; } catch (e) {}
      const n = snap.mastery.length;
      clearMastery();
      try { localStorage.removeItem(CHAT_KEY); } catch (e) {}
      const log = $("#chatLog"); if (log) log.innerHTML = "";
      renderProgress();
      closeModal();
      toast("已重置" + (n ? " " + n + " 项掌握进度" : "") + "并清空对话记录", "info", {
        actionText: "撤销",
        onAction: function () {
          restoreMastery(snap);
          try { if (chatSnap) localStorage.setItem(CHAT_KEY, chatSnap); } catch (e) {}
          renderProgress();
          toast("已恢复掌握进度与对话记录", "ok");
        },
      });
    });
  }

  const btnSearch = $("#btnSearch"); if (btnSearch) btnSearch.addEventListener("click", openGlobalSearch);
  const btnReview = $("#btnReview"); if (btnReview) btnReview.addEventListener("click", openReviewPanel);
  const btnSettings = $("#btnSettings"); if (btnSettings) btnSettings.addEventListener("click", openSettings);

  /* ---------- 语言 i18n（中 / 英） ---------- */
  const I18N = {
    zh: {
      "brand.sub": "网络安全学习智能 Agent · 仅用于合法授权的安全学习与防御研究",
      "tab.knowledge": "📚 知识体系", "tab.chat": "💬 智能问答", "tab.range": "🎯 实战靶场",
      "tab.plan": "🗺️ 学习计划", "tab.news": "📰 安全资讯", "tab.tools": "🛠️ 工具与代码",
      "tab.quiz": "🧠 随机自测", "tab.compliance": "⚖️ 合规声明",
      "h.areas": "学习领域", "h.level": "难度筛选", "h.profile": "学习画像", "h.quick": "快速提问",
      "h.rangeCats": "靶场分类", "h.labCats": "演练类型", "h.tools": "安全工具", "h.genPlan": "生成学习计划",
      "h.quiz": "🧠 随机自测", "h.qcount": "题目数量", "h.qcat": "限定领域",
      "lvl.all": "全部", "lvl.beginner": "入门", "lvl.basic": "初级", "lvl.inter": "中级", "lvl.advanced": "高级",
      "btn.clear": "清除", "btn.saveLlm": "保存配置", "btn.clearLlm": "清除", "btn.saveBackend": "保存配置", "btn.clearBackend": "恢复默认",
      "btn.startBackend": "▶ 启动后端", "btn.stopBackend": "■ 停止后端", "btn.clearChat": "🗑 清空对话",
      "btn.send": "发送", "btn.genPlan": "生成我的计划", "btn.resetPlan": "重置进度",
      "btn.exportPdf": "📄 导出 PDF", "btn.exportPng": "🖼 导出 PNG", "btn.quizStart": "开始自测", "btn.quizRestart": "重新开始",
      "f.userLevel": "当前难度档位", "f.focusCat": "专注领域", "f.llmBase": "API Base URL", "f.llmKey": "API Key",
      "f.llmModel": "模型名", "f.backendUrl": "后端地址", "f.backendToken": "访问令牌",
      "f.planCat": "目标领域", "f.planHours": "每周可投入", "f.planWeeks": "目标周期",
      "ph.kbSearch": "🔍 搜索知识点（标题/简介/关键词，跨全部领域）",
      "ph.chatInput": "问我任何网安问题，例如：什么是 SQL 注入？怎么防御 XSS？",
      "llm.title": "可选：接入大模型 API",
      "llm.hint": "本应用内置知识引擎可离线运行。填下方面板可升级为真实大模型对话（OpenAI 兼容）。密钥仅保存在你本机浏览器，不会上传。",
      "backend.title": "可选：临时靶场后端（真实靶机）",
      "backend.hint": "在「实战靶场 → 在线演练」每个测试点可一键生成独立临时靶机（需自建 SecTutor 后端，见 sectutor-backend 项目）。后端不可用时自动回退到本页前端仿真。配置仅存于本机浏览器。",
      "backend.ctlhint": "一键启停本地后端：直接点下方按钮即可。桌面版（SecTutor 应用）开箱即用；若用浏览器打开本页并提示「启动器未运行」，请先双击 sectutor-backend\\SecTutor.bat（普通双击，无需管理员）。",
      "seg.solutions": "📖 题解库", "seg.labs": "🧪 在线演练",
      "quiz.hint": "从题库随机抽取题目，检验你对各领域的掌握程度。仅用于自我复习，不记录成绩。",
      "quiz.startNote": "点击「开始自测」随机抽题。每题单选，提交后立即看到解析。",
      "compliance.title": "⚖️ 合规与安全使用声明",
      "compliance.p1": "本应用（SecTutor）是一个<strong>网络安全学习教育工具</strong>，其全部内容仅用于：",
      "compliance.l1": "在<strong>合法授权</strong>范围内的安全学习、实验与防御研究；",
      "compliance.l2": "提升使用者自身系统与资产的安全防护能力；",
      "compliance.l3": "配合 CTF 竞赛、靶场（如本地 VulnHub / DVWA / 授权演练环境）进行训练。",
      "compliance.p2": "<strong>严格禁止</strong>将本应用任何内容用于：",
      "compliance.l4": "未经授权入侵、扫描、破坏他人系统或网络；",
      "compliance.l5": "制作、传播恶意软件或武器化利用代码；",
      "compliance.l6": "任何违反《网络安全法》《刑法》第 285/286 条及适用法律的行为。",
      "compliance.warn": "⚠️ 任何对第三方系统的安全测试，必须先取得<strong>书面授权</strong>。本应用资讯仅解读已公开且已修复的历史漏洞，并侧重防御视角；不提供针对未公开/未修复漏洞的实战利用步骤。",
      "compliance.muted": "使用本应用即表示你理解并同意上述条款。如为未成年人，请在监护人指导下使用。",
      "footer": "SecTutor · 本地优先 · 数据仅存于你的浏览器",
      "src.related": "🔗 关联资料", "src.more": "延伸学习", "src.title": "参考来源", "src.offline": "（内置检索引擎·离线）", "src.nomatch": "我暂时没有匹配到该问题的知识点。你可以从以下领域挑选，或换种说法提问 👇",
      "kb.scope.topic": "知识点", "kb.scope.all": "全库",
      "kb.path": "🗺️ 学习路径", "kb.path.on": "✅ 学习路径",
      "kb.related": "🔗 相关推荐", "kb.globalCount": "全库命中", "kb.goto": "前往",
      "kb.path.title": "按难度梯度（入门→初级→中级→高级）组织的学习路径，绿色表示已掌握",
      "kb.globalEmpty": "全库未找到相关内容，换个关键词试试。", "kb.globalHint": "已跨 知识点/靶场题解/安全资讯/安全工具/交互靶场 检索"
    },
    en: {
      "brand.sub": "Cybersecurity learning agent · for authorized learning & defense research only",
      "tab.knowledge": "📚 Knowledge", "tab.chat": "💬 Q&A", "tab.range": "🎯 Range",
      "tab.plan": "🗺️ Plan", "tab.news": "📰 News", "tab.tools": "🛠️ Tools",
      "tab.quiz": "🧠 Quiz", "tab.compliance": "⚖️ Compliance",
      "h.areas": "Domains", "h.level": "Level", "h.profile": "Profile", "h.quick": "Quick asks",
      "h.rangeCats": "Categories", "h.labCats": "Lab types", "h.tools": "Tools", "h.genPlan": "Generate plan",
      "h.quiz": "🧠 Quiz", "h.qcount": "Questions", "h.qcat": "Domain",
      "lvl.all": "All", "lvl.beginner": "Beginner", "lvl.basic": "Basic", "lvl.inter": "Intermediate", "lvl.advanced": "Advanced",
      "btn.clear": "Clear", "btn.saveLlm": "Save", "btn.clearLlm": "Clear", "btn.saveBackend": "Save", "btn.clearBackend": "Reset",
      "btn.startBackend": "▶ Start", "btn.stopBackend": "■ Stop", "btn.clearChat": "🗑 Clear chat",
      "btn.send": "Send", "btn.genPlan": "Generate my plan", "btn.resetPlan": "Reset",
      "btn.exportPdf": "📄 Export PDF", "btn.exportPng": "🖼 Export PNG", "btn.quizStart": "Start quiz", "btn.quizRestart": "Restart",
      "f.userLevel": "Level", "f.focusCat": "Focus", "f.llmBase": "API Base URL", "f.llmKey": "API Key",
      "f.llmModel": "Model", "f.backendUrl": "Backend URL", "f.backendToken": "Token",
      "f.planCat": "Target domain", "f.planHours": "Weekly hours", "f.planWeeks": "Duration",
      "ph.kbSearch": "🔍 Search topics (title / summary / keywords, across all domains)",
      "ph.chatInput": "Ask any security question, e.g. what is SQL injection? How to defend XSS?",
      "llm.title": "Optional: connect an LLM API",
      "llm.hint": "This app has a built-in offline knowledge engine. Fill the panel below to upgrade to a real LLM chat (OpenAI-compatible). Keys are stored only in your browser, never uploaded.",
      "backend.title": "Optional: temporary range backend (real targets)",
      "backend.hint": "In 'Range → Labs', each test can spin up an isolated temporary target (requires your own SecTutor backend, see sectutor-backend). Falls back to front-end simulation when the backend is unavailable. Config is stored only in your browser.",
      "backend.ctlhint": "One-click start/stop of the local backend: just press the button below. The desktop app (SecTutor) works out of the box; if you open this page in a browser and see 'launcher not running', double-click sectutor-backend\\SecTutor.bat first (normal double-click, no admin needed).",
      "seg.solutions": "📖 Writeups", "seg.labs": "🧪 Live labs",
      "quiz.hint": "Random questions from the pool to test your grasp of each domain. For self-review only; no score is recorded.",
      "quiz.startNote": "Click 'Start quiz' to draw random questions. Single choice each; see the explanation right after submitting.",
      "compliance.title": "⚖️ Compliance & Usage",
      "compliance.p1": "SecTutor is a <strong>cybersecurity education & learning tool</strong>. All content is for:",
      "compliance.l1": "Security learning, labs and defense research within <strong>authorized</strong> scope;",
      "compliance.l2": "Improving the security of your own systems and assets;",
      "compliance.l3": "Training with CTFs / ranges (e.g. local VulnHub / DVWA / authorized environments).",
      "compliance.p2": "<strong>Strictly prohibited</strong> uses of any SecTutor content:",
      "compliance.l4": "Unauthorized intrusion, scanning or disruption of others' systems or networks;",
      "compliance.l5": "Creating or spreading malware or weaponized exploit code;",
      "compliance.l6": "Any act violating the Cybersecurity Law, Criminal Law Art. 285/286, or applicable law.",
      "compliance.warn": "⚠️ Any security testing against third parties requires <strong>written authorization</strong> first. SecTutor only covers publicly disclosed, already-patched historical vulnerabilities from a defense perspective; it does not provide steps for undisclosed/unpatched exploits.",
      "compliance.muted": "By using SecTutor you acknowledge and agree to the above. Minors should use it under guardian supervision.",
      "footer": "SecTutor · Local-first · Your data stays in your browser",
      "src.related": "🔗 Related", "src.more": "Explore more", "src.title": "Sources", "src.offline": "(built-in offline retriever)", "src.nomatch": "I couldn't match that question to any topic yet. Pick a domain below or rephrase 👇",
      "kb.scope.topic": "Topics", "kb.scope.all": "All",
      "kb.path": "🗺️ Path", "kb.path.on": "✅ Path",
      "kb.related": "🔗 Related", "kb.globalCount": "All-library hits", "kb.goto": "Go",
      "kb.path.title": "Learning path ordered by difficulty (Beginner→Basic→Intermediate→Advanced); green = mastered",
      "kb.globalEmpty": "No matches across the library. Try another keyword.", "kb.globalHint": "Searched across topics / writeups / news / tools / labs"
    }
  };
  function applyLang(lang) {
    lang = (lang === "en") ? "en" : "zh";
    const dict = I18N[lang];
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const k = el.getAttribute("data-i18n");
      if (dict[k] != null) el.innerHTML = dict[k];
    });
    document.querySelectorAll("[data-i18n-ph]").forEach((el) => {
      const k = el.getAttribute("data-i18n-ph");
      if (dict[k] != null) el.placeholder = dict[k];
    });
    const lb = $("#langToggle");
    if (lb) lb.innerHTML = lang === "en" ? "🌐 English" : "🌐 中文";
    try { localStorage.setItem("sectutor_lang", lang); } catch (e) {}
    document.documentElement.setAttribute("lang", lang === "en" ? "en" : "zh-CN");
  }

  /* ---------- 导航（左图标栏） ---------- */
  // 数字键 1-8 与左侧导航顺序保持一致（快捷键与导航共用同一份定义）
  const TAB_KEYS = ["knowledge", "chat", "range", "plan", "news", "tools", "quiz", "compliance"];
  const TAB_NAMES = { knowledge: "知识体系", chat: "智能问答", range: "实战靶场", plan: "学习计划", news: "安全资讯", tools: "工具与代码", quiz: "随机自测", compliance: "合规声明" };

  /* 面板滚动位置记忆（P2）：切走前记录各滚动容器位置，切回时恢复，
     否则从知识体系滚到第 40 个知识点后切走再回来会回到顶部。 */
  const SCROLL_SEL = ".kb-side,.chat-side,.range-side,.tools-side,.plan-controls,.quiz-side," +
    ".kb-main,.range-main,.plan-main,.tools-main,.quiz-main,.chat-log,.news-list,.compliance-box";
  const scrollMem = new Map();   // tabName -> Map("序号|className" -> scrollTop)

  function savePanelScroll(tabName) {
    const panel = $("#panel-" + tabName);
    if (!panel) return;
    const mem = new Map();
    Array.prototype.forEach.call(panel.querySelectorAll(SCROLL_SEL), (el, i) => {
      mem.set(i + "|" + el.className, el.scrollTop);
    });
    scrollMem.set(tabName, mem);
  }
  function restorePanelScroll(tabName) {
    const mem = scrollMem.get(tabName);
    if (!mem) return;
    const panel = $("#panel-" + tabName);
    if (!panel) return;
    Array.prototype.forEach.call(panel.querySelectorAll(SCROLL_SEL), (el, i) => {
      const v = mem.get(i + "|" + el.className);
      if (typeof v === "number" && v > 0) el.scrollTop = v;
    });
  }

  function activateTab(tabName) {
    const prev = $(".panel.active");
    if (prev && prev.id) savePanelScroll(prev.id.replace(/^panel-/, ""));
    $$(".rail-item").forEach((t) => {
      const on = t.dataset.tab === tabName;
      t.classList.toggle("active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");   // 读屏可感知当前面板
    });
    $$(".panel").forEach((p) => p.classList.toggle("active", p.id === "panel-" + tabName));
    // 顶栏 breadcrumb 同步
    const sub = TAB_NAMES[tabName] || "";
    const cs = $(".crumb-sub"); if (cs) cs.textContent = "· " + sub;
    // 面板刚切换时高度尚未计算完成，需等布局稳定后再恢复滚动位置
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => restorePanelScroll(tabName));
    else setTimeout(() => restorePanelScroll(tabName), 0);
  }
  $$(".rail-item").forEach((tab) => {
    tab.addEventListener("click", () => activateTab(tab.dataset.tab));
  });

  /* ============================================================
     键盘导航层（P1）：全局快捷键 / Esc / 焦点管理
     ============================================================ */
  // 左侧导航显示数字角标（低对比度，hover/激活时提亮）
  // 注：TAB_KEYS / TAB_NAMES 已在导航区定义，此处复用，避免两份定义不同步
  (function markRailKeys() {
    $$(".rail-item").forEach((el) => {
      const i = TAB_KEYS.indexOf(el.dataset.tab);
      if (i < 0) return;
      // 无障碍：把图标栏声明为 tablist / tab，并与对应面板关联
      el.setAttribute("role", "tab");
      el.setAttribute("aria-controls", "panel-" + el.dataset.tab);
      el.setAttribute("aria-label", TAB_NAMES[el.dataset.tab] + "（快捷键 " + (i + 1) + "）");
      el.setAttribute("aria-selected", el.classList.contains("active") ? "true" : "false");
      const panel = $("#panel-" + el.dataset.tab);
      if (panel && !panel.getAttribute("role")) {
        panel.setAttribute("role", "tabpanel");
        panel.setAttribute("aria-label", TAB_NAMES[el.dataset.tab]);
      }
      if (el.querySelector(".rail-key")) return;
      const b = document.createElement("span");
      b.className = "rail-key";
      b.textContent = String(i + 1);
      el.appendChild(b);
    });
    const rail = $(".rail-scroll") || $(".rail");
    if (rail && !rail.getAttribute("role")) rail.setAttribute("role", "tablist");
  })();

  function isTypingTarget(el) {
    if (!el) return false;
    const tag = (el.tagName || "").toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || !!el.isContentEditable;
  }

  function openHotkeyHelp() {
    const rows = [
      ["打开全局搜索", "Ctrl / ⌘ + K"],
      ["关闭弹窗 / 清空输入", "Esc"],
      ["聚焦当前搜索框", "/"],
      ["发送消息", "Enter"],
      ["打开本帮助", "?"],
    ].concat(TAB_KEYS.map((k, i) => ["切换到 " + TAB_NAMES[k], String(i + 1)]));
    const html = `<div class="hk-list">` + rows
      .map((r) => `<div class="hk-row"><span>${escapeHtml(r[0])}</span><span><kbd>${escapeHtml(r[1])}</kbd></span></div>`)
      .join("") + `</div>`;
    openModal("⌨️ 键盘快捷键", html);
  }

  function initHotkeys() {
    document.addEventListener("keydown", (e) => {
      const key = e.key;
      // Ctrl/⌘ + K 全局搜索：任何情况都响应（含输入框内）
      if ((e.ctrlKey || e.metaKey) && (key === "k" || key === "K")) {
        e.preventDefault();
        openGlobalSearch();
        return;
      }
      // Esc：弹窗优先（全局搜索本身也是弹窗）
      if (key === "Escape") {
        const ov = $("#modalOverlay");
        if (ov && !ov.classList.contains("hidden")) { e.preventDefault(); closeModal(); return; }
        if (isTypingTarget(document.activeElement) && document.activeElement.value) {
          document.activeElement.value = "";
          e.preventDefault();
        }
        return;
      }
      // 以下快捷键在输入框内不触发，避免打字时误触
      if (isTypingTarget(document.activeElement)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (key >= "1" && key <= "8") {
        const tab = TAB_KEYS[parseInt(key, 10) - 1];
        if (tab) { e.preventDefault(); activateTab(tab); }
        return;
      }
      if (key === "/") {
        const s = $("#kbSearch");
        if (s) { e.preventDefault(); activateTab("knowledge"); s.focus(); }
        return;
      }
      if (key === "?") { e.preventDefault(); openHotkeyHelp(); }
    });
  }
  initHotkeys();

  /* ============================================================
     知识体系
     ============================================================ */
  let kbActiveCat = "web";
  let kbLevelFilter = "all";
  let kbSearch = "";
  let kbScope = "topic";   // "topic" | "all"  —— 搜索范围（知识点 / 全库）
  let kbSortMode = "default"; // "default" | "mastery-desc" | "mastery-asc" —— 卡片排序
  let kbPath = false;      // 学习路径视图开关

  function updateHero() {
    const c = catById(kbActiveCat);
    const hero = $("#kbHero");
    if (!hero) return;
    const total = allTopics().length;
    const mastered = allTopics().filter((t) => state.mastery.has(t.id)).length;
    const learning = allTopics().filter((t) => !state.mastery.has(t.id)).length;
    const due = (state.masteryDates && Object.keys(state.masteryDates).length) ? dueReviews().length : 0;
    hero.innerHTML = `
      <div class="kb-stats">
        <div class="kb-stat"><div class="k"><svg viewBox="0 0 24 24"><path d="M4 5.5 12 3l8 2.5-8 2.5L4 5.5Z"/><path d="M4 12l8 2.5 8-2.5"/></svg>知识点总数</div><div class="v">${total}</div><div class="s">覆盖 ${CATS.length} 大领域</div></div>
        <div class="kb-stat"><div class="k"><svg viewBox="0 0 24 24"><path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z"/><path d="M9 12l2 2 4-4"/></svg>已掌握</div><div class="v">${mastered}</div><div class="s">掌握度 ≥ 80%</div></div>
        <div class="kb-stat"><div class="k"><svg viewBox="0 0 24 24"><path d="M4 5h16v10H9l-5 4V5Z"/></svg>学习中</div><div class="v">${learning}</div><div class="s">本周活跃 ${state.weekly || 0}</div></div>
        <div class="kb-stat"><div class="k"><svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8Z"/></svg>待复习</div><div class="v">${due}</div><div class="s">24h 内到期</div></div>
      </div>`;
  }

  function renderCatList() {
    const nav = $("#catList");
    if (!nav) return;
    nav.innerHTML = "";
    updateHero();
    CATS.forEach((c) => {
      const total = c.topics.length;
      const done = c.topics.filter((x) => state.mastery.has(x.id)).length;
      const pct = total ? Math.round((done / total) * 100) : 0;
      const color = DOM_COLORS[c.id] || "var(--brand)";
      const div = document.createElement("div");
      div.className = "dom" + (c.id === kbActiveCat ? " active" : "");
      div.style.setProperty("--c", color);
      div.style.setProperty("--p", pct);
      div.innerHTML = `
        <div class="ring" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${escapeHtml(c.name)}掌握度 ${pct}%"><b>${pct}</b></div>
        <div class="meta"><div class="nm">${c.icon} ${c.name}</div><div class="ct">${done} / ${total} 已掌握</div></div>`;
      div.addEventListener("click", () => {
        kbActiveCat = c.id;
        renderCatList();
        renderTopicGrid();
      });
      nav.appendChild(div);
    });
  }

  // 预计算小写检索串：原实现每次按键都对每个知识点重新拼接字符串并执行 toLowerCase
  // （74 个知识点 × 每次按键一次全量重建），改为首次访问时构建并缓存。
  const SEARCH_HAY = new Map();
  function searchHay(t) {
    let h = SEARCH_HAY.get(t.id);
    if (h === undefined) {
      h = (t.name + " " + t.summary + " " + (t.keywords || []).join(" ")).toLowerCase();
      SEARCH_HAY.set(t.id, h);
    }
    return h;
  }
  function matchSearch(t, q) { return searchHay(t).indexOf(q) >= 0; }

  // 掌握度排序（默认 / 掌握优先 ↓ / 未掌握优先 ↑）
  function sortTopics(list) {
    if (kbSortMode === "default") return list;
    const arr = list.slice();
    arr.sort((a, b) => {
      const ma = state.mastery.has(a.id) ? 1 : 0;
      const mb = state.mastery.has(b.id) ? 1 : 0;
      return kbSortMode === "mastery-desc" ? mb - ma : ma - mb;
    });
    return arr;
  }

  function renderTopicGrid() {
    const grid = $("#topicGrid");
    const detail = $("#topicDetail");
    detail.classList.add("hidden");
    grid.classList.remove("hidden");
    const hero = $("#kbHero");
    if (hero) hero.classList.remove("hidden");
    grid.innerHTML = "";

    const q = kbSearch.trim().toLowerCase();
    const cnt = $("#kbSearchCount");
    if (kbPath && !q) { if (cnt) cnt.textContent = ""; renderLearningPath(); return; }
    if (q && kbScope === "all") { renderGlobalResults(kbSearch.trim()); return; }
    if (q) {
      const hits = allTopics().filter((t) => matchSearch(t, q));
      if (hits.length === 0) {
        grid.innerHTML = `<p style="color:var(--muted)">未找到与「${escapeHtml(kbSearch.trim())}」相关的知识点，换个关键词试试。</p>`;
        return;
      }
      sortTopics(hits).forEach((t) => {
        grid.appendChild(buildTopicCard(t));
      });
      if (cnt) cnt.textContent = `找到 ${hits.length} 个结果`;
      return;
    }
    if (cnt) cnt.textContent = "";
    const cat = catById(kbActiveCat);
    const topics = cat.topics.filter(
      (t) => kbLevelFilter === "all" || t.level === kbLevelFilter
    );
    if (topics.length === 0) {
      grid.innerHTML = `<p style="color:var(--muted)">该难度下暂无知识点，试试其他筛选。</p>`;
      return;
    }
    sortTopics(topics).forEach((t) => {
      grid.appendChild(buildTopicCard(t));
    });
  }

  // 富信息知识点卡片（赛博朋克）：领域色条 + 难度 + 领域标签 + 掌握度 + 引用 + 双按钮
  const DOM_COLORS = { web: "#00e5ff", binary: "#ff2bd6", crypto: "#36d399", pentest: "#ffb454", network: "#8b7bff", cloud: "#38bdf8", blue: "#4ade80" };
  function buildTopicCard(t) {
    const cat = catById(t.cat);
    const card = document.createElement("div");
    card.className = "topic-card";
    card.style.setProperty("--c", DOM_COLORS[t.cat] || "var(--brand)");
    const mastPct = state.mastery.has(t.id) ? 100 : (t.level === "入门" ? 20 : t.level === "初级" ? 45 : t.level === "中级" ? 70 : 90);
    const refs = parseRefs(t.refs);
    card.innerHTML = `
      <div class="tc-hd"><h4>${escapeHtml(t.name)}</h4><span class="dom-tag">${escapeHtml(cat.name)}</span></div>
      <span class="lvl-tag lvl-${t.level}">${t.level}</span>
      <p>${escapeHtml(t.summary)}</p>
      <div class="mast"><div class="ml"><span>掌握度</span><b>${mastPct}%</b></div><div class="bar" role="progressbar" aria-valuenow="${mastPct}" aria-valuemin="0" aria-valuemax="100" aria-label="掌握度 ${mastPct}%"><i style="width:${mastPct}%"></i></div></div>
      <div class="refs">${refs.map((r) => `<span class="ref${r.cve ? " cve" : ""}">${escapeHtml(r.t)}</span>`).join("")}</div>
      <div class="tc-ft">
        <button class="tc-btn ghost" data-ai="${t.id}"><svg viewBox="0 0 24 24"><path d="M12 3l1.9 4.6L19 9l-4 3.3L16.2 18 12 15.3 7.8 18 9 12.3 5 9l5.1-1.4L12 3Z"/></svg>AI 辅助</button>
        <button class="tc-btn solid" data-go="${t.id}"><svg viewBox="0 0 24 24"><path d="M4 5h16v10H9l-5 4V5Z"/></svg>开始学习</button>
      </div>`;
    card.addEventListener("click", (e) => {
      if (e.target.closest(".tc-btn")) return;
      showTopicDetail(t.id);
    });
    const aiBtn = card.querySelector("[data-ai]");
    if (aiBtn) aiBtn.addEventListener("click", (e) => { e.stopPropagation(); aiAssistForTopic(t); });
    const goBtn = card.querySelector("[data-go]");
    if (goBtn) goBtn.addEventListener("click", (e) => { e.stopPropagation(); showTopicDetail(t.id); });
    return card;
  }
  function parseRefs(refs) {
    if (!refs) return [];
    const out = [];
    String(refs).split(/[；;]/).forEach((seg) => {
      seg = seg.trim(); if (!seg) return;
      const cve = /CVE[-\s]?\d/i.test(seg);
      out.push({ t: seg.split(/[\s·]/)[0].slice(0, 22), cve });
    });
    return out.slice(0, 3);
  }

  // 全库检索结果渲染（复用 Block1 的 CORPUS / retrieve）
  function renderGlobalResults(q) {
    const grid = $("#topicGrid");
    const cnt = $("#kbSearchCount");
    const docs = retrieve(q, 40);
    if (!docs.length) {
      grid.innerHTML = `<p style="color:var(--muted)">${t("kb.globalEmpty")}</p>`;
      if (cnt) cnt.textContent = "";
      return;
    }
    if (cnt) cnt.textContent = `${t("kb.globalCount")} ${docs.length} 条`;
    grid.innerHTML = `<p style="color:var(--muted);font-size:13px;margin-bottom:10px">${t("kb.globalHint")}</p>`;
    docs.forEach((d) => {
      const typeMap = { "知识点": "📘", "靶场题解": "🎯", "安全资讯": "📰", "安全工具": "🛠️", "交互靶场": "🧪" };
      const body = (d.render().body || "").replace(/\n+/g, " ").slice(0, 90);
      const card = document.createElement("div");
      card.className = "gl-card";
      card.innerHTML = `
        <div class="gl-head"><span class="gl-src">${typeMap[d.src] || "📄"} ${escapeHtml(d.src)}</span><span class="cat-tag">${escapeHtml(catById(d.cat).name)}</span></div>
        <h4>${escapeHtml(d.title)}</h4>
        <p>${escapeHtml(body)}…</p>
        <button class="gl-go" data-id="${escapeHtml(d.id)}">${t("kb.goto")} →</button>`;
      card.querySelector(".gl-go").addEventListener("click", () => gotoCorpusDoc(d));
      grid.appendChild(card);
    });
  }

  // 从全局检索结果跳转到对应模块
  function gotoCorpusDoc(doc) {
    const parts = doc.id.split(":");
    const type = parts[0], id = parts.slice(1).join(":");
    if (type === "topic") { activateTab("knowledge"); showTopicDetail(id); }
    else if (type === "range") { activateTab("range"); showRange(id); }
    else if (type === "lab") { activateTab("range"); if (window.__openLabById) window.__openLabById(id); }
    else if (type === "news") { showNews(id); }
    else if (type === "tool") { activateTab("tools"); }
  }

  // 学习路径：按难度梯度组织当前领域，并显示掌握进度
  function renderLearningPath() {
    const grid = $("#topicGrid");
    const cat = catById(kbActiveCat);
    const order = ["入门", "初级", "中级", "高级"];
    const hero = $("#kbHero");
    if (hero) hero.innerHTML = `
      <div class="hero-icon">${cat.icon}</div>
      <div><h2>${cat.name} · ${t("kb.path")}</h2><p>${escapeHtml(cat.desc)}</p></div>
      <div class="hero-stat"><b>${cat.topics.length}</b><span>个知识点</span></div>`;
    grid.innerHTML = `<p style="color:var(--muted);font-size:13px;margin-bottom:12px">${t("kb.path.title")}</p>`;
    order.forEach((lv) => {
      const items = cat.topics.filter((x) => x.level === lv);
      if (!items.length) return;
      const done = items.filter((x) => state.mastery.has(x.id)).length;
      const pct = Math.round((done / items.length) * 100);
      const group = document.createElement("div");
      group.className = "path-group";
      group.innerHTML = `
        <div class="path-head">
          <span class="lvl-tag lvl-${lv}">${lv}</span>
          <span class="path-prog"><span class="path-bar" style="width:${pct}%"></span></span>
          <span class="path-count">${done}/${items.length}</span>
        </div>`;
      const wrap = document.createElement("div");
      wrap.className = "path-items";
      items.forEach((x) => {
        const c = document.createElement("div");
        c.className = "topic-card" + (state.mastery.has(x.id) ? " mastered" : "");
        c.innerHTML = `<h4>${escapeHtml(x.name)}</h4><p>${escapeHtml(x.summary)}</p>` +
          (state.mastery.has(x.id) ? `<span class="done-flag">✓</span>` : "");
        c.addEventListener("click", () => showTopicDetail(x.id));
        wrap.appendChild(c);
      });
      group.appendChild(wrap);
      grid.appendChild(group);
    });
    // 推荐下一步：当前领域里按梯度顺序第一个尚未掌握的知识点
    let nextTopic = null;
    for (const lv of order) {
      const it = cat.topics.find((x) => x.level === lv && !state.mastery.has(x.id));
      if (it) { nextTopic = it; break; }
    }
    if (nextTopic) {
      const nb = document.createElement("div");
      nb.className = "path-next";
      nb.innerHTML = `<span class="path-next-label">➡️ 推荐下一步：</span><button class="btn small ghost" data-q="${escapeHtml(nextTopic.name)}" data-cat="${escapeHtml(cat.id)}">${escapeHtml(nextTopic.name)}（${nextTopic.level}）</button>`;
      nb.querySelector("button").addEventListener("click", () => showTopicDetail(nextTopic.id));
      grid.appendChild(nb);
    }
  }

  // 相关推荐：基于 CORPUS 的同分类 / 关键词重叠，从全库拉相关条目
  function relatedDocs(topic) {
    const selfId = "topic:" + topic.id;
    const tdoc = DOC_BY_ID.get(selfId);
    // 原实现对每个候选文档遍历其全部 token 求交集（O(全库 × 全 token)），
    // 改为用倒排链 + BM25，只访问自身词项命中的文档。
    const tt = tdoc ? tdoc.tf : tokenizeTf([topic.name, topic.summary, (topic.keywords || []).join(" ")].join(" "));
    const scores = accumulateBM25(tt, new Map(), selfId);
    const out = [];
    scores.forEach(function (s, i) {
      // 同领域略加权（保留原策略，权重按 BM25 量纲调整）
      out.push({ d: CORPUS[i], s: s + (CORPUS[i].cat === topic.cat ? 0.5 : 0) });
    });
    return out.sort((a, b) => b.s - a.s).slice(0, 6).map((x) => x.d);
  }

  function showTopicDetail(topicId) {
    const topic = allTopics().find((x) => x.id === topicId);
    if (!topic) return;
    const grid = $("#topicGrid");
    const detail = $("#topicDetail");
    grid.classList.add("hidden");
    detail.classList.remove("hidden");
    const hero = $("#kbHero");
    if (hero) hero.classList.add("hidden");
    const lvl = state.userLevel;
    const body = topic.levels[lvl] || topic.levels["入门"];
    const learned = state.mastery.has(topic.id);
    detail.innerHTML = `
      <button class="back-btn" id="backKb">← 返回列表</button>
      <h2>${topic.name} <span class="lvl-tag lvl-${topic.level}">${topic.level}</span></h2>
      <p style="color:var(--muted)">所属领域：${catById(topic.cat).name} ｜ 当前以【${lvl}】档位讲解</p>
      <div class="kb-section"><h4>📘 ${lvl} 讲解</h4><div>${renderInline(body)}</div></div>
      <div class="kb-section"><h4>💡 代码示例（安全/修复视角）</h4>
        <pre><code class="language-${topic.codeLang}">${escapeHtml(topic.code)}</code></pre></div>
      <div class="kb-section"><h4>🛠 推荐工具</h4><p>${escapeHtml(topic.tool)}</p></div>
      <div class="kb-section"><h4>📚 延伸阅读</h4><p style="color:var(--muted)">${escapeHtml(topic.refs)}</p></div>
      <div class="kb-section"><h4>🔗 ${t("kb.related")}</h4><div class="rel-box" id="relBox"></div></div>
      <div class="ai-helpers"><button class="btn ghost small" id="topicAiBtn">🤖 AI 辅助（讲解/自测/拓展）</button></div>
      <button class="learn-btn${learned ? " mastered" : ""}" id="learnBtn" aria-pressed="${learned ? "true" : "false"}">${learned ? "✓ 已掌握（点击取消）" : "我已掌握此知识点"}</button>
    `;
    const rel = relatedDocs(topic);
    if (rel.length) {
      const box = $("#relBox");
      const typeMap = { "知识点": "📘", "靶场题解": "🎯", "安全资讯": "📰", "安全工具": "🛠️", "交互靶场": "🧪" };
      box.innerHTML = rel.map((d) =>
        `<button class="rel-chip" data-id="${escapeHtml(d.id)}">${typeMap[d.src] || "📄"} ${escapeHtml(d.src)}·${escapeHtml(d.title)}</button>`
      ).join("");
      box.querySelectorAll(".rel-chip").forEach((b) => {
        if (b.dataset.bound) return; b.dataset.bound = "1";
        b.addEventListener("click", () => {
          const doc = DOC_BY_ID.get(b.dataset.id);
          if (doc) gotoCorpusDoc(doc);
        });
      });
    }
    $("#backKb").addEventListener("click", renderTopicGrid);
    const topicAiBtn = $("#topicAiBtn");
    if (topicAiBtn) topicAiBtn.addEventListener("click", () => aiAssistForTopic(topic));
    $("#learnBtn").addEventListener("click", () => {
      const wasMastered = state.mastery.has(topic.id);
      if (wasMastered) {
        state.mastery.delete(topic.id);
        delete state.masteryDates[topic.id];
      } else {
        state.mastery.add(topic.id);
        state.masteryDates[topic.id] = { t: Date.now(), r: 0 };
        logEvent("master", topic.id);
      }
      saveMastery();
      saveMasteryDates();
      showTopicDetail(topic.id);
      // 反馈闭环：原先点击后只有按钮文案变化，缺少明确的结果提示
      toast(wasMastered ? "已取消掌握：" + topic.name : "已标记掌握：" + topic.name, wasMastered ? "info" : "ok");
    });
  }

  /* 无障碍：难度筛选原先是一组无语义的 div，读屏无法识别为「单选组」。
     声明为 radiogroup / radio，并在切换时同步 aria-checked 与 tabindex。 */
  function markLevelChipsA11y() {
    const wrap = $("#levelChips");
    if (!wrap) return;
    wrap.setAttribute("role", "radiogroup");
    wrap.setAttribute("aria-label", "按难度筛选知识点");
    $$("#levelChips .chip").forEach((c) => {
      const on = c.classList.contains("active");
      c.setAttribute("role", "radio");
      c.setAttribute("aria-checked", on ? "true" : "false");
      c.setAttribute("tabindex", on ? "0" : "-1");
    });
  }
  markLevelChipsA11y();
  $$("#levelChips .chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      $$("#levelChips .chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      kbLevelFilter = chip.dataset.level;
      markLevelChipsA11y();
      renderTopicGrid();
    });
    // 方向键在单选项间移动（radiogroup 的标准键盘行为）
    chip.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const all = $$("#levelChips .chip");
      const i = all.indexOf(chip);
      const next = all[(i + (e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : all.length - 1)) % all.length];
      if (next) { next.click(); next.focus(); }
    });
  });

  const kbSearchInput = $("#kbSearch");
  if (kbSearchInput && !kbSearchInput.dataset.bound) {
    kbSearchInput.dataset.bound = "1";
    let searchTimer = null;
    kbSearchInput.addEventListener("input", () => {
      kbSearch = kbSearchInput.value || "";
      $("#kbSearchClear").classList.toggle("hidden", !kbSearch.trim());
      // 防抖：边打字边重绘大网格会卡，120ms 后再渲染更跟手
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(renderTopicGrid, 120);
    });
    // 仅自测模式暴露同步刷新钩子，避免防抖影响断言时序（生产不挂此钩子）
    if (window.__SELFTEST__) window.__kbFlushSearch = function () {
      if (searchTimer) { clearTimeout(searchTimer); searchTimer = null; renderTopicGrid(); }
    };
  }
  const kbSearchClearBtn = $("#kbSearchClear");
  if (kbSearchClearBtn && !kbSearchClearBtn.dataset.bound) {
    kbSearchClearBtn.dataset.bound = "1";
    kbSearchClearBtn.addEventListener("click", () => {
      kbSearch = "";
      kbSearchInput.value = "";
      kbSearchClearBtn.classList.add("hidden");
      renderTopicGrid();
    });
  }

  // 搜索范围切换：知识点 / 全库
  const kbScopeEl = $("#kbScope");
  if (kbScopeEl && !kbScopeEl.dataset.bound) {
    kbScopeEl.dataset.bound = "1";
    kbScopeEl.querySelectorAll(".chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        kbScope = chip.dataset.scope;
        kbScopeEl.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        renderTopicGrid();
      });
    });
  }
  // 掌握度排序切换（原按钮无绑定，点击无反应 → 补上真实排序）
  const sortEl = $(".kb-sort");
  if (sortEl && !sortEl.dataset.bound) {
    sortEl.dataset.bound = "1";
    // 无障碍：原先是纯 div，只能鼠标点且读屏不可识别 → 补语义与键盘支持
    sortEl.setAttribute("role", "button");
    sortEl.setAttribute("tabindex", "0");
    sortEl.setAttribute("aria-label", "切换卡片排序方式");
    sortEl.addEventListener("click", () => {
      kbSortMode = kbSortMode === "default" ? "mastery-desc" : kbSortMode === "mastery-desc" ? "mastery-asc" : "default";
      const label = kbSortMode === "default" ? "默认排序" : kbSortMode === "mastery-desc" ? "掌握度 ↓" : "掌握度 ↑";
      sortEl.innerHTML = `<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h10M4 17h6"/></svg>${label}`;
      sortEl.setAttribute("aria-label", "当前排序：" + label + "，点击切换");
      renderTopicGrid();
    });
    sortEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); sortEl.click(); }
    });
  }
  // 学习路径视图开关
  const kbPathBtn = $("#kbPathBtn");
  if (kbPathBtn && !kbPathBtn.dataset.bound) {
    kbPathBtn.dataset.bound = "1";
    kbPathBtn.addEventListener("click", () => {
      kbPath = !kbPath;
      kbPathBtn.classList.toggle("active", kbPath);
      kbPathBtn.textContent = kbPath ? t("kb.path.on") : t("kb.path");
      renderTopicGrid();
    });
  }

  // 全库检索结果中「交互靶场」可直达：暴露按 id 打开 lab 的桥
  window.__openLabById = function (id) {
    const lab = SEC_DATA.labs.find((l) => l.id === id);
    if (!lab) return;
    if (typeof labActiveCat !== "undefined") labActiveCat = lab.cat;
    activateTab("range");
    const solSeg = document.querySelector('.seg-btn[data-seg="labs"]');
    if (solSeg) solSeg.click();
    renderLab(lab);
  };

  /* ============================================================
     智能问答
     ============================================================ */
  const CHAT_KEY = "sectutor_chat";
  function saveChat() {
    try { localStorage.setItem(CHAT_KEY, $("#chatLog").innerHTML); } catch (e) {}
  }
  function autoScrollChat(log) {
    if (!log) return;
    const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 90;
    if (nearBottom) log.scrollTop = log.scrollHeight;
  }
  function addMsg(role, html) {
    const log = $("#chatLog");
    const row = document.createElement("div");
    row.className = "msg-row " + role;
    const face = role === "bot" ? "🛡️" : "🧑";
    row.innerHTML = `<div class="avatar ${role}">${face}</div><div class="msg ${role}">${html}</div>`;
    log.appendChild(row);
    autoScrollChat(log);
    saveChat();
    return row;
  }
  function showTyping() {
    const log = $("#chatLog");
    const row = document.createElement("div");
    row.className = "msg-row bot typing-row";
    row.innerHTML = `<div class="avatar bot">🛡️</div><div class="msg bot"><div class="typing"><span></span><span></span><span></span></div></div>`;
    log.appendChild(row);
    autoScrollChat(log);
  }
  function removeTyping() {
    $$(".typing-row").forEach((t) => t.remove());
    saveChat();
  }

  // 关键词路由：优先在「专注领域」匹配，未命中再回退全局
  function scoreTopic(t, text) {
    let score = 0;
    t.keywords.forEach((k) => {
      const kw = k.trim();
      if (kw.length < 2 && /^[a-z0-9]+$/i.test(kw)) return;  // 跳过单字符英文/数字关键词，避免 "e/d/n" 之类误匹配
      if (text.includes(kw.toLowerCase())) score += kw.length > 4 ? 2 : 1;
    });
    return score;
  }
  function routeTopic(q) {
    const text = q.toLowerCase();
    let best = null, bestScore = 0;
    const consider = (list) => list.forEach((t) => {
      const s = scoreTopic(t, text);
      if (s > bestScore) { bestScore = s; best = t; }
    });
    if (state.focusCat !== "auto") consider(allTopics().filter((t) => t.cat === state.focusCat));
    if (!best) consider(allTopics());
    return bestScore > 0 ? best : null;
  }

  // 根据问题措辞微调讲解难度
  function inferredLevel(q) {
    if (/入门|简单|基础|零基础|小白|通俗|是什么/.test(q)) return "入门";
    if (/深入|底层|原理|高级|内核|细节|进阶|底层原理/.test(q)) return "高级";
    if (/中级|实战|利用|exploit|攻防|红队|蓝队|复现|怎么打/.test(q)) return "中级";
    return state.userLevel;
  }

  function suggestionButtons(topics) {
    return `<div class="suggestions">${topics
      .map((t) => `<button data-q="${escapeHtml(t.name)}"${t.cat ? ` data-cat="${escapeHtml(t.cat)}"` : ""}>${escapeHtml(t.name)}</button>`)
      .join("")}</div>`;
  }

  function askBuiltin(q) {
    const level = inferredLevel(q);
    const intent = detectIntent(q);
    const docs = retrieve(q, 5);
    if (!docs.length) {
      addMsg("bot",
        t("src.nomatch") +
        `<div class="suggestions">${CATS.map((c) =>
          `<button data-q="${escapeHtml(c.name)}" data-cat="${escapeHtml(c.id)}">${escapeHtml(c.name)}</button>`).join("")}</div>`);
      bindSuggestions();
      return;
    }
    const topicDoc = docs.find((d) => d.src === "知识点") || docs[0];
    const topicId = topicDoc.id.replace(/^topic:/, "");
    // 意图感知领答：工具类诉求优先用工具文档领答，实战类优先用题解/靶场领答
    let primary = topicDoc, primaryKind = "topic";
    if (intent.tool) { const tool = docs.find((d) => d.src === "安全工具"); if (tool) { primary = tool; primaryKind = "tool"; } }
    else if (intent.example) { const ex = docs.find((d) => d.src === "靶场题解" || d.src === "交互靶场"); if (ex) { primary = ex; primaryKind = "example"; } }

    const p0 = primary.render();
    const tag = intent.defense ? " · 偏重防御" : intent.tool ? " · 偏重工具" : intent.example ? " · 偏重实战" : "";
    const defenseHint = (intent.defense || /防御|防护|修复|安全/.test(q))
      ? `<p style="margin-top:8px"><strong>🛡 防御要点：</strong>本应用所有内容仅用于合法授权的学习与防御研究。${p0.tool ? "相关工具：" + escapeHtml(p0.tool) + "。" : ""}</p>`
      : "";

    let html = `<strong>${escapeHtml(primary.title)}</strong>（按【${level}】档讲解${tag}）${t("src.offline")}：<br>${renderInline(p0.body || "")}`;
    if (p0.code) html += `<div class="code-wrap"><pre><code class="language-${escapeHtml(p0.codeLang || "text")}">${escapeHtml(p0.code)}</code></pre></div>`;
    html += defenseHint;
    // 领答非知识点时，补充关联知识点原理，保证「讲清楚原理」
    if (primaryKind !== "topic" && topicDoc && topicDoc !== primary) {
      const t0 = topicDoc.render();
      html += `<p style="margin-top:8px"><strong>📘 关联知识点：</strong>${escapeHtml(topicDoc.title)} — ${renderInline((t0.body || "").slice(0, 160))}</p>`;
    }
    const extras = [];
    if (p0.tool) extras.push("工具：" + p0.tool);
    if (p0.refs) extras.push("参考：" + p0.refs);
    if (extras.length) html += `<p style="margin-top:6px;color:var(--muted);font-size:.85em">${extras.map(escapeHtml).join(" ｜ ")}</p>`;
    const related = docs.filter((d) => d !== primary).slice(0, 4);
    if (related.length) {
      html += `<p style="margin-top:8px;color:var(--muted)">${t("src.related")}：` +
        related.map((d) => `<span class="cite" data-id="${escapeHtml(d.id)}">${escapeHtml(d.src)}·${escapeHtml(d.title)}</span>`).join("  ") + `</p>`;
    }
    const moreTopics = allTopics().filter((x) => x.cat === topicDoc.cat && x.id !== topicId).slice(0, 3);
    html += `<p style="margin-top:6px;color:var(--muted)">${t("src.more")}：` + suggestionButtons(moreTopics) + `</p>`;
    addMsg("bot", html);
    bindSuggestions();
  }

  // 可选 LLM 接口（OpenAI 兼容，RAG 增强）
  function setChatBusy(busy) {
    state.thinking = busy;
    const btn = $("#sendBtn"), inp = $("#chatInput");
    if (btn) btn.disabled = busy;
    if (inp) {
      inp.disabled = busy;
      inp.placeholder = busy ? "正在思考…" : "问我任何网安问题，例如：什么是 SQL 注入？怎么防御 XSS？";
    }
  }
  function buildContext(q) {
    const docs = retrieve(q, 6);
    if (!docs.length) return { text: "", docs: [] };
    const text = docs.map((d, i) =>
      `[${i + 1}] 【${d.src}】${d.title}\n${(d.render().body || "").slice(0, 700)}`
    ).join("\n\n---\n\n");
    return { text, docs };
  }
  async function chatCompletions(messages, tools, onChunk) {
    const base = (state.llm.base || "https://api.openai.com/v1").replace(/\/$/, "");
    const body = {
      model: state.llm.model || "gpt-4o-mini",
      messages,
      temperature: state.llm.temp != null ? state.llm.temp : 0.3,
      tools, tool_choice: "auto",
    };
    if (onChunk) body.stream = true;
    const resp = await fetch(base + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + state.llm.key },
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    if (!onChunk) {
      const data = await resp.json();
      const msg = data.choices?.[0]?.message || {};
      return { content: msg.content || "", message: msg, toolCalls: msg.tool_calls || [] };
    }
    // —— SSE 流式输出（逐字渲染）——
    if (!resp.body || !resp.body.getReader) {           // 环境不支持流式：退回非流解析
      const data = await resp.json();
      const msg = data.choices?.[0]?.message || {};
      return { content: msg.content || "", message: msg, toolCalls: msg.tool_calls || [] };
    }
    const reader = resp.body.getReader();
    const dec = new TextDecoder();
    let buf = "", full = "", done = false;
    const tcAcc = {};                                   // index -> {id, name, arguments}
    while (!done) {
      const { value, done: d } = await reader.read();
      if (d) done = true;
      if (value) buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
        if (!line || line.startsWith(":")) continue;
        if (line === "data: [DONE]") { done = true; break; }
        if (line.startsWith("data:")) {
          const json = line.slice(5).trim();
          try {
            const ev = JSON.parse(json);
            const delta = ev.choices?.[0]?.delta || {};
            if (delta.content) { full += delta.content; onChunk(delta.content); }
            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index || 0;
                tcAcc[idx] = tcAcc[idx] || { id: "", name: "", arguments: "" };
                if (tc.id) tcAcc[idx].id = tc.id;
                if (tc.function) {
                  if (tc.function.name) tcAcc[idx].name += tc.function.name;
                  if (tc.function.arguments) tcAcc[idx].arguments += tc.function.arguments;
                }
              }
            }
          } catch (e) { /* 忽略不完整 SSE 分片 */ }
        }
      }
    }
    const toolCalls = Object.keys(tcAcc).length
      ? Object.values(tcAcc).map((tk) => ({ id: tk.id, type: "function", function: { name: tk.name, arguments: tk.arguments } }))
      : [];
    return { content: full, message: toolCalls.length ? { tool_calls: toolCalls } : { content: full }, toolCalls };
  }

  /* ===================== Agent 增强（Phase 0）：LLM 网关 + 适配上下文 =====================
   * 架构事实：本应用 LLM 由前端直连 Provider（state.llm.base + Bearer key），没有中间后端。
   * 因此网关放在前端，复用既有 chatCompletions / buildContext / callTool / askBuiltin。
   * 默认 AGENT_ENABLED=false，askLLM 行为完全不变；置 true 后走 askAgent（网关+适配）。
   */
  let AGENT_ENABLED = false;
  const PROVIDERS = {
    openai:    { kind: "openai", label: "OpenAI 兼容" },
    deepseek:  { kind: "openai", label: "DeepSeek(兼容)" },
    local:     { kind: "openai", label: "本地 Ollama" },
    anthropic: { kind: "anthropic", label: "Anthropic" },
  };

  function inferLevel(masteryCount) {
    if (masteryCount >= 20) return "L2";
    if (masteryCount >= 8) return "L1";
    return "L0";
  }

  // 适配引擎种子：把四维度（水平/场景/领域/模态/设备）编译成 AdaptationContext
  function buildAdaptationContext() {
    const profile = state.profile || {};
    const masteryCount = state.mastery ? state.mastery.size : 0;
    const domains = (profile.domains && profile.domains.length) ? profile.domains
                  : (profile.pentest ? ["pentest"] : []);
    const online = (typeof navigator !== "undefined" && navigator.onLine === false) ? false : true;
    const offlineMode = !state.llm || !state.llm.key;
    return {
      user_level: state.userLevel || inferLevel(masteryCount),
      scenario: state.scenario || "general",
      modalities: ["text"],
      domains: domains,
      device: { online: online, low_resource: false, offline_mode: offlineMode },
      prompt_hints: [],
      tool_policy: { prefer_domains: domains, allow_high_risk: true },
    };
  }

  // LLM 网关：多 Provider 抽象 + 离线降级
  async function agentGatewayComplete(messages, tools, opts) {
    if (!state.llm || !state.llm.key) return { offline: true };
    const p = (state.llm.provider && PROVIDERS[state.llm.provider]) ? PROVIDERS[state.llm.provider] : PROVIDERS.openai;
    try {
      if (p.kind === "openai") {
        return await chatCompletions(messages, tools, opts && opts.onChunk);
      }
      if (p.kind === "anthropic") {
        return await anthropicComplete(messages, tools, opts);
      }
    } catch (e) {
      return { offline: true, error: e.message };
    }
    return { offline: true };
  }

  // Anthropic 适配器（非默认路径；当前非流式，返回完整内容）
  async function anthropicComplete(messages, tools, opts) {
    const base = (state.llm.base || "https://api.anthropic.com").replace(/\/$/, "");
    const sys = (messages.find((m) => m.role === "system") || {}).content || "";
    const msgs = messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));
    const body = {
      model: state.llm.model || "claude-3-5-sonnet-latest",
      max_tokens: 1024, system: sys, messages: msgs,
      tools: (tools || []).map((t) => ({ name: t.function.name, description: t.function.description, input_schema: t.function.parameters })),
    };
    const resp = await fetch(base + "/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": state.llm.key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    const data = await resp.json();
    const text = (data.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
    const tcs = (data.content || []).filter((c) => c.type === "tool_use")
      .map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: JSON.stringify(c.input) } }));
    return { content: text, message: { content: text, tool_calls: tcs }, toolCalls: tcs };
  }

  // 增强版问答：网关 + 适配上下文注入；离线/失败回退内置知识引擎
  // 测试/可替换桩：默认指向真实实现；window.__agent._setGateway/_setConfirm 可在自测中替换为 mock，
  // 以验证「模型调用工具 → 确认流 → 执行/拒绝」完整闭环，而不依赖真实 LLM 与网络。生产路径不受影响。
  let _agentGateway = agentGatewayComplete;
  let _confirmToolCall = confirmToolCall;
  async function askAgent(q) {
    if (state.thinking) return;
    const adapt = buildAdaptationContext();
    if (!state.llm || !state.llm.key) { askBuiltin(q); return; }
    setChatBusy(true); showTyping();
    state.history.push({ role: "user", content: q }); trimHistory(); logEvent("chat");
    const { text: ctx, docs } = buildContext(q);
    const sysBase = "你是 SecTutor 安全实训辅导 Agent（辅助建议型）。严格遵守：仅用于合法授权安全学习与防御研究；拒绝未授权攻击步骤与武器化代码；侧重原理与防御；回答结构清晰。";
    const adaptNote = "\n【用户适配上下文】水平:" + adapt.user_level + "; 场景:" + adapt.scenario + "; 领域:" + (adapt.domains.join("/") || "全部") + "; 模态:" + adapt.modalities.join("/") + "; 离线:" + adapt.device.offline_mode + "\n请据此调整讲解深度与术语密度。";
    const sys = sysBase + adaptNote + "\n以下是内置知识库检索资料（请用自己的话讲解并标注引用 [n]）：\n--- 资料开始 ---\n" + (ctx || "（无直接相关条目，基于通用网络安全常识作答，保持防御视角）") + "\n--- 资料结束 ---";
    const tools = toolSchemas();
    const messages = [{ role: "system", content: sys }, ...state.history.map((m) => ({ role: m.role, content: m.content }))];
    try {
      const botRow = addMsg("bot", "");
      const bubble = botRow ? botRow.querySelector(".msg.bot") : null;
      let streamed = "";
      const onChunk = (d) => { if (!bubble) return; streamed += d; bubble.innerHTML = escapeHtml(streamed).replace(/\n/g, "<br>"); autoScrollChat($("#chatLog")); };
      let reply = await _agentGateway(messages, tools, { onChunk });
      if (reply.offline) { state.history.pop(); removeTyping(); addMsg("bot", "⚠️ 已进入离线模式（无可用大模型）："); askBuiltin(q); return; }
      const srcTitleHtml = (ds) => `<p style="margin-top:8px;color:var(--muted);font-size:.85em">${t("src.title")}：` + ds.map((d, i) => `<span class="cite" data-id="${escapeHtml(d.id)}">[${i + 1}] ${escapeHtml(d.src)}·${escapeHtml(d.title)}</span>`).join("  ") + `</p>`;
      if (reply.toolCalls && reply.toolCalls.length) {
        if (bubble) bubble.innerHTML = ""; streamed = "";
        let rounds = 0;
        while (reply.toolCalls && reply.toolCalls.length && rounds < 4) {
          rounds++; messages.push(reply.message);
          for (const tc of reply.toolCalls) {
            const args = safeParse(tc.function.arguments, {});
            const tool = AGENT_TOOLS.find((x) => x.name === tc.function.name);
            if (tool && toolRequiresConfirm(tool.name)) {
              const ok = await _confirmToolCall(tool, args);
              if (!ok) { messages.push({ role: "tool", tool_call_id: tc.id, content: "用户拒绝执行该操作（" + tool.name + "），请勿再调用它，改为用文字向用户说明。" }); continue; }
            }
            const res = await callTool(tc.function.name, args);
            messages.push({ role: "tool", tool_call_id: tc.id, content: String(res) });
          }
          reply = await _agentGateway(messages, tools);
        }
        const ans = reply.content || "（模型返回为空）";
        state.history.push({ role: "assistant", content: ans }); trimHistory();
        let html = ans.replace(/</g, "&lt;").replace(/\n/g, "<br>");
        if (docs.length) html += srcTitleHtml(docs);
        if (bubble) bubble.innerHTML = html; else addMsg("bot", html);
      } else {
        const ans = reply.content || "（模型返回为空）";
        state.history.push({ role: "assistant", content: ans }); trimHistory();
        if (docs.length && bubble) bubble.innerHTML += srcTitleHtml(docs);
        if (!bubble) addMsg("bot", (reply.content || "").replace(/</g, "&lt;").replace(/\n/g, "<br>"));
      }
      saveChat();
    } catch (e) {
      state.history.pop(); removeTyping(); addMsg("bot", `⚠️ 大模型调用失败（${escapeHtml(e.message)}），已切换回内置知识引擎：`); askBuiltin(q);
    } finally { removeTyping(); setChatBusy(false); }
  }

  window.__agent = {
    enabled: AGENT_ENABLED,
    setEnabled: (v) => { AGENT_ENABLED = !!v; window.__agent.enabled = AGENT_ENABLED; },
    gateway: { complete: agentGatewayComplete },
    adapt: buildAdaptationContext,
    ask: (q) => askAgent(q),
    km: KM,
    vault: KeyVault,
    vectorEnabled: VECTOR_ENABLED,
    vectorActive: vectorActive,
    features: FEATURE_FLAGS,
    tools: listTools,
    requiresConfirm: toolRequiresConfirm,
    riskOf: toolRisk,
    confirmToolCall: confirmToolCall,
    callTool: callTool,
    setActiveEnv: (e) => { state.activeEnv = e; },
    _setGateway: (fn) => { _agentGateway = fn; },
    _setConfirm: (fn) => { _confirmToolCall = fn; },
    _resetHooks: () => { _agentGateway = agentGatewayComplete; _confirmToolCall = confirmToolCall; },
  };

  async function askLLM(q) {
    // 密钥口令保护：若已加密且未解锁，先弹出口令解锁（与 AGENT_ENABLED 无关）
    if (KeyVault.isProtected() && KeyVault.isLocked()) {
      const ok = await ensureLlmUnlocked();
      if (!ok) { addMsg("bot", "🔒 大模型密钥已口令保护，请输入访问口令解锁后再使用 AI 问答。"); return; }
    }
    if (AGENT_ENABLED) { askAgent(q); return; }
    if (!state.llm || !state.llm.key) {
      askBuiltin(q);
      return;
    }
    if (state.thinking) return;          // 防连发：上一轮未结束时忽略新请求
    setChatBusy(true);
    showTyping();
    state.history.push({ role: "user", content: q });
    trimHistory();
    logEvent("chat");
    const { text: ctx, docs } = buildContext(q);
    const sys = `你是 SecTutor，一个网络安全学习教学助手。严格要求：
1) 仅回答用于合法授权安全学习与防御研究的内容；
2) 拒绝任何针对未授权第三方系统的攻击步骤、武器化利用代码；
3) 侧重原理讲解与防御，语气专业友好；
3.5) 回答结构清晰：可视情况分「原理 / 危害 / 防御 / 示例」等小节，避免大段堆砌；若引用了下面资料，请在相关句末标注编号如 [1][2]；
4) 若用户问到未授权攻击，请明确拒绝并引导到授权靶场与防御视角。
5) 若用户要求解码 / 编码 / 计算哈希，优先调用提供的工具（base64/url/hex 编解码、hash_text、jwt_decode），不要自己猜测结果。
以下是内置知识库检索到的相关资料（仅供你参考与组织答案，请用你自己的话讲解，并在相关句末标注引用编号如 [1][2]）：
--- 资料开始 ---
${ctx || "（知识库未检索到直接相关条目，可基于通用网络安全常识作答，但仍须保持防御视角）"}
--- 资料结束 ---`;
    const tools = toolSchemas();
    const srcTitleHtml = (ds) => `<p style="margin-top:8px;color:var(--muted);font-size:.85em">${t("src.title")}：` +
      ds.map((d, i) => `<span class="cite" data-id="${escapeHtml(d.id)}">[${i + 1}] ${escapeHtml(d.src)}·${escapeHtml(d.title)}</span>`).join("  ") + `</p>`;
    try {
      const messages = [{ role: "system", content: sys }, ...state.history.map((m) => ({ role: m.role, content: m.content }))];
      removeTyping();
      const botRow = addMsg("bot", "");                 // 先建空气泡，流式逐字填入
      const bubble = botRow ? botRow.querySelector(".msg.bot") : null;
      let streamed = "";
      const onChunk = (delta) => {
        if (!bubble) return;
        streamed += delta;
        bubble.innerHTML = escapeHtml(streamed).replace(/\n/g, "<br>");
        autoScrollChat($("#chatLog"));
      };
      let reply = await chatCompletions(messages, tools, onChunk);
      if (reply.toolCalls && reply.toolCalls.length) {
        // 流式过程中若触发工具调用，清除半成品文本，改走非流工具循环（可靠性优先）
        if (bubble) bubble.innerHTML = "";
        streamed = "";
        let rounds = 0;
        while (reply.toolCalls && reply.toolCalls.length && rounds < 4) {
          rounds++;
          messages.push(reply.message);
          for (const tc of reply.toolCalls) {
            const res = callTool(tc.function.name, safeParse(tc.function.arguments, {}));
            messages.push({ role: "tool", tool_call_id: tc.id, content: String(res) });
          }
          reply = await chatCompletions(messages, tools);
        }
        const ans = reply.content || "（模型返回为空）";
        state.history.push({ role: "assistant", content: ans });
        trimHistory();
        let html = ans.replace(/</g, "&lt;").replace(/\n/g, "<br>");
        if (docs.length) html += srcTitleHtml(docs);
        if (bubble) bubble.innerHTML = html; else addMsg("bot", html);
      } else {
        const ans = reply.content || "（模型返回为空）";
        state.history.push({ role: "assistant", content: ans });
        trimHistory();
        if (docs.length && bubble) bubble.innerHTML += srcTitleHtml(docs);
        if (!bubble) addMsg("bot", (reply.content || "").replace(/</g, "&lt;").replace(/\n/g, "<br>"));
      }
      saveChat();
    } catch (e) {
      // 接口失败：回退内置检索引擎，并移除本轮已压入的历史用户消息以免污染多轮
      state.history.pop();
      addMsg("bot", `⚠️ 大模型接口调用失败（${escapeHtml(e.message)}），已切换回内置知识引擎：`);
      askBuiltin(q);
    } finally {
      removeTyping();
      setChatBusy(false);
    }
  }

  /* ---------- 输入草稿自动保存（P2）：刷新或意外关闭不丢未发送的输入 ---------- */
  const DRAFT_KEY = "sectutor_chat_draft";
  let draftTimer = null;
  function saveDraft(v) {
    try {
      if (v && v.trim()) localStorage.setItem(DRAFT_KEY, v);
      else localStorage.removeItem(DRAFT_KEY);
    } catch (e) {}
  }
  function clearDraft() {
    if (draftTimer) { clearTimeout(draftTimer); draftTimer = null; }
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
  }
  function restoreDraft() {
    const inp = $("#chatInput");
    if (!inp) return;
    let v = "";
    try { v = localStorage.getItem(DRAFT_KEY) || ""; } catch (e) {}
    if (v && !inp.value) inp.value = v;
  }

  function send() {
    const input = $("#chatInput");
    const q = input.value.trim();
    if (!q || state.thinking) return;
    addMsg("user", escapeHtml(q));
    input.value = "";
    clearDraft();
    logEvent("chat");
    askLLM(q);
  }

  function bindSuggestions() {
    $$("#chatLog .suggestions button").forEach((b) => {
      if (b.dataset.bound) return;        // 已绑定的不再重复绑定，避免多次点击重复发送
      b.dataset.bound = "1";
      b.addEventListener("click", () => {
        const cat = b.dataset.cat;
        if (cat) { gotoCategory(cat); return; }   // 分类按钮：跳转知识体系对应领域
        const q = b.dataset.q;
        addMsg("user", escapeHtml(q));
        askLLM(q);
      });
    });
  }

  function gotoCategory(catId) {
    kbActiveCat = catId;
    renderCatList();
    renderTopicGrid();
    activateTab("knowledge");
  }

  $("#sendBtn").addEventListener("click", send);
  $("#chatInput").addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
  // 草稿自动保存：输入停止 400ms 后落盘，刷新或意外关闭不丢未发送内容
  $("#chatInput").addEventListener("input", (e) => {
    const inp = e.target;
    if (draftTimer) clearTimeout(draftTimer);
    draftTimer = setTimeout(() => saveDraft(inp.value), 400);
  });
  // 聊天引用条目可点击：跳转到对应模块（知识点打开详情 / 资讯·工具·靶场聚焦面板）
  $("#chatLog").addEventListener("click", (e) => {
    const el = e.target.closest(".cite");
    if (!el || !el.dataset.id) return;
    const doc = DOC_BY_ID.get(el.dataset.id);
    if (doc) gotoCorpusDoc(doc);
  });
  $("#userLevel").addEventListener("change", (e) => { state.userLevel = e.target.value; });
  $("#focusCat").addEventListener("change", (e) => { state.focusCat = e.target.value; });

  // 快速提问
  const QUICK = ["什么是 SQL 注入？怎么防御", "XSS 有哪几种？", "栈溢出原理是什么", "RSA 为什么安全", "渗透测试第一步做什么", "AES 应该怎么用才安全"];
  function renderQuick() {
    $("#quickQs").innerHTML = QUICK.map((q) => `<button class="chip" data-q="${escapeHtml(q)}">${escapeHtml(q)}</button>`).join("");
    $$("#quickQs .chip").forEach((b) => b.addEventListener("click", () => {
      const q = b.dataset.q; addMsg("user", escapeHtml(q)); askLLM(q);
    }));
  }

  // LLM 配置
  $("#saveLlm").addEventListener("click", () => {
    const keepKey = KeyVault.isProtected() && state.llm && state.llm.key;   // 保护态：保留已解锁的明文 key
    state.llm = {
      base: $("#llmBase").value.trim() || "https://api.openai.com/v1",
      key: KeyVault.isProtected() ? (keepKey || "") : $("#llmKey").value.trim(),
      model: $("#llmModel").value.trim() || "gpt-4o-mini",
    };
    saveLlmState();
    addMsg("bot", "✅ 已保存大模型配置（仅存于本机浏览器）。后续问答将优先调用该接口，失败时回退内置知识引擎。");
  });
  $("#clearLlm").addEventListener("click", () => {
    state.llm = null; localStorage.removeItem("sectutor_llm");
    $("#llmBase").value = ""; $("#llmKey").value = ""; $("#llmModel").value = "";
    addMsg("bot", "已清除大模型配置，恢复内置知识引擎。");
  });

  // 临时靶场后端配置
  const saveBackendBtn = $("#saveBackend");
  if (saveBackendBtn && !saveBackendBtn.dataset.bound) {
    saveBackendBtn.dataset.bound = "1";
    saveBackendBtn.addEventListener("click", () => {
      state.backend = {
        url: $("#backendUrl").value.trim() || "http://127.0.0.1:8787",
        token: $("#backendToken").value.trim() || "sectutor-dev-token",
      };
      localStorage.setItem("sectutor_backend_url", state.backend.url);
      localStorage.setItem("sectutor_backend_token", state.backend.token);
      addMsg("bot", "✅ 已保存临时靶场后端配置（仅存于本机）。生成临时环境时将访问该地址。");
    });
  }
  const clearBackendBtn = $("#clearBackend");
  if (clearBackendBtn && !clearBackendBtn.dataset.bound) {
    clearBackendBtn.dataset.bound = "1";
    clearBackendBtn.addEventListener("click", () => {
      state.backend = { url: defaultBackendUrl(), token: "sectutor-dev-token" };
      localStorage.removeItem("sectutor_backend_url");
      localStorage.removeItem("sectutor_backend_token");
      $("#backendUrl").value = ""; $("#backendToken").value = "";
      addMsg("bot", "已恢复默认后端配置（" + defaultBackendUrl() + "）。");
    });
  }

  /* ============================================================
     实战靶场
     ============================================================ */
  let rangeActiveCat = "all";
  function renderRangeCats() {
    const ul = $("#rangeCats");
    ul.innerHTML = "";
    const mk = (id, name) => {
      const li = document.createElement("li");
      li.className = id === rangeActiveCat ? "active" : "";
      const cnt = id === "all" ? SEC_DATA.ranges.length : SEC_DATA.ranges.filter((r) => r.cat === id).length;
      li.innerHTML = `<span>${name}</span><span class="count">${cnt}</span>`;
      li.addEventListener("click", () => { rangeActiveCat = id; renderRangeCats(); renderRangeList(); });
      ul.appendChild(li);
    };
    mk("all", "全部");
    CATS.forEach((c) => mk(c.id, c.icon + " " + c.name));
  }
  function renderRangeList() {
    const list = $("#rangeList");
    const detail = $("#rangeDetail");
    detail.classList.add("hidden"); list.classList.remove("hidden");
    list.innerHTML = "";
    const items = SEC_DATA.ranges.filter((r) => rangeActiveCat === "all" || r.cat === rangeActiveCat);
    items.forEach((r) => {
      const card = document.createElement("div");
      card.className = "range-card";
      card.innerHTML = `<h4>${escapeHtml(r.title)}</h4>
        <div class="meta"><span class="lvl-tag lvl-${r.level}">${r.level}</span><span>${catById(r.cat).name}</span></div>
        <p style="font-size:13px;color:var(--muted);margin:8px 0 0">${escapeHtml(r.summary)}</p>`;
      card.addEventListener("click", () => showRange(r.id));
      list.appendChild(card);
    });
  }
  function showRange(id) {
    const r = SEC_DATA.ranges.find((x) => x.id === id);
    const list = $("#rangeList"); const detail = $("#rangeDetail");
    list.classList.add("hidden"); detail.classList.remove("hidden");
    detail.innerHTML = `
      <button class="back-btn" id="backRange">← 返回列表</button>
      <h2>${escapeHtml(r.title)} <span class="lvl-tag lvl-${r.level}">${r.level}</span></h2>
      <p style="color:var(--muted)">领域：${catById(r.cat).name}</p>
      <div class="lab-setup"><strong>🧪 实验环境：</strong>${escapeHtml(r.setup)}</div>
      <div class="kb-section"><h4>🎯 解题思路</h4><p>${escapeHtml(r.writeup)}</p></div>
      <div class="kb-section"><h4>🪜 推荐步骤</h4><ol>${r.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ol></div>
      <div class="writeup"><h4>🛡 防御与修复</h4><p>${escapeHtml(r.defense)}</p></div>
      <div class="ai-helpers">
        <button class="btn ghost small" id="rangeAiBtn">🤖 AI 辅助</button>
      </div>
      <p class="muted" style="font-size:12px;color:var(--muted)">⚠️ 请仅在本地或已获书面授权的靶场环境中练习，禁止对非授权系统使用。</p>`;
    $("#backRange").addEventListener("click", renderRangeList);
    const rangeAi = $("#rangeAiBtn");
    if (rangeAi) rangeAi.addEventListener("click", () => aiAssistForRange(r));
  }

  /* ============================================================
     学习计划与进度
     ============================================================ */
  function genPlan() {
    const cat = $("#planCat").value;
    const hours = parseInt($("#planHours").value, 10);
    const weeks = parseInt($("#planWeeks").value, 10);
    const pool = cat === "all" ? allTopics() : catById(cat).topics.map((t) => ({ ...t, cat }));
    if (pool.length === 0) { $("#planOutput").innerHTML = "<p>该领域暂无内容。</p>"; return; }
    // 自适应排序（方向①b）：优先补强「能力画像最弱」且「尚未掌握」的领域/知识点
    const order = { "入门": 0, "初级": 1, "中级": 2, "高级": 3 };
    const weakness = (catId) => (state.profile && state.profile[catId] != null) ? (100 - state.profile[catId]) : 50;
    const sorted = [...pool].sort((a, b) => {
      const pa = state.mastery.has(a.id) ? -1 : weakness(a.cat);
      const pb = state.mastery.has(b.id) ? -1 : weakness(b.cat);
      if (pa !== pb) return pb - pa;            // 未掌握 & 弱项优先
      return order[a.level] - order[b.level];   // 同档内按难度梯度
    });
    const perWeek = Math.max(1, Math.ceil(sorted.length / weeks));
    let basis = `（每周约 ${hours} 小时）`;
    if (state.profile) {
      const weakest = Object.keys(weakness).reduce((w, k) => weakness(k) > weakness(w) ? k : w, "web");
      const wname = ({ web: "Web 安全", binary: "二进制漏洞", crypto: "密码学", pentest: "渗透测试" })[weakest];
      basis = `（基于你的能力画像，最弱领域为「${wname}」，已优先排在前面）`;
    }
    let html = `<h3>你的 ${weeks} 周学习计划 · ${cat === "all" ? "全领域综合" : catById(cat).name} ${basis}</h3>`;
    for (let w = 0; w < weeks; w++) {
      const slice = sorted.slice(w * perWeek, (w + 1) * perWeek);
      if (slice.length === 0) break;
      html += `<div class="week-block"><h4>第 ${w + 1} 周</h4><ul>` +
        slice.map((t) => `<li>${escapeHtml(t.name)}（${t.level}）— ${escapeHtml(t.summary)}</li>`).join("") +
        `</ul></div>`;
    }
    html += `<p style="color:var(--muted);font-size:13px">提示：每周完成后在「知识体系」对应知识点点击「我已掌握」即可在下方跟踪进度；已掌握的知识点会自动排到计划末尾。</p>`;
    $("#planOutput").innerHTML = html;
    renderProgress();
    // 反馈闭环：原先生成后无任何提示，用户不确定是否已生效
    toast(`已生成 ${weeks} 周学习计划，共 ${sorted.length} 个知识点`, "ok");
  }

  function renderProgress() {
    const board = $("#progressBoard");
    // 原实现在循环里 innerHTML +=，每次都会让浏览器重新序列化并解析整段 HTML（O(n²) 重解析）
    // 改为先拼好字符串再一次性赋值
    const parts = ["<h3>📊 掌握度进度</h3>"];
    CATS.forEach((c) => {
      const total = c.topics.length;
      const done = c.topics.filter((t) => state.mastery.has(t.id)).length;
      const pct = total ? Math.round((done / total) * 100) : 0;
      parts.push(`
        <div class="pcard">
          <div><strong>${c.icon} ${c.name}</strong></div>
          <div style="font-size:13px;color:var(--muted)">${done}/${total} 已掌握</div>
          <div class="bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${escapeHtml(c.name)}掌握进度 ${pct}%"><i style="width:${pct}%"></i></div>
        </div>`);
    });
    board.innerHTML = parts.join("");
  }

  $("#genPlan").addEventListener("click", genPlan);
  // 原先此处无任何确认即清空掌握度（与设置内的重置不一致），现统一为确认 + 可撤销
  $("#resetPlan").addEventListener("click", () => {
    resetMasteryUndoable("确定重置全部掌握进度？重置后可在右下角提示条点击「撤销」恢复。");
  });

  // 计划导出
  function exportPlanPdf() {
    const st = $("#exportStatus");
    const out = $("#planOutput");
    if (!out || !(out.innerHTML || "").trim()) {
      if (st) st.textContent = "请先生成学习计划再导出。";
      toast("请先生成学习计划再导出", "err");
      return;
    }
    if (st) st.textContent = "正在打开打印对话框（可「另存为 PDF」）…";
    window.print();
    toast("已打开打印对话框，选择「另存为 PDF」即可保存", "info");
  }
  function wrapText(text, max) {
    const out = [];
    text.split("\n").forEach((par) => {
      if (!par) { out.push(""); return; }
      let line = "";
      for (const ch of par) {
        line += ch;
        if (line.length >= max) { out.push(line); line = ""; }
      }
      if (line) out.push(line);
    });
    return out;
  }
  function exportPlanPng() {
    const st = $("#exportStatus");
    const src = $("#planOutput");
    if (!src || !(src.textContent || "").trim()) {
      if (st) st.textContent = "请先生成学习计划再导出。";
      toast("请先生成学习计划再导出", "err");
      return;
    }
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext && canvas.getContext("2d");
    if (!ctx) {
      if (st) st.textContent = "当前环境不支持 PNG 导出，请改用「导出 PDF」或在浏览器中打开。";
      toast("当前环境不支持 PNG 导出，请改用「导出 PDF」", "err");
      return;
    }
    const text = (src.textContent || "").replace(/[ \t]+\n/g, "\n").trim();
    const lines = wrapText(text, 78);
    const W = 940, pad = 28, lineH = 22, titleH = 30;
    const H = pad * 2 + titleH + lines.length * lineH + 10;
    canvas.width = W; canvas.height = H;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#1d4ed8"; ctx.font = "bold 18px sans-serif";
    ctx.fillText("SecTutor · 网络安全学习计划", pad, pad + 18);
    ctx.fillStyle = "#111111"; ctx.font = "14px sans-serif";
    let y = pad + titleH + 6;
    lines.forEach((l) => { ctx.fillText(l, pad, y); y += lineH; });
    try {
      const a = document.createElement("a");
      a.download = "sectutor-plan.png";
      a.href = canvas.toDataURL("image/png");
      a.click();
      if (st) st.textContent = "已导出 sectutor-plan.png";
      toast("已导出 sectutor-plan.png", "ok");
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      if (st) st.textContent = "PNG 导出失败：" + msg;
      toast("PNG 导出失败：" + msg, "err");
    }
  }
  const exportPdfBtn = $("#exportPdf");
  if (exportPdfBtn && !exportPdfBtn.dataset.bound) { exportPdfBtn.dataset.bound = "1"; exportPdfBtn.addEventListener("click", exportPlanPdf); }
  const exportPngBtn = $("#exportPng");
  if (exportPngBtn && !exportPngBtn.dataset.bound) { exportPngBtn.dataset.bound = "1"; exportPngBtn.addEventListener("click", exportPlanPng); }

  /* ============================================================
     在线演练（程序内可交互靶场，纯前端模拟）
     ============================================================ */
  let labActiveCat = "all";
  function labCatsData() {
    const ids = [...new Set(SEC_DATA.labs.map((l) => l.cat))];
    return [{ id: "all", name: "全部" }].concat(
      ids.map((id) => { const c = catById(id); return { id, name: c.icon + " " + c.name }; })
    );
  }
  function renderLabCats() {
    const ul = $("#labCats");
    ul.innerHTML = "";
    labCatsData().forEach((c) => {
      const li = document.createElement("li");
      li.className = c.id === labActiveCat ? "active" : "";
      const cnt = c.id === "all" ? SEC_DATA.labs.length : SEC_DATA.labs.filter((l) => l.cat === c.id).length;
      li.innerHTML = `<span>${c.name}</span><span class="count">${cnt}</span>`;
      li.addEventListener("click", () => { labActiveCat = c.id; renderLabCats(); renderLabList(); });
      ul.appendChild(li);
    });
  }
  function renderLabList() {
    const list = $("#labList");
    const area = $("#labArea");
    area.classList.add("hidden");
    list.classList.remove("hidden");
    renderLabStats();
    list.innerHTML = "";
    const items = SEC_DATA.labs.filter((l) => labActiveCat === "all" || l.cat === labActiveCat);
    items.forEach((l) => {
      const solved = state.labsSolved.has(l.id);
      const card = document.createElement("div");
      card.className = "range-card";
      card.innerHTML = `<h4>${escapeHtml(l.title)}</h4>
        <div class="meta"><span class="lvl-tag lvl-${l.level}">${l.level}</span><span>${catById(l.cat).name}</span>${solved ? '<span class="lvl-tag lvl-入门">✓</span>' : ""}</div>
        <p style="font-size:13px;color:var(--muted);margin:8px 0 0">${escapeHtml(l.brief.split("\n")[0])}</p>`;
      card.addEventListener("click", () => renderLab(l));
      list.appendChild(card);
    });
  }
  /* ---- 靶场战绩（解析计分）面板 ---- */
  function renderLabStats() {
    const el = $("#labStats");
    if (!el) return;
    const total = SEC_DATA.labs.length;
    const done = state.labsSolved.size;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const byCat = CATS.map((c) => {
      const labs = SEC_DATA.labs.filter((l) => l.cat === c.id);
      const sd = labs.filter((l) => state.labsSolved.has(l.id)).length;
      return `<div class="stat-cat"><span>${c.icon} ${escapeHtml(c.name)}</span><b>${sd}/${labs.length}</b></div>`;
    }).join("");
    el.innerHTML = `<div class="stat-head">
        <div class="stat-main"><div class="stat-num"><b>${done}</b>/${total}</div><div class="stat-pct">完成度 ${pct}%</div></div>
        <div class="stat-ring" style="--p:${pct}"><span>${pct}%</span></div>
      </div>
      <div class="stat-cats">${byCat}</div>
      <button class="btn small ghost" id="labReset">重置战绩</button>`;
    const rb = $("#labReset");
    if (rb) rb.addEventListener("click", () => {
      if (typeof confirm === "function" && !confirm("确定清空所有靶场战绩？清空后可在右下角提示条点击「撤销」恢复。")) return;
      const snap = Array.from(state.labsSolved || []);
      const n = snap.length;
      state.labsSolved.clear();
      try { localStorage.removeItem("sectutor_labs"); } catch (e) {}
      renderLabStats(); renderLabList();
      toast(n ? "已清空 " + n + " 条靶场战绩" : "当前没有靶场战绩", "info", {
        actionText: n ? "撤销" : null,
        onAction: function () {
          snap.forEach((id) => state.labsSolved.add(id));
          try { localStorage.setItem("sectutor_labs", JSON.stringify(snap)); } catch (e) {}
          renderLabStats(); renderLabList();
          toast("已恢复 " + n + " 条靶场战绩", "ok");
        },
      });
    });
  }
  // 支持独立临时靶机的测试点（与 sectutor-backend 的 labSpecs 对齐）
  const BACKEND_LABS = ["lab_sqli", "lab_cmdi", "lab_xss", "lab_traversal", "lab_nosql"];

  function getFetch() {
    if (typeof fetch === "function") return fetch;
    if (typeof window !== "undefined" && typeof window.fetch === "function") return window.fetch;
    return null;
  }
  function stopEnvTimers() {
    if (state.envTimer) { clearInterval(state.envTimer); state.envTimer = null; }
    if (state.envPoll) { clearInterval(state.envPoll); state.envPoll = null; }
  }
  function renderEnvSection(lab) {
    stopEnvTimers();
    const box = $("#envSection");
    if (!box) return;
    if (BACKEND_LABS.indexOf(lab.id) < 0) { box.innerHTML = ""; return; }
    box.innerHTML = `
      <div class="kb-section env-section">
        <h4>🌐 临时靶场（真实隔离环境）</h4>
        <p class="muted" style="font-size:12px;color:var(--muted)">点击下方按钮向 SecTutor 后端申请一个独立的临时靶机（默认 30 分钟绝对 TTL + 10 分钟空闲回收，到期自动销毁并释放资源，不影响原环境与其他用户）。后端不可用时将自动回退到本页前端仿真演练。</p>
        <button class="btn small" id="genEnvBtn">⚡ 生成临时环境</button>
        <div id="envPanel" class="env-panel hidden"></div>
      </div>`;
    $("#genEnvBtn").addEventListener("click", () => requestEnv(lab));
  }
  function envApi(path, opts) {
    const base = (state.backend.url || "").replace(/\/+$/, "");
    return getFetch()(base + path, Object.assign({
      headers: { Authorization: "Bearer " + (state.backend.token || "") },
    }, opts));
  }
  function requestEnv(lab) {
    const panel = $("#envPanel");
    if (!panel) return;
    panel.classList.remove("hidden");
    stopEnvTimers();
    panel.innerHTML = `<div class="env-status">⏳ 正在向后端申请临时环境…</div>`;
    const btn = $("#genEnvBtn"); if (btn) btn.disabled = true;
    const fn = getFetch();
    if (!fn) { showEnvDegrade(panel, btn); return; }
    const ctrl = typeof AbortController === "function" ? new AbortController() : null;
    const timer = setTimeout(() => { if (ctrl) ctrl.abort(); }, 8000);
    envApi("/api/envs", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + state.backend.token },
      body: JSON.stringify({ labId: lab.id }),
      signal: ctrl ? ctrl.signal : undefined,
    }).then((r) => r.json().then((d) => ({ r, d })))
      .then(({ r, d }) => {
        clearTimeout(timer);
        if (!r.ok || !d.ok) { showEnvDegrade(panel, btn, (d && d.error) || ("HTTP " + r.status)); return; }
        showEnvReady(panel, btn, d.env);
        toast(d.env && d.env.simulated ? "靶场已就绪（本地仿真模式，无需后端）" : "靶场环境已就绪，可开始练习", "ok");
      })
      .catch((e) => {
        clearTimeout(timer);
        showEnvDegrade(panel, btn, e && e.name === "AbortError" ? "请求超时" : (e && e.message) || "网络错误");
      });
  }
  function showEnvDegrade(panel, btn, msg) {
    panel.innerHTML = `<div class="env-status warn">⚠️ 临时靶场后端不可用（${escapeHtml(msg || "")}），已回退到本地仿真演练。你仍可在此页面完成前端练习。</div>`;
    if (btn) btn.disabled = false;
    toast("靶场后端不可用，已回退本地仿真：" + (msg || "未知原因"), "err");
  }
  function proxyUrl(env) {
    const base = env && env.accessUrl;
    if (!base) return "#";
    const t = state.backend && state.backend.token ? state.backend.token : "";
    return base + (base.indexOf("?") === -1 ? "?" : "&") + "t=" + encodeURIComponent(t);
  }
  function showEnvReady(panel, btn, env) {
    state.activeEnv = env;
    const accessBlock = env.simulated
      ? `<div class="env-status muted" style="font-size:12px;color:var(--muted)">🧪 本地仿真模式：无真实容器，已用前端演练替代（无需后端）。</div>`
      : `<div class="env-url">🔗 访问靶场（经后端鉴权反向代理）：<a href="${escapeHtml(proxyUrl(env))}" target="_blank" rel="noopener">${escapeHtml(proxyUrl(env))}</a></div>`;
    panel.innerHTML = `
      <div class="env-status ok">✅ 临时环境已就绪（${escapeHtml(env.status || "running")}）</div>
      ${accessBlock}
      <div class="env-meta">⏳ 剩余时间：<span id="envCountdown">--</span></div>
      <button class="btn small ghost" id="destroyEnvBtn">🛑 结束并销毁（释放资源）</button>
      <div id="envPoll" class="env-status muted" style="font-size:12px;color:var(--muted)">状态轮询已启动…</div>`;
    if (btn) btn.disabled = false;
    startCountdown(env.expiresAt);
    const db = $("#destroyEnvBtn");
    if (db) db.addEventListener("click", () => destroyEnvFront(panel, btn, env.id));
    if (getFetch()) {
      state.envPoll = setInterval(() => {
        envApi("/api/envs/" + env.id).then((r) => r.json()).then((d) => {
          const p = $("#envPoll");
          if (p && d && d.ok) {
            p.textContent = "状态轮询：" + (d.env.status) + (d.env.status === "destroyed" ? " · 环境已回收" : "");
            if (d.env.status === "destroyed") stopEnvTimers();
          }
        }).catch(() => {});
      }, 15000);
    }
  }
  function startCountdown(expiresAt) {
    stopEnvTimers();
    const tick = () => {
      const el = $("#envCountdown");
      if (!el) return;
      const left = (expiresAt || 0) - Date.now();
      if (left <= 0) { el.textContent = "已到期 / 自动释放"; stopEnvTimers(); return; }
      const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
      el.textContent = `${m} 分 ${s} 秒`;
      // 微交互：最后 60 秒进入告警态（红色 + 脉动），让用户及时保存进度
      if (left <= 60000) el.classList.add("warn"); else el.classList.remove("warn");
    };
    tick();
    state.envTimer = setInterval(tick, 1000);
  }
  function destroyEnvFront(panel, btn, id) {
    const fn = getFetch();
    if (!fn) { showEnvDegrade(panel, btn, "后端不可用"); return; }
    envApi("/api/envs/" + id, { method: "DELETE" }).then((r) => r.json()).then((d) => {
      stopEnvTimers();
      panel.innerHTML = `<div class="env-status ok">🗑 环境已销毁，资源已释放。</div>`;
      toast("靶场环境已销毁，资源已释放", "info");
      if (btn) btn.disabled = false;
    }).catch((e) => {
      panel.innerHTML = `<div class="env-status warn">销毁请求失败：${escapeHtml((e && e.message) || "")}，可在后端手动清理。</div>`;
      toast("销毁请求失败：" + ((e && e.message) || "网络错误"), "err");
      if (btn) btn.disabled = false;
    });
  }

  function renderLab(lab) {
    const area = $("#labArea");
    $("#labList").classList.add("hidden");
    area.classList.remove("hidden");
    const solved = state.labsSolved.has(lab.id);
    area.innerHTML = `
      <button class="back-btn" id="backLab">← 返回列表</button>
      <h2>${escapeHtml(lab.title)} <span class="lvl-tag lvl-${lab.level}">${lab.level}</span> ${solved ? '<span class="lvl-tag lvl-入门">✓ 已完成</span>' : ""}</h2>
      <div class="kb-section"><h4>📝 背景</h4><p style="white-space:pre-wrap">${escapeHtml(lab.brief)}</p></div>
      <div class="kb-section"><h4>🎯 任务</h4><p>${escapeHtml(lab.task)}</p></div>
      ${lab.topic ? `<div class="kb-section"><h4>📚 相关知识点</h4><p>本题对应知识库条目：<button class="btn small ghost" id="labTopicBtn">查看「${escapeHtml(topicName(lab.topic))}」知识点 →</button></p></div>` : ""}
      <div id="labInput"></div>
      <div class="kb-section"><h4>💡 提示（可逐步揭示）</h4>
        <ol id="labHints" class="hint-list"></ol>
        <button class="btn small ghost" id="labHintBtn">显示第 1 条提示</button>
      </div>
      <div id="labResult" class="lab-result hidden"></div>
      <div class="ai-helpers">
        <button class="btn ghost small" id="labAiBtn">🤖 AI 辅助</button>
      </div>
      <div id="envSection"></div>
      <p class="muted" style="font-size:12px;color:var(--muted)">⚠️ 本页基础演练为前端模拟环境，不会向任何真实服务器发送请求，仅用于理解漏洞原理与防御。需要真实隔离靶机时，可点击下方「生成临时环境」（需自建后端）。</p>`;
    $("#backLab").addEventListener("click", renderLabList);
    buildLabInput(lab);
    const tb = $("#labTopicBtn");
    if (tb) tb.addEventListener("click", () => { activateTab("knowledge"); showTopicDetail(lab.topic); });
    renderEnvSection(lab);
    // 逐步揭示提示
    let hi = 0;
    const hintBtn = $("#labHintBtn");
    const hintList = $("#labHints");
    if (hintBtn && hintList) {
      hintBtn.addEventListener("click", () => {
        if (hi < lab.hints.length) {
          const li = document.createElement("li");
          li.textContent = lab.hints[hi];
          hintList.appendChild(li);
          hi++;
          if (hi >= lab.hints.length) { hintBtn.textContent = "已全部揭示"; hintBtn.disabled = true; }
          else hintBtn.textContent = `显示第 ${hi + 1} 条提示`;
        }
      });
    }
    const labAi = $("#labAiBtn");
    if (labAi) labAi.addEventListener("click", () => aiAssistForLab(lab));
  }
  function buildLabInput(lab) {
    const box = $("#labInput");
    const exampleBtn = lab.example ? `<button class="btn small ghost" id="liEx">填入示例 payload</button>` : "";
    const liveBox = `<div id="labLive" class="lab-live"></div>`;
    const bindEx = () => {
      if (!lab.example) return;
      const ex = $("#liEx");
      if (ex) ex.addEventListener("click", () => { const i = $("#li1"); if (i) { i.value = lab.example; i.dispatchEvent(new Event("input")); } });
    };
    if (lab.type === "sqli") {
      box.innerHTML = `<label class="field"><span>用户名 username</span><input id="li1" placeholder="如 admin' -- " /></label>
        <label class="field"><span>密码 password</span><input id="li2" placeholder="任意" /></label>
        <div class="lab-actions"><button class="btn" id="liRun">提交查询</button></div>${liveBox}`;
      const upd = () => { $("#labLive").textContent = "构造的 SQL → SELECT * FROM users WHERE username='" + $("#li1").value + "' AND password='" + $("#li2").value + "'"; };
      $("#li1").addEventListener("input", upd); $("#li2").addEventListener("input", upd); upd();
      $("#liRun").addEventListener("click", () => { showLabResult(checkSqli($("#li1").value, $("#li2").value), lab); });
    } else if (lab.type === "cmdi") {
      box.innerHTML = `<label class="field"><span>主机名 host</span><input id="li1" placeholder="如 127.0.0.1; id" /></label>
        <div class="lab-actions"><button class="btn" id="liRun">执行</button>${exampleBtn}</div>${liveBox}`;
      const upd = () => { $("#labLive").textContent = "构造的命令 → ping -c1 " + $("#li1").value; };
      $("#li1").addEventListener("input", upd); upd(); bindEx();
      $("#liRun").addEventListener("click", () => { showLabResult(checkCmdi($("#li1").value), lab); });
    } else if (lab.type === "xss") {
      box.innerHTML = `<label class="field"><span>payload</span><input id="li1" placeholder="如 <script>alert(1)</script>" /></label>
        <div class="lab-actions"><button class="btn" id="liRun">提交并预览</button>${exampleBtn}</div>${liveBox}
        <div id="xssPrev" style="margin-top:10px"></div>`;
      const upd = () => { $("#labLive").textContent = "页面将回显 → " + $("#li1").value; };
      $("#li1").addEventListener("input", upd); upd(); bindEx();
      $("#liRun").addEventListener("click", () => {
        const payload = $("#li1").value;
        showLabResult(checkXss(payload), lab);
        const prev = $("#xssPrev"); prev.innerHTML = "";
        const ifr = document.createElement("iframe");
        ifr.className = "xss-sandbox"; ifr.setAttribute("sandbox", "allow-scripts");
        ifr.srcdoc = "<!doctype html><meta charset='utf-8'><body style='font-family:sans-serif;padding:10px'>" + payload + "</body>";
        prev.appendChild(ifr);
      });
    } else if (lab.type === "traversal") {
      box.innerHTML = `<label class="field"><span>文件名 filename</span><input id="li1" placeholder="如 ../../../../etc/passwd" /></label>
        <div class="lab-actions"><button class="btn" id="liRun">读取</button>${exampleBtn}</div>${liveBox}`;
      const upd = () => { $("#labLive").textContent = "实际读取 → /var/www/files/" + $("#li1").value; };
      $("#li1").addEventListener("input", upd); upd(); bindEx();
      $("#liRun").addEventListener("click", () => { showLabResult(checkTraversal($("#li1").value), lab); });
    } else if (lab.type === "nosql") {
      box.innerHTML = `<label class="field"><span>用户名 username（JSON/表达式）</span><input id="li1" placeholder='如 { "$ne": "" }' /></label>
        <div class="lab-actions"><button class="btn" id="liRun">登录</button>${exampleBtn}</div>${liveBox}`;
      const upd = () => { $("#labLive").textContent = "构造的查询 → db.users.find({ username: " + $("#li1").value + ", password: <输入> })"; };
      $("#li1").addEventListener("input", upd); upd(); bindEx();
      $("#liRun").addEventListener("click", () => { showLabResult(checkNosql($("#li1").value), lab); });
    } else if (lab.type === "ssti") {
      box.innerHTML = `<label class="field"><span>模板表达式 template</span><input id="li1" placeholder="如 {{7*7}}" /></label>
        <div class="lab-actions"><button class="btn" id="liRun">渲染</button>${exampleBtn}</div>${liveBox}`;
      const upd = () => { $("#labLive").textContent = "模板将被当作代码执行 → " + $("#li1").value; };
      $("#li1").addEventListener("input", upd); upd(); bindEx();
      $("#liRun").addEventListener("click", () => { showLabResult(checkSsti($("#li1").value), lab); });
    } else if (lab.type === "idor") {
      box.innerHTML = `<label class="field"><span>访问的用户 id</span><input id="li1" placeholder="如 1002" value="1001" /></label>
        <div class="lab-actions"><button class="btn" id="liRun">请求资料</button>${exampleBtn}</div>${liveBox}`;
      const upd = () => { $("#labLive").textContent = "请求 → GET /api/user/" + $("#li1").value + "/profile"; };
      $("#li1").addEventListener("input", upd); upd(); bindEx();
      $("#liRun").addEventListener("click", () => { showLabResult(checkIdor($("#li1").value), lab); });
    } else if (lab.type === "lfi") {
      box.innerHTML = `<label class="field"><span>page 参数</span><input id="li1" placeholder="如 ../../../../etc/passwd" /></label>
        <div class="lab-actions"><button class="btn" id="liRun">包含文件</button>${exampleBtn}</div>${liveBox}`;
      const upd = () => { $("#labLive").textContent = "将被包含 → " + $("#li1").value; };
      $("#li1").addEventListener("input", upd); upd(); bindEx();
      $("#liRun").addEventListener("click", () => { showLabResult(checkLfi($("#li1").value), lab); });
    } else if (lab.type === "decode") {
      box.innerHTML = `<label class="field"><span>密文</span><input id="li0" value="${escapeHtml(lab.ciphertext)}" readonly /></label>
        <label class="field"><span>你的答案</span><input id="li1" placeholder="在此输入解码结果" /></label>
        <div class="lab-actions"><button class="btn" id="liRun">提交</button></div>`;
      $("#liRun").addEventListener("click", () => {
        const ans = $("#li1").value.trim();
        const ok = ans.toLowerCase() === String(lab.answer).toLowerCase();
        showLabResult({ ok, query: "你的答案：" + ans, why: ok ? "✅ 解码正确！" : "❌ 还不对，再看看密文用的编码（Base64 / 凯撒 / 十六进制）。" }, lab);
      });
    } else if (lab.type === "quiz") {
      box.innerHTML = `<pre><code>${escapeHtml(lab.code)}</code></pre>
        <p><strong>${escapeHtml(lab.question)}</strong></p>
        <div id="quizOpts">${lab.options.map((o, i) => `<button class="btn ghost" data-i="${i}" style="display:block;width:100%;margin:6px 0;text-align:left">${i + 1}. ${escapeHtml(o)}</button>`).join("")}</div>`;
      $$("#quizOpts button").forEach((b) => b.addEventListener("click", () => {
        const i = parseInt(b.dataset.i, 10);
        const ok = i === lab.answer;
        showLabResult({ ok, query: "你选了：第 " + (i + 1) + " 项", why: ok ? "✅ 正确！" + lab.hints[0] : "❌ 不对，再想想哪一行不检查长度就拷贝数据。" }, lab);
      }));
    }
  }
  function showLabResult(r, lab) {
    const el = $("#labResult");
    el.classList.remove("hidden");
    el.className = "lab-result " + (r.ok ? "ok" : "fail");
    if (r.ok && !state.labsSolved.has(lab.id)) {
      state.labsSolved.add(lab.id);
      try { localStorage.setItem("sectutor_labs", JSON.stringify([...state.labsSolved])); } catch (e) {}
      logEvent("lab", lab.id);
      renderLabStats();
    }
    let extra = "";
    if (r.ok && state.labsSolved.has(lab.id)) {
      const total = SEC_DATA.labs.length, done = state.labsSolved.size;
      extra = `<div class="lab-score">🏆 你已攻克 <b>${done}</b> / ${total} 个靶场（完成度 ${Math.round(done / total * 100)}%）</div>`;
    }
    el.innerHTML = `<div class="lab-badge">${r.ok ? "✅ 挑战成功" : "❌ 未通过"}</div>
      ${r.query ? `<div class="lab-query"><strong>结果：</strong>${escapeHtml(r.query)}</div>` : ""}
      <div class="lab-why">${escapeHtml(r.why)}</div>${extra}`;
  }

  /* ---- 演练用的前端模拟判定 ---- */
  function checkSqli(u, p) {
    const query = "SELECT * FROM users WHERE username='" + u + "' AND password='" + p + "'";
    // 取最早出现的注释符位置（仅在确实找到时计入，避免 -1 干扰 Math.min）
    const idxDash = query.indexOf("--");
    const idxHash = query.indexOf("#");
    let ci = -1;
    if (idxDash >= 0) ci = idxDash;
    if (idxHash >= 0) ci = ci >= 0 ? Math.min(ci, idxHash) : idxHash;
    const commented = ci >= 0 ? query.slice(0, ci) : query;
    const orTrue = /\bor\s+'?1'?\s*=\s*'?1'?|\bor\s+1\s*=\s*1/i.test(query);
    const passCommented = ci >= 0 && /username='[^']*'\s*$/.test(commented.replace(/\s+/g, " "));
    if (orTrue || passCommented) {
      return {
        ok: true, query,
        why: orTrue
          ? "你注入的 OR '1'='1' 让 WHERE 条件恒为真，数据库返回所有用户行，登录被绕过。"
          : "你用注释符(-- 或 #)截断了密码校验，且 username 已被正确闭合，等于只用用户名即可登录。",
      };
    }
    return { ok: false, query, why: "查询未绕过：WHERE 仍要求正确的用户名和密码。试试 ' OR '1'='1' -- 或 admin' -- 这类经典 payload。" };
  }
  function checkCmdi(host) {
    const cmd = "ping -c1 " + host;
    const sep = /[;&|`$()\n]/.test(host);
    const afterCmd = /[;&|`$()]+\s*([a-z]{2,})/i.test(host);
    if (sep && afterCmd) {
      const injected = host.replace(/^[^;&|`$()]*[;&|`$()]+\s*/, "");
      return { ok: true, query: cmd, why: "分隔符让 shell 把 `" + injected + "` 当作独立命令执行——这就是命令注入。真实环境里这可能读出 /etc/passwd 或反弹 shell。" };
    }
    if (sep) return { ok: false, query: cmd, why: "检测到命令分隔符，但后面没有可执行的命令。再接一个命令试试，如 127.0.0.1; id。" };
    return { ok: false, query: cmd, why: "没有任何命令分隔符，输入被当作普通主机名。试试用 127.0.0.1; id 这类 payload。" };
  }
  function checkXss(payload) {
    const hit = /<script|<svg|<img|<iframe|<body|<a\s|on(load|error|click|mouseover|focus)=|javascript:/i.test(payload);
    if (hit) return { ok: true, why: "✅ 触发成功！这段内容被原样插入页面，脚本/事件处理器得以执行（预览在沙箱中隔离运行）。真实漏洞点就在于「输出未编码」。" };
    if (payload.trim() === "") return { ok: false, why: "请输入一段 payload。" };
    return { ok: false, why: "没检测到可执行的脚本模式。试试 <script>alert(1)</script> 或 <img src=x onerror=alert(1)>。" };
  }
  function checkTraversal(filename) {
    const base = "/var/www/files/";
    const real = base + filename;
    if (/\.\.(\/|\\)/.test(filename)) {
      return { ok: true, query: "实际路径：" + real,
        why: "你用 ../ 跳出了基目录 " + base + "，拼接后得到 '" + real + "'，可读取任意文件——这就是路径遍历（目录穿越）。防御：白名单文件名、用真实路径库函数规范化后校验前缀是否在基目录内。" };
    }
    if (filename.startsWith("/") || /(etc\/passwd|windows\\system32|boot\.ini)/i.test(filename)) {
      return { ok: true, query: "实际路径：" + real,
        why: "你直接指向了系统敏感路径，绕过了基目录限制——典型的路径遍历。防御：把用户输入当作「文件名」而非「路径」，规范化后校验前缀。" };
    }
    return { ok: false, query: "实际路径：" + real, why: "没有目录跳出序列（../）或绝对路径，输入被限制在 " + base + " 内，未越权。试试用 ../../../../etc/passwd。" };
  }
  function checkNosql(u) {
    const query = "db.users.find({ username: " + u + ", password: <输入> })";
    const orTrue = /\|\|/.test(u) || /[$](ne|gt|gte|lt|lte|regex|exists|in)/.test(u);
    if (orTrue) {
      return { ok: true, query,
        why: "你传入的运算符（如 $ne / ||）让查询条件恒真或匹配到 admin，绕过密码校验——这就是 NoSQL 注入。防御：用严格类型，拒绝用户传入以 $ 开头的字段名或对象字面量。" };
    }
    return { ok: false, query, why: "没检测到 NoSQL 运算符（如 $ne、||）。试试用户名填 { \"$ne\": \"\" } 或 ' || '1'=='1。" };
  }
  function checkSsti(tpl) {
    const v = (tpl || "").trim();
    if (v === "") return { ok: false, why: "请输入一段模板表达式。" };
    // 经典算术探针：{{a*b}} / ${a*b}，服务端执行表达式
    const arith = v.match(/\{\{\s*(\d+)\s*([\*\/+\-])\s*(\d+)\s*\}\}/) || v.match(/\$\{\s*(\d+)\s*([\*\/+\-])\s*(\d+)\s*\}/);
    if (arith) {
      const a = +arith[1], b = +arith[3], op = arith[2];
      const res = op === "*" ? a * b : op === "/" ? a / b : op === "+" ? a + b : a - b;
      return { ok: true, query: "服务端执行 " + arith[0] + " → 结果 " + res,
        why: "服务端把用户输入当作模板源码解析并执行了表达式，返回了 " + res + "。这说明存在 SSTI——攻击者还能读取 config、读文件乃至 RCE。防御：模板必须固定，用户输入只作为变量传参，绝不拼接进模板字符串。" };
    }
    // 其他常见 SSTI 语法标记
    if (/\{\{|\}\}|\$\{|\{%.*%\}|\{\{config|\{\{self|os\.system|__import__|cycler|namespace|request\.(application|config)/.test(v)) {
      return { ok: true, query: "检测到模板语法：" + v,
        why: "你输入的模板语法（如 {{...}} / {% %}）会被服务端按模板引擎解析执行——这就是 SSTI 漏洞点。真实环境里可借此读取环境变量、源码乃至执行命令。防御：固定模板 + 参数传参，禁用用户控制模板源码。" };
    }
    return { ok: false, why: "没检测到模板表达式语法（如 {{7*7}} 或 ${7*7}）。试试 {{7*7}}，若返回 49 即证明表达式被执行。" };
  }
  function checkIdor(id) {
    const myId = "1001";
    const v = (id || "").trim();
    if (v === "") return { ok: false, why: "请输入要访问的 id。" };
    if (/^admin$/i.test(v) || v === "1000") {
      return { ok: true, query: "GET /api/user/" + v + "/profile → 返回了管理员资料",
        why: "你把 id 改成了高权限账户（admin / 1000）并成功读到了它的资料——这就是水平/垂直越权（IDOR）。根因：服务端只信任客户端传入的 id，没有校验「当前登录用户是否有权访问该资源」。防御：服务端按 current_user 校验归属（owner == current_user）。" };
    }
    if (/^\d+$/.test(v) && v !== myId) {
      return { ok: true, query: "GET /api/user/" + v + "/profile → 返回了用户 " + v + " 的资料",
        why: "你把自己的 id（1001）改成 " + v + " 就直接读到了别人的资料——典型的 IDOR 越权。防御：服务端必须校验资源归属，绝不能信任客户端传来的 id。" };
    }
    if (v === myId) {
      return { ok: false, query: "GET /api/user/" + v + "/profile → 返回了你自己的资料",
        why: "你访问的是自己的 id（1001），这是正常行为，没有越权。试着改成别人的编号（如 1002）或 admin 来演示越权。" };
    }
    return { ok: false, query: "GET /api/user/" + v + "/profile",
      why: "这个 id 无法解析为可访问的用户。试试改成别人的编号（如 1002）或 admin。" };
  }
  function checkLfi(page) {
    const v = (page || "").trim();
    if (v === "") return { ok: false, why: "请输入 page 参数值。" };
    if (/\.\.(\/|\\)/.test(v)) {
      return { ok: true, query: "将被包含：" + v,
        why: "你用 ../ 跳出 Web 目录并指向了系统文件——这就是本地文件包含（LFI）/ 路径遍历。真实环境下可读取 /etc/passwd、配置文件甚至配合日志注入拿 shell。防御：文件名白名单 + 禁止 PHP 包装器 + 关闭 allow_url_include。" };
    }
    if (/^(php|file|expect|data|phar):\/\//i.test(v)) {
      return { ok: true, query: "将被包含：" + v,
        why: "你使用了 PHP/文件包装器（如 php://filter 读源码、data:// 执行），绕过了普通文件名限制——这是 LFI 进阶利用。防御：禁用危险包装器，参数只允许白名单内的文件名。" };
    }
    if (/^(\/|[a-zA-Z]:\\)/.test(v) || /(etc\/passwd|boot\.ini|win\.ini)/i.test(v)) {
      return { ok: true, query: "将被包含：" + v,
        why: "你直接传入了绝对路径或敏感文件名，绕过了基于「页面名」的预期——典型的 LFI。防御：把输入当作受限文件名，规范化后校验前缀。" };
    }
    return { ok: false, query: "将被包含：" + v, why: "没有目录跳出（../）、包装器或绝对路径，输入被当作普通页面名，未越权。试试用 ../../../../etc/passwd 或 php://filter/convert.base64-encode/resource=config。" };
  }

  /* ---- 靶场分段切换 ---- */
  $$("#panel-range .seg-btn").forEach((b) => b.addEventListener("click", () => {
    $$("#panel-range .seg-btn").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    const mode = b.dataset.mode;
    $("#solutionsView").classList.toggle("hidden", mode !== "solutions");
    $("#labsView").classList.toggle("hidden", mode !== "labs");
    if (mode === "labs") renderLabStats();
  }));

  /* ============================================================
     安全资讯 & 工具
     ============================================================ */
  function renderNews() {
    const list = $("#newsList");
    list.innerHTML = SEC_DATA.news.map((n) => `
      <div class="news-card" data-id="${escapeHtml(n.id)}">
        <span class="tag">${escapeHtml(n.cve)}</span>
        <h3>${escapeHtml(n.title)}</h3>
        <div class="date">${escapeHtml(n.date)} ｜ ${catById(n.cat).name}</div>
        <p>${escapeHtml(n.summary)}</p>
        <p style="color:var(--accent)"><strong>🛡 防御：</strong>${escapeHtml(n.defense)}</p>
        <div class="ai-helpers"><button class="btn ghost small news-ai-btn" data-id="${escapeHtml(n.id)}">🤖 AI 辅助（解读/关联/加固）</button></div>
      </div>`).join("");
    list.querySelectorAll(".news-ai-btn").forEach((b) => {
      if (b.dataset.bound) return; b.dataset.bound = "1";
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        const nw = SEC_DATA.news.find((x) => x.id === b.dataset.id);
        if (nw) aiAssistForNews(nw);
      });
    });
    list.querySelectorAll(".news-card").forEach((c) => {
      if (c.dataset.boundCard) return; c.dataset.boundCard = "1";
      c.addEventListener("click", () => showNews(c.dataset.id));
    });
  }

  function showNews(id) {
    const n = (SEC_DATA.news || []).find((x) => x.id === id);
    if (!n) { activateTab("news"); return; }
    const catName = catById(n.cat).name;
    const body = `
      <div class="news-detail">
        ${n.cve ? `<div class="tag" style="display:inline-block;margin-bottom:8px">${escapeHtml(n.cve)}</div>` : ""}
        <h2 style="margin:0 0 6px">${escapeHtml(n.title)}</h2>
        <div class="date" style="margin-bottom:12px">${escapeHtml(n.date)} ｜ ${escapeHtml(catName)}</div>
        <p style="line-height:1.7">${escapeHtml(n.summary)}</p>
        <p style="line-height:1.7"><strong style="color:var(--accent)">🛡 防御建议：</strong>${escapeHtml(n.defense)}</p>
        <button class="btn" id="newsDetailAi" style="margin-top:8px">🤖 AI 辅助（解读/关联/加固）</button>
      </div>`;
    openModal("安全资讯 · " + escapeHtml(catName), body);
    const aiBtn = $("#newsDetailAi");
    if (aiBtn) aiBtn.addEventListener("click", () => { closeModal(); aiAssistForNews(n); });
  }

  let toolActiveCat = "all";
  function renderToolCats() {
    const ul = $("#toolList");
    ul.innerHTML = "";
    const mk = (id, name) => {
      const li = document.createElement("li");
      li.className = id === toolActiveCat ? "active" : "";
      const cnt = id === "all" ? SEC_DATA.tools.length : SEC_DATA.tools.filter((t) => t.cat === id).length;
      li.innerHTML = `<span>${name}</span><span class="count">${cnt}</span>`;
      li.addEventListener("click", () => { toolActiveCat = id; renderToolCats(); renderTools(); });
      ul.appendChild(li);
    };
    mk("all", "全部"); CATS.forEach((c) => mk(c.id, c.icon + " " + c.name));
  }
  function renderTools() {
    const main = $("#toolDetail");
    const items = SEC_DATA.tools.filter((t) => toolActiveCat === "all" || t.cat === toolActiveCat);
    main.innerHTML = items.map((t) => `
      <div class="tool-row" style="display:block;border:none;padding:0;margin-bottom:18px">
        <h3 style="text-transform:none;letter-spacing:0;color:var(--ink);margin-bottom:4px">${escapeHtml(t.name)} <span style="font-size:12px;color:var(--muted)">（${catById(t.cat).name}）</span></h3>
        <p>${escapeHtml(t.desc)}</p>
        <p><strong>用法：</strong>${escapeHtml(t.usage)}</p>
        <pre><code>${escapeHtml(t.example)}</code></pre>
        <p style="color:var(--warn)"><strong>⚠ 合规提示：</strong>${escapeHtml(t.note)}</p>
        <div class="ai-helpers">
          <button class="btn ghost small tool-ai-btn" data-tool="${escapeAttr(t.id)}">🤖 AI 辅助</button>
        </div>
      </div>`).join("");
    $$(".tool-ai-btn").forEach((btn) => {
      const t = SEC_DATA.tools.find((x) => x.id === btn.getAttribute("data-tool"));
      if (t) btn.addEventListener("click", () => aiAssistForTool(t));
    });
  }

  /* ============================================================
     初始化
     ============================================================ */
  function welcome() {
    addMsg("bot",
      `👋 你好，我是 <strong>SecTutor</strong>，你的网络安全学习伙伴。<br>
       当前难度档位：<strong>${state.userLevel}</strong>。你可以直接提问，例如「SQL 注入怎么防御？」「栈溢出原理」。<br>
       所有内容<strong>仅用于合法授权的安全学习与防御研究</strong>。想换难度可在左侧调整，想系统学习可去「学习计划」生成专属路线。
       也可以点击下方领域直接进入对应知识库 👇` +
      suggestionButtons(CATS.map((c) => ({ name: c.name, cat: c.id }))));
  }
  function loadChat() {
    let saved = null;
    try { saved = localStorage.getItem(CHAT_KEY); } catch (e) {}
    if (saved && saved.trim()) {
      const log = $("#chatLog");
      log.innerHTML = saved;
      $$(".typing-row").forEach((t) => t.remove());   // 清除可能残留的打字动画
      bindSuggestions();
      return true;
    }
    return false;
  }
  function clearChat() {
    try { localStorage.removeItem(CHAT_KEY); } catch (e) {}
    clearDraft();
    $("#chatLog").innerHTML = "";
    welcome();
    bindSuggestions();
    toast("对话记录已清空", "info");
  }
  // 导出对话：把当前聊天记录下载为 .txt（本地优先，不联网）
  function exportChat() {
    const log = $("#chatLog"); if (!log) return;
    const text = log.innerText || log.textContent || "";
    if (!text.trim()) { openModal("提示", "<p>当前没有对话内容可导出。</p>"); return; }
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const filename = "sectutor-chat-" + stamp + ".txt";
    try {
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch (e) {
      // 受环境限制无法下载时，退化为复制到剪贴板
      try { if (navigator.clipboard) navigator.clipboard.writeText(text); } catch (_) {}
      openModal("已复制", "<p>当前环境不支持直接下载，对话内容已尝试复制到剪贴板，可粘贴到记事本保存。</p>");
    }
  }

  /* ============================================================
     随机自测（quiz）
     ============================================================ */
  let quizState = null;
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  // 每题随机打乱选项顺序，并同步重映射 answer 下标，避免"正确答案总在同一位置"
  function shuffleOptions(q) {
    const idx = q.options.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = idx[i]; idx[i] = idx[j]; idx[j] = t;
    }
    return {
      id: q.id, cat: q.cat, level: q.level, q: q.q, explain: q.explain,
      options: idx.map((i) => q.options[i]),
      answer: idx.indexOf(q.answer)
    };
  }
  // —— 选项长度均衡：根治「只要选最长的就一定正确」——
  // 题库里正确答案多为较长的事实性陈述、干扰项为简短错误说法，导致 97% 的题
  // 「正确答案 = 最长选项」。这里基于题 id 确定性地选一个「故意最长项」k（含
  // 1/选项数 概率正是正确答案），用中性后缀把它补长、把过短干扰项补到同量级，
  // 使「最长选项 == 正确答案」的概率降到约 1/选项数（≈25%），从而长度不再能 cheat。
  // 后缀保持中性、不暗示对错、不泄题；answer 下标不变，判分不受影响。
  const NEUTRAL_SUFFIX = [
    "（需结合业务场景综合判断）",
    "（应纳入整体纵深防御体系）",
    "（其落地效果取决于具体配置）",
    "（常需与其它控制手段配合）",
    "（在实践中仍需持续验证）",
    "（需权衡可用性与安全性）",
    "（应参考最新安全基线要求）",
    "（具体选型需评估威胁模型）"
  ];
  function hashStr(s) {
    let h = 2166136261 >>> 0; s = String(s);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function pickSuffix(seed) { return NEUTRAL_SUFFIX[seed % NEUTRAL_SUFFIX.length]; }
  function balanceOptions(q) {
    if (!q || !Array.isArray(q.options) || q.options.length < 2) return q;
    const opts = q.options.slice();
    const ans = q.answer;
    const lens = opts.map((o) => o.length);
    const ansLen = lens[ans] || 0;
    const n = opts.length;
    const k = hashStr(q.id || q.q || "") % n; // 决定哪一选项成为「故意最长」
    const baseMax = Math.max(ansLen, ...lens);
    const target = baseMax + 14; // 故意最长项至少比原始最长多一个后缀长度，确保严格唯一最长
    let s = opts[k], seed = hashStr(s) + k;
    while (s.length < target) {
      const suf = pickSuffix(seed);
      if (s.indexOf(suf) >= 0) break;
      s += suf; seed = hashStr(s) + k;
    }
    opts[k] = s;
    for (let i = 0; i < n; i++) {
      // 过短干扰项补到同量级（上限明显低于 target，避免与故意最长项并列）
      if (i !== k && i !== ans && opts[i].length < ansLen * 0.7) {
        let t = opts[i], sd = hashStr(t) + i;
        while (t.length < ansLen * 0.72) {
          const suf = pickSuffix(sd);
          if (t.indexOf(suf) >= 0) break;
          t += suf; sd = hashStr(t) + i;
        }
        opts[i] = t;
      }
    }
    // 兜底：在「补其它项」之后计算第二大长度，确保 k 项严格唯一最长
    let secondMax = 0;
    for (let i = 0; i < n; i++) if (i !== k) secondMax = Math.max(secondMax, opts[i].length);
    let gi = 0;
    while (opts[k].length <= secondMax) { opts[k] += NEUTRAL_SUFFIX[gi % NEUTRAL_SUFFIX.length]; gi++; }
    return Object.assign({}, q, { options: opts, answer: ans });
  }
  // 先均衡长度、再打乱位置：所有自测入口统一走这里
  function prepareQuestion(q) { return shuffleOptions(balanceOptions(q)); }
  function startQuiz() {
    const n = parseInt($("#quizCount").value, 10) || 8;
    const cat = $("#quizCat").value;
    let pool = SEC_DATA.quizzes;
    if (cat !== "all") pool = pool.filter((q) => q.cat === cat);
    const items = shuffle(pool).slice(0, Math.min(n, pool.length)).map(prepareQuestion);
    quizState = { items, idx: 0, score: 0, answered: new Set(), picked: -1 };
    $("#quizRestart").classList.remove("hidden");
    renderQuiz();
  }
  // 仅供自测：暴露选项打乱函数，便于回归校验 answer 重映射正确
  if (typeof window !== "undefined") {
    window.__shuffleOptions = shuffleOptions;
    window.__balanceOptions = balanceOptions;
    window.__prepareQuestion = prepareQuestion;
    // 性能基准 / 检索质量回归：暴露检索相关纯函数
    window.__perf = {
      retrieve: retrieve,
      relatedDocs: relatedDocs,
      allTopics: allTopics,
      matchSearch: matchSearch,
      tokenize: tokenize,
      detectIntent: detectIntent,
      corpusSize: function () { return CORPUS.length; },
    };
  }
  // 交互反馈层自测钩子
  if (typeof window !== "undefined") {
    window.__ui = {
      toast: toast,
      closeToast: closeToast,
      withPending: withPending,
      showSkeleton: showSkeleton,
      hotkeyHelp: openHotkeyHelp,
      // P2 状态安全
      savePanelScroll: savePanelScroll,
      restorePanelScroll: restorePanelScroll,
      snapshotMastery: snapshotMastery,
      restoreMastery: restoreMastery,
      resetMasteryUndoable: resetMasteryUndoable,
      saveDraft: saveDraft,
      clearDraft: clearDraft,
      restoreDraft: restoreDraft,
      DRAFT_KEY: DRAFT_KEY,
    };
  }
  // 统一的「上下文带入智能问答」入口：离线可用（未配 LLM 时走内置知识引擎兜底），配置了外部 LLM 时做更深推理。
  function aiAssistToChat(prompt) {
    activateTab("chat");
    const inp = $("#chatInput");
    if (inp) inp.value = prompt;
    if (typeof send === "function") send();
    // 反馈闭环：原先静默跳转，用户不确定是否已带入（尤其在非问答页触发时）
    toast("已带入智能问答，正在生成解答", "info");
  }
  // 高级/CTF 题目 AI 辅助：把当前题带入智能问答，要求 AI 渐进式提示 + 利用链分析（不直接给答案）
  // 复用现有 RAG / 外接 LLM 体系；未配置外部模型时由内置知识引擎尽力辅助。
  function aiAssistForQuiz(q) {
    const catName = catById(q.cat).name;
    const optLines = q.options.map((o, i) => (i + 1) + ". " + o).join("；");
    const prompt =
      "[SecTutor CTF 辅助 · 难度：" + q.level + " · 领域：" + catName + "]\n" +
      "题目：" + q.q + "\n选项：" + optLines + "\n\n" +
      "请按以下方式辅助我解题（先不要直接告诉我正确选项）：\n" +
      "1) 先给 1-2 条【思路提示】，不直接暴露答案；\n" +
      "2) 指出解题所需的【知识点 / 工具 / 技术】；\n" +
      "3) 若涉及漏洞利用，给出【利用链 / 攻击路径】的分步分析；\n" +
      "4) 等我进一步追问后再逐步深入，最后再点明答案与原理。\n" +
      "请优先结合内置知识库作答；若已配置外部大模型，可做更深入的推理。";
    aiAssistToChat(prompt);
  }
  // 实战靶场 · 题解库（range writeup）AI 辅助
  function aiAssistForRange(r) {
    const catName = catById(r.cat).name;
    const steps = (r.steps || []).map((s, i) => (i + 1) + ") " + s).join("；");
    const prompt =
      "[SecTutor 靶场题解辅助 · 难度：" + r.level + " · 领域：" + catName + "]\n" +
      "靶标/题目：" + r.title + "\n" +
      "实验环境：" + (r.setup || "") + "\n" +
      "解题思路：" + (r.writeup || "") + "\n" +
      "推荐步骤：" + steps + "\n" +
      "防御与修复：" + (r.defense || "") + "\n\n" +
      "请按以下方式辅助我（先不直接给完整答案与前因后果）：\n" +
      "1) 用更通俗的话讲清这道题的【核心漏洞原理】；\n" +
      "2) 指出解题所需的【知识点 / 工具 / 技术】；\n" +
      "3) 给出【利用链 / 攻击路径】的分步推演，并指出哪一步最容易踩坑；\n" +
      "4) 解释【防御与修复】为什么有效；\n" +
      "5) 等我进一步追问后再逐步深入。\n" +
      "请优先结合内置知识库作答；若已配置外部大模型，可做更深入的推理。";
    aiAssistToChat(prompt);
  }
  // 实战靶场 · 在线演练（lab）AI 辅助
  function aiAssistForLab(lab) {
    const catName = catById(lab.cat).name;
    const topic = lab.topic ? topicName(lab.topic) : "（无）";
    const hints = (lab.hints || []).join("；");
    const prompt =
      "[SecTutor 在线演练辅助 · 难度：" + lab.level + " · 领域：" + catName + "]\n" +
      "靶场：" + lab.title + "\n" +
      "背景：" + (lab.brief || "") + "\n" +
      "任务：" + (lab.task || "") + "\n" +
      "相关知识点：" + topic + "\n" +
      "内置提示：" + hints + "\n\n" +
      "请按以下方式辅助我完成本演练（先不直接给 flag / 答案）：\n" +
      "1) 先给 1-2 条【思路提示】；\n" +
      "2) 指出需要的【工具 / payload 构造方法 / 技术】；\n" +
      "3) 给出【利用链 / 验证路径】的分步分析；\n" +
      "4) 等我逐步尝试后再深入，最后点明原理与修复。\n" +
      "请优先结合内置知识库作答；若已配置外部大模型，可做更深入的推理。";
    aiAssistToChat(prompt);
  }
  // 工具与代码（tool）AI 辅助
  function aiAssistForTool(t) {
    const catName = catById(t.cat).name;
    const prompt =
      "[SecTutor 工具与代码辅助 · 领域：" + catName + "]\n" +
      "工具：" + t.name + "\n" +
      "简介：" + (t.desc || "") + "\n" +
      "用法：" + (t.usage || "") + "\n" +
      "示例：\n" + (t.example || "") + "\n\n" +
      "请按以下方式辅助我（先不直接改写结果，等我追问）：\n" +
      "1) 解释该工具的【核心用途与适用场景】；\n" +
      "2) 拆解【关键参数 / 选项】的含义与常见组合；\n" +
      "3) 如需自动化，给出【可运行脚本 / 流水线】的思路（仅限授权环境）；\n" +
      "4) 指出【合规边界】与防御视角；\n" +
      "5) 等我进一步追问后再深入。\n" +
      "请优先结合内置知识库作答；若已配置外部大模型，可做更深入的推理。";
    aiAssistToChat(prompt);
  }
  // 知识体系（topic）AI 辅助
  function aiAssistForTopic(topic) {
    const catName = catById(topic.cat).name;
    const lvl = state.userLevel;
    const body = (topic.levels[lvl] || topic.levels["入门"]) || "";
    const kw = (topic.keywords || []).join("、");
    const prompt =
      "[SecTutor 知识点辅助 · 当前档位：" + lvl + " · 领域：" + catName + "]\n" +
      "知识点：" + topic.name + "（难度：" + topic.level + "）\n" +
      "简介：" + (topic.summary || "") + "\n" +
      "关键词：" + kw + "\n" +
      "当前讲解内容：\n" + body + "\n" +
      "代码示例：\n" + (topic.code || "") + "\n" +
      "推荐工具：" + (topic.tool || "") + "\n\n" +
      "请按以下方式辅助我学习（先不直接考我，等我追问）：\n" +
      "1) 用更生活化 / 类比的方式讲解【核心原理】，扫清理解障碍；\n" +
      "2) 指出该知识点关联的【前置 / 后续概念】，帮我建立知识网络；\n" +
      "3) 基于该知识点出 1-2 道【自测小题】（先给题，不直接给答案），检验我是否真的懂；\n" +
      "4) 给出进一步深入的【学习路径 / 实操建议】；\n" +
      "5) 等我逐步追问后再展开细节。\n" +
      "请优先结合内置知识库作答；若已配置外部大模型，可做更深入的推理。";
    aiAssistToChat(prompt);
  }
  // 安全资讯（news）AI 辅助
  function aiAssistForNews(n) {
    const catName = catById(n.cat).name;
    const prompt =
      "[SecTutor 安全资讯辅助 · 领域：" + catName + "]\n" +
      "标题：" + n.title + "\n" +
      "编号：" + (n.cve || "") + "\n" +
      "日期：" + (n.date || "") + "\n" +
      "摘要：" + (n.summary || "") + "\n" +
      "防御建议：" + (n.defense || "") + "\n\n" +
      "请按以下方式辅助我解读这条资讯（先不堆术语，等我追问）：\n" +
      "1) 用通俗语言讲清【发生了什么 / 漏洞本质】；\n" +
      "2) 说明【影响范围 / 危害 / 现实风险】；\n" +
      "3) 关联我在知识体系里可能已学的【相关知识点】，帮我把它串进知识网络；\n" +
      "4) 把【防御建议】翻译成可执行的【自查 / 加固清单】；\n" +
      "5) 等我进一步追问后再深入。\n" +
      "请优先结合内置知识库作答；若已配置外部大模型，可做更深入的推理。";
    aiAssistToChat(prompt);
  }
  function renderQuiz() {
    const main = $("#quizMain");
    const st = quizState;
    if (!st || st.idx >= st.items.length) { renderQuizResult(); return; }
    const q = st.items[st.idx];
    const answered = st.answered.has(st.idx);
    const opts = q.options.map((o, i) => {
      let cls = "quiz-opt";
      if (answered) {
        if (i === q.answer) cls += " correct";
        else if (i === st.picked && i !== q.answer) cls += " wrong";
      }
      return `<button class="${cls}" data-i="${i}" ${answered ? "disabled" : ""}>${i + 1}. ${escapeHtml(o)}</button>`;
    }).join("");
    main.innerHTML = `
      <div class="quiz-progress">第 ${st.idx + 1} / ${st.items.length} 题 ｜ 已答对 ${st.score}</div>
      <div class="quiz-card">
        <div class="quiz-cat">${catById(q.cat).name} · ${q.level}</div>
        <h3 class="quiz-q">${escapeHtml(q.q)}</h3>
      <div class="quiz-opts">${opts}</div>
      <div class="quiz-helpers">
        ${q.hint ? `<button class="btn ghost small" id="quizHintBtn">💡 提示</button>` : ""}
        <button class="btn ghost small" id="quizAiBtn">🤖 AI 辅助</button>
      </div>
      <div class="quiz-hint hidden" id="quizHint"></div>
      <div class="quiz-feedback hidden" id="quizFeedback"></div>
      ${answered ? "" : `<button class="btn" id="quizSubmit">提交答案</button>`}
      </div>`;
    if (answered) {
      const fb = $("#quizFeedback");
      fb.classList.remove("hidden");
      const correct = st.picked === q.answer;
      fb.className = "quiz-feedback " + (correct ? "ok" : "fail");
      fb.innerHTML = `<b>${correct ? "✅ 回答正确" : "❌ 回答错误"}</b><p>${escapeHtml(q.explain)}</p>
        <button class="btn small" id="quizNext">${st.idx + 1 >= st.items.length ? "查看成绩" : "下一题 →"}</button>`;
      $("#quizNext").addEventListener("click", () => { st.idx++; renderQuiz(); });
    } else {
      let picked = -1;
      $$("#quizMain .quiz-opt").forEach((b) => b.addEventListener("click", () => {
        $$("#quizMain .quiz-opt").forEach((x) => x.classList.remove("sel"));
        b.classList.add("sel");
        picked = parseInt(b.dataset.i, 10);
      }));
      $("#quizSubmit").addEventListener("click", () => {
        if (picked < 0) { $("#quizSubmit").textContent = "请先选择一个选项"; return; }
        st.picked = picked;
        st.answered.add(st.idx);
        if (picked === q.answer) st.score++;
        renderQuiz();
      });
    }
    // 辅助按钮：离线提示 + AI 辅助（带入题目上下文）
    const hintBtn = $("#quizHintBtn");
    if (hintBtn) hintBtn.addEventListener("click", () => {
      const hb = $("#quizHint");
      if (hb) { hb.classList.remove("hidden"); hb.textContent = "💡 提示：" + q.hint; }
      hintBtn.disabled = true;
    });
    const aiBtn = $("#quizAiBtn");
    if (aiBtn) aiBtn.addEventListener("click", () => aiAssistForQuiz(q));
  }
  function renderQuizResult() {
    const st = quizState;
    const total = st.items.length;
    const main = $("#quizMain");
    const pct = total ? Math.round((st.score / total) * 100) : 0;
    main.innerHTML = `
      <div class="quiz-result">
        <h3>🎉 自测完成</h3>
        <div class="quiz-score-big">${st.score} / ${total}（${pct}%）</div>
        <p style="color:var(--muted)">${pct >= 80 ? "掌握得很扎实！" : pct >= 60 ? "基础不错，薄弱环节再回到「知识体系」复习对应知识点。" : "建议回到「知识体系」重点复习标红领域。"}</p>
        <button class="btn" id="quizAgain">再来一组</button>
      </div>`;
    $("#quizAgain").addEventListener("click", startQuiz);
    const score = $("#quizScore");
    score.classList.remove("hidden");
    score.textContent = `最近成绩：${st.score}/${total}`;
  }
  const quizStartBtn = $("#quizStart");
  if (quizStartBtn && !quizStartBtn.dataset.bound) { quizStartBtn.dataset.bound = "1"; quizStartBtn.addEventListener("click", startQuiz); }
  const quizRestartBtn = $("#quizRestart");
  if (quizRestartBtn && !quizRestartBtn.dataset.bound) { quizRestartBtn.dataset.bound = "1"; quizRestartBtn.addEventListener("click", startQuiz); }

  /* ---------- 开启界面（Splash）：表面展示 logo 风格，后台预加载功能 ---------- */
  const SPLASH_STEPS = [
    () => `加载知识库（${CATS.length} 大领域 / ${allTopics().length} 知识点）`,
    () => "恢复学习进度与个性化设置",
    () => "渲染学习界面组件",
    () => "预热安全工具与靶场数据",
    () => "检测本地后端服务",
  ];
  let splashTimer = null;
  function startSplash() {
    const box = $("#spSteps");
    const bar = $("#spBar");
    const splash = $("#splash");
    if (!splash || !box) return;
    box.innerHTML = "";
    SPLASH_STEPS.forEach((fn) => {
      const el = document.createElement("span");
      el.className = "st"; el.textContent = fn();
      box.appendChild(el);
    });
    const items = box.querySelectorAll(".st");
    let i = 0;
    const tick = () => {
      if (i > 0) { items[i - 1].classList.add("ok"); items[i - 1].classList.remove("on"); }
      if (i < items.length) {
        items[i].classList.add("on");
        if (bar) bar.style.width = Math.round(((i + 1) / items.length) * 100) + "%";
        i++;
        splashTimer = setTimeout(tick, 140);
      } else if (bar) {
        bar.style.width = "100%";
      }
    };
    tick();
  }
  function finishSplash() {
    const splash = $("#splash");
    if (!splash || splash.classList.contains("done")) return;
    if (splashTimer) { clearTimeout(splashTimer); splashTimer = null; }
    // 等步骤动画播完（约 5×140ms）再淡出，保持开启界面观感
    setTimeout(() => {
      splash.classList.add("done");
      setTimeout(() => { splash.style.display = "none"; }, 480);
    }, 80);
  }

  function init() {
    startSplash();
    applyTheme(localStorage.getItem("sectutor_theme") || "dark");
    applyLang(localStorage.getItem("sectutor_lang") || "zh");
    updateBadge();
    renderCatList();
    renderTopicGrid();
    renderQuick();
    renderRangeCats();
    renderRangeList();
    renderNews();
    renderToolCats();
    renderTools();
    renderLabCats();
    renderLabList();
    renderProgress();
    renderAgentCenter();   // 方向① 学习中心（能力画像 / 复习 / 周报）
    renderToolbox();       // 方向⑩ 本地工具箱
    restoreDraft();        // P2：恢复上次未发送的输入草稿
    if (!loadChat()) welcome();
    bindSuggestions();
    const bu = $("#backendUrl"); if (bu) bu.value = state.backend.url;
    const bt = $("#backendToken"); if (bt) bt.value = state.backend.token;

    // 预填现有大模型配置到内联面板；并绑定「API 接入中心」按钮（方向⑩）
    const lb = $("#llmBase"); if (lb) lb.value = (state.llm && state.llm.base) || "";
    const lk = $("#llmKey"); if (lk) lk.value = (state.llm && state.llm.key) || "";
    const lm = $("#llmModel"); if (lm) lm.value = (state.llm && state.llm.model) || "";
    const apiBtn = $("#apiHubBtn");
    if (apiBtn && !apiBtn.dataset.bound) { apiBtn.dataset.bound = "1"; apiBtn.addEventListener("click", openApiHub); }

    // 后端一键启停：双模式
    //  - 桌面壳（Electron，window.sectutor 存在）：通过 IPC 直接让主进程启停内嵌后端，点一下即成，无需协议 / 管理员 / launcher。
    //  - 普通网页（file:// 或 localhost）：仍走本地常驻 launcher (http://127.0.0.1:8799)。
    const startBtn = $("#startBackend");
    const stopBtn = $("#stopBackend");
    const LAUNCHER = "http://127.0.0.1:8799";
    const isElectron = !!(window.sectutor && window.sectutor.start);

    // 桌面壳：后端随应用自动内嵌启动，前端页面正是由该后端同源托管；
    // 手动「停止后端」会让同源页面服务失活，故隐藏启停按钮，仅展示状态。
    if (isElectron) {
      if (startBtn) startBtn.style.display = "none";
      if (stopBtn) stopBtn.style.display = "none";
      const el = $("#backendStatus");
      if (el) { el.textContent = "✅ 后端已随应用自动运行（无需手动启停）"; el.className = "backend-status ok"; }
    } else {
      // 错误不再在此吞掉，交给调用处统一处理（便于给出明确的成功/失败通知）
      function startBackend() {
        return fetch(LAUNCHER + "/start", { mode: "cors", cache: "no-store" }).then((r) => r.json());
      }
      function stopBackend() {
        return fetch(LAUNCHER + "/stop", { mode: "cors", cache: "no-store" }).then((r) => r.json());
      }
      if (startBtn) startBtn.addEventListener("click", () => {
        const restore = withPending(startBtn, curLang() === "en" ? "Starting\u2026" : "\u542f\u52a8\u4e2d\u2026");
        startBackend()
          .then((d) => {
            if (d && d.ok === false) toast("\u540e\u7aef\u542f\u52a8\u5931\u8d25\uff1a" + ((d && d.error) || "\u672a\u77e5\u539f\u56e0"), "err");
            else toast("\u540e\u7aef\u542f\u52a8\u6307\u4ee4\u5df2\u53d1\u9001\uff0c\u6b63\u5728\u7b49\u5f85\u5c31\u7eea\u2026", "info");
          })
          .catch(() => { showLauncherFallback(); toast("\u65e0\u6cd5\u8fde\u63a5\u542f\u52a8\u5668\uff0c\u8bf7\u5148\u8fd0\u884c SecTutor.bat", "err"); })
          .finally(() => { restore(); setTimeout(checkBackend, 4000); });
      });
      if (stopBtn) stopBtn.addEventListener("click", () => {
        const restore = withPending(stopBtn, "\u505c\u6b62\u4e2d\u2026");
        stopBackend()
          .then((d) => {
            if (d && d.ok === false) toast("\u540e\u7aef\u505c\u6b62\u5931\u8d25\uff1a" + ((d && d.error) || "\u672a\u77e5\u539f\u56e0"), "err");
            else toast("\u540e\u7aef\u5df2\u505c\u6b62", "info");
          })
          .catch(() => { showLauncherFallback(); toast("\u65e0\u6cd5\u8fde\u63a5\u542f\u52a8\u5668\uff0c\u53ef\u80fd\u540e\u7aef\u5df2\u7ecf\u672a\u8fd0\u884c", "err"); })
          .finally(() => { restore(); setTimeout(checkBackend, 3000); });
      });

      // 探测后端状态
      function setBackendStatus(el, up, base) {
        if (up) { el.textContent = "后端状态：🟢 运行中（" + base + "）"; el.className = "backend-status ok"; }
        else { el.textContent = "后端状态：🔴 未运行（可点「启动后端」）"; el.className = "backend-status off"; }
      }
      function tryHealth(el) {
        const base = (state.backend && state.backend.url ? state.backend.url : "http://127.0.0.1:8787").replace(/\/+$/, "");
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 2000);
        fetch(base + "/health", { signal: ctrl.signal, cache: "no-store" })
          .then((r) => { clearTimeout(timer); setBackendStatus(el, r.ok, base); })
          .catch(() => { clearTimeout(timer); setBackendStatus(el, false); });
      }
      function showLauncherFallback() {
        const el = $("#backendStatus");
        if (el) {
          el.innerHTML = "启动器未运行：请先双击 <code>sectutor-backend\\SecTutor.bat</code> 启动器，再点「启动后端」。";
          el.className = "backend-status off";
        }
      }
      function checkBackend() {
        const el = $("#backendStatus");
        if (!el) return;
        const fn = getFetch();
        if (!fn) { showLauncherFallback(); return; }
        fn(LAUNCHER + "/status", { mode: "cors", cache: "no-store" })
          .then((r) => r.json())
          .then((j) => { if (j.running) setBackendStatus(el, true, "http://127.0.0.1:8787"); else tryHealth(el); })
          .catch(() => tryHealth(el));
      }
      checkBackend();
    }

    finishSplash();   // 预加载完成，淡出开启界面

    const clr = $("#clearChat");
    if (clr) clr.addEventListener("click", clearChat);

    // 预设提示词：点击把模板插入输入框（不自动发送），用户可改写后再发
    $$("#promptPresets .pp-chip").forEach((b) => {
      if (b.dataset.bound) return; b.dataset.bound = "1";
      b.addEventListener("click", () => {
        const inp = $("#chatInput"); if (!inp) return;
        const cur = inp.value.trim();
        inp.value = cur ? (cur + "\n" + b.dataset.prompt) : b.dataset.prompt;
        inp.focus();
      });
    });
    const exp = $("#exportChat");
    if (exp) exp.addEventListener("click", exportChat);

    // 语言切换入口：顶部「设置 → 语言」菜单（Electron 桌面壳）。
    // 菜单点击会通过 IPC 推送命令，这里监听并全局应用；
    // 同时把当前语言回报主进程，使其菜单勾选与界面保持一致。
    if (window.sectutor && window.sectutor.onLangCommand) {
      window.sectutor.onLangCommand((lang) => applyLang(lang));
    }
    if (window.sectutor && window.sectutor.notifyLang) {
      const cur = document.documentElement.getAttribute("lang") === "en" ? "en" : "zh";
      window.sectutor.notifyLang(cur);
    }
  }

  /* ============================================================
     方向① 主动式学习 Agent（能力画像 / 自适应路径 / 遗忘曲线复习 / 周报）
     ============================================================ */
  const DOMAINS = [
    { id: "web", name: "Web 安全", icon: "🌐" },
    { id: "binary", name: "二进制漏洞", icon: "🧩" },
    { id: "crypto", name: "密码学", icon: "🔐" },
    { id: "pentest", name: "渗透测试", icon: "🕵️" },
    { id: "network", name: "网络与内网安全", icon: "🛰️" },
    { id: "cloud", name: "云原生与容器安全", icon: "☁️" },
    { id: "blue", name: "蓝队·安全运营", icon: "🛡️" },
  ];
  const escapeAttr = (s) => String(s == null ? "" : s).replace(/"/g, "&quot;").replace(/</g, "&lt;");
  function pct(a, b) { return b ? Math.round((a / b) * 100) : 0; }
  function bindOnce(sel, fn) { const el = $(sel); if (el && !el.dataset.bound) { el.dataset.bound = "1"; el.addEventListener("click", fn); } }

  // —— ①a 能力诊断（自适应：答对升级难度、答错停该域、每域最多 3 题）——
  let diag = null;
  const DIAG_LEVELS = ["入门", "初级", "中级"];
  function startDiagnosis() {
    diag = {
      total: 0,
      score: { web: 0, binary: 0, crypto: 0, pentest: 0, network: 0, cloud: 0, blue: 0 },
      n: { web: 0, binary: 0, crypto: 0, pentest: 0, network: 0, cloud: 0, blue: 0 },
      byLevel: {},          // "cat::level" -> { n, score } 细分子类画像
      answers: [],          // 逐题作答记录（用于更精准画像 / 后续对比）
      used: {},             // cat -> Set(已用 quiz id)
      dom: {},              // cat -> { level, count, done }
      current: null,
    };
    DOMAINS.forEach((d) => { diag.dom[d.id] = { level: 0, count: 0, done: false }; diag.used[d.id] = new Set(); });
    renderDiag();
  }
  function pickDiag(cat) {
    const ds = diag.dom[cat];
    if (ds.done || ds.count >= 3) return null;
    const lvl = DIAG_LEVELS[ds.level];
    let pool = (SEC_DATA.quizzes || []).filter((q) => q.cat === cat && q.level === lvl && !diag.used[cat].has(q.id));
    if (!pool.length) pool = (SEC_DATA.quizzes || []).filter((q) => q.cat === cat && !diag.used[cat].has(q.id));
    if (!pool.length) { ds.done = true; return null; }
    const q = pool[Math.floor(Math.random() * pool.length)];
    diag.used[cat].add(q.id);
    return prepareQuestion({ ...q, cat });
  }
  function nextDiagQ() {
    const avail = DOMAINS.filter((d) => !diag.dom[d.id].done && diag.dom[d.id].count < 3);
    if (!avail.length) return null;
    avail.sort((a, b) => diag.dom[a.id].count - diag.dom[b.id].count); // 优先补题少的域，保持均衡
    return pickDiag(avail[0].id);
  }
  function renderDiag() {
    const box = $("#diagArea");
    if (!box) return;
    if (!diag) { box.innerHTML = ""; return; }
    const q = nextDiagQ();
    if (!q) { finishDiagnosis(); return; }
    diag.current = q;
    const dname = (DOMAINS.find((d) => d.id === q.cat) || {}).name || q.cat;
    const totalDone = DOMAINS.reduce((s, d) => s + diag.dom[d.id].count, 0);
    box.innerHTML = `
      <div class="diag-box">
        <div class="diag-prog">诊断进度 ${totalDone + 1} · 领域：${dname} · 当前难度：${q.level}</div>
        <h4>${escapeHtml(q.q)}</h4>
        <div class="diag-opts">
          ${q.options.map((o, i) => `<button class="diag-opt" data-i="${i}">${escapeHtml(o)}</button>`).join("")}
        </div>
      </div>`;
    box.querySelectorAll(".diag-opt").forEach((b) => {
      if (b.dataset.bound) return; b.dataset.bound = "1";
      b.addEventListener("click", () => {
        if (!diag || !diag.current) return;                 // 防御：诊断已结束后的孤立按钮点击
        const cur = diag.current;
        const i = parseInt(b.dataset.i, 10);
        const correct = i === cur.answer;
        const ds = diag.dom[cur.cat];
        diag.n[cur.cat]++; if (correct) diag.score[cur.cat]++;
        const key = cur.cat + "::" + cur.level;
        diag.byLevel[key] = diag.byLevel[key] || { n: 0, score: 0 };
        diag.byLevel[key].n++; if (correct) diag.byLevel[key].score++;
        diag.answers.push({ id: cur.id, cat: cur.cat, level: cur.level, correct });
        ds.count++;
        if (correct) { if (ds.level < DIAG_LEVELS.length - 1) ds.level++; else ds.done = true; }
        else ds.done = true;                                // 答错即找到能力上限，停止该域
        if (ds.count >= 3) ds.done = true;
        diag.current = null;
        diag.total++;
        renderDiag();
      });
    });
  }
  function finishDiagnosis() {
    const bl = {};
    DOMAINS.forEach((d) => {
      bl[d.id] = {};
      DIAG_LEVELS.concat(["高级"]).forEach((lv) => {
        const k = d.id + "::" + lv;
        if (diag.byLevel[k]) bl[d.id][lv] = pct(diag.byLevel[k].score, diag.byLevel[k].n);
      });
    });
    const prof = {
      web: pct(diag.score.web, diag.n.web), binary: pct(diag.score.binary, diag.n.binary),
      crypto: pct(diag.score.crypto, diag.n.crypto), pentest: pct(diag.score.pentest, diag.n.pentest),
      network: pct(diag.score.network, diag.n.network), cloud: pct(diag.score.cloud, diag.n.cloud),
      blue: pct(diag.score.blue, diag.n.blue),
      levelBreakdown: bl,
      answers: diag.answers,
      takenAt: Date.now(),
    };
    state.profile = prof; saveProfile(); logEvent("diag", prof); diag = null;
    const da = $("#diagArea"); if (da) da.innerHTML = "";   // 清掉诊断问卷，避免遗留可点击的孤立按钮
    renderAgentCenter();
  }

  // —— ①c 遗忘曲线复习 ——
  const REVIEW_INTERVALS = [1, 2, 4, 7, 15, 30]; // 天（艾宾浩斯简化）
  function dueReviews() {
    const now = Date.now(), out = [];
    Object.keys(state.masteryDates).forEach((id) => {
      if (!state.mastery.has(id)) return;
      const rec = state.masteryDates[id] || {};
      const stage = rec.r || 0;
      const interval = REVIEW_INTERVALS[Math.min(stage, REVIEW_INTERVALS.length - 1)];
      const days = (now - (rec.t || now)) / 86400000;
      if (days >= interval) out.push({ id, days, stage });
    });
    return out.sort((a, b) => b.days - a.days).slice(0, 6);
  }
  function startReview(ids) {
    const items = [];
    ids.forEach((id) => {
      const t = allTopics().find((x) => x.id === id);
      if (t) { const qs = (SEC_DATA.quizzes || []).filter((q) => q.cat === t.cat); if (qs[0]) items.push(prepareQuestion({ ...qs[0] })); }
    });
    if (!items.length) { openModal("🔔 复习", "<p>暂无可复盘的同类题目，已为你打开对应知识点。</p>"); ids.forEach((id) => showTopicDetail(id)); return; }
    let idx = 0, score = 0, picked = -1, answered = false;
    function render() {
      if (idx >= items.length) {
        ids.forEach((id) => { if (state.masteryDates[id]) state.masteryDates[id].r = (state.masteryDates[id].r || 0) + 1; });
        saveMasteryDates(); logEvent("review", ids.length);
        openModal("🔔 复习完成", `<p>本次复习 ${items.length} 题，答对 <b>${score}</b> 题。</p><p style="color:var(--muted)">相关知识点已推进到下一轮复习周期。</p>`);
        renderReviewCard();
        return;
      }
      const q = items[idx];
      const body = `
        <div class="quiz-progress">复习 ${idx + 1}/${items.length} ｜ 答对 ${score}</div>
        <div class="quiz-card"><div class="quiz-cat">${catById(q.cat).name} · ${q.level}</div>
        <h3 class="quiz-q">${escapeHtml(q.q)}</h3>
        <div class="quiz-opts">${q.options.map((o, i) => `<button class="quiz-opt" data-i="${i}">${i + 1}. ${escapeHtml(o)}</button>`).join("")}</div>
        <div class="quiz-feedback hidden" id="quizFeedback"></div>
        ${answered ? "" : `<button class="btn" id="quizSubmit">提交</button>`}</div>`;
      const ov = openModal("🔔 复习测验", body);
      if (answered) return;
      ov.querySelectorAll(".quiz-opt").forEach((b) => b.addEventListener("click", () => {
        ov.querySelectorAll(".quiz-opt").forEach((x) => x.classList.remove("sel")); b.classList.add("sel"); picked = parseInt(b.dataset.i, 10);
      }));
      $("#quizSubmit").addEventListener("click", () => {
        if (picked < 0) { $("#quizSubmit").textContent = "请先选择"; return; }
        answered = true; const correct = picked === q.answer; if (correct) score++;
        const fb = $("#quizFeedback"); fb.classList.remove("hidden"); fb.className = "quiz-feedback " + (correct ? "ok" : "fail");
        fb.innerHTML = `<b>${correct ? "✅ 正确" : "❌ 错误"}</b><p>${escapeHtml(q.explain)}</p><button class="btn small" id="quizNext">${idx + 1 >= items.length ? "完成" : "下一题 →"}</button>`;
        $("#quizNext").addEventListener("click", () => { idx++; answered = false; picked = -1; render(); });
      });
    }
    render();
  }

  // —— ①d 周报 ——
  function renderWeeklyReport() {
    const box = $("#weeklyCard"); if (!box) return;
    const now = Date.now(), week = now - 7 * 86400000;
    const evs = (state.activity || []).filter((e) => e.t >= week);
    const c = (t) => evs.filter((e) => e.type === t).length;
    const masters = c("master"), labs = c("lab"), chats = c("chat"), diags = c("diag"), reviews = c("review");
    const days = new Set(evs.map((e) => new Date(e.t).toDateString())).size;
    box.innerHTML = `<div class="acard-head">📊 本周学习报告 <span class="count">近 7 天</span></div>
      <div class="weekly-grid">
        <div class="wstat"><b>${masters}</b><span>掌握知识点</span></div>
        <div class="wstat"><b>${labs}</b><span>攻克靶场</span></div>
        <div class="wstat"><b>${chats}</b><span>问答次数</span></div>
        <div class="wstat"><b>${days}</b><span>学习天数</span></div>
      </div>
      <p style="color:var(--muted);font-size:13px">${masters + labs + reviews + diags ? "保持节奏，Agent 会按记忆曲线提醒你复习已掌握内容。" : "这周还没开始？做一道题或看一个知识点，周报就会记录你的进度。"}</p>`;
  }

  // —— 学习中心总渲染 ——
  function renderAgentCenter() {
    renderProfileCard();
    renderReviewCard();
    renderWeeklyReport();
  }
  function renderProfileCard() {
    const box = $("#profileCard"); if (!box) return;
    if (!state.profile) {
      box.innerHTML = `<div class="acard-head">🧠 能力画像</div>
        <p style="color:var(--muted)">还没诊断过。做一次能力诊断，Agent 会据此为你定制学习路径与复习节奏。</p>
        <button class="btn small" id="diagStart">开始能力诊断（约 12 题 / 2 分钟）</button>`;
      bindOnce("#diagStart", startDiagnosis);
      return;
    }
    const p = state.profile;
    const bars = DOMAINS.map((d) => {
      let lvHtml = "";
      const bl = p.levelBreakdown && p.levelBreakdown[d.id];
      if (bl) {
        const lvOrder = ["入门", "初级", "中级", "高级"];
        lvHtml = `<div class="pbar-sub">` + lvOrder.filter((lv) => bl[lv] != null).map((lv) =>
          `<span class="lvchip lvl-${lv}">${lv} ${bl[lv]}</span>`).join("") + `</div>`;
      }
      const pv = p[d.id] || 0;
      return `<div class="pbar-row"><span class="pbar-name">${d.icon} ${d.name}</span>` +
        `<span class="pbar-track" role="progressbar" aria-valuenow="${pv}" aria-valuemin="0" aria-valuemax="100" aria-label="${escapeHtml(d.name)}能力评分 ${pv}"><i style="width:${pv}%"></i></span>` +
        `<span class="pbar-val">${pv}</span></div>${lvHtml}`;
    }).join("");
    const weakest = DOMAINS.reduce((w, d) => ((p[d.id] || 0) < (p[w.id] || 0) ? d : w), DOMAINS[0]);
    box.innerHTML = `<div class="acard-head">🧠 能力画像 <button class="btn tiny ghost" id="diagRedo">重新诊断</button></div>
      ${bars}
      <p class="acard-tip">📉 最需补强：<b>${weakest.name}</b>（${p[weakest.id] || 0} 分）。「生成计划」已优先排布该领域。</p>
      <button class="btn small" id="weakQuizBtn">🎯 弱项专项自测（${weakest.name}）</button>`;
    bindOnce("#diagRedo", startDiagnosis);
    bindOnce("#weakQuizBtn", () => {
      const qc = $("#quizCat"); if (qc) qc.value = weakest.id;
      const qn = $("#quizCount"); if (qn) qn.value = 10;
      activateTab("quiz");
      if (typeof startQuiz === "function") startQuiz();
    });
  }
  // 遗忘曲线（艾宾浩斯简化）：retention = exp(-t/S)，红点为复习检查点
  function reviewCurveSvg() {
    const W = 248, H = 78, pad = 6, maxD = 30, S = 2.4;
    const xAt = (d) => pad + (d / maxD) * (W - 2 * pad);
    const yAt = (r) => H - pad - r * (H - 2 * pad);
    const pts = [];
    for (let d = 0; d <= maxD; d++) { const r = Math.exp(-d / S); pts.push(xAt(d).toFixed(1) + "," + yAt(r).toFixed(1)); }
    const dots = REVIEW_INTERVALS.map((iv) => {
      const r = Math.exp(-iv / S);
      return `<circle cx="${xAt(iv).toFixed(1)}" cy="${yAt(r).toFixed(1)}" r="2.4" fill="#e2554f"><title>${iv} 天</title></circle>`;
    }).join("");
    return `<svg class="review-curve" viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="遗忘曲线">
      <polyline fill="none" stroke="var(--brand)" stroke-width="2" points="${pts.join(" ")}"/>${dots}
      <text x="${pad}" y="${H - 1}" font-size="8" fill="var(--muted)">今天</text>
      <text x="${W - pad - 22}" y="${H - 1}" font-size="8" fill="var(--muted)">30天</text>
    </svg>`;
  }
  function renderReviewCard() {
    const box = $("#reviewCard"); if (!box) return;
    const due = dueReviews();
    if (!due.length) {
      box.innerHTML = `<div class="acard-head">🔔 复习提醒</div>
        <p style="color:var(--muted)">暂无到期复习项。掌握知识点后，Agent 会按记忆曲线（1/2/4/7/15/30 天）提醒你复习。</p>
        <div class="review-curve-wrap">${reviewCurveSvg()}<p class="muted" style="font-size:11px;margin:4px 0 0">遗忘曲线（红点=复习检查点）：越靠右记忆留存越低，到点复习可重置曲线。</p></div>`;
      return;
    }
    const chips = due.map((d) => `<button class="rel-chip" data-id="${escapeAttr(d.id)}">${escapeHtml(topicName(d.id))}</button>`).join("");
    box.innerHTML = `<div class="acard-head">🔔 复习提醒 <span class="count">${due.length}</span></div>
      <div class="review-curve-wrap">${reviewCurveSvg()}<p class="muted" style="font-size:11px;margin:4px 0 2px">遗忘曲线（红点=复习检查点）：以下知识点已到复习节点。</p></div>
      <div class="rel-box">${chips}</div>
      <button class="btn small" id="reviewStart">开始复习（${due.length} 题）</button>`;
    box.querySelectorAll(".rel-chip").forEach((b) => { if (b.dataset.bound) return; b.dataset.bound = "1"; b.addEventListener("click", () => showTopicDetail(b.dataset.id)); });
    bindOnce("#reviewStart", () => startReview(due.map((d) => d.id)));
  }

  /* ============================================================
     方向⑩ 工程化 Agent 基座（简化版）
     - 本地工具箱（可被 Agent 调用的工具，离线可用）
     - 外部 LLM 工具调用（function calling）
     - API 接入中心（LLM / 威胁情报预留 / MCP 预留 / 隐私说明）
     ============================================================ */
  // —— 通用模态框（复习小测 / API 接入中心 复用）——
  const FOCUSABLE_SEL = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  let modalPrevFocus = null;
  let modalGen = 0;      // 代际令牌：防止「延迟隐藏」误伤随后打开的新弹窗
  let modalTrapBound = false;

  function bindModalTrap(ov) {
    ov.addEventListener("keydown", (e) => {
      if (e.key !== "Tab") return;
      const modal = ov.querySelector(".modal");
      if (!modal) return;
      const items = Array.prototype.slice.call(modal.querySelectorAll(FOCUSABLE_SEL));
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  function openModal(titleHtml, bodyHtml) {
    let ov = $("#modalOverlay");
    if (!ov) { ov = document.createElement("div"); ov.id = "modalOverlay"; ov.className = "modal-overlay hidden"; document.body.appendChild(ov); }
    ov.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">` +
      `<div class="modal-head"><span id="modalTitle">${titleHtml}</span>` +
      `<button class="modal-close" id="modalClose" aria-label="\u5173\u95ed">\u2715</button></div>` +
      `<div class="modal-body" id="modalBody">${bodyHtml}</div></div>`;
    ov.classList.remove("hidden");
    ov.classList.remove("out");
    modalGen++;                                   // 令此前所有挂起的「延迟隐藏」失效
    $("#modalClose").onclick = closeModal;
    ov.onclick = (e) => { if (e.target === ov) closeModal(); };
    if (!modalTrapBound) { bindModalTrap(ov); modalTrapBound = true; }
    // 焦点管理：记录来源，关闭时归还；打开后聚焦弹窗内首个可聚焦元素
    modalPrevFocus = document.activeElement;
    const first = ov.querySelector(".modal " + FOCUSABLE_SEL);
    if (first && typeof first.focus === "function") { try { first.focus(); } catch (err) {} }
    return ov;
  }

  function closeModal() {
    const ov = $("#modalOverlay");
    if (!ov || ov.classList.contains("hidden")) return;
    const myGen = modalGen;
    ov.classList.add("out");
    let done = false;
    const finish = function () {
      if (done) return;
      done = true;
      // 期间若又打开了新弹窗（modalGen 已变），则本次隐藏作废，避免把新弹窗一起藏掉
      if (myGen !== modalGen) return;
      ov.classList.add("hidden");
      ov.classList.remove("out");
    };
    const modal = ov.querySelector(".modal");
    if (modal) modal.addEventListener("animationend", finish, { once: true });
    setTimeout(finish, 260);   // 关闭动效时不会触发 animationend，定时器兜底
    if (modalPrevFocus && typeof modalPrevFocus.focus === "function") {
      try { modalPrevFocus.focus(); } catch (err) {}
    }
    modalPrevFocus = null;
  }

  // —— 本地工具实现（纯 JS，离线）——
  function toBin(str) { const bytes = new TextEncoder().encode(str); let s = ""; for (const b of bytes) s += String.fromCharCode(b); return s; }
  function tbB64(input, mode) {
    if (mode === "encode") { try { return btoa(toBin(input)); } catch (e) { return "编码失败：" + e.message; } }
    try { return new TextDecoder().decode(Uint8Array.from(atob(input.trim()), (c) => c.charCodeAt(0))); } catch (e) { return "解码失败：输入不是合法 Base64"; }
  }
  function tbUrl(input, mode) { try { return mode === "encode" ? encodeURIComponent(input) : decodeURIComponent(input); } catch (e) { return "错误：" + e.message; } }
  function tbHex(input, mode) {
    if (mode === "encode") { const bytes = new TextEncoder().encode(input); let s = ""; for (const b of bytes) s += b.toString(16).padStart(2, "0"); return s.toUpperCase(); }
    const h = input.trim().replace(/\s/g, ""); if (!/^[0-9a-fA-F]*$/.test(h) || h.length % 2) return "解码失败：非合法十六进制";
    const bytes = h.match(/../g).map((x) => parseInt(x, 16)); return new TextDecoder().decode(Uint8Array.from(bytes));
  }
  function md5(s) {
    function rotateLeft(l, s) { return (l << s) | (l >>> (32 - s)); }
    function add(x, y) { const l = (x & 0xFFFF) + (y & 0xFFFF); const m = (x >> 16) + (y >> 16) + (l >> 16); return (m << 16) | (l & 0xFFFF); }
    function cmn(q, a, b, x, s, t) { a = add(add(a, q), add(x, t)); return add(rotateLeft(a, s), b); }
    function ff(a,b,c,d,x,s,t){return cmn((b&c)|(~b&d),a,b,x,s,t);}
    function gg(a,b,c,d,x,s,t){return cmn((b&d)|(c&~d),a,b,x,s,t);}
    function hh(a,b,c,d,x,s,t){return cmn(b^c^d,a,b,x,s,t);}
    function ii(a,b,c,d,x,s,t){return cmn(c^(b|~d),a,b,x,s,t);}
    const bin = toBin(s); const n = bin.length;
    const st = [1732584193, -271733879, -1732584194, 271733878];
    const tail = (n % 64 < 56) ? 56 - (n % 64) : 120 - (n % 64);
    const len = n * 8;
    const bytes = new Uint8Array(n + tail + 8);
    for (let i = 0; i < n; i++) bytes[i] = bin.charCodeAt(i);
    bytes[n] = 0x80;
    for (let i = 0; i < 4; i++) bytes[n + tail + i] = (len >>> (i * 8)) & 0xFF;
    const x = new Int32Array(16);
    for (let i = 0; i < bytes.length; i += 64) {
      for (let j = 0; j < 16; j++) x[j] = (bytes[i + j*4] | (bytes[i + j*4 + 1]<<8) | (bytes[i + j*4 + 2]<<16) | (bytes[i + j*4 + 3]<<24));
      let a=st[0], b=st[1], c=st[2], d=st[3];
      a=ff(a,b,c,d,x[0],7,-680876936); d=ff(d,a,b,c,x[1],12,-389564586); c=ff(c,d,a,b,x[2],17,606105819); b=ff(b,c,d,a,x[3],22,-1044525330);
      a=ff(a,b,c,d,x[4],7,-176418897); d=ff(d,a,b,c,x[5],12,1200080426); c=ff(c,d,a,b,x[6],17,-1473231341); b=ff(b,c,d,a,x[7],22,-45705983);
      a=ff(a,b,c,d,x[8],7,1770035416); d=ff(d,a,b,c,x[9],12,-1958414417); c=ff(c,d,a,b,x[10],17,-42063); b=ff(b,c,d,a,x[11],22,-1990404162);
      a=ff(a,b,c,d,x[12],7,1804603682); d=ff(d,a,b,c,x[13],12,-40341101); c=ff(c,d,a,b,x[14],17,-1502002290); b=ff(b,c,d,a,x[15],22,1236535329);
      a=gg(a,b,c,d,x[1],5,-165796510); d=gg(d,a,b,c,x[6],9,-1069501632); c=gg(c,d,a,b,x[11],14,643717713); b=gg(b,c,d,a,x[0],20,-373897302);
      a=gg(a,b,c,d,x[5],5,-701558691); d=gg(d,a,b,c,x[10],9,38016083); c=gg(c,d,a,b,x[15],14,-660478335); b=gg(b,c,d,a,x[4],20,-405537848);
      a=gg(a,b,c,d,x[9],5,568446438); d=gg(d,a,b,c,x[14],9,-1019803690); c=gg(c,d,a,b,x[3],14,-187363961); b=gg(b,c,d,a,x[8],20,1163531501);
      a=gg(a,b,c,d,x[13],5,-1444681467); d=gg(d,a,b,c,x[2],9,-51403784); c=gg(c,d,a,b,x[7],14,1735328473); b=gg(b,c,d,a,x[12],20,-1926607734);
      a=hh(a,b,c,d,x[5],4,-378558); d=hh(d,a,b,c,x[8],11,-2022574463); c=hh(c,d,a,b,x[11],16,1839030562); b=hh(b,c,d,a,x[14],23,-35309556);
      a=hh(a,b,c,d,x[1],4,-1530992060); d=hh(d,a,b,c,x[4],11,1272893353); c=hh(c,d,a,b,x[7],16,-155497632); b=hh(b,c,d,a,x[10],23,-1094730640);
      a=hh(a,b,c,d,x[13],4,681279174); d=hh(d,a,b,c,x[0],11,-358537222); c=hh(c,d,a,b,x[3],16,-722521979); b=hh(b,c,d,a,x[6],23,76029189);
      a=hh(a,b,c,d,x[9],4,-640364487); d=hh(d,a,b,c,x[12],11,-421815835); c=hh(c,d,a,b,x[15],16,530742520); b=hh(b,c,d,a,x[2],23,-995338651);
      a=ii(a,b,c,d,x[0],6,-198630844); d=ii(d,a,b,c,x[7],10,1126891415); c=ii(c,d,a,b,x[14],15,-1416354905); b=ii(b,c,d,a,x[5],21,-57434055);
      a=ii(a,b,c,d,x[12],6,1700485571); d=ii(d,a,b,c,x[3],10,-1894986606); c=ii(c,d,a,b,x[10],15,-1051523); b=ii(b,c,d,a,x[1],21,-2054922799);
      a=ii(a,b,c,d,x[8],6,1873313359); d=ii(d,a,b,c,x[15],10,-30611744); c=ii(c,d,a,b,x[6],15,-1560198380); b=ii(b,c,d,a,x[13],21,1309151649);
      a=ii(a,b,c,d,x[4],6,-145523070); d=ii(d,a,b,c,x[11],10,-1120210379); c=ii(c,d,a,b,x[2],15,718787259); b=ii(b,c,d,a,x[9],21,-343485551);
      st[0]=add(st[0],a); st[1]=add(st[1],b); st[2]=add(st[2],c); st[3]=add(st[3],d);
    }
    function toHex(n){ let o=""; for(let c=0;c<4;c++){ const v=(n>>>(c*8))&0xFF; o+=(v<16?"0":"")+v.toString(16); } return o; }
    return toHex(st[0])+toHex(st[1])+toHex(st[2])+toHex(st[3]);
  }
  // SHA-256（纯 JS，UTF-8 安全，已对照 Node crypto 全量验证）
  function sha256(str) {
    const bytes = new TextEncoder().encode(str);
    const K = [
      0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
      0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
      0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
      0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
      0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
      0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
      0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
      0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
    ];
    let h0=0x6a09e667,h1=0xbb67ae85,h2=0x3c6ef372,h3=0xa54ff53a,h4=0x510e527f,h5=0x9b05688c,h6=0x1f83d9ab,h7=0x5be0cd19;
    const bitLen = bytes.length * 8;
    const msg = [];
    for (let i = 0; i < bytes.length; i++) msg.push(bytes[i]);
    msg.push(0x80);
    while (msg.length % 64 !== 56) msg.push(0x00);
    for (let i = 7; i >= 0; i--) msg.push((bitLen / Math.pow(2, 8 * i)) & 0xff);
    for (let off = 0; off < msg.length; off += 64) {
      const w = new Array(64);
      for (let i = 0; i < 16; i++) {
        w[i] = (msg[off + i*4] << 24) | (msg[off + i*4 + 1] << 16) | (msg[off + i*4 + 2] << 8) | (msg[off + i*4 + 3]);
      }
      for (let i = 16; i < 64; i++) {
        const s0 = ((w[i-15] >>> 7) | (w[i-15] << 25)) ^ ((w[i-15] >>> 18) | (w[i-15] << 14)) ^ (w[i-15] >>> 3);
        const s1 = ((w[i-2] >>> 17) | (w[i-2] << 15)) ^ ((w[i-2] >>> 19) | (w[i-2] << 13)) ^ (w[i-2] >>> 10);
        w[i] = (w[i-16] + s0 + w[i-7] + s1) | 0;
      }
      let a=h0,b=h1,c=h2,d=h3,e=h4,f=h5,g=h6,hh=h7;
      for (let i = 0; i < 64; i++) {
        const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        const ch = (e & f) ^ (~e & g);
        const t1 = (hh + S1 + ch + K[i] + w[i]) | 0;
        const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h0=(h0+a)|0; h1=(h1+b)|0; h2=(h2+c)|0; h3=(h3+d)|0;
      h4=(h4+e)|0; h5=(h5+f)|0; h6=(h6+g)|0; h7=(h7+hh)|0;
    }
    const H = [h0,h1,h2,h3,h4,h5,h6,h7];
    let out = "";
    for (let i = 0; i < 8; i++) out += ((H[i] >>> 0).toString(16).padStart(8, "0"));
    return out;
  }
  function tbHash(input, algo) { return algo === "md5" ? md5(input) : sha256(input); }
  // JWT 解码（仅解码 payload，不做签名校验；用于学习/调试，不验证可信性）
  function jwtDecode(token) {
    const parts = String(token || "").trim().split(".");
    if (parts.length < 2) return "不是合法 JWT（需 header.payload[.signature] 三段式）";
    try {
      const dec = (s) => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0))));
      return "header: " + JSON.stringify(dec(parts[0])) + "\npayload: " + JSON.stringify(dec(parts[1]));
    } catch (e) { return "JWT 解析失败：" + e.message; }
  }

  // Agent 工具定义：既供工具箱使用，也作为 LLM function calling 的 schema
  const AGENT_TOOLS = [
    { name: "base64_decode", description: "将 Base64 字符串解码为原文（UTF-8）", parameters: { type: "object", properties: { text: { type: "string" } }, required: ["text"] }, run: (a) => tbB64(a.text, "decode") },
    { name: "base64_encode", description: "将原文编码为 Base64", parameters: { type: "object", properties: { text: { type: "string" } }, required: ["text"] }, run: (a) => tbB64(a.text, "encode") },
    { name: "url_decode", description: "对 URL 编码字符串做解码", parameters: { type: "object", properties: { text: { type: "string" } }, required: ["text"] }, run: (a) => tbUrl(a.text, "decode") },
    { name: "hex_decode", description: "将十六进制字符串解码为原文", parameters: { type: "object", properties: { text: { type: "string" } }, required: ["text"] }, run: (a) => tbHex(a.text, "decode") },
    { name: "hash_text", description: "计算文本的哈希值（md5 或 sha256）", parameters: { type: "object", properties: { text: { type: "string" }, algo: { type: "string", enum: ["md5", "sha256"] } }, required: ["text"] }, run: (a) => tbHash(a.text, a.algo || "sha256") },
    // —— 以下为「工程化 Agent 基座」专属工具：让外接 LLM 能真正「行动」而非只聊天 ——
    { name: "search_knowledge", description: "在 SecTutor 内置知识库（知识点/靶场题解/安全资讯/安全工具/交互靶场）中检索相关资料，返回最相关条目的摘要。当用户想查某个具体知识点、CVE、工具用法，或需要补充资料时调用。", parameters: { type: "object", properties: { query: { type: "string", description: "检索关键词或问题" }, top_k: { type: "integer", description: "返回条数，默认 5，最多 8" } }, required: ["query"] }, run: (a) => {
      const k = Math.max(1, Math.min(8, parseInt(a.top_k, 10) || 5));
      const docs = retrieve(a.query || "", k);
      if (!docs.length) return "未检索到相关资料。";
      return docs.map((d, i) => `[${i + 1}] 【${d.src}】${d.title}\n${(d.text || "").slice(0, 500)}`).join("\n\n---\n\n");
    } },
    { name: "jwt_decode", description: "解码 JWT（JSON Web Token）的 header 与 payload，用于学习/调试。仅解码不校验签名。", parameters: { type: "object", properties: { token: { type: "string", description: "JWT 字符串（header.payload[.signature]）" } }, required: ["token"] }, run: (a) => jwtDecode(a.token) },
    // —— 以下为「工程化 Agent 基座」新增的能力工具（带风险分级）——
    { name: "related_topics", description: "根据给定的知识点 id，返回与之关联度最高的若干相关知识点（标题+来源），用于拓展学习路径与查漏补缺。", parameters: { type: "object", properties: { topicId: { type: "string", description: "知识点 id，例如 allTopics 中的某个 id" } }, required: ["topicId"] }, run: (a) => {
      const id = a.topicId || a.topic_id;
      const topic = (allTopics() || []).find((t) => t.id === id);
      if (!topic) return "未找到该知识点（topicId=" + id + "）。";
      const rel = relatedDocs(topic).slice(0, 5);
      if (!rel.length) return "该知识点暂无强关联条目。";
      return rel.map((d, i) => "[" + (i + 1) + "] " + d.title + "（" + (d.src || "") + "）").join("\n");
    } },
    { name: "generate_plan", description: "依据指定领域/每周时长/周数生成个性化学习计划（写入学习计划面板）。非破坏性、本地执行。", parameters: { type: "object", properties: { category: { type: "string", description: "领域 id，如 web/binary/crypto/pentest 或 all" }, hours_per_week: { type: "integer", description: "每周学习时长（小时）" }, weeks: { type: "integer", description: "总周数" } }, required: [] }, run: (a) => {
      const cat = a.category || "all";
      const hours = Math.max(1, parseInt(a.hours_per_week, 10) || 5);
      const weeks = Math.max(1, parseInt(a.weeks, 10) || 4);
      const pc = $("#planCat"), ph = $("#planHours"), pw = $("#planWeeks");
      if (pc && ph && pw) { pc.value = cat; ph.value = String(hours); pw.value = String(weeks); genPlan(); return "已依据「" + cat + "／每周" + hours + "小时／" + weeks + "周」生成学习计划，请查看「学习计划」面板。"; }
      return "学习计划面板尚未打开，无法渲染。请先切换到学习计划页再试。";
    } },
    { name: "launch_lab_env", description: "为指定实验（labId）向后端申请并启动一个临时靶场环境。会产生外部副作用（启动容器/服务），必须经用户确认后才执行。", parameters: { type: "object", properties: { labId: { type: "string", description: "实验 id，例如 lab_sqli / lab_cmdi / lab_xss / lab_traversal / lab_nosql" } }, required: ["labId"] }, run: (a) => {
      const id = a.labId || a.lab_id;
      const lab = (SEC_DATA.labs || []).find((l) => l.id === id);
      if (!lab) return "未找到该实验（labId=" + id + "）。可用 labId 见「在线演练」列表。";
      requestEnv(lab);
      return "已申请启动实验环境：" + (lab.name || lab.id) + "（请在「在线演练」面板查看状态；若后端不可用将自动回退本地仿真）。";
    } },
    { name: "run_scan", description: "对你本人已申请的临时靶场环境（state.activeEnv，由 launch_lab_env 启动）做授权内安全自检：经后端查询环境真实状态、对自己靶场 accessUrl 做 best-effort 连通探测，并基于该靶场对应的知识点/题解生成「应核查脆弱点清单」与合规提醒。绝不向任何外部或任意地址发包，仅限你拥有的授权靶场。high 风险，需确认。", parameters: { type: "object", properties: {}, required: [] }, run: () => runScan() },
  ];
  // —— Phase 1 工具层：风险分级 + 确认流 ——
  // 风险等级：low（本地只读/非破坏，自动执行）；high（启动环境等外部副作用，需用户确认）
  const TOOL_RISK = {
    base64_decode: { level: "low", confirm: false },
    base64_encode: { level: "low", confirm: false },
    url_decode: { level: "low", confirm: false },
    hex_decode: { level: "low", confirm: false },
    hash_text: { level: "low", confirm: false },
    search_knowledge: { level: "low", confirm: false },
    jwt_decode: { level: "low", confirm: false },
    related_topics: { level: "low", confirm: false },
    generate_plan: { level: "low", confirm: false },
    launch_lab_env: { level: "high", confirm: true },
    run_scan: { level: "high", confirm: true },
  };
  function toolRisk(name) { const r = TOOL_RISK[name]; return r ? r.level : null; }
  function toolRequiresConfirm(name) { const r = TOOL_RISK[name]; return !!(r && r.confirm); }
  function listTools() {
    return AGENT_TOOLS.map((t) => ({ name: t.name, description: t.description, risk_level: toolRisk(t.name) || "low", confirm_required: toolRequiresConfirm(t.name) }));
  }
  // 确认执行高风险工具：弹窗 + 代际令牌（modalGen）防误伤；确认→true，取消/关闭/被抢占→false
  function confirmToolCall(tool, args) {
    return new Promise((resolve) => {
      const name = tool && tool.name;
      const risk = toolRisk(name) || "low";
      const argStr = args && typeof args === "object" ? JSON.stringify(args) : String(args == null ? "" : args);
      const body = "<p>Agent 请求执行工具 <strong>" + escapeHtml(name) + "</strong>（风险等级：<span class=\"risk-" + escapeHtml(risk) + "\">" + escapeHtml(risk) + "</span>）。</p>" +
        "<p class=\"hint\">参数：" + escapeHtml(argStr).slice(0, 300) + "</p>" +
        "<p class=\"hint\">" + (risk === "high" ? "该操作会启动实验环境或产生外部副作用。" : "该操作将在本地执行。") + "确认后才真正执行；取消则告知 Agent 你拒绝了该操作。</p>" +
        "<div class=\"modal-actions\"><button class=\"btn small\" id=\"toolConfirmYes\">确认执行</button><button class=\"btn small ghost\" id=\"toolConfirmNo\">取消</button></div>";
      openModal("⚠️ 确认工具执行", body);
      const gen = modalGen;                 // openModal 已 ++，记录当前弹窗代际
      const ov = $("#modalOverlay");
      let settled = false;
      const done = (v) => { if (settled) return; settled = true; closeModal(); resolve(v); };
      const yes = $("#toolConfirmYes"), no = $("#toolConfirmNo");
      if (yes) yes.onclick = () => done(true);
      if (no) no.onclick = () => done(false);
      if (ov) {
        const closeBtn = $("#modalClose"); if (closeBtn) closeBtn.onclick = () => done(false);
        ov.onclick = (e) => { if (e.target === ov) done(false); };
      }
      // 极端情况：被新弹窗抢占（modalGen 变化）或 30s 超时，本次确认作废，避免误执行
      setTimeout(() => { if (gen !== modalGen && !settled) done(false); }, 30000);
    });
  }
  // —— 授权靶场自检（run_scan 实现，路线 A：仅限本人申请的临时靶场）——
  const SCAN_COMPLIANCE = "本工具仅核查你本人申请、后端下发的授权临时靶场（state.activeEnv），绝不向任何外部或任意地址发起扫描/探测，符合 SecTutor 合规红线（禁止非授权扫描/入侵）。";
  function knowledgeChecklist(env) {
    const labId = env && (env.labId || env.id);
    const lab = (SEC_DATA.labs || []).find((l) => l.id === labId);
    const seed = lab ? (lab.name || lab.title || labId) : ((env && env.title) || "安全靶场");
    const docs = retrieve(seed, 6);
    return docs.map((d) => ({ title: d.title, src: d.src || "", level: d.level || "" }));
  }
  function probeReach(url) {
    if (!url) return Promise.resolve("unknown");
    const fn = getFetch();
    if (!fn) return Promise.resolve("unknown");
    return fn(url, { method: "GET", mode: "no-cors", cache: "no-store" })
      .then(() => true)
      .catch(() => false);
  }
  function runScan() {
    const env = state.activeEnv;
    if (!env || !env.id) {
      return "未检测到活动靶场。请先通过 launch_lab_env 申请一个临时靶场（或在「在线演练」面板生成环境），再执行自检。自检不会向任何外部地址发包。";
    }
    const fn = getFetch();
    if (!fn || !state.backend || !state.backend.url) {
      // 后端不可用：降级为纯知识清单（不联网、零外部动作）
      return JSON.stringify({ ok: true, degraded: true, scope: "仅知识库清单（后端不可用，未做连通性探测）", env_id: env.id, vulnerabilities: knowledgeChecklist(env), compliance: SCAN_COMPLIANCE }, null, 2);
    }
    return envApi("/api/envs/" + encodeURIComponent(env.id), { method: "GET", cache: "no-store" })
      .then((r) => r.json().then((d) => ({ r, d })))
      .then(({ r, d }) => {
        if (!r.ok || !d.ok) {
          return JSON.stringify({ ok: false, error: (d && d.error) || ("HTTP " + r.status), hint: "环境可能已销毁或后端不可用。", compliance: SCAN_COMPLIANCE }, null, 2);
        }
        const live = d.env || env;
        const accessUrl = (live.accessUrl) || (env.accessUrl) || "";
        return probeReach(accessUrl).then((reachable) => JSON.stringify({
          ok: true,
          env_id: live.id,
          title: live.title,
          status: live.status,
          access_url: accessUrl,
          reachable: reachable,
          scope: "仅限你拥有的授权靶场，未向任何外部地址发包",
          vulnerabilities: knowledgeChecklist(live),
          compliance: SCAN_COMPLIANCE,
        }, null, 2));
      })
      .catch((e) => JSON.stringify({ ok: false, error: (e && e.message) || "网络错误", hint: "自检未向外部目标发包。", compliance: SCAN_COMPLIANCE }, null, 2));
  }
  async function callTool(name, args) {
    const t = AGENT_TOOLS.find((x) => x.name === name);
    if (!t) return "未知工具：" + name;
    try { const r = await t.run(args || {}); return (r == null ? "" : String(r)); } catch (e) { return "工具执行错误：" + e.message; }
  }
  function toolSchemas() { return AGENT_TOOLS.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } })); }

  function renderToolbox() {
    const box = $("#toolbox"); if (!box) return;
    box.innerHTML = `
      <div class="toolbox">
        <p class="hint">🧰 工具箱：以下工具在<strong>本地运行</strong>，不上传任何数据；当你接入大模型 API 后，Agent 也可在回答时直接调用它们。</p>
        <div class="tb-row"><label>输入</label><textarea id="tbInput" rows="3" placeholder="粘贴待处理文本…"></textarea></div>
        <div class="tb-row"><label>操作</label>
          <select id="tbOp">
            <option value="b64d">Base64 解码</option>
            <option value="b64e">Base64 编码</option>
            <option value="urld">URL 解码</option>
            <option value="hexd">Hex 解码</option>
            <option value="md5">MD5 哈希</option>
            <option value="sha256">SHA256 哈希</option>
          </select>
          <button class="btn small" id="tbRun">运行</button>
          <button class="btn small ghost" id="tbClear">清空</button>
        </div>
        <div class="tb-row"><label>输出</label><pre id="tbOut" class="tb-out"></pre></div>
      </div>`;
    bindOnce("#tbRun", () => {
      const input = $("#tbInput").value, op = $("#tbOp").value; let out = "";
      if (op === "b64d") out = tbB64(input, "decode");
      else if (op === "b64e") out = tbB64(input, "encode");
      else if (op === "urld") out = tbUrl(input, "decode");
      else if (op === "hexd") out = tbHex(input, "decode");
      else if (op === "md5") out = tbHash(input, "md5");
      else if (op === "sha256") out = tbHash(input, "sha256");
      $("#tbOut").textContent = out;
    });
    bindOnce("#tbClear", () => { $("#tbInput").value = ""; $("#tbOut").textContent = ""; });
  }

  // —— API 接入中心 ——
  function saveLlmState() {
    try {
      if (KeyVault && KeyVault.isProtected()) {
        // 密钥已加密存于 sectutor_llm_key；此处仅持久化非机密配置（base/model/temp）
        const { key, ...rest } = state.llm || {};
        localStorage.setItem("sectutor_llm", JSON.stringify(rest));
      } else {
        localStorage.setItem("sectutor_llm", JSON.stringify(state.llm));
      }
    } catch (e) {}
  }
  function renderMcpList() {
    const list = (state.apis.mcp || []);
    if (!list.length) return "<p style='color:var(--muted)'>尚未添加 MCP 服务器（预留，待启用）。</p>";
    return list.map((m, i) => `<div class="mcp-item">${escapeHtml(m.name)} · ${escapeHtml(m.url)} <button class="btn tiny ghost" data-mi="${i}">移除</button> <button class="btn tiny ghost" data-test="${i}">测试</button></div>`).join("");
  }
  // 连接测试（用户主动触发，带超时；仅探测可达性，不传输任何业务数据）
  function testConnection(url, key) {
    return new Promise((res) => {
      if (!url) { res({ ok: false, err: "未填写地址" }); return; }
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 4000);
      const headers = {}; if (key) headers.Authorization = "Bearer " + key;
      fetch(url, { method: "GET", headers, signal: ctrl.signal, cache: "no-store" })
        .then((r) => { clearTimeout(timer); res({ ok: r.ok || r.status == null, status: r.status }); })
        .catch((e) => { clearTimeout(timer); res({ ok: false, err: (e && e.name === "AbortError") ? "超时（4s）" : (e && e.message) || "连接失败" }); });
    });
  }
  function openApiHub() {
    const llm = state.llm || {}, intel = state.apis.intel || {};
    const body = `
      <div class="api-tabs">
        <button class="chip active" data-atab="llm">🤖 大模型 LLM</button>
        <button class="chip" data-atab="intel">📰 威胁情报（预留）</button>
        <button class="chip" data-atab="mcp">🧩 MCP 插件（预留）</button>
        <button class="chip" data-atab="privacy">🔒 隐私说明</button>
      </div>
      <div class="api-pane" data-pane="llm">
        <p class="hint">SecTutor 的 AI 能力<strong>完全依赖你接入的外部大模型 API</strong>（OpenAI 兼容）。密钥仅存本机，不上传。</p>
        <label class="field"><span>API Base URL</span><input id="hubLlmBase" value="${escapeAttr(llm.base || "")}" placeholder="https://api.openai.com/v1" /></label>
        <label class="field"><span>API Key</span><input id="hubLlmKey" type="password" value="${escapeAttr(llm.key || "")}" placeholder="sk-..." /></label>
        <label class="field"><span>模型名</span><input id="hubLlmModel" value="${escapeAttr(llm.model || "")}" placeholder="gpt-4o-mini" /></label>
        <label class="field"><span>温度 (0-1)</span><input id="hubLlmTemp" value="${escapeAttr(llm.temp != null ? llm.temp : "0.3")}" /></label>
        <button class="btn small" id="hubSaveLlm">保存大模型配置</button>
        <hr class="api-sep" />
        <div class="kv-section">
          <div class="kv-status">密钥保护：<strong id="kvStatus">${KeyVault.isProtected() ? "已启用 🔒" : "未启用"}</strong></div>
          <div class="api-actions">
            <button class="btn small" id="kvEnable">${KeyVault.isProtected() ? "修改访问口令" : "启用访问口令保护"}</button>
            ${KeyVault.isProtected() ? '<button class="btn small ghost" id="kvDisable">关闭保护（转明文）</button>' : ""}
          </div>
          <p class="hint" id="kvHint">${KeyVault.isProtected() ? "重启后密钥将锁定，首次 AI 问答需输入口令解锁。" : "启用后密钥以 AES-GCM 加密存于本机，重启需口令解锁；不启用则明文存于本机浏览器。"}</p>
        </div>
        <hr class="api-sep" />
        <div class="feat-section">
          <div class="kv-status">增强能力（实验，默认关闭）</div>
          <label class="field inline"><input type="checkbox" id="featVoice" ${FEATURE_FLAGS.voiceInput ? "checked" : ""} /> 语音输入（需麦克风，可能联网 ASR）</label>
          <label class="field inline"><input type="checkbox" id="featVision" ${FEATURE_FLAGS.visionInput ? "checked" : ""} /> 视觉识图（截图/报错识图，可能联网 VLM）</label>
          <p class="hint">上述能力将在后续版本接入；当前仅记录开关状态，默认关闭以保隐私与离线可用。</p>
        </div>
      </div>
      <div class="api-pane hidden" data-pane="intel">
        <p class="hint">预留：接入漏洞情报源（如 NVD / 自建情报网关），后续可用于「CVE 订阅推送 / PoC 研判」。配置后点「测试连接」探测可达性（仅 GET，不传输业务数据）。</p>
        <label class="field"><span>情报源地址</span><input id="hubIntelUrl" value="${escapeAttr(intel.url || "")}" placeholder="https://your-intel.example/api" /></label>
        <label class="field"><span>访问令牌</span><input id="hubIntelKey" type="password" value="${escapeAttr(intel.key || "")}" placeholder="token" /></label>
        <div class="api-actions">
          <button class="btn small" id="hubSaveIntel">保存</button>
          <button class="btn small ghost" id="hubTestIntel">测试连接</button>
          <span id="intelTestRes" class="api-test-res"></span>
        </div>
      </div>
      <div class="api-pane hidden" data-pane="mcp">
        <p class="hint">预留：配置 MCP 服务器，让 Agent 调用你的靶场 / 扫描器 / 情报源。当前为占位，待启用。</p>
        <div id="mcpList">${renderMcpList()}</div>
        <div class="mcp-add">
          <input id="mcpName" placeholder="名称" />
          <input id="mcpUrl" placeholder="URL" />
          <input id="mcpKey" placeholder="Key(可选)" />
          <button class="btn small" id="mcpAdd">添加</button>
        </div>
      </div>
      <div class="api-pane hidden" data-pane="privacy">
        <p>SecTutor 采用<strong>本地优先</strong>架构：</p>
        <ul>
          <li>知识库、靶场仿真、工具箱、能力画像、复习计划、活动日志<strong>全部在本地运行与存储</strong>，不上传任何数据。</li>
          <li>仅当你主动在「大模型 LLM」填入 API 时，问题文本才会发往你指定的外部接口；密钥仅存于本机浏览器。</li>
          <li>威胁情报 / MCP 等外部集成默认关闭，需你自行配置且数据走向由你掌控。</li>
        </ul>
      </div>`;
    const ov = openModal("⚙️ API 接入中心", body);
    ov.querySelectorAll(".api-tabs .chip").forEach((b) => b.addEventListener("click", () => {
      ov.querySelectorAll(".api-tabs .chip").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      ov.querySelectorAll(".api-pane").forEach((p) => p.classList.add("hidden"));
      ov.querySelector(`.api-pane[data-pane="${b.dataset.atab}"]`).classList.remove("hidden");
    }));
    $("#hubSaveLlm").addEventListener("click", () => {
      const keepKey = KeyVault.isProtected() && state.llm && state.llm.key;   // 保护态：保留已解锁明文 key，不从禁用输入框覆盖
      state.llm = {
        base: $("#hubLlmBase").value.trim() || "https://api.openai.com/v1",
        key: KeyVault.isProtected() ? (keepKey || "") : $("#hubLlmKey").value.trim(),
        model: $("#hubLlmModel").value.trim() || "gpt-4o-mini",
        temp: parseFloat($("#hubLlmTemp").value) || 0.3,
      };
      if (!state.llm.key) { openModal("提示", "<p>未填写 API Key，保存后仍将使用内置知识引擎（离线）。</p>"); }
      saveLlmState();
      const lb = $("#llmBase"); if (lb) lb.value = state.llm.base;
      const lk = $("#llmKey"); if (lk) lk.value = state.llm.key;
      const lm = $("#llmModel"); if (lm) lm.value = state.llm.model;
      openModal("✅ 已保存", "<p>大模型配置已保存到本机（仅本机浏览器）。</p>");
    });
    // 保护态：禁用 key 输入框，避免误改
    const hk = $("#hubLlmKey");
    if (hk && KeyVault.isProtected()) { hk.value = "🔒 已加密（需口令解锁）"; hk.disabled = true; }
    // 密钥口令保护：启用 / 修改 / 关闭
    const kvEnable = $("#kvEnable");
    if (kvEnable) kvEnable.addEventListener("click", async () => {
      if (KeyVault.isProtected()) {
        if (KeyVault.isLocked()) { await ensureLlmUnlocked(); }
        const np = window.prompt("设置新访问口令（用于加密 API Key）："); if (!np) return;
        try { await KeyVault.changePass(np); openModal("✅ 已修改", "<p>访问口令已更新。</p>"); }
        catch (e) { openModal("❌ 失败", "<p>" + escapeHtml(e.message) + "</p>"); }
      } else {
        const pass = window.prompt("设置访问口令（用于加密 API Key，重启后需输入解锁）："); if (!pass) return;
        try { await KeyVault.enable(pass); openModal("✅ 已启用", "<p>密钥已加密保护，重启后需口令解锁。</p>"); openApiHub(); }
        catch (e) { openModal("❌ 启用失败", "<p>" + escapeHtml(e.message) + "</p>"); }
      }
    });
    const kvDisable = $("#kvDisable");
    if (kvDisable) kvDisable.addEventListener("click", async () => {
      if (KeyVault.isLocked()) { const ok = await ensureLlmUnlocked(); if (!ok) return; }
      try { await KeyVault.disable(); openModal("✅ 已关闭", "<p>密钥已转回明文存储（仅本机）。</p>"); openApiHub(); }
      catch (e) { openModal("❌ 失败", "<p>" + escapeHtml(e.message) + "</p>"); }
    });
    // 增强能力开关（D2 默认关闭）
    const fv = $("#featVoice"), fvi = $("#featVision");
    if (fv) fv.addEventListener("change", () => { FEATURE_FLAGS.voiceInput = fv.checked; saveFeatureFlags(); });
    if (fvi) fvi.addEventListener("change", () => { FEATURE_FLAGS.visionInput = fvi.checked; saveFeatureFlags(); });
    $("#hubSaveIntel").addEventListener("click", () => {
      state.apis.intel = { url: $("#hubIntelUrl").value.trim(), key: $("#hubIntelKey").value.trim() };
      saveApis(); openModal("✅ 已保存", "<p>威胁情报接入配置已保存（仅本机）。点「测试连接」可探测可达性；逻辑对接待启用。</p>");
    });
    $("#hubTestIntel").addEventListener("click", async () => {
      const url = $("#hubIntelUrl").value.trim(), key = $("#hubIntelKey").value.trim();
      const el = $("#intelTestRes"); if (!el) return;
      el.textContent = "测试中…"; el.className = "api-test-res testing";
      const r = await testConnection(url, key);
      el.className = "api-test-res " + (r.ok ? "ok" : "fail");
      el.textContent = r.ok ? ("🟢 连接成功" + (r.status != null ? "（HTTP " + r.status + "）" : "")) : ("🔴 " + (r.err || ("HTTP " + r.status) || "连接失败"));
    });
    $("#mcpAdd").addEventListener("click", () => {
      const name = $("#mcpName").value.trim(), url = $("#mcpUrl").value.trim();
      if (!name || !url) { openModal("提示", "<p>请填写名称与 URL。</p>"); return; }
      state.apis.mcp = state.apis.mcp || [];
      state.apis.mcp.push({ name, url, key: $("#mcpKey").value.trim() });
      saveApis(); $("#mcpList").innerHTML = renderMcpList(); bindMcpRemove(); bindMcpTest();
    });
    bindMcpRemove();
    bindMcpTest();
  }
  function bindMcpTest() {
    $$("#mcpList .mcp-item button[data-test]").forEach((b) => {
      if (b.dataset.bound) return; b.dataset.bound = "1";
      b.addEventListener("click", async () => {
        const i = parseInt(b.dataset.test, 10);
        const m = (state.apis.mcp || [])[i]; if (!m) return;
        b.textContent = "测试中…"; b.disabled = true;
        const r = await testConnection(m.url, m.key);
        b.disabled = false; b.textContent = "测试";
        const item = b.closest(".mcp-item"); if (item) {
          let tag = item.querySelector(".mcp-test-res");
          if (!tag) { tag = document.createElement("span"); tag.className = "mcp-test-res"; item.appendChild(tag); }
          tag.className = "mcp-test-res " + (r.ok ? "ok" : "fail");
          tag.textContent = r.ok ? ("🟢 " + (r.status != null ? "HTTP " + r.status : "可达")) : ("🔴 " + (r.err || "不可达"));
        }
      });
    });
  }
  function bindMcpRemove() {
    $$("#mcpList .mcp-item button").forEach((b) => {
      if (b.dataset.bound) return; b.dataset.bound = "1";
      b.addEventListener("click", () => {
        const i = parseInt(b.dataset.mi, 10);
        state.apis.mcp.splice(i, 1); saveApis(); $("#mcpList").innerHTML = renderMcpList(); bindMcpRemove();
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    try {
      init();
    } catch (e) {
      console.error("初始化异常，已跳过以保证界面可用:", e);
    } finally {
      finishSplash();   // 兜底：无论初始化是否成功都淡出开启界面，绝不白屏
    }
  });
})();
