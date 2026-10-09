'use strict';
// Report-quality offline renderer: real report.html / program.html with a synthetic
// report+program, no network, no Firebase writes. Captures every Living Book page
// at mobile(375) and PC(1280) for KO and EN and extracts text per page for axis review.
// Usage: node tools/report-quality/render.cjs [outDir] [--seed N] [--lang ko,en] [--widths 375,1280]
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..','..'),puppeteer=require('puppeteer');
const argv=process.argv.slice(2);const opt=(k,d)=>{const i=argv.indexOf(k);return i>=0?argv[i+1]:d;};
const outDir=path.resolve(argv.find(a=>!a.startsWith('--')&&!/^\d+$/.test(a)&&!['ko,en','ko','en'].includes(a))||'tools/report-quality/out');
const seed=Number(opt('--seed','0')),langs=opt('--lang','ko,en').split(','),widths=opt('--widths','375,1280').split(',').map(Number);
const T=require('../../scripts/test-response-evidence.cjs'),R=require('../../assets/js/response-evidence.js'),P=require('../../assets/js/program-engine.js');
const questions=require('../../data/questions.json');
fs.mkdirSync(outDir,{recursive:true});

function synth(lang){
  const a=T.base(seed);a.Q1=lang==='en'?'Synthetic Reader':'합성 독자';
  const C=require('../../assets/js/axis-compose.js'),lexicon=require('../../data/axis-lexicon.json');
  const report=R.attachAxes(T.build(a,lang,'input-v2').r,questions,a,process.env.RQ_NO_COMPOSE?undefined:{compose:{engine:C,lexicon}});
  report.lang=lang;report.profile=Object.assign({},report.profile,{name:a.Q1,email:'synthetic@example.invalid'});
  let program=null;try{program=P.build({report,rules:require('../../data/program-rules.json'),name:a.Q1,lang,axisProgram:true,cardShape:'rq-01'});}catch(e){program={_error:e.message};}
  return {report,program};
}
function boot(payloadByPath,lang){
  return `<script>
window.__writes=[];const __DATA=${JSON.stringify(payloadByPath)};
try{localStorage.setItem('lp_lang',${JSON.stringify(lang)});}catch(_){}
const user={uid:'synthetic',email:'synthetic@example.invalid',getIdToken:async()=> 'synthetic'};
const initializeApp=()=>({}),initializeAppCheck=()=>({}),ReCaptchaEnterpriseProvider=function(){},getAuth=()=>({currentUser:user}),getDatabase=()=>({}),getFunctions=()=>({}),httpsCallable=()=>async()=>({data:null});
const onAuthStateChanged=(_a,fn)=>{setTimeout(()=>fn(user),0);return ()=>{};};
const ref=(_d,p)=>p,serverTimestamp=()=>({'.sv':'timestamp'}),push=()=>({key:'k'});
const __lookup=p=>{for(const k of Object.keys(__DATA))if(p===k||p.startsWith(k+'/'))return __DATA[k];return null;};
const get=async p=>{const v=__lookup(p);return {exists:()=>v!=null,val:()=>v};};
const set=async(p,v)=>__writes.push(p),update=set;
</script>`;
}
function inject(source,bootHtml){
  return source.replace(/import\s+[\s\S]*?from\s+"https:\/\/www\.gstatic\.com\/firebasejs\/[^"\n]+";/g,'').replace('<script type="module">',bootHtml+'<script type="module">');
}
async function capture(browser,{file,html,width,lang,tag,payload}){
  const page=await browser.newPage();await page.setViewport({width,height:900,deviceScaleFactor:2});
  const errors=[],writes=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text().slice(0,200));});
  await page.setRequestInterception(true);
  page.on('request',async req=>{try{const u=new URL(req.url());
    if(u.hostname==='reader.invalid'){
      if(req.isNavigationRequest())return req.respond({status:200,contentType:'text/html',body:html});
      const rel=decodeURIComponent(u.pathname).replace(/^\//,''),f=path.resolve(root,rel);
      if(!f.startsWith(root+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile())return req.abort();
      return req.respond({status:200,contentType:rel.endsWith('.js')?'application/javascript':rel.endsWith('.json')?'application/json':rel.endsWith('.css')?'text/css':rel.endsWith('.svg')?'image/svg+xml':rel.endsWith('.png')?'image/png':'application/octet-stream',body:fs.readFileSync(f)});
    }
    if(u.hostname.endsWith('.firebasedatabase.app')){
      if(req.method()!=='GET'){writes.push(req.method()+' '+u.pathname);return req.abort();}
      const p=u.pathname.replace(/^\//,'').replace(/\.json$/,'');const v=Object.keys(payload).find(k=>p===k||p.startsWith(k+'/'));
      return req.respond({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(v?payload[v]:null)});
    }
    if(/fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|unpkg\.com/.test(u.hostname)){external.push(u.hostname);return req.respond({status:200,contentType:'text/css',body:''});}
    external.push(u.hostname);return req.abort();
  }catch(e){errors.push(e.message);if(!req.isInterceptResolutionHandled())await req.abort();}});
  await page.goto(`https://reader.invalid/${file}?sid=s_synthetic&lang=${lang}`,{waitUntil:'domcontentloaded'});
  let mode='livingbook';
  try{await page.waitForFunction(()=>document.querySelector('#lbFrame')?.contentDocument?.querySelectorAll('.page').length>0,{timeout:20000});}
  catch(e){mode='dashboard';await page.waitForSelector('#reportRoot section, main section, .page',{timeout:10000}).catch(()=>{});}
  await new Promise(r=>setTimeout(r,800));
  // Living Book shows one page at a time (.lb-active). Measure/capture each page while active.
  const total=mode==='livingbook'?await page.evaluate(()=>document.querySelector('#lbFrame').contentDocument.querySelectorAll('.page').length):0;
  const pages=[];const shots=[];
  const frameHandle=mode==='livingbook'?await page.$('#lbFrame'):null;const frame=frameHandle?await frameHandle.contentFrame():null;
  const measure=async(idx)=>frame.evaluate((idx)=>{const p=document.querySelectorAll('.page')[idx];const r=p.getBoundingClientRect();
      const heads=Array.from(p.querySelectorAll('h1,h2,h3')).map(h=>h.innerText.trim()).filter(Boolean).slice(0,6);
      const text=p.innerText.replace(/\s+\n/g,'\n').trim();
      const leaf=Array.from(p.querySelectorAll('*')).filter(el=>el.children.length===0&&(el.innerText||'').trim());
      const fonts=leaf.map(el=>parseFloat(getComputedStyle(el).fontSize));
      const smallFont=fonts.filter(f=>f<11).length;const minFont=fonts.length?Math.min(...fonts):null;const bodyLeaf=leaf.filter(el=>(el.innerText||'').trim().length>=20);const bodyFonts=bodyLeaf.map(el=>parseFloat(getComputedStyle(el).fontSize));const a63={blocks:bodyFonts.length,ge16:bodyFonts.filter(f=>f>=16).length,lt12:bodyFonts.filter(f=>f<12).length,hist:bodyFonts.reduce((h,f)=>{const k=Math.round(f*2)/2;h[k]=(h[k]||0)+1;return h;},{}),small:bodyLeaf.filter(el=>parseFloat(getComputedStyle(el).fontSize)<16).map(el=>el.tagName.toLowerCase()+(el.className&&typeof el.className==='string'?'.'+el.className.trim().split(/\s+/).join('.'):'')+'@'+getComputedStyle(el).fontSize).slice(0,40)};
      const ctas=Array.from(p.querySelectorAll('a,button')).map(b=>({t:(b.innerText||b.getAttribute('aria-label')||'').trim().slice(0,40),w:Math.round(b.getBoundingClientRect().width),h:Math.round(b.getBoundingClientRect().height)})).filter(c=>c.t);
      const clipped=Array.from(p.querySelectorAll('*')).filter(el=>{const cs=getComputedStyle(el);return cs.overflow==='hidden'&&el.scrollHeight>el.clientHeight+4&&el.clientHeight>0;}).length;
      return {i:idx,id:p.id||'',cls:p.className||'',w:Math.round(r.width),h:Math.round(r.height),overflow:p.scrollWidth>p.clientWidth+2,contentOverflow:p.scrollHeight>p.clientHeight+4,clippedBoxes:clipped,a63,heads,chars:text.length,words:text.split(/\s+/).length,smallFont,minFont,ctas,text};},idx);
  if(mode==='livingbook'){
    for(let i=0;i<total;i++){
      await frame.evaluate((i)=>{document.querySelectorAll('.page').forEach((p,k)=>p.classList.toggle('lb-active',k===i));window.scrollTo(0,0);},i);
      await new Promise(r=>setTimeout(r,150));
      pages.push(await measure(i));
      const fn=`${tag}-p${String(i+1).padStart(2,'0')}.png`;
      try{
        // Clip = iframe offset in top document + page rect inside iframe (element screenshots inside iframes are unreliable).
        const fb=await page.evaluate(()=>{const r=document.querySelector('#lbFrame').getBoundingClientRect();return {x:r.x,y:r.y};});
        const pr=await frame.evaluate((i)=>{const r=document.querySelectorAll('.page')[i].getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};},i);
        const vh=Math.max(900,Math.ceil(pr.y+pr.h+fb.y)+40);
        if(vh>900){await page.setViewport({width,height:Math.min(vh,6000),deviceScaleFactor:2});await new Promise(r=>setTimeout(r,200));}
        const fb2=await page.evaluate(()=>{const r=document.querySelector('#lbFrame').getBoundingClientRect();return {x:r.x,y:r.y};});
        const pr2=await frame.evaluate((i)=>{const r=document.querySelectorAll('.page')[i].getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};},i);
        await page.screenshot({path:path.join(outDir,fn),clip:{x:Math.max(0,fb2.x+pr2.x),y:Math.max(0,fb2.y+pr2.y),width:Math.max(1,pr2.w),height:Math.max(1,Math.min(pr2.h,5900))}});shots.push(fn);
        if(vh>900)await page.setViewport({width,height:900,deviceScaleFactor:1});
      }catch(e){errors.push('shot:'+e.message.slice(0,100));}
    }
  }
  const legacyPages=await page.evaluate((mode)=>{ if(mode==='livingbook')return [];
    const doc=mode==='livingbook'?document.querySelector('#lbFrame').contentDocument:document;
    const nodes=mode==='livingbook'?Array.from(doc.querySelectorAll('.page')):Array.from(doc.querySelectorAll('#reportRoot > section, main > section'));
    return nodes.map((p,i)=>{const r=p.getBoundingClientRect();
      const heads=Array.from(p.querySelectorAll('h1,h2,h3')).map(h=>h.innerText.trim()).filter(Boolean).slice(0,6);
      const text=p.innerText.replace(/\s+\n/g,'\n').trim();
      const smallFont=Array.from(p.querySelectorAll('*')).filter(el=>{const cs=getComputedStyle(el);return el.innerText&&el.children.length===0&&parseFloat(cs.fontSize)<11&&cs.display!=='none';}).length;
      const ctas=Array.from(p.querySelectorAll('a,button')).map(b=>({t:(b.innerText||b.getAttribute('aria-label')||'').trim().slice(0,40),w:Math.round(b.getBoundingClientRect().width),h:Math.round(b.getBoundingClientRect().height)})).filter(c=>c.t);
      return {i,id:p.id||'',cls:p.className||'',w:Math.round(r.width),h:Math.round(r.height),overflow:p.scrollWidth>p.clientWidth+2,heads,chars:text.length,words:text.split(/\s+/).length,smallFont,ctas,text};
    });
  },mode);
  if(mode!=='livingbook'){pages.push(...legacyPages);const fn=`${tag}-full.png`;await page.screenshot({path:path.join(outDir,fn),fullPage:true});shots.push(fn);}
  const bodyText=await page.evaluate(()=>document.body.innerText);
  await page.close();
  return {file,width,lang,mode,pageCount:pages.length,errors,writes,external:[...new Set(external)],writesInPage:0,pages:pages.map(p=>({...p,text:undefined})),texts:pages.map(p=>p.text),shots,bodyText};
}
(async()=>{
  const browser=await puppeteer.launch({headless:true,...(process.env.LP_BROWSER_PATH?{executablePath:process.env.LP_BROWSER_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
  const index=[];
  try{
    for(const lang of langs){
      const {report,program}=synth(lang);
      fs.writeFileSync(path.join(outDir,`synthetic-${lang}.json`),JSON.stringify({report,program},null,1));
      const payload={[`reports/synthetic/s_synthetic`]:{report,lang,pdfFilename:'synthetic.pdf'},[`programs/synthetic/s_synthetic`]:{program,lang},[`users/synthetic/reports/s_synthetic`]:{sid:'s_synthetic'},[`users/synthetic`]:{paid:true,lang}};
      for(const file of ['report.html','program.html']){
        const source=fs.readFileSync(path.join(root,file),'utf8');const html=inject(source,boot(payload,lang));
        for(const width of widths){
          const tag=`${file.replace('.html','')}-${lang}-${width}`;
          const r=await capture(browser,{file,html,width,lang,tag,payload});
          fs.writeFileSync(path.join(outDir,`${tag}.json`),JSON.stringify(r,null,1));
          index.push({tag,file,lang,width,mode:r.mode,pages:r.pageCount,errors:r.errors.length,writes:r.writes.length,overflowPages:r.pages.filter(p=>p.overflow).length,shots:r.shots.length});
          console.log(`${tag}: mode=${r.mode} pages=${r.pageCount} errors=${r.errors.length} writes=${r.writes.length} overflow=${r.pages.filter(p=>p.overflow).length}`);
          if(r.errors.length)console.log('  errors:',r.errors.slice(0,5).join(' | '));
        }
      }
    }
  }finally{await browser.close();}
  fs.writeFileSync(path.join(outDir,'index.json'),JSON.stringify({seed,generatedAt:new Date().toISOString(),runs:index},null,1));
})().catch(e=>{console.error(e);process.exit(1);});
