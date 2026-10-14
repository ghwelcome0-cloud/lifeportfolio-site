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
const filled = (v, id) => v && typeof v === 'object' && v.source_url && v.value !== null && v.value !== undefined && v.value !== '' && (verifiedOk(v, id) || !/재확인 필요/.test(v.note || ''));
// E3 '해당 없음' 칸(value null + note '해당 없음' + 근거 URL)은 분모에서 뺀다(E3 rule 3차-b). 두 분모 병기.
const na = v => v && typeof v === 'object' && v.value == null && v.source_url && /^해당 없음/.test(v.note || '');
let e3cells = 0, e3rowsTouched = 0, e3rowsComplete = 0, e3na = 0;
for (const r of e3.rows) { const n = E3_KEYS.filter(k => filled(r[k], r.id)).length, m = E3_KEYS.filter(k => na(r[k])).length; e3cells += n; e3na += m; if (n > 0) e3rowsTouched++; if (n + m === E3_KEYS.length) e3rowsComplete++; }
// E2: 샘플 확보(ready 이상) / 채점 완료(final)
const st = s => e2.rows.filter(r => r.status === s).length;
// 결함 수정(2026-10-12): 'redacted_pending_visual'(자동 가림 완료, 사람 눈 확인 대기)이 빠져 9건이 0으로 집계됐었다 → 포함
const e2ready = e2.rows.filter(r => ['ready', 'redacted_pending_visual', 'redacted', 'judged', 'resolved', 'final'].includes(r.status)).length;
// 분모 정정(G21 §21 결박): '해당 없음'(제품 구조상 개인 리포트 없음, 공식 근거)만 분모에서 뺀다. 두 분모를 함께 공개하고 정정 효과를 따로 적는다.
const e2na = e2.rows.filter(r => r.status === 'not_applicable').length, e2target = nonOwn.length - e2na;
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
// 자사 행: own.json 존재 여부
const own = fs.existsSync(path.join(B, 'table', 'own.json'));
const pct = (a, b) => b ? Math.round(100 * a / b) : 0;
const out = {
  at: new Date().toISOString().slice(0, 16) + 'Z', roster_rows: rows.length, compare_rows: nonOwn.length, latest_run: latest || null,
  steps: [
    { step: 'E1 실측(최신 run, 비자사 행)', done: e1n, total: nonOwn.length, pct: pct(e1n, nonOwn.length), note: asm ? `조립본(runs/latest) = ${asm.inputs.map(i => `${i.run}·${i.egress_country}(${i.rows}행)`).join(' + ')} · **${e1n}/${nonOwn.length}(전체 ${e1full} + 부분 ${e1partial.length}: ${e1partial.join(', ')})** · 2xx 규칙(§24-c) 적용 — 비-2xx 축은 측정 무효 · 미측정 ${nonOwn.length - e1n}행 = ${failSummary(asm)} · 옛 기준(헤더 ok면 성공) 34 → 2xx 기준 ${e1n}${asm.url_corrected_rows ? ` · 그중 ${asm.url_corrected_rows.rows.join('·')}은 명부 URL 404 → 결과 뒤 현행 주소로 교정해 다시 잼(G21 §28, TL·Peer 예)` : ''}` : (latest ? `${latest}` : '') },
    { step: 'E3 공개 문서 — 핵심 7칸 채움', done: e3cells, total: rows.length * E3_KEYS.length - e3na, pct: pct(e3cells, rows.length * E3_KEYS.length - e3na), note: `행 기준 착수 ${e3rowsTouched}/${rows.length}, 7칸 완결(해당 없음 포함) ${e3rowsComplete} · 해당 없음 ${e3na}칸 제외(옛 분모 ${rows.length * E3_KEYS.length} 기준 ${pct(e3cells, rows.length * E3_KEYS.length)}%)` },
    { step: 'E2 공개 샘플 확보(적합 판정 포함)', done: e2ready, total: e2target, pct: pct(e2ready, e2target), note: `측정 ${e2ready} / 대상 ${e2target}(해당 없음 ${e2na} 제외) / 명부 ${nonOwn.length} · 옛 분모 기준 ${pct(e2ready, nonOwn.length)}% → 분모 정정 효과 +${pct(e2ready, e2target) - pct(e2ready, nonOwn.length)}%p · ` + `가림 완료·눈 확인 대기 ${e2pend}, 눈 확인 끝 ${e2red}, 부적합 판정 ${e2inel}(빈 양식·미리보기 등), 미확보 ${st('no_sample')}` },
    { step: 'E2 블라인드 채점 완료', done: e2final, total: e2ready, pct: pct(e2final, e2ready), note: `judged(원본 저장·미집계) ${st('judged')}, final ${st('final')} — judge 2인 + 제3자` },
    { step: '자사 행(Q90 2회차 전사)', done: own ? 1 : 0, total: 1, pct: own ? 100 : 0, note: 'TL D 도구 → 0-c → 실행 → judge → scorer 뒤' }
  ]
};
// 전체 진행률(두괄식 보고용): 단계별 % 를 가중 평균. 가중치는 표에서 차지하는 비중(결박): E1 25 · E3 25 · E2 확보 15 · E2 채점 25 · 자사 10
const W = [25, 25, 15, 25, 10];
out.overall_pct = Math.round(out.steps.reduce((a, s, i) => a + s.pct * W[i], 0) / W.reduce((a, b) => a + b, 0));
out.overall_weights = W;
if (process.argv.includes('--md')) {
  console.log(`**전체 진행률 ${out.overall_pct}%** (가중: E1 25 · E3 25 · E2확보 15 · E2채점 25 · 자사 10)\n`);
  console.log(`| 단계 | 완료/전체 | % | 비고 |\n|---|---|---|---|`);
  for (const s of out.steps) console.log(`| ${s.step} | ${s.done}/${s.total} | ${s.pct}% | ${s.note} |`);
  console.log(`\n(${out.at} · 명부 ${out.roster_rows}행 · 최신 run ${out.latest_run})`);
} else console.log(JSON.stringify(out, null, 1));
