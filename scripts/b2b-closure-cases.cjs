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
  const rp='reports/'+account.localId+'/'+rsid;
  const empty=await fetch(url(rp),{headers:{'X-Firebase-ETag':'true'}});const etag=empty.headers.get('etag');await empty.text();
  const body={sid:rsid,generatedAt:10,editCount:0,report:{sections:{one:'Synthetic'},_participation:{source:'b2b',orderId:'test-order'}}};
  const created=await fetch(url(rp),{method:'PUT',headers:{'content-type':'application/json','if-match':etag},body:JSON.stringify(body)});
  const idx=await fetch(url('users/'+account.localId+'/reports/'+rsid),{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({sid:rsid,generatedAt:10,name:'Synthetic',lang:'ko',submittedAt:10})});
  result('actual-rtdb-rules-report-and-index',created.status===200&&idx.status===200,{report:created.status,index:idx.status});
  await admin.database().ref(rp+'/manualOverrideHtml').set('Preserved manual');
  const conflict=await fetch(url(rp),{method:'PUT',headers:{'content-type':'application/json','if-match':etag},body:JSON.stringify(body)});
  result('actual-rtdb-etag-protects-existing-report',conflict.status===412&&(await admin.database().ref(rp+'/manualOverrideHtml').get()).val()==='Preserved manual',{status:conflict.status});
  await admin.auth().deleteUser(account.localId);
  for(const amount of [-1,198001,1.5,'100']) {
    await reset();await seedOrder();const r=await invoke('refundB2BOrder',{refundAmount:amount});
    result('refund-invalid-amount-'+amount,r.error==='invalid-argument'&&(await saved()).status==='payment_reported'&&sent().length===0,r);
  }
  await reset();await seedOrder();await orderRef().update({status:'cancelled',cancelReason:'Historical'});const before=JSON.stringify(await saved());
  const legacy=await invoke('cancelB2BOrder');
  result('legacy-cancellation-no-rewrite',legacy.ok&&JSON.stringify(await saved())===before&&sent().length===0,{mails:sent().length});
};
