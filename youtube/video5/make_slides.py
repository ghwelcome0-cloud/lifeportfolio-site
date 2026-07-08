# -*- coding: utf-8 -*-
"""5편 '불편함이라는 신호' 등급 A 슬라이드.
1~4편 design.py 시스템 재사용. 8막 구조 매핑. 크레딧 0 (로컬 렌더).
안전장치: '정직한 신호가 될 수 있습니다', '가장 확실한 길 하나' 절제 표현 유지."""
from design import *
from PIL import ImageDraw

TOTAL = 8  # 8막 → 챕터 진행 점 8개

def base(idx):
    return bg_base(chapter_idx=idx, chapter_total=TOTAL)

# ============================================================
# 1막 — 후크 (공감)
# ============================================================
def s_hook():
    img = base(0)
    tag(img, W//2, 250, "인생 자산화 · 5편", F(B, 40))
    wrap_glow(img, W//2, 470, ["'무엇이 되고 싶은가'가", "막막하다면"], F(EB, 100), WHITE, lh=1.3)
    divider(img, W//2, 700)
    wrap_shadow(img, W//2, 800, ["질문을 반대로 던져 봅니다"], F(R, 46), GREY)
    save(img, "slides/01_hook.png")

def s_hook2():
    img = base(0)
    wrap_glow(img, W//2, 430, ["\"무엇이", "참을 수 없이 불편한가\""], F(EB, 96), GOLD_LT, lh=1.32)
    divider(img, W//2, 680)
    wrap_shadow(img, W//2, 790,
                ["불편함은, 내가 무엇을 소중히 여기는지를", "비추는 정직한 신호가 될 수 있습니다"],
                F(R, 46), WHITE, lh=1.4)
    save(img, "slides/02_hook2.png")

# ============================================================
# 2막 — 불편함 = 신호 (해석 시작)
# ============================================================
def s_signal():
    img = base(1)
    tag(img, W//2, 260, "불편함이란?", F(B, 40))
    wrap_glow(img, W//2, 470, ["불편함은 잡음이 아니라,", "'신호'입니다"], F(EB, 88), WHITE, lh=1.32)
    divider(img, W//2, 690)
    wrap_shadow(img, W//2, 790,
                ["열이 나는 건 몸이 싸운다는 신호,", "마음의 불편함은 '뭔가 어긋났다'는 신호"],
                F(R, 46), GOLD_LT, lh=1.4)
    save(img, "slides/03_signal.png")

def s_signal_step():
    img = base(1)
    wrap_shadow(img, W//2, 240, ["그래서 첫걸음은"], F(B, 48), GREY)
    card(img, [300, 380, 900, 820], outline=(*GREY_DK,180), ow=2)
    card(img, [1020, 380, 1620, 820], glow_outline=True, outline=(*GOLD,200), ow=2)
    text_shadow(img, (600, 470), "\u2715  없애기", F(B, 56), (210,120,120))
    wrap_shadow(img, 600, 620, ["불편함을", "지우려 애쓰기"], F(R, 42), GREY, lh=1.4)
    text_glow(img, (1320, 470), "\u25cb  들여다보기", F(B, 52), GOLD_LT)
    wrap_shadow(img, 1320, 620, ["그 정체를", "가만히 살피기"], F(R, 42), WHITE, lh=1.4)
    save(img, "slides/04_signal_step.png")

# ============================================================
# 3막 — 가치 · 정합성 · 괴리 (해석 완성)
# ============================================================
def s_flip():
    img = base(2)
    tag(img, W//2, 250, "불편함을 뒤집으면", F(B, 40))
    wrap_glow(img, W//2, 460, ["그 아래 깔린", "'가치'가 드러납니다"], F(EB, 90), GOLD_LT, lh=1.3)
    divider(img, W//2, 690)
    wrap_shadow(img, W//2, 790, ["소중하지 않은 것 때문에는,", "불편하지도 않으니까요"], F(R, 46), WHITE, lh=1.4)
    save(img, "slides/05_flip.png")

def s_flip_ex():
    img = base(2)
    wrap_shadow(img, W//2, 200, ["불편함  →  숨어 있던 가치"], F(B, 52), GREY)
    rows = [
        ("결실 없이 끝나면 괴롭다", "열매 맺는 삶"),
        ("막연하게 살면 답답하다", "목적과 방향"),
        ("약속을 어기면 화가 난다", "신뢰"),
    ]
    y = 360
    for left, right in rows:
        card(img, [180, y, 900, y+130], outline=(*GREY_DK,160), ow=2)
        text_shadow(img, (540, y+65), left, F(R, 40), GREY)
        text_glow(img, (960, y+65), "\u2192", F(EB, 60), GOLD)
        card(img, [1020, y, 1740, y+130], glow_outline=True, outline=(*GOLD,180), ow=2)
        text_glow(img, (1380, y+65), right, F(B, 46), GOLD_LT)
        y += 165
    save(img, "slides/06_flip_ex.png")

def s_gap():
    img = base(2)
    tag(img, W//2, 240, "정합성 = 믿음과 삶의 일치", F(B, 38))
    wrap_glow(img, W//2, 440, ["되고 싶은 나  ✕  지금의 나"], F(EB, 74), WHITE)
    divider(img, W//2, 600)
    wrap_glow(img, W//2, 720, ["그 사이의 틈 =  '괴리'"], F(EB, 84), GOLD_LT)
    wrap_shadow(img, W//2, 870, ["이 틈을 좁히는 일이, 방향을 찾는 일입니다"], F(R, 44), GREY)
    save(img, "slides/07_gap.png")

# ============================================================
# 4막 — 피드백 (방향 1)
# ============================================================
def s_fb_title():
    img = base(3)
    tag(img, W//2, 270, "괴리를 좁히는 길", F(B, 40))
    wrap_glow(img, W//2, 500, ["가장 확실한 길 하나 —", "피드백"], F(EB, 104), GOLD_LT, lh=1.3)
    divider(img, W//2, 760)
    wrap_shadow(img, W//2, 850, ["확인  →  측정  →  조정  의 반복"], F(R, 48), WHITE)
    save(img, "slides/08_fb_title.png")

def s_fb_plane():
    img = base(3)
    wrap_shadow(img, W//2, 210, ["비행기가 도착하는 원리"], F(B, 50), GREY)
    steps = [("확인", "지금 어디 있는가"), ("측정", "얼마나 벗어났는가"), ("조정", "방향을 고친다")]
    x = 300
    for i,(t,s) in enumerate(steps):
        card(img, [x, 400, x+400, 760], glow_outline=(i==2), outline=(*GOLD,180) if i==2 else (*GREY_DK,170), ow=2)
        text_glow(img, (x+200, 500), t, F(EB, 70), GOLD_LT)
        wrap_shadow(img, x+200, 640, [s], F(R, 38), WHITE, lh=1.3)
        if i < 2:
            text_glow(img, (x+430, 580), "\u2192", F(EB, 64), GOLD)
        x += 520
    wrap_shadow(img, W//2, 880, ["많은 사람이 '측정·조정' 단계를 건너뛰고, 같은 실수를 반복합니다"], F(R, 42), GREY)
    save(img, "slides/09_fb_plane.png")

def s_fb_two():
    img = base(3)
    wrap_shadow(img, W//2, 230, ["피드백은 두 방향에서 옵니다"], F(B, 50), GREY)
    card(img, [220, 380, 920, 820], glow_outline=True, outline=(*GOLD,180), ow=2)
    text_glow(img, (570, 470), "안에서", F(EB, 60), GOLD_LT)
    wrap_shadow(img, 570, 620, ["오늘 내가", "믿는 대로 살았는가", "— 자기 점검"], F(R, 40), WHITE, lh=1.4)
    card(img, [1000, 380, 1700, 820], glow_outline=True, outline=(*GOLD,180), ow=2)
    text_glow(img, (1350, 470), "밖에서", F(EB, 60), GOLD_LT)
    wrap_shadow(img, 1350, 620, ["신뢰하는 사람의", "솔직한 말", "— 내 느낌은 자주 틀린다"], F(R, 40), WHITE, lh=1.4)
    save(img, "slides/10_fb_two.png")

# ============================================================
# 5막 — 흔들리지 않는 기준 (방향 2)
# ============================================================
def s_std():
    img = base(4)
    tag(img, W//2, 260, "피드백에는 기준점이 필요하다", F(B, 38))
    wrap_glow(img, W//2, 480, ["기준이 '내 기분'이면", "자가 늘었다 줄었다 합니다"], F(EB, 78), WHITE, lh=1.32)
    divider(img, W//2, 700)
    wrap_shadow(img, W//2, 800, ["그래서, 내 바깥에 있는", "'흔들리지 않는 기준'이 필요합니다"], F(R, 46), GOLD_LT, lh=1.4)
    save(img, "slides/11_std.png")

def s_scripture():
    img = base(4)
    tag(img, W//2, 250, "신앙의 맥락에서는", F(B, 38))
    wrap_glow(img, W//2, 480,
              ["\"주의 말씀은 내 발에 등이요,", "내 길에 빛이니이다\""], F(EB, 74), GOLD_LT, lh=1.4)
    divider(img, W//2, 700)
    wrap_shadow(img, W//2, 790, ["시편 119편 105절 (개역개정)"], F(R, 44), GREY)
    save(img, "slides/12_scripture.png")

# ============================================================
# 6막 — 나만의 눈금 + 자산화 3동사 (방향 완성)
# ============================================================
def s_score():
    img = base(5)
    tag(img, W//2, 260, "같은 기준, 다른 삶", F(B, 40))
    wrap_glow(img, W//2, 480, ["기준은 공통된 '악보',", "연주하는 소리는 사람마다 다르다"], F(EB, 72), WHITE, lh=1.34)
    divider(img, W//2, 700)
    wrap_shadow(img, W//2, 800, ["지문이 다 다르듯,", "각자의 자리와 강점도 다릅니다"], F(R, 46), GOLD_LT, lh=1.4)
    save(img, "slides/13_score.png")

def s_three():
    img = base(5)
    wrap_shadow(img, W//2, 200, ["자산화 — 세 개의 동사"], F(B, 52), GREY)
    items = [("발견", "나만의 방향을", "안다"),
             ("살아냄", "매일 조금씩", "걸어간다"),
             ("남김", "다른 사람에게", "흘러간다")]
    x = 250
    for i,(t,a,b) in enumerate(items):
        card(img, [x, 380, x+440, 820], glow_outline=True, outline=(*GOLD,180), ow=2)
        text_glow(img, (x+220, 490), t, F(EB, 66), GOLD_LT)
        wrap_shadow(img, x+220, 640, [a, b], F(R, 40), WHITE, lh=1.4)
        if i < 2:
            text_glow(img, (x+470, 600), "\u2192", F(EB, 60), GOLD)
        x += 560
    wrap_shadow(img, W//2, 900, ["넘어지는 것이 실패가 아니라, 다시 일어나지 않는 것이 실패입니다"], F(R, 42), GOLD_LT)
    save(img, "slides/14_three.png")

# ============================================================
# 7막 — 괴리는 능력 + 온톨로지 (전환 씨앗)
# ============================================================
def s_ability():
    img = base(6)
    wrap_glow(img, W//2, 430, ["괴리를 느낀다는 건", "약점이 아니라 '능력'입니다"], F(EB, 84), GOLD_LT, lh=1.32)
    divider(img, W//2, 660)
    wrap_shadow(img, W//2, 770,
                ["목적지가 없는 사람은,", "길을 잃어도 잃은 줄 모릅니다"], F(R, 48), WHITE, lh=1.4)
    save(img, "slides/15_ability.png")

def s_map():
    img = base(6)
    tag(img, W//2, 220, "불편함에서 시작하는 여정", F(B, 38))
    flow = ["불편함", "가치", "정합성", "피드백", "발견·살아냄·남김"]
    widths = [250, 230, 250, 250, 420]
    gap = 40
    total_w = sum(widths) + gap*4
    x = (W - total_w)//2
    y = 440
    for i, node in enumerate(flow):
        w = widths[i]
        card(img, [x, y, x+w, y+150], glow_outline=(i==4), outline=(*GOLD,180) if i==4 else (*GREY_DK,170), ow=2)
        fs = 44 if i<4 else 36
        text_glow(img, (x+w//2, y+75), node, F(B, fs), GOLD_LT if i==4 else WHITE)
        if i < 4:
            text_glow(img, (x+w+gap//2, y+75), "\u2192", F(EB, 46), GOLD)
        x += w + gap
    wrap_shadow(img, W//2, 730, ["이 여정의 '입구'가 바로, 오늘의 불편함입니다"], F(R, 46), GREY)
    save(img, "slides/16_map.png")

# ============================================================
# 8막 — 핵심정리 + CTA (초대)
# ============================================================
def s_cta():
    img = base(7)
    tag(img, W//2, 230, "오늘, 딱 한 걸음", F(B, 40))
    wrap_glow(img, W//2, 450, ["가장 불편했던 것 하나를 적고,", "물어보세요"], F(EB, 78), WHITE, lh=1.32)
    wrap_glow(img, W//2, 660, ["\"나는 여기서 무엇을", "지키고 싶었을까\""], F(EB, 78), GOLD_LT, lh=1.32)
    save(img, "slides/17_cta.png")

def s_cta2():
    img = base(7)
    wrap_shadow(img, W//2, 320, ["이 발견의 여정을 끝까지 돕는 것이"], F(R, 50), GREY)
    wrap_glow(img, W//2, 480, ["인생포트폴리오"], F(EB, 130), GOLD_LT)
    divider(img, W//2, 640)
    wrap_shadow(img, W//2, 760,
                ["당신의 불편함은 잡음이 아니라,", "어디로 가야 할지 알려주는 정직한 신호입니다"],
                F(R, 46), WHITE, lh=1.45)
    save(img, "slides/18_cta2.png")


if __name__ == "__main__":
    import os
    os.makedirs("slides", exist_ok=True)
    s_hook(); s_hook2()
    s_signal(); s_signal_step()
    s_flip(); s_flip_ex(); s_gap()
    s_fb_title(); s_fb_plane(); s_fb_two()
    s_std(); s_scripture()
    s_score(); s_three()
    s_ability(); s_map()
    s_cta(); s_cta2()
    print("ALL SLIDES DONE")
