"""
inspect_anchors.py — free, local acceptance gate for delivered anchor plates.

Why this exists
───────────────
The twelve ACT1~2 anchors came back at craft 9.0 and were still unusable, because
every one of them was portrait while the master is landscape. I found that with
cv2.imread().shape after the fact. Paying an image-understanding model to grade
craft is worth it only AFTER the cheap, deterministic checks pass, so this file
runs first and runs for nothing:

  · orientation and resolution, measured from pixels rather than filenames
  · upscale demand against the 1920-wide master
  · a cyan-mask probe that locates the glass panel and reports whether it sits
    inside the frame with Ken Burns headroom left over
  · glow probe: saturated bright pixels on the paper region, which is how the
    rejected sci-fi conduit plates announced themselves numerically

What it deliberately does NOT do
────────────────────────────────
It does not grade Korean glyph craft and it does not read the panel text. A pixel
statistic cannot tell a correct sentence from a plausible-looking wrong one, and
that judgement stays with a person comparing against PANELS byte for byte. This
file only refuses the failures that are cheap to prove.
"""

import os
import sys
import glob

import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import shots as SH

# Panels occupy this share of frame height in an acceptable landscape plate. Below
# the floor the Korean is too small to survive a 1080p downscale; above the
# ceiling a 1.5% Ken Burns push would crop the sentence.
PANEL_H_LO, PANEL_H_HI = 0.28, 0.58

# Cyan neon of the glass panel, in HSV. Widened from the probe I ran on the
# portrait set, where one of four panels went undetected at 275 px and produced a
# false "cannot measure" rather than a real answer.
CYAN_LO = np.array([80, 60, 140], np.uint8)
CYAN_HI = np.array([105, 255, 255], np.uint8)

# Glow is REPORTED, never judged. I first wrote this as a hard sci-fi detector on
# the theory that a glowing conduit is bright AND saturated at once. A calibration
# sweep over the twelve portrait plates — the two I had already rejected for sci-fi
# contamination against the ten I had passed — destroyed that theory:
#
#   metric      rejected sci-fi pair   passed ten          separates?
#   satbright   0.0016 - 0.0021 %      0.0170 - 0.8453 %   inverted
#   cyanglow    0.0000 - 0.0504 %      0.0000 - 0.0353 %   no
#   blueglow    0.0000 - 0.0000 %      0.0000 - 0.0179 %   no
#   coolsat     0.0010 - 1.2968 %      0.0000 - 0.2774 %   no (panels reach 4.72)
#   hotwhite    0.2691 - 0.5550 %      0.0319 - 0.6894 %   no
#
# The sci-fi plates scored LOWER than the clean ones on every candidate. The
# statistic was counting warm, brightly lit paper, not emitting artwork, and the
# glass panel plates overlap the sci-fi pair on the only cool-hue metric. A conduit
# drawn into a document is a semantic fact about what the object IS, and no global
# histogram carries that. So the number is printed for the record and the verdict
# belongs to a person or to the image model. Lesson 68 cuts both ways: cheap
# deterministic checks come first, but only the ones that actually decide.
GLOW_S, GLOW_V = 130, 210


def panel_band(img):
    """Rows spanned by the cyan panel, or None when no panel is present."""
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(hsv, CYAN_LO, CYAN_HI)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    rows = np.where(mask.sum(axis=1) > mask.shape[1] * 0.02)[0]
    if rows.size < 8:
        return None
    return int(rows[0]), int(rows[-1])


def glow_fraction(img):
    """Share of pixels that are simultaneously bright and saturated."""
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    s, v = hsv[:, :, 1], hsv[:, :, 2]
    return float(((s > GLOW_S) & (v > GLOW_V)).sum()) / s.size


def inspect(path, expect_panel):
    im = cv2.imread(path)
    if im is None:
        return ["decode failed"], [], {}
    h, w = im.shape[:2]
    ar = w / h
    err, warn = [], []
    info = {"w": w, "h": h, "ar": ar}

    if abs(ar - SH.REQ_AR) > SH.REQ_AR_TOL:
        err.append(f"aspect {ar:.4f} != {SH.REQ_AR:.4f} "
                   f"({'PORTRAIT' if w < h else 'LANDSCAPE'})")
    if w < SH.REQ_MIN_W:
        err.append(f"width {w} < {SH.REQ_MIN_W} — would need "
                   f"{SH.REQ_MIN_W / w:.2f}x upscale, glyphs would soften")

    band = panel_band(im)
    if expect_panel:
        if band is None:
            err.append("panel expected but no cyan band found")
        else:
            frac = (band[1] - band[0]) / h
            info["panel_rows"] = band
            info["panel_frac"] = frac
            # Both bounds are warnings, not failures. The same sweep that broke the
            # glow theory showed the cyan probe is unreliable in absolute terms: it
            # measured one accepted panel at 0.5% of frame height and another at
            # 44.4%, a spread no real layout difference explains. The probe is
            # useful as a rough presence signal and useless as a size ruler, so it
            # must never be the reason a 2048-wide landscape plate gets sent back.
            if frac < PANEL_H_LO:
                warn.append(f"panel height {frac:.1%} below {PANEL_H_LO:.0%} — "
                            f"check by eye that Korean survives the 1080p downscale")
            elif frac > PANEL_H_HI:
                warn.append(f"panel height {frac:.1%} above {PANEL_H_HI:.0%} — "
                            f"check by eye that a Ken Burns push cannot crop the sentence")
    # A cyan band on a non-panel shot is not reported at all: it fired on six of
    # the ten clean plates, which makes it noise rather than a finding.

    info["glow"] = glow_fraction(im)   # recorded, never a verdict — see above
    return err, warn, info


def main(folder):
    paths = sorted(glob.glob(os.path.join(folder, "*.png")))
    if not paths:
        print(f"no plates in {folder}")
        return 2

    panel_tc = set(SH.PANELS)
    total_err = 0
    for p in paths:
        name = os.path.basename(p)
        expect_panel = "panel" in name.lower() or any(
            f"{tc:06.2f}".replace(".", "") in name.replace(".", "")
            for tc in panel_tc)
        err, warn, info = inspect(p, expect_panel)
        flag = "FAIL" if err else ("warn" if warn else "ok  ")
        dims = f"{info.get('w','?')}x{info.get('h','?')}"
        extra = ""
        if "panel_frac" in info:
            extra = f" panel {info['panel_frac']:.1%}"
        print(f"[{flag}] {name:28s} {dims:>11s} "
              f"ar={info.get('ar',0):.4f} glow={info.get('glow',0):.3%}{extra}")
        for e in err:
            print(f"        FAIL {e}")
        for wn in warn:
            print(f"        warn {wn}")
        total_err += len(err)

    print()
    print(f"plates {len(paths)}   hard failures {total_err}")
    if total_err:
        print("REJECTED — do not spend a craft-grading call on this set yet.")
        print("Report the measured numbers back to the image agent verbatim.")
        return 1
    print("FORMAT ACCEPTED — and format is all this file can decide.")
    print()
    print("Still requires human or image-model judgement, none of it automatable:")
    print("  1. each panel string against shots.PANELS byte for byte — a pixel")
    print("     statistic cannot tell a correct sentence from a plausible wrong one")
    print("  2. sci-fi contamination: conduits, circuitry, emitting ink. The")
    print("     calibration sweep proved no histogram separates it (see GLOW note)")
    print("  3. document bodies carry zero readable glyphs, grey bars only")
    print("  4. 104.32 shows exactly three sheets")
    print("  5. warm key light from upper left, continuous across all twelve")
    print("  6. glyph craft at or above the floor; 60.64 must clear its old 8.5")
    print()
    print("Automatic checks are a floor, never evidence of quality.")
    return 0


if __name__ == "__main__":
    folder = sys.argv[1] if len(sys.argv) > 1 else "anchors"
    raise SystemExit(main(folder))
