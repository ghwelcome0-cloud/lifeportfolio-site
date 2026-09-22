'use strict';
// Isolated real toolbar markup/CSS; no Auth, customer record or report generation.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),puppeteer=require('puppeteer');
(async()=>{const browser=await puppeteer.launch({headless:true,...(process.env.LP_BROWSER_PATH?{executablePath:process.env.LP_BROWSER_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});let count=0;
try{for(const file of ['report.html','program.html']){
 const source=fs.readFileSync(path.join(root,file),'utf8'),before=execFileSync('git',['show','e313c52:'+file],{cwd:root,encoding:'utf8',maxBuffer:5000000});
 const scripts=s=>Array.from(s.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi),m=>m[0]);
 // Approved VII projection intentionally changes runtime. Pin every script byte and
 // retain a mutation-negative test; program stays on the original baseline.
 const verifyRuntime = value => {
  if(file==='report.html')assert.equal(require('node:crypto').createHash('sha256').update(scripts(value).join('')).digest('hex'),'ae86af4d1cdf8949849edf6e64700e19926b73f88bae4d6adf79f59f2f43485a','Four-axis reader runtime must match reviewed fingerprint');
  else {
   // Approved evidence dialog loader and mount only; inverse them before the full baseline comparison.
   for(const addition of ['<script src="assets/js/response-evidence.js?v=input-v2"></script>', '          if (window.LPResponseEvidence) window.LPResponseEvidence.mountEvidence(program._responseEvidence);\n']) {
    assert.ok(value.includes(addition),'Evidence mount/loader must remain exact');
    value=value.replace(addition,'');
   }
   // Only these fixed reader instructions may differ; restore them for a full byte comparison.
   const copyEdits=[
    ['매주 하나씩 실천하기','매일 굴리는 실행'],
    ['할 일과 완료 기준','매일 굴리는 도구'],
    ['해 본 일과 다음 할 일','기록 → 회고 → 결정'],
    ['할 일을 작게 나눈 활동 카드입니다. 하나씩 해 보고, <b>완료 기준</b>으로 마쳤는지 확인하세요.','매일 굴리는 도구입니다. 각 모듈은 <b>완료 기준</b>이 정해져 있어, 어디까지 하면 끝인지 분명합니다.']
   ];
   for(const [next,old] of copyEdits){assert.ok(value.includes(next),'Approved guidance must remain present');value=value.replaceAll(next,old);}
   assert.deepEqual(scripts(value),scripts(before),'Program runtime outside fixed guidance must remain byte-identical');
  }
 };
 verifyRuntime(source);
 assert.throws(()=>verifyRuntime(source.replace('</script>','window.__unexpected_runtime_change=true;</script>')),'Unrelated runtime mutation must still fail');
 const page=await browser.newPage();await page.setRequestInterception(true);page.on('request',r=>r.abort());
 const fixture=await page.evaluate(html=>{const d=new DOMParser().parseFromString(html,'text/html');return '<!doctype html><html><head>'+Array.from(d.querySelectorAll('style'),s=>s.outerHTML).join('')+'</head><body style="margin:0;padding:0"><main id="livingBook"><section class="lb-stage" style="width:100%;max-width:none;margin:0;border:0"><div class="lb-stage__bar">'+d.querySelector('.lb-toolbar').outerHTML+'</div></section></main></body></html>';},source);
 for(const width of [320,360,375,440,640,768,1024,1440])for(const lang of ['ko','en']){
  await page.setViewport({width,height:450});await page.setContent(fixture,{waitUntil:'domcontentloaded'});
  if(lang==='en')await page.evaluate(()=>{for(const [id,label]of [['lbPrev','Previous'],['lbNext','Next'],['lbFull','Full screen'],['lbZoomFit','Fit page']]){const s=document.querySelector('#'+id+' span');if(s)s.textContent=label;}});
  const checks=await page.evaluate(()=>{const row=document.querySelector('.lb-toolbar__row--view').getBoundingClientRect(),group=document.querySelector('.lb-zoomgrp').getBoundingClientRect();return {groupWidth:group.width,rowWidth:row.width,buttons:Array.from(document.querySelectorAll('.lb-toolbar button')).filter(e=>getComputedStyle(e).display!=='none').map(e=>{const r=e.getBoundingClientRect(),svg=e.querySelector('svg'),s=svg?.getBoundingClientRect();return {id:e.id,width:r.width,height:r.height,left:r.left,right:r.right,overflow:e.scrollWidth>e.clientWidth+1,icon:!svg||(s.width>=14&&s.height>=14&&s.left>=r.left&&s.right<=r.right)};})};});
  assert.ok(checks.groupWidth<=214,JSON.stringify({file,width,lang,checks}));
  assert.ok(checks.buttons.some(b=>b.id==='lbZoomFit'),'Fit page must be visible on PC and mobile');
  for(const b of checks.buttons){assert.ok(b.width>=44&&b.height>=44,JSON.stringify({file,width,lang,b}));assert.ok(b.left>=0&&b.right<=width+1,JSON.stringify({file,width,lang,b}));assert.ok(!b.overflow&&b.icon,JSON.stringify({file,width,lang,b}));}
  count++;
 }
 {
  const start=source.indexOf('      // 이전/다음 · 전체화면 · 하단 버튼');
  const end=source.indexOf('      // Living Book 마운트',start);
  const controls=source.slice(start,end);assert.ok(start>0&&end>start);
  const toggleStart=source.indexOf('      (function _lbWireTocToggle(){');
  const toggleEnd=source.indexOf('      // 현재 페이지에 해당하는 장',toggleStart);
  const toggle=source.slice(toggleStart,toggleEnd);assert.ok(toggleStart>0&&toggleEnd>toggleStart);
  for(const width of [320,375,768,1280]){
   await page.goto('about:blank');
   await page.setViewport({width,height:900});
   const reader=await page.evaluate(html=>{const d=new DOMParser().parseFromString(html,'text/html'),book=d.getElementById('livingBook');book.hidden=false;book.querySelector('#lbLoading').remove();book.querySelector('#lbName').textContent='합성 화면 · UI 검증용';book.querySelector('#lbChapters').innerHTML=Array.from({length:12},(_,i)=>'<li><button type="button" class="lb-chap lb-toc__item '+(i===0?'is-current':'')+'"><span class="no">'+(i+1)+'</span><span class="tx">'+(i===0?'한눈에 보는 나':'나의 방향과 실행 계획')+'</span></button></li>').join('');const f=book.querySelector('iframe');f.removeAttribute('style');f.setAttribute('srcdoc','<!doctype html><style>body{margin:0;background:#edf1ec;color:#173e36;font:16px/1.8 sans-serif}article{box-sizing:border-box;max-width:600px;margin:24px auto;padding:28px;background:white;border:1px solid #ccd8d1}h1{font-size:28px}p{line-height:1.8}</style><article><small>합성 화면 · 고객 리포트 아님</small><h1>한눈에 보는 나</h1><p>기존 리포트 내용과 지면은 변경하지 않습니다.</p><p>이 화면은 목차와 보기 도구의 배치를 확인하기 위한 예시입니다.</p></article>');return '<!doctype html><html lang="ko"><head>'+Array.from(d.querySelectorAll('style'),s=>s.outerHTML).join('')+'</head><body style="margin:0;padding:12px">'+book.outerHTML+'</body></html>';},source);
   await page.setContent(reader,{waitUntil:'domcontentloaded'});
   await page.addScriptTag({content:'const _lbState={cur:1};const _t=(k,v)=>v;window.__messages=[];const _lbPost=m=>__messages.push(m);const _lbFrame=()=>document.getElementById("lbFrame");'+controls+toggle});
   await page.click('#lbZoomFit');assert.ok(await page.evaluate(()=>__messages.some(m=>m.t==='lb-zoom'&&m.mode==='fitscreen'&&m.vh>80)));
   await page.click('#lbNext');assert.ok(await page.evaluate(()=>__messages.some(m=>m.t==='lb-go'&&m.page===2)));
   if(width<=960){assert.equal(await page.$eval('.lb-toc__list',e=>getComputedStyle(e).visibility),'hidden');await page.click('#lbTocToggle');assert.equal(await page.$eval('.lb-toc__list',e=>getComputedStyle(e).visibility),'visible');assert.equal(await page.$eval('#lbTocToggle',e=>e.getAttribute('aria-expanded')),'true');await page.click('#lbTocToggle');}
   const selected=await page.$eval('.lb-toc__item.is-current .tx',e=>getComputedStyle(e).color);assert.equal(selected,'rgb(23, 62, 54)');
   await page.$eval('#lbZoomFit',e=>e.focus());assert.notEqual(await page.$eval('.lb-zoomgrp',e=>getComputedStyle(e).outlineStyle),'none');
   await page.click('#lbFull');await page.waitForFunction(()=>!!document.fullscreenElement);await page.mouse.move(width-2,898);
   const fsCheck=await page.$eval('.lb-stage__bar',e=>({opacity:getComputedStyle(e).opacity,pointer:getComputedStyle(e).pointerEvents,fit:getComputedStyle(document.getElementById('lbZoomFit')).display,scroll:e.scrollWidth,width:e.clientWidth}));
   assert.equal(fsCheck.opacity,'1');assert.equal(fsCheck.pointer,'auto');assert.notEqual(fsCheck.fit,'none');assert.ok(fsCheck.scroll<=fsCheck.width+1,JSON.stringify(fsCheck));
   await page.click('#lbZoomFit');assert.ok(await page.evaluate(()=>__messages.filter(m=>m.mode==='fitscreen').length>=2));
   await page.evaluate(()=>document.exitFullscreen());
   if(process.env.LP_READER_SCREENSHOT_DIR&&[375,1280].includes(width))await page.screenshot({path:path.join(process.env.LP_READER_SCREENSHOT_DIR,file.replace('.html','')+'-reader-'+width+'.png'),fullPage:true});
   count++;
  }
 }
 await page.close();
}console.log('PASS '+count+' toolbar/reader layouts and controls; pinned runtime verified; mutation rejected');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
