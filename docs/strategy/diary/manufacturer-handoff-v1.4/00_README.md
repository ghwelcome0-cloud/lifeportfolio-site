# 인생포트폴리오 맞춤형 다이어리 v1.4.1 — 제조사 발주 패키지

> **버전**: v1.4.1 (Plan A · 인쇄 직행) · 2026-05-21
> **수량**: 500부 (1차 발주)
> **제품**: A5 · 256p · 70g 만년필 친화지 · Undated 만년형 · PU 양장 · 2도 인쇄

## v1.4.1 패치 (정렬 미세 수정)
- **Weekly LEFT ④ 요일 그리드**: row 높이를 20pt 정수 단위로 고정하여
  sub-pixel rounding drift 제거 (월~일 7행 모두 정확히 등간격 정렬)
- **WEEK 만년형 날짜 라인**: 언더스코어 문자 (`____.__.__ — __.__`) 토막짐 →
  실제 border-bottom 라인 2개 + dash로 교체

---

## ▶ 가장 중요한 파일 (제조사 우선 확인)

```
📄 01_spec_sheet.pdf          ← 전체 사양서 (회신 양식 포함)
📄 02_concept_deck.pptx       ← 16장 컨셉 덱 (디자인 의도)
📁 print-ready/               ← ★ 인쇄 직행 PDF 모음 ★
   ├─ body_256p.pdf           ← 본문 256p (A5 + 도련 3mm, 폰트 임베드)
   ├─ cover_front.pdf         ← 앞표지 (A5 + 도련 3mm)
   ├─ cover_back.pdf          ← 뒤표지 (A5 + 도련 3mm)
   └─ fonts/                  ← Noto Sans/Serif CJK KR (SIL OFL)
📁 cover-finishing/           ← 후가공 위치 가이드
   ├─ cover_layout_diagram.pdf  ← 금박 위치 mm 단위 다이어그램
   ├─ monogram_L.svg          ← L 모노그램 SVG (옵션 자산)
   └─ only_one_text.svg       ← ONLY ONE 텍스트 SVG
📁 color/                     ← 색상 사양
   ├─ color_swatch.pdf        ← 색상 스워치 시각 자료
   └─ colors.txt              ← RGB/CMYK/Pantone 텍스트 사양
📁 reference/                 ← 참고 자료 (필수 아님)
   ├─ 01_spec_sheet_source.md ← 사양서 마크다운 원본
   ├─ paper_70g_spec.md       ← 종이 선정 가이드
   └─ v1.4_market_research.md ← 시장조사 보고서
```

---

## ▶ 핵심 사양 한눈에

| 항목 | 사양 |
|---|---|
| **사이즈** | A5 trim 148 × 210 mm + 도련 3mm = 154 × 216 mm |
| **페이지 수** | 256p (16절판 16의 배수, 한 면 16p × 16면) |
| **종이** | 70g 만년필 친화지 (도모에리버 대체재) |
| **인쇄** | 2도 (Navy #1B2A4A + Gold #C9A04F) — 흑백 단도 옵션 가능 |
| **표지** | PU 양장 (Navy 무광) + 금박 박표지 |
| **제본** | 사철 + PUR 풀제본 |
| **부속** | 가름끈 2개 (Gold + Navy, 220mm) |
| **포장** | 박스 + 인삿말 카드 + 사용 가이드 8p + Only One 인증서 |

---

## ▶ 제조사 작업 순서 (권장)

### 1단계: 본문 PDF 확인
```bash
# 페이지 수, 사이즈, 폰트 임베드 확인
pdfinfo print-ready/body_256p.pdf
pdffonts print-ready/body_256p.pdf
```
**기대 결과**:
- Pages: 256
- Page size: 453.543 × 629.291 pts (= 160 × 222 mm, 도련 포함 + 크롭마크 영역)
- 모든 폰트 `emb yes / sub yes`

### 2단계: CMYK 변환 (제조사 RIP/Preflight)
본문 PDF는 RGB로 출력되어 있습니다. 제조사 표준 워크플로우에 따라:
- **권장 ICC 프로파일**: Japan Color 2001 Coated 또는 ISO Coated v2 (FOGRA39)
- **변환 도구**: Adobe Acrobat Pro DC, Enfocus PitStop, callas pdfToolbox 등
- **참고**: 폰트는 이미 임베드+서브셋 처리되어 있어 재처리 불필요

### 3단계: 표지 후가공 위치 확인
`cover-finishing/cover_layout_diagram.pdf` 참조:
- 금박 박표지 위치 (★ 필수): **LIFE PORTFOLIO** (앞표지 상단), **ONLY ONE** (앞표지 하단)
- 책등 표기 (옵션): 세로 LIFE PORTFOLIO (금박)
- 책등 폭은 제작 견본 후 확정 (현재 추정 ~20mm)

### 4단계: 종이·후가공 견본 작업
- 종이 후보: 모리사와 Atelier 70g / 두성 르베르크림 70g / 삼화 만년필지 70g
- 견본 단계에서 만년필 EF닙 + 중성펜 0.38mm 테스트
- 책등 두께 실측 → 표지 spread PDF 재발주 (필요시 인생포트폴리오 측 재공급)

### 5단계: 500부 본 제작

---

## ▶ 색상 사양 (요약)

### Navy (메인)
- HEX `#1B2A4A` · RGB(27, 42, 74)
- CMYK `C100 M85 Y45 K40` (참고치, 제조사 ICC 보정 권장)
- Pantone `2767 C`

### Gold (금박)
- HEX `#C9A04F` · RGB(201, 160, 79)
- CMYK `C20 M35 Y75 K15` (참고치)
- Pantone `871 C` (Metallic, ★ 권장) 또는 `7563 C` (Coated)

상세 내용: `color/colors.txt`, `color/color_swatch.pdf`

---

## ▶ v1.4의 주요 변경 사항 (v1.3 대비)

이번 버전은 **Undated(만년형) 다이어리**로 차별화하기 위해 다음과 같이 개편되었습니다:

1. **Undated 만년형 전환** — 신년 한정 사용 패턴 폐기. 사용자가 시작일(년/월/일) 직접 기입.
2. **연간 캘린더 2p → 4p** — YEAR 1 (시작한 해) + YEAR 2 (다음 해) 펼침면 × 2.
3. **월간 캘린더 Undated 변환** — 요일/연도 빈칸, 1~31 그리드 (29-31은 옵션 빗금).
4. **Weekly Deep Dive Day 신설** — 주 1회 집중 기록 칸 (호보니치 Day-Free 차용). 페이지 추가 0p.
5. **Part 4 영역별 분기 회고 26p → 18p** — Pennebaker 4문항 유지, 영역별 페이지 압축.
6. **자유 메모장 16p → 데일리 저널 24p** — DATE/MOOD/DAY 헤더 추가, "메모" → "데일리 저널" 명칭.
7. **여유 간지 16p → 14p** — 페이지 알지브라 균형 (연간 +2 / Part4 -8 / 메모 +8 / 여유 -2 = 0).

**총 페이지: 256p 유지** (16의 배수, 16절판 최적 그대로).

---

## ▶ 디자인 의도 (제조사 이해용)

이 다이어리는 일반 시판 다이어리가 아닙니다.

- **타깃**: 인생포트폴리오 검사 리포트를 받은 개인 (1:1 맞춤형)
- **차별점 1**: 리포트의 7항목(사명·비전·4SE·강점·성장·실행·진로)을 손글씨로 옮겨 적는 "자기화 의식" — 다른 다이어리에는 없음
- **차별점 2**: Undated 만년형 — 신년이 아니어도 언제든 1년 사용 가능 (오롤리데이 mes 12 mois 11년 베스트셀러 컨셉 차용)
- **차별점 3**: 13영역 인생 지도 + 분기 회고 (Pennebaker 표현적 글쓰기 기반) — 학술적 근거 있는 IP
- **표지 단순화** (v1.3에서 결정): 표지에 일체 메타 정보(날짜·로고박스·작은 텍스트) 미노출 — "LIFE PORTFOLIO + 인생포트폴리오 + ONLY ONE" 3요소만

자세한 디자인 의도: `02_concept_deck.pptx` 16장 슬라이드 참조.

---

## ▶ 회신 요청 (제조사 → 인생포트폴리오)

`01_spec_sheet.pdf` 의 §7. 회신 양식에 따라 다음을 회신 부탁드립니다:

1. 단가 (1부당 도매가, 500부 기준)
2. 종이 권장안 + 견본 가능 여부
3. 책등 폭 추정치
4. 후가공(금박) 단가
5. 납기 (샘플 1부 + 본 제작 500부)
6. 재주문 옵션 (1000부·2000부 단가 차이)

---

## ▶ 연락처

**인생포트폴리오 / Life Portfolio**

— 본 패키지는 동일 양식으로 우일 · 북토리 · 이든프린팅 3개 제조사에 발송됩니다.
   비교 견적 후 1개 제조사를 선정합니다.

---

## ▶ 파일 무결성 확인

```bash
# 본문 PDF 페이지 수
pdfinfo print-ready/body_256p.pdf | grep Pages
# → Pages: 256

# 폰트 임베드 확인
pdffonts print-ready/body_256p.pdf | wc -l
# → 9 (헤더 1줄 + 폰트 8개)

# 표지 PDF
pdfinfo print-ready/cover_front.pdf | grep Pages
# → Pages: 1
```

문서 버전: **v1.4 · 2026-05-20**
패키지 생성: 2026-05-20
