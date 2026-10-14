# 파이스 · 인생포트폴리오 — AI 총괄 인수인계서 (2026-10-13 종결 시점, 진행률 83%)

> **수신:** 다음 총괄 AI(Opus 5.5). **발신:** 직전 총괄(ac00a922-cec9-4138-8f1c-3ee4463c7176 계정으로 활동). **대표:** 파이스 김영식(GitHub `ghwelcome0-cloud`).
> **이 문서의 목적:** 당신이 이 문서 하나만 읽고 **같은 자리에서 바로 이어서** 일하게 하는 것. 사실의 수준(직접 확인 / 팀 보고 / 역사 기록 / 미확인)을 구분해 적었다. 근거 없는 문장은 "추정"이라고 썼다.

---

## 0. 첫 10분 — 이것만 하고 시작한다

### 0.1 대표와의 약속(바꾸지 말 것)
1. **대표에게는 중학생 수준 한국어**로, **매 보고 첫 줄에 전체 가중 진행률 %**(E1 25 · E3 25 · E2확보 15 · E2채점 25 · 자사 10).
2. **결과가 바뀌는 결함은 반드시 보고**. 결과가 안 바뀌는 결함은 KB(`docs/knowledge-base/defect-ledger.md`)에만 적고 보고서에 반복하지 않는다. 결함을 **기계로 재발 방지**(스크립트·게이트)하는 것을 대표가 매우 좋게 봤다.
3. 대표는 "전권"을 줬다. 승인을 다시 묻지 말고 **결정하고 기록하고 보고**한다. 단, **3회차 착수·운영 배포·고객 데이터·결제**는 대표의 명시 결정 없이는 하지 않는다.
4. 메시지에 넣는 **시각·sha·id·개수는 기록 파일/도구 출력에서 복사**한다. 손으로 치지 않는다(KB T20 — 오늘 이것 때문에 E3 254→253 정정이 있었다).

### 0.2 지금 상태 한 줄
**Q90 2회차 scorer 체인 완료.** scorer r18 1회 실행 → `blocked [R19_execution_scope_required]`(사전에 알고 받은 차단) → 자사 행 전사 → **전체 83%**(main `48b73ba`). 공식 점수(A1~A7)는 **존재하지 않는다**(점수 필드 null). 3회차는 대표 새 결정 전까지 **착수 금지**.

### 0.3 첫 명령 5개(순서대로)
```bash
# ① 저장소 최신화
cd /home/user/rq && git pull origin main && cd docs/q90-public && node tools/progress.cjs --md | head -3
# ② GenTeam 미독 확인(마지막 읽은 id 이후만). gsend.state의 마지막 tldm=/thread= 값을 쓴다
tail -2 /home/user/work/gsend.state
gsk genteam read --channel_id ch_dm_a1c519386e3a75364788 --after_message_id <tldm> --limit 20
gsk genteam read --channel_id ch_4a2fbfcc47273beedd780750b6532efe --after_message_id <thread> --limit 20
# ③ 발송은 반드시 게이트로만 (§4.3)
/home/user/work/gsend.sh <channel_id> <content_file> [<wrapper_url> <file_name>]
# ④ 열린 PR
gh pr list --repo ghwelcome0-cloud/lifeportfolio-site
# ⑤ 우선순위 표(§2)의 1번부터
```

### 0.4 후임에게 그대로 전달할 시작 지시문
> 당신은 파이스 인생포트폴리오의 경영·개발·평가 총괄 AI다. 이 인수인계서를 1차 기준으로 쓴다. Q90 2회차는 83%에서 종결됐고 공식 점수는 없다(scorer 차단, 사전 결박). 3회차는 대표의 새 결정 없이는 시작하지 않는다. 대표에게는 중학생 수준 한국어로, 첫 줄에 항상 전체 진행률 %를 쓴다. 결과가 바뀌는 결함은 보고하고 나머지는 KB에만 적는다. 모든 GenTeam 발송은 `/home/user/work/gsend.sh`로만 한다. 숫자·sha·id는 기록에서 복사한다. §2 우선순위 1번부터 시작한다.

---

## 1. 비즈니스 지도(5분 안에 전체 그림)

### 1.1 회사·제품
- **사업자 파이스**, 서비스 **인생포트폴리오(LifePortfolio)**, 대표 김영식. 사명 **"발견 → 살아냄 → 남김"**(인생 자산화 — 금융 수익 보장 아님).
- 제품: 76문항 측정 → **규칙 기반 합성 엔진**이 진단 리포트(PDF) + 맞춤 실행프로그램(첫 3주 계획) 생성 → 코칭·점검·다이어리. **엔진은 LLM이 아니다**(평가에 AI를 쓰는 것과 다름).
- 실제 스택: **Static HTML/JS + Firebase RTDB + Cloud Functions + Firebase Hosting**. 저장소 `ghwelcome0-cloud/lifeportfolio-site`. **Hono/Cloudflare로 덮어쓰지 않는다**(샌드박스 기본 템플릿 함정).
- 핵심 고객(역사적 전략, 2026-05): 이직·번아웃·전환기의 30대 직장인. 채널: 블로그 SEO·유튜브·카카오. **현재 매출·활성 고객 수·환불률은 미확인** — 아는 것처럼 쓰지 않는다.
- 가격 1~5만 원대(공개표 자사 행 기준). 운영자 자격: 경영학 과정 수료 + 평생교육사. 공개 인정 한계: 통계적 신뢰도·요인구조 검증 미실시, 규준 표본 없음, 임상 아님.

### 1.2 왜 Q90인가
대표의 핵심 질문: **"우리 제품이 공개적으로 90점을 넘는가?"** 이를 **자기 채점이 아닌, 사전 고정 계약 + 블라인드 AI judge + 고정 scorer**로 증명하려는 것이 Q90. 1회차(2026-10-09)·2회차(2026-10-13) 모두 **절차 차단으로 공식 점수 없음**. 이것은 실패 은폐가 아니라 **"사전에 정한 규칙을 결과를 보고 바꾸지 않았다"**는 증거이며, 대표가 이 원칙을 지지한다.

### 1.3 공개 비교표(q90-public) — 진행률의 실체
| 축 | 뜻 | 현재 | 가중 |
|---|---|---|---|
| E1 | 경쟁 41행(자사 제외 40)의 웹 실측(A6·A7) | 32/40 (80%) | 25 |
| E3 | 공개 문서 7칸(가격·시간·한국어 등) | 253/278 (91%) | 25 |
| E2확보 | 경쟁사 샘플 리포트 확보(적합 판정) | 13/37 (35%) | 15 |
| E2채점 | 확보 샘플 블라인드 채점 | 13/13 (100%) | 25 |
| 자사 | Q90 2회차 scorer 전사 | 1/1 (100%) | 10 |
| **전체** | | **83%** | 100 |
도구: `docs/q90-public/tools/progress.cjs --md`(이 출력만 인용). 표: `build-table.cjs` → `runs/latest/table-v2.{md,html,json}`. 규칙: **순위 없음·근거 등급별(E1/E2/E3)·미측정 ≠ 0·자사 행과 경쟁 행 직접 비교 금지**.

### 1.4 자료 지도(어디에 무엇이)
| 종류 | 위치 | 비고 |
|---|---|---|
| 종합 비즈니스 인수인계(역사·전략·코드) | `docs/handover/FAISE_Q90_HANDOVER_v1.md`, `FAISE_Q90_STATE_v1.json` | 2026-09-08판. 2장(비즈니스)·8~13장(코드·장애)은 여전히 유효 |
| **지식 베이스(KB-01~06)** | `docs/knowledge-base/README.md` | 블라인드 채점·가림·공개표·GenTeam 운영·배포 거버넌스·결함 장부(T01~T20) |
| Q90 계약·규칙 원본 | `docs/q90/G16_판정규칙_사전고정_*.md`(§7.3 3회차 조건), `G21_공개비교표_v2_설계_*.md` | 결박 sha 있음 |
| Q90 1회차 결과 | `docs/q90/G07_G14_판정기록_1회차_전사본_2026-10-09.md` | blocked R19_run_entrypoint_binding |
| **Q90 2회차 전부** | `docs/q90/HANDOFF_2026-10-13_Q90_2회차_종결정리.md`(§9 최종), `B5_격리기록_2회차_*.md`(§1~§19), **`G17_공개문구_2회차_결박본_2026-10-13.md`(29줄)**, `r2-evidence/`(EVIDENCE-LEDGER.json 41행 + 모든 봉인 파일) | webapp 저장소 브랜치 `q90/docs-chain-2` |
| 공개표 데이터·도구 | `docs/q90-public/{sheets,tools,roster,rubric,runs,table,judge}` | main |
| 작업 파일(저장소 밖) | `/home/user/work/` — `gsend.sh`·`gsend.state/ack/log`, `judge_r2/`(묶음·판정·조정), `owner/`, `tl/`, `auto_q90-auto-1xx.*`(발송 원문) | 샌드박스 소멸 시 AI Drive tar로 |
| 사업 문서(역사) | `docs/business-model-canvas.md`, `docs/CEO_종합보고서_2026-08-13.md`, `docs/strategy/`, `docs/marketing/`, `docs/legal/`, `docs/seo*.md` | 가격·목표는 **현재 실증 아님** |
| 제품 규칙 | `docs/PRODUCTION_RULES_v1.4.md`, `PRODUCTION_MANUAL_v2.0.md`, `METHODOLOGY_직관표현규칙_*.md` | 코드 수정 전 필독 |

---

## 2. 다음 작업 — 우선순위 표(여기서 이어간다)

| 순위 | 작업 | 담당 | 왜 먼저 | 완료 판정 | 진행률 |
|---|---|---|---|---|---|
| 1 | ~~PR #428 머지~~ **완료**(main 48b73ba, 83% 확정) | — | — | — | 83% |
| 2 | **attestation v3**: `owner-attestation-r2.json`에 op:177 메시지 id 보완 + **대표가 TL 스레드에 "R2 실행 GO·권고대로 처리는 내가 승인했다" 1줄 직접 게시**하면 그 id 추가 → TL이 freeze 폴더에 넣음 | 대표 1줄 → 총괄 → TL | 승인 근거가 총괄 전달문(6153743·6154224)뿐 = 독립 대조 불가(Peer 6195435) | v3 sha가 EVIDENCE-LEDGER·G17 25번에 기재 | 0 |
| 3 | **Peer 대조 2건**: ① `judge-surface-matrix.json`(775a0745, TL 보유) 첨부 → 영향 체크 목록 `66e452c2` 완전성 대조(**목록은 불변**, 빠진 항목은 공개만) ② X2 audit 재실행(`6f447f90` 첨부) | 총괄 첨부 → Peer | 결과를 본 뒤라 목록 변경 금지, 공개 의무만 | Peer ref 1줄 → G17 12번 보강 | 0 |
| 4 | **Method**: B5 reviewer 기록 12건 독립 대조(현재 Peer 단독 서명) · 남은 감사 B4·B5b·C7c·D2·D5 | Method | G17 26번 | Method ref 1줄 | 0 |
| 5 | **1·2회차 공개 문서 통합**: G17 결박본 29줄 + 자사 행 각주를 공개용 G14/G17 문서에 **그대로 전재**(문장 수정 금지, 정정은 별도 줄) | 총괄 | 결과 공개 전 마지막 문서 | docs 커밋 + Peer·Method 확인 ref | 0 |
| 6 | **85%까지 +2%p**: (a) E1 K13·K14 명부 URL 교정 후 재측정 2행(TL r6 실행) → E1 34/40 / (b) E3 10칸(차단·미기재 7건 외 새 출처만, `filled()`=source_url+value) | TL(E1) · 총괄(E3) | 진행률 목표 | `progress.cjs` ≥ 85 | +2 |
| 7 | **E2 샘플 확보** 13→37(가장 큰 미달, 35%). 규칙: 본인인증 필수·약관 금지 행은 "미측정·사유"(0점 아님). 가림 파이프라인 KB-02 | 총괄 | 가중 15 | 1건당 ≈+0.4%p | 큰 폭 |
| 8 | adjudicator(agent_9akn3657bq2s) 재사용 가능 여부: notes/channels.md 1줄에 2회차 판정 내용 포함 시 **다음 회차 재사용 금지**(Peer 6194014 ④) | 총괄 | 격리 규칙 | 기록 1줄 | 0 |
| 9 | KB-07 "Q90 scorer 체인 플레이북" 작성(2회차 전 과정을 ①확인된 것 ②모르는 것 ③도구 ④실수 ⑤바로 쓰기 틀로) | 총괄 | KB README가 "끝나면 KB-07"로 예고 | PR 머지 | 0 |
| — | **3회차**: 대표의 새 결정·새 결박 없이는 착수하지 않음(§7.3 미발동, Method 6190176·op:190 결박). 착수 시 §5.3 "다음 회차 전 반드시 고칠 것"부터 | 대표 | | | |

**순위 근거:** 2~5는 2회차 기록의 **완결성**(공개 전 필수, 진행률 0). 6~7은 **진행률**. 9는 축적. 2·3·4는 다른 역할의 응답을 기다리므로 **먼저 발주해 두고** 6을 병행하는 것이 효율적이다.

---

## 3. Q90 2회차 — 당신이 알아야 할 결정과 결박(요약)

### 3.1 결과
| 항목 | 값 |
|---|---|
| scorer 실행 | r18(`aa64b1d3…`) **1회**, TL DM 세션, 2026-10-13T11:47:56.896Z |
| 출력 | `scorer-output-r2.json` `3a37f94406ddc40748004dd9a4c716417a2e5984c079a18500f856d3f882edd7` — status `blocked`, reasons `[R19_execution_scope_required]`, alt/human score **null**, public_release false |
| trust 입력 | freeze 영수증 `edce3bcd…` · 사전등록 `a8b7b7dd…` · 패키지 `7b73d4cb…` |
| G14 표기 | 행 각주 **"미달성(사유: R19_execution_scope_required)"**, 축 칸은 **"채점 안 됨(2회차 scorer 차단: R19)"** — 어느 축도 채점되지 않음 ≠ 축별 미달(Method 6196974) |
| 의미 | 실행계획에 seal_destination·profile/clock/dependency_policy sha·isolation_evidence_ref 필드가 없어 scorer 37행에서 멈춤(**TL 설계 결함**, 사전에 알고 제출 — B1 (나) 결정). 판정 데이터·38~67행 검사·기반 채점은 scorer로 평가되지 않음. |
| 3회차 조건 | 이 차단은 "절차 무효"가 아니라 **"2회차 유효 결과"** → G16 §7.3 3회차 자동 조건 **미발동**. 3회차 = 대표의 새 결정·새 결박 |

### 3.2 바꾸면 안 되는 결박(결과 전에 정한 것)
- binding_at = **2026-10-13T09:32:35.950Z**(증거팩 봉인), MANIFEST `b3b9ba10…`. 관측 `recorded_at ≤ binding_at`, 판정 `> binding_at`.
- frozen_at = `2026-10-11T20:48:25.000Z`(tag `q90-r2-candidate` = `3d3ebb476f36bbd24f65fb709ff4123e38609556`), roles `933b29a2…`(6키 불변), 실행계획 canonical digest `45928ddb`.
- 묶음 A3 `4cf258d8…`(24단위, 원 judge 공식) / B4 `5a3291c6…`(20 contrast, 새 judge 공식). B4 판정은 **scorer 입력 아님 → 보조 공개만**(ab-compare). A2#4는 A3에 contrast_set 표면 없음 → false(구조).
- 영향 체크 목록 `ab-affected-checks.json` `66e452c2…`(A1#3·A2#1·A2#2·A5.4#4) — **결과를 봤으므로 이제 불변**. ab-compare 대표 값 = REP 열.
- 열람 상태: **공식 점수 전원 0회**(null이라 볼 것도 없음). **보조 A·B(ab-compare) 결과 1회**(op:191에 수치 게시 — 이것은 내 실수에 가까움, 이후 모든 메시지에 "공식 0회·보조 1회" 표기).
- G17 공개 문구 = `G17_공개문구_2회차_결박본_2026-10-13.md` **29줄, 그대로 전재**. 바꾸려면 "정정" 줄을 따로 추가.

### 3.3 판정·조정 데이터(값은 열지 말 것)
- 원 judge: judge1(agent_8f71j8qxr0ke) · judge2(agent_h9xzc27hk6ey), Opus. A3 run1/run2 각각. 불일치 234/1,968 → adjudicator.
- 새 judge: jB1(agent_dyn2znpm778c) · jB2(agent_vcrae7f9na3a), gpt-6-astra, Genny가 생성한 빈 agent. B4 공식 + A3 보조. 불일치 100/1,640.
- adjudicator 회계사(agent_9akn3657bq2s): A3 `b355a0d0…`(234/234) · B4 `ca873791…`(100/100), 미해결 0, chosen∉관측 0.
- 파일: `/home/user/work/judge_r2/final/`, `judge_r2/adj/`, 사본 `webapp/docs/q90/r2-evidence/`. **판정 값·방향을 읽지 않는다**(구조·sha·개수만). 이유: scorer가 못 쓴 값을 사람이 읽으면 "결과를 보고 규칙을 고르는 통로"가 열린다.

### 3.4 다음 회차 전 반드시 고칠 것(3회차 승인이 나면)
1. 실행계획 템플릿에 **seal_destination · profile_sha · clock_sha · dependency_policy_sha · environment.isolation_evidence_ref** 추가(B1 뿌리). 이것만 고치면 37행을 통과하고 **38~67행·기반 채점이 처음으로 실제 실행**된다.
2. 블라인드 정규식의 "before"(제품 고정 문구) 처리 사전 결박(B4 뿌리) — 안 고치면 69행에서 `judge_artifact_blind_leakage`.
3. binding_at 순서 설계(잠금 ↔ 증거팩 봉인) 계획서에 명시(2회차 (라) 모순).
4. judge 발주 전 묶음 검사 체크리스트(`_` 키 0, contrast 문자열 0, 가림 개수 메타 없음, 단위 evidence 키 이름 동일) — B1/B3 사고 뿌리.
5. 규칙 질문 답은 **4방 동시** + 이미 제출된 run 미수정 원칙 유지.

---

## 4. GenTeam — 팀을 돌리는 법(KB-04가 정본, 여기는 현황)

### 4.1 사람·에이전트 명부
| 역할 | 표시명 | actor_id | 모델 | 채널 |
|---|---|---|---|---|
| 대표(사람) | 파이스_인생포트폴리오 | `ac00a922-cec9-4138-8f1c-3ee4463c7176` | — | 총괄도 이 계정으로 발송 |
| TL(executor·조립·freeze) | 테크 리드 | `agent_f6d6hkjm9p5k` | Opus | DM `ch_dm_a1c519386e3a75364788` |
| Peer(reviewer) | 피어 리뷰어 | `agent_jnwhjh28tew6` | Opus | 스레드 |
| Method | 리서치 사이언티스트 | `agent_8wdz8ehh4z2y` | Opus | 스레드 |
| **TL·Peer·Method 공용 스레드** | | | | **`ch_4a2fbfcc47273beedd780750b6532efe`** (품질 게이트 스레드) |
| judge1 / judge2 | | `agent_8f71j8qxr0ke` / `agent_h9xzc27hk6ey` | Opus | `ch_f6d8ff6fbdf74a28becc045bcfd1df33` / `ch_dd80b7a39ceb4a11b6569dff50fb44df` |
| judgeB1 / judgeB2 | 자료 판정 보조 1/2 | `agent_dyn2znpm778c` / `agent_vcrae7f9na3a` | gpt-6-astra | `ch_88db98f949f942b793306128628b33f2` / `ch_268324f6fa6445dcbaad044162dca9b3` |
| adjudicator | 회계사 | `agent_9akn3657bq2s` | — | `ch_e49e88db1efa4ad6b48a8e8404697d63` |
| X1 / X2 / X4(증거 작성 AI) | | | | `ch_f04041b388b94dbaba0fcfea9c2b0fc8` / `ch_ebe170093645408fb83f93c87bdd1500` / `ch_152cfb3eec3f4ef2bbb6ab1d1e686b36` |
| Genny(내장, 에이전트 생성 대행) | | `agent_vnh8ynfhj5hc` | — | DM `ch_dm_061ec6c08ec04cea45d0` |

### 4.2 메시지 규약
- 총괄 메시지 첫 줄: `**[총괄 op:q90-auto-<n>] 제목** 결박 ref: 5731124 계보 · op:q90-auto-<n> · 공식 점수 열람 0회, 보조 A·B 1회`. **마지막 op = 193**(6196941) + 보충 6197614. 다음은 **op:194**.
- 결박(결정) 메시지에는 Method·Peer "10분 이의 창"을 두고, 미답이면 진행. 팀이 "차단급"이라 하면 멈춘다.
- 역할 답변 패턴: TL은 "점수 열람 0회, TL commit xxx" / Peer는 "열람 범위 + 독립 재현 여부" / Method는 "이의 없음 + 공개 1줄 추가". 셋 다 **매우 정확**하고 내 실수를 잡아낸다. 지적은 거의 항상 맞았다 — 받아들이고 G17에 1줄 추가하는 것이 패턴.
- 첨부 다운로드: `curl -H "X-Api-Key: $GSK_TOKEN" "https://www.genspark.ai/api/tool_cli/genteam/attachment?channel_id=<ch>&attachment_ref=<msg>%3A<idx>"`. 업로드: `gsk upload <file>` → `data.file_wrapper_url`. **첨부는 메시지당 1개**(T18).
- 읽기 헬퍼: `python3 /home/user/work/rd.py <ch> <limit> [chars]`.

### 4.3 발송 게이트(반드시)
`/home/user/work/gsend.sh <ch> <content_file> [<wrapper_url> <file_name>]`
- 보내기 전 TL DM·스레드의 **마지막 읽은 id 이후** 메시지에 `긴급|보류|무효|중지|STOP|차단`이 있으면 **rc 2로 중단**(GATE-STOP). 읽고 반영한 뒤 `echo <id> >> /home/user/work/gsend.ack` 후 재실행.
- 보낸 뒤 `attachments[].file_name` 대조(불일치 rc 3). 로그 `gsend.log`, 상태 `gsend.state`.
- 오늘 GATE-STOP 2회 모두 "읽어야 할 메시지"를 정확히 잡았다. **우회하지 말 것.**

### 4.4 열린 대화(응답 대기 없음, 모두 종결 확인됨)
- op:193 종결에 TL·Peer·Method 전원 "이의 없음"(6196963·6196967·6196974). 보충 6197614 이후 새 메시지는 §0.3 ②로 확인.

---

## 5. 저장소·도구 운영 규칙(실수 재발 방지 — KB-06 요약)

| 규칙 | 뿌리 결함 |
|---|---|
| PR은 **squash**(merge commit 금지). BEHIND면 `git merge origin/main` 후 push → CI(~7~15분, `quality-axes-gates`가 가장 느림) → `gh pr merge --squash --delete-branch`. `--admin` 불가. | — |
| git 작업은 **전용 worktree**(`git worktree add /home/user/wt/<name> -b <branch> origin/main`). 공유 트리 `/home/user/rq`는 main 읽기용. | T13 |
| 1회용 데몬은 pm2 `--no-autorestart`. 실행 중 bash를 sed로 고치지 않는다. | ⑬ |
| 숫자·%·sha·시각은 **도구 출력/기록에서 복사**. "+1칸" 같은 손 계산 금지 → `progress.cjs`만 인용. | **T20(오늘)** |
| 발주 전 TL DM 재확인(gsend.sh가 강제). | T19 |
| 첨부 1개/메시지 + 전송 후 대조(gsend.sh가 강제). | T18 |
| 블라인드: 판정 값·점수는 **구조·sha·개수만** 본다. 보조 결과(ab-compare)도 스레드에 수치를 올리면 "열람 1회"가 된다 — 올리려면 공개 전제로. | 오늘 교훈 |
| webapp 저장소 docs는 브랜치 `q90/docs-chain-2`(PR #351 OPEN, quality gate 실패 중 — 문서 전용이라 머지 급하지 않음). rq 저장소 main이 공개표 정본. | — |
| 샌드박스 디스크 85% — 큰 tar·오래된 worktree 정리(`git worktree remove`). 종료 전 `/home/user/work` tar → AI Drive. | — |

---

## 6. 파일 목록(sha 포함, 이 세션 산출)

| 파일 | sha256 앞 8 | 위치 |
|---|---|---|
| scorer-output-r2.json | 3a37f944 | r2-evidence/, rq `docs/q90-public/table/` |
| own.json(자사 전사) | (PR #428) | rq `docs/q90-public/table/own.json` |
| receipts-r2.json(영수증 2개 전문) | 5957cf83 | r2-evidence/ |
| owner-attestation-r2.json **v2** | 02ec934d | r2-evidence/ (v1 42103da6 대체) |
| q90-adjudication-r2-A3/B4.json | b355a0d0 / ca873791 | r2-evidence/, work/judge_r2/adj/ |
| ab-affected-checks.json | 66e452c2 | r2-evidence/ |
| ab-compare-r2.json | 50ed98b3 | r2-evidence/ |
| EVIDENCE-LEDGER.json | 41행 | r2-evidence/ |
| diff_A3.json / diff_B4.json | 22ea6cf7 / 294317c3 | work/judge_r2/final/ |
| judge-bundle-A3/B4.json | 4cf258d8 / 5a3291c6 | work/judge_r2/ |
| 대응표(라벨↔case) A3/B4 | 336e909b / f0876bf7 | **총괄만 보유** work/judge_r2/r2-judge-map-*.json — 유출 금지 |
| G17 결박본 | 29줄 | docs/q90/G17_공개문구_2회차_결박본_2026-10-13.md |
| KB 결함 장부 | T01~T20 | rq docs/knowledge-base/defect-ledger.md |

---

## 7. 사실의 수준(정직하게)
- **직접 확인:** 이 문서의 sha·메시지 id·진행률·PR 상태·파일 구조. 
- **팀 보고:** scorer 실행 자체(TL DM 세션), B5 12건 검토(Peer), 38~67행 직접 확인(TL `e016cf6f`), adjudicator 격리 선언.
- **역사 기록:** §1.1의 고객·가격·전략(2026-05~08 문서). 현재 실증 아님.
- **미확인:** 현재 매출·고객 수·환불·운영 secret/IAM 상태·크레딧 정확 잔액·대표 원문 승인의 GenTeam 밖 기록.
- **내가 저지른 결함(이번 세션):** T20(질문 시각 오타→무효 답 1건, 재질문으로 해소) · E3 과대 집계 254→253(결과 영향, 대표 보고 완료) · ab-compare 수치를 스레드에 게시해 "보조 열람 1회" 발생(결과 영향 없음, 표기로 공개).

---

## 8. 대표에게 보고할 때의 틀(그대로 쓰면 된다)
```
## 보고 — 전체 가중 진행률 NN% (이전 → 지금)
E1 xx · E3 xx · E2확보 xx · E2채점 xx · 자사 xx
### 끝낸 것 (표)
### 결과가 바뀌는 결함 (없으면 "없음")
### 다음 (우선순위 표 1~3번만)
```
대표는 "꼭 작업을 완수합시다", "기계로 재발을 막는 조치 아주 좋습니다", "자사 10% 반영 매우 고무적"이라고 반응했다. 완수·기계적 재발 방지·정직한 정정을 가장 높게 산다.

— 끝. 다음 총괄의 첫 메시지는 op:q90-auto-194.
