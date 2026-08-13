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
// 2026-08-11 amendment (owner-directed): the live promotion workflow may fall back to the
// repository deploy identity when the production-live environment secret is absent. The
// fallback is narrowly scoped by the assertions below; every other workflow still may not
// touch the repository deploy secret at all.
const secretExemptWorkflows = new Set(["firebase-hosting-preview-deploy.yml", "firebase-hosting-live.yml"]);
for (const name of files.filter((name) => !secretExemptWorkflows.has(name))) {
  const body = fs.readFileSync(path.join(workflowDir, name), "utf8");
  assert.doesNotMatch(body, /secrets\.FIREBASE_SERVICE_ACCOUNT\b/, `${name}: repository preview secret forbidden`);
}
const live = fs.readFileSync(path.join(workflowDir, "firebase-hosting-live.yml"), "utf8");
assert.match(live, /environment:\s*production-live/);
assert.match(live, /secrets\.FIREBASE_PRODUCTION_SERVICE_ACCOUNT/);
const liveRepoSecretRefs = live.match(/secrets\.FIREBASE_SERVICE_ACCOUNT\b/g) || [];
assert.ok(liveRepoSecretRefs.length <= 1, "live: repository deploy secret may be referenced at most once");
if (liveRepoSecretRefs.length === 1) {
  const preferredIndex = live.indexOf("secrets.FIREBASE_PRODUCTION_SERVICE_ACCOUNT");
  const fallbackIndex = live.search(/secrets\.FIREBASE_SERVICE_ACCOUNT\b/);
  assert.ok(preferredIndex >= 0 && preferredIndex < fallbackIndex, "live: environment secret must be declared before the fallback");
  const gatesBeforeCredential = [
    "Require dispatch from current main",
    "verify-workflow-artifact.mjs",
    "verify-hosting-provenance.mjs",
    "npm run build:hosting",
    "REVIEWED_MANIFEST_SHA",
  ];
  for (const gate of gatesBeforeCredential) {
    const at = live.indexOf(gate);
    assert.ok(at >= 0, `live: missing required gate ${gate}`);
    assert.ok(at < fallbackIndex, `live: gate ${gate} must run before credential access`);
  }
  assert.match(live, /if \[ -z "\$SERVICE_ACCOUNT_JSON" \]; then/, "live: fallback must be conditional on an empty environment secret");
  assert.match(live, /c\.project_id!=="lifeporfolio"/, "live: fallback credential must be pinned to the lifeporfolio project");
  assert.match(live, /rm -f "\$RUNNER_TEMP\/production-sa\.json"/, "live: credential file must be removed after deploy");
}
for(const name of["required-checks.yml","governance-bootstrap.yml","firebase-hosting-pr-build.yml","public-contact-policy-activation.yml"]){const body=fs.readFileSync(path.join(workflowDir,name),"utf8");if(!body.includes("PR_HEAD_SHA:"))throw new Error(`${name}: PR_HEAD_SHA env missing`);}
const integration=fs.readFileSync("scripts/test-steady-current-integration.mjs","utf8");
for(const required of["requirePrHead","checkoutExpectedHead"])assert.ok(integration.includes(required),`integration helper missing: ${required}`);
for(const forbidden of[/PR_HEAD_SHA\s*\|\|/,/\["init"\]/,/\["fetch"/,/\["checkout"/])assert.doesNotMatch(integration,forbidden,"manual checkout or merge fallback forbidden");
console.log("Trusted workflow policy negative checks passed");
