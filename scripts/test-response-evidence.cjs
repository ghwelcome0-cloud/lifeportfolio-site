'use strict';
// Real engines, synthetic answers only. Historical behavior remains explicitly tested.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process'),assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const root=path.resolve(__dirname,'..'),E=require('../assets/js/report-engine.js'),V=require('../assets/js/report-engine-v4.js'),P=require('../assets/js/program-engine.js'),R=require('../assets/js/response-evidence.js');
const questions=require('../data/questions.json'),mapping=require('../data/mapping.json'),rules=require('../data/report-rules.json'),careerRules=require('../data/career-rules.json'),programRules=require('../data/program-rules.json');
const qs=questions.sections.flatMap(s=>s.questions),others=qs.filter(q=>q.hasOther),copy=x=>JSON.parse(JSON.stringify(x));
const axes=['self_understanding','self_expression','self_design','self_execution'];
function clean(x){if(Array.isArray(x))return x.map(clean);if(x&&typeof x==='object')return Object.fromEntries(Object.keys(x).sort().filter(k=>!['generatedAt'].includes(k)).map(k=>[k,clean(x[k])]));return x;}
function old(file){const code=cp.execFileSync('git',['show','3e17b04:assets/js/'+file],{cwd:root,encoding:'utf8',maxBuffer:3000000});const c=vm.createContext({module:{exports:{}},console,require:createRequire(path.join(root,'assets/js',file))});vm.runInContext(code,c);return c.module.exports;}
const OE=old('report-engine.js'),OV=old('report-engine-v4.js'),OP=old('program-engine.js');
function base(seed){const a={Q1:'Synthetic Evidence Reader',Q2:'email'};qs.forEach((q,i)=>{if(q.type==='likert')a[q.id]=1+(i+seed)%5;else if(q.options?.length){const n=(i+seed)%q.options.length;a[q.id]=q.type==='multi_choice'?[q.options[n],q.options[(n+1)%q.options.length]].slice(0,q.max||2):q.options[n];}});return a;}
function input(answers,lang='ko',version='input-v2'){return {questions,mapping,rules,careerRules,answers,lang,inputContractVersion:version,profile:{name:'Synthetic Evidence Reader',submittedAt:10}};}
function build(a,lang='ko',version='input-v2'){const before=JSON.stringify(a),i=input(a,lang,version),r=V.upgrade(E.build(i),i);const rb=JSON.stringify(r),p=P.build({report:r,rules:programRules,lang,publishedAt:new Date(10)});assert.equal(JSON.stringify(a),before);assert.equal(JSON.stringify(r),rb);return {r,p};}
let checks=0;
for(const seed of [0,7,13])for(const lang of ['ko','en']){
 const a=base(seed);for(const q of others)a[q.otherId]=seed===0?'1':seed===7?'5':'과거에 저장한 직접입력';
 const i=input(a,lang,undefined);delete i.inputContractVersion;
 const oldR=OV.upgrade(OE.build(i),i),newR=V.upgrade(E.build(i),i);
 assert.deepEqual(clean(newR),clean(copy(oldR)),'unversioned historical report unchanged');
 assert.deepEqual(clean(P.build({report:newR,rules:programRules,lang,publishedAt:new Date(10)})),clean(copy(OP.build({report:oldR,rules:programRules,lang,publishedAt:new Date(10)}))),'historical program unchanged');checks+=2;
 const newInput=input(a,lang),r=V.upgrade(E.build(newInput),newInput);
 assert.equal(r.scoringVersion,'scores-v2-text-excluded');
 assert.equal(r._v4Meta.fingerprint64,oldR._v4Meta.fingerprint64,'identity remains original full-answer hash');
 const b=copy(a);for(const q of qs)if(Array.isArray(b[q.id]))b[q.id].reverse();
 const reordered=build(b,lang);
 assert.deepEqual(clean(r._responseEvidence),clean(reordered.r._responseEvidence),'unranked order does not change evidence interpretation');
 assert.deepEqual(clean(r.sections),clean(reordered.r.sections),'unranked order does not change section content');checks+=3;
 for(const q of others){
  const on=copy(a);on[q.id]=q.type==='multi_choice'?['기타 (직접 입력)']:'기타 (직접 입력)';
  const x=copy(on),y=copy(on);x[q.otherId]='1';y[q.otherId]='5';
  const sx=E.computeScores(questions,mapping,x,'input-v2'),sy=E.computeScores(questions,mapping,y,'input-v2');
  assert.equal(sx.perQ[q.otherId].type,'text');assert.equal(sx.perQ[q.otherId].raw,null);assert.deepEqual(sx.axisPct,sy.axisPct);
  x[q.otherId]='   ';assert.equal(E.computeScores(questions,mapping,x,'input-v2').perQ[q.otherId].raw,null);
  x[q.otherId]='처음 배우는 사람의 동작을 관찰하고 설명한다';y[q.otherId]='경험 있는 사람과 장면을 비교하고 판단을 되짚는다';
  const one=build(x,lang),two=build(y,lang),o=one.r._responseEvidence.observations.find(o=>o.qid===q.otherId);
  assert.ok(o);assert.equal(o.rawText,x[q.otherId]);assert.equal(o.interpretation,'context-only');
  assert.notEqual(one.r._responseEvidence.axes[o.axis].core,two.r._responseEvidence.axes[o.axis].core,'free text changes a contextual headline');
  assert.notDeepEqual(one.p.nextSteps,two.p.nextSteps,'free text changes execution proposals');
  assert.equal(one.p._responseEvidence.fields[q.id].other.rawText,x[q.otherId]);
  const inactive=copy(x);inactive[q.id]=q.type==='multi_choice'?[q.options[0]]:q.options[0];const empty=copy(inactive);delete empty[q.otherId];
  const ir=build(inactive,lang),er=build(empty,lang);
  assert.equal(ir.r._responseEvidence.fields[q.id].other.state,'retained-inactive');
  assert.equal(ir.r._responseEvidence.fields[q.id].other.rawText,x[q.otherId]);
  assert.deepEqual(ir.r.sections,er.r.sections,'inactive text never changes visible sections');
  assert.deepEqual(ir.p.program,er.p.program,'inactive text never changes program');
  checks+=9;
 }
}
const b=base(0),q63=qs.find(q=>q.id==='Q63');b.Q63=[q63.options[0],q63.options[1]];const c=copy(b);c.Q63[1]=q63.options[2];
const br=build(b),cr=build(c);assert.notEqual(br.r._responseEvidence.axes.self_understanding.core,cr.r._responseEvidence.axes.self_understanding.core);checks++;
for(const id of ['Q14','Q65','Q77']){const q=qs.find(q=>q.id===id),a=base(0),b=copy(a);b[id]=q.type==='multi_choice'?[q.options[(q.options.indexOf(a[id][0])+2)%q.options.length]]:q.options[(q.options.indexOf(a[id])+1)%q.options.length];assert.notDeepEqual(build(a).r._responseEvidence.axes,build(b).r._responseEvidence.axes,id+' must affect reader interpretation');checks++;}
for(const q of others){const a=base(0);a[q.id]=q.type==='multi_choice'?['기타 (직접 입력)']:'기타 (직접 입력)';a[q.otherId]='앞부분, 쉼표/슬래시\n日本語 <img src=x onerror="window.__xss=1"> '+ '긴 원문'.repeat(200);const r=build(a).r;assert.equal(r._responseEvidence.fields[q.id].other.rawText,a[q.otherId]);assert.ok(r._responseEvidence.observations[0].excerpt.endsWith('…'));checks++;}
// Same career label must not force identical evidence-based execution plans.
{
 const a=base(0),b=base(0);a.Q39=b.Q39=['기타 (직접 입력)'];a.Q40='처음 배우는 사람의 동작을 관찰한다';b.Q40='경기 경험이 있는 사람의 판단을 비교한다';
 const ar=build(a).r,br=build(b).r;for(const r of [ar,br])r.sections.find(s=>s.id==='career_education').content.careers=['스포츠 코치'];
 assert.notDeepEqual(P.build({report:ar,rules:programRules}).modules,P.build({report:br,rules:programRules}).modules);
}
assert.throws(()=>P.build({report:E.build(input(base(0))),rules:programRules}),/evidence missing/i);
assert.throws(()=>V.upgrade(E.build(input(base(0))),input(base(0),'ko','wrong')),/version mismatch/);checks+=2;
for(const file of ['data/questions.json','data/mapping.json','firebase.json','database.rules.json','firestore.rules','index.html'])assert.equal(fs.readFileSync(path.join(root,file),'utf8'),cp.execFileSync('git',['show','3e17b04:'+file],{cwd:root,encoding:'utf8',maxBuffer:6000000}));
console.log('PASS '+checks+' evidence/scoring/legacy invariants; 20 inputs × 3 seeds × KO/EN; immutable answers, original identity, no network');
module.exports={base,input,build,qs,others};
