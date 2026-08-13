#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const files=["report.html","assets/i18n/ko.json","assets/i18n/en.json","data/answer-kit.json"];
const surfaces=[...files,"program.html"];
const text=surfaces.map(f=>fs.readFileSync(f,"utf8")).join("\n");
for(const [label,pattern] of [
  ["unsupported response-space claim",/10\^5[38]|comboLog10/],
  ["all responses contribute to every output",/네 영역 지수와 사명·비전, 고유코드가 모두 그 응답에서 계산|문항 전부가 네 영역 지수와 사명·비전, 고유코드 계산에 쓰|Every index, your mission and vision, and your unique code are calculated/i],
  ["code difference proves human change",/코드가 다르.*당신이 변|code.*(?:proves|record).*you.*changed/i],
]) assert.doesNotMatch(text,pattern,label);
for(const pattern of [/당신만의 고유 코드|고객님의 고유코드|나의 고유코드|your own code|unique identifier/i]) assert.doesNotMatch(text,pattern,"unique-code claim remains on a customer surface");
for(const required of [
  "56개 핵심 문항",
  "최대 20개 조건부 입력",
  "2개 메타 항목",
  "형성형 참고 지수",
  "재검사 신뢰도",
  "release 보존·과거 버전 재생성은 아직 구현되지 않았습니다",
]) assert.ok(text.includes(required),`missing disclosure: ${required}`);
for(const surface of ["report.html","program.html","data/answer-kit.json"]){const body=fs.readFileSync(surface,"utf8");assert.match(body,/응답 코드|response code/i,`${surface}: response-code label missing`);assert.match(body,/동일 release|same release/i,`${surface}: release-scoped determinism missing`);}
assert.match(fs.readFileSync("program.html","utf8"),/가명 식별자/);
const kit=JSON.parse(fs.readFileSync("data/answer-kit.json","utf8"));
assert.equal(kit.facts.totalQuestions,56);
assert.equal("comboLog10" in kit.facts,false);
console.log("P0-A IX/X and answer-kit disclosure contract passed");
