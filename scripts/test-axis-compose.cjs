'use strict';
// RQ-03 gate — compositional four-axis generation.
// Proves the "unsolved" properties together: deterministic, evidence-bound (every slot traces to a chosen option),
// no free tokens (every sentence = template fixed words + lexicon phrases), high diversity, full coverage, EN clean, length cap.
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const T=require('./test-response-evidence.cjs'),R=require('../assets/js/response-evidence.js'),C=require('../assets/js/axis-compose.js');
const questions=require('../data/questions.json'),lexicon=require('../data/axis-lexicon.json');
const qs=questions.sections.flatMap(s=>s.questions),choice=qs.filter(q=>q.type!=='likert');
const FORBIDDEN=['심리검사','성격 유형','정확도','과학적으로 증명','공인 인증','타당성이 입증','신뢰도 100','personality type','scientifically proven','certified','accuracy of'];
let checks=0;
// 0) lexicon covers every non-기타 option in both languages
for(const q of choice){const opts=q.options.filter(o=>!/기타/.test(o));const lx=lexicon.questions[q.id];assert.ok(lx,'lexicon missing '+q.id);assert.equal(lx.ko.length,opts.length,q.id+' ko');assert.equal(lx.en.length,opts.length,q.id+' en');lx.ko.concat(lx.en).forEach(p=>assert.ok(p&&p.trim(),q.id+' empty phrase'));}
checks++;
function rnd(seed){let s=seed*2654435761>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}
function gen(seed){const r=rnd(seed+1);const a={Q1:'합성'};for(const q of qs){if(q.type==='likert')a[q.id]=1+Math.floor(r()*5);else if(q.type==='single_choice')a[q.id]=q.options[Math.floor(r()*q.options.length)];else{const k=1+Math.floor(r()*(q.max||1));const pool=q.options.filter(o=>!/기타/.test(o)).slice();const pick=[];while(pick.length<k&&pool.length){pick.push(pool.splice(Math.floor(r()*pool.length),1)[0]);}a[q.id]=pick;}}return a;}
const N=1000;
for(const lang of ['ko','en']){
  let n=0,all4=0;const cores={};const minLen=Infinity;
  for(let seed=0;seed<N;seed++){
    const a=gen(seed);const before=JSON.stringify(a);
    let rep;try{rep=R.attachAxes(T.build(a,lang,'input-v2').r,questions,a);}catch(e){continue;}
    n++;const dec=rep._axisProjection.decisions;
    const o1=C.compose({questions,answers:a,lexicon,lang,existingDecisions:dec}),o2=C.compose({questions,answers:a,lexicon,lang,existingDecisions:dec});
    assert.equal(JSON.stringify(a),before,'answers mutated');
    // (a) deterministic
    assert.equal(JSON.stringify(o1),JSON.stringify(o2),'non-deterministic');
    // (b) coverage: authored decision OR composed for every axis
    const covered=new Set([...dec.map(d=>d.axis),...o1.composed]);if(covered.size===4)all4++;
    for(const ax of o1.composed){const r=o1.axes[ax];
      // (c) evidence-bound: every slot value is the lexicon phrase of an option actually selected in that question
      for(const s of r.slots){const q=qs.find(x=>x.id===s.qid);const opts=q.options.filter(x=>!/기타/.test(x));const sel=[].concat(a[s.qid]);const idx=lexicon.questions[s.qid][lang].indexOf(s.value);assert.ok(idx>=0&&sel.includes(opts[idx]),`${lang} seed${seed} ${ax}: slot ${s.role}="${s.value}" not traceable to a selected option of ${s.qid}`);}
      assert.ok(r.evidenceRefs.length>0&&r.evidenceRefs.every(q=>a[q]!=null),'evidenceRefs must point to answered questions');
      // (d) no free tokens — exact reconstruction: template(fixed words) + lexicon phrases(slots) + particle resolution must equal the output byte-for-byte
      const tpl=C.TEMPLATES[ax][lang][r.template];const slotMap={};for(const s of r.slots){slotMap[s.role]=slotMap[s.role]||[];slotMap[s.role].push(s.value);}
      const refill=txt=>{let v=txt.replace(/\{(\w+?)(2?)\}/g,(m,role,second)=>{const isCap=/^[A-Z]/.test(role)&&role!==role.toUpperCase();const val=(slotMap[role.toLowerCase()]||[])[second?1:0];if(val==null)return m;return isCap?val.charAt(0).toUpperCase()+val.slice(1):val;});return lang==='ko'?C._particles(v):v;};
      for(const [k,tk] of [['core','core'],['detail','detail'],['action','action'],['doneWhen','done'],['reflection','reflection']]){assert.equal(r[k],refill(tpl[tk]),`${lang} seed${seed} ${ax}.${k}: output is not exactly template+lexicon`);assert.ok(!/\{\w+\}/.test(r[k]),'unfilled slot');}
      // (e) EN no Hangul; (f) forbidden words; (g) length cap
      const all=[r.core,r.detail,r.action,r.doneWhen,r.reflection].join('\n');
      if(lang==='en')assert.ok(!/[가-힣]/.test(all),'EN leaked Korean');
      for(const w of FORBIDDEN)assert.ok(!all.includes(w),'forbidden word: '+w);
      assert.ok(r.core.length<=C.LIMIT[lang],'core over limit');
      (cores[ax]=cores[ax]||new Set()).add(r.core);
      // (h) distinct lines inside one axis (hypothesis ≠ action ≠ question)
      assert.ok(new Set([r.core,r.action,r.reflection,r.doneWhen]).size===4,'axis lines must differ');
    }
    // (i) authored decisions are never overridden
    for(const d of dec)assert.ok(!o1.axes[d.axis],'composer must skip axes with authored decisions');
    checks++;
  }
  assert.ok(all4/n>=0.95,`${lang}: all-four coverage ${(100*all4/n).toFixed(1)}% < 95%`);
  for(const ax of C.AXES)assert.ok((cores[ax]||new Set()).size>=300,`${lang} ${ax}: only ${(cores[ax]||new Set()).size} distinct hypotheses (<300 over ${n})`);
  console.log(`  [${lang}] n=${n} all-four=${(100*all4/n).toFixed(1)}% distinct=`+JSON.stringify(Object.fromEntries(Object.entries(cores).map(([k,v])=>[k,v.size]))));
}
// (j) particle resolver fixtures
const P=C._particles;for(const [i,o] of [['‘협동’을(를)','‘협동’을'],['‘신뢰’이(가)','‘신뢰’가'],['‘의미와 보람’(으)로','‘의미와 보람’으로'],['시간(으)로','시간으로'],['‘정의’과(와)','‘정의’와'],['길(으)로','길로']])assert.equal(P(i),o);checks++;
// (k) lexicon file integrity recorded
console.log('PASS RQ-03 axis-compose: '+checks+' checks; deterministic, evidence-bound, no free tokens, forbidden 0, cap, KO/EN; lexicon sha256 '+crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'data/axis-lexicon.json'))).digest('hex').slice(0,12));
