# -*- coding: utf-8 -*-
"""숏츠 #1 세로 슬라이드 (배경 비주얼 레이어).
번인 자막이 화면 하단 1/3(안전구역)에 들어가므로,
슬라이드의 핵심 그래픽은 상단~중앙(y 400~1250)에 배치.
"""
from design_v import *
from PIL import ImageDraw

SAFE_TOP = 360          # 브랜드 마크 아래
CAPTION_Y = 1480        # 번인 자막 중심 (이 아래는 비움)

def base():
    img = bg_base()
    brand(img)
    return img

# ── S1 hook: 질문 + 반전 ──────────────────────────────
def s_hook():
    img = base()
    tag(img, W // 2, 450, "오늘의 질문", F(B, 40))
    wrap_glow(img, W // 2, 830,
              ["당신이", "'자산'이라", "부르는 것"],
              F(EB, 126), WHITE, lh=1.40, glow_color=GOLD, glow_strength=70)
    divider(img, W // 2, 1230, w=190)
    wrap_shadow(img, W // 2, 1410,
                ["사실, 절반은", "빠져 있습니다"],
                F(EB, 92), GOLD_LT, lh=1.45)
    save(img, "s1_hook.png")

# ── S2 three: 자산의 세 가지 조건 ─────────────────────
def s_three():
    img = base()
    tag(img, W // 2, 460, "자산의 세 가지 조건", F(B, 40))
    items = [
        ("①", "미래 가치", "앞으로 가치를 만든다"),
        ("②", "통제 가능", "내 의지로 다룬다"),
        ("③", "축적 가능", "시간이 갈수록 쌓인다"),
    ]
    y = 640
    ch = 270
    gap = 36
    for num, title, desc in items:
        box = [110, y, W - 110, y + ch]
        card(img, box, glow_outline=True)
        # 번호 (골드 원)
        d = ImageDraw.Draw(img)
        ncx, ncy = 230, y + ch // 2
        d.ellipse([ncx - 62, ncy - 62, ncx + 62, ncy + 62], fill=GOLD)
        d.text((ncx, ncy - 2), num, font=F(EB, 78), fill=NAVY_DK, anchor="mm")
        # 제목 + 설명
        text_shadow(img, (360, ncy - 44), title, F(EB, 72), WHITE, anchor="lm")
        text_shadow(img, (362, ncy + 48), desc, F(R, 44), GREY, anchor="lm")
        y += ch + gap
    save(img, "s2_three.png")

# ── S3 human_capital: 인적자본 / 노벨상 ───────────────
def s_human():
    img = base()
    tag(img, W // 2, 470, "경제학이 증명한 자산", F(B, 40))
    # 세 키워드 칩
    chips = ["지식", "기술", "자기이해"]
    cy = 700
    total_w = 0
    d = ImageDraw.Draw(img)
    widths = []
    for c in chips:
        b = d.textbbox((0, 0), c, font=F(B, 60))
        widths.append(b[2] - b[0])
    pad = 44
    gap = 34
    total_w = sum(w + pad * 2 for w in widths) + gap * (len(chips) - 1)
    x = W // 2 - total_w // 2
    for c, w in zip(chips, widths):
        box = [x, cy - 70, x + w + pad * 2, cy + 70]
        card(img, box, radius=28, fill_top=NAVY_CARD, fill_bot=NAVY_CARD2,
             outline=GOLD_DK, ow=2, shadow=True)
        text_shadow(img, (x + pad + w // 2, cy), c, F(B, 60), GOLD_LT, anchor="mm")
        x += w + pad * 2 + gap
    # 인적자본
    wrap_glow(img, W // 2, 1000, ["= 인적자본"],
              F(EB, 118), WHITE, glow_color=GOLD, glow_strength=80)
    divider(img, W // 2, 1140, w=190)
    wrap_shadow(img, W // 2, 1320,
                ["노벨 경제학상이", "증명한 자산"],
                F(EB, 84), GOLD_LT, lh=1.45)
    save(img, "s3_human.png")

# ── S4 cta: 반전 회수 + 롱폼 유도 (루프) ──────────────
def s_cta():
    img = base()
    tag(img, W // 2, 430, "통장에 적히지 않는", F(B, 40))
    wrap_glow(img, W // 2, 760,
              ["통장보다", "먼저 쌓아야 할", "단 하나의 자산"],
              F(EB, 104), WHITE, lh=1.42, glow_color=GOLD, glow_strength=75)
    divider(img, W // 2, 1170, w=190)
    # CTA 카드
    box = [120, 1270, W - 120, 1510]
    card(img, box, glow_outline=True)
    text_shadow(img, (W // 2, 1352), "전체 이야기는", F(R, 50), GREY, anchor="mm")
    text_glow(img, (W // 2, 1440), "채널 '자산이란' 영상", F(EB, 64), GOLD_LT,
              anchor="mm", glow_color=GOLD, glow_strength=90)
    # 화살표 유도
    text_shadow(img, (W // 2, 1610), "▶  지금 시청하기", F(B, 52), WHITE, anchor="mm")
    save(img, "s4_cta.png")

if __name__ == "__main__":
    s_hook()
    s_three()
    s_human()
    s_cta()
    print("4 slides done")
