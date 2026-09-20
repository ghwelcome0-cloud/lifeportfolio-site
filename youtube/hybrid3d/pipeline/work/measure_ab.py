"""A/B 계측 — 교훈 121 의 방법을 그대로 적용한다.

640x360 으로 정규화한 뒤
  (1) phaseCorrelate 로 인접 프레임 사이 이동량을 누적한다  = 카메라가 실제로 움직인 총 거리
  (2) 첫 프레임 -> 마지막 프레임 의 전역 이동량            = 카메라가 최종적으로 옮겨간 거리
  (3) 인접 샘플 프레임의 평균 절대 차분                     = 화면이 바뀐 정도 (0 이면 정지)
누적 이동량이 측정 노이즈(<1px)면 그 모델은 카메라를 움직이지 않은 것이다.
"""
import sys
import cv2
import numpy as np


def probe(path):
    cap = cv2.VideoCapture(path)
    frames = []
    while True:
        ok, f = cap.read()
        if not ok:
            break
        frames.append(cv2.resize(f, (640, 360)))
    cap.release()
    if len(frames) < 2:
        return None
    g = [cv2.cvtColor(f, cv2.COLOR_BGR2GRAY).astype(np.float64) for f in frames]

    # (1) 누적 이동량
    total = 0.0
    for i in range(1, len(g)):
        (dx, dy), _ = cv2.phaseCorrelate(g[i - 1], g[i])
        total += (dx * dx + dy * dy) ** 0.5

    # (2) 첫->끝 전역 이동
    (gx, gy), resp = cv2.phaseCorrelate(g[0], g[-1])

    # (3) 프레임 변화량 (5개 샘플)
    idx = np.linspace(0, len(g) - 2, 5).astype(int)
    diffs = [float(np.abs(g[i + 1] - g[i]).mean()) for i in idx]

    # (4) 정지 프레임 개수 (변화 < 0.5)
    still = 0
    for i in range(1, len(g)):
        if np.abs(g[i] - g[i - 1]).mean() < 0.5:
            still += 1

    return dict(n=len(frames), total=total, gx=gx, gy=gy, resp=resp,
                diffs=diffs, still=still)


LABEL = {
    "_i2v720/A4-04.mp4": "seedance A4-04",
    "_i2v720/A4-15.mp4": "seedance A4-15",
    "_i2v720/A6-10.mp4": "seedance A6-10",
    "_pilot/pilot_S23.mp4": "omni-flash S23",
    "_pilot/ab_kling.mp4": "kling/v3  S23",
}

if __name__ == "__main__":
    args = sys.argv[1:] or list(LABEL)
    print("%-16s %6s %10s %18s %10s %6s" %
          ("model", "frames", "누적이동", "첫-끝이동", "프레임변화", "정지")) 
    for p in args:
        r = probe(p)
        if r is None:
            print("%-16s  READ FAIL" % LABEL.get(p, p))
            continue
        print("%-16s %6d %9.1fpx (%6.1f,%6.1f) resp=%.3f %9.1f %6d" %
              (LABEL.get(p, p), r["n"], r["total"], r["gx"], r["gy"],
               r["resp"], float(np.mean(r["diffs"])), r["still"]))
