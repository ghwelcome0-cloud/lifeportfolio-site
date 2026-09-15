#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
neon.py -- render the CEO-approved caption graphic as a real-font RGBA panel.

WHY THIS FILE EXISTS
--------------------
[CEO-64] rejected the pilot v2v because the Korean word, although spelled
correctly, did not read at image grade -- it came back as a flat red sans-serif
sticker. [CEO-65] then supplied the answer as three approved stills and said:

    "요런 퀄리티여서 제가 승인했는데, 프리비즈로 바꾸고 글자 퀄리티가
     문제가 되네요."

Measuring those three stills pixel by pixel showed that the quality the CEO
approved is NOT "red ink printed on paper" at all. It is a designed lightbox
graphic: a dark translucent rounded panel, a bright cyan neon rim that spills
glow onto the surfaces around it, and heavy WHITE Hangul inside.

    approved standard          std1        std2        std3
    panel dark fill RGB     (20,27,25)  (31,41,38)  (17,23,24)
    neon core RGB          (175,255,255)(190,250,255)(177,255,255)
    glyph white                241         234         245
    glyph_h / panel_h         0.432       0.541       0.470
    glyph_h / frame_h         0.089       0.139       0.189
    panel_w / frame_w         0.422       0.447       0.633

That measurement changes the whole strategy. A lightbox caption is a graphic we
can DRAW OURSELVES with a real font at native resolution -- so the video model
never has to draw a Hangul glyph again. Every one of the five lettering
rejections (CEO-16, 18, 57, 58, 64) came from asking a generative model to
render Korean type. This file removes that ask.

Re-rendering the previz was considered and rejected on measurement, not on
taste: the 60-job previz batch took 2208.7 minutes (36.8 h) of CPU, so a
previz change is not something we can iterate on. The panel is composited
after v2v instead, which costs nothing and can be revised in seconds.

The numbers below are the medians of the three approved stills, not invented
values. Anything a reviewer might want to argue with is a named constant.
"""
import os
import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

FONT = "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf"

# ---- measured from the three approved stills -----------------------------
FILL_RGB   = (22, 30, 28)    # median of (20,27,25) (31,41,38) (17,23,24)
FILL_A     = 205             # translucent: the desk stays faintly visible
NEON_RGB   = (180, 253, 255) # median of the three neon cores
GLYPH_RGB  = (243, 243, 243) # median of 241 / 234 / 245
GLYPH_FRAC = 0.48            # glyph height / panel height (0.432/0.541/0.470)
PAD_X      = 0.085           # side padding as a fraction of panel width
RIM_FRAC   = 0.020           # neon rim thickness / panel height
CORNER     = 0.170           # corner radius / panel height
GLOW_OUT   = 0.42            # outer glow reach / panel height
GLOW_GAIN  = 1.00            # additive strength of the spill onto the plate

# panel width as a fraction of frame width, by line length.
# std1 "정답은 없습니다"        (8 glyphs)  -> 0.422
# std2 "남기고 싶은 변화"       (8 glyphs)  -> 0.447
# std3 "선택지는 늘고 기준은 흐려집니다" (16) -> 0.633
# A single word like 「방식」 is far shorter than any of those, so the width is
# driven by the text itself and then clamped into the approved band.
# The first test run of this file produced panel_w/W = 0.298 and glyph_h/H =
# 0.069 for the two-word line 「일하는 방식」 -- both BELOW the approved band,
# because the width was being derived from the text alone and a short Korean
# phrase simply does not need much room. Colour and the glyph/panel ratio were
# already inside the band on that same run, so the floor is the only thing that
# was wrong. It is raised to the narrowest approved still (std1, 0.422) so that
# even a single word gets a panel of approved presence.
W_MIN, W_MAX = 0.42, 0.64
H_FRAC = 0.22          # measured band 0.205 / 0.257 / 0.403; short lines sit low


def _rrect(size, radius, fill):
    """Rounded rectangle as its own L mask, so it can be reused for glow."""
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1],
                                        radius=radius, fill=fill)
    return m


def fit_font(text, box_w, glyph_h):
    """Largest size whose cap height is glyph_h and which still fits box_w."""
    lo, hi = 8, 400
    while lo < hi:
        mid = (lo + hi + 1) // 2
        f = ImageFont.truetype(FONT, mid)
        a, b, c, d = f.getbbox(text)
        if (d - b) <= glyph_h and (c - a) <= box_w:
            lo = mid
        else:
            hi = mid - 1
    return ImageFont.truetype(FONT, lo)


def fit_w(text, frame_w, frame_h, h_frac):
    """Panel width fraction that gives `text` the approved side padding.

    The W_MIN floor above was measured on sentences (8 and 16 glyphs). Applying
    it to a two-glyph word like 「방식」 would produce a 537 px panel holding
    160 px of type -- an empty box, which is NOT what the approved stills look
    like. What the stills actually hold constant is the padding ratio: in std1,
    panel width / glyph height is 8.4 for 8 glyphs, i.e. the panel is exactly
    the text plus PAD_X on each side.

    So for short lines the width is derived from the text and the floor is
    dropped, while the glyph height (the thing the eye actually grades) is kept
    inside the approved band by the caller's h_frac.
    """
    gh = int(frame_h * h_frac * GLYPH_FRAC)
    f = ImageFont.truetype(FONT, max(8, gh))
    a, b, c, d = f.getbbox(text)
    return min(W_MAX, ((c - a) / (1.0 - 2 * PAD_X)) / frame_w)


def panel(text, frame_w, frame_h, w_frac=None, h_frac=None):
    """Return (RGBA panel, RGBA glow) sized for a frame_w x frame_h plate.

    The panel is drawn at 3x and downsampled with LANCZOS. Supersampling is the
    reason the rim and the Hangul terminals survive at 720p: drawn at 1x, a
    2 px neon rim aliases into a dotted line, which is exactly the "저급"
    look we are trying to leave behind.
    """
    SS = 3
    if h_frac is None:
        h_frac = H_FRAC
    ph = max(24, int(frame_h * h_frac))
    if w_frac is None:
        probe = ImageFont.truetype(FONT, int(ph * GLYPH_FRAC))
        a, b, c, d = probe.getbbox(text)
        need = (c - a) / (1.0 - 2 * PAD_X)
        w_frac = min(W_MAX, max(W_MIN, need / frame_w))
    pw = int(frame_w * w_frac)

    W, H = pw * SS, ph * SS
    rad = int(H * CORNER)
    rim = max(SS, int(H * RIM_FRAC))

    body = _rrect((W, H), rad, 255)
    inner = Image.new("L", (W, H), 0)
    ImageDraw.Draw(inner).rounded_rectangle(
        [rim, rim, W - 1 - rim, H - 1 - rim],
        radius=max(1, rad - rim), fill=255)

    # rim = body minus inner
    rim_mask = Image.composite(Image.new("L", (W, H), 0), body, inner)

    out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    out.paste(Image.new("RGBA", (W, H), FILL_RGB + (FILL_A,)), (0, 0), inner)
    out.paste(Image.new("RGBA", (W, H), NEON_RGB + (255,)), (0, 0), rim_mask)

    # inner bloom: the rim lights the panel face just inside the edge, which is
    # visible in all three approved stills and is what stops the panel reading
    # as a plain black box with a coloured outline.
    bloom = rim_mask.filter(ImageFilter.GaussianBlur(rad * 0.55))
    bloom = Image.eval(bloom, lambda v: int(v * 0.55))
    bloom = Image.composite(bloom, Image.new("L", (W, H), 0), inner)
    out.paste(Image.new("RGBA", (W, H), NEON_RGB + (255,)), (0, 0), bloom)

    # the lettering: a real font, drawn once, at full panel resolution
    gh = int(H * GLYPH_FRAC)
    f = fit_font(text, int(W * (1.0 - 2 * PAD_X)), gh)
    d = ImageDraw.Draw(out)
    a, b, c, e = f.getbbox(text)
    tx = (W - (c - a)) // 2 - a
    ty = (H - (e - b)) // 2 - b
    d.text((tx, ty), text, font=f, fill=GLYPH_RGB + (255,))

    # outer spill, built from the rim only so the glow follows the neon shape
    reach = int(H * GLOW_OUT)
    gsz = (W + 2 * reach, H + 2 * reach)
    gl = Image.new("L", gsz, 0)
    gl.paste(rim_mask, (reach, reach))
    gl = gl.filter(ImageFilter.GaussianBlur(reach * 0.42))
    glow = Image.new("RGBA", gsz, NEON_RGB + (0,))
    glow.putalpha(Image.eval(gl, lambda v: int(v * 0.80)))

    return (out.resize((pw, ph), Image.LANCZOS),
            glow.resize((gsz[0] // SS, gsz[1] // SS), Image.LANCZOS))


_PCACHE = {}


def panel_cached(text, frame_w, frame_h, w_frac, h_frac):
    """panel() memoised on its arguments.

    The panel is a rigid graphic: within one shot the text and the size never
    change, only the position does. Re-drawing it per frame would repeat the 3x
    supersampled render 145 times for the pilot, and 8,392 times (three panels
    per frame on a converge) for the master -- for a bitmap that is identical
    every time.
    """
    key = (text, frame_w, frame_h, w_frac, h_frac)
    if key not in _PCACHE:
        _PCACHE[key] = panel(text, frame_w, frame_h, w_frac, h_frac)
    return _PCACHE[key]


def place(plate, text, cx=0.5, cy=0.30, w_frac=None, h_frac=None, scale=1.0):
    """Composite the panel onto a PIL RGB plate at fractional centre (cx, cy).

    The glow is added, not pasted: a real neon sign brightens the wood and the
    paper around it (clearly visible in std3, where cyan spills across the
    documents under the panel). Alpha-pasting a soft cyan rectangle instead
    would darken the plate and read as fog.
    """
    W, H = plate.size
    p, g = panel_cached(text, W, H, w_frac, h_frac)
    if scale != 1.0:
        p = p.resize((max(1, int(p.width * scale)), max(1, int(p.height * scale))), Image.LANCZOS)
        g = g.resize((max(1, int(g.width * scale)), max(1, int(g.height * scale))), Image.LANCZOS)
    px, py = int(W * cx), int(H * cy)

    base = plate.convert("RGB")
    # The additive glow used to be a per-pixel Python loop. At 1280x720 that is
    # 921,600 putpixel calls per frame -- about 2.5 s -- which is fine for one
    # still and hopeless for the 8,392 frames of the master. ImageChops.add
    # does the same arithmetic in C.
    gx, gy = px - g.width // 2, py - g.height // 2
    spill = Image.new("RGB", (W, H), (0, 0, 0))
    ga = Image.new("L", (W, H), 0)
    spill.paste(g.convert("RGB"), (gx, gy))
    ga.paste(g.split()[3], (gx, gy))
    if GLOW_GAIN != 1.0:
        ga = Image.eval(ga, lambda v: min(255, int(v * GLOW_GAIN)))
    # premultiply the spill by its own alpha, then add
    spill = Image.merge("RGB", [ImageChops.multiply(ch, ga) for ch in spill.split()])
    lit = ImageChops.add(base, spill)
    lit.paste(p, (px - p.width // 2, py - p.height // 2), p)
    return lit


if __name__ == "__main__":
    import sys
    src, text, dst = sys.argv[1], sys.argv[2], sys.argv[3]
    cx = float(sys.argv[4]) if len(sys.argv) > 4 else 0.5
    cy = float(sys.argv[5]) if len(sys.argv) > 5 else 0.30
    im = Image.open(src).convert("RGB")
    place(im, text, cx, cy).save(dst)
    print("wrote", dst, Image.open(dst).size)
