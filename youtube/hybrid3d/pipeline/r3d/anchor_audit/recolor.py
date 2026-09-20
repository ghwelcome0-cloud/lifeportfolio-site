# -*- coding: utf-8 -*-
"""[CEO-83 후속] 앵커 재선정 처방의 사전 반증 (교훈 206).

대본 제약 (SCRIPT_ACT3-8.csv A3-13 screen_direction):
    "손이 과장된 컬러 스티커를 떼고 ★중성★ 카드만 남김."
=> 앵커를 발광/유채색으로 만드는 처방은 ★대본 위반★ 이다.
   따라서 CUE 시안 / DOC_A 마젠타 안은 폐기한다.

남은 길: 앵커의 색을 바꾸는 대신 ★이웃을 어둡게★ 해서 구별성을 만든다.
        무채색을 유지하므로 "중성 카드" 를 어기지 않는다.
        (벤치마크 -OHeRVGeiPQ '무한 보이드에 단일 제품' 의 명암 반전 버전)

축① 하한: 대비비 >= 3.0:1 (WCAG 대형 텍스트) 또는 채도차 >= 0.5
"""
import sys
sys.path.insert(0, "/home/user/lf/r3d")
import sets as S


def lum(c):
    def f(u):
        return u / 12.92 if u <= 0.03928 else ((u + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])


def ratio(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def sat(c):
    mx, mn = max(c), min(c)
    return 0.0 if mx <= 0 else (mx - mn) / mx


# 앵커 후보 -- 전부 무채색 (대본 "중성" 준수)
ANCHOR = [
    ("현행 DOC_N 중성회색", S.DOC_N),
    ("DOC_W 백지 A4", S.DOC_W),
    ("A1 밝은 중성 0.88", (0.880, 0.878, 0.868)),
    ("A2 밝은 중성 0.94", (0.940, 0.938, 0.930)),
]

# 이웃 문서 후보 -- 어둡게 낮춘 무채색 (현재는 전부 DOC_W 0.78)
NEIGH = [
    ("현행 DOC_W 0.78", S.DOC_W),
    ("N1 어두운 종이 0.42", (0.420, 0.418, 0.410)),
    ("N2 어두운 종이 0.34", (0.340, 0.338, 0.332)),
    ("N3 어두운 종이 0.28", (0.280, 0.278, 0.272)),
    ("N4 어두운 종이 0.22", (0.220, 0.218, 0.214)),
]

BG = [("책상 ENV_FURN", S.ENV_FURN), ("바닥 ENV_FLOOR", S.ENV_FLOOR),
      ("벽 ENV_WALL", S.ENV_WALL)]

W = 88
print("=" * W)
print("[축① 재처방] 앵커는 밝게 / 이웃 문서는 어둡게 -- 무채색 유지 (대본 '중성' 준수)")
print("=" * W)
print("%-22s %6s %5s | %s" % ("색", "휘도", "채도", "책상 대비 / 바닥 대비"))
print("-" * W)
for nm, c in ANCHOR + NEIGH:
    print("%-22s %6.3f %5.2f | %5.1f:1  %5.1f:1"
          % (nm, lum(c), sat(c), ratio(c, S.ENV_FURN), ratio(c, S.ENV_FLOOR)))

print()
print("=" * W)
print("[핵심] 앵커 x 이웃 조합의 상호 대비비  (하한 3.0:1)")
print("=" * W)
hdr = "%-22s" % "앵커 \\ 이웃"
for nnm, _ in NEIGH:
    hdr += "%14s" % nnm.split()[0]
print(hdr)
print("-" * W)
best = []
for anm, ac in ANCHOR:
    row = "%-22s" % anm
    for nnm, nc in NEIGH:
        r = ratio(ac, nc)
        mark = "*" if r >= 3.0 else " "
        row += "%13.2f%s" % (r, mark)
        if r >= 3.0:
            best.append((r, anm, nnm, ac, nc))
    print(row)

print()
print("  * = 하한 3.0:1 통과.  통과 조합 %d 개" % len(best))
if best:
    best.sort(reverse=True)
    print()
    print("  [권고] 가장 안전한 조합 3 개 (대비 높은 순, 이웃이 너무 어두우면 배경에 묻힘):")
    for r, anm, nnm, ac, nc in best[:6]:
        # 이웃이 책상과 구별되는지도 함께 봐야 한다 (이웃이 사라지면 대본 위반)
        rn = ratio(nc, S.ENV_FURN)
        ok = "이웃도 책상과 %.1f:1 로 구별됨" % rn if rn >= 1.6 else "*** 이웃이 책상에 묻힌다 (%.1f:1)" % rn
        print("     %-22s vs %-20s  %5.2f:1   %s" % (anm, nnm, r, ok))
