# -*- coding: utf-8 -*-
"""등급 A 고급 슬라이드 15종 생성.
design.py의 다큐 룩(비네팅 배경·드롭섀도우·글로우·그라데이션 카드) 사용."""
import os
import design as D
from design import (W, H, NAVY, NAVY_DK, NAVY_CARD, NAVY_CARD2, GOLD, GOLD_LT,
                    GOLD_DK, WHITE, GREY, GREY_DK, EB, B, R, F,
                    bg_base, text_shadow, text_glow, wrap_shadow, wrap_glow,
                    tag, divider, card, save)
from PIL import ImageDraw

ORDER = ["hook","def_title","three_cond","human_capital","self_asset","scattered",
         "role_report","root_asset","research1","research_fin","research2",
         "summary_dir","key_recap","cta_setup","cta_final"]
def CI(key):  # chapter index
    return ORDER.index(key)

def center(img, cx, y, text, font, fill, anchor="mm"):
    ImageDraw.Draw(img).text((cx, y), text, font=font, fill=fill, anchor=anchor)

# ---------------- 슬라이드 ----------------
def s_hook():
    img = bg_base(CI("hook"))
    tag(img, W//2, 165, "FOUNDATION ASSET", F(B,40))
    wrap_shadow(img, W//2, 455, ["통장보다 먼저 쌓아야 할"], F(EB,96), WHITE)
    wrap_glow(img, W//2, 615, ["단 하나의 자산"], F(EB,132), GOLD)
    divider(img, W//2, 725)
    wrap_shadow(img, W//2, 815, ["돈·커리어·건강이 자라나는 '바탕'"], F(B,52), GREY)
    return img

def s_def_title():
    img = bg_base(CI("def_title"))
    text_glow(img, (W//2, 350), "Q.", F(EB,140), GOLD)
    wrap_shadow(img, W//2, 600, ["'자산'이란", "정확히 무엇일까?"], F(EB,112), WHITE)
    return img

def s_three_cond():
    img = bg_base(CI("three_cond"))
    text_shadow(img, (W//2, 150), "자산의 3가지 조건", F(EB,80), WHITE)
    divider(img, W//2, 235, w=150)
    items = [("01","미래 가치","앞으로 가치를\n만들어낸다"),
             ("02","통제 가능","내 의지로\n다룰 수 있다"),
             ("03","축적 가능","시간이 갈수록\n쌓인다")]
    cw, gap = 510, 50
    tot = cw*3 + gap*2; x0 = (W - tot)//2
    for i,(n,t,desc) in enumerate(items):
        x = x0 + i*(cw+gap)
        card(img, [x,340,x+cw,840], radius=30, glow_outline=True, outline=GOLD_DK, ow=2)
        text_glow(img, (x+cw//2,445), n, F(EB,90), GOLD)
        center(img, x+cw//2, 478, "·"*7, F(B,30), GOLD_DK)
        text_shadow(img, (x+cw//2,575), t, F(EB,60), WHITE)
        for j,ln in enumerate(desc.split("\n")):
            center(img, x+cw//2, 665+j*58, ln, F(B,40), GREY)
    return img

def s_human_capital():
    img = bg_base(CI("human_capital"))
    tag(img, W//2, 175, "노벨 경제학상 이론", F(B,40))
    wrap_shadow(img, W//2, 460, ["사람의 '지식·기술·자기이해'도"], F(EB,82), WHITE)
    wrap_glow(img, W//2, 615, ["인적자본 = 자산이다"], F(EB,108), GOLD)
    divider(img, W//2, 720)
    wrap_shadow(img, W//2, 805, ["Human Capital Theory"], F(B,44), GREY)
    return img

def s_self_asset():
    img = bg_base(CI("self_asset"))
    wrap_shadow(img, W//2, 350, ["내가 무엇을 원하고,","무엇을 잘하고,","어디로 가고 싶은지 아는 것"], F(EB,80), WHITE)
    divider(img, W//2, 660)
    wrap_glow(img, W//2, 770, ["그 자체가 강력한 자산입니다"], F(EB,76), GOLD)
    return img

def s_scattered():
    img = bg_base(CI("scattered"))
    wrap_shadow(img, W//2, 330, ["하지만 마음속에","흩어져 있는 생각은"], F(EB,82), WHITE)
    wrap_glow(img, W//2, 615, ["자산이 되지 못합니다"], F(EB,98), GOLD)
    divider(img, W//2, 720)
    wrap_shadow(img, W//2, 810, ["통제할 수도, 쌓을 수도 없으니까"], F(B,48), GREY)
    return img

def s_role_report():
    img = bg_base(CI("role_report"))
    text_shadow(img, (W//2, 160), "인생포트폴리오가 하는 일", F(EB,72), WHITE)
    divider(img, W//2, 245, w=150)
    lx, rx = W//2-560, W//2+560
    card(img, [lx-265,425,lx+265,650], radius=26, outline=GREY_DK, ow=2)
    wrap_shadow(img, lx, 537, ["흩어진","나에 대한 이해"], F(B,52), GREY)
    # 골드 화살표 (글로우)
    from PIL import Image, ImageFilter
    gl = Image.new("RGBA", img.size, (0,0,0,0))
    gd = ImageDraw.Draw(gl)
    arrow = [(W//2-90,500),(W//2-90,575),(W//2+25,575),(W//2+25,615),(W//2+125,537),(W//2+25,460),(W//2+25,500)]
    gd.polygon(arrow, fill=(*GOLD,160))
    gl = gl.filter(ImageFilter.GaussianBlur(8))
    img.paste(gl,(0,0),gl)
    ImageDraw.Draw(img).polygon(arrow, fill=GOLD)
    card(img, [rx-265,425,rx+265,650], radius=26, fill_top=GOLD_LT, fill_bot=GOLD, glow_outline=True)
    wrap_shadow(img, rx, 537, ["한 권의","리포트(자산)"], F(EB,54), NAVY_DK, shadow=(255,255,255,60), offset=(0,2), blur=3)
    wrap_shadow(img, W//2, 800, ["통제 가능 · 축적 가능한 진짜 자산"], F(B,50), WHITE)
    return img

def s_root_asset():
    img = bg_base(CI("root_asset"))
    wrap_shadow(img, W//2, 410, ["인생포트폴리오는","다른 모든 자산이 자라나는"], F(EB,84), WHITE)
    divider(img, W//2, 640)
    wrap_glow(img, W//2, 760, ["바탕이 되는 자산"], F(EB,110), GOLD)
    return img

def s_research1():
    """차트 애니메이션이 들어갈 슬라이드 — 배경(카드 틀)만, 숫자는 비움."""
    img = bg_base(CI("research1"))
    tag(img, W//2, 150, "연구로 증명된 사실", F(B,40))
    center(img, W//2, 320, "미국 4,660명 · 십수 년 추적", F(EB,66), WHITE)
    center(img, W//2, 408, "(Hill et al., 2016 · MIDUS)", F(B,38), GREY)
    cards = [("소득 증가","$4,400"),("순자산 증가","$20,000")]
    cw, gap = 620, 80
    tot = cw*2+gap; x0 = (W-tot)//2
    for i,(t,v) in enumerate(cards):
        x = x0 + i*(cw+gap)
        card(img, [x,520,x+cw,840], radius=30, glow_outline=True, outline=GOLD_DK, ow=2)
        center(img, x+cw//2, 600, t, F(B,52), GREY)
    return img  # 숫자는 차트 애니메이션에서 오버레이

def s_research_fin():
    img = bg_base(CI("research_fin"))
    wrap_shadow(img, W//2, 410, ["삶의 목적이 또렷한 것만으로"], F(EB,80), WHITE)
    wrap_glow(img, W//2, 575, ["실제 '돈'의 차이가 생긴다"], F(EB,98), GOLD)
    divider(img, W//2, 690)
    wrap_shadow(img, W//2, 780, ["자기이해 → 재무적 자산으로 연결"], F(B,48), GREY)
    return img

def s_research2():
    img = bg_base(CI("research2"))
    text_shadow(img, (W//2, 160), "자기이해는 '돈'만이 아니다", F(EB,72), WHITE)
    divider(img, W//2, 245, w=150)
    rows = [("재무 역량 ↑","건강 상태 ↑"),("일의 소명 ↑","만족도 ↑"),("삶의 의미 ↑","행복 ↑")]
    y = 350
    for a,b in rows:
        card(img, [W//2-700,y,W//2-40,y+150], radius=22, outline=GREY_DK, ow=2)
        center(img, W//2-370, y+75, a, F(B,50), WHITE)
        text_glow(img, (W//2, y+75), "→", F(EB,62), GOLD)
        card(img, [W//2+40,y,W//2+700,y+150], radius=22, glow_outline=True, outline=GOLD_DK, ow=2)
        center(img, W//2+370, y+75, b, F(EB,52), GOLD)
        y += 200
    return img

def s_summary_dir():
    img = bg_base(CI("summary_dir"))
    wrap_shadow(img, W//2, 400, ["모든 연구가","한 방향을 가리킵니다"], F(EB,92), WHITE)
    divider(img, W//2, 620)
    wrap_glow(img, W//2, 730, ["나를 이해하고 정리하는 것 =","소득·건강·행복의 바탕"], F(B,56), GOLD)
    return img

def s_key_recap():
    img = bg_base(CI("key_recap"))
    text_glow(img, (W//2, 150), "핵심 정리", F(EB,80), GOLD)
    divider(img, W//2, 235, w=150)
    lines = ["자산의 조건: 미래가치 · 통제가능 · 축적가능",
             "나를 이해하는 것 = 강력한 자산",
             "흩어져 있으면 자산이 되지 못한다",
             "인생포트폴리오 = 흩어진 나를 한 권의 자산으로"]
    y = 360
    d = ImageDraw.Draw(img)
    for ln in lines:
        # 체크 골드 원
        from PIL import Image, ImageFilter
        gl = Image.new("RGBA", img.size, (0,0,0,0))
        ImageDraw.Draw(gl).ellipse([W//2-560,y+6,W//2-526,y+40], fill=(*GOLD,150))
        gl = gl.filter(ImageFilter.GaussianBlur(6)); img.paste(gl,(0,0),gl)
        d = ImageDraw.Draw(img)
        d.ellipse([W//2-560,y+6,W//2-526,y+40], fill=GOLD)
        d.text((W//2-543,y+22), "✓", font=F(B,26), fill=NAVY_DK, anchor="mm")
        text_shadow(img, (W//2-490,y+23), ln, F(B,52), WHITE, anchor="lm", offset=(0,3), blur=5)
        y += 140
    return img

def s_cta_setup():
    img = bg_base(CI("cta_setup"))
    wrap_shadow(img, W//2, 380, ["내 안에 흩어진 조각들,"], F(EB,86), WHITE)
    wrap_glow(img, W//2, 545, ["한번 제대로 정리해볼까요?"], F(EB,86), GOLD)
    tag(img, W//2, 770, "76문항 · 15분 · 결제 즉시 리포트 자동 생성", F(B,44))
    return img

def s_cta_final():
    img = bg_base(CI("cta_final"))
    center(img, W//2, 195, "평생 쌓아갈 자산의 첫 페이지", F(EB,66), WHITE)
    text_glow(img, (W//2, 395), "단 9,900원", F(EB,156), GOLD)
    center(img, W//2, 540, "커피 한 잔 값으로 시작하세요", F(B,50), GREY)
    card(img, [W//2-585,680,W//2+585,835], radius=30, fill_top=GOLD_LT, fill_bot=GOLD, glow_outline=True)
    center(img, W//2, 757, "▶  고정 댓글의 링크를 눌러주세요", F(EB,58), NAVY_DK)
    center(img, W//2, 920, "lifeportfolio.co.kr", F(B,52), WHITE)
    return img

BUILDERS = {
 "hook":s_hook,"def_title":s_def_title,"three_cond":s_three_cond,
 "human_capital":s_human_capital,"self_asset":s_self_asset,"scattered":s_scattered,
 "role_report":s_role_report,"root_asset":s_root_asset,"research1":s_research1,
 "research_fin":s_research_fin,"research2":s_research2,"summary_dir":s_summary_dir,
 "key_recap":s_key_recap,"cta_setup":s_cta_setup,"cta_final":s_cta_final,
}

if __name__ == "__main__":
    os.makedirs("slides", exist_ok=True)
    for k, fn in BUILDERS.items():
        save(fn(), f"slides/{k}.png")
    print("ALL SLIDES DONE")
