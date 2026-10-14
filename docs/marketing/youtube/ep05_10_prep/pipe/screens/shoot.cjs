const {chromium}=require('/var/tmp/pw2/node_modules/playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const out={};
for(const [n,sel,vw,dsf] of [['report-xi-b','.page',900,1440/794],['program-quest-b','.page',900,1440/794],['diary-q4-b','.wrap',400,3.6],['diary-q12-b','.wrap',400,3.6]]){
 const p=await b.newPage({viewport:{width:vw,height:1200},deviceScaleFactor:dsf});await p.goto('file://'+__dirname+'/'+n+'.html');await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(300);
 const el=await p.$(sel);const bb=await el.boundingBox();
 // boxes of key elements in 720-space
 const k=720/bb.width;out[n]=await p.evaluate(([s,k,x0,y0])=>{const r={};const q=(c)=>[...document.querySelectorAll(c)].map(e=>{const b=e.getBoundingClientRect();return [Math.round((b.x-x0)*k),Math.round((b.y-y0)*k),Math.round(b.width*k),Math.round(b.height*k)]});
  for(const c of ['.ap-type','.ap-sent','.ap-tr','.ap-oth','.aq-lead','.aq-ph','.aq-wk','.aq-foot','.aq-card','.aq-fill','.aq-row','.aq-cardbox','.sec-title'])r[c]=q(c);r.H=Math.round(document.querySelector(s).getBoundingClientRect().height*k);return r},[sel,k,bb.x,bb.y]);
 await el.screenshot({path:n+'.png'});}
fs.writeFileSync('boxes.json',JSON.stringify(out));console.log(JSON.stringify(Object.fromEntries(Object.entries(out).map(([k,v])=>[k,v.H]))));await b.close();})();
