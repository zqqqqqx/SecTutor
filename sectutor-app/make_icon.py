#!/usr/bin/env python3
# 生成 SecTutor 应用图标：盾牌 + 锁，蓝色圆角底，透明背景。
# 输出 assets/icon.png (512) 与 assets/icon.ico (多尺寸，供窗口/托盘/安装包)。
import os
from PIL import Image, ImageDraw

S = 512
img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# 圆角方形底（主蓝）
d.rounded_rectangle([0, 0, S, S], radius=110, fill=(15, 86, 184, 255))
d.rounded_rectangle([6, 6, S - 6, S - 6], radius=104, outline=(150, 200, 255, 90), width=4)

# 盾牌（白边 + 浅蓝填充）
cx = S / 2
top = 150
w = 150
shield = [
    (cx, top),
    (cx + w, top + 28),
    (cx + w, top + 150),
    (cx, top + 250),
    (cx - w, top + 150),
    (cx - w, top + 28),
]
d.polygon(shield, fill=(225, 240, 255, 255), outline=(255, 255, 255, 255), width=16)

# 锁：拱形 + 锁体 + 锁孔
lx, ly = cx - 46, top + 92
d.rounded_rectangle([lx, ly + 32, lx + 92, ly + 100], radius=12, fill=(15, 86, 184, 255))
d.arc([lx + 16, ly - 16, lx + 76, ly + 48], start=180, end=360, fill=(15, 86, 184, 255), width=14)
d.ellipse([cx - 11, ly + 14, cx + 11, ly + 44], fill=(170, 210, 255, 255))
d.rectangle([cx - 7, ly + 40, cx + 7, ly + 72], fill=(170, 210, 255, 255))

os.makedirs('assets', exist_ok=True)
img.save('assets/icon.png')
img.save('assets/icon.ico', sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print('icon written: assets/icon.png + assets/icon.ico')
