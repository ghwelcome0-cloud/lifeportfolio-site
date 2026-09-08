#!/usr/bin/env node
// 보안 헤더 커버리지 계약 (2026-09-08, GenTeam W §1-4 권고 · 성장기록 사건 18 재발 방지)
// ------------------------------------------------------------------------------
// 무엇: hosting-allowlist 의 공개 HTML 전부를 Firebase cleanUrls 기준 clean URL 로 환산하고,
//       firebase.json(public target) headers 의 source 글롭과 superstatic 과 같은 minimatch 로 대조해
//       X-Frame-Options / X-Content-Type-Options / Referrer-Policy / Content-Security-Policy 가
//       하나라도 붙지 않는 clean URL 이 있으면 실패한다.
// 왜:   2026-08-24(admin) · 2026-09-08(16지면+블로그 100) 두 번 같은 클래스의 누락이 있었다.
//       "**/*.html" 은 clean URL 에 매칭되지 않으므로 사람이 열거를 기억하는 구조로는 세 번째 재발을 막지 못한다.
// 음성 통제군: 존재하지 않는 경로 하나를 넣어 "누락을 실제로 잡는지" 함께 검증한다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import minimatch from "minimatch";
import { PUBLIC_ROOT_FILES } from "./hosting-allowlist.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(fs.readFileSync(path.join(root, "firebase.json"), "utf8"));
const site = (Array.isArray(cfg.hosting) ? cfg.hosting : [cfg.hosting]).find((h) => h.target === "public");
if (!site) { console.error("firebase.json: hosting target 'public' not found"); process.exit(1); }
const REQUIRED = ["X-Frame-Options", "X-Content-Type-Options", "Referrer-Policy", "Content-Security-Policy"];

// superstatic 은 source 를 minimatch 로 (dot 허용) 매칭한다. 선행 '/' 유무를 모두 허용.
function matches(source, url) {
  const opts = { dot: true };
  return minimatch(url, source, opts) || minimatch(url.replace(/^\//, ""), source.replace(/^\//, ""), opts);
}
function headersFor(url) {
  const got = new Map();
  for (const rule of site.headers || []) {
    if (!matches(rule.source, url)) continue;
    for (const h of rule.headers || []) got.set(h.key.toLowerCase(), h.value);
  }
  return got;
}
function toCleanUrls(file) {
  if (!file.endsWith(".html")) return [];
  if (file === "index.html") return ["/"];
  if (file.endsWith("/index.html")) return ["/" + file.slice(0, -"/index.html".length)];
  return ["/" + file.slice(0, -".html".length)];
}

const urls = PUBLIC_ROOT_FILES.flatMap(toCleanUrls);
const missing = [];
for (const u of urls) {
  const got = headersFor(u);
  const lack = REQUIRED.filter((k) => !got.has(k.toLowerCase()));
  if (lack.length) missing.push(`${u} lacks ${lack.join(", ")}`);
}

// 음성 통제군: 어떤 규칙에도 열거되지 않은 가짜 clean URL 은 반드시 "누락"으로 잡혀야 한다.
const control = "/__coverage-negative-control";
const controlLack = REQUIRED.filter((k) => !headersFor(control).has(k.toLowerCase()));
if (controlLack.length !== REQUIRED.length) {
  console.error(`Negative control failed: ${control} unexpectedly received headers — matcher is too permissive`);
  process.exit(1);
}

if (missing.length) {
  console.error(`Hosting header coverage FAILED (${missing.length}/${urls.length} clean URLs):\n- ${missing.join("\n- ")}`);
  process.exit(1);
}
console.log(`Hosting header coverage passed: ${urls.length} clean URLs × ${REQUIRED.length} headers, negative control caught`);
