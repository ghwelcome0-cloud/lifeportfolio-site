'use strict';
// Q90 round-2 product gate (checklist C5/C6a/C7/C8): REAL database.rules.json in the local RTDB emulator,
// synthetic accounts, REST PUT path identical to the round-1 harness stage-2 write (negative.cjs line 64).
//   - C5  machine-generated bad-input set over EVERY question (missing / wrong shape / out of range / not in option set)
//         + hold-out >= 5 that share no input hash with round-1 negative cases 10/11/12 (shapes only; those files are sealed)
//   - C6a every bad input: write rejected (401/403) OR, if the item write is accepted, status=submitted is rejected
//         -> report/program generation input never reaches "submitted" => report·program nodes absent (controls true)
//   - C7  machine-generated GOOD inputs (incl. other-option retained text path and numeric likert) are accepted end to end
//   - C8  rules load in emulator v4.11.2 (this test cannot run otherwise)
// Run via: npm run test:answer-validation:emulator
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
for (const key of ['FIREBASE_DATABASE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST']) assert.match(process.env[key] || '', /^127\.0\.0\.1:\d+$/, 'Refuse non-local emulator: ' + key);
const project = 'demo-lp-b2b-stability', ns = project + '-default-rtdb';
const RTDB = 'http://' + process.env.FIREBASE_DATABASE_EMULATOR_HOST, AUTH = 'http://' + process.env.FIREBASE_AUTH_EMULATOR_HOST;
const Q = JSON.parse(fs.readFileSync(path.join(root, 'data/questions.json'), 'utf8'));
const V = require('../assets/js/answer-validation.js');
const SPEC = V.SPEC; const OTHER = SPEC.otherOption;
const sha = x => crypto.createHash('sha256').update(typeof x === 'string' ? x : JSON.stringify(x)).digest('hex');
const results = []; const ok = (name, cond, detail) => { results.push({ name, ok: !!cond }); if (!cond) console.log('FAIL ' + name + ': ' + JSON.stringify(detail).slice(0, 400)); };
const own = { Authorization: 'Bearer owner' };
const core = Q.sections.flatMap(s => s.questions);
const byId = Object.fromEntries(core.map(q => [q.id, q]));

// ---------- deterministic generators (seeded, no personal data) ----------
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function goodAnswers(seed, opts = {}) {
  const r = mulberry32(seed); const a = { Q1: '회원', Q2: '마이페이지에서 확인' };
  for (const q of core) {
    if (q.type === 'likert') a[q.id] = 1 + Math.floor(r() * 5);
    else if (q.type === 'single_choice') a[q.id] = q.options[Math.floor(r() * q.options.length)];
    else { const n = 1 + Math.floor(r() * (q.max || 2)); const pool = q.options.slice(); const pick = []; while (pick.length < n && pool.length) pick.push(pool.splice(Math.floor(r() * pool.length), 1)[0]); a[q.id] = pick; }
  }
  if (opts.other) { // other-option path: parent selects 기타, otherId carries text (and retained-text variant: parent switched back)
    const q = core.find(x => x.hasOther && x.type === 'multi_choice'); a[q.id] = [OTHER]; a[q.otherId] = '합성 기타 서술 ' + seed;
    const q2 = core.find(x => x.hasOther && x.type === 'single_choice'); a[q2.id] = q2.options[0]; a[q2.otherId] = '부모 답 변경 후 남은 서술 ' + seed; // retained (branch D)
  }
  return a;
}
function badVariants(q) {
  const v = [];
  v.push({ kind: 'missing_required', value: undefined });
  if (q.type === 'likert') { v.push({ kind: 'likert_out_of_range', value: 6 }); v.push({ kind: 'likert_out_of_range', value: 0 }); v.push({ kind: 'likert_wrong_type', value: '4' }); v.push({ kind: 'likert_fraction', value: 3.5 }); v.push({ kind: 'likert_bool', value: true }); }
  if (q.type === 'single_choice') { v.push({ kind: 'single_not_in_options', value: '존재하지 않는 선택지' }); v.push({ kind: 'single_wrong_type', value: 3 }); v.push({ kind: 'single_array', value: [q.options[0]] }); }
  if (q.type === 'multi_choice') { v.push({ kind: 'multi_not_array', value: q.options[0] }); v.push({ kind: 'multi_over_max', value: q.options.slice(0, (q.max || 2) + 1) }); v.push({ kind: 'multi_not_in_options', value: ['없는 선택지'] }); v.push({ kind: 'multi_wrong_elem_type', value: [1] }); v.push({ kind: 'multi_empty', value: [] }); }
  if (q.hasOther) v.push({ kind: 'other_text_too_long', key: q.otherId, value: 'x'.repeat(SPEC.otherMax + 1) });
  return v;
}
const BAD = []; for (const q of core) for (const b of badVariants(q)) BAD.push({ qid: b.key || q.id, parent: q.id, ...b });
BAD.push({ qid: 'Q999', parent: null, kind: 'unknown_key', value: 3 });
BAD.push({ qid: '_log', parent: null, kind: 'unknown_internal_key', value: { a: 1 } });
// hold-out >= 5: distinct shapes from round-1 cases (10: Q3 missing, 11: Q41 multi_not_array, 12: Q4 likert_out_of_range)
const HOLDOUT = [
  { qid: 'Q6', kind: 'multi_over_max', value: byId.Q6.options.slice(0, 4) },
  { qid: 'Q7', kind: 'single_not_in_options', value: '없는 선택지' },
  { qid: 'Q13', kind: 'multi_wrong_elem_type', value: [1, 2] },
  { qid: 'Q78', kind: 'other_text_too_long', value: 'y'.repeat(SPEC.otherMax + 50) },
  { qid: 'Q33', kind: 'multi_empty', value: [] },
  { qid: 'Q77', kind: 'likert_wrong_type_on_multi_slot', value: 5 },
];
const R1_NEG_SHAPES = new Set(['Q3|missing_required', 'Q41|multi_not_array', 'Q4|likert_out_of_range']);
ok('holdout-disjoint-from-round1-shapes', HOLDOUT.every(h => !R1_NEG_SHAPES.has(h.qid + '|' + h.kind)) && HOLDOUT.length >= 5, HOLDOUT);
const setSha = sha({ bad: BAD.map(b => [b.qid, b.kind, b.value === undefined ? null : b.value]), holdout: HOLDOUT });

// ---------- emulator helpers ----------
async function signUp() { const r = await fetch(AUTH + '/identitytoolkit.googleapis.com/v1/accounts:signUp?key=synthetic', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }) }); return r.json(); }
const put = (p, body, tok) => fetch(`${RTDB}/${p}.json?ns=${ns}${tok ? '&auth=' + tok : ''}`, { method: 'PUT', body: JSON.stringify(body), headers: tok ? {} : own });
const patch = (p, body, tok) => fetch(`${RTDB}/${p}.json?ns=${ns}${tok ? '&auth=' + tok : ''}`, { method: 'PATCH', body: JSON.stringify(body), headers: tok ? {} : own });
const get = async p => JSON.parse(await (await fetch(`${RTDB}/${p}.json?ns=${ns}`, { headers: own })).text());
async function freshUser() { const u = await signUp(); await put(`payments/${u.localId}`, { paid: true, createdAt: '2026-01-01T00:00:00.000Z' }); return u; }
const sess = (answers, status) => ({ answers, status, startedAt: 1, updatedAt: 1, lang: 'ko', name: answers.Q1 || null, recvMethod: answers.Q2 || null, meta: { step: 1, answered: Object.keys(answers).length } });

(async () => {
  // C8: rules loaded? (owner read of .settings/rules)
  const rulesLive = await (await fetch(`${RTDB}/.settings/rules.json?ns=${ns}`, { headers: own })).text();
  ok('C8-rules-loaded-in-emulator', /answer|responses/.test(rulesLive) && rulesLive.includes('Q3'), rulesLive.slice(0, 200));
  ok('C8-rules-byte-identical-to-source', JSON.stringify(JSON.parse(rulesLive)) === JSON.stringify(JSON.parse(fs.readFileSync(path.join(root, 'database.rules.json'), 'utf8'))));

  // C7: positive regression — good inputs saved in_progress, item-by-item autosave, then submitted
  for (const [i, opts] of [[1, {}], [2, { other: true }], [3, {}], [4, { other: true }]].entries()) {
    const u = await freshUser(); const sid = 's_17000000000' + i + '_gate'; const a = goodAnswers(100 + i, opts);
    const w1 = await put(`responses/${u.localId}/${sid}`, sess({ Q1: a.Q1, Q2: a.Q2 }, 'in_progress'), u.idToken); ok(`C7-${i}-create-in-progress`, w1.ok, await w1.text());
    let allItemsOk = true; for (const k of Object.keys(a)) { const w = await put(`responses/${u.localId}/${sid}/answers/${k}`, a[k], u.idToken); if (!w.ok) { allItemsOk = false; ok(`C7-${i}-item-${k}`, false, await w.text()); } }
    ok(`C7-${i}-all-items-accepted`, allItemsOk);
    const w2 = await patch(`responses/${u.localId}/${sid}`, { status: 'submitted', submittedAt: { '.sv': 'timestamp' } }, u.idToken); ok(`C7-${i}-submit-accepted`, w2.ok, await w2.text());
    const back = await get(`responses/${u.localId}/${sid}/answers`); ok(`C7-${i}-roundtrip`, back && back.Q3 === a.Q3 && JSON.stringify(back.Q6) === JSON.stringify(a.Q6) && (opts.other ? typeof back[core.find(x => x.hasOther && x.type === 'multi_choice').otherId] === 'string' : true), back && Object.keys(back).length);
    // whole-node write with full answers in one PUT (submit path in suvey.html REST fallback)
    const u2 = await freshUser(); const w3 = await put(`responses/${u2.localId}/${sid}b`, sess(a, 'submitted'), u2.idToken); ok(`C7-${i}-single-put-submitted`, w3.ok, await w3.text());
    // partial progress with a deletion (null) must stay allowed
    const w4 = await put(`responses/${u.localId}/${sid}/answers/Q6`, null, u.idToken); ok(`C7-${i}-delete-allowed-after-submit?`, true, w4.status); // informational
  }
  // valid in-progress with few answers must be allowed (status != submitted)
  { const u = await freshUser(); const w = await put(`responses/${u.localId}/s_1_partial`, sess({ Q1: '회원', Q2: '마이페이지에서 확인', Q3: 4 }, 'in_progress'), u.idToken); ok('C7-partial-in-progress-allowed', w.ok, await w.text()); }

  // C6a: every bad input — item write rejected, or submit rejected; never a "submitted" session with the bad value
  let rejectedItem = 0, rejectedSubmit = 0, leaked = [];
  const base = goodAnswers(7);
  for (const b of [...BAD, ...HOLDOUT]) {
    const u = await freshUser(); const sid = 's_' + sha(b.qid + b.kind).slice(0, 10);
    const a = { ...base }; if (b.value === undefined) delete a[b.qid]; else a[b.qid] = b.value;
    // path A: single PUT of a submitted session carrying the bad value (round-1 stage-2 shape)
    const wA = await put(`responses/${u.localId}/${sid}`, sess(a, 'submitted'), u.idToken);
    // path B: good session in progress, then bad item, then submit
    const u2 = await freshUser(); const sid2 = sid + 'b';
    await put(`responses/${u2.localId}/${sid2}`, sess({ Q1: '회원', Q2: '마이페이지에서 확인' }, 'in_progress'), u2.idToken);
    for (const k of Object.keys(base)) if (k !== b.qid) await put(`responses/${u2.localId}/${sid2}/answers/${k}`, base[k], u2.idToken);
    const wItem = b.value === undefined ? { ok: true, status: 'skip' } : await put(`responses/${u2.localId}/${sid2}/answers/${b.qid}`, b.value, u2.idToken);
    const wSub = await patch(`responses/${u2.localId}/${sid2}`, { status: 'submitted' }, u2.idToken);
    const nodeA = await get(`responses/${u.localId}/${sid}`), nodeB = await get(`responses/${u2.localId}/${sid2}`);
    // path B may legitimately end 'submitted' when the bad ITEM was rejected (the stored session is then a clean, complete one).
    // A leak = a 'submitted' session that actually CONTAINS the bad value / lacks the required key.
    const storedB = nodeB && nodeB.answers ? nodeB.answers : {};
    const badStored = b.value === undefined ? !(b.qid in storedB) : JSON.stringify(storedB[b.qid]) === JSON.stringify(b.value);
    const pass = !wA.ok && (!wItem.ok || !wSub.ok) && nodeA === null && !(nodeB && nodeB.status === 'submitted' && badStored);
    if (!wItem.ok) rejectedItem++; else if (!wSub.ok) rejectedSubmit++;
    if (!pass) leaked.push({ qid: b.qid, kind: b.kind, wA: wA.status, wItem: wItem.status, wSub: wSub.status, nodeA: nodeA && nodeA.status, nodeB: nodeB && nodeB.status });
  }
  ok('C6a-all-bad-inputs-blocked-before-submitted', leaked.length === 0, leaked.slice(0, 8));
  console.log(JSON.stringify({ badSet: BAD.length, holdout: HOLDOUT.length, setSha256: setSha, rejectedAtItem: rejectedItem, rejectedAtSubmit: rejectedSubmit, leaked: leaked.length }));
  // round-1 three negative shapes explicitly (same shapes, synthetic values — not the sealed files)
  for (const [qid, kind, value] of [['Q3', 'missing_required', undefined], ['Q41', 'multi_not_array', byId.Q41.options[0]], ['Q4', 'likert_out_of_range', 9]]) {
    const u = await freshUser(); const a = { ...base }; if (value === undefined) delete a[qid]; else a[qid] = value;
    const w = await put(`responses/${u.localId}/s_r1_${qid}`, sess(a, 'submitted'), u.idToken); ok(`C6a-round1-shape-${qid}-${kind}-rejected`, !w.ok, w.status);
  }
  const failed = results.filter(r => !r.ok);
  console.log(JSON.stringify({ passed: results.length - failed.length, failed: failed.length, scope: 'local emulators, real RTDB rules, synthetic accounts' }));
  fs.mkdirSync(path.join(root, 'dist/b2b-audit'), { recursive: true });
  fs.writeFileSync(path.join(root, 'dist/b2b-audit/answer-validation-gate.json'), JSON.stringify({ setSha256: setSha, badSet: BAD.map(b => ({ qid: b.qid, kind: b.kind })), holdout: HOLDOUT.map(h => ({ qid: h.qid, kind: h.kind })), results }, null, 1));
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
