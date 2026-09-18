'use strict';
// Actual HTML and browser engines; synthetic Auth/RTDB only. All requests are intercepted.
// No real login, customer record, outbound mail or deployment is performed.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const root=path.resolve(__dirname,'..');
const deps=process.env.LP_TEST_DEPENDENCIES?createRequire(path.resolve(process.env.LP_TEST_DEPENDENCIES,'package.json')):require;
const puppeteer=deps('puppeteer');
const E=require('../assets/js/report-engine.js'),V=require('../assets/js/report-engine-v4.js');
const data={};for(const [k,n]of Object.entries({questions:'questions',mapping:'mapping',rules:'report-rules',careerRules:'career-rules'}))data[k]=JSON.parse(fs.readFileSync(path.join(root,'data',n+'.json')));
const answers={Q1:'Synthetic Browser',Q2:'사이트에서 바로 확인'};
for(const [i,q]of data.questions.sections.flatMap(s=>s.questions).entries())answers[q.id]=q.type==='likert'?1+i%5:q.type==='multi_choice'?q.options.slice(0,2):q.options[0];
answers.Q75=['교육','예술','체육'];answers.Q77=['사람들과 소통하고 가르치는 활동'];
const profile={name:'Synthetic Browser',email:'synthetic@example.invalid',submittedAt:'2026-01-01T00:00:00Z'};
const results=[];
function boot(payload,session){return `<script>
window.__writes=[];window.__initialBookScrolls=0;window.addEventListener('message',e=>{if(e.data&&e.data.t==='lb-scrolltop')window.__initialBookScrolls++;});window.__state={payload:${JSON.stringify(payload)},session:${JSON.stringify(session)}};
const mockUser={uid:'synthetic-browser',email:'synthetic@example.invalid',getIdToken:async()=> 'synthetic-token'};
const initializeApp=()=>({}),initializeAppCheck=()=>({}),ReCaptchaEnterpriseProvider=function(){},getAuth=()=>({currentUser:mockUser}),getDatabase=()=>({});
const onAuthStateChanged=(_a,fn)=>{setTimeout(()=>fn(mockUser),0);return ()=>{};};
const ref=(_db,p)=>p,serverTimestamp=()=>({'.sv':'timestamp'}),push=()=>({key:'synthetic-sid'});
function mockRead(p){if(p.startsWith('responses/'))return __state.session;if(p.startsWith('reports/'))return __state.payload;return null;}
const get=async(p)=>({exists:()=>mockRead(p)!==null,val:()=>mockRead(p)}),onValue=(p,fn)=>{get(p).then(fn);return ()=>{};};
const set=async(p,v)=>{__writes.push({p,method:'set'});},update=async(p,v)=>{__writes.push({p,method:'update'});};
</script>`;}
(async()=>{
 const browser=await puppeteer.launch({headless:true,...(process.env.LP_BROWSER_PATH?{executablePath:process.env.LP_BROWSER_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const cases=[];
  for(const lang of ['ko','en'])for(const width of [375,1280])cases.push({flow:'render',lang,width});
  for(const flow of ['initial','regen'])for(const failure of ['empty','old-rules','404','stale-engine','script-error'])cases.push({flow,failure,lang:'ko',width:375});
  for(const lang of ['ko','en'])for(const failure of ['cancel-removal','manual'])cases.push({flow:'regen',failure,lang,width:1280});
  for(const c of cases){
   const page=await browser.newPage();await page.setViewport({width:c.width,height:900});
   const input={...data,answers,profile,lang:c.lang};const report=V.upgrade(E.build(input),input);
   const payload={report,editCount:0,manualOverrideHtml:c.failure==='manual'?'<p>Manual preserved</p>':null};
   const session={answers:{...answers},status:'submitted',lang:c.lang,...profile};
   if(c.failure==='cancel-removal')delete session.answers.Q77;
   const file=c.flow==='initial'?'report-loading.html':'report.html';
   const html=fs.readFileSync(path.join(root,file),'utf8').replace(/import\s+[\s\S]*?from\s+"https:\/\/www\.gstatic\.com\/firebasejs\/[^"\n]+";/g,'');
   const pageErrors=[],writes=[],dialogs=[];let networkAttempted=0;
   page.on('pageerror',e=>pageErrors.push(e.message));
   page.on('dialog',async d=>{dialogs.push(d.message());if(c.failure==='cancel-removal'&&dialogs.length===2)await d.dismiss();else await d.accept();});
   await page.setRequestInterception(true);
   page.on('request',async req=>{
    const u=new URL(req.url());
    try{
     if(u.hostname==='audit.invalid'){
      if(req.isNavigationRequest())return req.respond({status:200,contentType:'text/html',body:html.replace('<script type="module">',boot(c.flow==='initial'?null:payload,session)+'<script type="module">')});
      const rel=decodeURIComponent(u.pathname).replace(/^\//,'');const abs=path.resolve(root,rel);
      if(!abs.startsWith(root+path.sep)||!fs.existsSync(abs)||!fs.statSync(abs).isFile())return req.abort();
      if(rel==='data/career-rules.json'&&['empty','old-rules','404'].includes(c.failure))return req.respond({status:c.failure==='404'?404:200,contentType:'application/json',body:c.failure==='empty'?'{}':fs.readFileSync(abs,'utf8').replace('"version": "1.0.0"','"version": "old"')});
      if(rel==='assets/js/career-engine.js'&&c.failure==='script-error')return req.abort();
      let body=fs.readFileSync(abs);if(rel==='assets/js/career-engine.js'&&c.failure==='stale-engine')body=Buffer.from(body.toString().replace('semantic-resources-2026-09-18-v2','stale-contract'));
      return req.respond({status:200,contentType:rel.endsWith('.js')?'application/javascript':rel.endsWith('.json')?'application/json':rel.endsWith('.css')?'text/css':'application/octet-stream',body});
     }
     if(u.hostname.endsWith('.firebasedatabase.app')){
      const p=u.pathname.replace(/^\//,'').replace(/\.json$/,'');
      if(req.method()!=='GET'){writes.push({p,method:req.method()});return req.respond({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:'null'});}
      const value=p.startsWith('responses/')?session:p.startsWith('reports/')?(c.flow==='initial'?null:payload):null;
      return req.respond({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(value)});
     }
     networkAttempted++;return req.abort();
    }catch(e){pageErrors.push(e.message);if(!req.isInterceptResolutionHandled())await req.abort();}
   });
   await page.goto('https://audit.invalid/'+file+'?sid=synthetic-sid&lang='+c.lang,{waitUntil:'domcontentloaded'});
   if(c.flow==='render'){
    await page.waitForFunction(()=>typeof window.__buildBookHTML==='function'&&window._lpReportPayload,{timeout:15000});
    const book=await page.evaluate(()=>window.__buildBookHTML('classic'));assert.ok(book.startsWith('<!DOCTYPE'),book.slice(0,200));
    const bookPage=await browser.newPage();await bookPage.setRequestInterception(true);bookPage.on('request',r=>r.abort());
    const bookErrors=[];bookPage.on('pageerror',e=>bookErrors.push(e.message));
    await bookPage.setContent(book,{waitUntil:'domcontentloaded'});
    const refs=report.sections.find(s=>s.id==='career_education').content._referenceEvidence.evidence;
    await bookPage.waitForFunction(()=>document.querySelectorAll('.page').length>5);
    const text=await bookPage.$eval('body',e=>e.textContent);
    for(const r of refs){assert.ok(text.includes(r.job),r.job);assert.ok(text.includes(r.course),r.course);assert.ok(text.includes(r.domain),r.domain);}
    assert.ok(text.includes(c.lang==='en'?'Reference evidence':'참고 예시의 근거'));
    const labels=await bookPage.$$eval('.cur-ex__label',nodes=>nodes.map(n=>n.textContent));
    assert.ok(labels.length>=2);for(const label of labels)assert.ok(c.lang==='en'? !/[가-힣]/.test(label):label.includes('비순위'),label);
    assert.ok(!text.includes('가장 가까운 참고'));assert.equal(bookErrors.length,0,bookErrors.join('\n'));
    await bookPage.close();
   }else if(c.flow==='regen'){
    await page.waitForFunction(()=>window._lpReportPayload,{timeout:15000});
    // Wait for book mounting/visibility changes before exercising a physical click.
    await page.waitForFunction(()=>document.querySelector('#statusBox')?.classList.contains('success'),{timeout:15000});
    await page.locator('#regenBtn').click();
    for(let i=0;i<100&&dialogs.length===0;i++)await new Promise(r=>setTimeout(r,20));
    await page.waitForFunction(()=>document.querySelector('#regenBtn').disabled===false,{timeout:20000});
    await new Promise(r=>setTimeout(r,100));
    assert.ok(dialogs.length>=1);
    if(c.failure==='cancel-removal')assert.equal(dialogs.length,2,dialogs.join('\n'));
    else assert.ok(dialogs.some(x=>/mismatch|unavailable|manual|수동|실패/.test(x)),dialogs.join('\n'));
   }else{
    await page.waitForFunction(()=>document.body.textContent.includes('리포트 생성 중 오류'),{timeout:20000});
   }
   assert.equal(await page.evaluate(()=>window.__initialBookScrolls),0,'Initial book rendering must not steal the parent scroll position');
   const sdkWrites=await page.evaluate(()=>window.__writes);
   assert.equal(writes.length+sdkWrites.length,0,JSON.stringify({case:c,writes,sdkWrites}));
   assert.equal(pageErrors.length,0,pageErrors.join('\n'));
   results.push({...c,passed:true,storageWrites:0,externalRequestsBlocked:networkAttempted});console.log('PASS '+JSON.stringify(c));await page.close();
  }
  console.log(JSON.stringify({actualHTML:true,syntheticAuthAndDB:true,passed:results.length,results}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
