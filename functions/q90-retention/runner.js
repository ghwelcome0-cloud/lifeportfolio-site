"use strict";
/**
 * q90-retention — bundle engine runner.
 *
 * Loads a pinned bundle (files + manifest) from a directory, verifies every file's sha256 against
 * assets/data/bundles/manifest.json BEFORE executing anything, runs the requested entrypoint in an
 * isolated vm context, and returns { report, program, bundleHash, entrypointHash, bundleVersion, entrypoint }.
 *
 * The runner never reads the working-tree assets/js or data/: it only reads the bundle directory it was
 * given (in production a vendored copy under functions/q90-retention/bundles/, produced by a build step
 * that copies the manifest-pinned files — that build step is NOT part of this module).
 *
 * Entry points mirror the b03e219 pages (see scripts/q90/bundle-patches.mjs ENTRYPOINTS):
 *   initial-generation : report-loading.html  -> report-engine + v4, NO career engine, NO careerRules
 *   regeneration       : report.html          -> report-engine + v4 + career engine + careerRules
 * Both then produce the program through program-engine (+ career engine + program/career rules), which is
 * what program-loading.html does from the saved report.
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");

const sha256 = (s) => crypto.createHash("sha256").update(typeof s === "string" ? s : JSON.stringify(s)).digest("hex");

class RunnerError extends Error {
  constructor(code, message) { super(message || code); this.code = code; }
}

const ENTRYPOINTS = Object.freeze({
  "initial-generation": { career: false },
  "regeneration": { career: true },
});

function createBundleRunner(opts) {
  if (!opts || !opts.bundleRoot) throw new Error("createBundleRunner: bundleRoot required");
  const bundleRoot = opts.bundleRoot;          // directory containing assets/js/bundles/** and assets/data/bundles/**
  const manifestPath = opts.manifestPath || path.join(bundleRoot, "assets", "data", "bundles", "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (manifest.schema !== "q90-bundle-manifest/1") throw new RunnerError("MANIFEST_SCHEMA", "unexpected manifest schema");
  const cache = new Map(); // bundleVersion -> verified loaded bundle

  function loadVerified(bundleVersion) {
    if (cache.has(bundleVersion)) return cache.get(bundleVersion);
    const entry = manifest.bundles[bundleVersion];
    if (!entry) throw new RunnerError("UNKNOWN_BUNDLE", `bundle ${bundleVersion} not in manifest`);
    const files = {};
    for (const [rel, meta] of Object.entries(entry.files)) {
      const abs = path.join(bundleRoot, rel);
      let content;
      try { content = fs.readFileSync(abs, "utf8"); } catch (e) { throw new RunnerError("BUNDLE_FILE_MISSING", `${rel}: ${e.message}`); }
      if (sha256(content) !== meta.sha256 || Buffer.byteLength(content) !== meta.bytes) throw new RunnerError("BUNDLE_INTEGRITY", `${rel} does not match manifest`);
      files[rel] = content;
    }
    // recompute bundleHash / entrypoint hashes exactly as build-bundles.mjs does and compare
    const allSorted = Object.keys(entry.files).sort();
    const bundleHash = sha256(allSorted.map((p) => `${p}:${entry.files[p].sha256}`).join("\n"));
    if (bundleHash !== entry.bundleHash) throw new RunnerError("BUNDLE_INTEGRITY", "bundleHash mismatch");
    const loaded = { version: bundleVersion, entry, files, bundleHash };
    cache.set(bundleVersion, loaded);
    return loaded;
  }

  function js(loaded, name) { return loaded.files[`assets/js/bundles/${loaded.version}/${name}`]; }
  function data(loaded, name) { return JSON.parse(loaded.files[`assets/data/bundles/${loaded.version}/${name}`]); }

  function runModule(source, filename, ctx) {
    const sandbox = { module: { exports: {} }, console: { log() {}, warn() {}, error() {} }, Date, ...ctx };
    sandbox.exports = sandbox.module.exports;
    vm.runInNewContext(source, sandbox, { filename, timeout: opts.timeoutMs || 20000 });
    return sandbox.module.exports;
  }

  async function runBundle(req) {
    const { bundle: bundleVersion, entrypoint, answers, profile, locale } = req || {};
    if (!ENTRYPOINTS[entrypoint]) throw new RunnerError("UNKNOWN_ENTRYPOINT", `entrypoint ${entrypoint}`);
    if (locale !== "ko" && locale !== "en") throw new RunnerError("BAD_LOCALE", `locale ${locale}`);
    const loaded = loadVerified(bundleVersion);
    const epSpec = manifest.entrypoints[entrypoint];
    if (!epSpec || !loaded.entry.entrypointHashes[entrypoint]) throw new RunnerError("UNKNOWN_ENTRYPOINT", `entrypoint ${entrypoint} not in manifest`);

    const questions = data(loaded, "questions.json"), mapping = data(loaded, "mapping.json"), rules = data(loaded, "report-rules.json");
    const careerRules = data(loaded, "career-rules.json"), programRules = data(loaded, "program-rules.json");
    const career = runModule(js(loaded, "career-engine.js"), "career-engine.js", {});
    const withCareer = (id) => { if (/career-engine/.test(id)) return career; throw new Error("no module " + id); };
    const withoutCareer = (id) => { throw new Error("no module " + id); };

    // report: entrypoint decides career-engine availability AND careerRules injection (P18)
    const useCareer = ENTRYPOINTS[entrypoint].career;
    const reportEngine = runModule(js(loaded, "report-engine.js"), "report-engine.js", useCareer ? { require: withCareer, CareerEngine: career } : { require: withoutCareer });
    const v4 = runModule(js(loaded, "report-engine-v4.js"), "report-engine-v4.js", useCareer ? { require: withCareer } : { require: withoutCareer });
    const args = { questions, mapping, rules, answers: answers || {}, profile: profile || {}, lang: locale };
    if (useCareer) args.careerRules = careerRules;
    const raw = reportEngine.build(args);
    const report = v4.upgrade(raw, args);
    if (!report || !Array.isArray(report.sections) || !report._v4Meta) throw new RunnerError("REPORT_INCOMPLETE", "v4 upgrade did not produce a report");

    // program: program-loading.html path — from the report just built (same instance), career engine present
    const programEngine = runModule(js(loaded, "program-engine.js"), "program-engine.js", { require: withCareer, CareerEngine: career });
    const program = programEngine.build({ report, rules: programRules, careerRules, mapping, name: (profile && profile.name) || "", sourceSid: req.sid || null, publishedAt: new Date(0), lang: locale });
    if (!program || !program.meta) throw new RunnerError("PROGRAM_INCOMPLETE", "program engine did not produce a program");

    return {
      report, program,
      bundleVersion, entrypoint,
      bundleHash: loaded.bundleHash,
      entrypointHash: loaded.entry.entrypointHashes[entrypoint],
      reportEngineVersion: report.engineVersion,
    };
  }

  return { runBundle, loadVerified, manifest };
}

module.exports = { createBundleRunner, RunnerError, ENTRYPOINTS };
