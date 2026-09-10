#!/usr/bin/env python3
"""主题令牌覆盖检查：找出「某个主题分支下未定义、又没写 fallback」的 CSS 变量。

为什么需要它：本项目有三套主题分支
  · 默认态  : <html> 没有 data-theme 属性 → 命中 `:root` 与 `:root:not([data-theme])`
  · 浅色态  : data-theme="light"          → 命中 `:root` 与 `[data-theme="light"]`
  · 深色态  : data-theme="dark"           → 命中 `:root` 与 `[data-theme="dark"]`
如果某个令牌只写在 data-theme 分支里，首屏默认态就会拿不到值——
形如 `.panel { background: var(--surface-1) }` 会整条失效（面板变透明），
而且肉眼排查极难，所以用脚本守。

用法：python theme-token-check.py   （退出码 0 = 无问题，1 = 有缺失）
"""
import re
import sys
import os

CSS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "styles.css")

text = open(CSS, encoding="utf-8").read()
text_nc = re.sub(r"/\*.*?\*/", "", text, flags=re.S)          # 去注释，避免注释里的 var() 干扰

# ---- 1) 拆出顶层规则块（@media 内的块也算，本项目的令牌都在顶层）----
blocks = []                                                   # (selector, body)
for sel, body in re.findall(r"([^{}]+)\{([^{}]*)\}", text_nc):
    blocks.append((sel.strip(), body))

def applies(sel, scenario):
    """该选择器是否作用于这个主题场景（只看能否命中 html 元素）"""
    for part in [p.strip() for p in sel.split(",")]:
        if part == ":root":
            return True
        if scenario == "default" and part == ":root:not([data-theme])":
            return True
        if scenario == "light" and '[data-theme="light"]' in part:
            return True
        if scenario == "dark" and ('[data-theme="dark"]' in part or part == ":root:not([data-theme])"):
            return True
    return False

def defined_tokens(scenario):
    out = set()
    for sel, body in blocks:
        if applies(sel, scenario):
            out |= set(re.findall(r"(--[\w-]+)\s*:", body))
    return out

scenarios = {"default": defined_tokens("default"),
             "light": defined_tokens("light"),
             "dark": defined_tokens("dark")}

# ---- 2) 所有不带 fallback 的 var() 引用 ----
used_no_fallback = set(re.findall(r"var\(\s*(--[\w-]+)\s*\)", text_nc))
own_defs = set(re.findall(r"(--[\w-]+)\s*:", text_nc))         # 本文件里定义过的
used_with_fallback = set(re.findall(r"var\(\s*(--[\w-]+)\s*,", text_nc))

bad = False
print("令牌总数：", len(own_defs))
for name, toks in scenarios.items():
    missing = sorted(t for t in used_no_fallback if t not in toks)
    if missing:
        bad = True
        print(f"\n[{name}] 无 fallback 却取不到值的令牌 {len(missing)} 个：")
        for t in missing:
            where = "本文件未定义" if t not in own_defs else "仅定义在其它主题分支"
            print(f"   {t:22s} {where}（该声明会整条失效，元素样式静默丢失）")
    else:
        print(f"[{name}] OK：所有无 fallback 的引用都有值")

print("\n结论：", "❌ 存在主题覆盖缺口" if bad else "✅ 三套主题分支覆盖完整")
sys.exit(1 if bad else 0)
