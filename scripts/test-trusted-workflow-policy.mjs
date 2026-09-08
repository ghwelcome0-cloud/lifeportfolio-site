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
  const exactRequiredHead = name === "required-checks.yml" && /ref:\s*\$\{\{\s*github\.event\.pull_request\.head\.sha\s*\|\|\s*github\.sha\s*\}\}/.test(body) && /EVIDENCE_HEAD_SHA:\s*\$\{\{\s*github\.event\.pull_request\.head\.sha\s*\|\|\s*github\.sha\s*\}\}/.test(body);
  assert.equal(prRef && !exactBootstrapHead && !exactRequiredHead, false, `${name}: mutable PR-ref checkout forbidden`);
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
assert.doesNotMatch(live,/production_freeze_open:/,"live: dispatcher-controlled freeze override forbidden");
assert.doesNotMatch(live,/PRODUCTION_DEPLOY_ENABLED|actions\/variables/,"live: variable freeze override forbidden");
assert.equal((live.match(/node scripts\/verify-production-freeze\.mjs/g)||[]).length,2,"live: versioned freeze must be checked before credential materialization and deploy");
const firstFreeze=live.indexOf("node scripts/verify-production-freeze.mjs"),materialize=live.indexOf("printf '%s' \"$FIREBASE_PRODUCTION_SERVICE_ACCOUNT\""),lastFreeze=live.lastIndexOf("node scripts/verify-production-freeze.mjs"),deploy=live.indexOf("npx --no-install firebase deploy");assert.ok(firstFreeze<materialize,"live: first freeze check must precede credential materialization");assert.ok(lastFreeze<deploy,"live: second freeze check must precede deploy");
assert.match(live, /secrets\.FIREBASE_PRODUCTION_SERVICE_ACCOUNT/);
assert.doesNotMatch(live,/secrets\.FIREBASE_SERVICE_ACCOUNT\b|\bFIREBASE_SERVICE_ACCOUNT\b/,"live: repository preview credential and renamed fallback forbidden");assert.match(live,/test -n "\$FIREBASE_PRODUCTION_SERVICE_ACCOUNT"/);assert.doesNotMatch(live,/if \[ -z "\$FIREBASE_PRODUCTION_SERVICE_ACCOUNT"|SERVICE_ACCOUNT_JSON|IDENTITY_SOURCE|fallback/i);assert.match(live,/c\.project_id!=="lifeporfolio"/);assert.match(live,/rm -f "\$RUNNER_TEMP\/production-sa\.json"/);
for(const bad of [live.replace("FIREBASE_PRODUCTION_SERVICE_ACCOUNT: ${{ secrets.FIREBASE_PRODUCTION_SERVICE_ACCOUNT }}","FIREBASE_PRODUCTION_SERVICE_ACCOUNT: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}"),live.replace("test -n \"$FIREBASE_PRODUCTION_SERVICE_ACCOUNT\"","FIREBASE_SERVICE_ACCOUNT=${FIREBASE_PRODUCTION_SERVICE_ACCOUNT:-fallback}"),live.replace("printf '%s' \"$FIREBASE_PRODUCTION_SERVICE_ACCOUNT\"","printf '%s' \"${FIREBASE_PRODUCTION_SERVICE_ACCOUNT:-$REPO_DEPLOY_ID}\"")])assert.match(bad,/FIREBASE_SERVICE_ACCOUNT|fallback|REPO_DEPLOY_ID/);
for(const name of["required-checks.yml","governance-bootstrap.yml","firebase-hosting-pr-build.yml","public-contact-policy-activation.yml"]){const body=fs.readFileSync(path.join(workflowDir,name),"utf8");if(!body.includes("PR_HEAD_SHA:"))throw new Error(`${name}: PR_HEAD_SHA env missing`);}
const requiredWorkflow=fs.readFileSync(path.join(workflowDir,"required-checks.yml"),"utf8");
assert.equal((requiredWorkflow.match(/name:\s*Validate internal evidence trust root/g)||[]).length,1,"required: exactly one direct evidence step");
assert.equal((requiredWorkflow.match(/EVIDENCE_BASE_SHA:\s*\$\{\{\s*github\.event\.pull_request\.base\.sha\s*\|\|\s*''\s*\}\}/g)||[]).length,2,"required: direct and npm steps must use exact PR base expression");
assert.equal((requiredWorkflow.match(/EVIDENCE_HEAD_SHA:\s*\$\{\{\s*github\.event\.pull_request\.head\.sha\s*\|\|\s*github\.sha\s*\}\}/g)||[]).length,2,"required: exact event-aware head expression twice");
assert.equal((requiredWorkflow.match(/EVIDENCE_PR_NUMBER:\s*\$\{\{\s*github\.event\.pull_request\.number\s*\|\|\s*'0'\s*\}\}/g)||[]).length,2,"required: exact PR expression twice");
assert.equal((requiredWorkflow.match(/EVIDENCE_EVENT_NAME:\s*\$\{\{\s*github\.event_name\s*\}\}/g)||[]).length,2,"required: event name twice");
assert.equal((requiredWorkflow.match(/GITHUB_REPOSITORY:\s*\$\{\{\s*github\.repository\s*\}\}/g)||[]).length,1,"required: exact repository once");
assert.equal((requiredWorkflow.match(/GH_TOKEN:\s*\$\{\{\s*github\.token\s*\}\}/g)||[]).length,1,"required: exact token once");
for(const command of["node scripts/test-ropa-evidence.mjs","node scripts/test-legal-authority-registry.mjs","node scripts/test-internal-evidence-dlp.mjs","node scripts/verify-internal-evidence-activation.mjs"])assert.equal((requiredWorkflow.match(new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"g"))||[]).length,1,`required: ${command} exactly once outside npm test`);
assert.ok(requiredWorkflow.indexOf("Validate internal evidence trust root")<requiredWorkflow.indexOf("- run: npm test"),"required: evidence step must be independent and precede npm test");
const exactEvidencePolicy=x=>(x.match(/name:\s*Validate internal evidence trust root/g)||[]).length===1&&(x.match(/EVIDENCE_BASE_SHA:\s*\$\{\{\s*github\.event\.pull_request\.base\.sha\s*\|\|\s*''\s*\}\}/g)||[]).length===2&&(x.match(/EVIDENCE_HEAD_SHA:\s*\$\{\{\s*github\.event\.pull_request\.head\.sha\s*\|\|\s*github\.sha\s*\}\}/g)||[]).length===2&&(x.match(/EVIDENCE_PR_NUMBER:\s*\$\{\{\s*github\.event\.pull_request\.number\s*\|\|\s*'0'\s*\}\}/g)||[]).length===2&&(x.match(/GITHUB_REPOSITORY:\s*\$\{\{\s*github\.repository\s*\}\}/g)||[]).length===1&&(x.match(/GH_TOKEN:\s*\$\{\{\s*github\.token\s*\}\}/g)||[]).length===1&&["test-ropa-evidence","test-legal-authority-registry","test-internal-evidence-dlp","verify-internal-evidence-activation"].every(c=>(x.match(new RegExp(c,"g"))||[]).length===1);
for(const [name,mutate] of[["step-delete",x=>x.replace(/      - name: Validate internal evidence trust root[\s\S]*?      - run: npm test/,"      - run: npm test")],["step-rename",x=>x.replace("Validate internal evidence trust root","Evidence")],["command-delete",x=>x.replace("          node scripts/test-ropa-evidence.mjs\n","")],["base-weaken",x=>x.replaceAll("github.event.pull_request.base.sha || ''","github.sha")],["head-misuse",x=>x.replaceAll("github.event.pull_request.head.sha || github.sha","github.sha")],["pr-constant",x=>x.replaceAll("github.event.pull_request.number || '0'","1")],["repo-arbitrary",x=>x.replace("GITHUB_REPOSITORY: ${{ github.repository }}","GITHUB_REPOSITORY: arbitrary/repo")],["token-delete",x=>x.replace("GH_TOKEN: ${{ github.token }}","")]])assert.equal(exactEvidencePolicy(mutate(requiredWorkflow)),false,`required mutation must fail: ${name}`);
const integration=fs.readFileSync("scripts/test-steady-current-integration.mjs","utf8");
for(const required of["selectCurrentHead","checkoutExpectedHead"])assert.ok(integration.includes(required),`integration helper missing: ${required}`);
for(const forbidden of[/PR_HEAD_SHA\s*\|\|/,/\["init"\]/,/\["fetch"/,/\["checkout"/])assert.doesNotMatch(integration,forbidden,"manual checkout or merge fallback forbidden");
console.log("Trusted workflow policy negative checks passed");
