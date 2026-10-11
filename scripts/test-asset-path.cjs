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
// X1-P mapping: report XI -> program next step -> diary. Only opt-in KO builds with _assetPath; addition only.
{const T=require(root+'/scripts/test-response-evidence.cjs'),R=require(root+'/assets/js/response-evidence.js'),PE=require(root+'/assets/js/program-engine.js'),pr=require(root+'/data/program-rules.json');
 const a=T.base(0),r=R.attachAxes(T.build(a,'ko','input-v2').r,questions,a),r2={...r,_assetPath:P.compose(A,r,a)};
 const b=(x,o)=>{const p=PE.build({report:x,rules:pr,name:'합성',lang:'ko',publishedAt:new Date(0),...o});delete p.meta.generatedAt;return JSON.parse(JSON.stringify(p));};
 const base=b(r,{axisProgram:true}),linked=b(r2,{axisProgram:true}),optout=b(r2,{});
 assert.equal(linked.nextSteps.length,base.nextSteps.length+1);assert.ok(linked.nextSteps.at(-1).task.startsWith(r2._assetPath.firstStep));assert.ok(linked.nextSteps.at(-1).task.includes('다이어리'));
 const x=structuredClone(linked),f=x._assetFan;assert.ok(f&&f.version==='asset-fan-v1'&&f.rings.length===3,'asset-fan attached');
 // asset-fan-v1 additions are exactly: week effects (1 line each, weeks 1-3), month3 effects (asset kinds), one year1 milestone.
 x.nextSteps.pop();delete x._assetLink;delete x._assetFan;delete x.meta.assetFanVersion;
 f.weekly.forEach((l,i)=>{assert.equal(x.program.weeks[i].effects.at(-1),l);x.program.weeks[i].effects.pop();});
 f.accrue.forEach(()=>x.program.month3.effects.pop());assert.equal(x.program.year1.milestones.pop(),f.rings[2].line);
 for(const k of ['weeks']){x.program[k].forEach((w,i)=>{if(base.program[k][i]&&base.program[k][i].effects===undefined&&Array.isArray(w.effects)&&!w.effects.length)delete w.effects;});}
 if(base.program.month3&&base.program.month3.effects===undefined&&Array.isArray(x.program.month3.effects)&&!x.program.month3.effects.length)delete x.program.month3.effects;
 assert.deepEqual(x,base,'addition only');
 assert.equal(optout._assetLink,undefined,'not opted in => unchanged');
 console.log('PASS asset-link: program gets one next step from XI (first thing to leave -> diary) + asset-fan-v1 week/3-month/1-year lines; nothing else changes');}
