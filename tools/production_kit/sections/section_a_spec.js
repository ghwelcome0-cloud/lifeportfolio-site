// sections/section_a_spec.js — A. 신규 규칙 제작서
const { esc, renderTable, renderMvCard } = require('../templates/render_helpers');

module.exports = function renderSectionA(data){
  const spec = data.spec;
  const guards = data.guards;

  // ── A-1: 3-Tier 골격 표 ──
  const tierRows = [
    ['Tier ① 헤드라인',
     '<strong>Mission</strong>: ' + esc(spec.tier1_headline.mission.formula) + '<br><strong>Vision</strong>: ' + esc(spec.tier1_headline.vision.formula),
     '🎯 ' + esc(spec.tier1_headline.mission.example) + '<br>🌅 ' + esc(spec.tier1_headline.vision.example)],
    ['Tier ② 한 줄 설명',
     '<strong>Mission</strong>: ' + esc(spec.tier2_subline.mission.formula) + '<br><strong>Vision</strong>: ' + esc(spec.tier2_subline.vision.formula),
     esc(spec.tier2_subline.mission.example) + '<br>' + esc(spec.tier2_subline.vision.example)],
    ['Tier ③ 다이어리 본문',
     '<strong>Mission</strong>(1인칭 현재형): ' + esc(spec.tier3_diary.mission.formula) + '<br><strong>Vision</strong>(10년 회상형): ' + esc(spec.tier3_diary.vision.formula),
     '<span class="mono" style="font-size:8.5pt">' + esc(spec.tier3_diary.mission.example.slice(0,80)) + '…</span>']
  ];

  // ── A-2: 정규화 가드 표 ──
  const guardRows = guards.map(function(g){
    return [g.name, '<code>' + esc(g.pattern) + '</code>', g.rule, '<span class="mono" style="font-size:8.2pt">' + esc(g.where) + '</span>'];
  });

  // ── A-3: 톤 우선순위/도메인 확장 설명 ──
  const flow = [
    'Step 1. 56문항 응답 → fingerprint 산출 (P2-1)',
    'Step 2. Q6 trait 정규화 → 4축 점수 계산 → tier 라벨(deep/active/sharp/quiet) 부여',
    'Step 3. Q13 가치 → primaryCategory(관계/자유/성장/원칙지향) 결정 → 톤 후보 생성',
    'Step 4. 톤 우선순위 해상도(P1-1) — 4축 강세 + Q63 compass + Q41 topic 가중',
    'Step 5. Q75 도메인 → primary × secondary 확장(p×s = 21×21=441 path) (P1-2)',
    'Step 6. Q63 Compass(9 카테고리) → mission_clause + vision_identity 결정',
    'Step 7. 슬롯 결합 → 3-Tier 사명/비전 합성 → 가드 통과 검증',
    'Step 8. 진로/교육 다양성 가드(P1-3) + 17 QA 통과 → 최종 리포트'
  ];

  return [
    '<section class="page section">',
    '  <div class="section-eyebrow">SECTION A · SPECIFICATION</div>',
    '  <h1 class="section-title">신규 규칙 제작서</h1>',
    '  <p class="section-lede">3-Tier 사명/비전 골격, 슬롯 매핑, 정규화 가드, 빌드 파이프라인 — v4.1 production rule의 단일 진실 공급원(SSoT).</p>',
    '  <div class="section-divider"></div>',

    '  <h2 class="h-block">A-1. 3-Tier 사명/비전 골격</h2>',
    '  <p>사명·비전은 <strong>① 헤드라인 (인용 가능한 한 문장) → ② 한 줄 설명 (좌표) → ③ 1인칭 다이어리 본문 (구체)</strong>의 3계층으로 구성됩니다. Tier ①은 외부 노출용, Tier ②는 삶의 좌표, Tier ③은 매일을 사는 결입니다.</p>',
         renderTable(['Tier','수식 (formula)','예시 (KYS)'], tierRows),

    '  <h2 class="h-block">A-2. 정규화 가드 (한국어 자연성)</h2>',
    '  <p>한국어 합성에서 자주 발생하는 어색함을 빌더 단계에서 자동 차단합니다. 모든 가드는 정규식 + 받침 검사(<code>_hangulJong</code>)로 결정적으로 동작합니다.</p>',
         renderTable(['가드','패턴','규칙','적용 위치'], guardRows),

    '  <h2 class="h-block">A-3. 빌드 파이프라인 (8 Step)</h2>',
    '  <ol>' + flow.map(function(s){ return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>',

    '  <h2 class="h-block">A-4. 슬롯 → 출력 매핑 (요약)</h2>',
    '  <p>아래는 Tier ①/②/③에 직접 투입되는 핵심 슬롯의 흐름입니다. 전체 32항 매핑은 <strong>E. 매핑표</strong>에서 다룹니다.</p>',
         renderTable(
           ['출력 슬롯','진단 입력','라이브러리/함수','결정성'],
           [
             ['Tier① 사명 헤드라인', 'Q75(주체) × Q13×Q63(동사)', 'SUBJECT_BY_DOMAIN_KO + HEADLINE_VERB_KO', 'pickByHash(fingerprint)'],
             ['Tier① 비전 헤드라인', 'Q13×Q63 → 회상 정체성', 'VISION_HEADLINE_KO (4×9=36셀)', 'pickByHash(fp+offset)'],
             ['Tier② 사명 서브라인', 'Q75 + Q63 keyword',     'COMPASS_KEYWORD_KO + 도메인 결합', '받침검사 → 와/과·을/를'],
             ['Tier② 비전 서브라인', 'Q75 + Q63 keyword',     '동일 + "10년 뒤" prefix',          '동일'],
             ['Tier③ 사명 다이어리', 'Q63 why + Q75 분야 + Q41 장면 + Q13×Q63 정체성', 'DIARY_WHY/FIELD/IDENTITY_KO', '_whyNatural + _scenePrefix 가드'],
             ['Tier③ 비전 다이어리', 'Q13×Q63 정체성 3개', 'DIARY_IDENTITY_KO + DIARY_WHY_IDENTITY_KO', 'pickByHash + (a, a+1, a+2) 회전']
           ]
         ),

    '  <div class="callout"><div class="callout-title">결정성 보장</div>모든 임의 선택은 <code>fingerprint(56문항)</code>를 시드로 한 <code>pickByHash()</code>로 결정됩니다. 동일 응답 → 동일 결과를 80억분의 1 정밀도로 재현합니다.</div>',

    '</section>'
  ].join('\n');
};
