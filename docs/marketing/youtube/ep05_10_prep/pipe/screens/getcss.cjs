const fs=require('fs');
function grab(file,startRe){const L=fs.readFileSync(file,'utf8').split('\n');let s=L.findIndex(l=>startRe.test(l));let depth=0,out=[];for(let i=s;i<L.length;i++){out.push(L[i]);for(const ch of L[i]){if(ch==='{')depth++;if(ch==='}')depth--;}if(depth===0&&i>s)break;}return out.join('\n');}
const f1=grab('/home/user/main-wt/report.html',/function buildBookCSS\(theme\)\{/);
let css1;try{css1=eval('('+f1+')')('screen');}catch(e){console.error('report err',e.message);}
fs.writeFileSync('report_book.css',css1||'');
const P=fs.readFileSync('/home/user/main-wt/program.html','utf8');
const m=[...P.matchAll(/function (build\w*CSS)\(/g)].map(x=>x[1]);console.log('program css fns',m, 'report css', (css1||'').length);
const f2=grab('/home/user/main-wt/program.html',/function buildBookCSS\(/);
let css2;try{css2=eval('('+f2+')')('screen');}catch(e){console.error('prog err',e.message);}
fs.writeFileSync('program_book.css',css2||'');console.log('prog css',(css2||'').length);
