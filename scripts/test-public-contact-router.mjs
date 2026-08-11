#!/usr/bin/env node
import assert from "node:assert/strict";
import {canonicalGovernedSet,commandPlan,routePolicyContract} from "./public-contact-router-lib.mjs";
const contract={contracts:{public_contact_policy:{active:true,files:["contracts/public-contact-policy.json","scripts/verifier.mjs"],command:{command:"node",args:["test.js"]}}}};
assert.equal(routePolicyContract(["contracts/public-contact-policy.json"],contract,{}),"activation");assert.equal(routePolicyContract(["README.md"],contract,contract),"steady");assert.equal(routePolicyContract(["scripts/verifier.mjs"],{},contract),"activation");assert.equal(routePolicyContract(["contracts/public-contact-unknown.json"],contract,contract),"activation");
assert.deepEqual(commandPlan("activation"),["manifest","governance","composed-tests","migration","evidence","pinned-build","artifact-dlp","pinned-assert"]);assert.deepEqual(commandPlan("steady"),["manifest","governance","composed-tests","current-build","artifact-dlp"]);
for(const required of["contracts/activation.json","scripts/run-public-contact-policy-router.mjs","scripts/test-all.mjs",".github/workflows/public-contact-policy-activation.yml"])assert.ok(canonicalGovernedSet(contract,contract).includes(required));
console.log("Policy router activation/steady/deletion-command governance fixtures passed");
