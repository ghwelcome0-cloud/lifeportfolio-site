# 인생포트폴리오 맞춤형 다이어리 v1.4.2 — 제조사 발주 패키지

> **버전**: v1.4.2 (Plan A · 인쇄 직행) · 2026-05-25
> **수량**: 500부 (1차 발주)
> **제품**: A5 · 256p · 70g 만년필 친화지 · Undated 만년형 · PU 양장 (BRG) · 2도 인쇄
> **담당**: 김영식 · 010-5179-9206 · faise@lifeportfolio.co.kr

## v1.4.2 패치 (디자인 동기화 + 색상·서체 격상 + 발주처 정보 채움 + 브랜드 일관성)

### ① 표지 컬러 전환 — Navy → British Racing Green (BRG)
- **변경 전**: 클래식 네이비 `#1B2A4A` (Pantone 2767 C)
- **변경 후**: **British Racing Green `#0A3D2A`** (Pantone 357 C)
- **사유**: 고급 초록 톤으로 정체성 격상 (마켓 리서치 결과: 고전·차분·격조)

### ② 표지 서체 전환 — Cormorant Garamond
- **신규 적용**: Cormorant Garamond (Variable, OFL — Google Fonts)
- LIFE PORTFOLIO → Regular 26pt, letter-spacing 0.28em
- Only One → Italic 14pt
- **사유**: 고전 세리프 서체로 격조 강화

### ③ 표지 'L' 모노그램 / 형압 제거
- 박표지·형압 모두 사용 안 함
- 텍스트 3요소만: LIFE PORTFOLIO / 인생포트폴리오 / Only One
- 골드 디바이더 라인 2줄 (38mm) 추가

### ④ 발주처 담당자 정보 명시
- **담당자**: 김영식
- **연락처**: 010-5179-9206
- **이메일**: faise@lifeportfolio.co.kr
- **희망 납기일**: 약 30일 이내 (샘플 + 본 제작)

### ⑤ 타겟 사용자 확장
- **변경 전**: 30~50대 (직장인 · 프리랜서 · 사업자)
- **변경 후**: **10대 후반 ~ 50대 자기설계 의지자** (학생 · 성인 · 준비생 · 직장인 · 프리랜서 · 사업자)

### ⑥ 타 브랜드 레퍼런스 일괄 제거
- 프랭클린/몰스킨/호보니치/오롤리데이 등 상업 브랜드 언급 제거
- 학술 인용도 일반화된 표현으로 통일 ("ABC 우선순위", "실행 의도 연구", "표현적 글쓰기 기법", "사회적 약속 연구" 등)
- 제조사 추천 멘트(우일/북토리/이든프린팅) 제거
- **사유**: 자체 브랜드 일관성 강화

### ⑦ 디지털 목업 디자인 동기화
- Part 0 4SE·강점·성장·실행 프로파일·진로 페이지 디자인을 디지털 목업과 1:1 매칭으로 재구현
- hw-box (손글씨 박스), evidence-box (근거 박스), placeholder-hint (빈칸 가이드) 등 시각 요소 PDF 본문에 반영
- 새로 추가/재작성된 페이지 함수 13개:
  `intro_with_start_date`, `mission_page`, `vision_page`, `_se_block`,
  `four_se_a_page`, `four_se_b_page`, `top3_strengths_page`, `top2_growth_page`,
  `execution_profile_page`, `career_3cards_page`, `part0_outro_page`,
  `domain_map_left`, `domain_map_right`, `annual_vision_left`,
  `milestones_90_right`, `monthly_left_undated`, `monthly_right_priority`,
  `weekly_left`, `weekly_right_deepdive`

### ⑧ 사이트 직링크 제거
- 발주처 정보 표에서 `https://lifeportfolio.co.kr` 직링크 제거
- 회신 채널은 이메일·전화로 통일

### ⑨ 본문 구조 버그 수정
- `milestones_90_right`의 `</h1>` 닫힘 누락으로 인한 페이지 overflow 수정 (257p → 256p)

---

## v1.4.1 패치 (이전)
- **Weekly LEFT ④ 요일 그리드**: row 높이를 20pt 정수 단위로 고정하여 sub-pixel rounding drift 제거
- **WEEK 만년형 날짜 라인**: 언더스코어 문자 토막짐 → 실제 border-bottom 라인 2개 + dash로 교체

---

## ▶ 가장 중요한 파일 (제조사 우선 확인)

```
📄 01_spec_sheet.pdf          ← 전체 사양서 (회신 양식 포함, v1.4.2)
📄 02_concept_deck.pptx       ← 16장 컨셉 덱 (디자인 의도, v1.4.2)
📁 print-ready/               ← ★ 인쇄 직행 PDF 모음 ★
   ├─ body_256p.pdf           ← 본문 256p (A5 + 도련 3mm, 폰트 임베드)
   ├─ cover_front.pdf         ← 앞표지 (BRG + Cormorant Garamond, v1.4.2)
   ├─ cover_back.pdf          ← 뒤표지 (BRG, v1.4.2)
   └─ fonts/                  ← Noto Sans/Serif CJK KR + Cormorant Garamond (SIL OFL)
📁 digital-mockup/            ← ★ 디지털 목업 (오프라인 열람 가능) ★ NEW v1.4.2
   ├─ index.html              ← 256p 전체 디지털 시안 (브라우저로 열기)
   ├─ README.md               ← 여는 방법 + 비밀번호 안내
   ├─ css/diary.css           ← 스타일시트
   └─ js/                     ← 보안 게이트 + 페이지 네비
📁 cover-finishing/           ← 후가공 위치 가이드
   ├─ cover_layout_diagram.pdf  ← 금박 위치 mm 단위 다이어그램 (v1.4.2)
   └─ only_one_text.svg       ← ONLY ONE 텍스트 SVG (참고)
📁 color/                     ← 색상 사양 (v1.4.2 BRG)
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
| **인쇄** | 2도 (**BRG #0A3D2A** + Gold #C9A04F) — 흑백 단도 옵션 가능 |
| **표지** | PU 양장 (**BRG 무광**) + 금박 박표지 (텍스트만) |
| **표지 서체** | **Cormorant Garamond (Variable, OFL)** — Regular / Italic |
| **제본** | 사철 + PUR 풀제본 |
| **부속** | 가름끈 2개 (Gold + BRG, 220mm) |
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
- 모든 폰트 `emb yes / sub yes` (Cormorant Garamond 포함)

### 2단계: CMYK 변환 (제조사 RIP/Preflight)
본문 PDF는 RGB로 출력되어 있습니다. 제조사 표준 워크플로우에 따라:
- **권장 ICC 프로파일**: Japan Color 2001 Coated 또는 ISO Coated v2 (FOGRA39)
- **변환 도구**: Adobe Acrobat Pro DC, Enfocus PitStop, callas pdfToolbox 등
- **참고**: 폰트는 이미 임베드+서브셋 처리되어 있어 재처리 불필요

### 3단계: 표지 후가공 위치 확인
`cover-finishing/cover_layout_diagram.pdf` 참조:
- 금박 박표지 위치 (★ 필수): **LIFE PORTFOLIO** (앞표지 중상단), **Only One** (앞표지 중하단)
- 책등 표기 (옵션): 세로 LIFE PORTFOLIO (금박)
- 책등 폭은 제작 견본 후 확정 (현재 추정 ~20mm)
- **'L' 모노그램 / 형압 사용 안 함** (v1.4.2 결정)

### 4단계: 종이·후가공 견본 작업
- 종이 후보: 모리사와 Atelier 70g / 두성 르베르크림 70g / 삼화 만년필지 70g
- 견본 단계에서 만년필 EF닙 + 중성펜 0.38mm 테스트
- 책등 두께 실측 → 표지 spread PDF 재발주 (필요시 인생포트폴리오 측 재공급)

### 5단계: 500부 본 제작

---

## ▶ 색상 사양 (요약)

### BRG — British Racing Green (메인, v1.4.2 ★)
- HEX `#0A3D2A` · RGB(10, 61, 42)
- CMYK `C85 M45 Y85 K55` (참고치, 제조사 ICC 보정 권장)
- Pantone `357 C` ★ 권장 (또는 `553 C`)

### Gold (금박)
- HEX `#C9A04F` · RGB(201, 160, 79)
- CMYK `C20 M35 Y75 K15` (참고치)
- Pantone `871 C` (Metallic, ★ 권장) 또는 `7563 C` (Coated)

상세 내용: `color/colors.txt`, `color/color_swatch.pdf`

---

## ▶ 디자인 의도 (제조사 이해용)

이 다이어리는 일반 시판 다이어리가 아닙니다.

- **타깃**: 10대 후반 ~ 50대 자기설계 의지자 (학생·성인·준비생·직장인·프리랜서·사업자)
- **차별점 1**: 리포트의 7항목(사명·비전·4SE·강점·성장·실행·진로)을 손글씨로 옮겨 적는 "자기화 의식" — 다른 다이어리에는 없음
- **차별점 2**: Undated 만년형 — 신년이 아니어도 언제든 1년 사용 가능
- **차별점 3**: 13영역 인생 지도 + 분기 회고 (표현적 글쓰기 기반) — 학술적 근거 있는 IP
- **표지 단순화** (v1.3에서 결정 · v1.4.2 컬러·서체 격상): 표지에 일체 메타 정보(날짜·로고박스·작은 텍스트) 미노출 — "LIFE PORTFOLIO + 인생포트폴리오 + Only One" 3요소만, BRG + Cormorant Garamond

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

- **담당자**: 김영식
- **전화**: 010-5179-9206
- **이메일**: faise@lifeportfolio.co.kr
- **희망 납기**: 약 30일 이내 (샘플 + 본 제작)

---

## ▶ 파일 무결성 확인

```bash
# 본문 PDF 페이지 수
pdfinfo print-ready/body_256p.pdf | grep Pages
# → Pages: 256

# 폰트 임베드 확인 (Cormorant Garamond 포함)
pdffonts print-ready/body_256p.pdf | wc -l
# → 10 이상 (헤더 1줄 + 폰트 9개+)

# 표지 PDF
pdfinfo print-ready/cover_front.pdf | grep Pages
# → Pages: 1
```

문서 버전: **v1.4.2 · 2026-05-25**
패키지 생성: 2026-05-25
