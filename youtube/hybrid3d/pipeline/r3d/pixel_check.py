import numpy as np, glob, os
from PIL import Image

def blobs(mask, minpx=300):
    H, W = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    out = []
    ys, xs = np.nonzero(mask)
    for y0, x0 in zip(ys, xs):
        if seen[y0, x0]:
            continue
        st = [(y0, x0)]; seen[y0, x0] = True
        miny = maxy = y0; minx = maxx = x0; n = 0
        while st:
            y, x = st.pop(); n += 1
            if y < miny: miny = y
            if y > maxy: maxy = y
            if x < minx: minx = x
            if x > maxx: maxx = x
            for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
                ny, nx = y+dy, x+dx
                if 0 <= ny < H and 0 <= nx < W and mask[ny,nx] and not seen[ny,nx]:
                    seen[ny,nx] = True; st.append((ny,nx))
        if n >= minpx:
            out.append((n, minx, miny, maxx, maxy))
    out.sort(reverse=True)
    return out

files = sorted(glob.glob("J_*.png"))
jobs = {}
for f in files:
    im = np.asarray(Image.open(f).convert("RGB")).astype(np.int16)
    H, W, _ = im.shape
    lum = im.mean(axis=2)
    # 종이(밝은 중성면) 후보: 밝고 채도 낮음
    sat = im.max(axis=2) - im.min(axis=2)
    # ★교훈 212★ 마스크가 대상의 색을 전제하면 픽셀 직독도 거짓말한다.
    # DOC_N/DOC_W 는 무채색이지만 DOC_A/B/C 는 채색이다(마젠타/틸/앰버).
    # 환경(ENV_*)은 전부 저채도이고 어둡다 -> 두 갈래로 나눠 잡는다.
    mask = (sat >= 55) | ((lum >= 170) & (sat <= 40))
    bl = blobs(mask)
    j = f.split("_p")[0]
    tot = mask.sum() / float(H*W)
    if bl:
        n, x0, y0, x1, y1 = bl[0]
        bw = (x1-x0+1); bh = (y1-y0+1)
        frac = max(bw, bh) / float(W)
        fill = n / float(bw*bh)
        jobs.setdefault(j, []).append(frac)
        print("%-26s blobs=%-3d  top: %6dpx  bbox %4dx%-4d  maxside/W=%.3f  fill=%.2f  brightArea=%.3f"
              % (f, len(bl), n, bw, bh, frac, fill, tot))
    else:
        jobs.setdefault(j, []).append(0.0)
        print("%-26s blobs=0   ★밝은 덩어리 없음★  brightArea=%.3f" % (f, tot))

print()
print("=== 컷별 최대 주연 화면 점유 (maxside/W) — G6 하한 0.14 ===")
ok = 0
for j in sorted(jobs):
    v = jobs[j]; best = max(v)
    flag = "OK " if best >= 0.14 else "★FAIL★"
    if best >= 0.14: ok += 1
    print("  %-10s p5=%.3f p50=%.3f p95=%.3f  best=%.3f  %s" % (j, v[0], v[1], v[2], best, flag))
print("  => %d / %d 컷 통과" % (ok, len(jobs)))
