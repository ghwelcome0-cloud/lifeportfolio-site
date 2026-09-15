import json, os, subprocess, sys
import numpy as np
from PIL import Image
B="/home/user/lf/r3d/_batch"
J=json.load(open("/home/user/lf/r3d/scenejobs.json"))
jl = J["jobs"] if isinstance(J,dict) else J
rows=[]
for j in jl:
    jid=j["job_id"]; p=os.path.join(B,jid+".mp4")
    if not os.path.exists(p): continue
    n=int(j["frames"]); k=n//2
    t="/tmp/_ga.png"
    subprocess.run(["ffmpeg","-y","-v","error","-i",p,"-vf","select=eq(n\\,%d)"%k,
                    "-vframes","1",t],check=True)
    a=np.asarray(Image.open(t).convert("RGB")).astype(np.float32)
    sat=(a.max(2)-a.min(2))          # chroma per pixel
    rows.append((jid, float(sat.mean()), float(np.percentile(sat,99)),
                 float((sat>60).mean())))
rows.sort(key=lambda r:-r[3])
print("job        satmean  sat_p99  frac(sat>60)")
old=[]
for jid,m,p99,f in rows:
    flag = "  <<< OLD-GEN" if f>0.03 else ""
    if f>0.03: old.append(jid)
    print("%-10s %7.2f  %7.1f  %6.3f%s"%(jid,m,p99,f,flag))
print()
print("OLD-GEN COUNT %d / %d"%(len(old),len(rows)))
print("re-render list: %s"%",".join(old))
