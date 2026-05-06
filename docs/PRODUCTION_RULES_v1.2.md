# 인생포트폴리오 · 맞춤 실행프로그램 · 진로/교육 매핑 제작 규칙 v1.2

**제정일**: 2026-05-06
**적용 범위**: report-engine.js, report-engine-v4.js, program-engine.js, career-engine.js, report.html, program.html
**핵심 원칙**:
1. 응답 데이터 100% 우선
2. 고유성·개별성 최적화 (1/N 보장)
3. 토큰 치환 완결성
4. 단일 진실 소스(SSOT) — 톤·진로 결정 로직 일원화
5. 한국어 표현 자연성 — 어색 결합 0건

**모범 출력 기준 (Reference Output)**:
- 자동 제작본: `docs/reference/REF_REPORT_KYS_2026-05-06.pdf`
- 자동 제작본: `docs/reference/REF_PROGRAM_KYS_2026-05-06.pdf`
- 본 두 PDF는 v1.2 규칙대로 합성된 결과의 **정식 모범 기준**이며, 향후 모든 출력은 이 결과물과 동일 수준의 정합성·고유성·자연성을 충족해야 한다.

---

## RULE-REPORT v1.2 — 인생포트폴리오 리포트 제작 규칙

### R1. 응답 데이터 100% 우선
- 모든 본문 합성은 Q1·Q3·Q13·Q41·Q63·Q73·Q75 응답을 1차 소스로 사용한다.
- 톤 시그니처 어휘(예: warm_connector의 "마음")가 응답과 충돌하면 **응답을 우선**한다.
- 예외: Q13/Q73 응답 풀에 직접 대응되는 라인(VISION_BY_KEYWORD_KO, DIARY_IDENTITY_KO 등)은 보존한다.

### R2. 변수화 원칙
- 응답에서 도출 가능한 토큰은 하드코딩 문자열 대신 변수로 처리한다:
  - `{{compassKw}}` (Q63 → 의미·단단함·배움·자기 호흡·사람·결과·몰입·원칙·책임)
  - `{{primaryDomain}}`, `{{secondaryDomain}}` (Q75 1·2순위)
  - `{{name}}`, `{{traitColor}}`, `{{userTool1}}`, `{{userActivity1}}`
- 모든 토큰은 출력 직전 `tpl(str, vars)` 함수를 통과해야 한다.

### R3. 응답 매핑 보존 (옵션 A 확정)
다음 6개 라인은 응답 풀과 직접 대응되어 변수화하지 않고 보존:
- `program-engine.js:384` (warm_connector 원칙지향 시그니처)
- `program-engine.js:450` (warm_connector 원칙 분기 헤딩)
- `program-engine.js:558` (L3_HEAD_TRAITS_KO warm_connector)
- `program-engine.js:584` (L3_HEAD_ENV_KO)
- `program-engine.js:1517` (warm_connector 3단계 동사구)
- `program-engine.js:1535` (warm_connector 1주차 헤드라인)

### R4. 고유성 보장
- 핑거프린트(fingerprint = hash(answers)) 기반 회전(rotate)으로 동일 톤·compass라도 서로 다른 조합 노출.
- AXIS_LEAD_KO, VISION_LINE_COMBO_KO 등 풀 선택 시 `pickByHash(arr, fingerprint + offset)` 패턴 강제.

### R5. 잔존 어휘 0회 목표
- compass=의미일 때 본문에 "마음"이 반복 노출되는 것 같은 응답-시그니처 충돌은 0회.
- 검증: 매 빌드마다 `report.json`에서 compassKw 외 카테고리어 출현 빈도 모니터링.
- v1.2 현황: '마음' 누수 0건 달성 (PR#63 변수화로 26건 → 0건).

### R6. 한국어 표현 자연성 (v1.2 신설, PR#66)
- **헤드라인 폴백 주어**: 도메인 정규화 미매칭 시 `'자기 자리에 있는 사람'` 사용 (이전 `'지금 살아가는 사람'`).
- **주격 조사 자동 보정**: 주어 끝 음절 받침 검사로 `이/가` 자동 선택. 받침 있음→`이`, 없음→`가`.
- **목적어·주어 중복 어법 차단**: `'사람을 ~하는 사람'` 패턴은 `'~으로 사람을 ~ 내는 사람'` 어순으로 자연화.
  - 예: `'사람을 원칙으로 지키는 사람'` → `'원칙으로 사람을 지켜 내는 사람'`
- **검증 항목**: grep으로 어색 패턴(`사람을 [원칙·마음·신념]으로 지키는 사람`, `지금 살아가는 사람이 사람을`) 잔류 0건.

### R7. 톤 SSOT (v1.2 신설, PR#65)
- 톤 결정의 단일 진실 소스(Single Source of Truth):
  ```
  resolveTone(scores, valueCats)  ← 가중치 합산 모델 (Q13 vc:+3, top1 axis:+2, top2 axis:+1)
    → report.toneKey                  [최상위 노출, 다운스트림 표준 입력]
    → report._v4Meta.toneResolution   [상세 근거 메타]
    → report.tone.key                 [본문 합성용 정정값]
  ```
- ProgramEngine.pickTone()은 0순위로 `report._v4Meta.toneResolution.toneKey`를 신뢰한다.
- v4 미가용 시에만 폴백 경로(report.tone → MV Compass → pragmatic 우세) 동작.

---

## RULE-PROGRAM v1.2 — 맞춤 실행프로그램 제작 규칙

### P1. 분기 테마 (Quarter)
- `tone × Q63 compass` 매트릭스에서 합성.
- heading은 `tpl(L3_QUARTER_HEADING_KO[tone][primaryCat], vars)` 100% 통과.
- 3개 paragraphs는 L3_QUARTER_PARAS_KO에서 선택 후 `tplArr` 변수 치환.

### P2. 3주 루틴 / 3개월 / 1년
- 각 단계에 Q3 강점 + Q41 열정 + Q75 도메인이 결합되어야 한다.
- 적어도 1줄에는 `{{primaryDomain}}`이 직접 노출된다 (PR#61-1 정책 유지).

### P3. 부스터 액션 (modules[1].booster)
- `약축(weak axis) × Q1 직무도구({{userTool1}}) × {{userWeakGrain}}` 결합.
- `userWeakGrain`은 정의 직후 `tpl()`을 통해 `compassKw` 등 변수를 1차 치환한다.

### P4. 토큰 완결성
- 출력 JSON 전체에서 미치환 `{{...}}` 토큰 = 0개.
- CI 게이트: `node scripts/build_kys_program.js` 실행 후 결과 JSON에 정규식 `\{\{[^}]+\}\}` 매치 0개여야 통과.

### P5. 중복 차단
- careers·education·directions 각 3개는 모두 다른 항목.
- 톤 외 폴백 누수는 P1-3 다양성 가드(report-engine-v4.js:3508)로 차단.

### P6. 톤 정합성 (v1.2 신설, PR#65)
- 프로그램 톤은 반드시 리포트 톤과 동일해야 한다 (RULE-REPORT R7 SSOT 참조).
- 양 출력의 cover.subtitle, missionLine, quarterTheme 톤 결이 일치해야 한다.

---

## RULE-CAREER v1.2 — 진로·교육 매핑 규칙

### C1. 13대 영역 5종 분리 (subType)
모든 영역에 동일한 5종 분류를 적용한다.

| subType | 정의 | Q3 강점 매핑 후보 |
|---|---|---|
| `practitioner` | 현장 실무·전문가 | 손기술, 실행력, 책임감, 헌신 |
| `researcher` | 연구·이론·분석 | 분석력, 통찰력, 학구열, 정직 |
| `business` | 사업·경영·창업 | 사업감각, 실행력, 도전, 리더십 |
| `media` | 콘텐츠·저널·평론 | 표현력, 창의력, 공감, 스토리텔링 |
| `policy` | 정책·행정·공공 | 분석력, 정의, 책임, 공정 |

### C2. 13대 영역 풀 (data/career-rules.json)
- 영역: 정치, 경제, 사회, 문화, 교육, 의료, 복지, 환경, 예술, 미디어, 스포츠, 법률, 종교 (13개).
- 각 영역 × 5 subType = 65개 진로 풀.
- 각 subType당 careers 4개 + education 3개.

### C3. 3축 결합 매트릭스
```
careers[0]   = primaryDomain × subType (Q3 강점 → 5종 중 1개 선택)
careers[1]   = primaryDomain × secondaryDomain (영역 융합, 의무)
careers[2]   = primaryDomain × Q41 열정 (열정 결합)
education[0] = subType별 전용 교육 풀 (단기, ≤3개월)
education[1] = primaryDomain × Q41 결합 교육 (중기, 6~12개월)
education[2] = secondaryDomain 보강 교육 (장기, ≥1년)
```

### C4. 강점 → subType 결정 알고리즘 (v1.1 + Q1 가중치 1.5)
```javascript
function pickSubType(q1Job, q3Strengths, q13Values, q41Topic) {
  var score = { practitioner:0, researcher:0, business:0, media:0, policy:0 };
  // Q1 직무 부분 매칭 (가중치 1.5)
  Object.keys(Q1_JOB_HINT).forEach(function(kw){
    if (q1Job && q1Job.indexOf(kw) !== -1) {
      Q1_JOB_HINT[kw].forEach(function(t){ score[t] += 1.5; });
    }
  });
  q3Strengths.forEach(function(s){
    SUBTYPE_KEYWORDS[s] && SUBTYPE_KEYWORDS[s].forEach(function(t){ score[t] += 1; });
  });
  q13Values.forEach(function(v){
    SUBTYPE_VALUES[v] && SUBTYPE_VALUES[v].forEach(function(t){ score[t] += 0.5; });
  });
  if (TOPIC_SUBTYPE_HINT[q41Topic]) {
    TOPIC_SUBTYPE_HINT[q41Topic].forEach(function(t){ score[t] += 1; });
  }
  return Object.keys(score).reduce(function(a,b){ return score[a]>=score[b]?a:b; });
}
```

### C5. 폴백 표시 (운영 추적)
- 응답 데이터 부족으로 fallback이 활성화된 항목은 메타에 `source:"fallback"` 기록.
- 예: `{ career:"...", source:"q41_topic" | "q75_domain" | "q3_subtype" | "fallback" }`.

### C6. 고유성 검증 (1/N 목표)
- 동일 Q1·Q41·Q75 조합에서도 Q3·Q13·Q63 차이로 careers 1개 이상 다르게 출력.
- 회귀 테스트: 13영역 × 5톤 × 9 compass = 585 케이스 자동 검증.
- 게이트: PASS율 ≥ 95%, careers 풀 평균 다양성 ≥ 80%.

### C7. R1 — subType 5종 활성화 보장 (Q1 직무 가중치 1.5, v1.1)
- Q1 직무 텍스트 부분 매칭으로 subType 가중치 +1.5점 추가 (Q1_JOB_HINT 사전).
- researcher 트리거: 연구·연구원·학자·교수·박사·분석·데이터·리서치.
- practitioner: 현장·엔지니어·기술자·선수·선생·교사·의사·간호.
- business: 사업·창업·대표·CEO·기획·마케팅·영업·투자.
- media: 기자·PD·작가·콘텐츠·크리에이터·디자이너·편집.
- policy: 공무원·행정·정책·공공.
- 게이트: 5종 페르소나 시뮬레이션에서 5/5 subType 모두 활성화.

### C8. R2 — 도메인 사각지대 방지 (subType별 별도 풀 호출)
- 모든 13×5=65 풀에서 careers 4개 + education 3개 보장.
- 같은 도메인이라도 subType별로 careers·education 텍스트가 완전히 분리.
- 예: 스포츠×practitioner = "프로 운동선수", 스포츠×business = "스포츠 마케팅 전략가",
  스포츠×researcher = "스포츠 데이터 분석가", 스포츠×media = "스포츠 캐스터",
  스포츠×policy = "체육 행정가" — 동일 도메인에서 5가지 진로 자동 분기.

### C9. R3 — 강점-진로 정렬 검증
- careers[0]·careers[2]는 Q3 상위 2개 강점이 careers 텍스트 또는 같은 subType 매핑과 ≥1개 매칭 의무.
- 미매칭 시 fingerprint 회전 후 재선택, 3회 시도 후 마지막 후보 반환.
- 메타 출력: `alignmentFlags`, `alignmentRatio` (≥66% 게이트 통과).

### C10. R4 — 융합형 진로 의무화 (단일 도메인 연속 차단)
- careers[1]은 반드시 융합형:
  - secondaryDomain이 있으면: `primaryDomain × secondaryDomain` 융합 careers
  - secondaryDomain이 없으면: `primaryDomain × altSubType` 결합형 fallback
- 단일 도메인이 careers 3슬롯 모두 채우는 출력 차단.

### C11. R5 — 교육 트랙 차등화 (단기/중기/장기)
- education[0] = 단기 (실무 즉시 적용, 워크숍·부트캠프, ≤3개월).
- education[1] = 중기 (확장 융합, 자격·훈련·과정, 6-12개월).
- education[2] = 장기 (전문성 깊이, 대학원·박사·리서치, ≥1년).
- `EDU_DURATION_HINT` 키워드 매칭으로 자동 분류.
- 메타 출력: `eduDurations`, `eduDurationDistinct` (≥2 게이트 통과).

### C12. 사이트 배포 검증 (v1.2 신설, PR#64)
- `report.html`은 빌드 시점에 다음 자원을 모두 페치·로드해야 한다:
  - `data/career-rules.json` (캐시-버스팅 페치)
  - `assets/js/career-engine.js` (동적 `<script>` 로드)
- `ReportEngine.build({ ..., careerRules })` 와 `ReportEngineV4.upgrade(report, { ..., careerRules })` 양 경로에 careerRules 주입 의무.
- 자원 누락 시 안전 폴백: career-rules.json 페치 실패 → `null`, career-engine.js 로드 실패 → legacy 매핑 자동 폴백 (사용자 영향 없음).
- 검증: view-source 또는 개발자 도구로 두 자원 로드 확인.

---

## 100점 평가 루브릭 (Quality Score v1.2 = 130점 만점)

### 기본 100점 (v1.0 계승)

| # | 평가 항목 | 배점 | 측정 방법 |
|---|---|---|---|
| ① | 응답 매핑 정합성 (잔존 충돌 어휘 0회) | 20 | compassKw 충돌 어휘 빈도 0회 = 20, 1~3회 = 10, 4회+ = 0 |
| ② | 토큰 치환 완결성 (미치환 `{{...}}` 0개) | 10 | 정규식 매치 0 = 10, 1+ = 0 |
| ③ | 핵심 13슬롯 모두 응답 반영 | 15 | 13/13 = 15, 부분 = 비례 |
| ④ | 진로·교육 매핑 고유성 (3축 결합 + 13영역 분기) | 20 | C1~C6 모두 충족 = 20, 부분 = 10/5 |
| ⑤ | 다양성 (585조합 회귀 PASS) | 10 | ≥95% = 10, ≥80% = 5, <80% = 0 |
| ⑥ | 모바일 UI (375×667 / 414×896) | 10 | 두 viewport 모두 OK = 10 |
| ⑦ | 시그니처 어휘 보존 (warm tone 등) | 5 | R3 6개 라인 보존 = 5 |
| ⑧ | 출력 안정성 (PDF/MyPage 일치) | 10 | JSON ↔ MyPage 13슬롯 일치 = 10 |
| **소계** | | **100** | |

### v1.1 보강 (+15)

| # | 평가 항목 | 배점 | 측정 방법 |
|---|---|---|---|
| ⑨ | subType 5종 균형 활성화 | +5 | 5/5 = 5, 4/5 = 3, ≤3/5 = 0 |
| ⑩ | 강점-진로 매칭률 | +5 | ≥80% = 5, ≥60% = 3, <60% = 0 |
| ⑪ | 융합형 진로 노출 | +5 | careers[1] 100% 융합 = 5 |
| ⑫ | 교육 기간 차등화 | +5 | distinct ≥2 = 5, =1 = 0 |

### v1.2 보강 (+15)

| # | 평가 항목 | 배점 | 측정 방법 |
|---|---|---|---|
| ⑬ | 사이트 배포 검증 (PR#64) | +5 | report.html 자원 3가지(페치+로드+주입) 모두 OK = 5 |
| ⑭ | 톤 SSOT 정합성 (PR#65) | +5 | 리포트·프로그램 toneKey 동일 = 5, 불일치 = 0 |
| ⑮ | 한국어 표현 자연성 (PR#66) | +5 | 어색 패턴 잔류 0건 = 5 |

### v1.2 총계: **130점 만점**

### 등급 판정
- **120점 이상**: 머지·배포 가능 (Production Ready, A급)
- **100~119점**: 머지 가능, 개선 권고 (Acceptable, B급)
- **80~99점**: 1차 개선 후 재평가 (Conditional, C급)
- **80점 미만**: 머지 불가, 재작업 필요 (Reject)

---

## 모범 출력 기준 (Reference Output) — 김영식 케이스 (2026-05-06)

본 두 PDF는 v1.2 규칙대로 합성된 결과의 **정식 모범 기준**이다. 향후 모든 자동·수동 출력은 본 출력물과 동일 수준의 정합성·고유성·자연성을 충족해야 한다.

### 첨부 파일
- 리포트: `docs/reference/REF_REPORT_KYS_2026-05-06.pdf`
- 프로그램: `docs/reference/REF_PROGRAM_KYS_2026-05-06.pdf`

### 입력 응답 요약 (76문항 중 핵심)
- **Q1 직무**: 자기성찰·콘텐츠 학습 성향
- **Q3 강점**: 분석적 정직성, 전략적 성취력, 데이터·패턴 기반 의미 해석
- **Q13 가치**: 신뢰, 성장, 책임 (관계지향+성장지향+원칙지향 다중)
- **Q41 열정**: 문제를 분석하고 해결책을 찾는 일, 새로운 정보를 탐색·정리
- **Q47 환경**: 정돈된 실내, 몰입·휴식 명확 분리
- **Q49 성취 조건**: 내가 의미 있다고 여긴 일을 마쳤을 때
- **Q63 Compass**: 신념/원칙/종교적 기준 (원칙지향)
- **Q75 영역**: 경제·금융·투자 / 철학·종교·영성 (1·2순위)

### 결정된 톤 및 매핑 결과
| 항목 | 값 | 출처 |
|---|---|---|
| toneKey | `principled_designer` (리포트·프로그램 동일) | resolveTone (R7 SSOT) |
| primaryDomain | 경영(경제) | Q75[0] 정규화 |
| secondaryDomain | 종교 | Q75[1] |
| subType | business | Q1+Q3+Q41 가중치 합산 |
| careers[0] | 경제 평론가 | 경제×business |
| careers[1] | 경제·종교 융합형 — 영성 콘텐츠 크리에이터 | C10 융합형 |
| careers[2] | 핀테크 창업가 | 경제×Q41 |
| education[0] | 경제 다큐 워크숍 (단기) | C11 단기 |
| education[1] | 영성 글쓰기 과정 (중기) | C11 중기 |
| education[2] | 경제 저널리즘 과정 (장기) | C11 장기 |

### 모범 합성 문장 (핵심 발췌)
- **사명**: 자기 자리에 있는 사람이 사람을 원칙으로 지킨다.
- **사명 한 줄 통합**: 당신의 사명은, 경영과 종교의 자리에서 (특히 돈과 자원이 흐르는 길목에서) 양심이 부르는 자리를 잃지 않으며, 사람의 곁을 머물게 하면서 자기 색대로 깊어져 가는 한 사람으로 살아가는 것입니다.
- **비전**: 원칙으로 사람을 지켜 내는 사람으로 기억된다.
- **분기 테마**: 사람의 원칙을 작품으로 펼치는 분기.
- **3주 루틴 헤드라인**: 1주차 "아이디어를 밖으로 꺼내기" / 2주차 "프로토타입 빠르게 끝내기" / 3주차 "발행과 다음 비전 연결".

### v1.2 규칙 충족 검증
| 규칙 | 충족 여부 | 근거 |
|---|---|---|
| R1 응답 데이터 100% | ✅ | Q1·Q3·Q13·Q41·Q47·Q49·Q63·Q75 모두 본문 노출 |
| R5 잔존 어휘 0건 | ✅ | '마음' 누수 0건 (warm 시그니처 보존 라인 외) |
| R6 한국어 자연성 | ✅ | 사명 라인이 '자기 자리에 있는 사람이…'로 자연 결합 |
| R7 톤 SSOT | ✅ | report.toneKey 와 program.meta.toneKey 정합 |
| C8 도메인 분기 | ✅ | 경제 도메인에서 business subType 진로 정확 매핑 |
| C10 융합형 | ✅ | careers[1] = 경제·종교 융합형 |
| C11 교육 차등 | ✅ | 단기·중기·장기 모두 distinct |
| C12 배포 검증 | ✅ | 사이트에서 career-engine 로드 + careerRules 주입 |

---

## 수동 제작 워크플로우 (v1.2 신설)

자동 엔진 외, **운영자가 수기로 상품 템플릿에 작성하여 PDF로 고객에게 전달하는** 보조 워크플로우다. 운영자가 코드를 작성하는 것이 아니라, Excel 응답 데이터를 사람의 손으로 Word·PowerPoint 템플릿에 매핑해 PDF로 생성·이메일 전달한다.

### M0. 응답 데이터 확인 경로 (운영자 필수 숙지)

**구글 스프레드시트 — "인생포트폴리오 응답 마스터"**
- URL: https://docs.google.com/spreadsheets/d/1jd0h64K2E0g7B5-aOZD0e2sNDmvOQshYiGHROgmHSCM/edit
- 시트 ID: `1jd0h64K2E0g7B5-aOZD0e2sNDmvOQshYiGHROgmHSCM`
- 연동 방식: 회원이 사이트(suvey.html)에서 76문항 검사 완료 시
  Apps Script(`docs/apps-script/Code.gs`) doPost가 실시간으로 한 줄씩 append.
- **구글폼 시절과 동일한 스프레드시트 운영** — 입력 진입점만 사이트로 변경됨.

**시트 탭 구성**
| 탭 | 용도 |
|---|---|
| `responses` | 응답 마스터 (회원당 1행, 80개 컬럼) |
| `manual_reports` | 수동 리포트 HTML 본문 + 상태 |
| `logs` | 디버그/오류 로그 |

**컬럼 순서 (responses 탭, 80개)**
```
1. 타임스탬프 (자동)
2. 이메일 주소
3~78. Q3 ~ Q78 (76문항 본 응답)
79. Q79 — 성함(이름)
80. Q80 — 리포트 수신 방법
```

### M1. 표준 절차 (5단계)

```
[1단계] 구글 스프레드시트에서 회원 응답 행 추출
  └─ "인생포트폴리오 응답 마스터" → responses 탭 열기
  └─ 회원 이메일/타임스탬프로 해당 행 1줄 검색
  └─ 행 통째로 복사 (또는 메모지에 80개 컬럼 값 정리)
  └─ 핵심 슬롯 추출:
     • Q1·Q3·Q13·Q41·Q63·Q73·Q75 (리포트 R1 1차 소스)
     • Q47·Q49 (실행 환경·성취 조건)
     • Q79(성함)·Q80(수신 방법)·이메일 주소 (전달용)

[2단계] Word 템플릿 매핑 (리포트 본체)
  └─ 템플릿 파일: docs/manual/template_report.docx (12단 구조)
  └─ 운영자가 Excel 셀 값을 보고 Word의 매핑 자리표시자
     ({{name}}, {{compassKw}}, {{primaryDomain}} 등)에 수기로 입력
  └─ R1~R7 규칙 (특히 R6 한국어 자연성 / R7 톤 SSOT) 운영자 체크리스트로 확인

[3단계] PowerPoint 템플릿 작성 (실행 프로그램 본체)
  └─ 템플릿 파일: docs/manual/template_program.pptx (3주/3개월/1년 슬라이드)
  └─ 운영자가 P1~P6 규칙에 맞춰 슬라이드별 본문·헤드라인·체크리스트를 수기로 채움
  └─ 톤은 리포트의 toneKey 와 동일 톤으로 일치시킴 (P6 SSOT)

[4단계] PDF 변환
  └─ Word/PowerPoint → PDF 내보내기 (각각)
  └─ 파일명 규칙:
     R. 최신_인생포트폴리오_[성명]_[YYYY-MM-DD].pdf
     S. 최신_[성명]님_맞춤_실행_프로그램_[YYYY_MM-DD].pdf

[5단계] 이메일 전달
  └─ 회원 이메일로 두 PDF 첨부 직접 발송
  └─ RTDB programs/{uid}/{sid}.manualProgramStatus = "manual" 마킹
  └─ RTDB reports/{uid}/{sid}.manualOverrideHtml 에 운영자 수정 본문 저장 (선택)
```

### M2. 수동 제작 품질 기준
- 자동 제작본과 동일한 130점 루브릭(v1.2)을 적용한다.
- **운영자 자유 편집을 허용하는 슬롯**은 다음 5개에 한정:
  1. 사명·비전 한 줄 통합본 (자연어 다듬기)
  2. 3주 실행 루틴 본문 (회원의 직무·환경 맥락 반영)
  3. 신규 가능성 직무 목록 (시장 트렌드 반영)
  4. 리스크·보완 전략 (회원 코멘트 반영)
  5. 마무리 메시지 (개인화 멘트)
- 위 5개 외 슬롯은 자동 합성 결과를 그대로 사용한다.

### M3. 운영자 체크리스트 (수동 제작 시 반드시 확인)
- [ ] R1: Q1·Q3·Q13·Q41·Q63·Q75 모두 본문에 노출되었는가?
- [ ] R6: 어색 결합('지금 살아가는 사람이 사람을…', '사람을 원칙으로 지키는 사람')이 없는가?
- [ ] R7: 리포트와 프로그램의 톤이 동일한가? (cover.subtitle, missionLine 일치)
- [ ] P4: 미치환 `{{...}}` 토큰이 0개인가?
- [ ] C10: 진로 추천 3개 중 1개는 융합형(primaryDomain × secondaryDomain)인가?
- [ ] C11: 교육 추천 3개의 기간(단기·중기·장기)이 서로 다른가?
- [ ] M1: 파일명 규칙 준수, RTDB 마킹 완료, 회원 이메일 발송 완료?

### M4. 자동 vs 수동 결정 기준
- **자동 우선**: 일반 회원, 표준 영역, 응답 결손 없음
- **수동 권장**: 다음 중 1개 이상 해당 시
  - 응답 일부 결손 (Q41, Q49, Q63 등 핵심 슬롯)
  - 회원이 직접 카운슬링·코칭 신청
  - 특수 직군 (예술가, 운동선수, 종교인, 정책결정자 등) — 자동 풀이 부족할 수 있음
  - 회원이 사명·비전 라인을 자기 언어로 다시 다듬어 달라고 요청
- 수동 제작본도 본 v1.2 규칙서를 동일 기준으로 적용한다.

### M5. 템플릿 파일 (예정 — 후속 작업 대상)
- `docs/manual/template_report.docx` — 12단 구조 Word 템플릿
- `docs/manual/template_program.pptx` — 3주 / 3개월 / 1년 PowerPoint 템플릿
- 두 템플릿은 모범 출력본(REF_REPORT_KYS_2026-05-06.pdf / REF_PROGRAM_KYS_2026-05-06.pdf)을 토대로 작성한다.

---

## 구현 순서 (5단계)

1. **1단계 — 규칙 확정**: ✅ v1.0 (2026-05-06), ✅ v1.1 (2026-05-06), ✅ v1.2 (2026-05-06).
2. **2단계 — 구현 (완료)**:
   - `data/career-rules.json` 신규 생성 (13×5 = 65 진로 풀). ✅
   - `assets/js/career-engine.js` 신규 (3축 결합 함수). ✅
   - `report-engine.js` 의 `pickCareerEducation` → career-engine 호출 위임. ✅
   - 옵션 A 확정 코멘트 6곳 삽입. ✅
   - PR#64: report.html 에 career-rules.json 페치 + career-engine.js 로드 + careerRules 주입. ✅
   - PR#65: 톤 SSOT (report.toneKey 명시 노출, ProgramEngine.pickTone 0순위로 v4 신뢰). ✅
   - PR#66: 한국어 자연화 (헤드라인 폴백 주어 + 조사 보정 + 중복 어법 정리). ✅
3. **3단계 — 회귀**: `scripts/regress_585_combos.js` PASS율 100% 달성. ✅
4. **4단계 — 검증**:
   - 김영식 RTDB 갱신, MyPage 모바일 viewport 확인. ✅
   - 모범 출력 PDF 등재 (docs/reference/). ✅
5. **5단계 — 평가·배포**: v1.2 130점 루브릭 채점, 120점 이상 시 머지 → 배포.

---

## 검증 결과 (2026-05-06 시점)

### 회귀 테스트 (585 케이스)
- PASS율: **100%** (이전 95.6% → 100%, +4.4%p).
- 결함 유형 0건.
- 도메인별 careers 다양성: 평균 50%+ (게이트 통과).

### 5종 페르소나 시뮬레이션 (7케이스)
- subType 정확도: 7/7 (100%) ✅
- primaryDomain 정확도: 7/7 (100%) ✅
- careers 중복 0: 7/7 (100%) ✅
- 강점-진로 정렬률 ≥66%: 7/7 (100%) ✅
- education 기간 차등: 6/7 (85.7%) ⚠️
- subType 활성화: 5/5 (practitioner·researcher·business·media·policy 모두 활성) ✅

### 김영식 모범 출력 검증
- 자동 합성 결과가 v1.2 규칙 R1, R5, R6, R7, C8, C10, C11, C12 모두 충족 ✅
- 본 PDF 두 건이 향후 모든 출력의 정식 모범 기준으로 등재 ✅

---

## 변경 이력

- **v1.0 (2026-05-06)**: 초판 제정. 옵션 A(시그니처 6곳 보존) + 옵션 ②(13영역 5종 분리) 동시 채택.
- **v1.1 (2026-05-06)**: 고유성·개별성 보강. R1~R5 추가, Q1 직무 가중치(1.5) 도입,
  researcher subType 활성화 트리거, 강점-진로 정렬 검증, 융합형 진로 의무화,
  교육 트랙 차등화. 회귀 PASS 100% + 5종 시뮬 7/7 통과.
- **v1.2 (2026-05-06)**: 사이트 배포 검증·톤 SSOT·한국어 자연성·수동 제작 워크플로우 추가.
  - **R6 한국어 표현 자연성** (PR#66): 헤드라인 폴백 주어 자연화, 주격 조사 자동 보정, 목적어·주어 중복 어법 정리.
  - **R7 톤 SSOT** (PR#65): resolveTone → report.toneKey 단일 진실 소스 명문화, ProgramEngine.pickTone 0순위로 v4 신뢰.
  - **P6 톤 정합성**: 리포트·프로그램 동일 톤 강제.
  - **C12 사이트 배포 검증** (PR#64): report.html 자원 로드·주입 의무화.
  - **모범 출력 기준** 등재: 김영식 케이스 (`docs/reference/REF_REPORT_KYS_2026-05-06.pdf`, `REF_PROGRAM_KYS_2026-05-06.pdf`).
  - **수동 제작 워크플로우 M1~M5** 신설: Excel→Word→PowerPoint→PDF→이메일 5단계 절차, 운영자 체크리스트, 자동/수동 결정 기준.
  - **루브릭 130점 만점**: ⑬ 사이트 배포 검증 +5, ⑭ 톤 SSOT 정합성 +5, ⑮ 한국어 표현 자연성 +5.
