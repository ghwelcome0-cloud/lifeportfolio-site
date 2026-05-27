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

## 📧 예약 메일 알림 활성화 (필수 1회 설정 — 2분 소요)

> **목적**: 분기 트리거가 발화되면 GitHub 이 Issue 를 자동 생성하고, 그 Issue 알림을 **사용자 메일함으로 예약 발송**합니다. 별도 SMTP 설정 없이 GitHub 의 기본 알림 시스템만으로 동작합니다.

### A. 저장소 Watch 설정 (Issue 알림을 수신하도록)

1. 저장소 페이지 (`https://github.com/ghwelcome0-cloud/lifeportfolio-site`) 우측 상단의 **Watch** 버튼 클릭
2. **Custom** 선택 → **Issues** 체크박스 ON → **Apply**
   - (또는 더 단순하게 **All Activity** 선택해도 됨)

### B. 개인 계정 메일 알림 활성화

1. GitHub 우측 상단 프로필 → **Settings** → 좌측 **Notifications**
2. **"Email"** 섹션에서 본인 이메일 주소 확인 (`ghwelcome0@…`)
3. **"Subscriptions"** 섹션:
   - **Watching** → ☑ **Email** 체크
   - **Participating** → ☑ **Email** 체크
4. **"Actions"** 섹션 (선택, 권장):
   - ☑ **Send notifications for failed workflows only** — 워크플로 실패 시에만 메일

### C. 동작 확인 (1분)

1. 위 "설치 후 확인" §2 의 **Run workflow → q1-d14** 수동 실행
2. 1~2분 내 등록된 메일함에 GitHub 발송 메일 도착 확인
   - 제목 예시: `[ghwelcome0-cloud/lifeportfolio-site] 🗓️ Q1 D-14: 1월 새해 결심 분기 글 사전 점검 (#NN)`
   - 본문에 Issue 링크 + 라벨 + §6.3-A 안내가 자동 포함됨
3. 메일 안 옴? → Settings → Notifications 의 메일 주소가 verified 인지, 스팸함도 확인

> **운영 흐름**: 이제 12-25 09:00 KST (Q1 D-14) 가 되면 GitHub Actions 가 자동 발화 → Issue 생성 → 본인 메일함에 예약 메일 도착 → 메일에서 Issue 링크 클릭 → 매뉴얼 §6.3 절차 진행.

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
