#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = "dist/hosting";
const required = [
  "index.html", "login.html", "signup.html", "product.html", "payment-success.html",
  "suvey.html", "privacy.html", "terms.html", "b2b.html", "b2b-checkout.html",
  "checkin-21.html", "blog/index.html", "assets/site.webmanifest",
];
const forbidden = [
  "admin.html", "b2b-admin.html", "checkin-admin.html", "review-admin.html",
  "functions", "scripts", "reports", "docs", "assets/signature/seal_kimyoungsik.png",
];

const missing = required.filter((item) => !fs.existsSync(path.join(root, item)));
const leaked = forbidden.filter((item) => fs.existsSync(path.join(root, item)));
if (missing.length || leaked.length) {
  console.error(JSON.stringify({ missing, leaked }, null, 2));
  process.exit(1);
}
console.log(`Hosting route smoke passed: ${required.length} required, ${forbidden.length} forbidden`);
