#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
lightbox.py -- put the CEO-approved neon caption onto a finished v2v clip by
tracking the previz's own red glyph.

THE PROBLEM THIS SOLVES
-----------------------
Five times now the lettering has been rejected on visual grade, not spelling:
CEO-16 "글자 퀄리티는 따로 놀아요. 저급이에요", CEO-18, CEO-57, CEO-58, and
finally CEO-64 on the v2v pilot:

    "모션의 움직임이나 이미지의 퀄리티는 너무 좋은데, '방식'이라는 글자도
     정확하지만 글자 자체가 우리 예전에 이미지에 걸맞는 퀄리티는 아니지 않아요?"

Every one of those five has the same root cause: we asked a generative video
model to draw Korean type. It can get the spelling right -- the pilot did --
but it cannot hold typographic grade, because it is painting glyph-shaped
pixels rather than setting type.

CEO-65 then handed over the answer as three approved stills. Measured, they are
not printed ink at all; they are a designed lightbox: dark translucent panel,
cyan neon rim with real spill, heavy white Hangul. That is a graphic we can
draw ourselves with a real font -- so the model never draws Korean again, and
the entire class of defect disappears rather than being argued down.

HOW THE PANEL KNOWS WHERE TO GO
-------------------------------
CEO-51 was explicit that the words must MOVE -- rise off the documents and
converge. A caption pinned to a fixed screen position would throw that away.

The previz already contains the exact motion: it renders the word as clean red
ink on the paper, animated by the 3D camera. So the previz is used as a motion
track. Per frame we measure the red ink's centroid and extent, and place the
panel there. The panel therefore inherits the 3D camera's real parallax and the
lift/converge choreography, while the lettering itself is our own crisp type.

The previz is the tracking source, never the v2v output: previz red is a flat
synthetic colour on a grey plate and segments almost perfectly, whereas the
v2v red is photographic and bleeds into the wood tones. Measured on the pilot,
tracking the v2v output gave a bbox spanning 99.7% of frame width -- it was
locking onto warm desk pixels, not the word. The previz track is clean.

WHAT IS DELIBERATELY NOT DONE HERE
----------------------------------
No previz re-render. The 60-job previz batch cost 2208.7 minutes of CPU
(36.8 h) on this 2-core box, so anything that requires re-rendering the previz
cannot be iterated on before a deadline. This stage is pure compositing: it
costs no credits, runs in minutes, and can be revised as many times as the CEO
needs.
"""
import os
import sys
import json
import math
import subprocess
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import neon

R3D = os.path.dirname(os.path.abspath(__file__))
JOBS = os.path.join(R3D, "jobs.json")
FPS = 24

# Red-ink segmentation.
#
# The first thresholds tried here were RED_MIN=105, RED_DOM=42, copied from the
# quick probe used on the v2v output. On the previz they were badly wrong:
# the tracked bbox came back 0.997 of frame width, because the previz plate has
# a warm brown back wall whose pixels also satisfy "red dominates green and
# blue by 42". Rendering the mask and looking at it (rather than trusting the
# numbers) showed the wall filling the top-left of the mask.
#
# The previz ink is a pure saturated red placed on flat grey/teal/magenta
# placeholder surfaces, so the correct thresholds are far stricter. With these,
# the same frame gives a bbox 0.280 wide containing exactly the three 「방식」
# copies and nothing else. This is why the loose numbers are recorded here
# instead of being quietly deleted: they look reasonable and they are wrong.
RED_MIN = 150
RED_DOM = 90

# Panel geometry relative to the tracked ink. The panel must COVER the red ink
# (that is the point -- the low-grade lettering must not peek out), so it is
# grown past the ink bbox on both axes.
PAD_W = 1.30
PAD_H = 1.55

# Temporal smoothing. A per-frame centroid jitters by a pixel or two because
# the ink is antialiased; without smoothing the panel buzzes. A 9-frame
# (0.375 s) moving average is short enough to keep the lift/converge motion
# and long enough to kill the buzz.
SMOOTH = 9

# Screen-space clamp: the panel must stay fully on screen no matter where the
# ink goes, otherwise a rising word walks the caption off the top edge.
EDGE = 0.02

# ---- erasing the v2v's own lettering -------------------------------------
# The first composite of the pilot looked right in isolation but failed on
# inspection: the v2v's red 「방식」 was still visible, both THROUGH the panel
# (FILL_A is 205, translucent, exactly as the approved stills are) and BESIDE
# it, because the generated word does not land pixel-for-pixel where the previz
# word was -- v2v follows the previz motion but re-paints the content.
#
# Covering it with a bigger, more opaque panel was rejected: that breaks the
# approved look, which is translucent, and it still cannot cover ink the track
# does not predict. The ink is therefore REMOVED from the plate first, so the
# panel lands on clean paper.
#
# The first attempt loosened these to 96/26 on the reasoning that photographic
# red has soft warm edges. Measured on the pilot that flagged 191,204 px with a
# bbox spanning 99.9% of frame width: the warm wooden desk and the sunlit paper
# both satisfy it, and the "erase" was destroying the whole plate. Lesson 185
# again -- a plausible threshold is the dangerous kind, and the way to catch it
# is to measure the bbox rather than trust the intent.
#
# Swept on frame 41 of the pilot:
#     96/26 -> 191,204 px  w/W 0.999   (desk + paper)
#    120/45 ->  62,946 px  w/W 0.951   (still the desk)
#    140/60 ->  17,310 px  w/W 0.774   (desk highlights)
#    150/75 ->   2,733 px  w/W 0.149   <- exactly the red word
#
# 150/75 is therefore the core detector; the soft glyph edge is recovered by
# dilating that core, which cannot run away into the desk because the core does
# not touch it.
ERASE_MIN = 150
ERASE_DOM = 75
ERASE_GROW = 6     # dilation iterations: recovers the soft glyph edge
ERASE_PASS = 8     # diffusion passes
ERASE_BLUR = 5.0   # gaussian sigma per pass


def erase_ink(im):
    """Inpaint the red lettering out of one v2v frame.

    The first implementation blurred the WHOLE image each pass and copied the
    blur into the masked region. Inspected at 2x it left an obvious pink
    smudge, and the reason is arithmetic, not tuning: the red pixels are inside
    the blur kernel, so each pass feeds the red back into itself. No number of
    passes removes a colour that is its own source.

    The fix is a normalised convolution -- blur (image * outside_mask) and blur
    (outside_mask), then divide. Every value written into the hole is a weighted
    average of KNOWN pixels only, so the red cannot contribute at all. Repeating
    it lets the paper tone march inward from the boundary.
    """
    from scipy import ndimage
    a = np.asarray(im.convert("RGB")).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    m = (r > ERASE_MIN) & (r > g + ERASE_DOM) & (r > b + ERASE_DOM)
    if not m.any():
        return im, 0
    m = ndimage.binary_dilation(m, structure=np.ones((3, 3)),
                                iterations=ERASE_GROW)
    n = int(m.sum())
    keep = (~m).astype(np.float32)
    # Pass 1: normalised convolution from KNOWN pixels only. This is the pass
    # that actually removes the colour, and its sigma has to be wide enough to
    # reach across the widest stroke -- a narrow kernel leaves the stroke
    # centres unfilled (wsum ~ 0) and they come back as grey worms.
    wsum = ndimage.gaussian_filter(keep, ERASE_BLUR * 3.0)
    wsum[wsum < 1e-6] = 1e-6
    for c in range(3):
        num = ndimage.gaussian_filter(a[..., c] * keep, ERASE_BLUR * 3.0)
        a[..., c][m] = (num / wsum)[m]
    # Remaining passes: plain smoothing inside the hole, now that nothing in it
    # is red, to blend the fill into the surrounding paper grain.
    for _ in range(ERASE_PASS - 1):
        for c in range(3):
            a[..., c][m] = ndimage.gaussian_filter(a[..., c], ERASE_BLUR)[m]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)), n


def _jobs():
    with open(JOBS, encoding="utf-8") as fh:
        return json.load(fh)["jobs"]


def job_by_id(jid):
    for j in _jobs():
        if j["job_id"] == jid:
            return j
    raise SystemExit("no such job: " + jid)


def _blobs(m, k, min_px=30):
    """Locate the k ink copies as 2D connected components.

    Row-banding was tried first and abandoned on measurement. It cannot work
    for this footage: during a converge the three copies pass through a phase
    where they sit side by side at similar heights, so no horizontal cut
    separates them, and the per-frame count came back as an unusable mix of
    1, 2 and 3 (measured on J_A3-07 at both 320x180 and 640x360).

    Connected components solve it directly. A binary dilation welds the strokes
    of one syllable block into one component -- without it, the internal gap of
    「ㅂ」 or 「식」 splits a single word into several -- while the space between
    two copies stays wide enough to keep them apart.

    The expected count k is NOT inferred from the pixels. jobs.json already
    records word_gesture for every job ('converge' carries three copies, 'lift'
    one, 'none' none), so the count is read from the plan and the pixels are
    only asked WHERE. Inferring a number that is already known is how a shot
    ends up with two captions in a three-copy convergence.
    """
    if not m.any():
        return []
    from scipy import ndimage
    d = ndimage.binary_dilation(m, structure=np.ones((5, 5)), iterations=2)
    lab, n = ndimage.label(d)
    cand = []
    for i in range(1, n + 1):
        sel = (lab == i) & m
        cnt = int(sel.sum())
        if cnt < min_px:
            continue
        ys, xs = np.nonzero(sel)
        cand.append((cnt, xs, ys))
    # Keep the k largest. Measured on J_A3-07 the blob count is exactly 3 in
    # 133 of 144 frames, 4 in five frames (a stray highlight) and fewer in six;
    # taking the largest k discards the strays without discarding a real copy.
    cand.sort(key=lambda c: -c[0])
    cand = cand[:k] if k else cand
    return [(c[1], c[2]) for c in cand]


def _bands(m, gap=6, min_px=40):
    """Split a mask into horizontal bands of ink, top to bottom.

    A converge shot carries THREE copies of the word on three documents, and
    CEO-51 asked for exactly that motion -- "세 프로젝트 문서에서 같은 역할
    단어만 붉게 떠올라 한 곳으로 모이는 것". Collapsing them to a single
    centroid would replace three converging captions with one static one and
    throw the shot's point away. The copies separate vertically, so the split
    is by row.

    Splitting on the raw mask does not work. Measured on J_A3-07, the per-frame
    band count came back as a mix of 1, 2, 3 and even 4 -- because a Hangul
    syllable has internal horizontal gaps (the space under 「ㅂ」, the gap
    inside 「식」), and each of those reads as a band boundary. The mask is
    therefore closed vertically first: a rolling OR over CLOSE rows welds the
    strokes of one word into a single blob while leaving the much larger gaps
    BETWEEN copies intact.
    """
    CLOSE = 5
    if not m.any():
        return []
    rowfull = m.any(axis=1)
    # vertical closing on the row-occupancy signal
    n = len(rowfull)
    closed = rowfull.copy()
    for d in range(1, CLOSE + 1):
        closed[:n - d] |= rowfull[d:]
        closed[d:] |= rowfull[:n - d]
    rows = np.nonzero(closed)[0]
    cuts = [0] + list(np.nonzero(np.diff(rows) > gap)[0] + 1) + [len(rows)]
    out = []
    for a, b in zip(cuts, cuts[1:]):
        rr = rows[a:b]
        sub = m[rr.min():rr.max() + 1]
        ys, xs = np.nonzero(sub)
        if len(xs) < min_px:
            continue
        out.append((xs, ys + rr.min()))
    return out


GESTURE_COPIES = {"converge": 3, "lift": 1, "none": 0}


def track_v2v(v2v, k=1, w=480, h=270):
    """Track the red lettering in the FINISHED v2v clip, not the previz.

    The previz track was the original design and it is measurably wrong for
    placement. Measured on the pilot: the panels placed from the previz track
    covered 0.0% of the v2v's own red pixels in seven of eight sampled frames.
    The generator follows the previz camera and choreography faithfully -- that
    is why the motion was approved -- but it re-paints the word wherever its own
    understanding of the paper puts it, typically a long way off.

    Since the whole purpose of the panel is to REPLACE that lettering, the panel
    has to go where the lettering actually is. So the v2v is the tracking
    source, and the previz is used only for what it is reliable for: telling us
    how many copies to expect (via jobs.json) and providing the fallback if a
    frame's ink is momentarily invisible.

    The strict-red thresholds that failed on the previz plate work here, because
    ERASE_MIN/ERASE_DOM were swept against exactly this footage.
    """
    tmp = "/tmp/_lbv2v"
    os.makedirs(tmp, exist_ok=True)
    for f in os.listdir(tmp):
        os.remove(os.path.join(tmp, f))
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", v2v,
                    "-vf", "scale=%d:%d" % (w, h),
                    os.path.join(tmp, "%05d.png")], check=True)
    out = []
    for fn in sorted(os.listdir(tmp)):
        a = np.asarray(Image.open(os.path.join(tmp, fn)).convert("RGB")).astype(np.int16)
        r, g, b = a[..., 0], a[..., 1], a[..., 2]
        m = (r > ERASE_MIN) & (r > g + ERASE_DOM) & (r > b + ERASE_DOM)
        cl = []
        for xs, ys in _blobs(m, k, min_px=12):
            cl.append((float(xs.mean()) / w, float(ys.mean()) / h,
                       float(xs.max() - xs.min()) / w,
                       float(ys.max() - ys.min()) / h))
        out.append(cl)
    return out


def track(previz, k=1, w=480, h=270):
    """Per-frame list of ink copies, each (cx, cy, bw, bh) in 0..1 frame
    fractions, ordered top to bottom. An empty list means no ink in that frame,
    which is legitimate at the very start of a lift before the word rises."""
    tmp = "/tmp/_lbtrk"
    os.makedirs(tmp, exist_ok=True)
    for f in os.listdir(tmp):
        os.remove(os.path.join(tmp, f))
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", previz,
                    "-vf", "scale=%d:%d" % (w, h),
                    os.path.join(tmp, "%05d.png")], check=True)
    out = []
    for fn in sorted(os.listdir(tmp)):
        a = np.asarray(Image.open(os.path.join(tmp, fn)).convert("RGB")).astype(np.int16)
        r, g, b = a[..., 0], a[..., 1], a[..., 2]
        m = (r > RED_MIN) & (r > g + RED_DOM) & (r > b + RED_DOM)
        cl = []
        for xs, ys in _blobs(m, k):
            cl.append((float(xs.mean()) / w, float(ys.mean()) / h,
                       float(xs.max() - xs.min()) / w,
                       float(ys.max() - ys.min()) / h))
        out.append(cl)
    return out


def lanes(tr, k):
    """Reshape the per-frame detections into k continuous lanes by nearest
    neighbour, not by vertical order.

    Sorting the detections top-to-bottom each frame was tried and is wrong.
    During a converge the three copies cross each other, so the topmost blob is
    a different physical word before and after the crossing; the lanes swap
    identity mid-shot, and a caption teleports across the frame. Measured on
    J_A3-07 the top lane jumped cx 0.730 -> 0.325 in 48 frames -- a caption
    flying sideways, which would look like a glitch, not choreography.

    So each lane is assigned the detection closest to where that lane was in
    the previous frame (greedy, nearest first). Frames with fewer than k
    detections leave the unmatched lanes on their last known position, and
    frames before the first detection are back-filled afterwards.
    """
    out = [[None] * len(tr) for _ in range(k)]
    last = [None] * k
    for i, f in enumerate(tr):
        free = list(range(len(f)))
        if last[0] is None:
            # first frame with detections: seed lanes top to bottom so lane 0
            # is the highest word for the whole shot
            order = sorted(free, key=lambda q: f[q][1])
            for j in range(min(k, len(order))):
                out[j][i] = last[j] = f[order[j]]
            continue
        pairs = []
        for j in range(k):
            if last[j] is None:
                continue
            for q in free:
                d = math.hypot(f[q][0] - last[j][0], f[q][1] - last[j][1])
                pairs.append((d, j, q))
        pairs.sort()
        usedj, usedq = set(), set()
        for d, j, q in pairs:
            if j in usedj or q in usedq:
                continue
            usedj.add(j)
            usedq.add(q)
            out[j][i] = last[j] = f[q]
        for j in range(k):
            if j not in usedj:
                out[j][i] = last[j]
    # back-fill any leading gap with the first known sample per lane
    for j in range(k):
        first = next((c for c in out[j] if c), None)
        for i in range(len(out[j])):
            if out[j][i] is None:
                out[j][i] = first
            else:
                break
    return out


def smooth(lane, k=SMOOTH):
    """Moving average over the present samples, holding across gaps."""
    n = len(lane)
    out = [None] * n
    for i in range(n):
        if lane[i] is None:
            continue
        lo, hi = max(0, i - k // 2), min(n, i + k // 2 + 1)
        win = [t for t in lane[lo:hi] if t is not None]
        out[i] = tuple(sum(v[j] for v in win) / len(win) for j in range(4))
    return out


# The glyph height band measured off the three approved stills, as a fraction
# of frame height: std1 0.089, std2 0.139, std3 0.189. This is the one number
# the eye actually grades, so it is the number that gets clamped -- the panel
# then follows from it rather than the other way round.
GLYPH_BAND = (0.085, 0.20)


def plan(previz, gesture, text, res=(1280, 720)):
    """Everything the compositor needs, measured, before any pixel is written.

    `gesture` comes from jobs.json, not from the pixels. See _blobs().
    """
    k = GESTURE_COPIES[gesture]
    if k == 0:
        return 0, [], None
    raw = track(previz, k=k)
    ln = [smooth(l) for l in lanes(raw, k)]
    import statistics as st
    allc = [c for l in ln for c in l if c]
    if not allc:
        return 0, [], None
    ink_w = st.median([c[2] for c in allc]) * PAD_W
    ink_h = st.median([c[3] for c in allc]) * PAD_H

    # Height first. The panel has to cover the previz ink (otherwise the
    # low-grade lettering peeks out from behind the caption), but it also has to
    # keep its glyphs inside the approved band -- a panel sized purely to the
    # ink would put 「방식」 at whatever height the 3D camera happened to give
    # it, which is how we ended up arguing about grade in the first place.
    h = min(max(ink_h, GLYPH_BAND[0] / neon.GLYPH_FRAC),
            GLYPH_BAND[1] / neon.GLYPH_FRAC)
    if k > 1:
        h = min(h, 0.92 / k)      # k stacked panels must fit the frame height

    # Width follows the text at that height, then is widened if the ink is wider
    # than the type. W_MIN is deliberately NOT applied: it was measured on
    # 8- and 16-glyph sentences, and forcing a two-glyph word to 0.42 of frame
    # width produces an empty box, which reads as a template, not a design.
    w = min(neon.W_MAX, max(neon.fit_w(text, res[0], res[1], h), ink_w))
    return k, ln, (w, h)


def render(previz, v2v, text, out, gesture, dry=False):
    """Composite the neon caption onto `v2v`, driven by `previz` motion."""
    k, ln, size = plan(previz, gesture, text)
    if k == 0:
        raise SystemExit("no red ink in previz -- this is a 'none' shot, "
                         "which correctly carries no caption")
    w_frac, h_frac = size
    print("copies=%d  panel w_frac=%.3f h_frac=%.3f  track frames=%d"
          % (k, w_frac, h_frac, len(ln[0])))
    for j in range(k):
        a = next(c for c in ln[j] if c)
        b = next(c for c in reversed(ln[j]) if c)
        print("  lane %d: cy %.3f -> %.3f   cx %.3f -> %.3f"
              % (j, a[1], b[1], a[0], b[0]))
    if dry:
        return

    frames = "/tmp/_lbsrc"
    os.makedirs(frames, exist_ok=True)
    for f in os.listdir(frames):
        os.remove(os.path.join(frames, f))
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", v2v,
                    os.path.join(frames, "%05d.png")], check=True)
    src = sorted(os.listdir(frames))

    # The previz and the v2v clip are the same shot, but the generator may
    # return one extra or one fewer frame (the pilot came back 145 for a
    # 144-frame previz). The track is resampled onto the v2v frame count rather
    # than assumed to match -- assuming is how a shot ends up a frame short and
    # the 12000-frame master lands off grid.
    N, M = len(src), len(ln[0])
    print("track %d frames, v2v %d frames" % (M, N))

    dst = "/tmp/_lbout"
    os.makedirs(dst, exist_ok=True)
    for f in os.listdir(dst):
        os.remove(os.path.join(dst, f))

    hw, hh = w_frac / 2.0, h_frac / 2.0
    erased = 0
    for i, fn in enumerate(src):
        t = min(M - 1, int(round(i * (M - 1) / max(1, N - 1))))
        im = Image.open(os.path.join(frames, fn)).convert("RGB")
        im, ne = erase_ink(im)
        erased += ne
        for j in range(k):
            c = ln[j][t] or next(x for x in ln[j] if x)
            cx = min(1.0 - hw - EDGE, max(hw + EDGE, c[0]))
            cy = min(1.0 - hh - EDGE, max(hh + EDGE, c[1]))
            im = neon.place(im, text, cx, cy, w_frac, h_frac)
        im.save(os.path.join(dst, fn))
        if i % 24 == 0:
            print("  %4d/%d  erased %d px" % (i, N, erased))
    print("erase total %d px, mean %.0f px/frame" % (erased, erased / max(1, N)))

    subprocess.run(["ffmpeg", "-y", "-v", "error", "-framerate", str(FPS),
                    "-i", os.path.join(dst, "%05d.png"),
                    "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p",
                    "-r", str(FPS), out], check=True)
    n = subprocess.run(["ffprobe", "-v", "error", "-count_frames",
                        "-select_streams", "v:0", "-show_entries",
                        "stream=nb_read_frames", "-of", "csv=p=0", out],
                       capture_output=True, text=True).stdout.strip()
    if int(n) != N:
        raise SystemExit("LIGHTBOX GATE FAILED: wrote %s frames, input had %d"
                         % (n, N))
    print("LIGHTBOX OK  %s  %s frames" % (out, n))


WORDS = os.path.join(R3D, "words", "meta.json")


def word_of(act):
    """The caption text for an act, taken from the same table the previz ink
    was rendered from, so the panel can never disagree with the plate."""
    with open(WORDS, encoding="utf-8") as fh:
        return json.load(fh)[act]["word"]


def resolve(jid):
    """(previz path, v2v-less job record, gesture, text) for a job id.

    Everything is read from the plan. Passing the gesture or the word on the
    command line would let a typo put 「변화」 on an A3 shot, and nothing
    downstream would catch it.
    """
    j = job_by_id(jid)
    previz = os.path.join(R3D, "_batch", jid + ".mp4")
    if not os.path.exists(previz):
        raise SystemExit("previz missing: " + previz)
    return previz, j, j["word_gesture"], word_of(j["act"])


if __name__ == "__main__":
    if sys.argv[1] == "track":
        previz, j, gest, text = resolve(sys.argv[2])
        print("%s  act=%s  gesture=%s  text=%s  frames=%d"
              % (j["job_id"], j["act"], gest, text, j["frames"]))
        k, ln, size = plan(previz, gest, text)
        if k == 0:
            print("copies 0 -- 'none' shot, no caption by design")
            sys.exit(0)
        print("copies %d  panel w_frac=%.3f h_frac=%.3f  glyph_h/H=%.3f"
              % (k, size[0], size[1], size[1] * neon.GLYPH_FRAC))
        for j2 in range(k):
            for i in range(0, len(ln[j2]), 16):
                c = ln[j2][i]
                print(" lane%d f%3d %s" % (j2, i, "-" if not c else
                      "cx=%.3f cy=%.3f bw=%.3f bh=%.3f" % c))
        for j2 in range(k):
            a = next(c for c in ln[j2] if c)
            b = next(c for c in reversed(ln[j2]) if c)
            print(" lane%d  cy %.3f -> %.3f   cx %.3f -> %.3f  (dy=%+.3f)"
                  % (j2, a[1], b[1], a[0], b[0], b[1] - a[1]))
    elif sys.argv[1] == "render":
        # lightbox.py render <job_id> <v2v.mp4> <out.mp4> [--dry]
        previz, j, gest, text = resolve(sys.argv[2])
        render(previz, sys.argv[3], text, sys.argv[4], gest,
               dry=("--dry" in sys.argv))
