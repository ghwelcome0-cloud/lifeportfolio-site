#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.resolve(import.meta.dirname, ".."), failures = [];
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const hash = (p) => crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, p))).digest("hex");
const contract = read("internal/evidence/evidence-contract.json"), digests = read("internal/evidence/evidence-digests.json"), activation = read("internal/evidence/evidence-activation.v1.json");
if (contract.status !== "active_immutable" || contract.migration_model !== "disabled_fail_closed" || contract.future_protected_change_status !== "unsupported_until_external_verifier") failures.push("fail-closed contract state");
if (JSON.stringify(contract.supported_lifecycle) !== JSON.stringify(["initial_pending_activation", "committed_steady_validation"])) failures.push("supported lifecycle drift");
if (activation.approval_status !== "initial_pending_unapproved" || activation.approval_actor !== null || activation.approval_at !== null || activation.approval_source_hash !== null) failures.push("initial corpus approval drift");
const paths = [...contract.protected_paths].sort(), hashed = paths.filter((p) => p !== "internal/evidence/evidence-digests.json");
if (JSON.stringify(hashed) !== JSON.stringify(Object.keys(digests.files).sort())) failures.push("protected/digest path set drift");
for (const p of paths) if (!fs.existsSync(path.join(ROOT, p))) failures.push(`missing ${p}`); else if (p !== "internal/evidence/evidence-digests.json" && hash(p) !== digests.files[p]) failures.push(`stale digest ${p}`);
const jsonRecords = (dir) => fs.readdirSync(path.join(ROOT, dir)).filter((x) => x.endsWith(".json"));
if (jsonRecords("internal/evidence/migrations").length || jsonRecords("internal/evidence/approval-evidence").length) failures.push("unsupported migration/approval record present");
if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
console.log("Initial pending and permanent future-protected fail-closed contract passed");
