# 홈페이지 페르소나 최적화 — 구현 계획서 (확정안)

> **상태**: 사용자 결정사항(D1~D7) 반영 완료. 즉시 구현 개시.
> **승인일**: 2026-05-19
> **선행 문서**: `01_audit_and_plan.md`

---

## 0. 사용자 확정사항 (Verbatim)

1. **다이어리 언급 일체 배제** — 준비 후 별도 추가
2. **기업 내부 언어 금지** — 페르소나·대중 언어만
3. **D1 Hero H1**: 현 카피 유지 (페르소나에게 이미 적합). 네거티브 프레임 절대 금지.
4. **D2 ₩9,900 가격박스**: 현재 유지
5. **D3 Persona Routes 4카드**: 추천 카피 채택 (다이어리 표현 제거)
6. **D4 사전 알림 폼**: 보류
7. **회귀 무결성**: 다른 페이지/기능 마비 절대 금지 — 전체 검증 필수

### 추가 디렉티브
- **최고 기술 반영**: 3D/모션 UX (단, 안전·성능 우선)
- **몰입 → 전환** 구조: P1~P4가 홈페이지에서 몰입하고, 결국 ₩9,900 결제로 전환

---

## 1. 작업 범위 최종 확정

### KEEP (변경 없음, 11개 섹션)
- Announcement, Top Nav, Proof, Self-check, Problem, Difference, Sample, How, Result, Trust, Guarantee, Insights, Final CTA, Footer, Mobile Sticky CTA, FAQ(기존 문항)
- **Hero H1·H2·가격박스·CTA 버튼 카피**: 그대로 유지

### MAJOR-MOD (2개)
- **Hero 시각 강화** (카피는 유지, 시각/모션만 추가)
  - 우측 hero-card에 **"당신은 어디에 가까우신가요?"** 4분기 미리보기 인서트 (기존 3단 카드는 보존하되 헤더 한 줄로 압축)
  - Hero 배경에 **conic-gradient aurora** 미세 모션 (60s 회전)
  - H1에 **scroll-driven highlight** 효과
- **Journey 섹션**: 다이어리 표현 제거. "₩9,900 진단" → "21일 실행" → "분기 점검" → "지속적 살아냄" 4단계 사다리만 유지. (사전 알림 폼은 보류)

### ADD (1개 신규)
- **NEW-A Persona Routes 4카드 섹션**: Hero 직후, Proof 직전에 삽입
  - 4페르소나가 "내 자리"를 즉시 인식
  - 모든 카드의 CTA = **`#final-cta`로 이동** (모두 ₩9,900 결제 동선 통합)

### MINOR-MOD (3개)
- **Reviews**: 후기 카드에 자연어 페르소나 라벨 (예: "30대 직장인", "크리스천", "10년 호보니치 사용자" → 다이어리 표현 제거: "매년 노트를 갱신하던 분")
- **FAQ**: 3개 신규 Q&A 추가 (신앙 도구 / 40~50대 / 다이어리 질문은 **제외**)
- **Deliverables**: 변경 없음 (다이어리 신호 추가 보류)

### REMOVE (0개)
- 어떤 것도 제거하지 않음

---

## 2. NEW-A Persona Routes 4카드 — 확정 카피

> 모든 카피는 "3 No, 3 Yes" 원칙 준수.
> 다이어리 언급 0건. 모든 CTA → `#final-cta` (₩9,900 결제 통합).

| # | 헤드 카피 (공개용) | 서브 카피 | 자연어 호명 (P1~P4) |
|---|----------------|--------|----------------|
| 1 | **사명을 살아내고 싶은 분께** | 시간관리·기도·사명이 한 권에서 정리되는 흐름이 필요하다면 | P1 자연 호명 |
| 2 | **검사 결과를 살아냄으로 잇고 싶은 분께** | 성격검사·강점검사로는 잡히지 않던 '실행'이 필요하다면 | P2 자연 호명 |
| 3 | **다음 인생을 설계하고 싶은 분께** | 직장 권태·창업 직전·전환점 — 다음 길의 한 줄이 필요하다면 | P3 자연 호명 |
| 4 | **올해의 한 권을 정성껏 시작하고 싶은 분께** | 매년 갱신하는 노트 — 올해는 의미가 담긴 한 권으로 시작하고 싶다면 | P4 자연 호명 (다이어리 직접 언급 X) |

### 카드 CTA (4개 모두 동일 결제 동선)
- 모든 카드 → "내 자리에서 시작하기 → " → `goFlow(event)` → `#final-cta` → ₩9,900 결제
- **이중 가격 없음** (₩9,900 단일 결제 동선)

### 디자인
- 2×2 그리드 (데스크톱) / 1열 (모바일)
- **3D 카드 효과**: `transform: perspective(1200px) rotateX(...) rotateY(...)` (마우스 위치 기반 미세 회전)
- 카드 위 호버 시: **conic-gradient 라이트 스윕** + 그림자 깊이 변화
- 다크 모드 대비 카드별 액센트 색상 (4색 — Indigo / Emerald / Amber / Rose)

---

## 3. 3D/모션 기법 적용 매트릭스

### 적용 (안전·성능 검증된 CSS-only)
| 효과 | 위치 | 기법 | 용량 |
|------|----|------|----|
| Aurora 배경 모션 | Hero | `conic-gradient` + `@keyframes spin 60s linear` | 0KB |
| Tilt 3D 카드 | Persona Routes 4카드 | `perspective() + rotateX/Y` (JS pointer event) | ~0.6KB |
| Scroll-driven highlight | Hero H1 .highlight | `@scroll-timeline` + CSS fallback | 0KB |
| 입장 페이드 | 신규 섹션 | `IntersectionObserver` (기존 코드 패턴 재사용) | ~0.3KB |
| 카드 호버 라이트 스윕 | Persona Routes | `radial-gradient` + mouse position CSS vars | 0KB |
| 마이크로 그림자 호흡 | CTA 버튼 | `@keyframes pulse 3s ease-in-out infinite` | 0KB |

### **모든 모션은 `prefers-reduced-motion: reduce` 자동 비활성** (접근성)

### 미적용 (CSP·성능·안정성 리스크)
- ❌ Three.js / WebGL (외부 의존성 + 100~500KB)
- ❌ Spline iframe (CSP 충돌)
- ❌ Lottie (외부 JSON 로드 + 30~100KB)
- ❌ GSAP (라이선스 + 50KB+)

---

## 4. 회귀 방지 체크리스트 (사용자 직접 지시 사항)

### 사전 점검
- [x] `#sample` anchor가 `product.html`에서 외부 진입 — **반드시 유지**
- [x] `#problem`, `#difference`, `#deliverables`, `#how`, `#faq`, `#final-cta`, `#insights`, `#journey` — 모두 유지
- [x] i18n 키 (`ko.json` / `en.json`) — 기존 키 변경 금지, **신규 키만 추가**
- [x] `goFlow(event)` 함수 — 변경 금지 (결제 동선)
- [x] Firebase Auth (`firebase.auth()`) — 변경 금지
- [x] CSP 헤더 (line 449) — **외부 신규 도메인 추가 안 함**

### 사후 검증 (자동)
- [ ] `tools/seo_healthcheck.py` 실행 — CRIT 0건
- [ ] JSON-LD 구조 유효 — `python3 -m json.tool` 통과
- [ ] 모든 anchor `id`가 실제 DOM에 존재
- [ ] i18n 키 KO/EN 동기 (count 일치)
- [ ] Playwright로 콘솔 에러 0건, CTA 클릭 정상 동작

---

## 5. 구현 순서 (의존성 최소화)

```
Step 1. CSS 변수·키프레임·미디어 쿼리 추가     [low risk]
Step 2. NEW-A Persona Routes HTML 삽입         [Hero 직후]
Step 3. Hero 우측 카드 미니 위젯 추가          [기존 3카드 보존]
Step 4. Reviews 라벨 + FAQ 3문항 추가          [추가만, 기존 보존]
Step 5. Journey 섹션 텍스트 정련 (다이어리 제거) [수정만]
Step 6. i18n ko.json / en.json 신규 키 추가    [기존 키 0 변경]
Step 7. SEO 헬스체크 + JSON-LD 검증            [자동]
Step 8. Playwright 콘솔/CTA 동작 테스트         [자동]
Step 9. 커밋 + PR
```

### 각 Step 후 즉시 검증
- 모든 단계마다 grep으로 기존 anchor / i18n key / function 무결성 확인

---

## 6. 페르소나별 몰입 → 전환 동선 (Conversion Flow)

```
[Hero 진입] 
   ↓ "당신 안에 이미 답이 있습니다" (H1 — 4페르소나 공명)
[Hero 우측 mini-quadrant]
   ↓ "당신은 어디에 가까우신가요?" 4분기 미리보기
[Persona Routes (NEW-A)]
   ↓ 4카드 중 1개를 자기 자리로 인식 → CTA 클릭
[Self-check (사용자 지정 유지)]
   ↓ 5문항 자가진단 → "당신께 맞는 한 권" 검증
[Problem → Difference → Deliverables → Sample → How → Result → Trust]
   ↓ 신뢰·시스템·결과 누적
[Reviews] (페르소나 라벨로 자기 자리 재확인)
   ↓
[Guarantee → FAQ] 마지막 의심 해소
   ↓
[Insights] (블로그 Pillar 001 자동 노출)
   ↓ 더 깊이 알아보고 싶은 분 → 더 신뢰
[Journey] "₩9,900은 시작입니다" 다음 단계 안내 (다이어리 제외)
   ↓
[Final CTA] ₩9,900 결제 ✅
```

**핵심**: **모든 페르소나의 CTA가 단 하나의 결제(₩9,900)로 수렴**. 다이어리는 미언급. P1·P3·P4도 우선 진단부터.

---

## 7. 예상 변경 파일

| 파일 | 변경 | 영향도 |
|------|----|------|
| `index.html` | Hero 우측 위젯 + Persona Routes 섹션 + Reviews 라벨 + FAQ 3건 + Journey 정련 | 큼 (단, 카피 기둥 유지) |
| `assets/i18n/ko.json` | 신규 키 ~25개 추가 (기존 키 0건 변경) | 작음 |
| `assets/i18n/en.json` | 신규 키 ~25개 추가 (기존 키 0건 변경) | 작음 |
| `docs/strategy/landing/02_implementation_plan.md` | 본 문서 (신규) | — |

**index.html 외 다른 페이지(product, mypage, login, signup, report, program-loading, privacy, terms, blog/) 전혀 손대지 않음.**

---

## 8. 사용자 의도 충실도 자가 검증

| 사용자 지시 | 본 계획 준수 여부 |
|---------|--------------|
| 다이어리 표현 배제 | ✅ Persona Route 4번 카드도 "올해의 한 권" 추상 표현 |
| 기업 내부 언어 금지 | ✅ "퍼소나", "P1~P4", "CAC", "LTV" 등 0건 |
| H1 카피 유지 | ✅ 시각/모션만 강화, 카피 변경 0 |
| 네거티브 프레임 금지 | ✅ "방향은 아는데 안 되는 분" 같은 표현 0건. 전부 긍정형 |
| ₩9,900 가격박스 유지 | ✅ Hero 그대로 |
| 4카드 카피 추천안 | ✅ 다이어리 표현만 제거 후 채택 |
| 사전 알림 폼 보류 | ✅ Journey에서 폼 미추가 |
| 다른 기능 마비 금지 | ✅ goFlow / Firebase / CSP / anchor / i18n 기존 키 무변경 |
| 최고 기술 반영 | ✅ CSS-only 3D/모션 (Linear·Apple 스타일) |
| 몰입→전환 구조 | ✅ 모든 페르소나 CTA가 단일 결제 동선으로 수렴 |

---

*이 계획서대로 구현합니다.*
