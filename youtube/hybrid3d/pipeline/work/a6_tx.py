#!/usr/bin/env python3
"""a6_tx.py -- build the A6 pilot ACT with narrative seams instead of hard cuts.

WHY THIS FILE EXISTS
--------------------
drive38.py renders every row and calls assemble.concat(), which is a hard cut.
Counted across the whole table that produced 79 hard cuts and four camera verbs,
and the CEO named the result exactly: "카메라를 앞으로 끌어 당겼다가 빼는 수준".

This script renders the SAME A6 rows from the SAME i2v clips, but joins them
with the four transition functions instead of concat(). Nothing about the source
footage changes, so the comparison isolates one variable: the seam.

The grammar and the focus point for each seam come from the design the V-1
GenTeam agent delivered (v1_a6_seam_design.md, billed at the 90% discount rate),
which in turn follows the S07 portal the CEO approved. The mapping below is the
only thing that is mine, because it is the part that has to agree with the
renderer's own arithmetic.

SEAM DURATION IS NOT A STYLE CHOICE
-----------------------------------
Each transition consumes `n` frames out of BOTH neighbours. A6-03 is 70 frames
and A6-04 is 72, so an 18-frame overlap is already a quarter of the shorter
clip; anything longer would eat the whole shot. So the overlap is derived from
the shorter neighbour rather than set to a fixed pretty number, and the total is
asserted against prev+cur-n at every step -- the narration track is locked to
500.010667s and a silently dropped frame per seam is 3.3s of drift by the end.
"""
import os, sys, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import assemble as A
import shots38 as S

SEG = "/home/user/lf/land38/seg"
WORK = "_a6tx"
OUT = "a6_pilot.mp4"
A.WORK = WORK

# seam -> (function, focus in half-frame units, requested overlap seconds)
#
# focus is where the shared shape sits in the OUTGOING frame. It is read off the
# design's "matching shape" note, not guessed: S01/S02 track the grey divider
# bars that sit low-centre on the desk, S03/S04 track the criterion cards which
# the design places centre-left then centre-right, S09 descends onto the report
# page which sits low-left, and S10 returns to the wide desk so its focus is
# near centre by definition.
SEAMS = {
    ("A6-01", "A6-02"): (A.through_page,          ( 0.00,  0.16), 0.75),
    ("A6-02", "A6-03"): (A.inset_descent,         ( 0.02,  0.10), 0.85),
    ("A6-03", "A6-04"): (A.zoom_match_dissolve,   (-0.14,  0.06), 0.75),
    ("A6-04", "A6-05"): (A.zoom_match_dissolve,   ( 0.16,  0.06), 0.75),
    ("A6-05", "A6-06"): (A.through_page,          ( 0.00,  0.12), 0.75),
    ("A6-06", "A6-07"): (A.inset_descent,         ( 0.10,  0.14), 0.85),
    ("A6-07", "A6-08"): (A.zoom_match_dissolve,   ( 0.04,  0.10), 0.85),
    ("A6-08", "A6-09"): (A.zoom_match_dissolve,   (-0.08,  0.12), 0.85),
    ("A6-09", "A6-10"): (A.through_page,          (-0.12,  0.14), 0.85),
    ("A6-10", "A6-11"): (A.portal_return,         ( 0.00,  0.04), 0.90),
}


def sids():
    return [r["sid"] for r in S.TABLE38
            if r["sid"].startswith("A6-") and r["sid"] != "A6-GAP"]


def main():
    os.makedirs(WORK, exist_ok=True)
    ids = sids()
    cur = os.path.join(SEG, "i2v_%s.mp4" % ids[0])
    total = A._fcount(cur)
    print("start %-7s %4df" % (ids[0], total), flush=True)

    for i in range(1, len(ids)):
        prev_sid, sid = ids[i - 1], ids[i]
        nxt = os.path.join(SEG, "i2v_%s.mp4" % sid)
        fn, focus, dur = SEAMS[(prev_sid, sid)]

        # Clamp the overlap so it can never exceed a third of the shorter
        # neighbour. Without this the short 70-frame shots would be consumed
        # entirely by their own seams and the ACT would lose its beats.
        shorter = min(A._fcount(cur), A._fcount(nxt))
        n = min(int(round(dur * A.FPS)), max(int(shorter // 3), 2))
        dur_eff = n / float(A.FPS)

        out = "%s/j%02d.mp4" % (WORK, i)
        before = A._fcount(cur) + A._fcount(nxt)
        kw = dict(dur=dur_eff, focus=focus)
        if fn is A.inset_descent:
            kw["r"] = 0.26
        got = fn(cur, nxt, out, **kw)
        exp = before - n
        flag = "OK" if got == exp else "MISMATCH"
        print("seam %-7s->%-7s %-20s n=%2d  %4df (exp %4df) %s"
              % (prev_sid, sid, fn.__name__, n, got, exp, flag), flush=True)
        if got != exp:
            raise SystemExit("seam arithmetic broke at %s->%s" % (prev_sid, sid))
        cur = out

    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", cur,
                    "-c", "copy", OUT], check=True)
    n = A._fcount(OUT)
    print("PILOT %s  %df  %.3fs" % (OUT, n, n / float(A.FPS)), flush=True)


if __name__ == "__main__":
    main()
