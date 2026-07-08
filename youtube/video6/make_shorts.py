#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Post #2 롱폼(video6_final_deliver.mp4)에서 숏폼 3개를 파생.
- 9:16 (1080x1920)
- 상단 제목 배너 + 중앙 원본영상(레터박스) + 하단 큰 자막 + CTA
- 크레딧 0 (로컬 ffmpeg + PIL)
자막은 무음 시청 대비 크게 번인.
퍼널: 숏폼1(공감·후크) → 숏폼2(해석·인사이트) → 숏폼3(방향·초대)
"""
import os, subprocess
from PIL import Image, ImageDraw, ImageFont

SRC = "video6_final_deliver.mp4"
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

# 원본 영상은 1920x1080 -> 9:16 폭 1080 맞추면 1080x608
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
# 각 숏폼: id, 컷 구간(start,end), 상단 태그/제목, 하단 자막[(rel_start, rel_end, lines)]
SHORTS = [
    {
        # 공감·후크: 사명 vs 창업 통념 → 같은 뿌리 반전
        "id": 1,
        "title_tag": "사명 × 창업 ①",
        "title": ["사명과 창업은", "같은 뿌리다"],
        "start": 0.30, "end": 55.00,
        "cta": "불편함 · 가치 · 전달",
        "subs": [
            (0.0, 11.7, ["'사명'은 거룩한 것,", "'창업'은 세속적인 것?"]),
            (12.2, 24.2, ["그런데 뿌리까지 파보면", "둘은 같은 구조 위에 있습니다"]),
            (24.4, 36.4, ["비즈니스란,", "누군가의 불편함을 발견해", "가치로 해결하고 전달하는 것"]),
            (36.5, 48.6, ["드러커: '기업의 목적은 고객 창출'", "레빗: '사람들은 드릴이 아니라", "구멍을 원한다'"]),
            (48.6, 54.5, ["비즈니스의 심장 세 단어 —", "불편함, 가치, 전달"]),
        ],
    },
    {
        # 해석·인사이트: 내 불편함=남의 불편함=아이템
        "id": 2,
        "title_tag": "사명 × 창업 ②",
        "title": ["내가 앓은 불편함이", "곧 창업 아이템이다"],
        "start": 85.50, "end": 140.00,
        "cta": "머리가 아니라 '몸으로' 안다",
        "subs": [
            (0.0, 6.5, ["차이는 출발점뿐 —", "사명은 '나의' 불편함,", "비즈니스는 '남의' 불편함"]),
            (6.6, 18.9, ["그런데 내가 깊이 앓은 불편함은", "대개 나만의 것이 아닙니다"]),
            (18.9, 25.0, ["나의 불편함이 남의 불편함과 만나는", "그 지점이 곧 '창업 아이템'"]),
            (25.5, 40.0, ["실패하는 사업은 겪어보지 않은", "남의 문제를 상상으로 풀려 합니다"]),
            (40.0, 54.5, ["직접 앓은 사람은", "고객의 고통을 머리가 아니라", "'몸으로' 압니다"]),
        ],
    },
    {
        # 방향·초대: 나침반/지도 + 인생포트폴리오 거울 + CTA
        "id": 3,
        "title_tag": "사명 × 창업 ③",
        "title": ["나침반이 없으면", "지도도 소용없다"],
        "start": 259.00, "end": 314.00,
        "cta": "lifeportfolio.co.kr",
        "subs": [
            (0.0, 7.2, ["사명은 나침반,", "사업은 지도입니다"]),
            (7.4, 14.5, ["방향만 있으면 헤매고,", "지도만 있으면 표류합니다"]),
            (14.5, 27.5, ["많은 사람이 첫 단추에서 막힙니다.", "내 사명부터가 흐릿하니까요"]),
            (27.9, 40.0, ["인생포트폴리오는", "사명을 대신 정해주지 않습니다.", "'발견하도록 돕는 거울'입니다"]),
            (40.0, 54.5, ["발견한 방향이 자산이 되고,", "언젠가 같은 불편함 속 누군가에게", "흘러가는 씨앗이 됩니다"]),
        ],
    },
]

def build_banner(sh):
    """상단 제목 + 하단 CTA 고정 배너 (자막 제외) 생성"""
    img = Image.new("RGB", (W, H), NAVY)
    d = ImageDraw.Draw(img)
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
        draw_center(d, W/2, y, line, fttl, WHITE)
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
    fsub = font(FONT_EB, 54)
    frames = []
    idx = 0
    for (rs, re, lines) in sh["subs"]:
        img = Image.new("RGBA", (W, H), (0,0,0,0))
        d = ImageDraw.Draw(img)
        n = len(lines)
        line_h = 74
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
    inputs = ["-ss", f"{sh['start']:.3f}", "-t", f"{dur:.3f}", "-i", SRC,
              "-i", banner]
    for (_,_,p) in subs:
        inputs += ["-i", p]
    fc = []
    fc.append(f"[0:v]scale={VIDEO_W}:{VIDEO_H},eq=brightness=-0.10:saturation=0.95[vid]")
    fc.append(f"[1:v][vid]overlay=0:{VIDEO_Y}[base]")
    last = "base"
    for i,(rs,re,p) in enumerate(subs):
        inp = i+2
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
