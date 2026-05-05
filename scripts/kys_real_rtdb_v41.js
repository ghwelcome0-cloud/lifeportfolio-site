// scripts/kys_real_rtdb_v41.js
// 실제 RTDB import 데이터(scripts/kys_rtdb_node_import.json)로 v4.1 엔진을 재실행
// → production PDF와 1:1 비교용 ground-truth 산출
//
// 사용: node scripts/kys_real_rtdb_v41.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ── 의존 자산 로드 (production parity 확인된 자산과 동일)
const repoRoot = path.resolve(__dirname, '..');
const questions = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/questions.json'), 'utf8'));
const mapping   = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/mapping.json'), 'utf8'));
const rules     = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/report-rules.json'), 'utf8'));

// 실제 RTDB 데이터 (사이트 저장본)
const rtdb = JSON.parse(fs.readFileSync(path.join(repoRoot, 'scripts/kys_rtdb_node_import.json'), 'utf8'));
const realAnswers = rtdb.answers;
const realProfile = {
  name: rtdb.name || '김영식',
  email: rtdb.email || '',
  recvMethod: rtdb.recvMethod || '이메일',
  submittedAt: rtdb.submittedAtMs || Date.now()
};

// ── UMD 모듈 직접 require (module.exports 지원)
const ReportEngine   = require(path.join(repoRoot, 'assets/js/report-engine.js'));
const ReportEngineV4 = require(path.join(repoRoot, 'assets/js/report-engine-v4.js'));

if (!ReportEngine || !ReportEngineV4) {
  console.error('Engine load failed', { RE: !!ReportEngine, RE4: !!ReportEngineV4 });
  process.exit(1);
}

console.log('=== Engine ===');
console.log('  ReportEngine v1.3 base loaded');
console.log('  ReportEngineV4 version =', ReportEngineV4.version);
console.log('  Real RTDB answers count =', Object.keys(realAnswers).length);
console.log();

// ── 1) v1.3 raw build
const rawReport = ReportEngine.build({
  questions, mapping, rules,
  answers: realAnswers,
  profile: realProfile,
  lang: 'ko'
});

console.log('=== v1.3 RAW (REAL DATA) ===');
console.log('  engineVersion =', rawReport.engineVersion || 'v1.3');
console.log('  rulesVersion  =', rawReport.version);
console.log('  tone.key      =', rawReport.tone && rawReport.tone.key);
console.log('  tone.label    =', rawReport.tone && rawReport.tone.label);
const axisSec = ['self_understanding','self_expression','self_design','self_execution'].map(id => {
  const s = rawReport.sections.find(s => s.id === id);
  return { id, pct: s && s.content && s.content.pct };
});
console.log('  4축 점수      =', axisSec.map(s => `${s.id}=${s.pct}%`).join(' / '));

const rawGrowth = rawReport.sections.find(s => s.id === 'growth_map');
console.log('  강점 TOP3 (raw):');
(rawGrowth.content.strengths || []).forEach((x, i) => console.log(`    ${i+1}. ${x}`));

const rawCE = rawReport.sections.find(s => s.id === 'career_education');
console.log('  진로 TOP3 (raw):');
(rawCE.content.careers || []).forEach((x, i) => console.log(`    ${i+1}. ${x}`));
console.log('  교육 TOP3 (raw):');
(rawCE.content.education || []).forEach((x, i) => console.log(`    ${i+1}. ${x}`));
console.log('  방향 TOP3 (raw):');
(rawCE.content.directions || []).forEach((x, i) => console.log(`    ${i+1}. ${x}`));

const rawMV = rawReport.sections.find(s => s.id === 'mission_vision');
console.log('  사명 (raw):', rawMV.content.mission);
console.log('  비전 (raw):', rawMV.content.vision);
console.log();

// ── 2) v4.1 upgrade 적용
let upgraded;
try {
  upgraded = ReportEngineV4.upgrade(rawReport, {
    questions, mapping, rules,
    answers: realAnswers,
    profile: realProfile,
    lang: 'ko'
  });
} catch (e) {
  console.error('v4 upgrade failed:', e);
  process.exit(2);
}

console.log('=== v4.1 UPGRADED (REAL DATA) ===');
console.log('  engineVersion =', upgraded.engineVersion);
console.log('  fingerprint   =', upgraded._v4Meta && upgraded._v4Meta.fingerprint);
console.log('  generatedAt   =', upgraded._v4Meta && upgraded._v4Meta.generatedAt);
const tr = upgraded._v4Meta && upgraded._v4Meta.toneResolution;
if (tr) {
  console.log('  toneResolution: topAxis=' + tr.topAxis + ' / value=' + (tr.value || tr.values || '?') + ' / chosen=' + tr.toneKey);
}
console.log('  tone.key      =', upgraded.tone && upgraded.tone.key);

const ugAxis = ['self_understanding','self_expression','self_design','self_execution'].map(id => {
  const s = upgraded.sections.find(s => s.id === id);
  return { id, pct: s && s.content && s.content.pct, tier: s && s.content && s.content.tier, tierLabel: s && s.content && s.content.tierLabel };
});
console.log('  4축 점수+티어:');
ugAxis.forEach(a => console.log(`    ${a.id}: ${a.pct}% [${a.tier || '-'}] ${a.tierLabel || ''}`));

const ugGrowth = upgraded.sections.find(s => s.id === 'growth_map');
console.log('  강점 TOP3 (v4.1):');
(ugGrowth.content.strengths || []).forEach((x, i) => console.log(`    ${i+1}. ${x}`));

const ugCE = upgraded.sections.find(s => s.id === 'career_education');
console.log('  진로 TOP3 (v4.1):');
(ugCE.content.careers || []).forEach((x, i) => console.log(`    ${i+1}. ${x}`));
console.log('  교육 TOP3 (v4.1):');
(ugCE.content.education || []).forEach((x, i) => console.log(`    ${i+1}. ${x}`));
console.log('  방향 TOP3 (v4.1):');
(ugCE.content.directions || []).forEach((x, i) => console.log(`    ${i+1}. ${x}`));
if (ugCE.content.domainExpansion) {
  const de = ugCE.content.domainExpansion;
  console.log('  도메인 확장: ' + (de.primary || '?') + ' → ' + (de.secondary || '?') + ' (path=' + (de.pathLine || '').slice(0, 50) + '...)');
}

const ugMV = upgraded.sections.find(s => s.id === 'mission_vision');
console.log('  사명 (v4.1):', ugMV.content.mission);
console.log('  비전 (v4.1):', ugMV.content.vision);
if (ugMV.content._slots) {
  console.log('  사명 슬롯:', JSON.stringify(ugMV.content._slots));
}
console.log();

// ── 3) QA 검증
const qa = ReportEngineV4.validateReport(upgraded);
console.log('=== QA (REAL DATA) ===');
console.log('  passed/total =', qa.passed + '/' + qa.total);
console.log('  score        =', qa.score);
qa.checks.forEach(c => console.log(`    ${c.ok ? '✅' : '❌'} [${c.id}] ${c.label}${c.detail ? ' — ' + c.detail : ''}`));
console.log();

// ── 4) 결과 저장
const outDir = path.join(repoRoot, 'reports/v4_test');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'kys_real_v13_raw.json'), JSON.stringify(rawReport, null, 2));
fs.writeFileSync(path.join(outDir, 'kys_real_v41_upgraded.json'), JSON.stringify(upgraded, null, 2));
fs.writeFileSync(path.join(outDir, 'kys_real_v41_qa.json'), JSON.stringify(qa, null, 2));

// ── 5) Production PDF와 비교 요약
console.log('=== PRODUCTION PDF vs v4.1 (REAL DATA) — 1:1 비교 ===');
const PROD = {
  axis:    { self_understanding: 97, self_expression: 87, self_design: 96, self_execution: 96 },
  tone:    'warm_connector(공감형 연결자)',
  domain:  '경제 → 교육 (부업·연구)',
  careers: ['경제·재무 전략가', '투자 전문가', '교육 설계자'],
  education: ['자기성장·리더십 워크숍', '비폭력 커뮤니케이션 훈련', '공동체 리더십 워크숍'],
  strengths: [
    '숙고된 분석으로 결정을 무리없이 하는 사고력',
    '분석적 통찰과 성취 지향이 결합된 결과형 전략력',
    '분석적 사고로 본질을 꿰뚫는 통찰력'
  ],
  tierLabels: false
};

console.log('| 항목 | Production PDF | v4.1 (REAL) | 일치 |');
ugAxis.forEach(a => {
  console.log(`| ${a.id} | ${PROD.axis[a.id]}% | ${a.pct}% | ${PROD.axis[a.id] === a.pct ? '✅' : '❌'} |`);
});
console.log('| tier 라벨 | (없음) | ' + ugAxis.map(a => a.tier).join('/') + ' | ' + (ugAxis[0].tier ? '❌(v4 적용시 추가됨)' : '—') + ' |');

console.log('\n결과 저장:');
console.log('  reports/v4_test/kys_real_v13_raw.json');
console.log('  reports/v4_test/kys_real_v41_upgraded.json');
console.log('  reports/v4_test/kys_real_v41_qa.json');
