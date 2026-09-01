"""38 job 의 채택본을 확정하고 1920x1080 으로 업스케일해 seg/ 에 배치한다.

채택 규칙 — 같은 jid 에 v2/v3 가 있으면 QC 를 통과한 최신 판을 쓴다.
  J22_S09_a -> _v2   (원본 최대이탈 26.4px = 흔들림)
  J28_S03_a -> _v3   (_v2 는 4.6~5.6초 1.08초 정지 · 이음새 결함)
  J38_Q06_a -> _v2   (원본 누적 25.6px)
  J42_S13_a -> _v2   (원본 누적 38.7px)

업스케일 — omni-flash 는 1280x720 이고 aac 트랙이 붙어 있다(교훈 126·129).
렌더러는 1920x1080 무음을 전제하므로 lanczos 업스케일 + -an 으로 오디오를 버린다.

배치 — 제9조: 생성 클립은 /home/user/lf/land38/seg/i2v_<sid>.mp4 에 둔다.
한 job 이 여러 sid 를 덮는 경우(run 묶기, 교훈 119) 그 job 의 클립을 각 sid 로
잘라 넣는다. 잘라 넣는 구간은 prompts_i2v.json 의 t0/t1 을 job 시작점으로
정규화해 계산한다.

★교훈 132 — 렌더러가 소스를 다시 자른다★
대상 57 sid 는 전부 shots38 의 ss=0.05 를 갖는다. drive38 의 i2v 분기는
A.trim(src, r["ss"], dur, ...) 로 소스의 0.05초 지점부터 dur 만큼 읽고,
게다가 "clip too short" 게이트가 소스 길이에 2프레임의 여유를 요구한다.
따라서 sid 구간을 정확히 dur 만큼만 잘라 넣으면 렌더러 단계에서 반드시
길이가 부족해진다. 슬라이스에 앞 0.05초 + 뒤 여유를 함께 담는다.
"""
import json
import os
import subprocess
import sys

RAW = "_gen/raw"
SEG = "/home/user/lf/land38/seg"
W, H, FPS = 1920, 1080, 24

OVERRIDE = {
    "J22_S09_a": "J22_S09_a_v2",
    "J28_S03_a": "J28_S03_a_v3",
    "J38_Q06_a": "J38_Q06_a_v2",
    "J42_S13_a": "J42_S13_a_v2",
}


def src_of(jid):
    return os.path.join(RAW, OVERRIDE.get(jid, jid) + ".mp4")


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print("FAIL:", " ".join(cmd[:8]), "...")
        print(r.stderr[-1200:])
        sys.exit(1)


def main():
    jobs = json.load(open("prompts_i2v.json"))
    os.makedirs(SEG, exist_ok=True)
    made = []
    for j in jobs:
        jid = j["jid"]
        src = src_of(jid)
        if not os.path.exists(src):
            print("MISSING", jid, src)
            sys.exit(1)
        sids = j["sids"]
        t0 = j["t0"]
        # 각 sid 의 절대 구간을 job 시작점 기준 상대 구간으로 옮긴다.
        for sid in sids:
            row = SIDSPAN[sid]
            ss = max(0.0, row[0] - t0)
            dur = row[1] - row[0]
            # 렌더러가 ss(=0.05) 만큼 다시 건너뛰고 2프레임의 여유를 요구하므로
            # 앞으로 당길 수 있는 만큼 당기고 뒤에 여유를 붙여 담는다.
            lead = min(RSS[sid], ss)
            ss -= lead
            take = dur + lead + PAD
            out = os.path.join(SEG, "i2v_%s.mp4" % sid)
            cmd = [
                "ffmpeg", "-y", "-v", "error",
                "-ss", "%.3f" % ss, "-i", src,
                "-t", "%.3f" % take,
                "-vf", "scale=%d:%d:flags=lanczos,fps=%d" % (W, H, FPS),
                "-an",
                "-c:v", "libx264", "-preset", "medium", "-crf", "17",
                "-pix_fmt", "yuv420p",
                out,
            ]
            run(cmd)
            made.append((sid, jid, ss, take, os.path.getsize(out)))
    print("배치 완료 %d 개" % len(made))
    for sid, jid, ss, take, sz in made:
        print("  i2v_%-6s <- %-14s ss=%5.2f take=%5.2f %7.2f MB"
              % (sid, jid, ss, take, sz / 1e6))


if __name__ == "__main__":
    import shots38 as shots
    SIDSPAN = {r["sid"]: (r["t0"], r["t1"]) for r in shots.TABLE38}
    RSS = {r["sid"]: r["ss"] for r in shots.TABLE38}
    PAD = 0.20          # 렌더러의 2프레임 여유 게이트(0.083s) 보다 넉넉하게
    main()
