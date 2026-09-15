"""채택본을 ① 시간 재매핑(retime) ② 1920x1080 업스케일 ③ 무음화 해서 _gen/rt/ 에 둔다.

★왜 retime 이 필요한가 — 이번 세션 최대 발견★
gemini/omni-flash 는 duration 을 정수 초로만 받는다. 그래서 나는 각 job 의
raw 요구 길이(설계표 t1-t0 합)를 round() 해서 발주했다.

    J01_S23_a  raw 8.66s -> 생성 8.0s   (-0.66)
    J23_S09_b  raw 5.38s -> 생성 5.0s   (-0.38)
    J33_Q04_a  raw 6.44s -> 생성 6.0s   (-0.44)
    J29_Q11_a  raw 8.42s -> 생성 8.0s   (-0.42)

결과: 한 job 이 여러 sid 를 덮을 때(교훈 119 run 묶기) 그 job 의 ★마지막 sid★ 가
소스 끝을 넘어가 잘린다. i2v_A7-04.mp4 는 261 바이트, 즉 빈 파일이었다
(ss=8.25 를 요청했지만 소스는 8.0초).

★해법 — 재생성(유료 23본) 대신 시간 재매핑(무료)★
    k = raw / actual        (>1 이면 느리게)
    setpts=PTS*k, fps=24
최대 배율은 J01 의 8.66/8.0 = 1.0825 = 8.3% 감속. 나머지는 대부분 1.05 이하.
프레임 중복이 생기지만 8% 감속이면 12프레임마다 1프레임, ★연속 1프레임★ 이므로
qc_gen 의 MAX_BODY_RUN=12 판정에 걸리지 않는다. CEO-43 이 승인한 모션 자체는
그대로 보존된다(경로·속도곡선 불변, 전체 시간축만 균일 확대).

★부수 이득★ 기존 pick38 은 슬라이스마다 업스케일을 반복했다(57회).
여기서 job 단위로 한 번만(43본) 업스케일하고, 슬라이스는 필터 없이 잘라낸다.
"""
import json, os, subprocess, sys

RAW = "_gen/raw"
RT = "_gen/rt"
W, H, FPS = 1920, 1080, 24

# 같은 jid 에 v2/v3 가 있으면 QC 를 통과한 최신 판을 쓴다.
OVERRIDE = {
    "J22_S09_a": "J22_S09_a_v2",
    "J28_S03_a": "J28_S03_a_v3",
    "J38_Q06_a": "J38_Q06_a_v2",
    "J42_S13_a": "J42_S13_a_v2",
}


def src_of(jid):
    return os.path.join(RAW, OVERRIDE.get(jid, jid) + ".mp4")


def probe_dur(path):
    for args in (["-show_entries", "format=duration"],
                 ["-select_streams", "v:0", "-show_entries", "stream=duration"]):
        r = subprocess.run(["ffprobe", "-v", "error"] + args + ["-of", "csv=p=0", path],
                           capture_output=True, text=True)
        s = r.stdout.strip().split(",")[0]
        if s and s != "N/A":
            try:
                return float(s)
            except ValueError:
                pass
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0",
                        "-count_frames", "-show_entries", "stream=nb_read_frames",
                        "-of", "csv=p=0", path], capture_output=True, text=True)
    s = r.stdout.strip().split(",")[0]
    if s.isdigit():
        return int(s) / float(FPS)
    raise SystemExit("probe failed: %s" % path)


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print("FAIL", " ".join(cmd)[:200])
        print(r.stderr[-1200:])
        sys.exit(1)


def main():
    jobs = json.load(open("prompts_i2v.json"))
    os.makedirs(RT, exist_ok=True)
    print("jid            raw    actual   k      out_dur")
    for j in jobs:
        jid = j["jid"]
        src = src_of(jid)
        if not os.path.exists(src):
            print("MISSING", jid, src)
            sys.exit(1)
        raw = float(j["raw"])
        actual = probe_dur(src)
        # 목표: raw 보다 약간 넉넉하게. 렌더러가 ss=0.05 를 다시 건너뛰고
        # 2프레임의 여유를 요구하므로 그만큼을 미리 담는다.
        target = raw + 0.05 + 4.0 / FPS
        k = target / actual
        out = os.path.join(RT, jid + ".mp4")
        run(["ffmpeg", "-y", "-v", "error", "-i", src,
             "-vf", "setpts=PTS*%.6f,scale=%d:%d:flags=lanczos,fps=%d"
                    % (k, W, H, FPS),
             "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "17",
             "-pix_fmt", "yuv420p", out])
        got = probe_dur(out)
        print("%-14s %5.2f  %6.3f  %.4f  %6.3f%s"
              % (jid, raw, actual, k, got, "" if got >= target - 0.02 else "  ⚠"))
    print("\nretime+upscale 완료 %d 본 -> %s" % (len(jobs), RT))


if __name__ == "__main__":
    main()
