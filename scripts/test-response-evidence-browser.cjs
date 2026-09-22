'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createRequire}=require('node:module');
const root=path.resolve(__dirname,'..'),puppeteer=require('puppeteer'),T=require('./test-response-evidence.cjs');
const survey=fs.readFileSync(path.join(root,'suvey.html'),'utf8');
function extract(a,b){const i=survey.indexOf(a),j=survey.indexOf(b,i);assert.ok(i>=0&&j>i);return survey.slice(i,j);}
const harnessFile=path.join(__dirname,'audit-conditional-browser.cjs'),harness=fs.readFileSync(harnessFile,'utf8').split('async function main(){')[0];
const H=new Function('require','__dirname',harness+';return {openReader,render,result};')(createRequire(harnessFile),__dirname);
(async()=>{
 const browser=await puppeteer.launch({headless:true,...(process.env.LP_BROWSER_PATH?{executablePath:process.env.LP_BROWSER_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});let ui=0,readers=0;
 try{
 const p=await browser.newPage();await p.setRequestInterception(true);p.on('request',r=>r.abort());
 await p.setContent('<main id="fixture"></main>');
 await p.addScriptTag({content:`let answers={},questionsData=${JSON.stringify(require('../data/questions.json'))};const _t=(_k,v)=>v,_qText=q=>q.text,_qOptionLabel=(_q,v)=>v,_curLang=()=> 'ko';function debounceSave(){_syncOtherInputs();}
 ${extract('    function renderQuestion(q){','    // ============== 검토 단계')}
 ${extract('    function countAnswered(){','    function updateHeader(){')}
 ${extract('    function _isAnswerEmpty(v){','    const stepBody =')}
 window.mount=(q,a)=>{answers=structuredClone(a);document.getElementById('fixture').replaceChildren(renderQuestion(q));};window.state=q=>({answers:structuredClone(answers),active:_isOtherActive(q),count:countAnswered()});`});
 for(const width of [393,1366])for(const q of T.others){
  await p.setViewport({width,height:900});const a=T.base(0);a[q.id]=q.type==='multi_choice'?[q.options[0]]:q.options[0];
  await p.evaluate((q,a)=>mount(q,a),q,a);const ta='#other_'+q.otherId,other='input[name="'+q.id+'"][value="기타 (직접 입력)"]';
  assert.equal(await p.$eval(ta,e=>e.disabled),true);
  await p.click(other);assert.equal(await p.$eval(ta,e=>e.disabled),false);assert.deepEqual((await p.evaluate(q=>state(q),q)).count,{count:56,total:56});
  await p.type(ta,'원문, 쉼표/경계와 조건을 보존');const filled=await p.evaluate(q=>state(q),q);assert.equal(filled.count.total,57);
  if(q.type==='multi_choice')await p.click(other);else await p.click('input[name="'+q.id+'"]');
  const off=await p.evaluate(q=>state(q),q);assert.equal(off.active,false);assert.equal(off.answers[q.otherId],filled.answers[q.otherId]);assert.equal(off.count.total,56);assert.equal(await p.$eval(ta,e=>e.disabled),true);
  await p.evaluate((q,a)=>mount(q,JSON.parse(JSON.stringify(a))),q,off.answers);await p.click(other);assert.equal(await p.$eval(ta,e=>e.value),filled.answers[q.otherId]);
  await p.$eval(ta,e=>{e.value='  ';e.dispatchEvent(new Event('input',{bubbles:true}));});assert.equal((await p.evaluate(q=>state(q),q)).count.total,56);ui++;
 }
 await p.close();
 // Save/submit functions are real; capture payloads using the established offline transport audit.
 const audit=fs.readFileSync(path.join(__dirname,'audit-conditional-inputs.cjs'),'utf8');
 const transports=new Function('require','__dirname',audit.replace(/if\(require\.main===module\)main\(\)\.catch[\s\S]*$/,'')+';return transport;')(createRequire(path.join(__dirname,'audit-conditional-inputs.cjs')),__dirname);
 for(const mode of ['sdk','rest','group'])await transports(mode);
 for(const lang of ['ko','en'])for(const width of [393,1366]){
  const a=T.base(7);for(const q of T.others){a[q.id]=q.type==='multi_choice'?[q.options[0],'기타 (직접 입력)']:'기타 (직접 입력)';a[q.otherId]='관찰한 조건을 비교하고 다음 작은 행동을 확인한다';}
  a.Q40='초보 운동 동작의 안전한 설명을 비교한다';
  const built=T.build(a,lang);
  for(const surface of ['report','program']){
   const value=surface==='report'?built.r:built.p,page=await H.openReader(browser,surface,lang);await page.setViewport({width,height:900});
   await page.evaluate(value=>{if(!window.__renderLivingBook(value))throw Error('reader mount failed');},value);
   await page.waitForFunction(()=>document.querySelector('#lbFrame')?.contentDocument?.querySelectorAll('.page').length===14);
   if(await page.$('#lpConsent .lp-consent__btn--ghost'))await page.click('#lpConsent .lp-consent__btn--ghost');
   const before=JSON.stringify(value);const rendered=await H.render(page,value,surface);assert.equal(JSON.stringify(value),before);
   for(const theme of ['screen','keepsake'])assert.equal(rendered.themes[theme].pages.length,14);
   if(surface==='report')for(const v of Object.values(built.r._responseEvidence.axes))assert.ok(rendered.legacy.includes(v.core));
   await page.click('#lpEvidenceButton');assert.equal(await page.$eval('#lpEvidenceDialog',e=>e.open),true);
   const dialog=await page.$eval('#lpEvidenceDialog',e=>e.textContent);for(const q of T.others)assert.ok(dialog.includes(a[q.otherId]));
   await page.keyboard.press('Escape');assert.equal(await page.$eval('#lpEvidenceDialog',e=>e.open),false);
   const hostile=JSON.parse(JSON.stringify(value));const q=T.others[0];hostile._responseEvidence.fields[q.id].other.rawText='<img src=x onerror="window.__evidenceXss=1">';
   await page.evaluate(v=>window.LPResponseEvidence.mountEvidence(v._responseEvidence),hostile);await page.click('#lpEvidenceButton');
   assert.equal(await page.$$eval('#lpEvidenceDialog img',es=>es.length),0);assert.equal(await page.evaluate(()=>window.__evidenceXss),undefined);await page.keyboard.press('Escape');
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);assert.equal(overflow,false,'outer viewport overflow');
   for(const theme of ['screen','keepsake']){
    const html=await page.evaluate((v,t)=>window.__auditBook(v,t),value,theme),print=await browser.newPage();await print.setRequestInterception(true);print.on('request',r=>r.abort());
    await print.setContent(html,{waitUntil:'domcontentloaded'});await print.emulateMediaType('print');await print.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));await new Promise(r=>setTimeout(r,150));
    const fit=await print.evaluate(()=>[...document.querySelectorAll('.page')].filter(p=>p.querySelector('.axis-reader')).map(p=>{const footer=p.querySelector('.page__num').getBoundingClientRect().top;return {scale:Number(p.getAttribute('data-pf-k')||1),inside:[...p.querySelectorAll('.axis-reader')].every(e=>e.getBoundingClientRect().bottom<footer)};}));
    assert.ok(fit.every(x=>x.inside&&x.scale>=0.85),JSON.stringify({lang,width,surface,theme,fit}));await print.close();
   }
   if(process.env.LP_EVIDENCE_ARTIFACT_DIR&&surface==='report'&&lang==='ko'){
    const preview=T.build(T.base(0),lang).r;
    await page.evaluate(v=>window.__renderLivingBook(v),preview);
    await new Promise(r=>setTimeout(r,300));
    await page.evaluate(()=>document.querySelector('#lbFrame').contentWindow.postMessage({t:'lb-go',page:10},'*'));
    await new Promise(r=>setTimeout(r,200));
    await page.screenshot({path:path.join(process.env.LP_EVIDENCE_ARTIFACT_DIR,'evidence-v2-'+width+'.png'),fullPage:true});
   }
   assert.equal(await page.evaluate(()=>__writes.length),0);await page.close();readers++;
  }
 }
 assert.equal(H.result.errors.length,0,H.result.errors.join('\n'));
 console.log('PASS '+ui+' native input state cases, 3 synthetic save/submit routes, '+readers+' report/program mobile/desktop readers, 14-page themes, evidence dialog/XSS and zero writes');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
