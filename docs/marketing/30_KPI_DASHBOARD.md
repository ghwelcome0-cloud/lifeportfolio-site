# KPI 대시보드 & Go-No-Go 의사결정 매뉴얼

> **출처**: 3단계 §7 (KPI/LTV/CAC) + 4단계 §7 (90일 액션 KPI)
>
> **목적**: 매일/매주/매월 무엇을 측정하고, 어느 임계값에서 무엇을 결정하는지 단일 매뉴얼

---

## 1. KPI 계층 구조 (3-Tier)

```
TIER 1 (North Star) — 매월 결산
  └─ S1 월 매출 (목표 ₩20.8M / 1,500건 × ₩9,900 + 코칭 전환)

TIER 2 (Operational) — 매주 결산
  ├─ ROAS (Return on Ad Spend)
  ├─ 결제 CVR (전환율)
  ├─ 21일 코칭 CVR
  ├─ CAC (Customer Acquisition Cost)
  └─ LTV (Lifetime Value)

TIER 3 (Activity) — 매일 점검
  ├─ 광고 노출/클릭/CTR
  ├─ 랜딩 페이지 PV / 체류시간
  ├─ 결제 시도 / 결제 완료
  ├─ 카카오 알림톡 발송/오픈/클릭
  └─ 블로그 글 GSC 클릭/노출
```

---

## 2. 핵심 KPI 정의 + 계산식 + 목표

| KPI | 계산식 | D+30 목표 | D+60 목표 | D+90 목표 |
|---|---|---|---|---|
| **월 결제 건수 (S1)** | 결제 완료 사용자 수 / 월 | 300건 | 800건 | 1,500건 |
| **결제 CVR** | 결제 / 랜딩 방문 | 2.5% | 3.0% | 3.5% |
| **21일 코칭 CVR** | 코칭 결제 / 진단 결제 | 5% | 8% | 10% |
| **ROAS** | 광고 매출 / 광고비 | 250% | 350% | 400% |
| **CAC** | 광고비 / 결제 건수 | ≤ ₩4,000 | ≤ ₩3,300 | ≤ ₩2,800 |
| **LTV (실측)** | 누적 결제 합 / 결제 사용자 수 | ₩11,000 | ₩13,500 | ₩16,000+ |
| **LTV/CAC** | LTV / CAC | ≥ 2.5 | ≥ 3.0 | ≥ 3.5 |
| **LLM 인용 점유율 (NP1)** | LLM 5채널 인용 / 점검 쿼리 × 100 | 측정 시작 | 25% | 40% |

---

## 3. UTM 트래킹 규칙 (단일 진실 원천)

```
utm_source     플랫폼:     meta, naver, youtube, instagram, threads, kakao, blind, jobkorea
utm_medium     형식:       paid, organic, seed, ppl, shorts, alert, seo
utm_campaign   캠페인:     s1_w{1-12}_{persona}    예: s1_w3_p1
utm_content    소재:       cr{id}_{angle}           예: cr01_aifear, cr05_godsaeng
utm_term       키워드/   creator
```

**검증 룰**:
1. 모든 광고 URL은 `/utm-builder.html`로 생성한 것만 사용
2. UTM 없는 트래픽은 모두 `direct/none` → 매주 리뷰 시 출처 추적
3. campaign 명은 주차마다 갱신 (s1_w3 → s1_w4) — 시계열 분석 가능
4. content 명은 카피 변경마다 갱신 — A/B 테스트 자동 분리

---

## 4. 매일 보는 화면 (Daily Dashboard)

> 매일 오전 9시, 10분 안에 끝낼 점검

### 4-1. 메타 광고 매니저
```
□ 어제 광고비 ₩___ (예산 대비 ±20% 이내?)
□ CTR ___% (목표 2.0%+)
□ CPM ₩___ (목표 ₩15,000 이내)
□ 랜딩 클릭 ___ → 결제 ___ (CVR ___%, 목표 3%+)
□ 어제 ROAS ___% (목표 250%+)
□ 광고 정책 위반/거부 알림 ___건
```

### 4-2. GA4 / Firebase Analytics
```
□ Active users (24h) ___
□ /lead, /product 페이지 평균 체류 ___s (목표 60s+)
□ 결제 완료 이벤트 ___건
□ 21일 코칭 페이지 진입 ___건
□ 이탈률 (랜딩 즉시) ___% (목표 60% 이하)
```

### 4-3. 카카오 채널
```
□ 친구 추가 ___명
□ 알림톡 +24h 발송 ___ / 오픈 ___% (목표 60%+) / 클릭 ___%
□ 알림톡 +72h 발송 ___ / 오픈 ___% / 클릭 ___%
□ 1:1 문의 ___건
```

### 4-4. GSC (네이버 SEO 보조)
```
□ 검색 노출 (24h) ___
□ 클릭 ___ / CTR ___% (목표 3%+)
□ 평균 게재순위 ___
□ 신규 색인된 URL ___
```

---

## 5. 매주 결산 (Weekly Review — 매주 금요일 17시)

> Looker Studio 대시보드 또는 스프레드시트로 자동화 (`docs/looker-studio-template.md` 참고)

### 결산 양식
```
[Week N 결산 — YYYY-MM-DD]

A. 매출 / 결제
   - 진단 결제 ___건 (목표 ___, ___%)
   - 코칭 결제 ___건 (목표 ___, ___%)
   - 총 매출 ₩___ (목표 ₩___, ___%)

B. 광고 효율
   - 광고비 ₩___
   - 매출 / 광고비 = ROAS ___%
   - CAC ₩___
   - LTV/CAC = ___

C. 채널별 기여
   - meta:    유입 ___, 결제 ___, ROAS ___%
   - naver:   유입 ___, 결제 ___, ROAS ___%
   - youtube: 유입 ___, 결제 ___, ROAS ___%
   - blind:   유입 ___, 결제 ___, ROAS ___% (organic)
   - direct:  유입 ___, 결제 ___, (출처 미상 분석 필요)

D. 페르소나 신호 (자가 보고 설문 기반)
   - P1 번아웃: ___% (n=___)
   - P2 이직:   ___%
   - P3 갓생:   ___%
   - P4 졸업자: ___%

E. 다음 주 액션
   - [ ] 카피 A → B 교체
   - [ ] ___
   - [ ] ___
```

---

## 6. Go-No-Go 의사결정 매트릭스

### D+30 (Day 30 결산)
| 신호 | 결정 |
|---|---|
| ROAS ≥ 350% **AND** 결제 CVR ≥ 3% | ✅ **Go** — Phase 2 광고 스케일업 |
| ROAS 200~349% **OR** 결제 CVR 2~2.9% | 🟡 **Pause** — 카피 재설계 후 +14일 연장 |
| ROAS < 200% **OR** 결제 CVR < 2% | 🔴 **No-Go** — LP·가격·타겟 모두 재검토 |

### D+60 (Day 60 결산)
| 신호 | 결정 |
|---|---|
| 월 결제 800건+ **AND** 21일 CVR 8%+ | ✅ **Go** — S2 본격 영업 + 다이어리 v1 제조 |
| 월 결제 500~799건 | 🟡 **Pause** — 21일 코칭 디폴트 UX 재설계 |
| 월 결제 < 500건 | 🔴 **No-Go** — S1 모델 재검토, S2/S3 모두 보류 |

### D+90 (Day 90 결산 — North Star Check)
| 신호 | 결정 |
|---|---|
| 월 결제 1,500건+ **AND** LTV/CAC ≥ 3.0 | ✅ **Go** — 12M ARR ₩2.5억+ 시뮬레이션 가능, S2/S3 전체 GO |
| 월 결제 800~1,499건 **AND** LTV/CAC ≥ 2.5 | 🟡 **Conditional Go** — S1 고도화 우선, S2는 PoC만 |
| 월 결제 < 800건 | 🔴 **Model Pivot** — 가격/포지셔닝/타겟 전면 재검토 |

---

## 7. 측정 인프라 체크리스트 (Day 1~7 안에 완료)

### 7-1. 분석 도구
[ ] GA4 measurement ID 본 사이트 적용 확인
[ ] Firebase Analytics 이벤트 8종 firing (page_view, click, payment_init, payment_complete, report_view, program_view, program_click, kakao_subscribe)
[ ] 메타 픽셀 + CAPI 셋업 — Event Manager에서 `Purchase` 이벤트 매칭 quality 75+
[ ] 네이버 프리미엄 로그 분석 (선택)
[ ] 카카오 채널 통계 API 연동

### 7-2. UTM
[ ] `/utm-builder.html` 작동 확인
[ ] 캠페인 명명 규칙 팀 공유
[ ] 모든 광고 URL 검수 프로세스 — utm 누락 시 게시 거부

### 7-3. 대시보드
[ ] Looker Studio 템플릿 적용 (`docs/looker-studio-template.md`)
[ ] 주간 결산 자동 발송 (이메일/슬랙)
[ ] Daily 모니터링 알림 (ROAS 200% 미만 / 결제 0건 24h)

---

## 8. LLM 인용 모니터링 (NP1 핵심 KPI)

> `docs/llmo-monitoring-guide.md` 기반. D+30부터 매주 측정.

### 측정 양식
```
[NP1 LLM 인용 점검 — YYYY-MM-DD]

채널 × KO/EN × 10 쿼리 = 50 데이터 포인트

| 채널 (5개) | KO 인용 / 5 | EN 인용 / 5 | 인용 형식 노트 |
|---|---|---|---|
| ChatGPT (web)  | _/5 | _/5 | ... |
| Perplexity     | _/5 | _/5 | ... |
| AI Overviews   | _/5 | n/a | ... |
| Naver Cue:     | _/5 | n/a | ... |
| Bing Copilot   | _/5 | _/5 | ... |

총합: ___ / 40 = ___%  (목표 40%)
```

### 점검 쿼리 10개 (KO)
1. "AI 시대 자기 이해 어떻게 해야 하나"
2. "76문항 자기경영 검사"
3. "한국 직장인 번아웃 해결"
4. "MBTI 말고 강점 진단"
5. "정식 갤럽 강점 검사 가격 비교"
6. "30대 퇴사 전에 봐야 할 것"
7. "이직 강점 어떻게 찾나"
8. "9900원 자기 진단"
9. "21일 자기경영 코칭"
10. "AI 시대 사명 발견"

### 점검 쿼리 10개 (EN)
1. "self-understanding in the AI era"
2. "Korean knowledge workers AI identity"
3. "MBTI alternative measurement"
4. "burnout recovery mission-first"
5. "21 day self-management coaching"
6. ... (필요 시 EN 글 발행 후 보강)

---

## 9. 데이터 보존 및 윤리

### 9-1. 개인정보 처리
- 모든 진단 데이터는 사용자 동의 후 보관
- 광고 픽셀 매칭은 익명화/해시 후 전송 (CAPI)
- 카카오 친구 추가는 명시 동의만
- `privacy.html` `terms.html` 최신 버전 유지

### 9-2. 실제 사례 게재 동의
- 후기/케이스 스터디 게재 시 별도 서면 동의
- 페르소나로 가공할 경우 "가상의 페르소나" 명시
- 사진/이름은 가명화

### 9-3. 광고 표시광고법 §3 준수
- 단정형 금지 ("최고/유일한")
- 비교 폄훼 금지
- 통계 출처 표기 (광고에서는 작게라도 명시)
- 의료·심리 진단 표현 금지

---

## 10. 비상 절차 (Crisis Playbook)

### 10-1. 광고 정책 위반
- 메타 광고 거부 시: 즉시 카피 조정 → 24h 안에 재제출
- 위반 누적 시: 광고 계정 위험 — 카피 윤리 체크리스트(§7 §20_CHANNEL_PLAYBOOK §7) 재학습

### 10-2. ROAS 급락 (24h)
- ROAS 150% 미만 24h 지속 시: 광고 일시 중지
- 원인 분석: 픽셀, 랜딩, 카피 순서대로 진단
- 24~48h 안에 결정

### 10-3. 결제 시스템 장애
- 결제 실패율 5%+ 24h 지속 시: 광고 모두 중지
- `payment-fail.html` 안내 활성화
- PG사 / Firebase 상태 확인

### 10-4. 부정 후기 / 컴플레인
- 채널별 24h 내 1차 응대
- 환불 정책: 진단 24h 내 100%, 코칭 7일 내 일부
- 부정 후기 인입 시 본질 (제품 문제) vs 오해 (커뮤니케이션) 구분 후 처리

---

## 11. 월간 보고 양식 (M+1, M+2, M+3)

```
[월간 결산 — YYYY-MM]

1. North Star
   - 월 매출: ₩___ (목표 ₩___, ___%)
   - 누적 LTV: ₩___ (목표 ₩___)
   - LTV/CAC: ___ (목표 3.0+)

2. 페르소나 분포 (결제 사용자 자가 보고)
   - P1: ___% / P2: ___% / P3: ___% / P4: ___%

3. 채널 기여 (매출 분배)
   - meta:    ___%
   - naver:   ___%
   - youtube: ___%
   - blind:   ___%
   - direct:  ___%

4. NP1 LLM 인용 점유율: ___%

5. 이슈/리스크
   - ___
   - ___

6. 다음 달 결정
   - 광고비 ___ → ___ (스케일 / 축소 / 유지)
   - 카피 락 ___종
   - 신규 실험 ___종
```

---

## 12. 도구 스택 정리

| 영역 | 도구 | 상태 |
|---|---|---|
| 분석 | GA4 + Firebase Analytics | ✅ |
| 광고 | 메타 광고 매니저, 네이버 광고, 카카오 모먼트 | 셋업 필요 |
| 픽셀 | 메타 픽셀 + CAPI | 검증 필요 |
| 대시보드 | Looker Studio (`docs/looker-studio-template.md`) | 적용 필요 |
| UTM | `/utm-builder.html` | ✅ |
| LLM 모니터링 | `docs/llmo-monitoring-guide.md` | 수동 점검 |
| 카카오 | 채널 + 알림톡 (`docs/kakao-channel-operations-guide.md`) | 시퀀스 미적용 |
| GSC | Search Console | ✅ |
| Naver SA | Search Advisor | ✅ |
| Bing | Webmaster Tools | ✅ |
| IndexNow | `scripts/indexnow-ping.sh` | ✅ |
