# KB-05 배포 거버넌스 플레이북 — 운영 배포를 멈추지 않으면서 통제하는 법

실전: `ghwelcome0-cloud/lifeportfolio-site`, GitHub Environment `production-live`(id 19657041519), 2026-10-11~12. 규칙 원문 `scripts/ops/README.md`(PR #406).

## ① 확인된 것
**GitHub 쪽 사실**
- Environments에 "설명란"은 **없다**(⑫). 쓸 수 있는 보호 장치: Required reviewers(최대 6), Wait timer, Deployment branches, `can_admins_bypass`, `prevent_self_review`.
- 현재 설정: Required reviewers = 대표 계정, admin bypass 불가, self-review 방지 없음. **승인은 대표 계정 토큰을 쓰는 승인기(데몬)가 수행 — 사람 확인 아님**(Peer #406 권고 문장).
- 대기 중 배포 승인 API: `POST repos/{o}/{r}/actions/runs/{id}/pending_deployments` with `--input -` JSON `{"environment_ids":[...],"state":"approved","comment":"..."}`. `-f environment_ids[]=` 형식은 실패한다.
- `gh api .../pending_deployments`의 `current_user_can_approve`로 자기 권한 확인.

**대표 결박(2026-10-12)**
- "function 쪽은 작업 중 별도 허용이 없으면 원칙적으로 대표 승인. 나머지는 자동."
- 승인기 규칙(`/home/user/work/deploy-approver.sh`, pm2 `deployapprover`, 60초):
  - `firebase-functions-deploy` → `deploy-allow.txt`에 `ALLOW <sha7> <누가> <대표 허용 메시지 id>` 줄이 있을 때만 승인(원문 대신 **메시지 id**를 적어 사후 대조). 없으면 HOLD + 로그.
  - hosting-live / admin-live / database-rules-live / functions-diagnose → head가 **그 시점 main HEAD와 같을 때만** 자동 승인(팀 권고: "main 조상"이면 옛 커밋 되돌림 배포도 통과하므로 금지). 아니면 HOLD.
  - 멈춤 파일 `deploy-STOP`이 있으면 전부 HOLD. 모든 결정은 로그 + 승인 comment.
- 이 결정은 이전 결박(op:140·142 "운영 데이터 워크플로는 TL 원문 ref 있을 때만")을 **대체**한다 — README와 #385에 대체 사실 기록(서로 반대인 규칙 2개가 남지 않게).

**남는 위험(팀이 적어 둔 것, 사실 그대로)**
- database-rules-live·admin-live는 고객 데이터·접근 규칙에 닿는데, 이제 보호 장치는 **main 머지 검토 하나**뿐.
- 승인기는 **샌드박스가 살아 있을 때만** 돈다. 꺼지면 대기 상태로 남는다 → 다음 접속 때 승인.
- `gh` 토큰 범위 축소(TL 권고)는 플랫폼 발급 토큰이라 우리가 못 한다.

**워크플로 주석(PR #401)**: 운영 자격증명 워크플로 5개 머리말에 규칙 3줄(동작 변경 0). 사람이 파일을 열면 먼저 보이게.

## ② 아직 모르는 것
- 샌드박스 없이도 자동 승인하려면 GitHub Actions 안에서 환경 승인을 자동화해야 하는데, Required reviewers와 양립하는 공식 방법은 미확인(Wait timer로 바꾸는 선택지는 대표 결정 사항).

## ③ 도구·파일
- `/home/user/work/deploy-approver.sh`, `deploy-allow.txt`, `deploy-approver.log`, 멈춤 파일 `deploy-STOP`
- 수동 승인: `gh api -X POST repos/ghwelcome0-cloud/lifeportfolio-site/actions/runs/<id>/pending_deployments --input - <<< '{"environment_ids":[19657041519],"state":"approved","comment":"..."}'`

## ④ 실수 장부(이 영역)
⑦ 규칙 배포 순서(대조 전 실행) · ⑧ 승인 조건 미반영 코드 실행 · ⑫ 없는 입력란 전달.

## ⑤ 바로 시작하는 명령
```bash
gh run list -R ghwelcome0-cloud/lifeportfolio-site --status waiting          # 대기 배포 확인
tail -n 20 /home/user/work/deploy-approver.log                              # 승인기 결정 로그
# functions 별도 허용 등록 — 절차: ① 허용 메시지 id를 gsk genteam read로 열어 보낸 사람이 대표(사람 계정)인지 확인 ② 확인한 뒤에만 아래 줄 추가(기계 확인 도구가 생기면 그 이름으로 교체)
echo "ALLOW <sha7> TL <대표 허용 메시지 id>" >> /home/user/work/deploy-allow.txt
touch /home/user/work/deploy-STOP                                            # 전부 정지
```
