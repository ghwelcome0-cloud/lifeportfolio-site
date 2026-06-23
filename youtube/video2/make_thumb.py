# -*- coding: utf-8 -*-
"""2편 썸네일: AI 배경 + 디자인 모듈 텍스트 합성. navy+gold, 1080p(1280x720) 유튜브 표준.
가치 정합성: 자기자랑/자극 배제, 내면 성찰('흐릿함->또렷함') 은유."""
from PIL import Image, ImageDraw, ImageFilter, ImageFont

# 팔레트 (영상 design.py와 동일)
NAVY_DK=(20,30,43); GOLD=(206,168,92); GOLD_LT=(230,200,130)
WHITE=(244,247,251); GREY=(150,165,182)

EB="font_eb.ttf"; B="font_b.ttf"; R="font_r.ttf"
def F(path,sz): return ImageFont.truetype(path,sz)

W,H=1280,720
bg=Image.open("thumb_bg.png").convert("RGB").resize((W,H), Image.LANCZOS)

# 좌측 가독성을 위해 좌->우 약한 navy 그라데이션 오버레이
ov=Image.new("RGB",(W,H),NAVY_DK)
mask=Image.new("L",(W,H),0); md=ImageDraw.Draw(mask)
for x in range(W):
    a=int(170*max(0,(1-x/(W*0.72))))  # 왼쪽 진하게
    md.line([(x,0),(x,H)],fill=a)
bg=Image.composite(ov,bg,mask)

d=ImageDraw.Draw(bg)

def glow_text(xy,txt,font,fill,glow=GOLD,gr=8,ga=150):
    # 글로우 레이어
    gl=Image.new("RGBA",(W,H),(0,0,0,0)); gd=ImageDraw.Draw(gl)
    gd.text(xy,txt,font=font,fill=glow+(ga,))
    gl=gl.filter(ImageFilter.GaussianBlur(gr))
    bg.paste(gl,(0,0),gl)
    d.text(xy,txt,font=font,fill=fill)

def shadow_text(xy,txt,font,fill,sa=170,sr=6,off=4):
    sh=Image.new("RGBA",(W,H),(0,0,0,0)); sd=ImageDraw.Draw(sh)
    sd.text((xy[0]+off,xy[1]+off),txt,font=font,fill=(0,0,0,sa))
    sh=sh.filter(ImageFilter.GaussianBlur(sr))
    bg.paste(sh,(0,0),sh)
    d.text(xy,txt,font=font,fill=fill)

# 상단 태그 (gold 캡슐)
tag_f=F(B,30)
tag="자기표현  ·  인생 자산화 ②"
tw=d.textlength(tag,font=tag_f)
pad=22
d.rounded_rectangle([72,64,72+tw+pad*2,64+58],radius=29,
                    fill=(GOLD[0],GOLD[1],GOLD[2]))
d.text((72+pad,64+13),tag,font=tag_f,fill=NAVY_DK)

# 메인 카피 (2줄, 대형)
main_f=F(EB,128)
shadow_text((70,200),"흐릿한 '나'를",main_f,WHITE)
# 둘째 줄 '또렷하게' gold glow 강조
glow_text((70,338),"또렷하게",main_f,GOLD_LT,glow=GOLD,gr=14,ga=170)

# gold 디바이더
d.rectangle([74,500,74+360,505],fill=GOLD)

# 하단 보조 카피
sub_f=F(R,40)
shadow_text((74,524),"표현이라는 첫 번째 열쇠",sub_f,GREY,sa=150,sr=5,off=3)

# 미세 비네트
vig=Image.new("L",(W,H),0); vd=ImageDraw.Draw(vig)
vd.ellipse([-W*0.25,-H*0.25,W*1.25,H*1.25],fill=255)
vig=vig.filter(ImageFilter.GaussianBlur(160))
dark=Image.new("RGB",(W,H),(0,0,0))
bg=Image.composite(bg,dark,vig)

bg.save("thumbnail_2.png")
print("thumbnail saved -> thumbnail_2.png", bg.size)
