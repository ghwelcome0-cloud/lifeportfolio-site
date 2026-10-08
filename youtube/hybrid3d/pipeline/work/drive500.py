#!/usr/bin/env python3
"""Driver for the 500-second master. Consumes shots.py, produces one MP4 per ACT.

Why a driver separate from act0.py: ACT0 was built while the shot table was still
prose, so its shot list lives inside it. Everything from 30s on is declared in
shots.py, and this file is the only consumer of that declaration. If a number is
wrong in the film, it is wrong in shots.py, and there is exactly one place to fix
it. act0.py stays as-is because it is already accepted output and rewriting it
would risk a regression for no gain.

Two pixel sources, decided per row by shots.resolve_kinds():

  i2v       a generated clip from V-2, trimmed to the row's exact seconds
  kenburns  a 2.5D move over the anchor plate the CEO approved

The second is free and is deliberately the majority: 27 of 35 rows in ACT1~2.
That ratio is the benchmark's own, not a budget compromise — a dolly over a
static subject is a camera move, and a 2048x1152 plate has the spare pixels to
carry it at 1920x1080 without upscaling.

Boundary grading is delegated to V-3's policy-aware colour_match through
assemble.colour_match, so a deliberate cut is never clamped toward the shot
before it. Rows carry their own policy and group; nothing is defaulted silently.

Usage:
    python3 drive500.py            # render every act that has its sources
    python3 drive500.py --act 12   # ACT1~2 only (30-150s)
    python3 drive500.py --dry      # plan only, touch no pixels
"""

import os
import sys
import json
import subprocess

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import shots
import assemble as A

LAND = shots.LANDING              # approved anchor plates, measured locally
SEG = "seg"                       # generated clips from V-2 land here
WORK = "_bld500"
OUT = "act12.mp4"

# The plate filenames as they were written by the download step. Kept explicit
# rather than globbed: a glob would silently pick up a stale portrait file, which
# is exactly the class of failure that cost a regeneration cycle.
PLATE_FILE = {
    32.44:  "a1_032.44.png",
    44.80:  "a1_044.80.png",
    56.18:  "a1_056.18.png",
    60.64:  "a1_060.64_panel.png",
    76.76:  "a1_076.76.png",
    82.08:  "a1_082.08.png",
    85.06:  "a2_085.06.png",
    101.22: "a2_101.22.png",
    104.32: "a2_104.32_3sheets.png",
    119.62: "a2_119.62_panel.png",
    132.48: "a2_132.48_panel.png",
    139.10: "a2_139.10_panel.png",
}

# Generated clip filenames, filled in as V-2 delivers. A row whose clip is
# missing is reported and skipped rather than substituted, because a substituted
# shot is a lie in the timeline that nobody would notice until the CEO did.
I2V_FILE = {
    "A1-03": "i2v_A1-03.mp4",
    "A1-06": "i2v_A1-06.mp4",
    "A1-08": "i2v_A1-08.mp4",
    "A1-13": "i2v_A1-13.mp4",
    "A1-16": "i2v_A1-16.mp4",
    "A2-02": "i2v_A2-02.mp4",
    "A2-04": "i2v_A2-04.mp4",
    "A2-13": "i2v_A2-13.mp4",
}


def plate_path(anchor):
    p = os.path.join(LAND, PLATE_FILE[anchor])
    if not os.path.exists(p):
        raise SystemExit(f"missing approved plate for anchor {anchor}: {p}")
    return p


def check_plate_format(path):
    """Re-measure, every run. The approval was granted on measured landscape
    plates; if a file on disk has since been replaced by something else, the
    render must stop rather than quietly produce a letterboxed master."""
    import cv2
    im = cv2.imread(path)
    if im is None:
        raise SystemExit(f"unreadable plate {path}")
    h, w = im.shape[:2]
    ar = w / h
    if abs(ar - shots.REQ_AR) > shots.REQ_AR_TOL or w < shots.REQ_MIN_W:
        raise SystemExit(f"plate {os.path.basename(path)} is {w}x{h} ar={ar:.4f} "
                         f"— fails the landscape contract, refusing to render")
    return w, h


def reusable(out, dur):
    """True when a piece already on disk is exactly the length this row wants.

    Rendering thirty-five Ken Burns moves costs several minutes of CPU, and the
    five outstanding generated clips mean this driver will be re-run at least
    twice more. Re-deriving pixels that are already correct is pure waste, so a
    piece is reused when its measured duration matches to within half a frame.
    The check is a measurement, not a timestamp comparison: a file that exists
    but is the wrong length is exactly the silent-truncation failure the ffmpeg
    -ss clamp elsewhere in this file guards against.
    """
    if not os.path.exists(out):
        return False
    try:
        return abs(A.duration(out) - dur) < A.FR / 2
    except Exception:
        return False


def render_row(r, idx):
    """One row -> one MP4 at exactly its declared duration."""
    dur = round(r["t1"] - r["t0"], 4)
    out = f"{WORK}/r{idx:02d}_{r['sid']}.mp4"

    if reusable(out, dur):
        return out, None

    if r["kind"] == "i2v":
        src = os.path.join(SEG, I2V_FILE[r["sid"]])
        if not os.path.exists(src):
            return None, f"{r['sid']}: generated clip not delivered yet ({src})"
        have = A.duration(src)
        # Two frames of headroom. ffmpeg -ss past the end returns rc=0 with a
        # short file, so the clamp is the only thing standing between a silent
        # truncation and a master that is quietly out of sync.
        if r["ss"] + dur > have - 2 * A.FR:
            usable = max(have - r["ss"] - 2 * A.FR, 0)
            return None, (f"{r['sid']}: clip too short — need {dur:.2f}s from "
                          f"ss={r['ss']:.2f} but source is {have:.2f}s "
                          f"(usable {usable:.2f}s)")
        A.trim(src, r["ss"], dur, None, out)
        return out, None

    plate = plate_path(r["anchor"])
    check_plate_format(plate)
    z0, z1, dx, dy = r["kb"]
    A.kenburns(plate, dur, out, z0=z0, z1=z1, pan=(dx, dy))
    return out, None


def main():
    dry = "--dry" in sys.argv
    table = shots.resolve_kinds()

    if not shots.CEO_IMAGE_APPROVAL:
        raise SystemExit("shots.CEO_IMAGE_APPROVAL is False — the anchor plates "
                         "have not been approved, refusing to render on top of them")
    if shots.HELD:
        raise SystemExit(f"anchors still held: {sorted(shots.HELD)}")

    kb = [r for r in table if r["kind"] == "kenburns"]
    iv = [r for r in table if r["kind"] == "i2v"]
    print(f"rows {len(table)}   kenburns {len(kb)} (free)   i2v {len(iv)} (generated)")
    print(f"span {table[0]['t0']:.2f} -> {table[-1]['t1']:.2f}s")

    missing = [s for s in shots.I2V_ROWS
               if not os.path.exists(os.path.join(SEG, I2V_FILE[s]))]
    if missing:
        print(f"awaiting {len(missing)} generated clips: {sorted(missing)}")

    if dry:
        for r in table:
            tag = "i2v " if r["kind"] == "i2v" else ("kb* " if r["demoted"] else "kb  ")
            print(f"  {tag}{r['sid']:6} {r['t0']:7.2f}-{r['t1']:7.2f} "
                  f"({r['t1']-r['t0']:4.2f}s) a={r['anchor']:<7} {r['group']}")
        print("\ndry run — nothing rendered")
        return 0

    os.makedirs(WORK, exist_ok=True)
    parts, skipped = [], []
    prev_tail, prev_group = None, None

    for i, r in enumerate(table):
        p, err = render_row(r, i)
        if err:
            skipped.append(err)
            print(f"  SKIP {err}")
            continue

        # Grade this piece toward the tail of the previous one, under the row's
        # own policy. Done after the piece exists so the window is measured on
        # the actual delivered pixels, not on the plate it came from.
        if prev_tail is not None:
            cur = A.grab_window(p, 0.06)
            filt, dY, dW = A.colour_match(
                prev_tail, cur, r["policy"], prev_group, r["group"],
                transition_reason=r.get("transition_reason"),
                expected_warmth_direction=r.get("expected_warmth_direction"))
            if filt:
                g = f"{WORK}/g{i:02d}.mp4"
                A.run(["ffmpeg", "-v", "error", "-y", "-i", p, "-vf", filt,
                       "-c:v", "libx264", "-crf", "16", "-preset", "medium",
                       "-pix_fmt", "yuv420p", "-an", g], f"grade {r['sid']}")
                p = g

        parts.append(p)
        prev_tail = A.grab_window(p, max(A.duration(p) - 0.06, 0.0))
        prev_group = r["group"]

    if not parts:
        raise SystemExit("nothing rendered")

    # assemble.concat takes a third argument: the label used in its error
    # reporting. It is not optional. Passing it also means that if the demuxer
    # rejects one of the pieces, the failure names this render rather than
    # surfacing as an anonymous ffmpeg return code.
    A.concat(parts, OUT, f"ACT1~2 master ({len(parts)} pieces, "
                         f"{len(skipped)} awaiting generation)")
    print(f"\nwrote {OUT}  {os.path.getsize(OUT):,} B  {A.duration(OUT):.6f}s")
    if skipped:
        print(f"\n{len(skipped)} row(s) skipped — this is a PARTIAL master:")
        for s in skipped:
            print(f"  · {s}")
        print("Do not ship a partial. It exists so the free work can be verified "
              "while the generated clips are still in production.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
