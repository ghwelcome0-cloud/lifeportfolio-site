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
run("No production dump fixture naming", process.execPath, ["scripts/test-no-production-fixtures.mjs"]);
run("Production freeze negative matrix", process.execPath, ["scripts/test-production-freeze.mjs"]);
run("Production freeze canonical governance", process.execPath, ["scripts/test-production-freeze-governance.mjs"]);
run("Composed source assertions", process.execPath, ["scripts/test-composed-source.mjs"]);
run("Public contact router", process.execPath, ["scripts/test-public-contact-router.mjs"]);
run("Steady current-head integration", process.execPath, ["scripts/test-steady-current-integration.mjs"]);
run("Exact PR head selector", process.execPath, ["scripts/test-pr-head-selector.mjs"]);
run("Exact PR head subprocess", process.execPath, ["scripts/test-pr-head-subprocess.mjs"]);
run("P0-A disclosure contract", process.execPath, ["scripts/test-p0a-disclosures.mjs"]);
run("P0-A browser render geometry", process.execPath, ["scripts/test-p0a-browser-render.mjs"]);

if (failures.length) {
  console.error(`\nComposite checks failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("\nComposite required checks passed");
