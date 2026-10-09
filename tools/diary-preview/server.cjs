'use strict';
// Preview ONLY: real diary.html + mypage card + homepage 살아냄 link mock, served with the Firebase SDK
// replaced by a shim that calls the REAL server module (functions/_diary_module.js) against the LOCAL
// RTDB emulator. Synthetic account + synthetic report/program. No production project or customer data.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const root=path.resolve(__dirname,'../..');
process.env.FIREBASE_DATABASE_EMULATOR_HOST=process.env.FIREBASE_DATABASE_EMULATOR_HOST||'127.0.0.1:9300';
if(!/^127\.0\.0\.1:/.test(process.env.FIREBASE_DATABASE_EMULATOR_HOST))throw Error('local emulator only');
const admin=createRequire(path.join(root,'functions/package.json'))('firebase-admin');
const project='demo-lp-b2b-stability';admin.initializeApp({projectId:project,databaseURL:`https://${project}-default-rtdb.firebaseio.com`});
const M=require(path.join(root,'functions/_diary_module.js'));
const T=require(path.join(root,'scripts/test-response-evidence.cjs')),R=require(path.join(root,'assets/js/response-evidence.js')),P=require(path.join(root,'assets/js/program-engine.js'));
const UID='preview-user',SID='s_1791440430847_preview';
async function seed(){
 const a=T.base(0);a.Q39=['기타 (직접 입력)'];a.Q40='입문 개발자에게 오류 원인을 코드 실행으로 설명합니다.';
 const r=R.attachAxes(T.build(a,'ko','input-v2').r,require(path.join(root,'data/questions.json')),a);r.profile.name='김하늘';
 const p=P.build({report:r,rules:require(path.join(root,'data/program-rules.json')),name:'김하늘',lang:'ko',publishedAt:new Date(0),axisProgram:true});
 await admin.database().ref('reports/'+UID+'/'+SID).set({sid:SID,report:r});await admin.database().ref('responses/'+UID+'/'+SID+'/answers').set(a);await admin.database().ref('programs/'+UID+'/'+SID).set({sid:SID,program:p});
}
const shim=`<script>
const initializeApp=()=>({}),getAuth=()=>({});
const onAuthStateChanged=(_a,fn)=>{setTimeout(()=>fn(new URLSearchParams(location.search).get('signedout')?null:{uid:'preview'}),0);return()=>{};};
const getFunctions=()=>({});
const httpsCallable=()=>async data=>{const r=await fetch('/__preview/call',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});const out=await r.json();if(out.error){const e=new Error(out.message);e.code=out.error;throw e;}return {data:out};};
</script>`;
const ribbon='<div class="preview-ribbon">미리보기 · 합성 계정·합성 리포트 · 실제 사이트와 연결되지 않음</div>';
function page(file){
 let html=fs.readFileSync(path.join(root,file),'utf8');
 html=html.replace(/^\s*import\s+[\s\S]*?from\s+"https:\/\/www\.gstatic\.com\/firebasejs\/[^"]+";\s*$/gm,'');
 html=html.replace('<script type="module">',shim+'<script type="module">');
 return html.replace('<div id="dy-app" hidden>',ribbon+'<div id="dy-app" hidden>');
}
const hub=()=>`<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>다이어리 미리보기</title><link rel="stylesheet" href="/assets/fonts/pretendard/pretendard.css"><style>body{font-family:Pretendard,system-ui,sans-serif;background:#FAF7F0;margin:0;color:#2C2C2C}
.bar{background:#fef3c7;color:#92400e;font-size:13px;padding:6px 12px;text-align:center}main{max-width:860px;margin:0 auto;padding:20px 16px 48px}
h1{font-size:20px;color:#0A3D2A;margin:8px 0 4px}h2{font-size:15px;color:#0A3D2A;margin:26px 0 8px}p{font-size:14px;line-height:1.65;margin:0 0 8px}
.card{background:#fff;border:1px solid #e5e0d3;border-radius:14px;padding:16px;display:flex;flex-wrap:wrap;gap:12px;align-items:center}
.info{flex:1 1 220px}.t{margin:0 0 4px;font-size:16px;font-weight:700}.m{margin:0;font-size:13px;color:#6b7280}
.acts{display:flex;flex-wrap:wrap;gap:8px}.btn{display:inline-flex;align-items:center;min-height:44px;padding:0 14px;border-radius:8px;text-decoration:none;font-size:14px;border:1px solid #0f766e;color:#0f766e;background:#fff}
.btn.acc{background:#0f766e;color:#fff}.btn.diary{border-color:#0A3D2A;background:#0A3D2A;color:#fff;outline:3px solid #C9A04F;outline-offset:2px}
.work{background:#fff;border:1px solid #e5e0d3;border-radius:14px;padding:16px}.work small{color:#6b7280}
.keep{display:inline-flex;align-items:center;gap:6px;margin-top:8px;min-height:44px;padding:0 14px;border-radius:999px;background:#0A3D2A;color:#fff;text-decoration:none;font-size:14px;font-weight:600;outline:3px solid #C9A04F;outline-offset:2px}
ul{font-size:14px;line-height:1.7;padding-left:20px}</style></head><body><div class="bar">미리보기 · 합성 계정·합성 리포트 · 실제 사이트/고객 데이터와 연결되지 않음</div><main>
<h1>📔 인생포트폴리오 디지털 다이어리 — 1차 미리보기</h1><p>금색 테두리가 새로 생기는 연결 지점입니다. 다른 버튼과 화면은 바뀌지 않습니다.</p>
<h2>① 마이페이지 · 리포트 카드</h2><article class="card"><div style="font-size:28px" aria-hidden="true">📄</div><div class="info"><p class="t">김하늘님의 인생포트폴리오</p><p class="m">생성일: 2026-10-08</p></div>
<div class="acts"><a class="btn acc" href="#">리포트 보기</a><a class="btn" href="#">🚀 실행 프로그램</a><a class="btn diary" href="/diary.html?sid=${SID}" id="open-diary">📔 나의 다이어리</a></div></article>
<h2>② 홈페이지 · 살아냄 화면 (안내 문구 아래)</h2><div class="work"><small>이 페이지를 열어둔 동안만 글이 유지돼요. 보관하려면 내려받으세요. 다른 사람의 개인정보는 빼주세요.</small><br>
<a class="keep" href="/diary.html" id="home-link">📔 로그인하면 다이어리에 보관됩니다 ↗</a></div>
<h2>③ 바로 보기</h2><ul><li><a href="/diary.html?sid=${SID}">다이어리 열기 (리포트 연결)</a></li><li><a href="/diary-guide.html">다이어리 해설서</a></li><li><a href="/diary.html?signedout=1">로그인하지 않았을 때</a></li><li><a href="/__preview/reset">미리보기 기록 모두 지우기</a> (처음 상태로)</li></ul>
</main></body></html>`;
const TYPES={'.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.woff2':'font/woff2','.ttf':'font/ttf','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
const send=(res,code,type,body)=>{res.writeHead(code,{'content-type':type,'cache-control':'no-store'});res.end(body);};
http.createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://x');
 if(u.pathname==='/'||u.pathname==='/preview')return send(res,200,'text/html; charset=utf-8',hub());
 if(u.pathname==='/diary.html'||u.pathname==='/diary')return send(res,200,'text/html; charset=utf-8',page('diary.html'));
 if(u.pathname==='/diary-guide.html'||u.pathname==='/diary-guide')return send(res,200,'text/html; charset=utf-8',fs.readFileSync(path.join(root,'diary-guide.html'),'utf8').replace('<body>','<body><div style="background:#fef3c7;color:#92400e;font:13px system-ui;padding:6px 12px;text-align:center">미리보기 · 실제 사이트와 연결되지 않음</div>'));
 if(u.pathname==='/mypage'||u.pathname==='/login'){res.writeHead(302,{location:'/'});return res.end();}
 if(u.pathname==='/__preview/call'&&req.method==='POST'){let b='';for await(const c of req)b+=c;
  try{return send(res,200,'application/json',JSON.stringify(await M.handle({auth:{uid:UID},data:JSON.parse(b)})));}
  catch(e){return send(res,200,'application/json',JSON.stringify({error:e.code||'internal',message:e.message}));}}
 if(u.pathname==='/__preview/reset'){await admin.database().ref('diary/'+UID).remove();res.writeHead(302,{location:'/'});return res.end();}
 if(u.pathname.startsWith('/assets/')){const f=path.join(root,path.normalize(u.pathname).replace(/^(\.\.[/\\])+/,''));
  if(f.startsWith(path.join(root,'assets'))&&fs.existsSync(f)&&fs.statSync(f).isFile())return send(res,200,TYPES[path.extname(f)]||'application/octet-stream',fs.readFileSync(f));}
 send(res,404,'text/plain','not found');
}catch(e){send(res,500,'text/plain',String(e.message));}}).listen(3300,'0.0.0.0',async()=>{await seed();console.log('diary preview on :3300');});
