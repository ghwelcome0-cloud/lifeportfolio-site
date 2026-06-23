# -*- coding: utf-8 -*-
"""숏츠 #3 비주얼 빌드 (무음).
- 슬라이드: 미세 Ken Burns 줌 (정적 방지, 2~4초 시각변화)
- B-roll: 16:9 → 9:16 블러배경 + 중앙 핏 + 네이비 톤 + 미세 줌
- 30fps, 페이드 전환
출력: video_silent.mp4 (1080x1920)
"""
import json, subprocess, os

W, H = 1080, 1920
FPS = 30
FADE = 0.4

SECTIONS = json.load(open("sections.json"))
TOTAL = SECTIONS[-1][2]

os.makedirs("clips", exist_ok=True)

def run(cmd):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if r.returncode != 0:
        print("ERR:", cmd)
        print(r.stderr[-1500:])
        raise SystemExit(1)

clip_files = []

for name, start, end, kind in SECTIONS:
    dur = round(end - start, 3)
    out = f"clips/{name}.mp4"
    nf = int(dur * FPS)
    if kind == "slide":
        src = f"{name}.png"
        # 미세 Ken Burns: 1.0 → 1.06 줌 (느리고 차분하게)
        zoom = f"zoompan=z='min(1.0+0.06*on/{nf},1.06)':d={nf}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={W}x{H}:fps={FPS}"
        vf = (f"scale={W*2}:{H*2},{zoom},"
              f"fade=t=in:st=0:d={FADE},fade=t=out:st={dur-FADE}:d={FADE}")
        run(f'ffmpeg -y -loop 1 -i "{src}" -t {dur} -vf "{vf}" '
            f'-c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -r {FPS} "{out}"')
    else:  # broll
        src = f"../../video4/broll/{name}.mp4"
        # 블러 배경(가득) + 전경(세로폭 맞춤 중앙) + 네이비 톤 + 미세 줌
        vf = (
            f"[0:v]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},"
            f"boxblur=28:2,eq=brightness=-0.12:saturation=0.7,"
            f"colorbalance=rs=-0.06:bs=0.10[bg];"
            f"[0:v]scale={W}:-1,eq=saturation=0.9,colorbalance=rs=-0.04:bs=0.08[fg];"
            f"[bg][fg]overlay=(W-w)/2:(H-h)/2[ov];"
            f"[ov]scale={int(W*1.06)}:{int(H*1.06)},crop={W}:{H},"
            f"fade=t=in:st=0:d={FADE},fade=t=out:st={dur-FADE}:d={FADE}[v]"
        )
        run(f'ffmpeg -y -stream_loop -1 -i "{src}" -t {dur} '
            f'-filter_complex "{vf}" -map "[v]" '
            f'-c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -r {FPS} "{out}"')
    clip_files.append(out)
    print(f"built {out} ({dur}s)")

# concat (re-encode, PTS 보존)
with open("concat.txt", "w") as f:
    for c in clip_files:
        f.write(f"file '{c}'\n")

run(f'ffmpeg -y -f concat -safe 0 -i concat.txt '
    f'-c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p '
    f'-r {FPS} -movflags +faststart -an video_silent.mp4')
print("DONE video_silent.mp4", TOTAL, "s")
