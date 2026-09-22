/* Versioned response evidence: direct observations, bounded projections, explicit proposals.
 * No network, storage, scoring, hidden-trait inference or hash-based wording selection.
 * input-v2 is opt-in; historical saved reports are never upgraded by this module.
 */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.LPResponseEvidence=factory();
})(typeof self!=='undefined'?self:this,function(){
  'use strict';
  var VERSION='input-v2', READER='evidence-reader-v1';
  var AXES=['self_understanding','self_expression','self_design','self_execution'];
  function arr(v){return Array.isArray(v)?v.slice():(v==null||v===''?[]:[v]);}
  function text(v){return typeof v==='string'?v:'';}
  function nonblank(v){return typeof v==='string'&&v.trim().length>0;}
  function other(v){return /^(기타(?:\s*\(직접 입력\))?|other(?:\s*\(.*\))?)$/i.test(String(v).trim());}
  function active(q,a){return arr(a[q.id]).some(function(v){return other(v);});}
  function unique(a){return a.filter(function(v,i){return a.indexOf(v)===i;});}
  function short(s,n){s=String(s||'').replace(/\s+/g,' ').trim();return Array.from(s).length>n?Array.from(s).slice(0,n-1).join('')+'…':s;}
  // Roles follow the parent question, never a inferred meaning of arbitrary text.
  var ROLES={
    Q7:['self_understanding','나를 느끼는 상황','situations that reveal you','그 상황의 한 장면에서 내가 한 선택과 이유를 적어 보세요.','Record one choice you made in that situation and why.'],
    Q14:['self_understanding','지키려는 기준','a standard you protect','그 기준을 지킬 수 있는 행동과 지키기 어려운 조건을 하나씩 적어 보세요.','Name one action that protects that standard and one condition that makes it difficult.'],
    Q19:['self_understanding','전환 경험','a turning experience','그 경험 전후에 달라진 선택을 비교해 보세요.','Compare a choice before and after that experience.'],
    Q21:['self_understanding','회복 방식','a way of recovering','무리가 없는 상황에서 그 방식을 시도하고 도움이 된 점과 달랐던 점을 남겨 보세요.','Try that approach in a manageable situation and note what helped or differed.'],
    Q26:['self_understanding','감정 조절 방식','a way of managing emotion','그 방식이 도움이 됐던 상황과 그렇지 않았던 상황을 구분해 보세요.','Distinguish a situation where that approach helped from one where it did not.'],
    Q28:['self_expression','감정을 전하는 방식','how you convey feelings','그 방식으로 짧게 전한 뒤 상대가 이해한 뜻을 확인해 보세요.','Try a short message in that way and check what the other person understood.'],
    Q31:['self_expression','함께 있을 때의 인상','the impression you report','그 인상이 드러난 구체적인 장면과 상대의 반응을 구분해 적어 보세요.','Separate a concrete scene from the response you observed.'],
    Q33:['self_expression','관계에서 지킬 것','what matters in relationships','그 요소를 지키는 말이나 행동 하나를 정하고 상대와 확인해 보세요.','Choose one word or action that honors it and check with the other person.'],
    Q39:['self_design','몰입하는 활동','an engaging activity','그 활동을 작은 단위로 해 보고 과정이나 결과 하나를 남겨 보세요.','Try a small unit of that activity and keep one process record or result.'],
    Q41:['self_design','관심 주제','an interest topic','그 주제에서 알고 싶은 질문 하나와 확인할 자료 하나를 정해 보세요.','Choose one question about that topic and one source to examine.'],
    Q47:['self_design','집중 장소','a place for concentration','그 장소에서 짧게 해 보고 집중에 도움이 된 조건을 기록해 보세요.','Try a short task there and record the conditions that helped concentration.'],
    Q49:['self_design','편안한 리듬','a comfortable rhythm','그 리듬에 작은 활동을 배치하고 무리 없이 이어졌는지 확인해 보세요.','Place a small activity in that rhythm and check whether it was manageable.'],
    Q55:['self_design','시작 동기','a reason to start','그 이유를 오늘 할 수 있는 작은 시작 행동에 연결해 보세요.','Connect that reason to one small action you can start today.'],
    Q57:['self_design','지속 이유','a reason you continued','그 이유를 다음 실행에도 마련할 수 있는지 점검해 보세요.','Check whether that condition can be available for your next attempt.'],
    Q63:['self_design','선택 기준','a decision criterion','그 기준으로 두 선택지를 비교하되 포기하기 어려운 점도 적어 보세요.','Compare two options using that criterion and note what is hard to give up.'],
    Q65:['self_understanding','선택에 영향을 준 대상','an influence on decisions','받아들인 조언과 내가 결정한 이유를 나눠 적어 보세요.','Separate the advice you received from your own reason for deciding.'],
    Q71:['self_execution','목표를 이루는 방식','a way of pursuing goals','그 방식을 다음 한 단계에 적용하고 실제로 진행된 것을 기록해 보세요.','Apply that approach to your next step and record what actually progressed.'],
    Q73:['self_execution','성취를 느끼는 순간','a moment of achievement','그 순간을 확인할 수 있는 완료 기준 하나를 정해 보세요.','Define one observable completion criterion for that moment.'],
    Q75:['self_execution','관심 분야','an area of interest','그 분야의 실제 활동 하나를 살펴보고 직접 해 볼 작은 과제를 정해 보세요.','Examine one real activity in that field and choose a small task to try.'],
    Q77:['self_execution','의미 있는 활동','a meaningful activity','그 활동에서 남길 수 있는 결과와 도움이 될 대상을 확인해 보세요.','Check what result that activity could leave and whom it could help.']
  };
  function context(questions,answers,lang){
    var en=lang==='en',effective=Object.assign({},answers),fields={},observations=[],experiments=[];
    (questions.sections||[]).forEach(function(s){(s.questions||[]).forEach(function(q){
      var options=q.options||[],values=unique(arr(answers[q.id]).filter(function(v){return typeof v==='string'&&nonblank(v)&&!other(v);}));
      values.sort(function(a,b){var ai=options.indexOf(a),bi=options.indexOf(b);if(ai<0)ai=options.length;if(bi<0)bi=options.length;return ai-bi||(a<b?-1:a>b?1:0);});
      var display=values.map(function(v){var i=options.indexOf(v);return en&&i>=0&&q.options_en&&q.options_en[i]?q.options_en[i]:v;});
      fields[q.id]={qid:q.id,question:en?(q.text_en||q.text):q.text,selected:values,display:display,unknown:values.filter(function(v){return options.indexOf(v)<0;}),kind:'direct-selection',ranked:false};
      var selectionRole=ROLES[q.id];
      if(selectionRole&&display.length)experiments.push({parentQid:q.id,kind:'direct-selection',axis:selectionRole[0],action:(en?'Your '+selectionRole[2]+': “':selectionRole[1]+'로 고른 ‘')+short(display.join(' · '),64)+(en?'”. ':'’. ')+selectionRole[en?4:3]});
      if(q.type==='multi_choice')effective[q.id]=values.concat(active(q,answers)?['기타 (직접 입력)']:[]);
      if(q.hasOther&&q.otherId){
        var raw=text(answers[q.otherId]),isActive=active(q,answers),state=isActive?(nonblank(raw)?'active':'active-empty'):(nonblank(raw)?'retained-inactive':'empty');
        fields[q.id].other={qid:q.otherId,rawText:raw,state:state,kind:'direct-text',interpretation:'context-only'};
        if(state!=='active')delete effective[q.otherId];
        var role=ROLES[q.id];
        if(role&&state==='active')observations.push({qid:q.otherId,parentQid:q.id,axis:role[0],label:role[en?2:1],rawText:raw,
          excerpt:short(raw,72),kind:'direct-text',interpretation:'context-only',
          action:(en?'For your '+role[2]+' — “':'직접 적은 '+role[1]+' ‘')+short(raw,56)+(en?'”: ':'’: ')+role[en?4:3],
          doneWhen:en?'A record of what you tried, what happened and what you would change.':'시도한 것·실제로 일어난 것·다음에 바꿀 점을 기록하면 마칩니다.'});
      }
    });});
    return {version:VERSION,lang:lang,fields:fields,observations:observations,experiments:experiments.concat(observations),effectiveAnswers:effective};
  }
  // Shared decision layer. Rules describe relationships and experiments, never person types.
  // Every edge retains its source span. Unresolved language remains unresolved, not a default type.
  var PRINCIPLES={
    dignity:{basis:'Genesis 1:27; Romans 12:3-8',rule:'No worth/rank/hidden-calling claims'},
    truth:{basis:'Ephesians 4:15; Psalm 139',rule:'Direct evidence, interpretation and proposal remain separate; unresolved speaker, negation or modality vetoes affirmative recommendations'},
    intelligibility:{basis:'1 Corinthians 14:9; Nehemiah 8',rule:'Situational prose; no trait/value lists as insight'},
    stewardship:{basis:'1 Peter 4:10',rule:'Each proposal names an observable result and possible reuse'},
    information:{basis:'Data processing inequality',rule:'Keep raw evidence and relations before projection'},
    compression:{basis:'Rate-distortion as a design constraint, not a calibrated metric',rule:'Never drop negation/condition/uncertainty to fit a headline'},
    decision:{basis:'Decision value and within-person testing',rule:'Different meaningful evidence must change a decision or a needed question'},
    benchmarks:{basis:'Gallup/Birkman/InBody/Hogan learning principles',rule:'Interpretation, operating conditions, grounded comparisons and open reflection; no copied norms'}
  };
  function understand(o){
    var raw=o.rawText, clauses=[],re=/[^.!?。！？\n]+/g,m;
    while((m=re.exec(raw)))if(m[0].trim())clauses.push({text:m[0],start:m.index,end:m.index+m[0].length});
    // Admission precedes keyword-based method selection. These are bounded language
    // rules, not a general parser: an unresolved operator vetoes the whole observation.
    // Keep exact UTF-16 offsets so neither a short headline nor normalization drops scope.
    var qualifierSpans=[];
    function detect(qualifier,pattern){
      var match,found=false;
      while((match=pattern.exec(raw))){found=true;qualifierSpans.push({qualifier:qualifier,start:match.index,end:match.index+match[0].length,text:match[0]});}
      return found;
    }
    var negative=detect('negative',/(?:않|아니|못하|못해|못한|싫|피하|피해|없|말아|말고|(?:^|[\s,.;!?])(?:안|못)\s+[가-힣]+|(?:^|[\s,.;!?])안(?:해|하|한|할|했)|\bnot\b|\bnever\b|\bavoid\b|\bwithout\b|\b(?:can|don|doesn|didn|won|wouldn|couldn|shouldn)[’']t\b)/gi);
    var attributed=detect('attributed',/[“”"「」]|(?:라고|다고)\s*(?:말|들)|(?:들었|들엇|들으니|듣기로|전해\s*들|전해졌)|(?:대요|다더라|다던데|다고\s*해요)|(?:친구|동료|그녀|그들|남들|다른\s*사람|선생님|부모님)(?:는|은|이|가)|(?:^|[\s,])(?!(?:나|저)의\s)(?:[가-힣A-Za-z]+)의\s*(?:생각|의견|주장|기준)|\b(?:said|says|told|heard|according to)\b|(?:^|[.!?]\s*)(?:he|she|they|my friend)\b|\b[\w]+[’']s\s+(?:idea|opinion|thought|view|belief)\b/gi);
    var hypothetical=detect('hypothetical',/(?:만약|가정|해\s*보고\s*싶|하고\s*싶)|\b(?:imagine|suppose|wish|want to)\b/gi);
    var uncertain=detect('uncertain',/(?:모르|불확실|확신.*없|일지도|같기도)|\b(?:maybe|perhaps|unsure|uncertain|might)\b/gi);
    var question=detect('question',/[?？]|(?:인가요|한가요|할까요|는지요)|\b(?:whether)\b/gi);
    var conditional=detect('conditional',/(?:때|경우|다면|으면|에서는|일\s*때)|\b(?:when|if|unless|only)\b/gi);
    var contrast=detect('contrast',/(?:하지만|더라도|반면|대신|보다)|\b(?:but|rather than|instead|although)\b/gi);
    var admissionBlocked=negative||attributed||hypothetical||uncertain||question;
    var signals={
      novice:/(?:초보|처음\s*배우|입문)|\b(?:beginner|novice)\b/i.test(raw),
      experienced:/(?:경험\s*(?:많|있)|숙련|선수|경기.*판단)|\b(?:experienced|expert|athlete)\b/i.test(raw),
      explain:/(?:설명|이해|알려|가르|따라)|\b(?:explain|understand|teach)\b/i.test(raw),
      compare:/(?:비교|판단|선택지|분석|복기|되짚)|\b(?:compare|comparison|decision|analy[sz]|review)\b/i.test(raw),
      make:/(?:만들|제작|창작|그리|디자인)|\b(?:make|build|creat|design)\b/i.test(raw),
      repeat:/(?:반복|매일|꾸준|루틴|습관)|\b(?:repeat|daily|routine|habit)\b/i.test(raw),
      together:/(?:함께|협력|동료|응원)|\b(?:together|collaborat|colleague|support)\b/i.test(raw),
      safety:/(?:안전|다치|부상)|\b(?:safe|safety|injur)\b/i.test(raw)
    };
    var edge={source:o.qid,parentQid:o.parentQid,kind:'reported-context',rawText:raw,clauses:clauses,
      qualifiers:{negative:negative,attributed:attributed,hypothetical:hypothetical,uncertain:uncertain,question:question,conditional:conditional,contrast:contrast},qualifierSpans:qualifierSpans,admission:admissionBlocked?'clarification-required':'bounded-proposal-eligible',
      signals:signals,status:'needs-confirmation',ruleId:'unresolved-context',basis:['truth','information','compression']};
    // Priority is recognized only when explicitly written, never from array order.
    var priority=/^\s*([^\n.!?]{1,36}?)보다\s+([^\n.!?]{1,36}?)(?:을|를|이|가)?\s*(?:더\s*)?(?:중요하게|중요하|중요합|중요해|우선하|먼저\s*생각)/.exec(raw);
    if(priority&&!admissionBlocked){
      edge.ruleId='explicit-open-priority';edge.kind='stated-priority';edge.status='supported';
      edge.preference={over:priority[1].trim(),preferred:priority[2].trim(),sourceSpan:{start:priority.index,end:priority.index+priority[0].length,text:priority[0]}};
    }else if(!admissionBlocked&&/(?:성과|결과)보다\s*(?:지키기로\s*한\s*)?(?:약속|원칙)(?:을|이|를)?\s*(?:더\s*)?(?:중요|우선|먼저)/.test(raw)){
      edge.ruleId='explicit-promise-over-result';edge.kind='stated-priority';edge.status='supported';
    }else if(!admissionBlocked&&/(?:약속|원칙)보다\s*(?:성과|결과)(?:을|이|를)?\s*(?:더\s*)?(?:중요|우선|먼저)/.test(raw)){
      edge.ruleId='explicit-result-over-promise';edge.kind='stated-priority';edge.status='supported';
    }else if(admissionBlocked){edge.ruleId=negative?'negation-needs-scope':attributed?'reported-speech-needs-owner':hypothetical?'hypothesis-needs-confirmation':'uncertainty-needs-confirmation';
    }else if(signals.novice&&signals.explain&&!signals.experienced){edge.ruleId='scaffold-understanding';edge.status='supported';
    }else if(signals.compare&&!signals.explain){edge.ruleId='compare-decisions';edge.status='supported';
    }else if(signals.explain&&!signals.compare){edge.ruleId='check-understanding';edge.status='supported';
    }else if(signals.make&&!signals.compare&&!signals.explain){edge.ruleId='prototype-and-feedback';edge.status='supported';
    }else if(signals.repeat&&!signals.together){edge.ruleId='repeat-and-observe';edge.status='supported';
    }else if(signals.together&&!signals.repeat){edge.ruleId='coordinate-and-check';edge.status='supported';}
    if(conditional||contrast)edge.basis.push('compression');
    return edge;
  }
  var EXPERIMENTS={
    'scaffold-understanding':{
      ko:['처음 배우는 사람이 따라올 수 있는 설명을 만들고, 이해한 지점부터 다음 걸음을 정해 봅니다.','낯선 것을 이해할 수 있는 말로 풀어, 상대의 첫걸음을 돕습니다.','익숙하지 않은 사람이 실제로 따라올 수 있는지가 계획을 다듬는 기준이 됩니다.','짧은 설명 한 가지를 들려준 뒤, 상대가 자기 말로 다시 설명하게 해 보세요. 막힌 부분만 고칩니다.','상대가 다시 설명한 말과 고친 설명을 함께 남깁니다.','어떤 설명이 상대의 다음 시도를 가능하게 했나요?'],
      en:['Build an explanation a beginner can follow, then choose the next step from what they understood.','You can make the unfamiliar understandable, helping someone take a first step.','Whether a newcomer can follow is a useful criterion for refining the plan.','Give one short explanation, ask the learner to explain it back, then revise only the part that blocked them.','Keep the learner’s explanation and your revision together.','Which explanation made their next attempt possible?']},
    'compare-decisions':{
      ko:['비슷해 보이는 장면의 다른 선택을 비교하며, 다음 판단에 쓸 기준을 찾아봅니다.','겉으로 같은 결과보다, 그 결과를 만든 선택의 차이를 살펴봅니다.','결과만 모으기보다 선택지와 판단 이유를 함께 남기면 다음 사례에서 다시 검토할 수 있습니다.','두 장면의 선택지와 판단 이유를 나란히 적고, 결과를 바꾼 조건 한 가지를 비교해 보세요.','두 사례의 선택·조건·판단 이유를 비교표로 남깁니다.','다음 장면에서도 쓸 수 있는 기준과 그때만 맞았던 기준은 무엇인가요?'],
      en:['Compare different choices in similar situations to find a criterion worth testing next time.','You can look beyond similar results to the choices that produced them.','Keeping alternatives and reasons together makes them available for review in the next case.','Put two situations’ alternatives and reasons side by side; compare one condition associated with different results.','Keep a two-case comparison of choices, conditions and reasons.','Which criterion could be reused, and which applied only there?']},
    'check-understanding':{
      ko:['전하려는 뜻과 상대가 받아들인 뜻 사이를 살피며, 설명을 다듬어 봅니다.','말을 잘 끝내는 것보다, 뜻이 어떻게 닿았는지를 살펴봅니다.','표현한 사실과 상대가 이해한 사실을 구분하면, 내 전달 방식을 경험으로 보완할 수 있습니다.','핵심을 한 문장으로 전하고 상대가 이해한 뜻을 물어보세요. 서로 다르게 이해한 한 부분을 고칩니다.','처음 표현·상대의 이해·수정한 표현을 남깁니다.','같은 말을 했는데 뜻이 다르게 닿은 까닭은 무엇이었나요?'],
      en:['Refine an explanation by checking the gap between what you meant and what was understood.','You can look beyond finishing a message to how its meaning reached someone.','Separating expression from observed understanding lets experience improve your communication.','Share one key sentence and ask what was understood; revise one point of difference.','Keep the original message, the response and the revision.','Why did the same words convey a different meaning?']},
    'prototype-and-feedback':{
      ko:['생각을 작은 결과물로 꺼내 놓고, 실제 반응을 보며 다음 모양을 다듬어 봅니다.','머릿속의 가능성을 작은 결과물로 옮기며, 다음 방향을 찾아갑니다.','완성된 모습부터 정하기보다 작은 시제품으로 확인할 질문을 좁혀 볼 수 있습니다.','확인하고 싶은 기능 하나만 담은 초안을 만들고, 써 본 사람의 반응 한 가지를 기록해 보세요.','초안·관찰한 반응·다음 수정 이유를 남깁니다.','내가 좋다고 생각한 점과 실제로 도움이 된 점은 같았나요?'],
      en:['Make a small draft and use an actual response to refine its next form.','You can bring a possibility into a small artifact and discover the next direction.','A small prototype can narrow the question before the final form is decided.','Build a draft for one function and record one observed response from someone who tries it.','Keep the draft, observed response and reason for revising it.','Was what you liked also what helped the user?']},
    'repeat-and-observe':{
      ko:['크게 시작하기보다, 다시 해낼 수 있는 크기로 실행을 이어 가 봅니다.','한 번의 힘보다, 다시 움직일 수 있는 흐름을 만들어 갑니다.','반복한 횟수뿐 아니라 무리 없이 이어진 조건을 남겨 다음 실행의 크기를 조절해 볼 수 있습니다.','작은 행동을 정한 시간에 세 번 시도하고, 이어진 날과 멈춘 날의 조건을 비교해 보세요.','세 번의 시도와 다음에 유지하거나 바꿀 조건을 남깁니다.','의지보다 실행을 쉽게 만들어 준 조건은 무엇이었나요?'],
      en:['Choose a size you can repeat rather than relying on a large start.','You can build a rhythm that makes it possible to act again.','Recording manageable conditions as well as repetitions helps adjust the next attempt.','Try one small action at a chosen time on three occasions and compare the conditions.','Keep the three attempts and the condition to retain or change.','What made the action easier beyond willpower?']},
    'coordinate-and-check':{
      ko:['혼자 정한 계획을 함께 움직일 약속으로 바꾸고, 서로의 역할을 확인해 봅니다.','함께 움직일 수 있는 약속에서, 실행을 이어 갈 힘을 찾습니다.','상대가 동의한 역할과 내가 기대한 역할을 구분해야 실제 협력의 조건을 확인할 수 있습니다.','함께할 사람이 동의한 작은 역할 하나와 확인 시점을 정하고, 서로 이해한 내용을 맞춰 보세요.','합의한 역할·확인 결과·다음 약속을 남깁니다.','내 기대와 상대가 동의한 범위는 같았나요?'],
      en:['Turn a private plan into a shared agreement and check each person’s role.','You can find support for action in agreements people can actually share.','Distinguishing agreed roles from expectations helps test the conditions for cooperation.','Agree on one small role and a check-in time, then compare what each person understood.','Keep the agreed roles, outcome and next agreement.','Did your expectation match what the other person agreed to?']}
  };
  function experiment(o,edge,en){
    var p=EXPERIMENTS[edge.ruleId],data=p&&p[en?'en':'ko'];
    var role=ROLES[o.parentQid],prefix=en?'For the '+role[2]+' you described: ':role[1]+'로 적어 주신 내용을 적용할 때, ';
    var action,done,reflection;
    if(data){action=data[3];done=data[4];reflection=data[5];}
    else if(edge.kind==='stated-priority'){
      action=en?'Compare two real options using the priority you explicitly described; check what each would preserve or give up.':'직접 밝힌 우선순위로 실제 선택지 두 개를 비교하고, 각각 지킬 것과 내려놓을 것을 적어 보세요.';
      done=en?'Keep the options, chosen priority and reason for the decision.':'선택지·적용한 우선순위·결정 이유를 남깁니다.';
      reflection=en?'In which situation would that priority no longer hold?':'어떤 상황에서는 이 우선순위가 달라질 수 있나요?';
    }else{
      action=en?'Clarify one concrete situation before choosing a method: what would you do, avoid, and under which condition?':'방법을 정하기 전에 한 장면을 구체화해 보세요. 무엇을 하려는지, 피하려는지, 어떤 조건에서인지 나눠 적습니다.';
      done=en?'Keep an example separating intended action, boundary and condition; do not treat it as a confirmed trait.':'하려는 행동·피할 것·필요한 조건을 구분한 사례를 남깁니다. 확인 전에는 성향으로 단정하지 않습니다.';
      reflection=en?'What part must not be lost when this is interpreted?':'이 내용을 해석할 때 꼭 놓치지 말아야 할 부분은 무엇인가요?';
      if(edge.qualifiers.attributed){
        action=en?'Separate the other person’s view from the part you accept yourself. Describe a situation where your own choice shows that distinction.':'다른 사람이 말하거나 생각한 내용과 내가 받아들인 부분을 나누어 보세요. 내 선택이 드러나는 장면 하나를 적습니다.';
        done=en?'Keep the speaker’s view, your own position and an example; leave an undecided position open.':'발언 주체·내 입장·해당 사례를 남깁니다. 아직 정하지 않은 입장은 미확정으로 둡니다.';
        reflection=en?'Whose view is this, and which part, if any, do you accept?':'누구의 생각이며, 그중 내가 받아들인 부분은 무엇인가요?';
      }else if(edge.qualifiers.negative){
        action=en?'Identify what you do not do or want to avoid, and whether that boundary always applies or only in a particular situation. Do not turn it into an instruction to do the activity.':'하지 않거나 피하려는 행동을 먼저 구분해 보세요. 늘 피하는지, 특정 상황에서만 그런지 확인하고 반대되는 실행을 권하지 않습니다.';
        done=en?'Keep the avoided action, the conditions and one example before choosing a next step.':'피하려는 행동·해당 조건·사례 하나를 남긴 뒤 다음 실행을 정합니다.';
        reflection=en?'What exactly does the negative statement apply to?':'하지 않는다는 말은 정확히 어떤 행동과 상황에 해당하나요?';
      }else if(edge.qualifiers.hypothetical||edge.qualifiers.uncertain||edge.qualifiers.question){
        action=en?'Separate a wish, assumption or question from what you have actually chosen. Clarify what you want to test before selecting a method.':'바람·가정·질문과 실제로 선택한 일을 구분해 보세요. 무엇을 확인하고 싶은지 정한 뒤 방법을 고릅니다.';
        done=en?'Keep what is known, what remains open and one question to check; do not record an assumption as a settled priority.':'확인한 사실·아직 미정인 부분·확인할 질문 하나를 남깁니다. 가정을 확정된 우선순위로 기록하지 않습니다.';
        reflection=en?'Is this an actual choice, a wish or an open question?':'실제로 한 선택인가요, 바라는 일인가요, 아직 열린 질문인가요?';
      }
    }
    if(edge.qualifiers.conditional||edge.qualifiers.contrast)action+=(en?' First confirm that your stated conditions apply.':' 먼저 적어 주신 조건이 맞는 상황인지 확인하세요.');
    return {parentQid:o.parentQid,qid:o.qid,axis:o.axis,kind:edge.status==='supported'?'evidence-based-proposal':'clarification',ruleId:edge.ruleId,
      action:prefix+action,doneWhen:done,reflection:reflection,evidenceRefs:[o.qid],sourceExcerpt:short(o.rawText,90),
      status:edge.status,interpretation:'bounded-relational',edge:edge};
  }
  function compile(ctx,questions){
    var en=ctx.lang==='en',qs={};(questions.sections||[]).forEach(function(s){(s.questions||[]).forEach(function(q){qs[q.id]=q;});});
    function ids(qid){return (ctx.fields[qid]?.selected||[]).map(function(v){return (qs[qid]?.options||[]).indexOf(v);}).filter(function(i){return i>=0;});}
    function has(qid,i){return ids(qid).indexOf(i)>=0;}
    function chosen(qid,value){return (ctx.fields[qid]?.selected||[]).indexOf(value)>=0;}
    function existing(qids){return qids.filter(function(id){var f=ctx.fields[id];return f&&(f.selected.length||f.other?.state==='active');});}
    function first(qid){return ids(qid)[0];}
    var compass=ids('Q63'),traits=ids('Q6'),express=ids('Q28'),activities=ids('Q39'),done=first('Q73'),start=ids('Q55'),stay=ids('Q57');
    var anchors=['뜻이 남는 쪽','흔들림 없이 이어 갈 수 있는 쪽','새로 배울 수 있는 쪽','스스로 결정할 수 있는 쪽','사람과 이어지는 쪽','실제로 결과를 낼 수 있는 쪽','마음이 살아나는 쪽','지켜 온 원칙 쪽','맡은 몫을 다할 수 있는 쪽'];
    var leads=['뜻을 남기면서도','기반을 지키면서도','배움의 길을 열면서도','내 선택의 여지를 두면서도','관계를 이어 가면서도','실제 결과를 살피면서도','마음이 움직이는 일을 찾으면서도','지켜야 할 선을 살피면서도','맡은 몫을 다하면서도'];
    var anchorsEn=['what leaves meaning','what can remain steady','what offers learning','what you can decide for yourself','what connects people','what produces a result','what brings interest alive','the principles you have kept','what fulfills your responsibility'];
    var cores={},details={},actions={},reflections={},ruleIds={},refs={};
    refs[AXES[0]]=existing(['Q6','Q7','Q13','Q14','Q19','Q21','Q26','Q63','Q65']);
    refs[AXES[1]]=existing(['Q28','Q31','Q33']);refs[AXES[2]]=existing(['Q39','Q41','Q47','Q49','Q63','Q73']);refs[AXES[3]]=existing(['Q55','Q57','Q71','Q73','Q75','Q77']);
    if(compass.length===1)cores[AXES[0]]=en?'At a choice, you are drawn toward '+anchorsEn[compass[0]]+'.':'선택의 순간, ‘'+anchors[compass[0]]+'’에 마음이 향합니다.';
    else if(compass.length>1){
      cores[AXES[0]]=en?'When choosing, you look for a way to honor both '+anchorsEn[compass[0]]+' and '+anchorsEn[compass[1]]+'.':'선택의 순간, '+leads[compass[0]]+' '+anchors[compass[1]]+'을 살핍니다.';
      if(!en&&has('Q63',0)&&has('Q63',1))cores[AXES[0]]='선택의 순간, 뜻이 남으면서도 오래 이어 갈 수 있는 쪽에 마음이 향합니다.';
      if(!en&&has('Q63',0)&&has('Q63',2))cores[AXES[0]]='선택의 순간, 나를 자라게 하는 의미에 마음이 향합니다.';
      if(!en&&has('Q63',1)&&has('Q63',2))cores[AXES[0]]='선택의 순간, 기반을 지키며 새로 배울 수 있는 길을 살핍니다.';
    }else cores[AXES[0]]=en?'A choice becomes clearer when you can name what matters.':'무엇을 지키고 싶은지 알아갈수록, 선택의 방향이 또렷해집니다.';
    ruleIds[AXES[0]]=compass.length>1?'co-held-criteria':'single-criterion';
    details[AXES[0]]=en?'These criteria were selected together; their order does not establish priority. Compare the choices you actually made.':'함께 고른 기준을 한 선택 안에서 읽었습니다. 어느 쪽이 더 중요한지는 단정하지 않고, 실제로 한 선택과 대조합니다.';
    if(has('Q6',2)||has('Q6',4))details[AXES[0]]+=en?' Your planning or caution offers a way to examine the conditions before deciding.':'계획하거나 신중히 살피는 성향은 결정 전에 필요한 조건을 확인하는 데 써 볼 수 있습니다.';
    actions[AXES[0]]=compass.length>1?(en?'Compare two real options against both criteria. Note where they agree and what each would cost; choose only after that comparison.':'실제 선택지 두 개가 두 기준을 각각 얼마나 지키는지 비교해 보세요. 함께 지킬 수 있는 점과 양보해야 할 점을 구분한 뒤 결정합니다.'):(en?'Recall a recent choice and name the principle it preserved and the cost you accepted.':'최근 선택 하나에서 지키려던 기준과 그 때문에 감수한 점을 함께 적어 보세요.');
    reflections[AXES[0]]=en?'Which criterion mattered in that situation, and why?':'그 상황에서는 어떤 기준이 더 중요했고, 왜 그랬나요?';
    var expKo=['마음에 있는 뜻을 솔직한 말로 옮겨 전해 봅니다.','말의 내용뿐 아니라 표정과 말투에도 마음이 실립니다.','말로 다 꺼내지 않은 마음도 상대에게 어떻게 닿는지 살펴봅니다.','마음을 드러내는 속도를 스스로 정하며, 전할 말을 골라 봅니다.','생각을 차근히 풀어내며, 내 뜻을 전해 봅니다.','상대가 느끼는 자리를 살피며, 내 마음을 전해 봅니다.','말로 다 담지 못한 마음을, 돌봄과 행동으로 전해 봅니다.'];
    var expEn=['You can put what you mean into honest words.','Feeling can travel through your face and tone as well as words.','You can check how an unspoken feeling reaches someone.','You can choose the pace and words with which to reveal a feeling.','You can make your meaning clear by explaining it step by step.','You can convey your feeling while attending to the other person’s experience.','You can convey through care and action what words do not fully hold.'];
    cores[AXES[1]]=express.length?(en?expEn:expKo)[express[0]]:(en?'Your expression becomes clearer when meaning reaches the other person.':'내 뜻이 상대에게 어떻게 닿는지 살피며, 나다운 표현을 찾아갑니다.');
    if(has('Q28',0)&&has('Q28',6))cores[AXES[1]]=en?'You can carry the same meaning through honest words and caring action.':'솔직한 말에 담은 마음을, 돌봄과 행동으로도 이어 갑니다.';
    else if(has('Q28',0)&&(chosen('Q33','배려')||chosen('Q33','존중')))cores[AXES[1]]=en?'You can tell the truth while considering how the other person receives it.':'뜻을 숨기지 않으면서도, 상대가 받아들일 자리를 살펴 전합니다.';
    else if(has('Q28',4)&&chosen('Q33','경청'))cores[AXES[1]]=en?'You can explain your thinking clearly while leaving room to hear another view.':'생각은 분명히 풀어내되, 다른 이야기를 들을 자리는 남겨 둡니다.';
    ruleIds[AXES[1]]='expression-in-relationship';
    details[AXES[1]]=en?'Your reported way of expressing feelings is read alongside what you value in relationships. This does not establish how others actually experience you.':'감정을 전한다고 응답한 방식과 관계에서 지키려는 것을 함께 읽었습니다. 상대가 실제로 어떻게 받아들였는지는 별도로 확인해야 합니다.';
    actions[AXES[1]]=has('Q28',6)?(en?'Convey one intention in words and one small action; ask whether both communicated the same meaning.':'전하려는 마음 하나를 말과 작은 행동으로 각각 전해 보고, 같은 뜻으로 받아들여졌는지 물어보세요.'):(en?'Share one short message, listen to how it was understood, and revise one point of difference.':'전하고 싶은 뜻을 짧게 말한 뒤 상대가 이해한 뜻을 들어 보세요. 다르게 닿은 부분 하나를 고칩니다.');
    reflections[AXES[1]]=en?'What reached the other person differently from what you intended?':'내 의도와 다르게 전해진 부분은 무엇이었나요?';
    var activityLead=['흩어진 정보를 정리하며','생각을 주고받으며','마음을 표현하고 살피며','계획을 실제로 옮기며','문제의 원인을 짚으며','생각을 눈앞의 결과물로 만들며','몸으로 부딪혀 익히며','도움이 필요한 자리에 손을 보태며','지나온 경험을 되짚으며'];
    var finish=['스스로 정한 끝을 향해 계획을 다듬어 봅니다.','결과가 어떻게 받아들여지는지 확인해 봅니다.','해결됐다고 확인할 수 있는 끝을 그려 봅니다.','다음 배움으로 이어질 계획을 세워 봅니다.','뜻 있게 마칠 수 있는 끝을 정해 봅니다.','누군가에게 실제로 도움이 되는 끝을 그려 봅니다.','이전과 달라진 점을 남길 계획을 세워 봅니다.','끝까지 시도한 흔적이 남도록 계획해 봅니다.'];
    cores[AXES[2]]=activities.length&&done!==undefined?(en?'You can give an engaging activity a clear ending, then test what it leaves.':activityLead[activities[0]]+', '+finish[done]):(en?'A plan gains direction when you can name what it should leave.':'무엇을 남기고 싶은지 그릴 때, 계획의 방향이 또렷해집니다.');
    ruleIds[AXES[2]]='activity-to-completion';
    details[AXES[2]]=en?'An activity that draws you in and a moment that feels complete are different clues. Use them together to decide what to try and what to check.':'몰입하는 활동과 성취를 느끼는 순간은 다른 단서입니다. 무엇을 해 볼지와 어디까지 하면 마쳤다고 볼지를 나누어 계획합니다.';
    if(activities.length>1)details[AXES[2]]+=en?' Compare the selected activities with the same completion criterion before choosing a first experiment.':'함께 고른 활동은 같은 완료 기준으로 비교해 본 뒤, 먼저 시험할 것을 정해 보세요.';
    actions[AXES[2]]=activities.length>1?(en?'Try a small unit of each selected activity using the same completion criterion, then choose based on what actually helped.':'함께 고른 활동을 작은 단위로 각각 해 보고, 같은 완료 기준으로 비교해 보세요. 실제로 도움이 된 쪽을 다음 계획에 반영합니다.'):(en?'Choose a small unit of the activity and one observable completion criterion; keep the result and what you would change.':'활동을 작은 단위로 정하고, 마쳤는지 확인할 기준 하나를 적어 보세요. 결과와 다음에 바꿀 점을 남깁니다.');
    reflections[AXES[2]]=en?'Did your completion criterion capture what you wanted the activity to leave?':'완료 기준에 내가 정말 남기고 싶은 것이 담겼나요?';
    cores[AXES[3]]=en?'What helps you begin and what helps you continue can be different.':'시작하게 하는 마음과, 끝까지 이어 가게 하는 조건을 함께 살핍니다.';
    if(start.indexOf(0)>=0&&stay.indexOf(3)>=0)cores[AXES[3]]=en?'Meaning can open the first step; a repeatable rhythm can carry it forward.':'의미를 느끼면 첫걸음을 떼고, 다시 할 수 있는 리듬으로 이어 갑니다.';
    else if(stay.indexOf(3)>=0||has('Q71',1))cores[AXES[3]]=en?'You can find your pace in an action small enough to repeat.':'한 번에 멀리 가기보다, 다시 해낼 수 있는 걸음에서 흐름을 찾습니다.';
    else if(stay.indexOf(5)>=0||has('Q71',3))cores[AXES[3]]=en?'An agreed step with someone else can make the next action clearer.':'함께 정한 약속이 있을 때, 다음 행동의 윤곽이 또렷해집니다.';
    else if(has('Q71',7))cores[AXES[3]]=en?'Reviewing where an attempt stopped can reveal the next step.':'멈춘 지점을 되짚으며, 다음에는 다르게 움직일 길을 찾습니다.';
    ruleIds[AXES[3]]='start-versus-maintenance';
    details[AXES[3]]=en?'Your reason for starting is not assumed to be the reason you kept going. Compare both with an actual attempt.':'시작 동기와 꾸준히 해낼 수 있었던 이유를 같은 것으로 단정하지 않습니다. 실제 시도에서 무엇이 시작을 돕고 무엇이 지속을 도왔는지 나누어 봅니다.';
    actions[AXES[3]]=has('Q71',3)?(en?'Agree on a small role and a check-in time; record what each person actually did before making the next agreement.':'작은 역할과 확인 시점을 함께 정하고, 실제로 서로 무엇을 했는지 기록한 뒤 다음 약속을 정해 보세요.'):(en?'Try one small action three times. Compare the reason you started with the conditions that helped or interrupted repetition.':'작은 행동을 세 번 시도하고, 시작한 이유와 반복을 돕거나 멈추게 한 조건을 나누어 적어 보세요.');
    reflections[AXES[3]]=en?'What helped you continue on a day when the initial motivation was weaker?':'처음의 의욕이 약한 날에도 이어 가게 한 것은 무엇이었나요?';
    var integrityScenes=['곤란한 사람을 돕는 장면','부당한 대우에 대응하는 장면','정직과 거짓 사이에서 고르는 장면','약속을 지키기 어려운 장면','책임을 피하고 싶은 장면','어려운 결정을 내리는 장면','갈등 속에서 기준을 지키는 장면'];
    if(first('Q14')!==undefined)details[AXES[0]]+=en?' Test this against the concrete situation you selected, not a general character label.':'특히 '+integrityScenes[first('Q14')]+'에서 이 기준이 어떻게 작용했는지 살펴보세요.';
    var influencesKo=['느낌이 알려 준 것과 실제로 확인한 사실을 나누어 적고, 선택한 기준과 맞는지 확인해 보세요.','계획의 전제 한 가지를 적고 실제 상황과 비교한 뒤, 결정 이유를 남겨 보세요.','받은 조언과 내가 납득한 이유를 구분하고, 내 선택 기준으로 다시 비교해 보세요.','가까운 사람의 기대와 내가 지키려는 기준을 나눠 적고, 함께 지킬 수 있는 선택을 살펴보세요.','존중하는 사람에게서 받아들인 기준과 내 경험으로 확인한 기준을 구분해 보세요.','주변의 흐름을 따른 이유와 내 기준으로 고른 이유를 나누어 적어 보세요.','서로 다른 상황의 선택 두 개를 비교하고, 그때 영향을 준 대상이 어떻게 달랐는지 적어 보세요.'];
    var influencesEn=['Separate a feeling from an observed fact, then compare both with your chosen criterion.','Write one premise in your plan and compare it with what happened before recording your decision.','Separate advice received from your own reason for accepting it, then compare options using your criterion.','Separate someone close’s expectation from your own criterion and look for an option that honors both.','Separate a borrowed standard from one you have checked in your own experience.','Separate following a surrounding trend from choosing by your own criterion.','Compare choices in two situations and note whose influence differed.'];
    if(first('Q65')!==undefined)actions[AXES[0]]=(en?influencesEn:influencesKo)[first('Q65')];
    var meaningfulTasks=['실제 문제 하나의 원인과 가능한 대응을 비교해 보세요.','짧게 설명한 뒤 상대가 이해한 뜻을 확인해 보세요.','작은 초안을 만들고 실제로 본 사람의 반응을 받아 보세요.','자료 두 개를 비교하고 판단에 쓸 기준을 적어 보세요.','전하려는 이야기와 상대가 느낀 점을 나누어 적어 보세요.','무리 없는 동작 하나를 시도하고 전후의 변화를 기록해 보세요.','도움이 필요한 사람이 원하는 것부터 확인하고 작은 도움을 제안해 보세요.','작은 과제의 역할과 순서를 정하고 실제 진행과 비교해 보세요.'];
    if(ids('Q77').length===1&&!en)actions[AXES[3]]=meaningfulTasks[first('Q77')];
    else if(ids('Q77').length>1)actions[AXES[3]]=en?'Try a small example of each meaningful activity you selected; compare whom it helped and what remained before choosing the next one.':'의미 있게 고른 활동을 작은 사례로 각각 해 보세요. 누구에게 도움이 됐고 무엇이 남았는지 비교한 뒤 다음 실행을 정합니다.';
    if(has('Q49',6)||has('Q49',7))details[AXES[2]]+=en?' Include the rest interval you selected when testing the plan.':'선택한 휴식 간격도 실행 조건에 포함해 계획을 시험해 보세요.';
    if(has('Q47',0))details[AXES[2]]+=en?' Check the plan in the quiet setting you selected.':'집중하기 편하다고 고른 조용한 환경에서 먼저 확인해 보세요.';
    var edges=ctx.observations.map(understand),experiments=ctx.observations.map(function(o,i){return experiment(o,edges[i],en);});
    var axes={},plans=[],relations=[];
    AXES.forEach(function(key,index){
      var observations=ctx.observations.filter(function(o){return o.axis===key||(key===AXES[0]&&o.parentQid==='Q63');});
      var local=experiments.filter(function(x){return x.axis===key||(key===AXES[0]&&x.parentQid==='Q63');});
      var supported=local.filter(function(x){return x.status==='supported';});
      var methods=unique(supported.map(function(x){return x.ruleId;}));
      var unresolved=local.filter(function(x){return x.status!=='supported';});
      var relevant=refs[key].concat(observations.map(function(o){return o.qid;}));
      var methodId=ruleIds[key],action=actions[key],doneWhen=en?'Keep the attempt, observed result and next adjustment.':'시도·관찰한 결과·다음에 바꿀 점을 남깁니다.',reflection=reflections[key];
      var priority=supported.find(function(x){return x.edge.kind==='stated-priority';});
      if(priority&&(key===AXES[0]||key===AXES[2])){
        var pref=priority.edge.preference;
        if(pref&&!en)cores[key]='선택의 순간, ‘'+short(pref.over,24)+'’보다 ‘'+short(pref.preferred,24)+'’에 무게를 둡니다.';
        else if(priority.ruleId==='explicit-promise-over-result')cores[key]=en?'When choosing, you put the promise you made before an immediate result.':'선택의 순간, 당장의 결과보다 지키기로 한 약속에 마음이 향합니다.';
        else if(priority.ruleId==='explicit-result-over-promise')cores[key]=en?'When choosing, you put an actual result before a previously held principle.':'선택의 순간, 지켜 온 기준보다 실제로 남길 결과에 무게를 둡니다.';
        details[key]=en?'This priority was stated directly; it is not inferred from the order of selections. Check the situations in which it applies.':'이 우선순위는 선택 순서에서 추측한 것이 아니라 직접 적어 주신 내용에 근거합니다. 어떤 상황까지 적용되는지 경험과 대조합니다.';
      }
      // Text evidence is not silently allowed to overrule other evidence.
      if(methods.length===1&&unresolved.length===0){
        var selected=supported[0],pack=EXPERIMENTS[selected.ruleId]?.[en?'en':'ko'];
        action=selected.action;doneWhen=selected.doneWhen;reflection=selected.reflection;methodId=selected.ruleId;
        if(pack){
          // Keep each axis's question distinct; an activity is not a trait or a proven skill.
          if(key===AXES[1]&&/understanding/.test(selected.ruleId)){cores[key]=pack[1];details[key]=pack[2];}
          else if(key===AXES[2]){cores[key]=pack[0];details[key]=pack[2];}
          else if(key===AXES[3]&&/repeat|coordinate/.test(selected.ruleId)){cores[key]=pack[1];details[key]=pack[2];}
          else details[key]+=(en?' A concrete way to test this is available in the action below.':' 직접 적은 방식은 아래의 작은 실행으로 확인해 볼 수 있습니다.');
        }
      }else if(methods.length>1){
        methodId='compare-supported-methods';
        action=en?'Choose the same small task and compare two of the approaches you described. Keep which conditions helped each work before choosing one.':'직접 적은 서로 다른 방식으로 같은 작은 과제를 해 보세요. 각각 도움이 된 조건을 비교한 뒤 다음에 쓸 방식을 정합니다.';
        doneWhen=en?'Keep two attempts, the different conditions and a reasoned next choice.':'두 시도·서로 다른 작동 조건·다음 선택의 이유를 남깁니다.';
        reflection=en?'Did the two approaches help in different situations?':'두 방식이 도움이 되는 상황은 어떻게 달랐나요?';
        details[key]+=en?' More than one approach was described; none is assumed to be your priority.':'서로 다른 방식을 적어 주셨으므로, 어느 하나를 우선하는 방식이라고 단정하지 않습니다.';
      }
      if(unresolved.some(function(x){return x.edge.admission==='clarification-required';})){
        cores[key]=(en?['Look at the situation before settling on a reason for a choice.','Look at the gap between what you mean and what you actually express.','Check the conditions to seek and avoid before settling on a plan.','Look at when an approach continues or stops, rather than assuming it always fits.']:['선택의 이유를 서둘러 단정하지 않고, 상황 속에서 다시 살펴봅니다.','전하려는 마음과 실제 표현 사이를, 구체적인 대화에서 살펴봅니다.','계획을 정하기 전에, 맞는 조건과 피할 조건부터 살펴봅니다.','같은 방식이 늘 맞는지보다, 언제 이어지고 멈추는지를 살펴봅니다.'])[index];
      }
      if(unresolved.length){
        // A supported priority elsewhere cannot erase unresolved ownership or scope.
        if(priority)details[key]=en?'Some evidence remains unresolved. Confirm whose view it is and where it applies before treating a priority as your own.':'아직 뜻이 확인되지 않은 근거가 있습니다. 누구의 생각이며 어디에 적용되는지 확인하기 전에는 본인의 우선순위로 단정하지 않습니다.';
        // Veto confident recommendation until negation, attribution or missing meaning is resolved.
        methodId='clarify-before-recommendation';action=unresolved[0].action;doneWhen=unresolved[0].doneWhen;reflection=unresolved[0].reflection;
        details[key]+=en?' Part of your direct input needs clarification; it has not been turned into a trait or a recommendation.':'직접입력 중 뜻을 더 확인할 부분은 성향이나 추천으로 단정하지 않았습니다.';
      }
      if(local.some(function(x){return x.edge.qualifiers.hypothetical;}))details[key]+=en?' A stated wish needs its meaning and conditions clarified; it is not an observed ability or settled choice.':'해 보고 싶은 일은 먼저 뜻과 조건을 확인할 대상이며, 이미 확인된 능력이나 선택으로 보지 않습니다.';
      if(local.some(function(x){return x.edge.qualifiers.conditional||x.edge.qualifiers.contrast;}))details[key]+=en?' Your stated conditions and exceptions must be checked before applying this.':'적어 주신 조건과 예외가 맞는 상황에서만 적용해 보세요.';
      var priorities=supported.filter(function(x){return x.edge.preference;});
      var priorityConflict=priorities.some(function(x){return priorities.some(function(y){return x.edge.preference.over===y.edge.preference.preferred&&x.edge.preference.preferred===y.edge.preference.over;});});
      if(priorityConflict){
        methodId='clarify-priority-context';
        cores[key]=en?'Different situations may call for different priorities; check the context first.':'같은 기준도 상황에 따라 달라지는지, 선택의 맥락부터 살펴봅니다.';
        action=en?'You described opposing priorities. Compare the situations in which each applies before choosing a method.':'서로 반대되는 우선순위를 적어 주셨습니다. 각각 어떤 상황에서 적용되는지 비교한 뒤 실행을 정해 보세요.';
        doneWhen=en?'Keep the two situations and the boundary for applying each priority.':'두 상황과 각각의 기준을 적용할 경계를 남깁니다.';
      }
      var relation={id:key+':'+methodId,kind:'interpretation-hypothesis',ruleId:ruleIds[key],decisionRule:methodId,evidenceRefs:unique(relevant),
        excludedClaims:['priority-from-order','causality-from-co-selection','ability-from-interest','worth-from-score'],
        principleRefs:['dignity','truth','intelligibility','information','compression','decision','benchmarks'],
        conflictRefs:priorityConflict?priorities.map(function(x){return x.qid;}):[],
        unresolvedRefs:unresolved.map(function(x){return x.qid;})};relations.push(relation);
      axes[key]={version:READER,inferenceVersion:'relations-v2',core:cores[key],detail:details[key],action:action,reflection:reflection,
        evidenceRefs:relation.evidenceRefs,relationKind:relation.kind,decisionRule:methodId,unresolvedRefs:relation.unresolvedRefs,
        directTextPolicy:'supported-relations-or-explicit-clarification',additionalEvidence:Math.max(0,observations.length-1)};
      plans.push({axis:key,title:(en?['Understand a choice','Check what reaches others','Test a small plan','Find what carries action']:['선택의 이유 확인하기','전해진 뜻 확인하기','작은 계획 시험하기','이어지는 조건 찾기'])[index],
        action:action,doneWhen:doneWhen,reflection:reflection,methodId:methodId,evidenceRefs:relation.evidenceRefs,
        principleRefs:['stewardship','decision','truth']});
    });
    // Unknown values, full spans and all co-selected evidence remain addressable.
    // No fixed person/profile ID exists; only bounded, source-linked relations and decisions.
    return {version:READER,inferenceVersion:'relations-v2',inputContractVersion:VERSION,lang:ctx.lang,axes:axes,plans:plans,
      fields:ctx.fields,observations:ctx.observations,experiments:experiments,relations:relations,semanticEdges:edges,principles:PRINCIPLES,
      coverage:{activeDirectInputs:edges.length,supported:edges.filter(function(x){return x.status==='supported';}).length,
        needsConfirmation:edges.filter(function(x){return x.status!=='supported';}).map(function(x){return x.source;})}};
  }
  function mountEvidence(model,host){
    if(typeof document==='undefined')return;
    if(!model||model.version!==READER){['lpEvidenceButton','lpEvidenceDialog'].forEach(function(id){var old=document.getElementById(id);if(old)old.remove();});return;}
    var button=document.getElementById('lpEvidenceButton'),dialog=document.getElementById('lpEvidenceDialog');
    if(!button){
      button=document.createElement('button');button.id='lpEvidenceButton';button.type='button';button.className='lb-btn';button.style.minHeight='44px';
      button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','lpEvidenceDialog');
      (host||document.querySelector('.lb-toolbar__row--view')||document.body).appendChild(button);
      dialog=document.createElement('dialog');dialog.id='lpEvidenceDialog';dialog.setAttribute('aria-labelledby','lpEvidenceTitle');
      dialog.style.cssText='max-width:760px;width:calc(100% - 40px);max-height:85vh;overflow:auto;border:1px solid #adc7be;border-radius:14px;padding:24px;color:#173e36;background:#fff;';
      document.body.appendChild(dialog);button.onclick=function(){dialog.showModal();};
    }
    var en=model.lang==='en';button.textContent=en?'Response evidence':'응답 근거';dialog.replaceChildren();
    function node(tag,value,parent){var e=document.createElement(tag);e.textContent=value;(parent||dialog).appendChild(e);return e;}
    var close=node('button',en?'Close':'닫기');close.type='button';close.style.minHeight='44px';close.onclick=function(){dialog.close();button.focus();};
    var h=node('h2',en?'Your evidence and next experiments':'응답 근거와 다음 실행 질문');h.id='lpEvidenceTitle';
    node('p',en?'Selections are not ranked. Free text is kept in its original language and connected to the question’s context, not interpreted as a hidden trait. Short report pages show only a summary.':'선택 순서는 중요도 순위가 아닙니다. 직접입력은 원문 그대로 보존하고 질문의 문맥에 연결했으며, 숨은 성향을 판정하지 않았습니다. 짧은 기본 지면에는 일부 단서만 요약됩니다.');
    Object.keys(model.fields||{}).forEach(function(id){var f=model.fields[id];if(!f.selected.length&&!f.other?.rawText)return;
      var section=node('section','');node('h3',id+' · '+(f.question||''),section);if(f.display.length)node('p',f.display.join(' · '),section);
      if(f.other&&f.other.rawText){node('p',(en?'Direct input: ':'직접입력: ')+f.other.rawText,section).style.whiteSpace='pre-wrap';node('small',(en?'State: ':'상태: ')+(en?f.other.state:({'active':'해석에 사용','active-empty':'선택했으나 빈 입력','retained-inactive':'원문 보존 · 현재 해석에서 제외','empty':'입력 없음'}[f.other.state]||f.other.state)),section);}
      (model.experiments||model.observations||[]).filter(function(x){return x.parentQid===id;}).forEach(function(o){node('p',o.action,section);if(o.doneWhen)node('p',o.doneWhen,section);if(o.status==='needs-confirmation')node('small',en?'Meaning needs confirmation; no trait has been inferred.':'의미 확인이 필요합니다. 성향이나 능력을 추정하지 않았습니다.',section);});
    });
  }
  return {VERSION:VERSION,READER:READER,active:active,context:context,compile:compile,understand:understand,principles:PRINCIPLES,mountEvidence:mountEvidence};
});
