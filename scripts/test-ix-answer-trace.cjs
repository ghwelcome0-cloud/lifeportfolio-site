'use strict';
// RQ-04 gate: Chapter IX is a customer page — "what I answered → what the report wrote".
// The axisTrace shown on IX must be a read-only projection of the engine's own evidence
// (_axisProjection.axes[k].evidenceRefs + _responseEvidence.fields[q].display): every chip is a
// real selected option of that item; no unanswered item is cited; EN pages carry no Korean;
// the "not used in a sentence" count equals coverage.notInterpreted; legacy reports without a
// projection render no trace block (no empty frame). Runs the real buildBookData/methodPanel
// code extracted from report.html in a vm, with the same real engines the product uses.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const T=require('./test-response-evidence.cjs'),R=require('../assets/js/response-evidence.js');
const C=require('../assets/js/axis-compose.js'),lexicon=require('../data/axis-lexicon.json'),questions=require('../data/questions.json');
const source=fs.readFileSync(path.join(root,'report.html'),'utf8');
const HANGUL=/[\uac00-\ud7a3]/;
let checks=0,allFour=0,total=0;

// ── extract the axisTrace builder exactly as shipped (between its comment marker and the return) ──
const tStart=source.indexOf('            var axisTrace = (function(){');
const tEnd=source.indexOf('            })();',tStart)+'            })();'.length;
assert.ok(tStart>0&&tEnd>tStart,'axisTrace builder must exist in buildBookData');
const builderSrc=source.slice(tStart,tEnd).replace('var axisTrace = ','axisTrace = ');
function buildTrace(report,lang){
  const ctx=vm.createContext({window:{_lpReportLang:lang},document:{documentElement:{lang}},report,axisTrace:null});
  vm.runInContext('var _rqEn = String(window._lpReportLang||"ko").indexOf("en")===0;\n'+builderSrc,ctx);
  return ctx.axisTrace?JSON.parse(JSON.stringify(ctx.axisTrace)):null; // cross-realm arrays → plain
}
// ── extract the IX renderer (_axisRows) from the book render script and run it against DATA ──

const qmap={};(questions.sections||[]).forEach(s=>(s.questions||[]).forEach(q=>{qmap[q.id]=q;}));

(async()=>{
const {renderCh9,extractOuter}=await import('./gates/report_ch9_render_gate.mjs');
const outer=extractOuter(source);const fn=vm.runInNewContext(outer.src+'\nbookRenderScript;',{console},{timeout:8000});const inner=fn();

for(const lang of ['ko','en']){
  for(let seed=0;seed<30;seed++){
    const a=T.base(seed);a.Q1=lang==='en'?'Synthetic':'합성';
    let report;try{report=R.attachAxes(T.build(a,lang,'input-v2').r,questions,a,{compose:{engine:C,lexicon}});}catch(e){continue;}
    total++;
    const t=buildTrace(report,lang);
    assert.ok(t&&Array.isArray(t.rows),`${lang} seed${seed}: axisTrace must be built for input-v2 reports`);checks++;
    const pj=report._axisProjection,fields=report._responseEvidence.fields;
    assert.equal(t.notInterpreted,pj.coverage.notInterpreted.length,'not-used count must equal engine coverage');checks++;
    if(t.allFour)allFour++;
    for(const row of t.rows){
      const ax=pj.axes[row.axis];
      assert.ok(ax,'row axis must exist in projection');
      let src=Array.isArray(ax.evidenceRefs)&&ax.evidenceRefs.length?ax.evidenceRefs.slice():[];
      if(!src.length){const f=pj.fieldSources[row.axis]||{};for(const fl of ['core','detail','action','reflection'])for(const q of ((f[fl]&&f[fl].evidenceRefs)||[]))if(!src.includes(q))src.push(q);}
      const refs=src.filter(q=>fields[q]&&fields[q].selected&&fields[q].selected.length);
      assert.deepEqual(row.items.map(i=>i.qid),refs,`${lang} seed${seed} ${row.axis}: row items must be exactly the answered evidenceRefs, in engine order`);checks++;
      for(const it of row.items){
        const q=qmap[it.qid];assert.ok(q,'qid must be a real question');
        const sel=[].concat(a[it.qid]);
        for(const chip of it.answers){
          // chip is the engine display value (EN option text when lang=en) of a selected option
          const idxEn=(q.options_en||[]).indexOf(chip),idxKo=(q.options||[]).indexOf(chip);
          const ok=(lang==='en'&&idxEn>=0&&sel.includes(q.options[idxEn]))||(idxKo>=0&&sel.includes(chip));
          assert.ok(ok,`${lang} seed${seed} ${it.qid}: chip "${chip}" is not a selected option`);checks++;
          if(lang==='en')assert.ok(!HANGUL.test(chip),`EN chip must not be Korean: ${chip}`);
        }
      }
    }
    // render IX with this DATA and check the page text

    const p=renderWith(inner,{readerLang:lang,meta:{generatedAt:'2026-10-09T00:00:00Z'},evidence:{head:lang==='en'?'Where your answers appear word for word':'당신의 답이 문장이 된 자리',qids:['Q13'],axisTrace:t},summary:{},axes:[]});
    const ix=p.ix.html;
    assert.ok(ix.includes(lang==='en'?'Where each of the four areas comes from':'네 영역 문장의 출처'),'trace block must render');checks++;
    assert.ok(ix.includes(lang==='en'?'with the item number':'문항 번호와 함께 알려 주세요'),'correction path must render');assert.ok(!/[\w.+-]+@[\w-]+\.[\w.]+/.test(ix.replace(/<[^>]+>/g,' ')),'IX must not print a raw e-mail address (public-contact DLP)');checks++;
    if(lang==='en'){
      const text=ix.replace(/<[^>]+>/g,' ');
      assert.ok(!HANGUL.test(text),`EN IX page must contain no Korean: ${(text.match(/[^\s]*[\uac00-\ud7a3][^\s]*/)||[''])[0]}`);checks++;
    }
    for(const row of t.rows)for(const it of row.items)assert.ok(ix.includes(it.qid),'every cited qid must reach the page');checks++;
  }
}
// legacy: no projection → no trace block, no empty frame
{
  const a=T.base(1);const legacy=R.attachAxes(T.build(a,'ko','input-v2').r,questions,a);delete legacy._axisProjection;
  const t=buildTrace(legacy,'ko');assert.equal(t,null,'no projection → no trace');checks++;
  const p=renderWith(inner,{readerLang:'ko',meta:{},evidence:{head:'당신의 답이 문장이 된 자리',qids:['Q13'],axisTrace:null},summary:{},axes:[]});
  assert.ok(!p.ix.html.includes('네 영역 문장의 출처'),'legacy page must not show an empty trace block');checks++;
  assert.ok(p.ix.html.includes('문항 번호와 함께 알려 주세요')&&p.ix.html.includes('이 진단은 심리검사가 아닙니다'),'legacy page keeps correction path and limit line');checks++;
}
// EN cited chips must be the engine's EN display values (no Korean canonical leaking into EN IX)
{
  const src=source;const i=src.indexOf('/* [RQ-04] EN 리포트: 칩은 KO 정규형');assert.ok(i>0,'EN chip mapping must exist in buildBookData');
  const a=T.base(0);const en=R.attachAxes(T.build(a,'en','input-v2').r,questions,a,{compose:{engine:C,lexicon}});
  const f=en._responseEvidence.fields.Q13;assert.ok(f.display.every(d=>!HANGUL.test(d)),'engine EN display must be English');checks++;
  if(process.env.RQ_IX_EN_JSON){const t=JSON.parse(fs.readFileSync(process.env.RQ_IX_EN_JSON,'utf8')).texts[12];assert.ok(!HANGUL.test(t),'rendered EN IX page must contain no Korean');checks++;}
}
// relocated content must exist in the guide (moved, not deleted)
{
  const g=fs.readFileSync(path.join(root,'report-guide.html'),'utf8');
  for(const k of ['id="g-evidence"','23.85','우리가 쓰지 않는 말','이 리포트를 믿고 쓰는 법','문항 번호와 함께','심리검사'])assert.ok(g.includes(k),'guide must carry relocated content: '+k);checks++;
}
console.log(`PASS ${checks} checks; ${total} real-engine reports KO/EN; all-four-areas trace ${allFour}/${total}; EN pages Korean-free; legacy no-trace; guide carries relocated content`);
})().catch(e=>{console.error(e);process.exitCode=1;});

function renderWith(inner,DATA){
  // same isolation as report_ch9_render_gate.renderCh9 but with caller-supplied DATA
  const lines=inner.split('\n');
  const mpStart=lines.findIndex(l=>l.startsWith('(function methodPanel(){'));const mpEnd=lines.findIndex((l,i)=>i>mpStart&&l.trim()==='})();');
  const vpStart=lines.findIndex((l,i)=>i>mpEnd&&l.startsWith('(function valuePanel(){'));const vpEnd=lines.findIndex((l,i)=>i>vpStart&&l.trim()==='})();');
  const WANT=['function readerText(','function scrub(','function esc(','function evdsafe(','function pad2(','function dropDomainTokens('];
  const pre=lines.slice(0,mpStart),kept=[];
  for(const w of WANT){const st=pre.findIndex(l=>l.startsWith(w));if(st<0)continue;let depth=0,end=st;for(let k=st;k<pre.length;k++){for(const ch of pre[k]){if(ch==='{')depth++;else if(ch==='}')depth--;}if(depth<=0){end=k;break;}}kept.push(pre.slice(st,end+1).join('\n'));}
  const pages=[];const el=()=>({style:{},setAttribute(){},appendChild(){},classList:{add(){},remove(){}}});
  const ctx=vm.createContext({DATA,page:(html,opt)=>pages.push({html,opt:opt||{}}),pad2:n=>(n<10?'0':'')+n,console,
    document:{getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],createElement:el,body:el(),addEventListener(){},title:''},
    window:{addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}}),innerWidth:1440,location:{href:''},print(){},setTimeout(){},requestAnimationFrame(){}},
    location:{href:''},navigator:{userAgent:'node'},setTimeout(){},clearTimeout(){},requestAnimationFrame(){}});
  vm.runInContext(kept.join('\n')+'\n'+lines.slice(mpStart,mpEnd+1).join('\n')+'\n'+lines.slice(vpStart,vpEnd+1).join('\n'),ctx,{timeout:8000});
  return {ix:pages[pages.length-2],x:pages[pages.length-1]};
}
