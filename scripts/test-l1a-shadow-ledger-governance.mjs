#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const activation = JSON.parse(fs.readFileSync("contracts/activation.json"));
const entry = activation.contracts.l1a_shadow_ledger;
const expected = ["contracts/l1a-shadow-ledger.schema.json", "scripts/l1a-shadow-ledger-lib.mjs", "scripts/test-l1a-shadow-ledger-governance.mjs", "tests/fixtures/l1a-shadow-ledger.synthetic.json", "tests/l1a-shadow-ledger.test.mjs", "docs/l1a-shadow-ledger-contract.md"];
assert.equal(entry.active, true); assert.equal(entry.activation_pr, 268); assert.deepEqual(entry.files, expected); assert.deepEqual(entry.command, { command: "node", args: ["scripts/test-l1a-shadow-ledger-governance.mjs"] });
for (const file of expected) assert.equal(fs.existsSync(file), true, `missing ${file}`);
const schema = JSON.parse(fs.readFileSync("contracts/l1a-shadow-ledger.schema.json"));
assert.equal(schema.properties.contract_status.const, "target_unverified"); assert.equal(schema.properties.runtime_enforced.const, false); assert.equal(schema.properties.write_enabled.const, false);
execFileSync(process.execPath, ["tests/l1a-shadow-ledger.test.mjs"], { stdio: "inherit" });

const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" }).trim().split("\n");
const importConsumers = tracked.filter((file) => /\.(?:js|cjs|mjs|ts)$/.test(file) && !expected.includes(file) && fs.readFileSync(file, "utf8").includes("l1a-shadow-ledger-lib.mjs"));
assert.deepEqual(importConsumers, [], "shadow contract import consumer must remain absent");
const functionFiles = tracked.filter((file) => file.startsWith("functions/") && /\.(?:js|cjs|mjs|ts)$/.test(file));
for (const file of functionFiles) { const body = fs.readFileSync(file, "utf8"); assert.doesNotMatch(body, /l1a-shadow-ledger|reduceShadowEvent|l1a-shadow-ledger-lib/); }
assert.doesNotMatch(fs.readFileSync("database.rules.json", "utf8"), /l1aShadow|shadowLedger|paymentAuthorityEvents/);
for (const file of tracked.filter((item) => /\.(?:html|js)$/.test(item) && !item.startsWith("functions/"))) { const body = fs.readFileSync(file, "utf8"); assert.doesNotMatch(body, /l1a-shadow-ledger|paymentAuthorityEvents/); }
console.log("L1A active shadow contract: PASS files=6 status/write mutations=PASS consumer_imports=0 functions_exports_calls=0 db_rules_client_wiring=0");
