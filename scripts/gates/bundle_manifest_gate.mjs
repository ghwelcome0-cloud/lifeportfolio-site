#!/usr/bin/env node
// Q90-RETENTION — bundle manifest gate.
//
//   node scripts/gates/bundle_manifest_gate.mjs              # run
//   node scripts/gates/bundle_manifest_gate.mjs --self-test  # negative controls must FAIL the gate
//   node scripts/gates/bundle_manifest_gate.mjs --json
//
// Exit codes (Q-10 gate contract): 0 pass · 1 finding · 2 gate/environment error.
//
// What it proves (offline, synthetic answers only — no RTDB, no browser):
//   G1  manifest.json parses, schema matches, every listed file exists with the listed sha256/bytes,
//       no unlisted file lives in the bundle trees.
//   G2  legacy-b03e219 files are byte-identical to `git show b03e219:<path>` (needs the commit locally;
//       when it is absent the check is reported as "skipped" — a skip is NOT a pass and the gate exits 1).
//   G3  a deterministic rebuild from the frozen commit + patches reproduces every byte on disk.
//   G4  reportEngineVersion per bundle is <= 20 chars and equals what the bundled v4 engine actually
//       writes to BOTH report.engineVersion and report._v4Meta.engineVersion (top/meta consistency).
//   G5  scoring: for the v2 bundle, every otherId field x 18 adversarial values contributes nothing to
//       axisPct/sectionPct; for legacy the same inputs DO change scores (proves the defect is real and
//       the fixture exercises it).
//   G6  unregistered mapping id => v2 throws (fail closed); legacy silently scores it as likert.
//   G7  normal answers (no other text), 12 seeds x 2 locales, via the REGENERATION entrypoint:
//       legacy and v2 produce identical axisPct/sectionPct/fingerprint/fingerprint64; sections differ
//       only in the two whitelisted tier sentences.
//   G8  entrypoint difference is real: legacy initial-generation (no career engine) vs regeneration
//       (career engine) differ for the same answers; the manifest records them as separate hashes.
//   G9  KO/EN wording: the exact "before" sentence is absent from v2 output and the "after" sentence
//       is present when the self_understanding.deep tier is reached; legacy still emits the "before".
//
// It does not prove: browser behaviour, PDF output, RTDB rules, Functions, or anything about real
// customer data. Those are separate gates owned by W (rules) and X (E2E).

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { FROZEN_SOURCE_COMMIT, ENGINE_FILES, DATA_FILES, ENTRYPOINTS, BUNDLES, MAX_ENGINE_VERSION_LENGTH } from "../q90/bundle-patches.mjs";
import { buildInMemory } from "../q90/build-bundles.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const MANIFEST = path.join(ROOT, "assets", "data", "bundles", "manifest.json");
const SELF_TEST = process.argv.includes("--self-test");
const JSON_OUT = process.argv.includes("--json");
const require = createRequire(import.meta.url);

const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
const ser = (x) => JSON.stringify(x);
const stripVolatile = (o) => JSON.parse(JSON.stringify(o, (k, v) => (k === "generatedAt" || k === "publishedAt" || k === "submittedAt" ? undefined : v)));

// ─── engine loading (each bundle in its own VM context so globals never leak) ───
function loadBundle(version, manifest, overrideFiles) {
  const read = (rel) => (overrideFiles && rel in overrideFiles) ? overrideFiles[rel] : fs.readFileSync(path.join(ROOT, rel), "utf8");
  const jsRel = (f) => `assets/js/bundles/${version}/${f}`;
  const dataRel = (f) => `assets/data/bundles/${version}/${f}`;
  const data = Object.fromEntries(DATA_FILES.map((f) => [f, JSON.parse(read(dataRel(f)))]));
  function runModule(rel, ctx) {
    const sandbox = { module: { exports: {} }, console, Date, ...ctx };
    sandbox.exports = sandbox.module.exports;
    // report-engine.js resolves CareerEngine via require("./career-engine.js") when `require` exists.
    // We pass a require that serves the bundled career engine (or nothing) per entrypoint.
    vm.runInNewContext(read(rel), sandbox, { filename: rel });
    return sandbox.module.exports;
  }
  const career = runModule(jsRel("career-engine.js"), {});
  const withCareerRequire = (id) => { if (/career-engine/.test(id)) return career; throw new Error("no module " + id); };
  const withoutCareerRequire = (id) => { throw new Error("no module " + id); };
  return {
    data,
    // initial-generation: report-loading.html never loads career-engine.js
    reportEngineInitial: runModule(jsRel("report-engine.js"), { require: withoutCareerRequire }),
    // regeneration: report.html loads career-engine.js first
    reportEngineRegen: runModule(jsRel("report-engine.js"), { require: withCareerRequire, CareerEngine: career }),
    v4: runModule(jsRel("report-engine-v4.js"), { require: withCareerRequire }),
    program: runModule(jsRel("program-engine.js"), { require: withCareerRequire, CareerEngine: career }),
    career,
  };
}

function makeAnswers(questions, seed) {
  const core = questions.sections.flatMap((s) => s.questions);
  const a = {};
  core.forEach((q, i) => {
    if (q.type === "likert") a[q.id] = ((i + seed) % 5) + 1;
    else if (q.type === "single_choice") a[q.id] = q.options[(i + seed) % q.options.length];
    else if (q.type === "multi_choice") a[q.id] = [q.options[(i + seed) % q.options.length]];
  });
  return a;
}
function deepAnswers(questions) {
  // pushes self_understanding to the "deep" tier: max likert, first option elsewhere
  const core = questions.sections.flatMap((s) => s.questions);
  const a = {};
  for (const q of core) a[q.id] = q.type === "likert" ? (q.reverse ? 1 : 5) : q.type === "multi_choice" ? [q.options[0]] : q.options[0];
  return a;
}
const OTHER_VALUES = [undefined, "", "x", "기타 의견", "5", "1", "3", "3.5", "100", "-3", "  ", " 5 ", "1e3", "0x10", "Infinity", "５", 5, 0];

// ─── gate ───
function runGate(overrideFiles, opts = {}) {
  const findings = [];
  const info = {};
  const fail = (code, detail) => findings.push({ code, detail });

  // G1 manifest + files
  let manifest;
  try {
    manifest = JSON.parse(overrideFiles && "assets/data/bundles/manifest.json" in overrideFiles ? overrideFiles["assets/data/bundles/manifest.json"] : fs.readFileSync(MANIFEST, "utf8"));
  } catch (e) { return { findings: [{ code: "G1", detail: "manifest unreadable: " + e.message }], info, error: true }; }
  if (manifest.schema !== "q90-bundle-manifest/1") fail("G1", "unexpected schema " + manifest.schema);
  if (manifest.frozenSourceCommit !== FROZEN_SOURCE_COMMIT) fail("G1", "frozenSourceCommit mismatch");
  const listed = new Set();
  for (const [version, b] of Object.entries(manifest.bundles || {})) {
    for (const [rel, meta] of Object.entries(b.files || {})) {
      listed.add(rel);
      const content = overrideFiles && rel in overrideFiles ? overrideFiles[rel] : (fs.existsSync(path.join(ROOT, rel)) ? fs.readFileSync(path.join(ROOT, rel), "utf8") : null);
      if (content === null) { fail("G1", `missing ${rel}`); continue; }
      if (sha256(content) !== meta.sha256) fail("G1", `sha256 mismatch ${rel}`);
      if (Buffer.byteLength(content) !== meta.bytes) fail("G1", `byte length mismatch ${rel}`);
    }
    if (!b.entrypointHashes || Object.keys(b.entrypointHashes).sort().join() !== Object.keys(ENTRYPOINTS).sort().join()) fail("G1", `${version}: entrypointHashes incomplete`);
  }
  for (const dir of ["assets/js/bundles", "assets/data/bundles"]) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    for (const f of walk(abs)) {
      const rel = path.relative(ROOT, f).split(path.sep).join("/");
      if (rel === "assets/data/bundles/manifest.json") continue;
      if (!listed.has(rel)) fail("G1", `unlisted file in bundle tree ${rel}`);
    }
  }
  for (const version of Object.keys(BUNDLES)) if (!manifest.bundles?.[version]) fail("G1", `bundle ${version} missing from manifest`);
  if (findings.length) return { findings, info };

  // G2 legacy byte identity vs frozen commit  (self-test may skip G2/G3 to prove the behavioural
  // checks catch a regression on their own, not only via the rebuild diff)
  let commitAvailable = !opts.skipIntegrity;
  try { execFileSync("git", ["cat-file", "-e", FROZEN_SOURCE_COMMIT + "^{commit}"], { cwd: ROOT, stdio: "ignore" }); } catch { commitAvailable = false; }
  if (opts.skipIntegrity) { /* self-test only */ } else if (!commitAvailable) {
    fail("G2", `frozen commit ${FROZEN_SOURCE_COMMIT.slice(0, 7)} not present locally — byte identity NOT verified (skip is not pass)`);
  } else {
    for (const f of ENGINE_FILES) {
      const rel = `assets/js/bundles/legacy-b03e219/${f}`;
      const frozen = execFileSync("git", ["show", `${FROZEN_SOURCE_COMMIT}:assets/js/${f}`], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
      const disk = overrideFiles && rel in overrideFiles ? overrideFiles[rel] : fs.readFileSync(path.join(ROOT, rel), "utf8");
      if (frozen !== disk) fail("G2", `legacy ${f} differs from ${FROZEN_SOURCE_COMMIT.slice(0, 7)}`);
    }
    for (const f of DATA_FILES) {
      const rel = `assets/data/bundles/legacy-b03e219/${f}`;
      const frozen = execFileSync("git", ["show", `${FROZEN_SOURCE_COMMIT}:data/${f}`], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
      const disk = overrideFiles && rel in overrideFiles ? overrideFiles[rel] : fs.readFileSync(path.join(ROOT, rel), "utf8");
      if (frozen !== disk) fail("G2", `legacy ${f} differs from ${FROZEN_SOURCE_COMMIT.slice(0, 7)}`);
    }
    // G3 deterministic rebuild
    try {
      const rebuilt = buildInMemory().files;
      for (const [rel, content] of Object.entries(rebuilt)) {
        const disk = overrideFiles && rel in overrideFiles ? overrideFiles[rel] : (fs.existsSync(path.join(ROOT, rel)) ? fs.readFileSync(path.join(ROOT, rel), "utf8") : null);
        if (disk !== content) fail("G3", `rebuild differs: ${rel}`);
      }
    } catch (e) { fail("G3", "rebuild failed: " + e.message); }
  }

  // Behavioural checks on the two bundles
  let L, N;
  try { L = loadBundle("legacy-b03e219", manifest, overrideFiles); N = loadBundle("q90-input-and-wording-v2", manifest, overrideFiles); }
  catch (e) { fail("G4", "bundle load failed: " + e.message); return { findings, info }; }

  const q = N.data["questions.json"], m = N.data["mapping.json"], rules = N.data["report-rules.json"], careerRules = N.data["career-rules.json"];
  if (ser(L.data) !== ser(N.data)) fail("G1", "data files differ between legacy and v2 (v2 must not change schema/rules)");
  const profile = { name: "Synthetic", submittedAt: "2026-01-01T00:00:00Z" };
  const core = q.sections.flatMap((s) => s.questions);
  const otherIds = core.filter((x) => x.hasOther && x.otherId).map((x) => x.otherId);
  info.otherIdCount = otherIds.length;

  // Any exception from a bundled engine during the behavioural checks is a finding, not a gate error:
  // a candidate engine that throws on the synthetic fixture must fail the gate.
  try { behavioural(); } catch (e) { fail("G4", "bundled engine threw during behavioural checks: " + (e && e.message || e)); }
  return { findings, info };

  function behavioural() {
  // G4 version consistency
  const base = makeAnswers(q, 0);
  const argsRegen = (answers, lang) => ({ questions: q, mapping: m, rules, careerRules, answers, profile, lang });
  const argsInitial = (answers, lang) => ({ questions: q, mapping: m, rules, answers, profile, lang });
  const runRegen = (B, answers, lang = "ko") => B.v4.upgrade(B.reportEngineRegen.build(argsRegen(answers, lang)), argsRegen(answers, lang));
  const runInitial = (B, answers, lang = "ko") => B.v4.upgrade(B.reportEngineInitial.build(argsInitial(answers, lang)), argsInitial(answers, lang));
  for (const [version, B] of [["legacy-b03e219", L], ["q90-input-and-wording-v2", N]]) {
    const want = manifest.bundles[version].reportEngineVersion;
    if (want.length > MAX_ENGINE_VERSION_LENGTH) fail("G4", `${version}: reportEngineVersion > ${MAX_ENGINE_VERSION_LENGTH} chars`);
    const r = runRegen(B, base);
    if (r.engineVersion !== want) fail("G4", `${version}: report.engineVersion=${r.engineVersion} want ${want}`);
    if (r._v4Meta?.engineVersion !== want) fail("G4", `${version}: _v4Meta.engineVersion=${r._v4Meta?.engineVersion} want ${want}`);
    if (B.v4.version !== want) fail("G4", `${version}: module version=${B.v4.version} want ${want}`);
  }

  // G5 mixing
  let legacyMixed = 0, v2Mixed = 0, cases = 0;
  const baseN = N.reportEngineRegen.computeScores(q, m, base);
  for (const id of otherIds) for (const val of OTHER_VALUES) {
    const a = { ...base }; if (val !== undefined) a[id] = val;
    const before = ser(a);
    const lo = L.reportEngineRegen.computeScores(q, m, a);
    const no = N.reportEngineRegen.computeScores(q, m, a);
    if (ser(a) !== before) fail("G5", "computeScores mutated answers");
    if (lo.perQ[id]?.raw != null) legacyMixed++;
    if (no.perQ[id]?.raw != null) v2Mixed++;
    if (ser(no.axisPct) !== ser(baseN.axisPct) || ser(no.sectionPct) !== ser(baseN.sectionPct)) fail("G5", `v2 scores moved for ${id}=${JSON.stringify(val)}`);
    cases++;
  }
  info.mixingCases = cases; info.legacyMixed = legacyMixed; info.v2Mixed = v2Mixed;
  if (v2Mixed !== 0) fail("G5", `v2 still mixes ${v2Mixed} cases`);
  if (legacyMixed === 0) fail("G5", "legacy shows no mixing — fixture no longer exercises the defect");

  // G6 unregistered id fail-closed
  const m2 = JSON.parse(JSON.stringify(m)); m2.questionMapping.Q999 = { axes: ["self_design"], sections: ["summary"], weight: 1 };
  const a999 = { ...base, Q999: "4" };
  let threw = false; try { N.reportEngineRegen.computeScores(q, m2, a999); } catch { threw = true; }
  if (!threw) fail("G6", "v2 did not throw on unregistered mapping id");
  let legacyThrew = false; try { L.reportEngineRegen.computeScores(q, m2, a999); } catch { legacyThrew = true; }
  if (legacyThrew) fail("G6", "legacy unexpectedly throws on unregistered id (behaviour drift in frozen copy)");

  // G7 normal combos, regeneration entrypoint
  const KO_BEFORE = "자신을 깊이 이해합니다. 다른 사람의 성찰까지 도울 수 있습니다.";
  const KO_AFTER = "자기이해를 위해 돌아보려는 응답이 높게 나타났습니다. 실제 이해 수준이나 다른 사람을 도울 능력을 확인한 것은 아닙니다.";
  const EN_BEFORE = "Your self-understanding is deeply matured — you are at a stage where you can help others' self-reflection.";
  const EN_AFTER = "Your responses show a strong intention to reflect on yourself. They do not establish your actual level of self-understanding or your ability to guide others.";
  let combos = 0, identicalSections = 0;
  for (let seed = 0; seed < 12; seed++) for (const lang of ["ko", "en"]) {
    const a = makeAnswers(q, seed);
    const lr = runRegen(L, a, lang), nr = runRegen(N, a, lang);
    if (ser(lr.scores.axisPct) !== ser(nr.scores.axisPct)) fail("G7", `axisPct differs seed=${seed} ${lang}`);
    if (ser(lr.scores.sectionPct) !== ser(nr.scores.sectionPct)) fail("G7", `sectionPct differs seed=${seed} ${lang}`);
    if (lr._v4Meta.fingerprint !== nr._v4Meta.fingerprint || lr._v4Meta.fingerprint64 !== nr._v4Meta.fingerprint64) fail("G7", `fingerprint differs seed=${seed} ${lang}`);
    // sections must be identical once the two whitelisted sentences are normalised
    const lc = (x) => x.charAt(0).toLowerCase() + x.slice(1);
    const norm = (s) => ser(stripVolatile(s)).split(KO_AFTER).join(KO_BEFORE).split(EN_AFTER).join(EN_BEFORE).split(lc(EN_AFTER)).join(lc(EN_BEFORE));
    if (norm(lr.sections) !== norm(nr.sections)) fail("G7", `sections differ beyond whitelisted wording seed=${seed} ${lang}`);
    else identicalSections++;
    combos++;
  }
  info.normalCombos = combos; info.sectionsIdenticalModuloWording = identicalSections;

  // G8 entrypoint difference on legacy
  const li = runInitial(L, base), lr0 = runRegen(L, base);
  if (ser(li.scores.axisPct) !== ser(lr0.scores.axisPct)) fail("G8", "legacy initial vs regen axisPct differ (unexpected)");
  const diffSections = li.sections.filter((s) => ser(stripVolatile(s)) !== ser(stripVolatile(lr0.sections.find((x) => x.id === s.id)))).map((s) => s.id);
  info.legacyEntrypointDiffSections = diffSections;
  if (diffSections.length === 0) fail("G8", "legacy initial-generation and regeneration produced identical sections — entrypoint split no longer justified; re-verify");
  const lh = manifest.bundles["legacy-b03e219"].entrypointHashes;
  if (lh["initial-generation"] === lh["regeneration"]) fail("G8", "manifest entrypoint hashes collapse");

  // G9 wording
  for (const lang of ["ko", "en"]) {
    const a = deepAnswers(q);
    const lr = runRegen(L, a, lang), nr = runRegen(N, a, lang);
    // EN sentences are spliced after a lead-in ("With your quiet grain, your self-…") so the
    // first letter is lower-cased by the engine; compare case-insensitively.
    const lt = ser(lr.sections).toLowerCase(), nt = ser(nr.sections).toLowerCase();
    const before = (lang === "ko" ? KO_BEFORE : EN_BEFORE).toLowerCase(), after = (lang === "ko" ? KO_AFTER : EN_AFTER).toLowerCase();
    if (!lt.includes(before)) fail("G9", `${lang}: deep tier not reached in legacy fixture (cannot verify wording)`);
    if (nt.includes(before)) fail("G9", `${lang}: v2 still emits the old sentence`);
    if (!nt.includes(after)) fail("G9", `${lang}: v2 does not emit the new sentence`);
  }
  }
}

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p); else yield p;
  }
}

// ─── negative controls ───
function selfTest() {
  const results = [];
  const manifestText = fs.readFileSync(MANIFEST, "utf8");
  const v2Engine = "assets/js/bundles/q90-input-and-wording-v2/report-engine.js";
  const v2v4 = "assets/js/bundles/q90-input-and-wording-v2/report-engine-v4.js";
  const legacyEngine = "assets/js/bundles/legacy-b03e219/report-engine.js";
  const withManifestFor = (files) => {
    // re-hash so the negative control hits the *behavioural* check, not just G1
    const mf = JSON.parse(manifestText);
    for (const b of Object.values(mf.bundles)) for (const rel of Object.keys(b.files)) if (rel in files) { b.files[rel].sha256 = sha256(files[rel]); b.files[rel].bytes = Buffer.byteLength(files[rel]); }
    return { ...files, "assets/data/bundles/manifest.json": JSON.stringify(mf, null, 2) + "\n" };
  };
  const controls = [
    { name: "tampered legacy byte (G2/G3)", files: { [legacyEngine]: fs.readFileSync(path.join(ROOT, legacyEngine), "utf8") + "\n// tamper\n" }, expect: /G1|G2|G3/ },
    { name: "manifest hash lie (G1)", files: { "assets/data/bundles/manifest.json": manifestText.replace(/"sha256": "[0-9a-f]{8}/, '"sha256": "deadbeef') }, expect: /G1/ },
    { name: "v2 mixing regressed (G5, integrity skipped)", skipIntegrity: true, files: withManifestFor({ [v2Engine]: fs.readFileSync(path.join(ROOT, v2Engine), "utf8").replace("      if (qOther[qid]) {\n", "      if (false) {\n") }), expect: /G4|G5|G6/ },
    { name: "v2 unregistered id no longer throws (G6, integrity skipped)", skipIntegrity: true, files: withManifestFor({ [v2Engine]: fs.readFileSync(path.join(ROOT, v2Engine), "utf8").replace('        throw new Error("ReportEngine.computeScores: unregistered', '        if (false) throw new Error("ReportEngine.computeScores: unregistered').replace('      var type = qTypes[qid];\n', '      var type = qTypes[qid] || "likert";\n') }), expect: /G6/ },
    { name: "v2 wording reverted (G9, integrity skipped)", skipIntegrity: true, files: withManifestFor({ [v2v4]: fs.readFileSync(path.join(ROOT, v2v4), "utf8").replace("자기이해를 위해 돌아보려는 응답이 높게 나타났습니다. 실제 이해 수준이나 다른 사람을 도울 능력을 확인한 것은 아닙니다.", "자신을 깊이 이해합니다. 다른 사람의 성찰까지 도울 수 있습니다.") }), expect: /G9/ },
    { name: "v2 top/meta version split (G4, integrity skipped)", skipIntegrity: true, files: withManifestFor({ [v2v4]: fs.readFileSync(path.join(ROOT, v2v4), "utf8").replace('report.engineVersion = "v4.1-q90-w2";', 'report.engineVersion = "v4.1";') }), expect: /G4/ },
  ];
  let ok = true;
  for (const c of controls) {
    const r = runGate(c.files, { skipIntegrity: !!c.skipIntegrity });
    const matched = r.findings.some((f) => c.expect.test(f.code));
    results.push({ control: c.name, failedAsExpected: matched, findings: r.findings.map((f) => f.code + ": " + f.detail).slice(0, 3) });
    if (!matched) ok = false;
  }
  const clean = runGate();
  results.push({ control: "clean run passes", failedAsExpected: clean.findings.length === 0, findings: clean.findings.map((f) => f.code + ": " + f.detail).slice(0, 3) });
  if (clean.findings.length) ok = false;
  return { ok, results };
}

function main() {
  try {
    if (SELF_TEST) {
      const r = selfTest();
      console.log(JSON_OUT ? JSON.stringify(r, null, 2) : r.results.map((x) => `${x.failedAsExpected ? "PASS" : "FAIL"} ${x.control}${x.findings.length ? "  <- " + x.findings[0] : ""}`).join("\n"));
      process.exit(r.ok ? 0 : 1);
    }
    const r = runGate();
    if (r.error) { console.error(JSON.stringify(r, null, 2)); process.exit(2); }
    if (JSON_OUT) console.log(JSON.stringify({ ok: r.findings.length === 0, ...r }, null, 2));
    else {
      console.log(`q90 bundle gate: ${r.findings.length === 0 ? "PASS" : "FAIL"}  ` + JSON.stringify(r.info));
      for (const f of r.findings) console.log(`  ${f.code}: ${f.detail}`);
    }
    process.exit(r.findings.length === 0 ? 0 : 1);
  } catch (e) {
    console.error("gate error:", e && e.stack || e);
    process.exit(2);
  }
}
main();
