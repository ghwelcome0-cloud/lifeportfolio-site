// Browser walk of the diary preview: every page at 375/768/1280, keyboard, swipe, save/reopen, quick record.
const path=require('node:path');const puppeteer=require(path.resolve(__dirname,'../../node_modules/puppeteer'));
const base=process.env.BASE||'http://127.0.0.1:3300',OUT='/home/user/ax-work/diary-preview',SID='s_1791440430847_preview';
const BAD=/\bQ\d{1,3}\b|self_(understanding|expression|design|execution)|evidenceRefs|axisRule|4SE|SE[1-4]\b|\+?\d+%\s*(높|증가)|−28%|\+19%|\+34%|\+78%|2~3배|undefined|NaN|\[object/;
(async()=>{const b=await puppeteer.launch({headless:true,...(process.env.LP_BROWSER_PATH?{executablePath:process.env.LP_BROWSER_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});const out={};
await fetch(base+'/__preview/reset',{redirect:'manual'});
for(const [w,h] of [[375,780],[768,1024],[1280,800]]){
 const p=await b.newPage();await p.setViewport({width:w,height:h,hasTouch:w<1000,isMobile:w<700});const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});p.on('dialog',d=>d.accept());
 await p.goto(base+'/diary.html?sid='+SID,{waitUntil:'networkidle0'});await p.evaluate(()=>document.fonts.ready);
 await p.waitForSelector('#dy-app:not([hidden])');await p.evaluate(()=>document.body.classList.add('no-motion'));
 const r={mode:await p.evaluate(()=>DiaryApp._view.mode),errs};
 await p.screenshot({path:`${OUT}/${w}-01-cover.png`});
 // start flow
 if(w===375){await p.click('[data-start]');await p.waitForSelector('#sh-start[open]');await p.screenshot({path:`${OUT}/${w}-02-start.png`});
  await p.$eval('#start-date',e=>e.value='2026-09-28');await p.click('#start-save');await p.waitForSelector('#start-done:not([hidden])');await p.screenshot({path:`${OUT}/${w}-03-started.png`});
  await p.click('#start-week');await new Promise(r=>setTimeout(r,300));}
 else {await p.reload({waitUntil:'networkidle0'});await p.waitForSelector('#dy-app:not([hidden])');await p.evaluate(()=>document.body.classList.add('no-motion'));await p.click('[data-go-week]');await new Promise(r=>setTimeout(r,300));}
 r.weekKey=await p.evaluate(()=>[...document.querySelectorAll('.dy-page[data-key]')].map(e=>e.dataset.key).join('+'));
 await p.screenshot({path:`${OUT}/${w}-04-week.png`});
 // walk all pages via keyboard
 await p.evaluate(()=>DiaryApp.go('cover'));await new Promise(r=>setTimeout(r,100));
 const bad=[],ovf=[];let steps=0,seen=new Set();
 for(;steps<300;steps++){
  const info=await p.evaluate(()=>{const ks=[...document.querySelectorAll('.dy-page[data-key]')].map(e=>e.dataset.key);const t=document.querySelector('#dy-book').innerText;
   const ov=[...document.querySelectorAll('.dy-page .pg')].some(pg=>pg.scrollWidth>pg.clientWidth+1);return {ks,t,ov,end:document.getElementById('nav-next').disabled,doc:document.documentElement.scrollWidth>innerWidth+1};});
  info.ks.forEach(k=>seen.add(k));const m=info.t.match(/\bQ\d{1,3}\b|self_(understanding|expression|design|execution)|evidenceRefs|axisRule|4SE|SE[1-4]\b|−28%|\+19%|\+34%|\+78%|2~3배|undefined|NaN|\[object/);if(m)bad.push(info.ks.join('+')+':'+m[0]);
  if(info.ov||info.doc)ovf.push(info.ks.join('+'));if(info.end)break;
  await p.keyboard.press('ArrowRight');await new Promise(r=>setTimeout(r,20));
 }
 r.pagesSeen=seen.size;r.steps=steps+1;r.bad=bad;r.overflow=[...new Set(ovf)].slice(0,10);
 // screenshots of key templates
 for(const k of ['mission','axes-a','top2','career','lifemap-1-r','month-1-grid','tracker-1','quarterly-7','usage','free-1']){await p.evaluate(k=>DiaryApp.go(k),k);await new Promise(r=>setTimeout(r,120));await p.screenshot({path:`${OUT}/${w}-p-${k}.png`});}
 // save + reopen
 await p.evaluate(()=>DiaryApp.go('mission'));await new Promise(r=>setTimeout(r,120));
 const txt='나는 먼저 내어 주는 사람 '+w;await p.$eval('#f-mission-word',e=>{e.value='';e.dispatchEvent(new Event('input',{bubbles:true}));});await p.click('#f-mission-word');await p.keyboard.type(txt);await p.keyboard.press('Tab');
 await p.waitForFunction(()=>document.getElementById('dy-save').textContent==='저장됨',{timeout:8000});
 await p.click('[data-copy-page="mission"]');await new Promise(r=>setTimeout(r,900));
 // quick record via FAB
 await p.click('#fab');await p.waitForSelector('#sh-quick[open]');await p.type('#qr-text','예상 결과를 먼저 적고 같이 실행해 봤어요 '+w);
 if(w===375)await p.screenshot({path:`${OUT}/${w}-05-quick1.png`});
 await p.click('#qr-next');await p.waitForSelector('#qr-kept');await p.type('#qr-kept','비교 메모 한 장');await p.click('#qr-next');await p.waitForSelector('#qr-done');
 if(w===375)await p.screenshot({path:`${OUT}/${w}-06-quick-done.png`});
 await p.click('#qr-next');await new Promise(r=>setTimeout(r,300));await p.screenshot({path:`${OUT}/${w}-07-week-right.png`});
 // one-question mode
 await p.evaluate(()=>DiaryApp.go('vision'));await new Promise(r=>setTimeout(r,120));await p.click('[data-oneq="vision"]');await p.waitForSelector('#sh-oneq[open]');await p.keyboard.type('조용한 작업실에서 사람들과');
 if(w===375)await p.screenshot({path:`${OUT}/${w}-08-oneq.png`});await p.click('#oq-next');await new Promise(r=>setTimeout(r,200));await p.keyboard.press('Escape');await new Promise(r=>setTimeout(r,900));
 // toc
 await p.click('#where');await p.waitForSelector('#sh-toc[open]');await p.screenshot({path:`${OUT}/${w}-09-toc.png`});await p.keyboard.press('Escape');
 // reopen fresh
 await p.reload({waitUntil:'networkidle0'});await p.waitForSelector('#dy-app:not([hidden])');
 r.reopen=await p.evaluate(()=>({word:(DiaryApp._state.pages.mission||{fields:{}}).fields.word,core:!!(DiaryApp._state.pages.mission||{fields:{}}).fields.core,scene:(DiaryApp._state.pages.vision||{fields:{}}).fields.scene,logs:DiaryApp._state.logs.length,start:DiaryApp._state.meta&&DiaryApp._state.meta.startDate}));
 r.reopenOK=r.reopen.word===txt;
 // swipe (touch) on phone
 if(w<1000){await p.evaluate(()=>DiaryApp.go('intro'));await new Promise(r=>setTimeout(r,1400));const box=await (await p.$('#dy-stage')).boundingBox();
  const y=box.y+box.height*0.55;await p.touchscreen.touchStart(box.x+box.width-30,y);for(let i=1;i<=6;i++)await p.touchscreen.touchMove(box.x+box.width-30-i*45,y);await p.touchscreen.touchEnd();await new Promise(r=>setTimeout(r,1400));
  r.afterSwipe=await p.evaluate(()=>document.querySelector('.dy-page[data-key]').dataset.key);r.swipeOK=r.afterSwipe==='mission';}
 else {await p.evaluate(()=>DiaryApp.go('intro'));await new Promise(r=>setTimeout(r,1400));const bx=await (await p.$('.dy-page.right .pg')).boundingBox();const y=bx.y+30;
  await p.mouse.move(bx.x+bx.width-20,y);await p.mouse.down();await p.mouse.move(bx.x+40,y,{steps:8});await p.mouse.up();await new Promise(r=>setTimeout(r,1400));
  r.afterDrag=await p.evaluate(()=>[...document.querySelectorAll('.dy-page[data-key]')].map(e=>e.dataset.key).join('+'));r.dragOK=r.afterDrag==='vision+axes-a';}
 // 3D turn animates (motion on)
 await p.evaluate(()=>document.body.classList.remove('no-motion'));await p.evaluate(()=>DiaryApp.go('mission'));await new Promise(r=>setTimeout(r,1300));
 await p.click('#nav-next');await new Promise(r=>setTimeout(r,250));r.turnLayer=await p.evaluate(()=>!!document.querySelector('.turn-layer .leaf'));await p.screenshot({path:`${OUT}/${w}-10-turning.png`});await new Promise(r=>setTimeout(r,1300));
 r.turnDone=await p.evaluate(()=>!document.querySelector('.turn-layer'));
 out[w]=r;await p.close();}
const g=await b.newPage();await g.setViewport({width:375,height:780});await g.goto(base+'/diary.html?signedout=1',{waitUntil:'networkidle0'});out.signedOutGate=await g.$eval('#dy-gate',e=>!e.hidden&&e.innerText.includes('로그인하면 다이어리에 보관됩니다'));await g.screenshot({path:`${OUT}/375-00-signedout.png`});
await g.goto(base+'/',{waitUntil:'networkidle0'});await g.screenshot({path:`${OUT}/375-00-hub.png`,fullPage:true});
console.log(JSON.stringify(out,null,1));await b.close();})().catch(e=>{console.error(e);process.exit(1);});
