"""Policy-aware cut-boundary colour matching (OpenCV + NumPy only).

Frames are float32/uint8 BGR in nominal full-range 0..255.  The API
deliberately accepts frame sequences: boundary decisions must never be made
from one frame.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable, Sequence

import cv2
import numpy as np


TEMPER = 0.75
GATE_DY, GATE_DW = 6.0, 4.0
POLICIES = {"continuous", "intentional_transition", "hard_reset"}


@dataclass(frozen=True)
class QCLimits:
    # Operational starting points, not creative-look thresholds. Calibrate on
    # the mastered codec/range before promoting these to release gates.
    clip_low: float = 1.0
    clip_high: float = 254.0
    max_clipped_ratio: float = 0.005
    max_illegal_ratio: float = 0.0
    black_crush_level: float = 3.0
    max_black_crush_ratio: float = 0.08
    max_luma_second_diff: float = 6.0


def clamp_per_channel(
    gain: Sequence[float], lo: float = 0.85, hi: float = 1.18
) -> list[float]:
    """Clamp B,G,R gains.

    0.85..1.18 is an INITIAL safety rail only. Replace it after measuring
    20--30 approved boundaries (recommended: median +/- 3*MAD).
    """
    if not (0.0 < lo <= hi):
        raise ValueError(f"invalid gain rails: lo={lo}, hi={hi}")
    a = np.asarray(gain, dtype=np.float64)
    if a.shape != (3,) or not np.all(np.isfinite(a)):
        raise ValueError("gain must contain three finite B,G,R values")
    return np.clip(a, lo, hi).tolist()


def _five(frames: Sequence[np.ndarray], side: str) -> list[np.ndarray]:
    if len(frames) < 5:
        raise ValueError(f"{side}: at least 5 boundary frames are required")
    chosen = list(frames[-5:] if side == "prev" else frames[:5])
    shape = chosen[0].shape
    if len(shape) != 3 or shape[2] != 3:
        raise ValueError(f"{side}: frames must be HxWx3 BGR")
    if any(im.shape != shape for im in chosen):
        raise ValueError(f"{side}: boundary frame shapes differ")
    return [np.asarray(im, dtype=np.float32) for im in chosen]


def _masks(
    exclusion_masks: Sequence[np.ndarray] | None,
    frames: Sequence[np.ndarray],
    side: str,
) -> list[np.ndarray]:
    """Return valid-pixel masks; nonzero input means exclude (orb/flare)."""
    h, w = frames[0].shape[:2]
    if exclusion_masks is None:
        return [np.ones((h, w), dtype=bool) for _ in frames]
    if len(exclusion_masks) < 5:
        raise ValueError(f"{side}: at least 5 exclusion masks are required")
    chosen = list(exclusion_masks[-5:] if side == "prev" else exclusion_masks[:5])
    out: list[np.ndarray] = []
    for mask in chosen:
        m = np.asarray(mask)
        if m.shape != (h, w):
            raise ValueError(f"{side}: exclusion mask shape mismatch")
        out.append(m == 0)
    return out


def _luma(im: np.ndarray) -> np.ndarray:
    # BT.709 full-range luma, input order B,G,R.
    return 0.0722 * im[..., 0] + 0.7152 * im[..., 1] + 0.2126 * im[..., 2]


def _frame_stats(im: np.ndarray, valid: np.ndarray) -> dict[str, Any]:
    y = _luma(im)
    # Colour matching uses robust midtones only. Highlights, shadows, orb and
    # flare pixels cannot steer white balance.
    mid = valid & (y >= 32.0) & (y <= 223.0)
    if np.count_nonzero(mid) < max(64, int(y.size * 0.001)):
        raise ValueError("too few valid midtone pixels after ROI exclusions")

    bgr = np.median(im[mid], axis=0).astype(np.float64)
    y_mid = float(np.median(y[mid]))
    # Positive = warmer. Green is deliberately absent from this opponent axis.
    warmth = float(bgr[2] - bgr[0])

    px = im[valid]
    if px.size == 0:
        raise ValueError("exclusion mask removed every pixel")
    low_clip = float(np.mean(np.any(px <= 1.0, axis=1)))
    high_clip = float(np.mean(np.any(px >= 254.0, axis=1)))
    illegal = float(np.mean(np.any((px < 0.0) | (px > 255.0), axis=1)))
    black = float(np.mean(y[valid] <= 3.0))

    # Heuristic evidence only: staircase-like, low-gradient midtones. This is
    # returned for review, not used as an automatic creative pass/fail gate.
    y8 = np.clip(y, 0, 255).astype(np.uint8)
    gx = cv2.Sobel(y8, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(y8, cv2.CV_32F, 0, 1, ksize=3)
    grad = cv2.magnitude(gx, gy)
    lap = np.abs(cv2.Laplacian(y8, cv2.CV_32F, ksize=3))
    band_roi = mid & (grad >= 1.0) & (grad <= 12.0)
    banding_score = (
        float(np.mean(lap[band_roi] <= 1.0)) if np.any(band_roi) else 0.0
    )
    return {
        "Y": y_mid,
        "warmth": warmth,
        "bgr": bgr,
        "clip_low_ratio": low_clip,
        "clip_high_ratio": high_clip,
        "illegal_ratio": illegal,
        "black_crush_ratio": black,
        "banding_score": banding_score,
    }


def _window_stats(
    frames: Sequence[np.ndarray], masks: Sequence[np.ndarray]
) -> dict[str, Any]:
    rows = [_frame_stats(im, mask) for im, mask in zip(frames, masks)]
    scalar_keys = (
        "Y", "warmth", "clip_low_ratio", "clip_high_ratio",
        "illegal_ratio", "black_crush_ratio", "banding_score",
    )
    out = {key: float(np.median([row[key] for row in rows])) for key in scalar_keys}
    out["bgr"] = np.median(np.stack([row["bgr"] for row in rows]), axis=0)
    out["per_frame_Y"] = [float(row["Y"]) for row in rows]
    return out


def _qc_metrics(
    prev: dict[str, Any], cur: dict[str, Any], limits: QCLimits
) -> dict[str, Any]:
    ys = np.asarray(cur["per_frame_Y"], dtype=np.float64)
    second = np.diff(ys, n=2)
    max_second = float(np.max(np.abs(second))) if second.size else 0.0
    metrics = {
        "clip_low_ratio": cur["clip_low_ratio"],
        "clip_high_ratio": cur["clip_high_ratio"],
        "illegal_ratio": cur["illegal_ratio"],
        "black_crush_ratio": cur["black_crush_ratio"],
        "banding_score": cur["banding_score"],
        "post_cut_Y_5f": cur["per_frame_Y"],
        "post_cut_Y_peak_to_peak": float(np.ptp(ys)),
        "post_cut_Y_max_second_diff": max_second,
    }
    flags = {
        "clipping": max(metrics["clip_low_ratio"], metrics["clip_high_ratio"])
        > limits.max_clipped_ratio,
        "illegal_range": metrics["illegal_ratio"] > limits.max_illegal_ratio,
        "black_crush": metrics["black_crush_ratio"] > limits.max_black_crush_ratio,
        "luma_oscillation": max_second > limits.max_luma_second_diff,
        # No universal threshold: codec/content calibration and visual review required.
        "banding_review": metrics["banding_score"] > 0.0,
    }
    return {"metrics": metrics, "flags": flags}


def colour_match(
    prev_frames: Sequence[np.ndarray],
    cur_frames: Sequence[np.ndarray],
    policy: str,
    prev_group: str,
    cur_group: str,
    *,
    prev_exclusion_masks: Sequence[np.ndarray] | None = None,
    cur_exclusion_masks: Sequence[np.ndarray] | None = None,
    transition_reason: str | None = None,
    expected_warmth_direction: str | None = None,
    limits: QCLimits = QCLimits(),
) -> tuple[str | None, dict[str, Any]]:
    """Return (FFmpeg filter or None, structured boundary report).

    expected_warmth_direction is None, "warmer", or "cooler".  The policy is
    never inferred or changed from image statistics.
    """
    if policy not in POLICIES:
        raise ValueError(f"unknown colour policy: {policy!r}")
    if expected_warmth_direction not in (None, "warmer", "cooler"):
        raise ValueError("expected_warmth_direction must be warmer/cooler/None")

    pf, cf = _five(prev_frames, "prev"), _five(cur_frames, "cur")
    pm = _masks(prev_exclusion_masks, pf, "prev")
    cm = _masks(cur_exclusion_masks, cf, "cur")
    p, c = _window_stats(pf, pm), _window_stats(cf, cm)
    d_y, d_w = abs(p["Y"] - c["Y"]), abs(p["warmth"] - c["warmth"])
    warmth_delta = c["warmth"] - p["warmth"]
    qc = _qc_metrics(p, c, limits)
    report: dict[str, Any] = {
        "policy": policy,
        "prev_group": prev_group,
        "cur_group": cur_group,
        "dY": float(d_y),
        "d_warmth": float(d_w),
        "warmth_delta": float(warmth_delta),
        "raw_prev": {"Y": p["Y"], "warmth": p["warmth"], "bgr": p["bgr"].tolist()},
        "raw_cur": {"Y": c["Y"], "warmth": c["warmth"], "bgr": c["bgr"].tolist()},
        "applied_gains_bgr": [1.0, 1.0, 1.0],
        "warnings": [],
        "qc": qc,
    }

    if expected_warmth_direction is None:
        reversed_direction = False
    elif expected_warmth_direction == "warmer":
        reversed_direction = warmth_delta <= 0.0
    else:
        reversed_direction = warmth_delta >= 0.0
    qc["metrics"]["expected_warmth_direction"] = expected_warmth_direction
    qc["flags"]["warmth_direction_reversed"] = reversed_direction

    if policy == "intentional_transition":
        if not transition_reason or not transition_reason.strip():
            raise ValueError("intentional_transition requires transition_reason")
        report["transition_reason"] = transition_reason.strip()
        # No colour-temperature matching, regardless of delta magnitude.
        return None, report

    if policy == "hard_reset":
        return None, report

    # continuous
    if prev_group != cur_group:
        report["warnings"].append("CONTINUOUS_GROUP_MISMATCH: colour match suppressed")
        report["qc"]["flags"]["group_mismatch"] = True
        return None, report
    report["qc"]["flags"]["group_mismatch"] = False

    if d_y <= GATE_DY and d_w <= GATE_DW:
        report["warnings"].append("WITHIN_GATE: no colour filter required")
        return None, report

    raw = p["bgr"] / np.maximum(c["bgr"], 1e-6)
    tempered = 1.0 + (raw - 1.0) * TEMPER
    gain = clamp_per_channel(tempered, 0.85, 1.18)
    report["raw_gains_bgr"] = raw.tolist()
    report["tempered_gains_bgr"] = tempered.tolist()
    report["applied_gains_bgr"] = gain
    b, g, r = gain
    filt = f"colorchannelmixer=rr={r:.8f}:gg={g:.8f}:bb={b:.8f}"
    return filt, report


def measure_gain_distribution(
    boundaries: Iterable[dict[str, Any]], *, temper: float = TEMPER
) -> dict[str, Any]:
    """Measure approved continuous boundaries for later rail calibration.

    Each dict contains prev_frames, cur_frames and optionally
    prev_exclusion_masks/cur_exclusion_masks. No clamping is applied.
    """
    rows: list[np.ndarray] = []
    for i, item in enumerate(boundaries):
        pf, cf = _five(item["prev_frames"], "prev"), _five(item["cur_frames"], "cur")
        pm = _masks(item.get("prev_exclusion_masks"), pf, "prev")
        cm = _masks(item.get("cur_exclusion_masks"), cf, "cur")
        p, c = _window_stats(pf, pm), _window_stats(cf, cm)
        raw = p["bgr"] / np.maximum(c["bgr"], 1e-6)
        gain = 1.0 + (raw - 1.0) * temper
        if not np.all(np.isfinite(gain)):
            raise ValueError(f"boundary {i}: non-finite gain")
        rows.append(gain)
    if not rows:
        raise ValueError("no boundaries supplied")
    a = np.stack(rows)
    median = np.median(a, axis=0)
    mad = np.median(np.abs(a - median), axis=0)
    lo, hi = median - 3.0 * mad, median + 3.0 * mad
    return {
        "count": int(a.shape[0]),
        "order": ["B", "G", "R"],
        "gains": a.tolist(),
        "median": median.tolist(),
        "mad": mad.tolist(),
        "suggested_median_minus_3mad": lo.tolist(),
        "suggested_median_plus_3mad": hi.tolist(),
        "p005": np.quantile(a, 0.005, axis=0).tolist(),
        "p995": np.quantile(a, 0.995, axis=0).tolist(),
    }
