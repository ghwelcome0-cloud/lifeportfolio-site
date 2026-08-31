/**
 * 게이트 CI 배선 완전성 게이트 (gate_ci_wiring)
 *
 * 왜 이 게이트가 필요한가 — 실측된 사고 1건:
 *   대표 지시 원문: "이 부분 매번 개선해왔는데, 이 참에 평가 항목에 반영함으로서
 *   전사적인 개선을 일으킵시다."
 *
 *   그 '매번 개선' 이 왜 누적되지 않았는지 실측으로 드러났다.
 *   UX 측정 스크립트 5개와 보안 스크립트 3개가 저장소에 이미 존재했으나,
 *   package.json 안에 그것을 호출하는 npm script 가 0건이었다(grep 실측).
 *   도구는 있고 호출 경로가 없었다. 개선이 점수가 되지 않으니
 *   다음 배포에서 같은 자리가 다시 열렸다.
 *
 *   더 중요한 사실: 그 누락은 게이트가 잡아낸 것이 아니라 사람이 우연히 발견했다.
 *   그리고 그 직후 신설한 게이트 2종 역시 CI 에 편입되지 않은 상태로
 *   한 구간을 지났다. 7번째 게이트가 추가되면 같은 일이 또 반복된다.
 *
 * 이 게이트가 하는 일 (3단 배선을 끝까지 따라간다):
 *   ① scripts/gates/ 의 게이트 파일을 디스크에서 실측 열거한다 (목록 하드코딩 아님)
 *   ② 각 파일을 호출하는 npm script 가 package.json 에 존재하는지 확인한다
 *   ③ 그 npm script 를 실행하는 .github/workflows/*.yml 이 존재하는지 확인한다
 *   한 단이라도 끊기면 실패한다. 끊긴 지점을 이름으로 지목해 보고한다.
 *
 * 이 게이트가 하지 않는 일 (정직 고지):
 *   - 워크플로가 실제로 트리거되는 조건(on:)이 적절한지는 판정하지 않는다.
 *     required-checks 등재 여부도 이 게이트의 범위가 아니다.
 *   - 게이트의 내용이 옳은지는 판정하지 않는다. '불리는가' 만 본다.
 *
 * 결함 사전 대응:
 *   DF (개수/이름으로 추론 금지, 열어보고 판정)
 *     → 게이트 수를 세지 않고, 파일별로 배선 3단을 각각 확인한다.
 *   DE (regex 가 주석/유사토큰에 걸림)
 *     → 워크플로에서 주석(#) 줄을 먼저 제거한 뒤 대조한다.
 *       또한 npm script 이름의 부분일치를 막기 위해 경계를 확인한다
 *       (예: test:ux 가 test:ux:selftest 에 걸리는 것을 구분한다).
 *   BT (거짓 초록불은 거짓 빨간불만큼 위험)
 *     → 음성 통제군을 내장한다. 배선이 끊긴 가짜 게이트 파일을 임시로 만들고
 *       이 게이트가 실제로 탐지하는지 스스로 확인한다.
 *   AY (부분 공개 시 분모 필수)
 *     → 통과 보고 시 '몇 개 중 몇 개' 를 항상 함께 낸다.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

const GATE_DIR = 'scripts/gates';
const WORKFLOW_DIR = '.github/workflows';

/**
 * 게이트로 간주하는 파일명 규칙.
 * 이 규칙 자체가 사각지대가 될 수 있으므로 assertRuleIsCurrent() 로 검증한다.
 */
const GATE_PATTERN = /_gate\.(?:mjs|js)$/;

/**
 * 이 게이트 자신은 배선 대상에서 제외하지 않는다.
 * (자기 자신도 CI 에 편입되어야 하며, 그것을 스스로 검사한다.)
 */

/**
 * 디스크에서 게이트 파일을 실측 열거한다.
 * @param {string} root
 * @returns {string[]} repo 기준 상대 경로, 정렬됨
 */
export function discoverGates(root = ROOT) {
  const dir = path.join(root, GATE_DIR);
  if (!fs.existsSync(dir)) throw new Error(`gate directory not found: ${GATE_DIR}`);
  return fs
    .readdirSync(dir)
    .filter((n) => GATE_PATTERN.test(n))
    .sort()
    .map((n) => `${GATE_DIR}/${n}`);
}

/**
 * 규칙이 현재 디렉터리 실태와 어긋나지 않는지 확인한다.
 * scripts/gates/ 안에 있으면서 규칙에 걸리지 않는 실행 파일이 있으면
 * 규칙이 낡았다는 신호다 — 조용히 넘기지 않고 보고한다.
 * @param {string} root
 * @returns {string[]} 규칙에서 빠진 파일 목록
 */
export function findRuleBlindSpots(root = ROOT) {
  const dir = path.join(root, GATE_DIR);
  return fs
    .readdirSync(dir)
    .filter((n) => /\.(?:mjs|js)$/.test(n) && !GATE_PATTERN.test(n))
    .sort();
}

/**
 * 주석 줄을 제거한다 (결함 DE 대응).
 * @param {string} text
 * @returns {string}
 */
function stripYamlComments(text) {
  return text
    .split('\n')
    .map((l) => (l.trimStart().startsWith('#') ? '' : l))
    .join('\n');
}

/**
 * package.json 의 scripts 중 대상 파일을 호출하는 키를 찾는다.
 * @param {object} scripts
 * @param {string} gateRelPath
 * @returns {string[]}
 */
export function findNpmScriptsFor(scripts, gateRelPath) {
  const base = path.basename(gateRelPath);
  return Object.entries(scripts)
    .filter(([, cmd]) => typeof cmd === 'string' && cmd.includes(base))
    .map(([k]) => k)
    .sort();
}

/**
 * 워크플로 본문에서 특정 npm script 가 실행되는지 확인한다.
 * `npm run <key>` 의 뒤가 스크립트 이름의 일부가 아님을 확인한다 (결함 DE).
 * 예: `npm run test:ux:selftest` 는 key='test:ux' 의 호출로 세지 않는다.
 * @param {string} body 주석 제거된 워크플로 본문
 * @param {string} key
 * @returns {boolean}
 */
export function workflowRunsScript(body, key) {
  let idx = 0;
  const needle = `npm run ${key}`;
  for (;;) {
    idx = body.indexOf(needle, idx);
    if (idx < 0) return false;
    const after = body[idx + needle.length];
    // 이름 경계: 다음 문자가 npm script 이름에 쓰일 수 있는 문자가 아니어야 한다.
    if (after === undefined || !/[A-Za-z0-9:_\-.]/.test(after)) return true;
    idx += needle.length;
  }
}

/**
 * 배선 3단을 실측한다.
 * @param {string} root
 * @returns {{rows: object[], blindSpots: string[], ok: boolean}}
 */
export function run(root = ROOT) {
  const gates = discoverGates(root);
  const blindSpots = findRuleBlindSpots(root);

  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const scripts = pkg.scripts || {};

  const wfDir = path.join(root, WORKFLOW_DIR);
  const wfFiles = fs.existsSync(wfDir)
    ? fs.readdirSync(wfDir).filter((n) => n.endsWith('.yml') || n.endsWith('.yaml')).sort()
    : [];
  const wfBodies = wfFiles.map((n) => ({
    name: n,
    body: stripYamlComments(fs.readFileSync(path.join(wfDir, n), 'utf8'))
  }));

  const rows = gates.map((g) => {
    const npmKeys = findNpmScriptsFor(scripts, g);
    const wired = [];
    for (const key of npmKeys) {
      for (const wf of wfBodies) {
        if (workflowRunsScript(wf.body, key) && !wired.includes(wf.name)) wired.push(wf.name);
      }
    }
    // npm 을 거치지 않고 워크플로가 파일을 직접 node 로 호출하는 경우도 인정한다.
    const base = path.basename(g);
    for (const wf of wfBodies) {
      if (wf.body.includes(base) && !wired.includes(wf.name)) wired.push(wf.name);
    }
    let broken = null;
    if (npmKeys.length === 0) broken = 'npm_script_missing';
    else if (wired.length === 0) broken = 'workflow_missing';
    return { gate: g, npmKeys, workflows: wired, broken };
  });

  const ok = blindSpots.length === 0 && rows.every((r) => r.broken === null);
  return { rows, blindSpots, ok };
}

/* ────────────────── 음성 통제군 (결함 BT 대응) ────────────────── */

/**
 * 이 게이트가 실제로 배선 단절을 탐지하는지 스스로 확인한다.
 * 임시 게이트 파일을 만들어 3가지 상태를 각각 검사한다.
 * @returns {{name: string, pass: boolean, note: string}[]}
 */
export function selfTest() {
  const out = [];
  const clean = run(ROOT);
  out.push({
    name: 'clean_repo_passes',
    pass: clean.ok === true,
    note: clean.ok ? '' : JSON.stringify(clean.rows.filter((r) => r.broken).map((r) => r.gate))
  });

  // 통제군 A: npm script 가 없는 게이트 파일을 심는다 → npm_script_missing 탐지 기대
  const fake = path.join(ROOT, GATE_DIR, '__nc_orphan_gate.mjs');
  try {
    fs.writeFileSync(fake, '// negative control: intentionally not wired\n', 'utf8');
    const r = run(ROOT);
    const row = r.rows.find((x) => x.gate.endsWith('__nc_orphan_gate.mjs'));
    out.push({
      name: 'detects_missing_npm_script',
      pass: r.ok === false && !!row && row.broken === 'npm_script_missing',
      note: row ? String(row.broken) : 'row not found'
    });
  } finally {
    if (fs.existsSync(fake)) fs.unlinkSync(fake);
  }

  // 통제군 B: 규칙 사각지대 탐지 — _gate 접미사가 없는 실행 파일을 심는다
  const odd = path.join(ROOT, GATE_DIR, '__nc_not_matching_rule.mjs');
  try {
    fs.writeFileSync(odd, '// negative control: filename does not match GATE_PATTERN\n', 'utf8');
    const r = run(ROOT);
    out.push({
      name: 'detects_rule_blind_spot',
      pass: r.ok === false && r.blindSpots.includes('__nc_not_matching_rule.mjs'),
      note: r.blindSpots.join(',')
    });
  } finally {
    if (fs.existsSync(odd)) fs.unlinkSync(odd);
  }

  // 통제군 C: 이름 경계 판정이 실제로 작동하는가 (결함 DE)
  out.push({
    name: 'name_boundary_not_fooled_by_prefix',
    pass:
      workflowRunsScript('run: npm run test:ux:selftest', 'test:ux') === false &&
      workflowRunsScript('run: npm run test:ux\n', 'test:ux') === true,
    note: 'test:ux vs test:ux:selftest'
  });

  // 통제군 D: 주석 안의 호출은 배선으로 세지 않는가 (결함 DE)
  out.push({
    name: 'comment_only_mention_is_not_wiring',
    pass: stripYamlComments('#   run: npm run test:ux\n').includes('npm run') === false,
    note: 'comment stripped before matching'
  });

  // 통제군 E: 원상복구 확인 — 임시 파일이 남지 않았는가
  out.push({
    name: 'temp_files_cleaned_up',
    pass: !fs.existsSync(fake) && !fs.existsSync(odd),
    note: ''
  });

  return out;
}

/* ────────────────── CLI ────────────────── */

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const wantSelf = process.argv.includes('--self-test');
  const wantJson = process.argv.includes('--json');

  // 결함 BT: 통제군을 먼저 돌린다. 측정기가 고장났으면 측정 자체를 중단한다.
  const controls = selfTest();
  const controlsOk = controls.every((c) => c.pass);
  if (wantSelf || !controlsOk) {
    console.log('── 음성 통제군 (이 게이트가 실제로 작동하는가) ──');
    for (const c of controls) {
      console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.note ? `  [${c.note}]` : ''}`);
    }
    console.log(`통제군 ${controls.filter((c) => c.pass).length}/${controls.length} PASS`);
    if (!controlsOk) {
      console.error('통제군 실패 — 측정을 신뢰할 수 없으므로 중단한다.');
      process.exit(1);
    }
    if (wantSelf) process.exit(0);
  }

  const res = run(ROOT);
  if (wantJson) {
    console.log(JSON.stringify(res, null, 2));
    process.exit(res.ok ? 0 : 1);
  }

  console.log('── 게이트 CI 배선 완전성 (파일 → npm script → workflow) ──');
  for (const r of res.rows) {
    const mark = r.broken === null ? 'OK  ' : 'FAIL';
    console.log(`  ${mark}  ${path.basename(r.gate)}`);
    console.log(`         npm      : ${r.npmKeys.length ? r.npmKeys.join(', ') : '(없음)'}`);
    console.log(`         workflow : ${r.workflows.length ? r.workflows.join(', ') : '(없음)'}`);
    if (r.broken) console.log(`         끊긴 지점: ${r.broken}`);
  }
  if (res.blindSpots.length) {
    console.log(`  FAIL  규칙 사각지대 — ${GATE_DIR} 안에 규칙에 걸리지 않는 파일: ${res.blindSpots.join(', ')}`);
  }
  const wired = res.rows.filter((r) => r.broken === null).length;
  console.log(`배선 완전: ${wired}/${res.rows.length} 게이트`);
  console.log('미측정(이 게이트 범위 밖): 워크플로 트리거 조건의 적절성 · required-checks 등재 · 게이트 내용의 타당성');
  if (!res.ok) {
    console.error('배선이 끊긴 게이트가 있다. 도구가 있어도 불리지 않으면 개선은 점수가 되지 않는다.');
    process.exit(1);
  }
  console.log('결과: 전 게이트 배선 확인');
}
