# PR-GOV 1인 안전 운영 적용 목록

## 승인된 운영 예외

- 사유: GitHub 사람 계정이 1명뿐임
- 최종 사람 승인자: 파이스(`ghwelcome0-cloud`) 1명
- 적용 범위: PR #228 governance와 PR #226 실제 preview까지
- 승인된 예외: 독립 사람 collaborator/CODEOWNER 및 2인 사람 승인 부재
- 잔여 위험: preview에서 기존 repository `FIREBASE_SERVICE_ACCOUNT`를 사용해 scope 보호가 아닌 workflow 통제에 의존하고 권한 blast radius가 큼
- 최초 재검토일: 2026-08-25
- 예외 만료일: 2026-09-10
- 종료 조건: preview identity를 production과 분리하거나 독립 사람 reviewer 추가

에이전트 검토는 사람 approval을 대체하지 않는다. 테크 리드와 코드 리뷰어의 각
`review SHA / 메시지 링크 / 판정 / 시각`을 PR에 기록한다. head SHA가 바뀌면 기존
판정은 stale이며 같은 head에 대한 재리뷰가 필요하다.

## Main ruleset — 관리자 API 적용

- target: branch, enforcement: active, include: `refs/heads/main`
- pull request required, 사람 approval 수는 0
- required check: `required-checks`
- conversation resolution required
- direct update, deletion, force-push 금지
- bypass actor 없음; 관리자도 동일 ruleset 적용
- last-push 독립 사람 approval은 1인 운영 예외 기간에는 요구하지 않음

적용 후 `gh api repos/ghwelcome0-cloud/lifeportfolio-site/rulesets` 응답을 증빙으로 보관한다.
Hosting 활성화(#226) 직후 required contexts에 `hosting-artifact`와 `firebase-preview`를
추가한다.

## Environments

### `protected-preview`

- trusted `workflow_run`에서만 사용
- untrusted PR job은 `contents:read`, secrets 0, build/test/artifact만 수행
- 기존 repository secret `FIREBASE_SERVICE_ACCOUNT`는 protected preview에서만 읽음
- repository secret은 scope 자체가 보호 경계가 아니며 trusted workflow 정적 정책과 byte 검증 순서로만 통제됨
- Firebase IAM 역할을 확인해 preview 최소권한이 아니면 2026-09-10까지 축소 또는 예외 재승인
- deployment branch policy는 protected branch 기준

### `production-live`

- `workflow_dispatch` + environment gate + 별도 채팅 승인이 모두 필요
- 채팅 승인 없는 production dispatch/deploy 금지
- 운영 배포는 PR #228/#226 범위 승인에 포함되지 않음
- production은 repository secret 자동 재사용 금지; `FIREBASE_PRODUCTION_SERVICE_ACCOUNT` environment secret만 허용

## 에이전트 승인 증빙

Required Checks의 internal-evidence 단계는 pull request에서 merge ref가 아니라 exact
`pull_request.head.sha`를 checkout한다. push/workflow_dispatch에서는 `github.sha`를 사용한다.
따라서 검토 SHA와 실제 실행 bytes가 다르면 fail-closed한다.

최신 head마다 아래 두 기록이 있어야 settings bootstrap/merge 판단으로 진행할 수 있다.

| 역할 | review SHA | 판정 | 메시지 링크 | 시각 |
|---|---|---|---|---|
| 테크 리드 | PENDING | PENDING | PENDING | PENDING |
| 코드 리뷰어 | PENDING | PENDING | PENDING | PENDING |

PR body의 `approval-evidence` JSON block에 파이스 승인, 테크 리드 승인, 코드 리뷰어
승인을 같은 head SHA로 기록하고 `approval-evidence` workflow를 수동 실행한다. head 변경 시
검사가 실패하며 세 승인을 다시 받아야 한다. production은 별도의 채팅 approval message ID,
source artifact/run ID, manifest SHA를 배포 승인 기록에 추가해야 한다.

## 적용 후 API 증빙 체크

- ruleset active, bypass actor 0, approval count 0, required-checks, conversation resolution
- `protected-preview` 및 `production-live` 존재와 branch policy
- repository secret은 이름/updated_at만 기록하고 값은 절대 출력하지 않음
- PR required checks 성공 run URL
- #226 이후 artifact digest, preview URL/channel, HTTP/404/header smoke artifact

## GitHub Pages

Pages 비활성화는 이 승인 범위에 포함되지 않는다. Firebase 운영 도메인을 확인한 뒤
파이스의 별도 irreversible 승인이 있어야만 실행한다.

## #226 진행 계획

1. #228 코드 재승인과 settings API 증빙
2. #228 merge 판단(자동 merge 금지)
3. #226을 최신 main에 rebase
4. Hosting activation false→true 및 all-PR artifact workflow 승격
5. required checks와 actual protected preview 실행
6. route/header/404/DLP/internal-link/rollback 증빙 제출
7. 운영 배포 금지 유지
