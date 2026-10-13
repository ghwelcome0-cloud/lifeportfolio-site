# 2s-window optical flow p95 (camera never "stops") + direction reversal count per shot
import cv2,numpy as np,json,sys
c=cv2.VideoCapture('build/EP03_longform.mp4');prev=None;mag=[];hx=[]
i=0
while True:
    ok,f=c.read()
    if not ok:break
    if i%3==0:
        g=cv2.cvtColor(cv2.resize(f,(480,270)),cv2.COLOR_BGR2GRAY)
        if prev is not None:
            fl=cv2.calcOpticalFlowFarneback(prev,g,None,.5,3,15,3,5,1.2,0)
            m=np.linalg.norm(fl,axis=2)*4; mag.append(float(np.percentile(m,95))); hx.append(float(np.median(fl[...,0])*4))
        prev=g
    i+=1
mag=np.array(mag);win=20   # 20 samples x 0.1s = 2s
low=[k*0.1 for k in range(len(mag)-win) if mag[k:k+win].max()<1.5]
json.dump(dict(n=len(mag),low_2s_windows=len(low),low_at=[round(x,1) for x in low[:30]]),open('qa/flow.json','w'))
print('samples',len(mag),'2s windows with p95<1.5px:',len(low),low[:15])
