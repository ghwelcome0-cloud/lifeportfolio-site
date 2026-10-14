const fs=require('fs');const L=fs.readFileSync('/home/user/main-wt/report.html','utf8').split('\n');
const src=L.slice(5637,6343).join('\n');
const f=new Function(src+'\nreturn buildBookCSS;')();
fs.writeFileSync('book_screen.css',f('screen'));
// program.html aq-* rules
const P=fs.readFileSync('/home/user/main-wt/program.html','utf8').split('\n');
const aq=P.filter(l=>/^\s*'\.aq-|^\s*'@media screen and \(max-width:768px\)\{\.aq/.test(l)).map(l=>{try{return eval(l.trim().replace(/,\s*(\/\/.*)?$/,''))}catch(e){return ''}}).join('');
fs.writeFileSync('aq.css',aq);console.log(fs.statSync('book_screen.css').size,aq.length);
