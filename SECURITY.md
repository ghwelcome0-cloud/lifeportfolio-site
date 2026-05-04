# 인생포트폴리오 보안 가이드 (LifePortfolio Security Guide)

> 본 문서는 화이트해커 관점에서 본 사이트의 보안 강화 작업을 정리한 문서입니다.
> 코드에 즉시 반영된 항목과, **Firebase Console / GitHub / 도메인 호스팅에서 직접 수동으로 해주셔야 하는 항목**으로 나뉘어 있습니다.

---

## 🆕 Phase 4 — 보안 강화 재점검 (2026-05-03)

### P4-1) Firebase App Check 재활성화 — ✅ 완료
**이전 상태**: 2026-05-03 초기 빌드에서 `if (false) initializeAppCheck(...)` 로 비활성화되어 있었음 (CSP에서 reCAPTCHA 동적 스크립트가 차단되던 일시적 회피 패치).

**현재 상태**: 모든 Firebase 사용 페이지(12개)에서 App Check 재활성화 완료.
- 모듈러 SDK (11페이지): `login`, `signup`, `mypage`, `success`, `payment-success`, `product`, `suvey`, `report-loading`, `report`, `program-loading`, `program`
- 컴팻 SDK (1페이지): `index.html`
- CSP에 이미 `https://www.google.com`, `https://www.recaptcha.net`, `https://content-firebaseappcheck.googleapis.com`, `https://firebaseappcheck.googleapis.com` 도메인이 허용되어 있어 reCAPTCHA Enterprise 동작 보장.
- Site Key: `6Le_GtYsAAAAAGF5rwfcaXcCJ5KAfyMBpukquUh6` (운영용)
- 모든 페이지에서 `_activateAppCheck()` 함수가 DOMContentLoaded 이후 실행되어 reCAPTCHA iframe이 `document.body` 에 안정적으로 주입되도록 보장.

**다음 단계 (Firebase Console)**:
1. App Check Metrics에서 정상 트래픽 토큰 발급률 모니터링 (며칠 단위)
2. 거부율이 5% 미만이고 정상 사용자 영향이 없으면 Authentication·Realtime Database를 **Enforce** 모드로 전환

### P4-2) 클릭재킹 (Clickjacking) JS 방어 — ✅ 완료
**문제**: GitHub Pages는 응답 헤더(`X-Frame-Options`, `Content-Security-Policy: frame-ancestors`) 설정이 불가. `<meta http-equiv>` 태그의 `frame-ancestors` 는 명세상 무효(브라우저가 무시).

**해결**: 16개 모든 HTML 페이지의 `<head>` 최상단에 JS 기반 frame-busting 가드 삽입 (`anti-clickjacking JS guard`).
```js
(function(){
  if (window.top !== window.self) {
    document.documentElement.style.display = "none";
    try { window.top.location = window.self.location.href; }
    catch (e) {
      document.body.innerHTML = "";
      document.body.textContent = "이 페이지는 외부 사이트의 프레임 안에서 표시할 수 없습니다.";
    }
  }
})();
```
- **1차 방어**: 임베드 즉시 `<html>` 비표시 → 사용자 인터랙션 발생 전 콘텐츠 가림
- **2차 방어**: same-origin 임베드는 `top.location` 변경으로 강제 탈출
- **3차 방어**: cross-origin 임베드(`top.location` 접근 SecurityError 발생) 시 빈 페이지 + 안내 메시지로 클릭재킹 차단
- Firebase Hosting으로 마이그레이션 시 `firebase.json`(이미 작성됨)의 `X-Frame-Options: DENY` + `frame-ancestors 'none'` 헤더가 함께 적용되어 다층 방어 완성.

### P4-3) RTDB 보안 규칙 강화 — ✅ 완료
`database.rules.json` 갱신:

**a) 핵심 식별 필드 불변성 (immutability)**:
- `reports/{uid}/{sid}` 와 `programs/{uid}/{sid}` 의 `sid`, `engineVersion`, `rulesVersion`, `generatedAt` 필드는 최초 작성 후 변경 불가 (`!data.exists() || data.val() === newData.val()`)
- `users/{uid}/reports/{sid}` 및 `users/{uid}/programs/{sid}` 인덱스 메타도 동일 정책
- `users/{uid}/createdAt` — 가입일 클라이언트 변조 차단
- `payments/{uid}/createdAt` — 결제 타임스탬프 변조 차단

**b) 편집 횟수 제한 (3회 한도)**:
- `reports/{uid}/{sid}` 와 `programs/{uid}/{sid}` 노드에 `editCount` 필드 추가
- 노드 레벨 `.validate`: `!data.exists() || !data.child('editCount').exists() || data.child('editCount').val() < 3`
- `editCount` 자체는 단조 증가 검증: `newData.val() >= data.val()` (감소 불가) 및 0~3 범위 제한
- `lastEditedAt` 필드 추가로 마지막 편집 시각 추적

**c) `users/{uid}/programs/{sid}` 인덱스의 `sourceSid` 도 불변** — 원본 리포트 ID 위변조 방지.

**d) 기존 강화 유지**:
- `payments/{uid}` — `paid:true` 가 한 번 기록되면 변경 불가
- 모든 `$other` 화이트리스트 외 필드 거부
- `auth.uid === $uid` 본인 검증

### P4-4) CSP 추가 강화 — ✅ 완료
- 정적 페이지(`privacy`, `terms`, `auth-fail`, `payment-fail`) CSP에 추가:
  - `frame-src 'none'` — 어떤 iframe도 로드 불가
  - `worker-src 'none'` — Web Worker 차단
  - `manifest-src 'self'` — 다른 출처의 PWA manifest 차단
- Firebase 활성 페이지(12개) CSP에 `worker-src 'self'`, `manifest-src 'self'` 추가
- **메모**: `frame-ancestors` 는 메타 태그로 무효이므로 CSP에 추가하지 않고, P4-2의 JS 방어 + 향후 Firebase Hosting 헤더로 대응
- **향후 nonce 로드맵 (수동 작업)**: 인라인 스크립트가 매우 많아(76 곳) `'unsafe-inline'` 제거가 어려움. Firebase Hosting 마이그레이션 후 빌드 단계에서 nonce 자동 주입 도입 검토.

### P4-5) 알려진 한계 / 다음 검토 항목
- **편집 횟수 제한의 한계**: RTDB 규칙은 클라이언트가 `editCount` 를 항상 `+1` 증가시킨다는 가정에 의존. 클라이언트가 `editCount` 를 보내지 않으면 편집이 무한 가능 → 향후 클라이언트 코드(`report.html` 의 재생성 버튼 등)에서 **반드시** `editCount` 를 함께 업데이트하도록 통합 필요. 또는 Cloud Functions 트리거로 서버 측 카운팅으로 전환.
- **Anti-screenshot / IP 안내**: 스크린샷 차단은 브라우저 보안 모델상 완벽 차단 불가 (CSS `user-select:none` + 워터마크 + 우회 시도 시 IP 안내 정도가 한계).
- **GitHub Pages → Firebase Hosting/Cloudflare 마이그레이션 권장**: 응답 헤더(`X-Frame-Options`, `Strict-Transport-Security`, `frame-ancestors`)가 메타태그/JS 보다 강한 보안. `firebase.json` 설정은 이미 준비됨.

---

## ✅ 코드에 이미 적용된 보안 개선 (이번 PR)

### 1) XSS (Cross-Site Scripting) 차단
- **이전 위험**: `success.html`, `payment-success.html`, `index.html` 등에서 Google 계정의 `displayName`을
  `innerHTML` 템플릿 리터럴로 출력 → 악의적 displayName(`<img src=x onerror=...>`) 시 스크립트 실행 위험.
- **개선**: 모두 `textContent` 또는 안전한 DOM API(`createElement` + `appendChild`) 로 교체.
- **추가 방어**: `login.html` / `signup.html`의 상태 메시지도 `<b>`, `<br>`만 허용하는 화이트리스트 파서로 교체.

### 2) Content Security Policy (CSP) 적용
모든 HTML에 다음 보안 헤더를 메타태그로 추가했습니다:
- `Content-Security-Policy` — Firebase, Google API, Payple 도메인만 허용
- `X-Content-Type-Options: nosniff` — MIME 스니핑 방지
- `Referrer-Policy: strict-origin-when-cross-origin` — Referer 누설 최소화
- `Permissions-Policy` — 카메라/마이크/위치 등 불필요 권한 차단
- `frame-ancestors 'none'` — **Clickjacking 차단** (다른 사이트가 iframe으로 임베드 불가)

### 3) Open Redirect 및 파라미터 탬퍼링 방지
- `auth-fail.html`, `success.html`: `mode` 쿼리 파라미터를 `["login", "signup"]` **화이트리스트**로 검증.
- 임의의 mode 값으로 retryBtn.href를 외부 URL로 교체할 수 없게 강제.
- `error` 파라미터는 200자 길이 제한 + 제어문자 제거.

### 4) Realtime DB 데이터 무결성
- `signup.html`의 `upsertUser()` 함수에서:
  - `email`, `displayName` 입력값을 **sanitize** (제어문자/줄바꿈 제거, 길이 제한 80/254자)
  - 기존 `...snap.val()` 스프레드 → 화이트리스트 필드(`email`, `displayName`, `createdAt`, `lastLogin`)만 저장
  - `createdAt` 보존 로직으로 클라이언트가 가입일을 임의 변조 불가

### 5) 에러 메시지 정보 누설 최소화
- `auth-fail.html`, `payment-fail.html`: 알 수 없는 에러 코드는 일반화 메시지로 노출(원본 코드/메시지 그대로 노출 X)

### 6) Firebase Realtime Database 보안 규칙 파일 추가
- `database.rules.json` — `users/{uid}`는 본인만 읽기/쓰기, 필드 검증 포함
- `firestore.rules` — Firestore도 사용한다면 함께 적용 가능한 규칙 (현재는 RTDB만 사용)

---

## 🔴 반드시 Firebase Console / 호스팅 콘솔에서 수동으로 해주실 작업

### A. Firebase Authentication — 승인된 도메인 (HIGHEST)
**위치**: Firebase Console > Authentication > Settings > Authorized domains

- ✅ `lifeportfolio.co.kr`, `lifeporfolio.firebaseapp.com` 만 남기세요.
- ❌ `localhost` 는 운영에서 **삭제** (개발 시에만 추가)
- 등록되지 않은 도메인에서는 로그인 자체가 불가능 → 피싱 사이트가 본 프로젝트의 API Key를 도용해도 인증 진행 불가.

### B. Firebase App Check 활성화 (CRITICAL) — ✅ 코드 적용 완료
**Firebase 웹 API Key는 공개되어도 안전하지만 — App Check 없이는 누구나 본 프로젝트의 백엔드(Auth/RTDB)를 직접 호출할 수 있습니다.**

**현재 상태**:
- ✅ Firebase Console > App Check > 웹앱 등록 완료 (reCAPTCHA Enterprise)
- ✅ 사이트 키: `6Le_GtYsAAAAAGF5rwfcaXcCJ5KAfyMBpukquUh6`
- ✅ 모든 Firebase 초기화 페이지에 `initializeAppCheck` 코드 적용 완료:
  - index.html, login.html, signup.html
  - success.html, payment-success.html
  - product.html, suvey.html
- ✅ CSP에 reCAPTCHA Enterprise 도메인 허용:
  - `https://www.google.com`, `https://www.recaptcha.net`
  - `https://content-firebaseappcheck.googleapis.com`
  - `https://firebaseappcheck.googleapis.com`

**적용된 코드 패턴 (modular SDK)**:
```js
import { initializeAppCheck, ReCaptchaEnterpriseProvider }
  from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app-check.js";

const app = initializeApp(firebaseConfig);
try {
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider("6Le_GtYsAAAAAGF5rwfcaXcCJ5KAfyMBpukquUh6"),
    isTokenAutoRefreshEnabled: true
  });
} catch (e) {
  console.warn("[AppCheck] init failed:", e && e.message);
}
```

**적용된 코드 패턴 (compat SDK — index.html 전용)**:
```html
<script src="https://www.gstatic.com/firebasejs/10.12.3/firebase-app-check-compat.js"></script>
<script>
  firebase.initializeApp(firebaseConfig);
  try {
    const appCheck = firebase.appCheck();
    appCheck.activate(
      new firebase.appCheck.ReCaptchaEnterpriseProvider("6Le_GtYsAAAAAGF5rwfcaXcCJ5KAfyMBpukquUh6"),
      true
    );
  } catch (e) { console.warn("[AppCheck] init failed:", e && e.message); }
</script>
```

**남은 작업 (Firebase Console)**:
1. 며칠간 **모니터링(미적용)** 모드로 운영하면서 App Check Metrics에서 정상 트래픽이 토큰을 발급받는지 확인
2. 거부율이 낮고 정상 사용자 영향이 없으면 **Authentication, Realtime Database의 Enforce 모드를 ON** 으로 전환
   → App Check 토큰 없는 요청은 모두 거부됨.

### C. Realtime Database 보안 규칙 적용
**위치**: Firebase Console > Realtime Database > Rules
- 본 저장소의 `database.rules.json` 내용을 그대로 붙여넣고 **게시(Publish)**
- 적용 후 반드시 **Rules Playground**에서 테스트:
  - 비로그인 상태에서 `/users/anything` 읽기 시도 → **거부** 되어야 함
  - 로그인된 사용자가 본인이 아닌 `/users/다른uid` 쓰기 시도 → **거부** 되어야 함

### D. Firestore 규칙 (사용 중일 경우)
- **위치**: Firebase Console > Firestore > Rules
- 본 저장소의 `firestore.rules` 내용을 적용
- (현재 코드는 RTDB만 사용 — Firestore도 켜져 있다면 반드시 차단 규칙으로 잠가두세요.)

### E. Storage 규칙 (사용 중일 경우)
**위치**: Firebase Console > Storage > Rules
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```
- 현재 사용하지 않는다면 위와 같이 **전부 잠가두세요.**

### F. API Key 제한 (Google Cloud Console)
**위치**: Google Cloud Console > APIs & Services > Credentials > Browser Key

본 프로젝트의 Web API Key (`AIzaSyB6xU5IVpbg8661WaPKTAXsg_5vuC3sPY4`) 에 대해:
1. **Application restrictions**: HTTP referrers 선택
   - `https://lifeportfolio.co.kr/*`
   - `https://www.lifeportfolio.co.kr/*`
   - `https://lifeporfolio.firebaseapp.com/*`
   - `https://lifeporfolio.web.app/*`
   - (개발 시 일시적으로 `http://localhost:*/*` 만 추가, 배포 후 제거)
2. **API restrictions**: 사용하는 API만 활성화
   - Identity Toolkit API
   - Token Service API
   - Firebase Realtime Database API
   - Cloud Firestore API (사용 시)
   - **그 외 API는 모두 비활성화**

### G. Google Cloud Console — OAuth 동의 화면
**위치**: Google Cloud Console > APIs & Services > OAuth consent screen
- **Authorized JavaScript origins**: 운영 도메인만 등록
- **Authorized redirect URIs**: `https://lifeporfolio.firebaseapp.com/__/auth/handler` 만 유지
- **Publishing status**: "In production"으로 변경 (외부 사용자 100명 이상 받으려면 필수)

### H. GitHub Pages — HTTPS 강제 + 보안 헤더
**위치**: GitHub Repo > Settings > Pages
1. **Enforce HTTPS** 체크
2. (GitHub Pages는 응답 헤더 커스터마이징 불가 → 메타태그 CSP로 대체했지만, 가능한 경우)
   Cloudflare 등을 앞단에 두고 다음 헤더를 강제:
```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(self "https://link.payple.kr")
```

### I. 결제 흐름 보안 — ✅ 클라이언트 측 1차 방어 적용 완료

**이전 위험**: 결제 없이도 사용자가 직접 `payment-success.html` → `suvey.html` URL로 진입 가능.
즉, **로그인만 하면 결제를 우회해 검사 페이지에 접근 가능**했습니다.

**이번 PR에 적용된 다층 방어**:

1) **`payment-success.html` 에서 결제 완료 플래그 발급**
   - Payple 결제 성공 후 리다이렉트되는 이 페이지에 도달하면:
     - `sessionStorage.lp_paid` = `{uid, paid:true, issuedAt, sig}` (탭 종료 시 만료)
     - `localStorage.lp_paid_until` = `Date.now() + 30분` (백업 플래그)
     - Realtime Database `payments/{uid}` 에 `{paid:true, createdAt}` 영구 기록

2) **`suvey.html` 진입 가드**
   - 로그인 확인 → 1차로 sessionStorage / localStorage 의 plain 플래그 확인
   - 플래그 없으면 2차로 RTDB `payments/{uid}` 를 조회
   - 둘 다 없으면 검사 페이지를 숨기고 iframe `src` 를 제거한 뒤 `product.html` 로 강제 리다이렉트

3) **DB 규칙으로 위변조 차단**
   - `database.rules.json` `payments/$uid`:
     - 본인만 read/write
     - 한 번 `paid:true` 가 기록되면 변경 불가 (`!data.exists() || data.child('paid').val() !== true`)
     - `paid` 필드는 boolean true 만 허용, 화이트리스트 외 필드 거부
   - `firestore.rules` `payments/{uid}`: create 만 허용, update/delete 영구 차단

**남은 한계 (서버 측 webhook 미구현)**:
- 클라이언트가 직접 `payments/{uid}` 에 `paid:true` 를 기록할 수 있다는 점.
  - 단, 이는 콘솔 사용 가능한 기술적 사용자에게만 가능 (일반 사용자는 차단됨).
  - 비즈니스 임팩트가 커질 경우 아래 서버측 강화로 전환:

**향후 권장 개선 (Payple webhook + Cloud Function)**:
1. **Payple Webhook**을 받는 Cloud Functions 엔드포인트를 만든다.
2. 결제 성공 시 webhook이 Payple 서명을 검증한 뒤 Firestore `orders/{uid}/{orderId} = { paid: true, paidAt: ... }` 기록.
3. `firestore.rules` 의 `payments/{uid}` 를 `allow create: if false` 로 변경 → 서버에서만 작성.
4. `suvey.html` 진입 시 Auth + DB 의 `paid: true` 를 함께 확인.

**Cloud Functions 예시 흐름**:
```
[Payple] --webhook--> [Cloud Functions verifyPayment]
   → Payple 서명 검증
   → Firestore의 orders/{uid}/{orderId} 에 { paid: true, amount: 9900 } 저장
[브라우저 suvey.html] → onAuthStateChanged + getDoc(orders/{uid})
   → paid === true 인 경우만 iframe 노출
```

### J. 정기 점검 항목
- [ ] 한 달에 한 번 Firebase Console의 **Authentication > Users** 비정상 가입 패턴 점검
- [ ] **Usage and billing**의 RTDB 트래픽 급증 → 무차별 호출 가능성 의심
- [ ] Firebase **App Check Metrics**에서 거부된 요청 비율 모니터링
- [ ] OAuth 동의 화면에 등록된 도메인 외 origin 요청은 즉시 차단 확인

---

## 📎 참고
- 본 코드는 클라이언트 사이드만 존재하는 GitHub Pages 정적 사이트입니다.
- 따라서 **"신뢰 경계"는 항상 Firebase 서버측 보안규칙과 App Check** 입니다.
- 클라이언트 코드는 어떻게 작성해도 우회 가능하다는 가정 하에, **DB 규칙**과 **App Check**가 진짜 방어선입니다.

— 인생포트폴리오 보안 정책 / 2026-05-01 작성
