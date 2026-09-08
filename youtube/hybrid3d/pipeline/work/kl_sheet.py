"""kling A/B 클립의 6프레임 컨택트 시트 + 첫프레임 vs plate 차분.

이동량이 적어도 '서랍 속 단면에 도달했는가' 라는 목적 달성 여부는 눈으로 봐야 한다.
교훈 117: 눈 검수 단독 판정은 금지 — 계측과 함께 본다.
"""
import cv2
import numpy as np

SRC = "_pilot/ab_kling.mp4"
PLATE = "/home/user/lf/land38/S23.png"
TS = [0.0, 2.0, 4.0, 6.0, 8.0, 9.9]

cap = cv2.VideoCapture(SRC)
fps = cap.get(cv2.CAP_PROP_FPS)
picks = []
for t in TS:
    cap.set(cv2.CAP_PROP_POS_FRAMES, int(round(t * fps)))
    ok, f = cap.read()
    if ok:
        picks.append((t, f))
cap.release()

# 첫프레임 vs plate 차분
pl = cv2.imread(PLATE)
f0 = picks[0][1]
pl_r = cv2.resize(pl, (f0.shape[1], f0.shape[0]))
d = np.abs(pl_r.astype(np.int16) - f0.astype(np.int16))
print("첫프레임 vs plate  mean-abs-diff = %.2f / 255   max channel diff = %d"
      % (d.mean(), d.max()))

# 2x3 시트, 각 640x360
cells = []
for t, f in picks:
    c = cv2.resize(f, (640, 360))
    cv2.putText(c, "%.1fs" % t, (12, 34), cv2.FONT_HERSHEY_SIMPLEX,
                1.0, (0, 0, 0), 5)
    cv2.putText(c, "%.1fs" % t, (12, 34), cv2.FONT_HERSHEY_SIMPLEX,
                1.0, (255, 255, 255), 2)
    cells.append(c)
while len(cells) < 6:
    cells.append(np.zeros((360, 640, 3), np.uint8))
sheet = np.vstack([np.hstack(cells[0:2]), np.hstack(cells[2:4]),
                   np.hstack(cells[4:6])])
cv2.imwrite("_pilot/kl_sheet.png", sheet)
print("wrote _pilot/kl_sheet.png", sheet.shape)
