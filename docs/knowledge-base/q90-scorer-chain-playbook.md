# KB-07 Q90 scorer 체인 플레이북 — 사전 결박 계약으로 자사 점수를 "결과를 보고 고칠 수 없게" 내는 법

실전: Q90 1회차(2026-10-09) · 2회차(2026-10-13). 두 번 모두 **공식 점수 없음(scorer 절차 차단)**. 이 플레이북은 "점수를 내는 법"이 아니라 "**규칙을 결과보다 먼저 묶고, 막히면 막힌 그대로 공개하는 법**"이다. 정본은 G14·G16·G17(webapp 브랜치 `q90/docs-chain-2` `docs/q90/`) — 여기는 요약과 절차.

## ① 확인된 것
- **체인 순서(2회차 실측):** 계약·판정규칙 사전 고정(G16) → 후보 commit 동결(tag `q90-r2-candidate` = 3d3ebb4, frozen_at 2026-10-11T20:48:25Z, roles 933b29a2) → 본 실행(하네스, 단위별 obs-recorder) → 증거팩 봉인(binding_at 2026-10-13T09:32:35.950Z, MANIFEST b3b9ba10) → judge 묶음(라벨 무작위, 가림) → judge 2인 × 2run → 불일치는 adjudicator → freeze 영수증·사전등록 → **scorer 1회** → G14 전사 → 공개표 자사 행.
- **scorer는 첫 실패에서 멈추고 점수 전부 null**(1회차 §4.0). 1회차 `R18_owner_freeze_required` → `R19_run_entrypoint_binding`(실행 2회), 2회차 `R19_execution_scope_required`(1회, 37행). 2회차 차단은 **미리 알고 제출**(B1 (나)) → "2회차 유효 결과", G16 §7.3 3회차 자동 조건 미발동.
- **G14 표기 3종 구분**(Method 6196974): 행 각주 "미달성(사유: 코드)" / 축 칸 "채점 안 됨(scorer 차단)" / 비교 행의 "미측정"·"해당 없음"과 범례에서 따로 정의(Peer 6197645, PR #430).
- **결과 뒤 바꾸지 않는 것:** G17 공개 문구 1~29번(결과 전 결박), 영향 체크 목록 66e452c2, binding_at. 바꿀 일이 생기면 **새 번호의 "정정/보강" 줄**만 추가(G17 30~36번이 실례).
- **열람 상태를 메시지마다 적는다:** "공식 점수 열람 0회, 보조 A·B 1회(op:191)". 보조 결과라도 스레드에 수치를 올리면 "열람 1회"가 된다.
- **같은 계정 한계:** 대표·총괄이 GenTeam·GitHub 계정을 공유 → 대표 승인을 발신자 기준으로 독립 대조할 수 없음(attestation v3 bf5d3be0 `owner_identity_limit`).
- **E1 "성공" 정의가 도구마다 다르다**(Peer 6970351): 수령 검사기(`verify-run-meta.cjs`) 성공 = **전체만**(A6·A7 둘 다 2xx) · 조립기(`assemble-latest.cjs`)·진행률 = **전체+부분**(한 축만 2xx도 셈, G21 §24-b). r6 "검사기 3 성공인데 표 +4"는 K08(A7만) 부분 1행 차이 — 보고할 때 어느 정의인지 함께 적는다.
- **공개 문서는 전재만:** 1·2회차 통합본은 출처 절을 기계로 복사하고 `docs/q90/tools_verify_transcribe.sh`로 바이트 일치 검사(8절).

## ② 아직 모르는 것
- scorer 38~67행·기반 채점(blind leakage 포함)은 **한 번도 scorer로 실제 실행된 적이 없다**(2회차 37행 정지). TL 직접 확인(e016cf6f)은 scorer가 아니다.
- 블라인드 정규식이 제품 고정 문구("before")를 누출로 볼지 — 3회차 전에 결박하지 않으면 69행 `judge_artifact_blind_leakage` 예상(추정).
- Q90 단독 비용 측정 방법 — 계정 잔액 차이는 다른 활동과 분리 불가(§7.3 문구, G17 35번).

- 수령 검사기가 `unknown` 값(예: r6 `accept_language_sent=unknown`)을 PASS로 통과시킨다 → 언어 조건 같은지 확인 불가. **다음 개선: unknown이면 경고 출력**(PASS는 유지, 각주 의무)(Peer 6970351 · Method 6970353).

## ③ 도구·파일
- 계약: `docs/q90/G16_판정규칙_사전고정_*.md`(§7.3 3회차 조건) · 공개 문구: `G17_공개문구_2회차_결박본_2026-10-13.md` · 1회차 전사: `G07_G14_판정기록_1회차_전사본_2026-10-09.md` · 통합 공개본: `Q90_공개기록_1·2회차_통합_2026-10-14.md`
- 증거: `docs/q90/r2-evidence/`(EVIDENCE-LEDGER 41행, scorer-output-r2 3a37f944, receipts-r2, adjudication A3 b355a0d0 / B4 ca873791)
- 자사 행 전사: `docs/q90-public/tools/own-transcribe.cjs` → `table/own.json` → `build-table.cjs`
- 발송 게이트: `/home/user/work/gsend.sh`(긴급어 GATE-STOP·첨부 대조)

## ④ 실수 장부(이 영역)
T15(노출) · T17(예산 체크포인트 미이행) · T18(다중 첨부) · T19(긴급 DM 미확인) · T20(식별값 손입력) · T21(집계기 note 문장 판정) → `defect-ledger.md`. 공통 뿌리: **사람 손으로 옮긴 값·문장**. 대책은 전부 "복사·기계 검사"로.

## ⑤ 3회차가 승인되면 이 순서로 (G16 새 결박 전제)
1. 실행계획 템플릿에 seal_destination · profile_sha · clock_sha · dependency_policy_sha · environment.isolation_evidence_ref 추가(37행 뿌리).
2. 블라인드 정규식 "before" 처리 사전 결박(69행 뿌리).
3. binding_at 순서(잠금 ↔ 증거팩 봉인) 계획서에 명시.
4. judge 발주 전 묶음 검사(`_` 키 0, contrast 문자열 0, 가림 개수 메타 없음, evidence 키 이름 동일).
5. **2회차 judge 4명·adjudicator 전원 재사용 금지**, 새 빈 agent(KB-04). 규칙 질문 답은 4방 동시, 제출된 run 미수정.
6. scorer **구조 dry-run**을 0단계로(판정 없이 37~67행 통과 확인) → 본 실행.
