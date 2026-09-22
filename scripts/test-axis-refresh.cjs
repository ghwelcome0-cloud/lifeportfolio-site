'use strict';
// Executes the actual personal refresh with isolated synthetic transports only.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const T=require('./test-response-evidence.cjs'),R=require('../assets/js/response-evidence.js'),P=require('../assets/js/program-engine.js');
const root=path.resolve(__dirname,'..'),questions=require('../data/questions.json'),rules=require('../data/program-rules.json');
const html=fs.readFileSync(path.join(root,'report.html'),'utf8');
const start=html.indexOf('    async function regenerateFourAxes('),end=html.indexOf('    // ── 명시적 개인 재생성',start);assert.ok(start>0&&end>start);
const functionSource=html.slice(start,end);
const copy=x=>JSON.parse(JSON.stringify(x));let passed=0;
function fixture(mode,lang='ko'){
 const answers=T.base(0);answers.Q39=['기타 (직접 입력)'];answers.Q40='입문 개발자에게 오류 원인을 코드 실행으로 설명합니다.';
 let stored={sid:'s_old',generatedAt:17,editCount:2,lastEditedAt:20,lang,manualReportStatus:'auto',manualOverrideHtml:null,report:T.build(answers,lang,null).r};
 if(mode==='manual')stored.manualOverrideHtml='<p>Reviewed</p>';
 const before=copy(stored),user={uid:'synthetic',getIdToken:async()=> 'synthetic-only'},writes=[],renders=[],status=[];
 const session={answers:mode==='no-answers'?{}:answers,lang},initial=JSON.stringify(session);
 const c=vm.createContext({console,JSON,Number,Math,AbortController,AbortSignal,setTimeout,clearTimeout,encodeURIComponent,auth:{currentUser:user},window:{LPResponseEvidence:mode==='missing-module'?null:R},currentReport:stored.report,_RTDB_BASE_RPT:'https://synthetic.invalid',_T_RPT:{idtoken:100,restMs:1000},_withTimeoutRpt:p=>p,
  renderReport:r=>renders.push(r),setStatus:(...s)=>status.push(s),
  fetch:async(url,options={})=>{
   if(url.startsWith('data/')){if(mode==='account-change')c.auth.currentUser={uid:'other'};return {ok:mode!=='questions-fail',json:async()=>questions};}
   assert.ok(url.startsWith('https://synthetic.invalid/reports/synthetic/s_old.json?auth='));
   if(options.method==='PUT'){
    writes.push(copy(options));assert.equal(options.headers['If-Match'],'"revision-1"');
    if(mode==='conflict'){stored={...stored,manualOverrideHtml:'Concurrent manual edit'};return {ok:false,status:412,json:async()=>stored};}
    if(mode==='denied')return {ok:false,status:403,json:async()=>({error:'denied'})};
    stored=JSON.parse(options.body);stored.lastEditedAt=100;
    if(mode==='lost-response')throw Error('acknowledgment lost');
    return {ok:true,status:200,json:async()=>copy(stored)};
   }
   return {ok:mode!=='read-fail',status:mode==='read-fail'?403:200,headers:{get:()=>mode==='no-etag'?null:'"revision-1"'},json:async()=>copy(stored)};
  }});
 c.window.__renderLivingBook=r=>renders.push(r);
 vm.runInContext(functionSource+';globalThis.refresh=regenerateFourAxes;',c);
 return {c,user,session,before,writes,renders,status,stored:()=>stored,assertSession:()=>assert.equal(JSON.stringify(session),initial)};
}
(async()=>{
 for(const lang of ['ko','en'])for(const mode of ['normal','manual','missing-module','no-answers','questions-fail','account-change','conflict','denied','no-etag','read-fail','lost-response']){
  const f=fixture(mode,lang);let error;try{await f.c.refresh(f.user,'s_old',f.session);}catch(e){error=e;}
  const success=['normal','lost-response'].includes(mode);
  if(success){assert.equal(error,undefined);assert.equal(f.writes.length,1);assert.equal(f.renders.length,2);const r=copy(f.stored().report);assert.equal(r._axisProjection.version,'axis-projection-v1');assert.equal(r._axisProjection.lang,lang);delete r._axisProjection;assert.deepEqual(r,f.before.report);assert.equal(f.stored().generatedAt,17);assert.equal(f.stored().editCount,3);
   const again=JSON.stringify(f.stored());await f.c.refresh(f.user,'s_old',f.session);assert.equal(f.writes.length,1,'idempotent refresh must not write twice');assert.equal(JSON.stringify(f.stored()),again);
  }else{assert.ok(error,mode);assert.equal(f.renders.length,0);if(mode==='conflict'){assert.equal(f.stored().manualOverrideHtml,'Concurrent manual edit');assert.deepEqual(f.stored().report,f.before.report);}else assert.deepEqual(f.stored(),f.before);if(!['conflict','denied'].includes(mode))assert.equal(f.writes.length,0);}
  f.assertSession();passed++;console.log('PASS axis refresh',lang,mode);
 }
 // The projection is the ONLY report addition; all program content remains equal.
 for(const version of [null,'input-v2'])for(const lang of ['ko','en']){
  const a=T.base(7),old=T.build(a,lang,version).r,baseline=JSON.stringify(old),next=R.attachAxes(old,questions,a);
  const trimmed=copy(next);delete trimmed._axisProjection;assert.equal(JSON.stringify(trimmed),baseline);assert.equal(JSON.stringify(old),baseline);
  const normalize=p=>{delete p.meta.generatedAt;return p;};
  assert.deepEqual(normalize(P.build({report:old,rules,lang,publishedAt:new Date(10)})),normalize(P.build({report:next,rules,lang,publishedAt:new Date(10)})));
  for(const s of next.sections)assert.deepEqual(s,old.sections.find(x=>x.id===s.id));passed++;
 }
 // Explicit personal action routes into the scoped helper; automatic repair never does.
 const regenStart=html.indexOf('    async function regenerateReport(automatic = false) {'),regenEnd=html.indexOf('    // ── [P1.5-6단계]',regenStart),regeneration=html.slice(regenStart,regenEnd);
 for(const automatic of [false,true]){
  let scoped=0;const user={uid:'synthetic'},c=vm.createContext({console,setTimeout:()=>0,URLSearchParams,auth:{currentUser:user},currentReport:{sections:[]},window:{},confirm:()=>true,alert:()=>{},location:{search:'?sid=s_old'},regenBtn:{textContent:'regenerate',addEventListener(){}},_t:(_k,v)=>v,_safeGet:async p=>({exists:()=>true,val:()=>p.startsWith('responses/')?{answers:{Q1:'fixture'},meta:{}}:null}),regenerateFourAxes:async()=>{scoped++;},setStatus:()=>{},statusBox:{style:{}}});
  vm.runInContext(regeneration+';globalThis.run=regenerateReport;',c);await c.run(automatic);assert.equal(scoped,automatic?0:1);passed++;
 }
 console.log('PASS '+passed+' actual refresh/preservation contracts; no live customer/network access');
})().catch(e=>{console.error(e);process.exitCode=1});
