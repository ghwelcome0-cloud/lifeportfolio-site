#!/usr/bin/env node

import fs from "node:fs";

const document = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const urls = [];
function visit(value) {
  if (typeof value === "string" && /^https:\/\/[^/]+\.web\.app\/?$/.test(value)) urls.push(value.replace(/\/$/, ""));
  else if (Array.isArray(value)) value.forEach(visit);
  else if (value && typeof value === "object") Object.values(value).forEach(visit);
}
visit(document);
if (!urls.length) process.exit(1);
process.stdout.write(urls[0]);
