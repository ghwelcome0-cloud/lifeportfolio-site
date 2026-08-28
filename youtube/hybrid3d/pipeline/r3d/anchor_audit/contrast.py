# -*- coding: utf-8 -*-
"""[CEO-83 검증 축①] 시각적 구별성 — 앵커가 주변에서 얼마나 튀는가.
벤치마크 앵커(발광 물방울/분자)는 배경 대비 극단이다. 우리 회색 A4 는?
sRGB 상대휘도 + 대비비(WCAG 산식)로 잰다."""
import sys
sys.path.insert(0,"/home/user/lf/r3d")
import sets as S

def lum(c):
    def f(u):
        return u/12.92 if u <= 0.03928 else ((u+0.055)/1.055)**2.4
    return 0.2126*f(c[0])+0.7152*f(c[1])+0.0722*f(c[2])
def ratio(a,b):
    la,lb = lum(a),lum(b)
    hi,lo = max(la,lb),min(la,lb)
    return (hi+0.05)/(lo+0.05)
def sat(c):
    mx,mn=max(c),min(c)
    return 0.0 if mx<=0 else (mx-mn)/mx

CAND = [("DOC_N 중성회색 (현 앵커)", S.DOC_N),
        ("DOC_W 백지 A4",            S.DOC_W),
        ("DOC_A 마젠타",             S.DOC_A),
        ("DOC_B 틸",                 S.DOC_B),
        ("DOC_C 앰버",               S.DOC_C)]
BG   = [("책상 ENV_FURN", S.ENV_FURN), ("벽 ENV_WALL", S.ENV_WALL),
        ("벽밝은 ENV_WALL_HI", S.ENV_WALL_HI), ("바닥 ENV_FLOOR", S.ENV_FLOOR)]

print("="*86)
print("[축①] 시각적 구별성 — 배경 대비비 (WCAG) 와 채도")
print("="*86)
print("%-26s %6s %6s | %s"%("후보","휘도","채도","배경별 대비비"))
for nm,c in CAND:
    r = "  ".join("%s %5.1f:1"%(b[0].split()[0], ratio(c,b[1])) for b in BG)
    print("%-26s %6.3f %6.2f | %s"%(nm, lum(c), sat(c), r))
print()
print("[핵심] 같은 책상 위 「다른 종이」와의 상호 대비 — 앵커가 이웃 종이에서 구별되는가")
print("-"*86)
pairs = [("현 앵커 DOC_N", S.DOC_N, "이웃 백지 DOC_W", S.DOC_W),
         ("현 앵커 DOC_N", S.DOC_N, "비교표 DOC_W",   S.DOC_W),
         ("대안 DOC_A",   S.DOC_A, "이웃 백지 DOC_W", S.DOC_W),
         ("대안 DOC_B",   S.DOC_B, "이웃 백지 DOC_W", S.DOC_W),
         ("대안 DOC_C",   S.DOC_C, "이웃 백지 DOC_W", S.DOC_W)]
for an,ac,bn,bc in pairs:
    print("  %-16s vs %-18s 대비비 %5.2f:1   채도차 %.2f"
          %(an,bn,ratio(ac,bc), abs(sat(ac)-sat(bc))))
print()
print("[기준선] 벤치마크 앵커는 '발광' 이다. 우리 발광 후보(cue_orb)의 색:")
for k in ("ACT_M","ACT_F","CUE"):
    v = getattr(S,k,None)
    if v is not None:
        print("   %-6s = %s   휘도 %.3f  채도 %.2f  vs 책상 %5.1f:1"
              %(k, v, lum(v), sat(v), ratio(v,S.ENV_FURN)))
