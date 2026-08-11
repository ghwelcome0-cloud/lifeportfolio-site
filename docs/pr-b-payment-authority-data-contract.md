# PR-B 결제 권위·서버 이벤트 데이터 계약

> Gate -1 보조 명세. 이 문서는 서버 권위 전환의 테스트 계약이며, 단독으로 운영 Rules를 잠그지 않는다.

## 배포 순서

1. PayPal, Payple A2, 추가결제의 서버 승인·멱등 경로를 먼저 배포한다.
2. 합성 fixture로 정상·변조·중복·동시 요청 E2E를 통과한다.
3. 성공 페이지가 `paid:true`를 만들지 않고 서버 상태만 조회하도록 전환한다.
4. 기존 유료 사용자의 read/access 회귀가 없음을 확인한다.
5. 마지막으로 `payments/{uid}` client write를 deny하는 Rules를 적용한다.
6. 재검증 후에만 운영 승인을 요청한다.

Rules만 먼저 적용하는 배포와 client write 재개를 rollback으로 사용하는 방식은 금지한다.

## 권위 이벤트 체인

`purchase_verified → assessment_session_created → assessment_submitted → report_generated → report_viewed → program_generated → action_completed → return_visit → refund_completed`

- 원장은 append-only이며 서버 성공 write 뒤에만 기록한다.
- `event_id`는 event name과 provider order/capture, sid, report/action ID 등 불변 business key로 결정한다.
- 같은 ID·같은 payload 재실행은 no-op, 같은 ID·다른 payload는 충돌 원장으로 격리한다.
- `report_first_viewed:{uid}:{sid}:{report_id}`는 최초 열람 receipt, 반복 열람은 nonce 원시 이벤트다.
- `meaningful_return`은 원시 이벤트가 아니라 검증된 `return_visit`에서 계산하는 버전 관리 metric이다.
- 기존 GA `purchase`, `assessment_start`, `assessment_complete`, `report_view`는 client/legacy namespace이며 권위 KPI에 사용하지 않는다.

## 이벤트 최소 필드

- `schema_version`, `event_name`, `event_id`
- 서버가 부여한 `occurred_at`, `received_at`
- `subject_pseudo_id`, 필요한 최소 `uid/sid/order/report/action` 연결키
- `authority=server_verified`, `source_system`
- `release_id`, `consent_version`
- 이벤트별 allowlist properties

이메일, 이름, 전화번호, 주소, IP/User-Agent 원문, 자유문, 진단 원응답은 금지한다. 행동 원장과 원문 응답/연구 데이터는 저장·권한·보존을 분리한다.

## 합성 fixture 매트릭스

`tests/fixtures/payment-authority.synthetic.json`만 사용한다. 운영 식별자를 fixture·로그·PR에 복사하지 않는다.

| 흐름 | 정상 | 거부/멱등 |
|---|---|---|
| PayPal 최초 | 서버 capture 완료 후 paid/read access | amount/currency/uid 불일치, capture 재사용 |
| Payple A2 최초 | 서버 최종승인 후 paid/read access | client `paid:true`, 변조 order, 중복 승인 |
| Payple 추가 | 기존 paid 확인 + 서버 승인 + unused token | 무결제 사용자, token 재사용, 동시 consume |
| 기존 유료 사용자 | 기존 `paid:true` read/access 유지 | client update/delete는 거부 |
| 타 사용자 | 자기 record만 read | 타 uid read/write 모두 거부 |

## 완료 기준

- Rules Emulator: 신규 create/update/delete와 기존 paid update/delete의 client write가 모두 거부된다.
- Admin/server fixture만 권위 record를 생성할 수 있다.
- PayPal/Payple/추가결제 정상 경로와 기존 유료 사용자 접근이 회귀하지 않는다.
- 동일 승인 콜백 2회에서 결제 record와 `purchase_verified`가 각각 1건이다.
- 합성 E2E 로그에 직접식별자·secret·provider raw body가 없다.
- Functions + Rules는 fail-closed 순서로 배포하고 직전 안전한 서버+Rules 세트로 함께 rollback한다.
