#!/usr/bin/env python3
"""Ledger + slicing helpers for the 60-job Video-to-Video pass.

The generation calls themselves are made by the agent (they are paid tool calls,
not shell commands), so this file does the parts that must be exact:

  * ledger    : which CALLS are still missing a v2v result  -> v2v_ledger.json
  * verify    : a downloaded v2v mp4 has the frame count the call demands
  * slice     : cut a welded job back into its member shots at frame boundaries
  * audit     : arithmetic proof that every seam is covered exactly once

The unit of work is a CALL, not a job.  59 jobs are one call each and J_A6-02
is two (460 frames exceeds the 360-frame / 15 s generation ceiling), so the
pass is 61 calls.  Every command below therefore takes an optional part index.

Usage
  python3 -u v2v.py ledger
  python3 -u v2v.py plates
  python3 -u v2v.py audit
  python3 -u v2v.py verify <job_id> <mp4> [part]
  python3 -u v2v.py slice  <job_id> <mp4> [part]
"""
import json, os, subprocess, sys, math

JOBS = "/home/user/lf/r3d/jobs.json"
PROMPTS = "/home/user/lf/r3d/prompts.json"
V2V = "/home/user/lf/r3d/_v2v"
SEG = "/home/user/lf/r3d/_seg"
LEDGER = "/home/user/lf/r3d/v2v_ledger.json"
FPS = 24
LAND = "/home/user/lf/land38"

# S24/S25/S26 are NOT generated stills.  They are folios 03/05/08 of the real
# issued report, photographed from our own report engine (drive38.py REPORT_PAGE).
# mkcanvas38.py already laid each portrait folio onto a 16:9 film field, so the
# usable plate is canvas/<anchor>_tall.png -- the raw report_p0*.png is portrait
# (0.62) and would be rejected by the 16:9 gate.
CANVAS = {"S24", "S25", "S26"}


def plate_path(anchor):
    if anchor in CANVAS:
        p = os.path.join(LAND, "canvas", anchor + "_tall.png")
        if not os.path.exists(p):
            raise SystemExit("missing report canvas for %s: %s" % (anchor, p))
        return p
    p = os.path.join(LAND, anchor + ".png")
    if not os.path.exists(p):
        raise SystemExit("missing plate for %s: %s" % (anchor, p))
    return p


def jobs():
    return {j["job_id"]: j for j in json.load(open(JOBS))["jobs"]}


def cmd_plates():
    """prove every job's texture reference exists BEFORE any paid call"""
    from PIL import Image
    J = jobs()
    seen, bad = {}, []
    for jid, j in sorted(J.items()):
        p = plate_path(j["plate"])
        if p not in seen:
            w, h = Image.open(p).size
            seen[p] = (w, h, round(w / h, 3))
            if abs(w / h - 16 / 9) > 0.02:
                bad.append("%s %s not 16:9 (%dx%d)" % (j["plate"], p, w, h))
    if bad:
        raise SystemExit("PLATE GATE FAILED:\n  " + "\n  ".join(bad))
    print("PLATE GATE OK  jobs %d  distinct plates %d" % (len(J), len(seen)))
    for p, (w, h, r) in sorted(seen.items()):
        print("  %-52s %dx%d %.3f" % (os.path.basename(p), w, h, r))


def fcount(p):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0",
                        "-count_frames", "-show_entries", "stream=nb_read_frames",
                        "-of", "csv=p=0", p], capture_output=True, text=True, check=True)
    return int(r.stdout.strip())


def parts_of(j):
    """the calls this job costs -- always a list, even for a single-part job"""
    p = j.get("parts")
    if not p:
        return [{"part": 1, "sids": list(j["sids"]), "f0": 0,
                 "f1": j["frames"] - 1, "frames": j["frames"]}]
    return p


def call_id(jid, p, n_parts):
    return jid if n_parts == 1 else "%s_p%d" % (jid, p["part"])


def cmd_ledger():
    J = jobs()
    os.makedirs(V2V, exist_ok=True)
    rows = []
    for jid, j in sorted(J.items()):
        ps = parts_of(j)
        prev = "/home/user/lf/r3d/_batch/%s.mp4" % jid
        for p in ps:
            cid = call_id(jid, p, len(ps))
            got = os.path.join(V2V, "%s.mp4" % cid)
            rows.append({"call_id": cid, "job_id": jid, "part": p["part"],
                         "n_parts": len(ps), "act": j["act"],
                         "sids": p["sids"],
                         "f0": p["f0"], "f1": p["f1"], "frames": p["frames"],
                         "duration_s": round(p["frames"] / float(FPS), 3),
                         "plate": j["plate"],
                         "previz": prev, "previz_ready": os.path.exists(prev),
                         "v2v": got, "done": os.path.exists(got)})
    todo = [r for r in rows if r["previz_ready"] and not r["done"]]
    blocked = [r for r in rows if not r["previz_ready"] and not r["done"]]
    json.dump({"version": 2, "rows": rows}, open(LEDGER, "w"), ensure_ascii=False, indent=1)
    print("calls %d  previz ready %d  v2v done %d  todo %d  blocked %d"
          % (len(rows), sum(r["previz_ready"] for r in rows),
             sum(r["done"] for r in rows), len(todo), len(blocked)))
    print("billed seconds if all todo run: %.1f"
          % sum(r["duration_s"] for r in todo))
    print("next 6:", [r["call_id"] for r in todo[:6]])


def _pick(j, part):
    ps = parts_of(j)
    if part is None:
        if len(ps) > 1:
            raise SystemExit("%s has %d parts -- pass the part index"
                             % (j["job_id"], len(ps)))
        return ps[0], len(ps)
    for p in ps:
        if p["part"] == int(part):
            return p, len(ps)
    raise SystemExit("%s has no part %s" % (j["job_id"], part))


def cmd_verify(jid, mp4, part=None):
    j = jobs()[jid]
    p, n_parts = _pick(j, part)
    n = fcount(mp4)
    ok = n >= p["frames"]
    print("%s  want %df  got %df  %s"
          % (call_id(jid, p, n_parts), p["frames"], n, "OK" if ok else "SHORT"))
    if not ok:
        raise SystemExit(1)


ROWS = "/home/user/lf/work/longform/rows38.json"


def grid():
    """the ONE authoritative frame budget per shot: the 24 fps timeline itself

    Two numbers disagreed by 0.278 s and it took a long time to find out why:

      sum of rows38 t1-t0        349.680000 s
      sum of camtab frames 8399  349.958333 s

    Neither is wrong.  camtab rounded each shot's duration to a whole frame
    INDEPENDENTLY -- 53 shots rounded up, 26 down -- and 6.68 frames of
    rounding accumulated.  Absorbing that at the end (a 0.28 s stretch, or a
    7-frame trim on the last cut) treats a symptom.

    The cure is to stop deriving the length from durations at all.  A cut's
    length is the DIFFERENCE OF ITS GRID INDICES:

        n = round(t1*24) - round(t0*24)

    Rounding then cancels at every boundary instead of accumulating, because
    shot k's end index IS shot k+1's start index.  Measured result: zero gaps,
    zero overlaps, and the whole film lands on frame 12000 = 500.000000 s
    exactly, against an audio master of 500.010667 s -- a residue of 0.256 of
    one frame, which is below the quantum a 24 fps video can express.
    """
    return {r["sid"]: (int(round(r["t0"] * FPS)), int(round(r["t1"] * FPS)))
            for r in json.load(open(ROWS))["rows"]}


def _motion(mp4, a, b, w=160, h=90):
    """mean |pixel difference| between consecutive frames of one shot

    The grid asks 19 of the 60 jobs for a frame more or less than the renderer
    produced, so a frame must be dropped or repeated -- and WHERE decides
    whether the viewer sees it.  Measured on J_A3-07:

        hold region   (n <= 29)   0.0010
        motion region (n >  29)   1.2300      <- 1230x larger

    The obvious rule -- "edit inside the hold" -- is wrong for welded jobs.
    The hold sits at the start of the JOB, so only the first member shot has a
    parked camera; shots 2 and 3 of J_A5-03 are pure motion, and picking
    hold-1 there lands the edit in the middle of a pan.  So do not reason
    about where the quiet frames ought to be: measure them.
    """
    from PIL import Image, ImageChops
    p = subprocess.run(["ffmpeg", "-v", "error", "-i", mp4, "-vf",
                        "select='between(n\\,%d\\,%d)',scale=%d:%d,format=gray"
                        % (a, b, w, h), "-vsync", "0", "-f", "rawvideo", "-"],
                       capture_output=True, check=True)
    buf, n = p.stdout, len(p.stdout) // (w * h)
    out = []
    for i in range(1, n):
        p0 = Image.frombytes("L", (w, h), buf[(i - 1) * w * h:i * w * h])
        p1 = Image.frombytes("L", (w, h), buf[i * w * h:(i + 1) * w * h])
        hist = ImageChops.difference(p1, p0).histogram()
        out.append(sum(v * k for k, v in enumerate(hist)) / float(w * h))
    return out


def _fit(n_have, n_want, mot):
    """the filter that lands a shot of n_have frames on exactly n_want

    Returns (filter_fragment, edit_index, motion_at_edit) or None.

    A drop is expressed as a select veto, and a repeat CANNOT be: the select
    filter only passes or discards frames, it never duplicates one, and a
    150-term eq() chain also overruns the expression parser.  Duplication is
    the loop filter's job.
    """
    d = n_want - n_have
    if d == 0:
        return None
    if abs(d) > 2:
        raise SystemExit("FIT GATE FAILED: %d -> %d is a %+df change, too "
                         "large to hide" % (n_have, n_want, d))
    if not mot:
        raise SystemExit("FIT GATE FAILED: no motion measurement")
    quiet = sorted(range(len(mot)), key=lambda i: mot[i])
    if d < 0:
        # drop the frames whose arrival changed the least: transition i is
        # between frame i and i+1, so dropping frame i+1 is what is invisible.
        picks = sorted(quiet[:-d])
        idx = [i + 1 for i in picks]
        veto = "+".join("eq(n\\,%d)" % i for i in idx)
        return "select='not(%s)'" % veto, idx, max(mot[i] for i in picks)
    k = quiet[0] + 1
    return ("loop=loop=%d:size=1:start=%d" % (d, k), [k], mot[quiet[0]])


def cmd_slice(jid, mp4, part=None):
    """cut a welded job back into its member shots -- exact frame boundaries

    The frame numbers in _slices() are indices into the WHOLE job, but a
    multi-part job is generated as several independent mp4s: part 2 of
    J_A6-02 covers job frames 322..459 while the file itself only holds
    frames 0..137.  Feeding the job-space numbers to ffmpeg selects nothing
    and writes an empty file without any error, so the offset has to be
    subtracted here and the result has to be counted, not assumed.

    Each shot is then snapped to its grid length (see grid()), so the 80
    segments concatenate to exactly 12000 frames with no drift to absorb
    later.  The snap is done HERE rather than in a later pass because a gate
    kept in a second file always drifts out of step with the code (lesson 176).
    """
    j = jobs()[jid]
    p, n_parts = _pick(j, part)
    have = fcount(mp4)
    if have < p["frames"]:
        raise SystemExit("SLICE GATE FAILED %s: mp4 has %df, part needs %df"
                         % (call_id(jid, p, n_parts), have, p["frames"]))
    os.makedirs(SEG, exist_ok=True)
    G = grid()
    base = p["f0"]                      # job-space index of this file's frame 0
    for sl in _slices(j):
        if sl["sid"] not in p["sids"]:
            continue
        a, b = sl["f0"] - base, sl["f1"] - base
        if a < 0 or b >= have:
            raise SystemExit("SLICE GATE FAILED %s/%s: local range %d..%d "
                             "outside 0..%d" % (jid, sl["sid"], a, b, have - 1))
        if sl["sid"] not in G:
            raise SystemExit("SLICE GATE FAILED %s: no grid row" % sl["sid"])
        g0, g1 = G[sl["sid"]]
        want = g1 - g0
        cut = b - a + 1
        out = os.path.join(SEG, "%s.mp4" % sl["sid"])
        sel = "select='between(n\\,%d\\,%d)',setpts=N/TB" % (a, b)
        mot = _motion(mp4, a, b) if cut != want else None
        fit = _fit(cut, want, mot)
        note = ""
        if fit is None:
            vf = "%s,setpts=N/%d/TB" % (sel, FPS)
        else:
            frag, idx, m = fit
            vf = "%s,%s,setpts=N/%d/TB" % (sel, frag, FPS)
            note = ("  snapped %+d at local %s (motion %.4f vs shot mean %.4f)"
                    % (want - cut, idx, m, sum(mot) / len(mot)))
        # setpts=N/FPS/TB already re-stamps every kept frame onto an exact
        # 24 fps grid, so -r is the only rate flag needed; adding -vsync 0 on
        # top of it makes ffmpeg refuse the command as contradictory.
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", mp4,
                        "-vf", vf,
                        "-r", str(FPS), "-c:v", "libx264", "-pix_fmt", "yuv420p",
                        "-crf", "16", "-an", out], check=True)
        got = fcount(out)
        if got != want:
            raise SystemExit("SLICE GATE FAILED %s: wrote %df, want %df "
                             "(cut %df, grid %d..%d)"
                             % (sl["sid"], got, want, cut, g0, g1))
        print("%-14s job %4d..%-4d local %4d..%-4d cut %3df -> grid %5d..%-5d "
              "%3df%s" % (sl["sid"], sl["f0"], sl["f1"], a, b, cut, g0, g1,
                          got, note))


def _slices(j):
    cam = {r["seam_id"]: r for r in json.load(open("/home/user/lf/r3d/camtab.json"))["rows"]}
    out, cur = [], 0
    for sid in j["sids"]:
        n = cam[sid]["frames"]
        out.append({"sid": sid, "f0": cur, "f1": cur + n - 1})
        cur += n
    return out


def cmd_audit():
    """arithmetic proof, before any paid call, that the plan is self-consistent

    Every failure this catches is one that would otherwise surface only after
    the 61 paid generations, when the 500 s assembly comes out the wrong length
    or a seam is silently missing.
    """
    cam = {r["seam_id"]: r for r in json.load(open("/home/user/lf/r3d/camtab.json"))["rows"]}
    J = jobs()
    bad, seen, total, calls, billed = [], {}, 0, 0, 0.0
    for jid, j in sorted(J.items()):
        ps = parts_of(j)
        calls += len(ps)
        total += j["frames"]
        if sum(cam[s]["frames"] for s in j["sids"]) != j["frames"]:
            bad.append("%s: sid frames != job frames" % jid)
        if sum(p["frames"] for p in ps) != j["frames"]:
            bad.append("%s: part frames != job frames" % jid)
        cur = 0
        for p in ps:
            if p["f0"] != cur:
                bad.append("%s part%d: f0 %d != %d" % (jid, p["part"], p["f0"], cur))
            if p["f1"] - p["f0"] + 1 != p["frames"]:
                bad.append("%s part%d: f0..f1 != frames" % (jid, p["part"]))
            if p["frames"] > 360:
                bad.append("%s part%d: %df exceeds the 360f ceiling"
                           % (jid, p["part"], p["frames"]))
            if p["frames"] < 73:
                bad.append("%s part%d: %df below the 73f floor"
                           % (jid, p["part"], p["frames"]))
            cur += p["frames"]
            billed += p["frames"] / float(FPS)
        # a part must not cut a seam in half
        edges, run = set(), 0
        for s in j["sids"]:
            edges.add(run); run += cam[s]["frames"]
        for p in ps:
            if p["f0"] not in edges:
                bad.append("%s part%d starts mid-seam at %d" % (jid, p["part"], p["f0"]))
        for s in j["sids"]:
            seen[s] = seen.get(s, 0) + 1
    for s in cam:
        if seen.get(s, 0) != 1:
            bad.append("seam %s used %d times" % (s, seen.get(s, 0)))

    # ---- the grid: the number that actually has to come out right ---------
    G = grid()
    for s in cam:
        if s not in G:
            bad.append("seam %s has no grid row" % s)
    seq = sorted(G.items(), key=lambda kv: kv[1][0])
    for (sa, (a0, a1)), (sb, (b0, b1)) in zip(seq, seq[1:]):
        if b0 != a1:
            bad.append("grid discontinuity %s..%s: %d != %d" % (sa, sb, a1, b0))
    gsum = sum(g1 - g0 for g0, g1 in G.values())
    span = seq[-1][1][1] - seq[0][1][0]
    if gsum != span:
        bad.append("grid frames %d != span %d" % (gsum, span))
    # every snap must be small enough to hide inside a parked camera
    for jid, j in sorted(J.items()):
        for sl in _slices(j):
            g0, g1 = G[sl["sid"]]
            d = (g1 - g0) - (sl["f1"] - sl["f0"] + 1)
            if abs(d) > 2:
                bad.append("%s: grid snap %+df too large to hide" % (sl["sid"], d))
    if bad:
        raise SystemExit("AUDIT FAILED:\n  " + "\n  ".join(bad))
    print("AUDIT OK  jobs %d  calls %d  seams %d  frames %d = %.3f s  billed %.1f s"
          % (len(J), calls, len(cam), total, total / float(FPS), billed))
    print("GRID  OK  head %d f (%.3f s)  tail %d f (%.6f s)  video %d f  "
          "audio 500.010667 s  residue %.3f frame"
          % (seq[0][1][0], seq[0][1][0] / float(FPS), seq[-1][1][1],
             seq[-1][1][1] / float(FPS), gsum,
             (500.010667 - seq[-1][1][1] / float(FPS)) * FPS))





if __name__ == "__main__":
    a = sys.argv[1:]
    if not a or a[0] == "ledger":
        cmd_ledger()
    elif a[0] == "plates":
        cmd_plates()
    elif a[0] == "audit":
        cmd_audit()
    elif a[0] == "verify":
        cmd_verify(a[1], a[2], a[3] if len(a) > 3 else None)
    elif a[0] == "slice":
        cmd_slice(a[1], a[2], a[3] if len(a) > 3 else None)
    else:
        raise SystemExit(__doc__)
