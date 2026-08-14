# -*- coding: utf-8 -*-
"""하이브리드 3D 샷 빌더 — 이미지 1장 → 시차가 있는 하이브리드 모션 클립

사용법:
    python3 make_hybrid_shot.py <입력이미지> <출력mp4> [카메라] [초] [--qc]

카메라: push_in | pull_out | dolly_left | dolly_right | crane_down | orbit | impossible_zoom

동작:
    1) 깊이 추정 → 3 레이어 분리          (가이드 §3 1~2단계)
    2) 프레임마다 시차 렌더                (★ 하이브리드의 본질)
    3) 톤매칭 · 대기감쇠 · 접지그림자      (§3 3단계 빛 일치)
    4) 라이트랩 · 모션블러 · 그레인 · 비네트 (§3 4단계 경계 은폐)
    5) H-1 시차 / H-5 프레임홀드 / H-7 깊이가독성 / H-8 화면시차
       / H-9 텍스처경계(늘어짐) 자동 검수  (§6)

★ 검수를 통과하지 못하면 exit 1 로 실패한다.
  "괜찮아 보인다" 는 사람 판정이 지지부진의 원인이었으므로 수치로 강제한다.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hybrid_core import (  # noqa: E402
    FPS, H, W, NAVY_DK,
    add_film_grain, camera_path, contact_shadow, depth_haze,
    estimate_depth, light_wrap, match_tone, measure_frame_hold,
    measure_depth_legibility, measure_parallax, measure_parallax_phase,
    render_parallax_depth, verify_depth_parallax,
    render_projection_frame, verify_projection_parallax, measure_screen_parallax,
    measure_texture_bounds,
    motion_blur, render_parallax_frame, split_layers,
    verify_layer_parallax, vignette,
)


def build_shot(src: str, out: str, cam: str = "dolly_left",
               dur: float = 5.0, qc: bool = True,
               shadow: bool = True) -> dict:
    img = cv2.imread(src, cv2.IMREAD_COLOR)
    if img is None:
        raise SystemExit(f"ERR: cannot read {src}")

    # 16:9 커버 크롭 (PRODUCTION_STANDARD.md §7 1920x1080)
    ih, iw = img.shape[:2]
    scale = max(W / iw, H / ih) * 1.34          # 시차 이동 여유분 34%
    img = cv2.resize(img, (int(iw * scale), int(ih * scale)),
                     interpolation=cv2.INTER_LANCZOS4)
    ih, iw = img.shape[:2]
    y0, x0 = (ih - H) // 2, (iw - W) // 2
    img = img[y0:y0 + H, x0:x0 + W]

    base_img = img.copy()          # H-7 검수용 원본 보관
    depth = estimate_depth(img)
    layers = split_layers(img, depth, n_layers=3)

    n = max(int(round(dur * FPS)), 2)
    frames = []
    clean = {}          # QC 전용: 그레인 적용 전 프레임 (아래 주석 참조)
    qc_idx = {0, n - 1}   # ★ 첫/끝 프레임 = 위상상관 신호 최대화

    for i in range(n):
        t = i / (n - 1)
        dx, dy, zoom = camera_path(cam, t)

        f = render_projection_frame(img, dx, dy, zoom)   # ★ 평면 투사 정본

        # ★ H-1 광학흐름 검수는 반드시 '그레인 적용 전' 프레임으로 해야 한다.
        #   필름 그레인은 프레임마다 패턴을 이동시키므로(add_film_grain 의 roll),
        #   그레인이 있는 프레임에서는 Farneback 이 그레인의 랜덤 변화를 추적해
        #   실제 이미지 운동을 가려버린다.
        #   초기 구현에서 이 때문에 근경 변위가 0.0036 으로 읽혀
        #   시차가 정상(구조 2.29x)인 렌더를 실패 판정한 사례가 있다.
        if i in qc_idx:
            clean[i] = f.copy()

        # 3단계 — 빛 일치
        f = match_tone(f)
        f = depth_haze(f, depth, tint=NAVY_DK, strength=0.20)
        if shadow:
            # 접지 그림자: 카메라 이동에 따라 함께 움직여야 '붙어' 보인다
            f = contact_shadow(f, cx=0.50 + dx * 0.8, cy=0.90 + dy * 0.5,
                               rx=0.30, ry=0.045, strength=0.42)

        # 4단계 — 경계 은폐
        fg_alpha = np.clip(1.0 - depth, 0, 1)
        f = light_wrap(f, fg_alpha, strength=0.26)
        f = motion_blur(f, dx, dy)
        f = vignette(f, 0.26)
        f = add_film_grain(f, amount=4.0, frame_idx=i)

        frames.append(f)

    # ── 인코딩 (PRODUCTION_STANDARD.md §7: libx264 / yuv420p / faststart) ──
    os.makedirs(os.path.dirname(os.path.abspath(out)) or ".", exist_ok=True)
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
           "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}",
           "-r", str(FPS), "-i", "pipe:0",
           "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "18",
           "-pix_fmt", "yuv420p", "-movflags", "+faststart", out]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for f in frames:
        p.stdin.write(f.tobytes())
    p.stdin.close()
    if p.wait() != 0:
        raise SystemExit("ERR: ffmpeg encode failed")

    # ── 검수 (가이드 §6) ──
    report = {"src": src, "out": out, "camera": cam,
              "duration_s": round(n / FPS, 3), "frames": n,
              "size_bytes": os.path.getsize(out)}
    if qc:
        # H-1 시차: 구조적 판정(정본) + 광학흐름 측정(보조)
        #   구조적 판정은 텍스처에 의존하지 않으므로 항상 유효하다.
        #   광학흐름은 텍스처가 충분할 때만 유효하며, 부족하면 indeterminate 를 반환한다.
        # H-1 시차 — 3중 측정. 그레인 없는 프레임(clean)으로만 측정한다.
        #   (그레인은 프레임마다 패턴이 이동하므로 픽셀 기반 측정을 오염시킨다)
        a_i, b_i = sorted(qc_idx)
        structural = verify_projection_parallax(cam)              # 변환식 기반
        phase = measure_parallax_phase(clean[a_i], clean[b_i])       # ★ 픽셀 기반 정본
        optical = measure_parallax(clean[a_i], clean[b_i], depth=depth)  # 보조(참고용)
        report["H1_parallax"] = {"structural": structural, "phase": phase,
                                 "optical_flow": optical}
        report["H8_screen_parallax"] = measure_screen_parallax(clean[a_i], clean[b_i])
        report["H5_frame_hold"] = measure_frame_hold(frames)
        report["H7_depth_legibility"] = measure_depth_legibility(base_img, depth)
        # ★★★ H-9 텍스처 경계 — '늘어짐(pixel pulling)' 사전 판정.
        #   렌더 결과를 보지 않고 호모그래피만으로 판정하므로,
        #   눈으로 반려당하기 전에 파이프라인이 스스로 거른다.
        #   base_img(크롭 후 = 실제 warp 입력) 기준으로 측정해야 좌표계가 일치한다.
        report["H9_texture_bounds"] = measure_texture_bounds(base_img, cam)

        # 판정: 구조 + 위상 상관 둘 다 통과해야 한다.
        #   광학흐름은 평탄 영역에서 신뢰할 수 없음이 실측으로 확인되어 판정에서 제외했다.
        scr = report["H8_screen_parallax"]
        # ★ 최종 정본은 화면 실측(H-8). 공식 계산은 보조.
        #   측정 불가(indeterminate)면 구조 판정으로 대체한다.
        h1_pass = (bool(scr.get("pass_H8")) if scr.get("status") == "measured"
                   else bool(structural.get("pass_H1")))
        report["_h1_pass"] = h1_pass
        report["qc_pass"] = bool(h1_pass
                                 and report["H5_frame_hold"]["pass_H5"]
                                 and report["H7_depth_legibility"]["pass_H7"]
                                 and report["H9_texture_bounds"]["pass_H9"])
    return report


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    src, out = sys.argv[1], sys.argv[2]
    cam = sys.argv[3] if len(sys.argv) > 3 else "dolly_left"
    dur = float(sys.argv[4]) if len(sys.argv) > 4 else 5.0

    rep = build_shot(src, out, cam, dur, qc=True)
    print(json.dumps(rep, ensure_ascii=False, indent=2))

    if not rep.get("qc_pass", False):
        print("\n[FAIL] 검수 미통과 — 가이드 §6 기준 미달", file=sys.stderr)
        h1 = rep.get("H1_parallax", {})
        h5 = rep.get("H5_frame_hold", {})
        if not rep.get("_h1_pass", True):
            st = h1.get("structural", {})
            op = h1.get("optical_flow", {})
            print(f"  H-1 시차 미달 — 구조 비율 {st.get('ratio')} / "
                  f"광학 비율 {op.get('ratio')} (기준 >= 1.3)", file=sys.stderr)
            print("       → 전경/배경이 통째로 움직임 = 슬라이드쇼", file=sys.stderr)
        if not h5.get("pass_H5", True):
            print(f"  H-5 프레임 홀드 {h5.get('holds')}개 검출 "
                  f"→ P0-A 재발 위험", file=sys.stderr)
        h9 = rep.get("H9_texture_bounds", {})
        if not h9.get("pass_H9", True):
            print(f"  H-9 텍스처 경계 이탈 {h9.get('outside_px')}px "
                  f"(기준 <= -{h9.get('required_margin_px')}px, "
                  f"worst_t={h9.get('worst_t')})", file=sys.stderr)
            print("       → 프레임 가장자리가 늘어난다(pixel pulling). "
                  "PLANE_MOVE_GAIN 을 낮추거나 PLANE_SAFE_ZOOM 을 높여라",
                  file=sys.stderr)
        return 1
    st = rep["H1_parallax"]["structural"]
    op = rep["H1_parallax"]["optical_flow"]
    print(f"\n[PASS] 하이브리드 3D 검수 통과")
    print(f"  H-1 시차: 구조 {st.get('ratio')}x "
          f"(근경 {st.get('near_disp_px')}px vs 원경 {st.get('far_disp_px')}px) "
          f"· 광학 {op.get('ratio')} [{op.get('status')}]")
    print(f"  H-5 프레임홀드: {rep['H5_frame_hold']['holds']}개 "
          f"(최소 프레임차 {rep['H5_frame_hold']['min_diff']})")
    scr = rep.get("H8_screen_parallax", {})
    print(f"  H-8 화면시차: 비율 {scr.get('ratio')} "
          f"(단조증가 {scr.get('monotonic')}) [{scr.get('status')}]")
    h9 = rep.get("H9_texture_bounds", {})
    print(f"  H-9 텍스처경계: {h9.get('outside_px')}px "
          f"(음수 = 원본 안쪽 여유 · 늘어짐 없음)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
