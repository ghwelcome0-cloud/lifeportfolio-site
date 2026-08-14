#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, ".."), repository = process.env.EVIDENCE_REPOSITORY_PATH || ROOT;
const event = process.env.EVIDENCE_EVENT_NAME, base = process.env.EVIDENCE_BASE_SHA || "", head = process.env.EVIDENCE_HEAD_SHA || "", pr = Number(process.env.EVIDENCE_PR_NUMBER || 0), failures = [];
if (!["pull_request", "push", "workflow_dispatch"].includes(event) || !/^[0-9a-f]{40}$/.test(head)) throw new Error("Supported event and exact head are required");
if (event === "pull_request" && (!/^[0-9a-f]{40}$/.test(base) || !Number.isInteger(pr) || pr < 1)) throw new Error("Exact PR/base/head environment is required");
if (event !== "pull_request" && (base !== "" || pr !== 0)) throw new Error("Push/dispatch must not provide PR/base context");
const git = (args, options = {}) => execFileSync("git", args, { cwd: repository, encoding: "utf8", ...options });
if (git(["rev-parse", "HEAD"]).trim() !== head) failures.push("checked-out head mismatch");
const read = (p) => JSON.parse(fs.readFileSync(path.join(repository, p), "utf8"));
const records = (dir) => fs.readdirSync(path.join(repository, dir)).filter((x) => x.endsWith(".json"));
const migrations = records("internal/evidence/migrations"), approvals = records("internal/evidence/approval-evidence");
if (migrations.length !== 0 || approvals.length !== 0) failures.push("Migration/approval records are unsupported until an external verifier exists");
const contract = read("internal/evidence/evidence-contract.json"), activation = read("internal/evidence/evidence-activation.v1.json");
if (contract.future_protected_change_status !== "unsupported_until_external_verifier" || contract.migration_model !== "disabled_fail_closed" || activation.approval_status !== "initial_pending_unapproved") failures.push("Permanent fail-closed contract state changed");

if (event === "pull_request") {
  let baseHasRoot = true; try { git(["cat-file", "-e", `${base}:internal/evidence/evidence-contract.json`], { stdio: "ignore" }); } catch { baseHasRoot = false; }
  const protectedChanged = baseHasRoot && Boolean(git(["diff", "--name-only", base, "--", "internal/evidence", ":(glob)scripts/internal-evidence-*", ":(glob)scripts/test-internal-evidence-*", "scripts/verify-internal-evidence-activation.mjs", ".github/workflows/required-checks.yml"]).trim());
  if (!baseHasRoot && pr !== 260) failures.push("Only initial activation PR #260 may introduce the trust root");
  if (baseHasRoot && protectedChanged) failures.push("unsupported_until_external_verifier");
} else {
  // Strict schema/DLP/digest/ML-deny validators run immediately before this router.
  // With zero migration/approval records, push/dispatch is committed steady only.
}
if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
console.log(event === "pull_request" ? "Initial/steady PR evidence lifecycle verified" : `${event} committed steady evidence lifecycle verified`);
