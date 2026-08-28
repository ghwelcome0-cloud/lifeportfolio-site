#!/usr/bin/env python3
"""
longcut.py -- assemble the LONGFORM DELIVERABLE (not a previz review cut).

Why this file exists, and why it is NOT previzcut.py
---------------------------------------------------
previzcut.py builds a cut for the CEO to *review the simulation*. Everything
that makes it good at that job makes it unpublishable:

    intro slate           "this is a previz"
    ROUGH PREVIZ tag      "this is not finished"
    shot ID readout       "give me feedback on shot 12"
    running timecode      "tell me the second"
    HEAD (3608 f)         3 acts of older real footage stitched in front

[CEO-85] closed that phase:

    "이제는 프래비즈를 넘어서 영상으로 제작하세요."

A video that says ROUGH PREVIZ in the corner is still a previz, no matter how
good the picture is. So this file removes every review affordance and keeps
only what an audience needs: picture, narration, subtitles.

[CEO-67] rejections 1 and 2 point the same way:

    1. 짜깁기          -> stop stitching unrelated footage together
    2. 헤드 소재 폐기   -> discard act0 / act1-2 / head.mp4

So HEAD is gone. The deliverable is the designed 3D-motion material only,
end to end, which is exactly what [CEO-67] rejection 5 (동일 모션 + 씬 부재)
was asking us to earn the right to show.

The four modifications this file implements
------------------------------------------
  (1) HEAD removed              -- no real-footage prefix, no 짜깁기
  (2) TOTAL 12000 hard gate off -- length is whatever the scene jobs are;
                                   we no longer bend the cut to fit a grid
                                   that only existed because HEAD was there
  (3) cyan neon subtitles       -- the rim/core grammar of the approved
                                   reference plates, same as shorts916.py
  (4) narration offset          -- audio is cut from the master 500 s wav at
                                   the first job's t0, and its length is
                                   derived from RENDERED FRAMES / FPS
                                   (lesson 221 -- never from script `dur`)

Source of truth
---------------
JOBS = scenejobs.json (76 jobs, carries t0/t1), NOT jobs.json (60 legacy jobs
with no timing). previzcut.py still reads the legacy file; that is one more
reason not to have edited it in place.

Usage
    python3 -u longcut.py map      # arithmetic + existence only, free
    python3 -u longcut.py film     # silent picture, no overlays
    python3 -u longcut.py deliver  # + narration + cyan neon subtitles
"""
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
R3D = "/home/user/lf/r3d"
BATCH = os.path.join(R3D, "_batch")
JOBS = os.path.join(R3D, "scenejobs.json")          # 76 jobs, has t0/t1

AUDIO = "/home/user/lf/inbox/rd/v14_audio_500s.wav"
SRT = "/home/user/lf/inbox/rd/v14_500s_v2.srt"

WORK = os.path.join(HERE, "_long")
FPS = 24
FONT = "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf"

# Cyan neon plate grammar, identical constants to shorts916.py so the longform
# and the shorts read as one channel. ASS colours are &HAABBGGRR.
#   RIM  = (140, 201, 206) -> BGR CE C9 8C
#   INK  = (241, 241, 241) -> BGR F1 F1 F1
SUB_INK = "&H00F1F1F1"
SUB_RIM = "&H00CEC98C"
SUB_SHADOW = "&HB0000000"
SUB_PT = 26
SUB_MARGIN_V = 46


def sh(cmd, tag):
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0:
        sys.stderr.write("FAILED %s\n%s\n" % (tag, p.stderr[-3000:]))
        raise SystemExit(1)
    return p


def nframes(path):
    p = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0",
                        "-count_frames", "-show_entries", "stream=nb_read_frames",
                        "-of", "csv=p=0", path], capture_output=True, text=True)
    try:
        return int(p.stdout.strip())
    except ValueError:
        return -1


def duration(path):
    p = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                        "format=duration", "-of", "csv=p=0", path],
                       capture_output=True, text=True)
    try:
        return float(p.stdout.strip())
    except ValueError:
        return -1.0


def jobs():
    d = json.load(open(JOBS, encoding="utf-8"))
    return d["jobs"] if isinstance(d, dict) else d      # dict at top level


def plan():
    """Ordered (job, src, want_frames). One previz mp4 per job."""
    rows = []
    for j in jobs():
        rows.append({"job": j["job_id"], "act": j["act"],
                     "src": os.path.join(BATCH, j["job_id"] + ".mp4"),
                     "want": int(j["frames"]),
                     "t0": j.get("t0"), "t1": j.get("t1"),
                     "narr": j.get("narr", "")})
    return rows


def cmd_map():
    rows = plan()
    tot = sum(r["want"] for r in rows)
    t0 = rows[0]["t0"]
    print("longform pieces %d   planned frames %d = %.3f s" % (len(rows), tot, tot / FPS))
    print("first job %s  t0 %.2f s   last job %s  t1 %.2f s"
          % (rows[0]["job"], t0, rows[-1]["job"], rows[-1]["t1"]))

    # [lesson 222]  Existence is NOT freshness.  A piece can be on disk and still
    # have been rendered from an OLDER scenejobs generation, in which case its
    # frame count no longer matches what the script declares.  That surplus is
    # invisible until concat, where it silently desyncs the narration (we lost
    # 931 f = 38.8 s that way).  So MAP checks FRAME COUNT, not existence.
    missing, stale = [], []
    for r in rows:
        if not os.path.exists(r["src"]):
            missing.append(r)
            continue
        got = nframes(r["src"])
        if got != r["want"]:
            r["got"] = got
            stale.append(r)
    if missing or stale:
        for r in missing:
            print("  MISSING %s -> %s" % (r["job"], r["src"]))
        for r in stale:
            print("  STALE   %s  want %4d f  got %4d f  (delta %+d)"
                  % (r["job"], r["want"], r["got"], r["got"] - r["want"]))
        if stale:
            print("  re-render list: %s" % ",".join(r["job"] for r in stale))
        print("MAP FAILED  %d missing + %d stale of %d pieces"
              % (len(missing), len(stale), len(rows)))
        return 1

    # (4) narration offset. Audio available from t0 to the end of the master wav.
    adur = duration(AUDIO)
    avail = adur - t0
    print("audio %s  %.6f s   available from t0 %.2f -> %.6f s (%d f)"
          % (os.path.basename(AUDIO), adur, t0, avail, int(avail * FPS)))

    # (2) No TOTAL hard gate. The only constraint left is physical: we cannot
    # narrate frames we have no audio for. Trim the surplus off the TAIL, which
    # is J_A8-GAP, a held end card -- the one place where no boundary matters.
    keep = min(tot, int(avail * FPS))
    trim = tot - keep
    print("keep %d f = %.6f s   tail trim %d f (%.3f s)" % (keep, keep / FPS, trim, trim / FPS))
    if trim < 0:
        print("MAP FAILED  negative trim")
        return 1
    if trim > FPS:
        print("MAP FAILED  tail trim %d f exceeds 1 s; investigate before cutting" % trim)
        return 1
    print("MAP OK  %d pieces -> %d f = %.6f s  (no HEAD, no 12000 grid)"
          % (len(rows), keep, keep / FPS))
    return 0


def _keep_frames():
    rows = plan()
    tot = sum(r["want"] for r in rows)
    avail = duration(AUDIO) - rows[0]["t0"]
    return rows, min(tot, int(avail * FPS))


def cmd_film():
    if cmd_map():
        return 1
    rows, keep = _keep_frames()
    tot = sum(r["want"] for r in rows)
    os.makedirs(WORK, exist_ok=True)

    lst = os.path.join(WORK, "body.txt")
    with open(lst, "w", encoding="utf-8") as f:
        for r in rows:
            f.write("file '%s'\n" % os.path.abspath(r["src"]))
    body = os.path.join(WORK, "body.mp4")
    print("· concat %d pieces (stream copy)" % len(rows))
    sh(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0",
        "-i", lst, "-c", "copy", body], "concat body")
    got = nframes(body)
    print("  body %d f (planned %d)" % (got, tot))
    if got != tot:
        print("FILM FAILED  concat produced %d f, jobs declare %d" % (got, tot))
        return 1

    out = os.path.join(WORK, "film.mp4")
    if keep == got:
        print("· no trim needed; re-encode to a single clean stream")
        sh(["ffmpeg", "-y", "-v", "error", "-i", body,
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
            "-pix_fmt", "yuv420p", "-r", str(FPS), "-an", out], "encode film")
    else:
        print("· trim tail %d -> %d f" % (got, keep))
        sh(["ffmpeg", "-y", "-v", "error", "-i", body,
            "-vf", "select='lt(n\\,%d)',setpts=N/%d/TB" % (keep, FPS),
            "-r", str(FPS), "-c:v", "libx264", "-preset", "veryfast",
            "-crf", "20", "-pix_fmt", "yuv420p", "-an", out], "trim film")
    n = nframes(out)
    print("film %d f = %.6f s  %d B -> %s" % (n, n / FPS, os.path.getsize(out), out))
    if n != keep:
        print("FILM FAILED  %d f, wanted %d" % (n, keep))
        return 1
    print("FILM OK  %d f = %.6f s" % (n, n / FPS))
    return 0


_TC = re.compile(r"(\d\d):(\d\d):(\d\d),(\d\d\d)")


def _tc2s(m):
    return int(m.group(1)) * 3600 + int(m.group(2)) * 60 + int(m.group(3)) + int(m.group(4)) / 1000.0


def _s2tc(s):
    if s < 0:
        s = 0.0
    h = int(s // 3600)
    m = int((s - h * 3600) // 60)
    sec = s - h * 3600 - m * 60
    return "%02d:%02d:%02d,%03d" % (h, m, int(sec), round((sec - int(sec)) * 1000))


def shift_srt(src, dst, offset, dur):
    """(4) Shift every cue by -offset, drop what falls outside [0, dur].

    A subtitle file written against the 500 s master is wrong the moment HEAD
    is removed: every cue is 150 s late. Lesson 221 in subtitle form -- if you
    change what the picture starts with, you must re-time everything that was
    keyed to the old start.
    """
    blocks = open(src, encoding="utf-8").read().replace("\r\n", "\n").strip().split("\n\n")
    out, idx = [], 0
    for b in blocks:
        lines = b.split("\n")
        ti = next((i for i, L in enumerate(lines) if "-->" in L), None)
        if ti is None:
            continue
        tcs = [_tc2s(m) for m in _TC.finditer(lines[ti])]
        if len(tcs) < 2:
            continue
        a, b2 = tcs[0] - offset, tcs[1] - offset
        if b2 <= 0 or a >= dur:
            continue
        a = max(a, 0.0)
        b2 = min(b2, dur)
        idx += 1
        body = "\n".join(lines[ti + 1:]).strip()
        if not body:
            continue
        out.append("%d\n%s --> %s\n%s" % (idx, _s2tc(a), _s2tc(b2), body))
    open(dst, "w", encoding="utf-8").write("\n\n".join(out) + "\n")
    return idx


def cmd_deliver():
    film = os.path.join(WORK, "film.mp4")
    if not os.path.exists(film):
        print("DELIVER FAILED  run `film` first (%s)" % film)
        return 1
    rows, keep = _keep_frames()
    n = nframes(film)
    if n != keep:
        print("DELIVER FAILED  film is %d f, plan says %d; re-run film" % (n, keep))
        return 1
    for p in (AUDIO, SRT, FONT):
        if not os.path.exists(p):
            print("DELIVER FAILED  missing %s" % p)
            return 1

    t0 = rows[0]["t0"]
    want = keep / float(FPS)                 # lesson 221: frames / FPS, not script dur

    # (4) narration: cut ONE contiguous segment, because unlike shorts C the
    # longform skips no job -- every scene job is present and in script order.
    narr = os.path.join(WORK, "narr.wav")
    print("· cut narration  t0 %.5f  len %.5f s" % (t0, want))
    sh(["ffmpeg", "-y", "-v", "error", "-ss", "%.5f" % t0, "-t", "%.5f" % want,
        "-i", AUDIO, "-ac", "2", "-ar", "48000", narr], "cut narration")
    got = duration(narr)
    print("  narration %.6f s   film %.6f s   delta %.6f s" % (got, want, got - want))
    if abs(got - want) > 0.05:
        print("DELIVER FAILED  narration/film mismatch %.6f s" % (got - want))
        return 1

    # (4) subtitles re-timed to the new zero
    srt2 = os.path.join(WORK, "sub.srt")
    cues = shift_srt(SRT, srt2, t0, want)
    print("· subtitles re-timed by -%.2f s  ->  %d cues" % (t0, cues))
    if cues == 0:
        print("DELIVER FAILED  no subtitle cues survived the offset")
        return 1

    # (3) cyan neon subtitles -- rim + core, the grammar of the approved plates.
    # No slate, no ROUGH PREVIZ tag, no shot ID, no timecode: this is a video,
    # not a review cut. [CEO-85]
    vf = ("subtitles='%s':force_style='FontName=NanumGothic Bold,FontSize=%d,"
          "PrimaryColour=%s,OutlineColour=%s,BackColour=%s,BorderStyle=1,"
          "Outline=2,Shadow=2,MarginV=%d,MarginL=70,MarginR=70,Alignment=2'"
          % (srt2, SUB_PT, SUB_INK, SUB_RIM, SUB_SHADOW, SUB_MARGIN_V))

    out = os.path.join(HERE, "longform_deliver.mp4")
    print("· burn cyan neon subtitles + mux narration")
    sh(["ffmpeg", "-y", "-v", "error", "-i", film, "-i", narr,
        "-vf", vf, "-map", "0:v:0", "-map", "1:a:0",
        "-c:v", "libx264", "-preset", "medium", "-crf", "21",
        "-pix_fmt", "yuv420p", "-r", str(FPS),
        "-c:a", "aac", "-b:a", "192k", "-shortest", out], "deliver")

    nn = nframes(out)
    print("deliver %d f  %.6f s  %d B" % (nn, duration(out), os.path.getsize(out)))
    if nn != keep:
        print("DELIVER FAILED  %d f, wanted %d" % (nn, keep))
        return 1
    print("DELIVER OK  %s" % out)
    return 0


if __name__ == "__main__":
    c = sys.argv[1] if len(sys.argv) > 1 else "map"
    raise SystemExit({"map": cmd_map, "film": cmd_film,
                      "deliver": cmd_deliver}.get(c, cmd_map)())
