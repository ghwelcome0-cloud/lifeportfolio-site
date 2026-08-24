#!/usr/bin/env python3
"""Side-by-side of the three ACT8 framings, for the CEO's eyes.

Three columns, same page, same duration, same easing:

  SQUEEZED   what the pipeline actually did until today. zoompan fed a portrait
             page, which keeps its input aspect and rescales to 1920x1080 — the
             page is flattened sideways by 2.87x. Nothing reported this; the
             render log said ok. It is here so the defect is visible once, rather
             than only described.
  CANVAS     the page composed whole onto a 16:9 backdrop. Undistorted and
             complete, but on screen 588px wide at 0.30x: the printed Korean
             cannot be read, which is the "PPT 슬라이드를 붙여서 만든 영상"
             the CEO said we had escaped.
  PAGE READ  a 16:9 window at full page width, travelling down the page and
             settling on inked content. 92-97% of the frame is page, net scale
             0.98-1.16x, so glyphs are essentially never resampled.

This is the same discipline as the aim comparison: change one thing, show it, and
let the CEO's eyes be the judgement rather than my description of the numbers.
"""
import os
import subprocess
import cv2
import assemble as A

REPORT = "/home/user/lf/land38/report"
CANVAS = "/home/user/lf/land38/canvas"
WORK = "_act8cmp"
OUTDIR = "review"
FONT = "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf"
CW, CH = 640, 360                      # three columns of 640 = 1920

PICKS = [("S24", "report_p03.png", "S24_tall.png", "folio 03  한눈에 보는 나", 4.0),
         ("S25", "report_p05.png", "S25_tall.png", "folio 05  실행 프로파일", 4.0),
         ("S26", "report_p08.png", "S26_tall.png", "folio 08  활용 예시", 4.0)]


def squeezed(page, dur, out):
    """Reproduce the old behaviour exactly: portrait straight into zoompan."""
    vf = ("scale=3840:-2,zoompan=z='1.0+0.12*((clip(on/%d,0,1))*(clip(on/%d,0,1))"
          "*(3-2*(clip(on/%d,0,1))))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
          ":d=1:s=1920x1080:fps=24,trim=start_frame=0:end_frame=%d,"
          "setpts=PTS-STARTPTS,format=yuv420p")
    n = int(round(dur * A.FPS))
    vf = vf % (n - 1, n - 1, n - 1, n)
    A.run(["ffmpeg", "-v", "error", "-y", "-loop", "1", "-t", f"{dur+0.5:.4f}",
           "-i", page, "-vf", vf, "-c:v", "libx264", "-crf", "16",
           "-pix_fmt", "yuv420p", "-r", str(A.FPS), "-frames:v", str(n), "-an", out],
          f"squeezed {os.path.basename(out)}")


def col(src, out, top, bottom):
    t = top.replace("%", "pct").replace(":", "\\:").replace("'", "")
    b = bottom.replace("%", "pct").replace(":", "\\:").replace("'", "")
    vf = (f"scale={CW}:{CH},"
          f"drawbox=x=0:y=0:w={CW}:h=34:color=black@0.62:t=fill,"
          f"drawtext=fontfile={FONT}:text='{t}':fontcolor=white:fontsize=21"
          f":x=(w-text_w)/2:y=7,"
          f"drawbox=x=0:y={CH-30}:w={CW}:h=30:color=black@0.62:t=fill,"
          f"drawtext=fontfile={FONT}:text='{b}':fontcolor=#ffd479:fontsize=17"
          f":x=(w-text_w)/2:y={CH-25}")
    A.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-vf", vf,
           "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-an", out],
          f"col {os.path.basename(out)}")


def main():
    os.makedirs(WORK, exist_ok=True)
    os.makedirs(OUTDIR, exist_ok=True)
    rows = []
    for anchor, pagefn, canvasfn, label, dur in PICKS:
        page = os.path.join(REPORT, pagefn)
        canvas = os.path.join(CANVAS, canvasfn)
        pw = cv2.imread(page).shape[1]
        cw = cv2.imread(canvas).shape[1]

        a = f"{WORK}/{anchor}_sq.mp4"
        squeezed(page, dur, a)
        b = f"{WORK}/{anchor}_cv.mp4"
        A.kenburns(canvas, dur, b, z0=1.00, z1=1.12, ease="inout")
        c = f"{WORK}/{anchor}_pp.mp4"
        A.pagepan(page, dur, c, y0=0.0, y1=1.0, ease="inout")

        ca = f"{WORK}/{anchor}_cA.mp4"
        col(a, ca, "BEFORE  가로로 짜부러짐", f"지면 왜곡 2.87x")
        cb = f"{WORK}/{anchor}_cB.mp4"
        col(b, cb, "안 A  지면 전체", f"화면상 {pw*1920//cw}px  0.30x  글자 못 읽음")
        cc = f"{WORK}/{anchor}_cC.mp4"
        col(c, cc, "안 B  지면을 읽어 내려감", f"프레임 94pct  {1920/pw:.2f}x  선택")

        row = f"{WORK}/{anchor}_row.mp4"
        A.run(["ffmpeg", "-v", "error", "-y", "-i", ca, "-i", cb, "-i", cc,
               "-filter_complex", "[0:v][1:v][2:v]hstack=inputs=3[v]",
               "-map", "[v]", "-c:v", "libx264", "-crf", "18",
               "-pix_fmt", "yuv420p", "-an", row], f"row {anchor}")
        rows.append(row)
        print(f"{anchor} {label}: page {pw}px  canvas {cw}px")

    out = os.path.join(OUTDIR, "act8_framing_3way.mp4")
    A.concat(rows, out, "act8 3-way")
    print("\n->", out)
    print(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v",
                          "-show_entries", "stream=width,height,nb_frames,duration",
                          "-of", "default=nw=1", out],
                         capture_output=True, text=True).stdout)


if __name__ == "__main__":
    main()
