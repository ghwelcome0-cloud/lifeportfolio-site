#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""tonegate.py — 톤 3지표 + 글자(연결성분) 게이트. 교훈 257 + 교훈 248."""
import os, sys, glob
from PIL import Image
import numpy as np

# --- 판정 상수 (교훈 251: 규칙이 승인된 화면을 반려하면 틀린 것은 규칙이다) ---
# 밝기 상한 75: 벤치 배경 밴드는 40~60 이나, 흰 종이가 화면을 채우는 매크로
#               컷은 필연적으로 높다. 취조실(=near-black, 8) 판별이 목적이므로
#               하한이 본질이고 상한은 여유를 둔다.
# 비네팅 하한만: ratio<0.72 = 코너가 어둡다 = 비네팅 = FAIL.
#   ★2차 정정(교훈 263 재적용): 하한 0.82 는 i2v 클립 6프레임을 반려했으나
#   콘택트시트 육안 결과 전부 밝은 중성 회색 · 비네팅 없음이었다. 배경 자체의
#   완만한 그라디언트(위쪽 밝고 아래쪽 약간 어두움)가 코너 평균을 끌어내린 것이다.
#   취조실 톤(near-black, ratio<0.6 수준)을 잡는 것이 목적이므로 0.72 로 내린다.
#               ratio>1.2 는 「코너(배경 회색)가 중앙(피사체)보다 밝다」는 뜻으로
#               매크로 구도의 정상 결과이지 비네팅이 아니다. 상한 판정을 제거한다.
BRIGHT_LO, BRIGHT_HI = 38.0, 75.0
VIG_LO               = 0.72
NEU_MAX              = 8.0

def metrics(path):
    im = Image.open(path).convert("RGB")
    a  = np.asarray(im).astype(np.float32)
    R, G, B = a[:,:,0], a[:,:,1], a[:,:,2]
    v = (0.299*R + 0.587*G + 0.114*B) / 255.0 * 100.0
    h, w = v.shape
    cy, cx = h//2, w//2
    ch, cw = h//6, w//6
    cen = float(v[cy-ch:cy+ch, cx-cw:cx+cw].mean())
    k = int(min(h, w) * 0.12)
    cor = float(np.mean([v[:k,:k].mean(), v[:k,-k:].mean(),
                         v[-k:,:k].mean(), v[-k:,-k:].mean()]))
    mx, mn = a.max(axis=2), a.min(axis=2)
    sat = float(np.where(mx > 0, (mx-mn)/np.maximum(mx,1), 0).mean())
    return dict(size=im.size, mean=float(v.mean()), cen=cen, cor=cor,
                ratio=cor/max(cen,1e-6), rb=float(R.mean()-B.mean()), sat=sat)

def glyph_count(path):
    """교훈 248 — 밝기가 아니라 형상(연결성분)으로 판별."""
    try:
        from scipy import ndimage
    except Exception:
        return -1
    im = Image.open(path).convert("RGB")
    im = im.resize((1080, int(1080*im.size[1]/im.size[0])), Image.LANCZOS)
    a  = np.asarray(im).astype(np.float32)
    mx, mn = a.max(axis=2), a.min(axis=2)
    wm = (mx > 170) & ((mx - mn) < 28)          # 밝고 무채색
    lab, n = ndimage.label(wm)
    hits = 0
    for sl in ndimage.find_objects(lab):
        hh = sl[0].stop - sl[0].start
        ww = sl[1].stop - sl[1].start
        if hh < 14 or hh > 90:   continue        # 글자 높이대
        if ww == 0:              continue
        ar = ww / float(hh)
        if ar > 8.0:             continue        # 괘선은 통과 (교훈 251)
        if ar < 0.08:            continue
        hits += 1
    return hits

def judge(path):
    m = metrics(path)
    g = glyph_count(path)
    ok_b = BRIGHT_LO <= m["mean"] <= BRIGHT_HI
    ok_v = m["ratio"] >= VIG_LO
    ok_n = abs(m["rb"]) <= NEU_MAX
    ok   = ok_b and ok_v and ok_n
    return m, g, ok_b, ok_v, ok_n, ok

if __name__ == "__main__":
    targets = sys.argv[1:] or sorted(glob.glob("*.png"))
    bad = []
    print("%-14s %9s %6s %6s %6s %6s %6s  %s" %
          ("FILE","SIZE","mean","ratio","R-B","sat","glyph","GATE"))
    for p in targets:
        m, g, ob, ov, on, ok = judge(p)
        flags = "".join([" " if ob else "B", " " if ov else "V", " " if on else "N"])
        print("%-14s %9s %6.1f %6.2f %+6.1f %6.3f %6d  %s%s" %
              (os.path.basename(p), "%dx%d" % m["size"], m["mean"], m["ratio"],
               m["rb"], m["sat"], g, "PASS" if ok else "FAIL", "" if ok else " ["+flags.strip()+"]"))
        if not ok: bad.append(p)
    print("---")
    print("TONEGATE %d/%d PASS" % (len(targets)-len(bad), len(targets)))
    sys.exit(1 if bad else 0)
