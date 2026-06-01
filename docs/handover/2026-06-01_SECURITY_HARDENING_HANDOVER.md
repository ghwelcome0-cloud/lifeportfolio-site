# 📋 인수인계서: 보안 강화 시리즈 (PR #147 → #148 → #149) 완료 및 후속 작업

> **작성일**: 2026-06-01
> **이전 세션 모델**: Claude Opus 4.8 (GenSpark AI Developer)
> **수신 모델**: Claude Opus 4.8 (GenSpark AI Developer) — 동일 모델 새 세션
> **프로젝트**: `lifeportfolio.co.kr` (Firebase Hosting + Cloud Functions)
> **저장소**: `https://github.com/ghwelcome0-cloud/lifeportfolio-site`
> **사용자**: `ghwelcome0@gmail.com`

---

## 🎯 한 줄 요약

**securityheaders.com 등급 A+ 달성 + CSP 위반 자동 수집 파이프라인 + Firestore TTL 자동 삭제까지 완전 자동화된 엔터프라이즈급 보안 시스템 구축 완료.** 사용자가 다음 단계 작업을 새 세션에서 이어갈 수 있도록 컨텍스트 인수인계.

---

## 📊 완료된 작업 (3개 PR 시리즈)

### **PR #147** — CSP Report-Only + 보안 헤더 + Rate Limit 인프라
- **상태**: ✅ 머지+배포 완료 (commit `d07e39f`)
- **핵심 변경**:
  - `firebase.json`: CSP Report-Only, Enforced, Reporting-Endpoints, 6종 보안 헤더
  - `functions/index.js`: `cspReport` onRequest 함수 신규 생성
  - `functions/_rate_limit.js`: `checkCallableRateLimit` helper 신규
  - `functions/_b2b_group_module.js`: B2B 함수 4개에 rate limit 적용
  - `firestore.rules`: `csp_reports`, `csp_report_counters`, `rate_limits` 컬렉션 server-only deny rule
  - Pretendard 폰트 로컬 호스팅 (`assets/fonts/pretendard/`)

### **PR #148** — cspReport HTTP 500 → 204 (defensive patterns)
- **상태**: ✅ 머지+배포 완료 (commit `805934f`, `369967a`)
- **문제**: PR #147 배포 후 `curl -X POST` 시 HTTP 500 계속 발생
- **원인 4가지** (코드 리뷰로 식별):
  1. CORS 헤더 설정이 try 블록 바깥에 있어서 throw 시 응답 못 보냄
  2. `csp_report_counters` 카운터 race condition (get → set 패턴)
  3. `ERR_HTTP_HEADERS_SENT` 가능성 (이중 `res.send()`)
  4. Outer catch가 응답 안 보내고 throw만 함
- **해결**:
  - `safeSend()` helper 추가 (`!res.headersSent` 체크)
  - 다층 try/catch (outer + per-block inner)
  - **Fire-and-forget 패턴**: 브라우저에 즉시 204 응답 → 그 다음 Firestore 쓰기
  - Race condition 제거 (`FieldValue.increment(1)` 사용)
  - Stack trace 로깅 (`logger.error`에 `error.stack` 포함)
- **추가 작업**:
  - `lead.html` 상단에 23줄 운영 상태 코멘트 추가 (외부 차단 4중 안전망 명시)
  - `functions/index.js` `submitLeadCapture` 위에 동일 코멘트 추가
- **검증**:
  - `node functions/test_csp_report.js` (mock 기반): **12/12 PASS** (테스트 파일은 머지 전 삭제)
  - PowerShell `curl.exe`로 실제 호출: **HTTP 204 ✅**

### **PR #149** — / 라우트 Permissions-Policy 추가 (A → A+)
- **상태**: ✅ 머지+배포 완료
- **문제**: securityheaders.com 스캔 결과 A 등급, `Permissions-Policy` 만 Missing
- **원인**: `firebase.json` 의 `/` (루트) 블록만 헤더 누락. 다른 블록(`**/*.@(html|htm)`, `/@(index|login|...)`)에는 이미 있었으나 securityheaders.com이 `https://lifeportfolio.co.kr/` 스캔 시 `/` 블록에 우선 매치됨
- **해결**: `firebase.json` line 75-78에 4줄 추가, 다른 블록과 100% 동일한 값 사용
- **검증**: securityheaders.com 스캔 결과 **A+ 등급 + "Wow, amazing grade!"** ✅

---

## 🏗️ 현재 구축된 보안 아키텍처 (5계층)

```
Layer 1: 브라우저 정책 (Browser Policies)
  - Content-Security-Policy (Enforced): frame-ancestors, object-src, base-uri, form-action
  - Content-Security-Policy-Report-Only: 전체 directive 모니터링용
  - Permissions-Policy: camera/microphone/geolocation/usb/sensors 모두 차단, payment만 self+PayPal/Payple
  - Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  - X-Frame-Options: DENY
  - X-Content-Type-Options: nosniff
  - Referrer-Policy: strict-origin-when-cross-origin

Layer 2: CSP 위반 수집 (cspReport Cloud Function)
  - region: asia-northeast3
  - invoker: public (App Check 면제, 브라우저 익명 POST 허용)
  - HTTP 204 응답 (safeSend + multi try/catch)
  - Rate limit: 3/min, 10/hr per (IP+UA)
  - Fire-and-forget 패턴

Layer 3: 프라이버시 보호 (Anonymization)
  - IP → sigHash (SHA-256 해시, salt 사용)
  - User-Agent → uaShort (12자 truncate)
  - raw IP/UA는 절대 저장 안 됨

Layer 4: Firestore 저장 + 보안 룰
  - 컬렉션 3개: csp_reports, csp_report_counters, rate_limits
  - Firestore Rules: 클라이언트 read/write 전부 deny (서버 전용)
  - 위치: asia-northeast3

Layer 5: 자동 데이터 라이프사이클 (TTL Policy)
  - csp_reports + expireAt → 7일 후 자동 삭제
  - csp_report_counters + expireAt → 7일 후 자동 삭제
  - rate_limits + expireAt → 자동 정리
  - 모두 "Serving" 상태 확인됨 (2026-06-01)
```

---

## 📁 변경된 파일 전체 목록

### **Cloud Functions** (`/home/user/webapp/functions/`)
| 파일 | 변경 사항 | PR |
|---|---|---|
| `index.js` | `cspReport` 함수 신규 생성, 이후 defensive patterns로 재작성. `submitLeadCapture` 위에 운영 상태 코멘트 | #147, #148 |
| `_rate_limit.js` | 신규 생성 — `checkCallableRateLimit(req, key, options)` helper | #147 |
| `_b2b_group_module.js` | `submitB2BQuote`, `verifyB2BCode`, `getB2BPriceQuote`, `lookupB2BOrder` 4개 함수에 rate limit 적용 | #147 |

### **Firebase 설정** (`/home/user/webapp/`)
| 파일 | 변경 사항 | PR |
|---|---|---|
| `firebase.json` | CSP, Permissions-Policy, Reporting-Endpoints, 보안 헤더 6종 (3개 라우트 블록) | #147, #149 |
| `firestore.rules` | `csp_reports`, `csp_report_counters`, `rate_limits` deny rule | #147 |

### **콘텐츠/문서** (`/home/user/webapp/`)
| 파일 | 변경 사항 | PR |
|---|---|---|
| `lead.html` | 상단 23줄 운영 상태 코멘트 추가 (외부 차단 4중 안전망, 재가동/폐기 가이드) | #148 |
| `robots.txt` | `Disallow: /lead.html` (이전 PR에서 이미 있었음, 확인만) | - |
| `assets/fonts/pretendard/*` | Pretendard 폰트 로컬 호스팅 | #147 |

---

## 📌 Firestore Console 등록 사항 (사용자가 직접 함, 코드 외 작업)

### **TTL Policy 3개 등록 완료** (2026-06-01)
🔗 https://console.cloud.google.com/firestore/databases/-default-/ttl?project=lifeporfolio

| Collection Group | Timestamp Field | Status |
|---|---|---|
| `csp_reports` | `expireAt` | 🟢 Serving |
| `csp_report_counters` | `expireAt` | 🟢 Serving |
| `rate_limits` | `expireAt` | 🟢 Serving |

> **중요**: 이 TTL은 Firebase Console이 아니라 **GCP Console에서만 설정 가능**. 새 세션이 TTL 관련 질문 받으면 위 URL로 안내.

---

## 🔧 기술 스택 핵심 메모

### **프로젝트 ID & 리전**
- **Firebase Project ID**: `lifeporfolio` (오타 아님! `lifeporTfolio`가 아니라 `lifeporFolio`임 ← `T` 빠진 게 정상)
- **Functions Region**: `asia-northeast3` (Seoul)
- **Firestore Location**: `asia-northeast3`
- **Cloud Functions URL pattern**: `https://asia-northeast3-lifeporfolio.cloudfunctions.net/{함수명}`

### **cspReport 함수 핵심 코드 패턴** (참고용)
```javascript
exports.cspReport = onRequest(
  {
    region: "asia-northeast3",
    cors: false,
    memory: "128MiB",
    timeoutSeconds: 10,
    maxInstances: 5,
    invoker: "public",  // ← App Check 면제 필수 (브라우저 익명 POST)
  },
  async (req, res) => {
    const safeSend = (status) => {
      try {
        if (!res.headersSent) {
          res.status(status).send("");
        }
      } catch (_) { /* swallow */ }
    };
    try {
      // CORS 헤더 설정
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      res.set("Access-Control-Max-Age", "86400");

      // OPTIONS preflight
      if (req.method === "OPTIONS") {
        return safeSend(204);
      }
      // GET → 405 (메소드 체크)
      // POST 외 거부

      // 응답 먼저 (Fire-and-forget) ← 중요!
      res.status(204).send("");

      // 그 다음 Firestore 쓰기 (실패해도 브라우저 응답엔 영향 없음)
      try {
        const batch = db.batch();
        // ... counter increment, csp_reports 문서 생성 ...
        await batch.commit();
      } catch (storeErr) {
        logger.error("[csp-report] firestore write failed", {
          error: storeErr && storeErr.message,
          stack: storeErr && storeErr.stack,
        });
      }
    } catch (outerErr) {
      logger.error("[csp-report] outer handler error", {
        error: outerErr && outerErr.message,
        stack: outerErr && outerErr.stack,
      });
      safeSend(204);  // 마지막 안전망
    }
  }
);
```

### **PowerShell vs bash curl 명령어 차이** (사용자 환경: Windows PowerShell)

새 세션이 사용자에게 curl 명령어 줄 때 반드시 PowerShell 호환 형태로:

```powershell
# ✅ 옵션 A: curl.exe (Windows 10/11 기본 탑재, 가장 쉬움)
curl.exe -i -X POST -H "Content-Type: application/csp-report" -d "{\"csp-report\":{\"violated-directive\":\"img-src\",\"blocked-uri\":\"https://x.com\"}}" https://asia-northeast3-lifeporfolio.cloudfunctions.net/cspReport

# ✅ 옵션 B: PowerShell 네이티브
$body = '{"csp-report":{"violated-directive":"img-src","blocked-uri":"https://x.com"}}'
Invoke-WebRequest -Method POST -Uri "https://asia-northeast3-lifeporfolio.cloudfunctions.net/cspReport" -ContentType "application/csp-report" -Body $body
```

❌ bash 스타일 백슬래시 줄바꿈(`\`) 절대 쓰지 말 것 — PowerShell에선 안 됨.

---

## 🌐 lead.html 운영 상태 (중요 컨텍스트)

- **현재 외부 노출 0건** — 어느 마케팅 채널/내부 링크에서도 연결 안 됨
- **외부 차단 4중 안전망**:
  1. `robots.txt`: `Disallow: /lead.html`
  2. `<meta robots noindex,nofollow>`
  3. `sitemap.xml`: 미등재
  4. 사이트 내부 HTML 어디서도 link 안 함
- **재가동 시 사용 채널**: Threads/Instagram BIO에 `/lead?utm_source=...`
- **참조 문서**: `docs/marketing/20_CHANNEL_PLAYBOOK.md` (line 99, 178, 238-243)
- **함수**: `submitLeadCapture` (rate limit 적용됨, PR #147)

> **사용자 입장**: 코드는 보존하되 현재 비활성. 영구 폐기 시엔 `lead.html` + `submitLeadCapture` + `assets/lead/` + `robots.txt`/`llms.txt` 의 lead.html 참조 모두 정리.

---

## 📋 사용자가 요청 가능한 후속 작업 (우선순위순)

### **🟢 단기 (1주일 후 권장)** — 운영 검증
1. **`csp_reports` 컬렉션 모니터링**
   - Firestore에서 `violated`, `blocked` 필드 확인
   - 정상 서비스인데 차단된 도메인 발견 시 CSP 화이트리스트에 추가
   - 패턴: `violated: script-src-elem`, `blocked: https://...` 분석

2. **`csp_report_counters` 추이 분석**
   - 동일 `sigHash` 의 `count` 값 증가 추이
   - 비정상 급증 시 공격 시그널 가능성

### **🟡 중기 (1개월 후)** — CSP 강화
3. **CSP Report-Only → Enforced 전환**
   - 현재 `firebase.json` 에 Report-Only로만 광범위 정책 적용
   - 1주~1개월 모니터링 후 Enforced로 승격
   - **위험**: 잘못하면 사이트 전체 깨짐. 반드시 단계별 진행 필요.

4. **`unsafe-inline` 제거** (script-src, style-src)
   - 현재: `'unsafe-inline' 'unsafe-eval'` 허용 중 (GTM/GA 호환)
   - 목표: nonce 또는 hash 기반으로 전환
   - 작업량: 큼 (모든 인라인 스크립트 nonce 부여)

### **🔵 장기 (필요 시)** — 고급 기능
5. **CSP 위반 알림 자동화** (Slack/Email)
   - `csp_report_counters` 의 `count > 임계값` 시 알림
   - Cloud Functions의 `onWrite` 트리거 활용

6. **보안 대시보드 구축**
   - `/admin/security` 페이지에 CSP 위반 통계
   - Firebase Console + 커스텀 페이지

7. **App Check 도입** (Cloud Functions 자체 보호)
   - 현재 `submitB2BQuote` 등 callable 함수는 익명 호출 가능
   - reCAPTCHA Enterprise + App Check로 봇 차단
   - **주의**: `cspReport` 는 절대 App Check 적용 X (브라우저 익명 POST 필요)

---

## ⚠️ 새 세션이 주의할 함정 (Pitfalls)

### **1. 프로젝트 ID 오타 주의**
- 정답: `lifeporfolio` (l-i-f-e-p-o-r-f-o-l-i-o, T 없음)
- 흔한 오타: `lifeportfolio` (T 추가) ❌
- 정확한 URL: `https://asia-northeast3-lifeporfolio.cloudfunctions.net/cspReport`

### **2. CSP report 엔드포인트는 App Check 절대 적용 X**
- 브라우저가 CSP 위반 시 익명 POST 보냄 — App Check 토큰 없음
- `invoker: "public"` 유지 필수
- App Check 추가하면 모든 CSP report가 403으로 차단됨

### **3. firebase.json 의 라우트 블록 순서 주의**
- `/` (루트) 블록과 `**/*.@(html|htm)` 블록이 따로 있음
- 헤더 변경 시 **두 블록 모두 동일하게 수정** 해야 securityheaders.com이 일관되게 잡음
- PR #149의 교훈: 한 곳만 빠뜨리면 등급 떨어짐

### **4. PowerShell 환경 고려**
- 사용자는 Windows PowerShell 사용
- bash 스타일 명령어(`\` 줄바꿈) 주면 에러
- 항상 `curl.exe` 또는 `Invoke-WebRequest` 형태로 제공

### **5. TTL은 Firebase Console에 없음**
- Firebase Console → Firestore → "TTL" 메뉴 ❌ (없음)
- GCP Console에서만 설정: `console.cloud.google.com/firestore/databases/-default-/ttl?project=lifeporfolio`

### **6. Firestore 컬렉션이 존재해야 TTL 등록 가능**
- 빈 컬렉션엔 TTL 못 검. 최소 1개 문서 필요
- `csp_report_counters` 가 안 보이면 사이트 방문 → CSP 위반 발생 유도

### **7. Git 워크플로우**
- 작업 브랜치: `genspark_ai_developer`
- main 브랜치 직접 푸시 금지
- PR 만들기 전 항상 `git fetch origin main && git rebase origin/main` (PR #148, #149 모두 이렇게 함)
- Force push 필요 시 `git push -f origin genspark_ai_developer` (rebase 후)

---

## 🛠️ 빠른 시작 명령어 (새 세션 첫 작업 시)

```bash
# 1. 현재 상태 확인
cd /home/user/webapp && pwd && git status && git log --oneline -5

# 2. 최신 동기화
cd /home/user/webapp && git fetch origin main && git checkout genspark_ai_developer && git rebase origin/main

# 3. Functions 코드 검증
cd /home/user/webapp && node --check functions/index.js && node --check functions/_rate_limit.js && node --check functions/_b2b_group_module.js

# 4. firebase.json JSON 유효성
cd /home/user/webapp && python3 -m json.tool firebase.json > /dev/null && echo "✅ JSON OK"

# 5. PR 생성 (GitHub REST API)
# token은 ~/.git-credentials 에 저장됨
# python3 + urllib.request 패턴 사용 (PR #148, #149에서 동일하게 사용)
```

### **GitHub PR 생성 템플릿 코드** (재사용)
```python
import json, os, urllib.request

token = open(os.path.expanduser("~/.git-credentials")).read().strip().split(":")[2].split("@")[0]
body = open("/tmp/pr_body.md").read()

req = urllib.request.Request(
    "https://api.github.com/repos/ghwelcome0-cloud/lifeportfolio-site/pulls",
    data=json.dumps({
        "title": "...",
        "head": "genspark_ai_developer",
        "base": "main",
        "body": body,
    }).encode(),
    headers={
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
    },
    method="POST",
)
resp = urllib.request.urlopen(req)
data = json.loads(resp.read())
print(f"✅ PR #{data['number']}: {data['html_url']}")
```

---

## 📊 검증된 최종 상태 (2026-06-01 기준)

| 항목 | 상태 | 검증 방법 |
|---|---|---|
| securityheaders.com 등급 | **A+** 🏆 | 스크린샷 캡처됨, "Wow, amazing grade!" |
| cspReport HTTP 응답 | **204 No Content** | PowerShell `curl.exe` 실제 호출 성공 |
| `csp_reports` 컬렉션 | 정상 저장됨 | sigHash, expireAt, IP 익명화 확인 |
| `csp_report_counters` 컬렉션 | 정상 저장됨 | count, sigHash, expireAt, violated 확인 |
| `rate_limits` 컬렉션 | 정상 작동 | 이전 PR에서 lead_captures 테스트로 검증 |
| TTL Policy 3개 | **Serving** ✅ | GCP Console에서 초록색 체크 확인 |
| CSP Report-Only | 활성 | F12 콘솔에서 위반 다수 발견됨 |
| CSP Enforced | 활성 | "Refused to connect..." 메시지로 차단 확인 |
| Permissions-Policy | 활성 | securityheaders.com에서 ✅ 표시 |
| HSTS | 활성 (preload) | A+ 등급 조건 만족 |

---

## 📁 핵심 파일 위치 빠른 참조

```
/home/user/webapp/
├── firebase.json                          # 보안 헤더 설정 (3개 라우트 블록)
├── lead.html                              # 운영 상태 코멘트 (line 1-21)
├── robots.txt                             # /lead.html Disallow (line 27)
├── llms.txt                               # Non-indexed pages 언급 (line 303)
├── sitemap.xml                            # lead.html 미등재 (확인 완료)
├── firestore.rules                        # csp_reports/counters/rate_limits deny
├── functions/
│   ├── index.js                           # cspReport 함수 (line ~3243-3440)
│   ├── _rate_limit.js                     # checkCallableRateLimit helper
│   └── _b2b_group_module.js               # B2B 함수 4개 (rate limit 적용)
├── assets/fonts/pretendard/               # Pretendard 폰트 (PR #147)
└── docs/
    ├── marketing/20_CHANNEL_PLAYBOOK.md   # lead.html 마케팅 계획 (line 99, 178, 238-243)
    └── handover/
        └── 2026-06-01_SECURITY_HARDENING_HANDOVER.md  # ← 이 문서
```

---

## 🗣️ 사용자 커뮤니케이션 스타일 메모

- **언어**: 한국어 위주, 영어 코드/명령어는 그대로
- **선호**: 명확한 단계별 가이드 + 체크리스트 + 이모지 활용
- **검증 방식**: 스크린샷 공유 (Firestore Console, securityheaders.com 등)
- **환경**: Windows PowerShell + 브라우저 F12 Console
- **결제 도구**: PayPal + Payple (`link.payple.kr`)
- **목표 등급**: 보안에 진심 (A → A+ 까지 끝까지 갔음)
- **현재 본업 모드**: 인생 포트폴리오 사업 (지금은 일시 중단 상태)

### **선호하는 답변 형식**
1. 결과 확인 (✅ 이모지 + 요약 표)
2. 단계별 가이드 (번호 + 코드 블록)
3. 주의사항 (⚠️ 명시)
4. 다음 단계 옵션 제시 (사용자 선택)

---

## 🎯 새 세션 첫 메시지 추천 응답 패턴

사용자가 새 세션에서 "보안 강화 다음 단계 진행해줘" 같은 요청을 하면:

```markdown
1. 이 인수인계서 (`docs/handover/2026-06-01_SECURITY_HARDENING_HANDOVER.md`) 읽기
2. `git log --oneline -10` 으로 현재 commit 상태 확인
3. 사용자에게 어떤 후속 작업 원하는지 명확히 질문:
   - 옵션 A: csp_reports 모니터링 + CSP 화이트리스트 보완
   - 옵션 B: CSP Report-Only → Enforced 전환
   - 옵션 C: unsafe-inline 제거 (nonce 도입)
   - 옵션 D: CSP 위반 알림 자동화
   - 옵션 E: 다른 작업 (인수인계서에 없는 신규 요청)
```

---

## 🏁 인수인계 완료 체크리스트

새 세션 시작 시 이 순서로 확인:

- [ ] 이 인수인계서 전체 읽음
- [ ] `git status` + `git log --oneline -5` 실행해서 현재 상태 파악
- [ ] PR #147, #148, #149 모두 머지된 것 확인
- [ ] TTL 3개 모두 Serving 상태 (GCP Console)
- [ ] securityheaders.com A+ 등급 유지 확인
- [ ] 사용자 요청 사항 명확히 듣고 작업 시작
- [ ] **모든 코드 변경은 PR 형태로** (직접 main 푸시 금지)
- [ ] **PowerShell 호환 명령어** 제공
- [ ] **프로젝트 ID `lifeporfolio` (T 없음)** 주의

---

## 📞 비상 연락처 / 참고 링크

- **GitHub Repo**: https://github.com/ghwelcome0-cloud/lifeportfolio-site
- **GitHub Owner**: `ghwelcome0-cloud`
- **PR 시리즈**:
  - https://github.com/ghwelcome0-cloud/lifeportfolio-site/pull/147
  - https://github.com/ghwelcome0-cloud/lifeportfolio-site/pull/148
  - https://github.com/ghwelcome0-cloud/lifeportfolio-site/pull/149
- **Firebase Console**: https://console.firebase.google.com/project/lifeporfolio
- **GCP Console (TTL)**: https://console.cloud.google.com/firestore/databases/-default-/ttl?project=lifeporfolio
- **SecurityHeaders 스캔**: https://securityheaders.com/?q=lifeportfolio.co.kr&followRedirects=on

---

**이 인수인계서로 새 세션이 100% 동일한 컨텍스트로 작업 가능합니다.**
**모든 의사결정 이유, 검증된 패턴, 함정, 사용자 환경 정보가 포함되어 있습니다.**

🤝 **인수인계 완료** — 2026-06-01
