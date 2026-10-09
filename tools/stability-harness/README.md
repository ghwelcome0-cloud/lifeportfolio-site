# 안정성 점검 하네스 (stability-harness) · v0.2 — 회사 자산

목적: B2C/B2B · KO/EN · PC/모바일 운영 페이지를 **비파괴**로 주기 점검하고 PASS/FAIL/NOT_RUN/BLOCKED/NOT_APPLICABLE 로 판정, 증빙(스크린샷·콘솔·네트워크·sha256)을 남긴다. 제품 코드를 바꾸지 않는다.

## 구성
| 파일 | 역할 |
|---|---|
| `run.cjs` | 엔진(puppeteer Chromium). `cases/<lane>-*.json` 로드 → `evidence/<run_id>/` 에 케이스별 json/png + `test-matrix.csv` + `summary.md` + `evidence-index.json` |
| `cases/public-pages.json` | 1단계 공개 레인 61 케이스(운영 URL, 쓰기 요청 자동 차단, 파괴적 클릭 skip, 미공개 페이지 404 기대, 3단계 항목은 BLOCKED) |
| `cases/fixverify-2026-10-08.json` | 수정 검증 레인(OBS-001/002/003). 배포 전 로컬 빌드 PASS · 배포 후 운영 PASS 로 닫는다 |
| `rtdb-boundary-probe.mjs` + `run-isolated-rtdb.sh` | 2단계 격리 레인: RTDB 에뮬레이터에 운영 규칙 원문을 올려 타인/비로그인/미결제/미정의키 경계 17건 실측 |
| 기존 자산 재사용 | `npm run test:b2b:emulator`(B2B 197건), `npm test`, `test:hosting/security/ux/touch/report:ch9/axes/evidence/admin` |

## 실행
```bash
# 1단계 공개 레인(운영, 비파괴) — 약 7분
node tools/stability-harness/run.cjs --base https://lifeportfolio.co.kr --lane public \
  --out docs/ops-audit/evidence --source-sha $(git rev-parse --short origin/main)
# 수정 검증 레인(로컬 빌드: npm run build:hosting 후 정적 서버 띄우고)
node tools/stability-harness/run.cjs --base http://127.0.0.1:3011 --lane fixverify --out docs/ops-audit/evidence
# 2단계 격리 레인(에뮬레이터, 운영 접촉 0)
bash tools/stability-harness/run-isolated-rtdb.sh
npm run test:b2b:emulator
```
옵션: `--only id,id` `--viewports pc,mobile,pcwide,mobilesmall,tablet,landscape` `--touch-min 32` `--allow-hosts a,b`(isolated 전용 egress 허용목록). 종료코드 2 = FAIL 존재.

## 케이스 스키마(요지)
`id,url,route,feature,langs,viewports,expect_status,expect_html_lang,expect_final(정규식),must_contain{ko,en},must_not_contain,must_visible,must_hidden,steps[{type:click|type|eval|expect_url|expect_text|expect_visible|scroll_bottom|submit, destructive}],settle_ms,allow_pageerror,expect_analytics_csp_blocks,requires_approval(→BLOCKED),lanes,limitations`

## 판정 규칙(고정)
- 항상 검사: HTTP, html lang, 미번역 키, 가로 넘침(≤2px), 콘솔 에러, 실패 요청, enforce CSP 차단(분석 도구 제외), 운영 쓰기 시도 0.
- INFO(판정 미반영, summary 관찰 섹션): 분석 리소스 CSP 차단, 보조 링크 터치 타깃(<32px), Report-Only CSP 수.
- 주 CTA(`button[type=submit],.pay-btn,#payBtn,#submitBtn,#emailSubmit,.cta,.btn-primary`)가 <32px 이면 FAIL.
- 실기기/Safari/Samsung Internet/실로그인/실결제/실메일은 이 하네스가 **대체하지 않는다** → `requires_approval` 케이스로 BLOCKED 표기.

## 주기 운영 제안
- 월 1회 또는 배포 직후: public 레인 + fixverify 레인 → `docs/ops-audit/evidence/<run>/` 커밋(png 제외) → `summary.md` 카운트를 `operations-audit-summary.md` 에 누적.
- 규칙/함수 변경 PR: `run-isolated-rtdb.sh` + `test:b2b:emulator` 필수.
