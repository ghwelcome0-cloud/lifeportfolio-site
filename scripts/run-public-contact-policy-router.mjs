#!/usr/bin/env node
import {execFileSync,spawnSync} from "node:child_process";
import fs from "node:fs";
import {POLICY_GOVERNED_PATHS,routePolicyContract} from "./public-contact-router-lib.mjs";
const base=process.env.CONTRACT_BASE_SHA;if(!/^[0-9a-f]{40}$/.test(base||""))throw new Error("Base SHA required");
const changed=execFileSync("git",["diff","--name-only",`${base}...HEAD`],{encoding:"utf8"}).trim().split("\n").filter(Boolean),mode=routePolicyContract(changed);
function run(command,args){const r=spawnSync(command,args,{stdio:"inherit",env:process.env});if(r.status!==0)throw new Error(`${command} ${args.join(" ")} failed`);}
if(!fs.existsSync("contracts/public-contact-policy.json"))throw new Error("Active policy missing");
run("node",["scripts/test-contract-manifest.mjs"]);
run("node",["scripts/test-public-contact-policy-governance.mjs"]);
run("node",["scripts/test-composed-source.mjs"]);
if(mode==="activation"){
  run("node",["scripts/verify-public-contact-migration.mjs"]);
  run("node",["scripts/verify-approval-evidence.mjs"]);
}
const policy=JSON.parse(fs.readFileSync("contracts/public-contact-policy.json")),source=policy.composed_source;
if(!/^[0-9a-f]{40}$/.test(source.head_sha))throw new Error("Pinned source SHA invalid");
execFileSync("git",["fetch","origin",source.head_sha],{stdio:"inherit"});
execFileSync("git",["worktree","add","--detach","/tmp/pr226",source.head_sha],{stdio:"inherit"});
fs.copyFileSync("contracts/public-contact-policy.json","/tmp/pr226/contracts/public-contact-policy.json");
execFileSync("npm",["ci"],{cwd:"/tmp/pr226",stdio:"inherit"});execFileSync("npm",["run","build:hosting"],{cwd:"/tmp/pr226",stdio:"inherit"});
run("node",["scripts/verify-downloaded-hosting-artifact.mjs","/tmp/pr226/dist"]);run("node",["scripts/verify-composed-source.mjs","/tmp/pr226/dist/hosting-manifest.json"]);
console.log(`Public contact policy router passed: ${mode}`);
