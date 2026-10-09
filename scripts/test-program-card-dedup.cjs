'use strict';
// RQ-01 gate: an execution-program card is one chain with distinct lines
// (hypothesis → action → done-when → question). No sentence repeats inside a module card
// or a week card; EN programs contain no Korean; stored programs are never rewritten;
// legacy shape (axisProgram:false) is byte-identical to before.
const assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const T=require('./test-response-evidence.cjs'),R=require('../assets/js/response-evidence.js'),P=require('../assets/js/program-engine.js');
const questions=require('../data/questions.json'),rules=require('../data/program-rules.json');
const json=x=>JSON.stringify(x);
const stable=x=>JSON.stringify(x,(k,v)=>k==='generatedAt'?undefined:v);
const HANGUL=/[\uac00-\ud7a3]/;
let checks=0,linked=0,plain=0;
function sentences(card){
  const out=[];const push=v=>{if(typeof v==='string'&&v.trim())out.push(v.trim());if(Array.isArray(v))v.forEach(push);};
  push(card.summary);push(card.subline);push(card.guide);push(card.actions);push(card.tools);push(card.effects);
  return out;
}
function noRepeat(card,label){
  const s=sentences(card);const seen=new Map();
  for(const x of s){assert.ok(!seen.has(x),`${label}: sentence repeated inside one card: "${x.slice(0,60)}"`);seen.set(x,1);}
  checks++;
}
for(const lang of ['ko','en']){
  for(let seed=0;seed<40;seed++){
    const a=T.base(seed);a.Q1=lang==='en'?'Synthetic':'합성';
    const before=json(a);
    let report;try{report=R.attachAxes(T.build(a,lang,'input-v2').r,questions,a);}catch(e){continue;}
    assert.equal(json(a),before,'answers must not be mutated');
    const storedReport=json(report);
    const prog=P.build({report,rules,name:a.Q1,lang,axisProgram:true,cardShape:'rq-01'});
    assert.equal(json(report),storedReport,'stored report must not be rewritten by program build');checks++;
    if(prog._axisProgram)linked++;else plain++;
    // (a) module cards and week cards: no sentence repeated
    prog.modules.forEach((m,i)=>noRepeat(m,`${lang} seed${seed} module${i+1}`));
    prog.program.weeks.forEach((w,i)=>noRepeat(w,`${lang} seed${seed} week${i+1}`));
    // (b) summary (hypothesis) differs from action in every module; week subline differs from guide
    prog.modules.forEach((m,i)=>{assert.notEqual(m.summary,m.actions[0],`${lang} seed${seed} module${i+1}: summary equals action`);});
    prog.program.weeks.forEach((w,i)=>{assert.notEqual(w.subline,w.guide,`${lang} seed${seed} week${i+1}: subline equals guide`);});
    checks+=2;
    // (c) done-when is still present as a badge source and is not duplicated into tools
    prog.modules.forEach((m,i)=>{assert.ok(m._strategy&&m._strategy.doneWhen,'doneWhen badge source kept');assert.ok(!(m.tools||[]).includes(m._strategy.doneWhen),`${lang} seed${seed} module${i+1}: doneWhen duplicated into tools`);});
    checks++;
    // (d) hypothesis comes verbatim from the same-language VII projection core
    const axes=report._axisProjection.axes;
    prog.modules.forEach((m,i)=>{const plan=report._responseEvidence.plans[i];const core=axes[plan.axis]&&axes[plan.axis].core;
      if(m._strategy.cardShape==='rq-01'){assert.equal(m.summary,core,'hypothesis must be VII core verbatim');}
      else if(m._strategy.axisRule){/* PROG-01 decision hypothesis — covered by test-axis-program-link */}
      else{assert.equal(m.summary,plan.action,'legacy shape only when VII source is unusable');}});
    checks++;
    // (e) EN program: no Hangul in any card text
    if(lang==='en'){const all=[...prog.modules,...prog.program.weeks].flatMap(sentences).join('\n');assert.ok(!HANGUL.test(all),'EN program leaked Korean');checks++;}
    // (f) opt-out (no cardShape) keeps the legacy shape exactly (summary===action, tools===[doneWhen])
    const legacy=P.build({report,rules,name:a.Q1,lang});
    const prog01only=P.build({report,rules,name:a.Q1,lang,axisProgram:true});
    if(!prog01only._axisProgram){assert.equal(stable(prog01only),stable(legacy),'PROG-01 flag alone must stay identical to legacy when no decisions');}
    legacy.modules.forEach((m,i)=>{const plan=report._responseEvidence.plans[i];assert.equal(m.summary,plan.action);assert.deepEqual(m.tools,[plan.doneWhen]);});
    assert.equal(legacy._axisProgram,undefined);checks++;
  }
}
assert.ok(plain>0&&linked>0,'test must cover both decision-linked and plain programs');
console.log(`PASS RQ-01 program card dedup: ${checks} checks; ${linked} decision-linked + ${plain} plain programs; KO/EN; no repeats, VII hypothesis verbatim, legacy opt-out intact, no stored rewrite`);
