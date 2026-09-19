'use strict';
// Actual baseline/candidate handlers + local Firestore/RTDB. Callable transport,
// rate limiting and Resend are stubbed; this is NOT production E2E or inbox proof.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createRequire} = require('node:module');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const outputDir = path.join(root, 'dist/b2b-audit');
fs.mkdirSync(outputDir, {recursive:true});
const deps = createRequire(path.resolve(process.env.LP_FUNCTIONS_DEPS || path.join(root, 'functions'), 'package.json'));
const admin = deps('firebase-admin');
const project = 'demo-lp-b2b-stability';
for (const key of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_DATABASE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST']) {
  assert.match(process.env[key] || '', /^127\.0\.0\.1:\d+$/, 'Refuse non-local emulator: ' + key);
}
admin.initializeApp({projectId: project, databaseURL: `https://${project}-default-rtdb.firebaseio.com`});
const db = admin.firestore();
let flags = {}, sent = [], requests = [], batchNumber = 0;
const firestore = () => new Proxy(db, {get(target, key) {
  if (key === 'runTransaction') return (callback, options) => db.runTransaction(async tx => {
    let codeCreates = 0, codeRevokes = 0;
    const wrapped = new Proxy(tx, {get(target, name) {
      if (name === 'update') return (ref, value) => {if (ref.path.startsWith('b2b_codes/') && value.status === 'revoked') codeRevokes++; return tx.update(ref, value);};
      if (name === 'create') return (ref, value) => {if (ref.path.startsWith('b2b_codes/')) codeCreates++; return tx.create(ref, value);};
      const value = target[name]; return typeof value === 'function' ? value.bind(target) : value;
    }});
    const value = await callback(wrapped);
    if (codeRevokes && flags.failRevoke) {flags.failRevoke=false; throw Error('synthetic-revoke-failure');}
    if (codeCreates) {batchNumber++; if (flags.failBatchAt === batchNumber) throw Error('synthetic-batch-failure');}
    return value;
  }, options);
  if (key === 'batch') return () => {
    const batch = db.batch(), commit = batch.commit.bind(batch);
    batch.commit = async () => {batchNumber++; if (flags.failBatchAt === batchNumber) throw Error('synthetic-batch-failure'); return commit();};
    return batch;
  };
  const val = target[key]; return typeof val === 'function' ? val.bind(target) : val;
}});
firestore.FieldValue = admin.firestore.FieldValue;
firestore.Timestamp = admin.firestore.Timestamp;
const database = () => ({ref: name => {
  const ref = admin.database().ref(name), set = ref.set.bind(ref);
  ref.set = async value => {if (flags.failRtdb) throw Error('synthetic-rtdb-failure'); return set(value);};
  return ref;
}});
database.ServerValue = admin.database.ServerValue;
class HttpsError extends Error {constructor(code, message) {super(message); this.code = code;}}
const moduleStub = {exports: {}};
vm.runInNewContext(fs.readFileSync(path.join(root, 'functions/_b2b_group_module.js'), 'utf8'), {
  module: moduleStub, exports: moduleStub.exports, Buffer, console, setTimeout, clearTimeout,
  AbortSignal, URL, URLSearchParams, process: {env: {FUNCTIONS_EMULATOR: 'true'}},
  require(name) {
    if (name === 'firebase-functions/v2/https') return {onCall: (_options, handler) => handler, HttpsError};
    if (name === 'firebase-functions/params') return {defineSecret: () => ({value: () => flags.missingKey ? '' : 'synthetic-test-key'})};
    if (name === 'firebase-functions/logger') return {info() {}, warn() {}, error() {}};
    if (name === 'firebase-admin') return {firestore, database, auth: () => admin.auth()};
    if (name === './_rate_limit') return {checkCallableRateLimit: async () => {}};
    return deps(name);
  },
  fetch: async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails');
    const body = JSON.parse(options.body);
    sent.push(body); requests.push({headers: options.headers, signal: !!options.signal, redirect: options.redirect});
    if (flags.timeoutMail) throw Object.assign(Error('synthetic-timeout'), {name:'TimeoutError'});
    const failed = flags.failMail || (flags.failCustomer && body.to[0] !== 'faise@lifeportfolio.co.kr');
    return {ok: !failed, status: failed ? (flags.httpStatus || 503) : 200, text: async () => 'synthetic mail failure', json: async () => flags.noMessageId ? {} : ({id: 'synthetic-mail-id'})};
  }
}, {filename: '_b2b_group_module.js'});
const api = moduleStub.exports;
const actor = uid => ({uid, token: {email: uid + '@example.invalid'}});
const operator = {uid: 'b2b-test-admin', token: {admin: true, email: 'operator@example.invalid'}};
const request = (data, auth) => ({data, auth, rawRequest: {headers: {}, ip: '127.0.0.1'}});
const findings = [];
async function reset() {
  for (const collection of ['b2b_orders', 'b2b_codes', 'b2b_user_links', 'b2b_issuance_jobs']) await db.recursiveDelete(db.collection(collection));
  await admin.database().ref().remove(); flags = {}; sent = []; requests = []; batchNumber = 0;
}
async function seedOrder(id = 'test-order', seats = 10) {
  await db.collection('b2b_orders').doc(id).set({orderNumber: 'LP-TEST-0001', orgName: 'Synthetic Group', orgType: 'group', seats, diaryCount: 2, unitPrice: 18000, totalAmount: seats * 19800, contactName: 'Test Operator', contactEmail: 'group@example.invalid', status: 'payment_reported', codesIssued: 0, codesUsed: 0});
  return id;
}
async function seedCode(id = 'code-a', code = 'ABCD-EFGH', orderId = 'test-order') {
  await db.collection('b2b_codes').doc(id).set({code, orgCode: 'TEST-ORG', orderId, orgName: 'Synthetic Group', hasDiary: false, status: 'unused', usedByUid: null});
}
function result(name, ok, observed) {findings.push({name, passed: !!ok, observed}); console.log((ok ? 'PASS ' : 'FAIL ') + name + ': ' + JSON.stringify(observed));}
async function main() {
  await require(path.join(root, 'scripts/b2b-closure-cases.cjs'))({api, request, operator, actor, db, admin, reset, seedOrder, seedCode, result, flags:()=>flags, sent:()=>sent});
  const owner = actor('checkout-owner');
  const verified = {uid:'guest-owner',token:{email:'group@example.invalid',email_verified:true}};
  for (const [name,auth,contactUid,allowed] of [
    ['anonymous',null,'checkout-owner',false],
    ['wrong-uid',actor('stranger'),'checkout-owner',false],
    ['unverified-guest',{uid:'guest-owner',token:{email:'group@example.invalid',email_verified:false}},null,false],
    ['wrong-verified-email',{uid:'stranger',token:{email:'other@example.invalid',email_verified:true}},null,false],
    ['verified-email-cannot-take-linked-order',verified,'checkout-owner',false],
    ['linked-owner',owner,'checkout-owner',true],
    ['verified-legacy-guest',verified,null,true]
  ]) {
    await reset();await seedOrder();await db.collection('b2b_orders').doc('test-order').update({status:'quote_requested',contactUid});
    const view=await api.getB2BCheckoutOrder(request({orderId:'test-order'},auth)).catch(e=>({error:e.code}));
    const report=await api.reportB2BPayment(request({orderId:'test-order',depositorName:'Synthetic Payer'},auth)).catch(e=>({error:e.code}));
    const saved=(await db.collection('b2b_orders').doc('test-order').get()).data();
    result('checkout-owner-boundary-'+name,allowed?(view.ok&&report.ok&&saved.status==='payment_reported'&&saved.contactUid===auth.uid):(!view.ok&&!report.ok&&saved.status==='quote_requested'&&sent.length===0),{view:!!view.ok,reported:!!report.ok,status:saved.status});
    if(allowed)result('checkout-safe-fields-'+name,!('contactEmail' in view.order)&&!('issuancePlan' in view.order)&&view.order.totalAmount===198000,{keys:Object.keys(view.order)});
  }
  await reset();await seedOrder();await db.collection('b2b_orders').doc('test-order').update({status:'quote_requested',contactUid:owner.uid});
  const reports=await Promise.all([1,2,3].map(()=>api.reportB2BPayment(request({orderId:'test-order',depositorName:'Synthetic Payer'},owner))));
  result('concurrent-payment-reports-notify-once',reports.every(r=>r.ok)&&sent.length===1&&reports.filter(r=>r.alreadyReported).length===2,{notifications:sent.length});
  result('admin-payment-mail-links-use-current-hub',sent[0].html.includes('href="https://lifeporfolio-admin.web.app/admin"')&&sent[0].text.includes('https://lifeporfolio-admin.web.app/admin')&&!sent[0].html.includes('/b2b-admin'),{htmlAndText:true});
  for(const status of ['cancelled','refunded']){
    await reset();await seedOrder();await db.collection('b2b_orders').doc('test-order').update({status,contactUid:owner.uid});
    const r=await api.reportB2BPayment(request({orderId:'test-order',depositorName:'Synthetic Payer'},owner)).catch(e=>({error:e.code}));
    result('payment-report-cannot-reopen-'+status,r.error==='failed-precondition'&&sent.length===0&&(await db.collection('b2b_orders').doc('test-order').get()).data().status===status,r);
  }
  await reset();await seedOrder();await db.collection('b2b_orders').doc('test-order').update({status:'quote_requested',contactUid:owner.uid});flags.timeoutMail=true;
  const uncertainPayment=await api.reportB2BPayment(request({orderId:'test-order',depositorName:'Synthetic Payer'},owner));
  const retryPayment=await api.reportB2BPayment(request({orderId:'test-order',depositorName:'Synthetic Payer'},owner));
  result('payment-notice-unknown-retry-does-not-resend',uncertainPayment.ok&&retryPayment.ok&&retryPayment.alreadyReported&&sent.length===1&&retryPayment.emailStatus==='unknown',{status:retryPayment.emailStatus,notifications:sent.length});
  await reset();
  const quote = await api.submitB2BQuote(request({orgType:'group', orgName:'Synthetic Group', contactName:'Test Contact', contactEmail:'test-quote@example.invalid', seats:10, diaryCount:0, agreedContract:true, agreedPrivacy:true}));
  const lookedUp = await api.lookupB2BOrder(request({orderNumber:quote.orderNumber,contactEmail:'test-quote@example.invalid'}));
  const numberRule = /^LP-\d{6}-(?:\d{4}|[A-F0-9]{12})$/;
  const uiSource = fs.readFileSync(path.join(root,'b2b.html'),'utf8');
  result('generated-order-number-works-through-lookup',lookedUp.orderNumber===quote.orderNumber && numberRule.test(quote.orderNumber) && uiSource.includes(numberRule.toString()),{numberFormat:'new-12hex',lookup:true});
  for (const invalid of ['LP-202609-ABC','LP-202609-ABCDE12345678','LP-202609-G12345678901']) {
    const answer=await api.lookupB2BOrder(request({orderNumber:invalid,contactEmail:'test-quote@example.invalid'})).catch(e=>({error:e.code}));
    result('invalid-order-number-rejected-'+invalid,answer.error==='invalid-argument',answer);
  }
  await db.collection('b2b_orders').doc('legacy-lookup').set({orderNumber:'LP-202609-1234',contactEmail:'legacy@example.invalid',status:'quote_requested'});
  const legacyLookup=await api.lookupB2BOrder(request({orderNumber:'LP-202609-1234',contactEmail:'legacy@example.invalid'}));
  result('legacy-four-digit-number-still-works',legacyLookup.orderNumber==='LP-202609-1234',{legacy:true});
  result('quote-calculation-and-two-mail-attempts', quote.ok && quote.price.totalAmount === 198000 && sent.length === 2, {total: quote.price.totalAmount, mailAttempts: sent.length});
  const quoteMail = sent.find(m => m.to[0] === 'test-quote@example.invalid');
  result('quote-mail-states-stage-scope-and-privacy', quoteMail.html.includes('아직 입금 확인') && quoteMail.text.includes('핵심 56문항') && quoteMail.text.includes('포함되지 않습니다') && quoteMail.html.includes('https://lifeportfolio.co.kr/b2b-checkout'), {subject:quoteMail.subject});
  fs.writeFileSync(path.join(outputDir,'quote-mail-preview.html'),quoteMail.html);
  fs.writeFileSync(path.join(outputDir,'quote-mail-preview.txt'),quoteMail.text);
  const quoteReceipt = (await db.collection('b2b_orders').doc(quote.orderId).get()).data();
  result('provider-acceptance-receipt-not-inbox', quote.emailStatus.customer === 'provider_accepted' && quoteReceipt.userEmailMessageId === 'synthetic-mail-id' && quoteReceipt.emailDeliveryNote === 'provider_accepted_is_not_inbox_delivery' && requests.every(r => r.headers['Idempotency-Key'] && r.signal && r.redirect === 'error'), {status:quote.emailStatus.customer});
  result('admin-quote-mail-links-use-current-hub',sent[0].html.includes('href="https://lifeporfolio-admin.web.app/admin"')&&sent[0].text.includes('https://lifeporfolio-admin.web.app/admin')&&!sent[0].html.includes('/b2b-admin'),{htmlAndText:true});
  fs.writeFileSync(path.join(outputDir,'admin-quote-mail-preview.html'),sent[0].html);
  for (const [name, configuration, expected] of [
    ['provider-rejection', {failCustomer:true,httpStatus:422}, 'not_accepted'],
    ['provider-server-error', {failCustomer:true}, 'unknown'],
    ['provider-timeout', {timeoutMail:true}, 'unknown'],
    ['missing-key', {missingKey:true}, 'not_accepted'],
    ['missing-message-id', {noMessageId:true}, 'unknown'],
  ]) {
    await reset(); Object.assign(flags, configuration);
    const response = await api.submitB2BQuote(request({orgType:'group',orgName:'Mail Failure Test',contactName:'Test',contactEmail:'failure@example.invalid',seats:10,diaryCount:0,agreedContract:true,agreedPrivacy:true}));
    const saved = (await db.collection('b2b_orders').doc(response.orderId).get()).data();
    result('quote-survives-'+name, response.ok && response.emailSent.customer === false && response.emailStatus.customer === expected && saved.userEmailStatus === expected && saved.status === 'quote_requested', {status:response.emailStatus.customer, orders:(await db.collection('b2b_orders').get()).size});
  }
  await reset(); await seedOrder();
  const approved = await api.approveB2BOrder(request({orderId:'test-order'}, operator));
  const codes = await db.collection('b2b_codes').get();
  const publicOrder=(await db.collection('b2b_orders').doc('test-order').get()).data();
  const job=(await db.collection('b2b_issuance_jobs').doc('test-order').get()).data();
  result('issuance-plan-is-server-only-document',!publicOrder.issuancePlan&&!publicOrder.issuanceLease&&job.plan.length===10&&job.plan.every(code=>codes.docs.some(d=>d.data().code===code)),{privatePlanCount:job.plan.length,publicPlan:false});
  assert.equal(JSON.parse(fs.readFileSync(path.join(root,'firebase.b2b-test.json'),'utf8')).firestore.rules,'firestore.rules','Emulator must load candidate Firestore rules');
  const authReply=await fetch('http://'+process.env.FIREBASE_AUTH_EMULATOR_HOST+'/identitytoolkit.googleapis.com/v1/accounts:signUp?key=synthetic',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({returnSecureToken:true})});
  assert.ok(authReply.ok);const account=await authReply.json();
  try {
    await db.collection('b2b_orders').doc('test-order').update({contactUid:account.localId});
    const url='http://'+process.env.FIRESTORE_EMULATOR_HOST+'/v1/projects/'+project+'/databases/(default)/documents/';
    const headers={authorization:'Bearer '+account.idToken};
    const orderRead=await fetch(url+'b2b_orders/test-order',{headers});
    const planRead=await fetch(url+'b2b_issuance_jobs/test-order',{headers});
    const guestRead=await fetch(url+'b2b_issuance_jobs/test-order');
    const orderJSON=await orderRead.json();
    result('actual-firestore-rules-deny-plan-to-owner-and-guest',orderRead.ok&&planRead.status===403&&guestRead.status===403&&!orderJSON.fields?.issuancePlan,{orderStatus:orderRead.status,planOwnerStatus:planRead.status,planGuestStatus:guestRead.status});
  } finally { await admin.auth().deleteUser(account.localId); }
  result('normal-code-count-and-xlsx', approved.codesIssued === 10 && codes.size === 10 && !!sent.find(x => x.attachments?.[0]?.filename.endsWith('.xlsx')), {codes: codes.size, attachment: sent.find(x => x.attachments)?.attachments[0].filename});
  const codeMail = sent.find(m => m.attachments?.length);
  result('code-mail-uses-current-scope-and-canonical-url', codeMail.text.includes('핵심 56문항') && codeMail.html.includes('https://lifeportfolio.co.kr/b2b-join') && !codeMail.text.includes('76문항') && !codeMail.html.includes('즉시 생성'), {subject:codeMail.subject});
  fs.writeFileSync(path.join(outputDir,'codes-mail-preview.html'),codeMail.html);
  fs.writeFileSync(path.join(outputDir,'codes-mail-preview.txt'),codeMail.text);
  result('mail-terms-autonomy-and-legacy-diary-parity', [quoteMail,codeMail].every(m => ['12개월','제9조','자율적','불이익'].every(s => m.html.includes(s) && m.text.includes(s))) && codeMail.text.includes('다이어리 옵션 2권'), {terms:true});
  const ExcelJS = deps('exceljs'), workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(codeMail.attachments[0].content,'base64'));
  const sheet = workbook.worksheets[0];
  result('xlsx-opens-with-ten-code-rows', sheet.rowCount === 18 && sheet.getCell('C9').value === '포함' && sheet.getCell('C11').value === '-' && sheet.getCell('C2').value === approved.orgCode, {rows:sheet.rowCount});
  const revoked = codes.docs[0]; await revoked.ref.update({status:'revoked'});
  const usedDoc = codes.docs[1]; await usedDoc.ref.update({status:'used'});
  const draft = await api.getB2BCodesEmailDraft(request({orderId:'test-order'},operator));
  const resendBefore = sent.length;
  const resend = await api.resendB2BCodesEmail(request({orderId:'test-order'},operator));
  const resendOrder = (await db.collection('b2b_orders').doc('test-order').get()).data();
  const resendWb = new ExcelJS.Workbook(); await resendWb.xlsx.load(Buffer.from(draft.xlsxBase64,'base64'));
  const rows = resendWb.worksheets[0].getRows(9,9);
  result('resend-excludes-revoked-preserves-code-properties', resend.ok && sent.length === resendBefore + 1 && rows.every(r => r.getCell(2).value !== revoked.data().code) && rows.find(r => r.getCell(2).value === usedDoc.data().code)?.getCell(4).value === '사용' && rows.find(r => r.getCell(2).value === usedDoc.data().code)?.getCell(3).value === '포함' && resendOrder.codesEmailLastResendMessageId === 'synthetic-mail-id', {codeRows:rows.length});
  flags.timeoutMail = true;
  const uncertain = await api.resendB2BCodesEmail(request({orderId:'test-order'},operator)).catch(e=>({error:e.code}));
  result('uncertain-resend-does-not-claim-failure-or-success', uncertain.error === 'unavailable' && (await db.collection('b2b_orders').doc('test-order').get()).data().codesEmailLastResendStatus === 'unknown', uncertain);
  flags.timeoutMail = false;
  await reset(); await seedOrder();
  const both = await Promise.allSettled([1,2].map(() => api.approveB2BOrder(request({orderId:'test-order'}, operator))));
  const concurrentCodes = await db.collection('b2b_codes').get();
  result('concurrent-approval-does-not-overissue', concurrentCodes.size === 10, {fulfilled: both.filter(x=>x.status==='fulfilled').length, issuedDocuments:concurrentCodes.size});
  await reset(); await seedOrder('large-order', 401); flags.failBatchAt = 2;
  try {await api.approveB2BOrder(request({orderId:'large-order'}, operator));} catch (_) {}
  const partial = (await db.collection('b2b_codes').get()).size; flags.failBatchAt = 0;
  await api.approveB2BOrder(request({orderId:'large-order'}, operator));
  const resumed = (await db.collection('b2b_codes').get()).size;
  result('partial-issuance-retry-does-not-overissue', resumed === 401, {partial, afterRetry:resumed, expected:401});
  await reset(); await seedOrder(); await db.collection('b2b_orders').doc('test-order').update({status:'refunded'});
  let rejected = false; try {await api.approveB2BOrder(request({orderId:'test-order'}, operator));} catch (_) {rejected=true;}
  result('refunded-order-cannot-be-approved', rejected, {rejected});
  await reset(); await seedOrder(); await db.collection('b2b_orders').doc('test-order').update({status:'active'}); await seedCode();
  const r = await api.verifyB2BCode(request({orgCode:'TEST-ORG',accessCode:'ABCD-EFGH'},actor('participant-a')));
  result('normal-participant-gets-rtdb-access', r.ok && (await admin.database().ref('b2b_access/participant-a').get()).exists(), {ok:r.ok});
  let retry; try {retry=await api.verifyB2BCode(request({orgCode:'TEST-ORG',accessCode:'ABCD-EFGH'},actor('participant-a')));} catch(e) {retry={code:e.code};}
  result('same-user-same-code-retry-is-idempotent', retry.ok === true, retry);
  await reset(); await seedOrder(); await db.collection('b2b_orders').doc('test-order').update({status:'active'}); await seedCode(); flags.failRtdb=true;
  const lost = await api.verifyB2BCode(request({orgCode:'TEST-ORG',accessCode:'ABCD-EFGH'},actor('participant-b'))).catch(e=>({error:e.code}));
  const entitlement = (await admin.database().ref('b2b_access/participant-b').get()).exists(); flags.failRtdb=false;
  let repair; try {repair=await api.verifyB2BCode(request({orgCode:'TEST-ORG',accessCode:'ABCD-EFGH'},actor('participant-b')));} catch(e) {repair={error:e.code};}
  result('rtdb-failure-not-false-success-and-retry-recovers', lost.ok !== true && repair.ok === true && (await admin.database().ref('b2b_access/participant-b').get()).exists(), {first:lost,accessAfterFailure:entitlement,retry:repair});
  await reset(); await seedOrder(); await db.collection('b2b_orders').doc('test-order').update({status:'active'}); await seedCode(); await seedCode('code-b','JKLM-NPQR');
  const twoCodes = await Promise.allSettled(['ABCD-EFGH','JKLM-NPQR'].map(accessCode=>api.verifyB2BCode(request({orgCode:'TEST-ORG',accessCode},actor('participant-c')))));
  const used = await db.collection('b2b_codes').where('status','==','used').get();
  result('one-user-concurrent-two-codes-consumes-only-one', used.size === 1, {fulfilled:twoCodes.filter(x=>x.status==='fulfilled').length,used:used.size});
  await reset(); await seedOrder(); await db.collection('b2b_orders').doc('test-order').update({status:'cancelled'}); await seedCode();
  let inactive;try {inactive=await api.verifyB2BCode(request({orgCode:'TEST-ORG',accessCode:'ABCD-EFGH'},actor('participant-d')));} catch(e) {inactive={error:e.code};}
  result('inactive-order-cannot-grant-access', inactive.ok !== true, inactive);
}
(async()=>{try {await main();} finally {
  await reset(); await admin.app().delete();
  const report={scope:'actual handlers with local Firestore/RTDB; callable auth/rate-limit/mail are stubs; not production, not client-rules E2E',project,source_sha:process.env.AUDIT_SOURCE_SHA||'',tests:findings,passed:findings.filter(x=>x.passed).length,failed:findings.filter(x=>!x.passed).length,cleanup:true};
  fs.writeFileSync(path.join(outputDir,process.env.AUDIT_OUTPUT||'baseline-server-results.json'),JSON.stringify(report,null,2)+'\n');
  if (report.failed) process.exitCode = 1;
}})().catch(e=>{console.error(e);process.exitCode=1;});
