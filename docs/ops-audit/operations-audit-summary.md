# 운영 안정성 점검 요약 · 2026-10-08 (1차 · 공개 비파괴 레인 + 에뮬레이터 재사용)

기준: origin/main `90384a6` (= 운영 배포, PR335 `d54c87c` 계보) · 환경: Linux Chromium headless(puppeteer) PC 1440×900 / iPhone UA 390×844 · 실기기·Safari·Samsung Internet·실로그인·실결제·실메일 **미실시**.
제품 코드·규칙·배포 변경 0건. 산출물은 `docs/ops-audit/` + `tools/stability-harness/` 만.

## 판정 카운트 (공개 레인 run `2026-10-08T21-19-00-public` + 재실행 `21-31-52`)
| PASS | FAIL | NOT_RUN | BLOCKED | NOT_APPLICABLE |
|---|---|---|---|---|
| 130 | 2 | 0 | 6 | 0 |

- FAIL 2 = `home-en-static__en__{pc,mobile}` → **OBS-001** `index-en.html` `<html lang="ko">` (i18n.js 미적용 정적 EN 페이지, P3).
- BLOCKED 6 = 3단계 승인 대기(실로그인·실결제·B2B 실주문·admin 실로그인·실기기·OS PDF 인쇄).
- 기존 자동 게이트 재실행: `test, test:hosting, test:admin, test:security, test:ux, test:touch, test:report:ch9, test:axes, test:evidence` 모두 EXIT 0 · `test:b2b:emulator` **197 PASS / 0 FAIL**(실제 핸들러 + 로컬 Firestore/RTDB, 메일·레이트리밋 스텁).

## 3 버킷
**A. 안전하게 동작 확인(공개 레인 기준)**: B2C 공개 42 페이지 KO/EN × PC/모바일 HTTP 200·가격 문구(₩19,900 / $14.99 / B2B ₩18,000)·undefined/NaN 없음·가로 넘침 0·i18n 미번역 키 0·비로그인 쓰기 요청 0·미공개 12 페이지 404·리다이렉트(product→product-v2, report-landing→/)·체크인21 KO/EN·B2B 6 페이지(KO).
**B. 결함/관찰**: DEF-001 `www.` TLS 인증서 불일치(P1, 콘솔 조치 승인 필요) · OBS-001 index-en lang=ko(P3) · OBS-002 EN→KO 전용 해설서 링크(P2 후보) · OBS-003 GTM/GA CSP 차단(P3, 분석 공백) · OBS-004 모바일 보조 링크 터치 타깃(P3, 55건). 상세 `defects.md`.
**C. 미실시/승인 필요**: 실계정 여정(가입→검사 저장→제출→리포트→재열람→재생성→프로그램→마이페이지), 실결제(Payple/PayPal), B2B 실주문→승인→코드→참여자, admin 권한 거부 실측, 교차 uid A/B 실측, 실기기·브라우저(Safari/Samsung), OS PDF. → `00_BASELINE` §6 승인 묶음 1회 결정 후 2·3단계 진행.

## 하네스 엔진 (주기 재실행용)
`tools/stability-harness/run.cjs` v0.2 · 케이스 `cases/public-pages.json`(61) · 실행:
`node tools/stability-harness/run.cjs --base https://lifeportfolio.co.kr --lane public --out docs/ops-audit/evidence --source-sha $(git rev-parse --short origin/main)`
→ `evidence/<run>/{test-matrix.csv,summary.md,evidence-index.json(sha256),*.json,*.png}`. 분류 규칙: 분석 리소스 CSP 차단=INFO, 터치 타깃=주 CTA만 FAIL, 404 기대 페이지 콘솔 404 무시, `allow_pageerror`로 설계된 throw 허용, `expect_final`로 리다이렉트 명시. 격리 레인(`--lane isolated --allow-hosts 127.0.0.1`)은 케이스 파일 `isolated-*.json` 추가 시 동작(에뮬레이터 Auth 9199/Firestore 8180/RTDB 9100은 `firebase.b2b-test.json` 재사용 가능).

## 2차 갱신 (2026-10-08 22:20Z · 대표 전권 승인 후)
- 격리 레인 실측: RTDB 경계 16/17 기대 일치(타인·비로그인·미결제·미정의키 전부 거부), B2B 에뮬레이터 197/197. 신규 **DEF-002**(payments 최초 paid 자가기록, 기존 판정서 기지 위험 — 별도 승인 PR 권고) · **OBS-005**(rules 게이트 양성 케이스 노후).
- 수정 PR **#358** (`ops-fix/2026-10-08`): OBS-001·002·003. fixverify 레인 로컬 10/10 PASS, 운영 음성 대조 6 FAIL(검사 유효). 동결 파일·규칙·함수 무변경. 표준 배포 경로 대기.
- DEF-001(www TLS): Firebase 콘솔 작업(코드 외) — 콘솔 접근 권한이 샌드박스에 없어 **대표 수동 1회**: Hosting → 사이트 `lifeporfolio` → 커스텀 도메인 추가 `www.lifeportfolio.co.kr` → 리다이렉트 대상 `lifeportfolio.co.kr`. 완료 후 `curl -I https://www.lifeportfolio.co.kr` 가 301 이면 닫힘.
- OBS-004(터치 타깃)는 디자인 백로그로 이관(주 CTA 영향 없음).

## 다음 단계
1. 대표 승인 묶음(§6) 결정 → 격리 레인 B2C 여정 케이스 작성(`responses/{uid}/{sid}` 저장→`submitted`→`reports/{uid}/{sid}` 재열람) 및 3단계 실측.
2. OBS-002 결정(EN 해설서 제공 vs 버튼 숨김), OBS-003 결정(GTM 허용 여부), DEF-001 콘솔 www 도메인 추가.
3. WebKit 레인: Playwright webkit 설치 실패 → 실기기 Safari로 대체(승인 항목).
