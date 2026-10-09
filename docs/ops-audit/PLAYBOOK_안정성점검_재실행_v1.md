# 안정성 점검 플레이북 v1 (자산) · 최초 실행 2026-10-08

> 목적: 다음 점검을 **반나절 안에** 같은 품질로 반복한다. 이번에 배운 함정과 지름길을 전부 적는다.

## 0. 한 줄 요약
공개 레인(비파괴) → 격리 레인(에뮬레이터) → 수정 PR → 규칙→호스팅 순 배포 → 운영 재검증 → 기록. 사람 결정은 "승인 묶음 1회"로 모은다.

## 1. 준비 (10분)
- worktree 분리: `git worktree add /home/user/ops-audit -b ops-audit/<날짜> origin/main` (제품 브랜치와 섞지 않음). `node_modules`는 symlink.
- `functions/node_modules`가 없으면 `cd functions && npm install` (B2B 에뮬레이터 테스트 필수).
- Java 21 확인(`java -version`) — Firebase 에뮬레이터.
- 기준 SHA 기록: `git rev-parse --short origin/main` + 최근 Promote run id.

## 2. 공개 레인 (7분, 운영 접촉 = 읽기만)
```
node tools/stability-harness/run.cjs --base https://lifeportfolio.co.kr --lane public --out docs/ops-audit/evidence --source-sha <sha>
```
- 60+ 케이스 × KO/EN × PC/모바일. FAIL이 나오면 **먼저 설계 의도인지 소스로 확인**(이번에 FAIL 57건 중 실제 결함은 1건):
  - `/product` KO → `/product-v2` 리다이렉트(의도) · 비로그인 결제버튼 잠금(의도) · checkin-21-chat 서명 없는 접근 throw(의도) · 404 기대 페이지의 콘솔 404(무시) · GTM/GA CSP 차단(INFO) · 보조 링크 터치 타깃(INFO).
- 케이스 파일에 `expect_final`, `allow_pageerror`, `must_hidden`, `langs:['ko']`(EN 미제공 페이지)로 의도를 **명시**해 두면 다음부터 거짓 FAIL 0.

## 3. 격리 레인 (5분, 운영 접촉 0)
```
bash tools/stability-harness/run-isolated-rtdb.sh      # 규칙 매트릭스 + 경계 프로브
npm run test:b2b:emulator                               # B2B 197건
```
- firebase CLI는 `--config`가 repo root에 있어야 함(스크립트가 복사/삭제).
- 에뮬레이터 토큰: `auth_variable_override={"uid","token":{"auth_time":now}}` + `Authorization: Bearer owner`. `auth_time` 없으면 신선 토큰 규칙에 걸려 **거짓 빨간불**(OBS-005가 그 사례).
- 양성 전제가 필요한 규칙(reports는 payments.paid 선행)은 admin(override 없이 Bearer owner)로 **시드** 후 측정.
- 기존 흐름 테스트 재사용: `test-group-report-flow`, `test-recovery-list`, `test-response-evidence`(바이트 고정 포함).

## 4. 수정 PR 만들 때의 함정
- **바이트 고정 파일**: `report.html`, `program.html`, `program-engine.js`, `database.rules.json`, `firebase.json`, `index.html`, `questions.json` 등은 `scripts/test-*`가 과거 커밋과 바이트 비교. 바꿔야 하면 `scripts/_diary-release-delta.cjs`에 **정확한 1문자열 델타** 등록(JSON.stringify로 escape — Python % 치환은 개행 깨짐).
- **DLP**: 인라인 `<script>` 안에 `faise@lifeportfolio.co.kr` 문자열 금지(`public-contact-policy-contract` 실패). 화면 안내문은 "아래 안내의 이메일로" 식으로 우회.
- `scripts/test-all.mjs`는 CI PR_HEAD 컨텍스트 필요 → 로컬 실패는 환경 문제(수정 전 main에서도 동일).
- puppeteer 스위트는 가끔 "frame detached" flake → 1회 재실행.
- 합성 브라우저 테스트에서 Firebase 모듈 스텁은 `Access-Control-Allow-Origin:*` 헤더 필수, 페이지가 이동하면 새 BrowserContext로 storage 격리.

## 5. 머지·배포 절차 (이 저장소 규칙)
- 룰셋 `main-one-person-safe-mode`: PR 필수 + 4 required checks를 **최신 base 기준**으로 통과해야 함(strict). PR이 하나 머지될 때마다 나머지는 BEHIND → `PUT /pulls/{n}/update-branch` 후 재대기(Quality Axes Gates ≈ 10분). `--admin`도 우회 불가. **여러 PR이면 하나로 합치거나 순차 머지 시간을 계산**할 것.
- 규칙 배포: `firebase-database-rules-live.yml` (pr_number, expected_rules_sha256, production_approval_message_id). PR 본문에 `approval-evidence` JSON(owner/tech_lead/code_reviewer 동일 head_sha, 코멘트 message_id)이 있어야 통과. 대표의 채팅 승인 원문을 owner 코멘트에 인용.
- 호스팅 배포: `firebase-hosting-live.yml` (source_run_id = 머지된 PR의 `Untrusted PR Hosting Build` run id, production_approval_message_id, expected_manifest_sha256 = 그 run의 manifest).
- Functions 배포: `firebase-functions-deploy.yml`.
- 순서: **규칙 → Functions → 호스팅**(클라이언트가 새 서버 동작을 전제로 하므로).

## 6. 운영 재검증 (3분)
- `curl -X PUT $RTDB/payments/x.json` → 401, `/.settings/rules.json` → 403.
- `node tools/stability-harness/run.cjs --lane fixverify --base https://lifeportfolio.co.kr` → 수정 항목 전부 PASS.
- 공개 레인 재실행 1회로 카운트 갱신.

## 7. 기록 (10분)
- `defects.md`(DEF/OBS 번호 연속), `operations-audit-summary.md`(n차 갱신 섹션 추가), `evidence/<run>/`(png 제외 커밋), `page-inventory.csv`.
- 미실시 항목은 "BLOCKED(승인 필요)"로 **그대로** 남긴다 — 하지 않은 것을 통과로 두지 않는다.

## 7.5 도메인/DNS 작업 함정 (2026-10-09 실측)
- 가비아 CNAME 값 오타는 Firebase 콘솔에서 "ACME 404" 경고로 나타난다 — 콘솔이 아니라 DNS 값을 먼저 의심.
- `www` 리디렉션을 켤 때 apex 도메인에 반대 방향 리디렉션이 남아 있으면 **즉시 루프** → 전환 직후 반드시 `curl -I apex`·`www` 둘 다 확인(10초 감시 스크립트 `loopwatch.sh`).
- 새 호스트(admin 등)는 DNS + Firebase Auth 승인 도메인 + GCP API 키 리퍼러 허용목록 **3곳** 모두 등록해야 로그인된다.
- 서브도메인은 제품 코드가 실제 참조하는 것만 만든다(`grep -rhoE "[a-z0-9-]+\.lifeportfolio\.co\.kr"`).

## 8. 이번 회차에 닫은 것 / 남긴 것
- 닫음: OBS-001·002·003(#358), DEF-002(#360, 규칙 배포 완료 → 운영 401 확인), OBS-005(#360), OBS-006(#361), 하네스 자산(#359).
- DEF-001 www: 대표가 DNS 값 수정 → **CLOSED**(2026-10-09 00:31Z). 루프 4분 발생·복구 기록.
- 백로그: OBS-004 터치 타깃, EN 해설서 본문, 3단계 실계정·실결제·실기기(시험 계정/한도 받으면 즉시).
