#!/usr/bin/env node
/**
 * RTDB 규칙 자물쇠($other) 양성·음성 검증 매트릭스
 * ─────────────────────────────────────────────────────────────────────────────
 * 대표 승인 (2026-08-28): "데이터베이스 자물쇠 4개 추가, 승인합니다."
 *
 * ★ 이 게이트가 존재하는 이유 (결함 BT — 거짓 초록불 방지)
 *   자물쇠를 추가했다는 사실만으로는 "잠겼다"를 증명하지 못한다.
 *   두 가지를 동시에 증명해야 한다.
 *     ㉮ 양성(positive): 정상적인 쓰기는 여전히 성공한다  → 서비스 안 깨짐
 *     ㉯ 음성(negative): 정의되지 않은 키 쓰기는 거부된다  → 자물쇠 실작동
 *   ㉯ 만 확인하고 ㉮ 를 빼면 "고객이 리포트를 저장 못 하는" 사고가 난다.
 *   ㉮ 만 확인하고 ㉯ 를 빼면 "잠갔다고 착각하는" 거짓 초록불이 된다.
 *
 * ★ 실행 전제
 *   firebase emulators (database) 가 필요하다. 에뮬레이터가 없으면
 *   'SKIPPED(에뮬레이터 없음)' 을 출력하고 exit 0 하지 않는다 — exit 2 로
 *   "미측정"임을 분명히 남긴다. 측정하지 않은 것을 통과로 두지 않는다.
 *
 * 사용:
 *   node scripts/gates/rules_guard_gate.mjs --self-test
 *   node scripts/gates/rules_guard_gate.mjs            (에뮬레이터 필요)
 */

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const RULES = path.join(ROOT, 'database.rules.json');

const HOST = process.env.RTDB_EMU_HOST || '127.0.0.1';
const PORT = Number(process.env.RTDB_EMU_PORT || 9000);
const NS   = process.env.RTDB_EMU_NS || 'lifeporfolio-default-rtdb';

const UID   = 'testuid_owner_0001';
const OTHER = 'testuid_stranger_9999';

/** 에뮬레이터 인증 우회 토큰 (emulator 전용 형식) */
function ownerAuth(uid) {
  return encodeURIComponent(JSON.stringify({ uid }));
}

/* ───────────────────────── 규칙 파일 정적 검사 ───────────────────────── */

export function loadRules() {
  return JSON.parse(fs.readFileSync(RULES, 'utf8'));
}

/** 점 경로로 규칙 노드 얻기 */
export function nodeAt(rules, segs) {
  let n = rules.rules;
  for (const s of segs) {
    if (!n || typeof n !== 'object') return undefined;
    n = n[s];
  }
  return n;
}

export function hasGuard(rules, segs) {
  const n = nodeAt(rules, segs);
  if (!n || typeof n !== 'object') return { ok: false, why: '경로 없음' };
  const g = n['$other'];
  if (!g) return { ok: false, why: '$other 없음' };
  if (g['.validate'] !== false) return { ok: false, why: `$other.validate=${JSON.stringify(g['.validate'])}` };
  return { ok: true, why: '$other .validate=false' };
}

/** 같은 층에 이름있는 와일드카드($sid 등)가 있으면 $other 추가 불가 */
export function wildcardConflict(rules, segs) {
  const n = nodeAt(rules, segs);
  if (!n || typeof n !== 'object') return null;
  const wild = Object.keys(n).filter(k => k.startsWith('$') && k !== '$other');
  return wild.length ? wild : null;
}

/** 승인 대상 4경로 — 적용 가능/불가를 구조로 판정한다 */
export const APPROVED = [
  { label: 'reports/$uid/$sid',  segs: ['reports', '$uid', '$sid'] },
  { label: 'programs/$uid/$sid', segs: ['programs', '$uid', '$sid'] },
  { label: 'users/$uid',         segs: ['users', '$uid'] },
  { label: 'responses/$uid',     segs: ['responses', '$uid'] }
];

/** payments 는 미접촉이어야 한다 (원래 있던 자물쇠가 그대로여야 함) */
export const UNTOUCHED = [
  { label: 'payments/$uid', segs: ['payments', '$uid'] },
  { label: 'payments/$uid/_pending', segs: ['payments', '$uid', '_pending'] }
];

export function staticAudit(rules) {
  const rows = [];
  for (const t of APPROVED) {
    const conflict = wildcardConflict(rules, t.segs);
    const g = hasGuard(rules, t.segs);
    rows.push({
      path: t.label,
      guard: g.ok,
      detail: g.why,
      blocked: conflict ? `와일드카드 ${conflict.join(',')} 와 충돌 — 같은 층 $other 불가` : null
    });
  }
  for (const t of UNTOUCHED) {
    const g = hasGuard(rules, t.segs);
    rows.push({ path: t.label + ' (미접촉 확인)', guard: g.ok, detail: g.why, blocked: null });
  }
  return rows;
}

/* ───────────────────────── 에뮬레이터 실측 ───────────────────────── */

function req(method, urlPath, body, auth) {
  return new Promise((resolve, reject) => {
    const q = `ns=${NS}` + (auth ? `&auth_variable_override=${auth}` : '');
    const data = body === undefined ? null : JSON.stringify(body);
    // ★ 실측으로 확정한 사실: 에뮬레이터에서 auth_variable_override 만으로는
    //   인증으로 인정되지 않는다 (전부 401 = 거짓 빨간불). owner 토큰 헤더를
    //   함께 보내야 auth != null 이 성립한다. 이 두 줄이 없으면 양성 0/3 이 나오고
    //   "자물쇠가 다 막는다"는 잘못된 안심을 하게 된다.
    const headers = data
      ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
      : {};
    if (auth) headers['Authorization'] = 'Bearer owner';
    const r = http.request({
      host: HOST, port: PORT, method,
      path: `${urlPath}?${q}`,
      headers
    }, res => {
      let buf = '';
      res.on('data', c => (buf += c));
      res.on('end', () => resolve({ status: res.statusCode, body: buf }));
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function emulatorUp() {
  try { const r = await req('GET', '/.json', undefined, ownerAuth(UID)); return r.status < 500; }
  catch { return false; }
}

/**
 * 검사 케이스: 각 항목은 { name, path, payload, expect: 'allow'|'deny', auth }
 * 양성 = 정의된 키만 담은 정상 쓰기 → allow
 * 음성 = 정의되지 않은 키를 섞은 쓰기 → deny
 */
export function buildCases() {
  const ok = ownerAuth(UID);
  const sid = 'sid_test_0001';
  return [
    /* users/$uid — 자물쇠 추가 대상 */
    { name: 'users 정상키만 (양성)', path: `/users/${UID}.json`, auth: ok, expect: 'allow',
      payload: { email: 'a@b.com', displayName: '홍길동', createdAt: '2026-08-28T00:00:00Z', lastLogin: '2026-08-28T00:00:00Z' } },
    { name: 'users 미정의키 혼입 (음성)', path: `/users/${UID}.json`, auth: ok, expect: 'deny',
      payload: { email: 'a@b.com', displayName: '홍길동', createdAt: '2026-08-28T00:00:00Z', role: 'admin' } },
    { name: 'users 미정의키 단독 (음성)', path: `/users/${UID}/role.json`, auth: ok, expect: 'deny', payload: 'admin' },

    /* reports/$uid/$sid — 자물쇠 추가 대상 */
    { name: 'reports 정상키만 (양성)', path: `/reports/${UID}/${sid}.json`, auth: ok, expect: 'allow',
      payload: { sid, generatedAt: 1756339200000, engineVersion: 'v1.3', lang: 'ko' } },
    { name: 'reports 미정의키 혼입 (음성)', path: `/reports/${UID}/${sid}_b.json`, auth: ok, expect: 'deny',
      payload: { sid: sid + '_b', generatedAt: 1756339200000, injected: 'x' } },

    /* programs/$uid/$sid — 자물쇠 추가 대상 */
    { name: 'programs 정상키만 (양성)', path: `/programs/${UID}/${sid}.json`, auth: ok, expect: 'allow',
      payload: { sid, generatedAt: 1756339200000, engineVersion: 'v1.3', lang: 'ko' } },
    { name: 'programs 미정의키 혼입 (음성)', path: `/programs/${UID}/${sid}_b.json`, auth: ok, expect: 'deny',
      payload: { sid: sid + '_b', generatedAt: 1756339200000, injected: 'x' } },

    /* 소유권 통제군 — 자물쇠와 무관하게 원래 막혀 있어야 한다 */
    { name: '타인 uid 쓰기 (음성·통제군)', path: `/users/${OTHER}.json`, auth: ok, expect: 'deny',
      payload: { email: 'x@y.com' } },
    { name: '비로그인 쓰기 (음성·통제군)', path: `/users/${UID}.json`, auth: null, expect: 'deny',
      payload: { email: 'x@y.com' } },

    /* payments 미접촉 확인 — 원래 있던 자물쇠가 지금도 작동해야 한다 */
    { name: 'payments 미정의키 (음성·회귀)', path: `/payments/${UID}.json`, auth: ok, expect: 'deny',
      payload: { paid: true, createdAt: '2026-08-28T00:00:00Z', hacked: 1 } }
  ];
}

async function runCases() {
  const cases = buildCases();
  const rows = [];
  for (const c of cases) {
    let status = null, err = null;
    try { const r = await req('PUT', c.path, c.payload, c.auth); status = r.status; }
    catch (e) { err = String(e && e.message); }
    const allowed = status !== null && status >= 200 && status < 300;
    const actual = err ? 'error' : (allowed ? 'allow' : 'deny');
    rows.push({ name: c.name, expect: c.expect, actual, status, err, pass: actual === c.expect });
  }
  return rows;
}

/* ───────────────────────── 자기 검사 ───────────────────────── */

export function selfTest() {
  const checks = [];
  const T = (n, c) => checks.push({ n, ok: !!c });

  const good = { rules: { a: { $uid: { x: {}, $other: { '.validate': false } } } } };
  const bad1 = { rules: { a: { $uid: { x: {} } } } };
  const bad2 = { rules: { a: { $uid: { x: {}, $other: { '.validate': true } } } } };
  const wild = { rules: { a: { $uid: { _k: {}, $sid: {} } } } };

  T('guard_detected',            hasGuard(good, ['a', '$uid']).ok === true);
  T('missing_guard_detected',    hasGuard(bad1, ['a', '$uid']).ok === false);
  T('validate_true_not_accepted', hasGuard(bad2, ['a', '$uid']).ok === false);
  T('absent_path_not_ok',        hasGuard(good, ['zzz', '$uid']).ok === false);
  T('wildcard_conflict_found',   Array.isArray(wildcardConflict(wild, ['a', '$uid'])));
  T('no_conflict_when_only_other', wildcardConflict(good, ['a', '$uid']) === null);

  const cs = buildCases();
  T('has_positive_cases', cs.filter(c => c.expect === 'allow').length >= 3);
  T('has_negative_cases', cs.filter(c => c.expect === 'deny').length >= 5);
  T('has_ownership_control', cs.some(c => c.name.includes('타인 uid')));
  T('has_unauth_control',    cs.some(c => c.name.includes('비로그인')));
  T('has_payments_regression', cs.some(c => c.name.includes('payments')));
  T('every_case_has_expect', cs.every(c => c.expect === 'allow' || c.expect === 'deny'));

  const real = loadRules();
  T('real_rules_parse', !!real.rules);
  T('payments_guard_still_present', hasGuard(real, ['payments', '$uid']).ok === true);

  const fail = checks.filter(c => !c.ok);
  console.log(`[rules-matrix] 자기검사 ${checks.length - fail.length}/${checks.length}`);
  for (const f of fail) console.log(`  FAIL ${f.n}`);
  return fail.length === 0;
}

/* ───────────────────────── CLI ───────────────────────── */

const isMain = process.argv[1] && process.argv[1].endsWith('rules_guard_gate.mjs');
if (isMain) {
  if (!selfTest()) process.exit(1);
  if (process.argv.includes('--self-test')) process.exit(0);

  const rules = loadRules();
  console.log('\n=== 1단계: 규칙 파일 정적 감사 ===');
  const sa = staticAudit(rules);
  for (const r of sa) {
    const mark = r.guard ? '자물쇠 있음' : (r.blocked ? '적용 불가' : '자물쇠 없음');
    console.log(`  ${r.guard ? 'OK  ' : '    '} ${r.path.padEnd(34)} ${mark}  ${r.blocked || r.detail}`);
  }

  const up = await emulatorUp();
  console.log('\n=== 2단계: 에뮬레이터 양성·음성 실측 ===');
  if (!up) {
    console.log('  미측정 — RTDB 에뮬레이터에 연결할 수 없다 (127.0.0.1:9000).');
    console.log('  실행법: npx firebase emulators:start --only database --project lifeporfolio');
    console.log('  ⚠ 미측정을 통과로 두지 않는다. exit 2.');
    process.exit(2);
  }
  const rows = await runCases();
  const pos = rows.filter(r => r.expect === 'allow');
  const neg = rows.filter(r => r.expect === 'deny');
  for (const r of rows) {
    console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.name.padEnd(32)} 기대=${r.expect} 실제=${r.actual} (HTTP ${r.status ?? '-'})`);
  }
  const bad = rows.filter(r => !r.pass);
  console.log(`\n요약: 양성 ${pos.filter(r => r.pass).length}/${pos.length} · 음성 ${neg.filter(r => r.pass).length}/${neg.length} · 실패 ${bad.length}`);
  process.exit(bad.length ? 1 : 0);
}
