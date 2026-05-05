// sections/section_c_programs.js — C. 5톤 맞춤형 실행 프로그램 샘플 (압축판)
const { esc, toneChip } = require('../templates/render_helpers');

function renderProgramOnePager(sample, data){
  const t = sample.tone;
  const p = sample.program || {};
  const cover = p.cover || {};
  const year1 = p.year1 || {};
  const closing = Array.isArray(p.closing) ? p.closing : (p.closing ? [p.closing] : []);
  const visions = year1.visions || (year1.vision ? (Array.isArray(year1.vision) ? year1.vision : [year1.vision]) : []);
  const milestones = year1.milestones || [];
  const arrow = cover.arrowLine || '';
  const quote = cover.quote || '';
  const routine = data.toneRoutines[t.key] || '—';

  return [
    '<section class="page section">',
    '  <div class="sample-band" style="background:' + t.color + '"></div>',
    '  <div class="sample-header">',
    '    <div>',
    '      <div class="sample-name">' + esc(sample.name) + ' — 맞춤형 실행 프로그램</div>',
    '      <div class="sample-meta">' + toneChip(t) + ' · 루틴: ' + esc(routine) + '</div>',
    '    </div>',
    '    <div class="sample-meta">v1.1 · PE 풀 빌드</div>',
    '  </div>',

    '  <h3 class="h-sub">📘 Cover Quote</h3>',
    '  <div class="card soft"><div style="font-size:10pt;line-height:1.55">' + esc(quote || '—') + '</div></div>',

    '  <h3 class="h-sub">👉 Arrow Routine</h3>',
    '  <div class="card"><div style="font-size:10.5pt;font-weight:700;color:' + t.color + '">' + esc(arrow || routine) + '</div></div>',

    '  <div class="two-col">',
    '    <div class="col">',
    '      <h3 class="h-sub">🎯 Year-1 Vision</h3>',
    '      <ul>' + visions.map(function(v){ return '<li>' + esc(v) + '</li>'; }).join('') + '</ul>',
    '    </div>',
    '    <div class="col">',
    '      <h3 class="h-sub">🚀 Milestones (3)</h3>',
    '      <ol>' + milestones.map(function(m){ return '<li>' + esc(m) + '</li>'; }).join('') + '</ol>',
    '    </div>',
    '  </div>',

    '  <h3 class="h-sub">🧩 Closing</h3>',
    '  <div class="card soft">' +
    '    <ul style="margin:0;font-size:9.8pt;line-height:1.6">' +
         closing.map(function(c){ return '<li>' + esc(c) + '</li>'; }).join('') +
    '    </ul>' +
    '  </div>',

    '  <div class="section-footer"><span>C. 실행 프로그램 — ' + esc(t.label) + '</span><span>' + esc(sample.name) + '</span></div>',
    '</section>'
  ].join('\n');
}

module.exports = function renderSectionC(data){
  const intro = [
    '<section class="page section">',
    '  <div class="section-eyebrow">SECTION C · CUSTOM EXECUTION PROGRAM</div>',
    '  <h1 class="section-title">5톤 맞춤형 실행 프로그램 샘플</h1>',
    '  <p class="section-lede">사명/비전 3-Tier가 어떻게 매일의 루틴(Cover Quote → Arrow → Year-1 Vision → Milestones → Closing)으로 번역되는지를 톤 별로 보여줍니다.</p>',
    '  <div class="section-divider"></div>',
    '  <p>각 페이지는 ProgramEngine v1.1 풀 파이프라인의 핵심 5요소만 발췌한 압축판입니다. 실제 발급물에는 분기 테마, 주간 루틴, 3-month goals, 3 modules, 트래킹 보드, Risks가 추가됩니다.</p>',
    '  <div class="callout"><div class="callout-title">정합성 보장</div>모든 cover quote · arrow · year1 · closing 텍스트는 <code>data/program-rules.json</code>의 톤별 규칙에서 <code>{{missionHeadline}}</code> · <code>{{visionHeadline}}</code> · <code>{{compassKw}}</code> · <code>{{domainPhrase}}</code> 슬롯이 받침 검사 + 어색어 가드를 거쳐 합성된 결과입니다.</div>',
    '  <div class="section-footer"><span>C. 실행 프로그램 (서론)</span><span>5톤 비교</span></div>',
    '</section>'
  ].join('\n');
  return [intro].concat(data.samples.map(function(s){ return renderProgramOnePager(s, data); })).join('\n');
};
