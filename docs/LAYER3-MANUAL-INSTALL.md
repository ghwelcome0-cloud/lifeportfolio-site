# Layer 3 (GitHub Actions Auto-Issue) — Manual Install Guide

> **왜 수동인가요?** GenSpark AI Developer GitHub App 에는 `workflows` 권한이
> 없어 `.github/workflows/*.yml` 파일을 자동 push 할 수 없습니다 (정상적인 보안
> 정책). 본 워크플로 파일은 `docs/seasonal-reminder.yml.txt` 로 보존되어 있으며,
> 사용자가 한 번만 수동으로 옮겨주시면 됩니다.

## 설치 (3분 소요)

### 방법 1 — GitHub 웹 UI (가장 간단)

1. 저장소 페이지 (`https://github.com/ghwelcome0-cloud/lifeportfolio-site`) 접속
2. 우측 상단 `Add file` → `Create new file` 클릭
3. 파일 경로 입력란에 다음 입력:
   ```
   .github/workflows/seasonal-reminder.yml
   ```
4. 본 저장소의 `docs/seasonal-reminder.yml.txt` 파일 내용을 그대로 복사
   → 새 파일에 붙여 넣기
5. 페이지 하단:
   - Commit message: `feat(seo): Layer 3 — GitHub Actions seasonal reminder workflow`
   - **Create a new branch for this commit and start a pull request** 선택
   - 브랜치명: `genspark_pr_b_layer3` (또는 `main` 으로 직접 커밋)
6. `Propose new file` → PR 생성 → 머지

### 방법 2 — 로컬 git (workflows 권한 있는 PAT 사용)

```bash
# personal access token (workflows scope 포함된 것) 사용
cd /path/to/lifeportfolio-site
git checkout main && git pull
mkdir -p .github/workflows
cp docs/seasonal-reminder.yml.txt .github/workflows/seasonal-reminder.yml
git add .github/workflows/seasonal-reminder.yml
git commit -m "feat(seo): Layer 3 — GitHub Actions seasonal reminder workflow"
git push origin main
```

## 설치 후 확인

1. 저장소 → **Actions** 탭 → 좌측 목록에 "Seasonal SEO Reminder" 가 나타나는지 확인
2. 상단 **Run workflow** 버튼 클릭 → reminder_type 드롭다운에서 `q1-d14` 선택 → 실행
3. **Issues** 탭으로 이동 → 새 Issue 가 자동 생성됐는지 확인 (라벨: `seo-reminder`, `quarterly`)
4. Settings → Notifications 에서 Issue 알림을 메일/푸시로 받도록 설정

## 자동 발화 일정 (KST)

| 분기 | D-14 (사전 점검) | D-7 (lastmod 갱신) | D-Day (배포·색인) |
| --- | --- | --- | --- |
| Q1 (1월 결심) | 12-25 09:00 | 01-01 09:00 | 01-08 10:00 |
| Q2 (5월 번아웃) | 04-22 09:00 | 04-29 09:00 | 05-06 10:00 |
| Q3 (8월 휴가 복귀) | 08-05 09:00 | 08-12 09:00 | 08-19 10:00 |
| Q4 (11월 연말 회고) | 11-04 09:00 | 11-11 09:00 | 11-18 10:00 |

추가로 각 분기 D-Day 이후 LLM 인용 점검 알림:
- D+7 (Q1: 01-15) / Q3 만 6월 04일, 6월 27일 — 추가 cron 3개 등록

알림이 뜨면 [`docs/seo-submission-guide.md`](./seo-submission-guide.md) §6.3 의 해당 절차로 이동.

## 백업 위치

- 원본 YAML: `docs/seasonal-reminder.yml.txt` (이 저장소 안에 보존)
- ICS 캘린더 (Layer 1): `docs/seo-reminders.ics`
- 운영 매뉴얼 (Layer 2): `docs/seo-submission-guide.md` §6·§7
