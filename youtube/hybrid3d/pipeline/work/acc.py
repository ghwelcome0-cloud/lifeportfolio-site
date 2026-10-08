# -*- coding: utf-8 -*-
"""Measure, accept and install the two newly delivered clips, then re-render.

A clip is accepted on measurement, never on the filename: the failure mode that
matters is a clip that is a fraction of a second shorter than the shot needs,
because ffmpeg -ss past the end returns success and a truncated file. So the
length, the frame rate and the geometry are all read off the file itself, and
the headroom is stated in seconds so a marginal clip is visible as marginal.
"""
import os, shutil, subprocess, json
import assemble as A, shots

tab = {r["sid"]: r for r in shots.resolve_kinds()}
INBOX = "inbox"
CAND = {"A2-04": "A2-04_seedance20_hd_16x9.mp4",
        "A2-13": "A2-13_seedance20_hd_16x9.mp4"}
LOG, accepted, problems = [], [], []

def probe(p):
    rc = subprocess.run(["ffprobe","-v","error","-select_streams","v:0",
        "-show_entries","stream=width,height,r_frame_rate,nb_frames",
        "-show_entries","format=duration","-of","json",p],
        capture_output=True, text=True)
    d = json.loads(rc.stdout)
    s = d["streams"][0]
    num, den = s["r_frame_rate"].split("/")
    return (int(s["width"]), int(s["height"]), float(num)/float(den),
            float(d["format"]["duration"]), s.get("nb_frames"))

for sid, fn in CAND.items():
    src = os.path.join(INBOX, fn)
    if not os.path.exists(src):
        problems.append(f"{sid} not on disk"); continue
    r = tab[sid]
    need = round(r["t1"] - r["t0"], 4)
    w, h, fps, dur, nbf = probe(src)
    head = dur - r["ss"] - need - 2 * A.FR
    ok = (w >= 1920 and abs(w/h - 16/9) < 0.02 and abs(fps - 24) < 0.6
          and head >= 0)
    LOG.append(f"{sid} {w}x{h} {fps:.2f}fps {dur:.4f}s {nbf}f  "
               f"need {need:.2f}s from ss={r['ss']:.2f}  headroom {head:+.2f}s  "
               f"{'ACCEPT' if ok else 'REJECT'}")
    if ok:
        shutil.copy2(src, f"seg/i2v_{sid}.mp4")
        accepted.append(sid)
    else:
        problems.append(f"{sid} w={w} h={h} fps={fps:.2f} headroom={head:+.2f}")

LOG.append(f"accepted {len(accepted)}/{len(CAND)} -> {accepted}")
LOG.append(f"problems {problems}")
have = [s for s in shots.I2V_ROWS if os.path.exists(f"seg/i2v_{s}.mp4")]
LOG.append(f"ACT1~2 i2v on disk {len(have)}/8 -> {sorted(have)}")
LOG.append(f"still outstanding: {sorted(set(shots.I2V_ROWS) - set(have))}")
open("/tmp/acc.txt","w",encoding="utf-8").write("\n".join(LOG)+"\n")
print("\n".join(LOG))
