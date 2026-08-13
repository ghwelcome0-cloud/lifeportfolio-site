#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {readProductionFreeze,requireProductionOpen} from "./production-freeze-lib.mjs";

const activation=JSON.parse(fs.readFileSync("contracts/activation.json","utf8"));
const entry=activation.contracts.production_deploy_freeze;
const immutable=["contracts/production-deploy-freeze.json",".github/workflows/firebase-hosting-live.yml","scripts/production-freeze-lib.mjs","scripts/verify-production-freeze.mjs","scripts/test-production-freeze.mjs","scripts/test-production-freeze-governance.mjs","scripts/test-trusted-workflow-policy.mjs","scripts/test-all.mjs","scripts/contract-manifest-lib.mjs","scripts/test-contract-manifest-negative.mjs",".github/workflows/required-checks.yml"];
assert.equal(entry.active,true);assert.equal(entry.activation_pr,249);assert.deepEqual(entry.files,immutable);assert.deepEqual(entry.command,{command:"node",args:["scripts/test-production-freeze-governance.mjs"]});
for(const file of immutable)assert.ok(fs.existsSync(file),`production freeze protected file missing: ${file}`);
const freeze=readProductionFreeze();assert.equal(freeze.enabled,false);assert.throws(()=>requireProductionOpen(freeze));assert.throws(()=>requireProductionOpen({...freeze,enabled:true,approval:{decision:"approved",head_sha:"a".repeat(40),source_run_id:1,manifest_sha256:"b".repeat(64)}}));
const live=fs.readFileSync(".github/workflows/firebase-hosting-live.yml","utf8");
assert.doesNotMatch(live,/production_freeze_open:|PRODUCTION_DEPLOY_ENABLED|actions\/variables/);
assert.equal((live.match(/node scripts\/verify-production-freeze\.mjs/g)||[]).length,2);
const first=live.indexOf("node scripts/verify-production-freeze.mjs"),materialize=live.indexOf("printf '%s' \"$SERVICE_ACCOUNT_JSON\""),second=live.lastIndexOf("node scripts/verify-production-freeze.mjs"),deploy=live.indexOf("npx --no-install firebase deploy");
assert.ok(first>=0&&first<materialize);assert.ok(second>first&&second<deploy);
const required=fs.readFileSync(".github/workflows/required-checks.yml","utf8");assert.match(required,/node scripts\/test-contract-manifest\.mjs/);
const all=fs.readFileSync("scripts/test-all.mjs","utf8");assert.match(all,/scripts\/test-production-freeze-governance\.mjs/);
console.log("Production deploy freeze canonical activation/governance/integration contract passed");
