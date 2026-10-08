"""scenemap.py -- bind every shot in rows38.json to a SET and a CAMERA GRAMMAR.

This is the second half of the answer to CEO-67 (5).  sets.py fixed "the scene
is always the same"; this file fixes "the movement is always the same".

The measured starting point
---------------------------
camtab.py derives all 80 shots from four verbs and four level multipliers, and
the actual distinct (verb, level) pairs present in rows38.json number TWELVE:

    관통·L1 15   관통·L2 12   도착·L0 10   후퇴·L2 10
    도착·L1  6   도착·L2  6   도착·L3  6   후퇴·L3  5
    정지·L3  5   후퇴·L1  3   정지·L2  1   후퇴·L0  1

Twelve trajectories over sixty cuts is why the CEO said every shot moves the
same way.  The reference previz he pointed at does not have four moves; it has
a vocabulary -- rear tracking, low-angle pan, drone descent, interior POV,
foot-level close-up, over-the-shoulder, whip pan -- and it picks per beat.

What this file does
-------------------
1. SET MAP.  Every sid gets a set id.  For the 65 rows that already carry an
   `objects` direction the set is derived from that text by keyword, so the
   director's intent -- not my taste -- selects the scene.  The 15 A7/A8 rows
   whose `objects` is empty are derived from the narration instead (writing the
   three sentences by hand; the report pages).  Where the original direction is
   thin the CEO has authorised strengthening it, which is recorded as a DELTA
   rather than by editing rows38.json, so the source of truth stays intact.

2. CAMERA GRAMMAR.  Twenty-two named moves, each with its own radius/height
   path, arc, lens and easing profile.  Selection is DETERMINISTIC: it reads
   only verb, level, the set, and keywords already present in the row, so the
   same input always yields the same shot and I can never quietly hand-tune one
   cut and forget another (which is exactly the "improvements drift apart"
   problem the CEO called out).

3. CONTINUITY.  Adjacent shots inside the same set are chained: the next shot
   starts where the previous one ended unless the pair is a deliberate cut.
   That is what makes the film read as one continuous piece instead of a
   flip-book of separate moves.  Deliberate cuts happen only at set changes and
   at act boundaries, and every one of them is recorded with a reason.

Nothing here renders.  It emits scenemap.json, which previz_batch consumes.
"""
import json, math, os, sys, collections

SRC = "/home/user/lf/work/longform/rows38.json"
OUT = "/home/user/lf/r3d/scenemap.json"
FPS = 24

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sets import SETS, DOC_ANCHOR, DOC_Z, DESK_Z, build_spec, PROPS   # noqa: E402

# Every z in MOVES is a height ABOVE THE WORKING SURFACE, not a world z.
# The old hard-coded set had its desk slab centred at -0.15 m so "z = 0.90" and
# "world z = 0.90" happened to coincide; sets.py puts the real tabletop at
# 0.762 m, and keeping the old numbers put the lens 0.80 m up -- under the table
# (measured: J_A3-07 tripped the height gate).  Stating the datum once, here,
# is what stops that class of bug from recurring silently.
CAM_DATUM = DESK_Z


# ---------------------------------------------------------------------------
# 1. SET MAP -- keyword rules over the director's own `objects` text
#    Order matters: the FIRST matching rule wins, most specific first.
# ---------------------------------------------------------------------------
SET_RULES = [
    # people are the strongest signal -- the reference previz reads as a scene
    # precisely because bodies are in it
    ("S6", ("새 사람이", "사용하는 사람", "사람마다")),
    ("S4", ("서가", "선반", "위층", "수직 상승", "보관")),
    ("S3", ("절개", "단면", "두 사무실", "2구획", "구획")),
    ("S5", ("바인더", "순서 탭", "흩어진", "중복 질문", "정리")),
    ("S8", ("결과지", "세 블록", "아이보리", "한 장짜리")),
    ("S9", ("리포트", "3쪽", "5쪽", "8쪽", "미리보기", "발급본")),
    ("S7", ("채용공고", "공고", "비교 열", "비교표", "면접 노트", "면접노트",
            "상태표", "질문 카드")),
    ("S2", ("협업", "회의", "브리프", "알림")),
    ("S10", ("연필", "지우개", "초안", "기록지", "빈 종이", "적고", "씁니다")),
    ("S1", ("책상", "노트", "명함", "조직도", "직무기술서", "서류", "폴더",
            "카드", "종이")),
]

# A7/A8 have no `objects`.  Their sets come from what the narration is doing.
NARR_SETS = {
    "A7": "S10",     # the viewer is told to write the three sentences
    "A8": "S9",      # the report pages 3 / 5 / 8 and the closing
}

# Deltas -- the CEO authorised improving thin directions.  Each entry says what
# the shot needs ON TOP of its set, and why.  These are consumed by
# previz_batch as extra props; rows38.json itself is never rewritten.
DELTA = {
    "A3-03": ("timer_note", "역할 카드 뒤로 일정표·타이머가 드러나야 한다는 "
                            "지시문을 소품으로 실체화"),
    "A3-13": ("sticker_off", "손이 컬러 스티커를 떼는 동작 -- 마네킹 팔 리치로 표현"),
    "A4-06": ("graph_face_down", "숫자 그래프를 뒤집어 놓는다는 지시문의 물리 표현"),
    "A5-10": ("calc_out", "계산기·점수표를 프레임 밖으로 치운다 -- 시작 프레임에만 존재"),
    "A6-06": ("blur_plan", "미래 일정표는 흐리게 -- 원거리 배치로 피안 처리"),
}


def set_of(row):
    sid = row["sid"]
    txt = (row.get("objects") or "")
    if txt.strip():
        for sid_set, keys in SET_RULES:
            if any(k in txt for k in keys):
                return sid_set, "objects"
    act = sid.split("-")[0]
    if act in NARR_SETS:
        return NARR_SETS[act], "narration"
    return "S1", "default"


# ---------------------------------------------------------------------------
# 2. CAMERA GRAMMAR -- 22 named moves
#    (r0, r1, z0, z1, arc_deg, lens_mm, hold_frac, ease_name)
#    r is the horizontal distance from the shot centre, z the camera height.
#    Our set is a room of desks: a "drone descent" is a high wide fall onto the
#    desk, an "interior POV" is a low lens at seated eye height, a "foot-level
#    close-up" becomes a desk-surface graze.  Same craft, our subject.
# ---------------------------------------------------------------------------
MOVES = {
    # --- arrivals: get closer -------------------------------------------------
    "drone_drop":      (7.60, 2.05, 4.60, 1.35, 46.0, 28.0, 0.18, "smooth"),
    # ★교훈 211★ 위 drone_drop 은 z 4.60 이라 우리 10 세트 ★어디에도 안 들어간다
    # (0/10)★ — 실외/대공간용 무브가 카탈로그에 섞여 있었다.  높이 필터를 켜면
    # 「도착」 풀과 L0 선호가 얇아져 VARIETY GATE 가 13 종으로 떨어진다.  가드로
    # 상한을 풀지 않고(교훈 199) ★실내 천장 아래에서 같은 일을 하는 무브★ 를
    # 신설해 다양성을 회복한다.  세 무브 모두 maxz <= 2.05 로 S2~S4/S6 에 들어간다.
    "eave_drop":       (5.20, 1.90, 2.02, 1.12, 42.0, 30.0, 0.18, "smooth"),
    "shelf_descend":   (3.30, 1.55, 1.98, 0.96, 38.0, 36.0, 0.20, "ease_out"),
    "ridge_skim":      (2.90, 2.75, 1.72, 1.60, 92.0, 32.0, 0.16, "smooth"),
    # 「후퇴」 풀도 같은 이유로 얇아진다: pull_reveal(2.35)/lift_out(3.40)/
    # wide_open(2.85) 이 낮은 세트에서 탈락하고 step_back 만 남아 25% 로 편중된다.
    # 실내 천장 아래에서 물러나는 두 무브를 신설한다.
    "ease_back":       (1.70, 3.05, 0.98, 1.34, 40.0, 34.0, 0.24, "ease_out"),
    "sill_retreat":    (1.45, 2.60, 0.88, 1.16, 30.0, 40.0, 0.26, "ease_out"),
    # 「관통」의 마지막 한 축: 낮은 세트(S1/S5/S7/S8/S9, top<=1.07)에서는 low_pan
    # 급만 남아 A5-07/A5-08 이 연달아 low_pan 을 집는다.  같은 높이대에서 반대
    # 방향으로 지나가는 무브를 하나 더 둔다.
    "table_glide":     (2.15, 2.05, 0.92, 0.90, 78.0, 38.0, 0.16, "linear"),
    "crane_settle":    (5.40, 1.85, 3.10, 1.02, 62.0, 34.0, 0.22, "smooth"),
    "push_in":         (3.60, 1.35, 1.45, 0.98, 34.0, 40.0, 0.26, "ease_out"),
    "creep_in":        (2.30, 1.05, 1.06, 0.88, 22.0, 50.0, 0.30, "linear"),
    "vault_up":        (4.20, 2.40, 0.78, 3.35, 40.0, 30.0, 0.20, "ease_in"),
    "desk_graze":      (1.90, 0.92, 0.90, 0.80, 30.0, 45.0, 0.24, "ease_out"),
    # --- traversals: move across --------------------------------------------
    "lateral_track":   (3.20, 3.05, 1.28, 1.22, 96.0, 35.0, 0.16, "smooth"),
    "rear_follow":     (2.70, 2.15, 1.18, 1.06, 58.0, 40.0, 0.18, "smooth"),
    "low_pan":         (2.55, 2.45, 0.86, 0.84, 112.0, 28.0, 0.14, "smooth"),
    "whip_across":     (3.05, 2.95, 1.34, 1.30, 148.0, 24.0, 0.12, "ease_in_out"),
    "orbit_half":      (3.85, 3.70, 1.62, 1.55, 132.0, 32.0, 0.16, "smooth"),
    "shoulder_swing":  (2.20, 1.95, 1.24, 1.14, 74.0, 42.0, 0.20, "smooth"),
    "cross_bay":       (5.10, 4.60, 2.05, 1.72, 88.0, 26.0, 0.16, "smooth"),
    "shelf_slide":     (3.40, 3.30, 2.95, 2.88, 104.0, 34.0, 0.15, "linear"),
    # --- retreats: open out --------------------------------------------------
    "pull_reveal":     (1.55, 4.85, 0.96, 2.35, 52.0, 30.0, 0.24, "ease_out"),
    "lift_out":        (1.85, 4.20, 1.02, 3.40, 44.0, 28.0, 0.22, "smooth"),
    "step_back":       (2.05, 3.35, 1.10, 1.62, 36.0, 38.0, 0.26, "ease_out"),
    "wide_open":       (3.10, 6.40, 1.55, 2.85, 66.0, 24.0, 0.20, "smooth"),
    # --- holds: minimal but never still (Article 14 (13)) --------------------
    "breathe_in":      (1.62, 1.42, 0.94, 0.90, 16.0, 48.0, 0.34, "linear"),
    "drift_side":      (1.95, 1.90, 1.00, 0.99, 26.0, 45.0, 0.32, "linear"),
    "settle_tilt":     (2.35, 2.28, 1.42, 1.16, 18.0, 42.0, 0.30, "ease_out"),
    "hold_wide":       (4.30, 4.18, 2.10, 2.04, 20.0, 30.0, 0.32, "linear"),
}

# --- selection: deterministic, reads only data already in the row -----------
# Each verb owns a pool; the pool index is chosen by (set, level, position) so
# neighbouring shots in the same set never draw the same move twice in a row.
POOL = {
    "도착": ["drone_drop", "crane_settle", "push_in", "creep_in",
             "vault_up", "desk_graze", "eave_drop", "shelf_descend"],
    "관통": ["lateral_track", "rear_follow", "low_pan", "whip_across",
             "orbit_half", "shoulder_swing", "cross_bay", "shelf_slide",
             "ridge_skim", "table_glide"],
    "후퇴": ["pull_reveal", "lift_out", "step_back", "wide_open",
             "ease_back", "sill_retreat"],
    "정지": ["breathe_in", "drift_side", "settle_tilt", "hold_wide"],
}

# Some moves only make sense in some sets; this narrows the pool BEFORE the
# rotation picks, so a "shelf_slide" can never happen on a solo desk.
SET_ONLY = {
    "shelf_slide": {"S4"},
    "cross_bay": {"S3", "S6"},
    "vault_up": {"S4", "S3"},
    "hold_wide": {"S3", "S6", "S4", "S2"},
    "rear_follow": {"S6", "S5", "S10", "S2"},
    "shoulder_swing": {"S6", "S10", "S5"},
}


# ---------------------------------------------------------------------------
# 교훈 211 — 「무브가 세트에 어울리는가」와 「무브가 세트 안에 있는가」는 다른 질문
# ---------------------------------------------------------------------------
# J_A4-01 은 게이트 전부(G1~G8, SET/GAZE/PROPS/ARC/RADIUS/HEIGHT/COVER/VARIETY/
# SPEED)를 통과했는데 렌더에서는 두 번 연속 실패했다.
#
#   v3: 완전 균일 회색 (천장 밑면)        maxside/W = 0.000
#   v4: 회색 벽 -> 서가 측면 스침          maxside/W = 0.051  (하한 0.14)
#
# ★원인★  drone_drop 의 z0 = 4.60 m 다.  S4 의 내용물 최상단은 서가 2.10 m 이고
# 이력서 묶음은 z 0.87~1.76 m 에 있다.  즉 카메라는 서가보다 ★2.7 m 위 허공★ 에서
# 출발해 서가의 「측면」만 스치며 내려온다.  drone_drop 은 실외/대공간을 위한
# 무브인데 실내 서가 컷에 배정된 것이다.
#
# SET_ONLY 는 무브-세트 「궁합」만 본다 — drone_drop 은 S4 금지 목록에 없으므로
# 통과했다.  그런데 궁합이 맞아도 ★높이가 안 맞으면★ 카메라는 세트 밖에 있다.
# G8(화각/가림)도 이것을 못 잡는다: 카메라가 허공에 있어도 주연이 화각 안이고
# 가려지지 않았으면 「보인다」고 판정하기 때문이다 — 실제로는 정면이 아니라
# 측면을 극단적 부감으로 보는 것이어서 화면상 실루엣이 무너진다.
#
# ★교훈 211★  카메라 높이는 세트 내용물의 높이가 정한다.  무브 카탈로그의 z 는
# 「그 무브의 정체성」이지만, 세트가 담을 수 없는 높이면 그 무브는 그 세트에서
# 쓸 수 없다.  ★교훈 210 의 네 번째 재발이다★ — 새 게이트를 세울 때마다
# 「이 게이트가 못 보는 축은 무엇인가」를 물어야 한다(크기 -> 화각 -> 가림 -> 높이).
#
# 상한은 발명하지 않고 실측에서 고른다: 세트 내용물 최상단 * Z_HEADROOM.
# S4 서가 2.10 m 이므로 상한 3.15 m -> drone_drop(4.60) 은 거부되고
# crane_settle(3.10) / vault_up(3.35 도착) 등이 남는다.
Z_HEADROOM = 1.50        # 내용물 최상단의 1.5배까지는 「그 공간 안」으로 본다
Z_FLOOR_MIN = 1.20       # 아주 낮은 세트에서도 최소 이 높이는 허용한다


def _set_top(set_id):
    """이 세트가 담고 있는 내용물의 최상단 z (벽/천장 제외)."""
    from sets import build_spec
    top = 0.0
    for nm, _k, loc, sc, _c in build_spec(set_id):
        # 벽/천장/슬래브는 「내용물」이 아니다 — 그것들은 공간의 껍데기다.
        if nm.startswith(("wall", "ceil", "slab", "floor")):
            continue
        top = max(top, loc[2] + sc[2])
    return top


_ZTOP_CACHE = {}


def move_fits_height(move, set_id):
    """이 무브의 카메라 z 범위가 이 세트가 담을 수 있는 높이인가. [교훈 211]"""
    if set_id not in _ZTOP_CACHE:
        _ZTOP_CACHE[set_id] = _set_top(set_id)
    ceil = max(Z_FLOOR_MIN, _ZTOP_CACHE[set_id] * Z_HEADROOM)
    z0, z1 = MOVES[move][2], MOVES[move][3]
    return max(z0, z1) <= ceil + 1e-9
# Level pushes the whole rig closer or further; this is kept from camtab
# because it worked -- what was missing was variety WITHIN a level.
LEVEL_R = {"L0": 1.34, "L1": 1.00, "L2": 0.86, "L3": 0.68}
# ... and level also biases WHICH move: a whole-room level should not use a
# 50 mm creep, a deep-detail level should not use a 24 mm whip.
LEVEL_PREF = {
    "L0": ("eave_drop", "drone_drop", "wide_open", "cross_bay", "hold_wide",
           "ridge_skim", "orbit_half", "vault_up", "lift_out", "whip_across",
           "shelf_slide", "low_pan"),
    "L1": ("crane_settle", "shelf_descend", "lateral_track", "pull_reveal",
           "rear_follow", "ridge_skim", "step_back", "orbit_half", "low_pan",
           "shoulder_swing", "settle_tilt", "cross_bay", "shelf_slide",
           "lift_out"),
    "L2": ("push_in", "shoulder_swing", "ease_back", "step_back",
           "rear_follow", "drift_side", "lateral_track", "settle_tilt",
           "pull_reveal", "table_glide", "low_pan", "whip_across"),
    "L3": ("creep_in", "desk_graze", "breathe_in", "sill_retreat",
           "table_glide", "drift_side", "push_in", "settle_tilt",
           "shoulder_swing", "step_back"),
}

EASE = {
    "linear": lambda t: t,
    "smooth": lambda t: t * t * t * (t * (t * 6 - 15) + 10),
    "ease_in": lambda t: t * t,
    "ease_out": lambda t: 1.0 - (1.0 - t) ** 2,
    "ease_in_out": lambda t: 0.5 - 0.5 * math.cos(math.pi * t),
}


def verb_of(cam):
    return (cam or "").split("—")[0].strip() or "정지"


def pick_move(verb, level, set_id, rot, prev_move):
    """Deterministic move choice.

    The pool is the verb's moves, filtered to those legal in this set, ordered
    by how well they suit the level.  `rot` is the rotation index that walks the
    pool.

    MEASURED CORRECTION (first run of this file).  `rot` was originally the
    shot's index inside its own set run.  That failed the variety gate at
    lateral_track 15/80 = 19%.  The reason is arithmetic, not taste: rows38 has
    38 set runs and 22 of them are ONE shot long
        run length histogram  {1: 22, 2: 10, 3: 3, 6: 1, 7: 1, 16: 1}
    so the rotation index was 0 for 38 of 80 shots and the pool was never
    walked -- every 관통 shot in a fresh set took pool[0] = lateral_track.
    The fix is to rotate per (verb, level) BUCKET across the whole film, so the
    twelve buckets that actually exist each traverse their whole pool.  It stays
    deterministic (no randomness, no hand-tuning of individual cuts), which is
    the property that keeps improvements from drifting apart.
    """
    pool = [m for m in POOL[verb]
            if set_id in SET_ONLY.get(m, {set_id})]
    # ★교훈 211★ 궁합(SET_ONLY)이 맞아도 높이가 세트를 넘으면 카메라는 세트 밖이다.
    # 전부 걸러지면 필터를 풀지 않고 「가장 낮은 무브」를 남긴다 — 가드로 덮지 않고
    # 결정적으로 고른다(교훈 199).
    fit = [m for m in pool if move_fits_height(m, set_id)]
    if fit:
        pool = fit
    elif pool:
        pool = [min(pool, key=lambda m: max(MOVES[m][2], MOVES[m][3]))]
    pref = LEVEL_PREF.get(level, ())
    pool.sort(key=lambda m: (pref.index(m) if m in pref else len(pref), m))
    if not pool:
        raise SystemExit("MOVE GATE FAILED: empty pool %s/%s/%s"
                         % (verb, level, set_id))
    pick = pool[rot % len(pool)]
    if pick == prev_move and len(pool) > 1:
        pick = pool[(rot + 1) % len(pool)]
    return pick


MIN_HOLD_FRAMES = 20
MAX_ARC_DPS = 34.0       # deg/s -- above this a primitive previz smears
MIN_ARC_DPS = 4.5        # deg/s -- below this the frame reads as a still
MAX_RAD_MPS = 2.60       # m/s   -- radial travel ceiling at 24 fps
# A single cut may not sweep past a half circle.  This is not taste: the
# renderer recovers the sweep from the two Cartesian endpoints and wraps it into
# (-180, 180], so an arc of 201 deg comes back as -159 and the ARC GATE fires
# (measured: J_A3-04, orbit_half extended x1.52).  170 leaves margin.
MAX_ARC_TOTAL = 170.0
MIN_RAD_MPS = 0.22       # m/s   -- radial travel floor (CEO-51: never static)


def fit_move(move, frames, k):
    """Fit a move's trajectory to the length of the cut it must live in.

    MEASURED CORRECTION (second run).  The first version only ASKED whether a
    cut was long enough and, when it was not, recorded a note and rendered the
    move anyway: 41 of 80 cuts were shorter than their move wanted, i.e. half
    the film would have been a move that never completes.  A previz cannot
    negotiate with the script -- rows38 timings come from the narration and are
    fixed -- so the move must yield instead.

    Two rules, both physical rather than aesthetic:

    1. SPEED CEILING.  arc/duration must stay under MAX_ARC_DPS and radial
       travel under MAX_RAD_MPS.  If the cut is short, the arc and the radial
       span are scaled by the SAME factor, so the shape of the trajectory (its
       ratio of sweep to approach) survives -- shrinking only one of them is
       what broke the geometry in lesson 177.

    2. SPEED FLOOR.  A long cut with a small move becomes the "flickering
       still" the CEO rejected in CEO-51.  If the move is too slow for the time
       available, the arc and the radial span are stretched up to the floor.

    Returns (arc, r0, r1, z0, z1, hold, scale, why).  Radii arrive already
    multiplied by the level factor k so the fit sees real metres.
    """
    r0, r1, z0, z1, arc, lens, hold, ez = MOVES[move]
    # radius scales with the level; HEIGHT ABOVE THE SURFACE scales with it too,
    # then the datum is added once at the end so the eye level is physical.
    r0, r1, z0, z1 = r0 * k, r1 * k, z0 * k, z1 * k
    dur = max(1.0 / FPS, frames / float(FPS))

    # The hold must be long enough to register (MIN_HOLD_FRAMES) but must never
    # eat a short cut alive.  Note the direction: max() to reach the floor, then
    # a hard cap.  Writing min() here silently deleted the hold on long cuts.
    hold = max(hold, MIN_HOLD_FRAMES / float(frames))
    hold = max(0.04, min(hold, 0.34))
    move_dur = dur * (1.0 - hold)

    span = abs(r1 - r0) + abs(z1 - z0)
    lo, hi = 1e-9, 1e9
    # ceiling
    if arc > 0:
        hi = min(hi, MAX_ARC_DPS * move_dur / arc)
        hi = min(hi, MAX_ARC_TOTAL / arc)          # never wrap past a half turn
    if span > 0:
        hi = min(hi, MAX_RAD_MPS * move_dur / span)
    # floor
    if arc > 0:
        lo = max(lo, MIN_ARC_DPS * move_dur / arc)
    if span > 0:
        lo = max(lo, MIN_RAD_MPS * move_dur / span)

    if lo <= 1.0 <= hi:
        scale, why = 1.0, ""
    elif hi < 1.0:
        scale, why = hi, "cut too short -- trajectory compressed x%.2f" % hi
    else:
        # The extension cap used to be 1.8x on the theory that a bigger stretch
        # reads as a lurch.  MEASURED: A8-GAP is a long beat on breathe_in (16
        # deg over a 0.24 m span); capped at 1.8x it came out at 3.95 deg/s and
        # tripped the speed FLOOR -- i.e. the cap was manufacturing exactly the
        # static frame CEO-51 forbids.  The real limit on extension is the arc
        # ceiling, which is applied unconditionally right below, so the cap only
        # needs to stop absurdity.  A "hold" that has to become a slow drift to
        # stay alive is correct: the deck has no still cuts.
        scale = min(lo, 3.2)
        why = "cut too long -- trajectory extended x%.2f" % scale
    # THE CEILING ALWAYS WINS.  lo and hi can conflict (lo > hi) whenever a move
    # mixes a wide arc with a nearly-constant radius -- orbit_half sweeps 132 deg
    # over a 0.15 m radial span, so the radial FLOOR demanded a scale that blew
    # the arc CEILING and A3-10 came out at 40 deg/s.  A too-fast camera is a
    # defect; a slow radius on an arc move is not, because the arc supplies the
    # motion.  The speed-floor gate below is an AND for exactly this reason.
    if scale > hi:
        scale = hi
        why = "arc ceiling binds -- trajectory held to x%.2f" % hi

    arc *= scale
    mid_r = 0.5 * (r0 + r1)
    mid_z = 0.5 * (z0 + z1)
    r0 = mid_r + (r0 - mid_r) * scale
    r1 = mid_r + (r1 - mid_r) * scale
    z0 = mid_z + (z0 - mid_z) * scale
    z1 = mid_z + (z1 - mid_z) * scale
    return arc, r0, r1, z0 + CAM_DATUM, z1 + CAM_DATUM, hold, scale, why


# ---------------------------------------------------------------------------
# 주연 크기가 렌즈를 정한다                          [교훈 203 / CEO-77 목적 2]
# ---------------------------------------------------------------------------
# 무브 카탈로그의 lens 는 「그 궤적에 어울리는 화각」으로 정해져 있다. 드론 하강
# 은 28 mm 광각, 책상 접근은 50 mm 준망원 — 그 자체는 옳다. 그런데 대본이 소도구
# 를 지정한 컷에서는 그것만으로 부족했다. 실측 (v2 렌더 6컷):
#
#     A3-13  주연 최대  65 px / 1280    A3-16  124 px
#     A3-17           92 px             A4-01   78 px
#
# 4 / 6 컷의 주연이 손톱만 했다. J_A4-01 은 렌더 프레임 직독에서 밝은 시트
# 화소가 ★0.00%★ 였다 — 자막이 "남기고 싶은 변화" 를 말하는 동안 화면에는
# 회색 책상만 있었다. 카메라는 주연을 향했지만(G5 통과) 주연은 보이지 않았다.
#
# ★왜 「거리 축소」가 아니라 「렌즈」인가★
#   거리만 줄여서 통과시키려면 A3-13 이 scale 0.020 — 카메라가 책상에서 3 cm
#   떨어진 위치가 된다. 그러면 그것은 이미 대본이 지시한 "4% pull-back" 이
#   아니고, rad_mps 도 0.025 로 떨어져 SPEED GATE 하한(0.22)을 깬다. 즉 거리는
#   무브의 정체성이므로 건드리면 CEO-51("컷 안에서 움직임 · 정지 없음") 이
#   무너진다.
#   실제 촬영도 작은 소도구는 카메라를 들이밀지 않고 ★망원으로 당긴다.★
#   렌즈는 궤적을 바꾸지 않고 프레이밍만 바꾸는 유일한 레버다.
#
# ★그래서 무엇을 하는가★
#   대본이 소도구를 지정한 컷에 한해, 그 컷의 최대 주연이 화면 폭의
#   SUBJ_FRAC_TARGET 을 차지하는 최소 렌즈로 올린다(내리지는 않는다).
#   LENS_CEIL 은 상한이다 — 여기서 막히면 렌즈가 아니라 ★대본이 요구한 주연이
#   3D 에 없는 것★이므로 sets.py 를 고쳐야 한다. 실제로 A3-13 이 그랬다:
#   97 mm 를 요구했는데, 원인은 대본 "★비교표★ 옆 빈 조건 카드" 의 앞 절을
#   빠뜨려 최대 주연이 명함 크기였던 것이었다 (교훈 200 의 재발).
SUBJ_FRAC_TARGET = 0.175      # = SUBJ_FRAC_MIN(0.14) x 1.25 여유
LENS_CEIL = 85.0              # 이 이상 필요하면 소도구 누락을 의심하라
SENSOR_MM = 36.0              # previz_batch 의 SENSOR (교훈 176: 복제 금지)


def lens_for_subject(sid, lens, r0, r1, z0, z1, anchor, doc_z):
    """주연이 SUBJ_FRAC_TARGET 을 차지하는 렌즈로 올린다. 내리지는 않는다.

    시선점을 아직 모르는 단계이므로(그것은 scenejobs 의 gaze_of 가 정한다)
    카메라에서 주연까지의 ★직선거리★ 로 근사한다. 실제 depth(광축 투영)는
    이보다 짧거나 같으므로 이 근사는 렌즈를 ★과대하게 요구하지 않는다★ —
    보수적인 방향이다. 최종 판정은 script_gate 의 G6 이 정확한 depth 로 한다.
    """
    props = PROPS.get(sid)
    if not props:
        return lens, ""
    w = max(2.0 * max(sc[0], sc[1]) for _n, _k, _l, sc, _c in props)
    # 카메라가 주연에서 가장 가까워지는 순간이 프레이밍의 최선이다
    best = None
    for r, z in ((r0, z0), (r1, z1)):
        d = min(math.hypot(math.hypot(r, 0.0) - math.hypot(l[0], l[1]),
                           z - l[2]) for _n, _k, l, _s, _c in props)
        d = max(abs(d), 0.05)
        best = d if best is None else min(best, d)
    need = SUBJ_FRAC_TARGET * SENSOR_MM * best / w
    if need <= lens:
        return lens, ""
    new = min(need, LENS_CEIL)
    why = ("주연 %.3fm @ %.2fm 를 화면 %.0f%% 로 담으려면 %.0fmm 필요"
           % (w, best, SUBJ_FRAC_TARGET * 100.0, need))
    if need > LENS_CEIL:
        why += " -- LENS_CEIL %.0f 에서 막힘 (소도구 누락 의심)" % LENS_CEIL
    return round(new, 1), why


MIN_SHOT_FRAMES = 30          # 1.25 s -- below this it is a fragment, not a shot


def weld(rows):
    """Merge sub-shot fragments into their neighbour BEFORE assigning a move.

    MEASURED CORRECTION (third run).  rows38 contains cue fragments as short as
    5 frames (A8-UNCERTAIN 5 f, A7-06 7 f, A7-02 / A7-04 9 f).  Giving each of
    those its own camera move produced fit scales down to x0.09, i.e. a move
    that has been compressed until it no longer exists -- which on screen is
    precisely the "깜빡거리는 컷 전환" the CEO rejected in CEO-50 and again in
    CEO-67 (4).  A fragment is not a shot; it is part of the shot next to it.

    Welding rule, deliberately boring so it is reproducible: a run of rows is
    accumulated while its total is below MIN_SHOT_FRAMES, and it is closed as
    soon as it reaches the threshold.  A trailing short run is folded back into
    the previous shot.  Welding never crosses a set boundary, because that is a
    real cut.  The shot keeps the FIRST row's sid, level and cam verb (the
    direction that opens the beat) and records the members it swallowed.
    """
    groups = []
    for r in rows:
        f = max(1, int(round((r["t1"] - r["t0"]) * FPS)))
        set_id, src = set_of(r)
        if groups and groups[-1]["set"] == set_id \
                and groups[-1]["frames"] < MIN_SHOT_FRAMES:
            g = groups[-1]
            g["frames"] += f
            g["members"].append(r["sid"])
            g["t1"] = r["t1"]
        else:
            groups.append({"sid": r["sid"], "set": set_id, "set_from": src,
                           "frames": f, "members": [r["sid"]],
                           "t0": r["t0"], "t1": r["t1"], "row": r})
    # a trailing fragment cannot be closed forward -- fold it back
    while len(groups) > 1 and groups[-1]["frames"] < MIN_SHOT_FRAMES \
            and groups[-1]["set"] == groups[-2]["set"]:
        g = groups.pop()
        groups[-1]["frames"] += g["frames"]
        groups[-1]["members"] += g["members"]
        groups[-1]["t1"] = g["t1"]
    return groups


def main():
    rows = json.load(open(SRC))["rows"]
    out = []
    run_set, prev_move = None, None
    # rotation is per (verb, level) bucket across the WHOLE film -- see the
    # measured note in pick_move.  A per-set-run index leaves 38/80 shots at 0.
    rot = collections.Counter()
    counts = collections.Counter()
    setcount = collections.Counter()
    infeasible = []

    groups = weld(rows)
    for i, g in enumerate(groups):
        r = g["row"]
        sid, set_id, src = g["sid"], g["set"], g["set_from"]
        cut = (set_id != run_set)          # deliberate cut: the world changed
        run_set = set_id
        verb = verb_of(r.get("cam"))
        level = r.get("level") or "L2"
        bucket = (verb, level)
        move = pick_move(verb, level, set_id, rot[bucket], prev_move)
        rot[bucket] += 1
        frames = g["frames"]
        k = LEVEL_R.get(level, 1.0)
        lens = MOVES[move][5]
        ez = MOVES[move][7]
        arc, r0, r1, z0, z1, hold, scale, why = fit_move(move, frames, k)
        lens, lens_why = lens_for_subject(sid, lens, r0, r1, z0, z1,
                                         DOC_ANCHOR[set_id], DOC_Z)
        if why:
            infeasible.append((sid, move, frames, scale, why))
        dur = frames / float(FPS)
        rec = {
            "sid": sid, "set": set_id, "set_from": src,
            "members": g["members"], "t0": g["t0"], "t1": g["t1"],
            "verb": verb, "level": level, "move": move,
            "r0": round(r0, 3), "r1": round(r1, 3),
            "z0": round(z0, 3), "z1": round(z1, 3),
            "arc_deg": round(arc, 2), "lens": lens, "lens_why": lens_why,
            "hold_frac": round(hold, 4), "ease": ez,
            "frames": frames,
            "fit_scale": round(scale, 3), "fit_why": why,
            "arc_dps": round(arc / max(1e-6, dur * (1.0 - hold)), 2),
            "rad_mps": round((abs(r1 - r0) + abs(z1 - z0))
                             / max(1e-6, dur * (1.0 - hold)), 3),
            "cut": cut,
            "cut_reason": ("세트 전환 %s" % set_id) if cut else "",
            "chain": (not cut),
            "delta": DELTA.get(sid, ("", ""))[0],
            "delta_why": DELTA.get(sid, ("", ""))[1],
            "doc_anchor": DOC_ANCHOR[set_id],
            "doc_z": DOC_Z,
        }
        out.append(rec)
        counts[move] += 1
        setcount[set_id] += 1
        prev_move = move

    # ---- gates -----------------------------------------------------------
    # (a) every set referenced must actually build
    for s in sorted(setcount):
        build_spec(s)
    # (b) the whole point of this file: the move vocabulary must be WIDE
    if len(counts) < 15:
        raise SystemExit("VARIETY GATE FAILED: only %d distinct moves over %d "
                         "shots (target >= 15)" % (len(counts), len(out)))
    # (c) no move may dominate the film the way 관통·L1 used to (15/80 = 19%)
    top, ntop = counts.most_common(1)[0]
    if ntop > len(out) * 0.16:
        raise SystemExit("VARIETY GATE FAILED: %s used %d/%d (%.0f%%) > 16%%"
                         % (top, ntop, len(out), 100.0 * ntop / len(out)))
    # (d) no two ADJACENT shots may share a move -- that is the literal
    #     complaint ("every cut moves the same")
    for a, b in zip(out, out[1:]):
        if a["move"] == b["move"]:
            raise SystemExit("VARIETY GATE FAILED: %s and %s both use %s"
                             % (a["sid"], b["sid"], a["move"]))
    # (e) SPEED GATE.  Every cut must move fast enough to read as motion and
    #     slow enough to read as a camera.  This replaces the old advisory
    #     "infeasible" note that let 41/80 cuts render an unfinished move.
    for rec in out:
        if rec["arc_dps"] > MAX_ARC_DPS + 0.5 or rec["rad_mps"] > MAX_RAD_MPS + 0.02:
            raise SystemExit("SPEED GATE FAILED (too fast): %s %s %.2f dps "
                             "%.3f m/s" % (rec["sid"], rec["move"],
                                           rec["arc_dps"], rec["rad_mps"]))
        if rec["arc_dps"] < MIN_ARC_DPS - 0.5 and rec["rad_mps"] < MIN_RAD_MPS - 0.02:
            raise SystemExit("SPEED GATE FAILED (reads as still): %s %s %.2f dps "
                             "%.3f m/s" % (rec["sid"], rec["move"],
                                           rec["arc_dps"], rec["rad_mps"]))
    # (f) geometry sanity -- a fitted radius must stay positive and off the target
    for rec in out:
        if min(rec["r0"], rec["r1"]) < 0.35:
            raise SystemExit("GEOMETRY GATE FAILED: %s radius %.3f/%.3f too "
                             "close" % (rec["sid"], rec["r0"], rec["r1"]))
    # (g) WELD GATE -- no shot may be a fragment, and no trajectory may be
    #     compressed into nothing.  x0.09 in the previous run meant "the move
    #     is gone"; 0.45 is the floor at which the move is still the move.
    for rec in out:
        if rec["frames"] < MIN_SHOT_FRAMES:
            raise SystemExit("WELD GATE FAILED: %s only %d f (min %d)"
                             % (rec["sid"], rec["frames"], MIN_SHOT_FRAMES))
        if rec["fit_scale"] < 0.45:
            raise SystemExit("WELD GATE FAILED: %s %s compressed to x%.2f -- "
                             "the move no longer exists"
                             % (rec["sid"], rec["move"], rec["fit_scale"]))
    # (h) the welded timeline must still cover the script exactly
    tot = sum(r["frames"] for r in out)
    src_tot = sum(max(1, int(round((r["t1"] - r["t0"]) * FPS)))
                  for r in json.load(open(SRC))["rows"])
    if tot != src_tot:
        raise SystemExit("COVER GATE FAILED: welded %d f vs source %d f"
                         % (tot, src_tot))

    json.dump({"moves": MOVES, "shots": out}, open(OUT, "w"),
              ensure_ascii=False, indent=1)

    print("SCENEMAP  %d shots (from %d script rows)  %d sets  %d distinct moves"
          % (len(out), sum(len(r["members"]) for r in out),
             len(setcount), len(counts)))
    print("  length %d f = %.3f s  shortest %d f  longest %d f"
          % (tot, tot / float(FPS),
             min(r["frames"] for r in out), max(r["frames"] for r in out)))
    print("  sets   " + "  ".join("%s=%d" % kv for kv in
                                  sorted(setcount.items(),
                                         key=lambda x: int(x[0][1:]))))
    print("  cuts   %d deliberate, %d chained"
          % (sum(1 for r in out if r["cut"]), sum(1 for r in out if r["chain"])))
    print("  top    " + "  ".join("%s=%d" % kv for kv in counts.most_common(6)))
    comp = [r for r in out if r["fit_scale"] < 0.999]
    ext = [r for r in out if r["fit_scale"] > 1.001]
    print("  fit    %d exact, %d compressed, %d extended"
          % (len(out) - len(comp) - len(ext), len(comp), len(ext)))
    if comp:
        print("         tightest x%.2f (%s %s)"
              % (min(r["fit_scale"] for r in comp),
                 min(comp, key=lambda r: r["fit_scale"])["sid"],
                 min(comp, key=lambda r: r["fit_scale"])["move"]))
    dps = [r["arc_dps"] for r in out]
    mps = [r["rad_mps"] for r in out]
    print("  speed  arc %.1f-%.1f deg/s   radial %.2f-%.2f m/s"
          % (min(dps), max(dps), min(mps), max(mps)))
    print("VARIETY GATE OK  max share %.0f%%  adjacent repeats 0"
          % (100.0 * ntop / len(out)))
    print("SPEED GATE OK    no still cut, no smear cut")
    print("-> %s" % OUT)


if __name__ == "__main__":
    main()
