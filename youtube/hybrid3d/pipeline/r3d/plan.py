#!/usr/bin/env python3
"""Turn camtab.json (80 shots) into RENDER JOBS.

The problem this solves
-----------------------
20 of the 80 shots are shorter than 73 frames (3.04 s).  Article 14 (12) forbids
giving such a shot its own independent camera event: it cannot hold 29 frames
still AND travel.  Rendering them alone would produce exactly the "깜빡거리는
컷 전환" the CEO rejected in [CEO-50].

The rule (deterministic, no guessing)
------------------------------------
An infeasible shot is NOT rendered alone.  It is welded to an adjacent feasible
shot inside the same ACT group and the two are rendered as ONE continuous camera
path, then sliced back apart at the frame boundary.  The short shot therefore
inherits real parallax and a real hold from its neighbour instead of faking one.

  * prefer the PRECEDING feasible shot (the move continues into the short shot)
  * if there is none in the group (the short shot opens the ACT), use the
    FOLLOWING feasible shot (the short shot becomes the lead-in of that move)
  * the job's camera grammar is the ANCHOR shot's verb, spanning the whole job
  * a job's hold sits inside the anchor's own slice, never inside the short one

Output: jobs.json  { version, fps, jobs:[ {job_id, sids[], frames, slices[], ...} ] }
"""
import json, math, os

FPS = 24
CAM = "/home/user/lf/r3d/camtab.json"
ROWS = "/home/user/lf/work/longform/rows38.json"
OUT = "/home/user/lf/r3d/jobs.json"
MIN_HOLD_FRAMES = 29
MAX_HOLD = 0.40
MIN_JOB_FRAMES = 73          # 3.04 s -- below this a shot cannot hold AND travel
MAX_V2V_FRAMES = 360         # Seedance 2.0 accepts at most 15 s per call


def split_parts(members, frames_of):
    """Cut a job into v2v calls of at most 15 s, only at MEMBER boundaries.

    A welded job is rendered as ONE continuous camera path -- that is the whole
    point of the weld -- but a single paid v2v call cannot exceed 15 s.  The cut
    is therefore placed on a shot boundary, which is already a cut in the final
    timeline, so splitting there costs nothing visually.  Every part must still
    be long enough to be a valid shot on its own (>= 73 frames).
    """
    tot = sum(frames_of[s] for s in members)
    if tot <= MAX_V2V_FRAMES:
        return [{"part": 1, "sids": list(members), "f0": 0, "f1": tot - 1, "frames": tot}]
    parts, cur, run, f0, p = [], [], 0, 0, 1
    for i, s in enumerate(members):
        n = frames_of[s]
        rest = sum(frames_of[x] for x in members[i + 1:])
        # close the part if adding this shot would overflow, and what remains
        # (this shot + the rest) is still a legal part on its own
        if run and run + n > MAX_V2V_FRAMES and n + rest >= MIN_JOB_FRAMES:
            parts.append({"part": p, "sids": cur, "f0": f0, "f1": f0 + run - 1, "frames": run})
            p += 1; f0 += run; cur, run = [], 0
        cur.append(s); run += n
    parts.append({"part": p, "sids": cur, "f0": f0, "f1": f0 + run - 1, "frames": run})
    return parts

# ---- word gesture ---------------------------------------------------------
# The J_A3-02 pilot proved that pv5's gesture cannot be applied blindly.  pv5
# made THREE glyphs travel into ONE point, because its script line is "나는 어떤
# 역할을 반복해 왔는가" -- the same word repeating across three project documents.
# Used on a shot whose script says something else, the three glyphs pile up and
# the generator renders the pile as red scribble.  So the gesture is derived from
# the shot's own words:
#   converge -> the script itself speaks of repetition across the three projects
#   none     -> the shot is forbidden to add new information (recap / breathing)
#               or it is a report page (ACT8 has no word at all)
#   lift     -> default: ONE word rises in place on one document
CONVERGE_KEYS = ("반복", "세 프로젝트", "3개 프로젝트", "같은 역할", "공통")
NONE_KEYS = ("새 정보 금지", "읽히는 글자 금지")

# ---- gaze target (lesson 168) ---------------------------------------------
# camtab.py gave every shot the same tgt_end z=0.77.  That was correct only for
# the converge gesture, where the glyphs actually travel up to z=0.92.  On a
# lift/none shot the camera ends up looking at empty air above the desk and the
# documents slide out of the bottom of the frame -- exactly what the J_A3-02
# pilot showed.  So the gaze end is derived from what the glyph actually does.
TGT_END = {
    "converge": [0.0, -0.35, 0.77],   # glyphs meet at z=0.92, look up with them
    "lift":     [0.0, -0.45, 0.30],   # one glyph rises ~0.34, stay on the paper
    "none":     [0.0, -0.50, 0.20],   # no glyph at all, hold the desk surface
}


def gesture_of(row_src, cam_row):
    if cam_row["seam_id"].startswith("A8"):
        return "none"
    p = row_src.get("protect") or ""
    if any(k in p for k in NONE_KEYS):
        return "none"
    blob = " ".join([cam_row.get("narr_line") or "", cam_row.get("objects") or "",
                     cam_row.get("motion_reason") or ""])
    if any(k in blob for k in CONVERGE_KEYS):
        return "converge"
    return "lift"


def act_of(sid):
    return sid.split("-")[0]


def main():
    d = json.load(open(CAM))
    rows = d["rows"]
    by_sid = {r["seam_id"]: r for r in rows}
    order = [r["seam_id"] for r in rows]
    src = {r["sid"]: r for r in json.load(open(ROWS))["rows"]}
    missing_src = [s for s in order if s not in src]
    if missing_src:
        raise SystemExit(f"camtab shots absent from rows38.json: {missing_src}")
    gest = {s: gesture_of(src[s], by_sid[s]) for s in order}

    # group by ACT, keep source order
    groups = {}
    for sid in order:
        groups.setdefault(act_of(sid), []).append(sid)

    jobs = []
    for act, sids in groups.items():
        anchors = [s for s in sids if by_sid[s]["feasible"]]
        if not anchors:
            raise SystemExit(f"ACT {act} has no feasible shot -- cannot weld")
        # assign every sid to an anchor
        assign = {a: [a] for a in anchors}
        for s in sids:
            if by_sid[s]["feasible"]:
                continue
            i = sids.index(s)
            prev = next((sids[j] for j in range(i - 1, -1, -1) if by_sid[sids[j]]["feasible"]), None)
            nxt = next((sids[j] for j in range(i + 1, len(sids)) if by_sid[sids[j]]["feasible"]), None)
            host = prev or nxt
            assign[host].append(s)
        for a in anchors:
            members = sorted(assign[a], key=lambda s: sids.index(s))
            frames = sum(by_sid[s]["frames"] for s in members)
            hold_frames = MIN_HOLD_FRAMES
            if hold_frames / frames > MAX_HOLD:
                hold_frames = int(frames * MAX_HOLD)
            slices, cur = [], 0
            for s in members:
                n = by_sid[s]["frames"]
                slices.append({"sid": s, "f0": cur, "f1": cur + n - 1, "frames": n,
                               "anchor": s == a})
                cur += n
            frames_of = {s: by_sid[s]["frames"] for s in members}
            parts = split_parts(members, frames_of)
            ar = by_sid[a]
            g = gest[a]
            # which of the three documents the single glyph rises from; rotated
            # by source position so consecutive lift shots do not all use the
            # middle sheet
            # The document that carries the rising word must be the CENTRE one.
            # Round-robin "ABC"[i % 3] put two thirds of the lift shots on the
            # left or right sheet, and the projection check measured the glyph
            # crossing the frame edge on 30 of 51 jobs (worst 4.10 of 1.00) --
            # a word sliced by the frame edge is exactly the "저급" typography
            # the CEO rejected.  Sweeping the camera moves the OUTER sheets off
            # screen, the centre sheet never leaves it: with doc B the worst
            # case across all 46 lift jobs is 0.52 of the frame half-width,
            # i.e. 48% margin, while the ink still holds 237 px minimum.
            doc = "B" if g == "lift" else ""
            jobs.append({
                "job_id": f"J_{a}",
                "act": act,
                "anchor": a,
                "sids": members,
                "welded": [s for s in members if s != a],
                "parts": parts,
                "n_parts": len(parts),
                "frames": frames,
                "duration_s": round(frames / FPS, 3),
                "hold_frames": hold_frames,
                "hold_frac": round(hold_frames / frames, 3),
                "plate": ar["plate"],
                "level": ar["level"],
                "verb": ar["verb"],
                "arc_deg": ar["arc_deg"],
                "cam_start_xyz": ar["cam_start_xyz"],
                "cam_end_xyz": ar["cam_end_xyz"],
                "tgt_start_xyz": ar["tgt_start_xyz"],
                "tgt_end_xyz": TGT_END[g],
                "word_gesture": g,
                "word_doc": doc,
                "member_gestures": {s: gest[s] for s in members},
                "narr": " ".join([(by_sid[s].get("narr_line") or "").strip() for s in members]).strip(),
                "motion_reason": ar["motion_reason"],
                "objects": ar.get("objects") or "",
            })

    # keep jobs in source order of their anchor
    jobs.sort(key=lambda j: order.index(j["anchor"]))

    # ---- gate ------------------------------------------------------------
    bad = []
    seen = set()
    for j in jobs:
        if j["frames"] < MIN_HOLD_FRAMES / MAX_HOLD - 0.5:
            bad.append(f"{j['job_id']} too short after weld ({j['frames']}f)")
        if j["hold_frames"] < 1:
            bad.append(f"{j['job_id']} hold_frames {j['hold_frames']}")
        if not j["motion_reason"].strip():
            bad.append(f"{j['job_id']} motion_reason empty")
        if j["word_gesture"] not in TGT_END:
            bad.append(f"{j['job_id']} bad gesture {j['word_gesture']}")
        if j["tgt_end_xyz"] != TGT_END[j["word_gesture"]]:
            bad.append(f"{j['job_id']} tgt_end does not match gesture")
        if (j["word_gesture"] == "lift") != bool(j["word_doc"]):
            bad.append(f"{j['job_id']} word_doc/gesture mismatch")
        # every v2v call must be inside the 15 s ceiling and still a legal shot
        if sum(p["frames"] for p in j["parts"]) != j["frames"]:
            bad.append(f"{j['job_id']} parts do not sum to frames")
        cur = 0
        for p in j["parts"]:
            if p["frames"] > MAX_V2V_FRAMES:
                bad.append(f"{j['job_id']} part {p['part']} {p['frames']}f exceeds 15s")
            if p["frames"] < MIN_JOB_FRAMES:
                bad.append(f"{j['job_id']} part {p['part']} {p['frames']}f under 3.04s")
            if p["f0"] != cur:
                bad.append(f"{j['job_id']} part {p['part']} f0 gap")
            cur = p["f1"] + 1
        flat = [s for p in j["parts"] for s in p["sids"]]
        if flat != j["sids"]:
            bad.append(f"{j['job_id']} part sids != job sids")
        for s in j["sids"]:
            if s in seen:
                bad.append(f"{s} assigned twice")
            seen.add(s)
    missing = [s for s in order if s not in seen]
    if missing:
        bad.append(f"unassigned shots: {missing}")
    if bad:
        raise SystemExit("PLAN GATE FAILED (%d):\n  " % len(bad) + "\n  ".join(bad[:20]))

    tot = sum(j["frames"] for j in jobs)
    json.dump({"version": 1, "fps": FPS, "jobs": jobs}, open(OUT, "w"),
              ensure_ascii=False, indent=1)
    print(f"PLAN OK  shots {len(order)} -> jobs {len(jobs)}")
    print(f"  welded shots {sum(len(j['welded']) for j in jobs)}")
    print(f"  frames {tot} = {tot/FPS:.1f}s  est render {tot*0.207/60:.1f} min")
    print(f"  jobs with weld: {[j['job_id'] for j in jobs if j['welded']][:12]}")
    print(f"  hold_frac range {min(j['hold_frac'] for j in jobs):.3f} - {max(j['hold_frac'] for j in jobs):.3f}")
    import collections
    gc = collections.Counter(j["word_gesture"] for j in jobs)
    print(f"  gestures {dict(gc)}")
    calls = sum(j["n_parts"] for j in jobs)
    split = [f"{j['job_id']}({j['n_parts']})" for j in jobs if j["n_parts"] > 1]
    print(f"  v2v calls {calls}  split jobs {split}")
    print(f"  longest part {max(p['frames'] for j in jobs for p in j['parts'])}f")
    print(f"  converge jobs {[j['job_id'] for j in jobs if j['word_gesture']=='converge']}")
    print(f"  none jobs     {[j['job_id'] for j in jobs if j['word_gesture']=='none']}")
    print(f"  wrote {OUT}")


if __name__ == "__main__":
    main()
