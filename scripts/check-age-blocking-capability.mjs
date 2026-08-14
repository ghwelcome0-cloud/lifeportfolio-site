#!/usr/bin/env node
import fs from "node:fs";
const contract=JSON.parse(fs.readFileSync("contracts/age-gate-capability.v1.json","utf8"));
const source=fs.readFileSync("functions/index.js","utf8"),pkg=JSON.parse(fs.readFileSync("functions/package.json","utf8"));
const exports=[...source.matchAll(/exports\.(beforeUserCreated|beforeUserSignedIn)\s*=/g)].map(x=>x[1]);
const result={schema:1,read_only:true,project_id:contract.project_id,functions_version:pkg.dependencies?.["firebase-functions"]||null,repo_blocking_exports:exports,identity_platform_enabled:"unverified",auth_blocking_functions_supported:"unverified",authenticated_project_query:false,runtime_status:"absent",release_decision:"blocked"};
if(exports.length)throw new Error("Blocking function export appeared before capability verification");
console.log(JSON.stringify(result));
