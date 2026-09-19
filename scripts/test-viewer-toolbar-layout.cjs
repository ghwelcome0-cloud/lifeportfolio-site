'use strict';
// Isolated real toolbar markup/CSS; no Auth, customer record or report generation.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),puppeteer=require('puppeteer');
(async()=>{const browser=await puppeteer.launch({headless:true,...(process.env.LP_BROWSER_PATH?{executablePath:process.env.LP_BROWSER_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});let count=0;
try{for(const file of ['report.html','program.html']){
 const source=fs.readFileSync(path.join(root,file),'utf8'),before=execFileSync('git',['show','e313c52:'+file],{cwd:root,encoding:'utf8',maxBuffer:5000000});
 const scripts=s=>Array.from(s.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi),m=>m[0]);
 // PR325 intentionally adds ONLY these group-result safety guards. Preserve the
 // CSS-only baseline for every other runtime byte; do not disable the freeze.
 const safetyAdditions = file==='report.html' ? [
  '      if (currentReport?._participation?.source === "b2b" && regenBtn) { regenBtn.hidden = true; regenBtn.style.display = "none"; }\n',
  [
   '          const accessSnap = await _safeGet(`b2b_access/${user.uid}`, "regen-group-access");',
   '          const groupAccess = accessSnap.exists() ? accessSnap.val() : null;',
   '          if (session.meta?.source === "b2b" || currentReport?._participation?.source === "b2b" || groupAccess?.surveySid === sid) {',
   '            // A group code has one persisted result. Never replace its body,',
   '            // erase a manual report, or remove the participation marker here.',
   '            location.replace(_withLang("report-loading.html?sid=" + encodeURIComponent(sid)));',
   '            return;',
   '          }', ''
  ].join('\n')
 ] : [];
 const verifyRuntime = value => {
  for (const addition of safetyAdditions) { assert.equal(value.split(addition).length,2,'Exact group guard must appear once'); value=value.replace(addition,''); }
  assert.deepEqual(scripts(value),scripts(before),'Runtime outside explicit group safety additions must remain byte-identical');
 };
 verifyRuntime(source);
 assert.throws(()=>verifyRuntime(source.replace('</script>','window.__unexpected_runtime_change=true;</script>')),'Unrelated runtime mutation must still fail');
 const page=await browser.newPage();await page.setRequestInterception(true);page.on('request',r=>r.abort());
 const fixture=await page.evaluate(html=>{const d=new DOMParser().parseFromString(html,'text/html');return '<!doctype html><html><head>'+Array.from(d.querySelectorAll('style'),s=>s.outerHTML).join('')+'</head><body style="margin:0;padding:0"><section class="lb-stage" style="width:100%;max-width:none;margin:0;border:0"><div class="lb-stage__bar">'+d.querySelector('.lb-toolbar').outerHTML+'</div></section></body></html>';},source);
 for(const width of [320,360,375,440,640,768,1024,1440])for(const lang of ['ko','en']){
  await page.setViewport({width,height:450});await page.setContent(fixture,{waitUntil:'domcontentloaded'});
  if(lang==='en')await page.evaluate(()=>{for(const [id,label]of [['lbPrev','Previous'],['lbNext','Next'],['lbFull','Full screen'],['lbZoomFit','Fit page']]){const s=document.querySelector('#'+id+' span');if(s)s.textContent=label;}});
  const checks=await page.evaluate(()=>{const row=document.querySelector('.lb-toolbar__row--view').getBoundingClientRect(),group=document.querySelector('.lb-zoomgrp').getBoundingClientRect();return {groupWidth:group.width,rowWidth:row.width,buttons:Array.from(document.querySelectorAll('.lb-toolbar button')).filter(e=>getComputedStyle(e).display!=='none').map(e=>{const r=e.getBoundingClientRect(),svg=e.querySelector('svg'),s=svg?.getBoundingClientRect();return {id:e.id,width:r.width,height:r.height,left:r.left,right:r.right,overflow:e.scrollWidth>e.clientWidth+1,icon:!svg||(s.width>=14&&s.height>=14&&s.left>=r.left&&s.right<=r.right)};})};});
  assert.ok(checks.groupWidth<=214,JSON.stringify({file,width,lang,checks}));
  for(const b of checks.buttons){assert.ok(b.width>=44&&b.height>=44,JSON.stringify({file,width,lang,b}));assert.ok(b.left>=0&&b.right<=width+1,JSON.stringify({file,width,lang,b}));assert.ok(!b.overflow&&b.icon,JSON.stringify({file,width,lang,b}));}
  count++;
 }
 await page.close();
}console.log('PASS '+count+' toolbar layouts; runtime outside exact group guards unchanged; mutation rejected');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
