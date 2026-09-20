"""Parse V-1's render subsegment lock table into frame-exact cut plans.

Why this file exists at all: the shot table's row is a SENTENCE, and V-1 was
explicit that a sentence is never split in the SSOT. But a 7-second still with a
single continuous Ken Burns move reads as a slideshow, which is exactly the
"PPT slides stitched together" the CEO said we had finally escaped. So V-1 gave
a second, separate document: for 17 long rows, the *renderer* may cut internally
at named times, while the row keeps one sentence id, one camera meaning, one
continuity state.

The split points are therefore NOT mine to invent. They are read from the team's
table, and a row absent from that table is rendered whole no matter how long it
is — inventing a cut would be inventing a beat the designer did not write.
"""
import os
import re

GT = "/home/user/lf/gt"
V1 = os.path.join(GT, "v1_act3_8_saddle.md")

_DASH = "[\u2013\u2014-]"


def load():
    """sid -> [(t0, t1), ...] taken verbatim from the lock table."""
    plans, inside = {}, False
    with open(V1, encoding="utf-8") as f:
        for line in f:
            s = line.strip()
            if s.startswith("## ") and "subsegment" in s:
                inside = True
                continue
            if inside and s.startswith("## "):
                break
            if not (inside and s.startswith("|")):
                continue
            cells = [c.strip() for c in s.strip("|").split("|")]
            if len(cells) != 2 or not re.match(r"^A\d", cells[0]):
                continue
            segs = []
            for piece in cells[1].split("/"):
                m = re.match(r"^(\d+\.\d+)\s*%s\s*(\d+\.\d+)$" % _DASH,
                             piece.strip())
                if m:
                    segs.append((float(m.group(1)), float(m.group(2))))
            if segs:
                plans[cells[0]] = segs
    return plans


PLANS = load()


def cuts_for(row):
    """Internal cut plan for one shot-table row, clipped to the row's own span.

    The lock table quotes narration cue times, while the shot table's rows were
    extended to absorb the pauses between sentences (the 59 s that would
    otherwise be black). So the last subsegment must be stretched to the row's
    real end, and the first pulled back to its real start — otherwise the
    internal cuts would re-open the gap this project already closed once.
    """
    segs = PLANS.get(row["sid"])
    if not segs:
        return [(row["t0"], row["t1"])]
    out = [[max(a, row["t0"]), min(b, row["t1"])] for a, b in segs]
    out = [p for p in out if p[1] - p[0] > 1e-6]
    if not out:
        return [(row["t0"], row["t1"])]
    out[0][0] = row["t0"]
    out[-1][1] = row["t1"]
    for i in range(len(out) - 1):          # make internal boundaries touch
        out[i + 1][0] = out[i][1]
    return [tuple(p) for p in out]


if __name__ == "__main__":
    import shots38
    print(f"lock table rows: {len(PLANS)}")
    tot = 0
    for r in shots38.TABLE38:
        c = cuts_for(r)
        if len(c) > 1:
            tot += 1
            span = round(sum(b - a for a, b in c), 3)
            ok = abs(span - (r["t1"] - r["t0"])) < 1e-6
            print(f"  {r['sid']:<12} {len(c)} cuts  "
                  f"{' '.join(f'{a:.2f}-{b:.2f}' for a, b in c)}  "
                  f"sum={span} row={round(r['t1']-r['t0'],3)} "
                  f"{'OK' if ok else '*** MISMATCH'}")
    print(f"rows split: {tot}")
    miss = sorted(set(PLANS) - {r["sid"] for r in shots38.TABLE38})
    print(f"lock ids not in table: {miss}")
    longs = [r["sid"] for r in shots38.TABLE38
             if r["t1"] - r["t0"] > 6.5 and len(cuts_for(r)) == 1]
    print(f"still >6.5s after split (rendered whole by design): {longs}")
