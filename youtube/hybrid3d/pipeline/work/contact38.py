"""Build one review sheet the CEO can judge in a single glance.

Two separate things need approving and they are usually confused: the FOOTAGE
that already exists (ACT1~2, rendered) and the REPORT PAGES that will carry
ACT8 (captured from our own product). Putting both on one sheet, each labelled
with what it is and how long it runs, is what lets a yes or no be given once
instead of three times.
"""
import os
import subprocess
import cv2
import numpy as np

W, H = 1920, 1080
OUT = "/home/user/lf/work/longform/review"
os.makedirs(OUT, exist_ok=True)
FONT = "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf"


def frames_from(src, times, tag):
    got = []
    for t in times:
        p = f"{OUT}/_f_{tag}_{t:.2f}.png"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.3f}", "-i", src,
                        "-frames:v", "1", p], check=True)
        im = cv2.imread(p)
        if im is not None:
            got.append((f"{t:.0f}s", im))
    return got


def tile(cells, cols, cw, out, title):
    """Grid with a caption strip under each cell — a sheet, not a mosaic."""
    ch = int(cw * 9 / 16)
    cap = 34
    rows = (len(cells) + cols - 1) // cols
    pad, top = 14, 78
    cv = np.full((top + rows * (ch + cap + pad) + pad,
                  cols * (cw + pad) + pad, 3), 22, np.uint8)
    cv2.putText(cv, title, (pad, 50), cv2.FONT_HERSHEY_SIMPLEX, 1.15,
                (235, 235, 235), 2, cv2.LINE_AA)
    for i, (label, im) in enumerate(cells):
        r, c = divmod(i, cols)
        x = pad + c * (cw + pad)
        y = top + r * (ch + cap + pad)
        h0, w0 = im.shape[:2]
        s = min(cw / w0, ch / h0)                      # never distort a page
        rz = cv2.resize(im, (max(int(w0 * s), 1), max(int(h0 * s), 1)),
                        interpolation=cv2.INTER_AREA)
        ox, oy = (cw - rz.shape[1]) // 2, (ch - rz.shape[0]) // 2
        cv[y + oy:y + oy + rz.shape[0], x + ox:x + ox + rz.shape[1]] = rz
        cv2.rectangle(cv, (x, y), (x + cw, y + ch), (90, 90, 90), 1)
        cv2.putText(cv, label, (x + 4, y + ch + 24), cv2.FONT_HERSHEY_SIMPLEX,
                    0.62, (215, 215, 215), 1, cv2.LINE_AA)
    cv2.imwrite(out, cv)
    print(f"  {out}  {cv.shape[1]}x{cv.shape[0]}")


# ── sheet 1: the footage that exists right now ────────────────────────────────
src = "act12.mp4"
dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                            "format=duration", "-of", "csv=p=0", src],
                           capture_output=True, text=True).stdout.strip())
print(f"act12.mp4 {dur:.2f}s")
ts = [3, 12, 22, 32, 41, 50, 58, 66, 74, 82, 90, 100]
ts = [t for t in ts if t < dur - 0.5]
tile(frames_from(src, ts, "a12"), 4, 440, f"{OUT}/sheet1_act12_footage.png",
     f"SHEET 1 - rendered footage (ACT1~2)  {dur:.1f}s / 32 pieces / 1920x1080 24fps")

# ── sheet 2: the report pages captured from our own engine ───────────────────
pages = []
for n in (3, 5, 8):
    p = f"/home/user/lf/land38/report/report_p{n:02d}.png"
    im = cv2.imread(p)
    if im is not None:
        pages.append((f"folio {n:02d}  ({im.shape[1]}x{im.shape[0]})", im))
if pages:
    tile(pages, 3, 600, f"{OUT}/sheet2_report_pages.png",
         "SHEET 2 - ACT8 report pages, rendered from our own vector engine (cost 0)")

for f in os.listdir(OUT):
    if f.startswith("_f_"):
        os.remove(os.path.join(OUT, f))
print("done")
