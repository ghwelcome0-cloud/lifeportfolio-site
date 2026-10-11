'use strict';
// X1 group regeneration: the server four-axis refresh also attaches the same 자산화 길 찾기 page.
// Real refreshB2BAxes source extracted into a vm with an in-memory RTDB stub. Synthetic data only.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),src=fs.readFileSync(path.join(root,'functions/_b2b_group_module.js'),'utf8');
const a0=src.indexOf('let _axisDeps = null;'),a1=src.indexOf('// ───',src.indexOf('async function refreshB2BAxes('));
assert.ok(a0>0&&a1>a0);
const T=require('./test-response-evidence.cjs'),E=require('../assets/js/report-engine.js'),V=require('../assets/js/report-engine-v4.js');
const questions=require('../data/questions.json'),mapping=require('../data/mapping.json'),rules=require('../data/report-rules.json'),careerRules=require('../data/career-rules.json');
const answers=T.base(0),input={questions,mapping,rules,careerRules,answers,profile:{name:'S',submittedAt:1},lang:'ko'};
const sid='s_1_group',uid='u1',orderId='o1';
function run(stored){
 const db={[`reports/${uid}/${sid}`]:stored,[`responses/${uid}/${sid}`]:{status:'submitted',answers,meta:{source:'b2b',b2bOrderId:orderId}}};
 const ref=p=>({get:async()=>({val:()=>structuredClone(db[p]??null)}),transaction:async(fn)=>{const r=fn(structuredClone(db[p]??null));if(r!==undefined)db[p]=r;return {committed:r!==undefined,snapshot:{val:()=>structuredClone(db[p])}};}});
 class HttpsError extends Error{constructor(c,m){super(m);this.code=c;}}
 const c=vm.createContext({require:m=>require(m.startsWith('./')?path.join(root,'functions',m):m),HttpsError,JSON,Object,Array,
  admin:{database:Object.assign(()=>({ref}),{ServerValue:{TIMESTAMP:7}})}});
 vm.runInContext(src.slice(a0,a1)+';globalThis.go=refreshB2BAxes;',c);
 return c.go(uid,{resultState:'complete',resultSid:sid,surveySid:sid,orderId}).then(r=>({r,db}));
}
(async()=>{
 const report={...V.upgrade(E.build(input),input),_participation:{source:'b2b',orderId}};
 const {r,db}=await run({sid,report,editCount:0,manualReportStatus:'auto'});
 const s=db[`reports/${uid}/${sid}`];
 assert.equal(r.changed,true);assert.equal(s.report._assetPath.version,'asset-path-v1');assert.ok(s.report._assetPath.sentence);
 assert.equal(s.editCount,1);assert.equal(s.report._axisProjection.version,'axis-projection-v1');
 const again=await run(structuredClone(s));assert.equal(again.r.changed,false,'idempotent');
 const manual=await run({sid,report,editCount:0,manualReportStatus:'reviewed'}).catch(e=>e);assert.equal(manual.code,'failed-precondition','manual preserved');
 console.log('PASS group refreshAxes attaches 자산화 길 찾기 (same engine), idempotent, manual preserved');
})().catch(e=>{console.error(e);process.exit(1);});
