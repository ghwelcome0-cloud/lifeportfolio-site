'use strict';
// A6.3 (contract c25fff3a) mobile readability gate: real report.html / program.html rendered offline at 390px
// (tools/report-quality/render.cjs, synthetic answers, KO+EN). Body text block = leaf element with >=20 chars.
// Pass: >=16px share >= 0.95 per document AND zero body blocks < 12px AND zero horizontal-overflow pages.
const cp=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'..');
const out=fs.mkdtempSync(path.join(os.tmpdir(),'a63-'));
cp.execFileSync(process.execPath,['tools/report-quality/render.cjs',out,'--lang','ko,en','--widths','390'],{cwd:root,stdio:'pipe',timeout:280000});
let fail=0;const rows=[];
for(const f of ['report-ko-390','program-ko-390','report-en-390','program-en-390']){
  const j=JSON.parse(fs.readFileSync(path.join(out,f+'.json'),'utf8'));let B=0,G=0,L=0,ov=0;const small=[];
  for(const p of j.pages){if(p.overflow)ov++;if(!p.a63)continue;B+=p.a63.blocks;G+=p.a63.ge16;L+=p.a63.lt12;for(const s of p.a63.small||[])small.push(s);}
  const share=B?G/B:0;const ok=share>=0.95&&L===0&&ov===0;if(!ok)fail++;
  rows.push({doc:f,blocks:B,ge16:G,share:+share.toFixed(3),lt12:L,overflowPages:ov,ok,remaining:small.slice(0,8)});
  console.log((ok?'PASS ':'FAIL ')+f+' ge16 '+(share*100).toFixed(0)+'% lt12 '+L+' overflow '+ov+(ok?'':' '+JSON.stringify(small.slice(0,8))));
}
fs.mkdirSync(path.join(root,'dist/b2b-audit'),{recursive:true});
fs.writeFileSync(path.join(root,'dist/b2b-audit/a63-mobile-readability.json'),JSON.stringify({rule:'>=16px share >= 0.95, <12px == 0, overflow == 0 at 390px',rows},null,1));
if(fail){console.log('FAIL test-a63-mobile-readability');process.exit(1);}console.log('PASS test-a63-mobile-readability 4');
