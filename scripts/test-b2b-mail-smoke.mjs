import assert from 'node:assert/strict';
import {loadMessages,sendMessages} from './send-b2b-mail-smoke.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
import {FIXTURE_SHA,RECIPIENT_SHA} from './send-b2b-mail-smoke.mjs';
const workflow=fs.readFileSync(new URL('../.github/workflows/b2b-mail-smoke.yml',import.meta.url),'utf8');
assert.ok(workflow.indexOf('node scripts/verify-approval-evidence.mjs')<workflow.indexOf('secrets.FIREBASE_PRODUCTION_SERVICE_ACCOUNT'));
const guard=workflow.split("node --input-type=module <<'JS'\n")[1].split('\n          JS')[0].replace(/^\s*import .*;\s*$/gm,'');
const sha='a'.repeat(40);
for(const mode of ['valid','wrong-main','not-merged','different-merge','repeated-run','wrong-run','wrong-pr','wrong-owner','expired','wrong-marker']){
 const rows={
  'branches/main':{commit:{sha:mode==='wrong-main'?'b'.repeat(40):sha}},
  'pulls/319':{merged:mode!=='not-merged',merge_commit_sha:mode==='different-merge'?'b'.repeat(40):sha},
  [`actions/workflows/b2b-mail-smoke.yml/runs?event=workflow_dispatch&head_sha=${sha}&per_page=100`]:{total_count:mode==='repeated-run'?2:1,workflow_runs:[{id:mode==='wrong-run'?8:7}]},
  'issues/comments/123':{issue_url:'https://api.github.com/repos/ghwelcome0-cloud/lifeportfolio-site/issues/'+(mode==='wrong-pr'?'318':'319'),user:{login:mode==='wrong-owner'?'other':'ghwelcome0-cloud'},created_at:new Date(Date.now()-(mode==='expired'?31:1)*60000).toISOString(),body:mode==='wrong-marker'?'no':`APPROVE_B2B_MAIL_SMOKE ${sha} ${FIXTURE_SHA} ${RECIPIENT_SHA}`}
 };
 const run=()=>vm.runInNewContext(guard,{assert,FIXTURE_SHA,RECIPIENT_SHA,process:{env:{EXPECTED_SHA:sha,APPROVAL_COMMENT_ID:'123',GITHUB_RUN_ID:'7'}},console:{log(){}},execFileSync:(_cmd,args)=>JSON.stringify(rows[args[1].replace('repos/ghwelcome0-cloud/lifeportfolio-site/','')])});
 if(mode==='valid')run();else assert.throws(run);
 console.log('PASS approval guard '+mode);
}
const fixture = loadMessages();
assert.equal(fixture.length,2);
assert.equal(fixture[0].attachments,undefined);
assert.equal(fixture[1].attachments.length,1);
let badCalls=0;
await assert.rejects(sendMessages('synthetic-key','unapproved@example.invalid',async()=>{badCalls++;}), /Recipient is not approved/);
assert.equal(badCalls,0);
console.log('PASS fixed fixtures and wrong-recipient rejection');
const recipient=process.env.B2B_MAIL_TEST_RECIPIENT;
if(recipient){
 for(const mode of ['accepted','422','503','timeout','missing-id','read-denied']){
  const calls=[];
  const receipt=await sendMessages('synthetic-key',recipient,async(url,options)=>{
   calls.push({url,options});
   assert.match(url,/^https:\/\/api\.resend\.com\/emails(?:\/[a-zA-Z0-9-]+)?$/);
   assert.equal(options.redirect,'error');assert.ok(options.signal);
   if(options.method==='POST'){
    assert.deepEqual(JSON.parse(options.body).to,[recipient]);
    assert.ok(options.headers['Idempotency-Key']);
    if(mode==='timeout')throw Error('synthetic');
    const status=mode==='422'?422:mode==='503'?503:200;
    return {ok:status===200,status,json:async()=>mode==='missing-id'?{}:{id:`test-${calls.length}`}};
   }
   return {ok:mode!=='read-denied',status:mode==='read-denied'?403:200,json:async()=>({last_event:'delivered'})};
  },async()=>{});
  assert.equal(calls.filter(c=>c.options.method==='POST').length,2);
  assert.equal(receipt.inboxConfirmed,false);
  assert.ok(!JSON.stringify(receipt).includes(recipient));
  const expected=mode==='422'?'not_accepted':['503','timeout','missing-id'].includes(mode)?'unknown':'provider_accepted';
  assert.ok(receipt.messages.every(m=>m.acceptance===expected));
  if(mode==='accepted')assert.ok(receipt.messages.every(m=>m.providerEvent==='delivered'));
  if(mode==='read-denied')assert.ok(receipt.messages.every(m=>m.providerEvent===null&&m.deliveryLookupHttpStatus===403));
  console.log('PASS mocked provider '+mode);
 }
}else console.log('SKIP mocked sending cases: test recipient not connected (no real mail sent)');
