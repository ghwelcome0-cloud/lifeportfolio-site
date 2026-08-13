#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIR = path.join(ROOT, "internal", "evidence", "legal-authorities");
const registry = JSON.parse(fs.readFileSync(path.join(DIR, "registry.v0.1.json"), "utf8"));
const failures = [];
const expected = Array.from({ length: 10 }, (_, i) => `LP-LGL-${String(i + 1).padStart(3, "0")}`);
const limitation = "CI passing proves structural integrity only; it does not establish processing lawfulness, legal approval, counsel approval, or deployment approval.";

if (registry.canonical_limitation !== limitation) failures.push("canonical limitation changed");
if (registry.status !== "fact_evidence_draft") failures.push("registry must remain a draft");
if (JSON.stringify((registry.authorities || []).map((x) => x.authority_id)) !== JSON.stringify(expected)) failures.push("authority ID set/order mismatch");

for (const record of registry.authorities || []) {
  for (const field of ["official_url", "retrieved_at", "application_scope", "limitations", "license_review_status", "counsel_review_status"]) {
    if (!(field in record)) failures.push(`${record.authority_id}: missing ${field}`);
  }
  if (record.training_eligibility !== false) failures.push(`${record.authority_id}: training_eligibility must be false`);
  if (record.approval_status !== "not_approved" || record.approved_by !== null || record.approved_at !== null) failures.push(`${record.authority_id}: must remain unapproved`);
  if (!/^https:\/\/(?:www\.)?(?:law\.go\.kr|privacy\.go\.kr)\//.test(record.official_url)) failures.push(`${record.authority_id}: source host is not allowlisted`);
  if (record.source_hash !== null && !/^sha256:[0-9a-f]{64}$/.test(record.source_hash)) failures.push(`${record.authority_id}: invalid source hash`);
}

const allText = fs.readdirSync(DIR).map((name) => fs.readFileSync(path.join(DIR, name), "utf8")).join("\n");
for (const forbidden of [/ghwelcome0@gmail\.com/i, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /"private_key_id"\s*:/, /[?&](?:email|sig|token)=/i]) {
  if (forbidden.test(allText)) failures.push(`forbidden content ${forbidden}`);
}
if (/customer|counselling transcript|private legal advice/i.test(JSON.stringify(registry))) failures.push("private/customer corpus boundary violated");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Legal authority registry IDs, source policy, approval and training boundaries passed");
