#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Instagram Coming Soon Carousel Builder
=======================================

Builds 7 slides (1080x1080) for the Life Portfolio Diary launch.

Pipeline:
  1. HTML/CSS template (per slide) using exact brand fonts/colors
  2. WeasyPrint -> PDF (1 page = 1 slide, 108mm x 108mm at 254 DPI for 1080px)
  3. PyMuPDF (fitz) -> PNG 1080x1080
  4. Save to ../carousel/slide_N.png

Brand:
  - BRG #0A3D2A (deep British Racing Green)
  - Gold #C9A04F
  - Off-white #F5F1E8
  - Cormorant Garamond (Latin, serif) + Noto Serif KR (Korean, serif)

Backgrounds: AI-generated illustrations placed via CSS background-image
             (slides 2-6 only; slides 1, 7 are pure typography).
"""

import os
import sys
from pathlib import Path
from weasyprint import HTML, CSS
import fitz  # PyMuPDF

BASE_DIR = Path(__file__).resolve().parent.parent
CAROUSEL_DIR = BASE_DIR / "carousel"
BG_DIR = CAROUSEL_DIR / "backgrounds"

# 1080px output at 254 DPI -> 108mm canvas
SLIDE_MM = 108
DPI = 254  # ~1080px / 108mm

# ---------------------------------------------------------------------------
# Common CSS
# ---------------------------------------------------------------------------
COMMON_CSS = """
@page {
    size: 108mm 108mm;
    margin: 0;
}
* { box-sizing: border-box; margin: 0; padding: 0; }

:root {
    --brg: #0A3D2A;
    --brg-dark: #062719;
    --gold: #C9A04F;
    --gold-soft: #D9B675;
    --cream: #F5F1E8;
    --cream-muted: rgba(245, 241, 232, 0.78);
}

html, body {
    width: 108mm;
    height: 108mm;
    font-family: 'Noto Serif CJK KR', 'Noto Serif CJK KR', serif;
    color: var(--cream);
    background: var(--brg);
    -webkit-font-smoothing: antialiased;
}

.slide {
    position: relative;
    width: 108mm;
    height: 108mm;
    overflow: hidden;
}

.bg-image {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
    background-size: cover;
    background-position: center center;
    z-index: 1;
}

.overlay {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
    z-index: 2;
}

/* dark gradient overlay for readability over photos */
.overlay-dark {
    background: linear-gradient(
        180deg,
        rgba(10, 61, 42, 0.72) 0%,
        rgba(10, 61, 42, 0.45) 35%,
        rgba(10, 61, 42, 0.55) 65%,
        rgba(10, 61, 42, 0.82) 100%
    );
}

.content {
    position: absolute;
    inset: 0;
    z-index: 3;
    padding: 14mm 12mm;
    display: flex;
    flex-direction: column;
}

.eyebrow {
    font-family: 'Cormorant Garamond', 'Noto Serif CJK KR', serif;
    font-size: 8pt;
    letter-spacing: 0.35em;
    color: var(--gold);
    text-transform: uppercase;
    font-weight: 500;
}

.headline {
    font-family: 'Noto Serif CJK KR', serif;
    font-weight: 500;
    color: var(--cream);
    line-height: 1.42;
    letter-spacing: -0.01em;
    word-break: keep-all;
    overflow-wrap: break-word;
}

.subline, .eyebrow {
    word-break: keep-all;
    overflow-wrap: break-word;
}

.subline {
    font-family: 'Noto Serif CJK KR', serif;
    font-weight: 400;
    color: var(--cream-muted);
    font-size: 9pt;
    letter-spacing: 0.05em;
    line-height: 1.6;
}

.footer {
    position: absolute;
    bottom: 6mm;
    left: 12mm;
    right: 12mm;
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-family: 'Cormorant Garamond', serif;
    font-size: 7pt;
    color: var(--gold-soft);
    letter-spacing: 0.25em;
    text-transform: uppercase;
    opacity: 0.85;
}

.page-num { font-variant-numeric: tabular-nums; }
.brand-mark { font-style: italic; opacity: 0.9; }

/* Decorative gold rule */
.gold-rule {
    width: 14mm;
    height: 0.4mm;
    background: var(--gold);
    margin: 0;
}

/* --- Slide 1 (Cover) -------------------------------------------------- */
.slide-1 .content {
    justify-content: center;
    align-items: center;
    text-align: center;
    background: radial-gradient(ellipse at center, #0e4a33 0%, #06291a 100%);
}
.slide-1 .eyebrow { margin-bottom: 8mm; }
.slide-1 .headline {
    font-size: 20pt;
    max-width: 96mm;
    margin-bottom: 7mm;
    line-height: 1.5;
    font-weight: 500;
}
.slide-1 .gold-rule { margin: 0 auto 6mm; width: 12mm; }
.slide-1 .subline {
    font-family: 'Cormorant Garamond', serif;
    font-style: italic;
    font-size: 11pt;
    letter-spacing: 0.18em;
    color: var(--gold-soft);
}

/* --- Slides 2-6 (with backgrounds) ------------------------------------ */
.slide-photo .content {
    justify-content: flex-end;
}
.slide-photo .eyebrow {
    margin-bottom: 4mm;
}
.slide-photo .headline {
    font-size: 14pt;
    max-width: 95mm;
    margin-bottom: 5mm;
    font-weight: 500;
    line-height: 1.55;
    text-shadow: 0 1px 10px rgba(0,0,0,0.55);
}
.headline .line {
    display: block;
    white-space: nowrap;
}
.slide-photo .gold-rule {
    margin-bottom: 4mm;
}
.slide-photo .subline {
    max-width: 80mm;
}

/* --- Slide 7 (Vision CTA) -------------------------------------------- */
.slide-7 .content {
    justify-content: center;
    align-items: center;
    text-align: center;
    background: radial-gradient(ellipse at center, #0e4a33 0%, #04200f 100%);
}
.slide-7 .eyebrow { margin-bottom: 9mm; color: var(--gold); }
.slide-7 .headline {
    font-size: 17pt;
    max-width: 96mm;
    line-height: 1.55;
    margin-bottom: 7mm;
    font-weight: 500;
}
.slide-7 .gold-rule { margin: 0 auto 6mm; width: 16mm; }
.slide-7 .subline {
    font-family: 'Noto Serif CJK KR', serif;
    font-size: 9.5pt;
    letter-spacing: 0.08em;
    color: var(--gold-soft);
}

/* Slide 6 emphasis */
.slide-6 .headline strong {
    color: var(--gold);
    font-weight: 500;
}
"""

# ---------------------------------------------------------------------------
# Slide definitions
# ---------------------------------------------------------------------------
SLIDES = [
    # 1 — Cover
    {
        "num": 1,
        "class": "slide-1",
        "bg": None,
        "eyebrow": "Coming Soon · 2026",
        "headline_lines": ["한 사람의 인생이,", "하나의 포트폴리오가", "되기까지."],
        "subline": "인생포트폴리오 커스텀 다이어리",
    },
    # 2 — Beginning (assessment)
    {
        "num": 2,
        "class": "slide-photo slide-2",
        "bg": "bg_slide2.png",
        "eyebrow": "Chapter 01 · Beginning",
        "headline_lines": ["먼저,", "고유함을 찾아가는", "도구를 만들었습니다."],
        "subline": "사명 · 비전 · 4SE 응답 · 추천 진로/직업",
    },
    # 3 — Place (homepage)
    {
        "num": 3,
        "class": "slide-photo slide-3",
        "bg": "bg_slide3.png",
        "eyebrow": "Chapter 02 · Place",
        "headline_lines": ["그 도구를", "만나는 자리를", "만들었습니다."],
        "subline": "온라인에서, 언제든.",
    },
    # 4 — Reach (global)
    {
        "num": 4,
        "class": "slide-photo slide-4",
        "bg": "bg_slide4.png",
        "eyebrow": "Chapter 03 · Reach",
        "headline_lines": ["국내외 누구나,", "결제 즉시 검사와", "결과를 받습니다."],
        "subline": "Anywhere · Anytime",
    },
    # 5 — Now (diary)
    {
        "num": 5,
        "class": "slide-photo slide-5",
        "bg": "bg_slide6.png",  # diary product shot
        "eyebrow": "Chapter 04 · Now",
        "headline_lines": [
            "이제, 검사 결과지가",
            "매일의 자리에서 함께",
            "살아낼 수 있도록,",
            "다이어리를 만들고 있습니다.",
        ],
        "subline": "",
    },
    # 6 — Vision (CTA)
    {
        "num": 6,
        "class": "slide-7",  # reuses vision layout
        "bg": None,
        "eyebrow": "Life Portfolio",
        "headline_lines": ["발견이 살아낸 삶이 되고,", "그 삶이 누군가의", "양식으로 남도록."],
        "subline": "이 여정에 함께 머물러주세요.",
    },
]


# ---------------------------------------------------------------------------
# Render
# ---------------------------------------------------------------------------
def render_slide_html(slide):
    bg_block = ""
    overlay_class = ""
    if slide["bg"]:
        bg_path = (BG_DIR / slide["bg"]).resolve().as_uri()
        bg_block = f'<div class="bg-image" style="background-image:url(\'{bg_path}\')"></div>'
        overlay_class = "overlay-dark"

    if "headline_lines" in slide:
        headline_html = "".join(
            f'<span class="line">{line}</span>' for line in slide["headline_lines"]
        )
    else:
        headline_html = slide["headline"]

    subline_block = ""
    if slide.get("subline"):
        subline_block = (
            '<div class="gold-rule"></div>'
            f'<div class="subline">{slide["subline"]}</div>'
        )

    return f"""<!doctype html>
<html lang="ko">
<head><meta charset="utf-8"><title>slide {slide['num']}</title></head>
<body>
  <div class="slide {slide['class']}">
    {bg_block}
    <div class="overlay {overlay_class}"></div>
    <div class="content">
      <div class="eyebrow">{slide['eyebrow']}</div>
      <div class="gold-rule"></div>
      <div class="headline">{headline_html}</div>
      {subline_block}
    </div>
    <div class="footer">
      <span class="brand-mark">Life Portfolio · Coming Soon</span>
      <span class="page-num">{slide['num']:02d} / 06</span>
    </div>
  </div>
</body>
</html>
"""


def build_slide(slide):
    html_str = render_slide_html(slide)
    pdf_path = CAROUSEL_DIR / f"_slide_{slide['num']}.pdf"
    png_path = CAROUSEL_DIR / f"slide_{slide['num']}.png"

    HTML(string=html_str, base_url=str(BASE_DIR)).write_pdf(
        str(pdf_path),
        stylesheets=[CSS(string=COMMON_CSS)],
    )

    # PDF -> PNG via PyMuPDF
    doc = fitz.open(str(pdf_path))
    page = doc[0]
    # Calculate zoom for 1080x1080 (108mm at 72dpi = 306pt; we want 1080px -> zoom = 1080/306)
    zoom = 1080 / page.rect.width
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    pix.save(str(png_path))
    doc.close()
    pdf_path.unlink()  # remove intermediate pdf

    return png_path


def main():
    CAROUSEL_DIR.mkdir(exist_ok=True)
    print(f"Building {len(SLIDES)} carousel slides...")
    for slide in SLIDES:
        out = build_slide(slide)
        size_kb = out.stat().st_size / 1024
        print(f"  ✓ slide_{slide['num']}.png ({size_kb:.0f} KB)")
    print(f"\nAll done → {CAROUSEL_DIR}")


if __name__ == "__main__":
    main()
