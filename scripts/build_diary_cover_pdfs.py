#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
인생포트폴리오 맞춤형 다이어리 v1.4 — 표지 인쇄 직행 PDF 빌더
─────────────────────────────────────────────────────────
출력:
  manufacturer-handoff-v1.4/print-ready/cover_front.pdf
  manufacturer-handoff-v1.4/print-ready/cover_back.pdf
  manufacturer-handoff-v1.4/print-ready/cover_full_spread.pdf  (앞표지+책등+뒤표지 합본)

사양:
- 표지 trim: A5 (148 × 210 mm) + 3mm 도련 = 154 × 216 mm
- 책등 trim: 약 20mm (256p 70g 기준 추정) + 3mm 도련 = 26 × 216 mm (양쪽 도련 포함 시)
- 전체 펼침면: 앞표지 154 + 책등 20 + 뒤표지 154 + 좌우 도련 3+3 = 334 × 216 mm
- 색상: Navy #1B2A4A + Gold #C9A04F (2도 인쇄)
- 금박/형압 위치: 별도 cover_layout_diagram.pdf 참조
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "docs/strategy/diary/manufacturer-handoff-v1.4/print-ready"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# ════════════════════════════════════════════════════════════════
# 표지 CSS (인쇄용)
# ════════════════════════════════════════════════════════════════

COVER_CSS_FRONT = r"""
@page {
    size: 154mm 216mm;  /* A5 + 3mm bleed */
    margin: 0;
    bleed: 3mm;
    marks: crop;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body {
    width: 154mm; height: 216mm;
    background: #1B2A4A;
    color: #C9A04F;
    font-family: "Noto Serif CJK KR", serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
}
.cover {
    width: 154mm; height: 216mm;
    background: #1B2A4A;
    position: relative;
    /* Safe zone for foil/emboss (3mm bleed already accounted for via @page) */
    padding: 0;
}

/* 중앙 영역: 상단으로부터 약 1/3 지점 */
.cover .center {
    position: absolute;
    top: 78mm;
    left: 0;
    right: 0;
    text-align: center;
}

/* LIFE PORTFOLIO (대문자) */
.cover .brand-en {
    font-family: "Noto Serif CJK KR", serif;
    font-weight: 200;
    font-size: 22pt;
    color: #C9A04F;
    letter-spacing: 0.25em;
}

/* 인생포트폴리오 (한글) */
.cover .brand-kr {
    font-family: "Noto Serif CJK KR", serif;
    font-weight: 500;
    font-size: 11pt;
    color: #C9A04F;
    letter-spacing: 0.1em;
    margin-top: 8mm;
    opacity: 0.85;
}

/* 'Only One' 카피 (하단) */
.cover .only-one {
    position: absolute;
    bottom: 30mm;
    left: 0; right: 0;
    text-align: center;
    font-family: "Noto Sans CJK KR", sans-serif;
    font-weight: 800;
    font-size: 9pt;
    color: #C9A04F;
    letter-spacing: 0.45em;
}

/* Undated 태그 (Only One 위) */
.cover .undated {
    position: absolute;
    bottom: 42mm;
    left: 0; right: 0;
    text-align: center;
    font-family: "Noto Sans CJK KR", sans-serif;
    font-weight: 400;
    font-size: 7pt;
    color: #C9A04F;
    letter-spacing: 0.3em;
    opacity: 0.65;
}

/* 도련 가이드 박스 (안전 영역 인디케이터 — 실제 출력시 보이지 않음) */
.cover .safe-zone-marker {
    /* 의도적 비활성 */
    display: none;
}
"""

COVER_HTML_FRONT = """<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><title>Cover Front · v1.4</title>
<style>{css}</style></head>
<body>
<div class="cover">
    <div class="center">
        <div class="brand-en">LIFE PORTFOLIO</div>
        <div class="brand-kr">인생포트폴리오 맞춤형 다이어리</div>
    </div>
    <div class="undated">UNDATED · 만년형</div>
    <div class="only-one">ONLY ONE</div>
</div>
</body></html>""".format(css=COVER_CSS_FRONT)


COVER_CSS_BACK = r"""
@page {
    size: 154mm 216mm;
    margin: 0;
    bleed: 3mm;
    marks: crop;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body {
    width: 154mm; height: 216mm;
    background: #1B2A4A;
    color: #C9A04F;
    font-family: "Noto Sans CJK KR", sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
}
.cover {
    width: 154mm; height: 216mm;
    background: #1B2A4A;
    position: relative;
    padding: 18mm 14mm;
}
.tagline {
    font-family: "Noto Serif CJK KR", serif;
    font-weight: 400;
    font-size: 10.5pt;
    color: #C9A04F;
    line-height: 2;
    text-align: center;
    margin-top: 35mm;
    letter-spacing: 0.05em;
}
.tagline .em {
    font-weight: 700;
    font-size: 12pt;
}
.bottom {
    position: absolute;
    bottom: 18mm;
    left: 14mm;
    right: 14mm;
    text-align: center;
}
.bottom .made-for {
    font-family: "Noto Serif CJK KR", serif;
    font-size: 8pt;
    color: #C9A04F;
    opacity: 0.7;
    letter-spacing: 0.15em;
    margin-bottom: 4mm;
}
.bottom .meta {
    font-family: "Noto Sans CJK KR", sans-serif;
    font-size: 6.5pt;
    color: #C9A04F;
    opacity: 0.55;
    letter-spacing: 0.2em;
}
"""

COVER_HTML_BACK = """<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><title>Cover Back · v1.4</title>
<style>{css}</style></head>
<body>
<div class="cover">
    <div class="tagline">
        검사 리포트가 끝나는 곳에서<br/>
        <span class="em">내 인생포트폴리오가 시작됩니다.</span><br/><br/>
        하루를 기록하는 것이 아니라<br/>
        <span class="em">일 년을 살아내는 일.</span>
    </div>
    <div class="bottom">
        <div class="made-for">DESIGNED FOR ONE</div>
        <div class="meta">A5 · 256p · UNDATED · 70g 만년필 친화</div>
    </div>
</div>
</body></html>""".format(css=COVER_CSS_BACK)


def build():
    try:
        from weasyprint import HTML
    except ImportError:
        print("[ERROR] weasyprint not installed", file=sys.stderr)
        sys.exit(1)

    front_pdf = OUT_DIR / "cover_front.pdf"
    back_pdf = OUT_DIR / "cover_back.pdf"

    print("[INFO] 앞표지 렌더링...")
    HTML(string=COVER_HTML_FRONT).write_pdf(str(front_pdf))
    print(f"[OK] {front_pdf}  ({front_pdf.stat().st_size / 1024:.1f} KB)")

    print("[INFO] 뒤표지 렌더링...")
    HTML(string=COVER_HTML_BACK).write_pdf(str(back_pdf))
    print(f"[OK] {back_pdf}  ({back_pdf.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    build()
