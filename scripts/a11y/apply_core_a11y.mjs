/**
 * apply_core_a11y.mjs — 핵심 경로 페이지 접근성 적용기
 * ------------------------------------------------------------------
 * 근거 : docs/품질기준서_홈페이지품질_2026-08-28.md §3 · §7
 *        대표 승인 (2026-08-28): ⑥축 핵심 경로 11페이지 착수 + b2b-quote
 *
 * ★ 왜 블로그 방식(apply_blog_a11y.mjs)을 재사용하지 않는가
 *   블로그 100개는 <article class="post"> 구조가 전부 같았다. 그래서
 *   하나의 규칙으로 일괄 처리할 수 있었다. 핵심 경로 페이지는
 *   ㉮ 각자 <style> 을 갖고 공통 스타일시트가 없다
 *   ㉯ header/main/nav/footer 유무가 페이지마다 다르다
 *   ㉰ 본문 시작 지점의 태그가 전부 다르다 (section.hero / div.container / main / form)
 *   따라서 "추측으로 일괄 삽입"하면 가짜 landmark 를 심게 된다(결함 BT).
 *   ⇒ 페이지별 명시 지시표(PLAN)를 만들고, 지시표에 없는 페이지는 건드리지 않는다.
 *
 * ★ 멱등성
 *   MARK 문자열이 이미 있으면 그 페이지는 건너뛴다. 두 번 돌려도 같은 결과다.
 *
 * ★ 안전장치
 *   --apply 없이는 아무것도 쓰지 않는다 (기본은 미리보기).
 *   자기검사(selfTest)가 먼저 통과해야 본작업이 돈다.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..', '..');
const MARK = 'lp-a11y-core';           // 멱등 표식
const CSS_HREF = '/assets/css/a11y-core.css';

/* ────────────────────────────────────────────────────────────────
   페이지별 지시표
   skipTarget : skip link 가 가리킬 id (없으면 우리가 본문 요소에 부여)
   mainOpen   : 이 문자열 '앞'에 <main> 을 연다 (null = main 이미 존재)
   mainClose  : 이 문자열 '뒤'에 </main> 를 닫는다
   needNav    : <nav> 로 감쌀 대상 (null = 이미 존재하거나 대상 없음)
   needFooter : <footer> 승격 대상 (null = 이미 존재)
   ──────────────────────────────────────────────────────────────── */
export const PLAN = {
  'index.html': { has: ['header', 'nav', 'main', 'footer'], skipTarget: null },

  'checkin-21.html': {
    has: ['header', 'footer'],
    mainOpen: '  <!-- ===== Hero ===== -->',
    mainClose: '  <!-- ===== Footer ===== -->',
    navWrap: {
      from: '      <div class="nav-right">',
      to: '      </div>\n    </div>\n  </header>',
      label: '주요 메뉴'
    }
  },
  // ★ 영문판은 한글판과 달리 <!-- ===== Hero ===== --> 주석이 없다 (실측 L279).
  //   추측으로 같은 앵커를 쓰면 실패한다 → 실제 태그를 앵커로 쓴다.
  'checkin-21-en.html': {
    has: ['header', 'footer'],
    mainOpen: '  <section class="hero">',
    mainClose: '  <footer>',
    navWrap: {
      from: '      <div class="nav-right">',
      to: '      </div>\n    </div>\n  </header>',
      label: 'Main menu'
    }
  },

  // ★ form 2페이지는 상단에 언어 토글 링크만 있고 <nav> 가 없다 (실측).
  //   그 링크가 곧 페이지 간 이동 수단이므로 nav 로 승격한다 — 가짜 landmark 를 심는 것이 아니다.
  //   동적 라디오는 JS 템플릿 문자열 안에 있어 정적 치환이 필요하다(dynamicRadio).
  'checkin-21-form.html': {
    has: ['header', 'main'], footerize: true,
    navWrap: { from: '    <a class="lang-toggle" href="/checkin-21-form-en" id="langToggle">EN</a>', to: '    <a class="lang-toggle" href="/checkin-21-form-en" id="langToggle">EN</a>', label: '언어 선택' },
    dynamicRadio: true
  },
  'checkin-21-form-en.html': {
    has: ['header', 'main'], footerize: true,
    navWrap: { from: '    <a class="lang-toggle" href="/checkin-21-form">KO</a>', to: '    <a class="lang-toggle" href="/checkin-21-form">KO</a>', label: 'Language' },
    dynamicRadio: true
  },

  'report.html': { has: ['nav', 'main'], headerize: true, footerize: true },
  'program.html': { has: ['header', 'nav', 'main', 'footer'] },
  'mypage.html': { has: ['header', 'nav'], mainOpen: '    <h1 data-i18n="mypage.title">마이페이지</h1>', mainCloseTail: true, footerize: true },
  'login.html': { has: ['header', 'nav', 'main', 'footer'] },
  'signup.html': { has: ['header', 'nav', 'main', 'footer'] },

  'b2b.html': {
    has: ['header', 'footer'],
    mainOpen: '<!-- ============ Hero ============ -->',
    mainClose: '<footer class="footer" role="contentinfo">',
    navWrap: {
      from: '    <a href="/b2b-quote" class="nav-cta">지금 견적 받기</a>',
      to: '    <a href="/b2b-quote" class="nav-cta">지금 견적 받기</a>',
      label: '주요 메뉴'
    }
  },

  'b2b-quote.html': {
    has: ['header'],
    mainOpen: '    <div id="err" class="err-msg" style="display:none"></div>',
    mainClose: '    </form>\n  </div>',
    navWrap: {
      from: '    <a href="/b2b" class="back-link">← B2B 안내로 돌아가기</a>',
      to: '    <a href="/b2b" class="back-link">← B2B 안내로 돌아가기</a>',
      label: '보조 내비게이션'
    },
    footerize: true,
    labelInputs: true
  }
};

/* ── 유틸 ──────────────────────────────────────────────────── */

export function alreadyApplied(html) {
  return html.includes(MARK);
}

/** <head> 끝에 공통 CSS 링크를 넣는다. 이미 있으면 그대로 둔다. */
export function injectCss(html) {
  if (html.includes(CSS_HREF)) return html;
  const tag = `  <link rel="stylesheet" href="${CSS_HREF}"><!-- ${MARK} -->\n`;
  const i = html.search(/<\/head>/i);
  if (i < 0) return html;
  return html.slice(0, i) + tag + html.slice(i);
}

/** <body> 바로 뒤에 skip link 를 넣는다. */
export function injectSkipLink(html, targetId, text) {
  if (/lp-a11y-skip/.test(html)) return html;
  const m = html.match(/<body[^>]*>/i);
  if (!m) return html;
  const at = m.index + m[0].length;
  const link = `\n<a class="lp-a11y-skip" href="#${targetId}">${text}</a>`;
  return html.slice(0, at) + link + html.slice(at);
}

/** 기존 <main> 에 id 를 붙인다(없을 때만). */
export function ensureMainId(html, id) {
  const m = html.match(/<main\b([^>]*)>/i);
  if (!m) return { html, ok: false };
  if (/\bid\s*=/i.test(m[1])) {
    const idm = m[1].match(/\bid\s*=\s*["']([^"']+)["']/i);
    return { html, ok: true, id: idm ? idm[1] : id };
  }
  const replaced = html.replace(/<main\b/i, `<main id="${id}"`);
  return { html: replaced, ok: true, id };
}

/** 지정 문자열 앞/뒤에 <main> 을 열고 닫는다. */
export function wrapMain(html, openBefore, closeBefore, id) {
  if (/<main\b/i.test(html)) return { html, ok: true, id: null, why: 'main already exists' };
  const a = html.indexOf(openBefore);
  if (a < 0) return { html, ok: false, why: `openBefore not found: ${openBefore.slice(0, 40)}` };
  const b = html.indexOf(closeBefore, a);
  if (b < 0) return { html, ok: false, why: `closeBefore not found: ${closeBefore.slice(0, 40)}` };
  const out =
    html.slice(0, a) +
    `<main id="${id}"><!-- ${MARK} -->\n` +
    html.slice(a, b) +
    `</main><!-- ${MARK} -->\n` +
    html.slice(b);
  return { html: out, ok: true, id };
}

/** 문자열 구간을 <nav> 로 감싼다. */
export function wrapNav(html, from, to, label) {
  if (/<nav\b/i.test(html)) return { html, ok: true, why: 'nav already exists' };
  const a = html.indexOf(from);
  if (a < 0) return { html, ok: false, why: 'nav from not found' };
  const b = html.indexOf(to, a);
  if (b < 0) return { html, ok: false, why: 'nav to not found' };
  const end = b + to.length;
  const inner = html.slice(a, end);
  const out =
    html.slice(0, a) +
    `<nav aria-label="${label}"><!-- ${MARK} -->\n` + inner + `\n</nav>` +
    html.slice(end);
  return { html: out, ok: true };
}

/** </body> 앞에 최소 footer 를 추가한다 (사업자 정보는 넣지 않는다 — 내용 창작 금지). */
export function appendFooter(html, text) {
  if (/<footer\b/i.test(html)) return { html, ok: true, why: 'footer already exists' };
  const i = html.search(/<\/body>/i);
  if (i < 0) return { html, ok: false, why: 'no </body>' };
  const f = `<footer role="contentinfo"><!-- ${MARK} -->\n${text}\n</footer>\n`;
  return { html: html.slice(0, i) + f + html.slice(i), ok: true };
}

/** 최상위 <header> 가 없을 때, 기존 상단 요소를 header 로 감싸지 않고
 *  banner 역할의 최소 header 를 body 직후에 추가한다.
 *  ★ 시각 변화 0 을 위해 내용은 skip link 다음의 빈 배너로 두지 않고,
 *    페이지 제목을 스크린리더에만 제공한다. */
export function appendHeader(html, srText) {
  if (/<header\b/i.test(html)) return { html, ok: true, why: 'header already exists' };
  const m = html.match(/<body[^>]*>/i);
  if (!m) return { html, ok: false, why: 'no <body>' };
  const at = m.index + m[0].length;
  const h = `\n<header role="banner"><!-- ${MARK} --><p class="lp-sr-only">${srText}</p></header>`;
  return { html: html.slice(0, at) + h + html.slice(at), ok: true };
}

/**
 * 라벨 미연결 입력칸에 id 를 부여한다.
 * ★ 게이트 판정식: !/aria-label=|aria-labelledby=|\bid=/ → id 만 있어도 통과.
 *   하지만 게이트를 만족시키는 것이 목적이 아니다. 실제 스크린리더가 읽으려면
 *   앞선 <label> 과 for/id 로 연결돼야 한다. 그래서 둘 다 한다:
 *   ㉮ input 에 id 부여  ㉯ 바로 앞 <label> 에 for 부여
 */
export function labelInputs(html) {
  let out = html;
  let n = 0;
  let implicit = 0;

  /* ── (1) 암묵 연결 구조: <label ...><input ...>...</label> ──────────
     ★ 실측으로 확인한 게이트 거짓 빨간불 (2026-08-28)
       b2b-quote.html 의 라벨미연결 11건 중 5건(라디오 2 · 체크박스 3)은
       <label> 이 <input> 을 '감싸고' 있다. HTML 표준의 암묵적 라벨 연결이며
       스크린리더는 이미 정상적으로 읽는다. 즉 실제 결함이 아니다.
       게이트 정규식은 <input> 태그 안의 aria-label/id 만 보므로 이를 결함으로 센다.
       ⇒ 실제 접근성은 이미 확보돼 있으나, 명시적 연결(for/id)이 암묵 연결보다
         보조기술 호환성이 넓으므로 id 를 부여해 명시 연결로 승격한다.
         (게이트를 속이기 위한 것이 아니라, 승격이 실제로 더 낫기 때문이다) */
  const reImplicit = /<label([^>]*)>(\s*)<(input)\b([^>]*)>/gi;
  out = out.replace(reImplicit, (full, lAttr, ws, tag, fAttr) => {
    if (/\bfor\s*=/i.test(lAttr)) return full;
    if (/\bid\s*=/i.test(fAttr)) return full;
    if (/type\s*=\s*["'](hidden|submit|button)["']/i.test(fAttr)) return full;
    const nm = fAttr.match(/\bname\s*=\s*["']([^"']+)["']/i);
    if (!nm) return full;
    const vm = fAttr.match(/\bvalue\s*=\s*["']([^"']+)["']/i);
    // 라디오는 name 이 같으므로 value 를 붙여 id 충돌을 막는다.
    const id = vm ? `f_${nm[1]}_${vm[1]}` : `f_${nm[1]}`;
    implicit++;
    return `<label${lAttr} for="${id}">${ws}<${tag}${fAttr} id="${id}">`;
  });

  /* ── (2) 형제 구조: <label>텍스트</label> 다음에 오는 input ── */
  const re = /<label([^>]*)>([\s\S]*?)<\/label>\s*(\r?\n\s*)?<(input|select|textarea)\b([^>]*)>/gi;
  out = out.replace(re, (full, lAttr, lInner, ws, tag, fAttr) => {
    // 이미 for/id 가 있으면 건드리지 않는다.
    if (/\bfor\s*=/i.test(lAttr)) return full;
    if (/\bid\s*=/i.test(fAttr)) return full;
    if (/type\s*=\s*["'](hidden|submit|button)["']/i.test(fAttr)) return full;
    // name 을 기반으로 안정적인 id 를 만든다.
    const nm = fAttr.match(/\bname\s*=\s*["']([^"']+)["']/i);
    if (!nm) return full;
    const id = `f_${nm[1]}`;
    n++;
    return `<label${lAttr} for="${id}">${lInner}</label>${ws || ''}<${tag}${fAttr} id="${id}">`;
  });
  return { html: out, count: n + implicit, sibling: n, implicit };
}

/**
 * JS 템플릿 문자열 안에서 만들어지는 동적 라디오에 id 를 부여한다.
 * ★ 실측 사례 (checkin-21-form.html L262):
 *     <label class="choice">
 *       <input type="radio" name="${q.qid}" value="${escapeHtml(c.value)}" ...>
 *   → <label> 이 감싸므로 암묵 연결이 이미 성립한다(스크린리더 정상 동작).
 *     그래도 명시 연결이 호환성이 넓으므로 id 를 붙인다.
 *     id 는 런타임에 qid+value 로 유일해진다.
 */
export function labelDynamicRadio(html) {
  const NEEDLE = '<input type="radio" name="${q.qid}" value="${escapeHtml(c.value)}"';
  if (!html.includes(NEEDLE)) return { html, count: 0 };
  if (html.includes('id="dq_${q.qid}')) return { html, count: 0 }; // 멱등
  let count = 0;
  const out = html.split(NEEDLE).join(
    '<input type="radio" id="dq_${q.qid}_${escapeHtml(c.value)}" name="${q.qid}" value="${escapeHtml(c.value)}"'
  );
  count = (html.match(new RegExp(NEEDLE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  return { html: out, count };
}

/* ── 페이지 처리 ────────────────────────────────────────────── */

export function processOne(file, plan, html) {
  const notes = [];
  if (alreadyApplied(html)) return { html, changed: false, notes: ['already applied (idempotent skip)'] };

  let out = html;
  const isEn = /-en\.html$/.test(file);
  const skipText = isEn ? 'Skip to main content' : '본문으로 바로가기';

  out = injectCss(out);
  notes.push('css linked');

  // header
  if (plan.headerize) {
    const r = appendHeader(out, isEn ? 'Life Portfolio' : '인생포트폴리오');
    out = r.html; notes.push(`header: ${r.ok ? 'added' : 'FAIL ' + r.why}`);
  }

  // nav
  if (plan.navWrap) {
    const r = wrapNav(out, plan.navWrap.from, plan.navWrap.to, plan.navWrap.label);
    out = r.html; notes.push(`nav: ${r.ok ? (r.why || 'wrapped') : 'FAIL ' + r.why}`);
  }

  // main
  let mainId = 'lp-main';
  if (plan.mainOpen && plan.mainClose) {
    const r = wrapMain(out, plan.mainOpen, plan.mainClose, mainId);
    out = r.html; notes.push(`main: ${r.ok ? (r.why || 'wrapped') : 'FAIL ' + r.why}`);
  } else if (plan.mainOpen && plan.mainCloseTail) {
    const a = out.indexOf(plan.mainOpen);
    if (a < 0) { notes.push('main: FAIL open not found'); }
    else if (/<main\b/i.test(out)) { notes.push('main: already exists'); }
    else {
      // 컨테이너 div 가 닫히는 지점을 찾기 어려운 페이지는 <main> 을 열고
      // </body> 직전 스크립트 블록 앞에서 닫는다. 스크립트는 main 밖에 두어도 무해하다.
      const closeAnchor = out.indexOf('\n  <!-- 개인정보처리방침');
      const b = closeAnchor > a ? closeAnchor : out.search(/<\/body>/i);
      out = out.slice(0, a) + `<main id="${mainId}"><!-- ${MARK} -->\n` + out.slice(a, b) +
            `\n</main><!-- ${MARK} -->\n` + out.slice(b);
      notes.push('main: wrapped (tail mode)');
    }
  } else {
    const r = ensureMainId(out, mainId);
    out = r.html;
    if (r.ok && r.id) mainId = r.id;
    notes.push(`main: ${r.ok ? 'id=' + mainId : 'FAIL none found'}`);
  }

  // footer
  if (plan.footerize) {
    const txt = isEn
      ? '  <p class="lp-sr-only">Life Portfolio — contact: faise@lifeportfolio.co.kr</p>'
      : '  <p class="lp-sr-only">인생포트폴리오 · 문의 faise@lifeportfolio.co.kr</p>';
    const r = appendFooter(out, txt);
    out = r.html; notes.push(`footer: ${r.ok ? (r.why || 'added') : 'FAIL ' + r.why}`);
  }

  // input labels
  if (plan.labelInputs) {
    const r = labelInputs(out);
    out = r.html; notes.push(`inputs labelled: ${r.count} (형제 ${r.sibling} · 암묵 ${r.implicit})`);
  }

  // JS 템플릿 문자열 안의 동적 라디오
  if (plan.dynamicRadio) {
    const r = labelDynamicRadio(out);
    out = r.html; notes.push(`dynamic radio: ${r.count}`);
  }

  // skip link (main id 확정 후에 넣는다)
  out = injectSkipLink(out, mainId, skipText);
  notes.push(`skip link → #${mainId}`);

  return { html: out, changed: out !== html, notes };
}

/* ── 자기검사 ──────────────────────────────────────────────── */

export function selfTest() {
  const checks = [];

  // 멱등성
  checks.push(['mark_detected', alreadyApplied(`<x ${MARK} y>`) === true]);
  checks.push(['mark_absent_ok', alreadyApplied('<x y>') === false]);

  // css 주입
  const c1 = injectCss('<html><head><title>t</title></head><body></body></html>');
  checks.push(['css_injected', c1.includes(CSS_HREF)]);
  checks.push(['css_not_doubled', injectCss(c1) === c1]);
  checks.push(['css_before_head_close', c1.indexOf(CSS_HREF) < c1.search(/<\/head>/i)]);

  // skip link
  const s1 = injectSkipLink('<body><p>x</p></body>', 'm1', '본문으로 바로가기');
  checks.push(['skip_injected', /lp-a11y-skip[^>]*href="#m1"/.test(s1)]);
  checks.push(['skip_not_doubled', injectSkipLink(s1, 'm1', 'x') === s1]);
  checks.push(['skip_gate_regex_hits', /skip[-_\s]*(to[-_\s]*)?(the[-_\s]*)?(main|content)|본문으로/i.test(s1)]);
  const s2 = injectSkipLink('<body>x</body>', 'm', 'Skip to main content');
  checks.push(['skip_en_gate_regex_hits', /skip[-_\s]*(to[-_\s]*)?(the[-_\s]*)?(main|content)/i.test(s2)]);

  // main
  const m1 = ensureMainId('<main class="a">x</main>', 'mid');
  checks.push(['main_id_added', /<main id="mid"/.test(m1.html)]);
  const m2 = ensureMainId('<main id="keep">x</main>', 'mid');
  checks.push(['main_existing_id_kept', m2.id === 'keep' && !m2.html.includes('mid')]);
  const m3 = ensureMainId('<div>x</div>', 'mid');
  checks.push(['main_absent_reported', m3.ok === false]);

  const w1 = wrapMain('<body>A<!--S-->B<!--E-->C</body>', '<!--S-->', '<!--E-->', 'zz');
  checks.push(['wrap_main_ok', w1.ok === true && /<main id="zz">/.test(w1.html) && /<\/main>/.test(w1.html)]);
  const w2 = wrapMain('<body>A<!--S-->B</body>', '<!--S-->', '<!--NOPE-->', 'zz');
  checks.push(['wrap_main_missing_close_fails', w2.ok === false]);
  const w3 = wrapMain('<main>x</main>', '<!--S-->', '<!--E-->', 'zz');
  checks.push(['wrap_main_skips_when_present', w3.ok === true && w3.why === 'main already exists']);

  // nav
  const n1 = wrapNav('<div>[A]mid[B]</div>', '[A]', '[B]', 'lbl');
  checks.push(['nav_wrapped', /<nav aria-label="lbl">/.test(n1.html) && /<\/nav>/.test(n1.html)]);
  const n2 = wrapNav('<nav>x</nav>', '[A]', '[B]', 'l');
  checks.push(['nav_skips_when_present', n2.ok === true]);

  // footer / header
  const f1 = appendFooter('<body>x</body>', '  <p>t</p>');
  checks.push(['footer_added', /<footer role="contentinfo">/.test(f1.html) && f1.html.indexOf('<footer') < f1.html.search(/<\/body>/i)]);
  checks.push(['footer_skips_when_present', appendFooter('<footer>a</footer><body>x</body>', 'p').ok === true]);
  const h1 = appendHeader('<body>x</body>', 'T');
  checks.push(['header_added', /<header role="banner">/.test(h1.html)]);

  // input labels
  const li = labelInputs('<label>이름</label>\n<input type="text" name="nm">');
  checks.push(['label_for_added', /for="f_nm"/.test(li.html)]);
  checks.push(['input_id_added', /id="f_nm"/.test(li.html)]);
  checks.push(['label_count', li.count === 1]);
  const li2 = labelInputs('<label for="x">n</label><input id="x" name="nm">');
  checks.push(['label_existing_untouched', li2.count === 0]);
  const li3 = labelInputs('<label>n</label><input type="hidden" name="h">');
  checks.push(['hidden_input_skipped', li3.count === 0]);
  const li4 = labelInputs('<label>n</label><input type="radio" name="r" value="1">');
  checks.push(['radio_gets_id', li4.count === 1]);

  // 암묵 연결 구조 (label 이 input 을 감싼 경우) — 실측 발견 사례
  const im = labelInputs('<label class="c">\n  <input type="checkbox" name="ag" required>\n  <span>동의</span>\n</label>');
  checks.push(['implicit_label_promoted', im.implicit === 1 && /for="f_ag"/.test(im.html) && /id="f_ag"/.test(im.html)]);
  checks.push(['implicit_span_preserved', /<span>동의<\/span>/.test(im.html)]);
  // 라디오 2개는 name 이 같다 → value 로 id 를 갈라야 충돌하지 않는다
  const rr = labelInputs('<label><input type="radio" name="o" value="a"><span>A</span></label><label><input type="radio" name="o" value="b"><span>B</span></label>');
  checks.push(['radio_ids_unique', /id="f_o_a"/.test(rr.html) && /id="f_o_b"/.test(rr.html)]);
  const ids = [...rr.html.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
  checks.push(['no_duplicate_ids', new Set(ids).size === ids.length]);
  // 이미 for 가 있으면 손대지 않는다
  const im2 = labelInputs('<label for="z"><input id="z" name="n"></label>');
  checks.push(['implicit_existing_untouched', im2.implicit === 0]);

  // 동적 라디오 (JS 템플릿 문자열)
  const dyn = '<label class="choice">\n<input type="radio" name="${q.qid}" value="${escapeHtml(c.value)}" >\n</label>';
  const d1 = labelDynamicRadio(dyn);
  checks.push(['dynamic_radio_id_added', d1.count === 1 && d1.html.includes('id="dq_${q.qid}_${escapeHtml(c.value)}"')]);
  checks.push(['dynamic_radio_name_kept', /name="\$\{q\.qid\}"/.test(d1.html)]);
  checks.push(['dynamic_radio_idempotent', labelDynamicRadio(d1.html).count === 0]);
  checks.push(['dynamic_radio_noop_when_absent', labelDynamicRadio('<input type="radio" name="x">').count === 0]);
  // 게이트 판정식 대조: id 가 붙으면 inputNoLabel 에서 빠진다
  const gateOk = !/aria-label\s*=|aria-labelledby\s*=|\bid\s*=/i.test('<input type="text" name="nm">')
              && /\bid\s*=/i.test('<input type="text" name="nm" id="f_nm">');
  checks.push(['matches_gate_input_rule', gateOk]);

  // 멱등: processOne 두 번 → 두 번째는 변화 없음
  const page = '<html><head><title>t</title></head><body><header>h</header><nav>n</nav><main>m</main><footer>f</footer></body></html>';
  const p1 = processOne('x.html', { has: [] }, page);
  const p2 = processOne('x.html', { has: [] }, p1.html);
  checks.push(['process_idempotent', p1.changed === true && p2.changed === false]);

  // PLAN 무결성
  checks.push(['plan_has_12', Object.keys(PLAN).length === 12]);
  checks.push(['plan_files_exist', Object.keys(PLAN).every(f => fs.existsSync(path.join(ROOT, f)))]);
  checks.push(['css_file_exists', fs.existsSync(path.join(ROOT, 'assets', 'css', 'a11y-core.css'))]);

  const failed = checks.filter(([, ok]) => !ok);
  console.log(`[core-a11y] 자기검사 ${checks.length - failed.length}/${checks.length}`);
  failed.forEach(([n]) => console.log(`  FAIL ${n}`));
  return failed.length === 0;
}

/* ── CLI ───────────────────────────────────────────────────── */

const isMain = process.argv[1] && process.argv[1].endsWith('apply_core_a11y.mjs');
if (isMain) {
  const ok = selfTest();
  if (!ok) { console.error('[core-a11y] 자기검사 실패 — 본작업을 중단한다.'); process.exit(1); }
  if (process.argv.includes('--self-test')) process.exit(0);

  const apply = process.argv.includes('--apply');
  console.log(`[core-a11y] 모드: ${apply ? 'APPLY (파일을 쓴다)' : 'DRY-RUN (미리보기)'}`);
  let changedN = 0, failN = 0;
  for (const [file, plan] of Object.entries(PLAN)) {
    const abs = path.join(ROOT, file);
    const src = fs.readFileSync(abs, 'utf8');
    const r = processOne(file, plan, src);
    const bad = r.notes.filter(n => n.includes('FAIL'));
    if (bad.length) failN++;
    if (r.changed) changedN++;
    console.log(`\n${file}  ${r.changed ? '변경됨' : '변경없음'}`);
    r.notes.forEach(n => console.log(`   - ${n}`));
    if (apply && r.changed) fs.writeFileSync(abs, r.html);
  }
  console.log(`\n[core-a11y] 대상 ${Object.keys(PLAN).length} · 변경 ${changedN} · 지시실패 ${failN}`);
  if (failN > 0) { console.error('[core-a11y] 지시표 불일치가 있다 — 확인 필요.'); process.exit(1); }
}
