# RTDB 보안 규칙 배포 안내 (database.rules.json)

작성: 2026-07-29 · 대상: 대표님 로컬 PC
전제: 웹 배포(12커밋)는 **이미 완료**되었습니다. 이 문서는 **RTDB 규칙만** 배포하는 절차입니다.

---

## 0. 왜 별도 배포인가

`git push` 로 배포되는 것은 **Firebase Hosting(정적 파일)** 뿐입니다.
`database.rules.json` 은 **Realtime Database 보안 규칙**이라 Hosting 파이프라인이 건드리지 않습니다.
GitHub Actions 워크플로에도 `deploy --only database` 단계가 없으므로, **로컬에서 firebase CLI 로 직접 배포**해야 합니다.

> 참고: 이 파일은 이미 `e8805ae` 커밋으로 GitHub 에 올라가 있습니다(이번 12커밋에는 변경 없음).
> 즉 **레포의 내용과 실제 RTDB 에 적용된 규칙이 다른 상태**일 수 있고, 이번에 그것을 일치시킵니다.

---

## 1. 사전 준비

```bash
# ① 최신 코드 받기 (12커밋 포함)
cd <레포 폴더>
git checkout main
git pull origin main

# ② 커밋 확인 — 5eab43f 가 보이면 정상
git log --oneline -3
#   5eab43f engine(EN): II장 사명 인칭 불일치 교정 …
#   a4726e0 engine(EN): II장 사명·비전 설명줄 언어 반쪽 결함 교정 …
#   36e7101 engine(§7EN): EN 영역 라벨 금지어 유출 34/300 → 0/300 …

# ③ firebase CLI 로그인 상태 확인
firebase login:list
firebase projects:list        # lifeporfolio 가 보여야 합니다(스펠링 주의)
```

---

## 2. 현재 적용된 규칙 백업 (★ 필수 · 제44조 롤백 원자성)

배포 전에 **지금 살아있는 규칙**을 반드시 내려받아 두십시오.
문제가 생겼을 때 이 파일 하나로 즉시 되돌립니다.

```bash
firebase database:get / --project lifeporfolio > /dev/null   # 연결 확인용(선택)

# 현재 규칙 백업
firebase database:settings:get rules --project lifeporfolio > rtdb_rules_backup_2026-07-29.json

# 백업이 비어있지 않은지 눈으로 확인
type rtdb_rules_backup_2026-07-29.json      # Windows
# cat rtdb_rules_backup_2026-07-29.json     # macOS/Linux
```

> CLI 버전에 따라 `database:settings:get` 이 없을 수 있습니다.
> 그 경우 **Firebase 콘솔 → Realtime Database → 규칙 탭**의 내용을 전체 복사해
> 텍스트 파일로 저장해 두십시오. **이 백업 없이 진행하지 마십시오.**

---

## 3. 배포 (dry-run 없음 — 그래서 백업이 먼저입니다)

```bash
firebase deploy --only database --project lifeporfolio
```

정상 출력 예시:

```
=== Deploying to 'lifeporfolio'...
i  deploying database
i  database: checking rules syntax...
✔  database: rules syntax for database lifeporfolio-default-rtdb is valid
i  database: releasing rules...
✔  database: rules for database lifeporfolio-default-rtdb released successfully
✔  Deploy complete!
```

**`rules syntax … is valid` 와 `released successfully` 두 줄을 반드시 확인**하십시오.

---

## 4. 배포 후 확인 (3가지)

### ① 콘솔에서 규칙이 바뀌었는지
Firebase 콘솔 → Realtime Database → **규칙** 탭
최상단이 아래와 같아야 합니다.

```json
{
  "rules": {
    ".read": false,
    ".write": false,
```

### ② 실제 서비스 동작 (가장 중요)
- `https://lifeportfolio.co.kr/suvey` 접속 → **로그인 → 문항 1~2개 응답 → 새로고침 → 이어서 진행되는지**
  - 이것이 되면 `responses/$uid/$sid` 쓰기·읽기가 정상입니다.
- 결제 완료된 계정으로 **리포트 열람**이 되는지
- 랜딩의 **후기 목록**이 로그인 없이 보이는지 (`reviews_published` 공개 읽기)

### ③ 브라우저 콘솔에 권한 오류가 없는지
F12 → Console 에서 아래 문구가 **없어야** 합니다.
```
permission_denied at /...
PERMISSION_DENIED: Permission denied
```

---

## 5. 문제 발생 시 롤백

```bash
# 2단계에서 만든 백업으로 되돌립니다
#  (백업 파일이 {"rules": …} 형태인지 먼저 확인)
copy rtdb_rules_backup_2026-07-29.json database.rules.json     # Windows
# cp rtdb_rules_backup_2026-07-29.json database.rules.json     # macOS/Linux

firebase deploy --only database --project lifeporfolio
```

또는 **콘솔 규칙 탭에 백업 내용을 붙여넣고 "게시"** — 이게 가장 빠릅니다.

---

## 6. 이 규칙이 담고 있는 것 (배포 전 감사 결과)

| 점검 | 결과 |
|---|---|
| JSON 유효성 | ✅ 17,042 bytes · 최상위 키 `rules` |
| 기본 거부 (deny-by-default) | ✅ 루트 `.read=false` / `.write=false` |
| 미정의 경로 차단 | ✅ `$other` `.read=false` / `.write=false` |
| 인증 없이 읽기 가능 | **1건 — `/reviews_published`** (후기 공개 목록 · 의도된 설계) |
| 무조건 쓰기 허용(`.write=true`) | ✅ **0건** |
| 본인 데이터 격리 | ✅ `responses/$uid` → `auth.uid === $uid` |
| 값 길이 검증 | ✅ `status≤20` · `email≤254` · `userAgent≤512` 등 |
| 정의되지 않은 필드 | ✅ `$other .validate: false` (스키마 밖 필드 차단) |

**보호 대상 경로 12개**
`users` · `b2b_access` · `payments` · `additionalPayments` · `responses` · `reports` · `programs` · `config` · `reviews_published` · `reviews` · (+ 루트 · `$other`)

---

## 7. ★ Phase 3-1 문항 로그(qlog) — 순서 주의

이 규칙에는 **`responses/$uid/$sid/qlog/$qid` 경로가 이미 포함**되어 있습니다.
하지만 코드 쪽 스위치는 **아직 꺼져 있습니다.**

```
suvey.html:2099    const QLOG_ENABLED = false;
```

**반드시 이 순서를 지켜야 합니다.**

```
[1] 지금  →  RTDB 규칙 배포        (qlog 경로 허용)
[2] 다음  →  QLOG_ENABLED = true  (별도 커밋 · 별도 웹 배포)
```

순서를 거꾸로 하면 **규칙이 없는 경로에 쓰기를 시도해 저장 자체가 막힙니다**
(제44조 롤백 원자성을 위해 코드 배포와 활성화를 분리해 둔 이유입니다).

이번 배포는 **[1] 까지만** 입니다. `QLOG_ENABLED` 는 건드리지 마십시오.

---

## 8. 요약 — 붙여넣기용 3줄

```bash
git pull origin main
firebase database:settings:get rules --project lifeporfolio > rtdb_rules_backup_2026-07-29.json
firebase deploy --only database --project lifeporfolio
```
