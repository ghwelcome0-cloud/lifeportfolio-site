import fs from "node:fs";
import path from "node:path";

export function validateMigrationBundle({ migration, approvals, allMigrations, allApprovals, context, baseRegistryDigest, currentRegistryDigest, now }) {
  const failures = [];
  const byId = new Map(approvals.map((x) => [x.evidence_id, x]));
  const owner = byId.get(migration.owner_evidence_id), reviewer = byId.get(migration.reviewer_evidence_id);
  if (migration.reviewed_head_sha !== migration.target_main_sha) failures.push("reviewed head must equal target main");
  if (migration.base_main_sha !== context.baseSha || migration.target_main_sha !== context.headSha || migration.pull_request !== context.prNumber || migration.reviewed_head_sha !== context.headSha) failures.push("GitHub event tuple mismatch");
  if (migration.from_registry_digest !== baseRegistryDigest || migration.to_registry_digest !== currentRegistryDigest) failures.push("canonical digest mismatch");
  if (!owner || !reviewer || owner.evidence_id === reviewer.evidence_id) failures.push("two distinct approvals required");
  for (const [record, role] of [[owner, "owner"], [reviewer, "independent_reviewer"]]) {
    if (!record) continue;
    if (record.actor_role !== role || record.decision !== "Approved" || record.reviewed_head_sha !== context.headSha || record.pull_request !== context.prNumber || record.migration_id !== migration.migration_id) failures.push(`invalid ${role} approval`);
    const decided = Date.parse(record.decided_at); if (!Number.isFinite(decided) || decided > now || now - decided > 7 * 86400000) failures.push(`stale ${role} approval`);
  }
  const usedEvidence = new Set(), migrationIds = new Set(), outgoing = new Set(), versions = new Set();
  for (const item of allMigrations) {
    if (migrationIds.has(item.migration_id)) failures.push("duplicate migration ID"); migrationIds.add(item.migration_id);
    if (outgoing.has(item.from_contract_version)) failures.push("forked version graph"); outgoing.add(item.from_contract_version);
    if (item.from_contract_version === item.to_contract_version) failures.push("self cycle");
    versions.add(item.from_contract_version); versions.add(item.to_contract_version);
    for (const id of [item.owner_evidence_id, item.reviewer_evidence_id]) { if (usedEvidence.has(id)) failures.push("reused approval evidence"); usedEvidence.add(id); }
    const from = item.from_contract_version.split(".").map(Number), to = item.to_contract_version.split(".").map(Number);
    const valid = item.migration_kind === "metadata_patch" ? to[0] === from[0] && to[1] === from[1] && to[2] === from[2] + 1 : to[0] === from[0] && to[1] === from[1] + 1 && to[2] === 0;
    if (!valid) failures.push("invalid semver transition");
  }
  let current = allMigrations[0]?.from_contract_version, seen = new Set();
  while (current) { if (seen.has(current)) { failures.push("cycle"); break; } seen.add(current); current = allMigrations.find((x) => x.from_contract_version === current)?.to_contract_version; }
  if (allMigrations.filter((x) => x.target_main_sha === context.headSha && x.pull_request === context.prNumber).length !== 1) failures.push("current transition must be singular");
  if (new Set(allApprovals.map((x) => x.evidence_id)).size !== allApprovals.length) failures.push("duplicate approval evidence ID");
  return failures;
}

export function loadJsonDirectory(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((x) => x.endsWith(".json")).sort().map((x) => JSON.parse(fs.readFileSync(path.join(dir, x), "utf8")));
}
