#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { verifyArtifact } from "./hosting-artifact-verifier-lib.mjs";

function fixture(extra = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hosting-verify-"));
  const files = {
    "index.html": "ok", "product.html": "ok", "login.html": "ok", "privacy.html": "ok", "terms.html": "ok",
    ...(extra.files || {}),
  };
  for (const [name, body] of Object.entries(files)) {
    const absolute = path.join(root, "hosting", name); fs.mkdirSync(path.dirname(absolute), { recursive: true }); fs.writeFileSync(absolute, body);
  }
  const entries = Object.entries(files).map(([name, body]) => ({ path: name, bytes: Buffer.byteLength(body), sha256: crypto.createHash("sha256").update(body).digest("hex") }));
  fs.writeFileSync(path.join(root, "hosting-manifest.json"), JSON.stringify({ schema: 1, files: entries }));
  return root;
}
assert.equal(verifyArtifact(fixture()).files, 5);
for (const mutate of [
  (r) => fs.writeFileSync(path.join(r,"hosting","extra.txt"),"x"),
  (r) => fs.symlinkSync("index.html",path.join(r,"hosting","link.html")),
  (r) => { const m=JSON.parse(fs.readFileSync(path.join(r,"hosting-manifest.json")));m.files[0].sha256="0".repeat(64);fs.writeFileSync(path.join(r,"hosting-manifest.json"),JSON.stringify(m)); },
  (r) => { const m=JSON.parse(fs.readFileSync(path.join(r,"hosting-manifest.json")));m.files[0].bytes=6*1024*1024;fs.writeFileSync(path.join(r,"hosting-manifest.json"),JSON.stringify(m)); },
  (r) => { const p=path.join(r,"hosting","scripts","x.js");fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,"x"); },
  (r) => { fs.writeFileSync(path.join(r,"hosting","index.html"),"person@example.com"); },
  (r) => { fs.rmSync(path.join(r,"hosting","terms.html")); const m=JSON.parse(fs.readFileSync(path.join(r,"hosting-manifest.json")));m.files=m.files.filter(x=>x.path!=="terms.html");fs.writeFileSync(path.join(r,"hosting-manifest.json"),JSON.stringify(m)); },
]) assert.throws(() => { const r=fixture(); mutate(r); verifyArtifact(r); });
console.log("Trusted artifact verifier negative fixtures passed");
