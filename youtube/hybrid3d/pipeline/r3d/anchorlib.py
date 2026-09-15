#!/usr/bin/env python3
"""anchorlib.py -- [CEO-83] 앵커 5축 재계측 공용 산식.

이 모듈의 지위
--------------
`76_BENCHMARK_STUDY.md` §7 은 「조건 카드 한 장」이 관객 앵커로 적합한지를
5개 축으로 검증한 기록이다.  그 도구 3종(`visib.py` / `needsize.py` /
`altsweep.py`)은 `/tmp/anchor/` 에 있었고 ★샌드박스 재시작으로 소실됐다★.

  ⇒ [CEO-73] *"재생산이 가능하도록 늘 일을 구축해야 해요."*
     ⇒ 도구는 `/tmp` 가 아니라 이 디렉터리(`/home/user/lf/r3d/`)에 둔다.

★교훈 176 (상수·수식을 복제하지 말고 참조하라)★
  임계값(SUBJ_FRAC_MIN)·센서(SENSOR_MM)·해상도(RES_W/RES_H)·앵커 이름
  (ANCHOR_NAME)·투영 산식은 ★전부 script_gate 에서 import 한다★.
  여기서 숫자를 다시 적으면, 게이트를 고칠 때 이 도구가 조용히 낡는다.

★교훈 229 (파생 데이터를 읽는 곳을 먼저 세어라)★
  소품 조회는 `props_sid` -> `sids[0]` -> `job_id` 폴백 순서를 쓴다.
  분할 조각(`_s2` 등)은 `sids=[]` 이므로 `job_id` 폴백이 PROPS 를 놓친다.
  ★이 모듈을 쓰는 도구는 반드시 `props_of()` 를 경유할 것.★

색 산식의 근거 (§7.1 표를 역검증해 확정)
----------------------------------------
  · sets.py 의 색 상수는 Blender base-color 로 쓰이지만, §7.1 표는 그 값을
    ★sRGB 값으로 보고 linearize 한 뒤★ 휘도를 계산했다.  역검증:
      DOC_A (0.760,0.145,0.520) -> 휘도 0.1445  (표 0.144  ✅)
      DOC_N (0.560,0.560,0.545) -> 휘도 0.2738  (표 0.273  ✅)
      DOC_A 채도 (0.76-0.145)/0.76 = 0.809      (표 0.81   ✅)
  · 그러므로 `luma()` / `sat()` / `contrast()` 는 §7 과 ★같은 축★ 을 잰다.
    (표 값을 그대로 재현할 수 있으므로 재계측 결과를 §7 과 직접 비교 가능)

투영 산식의 근거 (§7.2 / §7.4 표를 역검증해 확정)
------------------------------------------------
  · px = 2 * 최장변반값 * lens / (depth * SENSOR_MM) * RES_W
      A3-14 start bodybar(개조 전 sc_x=0.070) -> 142 px  (표 142 ✅)
  · 필요 최장변 = SUBJ_FRAC_MIN * depth * SENSOR_MM / lens
      J_A3-13 (lens 40 / dep 2.66) -> 0.3351 m           (표 0.335 ✅)
  · depth 는 카메라 광축 방향 투영(`script_gate.subj_frac` 과 동일)

CLI 없음 -- 라이브러리다.  `python3 -c "import anchorlib"` 로 자기검사만 한다.
"""

import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

# ---------------------------------------------------------------------------
# 참조 (교훈 176: 복제 금지) -- 임계·센서·해상도·투영 헬퍼는 게이트가 정본이다
# ---------------------------------------------------------------------------
import script_gate as SG           # noqa: E402
import sets                        # noqa: E402

SUBJ_FRAC_MIN = SG.SUBJ_FRAC_MIN   # 0.14
SENSOR_MM = SG.SENSOR_MM           # 36.0
RES_W = SG.RES_W                   # 1280.0
RES_H = SG.RES_H                   # 720.0
ANCHOR_NAME = SG.ANCHOR_NAME       # "card"

_sub = SG._sub
_dot = SG._dot
_norm = SG._norm

# §7 이 검증한 6컷 (대본 A3-13 ~ A4-01).  분할 후에는 `_s1` 이 그 비트의 첫 조각.
BEATS = ("A3-13", "A3-14", "A3-15", "A3-16", "A3-17", "A4-01")

A4_LONG_M = 0.297     # 실물 A4 장변 -- 「종이 한 장인가」의 기준자 (§7.4)


# ---------------------------------------------------------------------------
# 잡 조회
# ---------------------------------------------------------------------------
def load_jobs():
    """scenejobs.json 전량. script_gate 의 로더를 그대로 쓴다."""
    return SG.load_jobs()


def props_sid_of(job):
    """★교훈 229★ 소품 조회 키.  분할 조각은 sids=[] 이므로 폴백 순서가 중요."""
    return (job.get("props_sid")
            or (job.get("sids") or [None])[0]
            or job["job_id"].replace("J_", ""))


def props_of(job):
    """이 잡의 소품 목록 (name, kind, loc, sc, col)."""
    return sets.PROPS.get(props_sid_of(job), ())


def beat_jobs(jobs=None, beats=BEATS):
    """비트 -> 그 비트를 담당하는 잡.  분할되었으면 첫 조각(`_s1`)을 대표로 쓴다.

    §7 은 분할 전 6컷을 쟀다.  분할 후에도 ★같은 카메라 궤적의 앞 구간★ 이
    첫 조각이므로 start 값이 보존된다 (cutsplit 은 궤적을 나눌 뿐 바꾸지 않는다).
    end 값은 조각의 끝이므로, 「비트 전체의 end」가 필요할 때는 last_of() 를 쓴다.
    """
    jobs = jobs if jobs is not None else load_jobs()
    out = {}
    for b in beats:
        cands = [j for j in jobs
                 if props_sid_of(j) == b and (j.get("set") or "")]
        if not cands:
            continue
        # split_ix = [i, n].  없으면 단독 컷.
        cands.sort(key=lambda j: (j.get("split_ix") or [1, 1])[0])
        out[b] = cands
    return out


def span_of(cands):
    """비트의 카메라 「전 구간」: 첫 조각의 start + 마지막 조각의 end."""
    a, b = cands[0], cands[-1]
    return ((a["cam_start_xyz"], a["tgt_start_xyz"]),
            (b["cam_end_xyz"], b["tgt_end_xyz"]))


# ---------------------------------------------------------------------------
# 축①/⑤ 색 -- sRGB linearize + WCAG 대비비 + 채도       (§7.1 표를 재현한다)
# ---------------------------------------------------------------------------
def _lin(c):
    """sRGB 성분 -> 선형."""
    c = max(0.0, min(1.0, float(c)))
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def luma(col):
    """WCAG 상대휘도. §7.1 검증: DOC_A -> 0.1445 (표 0.144)."""
    r, g, b = (_lin(v) for v in col[:3])
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def sat(col):
    """HSV 채도. §7.1 검증: DOC_A -> 0.809 (표 0.81)."""
    m = max(col[:3])
    if m <= 0.0:
        return 0.0
    return (m - min(col[:3])) / m


def contrast(c1, c2):
    """WCAG 대비비 (>=1.0).  대형 텍스트 하한 3.0:1 이 §7.1 의 판정선."""
    a, b = luma(c1), luma(c2)
    hi, lo = max(a, b), min(a, b)
    return (hi + 0.05) / (lo + 0.05)


WCAG_LARGE_MIN = 3.0      # §7.1 이 쓴 판정선 (WCAG 2.1 대형 텍스트)
SAT_DIFF_MIN = 0.20       # 「색으로도 구별된다」의 하한 (§7.1 이 0.00 을 실패로 봤다)


# ---------------------------------------------------------------------------
# 투영 -- script_gate.subj_frac 과 같은 핀홀 산식     (§7.2/§7.4 표를 재현한다)
# ---------------------------------------------------------------------------
def depth(cam, tgt, loc):
    """카메라 광축 방향 거리.  <0.05 면 화면 밖(렌즈 뒤/붙음)."""
    f = _norm(_sub(tgt, cam))
    return _dot(_sub(loc, cam), f)


def frac_of(size_m, lens, dep):
    """실물 크기(전체 폭, m) 가 차지하는 화면 폭 비율."""
    if dep < 0.05:
        return 0.0
    return size_m * float(lens) / (dep * SENSOR_MM)


def px_of(size_m, lens, dep):
    """화면 픽셀 (가로 기준 1280).  세로도 같은 px/m 스케일이다."""
    return frac_of(size_m, lens, dep) * RES_W


def need_edge(lens, dep, frac=None):
    """이 거리에서 하한을 넘기려면 최장변이 몇 m 여야 하는가. (§7.4)"""
    frac = SUBJ_FRAC_MIN if frac is None else frac
    return frac * dep * SENSOR_MM / float(lens)


def cam_dist(cam, tgt):
    """카메라-시선점 유클리드 거리 (§7.4 의 「최원거리」)."""
    d = _sub(tgt, cam)
    return math.sqrt(sum(v * v for v in d))


def find_prop(props, name):
    for p in props:
        if p[0] == name:
            return p
    return None


def longest(sc):
    """소품의 최장변 「전체 폭」 (sc 는 반값이다 -- subj_frac 과 동일 규약)."""
    return 2.0 * max(sc[0], sc[1])


# ---------------------------------------------------------------------------
# 자기검사 -- §7 표 값을 재현하는지 확인한다 (도구가 낡으면 여기서 터진다)
# ---------------------------------------------------------------------------
def selfcheck(verbose=True):
    fails = []

    def chk(label, got, want, tol):
        ok = abs(got - want) <= tol
        if verbose:
            print("  %-38s got %10.4f  want %8.4f  %s"
                  % (label, got, want, "OK" if ok else "★MISMATCH★"))
        if not ok:
            fails.append(label)

    if verbose:
        print("=== anchorlib selfcheck (§7 표 재현) ===")
    chk("luma(DOC_A)  §7.1", luma(sets.DOC_A), 0.144, 0.002)
    chk("luma(DOC_N)  §7.1", luma(sets.DOC_N), 0.273, 0.002)
    chk("luma(DOC_B)  §7.1", luma(sets.DOC_B), 0.300, 0.010)
    chk("luma(DOC_C)  §7.1", luma(sets.DOC_C), 0.458, 0.010)
    chk("luma(CUE)    §7.1", luma(sets.CUE), 0.611, 0.010)
    chk("sat(DOC_N)   §7.1", sat(sets.DOC_N), 0.03, 0.005)
    chk("sat(DOC_A)   §7.1", sat(sets.DOC_A), 0.81, 0.01)
    chk("sat(DOC_B)   §7.1", sat(sets.DOC_B), 0.82, 0.01)
    chk("sat(DOC_C)   §7.1", sat(sets.DOC_C), 0.77, 0.01)
    chk("sat(CUE)     §7.1", sat(sets.CUE), 0.75, 0.01)
    # §7.4: J_A3-13 lens 40.0 / 최원거리 2.66 m -> 필요 최장변 0.335 m
    chk("need_edge(40, 2.66) §7.4", need_edge(40.0, 2.66), 0.335, 0.002)
    # §7.2: A3-14 start, 개조 전 bodybar 장변 0.070*2, lens 50, dep 1.7506
    chk("px_of(0.140, 50, 1.7506) §7.2", px_of(0.140, 50.0, 1.7506), 142.0, 2.0)

    if verbose:
        print("selfcheck %s (%d fails)"
              % ("OK" if not fails else "★FAILED★", len(fails)))
    return fails


if __name__ == "__main__":
    raise SystemExit(1 if selfcheck() else 0)
