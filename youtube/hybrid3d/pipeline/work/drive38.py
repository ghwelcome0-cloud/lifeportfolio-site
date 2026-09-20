"""Render ACT3~8 (150.32 -> 500.00s) from the approved plates.

This is the ACT3~8 counterpart of drive500.py, and it differs from it in exactly
two ways that matter.

First, the internal cut. A row in the shot table is a SENTENCE, and V-1 was
explicit that a sentence is never split in the SSOT. But a seven-second still
carried by one continuous Ken Burns move reads as a slideshow — precisely the
"PPT slides stitched together" the CEO said we had finally escaped. So the
renderer cuts inside 17 named rows at times the team specified, while the row
keeps one sentence id and one camera meaning. Those cut points are read from
subseg38, never invented here: a row absent from the lock table is rendered
whole no matter how long it runs, because inventing a cut invents a beat the
designer did not write.

Second, the generated-clip budget — and this is where the file was wrong for a
long time. The header used to say "only three rows are i2v ... every other move
is a camera move", and it called that production rule #1. But the design table
marks 69 of 80 rows v1_kind='i2v' (84%), and only 3 were ever built (6.8%).
The rule was not a rule; it was a rationalisation of the gap. Worse, those three
were made with seedance-2.0, and measurement showed its camera never moved at
all (peak excursion 2.7px).

So the budget is now derived, not declared: a row renders as a generated clip
when the design table asks for one AND the clip physically exists in seg/. The
only rows held back are the nine whose plate has Korean text baked into the
image (P01/P02/P07/P10/P18) — feeding those to a video model melts the
lettering, so they stay Ken Burns. That leaves 57 generated rows from 38 jobs,
all of which passed automatic QC, plus the 3 legacy rows.

A missing generated clip is skipped, never substituted. A partial master exists
so the free work can be verified while the paid clips are still in production;
it is not something to ship.
"""

import os
import sys

import shots38 as shots
import subseg38
import motion38
import aim38
import assemble as A

LAND = "/home/user/lf/land38"          # approved plates: <ANCHOR>.png
SEG = "/home/user/lf/land38/seg"       # delivered i2v clips
REPORT = "/home/user/lf/land38/report"  # our own rendered report folios
WORK = "_bld38"
OUT = "act38.mp4"

# ★2026-08-21 개정 — 제1조 개정의 코드적 구현★
#
# 이 표는 원래 "CEO 가 승인한 3행" 이었다. 그 3행은 seedance-2.0 으로 만들었고
# 실측해 보니 카메라가 정지해 있었다(최대이탈 2.7px, 교훈 121). 그리고 설계표를
# 다시 읽어 보니 v1_kind='i2v' 인 행이 69개, 즉 설계의 84% 가 생성 영상이었는데
# 구현은 3행(6.8%)뿐이었다(교훈 118).
#
# CEO-38 "B안 — 생성 영상 확대", CEO-39 "20개 이상으로 승인", CEO-43 "지금까지
# 생성된 영상들은 딱 제가 원하는 모션과 퀄리티에요" 를 거쳐 gemini/omni-flash 로
# 38 job(=57 sid)을 생성하고 QC 38/38 PASS 를 받았다.
#
# 따라서 이 표는 이제 "예산 목록" 이 아니라 "실물이 있는 sid 의 목록" 이다.
# 유도 규칙 (제1조 개정 · 제11조):
#   포함 = shots38 의 v1_kind == 'i2v' 이고, seg/i2v_<sid>.mp4 가 실제로 있는 sid
#   제외 = 한글이 plate 에 구워진 anchor(P01/P02/P07/P10/P18) 9 sid — 생성에
#          넣으면 모델이 글자를 녹여 버린다(교훈 122). 이 9 sid 는 kenburns 유지.
# 파생으로 만들되, 개수를 아래에 print 로 드러내어 "조용한 변화" 가 되지 않게 한다.
I2V_FILE = {
    r["sid"]: "i2v_%s.mp4" % r["sid"]
    for r in shots.TABLE38
    if r.get("v1_kind") == "i2v"
    and os.path.exists(os.path.join(SEG, "i2v_%s.mp4" % r["sid"]))
}

# ACT8 narrates folios 03, 05 and 08 of the real issued report, so those three
# pages are photographed from our own report engine rather than drawn by an image
# model: a drawn page would match the palette and say nothing true. S24 also
# opens on folio 03, which is why two anchors share one file.
REPORT_PAGE = {
    "S24": "report_p03.png",
    "S25": "report_p05.png",
    "S26": "report_p08.png",
}


def plate_path(anchor):
    """Locate the still for an anchor, preferring our own rendered report page."""
    if anchor in REPORT_PAGE:
        p = os.path.join(REPORT, REPORT_PAGE[anchor])
        if os.path.exists(p):
            return p
    return os.path.join(LAND, anchor + ".png")


def check_plate_format(path, *, allow_portrait=False):
    """Re-measure every run.

    Approval was granted on measured landscape plates; if a file on disk has since
    been replaced, the render must stop rather than quietly emit a letterboxed
    master. The report folios are the one deliberate exception — a printed page is
    portrait by nature, and ACT8 pushes into it rather than showing it whole, so
    only the minimum width is enforced there.
    """
    import cv2
    im = cv2.imread(path)
    if im is None:
        raise SystemExit(f"unreadable plate {path}")
    h, w = im.shape[:2]
    ar = w / h
    if allow_portrait:
        if min(w, h) < 640:
            raise SystemExit(f"report page {os.path.basename(path)} is {w}x{h} "
                             f"— too small to push into without softening")
        return w, h
    if abs(ar - shots.REQ_AR) > shots.REQ_AR_TOL or w < shots.REQ_MIN_W:
        raise SystemExit(f"plate {os.path.basename(path)} is {w}x{h} ar={ar:.4f} "
                         f"— fails the landscape contract, refusing to render")
    return w, h


def reusable(out, dur):
    """True when a piece already on disk is exactly the length this row wants.

    Measured, not timestamped: a file that exists but is the wrong length is the
    silent-truncation failure the -ss clamp elsewhere guards against, and reusing
    it would carry that failure into the master.
    """
    if not os.path.exists(out):
        return False
    try:
        return abs(A.duration(out) - dur) < A.FR / 2
    except Exception:
        return False


def is_i2v(r):
    """이 행을 생성 클립으로 렌더할 것인가.

    ★왜 r["kind"] 만 보면 안 되는가 (교훈 89)★
    설계표에는 두 개의 열이 있다. v1_kind 는 "설계가 무엇을 원했는가", kind 는
    "무엇으로 렌더했는가" 다. 57개 행은 v1_kind='i2v' 이면서 kind='kenburns' 로
    강등된 상태로 남아 있었다. 강등을 되돌리려면 열 하나를 바꾸는 것으로는 안
    되고, 분기가 읽는 쪽을 함께 바꿔야 한다.

    SSOT(shots38.TABLE38)를 손대지 않고 되돌리기 위해, 분기는 이렇게 읽는다:
        kind 가 이미 i2v      -> 생성 (기존 3행)
        v1_kind 가 i2v 이고 실물이 seg/ 에 있다 -> 생성 (승격 57행)
        그 밖에는            -> kenburns (baked-text 9행 포함)
    I2V_FILE 자체가 "실물이 있는가" 를 이미 걸러 두었으므로 여기서는 멤버십만
    본다. main() 의 kb/iv 집계도 같은 함수를 쓴다 — 두 곳이 다른 규칙을 쓰면
    "렌더는 됐는데 개수 보고가 틀린" 상태가 되어 검증이 무의미해진다.
    """
    return r["kind"] == "i2v" or (
        r.get("v1_kind") == "i2v" and r["sid"] in I2V_FILE)


def render_row(r, idx, prev=None):
    """One row -> one or more MP4 pieces summing to its declared duration.

    `prev` is the previous row in the table, and it is passed only so that
    motion38 can decide whether this shot inherits the previous shot's momentum.
    Two consecutive traversals should read as one journey that happens to be cut,
    which is the effect the CEO described as the whole feeling like one film
    rather than a set of stills that occasionally twitch.
    """
    if is_i2v(r):
        dur = round(r["t1"] - r["t0"], 4)
        # (page-leg bookkeeping lives on the function; see the REPORT_PAGE branch)
        out = f"{WORK}/r{idx:03d}_{r['sid']}.mp4"
        if reusable(out, dur):
            return [out], None, "i2v (reused)"
        fn = I2V_FILE.get(r["sid"])
        if fn is None:
            return None, (f"{r['sid']}: marked i2v but no clip exists in "
                          f"{SEG} — refusing to guess"), None
        src = os.path.join(SEG, fn)
        if not os.path.exists(src):
            return None, f"{r['sid']}: generated clip not delivered yet ({src})", None
        have = A.duration(src)
        # Two frames of headroom: ffmpeg -ss past the end returns rc=0 with a
        # short file, so this clamp is all that separates a silent truncation
        # from a master that is quietly out of sync.
        if r["ss"] + dur > have - 2 * A.FR:
            usable = max(have - r["ss"] - 2 * A.FR, 0)
            return None, (f"{r['sid']}: clip too short — need {dur:.2f}s from "
                          f"ss={r['ss']:.2f} but source is {have:.2f}s "
                          f"(usable {usable:.2f}s)"), None
        A.trim(src, r["ss"], dur, None, out)
        return [out], None, "i2v (object inside the frame actually changes)"

    plate = plate_path(r["anchor"])
    if not os.path.exists(plate):
        return None, f"{r['sid']}: plate for anchor {r['anchor']} not on disk ({plate})", None
    check_plate_format(plate, allow_portrait=r["anchor"] in REPORT_PAGE)

    cuts = subseg38.cuts_for(r)
    n = len(cuts)
    row_dur = round(r["t1"] - r["t0"], 4)

    # A report page is not a plate and cannot be shot like one.
    #
    # ACT8's three stills are portrait pages of a real issued report, and zoompan
    # squeezes a portrait source sideways (proven with a circle probe: bboxes at
    # w/h 2.833 where 1.0 is round). Two framings were rendered and read before
    # choosing. Composing the page onto a 16:9 canvas keeps it whole but puts it
    # on screen only 588px wide at 0.30x — the printed Korean becomes unreadable,
    # which is exactly the "PPT 슬라이드를 붙여서 만든 영상" the CEO said we had
    # finally escaped. Travelling a 16:9 window DOWN the page instead puts the page
    # across 92-97% of the frame at 0.98-1.16x, so glyphs are essentially never
    # resampled, and it is also what the benchmark does with a cross-section: it
    # goes inside the object and reads.
    #
    # The row table gives no aim here — A8-01/02/03 have an empty `objects` and an
    # empty `narr` — so there is nothing to aim at and nothing to invent. The page's
    # own reading order supplies the motion: top to bottom, eased, ending on inked
    # content rather than on the capture's blank margin.
    if r["anchor"] in REPORT_PAGE:
        seen = render_row._page_seen.setdefault(r["anchor"], [])
        leg = len(seen)
        seen.append(r["sid"])
        # Consecutive rows on the SAME page must not rewind. The first row reads the
        # upper page, the next continues into the lower page, so two rows read as one
        # continuous descent that happens to be cut — the same principle motion38
        # uses for inherited momentum.
        y_from, y_to = (0.0, 0.55) if leg == 0 else (0.55, 1.0) if leg == 1 else (0.0, 1.0)
        pieces = []
        for i, (a, b) in enumerate(cuts):
            dur = round(b - a, 4)
            if dur <= 0:
                continue
            out = (f"{WORK}/r{idx:03d}_{r['sid']}.mp4" if n == 1
                   else f"{WORK}/r{idx:03d}_{r['sid']}_c{i}.mp4")
            if not reusable(out, dur):
                ya = y_from + (y_to - y_from) * (i / n)
                yb = y_from + (y_to - y_from) * ((i + 1) / n)
                A.pagepan(plate, dur, out, y0=ya, y1=yb,
                          ease="inout" if n == 1 else "linear")
            pieces.append(out)
        return pieces, None, (f"report page: 16:9 window reads down the real page "
                              f"{y_from:.2f}->{y_to:.2f} at full width (no squeeze, "
                              f"no upscale, ends on inked content)")

    # One motion plan for the whole row — the row is one camera gesture — then
    # sliced across its internal cuts. Deriving the plan from the row rather than
    # from each cut is what keeps a seven-second sentence reading as one move
    # instead of three restarts.
    p_row = motion38.plan(r, row_dur, prev=prev)

    # ...and then aimed. motion38 decides HOW the camera moves; aim38 decides WHAT
    # it moves toward, by reading the position language the shot table already
    # carries ("좌측 책상에", "우측 협업공간", "개인 책상→협업 테이블로 횡단").
    # Without this second step every arrival arrives at the middle of the plate
    # regardless of the sentence, which is the "움직임에 의미가 없다" the CEO
    # identified. A row that names no position keeps the centre — the aim is read,
    # never guessed.
    p_row = aim38.aim_for(r, p_row)

    pieces = []
    for i, (a, b) in enumerate(cuts):
        dur = round(b - a, 4)
        if dur <= 0:
            continue
        out = (f"{WORK}/r{idx:03d}_{r['sid']}.mp4" if n == 1
               else f"{WORK}/r{idx:03d}_{r['sid']}_c{i}.mp4")
        if not reusable(out, dur):
            d = aim38.split_aim(motion38.split(p_row, i, n), i, n)
            A.kenburns(plate, dur, out, z0=d["z0"], z1=d["z1"], pan=d["pan"],
                       ease=d["ease"], head=d["head"], tail=d["tail"],
                       aim0=d["aim0"], aim1=d["aim1"])
        pieces.append(out)
    return pieces, None, f"{p_row['reason']} | {p_row['aim_reason']}"


# Which legs of which report page have already been shot, so a second row on the
# same page continues downward instead of restarting at the top. Held on the
# function rather than in a global because it is bookkeeping for exactly one branch.
render_row._page_seen = {}


def main():
    dry = "--dry" in sys.argv
    table = shots.TABLE38

    if not shots.CEO_PLATE_APPROVAL_38:
        raise SystemExit(
            "shots38.CEO_PLATE_APPROVAL_38 is False — the ACT3~8 plates have not "
            "been approved by the CEO yet. Refusing to render on top of unapproved "
            "images; that is how the earlier rejection cycles started.")

    os.makedirs(WORK, exist_ok=True)

    kb = [r for r in table if not is_i2v(r)]
    iv = [r for r in table if is_i2v(r)]
    total_cuts = sum(len(subseg38.cuts_for(r)) for r in kb)
    print(f"rows {len(table)}   kenburns {len(kb)} rows -> {total_cuts} pieces (free)"
          f"   i2v {len(iv)} (generated)")
    # 설계가 원한 양과 실제로 넣는 양을 나란히 찍는다. 이 두 숫자가 벌어진 것을
    # 오래 모르고 있었으므로(교훈 118), 이제 매 렌더마다 눈에 보이게 한다.
    want = [r for r in table if r.get("v1_kind") == "i2v"]
    held = [r["sid"] for r in want if not is_i2v(r)]
    print(f"design wants i2v {len(want)} rows -> built {len(iv)} "
          f"({100.0 * len(iv) / max(len(want), 1):.1f}%)   "
          f"held back {len(held)} (Korean baked into the plate): {sorted(held)}")
    print(f"span {table[0]['t0']:.2f} -> {table[-1]['t1']:.2f}s")

    absent = [s for s in I2V_FILE if not os.path.exists(os.path.join(SEG, I2V_FILE[s]))]
    if absent:
        print(f"awaiting {len(absent)} generated clips: {sorted(absent)}")

    if dry:
        for r in table:
            cuts = subseg38.cuts_for(r)
            tag = "i2v " if is_i2v(r) else ("kb%d " % len(cuts))
            print(f"  {tag}{r['sid']:10} {r['t0']:7.2f}-{r['t1']:7.2f} "
                  f"{r['anchor']:4} {(r.get('note') or '')[:60]}")
        return

    parts, skipped = [], []
    for idx, r in enumerate(table):
        pieces, err, why = render_row(r, idx, prev=table[idx - 1] if idx else None)
        if err:
            print("  SKIP", err)
            skipped.append(r["sid"])
            continue
        parts.extend(pieces)
        print(f"  ok  {r['sid']:10} {len(pieces)} piece(s)   {why}")

    if not parts:
        raise SystemExit("nothing rendered")

    A.concat(parts, OUT, "act38")
    got = A.duration(OUT)
    want = table[-1]["t1"] - table[0]["t0"]
    print(f"\n{OUT}  {got:.3f}s   ({len(parts)} pieces)")
    print(f"declared span {want:.3f}s   difference {got - want:+.3f}s")
    if skipped:
        print(f"\nSKIPPED {len(skipped)} rows: {skipped}")
        print("This master is INCOMPLETE by exactly those rows. It exists so the "
              "free work can be verified while the generated clips are still in "
              "production. Do not ship a partial.")


if __name__ == "__main__":
    main()
