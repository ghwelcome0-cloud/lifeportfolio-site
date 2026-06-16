#!/usr/bin/env python3
# 특정 EP의 모든 레이어 생성 + 빌드 파라미터(JSON) 출력
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import layers_lib as L
from ep_defs import EPS

def _subsize(lines):
    # 가장 긴 줄 글자수 기준 자동 크기 (가독성)
    maxlen = max(len(l) for l in lines)
    if maxlen <= 12: return 60
    if maxlen <= 16: return 54
    if maxlen <= 20: return 48
    return 44

ep = int(sys.argv[1])
base = os.path.dirname(os.path.abspath(__file__))
work = f"{base}/ep{ep}/work"
L.init(work)

d = EPS[ep]
scenes = d["scenes"]
COLOR = {"C": L.CHALK, "Y": L.YELLOW}

build = []  # 빌드 명령용 메타
for sc in scenes:
    sid, dur, typ, clines, csize, ccol, slines, shl = sc
    # 자막 레이어
    L.sub(f"sub_{sid}", slines, size=_subsize(slines), hl=shl)
    if typ == "chalk":
        twoline = len(clines) == 2
        color = COLOR[ccol]
        # 붓글씨(BRUSH)는 한글자/짧은 강조만; 기본 PEN
        fpath = L.BRUSH if (len(clines)==1 and len(clines[0])<=4 and ccol=="Y") else L.PEN
        ycen = 720 if twoline else 760
        L.chalk(f"ch_{sid}", clines, csize, color=color, y_center=ycen, fpath=fpath)
        build.append({"id": sid, "dur": dur, "type": "chalk", "twoline": twoline})
    else:
        build.append({"id": sid, "dur": dur, "type": "sub"})

L.common()

with open(f"{work}/build_meta.json", "w") as f:
    json.dump({"ep": ep, "title": d["title"], "scenes": build}, f, ensure_ascii=False, indent=2)
print(f"EP{ep} layers + build_meta.json done")
