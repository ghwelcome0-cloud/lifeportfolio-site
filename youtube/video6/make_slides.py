# -*- coding: utf-8 -*-
"""6편 '사명과 창업이 같은 뿌리인 이유' 등급 A 슬라이드.
design.py 시스템 재사용. 8막 구조 매핑. 크레딧 0 (로컬 렌더).
절제 표현 유지: '될 수 있다', '신앙 유무 무관', 수익은 '결과'."""
from design import *
from PIL import ImageDraw

TOTAL = 8  # 8막 → 챕터 진행 점 8개

def base(idx):
    return bg_base(chapter_idx=idx, chapter_total=TOTAL)

# ============================================================
# 1막 — 후크 (공감)  [P1]
# ============================================================
def s_hook():
    img = base(0)
    tag(img, W//2, 250, "사명 × 창업 · 인생 자산화 6편", F(B, 40))
    wrap_glow(img, W//2, 470, ["'사명'과 '창업'을", "정반대라 여겼나요"], F(EB, 96), WHITE, lh=1.3)
    divider(img, W//2, 720)
    wrap_shadow(img, W//2, 820, ["뿌리까지 파보면, 놀랍게도 같은 구조입니다"], F(R, 46), GREY)
    save(img, "slides/01_hook.png")

def s_business():
    img = base(0)
    tag(img, W//2, 250, "먼저, 비즈니스란?", F(B, 40))
    wrap_glow(img, W//2, 470,
              ["누군가의 불편함을 발견해,", "해결책을 만들어, 전달하는 것"],
              F(EB, 72), WHITE, lh=1.34)
    divider(img, W//2, 700)
    wrap_shadow(img, W//2, 800,
                ["\"사람들은 드릴이 아니라, 벽에 뚫을 구멍을 원한다\"",
                 "— 시어도어 레빗"],
                F(R, 42), GOLD_LT, lh=1.4)
    save(img, "slides/02_business.png")

def s_frame():
    img = base(1)
    wrap_shadow(img, W//2, 230, ["비즈니스의 심장, 세 단어"], F(B, 52), GREY)
    words = [("불편함", "문제의 발견"), ("가치", "지키고 싶은 것"), ("전달", "거래로 흘려보냄")]
    x = 250
    for i,(t,s) in enumerate(words):
        card(img, [x, 400, x+440, 820], glow_outline=True, outline=(*GOLD,180), ow=2)
        text_glow(img, (x+220, 500), t, F(EB, 66), GOLD_LT)
        wrap_shadow(img, x+220, 650, [s], F(R, 40), WHITE, lh=1.3)
        if i < 2:
            text_glow(img, (x+470, 600), "\u2192", F(EB, 60), GOLD)
        x += 560
    wrap_shadow(img, W//2, 900, ["\"기업의 목적은 고객을 창출하는 것\" — 피터 드러커"], F(R, 42), GREY)
    save(img, "slides/03_frame.png")

# ============================================================
# 3막 — 사명도 같다 (해석)  [P2]
# ============================================================
def s_mission():
    img = base(1)
    tag(img, W//2, 250, "그럼 사명은?", F(B, 40))
    wrap_glow(img, W//2, 470,
              ["내 불편함에서 시작해,", "가치를 발견하고, 흘려보내는 것"],
              F(EB, 70), GOLD_LT, lh=1.34)
    divider(img, W//2, 700)
    wrap_shadow(img, W//2, 800, ["보이시나요 — 이 역시 '불편함 · 가치 · 전달'입니다"], F(R, 46), WHITE)
    save(img, "slides/04_mission.png")

def s_table():
    img = base(2)
    wrap_shadow(img, W//2, 190, ["두 문장의 뼈대는, 정확히 같다"], F(B, 52), GREY)
    # 좌: 사명 / 우: 비즈니스
    card(img, [180, 340, 900, 860], glow_outline=True, outline=(*GOLD,180), ow=2)
    text_glow(img, (540, 430), "사명", F(EB, 60), GOLD_LT)
    wrap_shadow(img, 540, 600, ["'나의' 불편함에서", "출발한다"], F(R, 44), WHITE, lh=1.5)
    card(img, [1020, 340, 1740, 860], glow_outline=True, outline=(*GOLD,180), ow=2)
    text_glow(img, (1380, 430), "비즈니스", F(EB, 60), GOLD_LT)
    wrap_shadow(img, 1380, 600, ["'남의' 불편함을", "향한다"], F(R, 44), WHITE, lh=1.5)
    text_glow(img, (W//2, 600), "\u2194", F(EB, 72), GOLD)
    wrap_shadow(img, W//2, 920, ["차이는 출발점의 강조점뿐입니다"], F(R, 44), GREY)
    save(img, "slides/05_table.png")

# ============================================================
# 4막 — 만나는 지점  [P2]
# ============================================================
def s_meet():
    img = base(2)
    tag(img, W//2, 250, "결정적인 연결고리", F(B, 40))
    wrap_glow(img, W//2, 470,
              ["내가 깊이 앓은 불편함은,", "대개 나만의 것이 아닙니다"],
              F(EB, 74), WHITE, lh=1.32)
    divider(img, W//2, 700)
    wrap_shadow(img, W//2, 800, ["나의 불편함  =  수많은 이의 불편함"], F(R, 48), GOLD_LT)
    save(img, "slides/06_meet.png")

def s_item():
    img = base(2)
    wrap_shadow(img, W//2, 260, ["두 불편함이 만나는 지점"], F(B, 52), GREY)
    card(img, [320, 420, 820, 720], glow_outline=True, outline=(*GOLD,180), ow=2)
    wrap_glow(img, 570, 570, ["나의", "불편함"], F(EB, 58), WHITE, lh=1.35)
    text_glow(img, (W//2, 570), "\u2192\u2190", F(EB, 70), GOLD)
    card(img, [1100, 420, 1600, 720], glow_outline=True, outline=(*GOLD,180), ow=2)
    wrap_glow(img, 1350, 570, ["남의", "불편함"], F(EB, 58), WHITE, lh=1.35)
    wrap_glow(img, W//2, 850, ["=  창업 아이템"], F(EB, 92), GOLD_LT)
    save(img, "slides/07_item.png")

# ============================================================
# 5막 — 몸으로 아는 힘 + 사례  [P3]
# ============================================================
def s_body():
    img = base(3)
    tag(img, W//2, 260, "여기에 특별한 힘이 있다", F(B, 40))
    wrap_glow(img, W//2, 480,
              ["직접 앓은 사람은,", "고객의 고통을 '몸으로' 안다"],
              F(EB, 76), GOLD_LT, lh=1.32)
    divider(img, W//2, 720)
    wrap_shadow(img, W//2, 820, ["조사해서 찾은 게 아니라, 그 문제를 살아낸 사람"], F(R, 46), WHITE)
    save(img, "slides/08_body.png")

def s_cases():
    img = base(3)
    wrap_shadow(img, W//2, 210, ["방향이 흔들리지 않은 이야기들"], F(B, 50), GREY)
    card(img, [180, 360, 900, 850], glow_outline=True, outline=(*GOLD,180), ow=2)
    text_glow(img, (540, 450), "에어비앤비", F(EB, 58), GOLD_LT)
    wrap_shadow(img, 540, 630, ["월세를 못 내던", "자기 문제에서 시작.", "방에 에어매트리스를", "깔아 빌려준 것"], F(R, 38), WHITE, lh=1.5)
    card(img, [1020, 360, 1740, 850], glow_outline=True, outline=(*GOLD,180), ow=2)
    text_glow(img, (1380, 450), "아마존", F(EB, 58), GOLD_LT)
    wrap_shadow(img, 1380, 630, ["\"고객에서 출발해", "거꾸로 생각한다\"", "적자 비판 속에서도", "방향을 고수"], F(R, 38), WHITE, lh=1.5)
    wrap_shadow(img, W//2, 930, ["방향은 성공을 보장하진 않지만, 포기하지 않을 이유가 된다"], F(R, 40), GREY)
    save(img, "slides/09_cases.png")

# ============================================================
# 6막 — 더 깊은 뿌리  [P4]
# ============================================================
def s_root():
    img = base(4)
    tag(img, W//2, 260, "더 깊은 뿌리", F(B, 40))
    wrap_glow(img, W//2, 480,
              ["오래도록 '좋은 일'이라 불려온 것엔,", "하나의 공통점이 있습니다"],
              F(EB, 64), WHITE, lh=1.34)
    divider(img, W//2, 700)
    wrap_glow(img, W//2, 810, ["바로, 남을 이롭게 한다는 것"], F(EB, 72), GOLD_LT)
    save(img, "slides/10_root.png")

def s_good():
    img = base(4)
    wrap_glow(img, W//2, 400,
              ["정직하게 필요를 채워주는 일 =", "비즈니스와 '좋은 일'이 겹치는 곳"],
              F(EB, 62), WHITE, lh=1.4)
    divider(img, W//2, 640)
    wrap_shadow(img, W//2, 760,
                ["이 지점에서는, 신앙이 있는 사람과", "없는 사람이 다르지 않습니다"],
                F(R, 48), GOLD_LT, lh=1.4)
    save(img, "slides/11_good.png")

# ============================================================
# 7막 — 다른 점 (균형)  [P4]
# ============================================================
def s_diff():
    img = base(5)
    tag(img, W//2, 200, "그러나, 반드시 균형을", F(B, 40))
    rows = [
        ("사명 = 내가 왜 사는가", "사업 = 시장에서 성립하는가"),
        ("남을 이롭게 한 '결과'로서의 수익", "수익 위해 사람을 '수단' 삼기"),
    ]
    y = 380
    for left, right in rows:
        card(img, [180, y, 900, y+180], glow_outline=True, outline=(*GOLD,170), ow=2)
        wrap_shadow(img, 540, y+90, [left], F(R, 36), WHITE, lh=1.35)
        text_glow(img, (960, y+90), "\u2260", F(EB, 56), GOLD)
        card(img, [1020, y, 1740, y+180], outline=(*GREY_DK,160), ow=2)
        wrap_shadow(img, 1380, y+90, [right], F(R, 36), GREY, lh=1.35)
        y += 230
    wrap_shadow(img, W//2, 900, ["좋은 사명이, 반드시 좋은 사업인 것은 아닙니다"], F(R, 42), GREY)
    save(img, "slides/12_diff.png")

def s_compass_map():
    img = base(5)
    wrap_shadow(img, W//2, 240, ["사명은 나침반, 사업은 지도"], F(B, 52), GREY)
    card(img, [220, 400, 920, 840], glow_outline=True, outline=(*GOLD,180), ow=2)
    text_glow(img, (570, 500), "나침반 · 사명", F(EB, 54), GOLD_LT)
    wrap_shadow(img, 570, 660, ["방향을 알려준다", "'어느 쪽을", "향해 사는가'"], F(R, 40), WHITE, lh=1.45)
    card(img, [1000, 400, 1700, 840], glow_outline=True, outline=(*GOLD,180), ow=2)
    text_glow(img, (1350, 500), "지도 · 사업", F(EB, 54), GOLD_LT)
    wrap_shadow(img, 1350, 660, ["지형을 보여준다", "'어떤 길을", "지나야 하는가'"], F(R, 40), WHITE, lh=1.45)
    save(img, "slides/13_compass_map.png")

def s_balance():
    img = base(5)
    wrap_glow(img, W//2, 430,
              ["그래서 정확한 표현은 —", "'사업은 좋은 일이 될 수 있다'"],
              F(EB, 66), GOLD_LT, lh=1.36)
    divider(img, W//2, 680)
    wrap_shadow(img, W//2, 790,
                ["'좋은 일이다'가 아니라, '될 수 있다'.", "방향과 결과가 옳을 때에요"],
                F(R, 46), WHITE, lh=1.4)
    save(img, "slides/14_balance.png")

# ============================================================
# 8막 — 정리 + CTA (초대)  [P5]
# ============================================================
def s_summary():
    img = base(6)
    tag(img, W//2, 240, "많은 사람이 첫 단추에서 막힌다", F(B, 38))
    wrap_glow(img, W//2, 460,
              ["나침반 — 즉 '내 사명'이", "흐릿하기 때문입니다"],
              F(EB, 74), WHITE, lh=1.32)
    divider(img, W//2, 700)
    wrap_shadow(img, W//2, 800, ["우리는 정작, 자기 자신을 가장 모르니까요"], F(R, 48), GOLD_LT)
    save(img, "slides/15_summary.png")

def s_flow():
    img = base(6)
    tag(img, W//2, 220, "인생포트폴리오가 돕는 여정", F(B, 38))
    flow = ["불편함", "발견", "살아냄", "자산화", "씨앗으로 전달"]
    widths = [230, 210, 230, 230, 380]
    gap = 40
    total_w = sum(widths) + gap*4
    x = (W - total_w)//2
    y = 440
    for i, node in enumerate(flow):
        w = widths[i]
        card(img, [x, y, x+w, y+150], glow_outline=(i==4), outline=(*GOLD,180) if i==4 else (*GREY_DK,170), ow=2)
        fs = 44 if i<4 else 34
        text_glow(img, (x+w//2, y+75), node, F(B, fs), GOLD_LT if i==4 else WHITE)
        if i < 4:
            text_glow(img, (x+w+gap//2, y+75), "\u2192", F(EB, 46), GOLD)
        x += w + gap
    wrap_shadow(img, W//2, 730, ["사명을 대신 정해주지 않습니다 — 발견하도록 돕는 '거울'입니다"], F(R, 44), GREY)
    save(img, "slides/16_flow.png")

def s_cta():
    img = base(7)
    tag(img, W//2, 230, "오늘, 딱 한 걸음", F(B, 40))
    wrap_glow(img, W//2, 450,
              ["가장 마음에 걸렸던", "불편함 하나를,"], F(EB, 82), WHITE, lh=1.3)
    wrap_glow(img, W//2, 680, ["가만히 들여다보는 것"], F(EB, 82), GOLD_LT)
    save(img, "slides/17_cta.png")

def s_cta2():
    img = base(7)
    wrap_shadow(img, W//2, 300, ["흐릿한 나침반을 또렷하게 —"], F(R, 50), GREY)
    wrap_glow(img, W//2, 460, ["인생포트폴리오"], F(EB, 130), GOLD_LT)
    divider(img, W//2, 620)
    wrap_shadow(img, W//2, 740,
                ["당신이 앓은 불편함, 그 안에", "사명과 아이템이 함께 있습니다"],
                F(R, 48), WHITE, lh=1.45)
    save(img, "slides/18_cta2.png")


if __name__ == "__main__":
    import os
    os.makedirs("slides", exist_ok=True)
    s_hook(); s_business(); s_frame()
    s_mission(); s_table()
    s_meet(); s_item()
    s_body(); s_cases()
    s_root(); s_good()
    s_diff(); s_compass_map(); s_balance()
    s_summary(); s_flow()
    s_cta(); s_cta2()
    print("ALL SLIDES DONE")
