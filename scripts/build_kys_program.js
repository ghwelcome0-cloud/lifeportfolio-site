const fs = require('fs');
const path = require('path');

// Load engines
const ROOT = path.resolve(__dirname, '..');
const ReportEngine = require(path.join(ROOT, 'assets/js/report-engine.js'));
const ReportEngineV4 = require(path.join(ROOT, 'assets/js/report-engine-v4.js'));
const ProgramEngine = require(path.join(ROOT, 'assets/js/program-engine.js'));

console.log('RE4 version:', ReportEngineV4.version);
console.log('PE version:', ProgramEngine.version);

// Load data
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const questions = read('data/questions.json');
const mapping = read('data/mapping.json');
const reportRules = read('data/report-rules.json');
const programRules = read('data/program-rules.json');
const careerRules = read('data/career-rules.json'); // PR#63 RULE-CAREER v1.0
const rtdb = read('scripts/kys_rtdb_node_import.json');

const profile = {
  name: rtdb.name || '김영식',
  email: rtdb.email || 'ghwelcome0@gmail.com',
  recvMethod: rtdb.recvMethod || 'email',
  submittedAt: '2026-04-15'
};

// Build report v1.3 — PR#63: careerRules 주입 (RULE-CAREER v1.0)
const v13 = ReportEngine.build({
  questions, mapping, rules: reportRules, answers: rtdb.answers, profile, lang: 'ko',
  careerRules
});

// Upgrade v4.1 — signature: upgrade(rawReport, ctx)
const v41 = ReportEngineV4.upgrade(v13, {
  questions, mapping, rules: reportRules, answers: rtdb.answers, profile, lang: 'ko',
  careerRules
});

console.log('Report v4.1 fingerprint:', v41._v4Meta && v41._v4Meta.fingerprint);

// Build program from v4.1 report
const program = ProgramEngine.build({
  report: v41,
  rules: programRules,
  name: profile.name,
  lang: 'ko'
});

console.log('Program built. Sections:', (program.sections || []).length);
console.log('Program tone:', program.meta && program.meta.toneKey);

fs.writeFileSync('./reports/v4_test/kys_real_program_v2.json', JSON.stringify(program, null, 2));
fs.writeFileSync('./reports/v4_test/kys_real_v41_upgraded.json', JSON.stringify(v41, null, 2));
console.log('OK');
