'use strict';
// PROG-01 render check: real program.html with a synthetic linked program; no network, no writes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),puppeteer=require('puppeteer');
const T=require('./test-response-evidence.cjs'),R=require('../assets/js/response-evidence.js'),P=require('../assets/js/program-engine.js');
const a=T.base(0);a.Q39=['기타 (직접 입력)'];a.Q40='입문 개발자에게 오류 원인을 코드 실행으로 설명합니다.';
const report=R.attachAxes(T.build(a,'ko','input-v2').r,require('../data/questions.json'),a);
const program=P.build({report,rules:require('../data/program-rules.json'),name:'합성',lang:'ko',axisProgram:true});
const item=program._axisProgram.items[0],payload={program,lang:'ko'};
const boot=`<script>
window.__writes=[];const data=${JSON.stringify(payload)};
const user={uid:'synthetic',email:'synthetic@example.invalid',getIdToken:async()=> 'synthetic'};
const initializeApp=()=>({}),initializeAppCheck=()=>({}),ReCaptchaEnterpriseProvider=function(){},getAuth=()=>({currentUser:user}),getDatabase=()=>({});
const onAuthStateChanged=(_a,fn)=>{setTimeout(()=>fn(user),0);return ()=>{};};
const ref=(_d,p)=>p,serverTimestamp=()=>({'.sv':'timestamp'});
const get=async p=>({exists:()=>p.startsWith('programs/'),val:()=>p.startsWith('programs/')?data:null});
const set=async(p,v)=>__writes.push(p),update=set;
</script>`;
(async()=>{const browser=await puppeteer.launch({headless:true,...(process.env.LP_BROWSER_PATH?{executablePath:process.env.LP_BROWSER_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});let count=0;
try{for(const width of [375,1280]){
  const source=fs.readFileSync(path.join(root,'program.html'),'utf8');
  const html=source.replace(/import\s+[\s\S]*?from\s+"https:\/\/www\.gstatic\.com\/firebasejs\/[^"\n]+";/g,'').replace('<script type="module">',boot+'<script type="module">');
  const page=await browser.newPage();await page.setViewport({width,height:900});const errors=[],writes=[];
  page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);
  page.on('request',async req=>{try{const u=new URL(req.url());
   if(u.hostname==='reader.invalid'){
    if(req.isNavigationRequest())return req.respond({status:200,contentType:'text/html',body:html});
    const rel=decodeURIComponent(u.pathname).replace(/^\//,''),file=path.resolve(root,rel);
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return req.abort();
    return req.respond({status:200,contentType:rel.endsWith('.js')?'application/javascript':rel.endsWith('.json')?'application/json':rel.endsWith('.css')?'text/css':'application/octet-stream',body:fs.readFileSync(file)});
   }
   if(u.hostname.endsWith('.firebasedatabase.app')){
    if(req.method()!=='GET'){writes.push(req.method());return req.abort();}
    return req.respond({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(u.pathname.startsWith('/programs/')?payload:null)});
   }
   return req.abort();
  }catch(e){errors.push(e.message);if(!req.isInterceptResolutionHandled())await req.abort();}});
  await page.goto('https://reader.invalid/program.html?sid=s_123_synthetic',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#lbFrame')?.contentDocument?.querySelector('.page'),{timeout:15000});
  const text=await page.evaluate(()=>document.body.innerText+'\n'+document.querySelector('#lbFrame').contentDocument.body.innerText);
  const book=await page.evaluate(()=>window.__buildProgramBookHTML('keepsake'));
  for(const s of [item.action,item.artifact,item.reuse,item.hypothesis])assert.ok(text.includes(s)||book.includes(s),'Rendered program must show: '+s);
  assert.ok(book.includes(item.doneWhen),'Done-when must reach the book');
  const overflow=await page.evaluate(()=>{const d=document.querySelector('#lbFrame').contentDocument;return Array.from(d.querySelectorAll('.page')).filter(p=>p.scrollWidth>p.clientWidth+2).length;});
  assert.equal(overflow,0,'No horizontal overflow at '+width);
  assert.equal(errors.length,0,errors.join('\n'));assert.equal(writes.length+await page.evaluate(()=>__writes.length),0);
  await page.close();count++;
 }}finally{await browser.close();}
 console.log('PASS PROG-01 program render: linked activity, artifact and next use visible at '+count+' widths; no writes');
})().catch(e=>{console.error(e);process.exit(1);});
