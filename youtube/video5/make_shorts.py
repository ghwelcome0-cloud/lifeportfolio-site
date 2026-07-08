#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Post #1 롱폼(video5_final_compressed.mp4)에서 숏폼 3개를 파생.
- 9:16 (1080x1920)
- 상단 제목 배너 + 중앙 원본영상(레터박스) + 하단 큰 자막 + CTA
- 크레딧 0 (로컬 ffmpeg + PIL)
자막은 무음 시청 대비 크게 번인.
"""
import os, subprocess, json
from PIL import Image, ImageDraw, ImageFont

SRC = "video5_final_compressed.mp4"
OUT = "shorts"
os.makedirs(OUT, exist_ok=True)
os.makedirs(f"{OUT}/assets", exist_ok=True)

W, H = 1080, 1920
FONT_EB = "font_eb.ttf"
FONT_B = "font_b.ttf"
FONT_R = "font_r.ttf"

NAVY = (15, 27, 45)
NAVY2 = (23, 39, 64)
GOLD = (212, 175, 110)
WHITE = (238, 240, 245)
GRAY = (150, 160, 175)

# 원본 영상은 1920x1080 -> 9:16 폭 1080 맞추면 1080x607.5
VIDEO_W = 1080
VIDEO_H = 608
VIDEO_Y = 560  # 중앙 영역 배치 y

def font(path, size):
    return ImageFont.truetype(path, size)

def draw_center(draw, cx, y, text, fnt, fill):
    b = draw.textbbox((0,0), text, font=fnt)
    w = b[2]-b[0]
    draw.text((cx - w/2, y), text, font=fnt, fill=fill)
    return b[3]-b[1]

# ── 3개 숏폼 정의 ──────────────────────────────────
# 각 숏폼: id, 컷 구간(start,end), 상단 태그/제목, 하단 자막 리스트[(rel_start, rel_end, text_lines)]
SHORTS = [
    {
        "id": 1,
        "title_tag": "인생 방향 찾기 ①",
        "title": ["무엇이 되고 싶은지", "모르겠다면?"],
        "start": 0.0, "end": 34.32,
        "cta": "질문을 반대로 던져보세요",
        # rel times within the cut
        "subs": [
            (0.0, 4.6, ["우리는 보통 방향을", "\"무엇이 되고 싶은가\"로 찾습니다"]),
            (5.0, 11.5, ["그런데 이 질문 앞에서", "많은 사람이 막막해집니다"]),
            (15.9, 19.7, ["그래서 방향을", "반대편에서 찾아봅니다"]),
            (20.8, 23.3, ["\"나는 무엇이", "참을 수 없이 불편한가?\""]),
            (25.6, 33.3, ["불편함은 무엇을", "소중히 여기는지 비추는", "가장 정직한 신호입니다"]),
        ],
    },
    {
        "id": 2,
        "title_tag": "인생 방향 찾기 ②",
        "title": ["불편함을 뒤집으면", "'가치'가 보인다"],
        "start": 73.82, "end": 126.18,
        "cta": "불평이 아니라, 삶의 고백",
        "subs": [
            (0.0, 4.7, ["불편함을 뒤집으면", "그 아래 깔린 가치가 보입니다"]),
            (5.4, 8.5, ["소중하지 않은 것 때문엔", "불편하지도 않으니까요"]),
            (10.6, 18.8, ["'도전이 결실 없이 끝나면 힘들다'", "→ 소중한 건 '열매 맺는 삶'"]),
            (26.2, 35.0, ["불편함마다 가치를 꺼내면", "몇 개의 핵심 가치를 가리킵니다"]),
            (35.9, 52.3, ["불평처럼 보였던 것이", "사실은 '이렇게 살고 싶다'는", "고백이었던 겁니다"]),
        ],
    },
    {
        "id": 3,
        "title_tag": "인생 방향 찾기 ③",
        "title": ["괴리를 느끼는 건", "약점이 아니라 '능력'"],
        "start": 337.62, "end": 365.64,
        "cta": "lifeportfolio.co.kr",
        "subs": [
            (0.0, 5.7, ["괴리를 느낀다는 건", "약점이 아니라 '능력'입니다"]),
            (6.4, 11.8, ["현재와 미래를 동시에 보는 사람만", "그 거리를 느낄 수 있으니까요"]),
            (12.0, 16.0, ["목적지가 없는 사람은", "길을 잃어도 모릅니다"]),
            (16.9, 23.0, ["불편함을 자주 느낀다는 건", "높은 기준과 선명한 이상이", "있다는 뜻입니다"]),
            (23.8, 28.0, ["이 불편함이야말로", "가장 강력한 성장의 엔진입니다"]),
        ],
    },
]

def build_banner(sh):
    """상단 제목 + 하단 CTA 고정 배너 (자막 제외) 생성"""
    img = Image.new("RGB", (W, H), NAVY)
    d = ImageDraw.Draw(img)
    # 배경 그라데이션
    for y in range(H):
        t = y / H
        r = int(NAVY[0]*(1-t) + NAVY2[0]*t)
        g = int(NAVY[1]*(1-t) + NAVY2[1]*t)
        b = int(NAVY[2]*(1-t) + NAVY2[2]*t)
        d.line([(0,y),(W,y)], fill=(r,g,b))
    # 상단 태그 (골드 알약)
    tag = sh["title_tag"]
    ftag = font(FONT_B, 40)
    tb = d.textbbox((0,0), tag, font=ftag)
    tw = tb[2]-tb[0]
    pad = 30
    tag_y = 120
    d.rounded_rectangle([W/2-tw/2-pad, tag_y-15, W/2+tw/2+pad, tag_y+55], radius=35, fill=GOLD)
    d.text((W/2-tw/2, tag_y-5), tag, font=ftag, fill=NAVY)
    # 제목
    fttl = font(FONT_EB, 76)
    y = 240
    for line in sh["title"]:
        h = draw_center(d, W/2, y, line, fttl, WHITE)
        y += 100
    # 하단 CTA 바
    cta = sh["cta"]
    fcta = font(FONT_B, 46)
    cy = 1760
    d.line([(180, cy-30),(W-180, cy-30)], fill=GOLD, width=3)
    draw_center(d, W/2, cy, cta, fcta, GOLD)
    # 브랜드
    fbr = font(FONT_R, 34)
    draw_center(d, W/2, 1850, "인생포트폴리오", fbr, GRAY)
    img.save(f"{OUT}/assets/banner_{sh['id']}.png")
    return f"{OUT}/assets/banner_{sh['id']}.png"

def build_sub_frames(sh):
    """자막 오버레이 프레임들 (투명 PNG) — 구간별로 생성"""
    fsub = font(FONT_EB, 58)
    frames = []
    idx = 0
    for (rs, re, lines) in sh["subs"]:
        img = Image.new("RGBA", (W, H), (0,0,0,0))
        d = ImageDraw.Draw(img)
        # 자막 배경 박스
        n = len(lines)
        line_h = 78
        box_h = n*line_h + 50
        box_y = 1240
        d.rounded_rectangle([60, box_y, W-60, box_y+box_h], radius=24, fill=(10,18,32,205))
        y = box_y + 25
        for line in lines:
            draw_center(d, W/2, y, line, fsub, WHITE)
            y += line_h
        p = f"{OUT}/assets/sub_{sh['id']}_{idx}.png"
        img.save(p)
        frames.append((rs, re, p))
        idx += 1
    return frames

def build_short(sh):
    dur = sh["end"] - sh["start"]
    banner = build_banner(sh)
    subs = build_sub_frames(sh)
    # 1) 원본 구간 잘라 9:16 캔버스에 배치 + 배너 오버레이
    # filter: scale video to 1080 wide, overlay onto banner at VIDEO_Y
    inputs = ["-ss", f"{sh['start']:.3f}", "-t", f"{dur:.3f}", "-i", SRC,
              "-i", banner]
    # 자막 입력 추가
    for (_,_,p) in subs:
        inputs += ["-i", p]
    # filter_complex 구성
    fc = []
    # 영상 스케일 + 살짝 어둡게(원본 슬라이드 텍스트 억제, 하단 자막 강조)
    fc.append(f"[0:v]scale={VIDEO_W}:{VIDEO_H},eq=brightness=-0.10:saturation=0.95[vid]")
    # 배너 위에 영상 올림
    fc.append(f"[1:v][vid]overlay=0:{VIDEO_Y}[base]")
    last = "base"
    # 자막 오버레이 (enable 타이밍)
    for i,(rs,re,p) in enumerate(subs):
        inp = i+2  # 0=src,1=banner,2..=subs
        out = f"s{i}"
        fc.append(f"[{last}][{inp}:v]overlay=0:0:enable='between(t,{rs:.2f},{re:.2f})'[{out}]")
        last = out
    filter_str = ";".join(fc)
    outp = f"{OUT}/short_{sh['id']}.mp4"
    cmd = ["ffmpeg","-v","error","-y"] + inputs + [
        "-filter_complex", filter_str,
        "-map", f"[{last}]", "-map", "0:a",
        "-c:v","libx264","-preset","veryfast","-crf","23",
        "-pix_fmt","yuv420p","-r","30",
        "-c:a","aac","-b:a","160k","-shortest", outp]
    print(f"[short {sh['id']}] building ({dur:.1f}s)...")
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print("ERROR:", r.stderr[-800:])
    else:
        print(f"[short {sh['id']}] OK -> {outp}")

if __name__ == "__main__":
    import sys
    which = sys.argv[1] if len(sys.argv)>1 else "all"
    for sh in SHORTS:
        if which=="all" or str(sh["id"])==which:
            build_short(sh)
    print("DONE")
