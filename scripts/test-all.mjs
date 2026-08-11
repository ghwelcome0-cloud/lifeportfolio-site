#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";

const failures = [];

function run(label, command, args, options = {}) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(command, args, { stdio: "inherit", shell: false, ...options });
  if (result.error || result.status !== 0) {
    failures.push(`${label} (exit ${result.status ?? "spawn error"})`);
  }
}

run("JSON syntax", process.execPath, ["scripts/test-json-syntax.mjs"]);
run("Engine syntax", process.execPath, ["--check", "assets/js/report-engine.js"]);
run("Report v4 syntax", process.execPath, ["--check", "assets/js/report-engine-v4.js"]);
run("Program syntax", process.execPath, ["--check", "assets/js/program-engine.js"]);
run("Execution strategy extended", process.execPath, ["scripts/test_execution_strategy_v2_ext.js"]);

// Contract suites are activated by their owning PRs. The stable root check name
// remains unchanged while PR-A/PR-B add these files and rebase onto PR-GOV.
if (fs.existsSync("scripts/build-hosting.mjs")) {
  run("Hosting deterministic build", "npm", ["run", "test:hosting:determinism"]);
  run("Hosting manifest/DLP", "npm", ["run", "test:hosting"]);
} else {
  console.log("\n=== Hosting contract ===\nSKIP: PR-A not present");
}

if (fs.existsSync("tests/rules/payment-authority.test.cjs")) {
  run("Payment authority Rules Emulator", "npm", ["run", "test:rules"]);
} else {
  console.log("\n=== Payment authority contract ===\nSKIP: PR-B not present");
}

if (failures.length) {
  console.error(`\nComposite checks failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("\nComposite required checks passed");
