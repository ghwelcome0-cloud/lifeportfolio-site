// tools/production_kit/build/build_preview_step1.js
// Step 1 — 백본 검증용 미리보기 HTML 빌더
//   표지 + 목차 + 섹션 A(규칙 제작서) 만 포함
//
// 사용: node tools/production_kit/build/build_preview_step1.js
// 출력: tools/production_kit/build/preview_step1.html

const fs = require('fs');
const path = require('path');

const { loadCss } = require('../templates/render_helpers');
const renderCover    = require('../sections/cover');
const renderToc      = require('../sections/toc');
const renderSectionA = require('../sections/section_a_spec');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
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
  '  <title>' + data.meta.title + ' — Step 1 Preview</title>',
  '  <style>' + css + '</style>',
  '</head>',
  '<body>',
  renderCover(data),
  renderToc(data),
  renderSectionA(data),
  '</body>',
  '</html>'
].join('\n');

const outPath = path.join(__dirname, 'preview_step1.html');
fs.writeFileSync(outPath, html);

console.log('[build_preview_step1] OK');
console.log('  output:', outPath);
console.log('  size  :', fs.statSync(outPath).size, 'bytes');
console.log('  pages : Cover + TOC + Section A (3 pages)');
