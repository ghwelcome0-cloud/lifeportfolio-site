#!/usr/bin/env node
// 장부로 크레딧 1개 값(usdPerCredit) 보정: 합계 원가 ÷ 합계 크레딧. --write 면 data/calib.json 갱신
import fs from "node:fs";
import path from "node:path";
import { loadData, apiCostUSD } from "./index.js";
const dir = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const data = loadData();
const ledger = JSON.parse(fs.readFileSync(path.join(dir, "ledger/ledger.json"), "utf8"));
const rows = ledger.entries.filter((e) => e.tokens && e.actualCredits);
let usd = 0, cr = 0;
for (const e of rows) { usd += apiCostUSD(e.tokens, e.model, data.models); cr += e.actualCredits; }
const v = +(usd / cr).toFixed(6);
console.log(`장부 ${rows.length}건: 원가 $${usd.toFixed(4)} / ${cr.toFixed(1)} 크레딧 → 크레딧 1개 = $${v}`);
if (process.argv.includes("--write")) {
  data.calib.genspark = { usdPerCredit: v, from: `ledger ${rows.length}건 (${cr.toFixed(1)} 크레딧 / API 원가 $${usd.toFixed(4)})` };
  fs.writeFileSync(path.join(dir, "data/calib.json"), JSON.stringify(data.calib, null, 2) + "\n");
}
