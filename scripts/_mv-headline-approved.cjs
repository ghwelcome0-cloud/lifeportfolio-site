'use strict';
// mv-headline-only (owner-approved 2026-10-12: 「사명과 비전 페이지 … 부연 설명 빼세요 … 기존 사명과 비전 문구만 반영되도록」).
// Exact edits to report.html. strip() restores the pre-change source (each edit must appear exactly once) so the existing
// sha-pinned boundary tests keep pinning every other byte. baseline() removes the subline from a rendered II page body
// so the "page must not change" comparison accepts only this approved removal. Stored engine values are untouched.
const assert=require('node:assert/strict');
const SUBM='            if (mSub && mSub.indexOf("🔍") === -1) m.appendChild(el("div", { cls:"mv-subline", text: _mvWrap2(mSub) }));\n';
const SUBV='            if (vSub && vSub.indexOf("🔍") === -1) v.appendChild(el("div", { cls:"mv-subline", text: _mvWrap2(vSub) }));\n';
const NOTE='            // [mv-headline-only 2026-10-12 대표 지시] 「기존 사명과 비전 문구만」 — 부연 설명(서브라인)은 보여 주지 않는다. 저장값은 그대로.\n';
const EDITS=[
 [NOTE,SUBM],
 ['            // [PR-카피압축 2026-06-15] 2단 구조: 압축 헤드라인(위·크게) + 고유성 디테일(아래·작게)\n            if (c.diaryVision) {','            // [PR-카피압축 2026-06-15] 2단 구조: 압축 헤드라인(위·크게) + 고유성 디테일(아래·작게)\n'+SUBV+'            if (c.diaryVision) {'],
 ["<p class=\"mv-headline\">\\'+esc(mvw(scrub(DATA.missionVision.missionHeadline)))+\\'</p></div>","<p class=\"mv-headline\">\\'+esc(mvw(scrub(DATA.missionVision.missionHeadline)))+\\'</p><div class=\"mv-sep\"></div><p class=\"mv-subline\">\\'+esc(mvw(scrub(DATA.missionVision.missionSubline)))+\\'</p></div>"],
 ["<p class=\"mv-headline\">\\'+esc(mvw(scrub(DATA.missionVision.visionHeadline)))+\\'</p></div>","<p class=\"mv-headline\">\\'+esc(mvw(scrub(DATA.missionVision.visionHeadline)))+\\'</p><div class=\"mv-sep\"></div><p class=\"mv-subline\">\\'+esc(mvw(scrub(DATA.missionVision.visionSubline)))+\\'</p></div>"]
];
function strip(file,src){
 if(file!=='report.html')return src;
 for(const [now,old] of EDITS){assert.equal(src.split(now).length,2,'mv-headline-only edit once: '+now.slice(0,60));src=src.replace(now,old);}
 return src;}
function baseline(html){return html.replace(/<div class="mv-sep"><\/div><p class="mv-subline[^"]*">[\s\S]*?<\/p>/g,'');}
module.exports={strip,baseline,EDITS};
