"use strict";
// node --test functions/q90-retention/test/runner.test.js
// Requires the bundle branch checkout to be reachable (Q90_BUNDLE_ROOT) — defaults to the sibling worktree
// used during development; in CI this should point at the vendored copy. Skips with a clear message otherwise.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { createBundleRunner, createVendoredRunner, RunnerError } = require("../runner.js");
const vendor = require("../scripts/vendor-bundles.cjs");
const VENDORED = vendor.DEFAULT_OUT; // functions/q90-retention/bundles (committed output of vendor-bundles.cjs build)
const haveVendored = fs.existsSync(path.join(VENDORED, "PIN.json"));

// bundle root: explicit env > sibling bundle worktree > the vendored copy (self-sufficient in CI / deploy tree)
const SIBLING = path.resolve(__dirname, "..", "..", "..", "..", "bundle");
const ROOT = process.env.Q90_BUNDLE_ROOT || (fs.existsSync(path.join(SIBLING, "assets/data/bundles/manifest.json")) ? SIBLING : path.resolve(__dirname, "..", "bundles"));
const have = fs.existsSync(path.join(ROOT, "assets", "data", "bundles", "manifest.json"));
const sha = (s) => crypto.createHash("sha256").update(typeof s === "string" ? s : JSON.stringify(s)).digest("hex");
// server instant used by every request below (2026-09-08T00:00:00Z); the runner host clock must never appear
const GEN_AT = Date.UTC(2026, 8, 8, 0, 0, 0);
const GEN_ISO = new Date(GEN_AT).toISOString(); // "2026-09-08T00:00:00.000Z" — what the module passes as publishedAt
const SID = "sid_001";
const fmt = (ms) => { const d = new Date(ms); const p = (n) => (n < 10 ? "0" + n : "" + n); return d.getFullYear() + "." + p(d.getMonth() + 1) + "." + p(d.getDate()); };
const loadManifest = () => JSON.parse(fs.readFileSync(path.join(ROOT, "assets/data/bundles/manifest.json"), "utf8"));
// copy of a bundle into a temp root (optionally with a manifest mutator) so the real bundle is never touched
function tempRoot(version, mutate) {
  const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || "/tmp", "q90-runner-"));
  const m = loadManifest();
  const copy = (rel) => { fs.mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true }); fs.copyFileSync(path.join(ROOT, rel), path.join(tmp, rel)); };
  for (const rel of Object.keys(m.bundles[version].files)) copy(rel);
  if (mutate) mutate(m);
  fs.mkdirSync(path.join(tmp, "assets/data/bundles"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "assets/data/bundles/manifest.json"), JSON.stringify(m));
  return tmp;
}

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
  const out = await r.runBundle({ bundle: "legacy-b03e219", entrypoint: "regeneration", answers: synthAnswers(q, 0), profile: { name: "Synthetic", submittedAt: "2026-01-01T00:00:00Z" }, locale: "ko", sid: SID, publishedAt: GEN_ISO });
  assert.equal(out.bundleVersion, "legacy-b03e219"); assert.equal(out.entrypoint, "regeneration");
  assert.equal(out.bundleHash, r.manifest.bundles["legacy-b03e219"].bundleHash);
  assert.equal(out.entrypointHash, r.manifest.bundles["legacy-b03e219"].entrypointHashes["regeneration"]);
  assert.ok(Array.isArray(out.report.sections) && out.program.meta);
  assert.equal(out.report.engineVersion, "v4.1");
  await assert.rejects(r.runBundle({ bundle: "latest", entrypoint: "regeneration", answers: {}, profile: {}, locale: "ko", sid: SID, publishedAt: GEN_ISO }), (e) => e.code === "UNKNOWN_BUNDLE");
  await assert.rejects(r.runBundle({ bundle: "legacy-b03e219", entrypoint: "program-generation", answers: {}, profile: {}, locale: "ko", sid: SID, publishedAt: GEN_ISO }), (e) => e.code === "UNKNOWN_ENTRYPOINT");
  await assert.rejects(r.runBundle({ bundle: "legacy-b03e219", entrypoint: "regeneration", answers: {}, profile: {}, locale: "jp", sid: SID, publishedAt: GEN_ISO }), (e) => e.code === "BAD_LOCALE");
});

test("P18 inside the runner: legacy initial-generation vs regeneration differ (career_education, summary_close) for the same answers", { skip: !have }, async () => {
  const r = createBundleRunner({ bundleRoot: ROOT });
  const q = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/data/bundles/legacy-b03e219/questions.json"), "utf8"));
  const base = { bundle: "legacy-b03e219", answers: synthAnswers(q, 0), profile: { name: "Synthetic", submittedAt: "2026-01-01T00:00:00Z" }, locale: "ko", sid: SID, publishedAt: GEN_ISO };
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
  const common = { entrypoint: "regeneration", profile: prof, locale: "en", sid: SID, publishedAt: GEN_ISO };
  const clean = await r.runBundle({ ...common, bundle: "q90-input-and-wording-v2", answers });
  const dirty = await r.runBundle({ ...common, bundle: "q90-input-and-wording-v2", answers: { ...answers, Q8: "5" } });
  const legacyDirty = await r.runBundle({ ...common, bundle: "legacy-b03e219", answers: { ...answers, Q8: "5" } });
  assert.equal(clean.report.engineVersion, "v4.1-q90-w2");
  assert.equal(JSON.stringify(clean.report.scores.axisPct), JSON.stringify(dirty.report.scores.axisPct));
  assert.notEqual(JSON.stringify(clean.report.scores.axisPct), JSON.stringify(legacyDirty.report.scores.axisPct));
});

test("determinism: same request twice (same generatedAt) -> byte-identical report/program, clock fields included", { skip: !have }, async () => {
  const r = createBundleRunner({ bundleRoot: ROOT });
  const q = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/data/bundles/legacy-b03e219/questions.json"), "utf8"));
  const req = { bundle: "legacy-b03e219", entrypoint: "regeneration", answers: synthAnswers(q, 5), profile: { name: "Synthetic", submittedAt: "2026-01-01T00:00:00Z" }, locale: "ko", sid: SID, publishedAt: GEN_ISO };
  const a = await r.runBundle(req);
  await new Promise((res) => setTimeout(res, 5));
  const b = await r.runBundle(req);
  assert.equal(sha(a.report), sha(b.report));
  assert.equal(sha(a.program), sha(b.program));
  // a different server instant is a different output (clock is an input, not ambient state)
  const c = await r.runBundle({ ...req, publishedAt: new Date(GEN_AT + 86_400_000).toISOString() });
  assert.notEqual(sha(c.program), sha(a.program));
  assert.equal(c.program.meta.publishedAt, fmt(GEN_AT + 86_400_000));
});

test("[3825516 #3] program.meta.publishedAt / generatedAt come from req.publishedAt (server ISO), never epoch 0 or the host clock", { skip: !have }, async () => {
  const r = createBundleRunner({ bundleRoot: ROOT });
  const q = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/data/bundles/legacy-b03e219/questions.json"), "utf8"));
  const req = { bundle: "legacy-b03e219", entrypoint: "regeneration", answers: synthAnswers(q, 0), profile: { name: "Synthetic", submittedAt: "2026-01-01T00:00:00Z" }, locale: "ko", sid: SID, publishedAt: GEN_ISO };
  const out = await r.runBundle(req);
  assert.equal(out.program.meta.publishedAt, fmt(GEN_AT));
  assert.ok(!JSON.stringify(out.program.meta).includes("1970"), "epoch must not appear");
  const iso = new Date(GEN_AT).toISOString();
  assert.equal(out.program.meta.generatedAt, iso);
  assert.equal(out.report.generatedAt, iso);
  assert.equal(out.report._v4Meta.generatedAt, iso);
  assert.equal(out.generatedAt, GEN_AT); assert.equal(out.publishedAt, GEN_ISO);
  // host clock (now) must not leak: none of the clock fields equals today's date unless GEN_AT is today
  const hostIso = new Date().toISOString().slice(0, 13);
  if (!iso.startsWith(hostIso)) assert.ok(!JSON.stringify(out.program.meta).includes(hostIso) && !JSON.stringify(out.report.generatedAt).includes(hostIso));
  for (const bad of [undefined, null, 0, GEN_AT, new Date(GEN_AT), "2026-09-08T00:00:00Z", "2026-09-08T09:00:00.000+09:00", "1970-01-01T00:00:00.000Z", "2026-13-40T00:00:00.000Z"]) {
    await assert.rejects(r.runBundle({ ...req, publishedAt: bad }), (e) => e.code === "PUBLISHED_AT_REQUIRED", `publishedAt=${String(bad)} must be rejected`);
  }
});

test("[3825516 #5] req.sid is required and bound into program.meta.sourceReportSid (payload-level link)", { skip: !have }, async () => {
  const r = createBundleRunner({ bundleRoot: ROOT });
  const q = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/data/bundles/legacy-b03e219/questions.json"), "utf8"));
  const req = { bundle: "legacy-b03e219", entrypoint: "initial-generation", answers: synthAnswers(q, 1), profile: { name: "Synthetic" }, locale: "ko", sid: "sid_abc-7", publishedAt: GEN_ISO };
  const out = await r.runBundle(req);
  assert.equal(out.program.meta.sourceReportSid, "sid_abc-7");
  assert.equal(out.sid, "sid_abc-7");
  await assert.rejects(r.runBundle({ ...req, sid: undefined }), (e) => e.code === "SID_REQUIRED");
  await assert.rejects(r.runBundle({ ...req, sid: null }), (e) => e.code === "SID_REQUIRED");
  await assert.rejects(r.runBundle({ ...req, sid: "bad/sid" }), (e) => e.code === "SID_REQUIRED");
});

test("[3825516 #4] entrypointHash is recomputed from verified file hashes; a lying manifest is refused, not echoed", { skip: !have }, async () => {
  const q = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/data/bundles/legacy-b03e219/questions.json"), "utf8"));
  const req = { bundle: "legacy-b03e219", entrypoint: "regeneration", answers: synthAnswers(q, 0), profile: { name: "Synthetic" }, locale: "ko", sid: SID, publishedAt: GEN_ISO };
  // (a) entrypointHashes.regeneration replaced by 'f'*64 -> BUNDLE_INTEGRITY (reviewer counterexample)
  let tmp = tempRoot("legacy-b03e219", (m) => { m.bundles["legacy-b03e219"].entrypointHashes.regeneration = "f".repeat(64); });
  try {
    const r = createBundleRunner({ bundleRoot: tmp });
    await assert.rejects(r.runBundle(req), (e) => e instanceof RunnerError && e.code === "BUNDLE_INTEGRITY" && /entrypointHash/.test(e.message));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  // (b) a file hash AND the entrypointHash forged consistently still fail on content verification
  tmp = tempRoot("legacy-b03e219", (m) => { m.bundles["legacy-b03e219"].files["assets/js/bundles/legacy-b03e219/career-engine.js"].sha256 = "0".repeat(64); });
  try {
    await assert.rejects(createBundleRunner({ bundleRoot: tmp }).runBundle(req), (e) => e.code === "BUNDLE_INTEGRITY");
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  // (c) manifest entrypoint file set altered (career-engine dropped from regeneration) -> MANIFEST_ENTRYPOINT_MISMATCH before anything loads
  tmp = tempRoot("legacy-b03e219", (m) => { m.entrypoints.regeneration.engines = ["report-engine.js", "report-engine-v4.js"]; });
  try {
    assert.throws(() => createBundleRunner({ bundleRoot: tmp }), (e) => e.code === "MANIFEST_ENTRYPOINT_MISMATCH");
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  // (d) honest manifest: recomputed values equal the recorded ones and equal build-bundles' formula
  const r = createBundleRunner({ bundleRoot: ROOT });
  const m = loadManifest(); const entry = m.bundles["legacy-b03e219"];
  const parts = ["report-engine.js", "report-engine-v4.js", "career-engine.js"].map((f) => `assets/js/bundles/legacy-b03e219/${f}`).concat(["questions.json", "mapping.json", "report-rules.json", "career-rules.json"].map((f) => `assets/data/bundles/legacy-b03e219/${f}`)).sort();
  const expect = sha(parts.map((p) => `${p}:${entry.files[p].sha256}`).join("\n"));
  assert.equal(r.loadVerified("legacy-b03e219").entrypointHashes.regeneration, expect);
  assert.equal(expect, entry.entrypointHashes.regeneration);
  // (e) pinned manifest sha: vendoring step's pin must match the manifest actually present
  assert.throws(() => createBundleRunner({ bundleRoot: ROOT, pinnedManifestSha256: "0".repeat(64) }), (e) => e.code === "MANIFEST_PINNED_MISMATCH");
  const pin = sha(fs.readFileSync(path.join(ROOT, "assets/data/bundles/manifest.json"), "utf8"));
  assert.ok(createBundleRunner({ bundleRoot: ROOT, pinnedManifestSha256: pin }));
});

test("vendored: bundles/ is self-sufficient (no worktree), pinned to the frozen bundle commit, and produces the same hashes as the manifest", { skip: !haveVendored && "no vendored bundles/ (run scripts/vendor-bundles.cjs build)" }, async () => {
  const r = createVendoredRunner();
  assert.equal(r.pin.sourceCommit, vendor.SOURCE_COMMIT);
  assert.equal(r.pin.manifestSha256, sha(fs.readFileSync(path.join(VENDORED, vendor.MANIFEST_REL), "utf8")));
  const q = JSON.parse(fs.readFileSync(path.join(VENDORED, "assets/data/bundles/legacy-b03e219/questions.json"), "utf8"));
  const out = await r.runBundle({ bundle: "legacy-b03e219", entrypoint: "regeneration", answers: synthAnswers(q, 2), profile: { name: "Synthetic" }, locale: "ko", sid: SID, publishedAt: GEN_ISO });
  assert.equal(out.bundleHash, r.pin.bundles["legacy-b03e219"].bundleHash);
  assert.equal(out.entrypointHash, r.pin.bundles["legacy-b03e219"].entrypointHashes.regeneration);
  if (have) { // when the bundle worktree is also present, both sources must agree byte-for-byte
    const w = createBundleRunner({ bundleRoot: ROOT });
    const outW = await w.runBundle({ bundle: "legacy-b03e219", entrypoint: "regeneration", answers: synthAnswers(q, 2), profile: { name: "Synthetic" }, locale: "ko", sid: SID, publishedAt: GEN_ISO });
    assert.equal(sha(out.report), sha(outW.report)); assert.equal(sha(out.program), sha(outW.program));
  }
});

test("vendored: a tampered or unpinned bundles/ copy is refused before execution", { skip: !haveVendored }, async () => {
  const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || "/tmp", "q90-vendored-"));
  try {
    fs.cpSync(VENDORED, tmp, { recursive: true });
    assert.ok(createVendoredRunner({ bundleRoot: tmp }));
    fs.appendFileSync(path.join(tmp, "assets/js/bundles/legacy-b03e219/program-engine.js"), "\n//x\n");
    assert.throws(() => createVendoredRunner({ bundleRoot: tmp }), (e) => e instanceof RunnerError && e.code === "BUNDLE_INTEGRITY");
    fs.cpSync(VENDORED, tmp, { recursive: true, force: true });
    fs.writeFileSync(path.join(tmp, "assets/data/bundles/legacy-b03e219/extra.json"), "{}");
    assert.throws(() => createVendoredRunner({ bundleRoot: tmp }), (e) => e.code === "VENDORED_TREE_MISMATCH");
    fs.rmSync(path.join(tmp, "assets/data/bundles/legacy-b03e219/extra.json"));
    fs.rmSync(path.join(tmp, "PIN.json"));
    assert.throws(() => createVendoredRunner({ bundleRoot: tmp }), (e) => e instanceof RunnerError);
    assert.throws(() => createVendoredRunner({ sourceCommit: "1".repeat(40) }), (e) => e.code === "MANIFEST_PINNED_MISMATCH");
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
