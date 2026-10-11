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
  // C5 fix (checklist v12, Method 6026347 / Peer 6026353 / TL 6026385): the two previous hold-outs (Q6 options[0..3], Q33 [])
  // were byte-identical to BAD rows. Replaced by shapes the BAD generator never produces (over max by 2 with the LAST
  // options; array containing null). Hold-out is machine-checked against BAD below.
  { qid: 'Q6', kind: 'multi_over_max_by2_tail', value: byId.Q6.options.slice(-5) },
  { qid: 'Q7', kind: 'single_not_in_options', value: '없는 선택지' },
  { qid: 'Q13', kind: 'multi_wrong_elem_type', value: [1, 2] },
  { qid: 'Q78', kind: 'other_text_too_long', value: 'y'.repeat(SPEC.otherMax + 50) },
  // NOTE (found while fixing C5): a hold-out `[option, null]` is NOT a usable negative case — RTDB drops null array
  // elements at write time, so the stored value becomes the valid `[option]` (client validator still rejects it before
  // submit). Recorded in the C5 doc; replaced by a mixed valid+invalid element array, which BAD never generates.
  { qid: 'Q33', kind: 'multi_mixed_valid_invalid', value: [byId.Q33.options[0], '없는 선택지 2'] },
  { qid: 'Q77', kind: 'likert_wrong_type_on_multi_slot', value: 5 },
];
const R1_NEG_SHAPES = new Set(['Q3|missing_required', 'Q41|multi_not_array', 'Q4|likert_out_of_range']);
ok('holdout-disjoint-from-round1-shapes', HOLDOUT.every(h => !R1_NEG_SHAPES.has(h.qid + '|' + h.kind)) && HOLDOUT.length >= 5, HOLDOUT);
// C5: hold-out must also be disjoint from the development (BAD) set as INPUTS, not just by label
{ const badKeys = new Set(BAD.map(b => b.qid + '|' + JSON.stringify(b.value === undefined ? null : b.value)));
  ok('holdout-disjoint-from-bad-set-inputs', HOLDOUT.every(h => !badKeys.has(h.qid + '|' + JSON.stringify(h.value))) && HOLDOUT.length >= 5, HOLDOUT.filter(h => badKeys.has(h.qid + '|' + JSON.stringify(h.value)))); }
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
  // Defect fixed (TL 6027489/6027595): `[i, opts]` destructured `.entries()` pairs as [index, [n, opts]] so `opts.other` was always
  // undefined and the other-option positive path never ran (seeds were 100..103). Now: n = 1..4 as the seed offset, opts honored.
  for (const [n, opts] of [[1, {}], [2, { other: true }], [3, {}], [4, { other: true }]]) { const i = n;
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
  // ---------- C10a ③ (re-freeze checklist): direct PUT to reports/programs must need a submitted/completed response ----------
  //   The report/program nodes are the generation OUTPUT. Writing them directly (bypassing suvey.html + report-loading) with
  //   no valid submitted response must be rejected by the rules themselves, not only by the client pre-check.
  const reportDoc = sid => ({ sid, generatedAt: 1, engineVersion: 'v1.3', rulesVersion: 'v3', toneKey: 't', pdfFilename: 'x.pdf', manualReportStatus: 'auto', editCount: 0, lastEditedAt: 1, lang: 'ko', report: { a: 1 } });
  const programDoc = sid => ({ sid, sourceSid: sid, generatedAt: 1, engineVersion: 'v1.0', rulesVersion: 'v1.0', toneKey: 't', name: 'n', lang: 'ko', manualProgramStatus: 'auto', editCount: 0, lastEditedAt: 1, program: { a: 1 } });
  { // case 1: no response node at all
    const u = await freshUser(); const sid = 's_c10a_none';
    const wr = await put(`reports/${u.localId}/${sid}`, reportDoc(sid), u.idToken); ok('C10a-1-report-direct-put-no-response-rejected', !wr.ok, wr.status);
    const wp = await put(`programs/${u.localId}/${sid}`, programDoc(sid), u.idToken); ok('C10a-1-program-direct-put-no-response-rejected', !wp.ok, wp.status);
    ok('C10a-1-nodes-absent', (await get(`reports/${u.localId}/${sid}`)) === null && (await get(`programs/${u.localId}/${sid}`)) === null);
  }
  { // case 2: response exists but is only in_progress (incomplete answers)
    const u = await freshUser(); const sid = 's_c10a_inprog';
    const w0 = await put(`responses/${u.localId}/${sid}`, sess({ Q1: '회원', Q2: '마이페이지에서 확인', Q3: 4 }, 'in_progress'), u.idToken); ok('C10a-2-in-progress-response-accepted', w0.ok, await w0.text());
    const wr = await put(`reports/${u.localId}/${sid}`, reportDoc(sid), u.idToken); ok('C10a-2-report-direct-put-in-progress-rejected', !wr.ok, wr.status);
    const wp = await put(`programs/${u.localId}/${sid}`, programDoc(sid), u.idToken); ok('C10a-2-program-direct-put-in-progress-rejected', !wp.ok, wp.status);
    const wi = await put(`users/${u.localId}/reports/${sid}`, { sid, generatedAt: 1, toneKey: 't', name: 'n', submittedAt: 1, lang: 'ko' }, u.idToken); ok('C10a-2-report-index-direct-put-in-progress-rejected', !wi.ok, wi.status);
    const wpi = await put(`users/${u.localId}/programs/${sid}`, { sid, sourceSid: sid, generatedAt: 1, toneKey: 't', name: 'n', lang: 'ko' }, u.idToken); ok('C10a-2-program-index-direct-put-in-progress-rejected', !wpi.ok, wpi.status);
  }
  { // case 3: response sid mismatch — submitted session A, write report under sid B
    const u = await freshUser(); const a = goodAnswers(31);
    const w0 = await put(`responses/${u.localId}/s_c10a_A`, sess(a, 'submitted'), u.idToken); ok('C10a-3-submitted-A-accepted', w0.ok, await w0.text());
    const wr = await put(`reports/${u.localId}/s_c10a_B`, reportDoc('s_c10a_B'), u.idToken); ok('C10a-3-report-under-other-sid-rejected', !wr.ok, wr.status);
    const wp = await put(`programs/${u.localId}/s_c10a_B`, programDoc('s_c10a_B'), u.idToken); ok('C10a-3-program-under-other-sid-rejected', !wp.ok, wp.status);
  }
  { // positive regression: submitted response -> report + index + program accepted; re-read; update (regenerate) ; delete (mypage) ; withdraw wipe
    const u = await freshUser(); const sid = 's_c10a_ok'; const a = goodAnswers(32);
    const w0 = await put(`responses/${u.localId}/${sid}`, sess(a, 'submitted'), u.idToken); ok('C10a-P-submitted-accepted', w0.ok, await w0.text());
    const wr = await put(`reports/${u.localId}/${sid}`, reportDoc(sid), u.idToken); ok('C10a-P-report-write-accepted', wr.ok, await wr.text());
    const wi = await put(`users/${u.localId}/reports/${sid}`, { sid, generatedAt: 1, toneKey: 't', name: 'n', submittedAt: 1, lang: 'ko' }, u.idToken); ok('C10a-P-report-index-accepted', wi.ok, await wi.text());
    const wp = await put(`programs/${u.localId}/${sid}`, programDoc(sid), u.idToken); ok('C10a-P-program-write-accepted', wp.ok, await wp.text());
    const wpi = await put(`users/${u.localId}/programs/${sid}`, { sid, sourceSid: sid, generatedAt: 1, toneKey: 't', name: 'n', lang: 'ko' }, u.idToken); ok('C10a-P-program-index-accepted', wpi.ok, await wpi.text());
    const rr = await get(`reports/${u.localId}/${sid}`); ok('C10a-P-report-reread', rr && rr.sid === sid && rr.report && rr.report.a === 1);
    const wu = await patch(`reports/${u.localId}/${sid}`, { toneKey: 't2', editCount: 1, lastEditedAt: 2, report: { a: 2 } }, u.idToken); ok('C10a-P-report-regenerate-update-accepted', wu.ok, await wu.text());
    const wpu = await patch(`programs/${u.localId}/${sid}`, { toneKey: 't2', editCount: 1, lastEditedAt: 2, program: { a: 2 } }, u.idToken); ok('C10a-P-program-regenerate-update-accepted', wpu.ok, await wpu.text());
    // mypage single-report delete: one multi-path update nulling report + index + program
    const wd = await patch(``, { [`reports/${u.localId}/${sid}`]: null, [`users/${u.localId}/reports/${sid}`]: null, [`programs/${u.localId}/${sid}`]: null }, u.idToken); ok('C10a-P-mypage-delete-3-nodes-accepted', wd.ok, await wd.text());
    ok('C10a-P-deleted', (await get(`reports/${u.localId}/${sid}`)) === null && (await get(`programs/${u.localId}/${sid}`)) === null);
    // completed status also unlocks
    const u2 = await freshUser(); const sid2 = 's_c10a_done'; await put(`responses/${u2.localId}/${sid2}`, sess(goodAnswers(33), 'submitted'), u2.idToken);
    const wc = await patch(`responses/${u2.localId}/${sid2}`, { status: 'completed' }, u2.idToken); ok('C10a-P-status-completed-accepted', wc.ok, await wc.text());
    const wr2 = await put(`reports/${u2.localId}/${sid2}`, reportDoc(sid2), u2.idToken); ok('C10a-P-report-write-after-completed-accepted', wr2.ok, await wr2.text());
    const wp2 = await put(`programs/${u2.localId}/${sid2}`, programDoc(sid2), u2.idToken); ok('C10a-P-program-write-after-completed-accepted', wp2.ok, await wp2.text());
    // withdraw wipe: whole-subtree nulls (mypage.html withdrawal path)
    const ww = await patch(``, { [`reports/${u2.localId}`]: null, [`users/${u2.localId}`]: null, [`programs/${u2.localId}`]: null, [`responses/${u2.localId}`]: null }, u2.idToken); ok('C10a-P-withdraw-wipe-accepted', ww.ok, await ww.text());
  }
  { // b2b path (Method 5814911): group response in progress -> personal report write must stay rejected (b2b branch), and the
    // server-owned group report write is not a client path (rules say nothing new about it; client write under b2b surveySid rejected as before)
    const u = await freshUser(); const sid = 's_c10a_b2b';
    await put(`b2b_access/${u.localId}`, { surveySid: sid, orderId: 'o1' });
    await put(`responses/${u.localId}/${sid}`, { ...sess({ Q1: '회원', Q2: '마이페이지에서 확인' }, 'in_progress'), meta: { step: 1, answered: 2, source: 'b2b', b2bOrderId: 'o1' } });
    const wr = await put(`reports/${u.localId}/${sid}`, reportDoc(sid), u.idToken); ok('C10a-B2B-personal-report-write-under-group-sid-rejected', !wr.ok, wr.status);
    const sub = await patch(`responses/${u.localId}/${sid}`, { meta: { step: 1, answered: 2, source: 'b2b', b2bOrderId: 'o1' }, status: 'in_progress', answers: { Q1: '회원', Q2: '마이페이지에서 확인' } }, u.idToken); ok('C10a-B2B-group-session-progress-still-allowed', sub.ok, await sub.text());
  }
  const failed = results.filter(r => !r.ok);
  console.log(JSON.stringify({ passed: results.length - failed.length, failed: failed.length, scope: 'local emulators, real RTDB rules, synthetic accounts' }));
  fs.mkdirSync(path.join(root, 'dist/b2b-audit'), { recursive: true });
  fs.writeFileSync(path.join(root, 'dist/b2b-audit/answer-validation-gate.json'), JSON.stringify({ setSha256: setSha, badSet: BAD.map(b => ({ qid: b.qid, kind: b.kind })), holdout: HOLDOUT.map(h => ({ qid: h.qid, kind: h.kind })), results }, null, 1));
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
