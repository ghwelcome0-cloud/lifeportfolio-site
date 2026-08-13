#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { scanTree } from "./internal-evidence-dlp-lib.mjs";

const ROOT = path.resolve(import.meta.dirname, ".."), failures = scanTree(path.join(ROOT, "internal/evidence"));
const good = ["https://www.law.go.kr/LSW/lsInfoP.do?lsId=004135", "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=253655", "https://www.law.go.kr/LSW/precInfoP.do?evtNo=2007%EB%A7%881328"];
const bad = ["https://www.law.go.kr/x?token=secret", "https://www.law.go.kr/x?code=secret", "https://www.law.go.kr/x?foo=bar", "http://127.0.0.1/x", "eyJabcdefgh.abcdefgh.abcdefgh", "Bearer abcdefghijklmnopqrstuvwxyz012345", "010-1234-5678", "person@example.com", '"AbCdEfGhIjKlMnOpQrStUvWxYz0123456789ABCDEFGHIJKL"'];
for (const [index, value] of [...good, ...bad].entries()) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lp-evidence-dlp-")); fs.writeFileSync(path.join(dir, "fixture.txt"), value);
  const result = scanTree(dir); fs.rmSync(dir, { recursive: true, force: true });
  if ((index < good.length && result.length) || (index >= good.length && !result.length)) failures.push(`E2E fixture ${index} unexpected result`);
}
if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
console.log("Internal evidence full-tree DLP and temp-tree pass/fail fixtures passed");
