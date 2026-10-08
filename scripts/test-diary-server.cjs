'use strict';
// Digital diary — owner-only storage: actual handler + local Auth/RTDB emulators + the real
// database.rules.json. Synthetic accounts and synthetic report only.
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict'),{createRequire}=require('node:module');
const root=path.resolve(__dirname,'..');
const deps=createRequire(path.join(root,'functions','package.json'));
for(const key of ['FIREBASE_DATABASE_EMULATOR_HOST','FIREBASE_AUTH_EMULATOR_HOST'])assert.match(process.env[key]||'',/^127\.0\.0\.1:\d+$/,'Refuse non-local emulator: '+key);
const project='demo-lp-b2b-stability',ns=project+'-default-rtdb';
const admin=deps('firebase-admin');admin.initializeApp({projectId:project,databaseURL:`https://${ns}.firebaseio.com`});
const M=require('../functions/_diary_module.js'),S=require('../assets/js/diary-schema.js');
const T=require('./test-response-evidence.cjs'),R=require('../assets/js/response-evidence.js'),P=require('../assets/js/program-engine.js');
const results=[];const result=(name,ok,detail)=>{results.push({name,ok:!!ok});console.log((ok?'PASS ':'FAIL ')+name+(ok?'':': '+JSON.stringify(detail).slice(0,600)));};
const call=(uid,data)=>M.handle({auth:uid?{uid}:null,data}).catch(e=>({error:e.code,msg:e.message}));
const db=p=>admin.database().ref(p);
(async()=>{
 const signUp=async()=>(await (await fetch('http://'+process.env.FIREBASE_AUTH_EMULATOR_HOST+'/identitytoolkit.googleapis.com/v1/accounts:signUp?key=synthetic',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({returnSecureToken:true})})).json());
 const owner=await signUp(),other=await signUp(),uid=owner.localId;
 const a=T.base(0);a.Q39=['기타 (직접 입력)'];a.Q40='입문 개발자에게 오류 원인을 코드 실행으로 설명합니다.';
 const report=R.attachAxes(T.build(a,'ko','input-v2').r,require('../data/questions.json'),a),sid='s_1791440430847_diary';
 const program=P.build({report,rules:require('../data/program-rules.json'),name:'합성',lang:'ko',publishedAt:new Date(0),axisProgram:true});
 await db('reports/'+uid+'/'+sid).set({sid,report});await db('programs/'+uid+'/'+sid).set({sid,program});
 const before=JSON.stringify((await db('reports/'+uid+'/'+sid).get()).val())+JSON.stringify((await db('programs/'+uid+'/'+sid).get()).val());

 result('requires-login',(await call(null,{action:'open'})).error==='unauthenticated');
 const empty=await call(uid,{action:'open'});
 result('open-empty-without-report',empty.ok&&empty.meta===null&&empty.seed===null&&!Object.keys(empty.pages).length&&!empty.logs.length,empty);
 const opened=await call(uid,{action:'open',reportSid:sid});
 const sd=opened.seed||{};
result("seed-from-own-report-and-program",opened.ok&&opened.reportFound&&sd.mission===report.sections.find(x=>x.id==='mission_vision').content.mission&&!!sd.mission&&!!sd.vision&&sd.strengths.length===3&&sd.growth.length===2&&sd.careers.length===3&&sd.profile.length===6&&sd.axes.length===4&&sd.axes[3].name==='자기실행'&&sd.axes[3].pct===83&&sd.program&&sd.program.weeks.length>=3&&sd.program.focus&&sd.program.focus.artifact,sd);
 result('seed-hides-internal-ids',!/\bQ\d{1,3}\b|evidenceRefs|axisRule|_strategy|"rule"|execution-to-prediction|self_(understanding|expression|design|execution)/.test(JSON.stringify(opened)),JSON.stringify(opened).match(/\bQ\d{1,3}\b|evidenceRefs|axisRule|_strategy/));
 result('seed-other-users-report-impossible',(await call(other.localId,{action:'open',reportSid:sid})).seed===null);
 result('start-rejects-bad-date',(await call(uid,{action:'start',startDate:'2026-02-30'})).error==='invalid-argument');
 result('start-rejects-foreign-report',(await call(other.localId,{action:'start',startDate:'2026-10-08',reportSid:sid})).error==='failed-precondition');
 const st=await call(uid,{action:'start',startDate:'2026-10-08',reportSid:sid});
 result('start-saves-meta',st.ok&&(await call(uid,{action:'open'})).meta.reportSid===sid);

 const s1=await call(uid,{action:'savePage',opId:'op_000001',pageKey:'week-1-l',patch:{mission:'한 사람에게 도움이 되는 한 주',a:'예상 결과 먼저 적기'}});
 result('save-page',s1.ok&&s1.applied&&s1.page.rev===1&&s1.page.fields.a==='예상 결과 먼저 적기',s1);
 const s1r=await call(uid,{action:'savePage',opId:'op_000001',pageKey:'week-1-l',patch:{mission:'다른 값'}});
 result('save-retry-idempotent',s1r.ok&&s1r.applied===false&&s1r.page.rev===1&&s1r.page.fields.mission==='한 사람에게 도움이 되는 한 주',s1r);
 const s2=await call(uid,{action:'savePage',opId:'op_000002',pageKey:'week-1-l',patch:{a:null,b:'두 번째'}});
 result('save-merge-and-clear',s2.ok&&s2.page.rev===2&&!('a' in s2.page.fields)&&s2.page.fields.b==='두 번째'&&s2.page.fields.mission,s2);
 const race=await Promise.all([3,4,5,6].map(i=>call(uid,{action:'savePage',opId:'op_00000'+i,pageKey:'week-1-l',patch:{['day'+(i-2)]:'일정 '+i}})));
 const afterRace=(await call(uid,{action:'open'})).pages['week-1-l'];
 result('concurrent-saves-no-lost-write',race.every(r=>r.ok)&&afterRace.rev===6&&[1,2,3,4].every(d=>afterRace.fields['day'+d]),afterRace);
 result('reject-unknown-page',(await call(uid,{action:'savePage',opId:'op_000010',pageKey:'week-53-l',patch:{a:'x'}})).error==='invalid-argument');
 result('reject-unknown-field',(await call(uid,{action:'savePage',opId:'op_000011',pageKey:'week-1-l',patch:{evil:'x'}})).error==='invalid-argument');
 result('reject-bad-score',(await call(uid,{action:'savePage',opId:'op_000012',pageKey:'lifemap-1-r',patch:{d1:11}})).error==='invalid-argument');
 result('reject-too-long',(await call(uid,{action:'savePage',opId:'op_000013',pageKey:'mission',patch:{core:'가'.repeat(2001)}})).error==='invalid-argument');
 result('reject-bad-multi',(await call(uid,{action:'savePage',opId:'op_000014',pageKey:'career',patch:{dirs:['지식과 통찰','콘텐츠와 표현','자원과 관리']}})).error==='invalid-argument');
 const sc=await call(uid,{action:'savePage',opId:'op_000015',pageKey:'lifemap-1-r',patch:{d1:7,d1n:'수면 부족',d13:3}});
 result('save-score-and-memo',sc.ok&&sc.page.fields.d1===7&&sc.page.fields.d13===3);

 const l1=await call(uid,{action:'addLog',logId:'log_000001',log:{date:'2026-10-08',text:'예상 결과를 먼저 적고 같이 실행해 봤어요'}});
 result('quick-log-stage0',l1.ok&&l1.created&&l1.log.stage===0,l1);
 const l1r=await call(uid,{action:'addLog',logId:'log_000001',log:{date:'2026-10-08',text:'예상 결과를 먼저 적고 같이 실행해 봤어요'}});
 result('quick-log-retry-idempotent',l1r.ok&&l1r.created===false,l1r);
 result('quick-log-conflict-rejected',(await call(uid,{action:'addLog',logId:'log_000001',log:{date:'2026-10-08',text:'다른 내용'}})).error==='already-exists');
 const l2=await call(uid,{action:'addLog',logId:'log_000002',log:{date:'2026-10-09',text:'두 번째',kept:'비교표 메모'}});
 result('quick-log-with-kept-stage1',l2.ok&&l2.log.stage===1&&l2.log.kept==='비교표 메모');
 const k=await call(uid,{action:'keepLog',logId:'log_000001',kept:'예상·실제 비교 메모'});
 result('keep-raises-stage-to-1-only',k.ok&&k.log.stage===1&&k.log.kept==='예상·실제 비교 메모',k);
 result('stages-2-5-not-self-claimable',!('setStage' in {})&&(await call(uid,{action:'setStage',logId:'log_000001',stage:4})).error==='invalid-argument');
 const re=await call(uid,{action:'open'});
 result('reopen-same-data-newest-first',re.logs.map(l=>l.id).join()==='log_000002,log_000001'&&re.pages['week-1-l'].rev===6&&re.meta.startDate==='2026-10-08',re.logs);
 const ot=await call(other.localId,{action:'open'});
 result('other-user-sees-nothing',ot.ok&&!Object.keys(ot.pages).length&&!ot.logs.length&&ot.meta===null);
 result('other-user-cannot-keep-or-delete',(await call(other.localId,{action:'keepLog',logId:'log_000001',kept:'x'})).error==='not-found'&&(await call(other.localId,{action:'deleteLog',logId:'log_000001',confirm:true})).ok&&(await db('diary/'+uid+'/logs/log_000001').get()).exists());

 const url=(p,tok)=>'http://'+process.env.FIREBASE_DATABASE_EMULATOR_HOST+'/'+p+'.json?ns='+ns+'&auth='+encodeURIComponent(tok);
 const dr=await fetch(url('diary/'+uid,owner.idToken)),dw=await fetch(url('diary/'+uid+'/pages/mission',owner.idToken),{method:'PUT',body:JSON.stringify({doc:'{}'})}),dd=await fetch(url('diary/'+uid,owner.idToken),{method:'DELETE'});
 result('rules-deny-direct-client-read-write-delete',dr.status===401&&dw.status===401&&dd.status===401&&(await db('diary/'+uid+'/meta').get()).exists(),{r:dr.status,w:dw.status,d:dd.status});
 result('report-and-program-never-modified',JSON.stringify((await db('reports/'+uid+'/'+sid).get()).val())+JSON.stringify((await db('programs/'+uid+'/'+sid).get()).val())===before);

 result('delete-log-needs-confirm',(await call(uid,{action:'deleteLog',logId:'log_000002'})).error==='failed-precondition');
 result('delete-log',(await call(uid,{action:'deleteLog',logId:'log_000002',confirm:true})).ok&&(await call(uid,{action:'open'})).logs.length===1);
 result('reset-needs-phrase',(await call(uid,{action:'reset',confirm:true})).error==='failed-precondition');
 result('reset-clears-diary-keeps-report',(await call(uid,{action:'reset',confirm:'다이어리 비우기'})).ok&&!(await db('diary/'+uid).get()).exists()&&(await db('reports/'+uid+'/'+sid).get()).exists());
 {const idx=fs.readFileSync(path.join(root,'functions/index.js'),'utf8');result('module-exported-once-as-diary',(idx.match(/_diary_module/g)||[]).length===1&&/^exports\.diary = require\("\.\/_diary_module\.js"\)\.diary;$/m.test(idx));}
 result('schema-copy-byte-identical',fs.readFileSync(path.join(root,'functions/_diary_schema.js'),'utf8')===fs.readFileSync(path.join(root,'assets/js/diary-schema.js'),'utf8'));
 const failed=results.filter(r=>!r.ok);console.log(JSON.stringify({passed:results.length-failed.length,failed:failed.length,scope:'local emulators, real RTDB rules, synthetic accounts'}));
 process.exit(failed.length?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
