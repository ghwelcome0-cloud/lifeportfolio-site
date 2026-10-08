"""Decide WHERE the camera looks — not just how it moves.

The CEO's second judgement, after the motion was smoothed: the movement is now
smooth but it has no meaning. It moves, but it does not move toward anything.

Measuring the benchmark short he pointed to (youtube K4YuwHHGrgQ, the Yeouido
levee explainer) says exactly why. Every move there is aimed at the thing the
narration has just named:

  "여의도 둘레에 둑을 쌓는다"      -> camera pulls out to the whole island
  "둑의 구조"                      -> cut to a cross-section, pan across its layers
  "강폭이 좁아진다"                -> camera travels ALONG the river channel
  "밤섬"                           -> camera finds Bamseom, then pushes in on it
  "물이 둑에 부딪친다"             -> camera pushes to the exact impact point
  "이중 방어"                      -> camera opens out to show both layers at once

The channel's own grammar, stated as the analysis put it: "the endpoint of a zoom
must place the target object prominently in the frame", and "if the narration
describes a process or flow, the camera should pan along that path". What is lost
without it: "the viewer would have to actively search the image for the subject
being discussed, rather than having their attention guided directly to it".

That is precisely what our renderer was doing wrong, and it was a code omission,
not a design omission. Our own shot table already records where things are — the
team wrote "좌측 책상에 손때 묻은 노트", "우측 협업공간", "두 장면 사이 중앙
책상에", "개인 책상→협업 테이블로 횡단". assemble.kenburns, however, builds its
crop as `iw/2-(iw/zoom/2)+dx*iw*e`, which is anchored to the centre of the plate.
Every arrival in the film therefore arrived at the middle of the picture,
whatever the sentence was about. The motion had grammar but no object.

This module reads the position language the team already wrote and converts it
into an aim point in normalised plate coordinates, so that a 도착 lands on the
named thing, a 관통 travels the named path, and a 후퇴 opens out from it.

Deliberate limits:

  It does not detect objects. No vision model is used and none is needed: the
  designer already stated the position in words, and their statement is the
  authority. Guessing a bounding box would introduce a second, weaker opinion
  about a question that is already answered.

  It does not invent a target. A row whose text names no position aims at the
  centre, exactly as before. Silence in the table is not a licence to make
  something up — the CEO's standing instruction on that point is explicit.

  It never aims a text shot. Those carry Korean glass panels composed by the
  image model at the centre of the plate; pushing off-centre would crop the
  panel. Text rows keep the centre and their small amplitude.

Where the position words come from, and why there are now two sources.

  Originally this module read the prose fields of the shot table, which covered
  17 rows out of 77 — the other 60 aimed at centre because the prose happened not
  to state a position. I nearly "fixed" that by widening the prose scan, and got
  as far as counting `note` fields in the wrong table before finding that the
  renderer reads shots.TABLE38 while I had been counting rows38.json. Even done
  correctly, that route tops out around 25 rows, and the remaining 55 would still
  be centred not because the designer wanted centre but because the sentence
  never mentioned a side.

  The designer answered the question directly instead. V-1 delivered a table of
  one aim token per SID for all 80 rows, each with a stated reason ("‘일하는
  방식’의 첫 사례인 개인 책상을 좌측에 고정한다"). That is an explicit
  instruction, not an inference from prose, so it is now the FIRST source and
  prose is the fallback. Coverage measured: 80/80 SIDs matched, 0 tokens outside
  the existing vocabulary. This is the difference between a camera that aims when
  the wording happens to allow it and one that aims because someone decided where
  to look.
"""

import json
import os
import re

# V-1's per-SID aim tokens, keyed by sid. Loaded once, and missing file is not an
# error: the prose path still works, so a checkout without this file renders the
# older, mostly-centred version rather than refusing to render at all.
_TOKENS = {}
try:
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                           "aim_tokens.json"), encoding="utf-8") as _fh:
        _TOKENS = json.load(_fh)
except Exception:
    _TOKENS = {}


def token_of(row):
    """The designer's aim token for this row, or "" if none was supplied."""
    return _TOKENS.get(str(row.get("sid") or ""), "")

# Position words the two shot tables actually use, mapped to a normalised offset
# from plate centre. +x is right, +y is down, in units of half-frame — so 1.0
# would be the very edge and these stay well inside that.
#
# The magnitudes are deliberately modest. The aim point is where the crop is
# CENTRED at the end of the move, and a 2048x1152 plate cropped to 1920x1080 at
# 1.2x zoom has limited room before the crop leaves the plate; aim38 caps the
# result against the zoom in aim_for(), so these are intents, not final values.
_POS = [
    # left / right
    (r"좌측|좌상|좌하|왼쪽|left", (-0.55, 0.0)),
    (r"우측|우상|우하|오른쪽|right", (0.55, 0.0)),
    # vertical
    (r"상단|위쪽|천장|상층|upper|above|overhead", (0.0, -0.45)),
    (r"하단|아래쪽|바닥|하층|lower|below|floor", (0.0, 0.40)),
    # explicit centre
    (r"중앙|가운데|중심|centre|center", (0.0, 0.0)),
    # depth-ish language that reads as "further in / further back" on a flat
    # plate: treat as a small downward-forward bias, which is how a desk-level
    # push reads.
    (r"책상 위|desk|테이블 위|table", (0.0, 0.18)),
    (r"서가|책장|shelf|서재", (-0.35, -0.20)),
]

# Compound directions, checked before the singles so "좌상단" does not resolve to
# "좌측" alone.
_POS2 = [
    (r"좌상", (-0.50, -0.38)),
    (r"좌하", (-0.50, 0.34)),
    (r"우상", (0.50, -0.38)),
    (r"우하", (0.50, 0.34)),
]

# Path language: the narration describes a movement from one place to another, so
# the camera should travel that way rather than sit on either end.
#
# Correction, made by counting the table rather than trusting memory: rows38.json
# has NO `note` field at all (0 of 80) and no arrow forms in it. The path and
# direction language V-1 actually wrote lives in `objects`, in plain Korean —
# "사무실 단면 위층의 결과 보관 서가로 수직 상승", "카메라 아래로 하강",
# "바인더만 보던 카메라가 뒤로 물러나". Reading for arrows was therefore looking
# for a notation nobody used. These are the forms that are really there.
_ARROW = re.compile(r"(.{0,18}?)\s*(?:→|->|~>|에서)\s*(.{0,18}?)(?:로|으로|까지|\b)")

# Explicit camera direction, stated by the designer. This is not a guess about
# what the shot means — it is an instruction, and it outranks any position noun
# in the same sentence.
_DIR = [
    (r"수직 상승|위층|상승|올라", (0.0, -1.0)),
    (r"아래로 하강|하강|아래로|내려", (0.0, 1.0)),
    (r"횡단|가로 배치|가로지",       (1.0, 0.0)),
]

# Ordinal language. When the designer says "첫 행만 채워짐", "둘째 행만 추가",
# "세 번째 기준 카드", the sentence names WHICH of a stacked set is live, and the
# benchmark's rule ("the endpoint of a zoom must place the target object
# prominently") means the camera should sit on that one rather than on the middle
# of the stack. Rows are read top-to-bottom, cards left-to-right, which is how the
# plates were composed.
_ORD_ROW = [
    (r"첫 행|1행|첫째 행|첫 기준|첫 카드|첫 번째", -1),
    (r"둘째 행|2행|둘째|두 번째", 0),
    (r"셋째 행|3행|셋째|세 번째", 1),
]


def _match_pos(text):
    """First position phrase in the text, as a normalised offset, or None."""
    if not text:
        return None
    for pat, off in _POS2:
        if re.search(pat, text):
            return off
    for pat, off in _POS:
        if re.search(pat, text):
            return off
    return None


def _match_dir(text):
    """Explicit camera direction as a unit vector, or None.

    Checked before position nouns because it is an instruction rather than a
    description: "위층의 서가로 수직 상승" contains 서가 (which reads as
    upper-left) but what the designer asked for is a rise, and the rise is the
    statement that must survive.
    """
    if not text:
        return None
    for pat, vec in _DIR:
        if re.search(pat, text):
            return vec
    return None


def _match_ordinal(text):
    """Which member of a stacked set is live, as a vertical offset, or None."""
    if not text:
        return None
    for pat, band in _ORD_ROW:
        if re.search(pat, text):
            return (0.0, band * 0.34)
    return None


def _as_text(v):
    """Whatever the table put in a field, as something a regex can read.

    Not defensive habit — a measured necessity. shots.py (ACT1~2) and rows38.json
    (ACT3~8) were authored months apart by different hands, and `objects` is prose
    in one and sometimes an integer in the other. A reader shared by both tables
    must therefore normalise rather than assume.
    """
    if v is None:
        return ""
    if isinstance(v, (list, tuple)):
        return " ".join(_as_text(x) for x in v)
    if isinstance(v, dict):
        return " ".join(_as_text(x) for x in v.values())
    return str(v)


def path_of(row):
    """(from_offset, to_offset) when the row describes travel between two places.

    Two sources, in order of how explicit they are:

      an explicit camera direction ("수직 상승", "아래로 하강", "횡단") becomes a
      traversal from one side of the available room to the other, because that is
      what the designer asked the camera to do;

      an arrow or 에서...로 form whose BOTH ends resolve to a position. A path with
      one known end is not a path — it is a single target, and pretending
      otherwise would invent the other end.

    `objects` is coerced to str because the two shot tables disagree about its
    type: rows38.json always carries prose, but shots.py's ACT1~2 rows carry an
    integer count in the same field for some rows. Reading the other table's rows
    through this function crashed on exactly that (TypeError: got 'int'), which is
    the kind of defect that only appears when a second caller arrives — so it is
    fixed here, at the reader, rather than by editing either table.
    """
    # The designer's token decides this ALONE when present, and concatenating it
    # with the prose would break that: A6-08's token is 수직 상승 but A3-01's is
    # 중앙 while its prose still contains 확장 language, so a combined string lets
    # the prose reinstate a path the designer deliberately did not ask for. A token
    # that names no direction is an answer — this row is a target, not a traversal.
    tok = token_of(row)
    txt = tok if tok else _as_text(row.get("objects"))

    d = _match_dir(txt)
    if d is not None:
        dx, dy = d
        # travel across the room, centred: from -half to +half of the direction
        return (-dx * 0.5, -dy * 0.5), (dx * 0.5, dy * 0.5)

    m = _ARROW.search(txt)
    if m:
        a, b = _match_pos(m.group(1)), _match_pos(m.group(2))
        if a is not None and b is not None and a != b:
            return a, b
    return None


def target_of(row):
    """Where the sentence says the interesting thing is, as (ox, oy), or None.

    Order matters. `objects` is the designer's description of what is in the
    frame and where — it is the most direct statement of the aim point, so it is
    read first. `note` is the camera instruction and often repeats the position;
    it is the fallback. Narration is not scanned for position: it says what is
    being discussed, not where it sits on the plate.
    """
    if row.get("text"):
        return None                      # glass panel: never aim off-centre
    # Same precedence as path_of: an explicit token replaces the prose rather than
    # being added to it, so 중앙 really means centre even when the prose mentions a
    # side in passing.
    tok = token_of(row)
    txt = tok if tok else _as_text(row.get("objects"))
    off = _match_pos(txt)
    if off is not None and off != (0.0, 0.0):
        return off
    # An ordinal is a weaker but real statement of where to look: it says which
    # row of a stack the sentence is about. Used only when no position noun did.
    return _match_ordinal(txt)


def room_for(zoom):
    """How far the crop centre may move, at a given zoom, and stay on the plate.

    At zoom z the crop is 1/z of the plate, so its centre can travel (1 - 1/z)
    of a half-frame in each axis before an edge shows. Nine tenths of that is
    used, because zoompan rounds and an exactly-flush crop can sample one pixel
    past the edge.
    """
    if zoom <= 1.0:
        return 0.0
    return max(0.0, (1.0 - 1.0 / zoom)) * 0.9


def fit(off, room):
    """Scale an aim offset down until it fits, preserving its DIRECTION.

    Clamping each axis independently was wrong, and proof_aim.py showed why:
    zoompan does not letterbox an over-budget crop, it clamps the crop internally,
    so an impossible aim renders as a move that travels partway and then FREEZES.
    A frozen move is worse than a centred one — the eye is promised a movement and
    then denied it. Per-axis clamping also bends a diagonal aim into a vertical or
    horizontal one, which changes what the shot is pointing at.

    Scaling the vector instead keeps the camera pointing at the same thing, just
    less far, which is the honest degradation.
    """
    ox, oy = off
    m = max(abs(ox), abs(oy))
    if m <= room or m == 0.0:
        return (round(ox, 4), round(oy, 4))
    k = room / m
    return (round(ox * k, 4), round(oy * k, 4))


def aim_for(row, plan_d):
    """Convert a motion plan into an aimed motion plan.

    Three cases, in the benchmark's own terms:

      path      the narration describes a flow, so the camera starts on one named
                place and ends on the other. This is the "pan along the river"
                case and it is why 관통 exists as a verb.

      target    the narration names a thing, so the move ENDS with that thing at
                frame centre. An arrival lands on it; a conclusion opens out FROM
                it, which means the named thing is where the move STARTS.

      neither   aim stays at plate centre, unchanged from before.

    The offsets are clamped to what the zoom can afford at both ends of the move,
    so an aimed shot can never letterbox — the failure mode that would make this
    worse than the centred version it replaces.
    """
    d = dict(plan_d)
    z0, z1 = d["z0"], d["z1"]
    r0, r1 = room_for(z0), room_for(z1)

    # A text row keeps the centre at both ends, whatever else the sentence says.
    if row.get("text"):
        d["aim0"] = (0.0, 0.0)
        d["aim1"] = (0.0, 0.0)
        d["aim_reason"] = "centre: glass panel — glyphs must not be cropped"
        return d

    p = path_of(row)
    if p is not None:
        (ax, ay), (bx, by) = p
        # A path needs room at BOTH ends, and the zoom at the start of a move is
        # often 1.0 — which affords nothing. So a traversal is given the smaller
        # of the two budgets and moves symmetrically about the centre, which is
        # what "travel across the room" means on a flat plate.
        r = min(r0, r1) if min(r0, r1) > 0 else max(r0, r1)
        d["aim0"] = fit((ax, ay), r)
        d["aim1"] = fit((bx, by), r)
        d["aim_reason"] = "path: camera travels the route the sentence describes"
        return d

    t = target_of(row)
    if t is None:
        d["aim0"] = (0.0, 0.0)
        d["aim1"] = (0.0, 0.0)
        d["aim_reason"] = "centre: the row names no position, so none is invented"
        return d

    tx, ty = t
    if d["verb"] == "후퇴":
        # A conclusion opens out FROM the subject: it is on the named thing at the
        # start and lets the whole frame back in. A 후퇴 starts zoomed IN, so r0 is
        # the budget that matters and it is the larger one.
        d["aim0"] = fit((tx, ty), r0)
        d["aim1"] = (0.0, 0.0)
        d["aim_reason"] = "opens out from the named subject to the whole"
    else:
        # An arrival (and a held beat) settles ON the named thing.
        d["aim0"] = (0.0, 0.0)
        d["aim1"] = fit((tx, ty), r1)
        d["aim_reason"] = "lands on the named subject"
    return d


def split_aim(aimed, i, n):
    """Slice an aimed plan across a row's n internal cuts.

    The aim travels with the gesture, so cut i covers the i-th slice of the path
    from aim0 to aim1. A three-cut traversal therefore keeps moving toward the
    same destination across all three cuts instead of restarting its aim.
    """
    d = dict(aimed)
    if n > 1:
        a, b = i / n, (i + 1) / n
        (x0, y0), (x1, y1) = aimed["aim0"], aimed["aim1"]
        d["aim0"] = (x0 + (x1 - x0) * a, y0 + (y1 - y0) * a)
        d["aim1"] = (x0 + (x1 - x0) * b, y0 + (y1 - y0) * b)
    # Re-fit against THIS cut's zooms. motion38.split gives each cut its own slice
    # of the zoom range, so a cut early in a gesture is less zoomed than the row
    # was, and an aim that fitted the row's final zoom may not fit this cut's.
    # Skipping this recheck is what would freeze a mid-gesture cut.
    d["aim0"] = fit(d["aim0"], room_for(d["z0"]))
    d["aim1"] = fit(d["aim1"], room_for(d["z1"]))
    return d
