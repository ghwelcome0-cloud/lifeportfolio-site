#!/usr/bin/env node

// Builds dist/admin — the operator console surface for the separate
// Firebase Hosting target "admin" (admin.lifeportfolio.co.kr).
//
// Design mirrors scripts/build-hosting.mjs so the two pipelines behave
// identically (tracked-only, allowlist-only, deterministic manifest),
// but writes to a different output directory and never touches
// dist/hosting. The public site build is unaffected by this file.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  ADMIN_ALLOWED_EXTENSIONS, ADMIN_ASSET_FILES, ADMIN_DATA_FILES, ADMIN_ROOT_FILES,
} from "./admin-allowlist.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = path.join(ROOT, "dist", "admin");
const MANIFEST = path.join(ROOT, "dist", "admin-manifest.json");

const tracked = new Set(execFileSync("git", ["ls-files", "-z"], { cwd: ROOT })
  .toString("utf8").split("\0").filter(Boolean));

function normalize(candidate) {
  if (typeof candidate !== "string" || !candidate || path.isAbsolute(candidate)) {
    throw new Error(`Invalid admin allowlist path: ${candidate}`);
  }
  const posix = candidate.split(path.sep).join("/");
  const normalized = path.posix.normalize(posix);
  if (normalized !== posix || normalized.startsWith("../") || normalized.includes("/../")) {
    throw new Error(`Unsafe admin allowlist path: ${candidate}`);
  }
  if (normalized.split("/").some((part) => part.startsWith("."))) {
    throw new Error(`Dotfile is not publishable: ${candidate}`);
  }
  return normalized;
}

fs.rmSync(OUTPUT, { recursive: true, force: true });
fs.mkdirSync(OUTPUT, { recursive: true });

const published = [];
// ADMIN_DATA_FILES 는 지면이 런타임에 fetch 하는 데이터다.
// 지면만 담고 데이터를 빠뜨리면 화면이 비는 형태로 나타난다(결함 CP).
const candidates = [...ADMIN_ROOT_FILES, ...ADMIN_ASSET_FILES, ...ADMIN_DATA_FILES];

for (const candidate of candidates) {
  const relative = normalize(candidate);
  if (!tracked.has(relative)) {
    throw new Error(`Admin allowlist entry is not tracked by git: ${relative}`);
  }
  const extension = path.posix.extname(relative).toLowerCase();
  if (!ADMIN_ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error(`Extension not permitted on the admin surface: ${relative}`);
  }
  const source = path.join(ROOT, relative);
  if (!fs.statSync(source).isFile()) {
    throw new Error(`Admin allowlist entry is not a file: ${relative}`);
  }
  const destination = path.join(OUTPUT, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
  const body = fs.readFileSync(source);
  published.push({
    path: relative,
    bytes: body.length,
    sha256: crypto.createHash("sha256").update(body).digest("hex"),
  });
}

published.sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));

const manifest = {
  target: "admin",
  output: "dist/admin",
  count: published.length,
  files: published,
};

fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Admin build complete: ${published.length} files -> dist/admin`);
