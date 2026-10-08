import onnxruntime as ort, numpy as np, cv2, time, os
s=ort.InferenceSession("dav2s.onnx", providers=["CPUExecutionProvider"])
i=s.get_inputs()[0]; o=s.get_outputs()[0]
print("in",i.name,i.shape,"out",o.name,o.shape,flush=True)
src="/home/user/lf/land38/S19.png"
img=cv2.imread(src); print("plate",img.shape,flush=True)
H,W=img.shape[:2]
N=518
x=cv2.resize(img,(N,N),interpolation=cv2.INTER_AREA)[:,:,::-1].astype(np.float32)/255.0
mean=np.array([0.485,0.456,0.406],np.float32); std=np.array([0.229,0.224,0.225],np.float32)
x=(x-mean)/std
x=np.transpose(x,(2,0,1))[None]
t=time.time(); d=s.run([o.name],{i.name:x})[0]; el=time.time()-t
d=np.squeeze(d)
print("DEPTH ok %.2fs shape %s min %.3f max %.3f"%(el,d.shape,d.min(),d.max()),flush=True)
dm=cv2.resize(d,(W,H),interpolation=cv2.INTER_CUBIC)
dn=((dm-dm.min())/(dm.max()-dm.min())*255).astype(np.uint8)
cv2.imwrite("S19_depth.png",dn)
cv2.imwrite("S19_depth_vis.png",cv2.applyColorMap(dn,cv2.COLORMAP_INFERNO))
# quantitative: does the depth map actually separate layers?
print("depth histogram deciles:", [int(np.percentile(dn,p)) for p in range(0,101,10)],flush=True)
print("std %.1f"%dn.std(),flush=True)
