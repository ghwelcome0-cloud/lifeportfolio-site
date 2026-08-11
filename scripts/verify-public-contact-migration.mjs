#!/usr/bin/env node
// Bootstrap implementation only. PR #229B will activate this against a policy,
// migration record, same-head approval evidence, and base protected-file digests.
import fs from "node:fs";
if(!fs.existsSync("contracts/public-contact-policy.schema.json"))throw new Error("Policy schema missing");
console.log("Public-contact migration verifier bootstrap is inactive");
