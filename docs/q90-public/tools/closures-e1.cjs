'use strict';
// Usage: node closures-e1.cjs  — op:q90-auto-207 A(종결 규칙) E1 부분: 조립본에서 미측정인 행마다, 결박 측정기(sha c276bb21…)로
// 잰 모든 run(runs/YYYY-MM-DD-rN* 폴더, 출구·날짜 무관)의 그 행 결과를 기계로 모아 시도 수를 센다. 3회 이상 실패 + 증거 → 종결.
// 손 집계 금지: 이 도구 출력(sheets/e1-closures.json)만 progress.cjs·build-table.cjs가 읽는다.
const fs = require('fs'), path = require('path');
const B = path.resolve(__dirname, '..'), TOOL = 'c276bb21ab7e1434ab18d5f84c68571aed4a68833428d768de49a7d73bbdb21b';
const asm = JSON.parse(fs.readFileSync(path.join(B, 'runs/latest/assembly.json'), 'utf8'));
const is2xx = s => typeof s === 'number' && s >= 200 && s < 300;
const runs = fs.readdirSync(path.join(B, 'runs')).filter(d => /^\d{4}-\d{2}-\d{2}-r\d+/.test(d)).sort();
const reason = f => f.status === 403 || f.status === 451 || f.status === 429 ? '접근 차단(403·봇)' : /TIMED_OUT|timeout|fetch failed/i.test(f.error || '') ? '연결 불가(시간 초과)' : f.status === 404 || f.status === 410 ? '대상 없음(404)' : '기타';
const out = { tool: 'closures-e1.cjs', rule: 'op:q90-auto-207 A-1·A-2 — 결박 측정기 run 3회 이상 실패(증거=run 폴더 결과) → 종결(사유)', measure_tool_sha256: TOOL, generatedAt: new Date().toISOString(), rows: [] };
for (const p of asm.provenance) {
  if (p.ok) continue;
  const attempts = [];
  for (const d of runs) {
    const f = path.join(B, 'runs', d, 'e1-results.json'); if (!fs.existsSync(f)) continue;
    const res = JSON.parse(fs.readFileSync(f, 'utf8')); if (res.tool_sha256 !== TOOL) continue;
    const meta = fs.existsSync(path.join(B, 'runs', d, 'run-meta.json')) ? JSON.parse(fs.readFileSync(path.join(B, 'runs', d, 'run-meta.json'), 'utf8')) : {};
    const r = (res.results || []).find(x => x.row === p.row); if (!r) continue;
    const ok = (r.mobile && r.mobile.ok && is2xx(r.mobile.status)) || (r.headers && r.headers.ok && is2xx(r.headers.status));
    attempts.push({ run: d, startedAt: res.startedAt, egress: meta.egress_country || (res.limitation_r3 ? 'US' : null), ok, status: (r.mobile && r.mobile.status) || (r.headers && r.headers.status) || null, error: (r.mobile && r.mobile.error) || (r.headers && r.headers.error) || null, title: (r.mobile && r.mobile.title) || null, dom_sha256: (r.mobile && r.mobile.domSha256) || null });
  }
  const fails = attempts.filter(a => !a.ok); const last = fails[fails.length - 1] || {};
  out.rows.push({ row: p.row, attempts_n: attempts.length, fails_n: fails.length, closed: fails.length >= 3 && fails.length === attempts.length, reason: reason(last), attempts });
}
fs.writeFileSync(path.join(B, 'sheets/e1-closures.json'), JSON.stringify(out, null, 1) + '\n');
for (const r of out.rows) console.log(r.row, r.closed ? '종결' : '미종결', r.reason, `${r.fails_n}/${r.attempts_n}`, r.attempts.map(a => a.run.replace(/^.*-(r\w+)$/, '$1') + ':' + (a.status || 'TO')).join(' '));
