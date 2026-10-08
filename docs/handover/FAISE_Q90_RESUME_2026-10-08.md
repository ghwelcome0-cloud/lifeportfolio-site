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
| 5692914→5692997 | TL·Method | Method (N1) 수락+조건 4(② 입력은 rev2 negative 바이트 그대로·형식은 같은 실행의 정상 payload 포착본 / census 단위마다 ①②를 한 artifact / ①에서 수용되면 실패 / ② `입력 경로 대체` 표기). 구조 지문은 **release마다 자기 UI 제출 valid 노드에서 따로** 추출 |
| 5693176 | 총괄 | **(N1) 최종 정리·효력 발생.** 결박 = 5692965 조건①~⑥ + 5692997 + 5692914 조건4. 5693012 '2차 관리자 경로' 철회(규칙 거부는 `storage_rejected`로 그대로 기록). 자체 시험 = 반례 6 + 재현성 1 → Peer 묶음 대기 |

### 5.3 운영 메모 — 명령 멈춤 방지 (2026-10-08)
**원칙(대표 지시 2회차 반영):** ① 한 명령 ≤90초, 대기는 PM2 잡(`/home/user/work/jobs.sh run|status|log|wait`)·감시자로 ② **답하기 전에 이 턴에서 끝낼 수 있는 일은 끝까지 끝낸다**(보고는 목적 달성 후) ③ 에이전트 체인은 자동 진행 모드(5694279)로 총괄 부재 중에도 진행 ④ 총괄 턴 재시작은 대표의 짧은 메시지("ㄱ")로 충분. 한계: 턴 자체를 스스로 재시작하는 기능은 플랫폼 영역이라 총괄이 만들 수 없음(E-1).
긴 `sleep` bash 명령이 멈춤의 원인이었다. 이후 규칙: 한 명령 ≤90초, 대기는 PM2 백그라운드 감시자(`/home/user/work/watch.sh`, 45초 주기, `watch.status`/`watch.log`에 기록)로 대체. GenTeam 읽기는 `/home/user/work/gt.sh <channel> [after_id] [limit]`.
| 5693816→5694010 | TL·총괄 | 연기 시험 통과(외부 송출 0·금지집합 0·운영 RTDB 요청 1건 가로채기→emulator). 같은 출처 중계기(127.0.0.1:5000 분기) 연결층 인정, 중계기 SHA+"응답 바이트 무변경" 반례 요구. **TL 1~5번 연속 진행 승인** |
| 5694279 | 총괄 | **자동 진행 모드 사전 승인**: TL→Peer→Method 체인은 총괄 멘션 없이 진행(최대 3회 반복). 총괄 전용: 생성 승인·judge 인계·결박값/규칙·예산·장부·제품 코드 |
| 5694324→5694515 | TL·Method | G04 원문 접근 불가 → Method가 `g04-application-v1-frozen.json`(SHA `d6018af1…`) 첨부. 판정: 제외 포인터 3개 고정, 해시 대상 `{report,program}` raw, canonical 진단용, 노드 바깥 시각은 wall_clock_metadata. `profile.submittedAt`이 서버시각이면 총괄 결정 사항 |
| 5694802 | 총괄 | 제품 소스 실측: `suvey.html` 3916/3944 `submittedAt`=서버시각, `report-loading.html` 814 → `report.profile.submittedAt`으로 복사. **결정**: ① emulator 서버시계 고정(상수 `2026-01-02T03:04:05.000Z`, 4010908) 우선 ② 불가 시 `/report/profile/submittedAt` (B) 전용 제외 +1(원값 보존·봉인 raw엔 포함·요청서/틀/G17에 공개 표기) ③ 시계 상수 통일 ④ 그 외 불일치는 후보 기록. G04 원문 `docs/q90/`에 보존 |
| (merge) | 총괄 | main #341(증거 버튼 숨김) 유입 → PR #340 충돌 1곳(런타임 지문) → 병합 후 지문 `17d16689…` 재계산(04f09a4). 4개 브라우저 검사·ch9 게이트·build 통과. 연령 표기 **A안** 반영(eb30606) |
| 5693816→5694010 | TL·총괄 | 하네스 실행 기반 연기 시험 통과(외부 송출 0·금지집합 0·운영 RTDB 요청 1건 가로채기→emulator). 같은 출처 중계기(127.0.0.1:5000 분기) = 설정만 바꾸는 연결층으로 인정, 중계기 SHA + "응답 바이트 무변경" 반례 요구. emulator 설정 SHA 갱신(`04243d0c…`/`cc65f750…`). **TL 1~5번 연속 진행 승인** |
| 5694279 | 총괄 | **자동 진행 모드** 사전 승인: TL→Peer→Method 체인은 총괄 멘션 없이 진행(최대 3회 반복). 총괄 전용: 생성 승인·judge 인계·결박값/규칙·예산·장부·제품 코드 |
| 5694324→5694515 | TL·Method | G04 원문 열람 불가 막힘 → Method가 `g04-application-v1-frozen.json`(SHA `d6018af1…`) 첨부. 판정: 제외 포인터 3개 고정, `{report, program}` **raw hash가 합격 기준**(canonical 진단용), `/report/profile/submittedAt` 제외 금지, 바깥 필드는 wall_clock_metadata. 시계 상수 4010908(`2026-01-02T03:04:05.000Z`) 사용 확인 요청 |
| 5694788 | 총괄 | 총괄 실측: 두 release 모두 `suvey.html` 제출 `submittedAt`=서버 시각(`.sv timestamp`/`serverTimestamp()`), `report-loading`이 `profile.submittedAt`에 복사 → 브라우저 시계만 고정하면 raw 불일치. **결정: emulator 서버 시계도 4010908 상수로 고정(설정층 시계 심, 심 SHA 결박, 제품·바이트 수정 0)**. 불가 시 봉인 중단·보고 → 제외 목록 변경은 총괄+Method 결정. G04 원문 `docs/q90/` 보존 |
| (운영) | 총괄 | main #341 머지로 PR #340 충돌 → 머지 커밋 `04f09a4`(핑거프린트 `17d16689…` 재산출), 브라우저 테스트 4·ch9 게이트·빌드 통과. 연령 표기 **대표 결정 A안** 반영(`eb30606`). 프리뷰 채널 pr-340 바이트=브랜치 일치, 주요 경로 200 확인. 비차단 엔진 `tools/ops/` + 제작규칙서 §10.5(v2.3.1) |
| 5694816→5694850 | Method·Peer | 서버시계 고정(①)은 G04 범위 안, +1 제외(②)는 범위 밖이나 사전 공개 변경으로 유효. 심은 "흐르지 않는 절대 고정"이어야 함. Peer 기준 (11) 추가 |
| 5696435 | TL | **emulator 서버시계 절대 고정 성공**(libfaketime, `1767323045000`=상수) → +1 제외 불필요. 58화면 UI 제출→emulator 저장 성공. **막힘**: Chrome 내장 IPv6 도달성 확인(`2001:4860:4860::8888:443` UDP connect, 송신 0, ENETUNREACH)이 셀마다 1회 → "송출 0" 문자 적용 시 전부 실패 |
| 5696601 | 총괄 | **2층 기록 승인(조건부)**: 0단계 IPv6 비활성/네임스페이스/호스트 해석 차단 1회 시도(10분) 우선 → 실패 시 ①층(TCP/UDP 송신/DNS) 0 필수, ②층 허용 조건 (a)connect만 (b)AF_INET6+DGRAM (c)목적지 고정 (d)송신 0+ENETUNREACH (e)chrome `5e359865…` 전부 충족 시만. 통제군(빈 페이지) 1회 포함, 요청서·틀·G17에 공개 표기 |
| 5696648→5696659 | Method·Peer | 2층 기록은 계약 변경 아님(negative_execution 확인항목은 `provider_not_called`뿐, "DNS/socket 0"은 Method 기준). Peer 기준 (12): 모든 자식 프로세스 추적·(a)~(e) 기계 판정·반례 1건·통제군 동일 조건 |
| 5697683→5697752 | TL | **candidate 전 구간 실행 성공**(58화면→report→program), 재현성 2회 raw 일치 `912a0c73…`, attachAxes 포착 `858b8dd3…`, 입력 digest 일치(`_email` 1키 표기), 금지 0·IPv4 송출 0. 0단계 IPv6 끄기 실패(/proc/sys 읽기전용·netns loopback 불가·플래그 무효). **막힘**: baseline `database.rules.json`(`fe4264dc…`) `\s` 정규식을 emulator v4.11.2가 거부 → baseline 시작 불가. R1/R2/R3 제시. 본 실행 3~4시간 추정 |
| 5698029 | 총괄 | repo 이력 실측: `\s`는 687a885(06-24)부터, 규칙 운영 배포 워크플로는 #325(09-19)가 최초·유일 실행이며 그때 규칙은 이미 수정본 `64aeba4d…`("Fix full rules email compatibility"). **(R1) 채택**: baseline은 자기 규칙 그대로 → 로드 실패를 측정 결과로 기록(`null: rules_load_failed`, 로그 원문+규칙 SHA 봉인), scorer `missing_rule`대로 baseline 총점 미산출, G17 공개 1줄, (R3) open rules 1회는 진단용 census 밖. 본 실행 3~4시간 승인 |
| 5698080→5698109 | Peer·Method | (R1) 정합. 정정: null은 실행 중 실제 감지 셀만(정적 셀은 측정, release 분기 금지), scorer는 null 1개로 blocked → baseline 공식 점수 없음·**G14 전후 비교 불가**, null ≠ 결함(A7 실패로 세지 않음), 진단(open rules)은 judge·블라인드 묶음 금지. Peer 기준 (13) |
| 5698244 | 총괄 | **정정 확정**: 위 5개 항목 결박. 공개 문구 "규칙 의존 셀 N개 null / 정적 셀 M개 측정. 공식 점수 없음, 전후 비교 불가". G17 템플릿 반영 |
| 5698310→5698345 | Peer·TL | Peer 기준 (14) 블라인드 누출: judge 묶음에 release SHA·사유 문구·규칙 SHA·로그 경로·진단 artifact 금지, 식별 문자열 자동 검사. TL baseline 로드 실패 증거 봉인(규칙 `fe4264dc…`, emulator `b70d9934…`, exit 1, 로그 `0e1ea347…`) |
| (merge/deploy) | 총괄 | **PR #340 squash 머지 → main `4063375`** (7 워크플로 전부 통과, head 8d608f6). 대표 라이브 승격 승인(대화) → `firebase-hosting-live` run 37742658701 **성공**(source_run 37740437468, manifest `8c1b3357…`, main 재빌드 SHA 일치). 라이브 검증: 9개 페이지·3개 자산 md5 = 검토 산출물(index는 `/`로 301 후 일치), 주요 8경로 200, `/report`에 IX 새 제목 3회 |
| 5700180→5700683 | TL | 송출 기록기 전 프로세스 추적 검증(반례 4종 ①층), candidate 3회째 봉인 hash 동일, ①층 0/②층 9. A6 수집기 작동. baseline 정적 모드 `/suvey` `rendered=false`(M=0 가능성, 셀별 표로 확정). negative N1 DEV 1회(ui_rejected=true, 저장 200 → report 생성 — DEV 사실, 해석 0). 하네스 버그 1건 수정(기존 sid만 비교) |
| 5701022 | 총괄 | TL 재개 + **상시 재개 권한**(단위 종료 후 자동 다음 단위; 멈춤은 결박값 변경/예산 초과/총괄 전용 단계만). 24시간 내 G20 목표 공유, Peer 묶음 예상 시각 요청 |
| 5701746→5701820 | TL·Method | **교차 확인 막힘**: 총괄 조건 1 "원14b 결과와 일치"는 설계상 항상 불일치(제품은 profile 형식·careerRules·inputContractVersion을 다르게 넘김, 16경로 차이). 같은 동결 엔진+실제 인자로 재실행하면 digest `227d05a2…` 정확 일치. (X1) 제안, Method 정합(G04 REP-1은 원14b 일치 요구 없음) + 수락 조건 5 |
| 5702218 | 총괄 | **(X1) 채택·조건 1 개정**(결박 변경 공개): 포착 인자 + 동결 blob SHA 재실행 digest = 제품 저장본, 1건 불일치 시 중단. 원14b는 별도 봉인·일치 불요·차이 경로 공개. **별건: 대표 지시 "G15 전 자체 최적화"** → 1회차 채점 봉인 → 부족 근거 열람 → 개선 commit 재동결 → 재채점 → G15. Method 정합 요청 |
| 5702284→5702306 | Peer·Method·TL | Peer 기준 (15) + 최종 사례 노출 경고(재채점 점수에 표기, hold-out 권장). TL (X1) 실행기 확정, DEV 재실행 digest 일치(report 전후·program), 자체 시험 11건 중 10 통과(1건 판정식 오류 수정 중). Method: 1회 개선 필수화는 계약·G16 충돌 없음, 두 점수 모두 공개, **개정 3 결박 조건 4**(노출 표기 / 근거 요약만 열람·hash / 주장 release 사전 지정 / judge 블라인드 재적용) |
| (docs) | 총괄 | **G16 개정 3** §7 작성(열람 전): 1회차 봉인 → 근거 요약만 열람 → 새 release 재동결·재채점(2회차) → G15. 90 선언 release = 2회차(사전 지정), "같은 최종 사례 노출 후 재평가" 표기, 1회차도 G17 공개, 보류 사례 ≥3건 참고 측정, 6000 한도 내. SHA `42f371e3a83945638b49cba8abaa7b796e102e94490fbc616234d80920bfc502` |
| (CI) | 총괄 | PR #340 head `3d57dc2`: 7개 워크플로 전부 통과(quality-axes-gates 포함, run 37738814054). 라이브 = main 그대로(md5 일치) |
| (CI) | 총괄 | PR #340 `quality-axes-gates` 실패 원인: `report_ch9_render_gate`가 옛 IX 제목·각주·패널 위치 고정 → 게이트를 IX/X 재설계에 맞게 갱신(`e86a1c8`). 금지 항목 3종(분석 엔진·확장코드·10^) 부재 검사 추가. 로컬 전 게이트 통과 | → **재실행 통과(run 37733543520, 전 7 job success/skip)**

병렬(Quality 그룹 5683149 발주): G17 템플릿 5683463 · G19 체크리스트 5683482 · G18 51행 빈 틀 5683675 — `docs/q90/` 보존(SHA 검증).

## 6. 바뀌지 않은 금지 사항

Firebase 스택 유지 · 고객 데이터/결제권/고유코드/PDF 보존 · 동결 두 버전 몰래 교체 금지 · 점수 보고 기준 조정 금지 · private 원답안을 총괄/Peer/Method/LLM에 공유 금지 · 운영 배포는 별도 승인 · 공개 성능표·우위 주장은 G16 이후.
