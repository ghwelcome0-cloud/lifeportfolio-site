# -*- coding: utf-8 -*-
"""Turn the two team design documents into machine-readable ACT3~8 rows.

Why a parser and not hand transcription: the V-1 saddle carries 80 rows and the
PM sheet 58, on two different time notations. Retyping 138 rows by hand is how a
timeline silently loses a row, and a lost row is 2-6 seconds of black frames at
the 400 second mark that nobody sees until the CEO does. The parser also lets
the *selection* decisions (which rows justify a generated clip) be stated once,
as code, next to the evidence they rest on.
"""
import re, json, os, unicodedata

GT = "/home/user/lf/gt"
V1 = f"{GT}/v1_act3_8_saddle.md"
PM = f"{GT}/pm_act3_6.md"

def cells(line):
    s = line.strip()
    if s.startswith("|"): s = s[1:]
    if s.endswith("|"):   s = s[:-1]
    return [c.strip() for c in s.split("|")]

# ── V-1 : 7 columns, times joined by EN DASH U+2013 ───────────────────────────
V1_ROWS = []
for ln in open(V1, encoding="utf-8"):
    if ln.count("|") < 6: continue
    c = cells(ln)
    if len(c) != 7: continue
    if not re.match(r"^A\d-", c[0]): continue
    m = re.match(r"^(\d+\.\d+)\s*[\u2013\u2014-]\s*(\d+\.\d+)$", c[1])
    if not m: raise SystemExit(f"V1 time unparsed: {c[0]} {c[1]!r}")
    pol_raw = c[5]
    if pol_raw.startswith("intentional_transition"):
        policy, reason = "intentional_transition", pol_raw.split("—",1)[-1].strip()
    else:
        policy, reason = "continuous", None
    V1_ROWS.append(dict(sid=c[0], t0=float(m.group(1)), t1=float(m.group(2)),
                        cam=c[2], level=c[3].split()[0], orb_txt=c[4],
                        policy=policy, reason=reason,
                        v1_kind="i2v" if c[6].upper()=="I2V" else "kenburns"))

# ── PM : 6 columns, times joined by TILDE ─────────────────────────────────────
PM_ROWS = []
for ln in open(PM, encoding="utf-8"):
    if ln.count("|") < 5: continue
    c = cells(ln)
    if len(c) != 6: continue
    m = re.match(r"^(\d+\.\d+)\s*~\s*(\d+\.\d+)$", c[0])
    if not m: continue
    PM_ROWS.append(dict(t0=float(m.group(1)), t1=float(m.group(2)),
                        narr=c[1], objects=c[2], text_req=c[3],
                        link=c[4], protect=c[5]))

def pm_for(r):
    """PM row with the largest time overlap. PM merges some V-1 rows, so a
    plain equality join would drop rows; overlap is the only join that survives
    the two documents disagreeing about sentence boundaries."""
    best, bo = None, 0.0
    for p in PM_ROWS:
        o = min(r["t1"], p["t1"]) - max(r["t0"], p["t0"])
        if o > bo: best, bo = p, o
    return best

# ── glass panels : PM recommends five, and names the two to drop ──────────────
APPROVED = ["직무명이 아닙니다", "두 장면을 떠올려 보세요", "정답은 없습니다",
            "남기고 싶은 변화", "정답 공식이 아니라, 더 좋은 질문"]
def panel_of(p):
    if not p: return None, None
    t = p["text_req"]
    if "유리 패널" not in t: return None, None
    g = re.findall(r"`([^`]+)`", t)
    if not g: return None, None
    s = g[0].strip()
    for a in APPROVED:
        if a in s or s in a: return a, None
    return None, s                      # dropped, with the reason recorded

# ── generated-clip budget ─────────────────────────────────────────────────────
# CEO-30: "비디오가 크레딧을 많이 소비되긴 하네요". A generated clip only earns
# its cost when an object inside the frame physically changes. Camera-only moves
# (도착/후퇴/정지, dolly, pull-back, parallax) are free on a large still.
#
# Sequential reveals (표 1행→2행→3행, 카드 점등 순서) are deliberately NOT i2v:
# one video cannot show "row 2 empty" and "row 2 filled" in the same shot without
# either breaking PM's 선행 금지 gate or inventing motion. Those become several
# still plates instead — images are far cheaper than video and the gate holds.
CHANGE_KW = ["드러남","드러난","펼치","펼쳐","벌어","열리","열림","자라",
             "쌓이","넘기","넘어","손이","말려","흩어","기울","젖"]
SEQ_KW    = ["첫 행만","둘째 행만","셋째 행만","순차","추가","채워","점등","활성"]
I2V_CAP   = 10

PROTECT_KW = ["pixel-safe", "Ken Burns", "패널", "지면", "folio", "글자",
              "정보 추가", "선행", "새 정보"]

def i2v_score(r, p):
    """Score a row for a generated clip, or -1 to leave it on a still.

    Four independent vetoes, each recording a reason the row must not become
    video. They exist because the first version of this function proposed
    A6-GAP (a deliberate silent hold whose whole purpose is that nothing new
    appears) and A3-15 (a shot carrying panel glyphs). Both would have been
    paid-for regressions, so the vetoes are stated before the scoring.
    """
    if p is None: return -1
    # (1) V-1 already decided. It marks KENBURNS exactly where glyph pixels or
    #     "no new information" must survive, and it knows things the keyword
    #     scan does not. Never overrule it upward.
    if r["v1_kind"] != "i2v": return -1
    # (2) A hold is defined by the absence of change. Generating motion into it
    #     destroys the thing it is for.
    if r["cam"].startswith("정지"): return -1
    if r["sid"].endswith("GAP") or r["sid"].endswith("UNCERTAIN"): return -1
    # (3) Anything the PM sheet asks us to protect stays a still.
    if any(k in p["protect"] for k in PROTECT_KW): return -1
    if any(k in r["orb_txt"] for k in ("패널", "지면")): return -1
    # (4) Sequential reveals are several stills, not one video (see below).
    if any(k in p["objects"] for k in SEQ_KW): return -1
    hits = [k for k in CHANGE_KW if k in (p["objects"] + " " + r["cam"])]
    if not hits: return -1
    return round((r["t1"] - r["t0"]) + 2.0 * len(hits), 3)

# ── build rows ────────────────────────────────────────────────────────────────
ROWS, PANELS38, dropped = [], {}, []
anchor_seq, cur_anchor, prev_anchor = 0, None, None
scored = []
for i, r in enumerate(V1_ROWS):
    p = pm_for(r)
    pan, drop = panel_of(p)
    if drop: dropped.append((r["sid"], drop))

    # Plate allocation. Three cases, and the third is the one the validator
    # caught me getting wrong.
    #
    #  P — a glass panel needs its own composition, and afterwards we return to
    #      the plate we were on, so the panel reads as an overlay on the scene
    #      rather than as a scene change.
    #  Q — a sequential reveal. The PM gate says row 2 must not be visible while
    #      row 1 is being narrated. One still cannot be both, and one generated
    #      clip cannot be either without inventing the fill motion. So each
    #      state gets its own plate: three plates showing 1, 2, 3 filled rows.
    #      Stills are the cheap axis; this is where to spend instead of video.
    #  S — the world genuinely changed (intentional_transition), or we have no
    #      plate yet.
    seq = bool(p) and any(k in p["objects"] for k in SEQ_KW)
    if pan:
        anchor_seq += 1
        cur_anchor, prev_anchor = f"P{anchor_seq:02d}", cur_anchor
    elif seq:
        anchor_seq += 1
        cur_anchor, prev_anchor = f"Q{anchor_seq:02d}", None
    else:
        if prev_anchor is not None:
            cur_anchor, prev_anchor = prev_anchor, None
        elif cur_anchor is None or r["policy"] == "intentional_transition":
            anchor_seq += 1
            cur_anchor = f"S{anchor_seq:02d}"

    kind = "kenburns" if (pan or seq) else r["v1_kind"]
    row = dict(sid=r["sid"], t0=r["t0"], t1=r["t1"], kind=kind,
               group=f"{r['sid'][:2]}_{r['level']}", policy=r["policy"],
               anchor=cur_anchor, panel=pan, level=r["level"],
               cam=r["cam"], orb_txt=r["orb_txt"],
               objects=(p["objects"] if p else ""),
               protect=(p["protect"] if p else ""),
               narr=(p["narr"] if p else ""),
               reason=r["reason"], v1_kind=r["v1_kind"])
    if pan: PANELS38[r["sid"]] = pan
    ROWS.append(row)
    scored.append((i2v_score(r, p), r["sid"]))

scored = sorted([s for s in scored if s[0] > 0], reverse=True)
I2V38 = set(sid for _, sid in scored[:I2V_CAP])
for row in ROWS:
    if row["kind"] == "i2v" and row["sid"] not in I2V38:
        row["kind"] = "kenburns"; row["demoted_by_budget"] = True
    else:
        row["demoted_by_budget"] = False

# ── make the timeline contiguous ──────────────────────────────────────────────
# V-1 wrote the measured narration cue times, so consecutive rows are separated
# by the pauses between sentences: 80 rows declare 290.53s inside a 349.68s
# span. Those 59 seconds are not an absence of design, they are the breaths
# between sentences — but a renderer given a gap emits nothing, and nothing is
# 59 seconds of black frames spread through the second half of the film.
#
# A shot holds until the next shot begins. Extending each row's end to the next
# row's start is what the camera actually does during a pause, and it keeps the
# row count, the plate assignment and every cue time exactly as designed. The
# original end is preserved so the audio-relative intent stays auditable.
_held = 0.0
for a, b in zip(ROWS, ROWS[1:]):
    a["t1_cue"] = a["t1"]
    if b["t0"] > a["t1"]:
        _held += b["t0"] - a["t1"]
        a["t1"] = b["t0"]
ROWS[-1]["t1_cue"] = ROWS[-1]["t1"]
HELD_SECS = round(_held, 3)

# ── structural validation : free, deterministic, and able to refute me ────────
errs, warns = [], []
for a, b in zip(ROWS, ROWS[1:]):
    if b["t0"] < a["t1"] - 1e-6: errs.append(f"overlap {a['sid']}->{b['sid']}")
    if b["t0"] - a["t1"] > 1e-6: errs.append(f"gap remains {a['sid']}->{b['sid']}")
for r in ROWS:
    if r["panel"] and r["kind"] == "i2v": errs.append(f"{r['sid']} panel+i2v")
    if r["t1"] <= r["t0"]: errs.append(f"{r['sid']} non-positive duration")
    if r["policy"] == "intentional_transition" and not r["reason"]:
        errs.append(f"{r['sid']} intentional_transition without reason")
need = {"A6-GAP", "A8-GAP", "A8-UNCERTAIN"}
missing = need - {r["sid"] for r in ROWS}
if missing: errs.append(f"protected rows missing: {sorted(missing)}")
if len(PANELS38) > 5: errs.append(f"panel count {len(PANELS38)} > 5")

anchors = sorted({r["anchor"] for r in ROWS})
by_anchor = {}
for r in ROWS: by_anchor.setdefault(r["anchor"], []).append(r["sid"])

# JSON stays JSON. Emitting it into a .py file produced `false` where Python
# wants `False` — a data format pretending to be source code. The consumer
# loads it explicitly instead, which also means the file cannot smuggle in
# executable content.
out = "/home/user/lf/work/longform/rows38.json"
with open(out, "w", encoding="utf-8") as f:
    json.dump(dict(panels=PANELS38, i2v=sorted(I2V38),
                   anchor_plan=by_anchor, rows=ROWS),
              f, ensure_ascii=False, indent=1)

# ── report ────────────────────────────────────────────────────────────────────
L = []
L.append(f"V1 rows {len(V1_ROWS)}   PM rows {len(PM_ROWS)}   built {len(ROWS)}")
L.append(f"span {ROWS[0]['t0']:.2f} -> {ROWS[-1]['t1']:.2f}s")
L.append(f"pauses absorbed into holds: {HELD_SECS:.2f}s; timeline now contiguous")
L.append(f"declared total {sum(r['t1']-r['t0'] for r in ROWS):.2f}s "
         f"vs span {ROWS[-1]['t1']-ROWS[0]['t0']:.2f}s")
L.append(f"v1 said i2v {sum(1 for r in ROWS if r['v1_kind']=='i2v')}  "
         f"-> kept {sum(1 for r in ROWS if r['kind']=='i2v')}  "
         f"kenburns {sum(1 for r in ROWS if r['kind']=='kenburns')}")
L.append(f"panels {len(PANELS38)} {list(PANELS38.items())}")
L.append(f"dropped panels {dropped}")
L.append(f"distinct plates needed {len(anchors)}  "
         f"(scene {sum(1 for a in anchors if a[0]=='S')}"
         f" / panel {sum(1 for a in anchors if a[0]=='P')}"
         f" / sequential {sum(1 for a in anchors if a[0]=='Q')})")
L.append("i2v selected (score, sid):")
for s, sid in scored[:I2V_CAP]:
    r = next(x for x in ROWS if x["sid"] == sid)
    L.append(f"   {s:6.2f} {sid} {r['t0']:.2f}-{r['t1']:.2f} {r['cam'][:46]}")
L.append(f"i2v runner-ups not funded: {[sid for _,sid in scored[I2V_CAP:]]}")
L.append(f"ERRORS {len(errs)}: {errs}")
L.append(f"WARNS  {len(warns)}: {warns[:8]}")
L.append("plates per anchor (first 8): " +
         json.dumps({k: len(v) for k, v in list(by_anchor.items())[:8]}))
L.append(f"wrote {out} ({os.path.getsize(out)} B)")
open("/tmp/mk38.txt", "w", encoding="utf-8").write("\n".join(L) + "\n")
print("\n".join(L))
raise SystemExit(1 if errs else 0)
