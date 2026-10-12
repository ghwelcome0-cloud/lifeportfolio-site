'use strict';
// Usage: node assemble-latest.cjs <outDir> <runDir1> <runDir2> ...   (G21 §24 결박 9557e46)
// 행마다 "그 행을 성공적으로 측정한 가장 최근 run"의 값을 쓴다. 성공 = mobile.ok && status<400 (A6) 또는 headers.ok (A7).
// 겹침(bridge) 행은 run-meta.json.bridge_rows에 적힌 행 — 앞선 run 값을 유지하고 차이는 diff에만 남긴다.
// 출력: <outDir>/e1-results.json, e1-scored.json(각 행에 run·egress 태그), assembly.json(머리말: 입력 run·도구 sha·행별 출처)
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const [OUT, ...RUNS] = process.argv.slice(2);
if (!OUT || RUNS.length < 1) { console.error('usage: node assemble-latest.cjs <outDir> <runDir...>'); process.exit(2); }
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const runs = RUNS.map(d => {
  const res = JSON.parse(fs.readFileSync(path.join(d, 'e1-results.json'), 'utf8'));
  const scored = fs.existsSync(path.join(d, 'e1-scored.json')) ? JSON.parse(fs.readFileSync(path.join(d, 'e1-scored.json'), 'utf8')) : null;
  const meta = fs.existsSync(path.join(d, 'run-meta.json')) ? JSON.parse(fs.readFileSync(path.join(d, 'run-meta.json'), 'utf8')) : {};
  const tag = path.basename(d).replace(/^.*-(r\d+)$/, '$1');
  return { dir: d, tag, egress: meta.egress_country || (res.limitation_r3 ? 'US' : meta.egress_country) || '??', tool_sha256: res.tool_sha256, startedAt: res.startedAt, results: res.results, scored, bridge: new Set(meta.bridge_rows || []) };
}).sort((a, b) => String(a.startedAt).localeCompare(String(b.startedAt)));
if (!runs.every(r => r.scored)) { console.error('모든 run에 e1-scored.json 필요(먼저 score-e1.cjs 실행)'); process.exit(3); }
const toolShas = [...new Set(runs.map(r => r.tool_sha256))];
if (toolShas.length !== 1) { console.error('도구 sha 불일치 — 조립 중단(§24):', toolShas); process.exit(4); }
const okRow = r => r && !r.skip && ((r.mobile && r.mobile.ok && r.mobile.status < 400) || (r.headers && r.headers.ok));
const byRow = {};
for (const run of runs) for (const r of run.results) {
  const prev = byRow[r.row];
  if (r.skip) { if (!prev) byRow[r.row] = { res: r, run, reason: 'own' }; continue; }
  if (run.bridge.has(r.row) && prev && prev.ok) { prev.bridge_diff_with = run.tag; continue; } // 겹침 행: 앞선 값 유지
  if (okRow(r)) byRow[r.row] = { res: r, run, ok: true, previously_failed_in: prev && !prev.ok ? prev.run.tag : (prev && prev.previously_failed_in) };
  else if (!prev || !prev.ok) byRow[r.row] = { res: r, run, ok: false, failures: [...((prev && prev.failures) || []), { run: run.tag, egress: run.egress, error: (r.mobile && r.mobile.error) || (r.headers && r.headers.error) || 'unknown' }] };
}
const classify = e => !e ? null : /timed?[ _]?out|Navigation timeout|fetch failed/i.test(e) ? '시간 초과' : /403|451|captcha|forbidden|blocked/i.test(e) ? '접근 차단' : '기타 오류';
fs.mkdirSync(OUT, { recursive: true });
const results = [], scored = [], provenance = [];
for (const [row, x] of Object.entries(byRow)) {
  const sc = x.run.scored.find(s => s.row === row) || { row };
  const tagStr = `${x.run.tag}·${x.run.egress}`;
  results.push({ ...x.res, assembled_from: tagStr });
  const note = x.previously_failed_in ? `해외 접속 시 시간 초과(${x.previously_failed_in})` : null;
  scored.push({ ...sc, run_tag: tagStr, prior_failure_note: note, failure_class: x.ok ? null : classify(x.failures && x.failures[x.failures.length - 1].error), failures: x.failures || undefined });
  provenance.push({ row, from: tagStr, ok: !!x.ok, prior_failure_note: note, bridge_diff_with: x.bridge_diff_with || null, failures: x.failures || null });
}
const order = runs[runs.length - 1].results.map(r => r.row); // 명부 순서는 마지막 run 기준이 아니라 전체 합집합 — 첫 run(전체 40행) 순서 사용
const first = runs[0].results.map(r => r.row);
const idx = r => { const i = first.indexOf(r); return i < 0 ? 1000 + order.indexOf(r) : i; };
results.sort((a, b) => idx(a.row) - idx(b.row)); scored.sort((a, b) => idx(a.row) - idx(b.row)); provenance.sort((a, b) => idx(a.row) - idx(b.row));
const header = { assembled: true, rule: 'G21 §24 — 행마다 성공적으로 측정한 가장 최근 run; 겹침 행은 앞선 값 유지', bound_commit: '9557e46', inputs: runs.map(r => ({ run: r.tag, dir: path.basename(r.dir), egress_country: r.egress, tool_sha256: r.tool_sha256, startedAt: r.startedAt, rows: r.results.length, bridge_rows: [...r.bridge] })), tool_sha256: toolShas[0], generatedAt: new Date().toISOString() };
fs.writeFileSync(path.join(OUT, 'e1-results.json'), JSON.stringify({ tool: 'assemble-latest.cjs', ...header, roster_version: runs[0].results.length && JSON.parse(fs.readFileSync(path.join(runs[0].dir, 'e1-results.json'), 'utf8')).roster_version, evidence: 'E1', startedAt: runs[0].startedAt, results }, null, 1));
fs.writeFileSync(path.join(OUT, 'e1-scored.json'), JSON.stringify(scored, null, 1));
fs.writeFileSync(path.join(OUT, 'assembly.json'), JSON.stringify({ ...header, measured: provenance.filter(p => p.ok).length, total_non_own: provenance.filter(p => p.from && !/own/.test(p.from) && byRow[p.row].reason !== 'own').length, provenance }, null, 1));
console.log('assembled', provenance.length, 'rows; measured', provenance.filter(p => p.ok).length, '; inputs', runs.map(r => r.tag + '·' + r.egress).join(','));
