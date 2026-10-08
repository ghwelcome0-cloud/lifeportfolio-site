'use strict';
// Every page that loads a11y-core.css: old vs new CSS must give identical box layout
// for every visible element; only landmarks with [hidden] may change (to display:none).
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),puppeteer=require('puppeteer');
const oldCss=execFileSync('git',['show','ac1c9d6:assets/css/a11y-core.css'],{cwd:root,encoding:'utf8'}),newCss=fs.readFileSync(path.join(root,'assets/css/a11y-core.css'),'utf8');
const pages=execFileSync('git',['grep','-l','a11y-core.css','--','*.html'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(f=>!f.startsWith('dist/'));
(async()=>{const b=await puppeteer.launch({headless:true,...(process.env.LP_BROWSER_PATH?{executablePath:process.env.LP_BROWSER_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});let checked=0,fixed=[];
try{for(const file of pages)for(const width of [375,1280]){
 const snap=async css=>{const p=await b.newPage();await p.setViewport({width,height:900});await p.setJavaScriptEnabled(false);await p.setRequestInterception(true);
  p.on('request',r=>{const u=new URL(r.url());if(u.hostname!=='site.invalid')return r.abort();const rel=decodeURIComponent(u.pathname).replace(/^\//,'');
   if(r.isNavigationRequest())return r.respond({status:200,contentType:'text/html',body:fs.readFileSync(path.join(root,file))});
   if(rel==='assets/css/a11y-core.css')return r.respond({status:200,contentType:'text/css',body:css});
   const f=path.join(root,rel);if(rel.endsWith('.css')&&fs.existsSync(f))return r.respond({status:200,contentType:'text/css',body:fs.readFileSync(f)});return r.abort();});
  await p.goto('https://site.invalid/'+file,{waitUntil:'load'});
  const out=await p.evaluate(()=>Array.from(document.querySelectorAll('body *')).map((e,i)=>{const r=e.getBoundingClientRect(),cs=getComputedStyle(e);return [i,e.tagName,e.id,cs.display,Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height),e.closest('[hidden]')?1:0,e.matches('main,header,nav,footer,section,article,aside')&&e.hidden?1:0,e.querySelector('main[hidden],header[hidden],nav[hidden],footer[hidden],section[hidden],article[hidden],aside[hidden]')?1:0];}));
  await p.close();return out;};
 const a=await snap(oldCss),c=await snap(newCss);assert.equal(a.length,c.length);
 // Only allowed difference: a [hidden] landmark goes from visible to display:none (and its subtree stops rendering).
 // Everything outside such a landmark must keep the exact same box.
 // Only allowed difference: a [hidden] landmark that was wrongly visible becomes display:none.
 // Then elements below it may move up and its ancestors may get shorter; nothing else may change.
 let fixedHere=false;
 for(let i=0;i<a.length;i++)if(c[i][9]&&c[i][3]!==a[i][3]){assert.equal(c[i][3],'none',file+' '+c[i][2]);fixedHere=true;fixed.push(file+'@'+width+':'+c[i][2]);}
 for(let i=0;i<a.length;i++){
  if(c[i][8])continue;
  const keep=v=>fixedHere?(v[10]?[v[1],v[2],v[3],v[4],v[6]]:[v[1],v[2],v[3],v[4],v[6],v[7]]):v;
  assert.deepEqual(keep(c[i]),keep(a[i]),file+'@'+width+' changed: '+c[i][1]+'#'+c[i][2]+' '+JSON.stringify([a[i],c[i]]));
 }
 checked++;}}finally{await b.close();}
 console.log('PASS a11y hidden landmarks: '+checked+' page×width checks; newly hidden (was wrongly visible): '+JSON.stringify(fixed));
})().catch(e=>{console.error(e);process.exit(1);});
