// sections/section_b_samples.js — B. 5톤 인생포트폴리오 리포트 샘플 (압축판)
const { esc, renderTable, renderMvCard, axisPill } = require('../templates/render_helpers');

const AXIS_LABEL = {
  self_understanding: '자기이해',
  self_expression:    '자기표현',
  self_design:        '자기설계',
  self_execution:     '자기실행'
};
const AXIS_CLS = { self_understanding: 'su', self_expression: 'se', self_design: 'sd', self_execution: 'sx' };

function renderAxisGrid(axes){
  const cells = (axes || []).map(function(a){
    const cls = 'axis-cell is-' + (AXIS_CLS[a.id] || '');
    return '<div class="' + cls + '">' +
           '  <div class="axis-name">' + esc(AXIS_LABEL[a.id] || a.id) + '</div>' +
           '  <div class="axis-pct">' + esc(a.pct == null ? '-' : a.pct) + '<span style="font-size:10pt;font-weight:600;">%</span></div>' +
           '  <div class="axis-tier">' + esc(a.tierLabel || a.tier || '') + '</div>' +
           '</div>';
  }).join('');
  return '<div class="axis-grid">' + cells + '</div>';
}

function renderListBlock(title, items, max){
  if (!items || !items.length) return '';
  const top = items.slice(0, max || 3);
  const lis = top.map(function(s){ return '<li>' + esc(s) + '</li>'; }).join('');
  return '<h3 class="h-sub">' + esc(title) + '</h3><ul>' + lis + '</ul>';
}

function renderSampleCard(s){
  const t = s.tone;
  const mv = s.mission || {};
  return [
    '<div class="no-break" style="margin-bottom:6mm;">',
    '  <div class="sample-band" style="background:linear-gradient(90deg,' + t.color + ',' + t.color + '88);"></div>',
    '  <div class="sample-header">',
    '    <div class="sample-name">' + esc(s.name) + ' <span class="tone-chip" style="background:' + t.color + ';margin-left:6px;">' + t.emoji + ' ' + esc(t.label) + '</span></div>',
    '    <div class="sample-meta">QA ' + esc(s.qa.passed) + '/' + esc(s.qa.total) + ' · fingerprint ' + esc(s.fingerprint || '-') + '</div>',
    '  </div>',
         renderAxisGrid(s.axes),
         renderMvCard('mission', mv.headline, mv.subline, mv.diaryMission),
         renderMvCard('vision',  mv.visionHeadline, mv.visionSubline, mv.diaryVision),
    '  <div class="two-col">',
    '    <div class="col">',
           renderListBlock('강점 TOP 3', s.strengths, 3),
           renderListBlock('성장 영역', s.growth, 3),
    '    </div>',
    '    <div class="col">',
           renderListBlock('추천 진로', s.careers, 3),
           renderListBlock('추천 교육', s.education, 3),
    '    </div>',
    '  </div>',
    '</div>'
  ].join('\n');
}

module.exports = function renderSectionB(data){
  const samples = data.samples || [];
  // 표지 한 페이지 + 톤별 페이지(5)
  const intro = [
    '<section class="page section">',
    '  <div class="section-eyebrow">SECTION B · SAMPLES</div>',
    '  <h1 class="section-title">5톤 인생포트폴리오 리포트 샘플</h1>',
    '  <p class="section-lede">동일 엔진(v4.1)에 톤별 대표 응답 시나리오를 투입한 결과입니다. 4축 점수, Mission/Vision 3-Tier, 강점·진로·교육 추천이 톤마다 어떻게 결을 달리하는지 비교하실 수 있도록 압축형 1톤=1페이지 레이아웃으로 정리했습니다.</p>',
    '  <div class="section-divider"></div>',
    '  <div class="callout"><div class="callout-title">읽는 법</div>',
    '  · <strong>축 컬러</strong> 🟦 자기이해 / 🟩 자기표현 / 🟥 자기설계 / 🧭 자기실행 &nbsp; · <strong>tier 라벨</strong>: deep / active / sharp / quiet &nbsp; · <strong>톤 칩</strong>: 진단 우선순위(P1-1)로 결정된 최종 톤</div>',
         renderTable(
           ['톤','대표 인물','자기이해','자기표현','자기설계','자기실행','QA'],
           samples.map(function(s){
             const ax = {};
             (s.axes || []).forEach(function(a){ ax[a.id] = a.pct + '%'; });
             return [
               '<span class="tone-chip" style="background:' + s.tone.color + '">' + s.tone.emoji + ' ' + s.tone.label + '</span>',
               s.name,
               ax.self_understanding || '-',
               ax.self_expression || '-',
               ax.self_design || '-',
               ax.self_execution || '-',
               s.qa.passed + '/' + s.qa.total
             ];
           }),
           { center: [2,3,4,5,6] }
         ),
    '</section>'
  ].join('\n');

  const cards = samples.map(function(s){
    return '<section class="page section"><div class="section-eyebrow" style="color:' + s.tone.color + ';">' + s.tone.emoji + ' ' + esc(s.tone.label.toUpperCase()) + '</div>' + renderSampleCard(s) + '</section>';
  }).join('\n');

  return intro + '\n' + cards;
};
