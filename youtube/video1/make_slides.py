# -*- coding: utf-8 -*-
"""15개 섹션 슬라이드 배경(1920x1080) 생성. 네이비+골드+화이트 디자인."""
from PIL import Image, ImageDraw, ImageFont
import math, os

W,H = 1920,1080
NAVY=(39,56,74)        # #27384A
NAVY_DK=(28,41,55)
GOLD=(200,162,74)      # #C8A24A
GOLD_LT=(224,193,122)
WHITE=(245,247,250)
GREY=(150,165,180)

EB="font_eb.ttf"; B="font_b.ttf"
def F(path,size): return ImageFont.truetype(path,size)

def grad_bg():
    img=Image.new("RGB",(W,H),NAVY)
    d=ImageDraw.Draw(img)
    for y in range(H):
        r=y/H
        c=(int(NAVY[0]*(1-r)+NAVY_DK[0]*r),
           int(NAVY[1]*(1-r)+NAVY_DK[1]*r),
           int(NAVY[2]*(1-r)+NAVY_DK[2]*r))
        d.line([(0,y),(W,y)],fill=c)
    # 우상단 은은한 골드 글로우
    glow=Image.new("RGB",(W,H),(0,0,0))
    gd=ImageDraw.Draw(glow)
    for rad in range(600,0,-20):
        a=int(18*(1-rad/600))
        gd.ellipse([W-300-rad,-200-rad,W-300+rad,-200+rad],fill=(a,int(a*0.8),int(a*0.3)))
    img=Image.blend(img,Image.composite(glow,img,glow.convert("L")),0.0)
    return img

def center_text(d,cx,y,text,font,fill,anchor="mm"):
    d.text((cx,y),text,font=font,fill=fill,anchor=anchor)

def wrap_center(d,cx,cy,lines,font,fill,lh=1.35,anchor="mm"):
    sizes=[d.textbbox((0,0),l,font=font) for l in lines]
    hs=[(b[3]-b[1]) for b in sizes]
    line_h=int(font.size*lh)
    total=line_h*len(lines)
    y=cy-total//2+line_h//2
    for l in lines:
        d.text((cx,y),l,font=font,fill=fill,anchor="mm")
        y+=line_h

def tag(d,cx,y,text,font):
    """골드 라벨 박스"""
    b=d.textbbox((0,0),text,font=font); tw=b[2]-b[0]; th=b[3]-b[1]
    pad=24
    d.rounded_rectangle([cx-tw//2-pad,y-th//2-16,cx+tw//2+pad,y+th//2+16],radius=14,fill=GOLD)
    d.text((cx,y),text,font=font,fill=NAVY,anchor="mm")

def save(img,name):
    img.save(name,quality=92)
    print("saved",name)

# ---------- 슬라이드 빌더 ----------
def s_hook():
    img=grad_bg(); d=ImageDraw.Draw(img)
    tag(d,W//2,170,"FOUNDATION ASSET",F(B,40))
    wrap_center(d,W//2,470,["통장보다 먼저 쌓아야 할"],F(EB,96),WHITE)
    wrap_center(d,W//2,620,["단 하나의 자산"],F(EB,128),GOLD)
    wrap_center(d,W//2,800,["돈·커리어·건강이 자라나는 '바탕'"],F(B,52),GREY)
    return img

def s_def_title():
    img=grad_bg(); d=ImageDraw.Draw(img)
    center_text(d,W//2,360,"Q.",F(EB,120),GOLD)
    wrap_center(d,W//2,560,["'자산'이란","정확히 무엇일까?"],F(EB,110),WHITE)
    return img

def s_three_cond():
    img=grad_bg(); d=ImageDraw.Draw(img)
    center_text(d,W//2,150,"자산의 3가지 조건",F(EB,80),WHITE)
    items=[("01","미래 가치","앞으로 가치를\n만들어낸다"),
           ("02","통제 가능","내 의지로\n다룰 수 있다"),
           ("03","축적 가능","시간이 갈수록\n쌓인다")]
    cw=520; gap=40; tot=cw*3+gap*2; x0=(W-tot)//2
    for i,(n,t,desc) in enumerate(items):
        x=x0+i*(cw+gap)
        d.rounded_rectangle([x,330,x+cw,830],radius=28,fill=(46,65,86),outline=GOLD,width=3)
        center_text(d,x+cw//2,430,n,F(EB,86),GOLD)
        center_text(d,x+cw//2,560,t,F(EB,58),WHITE)
        for j,ln in enumerate(desc.split("\n")):
            center_text(d,x+cw//2,650+j*60,ln,F(B,40),GREY)
    return img

def s_human_capital():
    img=grad_bg(); d=ImageDraw.Draw(img)
    tag(d,W//2,180,"노벨 경제학상 이론",F(B,40))
    wrap_center(d,W//2,470,["사람의 '지식·기술·자기이해'도"],F(EB,82),WHITE)
    wrap_center(d,W//2,620,["인적자본 = 자산이다"],F(EB,104),GOLD)
    wrap_center(d,W//2,800,["Human Capital Theory"],F(B,44),GREY)
    return img

def s_self_asset():
    img=grad_bg(); d=ImageDraw.Draw(img)
    wrap_center(d,W//2,360,["내가 무엇을 원하고,","무엇을 잘하고,","어디로 가고 싶은지 아는 것"],F(EB,78),WHITE)
    wrap_center(d,W//2,760,["그 자체가 강력한 자산입니다"],F(EB,72),GOLD)
    return img

def s_scattered():
    img=grad_bg(); d=ImageDraw.Draw(img)
    wrap_center(d,W//2,330,["하지만 마음속에"],F(EB,80),WHITE)
    wrap_center(d,W//2,470,["흩어져 있는 생각은"],F(EB,80),WHITE)
    wrap_center(d,W//2,650,["자산이 되지 못합니다"],F(EB,96),GOLD)
    wrap_center(d,W//2,820,["통제할 수도, 쌓을 수도 없으니까"],F(B,48),GREY)
    return img

def s_role_report():
    img=grad_bg(); d=ImageDraw.Draw(img)
    center_text(d,W//2,160,"인생포트폴리오가 하는 일",F(EB,72),WHITE)
    # 화살표 변환 다이어그램
    lx=W//2-560; rx=W//2+560
    d.rounded_rectangle([lx-260,420,lx+260,640],radius=24,fill=(46,65,86),outline=GREY,width=2)
    wrap_center(d,lx,530,["흩어진","나에 대한 이해"],F(B,52),GREY)
    # arrow
    d.polygon([(W//2-90,500),(W//2-90,560),(W//2+30,560),(W//2+30,600),(W//2+120,530),(W//2+30,460),(W//2+30,500)],fill=GOLD)
    d.rounded_rectangle([rx-260,420,rx+260,640],radius=24,fill=GOLD)
    wrap_center(d,rx,530,["한 권의","리포트(자산)"],F(EB,54),NAVY)
    wrap_center(d,W//2,790,["통제 가능 · 축적 가능한 진짜 자산"],F(B,50),WHITE)
    return img

def s_root_asset():
    img=grad_bg(); d=ImageDraw.Draw(img)
    wrap_center(d,W//2,420,["인생포트폴리오는"],F(EB,82),WHITE)
    wrap_center(d,W//2,580,["다른 모든 자산이 자라나는"],F(EB,82),WHITE)
    wrap_center(d,W//2,740,["바탕이 되는 자산"],F(EB,104),GOLD)
    return img

def s_research1():
    img=grad_bg(); d=ImageDraw.Draw(img)
    tag(d,W//2,150,"연구로 증명된 사실",F(B,40))
    center_text(d,W//2,330,"미국 4,660명 · 십수 년 추적",F(EB,66),WHITE)
    center_text(d,W//2,420,"(Hill et al., 2016 · MIDUS)",F(B,38),GREY)
    # 두 개 수치 카드
    cards=[("소득","+ 약 $4,400"),("순자산","+ 약 $20,000")]
    cw=620; gap=80; tot=cw*2+gap; x0=(W-tot)//2
    for i,(t,v) in enumerate(cards):
        x=x0+i*(cw+gap)
        d.rounded_rectangle([x,540,x+cw,830],radius=28,fill=(46,65,86),outline=GOLD,width=3)
        center_text(d,x+cw//2,620,t,F(B,52),GREY)
        center_text(d,x+cw//2,730,v,F(EB,80),GOLD)
    return img

def s_research_fin():
    img=grad_bg(); d=ImageDraw.Draw(img)
    wrap_center(d,W//2,420,["삶의 목적이 또렷한 것만으로"],F(EB,80),WHITE)
    wrap_center(d,W//2,600,["실제 '돈'의 차이가 생긴다"],F(EB,96),GOLD)
    wrap_center(d,W//2,780,["자기이해 → 재무적 자산으로 연결"],F(B,48),GREY)
    return img

def s_research2():
    img=grad_bg(); d=ImageDraw.Draw(img)
    center_text(d,W//2,170,"자기이해는 '돈'만이 아니다",F(EB,72),WHITE)
    rows=[("재무 역량 ↑","건강 상태 ↑"),("일의 소명 ↑","만족도 ↑"),("삶의 의미 ↑","행복 ↑")]
    y=350
    for a,b in rows:
        d.rounded_rectangle([W//2-700,y,W//2-40,y+150],radius=20,fill=(46,65,86),outline=GREY,width=2)
        center_text(d,W//2-370,y+75,a,F(B,50),WHITE)
        center_text(d,W//2,y+75,"→",F(EB,60),GOLD)
        d.rounded_rectangle([W//2+40,y,W//2+700,y+150],radius=20,fill=(46,65,86),outline=GOLD,width=2)
        center_text(d,W//2+370,y+75,b,F(EB,52),GOLD)
        y+=200
    return img

def s_summary_dir():
    img=grad_bg(); d=ImageDraw.Draw(img)
    wrap_center(d,W//2,400,["모든 연구가","한 방향을 가리킵니다"],F(EB,90),WHITE)
    wrap_center(d,W//2,720,["나를 이해하고 정리하는 것 =","소득·건강·행복의 바탕"],F(B,54),GOLD)
    return img

def s_key_recap():
    img=grad_bg(); d=ImageDraw.Draw(img)
    center_text(d,W//2,150,"핵심 정리",F(EB,80),GOLD)
    lines=["자산의 조건: 미래가치 · 통제가능 · 축적가능",
           "나를 이해하는 것 = 강력한 자산",
           "흩어져 있으면 자산이 되지 못한다",
           "인생포트폴리오 = 흩어진 나를 한 권의 자산으로"]
    y=360
    for ln in lines:
        d.ellipse([W//2-560,y+8,W//2-530,y+38],fill=GOLD)
        d.text((W//2-490,y+22),ln,font=F(B,52),fill=WHITE,anchor="lm")
        y+=140
    return img

def s_cta_setup():
    img=grad_bg(); d=ImageDraw.Draw(img)
    wrap_center(d,W//2,380,["내 안에 흩어진 조각들,"],F(EB,84),WHITE)
    wrap_center(d,W//2,540,["한번 제대로 정리해볼까요?"],F(EB,84),WHITE)
    tag(d,W//2,760,"76문항 · 15분 · 결제 즉시 리포트 자동 생성",F(B,44))
    return img

def s_cta_final():
    img=grad_bg(); d=ImageDraw.Draw(img)
    center_text(d,W//2,200,"평생 쌓아갈 자산의 첫 페이지",F(EB,66),WHITE)
    center_text(d,W//2,400,"단 9,900원",F(EB,150),GOLD)
    center_text(d,W//2,540,"커피 한 잔 값으로 시작하세요",F(B,50),GREY)
    d.rounded_rectangle([W//2-580,680,W//2+560,830],radius=28,fill=GOLD)
    center_text(d,W//2,755,"▶  고정 댓글의 링크를 눌러주세요",F(EB,58),NAVY)
    center_text(d,W//2,920,"lifeportfolio.co.kr",F(B,52),WHITE)
    return img

BUILDERS={
 "hook":s_hook,"def_title":s_def_title,"three_cond":s_three_cond,
 "human_capital":s_human_capital,"self_asset":s_self_asset,"scattered":s_scattered,
 "role_report":s_role_report,"root_asset":s_root_asset,"research1":s_research1,
 "research_fin":s_research_fin,"research2":s_research2,"summary_dir":s_summary_dir,
 "key_recap":s_key_recap,"cta_setup":s_cta_setup,"cta_final":s_cta_final,
}

os.makedirs("slides",exist_ok=True)
for k,fn in BUILDERS.items():
    save(fn(),f"slides/{k}.png")
print("ALL SLIDES DONE")
