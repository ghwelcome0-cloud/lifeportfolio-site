#!/usr/bin/env node
import assert from "node:assert/strict";import crypto from "node:crypto";import fs from "node:fs";import os from "node:os";import path from "node:path";import {verifyComposedSource} from "./composed-source-lib.mjs";
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"composed-")),p=path.join(dir,"manifest.json"),write=x=>fs.writeFileSync(p,JSON.stringify(x));write({schema:1,files:[{path:"a"},{path:"b"}]});const bytes=fs.readFileSync(p),good={head_sha:"0".repeat(40),expected_file_count:2,manifest_sha256:crypto.createHash("sha256").update(bytes).digest("hex")};
assert.equal(verifyComposedSource(p,good).file_count,2);
assert.throws(()=>verifyComposedSource(p,{...good,expected_file_count:3}));
assert.throws(()=>verifyComposedSource(p,{...good,manifest_sha256:"f".repeat(64)}));
fs.appendFileSync(p," ");assert.throws(()=>verifyComposedSource(p,good));
console.log("Composed source pass/count/SHA/byte mutation tests passed");
