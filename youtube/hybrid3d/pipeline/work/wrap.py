#!/usr/bin/env python3
"""Verify the re-order actually landed, then wait out the render. One call.

Lesson 71 is the reason the first half exists: `status: ok` from the send CLI is
not evidence. A message without an @mention returned a plausible status and left
zero rows in the channel. The only proof is reading the channel back and seeing
my own text there.
"""
import os, sys, json, subprocess, time, re
LOG=open("/tmp/wrap.log","w"); SUM=[]
def log(*a): print(*a,file=LOG); LOG.flush()
def sm(*a):
    s=" ".join(str(x) for x in a); SUM.append(s); log(s)
def flush(): open("/tmp/wrap_summary.txt","w").write("\n".join(SUM)+"\n")

def gsk(args):
    r=subprocess.run(["gsk"]+args,capture_output=True,text=True,timeout=180)
    log("GSK",args,"rc",r.returncode); log(r.stdout[:4000]); log(r.stderr[:2000])
    try: return json.JSONDecoder().raw_decode(r.stdout.strip())[0]
    except Exception as e:
        log("decode fail",e); return None

V2_CH="ch_a156a871acc7e528d846b49dba8553ab"

# ---- 1. did the re-order land? -------------------------------------------
sm("== send verification (channel read-back) ==")
j=gsk(["genteam","read","--channel-id",V2_CH,"--limit","12","--json"])
items=(j or {}).get("data",{}).get("items",[]) or []
mine=[]
for m in items:
    d=m.get("data",{}) or {}
    c=(d.get("content") or "")
    who=d.get("sender_display_name") or "?"
    typ=d.get("sender_actor_type") or "?"
    if "i2v 재발주 5클립" in c:
        mine.append(m)
    log(f"  row {typ}/{who} len={len(c)} head={c[:70]!r}")
sm(f"  rows in channel {len(items)}   my reorder message present: {'YES' if mine else 'NO'}")
if not mine:
    sm("  !! re-order not in channel -- retrying send up to 3x")
    for i in range(3):
        r=subprocess.run([sys.executable,"/home/user/lf/gt/sendv2b.py"],
                         capture_output=True,text=True,cwd="/home/user/lf/gt",timeout=300)
        log(f"RETRY {i} rc={r.returncode}"); log(r.stdout[:3000]); log(r.stderr[:1500])
        time.sleep(4)
        j=gsk(["genteam","read","--channel-id",V2_CH,"--limit","8","--json"])
        it=(j or {}).get("data",{}).get("items",[]) or []
        if any("i2v 재발주 5클립" in ((m.get("data") or {}).get("content") or "") for m in it):
            sm(f"  landed on retry {i+1}"); break
    else:
        sm("  !! STILL NOT LANDED -- needs manual attention")
flush()

# ---- 2. wait out the render ---------------------------------------------
sm("== render ==")
deadline=time.time()+3000
last=-1
while time.time()<deadline:
    alive=subprocess.run("pgrep -f drive500.py",shell=True,
                         capture_output=True).returncode==0
    n=len(os.listdir("_bld500")) if os.path.isdir("_bld500") else 0
    if n!=last: log(f"  pieces={n} alive={alive}"); last=n
    if not alive: break
    time.sleep(10)
tail=open("/tmp/d500c.log").read() if os.path.exists("/tmp/d500c.log") else ""
log("=== DRIVE LOG TAIL ===\n"+tail[-6000:])
skips=re.findall(r"SKIP (\S+?):",tail)
sm(f"  pieces final {len(os.listdir('_bld500')) if os.path.isdir('_bld500') else 0}")
sm(f"  skipped rows {sorted(set(skips))}")
if os.path.exists("act12.mp4"):
    d=subprocess.run(["ffprobe","-v","error","-show_entries","format=duration",
                      "-of","csv=p=0","act12.mp4"],capture_output=True,text=True).stdout.strip()
    sm(f"  act12.mp4 EXISTS {os.path.getsize('act12.mp4')} bytes  dur={d}s")
else:
    sm("  act12.mp4 not produced (expected while 5 clips are outstanding)")
for k in ("PARTIAL","Traceback","Error","error"):
    if k in tail: sm(f"  log mentions {k}")
flush()
