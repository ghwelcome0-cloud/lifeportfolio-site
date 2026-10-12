'use strict';
// Usage: node diff-runs.cjs <runDirA> <runDirB>  — 회차 간 E1 레벨 변화만 출력(축적 가능성: 시계열 비교)
const fs = require('fs'), path = require('path');
const [A, B] = process.argv.slice(2);
const load = d => Object.fromEntries(JSON.parse(fs.readFileSync(path.join(d, 'e1-scored.json'), 'utf8')).map(r => [r.row, r]));
const a = load(A), b = load(B); const ch = [];
for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
  if (!a[k]) { ch.push(`${k}: 신규(B에만)`); continue; } if (!b[k]) { ch.push(`${k}: 제외(A에만)`); continue; }
  for (const f of ['a61', 'a63', 'a64', 'a71', 'a76']) { const la = a[k][f] && a[k][f].level, lb = b[k][f] && b[k][f].level; if (la !== lb) ch.push(`${k} ${f}: L${la ?? '—'} → L${lb ?? '—'}`); }
  const pa = a[k].a6partial && a[k].a6partial.points, pb = b[k].a6partial && b[k].a6partial.points; if (pa !== pb) ch.push(`${k} A6부분합: ${pa ?? '—'} → ${pb ?? '—'}`);
  if (a[k].a7grade !== b[k].a7grade) ch.push(`${k} A7등급: ${a[k].a7grade ?? '—'} → ${b[k].a7grade ?? '—'}`);
}
console.log(JSON.stringify({ a: path.basename(A), b: path.basename(B), changes: ch.length, list: ch }, null, 1));
