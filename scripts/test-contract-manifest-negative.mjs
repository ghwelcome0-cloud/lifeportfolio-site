#!/usr/bin/env node
import assert from "node:assert/strict";
import { runActiveContracts, validateManifest } from "./contract-manifest-lib.mjs";
const command = { command: "node", args: ["test.js"] };
const entry = (active, activation_pr=9) => ({ active, activation_pr, files: ["test.js"], command });
const base = { schema: 1, contracts: { inactive: entry(false), active: entry(true, 8) } };
for (const [label, mutate] of [
  ["inactive key deletion", (m) => delete m.contracts.inactive],
  ["active key deletion", (m) => delete m.contracts.active],
  ["deactivation", (m) => { m.contracts.active.active = false; }],
  ["file rename", (m) => { m.contracts.inactive.files = ["renamed.js"]; }],
  ["command change", (m) => { m.contracts.inactive.command.args = ["other.js"]; }],
  ["wrong activation PR", (m) => { m.contracts.inactive.active = true; }],
]) {
  const next = structuredClone(base); mutate(next);
  assert.throws(() => validateManifest(next, base, { currentPr: label === "wrong activation PR" ? 10 : 9 }), label);
}
console.log("Contract manifest negative tests passed");
assert.throws(() => runActiveContracts({ contracts: { governance: { active: true, files: [".github/workflows/required-checks.yml"], command } } }, { exists: () => false, execute: false }), "validator/workflow deletion");
