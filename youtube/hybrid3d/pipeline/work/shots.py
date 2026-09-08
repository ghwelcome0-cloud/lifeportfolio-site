"""
shots.py — the 500 s shot table, single source of truth for the long form.

WHY THIS FILE EXISTS
────────────────────
act0.py hard-coded its nine shots inline. That was fine for 31 s. At 500 s the
table has to answer questions the driver cannot guess, and every one of those
questions has already cost us a rejected cut:

  · Does this shot carry Korean text?      If yes, i2v is forbidden. Generative
    motion resamples the frame and destroys the glyph pixels that gpt-image-2 got
    right at craft 9.0–9.8. Those shots move by crop-and-scale only (Ken Burns).
  · May this cut be colour-matched to the previous one?  Not always. The seal→
    reveal boundary measures d_warmth = 74.54, which drives an R gain of 1.902.
    That contrast is the point of the shot, not a defect. Matching it away
    destroys the story beat. Policy is declared per shot, never inferred from the
    size of the measurement (V-3).
  · What must be true on screen for this shot to be acceptable?  104.32 s must
    show exactly three project sheets. The four glass panels must carry their
    exact approved strings. ACT7 must not vanish, as it did in v14 while every
    automatic check passed (V-4).

So each shot declares its own intent, and the driver obeys the declaration.
An automatic measurement may WARN, but it may never overrule a declaration.

FIELDS
──────
  sid       stable shot id, matching the V-1 camera itinerary (A1-01 …)
  t0, t1    position on the 500 s master timeline, in seconds
  kind      "i2v"      motion generated from the anchor (no text in frame)
            "kenburns" crop/scale of the approved still (text in frame)
            "still"    hold, no movement at all
  anchor    approved still: local path under anchors/ or a file-wrapper id
  src       generated clip under seg/, for kind == "i2v"
  ss        in-point inside src. Clamped against the measured source length,
            because ffmpeg -ss past the end exits 0 and writes a SHORT file.
  text      True when Korean glyphs are visible. Forces kenburns, forbids i2v,
            forbids seam blur across the boundary (blur would smear the glyphs).
  panel     exact approved string, byte-for-byte. Checked against the render.
  group     COLOUR continuity group — a lighting world, not an act. My first draft
            named these after acts (A2_WARM, A2_SHEETS) and the pre-render gate
            immediately rejected two cuts for crossing a group boundary while
            declaring themselves continuous. The gate was right and the labels
            were wrong: the desk key light does not change when ACT1 becomes ACT2,
            so those cuts are ordinary continuous cuts inside one warm world.
            The only real colour boundary in 30–150 s is the incision at A1-08,
            where the interior starts to emit. Group names must describe light.
  policy    "continuous"            match to previous tail
            "intentional_transition" preserve the contrast, QC exposure only
            "hard_reset"            new world, do not match at all
  objects   required on-screen object count, or None. 104.32 s -> 3.
  kb        Ken Burns move as (z0, z1, pan_x, pan_y), pan normalised to frame.
  orb       (x, y, r) waypoint at t0. Screen-space, r in px at 1080p.
  note      the narration line this shot serves, for human review.

The orb waypoint list is derived by the driver: shot i flies ORB[i] -> ORB[i+1],
and consecutive shots SHARE the boundary waypoint, so the orb fades out and back
in at the same screen position and size. v7 flew a continuous path through the cut
and dropped from 6.5 to 5.5 because the new scene's perspective re-read that
position as a different depth. Identity survives by RE-ENTRY, not by an unbroken
trajectory (lesson 51).
"""

# ── anchors, ACT1~2 — ALL TWELVE HELD PENDING LANDSCAPE REGENERATION ──────────
#
# CONTENT verdict (my gate, passed): the four glass panel strings matched the
# source text character for character, document bodies held zero readable glyphs,
# and key light stayed warm from upper left across all twelve.
#
# FORMAT verdict (measured, failed): every one of the twelve came back
# 1152 x 2048 — PORTRAIT. The master is 1920 x 1080, confirmed three ways
# (assemble.py W,H; act0_final.mp4 stream; seg/b4.mp4 stream). The cause was my
# own instruction: I named a 576 x 1024 portrait reference as mandatory on every
# call and left aspect_ratio on auto, so the generator inherited the reference's
# orientation. Lesson 65: a reference image does not only carry craft, it carries
# aspect ratio, and orientation must be locked explicitly alongside it.
#
# Crop rescue was tested and rejected on measurement, not on taste. A full-width
# 16:9 crop of a 1152 x 2048 plate is 1152 x 648, keeping 31.6% of the area, and
# an HSV mask of the actual panel pixels put two of the three measurable panels
# outside that band (heights 907 and 1162 against 648). Reaching 1920 wide would
# also demand a 1.67x upscale, which destroys the very glyph craft — 9.0 to 9.2 —
# that took this project months to reach. Regeneration is the only route.
#
# Two of the twelve additionally need CONTENT changes, folded into the same order:
#   104.32  the three sheets are correct in number, but the artwork printed on
#           them reads as glowing energy conduits. Same failure the CEO rejected
#           before. Body copy must be grey placeholder bars, and ink does not glow.
#   139.10  a blue connector line runs from the documents into a central machine
#           slot. That inverts the message: the viewer should see themselves
#           drawing a criterion out of their own record, not being processed by a
#           system. The glass text on this frame is the best of the twelve at
#           craft 9.2 and must be reproduced at that level.
#
# RESOLVED. The regenerated set arrived landscape and every plate was measured
# locally with cv2.imread().shape before this edit was made — 2048 x 1152,
# ar 1.7778, twelve of twelve, zero hard failures. The image agent locked
# aspect_ratio="16:9" explicitly and dropped the 576 x 1024 portrait reference
# entirely, using only the two approved landscape craft references, which is
# exactly the correction lesson 65 demanded.
#
# The two content defects were folded into the same regeneration:
#   104.32  now three sheets carrying grey placeholder bars and non-emitting ink
#   139.10  the connector line into a machine slot is gone
# Neither of those is provable by pixel statistics — the calibration sweep in
# inspect_anchors.py proved no histogram separates sci-fi contamination — so they
# are asserted by the generating agent and still owed a human look.
#
# Ids name the LANDSCAPE plates now in use. The superseded portrait ids are kept
# in SUPERSEDED so a replacement is always diffed against a known predecessor.
ANCHORS = {
    32.44:  "OiCyrdsB",
    44.80:  "3MPIc6sX",
    56.18:  "AD0qFkCQ",
    60.64:  "bXF0xWmF",   # panel — glyph craft re-rated 10.0, was 8.5
    76.76:  "I3LBPBO4",
    82.08:  "Z83mHghh",
    85.06:  "0UxD3EXC",
    101.22: "nMYIrapn",
    104.32: "1r3pwjPS",   # exactly three sheets, grey bars, ink does not glow
    119.62: "L4U2YcY0",   # panel
    132.48: "Tt8CNrMJ",   # panel
    139.10: "NlDAuVHf",   # panel — connector line removed
}

SUPERSEDED = {
    32.44: "P1kqaVES", 44.80: "GivFLODH", 56.18: "ypwyoSJH", 60.64: "aB2rgILV",
    76.76: "4iLKftX6", 82.08: "yNiGegLw", 85.06: "W5FvElCY", 101.22: "MgL9epLY",
    104.32: "5B2SqRjs", 119.62: "UQzIwYzo", 132.48: "NTrzH4Lp", 139.10: "lkoRKHuF",
}

# Local copies the format gate actually measured. Recorded so a later run can
# re-measure the same bytes instead of trusting this comment.
LANDING = "/home/user/lf/land12"

# The FORMAT hold is lifted, and only the format hold. Empty because every plate
# passed a measurement, not because the deadline pressed.
HELD = set()

# GRANTED. 2026-08-19, on the contact sheet, verbatim: "컨텍트 시트 확인했어요.
# 대만족입니다! 이제야 원하는 퀄리티가 나왔네요. 이 정도면 품질에 있어 100점은 아니어도
# 합격입니다. 승인합니다."
#
# This is the gate that CEO-16 created — "앞으로 저에게 이미지부터 검토받고 진행하세요" —
# and it is now cleared for these twelve plates and only these twelve. It is a
# per-delivery approval, not a blanket one: any plate regenerated after this line
# was written must go back to the CEO before it can drive a credit-spending step.
# The approval also settles the two height warnings the gate could not decide, and
# it is what unblocks i2v ordering.
CEO_IMAGE_APPROVAL = True

# Landscape contract for the regenerated set. The gate refuses to render until a
# delivered plate satisfies this, measured with cv2.imread().shape — never
# inferred from a filename or a file size, which is how the portrait set slipped
# through in the first place.
REQ_AR       = 1920 / 1080     # 1.7778
REQ_AR_TOL   = 0.02
REQ_MIN_W    = 1920            # no upscaling to reach master width
CRAFT_FLOOR  = 9.0             # glass panels; 60.64 previously scored 8.5

# ── the four approved Korean strings, byte-exact ──────────────────────────────
# Verified against the render, not against my memory of the script. Automatic
# pixel checks cannot catch a string that was wrong from the start, so these are
# compared literally (V-4).
PANELS = {
    60.64:  "선택지는 늘고 기준은 흐려집니다",
    119.62: "명사보다 동사로 써보세요",
    132.48: "선택한 3개의 프로젝트에서 반복된 동사가 있나요?",
    139.10: "나는 이런 역할을 맡을 때 내 경험을 잘 활용한다",
}


def S(sid, t0, t1, kind, group, policy, **kw):
    d = dict(sid=sid, t0=t0, t1=t1, kind=kind, group=group, policy=policy,
             anchor=None, src=None, ss=0.05, text=False, panel=None,
             objects=None, kb=None, orb=None, note="")
    d.update(kw)
    if d["panel"] is not None:
        d["text"] = True
    if d["text"] and d["kind"] == "i2v":
        raise ValueError(f"{sid}: text shot cannot be i2v — glyphs would resample")
    return d


# ── ACT1 · 30–90 s — the sealed stack is opened ───────────────────────────────
# Camera itinerary supplied by the 3D Motion Director (V-1). I am storing it as
# code rather than prose so the driver and the reviewer read the same numbers.
#
# Group logic: the stack is sealed and cool through A1-07. The cross-section opens
# at A1-08 and the interior emits warm light, so that single boundary is declared
# intentional_transition and is NOT colour matched. Everything after it belongs to
# a new warm group and is matched normally inside that group.
ACT1 = [
    S("A1-01", 30.00, 32.44, "i2v", "A1_COOL", "continuous",
      anchor=32.44, orb=(0.50, 0.52, 34), note="lead-in to 32.44"),
    S("A1-02", 32.44, 36.80, "i2v", "A1_COOL", "continuous",
      anchor=32.44, orb=(0.70, 0.66, 36),
      note="먼저 왜 선택이 어려워졌는지부터 보겠습니다 — noun arrives on the sealed stack"),
    S("A1-03", 36.80, 40.80, "i2v", "A1_COOL", "continuous",
      anchor=32.44, orb=(0.55, 0.55, 36),
      note="4° arc, paper edges and thread thickness, stack stays shut"),
    S("A1-04", 40.80, 44.80, "i2v", "A1_COOL", "continuous",
      anchor=32.44, orb=(0.42, 0.53, 36),
      note="conclusion — pull back, recover the same silhouette"),
    S("A1-05", 44.80, 49.00, "i2v", "A1_COOL", "continuous",
      anchor=44.80, orb=(0.50, 0.59, 34),
      note="그런데 3년, 5년, 7년이 지나면 고려할 것이 많아집니다"),
    S("A1-06", 49.00, 53.00, "i2v", "A1_COOL", "continuous",
      anchor=44.80, orb=(0.57, 0.51, 35),
      note="verb pierces — macro travel inside the stacked-paper cross-section"),
    S("A1-07", 53.00, 56.18, "i2v", "A1_COOL", "continuous",
      anchor=44.80, orb=(0.42, 0.49, 35),
      note="conclusion — retreat, same desk and key, roughly 3x thicker"),
    # the incision: interior emission. Do not neutralise this contrast.
    # cmatch.colour_match() refuses an intentional_transition that carries no
    # stated reason, and it is right to: a boundary we deliberately leave
    # unmatched has to be justified somewhere a reviewer can read it. The reason
    # used to live only in the prose comment above, which the gate cannot see --
    # and the gate never fired because this row's clip was missing from seg/, so
    # drive500 skipped it. Restoring the clip exposed the second defect the
    # 297-frame hole had been hiding. The justification is stated in the header
    # comment for this act; it is repeated here as data.
    S("A1-08", 56.18, 60.64, "i2v", "A1_WARM", "intentional_transition",
      anchor=56.18, orb=(0.50, 0.60, 34),
      transition_reason="the sealed stack is cut open at this cut and the "
                        "interior emits warm light; neutralising that contrast "
                        "would erase the reveal the narration is describing",
      expected_warmth_direction="warmer",
      note="선택지가 없어서가 아니라 선택을 평가할 항목이 많아진 것입니다 — top-down fan reveal"),
    S("A1-09", 60.64, 65.00, "kenburns", "A1_WARM", "continuous",
      anchor=60.64, panel=PANELS[60.64], kb=(1.000, 1.015, 0.0, -0.004),
      note="glass panel hold — 1.5% push, glyph pixels preserved, no orb"),
    S("A1-10", 65.00, 69.00, "i2v", "A1_WARM", "continuous",
      anchor=56.18, orb=(0.68, 0.53, 33),
      note="thought extends — lateral parallax along the layer edges"),
    S("A1-11", 69.00, 73.00, "i2v", "A1_WARM", "continuous",
      anchor=76.76, orb=(0.54, 0.48, 33),
      note="bridge to 76.76 — evaluation rows multiply as grey bars"),
    S("A1-12", 73.00, 76.76, "i2v", "A1_WARM", "continuous",
      anchor=76.76, orb=(0.40, 0.43, 32),
      note="conclusion — retreat into a left/right comparison"),
    S("A1-13", 76.76, 80.50, "i2v", "A1_WARM", "continuous",
      anchor=76.76, orb=(0.27, 0.52, 34),
      note="외부 정보는 선택지를 보여주지만 내 경험은 선택 기준을 보여줍니다 — cross the boundary"),
    S("A1-14", 80.50, 82.08, "i2v", "A1_WARM", "continuous",
      anchor=76.76, orb=(0.72, 0.52, 34),
      note="short retreat, both sides and the key light hold"),
    S("A1-15", 82.08, 85.06, "i2v", "A1_WARM", "continuous",
      anchor=82.08, orb=(0.50, 0.61, 33),
      note="이제 직함보다 반복한 역할을 봅니다 — repeated bars glow between layers"),
    S("A1-16", 85.06, 90.00, "i2v", "A1_WARM", "continuous",
      anchor=82.08, orb=(0.50, 0.40, 34),
      note="첫 번째 기준은 반복해서 맡아온 역할입니다 — deep zoom, then retreat"),
]

# ── ACT2 · 90–150 s — three sheets, and the first criterion ───────────────────
# Hard lock from A2-05 onward: every shot that shows paper shows EXACTLY three
# sheets. This is the one on-screen fact the narration states out loud, so a
# fourth sheet drifting into frame contradicts the audio.
#
# Four shots here are text holds (A2-09/15/17 plus A1-09 above). They are Ken
# Burns only. The seam blur that softens ordinary cuts is disabled on their
# boundaries, because blurring a glass panel undoes the very thing that took us
# this long to get right.
ACT2 = [
    S("A2-01", 90.00, 94.00, "i2v", "A1_WARM", "continuous",
      anchor=85.06, orb=(0.50, 0.58, 34), note="reset to the whole desk"),
    S("A2-02", 94.00, 98.00, "i2v", "A1_WARM", "continuous",
      anchor=85.06, orb=(0.50, 0.49, 34),
      note="bridge to 101.22 — dolly across identical title bands"),
    S("A2-03", 98.00, 101.22, "i2v", "A1_WARM", "continuous",
      anchor=101.22, orb=(0.68, 0.55, 33),
      note="conclusion — retreat until two cross-sections share the frame"),
    S("A2-04", 101.22, 104.32, "i2v", "A1_WARM", "continuous",
      anchor=101.22, orb=(0.53, 0.48, 33),
      note="직함은 같아도 반복되는 역할은 다릅니다 — pierce the identical band"),
    S("A2-05", 104.32, 109.00, "i2v", "A1_WARM", "continuous",
      anchor=104.32, objects=3, orb=(0.50, 0.68, 36),
      note="종이에 최근 3년간 기억나는 프로젝트 3개를 적어보세요 — EXACTLY three"),
    S("A2-06", 109.00, 113.00, "i2v", "A1_WARM", "continuous",
      anchor=104.32, objects=3, orb=(0.50, 0.48, 34),
      note="overhead arc, P1/P2/P3 positions fixed"),
    S("A2-07", 113.00, 116.50, "i2v", "A1_WARM", "continuous",
      anchor=104.32, objects=3, orb=(0.50, 0.44, 33),
      note="macro pass over the abstract title/body bars"),
    S("A2-08", 116.50, 119.62, "i2v", "A1_WARM", "continuous",
      anchor=104.32, objects=3, orb=(0.70, 0.49, 34),
      note="retreat to the whole — a fourth card must not enter"),
    S("A2-09", 119.62, 121.86, "kenburns", "A1_WARM", "continuous",
      anchor=119.62, panel=PANELS[119.62], kb=(1.000, 1.012, 0.003, -0.003),
      note="glass panel hold — 1.2% diagonal push"),
    S("A2-10", 121.86, 123.86, "i2v", "A1_WARM", "continuous",
      anchor=104.32, objects=3, orb=(0.30, 0.55, 32),
      note="흩어진 정보를 정리했다 — pierce one emphasis bar on P1"),
    S("A2-11", 123.86, 126.02, "i2v", "A1_WARM", "continuous",
      anchor=104.32, objects=3, orb=(0.47, 0.46, 32),
      note="사람들의 의견을 조율했다 — P2, independent cut, depth reset"),
    S("A2-12", 126.02, 128.04, "i2v", "A1_WARM", "continuous",
      anchor=104.32, objects=3, orb=(0.50, 0.45, 32),
      note="문제의 원인을 찾아냈다 — P3, same grammar"),
    S("A2-13", 128.04, 130.32, "i2v", "A1_WARM", "continuous",
      anchor=104.32, objects=3, orb=(0.53, 0.46, 33),
      note="처음 하는 사람도 이해하도록 설명했다 — bars rise from raw sheet to summary height"),
    S("A2-14", 130.32, 132.48, "i2v", "A1_WARM", "continuous",
      anchor=104.32, objects=3, orb=(0.50, 0.38, 33),
      note="막힌 일을 다시 움직이게 했다 — three bars align without merging"),
    S("A2-15", 132.48, 136.32, "kenburns", "A1_WARM", "continuous",
      anchor=132.48, panel=PANELS[132.48], kb=(1.000, 1.013, 0.0, -0.003),
      note="glass panel hold — three sheets stay visible beneath"),
    S("A2-16", 136.32, 139.10, "i2v", "A1_WARM", "continuous",
      anchor=104.32, objects=3, orb=(0.26, 0.53, 34),
      note="첫 번째 기준 문장을 이렇게 완성합니다 — left→centre→right causal glow"),
    S("A2-17", 139.10, 144.00, "kenburns", "A1_WARM", "continuous",
      anchor=139.10, panel=PANELS[139.10], kb=(1.015, 1.000, 0.0, 0.004),
      note="glass panel hold — 1.5% pull-back, the criterion sentence lands"),
    S("A2-18", 144.00, 148.00, "i2v", "A1_WARM", "continuous",
      anchor=104.32, objects=3, orb=(0.50, 0.42, 34),
      note="no panel after the cut; three emphasis bars read as one role pattern"),
    S("A2-19", 148.00, 150.00, "i2v", "A1_WARM", "continuous",
      anchor=104.32, objects=3, orb=(0.50, 0.52, 32),
      note="ACT2 conclusion / ACT3 handoff — 4% retreat, settle"),
]

TABLE = ACT1 + ACT2


# ── i2v budget: one generated clip per anchor, everything else is free ─────────
#
# The table above declares 31 i2v rows across 12 anchors. Ordering all of them as
# generated video means 24 clips at the 5s minimum, and that is not a quality
# decision — it is an accounting mistake. The benchmark teardown (95% confidence)
# is explicit on this point: segments run 1~5 seconds, and LONG MOVES ARE ONE BIG
# STILL WITH A 2.5D KEN BURNS PAN, not generated footage. Generated motion earns
# its cost only where something in the frame physically changes: paper lifting,
# a fan opening, a layer separating. A dolly, an arc, a retreat and a parallax
# drift are camera moves over a static subject, and a 2048x1152 plate has enough
# spare pixels to carry those for free at 1920x1080.
#
# So each anchor contributes exactly ONE generated clip, chosen as the row where
# the subject itself moves, and every other row of that anchor is re-planned as a
# Ken Burns move on the same approved plate. Twelve anchors, four of which are
# text-only and already Ken Burns, leaves EIGHT clips. That is 8 instead of 24.
#
# Identity survives this because of lesson 51: continuity is re-entry, not an
# unbroken trajectory. Every row under one anchor shows the same plate, so the
# eye reads one place seen from several distances regardless of which row was
# generated and which was panned.
I2V_ROWS = {
    "A1-03",   # 32.44  paper edges and thread thickness — the stack itself flexes
    "A1-06",   # 44.80  verb pierces INTO the cross-section; real depth travel
    "A1-08",   # 56.18  top-down fan reveal — sheets physically fan open
    "A1-13",   # 76.76  crossing the boundary between outside info and own record
    "A1-16",   # 82.08  deep zoom then retreat; repeated bars light up in sequence
    "A2-02",   # 85.06  dolly across identical title bands, bands read in motion
    "A2-04",   # 101.22 pierce the identical band — the band opens
    "A2-13",   # 104.32 bars RISE from raw sheet to summary height; growth is motion
}


def resolve_kinds(table=TABLE):
    """Demote every i2v row that is not in I2V_ROWS to a Ken Burns move.

    Applied by the driver rather than written into the rows above, so the
    creative intent (what the camera is doing) stays readable next to each shot
    while the delivery mechanism (generated vs panned) is one auditable list.
    A demoted row keeps its orb, its note and its group — only the source of the
    pixels changes.
    """
    out = []
    for r in table:
        r = dict(r)
        if r["kind"] == "i2v" and r["sid"] not in I2V_ROWS:
            r["kind"] = "kenburns"
            r["demoted"] = True
            if r["kb"] is None:
                # A gentle default push. Direction alternates so consecutive
                # demoted rows never read as one long mechanical zoom.
                sign = 1 if (len(out) % 2 == 0) else -1
                r["kb"] = (1.000, 1.030, 0.0, 0.006 * sign)
        else:
            r["demoted"] = False
        out.append(r)
    return out


def i2v_manifest(table=TABLE):
    """The eight clips to order, with the exact seconds each must cover."""
    from collections import defaultdict
    span = defaultdict(lambda: [1e9, -1e9])
    for r in table:
        a = r["anchor"]
        span[a][0] = min(span[a][0], r["t0"])
        span[a][1] = max(span[a][1], r["t1"])
    man = []
    for r in table:
        if r["sid"] in I2V_ROWS:
            man.append(dict(sid=r["sid"], anchor=r["anchor"],
                            plate=ANCHORS[r["anchor"]],
                            t0=r["t0"], t1=r["t1"],
                            need=round(r["t1"] - r["t0"], 2),
                            group=r["group"], note=r["note"]))
    return man
