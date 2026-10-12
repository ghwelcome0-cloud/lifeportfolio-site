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
// §24-c(TL 6106475·Peer 6106517, 결과 열람 뒤 적용 사실 기록): 최종 응답 2xx일 때만 '성공'. A6는 mobile.status 2xx, A7은 headers.status 2xx.
const is2xx = s => typeof s === 'number' && s >= 200 && s < 300;
const a6ok = r => r.mobile && r.mobile.ok && is2xx(r.mobile.status);
const a7ok = r => r.headers && r.headers.ok && is2xx(r.headers.status);
const okRow = r => r && !r.skip && (a6ok(r) || a7ok(r));
const fullRow = r => r && !r.skip && a6ok(r) && a7ok(r);
const statusOf = r => (r.mobile && r.mobile.status) || (r.headers && r.headers.status) || null;
const byRow = {};
// §24-b(Peer 6105340·TL 6105372): 표 = 앞선 run에서 성공한 행은 그 값 유지, 앞선 run에서 실패한 행만 뒤 run 값. 뒤 run의 나머지 값은 §25 비교용(compare_only).
for (const run of runs) for (const r of run.results) {
  const prev = byRow[r.row];
  if (r.skip) { if (!prev) byRow[r.row] = { res: r, run, reason: 'own' }; continue; }
  if (prev && prev.ok) { prev.compare_only_runs = [...(prev.compare_only_runs || []), run.tag]; continue; } // 이미 성공한 행: 값 유지(겹침 포함, 40행 측정도 동일)
  if (okRow(r)) byRow[r.row] = { res: r, run, ok: true, previously_failed_in: prev && !prev.ok ? prev.run.tag : (prev && prev.previously_failed_in) };
  else if (!prev || !prev.ok) byRow[r.row] = { res: r, run, ok: false, failures: [...((prev && prev.failures) || []), { run: run.tag, egress: run.egress, status: statusOf(r), error: (r.mobile && r.mobile.error) || (r.headers && r.headers.error) || (statusOf(r) ? `HTTP ${statusOf(r)}` : 'unknown') }] };
}
const classify = (e, st) => (st === 404 || st === 410) ? '대상 없음' : (st === 403 || st === 451) ? '접근 차단' : !e ? (st ? `기타 오류(HTTP ${st})` : null) : /timed?[ _]?out|Navigation timeout|fetch failed/i.test(e) ? '시간 초과' : /403|451|captcha|forbidden|blocked/i.test(e) ? '접근 차단' : '기타 오류';
fs.mkdirSync(OUT, { recursive: true });
const results = [], scored = [], provenance = [];
for (const [row, x] of Object.entries(byRow)) {
  const sc = x.run.scored.find(s => s.row === row) || { row };
  const tagStr = `${x.run.tag}·${x.run.egress}`;
  results.push({ ...x.res, assembled_from: tagStr });
  const note = x.previously_failed_in ? `해외 접속 시 시간 초과(${x.previously_failed_in})` : null;
  const lastF = x.failures && x.failures[x.failures.length - 1];
  const partial = x.ok && !fullRow(x.res) ? (a6ok(x.res) ? 'A6만' : 'A7만') : null;
  const partialWhy = partial === 'A7만' ? ((x.res.mobile && x.res.mobile.status && !is2xx(x.res.mobile.status)) ? `측정 무효(HTTP ${x.res.mobile.status})` : '검사 경로 시간 초과') : null;
  // 2xx가 아닌 축의 점수는 조립본에서 비운다(측정 무효) — 원본 run 파일은 그대로
  const scClean = { ...sc };
  if (!x.ok) { for (const k of ['a61','a63','a64','a6partial','a71','a76','a75probe','a7grade']) delete scClean[k]; const st = lastF && lastF.status; scClean.a6err = scClean.a6err || (st ? `측정 무효(HTTP ${st})` : (lastF && lastF.error)); scClean.a7err = st ? `측정 무효(HTTP ${st})` : (lastF && lastF.error); }
  if (x.ok && !a6ok(x.res)) { delete scClean.a61; delete scClean.a63; delete scClean.a64; delete scClean.a6partial; scClean.a6err = scClean.a6err || `측정 무효(HTTP ${x.res.mobile && x.res.mobile.status})`; } if (x.ok && !a7ok(x.res)) { delete scClean.a71; delete scClean.a76; delete scClean.a75probe; delete scClean.a7grade; scClean.a7err = `측정 무효(HTTP ${x.res.headers && x.res.headers.status})`; }
  scored.push({ ...scClean, run_tag: tagStr, partial, partial_why: partialWhy, prior_failure_note: note, failure_class: x.ok ? null : classify(lastF && lastF.error, lastF && lastF.status), failures: x.failures || undefined });
  provenance.push({ row, from: tagStr, ok: !!x.ok, full: x.ok ? fullRow(x.res) : false, partial, prior_failure_note: note, compare_only_runs: x.compare_only_runs || null, failures: x.failures || null });
}
const order = runs[runs.length - 1].results.map(r => r.row); // 명부 순서는 마지막 run 기준이 아니라 전체 합집합 — 첫 run(전체 40행) 순서 사용
const first = runs[0].results.map(r => r.row);
const idx = r => { const i = first.indexOf(r); return i < 0 ? 1000 + order.indexOf(r) : i; };
results.sort((a, b) => idx(a.row) - idx(b.row)); scored.sort((a, b) => idx(a.row) - idx(b.row)); provenance.sort((a, b) => idx(a.row) - idx(b.row));
const header = { assembled: true, rule: 'G21 §24-b — 앞선 run 성공 행은 그 값 유지, 앞선 run 실패 행만 뒤 run 값; 뒤 run의 그 밖 값은 §25 비교용', bound_commit: '9557e46 + §24-b', inputs: runs.map(r => ({ run: r.tag, dir: path.basename(r.dir), egress_country: r.egress, tool_sha256: r.tool_sha256, startedAt: r.startedAt, rows: r.results.length, bridge_rows: [...r.bridge] })), tool_sha256: toolShas[0], generatedAt: new Date().toISOString() };
fs.writeFileSync(path.join(OUT, 'e1-results.json'), JSON.stringify({ tool: 'assemble-latest.cjs', ...header, roster_version: runs[0].results.length && JSON.parse(fs.readFileSync(path.join(runs[0].dir, 'e1-results.json'), 'utf8')).roster_version, evidence: 'E1', startedAt: runs[0].startedAt, results }, null, 1));
fs.writeFileSync(path.join(OUT, 'e1-scored.json'), JSON.stringify(scored, null, 1));
fs.writeFileSync(path.join(OUT, 'assembly.json'), JSON.stringify({ ...header, measured: provenance.filter(p => p.ok).length, measured_full: provenance.filter(p => p.full).length, measured_partial: provenance.filter(p => p.ok && !p.full).map(p => `${p.row}(${p.partial})`), rule_2xx: '최종 응답 2xx만 성공(§24-c, TL 6106475·Peer 6106517). 비-2xx 축은 측정 무효로 비움', total_non_own: provenance.filter(p => p.from && !/own/.test(p.from) && byRow[p.row].reason !== 'own').length, provenance }, null, 1));
console.log('assembled', provenance.length, 'rows; measured', provenance.filter(p => p.ok).length, '(full', provenance.filter(p => p.full).length, ')', '; inputs', runs.map(r => r.tag + '·' + r.egress).join(','));
