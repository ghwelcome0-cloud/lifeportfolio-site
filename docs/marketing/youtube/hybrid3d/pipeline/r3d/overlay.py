#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
overlay.py — ★2D 오버레이 레이어 엔진★  (After Effects 대체)

■ 왜 이 파일이 존재하는가 (CEO-90 / CEO-91 · 유료 분석 2건의 결론)
   벤치마크 @archcutaway 를 유료 분석한 결과, 완성도의 원천은 3D 렌더가 아니었다.

     "the clean vector graphics HIDE THE IMPERFECTIONS of the AI video and
      sell the educational/technical vibe"
        — analyze_media_content, V_5mJPY0XNw 「해저 광케이블망」 82s

     "발광 라인·UI·라벨 = After Effects 2D, 3D 카메라 트래킹으로 공간에 고정"
        — analyze_media_content, patj0ZL5HOA 「자포리자 원전」 72s

   우리는 3D 카메라·앵커·게이트를 교훈 230개까지 정교화했지만, ★이 레이어를
   아예 만들지 않았다★. 대표님이 숏폼 C 를 보고 "프래비즈 일부 적용한 영상"
   (CEO-89) 이라고 한 것은 정확히 이 결손을 지적한 것이다.

   [CEO-91] "우리는 단순히 벤치마크 하는 계정의 영상 제작법을 아는 수준이
   아니라, 그 영상 기법의 원리를 확실히 알아서 우리의 콘텐츠에 맞게 활용할 수
   있어야 합니다."  ⇒ 원리를 코드로 고정한 것이 이 파일이다.

■ 원리 (벤치마크에서 추출한 4개)
   원리 1  ★3D 는 단면 컷에만★. 배경·설정샷은 AI i2v 로 싸게 만든다.
   원리 2  ★완성도는 2D 벡터 그래픽이 만든다★. 그것이 AI 의 결함을 가린다.
   원리 3  ★색은 의미다★. 시안=에너지/흐름/UI · 빨강=경고 · 노랑=열 · 회색=구조체.
   원리 4  ★라벨은 공간에 고정된 것처럼 보여야 한다★ (브래킷 + 리더선 + 앵커점).

■ 팔레트 정본 (교훈 176: 복제하지 말고 참조하라)
   승인 3장 픽셀 실측값은 shorts916.py 가 보유한다. 이 파일은 그것을
   ★파일 경로로 import★ 해서 쓴다. 값을 여기에 다시 적지 않는다.

■ 조판 정본 (교훈 176 / CEO-49)
   어절 단위 줄바꿈은 longcut.py 의 wrap_words() 가 정본이다. 그것을 import 한다.

■ 교훈 230 준수
   /tmp 가 아니라 r3d/ 에 영구 파일로 둔다. selfcheck() 를 갖는다.

CLI
   python3 overlay.py selfcheck        자기검사 (팔레트 불변식 + 조판 + 합성)
   python3 overlay.py demo <out.png>   데모 오버레이 1장
"""
import os, sys, json, math, importlib.util, subprocess

W_DEFAULT, H_DEFAULT = 1080, 1920

# ── 정본 참조 (교훈 176) ────────────────────────────────────────────────
_SHORTS916 = "/home/user/lf/work/longform/shorts916.py"
_LONGCUT   = "/home/user/lf/work/longform/longcut.py"


def _load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise SystemExit("CANNOT LOAD %s" % path)
    m = importlib.util.module_from_spec(spec)
    sys.modules[name] = m
    spec.loader.exec_module(m)
    return m


_s916 = _load(_SHORTS916, "_ov_s916")
_lcut = _load(_LONGCUT, "_ov_lcut")

# 승인 3장 실측 팔레트 — ★참조★ (여기서 정의하지 않는다)
BG    = _s916.BG        # (11,15,17)   letterbox ground
PANEL = _s916.PANEL     # (26,34,33)   approved panel fill
RIM   = _s916.RIM       # (140,201,206) approved neon rim
CORE  = _s916.CORE      # (211,252,255) approved neon core
INK   = _s916.INK       # (241,241,241) approved white hangul
DIM   = _s916.DIM       # (128,150,155)
FONT   = _s916.FONT
FONT_R = _s916.FONT_R

# 원리 3 — 색은 의미다. 시안 계열은 승인 팔레트를 쓰고, 경고/열만 신설한다.
WARN = (232, 78, 66)     # 경고 (빨강)  — 벤치마크 실측 계열
HEAT = (238, 176, 62)    # 열/주의 (노랑·주황)
STRUCT = (150, 158, 162) # 구조체 (산업 회색)

# 조판 정본 참조 (CEO-49 어절 경계)
wrap_words = _lcut.wrap_words


# ── 기초 계측 (교훈 193: getbbox 가 아니라 알파 채널 bbox) ───────────────
def ink_wh(txt, fnt, pad=10):
    from PIL import Image, ImageDraw
    probe = Image.new("L", (max(64, int(fnt.size * (len(txt) + 4))), int(fnt.size * 3)), 0)
    ImageDraw.Draw(probe).text((pad, pad), txt, font=fnt, fill=255)
    b = probe.getbbox()
    return (0, 0) if b is None else (b[2] - b[0], b[3] - b[1])


def font(pt, bold=True):
    from PIL import ImageFont
    return ImageFont.truetype(FONT if bold else FONT_R, pt)


def _a(rgb, alpha):
    return (rgb[0], rgb[1], rgb[2], int(alpha))


# ────────────────────────────────────────────────────────────────────────
# 원리 2 — 벡터 그래픽 프리미티브
# ────────────────────────────────────────────────────────────────────────
def glass_panel(d, box, fill=None, alpha=210, rim=None, rim_px=3,
                rim_edges=("top", "bottom")):
    """반투명 다크 패널 + 시안 테두리 (glassmorphism).

    벤치마크 실측: "반투명 다크 배경 + 시안 테두리 + glassmorphism".
    테두리는 기본으로 위/아래만 — 승인 3장(std1~3)의 자막 패널 문법이다.
    """
    x0, y0, x1, y1 = box
    fill = fill or PANEL
    rim = rim or RIM
    d.rectangle([x0, y0, x1, y1], fill=_a(fill, alpha))
    if "top" in rim_edges:
        d.rectangle([x0, y0, x1, y0 + rim_px], fill=_a(rim, 255))
    if "bottom" in rim_edges:
        d.rectangle([x0, y1 - rim_px, x1, y1], fill=_a(rim, 255))
    if "left" in rim_edges:
        d.rectangle([x0, y0, x0 + rim_px, y1], fill=_a(rim, 255))
    if "right" in rim_edges:
        d.rectangle([x1 - rim_px, y0, x1, y1], fill=_a(rim, 255))


def brackets(d, box, arm=42, thick=4, col=None, alpha=255):
    """★코너 브래킷★ — 원리 4. 라벨/대상이 「측정되고 있다」는 신호.

    벤치마크 0:03 의 3D 트래킹 teal 텍스트박스가 이 문법이다.
    """
    x0, y0, x1, y1 = box
    col = col or RIM
    c = _a(col, alpha)
    def _r(ax0, ax1, ay0, ay1):
        # PIL 은 [x0,y0,x1,y1] 순서를 요구하고 x1>=x0, y1>=y0 여야 한다.
        d.rectangle([min(ax0, ax1), min(ay0, ay1),
                     max(ax0, ax1), max(ay0, ay1)], fill=c)

    for (cx, cy, sx, sy) in ((x0, y0, 1, 1), (x1, y0, -1, 1),
                             (x0, y1, 1, -1), (x1, y1, -1, -1)):
        _r(cx, cx + sx * arm, cy, cy + sy * thick)      # 가로 팔
        _r(cx, cx + sx * thick, cy, cy + sy * arm)      # 세로 팔


def glow_line(d, pts, thick=4, col=None, core=None, alpha=255):
    """★발광 라인★ — 원리 3. 에너지/흐름/연결.  RIM 위에 CORE 를 0.5 배 폭으로.

    B >= G > R 불변식을 지키므로 승인 문법(시안 네온)을 깨지 않는다.
    """
    col = col or RIM
    core = core or CORE
    if len(pts) < 2:
        return
    d.line(pts, fill=_a(col, alpha), width=int(thick), joint="curve")
    inner = max(1, int(thick * 0.5))
    d.line(pts, fill=_a(core, alpha), width=inner, joint="curve")


def arrow(d, p0, p1, thick=5, head=26, col=None, core=None, alpha=255):
    """★화살표★ — 시선 유도. 발광 라인 + 삼각 헤드."""
    col = col or RIM
    core = core or CORE
    ang = math.atan2(p1[1] - p0[1], p1[0] - p0[0])
    bx = p1[0] - head * math.cos(ang)
    by = p1[1] - head * math.sin(ang)
    glow_line(d, [p0, (bx, by)], thick=thick, col=col, core=core, alpha=alpha)
    s = head * 0.52
    tri = [p1,
           (bx - s * math.sin(ang), by + s * math.cos(ang)),
           (bx + s * math.sin(ang), by - s * math.cos(ang))]
    d.polygon(tri, fill=_a(col, alpha))
    tri2 = [(p1[0] - head * 0.30 * math.cos(ang), p1[1] - head * 0.30 * math.sin(ang)),
            (bx - s * 0.42 * math.sin(ang), by + s * 0.42 * math.cos(ang)),
            (bx + s * 0.42 * math.sin(ang), by - s * 0.42 * math.cos(ang))]
    d.polygon(tri2, fill=_a(core, alpha))


def leader_label(d, anchor, text, pt=34, side="right", gap=110,
                 col=None, bold=True, alpha_panel=214, dot=7):
    """★리더선 라벨★ — 원리 4. 앵커점 → 리더선 → 브래킷 라벨.

    「공간의 이 지점을 가리키고 있다」를 만드는 최소 문법.
    반환값: 라벨 박스 (겹침 검사용)
    """
    col = col or RIM
    f = font(pt, bold)
    tw, th = ink_wh(text, f)
    pad_x, pad_y = 20, 14
    ax, ay = anchor
    if side == "right":
        lx0 = ax + gap
    else:
        lx0 = ax - gap - (tw + 2 * pad_x)
    ly0 = ay - (th + 2 * pad_y) / 2.0
    box = (lx0, ly0, lx0 + tw + 2 * pad_x, ly0 + th + 2 * pad_y)
    # 리더선
    mid = (ax + (gap * (0.55 if side == "right" else -0.55)), ay)
    glow_line(d, [(ax, ay), mid,
                  (box[0] if side == "right" else box[2], ay)], thick=3, col=col)
    # 앵커점
    d.ellipse([ax - dot, ay - dot, ax + dot, ay + dot], fill=_a(CORE, 255))
    d.ellipse([ax - dot * 2.0, ay - dot * 2.0, ax + dot * 2.0, ay + dot * 2.0],
              outline=_a(col, 190), width=2)
    glass_panel(d, box, alpha=alpha_panel, rim=col,
                rim_edges=("top", "bottom", "left", "right"), rim_px=2)
    brackets(d, box, arm=18, thick=3, col=col)
    d.text((box[0] + pad_x, box[1] + pad_y), text, font=f, fill=_a(INK, 255), anchor="la")
    return box


def numeric(d, xy, value, unit="", pt=52, label="", col=None):
    """★수치 라벨★ — 교육/기술 톤의 핵심. 큰 숫자 + 작은 단위 + 캡션."""
    col = col or CORE
    f = font(pt, True)
    fu = font(max(16, int(pt * 0.44)), True)
    x, y = xy
    d.text((x, y), str(value), font=f, fill=_a(col, 255), anchor="la")
    vw, _ = ink_wh(str(value), f)
    if unit:
        d.text((x + vw + 8, y + int(pt * 0.42)), unit, font=fu,
               fill=_a(RIM, 255), anchor="la")
    if label:
        fl = font(max(14, int(pt * 0.36)), False)
        d.text((x, y + int(pt * 1.16)), label, font=fl, fill=_a(DIM, 255), anchor="la")


def warn_icon(d, xy, r=26, col=None, alpha=255):
    """★경고 아이콘★ — 원리 3. 빨강은 경고에만 쓴다."""
    col = col or WARN
    x, y = xy
    tri = [(x, y - r), (x - r * 0.92, y + r * 0.72), (x + r * 0.92, y + r * 0.72)]
    d.polygon(tri, outline=_a(col, alpha), width=max(3, int(r * 0.14)))
    d.rectangle([x - r * 0.09, y - r * 0.36, x + r * 0.09, y + r * 0.20],
                fill=_a(col, alpha))
    d.ellipse([x - r * 0.11, y + r * 0.34, x + r * 0.11, y + r * 0.52],
              fill=_a(col, alpha))


def tick_rule(d, y, x0, x1, n=10, h=12, col=None, alpha=200):
    """★계측 눈금★ — 화면이 「도면」임을 알리는 저비용 신호."""
    col = col or RIM
    d.rectangle([x0, y, x1, y + 2], fill=_a(col, alpha))
    for i in range(n + 1):
        x = x0 + (x1 - x0) * i / float(n)
        hh = h * (1.8 if i % 5 == 0 else 1.0)
        d.rectangle([x, y, x + 2, y + hh], fill=_a(col, alpha))


def hud_frame(d, w, h, inset=28, col=None, alpha=170):
    """★HUD 프레임★ — 화면 전체 코너 브래킷. 벤치마크 상시 문법."""
    brackets(d, (inset, inset, w - inset, h - inset), arm=64, thick=4,
             col=col or RIM, alpha=alpha)


def progress_bar(d, y, x0, x1, frac, thick=6, col=None, alpha=230):
    """★진행 바★ — 시청자에게 "얼마 남았는가" 를 알린다.

    벤치마크의 이탈 방지 문법. 짧은 숏폼에서도 진행이 보이면 끝까지 본다.
    """
    col = col or RIM
    d.rectangle([x0, y, x1, y + thick], fill=_a(DIM, 90))
    xe = x0 + (x1 - x0) * max(0.0, min(1.0, frac))
    if xe > x0:
        d.rectangle([x0, y, xe, y + thick], fill=_a(col, alpha))
        d.rectangle([max(x0, xe - 3), y - 3, xe, y + thick + 3],
                    fill=_a(CORE, 255))


def data_strip(d, xy, items, pt=26, gap=34, col=None, alpha=200):
    """★데이터 스트립★ — 작은 라벨:값 쌍을 한 줄로 늘어놓는다.

    벤치마크가 상단 여백을 비워두지 않는 이유가 이것이다. 화면이 「계측
    장비의 화면」처럼 읽히면 신뢰감이 생기고, 그것이 교육·기술 분위기를
    만든다 (분석 원문: "sell the educational/technical vibe").
    """
    col = col or DIM
    x, y = xy
    fl = font(pt, False)
    fv = font(pt, True)
    for k, v in items:
        d.text((x, y), k, font=fl, fill=_a(col, alpha), anchor="la")
        kw, _ = ink_wh(k, fl)
        d.text((x + kw + 10, y), str(v), font=fv, fill=_a(RIM, 240),
               anchor="la")
        vw, _ = ink_wh(str(v), fv)
        x += kw + vw + 10 + gap


def measure_grid(d, w, h, step=120, col=None, alpha=42, major=4):
    """★측정 격자★ — 배경이 비어 있어도 화면을 「도면」으로 만든다.

    유료 분석의 핵심 문장이 이것이다: "the clean vector graphics HIDE THE
    IMPERFECTIONS of the AI video and sell the educational/technical vibe".
    배경 3D가 빈약하거나 AI 생성물이 어색해도, 그 위에 정확한 벡터 격자가
    깔리면 화면은 「계측된 도면」으로 읽힌다. 벤치마크가 빈 배경을 그냥
    두지 않는 이유이며, 우리가 재렌더 없이(크레딧 0) 밀도를 올리는 수단이다.
    major 배수 번째 선은 진하게 그려 눈금 위계를 만든다.
    """
    col = col or RIM
    n = 0
    x = step
    while x < w:
        a = alpha * 2 if n % major == major - 1 else alpha
        d.line([(x, 0), (x, h)], fill=_a(col, a), width=1)
        x += step
        n += 1
    n = 0
    y = step
    while y < h:
        a = alpha * 2 if n % major == major - 1 else alpha
        d.line([(0, y), (w, y)], fill=_a(col, a), width=1)
        y += step
        n += 1


def section_marks(d, box, col=None, alpha=150, pitch=64):
    """★단면 해칭 + 치수선★ — 「해부했다」는 사실을 그래픽으로 선언한다.

    벤치마크의 단면 컷은 3D boolean slice 로 만들지만, 그 단면이 단면으로
    읽히는 이유는 그 위에 얹힌 ★해칭(사선)과 치수선★ 이다. 우리는 3D 를
    다시 돌리지 않고 이 2D 기호만으로 같은 독해를 만든다 (원리 = 레이어 3).
    """
    col = col or STRUCT
    x0, y0, x1, y1 = [float(v) for v in box]
    if x1 < x0:
        x0, x1 = x1, x0
    if y1 < y0:
        y0, y1 = y1, y0
    # 사선 해칭 (단면의 국제 제도 기호)
    span = (x1 - x0) + (y1 - y0)
    t = 0.0
    while t < span:
        ax, ay = x0 + t, y0
        bx, by = x0, y0 + t
        if ax > x1:
            ay = y0 + (ax - x1)
            ax = x1
        if by > y1:
            bx = x0 + (by - y1)
            by = y1
        if ay <= y1 and bx <= x1:
            d.line([(ax, ay), (bx, by)], fill=_a(col, alpha // 2), width=1)
        t += pitch
    # 치수선 (아래쪽)
    yd = y1 + 26
    d.line([(x0, yd), (x1, yd)], fill=_a(RIM, alpha), width=2)
    for xx in (x0, x1):
        d.line([(xx, yd - 10), (xx, yd + 10)], fill=_a(RIM, alpha), width=2)
    brackets(d, (x0, y0, x1, y1), arm=34, thick=3, col=RIM, alpha=alpha + 60)


def chapter_tag(d, xy, idx, total, text, pt=30, col=None):
    """★장 태그★ — [ 2 / 4 ]  방식.  브래킷 문법 재사용."""
    col = col or RIM
    f = font(pt, True)
    s = "[ %d / %d ]  %s" % (idx, total, text)
    tw, th = ink_wh(s, f)
    x, y = xy
    box = (x, y, x + tw + 34, y + th + 22)
    glass_panel(d, box, alpha=200, rim=col,
                rim_edges=("left",), rim_px=4)
    d.text((x + 17, y + 11), s, font=f, fill=_a(INK, 255), anchor="la")
    return box


# ────────────────────────────────────────────────────────────────────────
# 자막 (CEO-49 어절 경계 · 무음 시청 60% 대비 번인)
# ────────────────────────────────────────────────────────────────────────
def subtitle_block(d, lines, y, w, pt=58, lead=1.32, panel_w_max=0.86,
                   pad_x=40, pad_y=26, alpha=222):
    """자막 패널 + 흰 글자.  패널 폭 상한을 넘으면 pt 를 내린다.

    상한이 shorts916 의 0.633 보다 큰 이유: 이 파일은 ★화면 100%★ 영상 위에
    자막을 얹는다(레터박스 밴드가 없다). 승인 3장의 0.633 은 「16:9 프레임 안의
    패널」기준이고, 9:16 전체화면에서 같은 물리 폭은 비율이 커진다.
    (교훈 226: 임계는 물리량이어야 한다 — 여기서는 '읽을 수 있는 글자 높이'다.)
    """
    # ★재발 방지★ — wrap_words() 는 ★개행이 든 문자열★ 을 돌려준다.
    #   호출부가 [문자열] 로 감싸면 "한 줄" 로 취급되어 패널 높이는 1줄로
    #   계산되지만 PIL 은 개행을 렌더해 2줄을 그린다 -> 글자가 패널 밖으로
    #   삐져나온다. (이 세션 육안 검출. 게이트는 못 잡았다 = 교훈 223)
    #   따라서 ★여기서 정규화한다★: 문자열이면 나누고, 원소 안의 개행도 푼다.
    if isinstance(lines, str):
        lines = lines.split("\n")
    flat = []
    for ln in lines:
        flat.extend(str(ln).split("\n"))
    lines = [x for x in (t.strip() for t in flat) if x]
    if not lines:
        return None
    cur = pt
    while cur >= 34:
        f = font(cur, True)
        wmax = max([ink_wh(ln, f)[0] for ln in lines] or [0])
        if (wmax + 2 * pad_x) / float(w) <= panel_w_max:
            break
        cur -= 2
    f = font(cur, True)
    wmax = max([ink_wh(ln, f)[0] for ln in lines] or [0])
    hline = int(cur * lead)
    bx0 = (w - wmax) / 2.0 - pad_x
    bx1 = (w + wmax) / 2.0 + pad_x
    by0 = y - pad_y
    by1 = y + hline * len(lines) + pad_y - int(hline - cur)
    if bx0 < 8 or bx1 > w - 8:
        raise ValueError("subtitle panel out of frame: x %.0f..%.0f (w=%d)"
                         % (bx0, bx1, w))
    glass_panel(d, (bx0, by0, bx1, by1), alpha=alpha)
    yy = y
    for ln in lines:
        tw, _ = ink_wh(ln, f)
        d.text(((w - tw) / 2.0, yy), ln, font=f, fill=_a(INK, 255), anchor="la")
        yy += hline
    return (bx0, by0, bx1, by1, cur)


def hook_title(d, lines, y, w, pt=76, lead=1.22, rule=True):
    """0~3초 후킹 타이틀. 큰 글자 + 네온 룰."""
    f = font(pt, True)
    yy = y
    for ln in lines:
        tw, _ = ink_wh(ln, f)
        # 가독 보강: 어두운 후광
        for dx, dy in ((-3, 0), (3, 0), (0, -3), (0, 3)):
            d.text(((w - tw) / 2.0 + dx, yy + dy), ln, font=f,
                   fill=(0, 0, 0, 170), anchor="la")
        d.text(((w - tw) / 2.0, yy), ln, font=f, fill=_a(INK, 255), anchor="la")
        yy += int(pt * lead)
    if rule:
        half = int(w * 0.16)
        glow_line(d, [(w / 2 - half, yy + 16), (w / 2 + half, yy + 16)], thick=5)
    return yy


# ────────────────────────────────────────────────────────────────────────
# spec -> PNG
# ────────────────────────────────────────────────────────────────────────
def render_spec(spec, out, w=W_DEFAULT, h=H_DEFAULT):
    """선언적 spec 하나를 오버레이 PNG 로 굽는다.

    spec 키 (전부 선택):
      hud          bool
      chapter      (idx, total, text)
      hook         [줄]
      hook_y       int
      labels       [{anchor:[x,y], text:str, side:'right'|'left', pt:int, col:'rim'|'warn'|'heat'}]
      arrows       [{p0:[x,y], p1:[x,y], col:...}]
      lines        [{pts:[[x,y],...], thick:int, col:...}]
      warns        [{xy:[x,y], r:int}]
      numbers      [{xy:[x,y], value:str, unit:str, label:str, pt:int}]
      ticks        [{y:int, x0:int, x1:int}]
      sub          [줄]        자막
      sub_y        int
      cta          str
      cta_y        int
    """
    from PIL import Image, ImageDraw
    COL = {"rim": RIM, "core": CORE, "warn": WARN, "heat": HEAT,
           "struct": STRUCT, "ink": INK, "dim": DIM}
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    if spec.get("hud"):
        hud_frame(d, w, h)
    if spec.get("chapter"):
        i, t, s = spec["chapter"]
        chapter_tag(d, (spec.get("chapter_xy") or (46, 150)), i, t, s)
    if spec.get("grid"):
        g = spec["grid"] if isinstance(spec["grid"], dict) else {}
        measure_grid(d, w, h, step=g.get("step", 120), alpha=g.get("alpha", 42))
    for sec in (spec.get("sections") or []):
        section_marks(d, sec["box"], alpha=sec.get("alpha", 150),
                      pitch=sec.get("pitch", 64))
    if spec.get("strip"):
        data_strip(d, spec.get("strip_xy") or (52, 92), spec["strip"])
    if spec.get("progress") is not None:
        progress_bar(d, spec.get("progress_y", 60), 52, w - 52,
                     spec["progress"])
    for ln in spec.get("lines", []):
        glow_line(d, [tuple(p) for p in ln["pts"]], thick=ln.get("thick", 4),
                  col=COL.get(ln.get("col", "rim"), RIM),
                  alpha=ln.get("alpha", 255))
    for a in spec.get("arrows", []):
        arrow(d, tuple(a["p0"]), tuple(a["p1"]), thick=a.get("thick", 5),
              head=a.get("head", 26), col=COL.get(a.get("col", "rim"), RIM))
    for t in spec.get("ticks", []):
        tick_rule(d, t["y"], t["x0"], t["x1"], n=t.get("n", 10))
    for lb in spec.get("labels", []):
        leader_label(d, tuple(lb["anchor"]), lb["text"], pt=lb.get("pt", 34),
                     side=lb.get("side", "right"), gap=lb.get("gap", 110),
                     col=COL.get(lb.get("col", "rim"), RIM))
    for n in spec.get("numbers", []):
        numeric(d, tuple(n["xy"]), n["value"], n.get("unit", ""),
                pt=n.get("pt", 52), label=n.get("label", ""),
                col=COL.get(n.get("col", "core"), CORE))
    for wn in spec.get("warns", []):
        warn_icon(d, tuple(wn["xy"]), r=wn.get("r", 26))
    if spec.get("hook"):
        hook_title(d, spec["hook"], spec.get("hook_y", 236), w,
                   pt=spec.get("hook_pt", 76))
    if spec.get("sub"):
        subtitle_block(d, spec["sub"], spec.get("sub_y", 1470), w,
                       pt=spec.get("sub_pt", 58))
    if spec.get("cta"):
        f = font(spec.get("cta_pt", 46), True)
        tw, _ = ink_wh(spec["cta"], f)
        d.text(((w - tw) / 2.0, spec.get("cta_y", 1712)), spec["cta"],
               font=f, fill=_a(RIM, 255), anchor="la")

    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    im.save(out)
    return out


# ────────────────────────────────────────────────────────────────────────
def selfcheck():
    """교훈 230 규칙 3 — 도구는 자기검사를 갖는다."""
    from PIL import Image, ImageDraw
    ok = True

    def chk(name, cond, detail=""):
        nonlocal ok
        print("  %-42s %s %s" % (name, "OK  " if cond else "FAIL", detail))
        if not cond:
            ok = False

    print("overlay.selfcheck")
    # 1. 팔레트 참조가 승인값인가 (복제 금지 확인)
    chk("palette referenced from shorts916",
        (BG, PANEL, RIM, CORE, INK) ==
        (_s916.BG, _s916.PANEL, _s916.RIM, _s916.CORE, _s916.INK))
    # 2. 승인 문법 불변식 B >= G > R  — ★네온(RIM/CORE)에만 적용된다★
    #    PANEL(26,34,33) 은 승인 3장 픽셀 실측값이고 G(34) > B(33) 이다.
    #    첫 판은 PANEL 에도 같은 불변식을 걸었고 FAIL 이 났다. 승인값이
    #    불변식을 깨면 틀린 것은 ★내 불변식★ 이다 (교훈 131 역).
    #    패널의 참 불변식은 "충분히 어둡고, 냉색(G,B > R)이다" 이다.
    for nm, c in (("RIM", RIM), ("CORE", CORE)):
        chk("neon invariant B>=G>R  %s" % nm, c[2] >= c[1] > c[0], str(c))
    chk("PANEL dark & cool (G,B > R, max<=60)",
        PANEL[1] > PANEL[0] and PANEL[2] > PANEL[0] and max(PANEL) <= 60, str(PANEL))
    chk("PANEL darker than BG-contrast floor", max(PANEL) > max(BG), "%s > %s" % (PANEL, BG))
    # 3. 흰 글자 채널 편차 <= 6 (승인 실측)
    chk("INK channel spread <= 6", max(INK) - min(INK) <= 6, str(INK))
    # 4. 경고색은 R 우세여야 한다 (의미 분리)
    chk("WARN is red-dominant", WARN[0] > WARN[1] and WARN[0] > WARN[2], str(WARN))
    # 5. 조판 정본 참조 (어절 경계)
    got = wrap_words("나는 목적을 공유받고 실행 방식은 스스로 설계할 수 있는 환경에서 더 꾸준히 기여한다")
    joined = " ".join(x.strip() for x in (got if isinstance(got, (list, tuple)) else [got]))
    chk("wrap_words imported (CEO-49)", callable(wrap_words) and len(joined) > 10,
        "%d line(s)" % (len(got) if isinstance(got, (list, tuple)) else 1))
    # 6. 알파 bbox 계측 (교훈 193)
    f = font(60, True)
    w1, h1 = ink_wh("정답은 없습니다", f)
    w2, h2 = ink_wh("정답은 없습니다 정답은 없습니다", f)
    chk("ink_wh monotonic in text length", w2 > w1 * 1.7, "%d -> %d" % (w1, w2))
    chk("ink_wh height ~ font size", 0.55 * 60 <= h1 <= 1.25 * 60, "h=%d" % h1)
    # 7. 자막 패널이 폭 상한을 지키는가
    im = Image.new("RGBA", (1080, 1920), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    long_lines = ["회사 이름이나 연봉만 보면", "빠지기 쉬운 게 바로 이 문장입니다"]
    bx0, by0, bx1, by1, used_pt = subtitle_block(d, long_lines, 1470, 1080)
    frac = (bx1 - bx0) / 1080.0
    chk("subtitle panel within 0.86 W", frac <= 0.8605, "%.3f  pt=%d" % (frac, used_pt))
    chk("subtitle stays on-screen", bx0 >= 0 and bx1 <= 1080 and by1 <= 1920,
        "x %.0f..%.0f  y %.0f..%.0f" % (bx0, bx1, by0, by1))
    # 7c. ★측정 격자 + 단면 기호가 실제로 픽셀을 남기는가★
    im_g = Image.new("RGBA", (1080, 1920), (0, 0, 0, 0))
    d_g = ImageDraw.Draw(im_g)
    measure_grid(d_g, 1080, 1920, step=120)
    gb = im_g.split()[3].getbbox()
    chk("measure_grid draws inside frame",
        gb is not None and gb[0] >= 0 and gb[2] <= 1080 and gb[3] <= 1920,
        str(gb))
    im_s = Image.new("RGBA", (1080, 1920), (0, 0, 0, 0))
    d_s = ImageDraw.Draw(im_s)
    section_marks(d_s, (200, 800, 880, 1160))
    sb = im_s.split()[3].getbbox()
    chk("section_marks draws & stays near box",
        sb is not None and sb[0] >= 150 and sb[2] <= 930 and sb[3] <= 1230,
        str(sb))

    # 7b. ★개행이 든 문자열을 넘겨도 글자가 패널 안에 들어오는가★
    #     (이 세션 육안 검출 결함의 재발 방지 — 게이트가 못 잡은 차원)
    im_nl = Image.new("RGBA", (1080, 1920), (0, 0, 0, 0))
    d_nl = ImageDraw.Draw(im_nl)
    raw = wrap_words("나는 이런 방식으로 일할 수 있는 환경에서 더 꾸준히 기여한다.")
    nb = subtitle_block(d_nl, raw, 1418, 1080, pt=54)   # ★문자열 그대로★
    ab = im_nl.split()[3].getbbox()
    chk("newline-bearing input: glyphs inside panel",
        ab is not None and ab[1] >= nb[1] - 1 and ab[3] <= nb[3] + 1,
        "panel y %.0f..%.0f  ink y %s..%s"
        % (nb[1], nb[3], ab[1] if ab else "-", ab[3] if ab else "-"))
    chk("newline-bearing input: panel on-screen",
        nb[3] <= 1920 and nb[0] >= 0 and nb[2] <= 1080,
        "x %.0f..%.0f  y %.0f..%.0f" % (nb[0], nb[2], nb[1], nb[3]))
    # 8. 발광 라인: 코어가 림 안에 있는가 (픽셀 직독)
    im2 = Image.new("RGBA", (400, 120), (0, 0, 0, 255))
    d2 = ImageDraw.Draw(im2)
    glow_line(d2, [(20, 60), (380, 60)], thick=16)
    px = im2.load()
    col200 = [px[200, y][:3] for y in range(40, 82)]
    n_core = col200.count(CORE)
    n_rim = col200.count(RIM)
    # 코어 밴드가 림 밴드 안에 완전히 들어가야 한다 (양쪽에 림이 남는다).
    first_core = col200.index(CORE) if CORE in col200 else -1
    last_core = (len(col200) - 1 - col200[::-1].index(CORE)) if CORE in col200 else -1
    rim_above = any(c == RIM for c in col200[:first_core]) if first_core > 0 else False
    rim_below = any(c == RIM for c in col200[last_core + 1:]) if last_core >= 0 else False
    chk("glow core inside rim", n_core > 0 and n_rim > 0 and rim_above and rim_below,
        "core %d px / rim %d px" % (n_core, n_rim))
    # 9. spec -> PNG 왕복 + ffmpeg 합성 가능성
    tdir = "/home/user/lf/r3d/_ovtest"
    os.makedirs(tdir, exist_ok=True)
    p = render_spec({
        "hud": True, "chapter": (2, 4, "일하는 방식"),
        "hook": ["연봉만 보면", "놓치는 것"],
        "labels": [{"anchor": [340, 900], "text": "반복한 역할", "side": "right"},
                   {"anchor": [760, 1140], "text": "위험", "side": "left", "col": "warn"}],
        "arrows": [{"p0": [200, 1250], "p1": [520, 1080]}],
        "lines": [{"pts": [[80, 1320], [400, 1290], [700, 1330], [1000, 1280]], "thick": 5}],
        "warns": [{"xy": [880, 980], "r": 30}],
        "numbers": [{"xy": [90, 620], "value": "3", "unit": "문장", "label": "확인할 것"}],
        "ticks": [{"y": 1394, "x0": 80, "x1": 1000}],
        "sub": ["중요한 것은", "과장 없이 알아보는 것입니다"],
        "cta": "당신의 세 문장은?",
    }, "%s/spec.png" % tdir)
    im3 = Image.open(p)
    chk("render_spec size", im3.size == (1080, 1920), str(im3.size))
    chk("render_spec has ink", im3.getbbox() is not None)
    # 10. ffmpeg 로 실제 합성이 되는가
    base = "%s/base.png" % tdir
    Image.new("RGB", (1080, 1920), (28, 30, 32)).save(base)
    r = subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", base, "-i", p,
                        "-filter_complex", "[0:v][1:v]overlay=0:0:format=auto",
                        "-frames:v", "1", "%s/comp.png" % tdir],
                       capture_output=True, text=True)
    chk("ffmpeg overlay composite", r.returncode == 0, r.stderr.strip()[:80])
    print("SELFCHECK %s" % ("OK" if ok else "FAILED"))
    return 0 if ok else 1


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "selfcheck"
    if cmd == "selfcheck":
        sys.exit(selfcheck())
    elif cmd == "demo":
        out = sys.argv[2] if len(sys.argv) > 2 else "/home/user/lf/r3d/_ovtest/demo.png"
        render_spec({"hud": True, "hook": ["경력은 쌓였는데", "다음이 안 보인다"],
                     "sub": ["세 가지만 확인합니다"], "cta": "당신의 세 문장은?"}, out)
        print("DEMO %s" % out)
    else:
        raise SystemExit(__doc__)
