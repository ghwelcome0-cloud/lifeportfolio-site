// Line-breaking check: every page at 375/768/1280 — no Korean word (어절) split across lines,
// meaning units (.mu) never split, no overflow. Uses Range rects per character boundary.
const path=require('node:path');const puppeteer=require(path.resolve(__dirname,'../../node_modules/puppeteer'));
const base=process.env.BASE||'http://127.0.0.1:3300',SID='s_1791440430847_preview';
(async()=>{const b=await puppeteer.launch({headless:true,...(process.env.LP_BROWSER_PATH?{executablePath:process.env.LP_BROWSER_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});const out={};
for(const [w,h] of [[375,780],[768,1024],[1280,800]]){const p=await b.newPage();await p.setViewport({width:w,height:h});const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(base+'/diary.html?sid='+SID,{waitUntil:'networkidle0'});await p.waitForSelector('#dy-app:not([hidden])');await p.evaluate(()=>document.fonts.ready);await p.evaluate(()=>{document.body.classList.add('no-motion');DiaryApp.go('cover')});
 const r={wordSplits:[],unitSplits:[],units:0,overflow:[]};let steps=0;
 for(;steps<300;steps++){
  const res=await p.evaluate(()=>{const ws=[],us=[];let units=0;const book=document.getElementById('dy-book');
   // each text node: find line changes, check they happen only at whitespace
   const tw=document.createTreeWalker(book,4,{acceptNode:n=>{const e=n.parentElement;if(!e||e.closest('textarea,input,select,option,[aria-hidden=true],.tip-pop,.sr-only'))return 2;if(!e.getClientRects().length)return 2;return /[\uac00-\ud7a3]/.test(n.nodeValue)?1:2;}});
   let n;while((n=tw.nextNode())){const t=n.nodeValue;let prevTop=null;const rg=document.createRange();
    for(let i=0;i<t.length;i++){if(/\s/.test(t[i]))continue;rg.setStart(n,i);rg.setEnd(n,i+1);const rc=rg.getClientRects()[0];if(!rc||!rc.width)continue;
     if(prevTop!==null&&rc.top>prevTop+4){const prev=t[i-1];if(prev&&!/[\s\u00a0·→—–\-\/,.)(:]/.test(prev)&&/[\uac00-\ud7a3]/.test(t[i])&&/[\uac00-\ud7a3]/.test(prev)){const k=n.parentElement.closest('.dy-page')?.dataset.key;ws.push(k+': …'+t.slice(Math.max(0,i-6),i)+'|'+t.slice(i,i+6)+'…');}}
     prevTop=rc.top;}}
   document.querySelectorAll('#dy-book .mu').forEach(m=>{units++;if(m.getClientRects().length>1)us.push(m.closest('.dy-page')?.dataset.key+': '+m.textContent);});
   const ov=[...document.querySelectorAll('.dy-page .pg')].some(pg=>pg.scrollWidth>pg.clientWidth+1)||document.documentElement.scrollWidth>innerWidth+1;
   return {ws,us,units,ov,end:document.getElementById('nav-next').disabled,key:document.querySelector('.dy-page[data-key]')?.dataset.key};});
  r.wordSplits.push(...res.ws);r.unitSplits.push(...res.us);r.units+=res.units;if(res.ov)r.overflow.push(res.key);if(res.end)break;
  await p.keyboard.press('ArrowRight');await new Promise(r=>setTimeout(r,15));}
 r.steps=steps+1;r.wordSplitCount=r.wordSplits.length;r.wordSplits=r.wordSplits.slice(0,8);r.unitSplits=r.unitSplits.slice(0,8);r.errs=errs;out[w]=r;await p.close();}
console.log(JSON.stringify(out,null,1));await b.close();})().catch(e=>{console.error(e);process.exit(1);});
