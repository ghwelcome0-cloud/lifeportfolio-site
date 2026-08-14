#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateMigrationBundle, loadJsonDirectory } from "./internal-evidence-migration-lib.mjs";

const ROOT = path.resolve(import.meta.dirname, ".."), base = process.env.EVIDENCE_BASE_SHA || "", failures = [];
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const hash = (p) => crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, p))).digest("hex");
const contract = read("internal/evidence/evidence-contract.json"), digests = read("internal/evidence/evidence-digests.json"), activation = read("internal/evidence/evidence-activation.v1.json");
const ajv = new Ajv2020({ allErrors: true, strict: true }); addFormats(ajv);
const validateMigration = ajv.compile(read("internal/evidence/migration.schema.v1.json")), validateApproval = ajv.compile(read("internal/evidence/approval-evidence.schema.v1.json"));

if (contract.status !== "active_immutable" || contract.migration_model !== "versioned_evidence_record_only" || !/^[1-9]\d*\.\d+\.\d+$/.test(contract.contract_version)) failures.push("immutable contract state");
if (!/^[0-9a-f]{40}$/.test(contract.bound_main_sha) || digests.bound_main_sha !== contract.bound_main_sha) failures.push("main binding");
if (activation.activation_kind !== "initial" || activation.from_contract_version !== null || activation.to_contract_version !== contract.contract_version || activation.base_main_sha !== contract.bound_main_sha || activation.target_main_sha !== contract.bound_main_sha || activation.pull_request !== 260 || activation.head_ref !== "docs/ropa-evidence-v01-rebased-v3" || activation.reuse_prohibited !== true || activation.approval_status !== "pending_manual_review" || activation.approval_actor !== null || activation.approval_at !== null || activation.approval_source_hash !== null) failures.push("initial activation tuple");

const protectedPaths = [...contract.protected_paths].sort(), hashedPaths = protectedPaths.filter((p) => p !== "internal/evidence/evidence-digests.json"), digestPaths = Object.keys(digests.files).sort();
if (JSON.stringify(hashedPaths) !== JSON.stringify(digestPaths)) failures.push("protected/digest path set drift");
for (const p of protectedPaths) if (!fs.existsSync(path.join(ROOT, p))) failures.push(`missing ${p}`); else if (p !== "internal/evidence/evidence-digests.json" && hash(p) !== digests.files[p]) failures.push(`stale digest ${p}`);
const allFiles = []; function walk(dir) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); e.isDirectory() ? walk(p) : allFiles.push(path.relative(ROOT, p).split(path.sep).join("/")); } } walk(path.join(ROOT, "internal/evidence"));
for (const p of allFiles) if (p !== "internal/evidence/evidence-digests.json" && !protectedPaths.includes(p)) failures.push(`unregistered evidence ${p}`);

const migrations = loadJsonDirectory(path.join(ROOT, "internal/evidence/migrations")), approvals = loadJsonDirectory(path.join(ROOT, "internal/evidence/approval-evidence"));
for (const item of migrations) if (!validateMigration(item)) failures.push(`migration schema: ${ajv.errorsText(validateMigration.errors)}`);
for (const item of approvals) if (!validateApproval(item)) failures.push(`approval schema: ${ajv.errorsText(validateApproval.errors)}`);
if (migrations.length || approvals.length) failures.push("initial pending activation must contain no approval/migration records");

const context = { baseSha: "1".repeat(40), headSha: "2".repeat(40), prNumber: 999 }, now = Date.parse("2026-08-14T00:00:00Z");
const migration = { schema_version: "internal-evidence-migration.v1", migration_id: "IE-MIG-001", migration_kind: "corpus_minor", from_contract_version: "1.0.0", to_contract_version: "1.1.0", from_registry_digest: "a".repeat(64), to_registry_digest: "b".repeat(64), base_main_sha: context.baseSha, target_main_sha: context.headSha, pull_request: context.prNumber, reviewed_head_sha: context.headSha, owner_evidence_id: "IE-APPROVAL-001", reviewer_evidence_id: "IE-APPROVAL-002", reuse_prohibited: true };
// Synthetic unit fixture only. Production trust is established by the activation router's GitHub/API or owner-provided provenance verification.
const approvalsFixture = [{ schema_version: "internal-evidence-approval.v1", evidence_id: "IE-APPROVAL-001", source_type: "github_pull_request_review", source_id: "101", source_link: "https://github.com/example/repo/pull/999#pullrequestreview-101", source_content_sha256: "c".repeat(64), actor_id: "owner-actor", actor_role: "owner", decision: "Approved", decided_at: "2026-08-13T23:00:00Z", reviewed_head_sha: context.headSha, pull_request: 999, migration_id: "IE-MIG-001" }, { schema_version: "internal-evidence-approval.v1", evidence_id: "IE-APPROVAL-002", source_type: "github_pull_request_review", source_id: "102", source_link: "https://github.com/example/repo/pull/999#pullrequestreview-102", source_content_sha256: "d".repeat(64), actor_id: "reviewer-actor", actor_role: "independent_reviewer", decision: "Approved", decided_at: "2026-08-13T23:10:00Z", reviewed_head_sha: context.headSha, pull_request: 999, migration_id: "IE-MIG-001" }];
if (!validateMigration(migration) || approvalsFixture.some((x) => !validateApproval(x)) || validateMigrationBundle({ migration, approvals: approvalsFixture, allMigrations: [migration], allApprovals: approvalsFixture, context, baseRegistryDigest: "a".repeat(64), currentRegistryDigest: "b".repeat(64), now, verifiedEvidenceIds: approvalsFixture.map((x) => x.evidence_id) }).length) failures.push("valid future migration bundle rejected");
const mutations = [["pending", (_, a) => a[0].decision = "Pending"], ["rejected", (_, a) => a[0].decision = "Rejected"], ["missing", (_, a) => a.pop()], ["wrong-role", (_, a) => a[0].actor_role = "independent_reviewer"], ["wrong-head", (_, a) => a[0].reviewed_head_sha = "3".repeat(40)], ["wrong-pr", (_, a) => a[0].pull_request = 998], ["stale-time", (_, a) => a[0].decided_at = "2020-01-01T00:00:00Z"], ["reviewed-target-mismatch", (m) => m.reviewed_head_sha = "3".repeat(40)], ["digest", (m) => m.to_registry_digest = "a".repeat(64)], ["reuse", (m) => m.reviewer_evidence_id = m.owner_evidence_id], ["fork", (_, __, all) => all.push({ ...all[0], migration_id: "IE-MIG-002", to_contract_version: "1.2.0", owner_evidence_id: "IE-APPROVAL-003", reviewer_evidence_id: "IE-APPROVAL-004" })], ["cycle", (m) => m.to_contract_version = m.from_contract_version], ["version-jump", (m) => m.to_contract_version = "2.0.0"]];
for (const [name, mutate] of mutations) { const m = structuredClone(migration), a = structuredClone(approvalsFixture), all = [m]; mutate(m, a, all); const schemaOk = validateMigration(m) && a.every((x) => validateApproval(x)); const semantic = schemaOk && !validateMigrationBundle({ migration: m, approvals: a, allMigrations: all, allApprovals: a, context, baseRegistryDigest: "a".repeat(64), currentRegistryDigest: "b".repeat(64), now, verifiedEvidenceIds: a.map((x) => x.evidence_id) }).length; if (semantic) failures.push(`migration E2E mutation accepted: ${name}`); }

if (base && /^[0-9a-f]{40}$/.test(base)) { let exists = true; try { execFileSync("git", ["cat-file", "-e", `${base}:internal/evidence/evidence-contract.json`], { cwd: ROOT, stdio: "ignore" }); } catch { exists = false; } if (exists && migrations.length !== 1) failures.push("existing trust root requires one current migration"); }
if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
console.log("Internal evidence immutable activation and future same-head migration E2E passed");
