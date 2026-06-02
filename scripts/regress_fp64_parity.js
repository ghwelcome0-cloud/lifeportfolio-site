/* ============================================================
 * 회귀 검증: fingerprint64 추가가 기존 리포트 출력에 0 영향임을 증명
 *
 * 방법:
 *   1) 585 조합(13도메인 × 5톤 × 9나침반)으로 v4 리포트 생성
 *   2) 각 리포트에서 _v4Meta.fingerprint64 만 제거한 뒤
 *      "변경 후 엔진" 산출물끼리 결정성(동일 입력 → 동일 출력) 확인
 *   3) baseline(git 변경 전 엔진) 산출물과 전체 JSON 비교
 *      - fingerprint64 / generatedAt 제외 후 deep-equal
 *      - 단 1개라도 불일치 시 FAIL
 *
 * baseline 생성:
 *   git stash 로 변경 되돌린 상태에서 `--mode=baseline` 실행 → /tmp 에 저장
 *   변경 복원 후 `--mode=compare` 실행 → baseline 과 비교
 * =========================================================== */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ReportEngine   = require(path.join(ROOT, 'assets/js/report-engine.js'));
const ReportEngineV4 = require(path.join(ROOT, 'assets/js/report-engine-v4.js'));

const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const questions   = read('data/questions.json');
const mapping     = read('data/mapping.json');
const reportRules = read('data/report-rules.json');
const baseAns     = read('scripts/kys_rtdb_node_import.json').answers;

const DOMAINS_13 = ['정치','경제','사회','문화','교육','의료','복지','환경','예술','미디어','스포츠','법률','종교'];
const TONE_PROFILES = {
  principled_designer: { q13:['정직','책임','질서'] },
  warm_connector:      { q13:['사랑','신뢰','배려'] },
  visionary_creator:   { q13:['사랑','자유','의미 추구'] },
  pragmatic_achiever:  { q13:['성장','도전','성취'] },
  reflective_explorer: { q13:['자유','평화','포용'] }
};
const COMPASS_LIST = [
  '의미 / 보람 / 가치','안정성 / 안전 / 예측 가능성','성장 가능성 / 배움의 기회',
  '자유 / 자율성','관계 / 소속감 / 인정','결과 / 성과 / 효율성',
  '재미 / 흥미 / 몰입감','신념 / 원칙 / 종교적 기준','책임 / 도리 / 역할 충실'
];

function buildAnswers(domain, toneKey, compass){
  const a = JSON.parse(JSON.stringify(baseAns));
  a.Q75 = [domain];
  a.Q13 = TONE_PROFILES[toneKey].q13.slice();
  a.Q63 = [compass];
  return a;
}

function genReport(answers, lang){
  const raw = ReportEngine.build({ questions, mapping, rules: reportRules, answers, profile:{ name:'검증' }, lang });
  const r = ReportEngineV4.upgrade(raw, { questions, mapping, rules: reportRules, answers, profile:{ name:'검증' }, lang });
  return r;
}

// 비교에서 제외할 (의도된 차이) 키 — 모든 위치의 generatedAt + fingerprint64 제거
function stripVolatile(report){
  const c = JSON.parse(JSON.stringify(report));
  (function walk(o){
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.forEach(walk); return; }
    if ('generatedAt' in o)   delete o.generatedAt;   // 타임스탬프 (항상 다름)
    if ('fingerprint64' in o) delete o.fingerprint64; // 이번에 추가된 신규 식별자
    Object.keys(o).forEach(k => walk(o[k]));
  })(c);
  return c;
}

function allCombos(){
  const out = [];
  for (const d of DOMAINS_13)
    for (const t of Object.keys(TONE_PROFILES))
      for (const c of COMPASS_LIST)
        out.push({ d, t, c });
  return out;
}

const mode = (process.argv.find(x => x.startsWith('--mode=')) || '--mode=compare').split('=')[1];
const BASELINE_PATH = '/tmp/fp64_baseline.json';

if (mode === 'baseline'){
  const map = {};
  for (const lang of ['ko','en']){
    for (const { d, t, c } of allCombos()){
      const key = `${lang}|${d}|${t}|${c}`;
      map[key] = stripVolatile(genReport(buildAnswers(d, t, c), lang));
    }
  }
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(map));
  console.log(`[baseline] ${Object.keys(map).length} combos 저장 → ${BASELINE_PATH}`);
  process.exit(0);
}

// ─── compare 모드 ───
if (!fs.existsSync(BASELINE_PATH)){
  console.error('❌ baseline 없음. 먼저 변경 되돌린 상태에서 --mode=baseline 실행 필요.');
  process.exit(2);
}
const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));

let total = 0, mismatch = 0, fp64Empty = 0, fp64Set = 0, det = 0, detFail = 0;
// fingerprint64 는 응답(answers)만의 함수 → 언어와 무관. 고유성 측정은 '입력 조합' 단위로 한다.
const fp64ByInput = new Set();    // 서로 다른 입력(d|t|c)에서 본 fp64
const inputSeen = new Set();
let fp64Dup = 0;
let langConsistencyFail = 0;      // ko/en 같은 입력은 fp64 동일해야 함
const fp64ForInput = {};
const examples = [];

for (const lang of ['ko','en']){
  for (const { d, t, c } of allCombos()){
    const key = `${lang}|${d}|${t}|${c}`;
    const inputKey = `${d}|${t}|${c}`;
    const answers = buildAnswers(d, t, c);
    const r1 = genReport(answers, lang);
    const r2 = genReport(answers, lang); // 결정성 확인용 재생성
    total++;

    // (1) fingerprint64 생성 확인 + 입력 단위 고유성
    const fp64 = r1._v4Meta && r1._v4Meta.fingerprint64;
    if (fp64 && /^[0-9a-f]{16}$/.test(fp64)) {
      fp64Set++;
      // 언어 일관성: 같은 입력은 언어 무관 동일 fp64
      if (fp64ForInput[inputKey] === undefined) fp64ForInput[inputKey] = fp64;
      else if (fp64ForInput[inputKey] !== fp64) langConsistencyFail++;
      // 입력 단위 고유성(서로 다른 입력 조합 → 서로 다른 fp64)
      if (!inputSeen.has(inputKey)) {
        inputSeen.add(inputKey);
        if (fp64ByInput.has(fp64)) fp64Dup++; else fp64ByInput.add(fp64);
      }
    }
    else fp64Empty++;

    // (2) 결정성: 같은 응답 → 같은 fingerprint64 & 같은 콘텐츠
    if (fp64 !== (r2._v4Meta && r2._v4Meta.fingerprint64)) detFail++;
    if (JSON.stringify(stripVolatile(r1)) === JSON.stringify(stripVolatile(r2))) det++; else detFail++;

    // (3) baseline 과 콘텐츠 비교 (fingerprint64/generatedAt 제외)
    const after = JSON.stringify(stripVolatile(r1));
    const before = JSON.stringify(baseline[key]);
    if (before !== after){
      mismatch++;
      if (examples.length < 5) examples.push(key);
    }
  }
}

console.log('═══════════════════════════════════════════════');
console.log('  fingerprint64 회귀 검증 결과');
console.log('═══════════════════════════════════════════════');
console.log(`총 조합(ko+en):           ${total}`);
console.log(`fingerprint64 생성됨:     ${fp64Set} / 빈값 ${fp64Empty}`);
console.log(`fingerprint64 형식 16hex: ${fp64Set === total ? 'OK' : 'WARN'}`);
console.log(`서로 다른 입력 조합 수:   ${inputSeen.size}`);
console.log(`입력단위 fp64 중복:       ${fp64Dup} (서로 다른 입력 → 다른 fp64, 0 기대)`);
console.log(`언어 일관성(ko==en fp64): ${langConsistencyFail === 0 ? 'OK' : 'FAIL ' + langConsistencyFail}`);
console.log(`결정성(동일응답→동일출력): ${det}/${total} (실패 ${detFail})`);
console.log(`콘텐츠 baseline 일치:      ${total - mismatch}/${total} (불일치 ${mismatch})`);
if (mismatch) console.log('  불일치 예:', examples.join(', '));
console.log('───────────────────────────────────────────────');
const pass = (mismatch === 0 && detFail === 0 && fp64Empty === 0 && fp64Dup === 0 && langConsistencyFail === 0);
console.log(pass ? '✅ PASS — 콘텐츠 0 변화 + 식별자 강화 확인' : '❌ FAIL');
process.exit(pass ? 0 : 1);
