#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""build.py — 숏츠 #1 조립 정본.

설계 원칙
  1) 컷 경계·길이는 ★절대 여기서 정의하지 않는다★. cutsheet.py 를 import 한다.
     (교훈 176 — 상수·수식은 복제하지 말고 참조한다)
  2) 프레임 수는 dur*24 를 컷마다 반올림하지 않는다. 그렇게 하면 합이 1464 가
     되지 않는다. ★경계 시각을 프레임으로 반올림한 뒤 차분★ 을 취해야
     누적 오차가 0 이 된다.
  3) 소스는 1072x1928 이다. ★crop 금지★ — scale 로 1080x1920 에 맞춘다.
  4) 그레이딩 ★무적용★. 신규 플레이트는 이미 밝은 중성 CAD 톤이고
     톤게이트 21/21 을 통과했다. 여기서 손대면 취조실 톤 재발 위험만 생긴다.
  5) 전환은 ★하드컷★ (교훈 255 — 벤치마크도 하드컷이다).

CLI
  python3 build.py plan     컷별 프레임 배치 표 + 자기검사
  python3 build.py segs     컷 세그먼트 렌더 (work/seg/)
  python3 build.py concat   세그먼트 concat → work/v_raw.mp4
"""
import os, sys, subprocess, importlib.util

HERE  = os.path.dirname(os.path.abspath(__file__))
CLIPS = HERE + "/clips"
WORK  = HERE + "/work"
SEG   = WORK + "/seg"

FPS   = 24
W, H  = 1080, 1920
SRC_FRAMES = 241          # 교훈 244 — i2v duration 10 → 241f / 10.041667s


def _load_cutsheet():
    spec = importlib.util.spec_from_file_location("cutsheet", HERE + "/cutsheet.py")
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


CS = _load_cutsheet()


def sh(cmd):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if r.returncode != 0:
        sys.stderr.write(r.stdout[-4000:] + "\n" + r.stderr[-4000:] + "\n")
        raise SystemExit("FAILED: " + cmd[:200])
    return r.stdout


def plan():
    """컷별 프레임 배치. 경계 시각을 프레임으로 반올림한 뒤 차분."""
    rows = CS.plan()
    out, prev_end = [], 0
    for i, r in enumerate(rows):
        f0 = int(round(r["t0"] * FPS))
        f1 = int(round(r["t1"] * FPS))
        assert f0 == prev_end, "frame gap at %s: %d != %d" % (r["id"], f0, prev_end)
        prev_end = f1
        n = f1 - f0
        # 소스 안에서 어느 구간을 쓸 것인가.
        #  fwd : 앞에서부터 n 프레임  (푸시인의 시작 부분)
        #  rev : 전체를 뒤집은 뒤 앞에서 n 프레임
        #        = 원본의 마지막 프레임에서 거꾸로 n 프레임.
        #        같은 소스를 fwd 로도 쓰는 컷(C1/C7, C2/C8)에서
        #        화면이 겹치지 않게 하는 효과도 있다.
        assert n <= SRC_FRAMES, "%s needs %d frames > %d" % (r["id"], n, SRC_FRAMES)
        out.append(dict(r, gf0=f0, gf1=f1, n=n))
    total = prev_end
    assert total == int(round(CS.TOTAL * FPS)), (total, CS.TOTAL * FPS)
    return out, total


def cmd_plan():
    rows, total = plan()
    print("%-4s %-9s %-4s %6s %6s %5s  %s" %
          ("CUT", "SRC", "DIR", "GF0", "GF1", "N", "SUBTITLE"))
    for r in rows:
        print("%-4s %-9s %-4s %6d %6d %5d  %s" %
              (r["id"], r["src"], r["dir"], r["gf0"], r["gf1"], r["n"], r["sub"]))
    print("---")
    print("cuts=%d  total_frames=%d  total=%.3fs" % (len(rows), total, total / float(FPS)))
    # 소스 커버리지
    used = {}
    for r in rows:
        used.setdefault(r["src"], []).append("%s:%d" % (r["dir"], r["n"]))
    for k in sorted(used):
        p = "%s/%s.mp4" % (CLIPS, k)
        print("  %-9s %s   %s" % (k, "OK " if os.path.exists(p) else "MISSING", used[k]))
    miss = [r["src"] for r in rows if not os.path.exists("%s/%s.mp4" % (CLIPS, r["src"]))]
    print("PLAN " + ("OK" if not miss else "MISSING " + ",".join(sorted(set(miss)))))
    return 0 if not miss else 1


# ★교훈 269★ i2v 클립은 카메라가 「거의 정지」한 구간을 만들 수 있다.
# F_top 은 241f 중 앞 114f 가 프레임차분 <0.20 이었다 = [CEO-51] 위반.
# 재생성(유료) 대신 ★아주 느린 푸시인 램프★ 를 부여해 해결한다. 벤치마크의
# 카메라 언어(끊김 없는 완만한 이동)와 동일하므로 이질감이 없다.
# 값은 실측으로 정했다: 1.08 → 3프레임 잔존, ★1.14 → 0프레임★, 1.20 → 0 (과함).
RAMP = {"C6": 1.14}


def _ramp_vf(z, n):
    """zoompan 램프. 정수 좌표 지터를 피하려 2배 업스케일 후 적용하고 되돌린다."""
    return ("scale=%d:%d:flags=lanczos,"
            "zoompan=z='1+%.6f*on/%d':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
            ":d=1:s=%dx%d:fps=%d,"
            "scale=%d:%d:flags=lanczos,setsar=1"
            % (W * 2, H * 2, z - 1.0, n - 1, W * 2, H * 2, FPS, W, H))


def cmd_segs():
    rows, total = plan()
    os.makedirs(SEG, exist_ok=True)
    for i, r in enumerate(rows):
        src = "%s/%s.mp4" % (CLIPS, r["src"])
        out = "%s/p%02d_%s.mp4" % (SEG, i, r["id"])
        if r["dir"] == "rev":
            # 전체 reverse 후 앞 n 프레임. reverse 는 전체를 메모리에 올리므로
            # 241f 1072x1928 정도가 한계다. 그래서 먼저 scale 을 걸어 줄인 뒤 뒤집는다.
            vf = ("scale=%d:%d:flags=lanczos,setsar=1,reverse,"
                  "trim=start_frame=0:end_frame=%d,setpts=PTS-STARTPTS,fps=%d"
                  % (W, H, r["n"], FPS))
        else:
            vf = ("trim=start_frame=0:end_frame=%d,setpts=PTS-STARTPTS,"
                  "scale=%d:%d:flags=lanczos,setsar=1,fps=%d"
                  % (r["n"], W, H, FPS))
        z = RAMP.get(r["id"])
        if z:
            vf = vf + "," + _ramp_vf(z, r["n"])
        sh('ffmpeg -v error -y -i "%s" -filter_complex "[0:v]%s[v]" -map "[v]" '
           '-an -c:v libx264 -preset medium -crf 16 -pix_fmt yuv420p "%s"'
           % (src, vf, out))
        got = int(sh('ffprobe -v error -count_frames -select_streams v:0 '
                     '-show_entries stream=nb_read_frames -of csv=p=0 "%s"' % out).strip().rstrip(','))
        assert got == r["n"], "%s frames %d != %d" % (r["id"], got, r["n"])
        print("  seg %s %-9s %-3s %4df  OK" % (r["id"], r["src"], r["dir"], got))
    print("SEGS OK %d" % len(rows))
    return 0


def cmd_concat():
    rows, total = plan()
    lst = WORK + "/concat.txt"
    with open(lst, "w") as f:
        for i, r in enumerate(rows):
            f.write("file '%s/p%02d_%s.mp4'\n" % (SEG, i, r["id"]))
    out = WORK + "/v_raw.mp4"
    sh('ffmpeg -v error -y -f concat -safe 0 -i "%s" -c copy "%s"' % (lst, out))
    got = int(sh('ffprobe -v error -count_frames -select_streams v:0 '
                 '-show_entries stream=nb_read_frames -of csv=p=0 "%s"' % out).strip().rstrip(','))
    assert got == total, "concat frames %d != %d" % (got, total)
    dur = float(sh('ffprobe -v error -show_entries format=duration -of csv=p=0 "%s"' % out).strip())
    print("CONCAT OK %s  %df  %.3fs  %dB" % (out, got, dur, os.path.getsize(out)))
    return 0


def cmd_final():
    """오버레이 합성 + 나레이션 먹싱 → shorts1.mp4.

    오버레이는 컷마다 정지 PNG 1장이다. 이것을 컷 구간 동안만 얹고
    ★등장 0.5초 페이드인★(벤치마크 실측) 을 준다. 컷마다 별도 입력으로
    걸면 입력이 10개가 되어 필터 그래프가 커지므로, 컷 세그먼트에
    개별로 얹은 뒤 다시 concat 하는 편이 메모리에 안전하다 (RAM 3.9GB).
    """
    rows, total = plan()
    OVD = WORK + "/ov"
    OSEG = WORK + "/oseg"
    os.makedirs(OSEG, exist_ok=True)
    FADE = 0.5                      # 벤치마크 실측: 오버레이 등장 0.5초 페이드
    for i, r in enumerate(rows):
        src = "%s/p%02d_%s.mp4" % (SEG, i, r["id"])
        ov  = "%s/ov_%02d_%s.png" % (OVD, i, r["id"])
        out = "%s/o%02d_%s.mp4" % (OSEG, i, r["id"])
        # 오버레이 alpha 를 0.5초에 걸쳐 올린다. 나갈 때는 하드컷이므로 페이드아웃 없음
        # (벤치마크도 컷과 함께 사라진다).
        # ★버그 수정: `-loop 1 -i png` 은 이미 무한 프레임 스트림이다.
        #   여기에 loop 필터와 trim=duration 을 또 걸면 부동소수 반올림으로
        #   프레임이 하나 모자란다 (C2 가 122 대신 121 이 나왔다).
        #   fps 로 타임베이스만 맞추고, 길이는 -frames:v 로 정확히 끊는다.
        fc = ("[1:v]fps=%d,format=rgba,fade=t=in:st=0:d=%.3f:alpha=1[ov];"
              "[0:v][ov]overlay=0:0:format=auto:eof_action=pass[o]"
              % (FPS, FADE))
        sh('ffmpeg -v error -y -i "%s" -loop 1 -i "%s" -filter_complex "%s" '
           '-map "[o]" -an -c:v libx264 -preset medium -crf 16 -pix_fmt yuv420p '
           '-frames:v %d "%s"' % (src, ov, fc, r["n"], out))
        got = int(sh('ffprobe -v error -count_frames -select_streams v:0 '
                     '-show_entries stream=nb_read_frames -of csv=p=0 "%s"'
                     % out).strip().rstrip(','))
        assert got == r["n"], "%s ov frames %d != %d" % (r["id"], got, r["n"])
        print("  ov-seg %s %4df OK" % (r["id"], got))

    lst = WORK + "/concat_ov.txt"
    with open(lst, "w") as f:
        for i, r in enumerate(rows):
            f.write("file '%s/o%02d_%s.mp4'\n" % (OSEG, i, r["id"]))
    vov = WORK + "/v_ov.mp4"
    sh('ffmpeg -v error -y -f concat -safe 0 -i "%s" -c copy "%s"' % (lst, vov))

    # 나레이션 먹싱. nar.mp3 = 60.912s, 영상 = 61.000s.
    # 나레이션을 늘이거나 자르지 않는다 (컷 경계가 이 타임코드에 맞춰져 있다).
    # 끝의 0.088s 만 무음으로 패딩한다.
    final = HERE + "/shorts1.mp4"
    sh('ffmpeg -v error -y -i "%s" -i "%s/nar.mp3" '
       '-filter_complex "[1:a]apad=whole_dur=%.6f[a]" '
       '-map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k -shortest "%s"'
       % (vov, HERE, total / float(FPS), final))

    vf = int(sh('ffprobe -v error -count_frames -select_streams v:0 '
                '-show_entries stream=nb_read_frames -of csv=p=0 "%s"' % final).strip().rstrip(','))
    vd = float(sh('ffprobe -v error -select_streams v:0 -show_entries stream=duration '
                  '-of csv=p=0 "%s"' % final).strip())
    ad = float(sh('ffprobe -v error -select_streams a:0 -show_entries stream=duration '
                  '-of csv=p=0 "%s"' % final).strip())
    print("---")
    print("FINAL %s" % final)
    print("  frames   %d  (expect %d)" % (vf, total))
    print("  video    %.3fs" % vd)
    print("  audio    %.3fs  delta %.3fs" % (ad, abs(ad - vd)))
    print("  size     %dB" % os.path.getsize(final))
    assert vf == total, "frame mismatch"
    assert abs(ad - vd) < 0.20, "av delta too large"
    print("FINAL OK")
    return 0


if __name__ == "__main__":
    c = sys.argv[1] if len(sys.argv) > 1 else "plan"
    raise SystemExit({"plan": cmd_plan, "segs": cmd_segs,
                      "concat": cmd_concat, "final": cmd_final}[c]())
