#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_diary_user_manual.py
==========================
인생포트폴리오 맞춤형 다이어리 — 사용 설명서 PDF 빌드 스크립트 (v1.4.2)

출력: docs/strategy/diary/manufacturer-handoff-v1.4/03_user_manual.pdf

설계 원칙:
- A5 (148×210mm) — 다이어리와 동일 사이즈 (휴대 가능)
- 페이지별 사용법 가이드 (Part 0 ~ Part 7)
- 브랜드 컬러: BRG #0A3D2A + Gold #C9A04F
- 표지 서체: Cormorant Garamond
- 본문 서체: Noto Sans CJK KR
"""

import sys
from pathlib import Path

try:
    from weasyprint import HTML, CSS
except ImportError as e:
    print(f"필수 라이브러리 미설치: {e}")
    sys.exit(1)


ROOT = Path("/home/user/webapp")
OUTPUT_PDF = ROOT / "docs/strategy/diary/manufacturer-handoff-v1.4/03_user_manual.pdf"


CSS_STYLE = """
@page {
    size: 148mm 210mm;  /* A5 */
    margin: 18mm 16mm 18mm 16mm;

    @top-left {
        content: "인생포트폴리오 맞춤형 다이어리 — 사용 설명서";
        font-family: "Noto Sans CJK KR", sans-serif;
        font-size: 7.5pt;
        color: #6B7280;
        padding-bottom: 3mm;
        border-bottom: 0.3pt solid #E5E7EB;
        width: 100%;
    }

    @bottom-right {
        content: counter(page);
        font-family: "Cormorant Garamond", serif;
        font-size: 9pt;
        color: #0A3D2A;
        padding-top: 3mm;
    }
}

@page :first {
    margin: 0;
    @top-left { content: ""; border: none; }
    @bottom-right { content: ""; }
}

@page cover {
    background: #0A3D2A;
    margin: 0;
    @top-left { content: ""; border: none; }
    @bottom-right { content: ""; }
}

html, body {
    font-family: "Noto Sans CJK KR", "NanumSquare", sans-serif;
    font-size: 10pt;
    line-height: 1.55;
    color: #1F2937;
}

/* === 표지 === */
.cover {
    page: cover;
    background: #0A3D2A;
    color: #FFFFFF;
    width: 148mm;
    height: 210mm;
    padding: 32mm 18mm 24mm 18mm;
    box-sizing: border-box;
    page-break-after: always;
    position: relative;
}
.cover .brand-en {
    font-family: "Cormorant Garamond", serif;
    font-size: 22pt;
    font-weight: 400;
    letter-spacing: 0.25em;
    color: #C9A04F;
    text-align: center;
    margin-bottom: 5mm;
}
.cover .divider-gold {
    width: 32mm;
    height: 0.5mm;
    background: #C9A04F;
    margin: 4mm auto;
}
.cover .title-kr {
    font-size: 14pt;
    font-weight: 700;
    text-align: center;
    margin-top: 8mm;
    margin-bottom: 3mm;
    letter-spacing: 0.05em;
}
.cover .subtitle {
    font-family: "Cormorant Garamond", serif;
    font-size: 13pt;
    font-style: italic;
    text-align: center;
    color: #C9A04F;
    margin-bottom: 30mm;
}
.cover .toc-label {
    font-family: "Cormorant Garamond", serif;
    font-size: 10pt;
    letter-spacing: 0.4em;
    text-align: center;
    color: #C9A04F;
    margin-bottom: 6mm;
}
.cover .toc {
    font-size: 9pt;
    line-height: 1.9;
    color: #FFFFFF;
    text-align: left;
    padding-left: 12mm;
}
.cover .toc .part {
    color: #C9A04F;
    font-weight: 600;
    letter-spacing: 0.1em;
    font-family: "Cormorant Garamond", serif;
    font-size: 10pt;
    margin-top: 2mm;
}
.cover .bottom-text {
    position: absolute;
    bottom: 14mm;
    left: 0;
    right: 0;
    text-align: center;
    font-family: "Cormorant Garamond", serif;
    font-size: 8.5pt;
    color: #C9A04F;
    letter-spacing: 0.2em;
}

/* === 본문 === */
h1 {
    font-size: 17pt;
    color: #0A3D2A;
    font-weight: 700;
    margin: 0 0 2mm 0;
    line-height: 1.25;
    padding-bottom: 2mm;
    border-bottom: 1.2pt solid #C9A04F;
}
h1 .part-tag {
    font-family: "Cormorant Garamond", serif;
    font-size: 9pt;
    letter-spacing: 0.3em;
    color: #C9A04F;
    display: block;
    margin-bottom: 1mm;
    font-weight: 400;
}
h2 {
    font-size: 11.5pt;
    color: #0A3D2A;
    font-weight: 700;
    margin: 6mm 0 2mm 0;
    border-left: 2.5pt solid #C9A04F;
    padding-left: 3mm;
}
h3 {
    font-size: 10pt;
    color: #0A3D2A;
    font-weight: 700;
    margin: 4mm 0 1.5mm 0;
}
p { margin: 0 0 2mm 0; }

.lead {
    font-size: 9.5pt;
    color: #4B5563;
    background: #F3F4F6;
    padding: 3mm 4mm;
    border-left: 2pt solid #0A3D2A;
    margin: 3mm 0 4mm 0;
    line-height: 1.55;
}

.page-ref {
    font-family: "Cormorant Garamond", serif;
    font-size: 8.5pt;
    color: #C9A04F;
    font-style: italic;
    letter-spacing: 0.1em;
    margin-bottom: 1mm;
}

ul, ol { margin: 1mm 0 3mm 0; padding-left: 5mm; }
li { margin-bottom: 1mm; font-size: 9.5pt; line-height: 1.6; }

.example-box {
    background: #FAFAF7;
    border: 0.3pt solid #E5E7EB;
    border-radius: 1mm;
    padding: 3mm 4mm;
    margin: 2mm 0 3mm 0;
    font-size: 8.5pt;
    color: #4B5563;
    line-height: 1.6;
}
.example-box .label {
    color: #C9A04F;
    font-weight: 700;
    font-size: 7.5pt;
    letter-spacing: 0.15em;
    margin-bottom: 1mm;
    text-transform: uppercase;
}
.example-box em { color: #0A3D2A; font-style: normal; font-weight: 600; }

.tip {
    background: #FFF8E6;
    border-left: 2pt solid #C9A04F;
    padding: 2.5mm 3.5mm;
    margin: 2mm 0;
    font-size: 8.5pt;
    color: #4B5563;
}
.tip strong { color: #0A3D2A; }

.warn {
    background: #FEF2F2;
    border-left: 2pt solid #B91C1C;
    padding: 2.5mm 3.5mm;
    margin: 2mm 0;
    font-size: 8.5pt;
    color: #4B5563;
}

table {
    width: 100%;
    border-collapse: collapse;
    margin: 2mm 0 3mm 0;
    font-size: 8.5pt;
}
th, td {
    border-bottom: 0.3pt solid #E5E7EB;
    padding: 1.5mm 2mm;
    text-align: left;
    vertical-align: top;
}
th {
    background: #F3F4F6;
    color: #0A3D2A;
    font-weight: 700;
    font-size: 8pt;
}

.part-divider {
    page-break-before: always;
}

.routine {
    background: #F0FDF4;
    border: 0.3pt solid #BBF7D0;
    border-radius: 1mm;
    padding: 3mm 4mm;
    margin: 2mm 0 3mm 0;
    font-size: 9pt;
}
.routine h3 { color: #0A3D2A; margin-top: 0; }
.routine .time {
    font-family: "Cormorant Garamond", serif;
    color: #C9A04F;
    font-style: italic;
    font-size: 9pt;
    margin-right: 2mm;
}
"""


# ============================================================
# 본문 내용
# ============================================================

HTML_CONTENT = """<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><title>사용 설명서</title></head>
<body>

<!-- ============================================================
     표지
============================================================ -->
<div class="cover">
    <div class="brand-en">LIFE PORTFOLIO</div>
    <div class="divider-gold"></div>
    <div class="brand-en" style="font-size:11pt; letter-spacing:0.35em; margin:0;">USER MANUAL</div>
    <div class="title-kr">맞춤형 다이어리 사용 설명서</div>
    <div class="subtitle">How to Use Your Only One</div>

    <div class="toc-label">— CONTENTS —</div>
    <div class="toc">
        <div class="part">PROLOGUE</div>
        <div>· 이 다이어리를 시작하기 전에</div>
        <div class="part">PART 0 · INTRO</div>
        <div>· 검사 리포트 옮겨 적기 (p. 9-22)</div>
        <div class="part">PART 1 · ANNUAL</div>
        <div>· 13영역 지도 + 연간 비전 (p. 23-32)</div>
        <div class="part">PART 2-4 · MONTHLY / WEEKLY / DAILY</div>
        <div>· 월간 · 주간 · 일일 운용 (p. 33-188)</div>
        <div class="part">PART 5-7 · 회고 · 저널 · OWNER</div>
        <div>· 감사일기 · 분기 회고 · 데일리 저널 (p. 189-244)</div>
        <div class="part">FREE NOTES</div>
        <div>· 자유 메모 12p (p. 245-256)</div>
        <div class="part">EPILOGUE</div>
        <div>· 1년 후 그리고 다음 1년</div>
    </div>

    <div class="bottom-text">A LIFE PORTFOLIO PUBLICATION</div>
</div>

<!-- ============================================================
     PROLOGUE
============================================================ -->
<h1><span class="part-tag">PROLOGUE</span>이 다이어리를 시작하기 전에</h1>

<div class="lead">
    이 다이어리는 일반 시판 다이어리가 아닙니다. <strong>당신의 인생포트폴리오 검사 리포트</strong>를
    종이에 옮겨 1년간 운용하는 <em>자기설계 워크북</em>입니다.
</div>

<h2>준비물</h2>
<ul>
    <li><strong>인생포트폴리오 검사 리포트</strong> (PDF 또는 출력본) — 사명, 비전, 4SE, TOP 3 강점, TOP 2 성장 포인트, 실행 프로파일, 추천 진로</li>
    <li><strong>필기구</strong> — 만년필(EF/F닙 권장), 중성펜 0.38mm, 또는 자주 쓰는 펜</li>
    <li><strong>차분히 앉을 1시간</strong> — Part 0 (검사 리포트 옮겨 적기) 작성 시간</li>
</ul>

<h2>가장 중요한 약속 3가지</h2>
<ol>
    <li><strong>완벽하게 쓰지 않아도 됩니다.</strong> 빈칸이 있어도, 글씨가 비뚤어져도 괜찮습니다.</li>
    <li><strong>매일 안 써도 됩니다.</strong> 일주일에 3번이면 충분합니다. 죄책감 없는 페이스가 1년을 만듭니다.</li>
    <li><strong>1년 후 다시 펼쳐보세요.</strong> 이 다이어리의 진짜 가치는 365일 후 발견됩니다.</li>
</ol>

<div class="tip">
    <strong>💡 Tip.</strong> 다이어리 첫 페이지 "START · 나의 인생포트폴리오 1년이 시작되는 날"에
    오늘 날짜를 적으세요. <strong>신년이 아니어도 됩니다.</strong> 검사 리포트를 받은 날, 그날이 출발일입니다.
</div>


<!-- ============================================================
     PART 0
============================================================ -->
<div class="part-divider"></div>
<h1><span class="part-tag">PART 0 · INTRO</span>검사 리포트를 손으로 옮긴다</h1>
<div class="page-ref">— 해당 페이지: p. 9 ~ 22 (총 14p)</div>

<div class="lead">
    인쇄된 리포트를 읽기만 하면 "정보"입니다. 손으로 옮겨 적을 때 비로소 <em>"내 것"</em>이 됩니다.
    이것이 Part 0의 유일한 목적입니다.
</div>

<h2>p. 9 — 옮겨 적기 시작 페이지</h2>
<p>다이어리의 출발선입니다. 가장 위 "년 월 일"에 오늘 날짜를 적고, 다음 7페이지에 옮겨 적을 항목 목록을 미리 훑어보세요.</p>

<h2>p. 10-11 — 사명 (Mission) · 비전 (Vision)</h2>
<ul>
    <li>리포트의 <strong>사명 문장</strong>을 그대로 옮겨 적습니다.</li>
    <li>아래 빈칸에 <strong>"이 사명이 내 일상에서 어떻게 나타나는가?"</strong>를 한 줄 보탭니다.</li>
    <li>비전도 동일하게 — 1년 후의 모습을 구체적인 장면으로 적어보세요.</li>
</ul>

<div class="example-box">
    <div class="label">예시</div>
    사명: <em>"나는 사람들이 자기다움을 찾도록 돕는다."</em><br>
    일상 표현: 회의에서 후배의 강점을 한 번 더 짚어주기, 주말에 친구의 고민 들어주기.
</div>

<h2>p. 12-13 — 4SE 응답 강도</h2>
<p>4SE = <strong>Self-Efficacy / Self-Esteem / Self-Acceptance / Self-Direction</strong>. 리포트의 %값을 막대그래프로 그려보세요. 인식·표출 영역과 계획·행동 영역을 비교하면 "내가 어디가 약한가"가 보입니다.</p>

<h2>p. 14-17 — TOP 3 강점 · TOP 2 성장 포인트</h2>
<ul>
    <li>강점 3개를 옮기되, 각각에 <strong>"최근 이 강점을 발휘한 순간"</strong> 한 사례를 함께 적습니다.</li>
    <li>성장 포인트 2개는 약점 고치기가 아닙니다. <strong>"앞으로 더 키우면 좋을 부분"</strong>으로 받아들이세요.</li>
</ul>

<h2>p. 18-21 — 실행 프로파일 6필드 · 추천 진로 3카드</h2>
<p>실행 프로파일은 <strong>의지/계획/실행/지속/회복/협력</strong> 6개 축의 점수입니다. 가장 낮은 축에 동그라미를 치고, 이번 분기에 어떻게 보완할지 한 줄 적습니다.</p>
<p>추천 진로 3카드 중 <strong>가장 끌리는 1개</strong>에 별표(★)를 표시하세요. 1년 후 이 별표가 바뀌어 있을 수 있고, 그 변화 자체가 데이터입니다.</p>

<div class="tip">
    <strong>⏱️ 권장 소요 시간:</strong> Part 0 전체 작성에 약 60-90분. 한 번에 다 안 써도 됩니다.
    하루 1페이지씩 일주일에 걸쳐 천천히 써도 좋습니다.
</div>


<!-- ============================================================
     PART 1
============================================================ -->
<div class="part-divider"></div>
<h1><span class="part-tag">PART 1 · ANNUAL</span>13영역 지도와 연간 비전</h1>
<div class="page-ref">— 해당 페이지: p. 23 ~ 32 (총 10p)</div>

<div class="lead">
    인생을 13개 영역으로 펼쳐서 보는 페이지입니다. "올해 어디에 집중할지"가 한눈에 정리됩니다.
</div>

<h2>p. 23-26 — 인생 13영역 지도</h2>
<p>건강 / 가족 / 친구 / 연인·배우자 / 일·커리어 / 학습·성장 / 재정 / 취미·여가 / 영성·가치관 / 사회적 기여 / 환경·공간 / 자아·정체성 / 인생 의미 — 13개 영역에 각각 <strong>현재 만족도 (1-10점)</strong>와 <strong>한 줄 메모</strong>를 적습니다.</p>

<div class="example-box">
    <div class="label">예시</div>
    [건강] <em>6점</em> — 운동은 하지만 수면이 부족. 11시 취침 목표.<br>
    [재정] <em>4점</em> — 비상금 0원. 월 50만원 저축 시작 필요.
</div>

<h2>p. 27-28 — 연간 비전</h2>
<p>"올해 12월 31일의 나"를 1인칭 현재형 문장으로 적습니다. 미래를 현재처럼 말할 때 뇌가 그것을 사실로 받아들입니다 (시각화 효과).</p>

<h2>p. 29-32 — 90일 마일스톤</h2>
<p>1년을 4개 분기로 나누고, 각 분기 끝에 도달할 <strong>구체적 결과 1개씩</strong>을 적습니다. 12개월 목표는 멀게 느껴져도 90일 목표는 손에 잡힙니다.</p>

<div class="tip">
    <strong>💡 Tip.</strong> 13영역에서 가장 점수가 낮은 1-2개 영역과, 가장 끌리는 추천 진로(Part 0 ★)를 연결하면 분기 목표가 자연스럽게 도출됩니다.
</div>


<!-- ============================================================
     PART 2 — MONTHLY
============================================================ -->
<div class="part-divider"></div>
<h1><span class="part-tag">PART 2 · MONTHLY</span>월간 — Undated 만년형</h1>
<div class="page-ref">— 해당 페이지: p. 33 ~ 56 (12개월 × 2p)</div>

<div class="lead">
    각 월의 시작에 <strong>2페이지 펼침면</strong>이 배정됩니다. 좌측은 달력, 우측은 우선순위 정리.
</div>

<h2>왼쪽 페이지 — 월간 달력 (만년형)</h2>
<ul>
    <li>달력은 <strong>날짜만 비어있는 그리드</strong>입니다. 시작하는 달에 맞춰 직접 적으세요.</li>
    <li>예: 4월에 시작 → "4월" 적고 1일이 화요일이면 화요일 칸부터 1을 시작.</li>
    <li>중요한 일정·생일·마감일을 굵게 표시.</li>
</ul>

<h2>오른쪽 페이지 — 이달의 ABC 우선순위</h2>
<ul>
    <li><strong>A 항목 (3개 이내)</strong> — 이번 달 반드시 해낼 것</li>
    <li><strong>B 항목 (5개 이내)</strong> — 가능하면 할 것</li>
    <li><strong>C 항목 (자유)</strong> — 여유가 되면 할 것</li>
</ul>

<div class="tip">
    <strong>💡 Tip.</strong> A 항목이 5개를 넘으면 다시 보세요. 모든 게 A이면 결국 아무것도 A가 아닙니다.
</div>


<!-- ============================================================
     PART 3 — WEEKLY
============================================================ -->
<div class="part-divider"></div>
<h1><span class="part-tag">PART 3 · WEEKLY</span>주간 — 좌우 펼침 운용</h1>
<div class="page-ref">— 해당 페이지: p. 57 ~ 160 (52주 × 2p)</div>

<div class="lead">
    이 다이어리의 <strong>심장부</strong>입니다. 매주 일요일 저녁 또는 월요일 아침에 펼쳐서 한 주를 그립니다.
</div>

<h2>왼쪽 페이지 — 요일 그리드 + 주간 의도</h2>
<ul>
    <li>월 ~ 일 7칸. 각 요일에 약속·일정·반복 루틴을 적습니다.</li>
    <li>상단 <strong>"이번 주 의도"</strong> 칸에 <em>"이번 주는 ___에 집중한다"</em> 한 문장.</li>
</ul>

<h2>오른쪽 페이지 — Deep Dive (주간 심화)</h2>
<ul>
    <li><strong>① 3가지 주요 과제</strong> — 가장 중요한 것 위에서 아래로</li>
    <li><strong>② 주중 회고</strong> — 수요일쯤 적으면 좋습니다 ("이대로 가도 되나?")</li>
    <li><strong>③ 주말 셀프리뷰</strong> — 일요일에 5문항 채우기</li>
    <li><strong>④ 다음 주 준비</strong> — 미리 적어두면 월요일이 가벼워집니다</li>
</ul>

<div class="example-box">
    <div class="label">주중 회고 예시 (수요일)</div>
    "월요일에 A 과제 시작은 했는데, 화요일에 다른 일이 끼어들어 멈춤. 목요일 오전에 2시간 집중 슬롯 확보 필요."
</div>


<!-- ============================================================
     PART 4 — DAILY (선택)
============================================================ -->
<div class="part-divider"></div>
<h1><span class="part-tag">PART 4 · DAILY</span>일일 — 자유 운용 메모</h1>
<div class="page-ref">— 해당 페이지: p. 161 ~ 188</div>

<div class="lead">
    매일 안 써도 됩니다. <strong>"오늘만은 꼭 적어두고 싶은 날"</strong>에 사용하세요.
</div>

<ul>
    <li>중요한 미팅 메모, 인용구, 갑자기 떠오른 아이디어, 감정 폭풍이 지나간 날의 기록</li>
    <li>매일 강박 ❌ → 주 2-3회 자연스럽게 ✅</li>
</ul>


<!-- ============================================================
     PART 5 — 감사 일기
============================================================ -->
<div class="part-divider"></div>
<h1><span class="part-tag">PART 5 · GRATITUDE</span>감사 일기 — 12개월 × 1p</h1>
<div class="page-ref">— 해당 페이지: p. 189 ~ 200 (12p)</div>

<div class="lead">
    매월 마지막 날, <strong>3가지 감사한 일</strong>을 적습니다. 거창하지 않아도 됩니다.
</div>

<div class="example-box">
    <div class="label">예시</div>
    · 6월 12일 비 오는 날 카페에서 마신 커피<br>
    · 어머니가 전화로 "잘 지내?"라고 물어준 것<br>
    · 마감 직전에 동료가 한 번 더 검토해준 것
</div>

<div class="tip">
    <strong>📚 근거.</strong> 감사 일기는 인지심리학 연구에서 주관적 행복도를 유의미하게 높이는 것으로 반복 검증된 가장 단순한 개입입니다.
</div>


<!-- ============================================================
     PART 6 — 분기 회고
============================================================ -->
<div class="part-divider"></div>
<h1><span class="part-tag">PART 6 · QUARTERLY REVIEW</span>분기 회고 — 4회 × 2p</h1>
<div class="page-ref">— 해당 페이지: p. 201 ~ 216 (8p · 4분기)</div>

<div class="lead">
    분기마다 한 번씩 <strong>2페이지 펼침면</strong>으로 90일을 돌아봅니다. 표현적 글쓰기 기반의 5문항.
</div>

<h2>5가지 회고 질문</h2>
<ol>
    <li><strong>잘한 것</strong> — 무엇이 작동했나?</li>
    <li><strong>아쉬운 것</strong> — 다시 한다면 어떻게?</li>
    <li><strong>배운 것</strong> — 이번 분기의 핵심 깨달음</li>
    <li><strong>버릴 것</strong> — 다음 분기에 그만둘 것</l>
    <li><strong>다음 분기 의도</strong> — 다음 90일의 키워드 1개</li>
</ol>


<!-- ============================================================
     PART 7 — 데일리 저널
============================================================ -->
<div class="part-divider"></div>
<h1><span class="part-tag">PART 7 · DAILY JOURNAL</span>데일리 저널 24p</h1>
<div class="page-ref">— 해당 페이지: p. 221 ~ 244</div>

<div class="lead">
    중요한 날 한 페이지씩 깊이 적는 페이지입니다. 일기와는 다릅니다 — <strong>"오늘 나에게 어떤 의미였나"</strong>를 다룹니다.
</div>

<h2>저널 구조</h2>
<ul>
    <li><strong>날짜 · 한 단어 요약</strong> — 오늘을 한 단어로</li>
    <li><strong>일어난 일</strong> — 사실만 객관적으로</li>
    <li><strong>내 반응</strong> — 어떻게 느꼈고 어떻게 행동했나</li>
    <li><strong>의미</strong> — 이 사건이 1년 후의 내게 무엇을 남길까</li>
    <li><strong>한 줄 메시지</strong> — 미래의 나에게</li>
</ul>


<!-- ============================================================
     FREE NOTES
============================================================ -->
<div class="part-divider"></div>
<h1><span class="part-tag">FREE NOTES</span>자유 메모 12p — 생각의 여백</h1>
<div class="page-ref">— 해당 페이지: p. 245 ~ 256 (12p · 도트 그리드)</div>

<div class="lead">
    구조화되지 않은 모든 것을 위한 페이지입니다. <strong>도트 그리드</strong>가 있어 글·그림·표 무엇이든 쓸 수 있습니다.
</div>

<h2>활용 예시</h2>
<ul>
    <li><strong>독서 메모</strong> — 책 한 권의 핵심을 한 페이지에</li>
    <li><strong>강의·세미나 노트</strong> — 인상 깊었던 강연</li>
    <li><strong>아이디어 스케치</strong> — 새 프로젝트, 새 습관, 새 진로</li>
    <li><strong>인생 명언 모음</strong> — 1년간 모은 나만의 인용구</li>
    <li><strong>마인드맵</strong> — 복잡한 결정 앞에서 시각적으로 정리</li>
    <li><strong>미래에게 보내는 편지</strong> — 1년 후의 나에게</li>
</ul>


<!-- ============================================================
     일상 루틴 가이드
============================================================ -->
<div class="part-divider"></div>
<h1><span class="part-tag">DAILY · WEEKLY RHYTHM</span>권장 운용 리듬</h1>

<div class="lead">
    매일·매주·매월·매분기마다 어떤 페이지를 펼치면 좋은지에 대한 권장 리듬입니다. <strong>강제 사항이 아닙니다.</strong>
</div>

<div class="routine">
    <h3><span class="time">매일 5분</span>아침 또는 저녁</h3>
    · 주간 페이지(Part 3) 오늘 칸 채우기<br>
    · 특별한 날이면 데일리 저널(Part 7) 1페이지
</div>

<div class="routine">
    <h3><span class="time">매주 일요일 20분</span>한 주를 닫고 다음 주를 연다</h3>
    · 이번 주 Deep Dive 셀프리뷰 5문항 작성<br>
    · 다음 주 펼침면 "이번 주 의도" 1문장 적기<br>
    · 월간 ABC 우선순위 진척 확인
</div>

<div class="routine">
    <h3><span class="time">매월 마지막 날 30분</span>이번 달 닫기</h3>
    · 감사 일기(Part 5) 한 페이지 작성<br>
    · 13영역 점수 변화 점검 (Part 1)<br>
    · 다음 달 펼침면 ABC 우선순위 미리 적기
</div>

<div class="routine">
    <h3><span class="time">매 분기 1회 60분</span>90일을 돌아보고 다음 90일을 그린다</h3>
    · 분기 회고(Part 6) 5문항 펼침면 작성<br>
    · 다음 분기 마일스톤 1개 재설정<br>
    · 추천 진로 ★ 표시가 여전히 같은지 확인
</div>


<!-- ============================================================
     FAQ
============================================================ -->
<div class="part-divider"></div>
<h1><span class="part-tag">FAQ</span>자주 묻는 질문</h1>

<h3>Q. 며칠 빠뜨렸어요. 처음부터 다시 써야 하나요?</h3>
<p>아니요. 빈 칸은 그대로 두고 오늘부터 다시 시작하세요. <strong>완벽주의가 1년을 망칩니다.</strong></p>

<h3>Q. 1년 다 못 채울 것 같아요.</h3>
<p>1년 = 365일이 아니라 <strong>52주</strong>입니다. 주에 한 번씩만 펼쳐도 52번. 그것만으로도 충분합니다.</p>

<h3>Q. 만년필 잉크가 뒷장에 비쳐요.</h3>
<p>70g 만년필 친화지를 사용했지만, EF/F 닙 또는 점도 높은 잉크 사용을 권장합니다. 잉크가 마를 시간(20-30초)을 주면 비침이 줄어듭니다.</p>

<h3>Q. 검사 리포트가 없어요. 그래도 쓸 수 있나요?</h3>
<p>네. Part 1 (13영역) 이후부터는 일반 다이어리처럼 쓸 수 있습니다. 다만 Part 0 (검사 리포트 옮겨 적기)이 이 다이어리의 핵심이라는 점은 기억해 두세요. lifeportfolio.co.kr 검사를 추천드립니다.</p>

<h3>Q. 다음 해에는 어떻게 하나요?</h3>
<p>다이어리는 만년형(Undated)이므로 신년에 새 다이어리를 사실 필요가 없습니다. 단, 검사 리포트는 1년에 한 번 다시 받아 비교해 보시기를 권장합니다 — 변화 자체가 가장 큰 데이터입니다.</p>


<!-- ============================================================
     EPILOGUE
============================================================ -->
<div class="part-divider"></div>
<h1><span class="part-tag">EPILOGUE</span>1년 후, 그리고 다음 1년</h1>

<div class="lead">
    1년 후 이 다이어리를 다시 펼치는 순간, 당신은 1년 전의 자신을 만나게 됩니다.
    그 만남이 이 다이어리의 진짜 목적입니다.
</div>

<p>마지막 페이지(p. 256)까지 다 채우지 못해도 괜찮습니다. 채워진 만큼이 당신이 자기 자신과 대화한 시간입니다.</p>

<p>다음 1년을 시작할 때, 다시 검사 리포트를 받아 <strong>새 다이어리의 Part 0</strong>에 옮겨 적으세요. 두 권을 나란히 놓으면, 1년 사이의 당신이 보일 것입니다.</p>

<div class="tip" style="background:#0A3D2A; color:#FFFFFF; border-color:#C9A04F;">
    <strong style="color:#C9A04F;">한 줄 약속.</strong><br>
    이 다이어리는 당신의 인생을 완벽하게 만들지 않습니다.<br>
    다만 <em>당신이 당신답게 살고 있는지</em>를 매주 묻습니다. 그것이면 충분합니다.
</div>

<p style="text-align:center; margin-top:10mm; font-family:'Cormorant Garamond', serif; font-style:italic; color:#C9A04F; font-size:11pt;">
    "Only One — 세상에 단 하나뿐인 당신을 위한 인생포트폴리오"
</p>

<p style="text-align:center; margin-top:8mm; font-size:8pt; color:#9CA3AF;">
    © Life Portfolio · 사용 설명서 v1.4.2 · 2026-05-25
</p>

</body>
</html>
"""


def main():
    print("[1/2] HTML 빌드 중...")
    print("[2/2] PDF 생성 중...")

    html = HTML(string=HTML_CONTENT)
    css = CSS(string=CSS_STYLE)
    html.write_pdf(str(OUTPUT_PDF), stylesheets=[css])

    size_kb = OUTPUT_PDF.stat().st_size / 1024
    print(f"\n✅ 생성 완료: {OUTPUT_PDF}")
    print(f"   크기: {size_kb:.1f} KB")


if __name__ == "__main__":
    main()
