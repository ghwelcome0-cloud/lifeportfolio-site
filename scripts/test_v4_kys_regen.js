#!/usr/bin/env node
/**
 * test_v4_kys_regen.js — 김영식님 리포트 v4 재생성 검증 스크립트
 *
 * 목적:
 *  - 오늘(2026-05-06) 검사로 산출된 김영식님 리포트가 v4 후처리 적용 시
 *    어떻게 개선되는지 비교
 *  - 12개 자동 품질검증 항목 모두 통과하는지 검증
 *  - "80억 분의 1" 가능성 — fingerprint 변동성 시뮬레이션
 *
 * 실행:  node scripts/test_v4_kys_regen.js
 */

"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ReportEngine = require(path.join(ROOT, "assets/js/report-engine.js"));
const ReportEngineV4 = require(path.join(ROOT, "assets/js/report-engine-v4.js"));
const questions = JSON.parse(fs.readFileSync(path.join(ROOT, "data/questions.json"), "utf8"));
const mapping   = JSON.parse(fs.readFileSync(path.join(ROOT, "data/mapping.json"),   "utf8"));
const rules     = JSON.parse(fs.readFileSync(path.join(ROOT, "data/report-rules.json"), "utf8"));

// ─────────────────────────────────────────────────────────
// 김영식님 응답 — 오늘 검사(2026-05-06) PDF K/L 에서 추출한 입력 시뮬레이션
//   * 오늘 산출된 리포트 결과:
//     - 자기이해 97% / 자기표현 87% / 자기설계 96% / 자기실행 96%
//     - 톤: warm_connector (관계 중심의 따뜻한 연결자)
//     - Q6 성향: 신중한 / 분석적인 / 성취지향적인
//     - Q13 가치: 사랑·자유·의미 추구 (관계+자유)
//     - Q41 열정 주제: 리더십, 공동체, 관계
//     - Q75 관심 분야: 교육·복지·사회
// ─────────────────────────────────────────────────────────
const KYS_ANSWERS = {
  // 메타
  Q1: "김영식",
  Q2: "이메일",

  // 자기인식 — 모두 5(매우 그렇다) 수준
  Q3: 5, Q4: 5, Q5: 5,
  Q6: ["신중한","분석적인","성취지향적인"],
  Q7: "혼자만의 시간을 보낼 때",

  // 가치·신념
  Q9: 5, Q10: 5, Q11: 5,
  Q12: 5,
  Q13: ["사랑","자유","의미 추구"],
  Q14: 5,

  // 성장 경험
  Q16: 5, Q17: 5, Q18: 5, Q19: "스스로에게 깊은 질문을 던졌던 시기",
  Q21: "혼자 있는 시간 갖기",
  Q22: 5,

  // 감정·표현
  Q23: 5, Q24: 4, Q25: 5,
  Q26: "조용히 혼자 있는 시간 갖기",
  Q27: 5,
  Q28: 4, Q29: 5, Q30: 4,
  Q31: ["편안함을 주는 사람","공감해주는 사람"],
  Q32: 5,
  Q33: ["신뢰","진정성","공감"],
  Q34: 5,

  // 몰입·동기
  Q35: 5, Q36: 5,
  Q37: "사람들에게 의미 있는 변화를 만들어내는 멘토",
  Q38: 5,
  Q39: ["봉사, 돌봄, 의미 있는 영향력 행사","계획을 세우고 실행하는 일"],
  Q41: "리더십, 공동체, 관계",
  Q42: 5, Q43: 5, Q44: 5, Q45: 5, Q46: 5,
  Q47: ["조용한 공간 (도서관, 독서실 등)","정돈된 실내 (정리된 내 방, 사무 공간)"],
  Q48: 5,
  Q49: ["아침에 일찍 시작하고 저녁에 일찍 마무리하는 루틴","몰입 시간과 휴식 시간을 명확히 나누는 하루"],

  // 실행
  Q51: 5, Q52: 5, Q53: 5, Q54: 5,
  Q55: 5, Q56: 5, Q57: 5,
  Q59: 5, Q60: 5, Q61: 5, Q62: 5,
  Q63: ["의미 / 보람 / 가치","신념 / 원칙 / 종교적 기준"],
  Q65: 5, Q66: 5,
  Q67: 5, Q68: 5, Q69: 5,
  Q70: 2, // reverse 문항
  Q71: ["멀리 내다보며 흐름을 설계하기","주변 사람들의 협력을 잘 이끌어내기"],
  Q72: 5,
  Q73: "누군가에게 좋은 영향을 미쳤을 때",
  Q74: 5,

  // 진로·관심
  Q75: ["교육","복지","사회"],
  Q76: 5,
  Q77: ["코칭","기획","팀 빌딩"],
  Q78: 5
};

const KYS_PROFILE = {
  name: "김영식",
  email: "kim.youngsik@example.com",
  recvMethod: "이메일",
  submittedAt: "2026-05-06T09:00:00.000Z"
};

// ─────────────────────────────────────────────────────────
// 1) v1.3 raw 빌드
// ─────────────────────────────────────────────────────────
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("  김영식님 리포트 v4 재생성 검증");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

const rawReport = ReportEngine.build({
  questions, mapping, rules,
  answers: KYS_ANSWERS,
  profile: KYS_PROFILE,
  lang: "ko"
});

console.log("[v1.3 raw 결과]");
console.log("  톤: " + rawReport.tone.key + " (" + rawReport.tone.label + ")");
console.log("  4축 점수:");
console.log("    자기이해 " + Math.round(rawReport.scores.axisPct.self_understanding) + "%");
console.log("    자기표현 " + Math.round(rawReport.scores.axisPct.self_expression) + "%");
console.log("    자기설계 " + Math.round(rawReport.scores.axisPct.self_design) + "%");
console.log("    자기실행 " + Math.round(rawReport.scores.axisPct.self_execution) + "%");

const rawGrowth = rawReport.sections.find(s => s.id === "growth_map");
console.log("\n  [v1.3] 강점 TOP3:");
rawGrowth.content.strengths.forEach(s => console.log("    - " + s));

const rawCe = rawReport.sections.find(s => s.id === "career_education");
console.log("\n  [v1.3] 추천 진로 3개:");
rawCe.content.careers.forEach(c => console.log("    - " + c));
console.log("\n  [v1.3] 추천 교육 3개:");
rawCe.content.education.forEach(e => console.log("    - " + e));

const rawMv = rawReport.sections.find(s => s.id === "mission_vision");
console.log("\n  [v1.3] 사명: " + rawMv.content.mission);
console.log("  [v1.3] 비전: " + rawMv.content.vision);

// ─────────────────────────────────────────────────────────
// 2) v4 upgrade 적용
// ─────────────────────────────────────────────────────────
console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

const v4Report = ReportEngineV4.upgrade(rawReport, {
  questions, mapping, rules,
  answers: KYS_ANSWERS,
  profile: KYS_PROFILE,
  lang: "ko"
});

console.log("[v4 upgrade 결과]");
console.log("  engineVersion: " + v4Report.engineVersion);
console.log("  fingerprint: " + (v4Report._v4Meta && v4Report._v4Meta.fingerprint));

const v4Growth = v4Report.sections.find(s => s.id === "growth_map");
console.log("\n  [v4] 강점 TOP3 (페어 해석 매트릭스 적용):");
v4Growth.content.strengths.forEach(s => console.log("    ★ " + s));

const v4Ce = v4Report.sections.find(s => s.id === "career_education");
console.log("\n  [v4] 추천 진로 3개 (다양화):");
v4Ce.content.careers.forEach(c => console.log("    ★ " + c));
console.log("\n  [v4] 추천 교육 3개 (중복 차단):");
v4Ce.content.education.forEach(e => console.log("    ★ " + e));
console.log("\n  [v4] 추천 확장 방향 3개:");
v4Ce.content.directions.forEach(d => console.log("    ★ " + d));

const v4Mv = v4Report.sections.find(s => s.id === "mission_vision");
console.log("\n  [v4] 사명 (7-슬롯 합성):");
console.log("    ★ " + v4Mv.content.mission);
console.log("\n  [v4] 비전 (7-슬롯 합성):");
console.log("    ★ " + v4Mv.content.vision);
if (v4Mv.content._slots) {
  console.log("    슬롯: anchor='" + v4Mv.content._slots.anchor + "' / verb='" + v4Mv.content._slots.verb + "' / target='" + v4Mv.content._slots.target + "' / essence='" + v4Mv.content._slots.essence + "'");
}

console.log("\n  [v4] 4축 카드 tier 분기:");
["self_understanding","self_expression","self_design","self_execution"].forEach(id => {
  const sec = v4Report.sections.find(s => s.id === id);
  if (sec) {
    console.log("    - " + id + ": " + sec.content.pct + "% [" + sec.content.tier + "] " + sec.content.tierLabel);
    console.log("      closer: " + (sec.content.closerLine || "(없음)"));
  }
});

// ─────────────────────────────────────────────────────────
// 3) 자동 품질검증 실행
// ─────────────────────────────────────────────────────────
console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("[자동 품질검증 12 항목]");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

const qa = ReportEngineV4.validateReport(v4Report);
qa.checks.forEach((c, i) => {
  const mark = c.ok ? "✅" : "❌";
  console.log("  " + mark + "  [" + (i+1).toString().padStart(2,"0") + "] " + c.label + (c.detail ? " (" + c.detail + ")" : ""));
});

console.log("\n  ═══ 종합: " + qa.passed + "/" + qa.total + " 통과 (점수 " + qa.score + "/100) ═══");

// ─────────────────────────────────────────────────────────
// 4) 80억 분의 1 시뮬레이션 — 응답 1개만 바꿔도 fingerprint 변동
// ─────────────────────────────────────────────────────────
console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("[\"80억 분의 1\" Fingerprint 변동성 시뮬레이션]");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

const fp0 = ReportEngineV4._internals.fullAnswerFingerprint(KYS_ANSWERS, mapping);
console.log("  baseline fingerprint: " + fp0);

// Q3 점수 5 → 4 변경
const v1 = Object.assign({}, KYS_ANSWERS, { Q3: 4 });
const fp1 = ReportEngineV4._internals.fullAnswerFingerprint(v1, mapping);
console.log("  Q3 5→4 변경 시:       " + fp1 + "  (delta: " + (fp1 !== fp0 ? "✓ 다름" : "✗ 동일") + ")");

// Q6 추가 selection
const v2 = Object.assign({}, KYS_ANSWERS, { Q6: ["신중한","분석적인","열정적인"] });
const fp2 = ReportEngineV4._internals.fullAnswerFingerprint(v2, mapping);
console.log("  Q6 1개 교체 시:       " + fp2 + "  (delta: " + (fp2 !== fp0 ? "✓ 다름" : "✗ 동일") + ")");

// Q41 변경
const v3 = Object.assign({}, KYS_ANSWERS, { Q41: "교육과 학습 방식" });
const fp3 = ReportEngineV4._internals.fullAnswerFingerprint(v3, mapping);
console.log("  Q41 주제 변경 시:     " + fp3 + "  (delta: " + (fp3 !== fp0 ? "✓ 다름" : "✗ 동일") + ")");

// 강점 페어 매트릭스 카운트
const pairCount = Object.keys(ReportEngineV4._internals.TRAIT_PAIR_KO).length;
const singleCount = Object.keys(ReportEngineV4._internals.TRAIT_SINGLE_KO).length;
console.log("\n  강점 페어 매트릭스: " + pairCount + " 페어 × 4 변형 = " + (pairCount * 4) + " 합성문");
console.log("  단일 trait 폴백:   " + singleCount + " trait × 4 변형 = " + (singleCount * 4) + " 합성문");

// 톤별 7-슬롯 조합 수
const TONES = ["principled_designer","warm_connector","visionary_creator","pragmatic_achiever","reflective_explorer"];
let totalMv = 0;
TONES.forEach(t => {
  const lib = ReportEngineV4._internals.MV_SLOTS_KO[t];
  if (!lib) return;
  const c = (lib.anchor.length) * (lib.descriptor.length) * (lib.verb.length) * (lib.target.length) * (lib.essence.length) * (lib.time_horizon.length);
  console.log("  사명/비전 슬롯 [" + t + "]: " + lib.anchor.length + "×" + lib.descriptor.length + "×" + lib.verb.length + "×" + lib.target.length + "×" + lib.essence.length + "×" + lib.time_horizon.length + " = " + c.toLocaleString() + " 조합");
  totalMv += c;
});
console.log("  사명/비전 5톤 총합: " + totalMv.toLocaleString() + " 조합 (× domain 21개 × secondary domain 21개 ≈ " + (totalMv * 21 * 21).toLocaleString() + ")");

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

// 결과 저장
const outDir = path.join(ROOT, "reports/v4_test");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "kys_v13_raw.json"), JSON.stringify(rawReport, null, 2));
fs.writeFileSync(path.join(outDir, "kys_v4_upgraded.json"), JSON.stringify(v4Report, null, 2));
fs.writeFileSync(path.join(outDir, "kys_v4_qa.json"), JSON.stringify(qa, null, 2));
console.log("\n  결과 JSON 저장됨: reports/v4_test/");
console.log("    - kys_v13_raw.json");
console.log("    - kys_v4_upgraded.json");
console.log("    - kys_v4_qa.json");

// exit code
process.exit(qa.ok ? 0 : 1);
