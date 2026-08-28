# 유튜브 전략 & 매뉴얼 (인생포트폴리오)

> 김영식 대표 요청: 검증된 시장조사 + 초등학생도 따라 하는 운영 매뉴얼.
> 작성 2026-06-01 · 브랜치 `genspark_ai_developer`

## 문서 구성

> **읽는 순서**: 이어받아 작업할 때는 **`75_SESSION_STATE.md` 를 먼저** 읽는다.
> 거기에 「지금 어디까지 왔고 다음 1동작이 무엇인가」가 있다. 나머지는 참조용이다.

| 문서 | 무엇 | 누가 읽나 | 갱신 |
|---|---|---|---|
| [`00_CEO_DIRECTIVES.md`](./00_CEO_DIRECTIVES.md) | **대표님 지시 원문 전량 (CEO-1~81)** + 항구 지침 | 전원 | 추가만 |
| [`60_YOUTUBE_MARKET_RESEARCH.md`](./60_YOUTUBE_MARKET_RESEARCH.md) | **왜·어디·어느 결** — 검증된 시장조사. 노출 길목 + 전환 경로 | 대표·전략 | — |
| [`61_YOUTUBE_MANUAL.md`](./61_YOUTUBE_MANUAL.md) | **어떻게** — 채널 생성→제작→운영 step-by-step | 실행자 | — |
| [`70_HYBRID_3D_MOTION_GUIDE.md`](./70_HYBRID_3D_MOTION_GUIDE.md) | **하이브리드 3D 모션이 무엇이고 왜 그렇게 만드는가** — 원리 학습용 | 대표·학습 | 완료 |
| [`71_HYBRID_3D_PRODUCTION_RULES.md`](./71_HYBRID_3D_PRODUCTION_RULES.md) | **따라 하면 같은 품질이 나오는 실행 규칙** — 교훈 1~213 | 제작 실행자 | 추가만 |
| [`76_BENCHMARK_STUDY.md`](./76_BENCHMARK_STUDY.md) | **벤치마크 학습 대장** — 분석 결과를 우리 파일/상수로 번역한 표 (CEO-80 D) | 제작 실행자 | 추가만 |
| [`72_CREDIT_DISCIPLINE.md`](./72_CREDIT_DISCIPLINE.md) | 유료 호출 규율 | 제작 실행자 | — |
| [`73_ARTIFACT_LEDGER.md`](./73_ARTIFACT_LEDGER.md) | **산출물 URL 전량 + 승인/반려 판정 태그** | 제작 실행자 | 추가만 |
| [`74_SHORTS_TRILOGY_SPEC.md`](./74_SHORTS_TRILOGY_SPEC.md) | **숏츠 3부작 정본** — CEO-70/71 지시의 실행 스펙 | 제작 실행자 | 확정 시 |
| [`75_SESSION_STATE.md`](./75_SESSION_STATE.md) | **★지금 어디까지 왔나 · 다음 1동작★** | **전원 · 최우선** | **매 세션** |

### 왜 이렇게 분리했나 (CEO-72)

> "대화 압축하는 시간이 너무 많아요. … 아주 큰 병목 사항입니다."

누적 상태(지시 원문 · 교훈 · URL · 코드)를 대화 안에 들고 다니면 매 세션 재압축 비용이
붙는다. 그래서 **확정·불변**은 문서로, **재현 가능한 소스**는
[`youtube/hybrid3d/pipeline/`](../../../youtube/hybrid3d/pipeline/) 로 외부화하고,
대화에는 **살아있는 상태 4항목**만 남긴다. 상세: 교훈 192.

## 30초 핵심

- **어디(길목)**: 숏츠(노출) + 유튜브 검색(고의도 전환). 우리 고객은 "퇴사·번아웃·MBTI 다음"을 검색한다.
- **어느 결(전환)**: 숏츠 → 롱폼(신뢰) → 설명란 첫 줄 링크 → lifeportfolio.co.kr 진단(₩9,900) → 21일 → 다이어리.
- **솔직한 진실**: 유튜브는 메인 엔진이 아니라 **24시간 일하는 무료 영업사원(복리 자산)**. 첫 90일 KPI는 매출이 아니라 **노출·구독·방문**.

## 검증 출처

- 외부(2025~2026): 와이즈앱/조선일보(MAU 4,848만), 방통위(숏폼 78.9%), vidIQ(2026 알고리즘), Influencer Marketing Hub(설명란 CTR +40%), AdBacklog(CVR 0.1~0.5%)
- 내부(27종): 시장조사 1~4단계, 90일 가이드, O.구매전환 컨설팅, C.브랜드 메시지북
