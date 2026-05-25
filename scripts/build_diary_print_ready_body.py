#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
인생포트폴리오 맞춤형 다이어리 v1.4.2 — Plan A 인쇄 직행 본문 PDF 빌더

v1.4.2 패치 (디자인 동기화 + 브랜드 정리 + 색상/폰트 고도화)
─────────────────────────────────────────────────────────────────
[디자인 동기화 — 디지털 목업과 1:1 매칭]
- 사명: 옮겨 적기 가이드 박스 + 가장 중요한 단어 1개 (placeholder)
  + 오늘의 감정 추가
- 비전: 5년 후 한 장면 (자유 묘사 박스) + 목표 연도 입력란 추가
- 4SE 1/2 · 2/2: % 입력 + bar-track + 3줄 자평 (각 SE)
- TOP3 강점: rank 카드 + 잘 쓴 순간 1줄씩 + 3강점 1문장 묶기
- TOP2 성장: G1/G2 rank + If-Then 1줄씩 + 근거 박스
- 실행 프로파일: 2×6 key·val 표 + 의외였던 1개 + 잘 맞는 환경
- 추천 진로: CARD 1/2/3 (진로/교육/확장) + 현재 일·1년 후 모습
- 13영역 펼침면: LEFT(가이드+우선순위) + RIGHT(13영역 점수표)
- 연간 캘린더: YEAR 직접 기입란 추가
- 연간 비전 LEFT: VISION 박스 + 분기 테마 + 올해의 한 단어 + 12/31 모습
- 90일 마일스톤 RIGHT: Q1/Q2/Q3 3컬럼 + Q4 wide + 분기 회고 근거 박스
- 월간 LEFT: YEAR/MONTH/START DAY 헤더 명시
- 감사 일기: 근거 박스 추가

[브랜드/저작권 정리]
- 프랭클린·몰스킨·Gollwitzer·호보니치·오롤리데이 등
  타사 브랜드명 완전 제거 (자체 제품 표현으로 일관 표기)
- 학술 인용은 일반화된 표현으로 대체
  (예: "실행 의도(Implementation Intentions) 연구 — 실행 확률 2~3배")

[색상/타이포 고도화]
- Navy #1B2A4A → British Racing Green #0A3D2A (고급 초록)
- 골드 악센트 유지 #C9A04F
- 본문 영문 헤드라인: Cormorant Garamond (고급 세리프)
- 한글 헤드라인: Noto Serif CJK KR (Bold/SemiBold 페어링)
- 본문: Noto Sans CJK KR

v1.4.1 패치 (정렬 — 유지)
- Weekly LEFT 요일 그리드 height: 20pt (sub-pixel drift 제거)
- Weekly LEFT WEEK 만년형 날짜 라인 border-bottom 라인 사용
- Ghostscript timeout=180s

출력: docs/strategy/diary/manufacturer-handoff-v1.4/print-ready/body_256p.pdf

사양:
- 페이지 사이즈: A5 trim (148 × 210 mm) + 3 mm 도련 = 154 × 216 mm
- 색상: WeasyPrint(RGB) → Ghostscript CMYK 변환
- 폰트 임베드: Cormorant Garamond + Noto Sans/Serif CJK KR (WeasyPrint 자동 임베드)
- 페이지 수: 256p (16절판 16의 배수)
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
    size: 154mm 216mm;
    margin: 0;
    bleed: 3mm;
    marks: crop;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

html, body {
    font-family: "Noto Sans CJK KR", "Noto Sans KR", sans-serif;
    color: #2C2C2C;
    background: #FFFFFF;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
}

:root {
    --brg: #0A3D2A;          /* British Racing Green — 고급 초록 */
    --brg-deep: #082E1F;      /* 더 진한 BRG (강조용) */
    --gold: #C9A04F;
    --gold-deep: #A37E2C;
    --ink: #2C2C2C;
    --ink-light: #8A8A8A;
    --cream: #FAF7F0;
    --rule: #D6CFC0;
    --weekend: #B85450;
}

.page {
    width: 154mm;
    height: 216mm;
    position: relative;
    page-break-after: always;
    padding: 14mm 12mm 12mm 12mm;
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
    font-family: "Cormorant Garamond", "Noto Serif CJK KR", serif;
    font-weight: 300;
    font-size: 54pt;
    color: var(--gold);
    letter-spacing: 0.1em;
}
.divider .part-name {
    font-family: "Noto Serif CJK KR", "Cormorant Garamond", serif;
    font-weight: 700;
    font-size: 17pt;
    color: var(--brg);
    margin-top: 8mm;
}
.divider .part-sub {
    font-family: "Cormorant Garamond", "Noto Sans CJK KR", sans-serif;
    font-weight: 500;
    font-style: italic;
    font-size: 11pt;
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
    font-family: "Cormorant Garamond", "Noto Serif CJK KR", serif;
    font-weight: 400;
    font-size: 30pt;
    letter-spacing: 0.28em;
    color: var(--brg);
}
.title-page .brand-kr {
    font-family: "Noto Serif CJK KR", serif;
    font-weight: 600;
    font-size: 13pt;
    color: var(--brg);
    margin-top: 6mm;
    letter-spacing: 0.1em;
}
.title-page .only-one {
    font-family: "Cormorant Garamond", "Noto Sans CJK KR", sans-serif;
    font-style: italic;
    font-weight: 500;
    font-size: 12pt;
    color: var(--gold);
    margin-top: 14mm;
    letter-spacing: 0.35em;
}
.title-page .undated-tag {
    font-family: "Cormorant Garamond", "Noto Sans CJK KR", sans-serif;
    font-weight: 600;
    font-size: 8.5pt;
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
    font-family: "Noto Serif CJK KR", "Cormorant Garamond", serif;
    font-weight: 700;
    font-size: 15pt;
    color: var(--brg);
    margin-bottom: 1mm;
}
.content h1 .en {
    font-family: "Cormorant Garamond", serif;
    font-weight: 500;
    font-style: italic;
    font-size: 13pt;
    color: var(--brg);
    margin-left: 2mm;
}
.content .tag {
    font-family: "Cormorant Garamond", "Noto Sans CJK KR", sans-serif;
    font-weight: 700;
    font-size: 7.5pt;
    color: var(--gold);
    letter-spacing: 0.22em;
    margin-bottom: 2mm;
}
.content .sub {
    font-family: "Noto Sans CJK KR", sans-serif;
    font-weight: 400;
    font-size: 8.5pt;
    color: var(--ink);
    margin-bottom: 3mm;
}
.content .rule-gold-sm {
    width: 16mm;
    height: 0.25mm;
    background: var(--gold);
    margin-bottom: 4mm;
}

/* 옮겨 적기 가이드 박스 (cream + gold border-left) */
.content .hw-box {
    background: var(--cream);
    border-left: 1mm solid var(--gold);
    padding: 2.5mm 3.5mm;
    margin-bottom: 4mm;
    font-size: 8pt;
    line-height: 1.65;
    color: var(--ink);
}
.content .hw-box strong { color: var(--brg); }

/* 근거 박스 (Evidence) */
.content .evidence-box {
    background: var(--cream);
    border-left: 1mm solid var(--gold);
    padding: 2.5mm 3.5mm;
    margin-top: auto;
    margin-bottom: 2mm;
    font-size: 7.5pt;
    line-height: 1.6;
    color: var(--ink);
}
.content .evidence-box .ev-label {
    color: var(--gold);
    font-weight: 700;
    margin-right: 1mm;
}
.content .evidence-box strong { color: var(--brg); }

.content .label {
    font-family: "Noto Sans CJK KR", sans-serif;
    font-weight: 700;
    font-size: 8.5pt;
    color: var(--brg);
    margin-top: 3mm;
    margin-bottom: 1mm;
    letter-spacing: 0.04em;
}
.content .field-hint {
    font-family: "Cormorant Garamond", "Noto Sans CJK KR", sans-serif;
    font-style: italic;
    font-size: 7.5pt;
    color: var(--ink-light);
    margin-top: 0.5mm;
}
.content .line {
    border-bottom: 0.2mm solid var(--ink);
    height: 6.5mm;
    margin-bottom: 1.5mm;
}
.content .line.tight {
    height: 5mm;
}
.content .blank-block {
    border: 0.2mm solid var(--rule);
    background: #FFFEFB;
    padding: 2mm 3mm;
    margin-bottom: 2mm;
}

/* ── Mission/Vision handwriting fields ────────────── */
.hw-section { display: flex; flex-direction: column; gap: 2.5mm; }

/* ── 4SE bar ──────────────────────────────────────── */
.se-block {
    margin-bottom: 5mm;
    padding: 3mm 3.5mm;
    border: 0.25mm solid var(--rule);
    background: #FFFEFB;
    border-radius: 1mm;
}
.se-block .se-label {
    font-family: "Noto Sans CJK KR", sans-serif;
    font-weight: 700;
    font-size: 9pt;
    color: var(--brg);
    margin-bottom: 1.5mm;
}
.se-block .se-pct-row {
    display: flex;
    align-items: baseline;
    gap: 3mm;
    margin-bottom: 1.5mm;
}
.se-block .se-pct-row .pct-line {
    flex: 0 0 22mm;
    border-bottom: 0.25mm solid var(--ink);
    height: 4mm;
}
.se-block .se-pct-row .pct-sym {
    font-family: "Cormorant Garamond", serif;
    font-weight: 600;
    font-size: 10pt;
    color: var(--brg);
}
.se-block .se-bar {
    height: 2mm;
    border: 0.2mm solid var(--rule);
    background: #FFFFFF;
    margin-bottom: 2mm;
    position: relative;
}
.se-block .se-hint {
    font-family: "Cormorant Garamond", "Noto Sans CJK KR", sans-serif;
    font-style: italic;
    font-size: 7pt;
    color: var(--ink-light);
    margin-bottom: 1.5mm;
}
.se-block .se-line {
    border-bottom: 0.15mm solid var(--ink);
    height: 4.5mm;
    margin-bottom: 1mm;
}

/* ── TOP3 / TOP2 cards ────────────────────────────── */
.top-card {
    display: flex;
    align-items: stretch;
    margin-bottom: 1.5mm;
}
.top-card .rank {
    flex: 0 0 8mm;
    background: var(--brg);
    color: var(--gold);
    font-family: "Cormorant Garamond", serif;
    font-weight: 700;
    font-size: 11pt;
    text-align: center;
    line-height: 8mm;
    height: 8mm;
}
.top-card .blank {
    flex: 1;
    border: 0.2mm solid var(--rule);
    border-left: none;
    height: 8mm;
}
.top-sub {
    margin-left: 11mm;
    margin-top: 0.5mm;
    margin-bottom: 3mm;
}
.top-sub .arrow {
    font-family: "Noto Sans CJK KR", sans-serif;
    font-size: 7pt;
    color: var(--ink-light);
    margin-bottom: 0.5mm;
}
.top-sub .line {
    border-bottom: 0.15mm solid var(--ink);
    height: 4.5mm;
    margin-bottom: 0;
}

/* ── 실행 프로파일 6필드 표 ───────────────────────── */
.profile-grid {
    display: grid;
    grid-template-columns: 22mm 1fr 22mm 1fr;
    gap: 0;
    border: 0.25mm solid var(--rule);
}
.profile-grid .key {
    background: var(--cream);
    border-right: 0.2mm solid var(--rule);
    border-bottom: 0.2mm solid var(--rule);
    padding: 2.5mm 3mm;
    font-family: "Noto Sans CJK KR", sans-serif;
    font-weight: 700;
    font-size: 8pt;
    color: var(--brg);
}
.profile-grid .val {
    border-right: 0.2mm solid var(--rule);
    border-bottom: 0.2mm solid var(--rule);
    height: 9mm;
    background: #FFFEFB;
}
.profile-grid .key:nth-last-child(-n+2),
.profile-grid .val:nth-last-child(-n+2) {
    border-bottom: none;
}
.profile-grid .val:nth-child(4n) { border-right: none; }
.profile-grid .key:nth-child(4n+3) { /* no special */ }

/* ── 추천 진로 3카드 ──────────────────────────────── */
.career-cards {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 3mm;
    margin-bottom: 3mm;
}
.career-cards .card {
    border: 0.25mm solid var(--rule);
    border-top: 1mm solid var(--gold);
    padding: 2.5mm;
    display: flex;
    flex-direction: column;
}
.career-cards .card .head {
    font-family: "Cormorant Garamond", "Noto Serif CJK KR", serif;
    font-weight: 700;
    font-size: 9pt;
    color: var(--brg);
    text-align: center;
    margin-bottom: 2mm;
    line-height: 1.3;
    border-bottom: 0.2mm solid var(--rule);
    padding-bottom: 1.5mm;
}
.career-cards .card .head .en {
    font-family: "Cormorant Garamond", serif;
    font-style: italic;
    color: var(--gold);
    font-size: 7.5pt;
    display: block;
    margin-top: 0.5mm;
}
.career-cards .card .blanks .ln {
    border-bottom: 0.15mm solid var(--ink);
    height: 5mm;
    margin-bottom: 1mm;
}

/* ── 13영역 가이드 (Part 1 LEFT) ─────────────────── */
.score-guide {
    background: var(--cream);
    border-left: 1mm solid var(--gold);
    padding: 2.5mm 3.5mm;
    margin-bottom: 3mm;
    font-size: 8pt;
    line-height: 1.7;
    color: var(--ink);
}
.score-guide .gh {
    font-family: "Cormorant Garamond", "Noto Sans CJK KR", sans-serif;
    color: var(--gold);
    font-weight: 700;
    font-size: 7.5pt;
    letter-spacing: 0.08em;
    margin-bottom: 1mm;
}

/* ── 13영역 점수표 ────────────────────────────────── */
.domain-table {
    display: grid;
    grid-template-columns: 6mm 30mm 14mm 1fr;
    border: 0.25mm solid var(--rule);
    font-size: 7.5pt;
}
.domain-table > div {
    border-right: 0.2mm solid var(--rule);
    border-bottom: 0.2mm solid var(--rule);
    padding: 1.8mm 2mm;
    background: #FFFEFB;
}
.domain-table .no {
    background: var(--cream);
    text-align: center;
    font-family: "Cormorant Garamond", serif;
    font-weight: 600;
    color: var(--gold);
}
.domain-table .name {
    font-family: "Noto Serif CJK KR", serif;
    font-weight: 700;
    color: var(--brg);
}
.domain-table .score {
    font-family: "Cormorant Garamond", "Noto Serif CJK KR", serif;
    text-align: center;
    color: var(--ink-light);
}
.domain-table .memo {
    border-right: none;
}
.domain-table > div:nth-last-child(-n+4) { border-bottom: none; }
.domain-table .memo:nth-last-child(1) { border-right: none; }
.domain-avg {
    margin-top: 3mm;
    background: var(--cream);
    border-left: 1mm solid var(--gold);
    padding: 2.5mm 3.5mm;
}
.domain-avg .lbl {
    font-family: "Cormorant Garamond", "Noto Sans CJK KR", sans-serif;
    color: var(--gold);
    font-weight: 700;
    font-size: 7.5pt;
    letter-spacing: 0.08em;
}
.domain-avg .num {
    font-family: "Cormorant Garamond", "Noto Serif CJK KR", serif;
    font-size: 19pt;
    font-weight: 600;
    color: var(--brg);
    margin-top: 0.5mm;
}
.domain-avg .num .of10 {
    font-size: 10pt;
    color: var(--ink-light);
    font-style: italic;
    margin-left: 2mm;
}

/* ── 연간 비전 LEFT ───────────────────────────────── */
.vision-big-box {
    border: 0.3mm solid var(--rule);
    border-left: 1mm solid var(--gold);
    background: var(--cream);
    padding: 3mm 4mm;
    margin-bottom: 4mm;
}
.vision-big-box .lbl {
    font-family: "Cormorant Garamond", "Noto Sans CJK KR", sans-serif;
    color: var(--gold);
    font-weight: 700;
    font-size: 8pt;
    letter-spacing: 0.15em;
    margin-bottom: 1.5mm;
}
.vision-big-box .ln {
    border-bottom: 0.2mm solid var(--ink);
    height: 5.5mm;
    margin-bottom: 1mm;
}
.word-of-year {
    border: 0.3mm dashed var(--gold);
    background: #FFFEFB;
    text-align: center;
    padding: 4mm 0;
}
.word-of-year .wd {
    font-family: "Cormorant Garamond", "Noto Serif CJK KR", serif;
    font-size: 22pt;
    color: var(--gold);
    font-weight: 600;
    letter-spacing: 0.2em;
    border-bottom: 0.3mm solid var(--ink-light);
    display: inline-block;
    padding: 0 8mm 1mm;
}

/* ── 90일 마일스톤 ────────────────────────────────── */
.q-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 2.5mm;
    margin-bottom: 3mm;
}
.q-grid .qbox {
    border: 0.25mm solid var(--rule);
    border-top: 0.7mm solid var(--brg);
    padding: 2.5mm 3mm;
}
.q-grid .qbox .qh {
    font-family: "Cormorant Garamond", "Noto Serif CJK KR", serif;
    font-weight: 700;
    font-size: 9pt;
    color: var(--brg);
    margin-bottom: 1.5mm;
}
.q-grid .qbox .ln {
    border-bottom: 0.15mm solid var(--ink);
    height: 5mm;
    margin-bottom: 1mm;
}
.q4-wide {
    border: 0.25mm solid var(--rule);
    border-top: 0.7mm solid var(--gold);
    padding: 2.5mm 3mm;
    margin-bottom: 3mm;
}
.q4-wide .qh {
    font-family: "Cormorant Garamond", "Noto Serif CJK KR", serif;
    font-weight: 700;
    font-size: 9pt;
    color: var(--gold);
    margin-bottom: 1.5mm;
}
.q4-wide .ln {
    border-bottom: 0.15mm solid var(--ink);
    height: 5mm;
    margin-bottom: 1mm;
}

/* ── Weekly spread (left page · 계획) ─────────────── */
.weekly-left .week-num {
    font-family: "Cormorant Garamond", "Noto Serif CJK KR", serif;
    font-weight: 700;
    font-size: 13pt;
    color: var(--brg);
    letter-spacing: 0.05em;
}
.weekly-left .week-range {
    font-family: "Noto Sans CJK KR", sans-serif;
    font-size: 8pt;
    color: var(--ink-light);
    font-style: italic;
    margin-bottom: 3mm;
}
/* Weekly LEFT 요일 표 (v1.4.1 정렬 유지) */
.weekly-left .weekday-table {
    width: 100%;
    border-collapse: collapse;
    border-spacing: 0;
    margin-top: 1mm;
    table-layout: fixed;
}
.weekly-left .weekday-table td {
    height: 20pt;
    border-bottom: 0.25mm solid var(--ink);
    padding: 0 0 1.2mm 8mm;
    vertical-align: bottom;
    line-height: 1;
    position: relative;
}
.weekly-left .weekday-table td .d {
    position: absolute;
    left: 0;
    bottom: 1.2mm;
    font-family: "Noto Sans CJK KR", sans-serif;
    font-weight: 700;
    font-size: 8pt;
    color: var(--brg);
    line-height: 1;
}
.weekly-left .weekday-table td .d.weekend { color: var(--weekend); }
.weekly-left .wk-date-line {
    display: grid;
    grid-template-columns: 22mm 4mm 14mm;
    column-gap: 3mm;
    align-items: end;
    margin-top: 2mm;
    margin-bottom: 1mm;
}
.weekly-left .wk-date-line .seg {
    border-bottom: 0.25mm solid var(--ink);
    height: 5mm;
}
.weekly-left .wk-date-line .dash {
    text-align: center;
    color: var(--ink-light);
    font-size: 8pt;
    padding-bottom: 0.8mm;
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
    color: var(--brg);
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
    color: var(--brg);
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
.month-header-field {
    display: flex;
    gap: 4mm;
    padding: 2mm 3mm;
    background: var(--cream);
    border-radius: 1mm;
    border: 0.2mm dashed var(--gold);
    margin-bottom: 3mm;
}
.month-header-field .mhf-cell {
    display: flex;
    align-items: baseline;
    gap: 2mm;
    flex: 1;
}
.month-header-field .mhf-label {
    font-family: "Cormorant Garamond", "Noto Sans CJK KR", sans-serif;
    font-weight: 700;
    font-size: 7pt;
    color: var(--brg);
    letter-spacing: 0.1em;
}
.month-header-field .mhf-line {
    flex: 1;
    border-bottom: 0.25mm solid var(--ink);
    height: 4mm;
    min-width: 12mm;
}
.month-header-field .mhf-line.short { min-width: 8mm; flex: 0 0 12mm; }

.month-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 0;
    border: 0.3mm solid var(--rule);
    flex: 1;
    margin-top: 2mm;
}
.month-grid .head {
    background: var(--cream);
    border: 0.2mm solid var(--rule);
    padding: 2mm 1mm;
    text-align: center;
    font-family: "Noto Sans CJK KR", sans-serif;
    font-weight: 700;
    font-size: 7pt;
    color: var(--brg);
}
.month-grid .head .ln {
    display: inline-block;
    width: 70%;
    border-bottom: 0.2mm solid var(--ink);
}
.month-grid .day {
    border: 0.2mm solid var(--rule);
    min-height: 13mm;
    padding: 1mm 1.5mm;
    background: #FFFFFF;
    font-family: "Cormorant Garamond", "Noto Serif CJK KR", serif;
    font-size: 7.5pt;
    font-weight: 500;
    color: var(--ink-light);
}
.month-grid .day.optional {
    background: repeating-linear-gradient(45deg, #FFFFFF 0 1mm, var(--cream) 1mm 1.2mm);
}

/* ── Monthly RIGHT (priority) ─────────────────────── */
.month-mission {
    background: var(--cream);
    border-left: 1mm solid var(--gold);
    padding: 2.5mm 3.5mm;
    margin-bottom: 3mm;
}
.month-mission .lbl {
    font-family: "Noto Sans CJK KR", sans-serif;
    font-weight: 700;
    font-size: 8.5pt;
    color: var(--gold);
    margin-bottom: 1mm;
}
.month-prio { margin-bottom: 3mm; }
.month-prio .row {
    display: flex;
    align-items: baseline;
    margin-bottom: 1.2mm;
}
.month-prio .row .rk {
    flex: 0 0 10mm;
    font-family: "Cormorant Garamond", "Noto Sans CJK KR", sans-serif;
    font-weight: 800;
    font-size: 9pt;
    color: var(--brg);
}
.month-prio .row.A .rk { color: var(--gold); }
.month-prio .row .rv {
    flex: 1;
    border-bottom: 0.2mm solid var(--ink);
    height: 5.5mm;
}
.month-prio .row-label {
    font-family: "Noto Sans CJK KR", sans-serif;
    font-weight: 700;
    font-size: 8pt;
    color: var(--brg);
    margin-top: 2mm;
    margin-bottom: 0.5mm;
}
.month-review {
    border: 0.25mm solid var(--rule);
    border-left: 1mm solid var(--gold);
    background: var(--cream);
    padding: 2.5mm 3.5mm;
    margin-top: auto;
}
.month-review .lbl {
    font-family: "Noto Sans CJK KR", sans-serif;
    font-weight: 700;
    font-size: 8.5pt;
    color: var(--brg);
    margin-bottom: 1.5mm;
}
.month-review .rr {
    display: flex;
    align-items: baseline;
    margin-bottom: 1.5mm;
}
.month-review .rr .k {
    flex: 0 0 16mm;
    font-family: "Noto Sans CJK KR", sans-serif;
    font-weight: 600;
    font-size: 7.5pt;
    color: var(--brg);
}
.month-review .rr .v {
    flex: 1;
    border-bottom: 0.2mm solid var(--ink);
    height: 5mm;
}

/* ── Yearly mini-month grid (12 / page) ───────────── */
.year-head {
    background: var(--brg);
    color: var(--gold);
    padding: 2.5mm 4mm;
    font-family: "Cormorant Garamond", "Noto Sans CJK KR", sans-serif;
    font-weight: 700;
    font-size: 10pt;
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
.year-head .yr-hint {
    font-family: "Cormorant Garamond", serif;
    font-style: italic;
    font-size: 7.5pt;
    color: var(--gold);
    opacity: 0.85;
    letter-spacing: 0.05em;
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
    font-family: "Cormorant Garamond", "Noto Serif CJK KR", serif;
    font-weight: 700;
    font-size: 8pt;
    color: var(--brg);
    margin-bottom: 1mm;
}
.year-grid .mm .cells {
    flex: 1;
    background-image:
        linear-gradient(0deg, transparent 16%, rgba(10,61,42,0.14) 16%, rgba(10,61,42,0.14) 17%, transparent 17%),
        linear-gradient(0deg, transparent 33%, rgba(10,61,42,0.14) 33%, rgba(10,61,42,0.14) 34%, transparent 34%),
        linear-gradient(0deg, transparent 50%, rgba(10,61,42,0.14) 50%, rgba(10,61,42,0.14) 51%, transparent 51%),
        linear-gradient(0deg, transparent 67%, rgba(10,61,42,0.14) 67%, rgba(10,61,42,0.14) 68%, transparent 68%),
        linear-gradient(0deg, transparent 83%, rgba(10,61,42,0.14) 83%, rgba(10,61,42,0.14) 84%, transparent 84%);
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
    font-family: "Cormorant Garamond", "Noto Sans CJK KR", sans-serif;
    font-weight: 700;
    font-size: 7.5pt;
    color: var(--brg);
    letter-spacing: 0.1em;
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
    font-family: "Cormorant Garamond", "Noto Sans CJK KR", sans-serif;
    font-weight: 700;
    font-size: 8.5pt;
    color: var(--brg);
    letter-spacing: 0.05em;
}
.owner-row .ln {
    flex: 1;
    border-bottom: 0.25mm solid var(--ink);
    height: 6mm;
}

/* ── Coaching table ───────────────────────────────── */
.coaching-tbl {
    width: 100%;
    border-collapse: collapse;
    font-size: 7.5pt;
}
.coaching-tbl thead tr {
    background: var(--brg);
    color: var(--gold);
}
.coaching-tbl th {
    border: 0.2mm solid var(--brg);
    padding: 2mm;
    font-family: "Cormorant Garamond", "Noto Sans CJK KR", sans-serif;
    font-weight: 700;
    letter-spacing: 0.05em;
}
.coaching-tbl td {
    border: 0.2mm solid var(--rule);
    height: 11mm;
}

/* ── Quotes box ───────────────────────────────────── */
.quote-card {
    border: 0.25mm solid var(--rule);
    border-left: 1mm solid var(--gold);
    background: var(--cream);
    padding: 3mm 4mm;
    margin-bottom: 3mm;
    min-height: 18mm;
    font-family: "Cormorant Garamond", "Noto Serif CJK KR", serif;
    font-size: 9pt;
    font-style: italic;
    line-height: 1.65;
    color: var(--ink);
}
.quote-card .src {
    text-align: right;
    margin-top: 2mm;
    color: var(--gold);
    font-style: normal;
    font-weight: 600;
    font-size: 7.5pt;
}

.blank-page {
    height: 100%;
    width: 100%;
    background: #FFFFFF;
}

/* Free Notes (p.245-256) */
.free-notes-page { padding-top: 4mm; }
.free-notes-area {
    position: relative;
    width: 100%;
    height: 150mm;
    margin-top: 6mm;
    border-top: 0.15mm solid var(--rule);
    padding-top: 4mm;
}
.free-dots {
    position: relative;
    width: 95mm;
    height: 140mm;
    margin: 0 auto;
}
.free-dots .dot {
    position: absolute;
    width: 0.4mm;
    height: 0.4mm;
    background: #C8C2B0;
    border-radius: 50%;
}

/* Footer note for divider's last page */
.section-end-note {
    position: absolute;
    bottom: 8mm;
    left: 0;
    right: 0;
    text-align: center;
    font-family: "Cormorant Garamond", "Noto Sans CJK KR", sans-serif;
    font-style: italic;
    font-size: 7pt;
    color: var(--ink-light);
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


def free_notes_page(folio_text: str, side: str = "right", page_num: int = 1, total: int = 12) -> str:
    """자유 메모 페이지 — 도트 그리드 + 헤더 (16절판 페이지 수 맞추기용 간지를 실용 메모로 변환)"""
    # 도트 그리드 (5mm 간격, 28행 × 19열)
    dots_html = '<div class="free-dots">'
    for row in range(28):
        for col in range(19):
            dots_html += f'<span class="dot" style="top:{row*5}mm; left:{col*5}mm;"></span>'
    dots_html += '</div>'

    body = f"""
    <div class="content free-notes-page">
        <div class="folio-section" style="color:var(--gold);">FREE NOTES · 자유 메모</div>
        <h1 style="font-size:16pt;">생각의 여백</h1>
        <div class="sub" style="color:var(--ink-light); font-size:8.5pt;">
            아이디어 · 인용구 · 스케치 · 즉흥 메모 · 미래에게 보내는 편지 — 무엇이든
            <span style="color:var(--brg); font-weight:600;">({page_num}/{total})</span>
        </div>
        <div class="free-notes-area">
            {dots_html}
        </div>
    </div>
    """
    return page(body, folio_text, "", side)


def title_page() -> str:
    body = """
    <div class="title-page">
        <div class="brand-en">LIFE PORTFOLIO</div>
        <div class="brand-kr">인생포트폴리오 맞춤형 다이어리</div>
        <div class="only-one">Only One</div>
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
        <div class="tag">PART 0 · INTRO · HOW TO START</div>
        <h1>검사 리포트를 손으로 옮겨 적는다</h1>
        <div class="rule-gold-sm"></div>
        <div class="sub">7항목 × 1p · 자기화(自己化) 의식 · <strong>당신이 시작한 날부터 1년</strong></div>

        <div class="hw-box">
            <div style="font-family:'Cormorant Garamond','Noto Sans CJK KR',sans-serif; color:var(--gold); font-weight:700; font-size:8pt; letter-spacing:0.15em; margin-bottom:1.5mm;">▲ START · 나의 인생포트폴리오 1년이 시작되는 날</div>
            <div style="display:flex; gap:6mm; align-items:baseline; margin-top:2mm;">
                <div style="display:flex; align-items:baseline; gap:2mm;">
                    <span style="border-bottom:0.3mm solid var(--brg); display:inline-block; width:24mm; height:6mm;"></span>
                    <span style="font-family:'Noto Serif CJK KR',serif; font-size:9pt;">년</span>
                </div>
                <div style="display:flex; align-items:baseline; gap:2mm;">
                    <span style="border-bottom:0.3mm solid var(--brg); display:inline-block; width:14mm; height:6mm;"></span>
                    <span style="font-family:'Noto Serif CJK KR',serif; font-size:9pt;">월</span>
                </div>
                <div style="display:flex; align-items:baseline; gap:2mm;">
                    <span style="border-bottom:0.3mm solid var(--brg); display:inline-block; width:14mm; height:6mm;"></span>
                    <span style="font-family:'Noto Serif CJK KR',serif; font-size:9pt;">일</span>
                </div>
            </div>
            <div style="font-family:'Cormorant Garamond',sans-serif; font-style:italic; font-size:7.5pt; color:var(--ink-light); margin-top:2.5mm; line-height:1.55;">
                ※ 이 다이어리는 만년형(Undated)입니다. 신년이 아닌 <strong style="font-style:normal;">리포트를 받은 날</strong>이 곧 출발일입니다.
                1월에 사도, 7월에 사도, 11월에 사도 — <strong style="font-style:normal;">당신이 시작한 그 날부터 1년</strong>을 기록합니다.
            </div>
        </div>

        <div class="hw-box" style="margin-bottom:3mm;">
            <strong>왜 손으로 적는가?</strong>
            손글씨는 키보드 입력보다 <strong>개념 이해</strong>와 <strong>장기 기억</strong>에 유리합니다.
            검사 리포트의 <strong>7개 핵심 결과</strong>를 직접 옮겨 적는 의식을 통해 데이터가 "내 것"이 됩니다.
        </div>

        <div class="label">▶ 다음 7페이지에 옮겨 적을 항목</div>
        <ol style="font-size:8.5pt; line-height:1.9; padding-left:5mm; color:var(--ink); margin-top:1mm;">
            <li>사명 (Mission) · 비전 (Vision) <span style="color:var(--ink-light);">— 2p</span></li>
            <li>4SE 응답 강도 (%) <span style="color:var(--ink-light);">— 인식/표출, 계획/행동 2p</span></li>
            <li>TOP 3 강점 · TOP 2 성장 포인트 <span style="color:var(--ink-light);">— 2p</span></li>
            <li>실행 프로파일 6필드 · 추천 진로 3카드 <span style="color:var(--ink-light);">— 2p</span></li>
        </ol>

        <div style="margin-top:auto; padding-top:4mm; border-top:0.2mm solid var(--rule); text-align:center; font-family:'Cormorant Garamond',serif; font-style:italic; font-size:8.5pt; color:var(--ink-light);">
            "받은 것을 글로 옮길 때, 그것은 정보에서 자기 것이 된다."
        </div>
    </div>
    """
    return page(body, folio, "PART 0 · INTRO", "right")


def mission_page(folio: str) -> str:
    """디지털 목업 동기화 — 가이드 박스 + 핵심/보조 + 가장 중요한 단어 + 오늘의 감정."""
    body = """
    <div class="content">
        <div class="tag">PART 0 · 01</div>
        <h1>사명 <span class="en">(Mission)</span></h1>
        <div class="rule-gold-sm"></div>
        <div class="sub">검사 리포트 1페이지 · 사명 카드를 옮겨 적으세요</div>

        <div class="hw-box">
            <strong>옮겨 적기:</strong> 리포트의 <strong>핵심 문장 1줄</strong>과 <strong>보조 문장 1줄</strong>을 그대로 적습니다.
            긴 사명일수록 가장 핵심 단어 하나를 동그라미로 표시해보세요.
        </div>

        <div class="hw-section">
            <div>
                <div class="label">▶ 핵심 문장 (1줄)</div>
                <div class="line"></div>
                <div class="line"></div>
            </div>

            <div>
                <div class="label">▶ 보조 문장 (1줄)</div>
                <div class="line"></div>
                <div class="line"></div>
            </div>

            <div>
                <div class="label">▶ 이 사명에서 가장 중요한 단어 1개</div>
                <div class="blank-block" style="min-height:11mm;">
                    <div class="field-hint">예) "회복" / "다리" / "기록자" — 동그라미를 치고 옮겨 적기</div>
                </div>
            </div>

            <div>
                <div class="label">▶ 이 사명을 처음 마주한 오늘의 감정</div>
                <div class="line"></div>
                <div class="line tight"></div>
            </div>
        </div>
    </div>
    """
    return page(body, folio, "PART 0 · MISSION", "right")


def vision_page(folio: str) -> str:
    """디지털 목업 동기화 — 가이드 박스 + 핵심/보조 + 5년 후 한 장면 + 목표 연도."""
    body = """
    <div class="content">
        <div class="tag">PART 0 · 02</div>
        <h1>비전 <span class="en">(Vision)</span></h1>
        <div class="rule-gold-sm"></div>
        <div class="sub">검사 리포트 1페이지 · 비전 카드를 옮겨 적으세요</div>

        <div class="hw-box">
            <strong>비전 = 사명이 그려내는 미래 풍경.</strong> 사명이 "왜 사는가"라면 비전은 "어디로 가는가"입니다.
            5~10년 후 가장 또렷한 한 장면을 그대로 옮겨 적습니다.
        </div>

        <div class="hw-section">
            <div>
                <div class="label">▶ 비전 핵심 문장 (1줄)</div>
                <div class="line"></div>
                <div class="line"></div>
            </div>

            <div>
                <div class="label">▶ 비전 보조 문장 (1줄)</div>
                <div class="line"></div>
                <div class="line"></div>
            </div>

            <div>
                <div class="label">▶ 이 비전이 이뤄진 5년 후 한 장면 (자유 묘사)</div>
                <div class="blank-block" style="min-height:24mm;">
                    <div class="field-hint">시간 · 장소 · 누구와 · 무엇을 하고 있는가</div>
                </div>
            </div>

            <div>
                <div class="label">▶ 비전 달성 시점 목표 연도</div>
                <div class="line tight" style="max-width:40mm;"></div>
            </div>
        </div>
    </div>
    """
    return page(body, folio, "PART 0 · VISION", "right")


def _se_block(label_kr: str, label_en: str, hint: str) -> str:
    """4SE 한 셀: 라벨 + % 입력 + bar + 3줄 자평."""
    return f"""
    <div class="se-block">
        <div class="se-label">{label_kr} <span style="color:var(--gold); font-family:'Cormorant Garamond',serif; font-weight:500; font-style:italic; font-size:8pt;">({label_en})</span></div>
        <div class="se-pct-row">
            <span class="pct-line"></span>
            <span class="pct-sym">%</span>
        </div>
        <div class="se-bar"></div>
        <div class="se-hint">{hint}</div>
        <div class="se-line"></div>
        <div class="se-line"></div>
        <div class="se-line"></div>
    </div>
    """


def four_se_a_page(folio: str) -> str:
    body = f"""
    <div class="content">
        <div class="tag">PART 0 · 03A</div>
        <h1>4SE 응답 강도 (%) — 1/2</h1>
        <div class="rule-gold-sm"></div>
        <div class="sub">자기이해 · 자기표현 (인식 → 표출 축)</div>

        <div class="hw-box">
            <strong>4SE</strong>는 인생포트폴리오의 자기인식 4축입니다. 리포트 점수를
            <strong>0~100%</strong> 단위로 옮기고, 강한 축과 약한 축의 차이를 손글씨로 분석하세요.
        </div>

        {_se_block("SE1. 자기이해", "Self-Understanding", "3줄 자평")}
        {_se_block("SE2. 자기표현", "Self-Expression", "3줄 자평")}
    </div>
    """
    return page(body, folio, "PART 0 · 4SE (1/2)", "right")


def four_se_b_page(folio: str) -> str:
    body = f"""
    <div class="content">
        <div class="tag">PART 0 · 03B</div>
        <h1>4SE 응답 강도 (%) — 2/2</h1>
        <div class="rule-gold-sm"></div>
        <div class="sub">자기설계 · 자기실행 (계획 → 행동 축)</div>

        <div class="hw-box">
            이어지는 계획·행동 축입니다. <strong>SE3 · SE4</strong> 점수를 옮기고,
            가장 강한 축과 약한 축의 갭(GAP)이 곧 다음 1년 성장 포인트입니다.
        </div>

        {_se_block("SE3. 자기설계", "Self-Design", "3줄 자평")}
        {_se_block("SE4. 자기실행", "Self-Execution", "3줄 자평")}
    </div>
    """
    return page(body, folio, "PART 0 · 4SE (2/2)", "right")


def top3_strengths_page(folio: str) -> str:
    """디지털 목업 — TOP3 강점 카드 + 각 강점 잘 쓴 순간 + 3강점 1문장."""
    cards = ""
    for r in ["1", "2", "3"]:
        cards += f"""
        <div class="top-card">
            <div class="rank">{r}</div>
            <div class="blank"></div>
        </div>
        <div class="top-sub">
            <div class="arrow">└ 내가 이 강점을 가장 잘 쓴 순간 1개</div>
            <div class="line"></div>
        </div>
        """
    body = f"""
    <div class="content">
        <div class="tag">PART 0 · 04</div>
        <h1>TOP 3 강점</h1>
        <div class="rule-gold-sm"></div>
        <div class="sub">성장 가이드맵에서 발췌해 옮기세요</div>

        <div class="hw-box">
            강점은 <strong>이미 잘 하고 있는 것</strong>이 아니라 <strong>에너지를 얻으며 자라는 영역</strong>입니다.
            리포트의 TOP3 강점을 순위 그대로 옮겨 적고, 1줄 자기 해석을 덧붙이세요.
        </div>

        {cards}

        <div style="margin-top:auto;">
            <div class="label">▶ 이 3가지 강점을 한 문장으로 묶으면</div>
            <div class="line"></div>
            <div class="line tight"></div>
        </div>
    </div>
    """
    return page(body, folio, "PART 0 · TOP3 STRENGTHS", "right")


def top2_growth_page(folio: str) -> str:
    """디지털 목업 — TOP2 성장 포인트 + If-Then + 근거 박스."""
    cards = ""
    for r in ["G1", "G2"]:
        cards += f"""
        <div class="top-card">
            <div class="rank">{r}</div>
            <div class="blank"></div>
        </div>
        <div class="top-sub" style="margin-bottom:5mm;">
            <div class="arrow" style="font-weight:600; color:var(--brg);">If-Then 한 줄 (실행 조건 → 실행 행동)</div>
            <div class="line tight"></div>
            <div class="line tight"></div>
        </div>
        """
    body = f"""
    <div class="content">
        <div class="tag">PART 0 · 05</div>
        <h1>TOP 2 성장 포인트</h1>
        <div class="rule-gold-sm"></div>
        <div class="sub">약점이 아닙니다 — 다음 한 점에서 자라날 영역입니다</div>

        <div class="hw-box">
            성장 포인트는 <strong>고쳐야 할 결점</strong>이 아니라, 강점이 더 멀리 가도록 받쳐줄 <strong>다음 한 점</strong>입니다.
            리포트의 TOP2를 옮긴 뒤, 각각에 If-Then 한 줄을 만드세요.
        </div>

        {cards}

        <div class="evidence-box">
            <span class="ev-label">근거:</span> 실행 의도(Implementation Intentions) 연구 — "If X happens, then I will do Y" 형태로 적은 의도는 그렇지 않은 의도보다 실행 확률이 <strong>2~3배</strong> 높습니다.
        </div>
    </div>
    """
    return page(body, folio, "PART 0 · TOP2 GROWTH", "right")


def execution_profile_page(folio: str) -> str:
    """디지털 목업 — 실행 프로파일 6필드 표."""
    body = """
    <div class="content">
        <div class="tag">PART 0 · 06</div>
        <h1>실행 프로파일 6필드</h1>
        <div class="rule-gold-sm"></div>
        <div class="sub">유형 · 스타일 · 추진력 · 몰입환경 · 활동 · 도구</div>

        <div class="hw-box">
            실행 프로파일은 "어떻게 일할 때 가장 나다운가"를 알려주는 6개의 좌표입니다.
            리포트의 6필드를 빠뜨리지 말고 그대로 옮기세요. 다이어리 작성 내내 참고할 기준선입니다.
        </div>

        <div class="profile-grid">
            <div class="key">유형</div>      <div class="val"></div>
            <div class="key">스타일</div>    <div class="val"></div>
            <div class="key">추진력</div>    <div class="val"></div>
            <div class="key">몰입환경</div>  <div class="val"></div>
            <div class="key">활동</div>      <div class="val"></div>
            <div class="key">도구</div>      <div class="val"></div>
        </div>

        <div style="margin-top:5mm;">
            <div class="label">▶ 이 6필드 중 가장 의외였던 1개와 이유</div>
            <div class="line"></div>
            <div class="line tight"></div>
        </div>

        <div style="margin-top:auto;">
            <div class="label">▶ 이 프로파일이 가장 잘 맞는 환경 1줄 묘사</div>
            <div class="line"></div>
            <div class="line tight"></div>
        </div>
    </div>
    """
    return page(body, folio, "PART 0 · EXECUTION PROFILE", "right")


def career_3cards_page(folio: str) -> str:
    """디지털 목업 — 추천 진로 3카드."""
    body = """
    <div class="content">
        <div class="tag">PART 0 · 07</div>
        <h1>추천 진로 3카드</h1>
        <div class="rule-gold-sm"></div>
        <div class="sub">추천 진로 · 추천 교육 · 확장 방향</div>

        <div class="hw-box">
            추천 진로 3카드는 "지금 당장 옮길 직업"이 아닙니다. 사명·비전·강점을 합쳐 만든 <strong>가능성의 지도</strong>입니다.
            현재 일과 어떻게 연결될지 메모를 덧붙이세요.
        </div>

        <div class="career-cards">
            <div class="card">
                <div class="head">CARD 1<span class="en">추천 진로</span></div>
                <div class="blanks">
                    <div class="ln"></div><div class="ln"></div><div class="ln"></div>
                </div>
            </div>
            <div class="card">
                <div class="head">CARD 2<span class="en">추천 교육</span></div>
                <div class="blanks">
                    <div class="ln"></div><div class="ln"></div><div class="ln"></div>
                </div>
            </div>
            <div class="card">
                <div class="head">CARD 3<span class="en">확장 방향</span></div>
                <div class="blanks">
                    <div class="ln"></div><div class="ln"></div><div class="ln"></div>
                </div>
            </div>
        </div>

        <div style="margin-top:3mm;">
            <div class="label">▶ 현재 일과 가장 가까운 카드는?</div>
            <div class="line"></div>
        </div>

        <div style="margin-top:2mm;">
            <div class="label">▶ 이 3카드가 1년 후 어떤 모습이면 만족스러울까?</div>
            <div class="line"></div>
            <div class="line"></div>
            <div class="line tight"></div>
        </div>
    </div>
    """
    return page(body, folio, "PART 0 · CAREER · END", "right")


def part0_outro_page(folio: str) -> str:
    body = """
    <div class="content">
        <div class="tag">PART 0 · OUTRO</div>
        <h1>내 다이어리가 시작되었다</h1>
        <div class="rule-gold-sm"></div>
        <div class="sub">검사 리포트 7항목을 모두 옮겨 적었습니다 — 이제부터 1년</div>

        <div class="hw-box">
            7개 페이지를 모두 채우셨다면, 이 다이어리는 더 이상 빈 책이 아닙니다.
            <strong>검사 리포트가 손글씨로 옮겨진 세상에 단 하나뿐인 책</strong>이 되었습니다.
        </div>

        <div style="margin-top:5mm;">
            <div class="label">▶ 옮겨 적기를 마친 오늘의 한 줄 소감</div>
            <div class="line"></div>
            <div class="line"></div>
            <div class="line tight"></div>
        </div>

        <div style="margin-top:auto; text-align:center; padding:6mm 0; border-top:0.2mm solid var(--rule); border-bottom:0.2mm solid var(--rule);">
            <div style="font-family:'Cormorant Garamond','Noto Serif CJK KR',serif; font-style:italic; font-size:11pt; color:var(--brg); line-height:1.7;">
                "다이어리는 비어 있을 때 가장 무겁고,<br>
                채워질 때 가장 가볍다."
            </div>
        </div>
    </div>
    """
    return page(body, folio, "PART 0 · OUTRO", "right")


def domain_map_left(folio: str) -> str:
    """13영역 인생 지도 — LEFT (가이드 + 우선순위)."""
    body = """
    <div class="content">
        <div class="tag">PART 1 · LEFT</div>
        <h1>13영역 인생 지도</h1>
        <div class="rule-gold-sm"></div>
        <div class="sub">인생포트폴리오 IP · 영역별 점수와 한 줄 메모</div>

        <div style="font-size:8.5pt; color:var(--ink); line-height:1.75; margin-bottom:4mm;">
            인생은 한 가지 직업·역할로 환원되지 않습니다.
            <strong style="color:var(--brg);">13개 영역</strong>이 어떻게 균형을 이루는지 점수를 매겨보고, 가장 약한 영역에 한 줄 메모를 남기세요.
        </div>

        <div class="score-guide">
            <div class="gh">점수 가이드</div>
            <div>1~3: 거의 비어있음 / 4~6: 보통 / 7~9: 충실 / 10: 만족<br>
            <span style="color:var(--ink-light); font-style:italic;">※ 한 영역에 몰리지 않게 균형을 보세요</span></div>
        </div>

        <div>
            <div class="label">▶ 가장 키우고 싶은 영역 3개 (우선순위)</div>
            <div class="line"></div>
            <div class="line"></div>
            <div class="line"></div>
        </div>

        <div style="margin-top:auto;">
            <div class="label">▶ 올해 한 영역만 집중한다면?</div>
            <div class="line"></div>
            <div class="line tight"></div>
        </div>
    </div>
    """
    return page(body, folio, "PART 1 · LIFE MAP · LEFT", "left")


def domain_map_right(folio: str) -> str:
    """13영역 인생 지도 — RIGHT (점수표)."""
    domains = [
        ("1", "신앙·소명"), ("2", "가족·관계"), ("3", "직업·경력"),
        ("4", "재정·자산"), ("5", "건강·체력"), ("6", "학습·성장"),
        ("7", "취미·여가"), ("8", "봉사·기여"), ("9", "자기관리"),
        ("10", "거주·환경"), ("11", "인간관계"), ("12", "정서·내면"),
        ("13", "유산·미래"),
    ]
    rows = ""
    for no, name in domains:
        rows += f'<div class="no">{no}</div><div class="name">{name}</div><div class="score">/10</div><div class="memo"></div>'
    body = f"""
    <div class="content">
        <div class="tag">PART 1 · RIGHT</div>
        <h1>13영역 점수표</h1>
        <div class="rule-gold-sm"></div>
        <div class="sub">현재 (___ / 10) · 한 줄 메모</div>

        <div class="domain-table">
            {rows}
        </div>

        <div class="domain-avg">
            <div class="lbl">평균 점수</div>
            <div class="num">____<span class="of10">/10</span></div>
        </div>
    </div>
    """
    return page(body, folio, "PART 1 · DOMAIN SCORE · RIGHT", "right")


def yearly_page(year_label: str, year_hint: str, folio: str, side: str = "right") -> str:
    """연간 캘린더 — YEAR 직접 기입 + 12 mini-month."""
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
            <span class="yr-hint">{year_hint}</span>
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


def annual_vision_left(folio: str) -> str:
    """디지털 목업 — 연간 비전 LEFT (VISION 박스 + 분기 테마 + 올해의 한 단어 + 12/31 모습)."""
    body = """
    <div class="content">
        <div class="tag">PART 2 · LEFT</div>
        <h1>연간 비전</h1>
        <div class="rule-gold-sm"></div>
        <div class="sub">1년의 종착지를 미리 그려보기</div>

        <div class="vision-big-box">
            <div class="lbl">VISION</div>
            <div class="ln"></div>
            <div class="ln"></div>
            <div class="ln"></div>
            <div class="ln"></div>
        </div>

        <div style="margin-bottom:4mm;">
            <div class="label">▶ 분기 테마 (실행 프로그램 p1)</div>
            <div class="line"></div>
            <div class="line tight"></div>
        </div>

        <div style="margin-bottom:4mm;">
            <div class="label">▶ 올해의 한 단어 (Word of the Year)</div>
            <div class="word-of-year">
                <div class="wd">______</div>
            </div>
        </div>

        <div style="margin-top:auto;">
            <div class="label">▶ 올해 12월 31일, 나는 어떤 모습으로 한 해를 마감하고 싶은가</div>
            <div class="line"></div>
            <div class="line tight"></div>
        </div>
    </div>
    """
    return page(body, folio, "PART 2 · ANNUAL VISION", "left")


def milestones_90_right(folio: str) -> str:
    """디지털 목업 — 90일 마일스톤 RIGHT (Q1~Q3 + Q4 wide + 근거)."""
    body = """
    <div class="content">
        <div class="tag">PART 2 · RIGHT</div>
        <h1>90일 마일스톤 · Q1·Q2·Q3·Q4</h1>
        <div class="rule-gold-sm"></div>
        <div class="sub">분기 단위 분할 — 90일씩 끊어 실행률을 끌어올립니다</div>

        <div class="q-grid">
            <div class="qbox">
                <div class="qh">Q1 (1~3월)</div>
                <div class="ln"></div><div class="ln"></div><div class="ln"></div>
            </div>
            <div class="qbox">
                <div class="qh">Q2 (4~6월)</div>
                <div class="ln"></div><div class="ln"></div><div class="ln"></div>
            </div>
            <div class="qbox">
                <div class="qh">Q3 (7~9월)</div>
                <div class="ln"></div><div class="ln"></div><div class="ln"></div>
            </div>
        </div>

        <div class="q4-wide">
            <div class="qh">Q4 (10~12월) — 마무리 · 다음 해 준비</div>
            <div class="ln"></div><div class="ln"></div>
        </div>

        <div class="evidence-box">
            <span class="ev-label">근거:</span> 분기 단위 검토(Quarterly Personal Review)는 연간 목표 달성률을 평균 <strong>+34%</strong> 높입니다.
        </div>
    </div>
    """
    return page(body, folio, "90 DAY MILESTONES", "right")


def vision_long_page(folio: str, n: int) -> str:
    """Part 2 추가 페이지 (연간 비전 · 분기 마일스톤 확장)."""
    body = f"""
    <div class="content">
        <div class="tag">PART 2 · 연간 비전 · 90일 마일스톤 ({n}/10)</div>
        <h1>연간 비전 · 분기 마일스톤</h1>
        <div class="rule-gold-sm"></div>
        <div class="hw-box">
            <strong>VISION</strong> (올해의 핵심 한 문장) — 분기별 마일스톤으로 쪼개 적습니다.
        </div>
        <div class="label">VISION (올해의 핵심 한 문장)</div>
        <div class="line"></div><div class="line"></div>

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


def monthly_left_undated(month_index: int, folio: str) -> str:
    """월간 좌측 — Undated 캘린더 (YEAR/MONTH/START DAY 헤더 명시)."""
    # weekday header: 7 empty header cells (user fills in)
    weekdays = "".join(['<div class="head"><span class="ln"></span></div>' for _ in range(7)])
    days_html = ""
    for d in range(1, 29):
        days_html += f'<div class="day">{d}</div>'
    for d in range(29, 32):
        days_html += f'<div class="day optional">{d}</div>'
    # pad to 35 cells (5 rows × 7)
    for _ in range(3):
        days_html += '<div class="day"></div>'
    body = f"""
    <div class="content">
        <div class="tag">MONTHLY · MONTH ___ · YEAR ____</div>
        <h1><span style="border-bottom:0.3mm solid var(--ink-light); display:inline-block; min-width:18mm; padding:0 3mm; font-family:'Cormorant Garamond',serif;">__</span>월 · 31칸 그리드</h1>
        <div class="rule-gold-sm"></div>
        <div class="sub">요일/날짜 직접 기입 · 주요 일정·기념일·이정표 표시</div>

        <div class="month-header-field">
            <span class="mhf-cell"><span class="mhf-label">YEAR</span><span class="mhf-line"></span></span>
            <span class="mhf-cell"><span class="mhf-label">MONTH</span><span class="mhf-line short"></span></span>
            <span class="mhf-cell"><span class="mhf-label">START DAY</span><span class="mhf-line short"></span></span>
        </div>
        <div class="month-grid">{weekdays}{days_html}</div>
    </div>
    """
    return page(body, folio, f"MONTHLY · UNDATED · {month_index}/12", "left")


def monthly_right_priority(folio: str) -> str:
    """월간 RIGHT — 이번 달 우선순위 (브랜드 제거)."""
    body = """
    <div class="content">
        <div class="tag">MONTHLY · PRIORITY · UNDATED</div>
        <h1>이번 달 우선순위</h1>
        <div class="rule-gold-sm"></div>
        <div class="sub">ABC 우선순위 + 인생포트폴리오 13영역 · 연중 어느 달이든 사용 가능</div>

        <div class="month-mission">
            <div class="lbl">📌 이번 달 사명 한 줄</div>
            <div style="border-bottom:0.2mm solid var(--ink); height:5mm;"></div>
        </div>

        <div class="month-prio">
            <div class="row-label">🥇 A (Must · 최우선)</div>
            <div class="row A"><span class="rk">A</span><span class="rv"></span></div>
            <div class="row A"><span class="rk">A</span><span class="rv"></span></div>
            <div class="row-label">🥈 B (Should · 중요)</div>
            <div class="row"><span class="rk">B</span><span class="rv"></span></div>
            <div class="row"><span class="rk">B</span><span class="rv"></span></div>
            <div class="row-label">🥉 C (Could · 여유시)</div>
            <div class="row"><span class="rk">C</span><span class="rv"></span></div>
        </div>

        <div class="month-review">
            <div class="lbl">📝 월말 회고 3줄</div>
            <div class="rr"><span class="k">잘된 것</span><span class="v"></span></div>
            <div class="rr"><span class="k">배운 것</span><span class="v"></span></div>
            <div class="rr"><span class="k">다음 달</span><span class="v"></span></div>
        </div>
    </div>
    """
    return page(body, folio, "MONTHLY · UNDATED", "right")


def weekly_left(week_num: int, folio: str) -> str:
    """주간 좌측 — 계획 (브랜드 멘트 제거)."""
    body = f"""
    <div class="content weekly-left">
        <div class="week-num">WEEK <span style="border-bottom:0.2mm solid var(--ink-light); display:inline-block; min-width:12mm; text-align:center;">{week_num:02d}</span></div>
        <div class="wk-date-line">
            <div class="seg"></div>
            <div class="dash">—</div>
            <div class="seg"></div>
        </div>
        <div class="rule-gold-sm"></div>

        <div class="label">① 이번 주 사명 한 줄</div>
        <div class="line"></div>

        <div class="label">② A · B · C 우선순위</div>
        <div style="display:flex; align-items:baseline; margin-bottom:1.5mm;"><span style="flex:0 0 5mm; font-weight:800; color:var(--gold); font-size:8pt;">A</span><div class="line" style="flex:1; margin:0;"></div></div>
        <div style="display:flex; align-items:baseline; margin-bottom:1.5mm;"><span style="flex:0 0 5mm; font-weight:700; color:var(--brg); font-size:8pt;">B</span><div class="line" style="flex:1; margin:0;"></div></div>
        <div style="display:flex; align-items:baseline; margin-bottom:3mm;"><span style="flex:0 0 5mm; font-weight:700; color:var(--brg); font-size:8pt;">C</span><div class="line" style="flex:1; margin:0;"></div></div>

        <div class="label">③ If-Then 3개 <span style="font-family:'Cormorant Garamond',serif; font-style:italic; color:var(--ink-light); font-weight:400; font-size:7.5pt;">(만약 ___, 그러면 ___)</span></div>
        <div style="display:flex; align-items:baseline; margin-bottom:1.5mm;"><span style="flex:0 0 5mm; font-size:7.5pt; color:var(--brg);">1</span><div class="line" style="flex:1; margin:0;"></div></div>
        <div style="display:flex; align-items:baseline; margin-bottom:1.5mm;"><span style="flex:0 0 5mm; font-size:7.5pt; color:var(--brg);">2</span><div class="line" style="flex:1; margin:0;"></div></div>
        <div style="display:flex; align-items:baseline; margin-bottom:3mm;"><span style="flex:0 0 5mm; font-size:7.5pt; color:var(--brg);">3</span><div class="line" style="flex:1; margin:0;"></div></div>

        <div class="label">④ 요일별 일정</div>
        <table class="weekday-table">
            <tr><td><span class="d">월</span></td></tr>
            <tr><td><span class="d">화</span></td></tr>
            <tr><td><span class="d">수</span></td></tr>
            <tr><td><span class="d">목</span></td></tr>
            <tr><td><span class="d">금</span></td></tr>
            <tr><td><span class="d weekend">토</span></td></tr>
            <tr><td><span class="d weekend">일</span></td></tr>
        </table>
    </div>
    """
    return page(body, folio, f"WEEK {week_num:02d} · LEFT", "left")


def weekly_right_deepdive(week_num: int, folio: str) -> str:
    """주간 우측 — Deep Dive + 회고 (브랜드 멘트 제거)."""
    body = f"""
    <div class="content weekly-right">
        <div class="week-num" style="color:var(--gold); font-family:'Cormorant Garamond','Noto Serif CJK KR',serif; font-weight:700; font-size:12pt; font-style:italic;">Deep Dive Day + 회고</div>
        <div class="week-range">자유 기록 영역</div>
        <div class="rule-gold-sm"></div>

        <div class="dd-box">
            <div class="dd-title">⑤ This Week's Deep Dive Day <span style="font-family:'Cormorant Garamond',serif; font-style:italic; font-size:7.5pt; color:var(--gold); font-weight:500;">— 주 1회 집중 기록</span></div>
            <div class="dd-row"><span class="k">DATE</span><span class="ln"></span></div>
            <div class="dd-row"><span class="k">오늘의 사건</span><span class="ln"></span></div>
            <div class="dd-row"><span class="k">감정·생각</span><span class="ln"></span></div>
            <div class="dd-row"><span class="k">한 줄 의미</span><span class="ln"></span></div>
        </div>

        <div class="label" style="color:var(--gold);">⑥ 자유 도트 메모</div>
        <div class="dot-area"></div>

        <div class="label">⑦ 이번 주 회고 3줄 — 인생포트폴리오 IP</div>
        <div style="display:flex; align-items:baseline; margin-bottom:1.5mm;"><span style="flex:0 0 16mm; font-size:7.5pt; color:var(--brg); font-weight:600;">잘된 것</span><span style="flex:1; border-bottom:0.2mm solid var(--ink); height:5mm;"></span></div>
        <div style="display:flex; align-items:baseline; margin-bottom:1.5mm;"><span style="flex:0 0 16mm; font-size:7.5pt; color:var(--brg); font-weight:600;">배운 것</span><span style="flex:1; border-bottom:0.2mm solid var(--ink); height:5mm;"></span></div>
        <div style="display:flex; align-items:baseline; margin-bottom:1.5mm;"><span style="flex:0 0 16mm; font-size:7.5pt; color:var(--brg); font-weight:600;">다음 주</span><span style="flex:1; border-bottom:0.2mm solid var(--ink); height:5mm;"></span></div>
    </div>
    """
    return page(body, folio, f"WEEK {week_num:02d} · RIGHT", "right")


def quarterly_review_page(domain: str, folio: str, page_n: int) -> str:
    body = f"""
    <div class="content">
        <div class="tag">PART 4 · QUARTERLY REVIEW ({page_n}/18)</div>
        <h1>{domain} · 분기 회고</h1>
        <div class="rule-gold-sm"></div>
        <div class="hw-box">
            <strong>표현적 글쓰기 4문항</strong> — 사실 → 감정 → 의미 → 의도 순서로,
            지난 분기 이 영역에서 일어난 일을 손글씨로 정리합니다.
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
        <h1><span style="border-bottom:0.3mm solid var(--ink-light); display:inline-block; width:14mm; padding:0 2mm; font-family:'Cormorant Garamond',serif;">__</span>월의 감사</h1>
        <div class="rule-gold-sm"></div>

        <div class="label">▷ 이번 달 감사 3가지</div>
        <div class="line"></div><div class="line"></div><div class="line"></div>
        <div class="line"></div><div class="line"></div><div class="line"></div>

        <div class="label">▷ 예상치 못했던 좋은 일</div>
        <div class="line"></div><div class="line"></div><div class="line"></div>

        <div class="label">▷ 다음 달에 기대하는 한 가지</div>
        <div class="line"></div><div class="line"></div>

        <div class="evidence-box">
            <span class="ev-label">근거:</span> 4주 감사 일기 실천군은 대조군 대비 <strong>우울감 −28% · 삶 만족도 +19%</strong> (RCT 메타분석).
        </div>
    </div>
    """
    return page(body, folio, f"PART 5 · {n}/12", "right")


def coaching_page(folio: str, n: int) -> str:
    rows = ''.join(['<tr><td></td><td></td><td></td><td></td></tr>' for _ in range(8)])
    body = f"""
    <div class="content">
        <div class="tag">PART 6 · 1:1 코칭 진척 기록 ({n}/8)</div>
        <h1>4컬럼 성과 추적 보드</h1>
        <div class="rule-gold-sm"></div>
        <div class="sub">실행 프로그램 PDF p4 동일 구조</div>
        <table class="coaching-tbl">
            <thead>
                <tr>
                    <th style="width:14%;">주차</th>
                    <th style="width:36%;">실행 과제</th>
                    <th style="width:12%;">완료</th>
                    <th style="width:38%;">성찰 메모</th>
                </tr>
            </thead>
            <tbody>{rows}</tbody>
        </table>
    </div>
    """
    return page(body, folio, f"PART 6 · {n}/8", "right")


def quotes_page(folio: str, n: int) -> str:
    """성경구절/명언 — 따옴표 디자인 강화."""
    cards = ""
    for _ in range(5):
        cards += '<div class="quote-card">"<br><br><span class="src">― ___________</span></div>'
    body = f"""
    <div class="content">
        <div class="tag">PART 7 · APPENDIX ① ({n}/4)</div>
        <h1>성경구절 · 명언 모음</h1>
        <div class="rule-gold-sm"></div>
        <div class="sub">매주 1구절 손글씨로 옮겨 적기 (52주 분량 중 발췌)</div>
        {cards}
    </div>
    """
    return page(body, folio, f"PART 7 · ① {n}/4", "right")


def domain_guide_page(folio: str, n: int) -> str:
    body = f"""
    <div class="content">
        <div class="tag">PART 7 · APPENDIX ② ({n}/2)</div>
        <h1>13영역 핵심 질문 가이드</h1>
        <div class="rule-gold-sm"></div>
        <div style="font-size:8pt; line-height:1.75; color:var(--ink);">
            <p>각 영역에서 자기진단·자기설계 시 묻는 핵심 질문:</p>
            <ol style="padding-left:6mm; margin-top:3mm;">
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
        <div class="tag">PART 7 · APPENDIX ③</div>
        <h1>사용 가이드 (시작 · 매주 · 분기 · 연말)</h1>
        <div class="rule-gold-sm"></div>
        <div style="font-size:8.5pt; line-height:1.85; color:var(--ink);">
            <div class="hw-box" style="margin-bottom:3mm;"><strong style="color:var(--gold); font-family:'Cormorant Garamond','Noto Sans CJK KR',sans-serif;">START</strong> · 첫 1시간 — Part 0 손글씨 옮겨 적기 + 시작일 기입</div>
            <div class="hw-box" style="margin-bottom:3mm;"><strong style="color:var(--gold); font-family:'Cormorant Garamond','Noto Sans CJK KR',sans-serif;">매주</strong> · 30분 — Part 3 주간 펼침면 + Weekly Deep Dive Day 1회</div>
            <div class="hw-box" style="margin-bottom:3mm;"><strong style="color:var(--gold); font-family:'Cormorant Garamond','Noto Sans CJK KR',sans-serif;">매월</strong> · 20분 — 월간 캘린더 회고 3줄 + Part 5 감사 일기</div>
            <div class="hw-box" style="margin-bottom:3mm;"><strong style="color:var(--gold); font-family:'Cormorant Garamond','Noto Sans CJK KR',sans-serif;">분기</strong> · 90분 — Part 4 13영역 분기 회고 (4문항 표현적 글쓰기)</div>
            <div class="hw-box"><strong style="color:var(--gold); font-family:'Cormorant Garamond','Noto Sans CJK KR',sans-serif;">연말</strong> · 3시간 — 1년 누적 회고 + 다음 다이어리 이관</div>
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
        <div class="hw-box" style="margin-top:6mm;">
            <strong style="color:var(--gold);">사례 / REWARD</strong><br>
            <span style="font-size:8pt; line-height:1.7; color:var(--ink);">
            이 다이어리에는 한 사람의 1년이 손글씨로 담겨 있습니다.
            반환해 주시는 분께 진심으로 감사드리며, 작은 사례를 약속드립니다.
            </span>
        </div>
    </div>
    """
    return page(body, folio, "OWNER", "right")


def daily_journal_page(folio: str, n: int) -> str:
    body = f"""
    <div class="content">
        <div class="tag">PART 7 · DAILY JOURNAL ({n}/24)</div>
        <h1>데일리 저널 <span class="en">(Dot)</span></h1>
        <div class="rule-gold-sm"></div>
        <div class="sub">기록하고 싶은 날만 자유롭게 — 매일이 아닌, 의미 있는 날만</div>
        <div class="dj-head">
            <div class="cell"><span class="k">DATE</span><span class="ln"></span></div>
            <div class="cell"><span class="k">MOOD</span><span class="ln"></span></div>
            <div class="cell"><span class="k">DAY</span><span class="ln"></span></div>
        </div>
        <div class="dot-area-full"></div>
    </div>
    """
    return page(body, folio, f"DAILY · {n}/24", "right")


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
    addp(page('<div class="content" style="display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; height:100%;"><div style="font-family:\'Cormorant Garamond\',\'Noto Serif CJK KR\',serif; font-style:italic; font-size:12pt; color:var(--brg); line-height:2;">당신의 1년을<br/>당신만의 방식으로<br/>기록합니다.</div><div style="margin-top:10mm; font-family:\'Cormorant Garamond\',serif; font-style:italic; font-size:10pt; color:var(--gold); letter-spacing:0.3em;">Only One</div></div>'))  # 5
    addp(blank_page())                                          # 6
    addp(blank_page())                                          # 7
    addp(divider_page("PART 0", "검사 리포트를 옮겨 적기", "Self-Internalization Ritual"))   # 8

    # 9-18 Part 0 (10p) — 디자인 동기화 적용
    addp(intro_with_start_date(f"p. {p+1}"))                    # 9
    addp(mission_page(f"p. {p+1}"))                             # 10
    addp(vision_page(f"p. {p+1}"))                              # 11
    addp(four_se_a_page(f"p. {p+1}"))                           # 12
    addp(four_se_b_page(f"p. {p+1}"))                           # 13
    addp(top3_strengths_page(f"p. {p+1}"))                      # 14
    addp(top2_growth_page(f"p. {p+1}"))                         # 15
    addp(execution_profile_page(f"p. {p+1}"))                   # 16
    addp(career_3cards_page(f"p. {p+1}"))                       # 17
    addp(part0_outro_page(f"p. {p+1}"))                         # 18

    # 19-20 간지 (blank + divider)
    addp(blank_page())                                          # 19
    addp(divider_page("PART 1", "13영역 인생 지도", "Self-Diagnosis Map"))   # 20

    # 21-32 Part 1 13영역 (12p) — 펼침면 6개 (LEFT + RIGHT 반복)
    for _ in range(6):
        addp(domain_map_left(f"p. {p+1}"))                      # left
        addp(domain_map_right(f"p. {p+1}"))                     # right

    # 33-36 연간 캘린더 4p (YEAR 1 + YEAR 2)
    addp(yearly_page("YEAR 1 · 시작한 해", "예) 2026 / 2027 / 2028 …", f"p. {p+1}", "left"))  # 33
    addp(yearly_priority_page("YEAR 1", f"p. {p+1}", "right"))                                  # 34
    addp(yearly_page("YEAR 2 · 다음 해",  "자동으로 다음 해 연도 기입",   f"p. {p+1}", "left"))  # 35
    addp(yearly_priority_page("YEAR 2", f"p. {p+1}", "right"))                                  # 36

    # 37-46 Part 2 (10p) — divider + 연간 비전 LEFT + 90일 마일스톤 RIGHT + 확장 7p
    addp(divider_page("PART 2", "연간 비전 · 90일 마일스톤", "Annual Vision · 90-Day Milestones"))  # 37
    addp(annual_vision_left(f"p. {p+1}"))                       # 38
    addp(milestones_90_right(f"p. {p+1}"))                      # 39
    for i in range(4, 11):
        addp(vision_long_page(f"p. {p+1}", i))                  # 40-46

    # 47-70 월간 캘린더 24p (12개월 × 2p)
    for m in range(1, 13):
        addp(monthly_left_undated(m, f"p. {p+1}"))
        addp(monthly_right_priority(f"p. {p+1}"))

    # 71-174 Part 3 주간 펼침면 52주 × 2p (104p)
    for w in range(1, 53):
        addp(weekly_left(w, f"p. {p+1}"))
        addp(weekly_right_deepdive(w, f"p. {p+1}"))

    # 175-192 Part 4 영역별 분기 회고 18p
    addp(divider_page("PART 4", "영역별 분기 회고", "Quarterly Review"))  # 175
    domains_short = [
        "사명·비전", "직업·경력", "재정·자산", "가족·관계",
        "건강·체력", "학습·성장", "영성·신앙", "사회·공헌",
        "취미·여가", "시간·습관", "감정·정서", "환경·공간", "유산·기록"
    ]
    for i, dom in enumerate(domains_short, start=1):
        addp(quarterly_review_page(dom, f"p. {p+1}", i+1))      # 176-188
    # 13p + divider 1p = 14p → 4p filler
    for _ in range(4):
        addp(blank_page(f"p. {p+1}"))                           # 189-192

    # 193-204 Part 5 감사 일기 12p
    for n in range(1, 13):
        addp(gratitude_month_page(f"p. {p+1}", n))

    # 205-212 Part 6 코칭 진척 8p
    for n in range(1, 9):
        addp(coaching_page(f"p. {p+1}", n))

    # 213-216 Part 7-① 성경/명언 4p
    for n in range(1, 5):
        addp(quotes_page(f"p. {p+1}", n))

    # 217-218 Part 7-② 13영역 가이드 2p
    for n in range(1, 3):
        addp(domain_guide_page(f"p. {p+1}", n))

    # 219 Part 7-③ 사용 가이드
    addp(usage_guide_page(f"p. {p+1}"))

    # 220 Part 7-④ Owner Profile
    addp(owner_page(f"p. {p+1}"))

    # 221-244 Part 7-⑤ 데일리 저널 24p
    for n in range(1, 25):
        addp(daily_journal_page(f"p. {p+1}", n))

    # 245-256 FREE NOTES 자유 메모 12p (도트 그리드)
    free_notes_total = 256 - p  # 보통 12
    free_notes_idx = 1
    while p < 256:
        side = "left" if (p + 1) % 2 == 0 else "right"
        addp(free_notes_page(
            f"p. {p+1}" if p < 255 else "",
            side=side,
            page_num=free_notes_idx,
            total=free_notes_total
        ))
        free_notes_idx += 1

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
<title>인생포트폴리오 맞춤형 다이어리 v1.4.2 — 인쇄 직행 본문 256p</title>
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
        "-dPDFSETTINGS=/prepress",
        "-dColorConversionStrategy=/CMYK",
        "-dProcessColorModel=/DeviceCMYK",
        "-dEmbedAllFonts=true",
        "-dSubsetFonts=true",
        "-dCompatibilityLevel=1.6",
        "-dPreserveOverprintSettings=true",
        f"-sOutputFile={cmyk_pdf}",
        str(rgb_pdf),
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
    except subprocess.TimeoutExpired:
        print("[WARN] Ghostscript 타임아웃 — RGB 원본 그대로 사용 (제조사측 CMYK 변환 권장)", file=sys.stderr)
        shutil.copy(rgb_pdf, cmyk_pdf)
        return False
    if result.returncode != 0:
        print(f"[ERROR] Ghostscript 실패:\n{result.stderr}", file=sys.stderr)
        shutil.copy(rgb_pdf, cmyk_pdf)
        return False
    print(f"[OK] CMYK PDF 생성: {cmyk_pdf}  ({cmyk_pdf.stat().st_size / 1024:.1f} KB)")
    return True


def main():
    print("=" * 60)
    print("인생포트폴리오 맞춤형 다이어리 v1.4.2")
    print("Plan A 인쇄 직행 본문 PDF 빌더")
    print("디자인 동기화 + 브랜드 정리 + BRG/Cormorant 적용")
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
