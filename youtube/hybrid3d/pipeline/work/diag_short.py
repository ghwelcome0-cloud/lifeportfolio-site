"""SHORT / BAD 의 원인을 특정한다.

BAD  = 파일이 없다 -> baked-text 7 job 으로 생성에서 제외한 sid 인가? (제11조)
SHORT= 파일은 있으나 짧다 -> 소스 job 의 요청 duration 을 정수 초로 내렸기 때문인가?
"""
import json
import shots38 as shots

FR = 1.0 / 24.0
jobs = json.load(open("prompts_i2v.json"))
SID2JOB = {}
for j in jobs:
    for sid in j["sids"]:
        SID2JOB[sid] = j

rows = {r["sid"]: r for r in shots.TABLE38}
targets = [r for r in shots.TABLE38 if r.get("v1_kind") == "i2v"]

BAD = "A3-01 A3-02 A3-03 A3-04 A3-05 A3-06 A3-12 A4-01 A5-10 A7-04".split()
SHORT = ("A3-08 A3-09 A3-10 A3-11 A3-13 A3-16 A3-17 A4-07 A4-09 A4-12 A5-02 "
         "A5-05 A5-09 A5-12 A5-13 A6-01 A6-02 A6-08 A7-03 A7-09 A7-10 A7-12 "
         "A7-14").split()

print("=== BAD 10 : prompts_i2v.json 에 있는가? ===")
for sid in BAD:
    j = SID2JOB.get(sid)
    r = rows[sid]
    print("  %-7s anchor=%-4s job=%s" % (sid, r["anchor"], j["jid"] if j else "★없음(생성제외)★"))

print("\n=== SHORT 23 : 소스 job 요청 duration vs 필요 길이 ===")
print("  sid     job            anchor  job_raw job_req  sid_need  부족   k")
for sid in SHORT:
    j = SID2JOB.get(sid)
    r = rows[sid]
    dur = round(r["t1"] - r["t0"], 4)
    need = r["ss"] + dur + 2 * FR
    if j is None:
        print("  %-7s ★job 없음★" % sid)
        continue
    req = j["dur"]
    print("  %-7s %-14s %-6s %6.2f %6.2f  %8.3f  %+.3f  %.4f"
          % (sid, j["jid"], r["anchor"], j["raw"], req, need, req - need,
             (need + 0.05) / req if req else 0))

print("\n=== SHORT job 별 sid 개수 (한 job 이 여러 sid 를 덮는가) ===")
from collections import Counter
c = Counter(SID2JOB[s]["jid"] for s in SHORT if s in SID2JOB)
for jid, n in sorted(c.items()):
    allsids = SID2JOB_rev = [x for x in SID2JOB if SID2JOB[x]["jid"] == jid]
    print("  %-14s SHORT %d / job 전체 sid %d  %s" % (jid, n, len(allsids), allsids))
