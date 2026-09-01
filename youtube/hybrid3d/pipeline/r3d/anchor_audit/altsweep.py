# -*- coding: utf-8 -*-
"""[CEO-83 검증 축⑤] 대안 앵커 후보 비교 — 「구별성」과 「게이트 통과」를 동시에.
교훈 206: 코드에 넣기 전에 스윕으로 반증한다.
교훈 208: 게이트가 재는 값과 같은 산식."""
import sys, math, json
sys.path.insert(0,"/home/user/lf/r3d")
import sets as S, script_gate as SG

SENSOR=36.0; RES_W=1280.0; FRAC_MIN=0.14
d=json.load(open("/home/user/lf/r3d/scenejobs.json"))
jobs={j["job_id"]:j for j in (d["jobs"] if isinstance(d,dict) else d)}
CUTS=[("J_A3-13","A3-13"),("J_A3-14","A3-14"),("J_A3-15","A3-15"),
      ("J_A3-16","A3-16"),("J_A3-17","A3-17"),("J_A4-01","A4-01")]

def lum(c):
    f=lambda u: u/12.92 if u<=0.03928 else ((u+0.055)/1.055)**2.4
    return 0.2126*f(c[0])+0.7152*f(c[1])+0.0722*f(c[2])
def ratio(a,b):
    la,lb=lum(a),lum(b); hi,lo=max(la,lb),min(la,lb); return (hi+0.05)/(lo+0.05)
def satu(c):
    mx=max(c); return 0.0 if mx<=0 else (mx-min(c))/mx

# 각 컷의 「이웃 종이」 색 = 그 컷 최대 소도구의 색
NEIGH={}
for jid,sid in CUTS:
    best=(0.0,None)
    for nm,_k,loc,sc,c in S.PROPS.get(sid,()):
        a=max(sc[0],sc[1])
        if a>best[0]: best=(a,c)
    NEIGH[sid]=best[1]

CAND=[("A. 현행 DOC_N 회색",      S.DOC_N, 0.072),
      ("B. DOC_C 앰버 카드",      S.DOC_C, 0.072),
      ("C. DOC_B 틸 카드",        S.DOC_B, 0.072),
      ("D. DOC_A 마젠타 카드",    S.DOC_A, 0.072),
      ("E. CUE 시안(발광계열)",   S.CUE,   0.072),
      ("F. CUE 시안 + 크게 0.105",S.CUE,   0.105)]

print("="*92)
print("[축⑤] 대안 앵커 후보 — ①이웃 종이 대비 구별성  ②6컷 게이트 통과 (통일 크기)")
print("="*92)
for nm,col,half in CAND:
    # 구별성: 컷별 이웃 종이와의 대비비/채도차 최솟값 (최악의 컷)
    worst_r=99.9; worst_s=9.9
    for _j,sid in CUTS:
        n=NEIGH[sid]
        worst_r=min(worst_r, ratio(col,n)); worst_s=min(worst_s, abs(satu(col)-satu(n)))
    # 게이트: 카드를 각 컷 시선점에 두었을 때 화면폭 (start/end 중 최대)
    okc=0; fr_list=[]
    for jid,sid in CUTS:
        j=jobs[jid]; L=float(j["lens"]); best=0.0
        for ck,tk in (("cam_start_xyz","tgt_start_xyz"),("cam_end_xyz","tgt_end_xyz")):
            cam,tgt=j[ck],j[tk]
            dep=math.dist(cam,tgt)      # 시선점에 놓으면 깊이 = 카메라-시선점 거리
            fr=2.0*half*L/(dep*SENSOR)
            best=max(best,fr)
        fr_list.append(best)
        if best>=FRAC_MIN: okc+=1
    print("%-24s 최악대비 %5.2f:1  최악채도차 %.2f  |  게이트 %d/6  (%s)"
          %(nm, worst_r, worst_s, okc, " ".join("%.3f"%f for f in fr_list)))
print()
print("판정 기준: 대비비 >= 3.0:1 (WCAG 대형 텍스트 하한) 또는 채도차 >= 0.5 이면 '구별된다'")
print("           게이트 6/6 이면 전 컷에서 하한 통과")
