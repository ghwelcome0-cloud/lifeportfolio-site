'use strict';
// 대표 지시 2026-10-12: 사명·비전 페이지에는 기존 사명·비전 문구만. 부연 설명(서브라인)을 화면·책 어디에도 그리지 않는다.
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','report.html'),'utf8');
let n=0;const ok=(c,m)=>{assert.ok(c,m);n++;};
ok(!/cls:"mv-subline"/.test(src),'screen view must not append mv-subline');
ok(!/<p class="mv-subline">/.test(src),'book page II must not render mv-subline');
ok(!/DATA\.missionVision\.(mission|vision)Subline\)/.test(src.replace(/missionSubline: mv\.missionSubline[^\n]*|visionSubline: mv\.visionSubline[^\n]*/g,'')),'book must not read subline values');
ok(/blk\("사명","mission",mv\.missionHeadline\)/.test(src)&&/blk\("비전","vision",mv\.visionHeadline\)/.test(src),'certificate page carries the mission and vision headlines');
// mv-certificate: 상장형 지면 — 새 설명 문장 없이 이름·사명·비전·발행처(·유효한 날짜)만.
const cert=(src.match(/'function mvCert\(\)[\s\S]*?\';\}',/)||[''])[0];
ok(cert.length>0,'mvCert defined');
const words=cert.replace(/<[^>]+>/g,' ').match(/[가-힣]+/g)||[];
ok(words.every(w=>['사명','비전','님의','사명과','인생포트폴리오'].includes(w)),'certificate adds no explanation words: '+words.join(','));
ok(!/mvDate|mvc__sig[^']*<small>/.test(src),'certificate footer is 「인생포트폴리오」 only — no date (대표 2026-10-12)');
ok(/\.book\.lb-mobile \.mvc\{/.test(src)&&/\.mvc__seg\{display:block;text-wrap:balance;\}/.test(src),'certificate has mobile rules and balanced lines');
ok(/cls:"mv-headline", text: _mvWrap2\(mHead\)/.test(src)&&/cls:"mv-headline", text: _mvWrap2\(c\.visionHeadline\)/.test(src),'screen keeps both headlines');
const M=require('./_mv-headline-approved.cjs');const before='<p class="mv-headline">A</p><div class="mv-sep"></div><p class="mv-subline">B</p>';
ok(M.baseline(before)==='<p class="mv-headline">A</p>','baseline drops only the subline');
// 인장(2026-10-12 대표 「로고가 … 따로 노는 것 같아요 … 융화되도록」): 사각 원본 대신 같은 L·궤도·점 금박 마크를 둥근 금빛 인장 안에.
ok(/<span class="mvc__emb" aria-hidden="true"><img src="\/assets\/trademark\/lifeportfolio-mark-gold-foil-320\.png"/.test(src)&&!/class="mvc__emb" src=/.test(src),'certificate uses the round gold seal, not the square logo');
ok(fs.existsSync(path.join(__dirname,'..','assets/trademark/lifeportfolio-mark-gold-foil-320.png')),'gold foil mark file exists in a public tree');
console.log('test-mv-headline-only: '+n+' checks passed');
