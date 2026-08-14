#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const ROUTER = path.join(ROOT, "scripts/verify-internal-evidence-activation.mjs");
const CONTRACT = JSON.parse(fs.readFileSync(path.join(ROOT, "internal/evidence/evidence-contract.json"), "utf8"));
const contractSet = new Set(CONTRACT.protected_paths);
const testedSet = new Set();
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "lp-evidence-router-"));

function git(args) {
  return execFileSync("git", args, { cwd: temp, encoding: "utf8" }).trim();
}

function invoke(env, shouldPass, label) {
  const result = spawnSync(process.execPath, [ROUTER], {
    cwd: ROOT,
    env: { ...process.env, EVIDENCE_REPOSITORY_PATH: temp, ...env },
    encoding: "utf8",
  });
  if ((result.status === 0) !== shouldPass) {
    throw new Error(`${label}: router expectation failed\n${result.stdout}\n${result.stderr}`);
  }
}

function copyProtectedTree() {
  for (const relative of CONTRACT.protected_paths) {
    const source = path.join(ROOT, relative);
    if (!fs.existsSync(source) || !fs.statSync(source).isFile()) {
      throw new Error(`protected path missing from ROOT: ${relative}`);
    }
    const destination = path.join(temp, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
  }
}

function commitMutation(base, label, mutate) {
  git(["reset", "--hard", base]);
  git(["clean", "-fd"]);
  mutate();
  git(["add", "-A"]);
  git(["commit", "-qm", label]);
  const head = git(["rev-parse", "HEAD"]);
  invoke({ EVIDENCE_EVENT_NAME: "pull_request", EVIDENCE_BASE_SHA: base, EVIDENCE_HEAD_SHA: head, EVIDENCE_PR_NUMBER: "262" }, false, label);
}

try {
  git(["init", "-q"]);
  git(["config", "user.email", "synthetic@example.invalid"]);
  git(["config", "user.name", "Synthetic Fixture"]);
  fs.writeFileSync(path.join(temp, "README.md"), "base\n");
  git(["add", "."]);
  git(["commit", "-qm", "base"]);
  const emptyBase = git(["rev-parse", "HEAD"]);

  copyProtectedTree();
  git(["add", "."]);
  git(["commit", "-qm", "initial evidence"]);
  const initialHead = git(["rev-parse", "HEAD"]);
  invoke({ EVIDENCE_EVENT_NAME: "pull_request", EVIDENCE_BASE_SHA: emptyBase, EVIDENCE_HEAD_SHA: initialHead, EVIDENCE_PR_NUMBER: "260" }, true, "initial activation");

  const steadyHead = initialHead;
  invoke({ EVIDENCE_EVENT_NAME: "push", EVIDENCE_BASE_SHA: "", EVIDENCE_HEAD_SHA: steadyHead, EVIDENCE_PR_NUMBER: "0" }, true, "push steady");
  invoke({ EVIDENCE_EVENT_NAME: "workflow_dispatch", EVIDENCE_BASE_SHA: "", EVIDENCE_HEAD_SHA: steadyHead, EVIDENCE_PR_NUMBER: "0" }, true, "dispatch steady");

  fs.writeFileSync(path.join(temp, "UNRELATED.md"), "unrelated\n");
  git(["add", "."]);
  git(["commit", "-qm", "unrelated"]);
  const unrelatedHead = git(["rev-parse", "HEAD"]);
  invoke({ EVIDENCE_EVENT_NAME: "pull_request", EVIDENCE_BASE_SHA: steadyHead, EVIDENCE_HEAD_SHA: unrelatedHead, EVIDENCE_PR_NUMBER: "261" }, true, "unrelated PR");

  for (const relative of CONTRACT.protected_paths) {
    commitMutation(unrelatedHead, `one-byte:${relative}`, () => fs.appendFileSync(path.join(temp, relative), "\n"));
    testedSet.add(relative);
  }

  const testAll = "scripts/test-all.mjs";
  commitMutation(unrelatedHead, "delete test-all evidence hook", () => {
    const target = path.join(temp, testAll);
    const body = fs.readFileSync(target, "utf8").replace(/^.*Internal evidence immutable contract.*\n/m, "");
    fs.writeFileSync(target, body);
  });
  commitMutation(unrelatedHead, "delete direct workflow step", () => {
    const target = path.join(temp, ".github/workflows/required-checks.yml");
    const body = fs.readFileSync(target, "utf8").replace(/\n      - name: Validate internal evidence trust root[\s\S]*?\n      - run: npm test/, "\n      - run: npm test");
    fs.writeFileSync(target, body);
  });
  commitMutation(unrelatedHead, "delete direct router command", () => {
    const target = path.join(temp, ".github/workflows/required-checks.yml");
    fs.writeFileSync(target, fs.readFileSync(target, "utf8").replace(/^\s*node scripts\/verify-internal-evidence-activation\.mjs\s*$/m, ""));
  });
  commitMutation(unrelatedHead, "weaken trusted assertion", () => fs.appendFileSync(path.join(temp, "scripts/test-trusted-workflow-policy.mjs"), "\n// weakened\n"));
  commitMutation(unrelatedHead, "delete protected file", () => fs.unlinkSync(path.join(temp, "internal/evidence/ropa/README.md")));
  commitMutation(unrelatedHead, "rename protected file", () => fs.renameSync(path.join(temp, "internal/evidence/ropa/README.md"), path.join(temp, "internal/evidence/ropa/RENAMED.md")));
  commitMutation(unrelatedHead, "remove current protected path", () => {
    const target = path.join(temp, "internal/evidence/evidence-contract.json");
    const current = JSON.parse(fs.readFileSync(target, "utf8"));
    current.protected_paths = current.protected_paths.slice(1);
    fs.writeFileSync(target, `${JSON.stringify(current, null, 2)}\n`);
  });
  commitMutation(unrelatedHead, "delete base-only protected path", () => {
    const target = CONTRACT.protected_paths[1];
    fs.unlinkSync(path.join(temp, target));
    const contractPath = path.join(temp, "internal/evidence/evidence-contract.json");
    const current = JSON.parse(fs.readFileSync(contractPath, "utf8"));
    current.protected_paths = current.protected_paths.filter((item) => item !== target);
    fs.writeFileSync(contractPath, `${JSON.stringify(current, null, 2)}\n`);
  });
  commitMutation(unrelatedHead, "unknown evidence add", () => fs.writeFileSync(path.join(temp, "internal/evidence/unknown.json"), "{}\n"));
  commitMutation(unrelatedHead, "migration synthetic bypass", () => fs.writeFileSync(path.join(temp, "internal/evidence/migrations/bypass.json"), "{}\n"));
  commitMutation(unrelatedHead, "approval synthetic bypass", () => fs.writeFileSync(path.join(temp, "internal/evidence/approval-evidence/bypass.json"), "{}\n"));

  const tested = [...testedSet].sort();
  const expected = [...contractSet].sort();
  if (JSON.stringify(tested) !== JSON.stringify(expected)) {
    throw new Error(`tested protected set mismatch: tested=${tested.length} expected=${expected.length}`);
  }
  console.log(`Protected path mutation matrix PASS: tested=${tested.length}, contract=${expected.length}`);
  console.log("Real-router final PASS: initial/steady/unrelated allowed; every protected/explicit bypass mutation rejected");
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
