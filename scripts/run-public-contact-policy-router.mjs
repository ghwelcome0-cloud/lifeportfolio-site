#!/usr/bin/env node
import {execFileSync,spawnSync} from "node:child_process";
import fs from "node:fs";
import {readBaseManifest} from "./contract-manifest-lib.mjs";
import {commandPlan,routePolicyContract} from "./public-contact-router-lib.mjs";
const base=process.env.CONTRACT_BASE_SHA;if(!/^[0-9a-f]{40}$/.test(base||""))throw new Error("Base SHA required");
const changed=execFileSync("git",["diff","--name-only",`${base}...HEAD`],{encoding:"utf8"}).trim().split("\n").filter(Boolean),currentManifest=JSON.parse(fs.readFileSync("contracts/activation.json")),baseManifest=readBaseManifest(base,"contracts/activation.json"),mode=routePolicyContract(changed,currentManifest,baseManifest),plan=commandPlan(mode);
function run(command,args){const r=spawnSync(command,args,{stdio:"inherit",env:process.env});if(r.status!==0)throw new Error(`${command} ${args.join(" ")} failed`);}
if(!fs.existsSync("contracts/public-contact-policy.json"))throw new Error("Active policy missing");
run("node",["scripts/test-contract-manifest.mjs"]);
run("node",["scripts/test-public-contact-policy-governance.mjs"]);
run("node",["scripts/test-composed-source.mjs"]);
if(plan.includes("migration")){
  run("node",["scripts/verify-public-contact-migration.mjs"]);
  run("node",["scripts/verify-approval-evidence.mjs"]);
}
const policy=JSON.parse(fs.readFileSync("contracts/public-contact-policy.json")),source=policy.composed_source,sourceSha=mode==="activation"?source.head_sha:process.env.PR_HEAD_SHA,worktree=mode==="activation"?"/tmp/pr226":"/tmp/current-pr";
if(!/^[0-9a-f]{40}$/.test(sourceSha))throw new Error("Source SHA invalid");
execFileSync("git",["worktree","add","--detach",worktree,sourceSha],{stdio:"inherit"});fs.copyFileSync("contracts/public-contact-policy.json",`${worktree}/contracts/public-contact-policy.json`);execFileSync("npm",["ci"],{cwd:worktree,stdio:"inherit"});execFileSync("npm",["run","build:hosting"],{cwd:worktree,stdio:"inherit"});run("node",["scripts/verify-downloaded-hosting-artifact.mjs",`${worktree}/dist`]);if(mode==="activation")run("node",["scripts/verify-composed-source.mjs",`${worktree}/dist/hosting-manifest.json`]);
console.log(`Public contact policy router passed: ${mode}`);
