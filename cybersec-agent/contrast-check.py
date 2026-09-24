#!/usr/bin/env python3
# U2a 色板对比度实算：候选组合逐个算 WCAG 对比度，挑到全部达标为止

def srgb(c):
    c = c / 255
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

def lum(hexc):
    h = hexc.lstrip("#")
    r, g, b = (int(h[i:i+2], 16) for i in (0, 2, 4))
    return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b)

def ratio(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)

def blend(fg_hex, alpha, bg_hex):
    """把半透明前景压到背景上，得到有效颜色"""
    h = fg_hex.lstrip("#"); b = bg_hex.lstrip("#")
    out = []
    for i in (0, 2, 4):
        f = int(h[i:i+2], 16); bgc = int(b[i:i+2], 16)
        out.append(round(f * alpha + bgc * (1 - alpha)))
    return "#%02x%02x%02x" % tuple(out)

def info(title, pairs, need=1.2, note=""):
    print("\n== " + title + " ==")
    if note:
        print("  " + note)
    for name, fg, bg in pairs:
        r = ratio(fg, bg)
        ok = "ℹ️" if r >= need else "❌"
        print(f"  {ok} {name:<38} {fg} on {bg} = {r:.2f}")

def show3(title, pairs, need=3.0, note=""):
    """非文本要求：焦点指示器/控件边界按 WCAG 2.4.13 / 1.4.11 需 ≥3:1"""
    print("\n== " + title + " ==")
    if note:
        print("  " + note)
    for name, fg, bg in pairs:
        r = ratio(fg, bg)
        ok = "✅" if r >= need else "❌"
        print(f"  {ok} {name:<38} {fg} on {bg} = {r:.2f}  (需≥{need}:1)")

def show(title, pairs):
    print("\n== " + title + " ==")
    for name, fg, bg in pairs:
        r = ratio(fg, bg)
        need = "AA正文4.5" 
        ok = "✅" if r >= 4.5 else ("⚠️3.0(大字/控件)" if r >= 3.0 else "❌")
        print(f"  {ok} {name:<34} {fg} on {bg} = {r:.2f}  ({need})")

# ---------- 浅色主题 ----------
L_BG = "#eaeff0"
L_PANEL = blend("#ffffff", 0.72, L_BG)   # 玻璃卡片的实际观感色
L_PANEL2 = "#ffffff"
show("浅色", [
    ("正文 ink on bg",              "#10201f", L_BG),
    ("次要 muted on bg",            "#5b6f6c", L_BG),
    ("次要 muted on panel(玻璃)",    "#5b6f6c", L_PANEL),
    ("次要 muted on panel2(白)",     "#5b6f6c", L_PANEL2),
    ("白字 on 主色按钮 #0b7a71",     "#ffffff", "#0b7a71"),
    ("白字 on 主色按钮 #0d9488",     "#ffffff", "#0d9488"),
    ("链接/强调 #0e7490 on bg",      "#0e7490", L_BG),
    ("链接/强调 #0e7490 on panel",   "#0e7490", L_PANEL),
    ("成功 #15803d on panel",        "#15803d", L_PANEL),
    ("警告 #a4530a on panel",        "#a4530a", L_PANEL),
    ("危险 #c2262a on panel",        "#c2262a", L_PANEL),
])

# ---------- 深色主题 ----------
D_BG = "#071110"
D_PANEL = blend("#132320", 0.72, D_BG)
D_PANEL2 = "#0d1a19"
show("深色", [
    ("正文 ink on bg",              "#dcedea", D_BG),
    ("正文 ink on panel(玻璃)",      "#dcedea", D_PANEL),
    ("次要 muted on bg",            "#8ea8a4", D_BG),
    ("次要 muted on panel(玻璃)",    "#8ea8a4", D_PANEL),
    ("白字 on 主色 #169d90",         "#ffffff", "#169d90"),
    ("黑字 on 亮主色 #2dd4bf",       "#04120f", "#2dd4bf"),
    ("亮主色作链接 #5eead4 on bg",   "#5eead4", D_BG),
    ("亮主色作链接 #5eead4 on panel", "#5eead4", D_PANEL),
    ("强调 #7dd3fc on panel",       "#7dd3fc", D_PANEL),
    ("成功 #4ade80 on panel",       "#4ade80", D_PANEL),
    ("警告 #fbbf24 on panel",       "#fbbf24", D_PANEL),
    ("危险 #f87171 on panel",       "#f87171", D_PANEL),
])

# ---------- 焦点指示器（WCAG 2.4.13 / 1.4.11：非文本 ≥3:1）----------
# 键盘用户完全依赖它：焦点环必须与相邻背景有足够反差（此前没有被任何检查覆盖）
show3("焦点指示器（浅色）", [
    ("焦点环 --focus #0b7a71 on bg",     "#0b7a71", L_BG),
    ("焦点环 on panel(玻璃)",            "#0b7a71", L_PANEL),
    ("焦点环 on panel2(白)",             "#0b7a71", L_PANEL2),
], 3.0, "焦点可见性：键盘操作时唯一的位置线索")
show3("焦点指示器（深色）", [
    ("焦点环 --focus #2dd4bf on bg",     "#2dd4bf", D_BG),
    ("焦点环 on panel(玻璃)",            "#2dd4bf", D_PANEL),
    ("焦点环 on panel2",                 "#2dd4bf", D_PANEL2),
], 3.0, "焦点可见性：键盘操作时唯一的位置线索")

# ---------- v1.5.4/v1.5.5 新增组件的配色 ----------
L_SOFT = "#dff5f2"                                   # 浅色 --brand-soft
D_SOFT = blend("#2dd4bf", 0.12, D_PANEL)             # 深色 --brand-soft 压在面板上
show("新增组件（浅色）", [
    ("搜索高亮 mark.hl 文字",        "#10201f", L_SOFT),
    ("复制按钮 .code-copy",          "#5b6f6c", L_PANEL2),
    ("消息操作 .msg-act",            "#5b6f6c", L_PANEL2),
    ("空态标题 .sb-t",              "#10201f", L_PANEL2),
    ("空态说明 .sb-h",              "#5b6f6c", L_PANEL2),
    ("错误态文字 .error-state",      "#c2262a", "#fee2e2"),
])
show("新增组件（深色）", [
    ("搜索高亮 mark.hl 文字",        "#dcedea", D_SOFT),
    ("复制按钮 .code-copy",          "#8ea8a4", D_PANEL2),
    ("消息操作 .msg-act",            "#8ea8a4", D_PANEL2),
    ("空态标题 .sb-t",              "#dcedea", D_PANEL2),
    ("空态说明 .sb-h",              "#8ea8a4", D_PANEL2),
    ("错误态文字 .error-state",      "#f87171", blend("#f87171", 0.12, D_PANEL)),
])

# ---------- 装饰性描边（信息级：不适用 4.5:1/3:1）----------
# 它们既非文本，也不是「识别组件所必需的边界」，只是视觉分隔线；
# 用正文阈值判会永远是 ❌ 并掩盖真问题。这里只报告「能否看出边界」。
info("装饰性描边（信息级）", [
    ("浅色 line #c6d2d1 vs bg", "#c6d2d1", L_BG),
    ("深色 line(等效 #1e2f2d) vs bg", "#1e2f2d", D_BG),
], 1.2, "分隔线：暗色主题本就刻意做得极淡（玻璃拟态），此处仅确认「可见」")
