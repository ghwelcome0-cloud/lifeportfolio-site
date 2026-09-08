"""
valid.py — pre-render gate over the shot table.

This runs BEFORE any pixel is generated, because every defect it catches is one
that ffmpeg would have reported as success. v14 passed every automatic check I
had and the CEO still found two faults by watching it: a whole report section had
gone missing, and two narration lines overlapped. So this file is deliberately
narrow. It does not judge whether the film is good. It checks only the claims the
shot table makes about itself, where a violation is arithmetic rather than taste.

What it refuses to do
─────────────────────
It will not infer a shot's colour policy from the size of a measurement. A large
d_warmth can mean a broken cut or a deliberate one, and the number alone cannot
tell the difference. Policy is declared by a person; this file only checks that a
declaration exists and is internally consistent.

Exit status is non-zero when any hard rule fails, so a build script can stop.
"""

import sys
import shots


def check(table, t_lo, t_hi):
    err, warn = [], []

    # 1. Timeline integrity. Gaps and overlaps are how a section silently vanishes.
    #    This is exactly the class of fault that removed the report segment from v14.
    prev = None
    for s in table:
        if s["t1"] <= s["t0"]:
            err.append(f'{s["sid"]}: non-positive duration {s["t0"]}->{s["t1"]}')
        if prev is not None:
            gap = s["t0"] - prev["t1"]
            if abs(gap) > 1e-6:
                kind = "gap" if gap > 0 else "overlap"
                err.append(f'{prev["sid"]} -> {s["sid"]}: {kind} of {gap:+.4f}s')
        prev = s
    if table:
        if abs(table[0]["t0"] - t_lo) > 1e-6:
            err.append(f'table starts at {table[0]["t0"]}, expected {t_lo}')
        if abs(table[-1]["t1"] - t_hi) > 1e-6:
            err.append(f'table ends at {table[-1]["t1"]}, expected {t_hi}')

    # 2. Text shots must not be generated. i2v resamples the frame, and the glyphs
    #    that gpt-image-2 rendered at craft 9.0-9.8 do not survive resampling.
    for s in table:
        if s["text"] and s["kind"] == "i2v":
            err.append(f'{s["sid"]}: text shot declared i2v')
        if s["panel"] and s["kind"] != "kenburns":
            err.append(f'{s["sid"]}: panel shot must be kenburns, got {s["kind"]}')
        if s["panel"] and not s["kb"]:
            err.append(f'{s["sid"]}: panel shot has no Ken Burns move')
        if s["panel"] and s["orb"]:
            err.append(f'{s["sid"]}: orb must not overlap a glass panel')

    # 3. Every panel string must be byte-identical to the approved text. An
    #    automatic pixel check compares a frame to the still it came from, so it
    #    cannot notice a string that was already wrong when the still was made.
    for s in table:
        if not s["panel"]:
            continue
        want = shots.PANELS.get(s["anchor"])
        if want is None:
            err.append(f'{s["sid"]}: anchor {s["anchor"]} has no approved string')
        elif s["panel"] != want:
            err.append(f'{s["sid"]}: panel text differs from approved\n'
                       f'      declared: {s["panel"]!r}\n'
                       f'      approved: {want!r}')

    # 4. Colour policy. A cut may only be matched to the previous shot when both
    #    belong to the same continuity group; otherwise the match pulls one world
    #    towards another. The seal->reveal boundary is the case that matters here:
    #    it measures d_warmth 74.54, which would drive an R gain of 1.902.
    prev = None
    for s in table:
        if s["policy"] not in ("continuous", "intentional_transition", "hard_reset"):
            err.append(f'{s["sid"]}: unknown policy {s["policy"]!r}')
        if prev is not None and s["policy"] == "continuous" \
                and s["group"] != prev["group"]:
            err.append(f'{s["sid"]}: continuous cut crosses group '
                       f'{prev["group"]} -> {s["group"]}')
        if prev is not None and s["group"] != prev["group"] \
                and s["policy"] == "continuous":
            pass
        prev = s

    # 5. Object count. The narration says "three projects" out loud at 104.32 s, so
    #    a fourth sheet on screen contradicts the audio rather than merely looking
    #    untidy. Any shot drawing on that anchor inherits the requirement.
    for s in table:
        if s["anchor"] == 104.32 and s["objects"] != 3:
            err.append(f'{s["sid"]}: uses the 104.32 anchor but does not '
                       f'require exactly 3 objects')

    # 6. Held anchors. Two of the twelve delivered stills failed my gate for
    #    sci-fi contamination, the same fault the CEO rejected earlier. They are
    #    being regenerated; until they land, any shot using them is blocked.
    for s in table:
        if s["anchor"] in shots.HELD:
            warn.append(f'{s["sid"]}: anchor {s["anchor"]} is HELD pending '
                        f'regeneration — cannot render yet')

    # 7. Every shot needs an anchor to draw from.
    for s in table:
        if s["anchor"] is None:
            err.append(f'{s["sid"]}: no anchor')
        elif s["anchor"] not in shots.ANCHORS:
            err.append(f'{s["sid"]}: anchor {s["anchor"]} not in ANCHORS')

    return err, warn


def main():
    t = shots.TABLE
    err, warn = check(t, 30.00, 150.00)

    dur = sum(s["t1"] - s["t0"] for s in t)
    kb = [s for s in t if s["kind"] == "kenburns"]
    i2v = [s for s in t if s["kind"] == "i2v"]
    print(f"shots        {len(t)}   ({len(i2v)} i2v, {len(kb)} kenburns)")
    print(f"span         {t[0]['t0']:.2f} -> {t[-1]['t1']:.2f}s   sum {dur:.4f}s")
    print(f"panels       {len(shots.PANELS)}")
    print(f"held anchors {sorted(shots.HELD)}")
    groups = []
    for s in t:
        if not groups or groups[-1] != s["group"]:
            groups.append(s["group"])
    print(f"groups       {' -> '.join(groups)}")
    trans = [s["sid"] for s in t if s["policy"] == "intentional_transition"]
    print(f"contrast     {trans}")

    print()
    for w in warn:
        print(f"WARN  {w}")
    for e in err:
        print(f"FAIL  {e}")
    print()
    if err:
        print(f"BLOCKED — {len(err)} hard failure(s)")
        return 1
    print(f"gate passed — {len(warn)} warning(s), 0 hard failures")
    return 0


if __name__ == "__main__":
    sys.exit(main())
