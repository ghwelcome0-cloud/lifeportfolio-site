import crypto from "node:crypto";

export const CORPUS_PATHS = [
  "internal/evidence/legal-authorities/registry.v0.2.json",
  "internal/evidence/ropa/registry.v0.1.json",
];

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export function canonicalCorpusDigest(readPath) {
  const corpus = CORPUS_PATHS.map((path) => ({ path, value: JSON.parse(readPath(path)) }));
  return crypto.createHash("sha256").update(canonical(corpus), "utf8").digest("hex");
}
