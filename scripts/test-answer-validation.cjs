'use strict';
// INPUT-VALIDATION unit gate (no emulator): generator in sync, client module == rules semantics on a machine-generated
// bad/good set over every question, survey/report-loading wired, i18n keys present, byte-pins elsewhere intact.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), cp = require('node:child_process');
const root = path.resolve(__dirname, '..');
let n = 0; const check = (name, fn) => { try { fn(); n++; } catch (e) { console.log('FAIL ' + name + ': ' + e.message); process.exitCode = 1; } };
const V = require(path.join(root, 'assets/js/answer-validation.js'));
const Q = JSON.parse(fs.readFileSync(path.join(root, 'data/questions.json'), 'utf8'));
const core = Q.sections.flatMap(s => s.questions);
check('generator-in-sync', () => { const o = cp.execFileSync('node', ['scripts/gen-answer-validation.cjs', '--check'], { cwd: root, encoding: 'utf8' }); assert.match(o, /"inSync":true/); });
check('spec-required-56', () => { assert.equal(V.SPEC.requiredKeys.length, 56); assert.deepEqual(V.SPEC.requiredKeys, core.map(q => q.id)); });
check('spec-json-matches-module', () => { const spec = JSON.parse(fs.readFileSync(path.join(root, 'contracts/answer-validation-spec.json'), 'utf8')); assert.equal(spec.requiredSha256, V.SPEC.requiredSha256); assert.equal(Object.keys(spec.items).length, 76); });
check('rules-json-contains-generated-blocks', () => { const r = JSON.parse(fs.readFileSync(path.join(root, 'database.rules.json'), 'utf8')); const sid = r.rules.responses.$uid.$sid; assert.equal(sid.answers.$other['.validate'], 'false'); assert.match(sid.status['.validate'], /hasChildren\(\['Q3'/); assert.match(sid.answers.Q3['.validate'], /newData\.val\(\) === 5/); assert.match(sid.answers.Q6['.validate'], /hasChildren\(\['0'\]\)/); assert.match(sid.answers.Q6['.validate'], /!newData\.hasChild\('3'\)/); for (const q of core) assert.ok(sid.answers[q.id], 'rule for ' + q.id); });
// good set
function good(seed) { const a = { Q1: '회원', Q2: '마이페이지에서 확인' }; let r = seed; const rnd = () => { r = (r * 1103515245 + 12345) % 2147483648; return r / 2147483648; }; for (const q of core) { if (q.type === 'likert') a[q.id] = 1 + Math.floor(rnd() * 5); else if (q.type === 'single_choice') a[q.id] = q.options[Math.floor(rnd() * q.options.length)]; else a[q.id] = q.options.slice(0, 1 + Math.floor(rnd() * (q.max || 2))); } return a; }
check('good-200-all-ok', () => { for (let s = 1; s <= 200; s++) { const v = V.validateAll(good(s)); assert.ok(v.ok, JSON.stringify(v.problems.slice(0, 2))); } });
check('good-with-other-path-ok', () => { const a = good(3); const m = core.find(q => q.hasOther && q.type === 'multi_choice'); a[m.id] = [V.SPEC.otherOption]; a[m.otherId] = '합성'; const s1 = core.find(q => q.hasOther && q.type === 'single_choice'); a[s1.otherId] = '남은 서술'; a._email = 'x@y.z'; a._editCounts = { k: 1 }; assert.ok(V.validateAll(a).ok); });
check('bad-every-question-caught', () => {
  const base = good(9); let count = 0;
  for (const q of core) {
    const variants = q.type === 'likert' ? [0, 6, '4', 3.5, true, null] : q.type === 'single_choice' ? ['없는 선택지', 3, [q.options[0]], ''] : [q.options[0], q.options.slice(0, (q.max || 2) + 1), ['없는'], [1], []];
    for (const bad of variants) { const a = { ...base }; if (bad === null) delete a[q.id]; else a[q.id] = bad; const v = V.validateAll(a); assert.ok(!v.ok && v.problems.some(p => p.qid === q.id), q.id + ' ' + JSON.stringify(bad)); count++; }
    if (q.hasOther) { const a = { ...base }; a[q.otherId] = 'x'.repeat(501); assert.ok(!V.validateAll(a).ok, q.otherId + ' too long'); count++; }
  }
  const a = { ...base, Q999: 1 }; assert.ok(V.validateAll(a).problems.some(p => p.code === 'unknown_key'));
  assert.ok(count >= 300);
});
check('round1-three-shapes', () => { const b = good(5); const a1 = { ...b }; delete a1.Q3; const a2 = { ...b, Q41: core.find(q => q.id === 'Q41').options[0] }; const a3 = { ...b, Q4: 9 }; assert.equal(V.validateAll(a1).problems[0].code, 'missing_required'); assert.equal(V.validateAll(a2).problems[0].code, 'multi_not_array'); assert.equal(V.validateAll(a3).problems[0].code, 'likert_out_of_range'); });
check('survey-wired', () => { const s = fs.readFileSync(path.join(root, 'suvey.html'), 'utf8'); assert.ok(s.includes('assets/js/answer-validation.js')); assert.ok(s.includes('LPAnswerValidation.validateAll(answers)')); assert.ok(!s.includes('survey.confirm_missing_section'), 'submit-anyway confirm must be gone'); assert.ok(s.includes('survey.fix_missing') && s.includes('survey.fix_invalid')); });
check('report-loading-wired', () => { const s = fs.readFileSync(path.join(root, 'report-loading.html'), 'utf8'); assert.ok(s.includes('assets/js/answer-validation.js')); assert.ok(s.includes('report_loading.err_invalid_answers')); assert.ok(s.indexOf('err_invalid_answers') < s.indexOf('setStage(1, "done"); setProgress(25)'), 'pre-check must precede generation stage'); });
check('i18n-keys', () => { for (const l of ['ko', 'en']) { const d = JSON.parse(fs.readFileSync(path.join(root, 'assets/i18n/' + l + '.json'), 'utf8')); assert.ok(d.survey.fix_missing && d.survey.fix_invalid && d.report_loading.err_invalid_answers, l); assert.ok(d.report_loading.err_invalid_answers.includes('data-fix-link')); } });
check('byte-pins-intact', () => { const d = require('./_diary-release-delta.cjs'); const now = fs.readFileSync(path.join(root, 'database.rules.json'), 'utf8'); for (const c of ['f846be1', '3e17b04', '9734521']) assert.equal(d.strip('database.rules.json', now), cp.execFileSync('git', ['show', c + ':database.rules.json'], { cwd: root, encoding: 'utf8' }), c); });
console.log((process.exitCode ? 'FAIL' : 'PASS') + ' test-answer-validation ' + n);
