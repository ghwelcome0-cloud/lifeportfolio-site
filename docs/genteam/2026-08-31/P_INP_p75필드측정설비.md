# 발주 P — INP·Core Web Vitals p75 필드 측정 설비 설계

작성일: 2026-08-31  
범위: 설계·판정만 수행. 저장소 코드와 성역 파일은 변경하지 않았다.

## 0. 결론

**채택 권고: 기존 `assets/js/web-vitals.js → dataLayer → GA4` 경로를 먼저 검증·완성한 뒤, 28일 단위의 실사용자 RUM p75를 산출하고 CrUX의 origin/device p75와 나란히 운영한다. 트래픽이 적으므로 초기 샘플링은 100%가 원칙이다.**

이 권고는 새 수집기를 처음부터 만드는 안이 아니다. 저장소 실사에서 이미 다음이 확인됐다.

- `assets/js/web-vitals.js`는 `web-vitals@4` attribution build를 지연 로드하고 `onLCP`, `onINP`, `onCLS`, `onFCP`, `onTTFB`를 `dataLayer`의 `web_vitals` 이벤트로 보낸다.
- 다수 지면이 이 파일을 `defer`로 불러온다.
- 페이지의 CSP에는 unpkg/jsDelivr와 Google Analytics/GTM 연결 대상이 포함되어 있다.
- 그러나 **GTM에서 `web_vitals` 이벤트가 실제 GA4로 전달되는지, 맞춤 매개변수가 등록됐는지, 원시 이벤트를 p75로 계산할 수 있게 보존하는지, 동의 상태별 누락률이 얼마인지는 이번 설계에서 확인하지 못했다. 현재 RUM 파이프라인의 작동 상태는 미확인이다.**

따라서 “RUM 코드가 존재한다”와 “INP·p75 필드값을 확보했다”를 구분해야 한다. 실제 이벤트 수신, 중복 제거, 28일 집계, 기기별 표본수와 결측률까지 검증되기 전에는 INP와 p75 필드값은 계속 **미측정**이다.

## 1. 공식 측정 기준

Google은 INP를 페이지 생애 동안 발생한 클릭·탭·키보드 상호작용의 지연으로 정의한다. 대부분의 페이지에서는 가장 느린 상호작용이 페이지 INP가 되며, 상호작용이 매우 많을 때는 50회당 최악값 하나를 제외한다. 페이지 방문들의 분포에서는 모바일과 데스크톱을 나누어 p75를 평가하며, INP 200ms 이하는 “good” 범위다.

INP는 상호작용이 전혀 없으면 보고되지 않는다. 스크롤과 hover만 한 방문도 INP가 없다. 그러므로 전체 페이지뷰를 INP 분모로 삼아 0ms로 채우면 안 된다. **INP가 관측된 적격 페이지뷰만의 분포**와 함께 `전체 페이지뷰`, `상호작용 페이지뷰`, `INP 관측률`을 별도로 보고해야 한다.

Google의 Core Web Vitals 판정은 실제 방문의 75%가 각 지표의 good 임계값을 만족하는지를 본다. CrUX는 최근 28일의 적격 Chrome 사용자 경험을 집계한다. URL과 origin은 공개 발견 가능성과 Google이 공개하지 않는 최소 인기 기준을 모두 충족해야 한다. 따라서 데이터가 없다는 것은 실패가 아니라 **CrUX 적격 표본 미확보 또는 미확인**일 수 있다.

출처:

- Google web.dev, INP: https://web.dev/articles/inp
- Google web.dev, Web Vitals 측정 시작: https://web.dev/articles/vitals-measurement-getting-started
- Google web.dev, 필드 측정 모범사례: https://web.dev/articles/vitals-field-measurement-best-practices
- Chrome UX Report 방법론: https://developer.chrome.com/docs/crux/methodology
- CrUX API: https://developer.chrome.com/docs/crux/api
- `web-vitals` 공식 저장소: https://github.com/GoogleChrome/web-vitals

## 2. INP 측정 3안 비교

| 안 | 무엇을 재는가 | 장점 | 한계·위험 | 현재 판정 |
|---|---|---|---|---|
| A. 실사용자 RUM (`web-vitals`) | 실제 브라우저 방문별 INP; 28일·기기별 p75 가능 | 실제 기기·네트워크·사용 흐름 반영, URL별 진단 가능 | 개인정보/동의 검토, 저트래픽 불확실성, JS API·브라우저 지원 편향, iframe 차이, 수집 코드 자체 영향 | **조건부 가능·주 권고**. 기존 경로의 실제 수신과 법률 검토가 선행조건 |
| B. 합성 입력 자동화 | 고정 기기·네트워크에서 사전 정의한 클릭/탭/키보드 시나리오의 상호작용 지연 | 배포 전 회귀, 원인 재현, 표본을 임의로 반복 가능 | 실제 사용자 분포가 아니며 시나리오 밖 느린 상호작용을 놓침 | **가능·보조 게이트**. 필드 INP 또는 CWV p75로 부르면 안 됨 |
| C. CrUX/PSI/GSC | 적격 Chrome 사용자의 28일 집계 p75 | Google CWV와 같은 공개 필드 기준, 별도 사이트 스니펫 불필요 | 인기 기준 미달 시 없음, 정확한 최소 표본 비공개, URL 단위가 없을 수 있음, 원인 attribution 부족, Chrome 적격 사용자만 포함 | **조건부 가능·외부 기준선**. 현재 lifeportfolio.co.kr 데이터 존재 여부는 미확인 |

### A. RUM의 판정

가장 직접적인 측정이다. `web-vitals` 라이브러리는 페이지가 hidden이 될 때 INP의 현재 최종값을 보고하고 bfcache 복원도 별도 방문으로 처리한다. 현재 코드는 이 기준을 구현한 라이브러리를 이미 호출한다. 다만 `dataLayer.push()`는 전송 완료의 증거가 아니다. 다음 네 단계가 모두 관측돼야 한다.

1. 실제 상호작용 후 페이지를 background로 전환했을 때 `web_vitals/INP`가 발생한다.
2. GTM Preview 또는 GA4 DebugView에서 동일 이벤트를 확인한다.
3. 원시 내보내기에서 `metric_id`별 최종값을 중복 제거할 수 있다.
4. 28일 창에서 `PHONE`/`DESKTOP`, route별 표본수·p75·good 비율을 재계산할 수 있다.

현행 구현에는 추가 확인점이 있다. `web-vitals.js`가 idle 시점(최대 4초 timeout)에 라이브러리를 불러온다. 공식 라이브러리는 buffered entry를 읽지만, 초기화 전에 발생한 Event Timing 항목에는 브라우저 기본 104ms 보고 하한이 적용되고 첫 입력 외 40~104ms 상호작용은 누락될 수 있다. 이것이 p75에 주는 영향은 미측정이다. 배포 설계에서는 자체 호스팅한 고정 버전을 비차단 방식으로 더 일찍 등록하는 canary와 현행 방식을 비교해야 한다.

### B. 합성 입력 자동화의 판정

Playwright/CDP로 운영과 동일한 HTTP(S) 환경을 열고 핵심 흐름마다 클릭·탭·키 입력을 실행한다. 예: 메뉴 열기, 설문 선택·다음, 로그인 전환, 모달 열기/닫기, PDF 버튼, 체크인 입력. 각 시나리오에서 `web-vitals.onINP` 또는 Event Timing attribution을 수집하고 최소 5회 이상 반복하며 기기·CPU·네트워크 조건을 고정한다.

이 결과는 다음 중 하나로만 부른다.

- **합성 상호작용 지연**
- **시나리오 기반 Lab INP**
- **INP 회귀 프록시**

“실사용자 INP”, “필드 INP”, “CWV p75 통과”라고 부르지 않는다. 자동화가 만든 상호작용 종류·순서·체류시간·기기 분포는 실제 사용자 분포가 아니기 때문이다. Lighthouse의 TBT도 부트스트랩 중 메인 스레드 차단의 프록시일 뿐 INP의 대체값이 아니다.

### C. CrUX의 판정

PageSpeed Insights, Search Console, CrUX API/History API에서 먼저 origin 수준 `https://lifeportfolio.co.kr`의 `interaction_to_next_paint`를 PHONE과 DESKTOP으로 질의한다. URL 수준이 없으면 origin 수준만 보고한다. CrUX API는 무료 쿼터 내에서 일일 조회가 가능하고 p75와 3구간 histogram, 28일 수집기간을 반환한다.

CrUX 응답이 없을 때 문구는 “미달”이 아니라 다음과 같아야 한다.

> CrUX에서 공개 가능한 표본을 확보하지 못해 INP p75 필드값은 미측정입니다. Google은 공개에 필요한 최소 방문자 수를 공개하지 않습니다.

## 3. p75 필드값 확보안 비교

| 방법 | p75 산출 | 저트래픽 대응 | 판정 |
|---|---|---|---|
| 자체 RUM 원시 이벤트 | 28일 방문별 최종값을 정렬해 nearest-rank p75; 기기·route별 산출 | 표본수와 불확실성을 직접 공개 가능 | **조건부 가능·주 분석원** |
| CrUX API/PSI/GSC | Google이 적격 Chrome 방문으로 계산한 p75 | 기준 미달이면 데이터 자체가 나오지 않음 | **조건부 가능·외부 비교원** |
| 합성 120회 또는 자동화 시나리오 | 실험 반복분포의 p75 계산은 가능 | 표본을 늘릴 수 있으나 사용자 분포가 아님 | **필드 p75로는 불가** |

### 저트래픽에서 p75가 의미 있는가

p75는 표본이 하나라도 있으면 계산할 수 있지만, 작은 표본의 p75는 날짜·유입 캠페인·기기 몇 대에 크게 흔들릴 수 있다. Google은 CrUX 공개 최소 방문자 수를 공개하지 않는다. 자체 RUM에도 보편적인 공식 최소 N은 없다. 그러므로 임의의 N만 넘었다고 안정성을 확정하면 안 된다.

운영 규칙은 다음처럼 사전등록한다.

1. 기본 창: 최근 28일. PHONE/DESKTOP 분리. route별 값과 origin 유사 집계를 분리.
2. 모든 표에 `전체 페이지뷰 N`, `INP 관측 페이지뷰 n`, `관측률 n/N`, `p75`, `good 비율`, `95% Wilson 구간`을 함께 표시한다.
3. **권고 최소 분석량: INP 관측 n≥400/기기 구간/28일.** 이는 Google의 규정이 아니라 p=.75인 비율의 단순표준오차가 약 2.17%p, 정규근사 95% 폭이 약 ±4.25%p가 되는 내부 분석 기준이다. 값 자체의 p75 불확실성은 분포 밀도에 따라 다르므로 bootstrap CI도 같이 낸다.
4. n<400이면 p75 숫자는 탐색값으로만 표시한다. n<100이면 route별 p75를 외부 결론에 쓰지 않고 28일을 늘리거나 origin/기기 수준으로만 묶는다. 이 N 경계도 Google 판정기준이 아니라 내부 불확실성 관리 규칙이라고 명시한다.
5. “통과” 판정은 p75 점추정만 보지 말고 good 비율의 Wilson 95% 하한이 75% 이상인지 병기한다. 하한이 75% 미만이면 **점추정은 임계값 이내이나 표본 불확실성으로 통과 판정 보류**라고 쓴다.
6. 샘플링을 했다면 표본이 무작위·안정적으로 적용됐는지 확인한다. 동의자만 수집한 RUM은 전체 방문자를 대표하지 않을 수 있으므로 “동의한 RUM 표본”이라고 범위를 밝힌다.

p75 계산은 적격 방문별 최종값을 오름차순 정렬한 뒤 nearest-rank `ceil(0.75×n)`번째 값으로 사전 고정한다. 수집률이 기간·구간별로 달라지면 단순 합치지 말고 동일 sampling stratum별로 보고하거나 역확률 가중을 사전 정의한다.

## 4. RUM 최소 설계

### 4.1 수집 단위와 스키마

페이지뷰별 지표 최종값 하나를 원칙으로 하고 동일 `metric_id`의 후속 보고는 최신값으로 대체한다.

수집 허용 최소 필드:

- `metric_name`: INP/LCP/CLS
- `metric_value`: 원 단위(INP·LCP ms, CLS 실수). 현재 코드의 CLS×1000 변환은 저장 스키마에 명시해야 한다.
- `metric_rating`
- `metric_id`: 같은 페이지뷰 내 갱신 중복 제거용. 분석 후 장기 사용자키로 사용하지 않는다.
- `page_route`: query string·fragment를 제거한 allowlist route 또는 route family
- `form_factor`: PHONE/DESKTOP/TABLET의 거친 구분
- `navigation_type`
- `release_version`
- `observed_at`: 서버 시각을 일/시간 단위로 버킷화
- `sample_rate`, `collector_version`, `consent_state`

INP 진단이 꼭 필요할 때만 제한적으로 추가:

- `interaction_type`(click/tap/key의 범주)
- `interaction_target_code`: DOM selector나 텍스트가 아니라 개발자가 미리 부여한 저카디널리티 코드(예: `survey-next`, `menu-open`)
- input delay / processing duration / presentation delay의 숫자

수집 금지:

- 이름, 이메일, UID, 주문·결제·설문·체크인 식별자
- 원문 URL의 query/fragment, referrer 전문
- 입력값, 클릭한 텍스트, DOM 전체 selector/XPath, 오류 메시지 전문
- 원시 IP의 애플리케이션 저장, 전체 User-Agent, 광고 식별자, 영속 client/session ID
- 지리 좌표 또는 세밀한 지역, 답변 내용과 성능 이벤트의 결합

전송 과정에서 서버·GA가 IP/브라우저 정보를 처리할 수 있으므로 “우리가 필드로 저장하지 않는다”와 “처리가 전혀 없다”를 혼동하지 않는다. 개인정보 처리방침, 동의·거부 동작, 보존기간, 처리위탁/국외이전 여부는 법률 검토 후 확정한다.

### 4.2 저장소 선택

| 저장안 | 장점 | 위험/비용 | 판정 |
|---|---|---|---|
| 기존 GA4/GTM | 새 공개 수집 endpoint 불필요, 현재 `dataLayer`·도메인 허용목록 재사용 | 실제 GTM 전달 미확인, GA client ID·동의·국외처리 검토, 기본 보고서가 원시 p75를 바로 주지 않을 수 있어 Data API/BigQuery export 필요 | **1순위 조건부** |
| Cloud Function → Firestore | 필드·보존·집계를 직접 통제, 일별 집계 가능 | 새 공개 endpoint와 남용·비용·rate limit·App Check/CORS 설계 필요; Functions 변경은 별도 승인. Firestore는 쓰기당 과금 | **2순위 조건부** |
| 브라우저 → RTDB 직접 쓰기 | 구현 단순 | 익명 쓰기 규칙이 공개 공격면이 되고 보안 규칙 변경이 필요할 수 있음; 원시 이벤트 트리 팽창 | **비권고** |
| 새 외부 RUM SaaS | 대시보드·attribution 빠름 | 새 외부 스크립트/processor/CSP allowlist/계약/비용/국외처리 증가 | **현재 비권고** |

**권고 저장 형태:** 먼저 기존 GA4의 실제 수신을 검증하고 원시 export 또는 Data API로 분포를 산출한다. 새 공개 표면을 허용하는 별도 승인이 있을 때만 Cloud Function 수집기로 전환한다. Firestore를 쓴다면 원시 이벤트를 짧게 보존하고 일별 `route×device×metric×release` histogram으로 집계한 뒤 원시 데이터를 삭제한다. RTDB 직접 공개 쓰기는 채택하지 않는다.

### 4.3 비용 산식

정확한 월비용은 월 페이지뷰, 상호작용률, 샘플링률, 기존 요금제·무료쿼터 사용량이 제공되지 않아 **미확인**이다. 설계 단계에서는 다음 산식만 확정한다.

- GA4 경로: `월 수집 이벤트 ≈ 페이지뷰 × 샘플링률 × 페이지뷰당 보고 지표 수`. GA4 수집 자체의 추가비용은 현재 계약/속성 기준 확인 필요. BigQuery export를 쓰면 저장·쿼리 비용이 별도다.
- 자체 endpoint: `월 호출 ≈ 페이지뷰 × 샘플링률`(세 지표를 한 beacon으로 batch). `월 Firestore write ≈ 월 호출` 또는 서버에서 일별 집계하면 그보다 작게 설계 가능.
- 공식 Firestore 무료쿼터에는 일 20,000 writes가 있으나 프로젝트의 다른 사용량과 합산된다. Cloud Functions/Cloud Run functions는 호출·컴퓨팅·네트워크 및 리전에 따라 과금되므로 배포 전 가격계산기로 상한을 산정한다.

예시(다른 사용량이 없고 페이지뷰당 batch 1회라는 가정): 월 10,000 PV이면 약 10,000 호출·쓰기, 월 100,000 PV이면 약 100,000 호출·쓰기(평균 약 3,333/일)다. 둘 다 명목상 Firestore 20,000 writes/일과 1세대 Functions 월 200만 무료 호출 이내지만, 기존 프로젝트 사용량·2세대 컴퓨팅·네트워크·리전 가격이 합산되므로 **비용 0원으로 확정할 수 없다**. 트래픽 burst도 일별 quota를 넘길 수 있다.

비용 가드: 요청 본문 크기 제한, 허용 필드·값 범위 검증, route allowlist, 일/IP 단위 rate limit(원시 IP 저장 없이 edge/server에서 폐기), 예산 알림, 수집 kill switch를 둔다.

### 4.4 CSP 영향

- 현재 `web-vitals.js`는 unpkg 우선, jsDelivr fallback을 사용한다. 저장소에서 본 다수 지면의 meta CSP와 Hosting Report-Only 정책은 두 CDN 및 GA/GTM 연결을 허용한다. 따라서 현재 구성과 동일한 경로라면 새 allowlist가 반드시 필요한 것은 아니다.
- 그러나 Report-Only는 차단하지 않고 위반을 보고할 뿐이다. “관측 가능”과 “향후 enforcing에서도 허용됨”은 다르다.
- 장기 권고는 `web-vitals` 특정 버전 파일을 same-origin으로 자체 호스팅하고 해시/버전을 고정하는 것이다. 그러면 새 외부 script origin과 CDN 공급망 의존을 줄인다. 이는 구현 승인 후 별도 작업이다.
- GA4를 계속 쓰면 기존 `googletagmanager.com`, `google-analytics.com` 연결을 이용한다. 자체 Cloud Function을 쓰면 현재 CSP에 `asia-northeast3-lifeporfolio.cloudfunctions.net`가 보이는 지면이 있으나, 모든 대상 지면에서 허용되는지는 배포 전 전수 확인해야 한다.
- 새 외부 RUM SaaS는 `script-src`와 `connect-src` 추가가 필요할 가능성이 높아 현재 제약 아래 비권고다.

### 4.5 샘플링

- 저트래픽 초기 단계: **100% 수집**. 이미 동의한 적격 방문에서만 적용하며, 무상호작용 방문에는 INP가 없다는 사실을 별도 카운트한다.
- 월 호출량이 비용·성능 한계를 넘을 때만 방문 시작 시 결정론적 무작위 표본을 고정한다. 페이지마다 다시 추첨하면 긴 여정 사용자가 과대표집될 수 있다.
- 50% 샘플은 같은 표본오차를 얻는 데 대략 두 배의 원래 트래픽이 필요하고, 10% 샘플은 대략 열 배가 필요하다. 이는 정보량 감소에 대한 근사이며 편향이 없다는 전제다.
- 샘플링률은 이벤트에 기록하고 기간 중 조용히 변경하지 않는다. 변경 시 release/collector 버전으로 구간을 분리한다.

## 5. 집계·품질 검증 절차

1. **수집 canary:** 내부 테스트 트래픽을 별도 `debug` 속성으로 보내 운영 집계에서 제외한다. 클릭·키보드 상호작용 후 hidden 전환까지 검증한다.
2. **중복 제거:** `(metric_name, metric_id)`별 최종 `metric_value`만 남긴다. bfcache 복원은 새 metric ID이므로 별도 방문으로 유지한다.
3. **적격성:** foreground 로드만, 유효 숫자·범위만, 봇/합성 테스트 제외. INP 미지원 브라우저와 무상호작용 페이지뷰를 0으로 대체하지 않는다.
4. **분리 집계:** PHONE/DESKTOP을 합치지 않는다. 공개 지면과 인증 뒤 지면을 한 route로 합치지 않는다. CrUX 비교 시 Chrome 적격군과 28일 창을 최대한 맞춘다.
5. **산출:** N/n/관측률, p50/p75/p90, good/needs-improvement/poor 비율, Wilson CI, bootstrap p75 CI, 수집기간, 버전을 함께 낸다.
6. **비교:** RUM과 CrUX는 모집단·브라우저·iframe·동의 표본 차이로 값이 달라질 수 있다. 하나를 다른 하나의 복제검증으로 표현하지 않는다.
7. **음성 통제:** 수집 canary에서 의도적으로 250ms 이상 main-thread blocking을 클릭 handler에 넣은 격리 fixture가 `needs-improvement`로 잡히는지 확인한다. 운영 페이지에 결함을 심지 않는다.

## 6. 지금 문서에 넣을 정직한 문장

### 권고 본문

> **Core Web Vitals 상태 — Lab만 측정, 필드 판정 보류.** 로컬 HTTP·고정 실브라우저 환경에서 12지면×2뷰포트×5회(총 120회)를 측정했으며, 관측된 24개 지면·뷰포트 조합의 LCP와 CLS는 설정 임계값 이내였습니다(최악 LCP 1,112ms, 최악 CLS 0.0501). 이 값은 실제 사용자 분포의 p75가 아닌 Lab 결과입니다. 실제 클릭·탭·키 입력이 없는 방문에서는 INP가 생성되지 않으므로, 현재 INP와 모바일·데스크톱별 p75 필드값은 미측정입니다. 따라서 현재 결과를 ‘Core Web Vitals 필드 통과’로 인용하지 않습니다.

### RUM을 가동했으나 표본이 부족할 때

> 최근 28일 RUM에서 INP 관측 표본은 모바일 n=[값], 데스크톱 n=[값]입니다. p75 탐색값은 산출했으나 사전등록한 표본·불확실성 기준을 충족하지 않아 통과/실패 판정을 보류합니다. 이 값은 동의한 RUM 표본에 한정되며 CrUX 전체와 동일한 모집단이 아닙니다.

### CrUX 데이터가 없을 때

> CrUX에서 공개 가능한 표본이 확인되지 않아 Google 기준의 p75 필드값은 미측정입니다. 이는 성능 통과 또는 실패를 뜻하지 않습니다.

현재 문장 “INP는 이 문서 어디에서도 통과로 적히지 않았다”는 거짓 초록불을 막지만, **왜 미측정인지와 p75 필드값까지 미측정이라는 사실**이 드러나지 않는다. 위 권고 본문으로 교체하는 편이 더 명확하다.

## 7. 단계별 채택안

### 단계 0 — 무변경 확인

- PSI/CrUX API에서 origin과 공개 핵심 URL의 PHONE/DESKTOP 데이터 존재 여부를 확인한다.
- GA4/GTM에서 기존 `web_vitals` 이벤트의 실제 수신, 매개변수, 보존·export 가능 여부를 확인한다.
- 둘 다 없으면 “미측정”을 유지한다.

### 단계 1 — 기존 RUM 검증·최소화

- 개인정보·동의 법률 검토를 통과한 범위에서 기존 pipeline을 100% 표본으로 검증한다.
- CDN 라이브러리는 승인 후 same-origin 고정 버전으로 교체하는 방향을 권고한다.
- 28일간 수집하되 주간에는 탐색 대시보드만 보고, 공식 상태는 28일 창과 표본수를 함께 쓴다.

### 단계 2 — 자동화 보조 게이트

- 핵심 상호작용 시나리오를 Lab 회귀로 고정한다.
- 결과명은 “시나리오 기반 Lab INP” 또는 “합성 상호작용 지연”으로 제한한다.
- 운영 RUM에서 느린 interaction code가 발견되면 같은 흐름을 Lab에서 재현한다.

### 단계 3 — 외부 비교

- CrUX 적격 데이터가 생기면 origin/device p75를 외부 기준선으로 병기한다.
- RUM과 CrUX의 28일 창·Chrome·기기 조건을 맞춰 차이를 분석한다.

## 8. 채택하지 말아야 할 조건

다음 중 하나라도 해당하면 RUM 배포를 보류한다.

1. 개인정보 처리방침·동의·거부 시 동작·보존기간·위탁/국외처리 검토가 끝나지 않았다.
2. 원문 URL/query, 설문 답변, UID, 이메일, 주문번호, raw selector/text를 수집해야만 한다.
3. 새 공개 endpoint에 schema validation, rate limit, 예산 알림, kill switch가 없다.
4. 측정 스크립트가 LCP/INP를 유의하게 악화시키는지 canary에서 확인하지 않았다.
5. GTM/GA4가 실제 이벤트를 전송·보존한다는 검증 없이 코드 존재만으로 완료 처리한다.
6. n이 작은데 표본수·관측률·불확실성을 숨기고 p75 단일값만 공개하려 한다.
7. 합성 시나리오 값을 실사용자 INP 또는 CWV p75로 표기하려 한다.
8. 외부 RUM 도입을 위해 CSP allowlist를 넓히면서 공급망·파손 검토를 하지 않는다.

## 9. 자기 반박

1. **기존 GA4 우선 권고의 약점:** 새 공개 endpoint를 피하지만 GA4는 자체 수집보다 데이터 처리 범위와 동의·국외처리 검토가 넓어질 수 있다. 현재 GTM 설정과 실제 데이터 보존 상태도 미확인이다. 법률 검토에서 부적합하면 이 권고는 철회하고, 승인된 최소 필드의 same-origin 수집기로 재설계해야 한다.
2. **n≥400 기준의 약점:** 이는 Google 기준이 아니며 good 비율의 허용 오차에 근거한 내부 분석 기준이다. p75 값의 안정성은 임계점 주변 분포 밀도와 유입 구성에 달려 있어 400건이어도 편향된 표본이면 의미가 약하다. 그래서 bootstrap CI, 관측률, 모집단 고지를 함께 요구했다.
3. **RUM 자체의 관측 편향:** 동의자, 지원 브라우저, 실제 상호작용이 있는 방문만 들어온다. 가장 느린 사용자나 빠르게 이탈한 사용자가 빠질 수 있다. CrUX도 Chrome 적격 사용자에 한정된다. 둘을 함께 보더라도 모든 방문자를 대표한다고 단정할 수 없다.
4. **측정기가 성능을 바꾸는 문제:** 현재 attribution build는 표준 build보다 크고 외부 CDN을 지연 로드한다. 크기는 작아도 영향이 0이라고 측정하지 않았다. RUM on/off canary에서 LCP·INP 분포 차이를 먼저 확인해야 한다.
5. **현재 수치의 범위:** 제공된 120회 Lab 결과는 발주 배경값을 인용했을 뿐 이 작업에서 재실행하지 않았다. 따라서 본 문서는 그 수치를 재검증했다고 주장하지 않는다.

## 10. 최종 판정표

| 대상 | 현재 상태 | 완료 조건 |
|---|---|---|
| Lab LCP·CLS | 제공된 실측에서 임계값 이내 | 기존 증빙·조건 유지 |
| 실사용자 INP | **미측정** | RUM 또는 CrUX에서 상호작용 적격 표본과 p75 확보 |
| CWV p75 필드값 | **미측정** | 모바일/데스크톱별 28일 필드 분포, N·관측률·불확실성 공개 |
| 합성 INP 회귀 | **미구현** | 핵심 흐름·환경·반복·음성 통제 고정 |
| 기존 GA4 RUM 전송 | **미확인** | DebugView/원시 export에서 INP 이벤트와 중복 제거 검증 |
