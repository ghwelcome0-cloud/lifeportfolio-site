"""Prove, before spending anything, that an AIMED crop renders and never letterboxes.

Two things could go wrong with the aim expression and both are silent:

  ffmpeg could reject it. zoompan accepts arithmetic on `zoom` and `on`, but that
  was established for the easing expression only; the aim adds a second
  interpolation multiplied by a plate dimension. Lesson 86 applies — a filter's
  grammar is established by rendering one cut, not by reading the manual.

  It could render and still be wrong. If the aim exceeds what the zoom affords,
  zoompan clamps the crop internally and the shot stops moving, or samples past
  the plate edge and shows black. Neither raises an error. So this checks the
  actual border pixels of the first, middle and last frame, and it checks that
  the aimed shot's content genuinely differs from the centred one.

Run: python3 proof_aim.py     (free — no model calls)
"""
import os
import subprocess
import numpy as np
import cv2
import assemble as A
import aim38

PLATE = "/home/user/lf/land38/S03.png"
OUT = "_proof"
os.makedirs(OUT, exist_ok=True)


def borders_black(path):
    """Worst-case border brightness over first / middle / last frame."""
    cap = cv2.VideoCapture(path)
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    worst = []
    for idx in (0, n // 2, n - 1):
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ok, im = cap.read()
        if not ok:
            worst.append((idx, -1.0))
            continue
        # a letterbox shows as a fully dark row/column at the very edge
        edges = [im[0, :, :], im[-1, :, :], im[:, 0, :], im[:, -1, :]]
        worst.append((idx, min(float(e.mean()) for e in edges)))
    cap.release()
    return worst


def mean_abs_diff(a, b, idx):
    ca, cb = cv2.VideoCapture(a), cv2.VideoCapture(b)
    ca.set(cv2.CAP_PROP_POS_FRAMES, idx)
    cb.set(cv2.CAP_PROP_POS_FRAMES, idx)
    oa, ia = ca.read()
    ob, ib = cb.read()
    ca.release()
    cb.release()
    if not (oa and ob):
        return -1.0
    return float(np.abs(ia.astype(np.float32) - ib.astype(np.float32)).mean())


def main():
    assert os.path.exists(PLATE), PLATE
    dur, z0, z1 = 2.0, 1.00, 1.20
    room = aim38.room_for(z1)
    print(f"plate {PLATE}")
    print(f"zoom {z0}->{z1}   room_for(z1) = {room:.4f} half-plate units")

    cases = [
        ("centre", (0.0, 0.0), (0.0, 0.0)),
        ("aim_right_max", (0.0, 0.0), (room, 0.0)),
        ("aim_left_max", (0.0, 0.0), (-room, 0.0)),
        ("aim_corner_max", (0.0, 0.0), (room * 0.7071, room * 0.7071)),
        # deliberately over-budget: this is what the clamp exists to prevent, and
        # the point of rendering it is to see the failure so the clamp is not
        # taken on faith.
        ("aim_over_budget", (0.0, 0.0), (room * 3.0, 0.0)),
    ]
    made = {}
    for name, a0, a1 in cases:
        out = f"{OUT}/{name}.mp4"
        try:
            A.kenburns(PLATE, dur, out, z0=z0, z1=z1, pan=(0.0, 0.0),
                       ease="out", aim0=a0, aim1=a1)
            made[name] = out
            print(f"  rendered {name:18} aim1={a1}")
        except subprocess.CalledProcessError as e:
            print(f"  FAILED   {name:18} rc={e.returncode}")

    print("\n--- border brightness (a letterbox reads as ~0) ---")
    for name, path in made.items():
        print(f"  {name:18} {borders_black(path)}")

    print("\n--- does aiming actually change the picture? ---")
    if "centre" in made:
        for name, path in made.items():
            if name == "centre":
                continue
            d_last = mean_abs_diff(made["centre"], path, 47)
            d_first = mean_abs_diff(made["centre"], path, 0)
            print(f"  {name:18} first-frame diff {d_first:6.2f}   "
                  f"last-frame diff {d_last:6.2f}")


if __name__ == "__main__":
    main()
