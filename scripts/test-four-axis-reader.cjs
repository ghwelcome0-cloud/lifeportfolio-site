'use strict';
// Actual engines and both report renderers, isolated from live Auth/DB/network.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),puppeteer=require('puppeteer'),{execFileSync}=require('node:child_process');
const baseline=execFileSync('git',['show','f846be1:report.html'],{cwd:root,encoding:'utf8',maxBuffer:5000000});
// Opt-in engine changes are covered by test-response-evidence's historical-output
// comparison. Keep questionnaire, mappings and Firebase policy byte protection.
for(const file of ['data/questions.json','data/mapping.json','firebase.json','database.rules.json','firestore.rules'])assert.equal(fs.readFileSync(path.join(root,file),'utf8'),execFileSync('git',['show','f846be1:'+file],{cwd:root,encoding:'utf8',maxBuffer:5000000}),file+' must remain byte-identical');
const source=fs.readFileSync(process.env.LP_REPORT_SOURCE||path.join(root,'report.html'),'utf8');
const E=require('../assets/js/report-engine.js'),V=require('../assets/js/report-engine-v4.js');
const questions=require('../data/questions.json'),mapping=require('../data/mapping.json'),rules=require('../data/report-rules.json'),careerRules=require('../data/career-rules.json');
const keys=['self_understanding','self_expression','self_design','self_execution'];
const start=source.indexOf('    function axisReaderView('),end=source.indexOf('    function renderReport(',start);
assert.ok(start>0&&end>start);
const ctx=vm.createContext({});vm.runInContext(source.slice(start,end),ctx);
const view=(r,key,lang='ko')=>ctx.axisReaderView(r,key,r.sections.find(s=>s.id===key)?.content,lang);
function freeze(o){if(o&&typeof o==='object'){Object.values(o).forEach(freeze);Object.freeze(o);}return o;}
function build(seed,lang='ko'){
 const answers={Q1:'Synthetic Reader'};
 questions.sections.flatMap(s=>s.questions).forEach((q,i)=>{
  if(q.type==='likert')answers[q.id]=1+(seed+i)%5;
  else if(q.options?.length){const option=q.options[(seed+i)%q.options.length];answers[q.id]=q.type==='multi_choice'?[option]:option;}
 });
 const input={questions,mapping,rules,careerRules,answers,profile:{name:'Synthetic Reader',submittedAt:10},lang};
 return V.upgrade(E.build(input),input);
}
const reports=Array.from({length:24},(_,i)=>build(i));
for(const r of reports){
 const before=JSON.stringify(r);freeze(r);
 for(const key of keys){const c=r.sections.find(s=>s.id===key).content,v=view(r,key);
  assert.deepEqual(Array.from(v.keywords),c.keywords);assert.notEqual(v.keywords,c.keywords);
  for(const field of ['concept','core','detail','action','reflection'])assert.ok(v[field],key+' '+field);
  assert.ok(v.core.length<100&&v.detail.length<230);assert.ok(v.reflection.endsWith('?'));
  assert.ok(!/Q\d+|자원이 흐르는 길|약한 고리/.test(v.core+' '+v.detail));
 }
 assert.equal(JSON.stringify(r),before,'Projection must not mutate ANY report field');
}
for(const key of keys)assert.ok(new Set(reports.map(r=>view(r,key).core)).size>=4,'Personalized headline diversity: '+key);
const old=structuredClone(reports[0]);delete old.sections.find(s=>s.id==='execution_profile').content._strategy;
for(const key of keys){assert.equal(view(old,key).core,old.sections.find(s=>s.id===key).content.core);assert.equal(view(reports[0],key,'en').core,reports[0].sections.find(s=>s.id===key).content.core);}
const sparse={sections:keys.map(id=>({id,content:{}}))};for(const key of keys)assert.equal(view(sparse,key).core,'');
const hostile=structuredClone(reports[0]);
for(const key of keys){const c=hostile.sections.find(s=>s.id===key).content;c.keywords=['<img src=x onerror="window.__xss=1">','A&B','"quoted"',"'quoted'"];}
hostile.sections.find(s=>s.id==='execution_profile').content._strategy.koCoords.compass0='<img src=x onerror="window.__xss=1">';
// No-coordinate truth: engine defaults are not reported as explicit selections.
const defaults=structuredClone(reports[0]);const k=defaults.sections.find(s=>s.id==='execution_profile').content._strategy.koCoords;k.hasAct=false;k.hasDone=false;k.hasPlace=false;k.hasRhythm=false;
assert.equal(view(defaults,'self_expression').core,defaults.sections.find(s=>s.id==='self_expression').content.core);
assert.equal(view(defaults,'self_design').core,defaults.sections.find(s=>s.id==='self_design').content.core);
console.log('PASS 24 real-engine inputs: four-axis diversity, exact keywords, frozen input, old/EN/default fallbacks');

async function open(browser,report,width,manual=false,htmlSource=source){
 const payload={report,lang:report.lang||'ko',...(manual?{manualOverrideHtml:'<h2 id="manual-preserved">Synthetic reviewed original</h2>'}:{})};
 const boot=`<script>
 window.__writes=[];const data=${JSON.stringify(payload).replace(/</g,'\\u003c')};
 const user={uid:'synthetic',email:'synthetic@example.invalid',getIdToken:async()=> 'synthetic'};
 const initializeApp=()=>({}),initializeAppCheck=()=>({}),ReCaptchaEnterpriseProvider=function(){},getAuth=()=>({currentUser:user}),getDatabase=()=>({}),getFunctions=()=>({});
 const httpsCallable=()=>async()=>{throw Error('Unexpected callable');};
 const onAuthStateChanged=(_a,fn)=>{setTimeout(()=>fn(user),0);return ()=>{};};
 const ref=(_d,p)=>p,serverTimestamp=()=>({'.sv':'timestamp'}),query=p=>p,orderByChild=()=>0,equalTo=()=>0,limitToLast=()=>0;
 const get=async p=>({exists:()=>p.startsWith('reports/'),val:()=>p.startsWith('reports/')?data:null});
 const set=async(p,v)=>__writes.push(p),update=set,remove=set,push=set;
 </script>`;
 const html=htmlSource.replace(/import\s+[\s\S]*?from\s+"https:\/\/www\.gstatic\.com\/firebasejs\/[^"\n]+";/g,'').replace('<script type="module">',boot+'<script type="module">');
 const page=await browser.newPage();await page.setViewport({width,height:1000});const errors=[],writes=[];
 page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);
 if(process.env.LP_AXIS_DEBUG)page.on('console',msg=>console.log('BROWSER',msg.type(),msg.text()));
 page.on('request',async req=>{try{const u=new URL(req.url());
  if(u.hostname==='reader.invalid'){
   if(req.isNavigationRequest())return req.respond({status:200,contentType:'text/html',body:html});
   const rel=decodeURIComponent(u.pathname).replace(/^\//,''),file=path.resolve(root,rel);
   if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return req.abort();
   return req.respond({status:200,contentType:rel.endsWith('.js')?'application/javascript':rel.endsWith('.json')?'application/json':rel.endsWith('.css')?'text/css':'application/octet-stream',body:fs.readFileSync(file)});
  }
  if(u.hostname.endsWith('.firebasedatabase.app')){
   if(req.method()!=='GET'){writes.push(req.method());return req.abort();}
   return req.respond({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(u.pathname.startsWith('/reports/')?payload:null)});
  }
  return req.abort();
 }catch(e){errors.push(e.message);if(!req.isInterceptResolutionHandled())await req.abort();}});
 await page.goto('https://reader.invalid/report.html?sid=s_123_synthetic',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(manual?()=>!!document.querySelector('#manual-preserved'):()=>document.querySelector('#lbFrame')?.contentDocument?.querySelectorAll('.page').length===14,{timeout:15000});
 return {page,errors,writes};
}
(async()=>{const browser=await puppeteer.launch({headless:true,...(process.env.LP_BROWSER_PATH?{executablePath:process.env.LP_BROWSER_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});let count=0;
try{
 const prior=await open(browser,reports[0],1280,false,baseline);
 const unchangedBefore=await prior.page.evaluate(()=>[...document.querySelector('#lbFrame').contentDocument.querySelectorAll('.page__body')].filter((_,i)=>![8,9,10].includes(i)).map(e=>e.innerHTML));await prior.page.close();
 const next=await open(browser,reports[0],1280);
 const unchangedAfter=await next.page.evaluate(()=>[...document.querySelector('#lbFrame').contentDocument.querySelectorAll('.page__body')].filter((_,i)=>![8,9,10].includes(i)).map(e=>e.innerHTML));assert.deepEqual(unchangedAfter,unchangedBefore,'All 11 non-VII page bodies must remain exactly unchanged');await next.page.close();
 for(const [report,width,label] of [[reports[0],375,'mobile'],[reports[5],1280,'desktop'],[reports[11],1440,'wide'],[old,1280,'old'],[build(2,'en'),1280,'english'],[hostile,375,'escaping']]){
  const {page,errors,writes}=await open(browser,report,width);
  // Exercise the existing refusal control; do not grant analytics in a synthetic test.
  if(await page.$('#lpConsent .lp-consent__btn--ghost'))await page.click('#lpConsent .lp-consent__btn--ghost');
  const legacy=await page.$$eval('#reportRoot .axis-reader',es=>es.map(e=>e.textContent));assert.equal(legacy.length,4);
  const state=await page.evaluate(()=>{const d=document.querySelector('#lbFrame').contentDocument;return {pages:d.querySelectorAll('.page').length,cards:d.querySelectorAll('.axis-reader').length,overview:d.querySelectorAll('.axis-overview__item').length,kw:[...d.querySelectorAll('.axis-reader')].map(e=>[...e.querySelectorAll('.kw span')].map(x=>x.textContent)),text:[...d.querySelectorAll('.axis-reader')].map(e=>e.textContent),banned:d.querySelectorAll('.axis-overview .radar-wrap,.axis-overview .evd,.axis-reader .axis-card__pct,.axis-reader .axis-card__tier,.axis-reader .axis-role,.axis-reader .axis-bar').length,xss:!!(window.__xss||d.defaultView.__xss),images:d.querySelectorAll('.axis-reader img').length};});
  assert.equal(state.pages,14);assert.equal(state.cards,4);assert.equal(state.overview,4);assert.equal(state.banned,0);assert.equal(state.xss,false);assert.equal(state.images,0);
  keys.forEach((key,i)=>{assert.deepEqual(state.kw[i],report.sections.find(s=>s.id===key).content.keywords);assert.ok(legacy[i].includes(view(report,key,report.lang).core));});
  for(const pnum of [9,10,11]){
   await page.evaluate(n=>document.querySelector('#lbFrame').contentWindow.postMessage({t:'lb-go',page:n},'*'),pnum);
   await new Promise(r=>setTimeout(r,180));
   if(width>960){await page.click('#lbZoomFit');await new Promise(r=>setTimeout(r,180));}
   const bounds=await page.evaluate(()=>{const f=document.querySelector('#lbFrame'),d=f.contentDocument,p=d.querySelector('.page.lb-active'),r=p.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,w:f.clientWidth,h:f.clientHeight,overflow:[...p.querySelectorAll('.axis-overview,.axis-overview *, .axis-reader,.axis-reader *')].some(e=>{const x=e.getBoundingClientRect();return x.left<r.left-1||x.right>r.right+1||e.scrollWidth>e.clientWidth+2;})};});
   if(process.env.LP_AXIS_DEBUG&&bounds.overflow)console.log(await page.evaluate(()=>{const d=document.querySelector('#lbFrame').contentDocument,p=d.querySelector('.page.lb-active');return {w:p.clientWidth,sw:p.scrollWidth,nodes:[...p.querySelectorAll('*')].filter(e=>e.scrollWidth>e.clientWidth+2).map(e=>({tag:e.tagName,cls:e.className,w:e.clientWidth,sw:e.scrollWidth})).slice(0,20)};}));
   if(process.env.LP_AXIS_ARTIFACT_DIR&&['mobile','desktop'].includes(label))await page.screenshot({path:path.join(process.env.LP_AXIS_ARTIFACT_DIR,label+'-'+pnum+'.png'),fullPage:true});
   assert.ok(!bounds.overflow&&bounds.left>=-2&&bounds.right<=bounds.w+2,JSON.stringify({label,pnum,bounds}));
   if(width>960)assert.ok(bounds.top>=-2&&bounds.bottom<=bounds.h+2,JSON.stringify({label,pnum,bounds}));
   if(process.env.LP_AXIS_ARTIFACT_DIR&&['mobile','desktop'].includes(label))await page.screenshot({path:path.join(process.env.LP_AXIS_ARTIFACT_DIR,label+'-'+pnum+'.png'),fullPage:true});
  }
  if(width>960){await page.click('#lbFull');await page.waitForFunction(()=>!!document.fullscreenElement);await page.click('#lbZoomFit');await page.evaluate(()=>document.exitFullscreen());}
  for(const theme of ['screen','keepsake']){
   const book=await page.evaluate(t=>window.__buildBookHTML(t),theme);assert.ok(!book.startsWith('ERR:'));
   for(const m of book.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))if(m[1].trim())new vm.Script(m[1]);
   // Execute the assembled child script, including print surfaces, not just its host strings.
   const print=await browser.newPage();await print.setRequestInterception(true);print.on('request',r=>r.abort());print.on('pageerror',e=>errors.push(e.message));
   await print.setContent(book,{waitUntil:'domcontentloaded'});await print.emulateMediaType('print');await print.evaluate(async()=>{await document.fonts.ready;window.dispatchEvent(new Event('beforeprint'));});await new Promise(r=>setTimeout(r,100));
   const fit=await print.evaluate(()=>[...document.querySelectorAll('.page')].filter(p=>p.querySelector('.axis-reader,.axis-overview')).map(p=>{const r=p.getBoundingClientRect(),n=p.querySelector('.page__num');const limit=n?n.getBoundingClientRect().top-4:r.bottom-30;const items=[...p.querySelectorAll('.axis-reader,.axis-overview,.axis-reader *, .axis-overview *')];return {scale:Number(p.getAttribute('data-pf-k')||1),inside:items.every(e=>{const b=e.getBoundingClientRect();return b.bottom<=limit&&b.left>=r.left&&b.right<=r.right;})}}));
   assert.equal(fit.length,3);assert.ok(fit.every(p=>p.scale>=0.85&&p.inside),JSON.stringify({label,theme,fit}));
   if(process.env.LP_AXIS_ARTIFACT_DIR&&label==='desktop'){fs.writeFileSync(path.join(process.env.LP_AXIS_ARTIFACT_DIR,'synthetic-'+theme+'.html'),book);await print.pdf({path:path.join(process.env.LP_AXIS_ARTIFACT_DIR,'synthetic-'+theme+'.pdf'),preferCSSPageSize:true,printBackground:true});}
   await print.close();
  }
  assert.equal(errors.length,0,errors.join('\n'));assert.equal(writes.length+await page.evaluate(()=>__writes.length),0);
  await page.close();count++;
 }
 const m=await open(browser,reports[0],1280,true);await new Promise(r=>setTimeout(r,500));assert.equal(await m.page.$eval('#manual-preserved',e=>e.textContent),'Synthetic reviewed original');assert.equal(await m.page.$$eval('#reportRoot .axis-reader',es=>es.length),0);assert.equal(m.writes.length+await m.page.evaluate(()=>__writes.length),0);await m.page.close();
 console.log('PASS '+count+' actual report cases + manual preservation; 14 pages, both print themes, mobile/fullscreen, child JS, escaping and no writes');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
