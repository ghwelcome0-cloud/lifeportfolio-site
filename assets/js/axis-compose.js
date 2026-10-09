/* axis-compose.js — RQ-03b · 네 축 조합 생성기 (compositional generation)
 *
 * 목적: 응답 조합(≈10^37)에 비례해 다른 VII 가설·실행·완료 기준·질문을 만들되,
 *   (1) 결정적(같은 답 → 같은 문장), (2) 근거 결박(모든 빈칸은 문항 ID로 역추적),
 *   (3) 응답 밖 단정 0(자유 토큰 없음: lexicon 구절 + 틀 고정어만), (4) 길이 상한.
 * 위치: response-evidence.js의 사람 작성 결정(7규칙) **뒤**에 적용. 결정이 이미 있는 축은 건드리지 않는다.
 * 입력: questions.json · answers · axis-lexicon.json · lang. 출력: {axis:{core,detail,action,reflection,doneWhen,evidenceRefs,slots,template}}
 * 비파괴: 저장본·채점·매핑·설문 변경 없음. 순수 함수. 브라우저/Node 양용(UMD).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.AxisCompose = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var AXES = ["self_understanding", "self_expression", "self_design", "self_execution"];
  var OTHER = /기타/;
  // 축별 역할 슬롯 소스(문항). 순서 = 결정적 우선순위(앞 문항의 첫 선택지가 먼저).
  var SOURCES = {
    self_understanding: { scene: ["Q7", "Q14", "Q19"], criterion: ["Q13", "Q63", "Q33"], means: ["Q21", "Q26"], influence: ["Q65"], trait: ["Q6"] },
    self_expression:    { means: ["Q28", "Q26"], impression: ["Q31"], criterion: ["Q33"], scene: ["Q7"], influence: ["Q65"] },
    self_design:        { criterion: ["Q63", "Q13"], condition: ["Q55", "Q57", "Q49", "Q47"], means: ["Q39", "Q41"], signal: ["Q73"] },
    self_execution:     { means: ["Q71", "Q77"], condition: ["Q57", "Q49", "Q47", "Q55"], signal: ["Q73"], topic: ["Q75", "Q41"] }
  };
  // 틀: 빈칸 {role} 또는 {role2}(같은 역할의 두 번째 구절). 모든 고정어는 사람 말·단정 없음(“살핍니다/확인해 보세요”).
  // 틀 선택은 슬롯 충족 여부로 결정적: 위에서부터 채울 수 있는 첫 틀.
  var TEMPLATES = {
    self_understanding: {
      ko: [
        { need: ["scene", "criterion", "criterion2"], core: "{scene}, ‘{criterion}’과(와) ‘{criterion2}’ 가운데 무엇을 앞세우는지 살핍니다.", detail: "{scene} 나를 더 또렷이 느낀다고 답했고, 중요하게 여기는 기준으로 ‘{criterion}’·‘{criterion2}’을(를) 골랐습니다. 두 기준이 부딪힌 장면에서 실제로 무엇을 택했는지와 대조합니다.", action: "최근 {scene} 겪은 선택 하나를 떠올려, ‘{criterion}’과(와) ‘{criterion2}’ 중 어느 쪽을 지켰고 무엇을 감수했는지 두 줄로 적어 보세요.", done: "그 선택·지킨 기준·감수한 점 세 가지를 적어 두면 완료입니다.", reflection: "{scene} 어느 기준이 먼저였고, 왜 그랬나요?" },
        { need: ["scene", "criterion", "means"], core: "{scene} 드러나는 나를, ‘{criterion}’이(가) 가리키는 기준과 {means}(으)로 이어 봅니다.", detail: "{scene} 나를 더 또렷이 느낀다고 답했고, 기준으로 ‘{criterion}’을, 회복 방식으로 {means}을(를) 골랐습니다. 세 답이 같은 장면에서 함께 작동하는지 확인합니다.", action: "다음에 {scene} 느낀 것을 한 줄로 적고, 그날 ‘{criterion}’이(가) 어떻게 작용했는지 덧붙여 보세요.", done: "장면 한 줄·기준이 작용한 방식 한 줄을 적어 두면 완료입니다.", reflection: "{scene} 느낀 나와 평소의 나는 어디가 달랐나요?" },
        { need: ["criterion", "influence"], core: "선택의 순간, ‘{criterion}’을 기준으로 삼되 {influence}의 영향을 함께 살핍니다.", detail: "중요하게 여기는 기준으로 ‘{criterion}’을, 선택에 가장 영향을 주는 것으로 {influence}을(를) 골랐습니다. 둘이 같은 방향인지 다른 방향인지는 실제 선택으로만 확인됩니다.", action: "최근 선택 하나에서 ‘{criterion}’이(가) 가리킨 방향과 {influence}이(가) 가리킨 방향을 나란히 적어 보세요.", done: "두 방향과 실제로 택한 쪽을 적어 두면 완료입니다.", reflection: "둘이 달랐던 순간, 무엇이 결정을 갈랐나요?" },
        { need: ["scene", "trait"], core: "{scene}, {trait}인 나를 더 또렷이 봅니다.", detail: "{scene} 나를 더 잘 느낀다고 답했고, 스스로를 {trait}이라고 적었습니다. 그 장면에서 이 성향이 실제로 어떻게 나타나는지 확인합니다.", action: "다음에 {scene} 내가 한 행동 하나를 그대로 적어 보세요. 성향 이름 대신 행동으로 남깁니다.", done: "장면과 행동 한 줄씩 적어 두면 완료입니다.", reflection: "그 행동은 ‘{trait}’이라는 말과 얼마나 맞았나요?" }
      ],
      en: [
        { need: ["scene", "criterion", "criterion2"], core: "{Scene}, you look at which comes first for you: ‘{criterion}’ or ‘{criterion2}’.", detail: "You said you sense yourself more clearly {scene}, and chose ‘{criterion}’ and ‘{criterion2}’ as what matters most. Compare this with what you actually chose when the two collided.", action: "Recall one recent choice made {scene}. Write two lines: which of ‘{criterion}’ and ‘{criterion2}’ you kept, and what it cost.", done: "Done when the choice, the criterion you kept and the cost are written down.", reflection: "{Scene}, which criterion came first, and why?" },
        { need: ["scene", "criterion", "means"], core: "{Scene}, you connect who you are with ‘{criterion}’ and with {means}.", detail: "You sense yourself more clearly {scene}, chose ‘{criterion}’ as a standard, and {means} as how you recover. Check whether the three work together in the same situation.", action: "Next time {scene}, write one line about what you noticed and one about how ‘{criterion}’ played in.", done: "Done when one line on the situation and one on the criterion are written.", reflection: "How did you {scene} differ from your everyday self?" },
        { need: ["criterion", "influence"], core: "At the moment of choice, you keep ‘{criterion}’ as your standard while weighing {influence}.", detail: "You chose ‘{criterion}’ as what matters most and {influence} as what sways you most. Whether they point the same way is confirmed only by an actual choice.", action: "Take one recent choice and write side by side where ‘{criterion}’ pointed and where {influence} pointed.", done: "Done when both directions and the one you took are written down.", reflection: "When they differed, what decided it?" },
        { need: ["scene", "trait"], core: "{Scene}, you see {trait} more clearly in yourself.", detail: "You sense yourself more clearly {scene} and described yourself as having {trait}. Check how that tendency actually shows up there.", action: "Next time {scene}, write down one thing you actually did — as an action, not a trait word.", done: "Done when the situation and one action are written.", reflection: "How well did that action match the word ‘{trait}’?" }
      ]
    },
    self_expression: {
      ko: [
        { need: ["means", "impression", "criterion"], core: "{means}(으)로 전하고, {impression}(으)로 남으며, ‘{criterion}’을 지키려 합니다.", detail: "주변이 말하는 표현 방식으로 {means}을(를), 사람들이 받는 인상으로 {impression}을(를), 관계에서 중요한 것으로 ‘{criterion}’을 골랐습니다. 전하려는 것과 실제로 닿은 것이 같은지는 상대에게 확인해야 합니다.", action: "전하고 싶은 뜻 하나를 {means}(으)로 전한 뒤, 상대가 받은 뜻을 한 문장으로 되물어 보세요.", done: "전한 뜻·되돌아온 뜻·달랐던 한 가지를 적어 두면 완료입니다.", reflection: "‘{criterion}’을 지키려는 마음은 상대에게 어떻게 보였나요?" },
        { need: ["means", "criterion"], core: "{means}(으)로 전하되, 관계에서 ‘{criterion}’을 함께 지키려 합니다.", detail: "표현 방식으로 {means}을(를), 관계에서 중요한 것으로 ‘{criterion}’을 골랐습니다. 두 답이 한 장면에서 함께 작동하는지 확인합니다.", action: "이번 주 대화 하나에서 {means}(으)로 전한 뜻과, 그때 ‘{criterion}’을 어떻게 지켰는지 적어 보세요.", done: "전한 뜻·지킨 방식 한 줄씩 적어 두면 완료입니다.", reflection: "{means}이(가) ‘{criterion}’과(와) 부딪힌 순간이 있었나요?" },
        { need: ["impression", "scene"], core: "{scene} 사람들에게 {impression}(으)로 남는 나를 봅니다.", detail: "사람들이 받는 인상으로 {impression}을(를) 골랐고, {scene} 나를 더 또렷이 느낀다고 답했습니다. 그 장면에서 인상이 실제로 어떻게 만들어지는지 확인합니다.", action: "다음에 {scene} 내가 한 말이나 행동 하나와, 상대의 반응 하나를 함께 적어 보세요.", done: "말·행동 하나와 반응 하나를 적어 두면 완료입니다.", reflection: "그 반응은 ‘{impression}’이라는 인상과 맞았나요?" }
      ],
      en: [
        { need: ["means", "impression", "criterion"], core: "You convey feeling through {means}, come across as {impression}, and try to keep ‘{criterion}’ in relationships.", detail: "You chose {means} as how others say you express, {impression} as how people experience you, and ‘{criterion}’ as what matters in relationships. Whether what you meant is what reached them must be checked with the other person.", action: "Convey one intention through {means}, then ask the other person to say back, in one sentence, what reached them.", done: "Done when what you meant, what came back and the one difference are written.", reflection: "How did your care for ‘{criterion}’ look from their side?" },
        { need: ["means", "criterion"], core: "You convey through {means}, while keeping ‘{criterion}’ in the relationship.", detail: "You chose {means} as your way of expressing and ‘{criterion}’ as what matters in relationships. Check whether both work together in one situation.", action: "In one conversation this week, note what you conveyed through {means} and how you kept ‘{criterion}’.", done: "Done when one line on what you conveyed and one on how you kept it are written.", reflection: "Was there a moment {means} collided with ‘{criterion}’?" },
        { need: ["impression", "scene"], core: "{Scene}, you see yourself coming across as {impression}.", detail: "You chose {impression} as how people experience you and said you sense yourself more clearly {scene}. Check how that impression is actually formed there.", action: "Next time {scene}, write one thing you said or did and one reaction you saw.", done: "Done when one action and one reaction are written.", reflection: "Did that reaction match ‘{impression}’?" }
      ]
    },
    self_design: {
      ko: [
        { need: ["criterion", "condition", "signal"], core: "‘{criterion}’을 기준으로 고르고, {condition} 움직이며, {signal} 마쳤다고 느낍니다.", detail: "선택 기준으로 ‘{criterion}’을, 의욕이 생기는 조건으로 {condition}을(를), 성취를 느끼는 순간으로 {signal}을(를) 골랐습니다. 계획의 시작·과정·끝에 해당하는 세 답이 한 계획 안에서 맞물리는지 확인합니다.", action: "이번 주 작은 계획 하나를 ‘{criterion}’(으)로 고르고, {condition} 시작해 보세요. 끝은 {signal}(으)로 정합니다.", done: "고른 이유·시작한 조건·끝났다고 본 순간을 적어 두면 완료입니다.", reflection: "{signal} 느낀 끝은, 처음 ‘{criterion}’(으)로 고른 이유와 이어졌나요?" },
        { need: ["criterion", "means", "condition"], core: "‘{criterion}’을 기준으로, {means}에 {condition} 몰입합니다.", detail: "선택 기준으로 ‘{criterion}’을, 쉽게 몰입하는 활동으로 {means}을(를), 의욕이 생기는 조건으로 {condition}을(를) 골랐습니다. 이 셋이 겹치는 자리가 계획을 세우기 가장 좋은 자리입니다.", action: "{means}을(를) 작은 단위로 하나 정해 {condition} 해 보고, ‘{criterion}’에 비추어 남길 가치가 있었는지 적어 보세요.", done: "한 단위·조건·기준에 비춘 판단을 적어 두면 완료입니다.", reflection: "‘{condition}’라는 조건이 없었다면 같은 활동을 골랐을까요?" },
        { need: ["criterion", "criterion2"], core: "‘{criterion}’과(와) ‘{criterion2}’ 사이에서, 계획의 끝에 무엇을 남길지 정합니다.", detail: "선택 기준으로 ‘{criterion}’과(와) ‘{criterion2}’를 함께 골랐습니다. 어느 쪽이 더 중요한지는 선택 순서로 정하지 않고, 실제 계획에서 무엇을 남겼는지로 확인합니다.", action: "작은 계획 하나를 두 기준으로 각각 평가해 보고, 둘 다 만족한 점과 하나만 만족한 점을 나눠 적어 보세요.", done: "두 기준별 평가와 실제 결정을 적어 두면 완료입니다.", reflection: "둘 중 하나를 내려놓아야 했던 순간은 언제였나요?" }
      ],
      en: [
        { need: ["criterion", "condition", "signal"], core: "You choose by ‘{criterion}’, get moving {condition}, and feel finished {signal}.", detail: "You chose ‘{criterion}’ as your standard, {condition} as what gets you moving, and {signal} as when you feel achievement. Check whether these three — start, course and end — fit inside one plan.", action: "Pick one small plan this week by ‘{criterion}’ and start it {condition}. Define its end as {signal}.", done: "Done when the reason you chose it, the condition you started under and the moment you called it finished are written.", reflection: "Did the end you felt {signal} connect back to why you chose it by ‘{criterion}’?" },
        { need: ["criterion", "means", "condition"], core: "By ‘{criterion}’, you immerse in {means} {condition}.", detail: "You chose ‘{criterion}’ as your standard, {means} as what you immerse in easily, and {condition} as what motivates you. Where these three overlap is the best place to plan.", action: "Set one small unit of {means}, do it {condition}, and note whether it was worth keeping by ‘{criterion}’.", done: "Done when the unit, the condition and your judgment by the criterion are written.", reflection: "Would you have chosen the same activity if it were not {condition}?" },
        { need: ["criterion", "criterion2"], core: "Between ‘{criterion}’ and ‘{criterion2}’, you decide what a plan should leave behind.", detail: "You chose both ‘{criterion}’ and ‘{criterion2}’ as standards. Which matters more is not decided by selection order; it is confirmed by what an actual plan left behind.", action: "Evaluate one small plan by each criterion. Separate what satisfied both from what satisfied only one.", done: "Done when both evaluations and the actual decision are written.", reflection: "When did you have to set one of them down?" }
      ]
    },
    self_execution: {
      ko: [
        { need: ["means", "condition", "signal"], core: "{means}(으)로 시작해, {condition} 이어 가고, {signal} 마칩니다.", detail: "목표를 이루는 방식으로 {means}을(를), 꾸준히 해낸 이유로 {condition}을(를), 성취를 느끼는 순간으로 {signal}을(를) 골랐습니다. 시작·지속·마침의 세 답이 실제 한 번의 실행에서 그대로 작동하는지 확인합니다.", action: "작은 행동 하나를 {means}(으)로 시작해 세 번 반복해 보세요. {condition} 이어졌는지, {signal} 마쳤는지 기록합니다.", done: "세 번의 시도와 이어 간 조건·마친 순간을 적어 두면 완료입니다.", reflection: "‘{condition}’라는 조건이 없던 날에는 무엇이 이어 가게 했나요?" },
        { need: ["means", "condition"], core: "{means}(으)로 시작하고, {condition} 이어 갑니다.", detail: "목표를 이루는 방식으로 {means}을(를), 꾸준히 해낸 이유로 {condition}을(를) 골랐습니다. 시작 방식과 지속 조건이 실제로 맞물리는지 확인합니다.", action: "작은 행동 하나를 {means}(으)로 시작해 세 번 반복하고, {condition} 이어졌는지 날마다 한 줄 적어 보세요.", done: "세 번의 기록을 적어 두면 완료입니다.", reflection: "세 번 중 이어 가기 가장 어려웠던 날의 조건은 무엇이었나요?" },
        { need: ["means", "topic"], core: "{topic} 분야에서, {means}(으)로 작은 결과를 만들어 봅니다.", detail: "관심 분야로 {topic}을(를), 목표를 이루는 방식으로 {means}을(를) 골랐습니다. 관심이 실행으로 이어지는지는 작은 결과 하나로 확인합니다.", action: "{topic}에서 한 시간 안에 끝낼 수 있는 일 하나를 {means}(으)로 해 보고, 남은 결과를 적어 보세요.", done: "한 시간 안의 결과 하나를 적어 두면 완료입니다.", reflection: "결과가 남은 뒤, {topic}에 대한 관심은 어떻게 달라졌나요?" }
      ],
      en: [
        { need: ["means", "condition", "signal"], core: "You start by {means}, keep going {condition}, and finish {signal}.", detail: "You chose {means} as how you reach goals, {condition} as why you kept going, and {signal} as when you feel achievement. Check whether start, continuation and finish work as one in a real attempt.", action: "Start one small action by {means} and repeat it three times. Record whether it continued {condition} and whether it ended {signal}.", done: "Done when three attempts, the condition that carried them and the finishing moment are written.", reflection: "On a day it was not {condition}, what kept it going?" },
        { need: ["means", "condition"], core: "You start by {means} and keep going {condition}.", detail: "You chose {means} as how you reach goals and {condition} as why you kept going. Check whether the way you start and the condition that sustains you actually mesh.", action: "Start one small action by {means}, repeat it three times, and write one line a day on whether it continued {condition}.", done: "Done when three records are written.", reflection: "Of the three, which day was hardest to continue, and under what condition?" },
        { need: ["means", "topic"], core: "In {topic}, you make one small result by {means}.", detail: "You chose {topic} as an interest and {means} as how you reach goals. Whether interest turns into action is confirmed by one small result.", action: "In {topic}, do one thing you can finish within an hour by {means}, and write down what remained.", done: "Done when one result within an hour is written.", reflection: "After a result remained, how did your interest in {topic} change?" }
      ]
    }
  };
  var LIMIT = { ko: 76, en: 170 }; // core 길이 상한(문자). 초과 시 더 짧은 틀로 결정적 후퇴.

  function arr(v) { return Array.isArray(v) ? v : (v == null || v === "" ? [] : [v]); }
  function indexQuestions(questions) {
    var map = {};
    (questions.sections || []).forEach(function (s) { (s.questions || []).forEach(function (q) { map[q.id] = q; }); });
    return map;
  }
  // 응답 → 역할별 구절 목록(결정적 순서: SOURCES 문항 순 → 선택지 index 순). 기타·미등록 값은 건너뜀(단정 금지).
  function collect(axis, qmap, answers, lexicon, lang) {
    var out = {}, refs = {}, src = SOURCES[axis];
    Object.keys(src).forEach(function (role) {
      out[role] = []; refs[role] = [];
      src[role].forEach(function (qid) {
        var q = qmap[qid], lx = lexicon.questions[qid]; if (!q || !lx) return;
        var opts = q.options.filter(function (o) { return !OTHER.test(o); });
        var selected = arr(answers[qid]).filter(function (v) { return typeof v === "string"; });
        selected.map(function (v) { return opts.indexOf(v); }).filter(function (i) { return i >= 0; }).sort(function (a, b) { return a - b; })
          .forEach(function (i) { var phrase = lx[lang][i]; if (phrase && out[role].indexOf(phrase) < 0) { out[role].push(phrase); refs[role].push(qid); } });
      });
    });
    return { slots: out, refs: refs };
  }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function fill(text, slots) {
    return text.replace(/\{(\w+?)(2?)\}/g, function (_, role, second) {
      var isCap = role.charAt(0) === role.charAt(0).toUpperCase() && role !== role.toUpperCase();
      var key = role.toLowerCase(), v = slots[key] ? slots[key][second ? 1 : 0] : null;
      if (v == null) return _;
      return isCap ? cap(v) : v;
    });
  }
  // 한국어 조사: (으)로 / 을(를) / 이(가) — 받침 유무로 결정적 선택.
  // 한국어 조사 결정: 조사 바로 앞 글자(닫는 따옴표 ’ 는 건너뜀)의 받침으로 (으)로·을(를)·이(가)·과(와)를 고른다.
  function particles(s) {
    var FORMS = { "(으)로": ["으로", "로"], "을(를)": ["을", "를"], "이(가)": ["이", "가"], "과(와)": ["과", "와"] };
    return s.replace(/([가-힣A-Za-z0-9])(’?)(\(으\)로|을\(를\)|이\(가\)|과\(와\))/g, function (_, ch, q, form) {
      var c = ch.charCodeAt(0), pair = FORMS[form], hangul = c >= 0xAC00 && c <= 0xD7A3;
      var final = hangul ? (c - 0xAC00) % 28 : 0;
      var withFinal = hangul ? final !== 0 && !(form === "(으)로" && final === 8) : false;
      return ch + q + (withFinal ? pair[0] : pair[1]);
    });
  }
  function satisfied(need, slots) {
    return need.every(function (n) { var second = /2$/.test(n), role = n.replace(/2$/, ""); return slots[role] && slots[role].length >= (second ? 2 : 1); });
  }
  function composeAxis(axis, qmap, answers, lexicon, lang) {
    var c = collect(axis, qmap, answers, lexicon, lang), tpls = TEMPLATES[axis][lang];
    for (var t = 0; t < tpls.length; t++) {
      var tpl = tpls[t]; if (!satisfied(tpl.need, c.slots)) continue;
      var core = fill(tpl.core, c.slots); if (lang === "ko") core = particles(core);
      if (core.length > LIMIT[lang]) continue; // 길이 상한 → 다음(더 짧은) 틀
      var used = {}, refs = [];
      tpl.need.forEach(function (n) { var role = n.replace(/2$/, ""), idx = /2$/.test(n) ? 1 : 0; var ref = c.refs[role][idx]; if (ref && !used[ref]) { used[ref] = true; refs.push(ref); } });
      var mk = function (s) { var v = fill(s, c.slots); return lang === "ko" ? particles(v) : v; };
      return { axis: axis, lang: lang, template: t, core: core, detail: mk(tpl.detail), action: mk(tpl.action), doneWhen: mk(tpl.done), reflection: mk(tpl.reflection),
        evidenceRefs: refs, slots: tpl.need.map(function (n) { var role = n.replace(/2$/, ""), idx = /2$/.test(n) ? 1 : 0; return { role: role, value: c.slots[role][idx], qid: c.refs[role][idx] }; }),
        rule: "compose:" + axis + ":" + t, kind: "composed-hypothesis" };
    }
    return null;
  }
  /* 공개 API. existingDecisions: response-evidence의 decisions 배열(있는 축은 건너뜀). */
  function compose(input) {
    if (!input || !input.questions || !input.answers || !input.lexicon) throw new Error("AxisCompose requires questions, answers and lexicon");
    if (input.lexicon.version !== "axis-lexicon-v1") throw new Error("Unsupported lexicon version");
    var lang = input.lang === "en" ? "en" : "ko", qmap = indexQuestions(input.questions), decided = {};
    (input.existingDecisions || []).forEach(function (d) { if (d && d.axis) decided[d.axis] = true; });
    var out = { version: "axis-compose-v1", lexiconVersion: input.lexicon.version, lang: lang, axes: {}, composed: [], skipped: [] };
    AXES.forEach(function (axis) {
      if (decided[axis]) { out.skipped.push({ axis: axis, reason: "authored-decision-present" }); return; }
      var r = composeAxis(axis, qmap, input.answers, input.lexicon, lang);
      if (r) { out.axes[axis] = r; out.composed.push(axis); } else out.skipped.push({ axis: axis, reason: "insufficient-slots" });
    });
    return out;
  }
  return { compose: compose, AXES: AXES, SOURCES: SOURCES, TEMPLATES: TEMPLATES, LIMIT: LIMIT, _particles: particles };
});
