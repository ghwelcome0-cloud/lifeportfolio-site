"""Render a side-by-side of CENTRED motion vs AIMED motion, for the CEO's eyes.

Both halves have identical easing, identical amplitude, identical duration. The
only difference is WHERE the move ends. That is deliberate: the previous
comparison proved the motion was smooth, the CEO accepted it ("오 움직임은 확실히
개선됐어요"), and then asked the harder question — does the movement mean anything.
Changing only the aim isolates that one variable, so whatever he sees is caused by
meaning and not by a smoother curve.

The picks are chosen so each one has a sentence that names a different place, and
the narration is burned in beneath so the pairing can be read rather than trusted:

  A3-06  "이렇게 일할 때는 나답다"      -> 좌측 책상  (left)
  A3-07  "반복 알림·쌓인 회의자료"      -> 우측 협업공간 (right)
  A6-02  "이미 지나온 경험에서"         -> 카메라 아래로 하강 (a path)
  A3-08  "빈 비교표 3행"                -> 중앙 책상, then opens out (a conclusion)

A4-01 was the obvious fourth pick — "위층 서가로 수직 상승" is the clearest rise in
the film — but it is a glass-panel row, so aim38 correctly refuses to aim it and
the two halves render identically (measured drift 0.00). Correct behaviour, useless
comparison. A6-02 carries the same downward instruction on a plate with no text.

Free: still plates, ffmpeg only.
"""
import os
import numpy as np
import cv2
import shots38 as shots
import motion38
import aim38
import assemble as A
import drive38

PICKS = ["A3-06", "A3-07", "A6-02", "A3-08"]
WORK = "_cmpaim"
OUTDIR = "review"
HALF_W, HALF_H = 960, 540
FONT = "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf"


def row_by_sid(sid):
    return [r for r in shots.TABLE38 if r["sid"] == sid][0]


def half(src, out):
    A.run(["ffmpeg", "-v", "error", "-y", "-i", src,
           "-vf", f"scale={HALF_W}:{HALF_H}", "-c:v", "libx264", "-crf", "18",
           "-preset", "veryfast", "-pix_fmt", "yuv420p", "-an", out],
          f"half {os.path.basename(out)}")


def label(src, out, top, bottom):
    """Two burned-in lines: what this half is, and the sentence being spoken.

    The percent sign is avoided rather than escaped — ffmpeg's drawtext reads it
    as a strftime expansion and silently drops the number after it. Colons and
    single quotes are escaped because drawtext's own parser eats them.
    """
    def esc(t):
        t = t.replace("%", "pct").replace("\\", "")
        return t.replace(":", r"\:").replace("'", "")
    d1 = (f"drawtext=fontfile={FONT}:text='{esc(top)}':x=14:y=12:"
          f"fontsize=30:fontcolor=white:box=1:boxcolor=black@0.62:boxborderw=9")
    d2 = (f"drawtext=fontfile={FONT}:text='{esc(bottom)}':x=14:y=h-58:"
          f"fontsize=22:fontcolor=white:box=1:boxcolor=black@0.62:boxborderw=8")
    A.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-vf", f"{d1},{d2}",
           "-c:v", "libx264", "-crf", "18", "-preset", "veryfast",
           "-pix_fmt", "yuv420p", "-an", out],
          f"label {os.path.basename(out)}")


def pair(left, right, out):
    A.run(["ffmpeg", "-v", "error", "-y", "-i", left, "-i", right,
           "-filter_complex", "[0:v][1:v]hstack=inputs=2[v]", "-map", "[v]",
           "-c:v", "libx264", "-crf", "17", "-preset", "medium",
           "-pix_fmt", "yuv420p", "-an", out],
          f"pair {os.path.basename(out)}")


def aim_drift(path_a, path_b):
    """Mean absolute difference between the two halves at first / mid / last frame.

    A near-zero last-frame number would mean the aim changed nothing and the
    comparison is a lie; that check matters more than the picture looking nice.
    """
    ca, cb = cv2.VideoCapture(path_a), cv2.VideoCapture(path_b)
    n = min(int(ca.get(cv2.CAP_PROP_FRAME_COUNT)),
            int(cb.get(cv2.CAP_PROP_FRAME_COUNT)))
    outv = []
    for idx in (0, n // 2, n - 1):
        ca.set(cv2.CAP_PROP_POS_FRAMES, idx)
        cb.set(cv2.CAP_PROP_POS_FRAMES, idx)
        oa, ia = ca.read()
        ob, ib = cb.read()
        if not (oa and ob):
            outv.append(-1.0)
            continue
        outv.append(float(np.abs(ia.astype(np.float32) -
                                 ib.astype(np.float32)).mean()))
    ca.release()
    cb.release()
    return outv


def main():
    os.makedirs(WORK, exist_ok=True)
    os.makedirs(OUTDIR, exist_ok=True)
    parts = []
    for sid in PICKS:
        r = row_by_sid(sid)
        plate = drive38.plate_path(r["anchor"])
        if not os.path.exists(plate):
            print(f"  skip {sid}: plate missing {plate}")
            continue
        dur = min(round(r["t1"] - r["t0"], 4), 3.2)
        p = motion38.plan(r, dur)
        pa = aim38.aim_for(r, p)

        old = f"{WORK}/{sid}_centre.mp4"
        new = f"{WORK}/{sid}_aimed.mp4"
        # identical everything except aim
        A.kenburns(plate, dur, old, z0=p["z0"], z1=p["z1"], pan=p["pan"],
                   ease=p["ease"], head=p["head"], tail=p["tail"])
        A.kenburns(plate, dur, new, z0=pa["z0"], z1=pa["z1"], pan=pa["pan"],
                   ease=pa["ease"], head=pa["head"], tail=pa["tail"],
                   aim0=pa["aim0"], aim1=pa["aim1"])

        drift = aim_drift(old, new)
        narr = (r.get("narr") or "")[:46]
        print(f"  {sid}  {p['verb']}  {dur:.2f}s  aim {pa['aim1']}  "
              f"{pa['aim_reason']}")
        print(f"        drift first/mid/last = "
              f"{drift[0]:.2f} / {drift[1]:.2f} / {drift[2]:.2f}")

        lo, ln = f"{WORK}/{sid}_L.mp4", f"{WORK}/{sid}_R.mp4"
        half(old, f"{WORK}/{sid}_Lh.mp4")
        half(new, f"{WORK}/{sid}_Rh.mp4")
        label(f"{WORK}/{sid}_Lh.mp4", lo, f"BEFORE {sid} 화면 중앙으로", narr)
        label(f"{WORK}/{sid}_Rh.mp4", ln,
              f"AFTER {sid} 대사가 지목한 곳으로", narr)
        pr = f"{WORK}/{sid}_pair.mp4"
        pair(lo, ln, pr)
        parts.append(pr)

    out = f"{OUTDIR}/cmp_aim_before_after.mp4"
    A.concat(parts, out, "cmpaim")
    print(f"\n{out}   {A.duration(out):.3f}s")


if __name__ == "__main__":
    main()
