'use strict';
// Browser regression over the source HTML with synthetic Firebase replacements.
// All network requests are answered locally or aborted. No customer data is accessed.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const deps=process.env.LP_TEST_DEPENDENCIES?createRequire(path.resolve(process.env.LP_TEST_DEPENDENCIES,'package.json')):require;
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await deps('puppeteer').launch({headless:true,...(process.env.LP_BROWSER_PATH?{executablePath:process.env.LP_BROWSER_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});let passed=0;
 try{
  for(const file of ['admin.html','b2b-admin.html'])for(const width of [375,1280])for(const scenario of ['signed-out','non-admin','string-claim','claim-error','admin','auth-race','popup-blocked']){
   const page=await browser.newPage();await page.setViewport({width,height:900});const errors=[];page.on('pageerror',e=>errors.push(e.message));
   const html=fs.readFileSync(path.join(root,file),'utf8').replace(/import\s+[\s\S]*?from\s+"https:\/\/www\.gstatic\.com\/firebasejs\/[^"\n]+";/g,'');
   const boot=`<script>
window.__test={scenario:${JSON.stringify(scenario)},calls:[]};
const user={uid:'synthetic-admin',email:'admin@example.invalid',getIdToken:async()=> 'synthetic-token',getIdTokenResult:async()=>{
 if(__test.scenario==='claim-error')throw Error('synthetic claim failure');
 if(__test.scenario==='auth-race'){await new Promise(r=>setTimeout(r,50));return {claims:{admin:true}};}
 return {claims:{admin:__test.scenario==='admin'?true:__test.scenario==='string-claim'?'true':false}};
}},authMock={currentUser:['signed-out','popup-blocked'].includes(__test.scenario)?null:user};
const initializeApp=()=>({}),getAuth=()=>authMock,getFunctions=()=>({}),GoogleAuthProvider=function(){};
const signInWithPopup=async()=>{throw Error('popup-blocked');},signOut=async()=>{authMock.currentUser=null;};
const onAuthStateChanged=(_a,fn)=>{setTimeout(()=>{fn(authMock.currentUser);if(__test.scenario==='auth-race')setTimeout(()=>{authMock.currentUser=null;fn(null);},10);},0);};
const attack='<img class="injected" src=x onerror="window.__injected=true">';
const httpsCallable=(_f,name)=>async()=>{__test.calls.push(name);if(name==='getB2BAdminData')return {data:{summary:{pendingQuote:0,pendingPayment:1,activeOrgs:1,totalRevenueSupply:180000},orders:[{id:'synthetic-order',orderNumber:'LP-TEST',orgName:attack,contactName:attack,contactEmail:'synthetic@example.invalid',depositorName:attack,seats:10,totalAmount:198000,unitPrice:18000,status:'payment_reported',createdAt:'2026-01-01'},{id:'synthetic-active',orderNumber:'LP-ACTIVE',orgName:attack,contactName:attack,contactEmail:'synthetic@example.invalid',seats:10,totalAmount:198000,status:'active',codesIssued:10,codesUsed:1,createdAt:'2026-01-01'}]}};if(name==='getB2BOrderCodes')return {data:{orgCode:'TEST-ORG',codes:[{code:'ABCD-EFGH',status:'used',usedByEmail:attack,completed:false}]}};throw Error('Unexpected operation: '+name);};
</script>`;
   await page.setRequestInterception(true);page.on('request',r=>r.isNavigationRequest()?r.respond({status:200,contentType:'text/html',body:html.replace('<script type="module">',boot+'<script type="module">')}):r.abort());
   await page.goto('https://admin-audit.invalid/'+file,{waitUntil:'domcontentloaded'});
   const surface=file==='admin.html'?'hub':'dashboard';
   if(scenario==='admin'){
    await page.waitForFunction(id=>getComputedStyle(document.getElementById(id)).display!=='none',{},surface);
    if(file==='b2b-admin.html'){
     await page.waitForSelector('.btn-view');assert.equal(await page.$$('.injected').then(a=>a.length),0);
     assert.equal(await page.evaluate(()=>!!window.__injected),false);
     await page.locator('.btn-view').click();await page.waitForFunction(()=>document.getElementById('codesList').textContent.includes('ABCD-EFGH'));
     assert.equal(await page.$$('.injected').then(a=>a.length),0);assert.equal(await page.evaluate(()=>!!window.__injected),false);
    }
   }else{
    if(scenario==='auth-race')await new Promise(r=>setTimeout(r,120));
    const gate=['non-admin','string-claim'].includes(scenario)?'noPermGate':'loginGate';
    await page.waitForFunction(id=>getComputedStyle(document.getElementById(id)).display!=='none',{},gate);
    assert.equal(await page.$eval('#'+surface,e=>getComputedStyle(e).display),'none');
    assert.deepEqual(await page.evaluate(()=>__test.calls),[]);
    if(scenario==='claim-error')await page.waitForSelector('#adminAuthError');
    if(scenario==='popup-blocked'){await page.locator('#loginBtn').click();await page.waitForSelector('#adminAuthError');}
   }
   assert.equal(errors.length,0,errors.join('\n'));passed++;console.log('PASS '+file+' '+width+' '+scenario);await page.close();
  }
  console.log(JSON.stringify({passed,scope:'source HTML with mocked Firebase; all network blocked; no real admin login or customer operations'}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
