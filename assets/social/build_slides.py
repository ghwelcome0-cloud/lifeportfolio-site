#!/usr/bin/env python3
"""
Build 4 Instagram square slides (1080x1080) for the B2B launch announcement.

Background images: assets/social/raw/slide{1..4}_bg.png (2048x2048 each)
Output:            assets/social/out/slide{1..4}.png (1080x1080)
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parent
RAW = ROOT / "raw"
OUT = ROOT / "out"
OUT.mkdir(parents=True, exist_ok=True)

# Fonts - Noto Sans CJK supports Korean perfectly
FONT_BLACK = "/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc"
FONT_BOLD = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
FONT_MED = "/usr/share/fonts/opentype/noto/NotoSansCJK-Medium.ttc"
FONT_REG = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"

# Target Instagram square size
W, H = 1080, 1080

# Brand colors
NAVY = (15, 42, 68)             # #0F2A44 - dark text
NAVY_DEEP = (10, 30, 55)        # slightly deeper for accents
WHITE = (255, 255, 255)
CREAM = (250, 246, 235)
GOLD = (253, 195, 0)            # warm accent gold
GOLD_SOFT = (212, 161, 35)      # darker gold on light bg
ACCENT_BLUE = (37, 99, 235)     # #2563EB - CTA button


def load_bg(slide_num):
    """Load a background image and resize to 1080x1080."""
    src = Image.open(RAW / f"slide{slide_num}_bg.png").convert("RGB")
    src = src.resize((W, H), Image.LANCZOS)
    return src


def font(size, weight="bold"):
    path = {
        "black": FONT_BLACK,
        "bold": FONT_BOLD,
        "medium": FONT_MED,
        "regular": FONT_REG,
    }[weight]
    # Use index 1 for Korean glyphs in the TTC
    return ImageFont.truetype(path, size, index=1)


def add_gradient_overlay(img, side="left", strength=0.55):
    """Darken one side with a smooth gradient for legibility."""
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    max_alpha = int(255 * strength)
    if side == "left":
        for x in range(W):
            t = max(0, 1 - x / (W * 0.7))
            a = int(max_alpha * t)
            draw.line([(x, 0), (x, H)], fill=(0, 0, 0, a))
    elif side == "right":
        for x in range(W):
            t = max(0, (x - W * 0.3) / (W * 0.7))
            a = int(max_alpha * t)
            draw.line([(x, 0), (x, H)], fill=(0, 0, 0, a))
    elif side == "top":
        for y in range(H):
            t = max(0, 1 - y / (H * 0.55))
            a = int(max_alpha * t)
            draw.line([(0, y), (W, y)], fill=(0, 0, 0, a))
    elif side == "lighten_top":
        # White overlay on top for dark text on bright bg
        for y in range(H):
            t = max(0, 1 - y / (H * 0.5))
            a = int(180 * t)
            draw.line([(0, y), (W, y)], fill=(255, 248, 235, a))
    return Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")


def draw_multiline(draw, lines, font_obj, x, y, color, line_height_mult=1.18, align="left"):
    """Draw multi-line text and return bottom y. anchor='lt'."""
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font_obj)
        line_w = bbox[2] - bbox[0]
        line_h = bbox[3] - bbox[1]
        if align == "center":
            draw_x = x - line_w // 2
        elif align == "right":
            draw_x = x - line_w
        else:
            draw_x = x
        draw.text((draw_x, y), line, font=font_obj, fill=color)
        y += int(font_obj.size * line_height_mult)
    return y


def draw_with_shadow(draw, lines, font_obj, x, y, color, line_height_mult=1.18, align="left", shadow=None):
    """Draw text with optional drop shadow."""
    if shadow:
        sx, sy, scolor, sblur = shadow
        # We can't blur with ImageDraw alone; emulate with offset shadow only
        shadow_lines_y = y
        for line in lines:
            bbox = draw.textbbox((0, 0), line, font=font_obj)
            line_w = bbox[2] - bbox[0]
            if align == "center":
                dx = x - line_w // 2
            elif align == "right":
                dx = x - line_w
            else:
                dx = x
            draw.text((dx + sx, shadow_lines_y + sy), line, font=font_obj, fill=scolor)
            shadow_lines_y += int(font_obj.size * line_height_mult)
    return draw_multiline(draw, lines, font_obj, x, y, color, line_height_mult, align)


def add_watermark(draw, color=(255, 255, 255, 180)):
    """Bottom-right tiny watermark."""
    f = font(20, "medium")
    txt = "lifeportfolio.co.kr/b2b"
    bbox = draw.textbbox((0, 0), txt, font=f)
    w = bbox[2] - bbox[0]
    draw.text((W - w - 32, H - 44), txt, font=f, fill=color)


def add_brand_mark(draw, color=NAVY, opacity_color=None):
    """Top-left tiny brand mark."""
    f_brand = font(22, "black")
    f_sub = font(13, "medium")
    if opacity_color is not None:
        color = opacity_color
    draw.text((40, 36), "인생포트폴리오.", font=f_brand, fill=color)
    sub_color = color if len(color) == 4 else (*color, 200)
    draw.text((40, 70), "FOR TEAMS", font=f_sub, fill=color)


def add_page_num(draw, num, total=4, color=(255, 255, 255, 160), dark=False):
    """Tiny page indicator dots in top-right."""
    f = font(13, "bold")
    txt = f"{num} / {total}"
    bbox = draw.textbbox((0, 0), txt, font=f)
    w = bbox[2] - bbox[0]
    c = NAVY if dark else WHITE
    draw.text((W - w - 40, 40), txt, font=f, fill=c)


# =============== SLIDE 1: HOOK ===============
def build_slide_1():
    bg = load_bg(1)
    # Darken left side for white text
    bg = add_gradient_overlay(bg, side="left", strength=0.62)
    img = bg.convert("RGBA")
    draw = ImageDraw.Draw(img)

    # Top-left brand
    add_brand_mark(draw, color=WHITE)
    add_page_num(draw, 1, 4, dark=False)

    # Eyebrow pill - small accent
    f_eyebrow = font(20, "bold")
    eyebrow_txt = "  B2B 출시 안내  "
    bbox = draw.textbbox((0, 0), eyebrow_txt, font=f_eyebrow)
    pill_w = (bbox[2] - bbox[0]) + 20
    pill_h = 38
    pill_x, pill_y = 70, 290
    draw.rounded_rectangle([pill_x, pill_y, pill_x + pill_w, pill_y + pill_h], radius=20,
                           fill=(253, 195, 0, 235))
    draw.text((pill_x + 22, pill_y + 7), "B2B 출시 안내", font=f_eyebrow, fill=NAVY_DEEP)

    # Main headline - very large
    f_hook_big = font(105, "black")
    f_hook_small = font(58, "black")

    # Line 1 small: 당신은
    draw.text((70, 360), "당신은", font=f_hook_small, fill=WHITE)
    # Line 2 big: 의미대로
    draw.text((70, 445), "의미대로", font=f_hook_big, fill=GOLD)
    # Line 3 big: 살고 있나요?
    draw.text((70, 575), "살고 있나요?", font=f_hook_big, fill=WHITE)

    # Subtitle
    f_sub = font(26, "medium")
    draw.text((70, 740), "인생포트폴리오 for Teams", font=f_sub, fill=(255, 255, 255, 230))
    f_subsub = font(22, "regular")
    draw.text((70, 778), "2026 출시 — 조직 단위 사명·비전 발견 라이선스",
              font=f_subsub, fill=(255, 255, 255, 200))

    # Tiny watermark
    add_watermark(draw)

    img.convert("RGB").save(OUT / "slide1.png", "PNG", optimize=True)
    print(f"✓ slide1.png ({(OUT / 'slide1.png').stat().st_size:,} bytes)")


# =============== SLIDE 2: PROBLEM ===============
def build_slide_2():
    bg = load_bg(2)
    # Slight whitening overlay on right where text goes, for legibility
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    # Right-side white wash for dark text
    for x in range(W):
        t = max(0, (x - W * 0.25) / (W * 0.75))
        a = int(120 * t)
        od.line([(x, 0), (x, H)], fill=(252, 248, 240, a))
    bg = Image.alpha_composite(bg.convert("RGBA"), overlay).convert("RGB")
    img = bg.convert("RGBA")
    draw = ImageDraw.Draw(img)

    add_brand_mark(draw, color=NAVY)
    add_page_num(draw, 2, 4, dark=True)

    # Top small text
    f_top = font(28, "medium")
    draw.text((490, 240), "잘하는 건 아는데,", font=f_top, fill=(60, 80, 110, 255))

    # Main statement - big & emotional (slightly smaller for safe margin)
    f_big = font(72, "black")
    draw.text((490, 295), "왜 일하는지는", font=f_big, fill=NAVY_DEEP)
    draw.text((490, 385), "대답이 안 됩니다.", font=f_big, fill=NAVY_DEEP)

    # Underline accent
    draw.rectangle([490, 495, 490 + 90, 501], fill=GOLD_SOFT)

    # Subtitle
    f_sub = font(24, "medium")
    draw.text((490, 530), "조직 안에 풀리지 않는,", font=f_sub, fill=(70, 85, 110))
    draw.text((490, 567), "가장 조용한 질문.", font=f_sub, fill=(70, 85, 110))

    # Footer brand whisper
    f_foot = font(18, "medium")
    draw.text((540, 970), "인생포트폴리오 for Teams", font=f_foot, fill=(100, 115, 140))

    add_watermark(draw, color=(80, 95, 120, 200))

    img.convert("RGB").save(OUT / "slide2.png", "PNG", optimize=True)
    print(f"✓ slide2.png ({(OUT / 'slide2.png').stat().st_size:,} bytes)")


# =============== SLIDE 3: SOLUTION ===============
def build_slide_3():
    bg = load_bg(3)
    # Lighten top third for dark text legibility
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    for y in range(H):
        t = max(0, 1 - y / (H * 0.55))
        a = int(170 * t)
        od.line([(0, y), (W, y)], fill=(252, 248, 238, a))
    bg = Image.alpha_composite(bg.convert("RGBA"), overlay).convert("RGB")
    img = bg.convert("RGBA")
    draw = ImageDraw.Draw(img)

    add_brand_mark(draw, color=NAVY)
    add_page_num(draw, 3, 4, dark=True)

    # Eyebrow
    f_eb = font(20, "bold")
    draw.text((W // 2, 175), "우리가 함께 하는 일", font=f_eb, fill=GOLD_SOFT, anchor="mt")

    # Headline - centered top
    f_h1 = font(58, "black")
    draw.text((W // 2, 220), "당신 안의 사명과 비전을", font=f_h1, fill=NAVY_DEEP, anchor="mt")
    draw.text((W // 2, 295), "함께 발견합니다.", font=f_h1, fill=NAVY_DEEP, anchor="mt")

    # Three pillars - mid section
    f_num = font(38, "black")
    f_label = font(22, "bold")
    f_desc = font(20, "bold")

    pillars = [
        ("76", "문항으로", "흩어진 나를 한 줄로"),
        ("21", "일 동안", "매일 5분, 사명·비전을 다듬어"),
        ("1", "권으로", "살아낼 수 있는 자리로"),
    ]

    # Position pillars in lower mid area
    pillar_y = 470
    col_w = W // 3
    # Pillar text color - much darker for legibility on warm background
    PILLAR_DESC = (25, 35, 55)  # near-navy black, 충분히 진함
    for i, (num, suffix, desc) in enumerate(pillars):
        cx = col_w * i + col_w // 2
        # Big number
        draw.text((cx, pillar_y), num, font=f_num, fill=GOLD_SOFT, anchor="mt")
        # Suffix
        draw.text((cx, pillar_y + 55), suffix, font=f_label, fill=NAVY_DEEP, anchor="mt")
        # Description with subtle white pill behind for legibility
        desc_bbox = draw.textbbox((0, 0), desc, font=f_desc)
        desc_w = desc_bbox[2] - desc_bbox[0]
        desc_h = desc_bbox[3] - desc_bbox[1]
        pill_pad_x = 14
        pill_pad_y = 8
        desc_y = pillar_y + 100
        pill_box = [
            cx - desc_w // 2 - pill_pad_x,
            desc_y - pill_pad_y,
            cx + desc_w // 2 + pill_pad_x,
            desc_y + desc_h + pill_pad_y + 4,
        ]
        # Semi-opaque cream pill background for legibility on busy backdrop
        pill_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(pill_layer).rounded_rectangle(
            pill_box, radius=16, fill=(252, 248, 240, 215)
        )
        img.alpha_composite(pill_layer)
        draw = ImageDraw.Draw(img)
        draw.text((cx, desc_y), desc, font=f_desc, fill=PILLAR_DESC, anchor="mt")

    # Bottom small text - darker for legibility
    f_foot = font(19, "bold")
    draw.text((W // 2, 990), "조직 단위로 운영하는 사명·비전 발견 라이선스",
              font=f_foot, fill=(40, 55, 85), anchor="mt")

    add_watermark(draw, color=(80, 95, 120, 200))

    img.convert("RGB").save(OUT / "slide3.png", "PNG", optimize=True)
    print(f"✓ slide3.png ({(OUT / 'slide3.png').stat().st_size:,} bytes)")


# =============== SLIDE 4: CTA ===============
def build_slide_4():
    bg = load_bg(4)
    # Lighten top half for legibility
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    for y in range(H):
        t = max(0, 1 - y / (H * 0.5))
        a = int(165 * t)
        od.line([(0, y), (W, y)], fill=(252, 248, 240, a))
    bg = Image.alpha_composite(bg.convert("RGBA"), overlay).convert("RGB")
    img = bg.convert("RGBA")
    draw = ImageDraw.Draw(img)

    add_brand_mark(draw, color=NAVY)
    add_page_num(draw, 4, 4, dark=True)

    # Top quote-style intro - darker for legibility
    f_intro = font(22, "bold")
    draw.text((W // 2, 165), "발견이 살아낸 삶이 되어,", font=f_intro, fill=(45, 60, 90), anchor="mt")
    draw.text((W // 2, 200), "누군가의 든든한 양식으로 남는 자리.", font=f_intro, fill=(45, 60, 90), anchor="mt")

    # Big statement
    f_big = font(82, "black")
    draw.text((W // 2, 265), "조직에서, 함께.", font=f_big, fill=NAVY_DEEP, anchor="mt")

    # Accent line under
    draw.rectangle([W // 2 - 45, 370, W // 2 + 45, 376], fill=GOLD_SOFT)

    # CTA box (bottom) — 가격 강조 제거, 자산·시너지 톤으로 재구성
    box_x1, box_y1 = 80, 800
    box_x2, box_y2 = W - 80, 980
    draw.rounded_rectangle([box_x1, box_y1, box_x2, box_y2], radius=24,
                           fill=NAVY_DEEP)

    f_cta_hd = font(26, "black")
    f_cta_sub = font(19, "medium")
    f_cta_url = font(22, "bold")

    draw.text((W // 2, box_y1 + 26), "개인에게는 살아낼 자기 자신을,",
              font=f_cta_hd, fill=WHITE, anchor="mt")
    draw.text((W // 2, box_y1 + 62), "조직에게는 함께 키워갈 자산을.",
              font=f_cta_hd, fill=GOLD, anchor="mt")

    # URL pill
    url_y = box_y1 + 120
    url_txt = "lifeportfolio.co.kr/b2b"
    bbox = draw.textbbox((0, 0), url_txt, font=f_cta_url)
    url_w = bbox[2] - bbox[0]
    pill_pad = 24
    pill_x1 = W // 2 - (url_w // 2 + pill_pad)
    pill_x2 = W // 2 + (url_w // 2 + pill_pad)
    draw.rounded_rectangle([pill_x1, url_y - 6, pill_x2, url_y + 38], radius=22,
                           fill=GOLD)
    draw.text((W // 2, url_y), url_txt, font=f_cta_url, fill=NAVY_DEEP, anchor="mt")

    img.convert("RGB").save(OUT / "slide4.png", "PNG", optimize=True)
    print(f"✓ slide4.png ({(OUT / 'slide4.png').stat().st_size:,} bytes)")


if __name__ == "__main__":
    build_slide_1()
    build_slide_2()
    build_slide_3()
    build_slide_4()
    print("\nAll 4 slides built in:", OUT)
