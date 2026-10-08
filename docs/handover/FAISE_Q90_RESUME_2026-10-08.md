# Q90 재개 기록 — 2026-10-08

업무 ID: FAISE-20260908-Q90-01 · 상태: **resumed_by_owner** (중지 4535367 해제)

이 문서는 `FAISE_Q90_HANDOVER_v1.md`(2026-09-21 기준 정본)의 **추가 기록**이다. 인수인계서 본문·동결값·절차는 그대로 유효하며, 아래에 적힌 것만 바뀐다. 상태 JSON은 `FAISE_Q90_STATE_v1.json`을 유지하고 변경분은 이 문서가 우선한다.

## 1. 대표 결정 (2026-10-08, 채팅 지시)

| # | 결정 | 적용 |
|---|---|---|
| 1 | G07/G14 채점 시작 | 중지 4535367 해제. G13 준비 반복 없음 |
| 2 | 개선판 = 9/22 최신 main (e910 아님) | candidate 재동결 필요 → §3 |
| 3 | 표시 수정 패치를 9/22 코드 위에 재적용 승인 | 커밋 `99e15d1` → §3 |
| 4 | AX 동행자 플랫폼이 상위 지도; Q90은 그 품질 토대 | 신기능 개발은 G16 판정 후 |
| 5 | 총괄에게 전 권한 위임, GenTeam 90% 할인 적극 활용, 시너지 중심 | 독립성 있는 작업만 병렬 |

## 2. 재개 시 실측 (인수인계서 0장 "최초 행동" 수행 결과)

- GenTeam TL 스레드 `ch_4a2fbfcc…` 4535406 이후 새 메시지 **0건**.
- 잔액 1회 조회(`gsk login-info`): **492,577.2** (2026-10-08). 이전 마지막 관측 44,253.1과 다른 계정 상태. 작업별 과금 귀속은 보장하지 않음.
- 샌드박스 저장소 HEAD는 `d54c87c`(PR #335, 2026-09-22). 인수인계 기준 `a17377a`·`e910680`은 원격에 없음(로컬 전용 커밋이었음). `.git/q90-control/`, `.git/q90-recovery-20260921/`도 clone에 없음 — 인수인계서 12장 "영속 백업 미확인" 경고가 사실로 확인됨. TL executor sandbox 쪽 보존 여부는 재개 발주 시 확인.
- 9/22 PR #327~#335(9건, 작성자 대표 계정): 네 축(VII) 근거 기반 해석 엔진 `response-evidence.js`, report.html 456줄 변경, 신설 문서 4종(`고유성_*`, `벤치마크_*`, `조건부입력_*`).

## 3. 새 candidate 동결 제안

| 항목 | 값 |
|---|---|
| baseline (불변) | `b03e21901e0c1449a14ce092d0c4676d7ccf5401` |
| **candidate (신규)** | `99e15d10479ad687605e22775c17e774db4184d2` = main `d54c87c` + 표시 수정 패치 재적용 |
| 이전 candidate `e910680…` | 폐기 아님. 역사적 기록으로 보존. 채점 대상에서 제외 |
| 전체 20키 manifest object hash | `b03cc9c4493e9d9e5eafbb6171579573ff9c2030ff921489e425f92f7e6d46c5` (TL 5682675, 원14b canonical digest 방식) |
| 계약·supplement·scorer SHA | 인수인계서 5장 값 그대로 (변경 없음) |
| 사례 | 12 valid + 3 negative 그대로 |
| 역할 | author/executor/reviewer/judge1/judge2/adjudicator 기존 roles 원본 그대로 |

G03·G04의 "정의 동결"은 유지되며, 바뀌는 것은 **candidate release SHA 하나**다. 따라서 Method/Peer에게는 전면 재수락이 아니라 **candidate 교체 1건에 대한 수락**만 요청한다.

### 3.1 커밋 99e15d1에서 바뀐 것 (채점 시 참고)

- 패치 18 hunk 중 17 자동 적용, IX장 1 hunk 수작업 병합. PR294의 근거 패널 3종(전체 매핑 / 우리가 쓰지 않는 말 / 증명된 것과 아직 아닌 것) 모두 보존.
- "증명된 것과 아직 아닌 것" 패널은 IX → X장으로 이동. 이유: KO PDF 13쪽 하단 여백 9.3pt로 세 번째 패널이 잘렸음(실측). 이동 후 13·14쪽 모두 잘림 없음(KO/EN × screen/keepsake 4종 확인).
- 책 지면에서 engineVersion·rulesVersion·확장코드·discriminant 수치(38/38, 200/200, 10^58) 제거. 고유코드·생성일·답변 근거는 유지.
- 엔진·규칙·문항·매핑·RTDB rules·Functions·저장본·fingerprint·VII 네 축 투영·manualOverride 우선순위: 변경 없음.
- 검사: 인수인계서 9.3이 요구한 화면·소장판·PDF·KO/EN·manualOverride 회귀를 실행했고 통과. 검사 스크립트 2개의 기대값 갱신(`test-four-axis-reader` 비교 방식, `test-viewer-toolbar-layout` 런타임 핑거프린트 `f7c01047…`). 보호된 CI 검사(`steady-current`, `pr-head`)는 수정하지 않음.
- 시각 산출물: 샌드박스 `/home/user/q90-artifacts/p03-customer-display/` (PNG·PDF·HTML). 샌드박스 소멸 시 사라지므로 필요 시 재생성: `LP_AXIS_ARTIFACT_DIR=<dir> node scripts/test-four-axis-reader.cjs`.

## 4. 기존 npm test 실패 2건 — 원인 확정

| 검사 | 원인 | 조건 충족 시 |
|---|---|---|
| Steady current-head integration | `GITHUB_SHA`/`PR_HEAD_SHA` env 없음(CI 전용) + 샌드박스 `/tmp` 2 GB tmpfs 한도 초과 | `GITHUB_EVENT_NAME=push GITHUB_SHA=<origin/main> TMPDIR=<디스크>` → **PASS** |
| Exact PR head subprocess | 동일(`/tmp` 가득 참 → `git checkout FETCH_HEAD` exit128) | TMPDIR 디스크 지정 → **PASS** |

코드 결함 아님. 검사 코드 수정 없음. 로컬 재현 시 `/tmp` 정리 후 `TMPDIR`를 디스크로 두면 된다.

## 5. 재개 후 실행 순서 (인수인계서 7장 그대로, candidate만 교체)

1. 이 문서 커밋·push → PR → main 반영.
2. TL executor(agent_f6d6hkjm9p5k)에게 **candidate 교체 + 전체 20키 manifest hash 산출 + Method/Peer 수락 요청**을 한 번에 발주.
3. **두 버전(b03·99e15d1) 모두 생성 12+3 → 모두 봉인** → 실제 출력 hash → 블라인드 배정 → stage2 잠금 → judge 2×2. 한 버전의 판정을 보고 다른 버전을 바꾸거나 나중에 생성하지 않는다(인수인계서 7장·4005343 순서. Method 5682132·Peer 5682283 지적 반영).
4. 판정 결과를 G07(기존판 점수 확정)·G14(개선판 점수 + 전후 비교)로 나누어 기록.
5. G15 → G16 → G17~G20.

### 5.1 candidate 교체 수락 체인 (2026-10-08)

| 단계 | ref | 내용 |
|---|---|---|
| 총괄 발주 | 5681995 | candidate 교체 1건, TL/Peer/Method mention |
| Method 수락 | 5682132 | G03/G04 정합. 전면 재수락·생성 승인 아님. 브랜치 HEAD 자동 대체 금지 |
| Peer 수락 | 5682283 | 동결 정의·6역할·계약 정합. 구 e910 증거 재사용 금지 |
| TL 해시·접근 | 5682675 | **신 candidate 전체20키 object hash `b03cc9c4493e9d9e5eafbb6171579573ff9c2030ff921489e425f92f7e6d46c5`** (변경 키 release_sha 1개, 나머지 19키 동일). input rev2·census hash_match=true, private 저장영역 accessible=true |

평가 candidate는 **`99e15d1` 정확 커밋**이다. PR #340 HEAD(`13ac7ef`, 문서 추가)로 자동 대체하지 않는다.

예산: 완료단위당 총한도 6,000 / 경고선 2,000 (4117150·4535150 승인 구조 재사용). 기준 잔액 492,577.2. 조회 담당 총괄 1명.


### 5.2 준비 단계 결정·합의 체인 (2026-10-08, 계속)

| ref | 주체 | 내용 |
|---|---|---|
| 5682814 | 총괄 | 준비 범위 승인(exact 객체 반입·생성 경로 결박·공간 선예약·승인요청 1회) |
| 5683126 | TL | 공간 부족 실측: snapshot 2개 262,070,272B, restore 잔여 58,916,864B |
| 5683695 | 총괄 | **장부 증액**: restore +1 GiB, package +256 MiB, metadata +16 MiB, followup +8 MiB (크레딧 아님) |
| 5684362 | TL | 장부 SHA `7748353a…`, Git 객체 21개(commit2·tree7·blob12) 반입, 두 release inventory exit0. candidate 변경 파일 3개(report-engine.js, report-engine-v4.js, program-engine.js). 막힘: 브라우저·negative 경로 부재 |
| 5684525 | Method | **측정 경로 조건부 수락**: 실제 build:hosting 산출물 + firebase.json 규칙 서빙 + 봉인 결과 주입 + 셀 선잠금 + 1440/390 min / negative는 emulator + 외부호출 시도 카운터 + 전후 hash / A6.5는 emulator 없으면 null / 소스 무수정 |
| 5684608 | TL | 도구 설치 결정 요청: 각 commit package-lock의 puppeteer 24.43.1·firebase-tools 15.26.0 (`npm ci`, 추가 패키지 0) |
| 5684835 | 총괄 | **도구 설치 승인** (Method 조건 전부 편입) |
| 5685197 | TL | 도구 설치 완료: chrome-headless-shell 148.0.7778.97 `5e359865…`, RTDB emulator v4.11.2 `b70d9934…`. 규칙 이탈 1건(쓰기 후 예약 26,992,640B) 자진 보고 |
| 5685744 | 총괄 | 장부 증액 2: restore +2 GiB. 이탈 보고 수락(E 본보기) |
| 5685967 | TL | **두 버전 build:hosting exit0** (manifest b03 `802b7578…` / 99e15d1 `381c9e32…`). 잠근 셀 census: 744셀 `09d1d2fb…`, A6 288셀 `f724d143…`, negative 12회 `1cdc5a13…` |
| 5686654 | 총괄 | 하네스 작성 재개 + Peer/Method 검수 체인 |
| 5686901 | Method | **G16 사전고정 규칙 초판 계약 충돌 5곳** 지적 → 개정 1 |
| 5686917→5686985 | TL→Method | 제품이 CDN·운영 RTDB 고정·App Check 사용 발견 → CDN 고정본 반입 / 설정만 바꾸는 연결층 / 외부 송출 0·금지집합 fail-closed·허용목록 기록 — Method 조건부 수락 |
| 5687779 | 총괄 | CDN 고정본 반입 승인 + G16 개정 1 (`c0982890…`) |
| 5687859 | Method | 개정 1 충돌 없음, 경계 표기 1곳 → 개정 2 |
| 5688645 | TL | CDN 25개 반입 완료 3,812,239B manifest `e55691b2…`. 하네스 본체 작성 중 |
| 5688895 | 총괄 | **G16 개정 2 결박 SHA `1d5efdfe7da4c67953252226a023e430b214fa1202af1b58bbea3d53fb04b992`** |
| 5689009 | Method | **G16 개정 2 `1d5efdfe…` 결박 수락.** Method 대조 종료. 경계 비교는 정확 분수로 기록 권고 |
| 5689754 | 총괄 | 필수축 하한 비교: BigInt 분자/분모 정확 비교, 판정 기록에 방식·입력·결과 보존 지시 |
| 5689953 | TL | 하네스 판정부에 반영. emulator 연결층·카운터 작성 중 |
| 5691599 | TL | **생성 경로 막힘 보고(결과 보기 전, 생성 0회)**: candidate `report-loading.html` 907–908행이 엔진 결과에 `response-evidence.js`(`a3512e47…`) `attachAxes()`를 적용 후 저장; 원14b inventory 9경로에 이 파일 없음, baseline에는 파일 자체 없음 → 원14b 결과 주입 시 candidate만 실제 제품과 다른 결과로 측정됨. 선택지 (B) 제품 파이프라인 생성 추천 |
| 5691838 | 총괄 | **(B) 채택** (총괄 로컬 재확인: baseline 파일 없음·candidate 907–908행·Functions 호출은 `verifyB2BCode`뿐). 조건: ① 제품 파이프라인 생성본 봉인(측정 입력) + 원14b `--generate` 별도 봉인(교차 확인) → 엔진 산출 부분 canonical digest 일치 필수, 불일치 시 중단 ② 두 release 동일 절차·하네스 보정 금지 ③ 연결층 설정만·자기 규칙 ④ Functions 호출 발생 셀 null+로그 ⑤ 승인요청서 명령 재정의(60회) ⑥ 반례에 digest 불일치 중단 포함. Method 정합 확정 후 효력 |
| 5691703 | Method | **(B) 수락, (C)·(A) 기각.** 5684525 문구를 "각 release 제품 파이프라인이 실제로 저장한 결과를 봉인해 주입"으로 정정. 수락 조건 7(실행계획 hash·판정 ref 결박 / 시계·locale·난수 고정 / rev2 입력 hash 일치 기록 / canonical 봉인 후 재생성 금지 / 엔진 부분 교차 대조, 불일치는 `unexplained_same_condition_mismatches` 후보 / Functions 의존 셀 null→missing_rule / negative·A6.5 동일 파이프라인). 재현성(같은 입력 2회) 자체 시험 권고 |
| 5691754 | TL | Method 조건 7 수용, 자체 시험 6건(반례 5 + 재현성 1) 계획, (B) 확정 요청 |
| 5691957 | 총괄 | **(B) 최종 확정.** 결박 집합 = Method 7 + 총괄 6(중복 시 Method 문구 우선) + 5684525(정정) + 5686985 + G16 `1d5efdfe…` + BigInt 하한 + 새 실행계획 hash. 비결정 필드는 G04 canonical 제외 규칙 안에서만 |
| 5692045 | 총괄 | TL에 roles 원본 읽기(judge1/judge2/adjudicator 배정값 + roles SHA) 요청 — 담당자 추측 금지 |
| 5692143→5692171 | Method | 결박 추가: 실행 횟수는 잠긴 census에서 기계 산출(60회 고정 아님) + 교차 확인 보강 4개(attachAxes 직전 입력 포착 / 수신 파일 SHA=동결 tree / 비결정 필드 G04 제외만 / 저장 노드 재읽기=봉인 hash·반복 일치) |
| 5692347 | 총괄 | 5692143 결박 확정. 열람 전 기록 틀 `docs/q90/G07_G14_판정기록_빈틀_2026-10-08.md` SHA `0d6bcfff…`(b6c34bd) 고정, 하네스 출력 형식 요청 |
| 5692460 | Method | 기록 틀 초판 대조: 3곳 수정(실행 횟수 분모 census / scorer는 첫 실패에서 blocked·KO/EN 동시 null → 공식 결과와 진단 재계산 분리 / 분자·분모는 scorer 출력 아님 → 별도 BigInt + 일치 확인 칸) |
| 5692633 | 총괄 | 기록 틀 **개정 1** 커밋 `55e85b1` SHA `f82b1a3f9fafa85c6b5c52062fe23087eef8da5b213494f07893f4fb89053bf9` (초판 `0d6bcfff…` 결박 안 함). Method 재대조 요청 |
| 5692700 | Method | 기록 틀 개정 1 **확정**(SHA 직접 대조 일치, 추가 지적 없음) |
| 5692781 | TL | **negative 입력 경로 막힘**: 3건(Q3 필수 누락 / Q41 단일값 / Q4 Likert 6)은 제품 화면이 원래 막는 입력 → UI만으로는 `report_not_generated`·`existing_results_unchanged`가 리포트 단계 전 판정됨. 선택지 (N1) UI 시도 + emulator 저장 대체 2단 / (N2) 저장만 / (N3) UI만. emulator 설정 생성기 동일·경로만 상이(baseline `fd45dd5c…`/candidate `acb2c66c…`), Hosting emulator cleanUrls·redirects 재현 확인, 횟수 valid 24·negative 12/release |
| 5692965 | 총괄 | **(N1) 채택** — Method supplement `negative_execution` 정합 한 줄 확정 후 효력. 조건 ①~⑥: 저장 바이트=제품 payload 구조(valid 1건 실제 저장 노드 지문 기준, 다르면 반례 실패) / 두 release 같은 코드·바이트, `input_path`·`ui_rejected` 표기 / ②도 emulator 격리·송출 0·금지집합·전후 hash / 두 항목은 ② 열람 후 값만 유효 / UI 미거부도 그대로 기록 후 진행 / 틀 수정 필요 시 개정 2(열람 전) |
| 5692781 | TL | negative 3건은 제품 화면이 원래 막는 입력(Q3 누락·Q41 단일값·Q4 Likert 6) → (N1) 2단 측정 제안. 횟수 census 산출: release당 valid 24(12×ko/en) + negative 12(3×ko/en×1440/390). emulator 설정 baseline `fd45dd5c…`/candidate `acb2c66c…`, Hosting emulator redirects 재현 확인 |
| 5693012 | 총괄 | **(N1) 채택.** 조건: ② payload는 ①-valid 제품 포착본 스키마 기준 / 1차 제품 경로·자기 규칙으로 쓰기(거부 시 `storage_rejected` 측정값) → 2차 관리자 경로는 Method가 범위 밖이라 보면 진단용 격하 / 단계별 true·false 분리 표기 `입력 경로 대체` 명시 / 반례 7건 / 횟수·emulator 설정 수락. Method 한 줄 확인 대기 |
| (CI) | 총괄 | PR #340 `quality-axes-gates` 실패 원인: `report_ch9_render_gate`가 옛 IX 제목·각주·패널 위치 고정 → 게이트를 IX/X 재설계에 맞게 갱신(`e86a1c8`). 금지 항목 3종(분석 엔진·확장코드·10^) 부재 검사 추가. 로컬 전 게이트 통과 | → **재실행 통과(run 37733543520, 전 7 job success/skip)**

병렬(Quality 그룹 5683149 발주): G17 템플릿 5683463 · G19 체크리스트 5683482 · G18 51행 빈 틀 5683675 — `docs/q90/` 보존(SHA 검증).

## 6. 바뀌지 않은 금지 사항

Firebase 스택 유지 · 고객 데이터/결제권/고유코드/PDF 보존 · 동결 두 버전 몰래 교체 금지 · 점수 보고 기준 조정 금지 · private 원답안을 총괄/Peer/Method/LLM에 공유 금지 · 운영 배포는 별도 승인 · 공개 성능표·우위 주장은 G16 이후.
