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
run("Activated contracts", process.execPath, ["scripts/test-contract-manifest.mjs"]);
run("Contract anti-bypass negatives", process.execPath, ["scripts/test-contract-manifest-negative.mjs"]);
run("Full workflow path", process.execPath, ["scripts/test-workflow-path.mjs"]);
run("Trusted artifact negative fixtures", process.execPath, ["scripts/test-hosting-artifact-verifier.mjs"]);
run("Trusted workflow policy", process.execPath, ["scripts/test-trusted-workflow-policy.mjs"]);

if (failures.length) {
  console.error(`\nComposite checks failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("\nComposite required checks passed");
