#!/usr/bin/env node
import { assertWorkflowPath } from "./workflow-path-lib.mjs";
const { GH_TOKEN: token, GITHUB_REPOSITORY: repository, SOURCE_RUN_ID: runId } = process.env;
if (!token || !repository || !runId) throw new Error("GitHub validation inputs missing");
async function api(path) {
  const response = await fetch(`https://api.github.com/repos/${repository}${path}`, { headers: {
    authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28",
  }});
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${path}`);
  return response.json();
}
const run = await api(`/actions/runs/${runId}`);
if (run.repository.full_name !== repository) throw new Error("Run repository mismatch");
assertWorkflowPath(run.path, process.env.EXPECTED_WORKFLOW_PATH);
if (run.event !== process.env.EXPECTED_EVENT || run.conclusion !== "success") throw new Error("Run event/conclusion mismatch");
if (process.env.ALLOW_API_HEAD !== "true" && run.head_sha !== process.env.EXPECTED_HEAD_SHA) throw new Error("Run head SHA mismatch");
// GitHub clears run.pull_requests once the PR is merged/closed, which made
// REQUIRE_MERGED structurally unsatisfiable. Fall back to a head-SHA lookup that
// still pins the run to exactly one PR of this repository targeting main.
let candidates = Array.isArray(run.pull_requests) ? run.pull_requests : [];
if (candidates.length === 0) {
  const search = await api(`/commits/${run.head_sha}/pulls`);
  candidates = search.filter((item) => item.base.ref === "main" && item.head.sha === run.head_sha);
}
if (candidates.length !== 1) throw new Error("Expected exactly one pull request");
const pr = candidates[0];
const detail = await api(`/pulls/${pr.number}`);
if (detail.head.sha !== run.head_sha) throw new Error("PR head SHA mismatch");
if (detail.head.sha !== run.head_sha || detail.base.ref !== "main") throw new Error("PR head/base mismatch");
if (process.env.REQUIRE_MERGED === "true" && (!detail.merged || !detail.merge_commit_sha)) throw new Error("PR is not merged");
const allArtifacts = [];
for (let page = 1; ; page += 1) {
  const batch = await api(`/actions/runs/${runId}/artifacts?per_page=100&page=${page}`);
  allArtifacts.push(...batch.artifacts);
  if (allArtifacts.length >= batch.total_count || batch.artifacts.length === 0) break;
}
const matches = allArtifacts.filter((item) => !item.expired && item.name === process.env.EXPECTED_ARTIFACT);
if (matches.length !== 1) throw new Error(`Expected one artifact, got ${matches.length}`);
console.log(JSON.stringify({ run_id: run.id, pr: pr.number, head: run.head_sha, base: detail.base.sha, merged: detail.merged, merge_commit_sha: detail.merge_commit_sha, artifact_id: matches[0].id }));
