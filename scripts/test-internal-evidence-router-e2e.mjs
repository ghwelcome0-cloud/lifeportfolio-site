#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, ".."), temp = fs.mkdtempSync(path.join(os.tmpdir(), "lp-evidence-router-"));
const run = (cmd, args, options = {}) => execFileSync(cmd, args, { cwd: temp, stdio: "ignore", ...options });
try {
  run("git", ["init", "-q"]); run("git", ["config", "user.email", "synthetic@example.invalid"]); run("git", ["config", "user.name", "Synthetic Fixture"]);
  fs.writeFileSync(path.join(temp, "README.md"), "base\n"); run("git", ["add", "."]); run("git", ["commit", "-qm", "base"]); const base = execFileSync("git", ["rev-parse", "HEAD"], { cwd: temp, encoding: "utf8" }).trim();
  fs.cpSync(path.join(ROOT, "internal/evidence"), path.join(temp, "internal/evidence"), { recursive: true }); run("git", ["add", "."]); run("git", ["commit", "-qm", "initial evidence"]); const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: temp, encoding: "utf8" }).trim();
  const env = { ...process.env, EVIDENCE_REPOSITORY_PATH: temp, EVIDENCE_BASE_SHA: base, EVIDENCE_HEAD_SHA: head, EVIDENCE_PR_NUMBER: "260" };
  const valid = spawnSync(process.execPath, [path.join(ROOT, "scripts/verify-internal-evidence-activation.mjs")], { cwd: ROOT, env, encoding: "utf8" }); if (valid.status !== 0) throw new Error(`valid initial CLI failed: ${valid.stderr}`);
  fs.writeFileSync(path.join(temp, "internal/evidence/migrations/invalid.json"), "{}\n");
  const invalid = spawnSync(process.execPath, [path.join(ROOT, "scripts/verify-internal-evidence-activation.mjs")], { cwd: ROOT, env, encoding: "utf8" }); if (invalid.status === 0) throw new Error("invalid initial migration was accepted");
  console.log("Real temp-git activation router CLI pass/fail E2E passed");
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
