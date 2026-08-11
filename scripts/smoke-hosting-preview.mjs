#!/usr/bin/env node

const base = (process.env.PREVIEW_URL || "").replace(/\/$/, "");
if (!base.startsWith("https://")) throw new Error("PREVIEW_URL is required");

const publicRoutes = [
  "/", "/login", "/signup", "/product", "/payment-success", "/suvey",
  "/privacy", "/terms", "/b2b", "/b2b-checkout", "/checkin-21", "/blog/",
  "/assets/site.webmanifest",
];
const forbiddenRoutes = [
  "/scripts/kys_rtdb_node_import.json", "/functions/index.js", "/database.rules.json",
  "/admin", "/b2b-admin", "/checkin-admin", "/review-admin",
  "/assets/signature/seal_kimyoungsik.png",
];

const failures = [];
for (const route of publicRoutes) {
  const response = await fetch(`${base}${route}`, { redirect: "manual" });
  if (response.status < 200 || response.status >= 400) failures.push(`${route}: ${response.status}`);
  if (route === "/") {
    const headers = response.headers;
    if (headers.get("x-frame-options") !== "DENY") failures.push("/: missing X-Frame-Options DENY");
    if (headers.get("x-content-type-options") !== "nosniff") failures.push("/: missing nosniff");
  }
}
for (const route of forbiddenRoutes) {
  const response = await fetch(`${base}${route}`, { redirect: "manual" });
  if (response.status !== 404) failures.push(`${route}: expected 404, got ${response.status}`);
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`Preview smoke passed: ${publicRoutes.length} public, ${forbiddenRoutes.length} forbidden`);
