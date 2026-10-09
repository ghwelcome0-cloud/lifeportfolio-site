'use strict';
// INPUT-VALIDATION (Q90 round-2 §7 (나), checklist C3/C4): single source = data/questions.json.
// Generates, deterministically:
//   1) the RTDB `.validate` string for responses/$uid/$sid/answers/$qid (per-item shape/range/option-set)
//   2) the RTDB `.validate` string for responses/$uid/$sid/status (submitted/completed require all 56 core answers)
//   3) assets/js/answer-validation.js — the SAME rules for the client (survey submit + report-loading pre-check)
//   4) a machine-readable spec (sha256 of required-key list, option sets) for the checklist C4 row.
// Run: node scripts/gen-answer-validation.cjs [--write]   (without --write: prints SHAs and diffs only)
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.resolve(__dirname, '..');
const Q = JSON.parse(fs.readFileSync(path.join(root, 'data/questions.json'), 'utf8'));
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const OTHER_KO = '기타 (직접 입력)';           // appended other-option string used by suvey.html renderers (3450/3527)
const OTHER_MAX = 500;                          // free-text other answer cap (chars)
const META_KEYS = { Q1: { type: 'text', max: 30 }, Q2: { type: 'text', max: 80 } };
// client-only bookkeeping keys that live inside answers (suvey.html 2169-2170); kept, bounded.
const INTERNAL = { _email: 'string<=254', _editCounts: 'object of small ints' };

const core = []; const byId = {};
for (const sec of Q.sections) for (const q of sec.questions) {
  core.push(q.id); byId[q.id] = q;
  if (q.hasOther && q.otherId) byId[q.otherId] = { id: q.otherId, type: 'other_text', parent: q.id };
}
if (core.length !== Q.coreQuestions) throw new Error('core count mismatch ' + core.length + ' vs ' + Q.coreQuestions);
const likertScores = Object.values(Q.likertScores).sort((a, b) => a - b); // [1..5]
const esc = s => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

// ---- 1) per-item rule ------------------------------------------------------
function itemRule(q) {
  if (q.type === 'single_choice') {
    const opts = q.options.concat(q.hasOther ? [OTHER_KO] : []);
    return `newData.isString() && (${opts.map(o => `newData.val() === '${esc(o)}'`).join(' || ')})`;
  }
  if (q.type === 'multi_choice') {
    // RTDB stores arrays as objects with integer keys 0..n-1. Allow 1..max children; each child must be an allowed option string.
    const opts = q.options.concat(q.hasOther ? [OTHER_KO] : []);
    const max = q.max || 2;
    const idx = Array.from({ length: max }, (_, i) => String(i));
    const childrenOk = idx.map(i => `(!newData.hasChild('${i}') || (newData.child('${i}').isString() && (${opts.map(o => `newData.child('${i}').val() === '${esc(o)}'`).join(' || ')})))`).join(' && ');
    const noExtra = `!newData.hasChild('${max}')`;
    return `newData.hasChildren(['0']) && ${noExtra} && ${childrenOk}`;
  }
  if (q.type === 'other_text') return `newData.isString() && newData.val().length <= ${OTHER_MAX}`;
  throw new Error('unknown type ' + q.type);
}
// RTDB rules have no floor(); enumerate the allowed integer scores from questions.json likertScores.
function likertRule() { return `newData.isNumber() && (${likertScores.map(v => `newData.val() === ${v}`).join(' || ')})`; }

const answersRules = {};
for (const id of Object.keys(byId)) {
  const q = byId[id];
  answersRules[id] = { '.validate': q.type === 'likert' ? likertRule() : itemRule(q) };
}
// Q1/Q2 are profile meta (not scored; suvey.html owns their option strings, questions.json metaFields differ) -> bounded strings only.
answersRules.Q1 = { '.validate': `newData.isString() && newData.val().length <= ${META_KEYS.Q1.max}` };
answersRules.Q2 = { '.validate': 'newData.isString() && newData.val().length <= 80' };
answersRules._email = { '.validate': 'newData.isString() && newData.val().length <= 254' };
answersRules._editCounts = { '$k': { '.validate': 'newData.isNumber() && newData.val() >= 0 && newData.val() <= 9999' } };
answersRules.$other = { '.validate': 'false' }; // undefined key -> reject (case 11 scalar-in-wrong-shape also fails its own item rule)
// Deletion (null) must stay allowed for in-progress edits: RTDB skips .validate for null writes, so no change needed.

// ---- 2) status rule: submitted/completed only when all core keys present ---
const requiredList = core.slice();
const requiredSha = sha(JSON.stringify(requiredList));
const hasAll = `newData.parent().child('answers').hasChildren(${JSON.stringify(requiredList).replace(/"/g, "'")})`;
const statusRule = `newData.isString() && newData.val().length <= 20 && ((newData.val() !== 'submitted' && newData.val() !== 'completed') || ${hasAll})`;

// ---- 3) client module -------------------------------------------------------
const clientSpec = {
  version: 'answer-validation-v1',
  source: 'data/questions.json',
  questionsVersion: Q.version,
  requiredKeys: requiredList,
  requiredSha256: requiredSha,
  likert: { min: likertScores[0], max: likertScores[likertScores.length - 1] },
  otherOption: OTHER_KO, otherMax: OTHER_MAX,
  items: Object.fromEntries(Object.keys(byId).map(id => { const q = byId[id]; return [id, q.type === 'other_text' ? { type: 'other_text', parent: q.parent } : q.type === 'likert' ? { type: 'likert' } : { type: q.type, options: q.options.concat(q.hasOther ? [OTHER_KO] : []), max: q.type === 'multi_choice' ? (q.max || 2) : 1 }]; })),
  meta: { Q1: { type: 'text', max: 30 }, Q2: { type: 'text', max: 80 } },
};
const clientJs = `/* GENERATED by scripts/gen-answer-validation.cjs from data/questions.json — do not edit by hand.
 * Q90 round-2 §7 (나): same rules as database.rules.json (responses/$uid/$sid/answers). spec sha256 in SPEC.requiredSha256.
 * Exposes window.LPAnswerValidation = { SPEC, validateItem(qid, value) -> null | code, validateAll(answers) -> { ok, problems:[{qid, code}] } }
 */
(function (g) {
  'use strict';
  var SPEC = ${JSON.stringify(clientSpec)};
  function isEmpty(v) { return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0); }
  function validateItem(qid, v) {
    if (qid === 'Q1') return (typeof v === 'string' && v.length <= SPEC.meta.Q1.max) ? null : 'meta_name';
    if (qid === 'Q2') return (typeof v === 'string' && v.length <= 80) ? null : 'meta_recv';
    if (qid === '_email') return (typeof v === 'string' && v.length <= 254) ? null : 'internal_email';
    if (qid === '_editCounts') return (v && typeof v === 'object' && !Array.isArray(v)) ? null : 'internal_editcounts';
    var it = SPEC.items[qid]; if (!it) return 'unknown_key';
    if (it.type === 'likert') return (typeof v === 'number' && v >= SPEC.likert.min && v <= SPEC.likert.max && Math.floor(v) === v) ? null : 'likert_out_of_range';
    if (it.type === 'single_choice') return (typeof v === 'string' && it.options.indexOf(v) >= 0) ? null : 'single_not_in_options';
    if (it.type === 'multi_choice') {
      if (!Array.isArray(v)) return 'multi_not_array';
      if (v.length < 1 || v.length > it.max) return 'multi_count';
      for (var i = 0; i < v.length; i++) { if (typeof v[i] !== 'string' || it.options.indexOf(v[i]) < 0) return 'multi_not_in_options'; if (v.indexOf(v[i]) !== i) return 'multi_duplicate'; }
      return null;
    }
    if (it.type === 'other_text') return (typeof v === 'string' && v.length <= SPEC.otherMax) ? null : 'other_text_shape';
    return 'unknown_type';
  }
  function validateAll(answers) {
    var problems = [], a = answers || {};
    for (var i = 0; i < SPEC.requiredKeys.length; i++) { var k = SPEC.requiredKeys[i]; if (isEmpty(a[k])) problems.push({ qid: k, code: 'missing_required' }); }
    for (var key in a) { if (!Object.prototype.hasOwnProperty.call(a, key)) continue; if (isEmpty(a[key])) continue; var c = validateItem(key, a[key]); if (c) problems.push({ qid: key, code: c }); }
    return { ok: problems.length === 0, problems: problems };
  }
  var api = { SPEC: SPEC, validateItem: validateItem, validateAll: validateAll, isEmpty: isEmpty };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  g.LPAnswerValidation = api;
})(typeof window !== 'undefined' ? window : globalThis);
`;

// ---- apply to database.rules.json (surgical text replacement; file formatting elsewhere untouched) ----
const rulesPath = path.join(root, 'database.rules.json');
const rulesText = fs.readFileSync(rulesPath, 'utf8');
const OLD_ANSWERS = `          "answers": {\n            "$qid": {\n              ".validate": "newData.isString() || newData.isNumber() || newData.isBoolean() || newData.hasChildren() || newData.val() === null"\n            }\n          },\n`;
const OLD_STATUS = `          "status": {\n            ".validate": "newData.isString() && newData.val().length <= 20"\n          },\n`;
const indent = (obj, depth) => JSON.stringify(obj, null, 2).split('\n').map((l, i) => (i ? ' '.repeat(depth) : '') + l).join('\n');
const NEW_ANSWERS = `          "answers": ${indent(answersRules, 10)},\n`;
const NEW_STATUS = `          "status": {\n            ".validate": ${JSON.stringify(statusRule)}\n          },\n`;
function applyRules(text) {
  const r0 = text.indexOf('"responses": {'); if (r0 < 0) throw new Error('responses block not found');
  const head = text.slice(0, r0), tail = text.slice(r0);
  const cur = tail.includes(OLD_ANSWERS) ? OLD_ANSWERS : (tail.includes(NEW_ANSWERS) ? NEW_ANSWERS : null);
  const curS = tail.includes(OLD_STATUS) ? OLD_STATUS : (tail.includes(NEW_STATUS) ? NEW_STATUS : null);
  if (!cur || !curS) throw new Error('answers/status block not found in responses');
  if (tail.split(cur).length !== 2 || tail.split(curS).length !== 2) throw new Error('block must appear exactly once');
  return head + tail.replace(cur, NEW_ANSWERS).replace(curS, NEW_STATUS);
}
const out = applyRules(rulesText);
JSON.parse(out); // must stay valid JSON
const spec = { ...clientSpec, rtdb: { answersRulesSha256: sha(JSON.stringify(answersRules)), statusRule, statusRuleSha256: sha(statusRule) }, generator: 'scripts/gen-answer-validation.cjs', generatorSha256: sha(fs.readFileSync(__filename)) };

if (require.main === module && process.argv.includes('--write')) {
  fs.writeFileSync(rulesPath, out);
  fs.writeFileSync(path.join(root, 'assets/js/answer-validation.js'), clientJs);
  fs.writeFileSync(path.join(root, 'contracts/answer-validation-spec.json'), JSON.stringify(spec, null, 2) + '\n');
  console.log('written: database.rules.json, assets/js/answer-validation.js, contracts/answer-validation-spec.json');
} else if (require.main === module) {
  const same = fs.existsSync(path.join(root, 'assets/js/answer-validation.js')) && fs.readFileSync(path.join(root, 'assets/js/answer-validation.js'), 'utf8') === clientJs && fs.readFileSync(rulesPath, 'utf8') === out;
  console.log(JSON.stringify({ inSync: same, requiredSha256: requiredSha, answersRulesSha256: spec.rtdb.answersRulesSha256, statusRuleSha256: spec.rtdb.statusRuleSha256, items: Object.keys(byId).length, core: core.length }));
  if (!same && process.argv.includes('--check')) { console.error('OUT OF SYNC: run node scripts/gen-answer-validation.cjs --write'); process.exit(1); }
}
module.exports = { clientSpec, answersRules, statusRule, OLD_ANSWERS, OLD_STATUS, NEW_ANSWERS, NEW_STATUS };
