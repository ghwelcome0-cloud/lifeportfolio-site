# 인생포트폴리오 — Stage-2 인수인계서
**작성일:** 2026-07-27 · **대상:** 신규/후임 개발자 · **작성자:** 총괄개발팀
**목적:** ① Stage-2 피드백 10건 적용 결과 검증 ② 신규 제작규칙(한 줄 평 이후) 이해 ③ 추가 개선 여지 착수 ④ 향후 제작규칙서 개정 근거

> 이 문서 하나로 "무엇이 어디에 어떻게 반영됐는지"와 "다음에 무엇을 어떻게 해야 하는지"를 모두 확인할 수 있도록 작성했습니다. **라인 번호는 편집에 따라 바뀌므로, 반드시 아래 제시한 "검색 앵커(주석/문자열)"로 찾으세요.**

---

## 0. 30초 요약 (TL;DR)

- 라이브: **https://lifeportfolio.co.kr/** · GitHub: **ghwelcome0-cloud/lifeportfolio-site** (`main` = 프로덕션)
- 배포: **git push origin main → GitHub Actions "Deploy to Firebase Hosting" 자동 배포.** ("pages build and deployment" 워크플로는 **항상 실패하지만 무시**한다.)
- Stage-2 피드백 **11개 중 10개 완료·머지·배포 완료.** 남은 1개(**#9 성과 추적 보드**)는 **대표 지시로 보류 중**.
- 이번 라운드 변경은 **전부 "렌더 레이어"(program.html / report.html의 HTML문자열 + CSS)** 이며, **엔진(.js) 로직·점수·지문은 건드리지 않았다 → fingerprint(fp) 불변.**
- 최신 커밋: `d340726` (= `origin/main`, 로컬 HEAD와 동일). 미푸시 커밋 0.

---

## 1. 시스템 개요 (새 개발자 필수 이해)

### 1.1 서비스 성격
- 기독교 세계관 기반이지만 **고객 대면에서는 종교색을 전혀 드러내지 않는** 자기진단·포트폴리오 서비스.
- 산출물 2종:
  1. **리포트** (`report.html`) — 진단 결과 문서 (Ⅰ~Ⅸ장)
  2. **맞춤형 실행 프로그램** (`program.html`) — 리포트를 입력으로 만든 12주 실행 가이드 ("리빙북" Ⅰ~Ⅸ장)

### 1.2 엔진 파이프라인 (⚠️ 로드 순서 중요)
```
career-engine.js   → 전역 CareerEngine 로 먼저 로드
       ↓
report-engine.js   → ReportEngine.build()      : 리포트 원본(raw) 생성
       ↓
report-engine-v4.js→ ReportEngineV4.upgrade()   : 융합·심화 업그레이드
       ↓
program-engine.js  → ProgramEngine.build({report,...}) : 리포트 전체를 입력받아 프로그램 생성
```
- 모두 **UMD 방식** 로드. 브라우저에서 `window.X` 전역으로 노출.
- **입력:** `data/questions.json`, `data/mapping.json`, `data/report-rules.json`, `data/career-rules.json`, `data/program-rules.json`
- **테스트 응답셋:** `scripts/kys_rtdb_node_import.json` (대표 김영식/KYS, **fp=1879861072**)

### 1.3 렌더 레이어 vs 데이터 레이어 (❗ 가장 중요한 분리 원칙)
| 구분 | 위치 | 바꾸면 영향 |
|---|---|---|
| **데이터 레이어** | `assets/js/*.js` (엔진) | 점수·지문·**fingerprint 변경 위험** → 반드시 fp 증명 필요 |
| **렌더 레이어** | `program.html` / `report.html` 안의 HTML 문자열 + CSS | 화면 표현만 바뀜 → **fp 무관** |

> **Stage-2 이번 라운드는 100% 렌더 레이어 작업.** 그래서 fp 재계산 없이 안전하게 디자인/직관성만 끌어올릴 수 있었다. 후임도 "문구·표현·레이아웃"은 렌더 레이어에서, "진단 로직·점수·지문 생성"은 엔진에서 다뤄라.

---

## 2. ⚖️ 제작 헌법 (반드시 지킬 규칙 — 위반 시 롤백)

1. **`git add -A` 절대 금지.** 항상 `git add <파일명>` 으로 **개별 지정**. (레포에 `core` 덤프와 다수 untracked 임시 디렉토리가 있어 -A 하면 오염된다.)
2. **커밋 분리:** 논리 단위 1개 = 커밋 1개.
3. **배포는 GitHub Actions 경유만.** `git push origin main` → "Deploy to Firebase Hosting". `wrangler`/수동 배포 쓰지 않는다.
4. **기능·엔진 무손상.** 리팩터링이 진단 결과를 바꾸면 안 된다.
5. **정직(honesty).** 사실 확인 후 보고, 날조 금지, 실수 인정.
6. **§7 (종교색 비노출) — 고객 대면 절대 규칙.** 아래 3장 상세.
7. **fingerprint 결정성 불변.** `KYS = 1879861072`. 엔진을 건드렸다면 반드시 재현.
8. **임시파일은 커밋하지 않고 세션 종료 시 삭제.** (`/tmp/*`, `_track3_*`, `_bp_*.html`, `core` 등은 절대 add 하지 않는다.)

---

## 3. §7 — 종교/원분야 라벨 비노출 규칙 (핵심 중의 핵심)

### 3.1 금지어(고객 대면 텍스트에 노출 금지)
- **도메인 8단어:** 종교 · 교육 · 경영 · 콘텐츠 · 선교 · 목회 · 신학 · 교회
- **종교 6단어:** 기독교 · 성경 · 예배 · 하나님 · 신앙 · 복음
- **허용:** "신념", "가치" 는 §7 금지어가 **아니다** (노출 OK).

### 3.2 스크럽(scrub) 방어선 — ⚠️ program.html에 **두 벌** 존재
| 화면 | scrub 함수 | 검색 앵커 |
|---|---|---|
| program **gx-head 대시보드**(현재 CSS로 숨김) | `PROG_DOMAIN_WORDS` 배열 기반 | `program.html` 내 `var PROG_DOMAIN_WORDS` |
| program **리빙북(실제 화면, iframe)** | `scrub()` / `sc()=esc(scrub())` / `dropDomainArr()` | `program.html` 내 `'function scrub(t)` (문자열 리터럴, 리빙북 렌더 스크립트 안) |
| report **dashx(실제 화면)** | `scrub()` / `esc()` / `dropDomainTokens()` / `compassFuse()` | `report.html` 내 `'function scrub(t)` |

- `scrub()` = 도메인 단어 **삭제** + 삭제로 생긴 빈 따옴표/중복 중점/공백 정리.
- `dropDomainArr()` / `dropDomainTokens()` = **배열 요소 통째 제거**(요소 안에 금지어가 있으면 그 항목 자체를 뺌).
- **렌더 시 규칙:** 고객 대면 문자열은 **반드시** `sc()` 또는 `esc(scrub())` 경유. 배열은 `dropDomainArr()` 먼저.

### 3.3 §7 검증 방법 (커밋 전 필수)
```bash
# 신규 diff에 금지어가 새로 들어갔는지 스캔 (0건이어야 함)
git diff <파일> | grep '^+' | grep -oE '종교|교육|경영|콘텐츠|선교|목회|신학|교회|기독교|성경|예배|하나님|신앙|복음'
```
> ⚠️ 주의: 위 스캔은 "소스에 새로 추가된 리터럴"을 본다. **엔진 데이터에서 흘러오는 값**은 소스 diff에 안 잡히므로, 실제 렌더 결과(아래 6장 로컬 렌더)에서 눈으로도 확인하라.

---

## 4. 배포 & 검증 표준 절차

### 4.1 배포
```bash
cd /home/user/webapp
git add <바꾼 파일만>              # -A 금지
git commit -m "feat(scope): ... (#번호)"
git push origin main              # → Actions "Deploy to Firebase Hosting"
```

### 4.2 라이브 반영 검증 (배포 90~150초 소요)
```bash
# 로컬 파일과 라이브 파일의 md5 가 같아지면 = 반영 완료
md5sum report.html | awk '{print $1}'
curl -sL https://lifeportfolio.co.kr/report.html | md5sum | awk '{print $1}'
```
동일 md5 = 배포 성공. (이번 10건 모두 이 방식으로 라이브 일치 확인 완료.)

---

## 5. Stage-2 피드백 10건 — 적용 내역 & 검증 포인트

> 각 항목의 "검증 포인트"를 새 개발자가 직접 눈으로 확인하며 인수받으면 된다.
> 목표 지표(공통): ① 첫인상 직관성 ② 자기인식 정확도·공감 ③ 바로 실행가능성 ④ 자산화/축적 연결성 ⑤ 전문성·신뢰감 — **각 90+ (실행 프로그램은 100 지향).**

### 리포트 (`report.html`, 실제 화면 = **dashx** 렌더)

**#1 첫인상/전반 직관성** — 초기 커밋들. dashx 상단 임프린트(사명/비전 앵커 + 진단 배지) 정돈.
**#3 Ⅲ 실행 프로파일** (`0a2b333`,`a8bdb54`,`429fad8`) — "추진력 요인"을 값 나열 → **융합 한 줄 평**으로 재작성. 검색 앵커: `report.html` `III. 실행 프로파일`.
**#4 Ⅴ 진로·경력·교육 큐레이션** (`bc5a224`,`a3e1dda`) — 현존 직업 예시 + 공감→고유성 안내 항상 노출. 검색 앵커: `V. 진로 · 경력 · 교육 큐레이션`, career-engine의 `careerExamples`.
**#5 Ⅵ 활용·다음 단계 + Ⅶ 축 상세** (`d340726`, 이번 세션):
  - Ⅵ: `[#5] VI 직관성` 주석 검색. 직무/학습 → **아이콘 카드**(`.vi-card`), 실행 과제 한 셀 뭉침 → **3단계 카드**(`.vi-task`, 완료 기준 배지 `.vi-task__done`)로 분해. `ap.job/learning` 렌더를 `esc→esc(scrub)`로 강화(§7 안전성↑).
  - Ⅶ: `axisCardHTML` 함수 검색. 축별 카드에 **지수 막대**(`.axis-bar`) + 닫는 문장 강조(`.axis-card__closer`).
  - **검증 포인트:** dashx에서 Ⅵ 실행과제가 3개 번호 카드로 나오는지, Ⅶ 각 축에 막대가 % 폭대로 차는지.

### 실행 프로그램 (`program.html`, 실제 화면 = **리빙북 iframe `#lbFrame`**)

**#2 Ⅰ 한눈에 보는 나** (`41227b0`) — 리포트 한 줄 평 공감 앵커(`.glance-oneline`) + 3층 위계(정체성 앵커 → 나는 이런 사람 → 그래서 이렇게 나아갑니다). 검색 앵커: `glance-oneline`.
**#6 표지 한 줄 평(coreOneLine)** (`41227b0` → `22d78f4`):
  - 리포트 요약의 `coreOneLine` 을 프로그램 표지·Ⅰ장에 노출.
  - **⭐ 신규 규칙(대표 지시 2026-07-27):** 프로그램의 한 줄 평은 **리포트의 한 줄 평과 "동일한 것"** 을 반영한다. 초기엔 "고객님"→"{이름}님" 인칭 치환을 했으나, **치환 제거하고 리포트 원문 그대로** 노출하도록 변경. 검색 앵커: `program-engine.js` `function pickReportCoreOneLine`.
  - 데이터 경로 주의: `buildProgramBookData` 의 cover 재구성부에서 **`coreOneLine` 필드를 명시적으로 나열**해야 유실되지 않음. 검색 앵커: `program.html` cover 매핑의 `coreOneLine: cover.coreOneLine`.
**#7 Ⅱ 분기 테마** (`706d912`) — `// II. 분기 테마 — [#7` 주석 검색. **목적 배너**(`.qpurpose`) + **할 것/하지 않을 것 2칸**(`.qdo`) + **실행순서 3-step**(`.qflow`) + **벤치마크 박스**(`.qbench`). subline을 "· 하지 않을 것:" 기준 분리, paragraphs[1]의 "A→B→C"를 스텝으로 파싱(실패 시 원문 노출).
**#8 Ⅲ/Ⅳ/Ⅴ** (`706d912`) — 주차 카드 "✓ 이번 주 손에 남는 것" 라벨(`.wk__efflabel`), 3개월/1년 **축적 배지**(`.accrue` / `.accrue--gold`), 모듈 **완료 기준 배지**(`.modc__done`, `_strategy.doneWhen` 사용).
**#10 Ⅶ 기대 효과** (`706d912`) — `// VII. 기대 효과 — [#10` 주석 검색. 정의 테이블 → **아이콘 카드 그리드**(`.eff-card`) + "여는 길" 강조(`.eff-open`). "라벨: 내용" 분해. **§7 주의:** effects 원문에 도메인 단어가 있어 `sc()`/`dropDomainArr()` 경유 필수(적용됨).
**#11 Ⅷ 다음 단계·리스크** (`706d912`) — `// VIII. 다음 단계 · 리스크 — [#11` 주석 검색. **타임라인 스텝**(`.nstep2`) + **"이럴 때 → 이렇게 회복" 대응 카드**(`.risk2`).

### 검증 완료 상태 (인수 시 재확인 가능)
- 문법: program.html 스크립트 16블록 / report.html 18블록 → **0 오류**.
- §7 신규 diff: **0건**.
- 라이브 md5: program.html / program-engine.js / report.html **로컬=라이브 일치**.
- fp: 렌더 전용 변경이므로 **1879861072 불변**.

---

## 6. 로컬에서 화면 확인하는 법 (⭐ 인수인계 핵심 노하우)

### 6.1 엔진을 Node에서 브라우저처럼 실행 (검증된 방법)
```js
// UMD를 브라우저 분기로 강제 로드: module=undefined → root.X=factory()
const fs=require('fs');const g=globalThis;
function loadUMD(p){const code=fs.readFileSync(p,'utf8');
  const fn=new Function('self','module','exports','require','window','root','globalThis',code);
  fn(g, undefined, undefined, undefined, g, g, g);}
loadUMD('./assets/js/career-engine.js');
loadUMD('./assets/js/report-engine.js');
loadUMD('./assets/js/report-engine-v4.js');
loadUMD('./assets/js/program-engine.js');
// 이후 g.ReportEngine.build(...) → g.ReportEngineV4.upgrade(...) → g.ProgramEngine.build({report,...})
```
- 입력: `data/*.json` + `scripts/kys_rtdb_node_import.json`(`answers` 키), `name:'김영식'`.
- 이 방식으로 나온 값이 **진짜 브라우저 출력과 동일**(fp=1879861072로 검증됨).

### 6.2 실제 렌더(리빙북 iframe) 확인 — Playwright
- program.html은 로그인 안 하면 login.html로 튕김(auth guard). Playwright에서 `page.route`로 HTML을 가로채 `location.replace(login.html)` / `location.replace(program-loading.html...)` 두 줄을 `console.log`로 무력화한 뒤:
  - `window.__renderLivingBook(prog)` 직접 호출 → `#lbFrame` 의 `contentFrame()` 접근.
  - 특정 섹션만 스크린샷: 프레임 안에서 대상 `.page` 에 `.__show` 클래스 토글 + 나머지 hide.
- **주의:** program.html **실제 화면은 gx-head(#programRoot)가 아니라 리빙북 iframe**이다. gx-head는 CSS로 숨겨져 있음.
- report.html **실제 화면은 dashx** 렌더다.

### 6.3 문법 검증 (커밋 전 필수)
```bash
node --check assets/js/program-engine.js
# HTML 안 스크립트 블록: <script>...</script> 추출해 각각 node --check (16/18 blocks, 0 errors 여야 함)
```

---

## 7. 🔧 추가 개선 여지 (후임이 착수할 백로그 — 우선순위순)

> 아래는 이번 검증 중 발견한 실제 개선 후보다. 모두 착수 전 대표 승인 권장.

### [P1] #9 프로그램 Ⅵ 성과 추적 보드 (보류 해제 시 최우선)
- 현재 단순 표(`.board`) + 월간 점검 리스트. 검색 앵커: `// VI. 성과 추적 보드`.
- 개선 방향: #7·#8·#11과 동일 톤(카드/타임라인/체크 시각화)으로 승격. 주차 완료 체크·회고 메모를 "기록→회고→결정" 흐름으로 시각화.

### [P2] §7 scrub 이중 구현 통합 리스크
- program.html에 scrub 로직이 **gx-head용(@`PROG_DOMAIN_WORDS`)** 과 **리빙북용(@`function scrub`)** **두 벌** 존재. report.html은 또 다른 세 번째 벌.
- 위험: 금지어 목록/치환 규칙이 어긋나면 한쪽만 새는 사고 가능.
- 개선: 3곳의 금지어 배열과 후처리 정규식을 **단일 소스로 문서화(또는 공용 스니펫화)**. 최소한 "3곳 동시 수정" 체크리스트를 규칙서에 명문화.

### [P3] "가치를 가르쳐 신념으로 세우는" 류 표현 검토
- §7 금지어는 아니라 스크럽 대상이 아니지만, 원분야(기독교) 뉘앙스가 은근히 남는 표현이 프로그램 Ⅶ 기대효과 등에 존재.
- 개선: 대표와 "허용/비허용 경계 표현" 리스트를 확정해 규칙서 §7 부록으로 추가.

### [P4] 파서 견고성 (렌더 파싱 의존)
- #7 분기테마(paragraphs 화살표 분해), #5 Ⅵ 실행과제("N) …(완료: …)") 는 **문자열 패턴 파싱**에 의존. 엔진 문구 포맷이 바뀌면 카드가 깨질 수 있음(현재는 실패 시 원문 노출 안전장치 있음).
- 개선: 엔진이 처음부터 **구조화된 배열/객체**(steps[], {task,doneWhen})로 내려주도록 데이터 레이어 개선 → 렌더 파싱 제거. (⚠️ 엔진 변경이므로 fp 증명 필요.)

### [P5] 전체 육안 렌더 QA
- 이번 라운드는 문법·§7·md5·데이터 검증까지 완료. **Playwright 리빙북/dashx 전 섹션 스크린샷 육안 검수는 미완**. 인수 직후 1회 전수 캡처 권장.

---

## 8. 🆕 신규 제작규칙 (한 줄 평 개선 이후 확립 — 규칙서 개정 반영용)

> "제작규칙서 개정" 시 아래를 정식 조항으로 승격할 것을 제안한다.

**규칙 A — 리포트·프로그램 한 줄 평 동일성**
프로그램 표지/Ⅰ장의 한 줄 평은 **리포트 요약의 `coreOneLine` 원문과 문자 그대로 동일**해야 한다. 인칭 치환·재작성 금지. (근거: 대표 지시 2026-07-27, "리포트에 있는 한 줄 평과 동일한 것을 반영".) 구현: `pickReportCoreOneLine` 은 report 문자열을 가공 없이 전달.

**규칙 B — 렌더/데이터 레이어 분리 원칙**
표현·문구·레이아웃 변경은 렌더 레이어(HTML문자열+CSS)에서 한다. 점수·지문·식별자 로직은 엔진에서만. 렌더 변경은 fp 무관, 엔진 변경은 fp 증명 의무.

**규칙 C — fp 증명 절차(엔진 변경 시)**
① 변경 후 출력 저장 → ② `git stash push -- <엔진파일>` (변경 전 상태) → ③ 재생성(before) → ④ `git stash pop` → ⑤ before/after diff. **신규 필드 + generatedAt 타임스탬프 외 차이가 없어야** 통과. (KYS fp=1879861072 유지 확인.)

**규칙 D — 5대 직관성 지표**
모든 고객 대면 섹션은 5지표(첫인상·자기인식/공감·실행가능성·자산화/축적·전문성/신뢰)로 평가. 리포트 90+, 실행 프로그램 100 지향.

**규칙 E — 커밋/배포 위생**
`git add <파일>` 개별 지정, 커밋 분리, Actions 경유 배포, 커밋 메시지에 `(#피드백번호)` 명시, 임시파일 비커밋.

**규칙 F — §7 3중 방어선 동시 관리**
금지어 노출 방어는 (1) program gx-head (2) program 리빙북 (3) report dashx **3곳**에 있다. 금지어 목록 변경 시 **3곳 동시 수정 + 렌더 결과 육안 확인** 필수.

---

## 9. 파일·앵커 빠른 찾기 표

| 대상 | 파일 | 검색 앵커(문자열) |
|---|---|---|
| 프로그램 실제 렌더 진입 | `program.html` | `window.__renderLivingBook` |
| 리빙북 §7 scrub | `program.html` | `'function scrub(t)` |
| 표지 coreOneLine 전달 | `assets/js/program-engine.js` | `function pickReportCoreOneLine` |
| 표지 cover 재구성(유실주의) | `program.html` | `coreOneLine: cover.coreOneLine` |
| #7 분기테마 | `program.html` | `// II. 분기 테마 — [#7` |
| #8 주차/목표/모듈 | `program.html` | `wkCard`, `.accrue`, `.modc__done` |
| #10 기대효과 | `program.html` | `// VII. 기대 효과 — [#10` |
| #11 다음단계·리스크 | `program.html` | `// VIII. 다음 단계 · 리스크 — [#11` |
| 리포트 실제 렌더 | `report.html` | dashx 섹션 `anchor:"ch1"` ~ `ch9` |
| #5 Ⅵ 활용 | `report.html` | `[#5] VI` (또는 `.vi-task`) |
| #5 Ⅶ 축카드 | `report.html` | `function axisCardHTML` |
| report §7 scrub | `report.html` | `'function scrub(t)` |

---

## 10. 최종 상태 스냅샷 (2026-07-27)

- **HEAD = origin/main = `d340726`** (동기화 완료, 미푸시 0)
- Stage-2: **10/10 완료·머지·배포** (#9 보류)
- 라이브 검증: report.html / program.html / program-engine.js **md5 일치**
- fp: **1879861072 불변**
- 문법: 0 오류 · §7 신규 diff: 0건

**다음 액션 제안:** (1) 6장 방법으로 로컬 재현 → 5장 검증 포인트 눈으로 인수 → (2) 7장 백로그 중 대표 승인 항목 착수 → (3) 8장 신규 규칙을 제작규칙서에 정식 반영.
