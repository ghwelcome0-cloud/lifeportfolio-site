#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { canonicalCorpusDigest } from "./internal-evidence-canonical-digest.mjs";
import { loadJsonDirectory, validateMigrationBundle, validateMigrationHistory, verifyApprovalProvenance } from "./internal-evidence-migration-lib.mjs";

const ROOT = path.resolve(import.meta.dirname, ".."), repository = process.env.EVIDENCE_REPOSITORY_PATH || ROOT;
const event = process.env.EVIDENCE_EVENT_NAME, base = process.env.EVIDENCE_BASE_SHA || "", head = process.env.EVIDENCE_HEAD_SHA || "", pr = Number(process.env.EVIDENCE_PR_NUMBER || 0), failures = [];
if (!["pull_request", "push", "workflow_dispatch"].includes(event) || !/^[0-9a-f]{40}$/.test(head)) throw new Error("Supported event and exact head are required");
if (event === "pull_request" && (!/^[0-9a-f]{40}$/.test(base) || !Number.isInteger(pr) || pr < 1)) throw new Error("Exact PR/base/head environment is required");
if (event !== "pull_request" && (base !== "" || pr !== 0)) throw new Error("Push/dispatch must not provide PR/base context");
const git = (args, options = {}) => execFileSync("git", args, { cwd: repository, encoding: "utf8", ...options });
if (git(["rev-parse", "HEAD"]).trim() !== head) failures.push("checked-out head mismatch");
const readTree = (p) => fs.readFileSync(path.join(repository, p), "utf8"), readBase = (p) => git(["show", `${base}:${p}`]);
const migrations = loadJsonDirectory(path.join(repository, "internal/evidence/migrations")), approvals = loadJsonDirectory(path.join(repository, "internal/evidence/approval-evidence"));
const actorConfig = JSON.parse(readTree("internal/evidence/approval-actors.v1.json")), history = validateMigrationHistory(migrations, approvals);

if (event === "push" || event === "workflow_dispatch") {
  if (migrations.some((x) => x.target_main_sha === head)) failures.push("Push/dispatch requires committed steady root and zero current transition");
  failures.push(...history.failures);
} else {
  let baseHasRoot = true; try { git(["cat-file", "-e", `${base}:internal/evidence/evidence-contract.json`], { stdio: "ignore" }); } catch { baseHasRoot = false; }
  const protectedChanged = baseHasRoot ? Boolean(git(["diff", "--name-only", base, "--", "internal/evidence", "scripts/internal-evidence-", "scripts/test-internal-evidence-", ".github/workflows/required-checks.yml"]).trim()) : true;
  if (!baseHasRoot) {
    if (migrations.length !== 0 || approvals.length !== 0) failures.push("Initial pending activation requires exactly zero migration and approval files");
  } else if (protectedChanged) {
    const currentMatches = migrations.filter((x) => x.target_main_sha === head && x.pull_request === pr);
    if (currentMatches.length !== 1) failures.push("Protected change requires one selected current migration");
    if (currentMatches.length === 1) {
      const provenance = await verifyApprovalProvenance(approvals, { repository: process.env.GITHUB_REPOSITORY, token: process.env.GH_TOKEN, actorConfig });
      failures.push(...provenance.failures, ...validateMigrationBundle({ migration: currentMatches[0], approvals, context: { baseSha: base, headSha: head, prNumber: pr }, baseRegistryDigest: canonicalCorpusDigest(readBase), currentRegistryDigest: canonicalCorpusDigest(readTree), now: Date.now(), verifiedEvidenceIds: provenance.verified, history }));
    }
  } else if (migrations.some((x) => x.target_main_sha === head && x.pull_request === pr)) failures.push("Steady PR requires zero current transition");
}
if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
console.log(event === "pull_request" ? "PR evidence lifecycle verified" : `${event} steady evidence lifecycle verified`);
