# Firestore Rules — 운영본 ↔ 로컬 동기화 가이드

> ⚠️ **중요**: Firebase Console에서 직접 편집한 Firestore Rules가
> 로컬 `firestore.rules` 파일과 불일치하면, 향후 배포 시 운영본이 덮일 수 있습니다.

---

## 현재 상태 (2026-05-16 기준)

| 항목 | 상태 |
|---|---|
| Realtime Database Rules (`database.rules.json`) | ✅ Console과 일치 |
| Firestore Rules (`firestore.rules`) | ✅ **Console과 동기화 완료** — `checkin21_preorders` 첫 데이터 저장 검증됨 |
| `firebase.json` 의 firestore 섹션 | ✅ **활성화됨** — `firestore: { rules: "firestore.rules" }` |
| Firestore Database | ✅ 생성 완료 (default, `asia-northeast3` Seoul, Production mode) |
| 첫 사전 신청자 데이터 | ✅ 김영식 / 2026-05-16 / ko — 11필드 모두 정상 저장 |

---

## 🔍 운영본 확인 방법

1. https://console.firebase.google.com 접속
2. 프로젝트: **lifeporfolio** 선택
3. 좌측 메뉴: **Firestore Database → 규칙 (Rules) 탭**
4. 현재 활성 규칙 전체를 복사 → 로컬 `firestore.rules` 와 비교

---

## ✅ 일반 변경 작업 흐름 (활성화 후)

### 시나리오 A. 로컬에서 Rules 수정 → 배포
```bash
# 1) 로컬 firestore.rules 수정 후 커밋
git add firestore.rules
git commit -m "feat(firestore): <변경 내용>"

# 2) Dry-run 으로 차이점 확인 권장 (Firebase CLI 13.0+)
firebase deploy --only firestore:rules --dry-run

# 3) 의도된 변경만 있으면 실제 배포
firebase deploy --only firestore:rules
```

### 시나리오 B. Console에서 긴급 수정 → 로컬 미러링
1. Console > Firestore > Rules 에서 수정 + 게시
2. **즉시** 같은 내용을 로컬 `firestore.rules` 에 복사 + 커밋
3. 커밋 메시지: `chore(firestore): Console 긴급 수정 미러링 (YYYY-MM-DD)`

---

## 🛡️ 변경 정책

| 변경 발생 위치 | 절차 |
|---|---|
| 로컬 `firestore.rules` 수정 | 위 시나리오 A 따라 배포 |
| Firebase Console에서 긴급 수정 | 즉시 로컬 미러링 (시나리오 B) |
| **절대 금지** | 두 곳에서 동시에 다른 변경 → 머지 충돌 + 운영 위험 |

---

## 📋 현재 운영 중인 Firestore 컬렉션

| 컬렉션 | 용도 | 사용 코드 위치 | 접근 권한 |
|---|---|---|---|
| `checkin21_preorders` | 21일 점검 동행 사전 신청 | `checkin-21.html`, `checkin-21-en.html`, `functions/index.js` (`sendD22ReminderEmails`) | 익명 create 허용 (11필드 화이트리스트), read/update/delete 서버 전용 |
| `_test_email_log` | D22 이메일 시뮬레이션 발송 로그 (Rate limit 추적) | `functions/index.js` (`testD22EmailSend`) | 클라이언트 접근 불가 (Admin SDK 전용) |

향후 컬렉션을 추가할 때마다:
1. 로컬 `firestore.rules` 에 해당 컬렉션의 `match` 블록 추가
2. `firebase deploy --only firestore:rules` 로 Console 갱신
3. 본 문서의 **운영 중 Firestore 컬렉션** 표 갱신

---

## 🚨 응급 상황 대처

### "로컬 firestore.rules로 운영본을 덮어썼다"
1. Firebase Console > Firestore > Rules 탭
2. 우측 상단 **시계 아이콘 (버전 기록)** 클릭
3. 직전 버전 선택 → **이 버전으로 롤백**
4. 로컬 파일을 롤백된 운영본으로 다시 동기화

### "checkin21_preorders 폼이 갑자기 작동 안 한다 (Missing or insufficient permissions)"
체크리스트:
1. ✅ Firebase Console > Firestore > Rules 에서 `match /checkin21_preorders` 블록 존재 확인
2. ✅ `validPreorderData()` 함수가 11개 필드 화이트리스트 (`hasOnly`) 정확히 정의되어 있는지
3. ✅ **운영 Hosting 의 `checkin-21.html` addDoc 페이로드가 11필드 모두 보내는지** (`payment_status`, `d22_email_sent` 포함)
   - 검증: `curl -sL https://lifeportfolio.co.kr/checkin-21.html | grep -E "payment_status|d22_email_sent"`
   - 빈 결과면 → `firebase deploy --only hosting` 재실행 필요
4. ✅ 클라이언트 측 콘솔 에러 메시지 확인 (`console.error('Firestore error:', err)`)

---

## 🧪 testD22EmailSend (D22 이메일 라이브 미리보기)

### 용도
21일 기다리지 않고 D22 발송 메일을 본인 받은편지함에서 즉시 확인.

### 안전 장치
1. 운영 컬렉션(`checkin21_preorders`) **절대 건드리지 않음** — 별도 `_test_email_log` 사용
2. Rate limit: 같은 이메일 1분 1회, 1시간 10회
3. 도메인 화이트리스트: `TEST_D22_ALLOWED_DOMAINS` (기본 `lifeportfolio.co.kr,gmail.com`)
4. Subject 에 `[TEST]` 프리픽스 자동 부착 → 자동 발송과 구분
5. Resend tag: `test_d22_ko` / `test_d22_en` → Resend 대시보드에서 자동/테스트 발송 분리 가능

### 호출 방법 (Firebase Console > Functions > 테스트)
```json
{
  "data": {
    "to": "ghewelcome0@gmail.com",
    "lang": "both",
    "name": "운영자 테스트",
    "purchaseDateIso": "2026-04-25"
  }
}
```

### 또는 브라우저 콘솔 (로그인된 사용자)
```js
const functions = firebase.app().functions('asia-northeast3');
const result = await functions.httpsCallable('testD22EmailSend')({
  to: 'ghewelcome0@gmail.com',
  lang: 'both',
});
console.log(result.data);
```

### 응답 예
```json
{
  "ok": true,
  "sent": [
    { "lang": "ko", "to": "ghewelcome0@gmail.com", "messageId": "abc-123" },
    { "lang": "en", "to": "ghewelcome0@gmail.com", "messageId": "def-456" }
  ],
  "failed": [],
  "elapsedMs": 842,
  "previewPurchaseDate": "2026-04-25",
  "previewName": "운영자 테스트"
}
```

### 도메인 화이트리스트 변경
```bash
# 새 도메인 추가 (예: 운영진 회사 도메인)
firebase functions:config:unset test_d22_allowed_domains  # 기존 제거
# 또는 .env 사용 시 functions/.env 에 직접 기록 후 재배포
firebase deploy --only functions:testD22EmailSend
```
