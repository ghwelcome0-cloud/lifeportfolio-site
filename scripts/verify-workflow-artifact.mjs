#!/usr/bin/env node
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
if (run.repository.full_name !== repository || run.path !== process.env.EXPECTED_WORKFLOW_PATH) throw new Error("Run repository/workflow mismatch");
if (run.event !== process.env.EXPECTED_EVENT || run.conclusion !== "success") throw new Error("Run event/conclusion mismatch");
if (process.env.ALLOW_API_HEAD !== "true" && run.head_sha !== process.env.EXPECTED_HEAD_SHA) throw new Error("Run head SHA mismatch");
if (!Array.isArray(run.pull_requests) || run.pull_requests.length !== 1) throw new Error("Expected exactly one pull request");
const pr = run.pull_requests[0];
const detail = await api(`/pulls/${pr.number}`);
if (detail.head.sha !== run.head_sha || detail.base.ref !== "main") throw new Error("PR head/base mismatch");
const artifacts = await api(`/actions/runs/${runId}/artifacts`);
const matches = artifacts.artifacts.filter((item) => !item.expired && item.name === process.env.EXPECTED_ARTIFACT);
if (matches.length !== 1) throw new Error(`Expected one artifact, got ${matches.length}`);
console.log(JSON.stringify({ run_id: run.id, pr: pr.number, head: run.head_sha, base: detail.base.sha, artifact_id: matches[0].id }));
