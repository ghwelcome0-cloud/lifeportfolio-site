#!/usr/bin/env node
'use strict';
/* 안정성 점검 하네스 엔진 v0.1
 * 사용: node run.cjs --base <origin> --lane public|isolated [--cases <glob dir>] [--out <dir>] [--allow-hosts a,b] [--only id,id] [--viewports pc,mobile]
 * 판정: PASS / FAIL / NOT_RUN / BLOCKED / NOT_APPLICABLE
 * 비파괴 원칙: lane=public 에서는 폼 submit·결제·메일·코드 생성 버튼을 절대 클릭하지 않는다(step 'click'은 data-harness-safe 또는 명시 selector만; 'submit' step은 lane=isolated 전용).
 */
const VERSION = '0.2.0';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const puppeteer = require('puppeteer');
const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true] : []).filter(x => x.length));
const BASE = (args.base || 'https://lifeportfolio.co.kr').replace(/\/$/, '');
const LANE = args.lane || 'public';
const OUT = args.out || path.join(__dirname, 'evidence');
const CASE_DIR = args.cases || path.join(__dirname, 'cases');
const ALLOW = (args['allow-hosts'] || '').split(',').filter(Boolean);
const ONLY = args.only ? new Set(args.only.split(',')) : null;
const VIEWPORTS = { pc: { width: 1440, height: 900, mobile: false }, pcwide: { width: 1920, height: 1080, mobile: false }, mobile: { width: 390, height: 844, mobile: true, hasTouch: true, deviceScaleFactor: 3 }, mobilesmall: { width: 320, height: 568, mobile: true, hasTouch: true }, tablet: { width: 768, height: 1024, mobile: true, hasTouch: true }, landscape: { width: 844, height: 390, mobile: true, hasTouch: true } };
const VPS = (args.viewports || 'pc,mobile').split(',');
const TOUCH_MIN = Number(args['touch-min'] || 32); // 모바일 터치 타깃 최소 px(관찰 기준). 주 CTA 미만만 FAIL
const PRIMARY_CTA = 'button[type=submit],.pay-btn,#payBtn,#submitBtn,#emailSubmit,.cta,.btn-primary,[data-primary-cta]';
const ANALYTICS_RE = /googletagmanager|gtag|google-analytics|analytics|apis\.google\.com\/js\/gen_204|clarity|hotjar|doubleclick/i; // 비핵심(분석) 리소스 — 차단돼도 서비스 기능과 무관 → INFO
const RUN_ID = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + '-' + LANE;
const EV = path.join(OUT, RUN_ID); fs.mkdirSync(EV, { recursive: true });
const PROD_HOSTS = ['lifeporfolio-default-rtdb.asia-southeast1.firebasedatabase.app', 'asia-northeast3-lifeporfolio.cloudfunctions.net', 'firestore.googleapis.com', 'identitytoolkit.googleapis.com', 'payple', 'paypal'];
const rows = []; const defects = []; const observations = [];
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

function loadCases() {
  const files = fs.readdirSync(CASE_DIR).filter(f => f.endsWith('.json') && f.startsWith(LANE + '-'));
  return files.flatMap(f => { const j = JSON.parse(fs.readFileSync(path.join(CASE_DIR, f), 'utf8')); return (j.cases || []).map(c => ({ ...j.defaults, ...c, _file: f })); });
}

async function runCase(browser, c, vpName, lang) {
  const vp = VIEWPORTS[vpName]; const caseId = `${c.id}__${lang}__${vpName}`;
  if (ONLY && !ONLY.has(c.id)) return;
  const row = { case_id: caseId, route_id: c.route || c.url, feature: c.feature || '', language: lang, user_state: c.user_state || 'anonymous', data_state: c.data_state || 'none', environment: `chromium-${vpName}-${vp.width}x${vp.height}`, preconditions: c.preconditions || '', action: (c.steps || []).map(s => s.type).join('>'), expected: c.expected || '', observed: '', status: 'NOT_RUN', severity: c.severity || '', evidence_ref: '', source_sha: args['source-sha'] || '', tested_at: new Date().toISOString(), limitations: c.limitations || '' };
  if (c.lanes && !c.lanes.includes(LANE)) { row.status = 'NOT_APPLICABLE'; row.observed = 'lane 범위 밖'; rows.push(row); return; }
  if (c.requires_approval) { row.status = 'BLOCKED'; row.observed = 'approval: ' + c.requires_approval; rows.push(row); return; }
  if (c.languages && !c.languages.includes(lang)) { row.status = 'NOT_APPLICABLE'; row.observed = `언어 ${lang} 제공 범위 밖(명시)`; rows.push(row); return; }
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  const console_errors = [], failed_requests = [], prod_hits = [], csp_violations = [], requests = [];
  await page.setViewport(vp); if (vp.mobile) await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
  await page.setExtraHTTPHeaders({ 'Accept-Language': lang === 'en' ? 'en-US,en;q=0.9' : 'ko-KR,ko;q=0.9' });
  await page.setRequestInterception(true);
  page.on('request', r => {
    const u = r.url(); requests.push(u);
    const h = new URL(u).hostname;
    if (LANE === 'isolated' && ALLOW.length && !ALLOW.some(a => h === a || h.endsWith('.' + a)) && !u.startsWith('data:') && !u.startsWith(BASE)) { prod_hits.push(u); return r.abort(); }
    if (LANE === 'public' && PROD_HOSTS.some(p => h.includes(p)) && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(r.method())) { prod_hits.push(r.method() + ' ' + u); return r.abort(); } // public lane: never write to production
    r.continue();
  });
  page.on('console', m => { const t = m.type(); const txt = m.text(); if (t === 'error') console_errors.push(txt.slice(0, 300)); if (/Content Security Policy/.test(txt)) csp_violations.push({ reportOnly: /Report-Only|report-only/.test(txt), text: txt.slice(0, 200) }); });
  page.on('pageerror', e => console_errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('requestfailed', r => { const f = r.failure(); if (f && !/net::ERR_ABORTED|BLOCKED_BY_CLIENT/.test(f.errorText)) failed_requests.push(r.url().slice(0, 200) + ' ' + f.errorText); });
  const checks = [];
  try {
    const url = BASE + (c.url || '/') + (lang === 'en' && c.en_query !== false && !(c.url || '').includes('lang=') ? ((c.url || '').includes('?') ? '&' : '?') + 'lang=en' : '');
    const resp = await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
    const status = resp ? resp.status() : 0; checks.push(['http', status, c.expect_status || 200, status === (c.expect_status || 200)]);
    // i18n readiness (재발 위험 3) — 비로그인 리다이렉트(JS location 변경)로 컨텍스트가 파괴될 수 있어 1회 재시도
    const settle = async () => { await page.evaluate(() => new Promise(res => { const I = window.LP_I18N; if (I && typeof I.onReady === 'function') { I.onReady(() => res()); setTimeout(res, 4000); } else setTimeout(res, 800); })); await new Promise(r => setTimeout(r, c.settle_ms || 800)); };
    try { await settle(); } catch (e) { if (/context was destroyed|navigation/i.test(String(e))) { await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {}); await settle().catch(() => {}); } }
    const finalUrl = page.url(); const redirected = finalUrl.split('?')[0] !== url.split('?')[0];
    checks.push(['final_url', finalUrl.replace(BASE, ''), c.expect_final || (redirected ? '(redirect 관찰)' : '(same)'), c.expect_final ? new RegExp(c.expect_final).test(finalUrl) : true, redirected ? 'redirect' : '']);
    const htmlLang = await page.evaluate(() => document.documentElement.lang);
    const effLang = await page.evaluate(() => (window.LP_I18N && (window.LP_I18N.lang || window.LP_I18N.current)) || document.documentElement.lang);
    checks.push(['html_lang', htmlLang, c.expect_html_lang || lang, !c.expect_html_lang || htmlLang === c.expect_html_lang]);
    // untranslated keys / raw i18n tokens visible
    const rawKeys = await page.evaluate(() => { const t = document.body.innerText; const m = t.match(/\b[a-z]+\.[a-z_]+(\.[a-z_]+)+\b/g) || []; return [...new Set(m.filter(k => /^(home|login|report|program|mypage|survey|suvey|common|footer|nav|b2b|signup|pay)\./.test(k)))].slice(0, 10); });
    checks.push(['untranslated_keys', rawKeys.join('|'), '0', rawKeys.length === 0]);
    // horizontal overflow (모바일 가로 넘침)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    checks.push(['h_overflow_px', overflow, '<=2', overflow <= 2]);
    // required texts (가격·권리·경고 문구)
    for (const t of (c.must_contain || {})[lang] || c.must_contain_any || []) { const has = await page.evaluate(x => document.body.innerText.includes(x), t); checks.push(['must_contain', t, 'present', has]); }
    for (const t of (c.must_not_contain || {})[lang] || []) { const has = await page.evaluate(x => document.body.innerText.includes(x), t); checks.push(['must_not_contain', t, 'absent', !has]); }
    // selectors visible / tappable
    for (const s of c.must_visible || []) { const ok = await page.evaluate(sel => { const e = document.querySelector(sel); if (!e) return 'missing'; const r = e.getBoundingClientRect(); const st = getComputedStyle(e); return (r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none') ? 'visible' : 'hidden'; }, s); checks.push(['visible', s, 'visible', ok === 'visible']); }
    for (const s of c.must_hidden || []) { const ok = await page.evaluate(sel => { const e = document.querySelector(sel); if (!e) return 'missing'; const r = e.getBoundingClientRect(); const st = getComputedStyle(e); return (r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none') ? 'visible' : 'hidden'; }, s); checks.push(['hidden', s, 'hidden|missing', ok !== 'visible']); }
    // touch targets on mobile (buttons/links < 36px)
    if (vp.mobile) {
      const small = await page.evaluate((min, cta) => [...document.querySelectorAll('a,button,[role=button],input[type=submit]')].filter(e => { const r = e.getBoundingClientRect(); const st = getComputedStyle(e); return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && (r.height < min || r.width < min) && r.top < innerHeight * 2; }).slice(0, 12).map(e => ({ label: (e.innerText || e.getAttribute('aria-label') || e.id || e.className || '?').toString().trim().slice(0, 30), h: Math.round(e.getBoundingClientRect().height), w: Math.round(e.getBoundingClientRect().width), cta: e.matches(cta) })), TOUCH_MIN, PRIMARY_CTA);
      const ctaSmall = small.filter(s => s.cta);
      // 주 CTA 가 작으면 FAIL(P2), 그 외 보조 링크(헤더 언어 토글·로그인 등)는 P3 관찰로 기록
      checks.push(['small_cta_targets', ctaSmall.map(s => `${s.label}(${s.w}x${s.h})`).join('|'), `0 (<${TOUCH_MIN}px)`, ctaSmall.length === 0]);
      checks.push(['obs_small_touch_targets', small.filter(s => !s.cta).map(s => `${s.label}(${s.w}x${s.h})`).join('|'), `P3 관찰(<${TOUCH_MIN}px)`, true, 'info']);
    }
    // steps (non-destructive by default)
    for (const st of c.steps || []) {
      if (st.type === 'click') { if (LANE === 'public' && st.destructive) { checks.push(['step_skipped', st.selector, 'public lane: destructive click skipped', true]); continue; } await page.click(st.selector).catch(e => checks.push(['click', st.selector, 'ok', false, String(e).slice(0, 100)])); await new Promise(r => setTimeout(r, st.wait || 600)); }
      if (st.type === 'type') { await page.type(st.selector, st.text || '').catch(e => checks.push(['type', st.selector, 'ok', false, String(e).slice(0, 100)])); }
      if (st.type === 'expect_url') { const u = page.url(); checks.push(['url', u, st.pattern, new RegExp(st.pattern).test(u)]); }
      if (st.type === 'expect_text') { const has = await page.evaluate(x => document.body.innerText.includes(x), st.text); checks.push(['expect_text', st.text, 'present', has]); }
      if (st.type === 'expect_visible') { const ok = await page.$(st.selector).then(async e => e && (await e.boundingBox()) !== null); checks.push(['expect_visible', st.selector, 'visible', !!ok]); }
      if (st.type === 'scroll_bottom') { await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await new Promise(r => setTimeout(r, 700)); }
      if (st.type === 'eval') { const v = await page.evaluate(st.js).catch(e => 'ERR ' + e); checks.push(['eval', st.label || st.js.slice(0, 40), st.expect, String(v) === String(st.expect), String(v).slice(0, 120)]); }
      if (st.type === 'submit' && LANE !== 'isolated') { checks.push(['step_skipped', 'submit', 'isolated lane only', true]); }
      if (st.type === 'submit' && LANE === 'isolated') { await Promise.all([page.waitForNavigation({ timeout: 15000 }).catch(() => {}), page.click(st.selector)]); await new Promise(r => setTimeout(r, st.wait || 1000)); }
    }
    // console / network / csp
    const realErrors = console_errors.filter(e => !/favicon|ERR_BLOCKED_BY_CLIENT|Report-Only|report-only|net::ERR_ABORTED|Content Security Policy/i.test(e) && !ANALYTICS_RE.test(e) && !(c.expect_status && c.expect_status >= 400 && /status of \d{3}/.test(e)) && !(c.allow_pageerror && e.includes(c.allow_pageerror)));
    checks.push(['console_errors', realErrors.length + (realErrors.length ? ': ' + realErrors[0].slice(0, 120) : ''), '0', realErrors.length === 0]);
    const realFailed = failed_requests.filter(f => !ANALYTICS_RE.test(f) && !/favicon/i.test(f));
    checks.push(['failed_requests', realFailed.length + (realFailed.length ? ': ' + realFailed[0] : ''), '0', realFailed.length === 0]);
    // CSP: enforce 차단 중 분석 도구(GTM/GA 등)는 서비스 기능과 무관 → INFO(별도 관찰). 그 외 enforce 차단은 FAIL(기능 리소스 차단 가능성)
    const enforced = csp_violations.filter(v => !v.reportOnly);
    const enfCore = enforced.filter(v => !ANALYTICS_RE.test(v.text)); const enfAnalytics = enforced.filter(v => ANALYTICS_RE.test(v.text));
    checks.push(['csp_enforced_blocks', enfCore.length + (enfCore.length ? ': ' + enfCore[0].text.slice(0, 100) : ''), '0', enfCore.length === 0]);
    checks.push(['obs_csp_analytics_blocked', enfAnalytics.length + (enfAnalytics.length ? ': ' + [...new Set(enfAnalytics.map(v => (v.text.match(/https?:\/\/[^\s'"]+/) || [''])[0].slice(0, 60)))].join('|') : ''), 'INFO', true, 'info']);
    const roCount = csp_violations.filter(v => v.reportOnly).length; checks.push(['obs_csp_report_only', roCount, 'INFO(Report-Only, 차단 없음)', true, 'info']);
    checks.push(['prod_write_attempts', prod_hits.length + (prod_hits.length ? ': ' + prod_hits[0].slice(0, 100) : ''), '0', prod_hits.length === 0]);
    const shot = path.join(EV, caseId + '.png'); await page.screenshot({ path: shot, fullPage: !!c.full_page }).catch(() => {});
    row.evidence_ref = path.relative(OUT, shot);
  } catch (e) { checks.push(['exception', String(e).slice(0, 200), '-', false]); }
  finally { await ctx.close().catch(() => {}); }
  const failed = checks.filter(ch => ch[3] === false);
  row.status = failed.length ? 'FAIL' : 'PASS';
  row.observed = checks.filter(ch => ch[4] !== 'info' || String(ch[1]) !== '' && String(ch[1]) !== '0').map(ch => `${ch[0]}=${String(ch[1]).replace(/[\n\r,]/g, ' ').slice(0, 80)}${ch[3] ? '' : ' ✗'}`).join(' ; ');
  row.observations = checks.filter(ch => ch[4] === 'info' && String(ch[1]) !== '' && String(ch[1]) !== '0').map(ch => `${ch[0]}=${String(ch[1]).replace(/[\n\r,]/g, ' ').slice(0, 120)}`).join(' ; ');
  for (const ch of checks) if (ch[4] === 'info' && String(ch[1]) !== '' && String(ch[1]) !== '0') observations.push({ case_id: caseId, kind: ch[0], detail: String(ch[1]).slice(0, 200) });
  fs.writeFileSync(path.join(EV, caseId + '.json'), JSON.stringify({ case: c, checks, console_errors, failed_requests: failed_requests.slice(0, 30), csp_violations: csp_violations.slice(0, 20), prod_hits, request_hosts: [...new Set(requests.map(u => { try { return new URL(u).hostname; } catch { return u.slice(0, 30); } }))] }, null, 1));
  if (failed.length) defects.push({ case_id: caseId, failed: failed.map(f => f[0] + ': ' + String(f[1]).slice(0, 100)) });
  rows.push(row); log(row.status, caseId, failed.length ? failed.map(f => f[0]).join(',') : '');
}

(async () => {
  const cases = loadCases(); log(`lane=${LANE} base=${BASE} cases=${cases.length} viewports=${VPS.join(',')} run=${RUN_ID}`);
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--lang=' + 'ko-KR'] });
  for (const c of cases) for (const vp of (c.viewports || VPS)) for (const lang of (c.langs || ['ko', 'en'])) await runCase(browser, c, vp, lang);
  await browser.close();
  const cols = Object.keys(rows[0] || { case_id: 1 });
  const csv = [cols.join(','), ...rows.map(r => cols.map(k => '"' + String(r[k] ?? '').replace(/"/g, '""') + '"').join(','))].join('\n');
  fs.writeFileSync(path.join(EV, 'test-matrix.csv'), csv);
  const count = s => rows.filter(r => r.status === s).length;
  const obsByKind = {}; for (const o of observations) (obsByKind[o.kind] = obsByKind[o.kind] || []).push(o);
  const obsMd = Object.entries(obsByKind).map(([k, arr]) => `### ${k} (${arr.length}건)\n` + [...new Set(arr.map(o => o.detail))].slice(0, 15).map(d => `- ${d}`).join('\n') + `\n  - 케이스: ${arr.map(o => o.case_id).slice(0, 20).join(', ')}${arr.length > 20 ? ' …' : ''}`).join('\n\n');
  const summary = `# 안정성 하네스 결과 · ${RUN_ID}\n\nbase ${BASE} · lane ${LANE} · 환경 chromium headless(Linux, puppeteer) — 실기기/Safari/Samsung Internet 아님 · source_sha ${args['source-sha'] || '-'} · touch_min ${TOUCH_MIN}px\n\n| PASS | FAIL | NOT_RUN | BLOCKED | NOT_APPLICABLE |\n|---|---|---|---|---|\n| ${count('PASS')} | ${count('FAIL')} | ${count('NOT_RUN')} | ${count('BLOCKED')} | ${count('NOT_APPLICABLE')} |\n\n## FAIL 목록\n${defects.map(d => `- **${d.case_id}**: ${d.failed.join(' / ')}`).join('\n') || '- 없음'}\n\n## 관찰(INFO · 판정에 미반영, P3 후보)\n${obsMd || '- 없음'}\n\n## BLOCKED(승인 필요)\n${rows.filter(r => r.status === 'BLOCKED').map(r => `- ${r.case_id}: ${r.observed}`).join('\n') || '- 없음'}\n\n증빙: \`${path.relative(process.cwd(), EV)}/\` (스크린샷·콘솔·네트워크 호스트 목록; 고객 데이터 없음)\n`;
  fs.writeFileSync(path.join(EV, 'summary.md'), summary);
  const files = fs.readdirSync(EV).filter(f => f !== 'evidence-index.json');
  fs.writeFileSync(path.join(EV, 'evidence-index.json'), JSON.stringify({ run_id: RUN_ID, base: BASE, lane: LANE, source_sha: args['source-sha'] || '', engine: 'stability-harness/' + VERSION, environment: 'chromium-headless-linux', counts: { PASS: count('PASS'), FAIL: count('FAIL'), NOT_RUN: count('NOT_RUN'), BLOCKED: count('BLOCKED'), NOT_APPLICABLE: count('NOT_APPLICABLE') }, rows: rows.length, observations: observations.length, files: files.map(f => ({ file: f, sha256: sha(fs.readFileSync(path.join(EV, f))) })) }, null, 1));
  console.log(summary); process.exit(count('FAIL') ? 2 : 0);
})();
