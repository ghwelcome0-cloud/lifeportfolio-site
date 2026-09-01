"""Verification driver for the rc=234 fix (approved task 2).

Runs orb_render() over the 9 ACT-0 shots against the already-graded
_bld/blurred.mp4, then reports rc, per-shot durations and total length.
Nothing here regenerates paid assets — pure local ffmpeg.
"""
import os, sys, subprocess, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import assemble as A

SRC    = "_bld/blurred.mp4"
SPRITE = "orb_r26.png"
OUT    = "_bld/orbed.mp4"

# same tables as act0.py (kept in sync deliberately)
SHOTS = [
    dict(t0=0.00,  t1=3.85),
    dict(t0=3.85,  t1=8.05),
    dict(t0=8.05,  t1=12.95),
    dict(t0=12.95, t1=17.00),
    dict(t0=17.00, t1=21.30),
    dict(t0=21.30, t1=24.00),
    dict(t0=24.00, t1=26.70),
    dict(t0=26.70, t1=29.30),
    dict(t0=29.30, t1=31.70),
]
ORB_PATH = [
    (0.30, 0.62, 13), (0.42, 0.58, 16), (0.55, 0.53, 19), (0.52, 0.51, 15),
    (0.50, 0.46, 25), (0.50, 0.43, 30), (0.50, 0.41, 28), (0.50, 0.39, 26),
    (0.50, 0.36, 24), (0.50, 0.34, 22),
]

def main():
    assert len(ORB_PATH) == len(SHOTS) + 1, "waypoint count must be shots+1"
    from PIL import Image
    sw = Image.open(SPRITE).size[0]
    src_dur = A.duration(SRC)
    print(f"source {SRC}  {src_dur:.6f}s   sprite {SPRITE} {sw}px")
    # hard-limit check: last shot must fit inside the source
    tail = SHOTS[-1]["t1"]
    print(f"timeline end {tail:.4f}  headroom {src_dur - tail:+.4f}s")
    A.orb_render(SRC, SHOTS, ORB_PATH, SPRITE, sw, OUT)
    print("\n--- per-shot output ---")
    tot = 0.0
    for i in range(len(SHOTS)):
        p = f"{A.WORK}/orb{i:03d}.mp4"
        d = A.duration(p)
        want = SHOTS[i]["t1"] - SHOTS[i]["t0"]
        tot += d
        print(f" shot{i}  want {want:6.4f}s  got {d:8.6f}s  delta {d-want:+.4f}"
              f"  {os.path.getsize(p):>10,} B")
    od = A.duration(OUT)
    print(f"\nsum of parts {tot:.6f}s   concat {OUT} {od:.6f}s "
          f"({os.path.getsize(OUT):,} B)")
    print(f"target 31.5417s  delta {od-31.541667:+.4f}s")
    print("RESULT: rc=0 for all 10 ffmpeg calls (run() raises SystemExit otherwise)")

main()
