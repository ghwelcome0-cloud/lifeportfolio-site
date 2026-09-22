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
  var LABELS={
    Q6:['조용함','열정','계획성','창의성','신중함','따뜻함','현실 감각','도전','공감','분석','여유','성취 지향'],
    Q63:['의미','안정','배움','자율','관계','성과','흥미','신념','책임'],
    Q28:['솔직한 말','표정과 말투','말 밖의 감정','감정을 숨기는 방식','논리적인 설명','공감하는 표현','돌봄과 행동'],
    Q39:['정보 탐색과 정리','아이디어 교환','감정 표현과 공감','계획과 실행','분석과 해결','창작','신체 활동','돌봄과 기여','성찰'],
    Q73:['정한 목표','타인의 반응','해결된 결과','배움','의미 있는 마무리','누군가에게 준 도움','이전과의 변화','끝까지 한 시도'],
    Q55:['의미','기여','목표와 경쟁','재미','배움','보상과 성취','기대와 인정','루틴 유지'],
    Q57:['뚜렷한 목표','책임','즐거움','루틴','스스로 정한 규칙','응원','성과와 보상','자신과의 약속'],
    Q71:['구체적인 계획','반복과 습관','자원 활용','협력','기한','긴 흐름 설계','집중','실패 복기']
  };
  var LABELS_EN={
    Q6:['quietness','enthusiasm','planning','creativity','care','warmth','practicality','challenge','empathy','analysis','ease','achievement'],
    Q63:['meaning','stability','learning','autonomy','relationships','results','interest','beliefs','responsibility'],
    Q28:['honest words','face and tone','unspoken feelings','concealed feelings','logical explanations','empathetic expression','care and action'],
    Q39:['finding and organizing information','exchanging ideas','expression and empathy','planning and doing','analysis and solutions','creating','physical activity','care and contribution','reflection'],
    Q73:['your goal','others’ responses','a solved problem','learning','meaningful completion','help given','change from before','a completed attempt'],
    Q55:['meaning','contribution','goals and competition','enjoyment','learning','reward','recognition','routine'],
    Q57:['a clear goal','responsibility','enjoyment','routine','your own rules','encouragement','results and reward','a promise to yourself'],
    Q71:['planning','repetition','resources','cooperation','a deadline','longer-term design','concentration','reviewing setbacks']
  };
  function compile(ctx,questions){
    var en=ctx.lang==='en',qs={};(questions.sections||[]).forEach(function(s){(s.questions||[]).forEach(function(q){qs[q.id]=q;});});
    function labels(id){var f=ctx.fields[id],lib=(en?LABELS_EN:LABELS)[id];return f?f.selected.map(function(v,i){var idx=(qs[id].options||[]).indexOf(v);return lib&&idx>=0?lib[idx]:short(f.display[i],20);}):[];}
    function phrase(id,max){return labels(id).slice(0,max||3).join(en?' + ':'·');}
    function value(id){return phrase(id)|| (en?'a criterion to explore':'확인해 갈 기준');}
    function quote(id){var f=ctx.fields[id];return f&&f.display.length?f.display.map(function(s){return '“'+short(s,36)+'”';}).join(en?' and ':' · '):'';}
    var defs=[
      {key:AXES[0],refs:['Q6','Q7','Q13','Q14','Q19','Q21','Q26','Q63','Q65'],core:en?'You consider '+value('Q63')+' through '+value('Q6')+'.':value('Q6')+'의 모습에서, '+value('Q63')+'의 기준을 살핍니다.',
       detail:en?'Your selected traits and decision criteria are read together, without ranking them.':'함께 고른 성향과 선택 기준을 연결한 해석입니다. 선택 순서로 중요도를 정하지 않았습니다.',
       action:en?'Compare two recent choices using '+value('Q63')+'; record where those criteria agreed or differed.':'최근 선택 두 개를 '+value('Q63')+'의 기준으로 비교하고, 함께 지켜진 점과 달랐던 점을 적어 보세요.',
       reflection:en?'When did these criteria lead you in different directions?':'이 기준들이 서로 다른 선택을 가리켰던 때는 언제였나요?'},
      {key:AXES[1],refs:['Q28','Q31','Q33'],core:en?'You connect '+value('Q28')+' with '+value('Q33')+'.':value('Q28')+'에, '+value('Q33')+'의 관계 기준을 연결합니다.',
       detail:en?'How you report expressing feelings is considered alongside what you value in relationships; this is not a test of communication ability.':'감정을 전한다고 응답한 방식과 관계에서 중요하게 고른 요소를 함께 봅니다. 전달 능력이 검증됐다는 뜻은 아닙니다.',
       action:en?'Use '+value('Q28')+' for a short message, then ask whether '+value('Q33')+' came through.':value('Q28')+'의 방식으로 짧게 전한 뒤, '+value('Q33')+'의 뜻이 전해졌는지 확인해 보세요.',
       reflection:en?'What did the other person understand differently?':'내가 전하려던 뜻과 상대가 이해한 뜻은 어떻게 달랐나요?'},
      {key:AXES[2],refs:['Q39','Q41','Q47','Q49','Q55','Q57','Q63','Q73'],core:en?'You can shape '+value('Q39')+' toward '+value('Q73')+'.':value('Q39')+'의 활동을, '+value('Q73')+'의 결과로 설계해 봅니다.',
       detail:en?'This connects engaging activities to your stated achievement cue. A plan is a proposal, not a prediction of success.':'몰입하는 활동과 성취를 느끼는 기준을 연결한 설계 제안입니다. 결과나 성공을 보장하는 해석은 아닙니다.',
       action:en?'Try a small unit of '+value('Q39')+' and define how you will check '+value('Q73')+'.':value('Q39')+' 중 작은 활동 하나를 정하고, '+value('Q73')+'을 어떻게 확인할지 적어 보세요.',
       reflection:en?'Which place and rhythm would make that attempt manageable?':'어떤 장소와 리듬에서 이 시도를 무리 없이 할 수 있을까요?'},
      {key:AXES[3],refs:['Q55','Q57','Q71','Q73','Q75','Q77'],core:en?'You connect '+value('Q55')+' as a start with '+value('Q57')+' to continue.':value('Q55')+'로 시작하고, '+value('Q57')+'의 조건으로 이어 가 봅니다.',
       detail:(en?'Your stated way of pursuing a goal: ':'목표를 이루는 방식으로 고른 단서: ')+value('Q71')+(en?'. These are self-reported conditions to test, not proven causes.':'. 시작과 지속의 조건을 구분해 확인하는 제안이며, 인과관계가 검증됐다는 뜻은 아닙니다.'),
       action:en?'Use '+value('Q71')+' for one step; record whether '+value('Q57')+' helped you continue.':value('Q71')+'의 방식으로 한 단계를 실행하고, '+value('Q57')+'의 조건이 지속에 도움이 됐는지 남겨 보세요.',
       reflection:en?'What helped you start, and what actually helped you continue?':'시작하게 한 이유와 실제로 이어 가게 한 이유는 같았나요?'}
    ];
    var axes={},plans=[];
    defs.forEach(function(d){
      var observations=ctx.observations.filter(function(o){return o.axis===d.key;}),refs=d.refs.filter(function(id){var f=ctx.fields[id];return f&&(f.selected.length||f.other&&f.other.state==='active');});
      var supportIds={self_understanding:['Q14','Q65'],self_expression:['Q31'],self_design:['Q47','Q49'],self_execution:['Q75','Q77']}[d.key];
      var support=supportIds.map(function(id){var f=ctx.fields[id];return f&&f.display.length?ROLES[id][en?2:1]+': “'+short(f.display.join(' · '),en?38:26)+'”':'';}).filter(Boolean).join(' · ');
      if(support)d.detail+=' '+support;
      var missing=refs.length===0;
      if (observations.length) {
        var rel = [value('Q63'),value('Q33'),value('Q73'),value('Q71')][AXES.indexOf(d.key)];
        d.core = en ? 'Your “'+short(observations[0].rawText,42)+'” is a clue to explore with '+rel+'.' : '직접 적은 ‘'+short(observations[0].rawText,28)+'’에서, '+rel+'의 연결을 살펴봅니다.';
      }
      var preview=observations.slice(0,2).map(function(o){return o.label+': “'+short(o.rawText,30)+'”';}).join(' · ');
      axes[d.key]={version:READER,core:missing?(en?'Start with one concrete experience.':'구체적인 경험 하나에서 나를 살펴봅니다.'):short(d.core,en?170:100),detail:d.detail+(preview?' '+(en?'In your words — ':'직접 적은 단서 — ')+preview:'')+(observations.length>2?(en?' More entries are available under Response evidence.':' 다른 직접입력은 ‘응답 근거’에서 함께 확인하세요.'):''),
        action:observations.length?observations[0].action:d.action,reflection:d.reflection,evidenceRefs:refs.concat(observations.map(function(o){return o.qid;})),
        relationKind:'co-selected-not-ranked',directTextPolicy:'context-only',additionalEvidence:Math.max(0,observations.length-2)};
      plans.push({axis:d.key,title:en?['Understand','Express','Design','Do'][AXES.indexOf(d.key)]:['나를 이해하기','뜻을 전하기','작은 계획 만들기','실제로 이어 가기'][AXES.indexOf(d.key)],
        action:axes[d.key].action,doneWhen:en?'Keep the attempt, observed result and next adjustment.':'시도·관찰한 결과·다음에 바꿀 점을 기록합니다.',evidenceRefs:axes[d.key].evidenceRefs});
    });
    // Full selected options and raw direct text remain in fields/observations; summaries disclose their limits.
    return {version:READER,inputContractVersion:VERSION,lang:ctx.lang,axes:axes,plans:plans,fields:ctx.fields,observations:ctx.observations,experiments:ctx.experiments};
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
      if(f.other&&f.other.rawText){node('p',(en?'Direct input: ':'직접입력: ')+f.other.rawText,section).style.whiteSpace='pre-wrap';node('small',(en?'State: ':'상태: ')+f.other.state,section);}
      (model.experiments||model.observations||[]).filter(function(x){return x.parentQid===id;}).forEach(function(o){node('p',o.action,section);if(o.doneWhen)node('p',o.doneWhen,section);});
    });
  }
  return {VERSION:VERSION,READER:READER,active:active,context:context,compile:compile,mountEvidence:mountEvidence};
});
