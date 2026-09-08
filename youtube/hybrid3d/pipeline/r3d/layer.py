"""Layered parallax with occlusion-aware back-to-front compositing.
Discrete depth layers => discontinuous motion at object edges => TRUE parallax,
and disocclusion gaps get inpainted from the layer behind."""
import numpy as np, cv2, os, time, subprocess, pflow

def build_layers(img, d, n=6):
    q = np.clip((d*n).astype(np.int32), 0, n-1)
    L=[]
    for i in range(n):
        m = (q==i).astype(np.uint8)*255
        if m.sum()==0: continue
        m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((9,9),np.uint8))
        m = cv2.GaussianBlur(m,(9,9),0)
        z = (i+0.5)/n
        L.append((z, m.astype(np.float32)/255.0))
    return L   # far -> near

def warp_layer(img, alpha, z, dx, dy, dz, focus, strength):
    H,W = img.shape[:2]
    gx,gy = np.meshgrid(np.arange(W,dtype=np.float32), np.arange(H,dtype=np.float32))
    cx,cy = focus[0]*W, focus[1]*H
    k = 1.0 + dz*(0.30 + 1.00*z)
    sx = cx + (gx-cx)/k + z*dx*strength
    sy = cy + (gy-cy)/k + z*dy*strength
    c = cv2.remap(img, sx, sy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT_101)
    a = cv2.remap(alpha, sx, sy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    return c, a

def render(plate,out,frames,path,focus=(0.5,0.5),size=(1920,1080),
           strength=420.0,crop=0.74,fps=24,nlayer=6):
    img=cv2.imread(plate).astype(np.float32); d=pflow.depth_of(plate)
    L=build_layers(img,d,nlayer)
    H,W=img.shape[:2]; cw,ch=int(W*crop),int(H*crop); x0,y0=(W-cw)//2,(H-ch)//2
    # background fill: heavily blurred plate, so disocclusions never show black
    bg=cv2.GaussianBlur(img,(0,0),24)
    p=subprocess.Popen(["ffmpeg","-y","-loglevel","error","-f","rawvideo","-pix_fmt","bgr24",
        "-s","%dx%d"%size,"-r",str(fps),"-i","-","-c:v","libx264","-preset","veryfast",
        "-crf","17","-pix_fmt","yuv420p",out],stdin=subprocess.PIPE)
    t0=time.time()
    for f in range(frames):
        t=pflow.ease(f/max(frames-1,1))
        dx,dy,dz=[a+(b-a)*t for a,b in path]
        acc = warp_layer(bg, np.ones((H,W),np.float32), 0.0, dx,dy,dz,focus,strength)[0]
        for z,al in L:
            c,a = warp_layer(img, al, z, dx,dy,dz, focus, strength)
            a3 = a[...,None]
            acc = acc*(1.0-a3) + c*a3
        fr = np.clip(acc,0,255).astype(np.uint8)[y0:y0+ch, x0:x0+cw]
        p.stdin.write(cv2.resize(fr,size,interpolation=cv2.INTER_AREA).tobytes())
    p.stdin.close(); p.wait()
    return time.time()-t0

if __name__=="__main__":
    for tag,s,lat,dz,nl in [("L1",520,0.95,0.18,6),("L2",800,1.40,0.22,8)]:
        el=render("/home/user/lf/land38/S19.png","ly_%s.mp4"%tag,48,
                  path=[(-lat/2,lat/2),(0.18,-0.14),(0.0,dz)],focus=(0.42,0.62),
                  strength=s,nlayer=nl)
        print("%s %.1fs (%.2f s/f)"%(tag,el,el/48),flush=True)
