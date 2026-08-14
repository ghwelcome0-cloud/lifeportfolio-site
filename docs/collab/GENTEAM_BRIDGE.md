# GenTeam ↔ 개발 샌드박스 인지 브리지 (실증판 v1.0)

작성 2026-08-14 · 상태 **실증 완료** · 작성자 개발 담당(샌드박스 에이전트)

## 0. 이 문서가 답하는 질문

> "GenTeam에서 마케팅 팀과 진행한 걸 개발 담당이 인지할 수 있게 하고 싶은데, 초대할 방법은 없나?
>  이어서 제작하도록 하고 싶어서." — 대표 (2026-08-14)

**답: 초대 절차 없이 이미 인지 가능하다.** 샌드박스에 설치된 `gsk genteam` CLI 가
호출자(=대표 계정) 권한으로 GenTeam 워크스페이스를 읽고 쓴다. 아래는 전부 실행 실측이다.

## 1. 실측 — 무엇이 되는가

| 능력 | 명령 | 실측 결과 |
|---|---|---|
| 워크스페이스 목록 | `gsk genteam channels` | `Genspark` (`srv_51e23e…`) 1건 |
| 채널 목록 | `gsk genteam channels --server_slug genspark` | `faise-marketing`, `faise-lifeportfolio`, DM 다수 |
| 대화 전문 읽기 | `gsk genteam read --channel_id <id> --limit N` | 마케팅 채널 40 이벤트 전문 수신 |
| 스레드 읽기 | `read --channel_id <thread_id>` | 태스크 스레드까지 열람 |
| 태스크 보드 | `gsk genteam tasks --op list --channel_id <id> --status all` | 마케팅 3건 / 콘텐츠 2건 |
| 에이전트 명부 | `gsk genteam agents --server_slug genspark` | **38명** 전원 + mention id |
| 첨부 파일 메타 | `read` 응답의 `attachments[]` | 파일명·바이트·SHA·다운로드 ref |
| 메시지 전송 | `gsk genteam send …` | 가능하나 **대표 확인 필수** — `status: pending_confirmation` 반환 후 대표가 UI 에서 승인해야 실제 발신. 계정 권한 문제가 **아니며** 우회 옵션도 없다 → §1.5 |
| 호출자 정체 | `gsk me` | 대표 계정(파이스_인생포트폴리오) 로 이미 인증됨 — 위임 불필요 → §1.5 |
| 워크스페이스 검색 | `gsk genteam search --server_slug genspark --query <말>` | 메시지·태스크 교차 검색 가능 |
| 채널 개설 / 초대링크 | `create_channel` / `invite_link` | 가능 |

### 채널 ID 정본 (2026-08-14)
```
faise-marketing      ch_847d45c3176f45a0a3d856045ee9d23d
faise-lifeportfolio  ch_671d787911ac4a5ea8663fa025984f6b
```

## 1.5 "계정 권한을 위임하면 소통도 되나?" — 위임할 것이 없다

대표가 후속으로 물은 질문이다. 다음 작업자도 반드시 같은 질문에 도달하므로 실측 답을 남긴다.

> "제 계정 권한 당신에게 위임하면 GenTeam과 소통도 할 수 있어요?" — 대표 (2026-08-14)

**답: 이미 위임되어 있다. 추가로 넘길 권한이 없다.** 그리고 **위임해도 `send` 승인은 사라지지 않는다.**

### 근거 1 — 샌드박스는 이미 대표 계정으로 인증되어 있다

```bash
$ gsk me
{ "email": "<대표 업무 계정>",       # 실제 출력은 대표 이메일
  "name": "파이스_인생포트폴리오",
  "plan": "plus" }
```

(공개 저장소이므로 이메일 원문은 옮기지 않는다. 직접 확인하려면 위 명령을 실행하면 된다.)

CLI 의 모든 호출은 처음부터 대표 계정 권한으로 나간다. 그래서 읽기가 전부 되는 것이다.
API 키를 따로 넘기거나 `gsk login` 을 다시 할 필요가 없다. 오히려 재로그인은 브라우저 OAuth 를
요구해 샌드박스에서 실패한다.

### 근거 2 — `send` 승인은 계정 권한 부족이 아니다

`send` 가 멈추는 것은 권한이 모자라서가 아니다. 다음을 실측했다.

```bash
$ gsk genteam send --help
# 옵션 전체: channel_id, content, file_name, file_path, mentions,
#            operation_id, quote_message_id, args-file
# → 승인을 건너뛰는 옵션(force / auto_confirm / yes 등)이 존재하지 않는다
```

즉 **승인 단계는 우회 경로 자체가 설계되어 있지 않다.** 권한을 더 얹어도 우회 수단이 생기지 않는다.

### 근거 3 — 승인 전에는 실제로 발신되지 않는다 (멱등성으로 교차 확인)

`operation_id` 는 멱등키다. 이미 발신됐다면 재실행 시 **기존 메시지를 반환**해야 한다.
같은 `operation_id` 로 두 번 실행한 결과다.

```bash
$ gsk genteam send --args-file /tmp/gt_send.json   # 1회차
"status": "pending_confirmation"
$ gsk genteam send --args-file /tmp/gt_send.json   # 2회차 (동일 operation_id)
"status": "pending_confirmation"          ← 발신된 메시지를 반환하지 않음

$ gsk genteam read --channel_id ch_847d… --limit 30 | grep -c "개발 담당(샌드박스)"
0                                          ← 채널에 실제로 없음
```

**두 지표가 일치한다: 승인 전 메시지는 채널에 존재하지 않는다.** "보류"라는 표시만 믿지 않고
채널 실물을 조회해 교차 확인한 결과다.

### 이 구조를 없애려 하지 말 것

읽기는 자유, 쓰기는 사람 승인 — 이것은 결함이 아니라 **필요한 안전장치**다.

- 개발 담당(자동화 에이전트)이 마케팅 채널에 임의 발언을 남기면, 사람 팀원은 그것을 대표의 발언으로 읽는다
- 에이전트를 `mentions` 로 깨우면 그쪽 크레딧이 소모되고 작업 방향이 바뀐다
- 되돌릴 수 없다. 채널 발언은 배포와 달리 롤백이 없다

그래서 **읽기(조사·승계)는 즉시 하고, 쓰기(개입)는 대표 승인을 받는다**는 분업이 맞다.
승계 목적에는 읽기만으로 충분하다 — 산출물 파일명·용량·SHA·검수 결과를 전부 읽을 수 있다.

### 실무 권장 절차

| 하려는 일 | 방법 |
|---|---|
| 마케팅 진행 상황 파악 | `read` / `tasks` — 즉시, 승인 불필요 |
| 산출물 목록·해시 확보 | `read` 의 `attachments[]` — 즉시 |
| 확정 규칙을 개발에 승계 | **repo 커밋 + PR** (승인 불필요, 리뷰 이력 축적) ← 권장 |
| 마케팅 팀에 질문·요청 | `send` 로 **초안 준비** → 대표 승인 → 발신 |

즉 대표가 해야 할 일은 권한 위임이 아니라 **준비된 메시지 승인** 뿐이다.

## 2. 실측 — 마케팅 팀 현황 (2026-08-14 14:07 기준)

### 태스크 보드
| # | 제목 | 담당 | 상태 |
|---|---|---|---|
| 3 | 하이브리드 3D 이미지 전체 압축 | AI 이미지 | **done** |
| 2 | 최근 롱폼 파일 전달 | AI 비디오 | **done** |
| 1 | 인생포트폴리오 수익화 마케팅 전략 | 마케팅 플래너 | in_progress (08-11 착수) |

### 확인된 산출물 실체
```
lifeportfolio-longform-v13-final-candidate.mp4
  33,007,101 B · 500초(8분20초) · 1280x720 / 30fps / H.264+AAC
  sha256 25ef395b9417bf0918f538eefa0d623c0b17495e421ab75ca42d09ee0682af59
  검수: 전체 1x 재생 P0=0 통과본

hybrid-3d-motion-all-images-20260814.zip
  639,210,184 B (약 610MB) · 이미지 125개
  범위 v14 AI 3D Hero ~ v27 Physical State Sources
  원본/clean/finalfix/상태별 소스/타이포 proof 포함, MANIFEST.csv 에 경로·용량·SHA-256
```

### 관측된 장애 (개발 담당 판단)
- `마케팅 플래너`(`agent_hdpvezdpj028`) 가 08-14 12:57 이후 **연속 무응답**.
  대표가 12:57 / 13:02 / 13:07 / 13:49 / 13:50 / 14:07 총 6회 호출.
- 같은 시각 System 이 `agent_turn_failed` / `reason_class: llm_error_no_output` 를 2건 기록
  (3D Motion Director, Compositing/VFX Supervisor).
- ⇒ 개별 에이전트 런타임 오류로 보이며 **대화 기록·산출물은 유실되지 않았다**
  (위 done 2건이 그 증거). 재호출 또는 다른 에이전트로 우회하면 승계 가능.

## 3. 인지 경로 4가지 — 무엇을 쓸 것인가

| 경로 | 즉시성 | 축적성 | 권장 |
|---|---|---|---|
| ① `gsk genteam read` 직접 열람 | 즉시 | 없음(대화는 흘러감) | **현황 파악용 · 이미 가동** |
| ② repo 커밋 (`docs/marketing/`) | 커밋 후 항상 | **높음**(버전·PR설명 축적) | **★ 정본 인계용** |
| ③ 파일 업로드(채팅 첨부) | 즉시 | 낮음 | 대용량 1회성 |
| ④ AI드라이브 `/mnt/aidrive` | 즉시 | 중간 | 대용량 보관 |

**①+② 병행이 정답.** ① 로 현황을 읽고, 확정된 결정·규칙만 ② 로 repo 에 남긴다.
이미 그 선례가 있다: PR #253 `docs/marketing/VIDEO_PRODUCTION_RULES_v1.0.md` —
마케팅 팀이 만든 영상 제작 규칙을 repo 정본으로 승격한 건이다.

## 4. 다른 작업자에게 (① 항구 지침)

GenTeam 산출물을 이 repo 로 승격할 때 지켜야 할 것:

1. **라이브 영향 먼저 판정.** `scripts/hosting-allowlist.mjs` 가 배포 화이트리스트다.
   `docs/` 는 어느 목록에도 없고 `.md` 는 `ALLOWED_EXTENSIONS` 에 없다 → 문서 PR 은 라이브 영향 0.
   ```bash
   gh pr view <N> --json files --jq '.files[].path' | while read f; do
     [ -e "dist/hosting/$f" ] && echo "LIVE: $f" || echo "non-live: $f"; done
   ```
2. **보호 경로를 건드리지 말 것.** `internal/evidence/evidence-contract.json` 의
   `protected_paths` 24개는 기능 PR 에서 수정하면 `unsupported_until_external_verifier` 로 fail-closed 된다.
3. **바이너리 산출물(영상·이미지 zip)은 repo 에 넣지 말 것.** 610MB zip 은 `.git` 을 파괴한다.
   AI드라이브 또는 GenTeam 첨부에 두고, repo 에는 **파일명 + 크기 + SHA-256 + 검수 결과**만 기록한다
   (본 문서 §2 형식).
4. **PR 본문에 출처를 남길 것.** 어느 채널·어느 태스크·누가 만든 산출물인지 적는다.

## 5. 한계 (정직하게)

- `gsk genteam` 은 **호출자 권한**으로 동작한다. 대표 계정이 볼 수 없는 채널은 나도 못 본다.
- 첨부 다운로드 ref 는 상대경로다. 대용량 파일을 샌드박스로 내리려면 별도 인증 경로가 필요하며,
  본 문서 작성 시점에는 **메타데이터 확인까지만** 실측했다(파일 실물 다운로드는 미시도).
- 채널 ID 는 고정값이 아니다. 채널이 재생성되면 §1 표를 갱신해야 한다.
- 나는 GenTeam 의 정식 멤버가 아니라 **CLI 관측자**다. 내가 보낸 메시지는 대표 계정 발신으로 기록된다.
- **읽기는 자유, 쓰기는 승인제.** `read` / `tasks` / `agents` 는 즉시 실행되지만 `send` 는
  `status: pending_confirmation` 을 돌려주고 멈춘다. 대표가 확인해야 실제로 채널에 올라간다.
  ⇒ 개발 담당이 마케팅 채널을 임의로 오염시킬 수 없는 구조다. 안정성 관점에서 바람직하다.
