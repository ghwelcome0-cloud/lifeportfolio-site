# -*- coding: utf-8 -*-
"""슬라이드 -> 구간별 영상클립(미세 줌+페이드) -> concat -> 자막+오디오+BGM 합성.
갭 없는 연속 타임라인: 각 클립은 [현재 섹션 시작 ~ 다음 섹션 시작]을 채운다."""
import json, os, subprocess

TOTAL = 342.62
FPS = 30
with open("sections.json", encoding="utf-8") as f:
    SECTIONS = json.load(f)

os.makedirs("clips", exist_ok=True)

# 갭 제거: 각 클립 길이 = 다음 섹션 시작 - 현재 섹션 시작 (마지막은 TOTAL까지)
starts = [s[0] for s in SECTIONS]
bounds = starts[1:] + [TOTAL]

clip_list = []
for i, (st, en, key) in enumerate(SECTIONS):
    dur = round(bounds[i] - st, 3)
    src = f"slides/{key}.png"
    out = f"clips/clip_{i:02d}.mp4"
    frames = int(dur * FPS)
    zoom_expr = "min(zoom+0.0010,1.07)"
    fade_out_st = max(dur - 0.4, 0)
    vf = (f"scale=1920:1080,zoompan=z='{zoom_expr}':d={frames}:"
          f"x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1920x1080:fps={FPS},"
          f"fade=t=in:st=0:d=0.4,fade=t=out:st={fade_out_st:.3f}:d=0.4")
    cmd = ["ffmpeg", "-y", "-loop", "1", "-i", src, "-t", f"{dur}",
           "-vf", vf, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", str(FPS), out]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print("ERR clip", i, r.stderr[-800:])
        raise SystemExit(1)
    clip_list.append(out)
    print(f"clip {i:02d} [{key}] {dur:.2f}s OK")

with open("concat.txt", "w") as f:
    for c in clip_list:
        f.write(f"file '{c}'\n")
print("clips done:", len(clip_list))
