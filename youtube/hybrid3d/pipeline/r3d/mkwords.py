#!/usr/bin/env python3
"""Generate RGBA Korean word textures for previz markers -- HIGH QUALITY pass.

[CEO-57] "이미지 수준의 글자 퀄리티이어야 합니다. 글자만 저품질이면 이상해요."
This is the CEO's THIRD report of the same defect (CEO-16 -> CEO-18 -> CEO-57),
so the glyph pixel budget is rebuilt from the source instead of being patched.

Lesson 170 (measured, not guessed).  In the previous pass the glyph was drawn at
512x256 and then landed on screen at only 66x30 px in J_A4-03 -- 8% of the frame
width -- and vanished completely (0 red pixels) by the last frame.  Feeding 66 px
of information into a 1280 px v2v output forces the generator to REINVENT the
letter shapes, which is exactly the "저급" look.  Three things are fixed:

  1. here   : draw at ~3.5x supersample, downsample with LANCZOS, crop to the
              INK bounding box so not one texel is wasted, emit 2048 px wide.
  2. previz : scale the glyph plane with camera distance so the ink always keeps
              a fixed share of the FRAME WIDTH, and billboard it so it can never
              go edge-on.  (previz_batch.py)
  3. prompt : declare print-quality typography explicitly.  (prompts.py)

Because the texture is cropped to the ink, the plane aspect must follow the
texture aspect -- both are written to words/meta.json for previz_batch.py to
read.  Nothing is hard-coded twice.

One word per ACT, taken from that ACT's own script vocabulary:
  ACT3 방식   ACT4 변화   ACT5 기준   ACT6 조율자   ACT7 역할
ACT8 is report pages and carries no rising word.
"""
import os
import json
from PIL import Image, ImageDraw, ImageFont

FONT = "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf"
OUT = "/home/user/lf/r3d/words"
WORDS = {"A3": "방식", "A4": "변화", "A5": "기준", "A6": "조율자", "A7": "역할"}
RED = (255, 25, 15, 255)

DRAW_PT = 2600          # supersample size -- downsampled to TARGET_W below
TARGET_W = 2048         # final texture width (v2v output is 1280 wide)
MARGIN = 0.035          # transparent margin as a fraction of ink width

os.makedirs(OUT, exist_ok=True)
meta = {}
for act, w in sorted(WORDS.items()):
    f = ImageFont.truetype(FONT, DRAW_PT)
    # oversized scratch canvas; the exact ink box is measured afterwards
    pad = DRAW_PT
    bb = f.getbbox(w)
    cw, ch = bb[2] - bb[0] + 2 * pad, bb[3] - bb[1] + 2 * pad
    im = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))   # transparent or it renders black
    ImageDraw.Draw(im).text((pad - bb[0], pad - bb[1]), w, font=f, fill=RED)

    ink = im.split()[3].getbbox()                    # tight bbox of the ALPHA
    iw, ih = ink[2] - ink[0], ink[3] - ink[1]
    m = int(round(iw * MARGIN))
    im = im.crop((ink[0] - m, ink[1] - m, ink[2] + m, ink[3] + m))

    # LANCZOS downsample = real anti-aliasing.  Cycles runs at samples>=16 now,
    # but the glyph edge quality must not depend on the render sampler alone.
    tw = TARGET_W
    th = max(1, int(round(im.height * tw / im.width)))
    im = im.resize((tw, th), Image.LANCZOS)

    p = os.path.join(OUT, "%s.png" % act)
    im.save(p)
    ink_frac = iw / (iw + 2 * m)                     # ink share of texture width
    meta[act] = {"word": w, "w": tw, "h": th,
                 "aspect": round(tw / th, 5),
                 "ink_frac": round(ink_frac, 5),
                 "chars": len(w)}
    print("%s %-4s %s  %dx%d  aspect %.3f  ink_frac %.3f  %dB"
          % (act, w, os.path.basename(p), tw, th, tw / th, ink_frac,
             os.path.getsize(p)))

mp = os.path.join(OUT, "meta.json")
json.dump(meta, open(mp, "w"), ensure_ascii=False, indent=1)
print("wrote", mp)

# ---- gate: a texture the previz cannot use must never reach a paid call ------
for act, d in meta.items():
    if d["w"] < 1280:
        raise SystemExit("WORD GATE FAILED %s: width %d < 1280" % (act, d["w"]))
    if not (1.2 <= d["aspect"] <= 6.0):
        raise SystemExit("WORD GATE FAILED %s: aspect %.3f out of range" % (act, d["aspect"]))
    if d["ink_frac"] < 0.85:
        raise SystemExit("WORD GATE FAILED %s: ink_frac %.3f < 0.85" % (act, d["ink_frac"]))
print("WORD GATE OK  textures %d  target_w %d  supersample %.1fx"
      % (len(meta), TARGET_W, DRAW_PT * 1.0 / TARGET_W * 2))
