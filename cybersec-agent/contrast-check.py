#!/usr/bin/env python3
# 兼容壳：对比度检查的唯一实现已移到 verify-contrast.js。
#
# 为什么保留这个文件名：DESIGN-SPEC.md / UI-EVOLUTION-PLAN.md / UI-REFINE-PLAN.md 都引用了
# `cybersec-agent/contrast-check.py`。而**不能有两份实现** —— 旧版 Python 脚本把颜色硬编码在
# 脚本内，改了 styles.css 的令牌它不会察觉（检查器与真实样式漂移）。实测它因此漏掉了
# 「浅色 --border 对 bg 仅 2.92:1、低于控件边界 3:1 要求」这个问题；Node 版从 styles.css
# 实解析令牌后立刻暴露出来。现在唯一实现是 verify-contrast.js（已接入 npm test），本文件只转发。
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
JS = os.path.join(HERE, "verify-contrast.js")
if not os.path.exists(JS):
    print("找不到 verify-contrast.js（它是唯一实现）", file=sys.stderr)
    sys.exit(1)
print("[contrast-check.py 已转发到 verify-contrast.js —— 颜色从 styles.css 实解析]", file=sys.stderr)
sys.exit(subprocess.call(["node", JS] + sys.argv[1:]))
