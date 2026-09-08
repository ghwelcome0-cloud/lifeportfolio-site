# 측정값을 사람이 옮겨 적지 않는 구조 설계

> 발주 O — 설계·판정·검증안만 제출. 저장소 변경 없음.
>
> 기준일: 2026-08-31  
> 대상: 정적 HTML + Firebase Hosting, Node ESM 게이트, GitHub Actions  
> 판정 원칙: 측정되지 않은 상태는 PASS가 아니다.

## 0. 결론 요약

채택 권고는 **“정책 JSON + 승인된 측정 레코드 JSON을 SSOT로 두고, 문서는 그 JSON에서만 생성하는 혼합형”**이다.

진실의 계층을 다음처럼 고정한다.

1. **측정 정책 SSOT** — 무엇을, 어떤 환경과 반복 규칙으로 측정하며 어떤 상태를 PASS/FAIL/BLOCKED/INFRA로 판정하는지 정의한 커밋된 JSON
2. **승인된 관측 SSOT** — source SHA와 Hosting manifest digest에 결박된 커밋된 JSON
3. **문서** — SSOT JSON에서 생성되는 읽기 전용 요약. 사람이 숫자를 직접 쓰지 않음
4. **CI artifact** — 원시 표본·스크린샷·로그를 운반하는 보조 증거. 보존기간이 있으므로 SSOT가 아님
5. **실서비스 RUM** — 실제 사용자 환경의 별도 증거 계층. 로컬 Lab 측정값을 덮어쓰거나 혼합하지 않음

브라우저 게이트가 `continue-on-error: true`여도, 뒤에 **항상 실행되는 필수 검증 단계**를 둔다. 이 단계는 결과 파일의 존재·스키마·전체 행렬·source/manifest 결박·상태를 검증하고 PASS 이외에는 비정상 종료한다. `continue-on-error`는 진단 파일을 끝까지 남기기 위한 장치일 뿐, 판정 면제가 아니다.

---

## 1. 현재 조건에서 확인된 사실과 미확인 사항

### 확인된 사실

- Firebase Hosting 공개 루트는 `dist/hosting`이다.
- `scripts/build-hosting.mjs`는 추적·허용된 입력을 복사하고 `dist/hosting-manifest.json`에 파일별 byte/SHA-256을 기록한다.
- `docs/`, `scripts/`, `reports/`, `.github/`는 공개 Hosting 산출물에 포함되지 않는다.
- 저장소 루트는 `.mjs`를 이용해 ESM 게이트를 실행하는 관례가 있다.
- `scripts/test-all.mjs`는 하위 프로세스의 비정상 종료를 모아 최종 실패시킨다.
- `scripts/regular-inspection.mjs`는 이미 PASS/FAIL/MANUAL을 구분하며, 미측정이 있으면 exit 2를 반환한다. 즉 저장소에 “미측정은 통과가 아니다”라는 선례가 있다.
- Hosting artifact/provenance 흐름은 artifact의 **존재만** 믿지 않고 source SHA, manifest digest, ancestry, canonical rebuild를 별도 검증한다.
- 현재 런타임 CWV 수집은 RUM 성격이며, 로컬 Lab 측정과 같은 증거가 아니다.

### 미확인 또는 현재 저장소에서 찾지 못한 것

- 실제 `dist/hosting` 12지면을 대상으로 하는 CWV 브라우저 게이트의 현재 구현·스키마
- 렌더된 터치타깃을 전수 측정하는 현재 게이트와 예외 정책
- CLS/LCP 반복 횟수·집계 통계·settle 조건의 정본
- 측정 레코드 freshness 정책
- 문서의 generated marker 표준

따라서 아래 설계는 특정 미확인 게이트의 필드명을 사실처럼 가정하지 않는다. 구현 전 각 생산자가 출력할 공통 envelope만 계약으로 고정한다.

---

## 2. 공통 설계 원칙

### 2.1 정책과 관측을 분리한다

- **정책**은 비교적 안정적이다: 경로, 뷰포트, locale, 반복 횟수, 통계량, 임계값, 예외, 상태·exit code.
- **관측**은 변동한다: 각 회차의 raw CLS/LCP, 브라우저 버전, 실패 selector, timestamp.

둘을 한 파일에 넣으면 수치 한 번 요동할 때 정책 파일까지 변경된 것처럼 보인다. 별도 파일이어야 리뷰가 “판정 규칙 변경”과 “새 관측 수용”을 구분할 수 있다.

### 2.2 측정 상태는 4개 이상으로 나눈다

```text
PASSED          측정 행렬 완전 + 임계값 충족
FAILED_TEST     측정 완료 + 임계값 위반
FAILED_BLOCKED  필요한 브라우저/서비스/권한/입력 부재로 미측정
FAILED_INFRA    크래시·타임아웃·결과 훼손 등 인프라 실패
```

`FAILED_BLOCKED`와 `FAILED_INFRA`를 PASS로 변환하면 안 된다. CI에서 producer가 `continue-on-error`여도 final verifier는 위 세 비-PASS 상태 모두 nonzero로 처리한다.

### 2.3 모든 관측은 측정 대상을 결박한다

최소 결박값:

```json
{
  "source_sha": "40-hex",
  "hosting_manifest_sha256": "64-hex",
  "build_target": "dist/hosting"
}
```

문서에 최신 숫자가 있어도 이 두 값이 현재 평가 대상과 다르면 `STALE/BLOCKED`이며 PASS가 아니다.

### 2.4 Lab과 RUM을 섞지 않는다

- Puppeteer/로컬 정적 서버 결과: `evidence_class: "lab"`
- 실제 사용자 web-vitals 수집: `evidence_class: "rum"`

Lab LCP 1,112ms를 실제 고객 LCP라고 쓰지 않는다. RUM과 Lab은 서로 다른 레코드·집계·신선도 정책을 가진다.

---

## 3. SSOT 후보 3안 비교

## 안 A — 게이트가 JSON 측정 레코드를 만들고 저장소에 커밋

### 구조

```text
contracts/measurement-policy.v1.json       # 안정적인 판정 정책
measurements/current/<gate-id>.json         # 현재 승인된 관측
measurements/baselines/<gate-id>/<id>.json  # 선택된 기준선만 보존
```

`measurements/`는 Hosting allowlist 밖에 두어 고객 공개 산출물에 들어가지 않게 한다. `assets/data/`는 공개 트리이므로 사용하지 않는다.

### 장점

- 기계 판독·스키마 검증·diff·source 결박이 가능하다.
- “이 커밋에서 승인된 수치가 무엇이었나”를 CI artifact 만료 뒤에도 답할 수 있다.
- 문서, 대시보드, PR 요약이 같은 JSON을 읽을 수 있다.
- 누락/빈 행렬/오래된 source를 fail-closed로 판정할 수 있다.

### 단점

- CLS/LCP처럼 요동하는 숫자를 매 실행마다 커밋하면 diff 소음과 저장소 팽창이 크다.
- 생산자가 JSON을 만들었다는 사실만으로 그 값이 승인된 것은 아니다.
- 사람이 JSON을 직접 수정할 수 있으므로 provenance 검증과 생성 명령 재실행 비교가 필요하다.

### diff 소음 판정

- 매 CI run의 raw 표본을 커밋: **매우 큼 — 비권고**
- `current.json` 한 개와 의미 있는 기준선만 커밋: **중간**
- 원시 표본은 artifact, 커밋에는 집계·digest·실패 목록만: **낮음~중간 — 권고**

### 요동 항목 저장 방식

CLS/LCP는 단일 “최악값”만 저장하지 않는다.

- raw samples 또는 raw artifact digest
- 반복 횟수
- 집계 함수(예: median, p75, max)
- gate verdict에 실제 사용한 통계량
- 표본별 route/viewport/locale
- 허용 변동대와 임계값

예:

```json
{
  "metric": "LCP",
  "unit": "ms",
  "aggregation": "median",
  "samples": [1012, 1112, 1068, 1091, 1044],
  "value": 1068,
  "threshold": 2500
}
```

CLS는 측정 종료 조건도 기록한다. 예: load 후 5초 + 지정 interaction 완료 + network idle 500ms. 종료 조건 없는 CLS끼리는 비교하지 않는다.

### 환경 기록

관측 레코드에 다음을 필수화한다.

```json
{
  "environment": {
    "evidence_class": "lab",
    "node_version": "22.x",
    "browser_product": "Chromium",
    "browser_version": "...",
    "os": "ubuntu-...",
    "cpu_profile": "unthrottled|4x",
    "network_profile": "local-static|preset-name",
    "viewport": {"width": 375, "height": 812, "dpr": 1},
    "locale": "ko",
    "runs_per_case": 5,
    "lab": true
  }
}
```

### 오프라인/CI 미측정 오독 방지

- producer가 파일을 만들지 않음 → verifier FAIL
- `status` 누락/unknown → verifier FAIL
- `FAILED_BLOCKED`/`FAILED_INFRA` → verifier nonzero
- expected route×viewport×locale×repeat와 observed exact equality
- `source_sha`/manifest digest 불일치 → `STALE`, nonzero
- `measured_at`만 있고 실제 sample 0 → FAIL

### 판정

**SSOT로 가장 적합.** 단, “정책 JSON”과 “관측 JSON”을 분리하고 매 run raw history 커밋을 금지해야 한다.

---

## 안 B — 문서 자리표시자를 JSON/게이트 출력으로 생성

### 구조

```md
<!-- BEGIN GENERATED: cwv-summary -->
...자동 생성 영역...
<!-- END GENERATED: cwv-summary -->
```

생성기는 JSON을 읽어 문서를 만든다. checker는 임시 파일에 재생성하고 커밋된 문서와 byte 또는 canonical AST를 비교한다.

### 장점

- 사람이 별도 JSON을 열지 않아도 현재 상태를 읽을 수 있다.
- 숫자를 수동 복사하지 않는다.
- PR diff에서 결과 변화가 눈에 잘 보인다.

### 단점

- JSON 없이 문서가 유일한 저장소라면 마크다운 parser/format이 곧 데이터베이스가 된다.
- generated marker 누락·중복·중첩·수동 편집이 새로운 사각지대가 된다.
- per-route raw 표본을 문서에 넣으면 diff가 과도하다.
- 생성 문서와 JSON을 둘 다 독립 수정 가능하게 두면 진실이 2개가 된다.

### diff 소음 판정

- 모든 raw 표본 표: **큼**
- 최신 summary 1개(상태, 집계, 범위, source, 명령): **낮음~중간**
- 변동값을 문장 곳곳에 반복: **매우 큼 + drift 위험 — 금지**

### 요동 항목 저장 방식

문서에는 raw 수치를 반복하지 않고 다음만 생성한다.

- verdict에 사용된 통계량
- sample count와 집계법
- 범위(route/viewport/locale)
- source/manifest 짧은 digest
- 상세 JSON 경로

raw samples는 JSON 또는 artifact에 둔다.

### 환경 기록

문서 generated block에 압축 표를 넣되, 정본은 JSON이다.

| 필드 | 예 |
|---|---|
| 증거 종류 | local lab |
| Browser | Chromium 1xx.x |
| Matrix | 12 routes × 2 viewport/locale 조합 |
| Repeat | 5 |
| Aggregate | median LCP, max CLS |

### 오프라인/CI 미측정 오독 방지

- JSON status가 비-PASS면 생성 문서도 반드시 `미측정/차단/인프라 실패`로 출력
- placeholder 자체가 없거나 2개 이상이면 checker FAIL
- marker 내부 수동 수정은 regenerate check FAIL
- stale JSON이면 숫자 대신 `STALE — 재측정 필요`만 생성

### 판정

**SSOT가 아니라 파생 표현 계층으로 적합.** JSON 없이 단독 채택하면 비권고다.

---

## 안 C — 문서에는 숫자를 쓰지 않고 실행 명령·판정 규칙만 기록

### 구조

```md
npm run build:hosting
npm run measure:cwv -- --json
npm run verify:measurement -- measurements/current/cwv.json
```

### 장점

- 숫자 drift와 문서 diff가 없다.
- 항상 새로 측정하도록 유도한다.
- 구현이 단순하다.

### 단점

- 승인 당시 수치를 보존하지 못한다.
- CI artifact가 만료되면 과거 판정 근거가 사라진다.
- 로컬 브라우저·OS 차이 때문에 실행자별 결과가 달라질 수 있다.
- PR 리뷰에서 “어떤 source를 어떤 환경으로 측정했는가”를 추적하기 어렵다.
- 결국 사람이 로그 숫자를 다시 문서/메시지로 복사할 가능성이 높다.

### diff 소음 판정

**거의 없음.** 대신 감사 가능성과 과거 근거도 거의 없다.

### 요동 항목 저장 방식

저장하지 않는다. 콘솔/CI artifact에만 존재한다. 이는 “지금 재실행하면 무엇이 나오는가”에는 답하지만 “이 revision이 어떤 값으로 승인됐는가”에는 답하지 못한다.

### 환경 기록

명령이 실행 시 환경을 출력하도록 할 수 있지만, 결과와 함께 지속 저장되지 않는다.

### 오프라인/CI 미측정 오독 방지

- 명령 자체는 `BLOCKED/INFRA`를 nonzero로 반환해야 한다.
- 그러나 문서만 읽는 사람은 현재 상태를 알 수 없다. 문서에는 명시적으로 “현재 값/판정은 이 문서에 없음”이라고 써야 한다.

### 판정

**운영 인터페이스로는 필요하지만 SSOT로는 부적합.** 진단용·초기 단계에 한정한다.

---

## 4. 비교표

| 기준 | 안 A: 커밋 JSON | 안 B: 생성 문서 | 안 C: 명령만 |
|---|---|---|---|
| 기계 검증 | 높음 | 중간(원본 JSON 있을 때 높음) | 낮음 |
| 과거 revision 근거 | 높음 | 중간 | 낮음 |
| diff 소음 | 중간(설계로 낮춤) | 낮음~큼 | 매우 낮음 |
| 변동값 처리 | raw+집계+정책 분리 | 요약만 적합 | 저장 안 함 |
| 환경 메타데이터 | 구조화 가능 | 요약 가능 | 실행 로그에만 존재 |
| 미측정 fail-closed | 강함 | JSON 연동 시 강함 | 실행 순간만 강함 |
| 수동 숫자 복사 제거 | 가능 | 가능 | 메시지/보고 단계에서 재발 위험 |
| 단독 SSOT 적합성 | **가장 높음** | 낮음 | 부적합 |

---

## 5. 권고 데이터 계약

### 5.1 정책 JSON

```json
{
  "schema": 1,
  "gate_id": "browser-quality",
  "expected_matrix": {
    "routes": ["/", "/report"],
    "viewports": [
      {"width": 375, "height": 812, "dpr": 1},
      {"width": 1440, "height": 1000, "dpr": 1}
    ],
    "locales": ["ko", "en"],
    "runs_per_case": 5
  },
  "metrics": {
    "CLS": {"unit": "score", "aggregate": "max", "threshold": 0.1},
    "LCP": {"unit": "ms", "aggregate": "median", "threshold": 2500},
    "touch_target": {"unit": "px", "min_width": 44, "min_height": 44}
  },
  "accepted_status": ["PASSED"],
  "exit_codes": {"PASSED": 0, "FAILED_TEST": 10, "FAILED_BLOCKED": 20, "FAILED_INFRA": 30}
}
```

위 route·viewport·임계값은 **형태 예시**이며 현재 저장소 정본으로 확인되지 않았다. 실제 계약에는 승인된 범위를 넣어야 한다.

### 5.2 관측 JSON

```json
{
  "schema": 1,
  "gate_id": "browser-quality",
  "status": "PASSED",
  "subject": {
    "source_sha": "...",
    "hosting_manifest_sha256": "...",
    "build_target": "dist/hosting"
  },
  "environment": {
    "evidence_class": "lab",
    "browser_product": "Chromium",
    "browser_version": "...",
    "node_version": "22.x",
    "os": "...",
    "network_profile": "local-static-unthrottled"
  },
  "matrix": {
    "expected_cases": 24,
    "observed_cases": 24,
    "runs_per_case": 5
  },
  "results": [],
  "summary": {},
  "raw_artifact": {
    "sha256": "...",
    "retention_note": "diagnostic only"
  }
}
```

### 5.3 변동성 관리

- 정책 임계값 변경과 관측값 갱신을 한 PR에서 섞지 않는다.
- `current.json`은 제품/계측기/환경 계약이 의미 있게 바뀌거나 release 후보를 승인할 때만 갱신한다.
- 매 CI raw run은 artifact로 남기되 canonical current에 자동 커밋하지 않는다.
- 기준선 변경은 독립 리뷰 대상이며 변경 이유, 이전/새 분포, source SHA를 요구한다.
- CLS/LCP는 단일 run의 max만으로 기준선을 갱신하지 않는다. 반복 표본과 정해진 aggregate를 사용한다.

---

## 6. “문서 숫자와 게이트 출력 불일치” 존재 증명 검사기

검사기 이름 예: `scripts/verify-generated-measurement-doc.mjs`

### 핵심: 숫자를 검색하지 않고, 선언된 binding의 존재를 모두 증명한다

검사기는 “금지 패턴이 없으니 통과”하지 않는다. 다음 positive obligations를 전부 확인한다.

1. 정책 JSON이 정확히 1개 존재하고 스키마를 통과한다.
2. 관측 JSON이 정확히 1개 존재하고 스키마를 통과한다.
3. 관측의 `source_sha`와 검사 대상 SHA가 일치한다.
4. 관측의 manifest digest와 현재 `dist/hosting-manifest.json` digest가 일치한다.
5. expected matrix와 observed matrix의 case key 집합이 exact equality다.
6. 모든 case에 요구 횟수만큼 raw sample이 존재한다.
7. aggregate를 raw samples에서 재계산했을 때 관측 JSON summary와 일치한다.
8. policy로 verdict를 재계산했을 때 record status와 일치한다.
9. 문서에 generated marker가 정확히 한 쌍 존재한다.
10. JSON에서 문서 블록을 메모리상 재생성한 결과가 커밋된 블록과 byte/canonical equality다.
11. 문서 블록에 source short SHA, manifest short digest, evidence class, matrix, repeat, aggregate, status가 모두 존재한다.
12. `status !== PASSED`이면 문서가 숫자를 “통과 실적”으로 표현하지 않고 `미측정/차단/실패`로 생성됐는지 확인한다.

### 권고 실행 흐름

```text
build-hosting
  → measure producer (continue-on-error 가능)
  → artifact upload (always)
  → required verifier (always, continue-on-error 금지)
      - no file => FAILED_INFRA
      - blocked => FAILED_BLOCKED
      - threshold violation => FAILED_TEST
      - exact PASS only => 0
  → generated-doc drift check
```

GitHub Actions 개념 예:

```yaml
- name: Run browser measurements
  id: measurement
  continue-on-error: true
  run: npm run measure:browser -- --output measurement.json

- name: Upload diagnostics
  if: always()
  uses: actions/upload-artifact@<pinned-sha>
  with:
    path: measurement.json
    if-no-files-found: error

- name: Enforce measurement verdict
  if: always()
  run: node scripts/verify-measurement-record.mjs measurement.json
```

마지막 단계가 required check여야 한다. artifact upload 성공은 측정 PASS가 아니다.

### 문서 drift 판정 의사코드

```js
const policy = readAndValidate(policyPath);
const record = readAndValidate(recordPath);
assertSubjectBinding(record, currentSha, manifestDigest);
assertCompleteMatrix(policy.expected_matrix, record.results);
assertRawToSummary(record);
assertVerdict(policy, record);

const expected = renderGeneratedBlock(policy, record);
const actual = extractExactlyOneGeneratedBlock(markdown);
if (canonicalize(actual) !== canonicalize(expected)) process.exit(1);
```

문서의 임의 숫자를 정규식으로 전역 비교하는 방식은 피한다. 역사 기록·설명·임계값과 현재 관측값을 구분하지 못해 거짓 빨간불을 만든다. 비교 대상은 명시된 generated block 하나다.

---

## 7. 검사기의 음성 통제군

검사기 테스트는 정상 fixture 1개와 결함 mutation 여러 개를 같은 테스트에서 실행한다. **각 mutation이 반드시 비정상 종료하는 것**을 확인하며, 하나라도 통과하면 검사기 테스트 자체가 실패한다.

| 통제군 | 심는 결함 | 기대 결과 |
|---|---|---|
| 정상 | 완전한 정책·레코드·문서 | PASS |
| 숫자 drift | 문서 CLS 0.0501을 0.0413으로 변경 | FAIL |
| 범위 drift | 문서 24/24를 18/18로 변경 | FAIL |
| producer 부재 | 결과 JSON 삭제 | FAILED_INFRA |
| 빈 결과 | status만 PASSED, results=[] | FAIL |
| 부분 행렬 | 24 case 중 1개 삭제 | FAIL |
| 반복 축소 | 5회 중 1회만 저장 | FAIL |
| stale source | source_sha를 이전 commit으로 변경 | FAIL |
| stale artifact | manifest digest 1 nibble 변경 | FAIL |
| summary 위조 | raw LCP는 1112인데 summary를 680으로 변경 | FAIL |
| status 위조 | 임계값 위반인데 PASSED로 변경 | FAIL |
| 환경 누락 | browser_version 삭제 | FAIL |
| marker 부재 | generated block 삭제 | FAIL |
| marker 중복 | generated block 2개 삽입 | FAIL |
| 미측정 위장 | FAILED_BLOCKED인데 문서에 PASS 출력 | FAIL |
| volatile-only 정상 | measured_at만 변경, generated 정책상 비표시 | PASS 또는 의도된 doc 갱신 — 정책으로 고정 |

### 오탐 방지 증명

1. **역사 숫자 격리**: generated block 밖의 과거 수치·설명은 변경하지 않아도 검사 통과. 검사기가 문서 전체 숫자를 오해하지 않음을 보인다.
2. **순서 정규화**: JSON object key 순서만 바꾼 fixture는 PASS. 의미가 같은 데이터를 byte 차이로 실패시키지 않는다.
3. **소수 표기 정규화**: `0.0501`과 `5.01e-2`를 허용할지 정책으로 결정한다. 권고는 renderer가 고정 포맷을 만들고 문서는 byte 비교해 표현까지 단일화하는 것이다.
4. **변동 정상성**: raw samples가 바뀌었지만 재계산 summary·status·binding·문서가 모두 함께 갱신된 fixture는 PASS.
5. **상태 구분**: FAILED_TEST, FAILED_BLOCKED, FAILED_INFRA fixture가 각각 올바른 상태로는 schema-valid지만 acceptance verifier에서는 모두 nonzero인지 확인한다.

이 테스트는 “문제 문자열이 없어서 PASS”가 아니라 정상 binding 12개가 실제 존재하고 mutation마다 끊어지는지 증명한다.

---

## 8. 채택 권고

### 권고

**안 A를 SSOT로 채택하고, 안 B를 파생 문서, 안 C를 실행 인터페이스로 사용한다.**

구체적으로:

- 커밋된 정책 JSON과 승인 관측 JSON을 분리한다.
- 브라우저 raw 표본은 CI artifact에 두고, current JSON에는 aggregate·필패 목록·raw digest만 둔다.
- 문서는 generated block 하나만 갖고 수동 숫자 편집을 금지한다.
- `continue-on-error` producer 뒤에 required verifier를 둔다.
- freshness는 날짜가 아니라 source SHA + Hosting manifest digest로 판단한다.
- PASS가 아닌 상태는 모두 배포 판정상 nonzero다.
- RUM과 Lab은 다른 evidence class로 유지한다.

이 구조는 “18/18·0.0413·680ms를 사람이 옮긴 직후 24/24·0.0501·1,112ms로 낡는” 경로 자체를 제거한다. 사람은 숫자를 입력하지 않고, 어떤 레코드를 승인할지만 리뷰한다.

### 이 권고를 채택하지 말아야 할 조건

다음 중 하나라면 커밋 관측 JSON을 SSOT로 삼지 말고, 일단 안 C(명령 전용) + `미측정` 상태로 제한해야 한다.

1. 브라우저 측정 환경을 고정하거나 최소한 식별할 수 없다.
2. 반복·집계·settle 조건이 합의되지 않았다.
3. 실제 route/viewport/locale expected matrix가 확정되지 않았다.
4. 측정 결과를 source SHA와 Hosting manifest에 결박할 수 없다.
5. 생성 레코드를 독립 재계산하는 verifier 없이 producer 출력만 믿어야 한다.
6. 변동 관측을 매 CI마다 자동 커밋해야만 하는 운영 제약이 있어 PR diff가 측정 잡음으로 잠긴다.
7. Lab 수치를 실제 사용자 RUM 성과로 표현하려는 요구가 있다.

이 조건에서는 잘못된 SSOT가 수동 문서보다 더 강한 거짓 초록불을 만들 수 있다. 먼저 상태를 `FAILED_BLOCKED/미측정`으로 유지하고 측정 계약을 확정해야 한다.

---

## 9. 자기 반박

### 반박 1 — “JSON도 결국 사람이 커밋하니 손글씨와 다르지 않다”

맞다. JSON을 수동 편집하고 verifier가 없다면 이름만 SSOT다. 권고안의 핵심은 파일 형식이 아니라 **raw→aggregate 재계산, source/manifest binding, exact matrix, generated-doc equality**를 독립 검사하는 데 있다.

### 반박 2 — “CLS/LCP는 요동하므로 저장된 current 값도 바로 낡는다”

맞다. 그래서 current 값은 “영원한 성능 사실”이 아니라 **특정 source와 환경에서 승인된 관측**이다. 새 source에서는 stale로 차단하고, 같은 source의 자연 변동은 반복 표본과 정해진 통계량으로 다룬다. 실제 고객 상태는 별도 RUM 계층에서 본다.

### 반박 3 — “문서에 숫자를 아예 안 쓰면 문제가 사라진다”

문서 drift는 사라지지만 승인 근거와 감사 가능성도 사라진다. 로그나 artifact 수치를 사람이 메시지로 다시 옮기는 우회 경로도 남는다. 명령 전용은 측정 계약이 미성숙한 과도기에는 안전하지만 최종 구조로는 부족하다.

### 반박 4 — “커밋 JSON 때문에 PR diff가 너무 시끄럽다”

가능하다. 따라서 매 run raw history를 커밋하지 않고, release 후보의 canonical current와 선택된 기준선만 커밋한다. raw 표본은 digest와 함께 artifact에 둔다. 그래도 소음이 감당되지 않으면 관측 JSON 커밋을 중단하고 미측정으로 돌아가야지, CI artifact를 몰래 SSOT로 승격하면 안 된다.

### 반박 5 — “continue-on-error인데 어떻게 required gate가 되는가”

producer만 continue-on-error로 두고, `if: always()` verifier를 별도 required step/job으로 둔다. producer 실패를 허용하는 이유는 진단물을 남기기 위해서다. verifier가 결과 부재·비-PASS 상태를 다시 nonzero로 만들므로 판정은 완화되지 않는다.

### 반박 6 — “현재 저장소에 실제 CWV/터치 게이트가 보이지 않는데 설계가 과도하다”

그 가능성이 있다. 현재 확인된 checkout에서 실제 게이트 구현과 정본 행렬은 찾지 못했다. 따라서 본 문서는 특정 수치를 확정하지 않고 공통 envelope와 판정 구조만 제안한다. 구현 전에 실제 게이트가 있는 branch/PR의 출력 계약을 읽고 필드·행렬·threshold를 확정해야 한다.

---

## 10. 구현 시 최소 단계(참고, 이번 발주에서는 미구현)

1. 정책 JSON schema와 상태/exit code 확정
2. 각 게이트가 공통 observation envelope를 출력
3. source SHA + Hosting manifest digest 결박
4. raw→summary/verdict 독립 verifier
5. expected/observed matrix exact 검사
6. generated doc renderer + drift checker
7. 정상 fixture + 위 mutation 음성 통제
8. CI producer `continue-on-error` + final required verifier 분리
9. current record 갱신 정책과 artifact retention 역할 문서화

이 순서에서 1~5가 완료되기 전에는 문서 자동 생성을 먼저 만들지 않는다. 표현 자동화가 측정 계약의 부재를 가려서는 안 된다.
