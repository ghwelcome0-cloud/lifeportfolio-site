'use strict';
// asset-type-card-v1 (대표 2026-10-12): 마이페이지 상단 4축 % 카드 → 고유성 기반 자산화 유형 카드.
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),root=path.join(__dirname,'..');
const src=fs.readFileSync(path.join(root,'assets/js/mypage-curation.js'),'utf8');let n=0;const ok=(c,m)=>{assert.ok(c,m);n++;};
const active=src.slice(src.indexOf('function renderActive(host)'),src.indexOf('function render(opts)'));
ok(!/buildAxisGridHtml\(\)/.test(active),'4-axis % grid is no longer drawn on mypage');
ok(/buildAssetCardHtml\(\)/.test(active),'asset type card is drawn');
const card=src.slice(src.indexOf('function buildAssetCardHtml'),src.indexOf('// 진단 미완료'));
ok(!/%|pct|점수|순위/.test(card),'no score or percentage');
ok(/report\._assetPath/.test(src)&&/asset-path-v1/.test(src),'reads only the stored _assetPath (no new calculation)');
ok(/open=path/.test(card)&&/report\.html\?sid=/.test(card),'links: report XI and diary 내 변화 찾기');
ok(/내 변화 찾기/.test(card),'older reports without asset path get the diary pathfinder');
ok(/이름표가 아니라 출발점이에요/.test(card),'not-a-label note');
ok(/min-height:44px/.test(src),'touch target ≥44px');
ok(/render\(\{ hasReport: true, sid: _latest && _latest\.sid \}\)/.test(fs.readFileSync(path.join(root,'mypage.html'),'utf8')),'mypage passes the latest sid');
// population: 1,000 synthetic users (half older without _assetPath) → card data always derivable or 안내.
{const w={localStorage:{setItem(){}}},d={};const fn=new Function('window','document',src.replace(/\}\)\(window, document\);\s*$/,'})(window,document);'));
 const E=require(root+'/assets/js/report-engine.js'),V=require(root+'/assets/js/report-engine-v4.js'),A=require(root+'/assets/js/asset-map.js'),P=require(root+'/assets/js/asset-path.js'),R=require(root+'/assets/js/response-evidence.js');
 const questions=require(root+'/data/questions.json'),mapping=require(root+'/data/mapping.json'),rules=require(root+'/data/report-rules.json'),careerRules=require(root+'/data/career-rules.json');
 const rnd=seed=>{let s=seed*2654435761%4294967296;return()=>{s=(s*1664525+1013904223)%4294967296;return s/4294967296;};};
 const N=Number(process.env.MP_USERS||1000);const names={};let none=0;const SEVEN=['밝힘','지음','펼침','돌봄','이음','세움','지킴'];
 const pick=new Function('r','var ap=r&&r._assetPath;return ap&&ap.version==="asset-path-v1"&&ap.type&&ap.type.name?ap.type.name:null;');
 for(let seed=0;seed<N;seed++){const r0=rnd(seed+505),a={Q1:'S'};
  questions.sections.flatMap(s=>s.questions).forEach(q=>{if(q.type==='likert')a[q.id]=1+Math.floor(r0()*5);else if(q.options?.length){if(q.type==='multi_choice'){const o=[];for(let i=0;i<1+Math.floor(r0()*3);i++){const v=q.options[Math.floor(r0()*q.options.length)];if(!o.includes(v)&&!/기타/.test(v))o.push(v);}a[q.id]=o;}else{const v=q.options[Math.floor(r0()*q.options.length)];a[q.id]=/기타/.test(v)?q.options[0]:v;}}});
  const i={questions,mapping,rules,careerRules,answers:a,inputContractVersion:seed%2?undefined:'input-v2',profile:{name:'S',submittedAt:10},lang:'ko'};
  let r=V.upgrade(E.build(i),i);if(!(seed%2)){r=R.attachAxes(r,questions,a);r={...r,_assetPath:P.compose(A,r,a)};}
  const nm=pick(r);if(!nm){none++;continue;}assert.ok(SEVEN.includes(nm),'one of seven: '+nm);names[nm]=(names[nm]||0)+1;}
 ok(none>=N*0.45&&Object.keys(names).length>=5,'population: older→안내, newer→one of seven ('+JSON.stringify(names)+')');}
console.log(JSON.stringify({passed:n}));
