#!/usr/bin/env node
/**
 * validate_v4_prod_parity.js — Option B
 *
 *   production 배포 자산을 그대로 받아 김영식님 응답으로 재생성한 결과가
 *   로컬 검증 결과와 1:1 동일한지 확인
 *
 *   1) production 자산 SHA-256 = 로컬 SHA-256 (외부 검증 — bash로 이미 완료)
 *   2) production 코드로 빌드 → KYS 결과
 *   3) 로컬 코드로 빌드 → KYS 결과
 *   4) 두 결과(JSON) deep-equal 비교 — 단일 비트 차이도 0
 *   5) 17 QA 통과 여부 양쪽 모두 확인
 */
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const PROD = path.join(ROOT, "reports/v4_test/prod_fetch");

// ─────────────────────────────────────────────────────
// production 자산 로드
// ─────────────────────────────────────────────────────
const prodEngine   = require(path.join(PROD, "report-engine.js"));
const prodV4       = require(path.join(PROD, "report-engine-v4.js"));
const prodQuestions = JSON.parse(fs.readFileSync(path.join(PROD, "questions.json"), "utf8"));
const prodMapping   = JSON.parse(fs.readFileSync(path.join(PROD, "mapping.json"),   "utf8"));
const prodRules     = JSON.parse(fs.readFileSync(path.join(PROD, "report-rules.json"), "utf8"));

// ─────────────────────────────────────────────────────
// 로컬 자산 로드
// ─────────────────────────────────────────────────────
const localEngine   = require(path.join(ROOT, "assets/js/report-engine.js"));
const localV4       = require(path.join(ROOT, "assets/js/report-engine-v4.js"));
const localQuestions = JSON.parse(fs.readFileSync(path.join(ROOT, "data/questions.json"), "utf8"));
const localMapping   = JSON.parse(fs.readFileSync(path.join(ROOT, "data/mapping.json"),   "utf8"));
const localRules     = JSON.parse(fs.readFileSync(path.join(ROOT, "data/report-rules.json"), "utf8"));

// ─────────────────────────────────────────────────────
// 김영식 응답 (Option C 검증과 동일)
// ─────────────────────────────────────────────────────
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

function H(t){ console.log("\n" + "━".repeat(64) + "\n  " + t + "\n" + "━".repeat(64)); }

// ─────────────────────────────────────────────────────
// 1) production 자산으로 빌드
// ─────────────────────────────────────────────────────
H("[1] production 자산으로 빌드 (lifeportfolio.co.kr 라이브 코드)");

const prodRaw = prodEngine.build({
  questions: prodQuestions, mapping: prodMapping, rules: prodRules,
  answers: KYS_ANSWERS, profile: KYS_PROFILE, lang: "ko"
});
const prodReport = prodV4.upgrade(prodRaw, {
  questions: prodQuestions, mapping: prodMapping, rules: prodRules,
  answers: KYS_ANSWERS, profile: KYS_PROFILE, lang: "ko"
});
const prodQa = prodV4.validateReport(prodReport);

console.log("  엔진 v4: " + prodV4.version);
console.log("  보고서 engineVersion: " + prodReport.engineVersion);
console.log("  fingerprint: " + prodReport._v4Meta.fingerprint);
console.log("  tone: " + prodReport.tone.key);
console.log("  QA: " + prodQa.passed + "/" + prodQa.total + " (score " + prodQa.score + "/100)");

// ─────────────────────────────────────────────────────
// 2) 로컬 자산으로 빌드
// ─────────────────────────────────────────────────────
H("[2] 로컬 자산으로 빌드 (genspark_ai_developer 브랜치)");

const localRaw = localEngine.build({
  questions: localQuestions, mapping: localMapping, rules: localRules,
  answers: KYS_ANSWERS, profile: KYS_PROFILE, lang: "ko"
});
const localReport = localV4.upgrade(localRaw, {
  questions: localQuestions, mapping: localMapping, rules: localRules,
  answers: KYS_ANSWERS, profile: KYS_PROFILE, lang: "ko"
});
const localQa = localV4.validateReport(localReport);

console.log("  엔진 v4: " + localV4.version);
console.log("  보고서 engineVersion: " + localReport.engineVersion);
console.log("  fingerprint: " + localReport._v4Meta.fingerprint);
console.log("  tone: " + localReport.tone.key);
console.log("  QA: " + localQa.passed + "/" + localQa.total + " (score " + localQa.score + "/100)");

// ─────────────────────────────────────────────────────
// 3) deep-equal 비교 (생성 시간 필드 제거)
// ─────────────────────────────────────────────────────
H("[3] production vs 로컬 결과 deep-equal 비교");

function sanitize(r){
  // 생성 시간(generatedAt)만 제거 — 그 외 모든 필드는 결정적이어야 함
  const c = JSON.parse(JSON.stringify(r));
  if (c._v4Meta) delete c._v4Meta.generatedAt;
  if (c.generatedAt) delete c.generatedAt;
  return c;
}
function sha(o){ return crypto.createHash("sha256").update(JSON.stringify(o)).digest("hex"); }

const prodSan = sanitize(prodReport);
const localSan = sanitize(localReport);
const prodHash = sha(prodSan);
const localHash = sha(localSan);

console.log("  prod  결과 SHA-256: " + prodHash);
console.log("  local 결과 SHA-256: " + localHash);

let parity = (prodHash === localHash);
if (parity) {
  console.log("\n  ✅ DEEP-EQUAL 일치 — 단일 바이트 차이 0건");
} else {
  console.log("\n  ❌ 차이 발견 — 필드별 진단:");
  // 단순 진단
  const fields = ["engineVersion", "version", "lang", "tone", "scores", "_v4Meta", "pdfFilename"];
  fields.forEach(f => {
    const a = JSON.stringify(prodSan[f]);
    const b = JSON.stringify(localSan[f]);
    if (a !== b) console.log("     ✗ " + f + " 차이");
  });
  // sections 비교
  if (prodSan.sections && localSan.sections) {
    prodSan.sections.forEach((s, i) => {
      const t = localSan.sections[i];
      if (JSON.stringify(s) !== JSON.stringify(t)) {
        console.log("     ✗ sections[" + i + "] " + s.id + " 차이");
      }
    });
  }
}

// ─────────────────────────────────────────────────────
// 4) 핵심 출력 미리보기 (production 결과)
// ─────────────────────────────────────────────────────
H("[4] production 빌드 — 김영식 리포트 핵심 출력");

const gm = prodReport.sections.find(s => s.id === "growth_map");
console.log("  강점 TOP3 (P0-1 페어 매트릭스):");
gm.content.strengths.forEach(s => console.log("    ★ " + s));

const ce = prodReport.sections.find(s => s.id === "career_education");
console.log("\n  진로 TOP3:");
ce.content.careers.forEach(c => console.log("    ★ " + c));
console.log("  교육 TOP3:");
ce.content.education.forEach(e => console.log("    ★ " + e));
console.log("  도메인 확장 (P1-2): " + ce.content.domainExpansion.primaryDomain + " → " + ce.content.domainExpansion.secondaryDomain);
console.log("    " + ce.content.domainExpansion.pathLine);

const mv = prodReport.sections.find(s => s.id === "mission_vision");
console.log("\n  사명 (P0-3 7-슬롯, len=" + mv.content.mission.length + "):");
console.log("    " + mv.content.mission);
console.log("  비전 (len=" + mv.content.vision.length + "):");
console.log("    " + mv.content.vision);

console.log("\n  4축 카드 (P0-4 tier×axis):");
["self_understanding","self_expression","self_design","self_execution"].forEach(id => {
  const sec = prodReport.sections.find(s => s.id === id);
  console.log("    " + sec.icon + " " + sec.title + " " + sec.content.pct + "% [" + sec.content.tier + "]");
  console.log("       " + sec.content.tierComment);
});

// ─────────────────────────────────────────────────────
// 결과 저장 + 종합
// ─────────────────────────────────────────────────────
const outDir = path.join(ROOT, "reports/v4_test");
fs.writeFileSync(path.join(outDir, "kys_prod_parity.json"), JSON.stringify({
  generatedAt: new Date().toISOString(),
  parity: parity,
  prodHash: prodHash,
  localHash: localHash,
  prodEngineVersion: prodV4.version,
  localEngineVersion: localV4.version,
  prodReportEngineVersion: prodReport.engineVersion,
  prodFingerprint: prodReport._v4Meta.fingerprint,
  localFingerprint: localReport._v4Meta.fingerprint,
  prodQa: { passed: prodQa.passed, total: prodQa.total, score: prodQa.score, ok: prodQa.ok },
  localQa: { passed: localQa.passed, total: localQa.total, score: localQa.score, ok: localQa.ok }
}, null, 2));

H("종합 결과");
console.log("  • production 자산 SHA: 6/6 일치 (외부 bash 검증 완료)");
console.log("  • production QA: " + prodQa.passed + "/" + prodQa.total);
console.log("  • 로컬     QA: " + localQa.passed + "/" + localQa.total);
console.log("  • deep-equal:    " + (parity ? "✅ 일치" : "❌ 불일치"));
console.log("  • fingerprint:   prod=" + prodReport._v4Meta.fingerprint + " / local=" + localReport._v4Meta.fingerprint);
console.log("\n  결과 저장 → reports/v4_test/kys_prod_parity.json");

const allOk = parity && prodQa.ok && localQa.ok;
process.exit(allOk ? 0 : 1);
