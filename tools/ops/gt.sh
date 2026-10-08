#!/bin/bash
# Short, non-blocking GenTeam reader. Usage: gt.sh <channel_or_thread_id> [after_message_id] [limit]
CH="${1:-ch_4a2fbfcc47273beedd780750b6532efe}"; AFTER="$2"; LIM="${3:-30}"
ARGS=(--channel_id "$CH" --limit "$LIM")
[ -n "$AFTER" ] && ARGS+=(--after_message_id "$AFTER")
timeout 60 gsk genteam read "${ARGS[@]}" 2>&1 | python3 -c '
import sys,json
raw=sys.stdin.read()
try: d=json.loads(raw)
except Exception: print(raw[:800]); sys.exit(0)
data=d.get("data",{})
if data.get("status")!="ok": print(json.dumps(data,ensure_ascii=False)[:500]); sys.exit(0)
items=data.get("items",[])
print("count",len(items))
for it in items:
    m=it.get("data",{})
    print("=== id",m.get("comet_message_id"),"|",m.get("sender_display_name"),"|",it.get("ts"),"| thread",m.get("thread_id"),"| parent",m.get("parent_comet_message_id"))
    print((m.get("display_text") or m.get("content") or "")[:2500])
    for a in m.get("attachments",[]) or []:
        print("  ATT:",json.dumps(a,ensure_ascii=False)[:400])
'
