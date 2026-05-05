// 프랭클린식 ④ Compass(Q63) 다양성 검증
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

// Q13(가치) × Q63(Compass) 교차 검증
const cases = [
  { q13: ['사랑'],          q63: ['관계 / 소속감 / 인정'] },
  { q13: ['자유'],          q63: ['자유 / 자율성'] },
  { q13: ['성장'],          q63: ['성장 가능성 / 배움의 기회'] },
  { q13: ['책임'],          q63: ['책임 / 도리 / 역할 충실'] },
  { q13: ['사랑','자유'],   q63: ['의미 / 보람 / 가치'] },
  { q13: ['사랑','자유'],   q63: ['신념 / 원칙 / 종교적 기준'] },
  { q13: ['책임','자유'],   q63: ['결과 / 성과 / 효율성'] },
  { q13: ['신뢰','책임','성장'], q63: ['안정성 / 안전 / 예측 가능성'] },
  { q13: ['자유','평화'],   q63: ['재미 / 흥미 / 몰입감'] },
  { q13: ['사랑','자유','의미 추구'], q63: ['의미 / 보람 / 가치'] }
];

cases.forEach(function(c){
  var ansCopy = JSON.parse(JSON.stringify(ans));
  ansCopy.Q13 = c.q13;
  ansCopy.Q63 = c.q63;
  var profile = { name: '테스트', email: 't@t.t' };
  var v13 = RE.build({questions, mapping, rules, answers: ansCopy, profile, lang: 'ko'});
  var r = RE4.upgrade(v13, {questions, mapping, rules, answers: ansCopy, profile, lang: 'ko'});
  var mvSec = r.sections.find(s=>s.id==='mission_vision');
  console.log('━━━ Q13:', JSON.stringify(c.q13), '× Q63:', JSON.stringify(c.q63), '━━━');
  console.log('  [① Headline]', mvSec.content.headline);
  console.log('  [② Subline ]', mvSec.content.subline);
  console.log('  [③ Diary M ]', mvSec.content.diaryMission);
  console.log('  [③ Diary V ]', mvSec.content.diaryVision);
  console.log('  [aux Mission]', mvSec.content.mission);
  console.log('  [aux Vision ]', mvSec.content.vision);
  console.log();
});
