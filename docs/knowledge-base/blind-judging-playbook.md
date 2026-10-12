# KB-01 블라인드 채점 플레이북 — AI 에이전트 judge로 공정한 채점을 돌리는 법

실전: 공개 비교표 v2 E2(2026-10-12). 9샘플 × 5축 = 45축, judge 2인 + 제3자 1인. 근거는 `docs/q90-public/sheets/e2-samples.json`의 `judge_sessions`.

## ① 확인된 것 (실측·결박)

**격리 — "무엇을 모르는가"로 지킨다**
- judge 후보는 **4단계**를 전부 통과해야 한다: 문서 grep 0(회사·평가 이름이 그 에이전트 산출물에 없음) · 채널 멤버십 0 · 메시지 검색 0 · 자기선언. (근거: G17 ⑨ — 3단계로 뽑은 3명이 전부 탈락했었다)
- 4단계를 통과해도 **MEMORY.md가 세션 시작 때 자동 로드**된다(런타임 사실). 그래서 **사전 memory_check**가 필수: Q1 "자동 로드된 메모에 검사 서비스·회사(명부 41행 또는 검사 제공사) 내용이 있는가" / Q2 "자사 작업 참여" / Q3 "모델 표시명". Q1 예 → 그 judge 전체 무효. (근거: 원 judge1 Brand Strategist가 사후 Q1 예 → 9건 무효, 교체)
- 사후 Q2 "채점 내용을 메모에 새로 썼는가" → 예면 그 시점 이후 답 무효.
- 기존 42명 중 완전 격리를 만족한 사람은 **1명**(데스크톱 관리자)뿐이었다. 제3자는 **새로 만든 에이전트**가 가장 깨끗하다(메모 0·채널 0·업무 0).

**읽기 확인(rc2) — judge가 실제로 전부 읽는지 측정**
- 합성 PDF(18쪽, 그림 PDF)에 **쪽 번호를 알려주지 않고** 숨긴 표지어 3곳·열쇠말 1곳·마지막 쪽 표 값을 묻는다. 도구 `tools/make-readcheck.py`, 정답 키는 저장소 밖.
- 1차(쪽 번호를 질문에 적음)는 측정 실패 — judge가 그 쪽만 열었다(G17 ⑪). **질문이 답을 알려주면 안 된다.**
- 200dpi 필요(170dpi에서 10pt 표지어 오독).

**패킷 — 바이트로 증명**
- tar는 재현 가능하게(`--sort=name --mtime=2026-01-01 --owner=0 --group=0 --numeric-owner`, `gzip -n`). 보낸 sha와 **DM에서 다시 내려받은 sha**를 둘 다 기록(`bytes_match`).
- 패킷 안: 가린 그림 PDF + RUBRIC.md(같은 바이트, sha 기록) + README(자기선언 문구 포함) + ANSWER 양식(judge_actor_id·A1~A5 level/reason·guess·pages_viewed·unreadable_pages·competitor_research_done_before…).

**집계 규칙(결과 보기 전 결박)**
- 차이 ≤1 → 낮은 값. 차이 ≥2 → **제3자가 두 답 중 하나를 고름**(X/Y 익명, 축마다 sha 기반 무작위 순서, 배정표는 시트에만). 평균·중간값·새 값 금지.
- 총괄은 레벨 값을 **제3자 단계가 끝날 때까지 보지 않는다**(도구가 stdout에 레벨을 찍지 않음).
- 제3자 지시문에 "tar 안 README·ANSWER는 채점자용, 당신 일은 X/Y 선택뿐" 1줄 필수.

**제3자 에이전트 설계(명세 v2, 팀 통과)**
- 설명문(bio)에 **판정 기준을 넣지 않는다**. 기준은 RUBRIC뿐. 회사 가치관은 **판정 태도**(정직·쉬운 말·단정 금지·메모 안 남김)에만. 이유: 판정자가 회사 가치관을 기준으로 가지면 경쟁 비교가 불공정해진다(Peer/TL/Method 차단급 지적으로 v1 폐기).
- 빈 "New agent" 타일·스킬 0·채널 0. 이름·설명에 Q90/회사/검사 단어 0.
- 모델: 교체 judge1과 **다른 모델** 권고. 실제로는 대표 결정으로 같은 모델(Opus 5.5) 사용 → "제3자가 고른 답이 어느 judge 것인지 축별 공개"를 결과 전 결박하고 진행. 결과: judge1 쪽 3/3 = 낮은 값 3/3(사실만).

**공개 한계 문구(확정)** — README `알려진 한계` 참조. 핵심: AI judge(분야 전문가 아님) · 메모 자동 로드는 자기선언 · 모델 동일성 미확인 · 가림 시각 확인은 AI · 제3자=judge1 같은 모델.

## ② 아직 모르는 것
- 같은 모델 judge 간 "자기 모델 답 선호"가 실제로 있는지 — 3건이라 검정 불가. 다음 회차에 모델 다른 제3자로 비교 필요.
- 차이 ≥2가 난 3축이 모두 A1인 이유 후보: 표지 전면 가림 → "첫 페이지"가 어디인지 RUBRIC에 없었음. **다음 회차 RUBRIC 사전 고정 항목**: "A1 = 가림 표지 다음의 첫 내용 쪽".
- judge의 "실제 열람 이력"을 플랫폼에서 조회할 수단 없음 → 자기선언 + rc2로만 보완.

## ③ 도구·파일
- `tools/judge-session.py <e2.json> <packetsDir> send|poll|status <role>` — active judge만, 받은 sha 재대조, 답 저장(점수 출력 없음)
- `tools/e2-third.py <e2.json> <answersDir> register|prepare|send|poll` — register: 새 제3자 기록(bio 금지어 검사·sha), prepare: 차이≥2 축 추출(X/Y 배정), send/poll
- `tools/e2-aggregate.py <e2.json> <answersDir> <out> [--internal-draft]` — 초안은 `table/` 거부
- `tools/make-readcheck.py <outDir> <pages> <seed> [dpi]` — rc2 생성(키는 저장소 밖)
- 명세·bio: `docs/q90-public/judge/THIRD-AGENT-SPEC-v2.md`, `THIRD-AGENT-BIO-v2.txt`

## ④ 실수 장부(이 영역)
⑨ 격리 단정(검증 전) · ⑪ 측정 설계가 답을 알려줌 · ⑬ 1회용 감지기 자동 재시작 → 8회 중복 발송 · ⑭ 공개 저장소에 검토 전 레벨 push. 상세 `docs/q90/G17_…md` B-1/B-1a.

## ⑤ 바로 시작하는 명령
```bash
cd docs/q90-public
# 1) 새 judge 후보 격리 4단계(문서 grep·채널·검색은 수동/CLI, 자기선언은 DM) → 시트 judges[]에 기록
# 2) 사전 memory_check + rc2 발송 (메시지 원문: /home/user/work/pre_vfx.json 양식)
# 3) 패킷 발송·회수
python3 tools/judge-session.py sheets/e2-samples.json /home/user/work/e2-judge-packets send judge1
python3 tools/judge-session.py sheets/e2-samples.json /home/user/work/e2-judge-packets poll judge1
# 4) 제3자
python3 tools/e2-third.py sheets/e2-samples.json /home/user/work/e2-judge-packets/answers prepare
python3 tools/e2-third.py ... send && python3 tools/e2-third.py ... poll
# 5) 사후 Q2 → 집계(최종)
python3 tools/e2-aggregate.py sheets/e2-samples.json /home/user/work/e2-judge-packets/answers /home/user/work/e2-judge-packets/e2-aggregate.FINAL.json
```
규칙: 1회용 폴링 스크립트는 반드시 `pm2 start … --no-autorestart`.
