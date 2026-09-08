# -*- coding: utf-8 -*-
"""[CEO-83 / 교훈 212·213] ★렌더된 프레임에서 앵커를 픽셀로 직독한다.★

왜 pixel_check.py 로는 안 되는가
--------------------------------
pixel_check.py 의 마스크는 `(sat>=55) | ((lum>=170)&(sat<=40))` 다.
이것은 「밝은 종이 아무거나」를 잡는다. v6 에서는 종이가 두 등급으로 갈라졌다:
    앵커  DOC_ANCHOR_C = 0.940  (밝다)
    이웃  DOC_W        = 0.280  (어둡다)
그래서 「가장 밝은 무채색 덩어리 = 앵커」라는 ★더 강한 가정★ 을 쓸 수 있고,
그 가정이 성립하는지 자체가 축①(대비) 의 렌더 검증이 된다.
반대로 앵커가 아닌 것이 가장 밝게 잡히면 그것이 곧 ★결함 보고★ 다.

계측 3종
--------
  A. 앵커 화면 점유   maxside/W          (G6/G9 하한 0.14 / 비교용)
  B. 앵커 vs 2등 휘도  L1 / L2           (축① — 클수록 앵커가 고립됐다)
  C. 이웃이 배경에 묻혔는지  L2 vs 책상 휘도 (recolor.py N4 배제 근거의 렌더 확인)

실행:  cd <프레임 디렉터리> && python3 anchorpx.py
"""
import numpy as np, glob, os, sys
from PIL import Image

ANCHOR_FRAC_MIN = 0.14     # G6 하한과 동일
ISOLATION_MIN   = 1.35     # 앵커 휘도 / 2등 휘도.  DOC 0.94 vs 0.28 이면 렌더 후에도 넉넉
MINPX           = 300


def blobs(mask, minpx=MINPX):
    """scipy 가 없으므로 손으로 flood fill (교훈: 샌드박스 실측)."""
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


def main(pat="J_*.png"):
    files = sorted(glob.glob(pat))
    if not files:
        print("프레임 PNG 가 없다: %s" % pat); return 1
    print("=== 앵커 픽셀 직독 (v6) — 가장 밝은 무채색 덩어리 = 앵커 가정 ===")
    print("%-22s %8s %8s %8s %8s %7s" % ("frame", "frac", "L(앵커)", "L(2등)", "고립비", "판정"))
    bad = []
    for f in files:
        im = np.asarray(Image.open(f).convert("RGB")).astype(np.float64)
        H, W, _ = im.shape
        lum = im.mean(axis=2)
        sat = im.max(axis=2) - im.min(axis=2)
        # 무채색 + 「종이급」 밝기.  임계를 낮게 열어 어두운 이웃도 함께 잡는다.
        mask = (sat <= 45) & (lum >= 95)
        bl = blobs(mask)
        if not bl:
            print("%-22s %8s ★덩어리 없음★" % (f, "-"))
            bad.append((f, "no blob")); continue
        # 각 덩어리의 평균 휘도로 재정렬 -> 「가장 밝은」 덩어리를 앵커로 본다
        rated = []
        for n, x0, y0, x1, y1 in bl:
            sub = lum[y0:y1+1, x0:x1+1]
            sm  = mask[y0:y1+1, x0:x1+1]
            L = float(sub[sm].mean()) if sm.any() else 0.0
            rated.append((L, n, x0, y0, x1, y1))
        rated.sort(reverse=True)
        L1, n1, x0, y0, x1, y1 = rated[0]
        L2 = rated[1][0] if len(rated) > 1 else 0.0
        frac = max(x1-x0+1, y1-y0+1) / float(W)
        iso  = (L1 / L2) if L2 > 0 else 99.9
        ok = (frac >= ANCHOR_FRAC_MIN) and (iso >= ISOLATION_MIN)
        print("%-22s %8.3f %8.1f %8.1f %8.2f %7s"
              % (f, frac, L1, L2, iso, "OK" if ok else "★FAIL★"))
        if not ok:
            bad.append((f, "frac %.3f iso %.2f" % (frac, iso)))
    print()
    if bad:
        print("★결함 %d 건★" % len(bad))
        for f, why in bad:
            print("   %s : %s" % (f, why))
        return 1
    print("ANCHOR PIXEL OK  (frac >= %.2f / 고립비 >= %.2f)" % (ANCHOR_FRAC_MIN, ISOLATION_MIN))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "J_*.png"))
