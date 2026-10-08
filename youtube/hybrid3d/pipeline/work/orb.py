#!/usr/bin/env python3
"""orb.py — 2D vector protagonist orb renderer (LONGFORM-SCALABLE).

WHY THIS EXISTS (CEO-14 transcend mandate / lesson 48):
  The benchmark's water droplet is AI-generated inside the i2v pass, so it MORPHS.
  We composite a mathematically-defined 2D orb ON TOP of the AI footage:
    - position/size/brightness are closed-form functions of t  -> zero morphing
    - survives cuts and dissolves -> it is the CONTINUITY TOKEN (orb function #2)
    - can change state on cue (glow/split/assemble) -> orb function #3

WHY NOT ffmpeg geq (v7 build3.py FAILED rc=234):
  1. geq exposes T (not t) for time, and per-pixel exp() is ~O(2M expensive ops/frame).
  2. At 500 s x 24 fps = 12,000 frames that approach is unusable.
  This renders a small RGBA sprite ONCE per unique radius bucket with numpy,
  then lets ffmpeg do a cheap overlay with time-expression x/y/alpha.

OUTPUT: a PNG sprite + the ffmpeg overlay filter string to place it.
"""
import numpy as np, os
from PIL import Image

# --- orb visual identity (fixed for the whole channel = brand consistency) ----
CORE_RGB = (255, 236, 170)     # warm gold core
HALO_RGB = (255, 200,  90)     # amber halo
HALO_MUL = 3.2                 # halo sigma = core sigma * HALO_MUL
HALO_A   = 0.47                # halo peak alpha


def sprite(radius, path, core_rgb=CORE_RGB, halo_rgb=HALO_RGB):
    """Render one RGBA orb sprite of the given core radius (px)."""
    r = int(round(radius))
    R = int(np.ceil(r * HALO_MUL * 2.6))          # canvas half-size
    S = R * 2 + 1
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
    d2 = (xx - R) ** 2 + (yy - R) ** 2
    core = np.exp(-d2 / (2.0 * r * r))
    halo = np.exp(-d2 / (2.0 * (r * HALO_MUL) ** 2)) * HALO_A
    a = np.clip(core + halo, 0.0, 1.0)
    # colour blend: core colour where core dominates, halo colour outside
    w = np.clip(core / np.maximum(core + halo, 1e-6), 0.0, 1.0)[..., None]
    c = (np.array(core_rgb, np.float32) * w
         + np.array(halo_rgb, np.float32) * (1.0 - w))
    rgba = np.dstack([c, a * 255.0]).astype(np.uint8)
    Image.fromarray(rgba, "RGBA").save(path)
    return S


def overlay_filter(sprite_path_index, size, xexpr, yexpr, aexpr="1"):
    """ffmpeg overlay expression that centres the sprite on (xexpr,yexpr).

    sprite_path_index : input stream index of the PNG (e.g. 1 for [1:v])
    size              : sprite edge length in px (from sprite())
    xexpr/yexpr       : time expressions in *pixels* for the orb centre
    aexpr             : time expression 0..1 for orb opacity (state changes)
    """
    h = size / 2.0
    lbl = f"orb{sprite_path_index}"
    pre = (f"[{sprite_path_index}:v]format=rgba,"
           f"colorchannelmixer=aa={aexpr}[{lbl}];"
           if aexpr != "1" else
           f"[{sprite_path_index}:v]format=rgba[{lbl}];")
    ov = f"overlay=x='({xexpr})-{h}':y='({yexpr})-{h}':eval=frame:format=auto"
    return pre, lbl, ov


if __name__ == "__main__":
    for rr in (26, 40, 56):
        s = sprite(rr, f"orb_r{rr}.png")
        print(f"orb_r{rr}.png  canvas={s}x{s}")
