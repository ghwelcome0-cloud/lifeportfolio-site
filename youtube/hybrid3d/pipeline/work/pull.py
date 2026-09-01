"""Harvest team deliverables + report V-2 clip URLs, in one pass."""
import subprocess, json, re
def gsk(a):
    p=subprocess.run(["gsk"]+a,capture_output=True,text=True,timeout=180)
    try: return json.JSONDecoder().raw_decode(p.stdout.strip())[0]
    except Exception: return {}
CH=[("V2","ch_a156a871acc7e528d846b49dba8553ab"),
    ("V1","ch_a54522b3ecd26d467ce5c0d69ec16c6b"),
    ("PM","ch_10a7a9bf427525bff495cb7499c4b486")]
out={}
for who,ch in CH:
    o=gsk(["genteam","read","--channel_id",ch,"--limit","6"])
    items=(o.get("data") or {}).get("items") or []
    ag=[m for m in items if (m.get("data") or {}).get("sender_actor_type")=="agent"]
    txt="\n\n".join((m.get("data") or {}).get("content") or "" for m in ag[-3:])
    ids=re.findall(r"files/s/(\w+)",txt)
    out[who]={"ids":ids,"text":txt}
    print(f"===== {who}  ids={ids}")
    print(txt[:1500])
    print()
json.dump(out,open("/tmp/pull.json","w"))
