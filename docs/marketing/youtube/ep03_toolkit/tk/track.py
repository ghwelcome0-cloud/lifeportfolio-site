# planar matchmove: track the table plane around a quad with KLT + RANSAC homography, chain over frames
import cv2,numpy as np,sys,json
src,quad,out=sys.argv[1],json.loads(sys.argv[2]),sys.argv[3]
cap=cv2.VideoCapture(src);F=[]
while True:
    ok,f=cap.read()
    if not ok: break
    F.append(f)
Q0=np.float32(quad)
g0=cv2.cvtColor(F[0],cv2.COLOR_BGR2GRAY)
def seed(g,Q):
    m=np.zeros_like(g);cx,cy=Q.mean(0)
    big=(Q-[cx,cy])*1.9+[cx,cy];cv2.fillConvexPoly(m,big.astype(np.int32),255)
    return cv2.goodFeaturesToTrack(g,800,0.005,6,mask=m)
Hs=[np.eye(3)];p=seed(g0,Q0);prev=g0;Hc=np.eye(3);Q=Q0.copy();res=[]
for i in range(1,len(F)):
    g=cv2.cvtColor(F[i],cv2.COLOR_BGR2GRAY)
    p1,st,_=cv2.calcOpticalFlowPyrLK(prev,g,p,None,winSize=(31,31),maxLevel=4)
    a=p[st[:,0]==1].reshape(-1,2);b=p1[st[:,0]==1].reshape(-1,2)
    H,inl=cv2.findHomography(a,b,cv2.RANSAC,2.0)
    Hc=H@Hc;Q=cv2.perspectiveTransform(Q0[None],Hc)[0]
    err=float(np.median(np.linalg.norm(cv2.perspectiveTransform(a[None],H)[0]-b,axis=1)[inl[:,0]==1]))
    res.append(err);Hs.append(Hc.copy())
    prev=g;p=seed(g,Q) if len(b)<300 or i%6==0 else b[inl[:,0]==1].reshape(-1,1,2)
    if i%6==0: # re-seed: keep chain, fresh points
        pass
quads=[cv2.perspectiveTransform(Q0[None],H)[0].tolist() for H in Hs]
json.dump(dict(H=[h.tolist() for h in Hs],quads=quads,reproj_med=float(np.median(res)),reproj_p95=float(np.percentile(res,95))),open(out,'w'))
print('frames',len(F),'reproj med',round(np.median(res),3),'p95',round(np.percentile(res,95),3))
# drift check: overlay quad on first/mid/last
for n in (0,len(F)//2,len(F)-1):
    f=F[n].copy();cv2.polylines(f,[np.int32(quads[n])],True,(0,0,255),2);cv2.imwrite(out.replace('.json',f'_{n}.jpg'),f)
