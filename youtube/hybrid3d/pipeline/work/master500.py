#!/usr/bin/env python3
"""The one place that turns the three act sources into the 500-second master.

Nothing in this file generates pixels.  Every act already has its own renderer
(act0.py, drive500.py, drive38.py + the r3d previz/v2v pass), and each of them
declares its own shot table.  What was missing was a single owner of the
question "does the film land on frame 12000", and the answer used to be no --
three separate defects, none of which any individual renderer could see:

  1. ACT0 is 755 frames long but occupies 0..720 on the grid.  act0.py was
     written before the shot table existed and its own shot list adds up to
     31.458 s, so it overhangs its slot by 35 frames.
  2. Frames 3600..3608 belong to no table at all.  shots.TABLE ends at
     A2-19 t1 = 150.0 and rows38 begins at A3-01 t0 = 150.32, so 0.32 s of
     film was never assigned an owner.  This is the true origin of the
     "+0.320 s mystery" that survived several sessions: it was never drift,
     it was a hole.
  3. Three of the eight ACT1~2 i2v clips (A1-06, A1-08, A2-02) were delivered
     by the V-2 team but never landed in seg/, so drive500.py skipped them and
     act12.mp4 came out 297 frames short of its 2880-frame slot -- silently,
     because a skipped row is a warning, not an error.

The grid rule from lesson 179 applies to acts exactly as it does to shots: a
segment's length is the DIFFERENCE OF ITS GRID INDICES, never a duration.  So
this file builds a map first, proves it covers 0..12000 with no hole and no
overlap, and only then touches a frame.

Usage
    python3 -u master500.py map      # arithmetic only, no pixels  (free)
    python3 -u master500.py head     # build 0..3608 (ACT0+ACT1~2+bridge)
    python3 -u master500.py film     # head + ACT3~8 tail -> silent 12000 f
    python3 -u master500.py deliver  # film + audio + burned-in subtitles
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

FPS = 24
TOTAL = 12000                       # 500.000000 s -- the audio master is
                                    # 500.010667 s, a residue of 0.256 frame

ACT0 = os.path.join(HERE, "act0_final.mp4")
ACT12 = os.path.join(HERE, "act12.mp4")
SEG38 = "/home/user/lf/r3d/_seg"    # the 80 sliced ACT3~8 shots
ROWS = os.path.join(HERE, "rows38.json")
AUDIO = "/home/user/lf/inbox/rd/v14_audio_500s.wav"
SRT = "/home/user/lf/inbox/rd/v14_500s_v2.srt"
WORK = os.path.join(HERE, "_m500")
RES = (1280, 720)                   # the r3d previz/v2v resolution; the two
                                    # head acts are 1920x1080 and get scaled


def sh(cmd, tag):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit("%s failed (rc=%d)\n%s" % (tag, r.returncode,
                                                    r.stderr[-2000:]))


def fcount(p):
    """frames actually in the file -- counted, never taken from a header

    nb_frames comes from the container index and a concat-copy can leave it
    stale, so every gate in this file counts.
    """
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0",
                        "-count_frames", "-show_entries",
                        "stream=nb_read_frames", "-of", "csv=p=0", p],
                       capture_output=True, text=True)
    return int(r.stdout.strip() or 0)


def seg_map():
    """the authoritative act layout on the 24 fps grid

    Returns a list of (name, g0, g1, kind, source) covering 0..TOTAL exactly.
    """
    import shots
    T = shots.resolve_kinds()
    R = json.load(open(ROWS))["rows"]

    a0 = round(T[0]["t0"] * FPS)            # 720
    a1 = round(T[-1]["t1"] * FPS)           # 3600
    b0 = round(R[0]["t0"] * FPS)            # 3608
    b1 = round(R[-1]["t1"] * FPS)           # 12000

    out = [("ACT0", 0, a0, "trim", ACT0),
           ("ACT12", a0, a1, "trim", ACT12)]
    if b0 > a1:
        # The hole between the two tables. It is 8 frames -- a third of a
        # second -- and it sits exactly on the ACT2->ACT3 cut, so the honest
        # filler is the last frame of ACT2 held still: the narration there is
        # already mid-sentence and a held frame reads as a beat, whereas a
        # cross-fade would invent motion the shot table never asked for.
        out.append(("BRIDGE", a1, b0, "hold", ACT12))
    for r in R:
        g0, g1 = round(r["t0"] * FPS), round(r["t1"] * FPS)
        out.append((r["sid"], g0, g1, "seg",
                    os.path.join(SEG38, "%s.mp4" % r["sid"])))
    return out


def cmd_map(verbose=True):
    m = seg_map()
    bad = []
    if m[0][1] != 0:
        bad.append("film does not start at frame 0")
    for (na, _, e), (nb, s, _) in zip([(x[0], x[1], x[2]) for x in m],
                                      [(x[0], x[1], x[2]) for x in m[1:]]):
        if s != e:
            bad.append("%s -> %s: %d != %d" % (na, nb, e, s))
    if m[-1][2] != TOTAL:
        bad.append("film ends at %d, not %d" % (m[-1][2], TOTAL))
    if bad:
        raise SystemExit("MAP FAILED:\n  " + "\n  ".join(bad))

    if verbose:
        for name, g0, g1, kind, src in m[:3]:
            have = fcount(src) if os.path.exists(src) else -1
            print("%-8s grid %5d..%-5d %5d f  %-5s %-28s have %d (%+d)"
                  % (name, g0, g1, g1 - g0, kind, os.path.basename(src),
                     have, have - (g1 - g0) if have >= 0 else 0))
        miss = [x for x in m[3:] if not os.path.exists(x[4])]
        print("ACT3~8   grid %5d..%-5d %5d f  seg   %d shots, %d not yet sliced"
              % (m[3][1], m[-1][2], m[-1][2] - m[3][1], len(m) - 3, len(miss)))
        print("MAP  OK  %d segments cover 0..%d with no hole and no overlap"
              % (len(m), TOTAL))
    return m


def _norm(src, ss_frames, n, out, tag):
    """take exactly n frames starting at frame ss_frames, at RES and 24 fps

    -ss on a seconds axis is a re-timing invitation, so the cut is expressed
    in frames with select and the kept frames are re-stamped onto the grid
    with setpts.  As in v2v.py, setpts already produces CFR, so -r is the only
    rate flag allowed here (-vsync 0 alongside it is refused as contradictory).
    """
    a, b = ss_frames, ss_frames + n - 1
    vf = ("select='between(n\\,%d\\,%d)',scale=%d:%d,setsar=1,setpts=N/%d/TB"
          % (a, b, RES[0], RES[1], FPS))
    sh(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-vf", vf,
        "-r", str(FPS), "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-crf", "16", "-an", out], tag)
    got = fcount(out)
    if got != n:
        raise SystemExit("%s: wrote %d f, want %d f" % (tag, got, n))
    return out


def _hold(src, at, n, out, tag):
    """freeze one frame of src for n frames"""
    vf = ("select='eq(n\\,%d)',scale=%d:%d,setsar=1,loop=loop=%d:size=1:start=0"
          ",setpts=N/%d/TB" % (at, RES[0], RES[1], n - 1, FPS))
    sh(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-vf", vf,
        "-r", str(FPS), "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-crf", "16", "-an", out], tag)
    got = fcount(out)
    if got != n:
        raise SystemExit("%s: wrote %d f, want %d f" % (tag, got, n))
    return out


def concat(parts, out, tag):
    """stream-copy concat -- list paths must be absolute

    A relative path in the list is resolved against the LIST FILE's directory,
    not the process cwd, which fails as "Impossible to open ...".
    """
    lst = os.path.join(WORK, "_c_%s.txt" % os.path.basename(out))
    with open(lst, "w") as f:
        for p in parts:
            f.write("file '%s'\n" % os.path.abspath(p))
    sh(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0",
        "-i", lst, "-c", "copy", out], tag)
    return out


def cmd_head():
    """0..3608 -- ACT0 trimmed to its slot, ACT1~2, and the 8-frame bridge"""
    os.makedirs(WORK, exist_ok=True)
    m = cmd_map(verbose=False)
    parts = []
    for name, g0, g1, kind, src in m[:3]:
        if kind == "seg":
            break
        n = g1 - g0
        out = os.path.join(WORK, "%s.mp4" % name)
        have = fcount(src)
        if kind == "hold":
            # hold the LAST frame of the source, which is the last frame of ACT2
            _hold(src, have - 1, n, out, name)
        else:
            if have < n:
                raise SystemExit("HEAD GATE FAILED %s: source has %d f, slot "
                                 "needs %d f -- a renderer skipped rows"
                                 % (name, have, n))
            # An overhang is trimmed from the TAIL: act0.py's last shot is a
            # hold on the closing card, so the frames removed are the ones a
            # viewer cannot distinguish.
            _norm(src, 0, n, out, name)
        print("%-8s %5d f  <- %s (%d f)" % (name, n, os.path.basename(src), have))
        parts.append(out)
    head = os.path.join(WORK, "head.mp4")
    concat(parts, head, "head")
    got = fcount(head)
    want = m[3][1]
    if got != want:
        raise SystemExit("HEAD GATE FAILED: %d f, want %d f" % (got, want))
    print("HEAD OK  %d f = %.6f s  -> %s" % (got, got / float(FPS), head))
    return head


def cmd_film():
    head = os.path.join(WORK, "head.mp4")
    if not os.path.exists(head):
        head = cmd_head()
    m = cmd_map(verbose=False)
    segs = []
    for name, g0, g1, kind, src in m:
        if kind != "seg":
            continue
        if not os.path.exists(src):
            raise SystemExit("FILM GATE FAILED: %s not sliced yet (%s)"
                             % (name, src))
        got = fcount(src)
        if got != g1 - g0:
            raise SystemExit("FILM GATE FAILED %s: %d f, grid wants %d f"
                             % (name, got, g1 - g0))
        segs.append(src)
    film = os.path.join(WORK, "film_silent.mp4")
    concat([head] + segs, film, "film")
    got = fcount(film)
    if got != TOTAL:
        raise SystemExit("FILM GATE FAILED: %d f, want %d f" % (got, TOTAL))
    print("FILM OK  %d f = %.6f s  -> %s" % (got, got / float(FPS), film))
    return film


def cmd_deliver():
    film = os.path.join(WORK, "film_silent.mp4")
    if not os.path.exists(film):
        film = cmd_film()
    for p in (AUDIO, SRT):
        if not os.path.exists(p):
            raise SystemExit("missing %s" % p)
    out = os.path.join(HERE, "longform_500s.mp4")
    # -shortest would cut on the 0.256-frame audio residue; instead the video
    # is the master clock and the audio is simply not allowed to extend it.
    sh(["ffmpeg", "-y", "-loglevel", "error", "-i", film, "-i", AUDIO,
        "-vf", "subtitles=%s:force_style='FontName=NanumGothic Bold,"
        "FontSize=22,Outline=2,Shadow=0,MarginV=48'" % SRT,
        "-map", "0:v:0", "-map", "1:a:0",
        "-c:v", "libx264", "-crf", "18", "-preset", "medium",
        "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
        "-t", "%.6f" % (TOTAL / float(FPS)), out], "deliver")
    got = fcount(out)
    if got != TOTAL:
        raise SystemExit("DELIVER GATE FAILED: %d f, want %d f" % (got, TOTAL))
    print("DELIVER OK  %d f = %.6f s  %s  %d B"
          % (got, got / float(FPS), out, os.path.getsize(out)))
    return out


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a or a[0] == "map":
        cmd_map()
    elif a[0] == "head":
        cmd_head()
    elif a[0] == "film":
        cmd_film()
    elif a[0] == "deliver":
        cmd_deliver()
    else:
        raise SystemExit(__doc__)
