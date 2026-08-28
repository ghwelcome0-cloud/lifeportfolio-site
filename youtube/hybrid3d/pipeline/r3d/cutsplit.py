#!/usr/bin/env python3
"""cutsplit.py -- G11 리듬 분할기.  긴 컷을 「같은 궤적의 연속 구간」으로 쪼갠다.

★왜 이 파일이 필요한가 ([CEO-85] ③ / [CEO-82] B / [CEO-80] B)★
------------------------------------------------------------------
벤치마크 6/6 이 전부 컷 길이 0.5~4.0 s 대역이다 (76_BENCHMARK_STUDY.md §9).
우리 롱폼 실측은 med 4.29 s / max 9.50 s, 4 s 초과가 44/74 컷이었다.

여기서 결정적인 산술이 있다.

    76 컷 x 평균 110 f = 8399 f  ->  2.8 h
   131 컷 x 평균  64 f = 8399 f  ->  2.8 h      ★같다★

★총 프레임이 변하지 않으므로 렌더 시간이 전혀 늘지 않는다.★  리듬만 1.7배
빨라진다.  그래서 컷 분할은 「품질 개선」과 「비용 절감」을 동시에 내는
우리 파이프라인의 유일한 항목이다.


★무엇을 쪼개고 무엇을 쪼개지 않는가★
------------------------------------------------------------------
쪼갠다:   word_gesture == "none" 이고 4.0 s 를 넘는 컷
쪼개지 않는다:
  (a) 글자가 실린 컷 (word_gesture != "none")
      글자는 대본이 정한 한 문장을 한 컷 안에서 읽히게 해야 한다.
      쪼개면 [CEO-49] 어절 단위 / [CEO-57/58] 글자=이미지 수준을 깬다.
  (b) ★숏폼 C 4컷 (J_A3-13 / 14 / 15 / 17)★
      ★대표님이 이미 승인·납품한 산출물이다 (교훈 131: CEO 가 승인한 것을
      내 코드가 반려하면 틀린 것은 내 코드다).★  shorts916.py 의 CUTS 가
      이 job_id 를 직접 참조하므로 쪼개면 숏폼 빌드가 깨진다.
  (c) GAP 잡 (엔드 카드 / 전환 홀드는 리듬 대상이 아니다)


★어떻게 쪼개는가 — 「분할」이지 「새 컷 발명」이 아니다★
------------------------------------------------------------------
원 컷은 cam_start -> cam_end 로 이어지는 하나의 카메라 궤적이다.
그 궤적을 프레임 비율로 잘라, 각 조각이 궤적의 자기 구간만 담게 한다.

    원  컷:  cam(0.00) ------------------------------> cam(1.00)   228 f
    조각 1:  cam(0.00) ----> cam(0.33)                             76 f
    조각 2:              cam(0.33) ----> cam(0.67)                 76 f
    조각 3:                            cam(0.67) --> cam(1.00)     76 f

이렇게 하면
  * 연결이 끊기지 않는다 (조각 N 의 끝 = 조각 N+1 의 시작)
  * ★[CEO-51] 「컷 안에서 움직임 · 정지 없음」이 유지된다★
    각 조각이 궤적의 실제 구간을 담으므로 어느 조각도 정지 화면이 아니다
  * t0/t1 도 같은 비율 -> 나레이션·자막 동기가 그대로다
  * ★프레임 총합이 보존된다 (COVER GATE)★


★★★ 자체 게이트가 즉시 잡은 결함 — 카메라는 직선이 아니라 「원호」다 ★★★
------------------------------------------------------------------
1차 구현에서 cam_start/cam_end 를 ★직교좌표 선형 보간★ 으로 나눴다.
SPLIT GATE 가 즉시 87 건 ARC 불일치로 반려했다.

    FAIL  ARC J_A3-04_s1  -62.27 vs 85.50        <- 부호까지 반대다

원인: previz_batch.py line 645-658 이 카메라를 ★극좌표★ 로 돌린다.

    ang = a0 + arc * e          # 각도
    r   = ra + (rb - ra) * e    # 반경
    h   = z0 + (z1 - z0) * e    # 높이
    cam = (r*sin(ang), -r*cos(ang), h)

즉 카메라는 시선점을 중심으로 ★호를 그리며★ 돈다.  J_A3-04 는 170도를
도는 컷인데, 그 원호의 중간점을 직선으로 이으면 원 안쪽을 관통한다.
반경도 각도도 틀리고, 최단 signed 경로가 뒤집혀 부호까지 반대가 됐다.

게다가 e 는 u 가 아니다.  ★hold + ease★ 가 끼어 있다.

    u = (f-1)/(F-1)
    e = ease(max(0, (u - hold) / (1 - hold)))

hold 구간(앞 14~34%)에는 카메라가 ★정지★ 해 있고, 그 뒤 ease 곡선
(linear / smooth / ease_out / ease_in_out 4종) 으로 가속·감속한다.

⇒ 처방: previz_batch.py 의 EASE_FN 과 궤적 수식을 ★복제하지 않고 import★
   해서 조각 경계의 실제 (ang, r, h) 를 렌더러와 동일하게 계산한다
   (교훈 176: 상수를 복제하지 말고 일치시켜라).

그리고 hold 는 조각마다 다시 생각해야 한다.  원 컷의 hold 는 「컷 시작의
숨」이다.  조각 2, 3 은 컷 시작이 아니므로 hold 가 없다 (hold_frac=0).
조각 1 만 원래의 hold 를 가진다.  이렇게 해야 조각 2 에 없던 정지가
생기지 않는다 ([CEO-51] 정지 없음).

arc_deg 는 그 조각의 실제 각도 몫을 다시 계산해 넣는다 (비율 배분이
아니다 — ease 때문에 각도는 프레임에 비례하지 않는다).

조각 사이는 chain=True (연속) 로 둔다.  같은 궤적의 이어지는 구간이므로
「컷 전환」이 아니라 「호흡 분절」이다.  [CEO-67] 4 영화적 연속성.


사용법
------------------------------------------------------------------
  python3 cutsplit.py plan     쪼갤 계획만 출력한다 (파일 안 건드림)
  python3 cutsplit.py apply    scenejobs.json 을 분할본으로 교체한다
                               (원본은 scenejobs.presplit.json 으로 백업)
  python3 cutsplit.py revert   백업을 되돌린다
"""

import io
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
JOBS = os.path.join(HERE, "scenejobs.json")
BAK = os.path.join(HERE, "scenejobs.presplit.json")
FPS = 24

# script_gate.py G11 과 같은 값을 쓴다 (교훈 176: 상수를 복제하지 말고 일치시켜라)
CUT_LEN_MAX = 4.0
CUT_LEN_TARGET = 3.0
CUT_LEN_MIN = 0.5

# ★대표님 승인·납품 산출물 — 쪼개면 안 된다 (교훈 131)★
#   shorts916.py CUTS 가 이 job_id 를 직접 참조한다.
SHORTS_C_LOCK = ("J_A3-13", "J_A3-14", "J_A3-15", "J_A3-17")
EXEMPT_SUFFIX = ("GAP",)


def _lerp(a, b, t):
    return [round(a[i] + (b[i] - a[i]) * t, 4) for i in range(len(a))]


# ---------------------------------------------------------------------------
# ★렌더러의 궤적 수식을 「복제」하지 않고 「일치」시킨다 (교훈 176)★
# ---------------------------------------------------------------------------
#   previz_batch.py 는 bpy 를 import 하므로 여기서 통째로 import 할 수 없다
#   (샌드박스에서 bpy 로드는 수 초 + 메모리를 먹는다).  그래서 EASE_FN 정의
#   블록만 소스에서 읽어 exec 한다.  ★파일에서 직접 읽으므로 렌더러가
#   곡선을 바꾸면 여기도 자동으로 따라간다 — 값을 베껴 적지 않는다.★
def _load_ease_fn():
    src = io.open(os.path.join(HERE, "previz_batch.py"), encoding="utf-8").read()
    i = src.index("EASE_FN = {")
    j = src.index("}", i) + 1
    ns = {"math": math}
    exec(src[i:j], ns)
    fn = ns["EASE_FN"]
    if set(fn) < {"linear", "smooth", "ease_out", "ease_in_out"}:
        raise SystemExit("EASE_FN 을 읽지 못했다 — previz_batch.py 포맷 확인")
    return fn


EASE_FN = _load_ease_fn()


def _e_of_u(u, hold, ease_name):
    """previz_batch.py line 651-653 과 ★동일한★ 진행률.

        u = (f-1)/(F-1)                        프레임 정규 위치
        e = ease((u - hold) / (1 - hold))      hold 뒤부터 곡선이 돈다
    """
    return EASE_FN[ease_name](max(0.0, (u - hold) / max(1e-6, 1.0 - hold)))


def _cam_at(j, e):
    """진행률 e 에서의 카메라 위치 — previz_batch.py line 654-657 과 동일.

    ★극좌표★ 다.  직교 선형 보간은 원호 안쪽을 관통해 다른 컷이 된다.
    """
    a, b = j["cam_start_xyz"], j["cam_end_xyz"]
    ra = math.hypot(a[0], a[1])
    rb = math.hypot(b[0], b[1])
    a0 = math.atan2(a[0], -a[1])
    a1 = math.atan2(b[0], -b[1])
    arc = a1 - a0
    while arc > math.pi:
        arc -= 2 * math.pi
    while arc < -math.pi:
        arc += 2 * math.pi
    ang = a0 + arc * e
    r = ra + (rb - ra) * e
    h = a[2] + (b[2] - a[2]) * e
    return [round(r * math.sin(ang), 4), round(-r * math.cos(ang), 4), round(h, 4)]


def _arc_of(p):
    """한 잡의 실제 signed 원호 각도(도). scenejobs/previz 게이트와 동일 계산."""
    a, b = p["cam_start_xyz"], p["cam_end_xyz"]
    a0 = math.atan2(a[0], -a[1])
    a1 = math.atan2(b[0], -b[1])
    arc = a1 - a0
    while arc > math.pi:
        arc -= 2 * math.pi
    while arc < -math.pi:
        arc += 2 * math.pi
    return math.degrees(arc)


def why_skip(j):
    """이 컷을 쪼개지 않는 이유. 쪼개도 되면 None."""
    jid = j["job_id"]
    if jid in SHORTS_C_LOCK:
        return "숏폼C 승인본 (교훈 131)"
    if jid.endswith(EXEMPT_SUFFIX):
        return "GAP (리듬 면제)"
    if j.get("word_gesture", "none") != "none":
        return "글자 실린 컷 (CEO-49/57/58)"
    if j["frames"] / float(FPS) <= CUT_LEN_MAX:
        return "이미 %.2f s (상한 이내)" % (j["frames"] / float(FPS))
    return None


def nparts(frames):
    """목표 중앙값 3.0 s 에 가장 가깝게 나누는 조각 수.

    상한(4.0 s)을 넘지 않는 최소 조각 수부터 시작해서, 조각 길이가
    하한(0.5 s)을 밑돌지 않는 범위에서 3.0 s 에 가장 가까운 값을 고른다.
    """
    sec = frames / float(FPS)
    lo = int(math.ceil(sec / CUT_LEN_MAX))          # 이보다 적으면 상한 위반
    hi = max(lo, int(math.floor(sec / CUT_LEN_MIN)))  # 이보다 많으면 하한 위반
    best, bestd = lo, 1e9
    for n in range(lo, min(hi, lo + 4) + 1):
        d = abs(sec / n - CUT_LEN_TARGET)
        if d < bestd:
            best, bestd = n, d
    return best


def split_job(j, n):
    """한 잡을 n 조각으로. 프레임 총합과 궤적 연속성을 보존한다."""
    F = j["frames"]
    # 프레임을 균등 분배하고 나머지는 앞 조각들에 1 f 씩 얹는다 (총합 보존)
    base, rem = divmod(F, n)
    sizes = [base + (1 if i < rem else 0) for i in range(n)]
    assert sum(sizes) == F, (sum(sizes), F)

    t0, t1 = j["t0"], j["t1"]
    span = t1 - t0
    hold = j["hold_frac"]
    ease_name = j.get("ease") or "smooth"
    if ease_name not in EASE_FN:
        raise SystemExit("unknown ease %r on %s" % (ease_name, j["job_id"]))

    out = []
    acc = 0
    for i, sz in enumerate(sizes):
        # ★조각 경계의 진행률 e 를 렌더러와 동일하게 구한다 (hold + ease 포함)★
        u0 = acc / float(max(1, F - 1))
        u1 = (acc + sz - 1) / float(max(1, F - 1))
        e0 = _e_of_u(u0, hold, ease_name)
        e1 = _e_of_u(u1, hold, ease_name)
        acc += sz

        p = dict(j)                     # 나머지 41 키는 그대로 물려받는다
        p["job_id"] = "%s_s%d" % (j["job_id"], i + 1)
        p["frames"] = sz
        p["duration_s"] = round(sz / float(FPS), 4)
        # ★궤적: 극좌표 원호를 따라간다 (직교 선형은 원 안쪽을 관통한다)★
        p["cam_start_xyz"] = _cam_at(j, e0)
        p["cam_end_xyz"] = _cam_at(j, e1)
        # 시선점은 직교 선형이 맞다 (previz_batch line 662 도 선형이다)
        p["tgt_start_xyz"] = _lerp(j["tgt_start_xyz"], j["tgt_end_xyz"], e0)
        p["tgt_end_xyz"] = _lerp(j["tgt_start_xyz"], j["tgt_end_xyz"], e1)
        # ★hold 는 「컷 시작의 숨」이다. 조각 2 이후는 컷 시작이 아니다★
        #   조각 2 에 hold 를 남기면 원 컷에 없던 정지가 생긴다 ([CEO-51]).
        p["hold_frac"] = hold if i == 0 else 0.0
        p["hold_frames"] = int(round(sz * p["hold_frac"]))
        # ★ease: 조각 1 은 원 곡선의 도입부, 이후 조각은 이미 가속된 상태의
        #   등속 구간이므로 linear 로 이어 붙인다. 조각마다 다시 가·감속하면
        #   원 컷에 없던 펄스가 생긴다.★
        p["ease"] = ease_name if i == 0 else "linear"
        # arc_deg 는 그 조각의 ★실제★ 각도 몫 (비율 배분이 아니다 -- ease 때문)
        p["arc_deg"] = round(abs(_arc_of(p)), 4)
        # 나레이션·자막 동기: 시간축은 프레임 비율 그대로
        p["t0"] = round(t0 + span * (acc - sz) / float(F), 4)
        p["t1"] = round(t0 + span * acc / float(F), 4)
        # 첫 조각만 원래의 컷 전환을 가진다. 나머지는 「같은 궤적의 연속」이다
        p["cut"] = bool(j["cut"]) if i == 0 else False
        p["chain"] = True if i > 0 else bool(j["chain"])
        # sids 는 첫 조각이 대표한다 (COVER GATE 가 중복 sid 를 반려한다)
        p["sids"] = list(j["sids"]) if i == 0 else []
        p["split_of"] = j["job_id"]
        p["split_ix"] = [i + 1, n]
        out.append(p)
    return out


def plan(jobs):
    rows = []
    for j in jobs:
        w = why_skip(j)
        if w:
            rows.append((j, 1, w))
        else:
            rows.append((j, nparts(j["frames"]), ""))
    return rows


def _valid_jobs(jl):
    """정본 형태 검증 — 잡 리스트이고, 각 원소가 job_id/frames 를 가진 dict."""
    if not isinstance(jl, list) or not jl:
        return False
    for j in jl:
        if not isinstance(j, dict):
            return False
        if "job_id" not in j or "frames" not in j:
            return False
        if not isinstance(j["frames"], int) or j["frames"] < 1:
            return False
    return True


def _write_jobs(path, jl, label, skip_if_exists=False):
    """★검증 후에만★ 쓴다. 임시 파일에 쓰고 원자적으로 교체한다."""
    if skip_if_exists and os.path.exists(path):
        return
    if not _valid_jobs(jl):
        raise SystemExit("WRITE GATE FAILED  %s 에 쓰려는 값이 잡 리스트가 아니다 "
                         "(%s) — 정본을 보호했다 (실패 37)" % (path, type(jl).__name__))
    tmp = path + ".tmp"
    with io.open(tmp, "w", encoding="utf-8") as fh:
        json.dump({"jobs": jl}, fh, ensure_ascii=False, indent=1)
    os.replace(tmp, path)
    print("%s  %s  %d 컷" % (label, path, len(jl)))


def cmd_plan(apply_=False):
    with io.open(JOBS, encoding="utf-8") as fh:
        d = json.load(fh)
    jobs = d["jobs"] if isinstance(d, dict) else d
    if not _valid_jobs(jobs):
        raise SystemExit("scenejobs.json 이 정본 형태가 아니다 — "
                         "`python3 scenejobs.py` 로 재생성하라")
    rows = plan(jobs)

    tot_in = sum(j["frames"] for j in jobs)
    print("입력  %d 컷  %d f = %.3f s" % (len(jobs), tot_in, tot_in / float(FPS)))
    print()
    print("%-12s %5s %6s  ->  %-4s %6s   %s"
          % ("job", "f", "sec", "조각", "조각당", "사유"))
    out = []
    nsplit = 0
    for j, n, why in rows:
        sec = j["frames"] / float(FPS)
        if n == 1:
            out.append(j)
            if sec > CUT_LEN_MAX:
                print("%-12s %5d %6.2f  ->  %-4s %6s   ★면제★ %s"
                      % (j["job_id"], j["frames"], sec, "-", "-", why))
            continue
        nsplit += 1
        parts = split_job(j, n)
        out.extend(parts)
        print("%-12s %5d %6.2f  ->  %-4d %6.2f"
              % (j["job_id"], j["frames"], sec, n, sec / n))

    tot_out = sum(j["frames"] for j in out)
    secs = [j["frames"] / float(FPS) for j in out]
    ss = sorted(secs)
    med = ss[len(ss) // 2]
    over = [s for s in secs if s > CUT_LEN_MAX]
    under = [s for s in secs if s < CUT_LEN_MIN]

    print()
    print("─" * 68)
    print("분할한 컷      %d 개" % nsplit)
    print("출력           %d 컷  %d f = %.3f s" % (len(out), tot_out,
                                                  tot_out / float(FPS)))
    print("★프레임 총합   %d -> %d  (%s)★"
          % (tot_in, tot_out, "보존" if tot_in == tot_out else "★불일치★"))
    print("컷 길이        min %.2f  med %.2f  mean %.2f  max %.2f s"
          % (min(secs), med, sum(secs) / len(secs), max(secs)))
    print("               상한 %.1f s 초과 %d 컷 / 하한 %.1f s 미달 %d 컷"
          % (CUT_LEN_MAX, len(over), CUT_LEN_MIN, len(under)))
    print("★렌더 시간     프레임이 같으므로 변화 없음 (%.1f h @1.20 s/f)★"
          % (tot_out * 1.20 / 3600.0))

    # ---- 자체 게이트: 쓰기 전에 검증한다 (교훈 222 형태) -------------------
    fails = []
    if tot_in != tot_out:
        fails.append("FRAME SUM  %d != %d" % (tot_in, tot_out))
    ids = [j["job_id"] for j in out]
    if len(ids) != len(set(ids)):
        fails.append("DUP job_id")
    seen = set()
    for j in out:
        for s in j["sids"]:
            if s in seen:
                fails.append("DUP sid %s" % s)
            seen.add(s)
    for jid in SHORTS_C_LOCK:
        if jid not in ids:
            fails.append("숏폼C 승인본 %s 이 사라졌다 (교훈 131)" % jid)
    for j in out:
        if j["frames"] < 1:
            fails.append("ZERO frames %s" % j["job_id"])
    # ARC 일치 (scenejobs.py 게이트 (a) / previz_batch 게이트와 같은 계산)
    for j in out:
        if abs(abs(_arc_of(j)) - abs(j["arc_deg"])) > 1.0:
            fails.append("ARC %s  %.2f vs %.2f"
                         % (j["job_id"], _arc_of(j), j["arc_deg"]))
    # ★HEIGHT: 카메라가 책상 아래로 내려가면 밑면을 찍는다 (scenejobs 게이트 c)★
    for j in out:
        if min(j["cam_start_xyz"][2], j["cam_end_xyz"][2]) < 0.812:
            fails.append("HEIGHT %s  z %.3f/%.3f" % (j["job_id"],
                         j["cam_start_xyz"][2], j["cam_end_xyz"][2]))
    # ★반경: 원 컷의 반경 대역 밖으로 나가면 다른 컷이다★
    for j in out:
        if j.get("split_of") is None:
            continue
        r = [math.hypot(*j["cam_start_xyz"][:2]), math.hypot(*j["cam_end_xyz"][:2])]
        src = [x for x in jobs if x["job_id"] == j["split_of"]][0]
        lo = min(math.hypot(*src["cam_start_xyz"][:2]),
                 math.hypot(*src["cam_end_xyz"][:2])) - 0.02
        hi = max(math.hypot(*src["cam_start_xyz"][:2]),
                 math.hypot(*src["cam_end_xyz"][:2])) + 0.02
        if min(r) < lo or max(r) > hi:
            fails.append("RADIUS %s  %.3f-%.3f 밖 [%.3f,%.3f]"
                         % (j["job_id"], min(r), max(r), lo, hi))
    # ★연속성 (SEAM): 조각 N 의 끝과 조각 N+1 의 시작은 원 컷에서 ★인접한
    #   두 프레임★ 이다. 따라서 「같은 좌표」가 아니라 「1프레임 이동량 이내」
    #   여야 맞다.
    #
    #   1차 구현에서 임계를 0.03 m 고정으로 놓고 30 건 FAIL 을 받았다. 그건
    #   결함이 아니라 ★내가 물리량을 틀린 것★ 이었다: J_A3-04 는 169 f 동안
    #   170도를 도는 컷이라 프레임당 1도 이상 돌고, hold 0.24 + smooth ease
    #   때문에 중간 구간은 그 2.5배까지 빨라진다 -> 프레임당 0.09 m 가 정상이다.
    #   (교훈 220 의 형태: 내가 코드에 써넣은 값이 납품을 막을 수는 없다.
    #    단 여기서는 값을 늘리는 게 아니라 ★맞는 물리량으로 바꾼다★.)
    #
    #   그래서 원 컷의 실측 프레임간 최대 이동량을 임계로 쓴다. 이 임계를
    #   넘으면 그건 정말 궤적 밖으로 튄 순간이동이다.
    for i in range(len(out) - 1):
        a, b = out[i], out[i + 1]
        so = a.get("split_of")
        if not so or so != b.get("split_of"):
            continue
        src = [x for x in jobs if x["job_id"] == so][0]
        F = src["frames"]
        hold = src["hold_frac"]
        en = src.get("ease") or "smooth"
        step = 0.0
        prev = None
        for f in range(1, F + 1):
            u = (f - 1) / float(max(1, F - 1))
            cur = _cam_at(src, _e_of_u(u, hold, en))
            if prev is not None:
                step = max(step, math.dist(prev, cur))
            prev = cur
        lim = max(0.005, step * 1.25)
        # ★실패 37 — 여기서 변수명을 d 로 썼더니 line 294 의 `d = json.load(JOBS)`
        #   를 덮어썼다. 그 뒤 json.dump(d, ...) 가 ★float 을 정본에 써서★
        #   scenejobs.json 을 19 바이트로 파괴했다. 이름을 gap 으로 분리한다.
        gap = math.dist(a["cam_end_xyz"], b["cam_start_xyz"])
        if gap > lim:
            fails.append("SEAM %s -> %s  틈 %.3f m > 1프레임 이동량 %.3f m"
                         % (a["job_id"], b["job_id"], gap, lim))
    print()
    if fails:
        for f in fails[:12]:
            print("  FAIL  %s" % f)
        print("SPLIT FAILED  %d 건" % len(fails))
        return 1
    print("★SPLIT GATE OK  프레임 보존 · sid 중복 0 · 숏폼C 보존 · ARC 일치★")

    if apply_:
        # ★쓰기 전에 검증한다 (실패 37) — 정본 파일에 쓰는 함수는
        #   「읽기 -> 검증 -> 쓰기」 순서를 지킨다. 검증 없이 먼저 쓰면
        #   그 다음 줄에서 예외가 나도 파일은 이미 망가져 있다.★
        _write_jobs(BAK, jobs, "· 원본 백업 ->", skip_if_exists=True)
        _write_jobs(JOBS, out, "★APPLIED")
    else:
        print("(plan 모드 — 파일은 건드리지 않았다.  apply 로 반영한다)")
    return 0


def cmd_revert():
    if not os.path.exists(BAK):
        print("백업이 없다: %s" % BAK)
        print("  scenejobs.json 은 `python3 scenejobs.py` 로 결정적으로 재생성된다.")
        return 1
    with io.open(BAK, encoding="utf-8") as fh:
        b = json.load(fh)
    jl = b["jobs"] if isinstance(b, dict) else b
    if not _valid_jobs(jl):                 # ★검증이 통과해야 비로소 쓴다★
        print("백업이 손상되었다: %s" % BAK)
        print("  scenejobs.json 은 `python3 scenejobs.py` 로 결정적으로 재생성된다.")
        return 1
    _write_jobs(JOBS, jl, "REVERTED")
    return 0


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "plan"
    if cmd == "plan":
        sys.exit(cmd_plan(False))
    if cmd == "apply":
        sys.exit(cmd_plan(True))
    if cmd == "revert":
        sys.exit(cmd_revert())
    print(__doc__)
    sys.exit(2)
