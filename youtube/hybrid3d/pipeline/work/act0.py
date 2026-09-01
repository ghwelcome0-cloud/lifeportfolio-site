#!/usr/bin/env python3
"""act0.py — ACT 0 (0.0 - 31.7 s) of the 500 s longform, fully rendered.

WHY THIS FILE EXISTS
--------------------
CEO-15 (verbatim): "건축물은 실제로 접해도 내부를 해부해서 보기 어려운데, 이 영상
기법을 통해 그 채널은 그걸 해소한 것이죠. 이것까지 참고해서 이제 롱폼 영상 제작하세요."

So the narrative axis is: a SEALED structure that cannot be looked inside, then a
surgical incision, then the interior. ACT 0 is exactly the "sealed" beat plus the
first incision — which makes it the correct proof-of-concept slice: if the dissection
reading lands here, it lands for all 9 ACTs.

Rather than ship a silent 4-shot demo, ACT 0 is rendered COMPLETE — real narration
(D-3 repaired master), real Korean 2D overlays cued to the actual transcript
timecodes, real disguised cuts, real seam blur, real orb. That way CEO approval is
approval of the finished grammar, not of a sketch.

NARRATION CUES — measured, not guessed.
Two independent engines (elevenlabs_scribe_v2, whisper-1) transcribed the master
and agreed on these boundaries to within ~0.1 s:

  0.14- 4.58  회사에서 보낸 시간은 분명 쌓였는데 다음은 잘 보이지 않을 때가 있습니다
  5.28-12.54  해온 일도 늘었고 할 수 있는 일도 많아졌는데 ... 기준이 흐려집니다
 13.26-16.30  바로 이 상태가 오늘의 문장 "쌓였는데 안 보인다" 입니다
 17.06-20.68  오늘은 이직을 해야 하는지 말아야 하는지 대신 정해드리지 않습니다
 21.34-26.74  ... 다음 선택에 가져갈 기준 세 가지를 직접 꺼내보겠습니다
 27.54-29.10  종이나 메모 앱을 준비해 주세요
 29.46-31.70  영상이 끝날 때는 세 문장이 남게 됩니다

SHOT DESIGN — narration drives camera (the benchmark's core grammar)
  s0  0.00- 4.80  a0  sealed wall, lateral drift      "쌓였는데" = the closed shell
  s1  4.80-10.00  b2  strata sensed inside            "늘었고 많아졌는데" = it IS in there
  s2 10.00-13.20  b3  pull back, vast monolith        "기준이 흐려집니다" = too big to read
  s3 13.20-17.00  b4  the incision line is scored     ★ the thesis sentence lands ★
  s4 17.00-21.30  b5  macro into the glowing cut      "대신 정해드리지 않습니다" = we go in
  s5 21.30-26.70  b6  three grooves light up          "기준 세 가지" = noun arrival
  s6 26.70-31.70  b7  camera settles on three slots    "세 문장이 남게 됩니다" = the promise

  Every boundary is a NOUN ARRIVAL or a logical turn, never an arbitrary 4 s tick.
  Motion = logic: drift(survey) -> sense -> retreat(too big) -> cut -> push-in ->
  reveal-count -> settle. That is rule "모션 = 논리" from the reverse-engineered
  benchmark原理 doc, applied literally.

RULES APPLIED (all inherited from assemble.py, all evidence-backed)
  R1 segment 1-5 s          R2 walls are cut, not penetrated
  R3 seam blur V disguises every cut     R4 lighting matched across every cut
  R5 Korean is always a post 2D overlay  R6 the orb never crosses a cut (lesson 51)
"""
import os, sys, subprocess, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import assemble as A
import orb as ORB

SEG = "seg"
OUT = "act0_final.mp4"
AUD = "v13_audio_fixed.wav"        # D-3 repaired master (verified broadcast-acceptable)
T_END = 31.70                      # ends exactly on "세 문장이 남게 됩니다"

# ── shot table ───────────────────────────────────────────────────────────────
# src : clip file
# ss  : in-point inside that clip (all clips are ~4.04-5.04 s of usable motion)
# t0/t1 : position on the ACT timeline
#
# ★ MEASURED SOURCE LIMITS (ffprobe, this session) — a hard constraint, not a guess:
#     a0/a1/a2/a8 = 4.0417 s      b2..b7 / a3..a6 = 5.0850 s      a7 = 5.0417 s
#   The first build attempt died here: it asked for 4.80 s out of a 4.04 s clip
#   starting at ss=0.10, so the frame grab landed past the end, ffmpeg exited 0
#   writing nothing, and cv2.imread returned None. Rule now enforced in code:
#   every shot's (ss + duration) must stay <= source duration - 2 frames.
#   Longer beats are covered by SPLITTING them across two shots (R1 keeps every
#   segment 1-5 s anyway), which also gives us extra disguised cuts — the benchmark
#   cuts far more often than it holds.
#
SHOTS = [
    # "쌓였는데 다음은 잘 보이지 않을 때" 0.14-4.58 → the sealed shell, surveyed
    dict(src="a0.mp4", ss=0.06, t0=0.00,  t1=3.85),
    # "해온 일도 늘었고 할 수 있는 일도 많아졌는데" 5.28-8.04 → it IS in there
    dict(src="b2.mp4", ss=0.05, t0=3.85,  t1=8.05),
    # "기준이 흐려집니다" 8.04-12.54 → pull back, too big to read at once
    dict(src="b3.mp4", ss=0.05, t0=8.05,  t1=12.95),
    # ★ thesis: "쌓였는데 안 보인다" 13.26-16.30 → the incision is scored ★
    dict(src="b4.mp4", ss=0.05, t0=12.95, t1=17.00),
    # "대신 정해드리지 않습니다" 17.06-20.68 → macro push INTO the cut
    dict(src="b5.mp4", ss=0.05, t0=17.00, t1=21.30),
    # "기준 세 가지를 직접 꺼내보겠습니다" 21.34-26.74 → noun arrival, count of three
    dict(src="b6.mp4", ss=0.05, t0=21.30, t1=24.00),
    dict(src="b6.mp4", ss=2.25, t0=24.00, t1=26.70),
    # "종이나 메모 앱을" 27.54-29.10 / "세 문장이 남게 됩니다" 29.46-31.70 → settle
    dict(src="b7.mp4", ss=0.05, t0=26.70, t1=29.30),
    dict(src="b7.mp4", ss=2.55, t0=29.30, t1=31.70),
]

# ── orb path, per shot (R6: independent fade per shot, never crossing a cut) ──
# The orb is the "주인공" token: it is the viewer's own accumulated career.
# ACT 0 arc: it is FAINT and low while the shell is sealed, drifts as we survey,
# then rises and brightens the moment the incision opens, and finally comes to rest
# above the three slots — i.e. the orb *becomes* the thing that will fill them.
#
# WAYPOINTS: one (x, y, r) per shot BOUNDARY, normalised x/y, r in px at 1080p.
# len(ORB_PATH) == len(SHOTS) + 1. The orb segment for shot i runs from
# ORB_PATH[i] to ORB_PATH[i+1], and because consecutive segments SHARE the
# boundary waypoint, the orb fades out and back in at the SAME screen position and
# size across every cut — which is precisely lesson 51. v7 flew a continuous path
# through the cut and scored 5.5 (down from 6.5) because the new scene's perspective
# re-read that screen position as a different depth ("the orb drops onto the desk").
# Identity is preserved by RE-ENTRY, not by an unbroken trajectory.
#
ORB_PATH = [
    (0.30, 0.62, 13),   # 0.00  faint and low: the shell is sealed
    (0.42, 0.58, 16),   # 3.90
    (0.55, 0.53, 19),   # 8.10  sensed deeper inside
    (0.52, 0.51, 15),   # 13.10 small again as we retreat to the wide
    (0.50, 0.46, 25),   # 17.00 ★ brightens the instant the incision opens ★
    (0.50, 0.43, 30),   # 21.30 largest at the push-in
    (0.50, 0.41, 28),   # 24.00
    (0.50, 0.39, 26),   # 26.70
    (0.50, 0.36, 24),   # 29.30
    (0.50, 0.34, 22),   # 31.70 comes to rest above the three slots
]

# ── Korean text: NOT drawn here (rev.2) ──────────────────────────────────────
# The old TXT[] drove ffmpeg drawtext. The CEO rejected that output verbatim:
# "글자 퀄리티는 따로 놀아요. 저급이에요." The reason is structural, not cosmetic —
# drawtext composites a flat 2D glyph onto a 3D-lit photographic plate, so it can
# never share the scene's perspective, key light, or contact shadow. It always
# reads as a caption pasted on top.
#
# Confirmed replacement (lesson 53): every delivered Korean line is rendered
# INSIDE the anchor image by gpt-image-2, as a glowing glass panel that sits on
# the desk plane with its own tilt, spill and grounding shadow. Measured craft on
# that route: 9.8 and 9.7 out of 10, versus the rejected drawtext plate.
#
# Consequence for this driver: shots whose anchor carries a glass panel must NOT
# be sent through i2v, because generative motion resamples and destroys the glyph
# pixels. Those shots are rendered with A.kenburns(), which only crops and scales
# the approved still. See the `text` flag in the 500 s shot table (drive500.py).
# drawtext is forbidden anywhere in this pipeline.


def main():
    os.makedirs(A.WORK, exist_ok=True)
    print(f"=== ACT 0 build — {len(SHOTS)} shots, {T_END:.2f}s ===", flush=True)

    # ── 1. trim each shot, colour-matching it to the tail of the previous one (R4)
    #
    # Every ACT-0 shot lives in one lighting world and no cut here is a deliberate
    # world change, so the policy is continuous throughout and the group label is
    # constant. Both are passed explicitly rather than defaulted: when ACT3~8 joins
    # this driver the boundaries at 150s and 400s are genuine transitions, and a
    # silent default would grade straight through them.
    parts, prev_tail, prev_group = [], None, None
    for i, s in enumerate(SHOTS):
        src = os.path.join(SEG, s["src"])
        dur = s["t1"] - s["t0"]
        group = s.get("group", "A0_PAPER")
        policy = s.get("policy", "continuous")
        extra = None
        if prev_tail is not None:
            cur_win = A.grab_window(src, s["ss"] + 0.02)
            extra, dY, dW = A.colour_match(
                prev_tail, cur_win, policy, prev_group, group,
                transition_reason=s.get("transition_reason"),
                expected_warmth_direction=s.get("expected_warmth_direction"))
        p = f"{A.WORK}/s{i}.mp4"
        A.trim(src, s["ss"], dur, extra, p)
        parts.append(p)
        prev_tail = A.grab_window(p, max(dur - 0.06, 0.0))
        prev_group = group

    # ── 2. concat -> raw timeline (R2: cuts, never generated wall traversal)
    A.concat(parts, f"{A.WORK}/joined.mp4", "concat shots")

    # ── 3. seam blur V on every internal cut (R3)
    seams = [s["t0"] for s in SHOTS[1:]]
    A.apply_seam_blur(f"{A.WORK}/joined.mp4", seams, T_END, f"{A.WORK}/blurred.mp4")

    # ── 4. orb sprite overlay (R6) — one ffmpeg call PER shot, then concat.
    #
    # This replaces the old single-graph A.orb_layer() call. That path animated the
    # sprite's alpha with colorchannelmixer=aa='<expression in t>' and died with
    # rc=234 on every attempt. I first blamed the size of the filter graph; cutting
    # it to a single shot failed identically, and the error text named the real
    # cause: colorchannelmixer's aa= accepts a CONSTANT, never a time expression.
    # A.orb_render() instead fades each sprite with fade=...:alpha=1, which does
    # understand time, and it clamps every request against the measured source
    # length so a -ss past the end cannot silently yield a short file at rc=0.
    spr = "orb_r26.png"
    spr_size = ORB.sprite(26, spr)
    A.orb_render(f"{A.WORK}/blurred.mp4", SHOTS, ORB_PATH, spr, spr_size,
                 f"{A.WORK}/orbed.mp4")

    # ── 5. mux the D-3 repaired narration.
    #
    # Reads orbed.mp4 directly: the former drawtext stage that produced texted.mp4
    # is deleted, since all Korean now lives inside the approved anchor stills.
    A.run(["ffmpeg", "-v", "error", "-y", "-i", f"{A.WORK}/orbed.mp4",
           "-i", AUD, "-t", f"{T_END:.4f}", "-c:v", "copy",
           "-c:a", "aac", "-b:a", "192k", "-ac", "2", "-shortest", OUT],
          "mux repaired narration")

    sz = os.path.getsize(OUT)
    print(f"\nwrote {OUT}  {sz:,} B", flush=True)


if __name__ == "__main__":
    main()
