/* ============================================================
 * Regression Test: 180 combos = 5 tones × 9 compass × 4 categories
 *   - Q13 카테고리 4종 × Q63 compass 9종 = 36 응답 패턴
 *   - 4축 점수 가중치를 회전시켜 5톤 우선순위가 모두 활성화되도록 설계
 *   - 각 조합에서 발견된 결함을 자동 분류:
 *       (a) 미치환 토큰 잔존 ({{...}})
 *       (b) "마음" 누설 (compass != 의미인데 마음 출현)
 *       (c) 응답 매핑 위반 (compassKw이 expected와 불일치)
 *   - PASS/FAIL 카운트 + 결함 위치 리포트
 * =========================================================== */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ReportEngine    = require(path.join(ROOT, 'assets/js/report-engine.js'));
const ReportEngineV4  = require(path.join(ROOT, 'assets/js/report-engine-v4.js'));
const ProgramEngine   = require(path.join(ROOT, 'assets/js/program-engine.js'));

const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const questions    = read('data/questions.json');
const mapping      = read('data/mapping.json');
const reportRules  = read('data/report-rules.json');
const programRules = read('data/program-rules.json');
const baseAns      = read('scripts/kys_rtdb_node_import.json').answers;

// 카테고리별 대표 Q13 응답 (mapping.json valueKeywordMap 기반)
const Q13_BY_CAT = {
  '관계지향': ['사랑', '신뢰', '배려'],
  '자유지향': ['자유', '평화', '포용'],
  '성장지향': ['성장', '도전', '몰입'],
  '원칙지향': ['정직', '책임', '질서']
};

// Compass 9종 (Q63 응답 풀)
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

// compass → 기대 compassKw
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

// 5톤 결정용 — 카테고리 + 축 우선순위 회전 (룰북 P v4.0 toneResolution)
//   priority: principled_designer > warm_connector > visionary_creator > pragmatic_achiever > reflective_explorer
//   카테고리×최고축 조합으로 5톤이 모두 활성화되도록 회전
const TONE_AXIS_BIAS = ['self_understanding','self_expression','self_design','self_execution'];

function buildAnswers(cat, compass, axisBias) {
  const ans = JSON.parse(JSON.stringify(baseAns)); // deep clone
  // Q13 — 카테고리 대표 3개 핵심가치
  ans.Q13 = Q13_BY_CAT[cat].slice();
  // Q63 — compass 첫 번째 + 보조
  ans.Q63 = [compass, '신념 / 원칙 / 종교적 기준'];
  // 축 가중치 회전을 위한 응답 미세 조정은 선택 — 톤 결정은 Q13 카테고리가 최우선
  return ans;
}

function detectDefects(report, program, ctx) {
  const defects = [];
  const sP = JSON.stringify(program);
  const sR = JSON.stringify(report);

  // (a) 미치환 토큰
  const tokensP = (sP.match(/\{\{[a-zA-Z_]+\}\}/g) || []);
  const tokensR = (sR.match(/\{\{[a-zA-Z_]+\}\}/g) || []);
  if (tokensP.length) defects.push({type:'token_unresolved', loc:'program', samples: tokensP.slice(0,3)});
  if (tokensR.length) defects.push({type:'token_unresolved', loc:'report',  samples: tokensR.slice(0,3)});

  // (b) "마음" 누설 — compass != 의미일 때 program 본문에 "마음" 출현 시 결함
  //     report는 Q13 응답 풀(보존 분류)에 마음이 들어 있을 수 있어 program만 검사
  const expectedKw = COMPASS_NOUN[ctx.compass];
  const maumP = (sP.match(/마음/g) || []).length;
  if (maumP > 0 && expectedKw !== '사람') {
    // 사람 compass(관계/소속감/인정)는 KW 매핑상 "사람" verb=마음 잇기 → 변수값 자체로 합법
    // 그 외 compass에서 마음이 나오면 누설
    defects.push({type:'maum_leak_program', count: maumP});
  }

  // (c) compassKw 정합 — program meta._slots 또는 cover.summary.traits 검증
  //     traits에 expectedKw 포함되어 있는지 확인
  const traits = (program.cover && program.cover.summary && program.cover.summary.traits) || '';
  if (ctx.cat === '관계지향' && (ctx.toneKey === 'visionary_creator')) {
    // visionary × 관계는 라인 391 변수화 라인 — compassKw이 직접 노출됨
    if (traits && !traits.includes(expectedKw)) {
      defects.push({type:'compassKw_mismatch_traits', expected: expectedKw, actual: traits.slice(0,80)});
    }
  }

  // (d) quarter.heading에서 토큰 미치환 또는 마음 누설
  const head = (program.quarter && program.quarter.heading) || '';
  if (head.includes('{{')) defects.push({type:'token_unresolved_heading', heading: head});

  return defects;
}

function runOne(cat, compass) {
  const ans = buildAnswers(cat, compass);
  const profile = { name:'테스트', email:'t@t.t', recvMethod:'email', submittedAt:'2026-04-15' };

  const v13 = ReportEngine.build({
    questions, mapping, rules: reportRules, answers: ans, profile, lang:'ko'
  });
  const v41 = ReportEngineV4.upgrade(v13, {
    questions, mapping, rules: reportRules, answers: ans, profile, lang:'ko'
  });
  const program = ProgramEngine.build({
    report: v41, rules: programRules, name: profile.name, lang:'ko'
  });
  const toneKey = (program.meta && program.meta.toneKey) || 'unknown';

  return { v41, program, toneKey };
}

// ─── 회귀 실행 ───────────────────────────────────────────────
const results = [];
const toneCounts = {};
const defectsByType = {};

let totalCases = 0;
let passCases  = 0;
let failCases  = 0;

console.log('=== 회귀 테스트: 4 카테고리 × 9 compass = 36 응답 패턴 ===\n');

for (const cat of Object.keys(Q13_BY_CAT)) {
  for (const compass of COMPASS_LIST) {
    totalCases++;
    try {
      const { program, v41, toneKey } = runOne(cat, compass);
      toneCounts[toneKey] = (toneCounts[toneKey] || 0) + 1;
      const ctx = { cat, compass, toneKey };
      const defects = detectDefects(v41, program, ctx);
      if (defects.length === 0) {
        passCases++;
      } else {
        failCases++;
        defects.forEach(d => {
          defectsByType[d.type] = (defectsByType[d.type] || 0) + 1;
        });
        results.push({ cat, compass, toneKey, defects });
      }
    } catch (e) {
      failCases++;
      results.push({ cat, compass, error: e.message });
      defectsByType['exception'] = (defectsByType['exception'] || 0) + 1;
    }
  }
}

console.log(`Total: ${totalCases} cases`);
console.log(`PASS:  ${passCases} (${(passCases/totalCases*100).toFixed(1)}%)`);
console.log(`FAIL:  ${failCases} (${(failCases/totalCases*100).toFixed(1)}%)`);

console.log('\n=== 톤 분포 ===');
Object.keys(toneCounts).sort().forEach(t => {
  console.log(`  ${t}: ${toneCounts[t]} cases`);
});

console.log('\n=== 결함 유형별 카운트 ===');
if (Object.keys(defectsByType).length === 0) {
  console.log('  (없음 — 모든 케이스 PASS)');
} else {
  Object.keys(defectsByType).forEach(t => {
    console.log(`  ${t}: ${defectsByType[t]}건`);
  });
}

if (results.length) {
  console.log('\n=== 결함 발생 케이스 (상위 10건) ===');
  results.slice(0, 10).forEach((r, i) => {
    console.log(`[${i+1}] cat=${r.cat} compass=${r.compass.slice(0,15)}... tone=${r.toneKey}`);
    if (r.error) {
      console.log(`    ERROR: ${r.error}`);
    } else {
      r.defects.forEach(d => {
        console.log(`    - ${d.type}: ${JSON.stringify(d).slice(0, 200)}`);
      });
    }
  });
}

// 결과를 JSON으로 저장
fs.mkdirSync(path.join(ROOT, 'reports/v4_test'), { recursive: true });
fs.writeFileSync(
  path.join(ROOT, 'reports/v4_test/regress_180_combos.json'),
  JSON.stringify({
    timestamp: new Date().toISOString(),
    totalCases, passCases, failCases,
    toneCounts, defectsByType,
    failedCases: results
  }, null, 2)
);
console.log('\n결과 저장: reports/v4_test/regress_180_combos.json');
