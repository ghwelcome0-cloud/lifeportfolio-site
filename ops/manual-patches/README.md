# Manual Patches — GitHub App 권한 제한 우회용

이 디렉터리에는 **GitHub App(=현재 자동화 봇)의 권한으로는 푸시할 수 없는 변경분**을
운영자님이 GitHub 웹 UI 또는 로컬 PC에서 직접 적용하실 수 있도록 패치 파일로 보관합니다.

## 왜 필요한가

GitHub App 은 보안상 다음 경로의 파일을 자동 푸시할 수 없습니다:
- `.github/workflows/**` (워크플로 정의)

따라서 워크플로 변경이 포함된 PR 은 봇이 푸시하면 다음 에러로 거부됩니다:

```
refusing to allow a GitHub App to create or update workflow
`.github/workflows/xxx.yml` without `workflows` permission
```

해결: 워크플로 변경분만 별도 패치 파일로 분리하여 **운영자님(=리포지토리 소유자)이
직접 1회 적용**하면 됩니다. 이후 동일 워크플로 추가 변경은 패치 적용 그대로
이력에 남으므로 다음부터는 자동화 봇도 다른 파일을 자유롭게 수정 가능합니다.

---

## 📦 workflow-healthcheck.patch — 배포 후 자동 헬스체크 통합

**대상 파일**: `.github/workflows/firebase-hosting-deploy.yml`
**변경 요지**:
- Firebase Hosting 배포 스텝에 `id: deploy` 부여
- 신규 스텝 ① "배포 후 CDN 전파 대기 (20초)"
- 신규 스텝 ② "자동 헬스체크 (결제 → 리포트 전체 체인)"
  - `tools/healthcheck-payment-flow.sh` 자동 실행 (40+ 항목)
  - GitHub Actions Step Summary 에 결과 5줄 자동 부착
  - 실패 시 워크플로 전체 실패 → 즉시 알림

**효과**: 매 배포마다 라이브(lifeportfolio.co.kr) 직접 검증 → 회귀(regression) 즉시 자동 감지.

### 적용 방법 — 옵션 A (로컬 PC, 권장)

운영자님 PC 에서 (또는 권한 있는 개발자 PC 에서):

```bash
# 1) 리포지토리 클론(이미 있으면 pull)
git clone https://github.com/ghwelcome0-cloud/lifeportfolio-site.git
cd lifeportfolio-site
git checkout main && git pull

# 2) 패치 적용
git apply ops/manual-patches/workflow-healthcheck.patch

# 3) 변경 확인
git diff .github/workflows/firebase-hosting-deploy.yml

# 4) 커밋 + 푸시
git add .github/workflows/firebase-hosting-deploy.yml
git commit -m "ci(deploy): 배포 후 자동 헬스체크 스텝 추가 (PR#188 보강)"
git push origin main
```

푸시 직후 GitHub Actions 가 트리거되어 다음 배포부터 자동 헬스체크가 실행됩니다.

### 적용 방법 — 옵션 B (GitHub 웹 UI)

1. `ops/manual-patches/workflow-healthcheck.patch` 파일을 GitHub 웹에서 열어 내용 복사
2. `.github/workflows/firebase-hosting-deploy.yml` 을 웹 편집기로 열기
3. 패치 내용 그대로 수동 반영 (`+` 줄은 추가, `-` 줄은 삭제)
4. "Commit changes" → `main` 브랜치에 직접 커밋

### 검증

적용 후 다음 배포가 끝나면 Actions 탭에서:
- ✅ "배포 후 CDN 전파 대기 (20초)" 스텝 존재
- ✅ "자동 헬스체크 (결제 → 리포트 전체 체인)" 스텝 PASS
- ✅ Job Summary 하단에 "🩺 결제 플로우 헬스체크 결과" 표시 + `40 passed` 메시지

---

## 🧪 즉시 수동 헬스체크 (패치 적용 전이라도 가능)

패치 적용을 미루더라도, 운영자님은 언제든 로컬에서 직접 실행 가능합니다:

```bash
cd lifeportfolio-site
BASE_URL=https://lifeportfolio.co.kr bash tools/healthcheck-payment-flow.sh
```

출력 마지막 줄에 `40 passed / 0 failed` 가 표시되면 라이브 정상입니다.
