#!/usr/bin/env python3
"""Compose ACT8's portrait report pages onto 16:9 canvases.

Why this file has to exist
--------------------------
ACT8 is the one place in the film that shows a REAL artefact: three pages of an
actual issued 인생포트폴리오 report, rendered from our own report.html. CEO-34 is
explicit that the benchmark's power comes from taking something that genuinely
exists and cutting into it, and these pages are our equivalent — the image team
correctly refused to redraw them (mid 2884959: "이미지로 다시 그리면 팔레트만 맞고
내용이 다른 지면이 되어 반드시 반려됩니다").

But a report page is portrait and the film is 16:9, and zoompan cannot bridge
that: proven with a circle probe, its crop keeps the aspect of its input and
rescales it to `s`, so feeding it a 1970x3175 page squeezes the page sideways by
2.86x. Every stroke of real printed Korean gets flattened. That is the CEO-16
rejection ("글자 퀄리티는 따로 놀아요. 저급이에요") arriving through a side door,
on the one shot whose entire job is to be believable.

So the page is composed onto a 16:9 canvas HERE, in arithmetic I can measure,
and assemble.kenburns() now refuses anything that is not 16:9 so the squeeze
cannot come back.

Two candidate compositions, rendered and judged rather than assumed
-------------------------------------------------------------------
A  TALL  — canvas is one page tall (16:9 at page height). The page sits centred,
   occupying ~35% of the canvas width, on a studio backdrop. A Ken Burns push
   then travels INSIDE the page. Downside: at any zoom that shows the whole page,
   two thirds of the screen is backdrop.

B  SPREAD — canvas is one page WIDE times 9/16 tall, i.e. a 16:9 window on the
   page itself, and the camera travels DOWN the page across roughly three such
   windows. The page fills the full frame width; the backdrop is never seen.
   Downside: the whole page is never visible at once.

B is what the benchmark actually does with a cross-section: it does not show you
the whole object politely, it puts you inside it and moves. A is the safer
"here is a document" reading. I render both and read the frames before choosing,
because a 65% backdrop and a never-whole page are both real costs and neither is
decidable from arithmetic.

The backdrop is not flat grey. It is the deep navy/charcoal of the film's own
palette with a soft radial lift behind the page and a drop shadow, so the page
reads as a physical object held in a lit space — the same "실제로 존재하는 것"
logic as the plates, rather than a screenshot pasted on a slide.
"""
import cv2
import numpy as np
import os

W, H = 1920, 1080
REPORT = "/home/user/lf/land38/report"
OUT = "/home/user/lf/land38/canvas"

PAGES = {"S24": "report_p03.png", "S25": "report_p05.png", "S26": "report_p08.png"}

# Film palette, sampled from the approved plates (deep charcoal-navy).
BACK = (34, 26, 20)        # BGR
LIFT = (74, 58, 44)        # BGR, the radial lift behind the page


def backdrop(w, h, px, py, pw, ph):
    """Charcoal-navy field with a soft radial lift centred on the page."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    cx, cy = px + pw / 2.0, py + ph / 2.0
    # normalise by the page's own size so the lift scales with the page
    d = np.sqrt(((xx - cx) / (pw * 1.35)) ** 2 + ((yy - cy) / (ph * 1.35)) ** 2)
    t = np.clip(1.0 - d, 0.0, 1.0) ** 1.6
    out = np.empty((h, w, 3), np.float32)
    for c in range(3):
        out[:, :, c] = BACK[c] + (LIFT[c] - BACK[c]) * t
    return out


def shadow(canvas, px, py, pw, ph):
    """Soft contact shadow under the page, so it sits in the space."""
    m = np.zeros(canvas.shape[:2], np.float32)
    pad = int(ph * 0.012)
    y0, y1 = max(py + pad, 0), min(py + ph + pad * 3, canvas.shape[0])
    x0, x1 = max(px - pad, 0), min(px + pw + pad, canvas.shape[1])
    m[y0:y1, x0:x1] = 1.0
    k = int(ph * 0.05) | 1
    m = cv2.GaussianBlur(m, (k, k), 0) * 0.55
    return canvas * (1.0 - m[:, :, None])


def compose_tall(page):
    """A: whole page visible, canvas 16:9 at page height."""
    ph, pw = page.shape[:2]
    ch = int(ph * 1.14) // 2 * 2                 # a little air above and below
    cw = int(round(ch * W / H)) // 2 * 2
    px, py = (cw - pw) // 2, (ch - ph) // 2
    canvas = backdrop(cw, ch, px, py, pw, ph)
    canvas = shadow(canvas, px, py, pw, ph)
    canvas[py:py + ph, px:px + pw] = page.astype(np.float32)
    return np.clip(canvas, 0, 255).astype(np.uint8)


# Option B is NOT a canvas, and finding that out is the useful part of this file.
#
# I first tried to build it as one: a canvas whose width is the page width so the
# page fills the frame edge to edge, with the camera travelling down it. That
# cannot exist. kenburns requires a 16:9 source, and a 16:9 source at page width
# is exactly ONE window tall — there is nothing left to travel down. The attempt
# failed on a broadcast error, which was the arithmetic telling me the same thing.
#
# Travelling down a portrait page at full width is therefore a RENDERER, not an
# asset: crop a 16:9 window out of the portrait page and move that window in time.
# assemble.pagepan() does it, and because the window is cut at 16:9 before any
# rescale, the page's proportions survive exactly. See it there.


def main():
    os.makedirs(OUT, exist_ok=True)
    for anchor, fn in PAGES.items():
        p = os.path.join(REPORT, fn)
        page = cv2.imread(p)
        if page is None:
            print(f"! missing {p}")
            continue
        ph, pw = page.shape[:2]
        c = compose_tall(page)
        ch, cw = c.shape[:2]
        out = os.path.join(OUT, f"{anchor}_tall.png")
        cv2.imwrite(out, c)
        print(f"{anchor} {fn} {pw}x{ph} -> tall {cw}x{ch} "
              f"aspect {cw/ch:.4f}  page fills {pw/cw*100:.0f}pct width, "
              f"{ph/ch*100:.0f}pct height")


if __name__ == "__main__":
    main()
