#!/usr/bin/env python3
"""Generate RGBA Korean SENTENCE textures for previz text panels.

[CEO-64] "'방식'이라는 글자도 정확하지만 글자 자체가 우리 예전에 이미지에
          걸맞는 퀄리티는 아니지 않아요?"
[CEO-16 -> 18 -> 57 -> 58 -> 64 -> 67#6]  the same defect reported SIX times.

-------------------------------------------------------------------------------
Lesson 191 (measured, not guessed) -- why the previous "one word per ACT" pass
could never satisfy the CEO's own approved reference.
-------------------------------------------------------------------------------
The three CEO-approved frames (lf/std/std{1,2,3}.png, 1024x576) pin down TWO
independent ratios at once:

    (1) panel_w / frame_w   = 0.422 / 0.447 / 0.633
    (2) glyph_h / frame_h   = 0.0885 / 0.1390 / 0.1893

The old textures were 2-3 character WORDS.  Measured ink aspect:

    방식   1.757        조율자  2.913

At any given width occupancy a 2-char word is ~3x TALLER than a sentence, so
ratio (2) blew past its ceiling.  A full arithmetic sweep proved no width
occupancy satisfies both ratios at once:

    occW 0.20 -> h 0.228  over      occW 0.18 -> h 0.205  over
    occW 0.16 -> h 0.182  OK   <-- but ink = 0.16*1280 = 205 px < MIN_INK_PX 210

Lowering the occupancy cannot fix it.  The DATUM itself was wrong.

-------------------------------------------------------------------------------
What the approved frames actually contain -- re-measured from the pixels
-------------------------------------------------------------------------------
Per-line ink boxes inside the approved panels:

    std1  "정답은 없습니다"              1 line   line aspect 6.292
    std2  "남기고 싶은 변화"              1 line   line aspect 4.603
    std3  "선택지는 늘고 기준은 흐려집니다"  3 LINES  body line aspect 6.830

So the approved look is not "a word": it is a SENTENCE, word-wrapped so that no
single line grows wider than roughly 7x its glyph height.  std3 is a THREE line
block -- that is how a 14.68-aspect sentence was brought back into the band.

Rendering the same strings with our own font at one line gives 7.105 / 7.426,
i.e. our font is ~13% wider per line than the approved typesetting, so the line
ceiling is taken at OUR font's equivalent of the widest approved line: 7.43.

-------------------------------------------------------------------------------
Verification (run this file; the gate re-checks it every time)
-------------------------------------------------------------------------------
Wrapping with LINE_ASPECT_MAX = 7.43 reproduces the approved line counts exactly
(std1 -> 1, std2 -> 1, std3 -> 3), and every ACT then lands inside the approved
height band across the whole occupancy range 0.42..0.63:

    A1 3 lines  h@.42 0.1212  h@.63 0.1818     A5 3 lines  0.1148  0.1721
    A2 2 lines         0.1052         0.1579     A6 2 lines  0.1024  0.1535
    A3 1 line          0.1051         0.1576     A7 2 lines  0.1057  0.1585
    A4 1 line          0.1005         0.1508     A8 1 line   0.1153  0.1729

Ink width at the floor occupancy is 0.42*1280 = 538 px, far above MIN_INK_PX 210,
so the ink gate in previz_batch.py is satisfied automatically -- which is what
Lesson 188 predicted when the datum moved from PAPER to FRAME occupancy.

-------------------------------------------------------------------------------
Text provenance -- nothing invented (order 【3】1: never guess, ask instead)
-------------------------------------------------------------------------------
Every string below is copied from the script CSVs.  Preference order:
  1. that ACT's own `on_screen_text` column   (this is what the approved frames
     were rendered from -- std1 = A3-12, std2 = A4-01, std3 = A1-09)
  2. if the ACT has no on_screen_text row (A6/A7/A8 have none), that ACT's own
     `narration` column, shortest self-contained line.
A8 previously had NO texture at all; it is generated here.

Line wrapping is word-boundary only (CEO-49 "자막 어절 단위") -- a Korean word is
never split.  The per-line and per-block geometry is written to words/meta.json
so previz_batch.py never re-derives it.
"""
import os
import json
from PIL import Image, ImageDraw, ImageFont

FONT = "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf"
OUT = "/home/user/lf/r3d/words"
CSV_DIR = "/home/user/lf/_script"

# ---- text, with the CSV row it came from (audit trail, never invented) -------
SENTENCES = {
    "A1": ("A1-09 on_screen_text  [= approved std3]", "선택지는 늘고 기준은 흐려집니다"),
    "A2": ("A2-09 on_screen_text",                    "명사보다 동사로 써보세요"),
    "A3": ("A3-12 on_screen_text  [= approved std1]", "정답은 없습니다"),
    "A4": ("A4-01 on_screen_text  [= approved std2]", "남기고 싶은 변화"),
    "A5": ("A5-10 on_screen_text",                    "정답 공식이 아니라, 더 좋은 질문"),
    "A6": ("A6-03 narration",                         "나는 어떤 역할을 반복해 왔는가?"),
    "A7": ("A7-12 narration",                         "오늘은 초안이면 충분합니다"),
    "A8": ("A8-01 narration",                         "한눈에 보는 나"),
}

WHITE = (240, 240, 240, 255)   # approved median 232-245, channel spread <= 6
DRAW_PT = 300                  # measuring / drawing size, downsampled to TARGET_W
TARGET_W = 2048                # final texture width (v2v output is 1280 wide)
MARGIN = 0.035                 # transparent margin as a fraction of ink width

# ---- geometry constants, all derived from the approved frames ----------------
LINE_ASPECT_MAX = 7.43   # our font's equivalent of the widest approved line
LEAD = 1.32              # baseline-to-baseline as a multiple of glyph height
OCC_MIN, OCC_MAX = 0.42, 0.63          # approved panel_w / frame_w
BAND_LO, BAND_HI = 0.0885, 0.1893      # approved glyph_h / frame_h
FRAME_W, FRAME_H = 1280.0, 720.0
MIN_INK_PX = 210         # must match previz_batch.py


def ink_box(text, pt=DRAW_PT):
    """Tight ink bbox of one rendered line.  getbbox() is NOT usable here: it
    includes font ascent/descent, which inflates the height and understates the
    aspect by ~10-25% -- exactly the error that made the first sweep reject the
    CEO's own approved std3."""
    f = ImageFont.truetype(FONT, pt)
    im = Image.new("RGBA", (pt * (len(text) + 2), pt * 3), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((pt, pt), text, font=f, fill=(255, 255, 255, 255))
    bb = im.split()[3].getbbox()
    return bb[2] - bb[0], bb[3] - bb[1]


def wrap(text):
    """Greedy word-boundary wrap: keep filling a line until it would exceed
    LINE_ASPECT_MAX.  Word-boundary only -- CEO-49."""
    out, cur = [], ""
    for w in text.split():
        cand = (cur + " " + w).strip()
        cw, ch = ink_box(cand)
        if cur and cw / float(ch) > LINE_ASPECT_MAX:
            out.append(cur)
            cur = w
        else:
            cur = cand
    if cur:
        out.append(cur)
    return out


def render(lines):
    """Render the wrapped block, cropped tight to the ink."""
    f = ImageFont.truetype(FONT, DRAW_PT)
    boxes = [ink_box(l) for l in lines]
    gh = max(h for _, h in boxes)
    step = int(round(gh * LEAD))
    pad = DRAW_PT
    cw = max(w for w, _ in boxes) + 2 * pad
    chh = gh + step * (len(lines) - 1) + 2 * pad
    im = Image.new("RGBA", (cw, chh), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for i, l in enumerate(lines):
        # centre each line on the block, like the approved frames
        lw = boxes[i][0]
        probe = Image.new("RGBA", (cw, chh), (0, 0, 0, 0))
        ImageDraw.Draw(probe).text((pad, pad), l, font=f, fill=WHITE)
        bb = probe.split()[3].getbbox()
        dx = pad + (cw - 2 * pad - lw) // 2 - (bb[0] - pad)
        dy = pad + i * step - (bb[1] - pad)
        d.text((dx, dy), l, font=f, fill=WHITE)
    ink = im.split()[3].getbbox()
    iw, ih = ink[2] - ink[0], ink[3] - ink[1]
    # The margin must be taken PER AXIS against that axis' own extent.  Using
    # the ink WIDTH for the vertical margin too (the previous behaviour) padded
    # a 1-line texture by 3.5% of a very long width, collapsing its aspect from
    # 7.10 to 5.08 -- which then broke the approved height band at occW 0.63.
    # A per-axis margin keeps texture aspect == ink aspect, so the texture and
    # the approved pixel measurement finally speak the same units.
    mx = int(round(iw * MARGIN))
    my = int(round(ih * MARGIN))
    im = im.crop((ink[0] - mx, ink[1] - my, ink[2] + mx, ink[3] + my))
    return im, gh, iw, mx


os.makedirs(OUT, exist_ok=True)
meta = {}
for act in sorted(SENTENCES):
    src, text = SENTENCES[act]
    lines = wrap(text)
    im, gh_draw, iw, m = render(lines)

    # block geometry in glyph-height units (what previz needs, not pixels)
    block_h_draw = gh_draw * (1 + (len(lines) - 1) * LEAD)
    glyph_share = gh_draw / float(block_h_draw)     # glyph_h / block_h

    tw = TARGET_W
    th = max(1, int(round(im.height * tw / im.width)))
    im = im.resize((tw, th), Image.LANCZOS)
    p = os.path.join(OUT, "%s.png" % act)
    im.save(p)

    ink_frac = iw / float(iw + 2 * m)               # ink share of texture width
    meta[act] = {
        "text": text,
        "source": src,
        "lines": lines,
        "n_lines": len(lines),
        "w": tw, "h": th,
        "aspect": round(tw / float(th), 5),         # texture aspect (= block)
        "ink_frac": round(ink_frac, 5),
        "glyph_share": round(glyph_share, 5),       # glyph_h / texture_h
        "chars": len(text.replace(" ", "")),
    }
    print("%s %d line(s)  %dx%d  aspect %6.3f  glyph_share %.3f  ink_frac %.3f  %s"
          % (act, len(lines), tw, th, tw / float(th), glyph_share, ink_frac,
             " / ".join(lines)))

mp = os.path.join(OUT, "meta.json")
json.dump(meta, open(mp, "w"), ensure_ascii=False, indent=1)
print("wrote", mp)

# ---- gate: a texture the previz cannot use must never reach a paid call ------
# Lesson 187: a gate downgraded to a warning lets the defect render anyway.
fail = []
for act, d in sorted(meta.items()):
    if d["w"] < 1280:
        fail.append("%s: width %d < 1280" % (act, d["w"]))
    if d["ink_frac"] < 0.85:
        fail.append("%s: ink_frac %.3f < 0.85" % (act, d["ink_frac"]))
    # the real acceptance test: does glyph_h/frame_h stay inside the CEO's
    # approved band across the whole allowed width occupancy?
    for occ in (OCC_MIN, OCC_MAX):
        h = occ * (FRAME_W / FRAME_H) / d["aspect"] * d["glyph_share"]
        if not (BAND_LO <= h <= BAND_HI):
            fail.append("%s: glyph_h/frame_h %.4f at occW %.2f outside approved "
                        "band %.4f..%.4f" % (act, h, occ, BAND_LO, BAND_HI))
    ink_px = OCC_MIN * FRAME_W * d["ink_frac"]
    if ink_px < MIN_INK_PX:
        fail.append("%s: ink %.0f px at occW %.2f < MIN_INK_PX %d"
                    % (act, ink_px, OCC_MIN, MIN_INK_PX))
if fail:
    raise SystemExit("WORD GATE FAILED\n  " + "\n  ".join(fail))

print("WORD GATE OK  textures %d  target_w %d" % (len(meta), TARGET_W))
print("  line ceiling %.2f  lead %.2f  band %.4f..%.4f over occW %.2f..%.2f"
      % (LINE_ASPECT_MAX, LEAD, BAND_LO, BAND_HI, OCC_MIN, OCC_MAX))
for act, d in sorted(meta.items()):
    h1 = OCC_MIN * (FRAME_W / FRAME_H) / d["aspect"] * d["glyph_share"]
    h2 = OCC_MAX * (FRAME_W / FRAME_H) / d["aspect"] * d["glyph_share"]
    print("  %-3s %d line(s)  h %.4f..%.4f  ink %4.0f px  %s"
          % (act, d["n_lines"], h1, h2, OCC_MIN * FRAME_W * d["ink_frac"],
             d["source"]))
