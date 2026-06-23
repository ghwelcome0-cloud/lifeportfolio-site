# -*- coding: utf-8 -*-
"""9:16 세로 숏츠 디자인 시스템 (1편 등급A 룩 계승).
- 1080x1920 세로
- 깊은 네이비 + 따뜻한 골드 다큐 톤
- 모바일 가독성: 큰 텍스트, 중앙 안전구역, 상하단 여백
- 비네팅 + 골드 글로우 + 필름 그레인
주: 슬라이드는 '배경 비주얼'만 담당. 핵심 자막은 ffmpeg 번인으로 별도 합성."""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np

W, H = 1080, 1920

# ---- 컬러 (1편 동일) ----
NAVY      = (33, 48, 66)
NAVY_DK   = (20, 30, 43)
NAVY_CARD = (44, 62, 84)
NAVY_CARD2= (34, 49, 68)
GOLD      = (206, 168, 92)
GOLD_LT   = (230, 200, 130)
GOLD_DK   = (168, 132, 64)
WHITE     = (244, 247, 251)
GREY      = (150, 165, 182)
GREY_DK   = (110, 124, 140)

EB = "font_eb.ttf"
B  = "font_b.ttf"
R  = "font_r.ttf"

_font_cache = {}
def F(path, size):
    key = (path, size)
    if key not in _font_cache:
        _font_cache[key] = ImageFont.truetype(path, size)
    return _font_cache[key]

# ---------------------------------------------------------------
# 배경: 세로 그라데이션 + 비네팅 + 골드 글로우 + 그레인
# ---------------------------------------------------------------
_bg_cache = None
def bg_base():
    global _bg_cache
    if _bg_cache is None:
        top = np.array(NAVY, dtype=float)
        bot = np.array(NAVY_DK, dtype=float)
        ramp = np.linspace(0, 1, H)[:, None]
        grad = (top[None, :] * (1 - ramp) + bot[None, :] * ramp)
        arr = np.repeat(grad[:, None, :], W, axis=1).astype(np.uint8)
        img = Image.fromarray(arr, "RGB")

        # 골드 글로우 (상단 중앙) — 시선을 위→아래로
        glow = Image.new("L", (W, H), 0)
        gd = ImageDraw.Draw(glow)
        cx, cy = int(W * 0.5), int(H * 0.18)
        for rad in range(1000, 0, -14):
            a = int(60 * (1 - rad / 1000) ** 1.6)
            gd.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], fill=a)
        glow = glow.filter(ImageFilter.GaussianBlur(50))
        gold_layer = Image.new("RGB", (W, H), GOLD_DK)
        img = Image.composite(Image.blend(img, gold_layer, 0.5), img, glow)

        # 좌하단 차가운 글로우 (대비)
        glow2 = Image.new("L", (W, H), 0)
        gd2 = ImageDraw.Draw(glow2)
        cx2, cy2 = int(W * 0.15), int(H * 0.88)
        for rad in range(800, 0, -14):
            a = int(36 * (1 - rad / 800) ** 1.6)
            gd2.ellipse([cx2 - rad, cy2 - rad, cx2 + rad, cy2 + rad], fill=a)
        glow2 = glow2.filter(ImageFilter.GaussianBlur(60))
        cool = Image.new("RGB", (W, H), (40, 70, 95))
        img = Image.composite(Image.blend(img, cool, 0.32), img, glow2)

        # 비네팅
        vig = Image.new("L", (W, H), 0)
        vd = ImageDraw.Draw(vig)
        m = -260
        vd.ellipse([m, m, W - m, H - m], fill=255)
        vig = vig.filter(ImageFilter.GaussianBlur(260))
        dark = Image.new("RGB", (W, H), (8, 12, 18))
        img = Image.composite(img, dark, vig)

        # 필름 그레인
        noise = (np.random.randn(H, W, 1) * 4).astype(np.int16)
        base = np.array(img, dtype=np.int16)
        base = np.clip(base + noise, 0, 255).astype(np.uint8)
        img = Image.fromarray(base, "RGB")
        _bg_cache = img.copy()
    return _bg_cache.copy()

# ---------------------------------------------------------------
# 텍스트 헬퍼
# ---------------------------------------------------------------
def text_shadow(img, xy, text, font, fill, anchor="mm",
                shadow=(0, 0, 0, 150), offset=(0, 5), blur=8):
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    sd.text((xy[0] + offset[0], xy[1] + offset[1]), text, font=font,
            fill=shadow, anchor=anchor)
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    img.paste(sh, (0, 0), sh)
    d = ImageDraw.Draw(img)
    d.text(xy, text, font=font, fill=fill, anchor=anchor)

def text_glow(img, xy, text, font, fill, anchor="mm",
              glow_color=GOLD, glow_strength=150, blur=18):
    gl = Image.new("RGBA", img.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(gl)
    gd.text(xy, text, font=font, fill=(*glow_color, glow_strength), anchor=anchor)
    gl = gl.filter(ImageFilter.GaussianBlur(blur))
    img.paste(gl, (0, 0), gl)
    text_shadow(img, xy, text, font, fill, anchor=anchor,
                shadow=(0, 0, 0, 120), offset=(0, 4), blur=6)

def wrap_shadow(img, cx, cy, lines, font, fill, lh=1.30, **kw):
    line_h = int(font.size * lh)
    total = line_h * len(lines)
    y = cy - total // 2 + line_h // 2
    for l in lines:
        text_shadow(img, (cx, y), l, font, fill, anchor="mm", **kw)
        y += line_h

def wrap_glow(img, cx, cy, lines, font, fill, lh=1.30, **kw):
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
    if fg is None:
        fg = NAVY_DK
    d = ImageDraw.Draw(img)
    b = d.textbbox((0, 0), text, font=font)
    tw, th = b[2] - b[0], b[3] - b[1]
    pad_x, pad_y = 36, 22
    box = [cx - tw // 2 - pad_x, y - th // 2 - pad_y,
           cx + tw // 2 + pad_x, y + th // 2 + pad_y]
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    sd.rounded_rectangle([box[0], box[1] + 7, box[2], box[3] + 7],
                         radius=20, fill=(0, 0, 0, 100))
    sh = sh.filter(ImageFilter.GaussianBlur(9))
    img.paste(sh, (0, 0), sh)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle(box, radius=20, fill=bg)
    d.text((cx, y - 1), text, font=font, fill=fg, anchor="mm")

def divider(img, cx, y, w=200):
    d = ImageDraw.Draw(img)
    d.line([(cx - w, y), (cx - 30, y)], fill=GOLD_DK, width=4)
    d.line([(cx + 30, y), (cx + w, y)], fill=GOLD_DK, width=4)
    d.ellipse([cx - 10, y - 10, cx + 10, y + 10], fill=GOLD)

def card(img, box, radius=34, fill_top=NAVY_CARD, fill_bot=NAVY_CARD2,
         outline=None, ow=3, shadow=True, glow_outline=False):
    x0, y0, x1, y1 = box
    cw, ch = int(x1 - x0), int(y1 - y0)
    if shadow:
        sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
        sd = ImageDraw.Draw(sh)
        sd.rounded_rectangle([x0, y0 + 12, x1, y1 + 16], radius=radius,
                             fill=(0, 0, 0, 120))
        sh = sh.filter(ImageFilter.GaussianBlur(18))
        img.paste(sh, (0, 0), sh)
    ct = np.array(fill_top, dtype=float)
    cb = np.array(fill_bot, dtype=float)
    ramp = np.linspace(0, 1, ch)[:, None]
    grad = (ct[None, :] * (1 - ramp) + cb[None, :] * ramp).astype(np.uint8)
    card_img = Image.fromarray(np.repeat(grad[:, None, :], cw, axis=1), "RGB")
    mask = Image.new("L", (cw, ch), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, cw - 1, ch - 1], radius=radius, fill=255)
    img.paste(card_img, (int(x0), int(y0)), mask)
    if glow_outline:
        gl = Image.new("RGBA", img.size, (0, 0, 0, 0))
        gd = ImageDraw.Draw(gl)
        gd.rounded_rectangle(box, radius=radius, outline=(*GOLD, 130), width=ow + 5)
        gl = gl.filter(ImageFilter.GaussianBlur(7))
        img.paste(gl, (0, 0), gl)
    if outline:
        d = ImageDraw.Draw(img)
        d.rounded_rectangle(box, radius=radius, outline=outline, width=ow)

def brand(img):
    """상단 채널 브랜드 마크 (작게)."""
    d = ImageDraw.Draw(img)
    text_shadow(img, (W // 2, 150), "인생 자산화", F(B, 40), GOLD_LT,
                anchor="mm", shadow=(0, 0, 0, 120), offset=(0, 3), blur=5)

def save(img, name, q=95):
    img.save(name, quality=q)
    print("saved", name)
