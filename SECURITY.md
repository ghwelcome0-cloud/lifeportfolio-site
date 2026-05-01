# 인생포트폴리오 보안 가이드 (LifePortfolio Security Guide)

> 본 문서는 화이트해커 관점에서 본 사이트의 보안 강화 작업을 정리한 문서입니다.
> 코드에 즉시 반영된 항목과, **Firebase Console / GitHub / 도메인 호스팅에서 직접 수동으로 해주셔야 하는 항목**으로 나뉘어 있습니다.

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

- ✅ `lifeportfolio.co.kr`, `lifeportfolio.firebaseapp.com` 만 남기세요.
- ❌ `localhost` 는 운영에서 **삭제** (개발 시에만 추가)
- 등록되지 않은 도메인에서는 로그인 자체가 불가능 → 피싱 사이트가 본 프로젝트의 API Key를 도용해도 인증 진행 불가.

### B. Firebase App Check 활성화 (CRITICAL) — ✅ 코드 적용 완료
**Firebase 웹 API Key는 공개되어도 안전하지만 — App Check 없이는 누구나 본 프로젝트의 백엔드(Auth/RTDB)를 직접 호출할 수 있습니다.**

**현재 상태**:
- ✅ Firebase Console > App Check > 웹앱 등록 완료 (reCAPTCHA Enterprise)
- ✅ 사이트 키: `6LccMdQsAAAAAEtUfNbMCvEyxVjOme3uZ31I8z01`
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
    provider: new ReCaptchaEnterpriseProvider("6LccMdQsAAAAAEtUfNbMCvEyxVjOme3uZ31I8z01"),
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
      new firebase.appCheck.ReCaptchaEnterpriseProvider("6LccMdQsAAAAAEtUfNbMCvEyxVjOme3uZ31I8z01"),
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
   - `https://lifeportfolio.firebaseapp.com/*`
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
- **Authorized redirect URIs**: `https://lifeportfolio.firebaseapp.com/__/auth/handler` 만 유지
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

### I. 결제 흐름 보안 (CRITICAL — 현재 가장 큰 비즈니스 리스크)

**현재 상태**: 결제 없이도 사용자가 직접 `payment-success.html` → `suvey.html` URL로 진입 가능.
즉, **로그인만 하면 결제를 우회해 검사 페이지에 접근 가능**합니다.

**권장 개선** (서버 검증이 필요):
1. **Payple Webhook**을 받는 백엔드(Cloud Functions for Firebase 권장)를 두세요.
2. 결제 성공 시 webhook이 Firestore/RTDB에 `orders/{uid}/{orderId} = { paid: true, paidAt: ... }` 기록.
3. `suvey.html` 진입 시 Auth + DB의 `paid: true` 를 함께 확인 → 결제 안 한 사용자는 차단.
4. 절대 클라이언트(브라우저)가 paid 플래그를 직접 쓰지 못하게 규칙에서 차단 (위 firestore.rules의 `orders` 규칙 참고).

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
