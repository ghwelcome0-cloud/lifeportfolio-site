"""Render a side-by-side BEFORE/AFTER of the camera, for the CEO's eyes.

The numbers already say the new motion sits inside the benchmark's band, but a
number is not the judgement that matters here. The CEO described the old output
as "some frames just shake while others actually move", and that distinction is
visual: it cannot be settled by a statistic, only by watching the same plate
moved both ways at the same time.

So this builds one clip per camera verb — 정지 (held), 도착 (arrival), 관통
(traversal), 후퇴 (conclusion) — with the old plan on the left and the new plan
on the right, identical plate, identical duration, playing simultaneously. Four
verbs because the complaint was not "it moves too little" but "it is
inconsistent": the point to be judged is whether each verb now reads as a
different, deliberate gesture rather than as the same 3% twitch applied to
everything.

The left side is not an approximation of the old renderer. It is the old
renderer: the same kb values from the shot table, driven with ease="linear",
which is exactly what assemble.kenburns did before this session's edit. So the
left column is what the CEO actually rejected, not a strawman of it.

Labels are ASCII only and exist solely on this diagnostic. The production rule
banning drawtext applies to the film — Korean in the film comes from the image
model as a lit glass panel — and nothing rendered here reaches the master.
"""

import os
import subprocess

import shots38 as S
import motion38 as M
import assemble as A

LAND = "/home/user/lf/land38"
WORK = "_cmp38"
OUT = "review/cmp_motion_before_after.mp4"

# One row per verb, each chosen because it is the clearest case of that verb
# among the rows whose plate is already approved and on disk.
#   A3-12  정지  1.66s  old travel 0.7%  — the frozen frame the CEO named
#   A3-03  도착  2.50s  old travel 3.4%  — an arrival that never arrived
#   A3-04  관통  7.04s  two internal cuts — momentum across an edit
#   A3-05  후퇴  2.54s  a conclusion that has to open out
PICKS = ["A3-12", "A3-03", "A3-04", "A3-05"]

HALF_W, HALF_H = 960, 540


def _have(path, dur):
    """Reuse a piece already on disk only if it measures the right length."""
    if not os.path.exists(path):
        return False
    try:
        return abs(A.duration(path) - dur) < A.FR / 2
    except Exception:
        return False


def row_by_sid(sid):
    for r in S.TABLE38:
        if r["sid"] == sid:
            return r
    raise SystemExit(f"{sid} not in TABLE38")


def label(src, out, text):
    """Burn an ASCII tag so the two columns cannot be confused when reviewing.

    The percent sign is avoided rather than escaped. ffmpeg's drawtext reads '%'
    as the start of a strftime expansion and drops it with a "Stray %" warning;
    a backslash-escaped form did not survive the argv path either. The character
    is decorative and the number is the point, so the label writes "pct" and the
    warning disappears instead of being guessed at.
    """
    text = text.replace("%", "pct")
    vf = (f"scale={HALF_W}:{HALF_H},"
          f"drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:"
          f"text='{text}':x=24:y=24:fontsize=30:fontcolor=white:"
          f"box=1:boxcolor=black@0.55:boxborderw=12")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-vf", vf,
                    "-c:v", "libx264", "-crf", "18", "-preset", "veryfast",
                    "-pix_fmt", "yuv420p", "-an", out], check=True)


def pair(left, right, out):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", left, "-i", right,
                    "-filter_complex", "[0:v][1:v]hstack=inputs=2[v]",
                    "-map", "[v]", "-c:v", "libx264", "-crf", "18",
                    "-preset", "veryfast", "-pix_fmt", "yuv420p", out], check=True)


def main():
    os.makedirs(WORK, exist_ok=True)
    os.makedirs("review", exist_ok=True)
    pairs = []

    for sid in PICKS:
        r = row_by_sid(sid)
        plate = os.path.join(LAND, r["anchor"] + ".png")
        if not os.path.exists(plate):
            raise SystemExit(f"{sid}: plate {plate} missing")
        dur = round(r["t1"] - r["t0"], 4)

        # LEFT — the rejected behaviour, reproduced exactly: the table's own kb
        # values, linear speed, no narration timing.
        z0, z1, dx, dy = r["kb"]
        old = f"{WORK}/{sid}_old.mp4"
        if not _have(old, dur):
            A.kenburns(plate, dur, old, z0=z0, z1=z1, pan=(dx, dy), ease="linear")

        # RIGHT — the new plan for the same row.
        p = M.plan(r, dur)
        new = f"{WORK}/{sid}_new.mp4"
        if not _have(new, dur):
            A.kenburns(plate, dur, new, z0=p["z0"], z1=p["z1"], pan=p["pan"],
                       ease=p["ease"], head=p["head"], tail=p["tail"])

        old_travel = abs(z1 - z0) + (dx * dx + dy * dy) ** 0.5
        new_travel = (abs(p["z1"] - p["z0"])
                      + (p["pan"][0] ** 2 + p["pan"][1] ** 2) ** 0.5)

        lo = f"{WORK}/{sid}_old_lbl.mp4"
        hi = f"{WORK}/{sid}_new_lbl.mp4"
        label(old, lo, f"BEFORE  {sid} {p['verb']}  linear {old_travel*100:.0f}%")
        label(new, hi, f"AFTER  {sid} {p['verb']}  {p['ease']} {new_travel*100:.0f}%")

        pr = f"{WORK}/{sid}_pair.mp4"
        pair(lo, hi, pr)
        pairs.append(pr)
        print(f"  {sid:8} {p['verb']:3} {dur:5.2f}s  "
              f"{old_travel*100:4.1f}% linear -> {new_travel*100:4.1f}% {p['ease']}"
              f"  head={p['head']:.2f} tail={p['tail']:.2f}")

    A.concat(pairs, OUT, "cmp38")
    print(f"\n{OUT}  {A.duration(OUT):.3f}s")


if __name__ == "__main__":
    main()
