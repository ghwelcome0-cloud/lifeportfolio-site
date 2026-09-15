import sys, os
sys.path.insert(0,"/home/user/lf/work/longform")
import assemble as A
A.WORK="_tx"
SEG="/home/user/lf/land38/seg"
tests=[
 ("through_page","A6-07","A6-08",dict(dur=0.85,focus=(0.04,0.10),zoom=1.60)),
 ("inset_descent","A6-08","A6-09",dict(dur=1.00,focus=(-0.06,0.12),r=0.26)),
 ("portal_return","A6-10","A6-11",dict(dur=0.90,focus=(0.00,0.04),zoom=1.28)),
]
for fn,a,b,kw in tests:
    p=os.path.join(SEG,"i2v_%s.mp4"%a); c=os.path.join(SEG,"i2v_%s.mp4"%b)
    pn,cn=A._fcount(p),A._fcount(c)
    out="_tx/T_%s.mp4"%fn
    try:
        n=getattr(A,fn)(p,c,out,**kw)
        ov=int(round(kw.get("dur",1.0)*24))
        print("%-14s %s->%s  prev %d cur %d  OUT %d  expect %d  %s"%(
            fn,a,b,pn,cn,n,pn+cn-ov,"OK" if n==pn+cn-ov else "MISMATCH"),flush=True)
    except Exception as e:
        print("%-14s FAIL %s"%(fn,e),flush=True)
print("DONE",flush=True)
