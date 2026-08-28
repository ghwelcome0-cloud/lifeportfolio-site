#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SCRIPT GATE — 대본이 지시한 것과 잡이 하려는 것이 일치하는지 검사한다.

■ 왜 이것이 존재하는가 (재발 방지 · CEO 지시)
   숏폼 C 를 보신 대표님이 두 가지를 지적하셨다.
     (1) "'정답은 없습니다'만 계속 반복하는 이유가 뭐에요?"
     (2) "영상은 하나의 장면을 다각도로 돌리는 느낌"
   실측해 보니 두 지적은 하나의 뿌리였다.

   previz_batch.py line 465 는 글자 텍스처를 ACT 단위로 골랐다:
       word = WORDS/"%s.png" % job["act"]
   문장 재고는 ACT 당 1장이므로, A3 의 16개 잡이 전부 "정답은 없습니다" 한
   장을 썼다. 그런데 더 근본적인 문제는 그 앞에 있었다 —

   ★대본은 애초에 61개 컷에서 "글자를 넣지 말라"고 지시하고 있었다.★

   전수 계측 (SCRIPT_ACT1-2.csv + SCRIPT_ACT3-8.csv, 76잡):
       want TEXT / got TEXT :  4   (대본이 원하고 렌더도 실음 — 정상)
       want NONE / got NONE : 10   (둘 다 없음 — 정상)
       want NONE / got TEXT : 61   ★대본은 금지, 렌더는 실음 — 결함★
       want CONFLICT        :  1   (on_screen_text 있으나 금지절도 있음)

   대본의 camera_note 는 115행 중 58행에 "| ~ 금지" 절을 달고 있고, 그중
   "읽히는 글자 금지" "내용 선행 금지" "문장 내용 선행 금지" "선행 채움 금지"
   "전달문구 생성 금지" "선택 이유 텍스트 금지" "읽힘 금지" "아직 비움"
   같은 것들은 명시적으로 글자를 막는 지시다. on_screen_text 열이 비어 있는
   것도 같은 뜻이다 — 그 컷에 뜨는 문구는 없다.

   대표님 말씀: "영상에 문구가 반드시 필요한지는 상황에 따라 다른 것 같아요.
   어차피 자막이 있으니까요. 벤치마크 하라고 전달해준 영상들도 보면 다 문구를
   무조건 반영하지 않았어요. 맥락에 따라 필요하면 반영한 것이죠."

   즉 글자는 기본값이 아니라 예외다. 렌더러가 그 반대로 동작했다.

■ 왜 문서가 아니라 코드인가 (헌법 R3)
   "다음에 동일한 실수를 반복하지 않게 해달라"는 지시에 대한 답은 주석이나
   체크리스트가 아니다. 교훈 187 이 이미 말했다 — 게이트를 「경고」로 만들면
   결함이 그대로 렌더된다. 그러므로 이 검사는 SystemExit 로 렌더를 막는다.
   대본을 읽지 않은 잡은 렌더될 수 없다.

■ 무엇을 검사하는가
   G1  대본이 글자를 금지한 컷에 word_gesture 가 lift/converge 이면 실패
   G2  대본이 글자를 요구한 컷(on_screen_text 있음)에 글자가 없으면 실패
   G3  같은 문장이 연속된 컷에 두 번 이상 연달아 나오면 실패
       (대표님 지적 (1) 의 직접 방지 — 반복은 재고 부족이 아니라 배급 실패다)
   G5  ★몰입★ 대본이 이 컷에 소도구를 지정했으면, 카메라 시선이 그 소도구
       (하나를 지목하는 컷이면 최근접, 둘을 대비하는 컷이면 무게중심) 로부터
       0.25m 안에 있어야 한다.
       [CEO-76] "하나의 장면이 다각도로 반복되지 않고 여러 장면을 넣는 것도
        좋지만, 정말 내용에 몰입할 수 있는 영상 장면이 반영되고 있는가를 살펴야
        해요. 장면만 바뀌는 셈이면 아무리 퀄리티가 좋아도 영상의 몰입감은
        없을 거에요."
       ★G4 는 「다르냐」를 보고 G5 는 「맞냐」를 본다. G4 만 있으면 자막이
        조건 카드를 말하는 동안 카메라가 빈 책상을 봐도 통과한다 —
        실측으로 6컷 중 4컷이 그 상태였다 (교훈 202).★

   G4  시선점(tgt)이 직전 컷과 0.35m 안이고 카메라 반경도 0.6m 안이면 실패
       (대표님 지적 (2) 의 직접 방지 — 세트 이름이 달라도 시선이 같으면
        관객에게는 한 장면이다. 실측: 숏폼 C 6컷의 시선점이 전부 원점 근처
        (0,0,0.89) 였고 반경도 1.25~2.67m 에 몰려 있었다)

CLI:  python3 script_gate.py            전수 검사, 실패 시 exit 1
      python3 script_gate.py --report   실패해도 exit 0, 표만 출력
"""
import csv, json, math, os, sys, collections

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sets import PROPS                                        # noqa: E402

SCRIPTS = ["/home/user/lf/_script/SCRIPT_ACT1-2.csv",
           "/home/user/lf/_script/SCRIPT_ACT3-8.csv"]
JOBSFILE = os.environ.get("PREVIZ_JOBSFILE", "/home/user/lf/r3d/scenejobs.json")

# 대본에서 「글자 금지」로 읽어야 하는 표현. 대본 전수 스캔으로 뽑은 실제 문구다.
BAN_KEYS = [
    "읽히는 글자 금지", "내용 선행 금지", "문장 내용 선행 금지", "선행 금지",
    "선행 채움 금지", "전달문구 생성 금지", "선택 이유 텍스트 금지",
    "읽힘 금지", "아직 비움", "임의 생성 금지", "동시 노출 금지",
]

TGT_MIN_MOVE = 0.35      # m, 시선점이 이보다 가까우면 같은 장면
RAD_MIN_MOVE = 0.60      # m, 카메라 반경도 이보다 가까우면 같은 장면
SUBJ_NEAR    = 0.25      # m, G5 — 주연이 이보다 가까우면 「보고 있다」

# 「하나를 지목」과 「둘을 대비」는 판정 단위가 다르다 (교훈 198-1).
#   J_A3-16 대본: "회의 브리프 1장과 옆의 개인 설계 노트" — 둘을 함께 보는 컷.
#   개별 최근접 0.342m 로 재면 실패지만 무게중심에서는 0.066m 다.
#   "멀다"가 아니라 "둘 사이"였다. 대비 컷은 무게중심으로 잰다.
CONTRAST_KEYS = ("와 옆의", "과 옆의", "함께 놓임", "각각", "양쪽", "두 장면", "옆에")

# ---------------------------------------------------------------------------
# G6 — 프레이밍: 주연이 「보일 만큼 크게」 찍혔는가        [교훈 203 / CEO-77]
# ---------------------------------------------------------------------------
# G5 를 통과시킨 직후 v2 렌더 프레임을 직독해서 알아낸 것이다.
#
#   J_A4-01 마지막 프레임: 밝은 시트(주연=이력서 3장) 화소 ★0.00%★
#   그런데 G5 는 0.020 m 로 「최우수 통과」였다.
#
# G5 는 카메라가 주연을 향했는지(★방향★)만 보고, 주연이 화면에서 얼마나
# 큰지(★크기★)는 보지 않았다.  전수 재측정 — 개별 주연 한 개의 최대 화면 폭:
#
#   J_A3-13  0.051 =  65 px / 1280   ★너무 작다★
#   J_A3-14  0.276 = 353 px           OK
#   J_A3-15  0.266 = 340 px           OK
#   J_A3-16  0.097 = 124 px           ★너무 작다★
#   J_A3-17  0.072 =  92 px           ★너무 작다★
#   J_A4-01  0.061 =  78 px           ★너무 작다★
#
# ★4 / 6 컷의 주연이 65~124 px 다.★  A4 종이 한 장이 화면에서 손톱만 하다.
# 자막은 "남기고 싶은 변화" 를 말하는데 화면에는 회색 책상만 있다.
#
# ★왜 「합집합 폭」으로 재면 안 되는가 (교훈 201 의 3D 판)★
#   처음에는 주연군 전체의 bbox 폭으로 재서 J_A4-01 = 0.643~0.922 (=우수) 가
#   나왔다.  그러나 그 폭 4.95 m 는 이력서 3장(각 0.15 m) ★사이의 빈 공간★
#   이었다.  화면을 채운 것은 주연이 아니라 주연들 사이의 허공이다.
#   ⇒ 채움률과 똑같은 함정이다: 덩어리(개별 객체)마다 재야 한다.
#
# ★임계값의 근거 (발명하지 않았다)★
#   통과한 두 컷(A3-14/15)의 실측이 0.266~0.276 이고, 렌더 직독에서 실제로
#   주연이 읽혔다.  실패한 넷은 0.051~0.097 이고 읽히지 않았다.  경계는 그
#   사이에 있다.  하한을 0.14 (= 1280 px 중 179 px) 로 둔다 — 실패군 최댓값
#   0.097 보다 위, 통과군 최솟값 0.266 보다 아래의, 실패군에 가까운 쪽이다.
#   게이트는 「합격을 넉넉히」가 아니라 「불합격을 확실히」 잡아야 한다(교훈 199).
SUBJ_FRAC_MIN = 0.14     # 개별 주연 하나가 최소 이만큼은 화면 폭을 차지해야 한다
SENSOR_MM     = 36.0     # previz_batch 의 SENSOR 와 같은 값 (교훈 176: 복제 금지)

# ---------------------------------------------------------------------------
# G7 — 샷 사이즈: 연속된 두 컷이 「같은 크기」면 지루하다   [교훈 202 파생 3]
# ---------------------------------------------------------------------------
# G4 는 「시선점이 움직였는가」를 본다.  그런데 대본이 같은 대상의 연속 동작을
# 요구하는 컷(A3-14 "빈 본문 바" → A3-15 "손이 본문을 채움")에서는 시선이 같은
# 것이 ★대본대로 맞다★.  영화도 같은 대상을 크기를 바꿔 잇는다.
#
# 그러므로 그 경우 G4 를 느슨하게 하는 것이 아니라(교훈 199), ★샷 사이즈가
# 실제로 달라졌는지★ 를 따로 물어야 한다.  실측:
#
#   J_A3-14 배율대 [29.4 .. 53.0]   J_A3-15 [35.3 .. 46.9]   중첩 ★49%★
#   ⇒ A3-15 의 배율 전체가 A3-14 의 배율 안에 들어 있다.  두 컷은 「비슷한」
#     것이 아니라 ★같은 샷 사이즈★ 다.  그래서 지루하다.
#
# 판정 지표는 lens/거리 (= 화각 배율).  같은 주연을 잇는 두 컷은 배율대의
# 중첩이 SHOT_OVERLAP_MAX 이하여야 한다 — 클로즈업 다음에는 와이드가 온다.
SHOT_OVERLAP_MAX = 0.34


def load_script():
    by = {}
    for f in SCRIPTS:
        for r in csv.DictReader(open(f, encoding="utf-8-sig")):
            by[r["sid"]] = r
    return by


def load_jobs():
    d = json.load(open(JOBSFILE))
    return d["jobs"] if isinstance(d, dict) else d


def wants_text(job, by):
    """이 잡에 글자가 있어야 하는가. 대본이 정한다.

    반환 (want, ost, why)
      want  True/False/None(None = 대본에 근거 없음, 판단 보류)
      ost   대본이 지정한 문구 (있으면)
    """
    osts, cns = [], []
    for s in job.get("sids", []):
        r = by.get(s)
        if not r:
            continue
        osts.append(r.get("on_screen_text", "").strip())
        cns.append(r.get("camera_note", ""))
    ost = next((o for o in osts if o), "")
    banned = any(any(k in c for k in BAN_KEYS) for c in cns)
    if ost and not banned:
        return True, ost, "on_screen_text 지정"
    if ost and banned:
        return True, ost, "on_screen_text 지정 (금지절 공존 — 문구 우선)"
    if banned:
        return False, "", "camera_note 금지절"
    return False, "", "on_screen_text 비어 있음"


def _norm(v):
    n = math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) or 1e-9
    return [v[0] / n, v[1] / n, v[2] / n]


def _sub(a, b):
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]


def _dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


# ---------------------------------------------------------------------------
# G8 — 「화각 안에 있는가」 그리고 「가려지지 않았는가」        [교훈 210]
# ---------------------------------------------------------------------------
# G6 를 6/6 통과시킨 뒤 v3 렌더 프레임을 직독해서 알게 된 것이다.
#
#   J_A4-01  G6 판정 0.175 (통과)  vs  렌더 실측 ★0.000★
#   전 프레임이 lum 99~104 의 완전 균일 회색 = 아무것도 안 보이는 컷이었다.
#
# ★원인 두 겹★
#   (1) 화각 밖:  렌즈를 올려 「크기」를 만들었더니 화각이 좁아져(80mm =
#       수평 반화각 12.7도) 주연이 프레임 밖으로 밀려났다. res1 은 광축에서
#       22.4도, res2 는 46.3도 — 둘 다 밖이다. 그런데 G6 는 「밖에 있는 것의
#       크기」를 재서 0.175 로 통과시켰다.
#       ⇒ ★렌즈를 올리는 처방 자체가 새 결함을 만들 수 있다★. 크기와 화각은
#         같은 렌즈가 반대 방향으로 움직이는 두 값이다.
#   (2) 가림:  S4 room("upper") 의 "floor" 라 이름 붙은 14x11m 판은 z 2.38~2.50
#       에 있고 서가·이력서는 z 0.34~1.65 다. 즉 그것은 사실 ★천장★ 이다.
#       J_A4-01 카메라 z 는 4.757 -> 2.717 로 ★전 구간이 그 천장 위★ 였다.
#       화면을 채운 회색은 천장 밑면이었다.
#
# ★교훈 210★ 「크다」는 「보인다」가 아니다. 화면상 크기를 재는 것만으로는
#   부족하고, ①광축에서 화각 안인가 ②사이에 벽/바닥/천장이 없는가 를 함께
#   물어야 한다. G6 처럼 하나의 축만 재는 게이트는 다른 축으로 새는 결함을
#   통과시킨다(교훈 203 의 세 번째 재발).
#
# ★prototype 으로 먼저 반증했다 (교훈 206)★ 이 산식으로 6컷을 재면
#   A3-13 0.175 / A3-14 0.275 / A3-15 0.299 / A3-16 0.175 / A3-17 0.175 / A4-01 ★0.000★
#   이고, 렌더 프레임 직독(밝은 덩어리 최장변/W)은
#   0.268 / 0.320 / 0.310 / 0.196 / 0.249 / ★0.000★ 이다 — ★6/6 부합★.
RES_W, RES_H = 1280.0, 720.0        # previz_batch.RES (교훈 176: 복제 금지)
SENSOR_H_MM = SENSOR_MM * RES_H / RES_W
# blocker 는 「벽·바닥·천장 급 대형 판」만 센다. 작은 소도구를 중심광선 하나로
# 재면 오탐이 난다 — A3-17 의 posting 이 얇은 note 한 장에 「가려졌다」고 잡혔지만
# 렌더에서는 0.249 로 잘 보였다. 프레임을 통째로 덮을 수 있는 것만 blocker 다.
BLOCK_MIN_M = 2.0


def _cross(a, b):
    return [a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0]]


def cam_basis(cam, tgt):
    """카메라 정면 / 오른쪽 / 위 단위벡터. Blender 와 같은 up=+Z 규약."""
    f = _norm(_sub(tgt, cam))
    up = [0.0, 0.0, 1.0]
    if abs(_dot(f, up)) > 0.999:
        up = [0.0, 1.0, 0.0]
    r = _norm(_cross(f, up))
    return f, r, _norm(_cross(r, f))


def _ray_aabb(o, d, lo, hi, tmax):
    """반직선 o+t*d 가 (1e-4, tmax) 안에서 축정렬 박스와 만나는가 (slab test)."""
    t0, t1 = 1e-4, tmax
    for i in range(3):
        if abs(d[i]) < 1e-12:
            if o[i] < lo[i] or o[i] > hi[i]:
                return False
            continue
        a = (lo[i] - o[i]) / d[i]
        b = (hi[i] - o[i]) / d[i]
        if a > b:
            a, b = b, a
        if a > t0:
            t0 = a
        if b < t1:
            t1 = b
        if t0 > t1:
            return False
    return True


def blockers_of(set_id, sid, props):
    """이 컷의 세트에서 프레임을 덮을 수 있는 대형 판들의 AABB 목록."""
    from sets import build_spec
    prop_names = {"pr_%s" % p[0] for p in props}
    out = []
    for nm, _k, loc, sc, _c in build_spec(set_id, sid):
        if nm in prop_names or max(sc) < BLOCK_MIN_M:
            continue
        out.append((nm,
                    [loc[i] - sc[i] for i in range(3)],
                    [loc[i] + sc[i] for i in range(3)]))
    return out


def visible(cam, tgt, loc, lens, blocks):
    """이 지점이 화각 안이고 대형 판에 가려지지 않았는가.

    반환 (bool, why) — why 는 실패 사유 문자열 ("" = 통과).
    """
    f, r, u = cam_basis(cam, tgt)
    d = _sub(loc, cam)
    dep = _dot(d, f)
    if dep < 0.05:
        return False, "광축 뒤(depth %.3f)" % dep
    hv = math.atan(SENSOR_MM * 0.5 / lens)
    vv = math.atan(SENSOR_H_MM * 0.5 / lens)
    ax = math.atan2(abs(_dot(d, r)), dep)
    ay = math.atan2(abs(_dot(d, u)), dep)
    if ax > hv or ay > vv:
        return False, ("화각 밖(광축에서 h %.1f도 / v %.1f도, 반화각 h %.1f / v %.1f)"
                       % (math.degrees(ax), math.degrees(ay),
                          math.degrees(hv), math.degrees(vv)))
    dn = _norm(d)
    tm = math.sqrt(_dot(d, d))
    hit = [b[0] for b in blocks if _ray_aabb(cam, dn, b[1], b[2], tm * 0.999)]
    if hit:
        return False, "가려짐(%s)" % ",".join(sorted(set(hit))[:3])
    return True, ""


def subj_frac(job, props):
    """이 컷에서 「개별 주연 하나」가 차지하는 최대 화면 폭 비율. [G6]

    핀홀 투영: frac = 실물폭 * lens_mm / (depth_m * SENSOR_MM)
      depth = 카메라 광축(cam->tgt) 방향으로의 거리. 광축 뒤(음수)면 화면 밖이다.
      실물폭 = 2 * max(sc[0], sc[1]).  소도구는 책상 평면에 눕는 납작한 종이/카드
        이고 카메라는 내려다보므로 화면상 크기는 최장변이 정한다. 실측으로 확인:
        최장변으로 재면 A3-16 = 124 px, x 폭으로만 재면 88 px 가 나오는데 렌더
        직독에서 읽힌 크기는 전자에 가깝다. ★관대한 쪽을 쓴다 — 관대하게 재도
        실패하면 확실한 실패다.★

    ★합집합이 아니라 개별로 재는 이유 (교훈 201 의 3D 판 / 교훈 203)★
      주연군 전체 bbox 폭으로 재면 J_A4-01 이 0.643~0.922(=우수) 로 나온다.
      그런데 그 폭 4.95 m 는 이력서 3장(각 0.15 m) ★사이의 빈 공간★ 이다.
      화면을 채운 것은 주연이 아니라 주연들 사이의 허공이었다.

    반환 (best_frac, worst_name, detail_list)
    """
    L = float(job["lens"])
    best, who = 0.0, ""
    det = []
    # ★교훈 210★ 「크다」는 「보인다」가 아니다. 화각 밖으로 밀려났거나 벽/천장에
    # 가려진 주연의 크기를 세면 J_A4-01 처럼 완전 회색 화면이 0.175 로 통과한다.
    blocks = blockers_of(job["set"], job.get("sid") or "", props) \
        if job.get("set") else []
    for cam, tgt in ((job["cam_start_xyz"], job["tgt_start_xyz"]),
                     (job["cam_end_xyz"], job["tgt_end_xyz"])):
        f = _norm(_sub(tgt, cam))
        for nm, _kind, loc, sc, _col in props:
            dep = _dot(_sub(loc, cam), f)
            if dep < 0.05:                      # 카메라 뒤 / 렌즈에 붙음 = 화면 밖
                det.append((nm, dep, None))
                continue
            fr = 2.0 * max(sc[0], sc[1]) * L / (dep * SENSOR_MM)
            ok, why = visible(cam, tgt, loc, L, blocks)
            det.append((nm, dep, fr if ok else None))
            if not ok:
                continue                        # 안 보이는 것은 크기를 세지 않는다
            if fr > best:
                best, who = fr, nm
    return best, who, det


def has_lens(job):
    """레거시 jobs.json 은 lens 필드가 없다.  [교훈 209]

    없는 것을 0 으로 채우면 G6/G7 이 「통과」해 버린다(교훈 199: 가드로 덮지
    말라). 그래서 값을 만들지 않고, 렌즈가 없다는 사실을 그대로 되돌려
    G6/G7 을 「검사 불가」로 기록하게 한다 — 침묵 통과가 아니다.
    """
    return job.get("lens") is not None


def shot_band(job, props):
    """이 컷의 「샷 사이즈 대역」 = lens / 주연까지 거리 의 [최소, 최대]. [G7]

    영화에서 샷 사이즈는 화각 배율이 정한다. 같은 주연을 잇는 두 컷이 이 대역을
    거의 공유하면 관객에게는 ★같은 크기의 같은 그림★ 이다 — 시선점이 움직였는지
    (G4) 와는 다른 질문이다.

    주연이 지정된 컷은 주연까지의 거리로, 없으면 시선점까지의 거리로 잰다.
    """
    L = float(job["lens"])
    ds = []
    for cam, tgt in ((job["cam_start_xyz"], job["tgt_start_xyz"]),
                     (job["cam_end_xyz"], job["tgt_end_xyz"])):
        if props:
            d = min(math.dist(cam, list(l)) for _n, _k, l, _s, _c in props)
        else:
            d = math.dist(cam, tgt)
        ds.append(max(d, 0.05))
    mags = [L / d for d in ds]
    return min(mags), max(mags)


def band_overlap(a, b):
    """두 대역의 겹침 비율 (겹침 길이 / 합집합 길이). 1.0 = 완전히 같은 샷."""
    lo = max(a[0], b[0])
    hi = min(a[1], b[1])
    inter = max(0.0, hi - lo)
    union = max(a[1], b[1]) - min(a[0], b[0])
    return 0.0 if union <= 1e-9 else inter / union


def check(report_only=False):
    by = load_script()
    jobs = load_jobs()
    fails, notes, subj_ok = [], [], []
    frame_ok, shot_ok = [], []
    prev_band, prev_props, prev_jid = None, None, None
    prev_tgt_for_g7 = None
    stat = collections.Counter()

    prev_txt, prev_tgt, prev_rad = None, None, None
    for j in jobs:
        jid = j["job_id"]
        want, ost, why = wants_text(j, by)
        got = j["word_gesture"] in ("lift", "converge")
        stat[(want, got)] += 1

        # G1 / G2
        if got and not want:
            fails.append("G1 %s: 대본은 글자 없음(%s) 인데 word_gesture=%s"
                         % (jid, why, j["word_gesture"]))
        if want and not got:
            fails.append("G2 %s: 대본이 글자를 요구(%r) 하는데 word_gesture=%s"
                         % (jid, ost, j["word_gesture"]))

        # G3 — 같은 문장 연달아
        cur = ost if (want and got) else None
        if cur and prev_txt and cur == prev_txt:
            fails.append("G3 %s: 직전 컷과 같은 문장 %r 이 연달아 나온다" % (jid, cur))
        if cur:
            prev_txt = cur

        # G4 — 시선점/반경이 직전 컷과 같으면 같은 장면
        t = j["tgt_start_xyz"]
        c = j["cam_start_xyz"]
        rad = math.hypot(c[0], c[1])
        if prev_tgt is not None:
            dt = math.dist(t, prev_tgt)
            dr = abs(rad - prev_rad)
            if dt < TGT_MIN_MOVE and dr < RAD_MIN_MOVE:
                notes.append("G4 %s: 시선점 이동 %.2fm / 반경 변화 %.2fm — 직전 컷과 같은 장면"
                             % (jid, dt, dr))
        prev_tgt, prev_rad = t, rad

        # G5 — 몰입: 대본이 지정한 주연을 카메라가 보고 있는가
        props = PROPS.get(jid.replace("J_", ""), ())
        if props:
            sd = (j.get("screen_direction") or "")
            contrast = any(k in sd for k in CONTRAST_KEYS)
            if contrast:
                cx = sum(l[0] for _, _, l, _, _ in props) / float(len(props))
                cy = sum(l[1] for _, _, l, _, _ in props) / float(len(props))
                d = math.hypot(cx - t[0], cy - t[1])
                how = "대비 무게중심"
            else:
                d = min(math.hypot(l[0] - t[0], l[1] - t[1])
                        for _, _, l, _, _ in props)
                how = "지목 최근접"
            if d > SUBJ_NEAR:
                fails.append("G5 %s: 자막이 말하는 주연이 %.2fm 밖에 있다 (%s, 상한 %.2f) "
                             "— 장면은 달라도 몰입이 없다"
                             % (jid, d, how, SUBJ_NEAR))
            else:
                subj_ok.append("%s %.3fm (%s)" % (jid, d, how))

        # G6 — 프레이밍: 주연이 「보일 만큼 크게」 찍혔는가   [교훈 203 / CEO-77]
        #   G5 를 통과시킨 뒤 v2 렌더 프레임을 직독해서 알게 된 것이다.
        #   J_A4-01 마지막 프레임의 밝은 시트(=이력서 3장) 화소는 0.00% 였는데
        #   G5 는 0.020 m 로 「최우수 통과」였다. G5 는 카메라가 주연을 향했는지
        #   (방향) 만 보고 주연이 화면에서 얼마나 큰지(크기) 는 보지 않았다.
        if props and not has_lens(j):
            fails.append("G6/G7 %s: lens 필드가 없어 프레이밍을 검사할 수 없다 "
                         "— 레거시 jobs.json 이면 scenejobs.json 을 써라 "
                         "(교훈 209)" % jid)
        elif props:
            fr, who, det = subj_frac(j, props)
            behind = [nm for nm, dep, x in det if x is None]
            if fr < SUBJ_FRAC_MIN:
                msg = ("G6 %s: 주연이 화면 폭의 %.1f%% (%.0f px / 1280) 뿐이다 "
                       "— 하한 %.1f%%. 자막은 주연을 말하는데 화면에는 배경만 있다"
                       % (jid, fr * 100.0, fr * 1280.0, SUBJ_FRAC_MIN * 100.0))
                if behind:
                    msg += " / 광축 뒤로 빠진 객체: %s" % ",".join(sorted(set(behind)))
                fails.append(msg)
            else:
                frame_ok.append("%s %.3f (%.0f px, %s)" % (jid, fr, fr * 1280.0, who))

        # G7 — 샷 사이즈: 연속된 두 컷이 「같은 크기」면 지루하다  [교훈 202 파생 3]
        #   G4 는 「시선점이 움직였는가」를 본다. 그런데 대본이 같은 대상의 연속
        #   동작을 요구하는 컷(A3-14 "빈 본문 바" -> A3-15 "손이 본문을 채움") 에서는
        #   시선이 같은 것이 ★대본대로 맞다★. 영화도 같은 대상을 크기를 바꿔 잇는다.
        #   그래서 G4 를 느슨하게 하지 않고(교훈 199) 샷 사이즈를 따로 검사한다.
        if not has_lens(j):
            prev_band, prev_props, prev_jid = None, props, jid
            prev_tgt_for_g7 = t
            continue
        band = shot_band(j, props)
        if prev_band is not None and prev_tgt_for_g7 is not None:
            same_subject = (math.dist(t, prev_tgt_for_g7) < TGT_MIN_MOVE)
            if same_subject:
                ov = band_overlap(band, prev_band)
                if ov > SHOT_OVERLAP_MAX:
                    fails.append(
                        "G7 %s: 직전 컷 %s 과 샷 사이즈가 %.0f%% 겹친다 "
                        "(배율 [%.1f..%.1f] vs [%.1f..%.1f], 상한 %.0f%%) "
                        "— 같은 주연을 같은 크기로 두 번 찍었다"
                        % (jid, prev_jid, ov * 100.0, band[0], band[1],
                           prev_band[0], prev_band[1], SHOT_OVERLAP_MAX * 100.0))
                else:
                    shot_ok.append("%s->%s 겹침 %.0f%%" % (prev_jid, jid, ov * 100.0))
        prev_band, prev_props, prev_jid = band, props, jid
        prev_tgt_for_g7 = t

    print("=== 대본 의도 vs 잡 설정 (%d jobs) ===" % len(jobs))
    for k in sorted(stat, key=lambda x: (str(x[0]), str(x[1]))):
        tag = "정상" if k[0] == k[1] else "★결함★"
        print("  want %-5s got %-5s : %3d   %s" % (k[0], k[1], stat[k], tag))
    print()
    print("IMMERSION (G5, 자막 주연을 보고 있는 컷): %d / %d 지정컷"
          % (len(subj_ok), len(subj_ok) + sum(1 for f in fails if f.startswith("G5"))))
    for o in subj_ok:
        print("   " + o)
    print()
    n_g6 = sum(1 for f in fails if f.startswith("G6"))
    print("FRAMING (G6, 주연이 화면 폭 %.0f%% 이상): %d / %d 지정컷"
          % (SUBJ_FRAC_MIN * 100.0, len(frame_ok), len(frame_ok) + n_g6))
    for o in frame_ok:
        print("   " + o)
    print()
    n_g7 = sum(1 for f in fails if f.startswith("G7"))
    print("SHOT SIZE (G7, 같은 주연 연속컷 배율 겹침 %.0f%% 이하): %d / %d 연속쌍"
          % (SHOT_OVERLAP_MAX * 100.0, len(shot_ok), len(shot_ok) + n_g7))
    for o in shot_ok:
        print("   " + o)
    print()
    print("SCENE NOTES (G4, 같은 장면 반복): %d" % len(notes))
    for n in notes[:12]:
        print("   " + n)
    print()
    print("FAILURES (G1/G2/G3/G5/G6/G7): %d" % len(fails))
    for f in fails[:30]:
        print("   " + f)
    if len(fails) > 30:
        print("   ... +%d more" % (len(fails) - 30))

    if fails and not report_only:
        raise SystemExit("SCRIPT GATE FAILED: %d violations" % len(fails))
    print("\nSCRIPT GATE %s" % ("OK" if not fails else "REPORT ONLY (%d fails)" % len(fails)))
    return fails, notes


if __name__ == "__main__":
    check(report_only="--report" in sys.argv)
