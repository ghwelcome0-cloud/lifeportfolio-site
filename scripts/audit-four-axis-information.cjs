'use strict';
// Offline measurement, not a quality-pass gate. Only synthetic inputs; no Firebase.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),E=require('../assets/js/report-engine.js'),V=require('../assets/js/report-engine-v4.js');
const questions=require('../data/questions.json'),mapping=require('../data/mapping.json'),rules=require('../data/report-rules.json'),careerRules=require('../data/career-rules.json');
const html=fs.readFileSync(path.join(root,'report.html'),'utf8'),a=html.indexOf('    function axisReaderView('),b=html.indexOf('    function renderReport(',a);assert.ok(a>=0&&b>a);
const ctx=vm.createContext({});vm.runInContext(html.slice(a,b),ctx);
const keys=['self_understanding','self_expression','self_design','self_execution'];
const qs=questions.sections.flatMap(s=>s.questions.map(q=>({...q,section:s.key})));assert.equal(qs.length,56);
const json=x=>JSON.stringify(x),sec=(r,k)=>r.sections.find(s=>s.id===k)?.content||{};
function clean(x){if(Array.isArray(x))return x.map(clean);if(x&&typeof x==='object'){const y={};for(const k of Object.keys(x).sort()){if(/^(fp|fingerprint|fingerprint64|generatedAt|submittedAt|timestamp|createdAt|updatedAt)$/.test(k))continue;y[k]=clean(x[k]);}return y;}return x;}
function build(answers){const before=json(answers),input={questions,mapping,rules,careerRules,answers,profile:{name:'Synthetic Information Audit',submittedAt:10},lang:'ko'};const r=V.upgrade(E.build(input),input);assert.equal(json(answers),before,'Engine mutated synthetic answers');const saved=json(r),views=keys.map(k=>ctx.axisReaderView(r,k,sec(r,k),'ko'));assert.equal(json(r),saved,'Projection mutated stored report');keys.forEach((k,i)=>assert.equal(json(views[i].keywords),json(sec(r,k).keywords)));return {r,views};}
function base(seed){const answers={Q1:'Synthetic Information Audit'};for(const [i,q] of qs.entries()){if(q.type==='likert')answers[q.id]=1+(seed+i)%5;else if(q.options?.length){const n=(seed+i)%q.options.length;answers[q.id]=q.type==='multi_choice'?[q.options[n],...(q.max>=2?[q.options[(n+1)%q.options.length]]:[])]:q.options[n];}}return answers;}
function changedMap(a,b){return [...new Set([...Object.keys(a||{}),...Object.keys(b||{})])].filter(k=>json(a?.[k])!==json(b?.[k]));}
function compare(old,next){const os=sec(old.r,'execution_profile')._strategy||{},ns=sec(next.r,'execution_profile')._strategy||{};const delta=field=>keys.filter((k,i)=>json(old.views[i][field])!==json(next.views[i][field]));return {
 scoreAxes:changedMap(old.r.scores?.axisPct,next.r.scores?.axisPct),sourceFields:changedMap(os.source,ns.source),coordinateFields:changedMap(os.koCoords,ns.koCoords).filter(k=>k!=='fp'),
 engineCoreAxes:keys.filter(k=>sec(old.r,k).core!==sec(next.r,k).core),headlineAxes:delta('core'),explanationAxes:delta('detail'),keywordAxes:delta('keywords'),
 changedSectionPayloads:old.r.sections.filter(s=>json(clean(s.content))!==json(clean(sec(next.r,s.id)))).map(s=>s.id),
 fingerprintChanged:old.r._v4Meta?.fingerprint64!==next.r._v4Meta?.fingerprint64
};}
const inventory=qs.map(q=>({qid:q.id,section:q.section,type:q.type,max:q.max||null,text:q.text,rankRequested:['Q6','Q39','Q63'].includes(q.id)?false:null,rankReview:'Q6/Q39/Q63 wording reviewed: no explicit rank. Other items not inferred from max count.',mapping:mapping.questionMapping[q.id]||null,otherId:q.hasOther?q.otherId:null}));
const others=qs.filter(q=>q.hasOther).map(q=>({qid:q.otherId,parent:q.id,mapping:mapping.questionMapping[q.otherId]||null,dynamicProbe:'not run: parent/other activation contract requires separate validation'}));
const probes=[];
for(const seed of [0,7,13]){
 const answers=base(seed),old=build(answers);
 for(const q of qs){
  const variants=[];
  if(q.type==='likert')variants.push(['value',x=>x[q.id]=(x[q.id]%5)+1]);
  else if(q.options?.length){
   if(q.type==='single_choice')variants.push(['value',x=>x[q.id]=q.options[(q.options.indexOf(x[q.id])+1)%q.options.length]]);
   else if(q.type==='multi_choice'){
    variants.push(['first_selected_value',x=>{const unused=q.options.find(o=>!x[q.id].includes(o));if(unused)x[q.id][0]=unused;}]);
    if(answers[q.id].length>1){variants.push(['secondary_selected_value',x=>{const unused=q.options.find(o=>!x[q.id].includes(o));if(unused)x[q.id][1]=unused;}]);variants.push(['order_only',x=>x[q.id].reverse()]);}
   }
  }
  for(const [kind,mutate]of variants){const x=structuredClone(answers);mutate(x);if(json(x)===json(answers))continue;const result=compare(old,build(x));probes.push({seed,qid:q.id,kind,...result,headlineOrExplanationObserved:result.headlineAxes.length+result.explanationAxes.length>0});}
 }
}
const unique=xs=>[...new Set(xs)].sort((a,b)=>Number(a.slice(1))-Number(b.slice(1)));
const result={schema:1,scope:'Three synthetic seeds; single-variable and order-only probes. Observations are not semantic/psychometric validity or production population coverage.',sourceHashes:Object.fromEntries(['data/questions.json','data/mapping.json','assets/js/report-engine.js','assets/js/report-engine-v4.js','report.html'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')])),inventory,conditionalOtherInventory:others,probes,summary:{coreQuestions:inventory.length,conditionalOtherInputs:others.length,probes:probes.length,headlineSensitiveQids:unique(probes.filter(p=>p.kind!=='order_only'&&p.headlineAxes.length).map(p=>p.qid)),explanationSensitiveQids:unique(probes.filter(p=>p.kind!=='order_only'&&p.explanationAxes.length).map(p=>p.qid)),orderSensitiveHeadlineQids:unique(probes.filter(p=>p.kind==='order_only'&&p.headlineAxes.length).map(p=>p.qid)),secondaryChangesWithoutHeadlineOrExplanation:probes.filter(p=>p.kind==='secondary_selected_value'&&!p.headlineOrExplanationObserved).length},unmeasuredCandidates:[{concept:'Intended beneficiary and their concrete need',status:'Manual content-validity review needed; no direct beneficiary/task pair identified in current axis coordinate adapter.'},{concept:'Trade-off priority when selected values conflict',status:'Q63 asks selection, not an explicit ranked trade-off decision.'},{concept:'Observed conditions in a successful and unsuccessful real attempt',status:'Preferences and self-report do not establish observed causal conditions; follow-up could ask for examples.'},{concept:'Actual usefulness/reuse of accumulated output by another person',status:'Cannot be confirmed by initial preference questions; requires later experience evidence.'}],limits:['changedSectionPayloads includes derived/internal content; it is NOT a rendered-page comparison.','No response in one probe is not evidence that a question is unused everywhere.','Declared mapping and engine consumption are different contracts.','No account data, scoring change, model deployment or questionnaire modification.']};
const output=process.argv[2];if(output)fs.writeFileSync(path.resolve(output),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result.summary,null,2));
