import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const forbiddenRoots = new Set(["functions", "scripts", "docs", "reports", ".git", ".github"]);
const forbiddenNames = new Set(["database.rules.json", "firebase.json", "kys_rtdb_node_import.json"]);
const sensitive = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/,
  /\b01[016789]-?\d{3,4}-?\d{4}\b/,
  /"(?:answers|responses|orderId|captureID|access_token|refresh_token)"\s*:/i,
  /\b(?:sk_live|pk_live)_[A-Za-z0-9]{16,}\b/,
];

function safeRelative(value) {
  if (typeof value !== "string" || !value || path.isAbsolute(value) || value.includes("\\")) throw new Error(`Unsafe path: ${value}`);
  const normalized = path.posix.normalize(value);
  if (normalized !== value || normalized.startsWith("../") || normalized.split("/").some((part) => part === ".." || part.startsWith("."))) throw new Error(`Unsafe path: ${value}`);
  return normalized;
}

export function verifyArtifact(root) {
  const output = path.join(root, "hosting");
  const manifestPath = path.join(root, "hosting-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
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
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(output, absolute).split(path.sep).join("/");
      const stat = fs.lstatSync(absolute);
      if (stat.isSymbolicLink()) throw new Error(`Symlink forbidden: ${relative}`);
      if (stat.isDirectory()) walk(absolute);
      else if (stat.isFile()) disk.set(safeRelative(relative), stat);
      else throw new Error(`Unsupported artifact node: ${relative}`);
    }
  }
  walk(output);
  if (disk.size !== listed.size) throw new Error("Manifest is not a complete byte-level enumeration");
  for (const [relative, stat] of disk) {
    const item = listed.get(relative);
    if (!item) throw new Error(`Unlisted file: ${relative}`);
    const top = relative.split("/")[0];
    if (forbiddenRoots.has(top) || forbiddenNames.has(path.posix.basename(relative))) throw new Error(`Forbidden path: ${relative}`);
    if (stat.size > MAX_FILE_BYTES || stat.size !== item.bytes) throw new Error(`Size mismatch/oversize: ${relative}`);
    const body = fs.readFileSync(path.join(output, relative));
    if (crypto.createHash("sha256").update(body).digest("hex") !== item.sha256) throw new Error(`Hash mismatch: ${relative}`);
    const text = body.toString("utf8");
    for (const pattern of sensitive) if (pattern.test(text)) throw new Error(`DLP violation: ${relative}`);
  }
  for (const required of ["index.html", "product.html", "login.html", "privacy.html", "terms.html"]) {
    if (!disk.has(required)) throw new Error(`Static smoke missing: ${required}`);
  }
  return { files: disk.size };
}
