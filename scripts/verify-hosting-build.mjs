#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = path.join(ROOT, "dist", "hosting");
const MANIFEST = path.join(ROOT, "dist", "hosting-manifest.json");
const forbiddenTopLevel = new Set([
  ".git", ".github", "content", "design-preview", "docs", "functions",
  "ops", "reports", "scripts", "studio", "tools", "youtube", "_ebook_build",
]);
const forbiddenNames = new Set([
  "database.rules.json", "firestore.rules", "firebase.json",
  "kys_rtdb_node_import.json", "kys_rtdb_import.json",
]);
const sensitivePatterns = [
  { label: "known direct identifier", regex: /ghwelcome0@gmail\.com/gi },
  { label: "private key", regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { label: "service account credential", regex: /"private_key_id"\s*:/g },
  { label: "response object", regex: /"(?:answers|responses)"\s*:\s*\{/gi },
  { label: "order or token object", regex: /"(?:orderId|captureID|access_token|refresh_token)"\s*:/gi },
  { label: "live credential", regex: /\b(?:sk_live|pk_live)_[A-Za-z0-9]{16,}\b/g },
  { label: "high entropy assignment", regex: /(?:secret|token|api[_-]?key)\s*[:=]\s*["'][A-Za-z0-9+/=_-]{40,}["']/gi },
];

if (!fs.existsSync(path.join(OUTPUT, "index.html"))) {
  throw new Error("dist/hosting/index.html is missing; run build:hosting first");
}

const violations = [];
const diskFiles = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(OUTPUT, absolute).split(path.sep).join("/");
    const top = relative.split("/")[0];
    if (forbiddenTopLevel.has(top) || forbiddenNames.has(entry.name)) {
      violations.push(`${relative}: forbidden hosting path`);
      continue;
    }
    if (entry.isSymbolicLink()) violations.push(`${relative}: symlink`);
    else if (entry.isDirectory()) walk(absolute);
    else if (entry.isFile()) {
      diskFiles.push(relative);
      const size = fs.statSync(absolute).size;
      if (size > 5 * 1024 * 1024) violations.push(`${relative}: exceeds 5MB manual-review threshold`);
      if (/\.(?:html|js|json|txt|xml|css|svg|webmanifest)$/i.test(relative)) {
        const body = fs.readFileSync(absolute, "utf8");
        for (const pattern of sensitivePatterns) {
          pattern.regex.lastIndex = 0;
          if (pattern.regex.test(body)) violations.push(`${relative}: ${pattern.label}`);
        }
      }
    }
  }
}
walk(OUTPUT);

const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
const manifestPaths = manifest.files.map((entry) => entry.path);
if (JSON.stringify([...diskFiles].sort()) !== JSON.stringify([...manifestPaths].sort())) {
  violations.push("hosting manifest does not match output files");
}
for (const entry of manifest.files) {
  const body = fs.readFileSync(path.join(OUTPUT, entry.path));
  const hash = crypto.createHash("sha256").update(body).digest("hex");
  if (hash !== entry.sha256 || body.length !== entry.bytes) violations.push(`${entry.path}: manifest mismatch`);
}

for (const required of [
  "index.html", "product.html", "login.html", "signup.html", "payment-success.html",
  "suvey.html", "privacy.html", "terms.html", "b2b.html", "b2b-checkout.html",
  "checkin-21.html", "blog/index.html", "assets/site.webmanifest",
]) {
  if (!manifestPaths.includes(required)) violations.push(`${required}: required smoke path missing`);
}

for (const forbidden of [
  "admin.html", "b2b-admin.html", "checkin-admin.html", "review-admin.html",
  "lead.html", "pdf-sign.html", "pdf-sign-share.html", "lease-esign.html",
  "auth-debug.html", "checkin-21-demo.html",
  "marketing/achievements.html", "assets/signature/seal_kimyoungsik.png",
]) {
  if (manifestPaths.includes(forbidden)) violations.push(`${forbidden}: forbidden surface published`);
}

const trackedDist = execFileSync("git", ["ls-files", "dist"], { cwd: ROOT }).toString("utf8").trim();
if (trackedDist) violations.push("dist must remain ignored and untracked");

if (violations.length) {
  console.error(violations.join("\n"));
  process.exit(1);
}
const linkCheck = execFileSync(process.execPath, [path.join(ROOT, "scripts/check-hosting-links.mjs")], { cwd: ROOT, encoding: "utf8" });
process.stdout.write(linkCheck);
console.log("Hosting allowlist and sensitive fixture scan passed");
