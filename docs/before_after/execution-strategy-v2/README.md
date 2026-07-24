# 실행 프로파일 Before & After — execution-strategy.v2 도입 기록

> 인생포트폴리오 리포트 엔진 v4.1 개선(1단계) 기록.
> 목적: 훗날 변화를 체감하고, '개발자 노트' 블로그에 반영하기 위한 원본 자료.
> 작성: 2026-07-24 / 기준 응답: 김영식(KYS), fingerprint `1940010193`

---

## 1. 무엇이 바뀌었나 (한 줄 요약)

**나열식·파편적 6필드**를 → **전략 커널(Diagnosis → Guiding Policy → Coherent Actions →
Implementation Intentions → Next Action) 기반의 서사형 6필드**로 재구성했다.
공개 렌더링 계약(6개 문자열 `type/style/drivers/environment/activities/tools`)은 그대로 유지하고,
구조화 원본은 `execution_profile.content._strategy`(execution-strategy.v2)에 additive로 저장한다.

- scheme: `execution-strategy.v2`
- fallback: `false` (엔진이 정상 생성 — 실패 시 기존 v1.3/v4.1 6필드로 자동 회귀)
- §7(원분야 비노출) 준수: 고객 대면 텍스트에 종교 표현 0건
- 결정성: 동일 입력 → 동일 출력 (fingerprint 불변)

---

## 2. Before & After 6필드 (동일 응답 기준)

### 실행 방식 (type)
- **Before**: 신중하게 먼저 할 일을 순서대로 정리해 계획을 세우고, 그다음 그 판단으로 갈 방향을 정합니다.
- **After**: 질서를 세우고, 신뢰로 끝냅니다. 복잡한 정보를 먼저 구조화하고 검토할 수 있는 첫 결과물을 만든 뒤, 필요한 사람의 반응을 반영해 책임질 수 있는 결과로 완성합니다.

### 실행 리듬 (style)
- **Before**: 틀을 잡아 두고 움직입니다.
- **After**: 모으고, 세우고, 끝냅니다. 아이디어를 한곳에 모으고 완료 기준과 첫 결과물을 정한 뒤, 한 번 검토하고 공유·발행·전달로 마무리합니다.

### 추진력 요인 (drivers)
- **Before**: 신뢰, 성장, 책임
- **After**: 사랑·자유·의미 추구를 선택 기준으로 삼습니다. 모두 충족하기 어렵다면 지금 가장 책임져야 할 결과를 우선합니다.

### 몰입 환경 (environment)
- **Before**: 조용한 공간 (도서관, 독서실 등), 정돈된 실내 (정리된 내 방, 사무 공간) / 아침에 일찍 시작하고 저녁에 일찍 마무리하는 루틴
- **After**: 익숙한 공간에서 방해 요소를 줄이고 이번 몰입 시간에 끝낼 한 가지를 정할 때 실행력이 높아집니다.

### 잘 맞는 활동 (activities)
- **Before**: 사람들과 아이디어를 나누거나 토론하기, 문제를 분석하고 해결책을 찾는 일, 교육과 학습 방식
- **After**: 흩어진 정보를 구조화하고 문제의 핵심을 찾아 사람들이 움직일 수 있는 방향과 결과로 만드는 일에 강점이 있습니다.

### 추천 도구/전략 (tools)
- **Before**: 문제를 해결하고 결과가 나왔을 때 · 아이디어 캡처 · 창작 루틴 · 발행 루틴
- **After**: 새 요청이 들어오면 먼저 한곳에 기록합니다. 계획이 부족하다고 느껴지면 추가 조사보다 첫 결과물과 완료 기준부터 정합니다. 반응이 엇갈리면 처음 정한 목적과 책임질 결과로 돌아갑니다. 지금은 진행 중인 한 가지의 완료 기준을 한 문장으로 적습니다.

---

## 3. 관찰 포인트 (블로그 소재)

1. **"라벨은 그대로, 알맹이가 달라졌다"** — 6개 항목명은 동일하지만, Before는 응답 조각의
   단순 나열, After는 "무엇을 · 어떤 순서로 · 어떤 신호가 오면 어떻게" 실행할지의 지침으로 바뀜.
2. **추천 도구/전략의 변화가 가장 극적** — Before는 라벨 파편(`· 아이디어 캡처 · 창작 루틴`)이라
   무엇을 하라는지 불명확. After는 if-then(실행 의도) + 지금 당장의 다음 행동까지 명시.
3. **맞춤형 실행 프로그램과의 연결** — Program Engine이 이제 전략 문장의 쉼표 조각을
   활동/도구명으로 오해석하지 않고, 회원의 원응답(source)을 우선 소비 → 프로그램 문구 품질도 상승.
4. **정직성** — 엔진이 전략을 만들지 못하면 기존 6필드로 조용히 회귀(fallback). 억지 생성 없음.

---

## 4. 파일

- `kys_execution_profile_before_after.html` — 실제 리포트 북 뷰 스타일 적용 비교 뷰(재현용)
- `kys_before_after_desktop_1280.png` — 데스크톱 1280px 캡처
- `kys_before_after_mobile_390.png` — 모바일 390px 캡처
- `kys_before_after_mobile_320.png` — 모바일 320px 캡처(오버플로우 없음 확인)

## 5. 재현 방법

```bash
# 6필드 실제 추출 (v2 런타임)
node scripts/test_v4_kys_regen.js        # v1.3 raw / v4 upgrade 결과 콘솔 출력
node scripts/test_execution_strategy_v2.js  # v2 단위 테스트 PASS 29/0/0
```

## 6. 관련 커밋 (브랜치 feat/execution-strategy-v2)

- `60bb6ba` Commit 1 — v2 단위 테스트 + KYS v2 골든 fixture
- `4ffc2e7` Commit 2 — report-engine-v4.js v2 엔진 + 6필드 컴파일
- `ff03c7c` Commit 3 — program-engine.js source 우선 소비 + 파편 오삽입 방지
- `20559e3` Commit 4 — report-rules.json 전략형 example + additive 메타

> 릴리스 불변식: Commit 2 + Commit 3은 반드시 함께 배포. 리포트만 배포하면
> Program Engine이 긴 전략 문장 조각을 활동/도구로 오삽입함.
