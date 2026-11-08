"""Génère les icônes PWA (cercle rouge + 日 blanc, comme le favicon de l'app).

Usage : python3 scripts/make-icons.py
"""
import math
import os

from PIL import Image, ImageDraw, ImageFont

FONT_PATH = "/usr/share/fonts/truetype/chinese/NotoSansSC-Regular.ttf"
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public")

CREAM = "#f6f1e6"
RED = "#c73e3a"
WHITE = "#ffffff"


def make_icon(size: int, maskable: bool) -> Image.Image:
    img = Image.new("RGB", (size, size), CREAM)
    draw = ImageDraw.Draw(img)

    if maskable:
        # fond rouge plein (zone de sécurité maskable : glyphe dans le cercle central)
        draw.rectangle([0, 0, size, size], fill=RED)
        r = size * 0.34
    else:
        r = size * 0.44

    cx = cy = size / 2
    if not maskable:
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=RED)

    font_size = int(size * (0.42 if maskable else 0.46))
    font = ImageFont.truetype(FONT_PATH, font_size)
    bbox = draw.textbbox((0, 0), "日", font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text((cx - tw / 2 - bbox[0], cy - th / 2 - bbox[1]), "日", font=font, fill=WHITE)
    return img


for size in (192, 512):
    make_icon(size, maskable=False).save(os.path.join(OUT_DIR, f"icon-{size}.png"))
    make_icon(size, maskable=True).save(os.path.join(OUT_DIR, f"icon-maskable-{size}.png"))
    print(f"icône {size}px ✓ (normale + maskable)")

print("terminé :", OUT_DIR)
