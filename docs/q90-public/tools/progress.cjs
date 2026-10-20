'use strict';
// Usage: node progress.cjs [--md]  — 공개 비교표 v2 트랙 진행률을 같은 기준으로 계산한다(대표 보고용).
// 기준(결박): 각 단계는 "표에 올릴 수 있는 상태"가 된 행/칸만 센다. 추정치 없음.
const fs = require('fs'), path = require('path');
const B = path.resolve(__dirname, '..');
const J = f => JSON.parse(fs.readFileSync(path.join(B, f), 'utf8'));
const roster = J('roster/roster-v2.json'), e3 = J('sheets/e3-docs.json'), e2 = J('sheets/e2-samples.json');
const rows = roster.rows.filter(r => !r.retired), nonOwn = rows.filter(r => !r.own);
// E3: 표에 올리는 핵심 7칸(가격구간·가격투명성·소요·문서URL·매력·한계·한국어) 중 source_url 있는 값의 수
const E3_KEYS = ['price_band', 'price_transparency', 'time_min', 'docs_url', 'appeal', 'limits', 'korean_support'];
// 명부에서 이관된 값(note '재확인 필요')은 아직 확인 안 된 값이므로 세지 않는다
// 결함 수정(2026-10-14, KB T21): note는 이력을 덧붙이는 칸이라, 공식 출처로 정정된 값에도 옛 '재확인 필요' 문구가 남아
// 확인된 값이 미집계됐다(G03 korean_support · K16 time_min). 문장 대신 기계 필드로 판정한다(Peer 6284661 · Method 6284654 · TL 6284653 조건):
//  verifiedOk = verified_at·verified_url·verified_quote·verified_http(2xx)가 모두 있고, verified_url 도메인 = 명부 공식 URL 도메인
//  latestDoubt = note 안 '재확인 필요'가 붙은 구간의 날짜(YYYY-MM-DD) 중 가장 늦은 것(날짜 없으면 null)
//  → verifiedOk 이고 (latestDoubt 없음 또는 latestDoubt <= verified_at 날짜)면 집계 = "더 늦은 기록이 이김".
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return null; } };
const rosterHost = Object.fromEntries(roster.rows.map(r => [r.id, host(r.url)]));
const latestDoubt = v => { let d = null; for (const seg of String(v.note || '').split(' | ')) if (/재확인 필요/.test(seg)) { const m = seg.match(/\d{4}-\d{2}-\d{2}/g); if (m) for (const x of m) if (!d || x > d) d = x; } return d; };
const verifiedOk = (v, id) => v.verified_at && v.verified_url && v.verified_quote && /^2\d\d$/.test(String(v.verified_http || '')) && host(v.verified_url) === rosterHost[id] && (() => { const d = latestDoubt(v); return !d || d <= String(v.verified_at).slice(0, 10); })();
// TL 6983344(차단급): verified_url이 있는 칸은 verifiedOk만으로 판정(예외 없음). 옛 문구 기준은 verified_url 없는 칸에만.
const filled = (v, id) => v && typeof v === 'object' && v.source_url && v.value !== null && v.value !== undefined && v.value !== '' && (v.verified_url ? verifiedOk(v, id) : !/재확인 필요/.test(v.note || ''));
// E3 '해당 없음' 칸(value null + note '해당 없음' + 근거 URL)은 분모에서 뺀다(E3 rule 3차-b). 두 분모 병기.
const na = v => v && typeof v === 'object' && v.value == null && v.source_url && /^해당 없음/.test(v.note || '');
// op:q90-auto-207 A(대표 결정 ①): 종결 = 시도 3회 이상 + 시도별 증거(closure.attempts). 해당 없음처럼 분모에서 빼고, 실측 수와 종결 수를 함께 적는다.
// op:208 보완(Method 6978346 · Peer 6978351): 3회 = ⓐⓑⓒ 서로 다른 방법 각 1회 이상(attempt.method a/b/c, 'a+'=다른 공식 경로는 a로 셈). 같은 URL 반복('dup')은 세지 않음.
// TL 6983344 · Method 6983277: 시도마다 method∈{a,b,c} + 증거(http 코드 또는 오류/검색 기록) 필수, 서로 다른 method 3개. '대안 경로 확인'(E2-alt 판단)·분류 메모는 시도로 세지 않음(method 없음).
const attOk = a => ['a', 'a+', 'b', 'c'].includes(a.method) && (a.http != null || a.error || /^google:/.test(a.url || '') || /^google:/.test(a.found || ''));
const methodsOk = c => { const ok = (c.attempts || []).filter(attOk); const m = new Set(ok.map(a => a.method === 'a+' ? 'a' : a.method)); return ['a', 'b', 'c'].every(x => m.has(x)); };
const closed = v => !!(v && typeof v === 'object' && v.value == null && v.closure && v.closure.state === '종결' && Array.isArray(v.closure.attempts) && methodsOk(v.closure));
let e3cells = 0, e3rowsTouched = 0, e3rowsComplete = 0, e3na = 0, e3closed = 0;
for (const r of e3.rows) { const n = E3_KEYS.filter(k => filled(r[k], r.id)).length, m = E3_KEYS.filter(k => na(r[k])).length, z = E3_KEYS.filter(k => closed(r[k])).length; e3cells += n; e3na += m; e3closed += z; if (n > 0) e3rowsTouched++; if (n + m + z === E3_KEYS.length) e3rowsComplete++; }
// E2: 샘플 확보(ready 이상) / 채점 완료(final)
// op:q90-auto-210: 자사 E2 트랙(kind=own)·앵커(kind=anchor) 행은 비교 분모 밖 — 비교 행만 센다
const e2all = e2.rows; e2.rows = e2all.filter(r => !r.kind);
const ownE2 = e2all.filter(r => r.kind === 'own'), ancE2 = e2all.filter(r => r.kind === 'anchor');
const isFinal = r => ['final', 'judged', 'resolved'].includes(r.status);
const st = s => e2.rows.filter(r => r.status === s).length;
// 결함 수정(2026-10-12): 'redacted_pending_visual'(자동 가림 완료, 사람 눈 확인 대기)이 빠져 9건이 0으로 집계됐었다 → 포함
const e2ready = e2.rows.filter(r => ['ready', 'redacted_pending_visual', 'redacted', 'judged', 'resolved', 'final'].includes(r.status)).length;
// 분모 정정(G21 §21 결박): '해당 없음'(제품 구조상 개인 리포트 없음, 공식 근거)만 분모에서 뺀다. 두 분모를 함께 공개하고 정정 효과를 따로 적는다.
const e2na = e2.rows.filter(r => r.status === 'not_applicable').length;
const e2closedRows = e2.rows.filter(r => ['no_sample', 'ineligible'].includes(r.status) && r.closure && r.closure.state === '종결' && Array.isArray(r.closure.attempts) && methodsOk(r.closure)).map(r => r.id);
const e2target = nonOwn.length - e2na - e2closedRows.length;
const e2final = st('final') + st('judged') + st('resolved'), e2inel = st('ineligible'), e2pend = st('redacted_pending_visual'), e2red = st('redacted');
// E1: 최신 run에서 a61 또는 a71이 있는 비자사 행
const runs = fs.readdirSync(path.join(B, 'runs')).filter(d => /^\d{4}-\d{2}-\d{2}-r\d+$/.test(d)).sort();
// G21 §24-b: runs/latest(조립본)가 있으면 그것을 공개 E1로 쓴다. 비고에 입력 run 구성을 적는다.
const asmPath = path.join(B, 'runs', 'latest', 'assembly.json');
const asm = fs.existsSync(asmPath) ? J('runs/latest/assembly.json') : null;
const latest = asm ? 'latest' : runs[runs.length - 1];
const scored = latest && fs.existsSync(path.join(B, 'runs', latest, 'e1-scored.json')) ? J(`runs/${latest}/e1-scored.json`) : [];
// 실패 분류 집계(assembly.provenance.failure 마지막 항목 기준) — 손으로 적은 숫자 금지(T12: 404 2행이 r5 뒤에도 '대상 없음 2'로 남을 뻔함)
const failSummary = a => { if (!a) return ''; const c = {}; for (const p of a.provenance) { if (p.ok) continue; const f = (p.failures || []).slice(-1)[0] || {}; const k = f.status === 404 || f.status === 410 ? '대상 없음(404)' : f.status === 403 || f.status === 451 ? '접근 차단(403)' : /timeout|TIMED_OUT/i.test(f.error || '') ? '시간 초과(국내 접속에서도)' : '기타'; c[k] = (c[k] || 0) + 1; } return Object.entries(c).map(([k, v]) => `${k} ${v}`).join(' · '); };
const e1n = asm ? asm.measured : scored.filter(v => !v.own && (v.a61 || v.a71)).length;
// §24-c: 조립본이면 '전체(A6+A7 2xx)'와 '부분' 을 나눠 센다(TL 6118208)
const e1full = asm ? asm.measured_full : e1n, e1partial = asm ? asm.measured_partial : [];
// op:207 A: E1 종결 = tools/closures-e1.cjs 출력(결박 측정기 run 3회 이상 실패) — 손 집계 금지
const e1cPath = path.join(B, 'sheets', 'e1-closures.json');
const e1closed = fs.existsSync(e1cPath) ? J('sheets/e1-closures.json').rows.filter(r => r.closed && r.fails_n >= 3).map(r => r.row) : [];
// 자사 행: own.json 존재 여부
const own = fs.existsSync(path.join(B, 'table', 'own.json'));
const pct = (a, b) => b ? Math.round(100 * a / b) : 0;
const out = {
  at: new Date().toISOString().slice(0, 16) + 'Z', roster_rows: rows.length, compare_rows: nonOwn.length, latest_run: latest || null,
  steps: [
    { step: 'E1 실측(최신 run, 비자사 행)', done: e1n, total: nonOwn.length - e1closed.length, pct: pct(e1n, nonOwn.length - e1closed.length), note: (e1closed.length ? `실측 ${e1n} · 종결 ${e1closed.length}(${e1closed.join('·')}, op:207 A) / 명부 ${nonOwn.length} · ` : '') + (asm ? `조립본(runs/latest) = ${asm.inputs.map(i => `${i.run}·${i.egress_country}(${i.rows}행)`).join(' + ')} · **${e1n}/${nonOwn.length}(전체 ${e1full} + 부분 ${e1partial.length}: ${e1partial.join(', ')})** · 2xx 규칙(§24-c) 적용 — 비-2xx 축은 측정 무효 · 미측정 ${nonOwn.length - e1n}행 = ${failSummary(asm)} · 옛 기준(헤더 ok면 성공) 34 → 2xx 기준 ${e1n}${asm.url_corrected_rows ? ` · 그중 ${asm.url_corrected_rows.rows.join('·')}은 명부 URL 404 → 결과 뒤 현행 주소로 교정해 다시 잼(G21 §28, TL·Peer 예)` : ''}` : (latest ? `${latest}` : '')) },
    { step: 'E3 공개 문서 — 핵심 7칸 채움', done: e3cells, total: rows.length * E3_KEYS.length - e3na - e3closed, pct: pct(e3cells, rows.length * E3_KEYS.length - e3na - e3closed), note: `채움 ${e3cells} · 종결 ${e3closed}(op:207 A) · `+`행 기준 착수 ${e3rowsTouched}/${rows.length}, 7칸 완결(해당 없음 포함) ${e3rowsComplete} · 해당 없음 ${e3na}칸 제외(옛 분모 ${rows.length * E3_KEYS.length} 기준 ${pct(e3cells, rows.length * E3_KEYS.length)}%)` },
    { step: 'E2 공개 샘플 확보(적합 판정 포함)', done: e2ready, total: e2target, pct: pct(e2ready, e2target), note: `측정 ${e2ready} / 대상 ${e2target}(해당 없음 ${e2na} · 종결 ${e2closedRows.length} 제외${e2closedRows.length ? ': ' + e2closedRows.join('·') : ''}) / 명부 ${nonOwn.length} · 옛 분모 기준 ${pct(e2ready, nonOwn.length)}% → 분모 정정 효과 +${pct(e2ready, e2target) - pct(e2ready, nonOwn.length)}%p · ` + `가림 완료·눈 확인 대기 ${e2pend}, 눈 확인 끝 ${e2red}, 부적합 판정 ${e2inel}(빈 양식·미리보기 등), 미확보 ${st('no_sample')}` },
    { step: 'E2 블라인드 채점 완료', done: e2final, total: e2ready, pct: pct(e2final, e2ready), note: `judged(원본 저장·미집계) ${st('judged')}, final ${st('final')} — judge 2인 + 제3자` },
    { step: '자사 E2 블라인드 채점(op:210, 최신판 2부)', done: ownE2.filter(isFinal).length, total: ownE2.length || 1, pct: pct(ownE2.filter(isFinal).length, ownE2.length || 1), note: `자사 ${ownE2.map(r => r.id + '=' + r.status).join(', ')} · 앵커(검증용, 분모 밖) ${ancE2.map(r => r.id + '=' + r.status).join(', ')} · Q90 2회차 전사 열은 별도 유지(${own ? 'own.json 있음, G14 미달성' : 'own.json 없음'})` }
  ]
};
// 전체 진행률(두괄식 보고용): 단계별 % 를 가중 평균. 가중치는 표에서 차지하는 비중(결박): E1 25 · E3 25 · E2 확보 15 · E2 채점 25 · 자사 10
const W = [25, 25, 15, 25, 10];
out.overall_pct = Math.round(out.steps.reduce((a, s, i) => a + s.pct * W[i], 0) / W.reduce((a, b) => a + b, 0));
out.overall_weights = W;
// Method 6978346 · Peer 6978351(차단급, §21 ab24af6과 충돌): 종결을 분모에서 빼는 위 숫자는 **작업 완료율**(더 할 일이 없는 정도)일 뿐이다.
// 비교표의 정보량은 **측정 커버리지** = 종결을 분모에 남긴 값(§21 그대로). 공개 대표 숫자는 커버리지, 완료율은 병기.
const cov = [
  { step: 'E1 커버리지', done: e1n, total: nonOwn.length },
  { step: 'E3 커버리지', done: e3cells, total: rows.length * E3_KEYS.length - e3na },
  { step: 'E2 확보 커버리지', done: e2ready, total: nonOwn.length - e2na },
  { step: 'E2 채점', done: e2final, total: e2ready },
  { step: '자사 E2', done: ownE2.filter(isFinal).length, total: ownE2.length || 1 }
].map(c => ({ ...c, pct: pct(c.done, c.total) }));
out.coverage = { steps: cov, overall_pct: Math.round(cov.reduce((a, c, i) => a + c.pct * W[i], 0) / W.reduce((a, b) => a + b, 0)), note: '종결은 분모에 남김(§21). E1 종결 ' + e1closed.length + ' · E3 종결 ' + e3closed + ' · E2 종결 ' + e2closedRows.length };
out.completion_pct = out.overall_pct;
if (process.argv.includes('--md')) {
  console.log(`**측정 커버리지 ${out.coverage.overall_pct}%**(공개 대표 숫자, 종결은 분모에 남김 §21) · **작업 완료율 ${out.overall_pct}%**(종결=처리 끝, op:207) (가중: E1 25 · E3 25 · E2확보 15 · E2채점 25 · 자사 10)\n`);
  console.log(`| 단계 | 완료/전체 | % | 비고 |\n|---|---|---|---|`);
  for (const s of out.steps) console.log(`| ${s.step} | ${s.done}/${s.total} | ${s.pct}% | ${s.note} |`);
  console.log(`\n(${out.at} · 명부 ${out.roster_rows}행 · 최신 run ${out.latest_run})`);
} else console.log(JSON.stringify(out, null, 1));
