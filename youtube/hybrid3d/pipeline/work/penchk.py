#!/usr/bin/env python3
"""Verify the penetration effect actually landed: sharpness must dip at the cut
(3.55s) and recover, forming a V. Measured via Laplacian variance per frame."""
import subprocess, cv2, numpy as np, os

SRC, FPS, CUT = "v6_final.mp4", 24, 3.55
rows = []
for i in range(-8, 9):
    t = CUT + i/FPS
    if t < 0: continue
    p = f"_p{i}.png"
    subprocess.run(["ffmpeg","-v","error","-y","-ss",f"{t:.4f}","-i",SRC,
                    "-frames:v","1",p], check=True)
    im = cv2.imread(p, cv2.IMREAD_GRAYSCALE)
    lv = cv2.Laplacian(im, cv2.CV_64F).var()
    rows.append((t, i, lv)); os.unlink(p)

base = np.median([r[2] for r in rows if abs(r[1]) > 5])
print(f"baseline sharpness (|frame|>5) = {base:.1f}\n")
print(f"{'t':>7} {'frame':>6} {'sharpness':>10} {'vs base':>9}")
for t, i, lv in rows:
    mark = "  <== CUT" if i == 0 else ""
    print(f"{t:7.3f} {i:+6d} {lv:10.1f} {lv/base*100:8.0f}%{mark}")

dip = min(r[2] for r in rows if abs(r[1]) <= 3)
print(f"\nmin sharpness within +/-3 frames = {dip:.1f}  ({dip/base*100:.0f}% of baseline)")
print("PASS: blur dip present" if dip < base*0.75 else "FAIL: no visible blur dip")
