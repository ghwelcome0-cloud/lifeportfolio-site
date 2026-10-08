# -*- coding: utf-8 -*-
"""[교훈 206] 앵커 처방을 sets.py 에 넣기 전에 프로토타입으로 반증한다.
질문: 「조건 카드 한 장」(ANCHOR_ID="cond") 을 6컷 전부에 넣으면
      기존 게이트 G5/G6/G8/Z-FIT 가 깨지는가?
"""
import sys, math
sys.path.insert(0, "/home/user/lf/r3d")
import sets, script_gate as SG, json

ANCHOR = "cond"
SENSOR = 36.0

d = json.load(open("/home/user/lf/r3d/scenejobs.json"))
jobs = {j["job_id"]: j for j in (d["jobs"] if isinstance(d, dict) else d)}
want = ["J_A3-13","J_A3-14","J_A3-15","J_A3-16","J_A3-17","J_A4-01"]

def sub(a,b): return (a[0]-b[0],a[1]-b[1],a[2]-b[2])
def dot(a,b): return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]
def norm(a):
    n=math.sqrt(dot(a,a)) or 1e-9
    return (a[0]/n,a[1]/n,a[2]/n)

# 각 컷에서 anchor 를 어디에 두면 「보이는가」를 산술로 스윕한다.
# 앵커는 「그 컷 카메라가 보고 있는 시선점 근처」에 있어야 한다.
print("%-10s %-8s %-6s %s" % ("job","lens","frames","anchor 를 tgt 에 두면 얻는 화면폭(0.144m 카드)"))
for jid in want:
    j = jobs[jid]
    L = float(j["lens"])
    for tag, cam, tgt in (("start", j["cam_start_xyz"], j["tgt_start_xyz"]),
                          ("end",   j["cam_end_xyz"],   j["tgt_end_xyz"])):
        f = norm(sub(tgt, cam))
        dep = dot(sub(tgt, cam), f)   # = 거리
        # 조건 카드 반크기 최장변 0.072 -> 전체 0.144 m
        frac = 2.0 * 0.072 * L / (dep * SENSOR)
        if tag == "start":
            print("%-10s %-8.1f %-6d start dep=%.2fm frac=%.3f" % (jid, L, j["frames"], dep, frac), end="  ")
        else:
            print("end dep=%.2fm frac=%.3f  %s" % (dep, frac, "OK" if frac>=0.14 else "*** LOW"))
