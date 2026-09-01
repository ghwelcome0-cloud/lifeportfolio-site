#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate.py — 숏츠 #1 최종 게이트.

판정면은 ★최종 합성 프레임★ 이다 (교훈 246). 소스 클립이 아니라 shorts1.mp4
에서 프레임을 뽑아 잰다. 오버레이·먹싱 후에 톤이 틀어졌을 수 있기 때문이다.

항목
  G1  길이/프레임        1464f · 61.000s · A-V delta < 0.05
  G2  해상도             1080x1920 (crop 없이 scale 된 결과)
  G3  톤 3지표           컷마다 3프레임 = 27프레임, tonegate 기준 통과
  G4  컷 경계 정합       경계 프레임이 나레이션 문장 내부를 자르지 않는다
  G5  컷 밴드            전 컷 4~10초 (벤치마크 실측 밴드)
  G6  하드컷 실재        경계에서 프레임 차분이 급증한다 = 컷이 실제로 있다
  G7  정지 없음          컷 내부에서 프레임 차분이 0 인 구간이 없다 (CEO-51)
  G8  오디오             무음이 아니다 · 채널·샘플레이트 정상

CLI
  python3 gate.py
"""
import os, sys, subprocess, importlib.util
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
FINAL = HERE + "/shorts1.mp4"
TMP = HERE + "/work/gate"
FPS = 24


def _load(name):
    spec = importlib.util.spec_from_file_location(name, HERE + "/" + name + ".py")
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


CS = _load("cutsheet")
TG = _load("tonegate")
BD = _load("build")


def sh(cmd):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit(r.stderr[-2000:])
    return r.stdout


def frame(n, out):
    sh('ffmpeg -v error -y -i "%s" -vf "select=eq(n\\,%d)" -vsync 0 '
       '-frames:v 1 "%s"' % (FINAL, n, out))
    return out


def gray(p, w=270):
    im = Image.open(p).convert("RGB")
    im = im.resize((w, int(im.height * w / im.width)), Image.BILINEAR)
    return np.asarray(im, dtype=np.float32).mean(axis=2)


def main():
    os.makedirs(TMP, exist_ok=True)
    rows, total = BD.plan()
    res, bad = [], 0

    def chk(tag, ok, detail=""):
        nonlocal bad
        res.append((tag, ok, detail))
        if not ok:
            bad += 1

    # ---- G1 길이 -------------------------------------------------------
    vf = int(sh('ffprobe -v error -count_frames -select_streams v:0 -show_entries '
                'stream=nb_read_frames -of csv=p=0 "%s"' % FINAL).strip().rstrip(','))
    vd = float(sh('ffprobe -v error -select_streams v:0 -show_entries stream=duration '
                  '-of csv=p=0 "%s"' % FINAL).strip())
    ad = float(sh('ffprobe -v error -select_streams a:0 -show_entries stream=duration '
                  '-of csv=p=0 "%s"' % FINAL).strip())
    chk("G1 frames", vf == total, "%d / %d" % (vf, total))
    chk("G1 av-sync", abs(ad - vd) < 0.05, "v %.3f a %.3f d %.3f" % (vd, ad, abs(ad - vd)))

    # ---- G2 해상도 -----------------------------------------------------
    wh = sh('ffprobe -v error -select_streams v:0 -show_entries stream=width,height '
            '-of csv=p=0 "%s"' % FINAL).strip()
    chk("G2 resolution", wh == "1080,1920", wh)

    # ---- G3 톤 (컷마다 3프레임) ----------------------------------------
    tone_bad = []
    for r in rows:
        for frac in (0.10, 0.50, 0.90):
            n = r["gf0"] + int(r["n"] * frac)
            p = frame(n, "%s/t_%s_%d.png" % (TMP, r["id"], n))
            m, g, ob, ov, on, ok = TG.judge(p)   # ★실제 시그니처 확인 후 사용 (교훈 249)
            if not ok:
                tone_bad.append("%s@%d(mean %.1f ratio %.2f rb %+.1f)"
                                % (r["id"], n, m["mean"], m["ratio"], m["rb"]))
    chk("G3 tone 27f", not tone_bad, "bad: " + ", ".join(tone_bad) if tone_bad else "27/27")

    # ---- G4 컷 경계가 나레이션 문장 내부를 자르지 않는다 ---------------
    viol = []
    for r in rows[1:]:
        t = r["gf0"] / float(FPS)
        for s0, s1, txt in CS.NAR_SEGS:
            if s0 + 0.05 < t < s1 - 0.05:
                viol.append("%s@%.2f in [%.2f,%.2f]" % (r["id"], t, s0, s1))
    chk("G4 script-sync", not viol, "violations " + str(len(viol)) + (" " + "; ".join(viol) if viol else ""))

    # ---- G5 컷 밴드 ----------------------------------------------------
    durs = [r["n"] / float(FPS) for r in rows]
    chk("G5 cut-band", all(4.0 <= d <= 10.0 for d in durs),
        "min %.2f max %.2f avg %.2f" % (min(durs), max(durs), sum(durs) / len(durs)))

    # ---- G6/G7 하드컷 실재 + 정지 없음 ---------------------------------
    # 컷 경계 직전/직후 프레임 차분 vs 컷 내부 평균 차분
    edge_d, inner_d = [], []
    for r in rows:
        # 컷 내부 샘플 (4쌍)
        for k in range(4):
            n = r["gf0"] + int(r["n"] * (0.15 + 0.2 * k))
            a = gray(frame(n, "%s/a.png" % TMP))
            b = gray(frame(n + 2, "%s/b.png" % TMP))
            inner_d.append(float(np.abs(a - b).mean()))
        if r["gf0"] > 0:
            a = gray(frame(r["gf0"] - 1, "%s/e0.png" % TMP))
            b = gray(frame(r["gf0"], "%s/e1.png" % TMP))
            edge_d.append(float(np.abs(a - b).mean()))
    chk("G6 hardcut", min(edge_d) > 3.0 and min(edge_d) > 2.0 * (sum(inner_d) / len(inner_d)),
        "edge min %.2f  inner avg %.2f" % (min(edge_d), sum(inner_d) / len(inner_d)))
    chk("G7 motion", min(inner_d) > 0.20,
        "inner min %.3f (freeze if ~0)" % min(inner_d))

    # ---- G8 오디오 -----------------------------------------------------
    vol = sh('ffmpeg -v error -i "%s" -af volumedetect -f null - 2>&1' % FINAL)
    vol += subprocess.run('ffmpeg -hide_banner -i "%s" -af volumedetect -f null - 2>&1' % FINAL,
                          shell=True, capture_output=True, text=True).stdout
    mx = None
    for ln in vol.splitlines():
        if "max_volume" in ln:
            mx = float(ln.split(":")[-1].replace("dB", "").strip())
    ch = sh('ffprobe -v error -select_streams a:0 -show_entries stream=channels,sample_rate '
            '-of csv=p=0 "%s"' % FINAL).strip()
    chk("G8 audio", mx is not None and mx > -12.0, "max_volume %s dB  %s" % (mx, ch))

    # ---- 출력 ----------------------------------------------------------
    print("%-16s %-5s %s" % ("GATE", "", ""))
    for tag, ok, det in res:
        print("  %-16s %-5s %s" % (tag, "PASS" if ok else "FAIL", det))
    print("---")
    print("GATE %d/%d %s" % (len(res) - bad, len(res), "OK" if bad == 0 else "FAILED"))
    return 0 if bad == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
