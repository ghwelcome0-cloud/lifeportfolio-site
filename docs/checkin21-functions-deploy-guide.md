# 21일 패키지 운영 Functions 배포 가이드

> 2026-06-16 작성. checkin-admin 대시보드가 실제 데이터를 불러오려면
> 아래 **Cloud Functions 4종**이 프로덕션에 배포되어 있어야 합니다.

## 배포해야 하는 신규 함수 (asia-northeast3, 관리자 전용)

| 함수 | 역할 |
|---|---|
| `getCheckin21Preorders` | 사전신청 목록 + 요약(KPI) 조회 |
| `updateCheckin21Status` | 진행 상태 변경 (pending→…→completed) |
| `getCheckin21CustomerDetail` | 고객별 통합 상세(사전신청+사전답변+채팅) 조회 |
| `updateCheckin21Note` | 운영자 내부 메모 저장 |

코드는 이미 `functions/index.js`에 머지·검증되어 GitHub(main)에 있습니다.
**남은 것은 배포뿐입니다.**

---

## 방법 A — 로컬 PC에서 직접 배포 (가장 확실, 권장)

```bash
# 1) 최신 코드 받기
git pull origin main

# 2) functions 의존성 (한 번만)
cd functions && npm install && cd ..

# 3) functions 만 배포 (hosting/firestore/database 는 건드리지 않음)
firebase deploy --only functions --project lifeporfolio
```

배포 후 확인:
```bash
firebase functions:list --project lifeporfolio | grep -i checkin21
# → getCheckin21Preorders / updateCheckin21Status /
#   getCheckin21CustomerDetail / updateCheckin21Note 4종이 보이면 성공
```

---

## 방법 B — GitHub Actions 수동 배포 (자동화하고 싶을 때)

리포지토리에 `.github/workflows/firebase-functions-deploy.yml` 파일이
준비되어 있습니다. 단, **GitHub App 토큰에 `workflows` 쓰기 권한이 없어
샌드박스에서 직접 push 하지 못했습니다.** 아래 중 하나로 추가하세요.

1. **로컬에서 push** (workflows 권한 있는 계정으로):
   ```bash
   git add .github/workflows/firebase-functions-deploy.yml
   git commit -m "ci: functions 전용 수동 배포 워크플로우 추가"
   git push origin main
   ```
2. 또는 GitHub 웹 UI에서 직접 파일 생성/붙여넣기.

추가 후 실행: **Actions 탭 > "Deploy Firebase Functions" > Run workflow**

> 사전 조건: `secrets.FIREBASE_SERVICE_ACCOUNT` 가 Cloud Functions 배포 권한
> (`roles/cloudfunctions.admin`, `roles/iam.serviceAccountUser`,
> `roles/artifactregistry.writer` 등)을 가져야 합니다. 권한이 부족하면
> 방법 A(로컬 배포)를 사용하세요.

---

## 배포 후 운영 시작

1. `https://lifeportfolio.co.kr/checkin-admin` 접속
2. 운영자 Google 계정으로 로그인
   - 최초 1회: admin 권한이 없으면 부트스트랩 박스가 뜸 →
     허용 이메일(`faise@lifeportfolio.co.kr`, `ghwelcome0@gmail.com`)로
     "운영자 권한 받기" 클릭
3. 사전신청 목록·KPI·엑셀 내보내기·상세뷰·메모 사용 가능

## 참고: Firestore 인덱스
`getCheckin21Preorders` 는 `orderBy("submitted_at")` 를 사용합니다.
인덱스가 없으면 함수 내부 `try/catch` 로 **무정렬 조회 폴백**하므로
배포 직후에도 동작합니다. 정렬이 필요하면 콘솔 로그의 인덱스 생성 링크를
한 번 클릭해 단일 필드 인덱스를 만들면 됩니다.

---

## ★ 2026-09-08 갱신 — 방법 B 가 정식 경로가 되었다 (대표 승인 · PR #308)

`.github/workflows/firebase-functions-deploy.yml` 이 main 에 병합되어 **GitHub Actions 수동 실행**으로 Functions 를 배포한다.

- 실행 위치: https://github.com/ghwelcome0-cloud/lifeportfolio-site/actions/workflows/firebase-functions-deploy.yml → "Run workflow"
- 입력: `production_approval_message_id`(대표 승인 GenTeam 메시지 ID, 필수) · `only`(기본 `functions`, 특정 함수는 `functions:<name>`)
- 안전장치: main 전용 · production-live 환경 시크릿만 · 배포 전 `require` 로드 검증 · `--only functions` 고정(Hosting/규칙 무접촉) · 배포 후 `functions:list`

### 첫 실행 결과 (run 34225828630) — IAM 권한 1개 부족으로 배포 단계에서 중단

8/9 단계 통과(가드·의존성·로드 검증 exports 47·SA 검증·firebase-tools 설치) 후 배포 단계에서:

> `Missing permissions required for functions deploy. You must have permission iam.serviceAccounts.ActAs on service account lifeporfolio@appspot.gserviceaccount.com.`

원인: 배포 신원 `firebase-adminsdk-fbsvc@lifeporfolio.iam.gserviceaccount.com`(production-live 시크릿)에 **Service Account User(`roles/iam.serviceAccountUser`)** 역할이 없다. Cloud Functions 배포는 함수 런타임 SA(`lifeporfolio@appspot.gserviceaccount.com`)로 "행동(ActAs)"할 권한을 요구한다.

### 해소 (프로젝트 소유자만 가능 — 대표)

Google Cloud 콘솔 → IAM → https://console.cloud.google.com/iam-admin/iam?project=lifeporfolio
1. 주 구성원 `firebase-adminsdk-fbsvc@lifeporfolio.iam.gserviceaccount.com` 찾기 → 연필(수정)
2. 역할 추가: **Service Account User** (`roles/iam.serviceAccountUser`)
3. (배포가 다음 단계에서 또 막히면) **Cloud Functions Admin**(`roles/cloudfunctions.admin`) · **Cloud Run Admin**(2세대 함수) · **Artifact Registry Writer** 추가

또는 gcloud 한 줄(소유자 계정으로):
```bash
gcloud projects add-iam-policy-binding lifeporfolio \
  --member="serviceAccount:firebase-adminsdk-fbsvc@lifeporfolio.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```
권한 부여 후 워크플로를 같은 입력으로 다시 실행하면 된다(재실행 권한은 AI 총괄에게 있음).
