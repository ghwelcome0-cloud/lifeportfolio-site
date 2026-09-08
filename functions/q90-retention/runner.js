"use strict";
/**
 * q90-retention — bundle engine runner.
 *
 * Loads a pinned bundle (files + manifest) from a directory, verifies every file's sha256 against
 * assets/data/bundles/manifest.json BEFORE executing anything, recomputes bundleHash and every
 * entrypointHash from those verified file hashes (manifest values are checked, never echoed), runs the
 * requested entrypoint in an isolated vm context whose clock is the server-supplied publishedAt, and returns
 * { report, program, bundleHash, entrypointHash, bundleVersion, entrypoint, sid, publishedAt, generatedAt }.
 * Trust boundary: ENTRYPOINTS below is the hard-coded file-set anchor; opts.pinnedManifestSha256 lets the
 * vendoring step pin the exact manifest.
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

// Hard-coded mirror of scripts/q90/bundle-patches.mjs ENTRYPOINTS (engine/data sets per entrypoint).
// This is the runner's trust anchor: the manifest's `entrypoints` block must equal it, and every
// entrypointHash is RECOMPUTED from verified file hashes with the build-bundles formula — a manifest
// value is never echoed. A manifest that disagrees is rejected before anything executes.
const ENTRYPOINTS = Object.freeze({
  "initial-generation": Object.freeze({ career: false, engines: ["report-engine.js", "report-engine-v4.js"], data: ["questions.json", "mapping.json", "report-rules.json"] }),
  "regeneration": Object.freeze({ career: true, engines: ["report-engine.js", "report-engine-v4.js", "career-engine.js"], data: ["questions.json", "mapping.json", "report-rules.json", "career-rules.json"] }),
});
const idSafe = (v) => typeof v === "string" && v.length > 0 && v.length <= 128 && /^[A-Za-z0-9_-]+$/.test(v);
const sameList = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i]);

// Product clock for the engines: every `new Date()` / `Date.now()` inside the vm resolves to the
// server-supplied generatedAt, so report.generatedAt, _v4Meta.generatedAt, program.meta.generatedAt and
// program.meta.publishedAt all carry the SAME server instant and the output is a pure function of the
// request. The host process clock (and any test clock) never reaches the engines.
function frozenDate(ms) {
  class FrozenDate extends Date {
    constructor(...args) { if (args.length === 0) super(ms); else super(...args); }
    static now() { return ms; }
  }
  return FrozenDate;
}

function createBundleRunner(opts) {
  if (!opts || !opts.bundleRoot) throw new Error("createBundleRunner: bundleRoot required");
  const bundleRoot = opts.bundleRoot;          // directory containing assets/js/bundles/** and assets/data/bundles/**
  const manifestPath = opts.manifestPath || path.join(bundleRoot, "assets", "data", "bundles", "manifest.json");
  const manifestText = fs.readFileSync(manifestPath, "utf8");
  // optional pin: the vendoring/deploy step records the manifest sha256 it shipped; a different manifest
  // at runtime is refused even if it is internally consistent
  if (opts.pinnedManifestSha256 !== undefined && sha256(manifestText) !== opts.pinnedManifestSha256) throw new RunnerError("MANIFEST_PINNED_MISMATCH", "manifest.json does not match the pinned sha256");
  const manifest = JSON.parse(manifestText);
  if (manifest.schema !== "q90-bundle-manifest/1") throw new RunnerError("MANIFEST_SCHEMA", "unexpected manifest schema");
  // the manifest's entrypoint file sets must equal the runner's hard-coded ones (trust anchor)
  for (const [ep, spec] of Object.entries(ENTRYPOINTS)) {
    const m = manifest.entrypoints && manifest.entrypoints[ep];
    if (!m || !sameList(m.engines, spec.engines) || !sameList(m.data, spec.data)) throw new RunnerError("MANIFEST_ENTRYPOINT_MISMATCH", `manifest entrypoint ${ep} does not match the runner's pinned file set`);
  }
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
    // recompute bundleHash AND every entrypointHash exactly as build-bundles.mjs does, from the file hashes
    // that were just verified against real content; the manifest's recorded values must agree
    const allSorted = Object.keys(entry.files).sort();
    const bundleHash = sha256(allSorted.map((p) => `${p}:${entry.files[p].sha256}`).join("\n"));
    if (bundleHash !== entry.bundleHash) throw new RunnerError("BUNDLE_INTEGRITY", "bundleHash mismatch");
    const entrypointHashes = {};
    for (const [ep, spec] of Object.entries(ENTRYPOINTS)) {
      // build-bundles.mjs formula: sorted "path:sha256" lines of exactly the files the entrypoint loads
      const parts = [...spec.engines.map((f) => `assets/js/bundles/${bundleVersion}/${f}`), ...spec.data.map((f) => `assets/data/bundles/${bundleVersion}/${f}`)].sort();
      for (const p of parts) if (!entry.files[p]) throw new RunnerError("BUNDLE_INTEGRITY", `${p} required by entrypoint ${ep} is not in the bundle`);
      entrypointHashes[ep] = sha256(parts.map((p) => `${p}:${entry.files[p].sha256}`).join("\n"));
      if (!entry.entrypointHashes || entry.entrypointHashes[ep] !== entrypointHashes[ep]) throw new RunnerError("BUNDLE_INTEGRITY", `entrypointHash for ${ep} does not match recomputation`);
    }
    const loaded = { version: bundleVersion, entry, files, bundleHash, entrypointHashes };
    cache.set(bundleVersion, loaded);
    return loaded;
  }

  function js(loaded, name) { return loaded.files[`assets/js/bundles/${loaded.version}/${name}`]; }
  function data(loaded, name) { return JSON.parse(loaded.files[`assets/data/bundles/${loaded.version}/${name}`]); }

  function runModule(source, filename, ctx, DateImpl) {
    const sandbox = { module: { exports: {} }, console: { log() {}, warn() {}, error() {} }, Date: DateImpl, ...ctx };
    sandbox.exports = sandbox.module.exports;
    vm.runInNewContext(source, sandbox, { filename, timeout: opts.timeoutMs || 20000 });
    return sandbox.module.exports;
  }

  // req: { bundle, entrypoint, answers, profile, locale, sid, publishedAt }
  //   sid         — required; the source responses session id, bound INTO the program payload as
  //                 program.meta.sourceReportSid (payload-level link, separate from the instance doc link)
  //   publishedAt — required; server instant as a strict ISO-8601 UTC string ("2026-09-08T00:00:00.000Z",
  //                 i.e. exactly what new Date(x).toISOString() yields). It becomes the engines' clock:
  //                 report.generatedAt, report._v4Meta.generatedAt, program.meta.generatedAt and
  //                 program.meta.publishedAt all derive from it. The runner host clock never reaches the vm.
  async function runBundle(req) {
    const { bundle: bundleVersion, entrypoint, answers, profile, locale, sid, publishedAt } = req || {};
    if (!ENTRYPOINTS[entrypoint]) throw new RunnerError("UNKNOWN_ENTRYPOINT", `entrypoint ${entrypoint}`);
    if (locale !== "ko" && locale !== "en") throw new RunnerError("BAD_LOCALE", `locale ${locale}`);
    if (!idSafe(sid)) throw new RunnerError("SID_REQUIRED", "req.sid (source session id) is required");
    const generatedAt = parseServerIso(publishedAt);
    if (generatedAt === null) throw new RunnerError("PUBLISHED_AT_REQUIRED", "req.publishedAt must be a strict ISO-8601 UTC string (Date#toISOString form) of the server instant");
    const loaded = loadVerified(bundleVersion);
    const DateImpl = frozenDate(generatedAt);

    const questions = data(loaded, "questions.json"), mapping = data(loaded, "mapping.json"), rules = data(loaded, "report-rules.json");
    const careerRules = data(loaded, "career-rules.json"), programRules = data(loaded, "program-rules.json");
    const career = runModule(js(loaded, "career-engine.js"), "career-engine.js", {}, DateImpl);
    const withCareer = (id) => { if (/career-engine/.test(id)) return career; throw new Error("no module " + id); };
    const withoutCareer = (id) => { throw new Error("no module " + id); };

    // report: entrypoint decides career-engine availability AND careerRules injection (P18)
    const useCareer = ENTRYPOINTS[entrypoint].career;
    const reportEngine = runModule(js(loaded, "report-engine.js"), "report-engine.js", useCareer ? { require: withCareer, CareerEngine: career } : { require: withoutCareer }, DateImpl);
    const v4 = runModule(js(loaded, "report-engine-v4.js"), "report-engine-v4.js", useCareer ? { require: withCareer } : { require: withoutCareer }, DateImpl);
    const args = { questions, mapping, rules, answers: answers || {}, profile: profile || {}, lang: locale };
    if (useCareer) args.careerRules = careerRules;
    const raw = reportEngine.build(args);
    const report = v4.upgrade(raw, args);
    if (!report || !Array.isArray(report.sections) || !report._v4Meta) throw new RunnerError("REPORT_INCOMPLETE", "v4 upgrade did not produce a report");

    // program: program-loading.html path — from the report just built (same instance), career engine present
    const programEngine = runModule(js(loaded, "program-engine.js"), "program-engine.js", { require: withCareer, CareerEngine: career }, DateImpl);
    const program = programEngine.build({ report, rules: programRules, careerRules, mapping, name: (profile && profile.name) || "", sourceSid: sid, publishedAt: new DateImpl(generatedAt), lang: locale });
    if (!program || !program.meta) throw new RunnerError("PROGRAM_INCOMPLETE", "program engine did not produce a program");
    // payload-level bindings the engines are expected to have written; refuse to hand back an unbound payload
    if (program.meta.sourceReportSid !== sid) throw new RunnerError("PROGRAM_INCOMPLETE", "program.meta.sourceReportSid is not bound to req.sid");
    if (program.meta.publishedAt !== fmtDateLikeEngine(new DateImpl(generatedAt))) throw new RunnerError("PROGRAM_INCOMPLETE", "program.meta.publishedAt is not the server generatedAt");

    return {
      report, program,
      bundleVersion, entrypoint, sid, publishedAt, generatedAt,
      bundleHash: loaded.bundleHash,
      entrypointHash: loaded.entrypointHashes[entrypoint], // recomputed, not read from the manifest
      reportEngineVersion: report.engineVersion,
    };
  }

  return { runBundle, loadVerified, manifest };
}

// strict: only the canonical toISOString form, and it must round-trip (rejects Date objects, ms numbers,
// offsets, missing millis) so two callers can never describe the same instant two ways
function parseServerIso(v) {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)) return null;
  const ms = Date.parse(v);
  if (!Number.isFinite(ms) || ms <= 0 || new Date(ms).toISOString() !== v) return null;
  return ms;
}

// program-engine fmtDate: "YYYY.MM.DD" in the process timezone (Functions run in UTC; pin TZ=UTC in tests)
function fmtDateLikeEngine(d) {
  const pad = (n) => (n < 10 ? "0" + n : "" + n);
  return d.getFullYear() + "." + pad(d.getMonth() + 1) + "." + pad(d.getDate());
}

module.exports = { createBundleRunner, RunnerError, ENTRYPOINTS };
