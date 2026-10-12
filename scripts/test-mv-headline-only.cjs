'use strict';
// 대표 지시 2026-10-12: 사명·비전 페이지에는 기존 사명·비전 문구만. 부연 설명(서브라인)을 화면·책 어디에도 그리지 않는다.
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','report.html'),'utf8');
let n=0;const ok=(c,m)=>{assert.ok(c,m);n++;};
ok(!/cls:"mv-subline"/.test(src),'screen view must not append mv-subline');
ok(!/<p class="mv-subline">/.test(src),'book page II must not render mv-subline');
ok(!/DATA\.missionVision\.(mission|vision)Subline\)/.test(src.replace(/missionSubline: mv\.missionSubline[^\n]*|visionSubline: mv\.visionSubline[^\n]*/g,'')),'book must not read subline values');
ok(/DATA\.missionVision\.missionHeadline/.test(src)&&/DATA\.missionVision\.visionHeadline/.test(src),'book keeps mission and vision headlines');
ok(/cls:"mv-headline", text: _mvWrap2\(mHead\)/.test(src)&&/cls:"mv-headline", text: _mvWrap2\(c\.visionHeadline\)/.test(src),'screen keeps both headlines');
const M=require('./_mv-headline-approved.cjs');const before='<p class="mv-headline">A</p><div class="mv-sep"></div><p class="mv-subline">B</p>';
ok(M.baseline(before)==='<p class="mv-headline">A</p>','baseline drops only the subline');
console.log('test-mv-headline-only: '+n+' checks passed');
