import cv2, numpy as np
def stat(path,maxf=120):
    c=cv2.VideoCapture(path); ok,p=c.read()
    if not ok: return None
    p=cv2.cvtColor(cv2.resize(p,(320,180)),cv2.COLOR_BGR2GRAY)
    mags=[];par=[];k=0
    while k<maxf:
        ok,f=c.read()
        if not ok: break
        g=cv2.cvtColor(cv2.resize(f,(320,180)),cv2.COLOR_BGR2GRAY)
        fl=cv2.calcOpticalFlowFarneback(p,g,None,0.5,3,15,3,5,1.2,0)
        m=np.sqrt(fl[...,0]**2+fl[...,1]**2); mm=m.mean(); mags.append(mm)
        H,W=m.shape; yy,xx=np.mgrid[0:H,0:W]
        A=np.stack([xx.ravel(),yy.ravel(),np.ones(H*W)],1).astype(np.float32); res=0.
        for ch in range(2):
            b=fl[...,ch].ravel(); sol,_,_,_=np.linalg.lstsq(A,b,rcond=None)
            res+=np.abs(A@sol-b).mean()
        par.append(res/(mm+1e-6)); p=g; k+=1
    mags=np.array(mags); par=np.array(par)
    still=float((mags<0.15).mean())
    return mags.mean(), par.mean(), still, len(mags)
rows=[("CEO_SAMPLE_vitc","/home/user/lf/work/longform/_ref/vitc.mp4"),
      ("OURS_A6-01","/home/user/lf/land38/seg/i2v_A6-01.mp4"),
      ("OURS_A6-10","/home/user/lf/land38/seg/i2v_A6-10.mp4"),
      ("LAYER_L1","ly_L1.mp4"),("LAYER_L2","ly_L2.mp4"),("FLAT_s1300","sw_1300_180.mp4")]
print("%-16s %9s %9s %8s %6s"%("clip","flow","resid","still%","f"),flush=True)
for n,p in rows:
    r=stat(p)
    if r is None: print("%-16s MISSING"%n,flush=True); continue
    print("%-16s %9.3f %9.3f %7.1f%% %6d"%(n,r[0],r[1],r[2]*100,r[3]),flush=True)
