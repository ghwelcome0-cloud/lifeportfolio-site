# 지식 베이스 — "다음 사람은 여기서 시작한다"

목적(대표 지시 2026-10-12): 작업을 끝내며 쌓인 **기술·지식·피드백·규칙**을 누구나 그 위에서 바로 시작할 수 있게 정리한다. 원리는 『지의 최전선』 — **지금까지 확인된 것의 가장자리를 정확히 표시**해서, 다음 사람이 처음부터 다시 파지 않고 가장자리에서 출발하게 한다.

## 읽는 법 (3분)
1. 각 플레이북은 같은 틀: **① 확인된 것(실측·결박) → ② 아직 모르는 것(열린 질문) → ③ 도구·파일 위치 → ④ 실수 장부(같은 실수 금지) → ⑤ 바로 시작하는 명령**.
2. "확인된 것"에는 근거(커밋·메시지 id·URL)가 붙어 있다. 근거 없는 문장은 "추정"이라고 적혀 있다.
3. 새로 배운 것이 생기면 **해당 플레이북 ①에 1줄 + 근거**를 더한다. 지우지 않는다(축적 원칙). 틀린 것은 취소선 + 정정 이유.

## 플레이북 목록
| # | 파일 | 한 줄 | 성숙도 |
|---|---|---|---|
| KB-01 | [blind-judging-playbook.md](blind-judging-playbook.md) | AI 에이전트로 블라인드 채점·제3자 판정을 **공정하게** 돌리는 법(격리 4단계·memory_check·읽기확인·X/Y 익명·집계 규칙) | 실전 1회차 완료(9샘플 45축) |
| KB-02 | [redaction-pipeline-playbook.md](redaction-pipeline-playbook.md) | PDF 샘플 리포트에서 회사·사람 정보를 가리고 **누출 0을 증명**하는 법 | 10건 처리, 결함 2건 반영 |
| KB-03 | [public-comparison-table-playbook.md](public-comparison-table-playbook.md) | 경쟁 비교표를 **순위 없이·근거 등급별로** 만들고 분모를 정직하게 세는 법(E1~E4, 두 분모 공개) | 표 v2 생성 중(64%) |
| KB-04 | [genteam-agent-ops-playbook.md](genteam-agent-ops-playbook.md) | GenTeam에서 에이전트 팀을 **운영**하는 법(CLI 패턴·결박 ref·Genny로 에이전트 생성·1회용 스크립트 규칙) | 매일 사용 |
| KB-05 | [deploy-governance-playbook.md](deploy-governance-playbook.md) | GitHub Environments로 운영 배포를 **멈추지 않으면서 통제**하는 법(Required reviewers + 위임 승인기 + ALLOW 기록) | 가동 중 |
| KB-06 | [defect-ledger.md](defect-ledger.md) | 결함을 **뿌리별로** 세고 재발을 줄이는 장부(R1~R5) + 예방 점검 | 14건 분류 |

## 이 베이스가 다루지 않는 것(정직하게)
- Q90 본류(자사 제품 2회차 측정)는 아직 TL D 도구 대기 → 플레이북 없음. 끝나면 KB-07로 추가.
- **Q90 1회차·2회차 판정 기록은 여기 없음** — G14·G16·G17 원본만 정본. KB-01의 블라인드 채점 절차는 **E2(경쟁 샘플)용**이고, Q90 judge 절차는 별도 계약(G16)을 따른다. 둘을 섞지 말 것(Peer 6082200).
- 여기 적힌 "확인된 것"은 **이 팀의 환경(GenTeam·이 저장소)에서** 확인된 것. 다른 환경에서는 ②의 열린 질문부터 다시 확인할 것.

## 원본 기록 위치
- 설계·진행 기록: `docs/q90/G21_공개비교표_v2_설계_2026-10-12.md`(§1~§21), `docs/q90/G17_…md`(B-1 실수 ⑦~⑭, B-1a 장부)
- 데이터·도구: `docs/q90-public/`(sheets·tools·judge·rubric·roster), 저장소 밖: `/home/user/work/`(패킷·원본 샘플·salt → AI Drive tar)
- 팀 대화: GenTeam 스레드 `ch_4a2fbfcc47273beedd780750b6532efe`(op:q90-auto-1xx 마커로 검색)
