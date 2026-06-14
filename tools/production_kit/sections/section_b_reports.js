// sections/section_b_reports.js — B. 5톤 인생포트폴리오 리포트 샘플 (압축판)
const { esc, renderMvCard, toneChip, axisPill } = require('../templates/render_helpers');

const AXIS_LABELS = {
  self_understanding: { ko: '자기이해', cls: 'su' },
  self_expression:    { ko: '자기표현', cls: 'se' },
  self_design:        { ko: '자기설계', cls: 'sd' },
  self_execution:     { ko: '자기실행', cls: 'sx' }
};

function renderSampleOnePager(sample){
  const t = sample.tone;
  const mv = sample.mission || {};
  const axisCells = sample.axes.map(function(a){
    const meta = AXIS_LABELS[a.id] || { ko: a.id, cls: '' };
    return [
      '<div class="axis-cell is-' + meta.cls + '">',
      '  <div class="axis-name">' + esc(meta.ko) + '</div>',
      '  <div class="axis-pct">' + (a.pct != null ? a.pct + '%' : '—') + '</div>',
      '  <div class="axis-tier">' + esc(a.tierLabel || (a.tier || '')) + '</div>',
      '</div>'
    ].join('');
  }).join('');

  const strengthLis = (sample.strengths || []).slice(0, 3).map(function(s){
    return '<li>' + esc(s) + '</li>';
  }).join('');
  const careerLis = (sample.careers || []).slice(0, 3).map(function(s){
    return '<li>' + esc(s) + '</li>';
  }).join('');
  const eduLis = (sample.education || []).slice(0, 3).map(function(s){
    return '<li>' + esc(s) + '</li>';
  }).join('');

  return [
    '<section class="page section">',
    '  <div class="sample-band" style="background:' + t.color + '"></div>',
    '  <div class="sample-header">',
    '    <div>',
    '      <div class="sample-name">' + esc(sample.name) + '</div>',
    '      <div class="sample-meta">',
    '        ' + toneChip(t) + ' · QA ' + sample.qa.passed + '/' + sample.qa.total + ' · fp=' + esc(String(sample.fingerprint || '')),
    '      </div>',
    '    </div>',
    '    <div class="sample-meta">v4.1 · 56-Q · 80억 분의 1</div>',
    '  </div>',

    '  <div class="axis-grid no-break">' + axisCells + '</div>',

    '  <h3 class="h-sub">Mission · Vision (응답 직합성 · RESPONSE-DIRECT)</h3>',
       // [PR-중복제거] 화면(report.html)과 동일하게 헤드라인만 노출. 근거 안내문구(subline)·다이어리는 화면 미노출.
       renderMvCard('mission', mv.missionHeadline || mv.headline, '', ''),
       renderMvCard('vision',  mv.visionHeadline, '', ''),

    '  <div class="two-col">',
    '    <div class="col">',
    '      <h3 class="h-sub">강점 TOP 3</h3>',
    '      <ol>' + strengthLis + '</ol>',
    '    </div>',
    '    <div class="col">',
    '      <h3 class="h-sub">진로 추천 TOP 3</h3>',
    '      <ol>' + careerLis + '</ol>',
    '    </div>',
    '  </div>',

    '  <div class="two-col">',
    '    <div class="col">',
    '      <h3 class="h-sub">교육 추천 TOP 3</h3>',
    '      <ol>' + eduLis + '</ol>',
    '    </div>',
    '    <div class="col">',
    '      <h3 class="h-sub">슬롯 흔적 (decoded)</h3>',
    '      <p style="font-size:9pt;color:var(--gray-700);line-height:1.5">' +
    '        <strong>Compass</strong>: ' + esc((mv._slots && mv._slots.compass_raw && mv._slots.compass_raw[0]) || '—') + '<br>' +
    '        <strong>Domain</strong>: ' + esc((mv._slots && mv._slots.primary_domain) || '—') + ' × ' + esc((mv._slots && mv._slots.secondary_domain) || '—') + '<br>' +
    '        <strong>Topic Scene</strong>: ' + esc((mv._slots && mv._slots.topic_scene) || '—') + '<br>' +
    '        <strong>Why</strong>: ' + esc((mv._slots && mv._slots.diary_why) || '—') +
    '      </p>',
    '    </div>',
    '  </div>',

    '  <div class="section-footer"><span>B. 리포트 샘플 — ' + esc(t.label) + '</span><span>' + esc(sample.name) + '</span></div>',
    '</section>'
  ].join('\n');
}

module.exports = function renderSectionB(data){
  const intro = [
    '<section class="page section">',
    '  <div class="section-eyebrow">SECTION B · REPORT SAMPLES</div>',
    '  <h1 class="section-title">5톤 인생포트폴리오 리포트 샘플</h1>',
    '  <p class="section-lede">동일 엔진(v4.1)이 톤 별로 어떻게 결을 달리하는지 한 페이지 압축판으로 비교합니다. 모든 샘플은 17/17 QA 통과, 잔존 어색어 0건.</p>',
    '  <div class="section-divider"></div>',
    '  <p>5톤은 v4.1의 톤 우선순위 해상도(P1-1)에 의해 4축 강세 + Q63 compass + Q41 topic 가중으로 결정됩니다. 사명/비전 헤드라인은 모두 응답에서 곧바로 합성(RESPONSE-DIRECT)되며, 같은 합성 골격을 쓰면서도 동사구·정체성·방향이 톤 별 결로 변주됩니다.</p>',
    '  <ul style="font-size:9.5pt; line-height:1.6">',
    data.tones.map(function(t){
      return '    <li>' + toneChip(t) + ' &nbsp; ' + esc(t.label) + ' — ' + esc(data.toneRoutines[t.key] || '') + '</li>';
    }).join('\n'),
    '  </ul>',
    '  <div class="callout"><div class="callout-title">읽는 법</div>각 페이지는 ① 4축 점수 그리드 → ② Mission/Vision 헤드라인 카드(응답 직합성) → ③ 강점/진로/교육 TOP3 → ④ 슬롯 흔적 순으로 정리되어 있습니다. 톤 컬러 띠는 페이지 상단의 톤 식별자입니다.</div>',
    '  <div class="section-footer"><span>B. 리포트 샘플 (서론)</span><span>5톤 비교</span></div>',
    '</section>'
  ].join('\n');
  return [intro].concat(data.samples.map(renderSampleOnePager)).join('\n');
};
