# KB-04 GenTeam 에이전트 팀 운영 플레이북 — CLI로 팀을 돌리고, 결박하고, 에이전트를 만드는 법

실전: Q90·공개 비교표 작업(2026-10-05~12), TL·Peer·Method 3인 스레드 + judge DM 6개 + Genny.

## ① 확인된 것
**CLI 기본 패턴**
- 보내기: `gsk genteam send --yes --args-file <json>` — json에 `channel_id, content, mentions[], operation_id`(+ `file_path`(wrapper URL)·`file_name`으로 첨부, `quote_message_id`로 인용). 긴 본문·`$`·따옴표는 반드시 args-file.
- 읽기: `gsk genteam read --channel_id <ch> --after_message_id <id> --limit N` (래퍼 `/home/user/work/gt.sh <ch> <after> <limit>`). 메시지 본문은 `items[].data.display_text`.
- DM 열기: `gsk genteam dm --yes --op open --server_slug genspark --actor_type agent --actor_id <id>` → **`data.channel.id`**(`channel_id`가 아님 — 2026-10-12 파서 오류로 확인).
- 첨부 검증: `gsk genteam download --channel_id --attachment_ref` 가 **서버 쪽 sha256**을 돌려준다 → 보낸 파일과 대조(`bytes_match`).
- 업로드: `gsk upload <file>` → `data.file_wrapper_url`.
- 목록 API의 `description`은 **300자에서 절단**(`…`) → 설명문 전문 대조에 쓸 수 없다.

**결박(binding) 운영**
- 모든 팀 메시지 첫 줄에 계보 마커 `결박 ref: 5731124 계보 · op:q90-auto-<n>` — 검색·추적용. 상태 파일 `/home/user/work/autoowner.state.json`(opn).
- 규칙은 **결과를 보기 전에** 커밋하고 그 sha를 시트에 적는다(예: 분모 분류 §21 → `e2_denominator_rule.bound_commit`). 3인 일치 메시지 id를 refs로 남긴다.
- 팀이 차단급(blocking)이라고 하면 멈추고 고친다. 차단급 아님 + 한계 기록이면 진행.
- "점수 열람 0회"를 메시지에 명시하는 습관 — 블라인드 유지 증명.

**에이전트 생성(2026-10-12 확인)**
- `gsk genteam` 액션 목록에 **생성 액션은 없다**(join…leave_channel 23개). `/api/tool_cli/genteam`에 `create_agent`를 보내도 Unknown action.
- 그러나 **Genny**(내장 도우미, `agent_vnh8ynfhj5hc`)가 소유자 대신 커스텀 에이전트를 만들 수 있다: DM에 이름·모델·스킬 0·채널 0·설명문 전문 + 소유자 승인 원문 인용 → Genny가 **확인 카드**(metadata `question.approval:true`) → 인용 답장 "승인합니다" → 시스템 메시지 "Created …". 소요 약 3분.
- 화면 경로(사람용): Agents → Add agent → Build custom/New agent → 이름·모델·설명 → Create agent.
- Genny는 sha 같은 후속 질문에 답하지 않을 수 있다(25분+ 무응답 실측) → 전문 대조는 자기신고로 남기고 한계에 적는다.

**1회용 스크립트·데몬 규칙**
- pm2는 종료된 프로세스를 **기본 자동 재시작**한다 → 1회용(감지기·폴링)은 `--no-autorestart` 필수(⑬: 8회 중복 발송).
- 머지 루프 등 git을 만지는 데몬은 **전용 worktree**(`git worktree add /home/user/wt/<pr>`)에서만 — 공유 작업 트리의 브랜치를 바꿔 커밋이 엉뚱한 브랜치로 갈 뻔함.
- `pkill -f <스크립트명>`은 자기 자신의 셸도 죽인다(명령줄에 그 문자열이 있으므로) → `pm2 delete <name>` 사용.
- 머지: 저장소가 merge commit 금지 → `gh pr merge --squash`. BEHIND면 리베이스 후 재대기.

**모델 분포(Genny 집계 2026-10-12)**: 41명 중 Opus 5.5 20·Sonnet 5.5 20·GPT 1(로컬). 같은 모델끼리 판정하면 자기 선호 가능성(추정) → judge 선정 때 모델 표시명 기록.

## ② 아직 모르는 것
- Genny 생성 경로의 권한 모델(소유자 쿼터 소비 외) — 다른 워크스페이스에서도 같은지 미확인.
- 에이전트 DM의 "실제 열람 이력" 조회 수단 — 없음(현재).

## ③ 도구·파일
- `/home/user/work/gt.sh`, `auto_q90-auto-*.json`(메시지 원문 보관), `pre_vfx.json`(사전확인 양식), `post_j1.json`(사후 Q2), `genny_create.json`(생성 요청 원문)
- 승인기·루프: `deploy-approver.sh`, `merge-loop.sh <pr> <remote-branch> <wt-branch>`

## ④ 실수 장부(이 영역)
⑫ 확인 없이 전달 · ⑬ 자동 재시작 · "CLI 생성 불가" 반쪽 단정 · 공유 worktree 머지 루프.

## ⑤ 바로 시작하는 명령
```bash
/home/user/work/gt.sh ch_4a2fbfcc47273beedd780750b6532efe <last_id> 10      # TL 스레드 읽기
gsk genteam send --yes --args-file /home/user/work/auto_q90-auto-<n>.json    # op 마커 포함해 보고
pm2 start <script>.sh --name <x> --interpreter bash --no-autorestart         # 1회용
```
