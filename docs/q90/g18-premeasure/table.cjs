const S=require('./out/scored.json');const R=require('./out/results.json');
const fmt=n=>n==null?'—':(typeof n==='number'?n.toFixed(2):n);
const pct=x=>(x*100).toFixed(0)+'%';
let md='';
md+='| 행 | 대상 | A6.1 모바일 적합 (390px) | A6.3 본문 가독성 | A6.4 터치 타깃 | A6 부분합 (3/6지표, 배점 9) | A7.1 전송·헤더 | A7.6 CSP 보고 | A7.5 비공개 경로 탐침 | A5.8 | A5.9 |\n|---|---|---|---|---|---|---|---|---|---|---|\n';
for(const o of S){
 if(o.own){md+=`| **${o.row}** | **${o.name}** | **\`__\`** | **\`__\`** | **\`__\`** | **\`__\` / 9** | **\`__\`** | **\`__\`** | **\`__\`** | **\`__\`** | **\`__\`** |\n`;continue;}
 const a61=o.a6err?`미측정(${o.a6err.includes('403')?'봇 차단 403':o.a6err.includes('timeout')?'응답 없음(60s)':o.a6err})`:`L${o.a61.level} · ${o.a61.pass?'충족':'미충족'}(${[!o.a61.vp?'viewport 없음':'',o.a61.zoomBlocked?'확대 차단':'',o.a61.overflow?`가로 ${o.a61.docW}px`:''].filter(Boolean).join('·')||'viewport·확대·폭 모두 OK'})`;
 const a63=o.a6err?'미측정':`L${o.a63.level} · ≥16px ${pct(o.a63.ratio)} (${o.a63.ge16}/${o.a63.blocks})${o.a63.lt12?` · <12px ${o.a63.lt12}개`:''}`;
 const a64=o.a6err?'미측정':(o.a64?`L${o.a64.level} · ≥44px ${pct(o.a64.ratio)} (${o.a64.ok44}/${o.a64.total}) · ≥24px ${pct(o.a64.ratio24)}`:'대상 0');
 const a6p=o.a6err?'산출 안 함':`${fmt(o.a6partial.points)} / ${fmt(o.a6partial.max)}`;
 const a71=o.a7err?'미측정':`L${o.a71.https?2:1} · HTTPS ${o.a71.https?'O':'X'} · 헤더 ${o.a71.controls}/5 (${[o.a71.hsts?'HSTS':'',o.a71.xcto?'XCTO':'',o.a71.frame?'Frame':'',o.a71.referrer?'Referrer':'',o.a71.permissions?'Permissions':''].filter(Boolean).join(',')||'없음'})`;
 const a76=o.a7err?'미측정':`L${o.a76.level} · CSP ${o.a76.csp?'O':'X'} · 보고 ${o.a76.reporting?'O':'X'}`;
 const a75=o.a7err?'미측정':(o.a75probe.exposed.length?`관측: ${o.a75probe.exposed.join(',')} 응답 (6경로 중 ${o.a75probe.exposed.length})`:`6경로 노출 0`);
 const a58=o.a58?`L${o.a58} [기존증거 D3]`:'미측정';
 const a59=o.a59==='비적용'?'비적용(검사 아님)':o.a59?`L${o.a59} [기존증거 D4]`:'미측정';
 md+=`| ${o.row} | ${o.name} | ${a61} | ${a63} | ${a64} | ${a6p} | ${a71} | ${a76} | ${a75} | ${a58} | ${a59} |\n`;
}
require('fs').writeFileSync('out/table.md',md);
// aggregates
const ok=S.filter(o=>!o.own&&!o.a6err);
const agg={n:ok.length,a61pass:ok.filter(o=>o.a61.pass).length,zoomBlocked:ok.filter(o=>o.a61.zoomBlocked).length,wide:ok.filter(o=>o.a61.overflow).length,
 a63ge75:ok.filter(o=>o.a63.ratio>=0.75).length,lt12any:ok.filter(o=>o.a63.lt12>0).length,a64ge50:ok.filter(o=>o.a64&&o.a64.ratio>=0.5).length,a64lt25:ok.filter(o=>o.a64&&o.a64.ratio<0.25).length,
 a6median:[...ok.map(o=>o.a6partial.points)].sort((a,b)=>a-b)[Math.floor(ok.length/2)],a6max:Math.max(...ok.map(o=>o.a6partial.points)),a6min:Math.min(...ok.map(o=>o.a6partial.points))};
const h=S.filter(o=>!o.own&&!o.a7err);
agg.hN=h.length;agg.hsts=h.filter(o=>o.a71.hsts).length;agg.xcto=h.filter(o=>o.a71.xcto).length;agg.frame=h.filter(o=>o.a71.frame).length;agg.ref=h.filter(o=>o.a71.referrer).length;agg.perm=h.filter(o=>o.a71.permissions).length;agg.csp=h.filter(o=>o.a76.csp).length;agg.cspRpt=h.filter(o=>o.a76.reporting).length;agg.h5=h.filter(o=>o.a71.controls===5).length;agg.h0=h.filter(o=>o.a71.controls===0).length;
console.log(JSON.stringify(agg));
