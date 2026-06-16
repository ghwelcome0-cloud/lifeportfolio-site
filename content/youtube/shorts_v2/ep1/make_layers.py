#!/usr/bin/env python3
# EP1 텍스트 레이어 생성 (칠판 손글씨 + 자막)
from PIL import Image, ImageDraw, ImageFont
import os

W, H = 1080, 1920
WORK = os.path.dirname(os.path.abspath(__file__)) + "/work"
os.makedirs(WORK, exist_ok=True)

CHALK = (245, 241, 232, 255)      # 분필 흰색
YELLOW = (240, 192, 64, 255)      # 북극성 노랑
SUB_WHITE = (248, 246, 240, 255)  # 자막 흰

PEN = "/usr/share/fonts/truetype/nanum/NanumPen.ttf"      # 손글씨(칠판)
BRUSH = "/usr/share/fonts/truetype/nanum/NanumBrush.ttf"  # 붓(강조)
SQUARE_B = "/usr/share/fonts/truetype/nanum/NanumSquareB.ttf"  # 자막(가독)

def font(path, size):
    return ImageFont.truetype(path, size)

def text_size(draw, txt, fnt):
    b = draw.textbbox((0,0), txt, font=fnt)
    return b[2]-b[0], b[3]-b[1], b[0], b[1]

def make_chalk_layer(name, lines, fpath, size, color=CHALK, y_center=760, line_gap=1.25, jitter=True, stroke=0):
    """칠판 손글씨 레이어 (투명 배경, 중앙 정렬)"""
    img = Image.new("RGBA", (W, H), (0,0,0,0))
    d = ImageDraw.Draw(img)
    fnt = font(fpath, size)
    # 총 높이 계산
    heights = []
    widths = []
    for ln in lines:
        w,h,ox,oy = text_size(d, ln, fnt)
        widths.append((w,ox)); heights.append(h)
    total_h = sum(h*line_gap for h in heights)
    y = y_center - total_h/2
    import random
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

def make_sub_layer(name, lines, size=58, color=SUB_WHITE, y_bottom=1560, hl=None):
    """하단 자막 레이어 (반투명 박스 + 텍스트)"""
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
        # 그림자(가독)
        d.text((x+3, y+3-oy), ln, font=fnt, fill=(0,0,0,180))
        c = YELLOW if (hl and ln in hl) else color
        d.text((x, y-oy), ln, font=fnt, fill=c)
        y += h*line_gap
    img.save(f"{WORK}/{name}.png")
    print(name, "saved")

# === 칠판 손글씨 레이어 ===
# 1) HOOK: AI = 답 3초
make_chalk_layer("ch_hook", ["AI에게 물으면", "답은 3초."], PEN, 150, y_center=720)
# 2) 물음표
make_chalk_layer("ch_q", ["?"], BRUSH, 360, color=YELLOW, y_center=760)
# 3) 핵심: 나는 왜 뒤처진 걸까?
make_chalk_layer("ch_core", ["나는 왜", "뒤처진 걸까?"], PEN, 165, y_center=720)
# 4) 마무리: 단 하나뿐인 인생 설계도 + 별
make_chalk_layer("ch_end", ["단 하나뿐인", "인생 설계도"], PEN, 150, color=YELLOW, y_center=760)

# === 자막 레이어 ===
make_sub_layer("sub_01", ["AI에게 물으면", "답은 3초 만에 나옵니다"], 60, y_bottom=1555)
make_sub_layer("sub_02", ["그런데 이상하죠"], 64, y_bottom=1555)
make_sub_layer("sub_03", ["답이 빨라질수록", "우리는 더 자주 이런 생각을 합니다"], 56, y_bottom=1555)
make_sub_layer("sub_04", ['"나는 왜 남들보다', '뒤처진 것 같을까?"'], 60, y_bottom=1555, hl=['"나는 왜 남들보다'])
make_sub_layer("sub_05", ["모든 성취가 숫자로 줄 세워지는", "비교의 시대"], 54, y_bottom=1555)
make_sub_layer("sub_06", ["그 비교의 자리에서", "한 발 벗어나려는 분들을 위한 이야기"], 50, y_bottom=1555)
make_sub_layer("sub_07", ["비교하지 않아도 되는", "단 하나뿐인 인생 설계도"], 56, y_bottom=1555, hl=["단 하나뿐인 인생 설계도"])

# === CTA / 엔드카드 ===
# 칠판 초록 내부 영역: y 170~1788, x 91~996 (board.png 측정값)
# 글자는 모두 이 안에 배치한다.
def make_cta():
    img = Image.new("RGBA", (W, H), (0,0,0,0))
    d = ImageDraw.Draw(img)
    f1 = font(SQUARE_B, 46)
    txt = "▶ 더 깊은 이야기는 채널에서"
    w,h,ox,oy = text_size(d, txt, f1)
    x=(W-w)/2-ox
    CTA_Y = 1660  # 칠판 하단 안쪽 (1788 프레임보다 위), 자막(1620)과 분리
    # 분필 느낌 외곽선으로 초록 위에서 또렷하게
    d.text((x+2, CTA_Y+2-oy), txt, font=f1, fill=(0,0,0,150))
    d.text((x, CTA_Y-oy), txt, font=f1, fill=CHALK,
           stroke_width=1, stroke_fill=(30,50,40,180))
    img.save(f"{WORK}/cta.png"); print("cta saved")
make_cta()

# 브랜드 워터마크 (상단) — 칠판 초록 안쪽으로 이동
def make_brand():
    img = Image.new("RGBA", (W, H), (0,0,0,0))
    d = ImageDraw.Draw(img)
    f1 = font(SQUARE_B, 38)
    txt = "인생포트폴리오"
    w,h,ox,oy = text_size(d, txt, f1)
    x=(W-w)/2-ox
    BRAND_Y = 258  # 칠판 초록 상단(225) 안쪽으로 충분히 들어옴
    # 그림자 + 외곽선으로 초록 위 가독성 확보
    d.text((x+2, BRAND_Y+2-oy), txt, font=f1, fill=(0,0,0,140))
    d.text((x, BRAND_Y-oy), txt, font=f1, fill=(240,192,64,235),
           stroke_width=1, stroke_fill=(30,50,40,160))
    img.save(f"{WORK}/brand.png"); print("brand saved")
make_brand()

print("ALL LAYERS DONE")
