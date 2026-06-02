# 🚀 Firebase 자동 배포 설정 가이드 (비전공자용)

> **목표:** 앞으로는 `main` 브랜치에 **머지만 하면 사이트에 자동 반영**되게 만들기.
> **전제:** 기존 Firebase 방식 그대로 유지 — 도메인(lifeportfolio.co.kr)·SSL·`firebase.json` **아무것도 안 바뀜.**
>
> 바뀌는 것은 딱 하나: 지금까지 손으로 치던 `firebase deploy --only hosting`을 **GitHub이 대신 눌러준다.**

---

## 📌 한눈에 보는 전체 그림

```
[지금]  코드 머지 → (대표님이 직접) firebase deploy → 사이트 반영
[이후]  코드 머지 → (GitHub이 자동으로) 배포          → 사이트 반영 ✅
```

이 설정은 **딱 한 번만** 하면 됩니다. 약 10분 걸립니다.

---

## ✅ 준비물 체크리스트

- [ ] Firebase 콘솔 접근 권한 (대표님 구글 계정)
- [ ] GitHub 저장소 `ghwelcome0-cloud/lifeportfolio-site` 관리자 권한 (대표님 계정)
- 그게 전부입니다. 프로그램 설치 필요 없음.

---

## 1단계 — Firebase "서비스 계정 키" 발급받기

> 서비스 계정 키 = GitHub이 대표님 대신 배포할 수 있게 해주는 **자동화 전용 출입증**(JSON 파일). 대표님 비밀번호와는 별개라 더 안전합니다.

1. 👉 https://console.firebase.google.com 접속 → 프로젝트 **`lifeportfolio`** 선택
2. 왼쪽 위 **⚙️(톱니바퀴) → 프로젝트 설정** 클릭
3. 상단 탭에서 **서비스 계정(Service accounts)** 클릭
4. 아래쪽 **"새 비공개 키 생성 (Generate new private key)"** 버튼 클릭
5. 경고창이 뜨면 **"키 생성"** 클릭 → `lifeportfolio-xxxxx.json` 파일이 다운로드됩니다
6. ⚠️ **이 파일은 비밀번호급으로 중요합니다.** 남에게 절대 공유 금지, 깃허브에 그냥 올리면 안 됨(아래 2단계처럼 Secret으로만 등록).

---

## 2단계 — GitHub에 그 키를 "비밀(Secret)"로 등록

> Secret = 깃허브의 금고. 여기 넣으면 코드에는 안 보이고, 자동 배포할 때만 안전하게 꺼내 씁니다.

1. 👉 https://github.com/ghwelcome0-cloud/lifeportfolio-site 접속
2. 상단 **Settings(설정)** 탭 클릭
3. 왼쪽 메뉴에서 **Secrets and variables → Actions** 클릭
4. 초록색 **"New repository secret"** 버튼 클릭
5. 아래처럼 입력:
   - **Name(이름):** `FIREBASE_SERVICE_ACCOUNT`  ← **철자 정확히** (대문자·언더바)
   - **Secret(값):** 1단계에서 받은 **JSON 파일을 메모장으로 열어 → 전체 내용 복사 → 붙여넣기**
     (`{` 부터 `}` 까지 통째로. 줄바꿈 포함 그대로)
6. **"Add secret"** 클릭 → 끝!

> 💡 `FIREBASE_PROJECT_ID`는 등록 안 해도 됩니다. 워크플로에 기본값 `lifeportfolio`가 들어있어요.
> (혹시 프로젝트 ID가 다르면 같은 방법으로 `FIREBASE_PROJECT_ID` Secret을 추가하면 됩니다.)

---

## 3단계 — 워크플로 파일 추가하기

> ⚠️ **왜 대표님이 직접 추가해야 하나요? (정직한 설명)**
> 보안 규정상, 자동화 도구(GitHub App)는 `.github/workflows/` 폴더의 파일을 대신
> 만들거나 수정할 수 **없습니다.** (악성 자동배포 방지용 GitHub 정책)
> 그래서 워크플로 본문은 **`docs/firebase-hosting-deploy.yml.txt`** 라는 텍스트 파일로
> 저장소에 넣어두었습니다. 대표님이 이 내용을 진짜 워크플로 위치로 **한 번만 옮겨주시면** 됩니다.

### 방법 A — GitHub 웹에서 (가장 쉬움, 설치 불필요)

1. 👉 https://github.com/ghwelcome0-cloud/lifeportfolio-site 접속
2. 저장소에서 **`docs/firebase-hosting-deploy.yml.txt`** 파일을 열고 → 우측 **Raw** 버튼 → 전체 내용 복사
3. 다시 저장소 메인 → **Add file → Create new file** 클릭
4. 파일 이름 칸에 정확히 입력: **`.github/workflows/firebase-hosting-deploy.yml`**
   (앞의 점 `.` 포함, 슬래시 `/` 치면 폴더가 자동으로 만들어집니다)
5. 본문에 2번에서 복사한 내용 붙여넣기
6. 아래 **Commit new file** (main 브랜치에 바로 커밋) → 끝!

### 방법 B — 컴퓨터에서 (git 사용에 익숙하면)

```bash
git pull origin main
mkdir -p .github/workflows
cp docs/firebase-hosting-deploy.yml.txt .github/workflows/firebase-hosting-deploy.yml
git add .github/workflows/firebase-hosting-deploy.yml
git commit -m "ci: enable Firebase Hosting auto-deploy"
git push origin main
```

> ⚠️ 순서 주의: **2단계(Secret 등록)를 먼저** 끝낸 뒤 이 3단계를 하세요.
> Secret 없이 워크플로를 추가하면 첫 자동 배포가 "열쇠 없음" 오류로 실패합니다
> (사이트엔 영향 없음, Actions 탭에 빨간 X 표시만 뜸).

---

## 4단계 — 잘 되는지 확인

머지하면 자동으로 배포가 돌아갑니다. 확인 방법:

1. GitHub 저장소 상단 **Actions** 탭 클릭
2. **"Deploy to Firebase Hosting"** 워크플로가 노란 점(진행중) → 초록 체크(성공) 로 바뀌는지 확인
3. 초록 체크가 뜨면 → 👉 https://lifeportfolio.co.kr/pdf-sign-share.html 새로고침 → **이제 보입니다!** 🎉

> 빨간 X가 뜨면? Actions 탭에서 그 줄을 클릭 → 빨간 단계를 펼치면 원인이 한글/영어로 보입니다.
> 대부분 **Secret 이름 오타** 또는 **JSON 일부만 붙여넣음**이 원인입니다.

---

## 🔒 안전장치 (이 워크플로가 지켜주는 것)

- ✅ **hosting 만 배포** — `channelId: live` 사용 → Functions/Firestore/Database는 **절대 안 건드림**
- ✅ **배포 전 점검** — `firebase.json`과 `index.html`이 없으면 배포를 멈춤(사고 방지)
- ✅ **중복 방지** — 연속으로 머지해도 가장 최신 것만 배포(겹침 취소)
- ✅ **수동 버튼** — Actions 탭에서 **"Run workflow"**로 언제든 손수 재배포 가능

---

## ❓ 자주 묻는 질문

**Q. 기존 Firebase 설정이 바뀌나요?**
A. 아니요. 도메인·SSL·`firebase.json` 전부 그대로입니다. 배포를 "누가 누르냐"만 사람 → GitHub로 바뀝니다.

**Q. 예전처럼 손으로 배포해도 되나요?**
A. 네, `firebase deploy --only hosting` 그대로 됩니다. 자동·수동 병행 가능합니다.

**Q. 서비스 계정 키가 유출되면?**
A. Firebase 콘솔 → 서비스 계정에서 해당 키를 **삭제(폐기)**하고 새 키를 발급해 Secret만 교체하면 됩니다. 사이트 자체는 안전합니다.

**Q. PR(머지 전)에서도 미리보기 되나요?**
A. 이 워크플로는 `main` 머지 시 실제 배포만 합니다. 원하시면 PR 미리보기(preview channel) 기능도 추가해 드릴 수 있습니다(선택).
