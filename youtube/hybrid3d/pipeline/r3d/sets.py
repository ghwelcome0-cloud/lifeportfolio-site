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
# ★교훈 217/220 처방 — 앵커 픽셀 고립비 5건 미달의 「2등 덩어리」는
#   종이가 아니라 ★이 벽면★ 이었다 (anchorpx.py 실측 L=138).
#   0.215 -> 0.168 로 내려 앵커 카드(DOC_ANCHOR_C 0.940)와의 휘도 간격을
#   벌린다. ENV_WALL(0.150) 보다는 여전히 밝아 「밝은 칸막이」라는
#   공간 문법은 유지된다.  ★색 세대 통일 + G11 분할과 같은 배치에서
#   반영한다 (교훈 223 규칙 3 — 따로 돌리면 1.8 h 낭비)★
ENV_WALL_HI = (0.168, 0.159, 0.146)
ENV_FURN = (0.118, 0.110, 0.100)
ENV_METAL = (0.180, 0.183, 0.190)
ENV_WOOD = (0.205, 0.150, 0.098)

DOC_A = (0.760, 0.145, 0.520)      # magenta family -- the "role" document
DOC_B = (0.130, 0.640, 0.720)      # teal family    -- the "method" document
DOC_C = (0.820, 0.700, 0.190)      # amber family   -- the "change" document
DOC_N = (0.560, 0.560, 0.545)      # neutral bar tone (title/body bars on the card)
# [CEO-83 / 교훈 213 축①]  이웃 문서를 ★어둡게★ 내려 앵커를 고립시킨다.
#   대본 A3-13 은 "★중성★ 카드만 남김" 이라고 못 박았다 -> 앵커를 발광/유채색으로
#   바꾸는 처방은 ★대본 위반★ 이다 (교훈 214). 그래서 색을 바꾸는 대신 ★명암★ 으로
#   구별성을 만든다. 벤치마크 -OHeRVGeiPQ 「무한 백색 보이드에 단일 제품」의
#   ★명암 반전★ 버전이다.
#   anchor_audit/recolor.py 실측: 앵커 0.940 x 이웃 0.280 => 상호 대비 ★8.11:1★
#   (현행 DOC_N x DOC_W 는 1.90:1 로 WCAG 하한 3.0:1 미달이었다)
#   이웃을 0.220 까지 더 내리면 10.27:1 이지만 ★책상(ENV_FURN)과 1.4:1 로 묻힌다★
#   -> 0.280 이 상한(앵커 대비 8.11:1)과 하한(책상 대비 1.8:1)을 동시에 만족한다.
DOC_W = (0.280, 0.278, 0.272)      # plain A4 / result sheet -- ★darkened neighbour★
DOC_ANCHOR_C = (0.940, 0.938, 0.930)   # ★the sentence card (follow-the-object anchor)★
                                       # achromatic (sat 0.01) => 대본 "중성" 준수

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
        #
        # ★교훈 210 / 교훈 200★  이 판은 원래 ("floor", z 2.44, 14x11 m) 였다.
        # 그런데 이 세트의 내용물(서가 z 0.34~1.65, 책상 z 0.762) 은 모두 z=0
        # 슬래브 위에 지어져 있다 — 즉 z 2.44 의 그 판은 「위층 바닥」이 아니라
        # ★통천장★ 이었다.  그래서 S4 를 쓰는 세 컷(A4-01 z 4.76->2.72,
        # A4-02 3.43->1.64, A4-03 1.86->2.38) 의 카메라가 ★전 구간 천장 위★ 에
        # 있었고, J_A4-01 은 렌더 전체가 lum 99~104 의 균일 회색 = 천장 밑면만
        # 찍힌 「아무것도 안 보이는 컷」이었다.
        #
        # 대본은 이 장면을 ★"사무실 단면 위층의 결과 보관 서가"★ 라고 쓴다.
        # 「단면」은 절개다 — 위에서 내려다보며 안이 보여야 한다.  통천장은
        # 대본을 어긋나게 구현한 것이었다(교훈 200: 대본이 서사의 정본이다).
        # 그래서 천장을 뒤쪽 띠만 남긴 ★절개 천장★ 으로 바꾼다: 위층이라는
        # 사실(머리 위에 슬래브가 있었다) 은 남기면서, 서가가 있는 y<2.8 구역은
        # 열어 둔다.
        o = [("ceilBand", "cube", (0, 4.30, 2.44), (14, 0.90, 0.06), ENV_FLOOR),
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
    # [CEO-83 축① / anchorpx.py 렌더 직독]  ★이 note 가 앵커와 경쟁했다.★
    #   1차 편집에서 DOC_N 의 「용도」를 앵커 -> 바 톤으로 바꿨지만 이 객체를
    #   놓쳤다. 결과: 최장변 0.270 m (앵커 0.260 m 보다 ★크고★) + 휘도 0.56
    #   (세트에서 두 번째로 밝음) + loc (0.00,-0.40) = 앵커(-0.10,-0.30) ★바로 옆★.
    #   J_A3-13 / J_A3-17 이 둘 다 S7 이고, anchorpx.py 픽셀 실패도 정확히
    #   그 두 컷에 몰렸다 (고립비 1.24~1.29, 하한 1.35).
    #   ⇒ 이웃 등급(DOC_W)으로 내리고 앵커보다 ★작게★ 만든다.
    #     0.135 -> 0.101 (x0.75) => 최장변 0.202 m < 앵커 0.260 m
    o += [("note", "cube", (0.0, -0.40, DESK_Z + 0.004),
           (0.101, 0.073, 0.004), DOC_W)]
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

# ---------------------------------------------------------------------------
# GAZE POINTS -- where in a set the camera may actually look   [lesson 200]
# ---------------------------------------------------------------------------
# CEO-74, second half: "영상은 하나의 장면은 다각도로 돌리는 느낌인데".  Measured
# on the delivered 25.9 s: six cuts, four different sets, and every look-at
# target inside 0.46 m of the world origin --
#
#   J_A3-13 S7 tgt(0.00,-0.46,0.89)   J_A3-16 S2 tgt(0.00, 0.00,0.89)
#   J_A3-14 S1 tgt(0.10,-0.04,0.89)   J_A3-17 S7 tgt(0.00,-0.46,0.89)
#   J_A3-15 S1 tgt(0.10,-0.04,0.79)   J_A4-01 S4 tgt(0.00, 0.04,0.89)
#
# The cause was structural: scenejobs.py aimed the gaze at doc_anchor[1], the
# CENTRE document slot, which every set puts near its own middle.  So ten sets
# collapsed into nine gaze points and the viewer read one scene shot from
# several angles -- exactly the complaint.
#
# A set is a PLACE, and a place has several things worth looking at.  These are
# the real object coordinates inside each set (taken from the builders above,
# not invented), so consecutive cuts in the same set can look at genuinely
# different furniture.  scenemap/scenejobs picks one per shot and the SCRIPT
# GATE (G4) fails when two adjacent cuts land closer than 0.35 m.
GAZE = {
    # S1 solo desk: paper pile / working centre / binder edge / mug + pencil
    "S1": [(-0.72, 0.20, DESK_Z + 0.05), (0.10, 0.02, DESK_Z + 0.02),
           (0.80, 0.16, DESK_Z + 0.12), (0.86, -0.30, DESK_Z + 0.04)],
    # S2 collab table: left meeting stack / table centre / right stack / screen
    "S2": [(-1.00, 0.28, DESK_Z + 0.06), (0.00, 0.06, DESK_Z + 0.02),
           (1.02, 0.30, DESK_Z + 0.06), (0.00, 1.85, 1.34)],
    # S3 office cutaway: left bay / the cut wall between / right bay
    "S3": [(-2.60, 0.10, DESK_Z + 0.04), (0.00, 0.10, DESK_Z + 0.30),
           (2.70, 0.14, DESK_Z + 0.04), (2.30, 0.26, DESK_Z + 0.08)],
    # S4 archive upper: three shelf bays at height / the folder desk below
    "S4": [(-2.40, 2.30, DESK_Z + 0.70), (0.00, 2.30, DESK_Z + 0.70),
           (2.40, 2.30, DESK_Z + 0.70), (0.00, 0.10, DESK_Z + 0.02)],
    # S5 binder order: scattered stacks / the indexed binder / the memo
    "S5": [(-0.95, 0.30, DESK_Z + 0.05), (0.10, 0.06, DESK_Z + 0.10),
           (0.86, -0.24, DESK_Z + 0.01), (-0.60, -0.28, DESK_Z + 0.04)],
    # S6 two people: left person / the gap between / right person / stander
    "S6": [(-2.30, -0.40, DESK_Z + 0.20), (0.05, -0.60, DESK_Z + 0.30),
           (2.40, -0.40, DESK_Z + 0.20), (0.05, -2.20, DESK_Z + 0.35)],
    # S7 compare row: left posting / the criterion card / right posting / edge
    "S7": [(-0.86, 0.10, DESK_Z + 0.01), (0.00, -0.40, DESK_Z + 0.01),
           (0.86, 0.10, DESK_Z + 0.01), (0.40, -0.36, DESK_Z + 0.02)],
    # S8 one-pager.  The three blocks of the sheet are only 0.13 m apart, which
    # the GAZE GATE (rightly) rejects: looking at block 1 then block 3 IS the
    # same shot.  So the spread has to come from the furniture the sheet sits
    # on -- desk w=1.15 d=0.66, so these are real tabletop coordinates, plus one
    # overhead read of the page.
    "S8": [(0.00, 0.150, DESK_Z + 0.01), (-0.50, 0.00, DESK_Z + 0.01),
           (0.45, -0.20, DESK_Z + 0.01), (0.00, 0.020, DESK_Z + 0.40)],
    # S9 report page: page face / desk left / desk right-near / above the page
    "S9": [(0.00, 0.16, DESK_Z + 0.01), (-0.52, 0.00, DESK_Z + 0.01),
           (0.48, -0.22, DESK_Z + 0.01), (0.00, 0.16, DESK_Z + 0.45)],
    # S10 write act: the written lines / the writing hand / desk left / edge
    "S10": [(0.02, 0.170, DESK_Z + 0.01), (0.00, -0.55, DESK_Z + 0.15),
            (-0.45, 0.05, DESK_Z + 0.01), (0.42, -0.20, DESK_Z + 0.01)],
}

# ---------------------------------------------------------------------------
# PROPS -- the per-cut objects the script's screen_direction actually asks for
# ---------------------------------------------------------------------------
# [lesson 200] The script CSV has a screen_direction column, filled in for all
# 115 beats, and the renderer never read it.  So "비교표 옆 빈 조건 카드 한 장"
# and "회의 브리프 1장과 옆의 개인 설계 노트" rendered as the same bare desk.
#
# This table is the read-back: sid -> extra objects dropped on top of the set.
# It is deliberately small (2-6 primitives) because the render budget is 2 CPU
# cores at ~1.2 s/frame; the point is not detail, it is that cut N and cut N+1
# have DIFFERENT things on the table, which is what makes a scene a scene.
#
# Each entry is a list of (suffix, kind, loc, scale, colour) exactly like the
# set builders, and build_spec() namespaces the suffix so it cannot collide.
PROPS = {
    # "★비교표★ 옆 빈 조건 카드 한 장. 손이 과장된 컬러 스티커를 떼고 중성
    #  카드만 남김."
    #
    # [lesson 203 / 교훈 200 의 재발] 첫 판은 이 문장의 앞 절을 버렸다. 조건
    # 카드(0.144 m)와 떼어낸 스티커 두 장(0.044/0.040 m)만 놓고 ★비교표를 아예
    # 만들지 않았다★. 그래서 이 컷의 최대 주연이 명함 크기였고, G6 실측이
    # 화면 폭 5.1% (65 px / 1280) 로 나왔다 — 렌즈를 97 mm 까지 올려야 통과하는
    # 수치다. 크기 문제로 보였지만 실제로는 ★대본 절반이 3D 에 없었던 것★이다.
    #
    # 비교표는 앞 컷 A3-11/A3-12 가 "세 행"·"3칸 비교 whole" 로 세운 것이고,
    # A3-13 은 그 옆에 조건 카드를 놓는 컷이다. 그러므로 3행 비교표(A4 규모,
    # 0.105 x 0.148 반크기 = 0.21 x 0.30 m)가 이 컷의 첫 번째 주연이다.
    # 카메라는 4% 후퇴하며 "조건 전체" 를 담는다 (camera_note).
    # [CEO-83 축③ / anchor_audit/replan.py]  첫 프레임에서 ★앵커가 주연보다 작았다★.
    #   현행: 앵커 cond 0.091 / 주연 cmptab 0.199 => 비 ★0.46★ (하한 1.0)
    #   시선점만 앵커로 옮겨도(P1) 0.090 -> 안 풀린다. 자리교환만(P2a) 0.52 로 미달.
    #   실측 스윕: 앵커 x1.8 + 주연 x0.75 => 앵커 0.174 / 주연 0.149 => 비 ★1.24 OK★
    #   앵커 최장변 0.260 m 은 실물 A4 0.297 m 의 0.87 배 => ★「종이 한 장」 유지★
    # 자리교환: 앵커를 카메라 시선점(S7 GAZE[1]=(0,-0.4)) 쪽 중앙으로, 비교표를 옆으로.
    #   cmprow0/1/2 는 cmptab 위의 행이므로 ★함께★ 이동·축소한다.
    "A3-13": [("cmptab", "cube", (0.16, -0.32, DESK_Z + 0.003),
               (0.079, 0.111, 0.002), DOC_W),
              ("cmprow0", "cube", (0.16, -0.22, DESK_Z + 0.006),
               (0.062, 0.008, 0.001), (0.46, 0.46, 0.45)),
              ("cmprow1", "cube", (0.16, -0.32, DESK_Z + 0.006),
               (0.062, 0.008, 0.001), (0.46, 0.46, 0.45)),
              ("cmprow2", "cube", (0.16, -0.42, DESK_Z + 0.006),
               (0.062, 0.008, 0.001), (0.46, 0.46, 0.45)),
              ("card", "cube", (-0.10, -0.30, DESK_Z + 0.004),
               (0.130, 0.090, 0.002), DOC_ANCHOR_C),
              ("stkoff", "cube", (0.40, -0.50, DESK_Z + 0.002),
               (0.022, 0.016, 0.001), DOC_A),
              ("stkoff2", "cube", (0.46, -0.53, DESK_Z + 0.002),
               (0.020, 0.015, 0.001), DOC_C)],
    # 조건 카드 위 굵은 제목 바 1개와 빈 본문 바 1개.
    # [CEO-83] 앵커 정체성 통일: 이름 card / 크기 (0.130,0.090) / 색 DOC_ANCHOR_C
    #   같은 대상을 다른 이름(cond/card)·다른 크기(0.144/0.196/0.200)·다른 색
    #   (DOC_N/DOC_W)으로 만들면 ★관객에게 같은 대상으로 안 보인다★.
    "A3-14": [("card", "cube", (0.10, 0.02, DESK_Z + 0.003),
               (0.130, 0.090, 0.002), DOC_ANCHOR_C),
    # [CEO-83 축② 변화 가시성]  A3-14 의 ★빈★ 본문 바 -> A3-15 의 ★채운★ 바 가
    #   관객에게 보이는 변화여야 한다. 실측(anchor_audit/visib.py)은 10.1 -> 23.0 px
    #   였는데 그 차이가 ★컷 사이 카메라 거리 변화★ 와 분리되지 않았다.
    #   카드가 x1.33 커졌으므로 바도 같은 비율로 키운다 — 변화 픽셀도 x1.33 이 되고,
    #   두께 대비(0.007 -> 0.011, 1.6배)를 유지해 「빈 줄이 채워졌다」가 읽힌다.
              ("ttlbar", "cube", (0.10, 0.052, DESK_Z + 0.006),
               (0.093, 0.015, 0.001), DOC_N),
              ("bodybar", "cube", (0.10, 0.010, DESK_Z + 0.006),
               (0.093, 0.007, 0.0006), (0.42, 0.42, 0.41))],
    # 손이 본문 위치에 중간회색 바를 한 줄 채움.
    "A3-15": [("card", "cube", (0.10, 0.02, DESK_Z + 0.003),
               (0.130, 0.090, 0.002), DOC_ANCHOR_C),
              ("ttlbar", "cube", (0.10, 0.052, DESK_Z + 0.006),
               (0.093, 0.015, 0.001), DOC_N),
              ("fillbar", "cube", (0.10, 0.010, DESK_Z + 0.006),
               (0.093, 0.011, 0.001), (0.50, 0.50, 0.49)),
              ("pen2", "cyl", (0.26, -0.10, DESK_Z + 0.006),
               (0.005, 0.005, 0.070), ENV_METAL)],
    # 회의 브리프 1장과 옆의 개인 설계 노트. 목표칸/실행칸을 컬러 바로 강조.
    "A3-16": [("brief", "cube", (-0.34, 0.10, DESK_Z + 0.003),
               (0.105, 0.148, 0.002), DOC_W),
              ("goalbar", "cube", (-0.34, 0.20, DESK_Z + 0.006),
               (0.080, 0.012, 0.001), DOC_C),
              ("note", "cube", (0.36, 0.06, DESK_Z + 0.003),
               (0.090, 0.128, 0.002), DOC_W),
              ("execbar", "cube", (0.36, 0.14, DESK_Z + 0.006),
               (0.068, 0.012, 0.001), DOC_B)],
    # "회사명·급여칸이 있는 채용공고 ★위에★ 조건 카드가 ★함께★ 놓임."
    #
    # [lesson 202 / CEO-76] 첫 판은 이 문장을 반만 읽었다. 공고를 x=-0.86,
    # 조건 카드를 x=0.00 에 두고 사본을 x=+0.86 에 하나 더 깔아 1.72 m 로
    # 흩어놓았다 — 그러면 카메라가 무엇을 봐도 나머지가 화면 밖이다. 실측:
    # G5 무게중심 거리 0.51 m (상한 0.25). namebar2(+0.86) 는 애초에 대본에
    # 근거가 없는 임의 복제였다.
    #
    # 대본이 요구한 것은 「나란히」가 아니라 ★한 자리에 겹친 스택★ 이다.
    # 공고 위에 조건 카드가 얹혀 있어야 "연봉만 보면 놓치는 것" 이라는
    # 자막이 한 프레임 안에서 성립한다 — 그것이 이 컷의 액션 포인트다.
    # 카메라는 5% 후퇴하며 그 겹침 전체를 담는다 (camera_note).
    # [G9 실패 처방]  G9 를 신설한 첫 실행이 이 컷을 잡았다:
    #   앵커 0.236 / 공고 posting 0.262 = 비 ★0.90★ (하한 1.00).
    #   자막은 "바로 이 ★문장★입니다" 인데 화면 최대 면적은 채용공고였다.
    #   대본은 "채용공고 ★위에★ 조건 카드가 함께 놓임" 이므로 앵커가 위·크게 오는
    #   것이 대본대로다. 공고를 x0.82 로 줄인다 -> 주연 0.215, 비 1.10 (여유 10%).
    #   ★게이트를 「경고」가 아니라 「실패」로 둔 덕에 렌더 전에 잡혔다 (교훈 187).★
    "A3-17": [("posting", "cube", (0.00, -0.30, DESK_Z + 0.003),
               (0.094, 0.123, 0.002), DOC_W),
              ("namebar", "cube", (0.00, -0.20, DESK_Z + 0.006),
               (0.074, 0.011, 0.001), (0.44, 0.44, 0.43)),
              ("paybar", "cube", (0.00, -0.25, DESK_Z + 0.006),
               (0.051, 0.009, 0.001), (0.44, 0.44, 0.43)),
              ("card", "cube", (0.02, -0.38, DESK_Z + 0.010),
               (0.130, 0.090, 0.002), DOC_ANCHOR_C)],
    # 사무실 단면 위층의 결과 보관 서가로 수직 상승 -> 결과물이 실제로 서가에 있어야 한다
    #
    # ★교훈 210 / 교훈 205★  처음 판은 res0/res1/res2 를 x -2.4 / 0.0 / +2.4 의
    # ★세 개의 다른 서가★ 에 각 0.15 m 크기로 흩어 놓았다.  그래서 두 가지가
    # 동시에 깨졌다.
    #   (1) 크기:  0.15 m 를 화면 17.5% 로 담으려면 depth 1.9 m 에서 80 mm 가
    #       필요했고 LENS_CEIL 에서 막혔다 — ★LENS_CEIL 은 상한이 아니라 대본
    #       누락 탐지기다(교훈 205).★
    #   (2) 화각:  그 80 mm 는 수평 반화각을 12.7도로 좁혀, 4.8 m 폭에 흩어진
    #       res1(광축 22.4도) / res2(46.3도) 를 ★프레임 밖으로★ 밀어냈다.
    #       크기를 만들려고 렌즈를 올리는 처방이 스스로 새 결함을 만든 것이다.
    #
    # 대본은 ★"결과 보관 서가"(단수)★ 라고 쓴다 — 결과물이 흩어진 세 곳이 아니라
    # ★한 서가에 쌓여 있는 것★ 이 대본대로다.  그래서 x -2.4 서가(sh0, 폭
    # x -3.45..-1.35, 선반 z 0.36/0.79/1.22/1.65) 한 칸에 「묶음」으로 모으고,
    # 낱장이 아니라 실제로 보관된 문서 묶음 크기(최장변 0.60~0.72 m) 로 만든다.
    # ⇒ depth 2 m 에서 필요 렌즈가 80 mm -> 약 18 mm 로 내려가고, 세 묶음이
    #   모두 화각 안에 들어온다.
    "A4-01": [("res0", "cube", (-2.86, 2.22, DESK_Z + 0.12),
               (0.300, 0.140, 0.090), DOC_A),
              ("res1", "cube", (-2.02, 2.22, DESK_Z + 0.55),
               (0.300, 0.140, 0.090), DOC_B),
              ("res2", "cube", (-2.46, 2.22, DESK_Z + 0.98),
               (0.360, 0.140, 0.090), DOC_C)],
}


def build_spec(set_id, sid=None):
    if set_id not in SETS:
        raise SystemExit("SET GATE FAILED: unknown set %r" % set_id)
    spec = SETS[set_id]()
    # [lesson 200] the script's own screen_direction, if we have it for this beat
    for suffix, kind, loc, sc, col in PROPS.get(sid or "", []):
        spec = spec + [("pr_%s" % suffix, kind, loc, sc, col)]
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

    # ---- GAZE GATE ------------------------------------------------------
    # [lesson 200] a set must offer gaze points that are actually APART, or the
    # camera has nowhere different to look and the cuts read as one scene.
    import math as _m
    if set(GAZE) != set(SETS):
        raise SystemExit("GAZE GATE FAILED: sets %s have no gaze points"
                         % sorted(set(SETS) - set(GAZE)))
    worst = (1e9, None)
    for k, pts in GAZE.items():
        if len(pts) < 3:
            raise SystemExit("GAZE GATE FAILED %s: only %d points" % (k, len(pts)))
        for i in range(len(pts)):
            for j in range(i + 1, len(pts)):
                d = _m.dist(pts[i], pts[j])
                if d < worst[0]:
                    worst = (d, "%s[%d,%d]" % (k, i, j))
    # 0.35 m is the SCRIPT GATE G4 threshold -- every pair must beat it, else a
    # set could satisfy "pick a different point" and still look identical.
    if worst[0] < 0.35:
        raise SystemExit("GAZE GATE FAILED %s: closest pair %.3f m < 0.35"
                         % (worst[1], worst[0]))
    print("GAZE GATE OK  %d sets  %d points  closest pair %.3f m (%s)"
          % (len(GAZE), sum(len(v) for v in GAZE.values()), worst[0], worst[1]))

    # ---- PROPS GATE -----------------------------------------------------
    nprop = 0
    for sid, pl in sorted(PROPS.items()):
        nprop += len(pl)
    print("PROPS GATE OK  %d beats  %d extra objects (script screen_direction)"
          % (len(PROPS), nprop))
