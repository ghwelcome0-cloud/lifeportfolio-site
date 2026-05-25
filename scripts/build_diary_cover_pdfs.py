#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
인생포트폴리오 맞춤형 다이어리 v1.4.2 — 표지 인쇄 직행 PDF 빌더
─────────────────────────────────────────────────────────────────
v1.4.2 변경:
- 색상: Navy #1B2A4A → British Racing Green #0A3D2A (고급 초록)
- 'L' 로고 박스 완전 제거 (텍스트 3요소만 유지)
- 영문 헤드라인 폰트: Cormorant Garamond (고급 세리프)
- 한글: Noto Serif CJK KR
─────────────────────────────────────────────────────────────────
출력:
  manufacturer-handoff-v1.4/print-ready/cover_front.pdf
  manufacturer-handoff-v1.4/print-ready/cover_back.pdf

사양:
- 표지 trim: A5 (148 × 210 mm) + 3mm 도련 = 154 × 216 mm
- 색상: BRG #0A3D2A + Gold #C9A04F (2도 인쇄)
- 후가공: 금박 박표지 (LIFE PORTFOLIO / 인생포트폴리오 / Only One)
         — 형압 'L' 로고 사용 안 함
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "docs/strategy/diary/manufacturer-handoff-v1.4/print-ready"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# 색상
BRG = "#0A3D2A"      # British Racing Green
GOLD = "#C9A04F"

# ════════════════════════════════════════════════════════════════
# 앞표지 CSS
# ════════════════════════════════════════════════════════════════
COVER_CSS_FRONT = f"""
@page {{
    size: 154mm 216mm;
    margin: 0;
    bleed: 3mm;
    marks: crop;
}}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
html, body {{
    width: 154mm; height: 216mm;
    background: {BRG};
    color: {GOLD};
    font-family: "Cormorant Garamond", "Noto Serif CJK KR", serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
}}
.cover {{
    width: 154mm; height: 216mm;
    background: {BRG};
    position: relative;
}}

/* 상단 골드 디바이더 라인 (얇은 가로선) */
.cover .top-rule {{
    position: absolute;
    top: 60mm;
    left: 50%;
    transform: translateX(-50%);
    width: 38mm;
    height: 0.4mm;
    background: {GOLD};
}}

/* 중앙 영역 (브랜드 텍스트) */
.cover .center {{
    position: absolute;
    top: 72mm;
    left: 0;
    right: 0;
    text-align: center;
}}

/* LIFE PORTFOLIO (Cormorant Garamond — 고급 세리프) */
.cover .brand-en {{
    font-family: "Cormorant Garamond", "Noto Serif CJK KR", serif;
    font-weight: 400;
    font-size: 26pt;
    color: {GOLD};
    letter-spacing: 0.28em;
    line-height: 1;
}}

/* 인생포트폴리오 (한글) */
.cover .brand-kr {{
    font-family: "Noto Serif CJK KR", serif;
    font-weight: 500;
    font-size: 12pt;
    color: {GOLD};
    letter-spacing: 0.12em;
    margin-top: 9mm;
    opacity: 0.88;
}}

/* 하단 골드 디바이더 라인 */
.cover .bot-rule {{
    position: absolute;
    bottom: 60mm;
    left: 50%;
    transform: translateX(-50%);
    width: 38mm;
    height: 0.4mm;
    background: {GOLD};
}}

/* 'Only One' 카피 (하단) — Cormorant 이탤릭으로 고급화 */
.cover .only-one {{
    position: absolute;
    bottom: 38mm;
    left: 0; right: 0;
    text-align: center;
    font-family: "Cormorant Garamond", "Noto Serif CJK KR", serif;
    font-style: italic;
    font-weight: 500;
    font-size: 14pt;
    color: {GOLD};
    letter-spacing: 0.35em;
}}

/* Undated 태그 */
.cover .undated {{
    position: absolute;
    bottom: 48mm;
    left: 0; right: 0;
    text-align: center;
    font-family: "Cormorant Garamond", "Noto Sans CJK KR", sans-serif;
    font-weight: 500;
    font-size: 7.5pt;
    color: {GOLD};
    letter-spacing: 0.32em;
    opacity: 0.7;
}}
"""

COVER_HTML_FRONT = """<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><title>Cover Front · v1.4.2</title>
<style>{css}</style></head>
<body>
<div class="cover">
    <div class="top-rule"></div>
    <div class="center">
        <div class="brand-en">LIFE PORTFOLIO</div>
        <div class="brand-kr">인생포트폴리오 맞춤형 다이어리</div>
    </div>
    <div class="bot-rule"></div>
    <div class="undated">UNDATED · 만년형</div>
    <div class="only-one">Only One</div>
</div>
</body></html>""".format(css=COVER_CSS_FRONT)


# ════════════════════════════════════════════════════════════════
# 뒤표지 CSS
# ════════════════════════════════════════════════════════════════
COVER_CSS_BACK = f"""
@page {{
    size: 154mm 216mm;
    margin: 0;
    bleed: 3mm;
    marks: crop;
}}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
html, body {{
    width: 154mm; height: 216mm;
    background: {BRG};
    color: {GOLD};
    font-family: "Cormorant Garamond", "Noto Sans CJK KR", sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
}}
.cover {{
    width: 154mm; height: 216mm;
    background: {BRG};
    position: relative;
    padding: 18mm 14mm;
}}
.tagline {{
    font-family: "Noto Serif CJK KR", serif;
    font-weight: 400;
    font-size: 11pt;
    color: {GOLD};
    line-height: 2;
    text-align: center;
    margin-top: 38mm;
    letter-spacing: 0.05em;
}}
.tagline .em {{
    font-weight: 700;
    font-size: 12pt;
}}
.bottom {{
    position: absolute;
    bottom: 18mm;
    left: 14mm;
    right: 14mm;
    text-align: center;
}}
.bottom .made-for {{
    font-family: "Cormorant Garamond", "Noto Serif CJK KR", serif;
    font-style: italic;
    font-size: 9pt;
    color: {GOLD};
    opacity: 0.75;
    letter-spacing: 0.18em;
    margin-bottom: 4mm;
}}
.bottom .meta {{
    font-family: "Cormorant Garamond", "Noto Sans CJK KR", sans-serif;
    font-size: 7pt;
    color: {GOLD};
    opacity: 0.55;
    letter-spacing: 0.22em;
}}
"""

COVER_HTML_BACK = """<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><title>Cover Back · v1.4.2</title>
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

    print("[INFO] 앞표지 렌더링 (BRG #0A3D2A + Cormorant Garamond, L 로고 없음)...")
    HTML(string=COVER_HTML_FRONT).write_pdf(str(front_pdf))
    print(f"[OK] {front_pdf}  ({front_pdf.stat().st_size / 1024:.1f} KB)")

    print("[INFO] 뒤표지 렌더링...")
    HTML(string=COVER_HTML_BACK).write_pdf(str(back_pdf))
    print(f"[OK] {back_pdf}  ({back_pdf.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    build()
