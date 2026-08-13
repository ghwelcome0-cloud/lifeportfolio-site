#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const read=f=>fs.readFileSync(f,"utf8");
const report=read("report.html"),program=read("program.html");
const ko=JSON.parse(read("assets/i18n/ko.json")),en=JSON.parse(read("assets/i18n/en.json"));
const kit=JSON.parse(read("data/answer-kit.json"));
const forbid=(label,text,patterns)=>patterns.forEach(p=>assert.doesNotMatch(text,p,`${label}: forbidden ${p}`));
const requireAll=(label,text,patterns)=>patterns.forEach(p=>assert.match(text,p,`${label}: missing ${p}`));
const forbidden=[/10\^5[38]|comboLog10/i,/당신만의 고유 코드|고객님의 고유코드|나의 고유코드|your own code|unique identifier/i,/같은 응답은 언제나|same answers always/i,/코드가 다르.*당신이 변|code.*(?:proves|record).*you.*changed/i];

forbid("report IX/X KO+EN source",report,forbidden);
requireAll("report IX/X KO",report,[/응답 코드/,/동일(?:한)? release/,/재검사 신뢰도/,/타당도/,/과거 release 재생성은 아직 구현되지/]);
forbid("program screen/PDF KO+EN",program,forbidden);
requireAll("program screen KO",program,[/계산 재현성 · 응답 코드/,/동일 release/,/다른 정보와 결합하면 개인을 알아볼 가능성/,/재검사 신뢰도/,/타당도/]);
requireAll("program PDF EN",program,[/Calculation reproducibility \\u00b7 response code/,/same release, engine, and input/,/protect it as personal data/,/test-retest reliability/,/validity/,/replay of older releases is not implemented/]);

assert.equal(ko.report.evd_coverage_all,"이 리포트는 응답을 지수·서술·응답 코드의 서로 다른 규칙에 따라 사용합니다. 모든 응답이 모든 산출물에 기여하는 것은 아닙니다.");
assert.match(ko.product.faq_a_typetest,/56개 핵심 문항/);assert.match(ko.product.faq_a_typetest,/최대 20개 조건부 입력/);assert.match(ko.product.faq_a_typetest,/심리검사/);
assert.equal(en.report.evd_coverage_all,"This report uses responses under different rules for indices, narrative, and the response code. Not every response contributes to every output.");
assert.match(en.product.faq_a_typetest,/56 core items/);assert.match(en.product.faq_a_typetest,/up to 20 conditional inputs/);assert.match(en.product.faq_a_typetest,/psychological test/);
forbid("i18n KO",JSON.stringify(ko),forbidden);forbid("i18n EN",JSON.stringify(en),forbidden);
assert.equal(ko.program.lp_repro_hd,"계산 재현성 · 응답 코드");requireAll("program i18n KO key",ko.program.lp_repro_p,[/동일 release/,/동일 엔진/,/동일 입력/,/다른 정보와 결합하면 개인을 알아볼 가능성/,/유일성/,/사람의 변화/,/재검사 신뢰도/,/타당도/,/과거 release 재생성은 아직 구현되지/]);
assert.equal(en.program.lp_repro_hd,"Calculation reproducibility · response code");requireAll("program i18n EN key",en.program.lp_repro_p,[/same release, engine, and input/,/protect it as personal data/,/uniqueness/,/human change/,/test-retest reliability/,/validity/,/replay of older releases is not implemented/]);
requireAll("program screen consumes i18n",program,[_tPattern("program.lp_repro_hd"),_tPattern("program.lp_repro_p")]);
function _tPattern(key){return new RegExp("_t\\(['\"]"+key.replaceAll(".","\\.")+"['\"]");}
const reportEnBranch=report.match(/var reproP=isEn\?"([^"]+)":"([^"]+)";/);assert.ok(reportEnBranch,"report IX/X exact KO/EN branch missing");requireAll("report IX/X EN branch",reportEnBranch[1],[/same release, engine, and input/,/protect it as personal data/,/uniqueness/,/human change/,/test-retest reliability/,/validity/,/replay of older releases is not implemented/]);requireAll("report IX/X KO branch",reportEnBranch[2],[/동일 release/,/다른 정보와 결합하면 개인을 알아볼 가능성/,/유일성/,/사람의 변화/,/재검사 신뢰도/,/타당도/,/과거 release 재생성은 아직 구현되지/]);

assert.equal(kit.facts.totalQuestions,56);assert.equal("comboLog10" in kit.facts,false);
assert.equal(kit.topics.find(x=>x.id==="numbers").q,"리포트 X장에 있던 기존 X장 수치는 무슨 뜻인가요?");
for(const topic of ["numbers","ai","code","retest","real"]){
  const entry=kit.topics.find(x=>x.id===topic);assert.ok(entry,`answer-kit missing topic ${topic}`);
  for(const field of ["core","call","mailBody"]){const value=entry[field]||"";forbid(`answer-kit ${topic}.${field}`,value,forbidden);}
}
for(const topic of ["numbers","ai","code"]){const entry=kit.topics.find(x=>x.id===topic);requireAll(`answer-kit ${topic}`,`${entry.call}\n${entry.mailBody}`,[/release/,/재검사 신뢰도|신뢰도/,/타당도/]);}
requireAll("answer-kit code",JSON.stringify(kit.topics.find(x=>x.id==="code")),[/응답 코드/,/다른 정보와 결합하면 개인을 알아볼 가능성/,/개인정보처럼 보호/]);
requireAll("answer-kit retest",JSON.stringify(kit.topics.find(x=>x.id==="retest")),[/응답 코드/,/release/,/측정오차/]);
console.log("P0-A per-surface KO/EN, screen/PDF, i18n, and answer-kit contracts passed");
