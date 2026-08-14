import fs from "node:fs";
import path from "node:path";

const patterns = [
  ["email", /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi],
  ["phone", /(?:\+?82[- .]?)?0(?:2|1[016789]|[3-6][1-5])[- .]?\d{3,4}[- .]?\d{4}/g],
  ["jwt", /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g],
  ["bearer", /\bBearer\s+[A-Za-z0-9._~+\/-]+=*\b/gi],
  ["uuid", /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi],
  ["private-url", /https?:\/\/(?:localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+|[^\s/]*\.internal)(?:[^\s"'`]*)/gi],
  ["query-credential", /[?&](?:code|key|auth|session|credential|jwt|token|access_token|refresh_token|sig|email)=[^\s&#"'`]+/gi],
  ["generic-secret", /\b(?:sk_live|pk_live|AIza)[A-Za-z0-9_-]{16,}\b/g],
];
const officialHosts = new Set(["www.law.go.kr", "law.go.kr", "www.privacy.go.kr", "privacy.go.kr", "json-schema.org", "lifeportfolio.invalid"]);
const queryKeys = {
  "www.law.go.kr": new Set(["lsId", "lsiSeq", "evtNo"]), "law.go.kr": new Set(["lsId", "lsiSeq", "evtNo"]),
  "www.privacy.go.kr": new Set(["bbsNo", "bbscttNo", "contsNo"]), "privacy.go.kr": new Set(["bbsNo", "bbscttNo", "contsNo"]),
};

export function scanTree(root) {
  const failures = [], files = [];
  function walk(dir) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); e.isDirectory() ? walk(p) : files.push(p); } }
  walk(root);
  for (const file of files) {
    const rel = path.relative(root, file).split(path.sep).join("/"), body = fs.readFileSync(file, "utf8");
    for (const [label, regex] of patterns) {
      if (rel.endsWith("evidence-digests.json") && label === "phone") continue;
      regex.lastIndex = 0; for (const _ of body.matchAll(regex)) failures.push(`${rel}: ${label}`);
    }
    for (const match of body.matchAll(/https:\/\/[^\s"'`]+/g)) {
      try {
        const url = new URL(match[0]), keys = queryKeys[url.hostname];
        if (officialHosts.has(url.hostname) && url.search) {
          if (!keys) failures.push(`${rel}: official query not allowed`);
          for (const [key, value] of url.searchParams) if (!keys?.has(key) || value.length < 1 || value.length > 80 || /[\s&=#/?]/.test(value)) failures.push(`${rel}: official query key/value not allowlisted`);
        }
      } catch { failures.push(`${rel}: malformed URL`); }
    }
    for (const match of body.matchAll(/"([A-Za-z0-9+/_=-]{48,})"/g)) {
      const value = match[1];
      if (!/^[0-9a-f]{40,64}$/i.test(value) && /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value)) failures.push(`${rel}: high-entropy token candidate`);
    }
  }
  return [...new Set(failures)];
}
