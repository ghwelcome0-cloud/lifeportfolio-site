'use strict';
// Semantic acceptance contracts, not word-variation counts or population validity.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const T=require('./test-response-evidence.cjs');
const axes=['self_understanding','self_expression','self_design','self_execution'];
const q=id=>T.qs.find(q=>q.id===id),copy=x=>JSON.parse(JSON.stringify(x));
function response(text,id='Q40',lang='ko'){const a=T.base(0),p=T.others.find(q=>q.otherId===id);a[p.id]=p.type==='multi_choice'?['기타 (직접 입력)']:'기타 (직접 입력)';a[id]=text;return T.build(a,lang);}
const rows=[];function check(name,fn){fn();rows.push({name,pass:true});}
check('approved-principle-sentence-not-a-label-list',()=>{const a=T.base(0);a.Q63=[q('Q63').options[7]];const v=T.build(a).r._responseEvidence.axes.self_understanding;assert.equal(v.core,'선택의 순간, ‘지켜 온 원칙 쪽’에 마음이 향합니다.');assert.ok(!v.core.includes('·'));});
check('secondary-criterion-preserves-natural-meaning',()=>{const a=T.base(0),b=copy(a);a.Q63=[q('Q63').options[0],q('Q63').options[1]];b.Q63=[q('Q63').options[0],q('Q63').options[2]];const av=T.build(a).r._responseEvidence.axes.self_understanding,bv=T.build(b).r._responseEvidence.axes.self_understanding;assert.equal(av.core,'선택의 순간, 뜻이 남으면서도 오래 이어 갈 수 있는 쪽에 마음이 향합니다.');assert.equal(bv.core,'선택의 순간, 나를 자라게 하는 의미에 마음이 향합니다.');assert.equal(av.relationKind,'interpretation-hypothesis');});
for(const lang of ['ko','en']){
 const beginner=lang==='ko'?'처음 배우는 사람이 동작을 이해하도록 설명한다':'I explain a movement so a beginner can understand it';
 const comparison=lang==='ko'?'경험 있는 선수의 경기 장면을 비교하고 판단의 이유를 분석한다':'I compare an experienced athlete’s choices and review the decision reasons';
 check('same-career-different-method-and-artifact-'+lang,()=>{
  const a=response(beginner,'Q40',lang),b=response(comparison,'Q40',lang);
  for(const r of [a.r,b.r])r.sections.find(s=>s.id==='career_education').content.careers=['스포츠 코치'];
  const am=a.r._responseEvidence,bm=b.r._responseEvidence;
  assert.equal(am.axes.self_design.decisionRule,'scaffold-understanding');assert.equal(bm.axes.self_design.decisionRule,'compare-decisions');
  assert.notEqual(am.plans[2].doneWhen,bm.plans[2].doneWhen);assert.notEqual(am.plans[2].action,bm.plans[2].action);
  assert.ok(!am.plans[2].action.includes(beginner));assert.ok(!bm.plans[2].action.includes(comparison));
  assert.ok(lang==='ko'?am.plans[2].action.includes('다시 설명'):am.plans[2].action.includes('explain it back'));
  assert.ok(lang==='ko'?bm.plans[2].doneWhen.includes('비교표'):bm.plans[2].doneWhen.includes('comparison'));
 });
 for(const text of lang==='ko'?['설명하는 일은 하고 싶지 않고 비교만 하고 싶다','남들이 나에게 설명을 잘한다고 말했지만 나는 잘 모르겠다']:['I do not want to explain things','Someone said I explain well'])check('negation-or-attribution-is-not-a-positive-trait-'+lang+'-'+text,()=>{const m=response(text,'Q40',lang).r._responseEvidence;assert.equal(m.axes.self_design.decisionRule,'clarify-before-recommendation');assert.ok(m.coverage.needsConfirmation.includes('Q40'));assert.ok(!m.experiments[0].action.includes('explain it back'));});
 check('conditional-scope-is-not-erased-'+lang,()=>{const text=lang==='ko'?'조용한 공간일 때 처음 배우는 사람에게 동작을 설명한다':'When it is quiet I explain movements to a beginner';const m=response(text,'Q40',lang).r._responseEvidence;assert.equal(m.semanticEdges[0].qualifiers.conditional,true);assert.ok(lang==='ko'?m.axes.self_design.action.includes('조건'):m.axes.self_design.action.includes('conditions'));});
 check('unsupported-is-preserved-not-faked-'+lang,()=>{const raw='새로운 맥락의 낯선 전문용어 / 未知の条件';const m=response(raw,'Q40',lang).r._responseEvidence;assert.equal(m.semanticEdges[0].status,'needs-confirmation');assert.equal(m.fields.Q39.other.rawText,raw);assert.equal(m.axes.self_design.decisionRule,'clarify-before-recommendation');});
}
check('same-meaning-does-not-force-new-wording',()=>{const a=response('처음 배우는 사람에게 동작을 설명한다').r._responseEvidence,b=response('초보 학습자가 이해하도록 설명한다').r._responseEvidence;assert.equal(a.axes.self_design.decisionRule,b.axes.self_design.decisionRule);assert.equal(a.axes.self_design.core,b.axes.self_design.core);assert.equal(a.axes.self_design.action,b.axes.self_design.action);});
check('open-priority-is-not-confined-to-enumerated-types',()=>{for(const [over,preferred] of [['빠른 성장','가족과 함께하는 시간'],['수익','지역의 신뢰'],['편리함','다시 고칠 수 있는 여지']]){const raw=over+'보다 '+preferred+'을 더 중요하게 생각한다',m=response(raw,'Q64').r._responseEvidence;const e=m.semanticEdges[0];assert.equal(e.kind,'stated-priority');assert.equal(e.ruleId,'explicit-open-priority');assert.equal(e.preference.over,over);assert.equal(e.preference.preferred,preferred);assert.ok(m.axes.self_understanding.core.includes(preferred));assert.equal(raw.slice(e.preference.sourceSpan.start,e.preference.sourceSpan.end),e.preference.sourceSpan.text);}});
check('priority-negation-never-inverted',()=>{const m=response('성과보다 약속을 중요하게 생각하지 않는다','Q64').r._responseEvidence;assert.equal(m.semanticEdges[0].status,'needs-confirmation');assert.notEqual(m.semanticEdges[0].kind,'stated-priority');});
check('two-methods-not-silently-ranked',()=>{const a=T.base(0);a.Q39=['기타 (직접 입력)'];a.Q40='초보에게 설명한다';a.Q41=['기타 (직접 입력)'];a.Q42='자료와 판단을 비교한다';const m=T.build(a).r._responseEvidence;assert.equal(m.axes.self_design.decisionRule,'compare-supported-methods');assert.ok(m.axes.self_design.evidenceRefs.includes('Q40')&&m.axes.self_design.evidenceRefs.includes('Q42'));});
check('one-unclear-boundary-vetoes-confident-plan',()=>{const a=T.base(0);a.Q39=['기타 (직접 입력)'];a.Q40='초보에게 설명한다';a.Q47=['기타 (직접 입력)'];a.Q48='사람 많은 곳에서는 집중하지 못한다';const m=T.build(a).r._responseEvidence;assert.equal(m.axes.self_design.decisionRule,'clarify-before-recommendation');assert.ok(m.axes.self_design.unresolvedRefs.includes('Q48'));});
check('every-raw-clause-and-principle-remains-addressable',()=>{const raw='초보에게 설명한다.\n조건을 먼저 확인한다 / 원문은 보존한다';const m=response(raw).r._responseEvidence;for(const c of m.semanticEdges[0].clauses)assert.equal(raw.slice(c.start,c.end),c.text);for(const r of m.relations){assert.ok(r.evidenceRefs.length);for(const p of r.principleRefs)assert.ok(m.principles[p]);}assert.equal(m.inferenceVersion,'relations-v2');assert.equal(m.profileType,undefined);});
check('headline-style-guard-rejects-rejected-candidate',()=>{
 function style(s){assert.ok(s.length<=180);assert.ok(!/창의성·신중함|직접 적은|의 모습에서|의 관계 기준을 연결/.test(s));}
 assert.throws(()=>style('창의성·신중함의 모습에서, 의미·배움의 기준을 살핍니다.'));
 for(const seed of [0,7,13])for(const k of axes)style(T.build(T.base(seed)).r._responseEvidence.axes[k].core);
});
check('opposing-priorities-require-context',()=>{const a=T.base(0);a.Q14='기타 (직접 입력)';a.Q15='수익보다 신뢰를 중요하게 생각한다';a.Q63=['기타 (직접 입력)'];a.Q64='신뢰보다 수익을 중요하게 생각한다';const m=T.build(a).r._responseEvidence;assert.equal(m.axes.self_understanding.decisionRule,'clarify-priority-context');assert.deepEqual(m.relations[0].conflictRefs,['Q15','Q64']);});
check('negative-correction-is-not-overridden-by-selected-expression',()=>{const a=T.base(0);a.Q28=[q('Q28').options[0],'기타 (직접 입력)'];a.Q29='솔직하게 말하기 어렵고 설명하는 일은 싫다';const v=T.build(a).r._responseEvidence.axes.self_expression;assert.equal(v.decisionRule,'clarify-before-recommendation');assert.ok(!v.core.includes('솔직한 말'));});
check('third-person-is-not-assigned-to-user',()=>{const m=response('친구는 처음 배우는 사람에게 설명한다').r._responseEvidence;assert.equal(m.semanticEdges[0].status,'needs-confirmation');assert.equal(m.semanticEdges[0].qualifiers.attributed,true);});
console.log('PASS '+rows.length+' semantic contracts: fluent golden sentences, raw-span grounding, negation, conditions, same-career/different-method, unknown abstention and no forced variation');
if(process.env.LP_RELATIONAL_AUDIT_PATH)fs.writeFileSync(path.resolve(process.env.LP_RELATIONAL_AUDIT_PATH),JSON.stringify({scope:'Synthetic semantic contract tests; not psychometric or 8-billion-population validation',rows},null,2)+'\n');
