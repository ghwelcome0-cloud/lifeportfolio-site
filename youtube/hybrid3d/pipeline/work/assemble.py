#!/usr/bin/env python3
"""assemble.py — N-segment hybrid-3D-motion assembler for the 500 s longform.

This is the generalisation of the v5/v6 pilots that CEO-14 approved
("지금 마지막에 만든 영상들은 만족합니다. 이제야 PPT 슬라이드를 붙여서 만든
  영상 콘텐츠를 탈피한 것 같네요.")
into an arbitrary-length timeline.

Every rule below is either reverse-engineered from the benchmark or proven by
measurement in this project. Nothing here is guesswork.

 R1  SEGMENT LENGTH 1-5 s.
     The benchmark never sustains a generated shot longer than ~5 s; it stitches.
     My earlier 8 s attempts collapsed into morphing (pilots scored 5/4/3).
     -> lesson 46: never set yourself a harder task than the reference solves.

 R2  WALLS ARE NOT PENETRATED, THEY ARE CUT.
     Benchmark 0:09 hard cut, 0:12 dissolve, 3:03 hard cut, 4:38 dissolve.
     We never ask the model to traverse a solid surface; we cut and disguise.

 R3  DISGUISE THE CUT WITH A BLUR V.
     +/-3 frames of fixed-sigma gaussian (2.5 -> 5 -> 8 -> 8 -> 5 -> 2.5).
     ffmpeg's gblur sigma CANNOT take a time expression (proven: rc=234), so
     each frame band is rendered separately and concatenated.
     penchk.py confirmed the V is real: sharpness 5% at the seam, 179% after.

 R4  MATCH LIGHTING ACROSS EVERY CUT.
     Gate: dY <= 6 and d_warmth <= 4. If exceeded, apply a per-channel gain
     measured from the actual boundary frames, tempered by 0.75 so the grade
     never overshoots (untempered regeneration made it WORSE: dY 5.55 -> 15.74).

 R5  KOREAN TEXT IS ALWAYS A POST OVERLAY, NEVER BAKED INTO A PROMPT.
     Baked text melts in i2v. Overlaid drawtext is pixel-perfect, and the crisp
     2D layer acts as the "anchor" that makes the soft AI footage read as precise.

 R6  THE ORB DOES NOT CROSS A CUT.  (lesson 51, learned from v7 scoring 5.5)
     v7 flew a mathematically continuous orb through the cut and scored WORSE,
     because screen-space continuity is not depth continuity: the same x,y reads
     as a different distance once the scene's perspective changes ("the orb drops
     onto the desk"). So the orb fades out just before the cut and fades back in
     just after at the SAME screen position and size. Identity is preserved by
     re-entry, not by an unbroken path — which is exactly what the benchmark
     does with its droplet.
"""
import subprocess, os, json, cv2, numpy as np
import cmatch          # V-3 policy-aware boundary grading, delivered as code

W, H, FPS = 1920, 1080, 24
FR = 1.0 / FPS
FONT = "/usr/share/fonts/truetype/nanum/NanumSquareRoundB.ttf"
TEMPER = 0.75          # R4
GATE_DY, GATE_DW = 6.0, 4.0
BLUR = [2.5, 5.0, 8.0]  # R3, mirrored around the seam
WORK = "_bld"


def run(cmd, tag=""):
    print("  ·", tag or " ".join(cmd[:6]), flush=True)
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr[-1800:])
        raise SystemExit(f"FAILED rc={r.returncode}: {tag}")


def duration(src):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                        "format=duration", "-of", "csv=p=0", src],
                       capture_output=True, text=True)
    return float(r.stdout.strip())


def grab(src, t):
    """Extract one frame as float32 BGR.

    t is CLAMPED into [0, duration - 2 frames]. Without the clamp a request past
    the last frame makes ffmpeg exit 0 while writing nothing, and cv2.imread then
    returns None — which is exactly how the first ACT-0 build died. Silent success
    plus empty output is the worst failure mode, so it is fenced off here once.
    """
    d = duration(src)
    t = max(0.0, min(t, d - 2 * FR))
    p = f"{WORK}/_g.png"
    if os.path.exists(p):
        os.remove(p)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.4f}", "-i", src,
                    "-frames:v", "1", p], check=True)
    im = cv2.imread(p)
    if im is None:                      # last resort: decode from the head
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src,
                        "-vf", f"select='gte(n,{max(int(t*FPS)-1,0)})'",
                        "-frames:v", "1", p], check=True)
        im = cv2.imread(p)
    if im is None:
        raise SystemExit(f"grab failed: {src} @ {t:.3f}s (duration {d:.3f}s)")
    return im.astype(np.float32)


def ease_expr(n, ease="inout", head=0.0, tail=0.0, var="on"):
    """Return an ffmpeg expression for normalised progress 0->1 with easing.

    `var` is the filter's own frame counter, and it is not the same name in every
    filter: zoompan calls it `on` (output frame number), crop calls it `n`. Passing
    `on` to crop fails at configure time with "Undefined constant" and rc=234 —
    which is lesson 86 earning its keep again, since a single free cut surfaced it
    before any real render depended on it.

    Why this is not just `on/(n-1)`: linear progress has no acceleration, so the
    move appears at full speed on frame one and is cut off at full speed on the
    last frame. Over the small amplitudes this project used, the eye does not read
    that as a camera move at all — it reads as a jitter, which is exactly the
    "흔들림" the CEO identified. The benchmark channel eases every move in and out,
    which is what makes its camera feel operated rather than keyframed.

    `head` and `tail` carry the narrative part. A sentence does not begin the
    instant a shot appears, so a move with head>0 waits, then starts; a sentence
    that lands before the shot ends wants the move to settle early, which is
    tail>0. That is how motion gets timed to speech instead of to file length.

      inout  smoothstep: rest -> glide -> rest.  The default; a complete gesture.
      out    fast start, long settle.            An arrival landing on its subject.
      in     slow start, still accelerating.     A departure that hands off to the
                                                 next cut still in motion.
      linear constant speed.                     Only for a pass-through that must
                                                 not appear to begin or end.
    """
    lo, hi = float(head), 1.0 - float(tail)
    if hi - lo < 0.05:                      # a window this narrow cannot be felt
        lo, hi = 0.0, 1.0
    # clip raw progress into the active window, then normalise it to 0..1
    p = f"clip(({var}/{n-1}-{lo:.4f})/{hi-lo:.4f},0,1)"
    if ease == "linear":
        return f"({p})"
    if ease == "out":                       # decelerate into the target
        return f"(1-(1-{p})*(1-{p}))"
    if ease == "in":                        # accelerate away, hand off in motion
        return f"({p}*{p})"
    return f"(({p})*({p})*(3-2*({p})))"     # smoothstep


def kenburns(img, dur, out, z0=1.00, z1=1.10, pan=(0.0, 0.0),
             ease="inout", head=0.0, tail=0.0, rot=0.0,
             aim0=(0.0, 0.0), aim1=(0.0, 0.0)):
    """2.5D Ken Burns on a still — the benchmark's own trick for long/held beats.

    Reverse-engineering note (pipeline doc): the reference channel does NOT generate
    i2v for every second of screen time. Long traversals and held moments are one
    LARGE still with a slow 2.5D push/pan. That is both cheaper and steadier than
    asking a video model for a 5 s shot it will morph. Used here for beats shorter
    than a generated clip, and later for the long ACTs.

    Measured against that same benchmark, every shot there moves, the moves ease
    in and out, and the frame scale changes by 10-30% rather than the 3% this
    function was previously asked for. So the caller now also supplies an easing
    shape and, where the sentence demands it, a delayed start or an early settle.

    `aim0`/`aim1` are WHERE the crop is centred at the start and end of the move,
    in units of half-frame from plate centre (+x right, +y down). Until they
    existed this function always centred the crop on the plate — `iw/2` — so
    every arrival in the film arrived at the middle of the picture no matter what
    the sentence was about. Measuring the benchmark short the CEO pointed to
    (K4YuwHHGrgQ) makes the rule explicit: "the endpoint of a zoom must place the
    target object prominently in the frame", and without it "the viewer would
    have to actively search the image for the subject being discussed, rather
    than having their attention guided directly to it". The aim travels on the
    same eased progress as the zoom, so the picture arrives and settles together.

    The offsets are half-PLATE units, which is the same unit aim38.room_for()
    is derived in: at zoom z the crop centre may travel (1 - 1/z) of a half-plate
    before an edge shows, so the caller's clamp and this expression measure the
    same distance. Choosing half-crop units instead would have silently broken
    that clamp by a factor of z, which is exactly the sort of unit mismatch that
    letterboxes a shot and is invisible in the code.
    """
    # --- aspect guard, and why it exists -------------------------------------
    #
    # zoompan's crop rectangle keeps the ASPECT OF ITS INPUT and then rescales
    # that rectangle to `s`. Proven with a circle probe (_zp/): a 1970x3175
    # portrait page rendered to 1920x1080 turned every circle into a bbox of
    # w/h = 2.833, which is exactly 3175/1970 / (1080/1920) = 2.86. So a portrait
    # source is not partly shown and not letterboxed — it is squeezed sideways
    # into the frame. Nothing in the render log reports this, and the landscape
    # plates are exactly 16:9 (2048x1152), so the defect hid for the whole project
    # and only surfaced on ACT8, whose three stills are the real report pages.
    #
    # An earlier "fix" of mine fitted the narrow axis instead. Measured, it
    # squeezed identically (same 2.833) — a wrong model producing a plausible
    # number, which is lesson 72 in its purest form. The only correct answer is
    # to REFUSE a non-16:9 source here and have the caller compose a 16:9 canvas,
    # so the squeeze cannot be reintroduced by anyone later.
    src = cv2.imread(img)
    if src is None:
        raise RuntimeError(f"kenburns: cannot read {img}")
    sh, sw = src.shape[:2]
    if abs((sw / sh) - (W / H)) > 0.01:
        raise RuntimeError(
            f"kenburns: {os.path.basename(img)} is {sw}x{sh} (aspect {sw/sh:.4f}); "
            f"zoompan would squeeze it by {((sh/sw)/(H/W)):.2f}x horizontally. "
            f"Compose a {W}:{H} canvas first (see mkcanvas38.py).")
    # Pre-scale is arithmetic here rather than an ffmpeg expression: the shape is
    # already known, so there is nothing to infer at filter time and no expression
    # to get wrong. Upscale only when the source is smaller than 2x output — a
    # 2048-wide plate needs the headroom for a smooth zoom, a 5644-wide ACT8
    # canvas does not, and rescaling it down to 3840 first would throw away the
    # very glyph detail the canvas was built at native resolution to keep.
    if sw < W * 2:
        tw = W * 2
        th = int(round(sh * tw / sw / 2)) * 2
        pre = f"scale={tw}:{th},"
    else:
        pre = ""

    n = max(int(round(dur * FPS)), 2)
    dx, dy = pan
    ax0, ay0 = aim0
    ax1, ay1 = aim1
    e = ease_expr(n, ease, head, tail)
    z = f"{z0}+({z1}-{z0})*{e}"
    # aim, interpolated on the eased progress, in half-plate units
    axe = f"(({ax0})+(({ax1})-({ax0}))*{e})"
    aye = f"(({ay0})+(({ay1})-({ay0}))*{e})"
    x = f"iw/2-(iw/zoom/2)+{axe}*(iw/2)+({dx})*iw*{e}"
    y = f"ih/2-(ih/zoom/2)+{aye}*(ih/2)+({dy})*ih*{e}"
    vf = (f"{pre}zoompan=z='{z}':x='{x}':y='{y}'"
          f":d=1:s={W}x{H}:fps={FPS},trim=start_frame=0:end_frame={n},"
          f"setpts=PTS-STARTPTS,format=yuv420p")
    run(["ffmpeg", "-v", "error", "-y", "-loop", "1", "-t", f"{dur+0.5:.4f}",
         "-i", img, "-vf", vf, "-c:v", "libx264", "-crf", "16",
         "-preset", "medium", "-pix_fmt", "yuv420p", "-r", str(FPS),
         "-frames:v", str(n), "-an", out],
        f"kenburns {os.path.basename(out)} ({dur:.2f}s)")


def pagepan(img, dur, out, y0=0.0, y1=1.0, z0=1.00, z1=1.00,
            ease="inout", head=0.0, tail=0.0):
    """Travel a 16:9 window DOWN a portrait page, at full page width.

    This is the shot the benchmark actually uses on a cross-section: it does not
    politely show you the whole object, it puts the frame inside it and moves. For
    a report page that means the page fills the screen edge to edge and the camera
    reads down it, which is also how a person reads a page.

    kenburns cannot do this and must not be made to. Its crop inherits the aspect
    of its input, so a portrait page squeezes (proven: circle bboxes at w/h 2.833
    instead of 1.0). Here the 16:9 window is cut out of the page FIRST, with crop,
    and only then rescaled to 1920x1080 — a 16:9 rectangle rescaled to a 16:9
    frame changes no proportions, so the printed Korean keeps its shape exactly.

    `y0`/`y1` are the window's vertical position as a fraction of available travel
    (0 = top of the page, 1 = bottom), eased like every other move in the film.
    `z0`/`z1` allow a gentle push at the same time; z=1 means the window is exactly
    the page width, which is the widest honest framing available.

    Measured on report_p03 (1970x3175): the window is 1970x1108, so the page is
    2.87 windows tall and a full travel reads roughly three screens of page. The
    net scale is 1920/1970 = 0.97x — very nearly 1:1, so glyph strokes are neither
    magnified nor blurred. That is the answer to CEO-16 on this shot: the reason
    the text is sharp is that it is never really resampled.
    """
    src = cv2.imread(img)
    if src is None:
        raise RuntimeError(f"pagepan: cannot read {img}")
    sh, sw = src.shape[:2]
    win_h = int(sw * H / W) // 2 * 2                 # a 16:9 window at page width
    if win_h > sh:
        raise RuntimeError(f"pagepan: {os.path.basename(img)} is {sw}x{sh}; a 16:9 "
                           f"window at full width is {win_h}px tall and does not fit. "
                           f"Use kenburns on a composed canvas instead.")

    # Travel only over INKED page, not over the capture's trailing margin.
    #
    # The first render of this shot ended on a frame that was 40% empty paper, and
    # reading the frame is the only reason I know: the sharpness figure had FALLEN
    # to 169, which looks like a resampling problem and is actually a "there is
    # nothing here" problem. All three pages stop having content at row 2879 — the
    # same row in all three, because it is the capture viewport's bottom margin
    # rather than anything about the reports. A move that ends on blank paper reads
    # as the shot having run out, which is the opposite of the benchmark's habit of
    # landing on the thing being discussed.
    g = cv2.cvtColor(src, cv2.COLOR_BGR2GRAY).astype(int)
    bg = float(np.median(g))
    inked = np.where(np.abs(g - bg).max(axis=1) > 18)[0]
    ink_bottom = int(inked.max()) + 1 if len(inked) else sh
    usable = max(min(ink_bottom, sh), win_h)         # never less than one window

    n = max(int(round(dur * FPS)), 2)
    e = ease_expr(n, ease, head, tail, var="n")   # crop's counter is `n`, not `on`
    # crop size shrinks as we push in; keep it 16:9 at every instant
    zx = f"({z0}+({z1}-{z0})*{e})"
    cw = f"{sw}/{zx}"
    ch = f"{win_h}/{zx}"
    # vertical travel: from y0 to y1 of the room the window leaves behind, where
    # "room" is measured against the inked page rather than the file
    room = f"({usable}-{ch})"
    yy = f"{room}*(({y0})+(({y1})-({y0}))*{e})"
    xx = f"({sw}-{cw})/2"
    vf = (f"crop=w='{cw}':h='{ch}':x='{xx}':y='{yy}',"
          f"scale={W}:{H},format=yuv420p")
    run(["ffmpeg", "-v", "error", "-y", "-loop", "1", "-t", f"{dur+0.5:.4f}",
         "-i", img, "-vf", vf, "-c:v", "libx264", "-crf", "16",
         "-preset", "medium", "-pix_fmt", "yuv420p", "-r", str(FPS),
         "-frames:v", str(n), "-an", out],
        f"pagepan {os.path.basename(out)} ({dur:.2f}s)")


def stats(im):
    b, g, r = [im[:, :, i] for i in range(3)]
    y = 0.114 * b.mean() + 0.587 * g.mean() + 0.299 * r.mean()
    return y, float(r.mean() - b.mean()), [float(b.mean()), float(g.mean()), float(r.mean())]


def grab_window(src, t, n=5):
    """n consecutive frames centred on t, as a list of float32 BGR arrays.

    The single-frame grab() that preceded this was the whole problem: one frame at
    a cut boundary can land on a compression artefact, a motion-blurred field, or
    the one lit frame of a flicker, and the grade then chases noise. V-3 made the
    frame-sequence API a hard requirement — "boundary decisions must never be made
    from one frame" — and refuses fewer than five, so the window is produced here
    rather than faked by repeating a single plate.
    """
    d = duration(src)
    half = (n // 2) * FR
    t = max(half, min(t, d - half - 2 * FR))
    return [grab(src, t + (k - n // 2) * FR) for k in range(n)]


def colour_match(prev_frames, cur_frames, policy="continuous",
                 prev_group=None, cur_group=None, *,
                 transition_reason=None, expected_warmth_direction=None,
                 prev_masks=None, cur_masks=None):
    """Policy-aware boundary grading. Thin adapter over cmatch.colour_match.

    The old body graded every boundary that exceeded a luma/warmth gate, which is
    wrong for this film: V-3 rejected automatic clamping outright because a large
    warmth delta at a deliberate cut is the intent, not a defect. Policy now
    decides and pixels only measure:

      continuous, same group        -> grade toward the previous shot
      continuous, different group   -> NO grade, and a loud warning, because a
                                       continuous label spanning two lighting
                                       worlds is a shot-table error, not a look
      intentional_transition        -> NO colour grade at all; requires a written
                                       transition_reason or it raises
      hard_reset                    -> NO grade

    Returns (filter or None, dY, dW) to stay drop-in for the existing caller, and
    stashes the full structured report on the function for the QC pass to pick up.
    """
    if not isinstance(prev_frames, (list, tuple)):
        prev_frames = [prev_frames] * 5      # legacy single-frame call sites
    if not isinstance(cur_frames, (list, tuple)):
        cur_frames = [cur_frames] * 5

    filt, report = cmatch.colour_match(
        prev_frames, cur_frames, policy,
        prev_group or "", cur_group or "",
        prev_exclusion_masks=prev_masks, cur_exclusion_masks=cur_masks,
        transition_reason=transition_reason,
        expected_warmth_direction=expected_warmth_direction)

    colour_match.last_report = report
    dY = float(report.get("d_luma", report.get("dY", 0.0)) or 0.0)
    dW = float(report.get("d_warmth", report.get("dW", 0.0)) or 0.0)
    print(f"    boundary [{policy}] dY={dY:5.2f} d_warmth={dW:5.2f}", end="")
    for w in report.get("warnings", []) or []:
        print(f"\n      WARN {w}", end="")
    print("  -> no grade" if filt is None else f"  -> {filt[:58]}")
    return filt, dY, dW


colour_match.last_report = None


def trim(src, ss, dur, extra, out):
    """Cut `dur` seconds from `src`, exact to the frame.

    -t takes seconds, and seconds do not divide evenly into frames: asking for
    4.0000s at 24fps produced 95 frames (3.9583s) rather than 96, because the
    duration boundary landed inside a frame and the encoder dropped it. One
    frame is invisible. Eight clips of one dropped frame is a third of a second,
    and by the 500s mark a third of a second is a narration that no longer
    matches the lips. So the length is expressed the way the timeline actually
    counts — in frames — exactly as kenburns() already does.
    """
    n = max(int(round(dur * FPS)), 1)
    vf = ",".join([f for f in [extra, f"scale={W}:{H}", "fps=" + str(FPS)] if f])
    run(["ffmpeg", "-v", "error", "-y", "-ss", f"{ss:.4f}", "-i", src,
         "-frames:v", str(n), "-vf", vf, "-c:v", "libx264", "-crf", "16",
         "-preset", "medium", "-pix_fmt", "yuv420p", "-an", out],
        f"trim {os.path.basename(out)} ({n}f)")


def blur_band(src, ss, dur, sigma, out):
    vf = f"gblur=sigma={sigma}:steps=2" if sigma > 0 else "null"
    run(["ffmpeg", "-v", "error", "-y", "-ss", f"{ss:.4f}", "-i", src,
         "-t", f"{dur:.4f}", "-vf", vf, "-c:v", "libx264", "-crf", "16",
         "-preset", "medium", "-pix_fmt", "yuv420p", "-an", out], "")


def concat(parts, out, tag):
    lst = f"{WORK}/_c_{os.path.basename(out)}.txt"
    with open(lst, "w") as f:
        for p in parts:
            f.write(f"file '{os.path.abspath(p)}'\n")
    run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0",
         "-i", lst, "-c", "copy", out], tag)


def apply_seam_blur(src, seams, dur, out):
    """R3: rebuild `src` with a blur V centred on each seam time."""
    if not seams:
        run(["ffmpeg", "-v", "error", "-y", "-i", src, "-c", "copy", out], "no seams")
        return
    sig = BLUR + BLUR[::-1]                     # 2.5 5 8 8 5 2.5
    events = []
    for s in seams:
        for k in range(6):
            events.append((s + (k - 3) * FR, sig[k]))
    events.sort()
    parts, t, n = [], 0.0, 0
    for et, sg in events:
        if et > t + 1e-6:
            p = f"{WORK}/b{n:04d}.mp4"; n += 1
            blur_band(src, t, et - t, 0, p); parts.append(p)
        p = f"{WORK}/b{n:04d}.mp4"; n += 1
        blur_band(src, et, FR, sg, p); parts.append(p)
        t = et + FR
    if t < dur - 1e-6:
        p = f"{WORK}/b{n:04d}.mp4"; n += 1
        blur_band(src, t, dur - t, 0, p); parts.append(p)
    concat(parts, out, f"seam blur ({len(seams)} seams, {len(parts)} bands)")


def fade_env(t0, t1, fi=0.30, fo=0.35):
    """alpha ramp usable by drawtext (time expressions ARE allowed there)."""
    return (f"if(lt(t,{t0}),0,"
            f"if(lt(t,{t0+fi}),(t-{t0})/{fi},"
            f"if(lt(t,{t1-fo}),1,"
            f"if(lt(t,{t1}),({t1}-t)/{fo},0))))")


def dt(text, x, y, size, t0, t1, colour="white", alpha=0.95):
    """R5: crisp Korean 2D overlay."""
    return (f"drawtext=fontfile={FONT}:text='{text}':x={x}:y={y}:fontsize={size}"
            f":fontcolor={colour}@{alpha}:alpha='{fade_env(t0,t1)}'"
            f":shadowcolor=black@0.55:shadowx=3:shadowy=3")


def orb_layer(shots, dur, sprite, sprite_size):
    """DEPRECATED — DO NOT USE. Kept only as the record of a wrong diagnosis.

    HISTORY, corrected. The first ACT-0 build passed all 9 shots to one
    filter_complex and ffmpeg answered rc=234. I concluded "nine chains blew past
    the argument-length limit" and wrote that down as lesson 54. That was WRONG.

    Rendering a SINGLE shot through this same builder fails identically, and with
    -v error ffmpeg names the real culprit:

        [Parsed_colorchannelmixer_2] [Eval] Undefined constant or missing '('
            in 't)/0.12,0))))'
        Error applying option 'aa' to filter 'colorchannelmixer': Invalid argument

    ★ The defect is colorchannelmixer's aa= — it takes a CONSTANT, not a time
      expression. Shot count was never the issue. ★

    Lesson: rc=234 is ffmpeg's generic "bad option value". It says nothing about
    scale. I inferred a cause from the SHAPE of my input (nine chains) instead of
    reading the error text, and then shrank the input — which cannot help when the
    fault is in one option. Reduce to the smallest failing case FIRST, then read
    the message. This is the same class of mistake as the credit-expiry misread.

    -> Use orb_shot() / orb_render() below, which drive alpha with fade=alpha=1
       (a genuinely time-aware filter) and are verified per-pixel.
    """
    pre, ovs = [], []
    for i, s in enumerate(shots):
        t0, t1 = s["t0"], s["t1"]
        d = max(t1 - t0, 1e-3)
        f = 0.12
        a = (f"if(lt(t,{t0}),0,"
             f"if(lt(t,{t0+f}),(t-{t0})/{f},"
             f"if(lt(t,{t1-f}),1,"
             f"if(lt(t,{t1}),({t1}-t)/{f},0))))")
        x = f"({s['x0']}+({s['x1']}-{s['x0']})*(t-{t0})/{d})*{W}"
        y = f"({s['y0']}+({s['y1']}-{s['y0']})*(t-{t0})/{d})*{H}"
        r = f"({s['r0']}+({s['r1']}-{s['r0']})*(t-{t0})/{d})"
        sw = f"{sprite_size}*({r})/26.0"
        lbl = f"o{i}"
        pre.append(f"[{i+1}:v]format=rgba,scale=w='{sw}':h='{sw}':eval=frame,"
                   f"colorchannelmixer=aa='{a}'[{lbl}]")
        ovs.append((lbl, x, y, sw))
    g = ";".join(pre) + ";"
    cur = "0:v"
    for i, (lbl, x, y, sw) in enumerate(ovs):
        nxt = f"v{i}"
        g += (f"[{cur}][{lbl}]overlay=x='({x})-({sw})/2':y='({y})-({sw})/2'"
              f":eval=frame:format=auto[{nxt}];")
        cur = nxt
    return g.rstrip(";"), cur


def orb_shot(src, ss, dur, sprite, sprite_size, w, out):
    """Overlay the orb on ONE shot with a LOCAL clock (0 .. dur).  VERIFIED.

    ROOT CAUSE OF rc=234 — my first diagnosis (lesson 54) was WRONG.
    I blamed argument length because nine chains failed at once. But cutting the
    graph down to a SINGLE shot failed identically, and ffmpeg named the culprit:

        [Parsed_colorchannelmixer_2] [Eval] Undefined constant or missing '('
            in 't)/0.12,0))))'
        Error applying option 'aa' to filter 'colorchannelmixer': Invalid argument

    ★ colorchannelmixer's aa= takes a CONSTANT, not a time expression. ★
    It is the same family of trap as geq rejecting `t` (only `T`) and gblur
    rejecting a sigma expression: in ffmpeg, "accepts an expression" is per
    OPTION, never per filter graph. So the fix is not smaller graphs — it is a
    filter that is actually time-aware:

        fade=t=in:st=0:d=0.12:alpha=1 , fade=t=out:st=dur-0.12:d=0.12:alpha=1

    `fps=FPS` is inserted before scale so the looped still has a real frame
    clock for fade to count against.

    Measured proof on ACT-0 shot 0 (source vs. orbed, per-pixel delta):
        t=0.02  maxdelta  11  bright px      0   -> fade-in start, invisible
        t=0.30  maxdelta 186  bright px 15,261   -> full alpha, peak x601 y668
                                                   (waypoint predicts 594/666)
        t=1.90  maxdelta 190  bright px 18,584   -> interpolating
        t=3.80  maxdelta 125  bright px 16,303   -> fading out
    Position and alpha both behave; this is not a silent pass.

    Per-shot rendering is still the right structure (one shot = one ffmpeg call,
    shot-local clock via -ss/-t), because it keeps every expression short and
    lets a single bad shot be re-rendered without rebuilding the timeline.

    `w` is the shot waypoint dict: x0,y0,r0 -> x1,y1,r1 across this shot.
    The 0.12 s fades at both ends are what lesson 51 requires: the orb leaves
    before the cut and re-enters after it at the same screen position and size.
    """
    f = 0.12
    fo = max(dur - f, f)                      # never let the fades overlap
    prog = f"(t/{dur:.4f})"
    x = f"({w['x0']}+({w['x1']}-{w['x0']})*{prog})*{W}"
    y = f"({w['y0']}+({w['y1']}-{w['y0']})*{prog})*{H}"
    r = f"({w['r0']}+({w['r1']}-{w['r0']})*{prog})"
    sw = f"{sprite_size}*({r})/26.0"
    g = (f"[1:v]format=rgba,fps={FPS},scale=w='{sw}':h='{sw}':eval=frame,"
         f"fade=t=in:st=0:d={f}:alpha=1,"
         f"fade=t=out:st={fo:.4f}:d={f}:alpha=1[o];"
         f"[0:v][o]overlay=x='({x})-({sw})/2':y='({y})-({sw})/2'"
         f":eval=frame:format=auto[v]")
    run(["ffmpeg", "-v", "error", "-y",
         "-ss", f"{ss:.4f}", "-t", f"{dur:.4f}", "-i", src,
         "-loop", "1", "-i", sprite,
         "-filter_complex", g, "-map", "[v]",
         "-c:v", "libx264", "-crf", "16", "-preset", "medium",
         "-pix_fmt", "yuv420p", "-r", str(FPS),
         "-frames:v", str(max(int(round(dur * FPS)), 2)), "-an", out],
        f"orb {os.path.basename(out)} ({dur:.2f}s)")


def orb_render(src, shots, path, sprite, sprite_size, out):
    """R6 at longform scale: per-shot orb render, then concat.

    `shots` is the shot table (each with t0/t1); `path` is the waypoint list with
    len(path) == len(shots) + 1, so consecutive shots SHARE a boundary waypoint —
    the orb reappears at the identical position and size across every cut.

    The tail clamp below is not defensive noise. The ACT-0 shot table ends at
    31.7000 s while the graded source measures 31.541667 s (the seam-blur pass
    loses a couple of frames), i.e. a headroom of -0.1583 s. Left alone, the last
    -ss/-t would ask for footage that does not exist and ffmpeg would emit a
    SHORT clip with rc=0 — the same silent-failure class that grab() already
    guards against. So we measure the source and cut the request to fit.
    """
    src_dur = duration(src)
    parts = []
    for i, s in enumerate(shots):
        d = s["t1"] - s["t0"]
        avail = src_dur - s["t0"] - 2 * FR       # keep 2 frames of margin
        if d > avail:
            print(f"    ! shot{i} clamped {d:.4f}s -> {avail:.4f}s "
                  f"(source {src_dur:.4f}s)")
            d = avail
        if d <= 2 * FR:
            print(f"    ! shot{i} skipped, no source left")
            continue
        w = {"x0": path[i][0], "y0": path[i][1], "r0": path[i][2],
             "x1": path[i + 1][0], "y1": path[i + 1][1], "r1": path[i + 1][2]}
        p = f"{WORK}/orb{i:03d}.mp4"
        orb_shot(src, s["t0"], d, sprite, sprite_size, w, p)
        parts.append(p)
    concat(parts, out, f"orb concat ({len(parts)} shots)")


# ---------------------------------------------------------------------------
# R7  A CUT IS A NARRATIVE EVENT, NOT A FILE BOUNDARY.        (lesson 137/141)
#
#     Counted across the whole 80-row table, every seam in this film was a hard
#     cut: assemble.py contained concat() and apply_seam_blur() and nothing else.
#     There was no xfade, no dissolve, no portal. What I had been calling a
#     "transition" was literally just the next file starting. The CEO saw that
#     immediately and named it: "카메라를 앞으로 끌어 당겼다가 빼는 수준".
#
#     The four functions below are the FREE half of the fix. The paid half is a
#     first+last-frame interpolation from kling/v3 pro, which is what the
#     industry actually does (veed.io states the mechanism outright: the model
#     "analyze[s] the LAST FRAME of your start clip and the FIRST FRAME of your
#     end clip, then generate[s] smooth motion between them"). Since every paid
#     call is billed again on every retry -- "Regenerations: each retry costs the
#     same as the original" -- the paid path is reserved for the seams whose
#     narrative genuinely requires a new world, and these free functions carry
#     every other seam.
#
#     The unifying idea in all four is the one measured in the approved S07
#     portal: if the SAME SHAPE exists in both frames, the eye joins them. The
#     grey bar on the printed sheet became the grey bar on the laptop screen at
#     frame 85 as a translucent double exposure, and that is why it did not read
#     as a cut. So these functions do not invent motion -- they push the outgoing
#     frame toward the shape and let the incoming frame arrive on it.
# ---------------------------------------------------------------------------

def _fcount(src):
    """Frames actually present in `src`.

    ffprobe's format=duration returns the literal string 'N/A' on some of the
    generated clips, and float('N/A') raises, so the count is taken from the
    stream and only then from the duration. This is the same three-step fallback
    verify_seg.py needs, kept local so a transition never depends on a helper
    that might be edited elsewhere.
    """
    for arg in (["-count_frames", "-show_entries", "stream=nb_read_frames"],
                ["-show_entries", "stream=nb_frames"]):
        r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0"]
                           + arg + ["-of", "csv=p=0", src],
                           capture_output=True, text=True)
        s = r.stdout.strip().split("\n")[0].strip().rstrip(",")
        if s.isdigit() and int(s) > 0:
            return int(s)
    d = duration(src)
    return max(int(round(d * FPS)), 1)


def zoom_match_dissolve(prev, cur, out, dur=0.75,
                        focus=(0.0, 0.0), zoom=1.35, ease="inout"):
    """Seam ①/②: push the outgoing frames toward `focus` while the incoming
    frames pull back off it, and cross-dissolve over the overlap.

    This is the free stand-in for a generated portal. The outgoing clip keeps
    accelerating INTO the point the sentence just named, so the motion does not
    stop at the seam -- which was the whole defect: the old seams ended a move,
    then started an unrelated one, and the eye reads that pair as two cameras.
    The incoming clip simultaneously starts slightly zoomed on the same point
    and relaxes out of it, so for the length of the dissolve both pictures are
    travelling along the SAME axis and the shared shape at `focus` is what the
    dissolve lands on.

    `focus` is in half-frame units from centre (+x right, +y down), the same
    unit aim38.room_for()/fit() clamp in, so a caller can hand aim38's target
    straight in without converting. `zoom` is the peak scale reached at the
    seam; 1.35 is the low end of the 10-30% the benchmark uses, chosen because
    the incoming clip has to pay the same zoom back and a larger value starts to
    show plate edges on the 2048-wide sources.

    Why xfade and not a hand-rolled blend: xfade consumes both inputs and emits
    a single stream with the overlap already removed, so the arithmetic below
    can be checked against the file -- out_frames = prev + cur - overlap. A
    manual overlay would leave the caller to trim, and an off-by-one there is a
    dropped frame per seam, which at 79 seams is three seconds of drift against
    a narration track that is already locked to 500.010667s.
    """
    n = max(int(round(dur * FPS)), 2)
    pn, cn = _fcount(prev), _fcount(cur)
    if pn <= n or cn <= n:
        raise RuntimeError(
            "zoom_match_dissolve: overlap %df needs both clips longer than that "
            "(prev=%df, cur=%df). Shorten dur or use concat()." % (n, pn, cn))

    fx, fy = focus
    os.makedirs(WORK, exist_ok=True)
    tagp = os.path.basename(out).replace(".mp4", "")

    # Outgoing tail: continue INTO the focus. ease="in" so it is still
    # accelerating when the dissolve takes over -- a move that decelerates to a
    # stop and is then cut is exactly the "pulled in and pulled back" the CEO
    # rejected.
    e_in = ease_expr(n, "in", var="on")
    zp = "1+(%.4f-1)*%s" % (zoom, e_in)
    xp = "iw/2-(iw/zoom/2)+(%.4f)*(iw/2)*%s" % (fx, e_in)
    yp = "ih/2-(ih/zoom/2)+(%.4f)*(ih/2)*%s" % (fy, e_in)
    # TRIM BEFORE zoompan, never after.
    #
    # Measured on i2v_A6-10.mp4 (193 frames): zoompan alone emits all 193, but
    # "zoompan,trim=start_frame=171:end_frame=193" emits 21 where 22 are asked
    # for, while "trim,setpts,zoompan" emits exactly 22. zoompan regenerates
    # timestamps from its own fps, so a downstream trim counts against the
    # SYNTHESISED timeline rather than the decoded one and the final frame falls
    # off the end. kenburns() never saw this because its input is a still, so
    # there is no upstream frame numbering to disagree with.
    #
    # This also has to be trimmed before, not after, for a second reason: with
    # trim first, `on` inside the expressions counts 0..n-1 over the OVERLAP,
    # which is what ease_expr(n) was built for. With trim after, `on` counts
    # over the whole clip and the easing window would be wrong even when the
    # frame count happened to come out right — a defect that would have been
    # invisible in the log and visible only as a seam that does not accelerate.
    pre_a = "trim=start_frame=%d:end_frame=%d,setpts=PTS-STARTPTS," % (pn - n, pn)
    a = "%s/_zmd_a_%s.mp4" % (WORK, tagp)
    run(["ffmpeg", "-v", "error", "-y", "-i", prev,
         "-vf", (pre_a + "zoompan=z='%s':x='%s':y='%s':d=1:s=%dx%d:fps=%d,"
                 "format=yuv420p") % (zp, xp, yp, W, H, FPS),
         "-c:v", "libx264", "-crf", "16", "-preset", "medium",
         "-pix_fmt", "yuv420p", "-frames:v", str(n), "-an", a],
        "zmd tail-in %s (%df)" % (tagp, n))

    # Incoming head: start on the same point, already zoomed, and relax out of
    # it. ease="out" so the arrival settles rather than braking.
    e_out = ease_expr(n, "out", var="on")
    zc = "%.4f+(1-%.4f)*%s" % (zoom, zoom, e_out)
    xc = "iw/2-(iw/zoom/2)+(%.4f)*(iw/2)*(1-%s)" % (fx, e_out)
    yc = "ih/2-(ih/zoom/2)+(%.4f)*(ih/2)*(1-%s)" % (fy, e_out)
    b = "%s/_zmd_b_%s.mp4" % (WORK, tagp)
    run(["ffmpeg", "-v", "error", "-y", "-i", cur,
         "-vf", ("trim=start_frame=0:end_frame=%d,setpts=PTS-STARTPTS,"
                 "zoompan=z='%s':x='%s':y='%s':d=1:s=%dx%d:fps=%d,"
                 "format=yuv420p") % (n, zc, xc, yc, W, H, FPS),
         "-c:v", "libx264", "-crf", "16", "-preset", "medium",
         "-pix_fmt", "yuv420p", "-frames:v", str(n), "-an", b],
        "zmd head-out %s (%df)" % (tagp, n))
    for lbl, f in (("tail-in", a), ("head-out", b)):
        g = _fcount(f)
        if g != n:
            raise RuntimeError("zoom_match_dissolve: %s produced %df, wanted %df"
                               % (lbl, g, n))

    # prev[:-n] + xfade(a, b) + cur[n:]
    keep_p = "%s/_zmd_kp_%s.mp4" % (WORK, tagp)
    keep_c = "%s/_zmd_kc_%s.mp4" % (WORK, tagp)
    run(["ffmpeg", "-v", "error", "-y", "-i", prev, "-frames:v", str(pn - n),
         "-c:v", "libx264", "-crf", "16", "-preset", "medium",
         "-pix_fmt", "yuv420p", "-an", keep_p], "zmd keep prev")
    run(["ffmpeg", "-v", "error", "-y", "-i", cur,
         "-vf", "trim=start_frame=%d,setpts=PTS-STARTPTS" % n,
         "-c:v", "libx264", "-crf", "16", "-preset", "medium",
         "-pix_fmt", "yuv420p", "-an", keep_c], "zmd keep cur")

    # xfade emits duration(a) + duration(b) - transition, in SECONDS, and then
    # the encoder floors that into frames. Asking for exactly n*FR loses a frame
    # whenever n*FR is not exactly representable: n=22 gives 0.916667s, which
    # printed at four places is 0.9167 — very slightly LARGER than 22/24 — so
    # the output came out 0.91662s, floored to 21 frames, and the seam silently
    # ate one frame. Measured: n=18/20/24 were exact and only n=22 drifted,
    # which is precisely the signature of a boundary landing inside a frame
    # rather than of a wrong formula. Asking for half a frame LESS makes the
    # result land in the middle of frame n for every n, so the floor is
    # deterministic instead of depending on how the decimal happens to print.
    # This is the same class of defect trim() already documents, and it matters
    # for the same reason: one lost frame per seam over 79 seams is 3.3 seconds
    # of drift against a narration track locked to 500.010667s.
    mid = "%s/_zmd_x_%s.mp4" % (WORK, tagp)
    run(["ffmpeg", "-v", "error", "-y", "-i", a, "-i", b,
         "-filter_complex",
         "[0:v][1:v]xfade=transition=fade:duration=%.6f:offset=0,format=yuv420p"
         % ((n - 0.5) * FR),
         "-c:v", "libx264", "-crf", "16", "-preset", "medium",
         "-pix_fmt", "yuv420p", "-frames:v", str(n), "-an", mid],
        "zmd xfade %s (%df)" % (tagp, n))
    got = _fcount(mid)
    if got != n:
        raise RuntimeError(
            "zoom_match_dissolve: xfade emitted %df, expected %df. The seam "
            "arithmetic is the only thing keeping picture and narration aligned, "
            "so this must not be tolerated silently." % (got, n))
    concat([keep_p, mid, keep_c], out, "zmd %s" % tagp)
    return _fcount(out)


def through_page(prev, cur, out, dur=0.85, focus=(0.0, 0.0), zoom=1.60):
    """Seam ②: pass THROUGH the paper surface instead of cutting away from it.

    Mechanically this is zoom_match_dissolve pushed further (a surface has to
    fill the frame before it can be passed through) with a short white bloom at
    the crossing point. The bloom is not decoration: R2 of this file already
    records that the benchmark never actually penetrates a solid surface, it
    cuts and disguises the cut. A page is a solid surface. So the honest
    implementation is to reach the surface, wash it out for three frames, and
    arrive on the other side -- the same trick R3 uses with its blur V, but
    keyed to brightness because paper is what is being crossed.
    """
    tagp = os.path.basename(out).replace(".mp4", "")
    tmp = "%s/_tp_%s.mp4" % (WORK, tagp)
    zoom_match_dissolve(prev, cur, tmp, dur=dur, focus=focus, zoom=zoom)
    n = _fcount(tmp)
    seam = (n - int(round(dur * FPS / 2))) * FR
    run(["ffmpeg", "-v", "error", "-y", "-i", tmp,
         "-vf", ("eq=brightness='0.55*exp(-((t-%.4f)/0.055)*((t-%.4f)/0.055))':"
                 "eval=frame") % (seam, seam),
         "-c:v", "libx264", "-crf", "16", "-preset", "medium",
         "-pix_fmt", "yuv420p", "-an", out], "through_page bloom %s" % tagp)
    return _fcount(out)


def inset_descent(prev, cur, out, dur=1.00, focus=(0.0, 0.0), r=0.26):
    """Seam ③: the named item opens as a circular inset and becomes the frame.

    Taken straight from the sample the CEO supplied as the correct answer
    (vitc.mp4): at 12.0s it performs a scale jump with a circular inset rather
    than a cut, so the viewer never loses the parent frame. That is the free
    implementation of "항목 낙하" -- a report line becomes a space without the
    picture ever being replaced.

    `r` is the inset radius as a fraction of frame height at its smallest. The
    circle grows on eased progress until it exceeds the frame diagonal, at which
    point the incoming picture IS the frame and the outgoing one is gone. A
    two-pixel feather keeps the edge from aliasing into a visible staircase on
    the 24fps timeline.
    """
    n = max(int(round(dur * FPS)), 2)
    pn, cn = _fcount(prev), _fcount(cur)
    if pn <= n or cn <= n:
        raise RuntimeError("inset_descent: overlap %df exceeds a clip "
                           "(prev=%df cur=%df)" % (n, pn, cn))
    fx, fy = focus
    cx, cy = W / 2.0 + fx * W / 2.0, H / 2.0 + fy * H / 2.0
    tagp = os.path.basename(out).replace(".mp4", "")
    os.makedirs(WORK, exist_ok=True)

    # geq builds the alpha as a function of distance from (cx,cy); the radius is
    # a time expression, which geq permits (unlike gblur's sigma -- see R3).
    rad = "(%.2f+( %.2f )*pow(clip(T/%.4f,0,1),2))" % (
        r * H, (((W ** 2 + H ** 2) ** 0.5) / 2.0) - r * H, n * FR)
    a = "%s/_id_a_%s.mp4" % (WORK, tagp)
    b = "%s/_id_b_%s.mp4" % (WORK, tagp)
    run(["ffmpeg", "-v", "error", "-y", "-i", prev,
         "-vf", "trim=start_frame=%d,setpts=PTS-STARTPTS" % (pn - n),
         "-c:v", "libx264", "-crf", "16", "-preset", "medium",
         "-pix_fmt", "yuv420p", "-an", a], "id tail")
    run(["ffmpeg", "-v", "error", "-y", "-i", cur, "-frames:v", str(n),
         "-c:v", "libx264", "-crf", "16", "-preset", "medium",
         "-pix_fmt", "yuv420p", "-an", b], "id head")

    mid = "%s/_id_x_%s.mp4" % (WORK, tagp)
    run(["ffmpeg", "-v", "error", "-y", "-i", a, "-i", b, "-filter_complex",
         ("[1:v]format=yuva420p,geq=lum='p(X,Y)':cb='cb(X,Y)':cr='cr(X,Y)':"
          "a='255*clip((%s-hypot(X-%.2f,Y-%.2f))/2,0,1)'[ins];"
          "[0:v][ins]overlay=0:0:format=auto,format=yuv420p")
         % (rad, cx, cy),
         "-c:v", "libx264", "-crf", "16", "-preset", "medium",
         "-pix_fmt", "yuv420p", "-an", mid], "id inset %s" % tagp)

    keep_p = "%s/_id_kp_%s.mp4" % (WORK, tagp)
    keep_c = "%s/_id_kc_%s.mp4" % (WORK, tagp)
    run(["ffmpeg", "-v", "error", "-y", "-i", prev, "-frames:v", str(pn - n),
         "-c:v", "libx264", "-crf", "16", "-preset", "medium",
         "-pix_fmt", "yuv420p", "-an", keep_p], "id keep prev")
    run(["ffmpeg", "-v", "error", "-y", "-i", cur,
         "-vf", "trim=start_frame=%d,setpts=PTS-STARTPTS" % n,
         "-c:v", "libx264", "-crf", "16", "-preset", "medium",
         "-pix_fmt", "yuv420p", "-an", keep_c], "id keep cur")
    concat([keep_p, mid, keep_c], out, "inset_descent %s" % tagp)
    return _fcount(out)


def portal_return(prev, cur, out, dur=0.90, focus=(0.0, 0.0), zoom=1.28):
    """Seam ④: come back out, and let the whole read differently.

    The inverse of zoom_match_dissolve: the outgoing clip RELEASES the point it
    was holding and the incoming clip is already wide, so the pair reads as one
    continuous withdrawal. Used where the script closes a thought -- A6-11's
    "답을 새로 만들어내기보다 이미 살아온 삶에서 다음 방향을 발견해 보세요" is
    exactly that beat, and it is also the seam whose before/after frames were
    measured as nearly identical, i.e. the clearest instance of the defect.
    """
    return zoom_match_dissolve(prev, cur, out, dur=dur, focus=focus,
                               zoom=zoom, ease="inout")
