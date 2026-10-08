import cv2, numpy as np, sys
def stat(path, maxf=200):
    c=cv2.VideoCapture(path); ok,p=c.read()
    if not ok: return None
    p=cv2.cvtColor(cv2.resize(p,(320,180)),cv2.COLOR_BGR2GRAY)
    mags=[]; par=[]; k=0
    while k<maxf:
        ok,f=c.read()
        if not ok: break
        g=cv2.cvtColor(cv2.resize(f,(320,180)),cv2.COLOR_BGR2GRAY)
        fl=cv2.calcOpticalFlowFarneback(p,g,None,0.5,3,15,3,5,1.2,0)
        m=np.sqrt(fl[...,0]**2+fl[...,1]**2); mags.append(m.mean())
        H,W=m.shape
        yy,xx=np.mgrid[0:H,0:W]
        A=np.stack([xx.ravel(),yy.ravel(),np.ones(H*W)],1).astype(np.float32)
        res=0.0
        for ch in range(2):
            b=fl[...,ch].ravel()
            sol,_,_,_=np.linalg.lstsq(A,b,rcond=None)
            res+=np.abs(A@sol-b).mean()
        par.append(res/(m.mean()+1e-6))
        p=g; k+=1
    return np.mean(mags), np.mean(par), k
for name,path in [("OURS_A6-01","/home/user/lf/land38/seg/i2v_A6-01.mp4"),("LAYER_L1","/home/user/lf/r3d/ly_L1.mp4"),("LAYER_L2","/home/user/lf/r3d/ly_L2.mp4"),
                  ("FLAT_s1300","/home/user/lf/r3d/sw_1300_180.mp4")]:
    r=stat(path)
    print("%-14s mean_flow %7.3f px/f   affine_residual %.3f   frames %d"%(name,r[0],r[1],r[2]),flush=True)
