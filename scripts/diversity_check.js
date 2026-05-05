const path = require('path');
const RE = require(path.join(__dirname, '..', 'assets/js/report-engine.js'));
const RE4 = require(path.join(__dirname, '..', 'assets/js/report-engine-v4.js'));
const fs = require('fs');
const root = path.join(__dirname, '..');
const questions = JSON.parse(fs.readFileSync(path.join(root,'data/questions.json'),'utf8'));
const mapping = JSON.parse(fs.readFileSync(path.join(root,'data/mapping.json'),'utf8'));
const rules = JSON.parse(fs.readFileSync(path.join(root,'data/report-rules.json'),'utf8'));
const rtdb = JSON.parse(fs.readFileSync(path.join(root,'scripts/kys_rtdb_node_import.json'),'utf8'));
const ans = rtdb.answers || (rtdb.kys && rtdb.kys.answers);

const cases = [
  ['사랑'],
  ['자유'],
  ['성장'],
  ['책임'],
  ['사랑','신뢰'],
  ['사랑','자유'],
  ['사랑','성장'],
  ['책임','자유'],
  ['사랑','자유','의미 추구'],
  ['신뢰','책임','성장'],
  ['자유','책임','평화'],
  ['사랑','책임','성장','자유']
];

cases.forEach(function(c){
  var ansCopy = JSON.parse(JSON.stringify(ans));
  ansCopy.Q13 = c;
  var profile = { name: '테스트', email: 't@t.t' };
  var v13 = RE.build({questions, mapping, rules, answers: ansCopy, profile, lang: 'ko'});
  var r = RE4.upgrade(v13, {questions, mapping, rules, answers: ansCopy, profile, lang: 'ko'});
  var sumSec = r.sections.find(s=>s.id==='summary');
  var mvSec = r.sections.find(s=>s.id==='mission_vision');
  console.log('━━━ Q13:', JSON.stringify(c), '(fp='+r._v4Meta.fingerprint+') ━━━');
  console.log('  type:', sumSec.content.typeLine);
  console.log('  mission:', mvSec.content.mission);
  console.log('  vision:', mvSec.content.vision);
  console.log();
});
