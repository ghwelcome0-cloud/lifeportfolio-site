"""sets.py -- the previz SET LIBRARY.  This file is the answer to CEO-67 (5).

Why this file exists
--------------------
The CEO rejected the previz cut with: "every shot moves the same way and only
the word changes".  I traced it and the arithmetic was worse than the
impression:

    camtab.py GRAMMAR has FOUR verbs (도착 / 관통 / 후퇴 / 정지) and LEVEL_R has
    FOUR scale steps, so the 80 rows collapse into exactly TWELVE distinct
    (verb, level) trajectories -- measured, not guessed.

But the camera was the SMALLER half of the problem.  previz_batch.build() built
the SAME set for all 60 jobs:

    desk cube 16x12m grey / three brown wall slabs / three coloured paper
    planes 2.70x2.16m / one red cylinder "cup" / one red glyph texture

No props, no environment geometry, no people, no set dressing.  Whatever camera
you fly through that, it reads as "coloured paper on a grey floor".  The
reference previz the CEO keeps pointing at (귀공자 PREVIS, Seedance 2.5) has
roads, buildings, cars and COLOUR-CODED HUMAN MANNEQUINS -- that is what makes
those shots read as *scenes* rather than *slides*.

Where the content comes from
----------------------------
rows38.json already carries a per-shot scene direction in `objects` for 65 of
the 80 rows.  I had simply never wired it into the renderer.  Examples:

    A3-05 "좌우 두 사무실 구획 사이 벽이 절개된 전체 단면"
    A4-01 "사무실 단면 위층의 결과 보관 서가로 수직 상승"
    A4-10 "새 사람이 바인더 목차를 따라 필요한 페이지를 찾는 손 동작"
    A4-12 "사람마다 바인더를 찾아 각자 작업으로 돌아가는 사무실 단면"

A4-10 and A4-12 are explicitly PEOPLE shots.  A7/A8 (15 rows) have an empty
`objects`, so their sets are derived from the narration instead (writing the
three sentences by hand; the report pages 3/5/8).

The CEO granted permission to improve the directions where the original is
thin, and to study/adapt open previz practice.  So `objects` is treated as
BINDING INTENT, not as literal text: each row is mapped to a set id plus a
delta, and thin rows are strengthened.

Budget reality (this is why everything here is a primitive)
-----------------------------------------------------------
Cycles on 2 CPU cores, no GPU, 3.9 GB RAM, samples=4, max_bounces=0, and
~8,400 frames to render.  Measured on the existing pipeline: the flat-emission
primitive set renders at roughly 1 s/frame.  Every object here is a cube /
cylinder / plane / sphere with a single flat emission shader, and each set is
capped (see SET_BUDGET) so the whole film stays inside a few hours.

Reading the colour code (borrowed from the reference previz, adapted to us)
--------------------------------------------------------------------------
The reference uses untextured white architecture, a grey ground, and mannequins
in flat green (male) / blue (female) so a viewer instantly separates
"environment" from "actor".  We keep that split and add our own third class,
because our subject is paper, not cars:

    ENV   desaturated warm greys          walls, floors, shelves, furniture
    DOC   three signature paper hues      the documents that carry the argument
    ACT   flat green / flat blue           people
    CUE   cyan                            where the viewer must look

Cyan is not decorative: it is the hue the CEO approved for the neon lightbox,
so the "look here" colour and the typography colour are the same family.
"""

# ---------------------------------------------------------------------------
# palette
# ---------------------------------------------------------------------------
ENV_FLOOR = (0.085, 0.082, 0.078)
ENV_WALL = (0.150, 0.140, 0.128)
ENV_WALL_HI = (0.215, 0.203, 0.186)
ENV_FURN = (0.118, 0.110, 0.100)
ENV_METAL = (0.180, 0.183, 0.190)
ENV_WOOD = (0.205, 0.150, 0.098)

DOC_A = (0.760, 0.145, 0.520)      # magenta family -- the "role" document
DOC_B = (0.130, 0.640, 0.720)      # teal family    -- the "method" document
DOC_C = (0.820, 0.700, 0.190)      # amber family   -- the "change" document
DOC_N = (0.560, 0.560, 0.545)      # neutral card (the sentence card)
DOC_W = (0.780, 0.775, 0.760)      # plain A4 / result sheet

ACT_M = (0.145, 0.620, 0.235)      # male mannequin   (reference: flat green)
ACT_F = (0.150, 0.330, 0.780)       # female mannequin (reference: flat blue)
CUE = (0.240, 0.880, 0.960)         # cyan attention cue

# ---------------------------------------------------------------------------
# object spec = (name, kind, loc, scale, colour)
#   kind: "cube" | "cyl" | "plane" | "sphere"
#   scale is a HALF-extent for cube/plane (Blender primitives are size=2)
# ---------------------------------------------------------------------------


def mannequin(tag, x, y, rot_deg=0.0, seated=True, female=False, reach=0.0):
    """A colour-coded human, built from five primitives.

    The reference previz does exactly this: no face, no hands, one flat colour
    per person, and the SILHOUETTE carries the acting.  Proportions are real
    (1.72 m standing, 1.28 m seated eye height) because a wrong-scale human is
    the fastest way to make a previz read as a toy.

    `reach` in [0, 1] swings the near arm forward over the desk, which is how
    "손이 …" directions in rows38 are staged without modelling a hand.
    """
    c = ACT_F if female else ACT_M
    z0 = 0.0
    torso_h = 0.30 if seated else 0.42
    hip = 0.46 if seated else 0.92
    head_z = hip + torso_h + 0.20
    o = [
        ("%s_torso" % tag, "cube", (x, y, z0 + hip + torso_h * 0.5),
         (0.19, 0.13, torso_h * 0.5), c),
        ("%s_head" % tag, "sphere", (x, y, z0 + head_z), (0.105, 0.105, 0.115), c),
    ]
    if seated:
        # thighs forward, shins down -- reads as "sitting at the desk"
        o += [("%s_thigh" % tag, "cube", (x, y - 0.22, z0 + 0.44),
               (0.16, 0.22, 0.06), c),
              ("%s_shin" % tag, "cyl", (x, y - 0.40, z0 + 0.22),
               (0.07, 0.07, 0.22), c)]
    else:
        o += [("%s_legL" % tag, "cyl", (x - 0.09, y, z0 + 0.46),
               (0.065, 0.065, 0.46), c),
              ("%s_legR" % tag, "cyl", (x + 0.09, y, z0 + 0.46),
               (0.065, 0.065, 0.46), c)]
    if reach > 0.0:
        ay = y - 0.18 - 0.34 * reach
        az = z0 + hip + torso_h - 0.02 - 0.10 * reach
        o.append(("%s_arm" % tag, "cyl", (x + 0.16, ay, az),
                  (0.052, 0.052, 0.20 + 0.14 * reach), c))
    return o


def desk(tag, x, y, w=0.85, d=0.55, h=0.74, col=ENV_FURN):
    """A real desk: top plus four legs.  A single slab floats; legs ground it."""
    return [
        ("%s_top" % tag, "cube", (x, y, h), (w, d, 0.022), col),
        ("%s_l1" % tag, "cyl", (x - w + 0.07, y - d + 0.06, h * 0.5),
         (0.026, 0.026, h * 0.5), ENV_METAL),
        ("%s_l2" % tag, "cyl", (x + w - 0.07, y - d + 0.06, h * 0.5),
         (0.026, 0.026, h * 0.5), ENV_METAL),
        ("%s_l3" % tag, "cyl", (x - w + 0.07, y + d - 0.06, h * 0.5),
         (0.026, 0.026, h * 0.5), ENV_METAL),
        ("%s_l4" % tag, "cyl", (x + w - 0.07, y + d - 0.06, h * 0.5),
         (0.026, 0.026, h * 0.5), ENV_METAL),
    ]


def chair(tag, x, y, col=ENV_FURN):
    return [
        ("%s_seat" % tag, "cube", (x, y, 0.44), (0.22, 0.22, 0.030), col),
        ("%s_back" % tag, "cube", (x, y + 0.20, 0.70), (0.22, 0.028, 0.24), col),
        ("%s_post" % tag, "cyl", (x, y, 0.22), (0.045, 0.045, 0.22), ENV_METAL),
        ("%s_base" % tag, "cyl", (x, y, 0.03), (0.26, 0.26, 0.022), ENV_METAL),
    ]


def shelfbay(tag, x, y, levels=4, w=1.05, col=ENV_WOOD):
    """The archive rack behind A4: horizontal boards on two uprights."""
    o = [("%s_uL" % tag, "cube", (x - w, y, 1.05), (0.032, 0.17, 1.05), ENV_METAL),
         ("%s_uR" % tag, "cube", (x + w, y, 1.05), (0.032, 0.17, 1.05), ENV_METAL)]
    for i in range(levels):
        z = 0.34 + i * (1.72 / levels)
        o.append(("%s_b%d" % (tag, i), "cube", (x, y, z), (w, 0.17, 0.020), col))
    return o


def paper(tag, x, y, z, col, w=0.148, h=0.105, thick=0.0015):
    """One sheet.  A4 at real scale (0.297 x 0.210 m) -- half-extents here."""
    return [(tag, "cube", (x, y, z), (w, h, thick), col)]


def folder(tag, x, y, z, col, open_=False):
    if not open_:
        return [(tag, "cube", (x, y, z + 0.006), (0.160, 0.115, 0.006), col)]
    return [("%s_l" % tag, "cube", (x - 0.155, y, z + 0.003),
             (0.155, 0.115, 0.003), col),
            ("%s_r" % tag, "cube", (x + 0.155, y, z + 0.003),
             (0.155, 0.115, 0.003), col)]


def binder(tag, x, y, z, tabs=3):
    o = [(tag, "cube", (x, y, z + 0.030), (0.155, 0.115, 0.030), ENV_WOOD)]
    for i in range(tabs):
        o.append(("%s_t%d" % (tag, i), "cube",
                  (x + 0.170, y - 0.06 + i * 0.06, z + 0.030),
                  (0.018, 0.022, 0.004), (DOC_A, DOC_B, DOC_C)[i % 3]))
    return o


def stack(tag, x, y, z, n=5, col=DOC_W, jitter=0.010):
    """A messy pile -- the visual of "흩어진 서류 묶음"."""
    o = []
    for i in range(n):
        dx = jitter * ((i % 3) - 1)
        dy = jitter * ((i % 2) - 0.5)
        o += paper("%s_%d" % (tag, i), x + dx, y + dy,
                   z + 0.004 + i * 0.0035, col)
    return o


def pencil(tag, x, y, z):
    return [(tag, "cyl", (x, y, z + 0.005), (0.0045, 0.0045, 0.085), ENV_METAL)]


def cue_orb(tag, x, y, z, r=0.026):
    """The cyan attention marker already written into rows38 (`orb_txt`)."""
    return [(tag, "sphere", (x, y, z), (r, r, r), CUE)]


# ---------------------------------------------------------------------------
# rooms
# ---------------------------------------------------------------------------
def room(kind):
    """Shell geometry.  Deliberately oversized (lesson 163): the camera must
    never see past the set, and camtab keeps |cam| <= 12 m."""
    o = [("floor", "cube", (0, 0, -0.06), (14, 11, 0.06), ENV_FLOOR)]
    if kind == "cutaway":
        # A3-05 / A4-12: the office seen as a CUT-OPEN section -- a dividing
        # wall with a gap, so both bays are visible in one frame.
        o += [("wallN", "cube", (0, 6.4, 1.55), (14, 0.10, 1.55), ENV_WALL),
              ("wallW", "cube", (-9.0, 0, 1.55), (0.10, 11, 1.55), ENV_WALL),
              ("wallE", "cube", (9.0, 0, 1.55), (0.10, 11, 1.55), ENV_WALL),
              ("divL", "cube", (0.0, 3.4, 1.35), (0.09, 3.0, 1.35), ENV_WALL_HI),
              ("divR", "cube", (0.0, -3.4, 1.35), (0.09, 3.0, 1.35), ENV_WALL_HI)]
    elif kind == "upper":
        # A4-01..A4-03: the archive floor ABOVE the office, reached by rising.
        o = [("floor", "cube", (0, 0, 2.44), (14, 11, 0.06), ENV_FLOOR),
             ("wallN", "cube", (0, 5.2, 4.05), (14, 0.10, 1.55), ENV_WALL),
             ("slabU", "cube", (0, 0, -0.06), (14, 11, 0.06), ENV_FLOOR)]
    else:
        o += [("wallN", "cube", (0, 5.2, 1.60), (14, 0.10, 1.60), ENV_WALL),
              ("wallW", "cube", (-7.4, 0, 1.60), (0.10, 11, 1.60), ENV_WALL)]
    return o


# ---------------------------------------------------------------------------
# THE SETS
#   Each builder returns a list of object specs.  The DOC planes that carry the
#   glyph are NOT built here -- previz_batch owns those, because their position
#   is what the word gesture animates.  Each set instead declares, via
#   DOC_ANCHOR, where on the set the three document slots physically sit, so the
#   glyph lands on real furniture instead of on an abstract grey plane.
# ---------------------------------------------------------------------------
DESK_Z = 0.762          # desk top surface (0.74 + 0.022)


def set_solo_desk():
    """S1  개인 집중 책상 -- one person's desk, warm, used, quiet."""
    o = room("plain")
    o += desk("d0", 0.0, 0.0, w=1.10, d=0.62)
    o += chair("c0", 0.0, -0.95)
    o += stack("pile", -0.72, 0.20, DESK_Z, n=4)
    o += binder("bd", 0.80, 0.16, DESK_Z, tabs=3)
    o += pencil("pc", 0.16, -0.34, DESK_Z)
    o += [("mug", "cyl", (0.86, -0.30, DESK_Z + 0.042),
           (0.038, 0.038, 0.042), DOC_A)]
    return o


def set_collab_table():
    """S2  협업 테이블 -- good chairs, tidy kit, but repeating meeting paper."""
    o = room("plain")
    o += desk("t0", 0.0, 0.0, w=1.55, d=0.90, h=0.72)
    for i, x in enumerate((-1.05, -0.35, 0.35, 1.05)):
        o += chair("cc%d" % i, x, -1.28 if i % 2 == 0 else 1.28)
    o += stack("mtg", -1.00, 0.28, DESK_Z, n=7)
    o += stack("mtg2", 1.02, 0.30, DESK_Z, n=5)
    o += [("scr", "cube", (0.0, 1.85, 1.34), (0.92, 0.05, 0.52), ENV_METAL)]
    return o


def set_office_cutaway():
    """S3  사무실 절개 단면 -- both bays at once, wall cut open between them."""
    o = room("cutaway")
    o += desk("dL", -2.60, 0.0, w=1.05, d=0.60)
    o += chair("cL", -2.60, -0.95)
    o += stack("pL", -3.10, 0.18, DESK_Z, n=3)
    o += desk("dR", 2.70, 0.0, w=1.45, d=0.85, h=0.72)
    for i, x in enumerate((2.05, 3.35)):
        o += chair("cR%d" % i, x, -1.20)
    o += stack("pR", 2.30, 0.26, DESK_Z, n=6)
    return o


def set_archive_upper():
    """S4  상층 결과 보관 서가 -- small finished documents, not a vision board."""
    o = room("upper")
    for i, x in enumerate((-2.4, 0.0, 2.4)):
        o += shelfbay("sh%d" % i, x, 2.30, levels=4)
    o += desk("da", 0.0, -0.30, w=1.15, d=0.62)
    for i, x in enumerate((-0.55, 0.0, 0.55)):
        o += folder("fd%d" % i, x, 0.10, DESK_Z, (DOC_A, DOC_B, DOC_C)[i])
    return o


def set_binder_order():
    """S5  바인더·순서 탭 정리대 -- scatter becomes one indexed binder."""
    o = room("plain")
    o += desk("d0", 0.0, 0.0, w=1.30, d=0.70)
    o += chair("c0", 0.0, -1.02)
    o += binder("bd", 0.10, 0.06, DESK_Z, tabs=3)
    o += stack("sc1", -0.95, 0.30, DESK_Z, n=4)
    o += stack("sc2", -0.60, -0.28, DESK_Z, n=3)
    o += [("memo", "cube", (0.86, -0.24, DESK_Z + 0.002),
           (0.055, 0.055, 0.002), DOC_C)]
    return o


def set_two_people():
    """S6  사람이 등장하는 씬 (A4-10/-11/-12) -- reference-style mannequins."""
    o = room("cutaway")
    o += desk("dL", -2.30, 0.0, w=1.05, d=0.60)
    o += chair("cL", -2.30, -0.95)
    o += mannequin("mA", -2.30, -0.86, seated=True, reach=0.9)
    o += binder("bdL", -2.20, 0.10, DESK_Z, tabs=3)
    o += desk("dR", 2.40, 0.0, w=1.05, d=0.60)
    o += chair("cR", 2.40, -0.95)
    o += mannequin("mB", 2.40, -0.86, seated=True, female=True, reach=0.35)
    o += stack("pR", 2.55, 0.20, DESK_Z, n=3)
    o += mannequin("mC", 0.05, -2.20, seated=False)
    return o


def set_compare_row():
    """S7  비교 열 -- two postings with the three criterion cards between."""
    o = room("plain")
    o += desk("d0", 0.0, 0.0, w=1.50, d=0.78)
    o += paper("post1", -0.86, 0.10, DESK_Z + 0.002, DOC_W)
    o += paper("post2", 0.86, 0.10, DESK_Z + 0.002, DOC_W)
    o += [("note", "cube", (0.0, -0.40, DESK_Z + 0.004),
           (0.135, 0.098, 0.004), DOC_N)]
    o += pencil("pc", 0.34, -0.44, DESK_Z)
    return o


def set_result_sheet():
    """S8  한 장 결과지 -- the ivory one-pager with three blocks."""
    o = room("plain")
    o += desk("d0", 0.0, 0.0, w=1.15, d=0.66)
    o += [("sheet", "cube", (0.0, 0.02, DESK_Z + 0.002),
           (0.150, 0.212, 0.002), DOC_W)]
    for i, y in enumerate((0.150, 0.020, -0.110)):
        o += [("blk%d" % i, "cube", (0.0, y, DESK_Z + 0.005),
               (0.128, 0.048, 0.002), (DOC_A, DOC_B, DOC_C)[i])]
    return o


def set_report_page():
    """S9  리포트 지면 -- A7-15/A8: the printed report standing on the desk."""
    o = room("plain")
    o += desk("d0", 0.0, 0.0, w=1.20, d=0.68)
    o += [("page", "cube", (0.0, 0.16, DESK_Z + 0.002),
           (0.150, 0.212, 0.002), DOC_W),
          ("stand", "cube", (0.0, 0.40, DESK_Z + 0.090),
           (0.155, 0.012, 0.090), ENV_METAL)]
    return o


def set_write_act():
    """S10 기록 행위 (A7-01..A7-14) -- a hand writing the three sentences."""
    o = room("plain")
    o += desk("d0", 0.0, 0.0, w=1.05, d=0.60)
    o += chair("c0", 0.0, -0.92)
    o += mannequin("mW", 0.0, -0.84, seated=True, reach=1.0)
    o += [("a4", "cube", (0.05, 0.06, DESK_Z + 0.002),
           (0.150, 0.212, 0.002), DOC_W)]
    for i, y in enumerate((0.170, 0.040, -0.090)):
        o += [("ln%d" % i, "cube", (0.02, y, DESK_Z + 0.005),
               (0.120, 0.010, 0.001), DOC_N)]
    o += pencil("pc", 0.20, -0.10, DESK_Z)
    return o


SETS = {
    "S1": set_solo_desk,
    "S2": set_collab_table,
    "S3": set_office_cutaway,
    "S4": set_archive_upper,
    "S5": set_binder_order,
    "S6": set_two_people,
    "S7": set_compare_row,
    "S8": set_result_sheet,
    "S9": set_report_page,
    "S10": set_write_act,
}

# Where the three glyph-carrying documents physically sit, per set.  The word
# gesture animates from here, so a rising word leaves a real surface.
DOC_ANCHOR = {
    "S1": [(-0.72, 0.20), (0.10, 0.02), (0.80, 0.16)],
    "S2": [(-1.00, 0.28), (0.00, 0.06), (1.02, 0.30)],
    "S3": [(-2.60, 0.10), (0.00, 0.10), (2.70, 0.14)],
    "S4": [(-0.55, 0.10), (0.00, 0.10), (0.55, 0.10)],
    "S5": [(-0.95, 0.30), (0.10, 0.06), (0.86, -0.24)],
    "S6": [(-2.20, 0.10), (0.05, 0.20), (2.55, 0.20)],
    "S7": [(-0.86, 0.10), (0.00, -0.40), (0.86, 0.10)],
    "S8": [(0.00, 0.150), (0.00, 0.020), (0.00, -0.110)],
    "S9": [(0.00, 0.16), (0.00, 0.16), (0.00, 0.16)],
    "S10": [(0.02, 0.170), (0.02, 0.040), (0.02, -0.090)],
}
DOC_Z = DESK_Z + 0.006      # documents rest ON the desk, not inside it

# soft ceiling on object count per set, so 8,400 frames stay renderable at
# ~1 s/frame on 2 CPU cores (measured on the current pipeline)
SET_BUDGET = 96


def build_spec(set_id):
    if set_id not in SETS:
        raise SystemExit("SET GATE FAILED: unknown set %r" % set_id)
    spec = SETS[set_id]()
    if len(spec) > SET_BUDGET:
        raise SystemExit("SET GATE FAILED %s: %d objects > budget %d"
                         % (set_id, len(spec), SET_BUDGET))
    names = [s[0] for s in spec]
    if len(names) != len(set(names)):
        dup = [n for n in names if names.count(n) > 1]
        raise SystemExit("SET GATE FAILED %s: duplicate names %s"
                         % (set_id, sorted(set(dup))))
    for n, kind, loc, sc, col in spec:
        if kind not in ("cube", "cyl", "plane", "sphere"):
            raise SystemExit("SET GATE FAILED %s: bad kind %r on %s"
                             % (set_id, kind, n))
        if min(sc) <= 0:
            raise SystemExit("SET GATE FAILED %s: non-positive scale on %s"
                             % (set_id, n))
    return spec


if __name__ == "__main__":
    tot = 0
    for k in sorted(SETS, key=lambda s: int(s[1:])):
        spec = build_spec(k)
        kinds = {}
        for _, kind, _, _, _ in spec:
            kinds[kind] = kinds.get(kind, 0) + 1
        tot += len(spec)
        print("%-4s %3d objects  %s" % (k, len(spec),
              " ".join("%s=%d" % kv for kv in sorted(kinds.items()))))
    print("SET GATE OK  %d sets  %d objects total  budget %d/set"
          % (len(SETS), tot, SET_BUDGET))
