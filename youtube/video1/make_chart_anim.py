# -*- coding: utf-8 -*-
"""research1 구간 숫자 카운트업 애니메이션 클립 생성 (최적화판).
카운트업(ANIM_DUR초)만 프레임 생성 -> 짧은 애니영상.
정지구간은 마지막 프레임 1장을 영상으로 늘림 -> 두 영상 concat.
프레임 수를 최소화해 빠르게 처리. 크레딧 0, 로컬."""
import os, subprocess
import design as D
from design import W, H, GOLD, EB, F, text_glow
from PIL import Image, ImageDraw, ImageFilter

FPS = 30
CLIP_DUR = 28.51
ANIM_DUR = 2.2
FADE = 0.5

BASE = "slides/research1.png"
OUT = "clips_anim/research1.mp4"
os.makedirs("clips_anim", exist_ok=True)
FRD = "/tmp/chart_frames"
os.makedirs(FRD, exist_ok=True)
subprocess.run(f"rm -f {FRD}/*.png", shell=True)

cw, gap = 620, 80
tot = cw*2+gap; x0 = (W-tot)//2
cards = [(4400, x0+cw//2), (20000, x0+cw+gap+cw//2)]
VAL_Y = 730
GAUGE_Y = 800

def ease_out(t): return 1 - (1 - t) ** 3
def fmt(v): return f"${v:,.0f}"

base_img = Image.open(BASE).convert("RGB")

def render(p):
    """진행도 p(0~1) 프레임 생성."""
    img = base_img.copy()
    for target, cx in cards:
        val = int(target * p)
        bar_w = 440
        bx0, bx1 = cx - bar_w//2, cx + bar_w//2
        d = ImageDraw.Draw(img)
        d.rounded_rectangle([bx0, GAUGE_Y, bx1, GAUGE_Y+14], radius=7, fill=(60,78,100))
        fill_w = int(bar_w * p)
        if fill_w > 8:
            gl = Image.new("RGBA", img.size, (0,0,0,0))
            ImageDraw.Draw(gl).rounded_rectangle([bx0, GAUGE_Y, bx0+fill_w, GAUGE_Y+14], radius=7, fill=(*GOLD,140))
            gl = gl.filter(ImageFilter.GaussianBlur(5)); img.paste(gl,(0,0),gl)
            ImageDraw.Draw(img).rounded_rectangle([bx0, GAUGE_Y, bx0+fill_w, GAUGE_Y+14], radius=7, fill=GOLD)
        text_glow(img, (cx, VAL_Y), fmt(val), F(EB,80), GOLD)
    return img

# 1) 카운트업 프레임만 생성
anim_frames = int(ANIM_DUR * FPS)
for fi in range(anim_frames):
    t = fi / max(anim_frames-1, 1)
    render(ease_out(t)).save(f"{FRD}/f_{fi:04d}.png")
# 마지막(완성) 프레임 저장
final_img = render(1.0)
final_img.save(f"{FRD}/final.png")
print("anim frames:", anim_frames)

# 2) 카운트업 애니영상 (fade in만)
subprocess.run(["ffmpeg","-y","-framerate",str(FPS),"-i",f"{FRD}/f_%04d.png",
    "-vf",f"fade=t=in:st=0:d={FADE}","-c:v","libx264","-pix_fmt","yuv420p",
    "-r",str(FPS),"/tmp/part_anim.mp4"], check=True, capture_output=True)

# 3) 정지구간 영상 (완성 프레임을 늘림, 끝에 fade out)
still_dur = CLIP_DUR - ANIM_DUR
fade_out_st = max(still_dur - FADE, 0)
subprocess.run(["ffmpeg","-y","-loop","1","-i",f"{FRD}/final.png","-t",f"{still_dur}",
    "-vf",f"fade=t=out:st={fade_out_st:.3f}:d={FADE}","-c:v","libx264",
    "-pix_fmt","yuv420p","-r",str(FPS),"/tmp/part_still.mp4"], check=True, capture_output=True)

# 4) concat
with open("/tmp/chart_concat.txt","w") as f:
    f.write("file '/tmp/part_anim.mp4'\nfile '/tmp/part_still.mp4'\n")
subprocess.run(["ffmpeg","-y","-f","concat","-safe","0","-i","/tmp/chart_concat.txt",
    "-c","copy",OUT], check=True, capture_output=True)
print("chart anim clip:", OUT)
subprocess.run(f"rm -f {FRD}/*.png /tmp/part_anim.mp4 /tmp/part_still.mp4", shell=True)
