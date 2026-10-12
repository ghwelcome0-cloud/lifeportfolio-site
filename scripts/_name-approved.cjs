'use strict';
// 이름 정리 (owner-approved 2026-10-12 「'자산화 맞춤 실행 프로그램' 이런 느낌 … 인생포트폴리오 리포트는 그대로 … 잘 축약해서 정해주세요」).
// 정식 이름 「자산화 맞춤 실행 프로그램」, 짧은 이름 「자산화 실행」; 「나의/내 … 프로그램」 표현 제거. Exact before/after pairs per file
// (_name-approved.json). strip() restores the reviewed bytes so the existing byte-pinned boundary tests keep pinning the rest.
const assert=require('node:assert/strict');
const PAIRS=require('./_name-approved.json');
function strip(file,src){const p=PAIRS[file];if(!p)return src;for(const [now,old] of p){assert.equal(src.split(now).length,2,'name edit once in '+file+': '+now.slice(0,50));src=src.replace(now,old);}return src;}
module.exports={strip,PAIRS,FULL:'자산화 맞춤 실행 프로그램',SHORT:'자산화 실행'};
