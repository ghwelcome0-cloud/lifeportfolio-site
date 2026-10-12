'use strict';
// Usage: node diff-runs.cjs <runDirA> <runDirB>  — 회차 간 E1 변화: ① 레벨/등급 변화 ② 원시값 변화(Peer 6037125 ②) ③ 바이트 hash 변화(있을 때)
// 축적 가능성: 시계열 비교. "변화 0"은 레벨·원시값·hash 세 층 모두에서 0일 때만 말한다.
const fs = require('fs'), path = require('path');
const [A, B] = process.argv.slice(2);
const load = (d, f) => Object.fromEntries(JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')).map(r => [r.row, r]));
const loadRaw = d => Object.fromEntries(JSON.parse(fs.readFileSync(path.join(d, 'e1-results.json'), 'utf8')).results.map(r => [r.row, r]));
const a = load(A, 'e1-scored.json'), b = load(B, 'e1-scored.json'), ra = loadRaw(A), rb = loadRaw(B);
const lvl = [], raw = [], hash = [];
const RAW_FIELDS = [['mobile.status'], ['mobile.viewportMeta'], ['mobile.zoomBlocked'], ['mobile.docW'], ['mobile.innerW'], ['mobile.overflow'], ['mobile.text.blocks'], ['mobile.text.ge16'], ['mobile.text.lt12'], ['mobile.touch.total'], ['mobile.touch.ok44'], ['mobile.touch.ok24'], ['headers.status'], ['headers.https'], ['headers.hsts'], ['headers.xcto'], ['headers.frame'], ['headers.referrer'], ['headers.permissions'], ['headers.csp'], ['headers.cspReporting']];
const get = (o, p) => p.split('.').reduce((x, k) => x == null ? undefined : x[k], o);
for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
  if (!a[k]) { lvl.push(`${k}: 신규(B에만)`); continue; } if (!b[k]) { lvl.push(`${k}: 제외(A에만)`); continue; }
  for (const f of ['a61', 'a63', 'a64', 'a71', 'a76']) { const la = a[k][f] && a[k][f].level, lb = b[k][f] && b[k][f].level; if (la !== lb) lvl.push(`${k} ${f}: L${la ?? '—'} → L${lb ?? '—'}`); }
  const pa = a[k].a6partial && a[k].a6partial.points, pb = b[k].a6partial && b[k].a6partial.points; if (pa !== pb) lvl.push(`${k} A6부분합: ${pa ?? '—'} → ${pb ?? '—'}`);
  if (a[k].a7grade !== b[k].a7grade) lvl.push(`${k} A7등급: ${a[k].a7grade ?? '—'} → ${b[k].a7grade ?? '—'}`);
  const ea = (ra[k].publicSurface || []).filter(p => p.exposed).length, eb = (rb[k].publicSurface || []).filter(p => p.exposed).length; if (ea !== eb) lvl.push(`${k} probe exposed: ${ea} → ${eb}`);
  const ch = [];
  for (const [p] of RAW_FIELDS) { const va = get(ra[k], p), vb = get(rb[k], p); if (JSON.stringify(va) !== JSON.stringify(vb)) ch.push(`${p} ${JSON.stringify(va)}→${JSON.stringify(vb)}`); }
  if (ch.length) raw.push({ row: k, changes: ch, carried: rb[k].carried_from_round1 || ra[k].carried_from_round1 || null });
  const ha = get(ra[k], 'headers.bodySha256'), hb = get(rb[k], 'headers.bodySha256');
  hash.push({ row: k, body: ha && hb ? (ha === hb ? 'same' : 'changed') : 'n/a(hash 없음)', dom: get(ra[k], 'mobile.domSha256') && get(rb[k], 'mobile.domSha256') ? (get(ra[k], 'mobile.domSha256') === get(rb[k], 'mobile.domSha256') ? 'same' : 'changed') : 'n/a(hash 없음)' });
}
const hashable = hash.filter(h => h.body !== 'n/a(hash 없음)').length;
const out = { a: path.basename(A), b: path.basename(B), level_changes: lvl.length, level_list: lvl, raw_changes: raw.length, raw_list: raw, byte_hash_comparable_rows: hashable, byte_hash_changed: hash.filter(h => h.body === 'changed' || h.dom === 'changed').map(h => h.row), note: hashable === 0 ? '두 run 중 하나에 바이트 hash가 없어 "사이트 개편 vs 측정 흔들림"을 가를 수 없음' : undefined };
console.log(JSON.stringify(out, null, 1));
