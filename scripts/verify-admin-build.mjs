#!/usr/bin/env node

// Verifies the admin Hosting surface without weakening the public-site gates.
//
// Checks performed
//   1. dist/admin matches dist/admin-manifest.json byte-for-byte (sha256 + length).
//   2. Every required operator page is present.
//   3. No public-site surface leaked into dist/admin (index/report/suvey/... 등).
//   4. The two publication contracts are disjoint: nothing in the admin
//      allowlist may appear in the public allowlist, and the public build's
//      forbidden list must still contain every admin page.
//   5. Every admin page enforces the custom-claim gate in its own source
//      (getIdTokenResult + claims.admin), so a deploy cannot silently ship
//      an operator page whose authorization check was removed.
//   6. dist stays untracked.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ADMIN_ASSET_FILES, ADMIN_ROOT_FILES } from "./admin-allowlist.mjs";
import { PUBLIC_DATA_FILES, PUBLIC_ROOT_FILES } from "./hosting-allowlist.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = path.join(ROOT, "dist", "admin");
const MANIFEST = path.join(ROOT, "dist", "admin-manifest.json");
const violations = [];

if (!fs.existsSync(MANIFEST)) {
  console.error("dist/admin-manifest.json missing — run npm run build:admin first");
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
const manifestPaths = manifest.files.map((entry) => entry.path);

// 1. manifest fidelity
for (const entry of manifest.files) {
  const target = path.join(OUTPUT, entry.path);
  if (!fs.existsSync(target)) {
    violations.push(`${entry.path}: listed in manifest but missing from dist/admin`);
    continue;
  }
  const body = fs.readFileSync(target);
  const hash = crypto.createHash("sha256").update(body).digest("hex");
  if (hash !== entry.sha256 || body.length !== entry.bytes) {
    violations.push(`${entry.path}: manifest mismatch`);
  }
}

// walk dist/admin to catch files that are present but unlisted
function walk(dir, prefix = "") {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.isDirectory()) walk(path.join(dir, item.name), relative);
    else if (!manifestPaths.includes(relative)) {
      violations.push(`${relative}: present in dist/admin but absent from manifest`);
    }
  }
}
walk(OUTPUT);

// 2. required operator pages
for (const required of ADMIN_ROOT_FILES) {
  if (!manifestPaths.includes(required)) {
    violations.push(`${required}: required admin page missing`);
  }
}

// 3. public surface must never appear on the admin site
for (const forbidden of [
  "index.html", "product.html", "report.html", "suvey.html", "program.html",
  "login.html", "signup.html", "mypage.html", "privacy.html", "terms.html",
  "b2b.html", "checkin-21.html", "sitemap.xml", "robots.txt", "CNAME",
  "assets/signature/seal_kimyoungsik.png", "lead.html", "pdf-sign.html",
]) {
  if (manifestPaths.includes(forbidden)) {
    violations.push(`${forbidden}: public surface leaked onto the admin site`);
  }
}

// 4. the two contracts must stay disjoint, and public gates must stay intact
const publicContract = new Set([...PUBLIC_ROOT_FILES, ...PUBLIC_DATA_FILES]);
for (const entry of [...ADMIN_ROOT_FILES, ...ADMIN_ASSET_FILES]) {
  // Shared *assets* are legitimate (fonts/favicon live in a public tree),
  // but no admin *page* may ever enter the public root contract.
  if (ADMIN_ROOT_FILES.includes(entry) && publicContract.has(entry)) {
    violations.push(`${entry}: admin page present in the public allowlist`);
  }
}
const publicVerifier = fs.readFileSync(path.join(ROOT, "scripts/verify-hosting-build.mjs"), "utf8");
for (const page of ADMIN_ROOT_FILES) {
  if (!publicVerifier.includes(`"${page}"`)) {
    violations.push(`${page}: no longer listed as forbidden in verify-hosting-build.mjs`);
  }
}

// 5. every admin page must still enforce the custom-claim gate
for (const page of ADMIN_ROOT_FILES) {
  const body = fs.readFileSync(path.join(OUTPUT, page), "utf8");
  if (!body.includes("getIdTokenResult")) {
    violations.push(`${page}: missing getIdTokenResult — claim gate absent`);
  }
  if (!/claims\s*(\.|\[)\s*["']?admin/.test(body)) {
    violations.push(`${page}: missing claims.admin check — authorization gate absent`);
  }
  if (!body.includes("onAuthStateChanged")) {
    violations.push(`${page}: missing onAuthStateChanged — auth gate absent`);
  }
}

// 6. dist stays untracked
const trackedDist = execFileSync("git", ["ls-files", "dist"], { cwd: ROOT }).toString("utf8").trim();
if (trackedDist) violations.push("dist must remain ignored and untracked");

if (violations.length) {
  console.error(violations.join("\n"));
  process.exit(1);
}
console.log(`Admin allowlist and claim-gate scan passed: ${manifestPaths.length} files`);
