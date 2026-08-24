"""FAIL 판정의 원인을 분해한다 — 교훈 87 (실패 판정 전에 판정 코드를 의심한다).

CEO-43 이 27본을 무조건 승인했는데 그 중 12본이 내 QC 에서 FAIL 로 나왔다.
CEO 의 눈이 최상위 정본이므로, 내 지표가 무엇을 놓치고 있는지 찾는다.

두 가지 가설을 검사한다.

가설 A — "제자리복귀" 오판
  첫->끝 전역 이동만 보면, '나갔다가 돌아오는' 설계된 왕복 운동
  (예: settle onto X -> pull back from Y) 이 kling 의 '제자리 흔들림'과
  구별되지 않는다.
  ⇒ 원점에서의 ★최대 이탈량(peak excursion)★ 을 같이 본다.
     kling: 누적 70.9px 인데 어느 순간에도 원점에서 멀리 못 갔을 것.
     왕복 운동: 중간에 크게 이탈했다가 돌아온다.

가설 B — "정지" 오판
  정지 프레임이 꼬리에 몰려 있으면 모델의 freeze-tail 이고,
  렌더러 trim 이 흡수한다. 몸통에 흩어져 있으면 진짜 결함이다.
  ⇒ 정지 프레임의 위치 분포를 본다.
"""
import sys, cv2, numpy as np

def probe(path):
    cap = cv2.VideoCapture(path)
    gs = []
    while True:
        ok, fr = cap.read()
        if not ok:
            break
        g = cv2.cvtColor(cv2.resize(fr, (640, 360)), cv2.COLOR_BGR2GRAY).astype(np.float64)
        gs.append(g)
    cap.release()
    n = len(gs)
    if n < 2:
        return None

    total = 0.0
    stills = []
    # 원점(첫 프레임) 기준 누적 변위를 프레임마다 적분해서 궤적을 만든다.
    cx = cy = 0.0
    excur = [0.0]
    for i in range(1, n):
        (dx, dy), _ = cv2.phaseCorrelate(gs[i - 1], gs[i])
        total += (dx * dx + dy * dy) ** 0.5
        cx += dx
        cy += dy
        excur.append((cx * cx + cy * cy) ** 0.5)
        if abs(gs[i] - gs[i - 1]).mean() < 0.5:
            stills.append(i)

    peak = max(excur)
    peak_at = int(np.argmax(excur))
    (gx, gy), _ = cv2.phaseCorrelate(gs[0], gs[-1])
    endmove = (gx * gx + gy * gy) ** 0.5

    # 정지 프레임의 위치 분포: 머리 3 / 꼬리 10% / 몸통
    tail0 = int(n * 0.90)
    head = [i for i in stills if i <= 3]
    tail = [i for i in stills if i >= tail0]
    body = [i for i in stills if i > 3 and i < tail0]
    return dict(n=n, total=total, endmove=endmove, peak=peak, peak_at=peak_at,
                head=len(head), tail=len(tail), body=len(body), body_idx=body[:12])


def main():
    print("%-12s %5s %9s %9s %9s %7s  %s"
          % ("jid", "frames", "누적", "첫끝", "최대이탈", "이탈지점", "정지 머리/꼬리/몸통"))
    for p in sys.argv[1:]:
        jid = p.split("/")[-1].replace(".mp4", "")
        r = probe(p)
        if not r:
            print("%-12s  읽기 실패" % jid)
            continue
        pct = 100.0 * r["peak_at"] / max(1, r["n"] - 1)
        print("%-12s %5d %8.1fp %8.1fp %8.1fp %5.0f%%   %d/%d/%d %s"
              % (jid, r["n"], r["total"], r["endmove"], r["peak"], pct,
                 r["head"], r["tail"], r["body"], r["body_idx"] if r["body"] else ""))


if __name__ == "__main__":
    main()
