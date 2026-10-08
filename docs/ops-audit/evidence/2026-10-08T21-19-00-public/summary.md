# 안정성 하네스 결과 · 2026-10-08T21-19-00-public

base https://lifeportfolio.co.kr · lane public · 환경 chromium headless(Linux, puppeteer) — 실기기/Safari/Samsung Internet 아님 · source_sha 90384a6 · touch_min 32px

| PASS | FAIL | NOT_RUN | BLOCKED | NOT_APPLICABLE |
|---|---|---|---|---|
| 126 | 4 | 0 | 6 | 0 |

## FAIL 목록
- **home-en-static__en__pc**: html_lang: ko
- **home-en-static__en__mobile**: html_lang: ko
- **product__ko__pc**: visible: #guardLoginLink
- **product__ko__mobile**: visible: #guardLoginLink

## 관찰(INFO · 판정에 미반영, P3 후보)
### obs_small_touch_targets (55건)
- 본문으로 건너뛰기(1x1)|자세히(36x16)
- Login(31x23)|Sign up(42x23)|KO(36x30)|EN(35x30)|×(20x23)|Details(45x16)|×(23x22)
- 결정이 어렵다면, 샘플 리포트를 먼저 살펴보셔도 좋아요(293x17)|이용약관 제7조(76x17)|문의하기(44x17)|이용약관(44x17)|개인정보처리방침(88x17)|자세히(39x20)
- Life Portfolio
Discover · Live(328x30)|sample report preview(146x18)|faise@lifeportfolio.co.kr(156x18)|Details(49x19)
- 리포트(36x25)|나의 컴퍼스 발견하기 →(131x25)|방향 다시 잇기 →(95x25)
- KO(37x28)|EN(36x28)|처음이신가요? 여정 시작하기 →(300x23)|약관(23x25)|개인정보(46x25)|문의(23x25)|언어(23x25)|자세히(39x19)
- KO(37x28)|EN(36x28)|First time here? Start your jo(300x23)|Terms(38x25)|Privacy(46x25)|Contact(49x25)|Language(62x25)|Details(49x19)
- KO(37x28)|EN(36x28)|이용약관(52x19)|개인정보처리방침(103x19)|서비스 이용약관(84x17)|개인정보처리방침(92x17)|자세히(39x19)
- KO(37x28)|EN(36x28)|Privacy Policy(88x19)|Privacy Policy(86x17)|Details(49x19)
- KO(37x28)|EN(36x28)|처음이신가요? 여정 시작하기 →(300x23)|약관(23x25)|개인정보(46x25)|문의(23x25)|언어(23x25)
- 재생성(36x25)
- 자세히(39x19)
- Details(49x19)
- KO(37x25)|EN(36x25)|자세히(39x19)
- KO(37x25)|EN(36x25)|Details(49x19)
  - 케이스: home__ko__mobile, home__en__mobile, home-en-static__en__mobile, product__ko__mobile, product__en__mobile, product-v2__ko__mobile, product-v2__en__mobile, index-v2__ko__mobile, login__ko__mobile, login__en__mobile, signup__ko__mobile, signup__en__mobile, mypage-anon__ko__mobile, mypage-anon__en__mobile, suvey-anon__ko__mobile, suvey-anon__en__mobile, report-anon__ko__mobile, report-anon__en__mobile, program-anon__ko__mobile, program-anon__en__mobile …

### obs_csp_analytics_blocked (6건)
- 2: https://www.googletagmanager.com/gtm.js?id=GTM-WWNXZLZX|https://www.googletagmanager.com/gtag/js?id=G-C8XKL4L9MZ
  - 케이스: product__ko__pc, product__ko__mobile, product-v2__ko__pc, product-v2__en__pc, product-v2__ko__mobile, product-v2__en__mobile

### obs_csp_report_only (2건)
- 19
  - 케이스: customer-journey__ko__pc, customer-journey__ko__mobile

## BLOCKED(승인 필요)
- b2c-login-real__ko__pc: approval: 운영 시험 계정
- b2c-payment-real__ko__pc: approval: 실결제 한도/PG 테스트
- b2b-flow-real__ko__pc: approval: 실 주문·수신함·운영자 승인
- admin-login-real__ko__pc: approval: 운영자 계정
- real-device__ko__pc: approval: 실기기
- os-print-pdf__ko__pc: approval: 실기기

증빙: `docs/ops-audit/evidence/2026-10-08T21-19-00-public/` (스크린샷·콘솔·네트워크 호스트 목록; 고객 데이터 없음)
