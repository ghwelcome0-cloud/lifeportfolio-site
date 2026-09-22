'use strict';
// Observational audit, NOT a semantic-validity gate. Synthetic data only.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const E = require('../assets/js/report-engine.js'), V = require('../assets/js/report-engine-v4.js');
const P = require('../assets/js/program-engine.js');
const questions = require('../data/questions.json'), mapping = require('../data/mapping.json');
const rules = require('../data/report-rules.json'), careerRules = require('../data/career-rules.json');
const programRules = require('../data/program-rules.json');
const qs = questions.sections.flatMap(s => s.questions), others = qs.filter(q => q.hasOther);
const survey = fs.readFileSync(path.join(root, 'suvey.html'), 'utf8');
const reportHTML = fs.readFileSync(path.join(root, 'report.html'), 'utf8');
const stringify = x => JSON.stringify(x), copy = x => JSON.parse(stringify(x));
function extract(s, a, b) { const start = s.indexOf(a), end = s.indexOf(b, start); assert.ok(start >= 0 && end > start, a); return s.slice(start, end); }
function clean(x) {
  if (Array.isArray(x)) return x.map(clean);
  if (!x || typeof x !== 'object') return x;
  return Object.fromEntries(Object.keys(x).sort().filter(k => !/^(fp|fingerprint|fingerprint64|generatedAt|submittedAt|timestamp|createdAt|updatedAt)$/.test(k)).map(k => [k, clean(x[k])]));
}
const same = (a,b) => stringify(clean(a)) === stringify(clean(b));
const content = (r,id) => r.sections.find(s => s.id === id)?.content || {};
const reader = vm.createContext({});
vm.runInContext(extract(reportHTML, '    function axisReaderView(', '    function renderReport('), reader);
const axes = ['self_understanding','self_expression','self_design','self_execution'];
// A diagnostic counterfactual freezes ONLY hash-derived variants in an isolated VM.
// Production functions/files are never changed. Natural output is measured separately.
let controlSource = fs.readFileSync(path.join(root,'assets/js/report-engine-v4.js'),'utf8');
for (const [from,to] of [
  ['var fp = fullAnswerFingerprint(answers, mapping);','var fp = globalThis.__auditFp;'],
  ['var fp64 = fullAnswerFingerprint64(answers, mapping);','var fp64 = globalThis.__auditFp64;']
]) { assert.equal(controlSource.split(from).length,2); controlSource = controlSource.replace(from,to); }
const controlContext = vm.createContext({module:{exports:{}},console,require:require('node:module').createRequire(path.join(root,'assets/js/report-engine-v4.js'))});
vm.runInContext(controlSource, controlContext);
const VC = controlContext.module.exports;
const pairs = {
 Q8:['혼자 기록한 생각을 다시 읽을 때','다른 사람과 공동 문제를 해결할 때'],
 Q15:['동료의 비밀을 지켜야 했을 때','실수를 숨기지 않고 설명해야 했을 때'],
 Q20:['이사 후 새로운 관계를 만든 경험','프로젝트 실패 후 방향을 바꾼 경험'],
 Q22:['조용히 산책하며 생각을 기록한다','믿을 만한 사람에게 상황을 설명한다'],
 Q27:['말하기 전에 호흡하고 메모한다','잠시 자리를 옮겨 몸을 움직인다'],
 Q29:['구체적인 사례를 들어 차분히 말한다','그림과 짧은 글로 감정을 전한다'],
 Q32:['복잡한 이야기를 차분하게 정리한다','처음 온 사람이 참여하기 편하게 돕는다'],
 Q34:['서로 약속한 경계를 존중하는 것','의견이 달라도 질문하며 이해하는 것'],
 Q40:['초보자의 운동 동작을 관찰해 기록하기','경기 장면의 선택지를 비교해 설명하기'],
 Q42:['처음 운동하는 사람의 부상 예방','지역에서 혼자 사는 사람의 식사 지원'],
 Q48:['집 근처 나무 그늘의 조용한 벤치','화이트보드가 있는 작은 공동 작업실'],
 Q50:['아침 식사 후 짧게 집중하고 쉬기','저녁 산책 후 한 가지씩 마무리하기'],
 Q56:['도움을 요청한 사람의 문제를 이해했을 때','직접 시험할 수 있는 구체적인 질문이 생길 때'],
 Q58:['작은 기록을 동료와 매주 확인했다','무리하지 않고 정해진 시간에 반복했다'],
 Q64:['주변 사람의 안전을 해치지 않는가','지금 가진 자원으로 계속할 수 있는가'],
 Q66:['같은 상황을 겪은 동료의 경험','함께 책임질 가족과의 대화'],
 Q72:['매일 한 단계를 기록하며 확인하기','동료와 역할을 나누고 진행을 점검하기'],
 Q74:['처음 배우는 사람이 스스로 해냈을 때','고친 절차가 다음에도 잘 작동했을 때'],
 Q76:['지역 생활체육 접근성 연구','작은 공동체의 식생활 기록'],
 Q78:['처음 하는 사람이 따라할 안내를 만들기','실제 사례를 비교해 개선 기준을 정리하기']
};
function base(seed) {
 const a={Q1:'Synthetic Conditional Audit',Q2:'email'};
 qs.forEach((q,i)=>{if(q.type==='likert')a[q.id]=1+(seed+i)%5;else if(q.options?.length){const n=(seed+i)%q.options.length;a[q.id]=q.type==='multi_choice'?[q.options[n]]:q.options[n];}});
 return a;
}
function build(a,lang='ko',control=false) {
 const before=stringify(a),input={questions,mapping,rules,careerRules,answers:a,profile:{name:'Synthetic Conditional Audit',submittedAt:10},lang};
 const raw=E.build(input),natural=V.upgrade(raw,input);let r=natural;
 if(control){
  controlContext.__auditFp=natural._v4Meta.fingerprint;controlContext.__auditFp64=natural._v4Meta.fingerprint64;
  assert.ok(same(natural,VC.upgrade(raw,input)),'Isolated VM must reproduce natural production output with natural seeds');
  controlContext.__auditFp=1234567;controlContext.__auditFp64='0123456789abcdef';r=VC.upgrade(raw,input);
 }
 const p=P.build({report:r,rules:programRules,name:'Synthetic Conditional Audit',lang});
 assert.equal(stringify(a),before,'Input mutation');
 return {raw,r,p,views:axes.map(k=>reader.axisReaderView(r,k,content(r,k),lang))};
}
const changedFields=(a,b)=>[...new Set([...Object.keys(a||{}),...Object.keys(b||{})])].filter(k=>!same(a?.[k],b?.[k]));
function compare(a,b) {
 return {scoreAxes:changedFields(a.r.scores.axisPct,b.r.scores.axisPct),
  sourceFields:changedFields(content(a.r,'execution_profile')._strategy?.source,content(b.r,'execution_profile')._strategy?.source),
  rawSections:a.raw.sections.filter(s=>!same(s.content,content(b.raw,s.id))).map(s=>s.id),
  reportSections:a.r.sections.filter(s=>!same(s.content,content(b.r,s.id))).map(s=>s.id),
  programChanged:!same(a.p,b.p),readerChanged:!same(a.views,b.views),
  fingerprintChanged:a.r._v4Meta.fingerprint64!==b.r._v4Meta.fingerprint64};
}
function engineProbes() {
const probes=[];
for(const seed of [0,7,13]) for(const lang of ['ko','en']) for(const q of others) {
 const a=base(seed);a[q.id]=q.type==='multi_choice'?[a[q.id][0],'기타 (직접 입력)']:'기타 (직접 입력)';
 a[q.otherId]=pairs[q.otherId][0];const b=copy(a);b[q.otherId]=pairs[q.otherId][1];
 const old=build(a,lang),next=build(b,lang),ca=build(a,lang,true),cb=build(b,lang,true);
 const n1=copy(a),n5=copy(a),space=copy(a);n1[q.otherId]='1';n5[q.otherId]='5';space[q.otherId]='   ';
 probes.push({seed,lang,parent:q.id,qid:q.otherId,text:q.text,mapping:mapping.questionMapping[q.otherId],
  natural:compare(old,next),hashControlled:compare(ca,cb),
  scoreType:E.computeScores(questions,mapping,a).perQ[q.otherId].type,textNorm:E.computeScores(questions,mapping,a).perQ[q.otherId].raw,
  numeric1Norm:E.computeScores(questions,mapping,n1).perQ[q.otherId].raw,numeric5Norm:E.computeScores(questions,mapping,n5).perQ[q.otherId].raw,
  whitespaceNorm:E.computeScores(questions,mapping,space).perQ[q.otherId].raw,
  numericTextScoreAxes:compare(build(n1,lang),build(n5,lang)).scoreAxes,
  verbatimInStrategy:stringify(content(old.r,'execution_profile')._strategy).includes(a[q.otherId]),
  verbatimInProgram:stringify(old.p).includes(a[q.otherId])});
}
return probes;
}
// Production autosave/submit handlers, entirely synthetic transports and timers.
const saveCode=extract(survey,'    async function saveProgress(){','    // ============== 답안 카운트');
const submitCode=extract(survey,'    submitBtn.addEventListener("click", async () => {','    async function getAppsScriptUrl(){');
const restoreCode=extract(survey,'      answers = (data && data.answers) ? data.answers : {};','      // 이메일 자동 채움');
async function transport(mode) {
 const a=base(0);others.forEach(q=>{a[q.id]=q.type==='multi_choice'?['기타 (직접 입력)']:'기타 (직접 입력)';a[q.otherId]=pairs[q.otherId][0];});
 const writes=[],nav=[],errors=[];let handler;
 const user={uid:'synthetic',email:'synthetic@example.invalid',getIdToken:async()=> 'synthetic'};
 const loc={href:'https://synthetic.invalid/suvey?lang=ko',replace:p=>nav.push(p)};
 const c=vm.createContext({console:{log(){},warn(){},error(...x){errors.push(x.map(String).join(' '));}},URL,Promise,encodeURIComponent,
  setTimeout:()=>1,clearTimeout(){},currentUser:user,sessionId:'s_synthetic',answers:copy(a),lastSavedSnapshot:'',groupSessionMode:mode==='group',
  window:{location:loc},location:loc,document:{documentElement:{lang:'ko'}},QLOG_ENABLED:false,currentStep:1,STEP_MODEL_V2:'v2',_safeQCursor:()=>1,_qOrderTag:'fixture',
  _lpDbg(){},setSaveStatus(){},serverTimestamp:()=>({'.sv':'timestamp'}),db:{},ref:(_d,p)=>p,
  update:async(p,v)=>{if(mode==='rest')throw Error('synthetic SDK failure');writes.push({kind:'sdk',value:copy(v)});},
  fetch:async(u,o)=>{assert.ok(u.startsWith('https://synthetic.invalid/'));writes.push({kind:'rest',value:JSON.parse(o.body)});return {ok:true};},
  firebaseConfig:{databaseURL:'https://synthetic.invalid'},_queueGroupSave:async v=>{writes.push({kind:'group',value:copy(v)});return {accepted:true};},
  _showGroupSubmitted(){},_t:(_k,v)=>v,_surfaceLang:()=> 'ko',_qlogBlur(){},saveTimer:null,
  submitBtn:{disabled:false,addEventListener:(_e,fn)=>handler=fn},prevBtn:{},nextBtn:{},questionsData:questions,totalSteps:13,QFLAT:qs,
  confirm:()=>true,alert:x=>{throw Error(x);},renderStep(){},META_STEP:0,
  _restPatch:async(p,v)=>{if(mode==='sdk')return false;writes.push({kind:'submit-rest',value:copy(v)});return true;},
  _restPut:async()=>true,_withTimeout:async p=>p,getAppsScriptUrl:async()=>null});
 vm.runInContext(saveCode+submitCode,c);
 await c.saveProgress();assert.equal(writes.length,1);assert.equal(stringify(writes[0].value.answers),stringify(a));
 c.data={answers:copy(writes[0].value.answers)};c.answers={};vm.runInContext(restoreCode,c);assert.equal(stringify(c.answers),stringify(a));
 await handler();assert.equal(writes.length,2);assert.equal(writes[1].value.status,'submitted');assert.equal(stringify(writes[1].value.answers),stringify(a));assert.equal(nav.length,1);assert.equal(errors.length,0,errors.join('\n'));
 return {mode,conditionalInputs:others.length,autosave:writes[0].kind,submit:writes[1].kind,roundTripExact:true,realNetworkRequests:0};
}
function coreProbes() {
 const out=[];
 for(const seed of [0,7,13])for(const lang of ['ko','en'])for(const q of qs){
  const a=base(seed),b=copy(a);
  if(q.type==='likert')b[q.id]=a[q.id]%5+1;
  else if(q.options?.length){const old=q.type==='multi_choice'?a[q.id][0]:a[q.id];const next=q.options[(q.options.indexOf(old)+1)%q.options.length];b[q.id]=q.type==='multi_choice'?[next]:next;}
  else throw Error('Uncovered core type: '+q.id);
  out.push({seed,lang,qid:q.id,type:q.type,mapping:mapping.questionMapping[q.id],natural:compare(build(a,lang),build(b,lang)),hashControlled:compare(build(a,lang,true),build(b,lang,true))});
 }
 return out;
}
async function main() {
 const probes=engineProbes(),core=coreProbes();
 const transports=[];for(const mode of ['sdk','rest','group'])transports.push(await transport(mode));
 const result={schema:1,scope:'Synthetic engine probes and extracted production handlers; not customer data or validated semantic interpretation.',
  sourceHashes:Object.fromEntries(['suvey.html','report.html','program.html','assets/js/report-engine.js','assets/js/report-engine-v4.js','assets/js/program-engine.js','data/questions.json','data/mapping.json'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')])),
  pairs,transports,probes,coreProbes:core,summary:{coreQuestions:qs.length,conditionalInputs:others.length,pairedProbes:probes.length,corePairedProbes:core.length,
   coreQidsWithoutControlledContentChange:qs.filter(q=>!core.some(p=>p.qid===q.id&&(p.hashControlled.reportSections.length||p.hashControlled.programChanged))).map(q=>q.id),
   qidsWithHashControlledReportChange:[...new Set(probes.filter(p=>p.hashControlled.reportSections.length).map(p=>p.qid))],
   qidsWithHashControlledProgramChange:[...new Set(probes.filter(p=>p.hashControlled.programChanged).map(p=>p.qid))],
   qidsWithHashControlledReaderChange:[...new Set(probes.filter(p=>p.hashControlled.readerChanged).map(p=>p.qid))],
   qidsWithNumericTextScoreChange:[...new Set(probes.filter(p=>p.numericTextScoreAxes.length).map(p=>p.qid))]},
  limits:['Hash-controlled results freeze V4 32/64-bit fingerprints only; original E internal hashes remain. VM parity with natural seeds is asserted for every controlled build. These are diagnostic counterfactuals, never production outputs.','A changed section/program does not prove semantic correctness. Verbatim retention is not interpretation.','No production rules, Auth, purchase entitlement, customer data or live submission is tested.','UI and rendered book comparisons are measured by audit-conditional-browser.cjs separately.']};
 assert.equal(qs.length,56);assert.equal(others.length,20);assert.equal(probes.length,120);assert.equal(core.length,336);
 if(process.argv[2])fs.writeFileSync(path.resolve(process.argv[2]),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result.summary,null,2));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={root,questions,qs,others,pairs,base,build,extract,survey,reportHTML,copy,same};
