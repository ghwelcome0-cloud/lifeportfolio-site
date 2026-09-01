#!/usr/bin/env python3
"""Render both ACT8 framing candidates and measure them, before choosing.

The shot table gives no help here: A8-01/02/03 carry an empty `objects` and an
empty `narr`, so there is no position language to aim at and no sentence to time
to. The framing is therefore decided by the artefact's own shape, which means it
has to be decided by looking. Both candidates are free.

  A  tall canvas + kenburns   whole page visible, ~30% of frame width is page
  B  pagepan                  page fills frame width, ~1/3 of page visible at once

What I measure on each: the net scale applied to the page (a proxy for glyph
damage — anything above 1.0 is resampling detail upward), how much of the frame
is actually page, and a sharpness figure taken from the frame itself so the two
are compared on the same evidence rather than on my expectations.
"""
import os
import subprocess
import cv2
import numpy as np
import assemble as A

CANVAS = "/home/user/lf/land38/canvas"
REPORT = "/home/user/lf/land38/report"
WORK = "_act8try"
PICKS = [("S24", "report_p03.png", "S24_tall.png", 4.58),
         ("S25", "report_p05.png", "S25_tall.png", 5.42),
         ("S26", "report_p08.png", "S26_tall.png", 5.54)]


def frame(mp4, idx, png):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", mp4,
                    "-vf", f"select=eq(n\\,{idx})", "-vsync", "0",
                    "-frames:v", "1", png], check=True)


def sharp(png):
    """Variance of Laplacian on the green channel — higher is crisper. Compared
    only between renders of the SAME page, where content is identical, so the
    figure isolates resampling rather than image complexity."""
    im = cv2.imread(png)
    g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
    return float(cv2.Laplacian(g, cv2.CV_64F).var())


def page_fraction(png, thresh=200):
    """Fraction of the frame that is bright page rather than dark backdrop."""
    im = cv2.imread(png)
    g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
    return float((g > thresh).mean())


def main():
    os.makedirs(WORK, exist_ok=True)
    for anchor, pagefn, canvasfn, dur in PICKS:
        page = os.path.join(REPORT, pagefn)
        canvas = os.path.join(CANVAS, canvasfn)
        ph, pw = cv2.imread(page).shape[:2]
        print(f"\n=== {anchor}  {pagefn} {pw}x{ph}  dur {dur:.2f}s ===")

        # A: whole page, composed canvas, gentle push (the table's "1.5% push" idea,
        # raised to the film's 10% floor since CEO-32 requires every cut to move)
        a = f"{WORK}/{anchor}_A_tall.mp4"
        A.kenburns(canvas, dur, a, z0=1.00, z1=1.12, ease="inout")

        # B: page fills the width, camera reads DOWN it
        b = f"{WORK}/{anchor}_B_pagepan.mp4"
        A.pagepan(page, dur, b, y0=0.0, y1=1.0, z0=1.00, z1=1.00, ease="inout")

        for tag, mp4 in (("A_tall", a), ("B_pagepan", b)):
            n = int(round(dur * A.FPS))
            for label, idx in (("first", 0), ("mid", n // 2), ("last", n - 1)):
                png = f"{WORK}/{anchor}_{tag}_{label}.png"
                frame(mp4, idx, png)
            s = [sharp(f"{WORK}/{anchor}_{tag}_{l}.png") for l in ("first", "mid", "last")]
            f = [page_fraction(f"{WORK}/{anchor}_{tag}_{l}.png") for l in ("first", "mid", "last")]
            print(f"  {tag:10s} sharpness {s[0]:7.1f} {s[1]:7.1f} {s[2]:7.1f}   "
                  f"page fills {f[0]*100:4.0f}pct {f[1]*100:4.0f}pct {f[2]*100:4.0f}pct of frame")
        # net scale, arithmetic
        cw = cv2.imread(canvas).shape[1]
        print(f"  A net scale on the page : {1920/cw:.3f}x  (page is {pw}/{cw} of a "
              f"{cw}px canvas -> {pw*1920/cw:.0f}px wide on screen)")
        print(f"  B net scale on the page : {1920/pw:.3f}x  (page spans the full 1920)")


if __name__ == "__main__":
    main()
