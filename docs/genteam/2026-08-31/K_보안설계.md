# 발주 K — ⑦축 보안 취약성 81→90 설계·판정

작성일: 2026-08-31  
범위: 설계·판정만 수행. `firebase.json`, `firestore.rules`, `scripts/build-hosting.mjs`, `scripts/hosting-allowlist.mjs` 및 애플리케이션 코드는 변경하지 않음.

## 0. 확인 범위와 제한

### 확인

- 원격 작업 브랜치에서 확인 가능한 최근 보안 게이트 기준 head: `f86d316e9f31ca8da3968fea033c13acd27b29e7`.
- `firebase.json`의 public Hosting에는 partial enforcing CSP와 full Report-Only CSP가 함께 있음.
- `index.html`에는 별도의 enforcing meta CSP가 있음.
- `firestore.rules`는 302행이며 default deny와 명시적 허용 규칙을 함께 사용함.
- root `package.json`은 runtime `dependencies`가 없고 devDependencies만 있음. `functions/package.json`에는 별도의 runtime dependencies가 있음.
- 이전 동일-head 실측에서 root `npm audit`은 high 4 / moderate 6 / critical 0, `npm audit --omit=dev`는 0건이었음.

### 미확인

- GitHub Dependabot high 1 / moderate 1의 advisory ID, package, manifest path, dependency scope.
- 2026-08-31 실제 배포 head와 위 소스 head의 일치.
- 운영 브라우저의 실제 CSP 위반 원문 및 외부 도메인별 최근 사용량.
- Firestore Rules Emulator 전체 정상·공격 matrix.
- Cloud Functions 별도 lockfile에 대한 현재 audit 결과.

## 1. 81점에서 빠진 9점의 구성

현재 자체 채점식은 다음으로 주어졌다.

| 항목 | 가중치 | 현재 등급 | 현재 환산점 | 5점 대비 격차 |
|---|---:|---:|---:|---:|
| 1 전송·헤더 | 20% | 5 | 20 | 0 |
| 2 의존성 | 20% | 3 | 12 | 8 |
| 3 접근 통제 | 20% | 4 | 16 | 4 |
| 4 비밀정보 | 15% | 4 | 12 | 3 |
| 5 공개 표면 | 15% | 5 | 15 | 0 |
| 6 CSP 관측 | 10% | 3 | 6 | 4 |
| 합계 | 100% | — | 81 | 19 |

계산식: `등급 / 5 × 가중치`.

### 판정

정확히 90에 도달하는 내부 기준은 제공된 기준서에 없음. 아래는 **외부 일반 기준 기반 추정**이다.

가장 방어 가능한 9점 구성은 다음이다.

1. 의존성 3→4.5: **+6점**
   - runtime 직접 노출 0을 재현 증빙하고, build 공급망 high를 제거하며, 잔여 moderate를 사용 경로·기한과 함께 triage.
2. CSP 관측 3→4.5: **+3점**
   - canary로 수집 생존을 증명하고 정기 review receipt를 누적하되, enforcing은 하지 않음.

합계 90점. 다만 0.5 등급을 허용한다는 내부 규칙은 **미확인**이다. 정수 등급만 허용하면 현실적인 다음 상태는:

- 의존성 3→5: +8
- CSP 관측 3→4: +2
- 총 91점

또는:

- 의존성 3→4: +4
- 접근 통제 4→5: +4
- CSP 관측 3→4: +2
- 총 91점

보안 점수는 산술 목표에 맞춰 반올림하지 말고 증빙 단위로 승격해야 한다. OWASP ASVS처럼 control별 확인 결과를 남기고, SLSA처럼 build integrity와 provenance를 별도로 증명하는 방식이 적절하다.

근거:

- SLSA v1.2 Supply Chain Threats: source뿐 아니라 dependencies·build recipe·artifact의 무결성을 공급망 범위로 다룸. https://slsa.dev/spec/v1.2/threats-overview
- NIST SP 800-218 SSDF: PW.4 third-party component 관리, RV.1/RV.2 취약점 식별·분석·교정. https://doi.org/10.6028/NIST.SP.800-218
- OWASP A06:2021 Vulnerable and Outdated Components: direct/transitive component inventory와 지속적 취약점 관리. https://owasp.org/Top10/2021/A06_2021-Vulnerable_and_Outdated_Components/

## 2. `index.html` inline CSP 외부 도메인 판정

### 위험 판정

긴 allowlist 자체가 곧 취약점은 아니다. 그러나 `script-src`에 `'unsafe-inline'`이 있고 여러 third-party script origin이 허용된 조합은 위험을 키운다. 허용된 origin 중 하나가 침해되거나 경로 선택이 느슨하면 해당 origin의 스크립트가 페이지 권한으로 실행될 수 있다.

HTTP header CSP와 meta CSP가 동시에 있으면 브라우저는 두 정책을 모두 적용하며 대체로 교집합처럼 더 제한적인 결과가 된다. 하지만 현재 header enforcing 정책은 `script-src`를 정의하지 않는 partial 정책이므로 script 통제의 실질 부담은 meta CSP에 있다. Report-Only는 차단하지 않는다.

아래 표는 `index.html` 원문 사용처와 Firebase/인증 구조를 대조한 판정이다. “제거 가능”은 즉시 삭제 승인이 아니라, synthetic preview에서 제거한 정책의 음성·정상 검증을 통과할 후보라는 뜻이다.

| 도메인/그룹 | 판정 | 확인 근거 | 제거 시 예상 파손 |
|---|---|---|---|
| `www.gstatic.com` | 필수 | Firebase SDK 모듈 import가 index에 존재 | Auth/RTDB/App Check 초기화 실패 가능 |
| `*.googleapis.com`, `identitytoolkit.googleapis.com`, `securetoken.googleapis.com` | 필수 | Firebase Auth/Firestore/API 호출 경로 | 로그인·토큰 갱신·데이터 API 실패 |
| `*.firebaseio.com`, `*.firebasedatabase.app`, `wss://...` | 필수 | RTDB endpoint가 index에 직접 존재 | RTDB 읽기/실시간 연결 실패 |
| `*.firebaseapp.com`, `accounts.google.com` | 필수 | Firebase Auth popup/handler 구조 | Google/Kakao OAuth popup/redirect 실패 가능 |
| `firebaseappcheck.googleapis.com`, `content-firebaseappcheck.googleapis.com` | 필수(사용 시) | App Check 코드·정책에 포함 | App Check token 교환 실패 |
| `www.google.com`, `www.recaptcha.net`, `recaptcha.google.com` | 필수(현재 Auth/App Check 흐름) | prefetch 및 reCAPTCHA 허용 경로 | bot protection/Auth challenge 실패 가능 |
| `www.googletagmanager.com`, `www.google-analytics.com`, `*.analytics.google.com` | 대체 가능 | index에 GTM/GA lazy load 코드 존재 | analytics·conversion 계측 누락; 핵심 진단 기능은 유지될 가능성 높음 |
| `stats.g.doubleclick.net`, `td.doubleclick.net` | 대체 가능 | GA/GTM 연동 목적 allowlist로 보임 | attribution/광고 연동 일부 누락 가능 |
| `www.googleadservices.com`, `googleads.g.doubleclick.net`, `pagead2.googlesyndication.com` | 제거 가능 후보 | index의 meta CSP 밖 직접 fetch/script 사용을 확인하지 못함. GTM container가 동적 호출할 가능성은 미확인 | 광고 conversion/tag가 실제 구성돼 있으면 계측 손실 |
| `cdn.jsdelivr.net` | 제거 가능 후보(index) / 다른 지면은 필수 후보 | index에서는 preconnect와 CSP 외 직접 asset 사용을 확인하지 못함. report/program/PDF 도구에서는 실제 fallback 사용 | index는 영향 없을 가능성; 전역 정책에서 제거하면 PDF 생성·web-vitals fallback 파손 |
| `cdnjs.cloudflare.com` | 제거 가능 후보(index) / report·program은 필수 후보 | index에서 직접 asset 사용 미확인. report/program은 jsPDF/html2canvas를 실제 load | 전역 제거 시 PDF 생성 실패 가능 |
| `unpkg.com` | 제거 가능 후보(index) / report·program fallback | index 직접 사용 미확인. web-vitals 및 PDF library fallback 경로 존재 | 전역 제거 시 CDN 장애 때 fallback 소실 |
| `fonts.googleapis.com`, `fonts.gstatic.com` | 제거 가능 후보(index) | index는 Pretendard를 local hosting한다고 명시하지만 dns-prefetch가 남아 있음 | 외부 Google Font가 실제 동적 사용되면 폰트 fallback; network trace 필요 |
| `apis.google.com` | 대체 가능/제거 후보 | CSP에는 있으나 index 직접 script ref는 확인 못함; Auth SDK 내부 의존 가능성 미확인 | 구형 Google auth 연동이 남아 있으면 로그인 실패 |
| `ajax.googleapis.com` | 제거 가능(index) / Payple 지면 필수 | index 직접 사용 없음. `product-v2.html`은 jQuery를 실제 load | 전역 제거 시 Payple 결제 페이지 실패 |
| `cdn.tailwindcss.com` | 제거 가능(index) / Payple 지면 필수 | index 직접 사용 없음. `product-v2.html`은 실제 load | 전역 제거 시 Payple 화면 스타일 파손 |
| Payple 도메인군 | index에서는 제거 후보, 결제 지면 필수 | index 직접 결제 SDK 사용 없음; product-v2에서 실제 사용 | 전역 제거 시 국내 결제 실패 |
| PayPal 도메인군 | index에서는 제거 후보, 영문 결제 지면 필수 | product.html 및 결제 API 흐름 | 전역 제거 시 PayPal 버튼·결제 실패 |
| `script.google.com`, `script.googleusercontent.com` | 제거 가능 후보 | index 직접 사용 미확인; survey 등 다른 흐름 가능 | 설문/외부 스크립트 연동이 실제 있으면 실패 |

핵심 결론: **페이지별 CSP 분리**가 먼저다. public 전체 공용 정책에서 origin을 한꺼번에 지우지 말고 `index`, Auth, report/program, Payple, PayPal의 실제 네트워크 trace를 각각 수집해 route별 최소 allowlist를 만든다.

추가 위험:

- `img-src https:`는 모든 HTTPS image origin을 허용하므로 image 기반 추적·정보 유출 범위를 넓힌다.
- `'unsafe-inline'`은 inline script/style이 많아 현재 제거 파손 위험이 큼.
- public Report-Only에는 `'unsafe-eval'`도 있어 실제 사용 여부를 별도 측정해야 함.
- CDN script에 SRI가 없거나 self-hosting이 불가능하면 공급망 위험이 남음.

## 3. Firestore Rules 302행 감사 체크리스트

### 일반 체크리스트

1. 기본 deny가 모든 미명시 경로를 막는가.
2. 각 collection의 read/get/list를 분리했는가. 단건 read는 필요하지만 list는 과도하게 열리지 않았는가.
3. create/update/delete를 분리하고 필요한 operation만 허용하는가.
4. `request.auth != null`, UID ownership, tenant/org membership을 모두 검증하는가.
5. `resource.data`와 `request.resource.data`를 올바르게 구분하는가.
6. immutable field의 변경을 금지하는가.
7. `keys().hasOnly()`와 필수 key 검사로 추가 field를 막는가.
8. 문자열 길이, enum, 숫자 범위, timestamp type, 배열/map 크기를 제한하는가.
9. 결제·권한·상태 전이는 client write가 아니라 server-only인가.
10. admin custom claim은 boolean exact 비교인가. 회수 지연을 고려한 authoritative state가 있는가.
11. cross-user·cross-org·IDOR가 차단되는가.
12. query가 Rules 조건을 만족하도록 제한되며 broad list가 불가능한가.
13. batch/transaction에서 각 문서와 전후 상태가 검증되는가.
14. 삭제가 허용되면 보존·감사·법률 요건과 충돌하지 않는가.
15. Admin SDK가 Rules를 우회한다는 사실을 Functions IAM·코드에서 별도 통제하는가.
16. Emulator에서 unauthenticated, wrong UID, forged claim, extra field, oversized payload, illegal state transition, list/query, delete를 모두 음성 검증하는가.
17. 배포된 Rules와 repo exact SHA를 비교하는가.

### 이 구조에서 특히 위험한 지점

- `payments/{uid}`는 “서버 전용” 주석과 달리 client create를 허용하며 `paid == true`를 유효값으로 받음. 사용 여부를 먼저 확인해야 하지만 trust boundary 불일치다.
- `users/{uid}`는 email/displayName 등의 owner write를 허용한다. Auth의 검증 이메일과 profile email을 혼동하는 소비자가 없는지 확인해야 한다.
- `b2b_orders`/`b2b_codes`는 custom claim 하나로 read를 허용한다. claim 회수 지연과 list 범위를 검증해야 한다.
- `orders`/`reports`는 `resource.data.uid` 소유권 read다. 누락·타입 오류 문서와 query behavior를 테스트해야 한다.
- server-only collection은 Rules가 안전해도 Admin SDK 호출 함수의 인증·인가·rate limit이 별도 공격면이다.
- `csp_reports`에는 full URL, UA, IP, sample이 들어갈 수 있으므로 TTL 활성 상태와 운영자 최소권한을 확인해야 한다.

현재 Rules는 default deny와 다수 server-only collection 측면에서는 양호하지만, 전체 최소권한 준수 판정은 **조건부 미충족**이다. Rules Emulator 증빙이 없으므로 5점 근거로 쓸 수 없다.

## 4. Enforcing 전환 없이 올릴 수 있는 방법

| 방법 | 효과 추정 | 파손 위험 | 되돌리기 난이도 |
|---|---|---|---|
| CSP browser→collector synthetic canary + 일일 health | 높음: 0건 거짓 초록불 제거 | 낮음 | 낮음 |
| 주간 CSP review receipt와 배포 후 24시간 review | 중~높음: 운영 증빙 생성 | 낮음 | 낮음 |
| route별 Report-Only allowlist 분리 | 높음: 불필요 origin 식별 | 중간: 보고 노이즈/정책 관리 복잡도 | 낮음 |
| CDN asset self-hosting + exact hash/SRI inventory | 높음: third-party supply-chain 축소 | 중간: update·cache·license 관리 | 중간 |
| `img-src https:`를 관측 정책에서 origin allowlist로 축소 | 중간 | 중간: 이미지 파손 | 낮음 |
| `'unsafe-eval'` 실제 사용 0 증빙 후 Report-Only 제거 실험 | 중~높음 | 중간 | 낮음 |
| inline script inventory와 nonce/hash 전환 설계 | 높음 | 높음: 다수 inline 코드 파손 | 높음 |
| root와 Functions SBOM/audit 분리, high SLA | 높음 | 낮음 | 낮음 |
| GitHub Actions exact SHA, WIF, 최소권한, build provenance | 높음 | 중간: 배포 workflow 영향 | 중간 |
| Rules Emulator 공격 matrix와 deployed-rules fingerprint | 높음 | 낮음(검사만) | 낮음 |
| Firestore/RTDB access log·alert·budget/abuse monitoring | 중간 | 낮음 | 낮음 |
| App Check enforcement 전 preview 관측 | 중간~높음 | 높음: 구형 client 차단 가능 | 중간 |

점수 상승 우선순위는 `CSP canary+review`, `dependency/runtime 분리 증빙`, `Rules Emulator`, `supply-chain provenance`다. 기능 정책을 즉시 강화하는 것보다 관측·증빙부터 닫는 편이 파손 위험이 낮다.

## 5. Dependabot high 1 런타임 도달성 판정 절차

1. Alert 원문에서 advisory ID, package, manifest path, dependency scope, vulnerable range, fixed version을 확보한다.
2. root와 `functions/` manifest를 분리한다.
   - root devDependency면 Hosting bundle/CI/build tool 경로.
   - `functions/package-lock.json` runtime dependency면 deployed Functions 경로.
3. `npm explain <package>`와 lockfile ancestry로 direct/transitive path를 고정한다.
4. `npm audit --omit=dev --json`을 root와 Functions 각각 실행한다.
5. Hosting build manifest와 `dist/hosting`에서 package 코드가 포함되는지 hash/경로로 확인한다.
6. Functions bundle/deployment manifest에서 package가 포함되는지 확인한다.
7. 취약 API가 실제 호출되는지 import/call graph와 runtime trace로 확인한다.
8. 공격 전제(외부 입력, 권한, 네트워크 도달, 사용자 상호작용)가 서비스 흐름에 존재하는지 판정한다.
9. 결함 삽입 fixture에서 scanner가 alert를 내고 fixed lockfile에서 사라지는지 음성/양성 통제를 한다.
10. 결과를 `runtime_reachable | build_only | unreachable_in_current_usage | unverified`로 기록한다.

현재 제공된 high 1은 package/advisory가 없어 **미확인**이다. 과거 npm audit high 4는 Puppeteer dev chain이었지만 Dependabot high 1과 같다고 간주하면 안 된다.

## 6. 반대 의견 — 오히려 서비스를 깨뜨릴 위험이 큰 조치

1. **CSP allowlist 일괄 삭제:** Auth, App Check, RTDB, Payple/PayPal, PDF 생성, analytics를 동시에 깨뜨릴 수 있다.
2. **`unsafe-inline` 즉시 제거:** inline script가 많은 현 구조에서 nonce/hash migration 없이 시행하면 핵심 화면이 중단된다.
3. **COOP 즉시 강화:** OAuth/결제 popup의 opener 통신을 깨뜨릴 수 있다.
4. **App Check 즉시 enforce:** 등록·토큰·구형 브라우저 검증 없이 켜면 정상 고객을 차단할 수 있다.
5. **Rules 일괄 deny:** 현재 client write 호출 inventory 없이 닫으면 설문 저장·리포트·결제 상태 흐름이 중단될 수 있다.
6. **Dependabot 자동 major merge:** high를 없애더라도 Puppeteer 기반 접근성/PDF 테스트를 깨뜨려 다른 gate를 무효화할 수 있다.
7. **CSP 0건을 청정으로 채점:** collector 장애나 브라우저 미전송을 보안 개선으로 오판한다.

## 7. 90점 도달 권고 순서

1. 내부 rubric에 runtime와 build supply-chain subscore를 명문화.
2. Dependabot alert tuple을 확보해 root/Functions 도달성을 판정.
3. ⑥축 Puppeteer baseline 완료 후 dependency-only upgrade와 동일 fixture A/B.
4. CSP synthetic canary와 `docs/csp-report-review-log.md` 첫 receipt 작성.
5. route별 실제 network inventory로 Report-Only allowlist 후보를 좁힘.
6. Rules Emulator 정상·공격 matrix와 deployed Rules fingerprint 생성.
7. 위 증빙이 닫힌 항목만 재채점.

현재 81점에서 즉시 90점으로 올릴 근거는 없다. 위 순서 중 의존성 high 제거·회귀 PASS와 CSP canary·주기 review가 닫히면 90점 이상 재판정이 가능하다.

## 8. 자기 반박

1. 도메인 판정은 source 사용처 중심이며 GTM container의 동적 요청과 실제 운영 network trace는 미확인이다. “제거 가능 후보”가 실제로는 conversion을 깨뜨릴 수 있다.
2. Rules 위험은 허용식이 만드는 가능성을 판정한 것이며 실제 악용이나 호출을 확인한 것은 아니다.
3. 점수 90 구성은 내부 0.5점 허용 여부가 없어 외부 일반 기준 기반 추정이다.
4. CSP canary 한 건은 전체 브라우저·확장·지역의 전달률을 보장하지 않는다.
5. self-hosting은 third-party runtime 위험을 줄이지만 업데이트 책임과 취약 version 고착 위험을 내부로 옮긴다.
