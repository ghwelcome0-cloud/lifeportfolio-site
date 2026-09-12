#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

// Preserve PR240's exact historical approval; later versions require a contiguous
// digest-linked migration chain. This validates metadata, NOT human approvals.
const ROOT_DIGEST="1e6f15164e20e588f477866e8d2bc21656659d81a8145ebc665ae75096fd22b3";
const ROLES=["owner","tech_lead","code_reviewer"];
const hash=bytes=>crypto.createHash("sha256").update(bytes).digest("hex");
const serialize=value=>Buffer.from(JSON.stringify(value,null,2)+"\n");
export function verifyPolicyGovernance(policyBytes,approval,migrations) {
  const policy=JSON.parse(policyBytes.toString());
  assert.equal(policy.schema,1);
  assert.ok(Number.isSafeInteger(policy.policy_version)&&policy.policy_version>=1);
  assert.ok(Number.isSafeInteger(policy.approval_pr)&&policy.approval_pr>0);
  assert.equal(approval.schema,1);
  assert.equal(approval.policy_version,policy.policy_version);
  assert.equal(approval.approval_pr,policy.approval_pr);
  assert.equal(approval.policy_sha256,hash(policyBytes),"Policy approval digest mismatch");
  assert.equal(migrations.schema,1);
  assert.ok(Array.isArray(migrations.migrations));
  assert.equal(migrations.migrations.length,policy.policy_version,"Complete contiguous history required");
  let previousDigest=null;
  for(const [index,record] of migrations.migrations.entries()) {
    assert.equal(record.from_version,index,"Migration history gap/reorder");
    assert.equal(record.to_version,index+1,"Migration version must increment once");
    assert.equal(record.old_digest,previousDigest,"Migration predecessor digest mismatch");
    assert.match(record.new_digest,/^[0-9a-f]{64}$/);
    assert.ok(Number.isSafeInteger(record.approval_pr)&&record.approval_pr>0);
    assert.equal(record.approval_evidence?.source,"PR_BODY_APPROVAL_EVIDENCE");
    assert.equal(record.approval_evidence?.pr,record.approval_pr);
    assert.deepEqual(record.approval_evidence?.required_roles,ROLES);
    if(index===0) {
      assert.equal(record.approval_pr,240,"Historical approval PR must be preserved");
      assert.equal(record.new_digest,ROOT_DIGEST,"Historical v1 digest must be preserved");
    } else assert.notEqual(record.approval_pr,240,"Historical approval cannot authorize a new version");
    previousDigest=record.new_digest;
  }
  const last=migrations.migrations.at(-1);
  assert.equal(last.approval_pr,policy.approval_pr);
  assert.equal(last.new_digest,approval.policy_sha256);
  return {version:policy.policy_version,approval_pr:policy.approval_pr,digest:approval.policy_sha256};
}

export function runGovernanceTests() {
  const bytes=fs.readFileSync("contracts/public-contact-policy.json");
  const policy=JSON.parse(bytes),approval=JSON.parse(fs.readFileSync("contracts/public-contact-policy.approval.json"));
  const migrations=JSON.parse(fs.readFileSync("contracts/public-contact-policy.migrations.json"));
  verifyPolicyGovernance(bytes,approval,migrations);
  let negatives=0;
  // Preserve all previous contact mutation negatives.
  for(const mutate of [
    p=>p.pairs.push({value:"extra@example.org",path:"index.html"}),
    p=>p.pairs.pop(),p=>{p.pairs[0].path="product.html"},p=>{p.pairs[0].value="other@example.org"}
  ]) {
    const p=structuredClone(policy);mutate(p);
    assert.throws(()=>verifyPolicyGovernance(serialize(p),approval,migrations));negatives++;
  }
  // These changes used to be blocked by a hardcoded PR number. The replacement
  // preserves that root and rejects deletion, grafting, skipped versions and roles.
  for(const mutate of [
    m=>m.migrations.shift(),m=>m.migrations.push(structuredClone(m.migrations.at(-1))),
    m=>{m.migrations[0].approval_pr=313},m=>{m.migrations[0].new_digest="0".repeat(64)},
    m=>{m.migrations.at(-1).old_digest="0".repeat(64)},
    m=>{m.migrations.at(-1).to_version+=1},m=>{m.migrations.at(-1).approval_evidence.required_roles=[]},
    m=>{m.migrations.at(-1).approval_evidence.source="self-approved"},
    m=>{m.migrations.at(-1).approval_evidence.pr+=1},m=>{m.migrations.at(-1).new_digest="f".repeat(64)}
  ]) {
    const m=structuredClone(migrations);mutate(m);
    assert.throws(()=>verifyPolicyGovernance(bytes,approval,m));negatives++;
  }
  for(const mutate of [a=>{a.policy_sha256="0".repeat(64)},a=>{a.approval_pr+=1},a=>{a.policy_version+=1}]) {
    const a=structuredClone(approval);mutate(a);
    assert.throws(()=>verifyPolicyGovernance(bytes,a,migrations));negatives++;
  }
  // Verify the v1 root independently even when the current candidate is v2.
  if(policy.policy_version===1) assert.equal(hash(bytes),ROOT_DIGEST);
  else {
    const m=structuredClone(migrations);m.migrations.at(-1).approval_pr=240;m.migrations.at(-1).approval_evidence.pr=240;
    const p=structuredClone(policy);p.approval_pr=240;const b=serialize(p);
    const a={...approval,approval_pr:240,policy_sha256:hash(b)};m.migrations.at(-1).new_digest=a.policy_sha256;
    assert.throws(()=>verifyPolicyGovernance(b,a,m));negatives++;
  }
  for(const f of ["scripts/composed-source-lib.mjs","scripts/verify-composed-source.mjs","scripts/test-composed-source.mjs",".github/workflows/public-contact-policy-activation.yml"])assert.ok(fs.existsSync(f),`protected composed file missing: ${f}`);
  for(const weakened of [[],["scripts/composed-source-lib.mjs"],["scripts/verify-composed-source.mjs"]])assert.notDeepEqual(weakened,["scripts/composed-source-lib.mjs","scripts/verify-composed-source.mjs","scripts/test-composed-source.mjs",".github/workflows/public-contact-policy-activation.yml"]);
  console.log(JSON.stringify({suite:"public_contact_governance",policy_version:policy.policy_version,negative_controls:negatives,status:"passed",human_approval_validated:false}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)runGovernanceTests();
