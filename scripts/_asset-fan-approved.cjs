'use strict';
// asset-fan-v1 (owner-approved 2026-10-09): exact additions to program-engine.js / program.html.
// strip*() removes them (marker-bounded) and pins the removed bytes by sha256, so any other change still fails.
const crypto=require('node:crypto'),assert=require('node:assert/strict');
const h=s=>crypto.createHash('sha256').update(s).digest('hex');
const PIN=require('./_asset-fan-approved.json');
function cut(src,a,b,label){const i=src.indexOf(a),j=src.indexOf(b,i+1);assert.ok(i>0&&j>i,'asset-fan block present: '+label);assert.equal(src.indexOf(a,i+1),-1,'asset-fan block once: '+label);return [src.slice(0,i)+src.slice(j),src.slice(i,j)];}
const PASS_NEW='          footer:  footer,\n          // asset-fan-v1: 리포트 XI 「자산화 길 찾기」와 이어지는 자산화 부채꼴(새로 만들거나 재생성한 프로그램만).\n          assetFan: (p._assetFan && p._assetFan.version === "asset-fan-v1" && Array.isArray(p._assetFan.rings)) ? p._assetFan : null\n';
function blocksProgram(src){
  assert.equal(src.split(PASS_NEW).length,2,'asset-fan passthrough once');src=src.replace(PASS_NEW,'          footer:  footer\n');
  let css,js;[src,css]=cut(src,"        '.afan{","        '.glance-oneline__mk{",'css');[src,js]=cut(src,'// asset-fan-v1 — 리포트 XI','// ① 정체성 앵커','card');
  return {src,pin:{css:h(css),js:h(js)}};}
function blocksEngine(src){
  let fn,call;[src,fn]=cut(src,'  /* asset-fan-v1 (2026-10-09','  /* PROG-01 — four-axis decision','fn');
  [src,call]=cut(src,'      var fan = assetFan(ap);','    }\n    return output;','call');
  return {src,pin:{fn:h(fn),call:h(call)}};}
function stripProgram(src){const r=blocksProgram(src);assert.deepEqual(r.pin,PIN.program,'asset-fan program.html bytes are the reviewed ones');return r.src;}
function stripEngine(src){const r=blocksEngine(src);assert.deepEqual(r.pin,PIN.engine,'asset-fan engine bytes are the reviewed ones');return r.src;}
module.exports={stripProgram,stripEngine,blocksProgram,blocksEngine};
