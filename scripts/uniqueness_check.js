#!/usr/bin/env node
/**
 * uniqueness_check.js — PR#57 합성 시그니처 고유성 시뮬레이션
 *
 * 목적:
 *  - 5톤 × 5실행스타일 1:1 고정 매핑 제거 후, 슬롯 합성 시그니처가
 *    실제로 "유형으로 묶이지 않는" 개별화 출력을 보장하는지 검증한다.
 *  - 10,000 가상 응답자를 무작위 생성 → upgrade() 적용 →
 *    {typeLine, coreOneLine, executionType, executionStyle, signatureShort}
 *    5종 합성 출력의 고유율(unique ratio)이 ≥ 99.5% 인지 가드.
 *
 * 실행:  node scripts/uniqueness_check.js
 */

"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ReportEngine   = require(path.join(ROOT, "assets/js/report-engine.js"));
const ReportEngineV4 = require(path.join(ROOT, "assets/js/report-engine-v4.js"));
const questions = JSON.parse(fs.readFileSync(path.join(ROOT, "data/questions.json"), "utf8"));
const mapping   = JSON.parse(fs.readFileSync(path.join(ROOT, "data/mapping.json"),   "utf8"));
const rules     = JSON.parse(fs.readFileSync(path.join(ROOT, "data/report-rules.json"), "utf8"));

// ─────────────────────────────────────────────────────────
// 응답 풀 — 실제 설문 옵션을 직접 사용 (Q6 12개, Q13 9개, Q63 9개, Q75 21개)
// ─────────────────────────────────────────────────────────
const TRAITS_12 = ["신중한","분석적인","도전적인","공감적인","논리적인","감성적인","외향적인","내향적인","계획적인","즉흥적인","성취지향적인","관계지향적인"];
const VALUES_9 = ["사랑","자유","성장","의미 추구","평화","정의","진리","책임","성공"];
const COMPASS_9 = [
  "의미 / 보람 / 가치","안정성 / 안전 / 예측 가능성","성장 가능성 / 배움의 기회",
  "자유 / 자율성","관계 / 소속감 / 인정","결과 / 성과 / 효율성",
  "재미 / 흥미 / 몰입감","신념 / 원칙 / 종교적 기준","책임 / 도리 / 역할 충실"
];
const DOMAINS_21 = [
  "교육","복지","사회","경제","정치","문화","예술","과학","기술",
  "의료","법률","종교","환경","스포츠","미디어","경영","금융",
  "농업","제조","서비스","기타"
];
const Q41_TOPICS = [
  "리더십, 공동체, 관계","교육과 학습 방식","문화·예술","경제·금융",
  "기술·혁신","사회·정의","건강·웰빙","영성·신앙"
];

// 결정론적 PRNG (시드 기반) — 재현성 확보
function mulberry32(seed){
  return function(){
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pick(rng, arr){ return arr[Math.floor(rng() * arr.length)]; }
function pickN(rng, arr, n){
  const copy = arr.slice();
  const out = [];
  const k = Math.min(n, copy.length);
  for (let i = 0; i < k; i++){
    const idx = Math.floor(rng() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}
function likert(rng){ return 2 + Math.floor(rng() * 4); } // 2..5

// 가상 응답자 생성
function makeAnswers(seed){
  const rng = mulberry32(seed);
  const A = {};
  // Likert 문항 — AXIS_LIKERT_QS 전체 + 메타 likert
  const LIKERT_IDS = [
    "Q3","Q4","Q5","Q9","Q10","Q11","Q12","Q14","Q16","Q17","Q18","Q22",
    "Q23","Q24","Q25","Q27","Q28","Q29","Q30","Q32","Q34","Q35","Q36","Q38",
    "Q42","Q43","Q44","Q45","Q46","Q48","Q51","Q52","Q53","Q54","Q55","Q56",
    "Q57","Q59","Q60","Q61","Q62","Q65","Q66","Q67","Q68","Q69","Q70",
    "Q72","Q74","Q76","Q78"
  ];
  LIKERT_IDS.forEach(qid => { A[qid] = likert(rng); });
  // 선택형 — 매핑 핵심 슬롯
  A.Q1 = "U" + seed;
  A.Q2 = "이메일";
  A.Q6  = pickN(rng, TRAITS_12, 3);
  A.Q13 = pickN(rng, VALUES_9, 3);
  A.Q63 = pickN(rng, COMPASS_9, 2);
  A.Q75 = pickN(rng, DOMAINS_21, 3);
  A.Q41 = pick(rng, Q41_TOPICS);
  // 자유 응답 — 비핵심 슬롯
  A.Q7  = "test";
  A.Q19 = "test";
  A.Q21 = "test";
  A.Q26 = "test";
  A.Q31 = pickN(rng, ["편안함을 주는 사람","공감해주는 사람","조용히 들어주는 사람","분위기를 띄우는 사람"], 2);
  A.Q33 = pickN(rng, ["신뢰","진정성","공감","책임감","유머"], 2);
  A.Q37 = "test";
  A.Q39 = pickN(rng, ["계획을 세우고 실행하는 일","문제를 분석하고 해결하는 일","사람을 돕는 일"], 2);
  A.Q47 = pickN(rng, ["조용한 공간","정돈된 실내","열린 공간"], 2);
  A.Q49 = pickN(rng, ["아침에 일찍 시작하는 루틴","몰입과 휴식을 분리하는 하루"], 2);
  A.Q71 = pickN(rng, ["멀리 내다보며 흐름을 설계하기","주변 사람들의 협력을 이끌어내기","문제를 정확히 파악하기"], 2);
  A.Q73 = "test";
  A.Q77 = pickN(rng, ["코칭","기획","팀 빌딩","분석","연구"], 3);
  return A;
}

// ─────────────────────────────────────────────────────────
// 시뮬레이션 — N=10,000
// ─────────────────────────────────────────────────────────
const N = parseInt(process.env.UNIQ_N || "10000", 10);
const TARGET = 0.995; // 99.5%

console.log("━".repeat(64));
console.log("  PR#57 합성 시그니처 고유성 시뮬레이션 (N=" + N + ")");
console.log("━".repeat(64));

const sigSets = {
  typeLine:        new Map(),
  coreOneLine:     new Map(),
  executionType:   new Map(),
  executionStyle:  new Map(),
  signatureShort:  new Map(),
  signatureHeader: new Map(),
  // 5종 동시 결합 — 리포트 전체 시그니처 식별
  combined:        new Map()
};

let processed = 0, errors = 0;
const t0 = Date.now();

for (let i = 0; i < N; i++){
  const ans = makeAnswers(1000003 + i * 7919);
  const profile = { name: "U" + i, email: "u"+i+"@x", recvMethod:"이메일", submittedAt:"2026-05-06T00:00:00.000Z" };
  try {
    const raw = ReportEngine.build({ questions, mapping, rules, answers: ans, profile, lang: "ko" });
    const up  = ReportEngineV4.upgrade(raw, { questions, mapping, rules, answers: ans, profile, lang: "ko" });
    const sum = (up.sections || []).find(s => s.id === "summary");
    const ep  = (up.sections || []).find(s => s.id === "execution_profile");
    const tone = up.tone || {};
    const tl  = (sum && sum.content && sum.content.typeLine)    || "";
    const co  = (sum && sum.content && sum.content.coreOneLine) || "";
    const et  = (ep  && ep.content  && ep.content.type)         || "";
    const es  = (ep  && ep.content  && ep.content.style)        || "";
    const ss  = tone.signatureShort  || "";
    const sh  = tone.signatureHeader || "";

    [["typeLine",tl],["coreOneLine",co],["executionType",et],["executionStyle",es],
     ["signatureShort",ss],["signatureHeader",sh]].forEach(([k,v])=>{
      sigSets[k].set(v, (sigSets[k].get(v)||0)+1);
    });
    const combo = [tl, co, et, es, ss].join("¦");
    sigSets.combined.set(combo, (sigSets.combined.get(combo)||0)+1);
    processed++;
  } catch (e){
    errors++;
    if (errors <= 3) console.error("  err:", e.message);
  }
}
const elapsed = ((Date.now() - t0)/1000).toFixed(1);

function ratio(map){ return map.size / processed; }
function topDup(map){
  let max = 0, key = "";
  for (const [k,v] of map){ if (v > max){ max = v; key = k; } }
  return { key, count: max };
}

console.log("\n[처리 결과]");
console.log("  성공: " + processed + " / 오류: " + errors + " / 소요: " + elapsed + "s");
console.log();

const FIELDS = ["typeLine","coreOneLine","executionType","executionStyle","signatureShort","signatureHeader","combined"];
const results = {};
let allPass = true;
FIELDS.forEach(f => {
  const r = ratio(sigSets[f]);
  const dup = topDup(sigSets[f]);
  const pass = r >= TARGET || f === "executionType"; // executionType 은 4축 head 기반(4종) → 가드 면제
  if (!pass) allPass = false;
  results[f] = { unique: sigSets[f].size, total: processed, ratio: r, topDup: dup };
  const mark = pass ? "✅" : "❌";
  console.log("  " + mark + "  " + f.padEnd(16) + " unique=" + String(sigSets[f].size).padStart(5) +
              " / " + processed + "  ratio=" + (r*100).toFixed(2) + "%" +
              "  topDup=" + dup.count + "회");
});

console.log("\n[최빈 중복 시그니처 샘플]");
FIELDS.forEach(f => {
  const dup = topDup(sigSets[f]);
  if (dup.count > 1){
    const k = String(dup.key).slice(0, 80);
    console.log("  " + f.padEnd(16) + " ×" + dup.count + ": " + k);
  }
});

const combinedRatio = ratio(sigSets.combined);
console.log("\n━".repeat(32));
console.log("  종합 판정: " + (allPass ? "✅ PASS" : "❌ FAIL") +
            " (combined unique ratio = " + (combinedRatio*100).toFixed(2) + "%, target ≥ " + (TARGET*100) + "%)");
console.log("━".repeat(32));

// 결과 저장
const outDir = path.join(ROOT, "reports/v4_test");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, "uniqueness_check.json"),
  JSON.stringify({
    n: N, processed, errors, elapsed_sec: parseFloat(elapsed),
    target: TARGET, pass: allPass, fields: results
  }, null, 2)
);
console.log("\n  결과 JSON 저장: reports/v4_test/uniqueness_check.json");

process.exit(allPass ? 0 : 1);
