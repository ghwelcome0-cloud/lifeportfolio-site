'use strict';
// 제휴 결제 서버 시험 — 실제 핸들러 + 로컬 Firestore/RTDB/Auth 에뮬레이터. 페이플·페이팔·메일·속도제한은 가짜.
// 실행: npm run test:partner:emulator  (실제 결제·실제 메일 아님)
const path = require('node:path'), assert = require('node:assert/strict'), { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
for (const k of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_DATABASE_EMULATOR_HOST']) assert.match(process.env[k] || '', /^127\.0\.0\.1:\d+$/, 'Refuse non-local emulator: ' + k);
const deps = createRequire(path.resolve(process.env.LP_FUNCTIONS_DEPS || path.join(root, 'functions'), 'package.json'));
const admin = deps('firebase-admin');
const project = 'demo-lp-b2b-stability';
admin.initializeApp({ projectId: project, databaseURL: `https://${project}-default-rtdb.firebaseio.com` });
const M = require('../functions/_partner_module.js')._internals;
const S = require('../functions/_stats_module.js')._internals;
const db = admin.firestore(), rtdb = admin.database();
const results = []; const ok = (n, c, d) => { results.push({ n, c: !!c }); console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' ' + JSON.stringify(d === undefined ? '' : d).slice(0, 400))); };
const err = async (p) => { try { await p; return null; } catch (e) { return e.code || e.message; } };

let NOW = Date.parse('2026-10-26T10:00:00+09:00');
const payple = { calls: 0, next: null }, paypal = { created: [], next: null };
const alerts = [];
const D = () => ({
  now: () => NOW, rateLimit: async () => {}, alert: async (a) => { alerts.push(a); },
  paypleConfirm: async ({ auth }) => { payple.calls++; return payple.next || { PCD_PAY_RST: 'success', PCD_PAY_TOTAL: auth.PCD_PAY_TOTAL, PCD_USER_DEFINE1: auth.PCD_USER_DEFINE1, PCD_PAY_OID: auth.PCD_PAY_OID }; },
  paypalCreate: async (o) => { paypal.created.push(o); return 'ORDER-' + paypal.created.length; },
  paypalCapture: async ({ orderID }) => paypal.next || { status: 'COMPLETED', customId: paypal.created[Number(orderID.split('-')[1]) - 1].customId, captureID: 'CAP-' + orderID, amount: paypal.created[Number(orderID.split('-')[1]) - 1].amount, currency: 'USD', env: 'sandbox' },
});
const ADM = (data) => ({ auth: { uid: 'op', token: { admin: true, email: 'operator@example.test' } }, data });
const U = (uid, data) => ({ auth: { uid, token: {} }, data });
const auth = (uid, total, quoteId, extra) => Object.assign({ PCD_PAY_RST: 'success', PCD_PAY_TYPE: 'card', PCD_AUTH_KEY: 'a', PCD_PAY_REQKEY: 'r', PCD_PAY_TOTAL: String(total), PCD_USER_DEFINE1: uid, PCD_USER_DEFINE2: quoteId, PCD_PAY_OID: 'oid-' + uid }, extra || {});
const keyOf = (link) => new URL(link).searchParams.get('k');

(async () => {
  const start = Date.parse('2026-10-25T00:00:00+09:00'), end = start + 90 * 86400000;
  // ── 운영: 등록 (기본 500명·90일, 공통 코드) ───────────────────────
  ok('non-admin-cannot-create', (await err(M.adminPartnerSave(U('x', { create: true, slug: 'sportsjobalio' })))) === 'permission-denied');
  const created = await M.adminPartnerSave(ADM({ create: true, slug: 'sportsjobalio', name: '스포츠잡알리오', logoUrl: 'https://sportsjobalio.com/img/renewal/logo_b.png', priceKrw: 13000, priceUsd: '9.66', fx: { rate: 1345.9, date: '2026-10-15', source: 'ECB' }, startAt: start, endAt: end, maxSeats: 500, verify: 'common' }));
  const K = keyOf(created.link), CODE = created.commonCode;
  ok('create-returns-link-and-common-code', /^https:\/\/lifeportfolio\.co\.kr\/partner\?p=sportsjobalio&k=[A-Za-z0-9_-]{22}$/.test(created.link) && /^[2-9A-Z]{5}-[2-9A-Z]{5}$/.test(CODE), created);
  const stored = (await db.collection('partners').doc('sportsjobalio').get()).data();
  ok('secrets-stored-only-as-hash', stored.linkKeyHash.length === 64 && !JSON.stringify(stored).includes(K) && !JSON.stringify(stored).includes(CODE.replace('-', '')) && stored.status === 'draft');
  ok('duplicate-slug-rejected', (await err(M.adminPartnerSave(ADM({ create: true, slug: 'sportsjobalio', name: 'x', priceKrw: 13000, priceUsd: '9.66', startAt: start, endAt: end, maxSeats: 5, verify: 'link' })))) === 'already-exists');
  ok('price-above-regular-rejected', (await err(M.adminPartnerSave(ADM({ slug: 'sportsjobalio', priceKrw: 25000 })))) === 'invalid-argument');
  ok('bad-slug-rejected', (await err(M.adminPartnerSave(ADM({ create: true, slug: '../x', name: 'x', priceKrw: 1000, priceUsd: '1.00', startAt: start, endAt: end, maxSeats: 1, verify: 'link' })))) === 'invalid-argument');

  // ── 로고 이미지 파일 (logoData) ────────────────────────────────
  const PNG = 'data:image/png;base64,' + Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]).toString('base64');
  const lg = await M.adminPartnerSave(ADM({ create: true, slug: 'hanbit-sports', name: '한빛스포츠클럽', logoData: PNG, priceKrw: 13000, priceUsd: '9.66', startAt: start, endAt: end, maxSeats: 10, verify: 'link' }));
  ok('logo-file-saved', (await db.collection('partners').doc('hanbit-sports').get()).get('logoData') === PNG && !!lg.link);
  ok('logo-file-not-image-rejected', (await err(M.adminPartnerSave(ADM({ slug: 'hanbit-sports', logoData: 'data:image/png;base64,' + Buffer.from('hello world!').toString('base64') })))) === 'invalid-argument');
  ok('logo-file-svg-rejected', (await err(M.adminPartnerSave(ADM({ slug: 'hanbit-sports', logoData: 'data:image/svg+xml;base64,PHN2Zz4=' })))) === 'invalid-argument');
  ok('logo-file-too-big-rejected', (await err(M.adminPartnerSave(ADM({ slug: 'hanbit-sports', logoData: 'data:image/png;base64,' + Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(M.LOGO_MAX_BYTES)]).toString('base64') })))) === 'invalid-argument');
  ok('logo-file-script-payload-rejected', (await err(M.adminPartnerSave(ADM({ slug: 'hanbit-sports', logoData: PNG + '"><script>' })))) === 'invalid-argument');
  await M.adminPartnerAction(ADM({ slug: 'hanbit-sports', action: 'setStatus', status: 'active' }));
  const lgPage = await M.getPartnerPage({ auth: null, data: { slug: 'hanbit-sports', k: keyOf(lg.link) } }, D());
  ok('logo-file-in-public-page', lgPage.state === 'open' && lgPage.partner.logoData === PNG);
  ok('logo-file-in-admin-list', (await M.adminPartnerList(ADM({}))).partners.some((p) => p.slug === 'hanbit-sports' && p.logoData === PNG));
  await M.adminPartnerSave(ADM({ slug: 'hanbit-sports', logoData: '' }));
  ok('logo-file-can-be-cleared', (await db.collection('partners').doc('hanbit-sports').get()).get('logoData') === '');
  await M.adminPartnerAction(ADM({ slug: 'hanbit-sports', action: 'setStatus', status: 'ended' }));

  // ── 시험용 제휴 (testMode): 시험 서버만, 회원 결제 상태·자리·판매 숫자 그대로 ───────
  const tm = await M.adminPartnerSave(ADM({ create: true, slug: 'test-hanbit', name: '한빛스포츠클럽 (시험)', testMode: true, priceKrw: 1000, priceUsd: '1.00', startAt: start, endAt: end, maxSeats: 3, verify: 'common' }));
  await M.adminPartnerAction(ADM({ slug: 'test-hanbit', action: 'setStatus', status: 'active' }));
  ok('testmode-fixed-after-create', (await M.adminPartnerSave(ADM({ slug: 'test-hanbit', testMode: false })), (await db.collection('partners').doc('test-hanbit').get()).get('testMode') === true));
  const tPage = await M.getPartnerPage({ auth: null, data: { slug: 'test-hanbit', k: keyOf(tm.link) } }, D());
  ok('testmode-flag-public', tPage.partner.test === true);
  await rtdb.ref('payments/tpaid').set({ paid: true });
  const tStart = (uid, method) => M.startPartnerCheckout(U(uid, { slug: 'test-hanbit', k: keyOf(tm.link), code: tm.commonCode, method }), D());
  const tq = await tStart('tpaid', 'payple');
  ok('testmode-allows-already-paid-member', tq.test === true && !!tq.quoteId);
  const pc0 = payple.calls; let seenTest = null;
  const Dt = () => Object.assign(D(), { paypleConfirm: async (o) => { seenTest = o.isTest; payple.calls++; return { PCD_PAY_RST: 'success', PCD_PAY_TOTAL: '1000', PCD_USER_DEFINE1: 'tpaid', PCD_PAY_OID: 'oid-t' }; } });
  const tr = await M.confirmPartnerPayple(U('tpaid', { quoteId: tq.quoteId, isTest: false, auth: auth('tpaid', 1000, tq.quoteId) }), Dt());
  ok('testmode-server-forces-test-endpoint', seenTest === true && payple.calls === pc0 + 1 && tr.test === true);
  const tpd = (await db.collection('partners').doc('test-hanbit').get()).data();
  ok('testmode-no-seat-or-sales-count', (tpd.seatCount.used || 0) === 0 && (tpd.seatCount.krw || 0) === 0 && (tpd.holds || []).length === 0);
  ok('testmode-member-payment-untouched', JSON.stringify((await rtdb.ref('payments/tpaid').get()).val()) === JSON.stringify({ paid: true }));
  ok('testmode-recorded-as-test', (await db.collection('partner_payments').doc('test-' + tq.quoteId).get()).get('test') === true && !(await db.collection('partner_payments').doc('tpaid').get()).exists);
  const tq2 = await tStart('tpaid', 'paypal'); let ppSandbox = null;
  const Dp = () => Object.assign(D(), { paypalCreate: async (o) => { ppSandbox = o.sandbox; paypal.created.push(o); return 'ORDER-' + paypal.created.length; } });
  const tord = (await M.createPartnerPaypalOrder(U('tpaid', { quoteId: tq2.quoteId }), Dp())).orderID;
  let capSandbox = null;
  const Dc = () => Object.assign(D(), { paypalCapture: async (o) => { capSandbox = o.sandbox; const c = paypal.created[Number(o.orderID.split('-')[1]) - 1]; return { status: 'COMPLETED', customId: c.customId, captureID: 'CAP-T', amount: c.amount, currency: 'USD', env: 'sandbox' }; } });
  const tcap = await M.capturePartnerPaypalOrder(U('tpaid', { quoteId: tq2.quoteId, orderID: tord }), Dc());
  ok('testmode-paypal-uses-sandbox', ppSandbox === true && capSandbox === true && tcap.test === true && tcap.captureID === 'CAP-T');
  ok('testmode-paypal-member-untouched', JSON.stringify((await rtdb.ref('payments/tpaid').get()).val()) === JSON.stringify({ paid: true }));
  const tl = await M.adminPartnerList(ADM({}));
  ok('testmode-shown-in-admin-list', tl.partners.some((p) => p.slug === 'test-hanbit' && p.test === true) && tl.payments.filter((x) => x.test && x.slug === 'test-hanbit').length === 2);
  await M.adminPartnerAction(ADM({ slug: 'test-hanbit', action: 'setStatus', status: 'ended' }));
  await rtdb.ref('payments/tpaid').remove();

  // ── 정상가 제휴 + 화면 색·문구 ─────────────────────────────────────
  const rg = await M.adminPartnerSave(ADM({ create: true, slug: 'reg-co', name: '정상가회사', priceMode: 'regular', priceKrw: 5000, priceUsd: '3.00', theme: 'navy', copy: { headline: '<b>우리 회원을 위한</b> 한 권', intro: '소개', emotion: '감성' }, startAt: start, endAt: end, maxSeats: 10, verify: 'link' }));
  const rgd = (await db.collection('partners').doc('reg-co').get()).data();
  ok('regular-mode-forces-regular-price', rgd.priceKrw === 19900 && rgd.priceUsd === '14.99' && rgd.priceMode === 'regular');
  ok('copy-sanitized', !/[<>]/.test(rgd.copy.headline) && rgd.theme === 'navy');
  ok('bad-theme-rejected', (await err(M.adminPartnerSave(ADM({ slug: 'reg-co', theme: 'red' })))) === 'invalid-argument');
  ok('bad-price-mode-rejected', (await err(M.adminPartnerSave(ADM({ slug: 'reg-co', priceMode: 'free' })))) === 'invalid-argument');
  await M.adminPartnerAction(ADM({ slug: 'reg-co', action: 'setStatus', status: 'active' }));
  const rgp = await M.getPartnerPage({ auth: null, data: { slug: 'reg-co', k: keyOf(rg.link) } }, D());
  ok('regular-public-view', rgp.partner.priceMode === 'regular' && rgp.partner.priceKrw === 19900 && rgp.partner.theme === 'navy' && rgp.partner.copy.emotion === '감성');
  await M.adminPartnerAction(ADM({ slug: 'reg-co', action: 'setStatus', status: 'ended' }));

  // ── 공개 페이지: 모방 링크 차단 ─────────────────────────────────
  const page = (slug, k, uid) => M.getPartnerPage(uid ? U(uid, { slug, k }) : { auth: null, data: { slug, k } }, D());
  ok('draft-is-notfound', (await page('sportsjobalio', K)).state === 'notfound');
  await M.adminPartnerAction(ADM({ slug: 'sportsjobalio', action: 'setStatus', status: 'active' }));
  NOW = Date.parse('2026-10-24T12:00:00+09:00');
  ok('before-start-notstarted', (await page('sportsjobalio', K)).state === 'notstarted');
  NOW = Date.parse('2026-10-26T10:00:00+09:00');
  const pg = await page('sportsjobalio', K);
  ok('real-link-opens', pg.state === 'open' && pg.partner.priceKrw === 13000 && pg.partner.seatsLeft === 500 && pg.partner.regularKrw === 19900 && !('linkKeyHash' in pg.partner) && !('commonCodeHash' in pg.partner));
  const nf = [await page('sportsjobalio', ''), await page('sportsjobalio', K.slice(0, -1) + (K.endsWith('A') ? 'B' : 'A')), await page('nosuch', K), await page('SportsJobAlio', K)];
  ok('fake-or-wrong-links-look-identical-notfound', nf.every((x) => x.state === 'notfound' && !x.partner), nf);

  // ── 확인 + 확인표 ───────────────────────────────────────────────
  const start1 = (uid, code, method, k) => M.startPartnerCheckout(U(uid, { slug: 'sportsjobalio', k: k || K, code, method: method || 'payple' }), D());
  ok('login-required', (await err(M.startPartnerCheckout({ auth: null, data: { slug: 'sportsjobalio', k: K, code: CODE } }, D()))) === 'unauthenticated');
  ok('wrong-link-key-cannot-checkout', (await err(start1('u1', CODE, 'payple', 'nope'))) === 'not-found');
  ok('missing-code-rejected', (await err(start1('u1', ''))) === 'invalid-argument');
  for (let i = 0; i < 5; i++) await err(start1('guesser', 'WRONG' + i));
  ok('code-guess-limit-5-per-hour', (await err(start1('guesser', CODE))) === 'resource-exhausted');
  NOW += 3600000; ok('guess-limit-resets-next-hour', !(await err(start1('guesser', CODE)))); NOW -= 3600000;
  const q1 = await start1('u1', CODE.toLowerCase().replace('-', ' '));
  ok('code-case-and-spacing-tolerant', q1.ok && q1.priceKrw === 13000 && q1.quoteId.length >= 20);

  // ── 페이플: 가격 위조·남의 확인표·성공 ───────────────────────────
  const confirm = (uid, quoteId, total, extra) => M.confirmPartnerPayple(U(uid, { quoteId, auth: auth(uid, total, quoteId, extra) }), D());
  const before = payple.calls;
  ok('tampered-amount-blocked-before-approval', (await err(confirm('u1', q1.quoteId, 100))) === 'failed-precondition' && payple.calls === before);
  ok('others-quote-blocked-before-approval', (await err(confirm('u2', q1.quoteId, 13000))) === 'permission-denied' && payple.calls === before);
  ok('uid-injection-mismatch-blocked', (await err(M.confirmPartnerPayple(U('u1', { quoteId: q1.quoteId, auth: auth('evil', 13000, q1.quoteId) }), D()))) === 'permission-denied' && payple.calls === before);
  payple.next = { PCD_PAY_RST: 'success', PCD_PAY_TOTAL: '19900', PCD_USER_DEFINE1: 'u1' };
  ok('server-side-amount-mismatch-not-recorded', (await err(confirm('u1', q1.quoteId, 13000))) === 'failed-precondition' && (await rtdb.ref('payments/u1/paid').once('value')).val() !== true);
  payple.next = { PCD_PAY_RST: 'error', PCD_PAY_CODE: 'X1', PCD_PAY_MSG: '한도 초과' };
  ok('payple-decline-logged-as-domestic-fail', (await err(confirm('u1', q1.quoteId, 13000))) === 'failed-precondition' && (await db.collection('partner_fails').where('resolved', '==', false).get()).size >= 1);
  payple.next = null;
  let liveSeen = null; const Dl = () => Object.assign(D(), { paypleConfirm: async (o) => { liveSeen = o.isTest; return { PCD_PAY_RST: 'success', PCD_PAY_TOTAL: '13000', PCD_USER_DEFINE1: 'u1', PCD_PAY_OID: 'oid-u1' }; } });
  const c1 = await M.confirmPartnerPayple(U('u1', { quoteId: q1.quoteId, isTest: true, auth: auth('u1', 13000, q1.quoteId) }), Dl());
  ok('real-partner-ignores-client-isTest', liveSeen === false && c1.test !== true);
  const pay1 = (await rtdb.ref('payments/u1').once('value')).val();
  ok('payple-success-unlocks-like-normal', c1.ok && pay1.paid === true && pay1.source === 'partner-payple' && pay1.amount === '13000' && pay1.currency === 'KRW', pay1);
  const rec1 = (await db.collection('partner_payments').doc('u1').get()).data();
  ok('partner-record-kept', rec1.slug === 'sportsjobalio' && rec1.amount === 13000 && rec1.provider === 'payple');
  ok('quote-single-use', (await err(confirm('u1', q1.quoteId, 13000))) === 'already-exists');
  ok('paid-account-cannot-start-again', (await err(start1('u1', CODE))) === 'already-exists');
  ok('rtdb-rules-allow-shape', Object.keys(pay1).every((k) => ['paid', 'createdAt', 'source', 'provider', 'env', 'orderID', 'captureID', 'amount', 'currency', '_pending'].includes(k)), Object.keys(pay1));

  // ── 만료·멈춤·가격 변경 ─────────────────────────────────────────
  const q2 = await start1('u2', CODE);
  NOW += 31 * 60000;
  ok('quote-expires-after-30-min', (await err(confirm('u2', q2.quoteId, 13000))) === 'deadline-exceeded');
  const q2b = await start1('u2', CODE);
  await M.adminPartnerAction(ADM({ slug: 'sportsjobalio', action: 'setStatus', status: 'paused' }));
  const b2 = payple.calls;
  ok('paused-blocks-approval-no-charge', (await err(confirm('u2', q2b.quoteId, 13000))) === 'failed-precondition' && payple.calls === b2);
  await M.adminPartnerAction(ADM({ slug: 'sportsjobalio', action: 'setStatus', status: 'active' }));
  await M.adminPartnerAction(ADM({ slug: 'sportsjobalio', action: 'rotateCommon' }));
  ok('old-common-code-stops-after-rotation', (await err(confirm('u2', q2b.quoteId, 13000))) === 'failed-precondition' && (await err(start1('u2', CODE))) === 'permission-denied');
  const rot = await M.adminPartnerAction(ADM({ slug: 'sportsjobalio', action: 'rotateCommon' }));
  const CODE2 = rot.commonCode;
  const regen = await M.adminPartnerAction(ADM({ slug: 'sportsjobalio', action: 'regenLink' }));
  const K2 = keyOf(regen.link);
  ok('old-link-stops-after-regen', (await page('sportsjobalio', K)).state === 'notfound' && (await page('sportsjobalio', K2)).state === 'open');

  // ── 페이팔 ─────────────────────────────────────────────────────
  const q3 = await start1('u3', CODE2, 'paypal', K2);
  ok('quote-method-locked', (await err(confirm('u3', q3.quoteId, 13000))) === 'failed-precondition');
  const o = await M.createPartnerPaypalOrder(U('u3', { quoteId: q3.quoteId }), D());
  ok('paypal-order-uses-server-price', paypal.created.slice(-1)[0].amount === '9.66' && paypal.created.slice(-1)[0].customId === 'u3');
  ok('paypal-other-order-rejected', (await err(M.capturePartnerPaypalOrder(U('u3', { quoteId: q3.quoteId, orderID: 'ORDER-999' }), D()))) === 'permission-denied');
  const cp = await M.capturePartnerPaypalOrder(U('u3', { quoteId: q3.quoteId, orderID: o.orderID }), D());
  const pay3 = (await rtdb.ref('payments/u3').once('value')).val();
  ok('paypal-success-unlocks', cp.ok && pay3.paid === true && pay3.source === 'partner-paypal' && pay3.amount === '9.66' && pay3.currency === 'USD' && pay3.captureID.startsWith('CAP-'));

  // ── 동시 결제 인원 초과 (최대 3명 제휴) ──────────────────────────
  const small = await M.adminPartnerSave(ADM({ create: true, slug: 'small-co', name: '작은 회사', priceKrw: 15000, priceUsd: '11.15', startAt: start, endAt: end, maxSeats: 3, verify: 'link' }));
  await M.adminPartnerAction(ADM({ slug: 'small-co', action: 'setStatus', status: 'active' }));
  const SK = keyOf(small.link);
  const many = await Promise.all(Array.from({ length: 10 }, (_, i) => M.startPartnerCheckout(U('c' + i, { slug: 'small-co', k: SK, method: 'payple' }), D()).then(() => 'ok', (e) => e.code)));
  ok('concurrent-10-for-3-seats-exactly-3', many.filter((x) => x === 'ok').length === 3 && many.filter((x) => x === 'resource-exhausted').length + many.filter((x) => x === 'aborted').length >= 7, many);
  ok('soldout-shown', (await page('small-co', SK)).state === 'soldout');
  NOW += 31 * 60000;
  ok('expired-holds-return-seats', (await page('small-co', SK)).partner.seatsLeft === 3);

  // ── 1인 1코드: 인원수만큼 정확히 발급 ─────────────────────────────
  const per = await M.adminPartnerSave(ADM({ create: true, slug: 'per-co', name: '1인 코드 회사', priceKrw: 12000, priceUsd: '8.92', startAt: start, endAt: end, maxSeats: 500, verify: 'personal' }));
  await M.adminPartnerAction(ADM({ slug: 'per-co', action: 'setStatus', status: 'active' }));
  const PK = keyOf(per.link);
  ok('personal-mode-has-no-common-code', per.commonCode === null);
  const issued = await M.adminPartnerAction(ADM({ slug: 'per-co', action: 'issueCodes', count: 500 }));
  ok('issue-exactly-500-unique-codes', issued.codes.length === 500 && new Set(issued.codes).size === 500 && issued.csv.split('\n').length === 501 && issued.codes.every((c) => /^[2-9A-HJKMNP-TV-Z]{5}-[2-9A-HJKMNP-TV-Z]{5}$/.test(c)));
  ok('codes-stored-only-as-hash', (await db.collection('partner_codes').where('slug', '==', 'per-co').get()).docs.every((d) => !JSON.stringify(d.data()).includes(issued.codes[0].replace('-', '')) && d.id.length === 64));
  ok('cannot-issue-beyond-max-seats', (await err(M.adminPartnerAction(ADM({ slug: 'per-co', action: 'issueCodes', count: 1 })))) === 'invalid-argument');
  const startP = (uid, code) => M.startPartnerCheckout(U(uid, { slug: 'per-co', k: PK, code, method: 'payple' }), D());
  const pq = await startP('p1', issued.codes[0]);
  ok('same-code-other-account-blocked-while-held', (await err(startP('p2', issued.codes[0]))) === 'permission-denied');
  await M.confirmPartnerPayple(U('p1', { quoteId: pq.quoteId, auth: auth('p1', 12000, pq.quoteId) }), D());
  ok('used-code-cannot-be-reused', (await err(startP('p3', issued.codes[0]))) === 'permission-denied');
  ok('random-code-rejected', (await err(startP('p4', 'ABCDE-FGHJK'))) === 'permission-denied');
  await M.adminPartnerAction(ADM({ slug: 'per-co', action: 'voidCode', code: issued.codes[1] }));
  ok('voided-code-rejected', (await err(startP('p5', issued.codes[1]))) === 'permission-denied');
  ok('cannot-void-used-code', (await err(M.adminPartnerAction(ADM({ slug: 'per-co', action: 'voidCode', code: issued.codes[0] })))) === 'failed-precondition');
  const vu = await M.adminPartnerAction(ADM({ slug: 'per-co', action: 'voidUnused' }));
  ok('void-all-unused-then-reissue', vu.count === 498 && (await M.adminPartnerAction(ADM({ slug: 'per-co', action: 'issueCodes', count: 498 }))).codes.length === 498);
  ok('code-space-math', M.CODE_ALPHABET.length === 30 && M.CODE_LEN === 10 && Math.pow(30, 10) > 5.9e14);

  // ── 공통 코드 자동 멈춤 (시간당 문턱) ────────────────────────────
  const vel = await M.adminPartnerSave(ADM({ create: true, slug: 'vel-co', name: '자동멈춤 회사', priceKrw: 13000, priceUsd: '9.66', startAt: start, endAt: end, maxSeats: 500, verify: 'common', velocityHour: 5, velocityDay: 60 }));
  await M.adminPartnerAction(ADM({ slug: 'vel-co', action: 'setStatus', status: 'active' }));
  const VK = keyOf(vel.link);
  const vr = []; for (let i = 0; i < 7; i++) vr.push(await M.startPartnerCheckout(U('v' + i, { slug: 'vel-co', k: VK, code: vel.commonCode, method: 'payple' }), D()).then(() => 'ok', (e) => e.code));
  const vdoc = (await db.collection('partners').doc('vel-co').get()).data();
  ok('auto-pause-at-hour-threshold', vr.slice(0, 5).every((x) => x === 'ok') && vr[5] === 'failed-precondition' && vdoc.status === 'paused' && vdoc.pausedReason === 'auto-velocity' && alerts.length === 1, { vr, st: vdoc.status });
  ok('auto-pause-audited', (await db.collection('partner_audit').where('action', '==', 'auto-pause').get()).size === 1);

  // ── 운영 목록·환불 기록 ─────────────────────────────────────────
  await M.adminPartnerAction(ADM({ slug: 'sportsjobalio', action: 'recordRefund', uid: 'u1', how: 'payple', memo: '고객 요청' }));
  const L = await M.adminPartnerList(ADM({}));
  const sj = L.partners.find((p) => p.slug === 'sportsjobalio');
  ok('admin-list-counts', sj.used === 2 && sj.sales.krw === 13000 && sj.sales.usd === 9.66 && L.codeStats['per-co'].used === 1 && L.payments.some((p) => p.uid === 'u1' && p.refund && p.refund.how === 'payple'));
  ok('admin-list-hides-secrets', !JSON.stringify(L).includes('Hash') && !JSON.stringify(L).includes(K2));
  ok('non-admin-list-denied', (await err(M.adminPartnerList(U('u1', {})))) === 'permission-denied');
  ok('cannot-shrink-below-paid', (await err(M.adminPartnerSave(ADM({ slug: 'sportsjobalio', maxSeats: 1 })))) === 'invalid-argument');
  ok('domestic-pause-blocks-payple-only', await (async () => { await M.adminPartnerSave(ADM({ slug: 'sportsjobalio', domesticPaused: true })); const a = await err(start1('u9', CODE2, 'payple', K2)); const b = await err(start1('u9', CODE2, 'paypal', K2)); await M.adminPartnerSave(ADM({ slug: 'sportsjobalio', domesticPaused: false })); return a === 'failed-precondition' && b === null; })());

  // ── 일반 결제 화면의 국내 결제 실패 기록 ──────────────────────────
  await M.reportDomesticFail(U('r1', { where: 'regular', stage: 'auth', code: 'X', msg: '<b>한도</b>' }));
  const rf = (await db.collection('partner_fails').where('provider', '==', 'payple-regular').get()).docs[0].data();
  ok('regular-fail-logged-sanitized', rf.msg === ' b 한도 /b '.trim() || !/[<>]/.test(rf.msg));

  // ── 통계·동의 ──────────────────────────────────────────────────
  const SD = { now: () => NOW, rateLimit: async () => {}, shallowCount: async (p) => ({ reports: 2, diary: 1, responses: 2 }[p]), listUserTimes: async () => [NOW - 3600000, NOW - 86400000 * 2, NOW - 86400000 * 400] };
  await S.recordConsent({ auth: null, data: { choice: 'granted' } }, SD);
  await S.recordConsent({ auth: null, data: { choice: 'denied' } }, SD);
  await S.recordConsent(U('m1', { choice: 'granted' }), SD);
  ok('consent-bad-input-rejected', (await err(S.recordConsent({ auth: null, data: { choice: 'x' } }, SD))) === 'invalid-argument');
  const mine = await S.getMine(U('m1', {}), SD);
  ok('member-choice-restored-on-other-device', mine.choice === 'granted');
  const oldNow = NOW; NOW += S.YEAR_MS + 86400000;
  ok('choice-expires-after-1-year', (await S.getMine(U('m1', {}), SD)).choice === null); NOW = oldNow;
  ok('anonymous-choice-not-stored-per-person', (await db.collection('consent_choices').get()).size === 1);
  const st = await S.adminStats(ADM({ days: 30 }), SD);
  ok('stats-consent-counts-only', st.consent.granted === 2 && st.consent.denied === 1 && st.consent.rate === 66.7 && !JSON.stringify(st).includes('m1'));
  ok('stats-funnel', st.totals.members === 3 && st.totals.paid >= 3 && st.totals.paidPartner >= 3 && st.funnel.length === 5 && st.funnel[3].n === 2);
  ok('stats-admin-only', (await err(S.adminStats(U('m1', {}), SD))) === 'permission-denied');

  const f = results.filter((x) => !x.c);
  console.log(JSON.stringify({ passed: results.length - f.length, failed: f.length, scope: 'real handlers + local Firestore/RTDB emulators; Payple/PayPal/mail/rate-limit are fakes' }));
  process.exit(f.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
