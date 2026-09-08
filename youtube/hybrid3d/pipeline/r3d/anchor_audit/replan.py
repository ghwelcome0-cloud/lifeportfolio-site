# -*- coding: utf-8 -*-
"""[CEO-83 후속] 축③ 첫 2초 + 축④ 커버 구간을 함께 푸는 처방의 사전 반증 (교훈 206).

문제 (검증 결과):
  축③ 첫 컷 J_A3-13 에서 앵커 cond 0.091 < 주연 cmptab 0.199  (앵커가 46%)
  축④ 앵커가 존재하는 구간이 62% (A3-16 / A4-01 은 대본이 카드를 뗐다)

처방 후보:
  P1 시선점 이동  : 각 컷의 tgt 를 앵커 위치로 옮긴다 (카메라 좌표는 유지)
  P2 위치 교환    : A3-13 에서 cond 와 cmptab 의 자리를 바꾼다 (앵커를 시선점 쪽으로)
  P3 크기 조정    : 앵커를 키우고 이웃 주연을 줄인다
  P4 컷 구성 변경 : 커버 62% 인 2컷(A3-16 / A4-01)을 어떻게 할지

계측은 script_gate 와 ★같은 값★ 으로 (교훈 208):
  frac = 2*max(sc0,sc1)*lens / (depth*36.0)
"""
import sys, json, math
sys.path.insert(0, "/home/user/lf/r3d")
import sets as S

SENSOR = 36.0
FRAC_MIN = 0.14
JOBS = "/home/user/lf/r3d/scenejobs.json"
CUTS = ["J_A3-13", "J_A3-14", "J_A3-15", "J_A3-16", "J_A3-17", "J_A4-01"]

jd = json.load(open(JOBS))
jobs = {j["job_id"]: j for j in jd["jobs"]}


def sub(a, b): return [a[i] - b[i] for i in range(3)]
def dot(a, b): return sum(a[i] * b[i] for i in range(3))
def norm(v):
    n = math.sqrt(dot(v, v)) or 1.0
    return [c / n for c in v]


def frac_at(jid, loc, half, which):
    """이 위치·크기의 소도구가 그 시점에 화면폭 몇 을 차지하나."""
    j = jobs[jid]
    L = float(j["lens"])
    cam = j["cam_%s_xyz" % which]
    tgt = j["tgt_%s_xyz" % which]
    f = norm(sub(tgt, cam))
    dep = dot(sub(loc, cam), f)
    if dep < 0.05:
        return None, dep
    return 2.0 * max(half[0], half[1]) * L / (dep * SENSOR), dep


def anchor_of(sid):
    """그 컷에서 앵커(조건 카드) 엔트리."""
    for nm, k, loc, sc, c in S.PROPS.get(sid, ()):
        if nm in ("cond", "card"):
            return nm, loc, sc
    return None, None, None


def lead_of(sid):
    """그 컷의 최대 소도구 (주연)."""
    best = None
    for nm, k, loc, sc, c in S.PROPS.get(sid, ()):
        long = 2 * max(sc[0], sc[1])
        if best is None or long > best[0]:
            best = (long, nm, loc, sc)
    return best


W = 100
print("=" * W)
print("[P1] 시선점을 앵커 위치로 옮기면 -- 각 컷 앵커 화면폭 (하한 %.2f)" % FRAC_MIN)
print("=" * W)
print("%-10s %-8s %8s %8s %8s %8s  %s" % ("job", "앵커", "현행st", "현행en", "P1_st", "P1_en", "판정"))
print("-" * W)

p1_pass = 0
for jid in CUTS:
    sid = jobs[jid]["sids"][0]
    anm, aloc, asc = anchor_of(sid)
    if anm is None:
        print("%-10s %-8s %8s %8s %8s %8s  %s" % (jid, "없음", "-", "-", "-", "-", "*** 대본이 카드를 뗐다"))
        continue
    j = jobs[jid]
    cur_s, _ = frac_at(jid, aloc, asc, "start")
    cur_e, _ = frac_at(jid, aloc, asc, "end")
    # P1: tgt 를 앵커 위치로 -> depth = |cam - anchor|
    L = float(j["lens"])
    d_s = math.dist(j["cam_start_xyz"], aloc)
    d_e = math.dist(j["cam_end_xyz"], aloc)
    n_s = 2.0 * max(asc[0], asc[1]) * L / (d_s * SENSOR)
    n_e = 2.0 * max(asc[0], asc[1]) * L / (d_e * SENSOR)
    ok = max(n_s, n_e) >= FRAC_MIN
    if ok:
        p1_pass += 1
    print("%-10s %-8s %8.3f %8.3f %8.3f %8.3f  %s"
          % (jid, anm, cur_s or 0, cur_e or 0, n_s, n_e, "OK" if ok else "*** LOW"))
print()
print("  => P1 만으로 하한 통과: %d / 4 (앵커 있는 컷 기준)" % p1_pass)

print()
print("=" * W)
print("[P2] 첫 컷 J_A3-13 -- 앵커가 주연보다 커야 한다 (축③ 하한 1.0)")
print("=" * W)
sid = jobs["J_A3-13"]["sids"][0]
anm, aloc, asc = anchor_of(sid)
llong, lnm, lloc, lsc = lead_of(sid)
a_cur, _ = frac_at("J_A3-13", aloc, asc, "start")
l_cur, _ = frac_at("J_A3-13", lloc, lsc, "start")
print("  현행        앵커 %s %.3f / 주연 %s %.3f  => 비 %.2f  (하한 1.0)"
      % (anm, a_cur, lnm, l_cur, a_cur / l_cur))

# P2a: 자리 교환 (cond <-> cmptab 위치)
a2, _ = frac_at("J_A3-13", lloc, asc, "start")   # 앵커를 주연 자리로
l2, _ = frac_at("J_A3-13", aloc, lsc, "start")   # 주연을 앵커 자리로
print("  P2a 자리교환 앵커 %.3f / 주연 %.3f  => 비 %.2f  %s"
      % (a2, l2, a2 / l2, "OK" if a2 / l2 >= 1.0 else "*** 여전히 작다 (크기 차 때문)"))

# P2b: 자리 교환 + 앵커 확대 / 주연 축소
for amul, lmul in ((1.3, 1.0), (1.5, 1.0), (1.5, 0.8), (1.8, 0.75), (2.0, 0.7)):
    a_h = (asc[0] * amul, asc[1] * amul, asc[2])
    l_h = (lsc[0] * lmul, lsc[1] * lmul, lsc[2])
    a3, _ = frac_at("J_A3-13", lloc, a_h, "start")
    l3, _ = frac_at("J_A3-13", aloc, l_h, "start")
    alng = 2 * max(a_h[0], a_h[1])
    print("  P2b 앵커x%.1f 주연x%.2f  앵커 %.3f (최장변 %.3fm) / 주연 %.3f  => 비 %.2f  %s"
          % (amul, lmul, a3, alng, l3, a3 / l3,
             "OK" if (a3 / l3 >= 1.0 and a3 >= FRAC_MIN) else "*** 미달"))

print()
print("=" * W)
print("[P4] 축④ 커버 -- 대본이 카드를 뗀 2컷을 어떻게 할 것인가")
print("=" * W)
FPS = 24.0
tot = sum(jobs[j]["frames"] for j in CUTS) / FPS
has = sum(jobs[j]["frames"] for j in CUTS
          if anchor_of(jobs[j]["sids"][0])[0] is not None) / FPS
print("  현행           앵커 구간 %.2fs / 전체 %.2fs = %.0f%%   (하한 85%%)" % (has, tot, 100 * has / tot))

# 안 P4a: A3-16 / A4-01 을 컷 목록에서 제거 (숏폼 C 재편집)
alt = [j for j in CUTS if anchor_of(jobs[j]["sids"][0])[0] is not None]
t2 = sum(jobs[j]["frames"] for j in alt) / FPS
print("  P4a 2컷 제외   앵커 구간 %.2fs / 전체 %.2fs = 100%%  (총 길이 %.2fs)" % (t2, t2, t2))
print("       => 25.92s -> %.2fs. 숏폼 하한(보통 15s) %s" % (t2, "충족" if t2 >= 15 else "미달"))

# 안 P4b: 2컷에 앵커를 넣는다 (대본 위반 -- 교훈 213 #4 로 금지)
print("  P4b 2컷에 카드 삽입  => ★금지★ (교훈 213 #4: 대본이 뗀 컷에 억지로 끼우지 말라)")

# 안 P4c: 2컷을 앵커가 있는 다른 대본 컷으로 교체
print("  P4c 다른 대본 컷으로 교체 => 후보를 CSV 에서 찾아야 한다 (아래 별도 계측)")
