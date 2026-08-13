import fs from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";

export function validateManifest(manifest, base, { currentPr } = {}) {
  if (manifest.schema !== 1 || !manifest.contracts || typeof manifest.contracts !== "object") throw new Error("Invalid manifest schema");
  for (const [name, contract] of Object.entries(manifest.contracts)) {
    if (typeof contract.active !== "boolean" || !Array.isArray(contract.files) || !contract.files.length) throw new Error(`${name}: invalid contract`);
    if (!contract.command || typeof contract.command.command !== "string" || !Array.isArray(contract.command.args)) throw new Error(`${name}: command must be {command,args}`);
  }
  if (!base) return;
  if (manifest.schema !== base.schema) throw new Error("Schema migration requires a dedicated migration mechanism");
  for (const [name, oldContract] of Object.entries(base.contracts || {})) {
    const next = manifest.contracts[name];
    if (!next) throw new Error(`Contract key cannot be removed: ${name}`);
    for (const field of ["activation_pr", "files", "command"]) {
      if (JSON.stringify(oldContract[field] ?? null) !== JSON.stringify(next[field] ?? null)) throw new Error(`${name}: immutable field changed: ${field}`);
    }
    if (oldContract.active && !next.active) throw new Error(`${name}: active contract cannot be deactivated`);
    if (!oldContract.active && next.active && Number(currentPr) !== Number(next.activation_pr)) throw new Error(`${name}: activation must occur in PR #${next.activation_pr}`);
  }
  for(const [name,next] of Object.entries(manifest.contracts||{}))if(!(name in (base.contracts||{}))&&next.active&&Number(currentPr)!==Number(next.activation_pr))throw new Error(`${name}: new active contract must activate in PR #${next.activation_pr}`);
}

export function runActiveContracts(manifest, { exists = fs.existsSync, execute = true } = {}) {
  for (const [name, contract] of Object.entries(manifest.contracts)) {
    if (!contract.active) continue;
    for (const file of contract.files) if (!exists(file)) throw new Error(`${name}: activated suite file missing: ${file}`);
    if (!execute) continue;
    const result = spawnSync(contract.command.command, contract.command.args, { shell: false, stdio: "inherit" });
    if (result.status !== 0) throw new Error(`${name}: activated suite failed`);
  }
}

export function readBaseManifest(baseSha, manifestPath) {
  if (!baseSha || !/^[0-9a-f]{40}$/.test(baseSha)) return null;
  try { return JSON.parse(execFileSync("git", ["show", `${baseSha}:${manifestPath}`], { encoding: "utf8" })); }
  catch (error) {
    if (String(error.message).includes("exists on disk")) return null;
    throw error;
  }
}
