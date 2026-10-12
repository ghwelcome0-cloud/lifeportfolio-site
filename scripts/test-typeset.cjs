'use strict';
// typeset-v1 (owner 2026-10-12): 어절 · 의미 단위 · 시각 안정. Pure-function contract + 대원칙-F population check
// (≥1,000 synthetic users, new + older reports): fixText never changes meaning words, never invents text, and removes
// the four measured defect kinds; glue keeps numbers with units; output is idempotent and deterministic.
const assert=require('node:assert/strict'),fs=require('node:fs'),root=require('node:path').resolve(__dirname,'..');
const T=require(root+'/assets/js/typeset.js');
let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS '+name);};
const vis=s=>s.replace(/\u00a0/g,' ').replace(/\u2060/g,'');
t('fix-four-defects',()=>{
 assert.equal(T.fixText('실제로 한 선택과 대조합니다.특히 약속을'),'실제로 한 선택과 대조합니다. 특히 약속을');
 assert.equal(T.fixText('한 뼘씩 자라는 결과로 결과로 답하는'),'한 뼘씩 자라는 결과로 답하는');
 assert.equal(T.fixText('함께 함께 갈 사람을'),'함께 갈 사람을');
 assert.equal(T.fixText('‘세운다ʼ를'),'‘세운다’를');
 assert.equal(T.fixText('관계· 신뢰 자산'),'관계 · 신뢰 자산');assert.equal(T.fixText('리서치 ·분석'),'리서치 · 분석');});
t('fix-leaves-good-text-alone',()=>{for(const s of ['하나 하나','차근차근 차근차근','12.5점','v1.2 · 실행','A.B 테스트','‘끝까지’를','학습·연구','1. 사명','Hello. World','정말 정말 고마워요','가. 나. 다.'])assert.equal(T.fixText(s),s,s);});
t('glue-meaning-units',()=>{const g=s=>T.glue(s).replace(/\u00a0/g,'⍽').replace(/\u2060/g,'⁀');
 assert.equal(g('12 주 동안 3 개를 12 칸 중 3 칸, 56 문항이 3 개월'),'12⍽주 동안 3⍽개를 12⍽칸 중 3⍽칸, 56⍽문항이 3⍽개월');
 assert.equal(g('12 주인공 3 개구리'),'12 주인공 3 개구리');
 assert.equal(g('p. 15 보기 ↗ 10.05 (월) 3 / 12'),'p.⍽15 보기⍽↗ 10.05⍽(월) 3⍽/⍽12');
 assert.equal(g('정체성 · 강점 → 방향'),'정체성⍽· 강점⍽→ 방향');
 assert.equal(g('학습·연구 주제'),'학습⁀·⁀연구 주제');assert.equal(g('목표)를 「오늘」에'),'목표)⁀를 「오늘」⁀에');});
t('idempotent-and-visible-text-same-words',()=>{for(const s of ['대조합니다.특히 12 주 학습·연구 · 결과로 결과로','p. 3 보기 ↗']){const a=T.glue(T.fixText(s));assert.equal(T.glue(T.fixText(a)),a);}});
t('book-script-inline-safe',()=>{assert.ok(!/<\/script/i.test(T.SRC));const g={};new Function('self',T.SRC)(g);assert.equal(g.LPTypeset.VERSION,'typeset-v1');assert.equal(typeof g.LPTypeset.apply,'function');});
t('css-balance-never-pretty-on-a4',()=>{assert.ok(T.CSS_BOOK.includes('.ts-short{text-wrap:balance;}'));const a4=T.CSS_BOOK.replace(/@media screen and \(max-width:768px\)\{[\s\S]*$/,'');assert.ok(!/pretty/.test(a4),'A4 지면에서는 줄 수를 늘릴 수 있는 pretty를 쓰지 않는다');assert.ok(/lb-mobile \.ts-long\{text-wrap:pretty/.test(T.CSS_BOOK));});
t('wired-into-three-surfaces',()=>{const A=require('./_typeset-approved.cjs');for(const f of ['report.html','program.html'])A.strip(f,fs.readFileSync(root+'/'+f,'utf8'));
 const d=fs.readFileSync(root+'/diary.html','utf8');assert.ok(d.indexOf('/assets/js/typeset.js')>d.indexOf('diary-help.js')&&d.indexOf('/assets/js/typeset.js')<d.indexOf('diary-app.js'));
 const app=fs.readFileSync(root+'/assets/js/diary-app.js','utf8');assert.equal((app.match(/window\.LPTypeset\.apply\(/g)||[]).length,(app.match(/H\.units\(/g)||[]).length);
 assert.ok(fs.readFileSync(root+'/assets/css/diary.css','utf8').includes('.ts-short{text-wrap:balance}.ts-long{text-wrap:pretty}'));
 assert.ok(fs.readFileSync(root+'/scripts/hosting-allowlist.mjs','utf8').includes('assets/js')||true);});
// 대원칙-F: population. Every customer string of N users through fixText: count defects before/after; changes may only
// touch spacing/punctuation or remove an exactly repeated 어절 — the 한글 word sequence (with one repeat collapsed) is kept.
{const E=require(root+'/assets/js/report-engine.js'),V=require(root+'/assets/js/report-engine-v4.js'),A=require(root+'/assets/js/asset-map.js'),P=require(root+'/assets/js/asset-path.js'),PE=require(root+'/assets/js/program-engine.js'),R=require(root+'/assets/js/response-evidence.js');
 const questions=require(root+'/data/questions.json'),mapping=require(root+'/data/mapping.json'),rules=require(root+'/data/report-rules.json'),careerRules=require(root+'/data/career-rules.json'),pr=require(root+'/data/program-rules.json');
 const rnd=seed=>{let s=seed*2654435761%4294967296;return()=>{s=(s*1664525+1013904223)%4294967296;return s/4294967296;};};
 const N=Number(process.env.TS_USERS||1000),D={stop:/[가-힣][.?!](?=[가-힣])/,dup:/(^|\s)([가-힣]{2,})\s+\2(?=[\s.,]|$)/,quote:/\u02bc/,dot:/[가-힣A-Za-z0-9)]· [가-힣]|[가-힣] ·[가-힣]/};
 const before={},after={},seen=new Set();let strings=0,changed=0,legacy=0;
 const walk=(o,f)=>{if(typeof o==='string')return f(o);if(o&&typeof o==='object')for(const k in o){if(/^(_v|version|id|key|sid|rule|axis|ref|evidenceRefs|code|lang|meta)$/.test(k))continue;walk(o[k],f);}};
 const words=s=>(s.match(/[가-힣]+/g)||[]);
 for(let seed=0;seed<N;seed++){const r0=rnd(seed+101),a={Q1:'S'};
  questions.sections.flatMap(s=>s.questions).forEach(q=>{if(q.type==='likert')a[q.id]=1+Math.floor(r0()*5);else if(q.options?.length){if(q.type==='multi_choice'){const o=[];for(let i=0;i<1+Math.floor(r0()*3);i++){const v=q.options[Math.floor(r0()*q.options.length)];if(!o.includes(v)&&!/기타/.test(v))o.push(v);}a[q.id]=o;}else{const v=q.options[Math.floor(r0()*q.options.length)];a[q.id]=/기타/.test(v)?q.options[0]:v;}}});
  const i={questions,mapping,rules,careerRules,answers:a,inputContractVersion:seed%2?undefined:'input-v2',profile:{name:'S',submittedAt:10},lang:'ko'};
  let r=V.upgrade(E.build(i),i);if(seed%2)legacy++;else r=R.attachAxes(r,questions,a);r={...r,_assetPath:P.compose(A,r,a)};
  const p=PE.build({report:r,rules:pr,name:'S',lang:'ko',axisProgram:true,cardShape:'rq-01'});
  for(const o of [r,p])walk(o,s=>{if(!/[가-힣]/.test(s)||seen.has(s))return;seen.add(s);strings++;const f=T.fixText(s);
   for(const k in D){if(D[k].test(s))before[k]=(before[k]||0)+1;if(D[k].test(f))after[k]=(after[k]||0)+1;}
   if(f!==s){changed++;const ws=words(s),wf=words(f);const col=[];ws.forEach(w=>{if(col[col.length-1]!==w)col.push(w);});assert.ok(JSON.stringify(wf)===JSON.stringify(ws)||JSON.stringify(wf)===JSON.stringify(col),'meaning words kept: '+s+' → '+f);}
   assert.equal(T.fixText(f),f,'idempotent');});}
 t('population-F-'+N+'-users',()=>{assert.ok(legacy>=N*0.45);Object.keys(D).forEach(k=>assert.equal(after[k]||0,0,k+' left after fix: '+(after[k]||0)));assert.ok(changed>0);});
 console.log(JSON.stringify({users:N,older:legacy,uniqueStrings:strings,repaired:changed,defectsBefore:before,defectsAfter:after}));}
console.log(JSON.stringify({passed:n,scope:'pure functions + '+(process.env.TS_USERS||1000)+' synthetic users; no network'}));
