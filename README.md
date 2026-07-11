# 인생포트폴리오 (Life Portfolio)

> 사명·강점 발견 → 첫 3주 실행 설계 → 살아낸 삶이 누군가의 양식이 되는 자리까지.

**Production**: https://lifeportfolio.co.kr/
**Repo Branch**: `genspark_ai_developer` (개발) · `main` (운영)
**Stack**: Static HTML + Firebase RTDB + Firebase Cloud Functions (PayPal/Payple) + GTM(GTM-WWNXZLZX) + GA4(G-C8XKL4L9MZ)
**정식 가격 (2026-06-26~)**: 개인 **₩19,900 / $14.99** · B2B 단가 **₩18,000~₩10,000**(구간별) · 21일 패키지 ₩39,900 *(오픈 특가 ₩9,900 종료)*

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
- `docs/value-evidence-base.md` — **가치 근거 베이스** (PR #207). "출발선 자료 → 인생 자산화" 서비스 가치를 뒷받침하는 학술 근거 5건(Matthews 2007 · Gollwitzer&Sheeran 2006 d=0.65 · Calling 메타분석 living-a-calling ρ=.54 · Ibarra HBS 전환기 자기서사 · Turning Points PMC) + 성경 근거 2건(하박국 2:2 · 달란트 비유, **신학검증·오독경계 적용**). 모든 1차 출처 링크 보존(블로그/검증용).
- `docs/legal-benchmark-analysis.md` — K-SaaS / GDPR / CCPA 벤치마크
- `docs/legal-compliance-checklist.md` — RED/YELLOW/GREEN 3-tier
- `docs/privacy-policy-revision-draft.md` — 개인정보처리방침 개정안
- `docs/terms-revision-draft.md` — 이용약관 개정안
- `docs/README-pr77-prep.md` — PR #77 통합 인덱스
- `SECURITY.md` — 보안 정책
- `HANDOFF_PR37.md` — PR 인수인계 가이드

---

## ✍️ 가치 카피 '인생 자산화' 재편성 (PR #207·#208·#209, 2026-06-19)

"출발선 자료가 아니라 **인생 자산화로 가는 길**"이라는 서비스 가치를 카피에 반영. **네거티브 프레임 지양 / 긍정·소명 언어 / 축적(비파괴) / 사탕발림 없는 객관화** 원칙 준수.

### 변경
- **hero.h1_sub** (`ko.json`/`en.json`/`index.html`): `한 권의 인생 설계도` → **`삶이 자산이 되는 인생 포트폴리오`**
  - '설계도'(정적 도면)가 '살아냄·자산화'의 동적 흐름과 미세 충돌 → 해소. 명문화 근거(하박국 2:2 '기록하라', Matthews·Ibarra)와 정합.
- **trust.card4 신규** (`ko.json`/`en.json`/`index.html`): "발견에서 멈추지 않는 이유" — 연구 기반 신뢰 카드. **수치 비노출·절제 표현**, 자사 직접검증 주장 아님. 출처는 `index.html` 주석 + `docs/value-evidence-base.md`에 전부 보존.
- **b2b.html** hero 가격 투명화: `1인당 ₩9,000부터 · 구간별 정가 · VAT 별도` + '가격 먼저 보기 ↓' CTA.
- **JSON-LD slogan** 6개 파일 브랜드 일관성 동기화 (index/login/privacy/product/signup/terms).

### 후속 동기화 — 메타/슬로건 (PR #208, 2026-06-19)
PR #207에서 인덱싱 재평가 리스크로 제외했던 **SEO 메타 문구**를 별도 PR로 일괄 동기화.
- **title**: `9,900원 한 권의 인생 설계도 PDF` → `9,900원, 삶이 자산이 되는 인생 포트폴리오 PDF` (가격·PDF 키워드 보존)
- **description/og/twitter/image:alt** (14개 정적 HTML + 블로그 인덱스 + ko/en i18n): `한 권의 인생 설계도` → `삶이 자산이 되는 인생 포트폴리오`
- en: `Life Blueprint` (메타/리드/onlyone) → `Life Portfolio where your life becomes an asset`
- 푸터(lead.html)·signup 리드 동기화.
- **보존(비파괴)**: 블로그 글 슬러그/제목/캐노니컬(`no-comparison-life-blueprint`) — SEO 링크 파괴 방지.

### 후속 일관성 — 히어로 카드·CTA (PR #209, 2026-06-19)
스크린샷에서 h1_sub는 '인생 포트폴리오'인데 바로 아래 **카드 타이틀·CTA·서브리드가 '설계도'로 남아 충돌** → 해소.
- **[A] 브랜드 자기지칭** → '인생 포트폴리오': `hero.card_title`, `hero.sublead`, `selfcheck.onlyone_title/onlyone_body_html`, `login.meta_title`.
- **[B] 전환 CTA** '첫 인생 설계도 받기' → '첫 인생 포트폴리오 받기': `hero.cta_primary/cta`, `deliverables.cta`, `selfcheck.verdict_3plus_cta`, `sticky.cta` (+ index.html fallback·JS fallback).
- **[C] 보존(의도적)**: '**첫 3주 실행 설계도**'(deliverables.h2·journey.step1·payment 메타·bridge_hint·common.cta_start)와 faq.a7·JSON-LD '자기경영 설계도(Life Portfolio)'는 **'실행계획서'라는 동적 의미**라 유지.

### 신학 적용 원칙 (자의적 오독 경계)
- **하박국 2:2**: "하나님이 주신 비전·소명을 명백히 기록해 다른 이의 유익으로 남긴다"는 청지기 원리로만 인용. (세속적 목표설정·비전보드 오용 금지)
- **달란트 비유(마 25:14-30)**: "맡겨진 것을 살아내어 누군가의 양식으로 남김"(주인의 유익)으로 표현. (번영복음 오독 금지, 소유권은 하나님께)

### 블로그 신규 글 — "정리·구조화하면 뭐가 다른가" (2026-06-19)
새 글 `blog/posts/2026-06-19-does-structuring-your-life-make-a-difference.html` 게시.
- **포커스**: '글로 쓰는 효과'가 아니라 **"사명·강점·실행계획을 정리·구조화해 자산화로 나아가는 것이, 안 한 것과 정말 뭐가 다른가"**에 정직하게 답.
- **표현 원칙**: 미정리 상태를 존중(네거티브/해명조 표현 배제, 고객 언어로 압축) → "흩어지던 하루가 쌓이는 자산이 된다".
- **검증된 비교 근거(1차 자료 직접 확인)**: ⭐**Morisano et al. 2010**(《J. of Applied Psychology》, **무작위 대조 RCT** N=85: 정리군 GPA 2.25→2.91·풀타임 100% vs 대조군 2.26→2.46·80%), **2,928명 준실험**(정리 코호트 +22%), Gollwitzer&Sheeran 2006(if-then d≈0.65), 소명 메타분석(living ρ.54>presence ρ.40). → `docs/value-evidence-base.md` F섹션에 보존.
- **성경 층위 분리(짜맞추기 배제)**: 재검증 결과 **하박국 2:2는 자기계발 효과 근거가 아님**(Enduring Word 명시) → 글에서 효과 근거로 인용하지 않고 '남김의 본'으로만. 달란트=청지기 의미(번영복음 경계).
- **색인**: 블로그 인덱스 카드 추가, `rss.xml` item 추가, `sitemap.xml` 등록(+누락됐던 06-15 글도 보강), 관련글 역링크 2건(if-then·no-comparison).

---

## 💳 가격 정상화 — 오픈 특가 종료 (2026-06-26)

오픈 기념 가격을 마치고 **정식 가격**으로 전환. (가격 '인상'이 아니라 오픈특가 종료에 따른 **정상화**)

### 가격 변경
| 항목 | 오픈 특가(종료) | 정식 가격(현재) |
|---|---|---|
| **개인 (KRW)** | ₩9,900 | **₩19,900** |
| **개인 (USD, PayPal)** | $8.99 | **$14.99** |
| **B2B 단가 (인원 구간별)** | — | **₩18,000 ~ ₩10,000** (`calcUnitPrice`) |

### 적용 범위 (비파괴 일괄 반영)
- **가격 문자열**: `assets/i18n/ko.json`·`en.json`(34개소), `index.html`/`product.html`/`b2b*.html` 본문·JSON-LD·GA4 `value`, `payment` 메타.
- **PayPal 단가**: `functions/index.js` `defineString("PAYPAL_PRICE_USD", {default:"14.99"})` + 실제값은 `functions/.env`의 `PAYPAL_PRICE_USD=14.99` (gitignored, PC 전용). `.env.example`도 14.99로 갱신.
- ⚠️ **sed 함정 주의**: `s/9,900/19,900/g`는 `119,900`으로 오염 → Python 음수 룩비하인드 `(?<![\d,])9,900` 사용해 안전 치환.

### 오픈특가 멘트 제거
"오픈 기념 가격 진행 중 / 오픈 특가 / −50% 오픈가" 등 한시성 문구를 항구적 가치 카피로 교체.
- `ko.json`/`en.json` `announce.text`(상단 띠배너) → 가치 카피("발견하고, 살아내고, 남기는 한 권의 인생포트폴리오").
- `hero.price_badge` → 빈 문자열(`""`), `index.html` 배지 `<span>` 자체 제거(빈 박스 방지).
- `design-preview/preview-live.html` 오픈특가 배지 제거.

### EN 홈링크 무한 리다이렉트(ERR_TOO_MANY_REDIRECTS) 해소
영문 모드(`?lang=en`)에서 홈 버튼 클릭 시 무한 리다이렉트 발생 → 전면 수정.
- **원인**: `firebase.json` `cleanUrls:true` 환경에서 `href="index"` + `?lang=en` → `/index?lang=en`로 이동 시 Firebase가 빈 경로 상대 리다이렉트(`location: ?lang=en`) 반환 → 브라우저 동일 URL 재해석 → 301 루프.
- **수정**: 14개 페이지의 `href="index"`(26개소)를 `href="/"`로 변경, `_withLang("index"/"index.html")` 호출(13개소)을 `_withLang("/")`로 변경. `_withLang` 헬퍼에 **루트 안전 분기** 추가(루트/빈 path/절대경로는 `u.pathname + search + hash` 반환).
- **검증**: 라이브 `/?lang=en` → HTTP 200 (루프 소멸 확인).

---

## 📧 개인정보처리방침 개정 고지 시스템 (2026-06-19)

개인정보 보호법 제30조에 따라, 처리방침 개정 시 **전 회원 이메일 고지 + 홈페이지 팝업**을 운영합니다. (Naver·Kakao 고지 구조 벤치마킹: ①변경사항 전후 비교 ②시행일자 ③이의제기·문의)

### 구성 요소
| 파일 | 역할 |
|---|---|
| `functions/emails/privacy-update-2026-06-19.js` | 개정 고지 이메일 템플릿 (한/영 동시 · before/after 표) — `buildPrivacyUpdateEmail()` |
| `functions/index.js` → `sendPrivacyUpdateNotice` | onCall(asia-northeast3, 관리자 전용) 전 회원 일괄 발송. dryRun 미리보기, **멱등성**(`privacy_notice_log` 컬렉션 중복 차단), `admin.auth().listUsers` 페이지네이션, **Resend rate limit 대응**(건당 700ms 간격 + 429 자동 재시도) |
| `assets/js/privacy-update-popup.js` | 7일 자연소멸 팝업 (2026-06-19~06-25 KST, 한/영 자동감지, `localStorage` 오늘 숨김) — `index/product/mypage/login/checkin-21(-en)` 6개 페이지 주입 |
| `checkin-admin.html` | 관리자 발송 UI (미리보기 dryRun → 실제 발송). **미리보기 크로스체크**: 발신/회신/제목·발송 대상 샘플·실제 본문(HTML iframe + 텍스트 탭) 표시 |

### 발송 대상
- **Firebase Authentication 가입 회원 전원** (lead_captures · checkin21 신청자 모두 Auth에 포함)
- 멱등성: 캠페인 ID `privacy-update-2026-06-19`, 로그 doc `privacy-update-2026-06-19__{uid}` — 재실행해도 중복 발송 안 됨

### 운영 절차
1. (사용자 PC) Functions 배포 — `sendPrivacyUpdateNotice`는 **신규 함수**라, 배포 후 Cloud Run에서 403(CORS preflight) 발생 시 `allUsers → Cloud Run 호출자` IAM 권한 부여 필요 (resendB2BCodesEmail와 동일 이슈)
2. `/checkin-admin` 접속 → **[발송 대상 미리보기]**로 대상 수 + 실제 발송 내용 크로스체크
3. **[실제 발송]** (confirm 후 1회 실행)

### 발송 결과 (2026-06-19 완료)
- ✅ **전 회원(31명) 발송 완료** — 1차 22명 + Resend rate limit 수정 후 잔여 9명 재발송 완료
- 1차 발송 시 9명 `429 rate_limit_exceeded`(초당 2건 제한) → 건당 throttle(700ms) + 429 자동 재시도로 해결, 멱등성으로 실패자만 재발송

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

## 🎨 Track3 · 전 페이지 시각 재탄생 (AX 동행자 플랫폼 전환)

문서 중심 웹사이트를 **AX(Agent Experience) 동행자 플랫폼** 수준으로 시각·구성 재탄생.
`--lpx-*` AX 디자인 시스템(청록 계열 #468D84 + heritage gold #E0A458) 기반.

### Phase 2 진행 현황
- **홈 (`index.html`)** — ✅ 완료·배포. 앱 아이콘 공식 상표 로고 교체, 스플래시 2단계 통일(AX 스플래시 유지 + OS 파란 스플래시 억제), 모바일 UX 안정화.
  - **큐레이션 카드 언어 오염 버그 수정(2026-07-11)**: 홈 하단 "다음 한 걸음" 큐레이션 카드
    (`assets/js/curation.js` + `assets/js/visitor-context.js`)가 이전 영문 페이지 방문으로 남은
    `localStorage.lp_lang='en'` 때문에 한글 홈에서도 영문 블로그(`/blog/posts-en/…`)로 연결되던 문제.
    → 언어 판단을 홈/블로그 CTA와 동일 원칙(`LP_I18N.lang → URL ?lang=en → <html lang> → ko`)으로 정렬,
    `localStorage.lp_lang` 참조 제거. 라이브 검증: 한글 홈=한글 링크, 영문 홈=영문 링크, 콘솔 0.
- **마이페이지 (`mypage.html`)** — ✅ 완료·배포. **현재 구성·기능 100% 유지**, 시각 결만 AX 청록 팔레트로 정합
  (`--brand`/`--brand2` 남색 → 청록 승격, `--text`/`--line` AX 톤). JS 훅·리포트/검사/탈퇴 기능 무손상.
- **인사이트 (`blog/index.html` → 라이브 `/blog`)** — ✅ 완료·배포. 승인된 청사진 **6섹션 재탄생**:
  1. Quiet Discovery Hero (**실기능 검색** — 4축 필터 제거[안A], 실시간 필터/하이라이트/카운트)
  2. ~~Curated Themes(4축)~~ — **안A로 제거**(관계 축이 55개 중 3개뿐 → 억지 매핑 방지, 검색 실기능화로 대체)
  3. Featured Insight Rail (황금빛 오솔길 사진 `assets/blog/insight-featured.jpg` §6-5 무인물 + Why It Matters Now)
  4. Reading Path (지금 읽기→함께 생각→내 리포트 연결 3단계)
  5. Quiet Grid of Reflections (인용 4카드 + **기존 55개 포스트 카드·110 SEO 링크 원본 무손상 보존**)
  6. Soft Footer CTA — **결제 페이지로 직접 유도**(2026-07-11): KO "나의 리포트 시작하기 →" `/product-v2`(페이플 19,900원),
     EN/`?lang=en` "Start My Report →" `/product?lang=en`(PayPal $14.99). (기존 `/report-landing` 경유 제거)
  - IntersectionObserver 스크롤 모션(reduce-motion 안전), head SEO/JSON-LD/Pretendard 전량 보존, KO/EN 스크립트 훅 유지.
- **인사이트 영문 (`blog/en/index.html` → 라이브 `/blog/en`)** — ✅ 완료·배포. 한글 페이지와 **동일 6섹션 AX 재탄생**
  (40 포스트 카드·80 `posts-en` 링크 보존, Featured `2026-06-21-its-never-too-late-to-start`).
- **로그인·회원가입 (`login.html`·`signup.html`)** — ✅ 완료·배포. navy→teal AX 리스킨(`--brand`/`--brand2` #468D84/#3A7A72),
  i18n(data-i18n) KO/EN 훅 무손상. navy 잔존 0.
- **검색 UX 개선 (KO+EN)** — ✅ 완료·배포:
  - **스크롤은 Enter/칩 클릭 시에만**(타이핑 중에는 실시간 필터만, 스크롤 없음) — `applyFilter(raw, doScroll)`
  - 빨간 테두리(`is-hit`) 완전 제거 · 매칭 텍스트는 gold `<mark>` 하이라이트
  - **가이드 키워드 칩 6개** — KO: 사명·강점·자산·발견·창업·리포트 / EN: mission·strength·asset·career·discover·report
    (전부 결과 보장 — 포스트 카드 텍스트 카운트로 사전 검증, 모두 ≥4 매칭)
- **한글 페이지 영문 혼입 버그 수정** — ✅ 완료·배포:
  - 하단 하드코딩 "English version available…" 안내문 → 한글("영문판은 /blog/en/ 에서…")
  - CTA 언어 전환 로직: `localStorage.lp_lang` 기반 → **URL `?lang=en` 기반**으로 변경
    (한글 전용 페이지에 영문 CTA가 섞이던 문제 해소)
- **상품/결제 KO (`product-v2.html` → 라이브 `/product-v2`, 페이플 19,900원)** — ✅ 색 정합 완료·배포 (2026-07-11):
  - **옛 문서사이트 톤 → AX 동행자 톤**: body 배경 `slate-50` → 오프화이트 웜톤 `#FAFAF7`(마이페이지·홈 통일),
    결제 CTA와 무관한 `indigo` 링크/가격/hover/포커스 → 청록 `#468D84`, legal-box 링크 보라 `#4f46e5` → 청록.
  - **[B5] 결제 색 역할 보존**: 카드결제=블루 `#4A6984`(주) / 계좌결제=청록 `#468D84`(부) 그대로.
  - 방식: `<style>` 블록 내 Tailwind CDN 유틸 `!important` 재정의(HTML 본문 무수정, 31줄 추가만).
    결제 JS(페이플 SDK/Firebase/fnConfirm)·CSP·`priceLabel` 서버주입 100% 무손상. 라이브 console 0, SHA256 MATCH.
- **상품/결제 EN (`product.html` → 라이브 `/product?lang=en`, PayPal $14.99)** — ✅ 구조 재구성 완료·배포 (2026-07-11):
  - **옛 2단 마케팅 랜딩 → AX 미니멀 단일 결제 동선** (KO product-v2 **쌍둥이 통일**).
  - 은닉: 상단 4단 마케팅 네비(`.nav`)+Home 중복 버튼(`.btn-secondary`), 좌측 히어로 카피(`.hero-copy`),
    하단 마케팅 섹션 6개(what-you-get·why·how·for·faq·cta = `section.section`).
  - 재배치: 2단 그리드(`.hero-grid`) → 중앙 단일 컬럼(max-width 520px), 결제 패널(`.purchase-panel`) 미니멀 카드.
  - **방식: CSS-only (HTML 본문 1바이트 무수정, style 26줄 추가)**. `<style>` 끝 `[AX]` override 블록.
  - 무손상: 결제 DOM/id 10종(payBtn·paypalArea·paypalGuard·paypalButtonContainer·paypalAlreadyPaidCard·
    legalAgree·guardMsg·addPayEnBtn·addPayKoBtn·paypalGoMypageBtn)·`data-lang-only` 13개·PayPal SDK·CSP·i18n 전부.
    SEO JSON-LD(FAQPage 등)는 head에 보존. 라이브 SHA256 MATCH, console 0. 롤백=`[AX]` 블록 삭제.
  - ⚠️ 미로그인 시 `login?lang=en`으로 인증 가드 리다이렉트(정상 결제 보안). 실제 결제 화면은 로그인 후 노출.
  - 🔭 **향후**: product·survey·report 완전 신규 AX 결제 페이지 재설계(**옵션3**) — 마이페이지 컴포넌트 재사용, 별도 진행.
- **모바일 UX·PWA·결제 상태 3종 개선** — ✅ 완료·배포 (2026-07-11):
  - **[P1] 모바일 결제/ask 위젯 중복 해소 (`index.html`)**: 하단 결제바(`#mSticky`)의 기존 '진입 1.2초 자동 노출(PR#24)'
    제거 → **아래로 스크롤 시에만** 노출(위로 스크롤/최상단 근처면 숨김). ask-widget '함께 이야기하기' launcher 도
    sticky 노출과 연동(`html.lp-sticky-on`)하여 스크롤다운 시에만 페이드인 → 상단 CTA·'함께 보기'와의 중복/겹침 제거.
    PC(≥900px)는 기존 동작 보존(launcher 항상 노출). Playwright 검증: 최상단 opacity 0 → 스크롤다운 opacity 1 → 스크롤업 숨김.
  - **[P2] PWA 아이콘 교체 + 스플래시 3→2단계**: 앱 아이콘(`icon-512/192`, `apple-touch-icon`)을 **상표 등록 로고 정본**
    (파란 배경·금 이중테두리·L·궤도·인생포트폴리오/LIFEPORTFOLIO/삶을 설계하다)으로 교체, 캐시버전 `?v=2→v=3`(전 페이지+manifest).
  - **[P2 정정] 스플래시 3→2단계 (`index.html`)**: (앞선 잘못된 구현 — standalone에서 `#lp-splash`(AX 스플래시)를
    생략 — 을 정정.) **AX 스플래시(`#lp-splash`)는 standalone에서 반드시 표시**되도록 로직 복원
    (`if (standalone) return;` → `if (!standalone && seen) return;`). 대신 **OS 기본 '파란 로고' 스플래시**를
    억제/통일: `apple-touch-startup-image` **9종**(iOS 주요 해상도)을 `#lp-splash` 룩(`#FAFAF7→#F4F2EF` 그라데이션
    + 금테두리 로고 + 인생포트폴리오/Live Your Portfolio/발견하고·살아내고·남깁니다)으로 재현하여 `<head>`에 등록
    (`/assets/startup/`). 결과: (AX톤 OS 스플래시 → AX 스플래시 → 인덱스)가 시각적으로 **(AX 연출 → 인덱스) 2단계**로
    이어짐. 비-standalone 웹 최초 방문 연출은 보존(비파괴). Playwright(로컬·라이브 standalone) 검증: errors=0,
    splashVisible=visible, startupImageLinks=9, splashGone(3.5s)=true. 라이브 SHA256 MATCH.
  - **[P3] 결제 상태 3분기 버그 수정 (`product-v2.html` KO + `product.html` EN)**: 기존엔 `payments/{uid}/paid` 만 확인 →
    '결제만 하고 검사 안 한 회원'과 '결제+검사 완료(리포트 생성)한 회원'을 구분 못 해, 완료자에게도 '결제한 검사 이어보기 /
    마이페이지·검사 시작'이 오노출됨. 해결: **`responses/{uid}` 중 `status==="submitted"` 세션 수**(=완료 검사 수)를 추가 조회
    (mypage **PR#201 결제권 판정** 벤치마크 — 리포트가 아닌 submitted 세션 사용: 리포트 삭제 시 결제권 되살아나는 부작용 방지).
    · 결제O+검사미진행 → '결제한 검사 시작/이어보기'(→suvey) · 결제O+검사완료 → '마이페이지에서 리포트 보기'(→mypage).
    EN은 `_adjustPaidCardByProgress`로 paid 카드 표시 후 진행 여부에 맞게 문구/버튼 후조정. 결제 JS(페이플/PayPal)·`--lpx-*`·`[B5]` 무손상.
  - 🔭 **다음**: survey(`suvey.html`) AX 재탄생 — 지시서·청사진 참고하여 착수 예정.

### 주요 진입 경로 (cleanUrls: true, trailingSlash: false)
- `/` — 홈 · `/blog` — 인사이트(한글) · `/blog/en` — 인사이트(영문) · `/mypage` — 마이페이지(로그인 필요)
- `/login` · `/signup` — 로그인·회원가입(단일 파일, i18n KO/EN)
- ⚠️ `/blog/`·`/blog/en/`·`/mypage.html` 등은 301 → clean URL(`/blog`, `/blog/en`, `/mypage`)로 리다이렉트.
  로컬↔라이브 SHA256 검증은 반드시 **clean URL** 기준으로 수행.

### 🗄️ 보관(비노출) 페이지
- **`report-landing`** (`report-landing.html`) — 고객 **비노출 보관** 상태(2026-07-11). 파일은 삭제하지 않고 유지하되,
  `firebase.json` redirects 로 `/report-landing`·`/report-landing.html` → `/`(홈) **301 리다이렉트**.
  나중에 필요 시 해당 redirect 2줄만 제거하면 즉시 복원. (인사이트 CTA는 결제 페이지로 직접 유도하도록 변경 완료)
- **"자산 랜딩 5종"**(report-landing / regenerate / interpretation / action-program / product-v2) — 이 중 `report-landing`만
  비노출 처리. 나머지는 이번 정리 범위 밖(유지).

---

## 🙏 사명

> "그러므로 너희는 가서 모든 민족을 제자로 삼아…" — 마태복음 28:18-20
> "충성되고 지혜 있는 종이 되어 그 집 사람들을 맡아 때를 따라 양식을 나누어 줄 자가 누구냐" — 마태복음 24:45

리포트대로 살면, 당신의 삶이 자산이 되고 — 그 자산은 누군가의 양식이 됩니다.
