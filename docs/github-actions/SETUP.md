# 사이트맵 색인 자동 점검 — 설정 가이드 (1회만)

이 문서는 사이트맵 색인 자동 모니터링을 활성화하는 방법을 설명합니다. **딱 한 번**만 설정하면 그 후로는 영원히 자동입니다.

---

## 왜 사용자가 직접 해야 하나요?

GitHub의 보안 정책상, **GitHub App(저희 자동화 도구)은 워크플로 파일을 직접 push할 수 없습니다**. 워크플로는 저장소 안에서 코드를 실행하기 때문에 사용자(저장소 소유자)가 직접 추가해야 합니다.

→ 워크플로 파일 1개만 GitHub 웹사이트에서 추가하시면 됩니다. **3분 작업**입니다.

---

## 🚀 설정 방법 (5단계, 약 3분)

### 1단계 — 저장소 페이지 열기
브라우저로 https://github.com/ghwelcome0-cloud/lifeportfolio-site 접속

### 2단계 — Actions 탭 클릭
상단 메뉴에서 **Actions** 탭 클릭

### 3단계 — 새 워크플로 생성
- 처음 들어가면 "Get started with GitHub Actions" 화면이 나옵니다 → 맨 아래 **"set up a workflow yourself"** 클릭
- 이미 다른 워크플로가 있으면 좌측 **"New workflow"** 버튼 → 우측 상단 **"set up a workflow yourself"**

### 4단계 — 파일명·내용 붙여넣기
- 파일명을 `main.yml` 에서 **`sitemap-index-check.yml`** 으로 변경
- 기본 내용을 **모두 지우고**, 아래 내용을 그대로 붙여넣기:

```yaml
name: 사이트맵 색인 점검 (Daily)

# 매일 한국시간 오전 9시 = UTC 00:00 에 자동 실행
# 수동 실행도 가능 (workflow_dispatch)
on:
  schedule:
    - cron: '0 0 * * *'   # UTC 00:00 = KST 09:00
  workflow_dispatch:
    inputs:
      reason:
        description: '수동 실행 사유 (선택)'
        required: false
        default: 'manual test run'

# Issue 생성 + state 파일 커밋 권한
permissions:
  contents: write
  issues: write

# 동시에 여러 번 돌지 않게
concurrency:
  group: index-check
  cancel-in-progress: false

jobs:
  check-index:
    name: sitemap URL 색인 여부 점검
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - name: 저장소 체크아웃
        uses: actions/checkout@v4
        with:
          fetch-depth: 1

      - name: Python 3.11 설정
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: 점검 스크립트 실행
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GITHUB_REPOSITORY: ${{ github.repository }}
        run: |
          python3 scripts/check_index_status.py

      - name: state 파일 변경분 커밋 (있을 때만)
        run: |
          if [[ -n "$(git status --porcelain .github/index-state.json)" ]]; then
            git config user.name "github-actions[bot]"
            git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
            git add .github/index-state.json
            git commit -m "chore(index-monitor): 색인 상태 자동 업데이트 [skip ci]"
            git push
          else
            echo "ℹ️ state 변경 없음 — 커밋 생략"
          fi
```

> 💡 위 내용은 `docs/github-actions/sitemap-index-check.yml.template` 파일에도 동일하게 들어있습니다.

### 5단계 — 커밋
- 우측 상단 **"Commit changes..."** 초록 버튼 클릭
- 커밋 메시지: `feat(seo): 색인 점검 워크플로 활성화` (기본값 OK)
- **"Commit directly to the main branch"** 선택 → **"Commit changes"** 클릭

---

## ✅ 설정 완료 확인 방법

1. **Actions 탭으로 돌아가기** — 좌측에 "사이트맵 색인 점검 (Daily)" 워크플로가 보이면 성공
2. **즉시 테스트 실행**:
   - 좌측에서 "사이트맵 색인 점검 (Daily)" 클릭
   - 우측 **"Run workflow"** 버튼 → 초록 "Run workflow" 클릭
   - 약 5분 정도 기다리면 결과가 Issues 탭에 자동 생성됨
3. **알림 받기**: 저장소 우측 상단 **"Watch"** → **"Custom"** → **"Issues"** 체크 → GitHub 이메일·모바일 알림 자동 ON

---

## 📅 그 이후

- **매일 한국시간 오전 9시** 자동 실행
- 새 색인 / 7일+ 미색인 / 매주 월요일 요약 발생 시 → Issues 탭에 자동 생성
- 알림은 GitHub 이메일·모바일 푸시로 자동 도착
- **사용자가 할 일 없음** (영원히 자동)

---

## ❓ 문제 해결

### "Resource not accessible by integration" 오류가 워크플로 로그에 보이면
저장소 **Settings → Actions → General → Workflow permissions** 에서 **"Read and write permissions"** 선택 후 저장하세요.

### 워크플로가 안 돌아요
- Actions 탭에서 워크플로가 disabled 상태인지 확인
- 저장소가 60일간 활동 0이면 GitHub가 자동 disable — 아무 변경이나 한 번 push하면 다시 켜짐

### Issue가 너무 자주 와요
`scripts/check_index_status.py` 상단의 `STALE_DAYS_THRESHOLD = 7`을 더 큰 값으로 바꾸세요(예: 14).
