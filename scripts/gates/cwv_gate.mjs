#!/usr/bin/env node
/**
 * Core Web Vitals 실측 게이트 (cwv_gate.mjs)
 * ─────────────────────────────────────────────────────────────────────
 * 근거 문서: docs/품질기준서_홈페이지품질_2026-08-28.md §2 (㉮ 기능층)
 * 정본 기준: https://web.dev/articles/vitals
 *
 * 무엇을 재는가
 *   실제 브라우저(Chrome)로 페이지를 띄우고 PerformanceObserver 로
 *   LCP(가장 큰 콘텐츠가 그려진 시각) 와 CLS(지면이 밀린 정도) 를 잰다.
 *   CSS/HTML 문자열을 정규식으로 추정하지 않는다 — 실측이다.
 *
 * 임계값 (정본 그대로. 여기를 임의로 완화하면 게이트가 무의미해진다)
 *   · LCP <= 2500 ms
 *   · CLS <= 0.1
 *   · INP <= 200 ms   ← 사용자 입력이 있어야 측정되므로 Lab 에서는 측정 불가.
 *                        측정하지 못한 것을 통과로 적지 않는다(결함 BT 방지).
 *
 * ★★★ 왜 file:// 로 재면 안 되는가 — 2026-08-31 실측으로 확인한 측정 오류
 *   assets/i18n/i18n.js 는 번역 파일을 fetch() 로 불러온다.
 *   file:// 에서는 이 fetch 가 조용히 실패해서 번역이 끝까지 로드되지 않고,
 *   화면에 한국어 대신 번역 키(hero.cta_primary 같은 문자열)가 그대로 그려진다.
 *   글자가 달라지면 요소 너비가 달라지고, 너비가 달라지면 상단 메뉴 줄바꿈이
 *   달라지고, 줄바꿈이 달라지면 CLS 값이 달라진다.
 *   실제로 이 오류 때문에 "수정했는데 CLS 가 그대로다"라는 거짓 음성이 나왔다.
 *   ⇒ 그래서 이 게이트는 스스로 HTTP 서버를 띄운다. file:// 는 아예 쓰지 않는다.
 *      (selfTest 가 소스에 file:// 가 없는지 직접 검사한다)
 *
 * 왜 외부 요청을 차단하는가
 *   구글 폰트·애널리틱스·CDN 응답 속도는 우리가 통제할 수 없다.
 *   측정할 때마다 값이 흔들리면 개선 여부를 판정할 수 없다.
 *   ⇒ 우리 지면(localhost) 요청만 통과시키고 나머지는 차단해 재현성을 확보한다.
 *      단, 차단했다는 사실을 결과에 반드시 남긴다(측정 조건 은폐 금지).
 *
 * ★ 이것은 Lab(실험실) 측정이다 — Google 규격의 p75 필드 측정이 아니다.
 *   실제 사용자 75% 지점 값은 실사용자 데이터(CrUX/RUM)가 있어야 나온다.
 *   우리는 그 데이터가 없다. 그래서 결과에 항상 measurementType: "lab" 을 적는다.
 *   이 구분을 흐리고 "필드 통과"라고 말하면 결함 AY(기준 흐리기)다.
 *
 * 왜 PC 와 모바일을 따로 재는가
 *   ⑥축 측정 원칙: PC 1440px / 모바일 390px 각각 채점, 점수는 "낮은 쪽".
 *   합치거나 평균 내지 않는다.
 *
 * 사용법
 *   node scripts/gates/cwv_gate.mjs --self-test
 *   node scripts/gates/cwv_gate.mjs
 *   node scripts/gates/cwv_gate.mjs --json
 *
 * 종료 코드
 *   0 = 실행 성공 (측정 완료). 임계값 초과만으로는 1 을 내지 않는다.
 *       ⇒ 이 게이트는 "현재 상태를 정직하게 재는" 계측기다. 개선 판정은
 *         improvement_delta_gate 가 baseline 대조로 한다.
 *   1 = 실행 실패 (브라우저 불가 · 서버 불가 · 파일 없음 · selfTest 실패)
 */

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

/* ── 임계값 (정본 https://web.dev/articles/vitals 그대로) ── */
export const LCP_MAX_MS = 2500;
export const CLS_MAX = 0.1;
export const INP_MAX_MS = 200;

/* ── 뷰포트 (⑥축 측정 원칙과 동일한 값) ── */
export const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844, deviceScaleFactor: 3, isMobile: true },
  { name: 'desktop', width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false },
];

/* ── 측정 대상 (고객이 실제로 밟는 핵심 경로) ── */
export const CORE_PAGES = [
  'index.html',
  'report.html',
  'program.html',
  'b2b.html',
  'checkin-21.html',
  'b2b-quote.html',
  /* ★ 아래는 2026-08-31 에 추가했다.
       이유: b2b.html 에서 폰트 교체로 인한 CLS 0.2068 결함이 나왔고,
       같은 조건(웹폰트 swap + 높이 예약 없는 가변 텍스트 블록)을 가진 지면이
       더 있다는 것을 grep 으로 확인했다. 재지 않으면 결함이 있는지 알 수 없다.
       "재지 않은 것을 통과로 적지 않는다"가 이 게이트의 원칙이다. */
  'lead.html',
  'report-landing.html',
  'interpretation.html',
  /* ★ 아래 3지면은 같은 날(2026-08-31) 임시 스크립트로 먼저 실측했고,
       전량 통과(24/24)를 문서(품질기준서 v1.1 §2-5)에 적었다.
       그런데 게이트 목록에는 넣지 않아서, 문서가 주장하는 범위를
       게이트가 스스로 재현할 수 없는 상태가 되었다.
       "문서가 말하는 것을 검사기가 재현할 수 있어야 한다"는 원칙에 따라 승격한다.
       (임시 스크립트 실측값: regenerate 976ms/0 · index-v2 1112ms/0.0024
        · action-program 612ms/0.0501 — 셋 다 임계값 이내이나 마지막은 관찰 대상) */
  'regenerate.html',
  'index-v2.html',
  'action-program.html',
];

/* ★★★ 반복 측정 횟수 — 이 게이트의 가장 중요한 설정
     왜 여러 번 재는가 (2026-08-31 실측으로 확인한 것):
       같은 페이지·같은 조건인데도 CLS 가 0.0019 ~ 0.2068 사이에서 요동쳤다.
       폰트·스크립트가 도착하는 순서가 매번 조금씩 달라서, 어떤 회차에는
       레이아웃 이동이 첫 그림 전에 끝나 CLS 에 안 잡히고, 어떤 회차에는
       첫 그림 후에 일어나 그대로 잡힌다.
       ⇒ 1회 측정으로 "통과"라고 말하면 그것은 운이지 증거가 아니다.
         실제로 1회 측정이 b2b.html 의 0.2068 결함을 0.0024 로 놓친 적이 있다.
     그래서 여러 번 재고 '최악값'을 채택한다. 평균이나 최소값을 쓰면
     결함을 감추게 된다(거짓 초록불 = 결함 BT). */
export const REPEATS = 5;

/* 페이지 로드 후 이 시간만큼 더 기다린다.
   지연 삽입되는 요소(ambient 박스, 로그인 메뉴 등)가 들어오면서 생기는
   레이아웃 이동을 놓치지 않으려는 것. 짧게 재면 CLS 가 실제보다 좋게 나온다. */
export const SETTLE_MS = 6000;

/* ══════════════════════════════════════════════════════════════════
   브라우저 안에서 실행되는 계측 코드
   ────────────────────────────────────────────────────────────────
   문자열로 주입되는 순수 함수여야 한다.
   바깥 스코프의 변수를 참조하면 브라우저 안에서 ReferenceError 가 난다.
   (touch_target_gate 와 같은 규약. selfTest 가 이를 검사한다)
   ══════════════════════════════════════════════════════════════ */
export const OBSERVE_FN = function () {
  window.__cwv = { lcp: 0, cls: 0, shifts: [] };

  try {
    new PerformanceObserver(function (list) {
      var es = list.getEntries();
      for (var i = 0; i < es.length; i++) {
        var e = es[i];
        /* LCP 는 계속 갱신된다 — 마지막 값이 최종 LCP */
        if (e.startTime > window.__cwv.lcp) window.__cwv.lcp = e.startTime;
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (err) {}

  try {
    new PerformanceObserver(function (list) {
      var es = list.getEntries();
      for (var i = 0; i < es.length; i++) {
        var e = es[i];
        /* 사용자 입력 직후 500ms 안의 이동은 CLS 에서 제외된다(정본 규정) */
        if (e.hadRecentInput) continue;
        window.__cwv.cls += e.value;

        /* 어느 요소가 밀렸는지 남긴다 — 원인 추적의 핵심.
           이 정보가 없으면 "CLS 가 나쁘다"만 알고 왜 나쁜지는 모른다. */
        var nodes = [];
        try {
          var srcs = e.sources || [];
          for (var j = 0; j < srcs.length && j < 4; j++) {
            var n = srcs[j].node;
            if (!n) continue;
            var tag = n.tagName || String(n.nodeName);
            var id = n.id ? '#' + n.id : '';
            var cls = '';
            if (n.className && typeof n.className === 'string') {
              cls = '.' + n.className.trim().split(/\s+/).slice(0, 2).join('.');
            }
            nodes.push(tag + id + cls);
          }
        } catch (err2) {}

        window.__cwv.shifts.push({
          value: Math.round(e.value * 10000) / 10000,
          at: Math.round(e.startTime),
          nodes: nodes,
        });
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch (err) {}
};

/* ══════════════════════════════════════════════════════════════════
   최소 정적 파일 서버
   ────────────────────────────────────────────────────────────────
   왜 npx http-server 를 쓰지 않는가:
     ① 네트워크에서 패키지를 받아와야 하므로 CI 에서 실패할 수 있다
     ② 버전이 바뀌면 동작이 달라져 재현성이 깨진다
   ⇒ 노드 내장 모듈만으로 직접 띄운다. 의존성 0개.
   ══════════════════════════════════════════════════════════════ */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

export function startServer(rootDir, port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let rel;
      try {
        rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      } catch (e) {
        res.writeHead(400).end('bad url');
        return;
      }
      if (rel.endsWith('/')) rel += 'index.html';

      /* 상위 경로 탈출(../) 차단 — 저장소 밖 파일이 새어 나가지 않게 한다 */
      const abs = path.resolve(rootDir, '.' + rel);
      if (!abs.startsWith(path.resolve(rootDir))) {
        res.writeHead(403).end('forbidden');
        return;
      }
      fs.readFile(abs, (err, buf) => {
        if (err) {
          res.writeHead(404, { 'Content-Type': 'text/plain' }).end('404');
          return;
        }
        res.writeHead(200, {
          'Content-Type': MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream',
          'Cache-Control': 'no-store',
        });
        res.end(buf);
      });
    });
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

/* ══════════════════════════════════════════════════════════════════
   판정
   ══════════════════════════════════════════════════════════════ */
export function verdict(lcp, cls) {
  return {
    lcpPass: lcp <= LCP_MAX_MS,
    clsPass: cls <= CLS_MAX,
    pass: lcp <= LCP_MAX_MS && cls <= CLS_MAX,
  };
}

/* ══════════════════════════════════════════════════════════════════
   selfTest — 음성 통제군
   ────────────────────────────────────────────────────────────────
   계측기가 고장난 채로 재면, 나온 숫자는 위안일 뿐 증거가 아니다.
   "나쁜 값을 넣으면 정말 실패로 판정하는가"를 먼저 확인한다.
   ══════════════════════════════════════════════════════════════ */
export function selfTest({ quiet = false } = {}) {
  /* --json 출력에 로그가 섞이면 JSON.parse 가 깨진다.
     touch_target_gate 와 같은 규약: quiet 모드에서는 stderr 로 보낸다. */
  const log = quiet ? (...a) => console.error(...a) : (...a) => console.log(...a);
  const checks = [];
  const t = (name, cond) => checks.push({ name, ok: !!cond });

  /* ── 임계값 정본 일치 ── */
  t('lcp_threshold_is_2500', LCP_MAX_MS === 2500);
  t('cls_threshold_is_0.1', CLS_MAX === 0.1);
  t('inp_threshold_is_200', INP_MAX_MS === 200);

  /* ── 판정 로직: 좋은 값은 통과, 나쁜 값은 반드시 실패 ── */
  t('good_values_pass', verdict(1200, 0.05).pass === true);
  t('bad_lcp_fails', verdict(3000, 0.05).pass === false);
  t('bad_cls_fails', verdict(1200, 0.2).pass === false);
  t('both_bad_fails', verdict(9999, 9).pass === false);
  /* 경계값을 관대하게 처리하면 거짓 초록불이 된다 */
  t('boundary_lcp_2500_is_pass', verdict(2500, 0).lcpPass === true);
  t('boundary_lcp_2501_is_fail', verdict(2501, 0).lcpPass === false);
  t('boundary_cls_0.1_is_pass', verdict(0, 0.1).clsPass === true);
  t('boundary_cls_0.1001_is_fail', verdict(0, 0.1001).clsPass === false);

  /* ── 뷰포트: ⑥축 원칙(PC 1440 / 모바일 390)과 일치해야 한다 ── */
  const mob = VIEWPORTS.find((v) => v.name === 'mobile');
  const desk = VIEWPORTS.find((v) => v.name === 'desktop');
  t('viewport_mobile_390', mob && mob.width === 390);
  t('viewport_desktop_1440', desk && desk.width === 1440);
  t('viewport_count_is_2', VIEWPORTS.length === 2);

  /* ── 측정 대상 파일이 실제로 있는가 (없는 파일을 재고 통과라 하면 거짓) ── */
  let missing = [];
  for (const f of CORE_PAGES) {
    if (!fs.existsSync(path.join(ROOT, f))) missing.push(f);
  }
  t('all_core_pages_exist', missing.length === 0);
  if (missing.length) log('   누락 파일:', missing.join(', '));

  /* ── ★ file:// 금지 규약 (이 게이트 존재 이유의 절반) ── */
  const src = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8');
  /* 주석의 설명문은 허용하되, 실제 코드에서 file:// URL 을 만들면 안 된다.
     검사 방법: 이 게이트가 브라우저에게 넘기는 주소는 page.goto(...) 뿐이다.
     그 인수가 http:// 로 시작하는지 직접 확인하고, 노드가 파일 경로를
     file:// URL 로 바꿔주는 함수(pathToFileURL)를 쓰지 않는지 확인한다.

     ※ 왜 소스 전체에서 금지 문자열을 찾지 않는가 — 실제로 두 번 겪은 오탐이다.
       처음에는 소스에서 file:// 패턴을 찾게 했더니 그 정규식 자체가 소스 안에
       있어서 스스로를 잡아 FAIL(27/28). 다음에는 금지 함수 이름을 찾게 했더니
       이 주석에 그 이름을 적어놨기 때문에 또 FAIL(28/29).
       검사기가 두 번이나 자기 자신을 결함으로 신고한 것이다.
       ⇒ 교훈: "금지 문자열이 없음"을 증명하는 검사는 주석·문서·검사식 자신까지
         걸려서 신뢰할 수 없다. 대신 "실제로 무엇을 했는가"를 좁은 범위에서
         확인한다. 여기서는 (a) page.goto 에 넘기는 주소, (b) import 문 목록.
         부재 증명보다 존재 증명이 튼튼하다. */
  const gotoCalls = src.match(/page\.goto\(\s*[`'"]([^`'"]*)/g) || [];
  const allGotoHttp = gotoCalls.length > 0 && gotoCalls.every((g) => /[`'"]http:\/\//.test(g));
  t('page_goto_targets_are_http', allGotoHttp);
  /* import 문만 떼어내 검사한다 — 주석은 대상이 아니다 */
  const importLines = (src.match(/^import .*$/gm) || []).join('\n');
  t('imports_no_file_url_helper', !/pathTo/i.test(importLines));
  t('starts_http_server', /http\.createServer/.test(src));
  t('settle_wait_at_least_3s', SETTLE_MS >= 3000);

  /* ── 계측 함수가 브라우저 안에서 안전한가 ── */
  const fnSrc = OBSERVE_FN.toString();
  t('observe_fn_uses_layout_shift', /layout-shift/.test(fnSrc));
  t('observe_fn_uses_lcp', /largest-contentful-paint/.test(fnSrc));
  t('observe_fn_excludes_recent_input', /hadRecentInput/.test(fnSrc));
  t('observe_fn_records_shift_sources', /\.sources/.test(fnSrc));
  /* 바깥 스코프 변수를 참조하면 브라우저 안에서 터진다 */
  t('observe_fn_no_outer_identifier',
    !/\b(LCP_MAX_MS|CLS_MAX|VIEWPORTS|CORE_PAGES|SETTLE_MS|ROOT)\b/.test(fnSrc));

  /* ── 정직 표기 규약 ── */
  t('discloses_lab_not_field', /measurementType/.test(src) && /lab/.test(src));
  t('inp_marked_unmeasured', /INP/.test(src) && /측정 불가|측정하지 못한/.test(src));

  /* ── ★ 반복 측정 규약 (1회 측정이 결함을 놓친 실제 사고에서 나온 검사) ── */
  t('repeats_at_least_3', REPEATS >= 3);
  t('adopts_worst_not_average', /Math\.max\(\.\.\.clsAll\)/.test(src) && !/clsAll\.reduce/.test(src));
  t('records_all_runs', /clsRuns/.test(src));
  t('flags_unstable_measurement', /unstable/.test(src));
  t('cache_disabled_each_run', /setCacheEnabled\(false\)/.test(src));

  /* ── 명명·출력 규약 (배선 게이트가 요구하는 것) ── */
  t('filename_ends_gate_mjs', /_gate\.mjs$/.test(fileURLToPath(import.meta.url)));
  t('selftest_has_quiet_option', /quiet\s*=\s*false/.test(src));
  t('selftest_quiet_uses_stderr', /console\.error/.test(src));

  const failed = checks.filter((c) => !c.ok);
  log(`[cwv-gate] 음성 통제군: ${failed.length ? 'FAIL' : 'PASS'} (${checks.length - failed.length}/${checks.length})`);
  for (const f of failed) log(`   ✗ ${f.name}`);
  return { ok: failed.length === 0, total: checks.length, failed: failed.map((f) => f.name) };
}

/* ══════════════════════════════════════════════════════════════════
   실측
   ══════════════════════════════════════════════════════════════ */
async function run({ json = false, port = 8899 } = {}) {
  let puppeteer;
  try {
    puppeteer = (await import('puppeteer')).default;
  } catch (e) {
    console.error('[cwv-gate] puppeteer 를 불러올 수 없습니다:', e.message);
    return 1;
  }

  /* 포트가 이미 쓰이고 있으면 옆 포트로 옮겨 시도한다.
     이유: 이전 측정에서 남은 서버나 다른 개발 서버가 잡고 있을 수 있는데,
     그때마다 게이트가 실패하면 계측기가 환경 탓으로 못 돌아가는 셈이 된다.
     실제로 이 게이트 첫 실행이 EADDRINUSE 로 죽었다(2026-08-31). */
  let server = null;
  let usedPort = port;
  for (let i = 0; i < 12 && !server; i++) {
    try {
      server = await startServer(ROOT, port + i);
      usedPort = port + i;
    } catch (e) {
      if (e && e.code === 'EADDRINUSE') continue;
      console.error(`[cwv-gate] HTTP 서버(${port + i}) 를 띄울 수 없습니다:`, e.message);
      return 1;
    }
  }
  if (!server) {
    console.error(`[cwv-gate] ${port}~${port + 11} 사이에 쓸 수 있는 포트가 없습니다.`);
    return 1;
  }
  port = usedPort;

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'shell',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  } catch (e) {
    server.close();
    console.error('[cwv-gate] 브라우저를 띄울 수 없습니다:', e.message);
    console.error('  샌드박스라면 다음 라이브러리가 필요합니다:');
    console.error('  sudo apt-get install -y libatk1.0-0 libatk-bridge2.0-0 libxcomposite1 libxdamage1 libatspi2.0-0');
    return 1;
  }

  const out = {
    gate: 'cwv_gate',
    measuredAt: new Date().toISOString(),
    /* ★ 이 두 줄이 결과의 정직성을 지킨다 — 지우면 결함 AY */
    measurementType: 'lab',
    measurementNote:
      'Lab(로컬 HTTP + 실브라우저) 측정이다. Google 규격의 p75 필드 측정이 아니다. ' +
      '실사용자 데이터(CrUX/RUM)가 없어 필드 값은 측정할 수 없다.',
    transport: `http://127.0.0.1:${port} (file:// 는 i18n fetch 실패로 값이 왜곡되므로 사용하지 않는다)`,
    externalRequests: 'blocked (localhost 외 요청 차단 — 재현성 확보)',
    thresholds: { lcpMaxMs: LCP_MAX_MS, clsMax: CLS_MAX, inpMaxMs: INP_MAX_MS },
    inp: { measured: false, reason: '사용자 입력이 있어야 발생하는 지표라 Lab 자동 측정 불가. 미측정을 통과로 적지 않는다.' },
    pages: {},
  };

  for (const file of CORE_PAGES) {
    if (!fs.existsSync(path.join(ROOT, file))) {
      out.pages[file] = { error: 'file_not_found' };
      continue;
    }
    out.pages[file] = {};
    for (const vp of VIEWPORTS) {
      /* 같은 조합을 REPEATS 회 재고 최악값을 채택한다.
         평균/최소를 쓰면 결함을 감추게 되므로 쓰지 않는다. */
      const runs = [];
      let lastError = null;
      for (let attempt = 0; attempt < REPEATS; attempt++) {
        const page = await browser.newPage();
        try {
          await page.setViewport(vp);
          await page.setCacheEnabled(false);
          await page.setRequestInterception(true);
          page.on('request', (req) => {
            const u = req.url();
            if (u.startsWith(`http://127.0.0.1:${port}`) || u.startsWith('data:') || u.startsWith('about:')) {
              req.continue();
            } else {
              /* 외부 요청 차단 — 우리가 통제할 수 없는 지연을 측정에서 배제 */
              req.abort().catch(() => {});
            }
          });
          await page.evaluateOnNewDocument(OBSERVE_FN);
          await page.goto(`http://127.0.0.1:${port}/${file}`, {
            waitUntil: 'networkidle2',
            timeout: 30000,
          });
          await new Promise((r) => setTimeout(r, SETTLE_MS));

          const m = await page.evaluate(() => {
            const c = window.__cwv || { lcp: 0, cls: 0, shifts: [] };
            return {
              lcp: Math.round(c.lcp),
              cls: Math.round(c.cls * 10000) / 10000,
              shifts: c.shifts.slice().sort((a, b) => b.value - a.value).slice(0, 5),
              shiftCount: c.shifts.length,
            };
          });
          runs.push(m);
        } catch (e) {
          lastError = String(e.message || e).slice(0, 200);
        } finally {
          await page.close().catch(() => {});
        }
      }

      if (!runs.length) {
        out.pages[file][vp.name] = { error: lastError || 'no_successful_run' };
        continue;
      }
      /* 최악 CLS 회차를 대표값으로 삼는다 (원인 추적 정보도 그 회차 것을 쓴다) */
      const worst = runs.reduce((a, b) => (b.cls > a.cls ? b : a));
      const clsAll = runs.map((r) => r.cls);
      const lcpAll = runs.map((r) => r.lcp);
      out.pages[file][vp.name] = {
        ...worst,
        lcp: Math.max(...lcpAll),
        repeats: runs.length,
        clsRuns: clsAll,
        clsMin: Math.min(...clsAll),
        clsMax: Math.max(...clsAll),
        /* 회차마다 값이 크게 다르면 그 사실 자체가 정보다 — 숨기지 않는다 */
        unstable: Math.max(...clsAll) - Math.min(...clsAll) > 0.05,
        overThresholdRuns: clsAll.filter((v) => v > CLS_MAX).length,
        ...verdict(Math.max(...lcpAll), Math.max(...clsAll)),
      };
    }
  }

  await browser.close();
  server.close();

  /* ── 집계: PC/모바일 각각의 최악값. 평균 내지 않는다 ── */
  const agg = {};
  for (const vp of VIEWPORTS) {
    let worstLcp = 0, worstCls = 0, worstLcpPage = null, worstClsPage = null, n = 0, fails = 0;
    for (const f of Object.keys(out.pages)) {
      const s = out.pages[f][vp.name];
      if (!s || s.error) continue;
      n++;
      if (!s.pass) fails++;
      if (s.lcp > worstLcp) { worstLcp = s.lcp; worstLcpPage = f; }
      if (s.cls > worstCls) { worstCls = s.cls; worstClsPage = f; }
    }
    agg[vp.name] = {
      measured: n, failing: fails,
      worstLcp, worstLcpPage, worstCls, worstClsPage,
      allPass: n > 0 && fails === 0,
    };
  }
  agg.allPass = VIEWPORTS.every((v) => agg[v.name].allPass);
  agg.worstClsOverall = Math.max(...VIEWPORTS.map((v) => agg[v.name].worstCls));
  agg.worstLcpOverall = Math.max(...VIEWPORTS.map((v) => agg[v.name].worstLcp));
  agg.scoringNote = '자체 측정 (제작규칙서 §8.3). 제3자 측정이 아니며 필드 p75 도 아니다.';
  out.aggregate = agg;

  if (json) {
    console.log(JSON.stringify(out, null, 2));
    return 0;
  }

  /* ── 사람이 읽는 출력 ── */
  console.log('');
  console.log('════════ Core Web Vitals 실측 (실브라우저 Chrome + 로컬 HTTP) ════════');
  console.log(`임계값: LCP <= ${LCP_MAX_MS}ms · CLS <= ${CLS_MAX} · INP <= ${INP_MAX_MS}ms`);
  console.log(`측정 종류: Lab (필드 p75 아님) · 외부 요청 차단 · 정착 대기 ${SETTLE_MS}ms`);
  console.log(`반복: 조합당 ${REPEATS}회 측정 후 최악값 채택 (1회 측정은 요동이 커서 근거가 못 된다)`);
  console.log('');
  console.log('  페이지                       뷰포트     LCP     최악CLS   초과회차  판정');
  console.log('  ──────────────────────────────────────────────────────────────────────────');
  for (const f of Object.keys(out.pages)) {
    for (const vp of VIEWPORTS) {
      const s = out.pages[f][vp.name];
      if (!s) continue;
      if (s.error) {
        console.log(`  ${f.padEnd(26)} ${vp.name.padEnd(9)} ERROR ${s.error}`);
        continue;
      }
      const mark = s.pass ? 'PASS' : 'FAIL';
      console.log(
        `  ${f.padEnd(26)} ${vp.name.padEnd(9)} ${String(s.lcp).padStart(5)}ms  ` +
        `${String(s.cls).padStart(7)}   ${String(s.overThresholdRuns + '/' + s.repeats).padStart(5)}   ` +
        `${mark}${s.lcpPass ? '' : ' [LCP초과]'}${s.clsPass ? '' : ' [CLS초과]'}${s.unstable ? ' [요동]' : ''}`
      );
    }
  }
  console.log('');
  for (const vp of VIEWPORTS) {
    const a = agg[vp.name];
    console.log(
      `── ${vp.name} (${vp.width}px): ${a.measured}개 측정 · 미달 ${a.failing}개 · ` +
      `최악 LCP ${a.worstLcp}ms(${a.worstLcpPage}) · 최악 CLS ${a.worstCls}(${a.worstClsPage})`
    );
  }
  console.log('');
  console.log(`전체 판정: ${agg.allPass ? 'PASS — 측정한 모든 조합이 임계값 이내' : 'FAIL — 임계값 초과 조합 존재'}`);
  console.log(`최악 CLS ${agg.worstClsOverall} / 최악 LCP ${agg.worstLcpOverall}ms`);
  console.log(`INP: 미측정 (${out.inp.reason})`);
  console.log('');

  /* ── CLS 원인 추적: 어느 요소가 밀렸는지 보여준다 ── */
  console.log('── CLS 상위 원인 (값이 큰 이동 순) ──');
  let shown = 0;
  for (const f of Object.keys(out.pages)) {
    for (const vp of VIEWPORTS) {
      const s = out.pages[f][vp.name];
      if (!s || s.error || !s.shifts || !s.shifts.length) continue;
      if (s.cls < 0.005) continue;
      console.log(`  ${f} / ${vp.name} (CLS ${s.cls}, 이동 ${s.shiftCount}회)`);
      for (const sh of s.shifts.slice(0, 3)) {
        console.log(`     ${String(sh.value).padStart(7)} @${String(sh.at).padStart(5)}ms  ${sh.nodes.join(' , ') || '(요소 미상)'}`);
      }
      shown++;
    }
  }
  if (!shown) console.log('  (유의미한 레이아웃 이동 없음)');
  console.log('');
  return 0;
}

/* ── CLI ──────────────────────────────────────────────────────────── */
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const args = process.argv.slice(2);
  if (args.includes('--self-test')) {
    const r = selfTest();
    process.exit(r.ok ? 0 : 1);
  }
  /* 실측 전에 selfTest 를 먼저 통과해야 한다 — 계측기가 고장난 채 재면 안 된다 */
  const wantJson = args.includes('--json');
  const st = selfTest({ quiet: wantJson });
  if (!st.ok) {
    console.error('[cwv-gate] selfTest 실패 — 측정을 중단합니다.');
    process.exit(1);
  }
  const portArg = args.find((a) => a.startsWith('--port='));
  const code = await run({ json: wantJson, port: portArg ? Number(portArg.split('=')[1]) : 8899 });
  process.exit(code);
}
