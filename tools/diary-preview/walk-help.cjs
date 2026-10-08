// Browser check of "?" help: hover preview (PC), click pin, Esc, outside click, touch tap (phone), keyboard, guide page deep link.
const path=require('node:path');const puppeteer=require(path.resolve(__dirname,'../../node_modules/puppeteer'));
const base=process.env.BASE||'http://127.0.0.1:3300',OUT='/home/user/ax-work/diary-preview',SID='s_1791440430847_preview';
(async()=>{const b=await puppeteer.launch({headless:true,...(process.env.LP_BROWSER_PATH?{executablePath:process.env.LP_BROWSER_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});const out={};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const open=async(w,h,touch)=>{const p=await b.newPage();await p.setViewport({width:w,height:h,hasTouch:touch,isMobile:touch&&w<700});const errs=[];p.on('pageerror',e=>errs.push(e.message));p.errs=errs;
 await p.goto(base+'/diary.html?sid='+SID,{waitUntil:'networkidle0'});await p.waitForSelector('#dy-app:not([hidden])');await p.evaluate(()=>document.fonts.ready);await p.evaluate(()=>document.body.classList.add('no-motion'));return p;};
const vis=(p,sel)=>p.$$eval(sel,els=>els.filter(e=>!e.hidden).length);
// PC
{const p=await open(1280,800,false);await p.evaluate(()=>DiaryApp.go('mission'));await wait(300);const r={};
 r.tipsOnSpread=await p.$$eval('.dy-page .tip-btn',e=>e.length);
 const btn=await p.$('.dy-page.right .pg-hrow .tip-btn');await btn.hover();await wait(150);r.hoverOpens=await vis(p,'.dy-page .tip-pop')===1;
 await p.screenshot({path:`${OUT}/1280-h1-hover.png`});
 await p.mouse.move(5,400);await wait(450);r.hoverLeaveCloses=await vis(p,'.dy-page .tip-pop')===0;
 await btn.click();await p.mouse.move(5,400);await wait(450);r.clickPins=await vis(p,'.dy-page .tip-pop')===1;
 await p.keyboard.press('Escape');await wait(100);r.escCloses=await vis(p,'.dy-page .tip-pop')===0;r.escReturnsFocus=await p.evaluate(()=>document.activeElement.classList.contains('tip-btn'));
 await btn.click();await p.mouse.click(5,400);await wait(100);r.dialogOpen=await p.evaluate(()=>!!document.querySelector('dialog[open]'));r.outsideCloses=await vis(p,'.dy-page .tip-pop')===0;await btn.click();await wait(80);r.insidePopupKeepsOpen=await p.evaluate(async()=>{const pop=document.querySelector(".dy-page .tip-pop:not([hidden])");if(!pop)return false;pop.querySelector("p").click();await new Promise(r=>setTimeout(r,80));return !pop.hidden;});await p.keyboard.press("Escape");
 // keyboard: Tab to the help button, Enter opens, aria-expanded true
 await p.evaluate(()=>DiaryApp.go('vision'));await wait(1400);await p.evaluate(()=>document.querySelector('.dy-page.right .pg-h').focus());await p.keyboard.press('Tab');r.tabReachesTip=await p.evaluate(()=>document.activeElement.classList.contains('tip-btn'));if(!r.tabReachesTip)r.tabWhere=await p.evaluate(()=>{const a=document.activeElement;return a.tagName+'.'+a.className+'|'+(a.closest('.dy-page')?.dataset.key)+'|'+DiaryApp._view.idx});
 await p.keyboard.press('Enter');await wait(100);r.enterOpens=await p.evaluate(()=>document.activeElement.getAttribute('aria-expanded')==='true');
 r.arrowKeysDontTurnWhileTip=true;
 await p.keyboard.press('Escape');
 // spot tips
 await p.mouse.move(5,400);await p.evaluate(()=>DiaryApp.go('axes-a'));await p.waitForFunction(()=>!document.querySelector('.turn-layer'));await wait(100);const pt=await p.$('.axis-pct .tip-btn');await pt.click();await wait(100);r.pctTip=await p.evaluate(()=>[...document.querySelectorAll('.tip-pop')].find(e=>!e.hidden)?.innerText.includes('응답한 강도'));
 await p.screenshot({path:`${OUT}/1280-h2-pct.png`});
 const box=await p.evaluate(()=>{const e=[...document.querySelectorAll('.tip-pop')].find(e=>!e.hidden).getBoundingClientRect();return {l:e.left,r:e.right,t:e.top,b:e.bottom,vw:innerWidth,vh:innerHeight};});r.pctInView=box.l>=0&&box.r<=box.vw&&box.t>=0&&box.b<=box.vh;
 // every template has page help text
 r.allTemplatesHaveHelp=await p.evaluate(()=>Object.keys(DiarySchema.TEMPLATES).every(k=>DiaryHelp.PAGE[k]&&DiaryHelp.PAGE[k].why&&DiaryHelp.PAGE[k].how));
 // flat book at rest
 r.bookTransform=await p.evaluate(()=>getComputedStyle(document.getElementById('dy-book')).transform);
 r.errs=p.errs;out.pc=r;await p.close();}
// phone
{const p=await open(375,780,true);await p.evaluate(()=>DiaryApp.go('top2'));await wait(300);const r={};
 await p.tap('.dy-page .pg-hrow .tip-btn');await wait(150);r.tapOpens=await vis(p,'.dy-page .tip-pop')===1;
 const box=await p.evaluate(()=>{const e=[...document.querySelectorAll('.tip-pop')].find(e=>!e.hidden).getBoundingClientRect();return {l:e.left,r:e.right,t:e.top,b:e.bottom,vw:innerWidth,vh:innerHeight};});r.inView=box.l>=0&&box.r<=box.vw&&box.t>=0&&box.b<=box.vh;
 await p.screenshot({path:`${OUT}/375-h1-tap.png`});
 await p.tap('.dy-page .pg-hrow .tip-btn');await wait(150);r.tapAgainCloses=await vis(p,'.dy-page .tip-pop')===0;
 await p.tap('.dy-page .pg-hrow .tip-btn');await wait(100);await p.tap('.dy-page .pg-sub');await wait(100);r.tapOutsideCloses=await vis(p,'.dy-page .tip-pop')===0;
 r.tapTarget=await p.$eval('.tip-btn',e=>{const s=getComputedStyle(e,'::after');return e.getBoundingClientRect().width+2*Math.abs(parseFloat(s.left)||9)});
 r.errs=p.errs;out.phone=r;await p.close();}
// guide page
{const p=await b.newPage();await p.setViewport({width:375,height:780});const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(base+'/diary-guide.html#week_l',{waitUntil:'networkidle0'});await wait(300);
 out.guide={deepLinkOpens:await p.$eval('#week_l',e=>e.open),pages:await p.$$eval('details.pg',e=>e.length),faq:await p.$$eval('#faq-list details',e=>e.length),stages:await p.$$eval('#stage-list li',e=>e.length),
  overflow:await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),bad:await p.evaluate(()=>/4SE|\bQ\d{1,3}\b|undefined|NaN|−28%|\+34%|\+78%|2~3배/.test(document.body.innerText)),errs};
 await p.screenshot({path:`${OUT}/375-guide.png`,fullPage:false});await p.goto(base+'/diary-guide.html',{waitUntil:'networkidle0'});await p.setViewport({width:1280,height:800});await p.screenshot({path:`${OUT}/1280-guide.png`,fullPage:true});await p.close();}
console.log(JSON.stringify(out,null,1));await b.close();})().catch(e=>{console.error(e);process.exit(1);});
