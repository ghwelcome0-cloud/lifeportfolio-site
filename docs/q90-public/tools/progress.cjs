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
const filled = v => v && typeof v === 'object' && v.source_url && v.value !== null && v.value !== undefined && v.value !== '' && !/재확인 필요/.test(v.note || '');
// E3 '해당 없음' 칸(value null + note '해당 없음' + 근거 URL)은 분모에서 뺀다(E3 rule 3차-b). 두 분모 병기.
const na = v => v && typeof v === 'object' && v.value == null && v.source_url && /^해당 없음/.test(v.note || '');
let e3cells = 0, e3rowsTouched = 0, e3rowsComplete = 0, e3na = 0;
for (const r of e3.rows) { const n = E3_KEYS.filter(k => filled(r[k])).length, m = E3_KEYS.filter(k => na(r[k])).length; e3cells += n; e3na += m; if (n > 0) e3rowsTouched++; if (n + m === E3_KEYS.length) e3rowsComplete++; }
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
const e1n = scored.filter(v => !v.own && (v.a61 || v.a71)).length;
// 자사 행: own.json 존재 여부
const own = fs.existsSync(path.join(B, 'table', 'own.json'));
const pct = (a, b) => b ? Math.round(100 * a / b) : 0;
const out = {
  at: new Date().toISOString().slice(0, 16) + 'Z', roster_rows: rows.length, compare_rows: nonOwn.length, latest_run: latest || null,
  steps: [
    { step: 'E1 실측(최신 run, 비자사 행)', done: e1n, total: nonOwn.length, pct: pct(e1n, nonOwn.length), note: asm ? `조립본(runs/latest) = ${asm.inputs.map(i => `${i.run}·${i.egress_country}(${i.rows}행)`).join(' + ')} · r3 단독 31/${nonOwn.length} → 조립 ${e1n}/${nonOwn.length} · 미측정 ${nonOwn.length - e1n}행은 국내 접속에서도 시간 초과(고용24 6)` : (latest ? `${latest}` : '') },
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
