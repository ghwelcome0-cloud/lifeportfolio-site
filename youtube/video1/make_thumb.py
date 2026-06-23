# -*- coding: utf-8 -*-
"""썸네일 완성: AI 배경 위에 한글 타이틀 오버레이 (왼쪽 영역)."""
from PIL import Image, ImageDraw, ImageFont, ImageFilter

GOLD=(200,162,74); WHITE=(248,250,252); NAVY=(28,41,55)
EB="font_eb.ttf"; B="font_b.ttf"
def F(p,s): return ImageFont.truetype(p,s)

bg=Image.open("thumb_bg.png").convert("RGB").resize((1280,720))
d=ImageDraw.Draw(bg)

# 왼쪽 가독성 위해 좌측에 살짝 어두운 그라데이션 오버레이
ov=Image.new("RGBA",(1280,720),(0,0,0,0))
od=ImageDraw.Draw(ov)
for x in range(820):
    a=int(150*(1-x/820))
    od.line([(x,0),(x,720)],fill=(20,30,42,a))
bg=Image.alpha_composite(bg.convert("RGBA"),ov).convert("RGB")
# AI 배경의 깨진 글자 영역(좌중앙)을 네이비로 부드럽게 덮기
patch=Image.new("RGBA",(1280,720),(0,0,0,0))
pd=ImageDraw.Draw(patch)
pd.rectangle([40,180,650,560],fill=(26,38,52,245))
patch=patch.filter(ImageFilter.GaussianBlur(40))
bg=Image.alpha_composite(bg.convert("RGBA"),patch).convert("RGB")
d=ImageDraw.Draw(bg)

def text_shadow(x,y,txt,font,fill,anchor="lm",sh=(0,0,0)):
    for dx,dy in [(3,3),(2,2)]:
        d.text((x+dx,y+dy),txt,font=font,fill=sh,anchor=anchor)
    d.text((x,y),txt,font=font,fill=fill,anchor=anchor)

# 상단 골드 라벨
d.rounded_rectangle([60,70,380,128],radius=12,fill=GOLD)
d.text((220,99),"모든 자산의 뿌리",font=F(B,34),fill=NAVY,anchor="mm")

# 메인 카피 (왼쪽 정렬)
text_shadow(62,230,"통장보다",F(EB,92),WHITE)
text_shadow(62,330,"먼저 쌓아야 할",F(EB,92),WHITE)
text_shadow(60,455,"진짜 자산",F(EB,128),GOLD)

# 하단 후킹 문구
d.rounded_rectangle([60,560,760,632],radius=14,fill=(255,255,255))
d.text((90,596),"돈·커리어·건강이 자라는 '바탕'",font=F(B,40),fill=NAVY,anchor="lm")

bg.save("thumbnail.png",quality=95)
print("thumbnail.png saved", bg.size)
