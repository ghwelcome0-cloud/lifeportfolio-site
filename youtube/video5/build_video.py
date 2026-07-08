# -*- coding: utf-8 -*-
"""2편 합성 빌드 (B-roll v2: ping-pong + 감속으로 반복 흐름 제거).
슬라이드: 정지 + fade in/out.
B-roll: 정방향+역방향 concat(이음새 없음) + 감속 -> 필요 길이만큼 사용 + navy 톤 + fade.
"""
import json, os, subprocess

with open("sections.json", encoding="utf-8") as f:
    SECTIONS = json.load(f)

TOTAL = SECTIONS[-1][1]
FPS = 30
FADE = 0.5
os.makedirs("clips", exist_ok=True)
os.makedirs("broll_pp", exist_ok=True)

starts = [s[0] for s in SECTIONS]
bounds = starts[1:] + [TOTAL]

# ── B-roll v2: ping-pong + 감속 소스 생성 (한 번만, 재사용) ──
# 원본 5.04s -> 정+역 concat 10.08s -> 1.35배속 = ~13.6s, 이음새/반복 없음.
PP_SPEED = 1.35
def make_pingpong(name):
    src = f"broll/{name}.mp4"
    out = f"broll_pp/{name}_pp.mp4"
    if os.path.exists(out):
        return out
    fc = (f"[0:v]reverse[r];[0:v][r]concat=n=2:v=1:a=0[pp];"
          f"[pp]setpts={PP_SPEED}*PTS[v]")
    cmd = ["ffmpeg", "-y", "-i", src, "-filter_complex", fc, "-map", "[v]",
           "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", str(FPS), out]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print("ERR pingpong", name, r.stderr[-800:]); raise SystemExit(1)
    return out

clip_list = []
for i, (st, en, key) in enumerate(SECTIONS):
    dur = round(bounds[i] - st, 3)
    out = f"clips/clip_{i:02d}.mp4"
    fade_out_st = max(dur - FADE, 0)

    if key.startswith("BROLL:"):
        name = key.split(":", 1)[1]
        pp = make_pingpong(name)
        # ping-pong 소스(~13.6s)를 stream_loop로 안전하게 구간 채움(긴 구간 대비)
        vf = (
            "scale=1920:1080:force_original_aspect_ratio=increase,"
            "crop=1920:1080,"
            "eq=brightness=-0.06:saturation=0.92:contrast=1.04,"
            "colorbalance=rs=-0.04:bs=0.06:gs=-0.01,"
            f"fade=t=in:st=0:d={FADE},fade=t=out:st={fade_out_st:.3f}:d={FADE}"
        )
        cmd = ["ffmpeg", "-y", "-stream_loop", "-1", "-i", pp, "-t", f"{dur}",
               "-vf", vf, "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p",
               "-r", str(FPS), out]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode != 0:
            print("ERR broll", i, r.stderr[-800:]); raise SystemExit(1)
        clip_list.append(out)
        print(f"clip {i:02d} [{key}] {dur:.2f}s OK (B-ROLL v2 ping-pong)")
        continue

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
