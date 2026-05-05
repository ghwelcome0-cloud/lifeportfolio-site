# 🔄 PR #37 인수인계 문서 (Handoff)

> **다음 세션이 바로 이어서 진행할 수 있도록 작성된 작업 인계서입니다.**
> 작성일: 2026-05-05
> 브랜치: `genspark_ai_developer` (origin과 동기화 완료, 단 워킹트리에 미커밋 변경 18개 파일 + 신규 파일 1개 존재)

---

## 0. 📌 최우선 핵심 사실 (반드시 먼저 읽을 것)

### 0-1. 사용자가 직접 확인한 RTDB 보관 현황 (★ 중요)
- **총 보관된 리포트: 4개**
- **저장된 라벨 분포: KO 1개 / EN 3개**
- **사용자의 실제 검사 이력: KO 검사 3회 / EN 검사 1회**
- **즉, 라벨이 정확히 반대로 저장됨** → KO 검사 결과 3개가 `lang="en"`으로 잘못 기록되었고, EN 검사 결과 1개가 `lang="ko"`로 기록됨.
- **데이터 자체는 RTDB에 4개 모두 안전하게 보관되어 있음** (영구 보관 정책 정상 작동). 라벨 필드만 수정하면 즉시 정상화됨.

### 0-2. 사용자가 보고한 추가 증상
1. **PC**: 한글 마이페이지에서 1개만 보임 → 라벨 불일치로 KO 검사 3건이 EN으로 저장된 결과(영문 페이지로 가야 보임).
2. **PC**: 영문 마이페이지로 들어가도 한글 페이지/한글 리포트로 표시됨 → 헤더의 "마이페이지" 링크에 `?lang=` 미부착 회귀.
3. **PC**: 한글 마이페이지에서 리포트 클릭 시 KO/EN 토글 아이콘이 노출됨 → `report.html`/`program.html`/loading 페이지의 `.lp-lang-toggle` 마크업 잔존.
4. **모바일**: 마이페이지 진입 시 보관된 리포트가 **0개로 표시** + 마이페이지가 **한글로만 작동**.

### 0-3. 영구 보관 가능 여부 (사용자 결재 완료)
- **결정**: 영구 보관 유지 (만료 자동 삭제 없음). 단, **개별 리포트 삭제 + 회원 탈퇴 시 전체 삭제**로 GDPR/PIPA 준수.
- **부하 점검 결과**: Firebase RTDB 기준 1만 사용자 ≈ 450 MB / Blaze 약 $5/월. 10만 사용자 누적도 월 $25 미만 → 충분히 감당 가능.
- **법적 근거**: PIPA(즉시 삭제 요청 대응 가능 시 기간 자율) + GDPR Art.17(30일 내 삭제 요청 처리). 두 요건 모두 PR #37의 "개별 삭제 + 회원 탈퇴" 기능으로 충족.

### 0-4. 회원 탈퇴 기능 현황
- **현재 회원 탈퇴 기능은 존재하지 않음.** (mypage.html에 로그아웃만 존재)
- PR #37에서 **신규 구현** 필요(아래 J 항목).

---

## 1. ✅ PR #37 해결·개선 체크리스트 (최종 합의본)

> 우선순위 순서대로 작성됨. 사용자가 "그대로 우선순위를 두고 진행"하기로 승인.

### 🚨 [A] KO/EN 토글 마크업 제거 — **상태: 부분 완료**
- 대상 파일 및 위치:
  - ✅ `report.html` (481-484): 토글 div 제거 완료
  - ✅ `program.html` (449-451): 토글 div + 클릭 핸들러(1925-1927) 제거 완료
  - ✅ `report-loading.html` (253-255): 토글 div 제거 완료
  - ✅ `program-loading.html` (253-255): 토글 div 제거 완료
  - ⚠️ **`privacy.html` (196-198)**: KO/EN 토글 마크업 잔존 — **제거 필요**
  - ⚠️ **`terms.html` (198-200)**: KO/EN 토글 마크업 잔존 — **제거 필요**
- 참고: `index.html`, `login.html`, `signup.html`, `auth-fail.html`, `success.html`, `suvey.html`의 토글은 정책상 유지(상단 LP 토글, 일반 마케팅/입력 페이지). 단, 약관/개인정보 페이지는 자료성 페이지이므로 토글 유지 또는 제거를 사용자에게 재확인 권장. **현재 인계 결정: 제거**(언어 일관성 + 사용자 요청 "토글 없애 주세요").
- 검증: `grep -rn "data-i18n-toggle" *.html` 결과에 `report*.html`, `program*.html`, `privacy.html`, `terms.html`이 0건이어야 함.

### 🔗 [B] 헤더 "마이페이지" 링크에 `?lang=` 자동 부착 — **상태: 완료**
- 신규 파일: ✅ `assets/i18n/header-link-fix.js` 생성됨 (워킹트리, 미커밋)
- 적용 파일 16개 모두 `<script defer src="assets/i18n/header-link-fix.js"></script>` 삽입 완료:
  - `auth-fail.html, index.html, login.html, mypage.html, payment-fail.html, payment-success.html, privacy.html, product.html, program-loading.html, program.html, report-loading.html, report.html, signup.html, success.html, suvey.html, terms.html`
- 동작: `<html lang>` 또는 URL `?lang=`을 읽어 모든 내부 링크(특히 `mypage.html`, `product.html`, `suvey.html`)에 현재 언어 쿼리를 부착.
- 검증: 영문 페이지에서 헤더 마이페이지 클릭 → URL이 `mypage.html?lang=en`으로 이동, 영문 UI 유지.
- ⚠️ **회귀 테스트 필수**: `_renderAuth()` (mypage 등에서 동적 생성하는 마이페이지 링크)도 `header-link-fix.js`의 MutationObserver 또는 `lp:langchange` 이벤트 후 재처리되는지 확인.

### 📱 [C] 모바일 마이페이지 "0개 보임" + 한글 고정 — **상태: 진행 중**
- 적용된 변경:
  - ✅ `mypage.html`의 RTDB 타임아웃 12s → 20s로 연장(PR #36에서 선반영).
  - ✅ 인덱스(`users/{uid}/reports`)와 폴백(`reports/{uid}`) 두 경로 모두 조회.
  - ✅ 리포트 카드에 `lang` 필드 보정(누락 시 `"ko"` 기본).
- **추가로 해야 할 일**:
  - ⚠️ 모바일 환경 감지 후 타임아웃을 30s로 추가 연장 (현재 20s에서도 일부 모바일 LTE 환경 실패).
  - ⚠️ 인덱스/폴백 모두 실패 시 화면에 "리포트 동기화 중입니다. 새로고침해 주세요" 메시지 + 재시도 버튼 표시 (i18n 키 `mypage.sync_pending_*` 이미 추가됨).
  - ⚠️ AppCheck 토큰 만료/실패 시 silent fail 방지 — 콘솔 디버그 로그 추가 (현재 일부만 추가됨).
  - ⚠️ 모바일 캐시 회피: RTDB 호출 시 `?_t=Date.now()` 파라미터 또는 `forceRefresh` 옵션 사용 검토.
  - ⚠️ **언어 표시 문제**: 모바일에서 마이페이지가 한글로만 작동하는 원인은 [B]와 동일 → `header-link-fix.js`로 해결되어야 함. 단, 모바일 헤더 메뉴(햄버거)에서 동작 검증 필수.

### 🔧 [D] 잘못 라벨링된 4개 리포트 마이그레이션 — **상태: 사용자 결정 필요**
- **D-1 (Firebase Admin 일회성 스크립트)**: 어시스턴트가 Node.js 스크립트 작성 → 사용자가 서비스 계정 키로 로컬 실행 → KO 1/EN 3 → KO 3/EN 1로 정정. 실행 시간 1초, 데이터 손실 0.
- **D-2 (마이페이지 UI 보정 버튼)**: 각 리포트 카드에 "이 리포트는 한국어/영어입니다" 드롭다운 또는 "라벨 수정" 버튼. 사용자가 직접 수정 가능. 단, UI 노이즈 증가.
- **권장**: D-1 (4개뿐이라 일회성 스크립트가 가장 빠르고 안전).
- ❓ **사용자 결정 대기**: 다음 세션 시작 시 사용자에게 D-1 vs D-2 재확인 후 진행.

### 📜 [E] `privacy.html` 개정 (개인정보처리방침) — **상태: 부분 완료**
- ✅ 보관 기간 명시 조항 추가됨 (`s7_h`, `s7_p` i18n 키 사용).
- ⚠️ 추가 보강 필요: "회원 탈퇴 시 즉시 전체 삭제", "개별 리포트 삭제 즉시 처리", "GDPR Art.17 / PIPA 즉시 삭제 요청 대응 절차" 명문화.
- ⚠️ KO/EN 토글 제거(A 항목과 연동).

### 📜 [F] `terms.html` 개정 (이용약관) — **상태: 부분 완료**
- ✅ "art12" 보관/삭제 조항 키 추가됨 (`terms.art12_*` i18n).
- ⚠️ 추가 보강 필요: "회원 탈퇴 절차/방법", "삭제 후 복구 불가 안내", "법적 보존 의무가 있는 거래 정보(5년)는 별도 보존" 명문화.
- ⚠️ KO/EN 토글 제거(A 항목과 연동).

### 📋 [G] 마이페이지 보관 안내 카드 강화 — **상태: 미완료**
- 현재 문구: "리포트는 영구 보관됩니다 / 한글 페이지에는 한글 리포트, 영문 페이지에는 영문 리포트가 표시됩니다."
- 추가 필요 문구:
  - "회원 탈퇴 시 모든 리포트가 즉시 영구 삭제됩니다."
  - "개별 리포트는 카드 우측 휴지통 아이콘으로 즉시 삭제할 수 있습니다."
- i18n 키: `mypage.retention_desc_v2_*` (신규) 또는 기존 `retention_desc` 확장.

### 🗑️ [I] 개별 리포트 삭제 버튼 — **상태: 미완료**
- 위치: 마이페이지 각 리포트 카드 우상단.
- UI: 휴지통 아이콘 + 삭제 확인 모달("이 리포트를 영구 삭제하시겠습니까? 복구할 수 없습니다.").
- 동작: Firebase RTDB에서 다음 3개 노드 동시 삭제
  1. `reports/{uid}/{sid}`
  2. `users/{uid}/reports/{sid}`
  3. `programs/{uid}/{sid}` (있는 경우)
- i18n 키: `mypage.delete_*` 이미 추가됨(`delete_btn`, `delete_confirm_title`, `delete_confirm_msg`, `delete_success`, `delete_failure`). 사용 연결만 하면 됨.

### 🚪 [J] 회원 탈퇴 기능 신규 구현 — **상태: 미완료 (신규 기능)**
- **현재 회원 탈퇴 기능은 코드베이스에 존재하지 않음.** mypage.html 하단에 "회원 탈퇴" 섹션 추가 필요.
- UI: "회원 탈퇴" 버튼(빨간색, 작게) → 2단계 확인 모달("정말 탈퇴하시겠습니까?" → 비밀번호 재인증 또는 "탈퇴" 텍스트 입력).
- 동작 순서:
  1. Firebase Auth 재인증(`reauthenticateWithCredential` 또는 Google 재로그인).
  2. RTDB에서 `users/{uid}`, `reports/{uid}`, `programs/{uid}`, `responses/{uid}` 등 사용자 관련 모든 노드 삭제.
  3. Firebase Auth 계정 삭제(`deleteUser`).
  4. 로그아웃 처리 후 `index.html?lang={curLang}&deleted=1`로 이동.
  5. 메인 페이지 상단에 "탈퇴가 정상 처리되었습니다" 토스트 표시.
- i18n 키: `mypage.withdraw_*` 이미 추가됨. 연결만 하면 됨.
- ⚠️ **법적 보존 의무 데이터**: 결제/거래 기록은 전자상거래법상 5년 보존 의무가 있으므로 `payments/{uid}` 노드는 익명화(`uid` → `withdrawn_{timestamp}`)만 하고 데이터는 유지. 이 부분 사용자 확인 필요.

### ✅ [K] 정적 검증 스크립트 — **상태: 미완료**
- 검증 항목:
  1. `grep -rn "data-i18n-toggle" *.html`이 `report*.html`, `program*.html`, `privacy.html`, `terms.html`에서 0건.
  2. `header-link-fix.js`가 16개 페이지 모두에 로드됨.
  3. `mypage.html`에 신규 i18n 키 13개 모두 사용됨.
  4. `ko.json` / `en.json` JSON 파싱 OK + 키 동수 일치.
  5. 모바일 타임아웃 30s 코드 확인.
  6. 회원 탈퇴 핸들러 함수 존재 + RTDB 다중 삭제 호출 확인.

### 🧪 [L] 수동 QA 체크리스트 — **상태: 미완료**
**PC (Chrome 데스크톱)**
- [ ] 한글 로그인 → 마이페이지 → 리포트 4개 모두 표시(D 마이그레이션 후).
- [ ] 영문 로그인 → 마이페이지 → 리포트 4개 모두 영문으로 표시 또는 언어별 분리 표시(정책 재확인 필요).
- [ ] 한글 마이페이지 → 리포트 클릭 → KO/EN 토글 미노출 확인.
- [ ] 영문 마이페이지 → 헤더의 모든 링크가 `?lang=en` 부착.
- [ ] 리포트 카드 휴지통 클릭 → 모달 → 삭제 → 카드 즉시 사라짐.
- [ ] 회원 탈퇴 → 재인증 → 데이터 삭제 → 메인 페이지 이동.

**모바일 (iOS Safari + Android Chrome)**
- [ ] 한글 로그인 → 마이페이지 → 리포트 4개 표시(또는 언어별 표시).
- [ ] 영문 로그인 → 마이페이지 → 영문 UI + 영문 링크 동작.
- [ ] 햄버거 메뉴의 "마이페이지" 링크 → `?lang=` 부착 확인.
- [ ] LTE 환경에서 30s 이내 리포트 표시.
- [ ] 동기화 실패 시 "동기화 중" 메시지 + 재시도 버튼 노출.

---

## 2. 🗂️ 현재 작업 트리 상태 (미커밋)

```
modified:   assets/i18n/en.json              (i18n 키 51줄 추가/수정)
modified:   assets/i18n/ko.json              (i18n 키 51줄 추가/수정)
modified:   auth-fail.html                   (header-link-fix.js 로드)
modified:   index.html                       (header-link-fix.js 로드)
modified:   login.html                       (header-link-fix.js 로드)
modified:   mypage.html                      (보관 안내, sync_pending, 71줄 변경)
modified:   payment-fail.html                (header-link-fix.js 로드)
modified:   payment-success.html             (header-link-fix.js 로드)
modified:   privacy.html                     (보관 조항 17줄 추가)
modified:   product.html                     (header-link-fix.js 로드)
modified:   program-loading.html             (KO/EN 토글 제거)
modified:   program.html                     (KO/EN 토글 + 핸들러 제거, 37줄)
modified:   report-loading.html              (KO/EN 토글 제거)
modified:   report.html                      (KO/EN 토글 제거)
modified:   signup.html                      (header-link-fix.js 로드)
modified:   success.html                     (header-link-fix.js 로드)
modified:   suvey.html                       (header-link-fix.js 로드)
modified:   terms.html                       (art12 보관 조항 10줄 추가)

Untracked:
    assets/i18n/header-link-fix.js           (신규 헬퍼 스크립트)
```

**경고**: 이 변경사항들은 아직 커밋되지 않았습니다. 다음 세션은 우선 미완료 항목(C 잔여, D, E/F 보강, G, I, J, K, L)을 마무리한 뒤 한 번에 squash 커밋 후 PR #37 생성 권장.

---

## 3. 🎯 다음 세션 시작 시 권장 작업 순서

### Step 1: 사용자 결재 대기 항목 확인
1. **D**: 마이그레이션 방식 (D-1 스크립트 vs D-2 UI 버튼) — **권장: D-1**
2. **J**: 결제 데이터 익명화 정책 (전자상거래법 5년 보존 vs 전체 삭제) — **권장: 익명화**
3. **A 보강**: `privacy.html` / `terms.html` KO/EN 토글 제거 확정 — **현재 인계: 제거**

### Step 2: 미완료 항목 구현 (코드 작성 순서)
1. **A 잔여**: `privacy.html`, `terms.html`의 KO/EN 토글 마크업 제거.
2. **C 잔여**: `mypage.html` 모바일 타임아웃 30s 분기 + 동기화 실패 UI 메시지/재시도 버튼 연결.
3. **G**: 마이페이지 보관 안내 카드 문구 보강 + 신규 i18n 키 적용.
4. **I**: 리포트 카드 삭제 버튼 + 모달 + RTDB 다중 삭제 핸들러.
5. **J**: 회원 탈퇴 섹션 + 재인증 + 다중 노드 삭제 + Auth 계정 삭제 + 결제 데이터 익명화.
6. **E/F**: privacy/terms.html에 탈퇴/즉시 삭제 절차 문구 보강.
7. **D-1**: `scripts/migrate_report_lang.js` 작성 (Firebase Admin SDK 사용, 4개 레코드 KO ↔ EN swap, dry-run 옵션).
8. **K**: `scripts/validate_pr37.sh` 정적 검증 스크립트.
9. **L**: 수동 QA 체크리스트 README에 추가.

### Step 3: 커밋 / PR
```bash
cd /home/user/webapp && git add -A
cd /home/user/webapp && git commit -m "fix(i18n+ux+legal): PR #37 — 토글 제거, 헤더 링크 lang 부착, 모바일 마이페이지 안정화, 영구 보관 정책 + 개별 삭제/회원 탈퇴 기능, RTDB lang 라벨 마이그레이션"
cd /home/user/webapp && git fetch origin main && git rebase origin/main   # 충돌 시 remote 우선
cd /home/user/webapp && git reset --soft HEAD~N && git commit -m "..."   # 다중 커밋 시 squash
cd /home/user/webapp && git push -f origin genspark_ai_developer
# 그 후 GitHub CLI 또는 웹에서 PR #37 생성: genspark_ai_developer → main
```

---

## 4. 🧠 컨텍스트: 직전 PR들 요약

| PR | 핵심 변경 | 후속 영향 |
|----|---------|---------|
| #32 | 리포트 양방향 언어 자동 재생성 | ⚠️ **회귀 원인**: 언어 컨텍스트 누락 시 잘못된 언어로 새 리포트 생성. PR #37에서 양방향 자동 재생성 로직 제거 검토 필요. |
| #33 | ko.json 모지바케 56곳 복구 + 모바일 12s 타임아웃 | 안정화 기여. |
| #34 | 리포트/프로그램 lang-lock + 마이페이지 언어별 필터링 | 정책 기반. PR #37에서도 유지. |
| #35 | 표면 언어 = 저장 언어 정합 + persist 차단 + RTDB lang 화이트리스트 | localStorage 회귀 원인 일부. |
| #36 | i18n SSOT(URL ?lang= → html lang → readonly localStorage) + translate="no" + 마이페이지 보관 카드 + 타임아웃 20s | **현재 main 최신 커밋(4ca3722)**. |

---

## 5. 🔑 핵심 파일 위치

| 파일 | 역할 |
|------|------|
| `assets/i18n/i18n.js` | 언어 SSOT 로직(resolveLang/setLang/_navigateToLang). |
| `assets/i18n/header-link-fix.js` | (신규) 모든 내부 링크에 `?lang=` 자동 부착. |
| `assets/i18n/ko.json` / `en.json` | 모든 i18n 텍스트. |
| `mypage.html` | 마이페이지 — RTDB 인덱스/폴백 조회, 언어 필터링, 보관 안내, (예정) 삭제/탈퇴 버튼. |
| `report.html` / `program.html` | 리포트/프로그램 화면 — KO/EN 토글 제거 완료. |
| `privacy.html` / `terms.html` | 법적 페이지 — 보관/삭제 조항 보강 진행 중. |

---

## 6. 🚦 Firebase 환경 정보 (참고)

- 프로젝트 ID: `lifeporportfolio`
- RTDB URL: `https://lifeporfolio-default-rtdb.asia-southeast1.firebasedatabase.app`
- AppCheck 활성화 됨 (모바일에서 토큰 만료 시 silent fail 가능 — 디버그 로그 추가 권장).
- D-1 마이그레이션 스크립트는 사용자가 별도로 발급한 서비스 계정 키(`serviceAccount.json`) 필요. **저장소에 절대 커밋 금지** (`.gitignore` 확인).

---

## 7. ✋ 다음 세션 첫 응답 템플릿(권장)

> "인수인계 문서 확인했습니다. 다음 3가지 결재 항목만 확인 부탁드립니다:
> 1. 라벨 마이그레이션 방식 (D-1 스크립트 권장 vs D-2 UI 버튼)
> 2. 회원 탈퇴 시 결제 데이터 처리 (전자상거래법 5년 보존 위해 익명화 권장 vs 전체 삭제)
> 3. privacy.html / terms.html의 KO/EN 토글 제거 확정 여부
>
> 결재 즉시 [A 잔여 → C 잔여 → G → I → J → E/F → D-1 → K → L] 순으로 구현하고 PR #37 생성하겠습니다."

---

**문서 끝.** 작성자: GenSpark AI Developer 세션 / 다음 인계자가 즉시 작업 가능하도록 정리 완료.
