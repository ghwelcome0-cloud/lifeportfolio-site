'use strict';
// asset-program-v1 · 제작규칙 AP-1 (대표 지시 2026-10-12 「전 페이지가 … 자산화 맞춤 실행 프로그램으로 격상 … 특히 IV. 3개월 · 1년
// 목표는 12주 퀘스트와 방향성을 같이」). Offline: rulebook entry, render wiring, 대원칙-F population (≥1,000 synthetic users,
// half older reports) — every page record follows the same quest (same phases, same artifact, same card), no banned words,
// and old/English/opt-out builds carry no record (pages keep their earlier body).
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),root=path.join(__dirname,'..');
let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS '+name);};
const html=fs.readFileSync(path.join(root,'program.html'),'utf8'),eng=fs.readFileSync(path.join(root,'assets/js/program-engine.js'),'utf8');
const pr=require(root+'/data/program-rules.json'),AR=pr.assetProgramRule;
t('rulebook-entry',()=>{assert.equal(AR.code,'AP-1');assert.equal(AR.version,'asset-program-v1');
 ['I','II','III','IV','V','VI','VII','VIII','IX'].forEach(k=>assert.ok(AR.pages[k],'page rule '+k));
 assert.ok(/세 매듭/.test(AR.pages.IV)&&/네 번 넓히기/.test(AR.pages.IV)&&/비전/.test(AR.pages.IV));assert.ok(/다이어리/.test(AR.diary)&&/출시 준비중/.test(AR.services));
 const doc=fs.readFileSync(path.join(root,'docs/제작규칙서_v2.1_개정부록_표현규칙_2026-07-31.md'),'utf8');assert.ok(/\*\*제44조 \(자산화 맞춤 실행 프로그램/.test(doc));});
t('render-wired-every-page',()=>{assert.ok(/assetProgram: \(p\._assetProgram && p\._assetProgram\.version === \\?"asset-program-v1\\?"/.test(html)||html.includes('assetProgram: (p._assetProgram && p._assetProgram.version === "asset-program-v1"'));
 ['II. 분기 테마 · 12주 한 바퀴','3개월 목표 · 12주 퀘스트의 세 매듭','1년 목표 · 같은 카드를 네 번 넓히기','VI. 성과 추적 보드 · 12칸','이 실행이 남기는 자산','오늘 시작하는 한 줄','ap-modph'].forEach(k=>assert.ok(html.includes(k),k));
 assert.ok(/function assetProgram\(ap, fan, quest, report\)/.test(eng));});
t('marked-and-pinned',()=>{const A=require('./_asset-program-approved.cjs');for(const f of ['assets/js/program-engine.js','program.html'])A.strip(f,fs.readFileSync(path.join(root,f),'utf8'));});
t('touch-and-mobile-css',()=>{assert.ok(html.includes('.book.lb-mobile .ap-h{font-size:18px!important;}'));assert.ok(html.includes('max-width:768px){.ap-flow,.ap-yr,.ap-bd__c{grid-template-columns:1fr 1fr;}'));});
{const E=require(root+'/assets/js/report-engine.js'),V=require(root+'/assets/js/report-engine-v4.js'),A=require(root+'/assets/js/asset-map.js'),P=require(root+'/assets/js/asset-path.js'),PE=require(root+'/assets/js/program-engine.js'),R=require(root+'/assets/js/response-evidence.js');
 const questions=require(root+'/data/questions.json'),mapping=require(root+'/data/mapping.json'),rules=require(root+'/data/report-rules.json'),careerRules=require(root+'/data/career-rules.json');
 const rnd=seed=>{let s=seed*2654435761%4294967296;return()=>{s=(s*1664525+1013904223)%4294967296;return s/4294967296;};};
 const N=Number(process.env.AP_USERS||1000);let older=0,withAP=0,withVision=0;const types=new Set(),arts=new Set();
 const BAN=/점수|등급|순위|\d{4}년|\d+월 \d+일|투자하|수익을 보장|LP-|ruleId|asset-quest-v1|AQ\d\d|(?:^|[\s"「(])내 [가-힣]|(?:^|[\s"「(])나의 |undefined|null|NaN/;
 for(let seed=0;seed<N;seed++){const r0=rnd(seed+909),a={Q1:'S'};
  questions.sections.flatMap(s=>s.questions).forEach(q=>{if(q.type==='likert')a[q.id]=1+Math.floor(r0()*5);else if(q.options?.length){if(q.type==='multi_choice'){const o=[];for(let i=0;i<1+Math.floor(r0()*3);i++){const v=q.options[Math.floor(r0()*q.options.length)];if(!o.includes(v)&&!/기타/.test(v))o.push(v);}a[q.id]=o;}else{const v=q.options[Math.floor(r0()*q.options.length)];a[q.id]=/기타/.test(v)?q.options[0]:v;}}});
  const i={questions,mapping,rules,careerRules,answers:a,inputContractVersion:seed%2?undefined:'input-v2',profile:{name:'S',submittedAt:10},lang:'ko'};
  let r=V.upgrade(E.build(i),i);if(seed%2)older++;else r=R.attachAxes(r,questions,a);r={...r,_assetPath:P.compose(A,r,a)};
  const p=PE.build({report:r,rules:pr,name:'S',lang:'ko',axisProgram:true,cardShape:'rq-01'}),g=p._assetProgram,q=p._assetQuest;
  if(!g){assert.ok(!q,'quest without asset program: '+seed);continue;}withAP++;types.add(g.type);arts.add(g.art);
  // IV 3개월 = the quest's three knots, same order and same people.
  assert.equal(g.month3.goals.length,3);g.month3.goals.forEach((x,k)=>{assert.equal(x.who,q.phases[k].who);assert.ok(x.criterion.includes(q.phases[k].when),'criterion names the phase '+seed);});
  const own=x=>String(x).replace(/(^|[\s「(·])(?:내|나의) (?=[가-힣])/g,'$1');assert.ok(g.month3.goals[0].title.includes(own(q.art))&&g.month3.goals[1].title.includes(own(q.art))&&g.month3.goals[2].title.includes(own(q.kind)),'knots carry the artifact/kind '+seed);
  assert.equal(g.month3.card.name,own(q.card.name));assert.deepEqual(g.month3.card.fields,q.card.fields);assert.equal(g.quarter.phases.map(x=>x.when).join(),q.phases.map(x=>x.when).join());
  // 1년 = four quarters growing the same card; first quarter IS the quest card, last reaches the third ring.
  assert.equal(g.year1.quarters.length,4);assert.ok(g.year1.quarters[0].what.startsWith(own(q.kind)));assert.ok(g.year1.quarters[3].how.startsWith(p._assetFan.rings[2].who));
  if(g.year1.vision)withVision++;
  // VI = the diary's 12 cells, V = one phase per module, IX = the report's first step.
  assert.equal(g.board.phases.flatMap(x=>x.weeks).map(w=>w.week).join(),'1,2,3,4,5,6,7,8,9,10,11,12');assert.equal(g.modules.length,3);
  assert.equal(g.today,r._assetPath.firstStep.replace(/(^|[\s「(·])(?:내|나의) (?=[가-힣])/g,'$1'));assert.ok(g.purpose.includes(g.type)&&g.purpose.includes(g.kind)&&g.purpose.includes(g.art));
  assert.ok(!g.effects.assets.some(x=>/금융/.test(x.k)),'no financial asset '+seed);
  const txt=JSON.stringify(g).replace(/「[^」]*」/g,'');assert.ok(!BAN.test(txt),'banned wording '+seed+': '+(txt.match(BAN)||[])[0]+' @ '+txt.slice(Math.max(0,txt.search(BAN)-60),txt.search(BAN)+30));
  assert.ok(/AP-1$/.test(p.meta.spec));}
 t('population-F-'+N+'-users',()=>{assert.ok(older>=N*0.45);assert.ok(withAP>=N*0.9,'most users get the asset program: '+withAP);assert.ok(withVision>=withAP*0.95,'vision line on the 1-year page: '+withVision);assert.ok(types.size>=6,'types '+types.size);assert.ok(arts.size>=10,'artifacts '+arts.size);});
 console.log(JSON.stringify({users:N,older,withAP,withVision,types:types.size,artifacts:arts.size}));
 // Fallbacks: English, opt-out, no _assetPath => no record, so every page keeps its earlier body.
 const a0={Q1:'S'};questions.sections.flatMap(s=>s.questions).forEach(q=>{if(q.type==='likert')a0[q.id]=3;else if(q.options?.length)a0[q.id]=q.type==='multi_choice'?[q.options[0]]:q.options[0];});
 const i0={questions,mapping,rules,careerRules,answers:a0,profile:{name:'S',submittedAt:10},lang:'ko'};let r0=V.upgrade(E.build(i0),i0);const rp={...r0,_assetPath:P.compose(A,r0,a0)};
 t('fallbacks-keep-earlier-pages',()=>{const b=(x,o)=>PE.build({report:x,rules:pr,name:'S',...o});
  assert.equal(b(rp,{lang:'en',axisProgram:true})._assetProgram,undefined);assert.equal(b(rp,{lang:'ko'})._assetProgram,undefined);assert.equal(b(r0,{lang:'ko',axisProgram:true})._assetProgram,undefined);
  assert.ok(!/AP-1/.test(b(r0,{lang:'ko',axisProgram:true}).meta.spec));});}
console.log(JSON.stringify({passed:n,scope:'offline source + population; synthetic only'}));
