#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, ".."), router = path.join(ROOT, "scripts/verify-internal-evidence-activation.mjs");
function invoke(repo, env, shouldPass) { const result = spawnSync(process.execPath, [router], { cwd: ROOT, env: { ...process.env, EVIDENCE_REPOSITORY_PATH: repo, ...env }, encoding: "utf8" }); if ((result.status === 0) !== shouldPass) throw new Error(`router expectation failed: ${result.stdout}\n${result.stderr}`); }
function git(repo, args) { return execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim(); }
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "lp-evidence-router-"));
try {
  git(temp, ["init", "-q"]); git(temp, ["config", "user.email", "synthetic@example.invalid"]); git(temp, ["config", "user.name", "Synthetic Fixture"]);
  fs.writeFileSync(path.join(temp, "README.md"), "base\n"); git(temp, ["add", "."]); git(temp, ["commit", "-qm", "base"]); const emptyBase = git(temp, ["rev-parse", "HEAD"]);
  fs.cpSync(path.join(ROOT, "internal/evidence"), path.join(temp, "internal/evidence"), { recursive: true }); git(temp, ["add", "."]); git(temp, ["commit", "-qm", "initial evidence"]); const initialHead = git(temp, ["rev-parse", "HEAD"]);
  invoke(temp, { EVIDENCE_EVENT_NAME: "pull_request", EVIDENCE_BASE_SHA: emptyBase, EVIDENCE_HEAD_SHA: initialHead, EVIDENCE_PR_NUMBER: "260" }, true);
  fs.writeFileSync(path.join(temp, "internal/evidence/migrations/invalid.json"), "{}\n"); invoke(temp, { EVIDENCE_EVENT_NAME: "pull_request", EVIDENCE_BASE_SHA: emptyBase, EVIDENCE_HEAD_SHA: initialHead, EVIDENCE_PR_NUMBER: "260" }, false); fs.unlinkSync(path.join(temp, "internal/evidence/migrations/invalid.json"));
  fs.mkdirSync(path.join(temp,".github/workflows"),{recursive:true});fs.mkdirSync(path.join(temp,"scripts"),{recursive:true});
  fs.writeFileSync(path.join(temp,".github/workflows/required-checks.yml"),"required\n");fs.writeFileSync(path.join(temp,"scripts/test-internal-evidence-fixture.mjs"),"test\n");fs.writeFileSync(path.join(temp,"scripts/internal-evidence-dlp-fixture.mjs"),"dlp\n");git(temp,["add","."]);git(temp,["commit","-qm","protected roots"]);
  const finalHead = git(temp, ["rev-parse", "HEAD"]);
  invoke(temp, { EVIDENCE_EVENT_NAME: "push", EVIDENCE_BASE_SHA: "", EVIDENCE_HEAD_SHA: finalHead, EVIDENCE_PR_NUMBER: "0" }, true);
  invoke(temp, { EVIDENCE_EVENT_NAME: "workflow_dispatch", EVIDENCE_BASE_SHA: "", EVIDENCE_HEAD_SHA: finalHead, EVIDENCE_PR_NUMBER: "0" }, true);
  invoke(temp, { EVIDENCE_EVENT_NAME: "push", EVIDENCE_BASE_SHA: emptyBase, EVIDENCE_HEAD_SHA: finalHead, EVIDENCE_PR_NUMBER: "260" }, false);
  invoke(temp, { EVIDENCE_EVENT_NAME: "workflow_dispatch", EVIDENCE_BASE_SHA: "", EVIDENCE_HEAD_SHA: "0".repeat(40), EVIDENCE_PR_NUMBER: "0" }, false);
  const unrelatedBase = finalHead; fs.writeFileSync(path.join(temp, "UNRELATED.md"), "unrelated\n"); git(temp, ["add", "."]); git(temp, ["commit", "-qm", "unrelated"]); const unrelatedHead = git(temp, ["rev-parse", "HEAD"]);
  invoke(temp, { EVIDENCE_EVENT_NAME: "pull_request", EVIDENCE_BASE_SHA: unrelatedBase, EVIDENCE_HEAD_SHA: unrelatedHead, EVIDENCE_PR_NUMBER: "261" }, true);
  const contract = JSON.parse(fs.readFileSync(path.join(temp,"internal/evidence/evidence-contract.json")));
  for (const protectedPath of contract.protected_paths) {
    if (!fs.existsSync(path.join(temp, protectedPath))) continue;
    git(temp,["reset","--hard",unrelatedHead]); fs.appendFileSync(path.join(temp,protectedPath),"\n"); git(temp,["add","."]); git(temp,["commit","-qm",`mutate ${protectedPath}`]); const changed=git(temp,["rev-parse","HEAD"]);
    invoke(temp,{EVIDENCE_EVENT_NAME:"pull_request",EVIDENCE_BASE_SHA:unrelatedHead,EVIDENCE_HEAD_SHA:changed,EVIDENCE_PR_NUMBER:"262"},false);
  }
  for (const [name, mutate] of [
    ["byte", () => fs.appendFileSync(path.join(temp, "internal/evidence/ropa/README.md"), "x")],
    ["status", () => { const p=path.join(temp,"internal/evidence/evidence-contract.json"),d=JSON.parse(fs.readFileSync(p));d.status="changed";fs.writeFileSync(p,JSON.stringify(d)); }],
    ["schema", () => fs.appendFileSync(path.join(temp, "internal/evidence/ropa/schema.v0.1.json"), " ")],
    ["workflow", () => fs.appendFileSync(path.join(temp, ".github/workflows/required-checks.yml"), "changed")],
    ["test", () => fs.appendFileSync(path.join(temp, "scripts/test-internal-evidence-fixture.mjs"), "changed")],
    ["DLP", () => fs.appendFileSync(path.join(temp, "scripts/internal-evidence-dlp-fixture.mjs"), "changed")],
    ["rename", () => fs.renameSync(path.join(temp,"internal/evidence/ropa/README.md"),path.join(temp,"internal/evidence/ropa/RENAMED.md"))],
    ["delete", () => fs.unlinkSync(path.join(temp,"internal/evidence/ropa/README.md"))],
    ["add", () => fs.writeFileSync(path.join(temp,"internal/evidence/new-file.md"),"new")],
    ["migration", () => fs.writeFileSync(path.join(temp, "internal/evidence/migrations/x.json"), "{}")],
    ["approval", () => fs.writeFileSync(path.join(temp, "internal/evidence/approval-evidence/x.json"), "{}")]
  ]) { git(temp,["reset","--hard",unrelatedHead]); mutate(); git(temp,["add","."]); git(temp,["commit","-qm",name]); const changed=git(temp,["rev-parse","HEAD"]); invoke(temp,{EVIDENCE_EVENT_NAME:"pull_request",EVIDENCE_BASE_SHA:unrelatedHead,EVIDENCE_HEAD_SHA:changed,EVIDENCE_PR_NUMBER:"262"},false); }
  console.log("Real temp-git PR/push/dispatch activation-router matrix passed");
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
