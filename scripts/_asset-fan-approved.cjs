'use strict';
// asset-fan-v1 (owner-approved 2026-10-09): exact additions to program-engine.js / program.html.
// strip*() removes them (marker-bounded) and pins the removed bytes by sha256, so any other change still fails.
const crypto=require('node:crypto'),assert=require('node:assert/strict');
const h=s=>crypto.createHash('sha256').update(s).digest('hex');
const PIN=require('./_asset-fan-approved.json');
function cut(src,a,b,label){const i=src.indexOf(a),j=src.indexOf(b,i+1);assert.ok(i>0&&j>i,'asset-fan block present: '+label);assert.equal(src.indexOf(a,i+1),-1,'asset-fan block once: '+label);return [src.slice(0,i)+src.slice(j),src.slice(i,j)];}
const PASS_NEW='          footer:  footer,\n          // asset-fan-v1: 리포트 XI 「자산화 길 찾기」와 이어지는 자산화 부채꼴(새로 만들거나 재생성한 프로그램만).\n          assetFan: (p._assetFan && p._assetFan.version === "asset-fan-v1" && Array.isArray(p._assetFan.rings)) ? p._assetFan : null\n';
const QUEST_PASS=',\n          // asset-quest-v1: III장 12주 자산화 퀘스트(새로 만들거나 재생성한 한국어 프로그램만).\n          assetQuest: (p._assetQuest && p._assetQuest.version === "asset-quest-v1" && Array.isArray(p._assetQuest.phases)) ? p._assetQuest : null\n';
const QUEST_TOC=['(DATA.assetQuest?["III","12주 자산화 퀘스트","고유성을 실제 자산으로","ch2"]:["III","주차별 실행 루틴","매주 하나씩 실천하기","ch2"])','["III","주차별 실행 루틴","매주 하나씩 실천하기","ch2"]'];
const QUEST_LB='          // asset-quest-v1: III장 label follows the program (12주 퀘스트 when present).\n          var _aq = !!(currentProgram && currentProgram._assetQuest && currentProgram._assetQuest.version === "asset-quest-v1");\n          LB_CHAPTERS[4].tx = _aq ? "12주 자산화 퀘스트" : "주차별 실행 루틴";\n';
function questOut(src){
  // 2026-10-11 (owner): III장 → 12주 자산화 퀘스트. Remove the reviewed additions; the old 3주 body stays inside the else branch.
  const once=(a,l)=>{assert.equal(src.split(a).length,2,'asset-quest '+l+' once');};
  once(QUEST_PASS,'passthrough');src=src.replace(QUEST_PASS,'\n');
  once(QUEST_TOC[0],'toc');src=src.replace(QUEST_TOC[0],QUEST_TOC[1]);
  once(QUEST_LB,'lb');src=src.replace(QUEST_LB,'');
  let qcss,qjs;[src,qcss]=cut(src,"        '.aq-lead{","        '.glance-oneline__mk{",'quest-css');
  [src,qjs]=cut(src,'// asset-quest-v1 (2026-10-11) — III장','// 첫 페이지: 섹션 타이틀 + 1주차','quest-js');
  const tail="'}',\n'})();',";const at=src.indexOf(tail,src.indexOf('// 첫 페이지: 섹션 타이틀 + 1주차'));assert.ok(at>0,'quest else close');
  src=src.slice(0,at)+src.slice(at+5);
  return [src,{qcss:h(qcss),qjs:h(qjs)}];}
function blocksProgram(src){
  let qp;[src,qp]=questOut(src);
  assert.equal(src.split(PASS_NEW).length,2,'asset-fan passthrough once');src=src.replace(PASS_NEW,'          footer:  footer\n');
  let css,js,gx;[src,css]=cut(src,"        '.afan{","        '.glance-oneline__mk{",'css');[src,js]=cut(src,'// asset-fan-v1 — 리포트 XI','// ① 정체성 앵커','card');
  // 2026-10-11 (owner): compressed ②③ glance replaces the v1 card grid; restore the reviewed v1 bytes for baseline comparison.
  [src,gx]=cut(src,'// ②③ 압축형',"'page(h,{anchor:\"ch0\",runhead:RH});})();'",'glance');
  const at=src.indexOf("'page(h,{anchor:\"ch0\",runhead:RH});})();'",src.indexOf('// ① 정체성 앵커'));
  src=src.slice(0,at)+require('node:fs').readFileSync(__dirname+'/_glance-v1-baseline.txt','utf8')+src.slice(at);
  return {src,pin:{css:h(css),js:h(js),glance:h(gx),...qp}};}
function blocksEngine(src){
  let fn,call;[src,fn]=cut(src,'  /* asset-fan-v1 (2026-10-09','  /* PROG-01 — four-axis decision','fn');
  [src,call]=cut(src,'      var fan = assetFan(ap);','    }\n    return output;','call');
  return {src,pin:{fn:h(fn),call:h(call)}};}
function stripProgram(src){const r=blocksProgram(src);assert.deepEqual(r.pin,PIN.program,'asset-fan program.html bytes are the reviewed ones');return r.src;}
function stripEngine(src){const r=blocksEngine(src);assert.deepEqual(r.pin,PIN.engine,'asset-fan engine bytes are the reviewed ones');return r.src;}
module.exports={stripProgram,stripEngine,blocksProgram,blocksEngine};
