'use strict';

/**
 * 게이트 대상 목록 완전성 게이트 (gate_coverage)
 *
 * 왜 이 게이트가 필요한가 — 실측된 사고 1건:
 *   결정론 게이트 2종은 최초에 엔진을 3종만 검사하고 있었다.
 *   실제로는 assets/js/career-engine.js 가 4번째 엔진으로 존재하며,
 *   program-engine.js L19/21/23 이 이를 호출하고 report-engine-v4.js 가
 *   3곳에서 참조하며, 산출 문장 일부가 이 파일의 DOMAIN_ATTR_KO 로 조합 생성된다.
 *   즉 3종만 검사한 상태에서 "난수 0회"를 주장한 것은 거짓 초록불이었다.
 *
 *   더 중요한 사실: 이 누락은 게이트가 잡아낸 것이 아니라,
 *   별건 대조 작업 중 우연히 발견되었다. 5번째 엔진이 추가되면 같은 일이 반복된다.
 *
 * 이 게이트가 하는 일:
 *   디스크에서 엔진 파일을 실제로 열거하고(glob 아님 — 파일 시스템 실측),
 *   결정론 게이트 2종이 선언한 검사 대상 목록과 대조한다.
 *   누락이 1건이라도 있으면 실패한다.
 *
 * 결함 사전 대응:
 *   DF (개수/이름으로 추론 금지, 열어보고 판정)
 *     → 목록 길이 비교가 아니라 집합 차집합으로 판정한다.
 *   DE (regex 가 주석에 걸림)
 *     → 게이트 파일에서 대상 목록을 뽑을 때 주석 줄을 먼저 제거한다.
 *   BT (거짓 초록불은 거짓 빨간불만큼 위험)
 *     → 음성 통제군을 내장한다. 가짜 엔진 파일을 임시로 만들어
 *       이 게이트가 실제로 탐지하는지 스스로 확인한다.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');

// 엔진으로 간주하는 디렉터리와 파일명 규칙.
// 이 규칙 자체가 사각지대가 될 수 있으므로 아래 assertRuleIsCurrent() 로 검증한다.
const ENGINE_DIR = 'assets/js';
const ENGINE_PATTERN = /-engine(?:-v\d+)?\.js$/;

// 검사 대상 목록을 선언하고 있는 게이트 파일들.
const GATE_SPECS = [
  { file: 'scripts/gates/determinism_random_gate.js', constName: 'ENGINE_FILES' },
  { file: 'scripts/gates/determinism_hash_gate.js', constName: 'INPUT_FILES' }
];

/**
 * 디스크에서 엔진 파일을 실측 열거한다.
 * @param {string} root
 * @returns {string[]} repo 기준 상대 경로, 정렬됨
 */
function discoverEngines(root) {
  const dir = path.join(root, ENGINE_DIR);
  if (!fs.existsSync(dir)) {
    throw new Error(`engine directory not found: ${ENGINE_DIR}`);
  }
  return fs
    .readdirSync(dir)
    .filter((name) => ENGINE_PATTERN.test(name))
    .map((name) => `${ENGINE_DIR}/${name}`)
    .sort();
}

/**
 * 게이트 파일에서 선언된 대상 목록을 추출한다.
 * 주석을 먼저 제거한다 (결함 DE 대응).
 * @param {string} root
 * @param {{file: string, constName: string}} spec
 * @returns {string[]}
 */
function extractDeclaredList(root, spec) {
  const abs = path.join(root, spec.file);
  if (!fs.existsSync(abs)) {
    throw new Error(`gate file not found: ${spec.file}`);
  }
  const raw = fs.readFileSync(abs, 'utf8');

  // 주석 제거: 줄 단위 // 와 블록 /* */ 를 모두 지운다.
  const stripped = raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');

  const declRe = new RegExp(`${spec.constName}\\s*=\\s*\\[([\\s\\S]*?)\\]`);
  const m = stripped.match(declRe);
  if (!m) {
    throw new Error(`${spec.file}: could not locate ${spec.constName} array declaration`);
  }

  const items = [];
  const strRe = /['"]([^'"]+)['"]/g;
  let hit;
  while ((hit = strRe.exec(m[1])) !== null) {
    items.push(hit[1]);
  }
  if (items.length === 0) {
    throw new Error(`${spec.file}: ${spec.constName} contains no entries`);
  }
  return items;
}

/**
 * 엔진 판별 규칙이 현재 저장소 실태와 맞는지 확인한다.
 * assets/js 안에 "engine" 을 이름에 포함하지만 패턴에 걸리지 않는 파일이 있으면
 * 규칙 자체가 낡은 것이므로 실패시킨다.
 * @param {string} root
 * @returns {string[]} 규칙 사각지대 후보
 */
function assertRuleIsCurrent(root) {
  const dir = path.join(root, ENGINE_DIR);
  const suspicious = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.js'))
    .filter((name) => /engine/i.test(name))
    .filter((name) => !ENGINE_PATTERN.test(name))
    .map((name) => `${ENGINE_DIR}/${name}`);
  return suspicious;
}

/**
 * @param {string} root
 * @returns {{status: string, discoveredEngines: string[], gates: object[], suspiciousNames: string[]}}
 */
function scan(root) {
  const discovered = discoverEngines(root);
  const suspiciousNames = assertRuleIsCurrent(root);

  const gates = GATE_SPECS.map((spec) => {
    const declared = extractDeclaredList(root, spec);
    const declaredSet = new Set(declared);
    // 선언 목록에 없는 엔진 = 검사 누락
    const missing = discovered.filter((f) => !declaredSet.has(f));
    // 선언 목록에 있으나 디스크에 없는 항목 = 유령 항목
    const ghost = declared.filter((f) => !fs.existsSync(path.join(root, f)));
    return {
      gate: spec.file,
      constName: spec.constName,
      declaredCount: declared.length,
      missingEngines: missing,
      ghostEntries: ghost
    };
  });

  const failed =
    suspiciousNames.length > 0 ||
    gates.some((g) => g.missingEngines.length > 0 || g.ghostEntries.length > 0);

  return {
    gate: 'gate_coverage',
    status: failed ? 'fail' : 'pass',
    discoveredEngines: discovered,
    suspiciousNames,
    gates
  };
}

/**
 * 음성 통제군: 가짜 엔진 파일을 임시 트리에 심고
 * 이 게이트가 실제로 탐지하는지 확인한다.
 * @returns {{status: string, injected: string, observedExitCode: number}}
 */
function runNegativeControl() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-coverage-nc-'));
  const injectedName = 'phantom-engine.js';

  try {
    // 실제 트리 구조를 복제한다 (엔진 + 게이트 파일).
    fs.mkdirSync(path.join(tmp, ENGINE_DIR), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'scripts', 'gates'), { recursive: true });

    for (const rel of discoverEngines(ROOT)) {
      fs.copyFileSync(path.join(ROOT, rel), path.join(tmp, rel));
    }
    for (const spec of GATE_SPECS) {
      fs.copyFileSync(path.join(ROOT, spec.file), path.join(tmp, spec.file));
    }

    // 어느 게이트도 선언하지 않은 5번째 엔진을 심는다.
    fs.writeFileSync(
      path.join(tmp, ENGINE_DIR, injectedName),
      '// LP_NEGATIVE_CONTROL phantom engine\nmodule.exports = {};\n',
      'utf8'
    );

    const res = spawnSync(
      process.execPath,
      [__filename, '--engine-root', tmp, '--skip-negative-control'],
      { encoding: 'utf8' }
    );

    if (res.status !== 1) {
      throw new Error(
        `negative control failed: injected ${injectedName} but gate exited ${res.status} (expected 1)`
      );
    }
    return {
      status: 'pass',
      injected: `${ENGINE_DIR}/${injectedName}`,
      observedExitCode: res.status
    };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function main() {
  const argv = process.argv.slice(2);
  const rootIdx = argv.indexOf('--engine-root');
  const root = rootIdx >= 0 ? path.resolve(argv[rootIdx + 1]) : ROOT;
  const skipNc = argv.includes('--skip-negative-control');

  const result = scan(root);

  if (!skipNc && result.status === 'pass') {
    result.negativeControl = runNegativeControl();
  }

  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === 'pass' ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = { scan, discoverEngines, extractDeclaredList };
