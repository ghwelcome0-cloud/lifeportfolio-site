'use strict';
// Chromium enforces the real HTTP+meta policy intersection. Do not bypass CSP.
// All requests are intercepted locally; native Fetch reaches a synthetic callable
// response only if the browser allows the connection. No customer/server writes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const puppeteer=require('puppeteer'),minimatch=require('minimatch');
const root=path.resolve(__dirname,'..'),origin='https://lifeportfolio.co.kr';
const endpoint='https://asia-northeast3-lifeporfolio.cloudfunctions.net/verifyB2BCode';
const config=JSON.parse(fs.readFileSync(path.join(root,'firebase.json'))).hosting.find(x=>x.target==='public');
function headersFor(url){const headers={};for(const r of config.headers||[])if(minimatch(url,r.source,{dot:true})||minimatch(url.replace(/^\//,''),r.source.replace(/^\//,''),{dot:true}))for(const h of r.headers)headers[h.key.toLowerCase()]=h.value;return headers;}
(async()=>{const browser=await puppeteer.launch({headless:true,...(process.env.LP_BROWSER_PATH?{executablePath:process.env.LP_BROWSER_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});let passed=0;
try{
 for(const file of ['suvey.html','b2b-join.html','report-loading.html'])for(const suffix of ['', '.html'])for(const width of [375,1280])for(const scenario of ['success','server-denial','blocked-header','blocked-unrelated',...(file!=='b2b-join.html'?['old-meta']:[])]){
  const page=await browser.newPage();await page.setViewport({width,height:900});
  let html=fs.readFileSync(path.join(root,file),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
  if(scenario==='old-meta')html=html.replace("connect-src 'self' https://asia-northeast3-lifeporfolio.cloudfunctions.net", "connect-src 'self'");
  const pathname='/'+file.replace('.html',suffix),headers=headersFor(pathname);assert.ok(headers['content-security-policy']);
  if(scenario==='blocked-header')headers['content-security-policy']+="; connect-src 'self'";
  const target=scenario==='blocked-unrelated'?'https://unrelated-cloudfunctions.example.invalid/verify':endpoint;
  let reached=0;
  await page.setRequestInterception(true);page.on('request',r=>{
   if(r.isNavigationRequest())return r.respond({status:200,contentType:'text/html',headers,body:html});
   if(r.url()===endpoint){if(r.method()==='OPTIONS')return r.respond({status:204,headers:{'access-control-allow-origin':origin,'access-control-allow-headers':'content-type','access-control-allow-methods':'POST'}});reached++;return r.respond({status:scenario==='server-denial'?403:200,contentType:'application/json',headers:{'access-control-allow-origin':origin},body:JSON.stringify(scenario==='server-denial'?{error:{status:'PERMISSION_DENIED'}}:{result:{ok:true,survey:{sid:'s_123_group',data:{status:'in_progress'}}}})});}
   return r.abort();
  });
  await page.goto(origin+pathname+'?b2b=1',{waitUntil:'domcontentloaded'});
  const result=await page.evaluate(async({target,resume})=>{const violations=[];const listener=e=>{if(e.effectiveDirective==='connect-src'&&e.disposition==='enforce')violations.push(e.blockedURI);};document.addEventListener('securitypolicyviolation',listener);let outcome;try{const r=await fetch(target,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({data:resume?{resumeSurvey:true}:{orgCode:'TEST-ORG',accessCode:'ABCD-EFGH'}})});outcome={status:r.status,data:await r.json()};}catch(e){outcome={error:e.name};}await new Promise(r=>setTimeout(r,30));document.removeEventListener('securitypolicyviolation',listener);return {...outcome,violations};},{target,resume:file==='suvey.html'});
  if(['old-meta','blocked-header'].includes(scenario)){assert.equal(reached,0);assert.ok(result.violations.length>0);assert.ok(result.error);}
  else if(scenario==='blocked-unrelated') {assert.equal(reached,0);if(file!=='b2b-join.html')assert.ok(result.violations.length>0);}
  else{assert.equal(reached,1);assert.deepEqual(result.violations,[]);assert.equal(result.status,scenario==='success'?200:403);}
  passed++;console.log('PASS '+file+' '+suffix+' '+width+' '+scenario);await page.close();
 }
 console.log(JSON.stringify({passed,scope:'native Fetch under actual enforced CSP; synthetic intercepted responses; no real Auth or customer data'}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
