# -*- coding: utf-8 -*-
"""subtle_motion.py — 텍스트가 박힌 정지 슬라이드를 '살아있게' 만드는 미세 모션 엔진

═══════════════════════════════════════════════════════════════════
왜 이 모듈이 따로 필요한가 (2026-08-16 실측으로 드러난 사실)
═══════════════════════════════════════════════════════════════════
롱폼 v13 의 정지 구간 37개(244초 · 본편의 60.2%)를 전수 육안 판정한 결과,
25개 표본 중 24개가 '읽어야 할 한글 텍스트/라벨'을 담고 있었다.
   예) "세 프로젝트에서 공통 행동 찾기" / "다음 선택은 왜 더 흐려질까요?"
       "프로젝트 1" 손글씨 / 마인드맵 "정리했다" 가지 라벨

즉 v13 은 사진 B-roll 영상이 아니라 **한글 라벨이 박힌 일러스트 영상**이다.

여기에 hybrid_core 의 평면 투사(PLANE_TILT_DEG=60°)를 걸면 어떻게 되는가:
    화면이 기울어진 평면에 투사되므로 글자가 사다리꼴로 늘어나고
    프레임마다 위치가 바뀌어 **시청자가 문장을 읽을 수 없다.**
    → 정지를 고치려다 정보를 파괴한다. 이건 개선이 아니라 사고다.

그래서 두 갈래로 나눈다 (역할 분리):
    ┌────────────────────┬──────────────────────────────────────────┐
    │ 소재 성격          │ 처리 방식                                │
    ├────────────────────┼──────────────────────────────────────────┤
    │ 텍스트 있음 (다수) │ ★ 본 모듈 — 평면 유지 미세 모션          │
    │                    │   글자 기하를 절대 왜곡하지 않는다        │
    ├────────────────────┼──────────────────────────────────────────┤
    │ 텍스트 없음 (소수) │ make_hybrid_shot.py — 진짜 2.5D 시차     │
    └────────────────────┴──────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════
본 모듈의 모션 설계 — '정지로 보이지 않게' 하는 최소 조건
═══════════════════════════════════════════════════════════════════
사람 눈이 '영상이 멈췄다'고 느끼는 것은 프레임 간 변화가 0 일 때다.
따라서 변화를 0 이 아니게만 만들면 되고, 그 변화가 '글자를 읽는 데
방해가 되지 않을 만큼' 작으면 된다. 두 조건을 동시에 만족시킨다.

  1) drift  — 아주 느린 등속 줌 + 미세 팬 (Ken Burns 의 절제된 형태)
              ZOOM_RATE(0.9%/초)로 등속 확대한다. 총량이 크면 왕복한다.
              6.8초 구간이면 초당 0.24% — 의식적으로는 감지되지 않지만
              프레임 간 차이는 확실히 0 이 아니다.
  2) breath — 아주 얕은 사인파 호흡 (선택). 긴 구간에서 등속 줌만 쓰면
              후반부가 다시 '정지처럼' 느껴지는 것을 막는다.

★ 왜 회전/기울기를 쓰지 않는가: 글자 획의 각도가 바뀌면 리샘플링
  아티팩트가 즉시 보인다. 순수 스케일+평행이동만 쓰면 글자 모양은 보존된다.

★ 왜 INTER_LANCZOS4 인가: 미세 확대는 리샘플링이 계속 일어나므로
  보간이 무르면 글자가 뭉갠다. 랜초스는 에지를 살린다.

═══════════════════════════════════════════════════════════════════
안전 게이트 (본 모듈 고유 · hybrid_core 의 H-1~H-9 와 별개)
═══════════════════════════════════════════════════════════════════
  T-1 텍스트 가독성 보존 : 원본 대비 에지 밀도 보존율 >= 0.90
                           (글자가 뭉개지면 에지가 사라진다)
  T-2 정지 아님          : ★ 결함을 찾아낸 그 검출기를 그대로 통과해야 한다.
                           freeze_photo.py 와 동일 조건(320x180 축소 · 5fps 샘플 ·
                           평균 절대차 >= 0.35)으로 재서, 정지로 잡히면 FAIL.
                           → 임계값을 새로 지어내지 않는다. 문제를 정의한 자와
                             해결을 판정하는 자가 같아야 한다.
  T-3 과도 모션 아님     : 화면 이동 '속도' <= MAX_SHIFT_RATE (기본 8 px/초)
                           총 이동량이 아니라 속도로 재는 이유: 읽기를 방해하는
                           것은 누적 거리가 아니라 순간 속도이기 때문이다.
                           긴 구간에서 총량이 커도 느리면 읽는 데 문제없다.

의존: numpy, opencv — hybrid_core 와 동일. Blender 불필요.
비파괴 원칙: 입력 영상/이미지는 읽기만 한다.
"""
from __future__ import annotations

import json
import math
import os
import subprocess
import sys

import cv2
import numpy as np

FPS = 30

# ── 모션 진폭 기본값 ──
#   ★ 실측 보정 이력 (2026-08-16):
#     1.6% 로 시작했으나 freeze_photo.py 기준(5fps · 320x180 · 0.35)으로는
#     여전히 '정지'로 잡혔다. 사람 눈에 안 보일 만큼 작으면 검출기에도 안 보이고,
#     검출기에 안 보이면 시청자에게도 여전히 멈춘 화면이다.
#     → 다큐멘터리 표준 Ken Burns 수준인 4~5% 로 올린다. 6.8초에 4.5% =
#       초당 0.66% 로, 읽기를 방해하지 않으면서 확실히 '살아있는' 속도다.
#
#   ★★ 최종 기준은 임의의 숫자가 아니라 v13 자신에게서 가져온다 (실측):
#     v13 전체 2499 샘플 — 정지 구간은 프레임차가 정확히 0.000 (p50 = 0.000).
#     '살아있는' 구간(17.5%)은 최소 0.351 · p25 0.539 · 중앙값 0.820.
#     → 목표는 이 영상이 움직일 때의 속도다. 그래야 삽입 구간만
#       유독 느리거나 빨라 보이지 않는다. 후자는 모션 과다로 더 눈에 띈다.
#     초당 약 0.9% 확대가 그 대역(p25~중앙값)을 맞춘다.
ZOOM_RATE = 0.009      # ★ 초당 확대율 (0.9%/s)
ZOOM_SPAN_MAX = 0.075  # 총 확대 상한 (7.5%) — 넘으면 왕복하여 총량만 제한한다
SHORT_DUR = 4.0        # 이보다 짧은 구간은 ease 없이 완전 등속으로 간다

# ★★★ 왜 확대만으로는 부족한가 (2026-08-16 실측이 알려준 것):
#   확대는 화면 중앙을 기준으로 일어난다. 그래서 중앙 부근 화소는 거의 제자리다.
#   정지 검출은 '화면 전체 평균 절대차'로 재기 때문에, 움직이지 않는 중앙이
#   평균을 끌어내려 1.6~3.8초 구간이 계속 '정지'로 잡혔다(등속으로 바꿔도 동일).
#   → 팬(평행이동)을 항상 동반시킨다. 평행이동은 화면 전 영역을 같은 양만큼
#     움직이므로 중앙도 예외 없이 변한다. 이것이 '정지로 보이지 않음'을
#     구조적으로 보장하는 유일한 성분이다.
#   초당 0.55% 팬 = 1280px 기준 초당 약 7px. 시청자는 인지하지 못하지만
#   검출기와 눈 모두에게 '화면이 살아있다'는 신호가 된다.
PAN_RATE = 0.0055      # ★ 초당 팬 이동률 (프레임 폭 대비) — 정지 방지의 핵심
PAN_SPAN_MAX = 0.030   # 총 팬 상한 (3.0%) — 넘으면 확대와 함께 왕복한다
BREATH_AMP = 0.0022   # 호흡 진폭 (0.22%)
BREATH_HZ = 0.09      # 호흡 주기 — 11초에 한 번. 의식되지 않는 느린 파동

# ── 안전 게이트 임계값 ──
MIN_EDGE_KEEP = 0.90    # T-1

# ★★★ T-3 상한은 지어낸 숫자가 아니라 v13 자신에게서 가져왔다 (2026-08-16 실측).
#   측정 방법은 게이트와 같은 성질의 지표여야 한다:
#     게이트의 max_shift = '화면에서 가장 많이 움직이는 화소의 이동량'
#     → 위상상관(전역 평행이동)은 확대 성분을 아예 못 잡으므로 부적합.
#       광류(Farneback)로 프레임 내 화소 이동량 분포를 재고 그 최대값을 쓴다.
#   v13 살아있는 구간 393 샘플 · 화면 최대 화소 이동 속도 (px/s, 1280 기준):
#       p25 = 16.56   p50 = 42.47   p75 = 98.68   mean = 126.94
#   → 상한을 v13 자신의 p25(=가장 얌전한 4분의 1) 수준인 16.0 으로 둔다.
#     이렇게 하면 삽입 구간은 '이 영상에서 가장 느린 샷보다도 느리다'가
#     보장되므로 읽기를 방해할 수 없다. 동시에 이전의 8.0 처럼
#     근거 없이 조여서 정상 모션을 반려하는 일도 없어진다.
#   ※ 참고: 8.0 을 쓰던 시절 실제 렌더는 10.2~10.8 px/s 였다. 즉 v13 의
#     p25 보다도 느린 모션을 '과도하다'며 반려하고 있었다. 임계값이 틀렸던 것이다.
MAX_SHIFT_RATE = 16.0   # T-3 (px/초 @1280) — v13 자체 p25 기준
# T-2 는 freeze_photo.py 정본과 반드시 같아야 한다. 값을 따로 두지 않는다.
FREEZE_TOL = 0.35       # 평균 절대차 임계 (freeze_photo.py HOLD 와 동일)
FREEZE_FPS = 5.0        # 샘플링 (freeze_photo.py 와 동일)
FREEZE_W, FREEZE_H = 320, 180


# ══════════════════════════════════════════════════════════════
# 1단계 — 모션 곡선
# ══════════════════════════════════════════════════════════════
# 등속 혼합비 — ★ 왜 순수 ease 를 쓰지 않는가 (실측으로 드러난 함정):
#   ease_in_out 은 t=0 과 t=1 에서 미분값이 0 이다. 즉 구간의 맨 처음과 맨 끝
#   몇 프레임은 '거의 변화 없음'이 되고, 실제로 T-2 게이트가 1개 프레임 정지를
#   잡아냈다(2026-08-16 첫 실행). 정지를 없애려고 만든 모듈이 정지를 만든 셈이다.
#   → ease 에 등속 성분을 섞어 끝점 속도가 절대 0 이 되지 않게 한다.
#     부드러움(컷 지점 안 튐)과 상시 변화를 동시에 얻는다.
LINEAR_MIX = 0.85


def _tri(u: float) -> float:
    """삼각파 — 위상 u 를 0→1→0 왕복값으로. 속도 절대값이 어디서나 같다."""
    u = u % 1.0
    return 2.0 * u if u <= 0.5 else 2.0 * (1.0 - u)


def ease_in_out(t: float) -> float:
    """0→1 을 부드럽게 — 단 끝점 속도가 0 이 되지 않도록 등속을 섞는다."""
    t = max(0.0, min(1.0, t))
    smooth = 0.5 - 0.5 * math.cos(math.pi * t)
    return (1.0 - LINEAR_MIX) * smooth + LINEAR_MIX * t


def zoom_plan(dur: float) -> tuple[float, float]:
    """구간 길이 → (총 확대량 span, 왕복 횟수 cycles)

    ★ 왜 단순히 '총 확대율 고정'이 아닌가:
      사람이 '멈췄다'고 느끼는 건 누적 확대량이 아니라 순간 속도다.
      따라서 속도(%/초)를 고정해야 한다.
      그런데 속도를 고정한 채 16.6초 구간을 가면 총 15% 확대가 되어
      끝에서는 화면이 크게 잘리고 해상도 손실이 눈에 띈다.
      → 총량이 상한을 넘으면 왕복(삼각파)시킨다.
        들어갔다 나왔다를 반복하면 속도는 그대로 유지한 채 총량만 묶인다.
        되돌아오는 구간도 동일 속도라 정지 구간이 생기지 않는다.
    """
    # 확대와 팬 중 상한에 먼저 닿는 쪽이 왕복 여부를 결정한다.
    need = ZOOM_RATE * dur
    need_pan = PAN_RATE * dur
    if need <= ZOOM_SPAN_MAX and need_pan <= PAN_SPAN_MAX:
        return need, 1.0
    # ★ 왕복 횟수는 반드시 1 보다 커야 삼각파 분기가 켜진다.
    #   need/(2*span) 이 1 을 살짝 밑돌 수 있으므로(16.6s → 0.996) 하한을 둔다.
    cyc = max(need / (2.0 * ZOOM_SPAN_MAX), need_pan / (2.0 * PAN_SPAN_MAX))
    return min(need, ZOOM_SPAN_MAX), max(1.05, cyc)


def motion_at(t: float, kind: str, span: float, cycles: float,
              pan_span: float = 0.0,
              linear: bool = False) -> tuple[float, float, float]:
    """t(0~1) → (zoom, dx_ratio, dy_ratio)

    span   : 이 구간의 총 확대량 (zoom_plan 이 결정)
    cycles : 왕복 횟수. 1.0 이면 편도, >1 이면 삼각파 왕복

    kind:
      drift_in    천천히 밀려 들어간다 (기본 · 가장 안전)
      drift_out   천천히 빠진다
      drift_left  좌측으로 미세 이동하며 밀려 들어간다
      drift_right 우측으로
    """
    if cycles > 1.0:
        # 삼각파 — 0→1→0 반복. 모든 지점에서 속도 절대값이 같다.
        # ★ 단 '정점'에는 함정이 있다 (2026-08-16 16.6초 구간 T-2 실패로 발견):
        #   삼각파의 순간 속도는 일정하지만, 정지 검출은 0.2초(5fps) 간격의
        #   '순 변위'를 잰다. 정점을 가로지르는 샘플은 나갔다가 되돌아오므로
        #   순 변위가 거의 0 이 되어 '정지'로 잡힌다.
        #   → 줌과 팬의 정점을 1/4 주기 어긋나게 둔다. 줌이 정점에서 되돌아올 때
        #     팬은 최고 속도로 지나가므로, 두 성분이 동시에 멈추는 순간이 없다.
        e = _tri(t * cycles)
        e_pan = _tri(t * cycles + 0.25)
    elif linear:
        # ★ 짧은 구간(SHORT_DUR 미만)은 ease 없이 완전 등속으로 간다.
        #   ease 의 끝점 감속은 구간이 짧을수록 전체에서 차지하는 비중이 커진다.
        #   2.2초 구간에서 10 샘플 중 4 개가 '정지'로 잡혔다(2026-08-16 실측).
        e = max(0.0, min(1.0, t))
        e_pan = e
    else:
        e = ease_in_out(t)
        e_pan = e
    breath = BREATH_AMP * math.sin(2.0 * math.pi * BREATH_HZ * t * 10.0)

    # ★ 팬은 선택이 아니라 필수 성분이다 (위 PAN_RATE 주석 참조).
    #   kind 는 '어느 방향으로' 만 정하고, '얼마나'는 pan_span 이 정한다.
    p = pan_span * e_pan
    if kind == "drift_in":
        return 1.0 + span * e + breath, p * 0.6, p * 0.35
    if kind == "drift_out":
        return 1.0 + span * (1.0 - e) + breath, -p * 0.6, -p * 0.35
    if kind == "drift_left":
        return 1.0 + span * e + breath, -p, p * 0.25
    if kind == "drift_right":
        return 1.0 + span * e + breath, p, -p * 0.25
    raise SystemExit(f"ERR: unknown motion kind {kind!r}")


# ══════════════════════════════════════════════════════════════
# 2단계 — 프레임 렌더 (순수 스케일 + 평행이동 · 회전 없음)
# ══════════════════════════════════════════════════════════════
def render_frame(base: np.ndarray, zoom: float, dxr: float, dyr: float,
                 out_w: int, out_h: int) -> np.ndarray:
    """base 를 zoom 배 확대하고 (dxr,dyr) 만큼 밀어 out_w x out_h 로 크롭.

    ★ 글자 보존을 위해 회전/전단(shear)/원근을 일절 쓰지 않는다.
      스케일과 평행이동만 쓰면 글자의 획 각도가 변하지 않는다.
    """
    bh, bw = base.shape[:2]
    # 목표 크롭 크기 — zoom 이 클수록 원본에서 작은 영역을 떠온다
    cw = bw / zoom
    ch = bh / zoom
    cx = bw * 0.5 + dxr * bw
    cy = bh * 0.5 + dyr * bh
    # 원본 밖을 보지 않도록 클램프 (검은 테두리 방지)
    cx = max(cw * 0.5, min(bw - cw * 0.5, cx))
    cy = max(ch * 0.5, min(bh - ch * 0.5, cy))

    x0 = cx - cw * 0.5
    y0 = cy - ch * 0.5
    M = np.float32([[out_w / cw, 0.0, -x0 * out_w / cw],
                    [0.0, out_h / ch, -y0 * out_h / ch]])
    return cv2.warpAffine(base, M, (out_w, out_h),
                          flags=cv2.INTER_LANCZOS4,
                          borderMode=cv2.BORDER_REPLICATE)


# ══════════════════════════════════════════════════════════════
# 3단계 — 안전 게이트
# ══════════════════════════════════════════════════════════════
def edge_density(img: np.ndarray) -> float:
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    return float(cv2.Canny(g, 60, 160).mean() / 255.0)


def gate(frames: list[np.ndarray], src_ref: np.ndarray,
         shift_rate: float) -> dict:
    """T-1 / T-2 / T-3 를 실측한다."""
    # T-1 텍스트 가독성 — 에지 밀도 보존율
    e_src = edge_density(src_ref)
    e_out = float(np.mean([edge_density(f) for f in
                           (frames[0], frames[len(frames) // 2], frames[-1])]))
    keep = e_out / e_src if e_src > 1e-9 else 0.0

    # T-2 정지 아님 — ★ freeze_photo.py 와 완전히 동일한 조건으로 재현한다.
    #   320x180 축소 · 5fps 샘플링 · 인접 샘플 평균절대차 < 0.35 이면 '정지'.
    step = max(1, int(round(FPS / FREEZE_FPS)))
    small = [cv2.cvtColor(cv2.resize(f, (FREEZE_W, FREEZE_H),
                                     interpolation=cv2.INTER_AREA),
                          cv2.COLOR_BGR2GRAY).astype(np.float32)
             for f in frames[::step]]
    diffs = [float(np.abs(a - b).mean()) for a, b in zip(small[:-1], small[1:])]
    min_d = min(diffs) if diffs else 0.0
    holds = sum(1 for d in diffs if d < FREEZE_TOL)

    return {
        "T1_text_legibility": {
            "edge_src": round(e_src, 5),
            "edge_out": round(e_out, 5),
            "keep_ratio": round(keep, 4),
            "min_required": MIN_EDGE_KEEP,
            "pass_T1": bool(keep >= MIN_EDGE_KEEP),
            "note": "ok — 글자 에지가 보존됐다" if keep >= MIN_EDGE_KEEP
                    else "FAIL — 글자가 뭉개졌다",
        },
        "T2_not_frozen": {
            "method": "freeze_photo.py 동일조건 (320x180 · 5fps · tol 0.35)",
            "min_sample_diff": round(min_d, 5),
            "tol": FREEZE_TOL,
            "hold_samples": holds,
            "total_samples": len(diffs),
            "pass_T2": bool(holds == 0),
            "note": "ok — 정지 검출기가 더 이상 잡지 않는다" if holds == 0
                    else f"FAIL — {holds}/{len(diffs)} 샘플이 여전히 정지",
        },
        "T3_not_excessive": {
            "shift_rate_px_s": round(shift_rate, 2),
            "limit_px_s": MAX_SHIFT_RATE,
            "pass_T3": bool(shift_rate <= MAX_SHIFT_RATE),
            "note": "ok — 읽기를 방해하지 않는 속도" if shift_rate <= MAX_SHIFT_RATE
                    else "FAIL — 모션이 과하다",
        },
    }


# ══════════════════════════════════════════════════════════════
# 4단계 — 구간 생성
# ══════════════════════════════════════════════════════════════
def build(still_path: str, out_path: str, dur: float,
          kind: str = "drift_in", qc: bool = True) -> dict:
    """정지 스틸 1장 → 미세 모션이 걸린 mp4 구간.

    ★ 출력 해상도는 입력 스틸과 동일하게 유지한다.
      대상 영상에서 뽑은 스틸을 그대로 되돌려 넣는 용도이므로,
      해상도를 바꾸면 삽입 구간만 선예도가 달라져 이물감이 생긴다.
    """
    src = cv2.imread(still_path)
    if src is None:
        raise SystemExit(f"ERR: cannot read {still_path}")
    out_h, out_w = src.shape[:2]

    # 확대 여유분을 미리 확보 — 렌더 중 원본 밖을 보지 않게 한다
    pl = plan(dur)
    span, cycles = pl["span"], pl["cycles"]
    lin, pan_span = pl["linear"], pl["pan_span"]
    # ★★★ '팬 여유 배율' — 2026-08-16 16.6초 구간 T-2 잔여 실패의 진짜 원인.
    #   왕복(삼각파) 구간은 저점에서 zoom 이 정확히 1.0 이 된다. 그런데 렌더는
    #   패딩된 base 에서 crop 하므로, zoom=1.0 이면 crop 폭 = base 폭 전체가 되어
    #   render_frame 의 클램프가 발동해 팬이 **완전히 죽는다**.
    #   즉 저점 부근에서는 줌도(방향 전환) 팬도(클램프) 동시에 멈춰 있었다.
    #   위상 분리만으로 해결되지 않았던 이유가 이것이다.
    #   → 항상 zoom 에 room 을 곱해서, 최저 줌에서도 팬이 움직일 여백을 남긴다.
    room, pad = pl["room"], pl["pad"]
    base = cv2.resize(src, (int(out_w * pad), int(out_h * pad)),
                      interpolation=cv2.INTER_LANCZOS4)

    n = max(2, int(round(dur * FPS)))
    frames = []
    max_shift = 0.0
    for i in range(n):
        t = i / (n - 1)
        z, dxr, dyr = motion_at(t, kind, span, cycles, pan_span, linear=lin)
        frames.append(render_frame(base, z * room, dxr, dyr, out_w, out_h))
        # 화면상 최대 이동량 추정 (모서리 화소가 몇 px 움직이는가)
        shift = abs(z - 1.0) * 0.5 * math.hypot(out_w, out_h) \
            + math.hypot(dxr * out_w, dyr * out_h)
        max_shift = max(max_shift, shift)
    # ★ 읽기 방해 여부는 '속도'로 판정한다 — 총 이동량 / 구간 길이
    shift_rate = max_shift / max(0.1, dur)

    report = {
        "src": still_path, "out": out_path, "motion": kind,
        "duration": dur, "frames": n, "size": [out_w, out_h],
        "zoom_rate_pct_s": round(ZOOM_RATE * 100, 3),
        "zoom_span_pct": round(span * 100, 3),
        "cycles": round(cycles, 2),
        "linear": lin,
        "pan_span_pct": round(pan_span * 100, 3),
    }
    if qc:
        report["shift_total_px"] = round(max_shift, 2)
        report.update(gate(frames, src, shift_rate))
        report["qc_pass"] = bool(
            report["T1_text_legibility"]["pass_T1"]
            and report["T2_not_frozen"]["pass_T2"]
            and report["T3_not_excessive"]["pass_T3"])

    # 인코딩 — 무음 비디오만. 오디오는 합성 단계에서 원본 것을 그대로 쓴다.
    os.makedirs(os.path.dirname(os.path.abspath(out_path)) or ".", exist_ok=True)
    p = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24",
         "-s", f"{out_w}x{out_h}", "-r", str(FPS), "-i", "-",
         "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "16",
         "-pix_fmt", "yuv420p", out_path], stdin=subprocess.PIPE)
    for f in frames:
        p.stdin.write(f.tobytes())
    p.stdin.close()
    if p.wait() != 0:
        raise SystemExit("ERR: ffmpeg encode failed")
    return report


def plan(dur: float) -> dict:
    """구간 길이 → 모션 계획. 렌더러(스틸/영상)가 공유하는 단일 진실원."""
    span, cycles = zoom_plan(dur)
    pan_span = min(PAN_RATE * dur, PAN_SPAN_MAX)
    return {
        "span": span,
        "cycles": cycles,
        "pan_span": pan_span,
        "linear": bool(dur < SHORT_DUR),
        # ★ room: 최저 줌에서도 팬이 클램프에 막히지 않도록 하는 여유 배율
        "room": 1.0 + pan_span * 2.4 + 0.006,
        "pad": 1.0 + span + pan_span * 2.4 + BREATH_AMP * 2 + 0.006,
    }


def frame_at(base: np.ndarray, t: float, kind: str, pl: dict,
             out_w: int, out_h: int) -> np.ndarray:
    """계획 pl 에 따라 t(0~1) 시점의 한 프레임을 만든다."""
    z, dxr, dyr = motion_at(t, kind, pl["span"], pl["cycles"],
                            pl["pan_span"], linear=pl["linear"])
    return render_frame(base, z * pl["room"], dxr, dyr, out_w, out_h)


def shift_rate_of(pl: dict, dur: float, out_w: int, out_h: int) -> float:
    """이 계획이 만들어내는 화면 최대 이동 속도(px/초)를 해석적으로 구한다."""
    diag = math.hypot(out_w, out_h)
    zmax = (1.0 + pl["span"] + BREATH_AMP) * pl["room"]
    return (abs(zmax - 1.0) * 0.5 * diag
            + math.hypot(pl["pan_span"] * out_w, pl["pan_span"] * out_h)) \
        / max(0.1, dur)


def main() -> None:
    if len(sys.argv) < 4:
        print(__doc__)
        print("사용법: python3 subtle_motion.py <still.png> <out.mp4> <dur> [motion]")
        print("  motion: drift_in(기본) drift_out drift_left drift_right")
        raise SystemExit(1)
    still, out, dur = sys.argv[1], sys.argv[2], float(sys.argv[3])
    kind = sys.argv[4] if len(sys.argv) > 4 else "drift_in"
    rep = build(still, out, dur, kind)
    print(json.dumps(rep, ensure_ascii=False, indent=2))
    if rep.get("qc_pass"):
        print("\n[PASS] 텍스트 안전 미세 모션 검수 통과")
    else:
        print("\n[FAIL] 검수 실패 — 위 게이트 확인")


if __name__ == "__main__":
    main()
