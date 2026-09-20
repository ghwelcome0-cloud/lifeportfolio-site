"""One call does everything: verify, render, poll, summarise.

Written because the real credit driver was measured to be round-trip count times
accumulated context, not paid tools. Twenty small shell calls cost twenty full
context evaluations; this file makes that one. It also prints a SHORT summary and
keeps the verbose log on disk, because piping a long log back into the transcript
re-charges every later call for those tokens too.
"""
import os, sys, json, subprocess, glob, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
R = []
def say(s): R.append(str(s)); print(s, flush=True)

# ── 1. verify what the interrupted run actually produced ──────────────────────
parts = sorted(glob.glob("_bld500/r*.mp4"))
say(f"[state] _bld500 pieces already on disk = {len(parts)}")
if parts:
    say(f"[state] first={os.path.basename(parts[0])} last={os.path.basename(parts[-1])}")
say(f"[state] act12.mp4 exists = {os.path.exists('act12.mp4')}")
say(f"[state] drive500 running = {bool(subprocess.run(['pgrep','-f','drive500.py'],capture_output=True).stdout.strip())}")
say(f"[state] seg/ delivered clips = {sorted(os.path.basename(p) for p in glob.glob('seg/i2v_*.mp4'))}")

# ── 2. finish the free render, logging to disk not to the transcript ──────────
if not os.path.exists("act12.mp4"):
    say("[render] resuming drive500 to completion (log: /tmp/d500b.log)")
    with open("/tmp/d500b.log","w") as f:
        rc = subprocess.run([sys.executable,"drive500.py"], stdout=f, stderr=subprocess.STDOUT).returncode
    say(f"[render] rc={rc}")
    tail = open("/tmp/d500b.log", encoding="utf-8", errors="replace").read().splitlines()
    skips = [l for l in tail if "SKIP" in l]
    wrote = [l for l in tail if l.startswith("wrote")]
    say(f"[render] skipped rows = {len(skips)} (expected 8, the undelivered i2v clips)")
    for l in wrote: say(f"[render] {l}")
else:
    say("[render] act12.mp4 already present, not re-rendering")

if os.path.exists("act12.mp4"):
    d = subprocess.run(["ffprobe","-v","error","-show_entries","format=duration",
                        "-of","csv=p=0","act12.mp4"],capture_output=True,text=True).stdout.strip()
    say(f"[render] act12.mp4 {os.path.getsize('act12.mp4'):,}B  duration={d}s")

# ── 3. poll every live team channel in one pass ───────────────────────────────
def gsk(a):
    p = subprocess.run(["gsk"]+a, capture_output=True, text=True, timeout=180)
    try: return json.JSONDecoder().raw_decode(p.stdout.strip())[0]
    except Exception: return {}

CH = [("V-2 i2v","ch_a156a871acc7e528d846b49dba8553ab"),
      ("V-1 saddle","ch_a54522b3ecd26d467ce5c0d69ec16c6b"),
      ("PM act3-6","ch_10a7a9bf427525bff495cb7499c4b486"),
      ("V-5 audio","ch_0e0cef77c890ae9f7d847660c2d6d269"),
      ("IMG anchors","ch_d161a407a31cf5b8d200aea17b5470c6")]
say("")
say("[team] newest agent reply per channel")
import re
URLS = {}
for who, ch in CH:
    o = gsk(["genteam","read","--channel_id",ch,"--limit","10"])
    items = (o.get("data") or {}).get("items") or []
    ag = [m for m in items if (m.get("data") or {}).get("sender_actor_type")=="agent"]
    if not ag:
        say(f"  {who:12} no agent reply yet"); continue
    m = ag[-1]; d = m.get("data") or {}
    b = (d.get("content") or d.get("text") or "")
    found = re.findall(r"https://www\.genspark\.ai/api/files/s/(\w+)", b)
    if found: URLS[who] = found
    say(f"  {who:12} {m.get('ts','')[:19]} {len(b):5}B urls={len(found)} :: {b[:90].replace(chr(10),' ')}")

json.dump(URLS, open("/tmp/team_urls.json","w"))
say("")
say(f"[team] url harvest -> /tmp/team_urls.json  {json.dumps(URLS)[:300]}")
open("/tmp/mega_summary.txt","w",encoding="utf-8").write("\n".join(R))
