#!/usr/bin/env node
import assert from "node:assert/strict";
const bootstrapApplies=pr=>Number(pr)===231;
const activationApplies=(pr,active)=>Number(pr)>=232&&active===true;
assert.equal(bootstrapApplies(231),true);assert.equal(bootstrapApplies(232),false);
assert.equal(activationApplies(232,false),false);assert.equal(activationApplies(232,true),true);
console.log("PR 232 bootstrap non-application and activation contract passed");
