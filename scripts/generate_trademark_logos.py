#!/usr/bin/env python3
"""
PR#21 — Trademark logo generator (KIPO 출원용)
Generates high-resolution PNG and SVG variants of the Life Portfolio logo
suitable for Korean Intellectual Property Office (KIPO) trademark filing.

Outputs (assets/trademark/):
  Color square mark (square-emblem style):
    - lifeportfolio-mark-color.svg
    - lifeportfolio-mark-color-512.png
    - lifeportfolio-mark-color-1024.png
    - lifeportfolio-mark-color-2048.png
    - lifeportfolio-mark-color-4096.png   <- KIPO submission master (≥800px required)
  Black & white mark (KIPO requires both color & B/W):
    - lifeportfolio-mark-bw.svg
    - lifeportfolio-mark-bw-2048.png
  Wordmark (Korean + English, horizontal):
    - lifeportfolio-wordmark-ko.svg / .png (2048×~512)
    - lifeportfolio-wordmark-en.svg / .png

Brand spec (locked):
  Background: #4A6680 (slate blue)
  Border:     #C8A24A (muted gold), 4% inset
  Letter "L": #F4ECD8 (warm cream), serif (Georgia stack)
  Dot accent: #C8A24A circle, top-right of L
"""
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT  = ROOT / "assets" / "trademark"
OUT.mkdir(parents=True, exist_ok=True)

# ---------- Brand colors ----------
BG       = "#4A6680"   # slate blue (matches mobile app icon screenshot)
BORDER   = "#C8A24A"   # muted gold
LETTER   = "#F4ECD8"   # warm cream
ACCENT   = "#C8A24A"   # gold dot
INK      = "#1A1A1A"   # near-black for B/W version
WHITE    = "#FFFFFF"

# ---------- 1) Color mark SVG (1024x1024 viewBox) ----------
mark_color_svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" role="img" aria-label="Life Portfolio mark">
  <title>Life Portfolio — Trademark mark (color)</title>
  <!-- Background square -->
  <rect x="0" y="0" width="1024" height="1024" rx="0" ry="0" fill="{BG}"/>
  <!-- Inner gold border (4% inset) -->
  <rect x="48" y="48" width="928" height="928" rx="0" ry="0"
        fill="none" stroke="{BORDER}" stroke-width="14"/>
  <!-- Letter L (capital, serif) -->
  <text x="396" y="760" font-family="Georgia, 'Times New Roman', 'Noto Serif KR', serif"
        font-size="700" font-weight="700" fill="{LETTER}"
        text-anchor="middle" letter-spacing="-8">L</text>
  <!-- Dot accent (top-right of the L stem) -->
  <circle cx="660" cy="370" r="46" fill="{ACCENT}"/>
</svg>
'''
(OUT / "lifeportfolio-mark-color.svg").write_text(mark_color_svg, encoding="utf-8")

# ---------- 2) B/W mark SVG ----------
mark_bw_svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" role="img" aria-label="Life Portfolio mark — monochrome">
  <title>Life Portfolio — Trademark mark (black &amp; white)</title>
  <rect x="0" y="0" width="1024" height="1024" fill="{INK}"/>
  <rect x="48" y="48" width="928" height="928" fill="none" stroke="{WHITE}" stroke-width="14"/>
  <text x="396" y="760" font-family="Georgia, 'Times New Roman', 'Noto Serif KR', serif"
        font-size="700" font-weight="700" fill="{WHITE}"
        text-anchor="middle" letter-spacing="-8">L</text>
  <circle cx="660" cy="370" r="46" fill="{WHITE}"/>
</svg>
'''
(OUT / "lifeportfolio-mark-bw.svg").write_text(mark_bw_svg, encoding="utf-8")

# ---------- 3) Wordmark SVG (Korean) ----------
wordmark_ko_svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 512" role="img" aria-label="인생포트폴리오 wordmark">
  <title>인생포트폴리오 — Wordmark (Korean)</title>
  <rect x="0" y="0" width="2048" height="512" fill="{WHITE}"/>
  <!-- Mark on the left -->
  <g transform="translate(48,48) scale(0.405)">
    <rect x="0" y="0" width="1024" height="1024" fill="{BG}"/>
    <rect x="48" y="48" width="928" height="928" fill="none" stroke="{BORDER}" stroke-width="14"/>
    <text x="396" y="760" font-family="Georgia, 'Times New Roman', 'Noto Serif KR', serif"
          font-size="700" font-weight="700" fill="{LETTER}" text-anchor="middle" letter-spacing="-8">L</text>
    <circle cx="660" cy="370" r="46" fill="{ACCENT}"/>
  </g>
  <!-- Wordmark text -->
  <text x="510" y="305" font-family="'Noto Sans KR','Pretendard','Apple SD Gothic Neo',sans-serif"
        font-size="170" font-weight="800" fill="{INK}" letter-spacing="-4">인생포트폴리오</text>
  <text x="510" y="395" font-family="'Inter','Helvetica Neue',Arial,sans-serif"
        font-size="60" font-weight="600" fill="#5C6773" letter-spacing="2">LIFE PORTFOLIO</text>
</svg>
'''
(OUT / "lifeportfolio-wordmark-ko.svg").write_text(wordmark_ko_svg, encoding="utf-8")

# ---------- 4) Wordmark SVG (English) ----------
wordmark_en_svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 512" role="img" aria-label="Life Portfolio wordmark">
  <title>Life Portfolio — Wordmark (English)</title>
  <rect x="0" y="0" width="2048" height="512" fill="{WHITE}"/>
  <g transform="translate(48,48) scale(0.405)">
    <rect x="0" y="0" width="1024" height="1024" fill="{BG}"/>
    <rect x="48" y="48" width="928" height="928" fill="none" stroke="{BORDER}" stroke-width="14"/>
    <text x="396" y="760" font-family="Georgia, 'Times New Roman','Noto Serif KR',serif"
          font-size="700" font-weight="700" fill="{LETTER}" text-anchor="middle" letter-spacing="-8">L</text>
    <circle cx="660" cy="370" r="46" fill="{ACCENT}"/>
  </g>
  <text x="510" y="305" font-family="Georgia, 'Times New Roman', serif"
        font-size="170" font-weight="700" fill="{INK}" letter-spacing="-4">Life Portfolio</text>
  <text x="510" y="395" font-family="'Inter','Helvetica Neue',Arial,sans-serif"
        font-size="56" font-weight="500" fill="#5C6773" letter-spacing="3">DISCOVER · LIVE · LEAVE</text>
</svg>
'''
(OUT / "lifeportfolio-wordmark-en.svg").write_text(wordmark_en_svg, encoding="utf-8")

# ---------- PNG export via Pillow rasterisation ----------
# Pillow can't render SVG directly. We build the color/B-W square mark as raster
# at 4096×4096 and downsample for the other sizes (highest fidelity for KIPO).
from PIL import Image, ImageDraw, ImageFont

def find_font(candidates, size):
    """Return an ImageFont, falling back through a list of system font candidates."""
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()

# Common font candidates available on Linux sandboxes
SERIF_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSerifBold.ttf",
]

def render_mark(size, fg_bg, fg_border, fg_letter, fg_accent, out_path):
    """Render the square-emblem mark as a PNG of `size`×`size` pixels."""
    img = Image.new("RGB", (size, size), fg_bg)
    d = ImageDraw.Draw(img)
    # gold border (inset 4.7%)
    inset = int(size * 0.047)
    border_w = max(2, int(size * 0.0137))
    # Pillow >=9 supports rectangle outline width
    d.rectangle(
        [inset, inset, size - inset - 1, size - inset - 1],
        outline=fg_border, width=border_w,
    )
    # Letter "L"
    letter_size = int(size * 0.68)
    font = find_font(SERIF_CANDIDATES, letter_size)
    # Vertically centered, slightly left of center to leave room for dot
    bbox = d.textbbox((0, 0), "L", font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    lx = int(size * 0.39) - tw // 2 - bbox[0]
    ly = int(size * 0.74) - th - bbox[1]
    d.text((lx, ly), "L", fill=fg_letter, font=font)
    # Dot accent — top-right of letter
    cx = int(size * 0.645)
    cy = int(size * 0.36)
    r  = int(size * 0.045)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=fg_accent)
    img.save(out_path, "PNG", optimize=True)
    return out_path

# Color PNG set
sizes = [512, 1024, 2048, 4096]
for s in sizes:
    out = OUT / f"lifeportfolio-mark-color-{s}.png"
    render_mark(s, BG, BORDER, LETTER, ACCENT, out)
    print(f"  ✔ {out.name} ({s}×{s})")

# B/W PNG (2048 master)
render_mark(2048, INK, WHITE, WHITE, WHITE, OUT / "lifeportfolio-mark-bw-2048.png")
print(f"  ✔ lifeportfolio-mark-bw-2048.png (2048×2048)")
# White-on-black inverse for darkmode previews
render_mark(2048, WHITE, INK, INK, INK, OUT / "lifeportfolio-mark-bw-inverse-2048.png")
print(f"  ✔ lifeportfolio-mark-bw-inverse-2048.png (2048×2048)")

# Wordmark PNG (KO + EN) at 2048x512 by re-using mark + drawing text
def render_wordmark(text_top, text_bottom, out_path, top_font=None, bottom_font=None):
    W, H = 2048, 512
    img = Image.new("RGB", (W, H), WHITE)
    d = ImageDraw.Draw(img)
    # Mark on left (~410×410, padding 48)
    mark_size = 416
    pad = 48
    mark = Image.new("RGB", (mark_size, mark_size), BG)
    md = ImageDraw.Draw(mark)
    inset = int(mark_size * 0.047)
    md.rectangle(
        [inset, inset, mark_size - inset - 1, mark_size - inset - 1],
        outline=BORDER, width=max(2, int(mark_size * 0.0137)),
    )
    letter_size = int(mark_size * 0.68)
    f_letter = find_font(SERIF_CANDIDATES, letter_size)
    bbox = md.textbbox((0, 0), "L", font=f_letter)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    md.text(
        (int(mark_size * 0.39) - tw // 2 - bbox[0],
         int(mark_size * 0.74) - th - bbox[1]),
        "L", fill=LETTER, font=f_letter,
    )
    cx = int(mark_size * 0.645); cy = int(mark_size * 0.36); r = int(mark_size * 0.045)
    md.ellipse([cx - r, cy - r, cx + r, cy + r], fill=ACCENT)
    img.paste(mark, (pad, pad))
    # Text
    f_top = top_font or find_font(SERIF_CANDIDATES, 170)
    f_bot = bottom_font or find_font(SERIF_CANDIDATES, 56)
    text_x = pad + mark_size + 50
    d.text((text_x, 110), text_top,    fill=INK,       font=f_top)
    d.text((text_x, 320), text_bottom, fill="#5C6773", font=f_bot)
    img.save(out_path, "PNG", optimize=True)

render_wordmark("Life Portfolio", "DISCOVER · LIVE · LEAVE",
                OUT / "lifeportfolio-wordmark-en-2048.png")
print(f"  ✔ lifeportfolio-wordmark-en-2048.png (2048×512)")

# For Korean we keep the Latin fallback if no Korean font installed; spec note
# in README documents this so the SVG is the authoritative Korean wordmark.
render_wordmark("Insaeng Portfolio", "LIFE PORTFOLIO",
                OUT / "lifeportfolio-wordmark-ko-fallback-2048.png")
print(f"  ✔ lifeportfolio-wordmark-ko-fallback-2048.png (2048×512)  [Romanised — for proof-of-use only]")
print("  ℹ  For Korean wordmark, use lifeportfolio-wordmark-ko.svg (vector) and rasterize via Inkscape/Figma.")

print("\nAll trademark assets generated under assets/trademark/")
