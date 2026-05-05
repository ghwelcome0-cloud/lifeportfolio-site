// sections/section_e_mapping.js — E. 매핑표 + QA 체크리스트 + 정규화 가드
const { esc, renderTable } = require('../templates/render_helpers');

const AXIS_LABEL = {
  self_understanding: '자기이해',
  self_expression:    '자기표현',
  self_design:        '자기설계',
  self_execution:     '자기실행'
};

function axisCellLabel(axis){
  if (AXIS_LABEL[axis]) return '<span class="axis-pill ' + ({self_understanding:'su',self_expression:'se',self_design:'sd',self_execution:'sx'}[axis] || '') + '">' + AXIS_LABEL[axis] + '</span>';
  return esc(axis);
}

module.exports = function renderSectionE(data){
  const map = data.questionSlotMap || [];
  const qa  = data.qaItems || [];
  const compassKeys = data.compassKeys || [];
  const compassLabels = data.compassLabels || [];

  // E-1. 17문항 → 슬롯 매핑표 (32행, 2 페이지로 분할)
  const mapRows = map.map(function(m){
    return [
      '<span class="mono" style="font-size:8.8pt;">' + esc(m.q) + '</span>',
      axisCellLabel(m.axis),
      esc(m.slot),
      esc(m.purpose)
    ];
  });
  const half = Math.ceil(mapRows.length / 2);
  const mapPart1 = mapRows.slice(0, half);
  const mapPart2 = mapRows.slice(half);

  // E-2. 9 Compass 카테고리 키워드 매트릭스
  const compassRows = compassKeys.map(function(k, i){
    return [
      '<span class="mono" style="font-size:8.8pt;">' + esc(k) + '</span>',
      esc(compassLabels[i] || ''),
      // 영향 범위 — 사명 절 + 비전 정체성
      'mission_clause + vision_identity',
      'COMPASS_MISSION/VISION_KO'
    ];
  });

  // E-3. 17 QA 체크리스트
  const qaItems = qa.map(function(q, i){
    return '<li><span class="ck-box"></span><span class="ck-id">' + esc(q.id) + '</span><span class="ck-label">' + esc(q.label) + '</span></li>';
  }).join('');

  // E-4. 5톤 검증 결과표
  const samples = data.samples || [];
  const verifyRows = samples.map(function(s){
    return [
      '<span class="tone-chip" style="background:' + s.tone.color + '">' + s.tone.emoji + ' ' + s.tone.label + '</span>',
      s.name,
      s.qa.passed + '/' + s.qa.total,
      s.qa.score + '/100',
      '✅ clean'
    ];
  });

  return [
    // ── E-1 ─────────────────────────────────────
    '<section class="page section">',
    '  <div class="section-eyebrow">SECTION E · MAPPING & QA</div>',
    '  <h1 class="section-title">매핑표 · 체크리스트 · 가드</h1>',
    '  <p class="section-lede">합성 결과가 production rule을 따르는지 즉시 검증할 수 있는 매핑표(32항) · 17 QA 체크리스트 · 6 정규화 가드 · 5톤 검증 결과표.</p>',
    '  <div class="section-divider"></div>',

    '  <h2 class="h-block">E-1. 17문항 → 슬롯 매핑표 (1/2)</h2>',
    '  <p>각 문항이 어떤 4축 점수에 기여하고, 사명/비전·실행 프로그램의 어떤 슬롯에 직접 매핑되는지 한 줄로 정리했습니다.</p>',
         renderTable(['문항','축','매핑 슬롯','목적'], mapPart1),
    '</section>',

    '<section class="page section">',
    '  <div class="section-eyebrow" style="color:var(--brand-primary);">SECTION E · MAPPING & QA</div>',
    '  <h2 class="h-block">E-1. 17문항 → 슬롯 매핑표 (2/2)</h2>',
         renderTable(['문항','축','매핑 슬롯','목적'], mapPart2),

    '  <h2 class="h-block">E-2. 9 Compass 카테고리 매트릭스</h2>',
    '  <p>Q63(선택 기준)이 결정하는 9개 Compass 카테고리. 각 키는 한 단어 키워드로 정규화되어 사명 절·비전 정체성에 그대로 들어갑니다.</p>',
         renderTable(['Q63 옵션 (raw)','정규화 키워드','영향 범위','라이브러리'], compassRows),
    '</section>',

    // ── E-3, E-4 ────────────────────────────────
    '<section class="page section">',
    '  <div class="section-eyebrow" style="color:var(--brand-primary);">SECTION E · MAPPING & QA</div>',
    '  <h2 class="h-block">E-3. 17 QA 체크리스트</h2>',
    '  <p>v4.1 엔진 내장 QA. 모든 항목이 ✅이면 production 통과로 간주합니다.</p>',
    '  <ul class="checklist">' + qaItems + '</ul>',

    '  <h2 class="h-block">E-4. 5톤 샘플 검증 결과</h2>',
    '  <p>본 매뉴얼 B·C 섹션에 실린 5톤 샘플의 자동 검증 결과입니다. 잔존 어색어(특히특히/하는가를) 누출 여부도 함께 확인했습니다.</p>',
         renderTable(
           ['톤','대표 인물','QA','점수','잔존 어색어'],
           verifyRows,
           { center: [2, 3, 4] }
         ),

    '  <div class="callout"><div class="callout-title">검수 절차 (압축판)</div>',
    '  ① 합성 직후 17 QA 자동 통과 확인 → ② D-4 사람 체크리스트 10항 통과 → ③ 잔존 어색어 grep(<code>특히\\s+특히</code>, <code>하는가를</code>) → ④ 도메인 결합 와/과 1건 샘플 점검 → ⑤ 최종 PDF/HTML 노출 확인.</div>',
    '</section>'
  ].join('\n');
};
