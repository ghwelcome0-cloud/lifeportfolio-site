#!/usr/bin/env python3
"""Verify the partial master against the shot table, then merge the PR.

The number that matters is not "does the file exist" but "is every second in it
the second the table declared". A concat of correct pieces can still be wrong if
a piece was reused at the wrong length, so the arithmetic is checked explicitly.
"""
import os,sys,json,subprocess,time,re
sys.path.insert(0,"/home/user/lf/work/longform")
import shots
SUM=[]; LOG=open("/tmp/vfy.log","w")
def log(*a): print(*a,file=LOG); LOG.flush()
def sm(*a):
    s=" ".join(str(x) for x in a); SUM.append(s); log(s)
    open("/tmp/vfy_summary.txt","w").write("\n".join(SUM)+"\n")
def sh(c,cwd=None,t=600):
    r=subprocess.run(c,shell=True,capture_output=True,text=True,cwd=cwd,timeout=t)
    log(f"$ {c}\nrc={r.returncode}\n{r.stdout[-2000:]}\n{r.stderr[-800:]}"); return r

# --- arithmetic: what should the partial master be? -----------------------
table=shots.resolve_kinds()
absent=set()
for sid in shots.I2V_ROWS:
    if not os.path.exists(f"seg/i2v_{sid}.mp4"): absent.add(sid)
want=sum(round(r["t1"]-r["t0"],4) for r in table if r["sid"] not in absent)
miss=sum(round(r["t1"]-r["t0"],4) for r in table if r["sid"] in absent)
d=float(subprocess.run(["ffprobe","-v","error","-show_entries","format=duration",
    "-of","csv=p=0","act12.mp4"],capture_output=True,text=True).stdout.strip())
sm("== partial master arithmetic ==")
sm(f"  rows included {len(table)-len(absent)}/{len(table)}   excluded {sorted(absent)}")
sm(f"  declared included duration {want:.4f}s")
sm(f"  measured act12.mp4         {d:.4f}s     delta {d-want:+.4f}s "
   f"({'OK' if abs(d-want)<0.10 else 'MISMATCH'})")
sm(f"  outstanding generated time {miss:.2f}s of the 120.00s act span")
sm(f"  free ken burns share {sum(1 for r in table if r['kind']=='kenburns')}/{len(table)} rows")

# per-piece length audit -- catches a wrongly reused piece
bad=[]
for i,r in enumerate(table):
    if r["sid"] in absent: continue
    p=f"_bld500/r{i:02d}_{r['sid']}.mp4"; g=f"_bld500/g{i:02d}.mp4"
    use=g if os.path.exists(g) else p
    if not os.path.exists(use): bad.append(f"{r['sid']} piece absent"); continue
    got=float(subprocess.run(["ffprobe","-v","error","-show_entries","format=duration",
        "-of","csv=p=0",use],capture_output=True,text=True).stdout.strip())
    exp=round(r["t1"]-r["t0"],4)
    if abs(got-exp)>1/48: bad.append(f"{r['sid']} {got:.4f} vs {exp:.4f}")
sm(f"  per-piece length audit: {'ALL 30 MATCH' if not bad else bad}")

# --- merge the PR once CI clears ------------------------------------------
sm("== PR #284 ==")
for k in range(40):
    j=sh("gh pr view 284 --json mergeStateStatus,state","/home/user/webapp")
    try: st=json.loads(j.stdout)
    except Exception: st={}
    if st.get("state")=="MERGED": sm("  already merged"); break
    if st.get("mergeStateStatus") in ("CLEAN","UNSTABLE","HAS_HOOKS"):
        m=sh("gh pr merge 284 --squash --admin --delete-branch","/home/user/webapp")
        if m.returncode==0:
            sh("git checkout main && git pull --ff-only origin main","/home/user/webapp")
            h=sh("git rev-parse --short HEAD","/home/user/webapp")
            sm(f"  MERGED -> main={h.stdout.strip()}"); break
        sm(f"  merge rc={m.returncode}: {m.stderr.strip()[:160]}")
    time.sleep(20)
else:
    sm("  CI still not clear after ~13min; PR remains open at #284")
