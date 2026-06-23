# -*- coding: utf-8 -*-
"""숏츠 #2 세로 슬라이드 — "목적이 또렷한 사람의 통장" (Hill 연구).
번인 자막이 화면 하단 1/3(안전구역)에 들어가므로,
슬라이드 핵심 그래픽은 상단~중앙(y 400~1250)에 배치.
행간(lh)은 #1에서 검증된 1.40~1.50 사용.
"""
from design_v import *
from PIL import ImageDraw

SAFE_TOP = 360
CAPTION_Y = 1480

def base():
    img = bg_base()
    brand(img)
    return img

# ── S1 hook: 통념(같은 일·월급) + 반전(잔고 달라짐) ──────
def s_hook():
    img = base()
    tag(img, W // 2, 450, "오늘의 질문", F(B, 40))
    wrap_glow(img, W // 2, 830,
              ["같은 일,", "같은 월급인데"],
              F(EB, 118), WHITE, lh=1.40, glow_color=GOLD, glow_strength=70)
    divider(img, W // 2, 1190, w=190)
    wrap_shadow(img, W // 2, 1390,
                ["통장 잔고는", "왜 달라질까"],
                F(EB, 92), GOLD_LT, lh=1.45)
    save(img, "s1_hook.png")

# ── S2 study: 대규모 추적 연구 소개 (신뢰 근거) ──────────
def s_study():
    img = base()
    tag(img, W // 2, 460, "연구로 증명된 이야기", F(B, 40))
    # 큰 숫자 강조: 4,660명
    wrap_glow(img, W // 2, 760, ["미국 4,660명"],
              F(EB, 124), WHITE, glow_color=GOLD, glow_strength=80)
    wrap_shadow(img, W // 2, 960, ["십수 년간 추적"],
                F(EB, 88), GOLD_LT, lh=1.40)
    divider(img, W // 2, 1110, w=190)
    # 출처 카드
    box = [150, 1200, W - 150, 1380]
    card(img, box, glow_outline=True)
    text_shadow(img, (W // 2, 1262), "삶의 목적이 또렷한 사람과", F(R, 46), GREY, anchor="mm")
    text_shadow(img, (W // 2, 1322), "그렇지 않은 사람의 차이", F(R, 46), GREY, anchor="mm")
    save(img, "s2_study.png")

# ── S3 numbers: 충격 숫자 2개 (소득·순자산) ─────────────
def s_numbers():
    img = base()
    tag(img, W // 2, 460, "목적이 또렷한 사람은", F(B, 40))
    items = [
        ("소득", "+약 $4,400", "더 벌었습니다"),
        ("순자산", "+약 $20,000", "더 쌓였습니다"),
    ]
    y = 660
    ch = 320
    gap = 50
    d = ImageDraw.Draw(img)
    for label, amount, desc in items:
        box = [110, y, W - 110, y + ch]
        card(img, box, glow_outline=True)
        # 라벨(상단 작게)
        text_shadow(img, (W // 2, y + 64), label, F(B, 50), GREY, anchor="mm")
        # 금액(골드, 크게)
        text_glow(img, (W // 2, y + 165), amount, F(EB, 104), GOLD_LT,
                  anchor="mm", glow_color=GOLD, glow_strength=85)
        # 설명
        text_shadow(img, (W // 2, y + 262), desc, F(R, 46), WHITE, anchor="mm")
        y += ch + gap
    save(img, "s3_numbers.png")

# ── S4 cta: 반전 회수 + 질문 + 롱폼 유도 (루프) ─────────
def s_cta():
    img = base()
    tag(img, W // 2, 430, "더 열심히 일해서가 아니다", F(B, 40))
    wrap_glow(img, W // 2, 760,
              ["목적이 또렷하면", "돈으로", "환산됩니다"],
              F(EB, 100), WHITE, lh=1.42, glow_color=GOLD, glow_strength=75)
    divider(img, W // 2, 1170, w=190)
    # CTA 카드
    box = [120, 1270, W - 120, 1510]
    card(img, box, glow_outline=True)
    text_shadow(img, (W // 2, 1352), "전체 이야기는", F(R, 50), GREY, anchor="mm")
    text_glow(img, (W // 2, 1440), "채널 '자산이란' 영상", F(EB, 64), GOLD_LT,
              anchor="mm", glow_color=GOLD, glow_strength=90)
    text_shadow(img, (W // 2, 1610), "▶  지금 시청하기", F(B, 52), WHITE, anchor="mm")
    save(img, "s4_cta.png")

if __name__ == "__main__":
    s_hook()
    s_study()
    s_numbers()
    s_cta()
    print("4 slides done")
