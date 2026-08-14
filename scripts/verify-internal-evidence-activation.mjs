#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { canonicalCorpusDigest } from "./internal-evidence-canonical-digest.mjs";
import { loadJsonDirectory, validateMigrationBundle, verifyApprovalProvenance } from "./internal-evidence-migration-lib.mjs";

const ROOT = path.resolve(import.meta.dirname, ".."), base = process.env.EVIDENCE_BASE_SHA, head = process.env.EVIDENCE_HEAD_SHA, pr = Number(process.env.EVIDENCE_PR_NUMBER || 0), failures = [];
const repository = process.env.EVIDENCE_REPOSITORY_PATH || ROOT;
if (!/^[0-9a-f]{40}$/.test(base || "") || !/^[0-9a-f]{40}$/.test(head || "") || !Number.isInteger(pr) || pr < 1) throw new Error("Exact PR/base/head environment is required");
const readTree = (p) => fs.readFileSync(path.join(repository, p), "utf8"), readBase = (p) => execFileSync("git", ["show", `${base}:${p}`], { cwd: repository, encoding: "utf8" });
const migrations = loadJsonDirectory(path.join(repository, "internal/evidence/migrations")), approvals = loadJsonDirectory(path.join(repository, "internal/evidence/approval-evidence"));
let baseHasRoot = true; try { execFileSync("git", ["cat-file", "-e", `${base}:internal/evidence/evidence-contract.json`], { cwd: repository, stdio: "ignore" }); } catch { baseHasRoot = false; }
const protectedChanged = baseHasRoot ? Boolean(execFileSync("git", ["diff", "--name-only", base, "--", "internal/evidence", "scripts/internal-evidence-", "scripts/test-internal-evidence-", ".github/workflows/required-checks.yml"], { cwd: repository, encoding: "utf8" }).trim()) : true;
if (!baseHasRoot) {
  if (migrations.length !== 0 || approvals.length !== 0) failures.push("Initial pending activation requires exactly zero migration and approval files");
} else if (protectedChanged) {
  if (migrations.length !== 1) failures.push("Protected change requires exactly one current migration");
  if (migrations.length === 1) { const provenance = await verifyApprovalProvenance(approvals, { repository: process.env.GITHUB_REPOSITORY, token: process.env.GH_TOKEN, expectedActors: { owner: process.env.EVIDENCE_EXPECTED_OWNER, independent_reviewer: process.env.EVIDENCE_EXPECTED_REVIEWER }, expectedSourceIds: { owner: process.env.EVIDENCE_EXPECTED_OWNER_SOURCE_ID, independent_reviewer: process.env.EVIDENCE_EXPECTED_REVIEWER_SOURCE_ID } }); failures.push(...provenance.failures, ...validateMigrationBundle({ migration: migrations[0], approvals, allMigrations: migrations, allApprovals: approvals, context: { baseSha: base, headSha: head, prNumber: pr }, baseRegistryDigest: canonicalCorpusDigest(readBase), currentRegistryDigest: canonicalCorpusDigest(readTree), now: Date.now(), verifiedEvidenceIds: provenance.verified })); }
} else if (migrations.some((x) => x.target_main_sha === head && x.pull_request === pr)) failures.push("Steady state requires zero current transition");
if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
console.log(baseHasRoot ? (protectedChanged ? "Protected evidence migration verified" : "Steady evidence root verified") : "Initial pending evidence activation verified");
