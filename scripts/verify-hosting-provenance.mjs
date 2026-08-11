#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
const mode = process.argv[2];
const provenance = JSON.parse(fs.readFileSync("dist/hosting-provenance.json", "utf8"));
const digest = crypto.createHash("sha256").update(fs.readFileSync("dist/hosting-manifest.json")).digest("hex");
if (digest !== provenance.manifest_sha256) throw new Error("Manifest digest mismatch");
if (provenance.repository !== process.env.EXPECTED_REPOSITORY) throw new Error("Repository mismatch");
if (process.env.EXPECTED_HEAD_SHA && provenance.head_sha !== process.env.EXPECTED_HEAD_SHA) throw new Error("Head SHA mismatch");
if (provenance.workflow_path !== "firebase-hosting-pr-build.yml" || provenance.event !== "pull_request") throw new Error("Workflow/event mismatch");
if (!provenance.source_run_id || !provenance.pr_number || !provenance.base_sha || !provenance.tested_merge_sha) throw new Error("Incomplete provenance");
if (process.env.EXPECTED_RUN_ID && provenance.source_run_id !== Number(process.env.EXPECTED_RUN_ID)) throw new Error("Source run mismatch");
if (process.env.EXPECTED_BASE_SHA && provenance.base_sha !== process.env.EXPECTED_BASE_SHA) throw new Error("Base SHA mismatch");
if (!["preview", "live"].includes(mode)) throw new Error("Unknown mode");
console.log(`Hosting provenance passed for ${mode}`);
