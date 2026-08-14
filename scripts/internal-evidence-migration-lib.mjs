import fs from "node:fs";
import path from "node:path";

export function validateMigrationBundle({ migration, approvals, allMigrations, allApprovals, context, baseRegistryDigest, currentRegistryDigest, now, verifiedEvidenceIds = [] }) {
  const failures = [];
  const byId = new Map(approvals.map((x) => [x.evidence_id, x]));
  const owner = byId.get(migration.owner_evidence_id), reviewer = byId.get(migration.reviewer_evidence_id);
  if (migration.reviewed_head_sha !== migration.target_main_sha) failures.push("reviewed head must equal target main");
  if (migration.base_main_sha !== context.baseSha || migration.target_main_sha !== context.headSha || migration.pull_request !== context.prNumber || migration.reviewed_head_sha !== context.headSha) failures.push("GitHub event tuple mismatch");
  if (migration.from_registry_digest !== baseRegistryDigest || migration.to_registry_digest !== currentRegistryDigest) failures.push("canonical digest mismatch");
  if (!owner || !reviewer || owner.evidence_id === reviewer.evidence_id) failures.push("two distinct approvals required");
  if (!verifiedEvidenceIds.includes(migration.owner_evidence_id) || !verifiedEvidenceIds.includes(migration.reviewer_evidence_id)) failures.push("approval provenance not verified");
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

export async function verifyApprovalProvenance(records, { repository, token, expectedActors = {}, expectedSourceIds = {} }) {
  const verified = [], failures = [];
  for (const record of records) {
    if (expectedActors[record.actor_role] && record.actor_id !== expectedActors[record.actor_role]) { failures.push(`${record.evidence_id}: unexpected actor`); continue; }
    if (expectedSourceIds[record.actor_role]) { if (record.source_id !== expectedSourceIds[record.actor_role]) failures.push(`${record.evidence_id}: owner-provided source ID mismatch`); else verified.push(record.evidence_id); continue; }
    if (record.source_type !== "github_pull_request_review") { failures.push(`${record.evidence_id}: source type requires an external trusted verifier`); continue; }
    if (!token || !repository) { failures.push(`${record.evidence_id}: GitHub verifier unavailable`); continue; }
    const response = await fetch(`https://api.github.com/repos/${repository}/pulls/${record.pull_request}/reviews/${record.source_id}`, { headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" } });
    if (!response.ok) { failures.push(`${record.evidence_id}: GitHub review lookup failed`); continue; }
    const review = await response.json(), content = JSON.stringify({ id: String(review.id), user: review.user?.login, state: review.state, body: review.body || "", submitted_at: review.submitted_at, commit_id: review.commit_id, html_url: review.html_url });
    const digest = (await import("node:crypto")).createHash("sha256").update(content).digest("hex");
    if (String(review.id) !== record.source_id || review.user?.login !== record.actor_id || review.state !== "APPROVED" || review.commit_id !== record.reviewed_head_sha || review.html_url !== record.source_link || digest !== record.source_content_sha256) failures.push(`${record.evidence_id}: provenance mismatch`); else verified.push(record.evidence_id);
  }
  return { verified, failures };
}

export function loadJsonDirectory(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((x) => x.endsWith(".json")).sort().map((x) => JSON.parse(fs.readFileSync(path.join(dir, x), "utf8")));
}
