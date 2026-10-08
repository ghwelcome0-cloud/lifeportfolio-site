#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ovl.py — 숏츠 #1 오버레이 v3 (벤치마크 `yZCWO5Nxeog` 계측 준거).

기존 overlay.py 의 HUD 계열(measure_grid / hud_frame / progress_bar / 시안 글로우)
은 ★쓰지 않는다★. 벤치마크 실측은 다음과 같다.

  · 흰 얇은 산세리프, 프레임 높이의 2~3%
  · ★얇은 빨강 리더선 + 원형 앵커★  (지시선. 굵지 않다)
  · 빨강 구역 박스 / 흐름 화살표
  · 밀도 ★minimal★ — 한 화면에 오브젝트 1~2개
  · 등장 ★0.5초 페이드★

따라서 v3 는 프리미티브를 3개만 둔다: 자막 / 리더 라벨 / CTA.
컷별 배치는 cutsheet.CUTS 의 sub 를 그대로 쓴다 (교훈 176 · 224).

출력: work/ov/ov_%04d.png (RGBA 1080x1920) 를 컷마다 1장씩. 페이드는
ffmpeg 쪽에서 alpha 로 처리하지 않고, ★컷마다 정지 오버레이 1장 + fade 필터★
로 처리한다 (프레임 1464장을 PNG 로 굽지 않기 위해서다. 디스크 6.3G 뿐이다).

CLI
  python3 ovl.py selfcheck
  python3 ovl.py build
"""
import os, sys, importlib.util
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = HERE + "/work"
OVD  = WORK + "/ov"

W, H = 1080, 1920

FONT_B = "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf"
FONT_R = "/usr/share/fonts/truetype/nanum/NanumGothic.ttf"

# 벤치마크 팔레트
WHITE = (255, 255, 255, 255)
RED   = (216, 58, 48, 255)          # 테크니컬 그래픽 빨강
SHADE = (0, 0, 0, 128)              # 자막 가독용 아주 옅은 받침

# 자막 크기: 프레임 높이의 2.6% → 1920*0.026 ≈ 50px
SUB_PX   = 50
LABEL_PX = 38
CTA_PX   = 56


def _load_cutsheet():
    spec = importlib.util.spec_from_file_location("cutsheet", HERE + "/cutsheet.py")
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


CS = _load_cutsheet()


def _f(px, bold=True):
    return ImageFont.truetype(FONT_B if bold else FONT_R, px)


def _tw(d, s, f):
    b = d.textbbox((0, 0), s, font=f)
    return b[2] - b[0], b[3] - b[1]


def wrap(d, s, f, maxw):
    """어절 단위 줄바꿈. 리스트를 반환한다 (교훈 235 — 문자열 아님에 주의)."""
    words, lines, cur = s.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if _tw(d, t, f)[0] <= maxw or not cur:
            cur = t
        else:
            lines.append(cur); cur = w
    if cur:
        lines.append(cur)
    return lines


def subtitle(d, text, y_center):
    """흰 얇은 산세리프 자막. 하단 안전영역 위에 배치."""
    f = _f(SUB_PX, bold=True)
    lines = wrap(d, text, f, int(W * 0.82))
    lh = int(SUB_PX * 1.34)
    total = lh * len(lines)
    y = y_center - total // 2
    for ln in lines:
        tw, _ = _tw(d, ln, f)
        x = (W - tw) // 2
        # 받침: 아주 옅은 어두운 띠. 벤치마크에도 밝은 배경 위 흰 글자를
        # 읽히게 하는 최소한의 처리는 있다.
        d.rounded_rectangle([x - 22, y - 10, x + tw + 22, y + lh - 10],
                            radius=6, fill=SHADE)
        d.text((x, y), ln, font=f, fill=WHITE)
        y += lh
    return y


def leader(d, anchor, text, side="right"):
    """빨강 리더선 + 원형 앵커 + 흰 라벨. 벤치마크의 핵심 그래픽 언어."""
    ax, ay = anchor
    r = 13
    d.ellipse([ax - r, ay - r, ax + r, ay + r], outline=RED, width=3)
    d.ellipse([ax - 3, ay - 3, ax + 3, ay + 3], fill=RED)
    dx = 150 if side == "right" else -150
    mx, my = ax + dx, ay - 90
    ex = mx + (170 if side == "right" else -170)
    ex = max(24 + 14, min(ex, W - 24 - 14))
    d.line([ax + (r if side == "right" else -r), ay, mx, my], fill=RED, width=2)
    d.line([mx, my, ex, my], fill=RED, width=2)
    f = _f(LABEL_PX, bold=True)
    tw, th = _tw(d, text, f)
    tx = ex + 12 if side == "right" else ex - 12 - tw
    ty = my - th - 14
    # ★2차 육안 결함 수정: side="left" 일 때 라벨이 프레임 왼쪽으로 잘려 나갔다.
    #   ("1층 = 문서 1장" 이 "층 = 문서 1장" 으로 보였다) 안전 여백 안으로 클램프한다.
    MARGIN = 24
    tx = max(MARGIN + 14, min(tx, W - MARGIN - 14 - tw))
    # ★육안 결함 수정: 밝은 회색 배경 위 흰 라벨은 읽히지 않는다.
    #   벤치마크도 라벨 뒤에 옅은 어두운 판을 깐다. 자막 받침과 같은 값을 쓴다.
    d.rounded_rectangle([tx - 14, ty - 8, tx + tw + 14, ty + th + 12],
                        radius=5, fill=SHADE)
    d.text((tx, ty), text, font=f, fill=WHITE)


def cta(d, line1, line2):
    """마지막 컷 전용. 하단 1/3 중앙."""
    f1 = _f(CTA_PX, bold=True)
    f2 = _f(int(CTA_PX * 0.72), bold=False)
    y = int(H * 0.72)
    # ★육안 결함 수정: 두 줄 각각에 판을 깔면 답답하다. 한 덩어리로 깐다.
    tw1, th1 = _tw(d, line1, f1)
    tw2, th2 = _tw(d, line2, f2)
    bw = max(tw1, tw2)
    bx = (W - bw) // 2
    gap = 30
    # ★육안 3회전 수정★ C9 배경(밝은 종이 지층) 위에서 alpha 150 은 둘째 줄이 묻혔다.
    # 판 불투명도를 올리고, 둘째 줄에도 별도 받침을 겹쳐 콘트라스트를 확보한다.
    d.rounded_rectangle([bx - 40, y - 26, bx + bw + 40, y + th1 + gap + th2 + 30],
                        radius=10, fill=(0, 0, 0, 205))
    d.rounded_rectangle([(W - tw2) // 2 - 16, y + th1 + gap - 8,
                         (W + tw2) // 2 + 16, y + th1 + gap + th2 + 10],
                        radius=6, fill=(0, 0, 0, 150))
    # 빨강 악센트는 판 위쪽 모서리에 얇게 — 텍스트에 붙지 않는다.
    d.rectangle([bx - 40, y - 26, bx - 34, y + th1 + gap + th2 + 30], fill=RED)
    d.text(((W - tw1) // 2, y), line1, font=f1, fill=WHITE)
    d.text(((W - tw2) // 2, y + th1 + gap), line2, font=f2, fill=(255, 255, 255, 255))


# 컷별 리더선 앵커. 카메라가 가리키는 「층」을 지시한다.
# (교훈 260 — 나레이션이 지시하는 층을 그래픽이 짚어야 몰입이 생긴다)
# ★육안 검증 후 재배치★. 초판은 허공/프레임밖을 짚었다.
# 좌표는 각 컷 대표 프레임을 실제로 보고 「종이 지층이 노출된 지점」에 맞췄다.
LEADERS = {
    "C3": ((150, 980),  "절단면",         "right"),
    "C4": ((560, 900),  "1층 = 문서 1장", "left"),
    "C5": ((430, 1000), "가장 오래된 층", "right"),
    "C6": ((560, 1250), "가장 최근 층",   "left"),
}


def build():
    os.makedirs(OVD, exist_ok=True)
    rows = CS.plan()
    made = []
    for i, r in enumerate(rows):
        im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        if r["id"] == "C9":
            cta(d, "lifeportfolio.co.kr", "10년치 산출물을 한 페이지로")
        else:
            if r["id"] in LEADERS:
                a, t, s = LEADERS[r["id"]]
                leader(d, a, t, s)
            subtitle(d, r["sub"], int(H * 0.845))
        p = "%s/ov_%02d_%s.png" % (OVD, i, r["id"])
        im.save(p)
        made.append(p)
        print("  ov %s  %s" % (r["id"], os.path.basename(p)))
    print("OVL OK %d" % len(made))
    return 0


def selfcheck():
    ok, n = 0, 0
    for p in (FONT_B, FONT_R):
        n += 1; ok += 1 if os.path.exists(p) else 0
        print("  font %-60s %s" % (p, "OK" if os.path.exists(p) else "MISSING"))
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    n += 1; subtitle(d, "테스트 자막 어절 단위 줄바꿈 확인용 문자열입니다", int(H * .845)); ok += 1
    n += 1; leader(d, (330, 700), "절단면", "right"); ok += 1
    n += 1; cta(d, "lifeportfolio.co.kr", "10년치 산출물을 한 페이지로"); ok += 1
    n += 1; assert len(CS.plan()) == 9; ok += 1
    n += 1; assert all(k in [r["id"] for r in CS.plan()] for k in LEADERS); ok += 1
    print("SELFCHECK %d/%d" % (ok, n))
    return 0 if ok == n else 1


if __name__ == "__main__":
    c = sys.argv[1] if len(sys.argv) > 1 else "selfcheck"
    raise SystemExit({"selfcheck": selfcheck, "build": build}[c]())
