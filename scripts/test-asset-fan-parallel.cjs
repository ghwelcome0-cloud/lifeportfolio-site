'use strict';
// asset-fan-v1 parallel verification: N synthetic users across worker threads, real engines, no network.
// Checks per user: fan present for KO opt-in, every line built from the user's own path, josa clean,
// area A=½θr²(1+s) exact and strictly widening (30일 < 3개월 < 1년), θ = 40°×changes, deterministic,
// EN / opt-out / no-path => no fan and program unchanged. Across users: lines are personal (many distinct).
const {Worker,isMainThread,parentPort,workerData}=require('node:worker_threads');
const assert=require('node:assert/strict'),root=require('node:path').resolve(__dirname,'..');
const N=Number(process.env.AF_USERS||1000),W=Math.max(2,Math.min(4,require('node:os').cpus().length));
function run({from,to}){
 const E=require(root+'/assets/js/report-engine.js'),V=require(root+'/assets/js/report-engine-v4.js'),A=require(root+'/assets/js/asset-map.js'),P=require(root+'/assets/js/asset-path.js'),PE=require(root+'/assets/js/program-engine.js');
 const questions=require(root+'/data/questions.json'),mapping=require(root+'/data/mapping.json'),rules=require(root+'/data/report-rules.json'),careerRules=require(root+'/data/career-rules.json'),pr=require(root+'/data/program-rules.json');
 const rnd=seed=>{let s=seed*2654435761%4294967296;return()=>{s=(s*1664525+1013904223)%4294967296;return s/4294967296;};};
 const B=(report,o)=>{const p=PE.build({report,rules:pr,name:'합성',lang:'ko',publishedAt:new Date(0),...o});delete p.meta.generatedAt;return p;};
 const out={n:0,lines:[[],[],[]],weekly:[],types:{},checks:0};
 for(let seed=from;seed<to;seed++){const r0=rnd(seed+7),a={Q1:'S'};
  questions.sections.flatMap(s=>s.questions).forEach(q=>{if(q.type==='likert')a[q.id]=1+Math.floor(r0()*5);else if(q.options?.length){if(q.type==='multi_choice'){const o=[];for(let i=0;i<1+Math.floor(r0()*3);i++){const v=q.options[Math.floor(r0()*q.options.length)];if(!o.includes(v)&&!/기타/.test(v))o.push(v);}a[q.id]=o;}else{const v=q.options[Math.floor(r0()*q.options.length)];a[q.id]=/기타/.test(v)?q.options[0]:v;}}});
  const input={questions,mapping,rules,careerRules,answers:a,inputContractVersion:'input-v2',profile:{name:'S',submittedAt:10},lang:'ko'};
  const r=V.upgrade(E.build(input),input);assert.equal(r._responseEvidence?.version,'evidence-reader-v1');const ap=P.compose(A,r,a);assert.ok(ap,'path '+seed);
  const rp={...r,_assetPath:ap},prog=B(rp,{axisProgram:true}),f=prog._assetFan,c=n=>{out.checks+=n;};
  assert.ok(f&&f.version==='asset-fan-v1','fan present '+seed);c(1);
  assert.deepEqual(JSON.parse(JSON.stringify(B(rp,{axisProgram:true}))),JSON.parse(JSON.stringify(prog)),'deterministic');c(1);
  // own path
  const art=ap.days.map(d=>/^(.+) 남기기$/.exec(d.v)).find(Boolean)[1];
  assert.equal(f.type,ap.type.name);assert.ok(f.rings[0].line.includes(ap.firstStep));assert.ok(f.rings[1].line.includes(art));
  const a0=ap.assets.find(x=>!/금융/.test(x.k));assert.ok(a0&&f.rings[2].line.includes(a0.k)&&!/금융/.test(f.rings[2].line));assert.ok(f.rings[1].line.includes(ap.basis.scene));if(ap.basis.strength)assert.ok(f.rings[2].line.includes(ap.basis.strength));c(2);assert.deepEqual(f.changes,[ap.type.name,...ap.others.slice(0,2).map(o=>o.name)]);
  f.accrue.forEach((l,i)=>assert.equal(l,'자산화: '+ap.assets[i].k+' — '+ap.assets[i].v));c(6);
  // math
  assert.equal(f.theta,40*f.changes.length);assert.ok(f.changes.length>=1&&f.changes.length<=3);
  const th=f.theta*Math.PI/180;f.rings.forEach(g=>assert.ok(Math.abs(g.area-0.5*th*g.r*g.r*(1+g.s))<0.006,'area exact'));
  assert.deepEqual(f.rings.map(g=>[g.r,g.s]),[[1,1],[2,2],[3,5]]);assert.ok(f.rings[0].area<f.rings[1].area&&f.rings[1].area<f.rings[2].area,'widening');c(4);
  // placed in the program (append-only)
  f.weekly.forEach((l,i)=>assert.equal(prog.program.weeks[i].effects.at(-1),l));assert.equal(prog.program.year1.milestones.at(-1),f.rings[2].line);
  f.accrue.forEach(l=>assert.ok(prog.program.month3.effects.includes(l)));c(3);
  // text hygiene: KO only, josa resolved, no artifacts, no score/label wording
  const txt=JSON.stringify([f.rings.map(g=>g.line),f.weekly,f.accrue,f.widen]);
  assert.ok(!/을\(를\)|\(으\)로|이\(가\)|\(와\)|undefined|null|NaN|\[object|으로으로|를를|을을/.test(txt),txt);
  assert.ok(!/점수|순위|등급|형입니다|score|rank/i.test(txt),txt);assert.ok(!/[A-Za-z]{3,}/.test(txt.replace(/\\u[0-9a-f]{4}/gi,'')),'KO only: '+txt);c(3);
  // opt-in only
  const ie={...input,lang:'en'},re=V.upgrade(E.build(ie),ie),en=B({...re,_assetPath:ap},{axisProgram:true,lang:'en'}),off=B(rp,{}),none=B(r,{axisProgram:true});
  assert.equal(en._assetFan,undefined);assert.equal(off._assetFan,undefined);assert.equal(none._assetFan,undefined);c(3);
  out.lines.forEach((L,i)=>L.push(f.rings[i].line));out.weekly.push(f.weekly.join('|'));out.types[f.type]=(out.types[f.type]||0)+1;out.n++;
 }
 return out;}
if(!isMainThread){parentPort.postMessage(run(workerData));}
else{const t0=Date.now(),step=Math.ceil(N/W);
 Promise.all(Array.from({length:W},(_,i)=>new Promise((res,rej)=>{const w=new Worker(__filename,{workerData:{from:i*step,to:Math.min(N,(i+1)*step)}});w.on('message',res);w.on('error',rej);w.on('exit',c=>c&&rej(new Error('worker exit '+c)));}))).then(parts=>{
  const n=parts.reduce((s,p)=>s+p.n,0),checks=parts.reduce((s,p)=>s+p.checks,0),types={};parts.forEach(p=>Object.entries(p.types).forEach(([k,v])=>types[k]=(types[k]||0)+v));
  const d=[0,1,2].map(i=>new Set(parts.flatMap(p=>p.lines[i])).size),dw=new Set(parts.flatMap(p=>p.weekly)).size;
  assert.equal(n,N);
  // personal: the 30-day line follows the person's first step; the 1-year line combines type and asset kind.
  // 30일 = the report's own first step (same words as XI, by design); 3개월 adds the person's scene; 1년 adds strength #1.
  const fan=new Set(parts.flatMap(p=>p.lines[0].map((l,i)=>l+'|'+p.lines[1][i]+'|'+p.lines[2][i]))).size;
  assert.ok(d[0]>=20&&d[1]>=d[0]&&d[2]>=d[1],'widening distinctness '+d);assert.ok(fan>=N*0.25,'whole-fan distinct '+fan);
  assert.ok(dw>=20,'week lines '+dw);assert.ok(Object.keys(types).length>=5,'types '+JSON.stringify(types));
  console.log('PASS asset-fan parallel: '+n+' users × '+W+' workers, '+checks+' checks, distinct lines 30일 '+d[0]+' / 3개월 '+d[1]+' / 1년 '+d[2]+', whole fan '+fan+', weeks '+dw+', types '+JSON.stringify(types)+', '+(Date.now()-t0)+'ms');
 }).catch(e=>{console.error(e);process.exit(1);});}
