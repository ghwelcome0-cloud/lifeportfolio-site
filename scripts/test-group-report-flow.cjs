'use strict';
// Executes extracted production functions with synthetic Auth/RTDB transports.
// Full inline scripts are syntax-checked; no real account, payment or inbox access.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const survey=fs.readFileSync(path.join(root,'suvey.html'),'utf8');
const loading=fs.readFileSync(path.join(root,'report-loading.html'),'utf8');
const mypage=fs.readFileSync(path.join(root,'mypage.html'),'utf8');
let passed=0;
async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
function extract(source,start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a);return source.slice(a,b);}
function context(extra={}){return vm.createContext({console:{log(){},warn(){},error(){}},URL,URLSearchParams,AbortSignal,setTimeout,clearTimeout,encodeURIComponent,...extra});}
(async()=>{
for(const file of ['suvey.html','report-loading.html','mypage.html','b2b-admin.html'])await test('inline-syntax-'+file,()=>{
 const html=fs.readFileSync(path.join(root,file),'utf8');
 for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
  if(/src=|application\/(?:ld\+)?json/i.test(m[1]))continue;
  const js=m[2].replace(/import\s+[\s\S]*?from\s+["'][^"']+["'];/g,'');new vm.Script(js,{filename:file});
 }
});
const boot=extract(survey,'    async function bootstrapSurvey(user, opts){','      // ── [Phase C] 문항 순서 셔플')+'return {sid,data};\n}';
for(const mode of ['new-group','submitted-group','group-failure','personal-completed'])await test('bootstrap-'+mode,async()=>{
 const user={uid:'synthetic'},calls=[];const loc={search:mode==='personal-completed'?'':'?b2b=1',replace:u=>calls.push(['navigate',u])};
 const c=context({auth:{currentUser:user},window:{location:loc},location:loc,currentUser:null,sessionId:null,groupSessionMode:false,_bootstrapStarted:false,
 _isGroupEntry:()=>mode!=='personal-completed',checkB2BAccess:async()=>false,_addPayFns:{},
 httpsCallable:()=>async data=>{calls.push(['call',data]);if(mode==='group-failure')throw Error('offline');return {data:{survey:{sid:'s_123_group',data:{status:mode==='submitted-group'?'submitted':'in_progress',meta:{source:'b2b'}}}}};},
 _withTimeout:async p=>p,db:{},ref:(_d,p)=>p,get:async p=>{calls.push(['get',p]);return {exists:()=>true,val:()=>({s_1_old:{report:{sections:{one:'personal'}}}})};},
 showReportDoneNotice:()=>calls.push(['done']),showError:()=>calls.push(['error']),_t:(_k,v)=>v,_surfaceLang:()=> 'ko',
 loadQuestionsJson:async()=>{},getOrCreateSession:async()=>{calls.push(['personal-session']);return {sid:'s_1_personal',data:{status:'in_progress'}};}});
 vm.runInContext(boot+';globalThis.boot=bootstrapSurvey;',c);const value=await c.boot(user,{});
 if(mode==='new-group'){assert.equal(value.sid,'s_123_group');assert.ok(!calls.some(x=>['done','get','personal-session'].includes(x[0])));}
 if(mode==='submitted-group'){assert.ok(calls.some(x=>x[0]==='navigate'&&x[1].includes('sid=s_123_group')));assert.ok(!calls.some(x=>x[0]==='done'));}
 if(mode==='group-failure'){assert.ok(calls.some(x=>x[0]==='error'));assert.ok(!calls.some(x=>['navigate','personal-session','done'].includes(x[0])));}
 if(mode==='personal-completed')assert.ok(calls.some(x=>x[0]==='done'));
});
const groupWriter=extract(survey,'    async function _conditionalGroupSave(uid, sid, payload) {','    function _showGroupSubmitted() {');
function groupStore() {
 let value={status:'in_progress',answers:{Q1:'Initial'},meta:{source:'b2b',b2bOrderId:'test-order'}},version=0;
 const state={writes:0,hold:null,release:null,arrived:null,value:()=>structuredClone(value)};
 state.tab=name=>{
  const user={uid:'synthetic',getIdToken:async()=> 'synthetic-token'};
  const c=context({auth:{currentUser:user},currentUser:user,sessionId:'s_123_group',groupRevision:0,groupSaveQueue:Promise.resolve(),firebaseConfig:{databaseURL:'https://synthetic.invalid'},_withTimeout:async p=>p,
   fetch:async(_url,options={})=>{
    if(!options.method){const copy=structuredClone(value),tag='"'+version+'"';return {ok:true,json:async()=>copy,headers:{get:()=>tag}};}
    if(state.hold===name){state.arrived?.();await new Promise(r=>state.release=r);state.hold=null;}
    if(options.headers['If-Match']!=='"'+version+'"')return {ok:false,status:412};
    value=JSON.parse(options.body);version++;state.writes++;
    if(state.lose===name){state.lose=null;throw Error('lost response');}
    return {ok:true,json:async()=>structuredClone(value)};
   }});
  vm.runInContext(groupWriter+';globalThis.save=_queueGroupSave;',c);return c;
 };return state;
}
await test('group-A-submit-then-B-stale-autosave',async()=>{const s=groupStore(),a=s.tab('A'),b=s.tab('B');await a.save({status:'submitted',answers:{Q1:'Final A'},submittedAt:10});const r=await b.save({status:'in_progress',answers:{Q1:'Old B'}});assert.equal(r.finalized,true);assert.equal(s.value().status,'submitted');assert.equal(s.value().answers.Q1,'Final A');assert.equal(s.writes,1);});
await test('group-A-submit-then-B-different-submission',async()=>{const s=groupStore(),a=s.tab('A'),b=s.tab('B');await a.save({status:'submitted',answers:{Q1:'Final A'},submittedAt:10});await b.save({status:'submitted',answers:{Q1:'Final B'},submittedAt:20});assert.equal(s.value().answers.Q1,'Final A');assert.equal(s.value().submittedAt,10);assert.equal(s.writes,1);});
for(const final of [false,true])await test('group-delayed-B-write-after-A-final-'+final,async()=>{const s=groupStore(),a=s.tab('A'),b=s.tab('B');s.hold='B';const arrived=new Promise(r=>s.arrived=r);const delayed=b.save({status:final?'submitted':'in_progress',answers:{Q1:'Stale B'},submittedAt:20});await arrived;await a.save({status:'submitted',answers:{Q1:'Final A'},submittedAt:10});s.release();const r=await delayed;assert.equal(r.finalized,true);assert.equal(s.value().answers.Q1,'Final A');assert.equal(s.value().submittedAt,10);assert.equal(s.writes,1);});
for(const first of ['A','B'])await test('group-concurrent-submission-'+first,async()=>{const s=groupStore(),a=s.tab('A'),b=s.tab('B');const tasks=first==='A'?[a.save({status:'submitted',answers:{Q1:'A'}}),b.save({status:'submitted',answers:{Q1:'B'}})]:[b.save({status:'submitted',answers:{Q1:'B'}}),a.save({status:'submitted',answers:{Q1:'A'}})];const r=await Promise.all(tasks);assert.equal(s.writes,1);assert.equal(s.value().status,'submitted');assert.equal(r.filter(x=>x.accepted).length,1);assert.equal(r.filter(x=>x.finalized).length,1);});
await test('group-same-tab-save-queue-before-submit',async()=>{const s=groupStore(),a=s.tab('A');await Promise.all([a.save({status:'in_progress',answers:{Q1:'Draft'}}),a.save({status:'submitted',answers:{Q1:'Final'},submittedAt:10})]);assert.equal(s.value().answers.Q1,'Final');assert.equal(s.value().status,'submitted');assert.equal(s.value().meta.revision,2);});
await test('group-stale-revision-before-submit-rejected',async()=>{const s=groupStore(),a=s.tab('A'),b=s.tab('B');await a.save({status:'in_progress',answers:{Q1:'Draft A'}});await assert.rejects(b.save({status:'in_progress',answers:{Q1:'Old B'}}));assert.equal(s.value().answers.Q1,'Draft A');});
await test('group-lost-submit-response-does-not-resubmit',async()=>{const s=groupStore(),a=s.tab('A');s.lose='A';const r=await a.save({status:'submitted',answers:{Q1:'Final'},submittedAt:10});assert.equal(r.accepted,true);await a.save({status:'submitted',answers:{Q1:'Changed'},submittedAt:20});assert.equal(s.value().answers.Q1,'Final');assert.equal(s.value().submittedAt,10);assert.equal(s.writes,1);});
const helpers=extract(loading,'    function _reportReady(value)','    async function runPipeline(user, sid){');
const pipeline=extract(loading,'    async function runPipeline(user, sid){','    // i18n runtime');
const sid='s_123_group',uid='synthetic';
const generated={version:'v4',engineVersion:'v4.1',tone:{key:'sample'},pdfFilename:'synthetic.pdf',sections:{one:'Generated'},profile:{name:'Synthetic',submittedAt:10},lang:'ko'};
function storeContext(flags={}){
 let report=flags.existing||null,index=flags.index||null;const requests=[],progress=[],nav=[];
 const session={status:'submitted',name:'Synthetic',answers:{Q1:'Synthetic'},submittedAt:10,lang:'ko',meta:{source:'b2b',b2bOrderId:'test-order'}};
 const c=context({auth:{currentUser:{uid,getIdToken:async()=> 'synthetic-token'}},db:{},ref:(_d,p)=>p,firebaseConfig:{databaseURL:'https://synthetic.invalid'},
 _withTimeout:async p=>p,_readNode:async(_u,p)=>{if(p.startsWith('responses/'))return {exists:true,val:session};const v=p.startsWith('reports/')?report:index;return {exists:!!v,val:v};},
 _restWrite:async(_u,p,m,b)=>{requests.push({kind:'index',body:b});if(flags.indexFail)return false;index=JSON.parse(JSON.stringify(b));return true;},
 fetch:async(url,opts={})=>{
  if(url.startsWith('data/'))return {json:async()=>({})};
  requests.push({kind:opts.method||'GET',headers:opts.headers});
  if(!opts.method)return {ok:!flags.readFail,json:async()=>report,headers:{get:()=>flags.noEtag?null:'"test-etag"'}};
  assert.equal(opts.headers['If-Match'],'"test-etag"');
  if(flags.competingManual){report={manualOverrideHtml:'Manual preserved',generatedAt:7};return {ok:false,status:412};}
  if(flags.writeFail)return {ok:false,status:403};
  report=JSON.parse(opts.body);report.generatedAt=100;report.lastEditedAt=100;
  if(flags.lostResponse)throw Error('timeout after commit');return {ok:true,json:async()=>report};
 },window:{ReportEngine:{build:()=>structuredClone(generated)},ReportEngineV4:{upgrade:r=>r}},loadEngine:async()=>{},
 location:{href:'https://synthetic.invalid/report-loading?sid='+sid},document:{documentElement:{lang:'ko'}},
 setStage:()=>{},setProgress:p=>progress.push(p),showError:e=>{throw Error(e);},_t:(_k,v)=>v,_gotoReportOrHook:()=>nav.push(sid)});
 vm.runInContext(helpers+pipeline+';globalThis.run=runPipeline;globalThis.create=_createReportOnce;globalThis.index=_ensureReportIndex;',c);
 return {c,requests,progress,nav,report:()=>report,index:()=>index};
}
for(const mode of ['normal','writeFail','readFail','noEtag','indexFail','lostResponse','competingManual'])await test('pipeline-'+mode,async()=>{
 const t=storeContext({[mode]:true});let error;try{await t.c.run({uid,email:'synthetic@example.invalid'},sid);}catch(e){error=e;}
 if(['writeFail','readFail','noEtag','indexFail'].includes(mode)){assert.ok(error);assert.ok(!t.progress.includes(100));assert.equal(t.nav.length,0);}
 else {assert.equal(error,undefined);assert.ok(t.progress.includes(100));assert.equal(t.nav.length,1);assert.equal(t.index().sid,sid);}
 if(mode==='competingManual')assert.equal(t.report().manualOverrideHtml,'Manual preserved');
 if(mode==='normal')assert.equal(t.report().report._participation.source,'b2b');
 if(mode==='indexFail'){assert.ok(t.report());assert.equal(t.index(),null);}
});
await test('existing-manual-repairs-index-without-body-write',async()=>{const t=storeContext({existing:{manualOverrideHtml:'keep',generatedAt:7}});await t.c.run({uid},sid);assert.equal(t.requests.filter(x=>x.kind==='PUT').length,0);assert.equal(t.report().manualOverrideHtml,'keep');assert.equal(t.index().generatedAt,7);});
await test('index-generatedAt-immutable-preserved',async()=>{const t=storeContext({existing:{manualOverrideHtml:'keep',generatedAt:7},index:{sid,generatedAt:3}});await t.c.run({uid},sid);assert.equal(t.index().generatedAt,3);});
await test('incomplete-existing-record-never-overwritten',async()=>{const t=storeContext({existing:{editCount:9}});await assert.rejects(t.c.run({uid},sid));assert.deepEqual(t.report(),{editCount:9});assert.equal(t.requests.filter(x=>x.kind==='PUT').length,0);});
await test('account-change-prevents-write',async()=>{const t=storeContext();t.c.auth.currentUser.uid='someone-else';await assert.rejects(t.c.create(uid,sid,{report:generated}));assert.equal(t.requests.length,0);});
await test('personal-reuse-excludes-group',()=>{const c=context();vm.runInContext(extract(survey,'    function _pickReusableSession(av){','    async function getOrCreateSession')+';globalThis.pick=_pickReusableSession;',c);const r=c.pick({s_1_group:{status:'in_progress',meta:{source:'b2b',answered:50}},s_2_personal:{status:'in_progress',answers:{Q1:'keep'}}});assert.equal(r.sid,'s_2_personal');});
await test('personal-credit-does-not-count-group-submission',async()=>{const values={'payments/u/paid':true,'additionalPayments/u':{},'responses/u':{s_1_p:{status:'submitted'},s_2_g:{status:'submitted',meta:{source:'b2b'}}}};const c=context({_getWithRetry:async p=>({exists:()=>true,val:()=>values[p]})});vm.runInContext(extract(mypage,'    async function _computeEntitlement(uid){','\n    //')+';globalThis.compute=_computeEntitlement;',c);const r=await c.compute('u');assert.equal(r.used,1);assert.equal(r.purchased,1);assert.equal(r.remaining,0);});
await test('submitted-without-report-has-recovery-not-fake-complete',()=>{
 const nodes={pendingReportSection:{style:{}},pendingReportContainer:{innerHTML:''}};
 const c=context({document:{getElementById:id=>nodes[id]},_isValidSid:s=>/^s_\d+_[a-z0-9]+$/.test(s),_withLangParam:(s,l)=>s+'&lang='+l,escapeHtml:s=>String(s),formatDate:s=>String(s)});
 vm.runInContext(extract(mypage,'    function _renderPendingReports(responses, doneSids) {','    async function _renderInProgressSessions')+';globalThis.render=_renderPendingReports;',c);
 c.render({s_1_old:{status:'submitted'},s_2_group:{status:'submitted',meta:{source:'b2b'},lang:'en'},s_3_draft:{status:'in_progress'}},{s_1_old:true});
 assert.equal(nodes.pendingReportSection.style.display,'block');assert.ok(nodes.pendingReportContainer.innerHTML.includes('sid=s_2_group&lang=en'));assert.ok(!nodes.pendingReportContainer.innerHTML.includes('sid=s_1_old'));assert.ok(!nodes.pendingReportContainer.innerHTML.includes('sid=s_3_draft'));
});
const browser=await require('puppeteer').launch({headless:true,...(process.env.LP_BROWSER_PATH?{executablePath:process.env.LP_BROWSER_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
try {
 for(const width of [375,1280])await test('mypage-recovery-browser-'+width,async()=>{
  const page=await browser.newPage();await page.setViewport({width,height:900});await page.setRequestInterception(true);page.on('request',r=>r.abort());
  const styles=(mypage.match(/<style>([\s\S]*?)<\/style>/)||[])[1]||'';
  await page.setContent('<style>'+styles+'</style><section id="pendingReportSection"><div id="pendingReportContainer"></div></section><span id="reportCount"></span><div id="reportsContainer"></div>');
  const code=extract(mypage,'    function _renderPendingReports(responses, doneSids) {','    async function _renderInProgressSessions');
  await page.addScriptTag({content:'const _isValidSid=s=>/^s_\\d+_[a-z0-9]+$/.test(s);const _withLangParam=(s,l)=>s+"&lang="+l;const escapeHtml=s=>String(s).replaceAll("<","&lt;");const formatDate=s=>String(s);'+code+';_renderPendingReports({s_123_group:{status:"submitted",lang:"en",meta:{source:"b2b"}},s_99_old:{status:"submitted"}},{s_99_old:true});'});
  const link=await page.$eval('#pendingReportContainer a',e=>({href:e.getAttribute('href'),text:e.textContent,box:{left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right}}));
  assert.ok(link.href.includes('sid=s_123_group&lang=en'));assert.ok(link.text.includes('생성 이어가기'));assert.ok(link.box.left>=0&&link.box.right<=width);assert.equal(await page.$$('#pendingReportContainer article').then(a=>a.length),1);
  await page.close();
 });
} finally {await browser.close();}
console.log(JSON.stringify({passed,scope:'production function extraction and offline DOM; synthetic transports; no real customer data'}));
})().catch(e=>{console.error(e);process.exitCode=1;});
