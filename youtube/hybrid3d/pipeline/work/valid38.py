# -*- coding: utf-8 -*-
"""Free structural gate for the ACT3~8 table. Refuses on anything a renderer
would otherwise turn into silently wrong pixels."""
import sys, shots38 as T

E, W = [], []
rows = T.TABLE38
for a, b in zip(rows, rows[1:]):
    if b["t0"] < a["t1"] - 1e-6:
        E.append(f"overlap {a['sid']} -> {b['sid']}")
    if b["t0"] - a["t1"] > 1.5:
        W.append(f"gap {b['t0']-a['t1']:.2f}s after {a['sid']}")
for r in rows:
    d = r["t1"] - r["t0"]
    if d <= 0:
        E.append(f"{r['sid']} duration {d}")
    if d > 6.5:
        W.append(f"{r['sid']} {d:.2f}s long — subsegment split required")
    if r["text"] and r["kind"] == "i2v":
        E.append(f"{r['sid']} text+i2v")
    if r["policy"] == "intentional_transition" and not r["transition_reason"]:
        E.append(f"{r['sid']} transition without reason")
    if r["kind"] == "kenburns" and r["kb"] is None:
        E.append(f"{r['sid']} kenburns without kb")
    if r["kind"] == "i2v" and r["kb"] is not None:
        E.append(f"{r['sid']} i2v carries kb")
    if r["anchor"] is None:
        E.append(f"{r['sid']} no plate")
if len(T.PANELS38) > 5:
    E.append(f"panels {len(T.PANELS38)} > 5 (PM cap)")
for s in ("A6-GAP", "A8-GAP", "A8-UNCERTAIN"):
    if s not in {r["sid"] for r in rows}:
        E.append(f"protected row {s} missing")
    else:
        r = next(x for x in rows if x["sid"] == s)
        if r["kind"] == "i2v":
            E.append(f"{s} must not be generated — it is a hold")
# ACT8 may only ever show folios 3, 5 and 8
for r in rows:
    if r["sid"].startswith("A8"):
        for bad in ("4쪽", "6쪽", "9쪽", "7쪽"):
            if bad in (r["objects"] or "") + (r["narr"] or ""):
                E.append(f"{r['sid']} references forbidden folio {bad}")

man = T.plate_manifest()
print(f"rows {len(rows)}  span {rows[0]['t0']:.2f}-{rows[-1]['t1']:.2f}s")
print(f"kenburns {sum(1 for r in rows if r['kind']=='kenburns')}  "
      f"i2v {sum(1 for r in rows if r['kind']=='i2v')}")
print(f"plates {len(man)}  panel {sum(1 for e in man.values() if e['kind']=='panel')}  "
      f"sequential {sum(1 for e in man.values() if e['kind']=='sequential')}  "
      f"scene {sum(1 for e in man.values() if e['kind']=='scene')}")
print(f"total declared {sum(r['t1']-r['t0'] for r in rows):.2f}s of "
      f"{rows[-1]['t1']-rows[0]['t0']:.2f}s span")
print(f"ERRORS {len(E)}"); [print("  E", x) for x in E]
print(f"WARNS  {len(W)}"); [print("  W", x) for x in W[:12]]
sys.exit(1 if E else 0)
