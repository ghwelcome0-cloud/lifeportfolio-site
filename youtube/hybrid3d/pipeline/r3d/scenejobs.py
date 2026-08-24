"""scenejobs.py -- turn scenemap.json into the job list previz_batch renders.

Why a bridge instead of a new renderer
--------------------------------------
Lesson 176 and 181, learned the expensive way: when the geometry lives in two
places they drift, and when nobody owns "is the whole thing right" a 0.320 s
hole ships.  previz_batch.py is the ONLY file that builds a previz frame and it
stays that way.  This file translates the new scene/camera design into the exact
schema previz_batch already consumes (job_id, frames, hold_frac, arc_deg,
cam_start_xyz, cam_end_xyz, tgt_start_xyz, tgt_end_xyz, word_gesture, ...), and
adds the two NEW fields the renderer learns to read: `set` and `lens`.

What changes for the viewer, and why
------------------------------------
CEO-67 (5) rejected the previz because "every cut moves the same way and only
the word changes".  Two measured causes:

  * camera:  four verbs x four level multipliers = TWELVE distinct trajectories
             over sixty cuts, top one 15/80 = 19%.
  * scene:   all sixty cuts were the same eight boxes -- a grey floor, three
             brown walls, three coloured sheets and a red cup.  No props, no
             environment, no people.  Any camera over that geometry reads as
             "coloured paper on a grey floor".

scenemap.py fixed the first (17 moves, top share 9%, zero adjacent repeats) and
sets.py fixed the second (ten sets, 250 primitives, four colour-coded
mannequins).  This file is the wire between them and the renderer.

Angle convention -- read this before touching anything
------------------------------------------------------
previz_batch derives the sweep from the CARTESIAN endpoints and cross-checks it
against arc_deg (the ARC GATE, lesson 171: arc_deg is a magnitude, the sign
lives in cam_end_xyz).  So the endpoints written here must satisfy

    a0 = atan2(x0, -y0),  a1 = atan2(x1, -y1),  a1 - a0 == +/- arc_deg

exactly, or the gate fires.  The sweep direction alternates per shot index so
consecutive cuts do not all orbit the same way.
"""
import json, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SCENEMAP = os.path.join(HERE, "scenemap.json")
ROWS = "/home/user/lf/work/longform/rows38.json"
OUT = os.path.join(HERE, "scenejobs.json")
FPS = 24

sys.path.insert(0, HERE)
from sets import DOC_Z, DESK_Z                      # noqa: E402

CONVERGE_KEYS = ("반복", "세 프로젝트", "3개 프로젝트", "같은 역할", "공통")
NONE_KEYS = ("새 정보 금지", "읽히는 글자 금지")

# Gaze height per gesture.  Kept identical in spirit to plan.py's TGT_END, but
# lifted onto the real desk surface: sets.py puts the tabletop at 0.762 m, while
# the old hard-coded set had its "desk" slab centred at -0.15 m, so a gaze of
# z=0.30 used to mean "above the table" and now means "through it".
TGT_Z = {"converge": DOC_Z + 0.30, "lift": DOC_Z + 0.12, "none": DOC_Z + 0.02}


def gesture_of(row):
    """Which word gesture this beat carries -- same rules as plan.py.

    Duplicating the CONSTANTS is safe (they are data); duplicating the geometry
    is not, which is why the trajectory maths stays in previz_batch.
    """
    if row["sid"].startswith("A8"):
        return "none"
    if any(k in (row.get("protect") or "") for k in NONE_KEYS):
        return "none"
    blob = " ".join([row.get("narr") or "", row.get("objects") or "",
                     row.get("reason") or ""])
    if any(k in blob for k in CONVERGE_KEYS):
        return "converge"
    return "lift"


def endpoints(rec, idx):
    """Cartesian camera/target endpoints that satisfy the renderer's ARC GATE.

    The start bearing is spread over the film rather than fixed at zero: with a
    constant start bearing every shot in a set opens from the same side of the
    room, which is a subtler version of the same monotony complaint.  The
    bearing is a deterministic function of the shot index (golden-angle stride,
    so successive shots land far apart and the sequence never repeats inside 76
    shots), and the sweep direction alternates.
    """
    arc = math.radians(rec["arc_deg"])
    sign = 1.0 if idx % 2 == 0 else -1.0
    a0 = math.radians((idx * 137.508) % 360.0)
    a1 = a0 + sign * arc
    r0, r1 = rec["r0"], rec["r1"]
    z0, z1 = rec["z0"], rec["z1"]
    cam0 = [round(r0 * math.sin(a0), 4), round(-r0 * math.cos(a0), 4), round(z0, 4)]
    cam1 = [round(r1 * math.sin(a1), 4), round(-r1 * math.cos(a1), 4), round(z1, 4)]
    return cam0, cam1


def main():
    sm = json.load(open(SCENEMAP))
    shots = sm["shots"]
    src = {r["sid"]: r for r in json.load(open(ROWS))["rows"]}
    jobs = []
    for i, rec in enumerate(shots):
        row = src[rec["sid"]]
        g = gesture_of(row)
        cam0, cam1 = endpoints(rec, i)
        tz = TGT_Z[g]
        ax, ay = rec["doc_anchor"][1]          # the centre document of the set
        job = {
            "job_id": "J_" + rec["sid"],
            "sids": rec["members"],
            "act": rec["sid"].split("-")[0],
            "set": rec["set"],
            "set_from": rec["set_from"],
            "move": rec["move"],
            "lens": rec["lens"],
            "level": rec["level"],
            "verb": rec["verb"],
            "frames": rec["frames"],
            "duration_s": round(rec["frames"] / float(FPS), 4),
            "hold_frac": rec["hold_frac"],
            "hold_frames": int(round(rec["frames"] * rec["hold_frac"])),
            "ease": rec["ease"],
            "arc_deg": rec["arc_deg"],
            "cam_start_xyz": cam0,
            "cam_end_xyz": cam1,
            # the gaze rides the set's own centre document, not world origin --
            # with ten sets the interesting geometry is no longer at (0,0).
            "tgt_start_xyz": [round(ax, 4), round(ay - 0.06, 4), round(tz, 4)],
            "tgt_end_xyz": [round(ax, 4), round(ay - 0.02, 4), round(tz, 4)],
            "doc_anchor": rec["doc_anchor"],
            "doc_z": rec["doc_z"],
            "word_gesture": g,
            # lesson 174: round-robin over A/B/C pushed 30 of 51 lift jobs off
            # frame.  The lift word sits on the CENTRE sheet, always.
            "word_doc": "B" if g == "lift" else "",
            "cut": rec["cut"],
            "chain": rec["chain"],
            "delta": rec["delta"],
            "narr": row.get("narr") or "",
            "objects": row.get("objects") or "",
            "motion_reason": row.get("reason") or "",
            "t0": rec["t0"], "t1": rec["t1"],
            "fit_scale": rec["fit_scale"],
        }
        jobs.append(job)

    # ---- gates ------------------------------------------------------------
    # (a) the ARC GATE that previz_batch will run -- verified HERE so a bad
    #     endpoint is caught in 0.2 s instead of after a scene build.
    for j in jobs:
        a = j["cam_start_xyz"]; b = j["cam_end_xyz"]
        a0 = math.atan2(a[0], -a[1]); a1 = math.atan2(b[0], -b[1])
        arc = a1 - a0
        while arc > math.pi:
            arc -= 2 * math.pi
        while arc < -math.pi:
            arc += 2 * math.pi
        if abs(abs(math.degrees(arc)) - abs(j["arc_deg"])) > 1.0:
            raise SystemExit("ARC GATE FAILED %s: %.2f vs %.2f"
                             % (j["job_id"], math.degrees(arc), j["arc_deg"]))
    # (b) radius must match what scenemap fitted (no silent rescale here)
    for j, rec in zip(jobs, shots):
        r0 = math.hypot(*j["cam_start_xyz"][:2])
        r1 = math.hypot(*j["cam_end_xyz"][:2])
        if abs(r0 - rec["r0"]) > 0.01 or abs(r1 - rec["r1"]) > 0.01:
            raise SystemExit("RADIUS GATE FAILED %s: %.3f/%.3f vs %.3f/%.3f"
                             % (j["job_id"], r0, r1, rec["r0"], rec["r1"]))
    # (c) the camera must stay above the desk surface, or it films the underside
    for j in jobs:
        if min(j["cam_start_xyz"][2], j["cam_end_xyz"][2]) < DESK_Z + 0.05:
            raise SystemExit("HEIGHT GATE FAILED %s: z %.3f/%.3f below desk %.3f"
                             % (j["job_id"], j["cam_start_xyz"][2],
                                j["cam_end_xyz"][2], DESK_Z))
    # (d) coverage: the job list must be the whole script, once
    tot = sum(j["frames"] for j in jobs)
    src_tot = sum(max(1, int(round((r["t1"] - r["t0"]) * FPS)))
                  for r in json.load(open(ROWS))["rows"])
    if tot != src_tot:
        raise SystemExit("COVER GATE FAILED: %d f vs %d f" % (tot, src_tot))
    seen = set()
    for j in jobs:
        for s in j["sids"]:
            if s in seen:
                raise SystemExit("COVER GATE FAILED: sid %s twice" % s)
            seen.add(s)
    if len(seen) != len(src):
        raise SystemExit("COVER GATE FAILED: %d sids of %d" % (len(seen), len(src)))

    json.dump({"jobs": jobs}, open(OUT, "w"), ensure_ascii=False, indent=1)
    import collections
    gc = collections.Counter(j["word_gesture"] for j in jobs)
    print("SCENEJOBS OK  %d jobs  %d f = %.3f s" % (len(jobs), tot, tot / float(FPS)))
    print("  gestures  " + "  ".join("%s=%d" % kv for kv in gc.most_common()))
    print("  lens      %d-%d mm over %d distinct values"
          % (min(j["lens"] for j in jobs), max(j["lens"] for j in jobs),
             len(set(j["lens"] for j in jobs))))
    print("  cam z     %.2f-%.2f m   radius %.2f-%.2f m"
          % (min(min(j["cam_start_xyz"][2], j["cam_end_xyz"][2]) for j in jobs),
             max(max(j["cam_start_xyz"][2], j["cam_end_xyz"][2]) for j in jobs),
             min(math.hypot(*j["cam_start_xyz"][:2]) for j in jobs),
             max(math.hypot(*j["cam_start_xyz"][:2]) for j in jobs)))
    print("-> %s" % OUT)


if __name__ == "__main__":
    main()
