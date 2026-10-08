"""정지 프레임이 '어디에' 있는지 본다.

끝에 몰려 있으면 모델의 freeze-tail 이고 렌더러 trim 이 흡수한다.
중간에 흩어져 있으면 진짜 모션 결함이다. (교훈 87: 실패 판정 전에 판정 코드를 의심한다)
"""
import sys

import cv2
import numpy as np

for path in sys.argv[1:]:
    cap = cv2.VideoCapture(path)
    g = []
    while True:
        ok, f = cap.read()
        if not ok:
            break
        g.append(cv2.cvtColor(cv2.resize(f, (640, 360)),
                              cv2.COLOR_BGR2GRAY).astype(np.float64))
    cap.release()
    n = len(g)
    d = [float(np.abs(g[i] - g[i - 1]).mean()) for i in range(1, n)]
    idx = [i for i, v in enumerate(d, start=1) if v < 0.5]
    print("%-14s frames=%d  정지=%d  위치=%s  (끝에서 %s)"
          % (path.split("/")[-1], n, len(idx), idx,
             [n - 1 - i for i in idx]))
    print("   마지막 6프레임 변화량:", ["%.2f" % v for v in d[-6:]])
    print("   최소 변화량 5개:", sorted("%.3f" % v for v in sorted(d)[:5]))
