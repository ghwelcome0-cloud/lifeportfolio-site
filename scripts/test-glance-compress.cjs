'use strict';
// Program I page compressed glance (owner 2026-10-11): the renderer splits engine sentences into short tags.
// Checks over many real-engine programs (KO/EN, older + new reports): either a clean split that keeps every
// content word of the source, or the exact source sentence as fallback. Never empty, never invented words.
const assert=require('node:assert/strict'),fs=require('node:fs'),root=require('node:path').resolve(__dirname,'..');
const E=require(root+'/assets/js/report-engine.js'),V=require(root+'/assets/js/report-engine-v4.js'),A=require(root+'/assets/js/asset-map.js'),P=require(root+'/assets/js/asset-path.js'),PE=require(root+'/assets/js/program-engine.js');
const questions=require(root+'/data/questions.json'),mapping=require(root+'/data/mapping.json'),rules=require(root+'/data/report-rules.json'),careerRules=require(root+'/data/career-rules.json'),pr=require(root+'/data/program-rules.json');
const src=fs.readFileSync(root+'/program.html','utf8'),a0=src.indexOf('// ②③ 압축형'),a1=src.indexOf('"var idr=[];",',a0);assert.ok(a0>0&&a1>a0);
const lines=src.slice(src.indexOf('\n',a0)+1,a1).trim().split('\n').map(l=>JSON.parse(l.replace(/,$/,'')));
const G=new Function('sc',lines.join('\n')+';return {gxStr,gxGap,gxEnv,gxPaths};')(x=>String(x));
// The whole book render script (one string array in program.html) must parse — one missing quote blanks every program page.
{const b0=src.indexOf('      function bookRenderScript(){'),b1=src.indexOf('\n      }\n',b0);assert.ok(b0>0&&b1>b0,'bookRenderScript');
 const body=new Function(src.slice(b0,b1+8)+';return bookRenderScript;')()();assert.ok(typeof body==='string'&&body.length>10000);new Function(body);
 assert.ok(body.includes('DATA.diaryQuestHref?')&&body.includes('&open=quest')===false,'link href comes from data only');}
const rnd=seed=>{let s=seed*2654435761%4294967296;return()=>{s=(s*1664525+1013904223)%4294967296;return s/4294967296;};};
const N=Number(process.env.GX_USERS||600),hit={str:0,gap:0,env:0,paths:0};let n=0;
const words=t=>String(t).replace(/[.,·—()‘’“”]/g,' ').split(/\s+/).filter(w=>w.length>1);
for(let seed=0;seed<N;seed++){const r0=rnd(seed+31),a={Q1:'S'};
 questions.sections.flatMap(s=>s.questions).forEach(q=>{if(q.type==='likert')a[q.id]=1+Math.floor(r0()*5);else if(q.options?.length){if(q.type==='multi_choice'){const o=[];for(let i=0;i<1+Math.floor(r0()*3);i++){const v=q.options[Math.floor(r0()*q.options.length)];if(!o.includes(v)&&!/기타/.test(v))o.push(v);}a[q.id]=o;}else{const v=q.options[Math.floor(r0()*q.options.length)];a[q.id]=/기타/.test(v)?q.options[0]:v;}}});
 const lang=seed%5===4?'en':'ko',i={questions,mapping,rules,careerRules,answers:a,lang,inputContractVersion:seed%2?undefined:'input-v2',profile:{name:'S',submittedAt:10}};
 const r=V.upgrade(E.build(i),i),ap=lang==='ko'?P.compose(A,r,a):null,p=PE.build({report:ap?{...r,_assetPath:ap}:r,rules:pr,name:'S',lang,axisProgram:true,cardShape:'rq-01'});
 const s=p.cover.summary;assert.ok(s&&s.strengths&&s.gaps&&s.env&&s.newPaths,'summary '+seed);
 const keep=(parts,full,label)=>{const w=words(parts.join(' '));assert.ok(w.length,label+' empty');w.forEach(x=>assert.ok(full.includes(x),label+' invented '+x+' | '+full));};
 const st=G.gxStr(s.strengths);if(st){hit.str++;assert.ok(st.length>=2&&st.length<=3);keep(st,s.strengths,'str');st.forEach(x=>assert.ok(x.length<=40&&!/[.]$/.test(x),x));}
 const g=G.gxGap(s.gaps);assert.ok(g[0]);keep(g,s.gaps.replace('보는','보기'),'gap');if(g[0]!==s.gaps)hit.gap++;
 const e=G.gxEnv(s.env);if(e){hit.env++;keep(e,s.env,'env');}
 const pa=G.gxPaths(s.newPaths);if(pa){hit.paths++;keep(pa,s.newPaths,'paths');}
 if(lang==='ko'&&p._assetFan){const f=p._assetFan;f.rings.forEach(x=>{assert.ok(x.head&&!/—/.test(x.head+x.sub+x.line),'no dash '+x.line);});f.weekly.concat(f.accrue).forEach(l=>assert.ok(!/—/.test(l),l));}
 n++;}
const ko=Math.ceil(N*4/5);
assert.ok(hit.str>=ko*0.9&&hit.env>=ko*0.9&&hit.paths>=ko*0.9&&hit.gap>=ko*0.9,'KO split rate '+JSON.stringify(hit)+' of '+ko);
console.log('PASS glance compress: '+n+' programs (KO/EN, older+new), split '+JSON.stringify(hit)+' of '+ko+' KO; no invented words, fallback = source sentence; no dash in 부채꼴');
