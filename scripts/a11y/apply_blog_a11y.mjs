#!/usr/bin/env node
/**
 * ⑥축 항목2(키보드·보조기술 접근성) 개선 — 블로그 포스트 100개 일괄 적용
 *
 * 배경
 *   ⑥축 홈페이지 이용편의성·시각품질은 7축 중 최저(58.82)이고,
 *   그 최대 감점 항목은 항목2 접근성(2/5)이다.
 *   ux_quality_gate.mjs 실측: skip link 2/170 · landmark 4종 완비 12/170 · landmark 0개 14/170.
 *   그 중 blog/posts(58) + blog/posts-en(42) = 100개가
 *   완전히 동일한 골격(header/nav/article/footer, <main> 부재, skip link 부재)이었다.
 *   ⇒ 한 곳을 고치면 100개가 함께 오르는 최대 레버다. 비용 0원.
 *
 * 적용하는 변경 (HTML 구조 3건)
 *   ㉮ <body> 직후 skip link 삽입           → 키보드 사용자가 본문으로 바로 이동
 *   ㉯ <article class="post"> 를 <main id="main"> 으로 감쌈 → landmark 4종 완비
 *   ㉰ id="main" 부여                        → skip link 의 목표 앵커
 *
 * 안전 규율 (배포헌법 "확실하지 않으면 배포하지 않는다")
 *   · 치환 대상 문자열이 파일 안에 정확히 1건일 때만 적용한다. 0건/2건 이상이면 건너뛴다.
 *   · 이미 적용된 파일(idempotent 표식 보유)은 건너뛴다. 두 번 돌려도 같은 결과다.
 *   · --dry-run 이 기본이 아니다. 실제 쓰기는 --apply 를 명시해야 한다.
 *   · 텍스트 내용은 한 글자도 바꾸지 않는다. 감싸기와 삽입만 한다.
 *   · 성역 파일은 대상에 들어갈 수 없다 (blog/ 하위만 순회).
 *
 * 측정하지 않은 것
 *   · 실제 스크린리더 낭독 결과 — 이 스크립트의 범위 밖
 *   · 브라우저에서 skip link 가 눈에 보이는 위치에 나타나는지 — CSS 렌더 필요
 *   · 시각적 회귀 — <main> 은 기본 display:block 이라 레이아웃 영향이 없다고 판단했으나
 *     실제 스크린샷 대조는 하지 않았다 (U-8 소관)
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const MARK = 'lp-a11y-skip'; // idempotent 표식

const DIRS = ['blog/posts', 'blog/posts-en'];

/** 언어별 skip link 문안. lang 속성으로 고른다. */
function skipLinkHtml(isEn) {
  const label = isEn ? 'Skip to main content' : '본문으로 바로가기';
  return `<a class="${MARK}" href="#main">${label}</a>`;
}

/** 파일 하나를 변환한다. 반환값 { changed, reason } */
export function transform(src, isEn) {
  if (src.includes(MARK)) return { changed: false, reason: 'already-applied', out: src };

  // ── 안전 확인: 치환 대상이 정확히 1건인가 ──
  const nBody = (src.match(/<body>/g) || []).length;
  const nArtOpen = (src.match(/<article class="post">/g) || []).length;
  const nArtClose = (src.match(/<\/article>/g) || []).length;
  if (nBody !== 1) return { changed: false, reason: `body-count=${nBody}`, out: src };
  if (nArtOpen !== 1) return { changed: false, reason: `article-open-count=${nArtOpen}`, out: src };
  if (nArtClose !== 1) return { changed: false, reason: `article-close-count=${nArtClose}`, out: src };
  if (/<main\b/i.test(src)) return { changed: false, reason: 'main-already-present', out: src };

  let out = src;
  // ㉮ skip link
  out = out.replace('<body>', `<body>\n${skipLinkHtml(isEn)}`);
  // ㉯㉰ article 을 main 으로 감싸고 앵커 부여
  out = out.replace('<article class="post">', '<main id="main">\n<article class="post">');
  out = out.replace('</article>', '</article>\n</main>');
  return { changed: true, reason: 'applied', out };
}

/**
 * 음성 통제군 — 변환기가 "아무것도 안 해도 통과"하지 않는지 확인한다.
 * 거짓 초록불(BT) 방지: 결함이 있는 입력을 넣었을 때 실제로 검출/거부하는가.
 */
export function selfTest() {
  const checks = [];
  const good = `<!doctype html><html lang="ko"><body>\n<header></header><nav></nav>\n<article class="post">x</article>\n<footer></footer></body></html>`;

  // ㉮ 정상 입력은 변환된다
  const r1 = transform(good, false);
  checks.push(['applies_to_clean_input', r1.changed === true]);
  checks.push(['inserts_skip_link', r1.out.includes(MARK) && r1.out.includes('href="#main"')]);
  checks.push(['inserts_main_landmark', /<main id="main">/.test(r1.out)]);
  checks.push(['closes_main', /<\/main>/.test(r1.out)]);

  // ㉯ 두 번 돌려도 중복 삽입되지 않는다 (idempotent)
  const r2 = transform(r1.out, false);
  checks.push(['idempotent_second_run_noop', r2.changed === false && r2.reason === 'already-applied']);
  checks.push(['no_duplicate_main', (r1.out.match(/<main\b/g) || []).length === 1]);

  // ㉰ 결함 입력은 거부한다 — article 이 2개면 감싸기 경계가 모호하다
  const twoArticles = good.replace('<article class="post">x</article>',
    '<article class="post">x</article><article class="post">y</article>');
  const r3 = transform(twoArticles, false);
  checks.push(['rejects_two_articles', r3.changed === false]);

  // ㉱ body 가 없으면 거부한다
  const noBody = good.replace('<body>', '<div>');
  const r4 = transform(noBody, false);
  checks.push(['rejects_missing_body', r4.changed === false]);

  // ㉲ 이미 main 이 있으면 건드리지 않는다
  const hasMain = good.replace('<article class="post">', '<main><article class="post">')
    .replace('</article>', '</article></main>');
  const r5 = transform(hasMain, false);
  checks.push(['rejects_existing_main', r5.changed === false && r5.reason === 'main-already-present']);

  // ㉳ 본문 텍스트를 바꾸지 않는다 — 삽입 전후 가시 텍스트가 보존되는가
  const visibleBefore = good.replace(/<[^>]+>/g, '');
  const visibleAfter = r1.out.replace(new RegExp(`<a class="${MARK}"[^>]*>[^<]*</a>`), '')
    .replace(/<[^>]+>/g, '');
  checks.push(['body_text_preserved', visibleAfter.replace(/\s+/g, '') === visibleBefore.replace(/\s+/g, '')]);

  // ㉴ 영문 페이지는 영문 문안을 쓴다
  const rEn = transform(good, true);
  checks.push(['en_label_used', rEn.out.includes('Skip to main content')]);

  const failed = checks.filter(([, ok]) => !ok).map(([k]) => k);
  return { passed: failed.length === 0, total: checks.length, failed };
}

// ── CLI ───────────────────────────────────────────────────────────────────
const isMain = process.argv[1] && process.argv[1].endsWith('apply_blog_a11y.mjs');
if (isMain) {
  const argv = process.argv.slice(2);
  const apply = argv.includes('--apply');

  const st = selfTest();
  console.log(`[a11y] 음성 통제군: ${st.passed ? 'PASS' : 'FAIL'} (${st.total - st.failed.length}/${st.total})`);
  if (!st.passed) {
    console.error(`[a11y] 실패 항목: ${st.failed.join(', ')}`);
    process.exit(1);
  }
  if (argv.includes('--self-test')) process.exit(0);

  const summary = { applied: 0, skipped: 0, reasons: {} };
  for (const dir of DIRS) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    const isEn = dir.endsWith('-en');
    for (const name of fs.readdirSync(abs).filter(f => f.endsWith('.html')).sort()) {
      const p = path.join(abs, name);
      const src = fs.readFileSync(p, 'utf8');
      const r = transform(src, isEn);
      if (r.changed) {
        if (apply) fs.writeFileSync(p, r.out, 'utf8');
        summary.applied++;
      } else {
        summary.skipped++;
        summary.reasons[r.reason] = (summary.reasons[r.reason] || 0) + 1;
      }
    }
  }
  console.log(`\n[a11y] ${apply ? '적용' : 'DRY-RUN (쓰지 않음 — --apply 필요)'}`);
  console.log(`  변경 대상 : ${summary.applied}개`);
  console.log(`  건너뜀    : ${summary.skipped}개 ${JSON.stringify(summary.reasons)}`);
  console.log('\n[a11y] 미측정 (정직 고지)');
  console.log('  · 실제 스크린리더 낭독 — 이 스크립트의 범위 밖');
  console.log('  · 시각적 회귀 스크린샷 대조 — U-8 소관 (브라우저 필요)');
  process.exit(0);
}
