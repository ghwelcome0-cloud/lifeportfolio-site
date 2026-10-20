'use strict';
// Usage: node own-generate.cjs <answers.json> <outDir> [--name 민서]
// 자사 E2 블라인드 트랙(op:q90-auto-210 A): 최신 출시판 엔진(main HEAD)으로 리포트·실행 프로그램을 **오프라인** 생성한다.
//  - 순서 = report-loading.html(ReportEngine.build → V4.upgrade → LPResponseEvidence.attachAxes(+AxisCompose) → AssetPath.compose)
//          + program-loading.html(ProgramEngine.build axisProgram:true, cardShape:'rq-01')
//  - 운영 DB·Auth·네트워크·쓰기 0. 답은 응시 보조(E2-s)가 낸 JSON을 그대로 쓴다(총괄 수정 금지 — 입력 sha 기록).
//  - 출력: report.json, program.json, gen-meta.json(입력·엔진 파일 sha, git HEAD). PDF는 own-render.cjs가 만든다.
const fs = require('fs'), path = require('path'), crypto = require('crypto'), cp = require('child_process');
const [ANS, OUT] = process.argv.slice(2);
const nameArg = (process.argv.indexOf('--name') > 0) ? process.argv[process.argv.indexOf('--name') + 1] : '민서';
if (!ANS || !OUT) { console.error('usage: own-generate.cjs <answers.json> <outDir> [--name 이름]'); process.exit(2); }
const ROOT = path.resolve(__dirname, '../../..');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const J = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const files = ['assets/js/report-engine.js', 'assets/js/report-engine-v4.js', 'assets/js/career-engine.js', 'assets/js/response-evidence.js', 'assets/js/axis-compose.js', 'assets/js/asset-map.js', 'assets/js/asset-path.js', 'assets/js/program-engine.js',
  'data/questions.json', 'data/mapping.json', 'data/report-rules.json', 'data/career-rules.json', 'data/program-rules.json', 'data/axis-lexicon.json'];
const req = p => require(path.join(ROOT, p));
const E = req('assets/js/report-engine.js'), V = req('assets/js/report-engine-v4.js'), R = req('assets/js/response-evidence.js');
const AC = req('assets/js/axis-compose.js'), AM = req('assets/js/asset-map.js'), AP = req('assets/js/asset-path.js'), P = req('assets/js/program-engine.js');
try { global.CareerEngine = req('assets/js/career-engine.js'); } catch (_) {}
const questions = J('data/questions.json'), mapping = J('data/mapping.json'), rules = J('data/report-rules.json'), careerRules = J('data/career-rules.json'), programRules = J('data/program-rules.json'), lexicon = J('data/axis-lexicon.json');

const raw = fs.readFileSync(ANS); const inp = JSON.parse(raw); const answers = Object.assign({}, inp.answers || inp);
// 메타 문항(Q1 이름·Q2 수신) — 채점 미사용. 가상 이름만.
answers.Q1 = nameArg; answers.Q2 = answers.Q2 || 'email';
// 검증: 56문항 모두 응답 + 형식
const qs = questions.sections.flatMap(s => s.questions); const bad = [];
for (const q of qs) { const v = answers[q.id];
  if (q.type === 'likert' && !(Number.isInteger(v) && v >= 1 && v <= 5)) bad.push(q.id + ':likert');
  if (q.type === 'single_choice' && !(q.options.includes(v) || (q.hasOther && v === '기타 (직접 입력)'))) bad.push(q.id + ':single');
  if (q.type === 'multi_choice' && !(Array.isArray(v) && v.length >= 1 && v.length <= (q.max || 99) && v.every(o => q.options.includes(o) || (q.hasOther && o === '기타 (직접 입력)')))) bad.push(q.id + ':multi'); }
if (bad.length) { console.error('invalid answers:', bad.join(' ')); process.exit(4); }

const profile = { name: nameArg, email: '', recvMethod: 'email', submittedAt: Date.parse(inp.ended_utc || '2026-10-20T00:00:00Z') || 0 };
const input = { questions, mapping, rules, careerRules, inputContractVersion: 'input-v2', answers, profile, lang: 'ko' };
let report = E.build(input);
report = V.upgrade(report, input);
if (report.engineVersion !== 'v4.1') throw new Error('v4 not applied: ' + report.engineVersion);
if (!report._responseEvidence || report._responseEvidence.version !== 'evidence-reader-v1') throw new Error('input-v2 evidence missing');
report = R.attachAxes(report, questions, answers, { compose: { engine: AC, lexicon } });
const ap = AP.compose(AM, report, answers); if (ap) report = Object.assign({}, report, { _assetPath: ap });
const program = P.build({ report, rules: programRules, careerRules, mapping, name: nameArg, sourceSid: 'offline-e2-own', publishedAt: new Date(profile.submittedAt || 0), lang: 'ko', axisProgram: true, cardShape: 'rq-01' });

fs.mkdirSync(OUT, { recursive: true });
const w = (f, o) => { const b = Buffer.from(JSON.stringify(o, null, 1)); fs.writeFileSync(path.join(OUT, f), b); return sha(b); };
const meta = { tool: 'own-generate.cjs', tool_sha256: sha(fs.readFileSync(__filename)), at: new Date().toISOString(),
  git_head: cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
  answers_file: path.basename(ANS), answers_sha256: sha(raw), name_used: nameArg,
  engine_files: Object.fromEntries(files.map(f => [f, sha(fs.readFileSync(path.join(ROOT, f)))])),
  engineVersion: report.engineVersion, fingerprint64: report._v4Meta && report._v4Meta.fingerprint64,
  asset_path: !!report._assetPath, asset_type: report._assetPath && report._assetPath.type && report._assetPath.type.name,
  axis_program: !!program._axisProgram, writes: 0, network: 0 };
meta.report_sha256 = w('report.json', report); meta.program_sha256 = w('program.json', program);
fs.writeFileSync(path.join(OUT, 'gen-meta.json'), JSON.stringify(meta, null, 1));
console.log(JSON.stringify({ engineVersion: meta.engineVersion, asset_type: meta.asset_type, axis_program: meta.axis_program, report_sha256: meta.report_sha256, program_sha256: meta.program_sha256 }));
