#!/usr/bin/env node
/**
 * report_ch9_render_gate.mjs — IX장(방법론 투명성 패널) 실렌더 게이트
 *
 * ─── 왜 이 게이트가 필요한가 ──────────────────────────────────────────────
 *   report.html 의 IX장은 "이스케이프된 JS 문자열 배열" 안에 들어 있다.
 *   즉 저장소의 그 줄은 코드가 아니라 *코드를 만드는 문자열* 이고,
 *   문법이 깨져도 report.html 자체는 유효한 HTML 로 남는다.
 *   → grep 으로 문안이 '있다' 를 확인해도 고객 화면에 '나온다' 는 보장이 없다.
 *   이 게이트는 그 두 단계를 분리해 실제로 실행까지 해 본다.
 *     ① bookRenderScript() 를 저장소에서 추출해 문법 검사
 *     ② 그 함수가 반환하는 내부 스크립트를 다시 문법 검사
 *     ③ methodPanel IIFE 를 격리 실행해 page() 로 넘어간 HTML 을 포획
 *     ④ 필수 문안이 그 HTML 에 있는지 대조
 *
 * ─── 음성 통제군 (결함 BT 대응) ────────────────────────────────────────────
 *   --self-test 는 삽입 블록을 제거한 판본을 만들어 이 게이트가 FAIL 을
 *   내는지 확인한다. "전부 OK" 가 청정인지 게이트 고장인지 구별되지 않으면
 *   그 초록불은 무효다. 통제군 실패 시 측정 자체를 중단한다(exit 1).
 *
 * ─── 한계 (정직 고지) ──────────────────────────────────────────────────────
 *   · 이 게이트는 문자열 생성까지만 본다. 브라우저에서의 실제 배치·줄바꿈·
 *     페이지 넘김은 보지 않는다. 그것은 ⑥축(UX) 측정의 영역이다.
 *   · DATA 스텁을 쓰므로 실고객 데이터에서의 분기(cited 없음 등)는 미검증이다.
 *     폴백 경로는 별도 케이스로 함께 돌린다.
 *   · 문안의 '내용이 맞는가' 는 판정하지 않는다. '지면에 도달하는가' 만 본다.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execSync } from 'node:child_process';

const ROOT = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
const TARGET = path.join(ROOT, 'report.html');

/** IX장 지면에 반드시 도달해야 하는 문안 — ⑤축 채점표의 "지면에 명시" 요건 대응 */
export const REQUIRED_ON_PAGE = [
  { key: 'ch9_title',   needle: 'IX. 이 리포트는 이렇게 만들어졌습니다', why: '장 제목' },
  { key: 'steps',       needle: 'mp-steps',                              why: '측정 3단계(기존)' },
  { key: 'repro',       needle: '재현성 · 당신만의 고유 코드',            why: '⑤항목1 재현성 지면 명시(기존)' },
  { key: 'map_all',     needle: '전체 매핑 · 56문항이 어디로 갔는가',      why: '⑤항목4 전체 매핑 공개' },
  { key: 'map_weight',  needle: '23.85',                                 why: '⑤항목4 가중합 실측치(엔진 axisMax 와 동일)' },
  { key: 'map_nondisc', needle: '공개하지 않는 것도 밝힙니다',            why: '⑤항목4 부분공개 선정기준 병기' },
  { key: 'no_say',      needle: '우리가 쓰지 않는 말',                    why: '⑤항목7 금지표현 목록 지면 명시' },
  { key: 'no_say_item', needle: '>심리검사<',                            why: '⑤항목7 목록 실항목 렌더' },
  { key: 'claim',       needle: '증명된 것과 아직 아닌 것',               why: '⑤항목8 한계 정면 명시' },
  { key: 'claim_unmet', needle: '아직 아님',                             why: '⑤항목8 미증명 라벨' },
  { key: 'footer',      needle: '분석 엔진',                             why: '엔진 버전 각주(기존)' }
];

/** DATA 스텁 — 실고객 형태를 모사한다. cited 유/무 두 케이스를 만든다. */
function makeData(withCited) {
  return {
    meta: { fingerprint: 123456, fingerprint64: 'AbCdEfGh', engineVersion: 'v4.1', generatedAt: '2026-08-28T00:00:00Z' },
    evidence: withCited ? {
      head: '당신의 답이 문장이 된 자리',
      coverage: '이 리포트는 56문항을 모두 읽었습니다.',
      cols: { ask: '무엇을 물었나', ans: '당신의 답', q: '문항' },
      labels: { role_a: '가치의 방향' },
      cited: [{ qid: 'Q13', role: 'role_a', answers: ['매우 그렇다'] }]
    } : { head: '당신의 답이 문장이 된 자리', qids: ['Q13', 'Q39'] },
    discriminant: { randomCalls: 0, singleQTested: 38 },
    summary: {}, axes: []
  };
}

function domStubs() {
  const el = () => ({ style: {}, setAttribute() {}, appendChild() {}, classList: { add() {}, remove() {} } });
  return {
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                createElement: el, body: el(), addEventListener() {}, title: '' },
    window: { addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }),
              innerWidth: 1440, location: { href: '' }, print() {}, setTimeout() {}, requestAnimationFrame() {} },
    location: { href: '' }, navigator: { userAgent: 'node' },
    setTimeout() {}, clearTimeout() {}, requestAnimationFrame() {}
  };
}

/** 저장소에서 bookRenderScript() 본문을 잘라내 완결 함수로 만든다. */
export function extractOuter(htmlText) {
  const lines = htmlText.split('\n');
  const i = lines.findIndex(l => l.includes('function bookRenderScript'));
  if (i < 0) throw new Error('bookRenderScript not found');
  const j = lines.findIndex((l, k) => k > i && l.trim().startsWith('].join('));
  if (j < 0) throw new Error('array terminator not found');
  return { src: lines.slice(i, j + 1).join('\n') + '\n}\n', from: i + 1, to: j + 1 };
}

/** methodPanel IIFE 를 격리 실행해 page() 인자를 포획한다. */
export function renderCh9(innerText, withCited) {
  const lines = innerText.split('\n');
  const mpStart = lines.findIndex(l => l.startsWith('(function methodPanel(){'));
  if (mpStart < 0) throw new Error('methodPanel IIFE not found');
  const mpEnd = lines.findIndex((l, i) => i > mpStart && l.trim() === '})();');
  if (mpEnd < 0) throw new Error('methodPanel terminator not found');

  // 필요한 헬퍼만 이름으로 지목해 중괄호 균형으로 잘라낸다.
  // (최상위 var 선언 일부는 DATA 하위 필드를 즉시 읽어 throw 하므로 취하지 않는다.)
  const WANT = ['function scrub(', 'function esc(', 'function evdsafe(', 'function pad2(', 'function dropDomainTokens('];
  const pre = lines.slice(0, mpStart);
  const kept = [];
  for (const w of WANT) {
    const st = pre.findIndex(l => l.startsWith(w));
    if (st < 0) continue;
    let depth = 0, end = st;
    for (let k = st; k < pre.length; k++) {
      for (const ch of pre[k]) { if (ch === '{') depth++; else if (ch === '}') depth--; }
      if (depth <= 0) { end = k; break; }
    }
    kept.push(pre.slice(st, end + 1).join('\n'));
  }

  const pages = [];
  const ctx = vm.createContext({
    DATA: makeData(withCited),
    page: (html, opt) => pages.push({ html, opt: opt || {} }),
    pad2: n => (n < 10 ? '0' : '') + n,
    console,
    ...domStubs()
  });
  vm.runInContext(kept.join('\n') + '\n' + lines.slice(mpStart, mpEnd + 1).join('\n'), ctx, { timeout: 8000 });
  if (!pages.length) throw new Error('page() was never called');
  return pages[pages.length - 1];
}

/** 전체 파이프라인 — 저장소 → 외부문법 → 내부문법 → 실렌더 → 문안대조 */
export function run(htmlText) {
  const outer = extractOuter(htmlText);
  new vm.Script(outer.src, { filename: 'bookRenderScript.js' }); // 문법 검사 ①
  const fn = vm.runInNewContext(outer.src + '\nbookRenderScript;', { console }, { timeout: 8000 });
  const inner = fn();
  new vm.Script(inner, { filename: 'inner.js' });                // 문법 검사 ②

  const out = { outerLines: [outer.from, outer.to], innerChars: inner.length, cases: [] };
  for (const withCited of [true, false]) {
    const p = renderCh9(inner, withCited);
    const rows = REQUIRED_ON_PAGE.map(r => ({ ...r, ok: p.html.includes(r.needle) }));
    out.cases.push({
      label: withCited ? 'cited 있음(현행 고객)' : 'cited 없음(과거 세션 폴백)',
      anchor: p.opt.anchor, runhead: p.opt.runhead, chars: p.html.length,
      rows, fail: rows.filter(r => !r.ok).length
    });
  }
  return out;
}

/** 음성 통제군 — 삽입 블록을 제거한 판본에서 이 게이트가 FAIL 을 내는가 */
export function selfTest(htmlText) {
  const t = [];
  const NEEDLE = '+_mapAll+_noSay+_claim+footHTML';
  t.push({ name: 'insertion_wired_in_repo', pass: htmlText.includes(NEEDLE) });

  // 결함 삽입본: 렌더 호출에서 세 블록을 떼어낸다
  const mutated = htmlText.replace(NEEDLE, '+footHTML');
  t.push({ name: 'mutation_applied', pass: mutated !== htmlText });
  let negFail = -1, negErr = null;
  try {
    const r = run(mutated);
    negFail = r.cases.reduce((s, c) => s + c.fail, 0);
  } catch (e) { negErr = e.message; }
  t.push({ name: 'negative_control_detects_removal', pass: negFail > 0, detail: negErr ? ('throw: ' + negErr) : (negFail + ' checks failed') });

  // 청정본은 통과해야 한다
  let posFail = -1, posErr = null;
  try {
    const r = run(htmlText);
    posFail = r.cases.reduce((s, c) => s + c.fail, 0);
  } catch (e) { posErr = e.message; }
  t.push({ name: 'clean_repo_passes', pass: posFail === 0, detail: posErr ? ('throw: ' + posErr) : (posFail + ' checks failed') });

  // 기존 문안은 결함본에서도 살아 있어야 한다(과잉 검출 방지)
  let keptOld = false;
  try {
    const r = run(mutated);
    keptOld = r.cases.every(c => c.rows.filter(x => ['ch9_title', 'steps', 'repro', 'footer'].includes(x.key)).every(x => x.ok));
  } catch (_) {}
  t.push({ name: 'existing_content_unaffected_by_mutation', pass: keptOld });

  return t;
}

// ── CLI ────────────────────────────────────────────────────────────────────
const isMain = process.argv[1] && process.argv[1].endsWith('report_ch9_render_gate.mjs');
if (isMain) {
  const html = fs.readFileSync(TARGET, 'utf8');
  const asJson = process.argv.includes('--json');

  // 통제군을 항상 먼저 돌린다. 실패하면 측정 자체를 신뢰할 수 없으므로 중단한다.
  const st = selfTest(html);
  const stFail = st.filter(x => !x.pass);
  if (!asJson) {
    console.log('── 음성 통제군 (이 게이트가 실제로 작동하는가) ──');
    st.forEach(x => console.log('  ' + (x.pass ? 'PASS' : 'FAIL') + '  ' + x.name + (x.detail ? '  [' + x.detail + ']' : '')));
  }
  if (stFail.length) {
    if (asJson) console.log(JSON.stringify({ selfTest: st, aborted: true }, null, 2));
    else console.error('\n통제군 ' + stFail.length + '건 실패 — 측정을 중단합니다. 게이트를 먼저 고치십시오.');
    process.exit(1);
  }
  if (process.argv.includes('--self-test')) {
    console.log('\n통제군 ' + st.length + '/' + st.length + ' PASS');
    process.exit(0);
  }

  const r = run(html);
  if (asJson) { console.log(JSON.stringify(r, null, 2)); process.exit(r.cases.some(c => c.fail) ? 1 : 0); }

  console.log('\n── IX장 실렌더 대조 ──');
  console.log('  bookRenderScript 구간: report.html L' + r.outerLines[0] + '~L' + r.outerLines[1]);
  console.log('  생성된 내부 스크립트: ' + r.innerChars.toLocaleString() + ' chars');
  let total = 0;
  for (const c of r.cases) {
    console.log('\n  [' + c.label + ']  anchor=' + c.anchor + '  ' + c.chars.toLocaleString() + ' chars');
    c.rows.forEach(x => console.log('    ' + (x.ok ? 'OK  ' : 'FAIL') + '  ' + x.key.padEnd(13) + x.why));
    total += c.fail;
  }
  console.log('\n  미측정(이 게이트 범위 밖): 브라우저 실제 배치 · 페이지 넘김 · 문안 내용의 타당성');
  console.log(total === 0 ? '\n결과: 전 케이스 통과' : '\n결과: ' + total + '건 실패');
  process.exit(total === 0 ? 0 : 1);
}
