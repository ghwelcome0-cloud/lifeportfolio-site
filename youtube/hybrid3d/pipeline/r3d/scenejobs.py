"""scenejobs.py -- turn scenemap.json into the job list previz_batch renders.

Why a bridge instead of a new renderer
--------------------------------------
Lesson 176 and 181, learned the expensive way: when the geometry lives in two
places they drift, and when nobody owns "is the whole thing right" a 0.320 s
hole ships.  previz_batch.py is the ONLY file that builds a previz frame and it
stays that way.  This file translates the new scene/camera design into the exact
schema previz_batch already consumes (job_id, frames, hold_frac, arc_deg,
cam_start_xyz, cam_end_xyz, tgt_start_xyz, tgt_end_xyz, word_gesture, ...), and
adds the two NEW fields the renderer learns to read: `set` and `lens`.

What changes for the viewer, and why
------------------------------------
CEO-67 (5) rejected the previz because "every cut moves the same way and only
the word changes".  Two measured causes:

  * camera:  four verbs x four level multipliers = TWELVE distinct trajectories
             over sixty cuts, top one 15/80 = 19%.
  * scene:   all sixty cuts were the same eight boxes -- a grey floor, three
             brown walls, three coloured sheets and a red cup.  No props, no
             environment, no people.  Any camera over that geometry reads as
             "coloured paper on a grey floor".

scenemap.py fixed the first (17 moves, top share 9%, zero adjacent repeats) and
sets.py fixed the second (ten sets, 250 primitives, four colour-coded
mannequins).  This file is the wire between them and the renderer.

Angle convention -- read this before touching anything
------------------------------------------------------
previz_batch derives the sweep from the CARTESIAN endpoints and cross-checks it
against arc_deg (the ARC GATE, lesson 171: arc_deg is a magnitude, the sign
lives in cam_end_xyz).  So the endpoints written here must satisfy

    a0 = atan2(x0, -y0),  a1 = atan2(x1, -y1),  a1 - a0 == +/- arc_deg

exactly, or the gate fires.  The sweep direction alternates per shot index so
consecutive cuts do not all orbit the same way.
"""
import csv, json, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SCENEMAP = os.path.join(HERE, "scenemap.json")
ROWS = "/home/user/lf/work/longform/rows38.json"
OUT = os.path.join(HERE, "scenejobs.json")
SCRIPTS = ["/home/user/lf/_script/SCRIPT_ACT1-2.csv",
           "/home/user/lf/_script/SCRIPT_ACT3-8.csv"]
FPS = 24

sys.path.insert(0, HERE)
from sets import DOC_Z, DESK_Z, GAZE, PROPS         # noqa: E402
import script_gate as SG                            # noqa: E402

# ---------------------------------------------------------------------------
# 렌즈 정밀화 — 게이트가 재는 값과 같은 값으로 잰다   [교훈 206 / 교훈 208]
# ---------------------------------------------------------------------------
# scenemap.lens_for_subject() 가 1차로 렌즈를 올리지만, 그것은 카메라에서 주연
# 까지의 ★직선거리★ 근사를 쓴다. scenemap 단계에서는 방위각(골든앵글)도 시선점
# 도 아직 정해지지 않았기 때문이다 — 그 둘은 이 파일의 endpoints() 와 gaze_of()
# 가 정한다.
#
# 그런데 화면상 크기를 정하는 것은 직선거리가 아니라 ★광축(cam->tgt) 방향으로
# 투영한 depth★ 다. 실측 오차:
#
#     A3-17  근사 2.641 m  vs  실제 depth 2.780 m   x1.05
#     A3-16  근사 2.192 m  vs  실제 depth 2.384 m   x1.09
#     A4-01  근사 1.249 m  vs  실제 depth ★1.904 m★  x1.52
#     A3-13  근사 1.248 m  vs  실제 depth ★2.013 m★  x1.61
#
# 근사가 거리를 최대 x1.61 짧게 봤으므로 렌즈를 그만큼 덜 올렸고, 그래서 G6 가
# A3-13(11.4%) 과 A4-01(11.5%) 을 계속 잡았다. 근사는 「보수적」이었지만 「충분」
# 하지 않았다.
#
# ★교훈 208★ 처방은 게이트가 재는 값과 ★같은 값★ 으로 계산해야 한다. 근사로
# 처방하고 정밀로 검사하면 그 차이만큼 영원히 실패한다. 가드를 느슨하게 하지
# 않고(교훈 199) 처방을 게이트 쪽으로 옮기는 것이 옳은 방향이다.
#
# 렌즈는 궤적을 바꾸지 않으므로 cam/tgt 가 확정된 뒤에 올려도 안전하다 —
# 고정점이 한 번에 잡힌다(렌즈가 depth 를 바꾸지 않는다).
# [CEO-82/83] follow-the-object 앵커의 ★표준 이름★. sets.PROPS 안에서 이 이름을
# 가진 소도구가 그 컷의 앵커다. 이름을 상수로 둔 이유: 이전 판은 같은 대상을
# cond/card 두 이름으로 만들어서 코드도 관객도 같은 대상으로 못 알아봤다.
ANCHOR_NAME = "card"
SUBJ_FRAC_TARGET = 0.175      # = script_gate.SUBJ_FRAC_MIN(0.14) x 1.25 여유
LENS_CEIL = 85.0              # 여기서 막히면 소도구 누락이다 (교훈 205)
SENSOR_MM = 36.0              # previz_batch.SENSOR (교훈 176: 복제 금지)


def _band(lens, cam0, cam1, tgt0, tgt1, props):
    """script_gate.shot_band 과 같은 산식 (교훈 176: 복제 금지 -> 같은 정의)."""
    return SG.shot_band({"lens": lens,
                         "cam_start_xyz": cam0, "cam_end_xyz": cam1,
                         "tgt_start_xyz": tgt0, "tgt_end_xyz": tgt1}, props)


def separate_shot(lens, cam0, cam1, tgt0, tgt1, props,
                  prev_band, prev_tgt, tgt_now):
    """같은 주연을 잇는 두 컷의 「샷 사이즈」를 벌린다.        [G7 / 교훈 202]

    대본이 같은 대상의 연속 동작을 요구하는 컷(A3-14 "빈 본문 바" -> A3-15
    "손이 본문을 채움") 에서는 시선이 같은 것이 ★대본대로 맞다★. 그래서 G4 를
    느슨하게 하지 않고(교훈 199) 크기를 벌린다 — 영화도 같은 대상을 크기를
    바꿔 잇는다. 실측: A3-14 [28.5..50.9] vs A3-15 [36.9..50.2] = 겹침 ★59%★.
    A3-14 가 클로즈업으로 들어와 끝나고, A3-15 가 같은 클로즈업에서 시작해
    그대로 머문다 — 관객에게는 같은 그림 두 장이다.

    ★어느 방향으로 벌리는가★ 이미 기울어 있는 방향을 강화한다. 뒤 컷의 배율
    중앙이 앞 컷보다 높으면 더 타이트하게(망원), 낮으면 더 넓게(광각). A3-15 는
    중앙 43.6 vs A3-14 39.7 로 이미 위이므로 더 타이트해지고, 이는 "손이 본문을
    채움" 이라는 ★액션 포인트★ 를 크게 잡는 것이므로 대본 의도와도 일치한다.

    광각 방향은 주연을 작게 만들어 G6 를 깰 수 있으므로, 그 경우 G6 목표를
    지키는 범위에서만 허용한다. 렌즈는 궤적을 바꾸지 않으므로 안전하다.
    """
    if not props or prev_band is None or prev_tgt is None:
        return lens, ""
    if math.dist(tgt_now, prev_tgt) >= SG.TGT_MIN_MOVE:
        return lens, ""          # 다른 주연이면 G7 대상이 아니다
    band = _band(lens, cam0, cam1, tgt0, tgt1, props)
    if SG.band_overlap(band, prev_band) <= SG.SHOT_OVERLAP_MAX:
        return lens, ""
    up = 0.5 * (band[0] + band[1]) >= 0.5 * (prev_band[0] + prev_band[1])
    floor_lens, _ = refine_lens(0.0, cam0, cam1, tgt0, tgt1, props)  # G6 하한
    k = 1.0
    for _ in range(400):
        k += 0.005 if up else -0.005
        if k <= 0.05:
            break
        cand = round(lens * k, 1)
        if cand > LENS_CEIL or cand < floor_lens:
            break
        if SG.band_overlap(_band(cand, cam0, cam1, tgt0, tgt1, props),
                           prev_band) <= SG.SHOT_OVERLAP_MAX:
            return cand, ("직전 컷과 샷 사이즈를 벌림 %.0f->%.0fmm (%s)"
                          % (lens, cand, "타이트" if up else "와이드"))
    return lens, ""              # 못 벌리면 게이트가 잡게 둔다 (교훈 199)


def fov_ceiling(lens, cam0, cam1, tgt0, tgt1, props):
    """렌즈를 올릴 수 있는 상한 — 「지금 화각 안에 있는 주연」을 밀어내지 않는 최대치.

    교훈 210: 「크다」는 「보인다」가 아니다. 렌즈를 올리면 주연은 커지지만
    화각이 좁아져 ★다른 주연이 프레임 밖으로 밀려난다★.  refine_lens() 는
    이 점을 보지 않아, G6(크기)를 만족시키려 렌즈를 올린 결과 G8(가시성)을
    깨뜨릴 수 있었다.

    산식은 script_gate.visible() 의 화각 판정을 역으로 푼 것이다.
        visible :  atan(|off| / dep) <= atan(SENSOR*0.5 / lens)
        역     :  lens <= SENSOR*0.5 * dep / |off|
    주연의 ★중심★ 이 아니라 ★모서리★ 를 기준으로 한다 (각반경 가산).

    반환 (ceil_mm, 가장 먼저 밀려나는 주연 이름).  상한 없으면 (LENS_CEIL, "").
    """
    if lens <= 0.0 or not props:      # 하한 탐침(floor probe) 에는 적용하지 않는다
        return LENS_CEIL, ""

    ceil, who = LENS_CEIL, ""
    for cam, tgt in ((cam0, tgt0), (cam1, tgt1)):
        f, r, u = SG.cam_basis(cam, tgt)
        for nm, _k, l, sc, _c in props:
            d = [l[i] - cam[i] for i in range(3)]
            dep = sum(d[i] * f[i] for i in range(3))
            if dep < 0.05:
                continue                      # 광축 뒤 — refine_lens 가 따로 보고한다
            rad = max(sc)                      # 주연의 반경 (모서리까지)
            ox = abs(sum(d[i] * r[i] for i in range(3))) + rad
            oy = abs(sum(d[i] * u[i] for i in range(3))) + rad
            # 지금 화각 안에 없는 주연은 상한을 만들지 않는다 (이미 밖이면 밀려날 것이 없다)
            if ox > SENSOR_MM * 0.5 * dep / lens:
                continue
            if oy > SG.SENSOR_H_MM * 0.5 * dep / lens:
                continue
            for half, off in ((SENSOR_MM * 0.5, ox), (SG.SENSOR_H_MM * 0.5, oy)):
                if off <= 1e-9:
                    continue
                cand = half * dep / off
                if cand < ceil:
                    ceil, who = cand, nm
    return ceil, who


def refine_lens(lens, cam0, cam1, tgt0, tgt1, props):
    """주연이 화면 폭 SUBJ_FRAC_TARGET 을 차지하는 렌즈로 올린다. 내리지 않는다.

    script_gate.subj_frac() 과 동일한 산식이다 — 광축 투영 depth, 최장변,
    개별 주연(합집합 아님). 반환 (lens, why).
    """
    if not props:
        return lens, ""

    def _n(v):
        m = math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) or 1e-9
        return [v[0] / m, v[1] / m, v[2] / m]

    need = None
    behind = []
    for cam, tgt in ((cam0, tgt0), (cam1, tgt1)):
        f = _n([tgt[i] - cam[i] for i in range(3)])
        for nm, _k, l, sc, _c in props:
            dep = sum((l[i] - cam[i]) * f[i] for i in range(3))
            if dep < 0.05:
                behind.append(nm)
                continue
            w = 2.0 * max(sc[0], sc[1])
            # 이 주연을 목표 크기로 담는 데 필요한 렌즈
            nl = SUBJ_FRAC_TARGET * SENSOR_MM * dep / w
            # 가장 잘 담기는 주연 하나만 목표를 넘기면 된다 -> 최솟값
            need = nl if need is None else min(need, nl)
    if need is None:
        return lens, "모든 주연이 광축 뒤 (%s)" % ",".join(sorted(set(behind)))
    if need <= lens:
        return lens, ""

    # 교훈 210 : 렌즈를 올리면 화각이 좁아진다. 「지금 보이는 주연」을 밀어내는
    # 지점을 상한으로 둔다. G6(크기) 를 만족시키려 G8(가시성) 을 깨지 않는다.
    fov_ceil, pushed = fov_ceiling(lens, cam0, cam1, tgt0, tgt1, props)
    hard = min(LENS_CEIL, fov_ceil)
    new = min(need, hard)
    if new < lens:              # 화각 상한이 현재 렌즈보다 낮으면 올리지 않는다
        return lens, ""

    why = "주연을 화면 %.0f%% 로 담으려면 %.0fmm 필요" % (
        SUBJ_FRAC_TARGET * 100.0, need)
    if need > LENS_CEIL:
        why += " -- LENS_CEIL %.0f 에서 막힘 (소도구 누락 의심)" % LENS_CEIL
    if need > fov_ceil and fov_ceil < LENS_CEIL:
        why += " -- 화각 상한 %.0fmm 에서 막힘 (%s 가 밀려난다, 교훈 210)" % (
            fov_ceil, pushed or "?")
    return round(new, 1), why


CONVERGE_KEYS = ("반복", "세 프로젝트", "3개 프로젝트", "같은 역할", "공통")
NONE_KEYS = ("새 정보 금지", "읽히는 글자 금지")

# ---------------------------------------------------------------------------
# TEXT IS THE EXCEPTION, NOT THE DEFAULT            [CEO-75 (C), lesson 200]
# ---------------------------------------------------------------------------
# CEO-75: "영상에 문구가 반드시 필요한지는 상황에 따라 다른 것 같아요. 어짜피
# 자막이 있으니까요. ... 맥락에 따라 필요하면 반영한 것이죠."
#
# What this file used to do, measured over all 76 jobs:
#
#     want NONE  got TEXT : 61      <-- the defect
#     want NONE  got NONE : 10
#     want TEXT  got TEXT :  5
#
# gesture_of() returned "lift" as its FALLBACK, so 61 cuts carried a glyph the
# script never asked for.  Worse, previz_batch picks the texture per ACT, so
# those 61 cuts shared five sentences between them -- which is why the CEO saw
# "정답은 없습니다" over and over (CEO-74, first half).
#
# The script had said so all along.  Of 115 beats, 58 carry an explicit ban in
# camera_note ("읽히는 글자 금지", "문장 내용 선행 금지", "전달문구 생성 금지",
# "회사명·금액 읽힘 금지", ...) and only 5 fill on_screen_text.  So the default
# flips: NO TEXT unless the script names the text in on_screen_text.
BAN_KEYS = (
    "읽히는 글자 금지", "내용 선행 금지", "문장 내용 선행 금지", "선행 금지",
    "선행 채움 금지", "전달문구 생성 금지", "선택 이유 텍스트 금지",
    "읽힘 금지", "아직 비움", "임의 생성 금지", "동시 노출 금지",
)


def load_script():
    """sid -> script row.  The CSV is the narrative source of truth (lesson
    200); rows38.json is a derivative that dropped these columns."""
    by = {}
    for p in SCRIPTS:
        if not os.path.exists(p):
            raise SystemExit("missing script %s" % p)
        for r in csv.DictReader(open(p, encoding="utf-8-sig")):
            if r.get("sid"):
                by[r["sid"].strip()] = r
    return by

# Gaze height per gesture.  Kept identical in spirit to plan.py's TGT_END, but
# lifted onto the real desk surface: sets.py puts the tabletop at 0.762 m, while
# the old hard-coded set had its "desk" slab centred at -0.15 m, so a gaze of
# z=0.30 used to mean "above the table" and now means "through it".
TGT_Z = {"converge": DOC_Z + 0.30, "lift": DOC_Z + 0.12, "none": DOC_Z + 0.02}


def gesture_of(row, srow):
    """Which word gesture this beat carries -- decided by the SCRIPT.

    srow is the script CSV row for the same sid.  Order matters:

      1. on_screen_text filled  -> the script names the exact words, so they
         appear.  This wins even when camera_note also carries a ban clause,
         because the ban is about NOT pre-empting the sentence with invented
         copy, not about suppressing the sentence the script itself wrote.
      2. camera_note ban clause -> "none".
      3. no on_screen_text      -> "none".  This is the flipped default: the
         subtitle track already carries the words (CEO-75), so a glyph in the
         3D plate has to be asked for.
      4. converge stays available for the beats whose narration is literally
         about one thing repeating across three documents, but only when (1)
         gave us words to converge.
    """
    ost = (srow.get("on_screen_text") or "").strip() if srow else ""
    if not ost:
        return "none"
    if row["sid"].startswith("A8"):
        return "none"
    blob = " ".join([row.get("narr") or "", row.get("objects") or "",
                     row.get("reason") or ""])
    if any(k in blob for k in CONVERGE_KEYS):
        return "converge"
    return "lift"


SUBJ_NEAR = 0.25       # m — 주연이 이 안에 있으면 「카메라가 주연을 보고 있다」
G4_MOVE   = 0.35       # m — SCRIPT GATE G4 임계 (같은 장면 반복 판정)


def gaze_of(set_id, idx, prev, props=()):
    """이 컷의 주연을 보면서, 가능하면 직전 컷에서 멀어지는 시선점을 고른다.

    [lesson 200 / CEO-74 후반] 원래는 모든 컷이 doc_anchor[1](세트 중앙 문서)를
    봤다.  10세트가 원점 0.46 m 안의 9개 시선점으로 붕괴해 「한 책상을 여러
    각도에서 본 영상」이 됐다.  그래서 이 함수는 「직전에서 가장 먼 점」을 골랐다.

    [lesson 202 / CEO-76] 그 처방은 절반이었다.  다양성만 최적화하고 몰입은
    최적화하지 않았다.  실측 — 소도구를 지정한 6컷 중 ★4컷★ 에서 대본이 지정한
    주연 소도구가 시선점에서 0.63~1.69 m 떨어져 화면 밖에 있었다:

        J_A3-13  gaze(0.86, 0.10)  주연 0.665 m   ← 고를 수 있던 정답 cand3 0.102 m
        J_A3-14  gaze(-0.72,0.20)  주연 0.833 m   ← 정답 cand1 0.000 m
        J_A3-15  gaze(0.86,-0.30)  주연 0.632 m   ← 정답 cand1 0.000 m
        J_A3-16  gaze(0.00, 1.85)  주연 1.685 m   ← 정답 cand1 0.342 m

    정답 후보가 ★매 컷 존재했는데도★ 골라지지 않았다.  선택 기준에 「이 컷의
    주연이 어디 있는가」 가 아예 없었기 때문이다.  자막은 조건 카드를 말하는데
    카메라는 반대쪽 빈 책상을 보고 있으면, 장면이 아무리 달라져도 몰입은 없다.

    ★대표님 판정 (CEO-76)★
        "하나의 장면이 다각도로 반복되지 않고 여러 장면을 넣는 것도 좋지만,
         정말 내용에 몰입할 수 있는 영상 장면이 반영되고 있는가를 살펴야 해요.
         장면만 바뀌는 셈이면 아무리 퀄리티가 좋아도 영상의 몰입감은 없을 거에요."

    ⇒ 사전식 목표 (교훈 197 의 세 번째 적용처):
         1. ★주연을 본다★        (하드 — 대본이 소도구를 지정했다면 반드시)
         2. 직전에서 G4 이상 이동  (선호 — 같은 장면 반복 회피)
         3. 직전에서 최대한 멀리   (미학 — 결정적 tie-break)

    1순위가 2순위를 이긴다.  주연을 보는 후보가 하나뿐이면 이동량을 포기한다 —
    「보여줄 것을 보여주는 것」이 「다르게 보이는 것」보다 앞선다.  이때 G4 는
    같은 세트가 연속될 때만 문제가 되고, scenemap 의 VARIETY GATE 가 인접 반복을
    이미 0으로 만들어 두었으므로 실제 충돌은 발생하지 않는다 (아래에서 실측 확인).
    """
    cands = GAZE[set_id]

    def subj_d(c):
        """이 후보에서 주연 소도구까지의 수평거리. 소도구가 없으면 무관."""
        if not props:
            return 0.0
        return min(math.hypot(l[0] - c[0], l[1] - c[1])
                   for _, _, l, _, _ in props)

    def anchor_d(c):
        """[CEO-82/83 P1] 이 후보에서 ★앵커★(follow-the-object 대상)까지의 거리.

        앵커가 이 컷에 없으면 None -- 그때는 종전처럼 「가장 가까운 주연」을 본다.
        앵커가 있으면 ★앵커를 보는 것이 다른 어떤 주연을 보는 것보다 앞선다★:
        벤치마크 6/6 이 「하나를 따라가는」 서사이고 (CEO-82), 관객이 그 하나를
        놓치면 컷이 아무리 달라도 이어지는 것으로 안 보인다 (교훈 213).
        anchor_audit/replan.py [P1] 실측: 시선점을 앵커로 옮기면 4컷 중 3컷이
        화면폭 하한 0.14 를 통과한다 (나머지 1컷은 크기 처방 P2b 가 맡는다).
        """
        ds = [math.hypot(l[0] - c[0], l[1] - c[1])
              for nm, _, l, _, _ in props if nm == ANCHOR_NAME]
        return min(ds) if ds else None

    def cost(c):
        sd = subj_d(c)
        ad = anchor_d(c)
        mv = 1e9 if prev is None else math.dist(c, prev)
        # 앵커가 있는 컷은 앵커 거리를, 없으면 주연 거리를 1순위로 쓴다.
        key = sd if ad is None else ad
        return (0 if key <= SUBJ_NEAR else 1,     # 1. ★앵커★(없으면 주연)를 본다
                round(key, 4),                    #    (동률이면 더 가까운 쪽)
                0 if mv >= G4_MOVE else 1,        # 2. 같은 장면 반복 회피
                -round(mv, 4))                    # 3. 최대한 멀리

    if prev is None and not props:
        return cands[idx % len(cands)]
    return min(cands, key=cost)


def endpoints(rec, idx):
    """Cartesian camera/target endpoints that satisfy the renderer's ARC GATE.

    The start bearing is spread over the film rather than fixed at zero: with a
    constant start bearing every shot in a set opens from the same side of the
    room, which is a subtler version of the same monotony complaint.  The
    bearing is a deterministic function of the shot index (golden-angle stride,
    so successive shots land far apart and the sequence never repeats inside 76
    shots), and the sweep direction alternates.
    """
    arc = math.radians(rec["arc_deg"])
    sign = 1.0 if idx % 2 == 0 else -1.0
    a0 = math.radians((idx * 137.508) % 360.0)
    a1 = a0 + sign * arc
    r0, r1 = rec["r0"], rec["r1"]
    z0, z1 = rec["z0"], rec["z1"]
    cam0 = [round(r0 * math.sin(a0), 4), round(-r0 * math.cos(a0), 4), round(z0, 4)]
    cam1 = [round(r1 * math.sin(a1), 4), round(-r1 * math.cos(a1), 4), round(z1, 4)]
    return cam0, cam1


def main():
    sm = json.load(open(SCENEMAP))
    shots = sm["shots"]
    src = {r["sid"]: r for r in json.load(open(ROWS))["rows"]}
    scr = load_script()
    prev_band, prev_tgt = None, None
    jobs = []
    prev_gaze = None
    for i, rec in enumerate(shots):
        row = src[rec["sid"]]
        srow = scr.get(rec["sid"])
        g = gesture_of(row, srow)
        cam0, cam1 = endpoints(rec, i)
        # [lesson 200] the gaze rides a REAL object of this set, chosen away
        # from the previous cut's gaze -- not the centre document every time.
        # [lesson 202 / CEO-76] and when the script names props for this beat,
        # the gaze must land ON them: a cut whose subtitle talks about the
        # condition card while the camera studies the empty far end of the desk
        # is a different scene, not an immersive one.
        gz = gaze_of(rec["set"], i, prev_gaze, PROPS.get(rec["sid"], ()))
        prev_gaze = gz
        ax, ay = gz[0], gz[1]
        # A cut that carries a glyph must LOOK at the glyph.  Measured: with the
        # gaze moved onto real furniture but the word carrier still pinned to the
        # set's centre document slot, J_A3-01's glyph projected to x = 1.11 of
        # the frame half-width -- off frame at frame 1.  So on the five beats the
        # script gives words to, the carrier moves to the gaze point instead of
        # the camera being dragged back to the carrier.
        anchor = [list(a) for a in rec["doc_anchor"]]
        doc_z = rec["doc_z"]
        if g != "none":
            anchor[1] = [round(gz[0], 4), round(gz[1], 4)]
            doc_z = round(gz[2], 4)
        # a lift needs the glyph above the surface it leaves; without a glyph
        # the gaze stays on the object itself.
        tz = gz[2] + (0.12 if g == "lift" else (0.30 if g == "converge" else 0.0))
        tgt0 = [round(ax, 4), round(ay - 0.06, 4), round(tz, 4)]
        tgt1 = [round(ax, 4), round(ay - 0.02, 4), round(tz, 4)]
        _pr = PROPS.get(rec["sid"], ())
        lens, lens_why2 = refine_lens(rec["lens"], cam0, cam1, tgt0, tgt1, _pr)
        lens, why7 = separate_shot(lens, cam0, cam1, tgt0, tgt1, _pr,
                                   prev_band, prev_tgt, tgt1)
        if why7:
            lens_why2 = (lens_why2 + " / " + why7) if lens_why2 else why7
        prev_band = _band(lens, cam0, cam1, tgt0, tgt1, _pr)
        prev_tgt = tgt1
        job = {
            "job_id": "J_" + rec["sid"],
            "sids": rec["members"],
            "act": rec["sid"].split("-")[0],
            "set": rec["set"],
            "set_from": rec["set_from"],
            "move": rec["move"],
            "lens": lens,
            "lens_why": lens_why2 or rec.get("lens_why", ""),
            "level": rec["level"],
            "verb": rec["verb"],
            "frames": rec["frames"],
            "duration_s": round(rec["frames"] / float(FPS), 4),
            "hold_frac": rec["hold_frac"],
            "hold_frames": int(round(rec["frames"] * rec["hold_frac"])),
            "ease": rec["ease"],
            "arc_deg": rec["arc_deg"],
            "cam_start_xyz": cam0,
            "cam_end_xyz": cam1,
            # the gaze rides the set's own centre document, not world origin --
            # with ten sets the interesting geometry is no longer at (0,0).
            "tgt_start_xyz": tgt0,
            "tgt_end_xyz": tgt1,
            "doc_anchor": anchor,
            "doc_z": doc_z,
            "word_gesture": g,
            # lesson 174: round-robin over A/B/C pushed 30 of 51 lift jobs off
            # frame.  The lift word sits on the CENTRE sheet, always.
            "word_doc": "B" if g == "lift" else "",
            # [lesson 200] WHICH sentence, per cut.  The renderer used to look
            # up the texture by ACT, so all 16 A3 cuts printed the one A3
            # sentence.  Now the key is the beat id and the text comes from the
            # script's own on_screen_text column.
            "word_key": rec["sid"] if g != "none" else "",
            "on_screen_text": (srow.get("on_screen_text") or "").strip()
                              if srow else "",
            "screen_direction": (srow.get("screen_direction") or "").strip()
                                if srow else "",
            "camera_note": (srow.get("camera_note") or "").strip()
                           if srow else "",
            "gaze_xyz": [round(gz[0], 4), round(gz[1], 4), round(gz[2], 4)],
            "cut": rec["cut"],
            "chain": rec["chain"],
            "delta": rec["delta"],
            "narr": row.get("narr") or "",
            "objects": row.get("objects") or "",
            "motion_reason": row.get("reason") or "",
            "t0": rec["t0"], "t1": rec["t1"],
            "fit_scale": rec["fit_scale"],
        }
        jobs.append(job)

    # ---- gates ------------------------------------------------------------
    # (a) the ARC GATE that previz_batch will run -- verified HERE so a bad
    #     endpoint is caught in 0.2 s instead of after a scene build.
    for j in jobs:
        a = j["cam_start_xyz"]; b = j["cam_end_xyz"]
        a0 = math.atan2(a[0], -a[1]); a1 = math.atan2(b[0], -b[1])
        arc = a1 - a0
        while arc > math.pi:
            arc -= 2 * math.pi
        while arc < -math.pi:
            arc += 2 * math.pi
        if abs(abs(math.degrees(arc)) - abs(j["arc_deg"])) > 1.0:
            raise SystemExit("ARC GATE FAILED %s: %.2f vs %.2f"
                             % (j["job_id"], math.degrees(arc), j["arc_deg"]))
    # (b) radius must match what scenemap fitted (no silent rescale here)
    for j, rec in zip(jobs, shots):
        r0 = math.hypot(*j["cam_start_xyz"][:2])
        r1 = math.hypot(*j["cam_end_xyz"][:2])
        if abs(r0 - rec["r0"]) > 0.01 or abs(r1 - rec["r1"]) > 0.01:
            raise SystemExit("RADIUS GATE FAILED %s: %.3f/%.3f vs %.3f/%.3f"
                             % (j["job_id"], r0, r1, rec["r0"], rec["r1"]))
    # (c) the camera must stay above the desk surface, or it films the underside
    for j in jobs:
        if min(j["cam_start_xyz"][2], j["cam_end_xyz"][2]) < DESK_Z + 0.05:
            raise SystemExit("HEIGHT GATE FAILED %s: z %.3f/%.3f below desk %.3f"
                             % (j["job_id"], j["cam_start_xyz"][2],
                                j["cam_end_xyz"][2], DESK_Z))
    # (d) coverage: the job list must be the whole script, once
    tot = sum(j["frames"] for j in jobs)
    src_tot = sum(max(1, int(round((r["t1"] - r["t0"]) * FPS)))
                  for r in json.load(open(ROWS))["rows"])
    if tot != src_tot:
        raise SystemExit("COVER GATE FAILED: %d f vs %d f" % (tot, src_tot))
    seen = set()
    for j in jobs:
        for s in j["sids"]:
            if s in seen:
                raise SystemExit("COVER GATE FAILED: sid %s twice" % s)
            seen.add(s)
    if len(seen) != len(src):
        raise SystemExit("COVER GATE FAILED: %d sids of %d" % (len(seen), len(src)))

    json.dump({"jobs": jobs}, open(OUT, "w"), ensure_ascii=False, indent=1)
    import collections
    gc = collections.Counter(j["word_gesture"] for j in jobs)
    print("SCENEJOBS OK  %d jobs  %d f = %.3f s" % (len(jobs), tot, tot / float(FPS)))
    print("  gestures  " + "  ".join("%s=%d" % kv for kv in gc.most_common()))
    print("  lens      %.0f-%.0f mm over %d distinct values"
          % (min(j["lens"] for j in jobs), max(j["lens"] for j in jobs),
             len(set(j["lens"] for j in jobs))))
    print("  cam z     %.2f-%.2f m   radius %.2f-%.2f m"
          % (min(min(j["cam_start_xyz"][2], j["cam_end_xyz"][2]) for j in jobs),
             max(max(j["cam_start_xyz"][2], j["cam_end_xyz"][2]) for j in jobs),
             min(math.hypot(*j["cam_start_xyz"][:2]) for j in jobs),
             max(math.hypot(*j["cam_start_xyz"][:2]) for j in jobs)))
    print("-> %s" % OUT)


if __name__ == "__main__":
    main()
