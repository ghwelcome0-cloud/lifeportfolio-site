import sys, os
sys.path.insert(0,"/home/user/lf/work/longform")
import assemble as A
A.WORK="_tx"
SEG="/home/user/lf/land38/seg"
# every A6 seam, both the previously-passing overlaps and the failing one
cases=[("A6-01","A6-02",0.75),("A6-02","A6-03",0.75),("A6-03","A6-04",0.75),
       ("A6-04","A6-05",0.75),("A6-05","A6-06",0.75),("A6-06","A6-07",0.75),
       ("A6-08","A6-09",0.85),("A6-09","A6-10",0.85),("A6-10","A6-11",0.90)]
bad=0
for a,b,d in cases:
    p=os.path.join(SEG,"i2v_%s.mp4"%a); c=os.path.join(SEG,"i2v_%s.mp4"%b)
    pn,cn=A._fcount(p),A._fcount(c); n=max(int(round(d*24)),2)
    try:
        got=A.zoom_match_dissolve(p,c,"_tx/V_%s.mp4"%a,dur=d,focus=(0.08,0.05))
        exp=pn+cn-n
        ok = got==exp
        if not ok: bad+=1
        print("%s->%s  n=%2d  OUT %3d exp %3d  %s"%(a,b,n,got,exp,"OK" if ok else "MISMATCH"),flush=True)
    except Exception as e:
        bad+=1; print("%s->%s  FAIL %s"%(a,b,e),flush=True)
print("BAD",bad,flush=True)
