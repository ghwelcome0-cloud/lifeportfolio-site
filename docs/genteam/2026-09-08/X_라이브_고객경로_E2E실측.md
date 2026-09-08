# X — 라이브 고객 핵심 경로 PC/모바일 E2E 실측

**결론 1.** 비로그인 10경로 × 4뷰포트(PC1440·390·360·320) 56회 로드 전건 HTTP 200, `pageerror` 0, 4xx 리소스 0. 고객이 화면을 못 보는 **P0 차단 결함은 0건**이다.
**결론 2.** `/product?lang=en` 45초 타임아웃의 원인은 페이지가 아니라 `alert("Login required.")` 이다. 로드 0.43초에 alert가 뜨고, 프로브가 dialog를 처리하지 않으면 리다이렉트가 멈춰 `networkidle`이 영원히 오지 않는다(재현 확정). 고객 체감으로는 alert → 0.1초 뒤 `/login?lang=en` 착지이며 화면은 정상이다.
**결론 3.** `/report` `/program` 모바일 CSP `frame-src` 위반은 비로그인 상태에서는 **P2 콘솔 소음**이다. 두 페이지는 0.4~0.5초 안에 `/login`으로 착지하고 화면 결함이 없다. 단, 로그인 세션에서 Firebase Auth iframe이 차단될 때 세션 복원에 영향이 있는지는 계정이 없어 **미확인**이며, 이 판정은 로그인 실측 뒤에만 P1↔P2를 확정할 수 있다.

P1(혼란) 3건: ① `/blog` 320px 가로 스크롤 24px(검색창 넘침), ② `/b2b` PC CLS 최악 0.2168(재현 4회 중 2회, hero 다이어그램 높이 미예약), ③ 첫 화면 CTA 중 24px 미만 터치 타깃이 `/` 모바일 6~7개, `/product-v2` "로그인 하기" 74×16.

---

## 0. 측정 조건 (증거 결박)

| 항목 | 값 |
|---|---|
| 측정 일시 | 2026-09-08 07:20~07:47 UTC (16:20~16:47 KST) |
| 대상 | `https://lifeportfolio.co.kr` 라이브 |
| 도구 | Playwright 1.62.1 · Chromium 151.0.7922.34 headless · Node 22.23.1 |
| 뷰포트 | pc1440 (1440×900, DPR1) · mo390 (390×844) · mo360 (360×780) · mo320 (320×568), 모바일은 isMobile+hasTouch+DPR2, iPhone UA |
| 대기 | `load` 후 6,000ms 정착 · 네비게이션 timeout 30s |
| 수집 | HTTP status · finalUrl · pageerror · console.error · ≥400 응답 · requestfailed · 6초 후 미완료 요청 · `layout-shift` PerformanceObserver(CLS, hadRecentInput 제외) · `scrollWidth−clientWidth` · 첫 화면 내 가시 a/button/[role=button] rect |
| 쓰기 | 0. 폼 제출·결제·가입·로그인 시도 없음. dialog는 dismiss만 |
| 스크립트 | `qa-task-x/probe.mjs`(전수) · `pending.mjs`/`pending2.mjs`(미완료 요청 추적) · `dialog.mjs`(alert/redirect 타이밍) · `extra.mjs`(blog 넘침 요소·b2b CLS 3회·mypage) · `cta.mjs`(첫 화면 타깃 목록) · `holddialog.mjs`(타임아웃 재현) |
| 원자료 | `qa-task-x/results/full.json` (sha256 앞 16자 `f8dce039726be07c`), 스크린샷 60장 `results/shots/` |

로컬 checkout(`ac533ba`)은 라이브와 다를 수 있어 코드 인용은 라이브 HTML을 `curl`로 받은 것만 사용했다.

## 1. 비로그인 경로 전수 결과표

열: 상태 | 착지 | pageerror | console.error | 4xx | 실패요청(GA collect 제외) | 가로스크롤px | CLS | 첫화면 대화형 수 | 24px 미만 | 44px 미만

```
/            pc1440 200 /            0 0 0 0  0 0.0348 17 5 16
/            mo390  200 /            0 0 0 0  0 0      13 7 11
/            mo360  200 /            0 0 0 0  0 0      12 6 10
/            mo320  200 /            0 0 0 0  0 0      10 6  9
/suvey       pc1440 200 /login       0 0 0 0  0 0      10 1  5
/suvey       mo390  200 /login       0 0 0 0  0 0       8 1  5
/suvey       mo360  200 /login       0 0 0 0  0 0       8 1  5
/suvey       mo320  200 /login       0 0 0 0  0 0       5 0  3
/product-v2  pc1440 200 /product-v2  0 0 0 0  0 0       7 3  5
/product-v2  mo390  200 /product-v2  0 1 0 1  0 0       7 3  5   ← CSP script-src (apis.google.com)
/product-v2  mo360  200 /product-v2  0 1 0 1  0 0       6 2  4   ← 동일
/product-v2  mo320  200 /product-v2  0 1 0 1  0 0       5 1  3   ← 동일
/login       pc1440 200 /login       0 0 0 0  0 0      10 1  5
/login       mo390  200 /login       0 0 0 0  0 0       8 1  5
/login       mo360  200 /login       0 0 0 0  0 0       8 1  5
/login       mo320  200 /login       0 0 0 0  0 0       5 0  3
/signup      pc1440 200 /signup      0 0 0 0  0 0       7 2  5
/signup      mo390  200 /signup      0 0 0 0  0 0       7 2  5
/signup      mo360  200 /signup      0 0 0 0  0 0       7 2  5
/signup      mo320  200 /signup      0 0 0 0  0 0       6 2  5
/blog        pc1440 200 /blog        0 0 0 0  0 0      12 4 12
/blog        mo390  200 /blog        0 0 0 0  0 0      11 4 10
/blog        mo360  200 /blog        0 0 0 0  0 0      11 4 10
/blog        mo320  200 /blog        0 0 0 0 24 0      11 4 10   ← 가로 스크롤
/b2b         pc1440 200 /b2b         0 0 0 0  0 0.2168  4 0  2   ← CLS
/b2b         mo390  200 /b2b         0 0 0 0  0 0       4 0  2
/b2b         mo360  200 /b2b         0 0 0 0  0 0       4 0  2
/b2b         mo320  200 /b2b         0 0 0 0  0 0       4 0  2
/checkin-21  pc1440 200 /checkin-21  0 0 0 0  0 0.0153  5 0  4
/checkin-21  mo390  200 /checkin-21  0 0 0 0  0 0       3 0  3
/checkin-21  mo360  200 /checkin-21  0 0 0 0  0 0       3 0  3
/checkin-21  mo320  200 /checkin-21  0 0 0 0  0 0       3 0  3
/privacy     ×4     200 /privacy     0 0 0 0  0 0       0 0  0
/terms       ×4     200 /terms       0 0 0 0  0 ≤0.0041 1 0  0
```

로그인 필수 경로(참고용, 비로그인 착지 확인):

```
/product?lang=en pc1440 200 /login?lang=en 0 0 0 0 0 0.0045  (alert 1회)
/product?lang=en mo390  200 /login?lang=en 0 0 0 1 0 0       (firebaseapp auth iframe ERR_ABORTED — 리다이렉트 중 취소)
/product?lang=en mo360  200 /login?lang=en 0 2 0 0 0 0       (CSP connect-src apis.google.com/js/gen_204 — 소음)
/product?lang=en mo320  200 /login?lang=en 0 0 0 0 0 0
/report          pc1440 200 /login  0 0 0 1 0 0   (ambient-context.js ERR_ABORTED — 리다이렉트 중 취소)
/report          mo390/360/320 200 /login 0 1 0 0~1 0 0   (CSP frame-src firebaseapp.com)
/program         pc1440 200 /login  0 0 0 0 0 0
/program         mo390/360/320 200 /login 0 1 0 0 0 0     (CSP frame-src firebaseapp.com)
/mypage          pc1440 200 /login  0 0 0 3 0 0   (axis-keywords/axis-code-map/mypage-curation.js ERR_ABORTED)
/mypage          mo390/360/320 200 /login 0 0 0 0~1 0 0
```

모든 뷰포트에서 `www.google-analytics.com/g/collect` fetch 1~2건이 `ERR_ABORTED`로 기록된다. 이는 페이지 이탈/리다이렉트 시 비컨이 취소되는 정상 동작으로 결함에서 제외했다(전 56회 공통, 고객 체감 없음).

### 첫 화면 CTA 터치 가능 여부(실측 rect)

- `/` 390: 주 CTA "첫 실행 설계도 받기 →" 144×43(44 미달 1px), "함께 보기 →" 312×44 통과. 상단 "로그인" 33×23, "회원가입" 43×23, "KO" 38×23, "EN" 36×23 — **24×24 AA 기준도 미달**(높이 23). "리포트 미리 보기 ↓" 96×15, 배너 "닫기" 20×23.
- `/` 1440: 동일 요소 "로그인" 33×23, "회원가입" 43×23, "리포트 미리 보기 ↓" 96×15, "닫기" 20×23.
- `/login`(및 /suvey·/report·/program·/mypage 착지): "Google로 시작하기" 300×50, "이메일로 로그인" 300×54 통과. "처음이신가요? 여정 시작하기 →" 300×23(높이 24 미달).
- `/product-v2` 390: 결제 버튼 2개 350×60 통과. "로그인 하기" 74×16, "샘플 리포트…" 315×14, "이용약관 제7조" 82×14 — 24 미달.
- `/blog` 390: 헤더 링크 "홈" 11×15, "상품" 22×15, "블로그" 33×15, "로그인" 33×15 — 4개 모두 24 미달. 주제 칩 56×39.
- `/b2b` 전 뷰포트: "지금 견적 받기" 104×38, "가격 먼저 보기 ↓" 147×56.
- `/checkin-21` 390: 첫 화면(844px) 안에 CTA 없음. 상단 "KO" 36×30, "EN" 34×30, 브랜드 링크 112×28만 존재. 가격 카드는 보이지만 행동 버튼은 폴드 아래.
- `/signup`: "Google로 시작하기" 300×54 통과(폼 렌더 확인, 제출 없음).

## 2. `/product?lang=en` 타임아웃 원인 확정

실측 순서(pc1440, `dialog.mjs`):

```
t=103ms  navigate /product?lang=en
t=426ms  alert "Login required."          ← 라이브 HTML: onAuthStateChanged(user==null) → alert → location.replace(login.html?lang=en)
t=518ms  navigate /login?lang=en
```

모바일 390도 동일(377ms alert, 473ms 착지). 한국어 `/product`는 inline 스크립트가 `lang` 판정 후 즉시 `location.replace("/product-v2")`하므로 alert가 없고, `?lang=en`만 이 경로를 탄다.

재현 확정(`holddialog.mjs`): dialog 핸들러를 달지 않은 상태로 `/product?lang=en` 로드 → alert가 426ms에 발생한 채로 처리되지 않으면 URL이 `/product?lang=en`에 멈추고 `networkidle`은 20초 timeout. 즉 puppeteer 45초 타임아웃은 **alert가 JS 스레드를 멈춰 리다이렉트가 진행되지 않은 것**이고 PayPal SDK/GTM은 원인이 아니다.

보조 관찰: alert를 dismiss한 정상 흐름에서도 이전 문서의 `reviews_published.json` fetch와 `unpkg web-vitals` script가 in-flight 목록에 남는다. 그러나 `/login?lang=en`을 직접 열면 open 요청 0건이고, `performance` 엔트리에는 unpkg가 200/139ms로 완료되어 있다. 따라서 이는 문서 교체 시점의 취소 요청이 도구 상태표에 남은 것이며 실제 대기 요청이 아니다. curl 200/0.2s와 일치한다.

판정: **P1(혼란)**. 화면은 뜨지만 영어 고객은 결제 페이지 대신 브라우저 alert 한 번을 보고 로그인으로 튕긴다. 한국어 경로는 alert 없이 이동하므로 KO/EN 체감이 다르다. 게이트 측면에서는 dialog 자동 dismiss가 없는 프로브는 이 URL에서 항상 timeout이 나므로, 게이트에 `page.on('dialog')` 처리가 필요하다.

## 3. `/report` `/program` 모바일 CSP frame-src 판정

- 라이브 `report.html` meta CSP: `frame-src https://www.google.com https://www.recaptcha.net https://recaptcha.google.com https://td.doubleclick.net https://www.googletagmanager.com` — `*.firebaseapp.com` 없음. `program.html`도 동일(recaptcha.google.com 제외).
- 대조: `login.html`·`signup.html` meta CSP는 `frame-src https://*.firebaseapp.com https://accounts.google.com …`으로 허용한다.
- 차단 대상: `https://lifeporfolio.firebaseapp.com/__/auth/iframe?...` (Firebase Auth의 authDomain iframe). PC에서는 이 위반이 기록되지 않았고 모바일 UA 3뷰포트에서만 기록되었다.
- 비로그인 착지: `/report` → 0.40~0.57초 후 `/login`, `/program` → `/login`. 4뷰포트 모두 화면 정상(스크린샷 `report__mo390.png` 등), pageerror 0.

판정: 비로그인에서는 **P2(소음)**. 리포트 미표시 같은 체감 결함은 관측되지 않았다. 로그인 세션에서의 영향은 아래 "확인하지 못한 것"에 둔다. 참고로 `/product-v2` 모바일에서 `apis.google.com/js/api.js`가 `script-src`에 차단되는 것(`disposition: enforce`, meta CSP)도 같은 계열이며, 결제 버튼 렌더에는 영향이 없었다(350×60 두 버튼 가시).

## 4. 결함 목록 (등급·재현·증빙)

### P0 고객 차단 — 0건

### P1 혼란

**X-1. `/product?lang=en` 비로그인 진입 시 브라우저 alert 후 로그인 이동 (KO 경로와 비대칭)**
재현: 새 컨텍스트 → `/product?lang=en` 열기 → 0.4초 내 `alert("Login required.")` → 확인 → `/login?lang=en`. 증빙: `product_lang_en_landing__pc1440.png`, `product_lang_en_landing__mo390.png`, `results/pending_*.json`. 부작용: dialog 미처리 프로브 45초 timeout(재현 확정).

**X-2. `/blog` 320px 가로 스크롤 24px**
재현: 320×568 모바일로 `/blog` 로드 → `scrollWidth 344 > clientWidth 320`. 넘침 요소 실측: `INPUT#insightSearch` right=369(폭 300), `BUTTON#insightSearchClear` right=409, `ARTICLE.post-card` right=344. 390/360에서는 0. 증빙: `blog__mo320.png`(검색창 우측 잘림 확인), `blog__mo320_full.png`.

**X-3. `/b2b` PC CLS 최악 0.2168 (간헐)**
재현: 1440×900으로 `/b2b` 로드, layout-shift 관측. 5회 중 2회 0.198~0.2168, 3회 0.0016. 최대 단일 shift 0.1725~0.1964, source `SECTION.section > DIV.hero-journey-viz`, `DIV.hero-ctas`. 라이브 CSS 확인: `.hero-lead`에 `min-height` 없음(계산값 `0px`), `.hero-journey-viz` 높이 예약 없음(계산 높이 249.6px, `min-height:auto`). 발주문의 "`.hero-lead{min-height:116px}`로 0.0413 달성"은 현재 라이브에서 확인되지 않는다 — 배포 누락인지 다른 브랜치인지는 미확인. 모바일 3뷰포트는 CLS 0. 증빙: `b2b__pc1440.png`, `extra.mjs` 출력.

**X-4. 첫 화면 24px 미만 터치 타깃 (AA 기준 미달)**
`/` 모바일 6~7개(로그인 33×23·회원가입 43×23·KO 38×23·EN 36×23·리포트 미리 보기 96×15·닫기 20×23), `/blog` 헤더 링크 4개(높이 15), `/product-v2` "로그인 하기" 74×16 및 각주 링크 2개(높이 14), `/login` "여정 시작하기 →" 300×23, `/signup` 2개. 이전 실측(2.5.8 AA 100%)과 다른 이유는 이번 측정이 **첫 화면 내 가시 요소만**을 대상으로 하고 인라인 텍스트 링크 예외를 적용하지 않았기 때문이다. 링크 텍스트가 문장 안에 있으면 WCAG 2.5.8 inline 예외 대상일 수 있으므로 "AA 위반 확정"이 아니라 "혼란 가능 후보"로 둔다. 증빙: `cta.mjs` 출력, `home__mo390.png`.

### P2 소음

**X-5.** `/report` `/program` 모바일 CSP `frame-src` 차단(firebaseapp auth iframe). 비로그인 체감 없음. 3장 참조.
**X-6.** `/product-v2` 모바일 CSP `script-src` 차단(`apis.google.com/js/api.js`, enforce). 결제 버튼 렌더 정상. 로그인 상태에서 Google 계정 연동 기능이 영향받는지 미확인.
**X-7.** `/product?lang=en` 360에서 `apis.google.com/js/gen_204` connect-src 차단 2건. 텔레메트리 요청.
**X-8.** `/mypage` PC 비로그인: `axis-keywords.js` `axis-code-map.js` `mypage-curation.js` ERR_ABORTED. 실측 순서 170ms 진입 → 819ms `/login` 착지. 스크립트 취소는 리다이렉트로 인한 것으로 발주문의 [추정]과 일치하며, 이번엔 타이밍으로 확인했다(리다이렉트 이후 실패 기록). 콘솔 error 0.
**X-9.** `/suvey` 비로그인: 2.6초 동안 "✅ 결제 완료 · 검사 진행 단계 … 56문항" 본문이 먼저 보인 뒤 `/login`으로 이동. 잘못된 정보가 2.6초 노출되므로 P2와 P1의 경계다. 증빙: `suvey__mo390_t1s_before_redirect.png`.
**X-10.** 전 페이지 GA `collect` 비컨 ERR_ABORTED — 이탈 시 취소, 결함 아님.

## 5. CLS 요약 (체감 레이아웃 점프)

- 모바일 3뷰포트: 14경로 전부 CLS 0.
- PC: `/` 0.0348~0.0411, `/checkin-21` 0.0153, `/terms` 0.0041, `/product?lang=en` 0.0045, 그 외 0. `/b2b`만 0.2168(간헐).
- Good 기준 0.1을 넘는 곳은 `/b2b` PC 하나다.

## 6. 권고 (측정 발주이므로 수정 제안은 지점만 지목)

- X-1: 영어 결제 진입에서 alert 대신 KO와 같은 무음 이동 또는 페이지 내 안내로 통일. 게이트 프로브에는 dialog 자동 처리 추가.
- X-2: `/blog` 320px 검색 입력(`#insightSearch`) 폭 계산 및 `.post-card` 좌우 여백.
- X-3: `.hero-journey-viz` 높이 예약(실측 249.6px) 및 `.hero-lead` 예약 상태 재확인.
- X-5/X-6: `report.html` `program.html` `product-v2` meta CSP의 `frame-src`/`script-src`를 `login.html`과 정합. 성역 파일이 아닌 HTML meta 층이다. 단 Report-Only가 아닌 enforce meta이므로 변경 전 로그인 세션 실측이 필요하다.

## 내가 확인하지 못한 것

1. **로그인 필요 경로 전체** — `/suvey` 문항 진행, `/report` `/program` Living Book 렌더, `/mypage`, PDF 저장, 결제 완주. 계정이 없고 프로덕션 쓰기 0 원칙으로 시도하지 않았다. 따라서 X-5의 "세션 복원 실패 여부"는 미확인이며, 로그인 상태에서 P1 이상으로 승격될 수 있다.
2. `/b2b` CLS의 발주문 수치(0.0413)와 현재 라이브의 차이 원인. 배포 누락인지 측정 조건 차이인지 미확인.
3. X-4의 인라인 링크가 WCAG 2.5.8 inline 예외에 해당하는지는 문맥별 판정을 하지 않았다.
4. 실기기 Safari/iOS·Android Chrome은 미측정. 모두 Chromium 151 UA 에뮬레이션이다.
5. `networkidle2` 45초 timeout은 puppeteer가 아닌 Playwright `networkidle`로 재현했다. 메커니즘(alert 미처리)은 같지만 puppeteer 환경 자체는 재실행하지 않았다.
6. CLS는 각 조건 1회(b2b PC만 5회) 측정이다. 간헐성이 있는 `/b2b`처럼 다른 페이지도 반복 시 다른 값이 나올 수 있다.
7. 12px 미만 글꼴·색 대비·스크린리더 발화는 이번 발주 범위 밖으로 측정하지 않았다.
