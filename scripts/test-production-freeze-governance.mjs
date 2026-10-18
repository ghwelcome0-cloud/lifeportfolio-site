#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {readProductionFreeze,requireProductionOpen} from "./production-freeze-lib.mjs";

const activation=JSON.parse(fs.readFileSync("contracts/activation.json","utf8"));
const entry=activation.contracts.production_deploy_freeze;
const immutable=["contracts/production-deploy-freeze.json",".github/workflows/firebase-hosting-live.yml","scripts/production-freeze-lib.mjs","scripts/verify-production-freeze.mjs","scripts/test-production-freeze.mjs","scripts/test-production-freeze-governance.mjs","scripts/test-trusted-workflow-policy.mjs","scripts/test-all.mjs","scripts/contract-manifest-lib.mjs","scripts/test-contract-manifest-negative.mjs",".github/workflows/required-checks.yml"];
assert.equal(entry.active,true);assert.equal(entry.activation_pr,249);assert.deepEqual(entry.files,immutable);assert.deepEqual(entry.command,{command:"node",args:["scripts/test-production-freeze-governance.mjs"]});
for(const file of immutable)assert.ok(fs.existsSync(file),`production freeze protected file missing: ${file}`);
// PR #262 redefinition (CEO explicit approval, 2026-08-14): the canonical contract is no longer
// pinned to enabled===false. It is pinned to being EXPLICIT and SELF-CONSISTENT: `enabled` must be
// a real boolean, and an OPEN contract must carry the CEO-approval reason plus the
// "ceo-approved-explicit-open" transition, so no one can silently flip production open with a
// leftover incident reason. The closed-side guarantee is kept and strengthened: a closed contract
// still throws no matter what approval-shaped payload is attached. (defect CW: a gate is redefined,
// never deleted, when the governed behaviour legitimately changes.)
const freeze=readProductionFreeze();assert.equal(typeof freeze.enabled,"boolean");
if(freeze.enabled){assert.match(freeze.reason,/approved-by-ceo/,"an OPEN production contract must record CEO approval in reason");assert.equal(freeze.open_transition,"ceo-approved-explicit-open","an OPEN production contract must declare the ceo-approved-explicit-open transition");assert.equal(requireProductionOpen(freeze),freeze);}else{assert.throws(()=>requireProductionOpen(freeze),/Production freeze is closed/);}
assert.throws(()=>requireProductionOpen({...freeze,enabled:false,approval:{decision:"approved",head_sha:"a".repeat(40),source_run_id:1,manifest_sha256:"b".repeat(64)}}),/Production freeze is closed/,"a closed contract must stay closed even with a fully valid approval payload");
const libSrc=fs.readFileSync("scripts/production-freeze-lib.mjs","utf8");assert.match(libSrc,/value\.enabled!==true/,"the enabled switch must remain the gate in production-freeze-lib.mjs");
const live=fs.readFileSync(".github/workflows/firebase-hosting-live.yml","utf8");
assert.doesNotMatch(live,/production_freeze_open:|PRODUCTION_DEPLOY_ENABLED|actions\/variables/);
assert.equal((live.match(/node scripts\/verify-production-freeze\.mjs/g)||[]).length,2);
const first=live.indexOf("node scripts/verify-production-freeze.mjs"),materialize=live.indexOf("printf '%s' \"$FIREBASE_PRODUCTION_SERVICE_ACCOUNT\""),second=live.lastIndexOf("node scripts/verify-production-freeze.mjs"),deploy=live.indexOf("npx --no-install firebase deploy");
assert.ok(first>=0&&first<materialize);assert.ok(second>first&&second<deploy);
const required=fs.readFileSync(".github/workflows/required-checks.yml","utf8");assert.match(required,/node scripts\/test-contract-manifest\.mjs/);
const all=fs.readFileSync("scripts/test-all.mjs","utf8");assert.match(all,/scripts\/test-production-freeze-governance\.mjs/);
console.log("Production deploy freeze canonical activation/governance/integration contract passed");
