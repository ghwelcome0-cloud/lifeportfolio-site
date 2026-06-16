#!/usr/bin/env python3
# EP2 텍스트 레이어 생성 (칠판 손글씨 + 자막) — EP1 검증 함수 재사용
from PIL import Image, ImageDraw, ImageFont
import os, random

W, H = 1080, 1920
WORK = os.path.dirname(os.path.abspath(__file__)) + "/work"
os.makedirs(WORK, exist_ok=True)

CHALK = (245, 241, 232, 255)
YELLOW = (240, 192, 64, 255)
SUB_WHITE = (248, 246, 240, 255)

PEN = "/usr/share/fonts/truetype/nanum/NanumPen.ttf"
BRUSH = "/usr/share/fonts/truetype/nanum/NanumBrush.ttf"
SQUARE_B = "/usr/share/fonts/truetype/nanum/NanumSquareB.ttf"

def font(path, size):
    return ImageFont.truetype(path, size)

def text_size(draw, txt, fnt):
    b = draw.textbbox((0,0), txt, font=fnt)
    return b[2]-b[0], b[3]-b[1], b[0], b[1]

def make_chalk_layer(name, lines, fpath, size, color=CHALK, y_center=760, line_gap=1.25, jitter=True, stroke=0):
    img = Image.new("RGBA", (W, H), (0,0,0,0))
    d = ImageDraw.Draw(img)
    fnt = font(fpath, size)
    heights = []; widths = []
    for ln in lines:
        w,h,ox,oy = text_size(d, ln, fnt)
        widths.append((w,ox)); heights.append(h)
    total_h = sum(h*line_gap for h in heights)
    y = y_center - total_h/2
    random.seed(7)
    for i, ln in enumerate(lines):
        w, ox = widths[i]
        x = (W - w)/2 - ox
        jy = random.randint(-6,6) if jitter else 0
        jx = random.randint(-4,4) if jitter else 0
        d.text((x+jx, y+jy), ln, font=fnt, fill=color,
               stroke_width=stroke, stroke_fill=color)
        y += heights[i]*line_gap
    img.save(f"{WORK}/{name}.png")
    print(name, "saved")

def make_sub_layer(name, lines, size=58, color=SUB_WHITE, y_bottom=1555, hl=None):
    img = Image.new("RGBA", (W, H), (0,0,0,0))
    d = ImageDraw.Draw(img)
    fnt = font(SQUARE_B, size)
    heights=[]; widths=[]
    for ln in lines:
        w,h,ox,oy = text_size(d, ln, fnt)
        widths.append((w,ox)); heights.append((h,oy))
    line_gap = 1.4
    total_h = sum(h*line_gap for h,_ in heights)
    y = y_bottom - total_h
    for i, ln in enumerate(lines):
        w, ox = widths[i]; h, oy = heights[i]
        x = (W - w)/2 - ox
        d.text((x+3, y+3-oy), ln, font=fnt, fill=(0,0,0,180))
        c = YELLOW if (hl and ln in hl) else color
        d.text((x, y-oy), ln, font=fnt, fill=c)
        y += h*line_gap
    img.save(f"{WORK}/{name}.png")
    print(name, "saved")

# === 칠판 손글씨 레이어 (write-on 대상) ===
make_chalk_layer("ch_a", ["지난 20년", "세상은 손쉬워졌다"], PEN, 130, y_center=720)   # A
make_chalk_layer("ch_c", ["SaaS의 시대"], PEN, 160, y_center=760)                      # C
make_chalk_layer("ch_f", ["왜?"], BRUSH, 340, color=YELLOW, y_center=760)              # F
make_chalk_layer("ch_g", ["한 사람의 '왜'", "= 의미경제"], PEN, 140, color=YELLOW, y_center=720)  # G
make_chalk_layer("ch_i", ["의미 · 고유성"], PEN, 150, color=YELLOW, y_center=760)       # I

# === 자막 레이어 ===
make_sub_layer("sub_a", ["지난 20년", "세상은 손쉬워졌습니다"], 60)
make_sub_layer("sub_b", ["더 빠르게, 더 효율적으로", "더 저렴하게"], 58, hl=["더 빠르게, 더 효율적으로"])
make_sub_layer("sub_c", ["우리는 그걸", "SaaS의 시대라고 불렀습니다"], 56, hl=["SaaS의 시대라고 불렀습니다"])
make_sub_layer("sub_d", ["AI가 등장하면서, '무엇을 하느냐'는", "누구나 빠르게 답할 수 있게 됐습니다"], 48)
make_sub_layer("sub_e", ["그러자 더 무거워진", "질문이 하나 남았습니다"], 56)
make_sub_layer("sub_f", ["왜? 왜 이 일을 하는가?", "왜 이렇게 살아가는가?"], 54, hl=["왜? 왜 이 일을 하는가?"])
make_sub_layer("sub_g", ["한 사람의 '왜'가 일이 되는 시대", "저는 이것을 의미경제라 부릅니다"], 48, hl=["저는 이것을 의미경제라 부릅니다"])
make_sub_layer("sub_h", ["AI가 세상을 자동화한다면", "인생포트폴리오는 사람을 자유롭게 합니다"], 46)
make_sub_layer("sub_i", ["기능이 아니라 의미를", "효율이 아니라 고유성을"], 54, hl=["효율이 아니라 고유성을"])

# === CTA / 브랜드 (EP1 동일 위치) ===
def make_cta():
    img = Image.new("RGBA", (W, H), (0,0,0,0))
    d = ImageDraw.Draw(img)
    f1 = font(SQUARE_B, 46)
    txt = "▶ 더 깊은 이야기는 채널에서"
    w,h,ox,oy = text_size(d, txt, f1)
    x=(W-w)/2-ox
    CTA_Y = 1660
    d.text((x+2, CTA_Y+2-oy), txt, font=f1, fill=(0,0,0,150))
    d.text((x, CTA_Y-oy), txt, font=f1, fill=CHALK,
           stroke_width=1, stroke_fill=(30,50,40,180))
    img.save(f"{WORK}/cta.png"); print("cta saved")
make_cta()

def make_brand():
    img = Image.new("RGBA", (W, H), (0,0,0,0))
    d = ImageDraw.Draw(img)
    f1 = font(SQUARE_B, 38)
    txt = "인생포트폴리오"
    w,h,ox,oy = text_size(d, txt, f1)
    x=(W-w)/2-ox
    BRAND_Y = 258
    d.text((x+2, BRAND_Y+2-oy), txt, font=f1, fill=(0,0,0,140))
    d.text((x, BRAND_Y-oy), txt, font=f1, fill=(240,192,64,235),
           stroke_width=1, stroke_fill=(30,50,40,160))
    img.save(f"{WORK}/brand.png"); print("brand saved")
make_brand()

print("ALL EP2 LAYERS DONE")
