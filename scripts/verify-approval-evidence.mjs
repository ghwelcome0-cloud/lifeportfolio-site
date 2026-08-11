#!/usr/bin/env node

const token = process.env.GH_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const prNumber = process.env.PR_NUMBER;
if (!token || !repository || !prNumber) throw new Error("Approval evidence inputs missing");
const response = await fetch(`https://api.github.com/repos/${repository}/pulls/${prNumber}`, { headers: {
  authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28",
}});
if (!response.ok) throw new Error(`GitHub PR API failed: ${response.status}`);
const pr = await response.json();
const marker = /<!-- approval-evidence\n([\s\S]*?)\n-->/m.exec(pr.body || "");
if (!marker) throw new Error("approval-evidence block missing from PR body");
const evidence = JSON.parse(marker[1]);
if (evidence.schema !== 1 || evidence.head_sha !== pr.head.sha) throw new Error("Approval evidence is stale or invalid");
for (const role of ["owner", "tech_lead", "code_reviewer"]) {
  const item = evidence.approvals?.[role];
  if (!item || item.head_sha !== pr.head.sha || !/^\d+$/.test(String(item.message_id)) || !item.message_link || item.decision !== "approved" || !item.reviewed_at) {
    throw new Error(`${role} approval missing/stale`);
  }
}
console.log(`Approval evidence passed for ${pr.head.sha}`);
