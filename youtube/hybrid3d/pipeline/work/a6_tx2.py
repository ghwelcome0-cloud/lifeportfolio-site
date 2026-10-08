#!/usr/bin/env python3
"""a6_tx2.py -- A6 pilot, rev.2. Fixes the two defects the CEO's viewing exposed.

DEFECT 1 (the one the CEO felt): "전환이 너무 빨라서 어지러운 면이 없지 않아 있어요.
후반부에는 천천히 전환되면서 영상 흐름이 잘 반영됐어요."

Measured, not guessed. The seam LENGTHS in rev.1 were near-uniform (18/20/22),
so the seam length was never the variable. What differed was
  (a) the still time BETWEEN seams -- front 2.79s vs back 4.48s, with A6-03/04/05
      three in a row under 2 seconds, and
  (b) the zoom velocity -- front 0.63/s vs back 0.47/s.
So the eye was asked to absorb a new transition before it had finished reading
the previous one. Industry practice agrees: a transition should run about half a
second, and you must "leave time for the images to be understood".

DEFECT 2 (the one nobody had seen yet, and the more dangerous one):
an overlapping transition takes n frames OUT OF THE SUM of its two neighbours
(total = prev + cur - n). Hard cuts took zero. So the moment rev.1 replaced 10
hard cuts with 10 overlaps, the ACT became sum(n) = 194 frames = 8.08s SHORTER
than the script demands, and the narration ran ahead of the picture by up to
5.27s in the back half. rev.1 only *looked* aligned because the review burn-in
drew each cut's own line on its own frames.

THE FIX FOR BOTH IS THE SAME ONE
--------------------------------
Do not pay for the seam out of the narration's time. Pay for it by retiming the
source clip. Each cut is given

    L_i = narr_i + (n_left + n_right) / 2

frames of source, so the seam window straddles the dialogue boundary instead of
eating into one side of it, and

    sum(L) - sum(n) = sum(narr)

closes exactly. The retime factors land between 0.91 and 1.13, i.e. the camera
moves about a tenth slower -- which is also, by itself, part of the cure for
defect 1.

PACING RULES APPLIED (R1..R5, to become Article 14 clause 10)
    R1  (zoom - 1.0) / (n/24) <= 0.35 per second
    R2  stable body = narr_i - (n_left + n_right)/2 >= 29 frames (1.20s)
    R3  a short neighbour forces a short seam (n = 14) and a gentle zoom
    R4  consecutive seams must not zigzag hard in focus sign
    R5  a strong grammar keeps its grammar but its zoom still obeys R1
"""
import os, sys, subprocess

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import assemble as A
import shots38 as S

SEG = "/home/user/lf/land38/seg"
WORK = "_a6tx2"
OUT = "a6_pilot_v2.mp4"
A.WORK = WORK
T0 = 353.50
FPS = 24.0
RETIME_CAP = 1.25          # Article 14 clause 11

# seam -> (function, focus, n frames, extra kwargs)
#
# n comes from the SHORTER neighbour: under 100 narration frames -> 14, else 20.
# The zooms are then the R1 ceiling for that n, floored by R3 for short cuts.
# S03/S04 focus magnitudes are pulled in from -0.14/+0.16 to -0.10/+0.10: the
# two criterion cards genuinely sit on opposite sides of the page, so the sign
# flip is content and cannot be removed, but R4 says do not let it whip.
SEAMS = {
    ("A6-01", "A6-02"): (A.through_page,        ( 0.00,  0.16), 14, {"zoom": 1.20}),
    ("A6-02", "A6-03"): (A.inset_descent,       ( 0.02,  0.10), 14, {"r": 0.26}),
    ("A6-03", "A6-04"): (A.zoom_match_dissolve, (-0.10,  0.06), 14, {"zoom": 1.15}),
    ("A6-04", "A6-05"): (A.zoom_match_dissolve, ( 0.10,  0.06), 14, {"zoom": 1.15}),
    ("A6-05", "A6-06"): (A.through_page,        ( 0.00,  0.12), 14, {"zoom": 1.20}),
    ("A6-06", "A6-07"): (A.inset_descent,       ( 0.10,  0.14), 20, {"r": 0.26}),
    ("A6-07", "A6-08"): (A.zoom_match_dissolve, ( 0.04,  0.10), 14, {"zoom": 1.15}),
    ("A6-08", "A6-09"): (A.zoom_match_dissolve, (-0.08,  0.12), 14, {"zoom": 1.15}),
    ("A6-09", "A6-10"): (A.through_page,        (-0.12,  0.14), 20, {"zoom": 1.28}),
    ("A6-10", "A6-11"): (A.portal_return,       ( 0.00,  0.04), 20, {"zoom": 1.28}),
}


def rows():
    return [r for r in S.TABLE38
            if r["sid"].startswith("A6-") and r["sid"] != "A6-GAP"]


def narr_frames(rs):
    """Narration frames per cut, taken from absolute cue boundaries so the
    per-cut roundings cannot accumulate."""
    b = [int(round((r["t0"] - T0) * FPS)) for r in rs]
    b.append(int(round((rs[-1]["t1"] - T0) * FPS)))
    return [b[i + 1] - b[i] for i in range(len(rs))], b


def retime(src, dst, want):
    have = A._fcount(src)
    k = want / float(have)
    if k > RETIME_CAP or k < 1.0 / RETIME_CAP:
        raise SystemExit("retime factor %.3f exceeds the 1.25 cap for %s"
                         % (k, os.path.basename(src)))
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src,
                    "-vf", "setpts=PTS*%.9f,fps=%d" % (k, int(FPS)),
                    "-c:v", "libx264", "-crf", "16", "-preset", "medium",
                    "-pix_fmt", "yuv420p", "-frames:v", str(want),
                    "-an", dst], check=True)
    got = A._fcount(dst)
    if got != want:
        raise SystemExit("retime %s produced %df, wanted %df"
                         % (os.path.basename(src), got, want))
    return k


def main():
    os.makedirs(WORK, exist_ok=True)
    rs = rows()
    ids = [r["sid"] for r in rs]
    nf, bounds = narr_frames(rs)
    target_total = bounds[-1]

    # seam frames, indexed so n[i] is the seam AFTER cut i
    n_after = [SEAMS[(ids[i], ids[i + 1])][2] for i in range(len(ids) - 1)] + [0]
    n_before = [0] + n_after[:-1]

    print("A6 rev.2 budget  (narration target %df = %.3fs)"
          % (target_total, target_total / FPS), flush=True)
    print("sid     narr  nL  nR   L   seg   k      stable  ok", flush=True)
    L = []
    for i, sid in enumerate(ids):
        half = (n_before[i] + n_after[i]) / 2.0
        Li = int(round(nf[i] + half))
        L.append(Li)
        stable = nf[i] - half
        seg = A._fcount(os.path.join(SEG, "i2v_%s.mp4" % sid))
        print("%-7s %4d %3d %3d %4d %4d  %.3f  %5.1ff %s"
              % (sid, nf[i], n_before[i], n_after[i], Li, seg, Li / float(seg),
                 stable, "OK" if stable >= 29 else "R2-FAIL"), flush=True)
        if stable < 29:
            raise SystemExit("R2 violated at %s (%.1ff stable)" % (sid, stable))

    closes = sum(L) - sum(n_after)
    print("sum(L) %d - sum(n) %d = %d   target %d   %s"
          % (sum(L), sum(n_after), closes, target_total,
             "CLOSES" if closes == target_total else "OFF BY %d"
             % (closes - target_total)), flush=True)

    # R1 check, stated so a reader can audit it
    for (a, b), (fn, foc, n, kw) in SEAMS.items():
        z = kw.get("zoom")
        if z:
            v = (z - 1.0) / (n / FPS)
            print("R1 %s->%s  n=%2d zoom=%.2f  %.3f/s %s"
                  % (a, b, n, z, v, "OK" if v <= 0.351 else "TOO FAST"),
                  flush=True)
            if v > 0.351:
                raise SystemExit("R1 violated at %s->%s" % (a, b))

    # ---- retime pass -------------------------------------------------------
    src = []
    for i, sid in enumerate(ids):
        d = "%s/rt_%s.mp4" % (WORK, sid)
        k = retime(os.path.join(SEG, "i2v_%s.mp4" % sid), d, L[i])
        print("retime %-7s k=%.3f -> %df" % (sid, k, L[i]), flush=True)
        src.append(d)

    # ---- seam pass ---------------------------------------------------------
    cur = src[0]
    total = A._fcount(cur)
    print("start %-7s %4df" % (ids[0], total), flush=True)
    for i in range(1, len(ids)):
        fn, focus, n, kw = SEAMS[(ids[i - 1], ids[i])]
        before = A._fcount(cur) + A._fcount(src[i])
        out = "%s/j%02d.mp4" % (WORK, i)
        got = fn(cur, src[i], out, dur=n / FPS, focus=focus, **kw)
        exp = before - n
        ok = "OK" if got == exp else "MISMATCH"
        print("seam %-7s->%-7s %-20s n=%2d  %4df (exp %4df) %s"
              % (ids[i - 1], ids[i], fn.__name__, n, got, exp, ok), flush=True)
        if got != exp:
            raise SystemExit("seam arithmetic broke at %s" % ids[i])
        cur = out

    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", cur,
                    "-c", "copy", OUT], check=True)
    f = A._fcount(OUT)
    print("PILOT2 %s  %df  %.3fs   target %df  diff %+df (%.3fs)"
          % (OUT, f, f / FPS, target_total, f - target_total,
             (f - target_total) / FPS), flush=True)


if __name__ == "__main__":
    main()
