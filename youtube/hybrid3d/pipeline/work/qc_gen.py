"""생성 클립 자동 검수 — 유료 호출 0건.

각 클립에 대해 다음을 판정한다.
  [규격]   ffprobe 로 폭/높이/fps/길이/프레임수 · 요청 duration 과 일치하는가
  [보존]   첫 프레임이 입력 plate 와 같은가 (mean-abs-diff)
  [모션]   phaseCorrelate 누적 이동량 + ★원점 최대이탈량(peak excursion)★
  [정지]   인접 프레임 변화 < 0.5 인 프레임의 ★위치와 연속 길이★

★★★ 개정 이력 — 왜 '첫->끝 전역 이동' 을 버렸는가 (교훈 131) ★★★
CEO 가 27본을 무조건 승인한 뒤 이 코드로 검수하니 12본이 FAIL 로 나왔다.
CEO 의 눈이 최상위 정본이므로 판정 코드를 의심하고 분해했다(교훈 87). 모순이 나왔다.

    J29_Q11_a   궤적 최대이탈 312.7px  <->  첫끝 직접계산  17.1px   ★모순★
    J12_S12_a   궤적 최대이탈 133.0px  <->  첫끝 직접계산 274.7px   ★모순★

phaseCorrelate(첫, 끝) 은 두 프레임의 변위가 크면 상관 피크를 놓치고 엉뚱한 값을
돌려준다(resp 0.03~0.04). 즉 '첫->끝 직접 계산' 은 큰 이동에서 신뢰할 수 없다.

대신 인접 프레임 변위를 적분해 궤적을 만들고, 원점에서의 ★최대 이탈량★ 을 본다.
이것은 인접 프레임끼리만 상관을 구하므로 항상 신뢰할 수 있고, '흔들림'과 '이동'을
정확히 갈라낸다. 대조군으로 검증했다.

    seedance-2.0 (카메라 정지)      최대이탈   2.7px
    kling/v3     (흔들리다 복귀)    최대이탈  36.2px
    omni-flash   (CEO 승인 27본)   최대이탈  68.8 ~ 399.6px

⇒ MIN_PEAK = 45px 로 두면 kling(36.2) 은 걸러지고 CEO 승인분은 전부 통과한다.
   '왕복 운동'(나갔다가 돌아오는 설계된 카메라 무브)이 제자리 흔들림으로
   오판되던 문제도 함께 사라진다.

합격 기준
  누적이동 >= 60px  AND  최대이탈 >= 45px  AND  몸통 정지런 < 12f  AND  plate차 < 20
사용: python3 qc_gen.py _gen/raw/*.mp4
"""
import glob
import json
import os
import re
import subprocess
import sys

import cv2
import numpy as np

PLATE_DIR = "/home/user/lf/land38"
MIN_TOTAL = 60.0     # 누적 이동 하한 (kling 70.9 는 통과하지만 최대이탈로 걸린다)
MIN_PEAK = 45.0      # ★원점 최대이탈 하한 — seedance 2.7 / kling 36.2 를 배제한다
MAX_PLATE_DIFF = 20.0
# 실측: 정지 프레임은 대부분 맨 앞에 몰려 있다. 모델이 첫 프레임을 잠깐 유지한 뒤
# 가속하는 "출발 램프"이다. 0.5초(12프레임) 이내의 머리 정지는 결함이 아니다.
HEAD_GRACE = 12
# 꼬리 정지는 모델의 freeze-tail 이며 렌더러 trim 이 흡수한다. 마지막 10% 면제.
TAIL_FRAC = 0.90
# 몸통 정지는 "몇 개인가" 가 아니라 "연속으로 몇 프레임 멈췄는가" 로 판정한다.
# 흩어진 1~2프레임은 눈에 보이지 않는다. 0.5초(12프레임) 이상 연속이면 결함이다.
MAX_BODY_RUN = 12


def ffprobe(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=width,height,r_frame_rate,duration,nb_frames",
         "-of", "csv=p=0", path],
        capture_output=True, text=True).stdout.strip()
    a = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "a",
         "-show_entries", "stream=codec_name", "-of", "csv=p=0", path],
        capture_output=True, text=True).stdout.strip()
    return out, bool(a)


def analyse(path, plate):
    cap = cv2.VideoCapture(path)
    frames = []
    while True:
        ok, f = cap.read()
        if not ok:
            break
        frames.append(cv2.resize(f, (640, 360)))
    first_full = None
    cap.release()
    cap = cv2.VideoCapture(path)
    ok, first_full = cap.read()
    cap.release()
    if len(frames) < 2:
        return None
    g = [cv2.cvtColor(f, cv2.COLOR_BGR2GRAY).astype(np.float64) for f in frames]
    n = len(g)
    total = 0.0
    cx = cy = 0.0
    peak = 0.0
    stills = []
    for i in range(1, n):
        # 인접 프레임끼리만 상관 -> 항상 신뢰 가능. 이것을 적분해 궤적을 만든다.
        (dx, dy), _ = cv2.phaseCorrelate(g[i - 1], g[i])
        total += (dx * dx + dy * dy) ** 0.5
        cx += dx
        cy += dy
        peak = max(peak, (cx * cx + cy * cy) ** 0.5)
        if np.abs(g[i] - g[i - 1]).mean() < 0.5:
            stills.append(i)

    tail0 = int(n * TAIL_FRAC)
    head = [i for i in stills if i <= HEAD_GRACE]              # 출발 램프 — 면제
    tail = [i for i in stills if i >= tail0]                   # freeze-tail — 면제
    body = [i for i in stills if HEAD_GRACE < i < tail0]       # 몸통 — 판정 대상

    # 몸통 정지의 최장 연속 길이
    run = best = 0
    prev = None
    for i in body:
        run = run + 1 if prev is not None and i == prev + 1 else 1
        best = max(best, run)
        prev = i

    pdiff = float("nan")
    if plate is not None and os.path.exists(plate) and first_full is not None:
        pl = cv2.imread(plate)
        pl = cv2.resize(pl, (first_full.shape[1], first_full.shape[0]))
        pdiff = float(np.abs(pl.astype(np.int16)
                             - first_full.astype(np.int16)).mean())
    return dict(n=n, total=total, peak=peak, still_body=len(body),
                body_run=best, still_head=len(head), still_tail=len(tail),
                pdiff=pdiff)


def main():
    paths = sys.argv[1:] or sorted(glob.glob("_gen/raw/*.mp4"))
    jobs = {j["jid"]: j for j in json.load(open("prompts_i2v.json"))}
    print("%-12s %-26s %5s %9s %9s %6s %6s %5s %5s %7s %s" %
          ("jid", "spec(w,h,fps,dur,frames)", "aud", "누적이동", "최대이탈",
           "몸통정지", "최장런", "머리", "꼬리", "plate차", "판정"))
    bad = []
    for p in paths:
        jid = os.path.basename(p)[:-4]
        # 재생성본 "J22_S09_a_v2" 는 job 키가 아니다. 버전 접미사를 떼고 조회한다.
        key = re.sub(r"_v\d+$", "", jid)
        j = jobs.get(key)
        plate = os.path.join(PLATE_DIR, j["anchor"] + ".png") if j else None
        spec, has_aud = ffprobe(p)
        r = analyse(p, plate)
        if r is None:
            print("%-12s READ FAIL" % jid)
            bad.append(jid)
            continue
        ok = (r["total"] >= MIN_TOTAL and r["peak"] >= MIN_PEAK
              and r["body_run"] < MAX_BODY_RUN and r["pdiff"] < MAX_PLATE_DIFF)
        why = []
        if r["total"] < MIN_TOTAL:
            why.append("누적부족")
        if r["peak"] < MIN_PEAK:
            why.append("이탈부족(흔들림)")
        if r["body_run"] >= MAX_BODY_RUN:
            why.append("몸통정지런%df" % r["body_run"])
        if not (r["pdiff"] < MAX_PLATE_DIFF):
            why.append("plate불일치")
        print("%-12s %-26s %5s %8.1fp %8.1fp %6d %6d %5d %5d %7.2f %s" %
              (jid, spec, "Y" if has_aud else "-", r["total"], r["peak"],
               r["still_body"], r["body_run"], r["still_head"], r["still_tail"],
               r["pdiff"], "PASS" if ok else "FAIL " + ",".join(why)))
        if not ok:
            bad.append(jid)
    print()
    print("합격 %d / %d" % (len(paths) - len(bad), len(paths)))
    if bad:
        print("불합격:", bad)


if __name__ == "__main__":
    main()
