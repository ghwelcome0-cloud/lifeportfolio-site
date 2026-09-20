#!/usr/bin/env python3
"""Build the Video-to-Video prompt for every job in jobs.json.

The five mandatory elements (Article 14 (14)-5, raised from four by lesson 165):
  1  @Video1 = STRUCTURE  (perspective, camera path, timing) -- obey it exactly
  2  @Image1 = TEXTURE    (material, lighting, colour) -- take look from here
  3  colour -> real object mapping (one colour, one role)
  4  the Korean glyph is NOT a marker -- it is FINAL CONTENT, reproduce it exactly
  5  a ban list (no subtitles, no UI, no watermark, no invented text)

Element 4 is the one that removed the misspelling defect and won CEO approval;
without it the generator treats every shape in the previz as a proxy to replace,
including the letters, and invents Latin gibberish.

Lesson 167 (this revision)
--------------------------
The first version of this file described the glyph the same way for all 60 jobs:
"the three coloured panels ... the RED KOREAN TEXT". That was written for the
converge gesture, where three glyphs really do exist and really do travel into
one point. On a lift job there is only ONE glyph, and on an ACT8 job there is
none at all -- telling the generator to look for three made it invent a pile,
which it rendered as red scribble (observed in the J_A3-02 pilot). So both the
MAP sentence and the GLYPH sentence are now derived from job["word_gesture"].

Lesson 168 (this revision)
--------------------------
The gaze target now differs per gesture, so the prompt must also say where the
frame ends up: on a lift/none job the camera stays on the paper, it does not
rise into empty air.
"""
import json, os

JOBS = "/home/user/lf/r3d/jobs.json"
OUT = "/home/user/lf/r3d/prompts.json"
LAND = "/home/user/lf/land38"
CANVAS = {"S24", "S25", "S26"}          # real report folios, see v2v.plate_path

WORD = {"A3": "방식", "A4": "변화", "A5": "기준", "A6": "조율자", "A7": "역할"}

VERB_EN = {
    "도착": "the camera arrives and settles low over the desk",
    "관통": "the camera travels laterally through the space, passing the documents",
    "후퇴": "the camera pulls back and rises, revealing the whole desk and room",
    "정지": "the camera barely moves, holding the framing with only slight parallax",
}

STRUCTURE = (
    "Use @Video1 ONLY as the STRUCTURE reference: reproduce its camera path, "
    "perspective, parallax, object placement and timing frame for frame. "
    "Do not add camera movement that is not in @Video1 and do not remove any. "
    "{verb_en}. There is a deliberate still hold at the start of the shot — keep it still."
)

TEXTURE = (
    "Use @Image1 ONLY as the TEXTURE and LIGHTING reference: photoreal Korean office "
    "interior, warm daylight, matte paper, shallow depth of field, natural film grain, "
    "no stylisation, no illustration look."
)

# ---- element 3: colour -> object, common part ------------------------------
MAP_BASE = (
    "Replace the coloured primitives in @Video1 with real objects, keeping their exact "
    "position and motion: the dark grey slab is a wooden desk surface; the three flat "
    "coloured panels (magenta, cyan, yellow) become three real printed A4 project "
    "documents lying on the desk, slightly different papers, no readable body text; "
    "the brown side slabs become office walls; the red cylinder becomes a ceramic mug."
)

# ACT8 narrates folios of the real issued report; there is no glyph plane at all,
# so the paper in shot is the report itself, not three project documents.
MAP_REPORT = (
    "Replace the coloured primitives in @Video1 with real objects, keeping their exact "
    "position and motion: the dark grey slab is a wooden desk surface; the flat coloured "
    "panels become the printed pages of one ivory report booklet lying open on the desk, "
    "matte paper, printed layout as in @Image1, no invented text; the brown side slabs "
    "become office walls; the red cylinder becomes a ceramic mug."
)

# ---- element 4: the glyph, per gesture ------------------------------------
GLYPH_CONVERGE = (
    "The RED KOREAN TEXT visible in @Video1 is NOT a marker — it is the actual final "
    "text and must be reproduced EXACTLY as the identical Korean word 「{word}」, "
    "same glyphs, same position, same rotation, same scale, frame for frame. "
    "There are THREE separate copies of 「{word}」, one on each of the three documents, "
    "and they drift toward a single point above the desk: keep them as three distinct, "
    "fully legible words for the whole shot — they must never merge, overlap or smear "
    "into a blob. "
    "Preserve the Korean characters exactly as shown in @Video1 — do not translate, "
    "do not substitute Latin letters, do not invent new words."
)

GLYPH_LIFT = (
    "The RED KOREAN TEXT visible in @Video1 is NOT a marker — it is the actual final "
    "text and must be reproduced EXACTLY as the identical Korean word 「{word}」, "
    "same glyphs, same position, same rotation, same scale, frame for frame. "
    "There is exactly ONE copy of 「{word}」, printed in red on a single document, and it "
    "rises slightly off the paper in place: keep it as one single legible word, do not "
    "duplicate it onto the other documents, do not add any second word. "
    "Preserve the Korean characters exactly as shown in @Video1 — do not translate, "
    "do not substitute Latin letters, do not invent new words."
)

GLYPH_NONE = (
    "There is NO text of any kind in this shot. Do not add any Korean or Latin word, "
    "no red lettering, no headline, no label. The documents stay blank apart from the "
    "printed texture taken from @Image1."
)

# ---- element 4b: TYPOGRAPHIC QUALITY ------------------------------------
# [CEO-57] "글자 반영할 때 튀리토고 신경 쓰 줘요. 이미지 수준의 글자 튀리토이어야 합니다."
# and, on review, that this means visual grade too -- not just correct shapes.
# The previz now hands the generator 226-435 px of clean ink, so the prompt's job
# is to stop the generator SOFTENING it back down: the word must be rendered as
# real printed matter at the same photographic grade as the plate, with the same
# lens, the same lighting and the same paper grain.
TYPOGRAPHY = (
    "TYPOGRAPHIC QUALITY IS CRITICAL. Render the Korean word as real printed ink on "
    "paper, at exactly the same photographic quality as the rest of the image: "
    "razor-sharp stroke edges, crisp and fully opaque, even stroke weight, "
    "print-quality Korean typography with clean terminals and correctly closed "
    "counters. The lettering must sit IN the paper with the sheet's own grain, "
    "receiving the same light and the same soft shadow as the document it is printed "
    "on, never a flat sticker pasted on top. "
    "Absolutely no blur, no smearing, no ghosting, no double edges, no halo, no "
    "jagged stair-stepped outlines, no melted or wobbling strokes, no low-resolution "
    "mush, no plastic or neon glow. The word must read as cleanly as printed text "
    "photographed with the same lens as the plate. "
    # The AI-video agent's recommendation (order 59, deliverable G) added an axis
    # this paragraph did not have: everything above describes the print quality of
    # ONE frame, and says nothing about the word being the SAME word in the next
    # frame. A model can satisfy every clause above and still redraw the glyphs
    # slightly differently each frame, which reads as boiling lettering.
    #
    # Two things in the team's draft were NOT adopted. It said "the single word",
    # but a converge shot carries THREE copies, so the count is left to the GLYPH_*
    # element that actually knows it. And it called the lettering an "immutable
    # frame-locked texture", which a video model can read as "the camera must not
    # move either" -- the opposite of what we want. What we want is stated
    # positively below: the ink is fixed TO THE PAPER, and the paper is free to
    # move with the camera.
    "The lettering is fixed to the paper, not to the screen: every glyph keeps the "
    "identical spelling, stroke count, stroke order, shape, kerning and colour in "
    "every single frame, printed once and never redrawn, reinterpreted, translated, "
    "duplicated, replaced or converted into Latin letters between frames. The paper "
    "itself moves freely with the camera, and the ink moves with the paper exactly "
    "as real print would."
)

# ---- element 5 -----------------------------------------------------------
BAN = (
    "Do NOT add subtitles, captions, watermarks, logos, UI overlays, numbers, charts, "
    "or any text that is not already present in @Video1. No people's faces. "
    "No text on the document bodies."
)

# lesson 168: say where the frame lands, so the model does not tilt off the desk
FRAME_END = {
    "converge": "The shot ends looking slightly up, following the words above the desk; "
                "the documents stay inside the frame.",
    "lift": "The shot ends still looking down at the desk surface; the documents remain "
            "fully inside the frame at all times and never slide out of the bottom.",
    "none": "The shot ends still looking down at the desk surface; the paper stays "
            "centred and fully inside the frame at all times.",
}


def plate_path(anchor):
    if anchor in CANVAS:
        return os.path.join(LAND, "canvas", anchor + "_tall.png")
    return os.path.join(LAND, anchor + ".png")


def build(job):
    g = job.get("word_gesture", "lift")
    parts = [STRUCTURE.format(verb_en=VERB_EN.get(job["verb"], VERB_EN["정지"])), TEXTURE]
    parts.append(MAP_REPORT if job["act"] == "A8" else MAP_BASE)
    w = WORD.get(job["act"])
    if g == "none" or not w:
        parts.append(GLYPH_NONE)
    elif g == "converge":
        parts.append(GLYPH_CONVERGE.format(word=w))
    else:
        parts.append(GLYPH_LIFT.format(word=w))
    if g != "none":
        parts.append(TYPOGRAPHY)
    parts.append(FRAME_END[g])
    obj = (job["objects"] or "").strip()
    if job["act"] == "A8":
        obj = obj or "a finished ivory report booklet lying open on a tidy desk"
    parts.append("Scene content: " + (obj or "a Korean office desk with printed documents"))
    parts.append(BAN)
    return " ".join(parts)


def main():
    jobs = json.load(open(JOBS))["jobs"]
    out = []
    for j in jobs:
        p = build(j)
        out.append({
            "job_id": j["job_id"], "act": j["act"], "plate": j["plate"],
            "gesture": j.get("word_gesture", "lift"),
            "frames": j["frames"], "duration_s": j["duration_s"],
            "video_url": "/home/user/lf/r3d/_batch/%s.mp4" % j["job_id"],
            "image_url": plate_path(j["plate"]),
            "prompt": p,
            "narr": j["narr"], "motion_reason": j["motion_reason"],
        })

    # ---- gate: the prompt must agree with the gesture, or the pilot defect returns
    bad = []
    for o, j in zip(out, jobs):
        g, p = o["gesture"], o["prompt"]
        w = WORD.get(o["act"])
        if g == "converge":
            if "THREE separate copies" not in p:
                bad.append("%s converge without three-copy clause" % o["job_id"])
            if "exactly ONE copy" in p:
                bad.append("%s converge carries the one-copy clause" % o["job_id"])
        elif g == "lift":
            if "exactly ONE copy" not in p:
                bad.append("%s lift without one-copy clause" % o["job_id"])
            if "THREE separate copies" in p:
                bad.append("%s lift carries the three-copy clause" % o["job_id"])
        else:
            if "NO text of any kind" not in p:
                bad.append("%s none without the no-text clause" % o["job_id"])
            if w and "「%s」" % w in p:
                bad.append("%s none still names the word" % o["job_id"])
        if g != "none" and w and "NOT a marker" not in p:
            bad.append("%s missing the glyph declaration" % o["job_id"])
        if not os.path.exists(o["image_url"]):
            bad.append("%s plate missing %s" % (o["job_id"], o["image_url"]))
    if bad:
        raise SystemExit("PROMPT GATE FAILED (%d):\n  " % len(bad) + "\n  ".join(bad[:20]))

    json.dump({"version": 2, "rows": out}, open(OUT, "w"), ensure_ascii=False, indent=1)
    import collections
    gc = collections.Counter(o["gesture"] for o in out)
    print("PROMPT GATE OK  prompts %d  chars %d-%d"
          % (len(out), min(len(o["prompt"]) for o in out),
             max(len(o["prompt"]) for o in out)))
    print("  gestures %s" % dict(gc))
    print("  glyph declaration: %d   no-text clause: %d"
          % (sum("NOT a marker" in o["prompt"] for o in out),
             sum("NO text of any kind" in o["prompt"] for o in out)))
    print("  wrote %s" % OUT)


if __name__ == "__main__":
    main()
