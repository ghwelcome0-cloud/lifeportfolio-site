# -*- coding: utf-8 -*-
"""aisrc.py — AI i2v 클립을 shorts4 조립용 「소스 대체본」으로 정규화한다.

■ 왜 필요한가 (교훈 244)
   AI i2v(kling/v3 duration=5)의 출력은 ★121 프레임 / 5.041667초 / 716x1284★ 로
   고정된다. 그러나 대본의 sid 길이는 65f ~ 228f 로 제각각이다. shorts4.build()
   는 세그먼트 프레임 수가 대본과 1프레임이라도 다르면 SEG FRAME MISMATCH 로
   죽는다 (나레이션 정합을 지키기 위한 의도된 설계다).

   따라서 조립 전에 AI 클립을 sid 가 요구하는 정확한 프레임 수로 「시간 재매핑」
   해야 한다. 잘라내기(trim)로 맞추면 카메라 무브의 기·결(도착점)이 사라져
   [CEO-82] follow-the-object 서사가 깨진다. 그래서 ★setpts 로 전체 무브를
   보존한 채 재생 속도만 바꾼다★.

■ 규격 (재생산 정본)
   입력  : _ai/s_<sid>.mp4   716x1284 · 24fps · 121f
   출력  : _aisrc/<jid>.mp4  1080x1920 · 24fps · 대본 프레임 수
   변환  : setpts=PTS/RATE  (RATE = 121 / want_frames) 후 fps 재샘플
   ★crop 을 쓰지 않는다★ — AI 클립은 이미 9:16 이다 (3D 배치본은 16:9 라서
     crop 이 필요하다. 두 소스의 vf 가 다르다 = 이 세션 확정 규칙).

■ sid 가 여러 job 으로 쪼개져 있으면
   shorts4.build() 는 job 단위로 소스 파일을 찾는다. 그래서 한 sid 의 AI 클립
   하나를 그 sid 의 job 들에 ★연속 구간으로 분배★ 한다. 즉 sid 전체 길이로
   먼저 재매핑한 뒤, job 경계에서 잘라 각 jid.mp4 로 낸다. 이렇게 하면 sid 안
   에서 카메라 무브가 한 번 매끄럽게 흐르고, 오버레이만 job 마다 갱신된다
   (교훈 237 시간축 분할과 정확히 같은 원리).

■ 자기검사
   python3 aisrc.py selfcheck   규격/수식 불변식 6항
   python3 aisrc.py build       _aisrc/ 전량 생성 + 프레임 수 검증
"""
import os
import sys
import math
import subprocess
import importlib.util

HERE = os.path.dirname(os.path.abspath(__file__))
AI = HERE + "/_ai"
OUT = HERE + "/_aisrc"
FPS = 24
W, H = 1080, 1920
SRC_FRAMES = 121          # kling/v3 duration=5 의 실측 출력
SRC_W, SRC_H = 716, 1284  # 실측 해상도 (9:16 계열)


def _s4():
    spec = importlib.util.spec_from_file_location("_ais4", HERE + "/shorts4.py")
    m = importlib.util.module_from_spec(spec)
    argv = sys.argv
    sys.argv = ["aisrc"]
    try:
        spec.loader.exec_module(m)
    finally:
        sys.argv = argv
    return m


def sh(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0:
        raise SystemExit("CMD FAIL %s\n%s" % (" ".join(cmd[:6]), p.stderr[-1500:]))
    return p.stdout


def nframes(path):
    o = sh(["ffprobe", "-v", "error", "-select_streams", "v:0",
            "-count_frames", "-show_entries", "stream=nb_read_frames",
            "-of", "csv=p=0", path])
    return int(o.strip().split(",")[0])


def sid_plan():
    """sid -> [(jid, frames), ...]  (대본이 요구하는 프레임 수)"""
    m = _s4()
    J = m.load_jobs()
    from collections import defaultdict
    grp = defaultdict(list)
    for jid, j in J.items():
        ps = j.get("props_sid") or jid.replace("J_", "").split("_s")[0]
        grp[ps].append(jid)
    out = []
    for act, sid in m.BEATS:
        jids = sorted(grp[sid])
        out.append((act, sid, [(x, int(J[x]["frames"])) for x in jids]))
    return out


def rate_for(want):
    """setpts 계수. 출력 프레임 want 를 얻기 위한 PTS 나눗값.

    setpts=PTS/RATE 는 재생 속도를 RATE 배로 만든다. 원본 SRC_FRAMES 를
    want 프레임으로 만들려면 RATE = SRC_FRAMES / want 다.
      want < 121  -> RATE > 1  (빨라짐)
      want > 121  -> RATE < 1  (느려짐 = 감속)
    """
    return SRC_FRAMES / float(want)


def build(verbose=True):
    os.makedirs(OUT, exist_ok=True)
    plan = sid_plan()
    made, bad = [], []
    for act, sid, jobs in plan:
        src = "%s/s_%s.mp4" % (AI, sid)
        if not os.path.exists(src):
            raise SystemExit("AI CLIP MISSING: %s" % src)
        sn = nframes(src)
        want = sum(f for _, f in jobs)
        rate = rate_for(want)
        # 1) sid 전체를 want 프레임으로 재매핑 (한 번의 매끄러운 무브 보존)
        whole = "%s/_w_%s.mp4" % (OUT, sid)
        vf = ("setpts=PTS/%.9f,fps=%d,scale=%d:%d:flags=lanczos,setsar=1"
              % (rate, FPS, W, H))
        sh(["ffmpeg", "-v", "error", "-y", "-i", src, "-an",
            "-vf", vf, "-frames:v", str(want),
            "-c:v", "libx264", "-preset", "medium", "-crf", "16",
            "-pix_fmt", "yuv420p", "-r", str(FPS), whole])
        wn = nframes(whole)
        if wn != want:
            bad.append((sid, "whole", wn, want))
            continue
        # 2) job 경계로 분배 (연속 구간 = sid 안에서 무브가 이어진다)
        off = 0
        for jid, f in jobs:
            dst = "%s/%s.mp4" % (OUT, jid)
            sh(["ffmpeg", "-v", "error", "-y", "-i", whole, "-an",
                "-vf", "trim=start_frame=%d:end_frame=%d,setpts=PTS-STARTPTS"
                % (off, off + f),
                "-c:v", "libx264", "-preset", "medium", "-crf", "16",
                "-pix_fmt", "yuv420p", "-r", str(FPS), dst])
            n = nframes(dst)
            if n != f:
                bad.append((jid, "part", n, f))
            else:
                made.append((jid, n))
            off += f
        assert off == want, (sid, off, want)
        os.remove(whole)
        if verbose:
            print("  %s %-7s src %df -> %df  rate %.4f  (%d job)"
                  % (act, sid, sn, want, rate, len(jobs)))
    if verbose:
        print("AISRC %s   parts %d   bad %s"
              % ("OK" if not bad else "FAIL", len(made), bad))
    if bad:
        raise SystemExit("AISRC FRAME MISMATCH %s" % bad)
    return made


def selfcheck():
    ok = []

    def chk(name, cond, note=""):
        ok.append((name, bool(cond), note))

    chk("src spec 121f", SRC_FRAMES == 121)
    chk("src spec 716x1284", (SRC_W, SRC_H) == (716, 1284))
    chk("out spec 1080x1920", (W, H) == (1080, 1920))
    # rate 수식 불변식: want 프레임을 얻는 계수여야 한다
    chk("rate slower for long", rate_for(228) < 1.0,
        "%.4f" % rate_for(228))
    chk("rate faster for short", rate_for(65) > 1.0,
        "%.4f" % rate_for(65))
    chk("rate identity at 121", abs(rate_for(121) - 1.0) < 1e-9)
    # 대본 합계가 shorts4 와 일치하는가
    try:
        p = sid_plan()
        tot = sum(f for _, _, jobs in p for _, f in jobs)
        chk("script total 1395f", tot == 1395, "%d" % tot)
        chk("sid count 12", len(p) == 12, "%d" % len(p))
        miss = [s for _, s, _ in p if not os.path.exists("%s/s_%s.mp4" % (AI, s))]
        chk("all AI clips present", not miss, str(miss))
    except SystemExit as e:
        chk("script readable", False, str(e))
    n = 0
    for name, good, note in ok:
        print("  %-26s %s  %s" % (name, "OK" if good else "FAIL", note))
        n += 1 if good else 0
    print("SELFCHECK %d/%d %s" % (n, len(ok), "OK" if n == len(ok) else "FAIL"))
    return n == len(ok)


if __name__ == "__main__":
    a = sys.argv[1] if len(sys.argv) > 1 else "selfcheck"
    if a == "selfcheck":
        sys.exit(0 if selfcheck() else 1)
    elif a == "build":
        build()
    else:
        raise SystemExit("usage: aisrc.py selfcheck|build")
