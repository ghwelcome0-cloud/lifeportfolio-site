// sections/cover.js — 표지 (전면 그라디언트, 페이지 마진 0)
const { esc } = require('../templates/render_helpers');

module.exports = function renderCover(data){
  const m = data.meta;
  return [
    '<section class="cover">',
    '  <div class="cover-inner">',
    '    <div>',
    '      <span class="cover-tag">Production Manual · ' + esc(m.version) + '</span>',
    '      <h1 class="cover-title">' + esc(m.title) + '</h1>',
    '      <p class="cover-subtitle">' + esc(m.subtitle) + '</p>',
    '    </div>',
    '    <dl class="cover-meta">',
    '      <div><dt>대상</dt><dd>' + esc(m.audience) + '</dd></div>',
    '      <div><dt>기준 PR</dt><dd>' + esc(m.prRef) + '</dd></div>',
    '      <div><dt>발간일</dt><dd>' + esc(m.generatedAt) + '</dd></div>',
    '      <div><dt>버전</dt><dd>' + esc(m.version) + ' (compressed manual)</dd></div>',
    '    </dl>',
    '  </div>',
    '</section>'
  ].join('\n');
};
