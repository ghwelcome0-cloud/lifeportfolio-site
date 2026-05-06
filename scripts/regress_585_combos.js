/* ============================================================
 * Regression Test: 585 combos = 13 domains × 5 tones × 9 compass
 *   - PR#63 RULE-CAREER v1.0 (옵션 ②) 검증
 *   - 13대 영역 × 5 subType × 3축 결합 매트릭스 + 옵션 A 보존 6곳
 *
 * 검증 항목:
 *   (a) 미치환 토큰 잔존 ({{...}})
 *   (b) "마음" 누설 (compass != 사람인데 program 본문 출현)
 *   (c) careers 3개 중복 없음 (RULE-PROGRAM P5)
 *   (d) education 3개 중복 없음
 *   (e) careers·education이 도메인 풀에 매핑되어 있는지 (3축 결합 검증)
 *   (f) quarter.heading 토큰 미치환
 *   (g) subType이 5종 중 1개로 정확히 분류되는지
 * =========================================================== */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ReportEngine    = require(path.join(ROOT, 'assets/js/report-engine.js'));
const ReportEngineV4  = require(path.join(ROOT, 'assets/js/report-engine-v4.js'));
const ProgramEngine   = require(path.join(ROOT, 'assets/js/program-engine.js'));
const CareerEngine    = require(path.join(ROOT, 'assets/js/career-engine.js'));

const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const questions    = read('data/questions.json');
const mapping      = read('data/mapping.json');
const reportRules  = read('data/report-rules.json');
const programRules = read('data/program-rules.json');
const careerRules  = read('data/career-rules.json');
const baseAns      = read('scripts/kys_rtdb_node_import.json').answers;

// ─── 13대 영역 (Q75 도메인) ─────────────────────────────────
const DOMAINS_13 = [
  '정치','경제','사회','문화','교육','의료','복지','환경','예술','미디어','스포츠','법률','종교'
];

// ─── 5톤 활성화를 위한 카테고리 → Q13 응답 매핑 ──────────────
//   톤 결정은 Q13 카테고리 + 4축 가중치 조합. 카테고리 4종 × 축 회전으로 5톤 모두 활성.
const TONE_PROFILES = {
  principled_designer: { cat:'원칙지향', q13:['정직','책임','질서'],   axisBias:'self_design' },
  warm_connector:      { cat:'관계지향', q13:['사랑','신뢰','배려'],   axisBias:'self_expression' },
  visionary_creator:   { cat:'관계지향', q13:['사랑','자유','의미 추구'], axisBias:'self_design' },
  pragmatic_achiever:  { cat:'성장지향', q13:['성장','도전','성취'],   axisBias:'self_execution' },
  reflective_explorer: { cat:'자유지향', q13:['자유','평화','포용'],   axisBias:'self_understanding' }
};

// ─── 9 Compass (Q63 응답 풀) ─────────────────────────────────
const COMPASS_LIST = [
  '의미 / 보람 / 가치',
  '안정성 / 안전 / 예측 가능성',
  '성장 가능성 / 배움의 기회',
  '자유 / 자율성',
  '관계 / 소속감 / 인정',
  '결과 / 성과 / 효율성',
  '재미 / 흥미 / 몰입감',
  '신념 / 원칙 / 종교적 기준',
  '책임 / 도리 / 역할 충실'
];

const COMPASS_NOUN = {
  '의미 / 보람 / 가치':           '의미',
  '안정성 / 안전 / 예측 가능성':  '단단함',
  '성장 가능성 / 배움의 기회':    '배움',
  '자유 / 자율성':                '자기 호흡',
  '관계 / 소속감 / 인정':         '사람',
  '결과 / 성과 / 효율성':         '결과',
  '재미 / 흥미 / 몰입감':         '몰입',
  '신념 / 원칙 / 종교적 기준':    '원칙',
  '책임 / 도리 / 역할 충실':      '책임'
};

// ─── 톤별 축 점수 셋업 (Q*** likert 응답 조정) ────────────────
//   톤 결정 로직: Q13 카테고리 (1차) + 최고 축 (2차)
//   축 가중치는 likert 점수의 합으로 계산되므로 baseAns의 likert를 톤별로 조정
function applyAxisBias(ans, axisBias) {
  // self_understanding/expression/design/execution 축에 매핑된 문항 일부를 5점으로 강화
  // questions.json의 axes 매핑 대신 단순 휴리스틱: Q ID 범위로 분배
  const out = JSON.parse(JSON.stringify(ans));
  // 균등화: 모든 likert 응답을 3점으로 초기화
  Object.keys(out).forEach(k => {
    if (typeof out[k] === 'number' || /^[1-5]$/.test(out[k])) {
      out[k] = 3;
    }
  });
  // 축별 강화 ID (mapping.json의 axes 가져오기)
  const AXIS_QIDS = {
    self_understanding: ['Q9','Q11','Q14','Q15','Q16','Q17','Q18','Q19'],
    self_expression:    ['Q21','Q22','Q23','Q25','Q27','Q29','Q31'],
    self_design:        ['Q33','Q35','Q37','Q39','Q43','Q45','Q47'],
    self_execution:     ['Q49','Q51','Q53','Q55','Q57','Q59','Q61','Q67','Q69','Q71']
  };
  (AXIS_QIDS[axisBias] || []).forEach(qid => { out[qid] = 5; });
  return out;
}

// ─── 응답 빌더 ───────────────────────────────────────────────
function buildAnswers(domain, toneTarget, compass) {
  const ans = JSON.parse(JSON.stringify(baseAns));
  const tp = TONE_PROFILES[toneTarget];

  // Q13 — 톤별 카테고리 대표 가치
  ans.Q13 = tp.q13.slice();
  // Q63 — compass 첫 번째 + 보조
  ans.Q63 = [compass, '신념 / 원칙 / 종교적 기준'];
  // Q75 — primaryDomain 단일 + 보조 (자기 자신은 제외)
  const secondary = DOMAINS_13.find(d => d !== domain) || '경제';
  ans.Q75 = [domain, secondary, '교육'];
  // Q41 — 도메인과 무관하지 않은 열정 주제 회전
  const PASSION_BY_DOMAIN = {
    '정치':'사회 문제나 정의 이슈', '경제':'경제, 금융, 투자', '사회':'사회 문제나 정의 이슈',
    '문화':'예술, 창작, 문화 콘텐츠', '교육':'교육과 학습 방식', '의료':'심리와 감정 탐구',
    '복지':'리더십, 공동체, 관계', '환경':'환경과 생태', '예술':'예술, 창작, 문화 콘텐츠',
    '미디어':'예술, 창작, 문화 콘텐츠', '스포츠':'스포츠, 건강, 자기관리',
    '법률':'사회 문제나 정의 이슈', '종교':'철학, 종교, 영성'
  };
  ans.Q41 = PASSION_BY_DOMAIN[domain] || '리더십, 공동체, 관계';

  // 축 가중치 회전
  return applyAxisBias(ans, tp.axisBias);
}

// ─── 결함 검증 ───────────────────────────────────────────────
function detectDefects(report, program, ctx, ceDirect) {
  const defects = [];
  const sP = JSON.stringify(program);
  const sR = JSON.stringify(report);

  // (a) 미치환 토큰
  const tokensP = (sP.match(/\{\{[a-zA-Z_]+\}\}/g) || []);
  const tokensR = (sR.match(/\{\{[a-zA-Z_]+\}\}/g) || []);
  if (tokensP.length) defects.push({type:'token_unresolved_program', samples: tokensP.slice(0,3)});
  if (tokensR.length) defects.push({type:'token_unresolved_report',  samples: tokensR.slice(0,3)});

  // (b) "마음" 누설 — compass != 사람일 때 program 본문에 등장 시
  //   옵션 A 보존 6곳은 warm_connector 톤에서만 활성화되므로 그 외 톤에서는 0건이어야 함
  const expectedKw = COMPASS_NOUN[ctx.compass];
  const maumP = (sP.match(/마음/g) || []).length;
  if (maumP > 0 && expectedKw !== '사람' && ctx.toneKey !== 'warm_connector') {
    defects.push({type:'maum_leak_nonwarm', count: maumP, tone: ctx.toneKey});
  }

  // (c) careers 3개 중복 없음
  const careers = (ceDirect && ceDirect.careers) || [];
  if (careers.length < 3) {
    defects.push({type:'careers_count_short', count: careers.length});
  }
  if (new Set(careers).size !== careers.length) {
    defects.push({type:'careers_duplicate', careers});
  }

  // (d) education 3개 중복 없음
  const education = (ceDirect && ceDirect.education) || [];
  if (education.length < 3) {
    defects.push({type:'education_count_short', count: education.length});
  }
  if (new Set(education).size !== education.length) {
    defects.push({type:'education_duplicate', education});
  }

  // (e) careers 중 적어도 1개는 primaryDomain 풀에서 산출되어야 함 (3축 결합 검증)
  const pool = (careerRules.domainPools || {})[ctx.domain];
  if (pool) {
    const allDomainCareers = [];
    Object.keys(pool).forEach(st => {
      (pool[st].careers || []).forEach(c => allDomainCareers.push(c));
    });
    const fromDomain = careers.filter(c => allDomainCareers.includes(c));
    // 융합형은 "primaryDomain·secondaryDomain" 접두사 가짐
    const fusion = careers.filter(c => c && c.indexOf(ctx.domain + '·') === 0);
    if (fromDomain.length === 0 && fusion.length === 0) {
      defects.push({type:'careers_not_from_domain', domain: ctx.domain, careers, sample: allDomainCareers.slice(0,3)});
    }
  }

  // (f) quarter.heading 토큰 미치환
  const head = (program.quarter && program.quarter.heading) || '';
  if (head.includes('{{')) defects.push({type:'token_unresolved_heading', heading: head});

  // (g) subType 5종 중 1개로 분류
  const validSubTypes = ['practitioner','researcher','business','media','policy'];
  if (!ceDirect || !ceDirect.subType || validSubTypes.indexOf(ceDirect.subType) === -1) {
    defects.push({type:'subtype_invalid', subType: ceDirect && ceDirect.subType});
  }

  return defects;
}

// ─── fingerprint 계산 (report-engine과 동일 알고리즘) ─────────
function answerFingerprint(answers) {
  let h = 0;
  // likert 점수
  Object.keys(answers).forEach((qid, idx) => {
    const v = answers[qid];
    if (v == null || v === '') return;
    const num = (typeof v === 'number') ? v : parseInt(v, 10);
    if (isFinite(num) && num >= 1 && num <= 5) {
      h = (h * 31 + num * (idx + 1)) | 0;
    }
  });
  // choice 응답
  ['Q1','Q3','Q6','Q13','Q41','Q73','Q75'].forEach((qid, ci) => {
    const arr = Array.isArray(answers[qid]) ? answers[qid] : (answers[qid] != null ? [answers[qid]] : []);
    arr.forEach((opt, oi) => {
      const s = String(opt || '').trim();
      for (let i = 0; i < s.length; i++) {
        h = (h * 33 + s.charCodeAt(i) + (ci+1)*7 + oi) | 0;
      }
    });
  });
  return Math.abs(h);
}

// ─── 단일 케이스 실행 ───────────────────────────────────────
function runOne(domain, toneTarget, compass) {
  const ans = buildAnswers(domain, toneTarget, compass);
  const profile = { name:'테스트', email:'t@t.t', recvMethod:'email', submittedAt:'2026-04-15' };

  const v13 = ReportEngine.build({
    questions, mapping, rules: reportRules, answers: ans, profile, lang:'ko', careerRules
  });
  const v41 = ReportEngineV4.upgrade(v13, {
    questions, mapping, rules: reportRules, answers: ans, profile, lang:'ko', careerRules
  });
  const program = ProgramEngine.build({
    report: v41, rules: programRules, name: profile.name, lang:'ko'
  });

  // CareerEngine 결과 직접 호출 (subType, sources 메타 포함)
  const fp = answerFingerprint(ans);
  const ceDirect = CareerEngine.build(ans, mapping, careerRules, fp, {
    lang: 'ko',
    toneKey: (program.meta && program.meta.toneKey) || 'reflective_explorer'
  });

  return { v41, program, ceDirect, toneKey: (program.meta && program.meta.toneKey) || 'unknown' };
}

// ─── 회귀 실행 ────────────────────────────────────────────────
const results = [];
const toneCounts = {};
const subTypeCounts = {};
const defectsByType = {};
const careersByDomain = {}; // 도메인별 careers 다양성 측정

let totalCases = 0;
let passCases  = 0;
let failCases  = 0;

console.log('=== 회귀 테스트: 13 도메인 × 5 톤 × 9 compass = 585 케이스 ===\n');

for (const domain of DOMAINS_13) {
  careersByDomain[domain] = new Set();
  for (const toneTarget of Object.keys(TONE_PROFILES)) {
    for (const compass of COMPASS_LIST) {
      totalCases++;
      try {
        const { program, v41, ceDirect, toneKey } = runOne(domain, toneTarget, compass);
        toneCounts[toneKey] = (toneCounts[toneKey] || 0) + 1;
        subTypeCounts[ceDirect.subType] = (subTypeCounts[ceDirect.subType] || 0) + 1;

        // careers 다양성 수집
        (ceDirect.careers || []).forEach(c => careersByDomain[domain].add(c));

        const ctx = { domain, toneTarget, toneKey, compass };
        const defects = detectDefects(v41, program, ctx, ceDirect);
        if (defects.length === 0) {
          passCases++;
        } else {
          failCases++;
          defects.forEach(d => {
            defectsByType[d.type] = (defectsByType[d.type] || 0) + 1;
          });
          results.push({ domain, toneTarget, toneKey, compass, defects, careers: ceDirect.careers });
        }
      } catch (e) {
        failCases++;
        results.push({ domain, toneTarget, compass, error: e.message });
        defectsByType['exception'] = (defectsByType['exception'] || 0) + 1;
      }
    }
  }
}

// ─── 리포트 출력 ───────────────────────────────────────────────
const passRate = (passCases/totalCases*100).toFixed(1);
console.log(`Total: ${totalCases} cases`);
console.log(`PASS:  ${passCases} (${passRate}%)`);
console.log(`FAIL:  ${failCases} (${(failCases/totalCases*100).toFixed(1)}%)`);

console.log('\n=== 톤 분포 (실제 활성 톤 기준) ===');
Object.keys(toneCounts).sort().forEach(t => {
  console.log(`  ${t}: ${toneCounts[t]} cases`);
});

console.log('\n=== subType 분포 (5종) ===');
['practitioner','researcher','business','media','policy'].forEach(st => {
  console.log(`  ${st}: ${subTypeCounts[st] || 0} cases`);
});

console.log('\n=== 도메인별 careers 다양성 (distinct/expected_max=15) ===');
DOMAINS_13.forEach(d => {
  const distinct = careersByDomain[d].size;
  const ratio = (distinct / 20 * 100).toFixed(0);
  console.log(`  ${d}: ${distinct} distinct careers (${ratio}% of 20 unique pool)`);
});

console.log('\n=== 결함 유형별 카운트 ===');
if (Object.keys(defectsByType).length === 0) {
  console.log('  (없음 — 모든 케이스 PASS)');
} else {
  Object.keys(defectsByType).sort().forEach(t => {
    console.log(`  ${t}: ${defectsByType[t]}건`);
  });
}

if (results.length) {
  console.log('\n=== 결함 발생 케이스 (상위 15건) ===');
  results.slice(0, 15).forEach((r, i) => {
    console.log(`[${i+1}] domain=${r.domain} tone=${r.toneTarget}→${r.toneKey} compass=${(r.compass||'').slice(0,15)}...`);
    if (r.error) {
      console.log(`    ERROR: ${r.error}`);
    } else {
      r.defects.forEach(d => {
        console.log(`    - ${d.type}: ${JSON.stringify(d).slice(0, 200)}`);
      });
      if (r.careers) {
        console.log(`    careers: ${JSON.stringify(r.careers)}`);
      }
    }
  });
}

// 결과 저장
const outDir = path.join(ROOT, 'reports/v4_test');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'regress_585_combos.json'), JSON.stringify({
  total: totalCases, pass: passCases, fail: failCases, passRate,
  toneCounts, subTypeCounts,
  domainDiversity: Object.fromEntries(DOMAINS_13.map(d => [d, careersByDomain[d].size])),
  defectsByType,
  failures: results
}, null, 2));

console.log('\n결과 저장: reports/v4_test/regress_585_combos.json');

// ─── PASS율 ≥ 95% 게이트 ───────────────────────────────────
const PASS_THRESHOLD = 95;
if (parseFloat(passRate) >= PASS_THRESHOLD) {
  console.log(`\n✅ PASS율 ${passRate}% ≥ ${PASS_THRESHOLD}% — 게이트 통과`);
  process.exit(0);
} else {
  console.log(`\n⚠️ PASS율 ${passRate}% < ${PASS_THRESHOLD}% — 게이트 미달, 개선 필요`);
  process.exit(1);
}
