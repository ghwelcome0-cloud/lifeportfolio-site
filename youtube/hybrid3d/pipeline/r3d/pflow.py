"""depth-driven 3D parallax renderer -- no GPU, no GL, pure numpy+cv2.
Article 14 clause 13: motion must live INSIDE the cut, with real parallax."""
import numpy as np, cv2, os, sys, time, subprocess

def depth_of(plate, cache="_dcache"):
    os.makedirs(cache, exist_ok=True)
    key = os.path.join(cache, os.path.basename(plate).replace(".png","_d.npy"))
    if os.path.exists(key): return np.load(key)
    import onnxruntime as ort
    s = ort.InferenceSession("/home/user/lf/r3d/dav2s.onnx", providers=["CPUExecutionProvider"])
    i, o = s.get_inputs()[0], s.get_outputs()[0]
    img = cv2.imread(plate); H, W = img.shape[:2]
    N = 518
    x = cv2.resize(img,(N,N),interpolation=cv2.INTER_AREA)[:,:,::-1].astype(np.float32)/255.0
    x = (x - np.array([.485,.456,.406],np.float32)) / np.array([.229,.224,.225],np.float32)
    d = np.squeeze(s.run([o.name],{i.name:np.transpose(x,(2,0,1))[None]})[0])
    d = cv2.resize(d.astype(np.float32),(W,H),interpolation=cv2.INTER_CUBIC)
    d = (d - d.min())/(d.max()-d.min()+1e-9)          # 0 far .. 1 near
    d = cv2.bilateralFilter(d, 9, 0.10, 12)           # keep edges, kill banding
    np.save(key, d); return d

def warp(img, d, dx, dy, dz, focus=(0.5,0.5), strength=110.0):
    """dx,dy: lateral camera shift in normalized units. dz: dolly-in amount.
    Near pixels move MORE than far pixels -> genuine parallax, not affine."""
    H, W = img.shape[:2]
    gx, gy = np.meshgrid(np.arange(W,dtype=np.float32), np.arange(H,dtype=np.float32))
    cx, cy = focus[0]*W, focus[1]*H
    # per-pixel disparity: proportional to depth
    disp = d.astype(np.float32)
    # lateral parallax
    mx = disp * dx * strength
    my = disp * dy * strength
    # dolly: radial expansion scaled by depth (near grows faster)
    k = 1.0 + dz * (0.35 + 0.85*disp)
    sx = cx + (gx - cx)/k + mx
    sy = cy + (gy - cy)/k + my
    out = cv2.remap(img, sx, sy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT_101)
    return out

def ease(t):  # smootherstep
    return t*t*t*(t*(t*6-15)+10)

def render(plate, out, frames, path, focus=(0.5,0.5), size=(1920,1080),
           strength=110.0, crop=0.90, fps=24):
    img = cv2.imread(plate); d = depth_of(plate)
    H, W = img.shape[:2]
    cw, ch = int(W*crop), int(H*crop)
    x0, y0 = (W-cw)//2, (H-ch)//2
    p = subprocess.Popen(
        ["ffmpeg","-y","-loglevel","error","-f","rawvideo","-pix_fmt","bgr24",
         "-s","%dx%d"%(size[0],size[1]),"-r",str(fps),"-i","-",
         "-c:v","libx264","-preset","veryfast","-crf","17","-pix_fmt","yuv420p",out],
        stdin=subprocess.PIPE)
    t0=time.time()
    for f in range(frames):
        t = ease(f/max(frames-1,1))
        dx, dy, dz = [a+(b-a)*t for a,b in path]
        fr = warp(img, d, dx, dy, dz, focus, strength)
        fr = fr[y0:y0+ch, x0:x0+cw]
        p.stdin.write(cv2.resize(fr, size, interpolation=cv2.INTER_AREA).tobytes())
    p.stdin.close(); p.wait()
    return time.time()-t0

if __name__ == "__main__":
    el = render("/home/user/lf/land38/S19.png", "pf_S19.mp4", 72,
                path=[(-0.35,0.30),(0.10,-0.06),(0.00,0.26)], focus=(0.42,0.62))
    print("RENDER %.1fs for 72f (%.2f s/frame)"%(el, el/72), flush=True)
