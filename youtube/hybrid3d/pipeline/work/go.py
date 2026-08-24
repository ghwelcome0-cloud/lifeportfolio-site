#!/usr/bin/env python3
"""Re-run the driver (pieces are reused), measure the partial master, open the PR."""
import os,sys,json,subprocess,re,time
SUM=[]; LOG=open("/tmp/go.log","w")
def log(*a): print(*a,file=LOG); LOG.flush()
def sm(*a):
    s=" ".join(str(x) for x in a); SUM.append(s); log(s)
    open("/tmp/go_summary.txt","w").write("\n".join(SUM)+"\n")
def sh(c,cwd=None,t=900):
    r=subprocess.run(c,shell=True,capture_output=True,text=True,cwd=cwd,timeout=t)
    log(f"$ {c}\nrc={r.returncode}\n{r.stdout[-2500:]}\n{r.stderr[-1200:]}"); return r

r=sh("python3 drive500.py",cwd="/home/user/lf/work/longform",t=1800)
tail=r.stdout+r.stderr
sm("== render ==", f"rc={r.returncode}")
sm(f"  skipped {sorted(set(re.findall(r'SKIP (\S+?):',tail)))}")
if os.path.exists("/home/user/lf/work/longform/act12.mp4"):
    p="/home/user/lf/work/longform/act12.mp4"
    j=json.loads(subprocess.run(["ffprobe","-v","error","-select_streams","v:0",
      "-show_entries","stream=width,height,r_frame_rate,nb_frames",
      "-show_entries","format=duration","-of","json",p],
      capture_output=True,text=True).stdout)
    s=j["streams"][0]
    sm(f"  act12.mp4 {os.path.getsize(p):,} B  {s['width']}x{s['height']} "
       f"{s['r_frame_rate']} {float(j['format']['duration']):.4f}s {s.get('nb_frames')}f")
    sm("  ^ PARTIAL by design: 5 i2v rows still in production at V-2")
else:
    sm("  act12.mp4 ABSENT"); sm("  tail: "+tail[-500:].replace("\n"," | "))

# credit-rules PR
R="/home/user/webapp"
sm("== credit rules PR ==")
sh("git checkout main && git pull --ff-only origin main",cwd=R)
sh("git checkout -B docs/credit-discipline-v1",cwd=R)
sh("git add docs/marketing/youtube/72_CREDIT_DISCIPLINE.md",cwd=R)
msg=open("/home/user/lf/gt/prmsg.txt",encoding="utf-8").read()
open("/tmp/cm.txt","w",encoding="utf-8").write(msg)
sh("git commit -F /tmp/cm.txt",cwd=R)
sh("git push -u origin docs/credit-discipline-v1 --force",cwd=R)
pr=sh('gh pr create --base main --head docs/credit-discipline-v1 '
      '--title "docs(credit): 크레딧 규율 헌법 조항 초안 v1.0 신설" '
      '--body-file /tmp/cm.txt',cwd=R)
url=re.findall(r"https://github\.com/\S+/pull/\d+",pr.stdout+pr.stderr)
sm(f"  PR {url[-1] if url else 'FAILED rc='+str(pr.returncode)}")
if url:
    m=sh(f"gh pr merge {url[-1]} --squash --admin --delete-branch",cwd=R)
    sh("git checkout main && git pull --ff-only origin main",cwd=R)
    h=sh("git rev-parse --short HEAD",cwd=R)
    sm(f"  merge rc={m.returncode}  main={h.stdout.strip()}")
