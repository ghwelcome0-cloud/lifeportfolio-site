// scripts/gates/security_posture_gate.mjs
// ⑦축(보안 취약성) 측정 게이트 — 2026-08-28 신설
//   대표님 지시: "보안 취약성" 을 평가 항목화.
//   배경(실측): 보안 스크립트 3개(audit_check.sh, internal-evidence-dlp-lib.mjs,
//               test-internal-evidence-dlp.mjs)가 있었으나 package.json 내
//               security/csp/audit 명칭 npm script 는 0건이었다.
//
//   ★ 범위 제약 (기확정)
//     CSP enforcing 전환 = NO-GO 확정. 결제(Payple/PayPal)·Firebase·GA 등 외부 스크립트
//     다수를 끊을 위험이 있어 대표님 판정으로 제외됐다. 따라서 이 게이트는
//     Report-Only 운영 자체를 감점 사유로 두지 않고, "보고 수집·검토 운영"을 득점 요건으로 둔다.
//
//   설계 원칙
//     · 결정론적 · 난수 0회.
//     · 오프라인 기본 — 라이브 헤더 확인은 --live 로만 수행한다(CI 네트워크 의존 배제).
//     · 실측만 보고 — 확인하지 못한 것은 unmeasured 로 명시한다.
//
//   ⚠️ 한계 (정직 고지)
//     이 게이트는 헤더의 *존재*와 값의 *형태*를 본다. 값의 *타당성*은 별개다.
//     예: Cross-Origin-Opener-Policy: unsafe-none 은 명시적으로 완화된 값이며
//     (결제 팝업 요구로 추정) 이 게이트는 그 완화가 정당한지 판정하지 않는다.
//     존재와 적정은 다르다.
//
//   사용법
//     node scripts/gates/security_posture_gate.mjs            오프라인 측정
//     node scripts/gates/security_posture_gate.mjs --live      라이브 헤더까지
//     node scripts/gates/security_posture_gate.mjs --json      원자료

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ROOT = process.env.SEC_ROOT || process.cwd();
const LIVE_ORIGIN = process.env.SEC_LIVE_ORIGIN || 'https://lifeportfolio.co.kr';

// 필수 응답 헤더 — 이름과 최소 조건.
export const REQUIRED_HEADERS = [
  { key: 'strict-transport-security', must: /max-age=\d{7,}/i, note: 'HSTS 1년 이상' },
  { key: 'x-frame-options', must: /DENY|SAMEORIGIN/i, note: '프레임 삽입 차단' },
  { key: 'x-content-type-options', must: /nosniff/i, note: 'MIME 스니핑 차단' },
  { key: 'referrer-policy', must: /strict-origin|no-referrer/i, note: '리퍼러 최소화' },
  { key: 'permissions-policy', must: /geolocation=\(\)/i, note: '민감 기능 차단' },
  { key: 'content-security-policy', must: /frame-ancestors\s+'none'/i, note: 'CSP 최소 지시자' }
];

function readJson(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return null; }
}

/** 항목1 — firebase.json 에 선언된 헤더 (정적) */
export function checkDeclaredHeaders() {
  const fb = readJson('firebase.json');
  if (!fb) return { ok: false, err: 'firebase.json 없음' };
  const blob = JSON.stringify(fb).toLowerCase();
  const found = REQUIRED_HEADERS.map(h => ({
    key: h.key,
    declared: blob.includes(`"key":"${h.key}"`) || blob.includes(`"key": "${h.key}"`),
    note: h.note
  }));
  return { ok: found.every(f => f.declared), headers: found };
}

/**
 * 항목2 — 의존성 취약점.
 *
 * ★ 2026-08-28 정정 (거짓 초록불 결함 BT):
 *   종전 구현은 루트 package.json 의 dependencies 만 세어 `runtimeExposed:false` 를 보고했다.
 *   그러나 이 저장소의 고객 실행 코드는 두 곳에 있다.
 *     ㉮ 정적 호스팅 (dist/hosting) — 런타임 npm 의존 없음. 종전 판정이 맞다.
 *     ㉯ Cloud Functions (functions/) — 별도 package.json 에 런타임 의존 5개.
 *   ㉯ 를 세지 않았으므로 "고객 배포 노출 없음" 은 사실이 아니었다.
 *   ⑦축 발주 회신(S-2)의 지적이 옳았고, 실측으로 functions 런타임 moderate 9건을 확인했다.
 *   이제 두 표면을 각각 보고하고, 노출 판정은 둘의 합집합으로 한다.
 *
 *   functions/package-lock.json 이 저장소에 없으므로 functions 취약점 개수는
 *   이 게이트가 오프라인에서 확정할 수 없다 ⇒ 개수는 '미측정' 으로 라벨하고
 *   런타임 의존이 존재한다는 사실만 확정 보고한다. (측정하지 않은 것을 초록불로 만들지 않는다)
 */
export function checkDependencies() {
  const pkg = readJson('package.json') || {};
  const runtimeDeps = Object.keys(pkg.dependencies || {});
  const fnPkg = readJson('functions/package.json') || {};
  const fnRuntimeDeps = Object.keys(fnPkg.dependencies || {});
  const fnLockPresent = fs.existsSync(path.join(ROOT, 'functions/package-lock.json'));
  let audit = null;
  try {
    const raw = execSync('npm audit --json --cache /tmp/npmcache', {
      cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 32 * 1024 * 1024
    });
    audit = JSON.parse(raw);
  } catch (e) {
    // npm audit 는 취약점이 있으면 비0 종료한다. stdout 은 여전히 유효하다.
    try { audit = JSON.parse(e.stdout || '{}'); } catch (_) { audit = null; }
  }
  if (!audit || !audit.metadata) {
    return { ok: false, unmeasured: true, note: 'npm audit 실행 실패 (오프라인일 수 있음)' };
  }
  const v = audit.metadata.vulnerabilities || {};
  const direct = Object.values(audit.vulnerabilities || {})
    .filter(x => x.isDirect).map(x => `${x.name}(${x.severity})`).sort();
  const hostingRuntimeExposed = runtimeDeps.length > 0;
  const functionsRuntimeExposed = fnRuntimeDeps.length > 0;
  return {
    // 루트 audit 은 빌드 도구 표면에 대한 판정이다.
    ok: (v.critical || 0) === 0 && (v.high || 0) === 0,
    counts: v,
    direct,
    // ㉮ 정적 호스팅 표면
    runtimeDependencyCount: runtimeDeps.length,
    hostingRuntimeExposed,
    // ㉯ Cloud Functions 표면 — 이것을 세지 않은 것이 종전 결함이었다
    functionsRuntimeDependencyCount: fnRuntimeDeps.length,
    functionsRuntimeDeps: fnRuntimeDeps,
    functionsRuntimeExposed,
    functionsLockfilePresent: fnLockPresent,
    functionsAuditCounts: fnLockPresent ? 'lockfile 존재 — 별도 audit 필요' : '미측정 (functions/package-lock.json 부재)',
    // ★ 노출 판정 = 두 표면의 합집합. 한쪽이라도 런타임 의존이 있으면 '있음'.
    runtimeExposed: hostingRuntimeExposed || functionsRuntimeExposed,
    unmeasuredNote: fnLockPresent
      ? 'functions 취약점 개수는 별도 audit 대상'
      : 'functions 런타임 의존 존재는 확정, 취약점 개수는 미측정 (lockfile 부재)'
  };
}

/** 항목3 — 관리자 표면이 공개 도메인에서 404 로 계약되어 있는지 (정적 계약 확인) */
export function checkAdminSurfaceContract() {
  const p = path.join(ROOT, 'scripts/regular-inspection.mjs');
  if (!fs.existsSync(p)) return { ok: false, err: 'regular-inspection.mjs 없음' };
  const s = fs.readFileSync(p, 'utf8');
  const m = s.match(/MUST_BE_404\s*=\s*\[([\s\S]{0,2000}?)\]/);
  if (!m) return { ok: false, err: 'MUST_BE_404 선언 없음' };
  const paths = [...m[1].matchAll(/["']([^"']+)["']/g)].map(x => x[1]);
  return { ok: paths.length > 0, count: paths.length, paths };
}

/** 항목4 — 비밀정보 유출 방지 장치 존재 */
export function checkSecretHygiene() {
  const dlp = ['scripts/internal-evidence-dlp-lib.mjs', 'scripts/test-internal-evidence-dlp.mjs']
    .filter(f => fs.existsSync(path.join(ROOT, f)));
  const digests = readJson('internal/evidence/evidence-digests.json');
  // ★ 경로 주의: 계약 파일은 internal/ 직하가 아니라 internal/evidence/ 안에 있다.
  //   초판에서 'internal/evidence-contract.json' 로 잘못 조회해 status=null 이 나왔고,
  //   그 null 이 "계약 부재"로 오판될 수 있었다(거짓 빨간불). 실측으로 정정.
  const contract = readJson('internal/evidence/evidence-contract.json');
  const gitignore = fs.existsSync(path.join(ROOT, '.gitignore'))
    ? fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8') : '';
  return {
    ok: dlp.length === 2 && !!contract,
    dlpScripts: dlp.length,
    evidenceContractStatus: contract ? (contract.status || null) : null,
    migrationModel: contract ? (contract.migration_model || null) : null,
    protectedPathCount: digests && digests.files ? Object.keys(digests.files).length : null,
    envIgnored: /(^|\n)\.env|\.dev\.vars/.test(gitignore)
  };
}

/** 항목5 — 공개 표면 최소화 (allow-list 방식 유지 확인) */
export function checkPublicSurface() {
  const p = path.join(ROOT, 'scripts/hosting-allowlist.mjs');
  if (!fs.existsSync(p)) return { ok: false, err: 'hosting-allowlist.mjs 없음' };
  const s = fs.readFileSync(p, 'utf8');
  // ★ docs/ 가 allow-list 에 들어가면 내부 문서가 공개된다(배포헌법 제1조).
  const docsExposed = /docs\//.test(s);
  return { ok: !docsExposed, docsExposed, bytes: s.length };
}

/** 항목6 — CSP 관측 운영 (Report-Only + 보고 엔드포인트) */
export function checkCspObservability() {
  const fb = readJson('firebase.json');
  if (!fb) return { ok: false, err: 'firebase.json 없음' };
  const blob = JSON.stringify(fb);
  return {
    ok: /Content-Security-Policy-Report-Only/i.test(blob) && /report-uri|Reporting-Endpoints/i.test(blob),
    reportOnly: /Content-Security-Policy-Report-Only/i.test(blob),
    reportEndpoint: /report-uri|Reporting-Endpoints/i.test(blob),
    // ★ 주기 검토 기록은 코드로 확인할 수 없다 — 문서 존재 여부로만 근사한다.
    reviewLogPresent: fs.existsSync(path.join(ROOT, 'docs/csp-report-review-log.md')),
    enforcingNote: 'enforcing 전환 = NO-GO 확정 (결제/Firebase/GA 차단 위험)'
  };
}

/** --live: 실제 응답 헤더 확인 */
export function checkLiveHeaders() {
  let raw = '';
  try {
    raw = execSync(`curl -sSI --max-time 15 ${LIVE_ORIGIN}/`, { encoding: 'utf8' });
  } catch (_) {
    return { ok: false, unmeasured: true, note: '라이브 접근 실패 (네트워크 차단일 수 있음)' };
  }
  const low = raw.toLowerCase();
  const rows = REQUIRED_HEADERS.map(h => {
    const line = low.split('\n').find(l => l.startsWith(h.key + ':')) || '';
    return { key: h.key, present: !!line, satisfies: h.must.test(line), note: h.note };
  });
  return { ok: rows.every(r => r.present && r.satisfies), headers: rows };
}

// ── 음성 통제군 ────────────────────────────────────────────────────────────
// 검사기가 실제로 결함을 잡는지 증명한다 (결함 BT).
export function selfTest() {
  const checks = [];
  // ㉮ 필수 헤더 목록이 비어 있지 않은가 (빈 목록이면 항상 통과하는 거짓 초록불)
  checks.push(['required_headers_nonempty', REQUIRED_HEADERS.length >= 6]);
  // ㉯ 헤더 정규식이 실제로 값을 가린다 (아무 값이나 통과시키지 않는다)
  const hsts = REQUIRED_HEADERS.find(h => h.key === 'strict-transport-security');
  checks.push(['hsts_regex_rejects_short', !hsts.must.test('strict-transport-security: max-age=60')]);
  checks.push(['hsts_regex_accepts_year', hsts.must.test('strict-transport-security: max-age=31536000')]);
  const xfo = REQUIRED_HEADERS.find(h => h.key === 'x-frame-options');
  checks.push(['xfo_regex_rejects_allowall', !xfo.must.test('x-frame-options: allowall')]);
  const csp = REQUIRED_HEADERS.find(h => h.key === 'content-security-policy');
  checks.push(['csp_regex_rejects_empty', !csp.must.test("content-security-policy: default-src 'self'")]);
  // ㉰ docs 노출 검출이 동작하는가
  checks.push(['docs_exposure_detect', /docs\//.test("ALLOW = ['docs/x.md']") === true]);

  // ㉱ ★ 2026-08-28 추가 — 런타임 표면 누락(거짓 초록불 BT) 재발 방지
  //    종전 결함: 루트 dependencies 만 세고 functions/ 를 세지 않아
  //    "고객 배포 노출 없음" 을 보고했다. 실제로는 functions 런타임 의존 5개가 있었다.
  const dep = checkDependencies();
  //    ㉱-1 functions 표면을 실제로 읽고 있는가 (필드 자체가 존재해야 한다)
  checks.push(['functions_surface_is_counted',
    typeof dep.functionsRuntimeDependencyCount === 'number']);
  //    ㉱-2 저장소에 functions 런타임 의존이 존재하는데 노출을 '없음' 으로 보고하지 않는가
  const fnPkgReal = readJson('functions/package.json') || {};
  const fnDepsReal = Object.keys(fnPkgReal.dependencies || {});
  checks.push(['functions_deps_not_silently_dropped',
    fnDepsReal.length === 0 ? true : dep.runtimeExposed === true]);
  //    ㉱-3 노출 판정이 합집합인가 — 한쪽만 0이어도 다른 쪽이 있으면 '있음'
  checks.push(['exposure_is_union_not_root_only',
    dep.runtimeExposed === (dep.hostingRuntimeExposed || dep.functionsRuntimeExposed)]);
  //    ㉱-4 lockfile 부재를 0건으로 세탁하지 않는가 (미측정 라벨 유지)
  checks.push(['missing_lockfile_labeled_unmeasured',
    dep.functionsLockfilePresent === true ||
    /미측정/.test(String(dep.functionsAuditCounts))]);

  const failed = checks.filter(([, ok]) => !ok).map(([k]) => k);
  return { passed: failed.length === 0, total: checks.length, failed };
}

// ── CLI ───────────────────────────────────────────────────────────────────
const isMain = process.argv[1] && process.argv[1].endsWith('security_posture_gate.mjs');
if (isMain) {
  const argv = process.argv.slice(2);
  const wantJson = argv.includes('--json');
  const wantLive = argv.includes('--live');

  const st = selfTest();
  console.log(`[sec-gate] 음성 통제군: ${st.passed ? 'PASS' : 'FAIL'} (${st.total - st.failed.length}/${st.total})`);
  if (!st.passed) {
    console.error(`[sec-gate] 실패 항목: ${st.failed.join(', ')}`);
    process.exit(1);
  }

  const result = {
    h1_declaredHeaders: checkDeclaredHeaders(),
    h2_dependencies: checkDependencies(),
    h3_adminSurface: checkAdminSurfaceContract(),
    h4_secretHygiene: checkSecretHygiene(),
    h5_publicSurface: checkPublicSurface(),
    h6_cspObservability: checkCspObservability()
  };
  if (wantLive) result.live = checkLiveHeaders();

  if (wantJson) { console.log(JSON.stringify(result, null, 1)); process.exit(0); }

  console.log('\n[sec-gate] ⑦축 보안 취약성 측정');
  const H = result.h1_declaredHeaders;
  console.log(`  1 전송·헤더 선언  : ${H.ok ? 'OK' : 'MISS'} (${(H.headers || []).filter(x => x.declared).length}/${REQUIRED_HEADERS.length})`);
  const D = result.h2_dependencies;
  if (D.unmeasured) console.log('  2 의존성 취약점   : 미측정 — ' + D.note);
  else console.log(`  2 의존성 취약점   : ${D.ok ? 'OK' : 'FAIL'} critical=${D.counts.critical} high=${D.counts.high} moderate=${D.counts.moderate}` +
    `\n                      (위 수치는 루트 = 빌드·검사 도구 표면)` +
    `\n                      직접 의존: ${D.direct.join(', ') || '없음'}` +
    `\n                      ㉮ 정적 호스팅 런타임 의존 ${D.runtimeDependencyCount}개 ⇒ 노출 ${D.hostingRuntimeExposed ? '있음' : '없음'}` +
    `\n                      ㉯ Cloud Functions 런타임 의존 ${D.functionsRuntimeDependencyCount}개 ⇒ 노출 ${D.functionsRuntimeExposed ? '있음' : '없음'}` +
    `\n                         ${D.functionsRuntimeDeps.join(', ') || '없음'}` +
    `\n                         취약점 개수: ${D.functionsAuditCounts}` +
    `\n                      ⇒ 합집합 고객 배포 노출: ${D.runtimeExposed ? '있음' : '없음'}`);
  console.log(`  3 관리자 표면 계약: ${result.h3_adminSurface.ok ? 'OK' : 'FAIL'} (404 계약 ${result.h3_adminSurface.count}경로)`);
  const S = result.h4_secretHygiene;
  console.log(`  4 비밀정보 위생   : ${S.ok ? 'OK' : 'FAIL'} DLP ${S.dlpScripts}/2 · evidence ${S.evidenceContractStatus} · ${S.migrationModel}`);
  const PS = result.h5_publicSurface;
  console.log(`  5 공개 표면 최소화: ${PS.ok ? 'OK' : 'FAIL'} docs 노출 ${PS.docsExposed ? '있음(위반)' : '없음'}`);
  const C = result.h6_cspObservability;
  console.log(`  6 CSP 관측 운영   : ${C.ok ? 'OK' : 'FAIL'} Report-Only ${C.reportOnly} · 보고엔드포인트 ${C.reportEndpoint} · 검토로그 ${C.reviewLogPresent}`);
  if (result.live) {
    const L = result.live;
    if (L.unmeasured) console.log(`  L 라이브 헤더     : 미측정 — ${L.note}`);
    else {
      console.log(`  L 라이브 헤더     : ${L.ok ? 'OK' : 'FAIL'}`);
      L.headers.forEach(r => console.log(`      ${r.present ? '●' : '○'} ${r.key} ${r.satisfies ? '' : '(값 미충족)'}`));
    }
  }
  console.log('\n[sec-gate] 미측정 (정직 고지)');
  console.log('  · 헤더 값의 *타당성* — COOP: unsafe-none 의 정당성은 판정하지 않는다');
  console.log('  · 침투 테스트 · 인증/인가 런타임 검증 — 이 게이트의 범위 밖');
  console.log('  · CSP 보고 실제 수집량 — Cloud Functions 로그 필요');
  console.log('  · functions/ 취약점 개수 — functions/package-lock.json 부재로 이 게이트가 확정하지 못한다');
  console.log('  · 항목6 은 서식 파일 존재만 본다 — canary 수신·검토 최신성은 판정하지 않는다');
  process.exit(0);
}
