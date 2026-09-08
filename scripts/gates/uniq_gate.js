#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const ReportEngine = require(path.join(ROOT, "assets/js/report-engine.js"));
const ReportEngineV4 = require(path.join(ROOT, "assets/js/report-engine-v4.js"));
const ProgramEngine = require(path.join(ROOT, "assets/js/program-engine.js"));
const { buildSyntheticAssessment } = require(path.join(ROOT, "scripts/fixtures/synthetic_assessment.js"));

const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const questions = read("data/questions.json");
const mapping = read("data/mapping.json");
const reportRules = read("data/report-rules.json");
const programRules = read("data/program-rules.json");
const baseAnswers = buildSyntheticAssessment(questions).answers; // .answers is required
const questionList = questions.sections.flatMap((section) => section.questions || []);
const PROFILE = { name: "합성 검증", email: "synthetic@example.invalid", recvMethod: "email", submittedAt: "2026-01-01" };
const PUBLISHED_AT = new Date("2026-01-01T00:00:00.000Z");
const N = Number.parseInt(process.env.UNIQ_N || "200", 10);
const SENSITIVITY_BASES = Number.parseInt(process.env.UNIQ_SENSITIVITY_BASES || "3", 10);

if (!Number.isSafeInteger(N) || N < 20 || !Number.isSafeInteger(SENSITIVITY_BASES) || SENSITIVITY_BASES < 1) {
  throw new Error("UNIQ_N must be >=20 and UNIQ_SENSITIVITY_BASES must be >=1");
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function normalize(value) { return String(value ?? "").normalize("NFC").replace(/\s+/g, " ").trim(); }
function getSection(report, id) { return (report.sections || []).find((section) => section.id === id); }
function getAt(root, dotted) {
  return dotted.split(".").reduce((value, key) => value == null ? undefined : value[key], root);
}

function rotateAnswer(question, current, step) {
  const options = Array.isArray(question.options) ? question.options : [];
  if (question.type === "likert") return ((Number(current || 1) - 1 + step) % 5) + 1;
  if (question.type === "single_choice") {
    if (!options.length) throw new Error(`No options for ${question.id}`);
    const at = Math.max(0, options.findIndex((option) => option === current));
    return options[(at + step) % options.length];
  }
  if (question.type === "multi_choice") {
    if (!options.length) throw new Error(`No options for ${question.id}`);
    const max = Math.max(1, Math.min(Number(question.max) || 1, options.length));
    const count = 1 + ((step - 1) % max);
    const start = step % options.length;
    return Array.from({ length: count }, (_, offset) => options[(start + offset) % options.length]);
  }
  throw new Error(`Unsupported question type for ${question.id}: ${question.type}`);
}

function mulberry32(seed) {
  return function random() {
    let value = seed += 0x6D2B79F5;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function makeAnswers(seed) {
  const answers = clone(baseAnswers);
  const random = mulberry32(seed * 7919 + 1000003);
  questionList.forEach((question) => {
    const optionCount = Array.isArray(question.options) ? question.options.length : 5;
    answers[question.id] = rotateAnswer(question, answers[question.id], 1 + Math.floor(random() * Math.max(1, optionCount * 3)));
  });
  return answers;
}

function mutateOne(answers, question, step) {
  const out = clone(answers);
  let candidate = rotateAnswer(question, out[question.id], step);
  if (JSON.stringify(candidate) === JSON.stringify(out[question.id])) candidate = rotateAnswer(question, out[question.id], step + 1);
  out[question.id] = candidate;
  return out;
}

function build(answers) {
  const rawReport = ReportEngine.build({ questions, mapping, rules: reportRules, answers, profile: PROFILE, lang: "ko" });
  const report = ReportEngineV4.upgrade(rawReport, { questions, mapping, rules: reportRules, answers, profile: PROFILE, lang: "ko" });
  const program = ProgramEngine.build({ report, rules: programRules, name: PROFILE.name, lang: "ko", publishedAt: PUBLISHED_AT });
  return { report, program };
}

const REPORT_PATHS = {
  summary: ["typeLine", "coreOneLine"],
  mission_vision: ["mission", "vision", "footer", "missionHeadline", "missionSubline", "diaryMission", "visionHeadline", "visionSubline", "diaryVision", "headline", "subline", "missionDetail", "visionDetail"],
  execution_profile: ["type", "style", "drivers", "environment", "activities", "tools", "activitiesEg"],
  growth_map: ["strengths", "growth"],
  career_education: ["careers", "education", "directions", "careerExamples", "careerGuideNote", "educationExamples"],
  application: ["job", "jobEg", "learning", "tasks", "firstActions"],
  self_understanding: ["core", "emotional", "tierComment", "closerLine", "pairedNarrative", "roleNote"],
  self_expression: ["core", "emotional", "tierComment", "closerLine", "pairedNarrative", "roleNote"],
  self_design: ["core", "emotional", "tierComment", "closerLine", "pairedNarrative", "roleNote"],
  self_execution: ["core", "emotional", "tierComment", "closerLine", "pairedNarrative", "roleNote"],
  summary_close: ["line1", "line2"],
};

const PROGRAM_PATHS = [
  "cover.title", "cover.subtitle", "cover.typeLine", "cover.coreOneLine", "cover.diagBadge", "cover.introLine", "cover.quote",
  "cover.summary.traits", "cover.summary.strengths", "cover.summary.gaps", "cover.summary.env", "cover.summary.newPaths",
  "cover.summary.traitsHead", "cover.summary.strengthsHead", "cover.summary.gapsHead", "cover.summary.envHead", "cover.summary.newPathsHead", "cover.arrowLine",
  "quarter.heading", "quarter.subline", "quarter.paragraphs", "program.weeks", "program.month3", "program.year1",
  "modules", "board.rowsExample", "board.monthly", "board.hint", "effects.fitJob", "effects.expansion", "effects.career", "effects.vision", "effects.newPaths",
  "nextSteps", "risks", "closing",
];

function collectLeafStrings(value, pathName, out) {
  if (typeof value === "string") {
    const text = normalize(value);
    if (text) out.set(pathName, text);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectLeafStrings(item, `${pathName}[${index}]`, out));
    return;
  }
  if (value && typeof value === "object") {
    Object.keys(value).sort().filter((key) => !key.startsWith("_") && !["id", "index", "type", "week", "icon", "columns", "done", "memo"].includes(key))
      .forEach((key) => collectLeafStrings(value[key], `${pathName}.${key}`, out));
  }
}

function extractVisible({ report, program }) {
  const out = new Map();
  for (const [sectionId, fields] of Object.entries(REPORT_PATHS)) {
    const content = getSection(report, sectionId)?.content;
    if (!content) throw new Error(`Missing report section: ${sectionId}`);
    for (const field of fields) collectLeafStrings(content[field], `report.${sectionId}.${field}`, out);
  }
  const summaryItems = getSection(report, "summary_close")?.content?.items || [];
  summaryItems.forEach((item, index) => collectLeafStrings(item?.desc, `report.summary_close.items[${index}].desc`, out));
  for (const dotted of PROGRAM_PATHS) collectLeafStrings(getAt(program, dotted), `program.${dotted}`, out);
  return out;
}

function stripVolatile(value) {
  if (Array.isArray(value)) return value.map(stripVolatile);
  if (!value || typeof value !== "object") return value;
  const out = {};
  for (const key of Object.keys(value).sort()) {
    if (["generatedAt", "publishedAt", "createdAt", "timestamp", "date"].includes(key)) continue;
    out[key] = stripVolatile(value[key]);
  }
  return out;
}

function changedSlots(a, b) {
  const keys = new Set([...a.keys(), ...b.keys()]);
  let changed = 0;
  for (const key of keys) if (a.get(key) !== b.get(key)) changed++;
  return changed;
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
}

function calculateMetrics(outputs) {
  const visible = outputs.map(extractVisible);
  const allPaths = new Set(visible.flatMap((map) => [...map.keys()]));
  const k1Paths = [];
  const missingPaths = [];
  for (const pathName of allPaths) {
    const values = visible.map((map) => map.get(pathName));
    if (values.some((value) => value === undefined)) missingPaths.push(pathName);
    else if (new Set(values).size === 1) k1Paths.push(pathName);
  }
  const axes = ["self_understanding", "self_expression", "self_design", "self_execution"];
  const core = Object.fromEntries(axes.map((axis) => {
    const values = outputs.map(({ report }) => normalize(getSection(report, axis)?.content?.core));
    if (values.some((value) => !value)) throw new Error(`Missing core sentence: ${axis}`);
    return [axis, { distinct: new Set(values).size, samples: values.length, ratio: new Set(values).size / values.length }];
  }));
  return { visible, k1Paths: k1Paths.sort(), missingPaths: missingPaths.sort(), core };
}

function evaluate(metrics, thresholds) {
  const failures = [];
  if (metrics.sentenceSensitivity.averageResponsiveQuestions < thresholds.sensitivityAverageMin) failures.push(`sensitivity average responsive questions ${metrics.sentenceSensitivity.averageResponsiveQuestions} < ${thresholds.sensitivityAverageMin}`);
  if (metrics.sentenceSensitivity.zeroChangePairs > thresholds.zeroChangePairsMax) failures.push(`zero-change pairs ${metrics.sentenceSensitivity.zeroChangePairs} > ${thresholds.zeroChangePairsMax}`);
  if (metrics.k1.count > thresholds.k1Max) failures.push(`k=1 ${metrics.k1.count} > ${thresholds.k1Max}`);
  const unexpectedK1 = metrics.k1.paths.filter((pathName) => !thresholds.allowedK1Paths.includes(pathName));
  if (unexpectedK1.length) failures.push(`unexpected k=1 paths: ${unexpectedK1.join(", ")}`);
  for (const [axis, floor] of Object.entries(thresholds.coreDistinctMin)) if (metrics.fourCoreDistinct[axis].distinct < floor) failures.push(`${axis} core distinct ${metrics.fourCoreDistinct[axis].distinct} < ${floor}`);
  if (metrics.fingerprintDeterminism.fp32Mismatches || metrics.fingerprintDeterminism.fp64Mismatches || metrics.fingerprintDeterminism.contentMismatches || metrics.fingerprintDeterminism.programPropagationMismatches) failures.push("fingerprint determinism mismatch");
  return failures;
}

function conciseFailure(message) {
  if (!message.startsWith("unexpected k=1 paths:")) return message;
  const paths = message.slice("unexpected k=1 paths:".length).split(",").map((value) => value.trim());
  return `unexpected k=1 paths: ${paths.slice(0, 5).join(", ")} (+${Math.max(0, paths.length - 5)} more)`;
}

function measureCoverage(answerSets) {
  const observed = new Map(questionList.map((question) => [question.id, new Set()]));
  for (const answers of answerSets) for (const question of questionList) observed.get(question.id).add(JSON.stringify(answers[question.id]));
  const invariantQuestions = [...observed.entries()].filter(([, values]) => values.size < 2).map(([id]) => id);
  return { questionCount: questionList.length, variedQuestionCount: questionList.length - invariantQuestions.length, invariantQuestions };
}

function main() {
  const outputs = [], fpFailures = { fp32Mismatches: 0, fp64Mismatches: 0, contentMismatches: 0, programPropagationMismatches: 0 };
  const diversityAnswers = [];
  for (let i = 0; i < N; i++) {
    const answers = makeAnswers(i + 1), first = build(answers), second = build(answers);
    diversityAnswers.push(answers);
    outputs.push(first);
    const f1 = first.report._v4Meta || {}, f2 = second.report._v4Meta || {}, guard = first.program.meta?._uniqGuard || {};
    if (f1.fingerprint !== f2.fingerprint) fpFailures.fp32Mismatches++;
    if (f1.fingerprint64 !== f2.fingerprint64) fpFailures.fp64Mismatches++;
    if (JSON.stringify(stripVolatile(first)) !== JSON.stringify(stripVolatile(second))) fpFailures.contentMismatches++;
    if (guard.fingerprint !== f1.fingerprint || guard.fingerprint64 !== f1.fingerprint64) fpFailures.programPropagationMismatches++;
  }

  const distribution = calculateMetrics(outputs);
  const coverage = measureCoverage(diversityAnswers);
  if (coverage.invariantQuestions.length) throw new Error(`Diversity cohort did not vary: ${coverage.invariantQuestions.join(", ")}`);
  const deltas = [], byQuestion = {}, responsiveQuestionsByPath = new Map();
  for (const question of questionList) {
    const qDeltas = [];
    for (let baseIndex = 0; baseIndex < SENSITIVITY_BASES; baseIndex++) {
      const answers = makeAnswers(baseIndex + 101);
      const before = extractVisible(build(answers));
      const after = extractVisible(build(mutateOne(answers, question, baseIndex + 2)));
      const count = changedSlots(before, after);
      deltas.push(count); qDeltas.push(count);
      const paths = new Set([...before.keys(), ...after.keys()]);
      for (const pathName of paths) if (before.get(pathName) !== after.get(pathName)) {
        if (!responsiveQuestionsByPath.has(pathName)) responsiveQuestionsByPath.set(pathName, new Set());
        responsiveQuestionsByPath.get(pathName).add(question.id);
      }
    }
    byQuestion[question.id] = { pairs: qDeltas.length, average: qDeltas.reduce((a,b)=>a+b,0)/qDeltas.length, min: Math.min(...qDeltas), max: Math.max(...qDeltas) };
  }
  const sorted = deltas.slice().sort((a,b)=>a-b);
  const responsiveCounts = [...new Set(distribution.visible.flatMap((map) => [...map.keys()]))]
    .map((pathName) => responsiveQuestionsByPath.get(pathName)?.size || 0).sort((a,b)=>a-b);
  const sensitivity = {
    pairs: deltas.length,
    averageResponsiveQuestions: responsiveCounts.reduce((a,b)=>a+b,0)/responsiveCounts.length,
    responsiveQuestionDistribution: { slots: responsiveCounts.length, min: Math.min(...responsiveCounts), p10: percentile(responsiveCounts,.1), median: percentile(responsiveCounts,.5), p90: percentile(responsiveCounts,.9), max: Math.max(...responsiveCounts) },
    averageChangedSlotsPerMutation: deltas.reduce((a,b)=>a+b,0)/deltas.length,
    changedSlotDistribution: { min: Math.min(...deltas), p10: percentile(sorted,.1), median: percentile(sorted,.5), p90: percentile(sorted,.9), max: Math.max(...deltas) },
    zeroChangePairs: deltas.filter((n)=>n===0).length,
    byQuestion,
  };

  // Calibrated on 2026-08-28 with N=200 and 168 one-answer mutation pairs.
  // Baseline: average responsive questions and core counts are printed below.
  // Floors are static, deliberately below today's measured lower range.
  const thresholds = {
    sensitivityAverageMin: 20,
    zeroChangePairsMax: 0,
    k1Max: 3,
    allowedK1Paths: ["program.cover.title", "program.cover.subtitle", "report.self_execution.roleNote"],
    coreDistinctMin: {
      self_understanding: Math.ceil(N * .70),
      self_expression: Math.ceil(N * .70),
      self_design: Math.ceil(N * .70),
      self_execution: Math.ceil(N * .70),
    },
  };
  const metrics = {
    sample: { diversityN: N, sensitivityPairs: deltas.length, sensitivityBases: SENSITIVITY_BASES },
    sentenceSensitivity: sensitivity,
    k1: { count: distribution.k1Paths.length, paths: distribution.k1Paths, missingPaths: distribution.missingPaths },
    fourCoreDistinct: distribution.core,
    fingerprintDeterminism: { repeatCases: N, ...fpFailures },
    coverage,
  };

  const normalFailures = evaluate(metrics, thresholds);
  const collapsedOutputs = Array.from({ length: N }, () => build(makeAnswers(1)));
  const collapsed = calculateMetrics(collapsedOutputs);
  const collapsedMetrics = clone(metrics);
  collapsedMetrics.k1 = { count: collapsed.k1Paths.length, paths: collapsed.k1Paths };
  collapsedMetrics.fourCoreDistinct = collapsed.core;
  collapsedMetrics.sentenceSensitivity.averageResponsiveQuestions = 0;
  collapsedMetrics.sentenceSensitivity.zeroChangePairs = deltas.length;
  const collapsedFailures = evaluate(collapsedMetrics, thresholds);
  const negativeControls = {
    identicalAnswersMustFail: { expected: "FAIL", actual: collapsedFailures.length ? "FAIL" : "PASS", failureCount: collapsedFailures.length, failures: collapsedFailures.slice(0, 8).map(conciseFailure) },
    normalSampleMustPass: { expected: "PASS", actual: normalFailures.length ? "FAIL" : "PASS", failures: normalFailures },
  };

  const result = { schemaVersion: 1, metrics, thresholds, negativeControls };
  console.log(JSON.stringify(result, null, 2));
  const selfTestPass = negativeControls.identicalAnswersMustFail.actual === "FAIL" && negativeControls.normalSampleMustPass.actual === "PASS";
  if (!selfTestPass) {
    console.error("UNIQ_GATE FAIL: negative control did not discriminate collapsed and normal cohorts");
    process.exit(1);
  }
  console.log(`UNIQ_GATE PASS: N=${N}, sensitivity=${sensitivity.averageResponsiveQuestions.toFixed(2)}, changedSlots=${sensitivity.averageChangedSlotsPerMutation.toFixed(2)}, k1=${metrics.k1.count}, core=${Object.values(distribution.core).map((x)=>x.distinct).join("/")}, deterministic=${N}`);
}

try { main(); } catch (error) { console.error(`UNIQ_GATE ERROR: ${error.stack || error.message}`); process.exit(1); }
