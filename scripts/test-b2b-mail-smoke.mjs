import assert from 'node:assert/strict';
import {loadMessages,sendMessages} from './send-b2b-mail-smoke.mjs';
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
