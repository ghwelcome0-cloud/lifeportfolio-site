#!/usr/bin/env python3
"""
업무매뉴얼 PDF 생성 스크립트 (v2.0 - 자동·수동 통합본)
- docs/PRODUCTION_MANUAL_v2.0.md → docs/manual/업무매뉴얼_v2.0_2026-05-06.pdf
- 13DOMAIN_EXAMPLES.md 의 13개 영역 사례를 PART 4 뒤에 통합 삽입
- weasyprint + markdown 사용
"""
import os
import sys
import re
from pathlib import Path

import markdown
from weasyprint import HTML, CSS
from weasyprint.text.fonts import FontConfiguration

ROOT = Path(__file__).resolve().parent.parent
SRC_MD = ROOT / "docs" / "PRODUCTION_MANUAL_v2.0.md"
EXAMPLES_MD = ROOT / "docs" / "manual" / "golden" / "13DOMAIN_EXAMPLES.md"
OUT_DIR = ROOT / "docs" / "manual"
OUT_PDF = OUT_DIR / "업무매뉴얼_v2.0_2026-05-06.pdf"

OUT_DIR.mkdir(parents=True, exist_ok=True)

md_text = SRC_MD.read_text(encoding="utf-8")

# 13DOMAIN_EXAMPLES.md 의 본문(B 섹션 13개 사례)을 PART 4 뒤에 자연스럽게 끼워넣기
examples_text = EXAMPLES_MD.read_text(encoding="utf-8")
# Section B만 추출 (사례 1~13 헤딩 포함)
m = re.search(r"## B\. 13개 영역 대표 사례.*?\n(.+?)\n## C\. ", examples_text, re.DOTALL)
examples_body = m.group(1).strip() if m else examples_text

# PART 4 표 직후, "PART 5" 헤딩 직전 위치를 찾아 13사례 본문을 끼워넣음
INSERT_MARK = "\n# PART 5. 품질 검사 체크리스트 + 100점 평가 점수표\n"
inject = (
    "\n## 4-1. 13개 영역 7섹션 합성 사례 (전체 본문)\n\n"
    + examples_body
    + "\n\n"
)
md_text = md_text.replace(INSERT_MARK, inject + INSERT_MARK)

# Markdown → HTML
html_body = markdown.markdown(
    md_text,
    extensions=["tables", "fenced_code", "toc", "sane_lists", "nl2br"],
)

COVER = """
<section class="cover">
  <div class="cover-brand">인생포트폴리오 / Life Portfolio</div>
  <h1 class="cover-title">제작 업무매뉴얼 v2.0<br/>자동·수동 통합본</h1>
  <div class="cover-sub">
    인생포트폴리오 리포트 · 맞춤형 실행 프로그램<br/>
    응답 데이터 → 매핑 → 리포트/프로그램 템플릿 · 13영역 대표 사례 · 100점 채점표(95점 미만 제공 불가)
  </div>
  <div class="cover-meta">
    <div>제정일 · 2026-05-06</div>
    <div>모범 출력 기준 · 김영식 케이스(99/100)</div>
    <div>적용 PR · #63 · #64 · #65 · #66 · #67 · #68 · #69</div>
    <div>채점 만점 · 100점 (95점 이상만 제공 가능)</div>
  </div>
  <div class="cover-foot">
    응답 데이터 출처 — 구글 스프레드시트 「인생포트폴리오 응답 마스터」<br/>
    Sheet ID · 1jd0h64K2E0g7B5-aOZD0e2sNDmvOQshYiGHROgmHSCM<br/>
    골든 데이터 · docs/manual/golden/KYS_GOLDEN_REFERENCE.json<br/>
    13영역 사례 · docs/manual/golden/13DOMAIN_EXAMPLES.md
  </div>
</section>
"""

html_doc = f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>제작 업무매뉴얼 v2.0 — 자동·수동 통합본</title>
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
    content: "인생포트폴리오 · 제작 업무매뉴얼 v2.0";
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
  font-weight: 400; font-style: normal;
}
@font-face {
  font-family: "NotoKR";
  src: url("file:///usr/share/fonts/opentype/noto/NotoSansCJK-Medium.ttc") format("truetype-collection");
  font-weight: 500; font-style: normal;
}
@font-face {
  font-family: "NotoKR";
  src: url("file:///usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc") format("truetype-collection");
  font-weight: 700; font-style: normal;
}
@font-face {
  font-family: "NotoKR";
  src: url("file:///usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc") format("truetype-collection");
  font-weight: 900; font-style: normal;
}
@font-face {
  font-family: "NotoKRMono";
  src: url("file:///usr/share/fonts/truetype/nanum/NanumGothicCoding.ttf") format("truetype");
  font-weight: 400; font-style: normal;
}

body {
  font-family: "NotoKR", "Noto Sans CJK KR", "Noto Sans KR", "NanumGothic", sans-serif;
  font-size: 10.5pt;
  line-height: 1.65;
  color: #2a2620;
  margin: 0; padding: 0;
}

/* 표지 */
.cover {
  page-break-after: always;
  height: 297mm;
  padding: 50mm 25mm 25mm 25mm;
  background: linear-gradient(160deg, #eaf2f7 0%, #d3e1ed 60%, #a8c0d9 100%);
  display: flex; flex-direction: column; justify-content: flex-start;
  color: #1a2a40;
}
.cover-brand {
  font-size: 12pt; letter-spacing: 0.3em; color: #2a5a8a;
  font-weight: 600; margin-bottom: 30mm;
}
.cover-title {
  font-size: 30pt; font-weight: 800; line-height: 1.35;
  margin: 0 0 14mm 0; color: #14253a;
}
.cover-sub {
  font-size: 12pt; line-height: 1.7; color: #2f4257;
  margin-bottom: 25mm; max-width: 160mm;
}
.cover-meta {
  font-size: 11pt; line-height: 2; color: #1a2a40;
  border-left: 3px solid #2a5a8a;
  padding-left: 6mm; margin-bottom: 25mm;
}
.cover-foot {
  margin-top: auto; font-size: 9.5pt; color: #4a5e75;
  border-top: 1px solid #7aa0c5; padding-top: 5mm;
}

/* 본문 */
.content { padding: 0; }

h1 {
  font-size: 20pt; color: #2a5a8a;
  border-bottom: 2px solid #a8c0d9;
  padding-bottom: 4mm;
  margin: 12mm 0 8mm 0;
  page-break-before: always;
  page-break-after: avoid;
}
h1:first-of-type { page-break-before: avoid; }
h2 {
  font-size: 15pt; color: #14253a;
  border-left: 4px solid #2a5a8a;
  padding: 1mm 0 1mm 4mm;
  margin: 10mm 0 4mm 0;
  page-break-after: avoid;
}
h3 {
  font-size: 12pt; color: #2f4257;
  margin: 7mm 0 2mm 0;
  page-break-after: avoid;
}
h4 {
  font-size: 11pt; color: #2f4257;
  margin: 5mm 0 1mm 0;
  page-break-after: avoid;
}

p { margin: 2mm 0 3mm 0; }
ul, ol { margin: 2mm 0 4mm 6mm; padding-left: 2mm; }
li { margin: 0.8mm 0; }

strong { color: #1a4a78; font-weight: 700; }
em { color: #2a5a8a; }

code {
  font-family: "NotoKRMono", "NotoKR", "Consolas", "Menlo", monospace;
  background: #eef4fa; padding: 0.5mm 1.5mm; border-radius: 1mm;
  font-size: 9.5pt; color: #1a4a78;
}
pre {
  background: #f4f8fc; border-left: 3px solid #7aa0c5;
  padding: 4mm 5mm; font-size: 9.5pt; line-height: 1.55;
  page-break-inside: avoid;
  white-space: pre-wrap; word-break: break-all;
  color: #2f4257; margin: 3mm 0 4mm 0; border-radius: 1mm;
}
pre code { background: transparent; padding: 0; color: inherit; font-size: 9.5pt; }

table {
  border-collapse: collapse; width: 100%;
  margin: 3mm 0 5mm 0; font-size: 9pt;
  page-break-inside: avoid;
}
th, td {
  border: 1px solid #a8c0d9;
  padding: 1.6mm 2.2mm;
  text-align: left; vertical-align: top;
}
th { background: #d3e1ed; color: #14253a; font-weight: 700; }
tr:nth-child(even) td { background: #f4f8fc; }

hr { border: 0; border-top: 1px dashed #7aa0c5; margin: 8mm 0; }

blockquote {
  border-left: 3px solid #7aa0c5; margin: 3mm 0;
  padding: 1mm 4mm; color: #2f4257; background: #f4f8fc;
}

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
