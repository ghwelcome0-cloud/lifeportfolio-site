import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export function validateMigrationHistory(allMigrations, allApprovals) {
  const failures = [], migrationIds = new Set(), evidenceIds = new Set(), outgoing = new Map(), incoming = new Map();
  for (const item of allMigrations) {
    if (migrationIds.has(item.migration_id)) failures.push("duplicate migration ID"); migrationIds.add(item.migration_id);
    if (outgoing.has(item.from_contract_version)) failures.push("forked version graph"); outgoing.set(item.from_contract_version, item);
    incoming.set(item.to_contract_version, (incoming.get(item.to_contract_version) || 0) + 1); if (incoming.get(item.to_contract_version) > 1) failures.push("converging version graph");
    for (const id of [item.owner_evidence_id, item.reviewer_evidence_id]) { if (evidenceIds.has(id)) failures.push("reused approval evidence"); evidenceIds.add(id); }
    const from = item.from_contract_version.split(".").map(Number), to = item.to_contract_version.split(".").map(Number);
    const valid = item.migration_kind === "metadata_patch" ? to[0] === from[0] && to[1] === from[1] && to[2] === from[2] + 1 : to[0] === from[0] && to[1] === from[1] + 1 && to[2] === 0;
    if (!valid) failures.push("invalid semver transition");
  }
  if (new Set(allApprovals.map((x) => x.evidence_id)).size !== allApprovals.length) failures.push("duplicate approval evidence ID");
  if (!allMigrations.length) return { failures, tail: null, traversed: 0 };
  const roots = allMigrations.filter((x) => !incoming.has(x.from_contract_version)); if (roots.length !== 1) failures.push("migration graph requires one root");
  let version = roots[0]?.from_contract_version, tail = version, traversed = 0; const seen = new Set();
  while (version) { if (seen.has(version)) { failures.push("cycle"); break; } seen.add(version); const edge = outgoing.get(version); if (!edge) { tail = version; break; } traversed++; version = edge.to_contract_version; }
  if (traversed !== allMigrations.length) failures.push("orphan or disconnected migration");
  return { failures, tail, traversed };
}

export function validateMigrationBundle({ migration, approvals, context, baseRegistryDigest, currentRegistryDigest, now, verifiedEvidenceIds, history }) {
  const failures = [...history.failures], byId = new Map(approvals.map((x) => [x.evidence_id, x]));
  const owner = byId.get(migration.owner_evidence_id), reviewer = byId.get(migration.reviewer_evidence_id);
  if (migration.reviewed_head_sha !== migration.target_main_sha) failures.push("reviewed head must equal target main");
  if (migration.base_main_sha !== context.baseSha || migration.target_main_sha !== context.headSha || migration.pull_request !== context.prNumber || migration.reviewed_head_sha !== context.headSha) failures.push("GitHub event tuple mismatch");
  if (migration.from_registry_digest !== baseRegistryDigest || migration.to_registry_digest !== currentRegistryDigest) failures.push("canonical digest mismatch");
  if (!owner || !reviewer || owner.evidence_id === reviewer.evidence_id || owner?.actor_id === reviewer?.actor_id) failures.push("two distinct approvals required");
  if (!verifiedEvidenceIds.includes(migration.owner_evidence_id) || !verifiedEvidenceIds.includes(migration.reviewer_evidence_id)) failures.push("approval provenance not verified");
  for (const [record, role] of [[owner, "owner"], [reviewer, "independent_reviewer"]]) {
    if (!record) continue;
    if (record.actor_role !== role || record.decision !== "Approved" || record.reviewed_head_sha !== context.headSha || record.pull_request !== context.prNumber || record.migration_id !== migration.migration_id) failures.push(`invalid ${role} approval`);
    const decided = Date.parse(record.decided_at); if (!Number.isFinite(decided) || decided > now || now - decided > 7 * 86400000) failures.push(`stale ${role} approval`);
  }
  if (migration.to_contract_version !== history.tail) failures.push("current transition must be chain tail");
  return failures;
}

export async function verifyApprovalProvenance(records, { repository, token, actorConfig, fetchImpl = fetch }) {
  const verified = [], failures = [];
  for (const record of records) {
    const allowed = record.actor_role === "owner" ? record.actor_id === actorConfig.github_owner : actorConfig.github_independent_reviewers.includes(record.actor_id);
    if (!allowed) { failures.push(`${record.evidence_id}: actor not allowlisted`); continue; }
    if (record.source_type !== "github_pull_request_review" || !token || !repository) { failures.push(`${record.evidence_id}: GitHub verifier unavailable`); continue; }
    const response = await fetchImpl(`https://api.github.com/repos/${repository}/pulls/${record.pull_request}/reviews/${record.source_id}`, { headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" } });
    if (!response.ok) { failures.push(`${record.evidence_id}: GitHub review lookup failed`); continue; }
    const review = await response.json(), content = JSON.stringify({ id: String(review.id), user: review.user?.login, state: review.state, body: review.body || "", submitted_at: review.submitted_at, commit_id: review.commit_id, html_url: review.html_url });
    const digest = crypto.createHash("sha256").update(content).digest("hex");
    if (String(review.id) !== record.source_id || review.user?.login !== record.actor_id || review.state !== "APPROVED" || review.commit_id !== record.reviewed_head_sha || review.html_url !== record.source_link || digest !== record.source_content_sha256) failures.push(`${record.evidence_id}: provenance mismatch`); else verified.push(record.evidence_id);
  }
  return { verified, failures };
}

export function loadJsonDirectory(dir) { if (!fs.existsSync(dir)) return []; return fs.readdirSync(dir).filter((x) => x.endsWith(".json")).sort().map((x) => JSON.parse(fs.readFileSync(path.join(dir, x), "utf8"))); }
