// Cross-browser walk: Chromium (Chrome/Edge/Samsung Internet engine), Firefox, WebKit (Safari/iOS engine)
// × phone 375 (touch) / tablet 820 portrait + 1180 landscape (touch) / PC 1280·1440 (mouse).
// Checks: no errors, all pages turn, no overflow, no word split, "?" never clipped (inside viewport,
// not cut by the page frame), help opens/closes, save + reopen, swipe/drag, guide page + its link.
// Run: NODE_PATH=/var/tmp/pw2/node_modules node tools/diary-preview/walk-cross.cjs
const {chromium,firefox,webkit,devices}=require('playwright');
const base=process.env.BASE||'http://127.0.0.1:3300',SID='s_1791440430847_preview',OUT='/home/user/ax-work/diary-preview/cross';
require('node:fs').mkdirSync(OUT,{recursive:true});
const VIEWS=[{n:'phone',w:375,h:740,touch:true,mobile:true},{n:'tablet-p',w:820,h:1180,touch:true,mobile:false},{n:'tablet-l',w:1180,h:820,touch:true,mobile:false},{n:'pc',w:1280,h:800,touch:false},{n:'pc-wide',w:1440,h:900,touch:false}];
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function tipCheck(p){return p.evaluate(async()=>{const res=[];const btns=[...document.querySelectorAll('#dy-book .tip-btn')].filter(b=>b.getClientRects().length);
 for(const b of btns){b.click();await new Promise(r=>setTimeout(r,60));const pop=document.getElementById(b.getAttribute('aria-controls'));const r=pop.getBoundingClientRect();
  const vw=document.documentElement.clientWidth,vh=innerHeight;let clipped=false;
  // clipped by an ancestor with overflow other than visible?
  for(let e=pop.parentElement;e&&e!==document.body;e=e.parentElement){const cs=getComputedStyle(e);if(cs.overflow!=='visible'||cs.overflowX!=='visible'){const er=e.getBoundingClientRect();if(getComputedStyle(pop).position!=='fixed'&&(r.left<er.left-1||r.right>er.right+1||r.top<er.top-1||r.bottom>er.bottom+1))clipped=true;}}
  const inView=r.left>=0&&r.right<=vw+0.5&&r.top>=0&&r.bottom<=vh+0.5&&r.width>150;
  const top=document.elementFromPoint(Math.min(vw-2,Math.max(1,r.left+r.width/2)),Math.min(vh-2,Math.max(1,r.top+20)));const onTop=!!(top&&pop.contains(top));
  res.push({ok:!pop.hidden&&inView&&!clipped&&onTop,inView,clipped,onTop});b.click();await new Promise(r=>setTimeout(r,30));if(!pop.hidden){document.body.click();}}
 return {n:res.length,bad:res.filter(x=>!x.ok)};});}
(async()=>{const out={};
for(const [bn,bt] of [['chromium',chromium],['firefox',firefox],['webkit',webkit]]){const br=await bt.launch();out[bn]={version:br.version()};
 await fetch(base+'/__preview/reset',{redirect:'manual'});
 for(const v of VIEWS){const ctx=await br.newContext({viewport:{width:v.w,height:v.h},hasTouch:!!v.touch,...(bn!=='firefox'&&v.mobile?{isMobile:true}:{}),deviceScaleFactor:v.mobile?2:1});
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/favicon|fonts.g/.test(m.text()))errs.push(m.text())});p.on('dialog',d=>d.accept());
  const r={errs};
  await p.goto(base+'/diary.html?sid='+SID,{waitUntil:'networkidle'});await p.waitForFunction(()=>!document.getElementById('dy-app').hidden&&window.DiaryApp&&DiaryApp._state.call);await p.evaluate(()=>document.fonts.ready);
  await p.evaluate(()=>document.body.classList.add('no-motion'));r.mode=await p.evaluate(()=>DiaryApp._view.mode);
  if(!await p.evaluate(()=>!!DiaryApp._state.meta)){await p.click('[data-start]');await p.waitForSelector('#sh-start[open]');await p.fill('#start-date','2026-09-28');await p.click('#start-save');await p.waitForSelector('#start-done:not([hidden])');await p.click('#start-week');await wait(200);}
  // walk every page by keyboard; collect problems
  await p.evaluate(()=>DiaryApp.go('cover'));await wait(80);const bad=[],ovf=[],splits=[];let steps=0,tipN=0,tipBad=[];const seen=new Set();
  for(;steps<300;steps++){const s=await p.evaluate(()=>{const ks=[...document.querySelectorAll('.dy-page[data-key]')].map(e=>e.dataset.key);const t=document.getElementById('dy-book').innerText;
    const ov=[...document.querySelectorAll('.dy-page .pg')].some(pg=>pg.scrollWidth>pg.clientWidth+1)||document.documentElement.scrollWidth>innerWidth+1;
    let sp=0;const tw=document.createTreeWalker(document.getElementById('dy-book'),4,{acceptNode:n=>{const e=n.parentElement;if(!e||e.closest('textarea,input,select,option,.tip-pop,.sr-only,[aria-hidden=true]')||!e.getClientRects().length)return 2;return /[\uac00-\ud7a3]{2}/.test(n.nodeValue)?1:2;}});
    let n;while((n=tw.nextNode())){const tx=n.nodeValue,rg=document.createRange();let pt=null;for(let i=0;i<tx.length;i++){if(/\s/.test(tx[i]))continue;rg.setStart(n,i);rg.setEnd(n,i+1);const rc=rg.getClientRects()[0];if(!rc||!rc.width)continue;if(pt!==null&&rc.top>pt+4&&/[\uac00-\ud7a3]/.test(tx[i])&&/[\uac00-\ud7a3]/.test(tx[i-1]||''))sp++;pt=rc.top;}}
    return {ks,bad:/\bQ\d{1,3}\b|self_(understanding|expression|design|execution)|4SE|undefined|NaN|\[object/.test(t),ov,sp,end:document.getElementById('nav-next').disabled};});
   s.ks.forEach(k=>seen.add(k));if(s.bad)bad.push(s.ks.join('+'));if(s.ov)ovf.push(s.ks.join('+'));if(s.sp)splits.push(s.ks.join('+')+':'+s.sp);
   // "?" popups on representative templates (every unique layout once)
   const tpl=await p.evaluate(()=>[...document.querySelectorAll('.dy-page[data-key]')].map(e=>e.dataset.key).join());
   if(/^(cover|intro|mission|vision|axes-a|axes-b|top3|top2|profile|career|outro)|lifemap-1-|year-1-|annual|ninety|milestone-1|month-1-|week-1-|quarterly-1\b|note-1|gratitude-1\b|tracker-1\b|quotes-1|guide13|usage|owner|daily-1\b|free-1\b/.test(tpl)){const tc=await tipCheck(p);tipN+=tc.n;tc.bad.forEach(x=>tipBad.push(tpl+':'+JSON.stringify(x)));}
   if(s.end)break;await p.keyboard.press('ArrowRight');await wait(10);}
  Object.assign(r,{pages:seen.size,bad,overflow:ovf.slice(0,5),wordSplits:splits.slice(0,5),tipsChecked:tipN,tipProblems:tipBad.slice(0,5)});
  // screenshot with a help popup open on the RIGHT page edge (the reported clipping case)
  await p.evaluate(()=>DiaryApp.go('mission'));await wait(200);
  const tb=await p.$$('#dy-book .pg-hrow .tip-btn');const target=tb[tb.length-1];
  if(v.touch)await target.tap();else await target.click();await wait(150);
  r.helpOpenAtEdge=await p.evaluate(()=>{const b=[...document.querySelectorAll('.tip-btn')].find(b=>b.getAttribute('aria-expanded')==='true');if(!b)return false;const r=document.getElementById(b.getAttribute('aria-controls')).getBoundingClientRect();return r.left>=0&&r.right<=document.documentElement.clientWidth+0.5&&r.bottom<=innerHeight&&r.width>150;});
  await p.screenshot({path:`${OUT}/${bn}-${v.n}-help.png`});
  await p.keyboard.press('Escape');await wait(80);r.escCloses=await p.evaluate(()=>!document.querySelector('.tip-btn[aria-expanded=true]'));
  // save + reopen
  await p.fill('#f-mission-word','');const txt=bn+' '+v.n+' 저장';await p.fill('#f-mission-word',txt);await p.locator('#f-mission-word').blur();
  await p.waitForFunction(()=>document.getElementById('dy-save').textContent==='저장됨',null,{timeout:8000}).catch(()=>{});
  await p.reload({waitUntil:'networkidle'});await p.waitForFunction(()=>!document.getElementById('dy-app').hidden&&window.DiaryApp&&DiaryApp._state.call);
  r.reopenOK=await p.evaluate(t=>(DiaryApp._state.pages.mission||{fields:{}}).fields.word===t,txt);
  // turning by touch swipe / mouse drag / buttons
  await p.evaluate(()=>{document.body.classList.add('no-motion');DiaryApp.go('intro')});await wait(300);
  const before=await p.evaluate(()=>DiaryApp._view.idx);
  if(v.touch){const box=await p.locator('#dy-stage').boundingBox();const y=box.y+box.height*0.55;
   await p.evaluate(({x1,x2,y})=>{const st=document.getElementById('dy-stage'),tgt=document.elementFromPoint(x1,y)||st;let native=true;try{new Touch({identifier:1,target:tgt,clientX:0,clientY:0});}catch(e){native=false;}
    // WebKit desktop builds have no Touch constructor (iOS Safari does); fall back to an Event carrying the same touch lists.
    const T=(x)=>native?new Touch({identifier:1,target:tgt,clientX:x,clientY:y}):{identifier:1,target:tgt,clientX:x,clientY:y};
    const fire=(type,touches,changed)=>{let ev;if(native)ev=new TouchEvent(type,{bubbles:true,touches,changedTouches:changed});else{ev=new Event(type,{bubbles:true});Object.defineProperty(ev,'touches',{value:touches});Object.defineProperty(ev,'changedTouches',{value:changed});}tgt.dispatchEvent(ev);};
    fire('touchstart',[T(x1)],[T(x1)]);fire('touchend',[],[T(x2)]);window.__touchMode=native?'native':'synthetic';},{x1:box.x+box.width-40,x2:box.x+40,y}).catch(e=>r.touchApi=String(e.message).slice(0,80));}
  else{const bx=await p.locator('.dy-page[data-key] .pg').last().boundingBox();const y=bx.y+30;await p.mouse.move(bx.x+bx.width-20,y);await p.mouse.down();await p.mouse.move(bx.x+40,y,{steps:8});await p.mouse.up();}
  await wait(400);r.touchMode=await p.evaluate(()=>window.__touchMode||'mouse');r.swipeOrDragTurns=await p.evaluate(b=>DiaryApp._view.idx!==b,before);
  await p.click('#nav-next');await wait(200);r.buttonTurns=true;
  // quick record sheet works
  await p.click('#fab');await p.waitForSelector('#sh-quick[open]');await p.fill('#qr-text',bn+' '+v.n+' 해 봤어요');await p.click('#qr-next');await p.waitForSelector('#qr-kept');await p.click('#qr-next');
  r.quickOK=await p.waitForSelector('#qr-done',{timeout:6000}).then(()=>true,()=>false);await p.keyboard.press('Escape');
  // 3D turn animates and cleans up
  await p.evaluate(()=>{document.body.classList.remove('no-motion');DiaryApp.go('mission')});await wait(1300);await p.click('#nav-next');await wait(200);
  r.turnAnimates=await p.evaluate(()=>!!document.querySelector('.turn-layer'));await wait(1300);r.turnCleans=await p.evaluate(()=>!document.querySelector('.turn-layer'));
  // guide link + page
  r.guideLinks=await p.evaluate(()=>[...document.querySelectorAll('a[href^="/diary-guide.html"]')].length);
  const g=await ctx.newPage();await g.goto(base+'/diary-guide.html#tracker',{waitUntil:'networkidle'});await wait(200);
  r.guide=await g.evaluate(()=>({open:document.getElementById('tracker').open,ov:document.documentElement.scrollWidth>innerWidth+1,pages:document.querySelectorAll('details.pg').length,faq:document.querySelectorAll('#faq-list details').length}));
  await g.screenshot({path:`${OUT}/${bn}-${v.n}-guide.png`});await g.close();
  out[bn][v.n]=r;await ctx.close();}
 await br.close();}
// summary
const fails=[];for(const [bn,o] of Object.entries(out))for(const [vn,r] of Object.entries(o)){if(vn==='version')continue;
 const c={errs:!r.errs.length,pages:r.pages===251,bad:!r.bad.length,overflow:!r.overflow.length,words:!r.wordSplits.length,tips:r.tipsChecked>0&&!r.tipProblems.length,helpEdge:r.helpOpenAtEdge,esc:r.escCloses,reopen:r.reopenOK,swipe:r.swipeOrDragTurns,quick:r.quickOK,turn:r.turnAnimates&&r.turnCleans,guide:r.guide.open&&!r.guide.ov&&r.guide.pages===33&&r.guideLinks>=2};
 const f=Object.keys(c).filter(k=>!c[k]);if(f.length)fails.push(bn+'/'+vn+': '+f.join(',')+' '+JSON.stringify({errs:r.errs.slice(0,2),tip:r.tipProblems,ov:r.overflow,ws:r.wordSplits,touch:r.touchApi}));}
console.log(JSON.stringify({versions:Object.fromEntries(Object.entries(out).map(([k,v])=>[k,v.version])),combos:Object.values(out).reduce((a,o)=>a+Object.keys(o).length-1,0),tipsChecked:Object.values(out).flatMap(o=>Object.values(o)).reduce((a,r)=>a+(r.tipsChecked||0),0),fails},null,1));
process.exit(fails.length?1:0);})().catch(e=>{console.error(e);process.exit(1);});
