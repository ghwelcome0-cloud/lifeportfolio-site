# 🧪 PR #37 수동 QA 체크리스트

> 머지 직후 PC + 모바일 양쪽에서 약 7~10분 안에 완수 가능한 검증표.
> 모든 항목 통과 후 사용자에게 "운영 투입 가능" 보고.

---

## 0. 사전 준비
- [ ] 캐시·쿠키·localStorage 완전 초기화(시크릿 창 권장).
- [ ] 테스트 계정 2개 준비: KO 검사 1건/EN 검사 1건씩 보유한 계정 권장.
- [ ] 모바일 단말 1대(iOS Safari 또는 Android Chrome).

---

## 1. PC 시나리오 (Chrome 데스크톱)

### 1-1. KO/EN 토글 제거 확인
- [ ] `report.html`, `report-loading.html`, `program.html`, `program-loading.html`, `privacy.html`, `terms.html` 6개 페이지 어디에도 KO/EN 토글 버튼이 보이지 않음.
- [ ] DevTools에서 `document.querySelectorAll('[data-i18n-toggle]')` 결과가 0건 또는 정책상 유지되는 페이지(`index/login/signup/auth-fail/success/suvey/payment-*`)에서만 노출.

### 1-2. 헤더 마이페이지 링크 언어 부착
- [ ] `https://(domain)/?lang=en` 진입 → 헤더의 "My Page" 링크 마우스오버 시 URL 미리보기에 `?lang=en` 부착.
- [ ] 클릭 후 마이페이지 영문 UI로 진입(보관 안내 카드 영문 표시).
- [ ] `?lang=ko`로 다시 진입 → 헤더 링크에서 `?lang=` 파라미터가 제거되어 깔끔.

### 1-3. 마이페이지 보관 안내 카드
- [ ] 카드 내부 문구에 "회원 탈퇴 시까지 영구 보관", "🗑 메뉴로 즉시 삭제", "30일 이내 복구 불가 방식 파기"가 모두 표시.
- [ ] EN 페이지에서는 동일 의미의 영문으로 표시.

### 1-4. 리포트 개별 삭제
- [ ] 리포트 카드 우측에 `🗑 삭제` 버튼 노출.
- [ ] 클릭 → 확인 모달 → "취소" 버튼으로 닫기 정상.
- [ ] "영구 삭제" 클릭 → 카드가 즉시 사라짐 + 카운트(개수) 감소.
- [ ] Firebase Console에서 `reports/{uid}/{sid}`, `users/{uid}/reports/{sid}`, `programs/{uid}/{sid}` 3개 노드 모두 삭제 확인.
- [ ] 새로고침 후에도 삭제된 카드가 다시 나타나지 않음.

### 1-5. 회원 탈퇴 (테스트 계정 사용 권장)
- [ ] 마이페이지 하단의 "계정 설정" 섹션 + 빨간 "회원 탈퇴" 버튼 노출.
- [ ] 클릭 → 모달의 설명 7줄 모두 표시.
- [ ] "탈퇴" 단어 입력 전에는 "탈퇴 진행" 버튼 비활성화(opacity 0.55).
- [ ] "탈퇴" 입력 → 버튼 활성화 → 클릭 → 30초 이내에 처리 완료.
- [ ] (Google 계정인 경우) Google 재인증 팝업 정상 동작.
- [ ] (이메일/비번) 비밀번호 prompt 후 처리.
- [ ] 처리 후 `index.html?deleted=1&lang=…`로 이동.
- [ ] Firebase Console에서 `users/{uid}`, `reports/{uid}`, `programs/{uid}`, `responses/{uid}` 모두 비어 있고, Auth 사용자 목록에서도 사라짐.
- [ ] (결제 데이터 보유 계정) `payments/{uid}`는 사라지고 `payments_anonymized/withdrawn_<ts>_<rand>` 하위에 보존되어 있는지 확인.

### 1-6. 잔존 데이터 확인 (탈퇴 직전 KO 1건 / EN 1건 만든 후 탈퇴)
- [ ] 탈퇴 후 새 계정으로 회원가입 → 마이페이지가 깨끗하게 비어있음.

---

## 2. 모바일 시나리오 (iOS Safari + Android Chrome)

### 2-1. 마이페이지 0건 회귀 확인
- [ ] LTE/3G에서 마이페이지 진입 시 30초 이내에 리포트 카드 정상 표시.
- [ ] 인덱스/폴백 모두 실패한 환경(비행기 모드 토글로 재현)에서는 "리포트를 동기화하는 중입니다" 메시지 + 🔄 다시 시도 버튼 노출(스피너 무한 회전 X).
- [ ] DevTools 원격 디버그 콘솔에 `[MyPage] env: isMobile= true / timeouts= {auth:22000, idx:30000, direct:30000, active:12000}` 출력 확인.

### 2-2. 모바일 영문 마이페이지
- [ ] 영문 페이지(예: `index.html?lang=en`)에서 햄버거 → "My Page" → 영문 UI + 영문 보관 안내 카드 표시.
- [ ] 한글 페이지로 돌아온 뒤 다시 영문으로 가도 일관성 유지(끈적한 KO 잠금 X).

### 2-3. 모바일 삭제·탈퇴 모달
- [ ] 삭제 모달이 화면 가운데 정상 노출(가로 스크롤 발생 X).
- [ ] 탈퇴 모달의 입력창 포커스 시 키보드 정상 노출.

---

## 3. 라벨 마이그레이션 (선택, 사용자 지시 후)

> 사용자가 보고한 4개 리포트 KO 1 / EN 3 → KO 3 / EN 1 정정.

- [ ] `npm install firebase-admin` 사전 설치(로컬 또는 운영 백오피스).
- [ ] `serviceAccount.json` 발급 후 프로젝트 루트에 둠(.gitignore 보호 확인).
- [ ] dry-run으로 분포 확인:
  ```
  node scripts/migrate_report_lang.js --uid=<USER_UID> --dry-run
  ```
- [ ] 출력된 분포가 의도와 정반대(KO 1 / EN 3)임을 확인.
- [ ] swap 적용:
  ```
  node scripts/migrate_report_lang.js --uid=<USER_UID> --swap --apply
  ```
- [ ] `scripts/backups/backup_<uid>_<ts>.json` 백업 파일 생성 확인.
- [ ] 사용자 마이페이지에서 KO 페이지 3건 / EN 페이지 1건으로 정상 표시.

---

## 4. 회귀 테스트
- [ ] 새 검사 → 리포트 생성 → 마이페이지에서 정확한 언어로 표시.
- [ ] 영문 검사 → 영문 마이페이지에서만 보임(한글 페이지 X).
- [ ] 리포트 화면 KO/EN 토글 클릭 시 → 마크업 제거되어 동작 자체가 발생하지 않음.
- [ ] 로그아웃 후 재로그인 → 마이페이지 카운트/카드 동일.

---

## 5. 정적 검증 자동화
- [ ] `bash scripts/validate_pr37.sh` 실행 → "통과 65 / 실패 0" 확인.

---

## 6. 통과 기준
- 위 1, 2 섹션 모든 체크박스 통과.
- 3은 사용자 지시 후 별도 수행.
- 5는 항상 0 실패.

검증 일시: ____ / 검증자: ____ / 결과: 통과 / 보류 / 실패
