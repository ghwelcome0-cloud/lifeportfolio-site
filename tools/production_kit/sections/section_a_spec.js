// sections/section_a_spec.js — A. 신규 규칙 제작서
const { esc, renderTable, renderMvCard } = require('../templates/render_helpers');

module.exports = function renderSectionA(data){
  const spec = data.spec;
  const guards = data.guards;

  // ── A-1: 사명/비전 골격 표 (현행 RESPONSE-DIRECT) ──
  const tierRows = [
    ['헤드라인 (화면 노출)',
     '<strong>Mission</strong>: ' + esc(spec.headline.mission.formula) + '<br><strong>Vision</strong>: ' + esc(spec.headline.vision.formula),
     '🎯 ' + esc(spec.headline.mission.example) + '<br>🌅 ' + esc(spec.headline.vision.example)],
    ['근거 안내문구 (미노출)',
     '<strong>Subline/Footer</strong>: ' + esc(spec.basis_subline.formula),
     '<span class="mono" style="font-size:8.5pt">[PR-중복제거] 데이터 보존 · 화면 렌더 제거</span>'],
    ['다이어리 본문 (미사용)',
     '<strong>diaryMission / diaryVision</strong>: ' + esc(spec.diary.note),
     '<span class="mono" style="font-size:8.5pt">"" (빈 문자열 고정)</span>']
  ];

  // ── A-2: 정규화 가드 표 ──
  const guardRows = guards.map(function(g){
    return [g.name, '<code>' + esc(g.pattern) + '</code>', g.rule, '<span class="mono" style="font-size:8.2pt">' + esc(g.where) + '</span>'];
  });

  // ── A-3: 5-단 엔진 파이프라인 + 합성 흐름 설명 ──
  const flow = [
    'Step 1. 56문항 응답 → fingerprint 산출 (P2-1)',
    'Step 2. Q6 trait 정규화 → 4축 점수 계산 → tier 라벨(deep/active/sharp/quiet) 부여',
    'Step 3. Q13 가치 → primaryCategory(관계/자유/성장/원칙지향) 결정 → 톤 후보 생성',
    'Step 4. 톤 우선순위 해상도(P1-1) — 4축 강세 + Q63 compass + Q41 topic 가중',
    'Step 5. Q75 도메인 → primary × secondary 확장(p×s = 21×21=441 path) (P1-2)',
    'Step 6. Q63 Compass(9 카테고리) → 합성 키워드 결정',
    'Step 7. [현행] synthMissionVisionFromResponses() — 사명/비전 헤드라인을 고객 응답 100%로 직접 합성(유형 템플릿 폐기). 근거 안내문구는 데이터에만 보존(화면 미노출), 다이어리 본문은 미사용.',
    'Step 8. 진로/교육 다양성 가드(P1-3) + 추천 확장 방향(Q63·Q75·tone seed 고유 합성) + 17 QA 통과 → 최종 리포트',
    'Step 9. [프로그램] PE.build() — 분기/모듈/실행 + 다음 단계 제안(1년 사이클 완주 이후 가이드 2문장, primaryDomain·약축결·visionHeadline 합성)'
  ];

  // 5-단 엔진(생성 파이프라인) 요약 — 문서 cross-check 기준
  const engineFlow = [
    ['① report-engine.js',       'RE.build()',  '4축 점수·강점·진로/교육 기본 골격'],
    ['② report-engine-v4.js',    'V4.upgrade()','톤 해상도·도메인 확장·RESPONSE-DIRECT 사명/비전 합성'],
    ['③ career-engine.js',       'careerRules', '진로/경력/교육 큐레이션·추천 확장 방향'],
    ['④ program-engine.js',      'PE.build()',  '분기·모듈·실행·다음 단계 제안(사이클 완주 이후 가이드)'],
    ['⑤ report.html / program.html', '렌더',    '중복제거 정책(근거문구·재진술 미노출) 적용한 화면 출력']
  ];

  return [
    '<section class="page section">',
    '  <div class="section-eyebrow">SECTION A · SPECIFICATION</div>',
    '  <h1 class="section-title">신규 규칙 제작서</h1>',
    '  <p class="section-lede">사명/비전 합성 골격(RESPONSE-DIRECT), 5-단 엔진 파이프라인, 슬롯 매핑, 정규화 가드 — v4.1 production rule의 단일 진실 공급원(SSoT).</p>',
    '  <div class="section-divider"></div>',

    '  <h2 class="h-block">A-1. 사명/비전 골격 (현행 · RESPONSE-DIRECT)</h2>',
    '  <p>과거 7-slot/3-Tier 템플릿 골격은 <strong>폐기</strong>되었습니다. 현재는 <code>synthMissionVisionFromResponses()</code>가 고객 응답(Q13 가치·Q63 판단기준·Q75 분야·Q39/Q41 활동·Q73 성취)을 <strong>100% 직접 합성</strong>해 헤드라인 한 문장을 만듭니다(유형 템플릿 제거). 근거 안내문구는 데이터에만 보존(화면 미노출), 다이어리 본문은 빈 문자열로 미사용입니다.</p>',
         renderTable(['계층','수식 (formula)','상태/예시'], tierRows),

    '  <h2 class="h-block">A-2. 정규화 가드 (한국어 자연성)</h2>',
    '  <p>한국어 합성에서 자주 발생하는 어색함을 빌더 단계에서 자동 차단합니다. 모든 가드는 정규식 + 받침 검사(<code>_hangulJong</code>)로 결정적으로 동작합니다.</p>',
         renderTable(['가드','패턴','규칙','적용 위치'], guardRows),

    '  <h2 class="h-block">A-3. 5-단 엔진 + 합성 파이프라인 (9 Step)</h2>',
    '  <p>리포트·프로그램은 아래 5개 엔진을 순차로 거쳐 생성됩니다. 본 매뉴얼의 모든 기술은 이 5-단 엔진의 현행 동작과 cross-check되었습니다.</p>',
         renderTable(['엔진','진입 함수','역할'], engineFlow),
    '  <ol>' + flow.map(function(s){ return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>',

    '  <h2 class="h-block">A-4. 슬롯 → 출력 매핑 (요약, 현행)</h2>',
    '  <p>아래는 현행 합성에 직접 투입되는 핵심 슬롯의 흐름입니다. 전체 32항 매핑은 <strong>E. 매핑표</strong>에서 다룹니다.</p>',
         renderTable(
           ['출력 슬롯','진단 입력','라이브러리/함수','결정성'],
           [
             ['사명 헤드라인', 'Q13 가치 × Q63 판단기준 × Q75 분야 × Q39/Q41 활동 × Q73 성취', 'synthMissionVisionFromResponses()', '응답 100% 합성(유형 템플릿 제거)'],
             ['비전 헤드라인', '동일 응답 → 회상 정체성 구절', 'synthMissionVisionFromResponses()', '동일'],
             ['근거 안내문구(미노출)', 'Q39/Q41 actLabel',  'basisKo — 데이터에만 보존', '[PR-중복제거] 화면 렌더 제거'],
             ['추천 확장 방향', 'Q63 판단기준 + Q75 분야 + tone seed', 'DOMAIN_PAIR_TEMPLATES_KO + DIRECTION_BY_TONE_KO', 'CRIT_PATH_IDX + fingerprint·Q63·Q55 seed'],
             ['다음 단계 제안', 'primaryDomain(Q75) + 약축결 + visionHeadline', 'nextSteps 빌드(program-engine.js)', '1년 사이클 완주 이후 가이드 2문장 합성'],
             ['진로/교육 큐레이션', 'Q75 분야 + 4축 강세', 'career-engine + 다양성 가드(P1-3)', '중복 차단 + fingerprint']
           ]
         ),

    '  <div class="callout"><div class="callout-title">결정성 보장</div>모든 임의 선택은 <code>fingerprint(56문항)</code>를 시드로 한 <code>pickByHash()</code>로 결정됩니다. 동일 응답 → 동일 결과를 80억분의 1 정밀도로 재현합니다.</div>',

    '</section>'
  ].join('\n');
};
