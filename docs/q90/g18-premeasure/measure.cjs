'use strict';
// G18 비교대상 공개 표면 사전 측정 (public landing page only, no sign-in, no test-taking).
// Measures ONLY what can be measured from a public page without an account:
//   A6.1 mobile fit (390px: viewport meta, horizontal overflow, zoom allowed)
//   A6.3 text readability (390px: body text >=16px share, <12px count)
//   A6.4 touch targets (390px: interactive elements >=44x44 share, >=24 share)
//   A7.1 transport/headers (HTTPS, HSTS, X-Content-Type-Options, X-Frame-Options/frame-ancestors, Referrer-Policy, Permissions-Policy)
//   A7.5 public surface (probe of 6 should-be-private paths returning 200 with sensitive content)
//   A7.6 CSP report-to / report-uri configured
// Everything else (A1~A5, A6.2/A6.5/A6.6, A7.2/A7.3/A7.4) is NOT measurable here -> 미측정.
const fs = require('fs'), path = require('path');
const pptr = require('/home/user/webapp/node_modules/puppeteer-core');
const EXE = '/home/user/.cache/puppeteer/chrome-headless-shell/linux-148.0.7778.97/chrome-headless-shell-linux64/chrome-headless-shell';
const targets = require('./targets.json');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PRIVATE_PROBES = ['/.env', '/.git/HEAD', '/wp-config.php', '/package.json', '/server-status', '/.DS_Store'];

async function headers(url) {
  const r = { ok: false };
  try {
    const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) G18-public-surface-probe' }, signal: AbortSignal.timeout(20000) });
    const h = Object.fromEntries([...res.headers.entries()]);
    const csp = h['content-security-policy'] || '';
    const cspro = h['content-security-policy-report-only'] || '';
    r.ok = true; r.status = res.status; r.finalUrl = res.url; r.https = res.url.startsWith('https://');
    r.hsts = !!h['strict-transport-security'];
    r.xcto = (h['x-content-type-options'] || '').toLowerCase() === 'nosniff';
    r.frame = !!h['x-frame-options'] || /frame-ancestors/i.test(csp);
    r.referrer = !!h['referrer-policy'];
    r.permissions = !!h['permissions-policy'];
    r.csp = !!csp; r.cspReporting = /report-(to|uri)/i.test(csp + ' ' + cspro) || !!h['report-to'] || !!h['reporting-endpoints'];
    r.server = h['server'] || null;
  } catch (e) { r.error = String(e && e.message || e).slice(0, 120); }
  return r;
}
async function publicSurface(origin) {
  const out = [];
  for (const p of PRIVATE_PROBES) {
    try {
      const res = await fetch(origin + p, { redirect: 'manual', headers: { 'user-agent': 'Mozilla/5.0 G18-public-surface-probe' }, signal: AbortSignal.timeout(15000) });
      let exposed = false;
      if (res.status === 200) {
        const t = (await res.text()).slice(0, 4000);
        const ct = res.headers.get('content-type') || '';
        if (p === '/.env') exposed = /^[A-Z_]+=.+/m.test(t);
        else if (p === '/.git/HEAD') exposed = /^ref: refs\//m.test(t);
        else if (p === '/wp-config.php') exposed = /DB_PASSWORD/.test(t);
        else if (p === '/package.json') exposed = /"dependencies"|"scripts"/.test(t) && /json/.test(ct);
        else if (p === '/server-status') exposed = /Apache Server Status/.test(t);
        else if (p === '/.DS_Store') exposed = t.startsWith('\u0000\u0000\u0000\u0001Bud1');
      }
      out.push({ path: p, status: res.status, exposed });
    } catch (e) { out.push({ path: p, status: null, exposed: false, error: String(e.message).slice(0, 60) }); }
  }
  return out;
}
async function mobile(browser, url, slug) {
  const pg = await browser.newPage();
  await pg.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
  await pg.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const r = { ok: false };
  try {
    const resp = await pg.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
    await sleep(2500);
    r.status = resp && resp.status();
    r.title = (await pg.title()).slice(0, 80);
    const m = await pg.evaluate(() => {
      const vp = document.querySelector('meta[name=viewport]');
      const content = vp ? vp.getAttribute('content') || '' : '';
      const zoomBlocked = /user-scalable\s*=\s*(no|0)/i.test(content) || /maximum-scale\s*=\s*1(\.0+)?(\s*,|$)/i.test(content);
      const docW = Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0);
      const overflow = docW > window.innerWidth + 1;
      // text nodes
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n, total = 0, ge16 = 0, lt12 = 0, chars = 0, chars16 = 0;
      const seen = new Set();
      while ((n = walker.nextNode())) {
        const t = n.textContent.replace(/\s+/g, ' ').trim(); if (t.length < 20) continue;
        const el = n.parentElement; if (!el || seen.has(el)) continue; seen.add(el);
        const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const rect = el.getBoundingClientRect(); if (rect.width === 0 || rect.height === 0) continue;
        const fs = parseFloat(cs.fontSize); total++; chars += t.length; if (fs >= 16) { ge16++; chars16 += t.length; } if (fs < 12) lt12++;
      }
      // touch targets
      const cands = [...document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,[role=button],[onclick]')];
      let tt = 0, ok44 = 0, ok24 = 0;
      for (const el of cands) {
        const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const rc = el.getBoundingClientRect(); if (rc.width < 1 || rc.height < 1) continue;
        if (rc.bottom < 0 || rc.top > 5000) continue;
        tt++; if (rc.width >= 44 && rc.height >= 44) ok44++; if (rc.width >= 24 && rc.height >= 24) ok24++;
      }
      return { viewportMeta: !!vp, viewportContent: content.slice(0, 80), zoomBlocked, docW, innerW: window.innerWidth, overflow, text: { blocks: total, ge16, lt12, chars, chars16 }, touch: { total: tt, ok44, ok24 }, lang: document.documentElement.lang || '' };
    });
    Object.assign(r, m); r.ok = true;
    await pg.screenshot({ path: path.join(OUT, slug + '-390.png'), fullPage: false });
  } catch (e) { r.error = String(e && e.message || e).slice(0, 160); }
  await pg.close().catch(() => {});
  return r;
}
(async () => {
  const browser = await pptr.launch({ executablePath: EXE, headless: 'shell', args: ['--no-sandbox', '--disable-gpu', '--lang=en-US'] });
  const results = [];
  for (const t of targets) {
    if (t.skip) { results.push({ ...t, measured: false, reason: 'own service — intentionally blank' }); continue; }
    const origin = new URL(t.url).origin;
    process.stderr.write('measuring ' + t.row + ' ' + origin + '\n');
    const [h, ps, mb] = [await headers(t.url), await publicSurface(origin), await mobile(browser, t.url, t.row)];
    results.push({ ...t, origin, measuredAt: new Date().toISOString(), headers: h, publicSurface: ps, mobile: mb });
    fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 1));
  }
  await browser.close();
  console.log('done', results.length);
})();
