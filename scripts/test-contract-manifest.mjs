#!/usr/bin/env node

import fs from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";

const manifestPath = "contracts/activation.json";
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const baseSha = process.env.CONTRACT_BASE_SHA;

if (baseSha && /^[0-9a-f]{40}$/.test(baseSha)) {
  try {
    const base = JSON.parse(execFileSync("git", ["show", `${baseSha}:${manifestPath}`], { encoding: "utf8" }));
    for (const [name, contract] of Object.entries(base.contracts || {})) {
      if (contract.active && (!manifest.contracts[name] || !manifest.contracts[name].active)) {
        throw new Error(`Active contract cannot be removed or deactivated: ${name}`);
      }
    }
  } catch (error) {
    if (!String(error.message).includes("exists on disk")) throw error;
  }
}

for (const [name, contract] of Object.entries(manifest.contracts || {})) {
  if (!contract.active) continue;
  for (const file of contract.files || []) {
    if (!fs.existsSync(file)) throw new Error(`${name}: activated suite file missing: ${file}`);
  }
  const result = spawnSync(contract.command, { shell: true, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${name}: activated suite failed`);
}
console.log("Contract activation manifest passed");
