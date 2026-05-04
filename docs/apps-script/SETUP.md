# 📊 인생포트폴리오 응답 마스터 — Apps Script 설정 가이드

> 사장님께서 **단 1회만** 진행하시면 됩니다.
> 앞으로 모든 응답은 자동으로 Google Sheet에 쌓이고, 수동 리포트도 시트에서 바로 관리됩니다.

---

## ✅ 준비 완료 상태

- [x] **시트 생성 완료**
  - 제목: `인생포트폴리오 응답 마스터`
  - 시트 ID: `1jd0h64K2E0g7B5-aOZD0e2sNDmvOQshYiGHROgmHSCM`
  - URL: <https://docs.google.com/spreadsheets/d/1jd0h64K2E0g7B5-aOZD0e2sNDmvOQshYiGHROgmHSCM/edit>

이미 `Code.gs`에 시트 ID가 미리 입력되어 있으므로, **수정 없이 그대로 복붙**하시면 됩니다.

---

## 🚀 5단계 설정 (소요 시간: 약 5분)

### 1단계 — 시트 열기 → Apps Script 진입

1. 위 시트 URL 클릭하여 엽니다.
2. 상단 메뉴 **확장 프로그램(Extensions)** → **Apps Script** 클릭.
3. 새 창에 빈 `Code.gs` 가 열립니다.

---

### 2단계 — `Code.gs` 코드 붙여넣기

1. 본 저장소의 **`docs/apps-script/Code.gs`** 파일을 통째로 복사합니다.
2. Apps Script 편집기의 기존 내용을 **모두 지우고** 붙여넣습니다.
3. 상단 **💾 저장** 버튼(또는 `Ctrl + S`) 클릭.
4. 프로젝트 이름이 묻는다면: `LifePortfolio Sync` 로 저장.

> **시트 ID 수정 불필요** — 이미 입력되어 있습니다.

---

### 3단계 — 권한 승인 + 동작 테스트

1. 함수 선택 드롭다운에서 **`test_openSheet`** 선택 → ▶︎ **실행**.
2. 처음 실행 시 권한 요청 창이 뜹니다:
   - **권한 검토** → **계정 선택**
   - "Google에서 확인하지 않은 앱입니다" 화면이 나오면
     **고급 → 안전하지 않은 페이지로 이동(이름)** 클릭.
   - **허용** 클릭.
3. 하단 실행 로그에 `Opened: 인생포트폴리오 응답 마스터` 가 보이면 ✅ 성공.

> 추가로 `test_appendDummy()` → `test_manualReport()` 도 실행해 보면
> 시트에 `responses`, `manual_reports`, `logs` 탭이 자동 생성되고
> 더미 데이터 1줄씩 들어가는 것을 확인할 수 있습니다.

---

### 4단계 — 웹 앱으로 배포

1. 우측 상단 **배포(Deploy)** → **새 배포(New deployment)**.
2. ⚙️ **유형 선택**(톱니바퀴 아이콘) → **웹 앱(Web app)** 선택.
3. 입력 항목:
   - **설명**: `LifePortfolio v1`
   - **다음 사용자로 실행**: `나(본인 이메일)`
   - **액세스 권한**: ⚠️ **모든 사용자(Anyone)** ← 꼭 이 옵션
4. **배포** 클릭.
5. 발급된 **웹 앱 URL** 을 복사합니다.
   형식: `https://script.google.com/macros/s/AKfycbx...../exec`

> 코드를 수정한 뒤에는 **배포 → 배포 관리 → 편집(연필) → 새 버전** 으로
> 다시 배포해야 변경분이 반영됩니다. (URL은 그대로 유지됩니다.)

---

### 5단계 — Firebase RTDB 에 URL 등록

이 단계가 끝나면 설문 페이지가 자동으로 시트에 데이터를 보냅니다.

1. <https://console.firebase.google.com> 접속 → 프로젝트 **`lifeporfolio`** 선택.
2. 좌측 **빌드(Build) → Realtime Database** 클릭.
3. 데이터 트리에서 루트(`/`)에 마우스 올리고 **➕ 자식 추가**.
4. 다음 구조로 입력:
   ```
   config/
     └─ appsScriptUrl  =  "https://script.google.com/macros/s/.....​/exec"
   ```
   - 키: `config` → 그 아래 `appsScriptUrl`
   - 값: 4단계에서 복사한 **웹 앱 URL** (큰따옴표 없이 그대로 붙여넣기)
5. **추가(Add)** 또는 **업데이트(Update)** 클릭하여 저장.

설문 페이지(`suvey.html`)는 제출 시점에 이 경로를 읽어 자동으로 Apps Script로 POST 합니다.
**브라우저 새로고침이나 재배포가 필요 없습니다** — 다음 응답부터 즉시 반영됩니다.

---

## 🧪 정상 작동 확인 방법

### A. 설문 직접 제출
1. <https://lifeporfolio.com/suvey.html> 에서 테스트 응답 제출.
2. 시트 `responses` 탭에 새 행이 들어오면 성공.

### B. Apps Script 에서 직접 호출
편집기에서 `test_appendDummy` 실행 → `responses` 탭에 더미 1행 추가 확인.

### C. 헬스체크 (브라우저)
배포된 URL 끝에 `?action=health` 붙여 접속:
```
https://script.google.com/macros/s/.../exec?action=health
```
응답 예시:
```json
{ "ok": true, "status": "alive", "time": "2025-..." }
```

---

## 📂 시트 구조 요약

| 탭 이름 | 용도 | 주요 컬럼 |
|---|---|---|
| `responses` | 설문 응답 마스터 | saved_at, uid, sessionId, name, email, submittedAt, raw_json, **Q3 ~ Q78** |
| `manual_reports` | 수동 리포트 본문/상태 | sessionId, name, **manual_report_status**, **manual_report_html**, memo |
| `logs` | 오류·디버그 로그 | time, message |

---

## ✍️ 수동 리포트(맞춤형) 사용법

응답이 쌓인 후 **개인별 맞춤 리포트**를 ChatGPT/Claude 로 직접 다듬어
시트에 붙여넣으면 사용자에게 즉시 반영됩니다.

1. `responses` 시트에서 한 사용자의 행을 선택 → `raw_json` 셀 복사.
2. `data/report-rules.json` 의 톤·구조 규칙과 함께 LLM에 전달:
   > "다음 응답으로 인생포트폴리오 1page 리포트 HTML을 작성해줘.
   > 규칙: (report-rules.json 첨부) / 톤: principled_designer 등."
3. 생성된 HTML을 `manual_reports` 시트에서:
   - `sessionId` 입력 (`responses` 시트의 sessionId와 동일)
   - `manual_report_html` 칸에 HTML 붙여넣기
   - `manual_report_status` 를 **`ready`** 로 변경
4. `report-loading.html` 이 자동으로 폴링하여
   사용자에게는 **수동 리포트가 자동 리포트보다 우선** 표시됩니다.

> ⚙️ 폴링 주기는 `report-loading.html` 에서 5초 간격으로 최대 60초간
> `?action=getManualReport&sessionId=...` 를 조회합니다.

---

## ❓ 자주 묻는 질문

**Q1. 시트 ID가 바뀌면?**
`Code.gs` 첫 부분 `const SHEET_ID = "..."` 만 수정 후 새 버전 배포.

**Q2. 데이터가 들어오지 않습니다.**
1. RTDB의 `config/appsScriptUrl` 값이 `/exec` 로 끝나는지 확인.
2. `logs` 탭에 오류 메시지 확인.
3. 브라우저 콘솔(F12) 에서 `[sheets-sync]` 로그 확인.
4. Apps Script → **실행** 메뉴 → 최근 실행 기록 확인.

**Q3. Apps Script는 무료인가요?**
네. 일일 호출 한도(개인 계정 6시간/일, 트리거 90분/일) 안에서 무료.
하루 수천 명 응답까지 충분합니다.

**Q4. 응답을 다시 시트로 내려받고 싶습니다.**
`responses` 탭 → `파일 → 다운로드 → CSV/Excel`.

---

## 🔐 보안 주의사항

- 웹 앱 URL은 **공개 시 누구나 호출 가능**하므로 SNS 등에 노출 금지.
- 시트는 본인(또는 관리자)만 편집 권한을 가져야 합니다.
- `config/appsScriptUrl` 은 RTDB에 저장되어 있으나, 일반 사용자 권한으로는
  읽기만 가능하도록 `database.rules.json` 에 명시되어 있습니다.

---

## ✅ 체크리스트

- [ ] 1단계: 시트 → Apps Script 열기
- [ ] 2단계: `Code.gs` 붙여넣기 + 저장
- [ ] 3단계: `test_openSheet` 실행 + 권한 승인
- [ ] 4단계: 웹 앱 배포 → URL 복사
- [ ] 5단계: Firebase RTDB `config/appsScriptUrl` 등록
- [ ] 정상 작동 확인 (설문 제출 또는 헬스체크)

---

문의가 있으시면 `logs` 탭의 메시지를 캡처해 보내주세요.
