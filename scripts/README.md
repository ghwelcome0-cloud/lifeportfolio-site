# scripts/

이 폴더에는 자동화·유지보수 스크립트가 들어갑니다. 사용자가 직접 실행할 필요는 없으며, 모두 GitHub Actions가 자동으로 돌립니다.

---

## `check_index_status.py` — 사이트맵 색인 점검

### 무엇을 하나
1. `https://lifeportfolio.co.kr/sitemap.xml` 에서 URL 51개를 가져옵니다.
2. 각 URL이 Google에 색인됐는지 `site:URL` 검색으로 확인합니다.
3. 이전 상태(`.github/index-state.json`)와 비교해서 변동분을 계산합니다.
4. 아래 3가지 조건 중 하나라도 해당되면 GitHub Issue를 한국어로 자동 생성합니다:
   - 🎉 **새로 색인된 URL**이 1개 이상 있을 때
   - ⚠️ **7일 이상 미색인된 URL**이 1개 이상 있을 때
   - 📊 **매주 월요일** 주간 요약 (좋은 소식·나쁜 소식이 없어도 무조건)

### 언제 돌아가나
- **자동**: 매일 한국시간 오전 9시 (= UTC 00:00) — `.github/workflows/sitemap-index-check.yml`
- **수동**: GitHub 저장소 → Actions 탭 → "사이트맵 색인 점검 (Daily)" → "Run workflow"

### 사용자가 할 일
- ✅ **한 번 머지하면 그 이후는 영원히 자동**
- ❌ 매일 점검 불필요
- ❌ 비용 0원 (GitHub Actions 무료 한도 안)
- 알림은 GitHub Issue로 옵니다 (저장소 워치 설정 시 이메일/모바일 알림 자동)

### 한계 (솔직히)
- Google이 공식 색인 확인 API를 막아놔서 `site:` 검색 결과로 추정합니다. 99% 정확하지만 가끔 false negative 가능.
- 네이버는 자동 봇 차단이 강해서 이 스크립트에 포함하지 않습니다. 네이버 색인은 **서치어드바이저의 "색인 상태 확인" 페이지를 주 1회 직접 확인**하시는 게 가장 정확합니다.

### 환경 변수 (GitHub Actions에서 자동 주입)
- `GITHUB_TOKEN`: Issue 생성용
- `GITHUB_REPOSITORY`: `owner/repo` 형식

### 상태 파일
- `.github/index-state.json` — 각 URL의 최근 색인 상태를 저장. 워크플로가 자동으로 커밋합니다 (`[skip ci]` 메시지로 무한 루프 방지).

### 로컬에서 테스트하려면
```bash
cd /path/to/webapp
GITHUB_TOKEN= GITHUB_REPOSITORY=ghwelcome0-cloud/lifeportfolio-site \
  python3 scripts/check_index_status.py
```
(GITHUB_TOKEN 비우면 Issue 생성은 건너뛰고 분석만 출력합니다.)
