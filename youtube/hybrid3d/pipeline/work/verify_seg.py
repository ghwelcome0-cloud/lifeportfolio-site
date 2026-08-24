"""seg/ 에 배치된 생성 클립이 렌더러의 길이 게이트를 통과하는지 전수 검증한다.

★왜 이 스크립트가 필요한가 (교훈 132)★
drive38.render_row 의 i2v 분기는 소스를 "다시" 자른다:
    A.trim(src, r["ss"], dur, None, out)
그리고 그 앞에 게이트가 있다:
    if r["ss"] + dur > have - 2 * A.FR:  -> "clip too short" 로 SKIP
따라서 seg/i2v_<sid>.mp4 의 실측 길이 have 는
    have >= r["ss"] + (t1 - t0) + 2/24
를 만족해야 한다. 하나라도 못 만족하면 그 컷은 조용히 kenburns 도 아니고
아예 빠져 버려서 최종 길이가 349.680s 에서 어긋난다.

★ffprobe 'N/A' 방어 (직전 crash)★
format=duration 은 컨테이너에 duration 이 안 써진 경우 'N/A' 를 돌려준다.
순서대로 폴백한다:
    1) format=duration
    2) stream=duration (v:0)
    3) -count_frames 로 nb_read_frames / fps
셋 다 실패하면 BAD 로 보고한다.
"""
import subprocess, sys
import shots38 as shots

SEG = "/home/user/lf/land38/seg"
FR = 1.0 / 24.0


def _probe(args):
    r = subprocess.run(["ffprobe", "-v", "error"] + args,
                       capture_output=True, text=True)
    return r.stdout.strip()


def duration(path):
    """(초, 방법) 또는 (None, 이유)"""
    s = _probe(["-show_entries", "format=duration", "-of", "csv=p=0", path])
    if s and s != "N/A":
        try:
            return float(s), "format"
        except ValueError:
            pass
    s = _probe(["-select_streams", "v:0", "-show_entries", "stream=duration",
                "-of", "csv=p=0", path])
    s = s.split(",")[0] if s else s
    if s and s != "N/A":
        try:
            return float(s), "stream"
        except ValueError:
            pass
    s = _probe(["-select_streams", "v:0", "-count_frames",
                "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", path])
    s = s.split(",")[0] if s else s
    if s and s.isdigit():
        return int(s) * FR, "frames(%s)" % s
    return None, "probe-failed(raw=%r)" % s


def main():
    rows = {r["sid"]: r for r in shots.TABLE38}
    targets = [r for r in shots.TABLE38 if r.get("v1_kind") == "i2v"]
    print("v1_kind=i2v 대상 %d sid" % len(targets))
    bad, short, ok = [], [], []
    for r in targets:
        sid = r["sid"]
        p = "%s/i2v_%s.mp4" % (SEG, sid)
        have, how = duration(p)
        dur = round(r["t1"] - r["t0"], 4)
        need = r["ss"] + dur + 2 * FR
        if have is None:
            bad.append((sid, how))
            print("  BAD   %-7s %s" % (sid, how))
            continue
        margin = have - need
        if margin < 0:
            short.append((sid, have, need, margin))
            print("  SHORT %-7s have=%6.3f need=%6.3f margin=%+.3f  (%s)"
                  % (sid, have, need, margin, how))
        else:
            ok.append(sid)
    print("\n결과  OK %d / SHORT %d / BAD %d" % (len(ok), len(short), len(bad)))
    if short:
        print("SHORT sid: " + " ".join(s[0] for s in short))
    if bad:
        print("BAD   sid: " + " ".join(s[0] for s in bad))
    return 0 if not short and not bad else 1


if __name__ == "__main__":
    sys.exit(main())
