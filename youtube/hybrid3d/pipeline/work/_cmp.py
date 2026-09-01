import cv2, numpy as np, os, sys
SEG="/home/user/lf/land38/seg"
def flow_stat(path, maxf=200):
    cap=cv2.VideoCapture(path); ok,p=cap.read()
    if not ok: return None
    p=cv2.cvtColor(cv2.resize(p,(320,180)),cv2.COLOR_BGR2GRAY)
    mags=[]; par=[]
    k=0
    while k<maxf:
        ok,c=cap.read()
        if not ok: break
        c=cv2.cvtColor(cv2.resize(c,(320,180)),cv2.COLOR_BGR2GRAY)
        f=cv2.calcOpticalFlowFarneback(p,c,None,0.5,3,15,3,5,1.2,0)
        m=np.linalg.norm(f,axis=2)
        mags.append(m.mean())
        # parallax proxy: ratio of motion magnitude spread across the frame.
        # a pure zoom/pan has a smooth radial/uniform field -> low residual
        # after fitting an affine model. real 3D depth leaves residual.
        h,w=m.shape
        ys,xs=np.mgrid[0:h,0:w]
        A=np.stack([xs.ravel(),ys.ravel(),np.ones(h*w)],1)
        res=0.0
        for ch in (0,1):
            b=f[:,:,ch].ravel()
            sol,_,_,_=np.linalg.lstsq(A,b,rcond=None)
            res+=np.abs(b-A@sol).mean()
        par.append(res/ (m.mean()+1e-6))
        p=c; k+=1
    cap.release()
    return np.mean(mags), np.mean(par), k
print("clip      mean_flow_px  affine_residual_ratio  frames")
tot=[]
for i in range(1,12):
    s="A6-%02d"%i
    p=os.path.join(SEG,"i2v_%s.mp4"%s)
    r=flow_stat(p)
    if r: print("%-8s %10.3f %14.3f %10d"%(s,r[0],r[1],r[2])); tot.append(r)
import statistics as st
print("\nOURS mean_flow %.3f px/frame   mean_residual_ratio %.3f"%(
    st.mean(x[0] for x in tot), st.mean(x[1] for x in tot)))
