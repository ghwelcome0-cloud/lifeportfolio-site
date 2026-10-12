'use strict';
// asset-program-v1 (owner 2026-10-12 「전 페이지가 … 자산화 맞춤 실행 프로그램으로 격상 … 그걸 제작규칙으로 업데이트」, 제작규칙 AP-1).
// Every added line in program-engine.js / program.html ends with the marker "// AP1". strip() removes exactly those
// lines and pins them by sha256, so the existing byte-pinned boundaries keep pinning everything else.
const crypto=require('node:crypto'),assert=require('node:assert/strict');
const PIN=require('./_asset-program-approved.json');
const MARK=/ \/\/ AP1$/;
function blocks(src){const L=src.split('\n'),keep=[],cut=[];for(const l of L)(MARK.test(l)?cut:keep).push(l);
 return {src:keep.join('\n'),pin:{lines:cut.length,sha:crypto.createHash('sha256').update(cut.join('\n')).digest('hex')}};}
function strip(file,src){const r=blocks(src);const p=PIN[file];if(!p){assert.equal(r.pin.lines,0,'no AP1 lines expected in '+file);return src;}
 assert.deepEqual(r.pin,p,'asset-program AP1 lines in '+file+' are the reviewed ones');return r.src;}
module.exports={strip,blocks};
