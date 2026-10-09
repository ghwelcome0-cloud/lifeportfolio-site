const R=require('./out/results.json');
const lvl=r=>r>=1?5:r>=0.75?4:r>=0.5?3:r>=0.25?2:1;
const rows=[];
for(const r of R){
 if(r.skip){rows.push({row:r.row,name:r.name,group:r.group,own:true});continue;}
 const h=r.headers,m=r.mobile,o={row:r.row,name:r.name,group:r.group,url:r.url,at:r.measuredAt};
 if(m.ok&&m.status<400&&m.text.blocks>0){
  const wide=m.docW>391||m.innerW>391; const a61pass=m.viewportMeta&&!m.zoomBlocked&&!m.overflow&&!wide; o.a61={pass:a61pass,level:a61pass?5:1,vp:m.viewportMeta,zoomBlocked:m.zoomBlocked,overflow:m.overflow||wide,docW:m.docW,innerW:m.innerW};
  const r63=m.text.ge16/m.text.blocks; let l63=lvl(r63); if(m.text.lt12>0) l63=Math.min(l63,3); o.a63={ratio:r63,level:l63,ge16:m.text.ge16,blocks:m.text.blocks,lt12:m.text.lt12};
  const r64=m.touch.total?m.touch.ok44/m.touch.total:null; o.a64=r64===null?null:{ratio:r64,level:lvl(r64),ok44:m.touch.ok44,ok24:m.touch.ok24,total:m.touch.total,ratio24:m.touch.ok24/m.touch.total};
  const parts=[[25,o.a61.level],[20,o.a63.level],...(o.a64?[[15,o.a64.level]]:[])]; const W=parts.reduce((s,p)=>s+p[0],0); o.a6partial={points:+(15*parts.reduce((s,p)=>s+p[0]*p[1]/5,0)/100).toFixed(2),max:+(15*W/100).toFixed(2),W};
 } else o.a6err=m.error||('status '+m.status+' / blocks '+(m.text&&m.text.blocks));
 if(h.ok){const ctrls=[h.hsts,h.xcto,h.frame,h.referrer,h.permissions]; const n=ctrls.filter(Boolean).length;
  o.a71={https:h.https,controls:n,hsts:h.hsts,xcto:h.xcto,frame:h.frame,referrer:h.referrer,permissions:h.permissions,level:!h.https?1:n===5?3:n>=1?2:1};
  o.a76={csp:h.csp,reporting:h.cspReporting,level:h.cspReporting?2:1};
  o.a75probe={exposed:(r.publicSurface||[]).filter(p=>p.exposed).map(p=>p.path),tested:(r.publicSurface||[]).length};
 } else o.a7err=h.error;
 o.a58=r.d3==='예'?2:null; o.a59=r.d4==='예'?2:(r.d4==='해당없음'?'비적용':null);
 rows.push(o);
}
require('fs').writeFileSync('out/scored.json',JSON.stringify(rows,null,1));
for(const o of rows){ if(o.own){console.log(o.row,'OWN');continue;}
 console.log(o.row.padEnd(5),o.a6err?('A6 ERR '+o.a6err):`A6.1 L${o.a61.level} A6.3 L${o.a63.level}(${(o.a63.ratio*100).toFixed(0)}%,lt12 ${o.a63.lt12}) A6.4 ${o.a64?'L'+o.a64.level+'('+(o.a64.ratio*100).toFixed(0)+'%)':'-'} part ${o.a6partial.points}/${o.a6partial.max}`,'|',o.a7err?'A7 ERR':`A7.1 L${o.a71.level}(${o.a71.controls}/5) A7.6 L${o.a76.level} probe ${o.a75probe.exposed.length}/${o.a75probe.tested}`,'| A5.8',o.a58,'A5.9',o.a59);}
