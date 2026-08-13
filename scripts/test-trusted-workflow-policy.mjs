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
  const prRef = /ref:\s*\$\{\{\s*github\.event\.pull_request/.test(body);
  const exactBootstrapHead = name === "public-contact-bootstrap.yml" && /ref:\s*\$\{\{\s*github\.event\.pull_request\.head\.sha\s*\}\}/.test(body) && /git rev-parse HEAD/.test(body);
  assert.equal(prRef && !exactBootstrapHead, false, `${name}: mutable PR-ref checkout forbidden`);
}
const preview = fs.readFileSync(path.join(workflowDir, "firebase-hosting-preview-deploy.yml"), "utf8");
assert.match(preview, /environment:\s*protected-preview/);
assert.match(preview, /secrets\.FIREBASE_SERVICE_ACCOUNT/);
assert.ok(preview.indexOf("verify-downloaded-hosting-artifact.mjs") < preview.indexOf("secrets.FIREBASE_SERVICE_ACCOUNT"), "credential access must follow byte verification");
const secretExemptWorkflows = new Set(["firebase-hosting-preview-deploy.yml"]);
for (const name of files.filter((name) => !secretExemptWorkflows.has(name))) {
  const body = fs.readFileSync(path.join(workflowDir, name), "utf8");
  assert.doesNotMatch(body, /secrets\.FIREBASE_SERVICE_ACCOUNT\b/, `${name}: repository preview secret forbidden`);
}
const live = fs.readFileSync(path.join(workflowDir, "firebase-hosting-live.yml"), "utf8");
assert.match(live, /environment:\s*production-live/);
assert.match(live, /secrets\.FIREBASE_PRODUCTION_SERVICE_ACCOUNT/);
assert.doesNotMatch(live, /secrets\.FIREBASE_SERVICE_ACCOUNT\b/, "live: repository preview credential fallback forbidden");
assert.match(live, /test -n "\$FIREBASE_PRODUCTION_SERVICE_ACCOUNT"/, "live: production credential must fail closed when absent");
assert.match(live, /c\.project_id!=="lifeporfolio"/, "live: production credential must be pinned to the lifeporfolio project");
assert.match(live, /rm -f "\$RUNNER_TEMP\/production-sa\.json"/, "live: credential file must be removed after deploy");
console.log("Trusted workflow policy negative checks passed");
