#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
const manifest = fs.readFileSync("dist/hosting-manifest.json");
const keys = ["REPOSITORY", "WORKFLOW", "EVENT_NAME", "SOURCE_RUN_ID", "PR_NUMBER", "HEAD_SHA", "BASE_SHA", "TESTED_MERGE_SHA"];
for (const key of keys) if (!process.env[key]) throw new Error(`${key} is required`);
const record = {
  schema: 1, repository: process.env.REPOSITORY, workflow_path: process.env.WORKFLOW,
  event: process.env.EVENT_NAME, pr_number: Number(process.env.PR_NUMBER),
  source_run_id: Number(process.env.SOURCE_RUN_ID),
  head_sha: process.env.HEAD_SHA, base_sha: process.env.BASE_SHA,
  tested_merge_sha: process.env.TESTED_MERGE_SHA,
  manifest_sha256: crypto.createHash("sha256").update(manifest).digest("hex"),
};
fs.writeFileSync("dist/hosting-provenance.json", `${JSON.stringify(record, null, 2)}\n`);
