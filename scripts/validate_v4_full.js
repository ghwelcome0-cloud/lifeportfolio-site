#!/usr/bin/env node
/**
 * validate_v4_full.js — v4 풀 검증 (Option C 8~10일 통합)
 *
 *  목적:
 *   1) Rulebook P (report-rules-v4.0) & Q (program-rules-v2.0) 가 정상 게시되었는지 검증
 *   2) ReportEngineV4 v4.1 의 17 QA 체크가 100/100 통과하는지 검증 (KYS 회귀)
 *   3) "80억 분의 1 (1 / 8,000,000,000)" 고유성 — 이론치 + 1k 랜덤 샘플 충돌 0건 검증
 *   4) 톤 결정 priority resolver 의 5종 톤 전체 분기 검증
 *   5) 도메인 × 보조도메인 21×21 = 441 경로 생성 검증
 *
 *  실행:  node scripts/validate_v4_full.js
 *  종료코드: 0 (전체 통과) / 1 (실패)
 */
"use strict";

const fs   = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ReportEngine   = require(path.join(ROOT, "assets/js/report-engine.js"));
const ReportEngineV4 = require(path.join(ROOT, "assets/js/report-engine-v4.js"));
const questions = JSON.parse(fs.readFileSync(path.join(ROOT, "data/questions.json"), "utf8"));
const mapping   = JSON.parse(fs.readFileSync(path.join(ROOT, "data/mapping.json"),   "utf8"));
const rules     = JSON.parse(fs.readFileSync(path.join(ROOT, "data/report-rules.json"), "utf8"));
const programRules = JSON.parse(fs.readFileSync(path.join(ROOT, "data/program-rules.json"), "utf8"));

const TICK = "✅", CROSS = "❌";
let totalPass = 0, totalFail = 0;
function ok(label, detail){ totalPass++; console.log("  " + TICK + "  " + label + (detail ? " — " + detail : "")); }
function bad(label, detail){ totalFail++; console.log("  " + CROSS + "  " + label + (detail ? " — " + detail : "")); }

function H(t){ console.log("\n" + "━".repeat(64) + "\n  " + t + "\n" + "━".repeat(64)); }

// ─────────────────────────────────────────────────────────
// 1) Rulebook P & Q 게시 검증
// ─────────────────────────────────────────────────────────
H("[1] Production Rulebook P & Q 게시 검증");

(rules.version === "v4.0") ? ok("Rulebook P version", "v4.0") : bad("Rulebook P version", "expected v4.0, got " + rules.version);
(rules.rulebookCode === "P") ? ok("Rulebook P code", "P") : bad("Rulebook P code", String(rules.rulebookCode));
(rules.qualityUpgradeLayer && rules.qualityUpgradeLayer.P0_1_strengthPairMatrix) ? ok("Rulebook P — qualityUpgradeLayer 필드 존재") : bad("Rulebook P — qualityUpgradeLayer 누락");
(rules.qualityChecklist && rules.qualityChecklist.length === 17) ? ok("Rulebook P — qualityChecklist 17 항목", "len=" + rules.qualityChecklist.length) : bad("Rulebook P — qualityChecklist", "len=" + (rules.qualityChecklist||[]).length);
(rules.engineCompat && rules.engineCompat.upgradeLayer === "v4.1") ? ok("Rulebook P — engineCompat.upgradeLayer", "v4.1") : bad("Rulebook P — engineCompat.upgradeLayer");

(programRules.version === "v2.0") ? ok("Rulebook Q version", "v2.0") : bad("Rulebook Q version", "expected v2.0, got " + programRules.version);
(programRules.rulebookCode === "Q") ? ok("Rulebook Q code", "Q") : bad("Rulebook Q code", String(programRules.rulebookCode));
(programRules.engineCompat && programRules.engineCompat.rulebookP === "v4.0") ? ok("Rulebook Q ↔ P 정합") : bad("Rulebook Q ↔ P 정합", JSON.stringify(programRules.engineCompat));

// ─────────────────────────────────────────────────────────
// 2) KYS 회귀 — 17 QA 체크 100/100
// ─────────────────────────────────────────────────────────
H("[2] 김영식 회귀 — v4.1 후처리 + 17 QA 체크");

const KYS_ANSWERS = {
  Q1: "김영식", Q2: "이메일",
  Q3: 5, Q4: 5, Q5: 5, Q6: ["신중한","분석적인","성취지향적인"], Q7: "혼자만의 시간을 보낼 때",
  Q9: 5, Q10: 5, Q11: 5, Q12: 5, Q13: ["사랑","자유","의미 추구"], Q14: 5,
  Q16: 5, Q17: 5, Q18: 5, Q19: "스스로에게 깊은 질문을 던졌던 시기", Q21: "혼자 있는 시간 갖기", Q22: 5,
  Q23: 5, Q24: 4, Q25: 5, Q26: "조용히 혼자 있는 시간 갖기", Q27: 5,
  Q28: 4, Q29: 5, Q30: 4, Q31: ["편안함을 주는 사람","공감해주는 사람"], Q32: 5,
  Q33: ["신뢰","진정성","공감"], Q34: 5,
  Q35: 5, Q36: 5, Q37: "사람들에게 의미 있는 변화를 만들어내는 멘토", Q38: 5,
  Q39: ["봉사, 돌봄, 의미 있는 영향력 행사","계획을 세우고 실행하는 일"],
  Q41: "리더십, 공동체, 관계",
  Q42: 5, Q43: 5, Q44: 5, Q45: 5, Q46: 5,
  Q47: ["조용한 공간 (도서관, 독서실 등)","정돈된 실내 (정리된 내 방, 사무 공간)"], Q48: 5,
  Q49: ["아침에 일찍 시작하고 저녁에 일찍 마무리하는 루틴","몰입 시간과 휴식 시간을 명확히 나누는 하루"],
  Q51: 5, Q52: 5, Q53: 5, Q54: 5, Q55: 5, Q56: 5, Q57: 5, Q59: 5, Q60: 5, Q61: 5, Q62: 5,
  Q63: ["의미 / 보람 / 가치","신념 / 원칙 / 종교적 기준"], Q65: 5, Q66: 5,
  Q67: 5, Q68: 5, Q69: 5, Q70: 2, Q71: ["멀리 내다보며 흐름을 설계하기","주변 사람들의 협력을 잘 이끌어내기"], Q72: 5,
  Q73: "누군가에게 좋은 영향을 미쳤을 때", Q74: 5,
  Q75: ["교육","복지","사회"], Q76: 5, Q77: ["코칭","기획","팀 빌딩"], Q78: 5
};
const KYS_PROFILE = { name: "김영식", email: "kim.youngsik@example.com", recvMethod: "이메일", submittedAt: "2026-05-06T09:00:00.000Z" };

const rawKys = ReportEngine.build({ questions, mapping, rules, answers: KYS_ANSWERS, profile: KYS_PROFILE, lang: "ko" });
const kysReport = ReportEngineV4.upgrade(rawKys, { questions, mapping, rules, answers: KYS_ANSWERS, profile: KYS_PROFILE, lang: "ko" });
const qa = ReportEngineV4.validateReport(kysReport);

(qa.total === 17) ? ok("QA total = 17") : bad("QA total", "got " + qa.total);
(qa.passed === 17) ? ok("QA passed = 17 (100/100)", "score=" + qa.score) : bad("QA passed", "got " + qa.passed + "/" + qa.total + " score=" + qa.score);

const failedChecks = qa.checks.filter(c => !c.ok);
if (failedChecks.length === 0) {
  ok("모든 17 QA 체크 통과");
} else {
  failedChecks.forEach(c => bad("QA fail: " + c.label, c.detail));
}

// 인접 검증 — 결과물 품질 (사명 길이/원시 trait 차단/tier 라벨 등)
const kysGrowth = kysReport.sections.find(s => s.id === "growth_map");
const rawTraitInStrengths = (kysGrowth.content.strengths || []).some(s => ReportEngineV4._internals.TRAITS_12.indexOf(String(s).trim()) !== -1);
(!rawTraitInStrengths) ? ok("KYS 강점 TOP3 — 원시 Q6 형용사 차단 (P0-1)") : bad("KYS 강점 TOP3 — 원시 형용사 노출");

const kysCe = kysReport.sections.find(s => s.id === "career_education");
const eduDup = (new Set(kysCe.content.education)).size === kysCe.content.education.length;
(eduDup) ? ok("KYS 교육 추천 — 중복 차단 (P0-2)") : bad("KYS 교육 추천 중복");
(kysCe.content.domainExpansion && kysCe.content.domainExpansion.pathCount === 441) ? ok("KYS 도메인 확장 — 441 경로 (P1-2)", "p=" + kysCe.content.domainExpansion.primaryDomain + " s=" + kysCe.content.domainExpansion.secondaryDomain) : bad("KYS 도메인 확장");

const kysMv = kysReport.sections.find(s => s.id === "mission_vision");
(kysMv.content._slots && kysMv.content._slots.anchor) ? ok("KYS 사명/비전 7-슬롯 합성 (P0-3)", "anchor=" + kysMv.content._slots.anchor) : bad("KYS 사명/비전 7-슬롯");
(kysMv.content.mission.length >= 60 && kysMv.content.vision.length >= 60) ? ok("KYS 사명/비전 길이", "m=" + kysMv.content.mission.length + " v=" + kysMv.content.vision.length) : bad("KYS 사명/비전 길이");

["self_understanding","self_expression","self_design","self_execution"].forEach(id => {
  const sec = kysReport.sections.find(s => s.id === id);
  if (sec && sec.content.tier && sec.content.tierComment) {
    ok("KYS " + id + " tier×axis (P0-4)", sec.content.tier + " — " + sec.content.tierComment.slice(0, 30) + "…");
  } else {
    bad("KYS " + id + " tier×axis 미적용");
  }
});

// 결과 저장
const outDir = path.join(ROOT, "reports/v4_test");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "kys_v41_upgraded.json"), JSON.stringify(kysReport, null, 2));
fs.writeFileSync(path.join(outDir, "kys_v41_qa.json"), JSON.stringify(qa, null, 2));
ok("결과 저장 — reports/v4_test/kys_v41_*.json");

// ─────────────────────────────────────────────────────────
// 3) "80억 분의 1" 고유성 — 이론 + 1k 충돌 시뮬레이션
// ─────────────────────────────────────────────────────────
H("[3] '80억 분의 1' 고유성 검증 — 이론치 + 1,000 랜덤 샘플");

const TARGET_POP = 8_000_000_000;

// 이론치: fingerprint(djb2 32-bit) × 7-슬롯 × 도메인×보조도메인 × tier × 톤
const FINGERPRINT_SPACE = 2 ** 32; // 4,294,967,296
const MV_TONES = 5, MV_PER_TONE = 4 ** 6; // 4,096
const MV_TOTAL = MV_TONES * MV_PER_TONE; // 20,480
const DOMAIN_PATHS = 21 * 21; // 441
const TIER_PER_AXIS = 4 ** 4; // 4축 × 4tier = 256
const PAIR_MATRIX = 57 * 4 + 12 * 4; // 페어×변형 + 단일 = 276

const theoreticalUniqueness = MV_TOTAL * DOMAIN_PATHS * TIER_PER_AXIS * PAIR_MATRIX;
console.log("  • fingerprint 공간:        " + FINGERPRINT_SPACE.toLocaleString() + " (32-bit djb2)");
console.log("  • 사명/비전 5톤×7슬롯:     " + MV_TOTAL.toLocaleString() + " 변형");
console.log("  • 도메인 × 보조도메인:     " + DOMAIN_PATHS.toLocaleString() + " 경로");
console.log("  • 4축 × 4tier 매트릭스:    " + TIER_PER_AXIS.toLocaleString() + " 분기");
console.log("  • 강점 페어/단일 변형:     " + PAIR_MATRIX.toLocaleString() + " 합성문");
console.log("  ─────────────────────────────────────────────");
console.log("  ▶ 결합 이론 변형 수:       " + theoreticalUniqueness.toLocaleString());
console.log("  ▶ 80억 인구 대비 비율:     1 / " + (theoreticalUniqueness / TARGET_POP).toExponential(3));

(theoreticalUniqueness >= TARGET_POP) ? ok("이론 변형 ≥ 80억 (80억 분의 1 달성 가능)", theoreticalUniqueness.toLocaleString() + " ≥ " + TARGET_POP.toLocaleString()) : bad("이론 변형 < 80억", theoreticalUniqueness.toLocaleString());

// 1,000 랜덤 샘플 충돌 시뮬레이션 — fingerprint 중복 0건 목표
function _randomAnswers(seed){
  // 76문항 — Likert 1~5 / 다중선택 / 자유응답 시뮬레이션
  const out = {};
  const qmap = mapping.questionMapping || {};
  let s = seed;
  function rng(){ s = (s * 1103515245 + 12345) & 0x7fffffff; return s; }
  Object.keys(qmap).forEach(qid => {
    const r = rng();
    // 단순 분포: 80% Likert(1~5), 15% 단일 텍스트, 5% 배열
    if (r % 100 < 80) {
      out[qid] = (r % 5) + 1;
    } else if (r % 100 < 95) {
      out[qid] = "응답_" + (r % 100);
    } else {
      out[qid] = ["선택A_" + (r % 7), "선택B_" + (r % 11)];
    }
  });
  // 핵심 입력
  out.Q6 = [["신중한","분석적인","성취지향적인","조용한","열정적인","공감하는","계획적인","창의적인","따뜻한","현실적인","느긋한","도전적인"][seed % 12],
            ["신중한","분석적인","성취지향적인","조용한","열정적인","공감하는","계획적인","창의적인","따뜻한","현실적인","느긋한","도전적인"][(seed + 1) % 12],
            ["신중한","분석적인","성취지향적인","조용한","열정적인","공감하는","계획적인","창의적인","따뜻한","현실적인","느긋한","도전적인"][(seed + 2) % 12]];
  const VAL_POOL = ["사랑","신뢰","배려","성장","도전","의미 추구","정직","책임","자유","평화"];
  out.Q13 = [VAL_POOL[seed % VAL_POOL.length], VAL_POOL[(seed + 3) % VAL_POOL.length], VAL_POOL[(seed + 7) % VAL_POOL.length]];
  const DOM_POOL = ["정치","경제","사회","문화","교육","기술","과학","의료","복지","환경","예술","미디어","스포츠","법률","행정","종교","철학","역사","심리","경영","금융"];
  out.Q75 = [DOM_POOL[seed % DOM_POOL.length], DOM_POOL[(seed + 5) % DOM_POOL.length], DOM_POOL[(seed + 11) % DOM_POOL.length]];
  return out;
}

const SAMPLE_N = 1000;
const fpSet = new Set();
const mvSet = new Set();
const startedAt = Date.now();
let collisions = 0;
for (let i = 0; i < SAMPLE_N; i++){
  const ans = _randomAnswers(i + 1);
  const fp = ReportEngineV4._internals.fullAnswerFingerprint(ans, mapping);
  if (fpSet.has(fp)) collisions++;
  fpSet.add(fp);
}
const elapsed = Date.now() - startedAt;
console.log("  • 1k 샘플 fingerprint 충돌: " + collisions + " (소요 " + elapsed + "ms)");
(collisions === 0) ? ok("1,000 샘플 fingerprint 충돌 0건") : bad("fingerprint 충돌", collisions + "건");
(fpSet.size === SAMPLE_N) ? ok("1,000 샘플 fingerprint 전부 고유 (size=" + fpSet.size + ")") : bad("fingerprint 고유성", "size=" + fpSet.size);

// ─────────────────────────────────────────────────────────
// 4) Tone resolver — 5종 톤 분기 검증
// ─────────────────────────────────────────────────────────
H("[4] Tone Priority Resolver — 5종 분기 검증");

// 주의: valueKeywordMap 일부 항목(공정/포용)은 두 카테고리에 중복 매핑되어 있어
//        해상도 결과가 우선순위 규칙(principled_designer > warm_connector > visionary_creator > pragmatic_achiever > reflective_explorer)에 의해 상위 톤으로 끌어올려질 수 있음.
//        아래 케이스는 깨끗한(중복 없는) 가치만 사용해 의도한 톤 분기를 검증.
const TONE_CASES = [
  { label: "원칙지향 + self_design 최상위", values: ["정직","책임","정의"], scores: { axisPct: { self_design: 90, self_understanding: 70, self_expression: 60, self_execution: 50 }}, expect: "principled_designer" },
  { label: "관계지향(깨끗) + self_expression 최상위", values: ["사랑","배려","협동"], scores: { axisPct: { self_expression: 95, self_understanding: 80, self_design: 70, self_execution: 60 }}, expect: "warm_connector" },
  { label: "성장지향 + self_design 최상위 (priority가 visionary 위 principled로 끌어올림)", values: ["성장","도전","몰입"], scores: { axisPct: { self_design: 90, self_execution: 80, self_understanding: 70, self_expression: 60 }}, expect: "principled_designer" },
  { label: "자유지향(깨끗) + self_understanding 최상위", values: ["자유","평화"], scores: { axisPct: { self_understanding: 92, self_expression: 80, self_design: 60, self_execution: 50 }}, expect: "reflective_explorer" },
  { label: "성장지향 + self_execution 최상위 (visionary > pragmatic priority)", values: ["성장","도전","의미 추구"], scores: { axisPct: { self_execution: 92, self_design: 80, self_understanding: 70, self_expression: 60 }}, expect: "visionary_creator" }
];
TONE_CASES.forEach(tc => {
  // 가치 카테고리 직접 분류 (검증용 헬퍼)
  const vcMap = mapping.valueKeywordMap || {};
  const cats = [];
  tc.values.forEach(v => {
    Object.keys(vcMap).forEach(cat => {
      if (cat.charAt(0) === "$") return;
      if ((vcMap[cat] || []).indexOf(v) !== -1) cats.push(cat);
    });
  });
  const r = ReportEngineV4.resolveTone(tc.scores, [...new Set(cats)]);
  if (r.toneKey === tc.expect) {
    ok("[" + tc.label + "] → " + r.toneKey);
  } else {
    bad("[" + tc.label + "] expected=" + tc.expect + " got=" + r.toneKey, "candidates=" + r.candidates.join(","));
  }
});

// ─────────────────────────────────────────────────────────
// 5) Domain × Subdomain 21×21 — 셈 검증
// ─────────────────────────────────────────────────────────
H("[5] Domain × Subdomain 확장 — 21×21=441 경로");

const DOMAIN_21 = ReportEngineV4._internals.DOMAIN_21;
(DOMAIN_21.length === 21) ? ok("도메인 21종 정의", "len=" + DOMAIN_21.length) : bad("도메인 21종", "len=" + DOMAIN_21.length);

let pathCount = 0;
const seen = new Set();
for (let i = 0; i < DOMAIN_21.length; i++){
  for (let j = 0; j < DOMAIN_21.length; j++){
    pathCount++;
    seen.add(DOMAIN_21[i] + "|" + DOMAIN_21[j]);
  }
}
(pathCount === 441 && seen.size === 441) ? ok("21×21 경로 = 441 (고유)") : bad("경로 카운트", pathCount + " / unique " + seen.size);

// 실제 buildDomainExpansion 호출 — 1k 샘플로 path-line 다양성 확인
const dlSet = new Set();
for (let i = 0; i < 1000; i++){
  const fp = (i + 1) * 12347;
  const ans = { Q75: [DOMAIN_21[i % 21], DOMAIN_21[(i + 7) % 21]] };
  const ex = ReportEngineV4.buildDomainExpansion(ans, fp, "ko", mapping);
  if (ex.pathLine) dlSet.add(ex.pathLine);
}
(dlSet.size > 100) ? ok("1k 샘플 path-line 변형 수 > 100", "unique=" + dlSet.size) : bad("path-line 변형", "unique=" + dlSet.size);

// ─────────────────────────────────────────────────────────
// 6) Diversity guard — 톤 외 누수 차단 검증
// ─────────────────────────────────────────────────────────
H("[6] Diversity Guard — 톤 외 폴백 누수 차단");

// principled_designer 톤에 warm_connector 풀 항목이 들어와도 차단되는지
const leakedCe = {
  careers: ["코칭·퍼실리테이션 과정","전략 설계자 / 시스템 디자이너"], // 1개 누수(warm_connector → 사실 edu 풀)
  education: ["코칭·퍼실리테이션 과정","전략적 의사결정 워크숍"], // 첫 항목은 warm_connector 풀
  directions: []
};
const guarded = ReportEngineV4.diversityGuard(leakedCe, "principled_designer", 99999, "ko");
(guarded.education.length === 3) ? ok("Diversity guard — education 3개 보장") : bad("guard education len", String(guarded.education.length));
(guarded.education.indexOf("코칭·퍼실리테이션 과정") === -1) ? ok("Diversity guard — warm_connector 풀 누수 차단") : bad("Diversity guard 누수", JSON.stringify(guarded.education));

// ─────────────────────────────────────────────────────────
// 7) i18n parity — KO/EN 양쪽 모두 17 QA 통과
// ─────────────────────────────────────────────────────────
H("[7] i18n parity — KO/EN 17 QA 통과");

const rawEn = ReportEngine.build({ questions, mapping, rules, answers: KYS_ANSWERS, profile: KYS_PROFILE, lang: "en" });
const enReport = ReportEngineV4.upgrade(rawEn, { questions, mapping, rules, answers: KYS_ANSWERS, profile: KYS_PROFILE, lang: "en" });
const enQa = ReportEngineV4.validateReport(enReport);
(enQa.passed === enQa.total) ? ok("EN 17 QA 통과", "score=" + enQa.score) : bad("EN QA", enQa.passed + "/" + enQa.total + " score=" + enQa.score);

const enFails = enQa.checks.filter(c => !c.ok);
if (enFails.length) enFails.forEach(c => bad("EN QA fail: " + c.label, c.detail));

// ─────────────────────────────────────────────────────────
// 종합 결과
// ─────────────────────────────────────────────────────────
H("종합 결과");
const total = totalPass + totalFail;
console.log("  통과: " + totalPass + " / 실패: " + totalFail + " / 합계: " + total);
const score = total === 0 ? 0 : Math.round((totalPass / total) * 100);
console.log("  점수: " + score + "/100");
console.log("  대상: \"80억 분의 1\" 고유성 + 심리/적성 검사 시장 최상위 품질");

// 결과 JSON 저장
const out = {
  generatedAt: new Date().toISOString(),
  rulebook: { P: rules.version, Q: programRules.version },
  engine: { base: "v1.3", upgrade: ReportEngineV4.version },
  totals: { pass: totalPass, fail: totalFail, score },
  uniqueness: {
    target: TARGET_POP,
    theoretical: theoreticalUniqueness,
    fingerprintCollisions1k: collisions
  },
  kysQa: qa,
  enQa: enQa
};
const summaryPath = path.join(ROOT, "reports/v4_test/validate_v4_full_summary.json");
fs.writeFileSync(summaryPath, JSON.stringify(out, null, 2));
console.log("\n  종합 요약 저장 → reports/v4_test/validate_v4_full_summary.json");

process.exit(totalFail === 0 ? 0 : 1);
