# 인생포트폴리오 (Life Portfolio)

> 사명·강점 발견 → 첫 3주 실행 설계 → 살아낸 삶이 누군가의 양식이 되는 자리까지.

**Production**: https://lifeportfolio.co.kr/
**Repo Branch**: `genspark_ai_developer` (개발) · `main` (운영)
**Stack**: Static HTML + Firebase RTDB + Firebase Cloud Functions (PayPal/Payple) + GTM(GTM-WWNXZLZX) + GA4(G-C8XKL4L9MZ)

---

## 📂 핵심 파일 가이드

| 파일 | 역할 |
|---|---|
| `index.html` | 홈 (Hero · Journey 사다리 · Final CTA) |
| `product.html` | 상품/결제 페이지 (PayPal · Payple) |
| `payment-success.html` | 결제 성공 + purchase 전환 이벤트 |
| `survey.html` (`suvey.html`) | 76문항 진단 |
| `report.html` | 진단 결과 리포트 |
| `assets/i18n/ko.json` `en.json` | i18n SSOT (Single Source of Truth) |
| `assets/js/analytics.js` | LP.* 이벤트 트래커 (GTM dataLayer 래퍼) |
| `privacy.html` `terms.html` | 개인정보처리방침 · 이용약관 |
| `utm-builder.html` | UTM 빌더 (내부용, noindex) |
| `docs/` | 마케팅/법률/측정 산출물 |

---

## 📊 측정 인프라 (PR #77)

### GA4 표준 이벤트
- `view_item` (product.html 진입)
- `assessment_start` / `assessment_complete` (76문항)
- `begin_checkout` (결제 버튼 클릭)
- `purchase` (결제 완료 · KGI 핵심 전환)
- `report_view` / `sign_up` / `login` / `generate_lead`

### 이벤트 부가 차원 (PR #77 신설)
모든 GA4 이벤트에 자동 부가:
- `traffic_source` (utm_source, 없으면 `(direct)`)
- `traffic_medium` (utm_medium, 없으면 `(none)`)
- `traffic_campaign` (utm_campaign)
- `traffic_term` (utm_term, 선택)
- `traffic_content` (utm_content, 선택)

세션 진입 시 첫 UTM이 `sessionStorage['lp_utm_v1']`에 저장되어 세션 내 모든 이벤트에 sticky 부착됩니다. 이로써 광고→결제 어트리뷰션이 이벤트 레벨에서 보존됩니다.

### UTM Builder
내부용 캠페인 URL 빌더 — https://lifeportfolio.co.kr/utm-builder
- `<meta robots="noindex,nofollow,noarchive">` + `robots.txt Disallow: /utm-builder.html` (이중 차단)
- 채널별 프리셋 6종 (Instagram organic/ad, 블로그 CTA, Threads, 뉴스레터, 유튜브)
- 영문 소문자/숫자/`_`/`-`만 허용 (한글·공백 자동 치환)

### Looker Studio Dashboard (Template)
`docs/looker-studio-template.md` 참조 — Dashboard 템플릿은 GA4 연결 후 다음 위젯으로 구성:

| 위젯 | 차원 | 측정항목 |
|---|---|---|
| KGI 카드 | (없음) | `purchase` 이벤트 수 (일/주/월) |
| KGI 카드 | (없음) | `purchase` 매출 합 (`value`, currency 분리) |
| 어트리뷰션 표 | `traffic_source` × `traffic_medium` × `traffic_campaign` | `purchase` 수, 전환율 |
| Funnel | view_item → begin_checkout → purchase | drop-off % |
| 매체별 트렌드 | `traffic_source` (시계열) | `purchase` 수 |
| 언어별 분리 | `language` (page_view 매개변수) | `purchase` ratio KO/EN |
| 블로그 → 결제 경로 | `page_path` (블로그 페이지) → `purchase` | 어트리뷰션 |

운영 도입 단계에서 Looker Studio 템플릿 URL을 본 README에 등재합니다 (현 시점 GA4 데이터 축적 필요).

### Microsoft Clarity (Dormant)
세션 리코딩/히트맵 — 현재 **완전 비활성** 상태.
활성 조건 (AND):
1. `localStorage['lp_consent_analytics'] === 'granted'` (사용자 명시 동의)
2. `window.LP_CLARITY_PROJECT_ID` 설정됨 (운영 도입 시 별도 PR로 주입)

기본 상태에서 네트워크 호출·쿠키·데이터 수집 **없음**. 도입 결정 시 `privacy.html §10` 개정 + 동의 UI 추가 PR과 함께 활성화 예정.

---

## 🛡️ 안정성 / 보안 원칙

1. **i18n SSOT**: `?lang=en` 쿼리만이 언어 결정 (`window._withLang()` 헬퍼, `nav-lang-guard.js`).
2. **결제 멱등성**: RTDB `payments/{uid}/paid` 기준, 재로드/재진입 시 중복 결제 차단.
3. **CSP / 헤더**: Cloudflare Pages `_headers`에서 strict-transport-security, X-Frame-Options, Content-Security-Policy 관리.
4. **회귀 차단**: PR #75에서 EN→KO 회귀 차단 로직 적용.
5. **측정 격리**: 모든 analytics 코드는 `try/catch` + silent fail — 결제/인증 흐름을 방해하지 않음.

---

## 🌳 i18n 구조

```
assets/i18n/
├── ko.json   (한국어 SSOT · 39 sections)
└── en.json   (English · 39 sections)
```

HTML 요소에 `data-i18n="<section>.<key>"` 부착, `data-i18n-html="true"`이면 innerHTML 적용. `data-i18n-attr="content"`이면 속성 치환.

---

## 📚 문서

- `docs/copy-mapping-pr78.md` — PR #78 카피 매핑표 (Before/After)
- `docs/legal-benchmark-analysis.md` — K-SaaS / GDPR / CCPA 벤치마크
- `docs/legal-compliance-checklist.md` — RED/YELLOW/GREEN 3-tier
- `docs/privacy-policy-revision-draft.md` — 개인정보처리방침 개정안
- `docs/terms-revision-draft.md` — 이용약관 개정안
- `docs/README-pr77-prep.md` — PR #77 통합 인덱스
- `SECURITY.md` — 보안 정책
- `HANDOFF_PR37.md` — PR 인수인계 가이드

---

## 📧 개인정보처리방침 개정 고지 시스템 (2026-06-19)

개인정보 보호법 제30조에 따라, 처리방침 개정 시 **전 회원 이메일 고지 + 홈페이지 팝업**을 운영합니다. (Naver·Kakao 고지 구조 벤치마킹: ①변경사항 전후 비교 ②시행일자 ③이의제기·문의)

### 구성 요소
| 파일 | 역할 |
|---|---|
| `functions/emails/privacy-update-2026-06-19.js` | 개정 고지 이메일 템플릿 (한/영 동시 · before/after 표) — `buildPrivacyUpdateEmail()` |
| `functions/index.js` → `sendPrivacyUpdateNotice` | onCall(asia-northeast3, 관리자 전용) 전 회원 일괄 발송. dryRun 미리보기, 배치(기본 50), **멱등성**(`privacy_notice_log` 컬렉션 중복 차단), `admin.auth().listUsers` 페이지네이션 |
| `assets/js/privacy-update-popup.js` | 7일 자연소멸 팝업 (2026-06-19~06-25 KST, 한/영 자동감지, `localStorage` 오늘 숨김) — `index/product/mypage/login/checkin-21(-en)` 6개 페이지 주입 |
| `checkin-admin.html` | 관리자 발송 UI (미리보기 dryRun → 실제 발송, 발송 결과 카운트 표시) |

### 발송 대상
- **Firebase Authentication 가입 회원 전원** (lead_captures · checkin21 신청자 모두 Auth에 포함)
- 멱등성: 캠페인 ID `privacy-update-2026-06-19`, 로그 doc `privacy-update-2026-06-19__{uid}` — 재실행해도 중복 발송 안 됨

### 운영 절차
1. (사용자 PC) Functions 배포 — `sendPrivacyUpdateNotice`는 **신규 함수**라, 배포 후 Cloud Run에서 403(CORS preflight) 발생 시 `allUsers → Cloud Run 호출자` IAM 권한 부여 필요 (resendB2BCodesEmail와 동일 이슈)
2. `/checkin-admin` 접속 → **[발송 대상 미리보기]**로 대상 수 확인
3. **[실제 발송]** (confirm 후 1회 실행)

### 4개 개정 항목
1. 웹 호스팅: GitHub Pages → Google LLC (Firebase Hosting) 정정
2. 설문 수집(Google Forms): 상시 → 긴급 시 한정
3. 미사용 광고 추적 도메인(Meta 픽셀) 정리
4. [B2B] 미사용 위탁사(OpenAI/Anthropic) 삭제 + 보호책임자(김영식, 파이스 대표) 명시

---

## 🗂️ 21일 실행 점검 패키지 — 운영자 가이드 (₩39,900)

### 현재 운영 단계
- **사전 신청 수집 중** (D22~D28 자동 워크플로우는 아직 비활성).
- 사전 신청자는 `checkin21_preorders` Firestore 컬렉션에 자동 저장됨
  (`payment_status: paid_pre_offer` — 정식 결제 아님, 출시 우선권 + 추가 ₩5,000 할인 대상).

### 운영자 대시보드
- **URL**: `/checkin-admin` (운영자 전용, `noindex,nofollow`)
- **접근**: Google 로그인 → admin 커스텀 클레임 보유 계정만
  (최초 부트스트랩 허용: `faise@lifeportfolio.co.kr`, `ghwelcome0@gmail.com`)
- **기능**:
  - KPI 카드 (총 사전신청 / 최근 7일 / 대기중 / 동행완료)
  - 검색·상태·언어 필터
  - **엑셀(CSV) 내보내기** — UTF-8 BOM 적용 (한글 깨짐 방지)
  - 행별 진행 상태 변경 (드롭다운)
  - **고객 상세뷰 모달** — 코치 워크플로우 통합 화면:
    ① 사전신청 정보 ② 21일 사전 답변(고객의 고백) ③ 비대면 상담 채팅 로그 ④ **운영자 내부 메모(코치 노트)**

### 진행 상태 워크플로우
`pending`(대기) → `invited`(D22 초대) → `self_done`(사전답변 완료) → `chat_done`(채팅상담 완료) → `completed`(동행완료) / `cancelled`(취소)

### 관련 Cloud Functions (asia-northeast3, 관리자 전용)
- `getCheckin21Preorders` — 사전신청 목록 + 요약 조회
- `updateCheckin21Status` — 진행 상태 변경
- `getCheckin21CustomerDetail` — 고객별 통합 상세(사전신청+답변+채팅) 조회
- `updateCheckin21Note` — 운영자 내부 메모 저장

### 데이터 컬렉션 (모두 Admin SDK 전용 — 클라이언트 직접 접근 차단)
- `checkin21_preorders` — 사전신청 (+ `status`, `admin_note`)
- `checkin21_responses` — 12문항 사전 답변 (email + purchase_date 연결)
- `checkin21_chat_logs` — 비대면 상담 채팅 로그
- `checkin21_chat_escalations` — 코치 에스컬레이션

### 배포 방법
- **Hosting**: `main` 브랜치 push 시 GitHub Actions 자동 배포 (`firebase-hosting-deploy.yml`, hosting만).
- **Functions**: GitHub Actions **수동 실행** — Actions 탭 > "Deploy Firebase Functions" > Run workflow
  (`firebase-functions-deploy.yml`, functions만). ⚠️ 새 함수가 라이브되려면 이 워크플로우를 실행해야 함.

---

## 🙏 사명

> "그러므로 너희는 가서 모든 민족을 제자로 삼아…" — 마태복음 28:18-20
> "충성되고 지혜 있는 종이 되어 그 집 사람들을 맡아 때를 따라 양식을 나누어 줄 자가 누구냐" — 마태복음 24:45

리포트대로 살면, 당신의 삶이 자산이 되고 — 그 자산은 누군가의 양식이 됩니다.
