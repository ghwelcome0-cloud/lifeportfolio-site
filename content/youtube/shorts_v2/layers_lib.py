#!/usr/bin/env python3
# 공통 레이어 생성 모듈 — EP3~EP12 공용
from PIL import Image, ImageDraw, ImageFont
import os, random

W, H = 1080, 1920
CHALK = (245, 241, 232, 255)
YELLOW = (240, 192, 64, 255)
SUB_WHITE = (248, 246, 240, 255)

PEN = "/usr/share/fonts/truetype/nanum/NanumPen.ttf"
BRUSH = "/usr/share/fonts/truetype/nanum/NanumBrush.ttf"
SQUARE_B = "/usr/share/fonts/truetype/nanum/NanumSquareB.ttf"

WORK = None  # set by init()

def init(work_dir):
    global WORK
    WORK = work_dir
    os.makedirs(WORK, exist_ok=True)

def _font(path, size):
    return ImageFont.truetype(path, size)

def _tsize(d, txt, fnt):
    b = d.textbbox((0,0), txt, font=fnt)
    return b[2]-b[0], b[3]-b[1], b[0], b[1]

def chalk(name, lines, size, color=CHALK, y_center=760, fpath=PEN, line_gap=1.25, jitter=True):
    img = Image.new("RGBA", (W, H), (0,0,0,0))
    d = ImageDraw.Draw(img)
    fnt = _font(fpath, size)
    heights=[]; widths=[]
    for ln in lines:
        w,h,ox,oy=_tsize(d,ln,fnt); widths.append((w,ox)); heights.append(h)
    total=sum(h*line_gap for h in heights)
    y=y_center-total/2
    random.seed(7)
    for i,ln in enumerate(lines):
        w,ox=widths[i]
        x=(W-w)/2-ox
        jy=random.randint(-6,6) if jitter else 0
        jx=random.randint(-4,4) if jitter else 0
        d.text((x+jx,y+jy),ln,font=fnt,fill=color)
        y+=heights[i]*line_gap
    img.save(f"{WORK}/{name}.png"); print(name,"saved")

def sub(name, lines, size=56, color=SUB_WHITE, y_bottom=1555, hl=None):
    img = Image.new("RGBA", (W, H), (0,0,0,0))
    d = ImageDraw.Draw(img)
    fnt = _font(SQUARE_B, size)
    heights=[]; widths=[]
    for ln in lines:
        w,h,ox,oy=_tsize(d,ln,fnt); widths.append((w,ox)); heights.append((h,oy))
    line_gap=1.4
    total=sum(h*line_gap for h,_ in heights)
    y=y_bottom-total
    for i,ln in enumerate(lines):
        w,ox=widths[i]; h,oy=heights[i]
        x=(W-w)/2-ox
        d.text((x+3,y+3-oy),ln,font=fnt,fill=(0,0,0,180))
        c=YELLOW if (hl and ln in hl) else color
        d.text((x,y-oy),ln,font=fnt,fill=c)
        y+=h*line_gap
    img.save(f"{WORK}/{name}.png"); print(name,"saved")

def cta():
    img=Image.new("RGBA",(W,H),(0,0,0,0)); d=ImageDraw.Draw(img)
    f1=_font(SQUARE_B,46); txt="▶ 더 깊은 이야기는 채널에서"
    w,h,ox,oy=_tsize(d,txt,f1); x=(W-w)/2-ox; Y=1660
    d.text((x+2,Y+2-oy),txt,font=f1,fill=(0,0,0,150))
    d.text((x,Y-oy),txt,font=f1,fill=CHALK,stroke_width=1,stroke_fill=(30,50,40,180))
    img.save(f"{WORK}/cta.png"); print("cta saved")

def brand():
    img=Image.new("RGBA",(W,H),(0,0,0,0)); d=ImageDraw.Draw(img)
    f1=_font(SQUARE_B,38); txt="인생포트폴리오"
    w,h,ox,oy=_tsize(d,txt,f1); x=(W-w)/2-ox; Y=258
    d.text((x+2,Y+2-oy),txt,font=f1,fill=(0,0,0,140))
    d.text((x,Y-oy),txt,font=f1,fill=(240,192,64,235),stroke_width=1,stroke_fill=(30,50,40,160))
    img.save(f"{WORK}/brand.png"); print("brand saved")

def common():
    cta(); brand()
