"""PREVIZ BATCH -- render one job from jobs.json as a colour-coded 3D previz mp4.

This is deliverable A of the GenTeam order, implemented in-house because the
longform must be finished now ([CEO-55]).  It is pv5 generalised: the set, the
render settings, the marker material and the 40% hold are exactly the values
that were verified on screen and accepted by the CEO; only the camera path, the
word texture and the frame count come from jobs.json.

Usage (Blender-as-module, CPU Cycles):
    PREVIZ_JOB=J_A6-02 python3 -u previz_batch.py
    PREVIZ_JOBS=all    python3 -u previz_batch.py        # render every job

Per job it writes  _batch/<job_id>/f_####.png  then muxes  _batch/<job_id>.mp4
"""
import bpy, time, math, os, json, subprocess, sys

# PREVIZ_JOBSFILE selects the job list.  It defaults to the original jobs.json so
# nothing that already renders changes; scenejobs.json is the new scene-driven
# list produced by scenemap.py -> scenejobs.py.
ROOT = "/home/user/lf/r3d/_batch"
WORDS = "/home/user/lf/r3d/words"
JOBS = os.environ.get("PREVIZ_JOBSFILE", "/home/user/lf/r3d/jobs.json")
FPS = 24

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sets import build_spec as sets_build_spec        # noqa: E402

# ---------------------------------------------------------------------------
# [CEO-57] glyph quality -- lesson 170, measured on the 36 jobs of the previous
# pass and NOT guessed:
#   J_A4-03 first frame : the word occupied 66 x 30 px  (8% of frame width)
#   J_A4-03 last  frame : 0 red pixels -- the word had DISAPPEARED
#   J_A3-07             : ~100 px per word, from a 512 px texture
# So the bottleneck was never the texture file: it was (a) how many pixels the
# glyph is given ON SCREEN and (b) the plane going edge-on when the camera rises.
# Three fixes live here:
#   RES        832x468 -> 1280x720, i.e. exactly the v2v output size, so no glyph
#              pixel is invented by an upscale.
#   INK_FRAC   the plane is rescaled every frame from the camera distance so the
#              ink always keeps this share of the frame width, whatever the verb.
#   billboard  the plane yaws/pitches toward the camera, capped, so it can never
#              become a blade.
RES = (1280, 720)
# samples: 1 cannot anti-alias a glyph edge, but 8 cost 2.61 s/f (6.1 h for the
# whole longform).  4 is the measured knee -- the glyph texture is already
# LANCZOS-filtered, so the sampler only has to resolve the plane silhouette.
SAMPLES = 4
INK_FRAC = 0.34       # target ink width as a share of frame width
INK_FRAC_CONV = 0.20  # converge shows three words at once -> smaller each
# Floor set from measurement, not taste.  The rejected pass delivered 66 px and
# the CEO called it "\uc800\uae09"; the widest framing in the whole longform (11 m) can
# carry 226 px of printed ink on an A4-proportioned sheet, which is 3.4x the
# rejected value and 18% of the 1280 px v2v output -- enough for the generator to
# TRACE the strokes instead of inventing them.
MIN_INK_PX = 210

# [CEO-57, second pass] "이미지 수준의 글자" is not only about SIZE.  The zoomed
# contact sheet showed three separate VISUAL defects that a bigger texture does
# not fix, so each gets its own control:
#   1. the word overran the sheet of paper and its lower strokes were cut off
#      ("변화" read as "벼하").  A glyph printed on a document must never be
#      wider than the document -> PAPER_FIT.
#   2. the stroke edge fizzed with stray red/cyan pixels -> the alpha is
#      thresholded so the boundary is a clean cut, not a soft ramp.
#   3. the word looked like a sticker floating above the sheet -> it lies flat
#      ON the paper during the hold and only lifts once the gesture starts.
# A4-proportioned sheets, enlarged so that even the most distant framing (9 m)
# still gives the printed word >= MIN_INK_PX.  Measured: at 2.04 m wide the ink
# fell to 225 px at 9 m, just under the floor, so the sheet carries the fix.
# 2.50 m left the FAR sheet of J_A4-08 (12.14 m away) at 205 px, just under the
# floor, because the paper -- not the frame -- was the binding limit there.
# 2.70 m clears it at 221 px and the sheets still sit 2.80 m apart, so widening
# the page cannot re-create the overlap the earlier pilots showed.
PAPER_W = 2.70        # document plate full width in metres
PAPER_H = 2.16        # document plate full depth in metres
PAPER_FIT = 0.88      # glyph may use at most this share of the sheet

# [lesson 188] PAPER_W 2.70 / PAPER_H 2.16 are NOT the real sheet.  A4 is
# 0.296 x 0.210 m (sets.paper()).  They were inflated 9x so that a glyph clamped
# to "the paper" could still clear MIN_INK_PX.  Swept over all 76 scenejobs with
# the REAL A4 clamp, the printed-phase ink floor is 21 px and 0 of 66 glyph jobs
# clear 210 px; the worst job (J_A4-05, lens 28, d 11.39 m) would need 2.402 m of
# ink where a real sheet offers 0.260 m -- 9.2x short.  So the compensation is
# structural, not a tuning value: as long as SIZE is derived from the sheet, one
# of {real sets, MIN_INK_PX, CEO-65 approval form} must break.
#
# The CEO's three approved stills (std1/std2/std3) are not ink on paper at all.
# Measured panel_w / frame_w = 0.422 / 0.447 / 0.633.  The approved datum is
# therefore FRAME OCCUPANCY, not paper.  Adopting it resolves all four at once:
#   1. the PAPER_FIT clamp disappears for set-based shots
#   2. sets.py keeps its real A4 sheets
#   3. the size datum matches the form the CEO approved
#   4. 210 px is met by construction (0.42 * 1280 = 538 px)
# Legacy jobs.json (60 shots, no "set") keeps the paper clamp so its rendered
# output stays reproducible -- the stability mandate forbids silently changing it.
OCC_MIN = 0.42        # approved panel_w / frame_w floor  (std1 measured 0.422)
OCC_MAX = 0.63        # approved panel_w / frame_w ceiling (std3 measured 0.633)
OCC_LIFT = 0.47       # single-word shots: mid-band, std3 0.470 glyph/panel look
OCC_CONV = 0.42       # three words share the frame -> each sits at the floor
# K2 (3D Motion Director, mid 3084216): the plane is foreshortened by the angle
# between its normal and the view ray, so the on-screen width shrinks by k.
# Clamping k stops a near-edge-on plane from being scaled to infinity; 0.574 is
# the value the team derived from the 55 deg billboard hand-off in K1.
OCC_K_MIN = 0.574
ALPHA_CUT = 0.55      # alpha threshold: crisp edge instead of a soft ramp
# [CEO-58, pilot e] defect 6 -- the FAR sheet of J_A3-07 read "바시" instead of
# "방식" at frame 70: the bottom strokes of both syllables were missing.  It was
# NOT a thin-stroke or alpha problem (the texture carries 35-67 px strokes and
# the near words were perfect in the same frame).  Measured: the glyph's top edge
# sat exactly ON the sheet's top edge, gap 0 px.  The cause is the RATIO of two
# ramps -- at frame 70 the rise was only e=0.285 while t_off=e/LIFTOFF=0.814 had
# already pitched the plane 81% upright, so the lower half of a 0.71 m tall glyph
# dipped 0.36 m BELOW the paper plane and the sheet occluded it.  Rotating faster
# than the ink rises is what buries the strokes, so the two ramps must be tied:
#   sweep over all 5 converge jobs, worst dip of hh*sin(pitch) - z_lift
#     LIFTOFF 0.35 -> +0.356 m  OCCLUDED
#     LIFTOFF 0.60 -> +0.164 m  OCCLUDED
#     LIFTOFF 0.80 -> +0.052 m  OCCLUDED
#     LIFTOFF 1.00 ->  0.000 m  clear
# Only 1.00 (rotation exactly as slow as the rise) removes it by construction,
# and it also strengthens defect 3: the ink now stays coplanar with the sheet for
# the whole printed phase and is fully upright only when it has arrived.
LIFTOFF = 1.00        # gesture progress at which the ink leaves the paper
# the glyph plane may never dip more than this below the sheet it rose from,
# otherwise the paper occludes its lower strokes (defect 6).
MAX_DIP_M = 0.02

# Measured overlap failure (contact sheet, converge pilot J_A3-07): at 8.4 m the
# glyph plane is 2.45 m wide while the documents sit 1.75 m apart, so the three
# words collided into "바서바시".  Documents are spread and the converge cluster is
# spaced by the SAME rule, so a wider glyph can never re-create the collision.
# A FIXED metre gap cannot work: the plane also scales with distance, so at 11 m
# a 0.20-frac word is 2.49 m wide and always overruns any constant spacing.  The
# gap is therefore expressed in the SAME unit as the glyph -- a share of the
# frame width -- which makes the layout distance-invariant by construction.
DOC_SPAN = 2.80       # metres between neighbouring documents (was 1.75)
# [pilot d] Spreading the cluster along world X put the NEAR word at ndcX +0.83
# with a half-width of 0.20, so its outer strokes left the frame (measured) and
# the pixel counter read five blobs instead of three.  A world axis is the wrong
# axis: only the CAMERA's own up vector is guaranteed to stay in frame.  The
# three words are therefore stacked along the camera up axis, which also makes
# them arrive at ONE place on screen -- the gathering the CEO asked for in
# CEO-51 ("\ud55c \uacf3\uc73c\ub85c \ubaa8\uc774\ub294").  Budget at 0.20 ink: each word is 0.213 of the
# frame height, three of them 0.639, leaving 0.31 for the two gaps.
CLUS_VFRAC = 0.30     # converge: centre-to-centre gap as a share of frame HEIGHT
# [lesson 195] lift: how far the word rises, as a share of the frame HEIGHT at
# the sheet.  A fixed metric rise cannot work across 24-50 mm and 0.7-8.4 m: the
# same 0.34 m is 4% of the frame on the wide shots and 67% on the tight ones.
# Swept over all 58 set-based lift jobs: 0.24 -> worst gate 0.960, 0.20 -> 0.874,
# fixed 0.34 m -> 5 jobs off-frame (worst 1.581, J_A5-01).
LIFT_VFRAC = 0.20
DOC_MIN_FRAC = 0.40   # lift: documents must stay this far apart on screen
SENSOR = 36.0         # Blender default sensor width (mm)
# LENS is the shot's focal length.  It used to be the literal 34.0 written into
# six separate formulas, which meant the framing maths, the glyph size, the
# cluster gap and the off-frame gate were ALL silently wrong the moment a shot
# wanted a different lens -- and scenemap now asks for 24-50 mm because the
# reference previz changes lens per beat (wide for the drone descent, long for
# the desk creep).  One variable, set once per job in build(), used everywhere.
LENS_DEFAULT = 34.0
LENS = LENS_DEFAULT
# pv5's forward lean (1.15 rad) looked right up close, but from 8 m the plane
# still reads as a foreshortened blade and the pilot contact sheet showed
# "방식" clipped to "바시".  The lean is therefore capped SOFTER the further the
# camera is, i.e. the glyph turns to face the lens as it recedes.
MAX_PITCH = 1.15      # near-field ceiling (CEO-approved pv5 look)
MIN_PITCH = 0.55      # far-field floor: nearly facing the camera
PITCH_NEAR = 3.0      # metres where MAX_PITCH applies
PITCH_FAR = 9.0       # metres where MIN_PITCH applies


def flat(name, rgb):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    e = nt.nodes.new('ShaderNodeEmission')
    e.inputs[0].default_value = (*rgb, 1); e.inputs[1].default_value = 1.0
    o = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(e.outputs[0], o.inputs[0])
    return m


def texflat(name, path):
    """alpha-driven emission: the GLYPH itself becomes structure (lesson 162/165)"""
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    tc = nt.nodes.new('ShaderNodeTexCoord')
    tx = nt.nodes.new('ShaderNodeTexImage')
    tx.image = bpy.data.images.load(path)
    # 'Closest' produced stair-stepped edges on a 512 px texture; with a 2048 px
    # LANCZOS-filtered texture 'Cubic' is what keeps the stroke edge smooth.
    tx.interpolation = 'Cubic'; tx.extension = 'CLIP'
    # the soft LANCZOS ramp is what fizzed at the stroke boundary when Cycles
    # ran at 4 samples; a Greater-Than on the alpha turns the ramp into one
    # clean cut while the COLOUR stays filtered, so the letter keeps its shape.
    e = nt.nodes.new('ShaderNodeEmission'); e.inputs[1].default_value = 1.0
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    mx = nt.nodes.new('ShaderNodeMixShader')
    o = nt.nodes.new('ShaderNodeOutputMaterial')
    gt = nt.nodes.new('ShaderNodeMath')
    gt.operation = 'GREATER_THAN'; gt.inputs[1].default_value = ALPHA_CUT
    nt.links.new(tc.outputs['UV'], tx.inputs['Vector'])
    nt.links.new(tx.outputs['Color'], e.inputs[0])
    nt.links.new(tx.outputs['Alpha'], gt.inputs[0])
    nt.links.new(gt.outputs[0], mx.inputs[0])
    nt.links.new(tr.outputs[0], mx.inputs[1])
    nt.links.new(e.outputs[0], mx.inputs[2])
    nt.links.new(mx.outputs[0], o.inputs[0])
    m.blend_method = 'BLEND'
    return m


def add(name, kind, loc, sc, col):
    # sphere is what a mannequin head is; the reference previz builds people out
    # of exactly these primitives (flat single-colour blocks, no face, no rig),
    # so the vocabulary here has to cover it.  Segment counts are deliberately
    # low: at 4 samples and 8399 frames the polygon budget is the schedule.
    if kind == "cube":
        bpy.ops.mesh.primitive_cube_add(size=2, location=loc)
    elif kind == "sphere":
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8,
                                             location=loc)
    elif kind == "plane":
        bpy.ops.mesh.primitive_plane_add(size=2, location=loc)
    else:
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, location=loc)
    ob = bpy.context.object; ob.scale = sc; ob.name = name
    ob.data.materials.append(flat(name, col))
    return ob


def add_tex(name, loc, sc, path):
    bpy.ops.mesh.primitive_plane_add(size=2, location=loc)
    ob = bpy.context.object; ob.scale = sc; ob.name = name
    ob.data.materials.append(texflat(name, path))
    return ob


EASE_FN = {
    # The single smootherstep curve was correct for one kind of move and wrong
    # for the rest: a drone descent should decelerate into its landing, a whip
    # pan should accelerate out and brake hard, a slow drift should be linear or
    # it pulses.  Using one curve for all sixty cuts made even genuinely
    # different trajectories feel like the same move -- part of what the CEO was
    # seeing.  scenemap names the curve per move; this is the lookup.
    "linear": lambda t: t,
    "smooth": lambda t: t * t * t * (t * (t * 6 - 15) + 10),
    "ease_in": lambda t: t * t,
    "ease_out": lambda t: 1.0 - (1.0 - t) ** 2,
    "ease_in_out": lambda t: 0.5 - 0.5 * math.cos(math.pi * t),
}
EASE_NAME = "smooth"


def ease(t):
    return EASE_FN[EASE_NAME](t)


def word_meta(act):
    """texture aspect + ink share, written by mkwords.py -- never duplicated here"""
    p = os.path.join(WORDS, "meta.json")
    if not os.path.exists(p):
        raise SystemExit("missing %s -- run mkwords.py first" % p)
    m = json.load(open(p))
    if act not in m:
        return None
    return m[act]


def visible_docs(job, wm, limit=0.94):
    """indices of the documents whose printed word is wholly inside the HOLD
    framing.  A sheet the opening frame already clips can never show a whole
    word, so it is excluded from the converge instead of being scaled down."""
    aspect = wm["aspect"]; share = wm["ink_frac"]
    C = job["cam_start_xyz"]; T = job["tgt_start_xyz"]
    fw = [T[i] - C[i] for i in range(3)]
    n = max(1e-6, math.sqrt(sum(v * v for v in fw))); fw = [v / n for v in fw]
    rg = [fw[1], -fw[0], 0.0]
    n = max(1e-6, math.sqrt(sum(v * v for v in rg))); rg = [v / n for v in rg]
    up = [rg[1] * fw[2] - rg[2] * fw[1],
          rg[2] * fw[0] - rg[0] * fw[2],
          rg[0] * fw[1] - rg[1] * fw[0]]
    keep = []
    for i, (nm, loc, col) in enumerate(DOC):
        P = (loc[0], loc[1] - 0.10, loc[2] + 0.032)
        v = [P[k] - C[k] for k in range(3)]
        zc = sum(v[k] * fw[k] for k in range(3))
        if zc <= 1e-3:
            continue
        hwm = zc * SENSOR / (2.0 * LENS); hhm = hwm * RES[1] / RES[0]
        # [lesson 188] same datum split as the frame loop, or the converge gate
        # would judge visibility against a size the render never uses.
        if job.get("set"):
            hw = plane_half_width_occ(math.sqrt(sum(x * x for x in v)),
                                      OCC_CONV, share)
        else:
            hw = min(plane_half_width(math.sqrt(sum(x * x for x in v)),
                                      INK_FRAC_CONV, share),
                     PAPER_W * PAPER_FIT * 0.5,
                     PAPER_H * PAPER_FIT * 0.5 * aspect)
        ex = abs(sum(v[k] * rg[k] for k in range(3)) / hwm) + (hw * share) / hwm
        ey = abs(sum(v[k] * up[k] for k in range(3)) / hhm) + (hw / aspect) / hhm
        if max(ex, ey) <= limit:
            keep.append(i)
    if len(keep) < 2:
        raise SystemExit("CONVERGE GATE FAILED %s: only %d sheet(s) in frame"
                         % (job["job_id"], len(keep)))
    return keep


def plane_half_width(dist, ink_frac, ink_share):
    """half-width in metres so the INK spans ink_frac of the frame width.

    Blender: frame width at distance d = d * sensor / lens.  The texture carries
    a transparent margin, so the plane must be slightly wider than the ink.
    """
    frame_w = dist * SENSOR / LENS
    return 0.5 * frame_w * ink_frac / max(1e-6, ink_share)


def plane_half_width_occ(dist, occ, ink_share, k=1.0):
    """half-width in metres so the INK occupies `occ` of the frame width.

    [lesson 188] This is the K2 formula, and it is the SAME arithmetic as
    plane_half_width -- deliberately so.  The difference is not the maths, it is
    what the number means and what may clamp it afterwards:

      plane_half_width      target = INK_FRAC, then clamped to the sheet
      plane_half_width_occ  target = frame occupancy measured off the CEO's own
                            approved stills, and NOTHING clamps it to paper

    k is the foreshortening factor sqrt(1 - (right . v)^2) from K2, floored at
    OCC_K_MIN so an almost edge-on plane cannot be scaled without bound.
    """
    frame_w = dist * SENSOR / LENS
    occ = min(OCC_MAX, max(OCC_MIN, occ))
    return 0.5 * frame_w * occ / (max(1e-6, ink_share) * max(OCC_K_MIN, k))


# three documents: magenta / cyan / yellow -- one colour, one role (rule 3)
# DOC is rebound per shot when the job names a set; DOC_LEGACY is the geometry
# the pre-scenemap jobs.json was rendered with and must keep rendering with.
DOC_LEGACY = [("docA", (-DOC_SPAN, -0.6, 0.05), (1, 0, 1)),
              ("docB", (0.00, -0.6, 0.05), (0, 1, 1)),
              ("docC", (DOC_SPAN, -0.6, 0.05), (1, 1, 0))]
DOC = DOC_LEGACY
DOC_Z_DEFAULT = 0.05


def build(job):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    S = bpy.context.scene
    global LENS, EASE_NAME
    LENS = float(job.get("lens") or LENS_DEFAULT)
    EASE_NAME = job.get("ease") or "smooth"
    if EASE_NAME not in EASE_FN:
        raise SystemExit("EASE GATE FAILED %s: unknown ease %r"
                         % (job["job_id"], EASE_NAME))

    # ---- the SET ----------------------------------------------------------
    # This used to be eight hard-coded boxes -- a grey slab, three brown walls,
    # three coloured sheets and a red cup -- IDENTICAL in all sixty cuts.  That
    # is the larger half of why the CEO said "every cut is the same and only the
    # word changes" (CEO-67 (5)): no camera vocabulary can rescue geometry that
    # never changes, and the frame read as "coloured paper on a grey floor" no
    # matter how it was shot.  The scene now comes from sets.py, selected per
    # shot by scenemap.py from the director's own `objects` line, so ACT3's desk,
    # ACT4's archive mezzanine and the shots that call for people are actually
    # different places.  Jobs without a `set` keep the legacy geometry so the old
    # jobs.json still renders bit-identically.
    global DOC
    set_id = job.get("set")
    if set_id:
        for name, kind, loc, sc, col in sets_build_spec(set_id):
            add(name, kind, loc, sc, col)
        # the three document slots of THIS set become the word carriers
        az = job.get("doc_z", DOC_Z_DEFAULT)
        DOC = [("docA", (job["doc_anchor"][0][0], job["doc_anchor"][0][1], az),
                (1, 0, 1)),
               ("docB", (job["doc_anchor"][1][0], job["doc_anchor"][1][1], az),
                (0, 1, 1)),
               ("docC", (job["doc_anchor"][2][0], job["doc_anchor"][2][1], az),
                (1, 1, 0))]
    else:
        # set is deliberately oversized (lesson 163): the camera must never see past it
        DOC = DOC_LEGACY
        add("desk", "cube", (0, 0, -0.15), (16, 12, 0.15), (0.10, 0.10, 0.10))
        add("wall", "cube", (0, 5.2, 3.2), (16, 0.12, 4.4), (0.34, 0.17, 0.05))
        add("wallL", "cube", (-7.0, 0, 3.2), (0.12, 12, 4.4), (0.30, 0.15, 0.05))
        add("wallR", "cube", (7.0, 0, 3.2), (0.12, 12, 4.4), (0.30, 0.15, 0.05))
        for n, loc, col in DOC:
            add(n, "cube", loc, (PAPER_W * 0.5, PAPER_H * 0.5, 0.02), col)
        add("cup", "cyl", (4.5, 0.5, 0.25), (0.28, 0.28, 0.25), (1, 0, 0))

    F = job["frames"]
    S.frame_start = 1; S.frame_end = F
    hold = job["hold_frac"]

    # ---- the word gesture -------------------------------------------------
    # The pv5 gesture (three words converging into ONE point) was written for a
    # single shot whose narrative is "the same role repeats across three
    # projects".  Applying it to all 60 jobs piled three glyphs on top of each
    # other and the generator turned the pile into red scribble (observed in the
    # J_A3-02 pilot).  So the gesture is chosen per job:
    #   converge : three words drift to one point   -- only where the script says
    #              the SAME thing repeats across the three documents
    #   lift     : ONE word rises in place on one document (the default)
    #   none     : no word at all (report pages, pure recap)
    word = os.path.join(WORDS, "%s.png" % job["act"])
    gesture = job.get("word_gesture", "lift")
    conv_gap_ndc = 0.0   # [lesson 196] set by the converge block below
    wm = word_meta(job["act"])
    mk = []
    if os.path.exists(word) and gesture != "none" and wm:
        if gesture == "converge":
            # they gather to ONE place but must stay three readable words -- a
            # single identical point piled them into red scribble (lesson 167),
            # so the target is a tight cluster, not a single coordinate.
            # the three words gather to one PLACE but keep a screen-constant gap.
            #
            # [lesson 195] That place must be WHERE THE CAMERA IS LOOKING, not a
            # fixed world point.  Measured on J_A3-03 at frame 60: the fixed
            # point (0,-0.30,0.92) sits 0.34 m in front of and 0.148 m below the
            # look-at target (0,0.04,1.068), so the whole stack projected to a
            # centre of ndcY -0.355 instead of 0.000.  The three planes were
            # correctly spaced (0.606 NDC apart, = CLUS_VFRAC) but the offset
            # centre pushed the bottom one to -0.960, and the gate read
            # ey = 0.960 + 0.116 = 1.08 -> off-frame.  Centred, the same stack
            # measures 0.606 + 0.113 = 0.719 and clears the frame.
            #
            # CONV=None means "track the target".  The legacy jobs.json shots
            # (no set) keep the fixed point: their delivered frames were
            # rendered against it, and the stability mandate forbids moving
            # geometry the CEO has already seen.
            CONV = None if job.get("set") else (0.0, -0.30, 0.92)
            # ---- only sheets that are ON SCREEN may carry a word -------------
            # A word printed on a document that the opening framing already cuts
            # off can never be rendered whole: measured, J_A5-03's left sheet sat
            # at 1.08 of the frame half-height during the hold, so its strokes
            # were sliced no matter how the glyph was scaled (the ink-share sweep
            # 0.20 -> 0.28 never cleared it, and clamping it into frame crushed
            # the ink to 137 px, below the readability floor).  The visible
            # sheets are selected from the HOLD framing, which is where the
            # viewer reads them; every converge shot keeps 2 or 3 of the 3.
            vis = visible_docs(job, wm)
            # [lesson 196] How many words can be stacked is decided by the
            # TEXTURE, not by how many sheets happen to be in frame.  The plane's
            # on-screen half-height is a closed form, independent of distance:
            #     hh = OCC / (ink_share * k) * (W/H) / aspect
            # For the 1-line textures that is 0.11 (three fit easily), but the
            # 3-line A5 texture measures 0.462 -- two of those already fill the
            # frame, and three collided (measured: stack 1.08 m > gap 0.84 m at
            # J_A5-03 frame 1).  So the gap must clear the plane HEIGHT, and the
            # count must be whatever still fits inside 0.94 of the half-frame.
            hh_ndc = (OCC_CONV / (wm["ink_frac"] * 1.0)
                      * (RES[0] / float(RES[1])) / wm["aspect"])
            gap_ndc = max(CLUS_VFRAC, 2.0 * hh_ndc * 1.02)
            conv_gap_ndc = gap_ndc
            n_fit = 1
            for n in (2, 3):
                if (n - 1) / 2.0 * gap_ndc + hh_ndc <= 0.94:
                    n_fit = n
            if len(vis) > n_fit:
                # keep the sheets nearest the centre of the reading order, so a
                # dropped word is an edge one, never the middle of the phrase.
                mid = (len(vis) - 1) / 2.0
                vis = sorted(sorted(vis, key=lambda i: abs(
                    vis.index(i) - mid))[:n_fit])
            # stack order: the leftmost document lands on top, so the reading
            # order of the sheets survives the gathering.
            n_vis = len(vis)
            for k, i in enumerate(vis):
                loc = DOC[i][1]
                base = (loc[0], loc[1] - 0.10, loc[2] + 0.032)  # >= +0.032 or it sinks
                m = add_tex("mark%d" % i, base, (1.0, 1.0, 1.0), word)
                # slot spreads the kept sheets evenly about the cluster centre
                slot = (n_vis - 1) / 2.0 - k
                mk.append((m, base, CONV, slot))
        else:
            # one word only, on the document named by the job, rising a little.
            #
            # [lesson 195] The rise is a SCREEN fraction, not a fixed 0.34 m.
            # Measured on J_A3-14 (creep_in, 50 mm): the camera closes to 0.71 m,
            # where the frame is only 0.51 m high, so a fixed 0.34 m rise is
            # 0.67 of the frame HALF-height and the glyph left the top of frame
            # at ndcY +1.15 (gate ey 1.28).  Swept over all 58 set-based lift
            # jobs the fixed rise breaks 5 of them; expressing the rise as
            # LIFT_VFRAC of the frame height clears every one (worst 0.874 at
            # 0.20, 0.960 at 0.24), because the rise now shrinks exactly as fast
            # as the framing tightens.  None -> resolve per frame.
            slot = {"A": 0, "B": 1, "C": 2}.get(job.get("word_doc", "B"), 1)
            loc = DOC[slot][1]
            base = (loc[0], loc[1] - 0.10, loc[2] + 0.032)
            m = add_tex("mark0", base, (1.0, 1.0, 1.0), word)
            mk.append((m, base, None if job.get("set") else
                       (base[0], base[1] - 0.06, base[2] + 0.34), 0.0))

    a, b = job["cam_start_xyz"], job["cam_end_xyz"]
    ta, tb = job["tgt_start_xyz"], job["tgt_end_xyz"]
    ra = math.hypot(a[0], a[1]); rb = math.hypot(b[0], b[1])
    a0 = math.atan2(a[0], -a[1])
    # ---- arc SIGN comes from the data, never from |arc_deg| -----------------
    # camtab.py alternates the sweep direction (sign = +1 / -1 on odd cuts) and
    # records the result in cam_end_xyz, but arc_deg is stored as a MAGNITUDE.
    # Driving a0 + |arc| sent 27 of the 60 jobs the wrong way round: J_A4-03
    # landed at +87 deg instead of -29 deg, so the camera flew past the desk and
    # filmed the bare wall (measured: 0 document pixels in the last frame).
    # The end angle is therefore taken from cam_end_xyz and the arc is the
    # shortest signed path to it.
    a1 = math.atan2(b[0], -b[1])
    arc = a1 - a0
    while arc > math.pi:
        arc -= 2 * math.pi
    while arc < -math.pi:
        arc += 2 * math.pi
    if abs(math.degrees(arc)) - abs(job["arc_deg"]) > 1.0:
        raise SystemExit("ARC GATE FAILED %s: |%.2f| vs arc_deg %.2f"
                         % (job["job_id"], math.degrees(arc), job["arc_deg"]))
    bpy.ops.object.camera_add(location=tuple(a))
    cam = bpy.context.object; S.camera = cam
    cam.data.lens = LENS
    tgt = bpy.data.objects.new("tgt", None)
    bpy.context.collection.objects.link(tgt)

    CONV_REF = (0.0, -0.30, 0.92)
    # [lesson 195] set-based shots gather the words at the look-at point so the
    # stack is centred in frame; legacy shots keep the delivered fixed point.
    conv_track = gesture == "converge" and bool(set_id)
    # [lesson 196] resolved in the gesture block above for set-based converge
    # shots; legacy shots keep the flat CLUS_VFRAC they were delivered with.
    conv_gap = conv_gap_ndc if (conv_track and conv_gap_ndc) else CLUS_VFRAC
    ink_frac = INK_FRAC_CONV if gesture == "converge" else INK_FRAC
    aspect = wm["aspect"] if wm else 2.0
    ink_share = wm["ink_frac"] if wm else 1.0
    # [lesson 188] the size DATUM is chosen once per shot, not per frame.
    # A job that names a set is a scenejobs.json shot with real A4 sheets, so it
    # is sized by approved frame occupancy.  A job with no set is a legacy
    # jobs.json shot whose delivered frames were rendered against the inflated
    # paper, so it must keep being rendered that way (stability mandate).
    occ_datum = bool(set_id)
    occ_target = OCC_CONV if gesture == "converge" else OCC_LIFT
    ink_px = []
    for f in range(1, F + 1):
        u = (f - 1) / max(1, F - 1)
        # the HOLD is real: nothing moves for the first hold_frac of the shot
        e = ease(max(0.0, (u - hold) / max(1e-6, 1.0 - hold)))
        ang = a0 + arc * e
        r = ra + (rb - ra) * e
        h = a[2] + (b[2] - a[2]) * e
        cx, cy, cz = r * math.sin(ang), -r * math.cos(ang), h
        cam.location = (cx, cy, cz)
        cam.keyframe_insert("location", frame=f)
        tgt.location = tuple(ta[i] + (tb[i] - ta[i]) * e for i in range(3))
        tgt.keyframe_insert("location", frame=f)

        # ---- glyph: constant share of the frame + billboarded toward camera ---
        # the cluster gap is resolved from the CURRENT camera distance, so the
        # words hold a constant on-screen separation at every focal distance,
        # and it is applied along the CAMERA UP AXIS so a word can never be
        # pushed sideways out of frame (measured failure of the world-X stack).
        # [lesson 195] the cluster reference follows the same rule as the
        # cluster itself: a set-based shot gathers at the look-at point, so the
        # gap is resolved at THAT distance; a legacy shot keeps the fixed point.
        if gesture == "converge":
            ref = tgt.location if conv_track else CONV_REF
            d_ref = math.sqrt((cx - ref[0]) ** 2 + (cy - ref[1]) ** 2
                              + (cz - ref[2]) ** 2)
        else:
            d_ref = 0.0
        # frame HEIGHT at the cluster, hence the 720/1280 term.
        # [lesson 196] the share is conv_gap, which already clears the plane's
        # own on-screen height (CLUS_VFRAC is only its floor).
        gap_m = d_ref * SENSOR / LENS * (RES[1] / RES[0]) * conv_gap
        # camera up axis (unit) -- forward is target minus camera, world Z is up
        fwd = (tgt.location[0] - cx, tgt.location[1] - cy, tgt.location[2] - cz)
        fn = max(1e-6, math.sqrt(sum(v * v for v in fwd)))
        fwd = tuple(v / fn for v in fwd)
        rgt = (fwd[1] * 1.0 - fwd[2] * 0.0, fwd[2] * 0.0 - fwd[0] * 1.0, 0.0)
        rn = max(1e-6, math.sqrt(sum(v * v for v in rgt)))
        rgt = tuple(v / rn for v in rgt)
        upv = (rgt[1] * fwd[2] - rgt[2] * fwd[1],
               rgt[2] * fwd[0] - rgt[0] * fwd[2],
               rgt[0] * fwd[1] - rgt[1] * fwd[0])
        frame_marks = []
        for m, loc, C, slot in mk:
            # [lesson 195] C is None -> the destination is resolved from the
            # CURRENT framing instead of a fixed world point, so it shrinks as
            # the framing tightens:
            #   converge : gather at the look-at point  -> stack centred in frame
            #   lift     : rise LIFT_VFRAC of the frame height above the sheet
            if C is not None:
                Cf = C
            elif gesture == "converge":
                Cf = tuple(tgt.location)
            else:
                d0 = math.sqrt((cx - loc[0]) ** 2 + (cy - loc[1]) ** 2
                               + (cz - loc[2]) ** 2)
                rise = d0 * SENSOR / LENS * (RES[1] / RES[0]) * LIFT_VFRAC
                # the sheet-ward drift keeps the original 0.06 : 0.34 ratio
                Cf = (loc[0], loc[1] - rise * (0.06 / 0.34), loc[2] + rise)
            off = tuple(upv[i] * slot * gap_m for i in range(3))
            wx = loc[0] + (Cf[0] + off[0] - loc[0]) * e
            wy = loc[1] + (Cf[1] + off[1] - loc[1]) * e
            wz = loc[2] + (Cf[2] + off[2] - loc[2]) * e
            m.location = (wx, wy, wz)
            dist = math.sqrt((cx - wx) ** 2 + (cy - wy) ** 2 + (cz - wz) ** 2)
            if occ_datum:
                # K1/K2: the plane's normal after yaw is (sin yaw, -cos yaw, 0)
                # rotated by pitch; the width that survives on screen is reduced
                # by the component of the view ray along the plane's right axis.
                vx, vy, vz = wx - cx, wy - cy, wz - cz
                vn = max(1e-6, math.sqrt(vx * vx + vy * vy + vz * vz))
                yaw0 = math.atan2(cx - wx, -(cy - wy))
                r_x, r_y = math.cos(yaw0), math.sin(yaw0)
                dot = (vx * r_x + vy * r_y) / vn
                k_fore = math.sqrt(max(0.0, 1.0 - dot * dot))
                hw = plane_half_width_occ(dist, occ_target, ink_share, k_fore)
            else:
                hw = plane_half_width(dist, ink_frac, ink_share)
            # ---- defect 1: the word must stay INSIDE its sheet of paper ------
            # While it is still printed ON the document it is clamped to the
            # sheet in BOTH axes; once it has lifted clear (e >= LIFTOFF) it is
            # free to grow to its full share of the frame.  Interpolating the
            # limit, not the scale, keeps the growth continuous.
            t_off = min(1.0, e / LIFTOFF)
            if not occ_datum:
                hw_paper = min(PAPER_W * PAPER_FIT * 0.5,
                               PAPER_H * PAPER_FIT * 0.5 * aspect)
                hw = min(hw, hw_paper + max(0.0, hw - hw_paper) * t_off)
            m.scale = (hw, hw / aspect, 1.0)
            # yaw to face the camera, pitch up toward it but never past pv5's lean
            yaw = math.atan2(cx - wx, -(cy - wy))
            flat_d = math.hypot(cx - wx, cy - wy)
            k = (dist - PITCH_NEAR) / (PITCH_FAR - PITCH_NEAR)
            k = min(1.0, max(0.0, k))
            pcap = MAX_PITCH + (MIN_PITCH - MAX_PITCH) * k
            pitch = min(pcap, math.atan2(flat_d, max(0.05, cz - wz)))
            # ---- defect 3: printed ink lies FLAT on the paper ----------------
            # a billboarded plane at rest reads as a sticker hovering over the
            # sheet.  During the hold the glyph is coplanar with the document
            # (pitch 0) and it only turns toward the lens as it rises.
            pitch *= t_off
            yaw *= t_off
            # ---- defect 6: the sheet must never OCCLUDE the lower strokes -----
            # Tying the rotation ramp to the rise ramp (LIFTOFF 1.00) is NOT
            # enough on its own: a lift job rises only 0.30 m while the glyph is
            # 0.71 m tall, so a 66 deg pitch still buries the bottom edge 0.35 m
            # under the paper -- measured on 46 of the 51 glyph jobs.  The limit
            # is geometric, so the cap is geometric too: a plane pitched by p puts
            # its bottom edge hh*sin(p) below its centre, so it stays clear of the
            # sheet exactly while sin(p) <= risen/hh.  Swept over every job this
            # drives the worst dip to 0.00000 m by construction, and the final
            # pitch still lands at 25-66 deg, so the ink keeps facing the lens.
            risen = max(0.0, wz - loc[2])
            pitch = min(pitch, math.asin(min(1.0, risen / max(1e-6, hw / aspect))))
            m.rotation_euler = (pitch, 0.0, yaw)
            m.keyframe_insert("rotation_euler", frame=f)
            m.keyframe_insert("location", frame=f)
            m.keyframe_insert("scale", frame=f)
            ink_px.append(2.0 * hw * ink_share / (dist * SENSOR / LENS) * RES[0])
            # the cap above makes this impossible; the gate proves it every run
            dip = (hw / aspect) * math.sin(abs(pitch)) - max(0.0, wz - loc[2])
            if dip > MAX_DIP_M:
                raise SystemExit(
                    "GLYPH GATE FAILED %s: sheet occludes glyph by %.3f m "
                    "at frame %d (pitch %.2f rad, risen %.3f m)"
                    % (job["job_id"], dip, f, pitch, wz - loc[2]))
            # ---- defect 4: the word must be WHOLLY INSIDE the frame ----------
            # pilot d put the near converge word at ndcX +0.83 with a half-width
            # of 0.20, so its outer strokes were sliced off by the frame edge and
            # a sliced word reads as broken typography, not "이미지 수준".  The
            # glyph centre is projected into NDC and the gate demands that the
            # whole plane, not just its centre, stays on screen.
            v = (wx - cx, wy - cy, wz - cz)
            zc = sum(v[i] * fwd[i] for i in range(3))
            if zc > 1e-3:
                hwm = zc * SENSOR / (2.0 * LENS)
                hhm = hwm * RES[1] / RES[0]
                ndx = sum(v[i] * rgt[i] for i in range(3)) / hwm
                ndy = sum(v[i] * upv[i] for i in range(3)) / hhm
                ex = abs(ndx) + (hw * ink_share) / hwm
                ey = abs(ndy) + (hw / aspect) / hhm
                if max(ex, ey) > 1.0:
                    raise SystemExit(
                        "GLYPH GATE FAILED %s: off-frame x %.2f y %.2f at frame %d"
                        % (job["job_id"], ex, ey, f))
            frame_marks.append((wx, wy, wz, hw))
        if gesture == "converge" and len(frame_marks) > 1:
            # stacked along the camera up axis, so the colliding dimension is the
            # plane HEIGHT (hw / aspect), checked against the real centre spacing
            for i in range(len(frame_marks) - 1):
                p, q = frame_marks[i], frame_marks[i + 1]
                sep = math.sqrt(sum((p[k] - q[k]) ** 2 for k in range(3)))
                need = (p[3] + q[3]) / aspect
                if need > sep * 1.02:
                    raise SystemExit(
                        "GLYPH GATE FAILED %s: stack %.2fm > gap %.2fm at frame %d"
                        % (job["job_id"], need, sep, f))
    c = cam.constraints.new('TRACK_TO')
    c.target = tgt; c.track_axis = 'TRACK_NEGATIVE_Z'; c.up_axis = 'UP_Y'

    if mk:
        lo, hi = min(ink_px), max(ink_px)
        # lesson 170 gate: a glyph thinner than 300 screen px will be reinvented
        # by the generator, which is the "저급" look the CEO rejected three times.
        if lo < MIN_INK_PX:
            raise SystemExit("GLYPH GATE FAILED %s: ink %.0f px < %d"
                             % (job["job_id"], lo, MIN_INK_PX))
        print("    glyph ink %.0f-%.0f px of %d (%s)"
              % (lo, hi, RES[0], gesture), flush=True)

    S.render.engine = 'CYCLES'; S.cycles.device = 'CPU'
    S.cycles.samples = SAMPLES; S.cycles.max_bounces = 0
    S.cycles.use_denoising = False
    S.render.resolution_x, S.render.resolution_y = RES
    S.render.image_settings.file_format = 'PNG'
    d = os.path.join(ROOT, job["job_id"])
    os.makedirs(d, exist_ok=True)
    S.render.filepath = os.path.join(d, "f_")
    return d, F


def mux(d, job):
    out = os.path.join(ROOT, job["job_id"] + ".mp4")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS),
                    "-i", os.path.join(d, "f_%04d.png"),
                    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", out],
                   check=True)
    for f in os.listdir(d):
        os.remove(os.path.join(d, f))
    os.rmdir(d)
    return out, os.path.getsize(out)


def main():
    jobs = json.load(open(JOBS))["jobs"]
    want = os.environ.get("PREVIZ_JOBS") or os.environ.get("PREVIZ_JOB") or "all"
    if want != "all":
        ids = set(want.split(","))
        jobs = [j for j in jobs if j["job_id"] in ids]
    # PREVIZ_DRY=1 builds every scene and runs every gate WITHOUT rendering.
    # A separate re-implementation of the geometry drifted from this file once
    # already, so the check has to execute the shipping code, not a copy of it.
    # 60 jobs cost about a minute here and save a 3.2 h render of bad frames.
    if os.environ.get("PREVIZ_DRY"):
        worst = (9e9, ""); n = 0
        for j in jobs:
            g = j.get("word_gesture", "lift")
            build(j)
            n += 1
        print("DRY OK  jobs %d  every gate passed" % n, flush=True)
        return
    os.makedirs(ROOT, exist_ok=True)
    t0 = time.time(); tf = 0
    for i, j in enumerate(jobs, 1):
        mp4 = os.path.join(ROOT, j["job_id"] + ".mp4")
        if os.path.exists(mp4):
            print("[%d/%d] %s SKIP (exists)" % (i, len(jobs), j["job_id"]), flush=True)
            continue
        d, F = build(j)
        t = time.time(); bpy.ops.render.render(animation=True); el = time.time() - t
        out, sz = mux(d, j)
        tf += F
        print("[%d/%d] %s  %df  %.1fs (%.3f s/f)  %s %dB  elapsed %.1fmin"
              % (i, len(jobs), j["job_id"], F, el, el / F, os.path.basename(out), sz,
                 (time.time() - t0) / 60), flush=True)
    print("BATCH DONE  jobs %d  frames %d  %.1f min" % (len(jobs), tf, (time.time() - t0) / 60),
          flush=True)


if __name__ == "__main__":
    main()
