import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const forbiddenRoots = new Set(["functions", "scripts", "docs", "reports", ".git", ".github"]);
const forbiddenNames = new Set(["database.rules.json", "firebase.json", "kys_rtdb_node_import.json"]);
const patterns = [
  ["private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/g],
  ["known identifier", /ghwelcome0@gmail\.com/gi],
  ["response or token structure", /"(?:answers|responses|orderId|captureID|access_token|refresh_token)"\s*:/gi],
  ["live credential", /\b(?:sk_live|pk_live)_[A-Za-z0-9]{16,}\b/g],
];
const contactPatterns = [
  ["email", /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?![A-Za-z0-9.-])/g],
  ["domestic phone", /(?<!\d)01[016789]-?\d{3,4}-?\d{4}(?!\d)/g],
  ["international phone", /(?<!\d)\+\d{1,3}[- ]?(?:\d[- ]?){7,14}\d(?!\d)/g],
];

export class DlpViolationError extends Error {
  constructor(relative, label, value) { super(`DLP violation: ${relative}: ${label}: ${value}`); this.name = "DlpViolationError"; }
}

function safeRelative(value) {
  if (typeof value !== "string" || !value || path.isAbsolute(value) || value.includes("\\")) throw new Error(`Unsafe path: ${value}`);
  const normalized = path.posix.normalize(value);
  if (normalized !== value || normalized.startsWith("../") || normalized.split("/").some((part) => part === ".." || part.startsWith("."))) throw new Error(`Unsafe path: ${value}`);
  return normalized;
}

export function loadPublicContactPolicy(policyPath = "contracts/public-contact-policy.json") {
  const policy = JSON.parse(fs.readFileSync(policyPath, "utf8"));
  if (policy.schema !== 1 || !Number.isInteger(policy.policy_version) || !Number.isInteger(policy.approval_pr) || !Array.isArray(policy.pairs)) throw new Error("Invalid public contact policy");
  const pairs = new Set();
  for (const entry of policy.pairs) {
    if (!entry.value || !entry.path) throw new Error("Invalid public contact pair");
    const relative=safeRelative(entry.path);
    if (!relative.endsWith(".html")) throw new DlpViolationError(relative, "policy path not public HTML", entry.value);
    const key=JSON.stringify([entry.value,relative]); if(pairs.has(key)) throw new Error(`Duplicate public contact pair: ${key}`); pairs.add(key);
  }
  return { policy, pairs };
}

export function verifyArtifact(root, { policyPath } = {}) {
  const output = path.join(root, "hosting");
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "hosting-manifest.json"), "utf8"));
  const contacts = loadPublicContactPolicy(policyPath).pairs;
  const discoveredContacts = new Set();
  if (manifest.schema !== 1 || !Array.isArray(manifest.files)) throw new Error("Invalid manifest schema");
  const listed = new Map();
  for (const item of manifest.files) {
    const relative = safeRelative(item.path);
    if (listed.has(relative)) throw new Error(`Duplicate manifest path: ${relative}`);
    if (!Number.isSafeInteger(item.bytes) || item.bytes < 0 || item.bytes > MAX_FILE_BYTES) throw new Error(`Invalid/oversize manifest entry: ${relative}`);
    if (!/^[0-9a-f]{64}$/.test(item.sha256)) throw new Error(`Invalid hash: ${relative}`);
    listed.set(relative, item);
  }
  const disk = new Map();
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name); const relative = path.relative(output, absolute).split(path.sep).join("/"); const stat = fs.lstatSync(absolute);
      if (stat.isSymbolicLink()) throw new Error(`Symlink forbidden: ${relative}`);
      if (stat.isDirectory()) walk(absolute); else if (stat.isFile()) disk.set(safeRelative(relative), stat); else throw new Error(`Unsupported artifact node: ${relative}`);
    }
  }
  walk(output);
  if (disk.size !== listed.size) throw new Error("Manifest is not a complete byte-level enumeration");
  for (const [relative, stat] of disk) {
    const item = listed.get(relative); if (!item) throw new Error(`Unlisted file: ${relative}`);
    if (forbiddenRoots.has(relative.split("/")[0]) || forbiddenNames.has(path.posix.basename(relative))) throw new Error(`Forbidden path: ${relative}`);
    if (stat.size > MAX_FILE_BYTES || stat.size !== item.bytes) throw new Error(`Size mismatch/oversize: ${relative}`);
    const body = fs.readFileSync(path.join(output, relative));
    if (crypto.createHash("sha256").update(body).digest("hex") !== item.sha256) throw new Error(`Hash mismatch: ${relative}`);
    const text = body.toString("utf8");
    for (const [label, regex] of patterns) { regex.lastIndex = 0; const match = regex.exec(text); if (match) throw new DlpViolationError(relative, label, match[0]); }
    for (const [label, regex] of contactPatterns) {
      regex.lastIndex = 0; for (const match of text.matchAll(regex)) {
        const pair=JSON.stringify([match[0],relative]);
        if (!relative.endsWith(".html")) throw new DlpViolationError(relative, `${label} in non-HTML`, match[0]);
        discoveredContacts.add(pair);
        if (!contacts.has(pair)) throw new DlpViolationError(relative, label, match[0]);
      }
    }
  }
  const missing=[...contacts].filter(pair=>!discoveredContacts.has(pair));
  if(missing.length) throw new DlpViolationError("public-contact-policy", "stale or missing pair", missing[0]);
  for (const required of ["index.html", "product.html", "login.html", "privacy.html", "terms.html"]) if (!disk.has(required)) throw new Error(`Static smoke missing: ${required}`);
  return { files: disk.size };
}
