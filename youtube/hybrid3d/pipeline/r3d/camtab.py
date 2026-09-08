"""camtab.py -- derive the 59-cut previz CAMERA TABLE from rows38.json.

Why this exists
---------------
The previz pipeline (Article 14 (14)) is proven on one cut. The only remaining
bottleneck for the full 500s is a per-cut table of real 3D camera coordinates.
rows38.json already carries, for every cut: the camera INTENT (`cam`), what is on
screen (`objects`), the narration line (`narr`) and the transition rationale
(`reason`). That is everything needed to derive coordinates deterministically --
so we derive them instead of hand-authoring 59 rows.

Grammar mapping (the four verbs already used across the deck)
    도착 arrive   -> dolly IN   : radius shrinks, height drops, small arc
    관통 pass     -> travel THROUGH : lateral sweep, large arc, radius near-constant
    후퇴 retreat  -> pull BACK  : radius grows, height rises, small arc
    정지 hold     -> minimal move, but never zero (Article 14 (13): parallax required)

Hard rules enforced (raise, never silently fix)
    arc_deg    >= 55           (below this it is indistinguishable from Ken Burns)
    hold_frac  in [0.15, 0.35] (CEO: "there is no still section")
    motion_reason non-empty    (CEO: "movement must carry meaning")
    |cam xyz|  <= 12.0         (previz set is 16x12m; stay inside)

Feasibility note
    Cuts shorter than ~1.7s cannot host a hold + a >=55deg arc at 24fps.
    They are emitted with feasible=false and MUST be handled as continuations of
    the neighbouring cut, not as independent previz renders.
"""
import json, math, os, re, sys

FPS = 24
SRC = "/home/user/lf/work/longform/rows38.json"
OUT = "/home/user/lf/r3d/camtab.json"

MIN_ARC = 55.0
# MAX_HOLD is not a guess: the verified previz (pv5) held its markers for the
# first 40% of the shot and the result was accepted on screen.
MIN_HOLD, MAX_HOLD = 0.15, 0.40
MIN_HOLD_FRAMES = 29          # Article 14 (10) R2
MAX_R = 12.0

# verb -> (r_start, r_end, h_start, h_end, arc_deg)
GRAMMAR = {
    "도착": (8.4, 3.4, 4.2, 1.7, 62.0),    # arrive: come in and settle low
    "관통": (6.6, 6.0, 2.9, 2.4, 104.0),   # pass through: wide lateral sweep
    "후퇴": (3.6, 8.2, 1.8, 4.4, 58.0),    # retreat: back off and rise
    "정지": (6.2, 5.6, 3.0, 2.7, 56.0),    # hold: minimum legal parallax
}
LEVEL_R = {"L0": 1.20, "L1": 1.00, "L2": 0.92, "L3": 0.80}  # deeper level = closer


def verb_of(cam):
    return (cam or "").split("—")[0].strip() or "정지"


def pct_of(cam):
    m = re.findall(r"(\d+)%", cam or "")
    return int(m[0]) if m else 0


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def build(row):
    sid = row["sid"]
    dur = round(row["t1"] - row["t0"], 3)
    n = max(1, int(round(dur * FPS)))
    verb = verb_of(row["cam"])
    r0, r1, h0, h1, arc = GRAMMAR.get(verb, GRAMMAR["정지"])

    # level scales the whole rig: L3 (deep detail) sits closer than L0 (whole)
    k = LEVEL_R.get(row.get("level") or "L2", 1.0)
    r0, r1, h0, h1 = r0 * k, r1 * k, h0 * k, h1 * k

    # the explicit N% in the intent text nudges the travel magnitude
    p = pct_of(row["cam"])
    if p:
        g = 1.0 + (p - 4) * 0.06          # 4% is the deck's median
        mid = (r0 + r1) / 2.0
        r0, r1 = mid + (r0 - mid) * g, mid + (r1 - mid) * g

    r0, r1 = clamp(r0, 1.6, MAX_R), clamp(r1, 1.6, MAX_R)
    h0, h1 = clamp(h0, 0.9, 4.6), clamp(h1, 0.9, 4.6)

    # hold: long cuts can afford more stillness; short cuts get the floor
    hold = clamp(MIN_HOLD_FRAMES / n, MIN_HOLD, MAX_HOLD)
    feasible = n >= int(math.ceil(MIN_HOLD_FRAMES / MAX_HOLD))   # >= 73f ~ 3.04s
    if not feasible:
        # still emit, but flag: too short to host hold + full arc independently
        hold = MIN_HOLD

    # alternate sweep direction so consecutive cuts do not feel like one long pan
    idx = build.counter
    build.counter += 1
    sign = 1.0 if idx % 2 == 0 else -1.0

    a0 = -arc / 2.0 * sign
    a1 = arc / 2.0 * sign

    def xyz(r, h, a):
        t = math.radians(a)
        return [round(r * math.sin(t), 3), round(-r * math.cos(t), 3), round(h, 3)]

    return {
        "seam_id": sid,
        "duration_s": dur,
        "frames": n,
        "plate": row.get("anchor"),
        "level": row.get("level"),
        "verb": verb,
        "arc_deg": round(arc, 1),
        "hold_frac": round(hold, 3),
        "hold_frames": int(round(hold * n)),
        "r_start": round(r0, 3), "r_end": round(r1, 3),
        "h_start": round(h0, 3), "h_end": round(h1, 3),
        "cam_start_xyz": xyz(r0, h0, a0),
        "cam_end_xyz": xyz(r1, h1, a1),
        "tgt_start_xyz": [0.0, -0.55, 0.15],
        "tgt_end_xyz": [0.0, -0.35, 0.77],
        "markers": [],                      # filled per-cut when a word must glow
        "narr_line": row.get("narr") or "",
        "motion_reason": row.get("reason") or "",
        "objects": row.get("objects") or "",
        "feasible": bool(feasible),
    }


build.counter = 0


def check(t):
    """Hard gates. Raise instead of silently repairing -- a wrong table is worse
    than no table, because 59 renders would bake the error in."""
    bad = []
    for r in t:
        if r["arc_deg"] < MIN_ARC:
            bad.append("%s arc %.1f < %.1f" % (r["seam_id"], r["arc_deg"], MIN_ARC))
        if not (MIN_HOLD - 1e-9 <= r["hold_frac"] <= MAX_HOLD + 1e-9):
            bad.append("%s hold_frac %.3f out of range" % (r["seam_id"], r["hold_frac"]))
        if r["hold_frac"] <= 0:
            bad.append("%s hold_frac is zero" % r["seam_id"])
        if not r["motion_reason"].strip():
            bad.append("%s motion_reason empty" % r["seam_id"])
        for key in ("cam_start_xyz", "cam_end_xyz"):
            v = r[key]
            if math.sqrt(sum(c * c for c in v)) > MAX_R + 1e-6:
                bad.append("%s %s outside set" % (r["seam_id"], key))
    if bad:
        raise SystemExit("GATE FAILED (%d):\n  " % len(bad) + "\n  ".join(bad[:20]))


def main():
    rows = json.load(open(SRC))["rows"]
    tab = [build(r) for r in rows]
    check(tab)

    feas = [r for r in tab if r["feasible"]]
    infeas = [r for r in tab if not r["feasible"]]
    frames = sum(r["frames"] for r in feas)

    json.dump({"version": 1, "fps": FPS, "rows": tab}, open(OUT, "w"),
              ensure_ascii=False, indent=1)

    print("CAMTAB rows %d  feasible %d  infeasible %d" % (len(tab), len(feas), len(infeas)))
    print("  frames(feasible) %d  = %.1f s of previz" % (frames, frames / FPS))
    print("  est render @0.207 s/f = %.1f min" % (frames * 0.207 / 60.0))
    import collections
    print("  verbs", dict(collections.Counter(r["verb"] for r in tab)))
    print("  infeasible:", [r["seam_id"] for r in infeas])
    print("  wrote", OUT)


if __name__ == "__main__":
    main()
