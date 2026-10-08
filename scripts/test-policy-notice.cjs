'use strict';
// 약관·처리방침 개정 고지: 단일 출처 일치 + 발송 로직(운영자 전용·멱등·실패 재발송·기록) — Firestore/Auth 에뮬레이터, 가짜 메일 발송기.
// 실행: firebase emulators:exec --only auth,firestore "node scripts/test-policy-notice.cjs"
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict'), { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const C = require('../functions/emails/policy-update-2026-10-17.js');
const results = []; const ok = (n, c, d) => { results.push({ n, c: !!c }); console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' ' + JSON.stringify(d || '').slice(0, 300))); };

// ---- 1) offline: one source for dates and wording -----------------------------------------
const pop = fs.readFileSync(path.join(root, 'assets/js/policy-update-popup.js'), 'utf8');
ok('popup-dates-match-campaign', pop.includes('Date.parse("' + C.NOTICE_START_KST + '")') && pop.includes('Date.parse("' + C.POPUP_END_KST + '")'));
const ms = (s) => Date.parse(s);
ok('notice-7-days-before-effective', ms(C.EFFECTIVE_KST) - ms(C.NOTICE_START_KST) === 7 * 864e5);
ok('popup-shown-7-days', Math.round((ms(C.POPUP_END_KST) + 1000 - ms(C.NOTICE_START_KST)) / 864e5) === 7);
const ko = JSON.parse(fs.readFileSync(path.join(root, 'assets/i18n/ko.json'), 'utf8')), en = JSON.parse(fs.readFileSync(path.join(root, 'assets/i18n/en.json'), 'utf8'));
const terms = fs.readFileSync(path.join(root, 'terms.html'), 'utf8'), privacy = fs.readFileSync(path.join(root, 'privacy.html'), 'utf8');
const mail = C.buildPolicyUpdateEmail();
const strip = (s) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const after = (no) => C.CHANGES.find((c) => c.no.startsWith(no)).after;
ok('terms-art8-matches-notice', strip(after('제8조')) === strip(['art8_1', 'art8_2', 'art8_3', 'art8_4'].map((k, i) => '①②③④'[i] + ' ' + ko.terms[k]).join(' ')));
ok('terms-art2-6-matches-notice', after('제2조') === ko.terms.art2_6);
ok('privacy-s1-matches-notice', after('1.') === ko.privacy.s1_p);
ok('html-default-equals-ko-json', ['art2_6', 'art3_4', 'art3_5', 'art8_1', 'art8_2', 'art8_3', 'art8_4', 'effective', 'appendix_p', 'appendix_history'].every((k) => terms.includes('>' + ko.terms[k] + '<')) && ['s1_p', 's2_2', 's3_6', 's5_7', 's6_5', 's7_2', 's7_5', 's13_2', 's16_h', 's16_1', 's16_2', 's16_3', 's16_4', 's16_5', 'effective'].every((k) => privacy.includes('>' + ko.privacy[k] + '<')));
ok('en-new-privacy-keys', ['s5_7', 's6_5'].every((k) => en.privacy[k]));
// 법률 고문 권고(5739187·5739220)를 문장 그대로 반영했는지
ok('legal-art8-4-narrowed', ko.terms.art8_4.includes('회원의 기록과 분리하여(빈 양식 형태 등으로)') && ko.terms.art8_4.includes('본인의 기록을 소개하면서 양식의 일부가 함께 보이는 것은 이 제한에 해당하지 않습니다.'));
ok('legal-art8-1-member-info', ko.terms.art8_1.includes('회원의 응답·이름 등 회원 본인의 정보는 회원의 것입니다.'));
ok('legal-art8-2-backup', ko.terms.art8_2.includes('백업·보안 조치'));
ok('legal-s16-3-exceptions', ko.privacy.s16_3.includes('회원이 요청한 문의 처리, 장애·보안 대응, 법령에 따른 요청') && ko.privacy.s16_3.includes('회원이 따로 켜는 경우에만'));
ok('legal-rtdb-in-5-and-6', ko.privacy.s5_7.includes('Firebase Realtime Database') && ko.privacy.s6_5.includes('싱가포르') && ko.privacy.s16_2.includes('5항·6항'));
ok('legal-objection-terms-only', mail.text.includes('개정 이용약관에 동의하신 것으로 봅니다. 개인정보처리방침은 동의 대상이 아닌 안내 사항입니다.') && mail.text.includes('시행일(' + C.EFFECTIVE_KO + ')까지') && pop.includes('개정 약관에 동의하신 것으로 봅니다') && pop.includes(C.EFFECTIVE_KO + ' 전까지'));
ok('legal-no-promotion-in-mail', !/써 보세요|시작하기|지금 바로|무료로|try it|get started/i.test(mail.text) && (mail.html.match(/<a /g) || []).length === 8 && [...mail.html.matchAll(/<a href="([^"]+)"/g)].every((m) => /^(mailto:faise@|https:\/\/lifeportfolio\.co\.kr\/(terms|privacy)(-2026-0[56]-1[49])?(\?lang=en)?$)/.test(m[1])));
ok('legal-summary-discloses-limit', C.SUMMARY_KO.some((s) => s.includes('양식만 따로 떼어 배포하는 것은 제한')) && pop.includes('양식만 따로 떼어 배포하는 것은 제한'));
ok('review-record-exists', fs.readFileSync(path.join(root, 'docs/legal/2026-10-08_약관방침_개정_검토기록.md'), 'utf8').includes('변호사 검토 아님'));
ok('en-has-every-new-key', ['art2_6', 'art8_3', 'art8_4'].every((k) => en.terms[k]) && ['s16_h', 's16_1', 's16_2', 's16_3', 's16_4', 's16_5'].every((k) => en.privacy[k]));
ok('effective-dates-terms-17-privacy-10', ko.terms.effective.includes('2026년 10월 17일') && ko.privacy.effective.startsWith('본 방침은 <b>2026년 10월 10일</b>부터') && C.EFFECTIVE_KO === '2026년 10월 17일' && C.PRIVACY_EFFECTIVE_KO === '2026년 10월 10일' && C.NOTICE_START_KST.startsWith('2026-10-10') && C.CAMPAIGN === 'policy-update-2026-10-17' && en.terms.effective.includes('October 17, 2026') && en.privacy.effective.includes('October 10, 2026'));
ok('no-stale-dates', ![fs.readFileSync(path.join(root, 'assets/js/policy-update-popup.js'), 'utf8'), JSON.stringify(ko.terms), JSON.stringify(ko.privacy.effective), JSON.stringify(en.terms), JSON.stringify(en.privacy.effective), mail.text].some((t) => /10월 16일 시행|10월 9일|2026-10-16 시행|2026-10-09|October 16, 2026|October 9, 2026/.test(t)));
ok('archive-banners-shifted', fs.readFileSync(path.join(root, 'terms-2026-05-14.html'), 'utf8').includes('~ 2026년 10월 16일') && fs.readFileSync(path.join(root, 'privacy-2026-06-19.html'), 'utf8').includes('~ 2026년 10월 9일'));
ok('terms-art3-deemed-consent-clause', ko.terms.art3_4.includes('명확하게 알렸음에도') && ko.terms.art3_5.includes('적용할 수 없으며') && en.terms.art3_4 && en.terms.art3_5 && terms.includes('>' + ko.terms.art3_4 + '<') && terms.includes('>' + ko.terms.art3_5 + '<') && after('제3조').includes(ko.terms.art3_4));
ok('email-benchmark-structure', ['개정 사유', '한눈에 보기', '1. 변경사항', '2. 시행일자', '3. 이의제기 및 문의', 'What has changed', 'Effective date', 'Objections &amp; inquiries', 'line-through'].every((x) => mail.html.includes(x)) && C.CHANGES.every((c) => c.en && c.en.after && mail.text.includes(c.en.after)));
ok('previous-versions-kept-and-linked', fs.existsSync(path.join(root, 'terms-2026-05-14.html')) && fs.existsSync(path.join(root, 'privacy-2026-06-19.html')) && ko.terms.appendix_p.includes('/terms-2026-05-14') && ko.privacy.effective.includes('/privacy-2026-06-19'));
const oldT = fs.readFileSync(path.join(root, 'terms-2026-05-14.html'), 'utf8');
ok('previous-terms-frozen', !/data-i18n/.test(oldT) && !/assets\/i18n\/i18n\.js/.test(oldT) && oldT.includes('리포트 및 제공 자료의 저작권은 회사에 귀속됩니다.') && /noindex/.test(oldT));
ok('email-has-legal-parts', ['변경 전', '변경 후', '시행일', '이의제기', '광고성 정보가 아닙니다', '656-12-02589'].every((s) => mail.html.includes(s) && mail.text.includes(s.replace(/ · /g, ' · '))));
ok('email-every-change-row', C.CHANGES.every((c) => mail.text.includes(c.after)));
for (const f of ['index.html', 'login.html', 'mypage.html']) ok('popup-loaded-on-' + f, fs.readFileSync(path.join(root, f), 'utf8').includes('/assets/js/policy-update-popup.js'));
const adminHtml = fs.readFileSync(path.join(root, 'admin.html'), 'utf8');
ok('dashboard-hub-card-links-panel', adminHtml.includes('href="#policyNoticeCard" id="pnHubCard"') && fs.readFileSync(path.join(root, 'checkin-admin.html'), 'utf8').includes('/admin#policyNoticeCard'));
ok('dashboard-has-notice-panel', ['policyNoticeCard', 'getPolicyNoticeStatus', 'sendPolicyNotice', 'pnTestBtn', 'pnDryBtn', 'pnSendBtn', 'pnRetryBtn', 'sandbox=""'].every((s) => adminHtml.includes(s)));

// ---- 2) emulator: sending logic --------------------------------------------------------------
(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) { console.log('SKIP emulator part (no FIRESTORE_EMULATOR_HOST/FIREBASE_AUTH_EMULATOR_HOST)'); return finish(); }
  for (const k of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST']) assert.match(process.env[k], /^127\.0\.0\.1:\d+$/);
  const deps = createRequire(path.join(root, 'functions', 'package.json'));
  const admin = deps('firebase-admin'); admin.initializeApp({ projectId: 'demo-lp-b2b-stability' });
  const M = require('../functions/_policy_notice_module.js');
  const users = [];
  for (let i = 0; i < 6; i++) users.push(await admin.auth().createUser({ email: `member${i}@example.test` }));
  await admin.auth().createUser({ phoneNumber: '+821000000001' }); // 이메일 없는 계정 — 제외
  const off = await admin.auth().createUser({ email: 'disabled@example.test', disabled: true }); // 비활성 — 제외
  const sentTo = []; let failOnce = new Set(['member2@example.test']);
  const real = { listRecipients: undefined };
  const deps2 = {
    listRecipients: async () => { const out = []; let t; do { const r = await admin.auth().listUsers(1000, t); r.users.forEach((u) => { const e = (u.email || '').toLowerCase(); if (e && !u.disabled) out.push({ uid: u.uid, email: e }); }); t = r.pageToken; } while (t); return out; },
    logMap: async (c) => { const s = await admin.firestore().collection('policy_notice_log').where('campaign', '==', c).get(); const m = new Map(); s.forEach((d) => m.set(d.get('uid'), d.data())); return m; },
    sendMail: async ({ to, subject }) => { if (failOnce.has(to)) { failOnce.delete(to); const e = new Error('Resend 422: synthetic'); e.status = 422; throw e; } sentTo.push({ to, subject }); },
    sleep: async () => {}, apiKey: () => 'synthetic',
  };
  const adminReq = (data) => ({ auth: { uid: 'op1', token: { admin: true, email: 'operator@example.test' } }, data });
  const userReq = (data) => ({ auth: { uid: 'u1', token: { email: 'member0@example.test' } }, data });
  const err = async (p) => { try { await p; return null; } catch (e) { return e.code || e.message; } };

  // 단체 검사 참여자(b2b_codes 사용분)도 대상 — 실제 모듈의 listRecipients 로 확인(대표 지시 2026-10-09)
  {
    const fs2 = admin.firestore();
    const g1 = await admin.auth().createUser({ phoneNumber: '+821000000002' }); // Auth 이메일 없음, 코드에만 이메일
    await fs2.collection('b2b_codes').doc('t_00001').set({ status: 'used', usedByUid: g1.uid, usedByEmail: 'Group.Only@Example.test' });
    await fs2.collection('b2b_codes').doc('t_00002').set({ status: 'used', usedByUid: users[1].uid, usedByEmail: 'member1@example.test' }); // 회원과 중복
    await fs2.collection('b2b_codes').doc('t_00003').set({ status: 'used', usedByUid: off.uid, usedByEmail: 'disabled@example.test' }); // 비활성
    await fs2.collection('b2b_codes').doc('t_00004').set({ status: 'unused', usedByUid: null, usedByEmail: null });
    const real = M._listRecipients;
    const list = await real();
    ok('group-participant-included', list.some((r) => r.uid === g1.uid && r.email === 'group.only@example.test' && r.source === 'group'));
    ok('group-duplicate-sent-once', list.filter((r) => r.email === 'member1@example.test').length === 1);
    ok('group-disabled-excluded', !list.some((r) => r.email === 'disabled@example.test'));
    ok('recent-signup-included-on-next-read', await (async () => { const n = await admin.auth().createUser({ email: 'newbie@example.test' }); return (await real()).some((r) => r.uid === n.uid); })());
    // 이후 발송 시험은 실제 대상 목록 그대로 사용
    deps2.listRecipients = real;
    await fs2.collection('b2b_codes').doc('t_00001').delete(); await fs2.collection('b2b_codes').doc('t_00002').delete(); await fs2.collection('b2b_codes').doc('t_00003').delete(); await fs2.collection('b2b_codes').doc('t_00004').delete();
    await admin.auth().deleteUser(g1.uid); const nb = await admin.auth().getUserByEmail('newbie@example.test'); await admin.auth().deleteUser(nb.uid);
  }
  ok('dashboard-hides-total-count', !/발송 대상 회원<|\(전체 " \+ r\.counts\.recipients/.test(adminHtml));
  ok('non-admin-status-denied', (await err(M.status(userReq({}), deps2))) === 'permission-denied');
  ok('non-admin-send-denied', (await err(M.send(userReq({ mode: 'send' }), deps2))) === 'permission-denied');
  ok('anonymous-denied', (await err(M.send({ auth: null, data: { mode: 'send' } }, deps2))) === 'permission-denied');
  ok('unknown-campaign-rejected', (await err(M.send(adminReq({ mode: 'dryRun', campaign: 'x' }), deps2))) === 'invalid-argument');
  const dry = await M.send(adminReq({ mode: 'dryRun' }), deps2);
  ok('dryrun-counts-only-real-members', dry.counts.recipients === 6 && dry.counts.willSend === 6 && sentTo.length === 0 && dry.samples.every((s) => s.includes('***@')), dry);
  const test = await M.send(adminReq({ mode: 'test' }), deps2);
  ok('test-goes-only-to-operator', test.ok && sentTo.length === 1 && sentTo[0].to === 'operator@example.test' && sentTo[0].subject.startsWith('[시험 발송]'));
  sentTo.length = 0;
  const s1 = await M.send(adminReq({ mode: 'send', maxSend: 4 }), deps2);
  ok('send-respects-batch-and-reports-remaining', s1.attempted === 4 && s1.sent === 3 && s1.failed === 1 && s1.remaining === 2, s1);
  const s2 = await M.send(adminReq({ mode: 'send' }), deps2);
  ok('second-click-continues-without-duplicates', s2.sent === 2 && s2.failed === 0 && s2.remaining === 0 && new Set(sentTo.map((x) => x.to)).size === sentTo.length && sentTo.length === 5, { s2, n: sentTo.length });
  const st1 = await M.status(adminReq({}), deps2);
  ok('status-shows-failure', st1.counts.recipients === 6 && st1.counts.sent === 5 && st1.counts.failed === 1 && st1.counts.pending === 0 && st1.failures[0].email.includes('***@'), st1.counts);
  const r = await M.send(adminReq({ mode: 'retryFailed' }), deps2);
  ok('retry-sends-only-failed', r.sent === 1 && sentTo.length === 6 && sentTo[5].to === 'member2@example.test', r);
  const s3 = await M.send(adminReq({ mode: 'send' }), deps2);
  ok('nothing-left-no-resend', s3.attempted === 0 && sentTo.length === 6);
  const st2 = await M.status(adminReq({}), deps2);
  ok('runs-recorded-with-operator', st2.counts.sent === 6 && st2.counts.pending === 0 && st2.runs.length === 5 && st2.runs.every((x) => x.by === 'operator@example.test'), st2.runs);
  ok('disabled-and-phone-excluded', !sentTo.some((x) => x.to === 'disabled@example.test') && off.disabled);
  ok('preview-is-the-real-mail', st2.preview.subject === C.buildPolicyUpdateEmail().subject && st2.preview.html === C.buildPolicyUpdateEmail().html);
  finish();
})().catch((e) => { console.error(e); process.exit(1); });
function finish() { const f = results.filter((x) => !x.c); console.log(JSON.stringify({ passed: results.length - f.length, failed: f.length, scope: 'offline source checks + local Auth/Firestore emulators, synthetic accounts, fake mail sender' })); process.exit(f.length ? 1 : 0); }
