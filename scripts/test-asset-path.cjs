'use strict';
// X1 자산화 길 찾기: deterministic, customer-only text, many distinct sentences, no label/rank wording.
const assert=require('node:assert/strict'),root=require('node:path').resolve(__dirname,'..');
const E=require(root+'/assets/js/report-engine.js'),V=require(root+'/assets/js/report-engine-v4.js'),A=require(root+'/assets/js/asset-map.js'),P=require(root+'/assets/js/asset-path.js');
const questions=require(root+'/data/questions.json'),mapping=require(root+'/data/mapping.json'),rules=require(root+'/data/report-rules.json'),careerRules=require(root+'/data/career-rules.json');
function rnd(seed){let s=seed*2654435761%4294967296;return()=>{s=(s*1664525+1013904223)%4294967296;return s/4294967296;};}
const S=new Set();let n=0;
for(let seed=0;seed<200;seed++){const r0=rnd(seed+1),a={Q1:'S'};
 questions.sections.flatMap(s=>s.questions).forEach(q=>{if(q.type==='likert')a[q.id]=1+Math.floor(r0()*5);else if(q.options?.length){if(q.type==='multi_choice'){const o=[];for(let i=0;i<1+Math.floor(r0()*3);i++){const v=q.options[Math.floor(r0()*q.options.length)];if(!o.includes(v)&&!/기타/.test(v))o.push(v);}a[q.id]=o;}else{const v=q.options[Math.floor(r0()*q.options.length)];a[q.id]=/기타/.test(v)?q.options[0]:v;}}});
 const input={questions,mapping,rules,careerRules,answers:a,profile:{name:'S',submittedAt:10},lang:'ko'};
 const r=V.upgrade(E.build(input),input),before=JSON.stringify(r),p=P.compose(A,r,a);
 assert.equal(JSON.stringify(r),before,'report must not be mutated');assert.deepEqual(P.compose(A,r,a),p,'deterministic');
 assert.ok(p&&p.type&&p.sentence&&p.firstStep&&p.assets.length===3&&p.jobs.length>=4&&p.days.length===4);
 const q={...p};delete q.codes;const text=JSON.stringify(q);
 assert.ok(!/undefined|null|으로으로|\(와\)|Q\d+|당신은 .*형입니다|순위|등급/.test(text),text);
 S.add(p.sentence);n++;
}
assert.ok(S.size>=190,'distinct sentences '+S.size);
assert.equal(P.compose(A,{lang:'en',sections:[]},{}),null,'English reports: no page (later, all at once)');
assert.equal(P.compose(null,{sections:[]},{}),null);
console.log('PASS asset-path: '+n+' real-engine reports, '+S.size+' distinct sentences, deterministic, no mutation, no label wording');
