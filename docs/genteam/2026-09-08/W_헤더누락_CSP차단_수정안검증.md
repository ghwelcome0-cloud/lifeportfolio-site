# W_헤더누락_CSP차단_수정안검증

- 검증자: Firebase·클라우드 보안 엔지니어
- 검증일: 2026-09-08 (KST 16:14 발주 → 17:30 회신)
- 대상 저장소: ghwelcome0-cloud/lifeportfolio-site
- 검증 기준 커밋: `9319d8f` (PR #296, main 핫픽스, 2026-09-08 16:50 KST 머지) — 발주 시점 기준 커밋 `b03e219` 와 diff 대조
- 라이브 실측 시각: 2026-09-08 17:05~17:30 KST (라이브 `last-modified: 08 Sep 2026 07:54:27 GMT` = 16:54 KST, 즉 #296 배포본)
- 표기 규칙: 실측/정본으로 확인한 것은 그대로 서술, 확인 못 한 것은 **[추정]** 또는 §6 에 기재

발주 후 내가 검증하는 동안 PR #296 이 main 에 머지·배포됐다. 따라서 이 문서는 "수정안 사전 검증"이 아니라 **"적용된 수정의 사후 검증 + 잔존 결함 + 재발 방지"** 로 판정한다. 결론 요약:

| 항목 | 판정 | 한 줄 근거 |
|---|---|---|
| 결함 1 수정안 (a) 16지면 열거 규칙 | **채택** | 16지면 전건 라이브 실측 XFO/XCTO/RP/PP/CSP = 1, 자산 규칙 무영향 |
| 결함 1 수정안 (b) 블로그 3규칙, no-store 제외 | **채택** | `/blog/**` 가 확장자 없는 clean URL 에 매칭됨을 정본+실측으로 확인, 블로그 `max-age=3600` 유지 |
| 결함 2 수정안 report/program frame-src | **채택** — 단 동일 결함이 `report-loading` `program-loading` 에 잔존 | SDK 10.12.3 소스: 모바일·Safari 는 초기화 시 `__/auth/iframe` 을 먼저 열고 그 뒤에 세션 복원. 차단 시 5초 대기 → 지면의 2초 가드가 login 으로 튕김 |
| 결함 2 수정안 product-v2 script-src apis.google.com | **채택(정합성)** — "Auth 반쪽 동작" 판정은 **기각** | 스크립트 차단은 즉시 실패 → 세션 복원 지연 없음. product-v2 는 popup/redirect 미사용 |
| 결함 3 "런타임 노출 0" | **수정 채택** | 라이브 정적 산출물 노출 0 은 맞음. 단 (i) 배포 파이프라인(`npm ci` + production SA) 노출은 0 이 아니라 "낮음", (ii) `functions/` 런타임 의존성 5개는 별건이며 lock 부재 |

---

## 1. 결함 1 — 보안 헤더 0종 지면 (수정안 검증)

### 1-1. 발주 전 상태 재현 (2026-09-08 16:20 KST, 커밋 b03e219 배포본)

```
/b2b /b2b-checkout /blog /blog/en /program-guide /index-v2 /checkin-21
/blog/posts/2026-05-05-direction-but-no-action
→ 응답 헤더: cache-control: max-age=3600, strict-transport-security: max-age=31556926 (Firebase 기본값)만 존재.
  X-Frame-Options / X-Content-Type-Options / Referrer-Policy / Permissions-Policy / CSP 전부 없음.
/, /login, /report → 10종 정상.
```

발주 내용과 일치. 추가로 `scripts/hosting-allowlist.mjs` 의 `PUBLIC_ROOT_FILES` 에서 HTML 40개를 clean URL 로 환산해 headers[2] 와 대조한 결과 **미열거 19개** = 발주의 16개 + `/blog` `/blog/en` `/blog/inside-76-questions-1pager` (뒤 3개는 블로그 규칙으로 커버). 즉 발주의 16 + 블로그 열거가 완전하다.

### 1-2. 질문 (1) — `/blog/**` 가 확장자 없는 clean URL `/blog/posts/2026-…` 에 매칭되는가

**예. 매칭된다.** 근거 3중:

1. 정본: Firebase Hosting 구성 문서 "Glob pattern matching" 절 — `**` : "Matches any file or folder in an arbitrary sub-directory". 같은 문서 rewrites 예시 주석 — `"/foo/**" only matches paths like "/foo/xyz", but not "/foo"`. 그리고 headers 절 — source 는 "A URL pattern that, if matched to the **initial request URL**, triggers Hosting to apply the custom header". 즉 매칭 대상은 **요청 URL 경로**이고 파일명이 아니다. 이것이 `**/*.@(html|htm)` 이 cleanUrls 환경에서 실서빙 URL 에 매칭되지 않는 구조적 이유다.
   - URL: https://firebase.google.com/docs/hosting/full-config (확인일 2026-09-08)
2. 구현: Firebase 에뮬레이터·`firebase serve` 가 사용하는 superstatic(`firebase-tools@15.26.0` 은 `^10.0.0`, 최신 11.0.0 과 headers 미들웨어·matcher 코드 동일 — 두 버전 모두 npm 에서 받아 diff 로 확인) `lib/utils/patterns.js` `configMatcher()` = `minimatch(path, glob)`. minimatch 6.x 로 로컬 재현: `/blog/**` vs `/blog/posts/2026-05-05-direction-but-no-action` → true, vs `/blog` → **false**, vs `/blog/en` → true, vs `/blog/post.css` `/blog/rss.xml` → true(자산도 매칭됨, §3 참조).
3. 라이브 실측 (17:05 KST, #296 배포 후):
   ```
   /blog/posts/2026-05-05-direction-but-no-action      200 XFO=1 CSP=1 PP=1 RP=1 CC=[max-age=3600]
   /blog/posts-en/2026-05-05-beyond-personality-tests   200 XFO=1 CSP=1 CC=[max-age=3600]
   /blog/en                                              200 XFO=1 CSP=1 PP=1 RP=1 CC=[max-age=3600]
   /blog/inside-76-questions-1pager                      200 XFO=1 CSP=1 PP=1 RP=1 CC=[max-age=3600]
   /blog/developer-notes-platform                        200 XFO=1 CSP=1 PP=1 RP=1 CC=[max-age=3600]
   ```

따라서 `/blog` 를 별도 규칙으로 둔 수정안 (b) 는 필수였고 정확하다. (정본 문서가 `/foo{,/**}` 축약형을 예시하지만, 성역 원칙상 3규칙 열거가 더 읽기 쉽고 동작 동일 — 변경 불필요.)

### 1-3. 질문 (2) — 블로그에 `Cache-Control: no-store` 를 붙이면 SEO/성능 손해가 있는가

**있다. 블로그는 보안 헤더만 붙이고 캐시는 기본값 유지가 맞다.** #296 은 블로그 3규칙에서 Cache-Control 을 제외했고(9종), 라이브 `/blog*` 문서는 `max-age=3600` 을 유지한다 — 채택.

근거:
- Firebase Hosting 캐시 문서: "Any requested static content is automatically cached on the CDN" / `no-cache, no-store` 는 "prevent caching entirely" 용도로 안내. 즉 블로그에 no-store 를 붙이면 CDN 캐시가 꺼져 모든 요청이 오리진까지 간다(성능·비용 손해). https://firebase.google.com/docs/hosting/manage-cache (확인일 2026-09-08)
- Google 검색 크롤링 캐시 공식 글(2024-12): 크롤러는 `ETag`/`If-None-Match`, `Last-Modified`/`If-Modified-Since` 조건부 요청을 지원하고 "consider also setting the max-age field of the Cache-Control header to help crawlers determine when to recrawl". 라이브 블로그 응답에는 `etag` 와 `last-modified` 가 이미 있다(실측). no-store 는 이 최적화를 끄는 방향이다. 캐시가 순위 요인이라는 서술은 정본에 없다(SEO "순위" 손해는 **[추정]** 이 아니라 "근거 없음"). https://developers.google.com/search/blog/2024/12/crawling-december-caching (확인일 2026-09-08)
- 보안 관점: 블로그는 로그인·개인정보·결제가 없는 공개 콘텐츠라 no-store 의 보호 가치가 없다.

주의: 블로그 규칙 9종에는 `Cross-Origin-Opener-Policy: unsafe-none` `Reporting-Endpoints` `CSP-Report-Only`(약 3.3KB) 가 포함돼 응답 헤더가 약 4KB 다(실측 `/blog/en` 헤더 4,076 바이트). 성능 영향은 미미하지만 §3 에 기록.

### 1-4. 질문 (3) — catch-all `**` 대안, Firebase 는 "마지막 매칭 우선"인가 "모두 병합"인가

**모두 병합이며, 동일 key 는 배열 뒤쪽 규칙이 덮어쓴다.** 그러나 `**` catch-all 은 권하지 않는다.

- 정본 문서는 headers 병합 순서를 명시하지 않는다. "Priority order of Hosting responses"(reserved `/__/*` → redirects → exact-match static → rewrites → 404) 는 **어느 콘텐츠를 응답할지**의 순서이고 headers 규칙 간 우선순위가 아니다.
- 구현: superstatic 11.0.0 `lib/middleware/headers.js` — 매칭되는 **모든** 규칙의 headers 를 배열 순서대로 concat 한 뒤 `res.setHeader(key, value)` 를 순서대로 호출. 같은 key 는 마지막 값이 남는다(setHeader 는 덮어쓰기). 다른 key 는 전부 남는다 = 병합.
- 라이브 실측으로 "병합"은 확인됨: `/blog/post.css` → `/blog/**` 의 XFO/CSP/PP/RP + `**/*.@(js|css)` 의 `nosniff`/`Cache-Control: no-cache, must-revalidate` 가 **동시에** 존재. `/assets/journey/slide-1.png` → 이미지 규칙의 Cache-Control + `/assets/journey/**` 의 CORP/X-Robots-Tag/Referrer-Policy 동시 존재.
- 라이브에서 **동일 key 충돌 시 어느 쪽이 남는지**는 현재 구성에 충돌 쌍이 없어 실측 불가 → 프로덕션 엣지의 우선순위는 **[추정: superstatic 과 동일]**.

`**` 를 쓰지 않는 이유:
1. 10종 중 `Cache-Control: no-store` 가 모든 자산에 붙는다. 이미지·폰트·svg·xml 은 뒤쪽 규칙이 Cache-Control 을 덮어쓰지만, **Cache-Control 규칙이 없는 경로** — `/assets/i18n/**`, `.json` `.mp3` `.mp4` 일반 파일 — 는 no-store 가 되어 CDN 캐시가 꺼진다. 성역 규칙 재정렬 없이는 회피 불가.
2. 동일 key 우선순위가 정본에 없고 라이브 실측도 불가(위) → fail-closed 원칙상 미문서 동작에 보안 헤더를 의존시키지 않는다.

더 안전한 대안은 **확장자 없는 경로만** 잡는 extglob `/**/!(*.*)` 이다. minimatch 재현: `/b2b-checkout` `/blog` `/blog/en` `/blog/posts/x` `/blog/developer-notes-platform` → true, `/` `/blog/post.css` `/assets/og/x.jpg` → false. 그러나 `!()` 는 정본 문서 예시에 없다 → 에뮬레이터 + preview 채널 + 라이브 3단 실측 후에만 도입할 것. 지금은 열거형(정본 예시 `@(...)` 그대로)이 옳다.

**재발 방지(권고, 코드 변경은 발주 별건)**: `hosting-allowlist.mjs` 의 HTML 목록 → clean URL 환산 → firebase.json headers 의 source 들과 minimatch 로 대조해 "X-Frame-Options 가 붙지 않는 clean URL 이 1개라도 있으면 실패"하는 검증 스크립트를 `test:hosting` 계열에 추가. 8/24 admin 결함과 오늘 결함은 같은 클래스이며, 지면을 추가할 때마다 사람이 열거를 기억하는 구조는 세 번째 재발을 막지 못한다.

---

## 2. 결함 2 — 인라인 meta CSP(enforcing) 가 Firebase Auth 를 차단 (영향 범위 판정)

Firebase JS SDK 10.12.3 `firebase-auth.js`(gstatic 배포본, 2026-09-08 다운로드) 를 직접 읽어 판정했다. 관련 경로:

- `getAuth()` 는 `popupRedirectResolver: browserPopupRedirectResolver` 를 기본 장착한다.
- `_initializeWithPersistence()`: persistence 준비 → **`if (resolver._shouldInitProactively) try { await resolver._initialize(auth) } catch {}`** → 그 다음에 `initializeCurrentUser()`(로컬 세션 복원).
- `_shouldInitProactively() { return _isMobileBrowser() || _isSafari() || _isIOS() }` — 모바일 전부 + **데스크톱 Safari**.
- `_initialize()` → `_openIframe()` → `_loadGapi()`(`https://apis.google.com/js/api.js?onload=__iframefcb…` 삽입) → `gapi.iframes.open({ url: https://<authDomain>/__/auth/iframe?… })` → iframe `ping` 을 기다리고 타임아웃 `new Delay(5000, 15000).get()` = 온라인·비-Cordova 환경에서 **5,000ms** 후 `network-request-failed` 로 reject.
- `onAuthStateChanged` 구독자는 초기화 완료 후에 첫 호출된다.

### 2-1. (a) report/program — frame-src 에 `*.firebaseapp.com` 부재

메커니즘 판정(코드 기반, 실기기 타이밍은 §6):
1. 데스크톱 Chrome/Edge/Firefox: `_shouldInitProactively` = false → iframe 을 열지 않음 → **영향 없음**. 이 지면들은 `signInWithPopup/Redirect` 를 호출하지 않으므로(사용은 `onAuthStateChanged` 만) 이후에도 iframe 이 필요 없다.
2. 모바일 전부 + 데스크톱 Safari: `apis.google.com` 은 script-src 에 있어 gapi 로드 성공 → iframe 을 열려다 meta `frame-src` 에 차단 → ping 응답 없음 → **5초 대기** 후 실패(예외는 catch) → 그 뒤에야 세션 복원 → `onAuthStateChanged` 첫 호출이 ≥5초 지연.
3. report.html 2457행 / program.html 2819행에 `guard = setTimeout(… if (!auth.currentUser) location.replace(login.html) …, 2000)` 이 있다. **2초 가드 < 5초 지연** → 로그인된 사용자도 `login.html` 로 튕긴다. login.html 은 frame-src 에 `*.firebaseapp.com` 이 있어 그곳에서는 정상 복원된다.

즉 "세션 복원 실패"가 아니라 **"복원 지연 → 지면 자체 가드가 미로그인으로 오판"** 이다. Auth persistence(IndexedDB/localStorage) 자체는 iframe 없이 동작한다. 영향 = 모바일·Safari 사용자가 /report, /program 진입 시 login 으로 이탈 **[추정: 코드 경로에서 도출, 실기기 재현은 미실측]**.

수정 채택. #296 반영 확인(라이브 HTML 파싱): `/report` `/program` meta frame-src 에 `https://*.firebaseapp.com https://accounts.google.com` 존재.

**잔존 결함(#296 미포함)**: `report-loading.html`, `program-loading.html` 도 동일 구조다 — `getAuth` + `onAuthStateChanged` + **2,000ms 가드** + meta frame-src 에 `*.firebaseapp.com` 없음(라이브 HTML 실측 0건, 17:28 KST). 검사 제출 직후 진입하는 지면이므로 report/program 과 같은 튕김이 발생할 수 있다. 같은 한 줄 수정(frame-src 에 `https://*.firebaseapp.com https://accounts.google.com` 추가)을 권고한다. 추가 대조 결과, meta CSP 를 갖고 `firebase-auth.js` 를 로드하는 지면 중 firebaseapp frame-src 가 없는 것은 이 2개뿐이다(index/login/mypage/product/payment-success/signup/success/suvey 는 있음).

### 2-2. (b) product-v2 — script-src 에 `apis.google.com` 부재

메커니즘 판정:
- 모바일·Safari 에서 `_loadJS(api.js)` 가 CSP 로 차단되면 `<script>` 의 `onerror` 로 **즉시** reject → `_initialize` 예외 → catch → `initializeCurrentUser()` 지연 없이 진행. 데스크톱 Chrome 계열은 시도조차 안 함.
- product-v2 는 `onAuthStateChanged` 만 사용하고 popup/redirect 미사용, 페이지 내 가드 타임아웃 없음(로그인 상태를 UI 에 반영만).
- 따라서 "결제 지면에서 Auth 가 반쪽으로 동작" 판정은 **기각** — 로그인 상태 판정·`httpsCallable` 토큰 첨부·결제 흐름에 기능 영향 없음. 영향은 콘솔 위반 로그 1건.

수정은 **채택(정합성)** — 허용목록 확장이지만 (i) `apis.google.com` 은 헤더 CSP-Report-Only 에 이미 있는 1st-party Google 오리진, (ii) 추후 결제 지면에서 재로그인 UX(popup)를 넣을 때 재발을 막고, (iii) 콘솔 노이즈가 실제 위반 탐지를 방해한다. #296 반영 확인: 라이브 `/product-v2` meta script-src 에 `https://apis.google.com`, frame-src 에 `https://*.firebaseapp.com https://accounts.google.com`, connect-src 에 `https://lifeporfolio.firebaseapp.com` 추가됨. **meta 에 `form-action` 이 여전히 없음(라이브 0건)** — 페이플 리다이렉트 차단 회피를 위한 의도적 부재가 유지됐다. 좋다.

---

## 3. 수정 후 회귀 위험 목록

| # | 영역 | 위험 | 판정 | 근거 |
|---|---|---|---|---|
| R1 | 결제 Payple (product-v2) | 헤더 CSP 는 변경 없음. meta 는 허용목록 확장만, `form-action` 부재 유지 | **없음** | diff 대조 + 라이브 meta 실측 |
| R2 | 결제 PayPal (product) | product.html 은 이번 변경 무관(#296 은 4파일만) | **없음** | `git diff --stat` |
| R3 | b2b-checkout 신규 헤더 | 페이지는 `httpsCallable(reportB2BPayment)` 만 사용, Payple/PayPal SDK·`<form action>`·`<iframe>` 없음. `Permissions-Policy payment=(…)` 와 헤더 CSP `form-action` 이 걸릴 대상이 없음 | **없음** | 소스 grep 0건 |
| R4 | b2b-join / b2b-quote / checkin-21-form(-en) 폼 | `<form>` 은 있으나 `action` 속성 0건, JS 처리(fetch/callable). `form-action 'self' …` 이 막을 내비게이션 제출 없음 | **없음** | grep `action=` 0건 |
| R5 | X-Frame-Options DENY 를 새로 받은 16지면 + 블로그 | 사이트 내부에서 이 지면을 `<iframe>` 으로 임베드하는 곳 없음(report/program 라이트박스는 `srcdoc`, admin 미리보기도 `srcdoc`). **외부 파트너 사이트가 블로그/체크인 지면을 임베드하고 있었다면 오늘부터 깨진다** | 내부 없음 / 외부 **[미확인]** | grep + §6 |
| R6 | Auth popup/redirect | 이번 변경은 허용목록 확장이므로 팝업·리다이렉트가 새로 막히는 경로 없음. login.html 무변경 | **없음** | diff |
| R7 | 블로그 SEO | Cache-Control 미변경(`max-age=3600` 유지), `etag`/`last-modified` 유지, X-Robots-Tag 미부여. `Referrer-Policy strict-origin-when-cross-origin` 은 외부 링크 리퍼러의 경로만 제거 — 크롤링·색인과 무관 | **없음** | 실측 + §1-3 정본 |
| R8 | 블로그 자산에 문서용 헤더 부착 | `/blog/**` 가 `post.css` `rss.xml` `developer-notes-platform/assets/*.webp` 에도 XFO/CSP/CSP-RO/Reporting-Endpoints 를 붙임. 브라우저는 비문서 응답의 XFO/CSP 를 무시하므로 기능 영향 없음. 응답당 헤더 약 4KB 증가 | **낮음(성능만)** | 실측 `/blog/post.css` 헤더 4,067B |
| R9 | 404 / 리다이렉트 | `/does-not-exist-w` 404 응답에 XFO/CSP 부착됨(저장소에 404.html 없음 → Firebase 기본 404 가 내부적으로 `/404.html` 경로로 `**/*.@(html|htm)` 에 매칭된 것으로 보임 **[추정]**), `/report-landing` 301 정상 | **없음** | 실측 |
| R10 | 에뮬레이터·CI 계약 | `test:hosting` 계열은 firebase.json 을 publish 금지 목록으로만 다루며 headers 내용 검증 없음 → 회귀 감지 불가(§1-4 권고와 연결) | **구조적** | scripts 확인 |

---

## 4. 배포 후 실측 절차 (curl 그대로) + 음성 통제군

이미 #296 배포본에 대해 아래를 실행해 전건 통과했다(17:05~17:30 KST). 재배포·롤백 후 동일 절차를 반복할 것.

### 4-1. 양성군 — 16지면 + 블로그 대표 7 URL, 5종 헤더 전부 1 이어야 함

```bash
H=https://lifeportfolio.co.kr
for p in /b2b /b2b-checkout /b2b-join /b2b-privacy /b2b-quote /b2b-terms \
         /checkin-21 /checkin-21-en /checkin-21-chat /checkin-21-chat-en /checkin-21-form /checkin-21-form-en \
         /customer-journey /index-v2 /program-guide /report-guide \
         /blog /blog/en /blog/inside-76-questions-1pager /blog/developer-notes-platform \
         /blog/posts/2026-05-05-direction-but-no-action /blog/posts-en/2026-05-05-beyond-personality-tests \
         / /login /report /program /product-v2 ; do
  printf "%-56s " "$p"
  curl -sS -o /dev/null -D - --max-time 15 "$H$p" | tr -d '\r' | awk 'BEGIN{IGNORECASE=1}
    /^HTTP/{s=$2} /^x-frame-options: DENY/{x=1} /^x-content-type-options: nosniff/{xc=1}
    /^referrer-policy/{r=1} /^permissions-policy/{pp=1} /^content-security-policy:/{c=1}
    /^cache-control/{cc=substr($0,16)}
    END{printf "%s XFO=%d XCTO=%d RP=%d PP=%d CSP=%d CC=[%s]\n",s,x,xc,r,pp,c,cc}'
done
```

기대값: 모든 행 `200 XFO=1 XCTO=1 RP=1 PP=1 CSP=1`. 16지면·`/`·헤더[2] 지면은 `CC=[no-cache, no-store, must-revalidate]`, `/blog*` 문서는 `CC=[max-age=3600]` (no-store 가 보이면 블로그 규칙 오염 = 실패).

### 4-2. 음성 통제군 — 문서용 헤더가 붙으면 안 되는 것 / 캐시가 바뀌면 안 되는 것

```bash
for p in /assets/lp-rtdb.js /assets/og/og-default-en.jpg /assets/journey/slide-1.png /robots.txt /sitemap.xml ; do
  printf "%-40s " "$p"
  curl -sS -o /dev/null -D - --max-time 15 "$H$p" | tr -d '\r' | awk 'BEGIN{IGNORECASE=1}
    /^HTTP/{s=$2} /^x-frame-options/{x=1} /^content-security-policy:/{c=1} /^cache-control/{cc=substr($0,16)}
    END{printf "%s XFO=%d CSP=%d CC=[%s]\n",s,x,c,cc}'
done
# 기대: XFO=0 CSP=0, CC 는 각 자산 규칙 값 유지
#   lp-rtdb.js  → no-cache, must-revalidate
#   og-*.jpg    → public, max-age=604800, stale-while-revalidate=86400
#   journey png → public, max-age=2592000, stale-while-revalidate=86400
#   robots/sitemap → public, max-age=3600

# cleanUrls 301 통제군 (확장자 요청은 301 → 확장자 없는 경로)
curl -sS -o /dev/null -w "%{http_code} %{redirect_url}\n" "$H/b2b.html"
curl -sS -o /dev/null -w "%{http_code} %{redirect_url}\n" "$H/blog/posts/2026-05-05-direction-but-no-action.html"
# 기대: 301 https://lifeportfolio.co.kr/b2b , 301 …/blog/posts/2026-05-05-direction-but-no-action
```

### 4-3. meta CSP 반영 확인 (HTML 본문)

```bash
for p in report program product-v2 report-loading program-loading login ; do
  printf "%-16s " "/$p"
  curl -sS --max-time 20 "$H/$p" | tr '\n' ' ' | grep -o -i 'http-equiv="Content-Security-Policy"[^>]*' | tr ';' '\n' \
  | awk '/frame-src/{f=($0 ~ /firebaseapp\.com/)} /script-src/{s=($0 ~ /apis\.google\.com/)} END{printf "frame-src.firebaseapp=%d script-src.apis=%d\n",f,s}'
done
# 2026-09-08 17:28 KST 실측:
#   report 1/1  program 1/1  product-v2 1/1  login 1/1
#   report-loading 0/1  program-loading 0/1   ← 잔존 결함(§2-1)
```

### 4-4. curl 로 못 보는 것 — 실브라우저 1회 (모바일 Safari 또는 Android Chrome)

1. 로그인 상태에서 `/mypage` → 리포트 열기(`/report?sid=…`) 진입. 기대: **login 으로 튕기지 않고** 2초 내 렌더. 콘솔에 `frame-src` 위반 0건.
2. 같은 방식으로 `/program?sid=…`.
3. `/product-v2` 콘솔에 `script-src` 위반 0건, "로그인됨" 표시.
4. (잔존 결함 확인용) 검사 제출 → `/report-loading` 진입 시 튕김 여부 관찰.

---

## 5. 결함 3 — 의존성 (판정만)

발주 판정 "라이브 공개 산출물은 정적 HTML 이라 런타임 노출 0" 에 대한 반박/보정:

1. **라이브 산출물 노출 0 — 동의.** `dist/hosting` 은 정적 파일이며 devDependencies 코드는 브라우저에 전달되지 않는다.
2. **"노출 0" 은 산출물에만 성립하고 배포 파이프라인에는 성립하지 않는다.** `required-checks.yml` `firebase-hosting-pr-build.yml` `firebase-hosting-live.yml` 모두 `npm ci` 로 전체 devDependencies 를 설치하고, live 워크플로는 production 서비스 계정 키를 파일로 내려 `firebase deploy` 를 실행한다. 여기서 실행되는 코드(firebase-tools 와 그 전이 의존성 수백 개)가 production 자격증명과 같은 프로세스 경계 안에 있다. 이번에 열린 4건(fast-uri 경로 정규화·extract-zip 경로 탈출·stream-json·uuid)은 **공격자 입력이 해당 라이브러리에 도달해야** 하는 취약점이고, 파이프라인에서 그 입력은 저장소 JSON(ajv)·Google CDN 의 Chrome 아카이브(puppeteer→extract-zip)라 도달 경로가 사실상 없다 → **"낮음"**, 0 아님. 공급망 위험의 본질은 "다음 버전이 악성일 때" 이므로 lock 고정(`npm ci`) + exact-SHA 액션 고정이 이미 핵심 통제이고, 그 통제는 확인됨.
3. **로컬 `npm audit`(package-lock 기준, 2026-09-08)**: high 5 / moderate 10, 전부 fixAvailable=true. 원격에 `dependabot/npm_and_yarn/fast-uri-3.1.7` 브랜치가 이미 있다 → 별 발주로 머지 권고(테스트 `test:hosting:contract` 통과 조건).
4. **"dependencies 0개" 는 루트 package.json 만의 사실이다.** `functions/package.json` 은 런타임 의존성 5개(exceljs, firebase-admin, firebase-functions, node-fetch, resend)를 갖고 **lock 이 없다**(8/28 지적 유지). 오늘 임시 lock 을 생성해 audit 한 결과 moderate 12 / high 0 (qs, body-parser, express, gaxios, uuid 등 전이). 이것은 Cloud Functions 런타임에서 실제 실행되는 코드이므로 "런타임 노출" 은 functions 쪽에 있다. 단 **실배포된 functions 의 정확한 버전은 lock 부재로 알 수 없어 위 숫자는 [추정: 오늘 resolve 기준]**. lock 커밋이 선행 과제다.

---

## 6. 내가 확인하지 못한 것

1. **실기기 타이밍**: §2-1 의 "5초 지연 → 2초 가드 → login 튕김" 은 SDK 소스에서 도출한 것이고 실제 모바일 Safari/Android Chrome 에서 재현·시간 측정은 하지 않았다. 브라우저가 CSP 차단된 iframe 에 대해 ping 을 어떻게 처리하느냐에 따라 5초보다 빠르게 실패할 수도 있다(그 경우에도 2초는 넘을 가능성이 높지만 미실측).
2. **프로덕션 엣지의 동일 key 우선순위**: 현재 구성에 충돌 쌍이 없어 라이브 실측 불가. superstatic 과 동일하다고 가정했다.
3. **PR #296 의 배포 경로**: 라이브 `last-modified` 가 머지 4분 뒤라 배포된 것은 확실하나, 승격 워크플로(reviewed-artifact 경로)를 거쳤는지 콘솔/CLI 직접 배포인지는 GitHub Actions 로그를 열 권한이 없어 확인하지 못했다. exact-SHA·preview·rollback 증빙은 발주자 쪽 기록으로 남겨야 한다.
4. **외부 임베드**: 파트너·블로그 플랫폼·뉴스레터가 `/blog/*`, `/checkin-21*`, `/customer-journey` 를 iframe 으로 임베드하고 있었는지(R5). 있었다면 X-Frame-Options DENY 로 오늘부터 깨진다.
5. **Google Search Console** 의 크롤 통계·색인 변화 — 헤더 변경 후 며칠 관찰이 필요하며 지금 판정 불가.
6. **CSP 위반 리포트 수집기**(`cspReport`) 에 오늘 전후 위반 건수 변화 — Firestore 운영 데이터 열람은 승인 절차 없이는 하지 않았다.
7. **데스크톱 Safari** 도 `_shouldInitProactively` 대상이므로 report/program 튕김의 영향권이었을 가능성 — 실브라우저 미실측.
8. **functions 실배포 의존성 버전**(§5-4) — lock 부재로 재현 불가.
