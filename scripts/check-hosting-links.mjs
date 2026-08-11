#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve("dist/hosting");
const failures = [];
const ignored = /^(?:https?:|mailto:|tel:|javascript:|data:|#|\/\/)/i;
function cleanUrlToFile(url, source) {
  if (url.includes("${") || url === "\\" || /^(?:kakaotalk:|intent:)/i.test(url)) return null;
  const raw = url.split("#")[0].split("?")[0];
  if (!raw || ignored.test(raw)) return null;
  let target = raw.startsWith("/") ? raw.slice(1) : path.posix.join(path.posix.dirname(source), raw);
  target = path.posix.normalize(target);
  if (target.startsWith("../")) return null;
  const candidates = [target];
  const aliases = { "policy/terms": "terms.html", "policy/privacy": "privacy.html", "en": "index.html", "index-en.html": "index.html" };
  if (aliases[target.replace(/\/$/, "")]) candidates.push(aliases[target.replace(/\/$/, "")]);
  if (target.endsWith("/")) candidates.push(`${target}index.html`);
  else if (!path.posix.extname(target)) candidates.push(`${target}.html`, `${target}/index.html`);
  return candidates;
}
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute);
    else if (entry.isFile() && entry.name.endsWith(".html")) {
      const source = path.relative(root, absolute).split(path.sep).join("/");
      const body = fs.readFileSync(absolute, "utf8");
      for (const match of body.matchAll(/(?:href|src)\s*=\s*["']([^"']+)["']/gi)) {
        const candidates = cleanUrlToFile(match[1], source);
        if (candidates && !candidates.some((candidate) => fs.existsSync(path.join(root, candidate)))) failures.push(`${source} -> ${match[1]}`);
      }
    }
  }
}
walk(root);
if (failures.length) { console.error(`Broken internal links (${failures.length}):\n${failures.join("\n")}`); process.exit(1); }
console.log("Hosting internal href/src crawler passed: 0 broken links");
