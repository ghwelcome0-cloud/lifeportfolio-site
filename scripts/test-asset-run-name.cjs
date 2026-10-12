'use strict';
// 이름 정리 2026-10-12: 정식 「자산화 맞춤 실행 프로그램」, 짧은 「자산화 실행」. 「인생포트폴리오 리포트」는 그대로. 「나의/내 … 프로그램」 없음.
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),root=path.join(__dirname,'..');
const N=require('./_name-approved.cjs');let n=0;
const strip=s=>s.split('\n').filter(l=>!/^\s*(\/\/|\/\*|\*)/.test(l.trim())).join('\n').replace(/\/\(\?:나의 \|내 \)[^/]*\/g/g,'').replace(/\(맞춤 실행 프로그램\)\$/g,''); // the cover title normaliser's own regex
for(const f of Object.keys(N.PAIRS)){const s=strip(fs.readFileSync(path.join(root,f),'utf8'));
 assert.ok(!/(?<!자산화 )맞춤형? 실행 ?프로그램/.test(s),f+': every full name carries 자산화');
 assert.ok(!/(나의|내) (자산화 )?맞춤/.test(s),f+': no 나의/내 before the program name');
 assert.ok(!/🚀 실행 프로그램/.test(s),f+': short label is 자산화 실행');n++;}
const ko=require(path.join(root,'assets/i18n/ko.json'));
assert.equal(ko.report.btn_program_short,'🚀 '+N.SHORT);assert.equal(ko.program.sb_kind,N.FULL);n++;
assert.ok(fs.readFileSync(path.join(root,'report.html'),'utf8').includes('인생포트폴리오 리포트'),'report name unchanged');n++;
console.log(JSON.stringify({passed:n,full:N.FULL,short:N.SHORT}));
