"use strict";
// node --test functions/q90-retention/test/runner.test.js
// Requires the bundle branch checkout to be reachable (Q90_BUNDLE_ROOT) — defaults to the sibling worktree
// used during development; in CI this should point at the vendored copy. Skips with a clear message otherwise.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { createBundleRunner, RunnerError } = require("../runner.js");

const ROOT = process.env.Q90_BUNDLE_ROOT || path.resolve(__dirname, "..", "..", "..", "..", "bundle");
const have = fs.existsSync(path.join(ROOT, "assets", "data", "bundles", "manifest.json"));
const sha = (s) => crypto.createHash("sha256").update(typeof s === "string" ? s : JSON.stringify(s)).digest("hex");

function synthAnswers(questions, seed) {
  const core = questions.sections.flatMap((s) => s.questions); const a = {};
  core.forEach((q, i) => { if (q.type === "likert") a[q.id] = ((i + seed) % 5) + 1; else if (q.type === "single_choice") a[q.id] = q.options[(i + seed) % q.options.length]; else a[q.id] = [q.options[(i + seed) % q.options.length]]; });
  return a;
}

test("runner: bundle root present", { skip: !have && `no bundle root at ${ROOT} (set Q90_BUNDLE_ROOT)` }, () => { assert.ok(have); });

test("runner verifies every file against the manifest before executing; tampered byte -> BUNDLE_INTEGRITY", { skip: !have }, async () => {
  const r = createBundleRunner({ bundleRoot: ROOT });
  assert.ok(r.loadVerified("legacy-b03e219").bundleHash.length === 64);
  // tampered copy in a temp root
  const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || "/tmp", "q90-runner-"));
  const copy = (rel) => { fs.mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true }); fs.copyFileSync(path.join(ROOT, rel), path.join(tmp, rel)); };
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/data/bundles/manifest.json"), "utf8"));
  copy("assets/data/bundles/manifest.json");
  for (const rel of Object.keys(m.bundles["legacy-b03e219"].files)) copy(rel);
  fs.appendFileSync(path.join(tmp, "assets/js/bundles/legacy-b03e219/report-engine.js"), "\n//x\n");
  const r2 = createBundleRunner({ bundleRoot: tmp });
  assert.throws(() => r2.loadVerified("legacy-b03e219"), (e) => e instanceof RunnerError && e.code === "BUNDLE_INTEGRITY");
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("runner returns hashes identical to manifest and echoes bundle/entrypoint; unknown bundle/entrypoint fail closed", { skip: !have }, async () => {
  const r = createBundleRunner({ bundleRoot: ROOT });
  const q = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/data/bundles/legacy-b03e219/questions.json"), "utf8"));
  const out = await r.runBundle({ bundle: "legacy-b03e219", entrypoint: "regeneration", answers: synthAnswers(q, 0), profile: { name: "Synthetic", submittedAt: "2026-01-01T00:00:00Z" }, locale: "ko", sid: "sid_x" });
  assert.equal(out.bundleVersion, "legacy-b03e219"); assert.equal(out.entrypoint, "regeneration");
  assert.equal(out.bundleHash, r.manifest.bundles["legacy-b03e219"].bundleHash);
  assert.equal(out.entrypointHash, r.manifest.bundles["legacy-b03e219"].entrypointHashes["regeneration"]);
  assert.ok(Array.isArray(out.report.sections) && out.program.meta);
  assert.equal(out.report.engineVersion, "v4.1");
  await assert.rejects(r.runBundle({ bundle: "latest", entrypoint: "regeneration", answers: {}, profile: {}, locale: "ko" }), (e) => e.code === "UNKNOWN_BUNDLE");
  await assert.rejects(r.runBundle({ bundle: "legacy-b03e219", entrypoint: "program-generation", answers: {}, profile: {}, locale: "ko" }), (e) => e.code === "UNKNOWN_ENTRYPOINT");
  await assert.rejects(r.runBundle({ bundle: "legacy-b03e219", entrypoint: "regeneration", answers: {}, profile: {}, locale: "jp" }), (e) => e.code === "BAD_LOCALE");
});

test("P18 inside the runner: legacy initial-generation vs regeneration differ (career_education, summary_close) for the same answers", { skip: !have }, async () => {
  const r = createBundleRunner({ bundleRoot: ROOT });
  const q = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/data/bundles/legacy-b03e219/questions.json"), "utf8"));
  const base = { bundle: "legacy-b03e219", answers: synthAnswers(q, 0), profile: { name: "Synthetic", submittedAt: "2026-01-01T00:00:00Z" }, locale: "ko" };
  const a = await r.runBundle({ ...base, entrypoint: "initial-generation" }), b = await r.runBundle({ ...base, entrypoint: "regeneration" });
  assert.notEqual(a.entrypointHash, b.entrypointHash);
  const diff = a.report.sections.filter((s) => JSON.stringify(s) !== JSON.stringify(b.report.sections.find((x) => x.id === s.id))).map((s) => s.id);
  assert.equal(JSON.stringify(diff.sort()), JSON.stringify(["career_education", "summary_close"]));
  assert.equal(JSON.stringify(a.report.scores.axisPct), JSON.stringify(b.report.scores.axisPct));
});

test("v2 bundle: engineVersion v4.1-q90-w2 in report + program input; numeric otherId text does not move axisPct", { skip: !have }, async () => {
  const r = createBundleRunner({ bundleRoot: ROOT });
  const q = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/data/bundles/legacy-b03e219/questions.json"), "utf8"));
  const answers = synthAnswers(q, 3);
  const prof = { name: "Synthetic", submittedAt: "2026-01-01T00:00:00Z" };
  const clean = await r.runBundle({ bundle: "q90-input-and-wording-v2", entrypoint: "regeneration", answers, profile: prof, locale: "en" });
  const dirty = await r.runBundle({ bundle: "q90-input-and-wording-v2", entrypoint: "regeneration", answers: { ...answers, Q8: "5" }, profile: prof, locale: "en" });
  const legacyDirty = await r.runBundle({ bundle: "legacy-b03e219", entrypoint: "regeneration", answers: { ...answers, Q8: "5" }, profile: prof, locale: "en" });
  assert.equal(clean.report.engineVersion, "v4.1-q90-w2");
  assert.equal(JSON.stringify(clean.report.scores.axisPct), JSON.stringify(dirty.report.scores.axisPct));
  assert.notEqual(JSON.stringify(clean.report.scores.axisPct), JSON.stringify(legacyDirty.report.scores.axisPct));
});

test("determinism: same input twice -> identical report/program modulo generatedAt", { skip: !have }, async () => {
  const r = createBundleRunner({ bundleRoot: ROOT });
  const q = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/data/bundles/legacy-b03e219/questions.json"), "utf8"));
  const req = { bundle: "legacy-b03e219", entrypoint: "regeneration", answers: synthAnswers(q, 5), profile: { name: "Synthetic", submittedAt: "2026-01-01T00:00:00Z" }, locale: "ko" };
  // clock fields: report.generatedAt, report._v4Meta.generatedAt, program.meta.generatedAt (program-engine stamps its own)
  const strip = (o) => { const c = JSON.parse(JSON.stringify(o)); delete c.generatedAt; if (c._v4Meta) delete c._v4Meta.generatedAt; if (c.meta) delete c.meta.generatedAt; return c; };
  const a = await r.runBundle(req), b = await r.runBundle(req);
  assert.equal(sha(strip(a.report)), sha(strip(b.report)));
  assert.equal(sha(strip(a.program)), sha(strip(b.program)));
});
