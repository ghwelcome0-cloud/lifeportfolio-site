# Life Portfolio — 상표권 등록용 로고 자산 (Trademark Assets)

> KIPO(특허청) 상표 출원용 로고 파일 세트입니다.
> 한국특허청 표준: 컬러 + 흑백 견본 각각 제출, 최소 200×200px (권장 800×800px 이상).

## 📦 파일 목록

### 1) 정사각 마크 (Square Emblem) — **상표 출원 메인**

| 파일 | 사이즈 | 용도 |
|---|---|---|
| `lifeportfolio-mark-color.svg` | Vector | 마스터 원본 (확대 무손실) |
| `lifeportfolio-mark-color-512.png` | 512×512 | 앱 아이콘 / 소셜 프로필 |
| `lifeportfolio-mark-color-1024.png` | 1024×1024 | 일반 웹 사용 |
| `lifeportfolio-mark-color-2048.png` | 2048×2048 | **KIPO 출원 표준 사이즈** |
| `lifeportfolio-mark-color-4096.png` | 4096×4096 | **KIPO 출원 마스터 (인쇄/대형)** |
| `lifeportfolio-mark-bw.svg` | Vector | 흑백 마스터 (KIPO 흑백 견본) |
| `lifeportfolio-mark-bw-2048.png` | 2048×2048 | **KIPO 흑백 견본 제출용** |
| `lifeportfolio-mark-bw-inverse-2048.png` | 2048×2048 | 다크모드/특수 인쇄용 |

### 2) 워드마크 (Wordmark) — 가로형 보조 표장

| 파일 | 사이즈 | 용도 |
|---|---|---|
| `lifeportfolio-wordmark-ko.svg` | Vector | 한글 워드마크 (인생포트폴리오) — **권장 사용 (한글 폰트 포함)** |
| `lifeportfolio-wordmark-en.svg` | Vector | 영문 워드마크 (Life Portfolio) |
| `lifeportfolio-wordmark-en-2048.png` | 2048×512 | 영문 PNG |
| `lifeportfolio-wordmark-ko-fallback-2048.png` | 2048×512 | (폰트 미보유 환경 fallback — Romanised) |

> 💡 **한글 워드마크 PNG가 필요할 경우**: `lifeportfolio-wordmark-ko.svg`를 Inkscape, Figma, Adobe Illustrator 또는 온라인 변환기(예: cloudconvert.com)에서 PNG로 export 하시면 한글이 정확히 렌더링됩니다.

## 🎨 브랜드 사양 (확정)

| 요소 | 값 | 설명 |
|---|---|---|
| 배경색 | `#4A6680` | Slate Blue — 신뢰·차분·자기경영 |
| 보더(테두리) | `#C8A24A` | Muted Gold — 가치·완성·기록 |
| 문자색 ("L") | `#F4ECD8` | Warm Cream — 발견·온기 |
| 액센트 (점) | `#C8A24A` | Muted Gold — i18n의 점·정체성 |
| 글꼴 (마크) | Georgia / Times New Roman / Noto Serif KR | 세리프 (전통·신뢰) |
| 글꼴 (워드) | Noto Sans KR / Pretendard / Apple SD Gothic Neo | 산세리프 (가독성) |

### 디자인 의도
- "L"은 Life·Live·Leave (발견·살아냄·남김)을 상징
- 우상단의 황금 점은 "오직 단 하나의 답(Only One)"을 상징하며, 또한 'i'의 점·"포트폴리오"의 마침표 역할
- 정사각 외곽 + 안쪽 골드 보더는 "한 권의 인생 설계도"라는 콘셉트를 시각화

## 📋 KIPO 상표 출원 시 권장 제출 파일

특허청 전자출원 시 첨부할 견본:

1. ✅ **컬러 견본**: `lifeportfolio-mark-color-2048.png` (또는 SVG → PDF)
2. ✅ **흑백 견본**: `lifeportfolio-mark-bw-2048.png`
3. ✅ **고해상도 마스터(인쇄용)**: `lifeportfolio-mark-color-4096.png`
4. (선택) 워드마크 별도 출원 시: `lifeportfolio-wordmark-ko.svg` → PNG/PDF 변환

> ⚠️ KIPO 견본 규격: JPG/PNG, 최소 200×200, 권장 800×800 이상, 5MB 이내. 본 자산 세트는 모든 요건을 충족합니다.

## 🔁 재생성 방법

디자인 수정이 필요한 경우:

```bash
cd /home/user/webapp
python3 scripts/generate_trademark_logos.py
```

## 📅 버전

- v1.0 (2026-05-05) — PR #21 / 최초 제작
