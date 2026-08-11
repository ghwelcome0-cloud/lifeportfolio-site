#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const roots = ["data"];
const files = ["firebase.json", "database.rules.json", "firestore.indexes.json"];

function walk(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(relative);
    else if (entry.isFile() && entry.name.endsWith(".json")) files.push(relative);
  }
}
for (const root of roots) walk(root);

for (const file of [...new Set(files)].sort()) {
  JSON.parse(fs.readFileSync(file, "utf8"));
}
console.log(`JSON syntax passed: ${new Set(files).size} files`);
