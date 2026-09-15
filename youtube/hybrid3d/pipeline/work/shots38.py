# -*- coding: utf-8 -*-
"""ACT3~8 shot table (150.32-500.00s), assembled from the generated rows38 data.

Kept in its own module rather than appended into shots.py for one reason: the
ACT1~2 master already renders and is partly delivered. Editing the file the
working render depends on, in order to add 350 seconds that has no plates yet,
risks the part that works for the part that does not.

shots.py stays the authority for ACT1~2. This is the authority for ACT3~8, and
both are consumed the same way.
"""
import json
import os
import re

_DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "rows38.json")
with open(_DATA, encoding="utf-8") as _f:
    _R = json.load(_f)

REQ_AR, REQ_AR_TOL, REQ_MIN_W = 1920 / 1080, 0.02, 1920

# CEO-16: images are reviewed before they are used. The ACT1~2 anchors cleared
# that gate at CEO-28; the ACT3~8 plates cleared it at CEO-32 — "이미지 퀄리티는
# 합격!" — after all 22 delivered plates passed the free measurement gate
# (gate38.py: 22/22 landscape, 2048x1152, zero failures) and were reviewed as a
# contact sheet grouped by role.
#
# What this flag does NOT authorise: the five plates still in production
# (S23, S27) and the three whose stills come from our own report engine
# (S24/S25/S26). Those are gated per-file by the renderer, which skips a row
# whose still is absent rather than substituting anything. So opening this gate
# permits rendering the approved work; it cannot smuggle in unapproved images.
CEO_PLATE_APPROVAL_38 = True

PANELS38 = _R["panels"]
I2V_ROWS_38 = set(_R["i2v"])
ANCHOR_PLAN = _R["anchor_plan"]

_ORB_FN = {"시선 앵커": "gaze", "연속성 토큰": "token",
           "문장의 주어": "subject", "상태 표시": "state"}


def _orb(txt):
    """V-1 states the orb's job in prose; store the job, not the prose."""
    for k, v in _ORB_FN.items():
        if k in txt:
            return v
    return None


def _kb(row, idx):
    """A Ken Burns move that says what the camera sentence says.

    The camera grammar is not decoration: 도착 is an arrival, so it closes in;
    후퇴 is a conclusion, so it opens out; 관통 travels laterally through; 정지
    barely breathes. Reading the move off the first word keeps the pixels and
    the prose telling the same story, and the pull percentage V-1 wrote is used
    when it wrote one.
    """
    cam = row["cam"]
    m = re.search(r"(\d+(?:\.\d+)?)\s*%", cam)
    pct = float(m.group(1)) / 100.0 if m else 0.030
    pct = min(max(pct, 0.005), 0.060)
    sign = 1 if idx % 2 == 0 else -1
    head = cam.split()[0] if cam else "정지"
    if head == "도착":
        return (1.000, 1.000 + pct, 0.0, 0.004 * sign)
    if head == "후퇴":
        return (1.000 + pct, 1.000, 0.0, -0.004 * sign)
    if head == "관통":
        return (1.010, 1.010 + pct, 0.010 * sign, 0.0)
    return (1.000, 1.000 + min(pct, 0.010), 0.0, 0.002 * sign)


def _row(r, idx):
    d = dict(sid=r["sid"], t0=r["t0"], t1=r["t1"], kind=r["kind"],
             group=r["group"], policy=r["policy"], anchor=r["anchor"],
             panel=r["panel"], text=bool(r["panel"]), src=None, ss=0.05,
             objects=r["objects"] or None, orb=_orb(r["orb_txt"]),
             kb=None if r["kind"] == "i2v" else _kb(r, idx),
             note=(r["cam"][:120] + (" | " + r["protect"] if r["protect"] else "")),
             narr=r["narr"], level=r["level"],
             transition_reason=r["reason"], v1_kind=r["v1_kind"])
    if d["text"] and d["kind"] == "i2v":
        raise ValueError(f"{d['sid']}: text shot cannot be i2v — glyphs resample")
    return d


TABLE38 = [_row(r, i) for i, r in enumerate(_R["rows"])]

ACT3 = [r for r in TABLE38 if r["sid"].startswith("A3")]
ACT4 = [r for r in TABLE38 if r["sid"].startswith("A4")]
ACT5 = [r for r in TABLE38 if r["sid"].startswith("A5")]
ACT6 = [r for r in TABLE38 if r["sid"].startswith("A6")]
ACT7 = [r for r in TABLE38 if r["sid"].startswith("A7")]
ACT8 = [r for r in TABLE38 if r["sid"].startswith("A8")]


def plate_manifest():
    """One entry per plate to generate, carrying every row that will use it.

    A plate serving six rows must satisfy all six camera moves, so the brief has
    to be written against the union, not against the first row that happens to
    reference it. `pad` is the extra framing the pans need: a 3% pull-back off a
    frame-filling composition has nothing to pull back into.
    """
    man = {}
    for r in TABLE38:
        e = man.setdefault(r["anchor"], dict(
            anchor=r["anchor"], kind={"P": "panel", "Q": "sequential",
                                      "S": "scene"}[r["anchor"][0]],
            rows=[], panel=None, secs=0.0, moves=set(), levels=set(),
            objects=[], protect=[], narr=[]))
        e["rows"].append(r["sid"])
        e["secs"] = round(e["secs"] + (r["t1"] - r["t0"]), 2)
        e["moves"].add(r["note"].split()[0])
        e["levels"].add(r["level"])
        if r["panel"]:
            e["panel"] = r["panel"]
        for key, src in (("objects", r["objects"]), ("narr", r["narr"])):
            if src and src not in e[key]:
                e[key].append(src)
        p = r["note"].split(" | ", 1)
        if len(p) == 2 and p[1] not in e["protect"]:
            e["protect"].append(p[1])
    for e in man.values():
        e["moves"] = sorted(e["moves"])
        e["levels"] = sorted(e["levels"])
        e["pad"] = 0.08 if len(e["moves"]) > 1 else 0.05
    return man


def i2v_manifest38():
    return [dict(sid=r["sid"], anchor=r["anchor"], t0=r["t0"], t1=r["t1"],
                 need=round(r["t1"] - r["t0"], 2), group=r["group"],
                 note=r["note"], objects=r["objects"])
            for r in TABLE38 if r["kind"] == "i2v"]
