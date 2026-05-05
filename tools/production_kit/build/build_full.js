// tools/production_kit/build/build_full.js
// Step 2 — 전체 섹션(A~E) 풀 렌더 + 압축판 미리보기 HTML
//
// 사용: node tools/production_kit/build/build_full.js
// 출력: tools/production_kit/build/preview_full.html

const fs = require('fs');
const path = require('path');

const { loadCss } = require('../templates/render_helpers');
const renderCover    = require('../sections/cover');
const renderToc      = require('../sections/toc');
const renderSectionA = require('../sections/section_a_spec');
const renderSectionB = require('../sections/section_b_samples');
const renderSectionC = require('../sections/section_c_programs');
const renderSectionD = require('../sections/section_d_prompts');
const renderSectionE = require('../sections/section_e_mapping');

const dataPath = path.join(__dirname, 'kit_data.json');
if (!fs.existsSync(dataPath)) {
  console.error('kit_data.json not found — run assemble_data.js first.');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const css = loadCss();

const html = [
  '<!doctype html>',
  '<html lang="ko">',
  '<head>',
  '  <meta charset="utf-8">',
  '  <title>' + data.meta.title + ' — Full Preview</title>',
  '  <style>' + css + '</style>',
  '</head>',
  '<body>',
  renderCover(data),
  renderToc(data),
  renderSectionA(data),
  renderSectionB(data),
  renderSectionC(data),
  renderSectionD(data),
  renderSectionE(data),
  '</body>',
  '</html>'
].join('\n');

const outPath = path.join(__dirname, 'preview_full.html');
fs.writeFileSync(outPath, html);

const sections = (html.match(/<section /g) || []).length;
console.log('[build_full] OK');
console.log('  output  :', outPath);
console.log('  size    :', fs.statSync(outPath).size, 'bytes');
console.log('  sections:', sections);
