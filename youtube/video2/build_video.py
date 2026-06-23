# -*- coding: utf-8 -*-
"""2편 합성 빌드.
슬라이드(정지 + fade in/out)와 B-roll(loop+업스케일+navy 톤 오버레이+fade) 클립을
구간별로 생성한 뒤 concat. 갭 없이 [현재 시작 ~ 다음 시작]을 채운다.
B-roll은 등급 A 일관성을 위해 1920x1080/30fps로 맞추고 살짝 어둡게 + navy 비네트.
"""
import json, os, subprocess

with open("sections.json", encoding="utf-8") as f:
    SECTIONS = json.load(f)

# 마지막 구간 끝 = narration 총길이
TOTAL = SECTIONS[-1][1]
FPS = 30
os.makedirs("clips", exist_ok=True)

# 갭 없는 연속: 각 클립 길이 = 다음 시작 - 현재 시작 (마지막은 TOTAL)
starts = [s[0] for s in SECTIONS]
bounds = starts[1:] + [TOTAL]

FADE = 0.5  # 전환 페이드 길이

clip_list = []
for i, (st, en, key) in enumerate(SECTIONS):
    dur = round(bounds[i] - st, 3)
    out = f"clips/clip_{i:02d}.mp4"
    fade_out_st = max(dur - FADE, 0)

    if key.startswith("BROLL:"):
        name = key.split(":", 1)[1]
        src = f"broll/{name}.mp4"
        # loop로 구간 채우고, 1920x1080 업스케일, 약간 어둡게(0.82) + 약한 채도,
        # 시네마틱 톤을 위해 살짝 navy로 컬러 밸런스, fade in/out
        vf = (
            "scale=1920:1080:force_original_aspect_ratio=increase,"
            "crop=1920:1080,"
            "eq=brightness=-0.06:saturation=0.92:contrast=1.04,"
            "colorbalance=rs=-0.04:bs=0.06:gs=-0.01,"
            f"fade=t=in:st=0:d={FADE},fade=t=out:st={fade_out_st:.3f}:d={FADE}"
        )
        cmd = ["ffmpeg", "-y", "-stream_loop", "-1", "-i", src, "-t", f"{dur}",
               "-vf", vf, "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p",
               "-r", str(FPS), out]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode != 0:
            print("ERR broll", i, r.stderr[-800:]); raise SystemExit(1)
        clip_list.append(out)
        print(f"clip {i:02d} [{key}] {dur:.2f}s OK (B-ROLL)")
        continue

    # 정지 슬라이드 + fade in/out (다큐 표준, 모션 없음)
    src = f"slides/{key}.png"
    vf = (f"scale=1920:1080:flags=lanczos,"
          f"fade=t=in:st=0:d={FADE},fade=t=out:st={fade_out_st:.3f}:d={FADE}")
    cmd = ["ffmpeg", "-y", "-loop", "1", "-i", src, "-t", f"{dur}",
           "-vf", vf, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", str(FPS), out]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print("ERR clip", i, r.stderr[-800:]); raise SystemExit(1)
    clip_list.append(out)
    print(f"clip {i:02d} [{key}] {dur:.2f}s OK")

with open("concat.txt", "w") as f:
    for c in clip_list:
        f.write(f"file '{c}'\n")
print("clips done:", len(clip_list), "TOTAL", TOTAL)
