'use strict';
// OBS-006 (2026-10-08): anonymizeMyPaymentOnWithdraw — real handler against local RTDB emulator.
// Run inside: firebase emulators:exec --only database (see tools/stability-harness/run-isolated-rtdb.sh pattern)
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const root=path.resolve(__dirname,'..');
const deps=createRequire(path.resolve(process.env.LP_FUNCTIONS_DEPS||path.join(root,'functions'),'package.json'));
assert.match(process.env.FIREBASE_DATABASE_EMULATOR_HOST||'',/^127\.0\.0\.1:\d+$/,'Refuse non-local emulator');
const admin=deps('firebase-admin');const project='demo-lp-rules-audit';
admin.initializeApp({projectId:project,databaseURL:`https://${project}-default-rtdb.firebaseio.com`});
const src=fs.readFileSync(path.join(root,'functions/index.js'),'utf8');
const a=src.indexOf('exports.anonymizeMyPaymentOnWithdraw = onCall('),b=src.indexOf('exports.grantPaidByEmail = onCall(');
assert.ok(a>0&&b>a);
class HttpsError extends Error{constructor(c,m){super(m);this.code=c;}}
const ctx={exports:{},admin,onCall:(_o,h)=>h,HttpsError,logger:{info(){},warn(){},error(){}},checkCallableRateLimit:async()=>{},Date,Math,Object,console};
vm.runInNewContext(src.slice(a,b),ctx,{filename:'anonymize.js'});
const fn=ctx.exports.anonymizeMyPaymentOnWithdraw;const db=admin.database();
let pass=0;const ok=(n,c,o)=>{assert.ok(c,n+' '+JSON.stringify(o||{}));pass++;console.log('PASS '+n);};
(async()=>{
  await db.ref().remove();
  await assert.rejects(fn({auth:null,data:{}}),e=>e.code==='unauthenticated');ok('unauthenticated-rejected',true);
  const r0=await fn({auth:{uid:'w1'},data:{}});ok('no-record-moved-false',r0.ok&&r0.moved===false,r0);
  await db.ref('payments/w1').set({paid:true,createdAt:'2026-01-01T00:00:00Z',source:'payple',_pending:{provider:'payple'}});
  await db.ref('payments/w2').set({paid:true,createdAt:'2026-02-02T00:00:00Z'});
  const r1=await fn({auth:{uid:'w1'},data:{}});ok('moved-true',r1.ok&&r1.moved===true&&/^withdrawn_/.test(r1.anonId),r1);
  const anon=(await db.ref('payments_anonymized/'+r1.anonId).once('value')).val();
  ok('anonymized-record-has-retention-and-no-uid',anon&&anon.paid===true&&anon._retainUntilYear===5&&anon._retainUntilTs>Date.now()&&!('uid' in anon)&&!('email' in anon)&&!('_pending' in anon),anon);
  ok('source-removed',!(await db.ref('payments/w1').once('value')).exists());
  ok('other-user-untouched',(await db.ref('payments/w2').once('value')).val().paid===true);
  const r2=await fn({auth:{uid:'w1'},data:{}});ok('idempotent-second-call',r2.moved===false,r2);
  ok('exactly-one-anonymized-node',(await db.ref('payments_anonymized').once('value')).numChildren()===1);
  await db.ref().remove();
  console.log('SUMMARY '+pass+' checks; real handler, local emulator, no production');process.exit(0);
})().catch(e=>{console.error('FAIL',e);process.exit(1);});
