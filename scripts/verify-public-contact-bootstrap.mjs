#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
const m=JSON.parse(fs.readFileSync("contracts/public-contact-bootstrap.approval.json"));
if(m.schema!==1||m.activation!=="inactive"||m.bootstrap_pr!==231)throw new Error("Invalid bootstrap manifest");
if(Number(process.env.BOOTSTRAP_PR_NUMBER)!==231)throw new Error("bootstrap PR mismatch");
if(!/^[0-9a-f]{40}$/.test(process.env.BOOTSTRAP_HEAD_SHA||""))throw new Error("bootstrap head must be 40-char SHA");
for(const[file,expected]of Object.entries(m.protected_files||{})){if(expected==="EXTERNAL_HEAD_TRUST")continue;const actual=crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");if(actual!==expected)throw new Error(`Protected digest mismatch: ${file}`);}
if(fs.existsSync("contracts/public-contact-policy.json"))throw new Error("Policy activation forbidden in bootstrap");
console.log("Exact-head inactive public-contact bootstrap passed");
