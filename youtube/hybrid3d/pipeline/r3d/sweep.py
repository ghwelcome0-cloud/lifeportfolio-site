import pflow, numpy as np, cv2, os
def stat(path,maxf=80):
    c=cv2.VideoCapture(path); ok,p=c.read()
    p=cv2.cvtColor(cv2.resize(p,(320,180)),cv2.COLOR_BGR2GRAY); mags=[];par=[];k=0
    while k<maxf:
        ok,f=c.read()
        if not ok: break
        g=cv2.cvtColor(cv2.resize(f,(320,180)),cv2.COLOR_BGR2GRAY)
        fl=cv2.calcOpticalFlowFarneback(p,g,None,0.5,3,15,3,5,1.2,0)
        m=np.sqrt(fl[...,0]**2+fl[...,1]**2); mags.append(m.mean())
        H,W=m.shape; yy,xx=np.mgrid[0:H,0:W]
        A=np.stack([xx.ravel(),yy.ravel(),np.ones(H*W)],1).astype(np.float32); res=0.
        for ch in range(2):
            b=fl[...,ch].ravel(); sol,_,_,_=np.linalg.lstsq(A,b,rcond=None)
            res+=np.abs(A@sol-b).mean()
        par.append(res/(m.mean()+1e-6)); p=g; k+=1
    return np.mean(mags),np.mean(par)
GRID=[(600,0.90,0.10),(900,1.30,0.10),(900,1.30,0.35),(1300,1.80,0.12)]
print("%-22s %8s %8s"%("cfg(strength,lat,dz)","flow","resid"),flush=True)
for s,lat,dz in GRID:
    p=[(-lat/2, lat/2),(0.20,-0.16),(0.0,dz)]
    o="sw_%d_%d.mp4"%(s,int(lat*100))
    pflow.render("/home/user/lf/land38/S19.png",o,48,path=p,focus=(0.42,0.62),strength=s,crop=0.72)
    f,r=stat(o)
    print("s=%-5d lat=%.2f dz=%.2f   %7.3f  %7.3f"%(s,lat,dz,f,r),flush=True)
