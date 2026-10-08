# 인생포트폴리오 다이어리 (한국어판) 공개 기록 — 2026-10-08

## 승인
- 대표: "아주 좋습니다. 배포해도 좋습니다!" → `chat-user-sha256:3c55f8dcb9bde7de6b509ab7f2954714`

## 공개 순서와 결과 (사실)
| 단계 | 근거 | 결과 |
|---|---|---|
| PR #352 필수 검사 6종 | PR checks | 통과 |
| main 병합 | a004fdb (squash) | 테스트 head 2a154d1 과 내용 차이 0 |
| Functions `diary` 1차 | run 37785275075 | 생성됨, **공개 호출 권한(invoker) 설정 실패** → 외부 호출 403 |
| Functions `diary` 2차 | run 37785936121 | 갱신 성공, 여전히 403 (권한은 재배포로 생기지 않음) |
| 권한 부여 | 대표가 Cloud Shell에서 `gcloud run services add-iam-policy-binding diary --region=asia-northeast3 --member=allUsers --role=roles/run.invoker` | 미로그인 호출 401 "로그인하면 다이어리에 보관됩니다", CORS 사전요청 204 |
| Hosting live | run 37788322444, source_run 37783023093, manifest a7cd106a… | 성공 |
| live-check | 290 파일 중 288 일치 | 불일치 2건(index.html, report-landing.html)은 점검 스크립트 한계: `/`와 `/report-landing`이 같은 주소로 이어짐. `/` 직접 조회 SHA는 기대값과 일치(367f3a95…) |
| 실제 사이트 브라우저 | Chromium·WebKit × 375/1280 | 미로그인 안내 화면 정상, 해설서 33쪽, 오류 0 |

## 다음에 새 callable 함수를 처음 만들 때
배포 계정에는 Cloud Run IAM 정책을 바꿀 권한이 없다. 처음 생성할 때는 위 `add-iam-policy-binding` 을 소유자가 1회 실행해야 한다(2026-09-18 getB2BCheckoutOrder 도 같은 증상). 이후 갱신 배포에는 필요 없다.

## 미확인
- 실제 회원 계정으로 쓰기 → 새로고침 확인(에이전트는 고객 계정으로 로그인하지 않음). 대표 계정으로 1회 확인 요청.
- 실기기(iPhone/Galaxy/iPad).

## 후속
- 저작권 표시: 법률 고문 의뢰(GenTeam lp-quality-gate, 메시지 5737233) 회신 후 문구 확정.
- 내려받기: PDF/인쇄(기본) + 텍스트.
