'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
(async()=>{const browser=await puppeteer.launch({headless:true,...(process.env.LP_BROWSER_PATH?{executablePath:process.env.LP_BROWSER_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});let count=0;
try{
 for(const width of [360,393,1366])for(const lang of ['ko','en'])for(const decision of ['denied','granted']){
  const page=await browser.newPage();await page.setViewport({width,height:780});await page.setRequestInterception(true);page.on('request',r=>r.abort());
  await page.goto('about:blank');
  await page.setContent('<!doctype html><html lang="'+lang+'"><head><style>'+read('assets/css/lp-consent.css')+'</style></head><body><main style="min-height:1200px">Synthetic consent control test</main></body></html>');
  // about:blank storage may be unavailable; record the public API and emitted consent state instead.
  await page.addScriptTag({content:read('assets/js/lp-consent.js')});await page.addScriptTag({content:read('assets/js/ask-widget.js')});
  await page.waitForSelector('#lpConsent');await page.waitForSelector('.lp-ask-launcher');await new Promise(r=>setTimeout(r,400));
  const hit=()=>page.evaluate(()=>{const b=document.querySelector('.lp-consent__btn--ghost'),r=b.getBoundingClientRect(),h=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return b===h||b.contains(h);});
  assert.equal(await hit(),true,'Decline must be pointer-accessible');
  const negative=await page.addStyleTag({content:'.lp-consent{z-index:2147482000!important}'});assert.equal(await hit(),false,'Old stacking mutation must be detected');await negative.evaluate(e=>e.remove());
  const selector=decision==='denied'?'.lp-consent__btn--ghost':'.lp-consent__btn--primary';await page.click(selector);await new Promise(r=>setTimeout(r,350));
  assert.equal(await page.$('#lpConsent'),null);
  const state=await page.evaluate(()=>Array.from(window.dataLayer||[]).map(x=>Array.from(x)).filter(x=>x[0]==='consent'&&x[1]==='update').pop()?.[2]);
  assert.equal(state.analytics_storage,decision);for(const k of ['ad_storage','ad_user_data','ad_personalization'])assert.equal(state[k],'denied');
  assert.equal(await page.$eval('.lp-ask-launcher',e=>{const r=e.getBoundingClientRect(),h=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return e===h||e.contains(h);}),true,'Help must be usable after consent closes');
  await page.close();count++;
 }
 for(const file of ['report-guide.html','program-guide.html']){
  const source=read(file);if(file==='report-guide.html'){
   for(const term of ['점수 카드','응답 강도(%)','단계 라벨'])assert.ok(!source.includes(term),'Old VII guide must be removed: '+term);
   for(const term of ['나는 어떤 사람인가','나는 나를 어떻게 전하는가','나는 삶과 일을 어떻게 설계하는가','나는 정한 것을 어떻게 실제로 해내는가','핵심 자원','연결 다리','보완 설계','실행 점화','개인화 설명','같은 직업, 다른 길'])assert.ok(source.includes(term),term);
  }
  for(const width of [360,393,1366]){
   const page=await browser.newPage();await page.setViewport({width,height:800});await page.setRequestInterception(true);page.on('request',r=>r.abort());await page.setContent(source);
   const r=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+2,broken:[...document.querySelectorAll('a[href^="#"]')].filter(a=>!document.getElementById(a.hash.slice(1))).map(a=>a.hash)}));assert.equal(r.overflow,false);assert.deepEqual(r.broken,[]);await page.close();
  }
 }
 console.log('PASS '+count+' native consent decisions, old-stack negative controls, unchanged advertising denial; two guides at three widths and anchors');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
