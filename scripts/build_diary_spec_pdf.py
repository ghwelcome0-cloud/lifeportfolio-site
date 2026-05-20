#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_diary_spec_pdf.py
========================
인생포트폴리오 커스텀 다이어리 — 사양서 PDF 빌드 스크립트

입력: docs/strategy/diary/manufacturer-brief/01_spec_sheet.md
출력: docs/strategy/diary/manufacturer-brief/01_spec_sheet.pdf

설계 원칙:
- A4 세로, 머리말/꼬리말 여백 충분히 확보
- 페이지 잘림 방지 (page-break-inside: avoid)
- 섹션은 명확한 페이지 분리 (::: section-break :::)
- 표지 페이지(첫 페이지)는 별도 디자인
- PPT 슬라이드처럼 시각적 구분
- 한글 폰트: Noto Sans CJK KR
- 브랜드 컬러: 짙은 네이비 #1A2B4A, 골드 #C9A04F
"""

import re
import sys
from pathlib import Path

try:
    import markdown
    from weasyprint import HTML, CSS
except ImportError as e:
    print(f"필수 라이브러리 미설치: {e}")
    print("실행: pip install markdown weasyprint")
    sys.exit(1)


ROOT = Path("/home/user/webapp")
INPUT_MD = ROOT / "docs/strategy/diary/manufacturer-brief/01_spec_sheet.md"
OUTPUT_PDF = ROOT / "docs/strategy/diary/manufacturer-brief/01_spec_sheet.pdf"


# ============================================================
# CSS 스타일
# ============================================================
CSS_STYLE = """
@page {
    size: A4;
    margin: 22mm 18mm 22mm 18mm;

    @top-left {
        content: "인생포트폴리오 커스텀 다이어리 · 제작 사양서";
        font-family: "Noto Sans CJK KR", "NanumSquare", sans-serif;
        font-size: 8.5pt;
        color: #6B7280;
        padding-bottom: 4mm;
        border-bottom: 0.4pt solid #E5E7EB;
        width: 100%;
    }

    @top-right {
        content: "v1.2 · 2026-05-20";
        font-family: "Noto Sans CJK KR", sans-serif;
        font-size: 8.5pt;
        color: #6B7280;
        padding-bottom: 4mm;
        border-bottom: 0.4pt solid #E5E7EB;
    }

    @bottom-left {
        content: "Life Portfolio · 500부 견적 요청서";
        font-family: "Noto Sans CJK KR", sans-serif;
        font-size: 8pt;
        color: #9CA3AF;
        padding-top: 4mm;
        border-top: 0.4pt solid #E5E7EB;
    }

    @bottom-right {
        content: counter(page) " / " counter(pages);
        font-family: "Noto Sans CJK KR", sans-serif;
        font-size: 8pt;
        color: #9CA3AF;
        padding-top: 4mm;
        border-top: 0.4pt solid #E5E7EB;
    }
}

/* 표지 페이지(첫 페이지)는 헤더/푸터 숨김 + 별도 마진 */
@page :first {
    margin: 0;
    @top-left { content: ""; border: none; }
    @top-right { content: ""; border: none; }
    @bottom-left { content: ""; border: none; }
    @bottom-right { content: ""; border: none; }
}

* {
    box-sizing: border-box;
}

html, body {
    font-family: "Noto Sans CJK KR", "NanumSquare", "Malgun Gothic", sans-serif;
    font-size: 10pt;
    line-height: 1.65;
    color: #1F2937;
    margin: 0;
    padding: 0;
}

/* ============================================================
   표지 페이지 (cover) — 첫 H1 + 그 뒤 H2/H3까지 감싸는 영역
   ============================================================ */
.cover {
    width: 100%;
    height: 297mm;       /* A4 세로 전체 */
    padding: 35mm 22mm 30mm 22mm;
    background: linear-gradient(180deg, #FFFFFF 0%, #FFFFFF 60%, #F9FAFB 100%);
    page-break-after: always;
    display: block;
    position: relative;
}

.cover::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 8mm;
    background: #1A2B4A;
}

.cover::after {
    content: "";
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 4mm;
    background: #C9A04F;
}

.cover-brand {
    font-size: 9pt;
    letter-spacing: 4pt;
    color: #C9A04F;
    text-transform: uppercase;
    margin-bottom: 22mm;
    font-weight: 700;
}

.cover h1 {
    font-size: 30pt;
    font-weight: 800;
    color: #1A2B4A;
    margin: 0 0 8pt 0;
    padding: 0;
    letter-spacing: -0.6pt;
    line-height: 1.2;
    border: none;
}

.cover .cover-subtitle {
    font-size: 16pt;
    font-weight: 600;
    color: #374151;
    margin: 0 0 6pt 0;
    letter-spacing: -0.3pt;
}

.cover .cover-version {
    font-size: 11pt;
    color: #6B7280;
    margin-bottom: 28mm;
    font-weight: 500;
}

.cover-divider {
    width: 60mm;
    height: 3pt;
    background: #C9A04F;
    margin: 16mm 0;
}

.cover-meta-block {
    font-size: 10.5pt;
    line-height: 2.1;
    color: #374151;
}

.cover-meta-block strong {
    display: inline-block;
    min-width: 32mm;
    color: #1A2B4A;
    font-weight: 700;
}

.cover-note {
    margin-top: 18mm;
    padding: 12pt 16pt;
    background: #F9FAFB;
    border-left: 3pt solid #1A2B4A;
    font-size: 9.5pt;
    line-height: 1.7;
    color: #4B5563;
}

.cover-footer {
    position: absolute;
    bottom: 18mm;
    left: 22mm;
    right: 22mm;
    font-size: 9pt;
    color: #9CA3AF;
    display: flex;
    justify-content: space-between;
}

/* ============================================================
   일반 본문
   ============================================================ */

h1 {
    /* 표지가 아닌 H1은 사용하지 않음 — 안전장치 */
    font-size: 20pt;
    font-weight: 800;
    color: #1A2B4A;
    margin: 0 0 12pt 0;
    page-break-after: avoid;
}

h2 {
    font-size: 16pt;
    font-weight: 700;
    color: #1A2B4A;
    margin: 0 0 18pt 0;
    padding: 0 0 10pt 0;
    border-bottom: 2.5pt solid #C9A04F;
    letter-spacing: -0.2pt;
    page-break-after: avoid;
}

h3 {
    font-size: 12.5pt;
    font-weight: 700;
    color: #1A2B4A;
    margin: 18pt 0 8pt 0;
    padding: 0;
    page-break-after: avoid;
}

h4 {
    font-size: 10.5pt;
    font-weight: 700;
    color: #374151;
    margin: 12pt 0 6pt 0;
    page-break-after: avoid;
}

p {
    margin: 0 0 8pt 0;
    text-align: left;
    orphans: 3;
    widows: 3;
}

/* ---------- 페이지 분리 마커 ---------- */
.section-break {
    page-break-after: always;
    height: 0;
    overflow: hidden;
}

/* ---------- 표 (가장 중요한 요소) ---------- */
table {
    width: 100%;
    border-collapse: collapse;
    margin: 8pt 0 14pt 0;
    font-size: 9.2pt;
    page-break-inside: avoid;
}

thead {
    display: table-header-group;
}

tr {
    page-break-inside: avoid;
}

th {
    background-color: #1A2B4A;
    color: #FFFFFF;
    font-weight: 700;
    padding: 7pt 8pt;
    text-align: left;
    border: 0.5pt solid #1A2B4A;
    font-size: 9pt;
}

td {
    padding: 6pt 8pt;
    border: 0.5pt solid #D1D5DB;
    vertical-align: top;
    line-height: 1.55;
}

tbody tr:nth-child(even) td {
    background-color: #F9FAFB;
}

/* ---------- 강조 박스 (blockquote) ---------- */
blockquote {
    margin: 12pt 0;
    padding: 10pt 14pt;
    background-color: #FEF7E6;
    border-left: 3.5pt solid #C9A04F;
    color: #374151;
    font-size: 9.8pt;
    page-break-inside: avoid;
    line-height: 1.65;
}

blockquote p {
    margin: 0;
}

/* ---------- 인라인 강조 ---------- */
strong {
    color: #1A2B4A;
    font-weight: 700;
}

em {
    color: #6B7280;
    font-style: italic;
}

code {
    background-color: #F3F4F6;
    padding: 1pt 4pt;
    border-radius: 2pt;
    font-family: "DejaVu Sans Mono", monospace;
    font-size: 9pt;
    color: #1A2B4A;
}

a {
    color: #1A2B4A;
    text-decoration: none;
    border-bottom: 0.5pt solid #C9A04F;
}

/* ---------- 리스트 ---------- */
ul, ol {
    margin: 4pt 0 12pt 0;
    padding-left: 22pt;
}

li {
    margin: 4pt 0;
    line-height: 1.6;
    page-break-inside: avoid;
}

li > strong:first-child {
    color: #1A2B4A;
}

li ul, li ol {
    margin: 2pt 0 4pt 0;
}

/* ---------- 구분선 ---------- */
hr {
    border: none;
    border-top: 0.4pt solid #E5E7EB;
    margin: 16pt 0;
}
"""


# ============================================================
# 마크다운 전처리
# ============================================================
def preprocess_markdown(md_text: str) -> tuple[str, str]:
    """
    원본 마크다운에서:
    1. 표지 영역(첫 H1 ~ 첫 ---) 을 잘라내 cover HTML로 변환
    2. 나머지 본문은 그대로 마크다운 → HTML 처리
    3. ::: section-break ::: 마커는 div로 변환

    return: (cover_html, body_markdown)
    """
    # ---- 표지 영역 추출 ----
    # 패턴: 시작부터 첫 "---\n\n::: section-break :::" 직전까지
    cover_match = re.match(
        r'^(.*?)(?=\n---\n+:::\s*section-break\s*:::)',
        md_text,
        re.DOTALL,
    )

    if cover_match:
        cover_md_raw = cover_match.group(1).strip()
        body_md = md_text[cover_match.end():].lstrip("\n-").lstrip()
    else:
        cover_md_raw = ""
        body_md = md_text

    # 표지 HTML 구성 (마크다운 변환 없이 직접 작성)
    cover_html = build_cover_html(cover_md_raw)

    # ★ 빈 페이지 2 방지: 본문 시작 부분의 첫 ::: section-break ::: 제거
    # (.cover에 이미 page-break-after: always 가 있어서 중복되면 빈 페이지 발생)
    body_md = re.sub(
        r'^\s*:::\s*section-break\s*:::\s*\n+',
        '',
        body_md,
        count=1,
    )

    # 본문 처리 — 나머지 section-break 마커 변환
    body_md = re.sub(
        r'^:::\s*section-break\s*:::\s*$',
        '<div class="section-break"></div>',
        body_md,
        flags=re.MULTILINE,
    )

    return cover_html, body_md


def build_cover_html(cover_md: str) -> str:
    """
    표지 영역을 HTML로 직접 빌드.
    cover_md는 표지 영역의 마크다운 텍스트.
    필요 정보를 정규식으로 추출하여 디자인된 HTML로 변환.
    """
    # 제목 추출
    title_match = re.search(r'^#\s+(.+)$', cover_md, re.MULTILINE)
    title = title_match.group(1).strip() if title_match else "인생포트폴리오 커스텀 다이어리"

    # H2 추출
    h2_match = re.search(r'^##\s+(.+)$', cover_md, re.MULTILINE)
    subtitle = h2_match.group(1).strip() if h2_match else "제작 사양서"

    # H3 (버전) 추출
    h3_match = re.search(r'^###\s+(.+)$', cover_md, re.MULTILINE)
    version = h3_match.group(1).strip() if h3_match else "Manufacturer Brief · v1.0 · 2026-05-19"

    # 메타 항목 추출 (— **xxx** · yyy 형식 또는 **xxx** · yyy)
    meta_items = re.findall(
        r'\*\*([^*]+)\*\*\s*·\s*([^\n]+)',
        cover_md,
    )

    # blockquote(> ...) 추출
    quote_match = re.search(r'^>\s*(.+(?:\n>\s*.+)*)', cover_md, re.MULTILINE)
    quote_text = ""
    if quote_match:
        quote_text = re.sub(r'^>\s*', '', quote_match.group(1), flags=re.MULTILINE).strip()

    meta_html = ""
    for label, value in meta_items:
        meta_html += f'<div><strong>{label.strip()}</strong>{value.strip()}</div>\n'

    cover_html = f"""
<div class="cover">
  <div class="cover-brand">LIFE PORTFOLIO · 인생포트폴리오</div>
  <h1>{title}</h1>
  <div class="cover-subtitle">{subtitle}</div>
  <div class="cover-version">{version}</div>

  <div class="cover-divider"></div>

  <div class="cover-meta-block">
{meta_html}
  </div>

  {f'<div class="cover-note">{quote_text}</div>' if quote_text else ''}

  <div class="cover-footer">
    <span>Confidential · For Manufacturer Quote Only</span>
    <span>500부 견적 요청 · A5 양장 사철</span>
  </div>
</div>
"""
    return cover_html


def build_html(md_text: str) -> str:
    """마크다운을 HTML 문자열로 변환."""
    cover_html, body_md = preprocess_markdown(md_text)

    body_html = markdown.markdown(
        body_md,
        extensions=["extra", "tables", "sane_lists"],
    )

    full_html = f"""<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title>인생포트폴리오 커스텀 다이어리 — 제작 사양서</title>
</head>
<body>
{cover_html}
{body_html}
</body>
</html>
"""
    return full_html


def main() -> int:
    if not INPUT_MD.exists():
        print(f"[ERROR] 입력 파일 없음: {INPUT_MD}")
        return 1

    md_text = INPUT_MD.read_text(encoding="utf-8")
    html = build_html(md_text)

    # 디버그용 HTML 저장 (DIARY_DEBUG_HTML=1 환경변수 설정 시에만)
    import os
    if os.environ.get("DIARY_DEBUG_HTML"):
        debug_html = OUTPUT_PDF.with_suffix(".debug.html")
        debug_html.write_text(html, encoding="utf-8")

    css = CSS(string=CSS_STYLE)

    HTML(string=html, base_url=str(ROOT)).write_pdf(
        target=str(OUTPUT_PDF),
        stylesheets=[css],
    )

    size_kb = OUTPUT_PDF.stat().st_size / 1024
    print(f"[OK] PDF 생성 완료: {OUTPUT_PDF}")
    print(f"     크기: {size_kb:.1f} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
