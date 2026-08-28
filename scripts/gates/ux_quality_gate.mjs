// scripts/gates/ux_quality_gate.mjs
// ⑥축(UX/UI 이용편의성·시각품질) 측정 게이트 — 2026-08-28 신설
//   대표님 지시: "홈페이지(PC와 모바일)의 이용 편의성과 시각적 품질(UX, UI)" 를 평가 항목화.
//   배경(실측): UX 측정 스크립트 5개·보안 스크립트 3개가 저장소에 있었으나
//               package.json 내 관련 npm script 는 0건이었다.
//               ⇒ 도구는 있으나 반복 호출되지 않으므로 "측정"이 아니었다.
//               이 게이트는 그 호출 경로를 만든다.
//
//   설계 원칙
//     · 결정론적 — 난수 0회. 같은 입력 → 항상 같은 출력 (⑤축 항목1 과 동일 규율).
//     · 실측만 보고 — 브라우저 렌더가 필요한 항목(터치 타깃 44px 실측)은 여기서 판정하지
//       않고 "미측정"으로 남긴다. 정적 검출이 가능한 항목만 센다.
//     · 음성 통제군 내장 — --self-test 가 결함 삽입본/청정본을 대조해, 측정기 자체가
//       결함을 검출하는지 먼저 증명한다. 통제군 실패 시 측정값을 신뢰하지 않고 즉시 중단한다
//       (결함 BT: 거짓 초록불은 거짓 빨간불만큼 위험하다).
//
//   ⚠️ 한계 (정직 고지 — 이 주석 자체도 실측 대상이다: 결함 CM)
//     이 게이트는 정적 분석이다. CSS 선언의 *존재*를 보며 렌더 *결과*를 보지 않는다.
//     예) font-size:10px 선언 1건은 캡션용일 수 있고 본문일 수도 있다. 이 게이트는
//     구분하지 못한다. 따라서 fontUnder12 수치는 상한도 하한도 아니다.
//     선언이 실제 본문에 적용되는지는 puppeteer 실측(U-8)의 몫으로 남아 있다.
//
//   사용법
//     node scripts/gates/ux_quality_gate.mjs --self-test          음성 통제군만
//     node scripts/gates/ux_quality_gate.mjs                      추적 HTML 전수 측정
//     node scripts/gates/ux_quality_gate.mjs --json               원자료 JSON 출력
//     node scripts/gates/ux_quality_gate.mjs a.html b.html        지정 파일만

import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';

const ROOT = process.env.UX_ROOT || process.cwd();

// PC / 모바일 기준 뷰포트. ⑥축은 두 뷰포트를 분리 측정하고 낮은 쪽을 취한다.
// (평균이 아니다 — 모바일이 깨지면 PC 가 좋아도 그 고객은 이탈한다.)
export const VIEWPORT = { pc: 1440, mobile: 390 };

// 가독성 기준: 12px 미만은 본문으로 부적합, 모바일 본문 권장 16px.
const FONT_MIN_OK = 12;
// 터치 타깃 하한 참고치(WCAG 2.5.5 / Apple HIG 44pt). 정적 단계에서는 24px 미만만 계수한다.
const TOUCH_SMALL = 24;

/** 단일 HTML 파일을 정적 측정한다. 난수 없음 · 부수효과 없음. */
export function inspect(absPath, label) {
  const r = { file: label != null ? label : absPath };
  if (!fs.existsSync(absPath)) { r.err = 'missing'; return r; }
  const h = fs.readFileSync(absPath, 'utf8');
  r.bytes = h.length;

  // ── 항목1 모바일 적합성 ──
  r.viewport = /name=["']viewport["']/i.test(h);
  // 확대 차단은 저시력 사용자를 배제한다(WCAG 1.4.4).
  r.vpScalable = !/user-scalable\s*=\s*no/i.test(h)
              && !/maximum-scale\s*=\s*1(\.0)?["'\s,]/i.test(h);
  // ★ 고정폭 검출: max-width / min-width 는 반응형의 *증거*이므로 제외해야 한다.
  //   (`(?:min-)?width` 로 쓰면 `max-width:1200px` 의 `width:` 에 걸려
  //    반응형이 잘 된 페이지를 결함으로 집계한다 — 결함 DE 계열. 통제군이 이를 잡는다.)
  r.fixedWideOverMobile = [...h.matchAll(/(^|[^-a-z])width\s*:\s*(\d{3,})px/gi)]
    .map(m => +m[2]).filter(v => v > VIEWPORT.mobile).length;

  // ── 항목2 키보드·보조기술 접근성 ──
  r.htmlLang = /<html[^>]+lang=/i.test(h);
  // ★ <title data-i18n="..."> 처럼 속성이 붙는 경우를 놓치지 않는다.
  r.title = /<title\b[^>]*>[^<]{2,}<\/title>/i.test(h);
  r.skipLink = /skip[-_]?(to[-_]?)?(main|content)|본문으로/i.test(h);
  r.landmarks = ['<main', '<header', '<nav', '<footer']
    .filter(t => new RegExp(t, 'i').test(h)).length;
  r.focusVisible = /:focus-visible|:focus\b/i.test(h);

  const imgs = h.match(/<img\b[^>]*>/gi) || [];
  r.imgTotal = imgs.length;
  r.imgNoAlt = imgs.filter(t => !/\balt\s*=/i.test(t)).length;

  const btns = h.match(/<button\b[^>]*>/gi) || [];
  r.btnTotal = btns.length;
  // 아이콘 전용 버튼(가시 텍스트 없음)은 aria-label 없으면 스크린리더에 무명으로 읽힌다.
  const iconBtn = h.match(/<button\b[^>]*>\s*(<i\b[^>]*><\/i>|&[a-z]+;|[×✕✖✓→←]|)\s*<\/button>/gi) || [];
  r.iconBtnNoLabel = iconBtn.filter(t => !/aria-label\s*=/i.test(t)).length;

  const inputs = (h.match(/<input\b[^>]*>/gi) || [])
    .filter(t => !/type\s*=\s*["'](hidden|submit|button)["']/i.test(t));
  r.inputTotal = inputs.length;
  r.inputNoLabel = inputs
    .filter(t => !/aria-label\s*=|aria-labelledby\s*=|\bid\s*=/i.test(t)).length;

  // ── 항목3 텍스트 가독성 ──
  const sizes = [...h.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?)px/gi)].map(m => +m[1]);
  r.fontDeclTotal = sizes.length;
  r.fontMin = sizes.length ? Math.min(...sizes) : null;
  r.fontUnder12 = sizes.filter(v => v < FONT_MIN_OK).length;

  // ── 항목4 터치 타깃 (정적 근사 · 실측은 미실시) ──
  const wh = [...h.matchAll(/(^|[^-a-z])(?:width|height)\s*:\s*(\d+)px/gi)].map(m => +m[2]);
  r.smallPx = wh.filter(v => v > 0 && v < TOUCH_SMALL).length;
  r.touchTargetMeasured = false; // ★ 미측정임을 값으로 명시한다(추정을 측정으로 위장하지 않는다)

  // ── 항목6 시각 일관성 ──
  r.mediaQueries = (h.match(/@media[^{]+/gi) || []).length;
  r.prefersReducedMotion = /prefers-reduced-motion/i.test(h);

  return r;
}

/** git 추적 중인 HTML 전량 (결정론적 정렬) */
export function trackedHtml() {
  const out = execSync("git ls-files '*.html'", { cwd: ROOT, encoding: 'utf8' });
  return out.split('\n').map(s => s.trim()).filter(Boolean).sort();
}

/** 집계 — 비율과 총량을 모두 낸다. */
export function summarize(rows) {
  const A = rows.filter(r => !r.err);
  const n = A.length;
  const cnt = f => A.filter(f).length;
  const sum = k => A.reduce((a, r) => a + (r[k] || 0), 0);
  return {
    pages: n,
    missing: rows.length - n,
    ratio: {
      viewport: cnt(r => r.viewport),
      vpScalable: cnt(r => r.vpScalable),
      htmlLang: cnt(r => r.htmlLang),
      title: cnt(r => r.title),
      skipLink: cnt(r => r.skipLink),
      landmarksFull: cnt(r => r.landmarks === 4),
      landmarksZero: cnt(r => r.landmarks === 0),
      mediaQueries: cnt(r => r.mediaQueries > 0),
      reducedMotion: cnt(r => r.prefersReducedMotion),
      focusVisible: cnt(r => r.focusVisible),
      imgAltClean: cnt(r => r.imgNoAlt === 0),
      iconBtnClean: cnt(r => r.iconBtnNoLabel === 0),
      inputLabelClean: cnt(r => r.inputNoLabel === 0),
      fontClean: cnt(r => r.fontUnder12 === 0),
      fixedWidthClean: cnt(r => r.fixedWideOverMobile === 0)
    },
    totals: {
      imgNoAlt: sum('imgNoAlt'),
      iconBtnNoLabel: sum('iconBtnNoLabel'),
      inputNoLabel: sum('inputNoLabel'),
      fontUnder12: sum('fontUnder12'),
      fixedWideOverMobile: sum('fixedWideOverMobile'),
      smallPx: sum('smallPx'),
      imgTotal: sum('imgTotal'),
      btnTotal: sum('btnTotal'),
      inputTotal: sum('inputTotal')
    }
  };
}

// ── 음성 통제군 ────────────────────────────────────────────────────────────
// 측정기가 실제로 결함을 검출하는지 증명한다. 이 통제군이 없으면 "0건 검출"이
// 청정을 뜻하는지 측정기 고장을 뜻하는지 구별할 수 없다 (결함 BT).
export function selfTest() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'uxgate-'));
  const BAD = [
    '<!DOCTYPE html><html><head></head><body>',
    '<img src="a.png"><button><i class="fa"></i></button>',
    '<input type="text" name="q">',
    '<div style="width:1200px;font-size:8px">x</div>',
    '</body></html>'
  ].join('\n');
  const GOOD = [
    '<!DOCTYPE html><html lang="ko"><head><title data-i18n="t">좋은 페이지</title>',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<style>@media(max-width:640px){body{font-size:16px}} :focus-visible{outline:2px solid}',
    '@media(prefers-reduced-motion:reduce){*{animation:none}}',
    '.wrap{max-width:1200px;min-width:480px}</style></head>',
    '<body><a href="#main">본문으로</a><header></header><nav></nav>',
    '<main id="main"><img src="a.png" alt="설명"><button aria-label="닫기"><i class="fa"></i></button>',
    '<input type="text" id="q" aria-label="검색"></main><footer></footer></body></html>'
  ].join('\n');
  fs.writeFileSync(path.join(d, 'bad.html'), BAD);
  fs.writeFileSync(path.join(d, 'good.html'), GOOD);

  const bad = inspect(path.join(d, 'bad.html'), 'bad.html');
  const good = inspect(path.join(d, 'good.html'), 'good.html');

  const checks = [
    ['viewport', bad.viewport === false && good.viewport === true],
    ['htmlLang', bad.htmlLang === false && good.htmlLang === true],
    // ★ 속성이 붙은 <title data-i18n> 을 검출해야 통과 (실제 index.html 형태)
    ['title_with_attr', bad.title === false && good.title === true],
    ['imgNoAlt', bad.imgNoAlt > 0 && good.imgNoAlt === 0],
    ['iconBtnNoLabel', bad.iconBtnNoLabel > 0 && good.iconBtnNoLabel === 0],
    ['inputNoLabel', bad.inputNoLabel > 0 && good.inputNoLabel === 0],
    ['landmarks', bad.landmarks === 0 && good.landmarks === 4],
    ['skipLink', bad.skipLink === false && good.skipLink === true],
    ['focusVisible', bad.focusVisible === false && good.focusVisible === true],
    ['reducedMotion', bad.prefersReducedMotion === false && good.prefersReducedMotion === true],
    ['fontUnder12', bad.fontUnder12 > 0 && good.fontUnder12 === 0],
    // ★ max-width / min-width 를 고정폭으로 오검출하지 않는지 (결함 DE 회귀 방지)
    ['fixedWide_no_maxwidth_FP', bad.fixedWideOverMobile > 0 && good.fixedWideOverMobile === 0],
    // ★ 미측정 항목이 측정된 것처럼 보이지 않는지
    ['touchTarget_declared_unmeasured', bad.touchTargetMeasured === false]
  ];
  const failed = checks.filter(([, ok]) => !ok).map(([k]) => k);
  try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {}
  return { passed: failed.length === 0, total: checks.length, failed };
}

// ── CLI ───────────────────────────────────────────────────────────────────
const isMain = process.argv[1] && process.argv[1].endsWith('ux_quality_gate.mjs');
if (isMain) {
  const argv = process.argv.slice(2);
  const wantJson = argv.includes('--json');
  const onlySelf = argv.includes('--self-test');
  const targets = argv.filter(a => !a.startsWith('--'));

  // 1) 음성 통제군을 항상 먼저 돌린다. 실패하면 측정하지 않고 중단한다.
  const st = selfTest();
  console.log(`[ux-gate] 음성 통제군: ${st.passed ? 'PASS' : 'FAIL'} (${st.total - st.failed.length}/${st.total})`);
  if (!st.passed) {
    console.error(`[ux-gate] 실패 항목: ${st.failed.join(', ')}`);
    console.error('[ux-gate] 측정기가 결함을 검출하지 못한다. 측정값을 신뢰할 수 없어 중단한다.');
    process.exit(1);
  }
  if (onlySelf) process.exit(0);

  // 2) 전수 측정
  const files = targets.length ? targets : trackedHtml();
  const rows = files.map(rel => inspect(path.join(ROOT, rel), rel));
  const s = summarize(rows);

  if (wantJson) {
    console.log(JSON.stringify({ summary: s, rows }, null, 1));
    process.exit(0);
  }

  const n = s.pages;
  const P = v => `${String(v).padStart(4)} / ${n}  (${(v / n * 100).toFixed(1)}%)`;
  console.log(`\n[ux-gate] 공개 HTML ${n}개 전수 측정 (누락 ${s.missing})`);
  const label = {
    viewport: 'viewport meta 보유', vpScalable: '확대 허용(차단 없음)',
    htmlLang: 'html lang 지정', title: 'title 존재',
    skipLink: 'skip link(본문으로)', landmarksFull: 'landmark 4종 완비',
    landmarksZero: 'landmark 0개 (결함)', mediaQueries: '미디어쿼리 보유(반응형)',
    reducedMotion: 'prefers-reduced-motion', focusVisible: 'focus 스타일 존재',
    imgAltClean: 'img alt 누락 0', iconBtnClean: '아이콘버튼 라벨누락 0',
    inputLabelClean: 'input 라벨누락 0', fontClean: '12px 미만 폰트 0',
    fixedWidthClean: '모바일 초과 고정폭 0'
  };
  for (const k of Object.keys(s.ratio)) console.log(`  ${P(s.ratio[k])}  ${label[k] || k}`);
  console.log('\n[ux-gate] 결함 총량');
  for (const [k, v] of Object.entries(s.totals)) console.log(`  ${k} = ${v}`);
  console.log('\n[ux-gate] 미측정 (정직 고지)');
  console.log('  · 터치 타깃 44px 실측 — 브라우저 렌더 필요 (U-8, puppeteer)');
  console.log('  · 색 대비비 (WCAG 1.4.3) — 계산된 스타일 필요');
  console.log('  · 시각적 아름다움 — 정적 분석의 범위 밖');
  process.exit(0);
}
