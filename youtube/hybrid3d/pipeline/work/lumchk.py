#!/usr/bin/env python3
"""Measure luminance + colour temperature continuity across the planned cut.
Cut = end of seg1 @3.55s  ->  start of seg2 @0.25s.
Goal: brightness delta small, and warm/cool balance (R-B) similar.
"""
import subprocess, cv2, numpy as np, os

def frame(src, t, out):
    subprocess.run(["ffmpeg","-v","error","-y","-ss",str(t),"-i",src,
                    "-frames:v","1",out], check=True)
    return cv2.imread(out)

def stats(img, tag):
    b, g, r = [img[:,:,i].astype(np.float32) for i in range(3)]
    y = 0.114*b + 0.587*g + 0.299*r
    warm = float(r.mean() - b.mean())      # >0 warm, <0 cool
    print(f"{tag:22s} Y={y.mean():6.2f}  R={r.mean():6.2f} G={g.mean():6.2f} "
          f"B={b.mean():6.2f}  warmth(R-B)={warm:+6.2f}")
    return y.mean(), warm

print("=== cut boundary continuity ===")
a = frame("seg1.mp4", 3.50, "_a.png")
y1, w1 = stats(a, "seg1 @3.50 (out)")

for name, src, t in (("OLD seg2 @0.25 (in)", "seg2.mp4", 0.25),
                     ("NEW seg2w @0.25(in)", "seg2w.mp4", 0.25)):
    b = frame(src, t, "_b.png")
    y2, w2 = stats(b, name)
    print(f"   -> dY={abs(y2-y1):6.2f}   d_warmth={abs(w2-w1):6.2f}")

print("\n=== NEW seg2w exposure stability over time ===")
prev = None
for t in (0.25, 1.0, 2.0, 3.0, 3.9):
    im = frame("seg2w.mp4", t, "_c.png")
    y, w = stats(im, f"  t={t:4.2f}s")
    prev = y
for f in ("_a.png","_b.png","_c.png"):
    if os.path.exists(f): os.unlink(f)
