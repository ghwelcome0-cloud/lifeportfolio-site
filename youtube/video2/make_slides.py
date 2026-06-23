# -*- coding: utf-8 -*-
"""2편 '자기표현' 등급 A 슬라이드 제작 (15개).
1편 design.py 시스템 재사용. 8막 구조 매핑."""
from design import *

TOTAL = 15  # 챕터 진행 점 개수

def base(idx):
    return bg_base(chapter_idx=idx, chapter_total=TOTAL)

# ---------------------------------------------------------------
# 00 hook — 후크 (안개/흐릿함)
# ---------------------------------------------------------------
def s_hook():
    img = base(0)
    tag(img, W//2, 250, "인생 자산화 · 2편", F(B, 40))
    wrap_glow(img, W//2, 460, ["분명히 아는데,"], F(EB, 110), WHITE)
    wrap_glow(img, W//2, 600, ["잡으려 하면 흐릿하다"], F(EB, 110), GOLD_LT)
    divider(img, W//2, 730)
    wrap_shadow(img, W//2, 830, ["그 흐릿함을 또렷하게 바꾸는 첫 번째 열쇠"],
                F(R, 44), GREY)
    save(img, "slides/hook.png")

# ---------------------------------------------------------------
# 01 def_title — 오늘의 주제: 자기표현
# ---------------------------------------------------------------
def s_def_title():
    img = base(1)
    tag(img, W//2, 300, "오늘의 주제", F(B, 40))
    wrap_glow(img, W//2, 520, ["자기표현"], F(EB, 200), GOLD_LT)
    divider(img, W//2, 680)
    wrap_shadow(img, W//2, 780,
                ["마음속에만 머물던 것을", "밖으로 꺼내 두는 일"],
                F(R, 52), WHITE, lh=1.4)
    save(img, "slides/def_title.png")

# ---------------------------------------------------------------
# 02 not_show — 자기표현은 '과시'가 아니다 (대비)
# ---------------------------------------------------------------
def s_not_show():
    img = base(2)
    wrap_shadow(img, W//2, 230, ["자기표현이란?"], F(B, 48), GREY)
    # 좌: X 포장/과시  우: O 정직하게 꺼냄
    card(img, [180, 360, 920, 800], outline=(*GREY_DK,180), ow=2)
    card(img, [1000, 360, 1740, 800], glow_outline=True, outline=(*GOLD,200), ow=2)
    text_shadow(img, (550, 450), "✕  포장 · 과시", F(B, 54), (210,120,120))
    wrap_shadow(img, 550, 600, ["나를 멋지게", "꾸미고 내세우기"], F(R, 42), GREY, lh=1.4)
    text_glow(img, (1370, 450), "○  정직한 표현", F(B, 54), GOLD_LT)
    wrap_shadow(img, 1370, 600, ["있는 그대로의 나를", "마주하고 적어두기"], F(R, 42), WHITE, lh=1.4)
    save(img, "slides/not_show.png")

# ---------------------------------------------------------------
# 03 three_core — 자기표현 3핵심
# ---------------------------------------------------------------
def s_three_core():
    img = base(3)
    tag(img, W//2, 180, "자기표현의 세 가지 핵심", F(B, 40))
    items = [
        ("1", "밖으로 꺼낸다", "막연한 느낌을\n다룰 수 있는 형태로"),
        ("2", "정직하다", "잘 보이려는 게 아니라\n있는 그대로"),
        ("3", "남겨 둔다", "사라지지 않고\n다시 읽고 쌓는다"),
    ]
    cw = 500; gap = 40
    total = cw*3 + gap*2
    x0 = (W - total)//2
    for i,(n,t,desc) in enumerate(items):
        x = x0 + i*(cw+gap)
        card(img, [x, 330, x+cw, 860], glow_outline=(i==2))
        text_glow(img, (x+cw//2, 440), n, F(EB, 90), GOLD_LT)
        text_shadow(img, (x+cw//2, 570), t, F(B, 48), WHITE)
        for j,line in enumerate(desc.split("\n")):
            text_shadow(img, (x+cw//2, 670+j*54), line, F(R, 36), GREY)
    save(img, "slides/three_core.png")

# ---------------------------------------------------------------
# 04 pennebaker — 페니베이커 1986 연구
# ---------------------------------------------------------------
def s_pennebaker():
    img = base(4)
    tag(img, W//2, 230, "표현적 글쓰기 연구", F(B, 40))
    wrap_glow(img, W//2, 430, ["제임스 페니베이커, 1986"], F(EB, 84), GOLD_LT)
    divider(img, W//2, 560)
    wrap_shadow(img, W//2, 680,
                ["마음 깊이 담아둔 일을", "며칠 동안 짧게 글로 쓰게 하다"],
                F(R, 50), WHITE, lh=1.4)
    save(img, "slides/pennebaker.png")

# ---------------------------------------------------------------
# 05 research_scale — 40년·수백편 후속연구
# ---------------------------------------------------------------
def s_research_scale():
    img = base(5)
    wrap_shadow(img, W//2, 240, ["이 단순한 행위가 출발점이 되어"], F(B, 46), GREY)
    # 큰 숫자 두 개
    text_glow(img, (W//2-380, 560), "40", F(EB, 230), GOLD_LT)
    text_shadow(img, (W//2-380, 740), "년에 걸쳐", F(R, 48), WHITE)
    text_glow(img, (W//2+380, 560), "수백 편", F(EB, 150), GOLD_LT)
    text_shadow(img, (W//2+380, 740), "후속 연구", F(R, 48), WHITE)
    divider(img, W//2, 870)
    wrap_shadow(img, W//2, 940, ["핵심은 '무엇을 썼느냐'가 아니라 '꺼내어 정리했다'는 행위"],
                F(R, 38), GREY)
    save(img, "slides/research_scale.png")

# ---------------------------------------------------------------
# 06 change3 — 변화 3방향 (건강/정서/의미)
# ---------------------------------------------------------------
def s_change3():
    img = base(6)
    tag(img, W//2, 180, "연구가 보고한 변화", F(B, 40))
    items = [
        ("신체적 건강", "병원 방문 감소\n면역 지표 개선 경향"),
        ("정서적 안정", "불안·스트레스·우울\n관련 지표 하락 흐름"),
        ("의미의 발견", "설명·통찰의 언어가\n의미 찾기를 촉진"),
    ]
    cw = 500; gap = 40
    total = cw*3 + gap*2
    x0 = (W - total)//2
    for i,(t,desc) in enumerate(items):
        x = x0 + i*(cw+gap)
        card(img, [x, 330, x+cw, 800])
        text_glow(img, (x+cw//2, 440), t, F(B, 50), GOLD_LT)
        divider(img, x+cw//2, 520, w=120)
        for j,line in enumerate(desc.split("\n")):
            text_shadow(img, (x+cw//2, 600+j*56), line, F(R, 38), WHITE)
    wrap_shadow(img, W//2, 900, ["효과의 크기는 사람·상황에 따라 다릅니다"], F(R, 34), GREY_DK)
    save(img, "slides/change3.png")

# ---------------------------------------------------------------
# 07 one_sentence — 한 문장이 되는 순간
# ---------------------------------------------------------------
def s_one_sentence():
    img = base(7)
    wrap_glow(img, W//2, 460, ["막연하던 것이", "한 문장이 되는 순간"], F(EB, 100), WHITE, lh=1.3)
    divider(img, W//2, 680)
    wrap_shadow(img, W//2, 790, ["비로소 우리는 그것을", "바라보고 다룰 수 있게 됩니다"],
                F(R, 50), GOLD_LT, lh=1.4)
    save(img, "slides/one_sentence.png")

# ---------------------------------------------------------------
# 08 bible_title — 더 깊은 뿌리: 성경
# ---------------------------------------------------------------
def s_bible_title():
    img = base(8)
    tag(img, W//2, 280, "더 깊은 뿌리", F(B, 40))
    wrap_glow(img, W//2, 500, ["정직한 표현,", "아주 오래된 전통"], F(EB, 100), GOLD_LT, lh=1.3)
    divider(img, W//2, 720)
    wrap_shadow(img, W//2, 820, ["성경의 시편 — 마음을 있는 그대로 쏟아 놓는 책"],
                F(R, 46), WHITE)
    save(img, "slides/bible_title.png")

# ---------------------------------------------------------------
# 09 psalm — 시편 62:8
# ---------------------------------------------------------------
def s_psalm():
    img = base(9)
    tag(img, W//2, 200, "시편 62편 8절", F(B, 40))
    card(img, [240, 340, W-240, 760], glow_outline=True, outline=(*GOLD,180), ow=2)
    wrap_shadow(img, W//2, 480,
                ["\u201c백성들아 시시로 그를 의지하고"], F(B, 56), WHITE, lh=1.4)
    wrap_glow(img, W//2, 590, ["그의 앞에 마음을 토하라\u201d"], F(EB, 64), GOLD_LT)
    wrap_shadow(img, W//2, 700, ["— 숨기지 말고, 밖으로 꺼내어 두라는 초대"], F(R, 38), GREY)
    save(img, "slides/psalm.png")

# ---------------------------------------------------------------
# 10 romans — 로마서 10:10
# ---------------------------------------------------------------
def s_romans():
    img = base(10)
    tag(img, W//2, 230, "로마서 10장 10절", F(B, 40))
    wrap_shadow(img, W//2, 450,
                ["\u201c사람이 마음으로 믿어 의에 이르고,"], F(B, 54), WHITE, lh=1.4)
    wrap_glow(img, W//2, 570, ["입으로 시인하여 구원에 이르느니라\u201d"], F(EB, 58), GOLD_LT)
    divider(img, W//2, 700)
    wrap_shadow(img, W//2, 800, ["마음을 입으로 꺼내는 일이", "믿음의 본질에 닿아 있다"],
                F(R, 48), GREY, lh=1.4)
    save(img, "slides/romans.png")

# ---------------------------------------------------------------
# 11 steward — 분별: 청지기의 일
# ---------------------------------------------------------------
def s_steward():
    img = base(11)
    tag(img, W//2, 230, "분별", F(B, 40))
    wrap_glow(img, W//2, 440, ["과시가 아니라,", "청지기의 일"], F(EB, 100), GOLD_LT, lh=1.3)
    divider(img, W//2, 660)
    wrap_shadow(img, W//2, 770,
                ["남보다 나음을 드러내는 도구가 아니라", "내게 주어진 고유함을 정직하게 발견해 적는 일"],
                F(R, 44), WHITE, lh=1.5)
    save(img, "slides/steward.png")

# ---------------------------------------------------------------
# 12 ontology — 온톨로지 4단계 흐름
# ---------------------------------------------------------------
def s_ontology():
    img = base(12)
    tag(img, W//2, 160, "인생 자산화의 흐름", F(B, 40))
    steps = ["자기이해", "자기표현", "자기설계", "자기실행"]
    subs  = ["바탕(흐릿함)", "또렷하게(오늘)", "목표·계획", "매일의 행동"]
    cw=380; gap=40; total=cw*4+gap*3; x0=(W-total)//2
    y0,y1=380,720
    for i,(s,sub) in enumerate(zip(steps,subs)):
        x=x0+i*(cw+gap)
        hot = (i==1)
        card(img, [x,y0,x+cw,y1], glow_outline=hot,
             outline=(*GOLD,200) if hot else (*GREY_DK,160), ow=2)
        text_glow(img,(x+cw//2,y0+90),f"{i+1}",F(EB,64),GOLD_LT if hot else GOLD_DK)
        text_shadow(img,(x+cw//2,y0+200),s,F(B,52),WHITE if hot else GREY)
        text_shadow(img,(x+cw//2,y0+285),sub,F(R,34),GOLD_LT if hot else GREY_DK)
        if i<3:
            ax=x+cw+gap//2
            d=ImageDraw.Draw(img)
            d.line([(ax-14,(y0+y1)//2),(ax+14,(y0+y1)//2)],fill=GOLD,width=4)
            d.polygon([(ax+14,(y0+y1)//2-10),(ax+14,(y0+y1)//2+10),(ax+30,(y0+y1)//2)],fill=GOLD)
    wrap_shadow(img, W//2, 850, ["자기표현은 흐릿한 바탕을 또렷하게 만드는 '첫 번째 다리'"],
                F(R, 40), GOLD_LT)
    save(img, "slides/ontology.png")

# ---------------------------------------------------------------
# 13 key_recap — 핵심 정리
# ---------------------------------------------------------------
def s_key_recap():
    img = base(13)
    tag(img, W//2, 180, "오늘의 핵심", F(B, 40))
    pts = [
        "자기표현 = 마음속의 나를 말과 글로 꺼내 다루는 일",
        "수백 편의 연구가 그 가치를 보여준다",
        "성경의 오랜 전통도 같은 방향을 가리킨다",
        "마음에만 두면 흐려지고, 적어두면 자산이 된다",
    ]
    y=350
    for p in pts:
        d=ImageDraw.Draw(img)
        text_glow(img,(360,y),"●",F(B,28),GOLD_LT)
        text_shadow(img,(W//2+40,y),p,F(R,44),WHITE)
        y+=130
    save(img, "slides/key_recap.png")

# ---------------------------------------------------------------
# 14 cta — CTA
# ---------------------------------------------------------------
def s_cta():
    img = base(14)
    wrap_shadow(img, W//2, 240, ["오늘, 단 몇 줄이라도 적어 보세요"], F(B, 50), GREY)
    wrap_glow(img, W//2, 430, ["\u201c나는 무엇을 위해", "사는가\u201d"], F(EB, 110), GOLD_LT, lh=1.25)
    divider(img, W//2, 640)
    wrap_shadow(img, W//2, 740,
                ["인생포트폴리오가 그 첫 표현을", "한 권의 리포트로 도와드립니다"],
                F(R, 50), WHITE, lh=1.4)
    tag(img, W//2, 920, "▶ 고정 댓글의 링크 확인", F(B, 42))
    save(img, "slides/cta.png")

if __name__ == "__main__":
    import os
    os.makedirs("slides", exist_ok=True)
    s_hook(); s_def_title(); s_not_show(); s_three_core(); s_pennebaker()
    s_research_scale(); s_change3(); s_one_sentence(); s_bible_title()
    s_psalm(); s_romans(); s_steward(); s_ontology(); s_key_recap(); s_cta()
    print("ALL SLIDES DONE")
