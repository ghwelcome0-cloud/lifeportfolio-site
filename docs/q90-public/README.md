# docs/q90-public — 공개 비교표 v2 (자산 폴더)

대표 지시(2026-10-12) 0~6번과 결정 D1~D7 승인에 따라 만든 **공개용 비교표의 모든 재료·도구·결과**를 이 폴더 하나에 쌓는다.
설계 문서: `lifeportfolio-site` 저장소 `docs/q90/G21_공개비교표_v2_설계_2026-10-12.md`.

- **Q90 내부 채점(G16/G17)과는 별개 트랙**이다. 자사(OWN) 행 점수는 Q90 2회차 scorer 결과를 **전사만** 한다(이 폴더에서 자사를 채점하지 않는다).
- 세 가지 자산 원칙: 미래 유익성(다시 돌릴 수 있음) · 통제 가능성(모든 값에 출처·sha256) · 축적 가능성(지우지 않고 run 폴더를 더한다).

## 폴더 지도

| 경로 | 무엇 | 바뀌는 때 |
|---|---|---|
| `roster/roster-v2.json` | 명부 41행 (세계 26 + 국내 14 + 자사 1). ID는 영구 불변, 퇴역은 `retired:true`로만 | 행 추가 시 (삭제 금지) |
| `rubric/rubric-v2.json` | 축 A1~A8·공개 가중·근거 등급 E1~E4·E2 judge 질문·자사 행 규칙 | 개정 시 version 올림. A2·A3·A4는 고정 축 |
| `tools/measure-e1.cjs` | E1 실측기 (390px 모바일·보안 헤더·공개 표면 probe) → `runs/<날짜-rN>/e1-results.json` | 거의 안 바뀜 |
| `tools/score-e1.cjs` | E1 채점 (A6.1/6.3/6.4 레벨, A6 부분합 /9, A7 등급 상·중·하) → `e1-scored.json` | 루브릭 개정 때 |
| `tools/gen-e3-sheet.cjs` | E3 공개 문서 수집 시트 생성(값마다 `source_url`·`collected_at`) | — |
| `tools/gen-e2-sheet.cjs` | E2 공개 샘플 리포트 블라인드 채점 시트 생성(blind_id, judge 2인+제3자) | — |
| `tools/build-table.cjs` | 표 빌더 → `table-v2.{md,html,json}` (프로필형·순위 없음·셀마다 근거 등급) | — |
| `tools/diff-runs.cjs` | 두 run 사이 E1 변화 목록 | — |
| `sheets/e3-docs.json` | E3 수집 시트 (41행, 채우는 중) | 수집할 때마다 |
| `sheets/e2-samples.json` | E2 채점 시트 (40행, 샘플 URL 확보분만 `ready`). `salt_sha256` 결박됨; salt 원본은 저장소 밖(총괄 보관, AI Drive 백업), 채점 뒤 `salt_revealed`에 공개 | 채점할 때마다 |
| `runs/2026-10-09-r1/` | G18 1차 실측(26행) — 구 도구 결과를 `e1-results.json`으로 감싸 이관 | 고정 |
| `runs/2026-10-11-r2/` | G17 사전측정 2차(26행) + **표 v2 빈 틀**(`table-v2.*`) + `diff-vs-r1.txt`(변화 0) | 고정 |
| `table/` | 공개 확정본만 복사해 둔다(G19 검토 통과 후) | 공개 때 |

## 다시 돌리는 법

```bash
cd docs/q90-public
RUN=runs/$(date -u +%F)-r3 && mkdir -p $RUN
# E1 실측 (puppeteer-core + chrome-headless-shell 필요; 환경변수 PPTR_CORE, LP_BROWSER_PATH)
node tools/measure-e1.cjs roster/roster-v2.json $RUN
node tools/score-e1.cjs $RUN
# 시트 (기존 값 보존하며 새 행만 추가)
node tools/gen-e3-sheet.cjs roster/roster-v2.json sheets/e3-docs.json sheets/e3-docs.json
node tools/gen-e2-sheet.cjs roster/roster-v2.json sheets/e3-docs.json sheets/e2-samples.json sheets/e2-samples.json
# 표 (own.json = Q90 2회차 scorer 전사 파일; 없으면 자사 행은 전부 미측정)
node tools/build-table.cjs roster/roster-v2.json rubric/rubric-v2.json $RUN sheets/e3-docs.json sheets/e2-samples.json [own.json]
node tools/diff-runs.cjs runs/2026-10-11-r2 $RUN
```

## 표 읽는 법 (공개 문구와 동일)

- **굵게** = E1 우리가 직접 잼 · (샘플) = E2 회사가 공개한 샘플 리포트를 블라인드 채점(회사가 고른 최상 예시) · (문서) = E3 공개 문서 · **미측정 = 근거 없음, 0점 아님**.
- ★ A2·A3·A4(각 20점)는 고객 가치의 실체라 어떤 개정에서도 빠지지 않는다. E1/E2 근거 없으면 점수를 쓰지 않는다(추측 금지).
- A7 보안은 **등급(상·중·하)만** 공개(D2). 취약점 상세·probe 경로는 공개하지 않는다.
- A8 비용 대비 효용: 가격 투명성·구간·재이용 비용·효용 밀도. "싸다 = 좋다"가 아니다. 공공 무료 검사는 세금 운영 각주.
- 순위 열 없음. 모든 행에 "이럴 때 이 도구"(그 회사 말로)와 "한계"(공개 문서 기준) 필수. 자사도 같은 칸을 같은 기준으로 채운다.
- 자사 점수 주장 범위: tag `q90-r2-candidate`(3d3ebb4) 시점 제품에 한함. 현재 라이브 ≠ 측정 대상임을 적는다.

## 현재 상태 (2026-10-12)

- [x] 명부 v2 41행 고정(결과 보기 전 고정 `frozen_before_results:true`)
- [x] 루브릭 v2 고정, D1~D7 승인 반영
- [x] 도구 6종, r1/r2 run 이관(E1 26행), 표 v2 빈 틀 생성 (E1 셀만 채워짐: A6 부분 3/6지표, A7 등급)
- [x] E2 블라인드 결박: salt 기반 blind_id(salt_sha256 `5516a97e…`), 내용 가림 목록·누출 검사, 집계(차이≤1 낮은 값 / ≥2 제3자 선택), actor 격리 — 2026-10-12 팀 권고 반영
- [ ] E3 수집 — 41행 × 17칸. **10/41 착수**(2026-10-12: 고용24 7행·커리어넷 3행, 공식 안내문 기준). 명부 v2 시간 값 정정 3건(K08 90→80, K13 20→10, K14 20→30)은 시트 note에 기록, 명부는 그대로(값은 시트가 우선)
- [ ] E2 — 샘플 리포트 확보 → 블라인드 2인 채점 (Q90 judge 세션과 분리)
- [ ] E4 — 공개 반응 방향+표본(≥20)
- [ ] 자사 행 — Q90 2회차 scorer 결과 전사(own.json)
- [ ] D7 — Duolingo식 카드 선택 페이지 데이터(표 확정 후)
- [ ] G19 검토 → `table/`에 공개 확정본

## 알려진 한계·결함 기록

- r1/r2는 구 도구(`g18m/measure.cjs`)로 잰 것을 이관했으므로 `tool_sha256:null`, `imported:true`. 다음 run부터 `measure-e1.cjs`로 잰다.
- K01(고용24) 2회 모두 타임아웃 → A6 미측정(헤더만 r1 값). 국내 신규 14행(K01a, K08~K20)은 아직 E1 미측정.
- A6는 6지표 중 3개(6.1/6.3/6.4)만 자동 실측 → 부분합 `/9`로 표기. 나머지는 E2/E3로 보강.
- **r1↔r2 변화: 레벨 변화 0, 원시값 변화 1행(K03: docW 400→390, overflow true→false, 터치 23→21)** — `diff-vs-r1.json`. 바이트 hash가 없어 사이트 개편인지 측정 흔들림인지 가를 수 없음(Peer 6037125). "재측정 시 값 변동" 표시 기준 = **원시값**(레벨만 같은 경우도 표시) — 결과 전 결박.
- K01(고용24)의 r2 A7 등급은 **1판 값 이월(2026-10-09)** 이며 표에 그렇게 표기한다. `measuredAt`이 r2 시각으로 들어 있는 것은 이관 자료의 결함(원본 보존, 표기로 보정).
- r1·r2 도구 사본 `legacy-tool.cjs`와 sha(r1 `9319c23f…`, r2 `6f1e21c2…`), 둘의 diff(`legacy-tool-diff-vs-r1.txt`)를 run 폴더에 넣었다 — 메시지 없이 폴더만 보고 대조 가능.
- 스크린샷(약 11.6MB)은 이번 run까지만 저장소에 둔다. 다음 run부터는 hash 목록만 저장소, 원본은 AI Drive/Release(TL 6037115).
- r1·r2에는 표면별 응답 바이트 hash가 없다(Peer 권고 6032265 ②). `measure-e1.cjs`부터 `headers.bodySha256`·`mobile.domSha256`을 적는다. r1↔r2 도구 차이는 출력 폴더명 1줄뿐(diff 보존: 1판 `9319c23f…`, 2판 `6f1e21c2…`).
- 공개에는 최신 run만 쓰고 이전 run은 부록으로 남긴다(Method 권고 6032261). 두 run이 다른 칸은 "재측정 시 값 변동"으로 표시한다.
- `table-v2.html`은 git에 넣지 않는다(.gitignore). 저장소의 `ux_quality_gate`가 추적 중인 모든 HTML을 고객 페이지로 세어, 첫 PR #391에서 "구조 태그 0개 +1 악화"로 CI가 떨어졌다(내 실수). md/json에서 재생성 가능하므로 산출물만 뺐고 게이트는 손대지 않았다.
- 빌더 2판 결함: 소요(분)·매력·한계에서 **명부 값이 시트(출처 있는 값)를 덮어썼다**(K08 80분이 90으로 표시). 같은 날 발견·수정 — 이제 시트(E3, 출처 필수) 우선, 명부는 보조.
- 빌더 초판은 E3 시트의 `{value,source_url}` 묶음을 그대로 찍는 결함이 있었음(`[object Object]`). 같은 날 수정, 미공개 상태에서 발견.
