'use strict';
// 고유성 기반 자산화 길찾기 엔진 asset-map-v1 — offline, synthetic answers only (no customer data).
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');const AM=require('../assets/js/asset-map.js');const Q=require('../data/questions.json');
const qs=[];(function w(o){if(Array.isArray(o))o.forEach(w);else if(o&&typeof o==='object'){if(o.id&&o.text&&/^Q/.test(o.id))qs.push(o);Object.values(o).forEach(w);}})(Q);
const byId=Object.fromEntries(qs.map(q=>[q.id,q]));
function rng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function ans(r){const a={};for(const it of qs){if(it.type==='likert')a[it.id]=1+Math.floor(r()*5);else if(it.options){const max=it.type==='single_choice'?1:(it.max||2);const k=1+Math.floor(r()*max),pool=it.options.slice(),pick=[];for(let j=0;j<k&&pool.length;j++)pick.push(pool.splice(Math.floor(r()*pool.length),1)[0]);a[it.id]=it.type==='single_choice'?pick[0]:pick;}}return a;}
const AX=['self_understanding','self_expression','self_design','self_execution'];
let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS '+name);};
t('rules-reference-real-questions-and-options',()=>{AM.RULES.choice.forEach(c=>{assert.ok(byId[c.q],c.q);assert.ok(byId[c.q].options.includes(c.opt),c.q+' '+c.opt);c.to.forEach(x=>assert.ok(AM.COPY.actions[x[0]].subs[x[1]],x.join('.')));});
  AM.RULES.likert.forEach(l=>assert.equal(byId[l.q].type,'likert'));assert.equal(AM.RULES.choice.length,76);assert.equal(AM.RULES.likert.length,7);assert.equal(AM.RULES.minChoice,1);});
t('seven-names-match-diary-and-homepage',()=>{const S=require('../assets/js/diary-schema.js');assert.deepEqual(AM.RULES.order.map(c=>AM.COPY.actions[c].name),S.ASSET_DIRECTIONS);
  AM.RULES.order.forEach((c,i)=>assert.equal(AM.COPY.actions[c].line,S.ASSET_CHANGES[i].line));});
t('twenty-eight-subs-each-with-first-step',()=>{let k=0;Object.values(AM.COPY.actions).forEach(a=>Object.values(a.subs).forEach(s=>{k++;assert.ok(s.ko&&s.first);}));assert.equal(k,28);});
t('deterministic-and-fair-on-20000-random',()=>{const r=rng(1),first={};let none=0,weak=0;
  for(let i=0;i<20000;i++){const inp={answers:ans(r),axisRanking:AX.slice().sort(()=>r()-0.5).map(x=>({axis:x}))};const o=AM.compute(inp);
   assert.equal(JSON.stringify(AM.compute(inp)),JSON.stringify(o));if(o.insufficient)none++;if(o.actions[0])first[o.actions[0].code]=(first[o.actions[0].code]||0)+1;
   o.actions.forEach(a=>{if(!a.evidence.some(e=>e.opt))weak++;});assert.ok(o.actions.length<=3&&o.ask.length<=2);}
  assert.equal(weak,0);assert.ok(none<20);AM.RULES.order.forEach(c=>{const p=(first[c]||0)/200;assert.ok(p>=9&&p<=20,c+' '+p);});});
t('optional-answers-never-change-result',()=>{const r=rng(5);for(let i=0;i<5000;i++){const inp={answers:ans(r),axisRanking:[]};const o=AM.compute(inp);
  const yes=Object.fromEntries(['P1','P2','P3','P4'].map(k=>[k,'yes']));const o2=AM.compute(Object.assign({},inp,{probes:yes}));
  assert.equal(JSON.stringify(o2.actions),JSON.stringify(o.actions));assert.equal(o2.selfReported.length,o.ask.length);
  o2.selfReported.forEach(c=>assert.ok(!o.actions.some(a=>a.code===c)));}});
t('answers-object-never-mutated',()=>{const a=ans(rng(9)),b=JSON.stringify(a);AM.compute({answers:a});assert.equal(JSON.stringify(a),b);});
t('customer-view-hides-codes-and-type-words',()=>{const r=rng(3);for(let i=0;i<2000;i++){const v=JSON.stringify(AM.view(AM.compute({answers:ans(r),axisRanking:[{axis:'self_design'}],probes:{P1:'yes',P2:'yes',P3:'yes',P4:'yes'}})));
  assert.ok(!/\bQ\d{1,3}\b|self_|illuminate|"perform"|"care"|"keep"|"build"|"connect"|"make"/.test(v));assert.ok(!/형입니다|유형|등급|순위/.test(v));}
  assert.match(AM.COPY.fixedLine,/한 가지로 묶는 이름이 아니라/);});
t('empty-answers-are-insufficient-not-invented',()=>{const o=AM.compute({answers:{}});assert.equal(o.insufficient,true);assert.equal(o.actions.length,0);assert.ok(AM.view(o).insufficient);});
t('module-generated-from-approved-sources',()=>{const out=cp.execFileSync('node',['-e',"const fs=require('fs');const a=fs.readFileSync('assets/js/asset-map.js','utf8');require('child_process').execFileSync('node',['tools/asset-map/build-module.cjs','tools/asset-map/source/asset-map-rules.v1.json','tools/asset-map/source/asset-map-copy.v1.json']);const b=fs.readFileSync('assets/js/asset-map.js','utf8');fs.writeFileSync('assets/js/asset-map.js',a);fs.writeFileSync('functions/_asset_map.js',a);process.stdout.write(a===b?'same':'diff')"],{cwd:root,encoding:'utf8'});assert.equal(out,'same');
  assert.equal(fs.readFileSync(path.join(root,'functions/_asset_map.js'),'utf8'),fs.readFileSync(path.join(root,'assets/js/asset-map.js'),'utf8'));});
console.log(JSON.stringify({passed:n,scope:'offline, synthetic answers only'}));
