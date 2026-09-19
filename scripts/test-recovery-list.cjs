'use strict';
// Real source HTML/styles and native Fetch; only Auth/RTDB responses are synthetic.
// This suite never connects to production or operates on customer records.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'mypage.html'),'utf8');
const a=source.indexOf('    function _renderPendingReports('),b=source.indexOf('    async function _renderInProgressSessions',a);
const logic=source.slice(a,b);assert.ok(a>0&&b>a);
const section=source.slice(source.indexOf('    <section id="pendingReportSection"'),source.indexOf('    <section id="inProgressSection"'));
const head=source.slice(0,source.indexOf('</head>')+7).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
const origin='https://lifeportfolio.co.kr',base='https://lifeporfolio-default-rtdb.asia-southeast1.firebasedatabase.app';
const baseline={status:'submitted',submittedAt:1234567890,name:'합성 사용자',answers:{Q1:'합성 사용자',Q3:'Keep this answer'},meta:{source:'b2b',b2bOrderId:'test-order',revision:1}};
(async()=>{const browser=await puppeteer.launch({headless:true,...(process.env.LP_BROWSER_PATH?{executablePath:process.env.LP_BROWSER_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});let passed=0;
try {
 for(const group of [false,true])for(const width of [320,375,768,1280])for(const mode of ['normal','cancel','failure','lost-response','conflict','account-change']) {
  const initial=structuredClone(baseline);if(!group)delete initial.meta.source;
  let saved=structuredClone(initial),version=1,puts=0;const calls=[],page=await browser.newPage();await page.setViewport({width,height:1000});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const boot=`<script>const auth={currentUser:{uid:'synthetic-user',getIdToken:async()=> 'synthetic-token'}};const _RTDB_BASE=${JSON.stringify(base)};const _withTimeout=async p=>p;const _isValidSid=s=>/^s_\\d+_[a-z0-9]+$/.test(s);const _withLangParam=(s,l)=>s+'&lang='+l;const escapeHtml=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');const formatDate=()=> '2026-09-19 12:00';window.__confirm=true;window.confirm=()=>__confirm;window.__auth=auth;${logic};window.render=()=>_renderPendingReports({s_123_group:${JSON.stringify(initial)},s_999_ready:{status:'submitted'}},{s_999_ready:true},'synthetic-user');window.render();</script>`;
  await page.setRequestInterception(true);page.on('request',async r=>{
   const u=new URL(r.url());
   if(r.isNavigationRequest())return r.respond({status:200,contentType:'text/html',headers:{'content-security-policy':"frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'"},body:head+'<body><main class="container"><h3 class="report-title" id="standardReportTitle" hidden>Control</h3>'+section+'</main>'+boot+'</body></html>'});
   if(u.origin===base){
    const headers={'access-control-allow-origin':origin,'access-control-allow-headers':'content-type,if-match,x-firebase-etag','access-control-allow-methods':'GET,PUT','access-control-expose-headers':'ETag','etag':'"'+version+'"'};
    if(r.method()==='OPTIONS')return r.respond({status:204,headers});
    calls.push({method:r.method(),path:u.pathname});assert.equal(u.pathname,group&&r.method()==='PUT'?'/responses/synthetic-user/s_123_group/meta/recoveryDismissed.json':'/responses/synthetic-user/s_123_group.json');
    if(r.method()==='GET') {if(mode==='account-change')await page.evaluate(()=>__auth.currentUser={uid:'other-user'});return r.respond({status:200,headers,contentType:'application/json',body:JSON.stringify(saved)});}
    assert.equal(r.method(),'PUT');puts++;
    if(mode==='failure')return r.respond({status:403,headers,contentType:'application/json',body:'{"error":"denied"}'});
    if(mode==='conflict'){saved={...saved,answers:{Q1:'Concurrent retained answer'},meta:{...saved.meta,revision:2}};version++;return r.respond({status:412,headers,contentType:'application/json',body:JSON.stringify(saved)});}
    if(group){assert.equal(r.headers()['if-match'],undefined);saved.meta.recoveryDismissed=JSON.parse(r.postData());}
    else {assert.equal(r.headers()['if-match'],'"'+version+'"');saved=JSON.parse(r.postData());}version++;
    if(mode==='lost-response'&&puts===1)return r.abort();
    return r.respond({status:200,headers,contentType:'application/json',body:JSON.stringify(saved)});
   }
   if(u.origin===origin){const local=path.resolve(root,'.'+u.pathname);if(local.startsWith(root+path.sep)&&fs.existsSync(local)&&fs.statSync(local).isFile()){const ext=path.extname(local);return r.respond({status:200,contentType:ext==='.css'?'text/css':ext==='.svg'?'image/svg+xml':ext==='.woff2'?'font/woff2':'application/octet-stream',body:fs.readFileSync(local)});}}
   return r.abort();
  });
  await page.goto(origin+'/mypage',{waitUntil:'networkidle0'});await page.waitForSelector('.recovery-card');
  const layout=await page.$eval('.recovery-card',e=>({title:getComputedStyle(e.querySelector('.report-title')).fontSize,gap:getComputedStyle(e.parentElement).rowGap,buttons:[...e.querySelectorAll('.btn')].map(x=>{const r=x.getBoundingClientRect();return {width:r.width,height:r.height,left:r.left,right:r.right};})}));
  assert.equal(await page.$eval('#pendingReportToggle',e=>getComputedStyle(e).display),'none');assert.equal(layout.title,await page.$eval('#standardReportTitle',e=>getComputedStyle(e).fontSize));assert.equal(layout.gap,'12px');for(const box of layout.buttons)assert.ok(box.height>=44&&box.left>=0&&box.right<=width,JSON.stringify({width,box}));
  const button='button[data-recovery-sid]';
  if(mode==='cancel')await page.evaluate(()=>__confirm=false);
  if(mode==='normal'||mode==='lost-response'){
    await page.click(button);await page.waitForFunction(()=>document.getElementById('pendingReportStatus').textContent.includes('삭제했습니다'));
    assert.equal(saved.meta.recoveryDismissed,true);assert.deepEqual(saved.answers,initial.answers);assert.equal(saved.status,'submitted');assert.equal(saved.submittedAt,initial.submittedAt);assert.equal(await page.$$('.recovery-card').then(x=>x.length),0);
    await page.click('#pendingReportToggle');await page.waitForSelector('.recovery-card[data-dismissed="true"]');assert.equal(await page.$$('.recovery-card a').then(x=>x.length),0);
    await page.click(button);await page.waitForFunction(()=>document.getElementById('pendingReportStatus').textContent.includes('다시 표시했습니다'));
    assert.equal(saved.meta.recoveryDismissed,false);assert.deepEqual(saved.answers,initial.answers);
    await page.click('#pendingReportToggle');await page.waitForSelector('.recovery-card[data-dismissed="false"]');
    assert.equal(puts,2);assert.ok(calls.every(c=>c.path.startsWith('/responses/')));
  }else if(mode==='cancel') {await page.click(button);assert.equal(puts,0);assert.equal(calls.length,0);}
  else {await page.click(button);await page.waitForFunction(()=>!document.querySelector('button[data-recovery-sid]').disabled);assert.equal(await page.$$('.recovery-card').then(x=>x.length),1);assert.notEqual(saved.meta.recoveryDismissed,true);if(mode==='account-change')assert.equal(puts,0);if(mode==='conflict')assert.equal(saved.answers.Q1,'Concurrent retained answer');}
  assert.deepEqual(errors,[]);passed++;console.log('PASS recovery '+(group?'group':'personal')+' '+width+' '+mode);
  if(process.env.LP_RECOVERY_SCREENSHOT_DIR&&mode==='cancel'&&[375,1280].includes(width))await page.screenshot({path:path.join(process.env.LP_RECOVERY_SCREENSHOT_DIR,'recovery-'+width+'.png'),fullPage:true});
  await page.close();
 }
 console.log(JSON.stringify({passed,scope:'actual source DOM/CSS, native Fetch, synthetic user and isolated responses only'}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
