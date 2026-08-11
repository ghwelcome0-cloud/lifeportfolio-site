#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DlpViolationError, verifyArtifact } from "./hosting-artifact-verifier-lib.mjs";

function fixture(files = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hosting-verify-"));
  const all = { "index.html":"ok", "product.html":"ok", "login.html":"ok", "privacy.html":"ok", "terms.html":"ok", ...files };
  for (const [name, body] of Object.entries(all)) { const p=path.join(root,"hosting",name); fs.mkdirSync(path.dirname(p),{recursive:true}); fs.writeFileSync(p,body); }
  refresh(root); return root;
}
function refresh(root) {
  const files=[]; function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(e.isFile()){const b=fs.readFileSync(p);files.push({path:path.relative(path.join(root,"hosting"),p).split(path.sep).join("/"),bytes:b.length,sha256:crypto.createHash("sha256").update(b).digest("hex")});}}} walk(path.join(root,"hosting"));
  files.sort((a,b)=>a.path.localeCompare(b.path)); fs.writeFileSync(path.join(root,"hosting-manifest.json"),JSON.stringify({schema:1,files}));
}
function policy(root, contacts) { const pairs=contacts.flatMap(c=>c.files.map(file=>({value:c.value,path:file})));const pairDigest=crypto.createHash("sha256").update(pairs.map(x=>JSON.stringify([x.value,x.path])).sort().join("\n")).digest("hex");const p=path.join(root,"policy.json");fs.writeFileSync(p,JSON.stringify({schema:1,policy_version:1,approval_pr:229,contact_pair_sha256:pairDigest,pairs}));return p; }
function expectDlp(files, contacts=[]) { const r=fixture(files); const p=policy(r,contacts); assert.throws(()=>verifyArtifact(r,{policyPath:p}),e=>e instanceof DlpViolationError && e.message.startsWith("DLP violation:")); }

const approved=[{value:"support@example.org",files:["index.html"]},{value:"010-1234-5678",files:["index.html"]}];
let root=fixture({"index.html":"<footer>support@example.org 010-1234-5678</footer>"});
assert.equal(verifyArtifact(root,{policyPath:policy(root,approved)}).files,5);
expectDlp({"product.html":"<footer>support@example.org</footer>"},approved);
expectDlp({"index.html":"<footer>other@example.org</footer>"},approved);
expectDlp({"index.html":"01012345678"},approved);
expectDlp({"index.html":"010-9999-8888"},approved);
expectDlp({"index.html":"+82-10-9999-8888"},approved);
expectDlp({"data.json":"support@example.org"},[...approved,{value:"support@example.org",files:["data.json"]}]);
expectDlp({"index.html":"ghwelcome0@gmail.com"},approved);
expectDlp({"index.html":"{\"answers\":{}}"},approved);
expectDlp({"index.html":"{\"access_token\":\"x\"}"},approved);
expectDlp({"index.html":"-----BEGIN PRIVATE KEY-----"},approved);
for(const html of [
  '<script>support@example.org</script>', '<style>x{content:"support@example.org"}</style>',
  '<template>support@example.org</template>', '<!-- support@example.org -->',
  '<meta content="support@example.org">', '<div hidden>support@example.org</div>',
  '<div data-x="support@example.org">x</div>', '<main>support@example.org</main>'
]) expectDlp({"index.html":html},approved);
expectDlp({"index.html":'<footer>support@example.org</footer><script>support@example.org</script>'},approved);
expectDlp({"index.html":'<footer>support@example.org</footer><div hidden>support@example.org</div>'},approved);
expectDlp({"index.html":'<footer>support@example.org</footer><!-- support@example.org -->'},approved);
expectDlp({"index.html":'<footer>support@example.org</footer><main>support@example.org</main>'},approved);
expectDlp({"index.html":'<input type="email" placeholder="person@real-domain.co.kr">'},approved);

for (const changed of [[],[{value:"support@example.org",files:["product.html"]}]]) {
  const r=fixture({"index.html":"<footer>support@example.org</footer>"}); const p=policy(r,changed);
  assert.throws(()=>verifyArtifact(r,{policyPath:p}),e=>e instanceof DlpViolationError && e.message.startsWith("DLP violation:"));
}
{
  const canonical=crypto.createHash("sha256").update(JSON.stringify({schema:1,contacts:approved})).digest("hex");
  const expanded=crypto.createHash("sha256").update(JSON.stringify({schema:1,contacts:[...approved,{value:"extra@example.org",files:["index.html"]}]})).digest("hex");
  assert.notEqual(expanded,canonical,"allowlist expansion must change the governed contract bytes");
}

for (const mutate of [
  r=>fs.writeFileSync(path.join(r,"hosting","extra.txt"),"x"),
  r=>fs.symlinkSync("index.html",path.join(r,"hosting","link.html")),
  r=>{const m=JSON.parse(fs.readFileSync(path.join(r,"hosting-manifest.json")));m.files[0].sha256="0".repeat(64);fs.writeFileSync(path.join(r,"hosting-manifest.json"),JSON.stringify(m));},
]) assert.throws(()=>{const r=fixture();mutate(r);verifyArtifact(r,{policyPath:policy(r,[])});});
console.log("Trusted artifact verifier policy and negative fixtures passed");
