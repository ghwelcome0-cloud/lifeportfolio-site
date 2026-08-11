#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
const body=fs.readFileSync(".github/workflows/public-contact-bootstrap.yml","utf8");
const job=/public-contact-bootstrap:\s*\n\s+name:\s*public-contact-bootstrap\s*\n\s+if:\s*\$\{\{\s*github\.event\.pull_request\.number\s*==\s*231\s*\}\}/.test(body);
assert.equal(job,true,"actual workflow job must be PR 231-only");
const applies=pr=>Number(pr)===231;
assert.equal(applies(231),true);assert.equal(applies(232),false);
console.log("Actual YAML PR 231-only context and PR 232 non-run passed");
