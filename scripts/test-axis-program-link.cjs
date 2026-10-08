'use strict';
// PROG-01: four-axis decision -> execution program. Synthetic data only; no network, no customer record.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const T=require('./test-response-evidence.cjs'),R=require('../assets/js/response-evidence.js'),P=require('../assets/js/program-engine.js');
const q=require('../data/questions.json'),rules=require('../data/program-rules.json');
const at=new Date(0),build=(report,lang,axisProgram)=>{const p=P.build({report,rules,name:'합성',lang,publishedAt:at,...(axisProgram===undefined?{}:{axisProgram})});delete p.meta.generatedAt;return p;};
const freeze=v=>{if(v&&typeof v==='object'){Object.freeze(v);Object.values(v).forEach(freeze);}return v;};
let n=0;const ok=(name,fn)=>{fn();n++;};

const grounded=T.base(0);grounded.Q39=['기타 (직접 입력)'];grounded.Q40='입문 개발자에게 오류 원인을 코드 실행으로 설명합니다.';
const report=R.attachAxes(T.build(grounded,'ko','input-v2').r,q,grounded);
const decision=report._axisProjection.decisions[0];
const before=JSON.stringify(report);freeze(report);
const linked=build(report,'ko',true),plain=build(report,'ko',false),omitted=build(report,'ko');

ok('one-case-full-chain',()=>{
  const item=linked._axisProgram.items[0],axis=report._axisProjection.axes[decision.axis];
  assert.equal(linked._axisProgram.items.length,1);
  assert.deepEqual(item.evidenceRefs,decision.evidenceRefs);                          // 근거
  assert.equal(item.hypothesis,axis.core);                                            // 해석 가설
  assert.equal(item.action,axis.action);                                              // 행동
  assert.ok(item.doneWhen.includes(decision.decision.artifact));                      // 완료 기준
  assert.equal(item.artifact,decision.decision.artifact);                             // 산출물
  assert.equal(item.reuse,decision.decision.reuse);                                   // 다음 사용
  const m=linked.modules[item.planIndex];
  assert.equal(m.summary,item.hypothesis);assert.deepEqual(m.actions,[item.action]);
  assert.equal(m._strategy.doneWhen,item.doneWhen);assert.deepEqual(m._strategy.evidenceRefs,decision.evidenceRefs);
  assert.deepEqual(m.tools,['남길 기록: '+item.artifact,'다음 사용: '+item.reuse]);
  assert.ok(linked.nextSteps[item.planIndex].task.endsWith('다음 사용: '+item.reuse));
});
ok('input-not-mutated',()=>assert.equal(JSON.stringify(report),before));
ok('deterministic',()=>assert.deepEqual(build(report,'ko',true),linked));
ok('opt-in-only-existing-regeneration-unchanged',()=>{
  assert.deepEqual(omitted,plain);assert.equal(plain._axisProgram,undefined);assert.equal(plain.meta.axisProgramVersion,undefined);
});
ok('only-the-linked-axis-changes',()=>{
  const idx=linked._axisProgram.items[0].planIndex,a=structuredClone(linked),b=structuredClone(plain);
  delete a._axisProgram;delete a.meta.axisProgramVersion;
  [a,b].forEach(p=>{p.modules[idx]=null;p.nextSteps[idx]=null;p.program.weeks[[0,2,3].indexOf(idx)]=null;});
  assert.deepEqual(a,b);
});
ok('empty-decisions-no-generic-fill',()=>{
  const a=T.base(0),r=R.attachAxes(T.build(a,'ko','input-v2').r,q,a);
  assert.equal(r._axisProjection.decisions.length,0);
  assert.deepEqual(build(r,'ko',true),build(r,'ko',false));
});
ok('english-no-korean-leak-no-fill',()=>{
  const r=R.attachAxes(T.build(grounded,'en','input-v2').r,q,grounded),p=build(r,'en',true);
  assert.equal(p._axisProgram,undefined);assert.deepEqual(p,build(r,'en',false));
});
ok('english-guard-blocks-korean-decision-text',()=>{
  // EN projections currently carry no decisions; force a Korean-authored one to prove the guard.
  const r=structuredClone(R.attachAxes(T.build(grounded,'en','input-v2').r,q,grounded));
  r._axisProjection={...structuredClone(report._axisProjection),lang:'en'};
  const p=build(r,'en',true);assert.equal(p._axisProgram,undefined);assert.ok(!/[\uac00-\ud7a3]/.test(JSON.stringify(p.modules)));
});
ok('legacy-or-mismatched-projection-ignored',()=>{
  const noAxes=structuredClone(report);delete noAxes._axisProjection;
  assert.deepEqual(build(noAxes,'ko',true),plain);
  for(const patch of [{version:'axis-projection-v0'},{lang:'en'},{scope:'all'},{requiresReview:true}]){
    const r=structuredClone(report);Object.assign(r._axisProjection,patch);
    assert.equal(build(r,'ko',true)._axisProgram,undefined,JSON.stringify(patch));
  }
});
ok('incomplete-decision-not-guessed',()=>{
  for(const k of ['artifact','reuse']){const r=structuredClone(report);delete r._axisProjection.decisions[0].decision[k];assert.equal(build(r,'ko',true)._axisProgram,undefined,k);}
  const r=structuredClone(report);r._axisProjection.decisions[0].evidenceRefs=[];assert.equal(build(r,'ko',true)._axisProgram,undefined);
});
ok('new-generation-and-explicit-regeneration-opt-in',()=>{
  const root=path.resolve(__dirname,'..');
  const loading=fs.readFileSync(path.join(root,'program-loading.html'),'utf8'),program=fs.readFileSync(path.join(root,'program.html'),'utf8');
  assert.equal((loading.match(/axisProgram: true/g)||[]).length,1);
  // program.html calls ProgramEngine.build only from the regenerate button handler.
  assert.equal((program.match(/ProgramEngine\.build\(/g)||[]).length,1);
  assert.equal((program.match(/axisProgram: true/g)||[]).length,1);
  const call=program.slice(program.indexOf('ProgramEngine.build('),program.indexOf('ProgramEngine.build(')+400);
  assert.ok(call.includes('axisProgram: true'),'Regenerate build must opt in');
});
ok('stored-program-shape-allowed-by-rules',()=>{
  // `program` is free-form under programs/$uid/$sid; new keys must stay inside it.
  const rulesDb=require('../database.rules.json').rules.programs.$uid.$sid;
  assert.deepEqual(rulesDb.program,{});assert.ok(linked._axisProgram&&!('_axisProgram' in rulesDb));
});
ok('program-files-differ-from-baseline-only-by-approved-prog01-additions',()=>{
  // Replaces the old byte-boundary for these two files (test-axis-projection.cjs). Removing the
  // approved PROG-01 blocks must give back the exact pre-PROG-01 bytes (commit 9734521).
  const root=path.resolve(__dirname,'..'),cp=require('node:child_process');
  const base=f=>cp.execFileSync('git',['show','9734521:'+f],{cwd:root,encoding:'utf8',maxBuffer:6000000});
  let engine=fs.readFileSync(path.join(root,'assets/js/program-engine.js'),'utf8');
  const fnStart=engine.indexOf('  /* PROG-01 — four-axis decision'),fnEnd=engine.indexOf('  /* ========================================================================\n   *  메인 빌더');
  assert.ok(fnStart>0&&fnEnd>fnStart);engine=engine.slice(0,fnStart)+engine.slice(fnEnd);
  const callStart=engine.indexOf('      // PROG-01: carry each grounded'),callEnd=engine.indexOf('    }\n    return output;',callStart);
  assert.ok(callStart>0&&callEnd>callStart);engine=engine.slice(0,callStart)+engine.slice(callEnd);
  assert.equal(engine,base('assets/js/program-engine.js'));
  let program=fs.readFileSync(path.join(root,'program.html'),'utf8');
  for(const [next,old] of [
   ['          lang: _lockedLang,\n          axisProgram: true   // PROG-01: explicit regeneration also links grounded four-axis decisions\n','          lang: _lockedLang\n'],
   ['실행 프로그램을 다시 만들까요?\\n저장된 리포트에 최신 분석을 적용해, 지금 보이는 프로그램을 새 결과로 바꿉니다.','저장된 인생포트폴리오 리포트로 최신 엔진으로 실행 프로그램을 다시 생성합니다.\\n현재 표시된 프로그램이 새 결과로 갱신됩니다. 계속할까요?'],
   ['✅ 최신 분석으로 실행 프로그램을 다시 만들었습니다.','✅ 최신 엔진으로 실행 프로그램이 재생성되었습니다.'],
   ['title="저장된 리포트로 실행 프로그램을 다시 만듭니다."','title="저장된 리포트로 실행 계획을 다시 만듭니다."']]){
   assert.equal(program.split(next).length,2,'approved edit present once: '+next.slice(0,30));program=program.replace(next,old);}
  assert.equal(program,base('program.html'));
});
console.log('PASS '+n+' PROG-01 axis→program link checks (one grounded case, opt-in, KO/EN, legacy, empty, immutability)');
