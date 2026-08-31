#!/usr/bin/env node
/**
 * 개선 전후 대조(델타) 게이트 — 2026-08-28 신설 / 2026-08-28 전면 재작성
 *
 * 대표님 지시 (2026-08-28):
 *   "우리 개선을 했을 때는 원래 이랬는데, 개선 후에 이렇게 변했다는 사례를 같이 반영해주세요.
 *    앞으로. 그래야 저도 '아 이렇게 개선됐구나' 하고 바로 확인할 수 있도록."
 *
 * 왜 게이트로 만드는가
 *   "앞으로 항상 전후를 같이 보고하겠습니다" 는 약속이다. 약속은 잊힌다.
 *   실제로 우리는 같은 종류의 약속(게이트를 CI 에 넣기)을 한 번 잊어 자기반박 #8 로 기록했다.
 *   그래서 이번에는 사람 기억이 아니라 파일로 남긴다.
 *   기준선(baseline)을 저장소에 두고, 측정할 때마다 자동으로 차이를 계산해 표로 출력한다.
 *   ⇒ 다음에 누가 측정하든 "원래 이랬다"가 함께 나온다.
 *
 * ★ 초판(2026-08-28 오전) 폐기 경위 — 반드시 남긴다
 *   초판의 measureNow() 는 UX 게이트 JSON 을 d.counts / d.totals 에서 읽었다.
 *   실제 키는 d.summary.ratio / d.summary.totals 였다. 6개 가정이 전부 틀렸다.
 *     ㉮ d.counts        → 실제 d.summary.ratio      (전 항목 미검출)
 *     ㉯ d.totals        → 실제 d.summary.totals     (전 항목 미검출)
 *     ㉰ prefersReducedMotion → 실제 reducedMotion   (항목 1개 영구 누락)
 *     ㉱ 순수 JSON 가정  → 첫 줄에 "[ux-gate] …" 로그 ⇒ JSON.parse 자체 실패
 *     ㉲ d.fileCount     → 실제 d.summary.pages
 *     ㉳ 파이프 경유 시 64KB 절단 (원자료 104,212 B)
 *   초판을 커밋 전에 실행했기 때문에 발견했다. 실행하지 않았다면
 *   "지표 0건, 이상 없음" 을 조용히 출력하는 거짓 초록불이 CI 에 들어갔을 것이다.
 *   ⇒ 그래서 이 재작성판은 아래 규율을 추가한다.
 *
 * 설계 규율
 *   · 기준선이 없으면 "기준선 없음"을 명시하고 현재값만 보고한다. 0 으로 가정하지 않는다.
 *     (없는 것을 0 으로 채우면 개선 폭이 실제보다 커 보인다 = 자기 유리한 거짓 초록불)
 *   · ★신설★ 정의된 지표를 원자료에서 찾지 못하면 조용히 넘기지 않고 EXIT 1 로 실패한다.
 *     "측정할 게 없어서 아무 문제 없음" 은 거짓 초록불의 전형이다.
 *   · ★신설★ 원자료 키 경로를 코드가 아니라 표(SOURCES)로 명시하고, 자체시험이 그 경로를 검증한다.
 *   · 악화(음수 델타)를 숨기지 않는다. 오히려 먼저 출력한다.
 *   · 이 게이트는 개선을 *판정*하지 않는다. 차이를 *보여준다*.
 *     점수 환산은 외부 재평가의 몫이다 (§8.3 자체 채점 금지 규율).
 *
 * 동작
 *   node scripts/gates/improvement_delta_gate.mjs                현재값 vs 기준선 대조표
 *   node scripts/gates/improvement_delta_gate.mjs --save-baseline 현재값을 새 기준선으로 저장
 *   node scripts/gates/improvement_delta_gate.mjs --self-test     음성 통제군
 *   node scripts/gates/improvement_delta_gate.mjs --json          원자료
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const BASELINE = path.join(ROOT, 'docs/measurements/baseline.json');

/**
 * 지표 정의
 *   key   : 이 게이트가 쓰는 이름
 *   src   : 원자료 내 경로 (summary.ratio.* | summary.totals.*) — ★실측으로 확정
 *   dir   : up = 클수록 좋음 / down = 작을수록 좋음
 */
const METRICS = [
  { key: 'skipLink',        src: 'summary.ratio.skipLink',            dir: 'up',   label: '본문 바로가기 링크',        unit: '/170' },
  { key: 'landmarksFull',   src: 'summary.ratio.landmarksFull',       dir: 'up',   label: '화면 구조 태그 완비',       unit: '/170' },
  { key: 'landmarksZero',   src: 'summary.ratio.landmarksZero',       dir: 'down', label: '구조 태그 0개(결함)',      unit: '/170' },
  { key: 'focusVisible',    src: 'summary.ratio.focusVisible',        dir: 'up',   label: '포커스 표시',              unit: '/170' },
  { key: 'viewport',        src: 'summary.ratio.viewport',            dir: 'up',   label: 'viewport meta 보유',       unit: '/170' },
  { key: 'reducedMotion',   src: 'summary.ratio.reducedMotion',       dir: 'up',   label: '움직임 축소 지원',          unit: '/170' },
  { key: 'fontClean',       src: 'summary.ratio.fontClean',           dir: 'up',   label: '12px 미만 폰트 0인 페이지', unit: '/170' },
  { key: 'imgAltClean',     src: 'summary.ratio.imgAltClean',         dir: 'up',   label: '대체텍스트 정상 페이지',    unit: '/170' },
  { key: 'inputLabelClean', src: 'summary.ratio.inputLabelClean',     dir: 'up',   label: '입력칸 라벨 정상 페이지',   unit: '/170' },
  { key: 'fontUnder12',     src: 'summary.totals.fontUnder12',        dir: 'down', label: '12px 미만 폰트 선언 총량',  unit: '건' },
  { key: 'inputNoLabel',    src: 'summary.totals.inputNoLabel',       dir: 'down', label: '라벨 없는 입력칸',          unit: '건' },
  { key: 'imgNoAlt',        src: 'summary.totals.imgNoAlt',           dir: 'down', label: '대체텍스트 없는 이미지',    unit: '건' },
  { key: 'fixedWideOverMobile', src: 'summary.totals.fixedWideOverMobile', dir: 'down', label: '모바일 초과 고정폭',   unit: '건' }
];

/** 점 표기 경로로 값을 꺼낸다. 없으면 undefined. */
export function pick(obj, dotted) {
  let cur = obj;
  for (const seg of dotted.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[seg];
  }
  return cur;
}

/**
 * 게이트 표준출력에서 JSON 본문만 추출한다.
 * UX 게이트는 첫 줄에 "[ux-gate] 음성 통제군: PASS (19/19)" 같은 로그를 먼저 낸다.
 * ⇒ 첫 '{' 부터 잘라 쓴다. (초판이 이 처리를 빠뜨려 JSON.parse 가 실패했다)
 */
export function extractJson(raw) {
  const i = raw.indexOf('{');
  if (i < 0) throw new Error('원자료에 JSON 본문이 없다');
  return JSON.parse(raw.slice(i));
}

/**
 * UX 게이트를 JSON 모드로 실행해 현재값을 얻는다.
 * execFileSync + 넉넉한 maxBuffer — 원자료가 100KB 를 넘으므로 절단되면 안 된다.
 */
export function measureNow() {
  const raw = execFileSync('node', ['scripts/gates/ux_quality_gate.mjs', '--json'], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore']
  });
  return extractRaw(extractJson(raw));
}

/** 파싱된 원자료 → 지표 묶음. 못 찾은 지표는 missing 에 남긴다(조용히 버리지 않는다). */
export function extractRaw(d) {
  const values = {};
  const missing = [];
  for (const m of METRICS) {
    const v = pick(d, m.src);
    if (typeof v === 'number') values[m.key] = v;
    else missing.push({ key: m.key, src: m.src, got: v === undefined ? 'undefined' : typeof v });
  }
  return {
    measuredAt: new Date().toISOString().slice(0, 19) + 'Z',
    pages: pick(d, 'summary.pages') ?? null,
    values,
    missing
  };
}

export function loadBaseline() {
  if (!fs.existsSync(BASELINE)) return null;
  try { return JSON.parse(fs.readFileSync(BASELINE, 'utf8')); } catch { return null; }
}

/**
 * 델타 계산.
 * 기준선에 값이 없으면 0 으로 채우지 않는다 → verdict 'no-baseline'.
 */
/**
 * 전후 대조 계산.
 *
 * ★ 2026-08-31 구조 변경 (외부 코드 감사 지적 반영 — 발주 N)
 *   이전에는 이 함수 말고 `computeDeltaWith()` 라는 **복제 구현**이 따로 있었고,
 *   음성 통제군(selfTest)은 그 복제본만 검사했다.
 *   그래서 이 운영 함수를 완전히 고장내도 (모든 판정을 'improved' 로 바꿔도)
 *   음성 통제군은 17/17 PASS · exit 0 을 냈다. **실측으로 재현했다.**
 *   → 복제본을 없애고, METRICS 를 주입 가능한 인자로 바꿔 **단일 구현**으로 만든다.
 *     이제 이 함수가 고장나면 음성 통제군이 반드시 실패한다.
 *
 * @param {object|null} baseline  기준선 (없으면 null)
 * @param {object} current        현재 측정값
 * @param {Array=} metrics        검사할 지표 목록. 생략하면 운영 METRICS.
 *                                (자체시험이 이 인자로 가짜 지표를 주입한다)
 */
export function computeDelta(baseline, current, metrics = METRICS) {
  const bv = (baseline && baseline.values) || {};
  const rows = [];
  for (const m of metrics) {
    const cur = current.values[m.key];
    if (cur == null) continue;                 // 원자료에 없음 → missing 으로 별도 보고
    const before = bv[m.key];
    if (before == null) {
      rows.push({ ...m, before: null, after: cur, delta: null, verdict: 'no-baseline' });
      continue;
    }
    const delta = cur - before;
    let verdict;
    if (delta === 0) verdict = 'same';
    else if (m.dir === 'up') verdict = delta > 0 ? 'improved' : 'worsened';
    else verdict = delta < 0 ? 'improved' : 'worsened';
    rows.push({ ...m, before, after: cur, delta, verdict });
  }
  return rows;
}

/* ─────────────────────────── 음성 통제군 ─────────────────────────── */

export function selfTest() {
  const checks = [];
  const ok = (name, cond) => checks.push({ name, pass: !!cond });
  const M = (key, dir) => ({ key, dir, label: key, unit: '' });
  // ★ 복제본이 아니라 운영 함수 computeDelta 를 직접 호출한다 (인자 순서: baseline, current, metrics)
  const computeDeltaWith = (metrics, baseline, current) => computeDelta(baseline, current, metrics);

  // 1. 방향 판정 4종
  const up = { values: {} }, dn = {};
  {
    const rows = computeDeltaWith([M('x', 'up')], { values: { x: 10 } }, { values: { x: 20 } });
    ok('up_increase_is_improved', rows[0].verdict === 'improved' && rows[0].delta === 10);
  }
  {
    const rows = computeDeltaWith([M('x', 'up')], { values: { x: 20 } }, { values: { x: 10 } });
    ok('up_decrease_is_worsened', rows[0].verdict === 'worsened');
  }
  {
    const rows = computeDeltaWith([M('x', 'down')], { values: { x: 300 } }, { values: { x: 100 } });
    ok('down_decrease_is_improved', rows[0].verdict === 'improved');
  }
  {
    const rows = computeDeltaWith([M('x', 'down')], { values: { x: 100 } }, { values: { x: 300 } });
    ok('down_increase_is_worsened', rows[0].verdict === 'worsened');
  }
  {
    const rows = computeDeltaWith([M('x', 'up')], { values: { x: 7 } }, { values: { x: 7 } });
    ok('no_change_is_same', rows[0].verdict === 'same' && rows[0].delta === 0);
  }

  // 2. 기준선 없음을 0 으로 위조하지 않는가 (자기 유리한 거짓 초록불 방지)
  {
    const rows = computeDeltaWith([M('x', 'up')], null, { values: { x: 50 } });
    ok('missing_baseline_not_treated_as_zero',
       rows[0].verdict === 'no-baseline' && rows[0].delta === null && rows[0].before === null);
  }
  {
    const rows = computeDeltaWith([M('x', 'up')], { values: {} }, { values: { x: 50 } });
    ok('empty_baseline_not_treated_as_zero', rows[0].verdict === 'no-baseline');
  }

  // 3. ★초판 결함 재발 방지 — 원자료 키 경로가 실제로 존재하는가
  {
    const fakeReal = { summary: { pages: 170, ratio: { skipLink: 102 }, totals: { fontUnder12: 344 } } };
    ok('reads_summary_ratio_path', pick(fakeReal, 'summary.ratio.skipLink') === 102);
    ok('reads_summary_totals_path', pick(fakeReal, 'summary.totals.fontUnder12') === 344);
    ok('old_wrong_path_yields_undefined',
       pick(fakeReal, 'counts.skipLink') === undefined && pick(fakeReal, 'totals.fontUnder12') === undefined);
  }

  // 4. ★신설★ 지표를 못 찾으면 조용히 넘기지 않고 missing 에 남기는가
  {
    const r = extractRaw({ summary: { pages: 170, ratio: {}, totals: {} } });
    ok('absent_metrics_recorded_as_missing_not_silent',
       Object.keys(r.values).length === 0 && r.missing.length === METRICS.length);
  }
  {
    const r = extractRaw({ summary: { pages: 170, ratio: { skipLink: 5 }, totals: {} } });
    ok('partial_measurement_reports_both_sides',
       r.values.skipLink === 5 && r.missing.length === METRICS.length - 1);
  }

  // 5. ★신설★ 로그 줄이 앞에 붙은 출력을 파싱하는가 (초판 실패 지점 ㉱)
  {
    let pass = false;
    try {
      const d = extractJson('[ux-gate] 음성 통제군: PASS (19/19)\n{"summary":{"pages":170,"ratio":{},"totals":{}}}');
      pass = d.summary.pages === 170;
    } catch { pass = false; }
    ok('leading_log_line_tolerated', pass);
  }
  {
    let threw = false;
    try { extractJson('완전히 JSON 아님'); } catch { threw = true; }
    ok('non_json_output_throws_not_silent', threw);
  }

  // 6. 문자열/불리언을 숫자로 착각하지 않는가
  {
    const r = extractRaw({ summary: { pages: 170, ratio: { skipLink: '102' }, totals: {} } });
    ok('string_value_not_accepted_as_number', r.values.skipLink === undefined);
  }

  // 7. 기준선 파일 왕복 (실제 디스크)
  {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'deltagate-'));
    const f = path.join(d, 'baseline.json');
    const payload = { measuredAt: '2026-08-28T00:00:00Z', pages: 170, values: { skipLink: 2 } };
    fs.writeFileSync(f, JSON.stringify(payload, null, 2));
    const back = JSON.parse(fs.readFileSync(f, 'utf8'));
    ok('baseline_roundtrip', back.values.skipLink === 2);
    fs.rmSync(d, { recursive: true, force: true });
  }

  // 8. 악화 행이 먼저 출력되는가 (나쁜 소식 숨김 금지)
  {
    const rows = computeDeltaWith(
      [M('good', 'up'), M('bad', 'up')],
      { values: { good: 1, bad: 9 } },
      { values: { good: 9, bad: 1 } }
    );
    const ordered = orderRows(rows);
    ok('worsened_printed_first', ordered[0].verdict === 'worsened');
  }

  const passed = checks.filter(c => c.pass).length;
  return { passed, total: checks.length, checks };
}

/* ★ 삭제됨 — `computeDeltaWith()` 복제 구현 (2026-08-31)
   운영 함수와 글자만 같고 실체가 다른 사본이었고, 음성 통제군이 이 사본만 검사했다.
   그래서 운영 함수가 고장나도 통제군이 통과하는 거짓 초록불이 생겼다.
   지금은 computeDelta(baseline, current, metrics) 단일 구현이며,
   selfTest 안의 지역 헬퍼가 그 운영 함수를 그대로 호출한다.
   같은 결함을 다시 만들지 않기 위해 지운 이유를 남긴다. */

/** 악화 → 기준선없음 → 개선 → 동일 순서. 나쁜 소식을 맨 위로. */
export function orderRows(rows) {
  const rank = { worsened: 0, 'no-baseline': 1, improved: 2, same: 3 };
  return [...rows].sort((a, b) => (rank[a.verdict] - rank[b.verdict]));
}

/* ─────────────────────────── 출력 ─────────────────────────── */

const MARK = { improved: '개선', worsened: '악화', same: '동일', 'no-baseline': '기준선없음' };

function fmtDelta(r) {
  if (r.delta === null) return '—';
  const s = r.delta > 0 ? `+${r.delta}` : `${r.delta}`;
  return s;
}

function printReport(baseline, current, rows) {
  console.log('');
  console.log('════════ 개선 전후 대조 (⑥축 홈페이지 이용편의성·시각품질) ════════');
  console.log(`기준선 : ${baseline ? baseline.measuredAt + (baseline.note ? '  · ' + baseline.note : '') : '없음 (docs/measurements/baseline.json 미생성)'}`);
  console.log(`현재   : ${current.measuredAt}  · 검사 페이지 ${current.pages}개`);
  console.log('');
  console.log('  판정        항목                          개선 전 →  개선 후    차이');
  console.log('  ' + '─'.repeat(72));
  for (const r of orderRows(rows)) {
    const b = r.before === null ? '  —' : String(r.before).padStart(5);
    const a = String(r.after).padStart(5);
    const d = fmtDelta(r).padStart(6);
    console.log(`  ${MARK[r.verdict].padEnd(10)}  ${r.label.padEnd(26)} ${b} → ${a} ${r.unit.padEnd(5)} ${d}`);
  }
  console.log('');
  const n = v => rows.filter(r => r.verdict === v).length;
  console.log(`  요약: 개선 ${n('improved')}건 · 악화 ${n('worsened')}건 · 동일 ${n('same')}건 · 기준선없음 ${n('no-baseline')}건`);

  if (current.missing.length) {
    console.log('');
    console.log('  ⚠️ 원자료에서 찾지 못한 지표 (조용히 넘기지 않고 실패로 처리한다):');
    for (const m of current.missing) console.log(`     · ${m.key}  ← ${m.src}  (${m.got})`);
  }

  console.log('');
  console.log('  미측정 — 이 표가 말하지 않는 것:');
  console.log('   · ⑥축 점수 환산: 자체 채점 금지(§8.3). 외부 재평가만이 판정한다.');
  console.log('   · 고객 체감: 코드 지표는 체감의 대리지표일 뿐이다.');
  console.log('   · 터치 타깃 44×44px, 색 대비: 실브라우저 측정 필요(U-8 회신 대기).');
  console.log('   · 배포 반영 여부: 이 수치는 브랜치 상태다. 라이브 반영은 별건이다.');
  console.log('');
}

/* ─────────────────────────── CLI ─────────────────────────── */

const isMain = process.argv[1] && process.argv[1].endsWith('improvement_delta_gate.mjs');
if (isMain) {
  const argv = process.argv.slice(2);

  const st = selfTest();
  const stOk = st.passed === st.total;
  console.log(`[delta-gate] 음성 통제군: ${stOk ? 'PASS' : 'FAIL'} (${st.passed}/${st.total})`);
  if (!stOk) {
    for (const c of st.checks) if (!c.pass) console.log(`  FAIL: ${c.name}`);
    process.exit(1);
  }
  if (argv.includes('--self-test')) process.exit(0);

  const current = measureNow();

  if (argv.includes('--save-baseline')) {
    fs.mkdirSync(path.dirname(BASELINE), { recursive: true });
    fs.writeFileSync(BASELINE, JSON.stringify(current, null, 2) + '\n');
    console.log(`[delta-gate] 기준선 저장: ${path.relative(ROOT, BASELINE)}`);
    console.log('  ⚠️ 기준선을 지금 값으로 덮으면 이전 상태는 사라진다. 개선 *직전*에만 저장하라.');
    process.exit(0);
  }

  const baseline = loadBaseline();
  const rows = computeDelta(baseline, current);

  if (argv.includes('--json')) {
    console.log(JSON.stringify({ baseline, current, rows }, null, 1));
    // ★ json 경로도 악화를 통과시키던 것을 함까 바로잡는다 (발주 N 지적)
    const worsenedJson = rows.filter(r => r.verdict === 'worsened');
    const bad = current.missing.length || (worsenedJson.length && !argv.includes('--allow-worsened'));
    process.exit(bad ? 1 : 0);
  }

  printReport(baseline, current, rows);

  // 지표를 못 찾았으면 실패로 끝낸다 — "측정할 게 없어 이상 없음" 을 허용하지 않는다.
  if (current.missing.length) {
    console.log(`[delta-gate] FAIL — 정의된 지표 ${current.missing.length}건을 원자료에서 찾지 못했다.`);
    console.log('             원자료 구조가 바뀌었을 수 있다. METRICS.src 를 실측으로 갱신하라.');
    process.exit(1);
  }
  /* ★ 2026-08-31 신설 — 외부 코드 감사(발주 N)가 지적한 Critical 결함 상쉽.
     이전에는 지표가 **실제로 악화되었을 때도** exit 0 이었다.
     지표를 못 찾은 경우(missing)만 보고 악화(worsened)는 보지 않았기 때문이다.
     재현(실측 완료): computeDelta({values:{skipLink:100}}, {values:{skipLink:1}, missing:[]})
       → verdict 'worsened' 가 나오는데도 종료 코드는 0.
     그러면 CI(quality-axes-gates.yml)가 회귀를 ‘기록만 하고 말리지 않는’ 거짓 초록불이 된다.

     이 게이트의 사상은 ‘점수를 판정하지 않고 차이를 보여준다’인데, 그것은
     **점수를 매기지 않는다**는 뜻이지 **악화를 조용하게 통과시킨다**는 뜻이 아니다.
     악화는 사람이 보고 결정해야 하므로 기본값을 exit 1 로 닫고,
     생겁겁 봐야 하는 경우만 --allow-worsened 로 명시적으로 여는다.
     (기본값은 엄견하게, 예외는 사람이 손으로 적는 구조) */
  const worsened = rows.filter(r => r.verdict === 'worsened');
  if (worsened.length && !argv.includes('--allow-worsened')) {
    console.log(`[delta-gate] FAIL — 악화한 지표 ${worsened.length}건이 있다.`);
    for (const w of worsened) {
      console.log(`             · ${w.label || w.key}: ${w.before} → ${w.after} (악화)`);
    }
    console.log('             악화를 알고도 진행해야 한다면 --allow-worsened 를 사람이 명시하라.');
    console.log('             (이전에는 이 경우에도 exit 0 이었다 — 우리가 만든 거짓 초록불을 외부 감사가 잡았다.)');
    process.exit(1);
  }
  if (worsened.length) {
    console.log(`[delta-gate] ⚠️ 악화 ${worsened.length}건을 --allow-worsened 로 사람이 명시 허용했다.`);
    console.log('[delta-gate] OK(조건부) — 악화가 있으나 사람이 알고 통과시켰다. 무결이 아니다.');
    process.exit(0);
  }

  console.log('[delta-gate] OK — 전후 대조 출력 완료 (악화 0건).');
  process.exit(0);
}
