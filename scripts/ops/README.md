# ops — 운영 데이터 접근 스크립트

규칙(제품 트랙, TL 6031735 · Peer 6031734, 2026-10-11):
- 운영 데이터를 **읽거나 쓰는 모든 워크플로**는 실행 head SHA와 스크립트 sha256을 가리키는 **TL 원문 메시지 ref**가 있을 때만 실행한다. 전사 블록만으로 실행 금지.

**대체(2026-10-12, 대표 결정 · TL 6076105 · Method 6076117 · Peer 6076118 기록):** 위 "TL 원문 ref가 있을 때만 실행" 규칙(op:140·142)은 `production-live` 승인 규칙으로 **대체**되었다.
- `production-live` environment: Required reviewers = ghwelcome0-cloud(관리자 우회 없음). 승인 대기는 대표 부재 시에도 멈추지 않도록 대표가 승인 권한을 위임했다.
- **`firebase-functions-deploy`**: 작업 중 대표의 **별도 허용**(원문 메시지 id)이 없으면 대표 승인 원칙. 허용이 있으면 `ALLOW <head_sha7> <누가> <대표 허용 메시지 id>` 로 기록 후 승인.
- **그 외(hosting-live · admin-live · database-rules-live · functions-diagnose)**: head가 **그 시점 main HEAD**와 같을 때만 자동 승인(main 조상이라도 옛 commit이면 HOLD — 되돌림 배포 차단). 멈춤 파일이 있으면 전부 HOLD.
- **남는 위험(TL·Method, 사실 그대로):** `database-rules-live`·`admin-live`는 운영 고객 데이터·접근 규칙에 닿는다(⑦이 이 범주에서 발생). 이 결정으로 두 워크플로의 보호 장치는 **main merge 검토 하나**만 남는다.
- `rtdb-status-audit.DISABLED.cjs`: 2026-10-11 run 38183348136에서 1회 실행된 판(`5c997cba…`). TL 6030728 조건 3건(키만 읽기 · status 문자열 미출력 · 인덱스 노드 집계) 미반영 상태로 실행됨 → 워크플로 삭제, 스크립트는 기록용으로만 보존(실행 금지). 재집계가 필요하면 shallow 키 읽기(`?shallow=true`)로 다시 작성해 TL 대조 후 실행.
