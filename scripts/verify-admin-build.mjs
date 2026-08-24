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
//   7. Reverse reference scan (제작규칙서 v2.1 부록 기법④ · 결함 CP): every local
//      path that a published admin page actually references at runtime
//      (href/src/fetch/import) must exist in dist/admin. 허용 목록이 지면은 담고
//      그 지면이 먹는 데이터를 빠뜨리는 부류를 사람이 아니라 게이트가 잡는다.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ADMIN_ASSET_FILES, ADMIN_DATA_FILES, ADMIN_ROOT_FILES } from "./admin-allowlist.mjs";
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
for (const entry of [...ADMIN_ROOT_FILES, ...ADMIN_ASSET_FILES, ...ADMIN_DATA_FILES]) {
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
//    ★ 주석·HTML 코멘트를 먼저 제거한 뒤 센다 — 정규식 게이트가 주석을 맞히고
//      초록불을 켜는 부류를 차단한다(기법⑩ · 결함 DE). 2026-08-24 실측 결과
//      raw 계수와 주석 제거 계수가 4지면 전건 동일했으나, 앞으로 주석에 토큰이
//      추가되어도 보장이 무너지지 않도록 계수 기준을 코드로 고정한다.
function stripComments(text) {
  return text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/^\s*\*.*$/gm, "");
}
for (const page of ADMIN_ROOT_FILES) {
  const body = stripComments(fs.readFileSync(path.join(OUTPUT, page), "utf8"));
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

// 7. reverse reference scan (기법④ · 결함 CP)
//    지면이 실행 중에 부르는 로컬 경로를 전수 추출해 산출물 존재를 확인한다.
//    저장소가 추적 중인 파일이면 "허용 목록 누락"이므로 회귀로 판정하고,
//    추적조차 되지 않는 경로면 링크 자체가 깨진 것이므로 별도로 보고한다.
const REF_PATTERN = /(?:href|src)\s*=\s*["']([^"'>]+)["']|fetch\(\s*["']([^"']+)["']|import\s+["']([^"']+)["']|importScripts\(\s*["']([^"']+)["']/g;
const SCANNABLE = new Set([".html", ".css", ".js", ".json"]);
const presentSet = new Set(manifestPaths);
const trackedFiles = new Set(execFileSync("git", ["ls-files", "-z"], { cwd: ROOT })
  .toString("utf8").split("\0").filter(Boolean));

function resolveReference(raw, base) {
  const bare = raw.split("#")[0].split("?")[0];
  if (!bare) return null;
  if (/^(?:https?:)?\/\//.test(bare)) return null;
  if (/^(?:data|mailto|tel|javascript|blob):/i.test(bare)) return null;
  const joined = bare.startsWith("/")
    ? bare.replace(/^\/+/, "")
    : path.posix.normalize(path.posix.join(path.posix.dirname(base), bare));
  if (!joined || joined.startsWith("..")) return null;
  return joined;
}

for (const relative of manifestPaths) {
  if (!SCANNABLE.has(path.posix.extname(relative).toLowerCase())) continue;
  const text = fs.readFileSync(path.join(OUTPUT, relative), "utf8");
  for (const match of text.matchAll(REF_PATTERN)) {
    const raw = match[1] || match[2] || match[3] || match[4];
    const resolved = resolveReference(raw, relative);
    if (!resolved) continue;
    // firebase.json 의 cleanUrls:true 는 확장자 없는 경로를 .html 로 해석한다.
    if (presentSet.has(resolved) || presentSet.has(`${resolved}.html`)) continue;
    if (trackedFiles.has(resolved)) {
      violations.push(`${relative}: references ${resolved}, which is tracked by git but missing from dist/admin (결함 CP)`);
    } else {
      violations.push(`${relative}: references ${resolved}, which exists neither in dist/admin nor in the repository`);
    }
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
