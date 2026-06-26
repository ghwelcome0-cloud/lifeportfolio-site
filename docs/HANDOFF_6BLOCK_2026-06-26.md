# 6블록 구조 작업 핸드오프 (임시 마감)

- **작성일**: 2026-06-26
- **상태**: 🟡 1·2단계 완료(배포됨) / 🔴 핵심 "압축" 미완 — **임시 마감, 추후 재개 예정**
- **목적**: 마케팅 유입 → 결제 전환율 **3%+** 달성을 위한 홈(index.html) UX/카피 개선
- **근거**: 미리보기 `design-preview/preview-live.html`(6블록 mockup) + 인스타 "돈 쓸어담는 사업의 공통점" 8원칙 평가(종합 7.4/10)

---

## ✅ 완료된 것 (라이브 반영·검증 완료)

### 1단계 — 섹션 재배열 (순서만, 카피 무변경)
- **커밋 `51aea32`** (상단): `hero-detail → selfcheck → persona-routes → proof → problem`
  - 의도: selfcheck(30초 자가진단)를 hero 직후로 끌어올려 "내 얘기네" 즉시 몰입 (8원칙 #3)
- **커밋 `73342c8`** (중하단): 6블록 논리 순서로 정렬 + **guarantee를 결제 직전(final-cta 앞)으로 이동**
  - 최종 흐름: `PROBLEM → SOLUTION(difference/deliverables/sample/result) → PROOF(voices/trust) → ACTION(how/faq) → EXPAND(insights/b2b/journey) → guarantee → FINAL CTA(결제)`
  - 의도: 환불보장(8원칙 #5 핑계 제거)을 결제 결정 순간에 배치 → 전환 마찰 최소화
  - 검증: 순수 위치 이동(전체 텍스트 정렬 md5 동일), 2911줄·18섹션·style5·div190·i18n398 보존

### 2단계 — 카피 강화 (감정·부담 대비)
- **커밋 `dc7ff1a`**: PROBLEM 도입부 + difference 대비 카피를 "우리 가치 언어"로 변경
  - 변경 4개 키: `problem.eyebrow`, `problem.h2`, `problem.lead`, `difference.bad_li3`
  - 톤: '기준 정리'(이성) → '마음이 막막함'(감정 공감) → '이미 내 안에 있는 것의 발견' 서사 (8원칙 #7·#4)
  - index.html + ko.json + en.json 동시 수정, 키 패리티 1351=1351 일치

---

## 🔴 미완 — 핵심 "6블록 압축"이 빠짐 (다음 재개 시 작업)

### 무엇이 빠졌나 (정확한 한계)
- 한 일 = **기존 18개 섹션의 "순서" 재배열 + 일부 카피 변경**
- 안 한 일 = 미리보기처럼 **18개 → 6개 블록으로 "통합·압축"** (시각적 블록 경계, 한 블록 1메시지, 분량 축소)
- 결과: 라이브는 여전히 **section 18개 그대로**. 미리보기는 **10 section / 6 BLOCK**(`blocktab` 라벨로 명시 구분).
- **즉, 미리보기 6블록 구조 "이식" 요청의 절반만 달성** — 핵심 효과인 "인지부하 감소(8원칙 #3)"의 압축 부분 미반영.

### 데이터 비교
| 구분 | 미리보기(preview-live.html) | 현재 라이브 |
|---|---|---|
| 구조 단위 | 6 BLOCK (blocktab 명시) | 18 section (순서만 6블록 논리) |
| section 수 | 10 | 18 |
| 시각적 블록 경계 | 있음 | 없음 |
| 인지부하/분량 | 압축됨 | 거의 그대로 |

### 재개 시 선택지 (보류 결정 대기)
- **(A) 시각적 6블록 + 섹션 통합·압축**: 미리보기처럼 18→6 묶음, 중복 섹션 통합/축약. 효과 큼 / 위험 큼(카피 삭제·통합, 검증 부담).
- **(B) 점진적 압축 [추천]**: 중복 큰 섹션 2~3개만 먼저 통합(예: `result+deliverables` 묶기, `trust+guarantee`는 이미 인접). 효과 일부 + 저위험.
- **(C) 현 상태 유지**: 순서·카피 개선만으로 효과 관찰.

### ⚠️ 압축 작업 시 주의점 (제약 조건)
- `preview-live.html`은 **`var(--fs)` 토큰 0회 사용 + `data-i18n` 없음** → **그대로 덮어쓰기 금지**(토큰·i18n 파괴). 구조만 참조.
- 라이브 index.html은 디자인 토큰 + data-i18n 398개 사용 → 압축해도 **토큰·i18n 보존 필수**.
- 일부 섹션(`insights`/`b2b`/`journey`)은 **직전에 전용 `<style>` 블록**이 붙어 있음(총 style 5쌍). 이동·삭제 시 style 동반 처리 필요. 상단 4섹션·problem~faq 구간은 style 없는 깨끗 구간.
- 카피 변경 시 **ko.json + en.json 동시 수정 + 키 패리티 유지** 필수.
- 비파괴 원칙: 변경 후 `section open=close`, `div open=close`, JSON 유효성, 키 패리티 검증.

---

## 작업 환경 메모
- **배포**: `git push origin main` → GitHub Actions "Deploy to Firebase Hosting"(~2분) → https://lifeportfolio.co.kr/
- **검증**: 라이브 clean URL(`?v=timestamp`) + PlaywrightConsoleCapture(콘솔 에러 0 확인)
- **헌법 준수**: `git add`는 특정 파일만(NEVER `git add -A`), 백업(.bak/tmp) 제외, 결제→검사→리포트→후기 플로우 절대 손상 금지
- **관련 파일**:
  - `index.html` (홈, 2911줄, section 18개)
  - `assets/i18n/ko.json`, `assets/i18n/en.json` (각 1351키, 패리티 유지)
  - `design-preview/preview-live.html` (6블록 mockup, read-only 참조용)

## 관련 커밋 (이 작업분)
```
dc7ff1a 6블록 2단계 — PROBLEM 감정 공감 + SOLUTION 부담 대비 카피
73342c8 6블록 1단계-2 — 중하단 섹션 정렬 + 보장 재배치
51aea32 6블록 1단계 — 상단 섹션 재배열 (HOOK 몰입 강화)
```
