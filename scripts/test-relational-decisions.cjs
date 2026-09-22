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
// Reviewer counterexamples are release gates, including their reader/program effects.
for(const [raw,id,qualifier] of [
 ['초보자에게 설명 안 합니다.','Q40','negative'],
 ['초보자에게 설명 안 해요.','Q40','negative'],
 ['친구에게 들었는데 초보자에게 설명하면 좋대요.','Q40','attributed'],
 ['성과보다 안전이 중요하다는 것은 친구의 생각입니다.','Q64','attributed'],
 ['초보자에게 설명합니다. 하지만 오늘은 안 해요.','Q40','negative'],
 ['초보자에게 설명한다는 것은 동료의 의견입니다.','Q40','attributed'],
 ['성과보다 안전이 중요하다고 들었습니다.','Q64','attributed'],
 ['성과보다 안전이 중요하다고 가정해 봅니다.','Q64','hypothetical'],
 ['성과보다 안전이 중요한지는 아직 모르겠습니다.','Q64','uncertain'],
 ['성과보다 안전이 중요한가요?','Q64','question'],
 ['I don’t explain to beginners.','Q40','negative'],
 ['Explaining to beginners is my friend’s idea.','Q40','attributed'],
 ['I heard that explaining to beginners helps.','Q40','attributed'],
 ['I want to explain to beginners.','Q40','hypothetical']
])for(const lang of ['ko','en'])check('scope-admission-'+lang+'-'+raw,()=>{
 const built=response(raw,id,lang),m=built.r._responseEvidence,e=m.semanticEdges[0];
 assert.equal(e.qualifiers[qualifier],true);assert.equal(e.status,'needs-confirmation');assert.notEqual(e.kind,'stated-priority');
 assert.equal(m.axes.self_design.decisionRule,'clarify-before-recommendation');
 assert.equal(m.experiments[0].kind,'clarification');assert.ok(!/다시 설명하게|explain it back/.test(m.plans[2].action));
 assert.ok(!/무게를 둡니다|put .* before/.test(m.axes.self_understanding.core));
 assert.equal(m.fields[e.parentQid].other.rawText,raw);
 assert.ok(e.qualifierSpans.some(s=>s.qualifier===qualifier));
 for(const s of e.qualifierSpans)assert.equal(raw.slice(s.start,s.end),s.text);
 assert.equal(built.p._responseEvidence.plans[2].methodId,'clarify-before-recommendation');
});
check('positive-counterparts-do-not-abstain-on-safety-or-guidance',()=>{
 for(const raw of ['초보자에게 설명합니다.','초보자에게 설명해요.','초보자에게 안전하게 설명합니다.','초보자에게 안내 내용을 설명합니다.']){
  const e=response(raw).r._responseEvidence.semanticEdges[0];assert.equal(e.status,'supported',raw);assert.equal(e.ruleId,'scaffold-understanding');
 }
 const m=response('성과보다 안전이 중요합니다.','Q64').r._responseEvidence;
 assert.equal(m.semanticEdges[0].status,'supported');assert.equal(m.semanticEdges[0].preference.preferred,'안전');
});
check('recipient-is-not-confused-with-speaker',()=>{
 const m=response('초보인 친구에게 설명합니다.').r._responseEvidence;
 assert.equal(m.semanticEdges[0].qualifiers.attributed,false);assert.equal(m.axes.self_design.decisionRule,'scaffold-understanding');
 const e=response('성과보다 안전이 중요하다는 것이 나의 생각입니다.','Q64').r._responseEvidence.semanticEdges[0];
 assert.equal(e.qualifiers.attributed,false);assert.equal(e.status,'supported');
});
check('clarification-method-and-artifact-reflect-the-missing-evidence',()=>{
 const n=response('초보자에게 설명 안 해요.').r._responseEvidence.plans[2];
 const s=response('친구에게 들었는데 초보자에게 설명하면 좋대요.').r._responseEvidence.plans[2];
 const h=response('초보자에게 설명하고 싶어요.').r._responseEvidence.plans[2];
 assert.ok(n.action.includes('피하려는'));assert.ok(s.action.includes('받아들인'));assert.ok(h.action.includes('가정'));
 assert.equal(new Set([n.doneWhen,s.doneWhen,h.doneWhen]).size,3);
});
check('admission-contract-is-shared-by-all-twenty-parent-contexts',()=>{
 const R=require('../assets/js/response-evidence.js');
 for(const parent of T.others)for(const raw of ['초보자에게 설명 안 합니다.','초보자에게 설명 안 해요.','친구에게 들었는데 초보자에게 설명하면 좋대요.','성과보다 안전이 중요하다는 것은 친구의 생각입니다.']){
  const e=R.understand({qid:parent.otherId,parentQid:parent.id,rawText:raw});
  assert.equal(e.admission,'clarification-required');assert.equal(e.status,'needs-confirmation');assert.equal(e.rawText,raw);
 }
});
for(const raw of ['초보자에게 설명 못합니다.','초보자에게 설명 못해요.','초보자에게 설명 못 했습니다.','초보자에게 설명하지 못했습니다.','I cannot explain to a beginner.','I am unable to explain to beginners.'])check('inability-is-not-affirmative-'+raw,()=>{
 const m=response(raw).r._responseEvidence,e=m.semanticEdges[0];assert.equal(e.qualifiers.negative,true);assert.equal(e.status,'needs-confirmation');assert.equal(m.axes.self_design.decisionRule,'clarify-before-recommendation');assert.ok(!m.plans[2].action.includes('다시 설명하게'));assert.ok(e.qualifierSpans.length);
});
for(const raw of ['약속을 성과보다 더 중요하게 생각합니다.','성과보다 약속을 훨씬 더 중요하게 생각합니다.','나는 약속을 성과보다 중요하게 생각한다.','성과보다 약속이 더 중요합니다.','성과보다 약속을 중요하게 생각한다.'])check('priority-grammar-'+raw,()=>{
 const m=response(raw,'Q64').r._responseEvidence,e=m.semanticEdges[0];assert.equal(e.status,'supported');assert.equal(e.preference.over,'성과');assert.equal(e.preference.preferred,'약속');assert.equal(m.axes.self_understanding.core,'선택의 순간, ‘성과’보다 ‘약속’에 무게를 둡니다.');assert.equal(raw.slice(e.preference.sourceSpan.start,e.preference.sourceSpan.end),e.preference.sourceSpan.text);
});
check('all-parent-action-prefixes-are-grammatical',()=>{
 for(const parent of T.others){const m=response('초보자에게 설명합니다.',parent.otherId).r._responseEvidence;assert.ok(!/(?:활동|기준|방식)로/.test(m.experiments[0].action));assert.ok(m.experiments[0].action.includes('에 관해 적어 주신'));}
});
console.log('PASS '+rows.length+' semantic contracts: fluent golden sentences, raw-span grounding, negation, conditions, same-career/different-method, unknown abstention and no forced variation');
if(process.env.LP_RELATIONAL_AUDIT_PATH)fs.writeFileSync(path.resolve(process.env.LP_RELATIONAL_AUDIT_PATH),JSON.stringify({scope:'Synthetic semantic contract tests; not psychometric or 8-billion-population validation',rows},null,2)+'\n');
