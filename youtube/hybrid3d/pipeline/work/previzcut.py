#!/usr/bin/env python3
"""
previzcut.py -- build the PREVIZ SIMULATION cut for CEO review.

Why this file exists, and why it is NOT master500.py
----------------------------------------------------
master500.py owns the *final* 500 s grid: every ACT3~8 shot is a SLICE taken
out of a finished v2v clip, snapped to its own grid cell. That path is blocked
right now -- v2v has not run (61 calls todo), so there is nothing to slice.

The CEO asked for something different and cheaper: a previz cut he can watch
end to end to gauge the simulation, in the packaging style of the two Korean /
Seedance previz reels he sent (slate, corner label, running timecode, shot ID,
sound). Every frame that cut needs already exists on disk:

    head.mp4          3608 f  ACT0 + ACT1~2 + BRIDGE   (real footage, HEAD OK)
    _batch/*.mp4       8399 f  60 previz jobs           (BATCH GATE OK)
                     ------
                      12007 f

12007 is 7 frames over the 12000-frame (500.000 s) audio grid. Those 7 frames
are NOT drift and NOT a bug: the previz jobs are authored in JOB coordinates
(each job is an independent render with its own hold ramp), while the final
master lays the same material out in GRID coordinates via per-shot slices.
Lesson 178. For a simulation cut we do not need slice-accurate placement, we
need the narration to land on the right picture -- so the 7 surplus frames are
removed from the previz tail, which is the one place where nothing is riding on
an exact boundary (J_A8-GAP is a held end card).

Trimming the tail rather than spreading the loss keeps every earlier act frame
accurate against the narration, which is what the CEO is judging.

Overlays follow the two reference reels, not invention:
  - intro slate                       (ref 2: "귀공자 PREVIS" card)
  - persistent top-right project name (ref 2: movie title top-right)
  - bottom-left shot ID               (ref 2 advice: add shot numbers)
  - bottom-right running timecode     (ref 2 advice: running timecode)
  - top-left "ROUGH PREVIZ" stage tag (ref 1: "Rough Previs" label)
      shown ONLY over the previz half, so the CEO can see at a glance where
      real footage stops and previz begins -- that boundary is the single most
      useful piece of information in this deliverable.
  - narration + burned subtitles      (ref 2 advice: sound lets a non-technical
      viewer feel the pace)

Usage
    python3 -u previzcut.py map      # arithmetic only, free, no encode
    python3 -u previzcut.py film     # silent 12000 f picture
    python3 -u previzcut.py deliver  # + narration + burned subtitles
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
R3D = "/home/user/lf/r3d"
BATCH = os.path.join(R3D, "_batch")
JOBS = os.path.join(R3D, "jobs.json")

HEAD = os.path.join(HERE, "_m500", "head.mp4")
AUDIO = "/home/user/lf/inbox/rd/v14_audio_500s.wav"
SRT = "/home/user/lf/inbox/rd/v14_500s_v2.srt"

WORK = os.path.join(HERE, "_pvz")
FPS = 24
TOTAL = 12000                      # 500.000000 s
HEAD_F = 3608                      # HEAD OK, measured not assumed
FONT = "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf"
FONT_R = "/usr/share/fonts/truetype/nanum/NanumGothic.ttf"

SLATE_F = 0                        # slate is added in deliver, not in the grid


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


def jobs():
    d = json.load(open(JOBS, encoding="utf-8"))
    return d["jobs"]                      # LIST, not dict


def parts_of(j):
    """One previz mp4 per job -- n_parts is a v2v concept, not a previz one.

    My first version of this function split J_A6-02 into two files and the map
    gate immediately reported both as missing. The gate was right and I was
    wrong: `n_parts` records how the job must be CUT UP FOR BILLING when it is
    sent to the video model, because Seedance refuses more than 360 frames
    (15 s) in one call. Lesson 178 -- the unit of paid work is the CALL, not
    the job. The previz renderer never had that limit, so it wrote J_A6-02 as
    a single 460-frame file, which ffprobe confirms.

    Splitting here would also be actively wrong for this deliverable: the two
    v2v halves will be independent generations that have to be re-joined, and
    the whole point of the previz cut is to show the CEO the motion as it was
    DESIGNED -- one continuous 460-frame move through A6-01..A6-05.
    """
    return [(os.path.join(BATCH, j["job_id"] + ".mp4"), j["frames"])]


def plan():
    """Ordered list of (label, src, want_frames). Fails loudly on a gap."""
    rows = []
    for j in jobs():
        for src, want in parts_of(j):
            rows.append({"job": j["job_id"], "act": j["act"],
                         "sids": j["sids"], "src": src, "want": want,
                         "narr": j.get("narr", "")})
    return rows


def cmd_map():
    rows = plan()
    missing = [r for r in rows if not os.path.exists(r["src"])]
    tot = sum(r["want"] for r in rows)
    print("previz pieces %d   planned frames %d" % (len(rows), tot))
    if missing:
        for r in missing:
            print("  MISSING %s -> %s" % (r["job"], r["src"]))
        print("MAP FAILED  %d previz pieces are not on disk" % len(missing))
        return 1
    head = nframes(HEAD)
    print("head %s -> %d f" % (os.path.basename(HEAD), head))
    if head != HEAD_F:
        print("MAP FAILED  head is %d f, expected %d" % (head, HEAD_F))
        return 1
    raw = head + tot
    trim = raw - TOTAL
    print("raw %d f = %.3f s   target %d f   tail trim %+d f (%.3f s)"
          % (raw, raw / FPS, TOTAL, -trim, trim / FPS))
    if trim < 0:
        print("MAP FAILED  cut is SHORTER than the audio grid; refusing to pad")
        return 1
    if trim > FPS:
        print("MAP FAILED  tail trim %d f exceeds 1 s; investigate before cutting" % trim)
        return 1
    print("MAP OK  %d pieces + head land on %d f after trimming %d f from the tail"
          % (len(rows), TOTAL, trim))
    return 0


def cmd_film():
    rows = plan()
    if cmd_map():
        return 1
    os.makedirs(WORK, exist_ok=True)
    trim = (nframes(HEAD) + sum(r["want"] for r in rows)) - TOTAL

    # Concat the previz jobs first. Every piece shares codec/pix_fmt/tb with
    # head.mp4 (probed), so stream copy is valid and costs no quality.
    lst = os.path.join(WORK, "previz.txt")
    with open(lst, "w", encoding="utf-8") as f:
        for r in rows:
            f.write("file '%s'\n" % os.path.abspath(r["src"]))
    body = os.path.join(WORK, "previz_body.mp4")
    print("· concat %d previz pieces (stream copy)" % len(rows))
    sh(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0",
        "-i", lst, "-c", "copy", body], "concat previz")
    got = nframes(body)
    print("  previz body %d f" % got)

    # Trim the surplus off the tail. select cannot be trusted to be empty-safe,
    # so the output frame count is checked, not assumed.
    keep = got - trim
    tail = os.path.join(WORK, "previz_trim.mp4")
    print("· trim previz body %d -> %d f" % (got, keep))
    sh(["ffmpeg", "-y", "-v", "error", "-i", body,
        "-vf", "select='lt(n\\,%d)',setpts=N/%d/TB" % (keep, FPS),
        "-r", str(FPS), "-c:v", "libx264", "-preset", "veryfast",
        "-crf", "20", "-pix_fmt", "yuv420p", "-an", tail], "trim previz")
    if nframes(tail) != keep:
        print("FILM FAILED  trim produced %d f, wanted %d" % (nframes(tail), keep))
        return 1

    out = os.path.join(WORK, "film.mp4")
    lst2 = os.path.join(WORK, "film.txt")
    with open(lst2, "w", encoding="utf-8") as f:
        f.write("file '%s'\n" % os.path.abspath(HEAD))
        f.write("file '%s'\n" % os.path.abspath(tail))
    print("· concat head + previz")
    sh(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0",
        "-i", lst2, "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
        "-pix_fmt", "yuv420p", "-r", str(FPS), "-an", out], "concat film")
    n = nframes(out)
    print("film %d f = %.6f s -> %s" % (n, n / FPS, out))
    if n != TOTAL:
        print("FILM FAILED  %d f, wanted %d" % (n, TOTAL))
        return 1
    print("FILM OK  %d f = %.6f s" % (n, n / FPS))
    return 0


def _esc(s):
    """drawtext text= escaping. Colons and single quotes break the filter."""
    return s.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\u2019")


def overlay_chain():
    """Build the drawtext chain from the two reference reels' grammar.

    Reference 2 (귀공자 PREVIS) puts the project title in a persistent corner
    and its advice was explicit: add shot numbers and a running timecode so
    feedback can be given against a specific moment. Reference 1 labels the
    previz half "Rough Previs" so the unfinished look reads as a deliberate
    production stage rather than poor quality.

    The stage tag is deliberately shown ONLY from frame 3608 on. That boundary
    is the most useful single fact in this deliverable: before it the picture
    is real rendered footage, after it the picture is previz awaiting v2v. A
    label that ran the whole way would hide exactly what the CEO needs to see.
    """
    head_s = HEAD_F / FPS
    ch = []

    # persistent project name, top right (ref 2: movie title top-right)
    ch.append("drawtext=fontfile=%s:text='%s':fontsize=20:fontcolor=white@0.78"
              ":x=w-tw-24:y=22:box=1:boxcolor=black@0.42:boxborderw=8"
              % (FONT, _esc("인생포트폴리오 500초 롱폼")))

    # stage tag, top left, previz half only (ref 1: "Rough Previs")
    ch.append("drawtext=fontfile=%s:text='ROUGH PREVIZ':fontsize=20"
              ":fontcolor=0x7CE7FF@0.92:x=24:y=22:box=1:boxcolor=black@0.5"
              ":boxborderw=8:enable='gte(t,%.6f)'" % (FONT, head_s))

    # rendered-footage tag, top left, head half only
    ch.append("drawtext=fontfile=%s:text='%s':fontsize=20:fontcolor=white@0.85"
              ":x=24:y=22:box=1:boxcolor=black@0.5:boxborderw=8"
              ":enable='lt(t,%.6f)'" % (FONT, _esc("렌더 완료 구간"), head_s))

    # Running timecode and shot ID were originally on the bottom row, which is
    # where reference 2 puts them. That does not survive contact with our
    # footage: the bottom of the frame is now reserved for the subtitle plate
    # (see cmd_deliver), and the baked-in lightbox panel already reaches down to
    # 0.95 frame height in places. Both readouts therefore move to the second
    # row from the top, under the two tags, where nothing else competes.
    ch.append("drawtext=fontfile=%s:text='%%{pts\\:hms}':fontsize=18"
              ":fontcolor=white@0.72:x=w-tw-24:y=56:box=1"
              ":boxcolor=black@0.42:boxborderw=7" % FONT_R)

    # shot ID, bottom left (ref 2 advice: shot numbers)
    for i, j in enumerate(jobs()):
        f0 = HEAD_F + sum(x["frames"] for x in jobs()[:i])
        f1 = f0 + j["frames"]
        if f0 >= TOTAL:
            break
        lab = "%s  %s-%s  [%02d/60]" % (j["act"], j["sids"][0], j["sids"][-1], i + 1)
        ch.append("drawtext=fontfile=%s:text='%s':fontsize=18"
                  ":fontcolor=0x7CE7FF@0.85:x=24:y=56:box=1"
                  ":boxcolor=black@0.45:boxborderw=7"
                  ":enable='between(t,%.6f,%.6f)'"
                  % (FONT_R, _esc(lab), f0 / FPS, min(f1, TOTAL) / FPS))
    return ",".join(ch)


def cmd_deliver():
    film = os.path.join(WORK, "film.mp4")
    if nframes(film) != TOTAL:
        print("DELIVER FAILED  run `film` first (%s)" % film)
        return 1
    for p in (AUDIO, SRT, FONT, FONT_R):
        if not os.path.exists(p):
            print("DELIVER FAILED  missing %s" % p)
            return 1

    # Subtitle placement is measured, not chosen by eye.
    #
    # The head section (ACT0..ACT2) already contains the very thing the CEO
    # approved in his three reference images: a cyan-rimmed dark lightbox panel
    # carrying white bold Hangul. Sampling the cyan rim across ten frames of the
    # head showed the panel reaching as far down as 0.95 of frame height (t=140),
    # so a subtitle sitting at MarginV=54 lands straight on top of the panel's
    # own lettering -- two sets of Korean words fighting over the same pixels.
    #
    # I cannot move the panel; it is baked into the footage. So the subtitle is
    # pushed to the very bottom and given an opaque plate of its own
    # (BorderStyle=4) instead of a mere outline. That guarantees a clean reading
    # surface even where the panel glow spills to the frame edge. The subtitle is
    # also a notch smaller so the executive's eye goes to the picture first.
    vf = overlay_chain() + (
        ",subtitles='%s':force_style="
        "'FontName=NanumGothic Bold,FontSize=17,PrimaryColour=&H00FFFFFF,"
        "OutlineColour=&HC0000000,BackColour=&HC0000000,BorderStyle=4,"
        "Outline=0,Shadow=0,MarginV=10,MarginL=90,MarginR=90,Alignment=2'" % SRT)

    out = os.path.join(HERE, "previz_sim_500s.mp4")
    print("· burn overlays + subtitles, mux narration")
    sh(["ffmpeg", "-y", "-v", "error", "-i", film, "-i", AUDIO,
        "-vf", vf, "-map", "0:v:0", "-map", "1:a:0",
        "-c:v", "libx264", "-preset", "medium", "-crf", "21",
        "-pix_fmt", "yuv420p", "-r", str(FPS),
        "-c:a", "aac", "-b:a", "160k", "-shortest", out], "deliver")

    n = nframes(out)
    p = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                        "format=duration", "-of", "csv=p=0", out],
                       capture_output=True, text=True)
    print("deliver %d f  duration %s s  %d B" % (n, p.stdout.strip(),
                                                 os.path.getsize(out)))
    if n != TOTAL:
        print("DELIVER FAILED  %d f, wanted %d" % (n, TOTAL))
        return 1
    print("DELIVER OK  %s" % out)
    return 0


if __name__ == "__main__":
    c = sys.argv[1] if len(sys.argv) > 1 else "map"
    raise SystemExit({"map": cmd_map, "film": cmd_film,
                      "deliver": cmd_deliver}.get(c, cmd_map)())
