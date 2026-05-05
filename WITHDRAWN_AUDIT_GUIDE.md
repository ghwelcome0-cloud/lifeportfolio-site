# 🔍 회원 탈퇴 계정 확인 및 30일 자동 파기 가이드

> 본 문서는 운영자가 Firebase Console에서 **누가 언제 탈퇴했는지**, **30일 자동 파기가 정상 동작하는지**를 점검하기 위한 안내서입니다.
> PR #38부터 적용.

---

## 1. 탈퇴가 어떻게 처리되는지 (전체 흐름)

사용자가 마이페이지의 "회원 탈퇴" 버튼을 누르면 다음 4단계가 순차 실행됩니다.

| 단계 | 처리 내용 | RTDB 경로 |
|---|---|---|
| ① | 탈퇴 직전 통계 수집 (리포트/프로그램/응답 개수) | (메모리만) |
| ② | 결제 데이터 익명화 (있을 경우) | `payments/{uid}` → `payments_anonymized/withdrawn_<ts>_<rand>` |
| ③ | **감사 기록 저장** (관리자 확인용) | `withdrawn_logs/{logId}` |
| ④ | 사용자 데이터 일괄 삭제 | `users/{uid}`, `reports/{uid}`, `programs/{uid}`, `responses/{uid}` 모두 null |
| ⑤ | Firebase Auth 계정 삭제 | Auth 콘솔에서 사용자 사라짐 |

---

## 2. 어디서 탈퇴 계정을 확인하나요?

### 2-1. Firebase Console RTDB에서 `withdrawn_logs` 노드 확인
1. Firebase Console → **Realtime Database** → 데이터 탭
2. 좌측 트리에서 `withdrawn_logs` 펼치기
3. 각 항목 구조:
```json
{
  "1714896000000_abc123": {
    "uidHash": "abc12345...wxyz",      // ← 식별 불가 마스킹 (앞 8자 + 뒤 4자)
    "provider": "google.com",          // 로그인 방식
    "withdrawnAt": 1714896000000,      // 탈퇴 시각 (Unix ms)
    "purgeAt":    1717488000000,       // 30일 후 자동 파기 예정
    "status":     "pending_purge",     // pending_purge → purged
    "counts":     { "reports": 4, "programs": 2, "responses": 1, "hadPayments": false },
    "anonPayId":  null                 // 결제 데이터가 있었으면 익명화 ID
  }
}
```
4. **중요**: 본인이 누구인지 식별하기 어렵게 uidHash로 마스킹되어 있어, 개인정보보호법(PIPA) 위반 위험이 없습니다. 단, 운영팀이 탈퇴 통계·시점·이유 분석은 가능합니다.

### 2-2. Firebase Console Authentication에서 계정 삭제 확인
1. Firebase Console → **Authentication** → Users 탭
2. 탈퇴한 사용자의 이메일/uid가 **목록에서 사라졌으면** 정상 처리.
3. 만약 남아 있다면 → 탈퇴 처리 중 Auth 삭제 단계가 실패한 것 → `withdrawn_logs`에는 기록되어 있어 추후 수동 복구 가능.

### 2-3. payments_anonymized 노드 확인 (결제 이력 있는 사용자)
1. Firebase Console → RTDB → `payments_anonymized` 펼치기
2. `withdrawn_<ts>_<rand>` 형태로 보존됨 (전자상거래법 5년)
3. 각 항목에 `_retainUntilTs` (5년 후 timestamp)가 있어 자동 파기 대상

---

## 3. 30일 자동 파기 (Firebase Functions 스케줄러)

### 3-1. 스케줄러 정보
- **함수명**: `purgeExpiredWithdrawnData`
- **실행 시각**: 매일 **03:30 KST** (= 18:30 UTC)
- **위치**: `functions/index.js` 마지막 블록
- **리전**: `asia-northeast3` (서울)

### 3-2. 동작 방식
매일 새벽 3:30에 자동으로:
1. `withdrawn_logs`의 `purgeAt < 현재시각` 항목을 `status: 'purged'`로 변경
2. 24시간 후 다음 사이클에 해당 로그를 **완전히 삭제**
3. `payments_anonymized`의 `_retainUntilTs < 현재시각` 항목 (5년 경과)도 동시 완전 삭제

→ **결과**: 탈퇴 후 30일이 지나면 운영팀조차 해당 사용자의 흔적을 RTDB에서 찾을 수 없어, GDPR Art.17 / PIPA 모두 충족.

### 3-3. 배포 방법
```bash
cd functions
npm install
firebase deploy --only functions:purgeExpiredWithdrawnData
```

배포 후 Firebase Console → **Functions** → `purgeExpiredWithdrawnData` 클릭하면 다음을 확인할 수 있습니다:
- 실행 이력 (Cloud Logging)
- 매일 실행 결과 (`{purgedLogs: N, purgedPayments: N, errors: 0}`)

### 3-4. 수동 실행 (긴급 시)
Firebase Console → Functions → `purgeExpiredWithdrawnData` → **Test the function** 탭에서 빈 본문(`{}`)으로 즉시 실행 가능.

또는 CLI:
```bash
gcloud scheduler jobs run firebase-schedule-purgeExpiredWithdrawnData-asia-northeast3 --location=asia-northeast3
```

---

## 4. 자주 묻는 질문 (FAQ)

### Q1. 탈퇴한 사용자의 이메일/이름을 알 수 있나요?
A. **알 수 없습니다.** uid를 마스킹(앞 8자 + 뒤 4자)해서 저장하므로 누가 탈퇴했는지 식별 불가능합니다. 이는 PIPA 제2조(개인정보 정의) 위반을 방지하기 위한 의도적 설계입니다. 운영 통계(탈퇴 건수, 시점, 보유 데이터 양)만 분석 가능합니다.

### Q2. 탈퇴 후 30일 이내 복구가 가능한가요?
A. **불가능합니다.** PR #38은 즉시 RTDB 삭제 + Auth 계정 삭제 + 30일 후 감사 기록까지 완전 파기를 정책으로 합니다. 향후 PR #39에서 사용자가 원할 경우 30일 grace period를 추가할 수 있습니다.

### Q3. 결제 이력은 왜 5년 보존되나요?
A. 전자상거래법 제6조(거래 기록 보존)에 따라 5년 보존 의무가 있습니다. 단, 개인 식별 정보(uid → uidHash, 이메일 등)를 모두 제거한 익명화 형태로 보존하므로 PIPA와 충돌하지 않습니다.

### Q4. 탈퇴가 실패하면 어떻게 되나요?
A. 4단계 중 어느 단계라도 실패하면 화면에 "탈퇴 처리에 실패했습니다" 알림이 뜨고, 사용자는 동일 계정으로 다시 시도 가능합니다. `withdrawn_logs`는 정상 처리된 경우에만 기록되며, 실패 시에는 RTDB 데이터도 사용자 계정도 그대로 유지됩니다.

### Q5. 스케줄러가 동작하지 않으면 어떻게 알 수 있나요?
A. Firebase Console → Functions → Logs에서 `[purge] 일일 자동 파기 완료` 메시지가 매일 1회 표시됩니다. 3일 이상 누락되면 Cloud Scheduler가 비활성 상태일 가능성이 있으니, GCP Console → Cloud Scheduler에서 `firebase-schedule-purgeExpiredWithdrawnData-asia-northeast3` 작업이 ENABLED 인지 확인하세요.

### Q6. `withdrawn_logs`만 보고 어떤 사용자가 어떤 데이터를 탈퇴했는지 알아낼 수 있나요?
A. **알 수 없습니다.** uidHash는 단방향 마스킹이므로 역추적이 불가능합니다. 이는 의도된 설계로, 만약 운영팀이 누군가의 탈퇴 사실을 확인해야 한다면 → 사용자 본인이 탈퇴 시각/이메일을 알려주는 방식이어야 PIPA 준수.

---

## 5. 운영 점검 체크리스트 (월 1회 권장)

- [ ] Firebase Console → Functions → `purgeExpiredWithdrawnData` 실행 이력 확인 (최근 30일 매일 성공)
- [ ] RTDB `withdrawn_logs` 노드의 가장 오래된 항목이 30일 이내인지 확인
- [ ] RTDB `payments_anonymized` 노드의 모든 항목 `_retainUntilTs`가 미래 시각인지 확인
- [ ] Firebase Auth Users 탭에서 사용자 수가 RTDB `users/` 노드 키 수와 일치하는지 확인 (불일치 시 고아 데이터)

---

## 6. 데이터 보존 정책 요약 (법적 근거 포함)

| 데이터 종류 | 정상 사용 시 | 탈퇴 시 | 법적 근거 |
|---|---|---|---|
| 리포트·실행 프로그램·검사 응답 | 영구 | 즉시 삭제 + 30일 후 감사 기록까지 완전 파기 | PIPA 제21조, GDPR Art.17 |
| Firebase Auth 계정 | 영구 | 즉시 삭제 | PIPA 제21조 |
| 결제·세무 기록 | 5년 (uid 키 사용) | 즉시 익명화 → 5년 후 자동 완전 파기 | 전자상거래법 제6조 |
| 탈퇴 감사 기록 | (해당 없음) | 30일 후 자동 완전 파기 | PIPA 제21조 |

---

작성일: 2026-05-05 / PR #38 / 운영 담당자: ____
