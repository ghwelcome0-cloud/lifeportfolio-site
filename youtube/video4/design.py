# -*- coding: utf-8 -*-
"""등급 A 고급 디자인 시스템 공통 모듈.
- 비네팅 + 깊이감 배경 (그라데이션 + 골드 글로우 + 미세 텍스처)
- 드롭섀도우 텍스트 (입체감)
- 글로우 텍스트 (강조)
- 고급 카드 (그라데이션 + 그림자)
- 골드 디바이더, 코너 액센트
방송 다큐 룩을 정지 슬라이드 한계 내에서 최대치로 끌어올림."""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np
import math

W, H = 1920, 1080

# ---- 컬러 팔레트 (다큐 톤: 깊은 네이비 + 따뜻한 골드) ----
NAVY      = (33, 48, 66)      # 메인 배경 상단
NAVY_DK   = (20, 30, 43)      # 메인 배경 하단
NAVY_CARD = (44, 62, 84)      # 카드 베이스
NAVY_CARD2= (34, 49, 68)      # 카드 그라데이션 하단
GOLD      = (206, 168, 92)    # 메인 골드
GOLD_LT   = (230, 200, 130)   # 밝은 골드
GOLD_DK   = (168, 132, 64)    # 어두운 골드
WHITE     = (244, 247, 251)
GREY      = (150, 165, 182)
GREY_DK   = (110, 124, 140)

EB = "font_eb.ttf"   # ExtraBold
B  = "font_b.ttf"    # Bold
R  = "font_r.ttf"    # Regular

_font_cache = {}
def F(path, size):
    key = (path, size)
    if key not in _font_cache:
        _font_cache[key] = ImageFont.truetype(path, size)
    return _font_cache[key]

# ---------------------------------------------------------------
# 배경: 그라데이션 + 비네팅 + 골드 글로우 + 미세 텍스처
# ---------------------------------------------------------------
_bg_cache = None
def bg_base(chapter_idx=None, chapter_total=15):
    """깊이감 있는 다큐 배경. chapter_idx 주면 상단에 진행 인디케이터."""
    global _bg_cache
    if _bg_cache is None:
        # 수직 그라데이션 (numpy로 빠르게)
        top = np.array(NAVY, dtype=float)
        bot = np.array(NAVY_DK, dtype=float)
        ramp = np.linspace(0, 1, H)[:, None]
        grad = (top[None, :] * (1 - ramp) + bot[None, :] * ramp)  # (H,3)
        arr = np.repeat(grad[:, None, :], W, axis=1).astype(np.uint8)  # (H,W,3)
        img = Image.fromarray(arr, "RGB")

        # 골드 글로우 (우상단) — radial
        glow = Image.new("L", (W, H), 0)
        gd = ImageDraw.Draw(glow)
        cx, cy = int(W * 0.80), int(H * 0.12)
        for rad in range(900, 0, -12):
            a = int(70 * (1 - rad / 900) ** 1.6)
            gd.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], fill=a)
        glow = glow.filter(ImageFilter.GaussianBlur(40))
        gold_layer = Image.new("RGB", (W, H), GOLD_DK)
        img = Image.composite(Image.blend(img, gold_layer, 0.5), img, glow)

        # 좌하단 차가운 글로우 (대비)
        glow2 = Image.new("L", (W, H), 0)
        gd2 = ImageDraw.Draw(glow2)
        cx2, cy2 = int(W * 0.12), int(H * 0.92)
        for rad in range(700, 0, -12):
            a = int(40 * (1 - rad / 700) ** 1.6)
            gd2.ellipse([cx2 - rad, cy2 - rad, cx2 + rad, cy2 + rad], fill=a)
        glow2 = glow2.filter(ImageFilter.GaussianBlur(50))
        cool = Image.new("RGB", (W, H), (40, 70, 95))
        img = Image.composite(Image.blend(img, cool, 0.35), img, glow2)

        # 비네팅 (가장자리 어둡게 → 시선 중앙 집중)
        vig = Image.new("L", (W, H), 0)
        vd = ImageDraw.Draw(vig)
        margin = -180
        vd.ellipse([margin, margin, W - margin, H - margin], fill=255)
        vig = vig.filter(ImageFilter.GaussianBlur(220))
        dark = Image.new("RGB", (W, H), (8, 12, 18))
        img = Image.composite(img, dark, vig)

        # 미세 필름 그레인 (다큐 질감)
        noise = (np.random.randn(H, W, 1) * 4).astype(np.int16)
        base = np.array(img, dtype=np.int16)
        base = np.clip(base + noise, 0, 255).astype(np.uint8)
        img = Image.fromarray(base, "RGB")

        _bg_cache = img.copy()
    img = _bg_cache.copy()

    if chapter_idx is not None:
        _draw_progress(img, chapter_idx, chapter_total)
    return img

def _draw_progress(img, idx, total):
    """하단 우측 미니멀 챕터 진행 인디케이터 (다큐 스타일)."""
    d = ImageDraw.Draw(img, "RGBA")
    dot_r = 5
    gap = 22
    total_w = (total - 1) * gap
    x0 = W - 80 - total_w
    y = H - 50
    for i in range(total):
        x = x0 + i * gap
        if i == idx:
            d.ellipse([x - dot_r - 2, y - dot_r - 2, x + dot_r + 2, y + dot_r + 2], fill=GOLD)
        elif i < idx:
            d.ellipse([x - 3, y - 3, x + 3, y + 3], fill=(*GOLD_DK, 200))
        else:
            d.ellipse([x - 3, y - 3, x + 3, y + 3], fill=(255, 255, 255, 45))

# ---------------------------------------------------------------
# 텍스트: 드롭섀도우 / 글로우
# ---------------------------------------------------------------
def text_shadow(img, xy, text, font, fill, anchor="mm",
                shadow=(0, 0, 0, 130), offset=(0, 4), blur=6):
    """부드러운 드롭섀도우가 있는 텍스트."""
    # 그림자 레이어
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    sd.text((xy[0] + offset[0], xy[1] + offset[1]), text, font=font,
            fill=shadow, anchor=anchor)
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    img.paste(sh, (0, 0), sh)
    d = ImageDraw.Draw(img)
    d.text(xy, text, font=font, fill=fill, anchor=anchor)

def text_glow(img, xy, text, font, fill, anchor="mm",
              glow_color=GOLD, glow_strength=140, blur=14):
    """은은한 글로우가 있는 강조 텍스트 (골드 제목용)."""
    gl = Image.new("RGBA", img.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(gl)
    gc = (*glow_color, glow_strength)
    gd.text(xy, text, font=font, fill=gc, anchor=anchor)
    gl = gl.filter(ImageFilter.GaussianBlur(blur))
    img.paste(gl, (0, 0), gl)
    # 살짝 진한 그림자도
    text_shadow(img, xy, text, font, fill, anchor=anchor,
                shadow=(0, 0, 0, 110), offset=(0, 3), blur=5)

def wrap_shadow(img, cx, cy, lines, font, fill, lh=1.32, **kw):
    line_h = int(font.size * lh)
    total = line_h * len(lines)
    y = cy - total // 2 + line_h // 2
    for l in lines:
        text_shadow(img, (cx, y), l, font, fill, anchor="mm", **kw)
        y += line_h

def wrap_glow(img, cx, cy, lines, font, fill, lh=1.32, **kw):
    line_h = int(font.size * lh)
    total = line_h * len(lines)
    y = cy - total // 2 + line_h // 2
    for l in lines:
        text_glow(img, (cx, y), l, font, fill, anchor="mm", **kw)
        y += line_h

# ---------------------------------------------------------------
# 라벨 / 디바이더 / 카드
# ---------------------------------------------------------------
def tag(img, cx, y, text, font, fg=None, bg=GOLD):
    """골드 라벨 (그림자 포함). fg 미지정시 네이비."""
    if fg is None:
        fg = NAVY_DK
    d = ImageDraw.Draw(img)
    b = d.textbbox((0, 0), text, font=font)
    tw, th = b[2] - b[0], b[3] - b[1]
    pad_x, pad_y = 30, 18
    box = [cx - tw // 2 - pad_x, y - th // 2 - pad_y,
           cx + tw // 2 + pad_x, y + th // 2 + pad_y]
    # 그림자
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    sd.rounded_rectangle([box[0], box[1] + 6, box[2], box[3] + 6],
                         radius=16, fill=(0, 0, 0, 90))
    sh = sh.filter(ImageFilter.GaussianBlur(8))
    img.paste(sh, (0, 0), sh)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle(box, radius=16, fill=bg)
    d.text((cx, y - 1), text, font=font, fill=fg, anchor="mm")

def divider(img, cx, y, w=180):
    """중앙 골드 디바이더 (점+선)."""
    d = ImageDraw.Draw(img)
    d.line([(cx - w, y), (cx - 26, y)], fill=GOLD_DK, width=3)
    d.line([(cx + 26, y), (cx + w, y)], fill=GOLD_DK, width=3)
    d.ellipse([cx - 8, y - 8, cx + 8, y + 8], fill=GOLD)

def card(img, box, radius=28, fill_top=NAVY_CARD, fill_bot=NAVY_CARD2,
         outline=None, ow=3, shadow=True, glow_outline=False):
    """그라데이션 + 그림자 고급 카드."""
    x0, y0, x1, y1 = box
    cw, ch = int(x1 - x0), int(y1 - y0)
    # 그림자
    if shadow:
        sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
        sd = ImageDraw.Draw(sh)
        sd.rounded_rectangle([x0, y0 + 10, x1, y1 + 14], radius=radius,
                             fill=(0, 0, 0, 110))
        sh = sh.filter(ImageFilter.GaussianBlur(16))
        img.paste(sh, (0, 0), sh)
    # 카드 본체 그라데이션
    ct = np.array(fill_top, dtype=float)
    cb = np.array(fill_bot, dtype=float)
    ramp = np.linspace(0, 1, ch)[:, None]
    grad = (ct[None, :] * (1 - ramp) + cb[None, :] * ramp).astype(np.uint8)
    card_img = Image.fromarray(np.repeat(grad[:, None, :], cw, axis=1), "RGB")
    # 라운드 마스크
    mask = Image.new("L", (cw, ch), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, cw - 1, ch - 1], radius=radius, fill=255)
    img.paste(card_img, (int(x0), int(y0)), mask)
    # 외곽선
    if glow_outline:
        gl = Image.new("RGBA", img.size, (0, 0, 0, 0))
        gd = ImageDraw.Draw(gl)
        gd.rounded_rectangle(box, radius=radius, outline=(*GOLD, 120), width=ow + 4)
        gl = gl.filter(ImageFilter.GaussianBlur(6))
        img.paste(gl, (0, 0), gl)
    if outline:
        d = ImageDraw.Draw(img)
        d.rounded_rectangle(box, radius=radius, outline=outline, width=ow)

def save(img, name, q=94):
    img.save(name, quality=q)
    print("saved", name)
