# -*- coding: utf-8 -*-
"""A6 rev.2 review copy: burn the script line onto its own frames.

The frame layout is NOT L_i laid end to end. Each seam consumes n frames out of
the SUM (total = prev + cur - n), so the seam window for joining cut k+1 sits at
[T_k - n_k, T_k) of the finished timeline, where T_k is the running total before
that join. Those totals are read straight off a6_tx2.log rather than recomputed,
so the burn-in cannot drift away from the picture it is labelling.
"""
import json, os, subprocess

FONT = "/usr/share/fonts/truetype/nanum/NanumSquareRoundB.ttf"
if not os.path.exists(FONT):
    FONT = "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf"
SRC, OUT = "a6_pilot_v2.mp4", "a6_v2_review_720p.mp4"
TXT = "_a6tx2/txt"; os.makedirs(TXT, exist_ok=True)

R = {r["sid"]: r for r in json.load(open("rows38.json"))["rows"]}
IDS = ["A6-%02d" % i for i in range(1, 12)]
L = [73, 205, 79, 80, 85, 134, 133, 85, 226, 174, 123]
N = [14, 14, 14, 14, 14, 20, 14, 14, 20, 20]
G = ["(2) 지면 통과  x  원형 인셋", "(3) 항목 낙하  x  원형 인셋",
     "(1) 포털 진입  x  X-ray 해부", "(1) 포털 진입  x  상태 변화",
     "(2) 지면 통과  x  X-ray 해부", "(3) 항목 낙하  x  가시적 행위자",
     "(1) 포털 진입  x  X-ray 해부", "(1) 포털 진입  x  원형 인셋",
     "(2) 지면 통과  x  X-ray 해부", "(4) 귀환  x  상태 변화"]

# running totals, exactly as the assembler reported them
T, t = [], 0
for i in range(11):
    t = L[0] if i == 0 else t + L[i] - N[i - 1]
    T.append(t)
assert T[-1] == 1239, T

body, seam, starts = [], [], [0]
for k in range(10):
    seam.append((T[k] - N[k], T[k] - 1, G[k]))
    starts.append(T[k])
for i in range(11):
    end = (seam[i][0] - 1) if i < 10 else 1238
    body.append((IDS[i], starts[i], end))

parts, k = [], 0


def dt(path, y, size, a, z):
    return ("drawtext=fontfile=%s:textfile=%s:x=(w-text_w)/2:y=%s:fontsize=%d:"
            "fontcolor=white:box=1:boxcolor=black@0.60:boxborderw=14:"
            "line_spacing=8:enable='between(n\\,%d\\,%d)'"
            % (FONT, path, y, size, a, z))


for sid, a, z in body:
    k += 1
    p = "%s/b%02d.txt" % (TXT, k)
    open(p, "w", encoding="utf-8").write("%s\n%s" % (sid, R[sid]["narr"]))
    parts.append(dt(p, "h-th-46", 30, a, z))
for j, (a, z, g) in enumerate(seam, 1):
    p = "%s/s%02d.txt" % (TXT, j)
    open(p, "w", encoding="utf-8").write("SEAM %02d  n=%df\n%s" % (j, N[j - 1], g))
    parts.append(dt(p, "h-th-46", 30, a, z))

print("body %d  seam %d  frames %d" % (len(body), len(seam), T[-1]), flush=True)
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", SRC,
                "-vf", "scale=1280:720," + ",".join(parts),
                "-c:v", "libx264", "-preset", "medium", "-crf", "23",
                "-pix_fmt", "yuv420p", "-an", "_a6tx2/_rev.mp4"], check=True)
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", "_a6tx2/_rev.mp4",
                "-ss", "353.50", "-i", "/home/user/lf/inbox/rd/v14_audio_500s.wav",
                "-map", "0:v", "-map", "1:a", "-shortest", "-c:v", "copy",
                "-c:a", "aac", "-b:a", "160k", OUT], check=True)
print("DONE", OUT, os.path.getsize(OUT), flush=True)
