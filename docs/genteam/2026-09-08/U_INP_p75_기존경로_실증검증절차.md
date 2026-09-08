# U — INP / p75 기존 GA4 경로 실증 검증 절차

- 작성·저장소 확인일: 2026-09-08
- 확인 기준 커밋: `b03e21901e0c1449a14ce092d0c4676d7ccf5401` (`main`, 당시 `origin/main`과 일치)
- 범위: 코드 변경이 아니라 기존 `web-vitals.js → dataLayer → GTM/GA4` 경로의 검증 절차
- 현재 판정: **INP와 p75 필드값은 미측정**이다. 아래에서 “확인”은 배선 또는 수집 단계의 확인이지 INP/p75 측정 완료를 뜻하지 않는다.

## 1. 개인정보 경계 점검 — 최우선

### 1.1 확정 경계

| 금지 | 허용 |
|---|---|
| UID, 이메일, 응답 내용, 입력값, URL 쿼리, 원시 DOM 선택자·XPath·요소 텍스트, 영구 식별자 | 사전 정의한 route family, 지표 값, 거친 기기 구분, 릴리스, 저카디널리티 상호작용 코드 |

GA4·브라우저가 자동 생성하거나 처리할 수 있는 온라인 식별자/IP 등은 “애플리케이션이 명시 필드로 보내지 않는다”와 별개다. Google 측 처리 범위·보존·국외이전·동의 적법성은 별도 개인정보 검토 대상이다.

### 1.2 현재 `web_vitals` payload 감사

`assets/js/web-vitals.js:76-86`이 명시적으로 push하는 값은 다음 9개다.

| 필드 | 실제 값 | 경계 판정 | 조치/근거 |
|---|---|---|---|
| `event` | 고정값 `web_vitals` | 허용 | 저카디널리티 이벤트명 |
| `metric_name` | LCP/INP/CLS/FCP/TTFB | 허용 | 고정 열거형 |
| `metric_value` | ms 정수, CLS만 ×1000 정수 | 허용 | 지표 값. CLS 단위 변환을 분석 SQL에 명시해야 함 |
| `metric_rating` | good/needs-improvement/poor | 허용 | 고정 열거형 |
| `metric_id` | 라이브러리가 페이지뷰·지표에 부여한 ID | **조건부** | 코드상 UID·이메일·영구 사용자키는 아니고 중복 판별 후보이나, 외부 전송 식별자다. 원시 보존기간을 최소화하고 사용자 결합 금지. 가능하면 BigQuery 집계 후 폐기. 현재는 “영구 식별자 아님”을 GA4 설정에서 검증하지 못함 |
| `metric_delta` | 이전 보고 대비 변화량 | 허용 | 수치. 현재 콜백은 기본적으로 최종 보고 1회를 의도하지만 중복/갱신 여부는 실증 필요 |
| `metric_navigation_type` | navigation 유형 | 허용 | 제한된 열거형 |
| `page_path` | `location.pathname` | **현재 경계 불충족** | 쿼리·fragment는 제외되지만 “route family”가 아니라 원시 경로다. 동적 slug/token/ID가 경로에 들어오면 금지정보·고카디널리티 유출 가능. GA4 전달 전에 GTM Lookup/Regex Table로 허용된 route family로 치환하고 원문 `page_path`는 이벤트 파라미터로 전달하지 않아야 함 |
| `page_lang` | `<html lang>` | 허용 | 저카디널리티 값으로 제한 필요 |

추가 확인:

- `assets/js/web-vitals.js`는 attribution build를 로드하지만 callback에서 `metric.attribution`·target·selector·interaction text를 읽거나 push하지 않는다. **현재 소스 기준 원시 선택자·입력값·응답 내용 전송은 발견되지 않았다.**
- `assets/js/web-vitals.js`에서 UID·이메일·설문 답변·입력값·쿼리·referrer 전송은 발견되지 않았다. `location.pathname`만 사용한다(`:84`).
- 그러나 공용 분석 래퍼 `assets/js/analytics.js:33-47,57-63`은 URL의 `utm_*` 쿼리를 읽고 `traffic_source/medium/campaign/term/content`로 이벤트에 붙이며, `document.referrer`도 sessionStorage에 저장한다. `web_vitals` payload에는 이 래퍼 값이 합쳐지지 않지만, 같은 GA4 데이터 흐름 전체로 보면 **“쿼리·referrer 누출 위험 없음”이라고 할 수 없다.** 특히 자유 입력 UTM 값은 현재 요구의 저카디널리티 경계를 보장하지 않는다.
- `internal/evidence/ropa/registry.v0.1.json:340-365`도 URL/referrer 민감 맥락 누출, 온라인 식별자, Consent Mode 미입증, GTM과 direct gtag 공존, export/retention 미확인을 열린 위험으로 기록한다.
- `index.html:138-158`의 `lp_consent_analytics` gate는 **Clarity 전용**이다. 저장소 전수 검색에서 GA/GTM보다 앞선 `gtag('consent','default', {analytics_storage:'denied'})`와 동의 후 `update`를 찾지 못했다. 반면 GA config는 `index.html:97-101` 등에서 즉시 queue된다. 따라서 “동의를 거부한 방문자의 GA 데이터는 오지 않는다”는 기대 동작은 **현재 코드로 입증되지 않았고, 오히려 기본 거부 구현 부재 위험이 있다.** 먼저 Tag Assistant에서 확인해야 한다.

**개인정보 게이트 판정: FAIL/보류.** `page_path`를 route family로 축약하고, GTM에서 원문 경로·URL·referrer·UTM·자동 수집 필드가 `web_vitals` 이벤트에 붙지 않는지 확인하며, Consent Mode 기본 거부와 동의 갱신을 증명하기 전에는 필드 수집을 완료 처리하지 않는다.

## 2. 저장소 전수 검색 결과와 현재 배선

### 2.1 검색 범위와 요약

추적 중인 HTML 170개와 JS/Python/JSON/Markdown 설정·문서를 대소문자 무시 검색했다. 생성물·문서 표기는 별도 구분했다.

- `web-vitals.js` loader: HTML 118개(루트 제품 지면 16개 + 블로그 102개).
- GA4/GTM ID 또는 loader: HTML 18개. 그중 제품 지면 16개에는 Web Vitals도 있고, `lead.html`, `b2b.html`에는 GA4/GTM만 있다.
- **블로그 102개에는 Web Vitals loader가 있으나 GTM/GA4 loader가 없다.** 따라서 `dataLayer`에는 쌓일 수 있어도 이 저장소 코드만으로 GA4 전송 경로가 성립하지 않는다.
- 공개 allowlist에는 `b2b.html`과 블로그 트리가 포함된다(`scripts/hosting-allowlist.mjs:15,20,25-31`). 즉 누락을 비공개 파일 문제로 치부할 수 없다.
- 운영의 `/assets/js/web-vitals.js`와 저장소 파일 SHA-256은 동일했다: `a0bfe77c8ae7115893457382fabc495f5ac5faeed86089be7ecdb7c9f16fa627`.
- `python3 scripts/validate_analytics.py`: 16페이지, 오류 0. 단 이 검증기는 정적 문자열·hook 존재만 보며 Web Vitals 전송, 동의, 중복, GA4 수신은 검증하지 않는다.

### 2.2 파일:행별 배선표

| 파일:행 | 무엇을 하는 코드 | 실제 동작 여부 판정 근거 |
|---|---|---|
| `assets/js/web-vitals.js:21-61` | idle 시 `web-vitals@4` attribution IIFE를 unpkg에서 로드, 실패 시 jsDelivr fallback | 소스 존재 및 운영 파일 hash 일치 **확인**. 실제 브라우저에서 CDN 성공률·CSP 차단률은 미확인 |
| `assets/js/web-vitals.js:63-100` | LCP/INP/CLS/FCP/TTFB callback을 연결하고 `dataLayer`에 `web_vitals` push | 로직 **확인**. GA4 도착은 이 코드만으로 확인 불가 |
| `index.html:97-135` | direct `gtag` config를 queue하고 GTM과 gtag.js를 최대 4초 내 또는 첫 상호작용 때 함께 로드 | 운영 HTML에서도 존재 **확인**. GTM+direct gtag 동시 로드의 중복 전송 가능성은 미확인 |
| `login.html:74-87`, `signup.html:74-87`, `mypage.html:74-87`, `privacy.html:73-86`, `terms.html:73-86`, `product.html:105-119`, `report.html:75-89`, `program.html:75-89`, `success.html:73-87`, `suvey.html:74-88`, `payment-success.html:73-87`, `payment-fail.html:73-87`, `auth-fail.html:71-85`, `report-loading.html:74-88`, `program-loading.html:74-88` | GTM + direct gtag + `analytics.js`를 함께 로드 | 정적 배선 **확인**. 실제 `web_vitals` tag/trigger·중복 여부는 Tag Assistant 필요 |
| 위 16개 지면의 Web Vitals loader: `index:1489`, `login:1281`, `signup:1319`, `mypage:327`, `privacy:180`, `terms:181`, `product:1394`, `report:1787`, `program:1444`, `success:819`, `suvey:1126`, `payment-success:718`, `payment-fail:379`, `auth-fail:383`, `report-loading:258`, `program-loading:206` | Web Vitals 수집기 로드 | loader 존재 **확인**. 16/16 정적 배선 |
| `blog/index.html:355`, `blog/en/index.html:273`, `blog/posts/**/*.html`, `blog/posts-en/**/*.html` | Web Vitals 수집기만 로드 | 102/102에서 loader 확인, GA/GTM loader 0/102. **현재 GA4 전달 경로 단절** |
| `scripts/blog_build/render.py:200,455` | 새 KO/EN 블로그 글에도 Web Vitals loader 생성 | 생성 규칙 **확인**. GA/GTM 배선은 생성하지 않음 |
| `b2b.html:174-189`, `lead.html:138-153` | GA4/GTM 로드 | GA 배선 존재. Web Vitals loader 없음 → 이 두 지면의 CWV RUM은 **미배선** |
| `scripts/web_vitals_inject.py:19-39` | 지정 17개 지면에 loader 주입 | 과거 주입 도구. 현재 실제 범위(블로그 글 100개 포함)와 불일치하므로 현행 전수 보증 도구 아님 |
| `scripts/analytics_inject.py:24-57` | 16개 지면에 GTM, direct gtag, analytics wrapper 삽입 | 정적 코드 **확인**. 설명의 “fallback”이 중복 없이 작동하는지는 미확인 |
| `scripts/validate_analytics.py:15-75` | 16개 지면에서 ID·loader·CSP·일부 이벤트 문자열 검사 | 실행 결과 0 error. 네트워크·GA4·privacy 검증은 하지 않음 |
| `assets/js/analytics.js:24-88` | 범용 `dataLayer` push 및 UTM enrichment | 동작 코드 **확인**. Web Vitals는 이 wrapper를 호출하지 않음 |
| `assets/js/analytics.js:110-124`, `payment-success.html:1706-1724` | purchase와 transaction ID, sessionStorage dedup | 구매 이벤트용. Web Vitals 중복 제거의 근거가 아님 |
| `firebase.json:63,108,153` | GA/GTM·CDN을 Report-Only CSP connect/script allowlist에 포함 | 허용 선언 **확인**. enforcing 헤더는 frame/object/base/form만 제한하므로 현재 네트워크 성공 증거는 아님 |
| `internal/evidence/ropa/registry.v0.1.json:330-365` | 분석 처리·동의·export 위험 기록 | Consent Mode, retention/export, query/referrer 모두 미확인으로 기록 |

참고: 공개 GTM 컨테이너 JS를 2026-09-08에 내려받아 문자열을 점검했으나 `web_vitals`, `metric_name`, `metric_value`, `metric_id`가 발견되지 않았다. minification/인코딩 때문에 이것만으로 “태그 없음”을 확정하지는 않지만, **GTM 컨테이너가 `web_vitals`를 GA4로 전달한다는 정적 증거는 확보하지 못했다.** Preview/DebugView 실증이 필수다.

## 3. 미확인 항목별 실행 절차와 숫자 판정선

공통 canary는 운영 집계와 구분되는 내부 브라우저 2종(모바일 에뮬레이션 1, 데스크톱 1), route family 3종(`home`, `product`, `survey`)으로 한다. 각 조합 5페이지뷰, 합계 **30페이지뷰**를 실행한다. 각 페이지뷰에서 클릭 1회와 키 입력 1회를 수행하고, 10초 이상 기다린 뒤 탭을 background로 보내 metric finalization을 유도한다. 테스트 시각·기기·route·예상 metric 수만 별도 기록하고 UID/이메일/입력값은 기록하지 않는다.

### 3.1 브라우저에서 수집기와 `dataLayer` 확인

1. Chrome DevTools → Network에서 `web-vitals.attribution.iife.js` 검색, Console에서 `window.webVitals`, `window.dataLayer.filter(x => x.event === 'web_vitals')` 확인.
2. 클릭·키 입력 후 탭을 숨기고 다시 Console을 확인한다.
3. Network에서 CSP/CDN 오류도 확인한다.

**확인됨:** 30/30 페이지뷰에서 라이브러리 HTTP 200 또는 cache hit, JS 오류 0건. 각 페이지뷰에서 LCP·CLS가 각 1개 이상, 상호작용을 수행한 페이지뷰에서 INP가 각 1개 이상 dataLayer에 나타남. 모든 event는 허용 키 9개 이내이며 금지값 0건. INP 미발생 페이지뷰가 있으면 원인 조사 전 미확인 유지한다.

### 3.2 GTM → GA4 전달 확인

1. GTM Workspace → Preview → 운영 URL 연결.
2. Tag Assistant의 `web_vitals` event에서 firing tag, blocking trigger, consent 상태, 전송 파라미터를 연다.
3. GA4 → Admin → Data display → DebugView에서 같은 디버그 기기를 선택한다.
4. DebugView의 event parameter에서 `metric_name`, `metric_value`, `metric_rating`, `metric_id`, `metric_delta`, `metric_navigation_type`, route family, `page_lang`을 확인한다.

**확인됨:** 30/30 canary pageview에서 dataLayer에 생성된 각 기대 이벤트가 Tag Assistant에서 **정확히 1개 GA4 Event tag**를 firing하고, GA4 DebugView 30분 창 안에 대응 이벤트가 보이며, 필수 파라미터 누락·금지 필드가 각각 0건이다. Google 정본은 DebugView의 Seconds stream이 최근 60초 로그를 보인다고 설명하지만 도착 최대시간을 보장하지 않으므로 “N초 SLA”를 만들지 않는다. 30분 내 1건이라도 누락이면 전달 확인 실패다.

### 3.3 커스텀 정의·수치 수집 확인

1. GA4 → Admin → Data display → Custom definitions.
2. 문자열/범주형인 `metric_name`, `metric_rating`, `metric_navigation_type`, `route_family`, `page_lang`은 event-scoped **custom dimensions**로 확인한다.
3. 수치형 `metric_value`, `metric_delta`는 event-scoped **custom metrics**로 확인한다. `metric_value`를 dimension으로 등록하지 않는다.
4. `metric_id`는 보고 차원으로 등록하지 않는다. BigQuery 중복 검사용 원시 parameter로만 짧게 사용한다.
5. 생성 이후 새 canary를 보내고 48시간 뒤 Explore에서 확인한다. 기존 수집분의 소급 채움은 기대하지 않는다.

**확인됨:** 위 7개 보고용 정의가 exact parameter name·event scope로 7/7 일치하고, 생성 후 canary 30페이지뷰의 `web_vitals`에서 48시간 뒤 `(not set)` 비율이 **0/30**, 수치 값이 DebugView·BigQuery와 단위까지 일치한다. 1개라도 이름/범위/단위가 다르거나 48시간 후 누락이면 미확인. Google은 custom metric의 보고 처리에 24–48시간이 걸릴 수 있다고 명시한다.

### 3.4 원시 데이터 export 확인

1. GA4 → Admin → Product links → BigQuery links에서 대상 property·project·dataset location·Daily/Streaming 선택을 확인한다.
2. BigQuery Explorer에서 `analytics_<property_id>.events_*` 및 선택했다면 `events_intraday_*` 존재를 확인한다.
3. canary 날짜의 `web_vitals`를 `UNNEST(event_params)`해 위 키들을 꺼낸다. 개인정보 경계를 넘는 query/referrer/UID를 결과표에 출력하지 않는다.
4. Daily export는 다음날부터 확인하되 **72시간 후** 같은 날짜 테이블을 재검산한다(늦게 도착한 이벤트 반영 가능).

**확인됨:** 30 canary pageview의 기대 이벤트가 72시간 안정화 후 raw table에 존재하고, 허용 필수 키 누락 0건·금지 커스텀 키 0건·SQL type 오류 0건이다. Streaming을 켰다면 intraday에서 수분 내 보이는 것은 조기 신호일 뿐 최종 확인은 daily table로 한다. 테이블 부재, 권한 부재, 링크 생성일 이전 이벤트 요구는 실패/판정불가로 기록한다.

### 3.5 중복 제거 확인

현재 코드에는 Web Vitals 전용 dedup 저장소나 GA4 `event_id`가 없다. `metric_id`가 push되지만 GA4 도착 여부도 미확인이다. 또한 16개 지면은 GTM과 direct gtag를 함께 로드하므로 동일 event의 이중 전송 가능성이 있다.

1. BigQuery에서 canary만 시간·route로 제한한다.
2. `(event_date, metric_name, metric_id)`별 `COUNT(*)`, 서로 다른 `metric_value`, 최초/최종 timestamp를 계산한다.
3. 원시 count와 `ROW_NUMBER() OVER (PARTITION BY event_date, metric_name, metric_id ORDER BY event_timestamp DESC)=1` count를 비교한다.
4. 동일 키에 여러 값이 있으면 최종 timestamp 1건을 채택한다. 동일 값 중복도 1건만 남긴다. `metric_id`가 null이면 해당 행은 p75 입력에서 제외하고 누락률을 보고한다.
5. 30페이지뷰의 브라우저 dataLayer count ↔ Tag Assistant firing count ↔ BigQuery raw count를 단계별 비교한다. GA4 UI와 BigQuery 총계의 완전 일치는 모델링·Google Signals·카디널리티·지연 때문에 요구하지 않는다.

**확인됨:** canary에서 `metric_id` null **0건**, dedup 후 기대 키 **100% 보존**, 중복률 `1 - unique_keys/raw_rows`가 **0%**. 중복이 1건이라도 나오면 원인을 고친 뒤 canary를 다시 하고, 고치기 전 운영 분석에서는 위 SQL dedup을 의무화한다. 목표 0%는 Google 통과 규칙이 아니라 이 파이프라인의 내부 무결성 기준이다.

### 3.6 동의 동작 확인

1. 깨끗한 프로필에서 Tag Assistant를 열고 배너 조작 전, 거부 후, 허용 후를 각각 검사한다.
2. `analytics_storage` default가 첫 Google config/event보다 먼저 `denied`, 거부 후 계속 `denied`, 허용 후 `granted`로 update되는지 본다.
3. 각 상태 10페이지뷰(총 30)에서 GA request·cookie·DebugView를 확인한다.

**확인됨(본 프로젝트의 “거부자는 오지 않음” 정책 기준):** 미결정 10/10 및 거부 10/10에서 GA `web_vitals` 수집 요청 0건·GA 식별 cookie 생성 0건·DebugView event 0건, 허용 10/10에서 기대 event 전달 10/10. cookieless ping을 허용하는 Advanced Consent Mode를 택하면 “거부자는 오지 않음”이 아니므로 정책·분석 정의를 다시 써야 한다. 현재 저장소에는 이 상태 전이를 입증하는 코드가 없어 **미확인/위험**이다.

## 4. 동의 기반 손실과 p75 선택 편향 평가

### 4.1 반드시 분리할 분모

28일·route family·거친 기기·release별로 다음을 낸다.

- `N_all`: 개인정보 없는 Hosting/CDN의 총 HTML 요청 집계(가능한 경우 봇 제외 규칙 고정)
- `N_choice`: 동의 UI 노출 수
- `N_granted`: 분석 동의 수
- `N_rum`: 유효한 Web Vitals pageview 수
- `N_inp`: 실제 상호작용이 있어 INP가 있는 pageview 수
- 동의율 `N_granted/N_choice`
- 동의 후 RUM 도달률 `N_rum/N_granted`
- INP 관측률 `N_inp/N_rum`

개별 거부자를 추적하지 않는다. Hosting/CDN에서 허용되는 **집계 카운트만** 사용하고, 사용할 수 없다면 `N_all`과 동의 손실률은 미확인으로 남긴다. GA의 동의자 수를 전체 방문자 수로 대체하지 않는다.

### 4.2 왜 방향이 자동으로 정해지지 않는가

거부자의 INP가 관측되지 않으므로 관측 자료만으로 편향 방향은 식별되지 않는다. 느린 기기·브라우저 사용자가 더 거부하거나 배너 전에 이탈하면 관측 p75는 실제보다 낮아질 수 있다. 반대로 privacy-conscious 고성능 기기 사용자가 더 거부하면 높아질 수 있다. 어느 방향도 데이터 없이 사실로 쓰지 않는다.

### 4.3 실행 가능한 민감도 분석

1. 동의자 INP 분포 `F_g`를 route×device×release별로 구한다.
2. 동의율 `r=N_granted/N_choice`를 같은 층별로 구한다.
3. 거부자 분포를 볼 수 없으므로 다음 사전 시나리오를 **[추정]**으로 둔다: 거부자 INP가 동의자 각 관측값 대비 `-50ms, -25ms, 0ms, +25ms, +50ms, +100ms` 이동하거나 `0.75×, 1.0×, 1.25×, 1.5×` 배율인 경우.
4. 각 시나리오에서 혼합 CDF `F_all(x)=rF_g(x)+(1-r)F_d(x)`의 p75를 계산한다. “관측 p75 대비 변화(ms)”와 good 비율 변화를 표로 낸다.
5. 완전 비모수 worst case도 낸다. 거부자 값을 허용 범위 최저/최고에 모두 놓아 부분식별 구간을 계산한다. 동의율이 낮으면 구간이 넓어져 결론 불가가 정상이다.
6. 28일 안에서 동의율이 높은 날/낮은 날, route, device의 p75 차이를 본다. `Δp75`, bootstrap 95% CI, 표본수를 함께 제시한다. 이는 상관 진단이지 거부자 성능의 직접 관측이나 인과추론이 아니다.
7. 동의 UI 문구·기본값·노출 시점을 임의로 바꾸어 동의를 유도하지 않는다. 합법적·동일한 UI의 자연 변동만 분석한다.

**내부 보고 판정선:** 어느 합리적 **[추정]** 시나리오에서든 전체 p75가 관측 p75보다 **25ms 이상** 또는 good 비율이 **3%p 이상** 달라지거나, 비모수 구간이 200ms 경계를 가로지르면 “선택 편향 민감—대외 판정 보류”로 표시한다. 이 숫자는 Google 기준이 아니라 내부 경보선이다. 표본을 늘려도 거부자 분포가 계속 관측되지 않으면 이 편향은 사라지지 않는다.

## 5. 새 공개 엔드포인트 없는 채택안

1. 기존 `dataLayer → GTM → GA4`만 사용한다. Cloud Function/RTDB 익명 write/외부 RUM SaaS를 만들지 않는다.
2. GTM에서 `web_vitals` Custom Event trigger 하나와 GA4 Event tag 하나만 두고, route lookup·허용 필드 allowlist·consent requirement를 적용한다.
3. `page_path` 원문은 GA4 Event tag에 매핑하지 않고 GTM의 정규식 표로 `home/product/survey/report/program/checkin/blog/auth/legal/b2b/other` 같은 고정 route family로 치환한다. 동적 segment는 무조건 `other` 또는 해당 family다.
4. `metric_id`는 원시 중복 제거에만 쓰고 사용자 속성·맞춤 차원으로 등록하지 않는다. 보존기간·삭제 절차를 확정한다.
5. GA4 BigQuery 기존 product link로 export한다. 이는 새 사이트 공개 endpoint가 아니다. 다만 Cloud 프로젝트 권한·비용·데이터 위치·보존 승인 필요.
6. 블로그 102개처럼 수집기만 있고 GA loader가 없는 지면은 “전송 확인 대상에서 제외”하지 말고 배선 결함으로 기록한다. 성역 변경 승인 범위에서 기존 loader를 일관화한 뒤 canary를 재수행한다.
7. 새 endpoint 없이도 개인정보 경계를 만족하지 못하면 수집을 켜지 않는다. 가시성보다 배포헌법 제1조를 우선한다.

## 6. 28일 산출·판정 규칙

- 기간: 속성 timezone 기준 연속 28일. 28일을 늘여 같은 숫자에 섞지 않는다. 다음 날은 rolling window로 별도 산출한다.
- 분리: route family × PHONE/DESKTOP(필요 시 TABLET 별도) × release. 합쳐서 이질성을 숨기지 않는다.
- INP 분모: INP가 실제 관측된 적격 pageview만. 무상호작용을 0ms로 대체하지 않는다.
- dedup: `(event_date, metric_name, metric_id)`별 마지막 값 1개.
- p75: 정렬 후 nearest-rank `ceil(0.75n)`번째 값으로 고정. SQL 함수의 보간 방식이 다르면 명시한다.
- 함께 표시: 기간, 표본수 n, 총 pageview N, INP 관측률, p50/p75/p90, good 비율, 중복률, 동의율, release, 수집기 버전.
- `n≥400`: good ratio의 SE 약 2.2%p·95% 여유 약 4.2%p를 위한 **내부 정밀도 등급**일 뿐 p75 안정성 또는 Google 최소 요건이 아니다.
- Wilson 95% 하한 ≥75%: 내부의 더 엄격한 확증 기준일 뿐 Google 통과 규칙이 아니다. n=400에서는 관측 good ratio가 약 79%여야 충족한다.
- `n<400`, `n<100`: 내부 보고 등급일 뿐 통계적·Google 경계가 아니다.

Google 정본 확인(2026-09-08): https://web.dev/articles/vitals — page load의 75번째 백분위수를 mobile/desktop으로 나누어 보며, good 기준은 LCP ≤2.5초, INP ≤200ms, CLS ≤0.1이다. 이 정본 페이지는 최소 표본수를 제시하지 않는다.

## 7. 정직 고지문 초안

> 실측 2026-08-31: 12지면×2뷰포트×5회 = 120회 · 2세션 반복, 두 세션 모두 24/24 통과. 관측 최악값은 CLS 0.0501 · LCP 1,112ms이며, 보수적으로 두 세션의 더 나쁜 값을 채택한다.  
> **현재 INP와 p75 필드값은 미측정이다.** 기존 `web-vitals.js → dataLayer → GA4` 코드는 존재하지만, GA4 실제 전달·커스텀 파라미터·원시 export·중복 제거·동의 기반 누락은 아직 실증되지 않았다.  
> (Lab 측정 — Google 규격 p75 필드 측정 아님. 세션 간 차이 자체가 Lab의 한계다. 합성 상호작용 자동화 결과가 생기더라도 명칭은 `시나리오 기반 Lab INP`로 한정한다.)  
> ※ 위 숫자는 손으로 적은 값이라 낡을 수 있다. 정본은 `npm run test:cwv` 실행 결과다.

필드 수집을 시작했지만 28일 검증 전에는 다음 문구를 덧붙인다.

> 필드 수집 경로를 검증 중이며, 현재 값은 동의한 적격 방문의 점검용 데이터다. 28일·기기·경로별 집계와 선택 편향 평가가 끝나기 전에는 Core Web Vitals 필드 통과로 판정하지 않는다.

## 8. 실행 체크리스트

- [ ] 개인정보 검토: route family 치환, 금지 필드 0개, `metric_id` 목적·보존 확정
- [ ] Consent Mode: default denied가 config보다 선행, 거부/허용 10회씩 음성·양성 통제 통과
- [ ] 30-pageview canary: dataLayer → Tag Assistant → DebugView 단계별 100% 대응
- [ ] GA4 custom dimensions 5개 + custom metrics 2개 이름·scope·unit 일치
- [ ] BigQuery daily export 72시간 안정화 후 raw event·parameter 확인
- [ ] 동일 metric key 중복률 0%, null `metric_id` 0%
- [ ] 블로그 102개 배선 단절과 b2b/lead Web Vitals 미배선 범위 확정
- [ ] 28일 route×device×release 산출 및 동의 선택 편향 민감도표 작성
- [ ] 위 항목 완료 전 문서·게이트에 “INP와 p75 필드값 미측정” 유지

## 9. 내가 확인하지 못한 것

1. GA4·GTM 계정 접근권한이 없어 live container의 tag/trigger/variable, consent settings, 실제 DebugView 이벤트를 확인하지 못했다.
2. GA4 custom definitions가 등록됐는지, BigQuery link/dataset이 있는지, 데이터 보존기간·property timezone·Google Signals/모델링 설정을 확인하지 못했다.
3. 공개 GTM JS에서 Web Vitals 키를 찾지 못했지만, 이것만으로 live container에 해당 tag가 없다고 확정하지 않았다.
4. 브라우저 자동화 패키지는 설치했으나 런타임의 Chrome 공유 라이브러리(`libatk-1.0.so.0`)가 없어 운영 페이지의 실제 network/dataLayer canary를 완료하지 못했다. 정적 코드, 운영 HTML, 운영 `web-vitals.js` hash와 CSP 응답 헤더까지만 확인했다.
5. 동의 배너의 실제 UI·CMP와 GA Consent Mode 연결을 찾지 못했다. Clarity gate만 확인했으며 GA 거부 동작은 입증되지 않았다.
6. Hosting/CDN 집계에서 개인정보 없는 전체 방문 분모를 얻을 수 있는지 확인하지 못했다. 없으면 동의 손실률과 편향 방향은 식별할 수 없다.
7. 2026-08-31 Lab 120회 결과는 이번 작업에서 재실행하지 않았고 발주자가 제공한 기준값을 인용했다.

## 10. 근거

- Google, “Web Vitals”, https://web.dev/articles/vitals (확인 2026-09-08)
- Google Analytics Help, “Monitor events in DebugView”, https://support.google.com/analytics/answer/7201382 (확인 2026-09-08)
- Google Analytics Help, “Create event-scoped custom dimensions”, https://support.google.com/analytics/answer/14239696 (확인 2026-09-08)
- Google Analytics Help, “Create custom metrics”, https://support.google.com/analytics/answer/14239619 (확인 2026-09-08)
- Google Analytics Help, “BigQuery Export”, https://support.google.com/analytics/answer/9358801 (확인 2026-09-08)
- Google Analytics Help, “Data freshness”, https://support.google.com/analytics/answer/11198161 (확인 2026-09-08)
- Google for Developers, “Set up consent mode on websites”, https://developers.google.com/tag-platform/security/guides/consent (확인 2026-09-08)
- Google Developers Blog, “GA4 data in BigQuery versus the GA4 UI”, https://developers.google.com/analytics/blog/2023/bigquery-vs-ui (확인 2026-09-08)
- 저장소 근거: 위 파일·행과 커밋 `b03e21901e0c1449a14ce092d0c4676d7ccf5401` (확인 2026-09-08)
