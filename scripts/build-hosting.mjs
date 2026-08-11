#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  ALLOWED_EXTENSIONS, PUBLIC_DATA_FILES, PUBLIC_ROOT_FILES, PUBLIC_TREES, TREE_EXCLUDES,
} from "./hosting-allowlist.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = path.join(ROOT, "dist", "hosting");
const MANIFEST = path.join(ROOT, "dist", "hosting-manifest.json");
const tracked = new Set(execFileSync("git", ["ls-files", "-z"], { cwd: ROOT })
  .toString("utf8").split("\0").filter(Boolean));

function normalize(candidate) {
  if (typeof candidate !== "string" || !candidate || path.isAbsolute(candidate)) {
    throw new Error(`Invalid allowlist path: ${candidate}`);
  }
  const posix = candidate.split(path.sep).join("/");
  const normalized = path.posix.normalize(posix);
  if (normalized !== posix || normalized.startsWith("../") || normalized.includes("/../")) {
    throw new Error(`Unsafe allowlist path: ${candidate}`);
  }
  if (normalized.split("/").some((part) => part.startsWith("."))) {
    throw new Error(`Dotfile is not publishable: ${candidate}`);
  }
  return normalized;
}

function isExcluded(relative) {
  return TREE_EXCLUDES.some((blocked) => relative === blocked || relative.startsWith(`${blocked}/`));
}

function assertPublishable(relative) {
  relative = normalize(relative);
  if (!tracked.has(relative)) throw new Error(`Untracked allowlist input: ${relative}`);
  if (isExcluded(relative)) throw new Error(`Explicitly forbidden asset: ${relative}`);
  const extension = path.posix.extname(relative).toLowerCase();
  if (extension && !ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error(`Extension is not publishable: ${relative}`);
  }
  const stat = fs.lstatSync(path.join(ROOT, relative));
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`Non-file input: ${relative}`);
  return relative;
}

function copyFile(source, relative) {
  relative = assertPublishable(relative);
  const destination = path.join(OUTPUT, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

fs.rmSync(OUTPUT, { recursive: true, force: true });
fs.mkdirSync(OUTPUT, { recursive: true });

const candidates = [...PUBLIC_ROOT_FILES, ...PUBLIC_DATA_FILES];
for (const relative of tracked) {
  const hasDotPart = relative.split("/").some((part) => part.startsWith("."));
  const extension = path.posix.extname(relative).toLowerCase();
  if (PUBLIC_TREES.some((tree) => relative.startsWith(`${tree}/`)) && !isExcluded(relative) && !hasDotPart && ALLOWED_EXTENSIONS.has(extension)) {
    candidates.push(relative);
  }
}

const folded = new Map();
for (const raw of candidates) {
  const relative = normalize(raw);
  const key = relative.toLocaleLowerCase("en-US");
  if (folded.has(key)) throw new Error(`Duplicate/case-fold collision: ${folded.get(key)} and ${relative}`);
  folded.set(key, relative);
}
const files = [...folded.values()].sort();
for (const relative of files) copyFile(path.join(ROOT, relative), relative);

const entries = files.map((relative) => {
  const body = fs.readFileSync(path.join(OUTPUT, relative));
  return { path: relative, bytes: body.length, sha256: crypto.createHash("sha256").update(body).digest("hex") };
});
const canonical = `${JSON.stringify({ schema: 1, files: entries }, null, 2)}\n`;
fs.writeFileSync(MANIFEST, canonical);

console.log(`Hosting build created: ${entries.length} tracked files`);
