'use strict';
// Real program HTML/renderer with synthetic Auth and data; no live customer access.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),puppeteer=require('puppeteer');
const E=require('../assets/js/report-engine.js'),V=require('../assets/js/report-engine-v4.js'),P=require('../assets/js/program-engine.js');
const input={questions:require('../data/questions.json'),mapping:require('../data/mapping.json'),rules:require('../data/report-rules.json'),careerRules:require('../data/career-rules.json'),answers:{Q1:'Synthetic Reader'},profile:{name:'Synthetic Reader',submittedAt:10},lang:'ko'};
const report=V.upgrade(E.build(input),input),program=P.build({report,rules:require('../data/program-rules.json'),name:'Synthetic Reader',lang:'ko'});
const payload={program,lang:'ko'};
const ko=require('../assets/i18n/ko.json');
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
try{
 for(const width of [375,1280,1440]){
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
  await page.evaluate(()=>document.querySelector('#lbFrame').contentWindow.postMessage({t:'lb-go',anchor:'ch3'},'*'));
  await page.waitForFunction(()=>document.querySelector('#lbFrame').contentDocument.querySelector('.page.lb-active')?.textContent.includes('3개월'));
  for(const full of [false,true]){
   if(full){await page.click('#lbFull');await page.waitForFunction(()=>!!document.fullscreenElement);}
   await page.click('#lbZoomIn');await page.click('#lbZoomFit');
   await new Promise(r=>setTimeout(r,250));
   const bounds=await page.evaluate(()=>{const f=document.querySelector('#lbFrame'),b=document.querySelector('.lb-stage__bar'),p=f.contentDocument.querySelector('.page.lb-active'),r=p.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,viewW:f.clientWidth,viewH:f.clientHeight,bar:b.getBoundingClientRect().height,fit:getComputedStyle(document.querySelector('#lbZoomFit')).display,opacity:getComputedStyle(b).opacity};});
   assert.notEqual(bounds.fit,'none');assert.ok(bounds.left>=-2&&bounds.right<=bounds.viewW+2,JSON.stringify({width,full,bounds}));
   assert.ok(bounds.top>=-2&&bounds.bottom<=bounds.viewH+2,JSON.stringify({width,full,bounds}));
   if(full){await page.mouse.move(width-2,898);assert.equal(await page.$eval('.lb-stage__bar',e=>getComputedStyle(e).opacity),'1');await page.evaluate(()=>document.exitFullscreen());}
   count++;
  }
  assert.equal(errors.length,0,errors.join('\n'));assert.equal(writes.length+await page.evaluate(()=>__writes.length),0);
  const book=await page.evaluate(()=>window.__buildProgramBookHTML('keepsake'));
  assert.ok(book.includes('할 일을 작게 나눈 활동 카드입니다.'));assert.ok(book.includes('해 본 일과 다음 할 일'));
  for(const key of ['btn_email','btn_guide','lb_chapters'])assert.equal(await page.$eval('[data-i18n="program.'+key+'"]',e=>e.textContent),ko.program[key]);
  await page.close();
 }
 // Static fallback and translated button labels must agree on both pages.
 for(const section of ['report','program']){
  const html=fs.readFileSync(path.join(root,section+'.html'),'utf8');
  for(const key of ['btn_email','btn_guide','lb_chapters']){const match=new RegExp('<[^>]*data-i18n="'+section+'\\.'+key+'"[^>]*>([^<]*)<').exec(html);assert.ok(match);assert.equal(match[1],ko[section][key]);}
 }
 console.log('PASS '+count+' real program fit/fullscreen cases; guidance, print source and no-write checks');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
