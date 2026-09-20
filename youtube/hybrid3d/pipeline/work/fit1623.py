"""Bring the two late plates onto the landscape contract without losing the cut.

gpt-image-2 returned 1536x1024 (aspect 1.500) for both S23 and S27, and the plate
contract is 16:9 at >=1920 wide. So 160 rows have to go. WHICH 160 is the whole
question, and it is not a free choice: CEO-34 asked for the cut face to be visible,
and on both of these images the cut face is at the BOTTOM (S23's open drawer with
countable paper layers, S27's shelf compartment under the desktop). A centred crop
would take 80 rows off that cut. So the crop is deliberately asymmetric — most of
it comes off the top, where the content is out-of-focus background.

Also, the aim table addresses these plates by screen position (A7-03 "first cell",
A7-01 "on the desk", A8-04 "on the desk"), so horizontal geometry must not change
at all: the crop is vertical only, and the rescale is uniform.
"""
import cv2

SRC = "/home/user/lf/inbox/rd"
DST = "/home/user/lf/land38"
W, H = 2048, 1152

# (file, anchor, rows taken off the TOP) — the remainder comes off the bottom
JOBS = [("S23_raw.png", "S23", 132),
        ("S27_raw.png", "S27", 138)]


def main():
    for fn, anchor, top in JOBS:
        im = cv2.imread(f"{SRC}/{fn}")
        if im is None:
            raise SystemExit(f"cannot read {fn}")
        sh, sw = im.shape[:2]
        want_h = int(round(sw * H / W))
        drop = sh - want_h
        if drop < 0:
            raise SystemExit(f"{fn} is already too short: {sw}x{sh}")
        top = min(max(top, 0), drop)
        bot = drop - top
        cut = im[top:sh - bot, :]
        out = cv2.resize(cut, (W, H), interpolation=cv2.INTER_LANCZOS4)
        p = f"{DST}/{anchor}.png"
        cv2.imwrite(p, out, [cv2.IMWRITE_PNG_COMPRESSION, 4])
        h2, w2 = out.shape[:2]
        print(f"{anchor}: {sw}x{sh} -> crop -{top}top/-{bot}bot -> {sw}x{want_h} "
              f"-> {w2}x{h2} aspect {w2/h2:.4f}  scale {W/sw:.3f}x  -> {p}")


if __name__ == "__main__":
    main()
