#!/usr/bin/env python3
"""
업무매뉴얼 PDF 생성 스크립트 (v1.2)
- docs/PRODUCTION_RULES_v1.2.md → docs/manual/업무매뉴얼_v1.2_2026-05-06.pdf
- weasyprint + markdown 사용
"""
import os
import sys
from pathlib import Path

import markdown
from weasyprint import HTML, CSS
from weasyprint.text.fonts import FontConfiguration

ROOT = Path(__file__).resolve().parent.parent
SRC_MD = ROOT / "docs" / "PRODUCTION_RULES_v1.2.md"
OUT_DIR = ROOT / "docs" / "manual"
OUT_PDF = OUT_DIR / "업무매뉴얼_v1.2_2026-05-06.pdf"

OUT_DIR.mkdir(parents=True, exist_ok=True)

md_text = SRC_MD.read_text(encoding="utf-8")

# Markdown → HTML
html_body = markdown.markdown(
    md_text,
    extensions=["tables", "fenced_code", "toc", "sane_lists", "nl2br"],
)

# 표지 + 본문
COVER = """
<section class="cover">
  <div class="cover-brand">인생포트폴리오 / Life Portfolio</div>
  <h1 class="cover-title">맞춤형 실행프로그램 제작 규칙서<br/>업무매뉴얼 v1.2</h1>
  <div class="cover-sub">
    인생포트폴리오 · 맞춤 실행프로그램 · 진로/교육 매핑<br/>
    수동 제작 워크플로우(Excel→Word→PowerPoint→PDF→이메일) 표준 규격
  </div>
  <div class="cover-meta">
    <div>제정일 · 2026-05-06</div>
    <div>모범 출력 기준 · 김영식 케이스</div>
    <div>적용 PR · #63 · #64 · #65 · #66 · #67</div>
    <div>루브릭 · 130점 만점</div>
  </div>
  <div class="cover-foot">
    응답 데이터 출처 — 구글 스프레드시트 「인생포트폴리오 응답 마스터」<br/>
    Sheet ID · 1jd0h64K2E0g7B5-aOZD0e2sNDmvOQshYiGHROgmHSCM
  </div>
</section>
"""

html_doc = f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>업무매뉴얼 v1.2 — 인생포트폴리오</title>
</head>
<body>
{COVER}
<main class="content">
{html_body}
</main>
</body>
</html>
"""

CSS_TEXT = """
@page {
  size: A4;
  margin: 22mm 18mm 22mm 18mm;
  @top-left {
    content: "인생포트폴리오 · 업무매뉴얼 v1.2";
    font-size: 9pt;
    color: #6b6258;
  }
  @top-right {
    content: "2026-05-06";
    font-size: 9pt;
    color: #6b6258;
  }
  @bottom-center {
    content: counter(page) " / " counter(pages);
    font-size: 9pt;
    color: #6b6258;
  }
}
@page :first {
  margin: 0;
  @top-left { content: ""; }
  @top-right { content: ""; }
  @bottom-center { content: ""; }
}

* { box-sizing: border-box; }

@font-face {
  font-family: "NotoKR";
  src: url("file:///usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc") format("truetype-collection");
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: "NotoKR";
  src: url("file:///usr/share/fonts/opentype/noto/NotoSansCJK-Medium.ttc") format("truetype-collection");
  font-weight: 500;
  font-style: normal;
}
@font-face {
  font-family: "NotoKR";
  src: url("file:///usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc") format("truetype-collection");
  font-weight: 700;
  font-style: normal;
}
@font-face {
  font-family: "NotoKR";
  src: url("file:///usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc") format("truetype-collection");
  font-weight: 900;
  font-style: normal;
}
@font-face {
  font-family: "NotoKRMono";
  src: url("file:///usr/share/fonts/truetype/nanum/NanumGothicCoding.ttf") format("truetype");
  font-weight: 400;
  font-style: normal;
}

body {
  font-family: "NotoKR", "Noto Sans CJK KR", "Noto Sans KR", "NanumGothic", sans-serif;
  font-size: 10.5pt;
  line-height: 1.65;
  color: #2a2620;
  margin: 0;
  padding: 0;
}

/* 표지 */
.cover {
  page-break-after: always;
  height: 297mm;
  padding: 50mm 25mm 25mm 25mm;
  background: linear-gradient(160deg, #f7f2ea 0%, #ede4d3 60%, #d9c9a8 100%);
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  color: #2a2620;
}
.cover-brand {
  font-size: 12pt;
  letter-spacing: 0.3em;
  color: #8a6f3d;
  font-weight: 600;
  margin-bottom: 30mm;
}
.cover-title {
  font-size: 30pt;
  font-weight: 800;
  line-height: 1.35;
  margin: 0 0 14mm 0;
  color: #1f1a14;
}
.cover-sub {
  font-size: 12pt;
  line-height: 1.7;
  color: #4a3f30;
  margin-bottom: 25mm;
  max-width: 150mm;
}
.cover-meta {
  font-size: 11pt;
  line-height: 2;
  color: #2a2620;
  border-left: 3px solid #8a6f3d;
  padding-left: 6mm;
  margin-bottom: 30mm;
}
.cover-meta div { margin: 0; }
.cover-foot {
  margin-top: auto;
  font-size: 9.5pt;
  color: #6b6258;
  border-top: 1px solid #b8a47a;
  padding-top: 5mm;
}

/* 본문 */
.content {
  padding: 0;
}

h1 {
  font-size: 20pt;
  color: #8a6f3d;
  border-bottom: 2px solid #d9c9a8;
  padding-bottom: 4mm;
  margin: 12mm 0 8mm 0;
  page-break-after: avoid;
}
h2 {
  font-size: 15pt;
  color: #1f1a14;
  border-left: 4px solid #8a6f3d;
  padding: 1mm 0 1mm 4mm;
  margin: 10mm 0 4mm 0;
  page-break-after: avoid;
}
h3 {
  font-size: 12pt;
  color: #4a3f30;
  margin: 7mm 0 2mm 0;
  page-break-after: avoid;
}
h4 {
  font-size: 11pt;
  color: #4a3f30;
  margin: 5mm 0 1mm 0;
  page-break-after: avoid;
}

p { margin: 2mm 0 3mm 0; }

ul, ol { margin: 2mm 0 4mm 6mm; padding-left: 2mm; }
li { margin: 0.8mm 0; }

strong { color: #6e5828; font-weight: 700; }
em { color: #8a6f3d; }

code {
  font-family: "NotoKRMono", "NotoKR", "Consolas", "Menlo", monospace;
  background: #f3ede1;
  padding: 0.5mm 1.5mm;
  border-radius: 1mm;
  font-size: 9.5pt;
  color: #5a4a30;
}
pre {
  background: #f7f2ea;
  border-left: 3px solid #b8a47a;
  padding: 4mm 5mm;
  font-size: 9.5pt;
  line-height: 1.55;
  page-break-inside: avoid;
  white-space: pre-wrap;
  word-break: break-all;
  color: #4a3f30;
  margin: 3mm 0 4mm 0;
  border-radius: 1mm;
}
pre code {
  background: transparent;
  padding: 0;
  color: inherit;
  font-size: 9.5pt;
}

table {
  border-collapse: collapse;
  width: 100%;
  margin: 3mm 0 5mm 0;
  font-size: 9.5pt;
  page-break-inside: avoid;
}
th, td {
  border: 1px solid #d9c9a8;
  padding: 1.8mm 2.5mm;
  text-align: left;
  vertical-align: top;
}
th {
  background: #ede4d3;
  color: #4a3f30;
  font-weight: 700;
}
tr:nth-child(even) td { background: #faf6ec; }

hr {
  border: 0;
  border-top: 1px dashed #c0ad82;
  margin: 8mm 0;
}

blockquote {
  border-left: 3px solid #b8a47a;
  margin: 3mm 0;
  padding: 1mm 4mm;
  color: #5a4a30;
  background: #faf6ec;
}

/* 인라인 체크박스 자국 (- [ ]) 그대로 통과 */
li input[type="checkbox"] { margin-right: 1.5mm; }
"""

font_config = FontConfiguration()
HTML(string=html_doc, base_url=str(ROOT)).write_pdf(
    target=str(OUT_PDF),
    stylesheets=[CSS(string=CSS_TEXT, font_config=font_config)],
    font_config=font_config,
)

size = OUT_PDF.stat().st_size
print(f"OK · {OUT_PDF.relative_to(ROOT)} · {size:,} bytes")
