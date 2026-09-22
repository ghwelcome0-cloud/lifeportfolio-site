'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createRequire}=require('node:module');
const T=require('./test-response-evidence.cjs'),R=require('../assets/js/response-evidence.js'),puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..'),hfile=path.join(__dirname,'audit-conditional-browser.cjs'),src=fs.readFileSync(hfile,'utf8').split('async function main(){')[0];
const H=new Function('require','__dirname',src+';return {openReader,render,result};')(createRequire(hfile),__dirname),questions=require('../data/questions.json');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const browser=await puppeteer.launch({headless:true,...(process.env.LP_BROWSER_PATH?{executablePath:process.env.LP_BROWSER_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});let count=0;
try{for(const lang of ['ko','en'])for(const width of [375,1366])for(const version of [null,'input-v2']){
 const a=T.base(0);a.Q63=['결과 / 성과 / 효율성'];a.Q65='주변 사람들의 조언이나 피드백';a.Q28=['감정을 솔직하게 말하는 편이다'];a.Q33=['경계 존중'];a.Q39=['기타 (직접 입력)'];a.Q40='초보 운동자에게 균형 잡는 동작을 시범으로 설명합니다.';a.Q49=['즉흥적으로 정해지는 유연한 하루'];a.Q57=['나만의 루틴이 있었기 때문에'];
 const old=T.build(a,lang,version).r,next=R.attachAxes(old,questions,a),serialized=JSON.stringify(next);let p=await H.openReader(browser,'report',lang);await p.setViewport({width,height:900});
 const before=await H.render(p,old,'report'),after=await H.render(p,next,'report');
 for(const theme of ['screen','keepsake']){
  assert.equal(after.themes[theme].pages.length,14);
  for(let i=0;i<14;i++)if(![9,10].includes(i)||lang==='en')assert.equal(after.themes[theme].pages[i],before.themes[theme].pages[i],`${lang}/${width}/${version} non-VII page ${i+1}`);
 }
 if(lang==='ko')assert.notEqual(after.themes.screen.pages[9],before.themes.screen.pages[9]);
 // Comparisons create detached print iframes; use a fresh page for native controls.
 await p.close();p=await H.openReader(browser,'report',lang);await p.setViewport({width,height:900});
 await p.evaluate(r=>{window.__axisBookReady=false;window.addEventListener('message',e=>{if(e.source===document.querySelector('#lbFrame')?.contentWindow&&e.data?.t==='lb-ready')window.__axisBookReady=true;});window.__renderLivingBook(r);},next);
 await p.waitForFunction(()=>window.__axisBookReady&&document.querySelector('#lbFrame')?.contentDocument?.querySelectorAll('.page').length===14);
 if(await p.$('#lpConsent .lp-consent__btn--ghost'))await p.click('#lpConsent .lp-consent__btn--ghost');
 if(width<960)await p.locator('#lbTocToggle').click();await p.locator('#lbChapters [data-anchor="ch7"]').click();
 await p.waitForFunction(()=>document.querySelector('#lbPos').textContent.includes('9 / 14'));
 await p.locator('#lbNext').click();await p.waitForFunction(()=>document.querySelector('#lbPos').textContent.includes('10 / 14'));
 await p.locator('#lbNext').click();await p.waitForFunction(()=>document.querySelector('#lbPos').textContent.includes('11 / 14'));
 await p.locator('#lbPrev').click();await p.waitForFunction(()=>document.querySelector('#lbPos').textContent.includes('10 / 14'));
 const charHeight=()=>p.evaluate(()=>{const d=document.querySelector('#lbFrame').contentDocument,e=d.querySelector('.page.lb-active .axis-reader__core'),r=d.createRange();r.setStart(e.firstChild,0);r.setEnd(e.firstChild,1);return r.getBoundingClientRect().height;});
 await p.locator('#lbZoomReset').click();await pause(250);
 const size=await charHeight();await p.locator('#lbZoomIn').click();
 await p.waitForFunction(before=>{const d=document.querySelector('#lbFrame').contentDocument,e=d.querySelector('.page.lb-active .axis-reader__core'),r=d.createRange();r.setStart(e.firstChild,0);r.setEnd(e.firstChild,1);return r.getBoundingClientRect().height>before;},{},size);
 await p.locator('#lbZoomFit').click();
 if(width>960){await p.locator('#lbFull').click();await p.waitForFunction(()=>!!document.fullscreenElement);await p.evaluate(()=>document.exitFullscreen());}
 for(const viewport of width<960?[{width:375,height:900},{width:900,height:375}]:[{width,height:900}]){
  await p.setViewport(viewport);await pause(200);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
  await p.evaluate(()=>{const f=document.querySelector('#lbFrame');f.contentDocument.querySelector('.page.lb-active .axis-reader:last-child .axis-reader__prompt:last-child').scrollIntoView({block:'center'});});
  assert.ok(await p.evaluate(()=>{const f=document.querySelector('#lbFrame'),e=f.contentDocument.querySelector('.page.lb-active .axis-reader:last-child .axis-reader__prompt:last-child'),r=e.getBoundingClientRect();return r.bottom>0&&r.top<f.clientHeight;}));
 }
 await p.setViewport({width,height:900});await p.locator('#lpEvidenceButton').click();assert.equal(await p.$eval('#lpEvidenceDialog',e=>e.open),true);if(lang==='ko')assert.ok((await p.$eval('#lpEvidenceDialog',e=>e.textContent)).includes('다른 리포트 페이지'));await p.keyboard.press('Escape');
 const hostile=JSON.parse(JSON.stringify(next._axisProjection));hostile.facts.Q40.raw='<img src=x onerror="window.__axisXss=1">';await p.evaluate(m=>window.LPResponseEvidence.mountEvidence(m),hostile);await p.locator('#lpEvidenceButton').click();assert.equal(await p.$$eval('#lpEvidenceDialog img',es=>es.length),0);assert.equal(await p.evaluate(()=>window.__axisXss),undefined);await p.keyboard.press('Escape');
 for(const theme of ['screen','keepsake']){
  const book=await p.evaluate((r,t)=>window.__auditBook(r,t),next,theme),print=await browser.newPage();await print.setRequestInterception(true);print.on('request',r=>r.abort());await print.setContent(book,{waitUntil:'domcontentloaded'});await print.emulateMediaType('print');await print.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));await pause(160);
  const fit=await print.evaluate(()=>[...document.querySelectorAll('.page')].filter(p=>p.querySelector('.axis-reader')).map(p=>({scale:Number(p.getAttribute('data-pf-k')||1),inside:[...p.querySelectorAll('.axis-reader')].every(e=>e.getBoundingClientRect().bottom<p.querySelector('.page__num').getBoundingClientRect().top)})));
  assert.ok(fit.every(x=>x.inside&&x.scale>=0.85),JSON.stringify({lang,width,version,theme,fit}));await print.close();
 }
 assert.equal(await p.evaluate(()=>__writes.length),0);assert.equal(JSON.stringify(next),serialized);await p.close();count++;console.log('PASS projection reader',lang,width,version);
}assert.equal(H.result.errors.length,0,H.result.errors.join('\n'));console.log('PASS '+count+' projection readers: unchanged non-VII pages, portrait/landscape, controls, zoom, print, XSS and zero writes');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
