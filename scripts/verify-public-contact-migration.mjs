#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
const policyPath="contracts/public-contact-policy.json", approvalPath="contracts/public-contact-policy.approval.json", migrationsPath="contracts/public-contact-policy.migrations.json";
const bytes=fs.readFileSync(policyPath);const policy=JSON.parse(bytes);const approval=JSON.parse(fs.readFileSync(approvalPath));const migrations=JSON.parse(fs.readFileSync(migrationsPath));
const digest=crypto.createHash("sha256").update(bytes).digest("hex");
if(approval.policy_sha256!==digest||approval.policy_version!==policy.policy_version||approval.approval_pr!==policy.approval_pr)throw new Error("Policy approval digest mismatch");
const base=process.env.CONTRACT_BASE_SHA,pr=Number(process.env.CONTRACT_PR_NUMBER);
let old=null;try{old=JSON.parse(execFileSync("git",["show",`${base}:${policyPath}`],{encoding:"utf8"}));}catch{}
const from=old?.policy_version??0;const oldDigest=old?crypto.createHash("sha256").update(execFileSync("git",["show",`${base}:${policyPath}`])).digest("hex"):null;
const record=migrations.migrations.find(m=>m.from_version===from&&m.to_version===policy.policy_version&&m.approval_pr===pr&&m.old_digest===oldDigest&&m.new_digest===digest&&m.approval_evidence?.source==="PR_BODY_APPROVAL_EVIDENCE"&&m.approval_evidence?.pr===pr&&JSON.stringify(m.approval_evidence?.required_roles)==='["owner","tech_lead","code_reviewer"]');
if(!record)throw new Error("Authorized base-aware policy migration record missing");
if(policy.policy_version!==from+1)throw new Error("Policy version must increment exactly once");
console.log("Base-aware public contact migration authorization passed");
