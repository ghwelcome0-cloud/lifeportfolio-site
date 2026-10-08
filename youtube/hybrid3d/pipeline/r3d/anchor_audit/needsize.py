# -*- coding: utf-8 -*-
"""[CEO-83 검증 축④] 26초 지속력 — 「한 장의 카드」로 6컷을 덮으려면 카드가 얼마나 커야 하나.
실물 A4 = 0.210 x 0.297 m (최장변 0.297). 그보다 커야 하면 '종이'가 아니다."""
import sys, math, json
sys.path.insert(0,"/home/user/lf/r3d")
SENSOR=36.0; FRAC_MIN=0.14; A4_LONG=0.297
d=json.load(open("/home/user/lf/r3d/scenejobs.json"))
jobs={j["job_id"]:j for j in (d["jobs"] if isinstance(d,dict) else d)}
CUTS=["J_A3-13","J_A3-14","J_A3-15","J_A3-16","J_A3-17","J_A4-01"]

print("="*94)
print("[축④] 카드를 시선점에 두고 하한 0.14 를 넘기려면 최장변이 몇 m 여야 하는가")
print("      (실물 A4 최장변 = 0.297 m. 이보다 크면 '종이 한 장'이 아니다)")
print("="*94)
print("%-9s %6s %8s %8s %10s %10s  %s"%("job","lens","dep_st","dep_en","필요최장변","A4배수","판정"))
worst=0.0
for jid in CUTS:
    j=jobs[jid]; L=float(j["lens"])
    d0=math.dist(j["cam_start_xyz"], j["tgt_start_xyz"])
    d1=math.dist(j["cam_end_xyz"],   j["tgt_end_xyz"])
    dmax=max(d0,d1)                       # 가장 먼 시점에서도 하한을 넘어야 '지속'
    need = FRAC_MIN*dmax*SENSOR/L
    worst=max(worst,need)
    mult = need/A4_LONG
    verdict = "OK (종이)" if mult<=1.0 else ("과대 %.1f배"%mult)
    print("%-9s %6.1f %8.2f %8.2f %10.3f %10.2f  %s"%(jid,L,d0,d1,need,mult,verdict))
print("-"*94)
print("6컷 전부를 한 크기로 덮으려면 최장변 %.3f m 필요 = A4 의 %.2f 배"%(worst, worst/A4_LONG))
print()
print("="*94)
print("[대본 대조] 대본이 그 컷에서 무엇을 보라고 했는가")
print("="*94)
rows=[("J_A3-13","비교표 옆 빈 조건 카드 한 장","카드 있음"),
      ("J_A3-14","조건 카드 위 제목 바/본문 바","카드 = 주연"),
      ("J_A3-15","손이 본문에 회색 바를 채움","카드 = 주연"),
      ("J_A3-16","회의 브리프 1장과 개인 설계 노트","★카드 없음 (예시 컷)★"),
      ("J_A3-17","채용공고 위에 조건 카드가 함께 놓임","카드 있음(조연)"),
      ("J_A4-01","사무실 단면 위층 결과 서가로 수직 상승","★카드 없음 (서가)★")]
for a,b,c in rows: print("  %-9s %-34s %s"%(a,b,c))
print()
print("  => 대본 자체가 6컷 중 2컷(A3-16 예시 / A4-01 결과서가)에서 카드를 떼어놨다.")
print("     즉 「조건 카드」는 26초 전체의 앵커가 아니라 ★4컷(16.0초) 구간의 앵커★ 다.")
f=lambda j: jobs[j]["frames"]/24.0
print("     카드 구간 4컷 = %.2f초 / 전체 %.2f초 = %.0f%%"
      %(sum(f(x) for x in ["J_A3-13","J_A3-14","J_A3-15","J_A3-17"]),
        sum(f(x) for x in CUTS),
        100*sum(f(x) for x in ["J_A3-13","J_A3-14","J_A3-15","J_A3-17"])/sum(f(x) for x in CUTS)))
