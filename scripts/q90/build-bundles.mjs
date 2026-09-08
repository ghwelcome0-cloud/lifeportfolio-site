#!/usr/bin/env node
// Q90-RETENTION — build immutable engine/data bundles from the frozen commit.
//
//   node scripts/q90/build-bundles.mjs            # write bundles + manifest
//   node scripts/q90/build-bundles.mjs --check    # rebuild in memory, compare to disk, exit 1 on drift
//
// Source of truth is `git show <FROZEN_SOURCE_COMMIT>:<path>`, never the
// working-tree copy under assets/js or data/. The working tree may move on;
// the bundle may not. Output paths:
//   assets/js/bundles/<bundleVersion>/<engine>.js
//   assets/data/bundles/<bundleVersion>/<data>.json
//   assets/data/bundles/manifest.json
//
// Both trees are already inside the hosting allowlist (assets/js, assets/data),
// so no sanctuary file (hosting-allowlist.mjs, build-hosting.mjs, firebase.json)
// is touched. Nothing here is wired into any page; the bundles are inert until a
// separately reviewed loader PR references them.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  FROZEN_SOURCE_COMMIT, ENGINE_FILES, DATA_FILES, ENTRYPOINTS, BUNDLES,
  MAX_ENGINE_VERSION_LENGTH, applyPatches,
} from "./bundle-patches.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const JS_OUT = path.join(ROOT, "assets", "js", "bundles");
const DATA_OUT = path.join(ROOT, "assets", "data", "bundles");
const MANIFEST_PATH = path.join(DATA_OUT, "manifest.json");
const CHECK = process.argv.includes("--check");

const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");

function gitShow(rel) {
  return execFileSync("git", ["show", `${FROZEN_SOURCE_COMMIT}:${rel}`], {
    cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
  });
}

function assertCommitExists() {
  const type = execFileSync("git", ["cat-file", "-t", FROZEN_SOURCE_COMMIT], { cwd: ROOT, encoding: "utf8" }).trim();
  if (type !== "commit") throw new Error(`frozen commit ${FROZEN_SOURCE_COMMIT} is not reachable (${type})`);
}

export function buildInMemory() {
  assertCommitExists();
  const frozen = {};
  for (const f of ENGINE_FILES) frozen[`assets/js/${f}`] = gitShow(`assets/js/${f}`);
  for (const f of DATA_FILES) frozen[`data/${f}`] = gitShow(`data/${f}`);

  const manifest = {
    schema: "q90-bundle-manifest/1",
    frozenSourceCommit: FROZEN_SOURCE_COMMIT,
    frozenSourceSha256: Object.fromEntries(Object.entries(frozen).map(([k, v]) => [k, sha256(v)])),
    entrypoints: ENTRYPOINTS,
    bundles: {},
    // Generated files are deterministic functions of (frozen commit, patches);
    // no timestamps are recorded so a rebuild is byte-identical.
  };
  const files = {}; // relPath -> content

  for (const [version, spec] of Object.entries(BUNDLES)) {
    if (spec.reportEngineVersion.length > MAX_ENGINE_VERSION_LENGTH) {
      throw new Error(`${version}: reportEngineVersion exceeds ${MAX_ENGINE_VERSION_LENGTH} chars`);
    }
    const entry = { description: spec.description, reportEngineVersion: spec.reportEngineVersion, patches: {}, files: {} };
    for (const f of ENGINE_FILES) {
      const src = frozen[`assets/js/${f}`];
      const patches = spec.patches[f] || [];
      const out = applyPatches(src, patches, `${version}/${f}`);
      const rel = `assets/js/bundles/${version}/${f}`;
      files[rel] = out;
      entry.files[rel] = { sha256: sha256(out), bytes: Buffer.byteLength(out), patched: patches.length > 0 };
      if (patches.length) entry.patches[f] = patches.map((p) => p.id);
    }
    for (const f of DATA_FILES) {
      const src = frozen[`data/${f}`];
      const patches = spec.patches[f] || [];
      const out = applyPatches(src, patches, `${version}/${f}`);
      const rel = `assets/data/bundles/${version}/${f}`;
      files[rel] = out;
      entry.files[rel] = { sha256: sha256(out), bytes: Buffer.byteLength(out), patched: patches.length > 0 };
      if (patches.length) entry.patches[f] = patches.map((p) => p.id);
    }
    // Per-entrypoint hash: only the files that entrypoint actually loads.
    entry.entrypointHashes = {};
    for (const [ep, epSpec] of Object.entries(ENTRYPOINTS)) {
      const parts = [
        ...epSpec.engines.map((f) => `assets/js/bundles/${version}/${f}`),
        ...epSpec.data.map((f) => `assets/data/bundles/${version}/${f}`),
      ].sort();
      entry.entrypointHashes[ep] = sha256(parts.map((p) => `${p}:${entry.files[p].sha256}`).join("\n"));
    }
    const allSorted = Object.keys(entry.files).sort();
    entry.bundleHash = sha256(allSorted.map((p) => `${p}:${entry.files[p].sha256}`).join("\n"));
    manifest.bundles[version] = entry;
  }
  files["assets/data/bundles/manifest.json"] = JSON.stringify(manifest, null, 2) + "\n";
  return { manifest, files };
}

function main() {
  const { files } = buildInMemory();
  if (CHECK) {
    const drift = [];
    for (const [rel, content] of Object.entries(files)) {
      const abs = path.join(ROOT, rel);
      if (!fs.existsSync(abs)) { drift.push(`missing ${rel}`); continue; }
      if (fs.readFileSync(abs, "utf8") !== content) drift.push(`content drift ${rel}`);
    }
    // extra files inside the bundle trees are drift too
    for (const dir of [JS_OUT, DATA_OUT]) {
      if (!fs.existsSync(dir)) continue;
      for (const f of walk(dir)) {
        const rel = path.relative(ROOT, f).split(path.sep).join("/");
        if (!(rel in files)) drift.push(`unexpected ${rel}`);
      }
    }
    if (drift.length) { console.error("q90 bundle drift:\n  " + drift.join("\n  ")); process.exit(1); }
    console.log(`q90 bundles: ${Object.keys(files).length} files match the deterministic rebuild`);
    return;
  }
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(ROOT, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  console.log(`q90 bundles written: ${Object.keys(files).length} files -> ${path.relative(ROOT, MANIFEST_PATH)}`);
}

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p); else yield p;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
