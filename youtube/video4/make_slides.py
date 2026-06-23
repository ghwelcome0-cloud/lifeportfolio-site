# -*- coding: utf-8 -*-
"""4편 '자기실행' 등급 A 슬라이드 제작.
1·2·3편 design.py 시스템 재사용. 8막 구조 매핑.
숫자 단정 안전장치: 골비처 메타분석 '중간~큰 효과', 랠리 '평균 약 66일·개인차 큼'."""
from design import *
from PIL import ImageDraw

TOTAL = 8  # 8막 → 챕터 진행 점 8개

def base(idx):
    return bg_base(chapter_idx=idx, chapter_total=TOTAL)

# ===============================================================
# 1막 — 후크 (설계도는 그렸는데 움직이지 않는다)
# ===============================================================
def s_hook():
    img = base(0)
    tag(img, W//2, 250, "인생 자산화 · 4편", F(B, 40))
    wrap_glow(img, W//2, 460, ["설계도는 그렸는데,"], F(EB, 104), WHITE)
    wrap_glow(img, W//2, 600, ["왜 살아지지 않을까"], F(EB, 104), GOLD_LT)
    divider(img, W//2, 730)
    wrap_shadow(img, W//2, 830, ["설계된 나를 매일의 행동으로 옮기는 마지막 열쇠"],
                F(R, 44), GREY)
    save(img, "slides/hook.png")

def s_hook2():
    img = base(0)
    wrap_glow(img, W//2, 420, ["마음은 분명히 먹었는데", "몸은 어제와 똑같다"], F(EB, 88), WHITE, lh=1.3)
    divider(img, W//2, 650)
    wrap_shadow(img, W//2, 760,
                ["오늘은 그 마지막 세 번째 열쇠,", "'자기실행'에 대해 이야기합니다"],
                F(R, 50), GOLD_LT, lh=1.4)
    save(img, "slides/hook2.png")

# ===============================================================
# 2막 — 정의 (자기실행은 독한 의지가 아니다)
# ===============================================================
def s_def_title():
    img = base(1)
    tag(img, W//2, 300, "오늘의 주제", F(B, 40))
    wrap_glow(img, W//2, 520, ["자기실행"], F(EB, 200), GOLD_LT)
    divider(img, W//2, 680)
    wrap_shadow(img, W//2, 780,
                ["설계된 나를 매일의 행동과", "습관으로 살아내는 일"],
                F(R, 52), WHITE, lh=1.4)
    save(img, "slides/def_title.png")

def s_not_will():
    img = base(1)
    wrap_shadow(img, W//2, 230, ["자기실행이란?"], F(B, 48), GREY)
    card(img, [180, 360, 920, 800], outline=(*GREY_DK,180), ow=2)
    card(img, [1000, 360, 1740, 800], glow_outline=True, outline=(*GOLD,200), ow=2)
    text_shadow(img, (550, 450), "\u2715  더 독한 의지", F(B, 54), (210,120,120))
    wrap_shadow(img, 550, 600, ["마음을 쥐어짜", "버티는 일"], F(R, 42), GREY, lh=1.4)
    text_glow(img, (1370, 450), "\u25cb  저절로 되는 구조", F(B, 50), GOLD_LT)
    wrap_shadow(img, 1370, 600, ["설계가 자연히", "행동이 되도록"], F(R, 42), WHITE, lh=1.4)
    save(img, "slides/not_will.png")

def s_def_body():
    img = base(1)
    wrap_glow(img, W//2, 440, ["의지를 쥐어짜는 게 아니라"], F(EB, 78), WHITE)
    wrap_glow(img, W//2, 580, ["구조를 만드는 일"], F(EB, 88), GOLD_LT)
    divider(img, W//2, 720)
    wrap_shadow(img, W//2, 820, ["설계가 저절로 행동이 되도록 길을 놓는다"],
                F(R, 46), GREY)
    save(img, "slides/def_body.png")

# ===============================================================
# 3막 — 세 가지 핵심 (연결·반복·자동화)
# ===============================================================
def s_three_title():
    img = base(2)
    wrap_glow(img, W//2, 470, ["자기실행의", "세 가지 핵심"], F(EB, 110), GOLD_LT, lh=1.25)
    divider(img, W//2, 760)
    wrap_shadow(img, W//2, 860, ["연결 · 반복 · 자동화"], F(B, 50), WHITE)
    save(img, "slides/three_title.png")

def s_three_core():
    img = base(2)
    tag(img, W//2, 180, "자기실행의 세 가지 핵심", F(B, 40))
    items = [
        ("1", "연결", "막연한 목표를\n'언제·어디서·무엇'에 묶는다"),
        ("2", "반복", "한 번의 결심이 아니라\n같은 맥락에서 되풀이"),
        ("3", "자동화", "반복이 쌓이면\n의지를 덜 쓰는 습관이 된다"),
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
            text_shadow(img, (x+cw//2, 670+j*54), line, F(R, 34), GREY)
    save(img, "slides/three_core.png")

# ===============================================================
# 3막 후반 — if-then 실행의도 연구 (골비처)
# ===============================================================
def s_research_intro():
    img = base(2)
    tag(img, W//2, 250, "통념이 아니라 연구로 확인된 것", F(B, 40))
    wrap_glow(img, W//2, 470, ["실행은 '의지'가 아니라", "'구조'의 문제"], F(EB, 92), WHITE, lh=1.3)
    divider(img, W//2, 700)
    wrap_shadow(img, W//2, 800, ["그 첫 번째 갈래 — 실행의도(if-then) 연구"],
                F(R, 46), GOLD_LT)
    save(img, "slides/research_intro.png")

def s_ifthen():
    img = base(2)
    tag(img, W//2, 200, "심리학자 피터 골비처", F(B, 40))
    card(img, [180, 350, 920, 760], outline=(*GREY_DK,180), ow=2)
    card(img, [1000, 350, 1740, 760], glow_outline=True, outline=(*GOLD,200), ow=2)
    text_shadow(img, (550, 450), "막연한 다짐", F(B, 50), GREY)
    wrap_shadow(img, 550, 580, ["\u201c운동을", "하겠다\u201d"], F(R, 44), GREY_DK, lh=1.4)
    text_glow(img, (1370, 450), "if-then 계획", F(B, 50), GOLD_LT)
    wrap_shadow(img, 1370, 580, ["\u201cX 상황이 오면,", "Y를 한다\u201d"], F(R, 44), WHITE, lh=1.4)
    wrap_shadow(img, W//2, 850, ["후자가 훨씬 더 자주 실제 '행동'으로 이어졌다"],
                F(R, 44), GOLD_LT)
    save(img, "slides/ifthen.png")

def s_ifthen_meta():
    img = base(2)
    tag(img, W//2, 260, "94개 연구를 종합한 메타분석", F(B, 40))
    wrap_glow(img, W//2, 480, ["그 효과는", "중간에서 큰 수준"], F(EB, 96), GOLD_LT, lh=1.3)
    divider(img, W//2, 720)
    wrap_shadow(img, W//2, 820, ["상황에 미리 묶어두면, 그 순간 '할까 말까'를 새로 고민하지 않는다"],
                F(R, 42), WHITE)
    save(img, "slides/ifthen_meta.png")

def s_ifthen_ex():
    img = base(2)
    tag(img, W//2, 190, "예시 — 신호가 행동을 시작시킨다", F(B, 40))
    card(img, [180, 340, 920, 770], outline=(*GREY_DK,180), ow=2)
    card(img, [1000, 340, 1740, 770], glow_outline=True, outline=(*GOLD,200), ow=2)
    wrap_shadow(img, 550, 470, ["\u201c책을", "많이 읽자\u201d"], F(B, 50), GREY, lh=1.35)
    text_shadow(img, (550, 690), "막연한 다짐", F(R, 34), GREY_DK)
    wrap_glow(img, 1370, 470, ["\u201c저녁 9시 소파에 앉으면", "책 10쪽을 읽는다\u201d"], F(B, 40), WHITE, lh=1.4)
    text_glow(img, (1370, 690), "상황 = 신호", F(R, 34), GOLD_LT)
    wrap_shadow(img, W//2, 850, ["의지의 부담을, 구조가 대신 져준다"],
                F(R, 44), GOLD_LT)
    save(img, "slides/ifthen_ex.png")

# ===============================================================
# 4막 — 습관 형성 연구 (필리파 랠리 · 66일)
# ===============================================================
def s_lally_title():
    img = base(3)
    tag(img, W//2, 230, "두 번째 갈래 — 습관 형성 연구", F(B, 40))
    wrap_glow(img, W//2, 440, ["필리파 랠리 연구진"], F(EB, 80), GOLD_LT)
    divider(img, W//2, 580)
    wrap_shadow(img, W//2, 690,
                ["새로운 행동이 '저절로' 느껴지기까지", "어떤 과정을 거치는지 관찰했다"],
                F(R, 48), WHITE, lh=1.4)
    save(img, "slides/lally_title.png")

def s_lally_66():
    img = base(3)
    tag(img, W//2, 220, "습관이 자리잡기까지", F(B, 40))
    wrap_glow(img, W//2, 450, ["평균 약 66일,"], F(EB, 110), GOLD_LT)
    wrap_glow(img, W//2, 590, ["두 달가량"], F(EB, 110), WHITE)
    divider(img, W//2, 730)
    wrap_shadow(img, W//2, 830, ["다만 사람·행동에 따라 편차가 매우 컸다 (짧게는 며칠, 길게는 여러 달)"],
                F(R, 40), GREY)
    save(img, "slides/lally_66.png")

def s_lally_context():
    img = base(3)
    wrap_glow(img, W//2, 440, ["무엇보다 중요한 것은"], F(EB, 76), WHITE)
    wrap_glow(img, W//2, 580, ["같은 맥락에서의 꾸준한 반복"], F(EB, 72), GOLD_LT)
    divider(img, W//2, 720)
    wrap_shadow(img, W//2, 820, ["기간 자체보다, 같은 자리에서 되풀이하는 일이 핵심이었다"],
                F(R, 44), GREY)
    save(img, "slides/lally_context.png")

def s_research_concl():
    img = base(3)
    tag(img, W//2, 230, "두 연구가 함께 가리키는 결론", F(B, 40))
    wrap_glow(img, W//2, 460,
              ["더 강한 의지가 아니라,", "상황에 묶인 행동을", "같은 자리에서 꾸준히"],
              F(EB, 70), GOLD_LT, lh=1.3)
    save(img, "slides/research_concl.png")

# ===============================================================
# 5막 — 완벽이 아니라 꾸준함 (+ 성경 누가복음 16:10)
# ===============================================================
def s_not_perfect():
    img = base(4)
    tag(img, W//2, 200, "한 가지 무거운 부담에서 자유로워진다", F(B, 40))
    card(img, [180, 350, 920, 790], outline=(*GREY_DK,180), ow=2)
    card(img, [1000, 350, 1740, 790], glow_outline=True, outline=(*GOLD,200), ow=2)
    text_shadow(img, (550, 450), "\u2715  완벽함", F(B, 54), (210,120,120))
    wrap_shadow(img, 550, 600, ["한 번도 어기지", "않는 것"], F(R, 42), GREY, lh=1.4)
    text_glow(img, (1370, 450), "\u25cb  꾸준함", F(B, 54), GOLD_LT)
    wrap_shadow(img, 1370, 600, ["어긋난 날에도 다시", "같은 자리로 돌아옴"], F(R, 42), WHITE, lh=1.4)
    wrap_shadow(img, W//2, 880, ["중요한 것은 넘어진 자리에서 다시 시작하는 '회복력'"],
                F(R, 42), GOLD_LT)
    save(img, "slides/not_perfect.png")

def s_bible_title():
    img = base(4)
    tag(img, W//2, 300, "오래된 지혜도 같은 방향을 가리킨다", F(B, 40))
    wrap_glow(img, W//2, 520, ["작은 것에", "충성된 자"], F(EB, 110), GOLD_LT, lh=1.25)
    divider(img, W//2, 780)
    wrap_shadow(img, W//2, 870, ["성경은 이렇게 말합니다"], F(R, 46), WHITE)
    save(img, "slides/bible_title.png")

def s_luke16():
    img = base(4)
    tag(img, W//2, 190, "누가복음 16장 10절", F(B, 40))
    card(img, [200, 320, W-200, 760], glow_outline=True, outline=(*GOLD,180), ow=2)
    wrap_shadow(img, W//2, 450,
                ["\u201c지극히 작은 것에 충성된 자는"], F(B, 52), WHITE)
    wrap_glow(img, W//2, 560, ["큰 것에도 충성된다\u201d"], F(EB, 62), GOLD_LT)
    wrap_shadow(img, W//2, 690, ["큰 결심의 폭발보다, 작은 것에 성실히 머무는 꾸준함이 더 멀리 간다"],
                F(R, 38), GREY)
    save(img, "slides/luke16.png")

# ===============================================================
# 6막 — 분별: 자기증명 아니라 겸손한 실행
# ===============================================================
def s_humble_title():
    img = base(5)
    tag(img, W//2, 230, "분별 — 한 가지 방향은 분명히", F(B, 40))
    card(img, [180, 360, 920, 800], outline=(*GREY_DK,180), ow=2)
    card(img, [1000, 360, 1740, 800], glow_outline=True, outline=(*GOLD,200), ow=2)
    text_shadow(img, (550, 450), "\u2715  자기 증명", F(B, 52), (210,120,120))
    wrap_shadow(img, 550, 600, ["내 의지만으로", "다 이뤄내는 일"], F(R, 42), GREY, lh=1.4)
    text_glow(img, (1370, 450), "\u25cb  겸손한 실행", F(B, 52), GOLD_LT)
    wrap_shadow(img, 1370, 600, ["한계를 인정하고", "작은 반복에 머묾"], F(R, 42), WHITE, lh=1.4)
    save(img, "slides/humble_title.png")

def s_humble_body():
    img = base(5)
    wrap_glow(img, W//2, 430, ["결과를 다 움켜쥐기보다"], F(EB, 76), WHITE)
    wrap_glow(img, W//2, 570, ["오늘 주어진 한 걸음에 충실히"], F(EB, 70), GOLD_LT)
    divider(img, W//2, 720)
    wrap_shadow(img, W//2, 820, ["그 태도가 결국 더 멀리 간다"], F(R, 48), GREY)
    save(img, "slides/humble_body.png")

# ===============================================================
# 7막 — 온톨로지 4단계 + 나선형 순환 (자기실행 hot)
# ===============================================================
def s_ontology():
    img = base(6)
    wrap_glow(img, W//2, 460, ["발견하고 표현하고 설계한", "모든 일은,"], F(EB, 80), WHITE, lh=1.3)
    wrap_glow(img, W//2, 680, ["결국 '살아내기' 위한 준비였다"], F(EB, 72), GOLD_LT)
    divider(img, W//2, 820)
    wrap_shadow(img, W//2, 900, ["설계도는 '지어질 때' 비로소 집이 된다"], F(R, 44), GREY)
    save(img, "slides/ontology.png")

def s_four_steps():
    img = base(6)
    tag(img, W//2, 160, "이제 네 걸음이 하나로 이어진다", F(B, 38))
    steps = ["자기이해", "자기표현", "자기설계", "자기실행"]
    subs  = ["바탕(목적)", "또렷하게", "목표·계획", "매일의 행동"]
    cw=380; gap=40; total=cw*4+gap*3; x0=(W-total)//2
    y0,y1=380,720
    for i,(s,sub) in enumerate(zip(steps,subs)):
        x=x0+i*(cw+gap)
        hot = (i==3)
        card(img, [x,y0,x+cw,y1], glow_outline=hot,
             outline=(*GOLD,200) if hot else (*GREY_DK,160), ow=2)
        text_glow(img,(x+cw//2,y0+90),f"{i+1}",F(EB,64),GOLD_LT if hot else GOLD_DK)
        text_shadow(img,(x+cw//2,y0+200),s,F(B,52),WHITE if hot else GREY)
        text_shadow(img,(x+cw//2,y0+285),sub,F(R,34),GOLD_LT if hot else GREY_DK)
        if i<3:
            ax=x+cw+gap//2
            d=ImageDraw.Draw(img)
            cy=(y0+y1)//2
            d.line([(ax-14,cy),(ax+14,cy)],fill=GOLD,width=4)
            d.polygon([(ax+14,cy-10),(ax+14,cy+10),(ax+30,cy)],fill=GOLD)
    wrap_shadow(img, W//2, 850, ["자기실행은 설계를 매일의 행동으로 살아내어 '실제 자산'으로 쌓는 마지막 다리"],
                F(R, 38), GOLD_LT)
    save(img, "slides/four_steps.png")

def s_spiral():
    img = base(6)
    tag(img, W//2, 250, "한 번 걷고 끝나는 직선이 아니다", F(B, 40))
    wrap_glow(img, W//2, 470, ["실행의 경험은", "다시 자기이해를 또렷하게"], F(EB, 80), WHITE, lh=1.3)
    divider(img, W//2, 700)
    wrap_shadow(img, W//2, 800, ["그렇게 같은 자리를 한 바퀴 더 깊이 돌게 된다"],
                F(R, 46), GOLD_LT)
    save(img, "slides/spiral.png")

def s_spiral2():
    img = base(6)
    wrap_glow(img, W//2, 480, ["발견할수록 또렷해지고,", "살아낼수록 깊어지는"], F(EB, 88), WHITE, lh=1.3)
    wrap_glow(img, W//2, 720, ["나선형의 성장"], F(EB, 96), GOLD_LT)
    save(img, "slides/spiral2.png")

# ===============================================================
# 8막 — 핵심정리 + CTA
# ===============================================================
def s_recap():
    img = base(7)
    tag(img, W//2, 180, "오늘의 핵심", F(B, 40))
    pts = [
        "자기실행 = 설계된 나를 매일의 행동·습관으로 살아내는 일",
        "연결 · 반복 · 자동화, 세 가지로 구조를 만든다",
        "완벽이 아니라 꾸준함 — 넘어진 자리에서 다시 시작",
        "작은 것에 충성하며, 결과는 겸손히 맡긴다",
    ]
    y=350
    for p in pts:
        text_glow(img,(330,y),"\u25cf",F(B,28),GOLD_LT)
        text_shadow(img,(W//2+30,y),p,F(R,42),WHITE)
        y+=130
    save(img, "slides/recap.png")

def s_recap2():
    img = base(7)
    wrap_shadow(img, W//2, 240, ["오늘, 단 하나라도 적어 보세요"], F(B, 50), GREY)
    wrap_glow(img, W//2, 430, ["\u201c어떤 상황이 오면,", "무엇을 한다\u201d"], F(EB, 92), GOLD_LT, lh=1.25)
    divider(img, W//2, 660)
    wrap_shadow(img, W//2, 760,
                ["그리고 그것을 같은 자리에서,", "작게 반복해 보세요"],
                F(R, 50), WHITE, lh=1.4)
    save(img, "slides/recap2.png")

def s_cta():
    img = base(7)
    wrap_glow(img, W//2, 360, ["그 한 번의 실행이,"], F(EB, 80), WHITE)
    wrap_glow(img, W//2, 500, ["설계도를 살아 있는 자산으로"], F(EB, 70), GOLD_LT)
    divider(img, W//2, 660)
    wrap_shadow(img, W//2, 760,
                ["인생 포트폴리오는 발견부터 실행까지", "그 모든 길을 한 권의 리포트로 돕습니다"],
                F(R, 46), GREY, lh=1.4)
    tag(img, W//2, 940, "\u25b6 고정 댓글의 링크 확인", F(B, 42))
    save(img, "slides/cta.png")

if __name__ == "__main__":
    import os
    os.makedirs("slides", exist_ok=True)
    s_hook(); s_hook2()
    s_def_title(); s_not_will(); s_def_body()
    s_three_title(); s_three_core()
    s_research_intro(); s_ifthen(); s_ifthen_meta(); s_ifthen_ex()
    s_lally_title(); s_lally_66(); s_lally_context(); s_research_concl()
    s_not_perfect(); s_bible_title(); s_luke16()
    s_humble_title(); s_humble_body()
    s_ontology(); s_four_steps(); s_spiral(); s_spiral2()
    s_recap(); s_recap2(); s_cta()
    print("27 slides done")
