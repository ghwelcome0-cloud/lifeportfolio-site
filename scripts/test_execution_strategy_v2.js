#!/usr/bin/env node
/**
 * test_execution_strategy_v2.js — 실행 전략 v2(execution-strategy.v2) 단위 테스트
 *
 * 인계 문서: uploaded_files/execution-profile-v2-complete-handoff.md §16.1
 *
 * 설계 원칙(Commit 1 시점):
 *  - Commit 1은 신규 테스트 + KYS v2 fixture만 추가하고 runtime(빌더/컴파일러/validator)은
 *    아직 report-engine-v4.js / program-engine.js 에 통합하지 않는다(문서 §15 Commit 1).
 *  - 따라서 아래 케이스는 `ReportEngineV4._internals.buildExecutionStrategy` 등 v2 API가
 *    아직 노출되지 않았으면 명시적으로 PENDING 처리하고, 노출되면 실제 assertion을 수행한다.
 *  - baseline(문서 §16.0) 실패를 신규 회귀로 오인하지 않기 위해, 이 스크립트는 v2 전용만 검증한다.
 *  - 예상 문구를 맞추려고 입력 근거를 조작하지 않는다(문서 §14 주의).
 *
 * canonical fixture: scripts/test_v4_kys_regen.js 의 KYS_ANSWERS/KYS_PROFILE (Q2 결정)
 *
 * 실행:  node scripts/test_execution_strategy_v2.js
 */

"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ReportEngine = require(path.join(ROOT, "assets/js/report-engine.js"));
const ReportEngineV4 = require(path.join(ROOT, "assets/js/report-engine-v4.js"));
const ProgramEngine = (function () {
  try { return require(path.join(ROOT, "assets/js/program-engine.js")); }
  catch (e) { return null; }
})();

const questions = JSON.parse(fs.readFileSync(path.join(ROOT, "data/questions.json"), "utf8"));
const mapping   = JSON.parse(fs.readFileSync(path.join(ROOT, "data/mapping.json"),   "utf8"));
const rules     = JSON.parse(fs.readFileSync(path.join(ROOT, "data/report-rules.json"), "utf8"));

// ─────────────────────────────────────────────────────────
// canonical KYS 입력 (scripts/test_v4_kys_regen.js 와 동일)
// ─────────────────────────────────────────────────────────
const KYS_ANSWERS = {
  Q1: "김영식", Q2: "이메일",
  Q3: 5, Q4: 5, Q5: 5,
  Q6: ["신중한", "분석적인", "성취지향적인"],
  Q7: "혼자만의 시간을 보낼 때",
  Q9: 5, Q10: 5, Q11: 5, Q12: 5,
  Q13: ["사랑", "자유", "의미 추구"],
  Q14: 5,
  Q16: 5, Q17: 5, Q18: 5, Q19: "스스로에게 깊은 질문을 던졌던 시기",
  Q21: "혼자 있는 시간 갖기", Q22: 5,
  Q23: 5, Q24: 4, Q25: 5,
  Q26: "조용히 혼자 있는 시간 갖기",
  Q27: 5, Q28: 4, Q29: 5, Q30: 4,
  Q31: ["편안함을 주는 사람", "공감해주는 사람"],
  Q32: 5,
  Q33: ["신뢰", "진정성", "공감"],
  Q34: 5,
  Q35: 5, Q36: 5,
  Q37: "사람들에게 의미 있는 변화를 만들어내는 멘토",
  Q38: 5,
  Q39: ["사람들과 아이디어를 나누거나 토론하기", "문제를 분석하고 해결책을 찾는 일"],
  Q41: ["교육과 학습 방식", "리더십", "공동체", "관계"],
  Q42: 5, Q43: 5, Q44: 5, Q45: 5, Q46: 5,
  Q47: ["조용한 공간 (도서관, 독서실 등)", "정돈된 실내 (정리된 내 방, 사무 공간)"],
  Q48: 5,
  Q49: ["아침에 일찍 시작하고 저녁에 일찍 마무리하는 루틴", "몰입 시간과 휴식 시간을 명확히 나누는 하루"],
  Q51: 5, Q52: 5, Q53: 5, Q54: 5, Q55: 5, Q56: 5, Q57: 5,
  Q59: 5, Q60: 5, Q61: 5, Q62: 5,
  Q63: ["의미 / 보람 / 가치", "신념 / 원칙 / 종교적 기준"],
  Q65: 5, Q66: 5, Q67: 5, Q68: 5, Q69: 5,
  Q70: 2,
  Q71: ["멀리 내다보며 흐름을 설계하기", "주변 사람들의 협력을 잘 이끌어내기"],
  Q72: 5,
  Q73: "문제를 해결하고 결과가 나왔을 때, 내가 의미 있다고 여긴 일을 마쳤을 때",
  Q74: 5,
  Q75: ["경제", "교육", "종교"],
  Q76: 5,
  Q77: ["코칭", "기획", "팀 빌딩"],
  Q78: 5
};

const KYS_PROFILE = {
  name: "김영식",
  email: "kim.youngsik@example.com",
  recvMethod: "이메일",
  submittedAt: "2026-05-06T09:00:00.000Z"
};

// §13 금지 내부 용어 (검증에 사용)
const FORBIDDEN_TERMS = [
  "v1.3", "v4.1", "fingerprint", "confidence", "Q13", "rule",
  "프로젝트 단계", "PR", "commit"
];

// §13 종교적 표현 자동 삽입 금지 — KYS Q41/Q63/Q75 에 "종교"/"종교적 기준" 포함(§7 헌법)
const RELIGION_TERMS = ["종교", "신앙", "하나님", "예수", "성경", "기독교", "교회"];

// ─────────────────────────────────────────────────────────
// 미니 테스트 하네스
// ─────────────────────────────────────────────────────────
let PASS = 0, FAIL = 0, PENDING = 0;
const results = [];

function ok(name, cond, detail) {
  if (cond) { PASS++; results.push(["PASS", name, detail || ""]); }
  else { FAIL++; results.push(["FAIL", name, detail || ""]); }
}
function pending(name, reason) {
  PENDING++; results.push(["PEND", name, reason || ""]);
}
function section(title) {
  results.push(["----", title, ""]);
}

// v2 API 노출 여부
const I = ReportEngineV4._internals || {};
const HAS_V2 =
  typeof I.buildExecutionStrategy === "function" &&
  typeof I.compileExecutionProfile === "function" &&
  typeof I.validateExecutionStrategy === "function";

// 리포트 빌드 헬퍼
function buildV4(answers, lang) {
  const raw = ReportEngine.build({
    questions, mapping, rules,
    answers, profile: KYS_PROFILE, lang: lang || "ko"
  });
  return ReportEngineV4.upgrade(raw, {
    questions, mapping, rules,
    answers, profile: KYS_PROFILE, lang: lang || "ko"
  });
}
function epContent(report) {
  const sec = (report.sections || []).find(function (s) { return s.id === "execution_profile"; });
  return sec ? sec.content : null;
}
function sixFields(ep) {
  return ep ? ["type", "style", "drivers", "environment", "activities", "tools"]
    .map(function (k) { return ep[k]; }) : [];
}
function allNonEmptyStrings(arr) {
  return arr.length === 6 && arr.every(function (v) { return typeof v === "string" && v.trim().length > 0; });
}
function containsAny(text, terms) {
  const t = String(text || "");
  return terms.filter(function (w) { return t.indexOf(w) !== -1; });
}

// buildExecutionStrategy 직접 호출용 input 구성 (v2 존재 시)
function strategyInput(report, lang) {
  return {
    report: report,
    ctx: { questions: questions, mapping: mapping, rules: rules, answers: KYS_ANSWERS, lang: lang || "ko" },
    axes: report.scores && report.scores.axisPct,
    toneResolution: report._v4Meta && report._v4Meta.toneResolution,
    signatureVars: report._v4Meta && report._v4Meta.signatureVars,
    fingerprint: report._v4Meta && (report._v4Meta.fingerprint || 0),
    lang: lang || "ko"
  };
}

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("  실행 전략 v2 단위 테스트 (execution-strategy.v2)");
console.log("  v2 runtime 노출: " + (HAS_V2 ? "YES" : "NO (Commit 2 이전 → 해당 케이스 PENDING)"));
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

// ─────────────────────────────────────────────────────────
// [1] 완전 입력 KO
// ─────────────────────────────────────────────────────────
section("[01] 완전 입력 KO");
{
  const rpt = buildV4(KYS_ANSWERS, "ko");
  const ep = epContent(rpt);
  ok("[01] execution_profile 6필드 비어있지 않은 문자열", allNonEmptyStrings(sixFields(ep)),
    "fields=" + JSON.stringify(sixFields(ep).map(function (s) { return String(s).slice(0, 20); })));
  if (HAS_V2) {
    ok("[01] _strategy.version === execution-strategy.v2",
      ep && ep._strategy && ep._strategy.version === "execution-strategy.v2",
      "version=" + (ep && ep._strategy && ep._strategy.version));
    ok("[01] _v4Meta.executionStrategyScheme 기록",
      rpt._v4Meta && !!rpt._v4Meta.executionStrategyScheme,
      "scheme=" + (rpt._v4Meta && rpt._v4Meta.executionStrategyScheme));
  } else {
    pending("[01] _strategy.version(v2)", "v2 runtime 미통합");
  }
}

// ─────────────────────────────────────────────────────────
// [2] 완전 입력 EN
// ─────────────────────────────────────────────────────────
section("[02] 완전 입력 EN");
{
  const rpt = buildV4(KYS_ANSWERS, "en");
  const ep = epContent(rpt);
  ok("[02] EN execution_profile 6필드 비어있지 않은 문자열", allNonEmptyStrings(sixFields(ep)));
  if (HAS_V2) {
    ok("[02] EN _strategy.lang === en",
      ep && ep._strategy && ep._strategy.lang === "en",
      "lang=" + (ep && ep._strategy && ep._strategy.lang));
  } else {
    pending("[02] EN _strategy.lang", "v2 runtime 미통합");
  }
}

// ─────────────────────────────────────────────────────────
// [3] Q13 없음 (가치 근거 결손)
// ─────────────────────────────────────────────────────────
section("[03] Q13 없음");
{
  const ans = Object.assign({}, KYS_ANSWERS); delete ans.Q13;
  const rpt = buildV4(ans, "ko");
  const ep = epContent(rpt);
  ok("[03] Q13 결손에도 6필드 유지", allNonEmptyStrings(sixFields(ep)));
  if (HAS_V2 && ep && ep._strategy) {
    ok("[03] source.values 안전 정규화(배열)",
      Array.isArray(ep._strategy.source.values),
      "values=" + JSON.stringify(ep._strategy.source.values));
  } else {
    pending("[03] source.values 정규화", "v2 runtime 미통합");
  }
}

// ─────────────────────────────────────────────────────────
// [4] Q47/Q49 없음 (환경/리듬 근거 결손)
// ─────────────────────────────────────────────────────────
section("[04] Q47/Q49 없음");
{
  const ans = Object.assign({}, KYS_ANSWERS); delete ans.Q47; delete ans.Q49;
  const rpt = buildV4(ans, "ko");
  const ep = epContent(rpt);
  ok("[04] 환경/리듬 결손에도 6필드 유지", allNonEmptyStrings(sixFields(ep)));
  if (HAS_V2 && ep && ep._strategy) {
    ok("[04] source.places/rhythms 배열 정규화",
      Array.isArray(ep._strategy.source.places) && Array.isArray(ep._strategy.source.rhythms));
    ok("[04] environment 문자열 존재", typeof ep.environment === "string" && ep.environment.trim().length > 0);
  } else {
    pending("[04] places/rhythms 정규화", "v2 runtime 미통합");
  }
}

// ─────────────────────────────────────────────────────────
// [5] Q73 없음 (성취 단서 결손)
// ─────────────────────────────────────────────────────────
section("[05] Q73 없음");
{
  const ans = Object.assign({}, KYS_ANSWERS); delete ans.Q73;
  const rpt = buildV4(ans, "ko");
  const ep = epContent(rpt);
  ok("[05] 성취단서 결손에도 6필드 유지", allNonEmptyStrings(sixFields(ep)));
  if (HAS_V2 && ep && ep._strategy) {
    ok("[05] source.achievementCue 문자열 정규화(빈 문자열 허용)",
      typeof ep._strategy.source.achievementCue === "string");
  } else {
    pending("[05] achievementCue 정규화", "v2 runtime 미통합");
  }
}

// ─────────────────────────────────────────────────────────
// [6] 활동이 하나뿐인 경우
// ─────────────────────────────────────────────────────────
section("[06] 활동 1개");
{
  const ans = Object.assign({}, KYS_ANSWERS);
  ans.Q39 = ["문제를 분석하고 해결책을 찾는 일"];
  const rpt = buildV4(ans, "ko");
  const ep = epContent(rpt);
  ok("[06] 활동 1개에도 6필드 유지", allNonEmptyStrings(sixFields(ep)));
  if (HAS_V2 && ep && ep._strategy) {
    ok("[06] activities 필드가 명사 나열이 아닌 '전환하는 일' 형식(join 아님)",
      typeof ep.activities === "string" &&
      ep.activities !== (ep._strategy.source.activities || []).join(", "),
      "activities=" + String(ep.activities).slice(0, 40));
  } else {
    pending("[06] activities 형식", "v2 runtime 미통합");
  }
}

// ─────────────────────────────────────────────────────────
// [7] 서로 긴장하는 신호가 있는 경우
// ─────────────────────────────────────────────────────────
section("[07] 긴장 신호 존재");
{
  // 신중/분석(계획) + 빠른 결과 필요 성향을 유지한 canonical 입력은 긴장(analysis-vs-start) 후보
  const rpt = buildV4(KYS_ANSWERS, "ko");
  const ep = epContent(rpt);
  if (HAS_V2 && ep && ep._strategy) {
    const tensions = (ep._strategy.signals && ep._strategy.signals.tensions) || [];
    // 긴장이 있으면 각 긴장에 evidenceRefs 존재해야 함
    const allHaveRefs = tensions.every(function (t) {
      return Array.isArray(t.evidenceRefs) && t.evidenceRefs.length >= 1;
    });
    ok("[07] tensions 배열 존재 + 각 긴장 evidenceRefs 보유", Array.isArray(tensions) && allHaveRefs,
      "tensions=" + tensions.length);
  } else {
    pending("[07] 긴장 신호", "v2 runtime 미통합");
  }
}

// ─────────────────────────────────────────────────────────
// [8] 긴장 근거가 부족한 경우 → 긴장 발명 금지
// ─────────────────────────────────────────────────────────
section("[08] 긴장 근거 부족");
{
  // 성향/활동/리듬 근거를 최소화 → 긴장 근거 부족 상황
  const ans = Object.assign({}, KYS_ANSWERS);
  delete ans.Q6; delete ans.Q49; delete ans.Q39; delete ans.Q73;
  const rpt = buildV4(ans, "ko");
  const ep = epContent(rpt);
  ok("[08] 근거 부족에도 6필드 유지", allNonEmptyStrings(sixFields(ep)));
  if (HAS_V2 && ep && ep._strategy) {
    const tensions = (ep._strategy.signals && ep._strategy.signals.tensions) || [];
    // 근거 부족 시 tensions:[] (긴장을 발명하지 않음) — §6.1
    ok("[08] 근거 부족 시 긴장을 발명하지 않음(tensions 빈 배열 또는 근거보유)",
      tensions.length === 0 || tensions.every(function (t) { return (t.evidenceRefs || []).length >= 2; }),
      "tensions=" + JSON.stringify(tensions.map(function (t) { return t.key; })));
  } else {
    pending("[08] 긴장 발명 방지", "v2 runtime 미통합");
  }
}

// ─────────────────────────────────────────────────────────
// [9] 동일 입력 2회 결정론
// ─────────────────────────────────────────────────────────
section("[09] 결정론(deep-equal)");
{
  const rpt1 = buildV4(KYS_ANSWERS, "ko");
  const rpt2 = buildV4(KYS_ANSWERS, "ko");
  const ep1 = epContent(rpt1), ep2 = epContent(rpt2);
  // public 6필드는 항상 결정론적이어야 함
  ok("[09] public 6필드 결정론",
    JSON.stringify(sixFields(ep1)) === JSON.stringify(sixFields(ep2)));
  if (HAS_V2 && ep1 && ep1._strategy && ep2 && ep2._strategy) {
    // 시각 필드 제외 deep-equal (generatedAt 등 제거)
    const s1 = stripTimeFields(ep1._strategy);
    const s2 = stripTimeFields(ep2._strategy);
    ok("[09] _strategy 시각필드 제외 deep-equal",
      JSON.stringify(s1) === JSON.stringify(s2));
  } else {
    pending("[09] _strategy 결정론", "v2 runtime 미통합");
  }
}
function stripTimeFields(obj) {
  const clone = JSON.parse(JSON.stringify(obj));
  (function walk(o) {
    if (!o || typeof o !== "object") return;
    ["generatedAt", "createdAt", "timestamp", "time"].forEach(function (k) { delete o[k]; });
    Object.keys(o).forEach(function (k) { walk(o[k]); });
  })(clone);
  return clone;
}

// ─────────────────────────────────────────────────────────
// [10] 금지 표현 validator
// ─────────────────────────────────────────────────────────
section("[10] 금지 표현 / 종교 표현 / 미치환 토큰");
{
  const rpt = buildV4(KYS_ANSWERS, "ko");
  const ep = epContent(rpt);
  const joined = sixFields(ep).join(" | ");
  // 미치환 토큰 금지
  ok("[10] 미치환 토큰({{...}}) 없음", joined.indexOf("{{") === -1 && joined.indexOf("}}") === -1);
  // 종교 표현 자동 삽입 금지 (§7 헌법: 고객 대면 노출 금지)
  const relHits = containsAny(joined, RELIGION_TERMS);
  ok("[10] 고객 대면 6필드에 종교 표현 자동 삽입 없음(§7)", relHits.length === 0,
    "hits=" + JSON.stringify(relHits));
  if (HAS_V2 && typeof I.validateExecutionStrategy === "function" && ep && ep._strategy) {
    // validator가 금지 내부용어를 잡아내는지: 오염된 strategy 주입 후 검사
    const dirty = JSON.parse(JSON.stringify(ep._strategy));
    dirty.diagnosis.crux = "이 진단은 fingerprint 기반 v4.1 결과입니다."; // 금지어 주입
    const qa = I.validateExecutionStrategy(dirty, "ko");
    ok("[10] validator가 금지 내부용어 검출", qa && qa.ok === false,
      "codes=" + (qa && qa.codes && qa.codes.join(",")));
  } else {
    pending("[10] validator 금지어 검출", "v2 runtime 미통합");
  }
}

// ─────────────────────────────────────────────────────────
// [11] builder throw 시 v1.3/v4.1 fallback
// ─────────────────────────────────────────────────────────
section("[11] builder throw fallback");
{
  if (HAS_V2 && typeof I.buildExecutionStrategy === "function") {
    // 강제로 실패하는 입력(빈 report/ctx)으로 throw 유도
    let threw = false;
    try { I.buildExecutionStrategy({ report: {}, ctx: {}, lang: "ko" }); }
    catch (e) { threw = true; }
    ok("[11] 불완전 입력에서 buildExecutionStrategy throw", threw);
    // upgrade 통합 후: 정상 입력은 fallback=false, 6필드 유지 확인
    const rptOk = buildV4(KYS_ANSWERS, "ko");
    ok("[11] 정상 입력 시 fallback=false + scheme=v2",
      rptOk._v4Meta && rptOk._v4Meta.executionStrategyFallback === false &&
      rptOk._v4Meta.executionStrategyScheme === "execution-strategy.v2",
      "scheme=" + (rptOk._v4Meta && rptOk._v4Meta.executionStrategyScheme));
    ok("[11] fallback 여부와 무관하게 6필드는 항상 비어있지 않은 문자열",
      allNonEmptyStrings(sixFields(epContent(rptOk))));
  } else {
    pending("[11] builder throw fallback", "v2 runtime 미통합");
  }
}

// ─────────────────────────────────────────────────────────
// [12] _strategy 없는 구 리포트의 Program Engine fallback
// ─────────────────────────────────────────────────────────
section("[12] 구 리포트 Program fallback");
{
  if (ProgramEngine && typeof ProgramEngine.build === "function") {
    // v2 미적용(=_strategy 없음) 리포트로 Program 생성 → legacy _firstFromCsv 경로로도 정상 생성
    const rpt = buildV4(KYS_ANSWERS, "ko");
    const ep = epContent(rpt);
    // 강제로 _strategy 제거하여 구 리포트 시뮬레이션
    if (ep && ep._strategy) delete ep._strategy;
    let prog = null, err = null;
    try {
      prog = ProgramEngine.build({ report: rpt, questions, mapping, rules, answers: KYS_ANSWERS, profile: KYS_PROFILE, lang: "ko" });
    } catch (e) { err = e; }
    ok("[12] _strategy 없는 리포트로 Program 생성 성공(legacy fallback)", !!prog && !err,
      err ? ("err=" + String(err.message).slice(0, 80)) : "ok");
  } else {
    pending("[12] Program fallback", "program-engine build API 미확인");
  }
}

// ─────────────────────────────────────────────────────────
// [13] _strategy 있는 리포트의 source 우선 소비
// ─────────────────────────────────────────────────────────
section("[13] source 우선 소비 + 문장 파편 미삽입");
{
  if (HAS_V2 && ProgramEngine && typeof ProgramEngine.build === "function") {
    // program-rules.json 로드(있으면), 없으면 빈 객체(엔진 내부 fallback)
    let programRules = {};
    try { programRules = JSON.parse(fs.readFileSync(path.join(ROOT, "data/program-rules.json"), "utf8")); }
    catch (e) { programRules = {}; }

    const rpt = buildV4(KYS_ANSWERS, "ko");
    const ep = epContent(rpt);
    if (ep && ep._strategy && ep._strategy.version === "execution-strategy.v2") {
      let prog = null, err = null;
      try {
        prog = ProgramEngine.build({ report: rpt, rules: programRules, name: KYS_PROFILE.name, lang: "ko" });
      } catch (e) { err = e; }
      ok("[13] v2 리포트로 Program 생성 성공", !!prog && !err,
        err ? ("err=" + String(err.message).slice(0, 80)) : "ok");

      const progBlob = prog ? JSON.stringify(prog) : "";
      // 긴 전략 문장의 파편이 Program에 삽입되지 않아야 함
      const fragments = ["질서를 세우고", "모으고, 세우고", "선택 기준으로 삼습니다", "실행력이 높아집니다", "만드는 일에 강점이 있습니다"];
      const leaked = fragments.filter(function (f) { return progBlob.indexOf(f) !== -1; });
      ok("[13] 전략 문장 파편이 Program에 미삽입", leaked.length === 0, "leaked=" + JSON.stringify(leaked));

      // source 원응답값이 Program 개인화에 반영되었는지(성취단서 또는 활동 첫 항목)
      const cue = ep._strategy.source.achievementCue || "";
      const act0 = (ep._strategy.source.activities || [])[0] || "";
      const usedSource = (cue && progBlob.indexOf(cue) !== -1) || (act0 && progBlob.indexOf(act0) !== -1);
      ok("[13] source 원응답(성취단서/활동)이 Program에 반영", usedSource,
        "cue인용=" + (cue && progBlob.indexOf(cue) !== -1) + " act0인용=" + (act0 && progBlob.indexOf(act0) !== -1));
    } else {
      pending("[13] source 우선 소비", "v2 _strategy 미생성(Commit 2 이전)");
    }
  } else {
    pending("[13] source 우선 소비", "v2 runtime/program-engine 미통합");
  }
}

// ─────────────────────────────────────────────────────────
// 결과 출력
// ─────────────────────────────────────────────────────────
console.log("");
results.forEach(function (r) {
  if (r[0] === "----") { console.log("\n── " + r[1]); return; }
  const tag = r[0] === "PASS" ? "  ✓ PASS" : r[0] === "FAIL" ? "  ✗ FAIL" : "  · PEND";
  console.log(tag + "  " + r[1] + (r[2] ? "   (" + r[2] + ")" : ""));
});

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("  결과: PASS " + PASS + " / FAIL " + FAIL + " / PENDING " + PENDING +
  "   (v2 runtime: " + (HAS_V2 ? "통합됨" : "미통합=Commit 1 정상") + ")");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

// Commit 1 시점: v2 미통합이면 FAIL 0 이어야 정상. FAIL>0 이면 종료코드 1.
process.exit(FAIL > 0 ? 1 : 0);
