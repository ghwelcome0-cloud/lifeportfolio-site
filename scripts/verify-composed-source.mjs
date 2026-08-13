#!/usr/bin/env node
import {verifyComposedSource} from "./composed-source-lib.mjs";
const policy=JSON.parse(await (await import("node:fs")).promises.readFile(process.argv[3]||"contracts/public-contact-policy.json","utf8"));
const result=verifyComposedSource(process.argv[2],policy.composed_source);
console.log(`Composed source passed: ${result.file_count} files ${result.manifest_sha256}`);
