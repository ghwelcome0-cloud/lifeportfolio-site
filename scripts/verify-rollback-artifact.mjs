#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";

const root=process.argv[2]||"rollback";
const provenance=JSON.parse(fs.readFileSync(`${root}/hosting-provenance.json`,"utf8"));
const manifestBytes=fs.readFileSync(`${root}/hosting-manifest.json`);
const actual=crypto.createHash("sha256").update(manifestBytes).digest("hex");
assert.match(process.env.EXPECTED_MANIFEST_SHA256||"",/^[0-9a-f]{64}$/);
assert.equal(actual,process.env.EXPECTED_MANIFEST_SHA256,"rollback manifest input mismatch");
assert.equal(provenance.manifest_sha256,actual,"rollback provenance/manifest mismatch");
assert.equal(String(provenance.run_id),String(process.env.SOURCE_RUN_ID),"rollback provenance run mismatch");
assert.equal(provenance.repository,process.env.GITHUB_REPOSITORY,"rollback provenance repository mismatch");
console.log(JSON.stringify({source_run_id:Number(process.env.SOURCE_RUN_ID),manifest_sha256:actual,head_sha:provenance.head_sha,base_sha:provenance.base_sha}));
