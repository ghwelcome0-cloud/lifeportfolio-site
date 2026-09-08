"""retime+업스케일된 job 클립을 sid 별로 잘라 seg/ 에 배치한다.

전제: prep38.py 가 _gen/rt/<jid>.mp4 를 만들어 두었다.
     그 클립은 이미 1920x1080 · 24fps · 무음 · 길이 >= raw + 0.05 + 4프레임.

★슬라이스 계산 (교훈 132)★
job 시작 t0 를 원점으로 sid 구간을 잡는다:
    ss  = (sid.t0 - job.t0)      만큼 건너뛰고
    dur = (sid.t1 - sid.t0)      만큼 담는다.
그런데 렌더러 drive38.render_row 는 이 파일을 ★다시★ 자른다:
    A.trim(src, r["ss"](=0.05), dur, None, out)
게이트: r["ss"] + dur <= have - 2/24
따라서 seg 파일에는 앞으로 0.05초 + 뒤로 2프레임 이상의 여유가 필요하다.
앞 0.05초는 가능하면 소스에서 앞으로 당겨 확보하고(lead), 첫 sid 처럼 당길 수
없으면 그만큼을 뒤에서 더 담아 총 길이 요건을 맞춘다(렌더러가 앞 0.05초를 버려도
남는 길이가 dur 를 넘게 된다).

★필터 없음★ 업스케일은 prep38 에서 job 단위로 이미 끝났다. 여기서는 재인코딩만
하고 스케일링을 하지 않는다(57회 반복 업스케일 제거).
"""
import json, os, subprocess, sys
import shots38 as shots

RT = "_gen/rt"
SEG = "/home/user/lf/land38/seg"
FPS = 24
FR = 1.0 / FPS
PAD = 4 * FR          # 렌더러의 2프레임 게이트보다 넉넉하게


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print("FAIL", " ".join(cmd)[:220])
        print(r.stderr[-1200:])
        sys.exit(1)


def main():
    jobs = json.load(open("prompts_i2v.json"))
    SPAN = {r["sid"]: (r["t0"], r["t1"]) for r in shots.TABLE38}
    RSS = {r["sid"]: r["ss"] for r in shots.TABLE38}
    os.makedirs(SEG, exist_ok=True)
    made = []
    for j in jobs:
        src = os.path.join(RT, j["jid"] + ".mp4")
        if not os.path.exists(src):
            print("MISSING", src)
            sys.exit(1)
        t0 = j["t0"]
        for sid in j["sids"]:
            a, b = SPAN[sid]
            ss = max(0.0, a - t0)
            dur = b - a
            lead = min(RSS[sid], ss)      # 앞으로 당길 수 있는 만큼
            ss -= lead
            take = dur + lead + (RSS[sid] - lead) + PAD
            out = os.path.join(SEG, "i2v_%s.mp4" % sid)
            run(["ffmpeg", "-y", "-v", "error", "-ss", "%.3f" % ss, "-i", src,
                 "-t", "%.3f" % take, "-an",
                 "-c:v", "libx264", "-preset", "medium", "-crf", "17",
                 "-pix_fmt", "yuv420p", out])
            made.append((sid, j["jid"], ss, take, os.path.getsize(out)))
    print("배치 완료 %d 개" % len(made))
    for sid, jid, ss, take, sz in made:
        flag = "  ⚠빈파일" if sz < 20000 else ""
        print("  i2v_%-7s <- %-14s ss=%5.2f take=%5.2f %7.2f MB%s"
              % (sid, jid, ss, take, sz / 1e6, flag))


if __name__ == "__main__":
    main()
