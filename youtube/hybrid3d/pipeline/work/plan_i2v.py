# -*- coding: utf-8 -*-
"""B안 생성 계획표 생성기.

목적
----
설계표(shots38.TABLE38)의 v1_kind 가 'i2v' 로 지정했으나 현재 kind 가
'kenburns' 로 구현된 컷(=교훈 118 의 격차)을 찾아, 같은 plate 위의
연속 시간(run, 교훈 119/제10조)으로 묶고, gemini/omni-flash 의
duration 상한 10초 / 하한 3초에 맞춰 "생성 단위(job)"로 분할한다.

산출
----
plan_i2v.json : job 리스트. 각 job 은
    jid       생성 단위 id (예: J01_S23_a)
    anchor    plate anchor
    sids      이 job 이 덮는 컷 sid 목록
    t0,t1     원 타임라인 절대 시각
    dur       생성 길이 (초, 3.0~10.0)
    notes     컷별 카메라 지시(note) 목록  -> 프롬프트 재료
    narrs     컷별 나레이션                -> 프롬프트 재료
    orbs      오브 기능 목록
    text      한글 유리 패널 포함 여부(하나라도 True 면 True)
"""
import json
import collections
import shots38 as s

GEN_MAX = 10.0   # omni-flash duration 상한
GEN_MIN = 3.0    # omni-flash duration 하한

T = s.TABLE38


def targets():
    """설계 지정 i2v 이지만 현재 정지로 구현된 행의 인덱스."""
    return [i for i, r in enumerate(T)
            if r.get("v1_kind") == "i2v" and r.get("kind") != "i2v"]


def runs(idxs):
    """인덱스가 연속이고 anchor 가 같은 구간으로 묶는다."""
    out = []
    cur = [idxs[0]]
    for i in idxs[1:]:
        prev = cur[-1]
        if i == prev + 1 and T[i]["anchor"] == T[prev]["anchor"]:
            cur.append(i)
        else:
            out.append(cur)
            cur = [i]
    out.append(cur)
    return out


def split(run):
    """한 run 을 GEN_MAX 이하의 job 으로 자른다. 컷 경계는 넘지 않는다."""
    jobs = []
    cur = []
    for i in run:
        span = T[i]["t1"] - T[cur[0]]["t0"] if cur else T[i]["t1"] - T[i]["t0"]
        if cur and span > GEN_MAX:
            jobs.append(cur)
            cur = [i]
        else:
            cur.append(i)
    if cur:
        jobs.append(cur)
    return jobs


def build():
    idxs = targets()
    rs = runs(idxs)
    # 긴 run 우선 (커버 시간이 큰 것부터 만들어 조기에 효과 확인)
    rs.sort(key=lambda r: -(T[r[-1]]["t1"] - T[r[0]]["t0"]))

    jobs = []
    n = 0
    for r in rs:
        for k, j in enumerate(split(r)):
            n += 1
            t0 = T[j[0]]["t0"]
            t1 = T[j[-1]]["t1"]
            raw = t1 - t0
            dur = max(GEN_MIN, min(GEN_MAX, raw))
            jobs.append({
                "jid": "J%02d_%s_%s" % (n, T[j[0]]["anchor"], chr(97 + k)),
                "anchor": T[j[0]]["anchor"],
                "sids": [T[i]["sid"] for i in j],
                "t0": round(t0, 2),
                "t1": round(t1, 2),
                "raw": round(raw, 2),
                "dur": int(round(dur)) if abs(dur - round(dur)) < 1e-9 else round(dur, 2),
                "notes": [T[i].get("note") or "" for i in j],
                "narrs": [T[i].get("narr") or "" for i in j],
                "objs": [T[i].get("objects") or "" for i in j],
                "orbs": [T[i].get("orb") or "" for i in j],
                "text": any(bool(T[i].get("text")) for i in j),
            })
    return jobs


if __name__ == "__main__":
    jobs = build()
    cuts = sum(len(j["sids"]) for j in jobs)
    cov = sum(j["raw"] for j in jobs)
    print("대상 컷        %d" % len(targets()))
    print("연속 run       %d" % len(runs(targets())))
    print("생성 job       %d" % len(jobs))
    print("덮는 컷        %d" % cuts)
    print("덮는 시간      %.1f초" % cov)
    print("한글패널 포함  %d job" % sum(1 for j in jobs if j["text"]))
    print()
    print("%-16s %-6s %-7s %-6s %s" % ("jid", "anchor", "dur", "cuts", "range"))
    for j in jobs:
        print("%-16s %-6s %-7s %-6d %.2f~%.2f" %
              (j["jid"], j["anchor"], j["dur"], len(j["sids"]), j["t0"], j["t1"]))
    with open("plan_i2v.json", "w") as f:
        json.dump(jobs, f, ensure_ascii=False, indent=1)
    print("\nwrote plan_i2v.json")
