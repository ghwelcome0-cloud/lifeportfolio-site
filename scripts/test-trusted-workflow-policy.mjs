#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const workflowDir = ".github/workflows";
const files = fs.readdirSync(workflowDir).filter((name) => name.endsWith(".yml"));
for (const name of files) {
  const body = fs.readFileSync(path.join(workflowDir, name), "utf8");
  assert.equal(/\bpull_request_target\s*:/.test(body), false, `${name}: pull_request_target forbidden`);
  assert.equal(/\bworkflow_call\s*:/.test(body), false, `${name}: workflow_call forbidden`);
  assert.equal(/ref:\s*\$\{\{\s*github\.event\.pull_request/.test(body), false, `${name}: PR-ref checkout forbidden`);
}
const preview = fs.readFileSync(path.join(workflowDir, "firebase-hosting-preview-deploy.yml"), "utf8");
assert.match(preview, /environment:\s*protected-preview/);
assert.match(preview, /secrets\.FIREBASE_SERVICE_ACCOUNT/);
assert.ok(preview.indexOf("verify-downloaded-hosting-artifact.mjs") < preview.indexOf("secrets.FIREBASE_SERVICE_ACCOUNT"), "credential access must follow byte verification");
for (const name of files.filter((name) => name !== "firebase-hosting-preview-deploy.yml")) {
  const body = fs.readFileSync(path.join(workflowDir, name), "utf8");
  assert.doesNotMatch(body, /secrets\.FIREBASE_SERVICE_ACCOUNT\b/, `${name}: repository preview secret forbidden`);
}
const live = fs.readFileSync(path.join(workflowDir, "firebase-hosting-live.yml"), "utf8");
assert.match(live, /environment:\s*production-live/);
assert.doesNotMatch(live, /secrets\.FIREBASE_SERVICE_ACCOUNT\b/);
assert.match(live, /secrets\.FIREBASE_PRODUCTION_SERVICE_ACCOUNT/);
console.log("Trusted workflow policy negative checks passed");
