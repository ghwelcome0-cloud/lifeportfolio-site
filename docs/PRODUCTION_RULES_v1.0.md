# 인생포트폴리오 · 맞춤 실행프로그램 · 진로/교육 매핑 제작 규칙 v1.0

**제정일**: 2026-05-06
**적용 범위**: report-engine.js, report-engine-v4.js, program-engine.js, career-engine.js (신규)
**핵심 원칙**: ① 응답 데이터 100% 우선 ② 고유성·개별성 최적화 ③ 토큰 치환 완결성

---

## RULE-REPORT v1.0 — 인생포트폴리오 리포트 제작 규칙

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
- 다음 6개 라인은 응답 풀과 직접 대응되어 변수화하지 않고 보존:
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

---

## RULE-PROGRAM v1.0 — 맞춤 실행프로그램 제작 규칙

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

---

## RULE-CAREER v1.0 — 진로·교육 매핑 규칙 (신규, 옵션 ② 채택)

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
careers[0] = primaryDomain × subType (Q3 강점 → 5종 중 1개 선택)
careers[1] = primaryDomain × secondaryDomain (영역 융합)
careers[2] = primaryDomain × Q41 열정 (열정 결합)
education[0] = subType별 전용 교육 풀
education[1] = primaryDomain × Q41 결합 교육
education[2] = secondaryDomain 보강 교육
```

### C4. 강점 → subType 결정 알고리즘
```javascript
function pickSubType(q3Strengths, q13Values) {
  var score = { practitioner:0, researcher:0, business:0, media:0, policy:0 };
  q3Strengths.forEach(function(s){
    SUBTYPE_KEYWORDS[s] && SUBTYPE_KEYWORDS[s].forEach(function(t){ score[t]++; });
  });
  q13Values.forEach(function(v){
    SUBTYPE_VALUES[v] && SUBTYPE_VALUES[v].forEach(function(t){ score[t] += 0.5; });
  });
  return Object.keys(score).reduce(function(a,b){ return score[a]>=score[b]?a:b; });
}
```

### C5. 폴백 표시 (운영 추적)
- 응답 데이터 부족으로 fallback이 활성화된 항목은 메타에 `source:"fallback"` 기록.
- 예: `{ career:"...", source:"q41_topic" | "q75_domain" | "q3_subtype" | "fallback" }`.

### C6. 고유성 검증 (1/N 목표)
- 동일 Q1·Q41·Q75 조합에서도 Q3·Q13·Q63 차이로 careers 1개 이상 다르게 출력.
- 회귀 테스트: 13영역 × 5톤 × 9 compass = 585 케이스 자동 검증, careers 풀 평균 다양성 ≥ 80%.

---

## 100점 평가 루브릭 (Quality Score v1.0)

| # | 평가 항목 | 배점 | 측정 방법 |
|---|---|---|---|
| ① | 응답 매핑 정합성 (잔존 충돌 어휘 0회) | 20 | compassKw 충돌 어휘 빈도 0회 = 20점, 1~3회 = 10점, 4회+ = 0점 |
| ② | 토큰 치환 완결성 (미치환 `{{...}}` 0개) | 10 | 정규식 매치 0개 = 10점, 1개 이상 = 0점 |
| ③ | 핵심 13슬롯 모두 응답 반영 | 15 | quarter.heading, missionHeadline, missionSubline, visionHeadline, traits, traitsHead, strengths, gaps, env, newPaths, nextSteps[0,1,2] = 13개 모두 응답 반영 시 15점 |
| ④ | 진로·교육 매핑 고유성 (3축 결합 + 13영역 분기) | 20 | RULE-CAREER C1~C6 모두 충족 = 20점, 부분 충족 = 10/5점 |
| ⑤ | 다양성 (585조합 회귀 PASS) | 10 | PASS율 ≥ 95% = 10점, ≥ 80% = 5점, < 80% = 0점 |
| ⑥ | 모바일 UI (375×667 / 414×896) | 10 | 두 viewport 모두 overflow 없음 + 카드 정렬 OK = 10점 |
| ⑦ | 시그니처 어휘 보존 (warm tone 등) | 5 | RULE-REPORT R3 6개 라인 보존 = 5점 |
| ⑧ | 출력 안정성 (PDF/MyPage 일치) | 10 | JSON ↔ MyPage 13슬롯 일치 = 10점 |
| **합계** | | **100** | |

### 등급 판정
- **90점 이상**: 머지·배포 가능 (Production Ready)
- **80~89점**: 머지 가능, 개선 권고 (Acceptable)
- **70~79점**: 1차 개선 후 재평가 (Conditional)
- **70점 미만**: 머지 불가, 재작업 필요 (Reject)

---

## 구현 순서 (5단계)

1. **1단계 — 규칙 확정**: 본 문서 채택 (✅ 2026-05-06).
2. **2단계 — 구현**:
   - `data/career-rules.json` 신규 생성 (13×5 = 65 진로 풀).
   - `assets/js/career-engine.js` 신규 (3축 결합 함수).
   - `report-engine.js`의 `pickCareerEducation` → career-engine 호출로 위임.
   - 옵션 A 확정 코멘트 6곳 삽입.
3. **3단계 — 회귀**: `scripts/regress_585_combos.js` 실행, PASS율 ≥ 95% 달성.
4. **4단계 — 검증**: 김영식 RTDB 갱신, MyPage 모바일 viewport 확인.
5. **5단계 — 평가·배포**: 100점 루브릭 채점, 90점 이상 시 머지 → 배포.

---

## RULE-CAREER v1.1 — 고유성·개별성 보강 (2026-05-06)

### C7. R1 — subType 5종 활성화 보장 (Q1 직무 가중치 1.5)
- Q1 직무 텍스트 부분 매칭으로 subType 가중치 +1.5점 추가 (Q1_JOB_HINT 사전).
- researcher 트리거 키워드: 연구·연구원·학자·교수·박사·분석·데이터·리서치.
- practitioner: 현장·엔지니어·기술자·선수·선생·교사·의사·간호.
- business: 사업·창업·대표·CEO·기획·마케팅·영업·투자.
- media: 기자·PD·작가·콘텐츠·크리에이터·디자이너·편집.
- policy: 공무원·행정·정책·공공.
- 게이트: 5종 페르소나 시뮬레이션에서 5/5 subType 모두 활성화.

### C8. R2 — 도메인 사각지대 방지 (subType별 별도 풀 호출)
- 모든 13×5=65 풀에서 careers 4개 + education 3개 보장.
- 같은 도메인이라도 subType별로 careers·education 텍스트가 완전히 분리되어 호출.
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

### C12. v1.1 추가 루브릭 (+15점)

| # | 평가 항목 | 배점 | 측정 방법 |
|---|---|---|---|
| ⑨ | subType 5종 균형 활성화 | +5 | 5/5 활성 = 5점, 4/5 = 3점, ≤3/5 = 0점 |
| ⑩ | 강점-진로 매칭률 | +5 | ≥80% = 5점, ≥60% = 3점, <60% = 0점 |
| ⑪ | 융합형 진로 노출 | +5 | careers[1] 100% 융합 = 5점 |
| ⑫ | 교육 기간 차등화 | +5 | distinct ≥2 = 5점, =1 = 0점 |
| **v1.1 총계** | | **120** | |

### v1.1 검증 결과 (2026-05-06)
- 회귀 585 케이스: PASS율 100% (이전 95.6% → 100%, +4.4%p).
- "마음" 누수: 26건 → 0건 (옵션 A — report-engine-v4.js L723/L1208/L2191/L2196 변수화).
- 5종 페르소나 시뮬레이션 7/7 통과 (운동선수·사업가·연구자·미디어·정책 + 의료/교육 researcher).
- subType 활성화: 5/5 (researcher 신규 활성).
- 강점-진로 정렬률: 100% (7/7 alignmentRatio ≥66%).
- 교육 기간 차등화: 6/7 (85.7%).

---

## 변경 이력

- **v1.0 (2026-05-06)**: 초판 제정. 옵션 A(시그니처 6곳 보존) + 옵션 ②(13영역 5종 분리) 동시 채택.
- **v1.1 (2026-05-06)**: 고유성·개별성 보강. R1~R5 추가, Q1 직무 가중치(1.5) 도입,
  researcher subType 활성화 트리거, 강점-진로 정렬 검증, 융합형 진로 의무화,
  교육 트랙 차등화. 회귀 PASS 100% + 5종 시뮬 7/7 통과.
