# -*- coding: utf-8 -*-
"""Burn the script line of each cut onto the pilot, per CEO-48.

CEO-48 asked that a picture never arrives without the script flow that belongs
to it. A table beside the file is one way; putting the line on the frame it
belongs to is the way that cannot be misread, because the CEO cannot end up
looking at cut 7 while reading the line for cut 5.

The seam windows carry the grammar label instead of a narration line: those
frames belong to neither cut, and labelling them is how the CEO can tell a
transition apart from a hard cut without trusting my word for it.
"""
import os, subprocess
import shots38 as S

SRC = "a6_pilot.mp4"; OUT = "a6_pilot_script_720p.mp4"
FONT = "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf"
TXT  = "_a6tx/txt"; os.makedirs(TXT, exist_ok=True)

# body frame ranges, read off the assembly log (P = cumulative prev length)
BODY = [("A6-01",   0,   52), ("A6-02",  71, 228), ("A6-03", 249, 280),
        ("A6-04", 299, 334), ("A6-05", 353, 392), ("A6-06", 411, 493),
        ("A6-07", 514, 594), ("A6-08", 615, 650), ("A6-09", 671, 844),
        ("A6-10", 865,1015), ("A6-11",1038,1133)]
# seam windows and the grammar the team assigned to each
SEAM = [( 53,  70, "(2) 지면 통과  x  원형 인셋"),
        (229, 248, "(3) 항목 낙하  x  원형 인셋"),
        (281, 298, "(1) 포털 진입  x  X-ray 해부"),
        (335, 352, "(1) 포털 진입  x  상태 변화"),
        (393, 410, "(2) 지면 통과  x  X-ray 해부"),
        (494, 513, "(3) 항목 낙하  x  가시적 행위자"),
        (595, 614, "(1) 포털 진입  x  X-ray 해부"),
        (651, 670, "(1) 포털 진입  x  원형 인셋"),
        (845, 864, "(2) 지면 통과  x  X-ray 해부"),
        (1016,1037,"(4) 귀환  x  상태 변화")]

narr = {r["sid"]: r["narr"] for r in S.TABLE38}
parts = []

def dt(path, x, y, size, box, a, b, extra=""):
    return ("drawtext=fontfile=%s:textfile=%s:x=%s:y=%s:fontsize=%d:"
            "fontcolor=white:box=1:boxcolor=black@%.2f:boxborderw=14:"
            "enable='between(n\\,%d\\,%d)'%s" % (FONT, path, x, y, size, box, a, b, extra))

for sid, a, b in BODY:
    p = "%s/%s.txt" % (TXT, sid)
    open(p, "w", encoding="utf-8").write(narr[sid])
    parts.append(dt(p, "(w-text_w)/2", "h-th-56", 34, 0.62, a, b))
    q = "%s/%s_id.txt" % (TXT, sid)
    open(q, "w", encoding="utf-8").write(sid)
    parts.append(dt(q, "48", "44", 26, 0.50, a, b))

for i, (a, b, lab) in enumerate(SEAM, 1):
    p = "%s/seam%02d.txt" % (TXT, i)
    open(p, "w", encoding="utf-8").write(lab)
    parts.append(dt(p, "(w-text_w)/2", "h-th-56", 32, 0.62, a, b))
    q = "%s/seam%02d_id.txt" % (TXT, i)
    open(q, "w", encoding="utf-8").write("SEAM %02d" % i)
    parts.append(dt(q, "48", "44", 26, 0.50, a, b))

vf = "scale=1280:720," + ",".join(parts)
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", SRC, "-vf", vf,
                "-c:v", "libx264", "-preset", "medium", "-crf", "23",
                "-pix_fmt", "yuv420p", "-an", OUT], check=True)
print("BURNED", OUT, os.path.getsize(OUT), flush=True)
