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
  for(const file of ['admin.html','b2b-admin.html'])for(const width of [320,375,768,1280])for(const scenario of ['signed-out','non-admin','string-claim','claim-error','admin','auth-race','popup-blocked']){
   const page=await browser.newPage();await page.setViewport({width,height:900});const errors=[];page.on('pageerror',e=>errors.push(e.message));
   const html=fs.readFileSync(path.join(root,file),'utf8').replace(/import\s+[\s\S]*?from\s+"https:\/\/www\.gstatic\.com\/firebasejs\/[^"\n]+";/g,'');
   const boot=`<script>
window.__test={scenario:${JSON.stringify(scenario)},calls:[],alerts:[],promptValue:null};window.prompt=()=>__test.promptValue;window.alert=m=>__test.alerts.push(m);window.confirm=()=>true;
const user={uid:'synthetic-admin',email:'admin@example.invalid',getIdToken:async()=> 'synthetic-token',getIdTokenResult:async()=>{
 if(__test.scenario==='claim-error')throw Error('synthetic claim failure');
 if(__test.scenario==='auth-race'){await new Promise(r=>setTimeout(r,50));return {claims:{admin:true}};}
 return {claims:{admin:__test.scenario==='admin'?true:__test.scenario==='string-claim'?'true':false}};
}},authMock={currentUser:['signed-out','popup-blocked'].includes(__test.scenario)?null:user};
const initializeApp=()=>({}),getAuth=()=>authMock,getFunctions=()=>({}),GoogleAuthProvider=function(){};
const signInWithPopup=async()=>{throw Error('popup-blocked');},signOut=async()=>{authMock.currentUser=null;};
const onAuthStateChanged=(_a,fn)=>{setTimeout(()=>{fn(authMock.currentUser);if(__test.scenario==='auth-race')setTimeout(()=>{authMock.currentUser=null;fn(null);},10);},0);};
const attack='<img class="injected" src=x onerror="window.__injected=true">';
const httpsCallable=(_f,name)=>async()=>{__test.calls.push(name);if(name==='getB2BAdminData')return {data:{summary:{pendingQuote:0,pendingPayment:1,activeOrgs:1,totalRevenueSupply:180000},orders:[{id:'synthetic-order',orderNumber:'LP-TEST',orgName:attack,contactName:attack,contactEmail:'synthetic@example.invalid',depositorName:attack,seats:10,totalAmount:198000,unitPrice:18000,status:'payment_reported',createdAt:'2026-01-01'},{id:'synthetic-active',orderNumber:'LP-ACTIVE',orgName:attack,contactName:attack,contactEmail:'synthetic@example.invalid',seats:10,totalAmount:198000,status:'active',codesIssued:10,codesUsed:1,createdAt:'2026-01-01'}]}};if(name==='cancelB2BOrder'){await new Promise(r=>setTimeout(r,60));return {data:{status:'cancelled',emailStatus:'unknown'}};}if(name==='getB2BOrderCodes')return {data:{orgCode:'TEST-ORG',codes:[{code:'ABCD-EFGH',status:'used',usedByEmail:attack,completed:false}]}};throw Error('Unexpected operation: '+name);};
</script>`;
   await page.setRequestInterception(true);page.on('request',r=>r.isNavigationRequest()?r.respond({status:200,contentType:'text/html',body:html.replace('<script type="module">',boot+'<script type="module">')}):r.abort());
   await page.goto('https://admin-audit.invalid/'+file,{waitUntil:'domcontentloaded'});
   const surface=file==='admin.html'?'hub':'dashboard';
   if(scenario==='admin'){
    await page.waitForFunction(id=>getComputedStyle(document.getElementById(id)).display!=='none',{},surface);
    if(file==='b2b-admin.html'){
     await page.waitForSelector('.btn-view');assert.equal(await page.$$('.injected').then(a=>a.length),0);
     assert.equal(await page.evaluate(()=>!!window.__injected),false);
     const activeCancel='.btn-cancel[data-id="synthetic-active"]';
     const rect=await page.$eval(activeCancel,e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height};});
     if(width<=768)assert.ok(rect.left>=0&&rect.right<=width&&rect.height>=44,JSON.stringify(rect));
     await page.locator(activeCancel).click();
     assert.equal(await page.evaluate(()=>__test.calls.filter(n=>n==='cancelB2BOrder').length),0);
     await page.evaluate(()=>__test.promptValue='   ');await page.locator(activeCancel).click();
     assert.equal(await page.evaluate(()=>__test.calls.filter(n=>n==='cancelB2BOrder').length),0);
     await page.evaluate(()=>{__test.promptValue='Synthetic cancellation';const b=document.querySelector('.btn-cancel[data-id="synthetic-active"]');b.click();b.click();});
     await page.waitForFunction(()=>__test.alerts.some(m=>m.includes('자동 재발송 안 함')));
     assert.equal(await page.evaluate(()=>__test.calls.filter(n=>n==='cancelB2BOrder').length),1);
     assert.ok(await page.evaluate(()=>__test.alerts.some(m=>m.includes('실제 송금 없음'))));
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
  passed += await testB2BMailUi(browser);
  console.log(JSON.stringify({passed,scope:'source HTML with mocked Firebase; all network blocked; no real admin login or customer operations'}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});


async function testB2BMailUi(browser) {
 const source=fs.readFileSync(process.env.LP_ADMIN_MAIL_SOURCE||path.join(root,'b2b-admin.html'),'utf8')
  .replace(/import\s+[\s\S]*?from\s+"https:\/\/www\.gstatic\.com\/firebasejs\/[^"\n]+";/g,'');
 let count=0;
 for(const width of [320,375,768,1280]) {
  const page=await browser.newPage();await page.setViewport({width,height:900});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const boot=`<script>
window.__mail={calls:[],mode:'accepted',delay:0,confirm:true,clipboardFail:false,copied:'',downloads:[],requests:[]};
window.alert=m=>{__mail.alert=m};window.confirm=()=>__mail.confirm;
const user={uid:'synthetic-admin',email:'owner@example.invalid',getIdTokenResult:async()=>({claims:{admin:true}})},authMock={currentUser:user};
const initializeApp=()=>({}),getAuth=()=>authMock,getFunctions=()=>({}),GoogleAuthProvider=function(){},signInWithPopup=async()=>{},signOut=async()=>{authMock.currentUser=null;await window.__authCallback(null);};
const onAuthStateChanged=(_a,fn)=>{window.__authCallback=fn;setTimeout(()=>fn(user),0)};
const attack='<img class="injected" src=x onerror="window.__injected=true">';
const order={id:'synthetic-order',orderNumber:'LP-SYNTHETIC',orgName:'Synthetic Org',contactEmail:'recipient@example.invalid',seats:10,totalAmount:198000,status:'active',codesIssued:10,codesUsed:0};
window.__mail.draft={ok:true,to:'recipient@example.invalid',subject:'[테스트] A & B + C',text:'안녕하세요.\\n합성 테스트 본문 & + ? #',html:'<p>합성 테스트</p>',codesIssued:10,xlsxFileName:'synthetic-codes.xlsx',xlsxBase64:btoa('synthetic-xlsx-bytes')};
const httpsCallable=(_f,name)=>async data=>{__mail.calls.push({name,data});
 if(name==='getB2BAdminData')return {data:{summary:{},orders:[order]}};
 if(name==='getB2BOrderCodes')return {data:{orgCode:'ORG-SYNTHETIC',codes:Array.from({length:10},(_,i)=>({code:'SYNTH-'+i,status:'unused'}))}};
 if(name==='getB2BCodesEmailDraft'){const d=structuredClone(__mail.draft);if(__mail.delay)await new Promise(r=>setTimeout(r,__mail.delay));return {data:d};}
 if(name==='resendB2BCodesEmail'){await new Promise(r=>setTimeout(r,100));if(__mail.mode==='unknown'||__mail.mode==='denied'){const e=new Error(__mail.mode==='unknown'?'synthetic timeout':attack);e.code=__mail.mode==='unknown'?'functions/unavailable':'functions/permission-denied';throw e;}return {data:__mail.mode==='malformed'?{ok:true}:{ok:true,emailStatus:'provider_accepted',messageId:'synthetic-message-id',sentTo:order.contactEmail,codesIssued:10}};}
 throw Error('Unexpected operation: '+name);
};
Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async v=>{if(__mail.clipboardFail)throw Error('synthetic clipboard denial');__mail.copied=v;}}});
const blobByUrl=new Map(),oldCreate=URL.createObjectURL.bind(URL);URL.createObjectURL=b=>{const u=oldCreate(b);blobByUrl.set(u,b);return u};
document.addEventListener('click',async e=>{const a=e.target.closest('a');if(a?.download){e.preventDefault();const b=blobByUrl.get(a.href);__mail.downloads.push({name:a.download,type:b.type,text:await b.text()});}});
</script>`;
  await page.setRequestInterception(true);page.on('request',r=>r.isNavigationRequest()&&r.url().startsWith('https://admin-mail.invalid/')?r.respond({status:200,contentType:'text/html',body:source.replace('<script type="module">',boot+'<script type="module">')}):r.abort());
  await page.goto('https://admin-mail.invalid/b2b-admin',{waitUntil:'domcontentloaded'});await page.waitForSelector('.btn-view');await page.locator('.btn-view').click();await page.waitForFunction(()=>document.getElementById('codesList').textContent.includes('SYNTH-9'));
  const geometry=await page.evaluate(()=>{const l=document.getElementById('codesList').getBoundingClientRect(),m=document.querySelector('#codesModal .modal').getBoundingClientRect(),a=document.getElementById('sendMailBtn').parentElement.getBoundingClientRect();return {list:l.width,modal:m.width,top:l.top,actionsBottom:a?.bottom,overflow:document.querySelector('#codesModal .modal').scrollWidth>document.querySelector('#codesModal .modal').clientWidth+1};});
  assert.ok(geometry.list>=geometry.modal-52&&geometry.top>=geometry.actionsBottom&&!geometry.overflow,JSON.stringify(geometry));
  for(const mode of ['accepted','malformed','unknown','denied']){
   await page.evaluate(m=>{__mail.mode=m;__mail.calls=[];const b=document.getElementById('sendMailBtn');b.click();b.click();},mode);
   await page.waitForFunction(()=>!document.getElementById('sendMailBtn').disabled);
   const receipt=await page.$eval('#mailDeliveryStatus',e=>e.textContent);
   assert.equal(await page.evaluate(()=>__mail.calls.filter(c=>c.name==='resendB2BCodesEmail').length),1,'double click must make one request');
   assert.equal(await page.evaluate(()=>__mail.calls.filter(c=>c.name==='getB2BCodesEmailDraft').length),0,'errors must never auto-switch to manual send');
   if(mode==='accepted'){assert.match(receipt,/서비스 접수 확인/);assert.match(receipt,/수신 완료 미확인/);assert.match(receipt,/synthetic-message-id/);assert.match(receipt,/보낸메일함에는 자동 저장되지 않습니다/);}
   else if(mode==='denied')assert.match(receipt,/요청이 거부/);
   else assert.match(receipt,/실제 발송됐을 수/);
   assert.doesNotMatch(receipt,/발송 완료!/);assert.equal(await page.$$('.injected').then(a=>a.length),0);count++;
  }
  await page.evaluate(()=>{__mail.confirm=false;__mail.calls=[];document.getElementById('sendMailBtn').click();});assert.equal(await page.evaluate(()=>__mail.calls.length),0);await page.evaluate(()=>__mail.confirm=true);
  await page.locator('#manualMailBtn').click();await page.waitForSelector('#openGmailBtn');
  const draft=await page.evaluate(()=>__mail.draft),gmail=new URL(await page.$eval('#openGmailBtn',e=>e.href));
  assert.equal(gmail.origin,'https://mail.google.com');assert.equal(gmail.searchParams.get('to'),draft.to);assert.equal(gmail.searchParams.get('su'),draft.subject);assert.equal(gmail.searchParams.get('body'),draft.text);
  assert.equal(await page.$eval('#openMailtoBtn',e=>e.target),'','mailto must not create blank tabs');
  assert.match(await page.$eval('#openMailtoBtn',e=>e.href),/^mailto:/);
  assert.match(await page.$eval('#manualMailContent',e=>e.textContent),/자동 첨부되지 않습니다/);
  await page.locator('#dlXlsxBtn').click();await page.waitForFunction(()=>__mail.downloads.length===1);
  assert.deepEqual(await page.evaluate(()=>__mail.downloads[0]),{name:'synthetic-codes.xlsx',type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',text:'synthetic-xlsx-bytes'});
  await page.locator('[data-copy="text"]').click();await page.waitForFunction(()=>__mail.copied===__mail.draft.text);
  await page.evaluate(()=>__mail.clipboardFail=true);await page.locator('[data-copy="text"]').click();await page.waitForFunction(()=>document.getElementById('mailCopyStatus').textContent.includes('직접 복사'));
  assert.equal(await page.$eval('#manualMailText',e=>e.value),draft.text);
  assert.equal(await page.$eval('#htmlPreview',e=>e.getAttribute('sandbox')),'');
  assert.equal(await page.evaluate(()=>document.querySelector('#manualMailModal .modal').scrollWidth>document.querySelector('#manualMailModal .modal').clientWidth+1),false);
  // Capture the native link click before external navigation. This is not a real Gmail login/send test.
  await page.$eval('#openGmailBtn',a=>a.addEventListener('click',e=>{e.preventDefault();__mail.compose={href:a.href,target:a.target,rel:a.rel};}));
  await page.locator('#openGmailBtn').click();const compose=await page.evaluate(()=>__mail.compose);
  assert.equal(new URL(compose.href).searchParams.get('to'),draft.to);assert.equal(compose.target,'_blank');assert.match(compose.rel,/noopener/);assert.match(compose.rel,/noreferrer/);
  // Long payloads never silently truncate: web compose opens without body, full text stays visible.
  await page.evaluate(()=>{__mail.draft.text='긴 본문 & + '.repeat(1800);document.querySelector('#manualMailModal .btn-close').click();document.getElementById('manualMailBtn').click();});
  await page.waitForFunction(()=>document.getElementById('manualMailText')?.value.length>10000);
  assert.equal(new URL(await page.$eval('#openGmailBtn',e=>e.href)).searchParams.has('body'),false);
  assert.ok((await page.$eval('#openMailtoBtn',e=>e.href)).length<=1800);assert.match(await page.$eval('#manualMailContent',e=>e.textContent),/본문이 길어/);
  // Hostile response text remains text, not operator-page HTML.
  await page.evaluate(()=>{__mail.draft.subject='<img class="injected" src=x onerror="window.__injected=true">';__mail.draft.xlsxFileName=__mail.draft.subject;document.querySelector('#manualMailModal .btn-close').click();document.getElementById('manualMailBtn').click();});
  await page.waitForFunction(()=>document.getElementById('dlXlsxBtn').textContent.includes('<img'));
  assert.equal(await page.$$('.injected').then(a=>a.length),0);assert.equal(await page.evaluate(()=>!!window.__injected),false);
  // Late draft after logout must not re-expose recipient, content or attachment.
  await page.evaluate(()=>{__mail.delay=120;document.querySelector('#manualMailModal .btn-close').click();document.getElementById('manualMailBtn').click();document.getElementById('logoutLink').click();});
  await new Promise(r=>setTimeout(r,220));assert.equal(await page.$eval('#manualMailModal',e=>e.style.display),'none');assert.equal(await page.$eval('#manualMailContent',e=>e.textContent),'');
  assert.equal(errors.length,0,errors.join('\n'));count++;console.log('PASS B2B mail UI',width,'provider acceptance/unknown/errors, no duplicate request, Gmail compose, mailto, XLSX bytes, copy denial, long text, XSS, logout cleanup');await page.close();
 }
 return count;
}
