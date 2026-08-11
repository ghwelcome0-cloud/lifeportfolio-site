# PR-GOV 관리자 적용 목록

코드 merge만으로 보호가 활성화되지는 않는다. 아래 설정은 저장소 관리자 승인을
받아 GitHub UI 또는 API로 적용하고, 적용 후 API 응답을 배포 승인 패키지에 보관한다.

## 1. Main ruleset

- target: branch, enforcement: active, include: `refs/heads/main`
- pull request required
- required approvals: 최소 1명 (보안·결제·PII는 독립 리뷰어가 추가되기 전 merge 금지)
- CODEOWNERS review required
- stale review dismissal 및 last-push approval required
- conversation resolution required
- required status check: `required-checks`
- direct update, deletion, force-push 금지
- bypass actor를 두지 않는다. 관리자도 동일 ruleset을 통과해야 한다.

검증:

```bash
gh api repos/ghwelcome0-cloud/lifeportfolio-site/rulesets
```

적용 API의 핵심 payload(독립 reviewer 추가 후 owner가 실행):

```bash
gh api --method POST repos/ghwelcome0-cloud/lifeportfolio-site/rulesets \
  -H 'Accept: application/vnd.github+json' \
  --input ruleset-main.json
```

`ruleset-main.json`은 `target=branch`, `enforcement=active`, include
`refs/heads/main`, `deletion`, `non_fast_forward`, `pull_request`
(`required_approving_review_count=1`, `require_code_owner_review=true`,
`dismiss_stale_reviews_on_push=true`, `require_last_push_approval=true`,
`required_review_thread_resolution=true`)와 `required_status_checks`
(`required-checks`, strict)을 포함해야 한다.

## 2. `production-live` environment

- required reviewer를 현재 GitHub owner 외 독립 배포 승인자로 지정
- prevent self-review
- can admins bypass: false
- deployment branch policy: protected branches only
- `protected-preview`: `FIREBASE_PREVIEW_SERVICE_ACCOUNT`, `FIREBASE_PREVIEW_PROJECT_ID`
- `production-live`: `FIREBASE_PRODUCTION_SERVICE_ACCOUNT`, `FIREBASE_PRODUCTION_PROJECT_ID`
- 위 4개는 각 environment secret으로만 등록하고 같은 이름의 repository secret은 삭제

검증:

```bash
gh api repos/ghwelcome0-cloud/lifeportfolio-site/environments/production-live
```

환경 생성/branch policy 적용은 독립 reviewer의 GitHub user ID를 확인한 뒤 실행한다.
현재 ID를 추정하거나 owner 자신을 reviewer로 지정하지 않는다.

```bash
gh api --method PUT repos/ghwelcome0-cloud/lifeportfolio-site/environments/production-live \
  -H 'Accept: application/vnd.github+json' \
  --input production-live-environment.json
```

payload는 `wait_timer=0`, `prevent_self_review=true`,
`reviewers=[{"type":"User","id":<INDEPENDENT_REVIEWER_ID>}]`,
`deployment_branch_policy={"protected_branches":true,"custom_branch_policies":false}`를
포함한다. 적용 뒤 환경 화면에서 admin bypass를 비활성화한다.

다음은 모두 **hard blocker**다. 하나라도 API로 확인되지 않으면 보호 완료·배포 가능으로
표시하지 않는다: 독립 collaborator, 독립 CODEOWNER, active no-bypass ruleset,
`protected-preview`/`production-live` 독립 reviewer, preview/production 분리 identity,
environment secrets 등록, 같은 이름의 repository secret 삭제.

장기 보안 로드맵: JSON 서비스계정을 OIDC/WIF로 교체한다.

## 3. GitHub Pages 비활성화

현재 Pages는 `main:/` legacy build이며 Firebase와 같은 custom domain을 가리키고 실패한다.
Firebase가 운영 신뢰원임을 확인한 뒤 Pages를 비활성화한다.

```bash
gh api --method DELETE repos/ghwelcome0-cloud/lifeportfolio-site/pages
```

## 4. 적용 후 증빙

- ruleset JSON과 environment protection JSON
- required-checks 성공 run URL
- PR preview run ID, artifact digest, preview URL 및 smoke 결과
- `preview-evidence-<source_run_id>` artifact의 channel/URL/smoke result
- 승인된 동일 artifact의 production-live deployment run URL
- Firebase release ID와 live smoke 결과

Actions run/artifact 검증은 `per_page=100&page=N` pagination으로 `total_count`를 모두
소진한 뒤 이름이 같은 미만료 artifact가 정확히 1개인지 확인한다.

Hosting 활성화(#226) 직후 main ruleset required contexts에 `hosting-artifact`와
`firebase-preview`를 추가한다. 활성화 이후 Hosting artifact workflow는 모든 PR에서
실행되며 path filter로 생략하지 않는다. #226은
`docs/governance/firebase-hosting-pr-build.yml.template`을
`.github/workflows/firebase-hosting-pr-build.yml`로 그대로 승격하고 Hosting contract를
false→true로 전환해야 한다. 따라서 PR-GOV 단계에는 fake green/skip context가 없다.
