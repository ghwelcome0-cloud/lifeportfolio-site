'use strict';
// Synthetic-only regression. No DB, Auth, mail, payment, or customer fixtures.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=n=>JSON.parse(fs.readFileSync(path.join(root,'data',n+'.json'),'utf8'));
const questions=read('questions'),mapping=read('mapping'),rules=read('report-rules'),careerRules=read('career-rules');
const E=require('../assets/js/report-engine.js'),V=require('../assets/js/report-engine-v4.js'),CE=require('../assets/js/career-engine.js');
const qs=questions.sections.flatMap(s=>s.questions),qids=Object.fromEntries(qs.map(q=>[q.id,q]));
const clone=x=>JSON.parse(JSON.stringify(x));let tests=0;
const check=(name,fn)=>{fn();tests++;console.log('PASS '+name);};
function base(seed=0){const a={Q1:'합성시험',Q2:'사이트에서 바로 확인'};for(const [i,q]of qs.entries())a[q.id]=q.type==='likert'?1+(i+seed)%5:q.type==='multi_choice'?[q.options[seed%q.options.length],q.options[(seed+1)%q.options.length]]:q.options[seed%q.options.length];return a;}
function report(a,profile={}){const input={questions,mapping,rules,careerRules,answers:a,profile:{name:a.Q1,email:'synthetic@example.invalid',submittedAt:'2026-01-01T00:00:00Z',...profile},lang:'ko'};return V.upgrade(E.build(input),input);}
const career=r=>r.sections.find(s=>s.id==='career_education').content;
for(let seed=0;seed<5;seed++){
 const a=base(seed),before=clone(a),x=report(a);
 check('repeatability-'+seed,()=>assert.deepEqual(x.sections,report(a).sections));
 check('original-responses-unchanged-'+seed,()=>assert.deepEqual(a,before));
 const reverse=clone(a);for(const q of qs)if(q.type==='multi_choice')reverse[q.id].reverse();
 check('unordered-multiselect-invariance-'+seed,()=>assert.deepEqual(x.sections,report(reverse).sections));
 const spaced=clone(a);spaced.Q75=['기타 (직접 입력)'];spaced.Q76='분야를 추가로 확인하는 합성 응답';const y=report(spaced);spaced.Q76+='  ';
 check('free-text-trailing-space-invariance-'+seed,()=>assert.deepEqual(y.sections,report(spaced).sections));
 for(const name of ['김연구원','김선수','김기획','김정책'])check('name-metadata-invariance-'+seed+'-'+name,()=>assert.deepEqual(career(x),career(report({...a,Q1:name}))));
 check('profile-context-invariance-'+seed,()=>assert.deepEqual(career(x),career(report(a,{age:70,gender:'female',occupation:'축구 은퇴선수',organization:'임의 공고',uid:'different',sid:'different'}))));
}
for(const domain of qids.Q75.options){
 const a=base();a.Q75=[domain,'교육','경영'].filter((v,i,s)=>s.indexOf(v)===i);
 check('fusion-preserves-domain-'+domain,()=>assert.equal(CE.fuseCoords(a.Q75,0).count,a.Q75.length));
 const b=report(a);
 check('domain-report-is-finite-'+domain,()=>{assert.ok(b.sections.length>0);assert.ok(!/NaN|undefined/.test(JSON.stringify(b.sections)));});
}
check('both-entry-pages-use-required-resource-loader',()=>{
 for(const file of ['report-loading.html','report.html'])assert.ok(fs.readFileSync(path.join(root,file),'utf8').includes('ReportEngine.loadReportResources(v)'));
 const initial=fs.readFileSync(path.join(root,'report-loading.html'),'utf8');assert.ok(initial.includes('questions, mapping, rules, careerRules,\n        answers:'));
});
check('legacy-multiple-topics-are-looked-up-individually',()=>{
 const topics=[qids.Q41.options[7],qids.Q41.options[2]],a=base();a.Q41=topics;
 const result=E.pickCareerEducation(a,mapping,10,'ko');
 for(const topic of topics)assert.ok(result.education.includes(mapping.topicCareerMap[topic].education[0]));
});
check('numeric-other-text-does-not-become-likert',()=>{const a=base();a.Q76='1';const x=E.computeScores(questions,mapping,a);a.Q76='5';assert.deepEqual(x,E.computeScores(questions,mapping,a));});
check('activity-meaning-drives-reference-examples',()=>{const a=base();a.Q75=['체육','예술'];a.Q77=[qids.Q77.options[3]];const analytic=career(report(a));a.Q77=[qids.Q77.options[5]];const physical=career(report(a));assert.notDeepEqual(analytic.careerExamples,physical.careerExamples);assert.notDeepEqual(analytic.educationExamples,physical.educationExamples);});
check('unrelated-emotion-answer-does-not-shuffle-reference-training',()=>{const a=base(),x=career(report(a));a.Q26=[qids.Q26.options[5]];const y=career(report(a));assert.deepEqual(x.educationExamples,y.educationExamples);assert.deepEqual(x.careerExamples,y.careerExamples);});
check('every-example-retains-explicit-field-and-activity-evidence',()=>{const a=base(),c=career(report(a));for(const ref of c._referenceEvidence.evidence){assert.ok(a.Q75.includes(ref.domain));assert.ok(ref.activityAnswers.length);assert.ok(ref.activityAnswers.every(x=>a.Q77.includes(x)));}assert.ok(c.careerGuideNote.includes('적합도 판정이 아닙니다'));});
check('unknown-activity-does-not-get-invented-reference-jobs',()=>{const a=base();a.Q77=['기타 (직접 입력)'];a.Q78='직접 확인이 필요한 활동';const c=career(report(a));assert.deepEqual(c.careerExamples,[]);assert.deepEqual(c.educationExamples,[]);assert.ok(c.careerGuideNote.includes('추가로 확인'));});
check('resource-fingerprints-match-tracked-rule-files',()=>{
 const crypto=require('node:crypto');
 for(const [name,expected] of Object.entries(E.resourceHashes)) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'data',name))).digest('hex'),expected,name);
 assert.equal(CE.resourceContract,E.resourceContract);assert.equal(V.resourceContract,E.resourceContract);
});
async function loaderRegression(){
 const vm=require('node:vm'),{webcrypto}=require('node:crypto');
 const source=fs.readFileSync(path.join(root,'assets/js/report-engine.js'),'utf8');
 function fixture(options={}){
   let fetches=0,scripts=0,saves=0;const files=[];
   const win={crypto:webcrypto,document:{createElement:()=>({remove(){}}),head:{appendChild(node){
     scripts++;const career=node.src.includes('career-engine.js'),key=career?'CareerEngine':'ReportEngineV4';
     queueMicrotask(()=>{
       if(options.script==='timeout')return;
       if(options.script==='error')return node.onerror?.();
       win[key]=options.script==='stale'?{version:'old'}:{resourceContract:E.resourceContract,[career?'build':'upgrade']:()=>{}};
       node.onload?.();
     });
   }}}};
   if(options.existing){win.CareerEngine=options.existing==='valid'?CE:{build(){}};win.ReportEngineV4=options.existing==='valid'?V:{upgrade(){}};}
   win.fetch=async(url,init)=>{
     fetches++;const name=url.split('/').pop().split('?')[0];files.push(name);
     if(options.data==='timeout')return new Promise((_,reject)=>init.signal.addEventListener('abort',()=>reject(Error('aborted'))));
     if(options.data==='network')throw Error('network');
     const original=fs.readFileSync(path.join(root,'data',name),'utf8');
     return {ok:options.data!=='404',text:async()=>options.data==='empty'?'{}':options.data==='malformed'?'{':options.data==='old'?original.replace(/"version"\s*:\s*"[^"]+"/,'"version":"old"'):original};
   };
   const sandbox={self:win,AbortController,TextEncoder,Uint8Array,console,queueMicrotask,
     setTimeout:(fn)=>setTimeout(fn,100),clearTimeout};
   vm.runInNewContext(source,sandbox);
   return {engine:win.ReportEngine,run:async()=>{const r=await win.ReportEngine.loadReportResources('test');saves++;return r;},stats:()=>({fetches,scripts,saves,files})};
 }
 for(const [name,options]of [['http404',{data:'404'}],['empty-json',{data:'empty'}],['malformed-json',{data:'malformed'}],['old-version',{data:'old'}],['network-failure',{data:'network'}],['fetch-timeout',{data:'timeout'}],['script-error',{script:'error'}],['script-timeout',{script:'timeout'}],['stale-script-export',{script:'stale'}]]){
   const f=fixture(options);await assert.rejects(f.run());assert.equal(f.stats().saves,0);tests++;console.log('PASS resource-loader-rejects-'+name);
 }
 for(const existing of ['valid','old']){const f=fixture({existing});const r=await f.run();assert.equal(r.questions.version,questions.version);assert.equal(f.stats().scripts,existing==='valid'?0:2);tests++;console.log('PASS resource-loader-'+existing+'-globals');}
 const concurrent=fixture();await Promise.all([concurrent.run(),concurrent.run()]);assert.equal(concurrent.stats().fetches,4);assert.equal(concurrent.stats().scripts,2);tests++;console.log('PASS resource-loader-coalesces-concurrent-loads');
 const retry=fixture({data:'empty'});await assert.rejects(retry.run());await assert.rejects(retry.run());assert.equal(retry.stats().fetches,8);tests++;console.log('PASS resource-loader-failure-does-not-cache-invalid-result');
 console.log(JSON.stringify({syntheticOnly:true,passed:tests,knownOpenIssues:['unranked domain narrative-role assignment','meaning-based role/education curation review','full renderer/readability and policy gates']}));
}
loaderRegression().catch(error=>{console.error(error);process.exitCode=1;});
