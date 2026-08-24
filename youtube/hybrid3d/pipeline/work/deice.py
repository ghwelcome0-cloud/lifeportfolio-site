"""프리즈 제거 리타이밍 — 유료 재생성 0건으로 몸통 정지를 없앤다.

배경 (이번 세션):
  J28_S03_a_v2 는 진폭 강화가 성공했으나(이탈 10.7p -> 105.4p) 클립 중반
  4.6초 지점에 18프레임(0.75초) 연속 정지가 생겼다. 재생성하면 유료 1회이고
  진폭이 다시 약해질 위험이 있다(반려 사이클 = 최대 비용, 교훈 84).

원리:
  정지 프레임은 직전 프레임과 화소가 사실상 같다. 따라서 ★버려도 점프가 생기지
  않는다.★ 버린 뒤 남은 프레임을 원래 길이에 다시 펼치고 minterpolate 로
  24fps 를 복원하면 프리즈만 사라진 같은 길이의 클립이 된다.

  drop  -> N' 프레임
  펼침  -> setpts 로 N'/24 초를 목표 duration 으로 확대
  복원  -> minterpolate=fps=24:mi_mode=mci (움직임 보상 보간)

사용:
  python3 deice.py _gen/raw/J28_S03_a_v2.mp4 _gen/fix/J28_S03_a_v2.mp4
"""
import os
import subprocess
import sys

import cv2
import numpy as np

STILL_TH = 0.5      # qc_gen 과 동일한 정지 임계
HEAD_KEEP = 12      # 출발 램프는 보존한다 (교훈 128/133) — 자연스러운 이징
TAIL_FRAC = 0.90    # 꼬리 정지는 렌더러 trim 이 흡수하므로 건드리지 않는다


def still_frames(path):
    cap = cv2.VideoCapture(path)
    prev = None
    idx = 0
    stills = []
    total = 0
    while True:
        ok, fr = cap.read()
        if not ok:
            break
        g = cv2.cvtColor(cv2.resize(fr, (640, 360)), cv2.COLOR_BGR2GRAY).astype(np.float64)
        if prev is not None:
            if np.abs(g - prev).mean() < STILL_TH:
                stills.append(idx)
        prev = g
        idx += 1
        total = idx
    cap.release()
    tail0 = int(total * TAIL_FRAC)
    body = [i for i in stills if HEAD_KEEP < i < tail0]
    return total, body


def probe_dur(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=duration", "-of", "csv=p=0", path],
        capture_output=True, text=True).stdout.strip()
    return float(out)


def main():
    src, dst = sys.argv[1], sys.argv[2]
    n, body = still_frames(src)
    dur = probe_dur(src)
    keep = n - len(body)
    print("frames %d  몸통정지 %d  잔존 %d  목표길이 %.6fs" % (n, len(body), keep, dur))
    if not body:
        print("제거할 프레임이 없다. 원본을 그대로 쓴다.")
        return 1
    # 버릴 프레임을 select 로 배제한다. 인접 동일 화소이므로 점프가 없다.
    drop = "+".join("eq(n\\,%d)" % i for i in body)
    scale = dur / (keep / 24.0)
    vf = ("select='not(%s)',setpts=(N/24/%.9f)/TB,"
          "minterpolate=fps=24:mi_mode=mci:mc_mode=aobmc:vsbmc=1"
          % (drop, 1.0 / scale))
    os.makedirs(os.path.dirname(dst) or ".", exist_ok=True)
    cmd = ["ffmpeg", "-y", "-v", "error", "-i", src, "-vf", vf,
           "-an", "-c:v", "libx264", "-crf", "17", "-pix_fmt", "yuv420p", dst]
    print("확대율 %.4f  ->  %s" % (scale, dst))
    r = subprocess.run(cmd)
    return r.returncode


if __name__ == "__main__":
    sys.exit(main())
