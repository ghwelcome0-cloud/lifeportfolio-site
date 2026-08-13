#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const EVIDENCE_DIR = path.join(ROOT, "internal", "evidence", "ropa");
const REGISTRY = path.join(EVIDENCE_DIR, "registry.v0.1.json");
const failures = [];

for (const required of ["README.md", "data-map-v0.1.md", "registry.v0.1.json", "vendor-evidence-checklist.md"]) {
  if (!fs.existsSync(path.join(EVIDENCE_DIR, required))) failures.push(`missing ${required}`);
}

const registry = JSON.parse(fs.readFileSync(REGISTRY, "utf8"));
const requiredFields = [
  "activity_id", "owner", "data_subjects", "purpose", "legal_basis_pending_review",
  "legal_basis_candidate", "approval", "responsible_roles", "purpose_compatibility",
  "withdrawal_and_rights", "children_and_sensitive_data", "transfer_basis",
  "vendor_contract", "reidentification_risk", "breach_handling", "legal_hold", "counsel_review",
  "data_categories", "required_optional", "source", "system", "region", "recipients",
  "processors", "international_transfer", "retention_rule", "backup_rule",
  "deletion_trigger", "deletion_job", "access_roles", "security_controls",
  "consent_artifact", "code_paths", "evidence_links", "last_verified_sha",
  "unresolved_findings",
];

if (!Array.isArray(registry.activities) || registry.activities.length === 0) failures.push("activities must be non-empty");
const ids = new Set();
for (const activity of registry.activities || []) {
  for (const field of requiredFields) if (!(field in activity)) failures.push(`${activity.activity_id || "unknown"}: missing ${field}`);
  if (activity.approval?.status !== "not_approved" || activity.approval?.approved_by !== null || activity.approval?.approved_at !== null) {
    failures.push(`${activity.activity_id}: v0.1 must remain unapproved`);
  }
  if (!Array.isArray(activity.legal_basis_candidate) || !activity.legal_basis_candidate.includes("[확인 전 확정 금지]")) {
    failures.push(`${activity.activity_id}: legal basis must remain explicitly unconfirmed`);
  }
  if (ids.has(activity.activity_id)) failures.push(`duplicate activity_id ${activity.activity_id}`);
  ids.add(activity.activity_id);
  for (const codePath of activity.code_paths || []) {
    if (!fs.existsSync(path.join(ROOT, codePath))) failures.push(`${activity.activity_id}: missing code path ${codePath}`);
  }
}

const tracked = execFileSync("git", ["ls-files", "-z", "internal/evidence/ropa"], { cwd: ROOT })
  .toString("utf8").split("\0").filter(Boolean);
const forbidden = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /"private_key_id"\s*:/,
  /\b(?:sk_live|pk_live)_[A-Za-z0-9]{12,}\b/,
  /ghwelcome0@gmail\.com/i,
  /AIza[0-9A-Za-z_-]{20,}/,
  /[?&](?:email|sig|token|access_token|refresh_token)=/i,
];
for (const relative of tracked) {
  const body = fs.readFileSync(path.join(ROOT, relative), "utf8");
  for (const pattern of forbidden) if (pattern.test(body)) failures.push(`${relative}: forbidden secret/identifier pattern ${pattern}`);
}

const allowlist = fs.readFileSync(path.join(ROOT, "scripts", "hosting-allowlist.mjs"), "utf8");
if (/internal\/?["'`]/.test(allowlist) || /internal\/evidence/.test(allowlist)) failures.push("hosting allowlist references internal evidence");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("ROPA evidence schema, code paths, DLP and non-hosting policy passed");
