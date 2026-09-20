# -*- coding: utf-8 -*-
"""[CEO-83 검증 축②] 「빈 카드 -> 제목 -> 본문 채워짐」이 화면에서 몇 픽셀인가.
산식은 script_gate 와 같은 값 (교훈 208). 해상도는 렌더 정본 1280x720.
"""
import sys, math, json
sys.path.insert(0,"/home/user/lf/r3d")
import sets

SENSOR=36.0; RES_W=1280.0
d=json.load(open("/home/user/lf/r3d/scenejobs.json"))
jobs={j["job_id"]:j for j in (d["jobs"] if isinstance(d,dict) else d)}

def sub(a,b): return (a[0]-b[0],a[1]-b[1],a[2]-b[2])
def dot(a,b): return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]
def norm(a):
    n=math.sqrt(dot(a,a)) or 1e-9; return (a[0]/n,a[1]/n,a[2]/n)

def px(jid, sid, name, which="end"):
    """이 소도구의 최장변이 화면에서 몇 px 인가."""
    j=jobs[jid]; L=float(j["lens"])
    cam = j["cam_%s_xyz"%("start" if which=="start" else "end")]
    tgt = j["tgt_%s_xyz"%("start" if which=="start" else "end")]
    f=norm(sub(tgt,cam))
    for nm,_k,loc,sc,_c in sets.PROPS.get(sid,()):
        if nm!=name: continue
        dep=dot(sub(loc,cam),f)
        if dep<0.05: return None,None,None
        # 최장변(전체 = 2*half)
        w = 2.0*max(sc[0],sc[1]); h = 2.0*sc[2]
        fw = w*L/(dep*SENSOR)          # 화면폭 비율
        return dep, fw, fw*RES_W       # 깊이, 비율, 픽셀
    return None,None,None

print("="*78)
print("[축②] 「변화의 가시성」 — 대본이 말한 변화가 화면에서 몇 px 인가")
print("="*78)
print("대본: A3-14 '빈 본문 바' -> A3-15 '손이 중간회색 바를 한 줄 채움'")
print()
# 본문 바의 y 반크기(=두께)가 0.005 -> 0.008 로 바뀐다
for jid,sid,nm,label in (("J_A3-14","A3-14","bodybar","빈 본문 바 (sc_y=0.005)"),
                         ("J_A3-15","A3-15","fillbar","채운 바   (sc_y=0.008)")):
    for wh in ("start","end"):
        dep,fw,pxw = px(jid,sid,nm,wh)
        # 두께 방향(y) 픽셀도 같이
        sc = dict((n,s) for n,_k,_l,s,_c in sets.PROPS[sid])[nm]
        thick_px = 2.0*sc[1]*float(jobs[jid]["lens"])/(dep*SENSOR)*RES_W
        print("  %-9s %-6s %-26s dep=%.2fm  길이=%6.1fpx  두께=%5.2fpx"
              % (jid, wh, label, dep, pxw, thick_px))
print()
print("  => 대본의 '변화'는 바 두께 %.2fpx -> %.2fpx 차이로 표현되어 있다."
      % (2*0.005*50.0/(1.70*36.0)*1280, 2*0.008*54.0/(1.36*36.0)*1280))
print()
print("="*78)
print("[축③] 0~2초 후킹 — 첫 컷 J_A3-13 (101f=4.2s) 의 첫 프레임에서 앵커")
print("="*78)
dep,fw,pxw = px("J_A3-13","A3-13","cond","start")
print("  cond  dep=%.2fm  화면폭=%.3f (%.0fpx)   하한 0.14 (%.0fpx)"%(dep,fw,pxw,0.14*RES_W))
dep2,fw2,pxw2 = px("J_A3-13","A3-13","cmptab","start")
print("  cmptab(주연) dep=%.2fm  화면폭=%.3f (%.0fpx)"%(dep2,fw2,pxw2))
print("  => 첫 화면의 시선은 앵커가 아니라 비교표에 간다. 앵커는 %.0f%% 크기."%(fw/fw2*100))
