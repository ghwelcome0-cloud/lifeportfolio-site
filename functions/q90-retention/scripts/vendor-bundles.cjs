#!/usr/bin/env node
"use strict";
/**
 * q90-retention — bundle vendoring (build step for the engine runner).
 *
 * Copies the manifest-pinned bundle files of ONE frozen git commit of the bundle branch into
 * functions/q90-retention/bundles/ so the runner is self-sufficient at deploy time (no sibling worktree,
 * no working-tree assets/js or data/). Zero dependencies: node + git.
 *
 *   node scripts/vendor-bundles.cjs build   [--commit <sha>] [--out <dir>]   write bundles/** + PIN.json
 *   node scripts/vendor-bundles.cjs check   [--out <dir>]                    rebuild to a temp dir, compare byte-for-byte
 *   node scripts/vendor-bundles.cjs self-test                                negative controls (tamper, path escape, extra file, bad pin)
 *
 * Trust boundary
 *  - Source of truth is the git object store: files are read with `git show <commit>:<path>` from
 *    SOURCE_COMMIT (default: the frozen bundle commit below). The current checkout / working tree is
 *    never read, so an edited local engine cannot be vendored.
 *  - The manifest is verified first (schema, entrypoint file sets), then EVERY listed file's sha256 and
 *    byte length, then bundleHash and every entrypointHash are recomputed with the build-bundles formula.
 *    Any mismatch aborts before a single byte is written.
 *  - Only paths listed in the manifest are written; each must be a normalised relative path under
 *    assets/js/bundles/<version>/ or assets/data/bundles/<version>/ (no "..", no absolute, no backslash,
 *    no duplicate after normalisation). The output directory is emptied first, so a stray extra file
 *    cannot survive a build, and `check` fails on extra/missing/changed files.
 *  - PIN.json records sourceCommit, manifestSha256 and every file hash. The runner MUST be opened with
 *    that pin (createVendoredRunner in runner.js); an unpinned or mismatching manifest is refused.
 *  - The legacy bundle bytes are never modified: this script copies, hashes, compares — nothing else.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const SOURCE_COMMIT = "b4f18c756d4a0ab4f2bdd18c3e0fe5a5f1acc09f"; // q90/retention-bundle head (3822435 review fixes)
const MANIFEST_REL = "assets/data/bundles/manifest.json";
const MANIFEST_SCHEMA = "q90-bundle-manifest/1";
const PIN_SCHEMA = "q90-vendor-pin/1";
const ENTRYPOINTS = {
  "initial-generation": { engines: ["report-engine.js", "report-engine-v4.js"], data: ["questions.json", "mapping.json", "report-rules.json"] },
  "regeneration": { engines: ["report-engine.js", "report-engine-v4.js", "career-engine.js"], data: ["questions.json", "mapping.json", "report-rules.json", "career-rules.json"] },
  "program-generation": { engines: ["program-engine.js", "career-engine.js"], data: ["program-rules.json", "career-rules.json", "mapping.json"] },
};
const DEFAULT_OUT = path.resolve(__dirname, "..", "bundles");
const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");

const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
const sameList = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i]);

class VendorError extends Error { constructor(code, msg) { super(msg || code); this.code = code; } }

// ---- source readers -------------------------------------------------------------------------------
function gitReader(commit, cwd) {
  const rev = execFileSync("git", ["rev-parse", "--verify", `${commit}^{commit}`], { cwd, encoding: "utf8" }).trim();
  if (rev !== commit) throw new VendorError("SOURCE_COMMIT_MISMATCH", `resolved ${rev}, expected full sha ${commit}`);
  return { id: commit, read: (rel) => execFileSync("git", ["show", `${commit}:${rel}`], { cwd, maxBuffer: 64 * 1024 * 1024 }) };
}
// used by self-test only: read from a plain directory (so tamper cases need no git commit)
function dirReader(root) {
  return { id: `dir:${root}`, read: (rel) => fs.readFileSync(path.join(root, rel)) };
}

// ---- path policy ----------------------------------------------------------------------------------
function assertSafeRel(rel, version) {
  if (typeof rel !== "string" || !rel.length || rel.length > 200) throw new VendorError("PATH_POLICY", `bad path ${rel}`);
  if (/[\\\0]/.test(rel) || path.posix.isAbsolute(rel) || rel.split("/").some((seg) => seg === "" || seg === "." || seg === "..")) throw new VendorError("PATH_POLICY", `path escape or malformed segment: ${rel}`);
  if (path.posix.normalize(rel) !== rel) throw new VendorError("PATH_POLICY", `non-normalised path: ${rel}`);
  const ok = rel.startsWith(`assets/js/bundles/${version}/`) || rel.startsWith(`assets/data/bundles/${version}/`);
  if (!ok || rel.split("/").length !== 5) throw new VendorError("PATH_POLICY", `path outside the bundle directory of ${version}: ${rel}`);
  if (!/^[A-Za-z0-9._-]+$/.test(path.posix.basename(rel))) throw new VendorError("PATH_POLICY", `bad file name: ${rel}`);
}

// ---- verify + collect -----------------------------------------------------------------------------
function collectVerified(reader) {
  const manifestBuf = reader.read(MANIFEST_REL);
  const manifest = JSON.parse(manifestBuf.toString("utf8"));
  if (manifest.schema !== MANIFEST_SCHEMA) throw new VendorError("MANIFEST_SCHEMA", "unexpected manifest schema");
  for (const [ep, spec] of Object.entries(ENTRYPOINTS)) {
    const m = manifest.entrypoints && manifest.entrypoints[ep];
    if (!m || !sameList(m.engines, spec.engines) || !sameList(m.data, spec.data)) throw new VendorError("MANIFEST_ENTRYPOINT_MISMATCH", `entrypoint ${ep}`);
  }
  const files = new Map(); // rel -> Buffer
  for (const [version, entry] of Object.entries(manifest.bundles)) {
    if (!/^[A-Za-z0-9._-]+$/.test(version)) throw new VendorError("PATH_POLICY", `bad bundle version ${version}`);
    for (const [rel, meta] of Object.entries(entry.files)) {
      assertSafeRel(rel, version);
      if (files.has(rel)) throw new VendorError("PATH_POLICY", `duplicate path ${rel}`);
      const buf = reader.read(rel);
      if (sha256(buf) !== meta.sha256 || buf.length !== meta.bytes) throw new VendorError("BUNDLE_INTEGRITY", `${rel} does not match manifest`);
      files.set(rel, buf);
    }
    const sorted = Object.keys(entry.files).sort();
    if (sha256(sorted.map((p) => `${p}:${entry.files[p].sha256}`).join("\n")) !== entry.bundleHash) throw new VendorError("BUNDLE_INTEGRITY", `bundleHash ${version}`);
    for (const [ep, spec] of Object.entries(ENTRYPOINTS)) {
      const parts = [...spec.engines.map((f) => `assets/js/bundles/${version}/${f}`), ...spec.data.map((f) => `assets/data/bundles/${version}/${f}`)].sort();
      for (const p of parts) if (!entry.files[p]) throw new VendorError("BUNDLE_INTEGRITY", `${version}: ${p} required by ${ep} missing`);
      const h = sha256(parts.map((p) => `${p}:${entry.files[p].sha256}`).join("\n"));
      if (!entry.entrypointHashes || entry.entrypointHashes[ep] !== h) throw new VendorError("BUNDLE_INTEGRITY", `${version}: entrypointHash ${ep}`);
    }
  }
  return { manifestBuf, manifest, files };
}

// ---- write ------------------------------------------------------------------------------------------
function writeTree(outDir, reader, verified) {
  const outAbs = path.resolve(outDir);
  if (outAbs === "/" || outAbs === REPO_ROOT || !outAbs.startsWith(path.resolve(REPO_ROOT, "functions") + path.sep) && !outAbs.startsWith(os.tmpdir() + path.sep)) {
    throw new VendorError("OUT_POLICY", `refusing to write outside functions/ or the temp dir: ${outAbs}`);
  }
  fs.rmSync(outAbs, { recursive: true, force: true }); // extra files cannot survive a build
  const fileHashes = {};
  for (const [rel, buf] of verified.files) {
    const abs = path.join(outAbs, rel);
    if (!abs.startsWith(outAbs + path.sep)) throw new VendorError("PATH_POLICY", rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, buf);
    fileHashes[rel] = sha256(buf);
  }
  fs.mkdirSync(path.dirname(path.join(outAbs, MANIFEST_REL)), { recursive: true });
  fs.writeFileSync(path.join(outAbs, MANIFEST_REL), verified.manifestBuf);
  const pin = {
    schema: PIN_SCHEMA,
    sourceCommit: reader.id,
    manifestPath: MANIFEST_REL,
    manifestSha256: sha256(verified.manifestBuf),
    bundles: Object.fromEntries(Object.entries(verified.manifest.bundles).map(([v, e]) => [v, { bundleHash: e.bundleHash, entrypointHashes: e.entrypointHashes }])),
    files: Object.fromEntries(Object.keys(fileHashes).sort().map((k) => [k, fileHashes[k]])),
    // no timestamp: a rebuild from the same commit is byte-identical
  };
  fs.writeFileSync(path.join(outAbs, "PIN.json"), JSON.stringify(pin, null, 2) + "\n");
  return pin;
}

// ---- compare (check / tamper detection) --------------------------------------------------------------
function listFiles(root) {
  const out = [];
  (function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(abs); else out.push(path.relative(root, abs).split(path.sep).join("/"));
    }
  })(root);
  return out.sort();
}
function compareTrees(a, b) {
  const fa = listFiles(a), fb = listFiles(b);
  const diffs = [];
  for (const f of new Set([...fa, ...fb])) {
    const ia = fa.includes(f), ib = fb.includes(f);
    if (!ia) diffs.push(`extra: ${f}`);
    else if (!ib) diffs.push(`missing: ${f}`);
    else if (!fs.readFileSync(path.join(a, f)).equals(fs.readFileSync(path.join(b, f)))) diffs.push(`changed: ${f}`);
  }
  return diffs;
}
// verify an existing vendored dir against its own PIN (what the runner relies on) — no git needed
function verifyVendored(outDir, expectedCommit) {
  const pin = JSON.parse(fs.readFileSync(path.join(outDir, "PIN.json"), "utf8"));
  if (pin.schema !== PIN_SCHEMA) throw new VendorError("PIN_SCHEMA", "unexpected PIN schema");
  if (expectedCommit && pin.sourceCommit !== expectedCommit) throw new VendorError("PIN_SOURCE_MISMATCH", `pin ${pin.sourceCommit} != ${expectedCommit}`);
  const manifestBuf = fs.readFileSync(path.join(outDir, MANIFEST_REL));
  if (sha256(manifestBuf) !== pin.manifestSha256) throw new VendorError("PIN_MANIFEST_MISMATCH", "manifest does not match pin");
  const verified = collectVerified(dirReader(outDir));
  const present = listFiles(outDir).filter((f) => f !== "PIN.json" && f !== MANIFEST_REL);
  const pinned = Object.keys(pin.files).sort();
  if (!sameList(present, pinned)) throw new VendorError("VENDORED_TREE_MISMATCH", `files differ from pin: ${JSON.stringify({ present, pinned })}`);
  for (const rel of pinned) if (sha256(verified.files.get(rel)) !== pin.files[rel]) throw new VendorError("BUNDLE_INTEGRITY", `${rel} != pin`);
  return { pin, verified };
}

// ---- commands --------------------------------------------------------------------------------------
function build({ commit = SOURCE_COMMIT, out = DEFAULT_OUT, cwd = REPO_ROOT } = {}) {
  const reader = gitReader(commit, cwd);
  const verified = collectVerified(reader);
  const pin = writeTree(out, reader, verified);
  verifyVendored(out, commit);
  return { out, files: verified.files.size, manifestSha256: pin.manifestSha256, sourceCommit: commit };
}
function check({ out = DEFAULT_OUT, cwd = REPO_ROOT } = {}) {
  const { pin } = verifyVendored(out, SOURCE_COMMIT);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "q90-vendor-check-"));
  try {
    build({ commit: pin.sourceCommit, out: tmp, cwd });
    const diffs = compareTrees(out, tmp);
    if (diffs.length) throw new VendorError("REBUILD_NOT_IDENTICAL", diffs.join("; "));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  return { out, sourceCommit: pin.sourceCommit, manifestSha256: pin.manifestSha256, files: Object.keys(pin.files).length, identical: true };
}
function selfTest({ cwd = REPO_ROOT } = {}) {
  const results = [];
  const expectFail = (id, fn, code) => { try { fn(); results.push({ id, ok: false, note: "did not fail" }); } catch (e) { results.push({ id, ok: e.code === code, code: e.code }); } };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "q90-vendor-selftest-"));
  try {
    const good = path.join(tmp, "good");
    build({ out: good, cwd });
    results.push({ id: "build-from-git", ok: fs.existsSync(path.join(good, "PIN.json")) });
    // rebuild identity
    const again = path.join(tmp, "again"); build({ out: again, cwd });
    results.push({ id: "rebuild-byte-identical", ok: compareTrees(good, again).length === 0 });
    // tamper: one byte in a vendored engine
    const t1 = path.join(tmp, "t1"); fs.cpSync(good, t1, { recursive: true });
    fs.appendFileSync(path.join(t1, "assets/js/bundles/legacy-b03e219/report-engine.js"), "\n//x\n");
    expectFail("tamper-engine-byte", () => verifyVendored(t1, SOURCE_COMMIT), "BUNDLE_INTEGRITY");
    // tamper: manifest edited consistently (hash of a file + entrypointHash) -> pin catches the manifest
    const t2 = path.join(tmp, "t2"); fs.cpSync(good, t2, { recursive: true });
    const m = JSON.parse(fs.readFileSync(path.join(t2, MANIFEST_REL), "utf8")); m.bundles["legacy-b03e219"].entrypointHashes.regeneration = "f".repeat(64);
    fs.writeFileSync(path.join(t2, MANIFEST_REL), JSON.stringify(m));
    expectFail("tamper-manifest-vs-pin", () => verifyVendored(t2, SOURCE_COMMIT), "PIN_MANIFEST_MISMATCH");
    // manifest + pin both edited -> recomputation catches the lie
    const t3 = path.join(tmp, "t3"); fs.cpSync(t2, t3, { recursive: true });
    const pin3 = JSON.parse(fs.readFileSync(path.join(t3, "PIN.json"), "utf8")); pin3.manifestSha256 = sha256(fs.readFileSync(path.join(t3, MANIFEST_REL)));
    fs.writeFileSync(path.join(t3, "PIN.json"), JSON.stringify(pin3));
    expectFail("tamper-manifest-and-pin", () => verifyVendored(t3, SOURCE_COMMIT), "BUNDLE_INTEGRITY");
    // extra file smuggled into the vendored tree
    const t4 = path.join(tmp, "t4"); fs.cpSync(good, t4, { recursive: true });
    fs.writeFileSync(path.join(t4, "assets/js/bundles/legacy-b03e219/extra.js"), "//");
    expectFail("extra-file", () => verifyVendored(t4, SOURCE_COMMIT), "VENDORED_TREE_MISMATCH");
    // path escape in a manifest read from a directory source
    const t5 = path.join(tmp, "t5"); fs.cpSync(good, t5, { recursive: true });
    const m5 = JSON.parse(fs.readFileSync(path.join(t5, MANIFEST_REL), "utf8"));
    const f = m5.bundles["legacy-b03e219"].files; const k = Object.keys(f)[0]; f["assets/js/bundles/legacy-b03e219/../../../../functions/index.js"] = f[k];
    fs.writeFileSync(path.join(t5, MANIFEST_REL), JSON.stringify(m5));
    expectFail("path-escape", () => collectVerified(dirReader(t5)), "PATH_POLICY");
    const m6 = JSON.parse(JSON.stringify(m5)); delete m6.bundles["legacy-b03e219"].files["assets/js/bundles/legacy-b03e219/../../../../functions/index.js"]; m6.bundles["legacy-b03e219"].files["/etc/passwd"] = f[k];
    fs.writeFileSync(path.join(t5, MANIFEST_REL), JSON.stringify(m6));
    expectFail("absolute-path", () => collectVerified(dirReader(t5)), "PATH_POLICY");
    const m7 = JSON.parse(JSON.stringify(m5)); delete m7.bundles["legacy-b03e219"].files["assets/js/bundles/legacy-b03e219/../../../../functions/index.js"]; m7.bundles["legacy-b03e219"].files["assets/js/other.js"] = f[k];
    fs.writeFileSync(path.join(t5, MANIFEST_REL), JSON.stringify(m7));
    expectFail("outside-bundle-dir", () => collectVerified(dirReader(t5)), "PATH_POLICY");
    // wrong pinned commit
    expectFail("pin-source-commit", () => verifyVendored(good, "0".repeat(40)), "PIN_SOURCE_MISMATCH");
    // output policy: never outside functions/ or tmp
    expectFail("out-policy", () => writeTree(path.join(cwd, "assets"), dirReader(good), collectVerified(dirReader(good))), "OUT_POLICY");
    // short sha refused (must be the full frozen sha)
    expectFail("short-sha-refused", () => gitReader(SOURCE_COMMIT.slice(0, 7), cwd), "SOURCE_COMMIT_MISMATCH");
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  return { results, pass: results.filter((r) => r.ok).length, fail: results.filter((r) => !r.ok).length };
}

module.exports = { SOURCE_COMMIT, MANIFEST_REL, PIN_SCHEMA, DEFAULT_OUT, build, check, selfTest, verifyVendored, collectVerified, VendorError };

if (require.main === module) {
  const [cmd, ...rest] = process.argv.slice(2);
  const opt = {}; for (let i = 0; i < rest.length; i += 2) opt[rest[i].replace(/^--/, "")] = rest[i + 1];
  try {
    let res;
    if (cmd === "build") res = build({ commit: opt.commit, out: opt.out });
    else if (cmd === "check") res = check({ out: opt.out });
    else if (cmd === "self-test") res = selfTest({});
    else { console.error("usage: vendor-bundles.cjs build|check|self-test [--commit sha] [--out dir]"); process.exit(64); }
    console.log(JSON.stringify(res, null, 2));
    if (res.fail) process.exit(1);
  } catch (e) { console.error(JSON.stringify({ error: e.code || "ERROR", message: e.message })); process.exit(1); }
}
