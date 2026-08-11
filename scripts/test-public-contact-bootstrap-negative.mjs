#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
const digest=x=>crypto.createHash("sha256").update(x).digest("hex");
const base={target:"scripts/verifier.mjs",digest:digest("safe")};
for(const next of [{target:"scripts/other.mjs",digest:base.digest},{target:base.target,digest:digest("weak")},{target:"scripts/other.mjs",digest:digest("weak")}])assert.notDeepEqual(next,base);
console.log("Bootstrap target+digest mutation negatives passed");
