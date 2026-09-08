# 발주 N — 게이트 11개 자체 감사 (코드 리뷰어 회신 원문)

- 수거일: 2026-08-31
- 출처: GenTeam 스레드 `ch_316971614c8888069d9340848f4e9b1b` (발주 msg 3421808)
- **첨부 파일 없음.** 이 회신은 메시지 본문으로만 제출되었으므로, 본문 원문(6,540자)을
  손실 없이 그대로 아래에 보존한다. (첨부만 훑는 수거 방식이었다면 이 건은 유실되었다 — 사건 17 교훈 3)
- 감사 대상 커밋: detached HEAD `432477caab4767e28b1885d2862fa58bf0f70bdd`
- 감사자 선언: 저장소 파일 무수정, 감사 전후 clean

---

## 원문

감사 결론: **5개 모두 현재 정상 입력에서는 초록불이지만, 신뢰성 기준으로는 5개 모두 위반**입니다. 특히 `improvement_delta_gate`는 실제 악화를 exit 0으로 승인하고, `report_ch9_render_gate`는 잘못된 장 anchor/runhead 및 숨겨진 문안도 승인합니다. 저장소는 수정하지 않았고 감사 전후 모두 clean입니다. 대상은 detached HEAD `432477caab4767e28b1885d2862fa58bf0f70bdd`입니다.

**우선순위 결함**

1. **[Critical] 개선 델타가 악화를 실패시키지 않는다** — `scripts/gates/improvement_delta_gate.mjs:144-149, 356-373`
재현: `computeDelta({values:{skipLink:100}},{values:{skipLink:1}})`은 `verdict:'worsened'`를 만들지만 CLI exit는 `current.missing.length`만 보고 0입니다. 현행 실측도 개선 5/악화 0/동일 8로 exit 0이었지만, 악화 삽입 재현은 그대로 통과합니다.
영향: CI `quality-axes-gates.yml:108-109`가 회귀를 기록만 하고 merge를 차단하지 않는 거짓 초록불입니다.
최소 수정: `rows.some(r => r.verdict === 'worsened')`이면 exit 1; “대조 전용”이 의도라면 파일/CI step을 gate가 아닌 report로 명명하고 필수 게이트에서 분리해야 합니다.
되돌리기 난이도: **낮음**. 종료 조건 1개와 self-test 1개 추가.

2. **[High] 델타 self-test가 운영 함수가 아닌 복제 구현을 검사한다** — `improvement_delta_gate.mjs:156-181, 263-280`
재현: 실제 `computeDelta()`(`133-152`)를 고장 내도 방향성 테스트는 별도 복사본 `computeDeltaWith()`를 호출하므로 17/17 PASS 가능합니다.
영향: 핵심 판정 로직 회귀를 음성 통제가 잡지 못합니다.
최소 수정: `computeDelta(metrics 인자)` 형태로 단일 구현화하거나, self-test가 export된 실제 함수를 호출하게 변경.
되돌리기 난이도: **낮음**.

3. **[High] CH9는 “지면 도달”이 아니라 HTML 문자열 포함만 검사한다** — `scripts/gates/report_ch9_render_gate.mjs:134-142`
재현: `report.html`의 page 옵션을 `anchor:"wrong"`, `runhead:"wrong"`으로 각각 변조하거나 제목에 `hidden`을 붙인 뒤 `run()` 실행 시 모두 fail 0. 실제 재현에서 wrong anchor/runhead가 포획됐는데도 통과했습니다.
영향: 목차/페이지 연결이 깨지거나 고객에게 안 보이는 문안도 승인됩니다. 코드 주석 `:21-23`의 “배치 미측정”보다 더 근본적인 가시성/라우팅 공백입니다.
최소 수정: 기대 anchor/runhead를 assert하고, 최소 DOM 파서로 `hidden`, `display:none`, `aria-hidden` 조상 여부를 확인. 실제 브라우저/PDF 게이트는 별도 유지.
되돌리기 난이도: **중간**. anchor 검사는 낮음, 가시성 검사는 중간.

4. **[High] random 게이트가 계산 속성·별칭 난수를 놓친다** — `scripts/gates/determinism_random_gate.js:39-64`
재현: export 함수에 `Math["random"]()` 및 `const r=Math.random; r()`를 넣어 호출하면 둘 다 findings `[]`; `crypto["randomUUID"]()`도 `[]`. 반면 `crypto.randomUUID()`는 검출됩니다.
영향: 실행 난수가 있어도 “executableRandomCalls:0”으로 승인될 수 있습니다.
최소 수정: tokenizer 패턴 대신 AST로 `MemberExpression(computed 포함)`, destructuring/alias 데이터 흐름을 검사하거나 ESLint `no-restricted-properties` 계열 규칙과 결합.
되돌리기 난이도: **중간**.

5. **[High] coverage 게이트는 실제 소비가 아니라 선언 문자열만 검증한다** — `scripts/gates/gate_coverage_gate.js:73-103, 131-149`
재현: 임시 트리에서 두 게이트 파일에 `ENGINE_FILES=['assets/js/real-engine.js']`, `INPUT_FILES=['assets/js/real-engine.js']`만 선언하고 실제 스캔/해시는 빈 배열을 쓰게 했는데 coverage 결과가 PASS였습니다.
영향: 목록은 완전하지만 런타임이 그 목록을 사용하지 않는 자기참조/배선 회귀를 놓칩니다.
최소 수정: 각 게이트가 JSON으로 실제 `checkedFiles`/fingerprinted files를 출력하게 하고 coverage가 subprocess 결과를 디스크 발견 목록과 비교.
되돌리기 난이도: **중간**.

6. **[Medium] hash canonicalization이 이름만 같은 의미 있는 필드를 전역 삭제한다** — `scripts/gates/determinism_hash_gate.js:20, 55-68`
재현: `{submittedAt:'A',nested:{generatedAt:'B'},real:'same'}`와 timestamp 값만 다른 객체의 hash가 동일함을 확인했습니다.
영향: 고객 노출/정렬/계산에 의미 있는 동일명 필드가 생겨도 비결정성을 숨깁니다. 현재 엔진의 생성시각 변동은 의도적으로 제거되지만 범위가 과도합니다.
최소 수정: 허용 경로를 명시적으로 제거하거나 clock을 주입해 전체 출력을 비교.
되돌리기 난이도: **중간**.

7. **[Medium] hash 반복성 표본이 2회·동일 프로세스에 한정된다** — `determinism_hash_gate.js:113-124`
재현: 상태가 3번째 호출부터 변하거나 프로세스 시작 seed/locale에 의존하면 두 번 비교로 놓칠 수 있습니다. 현재 코드에는 해당 변동이 관측되지 않았으나 통제 범위 결함입니다.
영향: 간헐·프로세스 간 비결정성 미검출.
최소 수정: 독립 subprocess에서 고정 locale/TZ로 N회 산출하고 전부 비교.
되돌리기 난이도: **낮음**.

8. **[Medium] CH9 가중치가 엔진 SSOT와 분리된 하드코딩이다** — 게이트 `report_ch9_render_gate.mjs:42`; 화면 `report.html:6555-6564`; 실제 엔진 계산 `assets/js/report-engine.js:79,115`
재현: 게이트는 문자열 `23.85` 존재만 확인합니다. 엔진 mapping이 바뀌어 실제 axisMax가 달라져도 화면과 게이트가 함께 옛 숫자를 유지하면 통과합니다. 첫 번째 `23.85`(주석)만 바꿔도 통과했고, 화면 값까지 모두 바꿔야 실패했습니다.
영향: “엔진 axisMax와 동일”이라는 설명의 진실성을 검증하지 못합니다.
최소 수정: questions/mapping으로 기대값을 계산해 렌더 값과 수치 비교.
되돌리기 난이도: **중간**.

9. **[Medium] delta 입력·기준선 무결성 검사가 약하다** — `improvement_delta_gate.mjs:108-121,124-127,348-353`
재현: pages=999, skipLink=1000, 음수 totals, `NaN`도 missing 0으로 수용됩니다. 손상 baseline JSON은 `loadBaseline()`이 조용히 null로 바꿉니다. `--save-baseline`은 `current.missing` 검사 전에 저장 후 exit 0입니다.
영향: 불가능한 수치, 기준선 손상, 불완전 측정을 정상 기준선으로 고정할 수 있습니다.
최소 수정: finite/nonnegative/ratio≤pages/pages 일치 schema 검증; baseline parse 실패는 exit 1; 저장 전 missing=0 강제 및 원자적 write.
되돌리기 난이도: **낮음~중간**.

10. **[Low] 실행 위치 의존성** — `improvement_delta_gate.mjs:50-51,100-103`; `report_ch9_render_gate.mjs:33-34`
재현: delta `--self-test`는 `/tmp/opencode`에서도 17/17 통과해 잘못된 ROOT를 드러내지 않습니다. CH9는 저장소 밖 cwd에서 import 즉시 `git rev-parse` 실패.
영향: npm/CI 경로에서는 정상이나 직접 실행·재사용 시 환경 의존 실패 또는 엉뚱한 기준선 사용.
최소 수정: 두 파일 모두 `import.meta.url` 기준 repo root 계산.
되돌리기 난이도: **낮음**.

**게이트별 a~g 판정**

판정 의미: 통과=요건 충족, 위반=재현된 공백, 미확인=로컬 증거로 확정 불가.

| 게이트 | a 실사용 조건 | b 반복성 | c 자기참조 | d 하드코딩 | e 음성통제 | f exit | g continue-on-error |
|---|---|---|---|---|---|---|---|
| determinism_hash | 통과: 실제 3단 build `:71-83` | 위반: 2회/동일 프로세스 `:115-124` | 통과: 변조 child exit 1 `:126-140` | 위반: 입력/제외키 수동 목록 `:20,25-37` | 통과: 실제 exit 1 관찰 | 통과 `:138-152` | 통과: workflow `:60-61`, 옵션 없음 |
| determinism_random | 통과: 엔진 소스 파싱 `:23-72` | 통과: 정적 결과 반복 | 위반: 음성통제가 점 표기 1종만 검증 `:75-89` | 위반: API/파일 수동 목록 `:16-21,39-40` | 부분 위반: 기본 통제는 통과하나 우회 재현 | 통과 `:102-115` | 통과: workflow `:56-57`, 옵션 없음 |
| gate_coverage | 통과: 디스크 엔진 열거 `:54-64` | 통과 | 위반: 선언 텍스트만 신뢰 `:73-103` | 위반: 대상 게이트 2개 고정 `:44-47` | 통과: phantom 엔진 exit 1 `:165-203` | 통과 `:221-222` | 통과: workflow `:50-51`, 옵션 없음 |
| improvement_delta | 통과: UX gate 실측 호출 `:100-105` | 위반: `measuredAt` 때문에 JSON byte 반복 불일치 `:117`; 측정값은 동일 | 위반: 복제 함수 검사 `:263-280` | 위반: `/170`, 13 지표, cwd root `:50,59-73` | 위반: 악화/저장 경로 통제 부재 | 위반: 악화 exit 0, save 누락 exit 0 `:348-373` | 통과: workflow `:108-109`, 옵션 없음 |
| report_ch9_render | 부분 통과: VM 실렌더이나 브라우저 아님 `:126-145` | 통과: 현재 결과 반복 | 위반: exact 결합문자열 하나만 변조 `:150-161` | 위반: 문안/23.85/stub 고정 `:37-64` | 부분 위반: 제거 통제 5/5이나 visibility/anchor 부재 | 통과: 검출된 fail은 exit 1 `:195-219` | 통과: workflow `:91-92`, 옵션 없음 |

**실행 증거**
- hash: exit 0, report/program 각 2회 동일, 내장 변조 exit 1.
- random: 저장소에 `node_modules`가 없어 최초 `MODULE_NOT_FOUND`; 저장소 밖 `/tmp`에 `esprima@4.0.1`을 격리 설치하고 `NODE_PATH`로 재실행해 exit 0, 음성 통제 exit 1. `package-lock.json:3403`에는 의존성이 고정되어 있어 CI의 `npm ci` 조건에서는 실행 가능합니다.
- coverage: exit 0, 4개 엔진 발견, 두 목록 누락/유령 0, phantom 통제 exit 1.
- delta: self-test 17/17, 실제 170페이지·missing 0, exit 0.
- CH9: self-test 5/5, cited 유/무 각 11/11, exit 0.
- CI wiring gate 자체 결과 11/11 wired. 다만 **GitHub branch protection에서 두 workflow/job이 required check로 등록됐는지는 로컬 저장소만으로 미확인**입니다.

최종 게이트 판정: `determinism_hash` **위반**, `determinism_random` **위반**, `gate_coverage` **위반**, `improvement_delta` **위반**, `report_ch9_render` **위반**. 현재 데이터 PASS와 게이트 설계 적합성을 분리한 결과입니다.
