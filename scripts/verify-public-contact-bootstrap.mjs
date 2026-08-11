#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
const manifestPath="contracts/public-contact-bootstrap.approval.json";
const manifest=JSON.parse(fs.readFileSync(manifestPath));
if(manifest.schema!==1||manifest.activation!=="inactive"||!Number.isInteger(manifest.bootstrap_pr))throw new Error("Invalid bootstrap approval manifest");
for(const[path,expected]of Object.entries(manifest.protected_files||{})){const actual=crypto.createHash("sha256").update(fs.readFileSync(path)).digest("hex");if(actual!==expected)throw new Error(`Bootstrap protected-file digest mismatch: ${path}`);}
console.log("Inactive public-contact verifier bootstrap passed");
