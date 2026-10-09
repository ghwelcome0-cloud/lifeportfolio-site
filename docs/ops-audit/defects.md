# 운영 점검 결함 목록 (defects) — 2026-10-08

판정 어휘: PASS / FAIL / NOT_RUN / BLOCKED / NOT_APPLICABLE. 원인은 `root_cause_status`로 확정/가설 구분. 수정·배포는 이번 범위 밖(승인 후).

| defect_id | priority | affected_lanes | reproducibility | customer_impact | expected_vs_actual | minimal_steps | root_cause_status | evidence | safe_workaround | proposed_fix_scope | regression_cases | approval_needed |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **DEF-001** | **P1**(이용 차단 — `www` 입력 사용자 한정) → 대표 판단에 따라 P2 | B2C-KO·B2C-EN·B2B-KO 전부(진입 지점) | 100% (curl 3회, 2026-10-08 20:5xZ) | `www.lifeportfolio.co.kr`를 입력하거나 `http://www.`로 들어온 사용자는 **브라우저 보안 경고(인증서 불일치)**로 사이트 진입 불가. 정식 도메인 `lifeportfolio.co.kr`·`lifeporfolio.web.app`는 정상 | 기대: `www` → 정식 도메인 301 또는 유효 인증서. 실제: `http://www.` → 301 → `https://www.` → TLS 인증서 `CN=firebaseapp.com`, SAN에 `www.lifeportfolio.co.kr` 없음 → 연결 실패 | `curl -sv https://www.lifeportfolio.co.kr/` → "subjectAltName does not match hostname" | **가설**: Firebase Hosting 커스텀 도메인에 `www` 서브도메인이 연결되지 않음(또는 DNS만 Firebase IP를 가리키고 Hosting 도메인 등록 없음). 확정은 Firebase 콘솔 Hosting 도메인 목록 확인 필요(BLOCKED: 콘솔 권한) | 소스 내 `www` 링크 0건(sitemap·robots·html·js) → 유입은 직접 입력뿐 | 정식 URL 안내(마케팅 자료에 `www` 미사용 유지) | 코드 변경 0. Firebase 콘솔에서 `www.lifeportfolio.co.kr` 커스텀 도메인 추가 + 정식 도메인으로 리디렉션 설정(운영 설정 변경) | 추가 후 `https://www.` 200/301·인증서 SAN 포함 재확인 | **예**(Firebase 콘솔 설정 변경 = 운영 변경) |
| OBS-001 | P3(잠정; EN 제공 약속 확인 후 P2 가능) | B2C-EN | 100% | EN 홈 문서의 언어 메타가 `ko` → 스크린리더 발음·브라우저 번역 제안·검색 언어 신호 오류. 이용 차단 아님 | 기대 `<html lang="en">` / 실제 `<html lang="ko" translate="no">` | `index-en.html` 1행 | **확정**(소스) | `git show origin/main:index-en.html \| head -1` | 없음(표시 문제) | `index-en.html` 1행 | i18n·hreflang 회귀 | 코드 수정 → 예 |

## OBS-002 · EN 사용자가 KO 전용 페이지로 연결되는 링크 (P2 후보, 확인 필요)
- 관찰: `report.html` L1888 `📖 Guide` → `report-guide`(i18n 없음, `<html lang="ko">`), `program.html` L1541 `📖 Guide` → `program-guide`(i18n 없음). `action-program`, `interpretation`, `regenerate`, `customer-journey`, `index-v2`도 i18n 미적용(KO 전용).
- 영향: EN 고객이 리포트/프로그램 화면에서 해설서를 누르면 한국어 페이지가 열림(기능 실패 아님, 언어 일관성 결함). 로그인 상태에서만 재현되므로 공개 레인에서는 소스 대조로만 확인 → 3단계(실계정) 때 재검증.
- 조치: 제품 코드 수정 없음(이번 범위 밖). 결정 필요: EN 해설서 제공 vs EN 화면에서 버튼 숨김.

## OBS-003 · GTM/GA 스크립트가 enforce CSP(script-src)에 차단됨 (P3 · 분석 전용)
- 관찰: `/product`(EN), `/product-v2` 에서 `googletagmanager.com/gtm.js`, `gtag/js` 가 enforce `script-src` 위반으로 차단(콘솔 에러 2건/페이지). 서비스 기능·결제와 무관(하네스는 INFO 분류).
- 영향: 해당 페이지 분석 데이터 누락(전환 측정 공백). 보안상으로는 더 안전한 방향.
- 조치: 분석을 원하면 CSP script-src 에 GTM 도메인 추가 결정 필요(헤더 변경 = 배포 승인 대상).

## OBS-004 · 모바일 보조 링크 터치 타깃 <32px (P3 · 55건 관찰)
- 관찰: 헤더 `KO|EN` 토글(36×28), `Login(31×23)`, 푸터 약관/개인정보/문의(23×25 등), `자세히/Details(39×19)` 등. 주 CTA(결제·제출·로그인 버튼)는 모두 기준 통과(`small_cta_targets=0`).
- 조치: 디자인 개선 후보. 기존 `test:touch` 게이트는 주 CTA 기준이므로 통과 상태와 모순 없음.

## 설계 의도로 확인(결함 아님)
- KO `/product` → `/product-v2` 즉시 리다이렉트(product.html L5~31 "결제 페이지 일원화 가드"). EN 은 `/product` 유지(PayPal).
- 비로그인 `/product(-v2)` 결제 버튼 잠금 + "로그인 하기" 안내(설계).
- `/checkin-21-chat(-en)` 서명 파라미터 없는 직접 접근 → `.link-error` 카드 + 의도적 throw(설계).
- `/report-landing` → `/#cover` 리다이렉트(설계).
- 미공개 12 페이지(admin·b2b-admin·review-admin·checkin-admin·auth-debug·lead·utm-builder·pdf-sign·lease-esign·_b6/_b8_preview·pdf-sign-share) 모두 404 — P0 노출 없음.

## 격리 레인(에뮬레이터) 실측 결과 · 2026-10-08 (`evidence/2026-10-08-isolated/`)
- `test:b2b:emulator` 197 PASS / 0 FAIL (실제 B2B 핸들러 + 로컬 Firestore/RTDB).
- `rtdb-boundary-probe` 16/17 기대 일치: 타인 읽기/쓰기 거부, 비로그인 거부, 미결제 세션 생성 거부, 결제자 세션/리포트 생성·재열람 허용, b2b_access/additionalPayments 클라이언트 쓰기 거부, 미정의 키 거부 — **타인 정보·권리 보호 경계 모두 작동**.

## DEF-002 · `payments/{uid}` 최초 1회 `paid:true` 클라이언트 자가 기록 가능 (P2 · 기존 문서 `보안규칙_판정_2026-08-28.md`에서 이미 식별된 "남는 실제 위험")
- 실측: 결제 기록이 없는 uid 가 본인 토큰으로 `PUT /payments/{uid} {paid:true,createdAt}` → **200 허용**(에뮬레이터, 운영 규칙 원문). 이후 해당 uid 는 `responses/{uid}/{sid}`·`reports/{uid}/{sid}` 생성이 규칙상 허용됨(실측 200).
- 완화 요인: Payple 첫 결제가 `payment-success.html`에서 클라이언트 기록하는 구조라 규칙을 서버 전용으로 바로 바꾸면 **결제가 멈춤**(2026-08-28 판정서 선행조건 동일). 리포트 생성 자체는 클라이언트 엔진이라 서버 재대조가 모든 경로에 있지는 않음 → "무료 이용" 가능성은 0 이 아님(의도적 조작 필요, 일반 고객 영향 없음).
- 권고(별도 PR, 결제 경로 변경이므로 2단계 승인 필요): ① `product-v2` 가 A2(`confirmPayplePayment` 서버 승인)로 이미 전환되었으므로 `payment-success.html` 의 클라이언트 `paid:true` 기록 경로가 아직 실사용인지 로그로 확인 → ② 미사용 확인 시 `payments/$uid/.write` 를 `_pending` 만 허용으로 축소 + 에뮬레이터 양성/음성 대조 → ③ 배포.

## OBS-005 · `scripts/gates/rules_guard_gate.mjs` 양성 케이스 2건이 현행 규칙과 어긋남 (P3 · 테스트 자산 노후)
- `users 정상키만`·`reports 정상키만` 양성이 401: 현행 규칙은 `users/$uid` 루트 쓰기에 신선 토큰(auth_time ≤5분)+신규 조건, `reports/$uid/$sid` 는 `payments.paid===true` 선행을 요구(PR#325 이후). 게이트의 토큰에는 `auth_time` 이 없고 결제 선행 시드가 없음 → 거짓 빨간불. CI 는 `--self-test` 만 돌려서 드러나지 않았음.
- 권고: 게이트 토큰에 `token.auth_time` 추가 + payments 시드 후 양성 검증(테스트 전용 변경, 제품 무영향). 이번 `rtdb-boundary-probe.mjs` 가 그 패턴을 구현해 두었음.


## DEF-001 갱신 (2026-10-08 23:10Z) · 대표 콘솔 조치 후 재측정
- 대표가 Firebase 콘솔에서 `www.lifeportfolio.co.kr` 커스텀 도메인 추가(→ `lifeportfolio.co.kr` 리다이렉트) 완료. 재측정: **인증서 발급 완료**(`CN=www.lifeportfolio.co.kr`, 이전의 `firebaseapp.com` 불일치 해소). `http://www` → 301 `https://www` 정상.
- 남은 증상: `https://www.lifeportfolio.co.kr/` → **404 "Site Not Found"**(Firebase 기본 페이지). 원인: 가비아 DNS `www` CNAME 값이 `lifepotfolio.web.app`(r 없음, 대표 확인: 의도적으로 유지하기로 한 값). Firebase 호스팅은 CNAME 대상 호스트명으로 사이트를 찾는데 `lifepotfolio` 사이트는 존재하지 않아(해당 호스트 자체가 404) 리다이렉트 설정에 도달하지 못함. 콘솔 팝업의 "ACME 404" 경고도 같은 원인.
- 결론: 코드로 해결 불가. 선택지는 둘 중 하나 —
  (a) 가비아 `www` CNAME 값을 `lifeporfolio.web.app`(실제 사이트)로 변경 → 즉시 301 동작(권장, 1분).
  (b) 현재 값을 유지하면 `www.` 주소는 계속 "Site Not Found". 사이트 내부 링크에 `www`는 0건이므로 **직접 타이핑 사용자만 영향(P2→P3)**. 이 경우 DEF-001은 "수용된 제한"으로 기록.
- 대표 결정 대기. 결정 전까지 상태 = OPEN(수용 여부 미정).


## 종결 기록 (2026-10-08 23:50Z)
- **DEF-001**: 대표 결정 — 가비아 `www` CNAME 값 현행 유지. **수용된 제한(ACCEPTED)**. 인증서 발급 완료, `https://www.` 는 "Site Not Found"(직접 타이핑 사용자만). 내부 링크 0건.
- **DEF-002**: PR #360 머지 + **RTDB 규칙 운영 배포 완료**(run 37859702008, sha256 93c1c7c2…). 운영 확인: 비로그인 `PUT /payments` 401. 호스팅(payment-success 변경)은 Promote 대기 → 완료 시 CLOSED.
- **OBS-005**: #360 동봉, 규칙 게이트 양성 3/3·음성 10/10.
- **OBS-006**: PR #361(서버 callable `anonymizeMyPaymentOnWithdraw` + mypage 위임, 에뮬레이터 8/8). Functions 배포 후 CLOSED.
- **OBS-001·002·003**: PR #358 머지 대기(CI strict 재실행) → Promote.
- **OBS-004**: 디자인 백로그 이관.


## DEF-001 — **CLOSED** (2026-10-09 00:31Z)
- 대표가 가비아 `www` CNAME 값을 `lifeporfolio.web.app`으로 수정(00:13Z 저장) → 00:26Z `www` 활성. 직후 Firebase가 양방향 리디렉션(apex→www, www→apex) 루프를 만들어 약 4분간 사이트 접속 불가(00:26~00:30Z) → 대표가 콘솔에서 apex 리디렉션 해제 → 00:30Z 복구.
- 최종 상태: `lifeportfolio.co.kr` 200 · `www.lifeportfolio.co.kr` 301 → apex · 인증서 정상.
- 교훈(플레이북 반영): Firebase에 `www` 추가 시 "리디렉션" 옵션을 켜면 **apex 쪽 기존 리디렉션 설정을 반드시 확인**. 두 도메인 중 하나만 리디렉션이어야 함. 전환 직후 10초 간격 감시로 루프를 즉시 탐지한 것이 피해를 4분으로 제한.

## 도메인 자산 (2026-10-09)
- 서브도메인: `www`(→apex 301) · `admin`(CNAME `lifeporfolio-admin.web.app`, Auth 승인 도메인·API 키 리퍼러 허용목록 등록 완료, 연결 전파 대기). `api.`·기타 서브도메인은 불필요로 판단(제품 참조 0건).
- 신규 등록 결정: `lifeportfolio.app`(모바일 앱) · `lifeportfolio.ai`(AX 동행자 플랫폼). `.io`/`.co`는 보류(비용 절감), `.com`은 타인 보유(HugeDomains $17,495) — 글로벌 매출 후 협상.


## 최종 종결 (2026-10-09 01:15Z)
| ID | 상태 | 근거 |
|---|---|---|
| DEF-001 www | CLOSED | www 301→apex 200, 인증서 정상 |
| DEF-002 payments 자가기록 | CLOSED | 규칙 배포(401 실측) + 호스팅 Promote(payment-success 서버확인 로직 운영 반영, fixverify 10/10) |
| OBS-001/002/003 | CLOSED | 운영 fixverify 10/10 PASS |
| OBS-005 규칙 게이트 | CLOSED | 양성 3/3·음성 10/10 |
| OBS-006 탈퇴 익명화 | CLOSED | Functions 배포 + Cloud Run 공개 액세스(대표 콘솔) → 비로그인 401 "로그인이 필요합니다"(함수 도달·검증 작동) |
| OBS-004 터치 타깃 | BACKLOG | 디자인 |
| admin.lifeportfolio.co.kr | DONE | 200, Auth/API 키 허용목록 등록 |
| lifeportfolio.app | 등록 완료 | 앱 출시 시 연결 |
- 남은 BLOCKED 6건(실계정·실결제·B2B 실주문·admin 실로그인·실기기·OS PDF)은 시험 계정/한도 승인 시 즉시 실시.
- 알려진 운영 메모: 신규 Functions 배포 후 Cloud Run "공개 액세스 허용" 수동 1회 필요(README 기존 기록과 동일). `sendpolicynotice`는 아직 403 — 다음 공지 발송 전 동일 조치.
