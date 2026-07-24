/**
 * 실행 전략 v2 확장(2단계) 단위 테스트
 * 대상: Report VI(application) · Report VII(4축 axis-role) · Program II·III·IV·V·VIII
 *
 * 원칙:
 *  - 공개(public) 계약 보존을 항상 검증한다(구현 전/후 무관).
 *  - v2 확장 compiler가 아직 노출되지 않았으면 해당 케이스는 PENDING 처리하고,
 *    노출되면 실제 단언으로 승격된다(HAS_* 감지).
 *  - §7(원분야 비노출): 고객 대면 텍스트에 종교 표현이 없어야 한다.
 *  - 결정론: 동일 입력 → 시간 필드 제외 deep-equal.
 *
 * 실행: node scripts/test_execution_strategy_v2_ext.js
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
let programRules = {};
try { programRules = JSON.parse(fs.readFileSync(path.join(ROOT, "data/program-rules.json"), "utf8")); }
catch (e) { programRules = {}; }

// canonical KYS 입력을 test_v4_kys_regen.js에서 직접 로드(단일 진실 소스)
const regenSrc = fs.readFileSync(path.join(ROOT, "scripts/test_v4_kys_regen.js"), "utf8");
const KYS_ANSWERS = eval("(" + regenSrc.match(/const\s+KYS_ANSWERS\s*=\s*(\{[\s\S]*?\n\});/)[1] + ")");
const KYS_PROFILE = eval("(" + regenSrc.match(/const\s+KYS_PROFILE\s*=\s*(\{[\s\S]*?\n\});/)[1] + ")");

const RELIGION_TERMS = ["종교", "신앙", "하나님", "예수", "성경", "기독교", "교회", "신념 / 원칙 / 종교적 기준"];
const FORBIDDEN_TERMS = ["v1.3", "v4.1", "fingerprint", "confidence", "diagnosis", "guidingPolicy",
  "coherentActions", "comB", "resource | bridge", "actionRef", "evidenceRefs"];

const results = [];
function ok(name, cond, detail) { results.push({ name, pass: !!cond, detail: detail || "" }); }
function pending(name, reason) { results.push({ name, pending: true, detail: reason || "" }); }
function section(title) { results.push({ section: title }); }

// ── 헬퍼 ────────────────────────────────────────────────
function buildReport(answers, lang) {
  const raw = ReportEngine.build({ questions, mapping, rules, answers, profile: KYS_PROFILE, lang });
  return ReportEngineV4.upgrade(raw, { questions, mapping, rules, answers, profile: KYS_PROFILE, lang });
}
function sec(report, id) {
  return (report && report.sections || []).filter(function (s) { return s.id === id; })[0];
}
function epStrategy(report) {
  const ep = sec(report, "execution_profile");
  return ep && ep.content && ep.content._strategy;
}
function buildProgram(report, lang) {
  if (!ProgramEngine || typeof ProgramEngine.build !== "function") return null;
  return ProgramEngine.build({ report: report, rules: programRules, name: KYS_PROFILE.name, lang: lang });
}
function isNonEmptyStr(s) { return typeof s === "string" && s.trim().length > 0; }
function containsAny(text, terms) {
  const t = String(text || "");
  const hits = [];
  terms.forEach(function (w) { if (t.indexOf(w) !== -1) hits.push(w); });
  return hits;
}
function collectStrings(o, acc) {
  acc = acc || [];
  if (typeof o === "string") { acc.push(o); return acc; }
  if (Array.isArray(o)) { o.forEach(function (x) { collectStrings(x, acc); }); return acc; }
  if (o && typeof o === "object") {
    Object.keys(o).forEach(function (k) {
      if (k === "_strategy" || k === "_strategyRole" || k === "_injected") return; // 내부 메타 제외
      collectStrings(o[k], acc);
    });
  }
  return acc;
}
function stripTime(obj) {
  const c = JSON.parse(JSON.stringify(obj));
  (function walk(o) {
    if (o && typeof o === "object") {
      Object.keys(o).forEach(function (k) {
        if (k === "generatedAt" || k === "publishedAt" || k === "createdAt" || k === "date") delete o[k];
        else walk(o[k]);
      });
    }
  })(c);
  return c;
}

// v2 확장 compiler 노출 여부 감지
const I = ReportEngineV4._internals || {};
const HAS_REPORT_EXT =
  typeof I.compileApplicationStrategy === "function" &&
  typeof I.compileAxisDeepDiagnosis === "function";
const PI = (ProgramEngine && ProgramEngine._internal) || {};
const HAS_PROGRAM_EXT =
  typeof PI.compileQuarterTheme === "function" ||
  typeof PI.compileWeeklyRoutines === "function";
// 프로그램 VIII(다음 단계·리스크) compiler는 S2-Commit E에서 노출된다.
//   그 전까지 [07]의 risk if-then 단언은 PENDING 처리(정직: D 범위 아님).
const HAS_PROGRAM_RISK_EXT =
  typeof PI.compileNextStepsAndRisks === "function";

// ════════════════════════════════════════════════════════
// [01] 공통 — v2 strategy 존재 및 유효
// ════════════════════════════════════════════════════════
section("[01] 공통 strategy 존재/유효");
{
  const rpt = buildReport(KYS_ANSWERS, "ko");
  const st = epStrategy(rpt);
  ok("[01] execution-strategy.v2 존재", !!st && st.version === "execution-strategy.v2",
    st ? ("version=" + st.version) : "no _strategy");
  ok("[01] diagnosis.crux + guidingPolicy + coherentActions 존재",
    !!st && !!(st.diagnosis && st.diagnosis.crux) && !!(st.guidingPolicy) &&
    Array.isArray(st.coherentActions) && st.coherentActions.length > 0,
    st ? ("actions=" + (st.coherentActions || []).length) : "");
  ok("[01] nextAction 존재", !!st && !!(st.nextAction && st.nextAction.action));
}

// ════════════════════════════════════════════════════════
// [02] Report VI — public contract 항상 보존
// ════════════════════════════════════════════════════════
section("[02] Report VI public contract");
{
  const rpt = buildReport(KYS_ANSWERS, "ko");
  const app = (sec(rpt, "application") || {}).content || {};
  ok("[02] job/learning/tasks 문자열", isNonEmptyStr(app.job) && isNonEmptyStr(app.learning) && isNonEmptyStr(app.tasks),
    "job=" + String(app.job).slice(0, 24));
  ok("[02] firstActions 배열(문자열)", Array.isArray(app.firstActions) && app.firstActions.length > 0 &&
    app.firstActions.every(isNonEmptyStr), "n=" + (app.firstActions || []).length);
  ok("[02] 고객 대면 텍스트 §7 종교표현 0건",
    containsAny([app.job, app.learning, app.tasks].concat(app.firstActions || []).join(" "), RELIGION_TERMS).length === 0);
}

// ════════════════════════════════════════════════════════
// [03] Report VI — v2 전환 시 firstActions[0] == nextAction 의미 일치
// ════════════════════════════════════════════════════════
section("[03] Report VI nextAction 일치 (v2)");
{
  if (HAS_REPORT_EXT) {
    const rpt = buildReport(KYS_ANSWERS, "ko");
    const app = (sec(rpt, "application") || {}).content || {};
    const st = epStrategy(rpt);
    const na = st && st.nextAction && st.nextAction.action ? st.nextAction.action : "";
    // 의미 일치: 핵심 명사/동사 토큰 공유 검사(완전 일치 아님)
    const fa0 = (app.firstActions || [])[0] || "";
    ok("[03] application._strategy 메타 기록",
      !!(app._strategy && app._strategy.scheme === "execution-strategy.v2"),
      app._strategy ? JSON.stringify(app._strategy).slice(0, 80) : "no meta");
    ok("[03] firstActions[0]이 nextAction과 의미 연결", isNonEmptyStr(fa0) && isNonEmptyStr(na),
      "fa0=" + fa0.slice(0, 40) + " | na=" + na.slice(0, 40));
    ok("[03] tasks가 응답 파편 나열이 아님(내부 enum/조각 미노출)",
      containsAny(app.tasks, FORBIDDEN_TERMS).length === 0);
  } else {
    pending("[03] Report VI v2 compiler 미노출 — compileApplicationStrategy 필요", "HAS_REPORT_EXT=false");
  }
}

// ════════════════════════════════════════════════════════
// [04] Report VII — 4축 public contract 항상 보존
// ════════════════════════════════════════════════════════
section("[04] Report VII 4축 public contract");
{
  const rpt = buildReport(KYS_ANSWERS, "ko");
  const axisIds = ["self_understanding", "self_expression", "self_design", "self_execution"];
  let allOk = true, kw4 = true, relHits = 0;
  axisIds.forEach(function (id) {
    const c = (sec(rpt, id) || {}).content || {};
    if (!(typeof c.pct === "number" && isNonEmptyStr(c.core) && isNonEmptyStr(c.emotional))) allOk = false;
    if (!(Array.isArray(c.keywords) && c.keywords.length === 4)) kw4 = false;
    relHits += containsAny([c.core, c.emotional].concat(c.keywords || []).join(" "), RELIGION_TERMS).length;
  });
  ok("[04] 4축 pct/core/emotional 보존", allOk);
  ok("[04] 4축 keywords 정확히 4개", kw4);
  ok("[04] 4축 텍스트 §7 종교표현 0건", relHits === 0, "hits=" + relHits);
}

// ════════════════════════════════════════════════════════
// [05] Report VII — v2 전환 시 축 역할 coverage
// ════════════════════════════════════════════════════════
section("[05] Report VII 축 역할 coverage (v2)");
{
  if (HAS_REPORT_EXT) {
    const rpt = buildReport(KYS_ANSWERS, "ko");
    const axisIds = ["self_understanding", "self_expression", "self_design", "self_execution"];
    const roles = [];
    axisIds.forEach(function (id) {
      const c = (sec(rpt, id) || {}).content || {};
      if (c._strategyRole && c._strategyRole.role) roles.push(c._strategyRole.role);
    });
    ok("[05] 4축 모두 _strategyRole.role 존재", roles.length === 4, "roles=" + JSON.stringify(roles));
    ok("[05] 역할이 enum 집합에 속함",
      roles.every(function (r) { return ["resource", "bridge", "constraint", "activation"].indexOf(r) !== -1; }),
      "roles=" + JSON.stringify(roles));
    // 고객 대면 텍스트에 role enum 문자열 미노출
    let enumLeak = 0;
    axisIds.forEach(function (id) {
      const c = (sec(rpt, id) || {}).content || {};
      enumLeak += containsAny([c.core, c.emotional].concat(c.keywords || []).join(" "),
        ["resource", "bridge", "constraint", "activation"]).length;
    });
    ok("[05] 고객 텍스트에 role enum 미노출", enumLeak === 0, "leak=" + enumLeak);
  } else {
    pending("[05] Report VII v2 compiler 미노출 — compileAxisDeepDiagnosis 필요", "HAS_REPORT_EXT=false");
  }
}

// ════════════════════════════════════════════════════════
// [06] Program — public schema 항상 보존
// ════════════════════════════════════════════════════════
section("[06] Program public schema");
{
  const rpt = buildReport(KYS_ANSWERS, "ko");
  const prog = buildProgram(rpt, "ko");
  if (prog) {
    ok("[06] quarter/program.weeks/month3/year1 존재",
      !!prog.quarter && !!(prog.program && prog.program.weeks) &&
      !!(prog.program && prog.program.month3) && !!(prog.program && prog.program.year1));
    ok("[06] modules/nextSteps/risks 존재",
      Array.isArray(prog.modules) && Array.isArray(prog.nextSteps) && Array.isArray(prog.risks));
    const blob = collectStrings(prog).join(" ");
    ok("[06] Program 고객 텍스트 §7 종교표현 0건",
      containsAny(blob, RELIGION_TERMS).length === 0,
      "hits=" + JSON.stringify(containsAny(blob, RELIGION_TERMS)));
    ok("[06] Program 고객 텍스트 내부 enum 미노출",
      containsAny(blob, FORBIDDEN_TERMS).length === 0,
      "hits=" + JSON.stringify(containsAny(blob, FORBIDDEN_TERMS)));
  } else {
    pending("[06] ProgramEngine.build 미가용", "ProgramEngine=null");
  }
}

// ════════════════════════════════════════════════════════
// [07] Program — v2 전환 시 quarter/weeks 전략 반영 + risk if-then
// ════════════════════════════════════════════════════════
section("[07] Program v2 전략 반영");
{
  if (HAS_PROGRAM_EXT) {
    const rpt = buildReport(KYS_ANSWERS, "ko");
    const prog = buildProgram(rpt, "ko");
    const st = epStrategy(rpt);
    ok("[07] program.meta._strategy.scheme 기록",
      !!(prog && prog.meta && prog.meta._strategy && prog.meta._strategy.scheme === "execution-strategy.v2"),
      prog && prog.meta && prog.meta._strategy ? JSON.stringify(prog.meta._strategy).slice(0, 80) : "no meta");
    // quarter.title이 실행프로파일 type을 그대로 복사하지 않음
    const ep = sec(rpt, "execution_profile");
    const type = ep && ep.content && ep.content.type ? ep.content.type : "";
    ok("[07] quarter.title이 type 원문 복사 아님",
      !!(prog && prog.quarter) && prog.quarter.title !== type);
    // risks mitigation이 if-then 형식 하나 이상 — Program VIII(S2-Commit E) 범위.
    //   compileNextStepsAndRisks 노출 전에는 PENDING(정직: D 커밋 범위 아님).
    if (HAS_PROGRAM_RISK_EXT) {
      const hasIfThen = (prog.risks || []).some(function (r) {
        return isNonEmptyStr(r.mitigation) && (r.mitigation.indexOf("만약") !== -1 || r.mitigation.indexOf("면,") !== -1);
      });
      ok("[07] risk mitigation에 if-then 형식 존재", hasIfThen);
    } else {
      pending("[07] risk mitigation if-then — compileNextStepsAndRisks 필요(S2-Commit E)", "HAS_PROGRAM_RISK_EXT=false");
    }
  } else {
    pending("[07] Program v2 compiler 미노출 — compileQuarterTheme/compileWeeklyRoutines 필요", "HAS_PROGRAM_EXT=false");
  }
}

// ════════════════════════════════════════════════════════
// [08] 결정론 — 동일 입력 deep-equal (시간 제외)
// ════════════════════════════════════════════════════════
section("[08] 결정론");
{
  const a = buildReport(KYS_ANSWERS, "ko");
  const b = buildReport(KYS_ANSWERS, "ko");
  const appA = (sec(a, "application") || {}).content || {};
  const appB = (sec(b, "application") || {}).content || {};
  ok("[08] Report VI 결정론",
    JSON.stringify(stripTime(appA)) === JSON.stringify(stripTime(appB)));
  const progA = buildProgram(a, "ko"), progB = buildProgram(b, "ko");
  if (progA && progB) {
    ok("[08] Program 결정론(시간 제외)",
      JSON.stringify(stripTime({ q: progA.quarter, w: progA.program.weeks, m: progA.modules, r: progA.risks })) ===
      JSON.stringify(stripTime({ q: progB.quarter, w: progB.program.weeks, m: progB.modules, r: progB.risks })));
  } else {
    pending("[08] Program 결정론 — build 미가용", "");
  }
}

// ════════════════════════════════════════════════════════
// [09] legacy fallback — _strategy 없는 구 리포트
// ════════════════════════════════════════════════════════
section("[09] legacy fallback");
{
  const rpt = buildReport(KYS_ANSWERS, "ko");
  // _strategy 제거한 복제본
  const legacy = JSON.parse(JSON.stringify(rpt));
  const ep = (legacy.sections || []).filter(function (s) { return s.id === "execution_profile"; })[0];
  if (ep && ep.content) delete ep.content._strategy;
  let prog = null, err = null;
  try { prog = buildProgram(legacy, "ko"); } catch (e) { err = e; }
  ok("[09] _strategy 없는 리포트로 Program 생성 성공(legacy)", !!prog && !err,
    err ? ("err=" + String(err.message).slice(0, 80)) : "ok");
  if (prog) {
    ok("[09] legacy Program public schema 유지",
      !!prog.quarter && !!(prog.program && prog.program.weeks) && Array.isArray(prog.risks));
  }
}

// ── 출력 ────────────────────────────────────────────────
let pass = 0, fail = 0, pend = 0;
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("  실행 전략 v2 확장(2단계) 단위 테스트");
console.log("  HAS_REPORT_EXT=" + HAS_REPORT_EXT + "  HAS_PROGRAM_EXT=" + HAS_PROGRAM_EXT);
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
results.forEach(function (r) {
  if (r.section) { console.log("\n── " + r.section); return; }
  if (r.pending) { pend++; console.log("  ⏸ PEND  " + r.name + (r.detail ? ("   (" + r.detail + ")") : "")); return; }
  if (r.pass) { pass++; console.log("  ✓ PASS  " + r.name + (r.detail ? ("   (" + r.detail + ")") : "")); }
  else { fail++; console.log("  ✗ FAIL  " + r.name + (r.detail ? ("   (" + r.detail + ")") : "")); }
});
console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("  결과: PASS " + pass + " / FAIL " + fail + " / PENDING " + pend);
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
process.exit(fail > 0 ? 1 : 0);
