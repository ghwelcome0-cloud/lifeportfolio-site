# -*- coding: utf-8 -*-
"""앵커 후보 감사 — 「조건 카드」가 6컷에서 실제로 어떤 상태인가.
프로젝션은 script_gate 와 같은 산식(교훈 208)을 쓴다."""
import sys, math, json
sys.path.insert(0,"/home/user/lf/r3d")
import sets, script_gate as SG

SENSOR=36.0
d=json.load(open("/home/user/lf/r3d/scenejobs.json"))
jobs={j["job_id"]:j for j in (d["jobs"] if isinstance(d,dict) else d)}
CUTS=[("J_A3-13","A3-13"),("J_A3-14","A3-14"),("J_A3-15","A3-15"),
      ("J_A3-16","A3-16"),("J_A3-17","A3-17"),("J_A4-01","A4-01")]

def sub(a,b): return (a[0]-b[0],a[1]-b[1],a[2]-b[2])
def dot(a,b): return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]
def norm(a):
    n=math.sqrt(dot(a,a)) or 1e-9; return (a[0]/n,a[1]/n,a[2]/n)

print("=== 컷별 주연(최대 화면폭) 과 앵커 후보의 존재 여부 ===\n")
print("%-9s %-11s %-7s %-26s %s" % ("job","주연","주연폭","앵커후보(cond/card)","앵커폭"))
rows=[]
for jid,sid in CUTS:
    j=jobs[jid]; L=float(j["lens"])
    props=sets.PROPS.get(sid,())
    blocks=SG.blockers_of(j["set"], sid, props)
    best=(0.0,None); anch=(0.0,None)
    for cam,tgt in ((j["cam_start_xyz"],j["tgt_start_xyz"]),(j["cam_end_xyz"],j["tgt_end_xyz"])):
        f=norm(sub(tgt,cam))
        for nm,_k,loc,sc,_c in props:
            dep=dot(sub(loc,cam),f)
            if dep<0.05: continue
            fr=2.0*max(sc[0],sc[1])*L/(dep*SENSOR)
            ok,_=SG.visible(cam,tgt,loc,L,blocks)
            if not ok: continue
            if fr>best[0]: best=(fr,nm)
            if nm in ("cond","card") and fr>anch[0]: anch=(fr,nm)
    rows.append((jid,best,anch))
    print("%-9s %-11s %-7.3f %-26s %s" % (
        jid, best[1] or "-", best[0],
        anch[1] or "*** 없음 ***", ("%.3f"%anch[0]) if anch[1] else "-"))

n_has=sum(1 for _,_,a in rows if a[1])
n_lead=sum(1 for _,b,a in rows if a[1] and b[1]==a[1])
print(f"\n앵커가 존재하는 컷      : {n_has} / 6")
print(f"앵커가 「주연」인 컷    : {n_lead} / 6")
print(f"앵커가 하한(0.14) 넘는 컷: {sum(1 for _,_,a in rows if a[0]>=0.14)} / 6")

print("\n=== 앵커 후보의 「정체성」이 유지되는가 (크기/색) ===")
for jid,sid in CUTS:
    for nm,_k,loc,sc,col in sets.PROPS.get(sid,()):
        if nm in ("cond","card"):
            print("  %-8s %-6s 최장변 %.3f m  색 %s" % (sid,nm,2*max(sc[0],sc[1]),tuple(round(c,3) for c in col)))
