"""3-way A/B with script-flow captions burned in (CEO-48 standing instruction).
(A) current i2v ken-burns   (B) layered depth parallax   (C) previz -> Video-to-Video
NOTE: drawtext text= cannot contain ':' -> use textfile= to stay safe.
"""
import subprocess, os

F = "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf"
SCRIPT = "대본 흐름  「나는 어떤 역할을 반복해 왔는가」"

CLIPS = [("_c_old.mp4",   "A안  현행 i2v (켄번즈 확대)",
          "판정 - 컷 안 모션 없음 / 원근 시차 없음"),
         ("_c_layer.mp4", "B안  깊이 층분리 시차 (무료 자체 구현)",
          "판정 - 시차 있음 / 그러나 서사 없음"),
         ("_c_v2v.mp4",   "C안  3D 프리비즈 -> Video-to-Video",
          "판정 - 시차 + 서사 + 실사 / CEO-51 지시 구현")]


def tf(name, s):
    p = os.path.abspath("_t_%s.txt" % name)
    open(p, "w").write(s)
    return p


sf = tf("script", SCRIPT)
parts = []
for i, (src, title, verdict) in enumerate(CLIPS):
    out = "_lab%d.mp4" % i
    tp, vp = tf("t%d" % i, title), tf("v%d" % i, verdict)
    vf = (
        "scale=1280:720,"
        "drawbox=x=0:y=0:w=1280:h=78:color=black@0.72:t=fill,"
        "drawbox=x=0:y=608:w=1280:h=112:color=black@0.72:t=fill,"
        "drawtext=fontfile=%s:textfile=%s:fontcolor=white:fontsize=38:x=28:y=20,"
        "drawtext=fontfile=%s:textfile=%s:fontcolor=0xFFD54A:fontsize=32:x=28:y=622,"
        "drawtext=fontfile=%s:textfile=%s:fontcolor=0xB8D8FF:fontsize=27:x=28:y=668"
    ) % (F, tp, F, sf, F, vp)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-vf", vf,
                    "-c:v", "libx264", "-preset", "veryfast", "-crf", "19",
                    "-pix_fmt", "yuv420p", "-r", "24", "-an", out], check=True)
    parts.append(out)

with open("_cc.txt", "w") as fh:
    for p in parts:
        fh.write("file '%s'\n" % os.path.abspath(p))
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0",
                "-i", "_cc.txt", "-c", "copy", "AB3_A6.mp4"], check=True)
d = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                    "-of", "csv=p=0", "AB3_A6.mp4"], capture_output=True, text=True)
print("AB3 built  duration", d.stdout.strip(), flush=True)
