#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
인생포트폴리오 맞춤형 다이어리 v1.4 — Plan A 인쇄 직행 본문 PDF 빌더
─────────────────────────────────────────────────────────────────
출력: docs/strategy/diary/manufacturer-handoff-v1.4/print-ready/body_256p.pdf

사양:
- 페이지 사이즈: A5 trim (148 × 210 mm) + 3 mm 도련 = 154 × 216 mm
- 색상: WeasyPrint(RGB) → Ghostscript CMYK 변환 (-sColorConversionStrategy=CMYK)
- 폰트 임베드: Noto Sans/Serif CJK KR (시스템 설치본, WeasyPrint 자동 임베드)
- 페이지 수: 256p (16절판 16의 배수)
- 구조: v1.4 §5.1 표대로 시퀀스 생성

페이지 시퀀스 (256p)
────────────────────
1   속표지(blank)
2   인사말 (blank)
3   타이틀: LIFE PORTFOLIO · UNDATED
4   Only One 선언
5   blank
6   blank
7   blank
8   Part 0 표지
9-10  PART 0 인트로 + 시작일 기입
11    01 사명
12    02 비전
13    03A 4SE 1/2
14    03B 4SE 2/2
15    04 TOP3 강점
16    05 TOP2 성장
17    06 실행 프로파일
18    07 추천 진로
19-20 (blank pair · 간지)
21-32 Part 1 13영역 인생 지도 (12p)
33-36 연간 캘린더 (4p · YEAR 1 + YEAR 2)
37-46 Part 2 연간 비전 · 90일 마일스톤 (10p)
47-70 월간 캘린더 (24p · 12개월 × 2p)
71-174 Part 3 주간 펼침면 52주 × 2p (104p)
175-192 Part 4 영역별 분기 회고 (18p)
193-204 Part 5 감사 일기 (12p)
205-212 Part 6 1:1 코칭 진척 (8p)
213-216 Part 7-① 성경/명언 (4p)
217-218 Part 7-② 13영역 가이드 (2p)
219    Part 7-③ 사용 가이드
220    Part 7-④ Owner Profile
221-244 Part 7-⑤ 데일리 저널 24p
245-256 여유 간지 (14p, 마지막 페이지 포함)
"""

import sys
import os
import subprocess
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "docs/strategy/diary/manufacturer-handoff-v1.4/print-ready"
OUT_DIR.mkdir(parents=True, exist_ok=True)

INTERMEDIATE_PDF = OUT_DIR / "body_256p_rgb.pdf"
FINAL_PDF = OUT_DIR / "body_256p.pdf"

# ════════════════════════════════════════════════════════════════
# CSS — 인쇄 사양 (A5 154×216 mm including 3mm bleed)
# ════════════════════════════════════════════════════════════════
PRINT_CSS = r"""
@page {
    /* A5 trim 148×210mm + 3mm bleed (all sides) = 154×216mm */
    size: 154mm 216mm;
    margin: 0;
    bleed: 3mm;
    /* Marks: trim marks (제조사에서 도련 위치 확인용) */
    marks: crop;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

html, body {
    font-family: "Noto Sans CJK KR", "Noto Sans KR", sans-serif;
    color: #1B2A4A; /* Navy */
    background: #FFFFFF;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
}

:root {
    --navy: #1B2A4A;
    --gold: #C9A04F;
    --ink: #2C2C2C;
    --ink-light: #8A8A8A;
    --cream: #FAF7F0;
    --rule: #D6CFC0;
}

.page {
    /* trim area within bleed page */
    width: 154mm;
    height: 216mm;
    position: relative;
    page-break-after: always;
    padding: 14mm 12mm 12mm 12mm; /* inner safe margin from trim edge */
    overflow: hidden;
}
.page:last-child { page-break-after: auto; }

/* ── Folio (page number) + brand-mini ─────────────── */
.folio {
    position: absolute;
    bottom: 6mm;
    left: 12mm;
    right: 12mm;
    display: flex;
    justify-content: space-between;
    font-family: "Noto Sans CJK KR", sans-serif;
    font-size: 7.5pt;
    color: var(--ink-light);
    letter-spacing: 0.06em;
}
.folio.left { flex-direction: row-reverse; }
.folio .brand { font-weight: 600; color: var(--gold); }

/* ── Section divider page ─────────────────────────── */
.divider {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    height: 100%;
    background: var(--cream);
}
.divider .part-num {
    font-family: "Noto Serif CJK KR", serif;
    font-weight: 200;
    font-size: 48pt;
    color: var(--gold);
    letter-spacing: 0.1em;
}
.divider .part-name {
    font-family: "Noto Serif CJK KR", serif;
    font-weight: 700;
    font-size: 16pt;
    color: var(--navy);
    margin-top: 8mm;
}
.divider .part-sub {
    font-family: "Noto Sans CJK KR", sans-serif;
    font-weight: 400;
    font-size: 10pt;
    color: var(--ink);
    margin-top: 4mm;
    letter-spacing: 0.05em;
}
.divider .rule-gold {
    width: 30mm;
    height: 0.4mm;
    background: var(--gold);
    margin: 6mm 0;
}

/* ── Title page ───────────────────────────────────── */
.title-page {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100%;
    background: #FFFFFF;
    text-align: center;
}
.title-page .brand-en {
    font-family: "Noto Serif CJK KR", serif;
    font-weight: 200;
    font-size: 28pt;
    letter-spacing: 0.25em;
    color: var(--navy);
}
.title-page .brand-kr {
    font-family: "Noto Serif CJK KR", serif;
    font-weight: 600;
    font-size: 13pt;
    color: var(--navy);
    margin-top: 6mm;
    letter-spacing: 0.1em;
}
.title-page .only-one {
    font-family: "Noto Sans CJK KR", sans-serif;
    font-weight: 800;
    font-size: 10pt;
    color: var(--gold);
    margin-top: 14mm;
    letter-spacing: 0.4em;
}
.title-page .undated-tag {
    font-family: "Noto Sans CJK KR", sans-serif;
    font-weight: 600;
    font-size: 8pt;
    color: var(--ink-light);
    margin-top: 8mm;
    letter-spacing: 0.3em;
    border: 0.3mm solid var(--gold);
    padding: 1.5mm 5mm;
}

/* ── Generic content page ─────────────────────────── */
.content {
    height: 100%;
    display: flex;
    flex-direction: column;
}
.content h1 {
    font-family: "Noto Serif CJK KR", serif;
    font-weight: 700;
    font-size: 14pt;
    color: var(--navy);
    margin-bottom: 3mm;
}
.content .tag {
    font-family: "Noto Sans CJK KR", sans-serif;
    font-weight: 700;
    font-size: 7pt;
    color: var(--gold);
    letter-spacing: 0.2em;
    margin-bottom: 2mm;
}
.content .sub {
    font-family: "Noto Sans CJK KR", sans-serif;
    font-weight: 400;
    font-size: 8.5pt;
    color: var(--ink);
    margin-bottom: 4mm;
}
.content .rule-gold-sm {
    width: 16mm;
    height: 0.25mm;
    background: var(--gold);
    margin-bottom: 4mm;
}
.content .label {
    font-family: "Noto Sans CJK KR", sans-serif;
    font-weight: 700;
    font-size: 8pt;
    color: var(--navy);
    margin-top: 3mm;
    margin-bottom: 1mm;
    letter-spacing: 0.08em;
}
.content .line {
    border-bottom: 0.2mm solid var(--ink);
    height: 6.5mm;
    margin-bottom: 1.5mm;
}
.content .box {
    border: 0.3mm solid var(--rule);
    border-left: 1mm solid var(--gold);
    padding: 3mm 4mm;
    background: var(--cream);
    margin: 3mm 0;
}

/* ── Weekly spread (left page · 계획) ─────────────── */
.weekly-left .week-num {
    font-family: "Noto Serif CJK KR", serif;
    font-weight: 700;
    font-size: 12pt;
    color: var(--navy);
}
.weekly-left .week-range {
    font-family: "Noto Sans CJK KR", sans-serif;
    font-size: 8pt;
    color: var(--ink-light);
    font-style: italic;
    margin-bottom: 3mm;
}
.weekly-left .weekday-row {
    display: flex;
    align-items: center;
    margin-bottom: 1.2mm;
}
.weekly-left .weekday-row .d {
    flex: 0 0 7mm;
    font-family: "Noto Sans CJK KR", sans-serif;
    font-weight: 700;
    font-size: 8pt;
    color: var(--navy);
}
.weekly-left .weekday-row .d.weekend { color: #B85450; }
.weekly-left .weekday-row .ln {
    flex: 1;
    border-bottom: 0.2mm solid var(--ink);
    height: 5mm;
}

/* ── Weekly spread (right page · Deep Dive + 회고) ── */
.weekly-right .dd-box {
    background: linear-gradient(180deg, #FFF8EB 0%, #FFFFFF 100%);
    border: 0.3mm solid var(--gold);
    border-left: 1mm solid var(--gold);
    padding: 3mm 4mm;
    margin-bottom: 4mm;
}
.weekly-right .dd-title {
    font-family: "Noto Serif CJK KR", serif;
    font-weight: 700;
    font-size: 9pt;
    color: var(--navy);
    margin-bottom: 2mm;
}
.weekly-right .dd-row {
    display: flex;
    align-items: baseline;
    margin-bottom: 1.5mm;
}
.weekly-right .dd-row .k {
    flex: 0 0 22mm;
    font-family: "Noto Sans CJK KR", sans-serif;
    font-weight: 700;
    font-size: 7.5pt;
    color: var(--navy);
}
.weekly-right .dd-row .ln {
    flex: 1;
    border-bottom: 0.15mm solid var(--ink);
    height: 4mm;
}
.weekly-right .dot-area {
    flex: 1;
    background-image: radial-gradient(circle, #C8C2B5 0.25mm, transparent 0.3mm);
    background-size: 3mm 3mm;
    background-position: 0 0;
    border: 0.2mm solid var(--rule);
    min-height: 40mm;
    margin-bottom: 3mm;
}

/* ── Monthly grid (Undated) ───────────────────────── */
.month-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 0;
    border: 0.3mm solid var(--rule);
    flex: 1;
    margin-top: 3mm;
}
.month-grid .head {
    background: var(--cream);
    border: 0.2mm solid var(--rule);
    padding: 2mm 1mm;
    text-align: center;
    font-family: "Noto Sans CJK KR", sans-serif;
    font-weight: 700;
    font-size: 7pt;
    color: var(--navy);
}
.month-grid .head .ln {
    display: inline-block;
    width: 70%;
    border-bottom: 0.2mm solid var(--ink);
}
.month-grid .day {
    border: 0.2mm solid var(--rule);
    min-height: 14mm;
    padding: 1mm 1.5mm;
    background: #FFFFFF;
    font-family: "Noto Serif CJK KR", serif;
    font-size: 7pt;
    color: var(--ink-light);
}
.month-grid .day.optional {
    background: repeating-linear-gradient(45deg, #FFFFFF 0 1mm, var(--cream) 1mm 1.2mm);
}

/* ── Yearly mini-month grid (12 / page) ───────────── */
.year-head {
    background: var(--navy);
    color: var(--gold);
    padding: 2.5mm 4mm;
    font-family: "Noto Sans CJK KR", sans-serif;
    font-weight: 800;
    font-size: 9pt;
    letter-spacing: 0.15em;
    margin-bottom: 3mm;
    display: flex;
    align-items: baseline;
    gap: 4mm;
}
.year-head .yr-ln {
    flex: 1;
    border-bottom: 0.3mm solid var(--gold);
    height: 0;
}
.year-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(4, 1fr);
    gap: 2mm;
    flex: 1;
}
.year-grid .mm {
    background: var(--cream);
    border: 0.2mm solid var(--rule);
    border-radius: 1mm;
    padding: 1.5mm 2mm;
    display: flex;
    flex-direction: column;
}
.year-grid .mm .lbl {
    font-family: "Noto Serif CJK KR", serif;
    font-weight: 700;
    font-size: 7pt;
    color: var(--navy);
    margin-bottom: 1mm;
}
.year-grid .mm .cells {
    flex: 1;
    background-image:
        linear-gradient(0deg, transparent 16%, rgba(26,43,74,0.12) 16%, rgba(26,43,74,0.12) 17%, transparent 17%),
        linear-gradient(0deg, transparent 33%, rgba(26,43,74,0.12) 33%, rgba(26,43,74,0.12) 34%, transparent 34%),
        linear-gradient(0deg, transparent 50%, rgba(26,43,74,0.12) 50%, rgba(26,43,74,0.12) 51%, transparent 51%),
        linear-gradient(0deg, transparent 67%, rgba(26,43,74,0.12) 67%, rgba(26,43,74,0.12) 68%, transparent 68%),
        linear-gradient(0deg, transparent 83%, rgba(26,43,74,0.12) 83%, rgba(26,43,74,0.12) 84%, transparent 84%);
}

/* ── Daily Journal page (dot grid) ────────────────── */
.dj-head {
    display: flex;
    gap: 6mm;
    margin-bottom: 3mm;
    padding: 2mm 3mm;
    background: var(--cream);
    border-radius: 1mm;
}
.dj-head .cell { display: flex; align-items: baseline; gap: 2mm; flex: 1; }
.dj-head .cell .k {
    font-family: "Noto Sans CJK KR", sans-serif;
    font-weight: 700;
    font-size: 7pt;
    color: var(--navy);
}
.dj-head .cell .ln {
    flex: 1;
    border-bottom: 0.2mm solid var(--ink);
    height: 0;
}
.dot-area-full {
    flex: 1;
    background-image: radial-gradient(circle, #C8C2B5 0.25mm, transparent 0.3mm);
    background-size: 3.5mm 3.5mm;
    background-position: 0 0;
    border: 0.2mm solid var(--rule);
    min-height: 130mm;
}

/* ── Owner page ───────────────────────────────────── */
.owner-row {
    display: flex;
    align-items: baseline;
    margin-bottom: 3mm;
}
.owner-row .k {
    flex: 0 0 30mm;
    font-family: "Noto Sans CJK KR", sans-serif;
    font-weight: 700;
    font-size: 8pt;
    color: var(--navy);
}
.owner-row .ln {
    flex: 1;
    border-bottom: 0.25mm solid var(--ink);
    height: 6mm;
}

.blank-page {
    height: 100%;
    width: 100%;
    background: #FFFFFF;
}

/* Footer note for divider's last page */
.section-end-note {
    position: absolute;
    bottom: 8mm;
    left: 0;
    right: 0;
    text-align: center;
    font-family: "Noto Sans CJK KR", sans-serif;
    font-size: 6.5pt;
    color: var(--ink-light);
    font-style: italic;
    letter-spacing: 0.1em;
}
"""

# ════════════════════════════════════════════════════════════════
# 페이지 빌더 함수들
# ════════════════════════════════════════════════════════════════

def page(html_body: str, folio_text: str = "", brand_text: str = "", side: str = "right") -> str:
    """단일 page wrapper."""
    folio_html = ""
    if folio_text:
        folio_class = "folio left" if side == "left" else "folio"
        folio_html = f'<div class="{folio_class}"><span class="brand">{brand_text}</span><span>{folio_text}</span></div>'
    return f'<div class="page">{html_body}{folio_html}</div>\n'


def blank_page(folio_text: str = "", side: str = "right") -> str:
    return page('<div class="blank-page"></div>', folio_text, "", side)


def title_page() -> str:
    body = """
    <div class="title-page">
        <div class="brand-en">LIFE PORTFOLIO</div>
        <div class="brand-kr">인생포트폴리오 맞춤형 다이어리</div>
        <div class="only-one">ONLY ONE</div>
        <div class="undated-tag">UNDATED · 만년형</div>
    </div>
    """
    return page(body)


def divider_page(num: str, name: str, sub: str) -> str:
    body = f"""
    <div class="divider">
        <div class="part-num">{num}</div>
        <div class="rule-gold"></div>
        <div class="part-name">{name}</div>
        <div class="part-sub">{sub}</div>
    </div>
    """
    return page(body)


def intro_with_start_date(folio: str) -> str:
    body = """
    <div class="content">
        <div class="tag">PART 0 · INTRO</div>
        <h1>검사 리포트를 옮겨 적기</h1>
        <div class="rule-gold-sm"></div>
        <div class="sub">손글씨로 핵심 7항목을 다이어리에 자기화(自己化) 합니다.</div>
        <div class="box">
            <div class="label" style="color:#C9A04F;">▲ START · 나의 인생포트폴리오 1년이 시작되는 날</div>
            <div style="display:flex; gap:6mm; align-items:baseline; margin-top:3mm;">
                <div style="display:flex; align-items:baseline; gap:2mm;">
                    <span style="border-bottom:0.3mm solid #1B2A4A; display:inline-block; width:24mm; height:6mm;"></span>
                    <span style="font-family:'Noto Serif CJK KR',serif; font-size:9pt;">년</span>
                </div>
                <div style="display:flex; align-items:baseline; gap:2mm;">
                    <span style="border-bottom:0.3mm solid #1B2A4A; display:inline-block; width:14mm; height:6mm;"></span>
                    <span style="font-family:'Noto Serif CJK KR',serif; font-size:9pt;">월</span>
                </div>
                <div style="display:flex; align-items:baseline; gap:2mm;">
                    <span style="border-bottom:0.3mm solid #1B2A4A; display:inline-block; width:14mm; height:6mm;"></span>
                    <span style="font-family:'Noto Serif CJK KR',serif; font-size:9pt;">일</span>
                </div>
            </div>
            <div style="font-size:7pt; color:#8A8A8A; margin-top:3mm; font-style:italic; line-height:1.6;">
                ※ 신년 한정이 아닌 만년형 다이어리입니다. 어느 날 시작해도 이날부터 정확히 1년을 사용합니다.
            </div>
        </div>
        <div class="label">손글씨로 옮겨 적을 7가지</div>
        <div style="font-size:8pt; line-height:1.8; color:#2C2C2C;">
            01. 사명 (Mission) — 핵심·보조 1줄씩<br>
            02. 비전 (Vision) — 핵심·보조 1줄씩<br>
            03. 4SE 응답 강도 — 자기이해 / 자기표현 / 자기설계 / 자기실행<br>
            04. TOP 3 강점<br>
            05. TOP 2 성장 포인트<br>
            06. 실행 프로파일 6필드<br>
            07. 추천 진로 3카드
        </div>
    </div>
    """
    return page(body, folio, "PART 0 · INTRO", "right")


def mission_page(folio: str) -> str:
    body = """
    <div class="content">
        <div class="tag">PART 0 · 01</div>
        <h1>사명 (Mission)</h1>
        <div class="rule-gold-sm"></div>
        <div class="sub">나를 부르는 부르심 한 줄로 옮겨 적기</div>
        <div class="label">▷ 핵심 사명 (1줄)</div>
        <div class="line"></div>
        <div class="line"></div>
        <div class="label" style="margin-top:6mm;">▷ 보조 사명 (1줄)</div>
        <div class="line"></div>
        <div class="line"></div>
        <div class="box" style="margin-top:8mm;">
            <div style="font-size:7.5pt; line-height:1.7; color:#2C2C2C;">
                <strong>사명(Mission)</strong>은 "왜 나는 이 일을 하는가"에 대한 답입니다.
                존재의 이유. 살아 있는 동안 변하지 않는 핵심.
            </div>
        </div>
    </div>
    """
    return page(body, folio, "PART 0 · 01", "right")


def vision_page(folio: str) -> str:
    body = """
    <div class="content">
        <div class="tag">PART 0 · 02</div>
        <h1>비전 (Vision)</h1>
        <div class="rule-gold-sm"></div>
        <div class="sub">미래의 나 — 핵심·보조 1줄씩</div>
        <div class="label">▷ 핵심 비전</div>
        <div class="line"></div>
        <div class="line"></div>
        <div class="label" style="margin-top:6mm;">▷ 보조 비전</div>
        <div class="line"></div>
        <div class="line"></div>
        <div class="box" style="margin-top:8mm;">
            <div style="font-size:7.5pt; line-height:1.7; color:#2C2C2C;">
                <strong>비전(Vision)</strong>은 "어디로 가고 싶은가"에 대한 답.
                구체적인 미래상. 사명을 향한 항해의 등대.
            </div>
        </div>
    </div>
    """
    return page(body, folio, "PART 0 · 02", "right")


def four_se_a_page(folio: str) -> str:
    body = """
    <div class="content">
        <div class="tag">PART 0 · 03A</div>
        <h1>4SE 응답 강도 (1/2)</h1>
        <div class="rule-gold-sm"></div>
        <div class="sub">자기이해 + 자기표현 — "인식 → 표출" 축</div>
        <div class="label">▷ 자기이해 (Self-Understanding) %</div>
        <div class="line"></div><div class="line"></div>
        <div class="label" style="margin-top:5mm;">▷ 자기표현 (Self-Expression) %</div>
        <div class="line"></div><div class="line"></div>
    </div>
    """
    return page(body, folio, "PART 0 · 03A", "right")


def four_se_b_page(folio: str) -> str:
    body = """
    <div class="content">
        <div class="tag">PART 0 · 03B</div>
        <h1>4SE 응답 강도 (2/2)</h1>
        <div class="rule-gold-sm"></div>
        <div class="sub">자기설계 + 자기실행 — "계획 → 행동" 축</div>
        <div class="label">▷ 자기설계 (Self-Design) %</div>
        <div class="line"></div><div class="line"></div>
        <div class="label" style="margin-top:5mm;">▷ 자기실행 (Self-Execution) %</div>
        <div class="line"></div><div class="line"></div>
    </div>
    """
    return page(body, folio, "PART 0 · 03B", "right")


def generic_filled_page(tag: str, title: str, sub: str, lines: int, folio: str, brand: str) -> str:
    line_html = "".join(['<div class="line"></div>' for _ in range(lines)])
    body = f"""
    <div class="content">
        <div class="tag">{tag}</div>
        <h1>{title}</h1>
        <div class="rule-gold-sm"></div>
        <div class="sub">{sub}</div>
        {line_html}
    </div>
    """
    return page(body, folio, brand, "right")


def domain_map_page(folio: str, page_num_in_part: int) -> str:
    """13영역 인생 지도 — 압축형 1p (12p로 분배)."""
    domains = [
        "01. 사명·비전", "02. 직업·경력", "03. 재정·자산", "04. 가족·관계",
        "05. 건강·체력", "06. 학습·성장", "07. 영성·신앙", "08. 사회·공헌",
        "09. 취미·여가", "10. 시간·습관", "11. 감정·정서", "12. 환경·공간",
        "13. 유산·기록"
    ]
    rows = "".join([
        f'<div style="display:flex; align-items:center; margin-bottom:2.5mm;">'
        f'<div style="flex:0 0 32mm; font-family:\'Noto Serif CJK KR\',serif; font-weight:600; font-size:8.5pt; color:#1B2A4A;">{d}</div>'
        f'<div style="flex:0 0 14mm; border:0.2mm solid #D6CFC0; height:5mm; text-align:center; font-family:\'Noto Serif CJK KR\',serif; font-size:7pt; color:#8A8A8A; padding-top:1mm;">__/10</div>'
        f'<div style="flex:1; border-bottom:0.2mm solid #2C2C2C; height:5mm; margin-left:3mm;"></div>'
        f'</div>'
        for d in domains
    ])
    body = f"""
    <div class="content">
        <div class="tag">PART 1 · 13영역 인생 지도 ({page_num_in_part}/12)</div>
        <h1>13영역 점수와 한 줄 메모</h1>
        <div class="rule-gold-sm"></div>
        <div class="sub">점수(/10) + 가장 약한 영역에 한 줄</div>
        {rows}
    </div>
    """
    return page(body, folio, f"PART 1 · {page_num_in_part}/12", "right")


def yearly_page(year_label: str, folio: str, side: str = "right") -> str:
    months = [(i, f"{i}월") for i in range(1, 13)]
    mm_html = "".join([
        f'<div class="mm"><div class="lbl">{lbl}</div><div class="cells"></div></div>'
        for i, lbl in months
    ])
    body = f"""
    <div class="content">
        <div class="year-head">
            <span>{year_label}</span>
            <span class="yr-ln"></span>
            <span style="font-size:7pt; font-style:italic; opacity:0.7;">YEAR · 직접 기입</span>
        </div>
        <div class="year-grid">{mm_html}</div>
    </div>
    """
    return page(body, folio, "YEARLY · UNDATED", side)


def yearly_priority_page(year_label: str, folio: str, side: str = "right") -> str:
    body = f"""
    <div class="content">
        <div class="tag">YEARLY · PRIORITY</div>
        <h1>{year_label} 우선 일정 메모</h1>
        <div class="rule-gold-sm"></div>
        <div class="sub">생일·기념일·중요 이정표 (날짜 사용자 기입)</div>
        {''.join(['<div class="line"></div>' for _ in range(18)])}
    </div>
    """
    return page(body, folio, "YEARLY · UNDATED", side)


def monthly_left_undated(month_index: int, folio: str) -> str:
    """월간 좌측 — Undated 캘린더."""
    weekdays = "".join(['<div class="head"><span class="ln"></span></div>' for _ in range(7)])
    days_html = ""
    for d in range(1, 29):
        days_html += f'<div class="day">{d}</div>'
    for d in range(29, 32):
        days_html += f'<div class="day optional">{d}</div>'
    # Pad to 35 cells (5 rows × 7)
    for _ in range(3):
        days_html += '<div class="day"></div>'
    body = f"""
    <div class="content">
        <div class="tag">MONTHLY · MONTH ___ · YEAR ____</div>
        <h1><span style="border-bottom:0.3mm solid #8A8A8A; display:inline-block; width:14mm; padding:0 2mm;">_</span>월 · 31칸 그리드</h1>
        <div class="rule-gold-sm"></div>
        <div style="display:flex; gap:4mm; padding:2mm 3mm; background:#FAF7F0; border-radius:1mm; border:0.2mm dashed #C9A04F; margin-bottom:3mm;">
            <span style="font-size:7pt; font-weight:700; color:#1B2A4A;">YEAR <span style="border-bottom:0.2mm solid #2C2C2C; display:inline-block; min-width:18mm;"></span></span>
            <span style="font-size:7pt; font-weight:700; color:#1B2A4A;">MONTH <span style="border-bottom:0.2mm solid #2C2C2C; display:inline-block; min-width:10mm;"></span></span>
            <span style="font-size:7pt; font-weight:700; color:#1B2A4A;">START DAY <span style="border-bottom:0.2mm solid #2C2C2C; display:inline-block; min-width:10mm;"></span></span>
        </div>
        <div class="month-grid">{weekdays}{days_html}</div>
    </div>
    """
    return page(body, folio, f"MONTHLY · UNDATED · {month_index}/12", "left")


def monthly_right_priority(folio: str) -> str:
    body = """
    <div class="content">
        <div class="tag">MONTHLY · PRIORITY · UNDATED</div>
        <h1>이번 달 우선순위</h1>
        <div class="rule-gold-sm"></div>
        <div class="sub">프랭클린 ABC + 인생포트폴리오 13영역</div>

        <div class="box">
            <div class="label" style="color:#C9A04F;">📌 이번 달 사명 한 줄</div>
            <div class="line"></div>
        </div>

        <div class="label" style="margin-top:5mm;">🥇 A (Must · 최우선)</div>
        <div class="line"></div><div class="line"></div>
        <div class="label">🥈 B (Should · 중요)</div>
        <div class="line"></div><div class="line"></div>
        <div class="label">🥉 C (Could · 여유시)</div>
        <div class="line"></div>

        <div class="box" style="margin-top:5mm;">
            <div class="label">📝 월말 회고 3줄</div>
            <div style="display:flex; align-items:baseline; margin-top:2mm;"><span style="flex:0 0 16mm; font-size:7.5pt; color:#1B2A4A; font-weight:600;">잘된 것</span><span style="flex:1; border-bottom:0.2mm solid #2C2C2C; height:5mm;"></span></div>
            <div style="display:flex; align-items:baseline; margin-top:2mm;"><span style="flex:0 0 16mm; font-size:7.5pt; color:#1B2A4A; font-weight:600;">배운 것</span><span style="flex:1; border-bottom:0.2mm solid #2C2C2C; height:5mm;"></span></div>
            <div style="display:flex; align-items:baseline; margin-top:2mm;"><span style="flex:0 0 16mm; font-size:7.5pt; color:#1B2A4A; font-weight:600;">다음 달</span><span style="flex:1; border-bottom:0.2mm solid #2C2C2C; height:5mm;"></span></div>
        </div>
    </div>
    """
    return page(body, folio, "MONTHLY · UNDATED", "right")


def weekly_left(week_num: int, folio: str) -> str:
    body = f"""
    <div class="content weekly-left">
        <div class="week-num">WEEK <span style="border-bottom:0.2mm solid #8A8A8A; display:inline-block; min-width:12mm; text-align:center;">{week_num:02d}</span></div>
        <div class="week-range">____.__.__ — __.__</div>
        <div class="rule-gold-sm"></div>

        <div class="label">① 이번 주 사명 한 줄</div>
        <div class="line"></div>

        <div class="label">② A · B · C 우선순위 (프랭클린 참고)</div>
        <div style="display:flex; align-items:baseline; margin-bottom:1.5mm;"><span style="flex:0 0 5mm; font-weight:800; color:#C9A04F; font-size:8pt;">A</span><div class="line" style="flex:1; margin:0;"></div></div>
        <div style="display:flex; align-items:baseline; margin-bottom:1.5mm;"><span style="flex:0 0 5mm; font-weight:700; color:#1B2A4A; font-size:8pt;">B</span><div class="line" style="flex:1; margin:0;"></div></div>
        <div style="display:flex; align-items:baseline; margin-bottom:3mm;"><span style="flex:0 0 5mm; font-weight:700; color:#1B2A4A; font-size:8pt;">C</span><div class="line" style="flex:1; margin:0;"></div></div>

        <div class="label">③ If-Then 3개 (Gollwitzer)</div>
        <div style="display:flex; align-items:baseline; margin-bottom:1.5mm;"><span style="flex:0 0 5mm; font-size:7.5pt; color:#1B2A4A;">1</span><div class="line" style="flex:1; margin:0;"></div></div>
        <div style="display:flex; align-items:baseline; margin-bottom:1.5mm;"><span style="flex:0 0 5mm; font-size:7.5pt; color:#1B2A4A;">2</span><div class="line" style="flex:1; margin:0;"></div></div>
        <div style="display:flex; align-items:baseline; margin-bottom:3mm;"><span style="flex:0 0 5mm; font-size:7.5pt; color:#1B2A4A;">3</span><div class="line" style="flex:1; margin:0;"></div></div>

        <div class="label">④ 요일별 일정 (몰스킨 참고)</div>
        <div class="weekday-row"><div class="d">월</div><div class="ln"></div></div>
        <div class="weekday-row"><div class="d">화</div><div class="ln"></div></div>
        <div class="weekday-row"><div class="d">수</div><div class="ln"></div></div>
        <div class="weekday-row"><div class="d">목</div><div class="ln"></div></div>
        <div class="weekday-row"><div class="d">금</div><div class="ln"></div></div>
        <div class="weekday-row"><div class="d weekend">토</div><div class="ln"></div></div>
        <div class="weekday-row"><div class="d weekend">일</div><div class="ln"></div></div>
    </div>
    """
    return page(body, folio, f"WEEK {week_num:02d} · LEFT", "left")


def weekly_right_deepdive(week_num: int, folio: str) -> str:
    body = f"""
    <div class="content weekly-right">
        <div class="week-num" style="color:#C9A04F; font-family:'Noto Serif CJK KR',serif; font-weight:700; font-size:12pt;">Deep Dive Day + 회고</div>
        <div class="week-range">자유 기록 영역</div>
        <div class="rule-gold-sm"></div>

        <div class="dd-box">
            <div class="dd-title">⑤ This Week's Deep Dive Day <span style="font-size:7pt; color:#C9A04F; font-style:italic;">— 주 1회 집중 기록 (호보니치 Day-Free 참고)</span></div>
            <div class="dd-row"><span class="k">DATE</span><span class="ln"></span></div>
            <div class="dd-row"><span class="k">오늘의 사건</span><span class="ln"></span></div>
            <div class="dd-row"><span class="k">감정·생각</span><span class="ln"></span></div>
            <div class="dd-row"><span class="k">한 줄 의미</span><span class="ln"></span></div>
        </div>

        <div class="label" style="color:#C9A04F;">⑥ 자유 도트 메모</div>
        <div class="dot-area"></div>

        <div class="label">⑦ 이번 주 회고 3줄 — 인생포트폴리오 IP</div>
        <div style="display:flex; align-items:baseline; margin-bottom:1.5mm;"><span style="flex:0 0 16mm; font-size:7.5pt; color:#1B2A4A; font-weight:600;">잘된 것</span><span style="flex:1; border-bottom:0.2mm solid #2C2C2C; height:5mm;"></span></div>
        <div style="display:flex; align-items:baseline; margin-bottom:1.5mm;"><span style="flex:0 0 16mm; font-size:7.5pt; color:#1B2A4A; font-weight:600;">배운 것</span><span style="flex:1; border-bottom:0.2mm solid #2C2C2C; height:5mm;"></span></div>
        <div style="display:flex; align-items:baseline; margin-bottom:1.5mm;"><span style="flex:0 0 16mm; font-size:7.5pt; color:#1B2A4A; font-weight:600;">다음 주</span><span style="flex:1; border-bottom:0.2mm solid #2C2C2C; height:5mm;"></span></div>
    </div>
    """
    return page(body, folio, f"WEEK {week_num:02d} · RIGHT", "right")


def quarterly_review_page(domain: str, folio: str, page_n: int) -> str:
    body = f"""
    <div class="content">
        <div class="tag">PART 4 · QUARTERLY REVIEW ({page_n}/18)</div>
        <h1>{domain} · 분기 회고</h1>
        <div class="rule-gold-sm"></div>
        <div class="box" style="font-size:7pt; line-height:1.6;">
            <strong style="color:#C9A04F;">Pennebaker 4문항</strong> — 사실 → 감정 → 의미 → 의도
        </div>
        <div class="label">Q1. 지난 분기 이 영역에서 가장 중요한 사건</div>
        <div class="line"></div><div class="line"></div>
        <div class="label">Q2. 그때 느낀 감정과 생각</div>
        <div class="line"></div><div class="line"></div>
        <div class="label">Q3. 그것이 내게 의미하는 바</div>
        <div class="line"></div><div class="line"></div>
        <div class="label">Q4. 다음 분기의 의도와 행동</div>
        <div class="line"></div><div class="line"></div>
    </div>
    """
    return page(body, folio, f"PART 4 · {page_n}/18", "right")


def gratitude_month_page(folio: str, n: int) -> str:
    body = f"""
    <div class="content">
        <div class="tag">PART 5 · 감사 일기 ({n}/12)</div>
        <h1><span style="border-bottom:0.3mm solid #8A8A8A; display:inline-block; width:12mm; padding:0 2mm;">_</span>월의 감사</h1>
        <div class="rule-gold-sm"></div>

        <div class="label">▷ 이번 달 감사 3가지</div>
        <div class="line"></div><div class="line"></div><div class="line"></div><div class="line"></div><div class="line"></div><div class="line"></div>

        <div class="label">▷ 예상치 못했던 좋은 일</div>
        <div class="line"></div><div class="line"></div><div class="line"></div>

        <div class="label">▷ 다음 달에 기대하는 한 가지</div>
        <div class="line"></div><div class="line"></div>
    </div>
    """
    return page(body, folio, f"PART 5 · {n}/12", "right")


def coaching_page(folio: str, n: int) -> str:
    body = f"""
    <div class="content">
        <div class="tag">PART 6 · 1:1 코칭 진척 기록 ({n}/8)</div>
        <h1>4컬럼 성과 추적 보드</h1>
        <div class="rule-gold-sm"></div>
        <table style="width:100%; border-collapse:collapse; font-size:7.5pt;">
            <thead>
                <tr style="background:#1B2A4A; color:#C9A04F;">
                    <th style="border:0.2mm solid #1B2A4A; padding:2mm; width:14%;">주차</th>
                    <th style="border:0.2mm solid #1B2A4A; padding:2mm; width:36%;">실행 과제</th>
                    <th style="border:0.2mm solid #1B2A4A; padding:2mm; width:12%;">완료</th>
                    <th style="border:0.2mm solid #1B2A4A; padding:2mm; width:38%;">성찰 메모</th>
                </tr>
            </thead>
            <tbody>
    """
    for _ in range(8):
        body += '<tr><td style="border:0.2mm solid #D6CFC0; height:11mm;"></td><td style="border:0.2mm solid #D6CFC0;"></td><td style="border:0.2mm solid #D6CFC0;"></td><td style="border:0.2mm solid #D6CFC0;"></td></tr>'
    body += """
            </tbody>
        </table>
    </div>
    """
    return page(body, folio, f"PART 6 · {n}/8", "right")


def quotes_page(folio: str, n: int) -> str:
    body = f"""
    <div class="content">
        <div class="tag">PART 7 · APPENDIX 1 ({n}/4)</div>
        <h1>성경구절 · 명언 모음</h1>
        <div class="rule-gold-sm"></div>
        <div class="sub">매주 1구절 손글씨로 옮겨 적기 (52주 분량 중 발췌)</div>
        {''.join(['<div class="box" style="font-family:\'Noto Serif CJK KR\',serif; font-size:8.5pt; line-height:1.7; min-height:18mm;">' + '"<br>― <span style=\\"color:#C9A04F;\\">_______________</span>"' + '</div>' for _ in range(5)])}
    </div>
    """
    return page(body, folio, f"PART 7 · ① {n}/4", "right")


def domain_guide_page(folio: str, n: int) -> str:
    body = f"""
    <div class="content">
        <div class="tag">PART 7 · APPENDIX 2 ({n}/2)</div>
        <h1>13영역 핵심 질문 가이드</h1>
        <div class="rule-gold-sm"></div>
        <div style="font-size:7.5pt; line-height:1.7; color:#2C2C2C;">
            <p>각 영역에서 자기진단·자기설계 시 묻는 핵심 질문:</p>
            <ol style="padding-left:5mm; margin-top:3mm;">
                <li>사명·비전 — 나는 왜 살아가는가? 어디로 가고 싶은가?</li>
                <li>직업·경력 — 내가 가장 잘 기여할 수 있는 일은?</li>
                <li>재정·자산 — 안전과 자유의 균형점은?</li>
                <li>가족·관계 — 가장 가까운 사람들에게 나는 어떤 존재인가?</li>
                <li>건강·체력 — 몸과 마음의 회복 루틴은?</li>
                <li>학습·성장 — 올해 가장 배우고 싶은 것은?</li>
                <li>영성·신앙 — 보이지 않는 것을 어떻게 마주하는가?</li>
                <li>사회·공헌 — 내가 속한 공동체에 무엇을 줄 수 있는가?</li>
                <li>취미·여가 — 회복이 되는 활동은?</li>
                <li>시간·습관 — 내 24시간의 우선순위는?</li>
                <li>감정·정서 — 내 감정의 패턴과 트리거는?</li>
                <li>환경·공간 — 나를 살리는 공간은 어떤 곳인가?</li>
                <li>유산·기록 — 내가 남기고 싶은 것은?</li>
            </ol>
        </div>
    </div>
    """
    return page(body, folio, f"PART 7 · ② {n}/2", "right")


def usage_guide_page(folio: str) -> str:
    body = """
    <div class="content">
        <div class="tag">PART 7 · APPENDIX 3</div>
        <h1>사용 가이드 (시작 · 매주 · 분기 · 연말)</h1>
        <div class="rule-gold-sm"></div>
        <div style="font-size:8pt; line-height:1.8; color:#2C2C2C;">
            <div class="box"><strong style="color:#C9A04F;">START</strong> · 첫 1시간 — Part 0 손글씨 옮겨 적기 + 시작일 기입</div>
            <div class="box"><strong style="color:#C9A04F;">매주</strong> · 30분 — Part 3 주간 펼침면 + Weekly Deep Dive Day 1회</div>
            <div class="box"><strong style="color:#C9A04F;">매월</strong> · 20분 — 월간 캘린더 회고 3줄 + Part 5 감사 일기</div>
            <div class="box"><strong style="color:#C9A04F;">분기</strong> · 90분 — Part 4 13영역 분기 회고 (Pennebaker 4문항)</div>
            <div class="box"><strong style="color:#C9A04F;">연말</strong> · 3시간 — 1년 누적 회고 + 다음 다이어리 이관</div>
        </div>
    </div>
    """
    return page(body, folio, "PART 7 · ③", "right")


def owner_page(folio: str) -> str:
    body = """
    <div class="content">
        <div class="tag">OWNER · IF FOUND</div>
        <h1>소유자 정보</h1>
        <div class="rule-gold-sm"></div>
        <div class="sub">In case of loss, please return to (분실 시 반환 요청)</div>
        <div class="owner-row"><span class="k">이름 / NAME</span><span class="ln"></span></div>
        <div class="owner-row"><span class="k">연락처 / TEL</span><span class="ln"></span></div>
        <div class="owner-row"><span class="k">이메일 / E-MAIL</span><span class="ln"></span></div>
        <div class="owner-row"><span class="k">주소 / ADDRESS</span><span class="ln"></span></div>
        <div class="owner-row"><span class="k">긴급 연락 / S.O.S</span><span class="ln"></span></div>
        <div class="box" style="margin-top:6mm;">
            <div class="label" style="color:#C9A04F;">사례 / REWARD</div>
            <div style="font-size:7.5pt; line-height:1.7; color:#2C2C2C; margin-top:2mm;">
                이 다이어리에는 한 사람의 1년이 손글씨로 담겨 있습니다.
                반환해 주시는 분께 진심으로 감사드리며, 작은 사례를 약속드립니다.
            </div>
        </div>
    </div>
    """
    return page(body, folio, "OWNER", "right")


def daily_journal_page(folio: str, n: int) -> str:
    body = f"""
    <div class="content">
        <div class="tag">PART 7 · DAILY JOURNAL ({n}/24)</div>
        <h1>데일리 저널 (Dot)</h1>
        <div class="rule-gold-sm"></div>
        <div class="sub">기록하고 싶은 날만 자유롭게 — 호보니치 Day-Free 참고</div>
        <div class="dj-head">
            <div class="cell"><span class="k">DATE</span><span class="ln"></span></div>
            <div class="cell"><span class="k">MOOD</span><span class="ln"></span></div>
            <div class="cell"><span class="k">DAY</span><span class="ln"></span></div>
        </div>
        <div class="dot-area-full"></div>
    </div>
    """
    return page(body, folio, f"DAILY · {n}/24", "right")


def vision_long_page(folio: str, n: int) -> str:
    body = f"""
    <div class="content">
        <div class="tag">PART 2 · 연간 비전 · 90일 마일스톤 ({n}/10)</div>
        <h1>연간 비전 · 분기 마일스톤</h1>
        <div class="rule-gold-sm"></div>
        <div class="box">
            <div class="label" style="color:#C9A04F;">VISION (올해의 핵심 한 문장)</div>
            <div class="line"></div><div class="line"></div>
        </div>
        <div class="label" style="margin-top:5mm;">Q1 마일스톤 (90일)</div>
        <div class="line"></div><div class="line"></div>
        <div class="label">Q2 마일스톤 (180일)</div>
        <div class="line"></div><div class="line"></div>
        <div class="label">Q3 마일스톤 (270일)</div>
        <div class="line"></div><div class="line"></div>
        <div class="label">Q4 마일스톤 (365일)</div>
        <div class="line"></div><div class="line"></div>
    </div>
    """
    return page(body, folio, f"PART 2 · {n}/10", "right")


# ════════════════════════════════════════════════════════════════
# 256p 시퀀스 빌드
# ════════════════════════════════════════════════════════════════

def build_256_page_sequence() -> str:
    pages_html = []
    p = 0

    def addp(html: str):
        nonlocal p
        p += 1
        pages_html.append(html)

    # 1-8 속표지·간지 (8p)
    addp(blank_page())                                          # 1
    addp(blank_page())                                          # 2
    addp(title_page())                                          # 3
    addp(blank_page())                                          # 4
    addp(page('<div class="content" style="display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; height:100%;"><div style="font-family:\'Noto Serif CJK KR\',serif; font-size:11pt; color:#1B2A4A; line-height:2;">당신의 1년을<br/>당신만의 방식으로<br/>기록합니다.</div><div style="margin-top:10mm; font-size:8pt; color:#C9A04F; letter-spacing:0.3em;">ONLY ONE</div></div>'))  # 5
    addp(blank_page())                                          # 6
    addp(blank_page())                                          # 7
    addp(divider_page("PART 0", "검사 리포트를 옮겨 적기", "Self-Internalization Ritual"))   # 8

    # 9-18 Part 0 (10p)
    addp(intro_with_start_date(f"p. {p+1}"))                    # 9
    addp(mission_page(f"p. {p+1}"))                             # 10
    addp(vision_page(f"p. {p+1}"))                              # 11
    addp(four_se_a_page(f"p. {p+1}"))                           # 12
    addp(four_se_b_page(f"p. {p+1}"))                           # 13
    addp(generic_filled_page("PART 0 · 04", "TOP 3 강점", "강점 3가지 — 카드 형식", 8, f"p. {p+1}", "PART 0 · 04"))   # 14
    addp(generic_filled_page("PART 0 · 05", "TOP 2 성장 포인트", "성장 영역 2가지 + If-Then 부착", 8, f"p. {p+1}", "PART 0 · 05"))   # 15
    addp(generic_filled_page("PART 0 · 06", "실행 프로파일 6필드", "유형·스타일·추진력·몰입·활동·도구", 10, f"p. {p+1}", "PART 0 · 06"))   # 16
    addp(generic_filled_page("PART 0 · 07", "추천 진로 3카드", "진로 · 교육 · 확장", 10, f"p. {p+1}", "PART 0 · 07"))   # 17
    addp(generic_filled_page("PART 0 · OUTRO", "내 다이어리가 시작되었다", "마무리 한 줄", 4, f"p. {p+1}", "PART 0 · OUTRO"))   # 18

    # 19-20 간지 (blank pair)
    addp(blank_page())                                          # 19
    addp(divider_page("PART 1", "13영역 인생 지도", "Self-Diagnosis Map"))   # 20

    # 21-32 Part 1 (12p)
    for i in range(1, 13):
        addp(domain_map_page(f"p. {p+1}", i))                   # 21-32

    # 33-36 연간 캘린더 4p
    addp(yearly_page("YEAR 1 (시작한 해) ____", f"p. {p+1}", "left"))  # 33
    addp(yearly_priority_page("YEAR 1", f"p. {p+1}", "right"))         # 34
    addp(yearly_page("YEAR 2 (다음 해) ____", f"p. {p+1}", "left"))    # 35
    addp(yearly_priority_page("YEAR 2", f"p. {p+1}", "right"))         # 36

    # 37-46 Part 2 (10p)
    addp(divider_page("PART 2", "연간 비전 · 90일 마일스톤", "Annual Vision · 90-Day Milestones"))  # 37
    for i in range(2, 11):
        addp(vision_long_page(f"p. {p+1}", i))                  # 38-46

    # 47-70 월간 캘린더 24p (12개월 × 2p)
    for m in range(1, 13):
        addp(monthly_left_undated(m, f"p. {p+1}"))              # 47, 49, 51...
        addp(monthly_right_priority(f"p. {p+1}"))               # 48, 50, 52...

    # 71-174 Part 3 주간 펼침면 52주 × 2p (104p)
    for w in range(1, 53):
        addp(weekly_left(w, f"p. {p+1}"))
        addp(weekly_right_deepdive(w, f"p. {p+1}"))

    # 175-192 Part 4 영역별 분기 회고 18p
    addp(divider_page("PART 4", "영역별 분기 회고", "Quarterly Review · Pennebaker"))  # 175
    domains_short = [
        "사명·비전", "직업·경력", "재정·자산", "가족·관계",
        "건강·체력", "학습·성장", "영성·신앙", "사회·공헌",
        "취미·여가", "시간·습관", "감정·정서", "환경·공간", "유산·기록"
    ]
    for i, dom in enumerate(domains_short, start=1):
        addp(quarterly_review_page(dom, f"p. {p+1}", i+1))      # 176-188
    # 압축형 — 13영역 13p + divider 1p = 14p (목표 18p → 4p 추가 filler)
    for _ in range(4):
        addp(blank_page(f"p. {p+1}"))                           # 189-192

    # 193-204 Part 5 감사 일기 12p
    for n in range(1, 13):
        addp(gratitude_month_page(f"p. {p+1}", n))              # 193-204

    # 205-212 Part 6 코칭 진척 8p
    for n in range(1, 9):
        addp(coaching_page(f"p. {p+1}", n))                     # 205-212

    # 213-216 Part 7-① 성경/명언 4p
    for n in range(1, 5):
        addp(quotes_page(f"p. {p+1}", n))                       # 213-216

    # 217-218 Part 7-② 13영역 가이드 2p
    for n in range(1, 3):
        addp(domain_guide_page(f"p. {p+1}", n))                 # 217-218

    # 219 Part 7-③ 사용 가이드
    addp(usage_guide_page(f"p. {p+1}"))                         # 219

    # 220 Part 7-④ Owner Profile
    addp(owner_page(f"p. {p+1}"))                               # 220

    # 221-244 Part 7-⑤ 데일리 저널 24p
    for n in range(1, 25):
        addp(daily_journal_page(f"p. {p+1}", n))                # 221-244

    # 245-256 여유 간지 12p + 마지막 2p = 14p... wait we need 14p (245-258 would be 14)
    # Recompute: target 256p. Currently at p=244. Need 12 more pages = 14p available margin.
    # Spec says 여유 간지 14p. Let me add 12 to reach 256.
    while p < 256:
        addp(blank_page(f"p. {p+1}" if p < 255 else ""))

    print(f"[INFO] Total pages generated: {p}")
    return "".join(pages_html)


# ════════════════════════════════════════════════════════════════
# Build pipeline
# ════════════════════════════════════════════════════════════════

def build_html() -> str:
    body = build_256_page_sequence()
    html = f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>인생포트폴리오 맞춤형 다이어리 v1.4 — 인쇄 직행 본문 256p</title>
<style>{PRINT_CSS}</style>
</head>
<body>
{body}
</body>
</html>"""
    return html


def render_pdf_rgb(html: str, out_path: Path):
    """WeasyPrint를 사용해 RGB PDF 생성 (폰트 임베드 자동)."""
    try:
        from weasyprint import HTML
    except ImportError:
        print("[ERROR] weasyprint not installed", file=sys.stderr)
        sys.exit(1)

    print(f"[INFO] WeasyPrint 렌더링 시작... (256 페이지)")
    HTML(string=html).write_pdf(str(out_path))
    print(f"[OK] RGB PDF 생성: {out_path}  ({out_path.stat().st_size / 1024:.1f} KB)")


def convert_to_cmyk(rgb_pdf: Path, cmyk_pdf: Path) -> bool:
    """Ghostscript을 이용해 CMYK 변환 + 폰트 임베드 확정."""
    if shutil.which("gs") is None:
        print("[WARN] Ghostscript 없음 — CMYK 변환 건너뜀. RGB PDF만 출력.")
        shutil.copy(rgb_pdf, cmyk_pdf)
        return False

    print(f"[INFO] Ghostscript CMYK 변환 시작...")
    cmd = [
        "gs",
        "-dNOPAUSE", "-dBATCH", "-dQUIET",
        "-sDEVICE=pdfwrite",
        "-dPDFSETTINGS=/prepress",         # 인쇄용 고품질
        "-dColorConversionStrategy=/CMYK",  # CMYK 강제
        "-dProcessColorModel=/DeviceCMYK",
        "-dEmbedAllFonts=true",
        "-dSubsetFonts=true",
        "-dCompatibilityLevel=1.6",
        "-dPreserveOverprintSettings=true",
        f"-sOutputFile={cmyk_pdf}",
        str(rgb_pdf),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"[ERROR] Ghostscript 실패:\n{result.stderr}", file=sys.stderr)
        shutil.copy(rgb_pdf, cmyk_pdf)
        return False
    print(f"[OK] CMYK PDF 생성: {cmyk_pdf}  ({cmyk_pdf.stat().st_size / 1024:.1f} KB)")
    return True


def main():
    print("=" * 60)
    print("인생포트폴리오 맞춤형 다이어리 v1.4")
    print("Plan A 인쇄 직행 본문 PDF 빌더")
    print("=" * 60)

    html = build_html()
    html_path = OUT_DIR / "body_256p.html"
    html_path.write_text(html, encoding="utf-8")
    print(f"[OK] HTML 임시 파일: {html_path}  ({html_path.stat().st_size / 1024:.1f} KB)")

    render_pdf_rgb(html, INTERMEDIATE_PDF)
    convert_to_cmyk(INTERMEDIATE_PDF, FINAL_PDF)

    # 최종 메타 출력
    try:
        info = subprocess.run(["pdfinfo", str(FINAL_PDF)], capture_output=True, text=True)
        print("\n── 최종 PDF 정보 ──")
        for line in info.stdout.splitlines():
            if any(k in line for k in ["Pages:", "Page size:", "PDF version:", "File size:"]):
                print(f"  {line}")
    except Exception:
        pass

    # 정리
    if INTERMEDIATE_PDF.exists() and INTERMEDIATE_PDF != FINAL_PDF:
        INTERMEDIATE_PDF.unlink()
    if html_path.exists():
        html_path.unlink()

    print(f"\n✓ 완료: {FINAL_PDF}")


if __name__ == "__main__":
    main()
