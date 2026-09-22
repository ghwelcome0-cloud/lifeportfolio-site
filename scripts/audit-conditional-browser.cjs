'use strict';
// Production functions in offline browser fixtures. All network intercepted.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const puppeteer=require('puppeteer');
const A=require('./audit-conditional-inputs.cjs');
const {root,others,pairs,base,build,extract,survey,copy}=A;
const result={scope:'Synthetic Chromium DOM events and real legacy/book renderers; not live Auth/DB or physical devices.',ui:[],render:[],errors:[],realNetworkRequests:0};
const sha=s=>require('node:crypto').createHash('sha256').update(s).digest('hex');
result.sourceHashes=Object.fromEntries(['suvey.html','report.html','program.html'].map(f=>[f,sha(fs.readFileSync(path.join(root,f)))]));
const uiCode=extract(survey,'    function renderQuestion(q){','    // ============== 검토 단계')+
 extract(survey,'    function countAnswered(){','    function updateHeader(){')+
 extract(survey,'    function _isAnswerEmpty(v){','    const stepBody =');
const css=[...survey.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
async function ui(browser) {
 const p=await browser.newPage();await p.setRequestInterception(true);p.on('request',r=>r.abort());
 await p.setContent('<html><head><style>'+css+'</style></head><body><main id="fixture"></main></body></html>');
 await p.addScriptTag({content:`let answers={},questionsData=${JSON.stringify(A.questions)};let changes=0;
 const _t=(_k,v)=>v,_qText=q=>q.text,_qOptionLabel=(_q,v)=>v,_likertScale=()=>questionsData.likertScale,_curLang=()=> 'ko';
 function debounceSave(){changes++;if(typeof _syncOtherInputs==='function')_syncOtherInputs();} ${uiCode}
 window.mount=(q,a)=>{answers=structuredClone(a);document.getElementById('fixture').replaceChildren(renderQuestion(q));};
 window.state=q=>({answers:structuredClone(answers),active:_isOtherActive(q),count:countAnswered(),changes});`});
 for(const width of [393,1366]) {await p.setViewport({width,height:900});for(const q of others){
  const selector='#other_'+q.otherId,a=base(0);a[q.id]=q.type==='multi_choice'?[q.options[0]]:q.options[0];
  await p.evaluate((q,a)=>mount(q,a),q,a);
  const visible=await p.$eval(selector,e=>e.getBoundingClientRect().height>0&&getComputedStyle(e).display!=='none');
  const input=`input[name="${q.id}"][value="기타 (직접 입력)"]`;await p.click(input);
  const blank=await p.evaluate(q=>state(q),q);
  await p.type(selector,pairs[q.otherId][0]);const typed=await p.evaluate(q=>state(q),q);
  assert.equal(typed.answers[q.otherId],pairs[q.otherId][0]);
  if(q.type==='multi_choice')await p.click(input);else await p.click(`input[name="${q.id}"]`);
  const deselected=await p.evaluate(q=>state(q),q);
  // Simulate the exact production answers restore statement, then rebuild real controls.
  await p.evaluate((q,a)=>mount(q,JSON.parse(JSON.stringify(a))),q,deselected.answers);
  const restored=await p.$eval(selector,e=>e.value);assert.equal(restored,pairs[q.otherId][0]);
  await p.click(input);const reselected=await p.evaluate(q=>state(q),q);
  await p.$eval(selector,e=>{e.value='   ';e.dispatchEvent(new Event('input',{bubbles:true}));});
  const whitespace=await p.evaluate(q=>state(q),q);
  const hostile='줄바꿈\ncomma, slash/ 日本語 <img src=x onerror="window.__auditXss=1">';
  await p.evaluate((q,a,v)=>{a[q.otherId]=v;mount(q,a);},q,reselected.answers,hostile);
  assert.equal(await p.$eval(selector,e=>e.value),hostile);assert.equal(await p.evaluate(()=>window.__auditXss),undefined);
  result.ui.push({width,parent:q.id,qid:q.otherId,textareaVisibleWithoutOther:visible,blankActive:blank.active,blankProgress:blank.count,
   typedExact:true,deselectedRetainsText:deselected.answers[q.otherId]===pairs[q.otherId][0],deselectedStillActive:deselected.active,
   restoredExact:true,reselectedActive:reselected.active,whitespaceProgress:whitespace.count,hostileRestoredAsText:true});
 }}await p.close();
}
async function openReader(browser,surface,lang){
 let source=fs.readFileSync(path.join(root,surface+'.html'),'utf8');
 const renderer=surface==='report'?'renderReport':'renderProgram',adapter=surface==='report'?'buildBookData':'buildProgramBookData';
 const anchor=surface==='report'?'      window.__buildBookHTML =':'      window.__buildProgramBookHTML =';
 assert.ok(source.includes(anchor));
 source=source.replace(anchor,`      window.__auditBook=(value,theme)=>buildBookHTML(${adapter}(value),{theme,embed:true});\n`+anchor);
 source=source.replace('    function '+renderer+'(',`    window.__auditLegacy=${renderer};\n    function ${renderer}(`);
 const boot=`<script>window.__writes=[];
 const user={uid:'synthetic',email:'synthetic@example.invalid',getIdToken:async()=> 'synthetic'};
 const initializeApp=()=>({}),initializeAppCheck=()=>({}),ReCaptchaEnterpriseProvider=function(){},getAuth=()=>({currentUser:user}),getDatabase=()=>({}),getFunctions=()=>({});
 const httpsCallable=()=>async()=>{throw Error('Unexpected callable');},query=p=>p,orderByChild=()=>0,equalTo=()=>0,limitToLast=()=>0;
 const onAuthStateChanged=()=>()=>{},ref=(_d,p)=>p,serverTimestamp=()=>({'.sv':'timestamp'}),get=async()=>({exists:()=>false,val:()=>null});
 const set=async(p)=>__writes.push(p),update=set,remove=set,push=set;
 </script>`;
 source=source.replace(/import\s+[\s\S]*?from\s+"https:\/\/www\.gstatic\.com\/firebasejs\/[^"\n]+";/g,'').replace('<script type="module">',boot+'<script type="module">');
 const p=await browser.newPage();await p.setViewport({width:1366,height:900});
 p.on('pageerror',e=>result.errors.push(surface+': '+e.message));await p.setRequestInterception(true);
 p.on('request',async req=>{try{const u=new URL(req.url());if(u.hostname==='reader.invalid'){
  if(req.isNavigationRequest())return req.respond({status:200,contentType:'text/html',body:source});
  const rel=decodeURIComponent(u.pathname).replace(/^\//,''),file=path.resolve(root,rel);
  if(file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())return req.respond({status:200,contentType:rel.endsWith('.js')?'application/javascript':rel.endsWith('.json')?'application/json':rel.endsWith('.css')?'text/css':'application/octet-stream',body:fs.readFileSync(file)});
 }return req.abort();}catch(e){result.errors.push(e.message);if(!req.isInterceptResolutionHandled())await req.abort();}});
 await p.goto('https://reader.invalid/'+surface+'.html?lang='+lang,{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>typeof window.__auditBook==='function'&&typeof window.__auditLegacy==='function');
 return p;
}
async function render(p,value,surface){
 const out=await p.evaluate(async(value,surface)=>{
  const before=JSON.stringify(value);window.__auditLegacy(value);
  const legacy=document.getElementById(surface+'Root').textContent.replace(/\s+/g,' ').trim();
  const themes={};
  for(const theme of ['screen','keepsake']){
   const html=window.__auditBook(value,theme);if(!html||html.startsWith('ERR:'))throw Error('Book generation failed');
   const f=document.createElement('iframe');f.style.width='1200px';f.style.height='900px';document.body.append(f);
   await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('iframe timeout')),10000);f.onload=()=>{clearTimeout(timer);resolve();};f.srcdoc=html;});
   const d=f.contentDocument,pages=[...d.querySelectorAll('.page')];if(!pages.length)throw Error('Book pages missing');
   themes[theme]={pages:pages.map(e=>e.textContent.replace(/\s+/g,' ').trim()),scripts:[...d.scripts].filter(s=>!s.src).map(s=>s.textContent)};
   f.remove();
  }
  if(JSON.stringify(value)!==before)throw Error('Renderer mutated payload');
  return {legacy,themes,writes:window.__writes.length};
 },value,surface);
 assert.equal(out.writes,0);
 for(const t of Object.values(out.themes))for(const s of t.scripts)new vm.Script(s);
 return out;
}
async function main(){
 const browser=await puppeteer.launch({headless:true,...(process.env.LP_BROWSER_PATH?{executablePath:process.env.LP_BROWSER_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
 try{result.browserVersion=await browser.version();await ui(browser);
 for(const lang of ['ko','en'])for(const surface of ['report','program']){
  for(const q of others){
  // Bound listener/timer accumulation from repeated legacy rendering.
  const p=await openReader(browser,surface,lang);
  for(const control of [false,true]){
   const a=base(0);a[q.id]=q.type==='multi_choice'?[a[q.id][0],'기타 (직접 입력)']:'기타 (직접 입력)';
   a[q.otherId]=pairs[q.otherId][0];const b=copy(a);b[q.otherId]=pairs[q.otherId][1];
   const old=build(a,lang,control),next=build(b,lang,control),key=surface==='report'?'r':'p';
   const before=await render(p,old[key],surface),after=await render(p,next[key],surface);
   result.render.push({lang,surface,qid:q.otherId,hashControlled:control,legacyChanged:before.legacy!==after.legacy,
    legacyContainsDirectText:before.legacy.includes(a[q.otherId]),themes:Object.fromEntries(['screen','keepsake'].map(t=>[t,{
     pageCount:before.themes[t].pages.length,changedPages:before.themes[t].pages.flatMap((v,i)=>v!==after.themes[t].pages[i]?[i+1]:[]),
     pagesContainingDirectText:before.themes[t].pages.flatMap((v,i)=>v.includes(a[q.otherId])?[i+1]:[])}]))});
  }await p.close();
  console.log('AUDITED',lang,surface,q.otherId,result.render.length);
  if(process.argv[2])fs.writeFileSync(path.resolve(process.argv[2])+'.partial.json',JSON.stringify(result,null,2)+'\n');
  }
 }
 assert.equal(result.errors.length,0,result.errors.join('\n'));
 assert.equal(result.ui.length,40);assert.equal(result.render.length,160);
 result.summary={uiCases:result.ui.length,renderPairs:result.render.length,
  hashControlledVisibleChanges:result.render.filter(r=>r.hashControlled&&(r.legacyChanged||Object.values(r.themes).some(t=>t.changedPages.length))).map(r=>({qid:r.qid,lang:r.lang,surface:r.surface})),
  selectedOtherNotRequiredForVisibleTextarea:result.ui.filter(r=>r.textareaVisibleWithoutOther).length,
  deselectedTextStillActive:result.ui.filter(r=>r.deselectedStillActive).length};
 if(process.argv[2])fs.writeFileSync(path.resolve(process.argv[2]),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result.summary,null,2));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e,result.errors);if(process.argv[2])fs.writeFileSync(path.resolve(process.argv[2])+'.failed.json',JSON.stringify(result,null,2)+'\n');process.exitCode=1;});
