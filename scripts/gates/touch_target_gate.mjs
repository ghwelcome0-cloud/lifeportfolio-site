#!/usr/bin/env node
/**
 * 터치 타깃 실측 게이트 (touch_target_gate.mjs)
 * ─────────────────────────────────────────────────────────────────────
 * 근거 문서: docs/품질기준서_홈페이지품질_2026-08-28.md §3-2 · §7
 *
 * 무엇을 재는가
 *   실제 브라우저(Chrome)로 페이지를 띄우고, 손가락/마우스로 누를 수 있는
 *   모든 요소의 실제 픽셀 크기를 getBoundingClientRect() 로 잰다.
 *   CSS 문자열 정규식으로 추정하지 않는다 — 실측이다.
 *
 * 기준 (정본: https://www.w3.org/TR/WCAG22/)
 *   · 2.5.8 Target Size (Minimum)  = AA  = 24 x 24 CSS px
 *   · 2.5.5 Target Size (Enhanced) = AAA = 44 x 44 CSS px  ← 우리 목표
 *   ★ 44px 는 AA 가 아니라 AAA 다. 이 구분을 흐리면 결함 AY.
 *
 * 예외 (WCAG 2.2 2.5.8 원문이 허용하는 것만)
 *   · Inline    : 문장 속에 흐르는 링크 (본문 텍스트 안의 a)
 *   · Spacing   : 24px 원이 겹치지 않을 만큼 간격이 확보된 경우
 *   · Essential : 크기가 본질적인 경우 (지도 핀 등)
 *   · UA        : 브라우저 기본 렌더링을 저자가 바꾸지 않은 경우
 *   본 게이트는 Inline / Spacing 을 자동 판정하고, 나머지는 위반으로 센다.
 *   (관대하게 봐주면 거짓 초록불이 된다 — 의심스러우면 위반으로 센다)
 *
 * 왜 PC 와 모바일을 따로 재는가
 *   ⑥축 측정 원칙: PC 1440px / 모바일 390px 각각 채점, 점수는 "낮은 쪽".
 *   합치거나 평균 내지 않는다.
 *
 * 사용법
 *   node scripts/gates/touch_target_gate.mjs --self-test
 *   node scripts/gates/touch_target_gate.mjs                 (핵심 12p)
 *   node scripts/gates/touch_target_gate.mjs --json
 *   node scripts/gates/touch_target_gate.mjs --all           (전체 지면)
 *
 * 종료 코드
 *   0 = 실행 성공 (측정 완료). 위반 존재만으로는 1 을 내지 않는다.
 *       ⇒ 이 게이트는 "현재 상태를 정직하게 재는" 계측기다. 개선 판정은
 *         improvement_delta_gate 가 baseline 대조로 한다.
 *   1 = 실행 실패 (브라우저 불가 · 파일 없음 · selfTest 실패)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

/* ── 기준값 (정본 그대로. 여기를 임의로 낮추면 게이트가 무의미해진다) ── */
export const AA_MIN = 24;   // WCAG 2.2 2.5.8 (AA)
export const AAA_MIN = 44;  // WCAG 2.2 2.5.5 (AAA) ← 우리 목표

/* ── 뷰포트 (⑥축 측정 원칙과 동일한 값) ── */
export const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844, deviceScaleFactor: 3, isMobile: true },
  { name: 'desktop', width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false },
];

/* ── 핵심 경로 12페이지 (a11y 적용 대상과 동일 집합) ── */
export const CORE_PAGES = [
  'index.html',
  'checkin-21.html',
  'checkin-21-en.html',
  'checkin-21-form.html',
  'checkin-21-form-en.html',
  'report.html',
  'program.html',
  'mypage.html',
  'login.html',
  'signup.html',
  'b2b.html',
  'b2b-quote.html',
];

/* ── 브라우저 안에서 실행되는 측정 함수 ─────────────────────────────
   ★ 이 함수는 페이지 컨텍스트에서 돌기 때문에 외부 변수를 못 쓴다.
     기준값을 인자로 넘긴다. */
export const MEASURE_FN = function (aaMin, aaaMin) {
  const SEL = 'a[href], button, input, select, textarea, summary, [role="button"], [role="link"], [role="tab"], [role="checkbox"], [role="radio"], [tabindex]:not([tabindex="-1"])';
  const nodes = Array.from(document.querySelectorAll(SEL));

  const results = [];
  for (const el of nodes) {
    const cs = getComputedStyle(el);

    /* 화면에 안 보이는 것은 대상이 아니다 (누를 수 없으므로) */
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse') continue;
    if (parseFloat(cs.opacity) === 0) continue;
    if (el.disabled) continue;
    if (el.type === 'hidden') continue;
    /* 접근성 전용 오프스크린(skip link 등)은 포커스 시에만 노출되므로 제외 */
    if (el.closest('[aria-hidden="true"]')) continue;

    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;   // 레이아웃상 없는 것

    /* ── WCAG 2.2 2.5.8 Inline 예외 판정 ──
       문장 속에 흐르는 링크인가? 부모가 텍스트 블록이고 형제 텍스트가 있으면 inline. */
    let isInline = false;
    if (el.tagName === 'A' && cs.display.startsWith('inline')) {
      const parent = el.parentElement;
      if (parent) {
        const parentText = (parent.textContent || '').trim();
        const ownText = (el.textContent || '').trim();
        /* 부모 텍스트가 자기 텍스트보다 확실히 길면 = 문장 속에 박혀 있다 */
        if (parentText.length > ownText.length + 10) isInline = true;
      }
    }

    /* ── 클릭 가능한 실제 영역 = 자기 박스 + CSS padding 은 이미 rect 에 포함.
          다만 부모가 더 큰 히트영역을 주는 경우(예: <label> 로 감싼 input)를
          반영하기 위해, 라벨로 감싸인 input 은 라벨 박스를 히트영역으로 본다. */
    let hitW = r.width, hitH = r.height, hitFrom = 'self';
    if (el.tagName === 'INPUT' || el.tagName === 'SELECT') {
      const lab = el.closest('label');
      if (lab) {
        const lr = lab.getBoundingClientRect();
        if (lr.width >= r.width && lr.height >= r.height) {
          hitW = lr.width; hitH = lr.height; hitFrom = 'label';
        }
      }
    }

    const minSide = Math.min(hitW, hitH);

    results.push({
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute('type') || null,
      w: Math.round(hitW * 10) / 10,
      h: Math.round(hitH * 10) / 10,
      minSide: Math.round(minSide * 10) / 10,
      hitFrom,
      isInline,
      passAA: minSide >= aaMin,
      passAAA: minSide >= aaaMin,
      label: ((el.getAttribute('aria-label') || el.textContent || el.value || '').trim().slice(0, 40)),
      x: Math.round(r.x), y: Math.round(r.y),
    });
  }

  /* ── Spacing 예외 판정 (2.5.8) ──
     "24px 지름의 원을 각 타깃 중심에 놓아도 다른 타깃 원과 겹치지 않으면 통과"
     작은 타깃 중 AA 미달인 것만 검사한다. */
  for (const a of results) {
    if (a.passAA || a.isInline) { a.spacingOK = null; continue; }
    const acx = a.x + a.w / 2, acy = a.y + a.h / 2;
    let ok = true;
    for (const b of results) {
      if (b === a) continue;
      const bcx = b.x + b.w / 2, bcy = b.y + b.h / 2;
      const dist = Math.hypot(acx - bcx, acy - bcy);
      if (dist < aaMin) { ok = false; break; }   // 원이 겹친다
    }
    a.spacingOK = ok;
  }

  return results;
};

/* ── 집계 ─────────────────────────────────────────────────────────── */
export function summarize(items) {
  const total = items.length;
  /* AA 위반 = AA 미달 && inline 아님 && spacing 예외도 아님 */
  const aaViolations = items.filter(
    (i) => !i.passAA && !i.isInline && i.spacingOK !== true
  );
  const aaaViolations = items.filter((i) => !i.passAAA && !i.isInline);
  const inlineExempt = items.filter((i) => i.isInline).length;
  const spacingExempt = items.filter((i) => i.spacingOK === true).length;

  return {
    total,
    aaPass: total - aaViolations.length,
    aaViolations: aaViolations.length,
    aaaPass: items.filter((i) => i.passAAA || i.isInline).length,
    aaaViolations: aaaViolations.length,
    inlineExempt,
    spacingExempt,
    aaPassRate: total ? Math.round(((total - aaViolations.length) / total) * 1000) / 10 : 100,
    aaaPassRate: total
      ? Math.round((items.filter((i) => i.passAAA || i.isInline).length / total) * 1000) / 10
      : 100,
    worstAA: aaViolations
      .slice()
      .sort((a, b) => a.minSide - b.minSide)
      .slice(0, 5)
      .map((i) => ({ tag: i.tag, minSide: i.minSide, label: i.label })),
    worstAAA: aaaViolations
      .slice()
      .sort((a, b) => a.minSide - b.minSide)
      .slice(0, 5)
      .map((i) => ({ tag: i.tag, minSide: i.minSide, label: i.label })),
  };
}

/* ── ⑥축 항목4 채점 (품질기준서 §3-3 대응) ────────────────────────
   5점 = AAA(44px) 100%
   4점 = AAA 90%+
   3점 = AA(24px) 100%
   2점 = AA 95%+
   1점 = 그 외
   ★ 이 점수는 「자체 채점」이다 (제작규칙서 §8.3). */
export function scoreItem4(aaRate, aaaRate) {
  if (aaaRate >= 100) return 5;
  if (aaaRate >= 90) return 4;
  if (aaRate >= 100) return 3;
  if (aaRate >= 95) return 2;
  return 1;
}

/* ── selfTest ─────────────────────────────────────────────────────── */
export function selfTest({ quiet = false } = {}) {
  /* ★ quiet 모드가 왜 필요한가 (실측으로 확인한 결함, 2026-08-31)
       --json 출력에 selfTest 로그가 첫 줄로 섞여 들어가 JSON.parse 가 깨졌다.
       기존 ux_quality_gate 도 같은 문제를 갖고 있어 호출부에서
       .replace(/^\[ux-gate\].*\n/,'') 로 벗겨내고 있었다.
       같은 부채를 새 게이트에 물려주지 않는다 — 여기서는 애초에 stdout 을
       오염시키지 않고 stderr 로 보낸다. */
  const log = quiet ? (...a) => console.error(...a) : (...a) => console.log(...a);
  const checks = [];
  const t = (name, cond) => checks.push({ name, ok: !!cond });

  /* 기준값이 정본과 일치하는가 */
  t('aa_min_is_24', AA_MIN === 24);
  t('aaa_min_is_44', AAA_MIN === 44);
  t('aa_lower_than_aaa', AA_MIN < AAA_MIN);

  /* 뷰포트가 ⑥축 원칙과 일치하는가 */
  t('viewport_mobile_390', VIEWPORTS.find((v) => v.name === 'mobile').width === 390);
  t('viewport_desktop_1440', VIEWPORTS.find((v) => v.name === 'desktop').width === 1440);
  t('viewport_count_2', VIEWPORTS.length === 2);

  /* 핵심 12페이지 목록 */
  t('core_pages_12', CORE_PAGES.length === 12);
  t('core_pages_exist', CORE_PAGES.every((f) => fs.existsSync(path.join(ROOT, f))));
  t('core_includes_b2b_quote', CORE_PAGES.includes('b2b-quote.html'));

  /* summarize 로직 — 합성 데이터로 검증 */
  const fake = [
    { minSide: 48, passAA: true, passAAA: true, isInline: false, spacingOK: null, tag: 'button', label: 'ok' },
    { minSide: 30, passAA: true, passAAA: false, isInline: false, spacingOK: null, tag: 'a', label: 'aa only' },
    { minSide: 12, passAA: false, passAAA: false, isInline: false, spacingOK: false, tag: 'a', label: 'violation' },
    { minSide: 10, passAA: false, passAAA: false, isInline: true, spacingOK: null, tag: 'a', label: 'inline exempt' },
    { minSide: 16, passAA: false, passAAA: false, isInline: false, spacingOK: true, tag: 'a', label: 'spacing exempt' },
  ];
  const s = summarize(fake);
  t('summarize_total_5', s.total === 5);
  t('summarize_aa_violations_1', s.aaViolations === 1);          // 12px 만 위반
  t('summarize_inline_exempt_1', s.inlineExempt === 1);
  t('summarize_spacing_exempt_1', s.spacingExempt === 1);
  t('summarize_aaa_pass_2', s.aaaPass === 2);                    // 48px + inline
  t('summarize_worst_aa_sorted', s.worstAA[0].minSide === 12);
  t('summarize_rate_numeric', typeof s.aaPassRate === 'number');

  /* 빈 입력에서 죽지 않는가 */
  const e = summarize([]);
  t('summarize_empty_safe', e.total === 0 && e.aaPassRate === 100);

  /* 채점 함수 */
  t('score_5_when_aaa_100', scoreItem4(100, 100) === 5);
  t('score_4_when_aaa_90', scoreItem4(100, 92) === 4);
  t('score_3_when_aa_100', scoreItem4(100, 50) === 3);
  t('score_2_when_aa_96', scoreItem4(96, 50) === 2);
  t('score_1_when_low', scoreItem4(80, 10) === 1);
  t('score_monotonic', scoreItem4(100, 100) >= scoreItem4(100, 92));

  /* MEASURE_FN 이 브라우저용 순수 함수인가 (외부 스코프 참조 금지) */
  const src = MEASURE_FN.toString();
  t('measure_fn_is_function', typeof MEASURE_FN === 'function');
  t('measure_fn_takes_thresholds', /function\s*\(\s*aaMin\s*,\s*aaaMin\s*\)/.test(src));
  t('measure_fn_no_outer_const', !/\bAA_MIN\b|\bAAA_MIN\b/.test(src));
  t('measure_fn_uses_rect', src.includes('getBoundingClientRect'));
  t('measure_fn_skips_hidden', src.includes("display === 'none'"));
  t('measure_fn_has_inline_rule', src.includes('isInline'));
  t('measure_fn_has_spacing_rule', src.includes('spacingOK'));
  t('measure_fn_label_hit_area', src.includes("closest('label')"));

  /* 파일 명명 규칙 (gate_ci_wiring_gate 가 *_gate.mjs 만 인식한다) */
  t('filename_ends_gate_mjs', /_gate\.mjs$/.test(path.basename(fileURLToPath(import.meta.url))));

  /* --json 출력이 오염되지 않는가 (quiet 모드가 stdout 을 안 쓰는지) */
  t('selftest_has_quiet_option', /function selfTest\(\{\s*quiet/.test(selfTest.toString()));
  t('selftest_quiet_uses_stderr', /console\.error/.test(selfTest.toString()));

  const passed = checks.filter((c) => c.ok).length;
  log(`[touch-gate] selfTest ${passed}/${checks.length}`);
  for (const c of checks) if (!c.ok) log(`  FAIL: ${c.name}`);
  return { passed, total: checks.length, ok: passed === checks.length };
}

/* ── 실측 실행 ────────────────────────────────────────────────────── */
async function run({ json = false, all = false } = {}) {
  let puppeteer;
  try {
    puppeteer = (await import('puppeteer')).default;
  } catch {
    console.error('[touch-gate] puppeteer 를 불러올 수 없습니다.');
    return 1;
  }

  const files = all
    ? fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'))
    : CORE_PAGES;

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  } catch (e) {
    console.error('[touch-gate] 브라우저 실행 실패:', e.message.split('\n')[0]);
    console.error('[touch-gate] 필요 라이브러리: libatk1.0-0 libatk-bridge2.0-0 libxcomposite1 libxdamage1 libatspi2.0-0');
    return 1;
  }

  const out = { generatedAt: new Date().toISOString(), aaMin: AA_MIN, aaaMin: AAA_MIN, pages: {} };

  for (const file of files) {
    const abs = path.join(ROOT, file);
    if (!fs.existsSync(abs)) continue;
    out.pages[file] = {};

    for (const vp of VIEWPORTS) {
      const page = await browser.newPage();
      try {
        await page.setViewport(vp);
        /* 외부 네트워크를 끊는다 — 재현성을 위해 (CDN 지연에 좌우되면 측정이 흔들린다) */
        await page.setRequestInterception(true);
        page.on('request', (req) => {
          const u = req.url();
          if (u.startsWith('file://') || u.startsWith('data:')) req.continue();
          else req.abort();
        });
        await page.goto('file://' + abs, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await new Promise((r) => setTimeout(r, 400));   // 레이아웃 안정화

        const items = await page.evaluate(MEASURE_FN, AA_MIN, AAA_MIN);
        out.pages[file][vp.name] = summarize(items);
      } catch (e) {
        out.pages[file][vp.name] = { error: e.message.split('\n')[0] };
      } finally {
        await page.close();
      }
    }
  }

  await browser.close();

  /* ── ⑥축 항목4 채점: PC/모바일 각각 채점 후 "낮은 쪽" ── */
  const agg = {};
  for (const vp of VIEWPORTS) {
    let total = 0, aaPass = 0, aaaPass = 0;
    for (const f of Object.keys(out.pages)) {
      const s = out.pages[f][vp.name];
      if (!s || s.error) continue;
      total += s.total; aaPass += s.aaPass; aaaPass += s.aaaPass;
    }
    const aaRate = total ? Math.round((aaPass / total) * 1000) / 10 : 100;
    const aaaRate = total ? Math.round((aaaPass / total) * 1000) / 10 : 100;
    agg[vp.name] = { total, aaPass, aaaPass, aaRate, aaaRate, score: scoreItem4(aaRate, aaaRate) };
  }
  agg.item4Score = Math.min(...VIEWPORTS.map((v) => agg[v.name].score));
  agg.scoringNote = '자체 채점 (제작규칙서 §8.3). 제3자 채점이 아니다.';
  out.aggregate = agg;

  if (json) {
    console.log(JSON.stringify(out, null, 2));
    return 0;
  }

  /* ── 사람이 읽는 출력 ── */
  console.log('');
  console.log('════════ 터치 타깃 실측 (실브라우저 Chrome) ════════');
  console.log(`기준: AA ${AA_MIN}x${AA_MIN}px (2.5.8) · AAA ${AAA_MIN}x${AAA_MIN}px (2.5.5, 우리 목표)`);
  console.log('');
  for (const vp of VIEWPORTS) {
    const a = agg[vp.name];
    console.log(`── ${vp.name} (${vp.width}px) ──`);
    console.log(`   대상 요소 ${a.total}개 · AA 통과 ${a.aaPass} (${a.aaRate}%) · AAA 통과 ${a.aaaPass} (${a.aaaRate}%) · 항목4 ${a.score}점`);
  }
  console.log('');
  console.log(`⑥축 항목4 = 낮은 쪽 = ${agg.item4Score}점  ← 자체 채점`);
  console.log('');
  console.log('── 페이지별 AAA 미달 (44px 기준) ──');
  for (const f of Object.keys(out.pages)) {
    const m = out.pages[f].mobile, d = out.pages[f].desktop;
    if (!m || m.error) { console.log(`  ${f.padEnd(26)} ERROR ${m?.error || ''}`); continue; }
    console.log(
      `  ${f.padEnd(26)} mobile AA ${String(m.aaViolations).padStart(3)}위반 / AAA ${String(m.aaaViolations).padStart(3)}위반` +
      `   desktop AA ${String(d.aaViolations).padStart(3)} / AAA ${String(d.aaaViolations).padStart(3)}`
    );
  }
  console.log('');
  const worst = Object.entries(out.pages)
    .filter(([, v]) => v.mobile && !v.mobile.error)
    .sort((a, b) => b[1].mobile.aaaViolations - a[1].mobile.aaaViolations)[0];
  if (worst) {
    console.log(`── 최악 페이지 (mobile): ${worst[0]} — AAA 위반 ${worst[1].mobile.aaaViolations}건 ──`);
    for (const w of worst[1].mobile.worstAAA) {
      console.log(`   ${String(w.minSide).padStart(6)}px  <${w.tag}>  "${w.label}"`);
    }
  }
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
    console.error('[touch-gate] selfTest 실패 — 측정을 중단합니다.');
    process.exit(1);
  }
  const code = await run({ json: wantJson, all: args.includes('--all') });
  process.exit(code);
}
