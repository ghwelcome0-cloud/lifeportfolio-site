#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
const violations = [];
for (const name of fs.readdirSync("scripts")) {
  if (/kys_(?:real|rtdb)|rtdb_(?:import|node_import)/i.test(name)) violations.push(name);
}
for (const file of ["scripts/synthetic_assessment_v41.js", "scripts/fixtures/synthetic_assessment.js"]) {
  const body = fs.readFileSync(path.resolve(file), "utf8");
  if (/REAL DATA|Real RTDB|ghwelcome0@gmail\.com/.test(body)) violations.push(file);
}
if (violations.length) { console.error(violations.join("\n")); process.exit(1); }
console.log("Production dump fixture naming/content policy passed");
