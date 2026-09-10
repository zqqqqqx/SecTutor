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
    ("描边(line) 可见性 vs bg",       "#c6d2d1", L_BG),
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
    ("描边 rgba白 .10 / 视觉等价",    "#1e2f2d", D_BG),
])
