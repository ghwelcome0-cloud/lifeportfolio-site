const root='/home/user/main-wt';
const E=require(root+'/assets/js/report-engine.js'),V=require(root+'/assets/js/report-engine-v4.js'),A=require(root+'/assets/js/asset-map.js'),P=require(root+'/assets/js/asset-path.js');
const questions=require(root+'/data/questions.json'),mapping=require(root+'/data/mapping.json'),rules=require(root+'/data/report-rules.json'),careerRules=require(root+'/data/career-rules.json');
const PE=require(root+'/assets/js/program-engine.js'),pr=require(root+'/data/program-rules.json'),R=require(root+'/assets/js/response-evidence.js');
function rnd(seed){let s=seed*2654435761%4294967296;return()=>{s=(s*1664525+1013904223)%4294967296;return s/4294967296;};}
const seed=+process.argv[2],NM=process.argv[3],OUT=process.argv[4];const r0=rnd(seed+1),a={Q1:NM};
 questions.sections.flatMap(s=>s.questions).forEach(q=>{if(q.type==='likert')a[q.id]=1+Math.floor(r0()*5);else if(q.options?.length){if(q.type==='multi_choice'){const o=[];for(let i=0;i<1+Math.floor(r0()*3);i++){const v=q.options[Math.floor(r0()*q.options.length)];if(!o.includes(v)&&!/기타/.test(v))o.push(v);}a[q.id]=o;}else{const v=q.options[Math.floor(r0()*q.options.length)];a[q.id]=/기타/.test(v)?q.options[0]:v;}}});
 const input={questions,mapping,rules,careerRules,answers:a,profile:{name:NM,submittedAt:10},lang:'ko'};
 let r=V.upgrade(E.build(input),input);const p=P.compose(A,r,a);
 r=R.attachAxes(r,questions,a);r={...r,_assetPath:p};
 const pg=PE.build({report:r,rules:pr,name:NM,lang:'ko',publishedAt:new Date(0),axisProgram:true});
 require('fs').writeFileSync(OUT,JSON.stringify({seed,path:p,quest:pg._assetQuest},null,1));
 console.log(p.sentence);console.log(p.reasons, p.missionAsk, p.others.map(o=>o.name+':'+o.focus));
