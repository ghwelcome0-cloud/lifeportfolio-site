#!/usr/bin/env python3
"""Correct the flag, count duplicates, then report the render. One call.

The read failure was mine: `--channel-id` with a hyphen, while the CLI declares
`--channel_id` with an underscore. The send had already succeeded (mid 2881303),
so my retry loop was firing at a problem that did not exist -- which is exactly
how duplicate work orders get created. Counting them is not optional: five
duplicate clips is five duplicate charges.
"""
import os,sys,json,subprocess,re,time
LOG=open("/tmp/chk.log","w"); SUM=[]
def log(*a): print(*a,file=LOG); LOG.flush()
def sm(*a):
    s=" ".join(str(x) for x in a); SUM.append(s); log(s)

def gsk(a):
    r=subprocess.run(["gsk"]+a,capture_output=True,text=True,timeout=180)
    log("GSK",a,"rc",r.returncode); log(r.stdout[:2000]); log(r.stderr[:800])
    try: return json.JSONDecoder().raw_decode(r.stdout.strip())[0]
    except Exception as e: log("decode",e); return None

CH="ch_a156a871acc7e528d846b49dba8553ab"
j=gsk(["genteam","read","--channel_id",CH,"--limit","30"])
items=(j or {}).get("data",{}).get("items",[]) or []
sm(f"== V-2 channel: {len(items)} rows ==")
dup=[]
for m in items:
    d=m.get("data",{}) or {}
    c=d.get("content") or ""
    who=d.get("sender_display_name") or "?"
    typ=d.get("sender_actor_type") or "?"
    mid=d.get("comet_message_id") or m.get("id")
    tag="REORDER" if "i2v 재발주 5클립" in c else ("ORDER" if "i2v 8클립" in c or "왜 24개" in c else "")
    if tag=="REORDER": dup.append(mid)
    sm(f"  {typ:<6} {who[:22]:<22} mid={mid} len={len(c):<6} {tag}")
sm(f"  !! duplicate re-orders: {len(dup)}  ids={dup}")
open("/tmp/chk_summary.txt","w").write("\n".join(SUM)+"\n")

# if duplicated, post one correction immediately so the agent does not bill twice
if len(dup)>1:
    fix=("@[AI 비디오 커스텀 에이전트](agent_4gettwpxdxp6)\n\n"
         "■ 중복 발송 정정 — 재발주는 1회만 수행해주세요\n\n"
         "직전에 'i2v 재발주 5클립' 메시지가 여러 번 전송되었습니다. 제 발송 확인 코드의 오류였고, "
         "내용은 모두 동일합니다.\n"
         "A1-06 / A1-08 / A2-02 / A2-04 / A2-13 — 이 5클립을 각각 1개씩만 생성해주세요. "
         "같은 클립을 여러 번 생성하지 마세요. 크레딧이 그만큼 이중 청구됩니다.\n"
         "이미 중복 생성에 착수했다면 즉시 중단하고, 완성된 것 1개씩만 납품해주세요.")
    o=gsk(["genteam","send","--channel_id",CH,"--content",fix,
           "--operation_id","v2-dedupe-20260819"])
    d=(o or {}).get("data",{}) or {}
    if not d.get("comet_message_id"):
        o=gsk(["genteam","send","--channel_id",CH,"--content",fix,
               "--operation_id","v2-dedupe-20260819"])
        d=(o or {}).get("data",{}) or {}
    sm(f"  dedupe notice sent: status={d.get('status')} mid={d.get('comet_message_id')}")
open("/tmp/chk_summary.txt","w").write("\n".join(SUM)+"\n")

# render state
sm("== render ==")
for _ in range(150):
    alive=subprocess.run("pgrep -f drive500.py",shell=True,capture_output=True).returncode==0
    if not alive: break
    time.sleep(10)
tail=open("/tmp/d500c.log").read() if os.path.exists("/tmp/d500c.log") else ""
log("=== TAIL ===\n"+tail[-8000:])
sm(f"  pieces {len(os.listdir('_bld500')) if os.path.isdir('_bld500') else 0}")
sm(f"  skipped {sorted(set(re.findall(r'SKIP (\S+?):',tail)))}")
if os.path.exists("act12.mp4"):
    d=subprocess.run(["ffprobe","-v","error","-show_entries","format=duration",
        "-of","csv=p=0","act12.mp4"],capture_output=True,text=True).stdout.strip()
    sm(f"  act12.mp4 {os.path.getsize('act12.mp4')} bytes dur={d}s")
else:
    sm("  act12.mp4 absent")
if "PARTIAL" in tail: sm("  driver reported PARTIAL master (5 clips outstanding)")
if "Traceback" in tail: sm("  !! TRACEBACK in driver log")
open("/tmp/chk_summary.txt","w").write("\n".join(SUM)+"\n")
