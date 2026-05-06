#!/usr/bin/env node
/**
 * sim_5persona_career.js — RULE-CAREER v1.1 검증
 * --------------------------------------------------------------
 * 5종 시뮬레이션:
 *   1. 운동선수 (스포츠 × practitioner)
 *   2. 스포츠 사업가 (스포츠 × business)
 *   3. 운동생리 연구자 (스포츠 × researcher) ← 신규 트리거 검증
 *   4. 스포츠 미디어 (스포츠 × media)
 *   5. 스포츠 정책 (스포츠 × policy)
 *
 * 동시에 비-스포츠 영역에서도 researcher 트리거 작동 확인 (의료·교육 추가)
 * --------------------------------------------------------------
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CareerEngine = require(path.join(ROOT, 'assets/js/career-engine.js'));

const careerRules = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/career-rules.json'), 'utf8'));
const mapping = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/mapping.json'), 'utf8'));

// 시뮬레이션 케이스 정의
const PERSONAS = [
  {
    id: 'P1_athlete',
    label: '운동선수',
    answers: {
      Q1: '프로 축구선수',
      Q3: ['체력', '끈기', '실행력'],
      Q13: ['도전', '몰입'],
      Q41: ['스포츠, 건강, 자기관리'],
      Q63: ['결과 / 성과 / 효율성', '재미 / 흥미 / 몰입감'],
      Q75: ['스포츠', '미디어']
    },
    expectedSubType: 'practitioner',
    fingerprint: 1234567
  },
  {
    id: 'P2_sports_business',
    label: '스포츠 사업가',
    answers: {
      Q1: '스포츠 마케팅 회사 대표',
      Q3: ['분석력', '추진력', '리더십'],
      Q13: ['성취', '도전'],
      Q41: ['스포츠, 건강, 자기관리'],
      Q63: ['결과 / 성과 / 효율성', '성장 가능성 / 배움의 기회'],
      Q75: ['스포츠', '경제']
    },
    expectedSubType: 'business',
    fingerprint: 2345678
  },
  {
    id: 'P3_sports_researcher',
    label: '운동생리 연구자',
    answers: {
      Q1: '스포츠과학 박사 연구원',
      Q3: ['통찰력', '학구열', '분석력'],
      Q13: ['성장', '의미 추구'],
      Q41: ['스포츠, 건강, 자기관리'],
      Q63: ['성장 가능성 / 배움의 기회', '의미 / 보람 / 가치'],
      Q75: ['스포츠', '교육']
    },
    expectedSubType: 'researcher',
    fingerprint: 3456789
  },
  {
    id: 'P4_sports_media',
    label: '스포츠 미디어',
    answers: {
      Q1: '스포츠 방송 PD',
      Q3: ['표현력', '창의력', '스토리텔링'],
      Q13: ['창의', '포용'],
      Q41: ['스포츠, 건강, 자기관리'],
      Q63: ['재미 / 흥미 / 몰입감', '의미 / 보람 / 가치'],
      Q75: ['스포츠', '미디어']
    },
    expectedSubType: 'media',
    fingerprint: 4567890
  },
  {
    id: 'P5_sports_policy',
    label: '스포츠 정책 행정',
    answers: {
      Q1: '체육 행정 공무원',
      Q3: ['정직', '책임감', '공정'],
      Q13: ['공정', '책임'],
      Q41: ['스포츠, 건강, 자기관리'],
      Q63: ['신념 / 원칙 / 종교적 기준', '책임 / 도리 / 역할 충실'],
      Q75: ['스포츠', '법률']
    },
    expectedSubType: 'policy',
    fingerprint: 5678901
  },
  // 비-스포츠 researcher 트리거 추가 검증 (의료·교육)
  {
    id: 'P6_medical_researcher',
    label: '의학 연구자',
    answers: {
      Q1: '바이오 R&D 연구원',
      Q3: ['통찰력', '학구열', '객관성'],
      Q13: ['의미 추구', '성장'],
      Q41: ['심리와 감정 탐구'],
      Q63: ['성장 가능성 / 배움의 기회', '의미 / 보람 / 가치'],
      Q75: ['의료', '환경']
    },
    expectedSubType: 'researcher',
    fingerprint: 6789012
  },
  {
    id: 'P7_edu_researcher',
    label: '교육학 연구자',
    answers: {
      Q1: '러닝 사이언스 박사',
      Q3: ['탐구심', '학구열', '분석력'],
      Q13: ['성장', '의미 추구'],
      Q41: ['교육과 학습 방식'],
      Q63: ['성장 가능성 / 배움의 기회', '의미 / 보람 / 가치'],
      Q75: ['교육', '사회']
    },
    expectedSubType: 'researcher',
    fingerprint: 7890123
  }
];

// 실행 + 검증
console.log('═══════════════════════════════════════════════════════════');
console.log('RULE-CAREER v1.1 — 5종 페르소나 시뮬레이션 (+researcher 보강)');
console.log('═══════════════════════════════════════════════════════════\n');
console.log(`CareerEngine version: ${CareerEngine.version}\n`);

const results = [];
let passSubType = 0;
let passDomain = 0;
let passDistinct = 0;
let passEduDuration = 0;
let passAlignment = 0;

PERSONAS.forEach(function (p, idx) {
  const ce = CareerEngine.build(p.answers, mapping, careerRules, p.fingerprint, { lang: 'ko', toneKey: 'reflective_explorer' });

  const subTypeOK = ce.subType === p.expectedSubType;
  const primaryDomainOK = ce.sourceDomains[0] === p.answers.Q75[0];
  const careersDistinct = new Set(ce.careers).size === ce.careers.length;
  const eduDurDistinct = ce.eduDurationDistinct >= 2;
  const alignmentOK = ce.alignmentRatio >= 0.66;

  if (subTypeOK) passSubType++;
  if (primaryDomainOK) passDomain++;
  if (careersDistinct) passDistinct++;
  if (eduDurDistinct) passEduDuration++;
  if (alignmentOK) passAlignment++;

  console.log(`[${idx + 1}/${PERSONAS.length}] ${p.label} (${p.id})`);
  console.log(`  Q1 직무: ${p.answers.Q1}`);
  console.log(`  Q3 강점: ${p.answers.Q3.join(', ')}`);
  console.log(`  Q41 열정: ${p.answers.Q41.join(', ')}`);
  console.log(`  Q75 도메인: ${p.answers.Q75.join(', ')}`);
  console.log(`  → subType: ${ce.subType}  (예상: ${p.expectedSubType}) ${subTypeOK ? '✅' : '❌'}`);
  console.log(`  → subTypeScore: ${JSON.stringify(ce.subTypeScore)}`);
  console.log(`  → subTypeSource: ${ce.subTypeSource}`);
  console.log(`  → careers:`);
  ce.careers.forEach(function (c, i) {
    const src = ce.sources.filter(function (s) { return s.slot === 'careers[' + i + ']'; })[0] || {};
    console.log(`     [${i}] ${c}  (source=${src.source}, aligned=${src.aligned})`);
  });
  console.log(`  → education:`);
  ce.education.forEach(function (e, i) {
    const src = ce.sources.filter(function (s) { return s.slot === 'education[' + i + ']'; })[0] || {};
    console.log(`     [${i}] ${e}  (duration=${src.duration})`);
  });
  console.log(`  → eduDurations: ${ce.eduDurations.join(', ')} (distinct=${ce.eduDurationDistinct}) ${eduDurDistinct ? '✅' : '⚠️'}`);
  console.log(`  → alignmentRatio: ${(ce.alignmentRatio * 100).toFixed(0)}% ${alignmentOK ? '✅' : '⚠️'}`);
  console.log('');

  results.push({
    id: p.id, label: p.label,
    subType: ce.subType, expected: p.expectedSubType, subTypeOK: subTypeOK,
    careers: ce.careers, education: ce.education,
    eduDurations: ce.eduDurations, eduDurationDistinct: ce.eduDurationDistinct,
    alignmentRatio: ce.alignmentRatio, alignmentFlags: ce.alignmentFlags,
    subTypeScore: ce.subTypeScore
  });
});

console.log('═══════════════════════════════════════════════════════════');
console.log('검증 요약');
console.log('═══════════════════════════════════════════════════════════');
const total = PERSONAS.length;
console.log(`subType 정확도:        ${passSubType}/${total} (${(passSubType/total*100).toFixed(1)}%) ${passSubType === total ? '✅' : '⚠️'}`);
console.log(`primaryDomain 정확도:  ${passDomain}/${total} (${(passDomain/total*100).toFixed(1)}%) ${passDomain === total ? '✅' : '⚠️'}`);
console.log(`careers 중복 0:        ${passDistinct}/${total} (${(passDistinct/total*100).toFixed(1)}%) ${passDistinct === total ? '✅' : '⚠️'}`);
console.log(`education 기간 차등:   ${passEduDuration}/${total} (${(passEduDuration/total*100).toFixed(1)}%) ${passEduDuration === total ? '✅' : '⚠️'}`);
console.log(`강점-진로 정렬률 ≥66%: ${passAlignment}/${total} (${(passAlignment/total*100).toFixed(1)}%) ${passAlignment === total ? '✅' : '⚠️'}`);

// subType 5종 활성화 검증
const activatedSubTypes = new Set(results.map(function (r) { return r.subType; }));
console.log(`\nsubType 활성화: ${Array.from(activatedSubTypes).join(', ')} (${activatedSubTypes.size}/5종)`);
console.log(`researcher 활성화: ${activatedSubTypes.has('researcher') ? '✅' : '❌'}`);

// 결과 저장
const outPath = path.join(ROOT, 'reports/v4_test/sim_5persona_career.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify({
  engine: CareerEngine.version,
  total: total,
  pass: { subType: passSubType, domain: passDomain, distinct: passDistinct, eduDuration: passEduDuration, alignment: passAlignment },
  activatedSubTypes: Array.from(activatedSubTypes),
  results: results
}, null, 2));
console.log(`\n결과 저장: ${path.relative(ROOT, outPath)}`);

// 게이트
const overallPass = passSubType === total && passDomain === total && passDistinct === total &&
                    passEduDuration >= total - 1 && passAlignment >= total - 1 &&
                    activatedSubTypes.has('researcher');
console.log(`\n${overallPass ? '✅ 5종 시뮬레이션 게이트 통과' : '❌ 게이트 미통과 — 추가 조정 필요'}`);
process.exit(overallPass ? 0 : 1);
