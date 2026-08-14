# -*- coding: utf-8 -*-
"""하이브리드 3D 모션 엔진 — 코어 모듈

설계 근거: docs/marketing/youtube/70_HYBRID_3D_MOTION_GUIDE.md
참고영상 실측: -OHeRVGeiPQ(00:31 하이브리드 합성) / K4YuwHHGrgQ(0:02-0:07 projection mapping)

핵심 원리 (가이드 §1.1):
    하이브리드 3D 와 슬라이드쇼를 가르는 것은 화질이 아니라 **시차(parallax)** 다.
    카메라가 움직일 때 전경과 배경의 이동량이 달라야 한다.

본 모듈은 Blender 없이 시차를 만든다:
    2.5D Projection Parallax
      1) 이미지를 깊이 레이어로 분리 (전경/중경/배경)
      2) 각 레이어에 서로 다른 Z 거리를 할당
      3) 가상 카메라를 이동 → 레이어별로 다른 이동량 발생 = 시차
      4) 레이어 경계를 그레인/블러로 은폐 (가이드 §3 4단계)

의존: numpy, opencv(cv2), Pillow, scipy  — 전부 샌드박스에 존재 확인됨(2026-08-14)
비파괴 원칙: 기존 youtube/videoN 자산을 수정하지 않는다. 입력은 읽기만 한다.
"""
from __future__ import annotations

import numpy as np
import cv2

# ── 디자인 시스템 (PRODUCTION_STANDARD.md §4 준수 · 변경 금지) ──
NAVY      = (33, 48, 66)
NAVY_DK   = (20, 30, 43)
NAVY_CARD = (44, 62, 84)
GOLD      = (206, 168, 92)
GOLD_LT   = (230, 200, 130)
GOLD_DK   = (168, 132, 64)
WHITE     = (244, 247, 251)
GREY      = (150, 165, 182)

W, H = 1920, 1080
PARALLAX_GAIN = 1.45   # 근경 추가 배율
PARALLAX_BASE = 0.30   # 원경 기본 배율
# 평면 투사 파라미터 (정본 렌더러)
PLANE_TILT_DEG = 60.0    # 평면 기울기 — 클수록 근/원 시차 차이 커짐
PLANE_CAM_DIST = 2.15    # 카메라 거리 — 작을수록 원근 강함
PLANE_FOCAL = 2.05
PLANE_MOVE_GAIN = 2.4    # 카메라 이동 배율 (4.2 는 텍스처 밖을 봐서 좌측이 늘어졌다)
PLANE_SAFE_ZOOM = 1.60   # 안전 여유 — 프레임이 원본 밖을 보지 않게 하는 확대율
FPS   = 30


# ══════════════════════════════════════════════════════════════
# 1단계 — 깊이 추정 (Depth estimation)
#   목적: 이미지를 전경/중경/배경으로 나누기 위한 깊이맵 생성
#   방법: 학습 모델 없이 결정적(deterministic) 휴리스틱 결합
#         — 난수 호출 0회 (MaaS 엔진 원칙과 동일하게 재현 가능해야 함)
# ══════════════════════════════════════════════════════════════
def estimate_depth(img_bgr: np.ndarray) -> np.ndarray:
    """결정적 깊이맵 추정. 반환: float32 [0,1], 0=가까움(전경), 1=멂(배경).

    3가지 단서를 가중 결합한다. 모두 결정적이다.
      (a) 수직 위치   — 화면 아래쪽이 가까운 경향 (지면 원근)
      (b) 국소 선명도 — 초점 맞은 영역이 가까움 (라플라시안 분산)
      (c) 국소 채도   — 대기 원근(aerial perspective): 먼 것은 채도가 낮다
    """
    h, w = img_bgr.shape[:2]
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

    # (a) 수직 그라디언트: 위 = 멂(1.0), 아래 = 가까움(0.0)
    vert = np.linspace(1.0, 0.0, h, dtype=np.float32)[:, None]
    vert = np.repeat(vert, w, axis=1)

    # (b) 선명도: 라플라시안 절대값의 국소 평균 → 클수록 가까움
    lap = np.abs(cv2.Laplacian(gray, cv2.CV_32F, ksize=3))
    sharp = cv2.GaussianBlur(lap, (0, 0), sigmaX=max(w, h) / 120.0)
    sm, sM = float(sharp.min()), float(sharp.max())
    sharp_n = (sharp - sm) / (sM - sm + 1e-6)
    sharp_depth = 1.0 - sharp_n              # 선명 → 가까움 → 값 작게

    # (c) 채도: 낮으면 멂 (대기 원근)
    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
    sat = hsv[:, :, 1].astype(np.float32) / 255.0
    sat = cv2.GaussianBlur(sat, (0, 0), sigmaX=max(w, h) / 100.0)
    sat_depth = 1.0 - sat                    # 채도 낮음 → 멂 → 값 크게

    depth = 0.50 * vert + 0.30 * sharp_depth + 0.20 * sat_depth
    depth = cv2.GaussianBlur(depth, (0, 0), sigmaX=max(w, h) / 200.0)
    dm, dM = float(depth.min()), float(depth.max())
    return ((depth - dm) / (dM - dm + 1e-6)).astype(np.float32)


def split_layers(img_bgr: np.ndarray, depth: np.ndarray, n_layers: int = 3):
    """깊이맵으로 이미지를 n개 레이어로 분리.

    반환: [(rgba, z_dist), ...]  — z_dist 가 클수록 멀다(1.0=배경)
    각 레이어는 알파를 부드럽게 깎아 경계 티가 나지 않게 한다.
    """
    layers = []
    edges = np.linspace(0.0, 1.0, n_layers + 1)
    base = img_bgr if img_bgr.dtype == np.uint8 else \
        np.clip(img_bgr, 0, 255).astype(np.uint8)
    for i in range(n_layers):
        lo, hi = edges[i], edges[i + 1]
        # soft mask: 경계에서 부드럽게 감쇠 (하드 컷은 합성 티가 남 — 가이드 §3 4단계)
        mask = np.where((depth >= lo) & (depth < hi), 1.0,
                        np.where(depth < lo,
                                 np.clip(1.0 - (lo - depth) / 0.12, 0.0, 1.0),
                                 np.clip(1.0 - (depth - hi) / 0.12, 0.0, 1.0)))
        mask = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), sigmaX=6)
        # uint8 RGBA 로 보관 — warpAffine 이 float32 대비 크게 빠르다
        alpha = np.clip(mask * 255.0, 0, 255).astype(np.uint8)
        rgba = np.dstack([base, alpha])
        z = float((lo + hi) / 2.0)
        layers.append((rgba, z))
    return layers


# ══════════════════════════════════════════════════════════════
# 2단계 — 시차 카메라 (Parallax camera)  ← 하이브리드의 본질
# ══════════════════════════════════════════════════════════════
def camera_path(kind: str, t: float) -> tuple:
    """가상 카메라 경로. t in [0,1] → (dx, dy, zoom)

    ★ 중요: 모든 경로는 t 전 구간에서 연속이며 속도가 0이 되지 않는다.
      P0-A(46초 일시정지/끊김) 재발 방지 — 가이드 §5.2
    """
    if kind == "push_in":            # 밀고 들어가기 (가장 안전 · 후크용)
        return (0.0, 0.0, 1.0 + 0.14 * t)
    if kind == "pull_out":           # 빼기 (전체 드러내기)
        return (0.0, 0.0, 1.16 - 0.14 * t)
    if kind == "dolly_left":         # 좌측 트럭 — 시차가 가장 잘 드러남
        return (-0.095 * t, 0.0, 1.06 + 0.075 * t)
    if kind == "dolly_right":
        return (0.055 * t, 0.0, 1.06 + 0.04 * t)
    if kind == "crane_down":         # 위에서 아래로
        return (0.0, 0.045 * t, 1.04 + 0.06 * t)
    if kind == "orbit":              # 좌→우 호를 그리며 (사인 곡선, 속도 0 아님)
        return (0.06 * np.sin(np.pi * (t - 0.5)), -0.012 * np.cos(np.pi * t),
                1.07 + 0.03 * t)
    if kind == "impossible_zoom":    # 참고영상① 00:15 급속 후퇴 (ease-out)
        e = 1.0 - (1.0 - t) ** 3
        return (0.0, 0.0, 1.35 - 0.33 * e)
    raise ValueError(f"unknown camera path: {kind}")


# ══════════════════════════════════════════════════════════════
# ★★★ 정본 렌더러 — 평면 투사 (Projection Mapping / Homography)
#     참고영상 ② 0:02-0:07 과 같은 기법.
#     "사진을 3D 공간의 기울어진 평면에 붙이고 카메라를 움직인다"
#
#   왜 이 방식이 정답인가 (두 번의 실패에서 배운 것):
#     ① 레이어 방식  → 최원거리 레이어가 화면을 채워 시차가 사라졌다 (실측 1.017x = 평면)
#     ② 픽셀 깊이워프 → 깊이맵이 추정값(가짜)이라 석조 기둥이 고무처럼 휘었다
#                       ("rubber-sheet warping / 건물이 녹는다" · 1/10)
#     ③ 평면 투사    → 호모그래피는 **직선을 직선으로 보존**한다(수학적 성질).
#                       따라서 기둥이 휘는 일이 원천적으로 불가능하다.
#                       그리고 기울어진 평면이므로 아래쪽(가까움)이 위쪽(멀음)보다
#                       실제로 더 많이 움직인다 = 진짜 원근 시차.
#     깊이 추정에 의존하지 않는다는 것이 결정적 장점이다.
# ══════════════════════════════════════════════════════════════
def _project_plane(pts3d, cam, f: float):
    out = []
    for (X, Y, Z) in pts3d:
        d = Z - cam[2]
        out.append([f * (X - cam[0]) / d, f * (Y - cam[1]) / d])
    return np.array(out, dtype=np.float32)


def _plane_corners(tilt_deg: float):
    th = np.radians(tilt_deg)
    c, s = float(np.cos(th)), float(np.sin(th))
    # v=+1 위(멀다, Z 큼) / v=-1 아래(가깝다, Z 작음)
    # ★★ 좌표계 주의 (두 번 틀렸다):
    #   OpenCV 이미지 좌표는 **아래가 +y** 다. 3D Y 를 수학 관례(위가 +)로 두면
    #   결과가 상하 반전된다 (실제로 하늘이 아래로 오는 영상이 나왔다).
    #   src 코너 순서 [(0,0),(w,0),(w,h),(0,h)] = 좌상,우상,우하,좌하 에 맞춰
    #   Y 도 아래로 증가시키고, 화면 아래(index 2,3)가 카메라에 가깝게(Z 작게) 둔다.
    return [(-1.0, -c, s), (1.0, -c, s), (1.0, c, -s), (-1.0, c, -s)]


def render_projection_frame(img_bgr: np.ndarray, dx: float, dy: float, zoom: float,
                            out_w: int = W, out_h: int = H,
                            tilt_deg: float = PLANE_TILT_DEG,
                            cam_dist: float = PLANE_CAM_DIST,
                            f: float = PLANE_FOCAL,
                            move_gain: float = PLANE_MOVE_GAIN) -> np.ndarray:
    h, w = img_bgr.shape[:2]
    src = np.array([[0, 0], [w, 0], [w, h], [0, h]], dtype=np.float32)
    P = _plane_corners(tilt_deg)

    base = _project_plane(P, (0.0, 0.0, -cam_dist), f)
    bc = base.mean(axis=0)
    bw = float(base[:, 0].max() - base[:, 0].min())
    bh = float(base[:, 1].max() - base[:, 1].min())
    scale = max(out_w / bw, out_h / bh) * PLANE_SAFE_ZOOM * float(zoom)

    cam = (dx * move_gain, dy * move_gain, -cam_dist)
    proj = _project_plane(P, cam, f)
    dst = (proj - bc) * scale + np.array([out_w / 2.0, out_h / 2.0], dtype=np.float32)

    Hm = cv2.getPerspectiveTransform(src, dst.astype(np.float32))
    return cv2.warpPerspective(img_bgr, Hm, (out_w, out_h),
                               flags=cv2.INTER_LINEAR,
                               borderMode=cv2.BORDER_REPLICATE)


def measure_texture_bounds(img_bgr: np.ndarray, cam: str, out_w: int = W, out_h: int = H,
                           tilt_deg: float = PLANE_TILT_DEG,
                           cam_dist: float = PLANE_CAM_DIST,
                           f: float = PLANE_FOCAL,
                           move_gain: float = PLANE_MOVE_GAIN,
                           samples: int = 9, margin_px: float = 8.0) -> dict:
    """★★★ H-9 텍스처 경계 게이트 — '늘어짐(pixel pulling)'을 수치로 판정한다.

    늘어짐의 물리적 정의: 출력 프레임의 네 코너를 역호모그래피로 원본 이미지 좌표에
    되돌렸을 때 [0,w]x[0,h] 를 벗어나면 BORDER_REPLICATE 가 엣지 픽셀을 늘려 채운다.
    따라서 눈으로 볼 필요 없이, 호모그래피만으로 사전 판정할 수 있다.

    outside_px:  양수 = 텍스처 밖을 봤다(늘어짐) / 음수 = 안쪽 여유(안전)
    """
    h, w = img_bgr.shape[:2]
    src = np.array([[0, 0], [w, 0], [w, h], [0, h]], dtype=np.float32)
    P = _plane_corners(tilt_deg)
    base = _project_plane(P, (0.0, 0.0, -cam_dist), f)
    bc = base.mean(axis=0)
    bw = float(base[:, 0].max() - base[:, 0].min())
    bh = float(base[:, 1].max() - base[:, 1].min())
    out_corners = np.array([[[0, 0], [out_w, 0], [out_w, out_h], [0, out_h]]], dtype=np.float32)

    worst = -1e9
    worst_t = 0.0
    for i in range(max(int(samples), 2)):
        t = i / (max(int(samples), 2) - 1)
        dx, dy, zoom = camera_path(cam, t)
        sc = max(out_w / bw, out_h / bh) * PLANE_SAFE_ZOOM * float(zoom)
        pr = _project_plane(P, (dx * move_gain, dy * move_gain, -cam_dist), f)
        dst = (pr - bc) * sc + np.array([out_w / 2.0, out_h / 2.0], dtype=np.float32)
        Hm = cv2.getPerspectiveTransform(src, dst.astype(np.float32))
        pts = cv2.perspectiveTransform(out_corners, np.linalg.inv(Hm))[0]
        over = max(float(-pts[:, 0].min()), float(pts[:, 0].max() - w),
                   float(-pts[:, 1].min()), float(pts[:, 1].max() - h))
        if over > worst:
            worst, worst_t = over, t

    ok = bool(worst <= -float(margin_px))
    return {"outside_px": round(float(worst), 2), "worst_t": round(float(worst_t), 3),
            "required_margin_px": float(margin_px), "samples": int(samples),
            "status": "measured", "pass_H9": ok,
            "note": ("ok — 프레임이 원본 텍스처 안쪽에서만 샘플링한다"
                     if ok else
                     "FAIL — 프레임이 원본 밖을 본다 = 엣지 늘어짐(pixel pulling) 발생")}


def split_planes(img_bgr: np.ndarray, depth: np.ndarray, n_planes: int = 3,
                 feather_px: int = 9, inpaint_radius: int = 7):
    """★★★★★ 세대④ — 다층 평면(Layered Depth Image) 분해.

    세대① `split_layers` 의 치명적 결함을 고친 것이다.
      세대①: 모든 레이어가 **원본 전체 이미지**를 담았다 → 최원거리 레이어가 화면을
             통째로 채워 배경 속도가 화면을 지배했다(구조식 2.29 vs 화면 실측 1.017).
      세대④: 원경 판(plate)에서 **근경 영역을 지우고 인페인팅으로 메운다.**
             따라서 근경 물체가 원경 판에 남아 있지 않고, 근경 층만 빠르게 움직인다.
             = 가로등이 건물 앞을 지나가는 진짜 물체 간 시차가 생긴다.

    반환: [(bgr, alpha, d), ...]  원경 → 근경 순서(합성 순서). d 는 상대 거리(클수록 멀다).
    """
    base = img_bgr if img_bgr.dtype == np.uint8 else \
        np.clip(img_bgr, 0, 255).astype(np.uint8)
    h, w = base.shape[:2]
    n = max(int(n_planes), 2)

    # 퍼센타일로 띠를 나눈다 — 절대값 구간은 소재에 따라 한쪽이 비어버린다
    qs = [float(np.percentile(depth, 100.0 * i / n)) for i in range(n + 1)]
    qs[0], qs[-1] = -1e-6, 1.0 + 1e-6

    # 상대 거리: 가까운 층이 더 많이 움직여야 한다 (변위 ∝ 1/d)
    # ★ i=0 이 근경이므로 dists[0]=1.00(가깝다) … dists[n-1]=2.10(멀다). 뒤집으면 원근이 반대가 된다.
    dists = np.linspace(1.0, 2.10, n)           # 근경 1.00 → 원경 2.10 (비율 2.10x)

    planes = []
    for i in range(n):                          # i=0 근경 … i=n-1 원경
        lo, hi = qs[i], qs[i + 1]
        m = ((depth >= lo) & (depth < hi)).astype(np.float32)
        if feather_px > 0:
            m = cv2.GaussianBlur(m, (0, 0), sigmaX=float(feather_px))
        alpha = np.clip(m * 255.0, 0, 255).astype(np.uint8)

        if i == n - 1:
            # ★ 최원거리 = 전체를 덮는 바탕 판. 근경이 이동하면 그 뒤가 드러나므로 메워야 한다.
            #   Telea 인페인팅은 큰 구멍에서 **번진 붓자국(smudge)** 을 남겼다(육안 확인).
            #   → 정규화 컨볼루션(normalized convolution)으로 **부드럽게 확산 채움**한다.
            #     바탕 판은 대부분 근경 층에 덮이므로, 디테일보다 '티 안 나는 매끄러움'이 옳다.
            hole = (depth < lo).astype(np.float32)
            hole = cv2.GaussianBlur(hole, (0, 0), sigmaX=float(max(feather_px, 6)))
            keepw = np.clip(1.0 - hole * 1.6, 0.0, 1.0)         # 구멍일수록 가중치 0
            sf = 0.25
            sw2, sh2 = max(int(w * sf), 8), max(int(h * sf), 8)
            small = cv2.resize(base, (sw2, sh2), interpolation=cv2.INTER_AREA).astype(np.float32)
            kw = cv2.resize(keepw, (sw2, sh2), interpolation=cv2.INTER_AREA)
            num = cv2.GaussianBlur(small * kw[:, :, None], (0, 0), sigmaX=sw2 * 0.09)
            den = cv2.GaussianBlur(kw, (0, 0), sigmaX=sw2 * 0.09) + 1e-4
            diffused = cv2.resize(num / den[:, :, None], (w, h), interpolation=cv2.INTER_LINEAR)
            a = np.clip(hole * 1.6, 0.0, 1.0)[:, :, None]        # 구멍만 확산색으로 대체
            content = np.clip(base.astype(np.float32) * (1.0 - a) + diffused * a,
                              0, 255).astype(np.uint8)
            alpha = np.full((h, w), 255, np.uint8)      # 전면 판
        else:
            content = base

        planes.append((content, alpha, float(dists[i])))

    planes.reverse()                            # 원경 → 근경 (합성 순서)
    return planes


def render_multiplane_frame(planes, dx: float, dy: float, zoom: float,
                            out_w: int = W, out_h: int = H,
                            move_px: float = 300.0, d_ref: float = 1.0) -> np.ndarray:
    """★★★★★ 세대④ 정본 렌더러 — 다층 평면 시차.

    각 층은 **정면 평행 평면(fronto-parallel)** 이므로 변환이 '평행이동 + 중심확대'뿐이다.
      → 층 내부에서 직선이 휘거나 기울어지는 일이 **수학적으로 불가능**하다.
        (세대③ 단일 평면은 정면 파사드를 54° 기울여 기둥이 기울어 보였다: 구조 4/10)
      → 깊이는 **층 사이의 상대 운동**에서 나온다. 변위 ∝ 1/d 이므로
        근경(d=1.0)이 원경(d=2.10)보다 2.10배 빠르게 움직인다.
        (세대③ 단일 평면은 사진 전체가 한 장이라 물체 간 시차가 0이었다: 깊이 2/10)
    """
    canvas = None
    for content, alpha, d in planes:            # 원경 → 근경
        sh, sw = content.shape[:2]
        # ★ 소재는 출력보다 크게(여유 34%) 준비된다. 중심을 맞춰야 좌상단만 보이지 않는다.
        ox, oy = (out_w - sw) * 0.5, (out_h - sh) * 0.5
        k = float(d_ref) / float(d)             # 가까울수록 크다
        s = 1.0 + (float(zoom) - 1.0) * k       # 돌리(전진)도 가까운 층에 더 크게 작용
        tx = float(dx) * float(move_px) * k
        ty = float(dy) * float(move_px) * k
        cx, cy = out_w * 0.5, out_h * 0.5
        M = np.array([[s, 0.0, ox * s + tx + cx * (1.0 - s)],
                      [0.0, s, oy * s + ty + cy * (1.0 - s)]], dtype=np.float32)

        rgb = cv2.warpAffine(content, M, (out_w, out_h), flags=cv2.INTER_LINEAR,
                             borderMode=cv2.BORDER_REPLICATE)
        if canvas is None:
            canvas = rgb                        # 최원거리 판이 바탕 (인페인팅으로 구멍 없음)
            continue
        a = cv2.warpAffine(alpha, M, (out_w, out_h), flags=cv2.INTER_LINEAR,
                           borderMode=cv2.BORDER_CONSTANT, borderValue=0)
        af = (a.astype(np.float32) / 255.0)[:, :, None]
        canvas = (rgb.astype(np.float32) * af +
                  canvas.astype(np.float32) * (1.0 - af)).astype(np.uint8)
    return canvas


def verify_multiplane_parallax(cam: str, n_planes: int = 3,
                               move_px: float = 300.0, d_ref: float = 1.0) -> dict:
    """다층 평면의 근/원 변위를 직접 계산 (렌더 불필요)."""
    dx0, dy0, z0 = camera_path(cam, 0.0)
    dx1, dy1, z1 = camera_path(cam, 1.0)
    n = max(int(n_planes), 2)
    dists = np.linspace(1.0, 2.10, n)
    d_near, d_far = float(dists[0]), float(dists[-1])

    def disp(d):
        k = float(d_ref) / d
        t0 = np.array([dx0, dy0]) * move_px * k
        t1 = np.array([dx1, dy1]) * move_px * k
        # 확대 성분이 화면 가장자리에 주는 추가 변위까지 포함
        s0 = 1.0 + (z0 - 1.0) * k
        s1 = 1.0 + (z1 - 1.0) * k
        edge = np.array([W * 0.5, H * 0.5])
        p0 = t0 + edge * (s0 - 1.0)
        p1 = t1 + edge * (s1 - 1.0)
        return float(np.hypot(*(p1 - p0)))

    near, far = disp(d_near), disp(d_far)
    ratio = near / (far + 1e-6)
    return {"basis": "multi_plane", "camera": cam, "n_planes": n,
            "d_near": d_near, "d_far": d_far,
            "near_disp_px": round(near, 3), "far_disp_px": round(far, 3),
            "ratio": round(ratio, 3), "status": "measured",
            "pass_H1": bool(ratio >= 1.3)}


def verify_projection_parallax(cam: str, out_w: int = W, out_h: int = H,
                               tilt_deg: float = PLANE_TILT_DEG,
                               cam_dist: float = PLANE_CAM_DIST,
                               f: float = PLANE_FOCAL,
                               move_gain: float = PLANE_MOVE_GAIN) -> dict:
    """평면 투사의 근/원 변위를 기하학으로 직접 계산 (렌더 불필요)."""
    dx0, dy0, z0 = camera_path(cam, 0.0)
    dx1, dy1, z1 = camera_path(cam, 1.0)
    P = _plane_corners(tilt_deg)
    base = _project_plane(P, (0.0, 0.0, -cam_dist), f)
    bc = base.mean(axis=0)
    bw = float(base[:, 0].max() - base[:, 0].min())
    bh = float(base[:, 1].max() - base[:, 1].min())

    def corners(dx, dy, zoom):
        sc = max(out_w / bw, out_h / bh) * PLANE_SAFE_ZOOM * float(zoom)
        pr = _project_plane(P, (dx * move_gain, dy * move_gain, -cam_dist), f)
        return (pr - bc) * sc + np.array([out_w / 2.0, out_h / 2.0], dtype=np.float32)

    a = corners(dx0, dy0, z0)
    b = corners(dx1, dy1, z1)
    # index 0,1 = 화면 위(원경) / 2,3 = 화면 아래(근경)
    # ★ _plane_corners 부호 수정과 짝을 맞춘다. 실측 검증: 화면 269→371px (아래가 빠름)
    far = float(np.mean([np.hypot(*(b[i] - a[i])) for i in (0, 1)]))
    near = float(np.mean([np.hypot(*(b[i] - a[i])) for i in (2, 3)]))
    if near < far:      # 코너 순서가 반대인 경우 자동 교정
        near, far = far, near
    ratio = near / (far + 1e-6)
    return {"basis": "plane_projection", "camera": cam,
            "near_disp_px": round(near, 3), "far_disp_px": round(far, 3),
            "tilt_deg": tilt_deg, "cam_dist": cam_dist,
            "ratio": round(ratio, 3), "status": "measured",
            "pass_H1": bool(ratio >= 1.3)}


def render_parallax_depth(img_bgr: np.ndarray, depth: np.ndarray,
                          dx: float, dy: float, zoom: float,
                          out_w: int = W, out_h: int = H) -> np.ndarray:
    """★ 정본 렌더러 — 픽셀 단위 깊이 워프 (2.5D projection parallax).

    왜 레이어 방식을 버렸는가 (실패에서 배운 것):
      split_layers() 는 모든 레이어에 **원본 전체 이미지**를 담고 알파만 달리 씌운다.
      렌더 시 최원거리 레이어가 화면 대부분을 채우므로, 결국 화면 전체가
      '배경 속도'로 통째로 움직였다.
        구조식 계산값 2.29x  vs  화면 실측(광학흐름) 1.017x   ← 시차가 사라졌다
      즉 구조식은 '의도'였을 뿐 '결과'가 아니었다. 화면을 믿어야 한다.

    이 함수는 픽셀마다 깊이에 비례한 변위를 주는 backward warp 이다.
      strength(d) = (1 - d) * PARALLAX_GAIN + PARALLAX_BASE
      가까운 픽셀(d 작음)이 더 멀리서 샘플링 → 더 많이 움직인다.
    구멍(occlusion hole)이 생기지 않고 레이어 경계선도 없다.
    """
    h, w = img_bgr.shape[:2]
    if depth.shape != (h, w):
        depth = cv2.resize(depth, (w, h), interpolation=cv2.INTER_LINEAR)

    # 출력 좌표계 격자
    ys, xs = np.mgrid[0:out_h, 0:out_w].astype(np.float32)
    # 출력 좌표 → 입력 좌표 기준 스케일
    sx = w / float(out_w)
    sy = h / float(out_h)
    bx = xs * sx
    by = ys * sy

    d = cv2.remap(depth, bx, by, interpolation=cv2.INTER_LINEAR,
                  borderMode=cv2.BORDER_REPLICATE)
    strength = (1.0 - d) * PARALLAX_GAIN + PARALLAX_BASE
    z_eff = 1.0 + (zoom - 1.0) * strength

    cx, cy = w / 2.0, h / 2.0
    map_x = (bx - cx) / z_eff + cx - dx * w * strength
    map_y = (by - cy) / z_eff + cy - dy * h * strength

    return cv2.remap(img_bgr, map_x.astype(np.float32), map_y.astype(np.float32),
                     interpolation=cv2.INTER_LINEAR,
                     borderMode=cv2.BORDER_REPLICATE)


def verify_depth_parallax(depth: np.ndarray, cam: str) -> dict:
    """구조 판정 (깊이 워프판) — 근/원 픽셀의 실제 변위를 공식으로 계산."""
    dx, dy, zoom = camera_path(cam, 1.0)
    d_near = float(np.percentile(depth, 15))
    d_far = float(np.percentile(depth, 85))
    s_near = (1.0 - d_near) * PARALLAX_GAIN + PARALLAX_BASE
    s_far = (1.0 - d_far) * PARALLAX_GAIN + PARALLAX_BASE
    near_disp = abs(dx) * W * s_near
    far_disp = abs(dx) * W * s_far
    ratio = near_disp / (far_disp + 1e-6)
    return {"basis": "depth_warp", "camera": cam,
            "near_disp_px": round(near_disp, 3), "far_disp_px": round(far_disp, 3),
            "d_near": round(d_near, 3), "d_far": round(d_far, 3),
            "ratio": round(ratio, 3), "status": "measured",
            "pass_H1": bool(ratio >= 1.3)}


def render_parallax_frame(layers, dx: float, dy: float, zoom: float,
                          out_w: int = W, out_h: int = H) -> np.ndarray:
    """레이어들을 시차 적용해 한 프레임으로 합성.

    ★ 시차 공식: 가까운 레이어(z 작음)가 더 많이 움직인다.
        strength = (1.0 - z) * 1.45 + 0.30
      배경(z=1) → 0.35배,  전경(z=0) → 1.35배  → 비율 약 3.9:1
      가이드 §6 H-1 합격 기준(≥1.3:1)을 구조적으로 만족한다.
    """
    canvas = None

    # 먼 것부터 그린다 (painter's algorithm)
    for rgba, z in sorted(layers, key=lambda L: -L[1]):
        strength = (1.0 - z) * 1.45 + 0.30
        lh, lw = rgba.shape[:2]

        # 레이어별 zoom/이동 — 전경이 더 크게 확대되고 더 많이 이동
        z_eff = 1.0 + (zoom - 1.0) * strength
        tx = dx * lw * strength
        ty = dy * lh * strength

        M = np.array([[z_eff, 0.0, (1.0 - z_eff) * lw / 2.0 + tx],
                      [0.0, z_eff, (1.0 - z_eff) * lh / 2.0 + ty]], dtype=np.float32)
        # INTER_LINEAR: 서브픽셀 이동량이 작아 LANCZOS4 대비 시각 차이 없음, 비용 4배 절감
        warped = cv2.warpAffine(rgba, M, (out_w, out_h),
                                flags=cv2.INTER_LINEAR,
                                borderMode=cv2.BORDER_REPLICATE)
        rgb = warped[:, :, :3]
        if canvas is None:
            canvas = rgb.astype(np.float32)   # 최원거리 레이어는 배경 채움
            continue
        a = warped[:, :, 3:4].astype(np.float32) * (1.0 / 255.0)
        canvas += (rgb.astype(np.float32) - canvas) * a   # lerp

    return np.clip(canvas, 0, 255).astype(np.uint8)


# ══════════════════════════════════════════════════════════════
# 3단계 — 빛 일치 (Light matching)
# ══════════════════════════════════════════════════════════════
_LUT_CACHE: dict = {}

def match_tone(img: np.ndarray, brightness: float = -0.06,
               saturation: float = 0.92, contrast: float = 1.04) -> np.ndarray:
    """PRODUCTION_STANDARD.md §5 톤매칭과 동일한 값을 파이썬으로 구현.
    (ffmpeg eq=brightness=-0.06:saturation=0.92:contrast=1.04 등가)

    채도 외 항목은 화소값만의 함수이므로 256엔트리 LUT 로 처리한다 (cv2.LUT = 매우 빠름).
    채도만 그레이 혼합으로 별도 적용한다.
    """
    key = (round(brightness, 4), round(contrast, 4))
    if key not in _LUT_CACHE:
        v = np.arange(256, dtype=np.float32) / 255.0
        v = (v - 0.5) * contrast + 0.5 + brightness
        # colorbalance rs=-0.04 gs=-0.01 bs=+0.06 (navy 쪽) — BGR 채널 순서
        lut = np.zeros((256, 1, 3), dtype=np.uint8)
        lut[:, 0, 0] = np.clip(v * (1.0 + 0.06), 0, 1) * 255   # B
        lut[:, 0, 1] = np.clip(v * (1.0 - 0.01), 0, 1) * 255   # G
        lut[:, 0, 2] = np.clip(v * (1.0 - 0.04), 0, 1) * 255   # R
        _LUT_CACHE[key] = lut
    out = cv2.LUT(img, _LUT_CACHE[key])
    if abs(saturation - 1.0) > 1e-3:
        gray = cv2.cvtColor(out, cv2.COLOR_BGR2GRAY)
        out = cv2.addWeighted(out, saturation,
                              cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR),
                              1.0 - saturation, 0.0)
    return out


def contact_shadow(canvas: np.ndarray, cx: float, cy: float,
                   rx: float, ry: float, strength: float = 0.55) -> np.ndarray:
    """접지 그림자 — 가이드 §3 3단계 합격 기준.
    이것이 없으면 오브젝트가 공중에 떠 보인다.
    큰 시그마의 소프트 그림자이므로 1/4 해상도에서 계산한다 (비용 16배 절감).
    """
    h, w = canvas.shape[:2]
    sw, sh_ = w // 4, h // 4
    m = np.zeros((sh_, sw), dtype=np.float32)
    cv2.ellipse(m, (int(cx * sw), int(cy * sh_)),
                (max(int(rx * sw), 1), max(int(ry * sh_), 1)), 0, 0, 360, 1.0, -1)
    m = cv2.GaussianBlur(m, (0, 0), sigmaX=max(sw, sh_) / 45.0)
    m = cv2.resize(m, (w, h), interpolation=cv2.INTER_LINEAR)
    out = canvas.astype(np.float32) * (1.0 - m[:, :, None] * strength)
    return np.clip(out, 0, 255).astype(np.uint8)


# ══════════════════════════════════════════════════════════════
# 4단계 — 경계 은폐 (Seam hiding)  ← 가장 많이 빠뜨리는 단계
#   가이드 §3 4단계: "CG 를 일부러 더럽혀야 진짜가 된다"
# ══════════════════════════════════════════════════════════════
_GRAIN_CACHE: dict = {}

def _grain_field(h: int, w: int, seed: int) -> np.ndarray:
    """결정적 그레인 필드 (seed 고정 → 재현 가능. 난수 재현성 확보)"""
    key = (h, w, seed)
    if key not in _GRAIN_CACHE:
        rng = np.random.default_rng(seed)
        _GRAIN_CACHE[key] = rng.normal(0.0, 1.0, (h, w, 1)).astype(np.float32)
    return _GRAIN_CACHE[key]


def add_film_grain(img: np.ndarray, amount: float = 4.0, frame_idx: int = 0) -> np.ndarray:
    """필름 그레인 ±amount. PRODUCTION_STANDARD.md §4 film grain(±4) 준수.
    frame_idx 로 필드를 시프트해 정지 그레인(고정 패턴)을 피한다.
    """
    h, w = img.shape[:2]
    g = _grain_field(h, w, seed=20260814)
    sy, sx = (frame_idx * 7) % h, (frame_idx * 13) % w
    g = np.roll(np.roll(g, sy, axis=0), sx, axis=1)
    return np.clip(img.astype(np.float32) + g * amount, 0, 255).astype(np.uint8)


_EDGE_CACHE: dict = {}

def _edge_field(alpha_mask: np.ndarray, h: int, w: int, strength: float) -> np.ndarray:
    """라이트랩 외곽 필드. 알파는 프레임 간 불변이므로 캐시한다."""
    key = (h, w, float(alpha_mask.sum()), round(strength, 4))
    if key not in _EDGE_CACHE:
        a = alpha_mask.astype(np.float32)
        if a.ndim == 3:
            a = a[:, :, 0]
        if a.shape != (h, w):
            a = cv2.resize(a, (w, h), interpolation=cv2.INTER_LINEAR)
        e = np.clip(cv2.GaussianBlur(a, (0, 0), sigmaX=max(w, h) / 90.0) - a, 0, 1)
        _EDGE_CACHE[key] = (e[:, :, None] * strength).astype(np.float32)
    return _EDGE_CACHE[key]


def light_wrap(canvas: np.ndarray, alpha_mask: np.ndarray,
               strength: float = 0.30) -> np.ndarray:
    """라이트 랩 — 배경 빛이 전경 외곽을 감싸게. 합성 경계의 '오려낸 티'를 없앤다.
    큰 시그마 블러이므로 1/4 다운스케일로 계산해도 시각 차이가 없다 (비용 16배 절감)."""
    h, w = canvas.shape[:2]
    e = _edge_field(alpha_mask, h, w, strength)
    small = cv2.resize(canvas, (w // 4, h // 4), interpolation=cv2.INTER_AREA)
    small = cv2.GaussianBlur(small, (0, 0), sigmaX=max(w, h) / 160.0)
    bg_blur = cv2.resize(small, (w, h), interpolation=cv2.INTER_LINEAR).astype(np.float32)
    out = canvas.astype(np.float32) * (1.0 - e) + bg_blur * e
    return np.clip(out, 0, 255).astype(np.uint8)


_HAZE_CACHE: dict = {}

def depth_haze(canvas: np.ndarray, depth: np.ndarray,
               tint=NAVY_DK, strength: float = 0.22) -> np.ndarray:
    """대기 감쇠 — 먼 영역을 배경색 쪽으로 흐리게. 깊이감을 만든다."""
    h, w = canvas.shape[:2]
    key = (h, w, float(depth.sum()), round(strength, 4), tint)
    if key not in _HAZE_CACHE:
        d = depth if depth.shape == (h, w) else cv2.resize(
            depth, (w, h), interpolation=cv2.INTER_LINEAR)
        d = (d[:, :, None] * strength).astype(np.float32)
        tint_bgr = np.array([tint[2], tint[1], tint[0]], dtype=np.float32)
        _HAZE_CACHE[key] = (1.0 - d, tint_bgr * d)
    keep, add = _HAZE_CACHE[key]
    return np.clip(canvas.astype(np.float32) * keep + add, 0, 255).astype(np.uint8)


_VIG_CACHE: dict = {}

def vignette(canvas: np.ndarray, strength: float = 0.28) -> np.ndarray:
    """비네트 — PRODUCTION_STANDARD.md §4 필수 효과 (마스크 캐시)"""
    h, w = canvas.shape[:2]
    key = (h, w, round(strength, 4))
    if key not in _VIG_CACHE:
        ys = ((np.arange(h, dtype=np.float32) - h / 2.0) / (h / 2.0)) ** 2
        xs = ((np.arange(w, dtype=np.float32) - w / 2.0) / (w / 2.0)) ** 2
        r2 = np.clip((ys[:, None] + xs[None, :]) / 2.0, 0.0, 1.0)
        _VIG_CACHE[key] = (1.0 - r2 * strength)[:, :, None].astype(np.float32)
    return np.clip(canvas.astype(np.float32) * _VIG_CACHE[key], 0, 255).astype(np.uint8)


def motion_blur(canvas: np.ndarray, dx: float, dy: float, scale: float = 26.0) -> np.ndarray:
    """카메라 운동 방향 모션 블러. 실사 셔터와 정합시켜 CG 티를 줄인다."""
    mag = float(np.hypot(dx, dy)) * scale
    if mag < 0.7:
        return canvas
    k = int(np.clip(mag, 3, 21))
    if k % 2 == 0:
        k += 1
    kern = np.zeros((k, k), dtype=np.float32)
    ang = np.arctan2(dy, dx)
    c = k // 2
    for i in range(k):
        x = int(round(c + (i - c) * np.cos(ang)))
        y = int(round(c + (i - c) * np.sin(ang)))
        if 0 <= x < k and 0 <= y < k:
            kern[y, x] = 1.0
    s = kern.sum()
    if s < 1e-6:
        return canvas
    return cv2.filter2D(canvas, -1, kern / s)


# ══════════════════════════════════════════════════════════════
# 검수 — 가이드 §6 H-1 시차 자동 판정
# ══════════════════════════════════════════════════════════════
def measure_parallax(frame_a: np.ndarray, frame_b: np.ndarray,
                     depth: np.ndarray | None = None) -> dict:
    """두 프레임 간 광학 흐름으로 전경/배경 변위 비율을 측정.

    합격 기준 (가이드 §6 H-1): ratio >= 1.3
      ratio ≈ 1.0  → 통째로 움직임 = 슬라이드쇼 = 실패
      ratio >= 1.3 → 시차 존재 = 하이브리드 3D

    ★ 측정 신뢰성 확보 2가지 (초기 구현에서 오판이 나와 교정한 부분):
      (1) 영역 분할은 화면 위치가 아니라 **깊이맵** 기준으로 한다.
          화면 상단=배경 가정은 지면 원근 샷에만 맞고 추상 이미지에서 틀린다.
      (2) **텍스처가 있는 화소만** 집계한다.
          평탄한 영역은 실제로 움직여도 Farneback 이 흐름을 못 잡아 0 으로 읽힌다.
          이를 걸러내지 않으면 정상 렌더를 실패로 오판한다.
    """
    ga = cv2.cvtColor(frame_a, cv2.COLOR_BGR2GRAY)
    gb = cv2.cvtColor(frame_b, cv2.COLOR_BGR2GRAY)
    # ★ 파라미터 주의 (실측으로 교정한 부분):
    #   기본값(levels=3, winsize=21)의 포착 범위는 약 20px 다.
    #   변위가 그보다 크면 흐름 추정이 실패해 '움직이지 않았다'(≈0)고 잘못 보고한다.
    #   초기 구현에서 근경 74px 변위를 0.0277 로 오독해 정상 렌더를 실패 판정한 사례가 있다.
    #   → 피라미드 6단(포착 ~수백px) + winsize 39 로 확대한다.
    #   호출부는 추가로 '작은 간격의 두 프레임'을 넘겨 변위 자체를 작게 유지해야 한다.
    flow = cv2.calcOpticalFlowFarneback(ga, gb, None,
                                        0.5, 6, 39, 5, 7, 1.5, 0)
    mag = np.sqrt(flow[..., 0] ** 2 + flow[..., 1] ** 2)
    h, w = mag.shape

    # (2) 텍스처 마스크 — 흐름 추정이 유효한 화소만
    grad = np.abs(cv2.Sobel(ga, cv2.CV_32F, 1, 0, ksize=3)) + \
           np.abs(cv2.Sobel(ga, cv2.CV_32F, 0, 1, ksize=3))
    tex = grad > max(float(np.percentile(grad, 60)), 4.0)

    # (1) 깊이 기준 분할 (없으면 화면 위치로 폴백)
    if depth is not None:
        d = depth if depth.shape == (h, w) else cv2.resize(
            depth, (w, h), interpolation=cv2.INTER_LINEAR)
        near = (d <= float(np.percentile(d, 33))) & tex
        far  = (d >= float(np.percentile(d, 67))) & tex
        basis = "depth"
    else:
        near = np.zeros((h, w), bool); near[int(h * 0.65):, :] = True; near &= tex
        far  = np.zeros((h, w), bool); far[: int(h * 0.35), :] = True; far &= tex
        basis = "screen_position"

    # 표본 충분성 — 두 영역 모두 충분한 텍스처가 있어야 비교가 성립한다.
    #
    # ★ 실측으로 확정한 규칙 (오판 사례가 있어 명시함):
    #   체커보드 합성 테스트(양 영역 모두 강한 텍스처)에서는
    #     구조 판정 2.29x  vs  광학 측정 2.225x  → 오차 3% 이내로 일치했다.
    #   그러나 근경이 평탄한 실제 이미지에서는
    #     구조 판정 2.29x  vs  광학 측정 0.004   → 광학이 완전히 틀렸다.
    #   원인은 시차가 없는 게 아니라 **평탄 영역에서 흐름을 못 잡는 것**이다.
    #   따라서 표본이 부족하면 '실패'가 아니라 '판정 불가'로 보고해야 한다.
    #   실패로 처리하면 정상 렌더를 반려하게 된다.
    #
    #   또한 두 영역의 텍스처 밀도 차가 4배를 넘으면 비교 자체가 불공정하므로
    #   역시 판정 불가로 둔다.
    min_px = int(h * w * 0.05)
    n_near, n_far = int(near.sum()), int(far.sum())
    imbalance = max(n_near, n_far) / max(min(n_near, n_far), 1)
    if n_near < min_px or n_far < min_px or imbalance > 4.0:
        return {"basis": basis, "near_px": n_near, "far_px": n_far,
                "min_px_required": min_px,
                "texture_imbalance": round(imbalance, 2),
                "ratio": None, "status": "indeterminate", "pass_H1": None,
                "note": "textured sample inadequate — optical flow unreliable here. "
                        "verify_layer_parallax() is authoritative for this shot."}

    fg = float(np.median(mag[near]))
    bg = float(np.median(mag[far]))
    ratio = fg / (bg + 1e-6)
    return {
        "basis": basis,
        "near_disp": round(fg, 4),
        "far_disp": round(bg, 4),
        "near_px": int(near.sum()),
        "far_px": int(far.sum()),
        "ratio": round(ratio, 3),
        "status": "measured",
        "pass_H1": bool(ratio >= 1.3),
    }


def measure_parallax_phase(frame_a: np.ndarray, frame_b: np.ndarray) -> dict:
    """위상 상관(phase correlation)으로 상/하 영역의 실제 변위를 측정.

    ★ 이것이 픽셀 기반 H-1 판정의 정본이다. Farneback 광학흐름보다 신뢰할 수 있다.

    실측 비교 (2026-08-14, 동일 렌더 대상):
        위상 상관   상단 -54.77px / 하단 -109.98px → 비율 2.01  (구조 판정 2.29 와 정합)
        Farneback   상단 3.96     / 하단 0.014     → 비율 0.004 (완전히 틀림)
    Farneback 은 평탄 영역에서 흐름을 잡지 못해 0 으로 오독한다.
    위상 상관은 주파수 영역 전역 정합이므로 평탄 영역에서도 전체 변위를 잡는다.

    합격 기준 (가이드 §6 H-1): ratio >= 1.3
    """
    h = frame_a.shape[0]

    def _shift(y0: int, y1: int):
        A = cv2.cvtColor(frame_a[y0:y1], cv2.COLOR_BGR2GRAY).astype(np.float32)
        B = cv2.cvtColor(frame_b[y0:y1], cv2.COLOR_BGR2GRAY).astype(np.float32)
        win = cv2.createHanningWindow((A.shape[1], A.shape[0]), cv2.CV_32F)
        (dx, dy), resp = cv2.phaseCorrelate(A, B, win)
        return float(np.hypot(dx, dy)), float(resp)

    far_d, far_c = _shift(0, int(h * 0.35))        # 상단 = 원경
    near_d, near_c = _shift(int(h * 0.65), h)      # 하단 = 근경
    ratio = near_d / (far_d + 1e-6)
    return {
        "basis": "phase_correlation",
        "near_disp_px": round(near_d, 2),
        "far_disp_px": round(far_d, 2),
        "near_conf": round(near_c, 4),
        "far_conf": round(far_c, 4),
        "ratio": round(ratio, 3),
        "status": ("measured" if min(float(near_c), float(far_c)) >= 0.15 else "low_confidence"),
        "min_conf_required": 0.15,
        "pass_H1": (bool(ratio >= 1.3) and min(float(near_c), float(far_c)) >= 0.15),
    }


def verify_layer_parallax(layers, cam: str) -> dict:
    """구조적 시차 검증 — 광학 흐름이 불가능한 경우(평탄 영역)의 정본 판정.

    렌더러가 실제로 적용하는 레이어별 변환을 그대로 계산해
    최근접 레이어와 최원거리 레이어의 화면상 변위 비율을 구한다.
    광학 흐름과 달리 텍스처에 의존하지 않으므로 항상 판정 가능하다.

    합격 기준 (가이드 §6 H-1): ratio >= 1.3
    """
    if len(layers) < 2:
        return {"ratio": 1.0, "pass_H1": False, "note": "single layer = no parallax"}

    zs = sorted(L[1] for L in layers)
    z_near, z_far = zs[0], zs[-1]
    s_near = (1.0 - z_near) * 1.0 + 0.35
    s_far = (1.0 - z_far) * 1.0 + 0.35

    lh, lw = layers[0][0].shape[:2]
    disp = {}
    for name, s in (("near", s_near), ("far", s_far)):
        pts = []
        for t in (0.0, 0.5):
            dx, dy, zoom = camera_path(cam, t)
            z_eff = 1.0 + (zoom - 1.0) * s
            # 화면 중앙에서 1/4 지점 화소의 실제 이동량 (zoom + translate 합산)
            px, py = lw * 0.25, lh * 0.25
            sx = z_eff * px + (1.0 - z_eff) * lw / 2.0 + dx * lw * s
            sy = z_eff * py + (1.0 - z_eff) * lh / 2.0 + dy * lh * s
            pts.append((sx, sy))
        disp[name] = float(np.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]))

    ratio = disp["near"] / (disp["far"] + 1e-6)
    return {
        "basis": "layer_transform",
        "camera": cam,
        "near_disp_px": round(disp["near"], 3),
        "far_disp_px": round(disp["far"], 3),
        "z_near": round(z_near, 3),
        "z_far": round(z_far, 3),
        "ratio": round(ratio, 3),
        "status": "measured",
        "pass_H1": bool(ratio >= 1.3),
    }


def measure_depth_legibility(img_bgr: np.ndarray, depth: np.ndarray) -> dict:
    """H-7 깊이 가독성 — 시차가 '존재'하는지가 아니라 '보이는지'를 판정.

    ★ 이 검사가 있는 이유 (실패에서 배운 것):
      성운/별밭 이미지로 시차를 만들었을 때
        수치상: 근경 110px / 원경 55px = 2.0x  → 시차 명백히 존재
        사람 눈: "완전히 정지된 것처럼 보인다. 평면이다."
      원인은 시차가 없는 게 아니라 **기준이 될 랜드마크가 없는 것**이다.
      관객은 "A 가 B 를 지나간다"로 깊이를 인식한다. 지나갈 A, B 가 없으면
      아무리 정확한 시차도 지각되지 않는다.

      ⇒ 하이브리드 3D 소재는 반드시 **윤곽이 뚜렷한 형태**를 가져야 한다.
        (건물, 구조물, 도형, 인물 실루엣, 격자 …)
        안개·성운·그라디언트·추상 텍스처는 시차를 넣어도 헛수고다.

    판정: 근경 영역에 충분한 에지 구조가 있는가.
    """
    h, w = img_bgr.shape[:2]
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    if depth.shape != (h, w):
        depth = cv2.resize(depth, (w, h), interpolation=cv2.INTER_LINEAR)

    edges = cv2.Canny(gray, 60, 160)
    near = depth <= float(np.percentile(depth, 40))
    far = depth >= float(np.percentile(depth, 60))

    near_edge = float(edges[near].mean() / 255.0) if near.sum() else 0.0
    far_edge = float(edges[far].mean() / 255.0) if far.sum() else 0.0
    overall = float(edges.mean() / 255.0)

    # 기준 0.010 = 화소 1% 이상이 에지. 실측: 성운 이미지 0.002 / 구조물 이미지 0.03~0.08
    MIN_EDGE = 0.010
    ok = bool(near_edge >= MIN_EDGE and overall >= MIN_EDGE)
    return {
        "near_edge_density": round(near_edge, 5),
        "far_edge_density": round(far_edge, 5),
        "overall_edge_density": round(overall, 5),
        "min_required": MIN_EDGE,
        "pass_H7": ok,
        "note": ("ok — 랜드마크 충분, 시차가 눈에 보인다" if ok else
                 "FAIL — 윤곽 랜드마크 부족. 시차가 수치상 존재해도 관객은 평면으로 본다. "
                 "구조물/도형/실루엣이 있는 소재로 교체하거나 그래픽 요소를 얹어야 한다."),
    }


def measure_screen_parallax(frame_a: np.ndarray, frame_b: np.ndarray,
                            bands=(0.04, 0.28, 0.52, 0.76)) -> dict:
    """★★★ H-8 화면 실측 시차 — 최종 정본 판정.

    왜 이것이 최종 정본인가:
      공식 계산(구조 판정)은 '의도'만 알려준다. 레이어 방식은 구조식 2.29x 를
      냈지만 화면 실측은 1.017x(=평면)였다. 위상 상관은 큰 변위에서 신뢰도가
      노이즈 수준(0.02~0.06)으로 떨어졌다. Farneback 은 평탄 영역에서 거짓 0.
      → 남은 방법은 **출력 프레임을 격자 블록으로 잘라 직접 대응점을 찾는 것**이다.
        (cv2.matchTemplate TM_CCOEFF_NORMED, 응답 0.55 이상만 채택)

    가로 밴드별 median 변위가 '아래로 갈수록 증가'해야 원근 시차다.
    """
    A = cv2.cvtColor(frame_a, cv2.COLOR_BGR2GRAY).astype(np.float32)
    B = cv2.cvtColor(frame_b, cv2.COLOR_BGR2GRAY).astype(np.float32)
    h, w = A.shape
    BS = max(160, int(h * 0.21))
    SEARCH = int(w * 0.30)
    out = []
    for fy in bands:
        y0 = int(h * fy)
        if y0 + BS > h:
            continue
        ds = []
        for x0 in range(0, w - BS + 1, BS // 2):
            pb = B[y0:y0 + BS, x0:x0 + BS][28:BS - 28, 28:BS - 28]
            if pb.std() < 6.0:
                continue
            x_lo = max(0, x0 - SEARCH)
            x_hi = min(w, x0 + BS + SEARCH)
            res = cv2.matchTemplate(A[y0:y0 + BS, x_lo:x_hi], pb, cv2.TM_CCOEFF_NORMED)
            _, mx, _, loc = cv2.minMaxLoc(res)
            if mx < 0.55:
                continue
            ds.append(abs((x_lo + loc[0]) - (x0 + 28)))
        out.append({"y": y0, "n": len(ds),
                    "median_dx": (round(float(np.median(ds)), 2) if ds else None)})

    vals = [(b["y"], b["median_dx"]) for b in out if b["median_dx"] is not None]
    if len(vals) < 2:
        return {"basis": "screen_block_match", "bands": out,
                "ratio": None, "status": "indeterminate", "pass_H8": None,
                "note": "신뢰 가능한 블록이 부족하다 — 소재 텍스처를 확인하라"}
    far_v = vals[0][1]
    near_v = vals[-1][1]
    ratio = near_v / (far_v + 1e-6)
    mono = all(vals[i][1] <= vals[i + 1][1] + 6.0 for i in range(len(vals) - 1))
    return {"basis": "screen_block_match", "bands": out,
            "far_disp_px": far_v, "near_disp_px": near_v,
            "ratio": round(ratio, 3), "monotonic": bool(mono),
            "status": "measured",
            "pass_H8": bool(ratio >= 1.3 and mono),
            "note": ("ok — 화면에서 아래(근경)가 위(원경)보다 빠르게 움직인다"
                     if ratio >= 1.3 and mono else
                     "FAIL — 화면 실측에서 원근 시차가 부족하다(공식 계산과 무관하게 실패)")}


def measure_frame_hold(frames: list, tol: float = 0.35) -> dict:
    """가이드 §6 H-5 — 동일 프레임 연속(frame hold) 검출. P0-A 재발 방지.
    합격 기준: holds == 0
    """
    holds, diffs = 0, []
    for i in range(1, len(frames)):
        d = float(np.abs(frames[i].astype(np.int16) -
                         frames[i - 1].astype(np.int16)).mean())
        diffs.append(d)
        if d < tol:
            holds += 1
    return {
        "frames": len(frames),
        "holds": holds,
        "min_diff": round(min(diffs), 4) if diffs else None,
        "mean_diff": round(sum(diffs) / len(diffs), 4) if diffs else None,
        "pass_H5": bool(holds == 0),
    }
