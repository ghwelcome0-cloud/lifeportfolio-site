# -*- coding: utf-8 -*-
"""A6 pilot as the CUSTOMER will see it: real subtitles, no technical labels.

CEO asked two questions about the review copy I sent:
  "자막 내용에는 대사가 아니라 기술적인 용어?가 표현되어 있는데, 이건 나중에
   없어지는 거죠?"                                    -> yes, and here is proof
  "자막은 ... 어절 단위로 의미를 살려고 정렬이 잘 되어야 해요."  -> srtwrap.py

So this render carries the delivered SRT cues, re-wrapped on meaning boundaries,
and nothing else. No sid badge, no grammar label. The technical burn-in existed
only so the CEO could tell a transition from a hard cut without trusting my
word; it was scaffolding for the review, never part of the product.
"""
import os, re, subprocess
import srtwrap

SRC  = "a6_pilot.mp4"
SRT  = "/home/user/lf/inbox/rd/v14_500s_wrap.srt"
OUT  = "a6_pilot_customer_720p.mp4"
FONT = "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf"
A6_T0, FPS = 353.50, 24.0
TXT = "_a6tx/cust"; os.makedirs(TXT, exist_ok=True)

_TS = re.compile(r"(\d\d):(\d\d):(\d\d),(\d\d\d) --> (\d\d):(\d\d):(\d\d),(\d\d\d)")

def secs(h, m, s, ms):
    return int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000.0

blocks, cur = [], []
for line in open(SRT, encoding="utf-8"):
    line = line.rstrip("\n")
    if not line.strip():
        if cur: blocks.append(cur); cur = []
    else: cur.append(line)
if cur: blocks.append(cur)

parts, used = [], 0
for b in blocks:
    m = _TS.search(b[1]) if len(b) >= 3 else None
    if not m: continue
    t0 = secs(*m.groups()[:4]) - A6_T0
    t1 = secs(*m.groups()[4:]) - A6_T0
    if t1 <= 0 or t0 >= 47.25: continue
    a = max(int(round(max(t0, 0.0) * FPS)), 0)
    z = min(int(round(min(t1, 47.25) * FPS)), 1133)
    if z <= a: continue
    used += 1
    p = "%s/c%03d.txt" % (TXT, used)
    open(p, "w", encoding="utf-8").write("\n".join(b[2:]))
    parts.append(
        "drawtext=fontfile=%s:textfile=%s:x=(w-text_w)/2:y=h-th-52:"
        "fontsize=36:line_spacing=10:fontcolor=white:box=1:boxcolor=black@0.55:"
        "boxborderw=16:enable='between(n\\,%d\\,%d)'" % (FONT, p, a, z))

print("cues landing inside A6:", used, flush=True)
vf = "scale=1280:720," + ",".join(parts)
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", SRC, "-vf", vf,
                "-c:v", "libx264", "-preset", "medium", "-crf", "23",
                "-pix_fmt", "yuv420p", "-an", "_a6tx/_cust_v.mp4"], check=True)
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", "_a6tx/_cust_v.mp4",
                "-ss", str(A6_T0), "-i", "/home/user/lf/inbox/rd/v14_audio_500s.wav",
                "-map", "0:v", "-map", "1:a", "-shortest",
                "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", OUT], check=True)
print("DONE", OUT, os.path.getsize(OUT), flush=True)
