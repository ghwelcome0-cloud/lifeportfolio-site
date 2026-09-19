'use strict';
// Reusable cases for the real-handler/local-emulator harness. No production data.
module.exports = async ({api, request, operator, actor, db, admin, reset, seedOrder, seedCode, result, flags, sent}) => {
  const orderRef=()=>db.collection('b2b_orders').doc('test-order');
  const saved=async()=>(await orderRef().get()).data();
  const invoke=(name,data={},auth=operator)=>api[name](request({orderId:'test-order',reason:'Synthetic closure',...data},auth)).catch(e=>({error:e.code||e.message}));
  for(const auth of [null,actor('stranger'),{uid:'string-admin',token:{admin:'true'}}]) {
    await reset();await seedOrder();
    for(const name of ['cancelB2BOrder','refundB2BOrder']) {
      const r=await invoke(name,{},auth);
      result(name+'-rejects-nonboolean-admin-'+(auth?.uid||'anonymous'),r.error==='permission-denied'&&(await saved()).status==='payment_reported'&&sent().length===0,r);
    }
  }
  for(const status of ['quote_requested','payment_reported','active']) {
    await reset();await seedOrder();await orderRef().update({status});
    if(status==='active') {await orderRef().update({orgCode:'TEST-ORG',codesIssued:2});await seedCode();await seedCode('code-b','IJKL-MNOP');await api.verifyB2BCode(request({orgCode:'TEST-ORG',accessCode:'ABCD-EFGH'},actor('used-person')));}
    await admin.database().ref('responses/used-person/session').set({answer:'preserve'});
    await admin.database().ref('reports/used-person/session').set({report:'preserve'});
    const before=(await admin.database().ref().get()).val();
    const r=await invoke('cancelB2BOrder'); const after=await saved();
    result('cancel-'+status,r.ok&&after.status==='cancelled'&&after.cancelPreviousStatus===status&&after.cancelCleanupStatus==='complete'&&!('refundAmount' in after),r);
    result('cancel-preserves-rtdb-'+status,JSON.stringify(before)===JSON.stringify((await admin.database().ref().get()).val()),{unchanged:true});
    const retry=await invoke('cancelB2BOrder',{reason:'Different retry reason'});
    result('cancel-replay-once-'+status,retry.ok&&sent().length===1&&(await saved()).cancelReason==='Synthetic closure',{mails:sent().length});
    if(status==='active') {
      const used=(await db.collection('b2b_codes').doc('code-a').get()).data();
      const unused=(await db.collection('b2b_codes').doc('code-b').get()).data();
      const reconnect=await api.verifyB2BCode(request({orgCode:'TEST-ORG',accessCode:'ABCD-EFGH'},actor('used-person'))).catch(e=>({error:e.code}));
      const stranger=await api.verifyB2BCode(request({orgCode:'TEST-ORG',accessCode:'IJKL-MNOP'},actor('new-person'))).catch(e=>({error:e.code}));
      result('cancel-preserves-used-blocks-new',used.status==='used'&&unused.status==='revoked'&&reconnect.ok&&!!stranger.error,{used:used.status,unused:unused.status,reconnect:!!reconnect.ok,newError:stranger.error});
      const resume=await api.verifyB2BCode(request({resumeSurvey:true},actor('used-person')));
      const groupSid=resume.survey.sid;
      await admin.database().ref('responses/used-person/'+groupSid).update({status:'submitted',answers:{Q1:'Retained group response'},submittedAt:10});
      const resumed=await api.verifyB2BCode(request({resumeSurvey:true},actor('used-person')));
      result('cancelled-used-seat-can-start-and-resume-same-group',resumed.survey.sid===groupSid&&resumed.survey.data.answers.Q1==='Retained group response'&&resumed.survey.data.status==='submitted',{sameSid:resumed.survey.sid===groupSid,status:resumed.survey.data.status});
      const wrong=await api.verifyB2BCode(request({orgCode:'TEST-ORG',accessCode:'ABCD-EFGH'},actor('wrong-person'))).catch(e=>({error:e.code}));
      result('cancelled-used-code-cannot-be-taken-by-other-account',!!wrong.error&&!(await db.collection('b2b_user_links').doc('wrong-person').get()).exists,{error:wrong.error});
      await admin.database().ref('b2b_access/used-person').remove();flags().failRtdb=true;
      const failedLink=await api.verifyB2BCode(request({orgCode:'TEST-ORG',accessCode:'ABCD-EFGH'},actor('used-person'))).catch(e=>({error:e.code}));
      flags().failRtdb=false;
      const repaired=await api.verifyB2BCode(request({orgCode:'TEST-ORG',accessCode:'ABCD-EFGH'},actor('used-person')));
      result('cancelled-code-reconnection-repairs-mirror-without-new-seat',failedLink.error==='unavailable'&&repaired.ok&&(await admin.database().ref('b2b_access/used-person').get()).exists()&&(await saved()).codesUsed===1,{first:failedLink.error,repaired:!!repaired.ok,used:(await saved()).codesUsed});
    }
    const refund=await invoke('refundB2BOrder');
    result('refund-after-cancel-'+status,status==='quote_requested'?refund.error==='failed-precondition':refund.ok&&refund.refundAmount===(status==='payment_reported'?198000:15840),refund);
    if(status!=='quote_requested') {
      const replay=await invoke('refundB2BOrder',{refundAmount:1});
      result('refund-replay-preserves-amount-'+status,replay.refundAmount===refund.refundAmount&&sent().length===2,{mails:sent().length,amount:replay.refundAmount});
    }
  }
  for(const kind of ['cancel','refund']) {
    await reset();await seedOrder();await orderRef().update({status:'active',orgCode:'TEST-ORG',codesIssued:801});
    for(let start=0;start<801;start+=400){const batch=db.batch();for(let i=start;i<Math.min(801,start+400);i++)batch.set(db.collection('b2b_codes').doc('bulk-'+i),{orderId:'test-order',status:'unused',code:'SYN-'+i,orgCode:'TEST-ORG'});await batch.commit();}
    flags().failRevoke=true;
    const name=kind==='cancel'?'cancelB2BOrder':'refundB2BOrder';
    const failed=await invoke(name),partial=await saved();
    result(kind+'-partial-failure-is-visible',!!failed.error&&partial[kind+'CleanupStatus']==='pending'&&sent().length===0,{state:partial.status,error:failed.error});
    const denied=await api.verifyB2BCode(request({orgCode:'TEST-ORG',accessCode:'SYN-0'},actor('late-person'))).catch(e=>({error:e.code}));
    result(kind+'-blocks-during-cleanup',!!denied.error,denied);
    const resumed=await invoke(name);const docs=await db.collection('b2b_codes').where('orderId','==','test-order').get();
    result(kind+'-resumes-801-codes',resumed.ok&&resumed.codesRevoked===801&&docs.docs.every(d=>d.data().status==='revoked')&&(await saved())[kind+'CleanupStatus']==='complete'&&sent().length===1,{count:resumed.codesRevoked,mails:sent().length});
  }
  for(const mode of ['missingKey','timeoutMail','failMail']) {
    await reset();await seedOrder();flags()[mode]=true;
    const r=await invoke('cancelB2BOrder'),replay=await invoke('cancelB2BOrder');
    result('cancel-mail-state-'+mode,r.ok&&replay.ok&&r.emailStatus===(mode==='missingKey'?'not_accepted':'unknown')&&sent().length<2,{emailStatus:r.emailStatus,attempts:sent().length});
  }
  await reset();await seedOrder();
  const concurrent=await Promise.all([1,2,3].map(()=>invoke('cancelB2BOrder')));
  result('concurrent-cancel-notifies-once',concurrent.every(r=>r.ok)&&sent().length===1,{notifications:sent().length});
  await reset();await seedOrder();await orderRef().update({status:'active',orgCode:'TEST-ORG',codesIssued:1});await seedCode();
  const race=await Promise.all([invoke('cancelB2BOrder'),api.verifyB2BCode(request({orgCode:'TEST-ORG',accessCode:'ABCD-EFGH'},actor('race-person'))).catch(e=>({error:e.code}))]);
  const code=(await db.collection('b2b_codes').doc('code-a').get()).data(),link=await db.collection('b2b_user_links').doc('race-person').get();
  result('cancel-versus-redemption-serializes',race[0].ok&&(code.status==='used'?link.exists&&race[1].ok:code.status==='revoked'&&!link.exists&&!!race[1].error),{status:code.status,link:link.exists});
  await reset();await seedOrder('test-order',801);
  const issueRace=await Promise.all([invoke('cancelB2BOrder'),invoke('approveB2BOrder')]);
  const codes=await db.collection('b2b_codes').where('orderId','==','test-order').get();
  result('cancel-versus-issuance-no-orphan-codes',(await saved()).status==='cancelled'&&codes.docs.every(d=>d.data().status==='revoked'),{outcomes:issueRace.map(r=>r.error||'ok'),codes:codes.size});
  await reset();await seedOrder();await orderRef().update({status:'active',orgCode:'TEST-ORG'});await seedCode();
  await Promise.all([invoke('cancelB2BOrder'),invoke('regenerateB2BAccessCode',{oldCode:'ABCD-EFGH'})]);
  const regen=await db.collection('b2b_codes').where('orderId','==','test-order').get();
  result('cancel-versus-regeneration-no-orphan-codes',(await saved()).status==='cancelled'&&regen.docs.every(d=>d.data().status==='revoked'),{codes:regen.size});
  await reset();await seedOrder();await orderRef().update({status:'active',orgCode:'TEST-ORG'});await seedCode();
  const groupActor=actor('group-session-person');
  await api.verifyB2BCode(request({orgCode:'TEST-ORG',accessCode:'ABCD-EFGH'},groupActor));
  const personal={_active:'s_1_personal',s_1_personal:{status:'in_progress',answers:{Q1:'Personal draft'}},s_2_old:{status:'submitted',answers:{Q1:'Old personal'}}};
  await admin.database().ref('responses/'+groupActor.uid).set(personal);
  await admin.database().ref('reports/'+groupActor.uid+'/s_2_old').set({manualOverrideHtml:'Preserved old personal report'});
  const parallel=await Promise.all([1,2,3].map(()=>api.verifyB2BCode(request({resumeSurvey:true},groupActor))));
  const groupSid=parallel[0].survey.sid;
  result('group-entry-one-server-sid',new Set(parallel.map(r=>r.survey.sid)).size===1&&parallel.every(r=>r.survey.data.meta.source==='b2b')&&groupSid!=='s_1_personal',{sidCount:new Set(parallel.map(r=>r.survey.sid)).size});
  const state=(await admin.database().ref('responses/'+groupActor.uid).get()).val();
  result('group-entry-preserves-personal-draft-and-report',state._active===personal._active&&require('node:util').isDeepStrictEqual(state.s_1_personal,personal.s_1_personal)&&(await admin.database().ref('reports/'+groupActor.uid+'/s_2_old/manualOverrideHtml').get()).val()==='Preserved old personal report',{personalPreserved:true});
  await admin.database().ref('responses/'+groupActor.uid+'/'+groupSid).update({status:'submitted',answers:{Q1:'Group result'}});
  const same=await api.verifyB2BCode(request({resumeSurvey:true,sid:'s_9_forged',orderId:'another-order'},groupActor));
  result('group-submission-reentry-same-sid-no-overwrite',same.survey.sid===groupSid&&same.survey.data.status==='submitted'&&same.survey.data.answers.Q1==='Group result',{sameSid:same.survey.sid===groupSid,status:same.survey.data.status});
  const unlinked=await api.verifyB2BCode(request({resumeSurvey:true},actor('no-link'))).catch(e=>({error:e.code}));
  result('group-url-cannot-create-entitlement',unlinked.error==='failed-precondition'&&!(await db.collection('b2b_user_links').doc('no-link').get()).exists,unlinked);
  await reset();await seedOrder();await orderRef().update({status:'active',orgCode:'TEST-ORG'});await seedCode();
  const signup=await fetch('http://'+process.env.FIREBASE_AUTH_EMULATOR_HOST+'/identitytoolkit.googleapis.com/v1/accounts:signUp?key=synthetic',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({returnSecureToken:true})});
  const account=await signup.json(),realActor=actor(account.localId);
  await api.verifyB2BCode(request({orgCode:'TEST-ORG',accessCode:'ABCD-EFGH'},realActor));
  const assigned=await api.verifyB2BCode(request({resumeSurvey:true},realActor));
  const rsid=assigned.survey.sid;
  const base='http://'+process.env.FIREBASE_DATABASE_EMULATOR_HOST;
  const url=p=>base+'/'+p+'.json?ns=demo-lp-b2b-stability-default-rtdb&auth='+encodeURIComponent(account.idToken);
  const submitted=await fetch(url('responses/'+account.localId+'/'+rsid),{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({status:'submitted',answers:{Q1:'Synthetic'},submittedAt:10,'meta/step':12})});
  result('actual-rtdb-rules-allow-group-submit',submitted.status===200,{status:submitted.status});
  const dismissed=await fetch(url('responses/'+account.localId+'/'+rsid+'/meta/recoveryDismissed'),{method:'PUT',headers:{'content-type':'application/json'},body:'true'});
  const preserved=(await admin.database().ref('responses/'+account.localId+'/'+rsid).get()).val();
  result('actual-rtdb-rules-allow-recovery-list-removal-without-erasing-submission',dismissed.status===200&&preserved.status==='submitted'&&preserved.answers.Q1==='Synthetic'&&preserved.meta.recoveryDismissed===true,{status:dismissed.status,submitted:preserved.status});
  const rp='reports/'+account.localId+'/'+rsid;
  const empty=await fetch(url(rp),{headers:{'X-Firebase-ETag':'true'}});const etag=empty.headers.get('etag');await empty.text();
  const engineInput={questions:require('../data/questions.json'),mapping:require('../data/mapping.json'),rules:require('../data/report-rules.json'),answers:{Q1:'Synthetic'},profile:{name:'Synthetic',submittedAt:10},lang:'ko'};
  const engineReport=require('../assets/js/report-engine.js').build(engineInput);
  const realReport=require('../assets/js/report-engine-v4.js').upgrade(engineReport,engineInput);
  result('actual-engine-uses-array-sections',Array.isArray(realReport.sections)&&realReport.sections.length>0,{sections:realReport.sections.length,version:realReport.engineVersion});
  const body=JSON.parse(JSON.stringify({sid:rsid,generatedAt:10,editCount:0,report:realReport}));
  const created=await fetch(url(rp),{method:'PUT',headers:{'content-type':'application/json','if-match':etag},body:JSON.stringify(body)});
  const idx=await fetch(url('users/'+account.localId+'/reports/'+rsid),{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({sid:rsid,generatedAt:10,name:'Synthetic',lang:'ko',submittedAt:10})});
  result('actual-rtdb-rules-deny-direct-group-report-and-index',created.status===401&&idx.status===401,{report:created.status,index:idx.status});
  const finalize=(sid=rsid,extra={})=>api.verifyB2BCode(request({reportAction:'finalize',sid,body,...extra},realActor)).catch(e=>({error:e.code}));
  const wrongSid=await finalize('s_9_wrong');
  result('server-finalize-denies-other-sid',wrongSid.error==='permission-denied',wrongSid);
  const done=await Promise.all([finalize(),finalize(),finalize()]);
  const pinned=(await db.collection('b2b_codes').doc('code-a').get()).data();
  result('server-finalize-concurrent-one-code-one-report',done.every(r=>r.reportSid===rsid)&&pinned.resultSid===rsid&&pinned.resultState==='complete'&&Object.keys((await admin.database().ref('reports/'+account.localId).get()).val()).length===1,{results:done.map(r=>r.reportSid),state:pinned.resultState});
  result('server-finalize-index-confirmed',(await admin.database().ref('users/'+account.localId+'/reports/'+rsid+'/sid').get()).val()===rsid,{sid:rsid});
  await admin.database().ref(rp+'/manualOverrideHtml').set('Preserved manual');
  const replay=await finalize(rsid,{body:{report:{sections:{changed:'must not replace'}}}});
  const resumedDone=await api.verifyB2BCode(request({resumeSurvey:true},realActor));
  await api.verifyB2BCode(request({orgCode:'TEST-ORG',accessCode:'ABCD-EFGH'},realActor));
  result('server-finalize-preserves-manual-and-reconnect-completion',replay.stored.manualOverrideHtml==='Preserved manual'&&resumedDone.reportSid===rsid&&(await admin.database().ref('b2b_access/'+account.localId+'/reportSid').get()).val()===rsid,{sameSid:resumedDone.reportSid===rsid});
  for (const [name,p,method,value] of [
    ['group-delete',rp,'DELETE',null],
    ['group-replace',rp,'PUT',body],
    ['reports-parent-delete','reports/'+account.localId,'DELETE',null],
    ['reports-parent-replace','reports/'+account.localId,'PUT',{s_9_wrong:body}],
    ['other-sid-report','reports/'+account.localId+'/s_9_wrong','PUT',body],
    ['other-sid-personal-disguise','reports/'+account.localId+'/s_9_wrong','PUT',{report:{sections:{one:'fake personal'}}}],
    ['response-delete','responses/'+account.localId+'/'+rsid,'DELETE',null],
    ['response-reset','responses/'+account.localId+'/'+rsid+'/status','PUT','in_progress'],
    ['response-answer-change','responses/'+account.localId+'/'+rsid+'/answers/Q1','PUT','tampered'],
    ['response-parent-delete','responses/'+account.localId,'DELETE',null],
    ['other-sid-response','responses/'+account.localId+'/s_9_wrong','PUT',{status:'submitted'}],
    ['index-parent-delete','users/'+account.localId+'/reports','DELETE',null],
    ['user-parent-delete','users/'+account.localId,'DELETE',null],
    ['forge-personal-payment','payments/'+account.localId,'PUT',{paid:true,createdAt:'synthetic',source:'fake'}],
    ['forge-server-mirror','b2b_access/'+account.localId+'/surveySid','PUT','s_9_wrong']
  ]) {
    const response=await fetch(url(p),{method,headers:{'content-type':'application/json'},...(method==='DELETE'?{}:{body:JSON.stringify(value)})});
    result('one-code-rules-deny-'+name,response.status===401,{status:response.status});
  }
  // A separate pre-existing personal purchase still works. A group code alone
  // cannot create that paid record; its legacy trust model is a separate workstream.
  await admin.database().ref('payments/'+account.localId).set({paid:true,createdAt:'synthetic'});
  const pp='responses/'+account.localId+'/s_8_personal';
  const personalResponse=await fetch(url(pp),{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({status:'submitted',answers:{Q1:'Personal'}})});
  const personalReport=await fetch(url('reports/'+account.localId+'/s_8_personal'),{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({sid:'s_8_personal',report:{sections:{one:'Personal'}},generatedAt:10,editCount:0})});
  const paidGroupOverwrite=await fetch(url(rp),{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  result('personal-purchase-coexists-with-group-lock',personalResponse.status===200&&personalReport.status===200&&paidGroupOverwrite.status===401,{personalResponse:personalResponse.status,personalReport:personalReport.status,groupOverwrite:paidGroupOverwrite.status});
  // Simulated administrative loss, never a production/customer deletion.
  await admin.database().ref('responses/'+account.localId+'/'+rsid).remove();
  const noResponse=await api.verifyB2BCode(request({resumeSurvey:true},realActor));
  result('completed-code-opens-report-without-recreating-response',noResponse.reportSid===rsid&&!(await admin.database().ref('responses/'+account.localId+'/'+rsid).get()).exists(),{reportSid:noResponse.reportSid});
  await admin.database().ref(rp).remove();
  const removed=await finalize();
  result('completed-code-never-regenerates-after-report-loss',removed.error==='failed-precondition'&&!(await admin.database().ref(rp).get()).exists(),removed);
  const whitespace=[' ','\t','\r','\n','\f','\v','\u00a0','\u1680',...Array.from({length:11},(_,i)=>String.fromCharCode(0x2000+i)),'\u2028','\u2029','\u202f','\u205f','\u3000','\ufeff'];
  for(const [name,email,allowed] of [['normal','person+tag@example.invalid',true],['empty','',true],['no-at','not-an-email',false],['double-at','a@@b.test',false],...whitespace.map((w,i)=>['space-'+i,'a'+w+'b@example.invalid',false])]) {
    const r=await fetch(url('users/'+account.localId+'/email'),{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(email)});
    result('full-rules-email-'+name,allowed?r.status===200:r.status===400||r.status===401,{status:r.status});
  }
  await admin.auth().deleteUser(account.localId);
  for(const amount of [-1,198001,1.5,'100']) {
    await reset();await seedOrder();const r=await invoke('refundB2BOrder',{refundAmount:amount});
    result('refund-invalid-amount-'+amount,r.error==='invalid-argument'&&(await saved()).status==='payment_reported'&&sent().length===0,r);
  }
  await reset();await seedOrder();await orderRef().update({status:'cancelled',cancelReason:'Historical'});const before=JSON.stringify(await saved());
  const legacy=await invoke('cancelB2BOrder');
  result('legacy-cancellation-no-rewrite',legacy.ok&&JSON.stringify(await saved())===before&&sent().length===0,{mails:sent().length});
};
