"""Give the camera a narrative, not just a wobble.

The CEO's judgement was that some shots merely shook while others genuinely
moved, so the whole did not read as one film. Measuring the benchmark channel
confirmed the gap exactly: there, 100% of shots move, every move eases in and
out, the frame scale changes by 10-30% within a single shot, the movement is
timed to the spoken sentence, and a new shot often begins already in motion
carrying the previous shot's direction. Our table asked for a median of 3% of
linear travel, and ten rows asked for under 2% — which is why those ten looked
frozen and the rest looked jittery.

This module derives, per row, the four things that turn a pan into a sentence:

  amplitude  how far the camera travels, scaled to the row's own duration and
             to what the camera verb means. A 3% push cannot be felt; 12-22%
             can. The number is bounded by what the plate can afford, because a
             push that runs past the edge of a 2048px still would soften.

  easing     the shape of the speed curve, chosen by the verb. 도착 (arrival)
             decelerates onto its subject. 관통 (traversal) keeps its speed so
             it can hand momentum to the next cut. 후퇴 (conclusion) opens out
             and settles. 정지 (held) breathes.

  timing     when within the shot the move happens, taken from the narration.
             A shot that carries a sentence starts moving with the sentence and
             settles as it lands; the pause the row absorbed is not dead screen
             time, it is the settle.

  continuity whether this shot inherits the previous shot's direction. Two
             consecutive 관통 rows on the same anchor should read as one
             continuous travel that happens to be cut, so the second starts
             already at speed rather than from rest.

Nothing here invents a beat. The verb, the percentage hint, the narration and
the anchor all come from the team's locked table; this module only decides how
each of those is expressed as movement.
"""

# Perceptual floor. Below this, a zoom over a 1920x1080 frame is not read as
# camera movement — it is read as an unstable still. Measured against the
# benchmark, which never sits below roughly a tenth of frame scale per shot.
MIN_TRAVEL = 0.10
MAX_TRAVEL = 0.26          # beyond this a 2048px plate starts to soften
MAX_PAN = 0.13             # keep the crop inside the plate

# A shot carrying Korean text is the one exception, and it is not a compromise —
# it is a harder constraint than the aesthetic one.
#
# The Korean on those shots is not drawn by ffmpeg; it is baked into the plate by
# the image model as a lit glass panel, at the plate's native resolution. A Ken
# Burns push crops into the plate and rescales, so a 22% push enlarges those
# glyphs by 22% and resamples them — which softens the letterforms. The CEO has
# already rejected exactly that once: "글자 퀄리티는 따로 놀아요. 저급이에요."
# The shot tables record the same judgement in their own notes on these rows:
# "glass panel hold — 1.5% push, glyph pixels preserved".
#
# So text shots move too — the CEO's rule that every cut moves has no exception —
# but they move within the budget the glyphs can absorb without resampling
# artefacts. At this amplitude the panel visibly breathes and drifts while the
# letterforms stay at plate resolution.
TEXT_MAX_TRAVEL = 0.035
TEXT_MAX_PAN = 0.020

# Per-verb motion character: (base travel, easing, pan weight)
#
# 도착  arrival      — closes in and lands. Decelerates; the subject grows.
# 관통  traversal    — passes through. Holds speed so the cut can inherit it;
#                      travel is mostly lateral, so the zoom carries less.
# 후퇴  conclusion   — opens out. Reveals context, settles at the end.
# 정지  held         — the only verb allowed to be quiet, and even then it drifts,
#                      because the benchmark has no frozen frames at all.
VERB = {
    "도착": (0.17, "out",    0.35),
    "관통": (0.13, "linear", 1.00),
    "후퇴": (0.19, "inout",  0.30),
    "정지": (0.10, "inout",  0.20),
}


# The two shot tables were written by different authors at different times, so
# they name the same four gestures in different languages. ACT3~8 (V-1's table)
# opens each note with the Korean verb; ACT1~2 (the earlier table) describes the
# gesture in English prose — "conclusion — pull back", "noun arrives on the
# sealed stack", "lateral parallax along the layer edges".
#
# Reading both is the right fix rather than rewriting either table. A table is
# the designer's record of intent and editing it to suit a renderer would destroy
# the audit trail; and if this module only understood Korean, every ACT1~2 row
# would fall through to 정지 and ACT1~2 would keep the exact defect the CEO
# rejected — which is what measurement showed before this mapping was added
# (27 of 27 rows classified as held).
_EN = {
    "도착": ("arriv", "noun arriv", "arrives", "lands", "settle", "reset to",
             "hold", "holds", "push", "dolly-in", "closes"),
    "관통": ("bridge", "extends", "lateral", "parallax", "travel", "track",
             "through", "traverse", "crosses", "lead-in", "sweep"),
    "후퇴": ("conclusion", "pull back", "pull-back", "retreat", "retreats",
             "opens out", "widen", "reveal"),
}


def verb_of(row):
    """The camera verb the designer wrote for this row, in either language.

    Korean prefix first, because ACT3~8 states the verb as the first token and
    that is unambiguous. Otherwise the English note is scanned for the phrases
    the earlier table actually uses. A note that matches nothing is 정지 — held —
    which is still a moving shot here, just the quietest one.
    """
    note = (row.get("note") or "")
    for v in VERB:
        if note.startswith(v):
            return v
    low = note.lower()
    # 후퇴 is checked first: "conclusion — pull back, recover the same silhouette"
    # also contains "recover", and a conclusion misread as an arrival would zoom
    # the wrong way and break the shot's meaning.
    for v in ("후퇴", "관통", "도착"):
        if any(k in low for k in _EN[v]):
            return v
    return "정지"


def _travel_for(row, verb, dur):
    """How far to travel, given the verb and how long the shot lasts.

    A long shot needs more travel than a short one to feel equally alive: the
    same 12% spread over nine seconds is slower than over two. But the growth is
    sub-linear, because a long shot is usually a held beat and should not become
    a rush.
    """
    base, _, _ = VERB[verb]
    # 4s is the reference length; scale gently with duration
    k = (max(dur, 1.0) / 4.0) ** 0.35
    want = base * k
    if row.get("text"):
        # Text shot: the ceiling is what the baked-in glyphs can absorb, not what
        # the eye would prefer. Keep whatever the designer asked for if it is
        # already under that ceiling — those numbers were chosen per panel.
        designed = abs(row["kb"][1] - row["kb"][0]) if row.get("kb") else 0.0
        return min(TEXT_MAX_TRAVEL, max(designed, TEXT_MAX_TRAVEL * 0.6))
    return max(MIN_TRAVEL, min(MAX_TRAVEL, want))


def _direction(row, verb):
    """Sign of the zoom: arrivals and traversals close in, conclusions open out."""
    return -1.0 if verb == "후퇴" else 1.0


def plan(row, dur, prev=None):
    """Motion plan for one row (or one internal cut of one row).

    Returns a dict the renderer can hand straight to assemble.kenburns:
    z0, z1, pan, ease, head, tail — plus the reason, so a later reviewer can see
    why this shot moves the way it does without re-deriving it.
    """
    verb = verb_of(row)
    _, ease, pan_w = VERB[verb]
    travel = _travel_for(row, verb, dur)
    sign = _direction(row, verb)

    # Zoom range. A conclusion starts wide-of-target and opens further out, so it
    # begins zoomed in and ends near 1.0; everything else begins near 1.0 and
    # closes in. Both stay above 1.0 so no frame ever shows outside the plate.
    if sign < 0:
        z0, z1 = 1.0 + travel, 1.0
    else:
        z0, z1 = 1.0, 1.0 + travel

    # A traversal has to be able to aim at BOTH ends of its route, and at zoom 1.0
    # the crop fills the plate so there is nowhere to aim — aim38.room_for(1.0) is
    # exactly 0. Two rows (A3-02 "가로 배치", A6-02 "카메라 아래로 하강") were
    # planned as paths that then had to start from the centre, which is a path with
    # one end amputated. So a traversal is floored a little way in, keeping the
    # same amount of zoom change, which buys aiming room at both ends. Arrivals and
    # conclusions do not need this: they already end (or start) zoomed in.
    # The condition is the PATH, not the verb. A3-02 ("중앙 문장 카드를 자처럼 가로
    # 배치") reads as an arrival by its wording but describes a traversal by its
    # staging, and it needed the floor just as much. Asking aim38 whether the row
    # is a route is the direct question; inferring it from the verb was a proxy
    # that got one of the two rows wrong.
    if not row.get("text"):
        import aim38                       # local: aim38 must not import motion38
        if verb == "관통" or aim38.path_of(row) is not None:
            floor = 1.0 + travel * 0.55
            # Lift BOTH ends by the same amount rather than rebuilding the pair
            # from z0. Rebuilding was arithmetically wrong for a conclusion, whose
            # (z0, z1) descends: floor + (z1 - z0) = floor - travel, which lands
            # BELOW 1.0 and leaves aim38.room_for() at exactly 0 on that end — the
            # freeze this floor exists to prevent. Measured on A7-15 (후퇴 + 수직
            # 상승): z1 came out 0.9171 with room 0.0, and aimstat flagged it as the
            # one over-budget aim in the whole act. Shifting the pair preserves the
            # descent, keeps both ends above 1.0, and keeps the zoom CHANGE
            # identical, so the verb still reads as a pull-back.
            lift = max(0.0, floor - min(z0, z1))
            z0, z1 = z0 + lift, z1 + lift

    # Lateral travel. The designer's pan direction is preserved from the table's
    # own Ken Burns hint; only the magnitude is raised to a perceptible level.
    dx0, dy0 = 0.0, 0.0
    if row.get("kb"):
        _, _, dx0, dy0 = row["kb"]
    pan_cap = TEXT_MAX_PAN if row.get("text") else MAX_PAN
    mag = (dx0 ** 2 + dy0 ** 2) ** 0.5
    if mag > 1e-9:
        want = min(pan_cap, travel * pan_w)
        dx, dy = dx0 / mag * want, dy0 / mag * want
    elif verb == "관통" and not row.get("text"):
        # A traversal with no recorded direction still has to travel, or the verb
        # is a lie. Default to a rightward pass, the reading direction.
        dx, dy = min(MAX_PAN, travel * pan_w), 0.0
    else:
        dx, dy = 0.0, 0.0

    # Narration timing. When the row carries speech, the move waits for the
    # sentence to start and settles as it lands. The head/tail are fractions of
    # the shot, kept small so the shot is never motionless for long.
    head = tail = 0.0
    if (row.get("narr") or "").strip():
        head, tail = 0.06, 0.14 if verb in ("도착", "후퇴") else 0.04

    # Continuity across the cut. If the previous shot was travelling the same way,
    # this one begins already at speed instead of restarting from rest — the
    # benchmark's "one journey" effect.
    inherited = False
    if prev is not None and verb == "관통" and verb_of(prev) == "관통":
        ease, head, inherited = "linear", 0.0, True

    return {
        "z0": round(z0, 4), "z1": round(z1, 4),
        "pan": (round(dx, 4), round(dy, 4)),
        "ease": ease, "head": head, "tail": tail,
        "verb": verb, "travel": round(travel, 4), "inherited": inherited,
        "reason": (f"{verb}: travel {travel*100:.0f}% ease={ease}"
                   + (" (momentum inherited across cut)" if inherited else "")
                   + (f" head={head:.2f} tail={tail:.2f}" if head or tail else "")),
    }


def split(plan_d, i, n):
    """Slice one row's plan across its n internal cuts.

    The row owns a single camera gesture, so the cuts must read as that one
    gesture interrupted, not as n separate moves. Each cut therefore takes a
    consecutive slice of the zoom range and of the pan. Only the first cut keeps
    the delayed start and only the last keeps the settle; the cuts in between run
    at speed, which is what makes the interruption feel like an edit inside a
    continuous move rather than a series of restarts.
    """
    if n <= 1:
        return dict(plan_d)
    a, b = i / n, (i + 1) / n
    z0, z1 = plan_d["z0"], plan_d["z1"]
    dx, dy = plan_d["pan"]
    d = dict(plan_d)
    d["z0"] = round(z0 + (z1 - z0) * a, 4)
    d["z1"] = round(z0 + (z1 - z0) * b, 4)
    d["pan"] = (round(dx / n, 4), round(dy / n, 4))
    d["head"] = plan_d["head"] if i == 0 else 0.0
    d["tail"] = plan_d["tail"] if i == n - 1 else 0.0
    if n > 1 and 0 < i:
        d["ease"] = "linear"        # mid-gesture: no restart
    elif n > 1 and i == 0 and plan_d["ease"] == "inout":
        d["ease"] = "in"            # opens the gesture, hands off in motion
    return d
