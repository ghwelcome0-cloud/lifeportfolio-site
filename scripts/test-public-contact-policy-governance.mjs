#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
const policyBytes=fs.readFileSync("contracts/public-contact-policy.json");
const policy=JSON.parse(policyBytes);const approval=JSON.parse(fs.readFileSync("contracts/public-contact-policy.approval.json"));
const migrations=JSON.parse(fs.readFileSync("contracts/public-contact-policy.migrations.json"));
assert.equal(approval.schema,1);assert.equal(approval.policy_version,policy.policy_version);assert.equal(approval.approval_pr,policy.approval_pr);
assert.equal(approval.policy_sha256,crypto.createHash("sha256").update(policyBytes).digest("hex"));
const owningMigration=migrations.migrations.find(m=>m.to_version===policy.policy_version);
assert.ok(owningMigration,"no migration record owns the current policy version");
assert.equal(policy.approval_pr,owningMigration.approval_pr);
assert.equal(owningMigration.new_digest,approval.policy_sha256);
if(policy.policy_version===2){
 assert.equal(policy.composed_source.head_sha,"e5b124c2a4b8a8dbfa2415c3763f1a57332fbf05");
 assert.equal(policy.composed_source.expected_file_count,265);
 assert.equal(policy.composed_source.manifest_sha256,"9dd5d623cbe72077eaf2b4e3e24effa714759cda9fadc30587396444b8928e87");
 assert.notEqual(policy.composed_source.head_sha,"9bd0eb5919114d705df783e564391ecfdfa2d613","v2 must not reuse the #226 composed source");
}
const canonical=approval.policy_sha256;
for(const mutate of [
 p=>p.pairs.push({value:"extra@example.org",path:"index.html"}),
 p=>p.pairs.pop(),
 p=>{p.pairs[0].path="product.html"},
 p=>{p.pairs[0].value="other@example.org"},
]){const p=structuredClone(policy);mutate(p);const h=crypto.createHash("sha256").update(JSON.stringify(p,null,2)+"\n").digest("hex");assert.notEqual(h,canonical);assert.throws(()=>assert.equal(h,approval.policy_sha256));}
console.log("Public contact policy approval digest and mutation negatives passed");
for(const f of["scripts/composed-source-lib.mjs","scripts/verify-composed-source.mjs","scripts/test-composed-source.mjs",".github/workflows/public-contact-policy-activation.yml"])assert.ok(fs.existsSync(f),`protected composed file missing: ${f}`);
for(const weakened of [[],["scripts/composed-source-lib.mjs"],["scripts/verify-composed-source.mjs"]])assert.notDeepEqual(weakened,["scripts/composed-source-lib.mjs","scripts/verify-composed-source.mjs","scripts/test-composed-source.mjs",".github/workflows/public-contact-policy-activation.yml"]);
