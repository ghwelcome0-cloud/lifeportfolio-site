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
 *  - PINNED_MANIFEST_SHA256 (in code) is the independent anchor: manifest.json AND PIN.manifestSha256 must
 *    both equal it. A coherent rewrite of payload + manifest + PIN is therefore refused (3868172 #1).
 *  - Output policy (3868172 #2): the output directory is exactly `bundles/` (DEFAULT_OUT) or an empty /
 *    previously-vendored directory under the OS temp dir. Every path component is checked for symlinks; the
 *    source module directory, its parents, the repo, and any directory that is not empty or not a previous
 *    vendored tree are refused BEFORE anything is deleted. Writes go to a sibling staging directory and are
 *    swapped in atomically (rename) after verification; the previous tree is restored if the swap fails.
 *  - The legacy bundle bytes are never modified: this script copies, hashes, compares — nothing else.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const SOURCE_COMMIT = "b4f18c756d4a0ab4f2bdd18c3e0fe5a5f1acc09f"; // q90/retention-bundle head (3822435 review fixes)
const MANIFEST_REL = "assets/data/bundles/manifest.json";
// Independent trust anchor (3868172 #1): sha256 of assets/data/bundles/manifest.json at SOURCE_COMMIT, fixed in
// CODE. A vendored tree whose manifest (and therefore PIN) was rewritten coherently with mutated payload files is
// refused here, because PIN.json and manifest.json travel together and can be forged together; this constant
// cannot be changed without changing this reviewed file. Limit: this is an artifact-integrity boundary — an
// attacker who can rewrite the deployed runtime code itself is out of scope for any in-package check.
const PINNED_MANIFEST_SHA256 = "d0bdd52d66e24329f63c3e3710451042611d3139f9472e4f43a425b1cdabeeea";
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
  if (sha256(manifestBuf) !== PINNED_MANIFEST_SHA256) throw new VendorError("MANIFEST_ANCHOR_MISMATCH", "manifest.json does not match the code-pinned sha256 of the frozen bundle commit");
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

// ---- output policy + atomic write ------------------------------------------------------------------------
const MODULE_DIR = path.resolve(__dirname, "..");          // functions/q90-retention (the source module)
const VENDORED_MARKERS = new Set(["PIN.json", "assets"]);

// every existing component of `p` must be a real directory (no symlink anywhere in the chain)
function assertNoSymlinkChain(p) {
  let cur = p;
  const parts = [];
  while (!fs.existsSync(cur)) { parts.unshift(path.basename(cur)); const up = path.dirname(cur); if (up === cur) break; cur = up; }
  const real = fs.realpathSync(cur);
  if (real !== cur) throw new VendorError("OUT_POLICY", `symlink in output path: ${cur} -> ${real}`);
  let walk = cur;
  for (;;) { if (fs.lstatSync(walk).isSymbolicLink()) throw new VendorError("OUT_POLICY", `symlink component ${walk}`); const up = path.dirname(walk); if (up === walk) break; walk = up; }
  return path.join(cur, ...parts);
}
// existing dir is acceptable only when empty or when it is a previous vendored tree (PIN.json + assets, nothing else)
function assertReplaceableDir(outAbs) {
  if (!fs.existsSync(outAbs)) return;
  const st = fs.lstatSync(outAbs);
  if (st.isSymbolicLink() || !st.isDirectory()) throw new VendorError("OUT_POLICY", `output exists and is not a plain directory: ${outAbs}`);
  const entries = fs.readdirSync(outAbs);
  if (entries.length === 0) return;
  const onlyVendored = entries.every((e) => VENDORED_MARKERS.has(e)) && entries.includes("PIN.json");
  if (!onlyVendored) throw new VendorError("OUT_POLICY", `output directory is neither empty nor a previous vendored tree: ${outAbs}`);
}
function resolveOutDir(outDir) {
  if (typeof outDir !== "string" || !outDir.length) throw new VendorError("OUT_POLICY", "output directory required");
  const outAbs = assertNoSymlinkChain(path.resolve(outDir));
  const tmpReal = fs.realpathSync(os.tmpdir());
  const underTmp = outAbs.startsWith(tmpReal + path.sep) && outAbs !== tmpReal;
  const isDefault = outAbs === DEFAULT_OUT;
  if (!isDefault && !underTmp) throw new VendorError("OUT_POLICY", `output must be exactly ${DEFAULT_OUT} or a directory under ${tmpReal}: ${outAbs}`);
  // never the module dir, any ancestor of it, the repo, or a path that contains the module dir
  for (const forbidden of [MODULE_DIR, path.dirname(MODULE_DIR), REPO_ROOT, "/"]) {
    if (outAbs === forbidden || forbidden.startsWith(outAbs + path.sep)) throw new VendorError("OUT_POLICY", `refusing source/parent directory as output: ${outAbs}`);
  }
  assertReplaceableDir(outAbs);
  return outAbs;
}

function writeTree(outDir, reader, verified) {
  const outAbs = resolveOutDir(outDir);          // all policy checks happen BEFORE any deletion
  const parent = path.dirname(outAbs);
  fs.mkdirSync(parent, { recursive: true });
  const tag = crypto.randomBytes(6).toString("hex");
  const staging = path.join(parent, `.${path.basename(outAbs)}.staging-${tag}`);
  const backup = path.join(parent, `.${path.basename(outAbs)}.old-${tag}`);
  fs.mkdirSync(staging);
  let pin;
  try {
    const fileHashes = {};
    for (const [rel, buf] of verified.files) {
      const abs = path.join(staging, rel);
      if (!abs.startsWith(staging + path.sep)) throw new VendorError("PATH_POLICY", rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, buf);
      fileHashes[rel] = sha256(buf);
    }
    fs.mkdirSync(path.dirname(path.join(staging, MANIFEST_REL)), { recursive: true });
    fs.writeFileSync(path.join(staging, MANIFEST_REL), verified.manifestBuf);
    pin = {
      schema: PIN_SCHEMA,
      sourceCommit: reader.id,
      manifestPath: MANIFEST_REL,
      manifestSha256: sha256(verified.manifestBuf),
      bundles: Object.fromEntries(Object.entries(verified.manifest.bundles).map(([v, e]) => [v, { bundleHash: e.bundleHash, entrypointHashes: e.entrypointHashes }])),
      files: Object.fromEntries(Object.keys(fileHashes).sort().map((k) => [k, fileHashes[k]])),
      // no timestamp: a rebuild from the same commit is byte-identical
    };
    fs.writeFileSync(path.join(staging, "PIN.json"), JSON.stringify(pin, null, 2) + "\n");
    verifyVendored(staging, reader.id); // verify the staged tree before it becomes visible
  } catch (e) { fs.rmSync(staging, { recursive: true, force: true }); throw e; }
  // atomic swap with restore-on-failure; only ever removes a tree we just verified as replaceable
  const hadOld = fs.existsSync(outAbs);
  try {
    if (hadOld) fs.renameSync(outAbs, backup);
    fs.renameSync(staging, outAbs);
  } catch (e) {
    if (hadOld && !fs.existsSync(outAbs) && fs.existsSync(backup)) fs.renameSync(backup, outAbs);
    fs.rmSync(staging, { recursive: true, force: true });
    throw new VendorError("OUT_SWAP_FAILED", e.message);
  }
  if (hadOld) fs.rmSync(backup, { recursive: true, force: true });
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
  // independent anchor: neither the pin nor the manifest is trusted on its own
  if (pin.manifestSha256 !== PINNED_MANIFEST_SHA256 || sha256(manifestBuf) !== PINNED_MANIFEST_SHA256) throw new VendorError("MANIFEST_ANCHOR_MISMATCH", "manifest/pin do not match the code-pinned manifest sha256");
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
  verifyVendored(path.resolve(out), commit);
  return { out: path.resolve(out), files: verified.files.size, manifestSha256: pin.manifestSha256, sourceCommit: commit };
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
    expectFail("tamper-manifest-and-pin", () => verifyVendored(t3, SOURCE_COMMIT), "MANIFEST_ANCHOR_MISMATCH"); // anchor fires before recomputation
    // extra file smuggled into the vendored tree
    const t4 = path.join(tmp, "t4"); fs.cpSync(good, t4, { recursive: true });
    fs.writeFileSync(path.join(t4, "assets/js/bundles/legacy-b03e219/extra.js"), "//");
    expectFail("extra-file", () => verifyVendored(t4, SOURCE_COMMIT), "VENDORED_TREE_MISMATCH");
    // path escape in a manifest read from a directory source
    const t5 = path.join(tmp, "t5"); fs.cpSync(good, t5, { recursive: true });
    const m5 = JSON.parse(fs.readFileSync(path.join(t5, MANIFEST_REL), "utf8"));
    const f = m5.bundles["legacy-b03e219"].files; const k = Object.keys(f)[0]; f["assets/js/bundles/legacy-b03e219/../../../../functions/index.js"] = f[k];
    fs.writeFileSync(path.join(t5, MANIFEST_REL), JSON.stringify(m5));
    // any manifest edit is now refused by the anchor first; the path policy itself is tested directly below
    expectFail("path-escape", () => collectVerified(dirReader(t5)), "MANIFEST_ANCHOR_MISMATCH");
    const m6 = JSON.parse(JSON.stringify(m5)); delete m6.bundles["legacy-b03e219"].files["assets/js/bundles/legacy-b03e219/../../../../functions/index.js"]; m6.bundles["legacy-b03e219"].files["/etc/passwd"] = f[k];
    fs.writeFileSync(path.join(t5, MANIFEST_REL), JSON.stringify(m6));
    expectFail("absolute-path", () => collectVerified(dirReader(t5)), "MANIFEST_ANCHOR_MISMATCH");
    const m7 = JSON.parse(JSON.stringify(m5)); delete m7.bundles["legacy-b03e219"].files["assets/js/bundles/legacy-b03e219/../../../../functions/index.js"]; m7.bundles["legacy-b03e219"].files["assets/js/other.js"] = f[k];
    fs.writeFileSync(path.join(t5, MANIFEST_REL), JSON.stringify(m7));
    expectFail("outside-bundle-dir", () => collectVerified(dirReader(t5)), "MANIFEST_ANCHOR_MISMATCH");
    // path policy, tested at the function that guards every write (defense in depth behind the anchor)
    for (const [id, rel] of [["path-policy-escape", "assets/js/bundles/legacy-b03e219/../../../../functions/index.js"], ["path-policy-absolute", "/etc/passwd"], ["path-policy-outside", "assets/js/other.js"], ["path-policy-backslash", "assets\\js\\bundles\\legacy-b03e219\\x.js"], ["path-policy-deep", "assets/js/bundles/legacy-b03e219/sub/x.js"], ["path-policy-dot", "assets/js/bundles/legacy-b03e219/./x.js"], ["path-policy-other-version", "assets/js/bundles/q90-input-and-wording-v2/report-engine.js"]]) {
      expectFail(id, () => assertSafeRel(rel, "legacy-b03e219"), "PATH_POLICY");
    }
    try { assertSafeRel("assets/js/bundles/legacy-b03e219/report-engine.js", "legacy-b03e219"); results.push({ id: "path-policy-accepts-valid", ok: true }); } catch (e) { results.push({ id: "path-policy-accepts-valid", ok: false, code: e.code }); }
    // wrong pinned commit
    expectFail("pin-source-commit", () => verifyVendored(good, "0".repeat(40)), "PIN_SOURCE_MISMATCH");
    // 3868172 #1: COHERENT mutation — payload byte + file sha/bytes + bundleHash + entrypointHashes + manifest sha in
    // PIN + PIN.files/PIN.bundles all rewritten consistently, sourceCommit string kept -> must still be refused
    const t8 = path.join(tmp, "t8"); fs.cpSync(good, t8, { recursive: true });
    {
      const ver = "legacy-b03e219", rel = `assets/js/bundles/${ver}/report-engine.js`;
      const mp = path.join(t8, MANIFEST_REL), pp = path.join(t8, "PIN.json");
      const m = JSON.parse(fs.readFileSync(mp, "utf8")), pin = JSON.parse(fs.readFileSync(pp, "utf8"));
      fs.appendFileSync(path.join(t8, rel), "\n// synthetic artifact mutation\n");
      const content = fs.readFileSync(path.join(t8, rel));
      const entry = m.bundles[ver]; entry.files[rel] = { ...entry.files[rel], sha256: sha256(content), bytes: content.length };
      entry.bundleHash = sha256(Object.keys(entry.files).sort().map((q) => `${q}:${entry.files[q].sha256}`).join("\n"));
      for (const [ep, spec] of Object.entries(m.entrypoints)) {
        const parts = [...spec.engines.map((f) => `assets/js/bundles/${ver}/${f}`), ...spec.data.map((f) => `assets/data/bundles/${ver}/${f}`)].sort();
        entry.entrypointHashes[ep] = sha256(parts.map((q) => `${q}:${entry.files[q].sha256}`).join("\n"));
      }
      fs.writeFileSync(mp, JSON.stringify(m));
      pin.manifestSha256 = sha256(fs.readFileSync(mp)); pin.files[rel] = sha256(content); pin.bundles[ver] = { bundleHash: entry.bundleHash, entrypointHashes: entry.entrypointHashes };
      fs.writeFileSync(pp, JSON.stringify(pin));
    }
    expectFail("coherent-payload-manifest-pin-mutation", () => verifyVendored(t8, SOURCE_COMMIT), "MANIFEST_ANCHOR_MISMATCH");
    // 3868172 #2: output policy — source module dir, its parent, repo root, a non-empty foreign dir, a symlinked path
    // must all be refused BEFORE fs.rmSync/rename is reached (spy proves no deletion call)
    const realRm = fs.rmSync, realRename = fs.renameSync; let destructive = 0;
    fs.rmSync = function (...a) { destructive++; return realRm.apply(fs, a); };
    fs.renameSync = function (...a) { destructive++; return realRename.apply(fs, a); };
    try {
      const v = collectVerified(dirReader(good));
      expectFail("out-source-module-dir", () => writeTree(MODULE_DIR, dirReader(good), v), "OUT_POLICY");
      expectFail("out-source-parent-dir", () => writeTree(path.dirname(MODULE_DIR), dirReader(good), v), "OUT_POLICY");
      expectFail("out-repo-root", () => writeTree(cwd, dirReader(good), v), "OUT_POLICY");
      expectFail("out-policy", () => writeTree(path.join(cwd, "assets"), dirReader(good), v), "OUT_POLICY");
      expectFail("out-ancestor-of-module", () => writeTree(path.dirname(cwd), dirReader(good), v), "OUT_POLICY");
      const foreign = path.join(tmp, "foreign"); fs.mkdirSync(foreign); fs.writeFileSync(path.join(foreign, "keep.txt"), "x");
      expectFail("out-nonempty-foreign-dir", () => writeTree(foreign, dirReader(good), v), "OUT_POLICY");
      results.push({ id: "foreign-dir-untouched", ok: fs.existsSync(path.join(foreign, "keep.txt")) });
      const link = path.join(tmp, "link-to-good"); fs.symlinkSync(good, link);
      expectFail("out-symlink-dir", () => writeTree(link, dirReader(good), v), "OUT_POLICY");
      expectFail("out-under-symlink", () => writeTree(path.join(link, "sub"), dirReader(good), v), "OUT_POLICY");
      results.push({ id: "no-destructive-call-before-policy", ok: destructive === 0, destructiveCalls: destructive });
    } finally { fs.rmSync = realRm; fs.renameSync = realRename; }
    // replacing a previous vendored tree works (that is the only non-empty target allowed) and is atomic
    build({ out: good, cwd }); results.push({ id: "rebuild-over-previous-vendored", ok: verifyVendored(good, SOURCE_COMMIT).pin.schema === PIN_SCHEMA });
    // short sha refused (must be the full frozen sha)
    expectFail("short-sha-refused", () => gitReader(SOURCE_COMMIT.slice(0, 7), cwd), "SOURCE_COMMIT_MISMATCH");
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  return { results, pass: results.filter((r) => r.ok).length, fail: results.filter((r) => !r.ok).length };
}

module.exports = { assertSafeRel, SOURCE_COMMIT, PINNED_MANIFEST_SHA256, MANIFEST_REL, PIN_SCHEMA, DEFAULT_OUT, MODULE_DIR, build, check, selfTest, verifyVendored, collectVerified, resolveOutDir, VendorError };

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
