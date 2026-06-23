# -*- coding: utf-8 -*-
"""3편 '자기설계' 등급 A 슬라이드 제작 (15개).
1·2편 design.py 시스템 재사용. 8막 구조 매핑.
하버드/예일 3% 도시전설 완전 미언급(사용자 결정)."""
from design import *
from PIL import ImageDraw

TOTAL = 15  # 챕터 진행 점 개수

def base(idx):
    return bg_base(chapter_idx=idx, chapter_total=TOTAL)

# ---------------------------------------------------------------
# 00 hook — 후크 (또렷해졌으나 종이 위에 머무름)
# ---------------------------------------------------------------
def s_hook():
    img = base(0)
    tag(img, W//2, 250, "인생 자산화 · 3편", F(B, 40))
    wrap_glow(img, W//2, 460, ["또렷해졌는데,"], F(EB, 110), WHITE)
    wrap_glow(img, W//2, 600, ["왜 움직이지 않을까"], F(EB, 110), GOLD_LT)
    divider(img, W//2, 730)
    wrap_shadow(img, W//2, 830, ["또렷해진 나를 '설계도'로 옮기는 두 번째 열쇠"],
                F(R, 44), GREY)
    save(img, "slides/hook.png")

# ---------------------------------------------------------------
# 01 def_title — 오늘의 주제: 자기설계
# ---------------------------------------------------------------
def s_def_title():
    img = base(1)
    tag(img, W//2, 300, "오늘의 주제", F(B, 40))
    wrap_glow(img, W//2, 520, ["자기설계"], F(EB, 200), GOLD_LT)
    divider(img, W//2, 680)
    wrap_shadow(img, W//2, 780,
                ["또렷해진 나를 살아낼 수 있는", "'설계도'로 옮기는 일"],
                F(R, 52), WHITE, lh=1.4)
    save(img, "slides/def_title.png")

# ---------------------------------------------------------------
# 02 not_plan — 자기설계는 '완벽한 통제'가 아니다 (대비)
# ---------------------------------------------------------------
def s_not_plan():
    img = base(2)
    wrap_shadow(img, W//2, 230, ["자기설계란?"], F(B, 48), GREY)
    card(img, [180, 360, 920, 800], outline=(*GREY_DK,180), ow=2)
    card(img, [1000, 360, 1740, 800], glow_outline=True, outline=(*GOLD,200), ow=2)
    text_shadow(img, (550, 450), "✕  완벽한 통제", F(B, 54), (210,120,120))
    wrap_shadow(img, 550, 600, ["거창한 계획표,", "결과까지 움켜쥐기"], F(R, 42), GREY, lh=1.4)
    text_glow(img, (1370, 450), "○  살아낼 구조", F(B, 54), GOLD_LT)
    wrap_shadow(img, 1370, 600, ["흩어진 바람을", "따라갈 수 있는 길로"], F(R, 42), WHITE, lh=1.4)
    save(img, "slides/not_plan.png")

# ---------------------------------------------------------------
# 03 three_core — 자기설계 3핵심 (구체화·구조화·정렬)
# ---------------------------------------------------------------
def s_three_core():
    img = base(3)
    tag(img, W//2, 180, "자기설계의 세 가지 핵심", F(B, 40))
    items = [
        ("1", "구체화", "'잘 살자'를\n'무엇을 얼마나'로"),
        ("2", "구조화", "흩어진 바람을\n영역·우선순위·순서로"),
        ("3", "정렬", "늘 바탕(목적)에\n맞추어 둔다"),
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
# 04 locke — 로크 & 라삼 목표설정이론
# ---------------------------------------------------------------
def s_locke():
    img = base(4)
    tag(img, W//2, 230, "검증된 목표설정 연구", F(B, 40))
    wrap_glow(img, W//2, 430, ["에드윈 로크 & 게리 라삼"], F(EB, 72), GOLD_LT)
    divider(img, W//2, 560)
    wrap_shadow(img, W//2, 680,
                ["반세기에 걸쳐 밝혀온", "'목표가 사람을 움직이는 방식'"],
                F(R, 50), WHITE, lh=1.4)
    save(img, "slides/locke.png")

# ---------------------------------------------------------------
# 05 four_mech — 목표가 움직이는 4가지 메커니즘
# ---------------------------------------------------------------
def s_four_mech():
    img = base(5)
    tag(img, W//2, 160, "또렷한 목표가 우리를 움직이는 네 가지 방식", F(B, 38))
    items = [
        ("주의 집중", "그곳으로\n시선을 모은다"),
        ("노력 상승", "더 큰 힘을\n끌어낸다"),
        ("끈기 유지", "어려움 속에서도\n버티게 한다"),
        ("전략 탐색", "방법을\n찾도록 이끈다"),
    ]
    cw=380; gap=33; total=cw*4+gap*3; x0=(W-total)//2
    for i,(t,desc) in enumerate(items):
        x=x0+i*(cw+gap)
        card(img, [x, 340, x+cw, 820])
        text_glow(img,(x+cw//2,440),f"{i+1}",F(EB,72),GOLD_LT)
        text_shadow(img,(x+cw//2,560),t,F(B,46),WHITE)
        divider(img,x+cw//2,630,w=90)
        for j,line in enumerate(desc.split("\n")):
            text_shadow(img,(x+cw//2,700+j*52),line,F(R,34),GREY)
    save(img, "slides/four_mech.png")

# ---------------------------------------------------------------
# 06 matthews — 게일 매튜스: 글로 쓴 목표 (수치 단정 금지)
# ---------------------------------------------------------------
def s_matthews():
    img = base(6)
    tag(img, W//2, 230, "도미니칸 대학교 · 게일 매튜스", F(B, 40))
    wrap_glow(img, W//2, 460, ["목표를 '글로 적은' 사람들이"], F(EB, 78), WHITE)
    wrap_glow(img, W//2, 600, ["더 높은 성취를 보고했다"], F(EB, 78), GOLD_LT)
    divider(img, W//2, 740)
    wrap_shadow(img, W//2, 840, ["막연히 바라는 것과 또렷이 적어 설계하는 것은 다르다"],
                F(R, 42), GREY)
    save(img, "slides/matthews.png")

# ---------------------------------------------------------------
# 07 change3 — 설계가 만드는 변화 3
# ---------------------------------------------------------------
def s_change3():
    img = base(7)
    tag(img, W//2, 180, "설계가 만드는 변화", F(B, 40))
    items = [
        ("막연함 → 실행", "'언젠가'가\n'이번 달 이것 하나'로"),
        ("흩어짐 → 집중", "무엇이 먼저인지\n또렷해지면 모인다"),
        ("즉흥 → 끈기", "기분에 흔들려도\n돌아올 자리가 있다"),
    ]
    cw = 500; gap = 40
    total = cw*3 + gap*2
    x0 = (W - total)//2
    for i,(t,desc) in enumerate(items):
        x = x0 + i*(cw+gap)
        card(img, [x, 330, x+cw, 800])
        text_glow(img, (x+cw//2, 440), t, F(B, 46), GOLD_LT)
        divider(img, x+cw//2, 520, w=120)
        for j,line in enumerate(desc.split("\n")):
            text_shadow(img, (x+cw//2, 600+j*56), line, F(R, 38), WHITE)
    wrap_shadow(img, W//2, 900, ["설계가 모든 것을 보장하진 않습니다 — 그러나 다룰 수 있게 합니다"],
                F(R, 34), GREY_DK)
    save(img, "slides/change3.png")

# ---------------------------------------------------------------
# 07b one_design — 한 장의 설계도가 되는 순간 (4막 분할)
# ---------------------------------------------------------------
def s_one_design():
    img = base(7)
    wrap_glow(img, W//2, 460, ["막연하던 바람이", "한 장의 설계도가 될 때"], F(EB, 96), WHITE, lh=1.3)
    divider(img, W//2, 690)
    wrap_shadow(img, W//2, 800, ["비로소 우리는 그것을", "바라보고 다룰 수 있게 됩니다"],
                F(R, 50), GOLD_LT, lh=1.4)
    save(img, "slides/one_design.png")

# ---------------------------------------------------------------
# 08 bible_title — 더 깊은 뿌리: 성경 (잠언)
# ---------------------------------------------------------------
def s_bible_title():
    img = base(8)
    tag(img, W//2, 280, "더 깊은 뿌리", F(B, 40))
    wrap_glow(img, W//2, 500, ["부지런한 계획,", "겸손한 인도"], F(EB, 100), GOLD_LT, lh=1.3)
    divider(img, W//2, 720)
    wrap_shadow(img, W//2, 820, ["성경의 잠언 — 계획에 대해 두 가지를 함께 말합니다"],
                F(R, 46), WHITE)
    save(img, "slides/bible_title.png")

# ---------------------------------------------------------------
# 09 prov21 — 잠언 21:5 (부지런한 계획의 가치)
# ---------------------------------------------------------------
def s_prov21():
    img = base(9)
    tag(img, W//2, 190, "잠언 21장 5절", F(B, 40))
    card(img, [200, 320, W-200, 780], glow_outline=True, outline=(*GOLD,180), ow=2)
    wrap_shadow(img, W//2, 460,
                ["\u201c부지런한 자의 경영은"], F(B, 54), WHITE, lh=1.4)
    wrap_glow(img, W//2, 560, ["풍부함에 이를 것이나\u201d"], F(EB, 62), GOLD_LT)
    wrap_shadow(img, W//2, 690, ["— 성실히 헤아리고 설계하는 일이 삶을 풍성함으로 이끈다"],
                F(R, 38), GREY)
    save(img, "slides/prov21.png")

# ---------------------------------------------------------------
# 10 prov16 — 잠언 16:9 (걸음을 인도하시는 이는 여호와)
# ---------------------------------------------------------------
def s_prov16():
    img = base(10)
    tag(img, W//2, 190, "잠언 16장 9절", F(B, 40))
    wrap_shadow(img, W//2, 420,
                ["\u201c사람이 마음으로", "자기의 길을 계획할지라도,"], F(B, 52), WHITE, lh=1.35)
    wrap_glow(img, W//2, 620, ["인도하시는 이는 여호와시니라\u201d"], F(EB, 56), GOLD_LT)
    divider(img, W//2, 750)
    wrap_shadow(img, W//2, 840, ["부지런히 계획하되, 결과까지 움켜쥐지 않는다"],
                F(R, 46), GREY)
    save(img, "slides/prov16.png")

# ---------------------------------------------------------------
# 11 steward — 분별: 움켜쥠이 아니라 청지기의 일
# ---------------------------------------------------------------
def s_steward():
    img = base(11)
    tag(img, W//2, 230, "분별", F(B, 40))
    wrap_glow(img, W//2, 440, ["움켜쥠이 아니라,", "청지기의 일"], F(EB, 100), GOLD_LT, lh=1.3)
    divider(img, W//2, 660)
    wrap_shadow(img, W//2, 770,
                ["더 많이 가지기 위한 전략이 아니라", "주어진 것을 정직히 배치하고 결과는 맡기는 일"],
                F(R, 44), WHITE, lh=1.5)
    save(img, "slides/steward.png")

# ---------------------------------------------------------------
# 12 ontology — 온톨로지 4단계 흐름 (자기설계 hot)
# ---------------------------------------------------------------
def s_ontology():
    img = base(12)
    tag(img, W//2, 160, "인생 자산화의 흐름", F(B, 40))
    steps = ["자기이해", "자기표현", "자기설계", "자기실행"]
    subs  = ["바탕(목적)", "또렷하게", "목표·계획(오늘)", "매일의 행동"]
    cw=380; gap=40; total=cw*4+gap*3; x0=(W-total)//2
    y0,y1=380,720
    for i,(s,sub) in enumerate(zip(steps,subs)):
        x=x0+i*(cw+gap)
        hot = (i==2)
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
    wrap_shadow(img, W//2, 850, ["자기설계는 또렷해진 나를 목표·계획으로 옮기는 '두 번째 다리'"],
                F(R, 40), GOLD_LT)
    save(img, "slides/ontology.png")

# ---------------------------------------------------------------
# 13 key_recap — 핵심 정리
# ---------------------------------------------------------------
def s_key_recap():
    img = base(13)
    tag(img, W//2, 180, "오늘의 핵심", F(B, 40))
    pts = [
        "자기설계 = 또렷해진 나를 살아낼 설계도로 옮기는 일",
        "구체화 · 구조화 · 정렬, 세 가지 일이다",
        "검증된 연구도, 성경의 잠언도 그 가치를 보여준다",
        "부지런히 계획하되, 걸음의 인도는 여호와께 맡긴다",
    ]
    y=350
    for p in pts:
        text_glow(img,(360,y),"●",F(B,28),GOLD_LT)
        text_shadow(img,(W//2+40,y),p,F(R,44),WHITE)
        y+=130
    save(img, "slides/key_recap.png")

# ---------------------------------------------------------------
# 14 cta — CTA
# ---------------------------------------------------------------
def s_cta():
    img = base(14)
    wrap_shadow(img, W//2, 220, ["오늘, 단 하나라도 적어 보세요"], F(B, 50), GREY)
    wrap_glow(img, W//2, 400, ["\u201c올해 가장 중요한", "한 가지 목표는?\u201d"], F(EB, 92), GOLD_LT, lh=1.25)
    divider(img, W//2, 620)
    wrap_shadow(img, W//2, 720,
                ["그리고 한 줄 더 —", "'나는 무엇을 위해 이것을 하는가'"],
                F(R, 48), WHITE, lh=1.4)
    tag(img, W//2, 920, "▶ 고정 댓글의 링크 확인", F(B, 42))
    save(img, "slides/cta.png")

if __name__ == "__main__":
    import os
    os.makedirs("slides", exist_ok=True)
    s_hook(); s_def_title(); s_not_plan(); s_three_core()
    s_locke(); s_four_mech(); s_matthews(); s_change3(); s_one_design()
    s_bible_title(); s_prov21(); s_prov16(); s_steward()
    s_ontology(); s_key_recap(); s_cta()
    print("15 slides done")
