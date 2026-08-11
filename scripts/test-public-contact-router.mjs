#!/usr/bin/env node
import assert from "node:assert/strict";
import {POLICY_GOVERNED_PATHS,routePolicyContract} from "./public-contact-router-lib.mjs";
assert.equal(routePolicyContract(["contracts/public-contact-policy.json"]),"activation");
assert.equal(routePolicyContract(["README.md"]),"steady");
assert.equal(routePolicyContract(["contracts/public-contact-policy.approval.json"]),"activation");
assert.equal(routePolicyContract(["scripts/hosting-artifact-verifier-lib.mjs"]),"activation");
for(const required of["contracts/activation.json","scripts/composed-source-lib.mjs",".github/workflows/public-contact-policy-activation.yml"])assert.ok(POLICY_GOVERNED_PATHS.includes(required));
console.log("Policy router activation/steady/deletion-command governance fixtures passed");
