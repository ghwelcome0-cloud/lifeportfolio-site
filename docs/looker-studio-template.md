# Looker Studio Dashboard Template — 인생포트폴리오

> PR #77 측정 인프라 도입 후, GA4 데이터를 기반으로 KGI(₩9,900/$8.99 전환 + 양식이 되는 자산) 추적용 대시보드 구성안.

---

## 📊 데이터 소스

- **GA4 Property**: `G-C8XKL4L9MZ`
- **GTM Container**: `GTM-WWNXZLZX`
- **수집 시작일**: GA4 측정 ID 도입일 (PR #18 이전부터)
- **PR #77 신설 차원**: `traffic_source / traffic_medium / traffic_campaign / traffic_term / traffic_content` (이벤트 레벨 sticky)

---

## 🎯 KGI 정의

| 지표 | 정의 | 임계값 |
|---|---|---|
| **1차 KGI** | `purchase` 이벤트 수 (KRW 9,900 · USD 8.99) | 측정 시작 |
| **2차 KGI** | `report_view` 이벤트 수 (구매 후 실제 열람) | 구매자의 ≥80% |
| **3차 KGI** | "리포트대로 살아냄" 정성 인터뷰 결과 (수동 수집) | 분기별 ≥3건 |

---

## 📈 페이지 / 위젯 구성

### Page 1 — KGI Overview

| 위젯 | 차트 유형 | 차원 | 측정항목 | 비고 |
|---|---|---|---|---|
| 1. 오늘 결제 수 | Scorecard | - | `purchase` count | 일 단위 |
| 2. 주간 결제 수 | Scorecard | - | `purchase` count (7일) | 전주 대비 % |
| 3. 월간 매출 (KRW) | Scorecard | filter: `currency=KRW` | sum(`value`) | |
| 4. 월간 매출 (USD) | Scorecard | filter: `currency=USD` | sum(`value`) | |
| 5. 결제 트렌드 | Time series | date | `purchase` count | 30일 |
| 6. 언어별 분리 | Pie chart | `language` (또는 `?lang=en`) | `purchase` count | KO/EN 비율 |

### Page 2 — Attribution (PR #77 핵심)

| 위젯 | 차트 유형 | 차원 | 측정항목 | 비고 |
|---|---|---|---|---|
| 7. Source별 결제 | Table | `traffic_source` | `purchase` count, conversion rate | `(direct)` 제외 옵션 |
| 8. Source × Medium | Table | `traffic_source` × `traffic_medium` | `purchase`, value | |
| 9. Campaign별 ROAS | Table | `traffic_campaign` | `purchase` count, value | 광고비 수동 입력 필요 |
| 10. Instagram 어트리뷰션 | Filtered table | filter: `traffic_source=instagram` | `purchase` by campaign | |
| 11. Blog → 결제 경로 | Table | `traffic_source=blog`, `page_path` (블로그) | `purchase` count | 어떤 글이 가장 잘 전환되는가 |

### Page 3 — Funnel (전환 깔때기)

| 단계 | 이벤트 | 측정 |
|---|---|---|
| 1. 사이트 진입 | `page_view` (home or product) | unique users |
| 2. 상품 페이지 도달 | `view_item` | unique users |
| 3. 진단 시작 | `assessment_start` | unique users |
| 4. 진단 완료 | `assessment_complete` | unique users |
| 5. 결제 시작 | `begin_checkout` | unique users |
| 6. **결제 완료 (KGI)** | `purchase` | unique users |
| 7. 리포트 열람 | `report_view` | unique users |

각 단계 drop-off % 표시. 위젯 유형: **Funnel chart** (탐색 보고서 기반).

### Page 4 — Content Performance (블로그)

| 위젯 | 차원 | 측정항목 |
|---|---|---|
| 12. 블로그 글별 진입 | `page_path` (filter: `/blog/`) | sessions, avg session duration |
| 13. 블로그 글별 결제 기여 | `page_path` × `purchase` (assist) | conversion assist count |
| 14. 블로그 CTA 클릭 | `page_path` × outbound to `/product.html` | click count (custom event 필요 시) |

---

## 🔧 셋업 절차 (운영 도입 시)

1. **Looker Studio 새 보고서** 생성 → GA4 데이터 소스 연결 (`G-C8XKL4L9MZ`).
2. **커스텀 차원 매핑**:
   - `traffic_source` (이벤트 매개변수)
   - `traffic_medium` (이벤트 매개변수)
   - `traffic_campaign` (이벤트 매개변수)
   - GA4 Admin → Custom definitions → Create custom dimensions (Event-scoped).
3. **위 위젯 구성** (Page 1~4).
4. **공유**: 운영진/투자자/회계 담당에게 view-only 권한.
5. **템플릿 URL 등재**: 셋업 완료 후 `README.md` 측정 인프라 섹션에 공개 URL 추가.

---

## ⚠️ 주의 사항

- **데이터 지연**: GA4는 24~48시간 지연 가능 → 실시간 검증은 GA4 → 실시간 보고서에서.
- **샘플링**: 일 5만 이벤트 미만이면 샘플링 없음 (현 트래픽 규모 안전).
- **신설 차원 수집 시작**: PR #77 배포 후부터 → 그 이전 데이터는 `(not set)`으로 표시됨.
- **프라이버시**: `transaction_id`는 PII가 아니지만, 광고 매체로 export 시 마스킹 권장.

---

## 🔗 관련 문서

- `docs/copy-mapping-pr78.md` — 카피 매핑 (어떤 카피가 어떤 페이지에)
- `docs/README-pr77-prep.md` — PR #77 통합 인덱스
- `assets/js/analytics.js` — LP.* 트래커 (`getUtm()` UTM 캡처)
- `utm-builder.html` — 캠페인 URL 빌더

---

**Version**: 1.0 · PR #77 prep · 2026-05-14
