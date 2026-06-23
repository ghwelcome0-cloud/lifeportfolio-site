# -*- coding: utf-8 -*-
"""숏츠 #3 세로 슬라이드 — "머릿속 생각은 자산이 아니다".
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

# ── S1 hook: 직접 질문 + 반전(아직 자산 아님) ──────────
def s_hook():
    img = base()
    tag(img, W // 2, 450, "오늘의 질문", F(B, 40))
    wrap_glow(img, W // 2, 820,
              ["당신의", "가장 좋은 생각은", "지금 어디에?"],
              F(EB, 104), WHITE, lh=1.40, glow_color=GOLD, glow_strength=70)
    divider(img, W // 2, 1240, w=190)
    wrap_shadow(img, W // 2, 1410,
                ["머릿속에만 있다면", "아직 자산이 아니다"],
                F(EB, 78), GOLD_LT, lh=1.45)
    save(img, "s1_hook.png")

# ── S2 cond: 자산의 두 가지 조건 ───────────────────────
def s_cond():
    img = base()
    tag(img, W // 2, 460, "자산이 되려면", F(B, 40))
    items = [
        ("①", "통제 가능", "내 의지로 다룬다"),
        ("②", "축적 가능", "시간이 갈수록 쌓인다"),
    ]
    y = 720
    ch = 300
    gap = 60
    for num, title, desc in items:
        box = [110, y, W - 110, y + ch]
        card(img, box, glow_outline=True)
        d = ImageDraw.Draw(img)
        ncx, ncy = 250, y + ch // 2
        d.ellipse([ncx - 70, ncy - 70, ncx + 70, ncy + 70], fill=GOLD)
        d.text((ncx, ncy - 2), num, font=F(EB, 86), fill=NAVY_DK, anchor="mm")
        text_shadow(img, (400, ncy - 48), title, F(EB, 78), WHITE, anchor="lm")
        text_shadow(img, (402, ncy + 52), desc, F(R, 46), GREY, anchor="lm")
        y += ch + gap
    save(img, "s2_cond.png")

# ── S3 transform: 흩어진 조각 → 정리 → 자산 ────────────
def s_transform():
    img = base()
    tag(img, W // 2, 460, "흩어진 생각의 운명", F(B, 40))
    # before: 흩어진 조각
    wrap_shadow(img, W // 2, 700, ["흩어진 채로 두면"],
                F(EB, 80), GREY, lh=1.40)
    wrap_shadow(img, W // 2, 800, ["그저 조각일 뿐"],
                F(EB, 80), GREY_DK, lh=1.40)
    # arrow
    divider(img, W // 2, 940, w=150)
    d = ImageDraw.Draw(img)
    text_glow(img, (W // 2, 1010), "↓ 한 곳에 정리하면 ↓", F(B, 50), GOLD_LT,
              anchor="mm", glow_color=GOLD, glow_strength=60)
    # after: 자산
    wrap_glow(img, W // 2, 1230,
              ["비로소", "'자산'이 된다"],
              F(EB, 110), WHITE, lh=1.42, glow_color=GOLD, glow_strength=80)
    save(img, "s3_transform.png")

# ── S4 cta: 한 권으로 구조화 + 롱폼 유도 (루프) ────────
def s_cta():
    img = base()
    tag(img, W // 2, 430, "사명 · 강점 · 실행", F(B, 40))
    wrap_glow(img, W // 2, 760,
              ["흩어진 나를", "한 권으로", "구조화하기"],
              F(EB, 100), WHITE, lh=1.42, glow_color=GOLD, glow_strength=75)
    divider(img, W // 2, 1170, w=190)
    box = [120, 1270, W - 120, 1510]
    card(img, box, glow_outline=True)
    text_shadow(img, (W // 2, 1352), "그 첫 걸음은", F(R, 50), GREY, anchor="mm")
    text_glow(img, (W // 2, 1440), "채널 '자산이란' 영상", F(EB, 64), GOLD_LT,
              anchor="mm", glow_color=GOLD, glow_strength=90)
    text_shadow(img, (W // 2, 1610), "▶  지금 시청하기", F(B, 52), WHITE, anchor="mm")
    save(img, "s4_cta.png")

if __name__ == "__main__":
    s_hook()
    s_cond()
    s_transform()
    s_cta()
    print("4 slides done")
