# 인생포트폴리오 데이터맵·ROPA 초안

**코드 기준:** `ghwelcome0-cloud/lifeportfolio-site` main `d2c7e11240b850904ea6d611032349cb9960e20d`  
**작성일:** 2026-08-13  
**성격:** 코드·저장소에서 확인 가능한 구현 사실을 정리한 1차 초안. 법률 적합성 결론이 아니며, 콘솔 설정·계약서·벤더 DPA·실제 운영 데이터·백업 정책은 별도 증빙이 필요하다.

## 1. 시스템·저장 위치 개요

| 시스템 | 코드상 역할 | 확인된 위치/리전 | 확인 필요 |
|---|---|---|---|
| Firebase Authentication | 이메일/비밀번호, Google, Kakao OIDC 로그인 | Firebase 프로젝트 `lifeporfolio`; Auth 리전은 저장소에서 미확인 | Auth 데이터 처리 위치, 소셜 제공자 전달 항목, 계정 삭제 전파 |
| Firebase Realtime Database | 사용자 프로필, 결제권, 설문 응답·행동로그, 리포트·프로그램, 후기, B2B 접근권 | database URL이 `asia-southeast1` 도메인 | 백업/복제/보존, 실제 Rules 배포본 |
| Cloud Firestore | 리드·문의·B2B 주문/코드/연결, 체크인 응답·채팅·에스컬레이션, 운영 로그 | Functions는 주로 `asia-northeast3`; Firestore DB location은 미확인 | DB 리전, PITR/backup, TTL 실제 활성화 |
| Cloud Functions | 결제 승인, 이메일, 문의, B2B, 체크인·채팅, 파기 스케줄 | 코드상 `asia-northeast3` | 배포된 함수/환경/로그 보존 |
| Firebase Hosting | 정적 웹·클라이언트 JS | 프로젝트 `lifeporfolio`; edge 처리 위치 미확인 | CDN 로그·보존·국외 처리 |
| Payple | KO 카드/계좌 최초·추가 결제 승인 | 외부 API; 최종승인은 Functions에서 호출 | 계약 주체, 서버/처리 국가, 보존, 재위탁 |
| PayPal | EN 최초·추가 결제 승인 | 외부 API; sandbox/live 선택 | 계약 주체, 처리 국가, 보존, 재위탁 |
| Resend | 사용자·운영자·B2B·체크인 이메일 발송 | 외부 API | 발송 로그/본문 보존, 처리 국가, DPA/SCC, 삭제 |
| GA4/GTM | 페이지·퍼널 이벤트 | `G-C8XKL4L9MZ`, `GTM-WWNXZLZX` | live container/export, consent mode, retention, BigQuery link, advertising features |
| Microsoft Clarity | 세션 분석 후보 | 홈에서 동의+project ID 조건부, 기본 dormant | 실제 project ID/활성 여부, masking, retention, 처리 국가 |

## 2. 처리활동별 데이터맵

### A. 일반·소셜 가입/로그인

- **경로:** `signup.html`, `login.html`, Firebase Auth, RTDB `users/{uid}`.
- **필수/선택 데이터:**
  - 이메일 가입: 이메일·비밀번호(평문은 앱 DB에 저장하지 않고 Firebase Auth로 전달), 표시명 입력 가능.
  - Google/Kakao: provider identity에서 uid, email, displayName 등 제공 가능한 값.
  - RTDB profile: email, displayName, createdAt, lastLogin.
  - 만 14세 이상 checkbox와 약관/방침 링크가 있으나 동의 버전·문구 hash·시각을 append-only로 저장하는 증거 없음.
- **목적:** 인증, 계정 식별, 로그인 상태·프로필 제공.
- **저장/접근:** Firebase Auth + RTDB; 본인 read/write Rules.
- **보유/삭제:** UI/방침은 탈퇴 시 삭제를 표방. 실제 탈퇴는 `mypage.html` client flow로 Auth 및 RTDB를 삭제하나 Firestore의 모든 사용자 관련 문서와 백업 삭제는 보장하지 못함.
- **수탁/제3자:** Google Firebase; Google/Kakao 소셜 로그인 제공자.
- **미확인:** Auth backup·로그 보존, 소셜 provider별 수신 필드, 만 14세 서버 차단, 기존계정/우회 처리.

### B. B2B 담당자 견적·주문·결제 신고

- **경로:** `b2b-quote.html`, `b2b-checkout.html`, `functions/_b2b_group_module.js:submitB2BQuote/reportB2BPayment`, Firestore `b2b_orders`.
- **필수 데이터:** orgType, orgName, contactName, contactEmail, seats, agreedContract, agreedPrivacy.
- **선택 데이터:** 사업자번호, 직책, 전화, 다이어리 수량, marketing 동의, memo, 로그인 uid.
- **파생/운영:** 주문번호, 가격/VAT/합계, 상태, orgCode, 코드 발급·사용 수, 생성/갱신/입금신고/승인/환불 시각, 이메일 발송 결과.
- **목적:** 견적, 계약·입금 확인, 코드 발급, 환불, 고객지원.
- **저장:** Firestore `b2b_orders`; Admin SDK write. 담당자 본인 또는 admin read.
- **전달:** Resend로 담당자 및 운영자에게 주문·연락처·메모·가격·주문번호가 포함된 이메일 발송.
- **보유/삭제:** `b2b-privacy.html`은 계약/결제/세금 기록 5년 등을 고지하나 코드상 TTL/자동 파기 없음.
- **미확인:** 동의 문서 버전·hash·시각, 계좌 입금 증빙 원본, 세금계산서 흐름, Resend 보존/국외이전, 백업 파기.

### C. B2B 참여자 가입·코드 연결

- **경로:** `b2b-join.html`, `verifyB2BCode`, Firestore `b2b_codes`, `b2b_user_links`, RTDB `b2b_access/{uid}`.
- **데이터:** 조직 ID, Access Code, Firebase uid/email, orgName, orderId, diary 여부, linked/used 시각.
- **목적:** 구매 좌석 검증, 참여자 서비스 접근권 부여, 사용량 집계.
- **저장:** Firestore가 SoT; RTDB 접근 노드는 보조이며 write 실패를 비치명적으로 처리.
- **보유/삭제:** 코드/연결의 파기 정책·조직 계약 종료 시 삭제가 코드에 없음. 일반 탈퇴 flow가 Firestore `b2b_user_links`/`b2b_codes.usedBy*`를 지우지 않음.
- **위험:** access code가 raw로 Firestore에 저장되고 이메일로 전달됨. URL/query, 로그, analytics 노출 차단 테스트 필요. HR/선발 사용 금지는 데이터 권한만으로 강제되지 않음.

### D. 설문·응답·행동로그

- **경로:** `suvey.html`; RTDB `responses/{uid}/{sid}`.
- **필수/선택:** status, answers(qid별 string/number/bool/object), started/updated/submitted 시각. name, email, recvMethod, lang, userAgent는 nullable. qlog는 qid별 체류시간 d, 수정횟수 r, 최초응답 시각 t.
- **목적:** 진단 산출물 생성, 중단 후 재개, 품질/행동 분석.
- **접근:** 현재 client 본인 read/write. 데이터는 운영 분석과 연구용으로 물리 분리되지 않음.
- **보유/삭제:** 리포트와 함께 탈퇴 전까지 보관 고지; 개별 미완료 세션 삭제 가능. backup/replica 파기 미확인.
- **위험:** 원문 answers와 name/email/User-Agent/qlog가 같은 사용자 노드에 결합됨. 연구 동의·분리저장·최소화가 없음. qlog를 연구에 사용하려면 별도 목적/동의/보유가 필요.

### E. 응답 코드(fingerprint)

- **경로:** `assets/js/report-engine-v4.js`, `report-loading.html`, `report.html`, `assets/js/program-engine.js`, `program.html`.
- **데이터:** 56 core 응답에서 파생되는 32-bit fingerprint와 64-bit `fingerprint64`; report `_v4Meta`와 program `_uniqGuard`에 포함.
- **목적:** 동일 release/engine/input 내 결정적 변주와 응답 코드 표시.
- **저장/노출:** RTDB report/program JSON, 화면/PDF, 로그에 일부 출력.
- **분류:** 응답 파생 가명 식별자. 다른 정보와 결합해 개인을 알아볼 가능성을 배제할 수 없으므로 개인정보 비해당으로 단정 금지.
- **위험:** 코드가 URL·analytics·서버/브라우저 로그에 유입되지 않는 계약 테스트가 필요. release manifest가 완성되지 않아 장기 재현 범위도 제한됨.

### F. 리포트·실행 프로그램·PDF

- **경로:** `report-loading.html`, `program-loading.html`, `report.html`, `program.html`; RTDB `reports/{uid}/{sid}`, `programs/{uid}/{sid}`, `users/{uid}/reports|programs`.
- **데이터:** sid, 생성 시각, engine/rules version, tone, signature, lang, report/program 본문, `_v4Meta`, manual override/status, edit count; PDF는 브라우저에서 생성/다운로드.
- **목적:** 진단 결과 및 실행 프로그램 제공·재열람·PDF 저장.
- **접근:** 현재 client 본인 read/write; manual override 등도 client Rules 범위에 있음.
- **보유/삭제:** 마이페이지는 계정 동안 영구 보관, 개별 report+program 삭제, 탈퇴 삭제를 표방. CDN/다운로드된 PDF/브라우저 저장본은 서비스가 회수할 수 없음.
- **전달:** PDF 다운로드는 사용자 기기로 이동. 이메일 첨부 경로는 B2B 코드/기타 템플릿과 구분해 별도 확인 필요.

### G. B2C 결제·추가결제·복구

- **경로/저장:** RTDB `payments/{uid}`, `additionalPayments/{uid}/{token}`; Functions `capturePaypalOrder`, `captureAdditionalPaypalOrder`, `confirmPayplePayment`, `confirmAdditionalPayplePayment`, `consumeAdditionalToken`, `grantPaidByEmail`.
- **데이터:** uid, paid/status, provider/env/payType, order/capture/oid, amount/currency, 생성·소비 시각, consumed sid; Payple payerId/payerNo도 payment record에 저장. admin 복구에는 recoveredBy email/uid, note가 저장.
- **목적:** 결제 승인, 접근권, 중복/재사용 차단, 고객 복구, 매출/환불 증빙.
- **제3자:** Payple/PayPal에 인증·주문·금액·통화·사용자 정의 uid 등이 전달될 수 있음.
- **보유/삭제:** 탈퇴 client flow가 payment를 `payments_anonymized`로 옮겨 5년 보존 후 scheduler 삭제를 의도. 그러나 현재 client write authority 및 Rules hardening과 충돌하며 서버 이관 필요.
- **중대한 공백:** 주문별 약관·방침·환불·제공개시 동의 버전/시각/상품/가격/언어 append-only 원장이 없음. provider raw response/log 보존도 미확인.

### H. B2B 입금·환불

- **경로:** `_b2b_group_module.js`; Firestore `b2b_orders`, `b2b_codes`.
- **데이터:** 주문/입금신고/승인/환불 상태, 금액, 사유, refundBasis, 처리자 email/uid, 코드 폐기, 이메일 결과.
- **목적:** 수동 입금 승인, 좌석 발급, 환불 및 감사.
- **보유:** 문서상 5년 고지; 자동 파기 구현 미확인.
- **위험:** 수동 refund override, 이중 승인/증빙 ref, 동의 버전 원장이 부족.

### I. 문의·리드·후기

- **무료 리드:** Firestore `lead_captures`; email 필수, name 선택, campaign/source/lang/page/referrer/UTM, marketing 동의, 상태·발송 결과. Resend로 사용자·운영자 전송.
- **B2B 문의:** `b2b_inquiries`; 이름/회사/email/동의 필수, 직책/규모/전화/패키지/message/URL/referrer/UTM 선택. Resend 전송.
- **후기:** RTDB `reviews/{id}` 및 승인 후 `reviews_published`; uid/sid, displayName, text, consent, 상태, 생성/수정/공개 시각. 공개본 삭제 function 존재.
- **보유/삭제:** 각 collection의 구체 보유/TTL 없음. 문의 자유문·URL query의 민감정보 redaction 필요.

### J. 21일 체크인·ask/채팅·연구 유사 흐름

- **체크인 응답:** Firestore `checkin21_responses`에 email, 구매일, lang, 12문항 answers, revision, timestamp.
- **채팅 로그:** `checkin21_chat_logs`에 session_id, email, 구매일, lang, script version, node/option 또는 최대 500자 자유입력, turn index, timestamp.
- **운영진 연결:** `checkin21_chat_escalations`에 email/session/note/예약 상태 등; Resend 알림.
- **인증:** URL query에 email, purchaseDate, HMAC sig를 사용하며 chat 페이지로 전달되는 구조. URL·브라우저 history·analytics·referrer 노출 검토가 필요.
- **보유:** privacy 문서는 ask 로그 90일 순차 삭제를 주장하지만 `checkin21_chat_logs`에 TTL/90일 purge 구현이 확인되지 않음. 이는 즉시 정합화가 필요한 HIGH gap.
- **연구:** 별도 연구 동의·연구 participant ID·제한 저장소·철회 flow가 확인되지 않음. 체크인/설문 데이터를 연구에 사용하기 전 분리 설계 필요.

### K. 분석도구

- **GA/GTM:** 다수 페이지에서 동의 전 GTM·direct gtag 로드, page view 및 login/signup/purchase/assessment/report events. `anonymize_ip:true`는 있으나 Consent Mode default-denied 증거 없음.
- **Clarity:** `index.html`에서 `lp_consent_analytics=granted`이고 project ID가 있을 때만 로드하도록 dormant gate. 실제 활성 여부 미확인.
- **위험:** GTM과 direct gtag 중복, URL/query/referrer로 email/signature/code가 전달될 수 있음. live container·retention·BigQuery·ads 기능을 확인해야 함.

### L. 이메일

- **처리:** Resend API를 Functions에서 호출. 수신자 email, reply-to, 이름/조직/주문/문의/메모/코드/가격/상태 및 일부 PDF attachment가 전송될 수 있음.
- **목적:** 거래 안내, 코드 발급, 문의 확인, 리드 파일, 체크인/코칭 알림, 운영자 알림.
- **저장:** Firestore에는 발송 성공 bool/시각 또는 test log가 남음. Resend 측 본문/로그 보존·리전은 미확인.
- **위험:** 운영자 알림에 원문 문의·연락처가 복제되어 삭제 범위가 넓어짐. email template/CS fixture까지 ROPA 및 삭제 절차에 포함해야 함.

## 3. 탈퇴·파기·백업 흐름

1. `mypage.html`이 client에서 payment를 읽어 `payments_anonymized`로 복사하고 원본 삭제.
2. `withdrawn_logs`에 uid 일부 마스킹, 통계, anonPayId, 30일 purgeAt 기록.
3. RTDB reports/users/responses/programs/reviews 등의 삭제 후 Firebase Auth 계정 삭제.
4. `purgeExpiredWithdrawnData` scheduler가 withdrawn logs 및 5년 경과 anonymized payments 삭제를 시도.

**공백/모순**
- 사용자에게 “탈퇴 시 30일 이내 완전 파기”라고 안내하지만 본문 데이터는 즉시 client delete하고 audit log만 30일 보유하는 구조여서 표현이 불명확.
- Firestore의 B2B link/code, lead, inquiry, checkin/chat/escalation, email provider 사본, Cloud logs, backups는 탈퇴 flow에 포함되지 않음.
- client payment write를 닫으면 archive/delete 단계가 실패하므로 server callable로 이관해야 함.
- RTDB/Firestore/Auth/Hosting/Functions 로그의 backup/PITR/replica 파기 증거가 없음.

## 4. 우선 보완해야 할 ROPA 증빙

### CRITICAL/HIGH
1. 모든 가입 유형의 만 14세 서버 차단과 동의 evidence ledger.
2. 모든 B2C/B2B 주문에 policy/refund/service-start consent version·hash·time·product·price·currency·lang append-only 저장.
3. ask/checkin chat 90일 TTL 또는 purge job + deletion test; URL의 email/sig 제거 또는 one-time opaque token화.
4. 탈퇴를 server orchestration으로 이관하고 RTDB·Firestore·Auth·Resend/로그·backup 처리 결과 receipt 저장.
5. response code를 가명 식별자로 분류하고 URL/log/analytics 미노출 contract test.
6. GA/GTM Consent Mode default-denied, query redaction, live container/export/retention 증빙.
7. B2B 조직 관리자에게 개인 answers/report가 노출되지 않음을 Rules·Callable·UI E2E로 증명하고 HR/선발 사용 금지를 계약·권한에 반영.

### 벤더별 미확인 증빙
- Firebase: Auth/RTDB/Firestore/Hosting/Functions 실제 리전, backup/PITR, log retention, subprocessors, DPA/국외이전 장치.
- Payple/PayPal: 전달필드, 처리국가, 보유기간, 환불/분쟁 로그, DPA/재위탁.
- Resend: email content/log retention, region, subprocessors, deletion API, DPA/SCC.
- GA/GTM/Clarity: account owner, data sharing/ads settings, retention, export, masking, consent, processing country.

## 5. ROPA 운영 필드 권고

각 처리활동은 다음을 machine-readable registry로 관리한다.

`activity_id, owner, data_subjects, purpose, legal_basis_pending_review, data_categories, required_optional, source, system, region, recipients, processors, international_transfer, retention_rule, backup_rule, deletion_trigger, deletion_job, access_roles, security_controls, consent_artifact, code_paths, evidence_links, last_verified_sha, unresolved_findings`

법적 근거와 국외이전 적법성은 이 초안에서 확정하지 않고 법률 고문 검토 필드로 남긴다.

## 6. PR-L0 legal manifest 연결 계약

ROPA의 각 주문·가입·접근 이벤트는 PR-L0 manifest의 immutable identifier를 참조해야 한다. 문구 원문을 이벤트마다 복제하지 않는다.

### legal manifest 필드

- `legal_manifest_id`, `schema_version`, `status`(`draft|active|retired`)
- `audience`(`b2c|b2b_contact|b2b_participant`), `locale`(`ko|en`)
- `product_id`, `product_version`, `price_minor`, `currency`
- `terms_version`, `terms_sha256`, `privacy_version`, `privacy_sha256`
- `refund_policy_version`, `refund_policy_sha256`
- `service_start_consent_version`, `service_start_copy_sha256`
- `age_policy_version`, `minimum_age`, `guardian_flow_supported`
- `effective_at`, `retired_at`, `source_git_sha`, `generated_at`
- `document_paths`와 각 문서 content hash

### event/ledger 연결 필드

- `event_id`, `event_name`, `schema_version`, `server_occurred_at`, `server_received_at`
- `subject_pseudo_id`, `order_id`, `product_id`, `payment_kind`, `provider`, `provider_reference_pseudo`
- `legal_manifest_id`, `locale`, `price_minor`, `currency`
- `terms_accepted_at`, `privacy_acknowledged_at`, `refund_accepted_at`, `service_start_accepted_at`
- `age_gate_result`, `age_policy_version`, `authority`, `source_system`
- 결정적 idempotency key와 payload hash; 동일 key/상이 payload는 conflict로 격리

### fail-closed validation

- active manifest가 정확히 1개가 아니거나 hash·locale·가격·통화가 일치하지 않으면 주문/가입 evidence 생성 실패.
- client가 manifest ID, effective state, 가격/통화, server timestamp, age result를 임의 지정하지 못해야 함.
- retired/draft/future-effective manifest, hash mismatch, KO/EN 교차, B2C/B2B 교차 fixture를 모두 거부.
- PR-L0는 schema/manifest/fixture만 추가하고 데이터 write·결제 동작·Rules를 변경하지 않는다.

## 7. 확인 상태·담당·기한·배포 영향

기한은 대화에서 날짜로 지정되지 않았으므로 임의로 만들지 않고 **배포 전 필수** 또는 **법률 문서 개정 전 필수**로 표기한다.

| 항목 | 상태 | 확인 근거/공백 | 담당 | 기한 | 배포 영향 |
|---|---|---|---|---|---|
| B2C 이메일·Google·Kakao Auth 및 RTDB profile | 확인 | `signup.html`, `login.html`, `users/{uid}` | 엔지니어 | PR-L2 전 | 서버 연령 차단 전 출시 불가 |
| 만 14세 checkbox | 부분 확인 | client checkbox 존재; 서버 차단/기존계정/우회 방지 없음 | 엔지니어·테크 리드 | PR-L2 전 | CRITICAL open |
| B2B 참여자 code link | 확인 | `verifyB2BCode`, `b2b_codes`, `b2b_user_links`, `b2b_access` | 엔지니어 | PR-L1D/L2 전 | age·HR 차단 전 B2B 확대 불가 |
| 설문 answers/qlog와 직접식별 필드 결합 | 확인 | RTDB `responses` schema | 데이터 엔지니어 | ROPA 실구현 대조 전 | 연구/분석 재사용 금지 |
| response code 가명 식별자 | 확인 | 32/64-bit 파생값이 report/program/PDF에 저장·노출 | 엔지니어·데이터 엔지니어 | PR-L4 전 | URL/log/analytics 미노출 테스트 전 배포 불가 |
| PayPal 최초·추가 서버 승인 writer | 확인 | `capturePaypalOrder`, `captureAdditionalPaypalOrder` | 엔지니어 | PR-L1B 전 | ledger/동의 연결 전 권위 완료 아님 |
| Payple A2 최초·추가 서버 승인 writer | 부분 확인 | 코드상 confirm functions 존재; 실제 provider sandbox/production 검증 미확인 | 엔지니어 | PR-L1C 전 | 검증 수단 미입증 시 추가결제 출시 금지 |
| legacy client `paid:true` 및 timestamp token | 확인 | `payment-success.html`, `issuePaypleAdditionalToken` | 엔지니어 | PR-L1A/L1C 전 | Rules deny 전 CRITICAL |
| 주문별 동의 evidence ledger | 미구현 | bool 또는 화면 동의만 있고 version/hash/time 원장 없음 | 엔지니어 | PR-L1B/C/D 전 | 모든 결제수단 출시 게이트 |
| B2B 입금신고와 승인 분리 | 부분 확인 | status 흐름 존재; contract/권한 E2E 필요 | 엔지니어·테크 리드 | PR-L1D 전 | reported 상태에서 코드발급 금지 증명 필요 |
| B2B 개인 결과 HR/선발 사용 차단 | 미확인 | 조직 link는 있으나 계약·Rules·Admin endpoint·UI 종단 차단 증거 없음 | 테크 리드·엔지니어·법률 고문 | PR-L1D 및 문서 개정 전 | CRITICAL |
| 탈퇴 RTDB/Auth client flow | 확인 | `mypage.html` | 엔지니어 | PR-L3 전 | Rules deny와 충돌; server state machine 전환 필요 |
| Firestore/Resend/log/backups까지 파기 | 미확인 | 탈퇴 flow에서 누락 | 엔지니어·데이터 엔지니어 | PR-L3 전 | 완전 파기 단정 금지 |
| ask/checkin chat 90일 파기 | 불일치 | 방침은 90일, TTL/purge 구현은 확인되지 않음 | 엔지니어 | PR-L3 전 | HIGH; 문구 또는 동작 정합화 필요 |
| GA/GTM 동의 전 로드 | 확인 | 다수 페이지에서 GTM/direct gtag 즉시 로드 | 엔지니어·데이터 엔지니어 | PR-L4/방침 전 | Consent Mode·국외이전 증빙 전 법률 승인 불가 |
| Clarity 실제 활성 | 미확인 | 코드상 consent-gated dormant | 데이터 엔지니어 | ROPA 실구현 대조 전 | 활성이라면 벤더 증빙 필수 |
| Firebase 실제 DB 리전·backup/PITR/log retention | 미확인 | RTDB URL/Functions region만 코드 확인 | 데이터 엔지니어 | 법률 문서 개정 전 | 국외이전·파기 문구 확정 불가 |
| Payple/PayPal/Resend DPA·처리국가·보유 | 미확인 | API 사용만 코드 확인 | 법률 고문·운영 책임자 | 문서 개정 전 | 국외이전/수탁 고지 확정 불가 |
| GA/GTM/Clarity retention/export/account setting | 미확인 | repository 밖 콘솔 정보 | 데이터 엔지니어·운영 책임자 | 문서 개정 전 | 방침·동의 게이트 미완료 |

## 8. 배포 판단

- 이 초안은 **P0-L1 사실 증빙**이며 배포 승인 artifact가 아니다.
- 현재 전체 v2/live/rollback freeze를 유지한다.
- PR-L0는 동작 변경 없는 manifest/schema 단계로만 진행하고, L1/L2/L3 서버 권위가 연결되기 전 “법률 완료”로 표시하지 않는다.
- 최종 ROPA는 exact main SHA, 실제 Firebase/벤더 콘솔 증빙, preview fixture, 삭제/동의/연령/결제 E2E를 다시 대조해야 한다.
