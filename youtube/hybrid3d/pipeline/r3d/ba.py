"""Before/After: 오철자 영문 -> 정확한 한글. 대본 흐름 병기 (CEO-48)."""
import subprocess, os
F = "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf"
SCRIPT = "대본 흐름  「나는 어떤 역할을 반복해 왔는가」  -  세 프로젝트에서 같은 역할이 반복된다"
CLIPS = [("v2v_A6.mp4",    "BEFORE  프리비즈 = 빈 붉은 큐브",
          "결과 - 오철자 영문 (Report / Renes) · 글자가 통제되지 않음"),
         ("v2v_A6_kr.mp4", "AFTER  프리비즈 = 한글 텍스처를 UV 로 부착",
          "결과 - 정확한 한글 「조율자」 · 3장에서 떠올라 1개로 수렴")]

def tf(n, s):
    p = os.path.abspath("_b_%s.txt" % n); open(p, "w").write(s); return p

sf = tf("s", SCRIPT); parts = []
for i, (src, title, verdict) in enumerate(CLIPS):
    out = "_ba%d.mp4" % i
    tp, vp = tf("t%d" % i, title), tf("v%d" % i, verdict)
    vf = ("scale=1280:720,"
          "drawbox=x=0:y=0:w=1280:h=78:color=black@0.72:t=fill,"
          "drawbox=x=0:y=608:w=1280:h=112:color=black@0.72:t=fill,"
          "drawtext=fontfile=%s:textfile=%s:fontcolor=white:fontsize=38:x=28:y=20,"
          "drawtext=fontfile=%s:textfile=%s:fontcolor=0xFFD54A:fontsize=27:x=28:y=622,"
          "drawtext=fontfile=%s:textfile=%s:fontcolor=0xB8D8FF:fontsize=26:x=28:y=666"
          ) % (F, tp, F, sf, F, vp)
    subprocess.run(["ffmpeg","-y","-loglevel","error","-i",src,"-vf",vf,
                    "-c:v","libx264","-preset","veryfast","-crf","19",
                    "-pix_fmt","yuv420p","-r","24","-an",out], check=True)
    parts.append(out)

with open("_bc.txt","w") as fh:
    for p in parts: fh.write("file '%s'\n" % os.path.abspath(p))
subprocess.run(["ffmpeg","-y","-loglevel","error","-f","concat","-safe","0",
                "-i","_bc.txt","-c","copy","BA_KR.mp4"], check=True)
d = subprocess.run(["ffprobe","-v","error","-show_entries","format=duration",
                    "-of","csv=p=0","BA_KR.mp4"], capture_output=True, text=True)
print("BA built", d.stdout.strip(), flush=True)
