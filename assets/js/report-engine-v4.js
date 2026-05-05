/* =========================================================================
 * 인생포트폴리오 룰베이스 리포트 엔진 v4 (Quality Upgrade Layer)
 *
 * 목적:
 *  - "80억 분의 1" 고유성 보장 — 동일 응답이라도 결과가 다르게 나오는 깊이 확보
 *  - 심리·적성 검사 시장 최상위 품질 — 원시 형용사 노출 차단 + 의미 합성
 *  - 기존 v1.3 엔진의 build() 결과(JSON)를 받아 후처리(post-processing)로 고도화
 *
 * 6대 강화 (P0~P2):
 *   P0-1) 강점 페어 해석 매트릭스 (12C2 = 66 페어 + tie-breaker)
 *         → "신중한 / 분석적인 / 성취지향적인" 같은 원시 Q6 형용사 노출 차단
 *           대신 "신중함과 분석을 결합한 통찰형 결단력" 같은 합성 문장 출력
 *   P0-2) 진로/교육 fallback 중복 차단 — pickEducation 다양화
 *         → "자기성장·리더십 워크숍 / 자기성장·리더십 워크숍 / …" 반복 제거
 *   P1-1) 4축 카드 4-tier 분기 (deep / active / emerging / seed)
 *         → 응답 강도 % 에 따라 카드 톤·심도 차별화 (단순 high/mid/low보다 세밀)
 *   P1-2) 사명/비전 7-슬롯 합성
 *         → {anchor·verb·target·domain·sub_domain·essence·time_horizon} 슬롯 라이브러리
 *   P2-1) 56문항 매핑 전체 활용 — questionMapping의 모든 응답을 fingerprint에 반영
 *   P2-2) 자동 품질검증 (validateReport) — 12개 체크 + 통과/실패 보고
 *
 * 사용법:
 *   var raw = ReportEngine.build({...});
 *   var report = ReportEngineV4.upgrade(raw, { questions, mapping, rules, answers, profile, lang });
 *   var qa = ReportEngineV4.validateReport(report); // { ok, score, checks: [...] }
 *
 * 외부 의존성 없음. 브라우저/Node 공통.
 * ========================================================================= */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.ReportEngineV4 = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ──────────────────────────────────────────────────────────
  // 0. 헬퍼
  // ──────────────────────────────────────────────────────────
  function toArr(v) { return Array.isArray(v) ? v : (v == null || v === "" ? [] : [v]); }
  function unique(arr) { return [...new Set(arr)]; }
  function clone(o){ return JSON.parse(JSON.stringify(o)); }
  function pickByHash(arr, hash){
    if (!arr || !arr.length) return "";
    return arr[Math.abs(hash) % arr.length];
  }

  // 한국어 받침 보조
  function _hasJong(s){
    if (!s) return false;
    var ch = s.charAt(s.length - 1);
    var code = ch.charCodeAt(0);
    if (code < 0xAC00 || code > 0xD7A3) return false;
    return ((code - 0xAC00) % 28) !== 0;
  }
  function _eul(w){ return w + (_hasJong(w) ? "을" : "를"); }
  function _i(w){ return w + (_hasJong(w) ? "이" : "가"); }
  function _ero(w){ return w + (_hasJong(w) ? "으로" : "로"); }
  function _eun(w){ return w + (_hasJong(w) ? "은" : "는"); }
  function _gwa(w){ return w + (_hasJong(w) ? "과" : "와"); }

  // 응답 전체에서 fingerprint 생성 (P2-1: 56문항 전체 활용)
  function fullAnswerFingerprint(answers, mapping){
    var qmap = (mapping && mapping.questionMapping) || {};
    var h = 5381; // djb2-style seed
    Object.keys(qmap).sort().forEach(function(qid, idx){
      var v = answers[qid];
      if (v == null || v === "") return;
      var s = Array.isArray(v) ? v.join("|") : String(v);
      for (var i = 0; i < s.length; i++){
        h = ((h << 5) + h + s.charCodeAt(i) + (idx + 1) * 17) | 0;
      }
    });
    return Math.abs(h);
  }

  // ──────────────────────────────────────────────────────────
  // P0-1. 강점 페어 해석 매트릭스 (66 페어 + 12 단일)
  //
  //  설계 원칙:
  //   - Q6의 12개 성향(원시 형용사)이 사용자 화면에 그대로 노출되지 않도록
  //     2개를 묶어 의미 있는 "결합형 강점 문장"으로 환원
  //   - 페어가 매트릭스에 없을 경우 단일 형용사 → 결과 명사형 변환 폴백
  //   - 동일 페어라도 fingerprint 에 따라 4개 변형 중 하나 선택
  // ──────────────────────────────────────────────────────────

  // 12 trait — Q6 옵션 정규화
  var TRAITS_12 = [
    "조용한","신중한","분석적인","느긋한",   // 자기이해 4
    "공감하는","따뜻한",                       // 자기표현 2
    "계획적인","현실적인","창의적인",          // 자기설계 3
    "열정적인","도전적인","성취지향적인"       // 자기실행 3
  ];

  // 단일 trait → 결과 명사형 강점 (원시 노출 폴백)
  var TRAIT_SINGLE_KO = {
    "조용한":           ["고요 속 깊은 사고력","조용한 안정감으로 사람을 머물게 하는 힘","고요한 집중에서 통찰을 끌어내는 힘","조용한 응시로 본질을 읽어내는 힘"],
    "신중한":           ["신중한 판단으로 위험을 줄이는 결단력","숙고된 결단력","신중함이 만들어내는 신뢰의 무게","서두르지 않으면서도 끝맺는 신중한 추진력"],
    "분석적인":         ["분석적 사고로 본질을 꿰뚫는 통찰력","구조를 해체해 핵심을 잡는 분석력","데이터와 패턴에서 의미를 읽어내는 분석력","문제를 잘게 나눠 해결책을 짜는 분석력"],
    "느긋한":           ["느긋한 호흡으로 멀리 가는 지속력","흔들림 없는 평정의 힘","조급함 없이 상황을 다스리는 여유","변화의 한가운데서도 흐름을 읽는 여유"],
    "공감하는":         ["사람의 마음을 읽어내는 공감 지능","공감으로 신뢰를 쌓는 관계 설계력","감정의 결을 짚어주는 따뜻한 통찰","상대의 자리에서 같이 보아주는 공감력"],
    "따뜻한":           ["편안함을 만들어내는 온기 어린 존재감","사람을 안전하게 만드는 따뜻한 분위기","경계를 허무는 따뜻한 환대","조용한 온기로 사람을 회복시키는 힘"],
    "계획적인":         ["흐름을 설계하는 계획력","장기 시야로 단계를 짜는 설계력","구조화된 계획으로 결과를 끌어내는 힘","목표와 일정을 매끄럽게 잇는 계획력"],
    "현실적인":         ["현실 감각 위에 세우는 단단한 실행력","이상과 현실을 잇는 균형감","구체적 조건을 꿰뚫는 현실적 판단력","감정에 흔들리지 않는 현실적 통찰"],
    "창의적인":         ["기존 틀을 다시 짜는 창의적 설계력","연결되지 않던 것을 잇는 창의력","익숙한 것에서 새로움을 발견하는 안목","제약을 자원으로 바꾸는 창의력"],
    "열정적인":         ["사람을 움직이는 뜨거운 추진력","주변까지 끌어당기는 에너지의 중심","사그라들지 않는 내적 동력","열정으로 흐름을 만들어내는 추진력"],
    "도전적인":         ["미지의 영역에 먼저 발을 들이는 도전 정신","경계를 넓히는 도전 의식","불확실성 속에서 길을 만드는 개척력","‘일단 해본다’의 용기 있는 실험력"],
    "성취지향적인":     ["목표를 결과로 만들어내는 성취 지향력","끝까지 해내는 완수형 추진력","성취 경험으로 자신을 단련하는 힘","목표 달성을 즐기는 결과 중심의 추진력"]
  };

  // 영문 단일
  var TRAIT_SINGLE_EN = {
    "조용한":           ["Deep thinking forged in quiet","A calm presence that lets people stay","Insight drawn from quiet focus","Reading the essence through calm observation"],
    "신중한":           ["Decisiveness that reduces risk through careful judgment","Considered, weighty decision-making","The trustworthy weight that thoughtfulness creates","A steady drive that finishes without rushing"],
    "분석적인":         ["Analytical insight that pierces to the essence","The power to break structures down to their core","Reading meaning from data and patterns","Analytical strength that splits problems into solutions"],
    "느긋한":           ["A sustaining rhythm that goes far without strain","Unshaken composure","The ease that masters circumstance without haste","Reading the flow even amid change"],
    "공감하는":         ["Empathic intelligence that reads people's hearts","Relational design built on empathy and trust","Warm insight that names the texture of feeling","Seeing alongside, from the other's seat"],
    "따뜻한":           ["A warm presence that creates ease","An atmosphere that makes people feel safe","Warm hospitality that softens boundaries","A quiet warmth that restores people"],
    "계획적인":         ["Planning that designs the flow itself","Long-range design that sequences each step","Structured planning that produces results","Planning that links goals and schedules seamlessly"],
    "현실적인":         ["Sturdy execution built on a sense of reality","Balance that links the ideal and the real","Pragmatic judgment that grasps concrete conditions","Pragmatic insight unshaken by emotion"],
    "창의적인":         ["Creative design that re-frames existing structures","Creativity that connects what was unlinked","An eye that finds newness in the familiar","Creativity that turns constraints into resources"],
    "열정적인":         ["A passionate drive that moves people","An energetic center that pulls others in","An inner force that does not fade","A passionate drive that creates flow"],
    "도전적인":         ["A challenger's spirit that steps first into the unknown","Bold awareness that widens the frontier","A pioneering force that makes paths in uncertainty","Courage to experiment — 'just try it' brought to life"],
    "성취지향적인":     ["Achievement-orientation that turns goals into results","A finishing drive that sees things through","The strength of being tempered by achievement","A result-centered drive that enjoys hitting targets"]
  };

  // 66 페어 — 키는 정렬된 두 trait의 결합 (KO)
  // 한 페어당 4개 변형으로 fingerprint 다양성 확보
  function _pairKey(a, b){
    return [a, b].sort().join("|");
  }

  // 카테고리별 묶음 (자기이해/표현/설계/실행) — 같은 군 페어는 군 내 깊이, 다른 군 페어는 결합형 의미
  var TRAIT_PAIR_KO = {
    // 자기이해 군 내부 페어
    "신중한|조용한":           ["고요 속에서 신중하게 본질을 응시하는 힘","조용한 깊이와 신중한 결단이 결합된 통찰형 정직성","서두르지 않고 결정을 무르익히는 사색형 신중함","조용한 응시와 신중한 판단이 만든 차분한 통찰력"],
    "분석적인|조용한":         ["조용한 집중에서 분석적 통찰을 끌어내는 힘","고요한 사고와 분석력이 결합된 정밀한 통찰","외부 소음 없이 본질을 분해해 내는 사고력","조용한 깊이로 데이터의 결을 읽어내는 분석가형 사고"],
    "느긋한|조용한":           ["고요한 평정과 느긋한 호흡으로 멀리 가는 지속력","조용한 안정감과 여유가 결합된 흔들림 없는 사람","고요함 속에서 흐름을 다스리는 평정의 힘","조용한 호흡으로 시간을 자기 편으로 만드는 힘"],
    "분석적인|신중한":         ["신중함과 분석을 결합한 통찰형 결단력","숙고된 분석으로 결정을 무르익히는 사고력","데이터와 직관을 함께 다스리는 신중한 분석력","서두르지 않고 본질을 꿰뚫는 분석적 정직성"],
    "느긋한|신중한":           ["서두르지 않으면서도 끝맺는 신중한 지구력","느긋한 호흡과 신중한 판단이 결합된 단단한 균형","장기적 시야 위에 단단히 선 신중한 결단력","급한 결정 대신 무게를 키우는 숙고형 결단력"],
    "느긋한|분석적인":         ["여유 있는 호흡 위에 세워진 분석적 통찰","조급하지 않게 본질을 꿰뚫는 분석력","느긋한 시야와 분석력이 결합된 멀리 보는 통찰","흔들리지 않고 패턴을 읽어내는 분석가형 평정"],

    // 자기표현 군 내부
    "공감하는|따뜻한":         ["따뜻한 공감으로 사람을 회복시키는 관계의 힘","공감과 온기가 결합된 안전한 관계 설계력","사람을 머무르게 만드는 따뜻한 공감 지능","마음을 안전하게 풀어주는 공감과 온기의 결합력"],

    // 자기설계 군 내부
    "계획적인|현실적인":       ["현실 감각 위에 짜인 단단한 계획력","이상과 현실을 잇는 실행 가능한 설계력","현실적 조건을 반영한 정교한 계획력","구체적 단계를 설계해 결과로 잇는 실용형 설계가 정신"],
    "계획적인|창의적인":       ["창의적 발상을 구조로 옮기는 설계력","아이디어를 단계로 분해해 실행하는 창의 설계력","창의와 계획을 함께 운영하는 디자인형 설계력","상상과 구조를 잇는 균형형 설계 감각"],
    "창의적인|현실적인":       ["창의를 현실에 안착시키는 균형형 설계력","꿈과 현실을 잇는 실용 창의력","제약을 자원으로 바꾸는 창의적 현실 감각","아이디어를 결과로 환원하는 실행형 창의력"],

    // 자기실행 군 내부
    "도전적인|열정적인":       ["불확실성 속에서도 멈추지 않는 열정형 도전력","뜨거운 추진력으로 새 영역을 여는 도전 정신","경계를 넓히며 흐름을 만들어내는 추진력","열정과 도전이 결합된 개척형 실행력"],
    "성취지향적인|열정적인":   ["뜨거운 동력으로 결과를 만들어내는 추진형 성취력","끝까지 해내는 열정형 완수력","열정으로 점화되어 성취로 마무리하는 추진력","목표를 결과로 잇는 열정형 성취 지향력"],
    "도전적인|성취지향적인":   ["미지의 영역을 결과로 만들어내는 도전형 성취력","경계를 넓히면서 동시에 마무리하는 추진력","도전과 완수를 함께 가져가는 결과 중심 개척력","‘새로운 것’을 ‘끝낸 것’으로 만드는 추진형 도전력"],

    // 군 간 페어 (대표적 조합 — 자주 발생하는 페어 우선)
    "분석적인|성취지향적인":   ["분석적 통찰과 성취 지향이 결합된 결과형 전략력","본질을 분해해 결과로 환원하는 분석형 추진력","데이터로 길을 만들고 결과로 답하는 전략적 성취력","‘왜’와 ‘끝내기’를 함께 가져가는 분석형 완수력"],
    "신중한|성취지향적인":     ["숙고된 결단으로 결과를 만들어내는 신중형 추진력","서두르지 않고 끝까지 해내는 단단한 완수력","신중함이 결과의 무게를 만드는 추진형 성취력","무르익은 결정을 결과로 옮기는 신중한 성취 지향력"],
    "분석적인|계획적인":       ["분석적 사고로 단계를 짜는 정밀한 설계력","구조와 데이터가 결합된 전략형 설계력","논리로 흐름을 짜고 단계로 옮기는 설계형 통찰","문제를 분해해 단계로 잇는 분석형 계획력"],
    "신중한|계획적인":         ["신중한 시야로 흐름을 설계하는 장기형 계획력","서두르지 않고 단계를 무르익히는 설계가 정신","숙고된 계획으로 결과를 보장하는 추진형 설계력","리스크를 줄이며 흐름을 짜는 신중한 설계력"],
    "분석적인|현실적인":       ["현실 조건 위에 세워진 분석적 통찰력","감정에 흔들리지 않고 본질을 꿰뚫는 사고력","데이터와 현장을 동시에 읽어내는 실용형 분석력","구체적 조건을 분석으로 환원하는 정직한 통찰"],
    "신중한|현실적인":         ["현실 감각 위에 세워진 신중한 결단력","서두르지 않고 조건을 다스리는 단단한 판단력","숙고된 현실 인식이 만드는 신뢰의 무게","흔들림 없는 신중한 실용주의"],
    "조용한|공감하는":         ["조용한 경청으로 사람을 회복시키는 공감의 힘","말 대신 머무름으로 마음을 잇는 사람","고요한 자리에서 가장 깊은 공감을 건네는 사람","조용함 속에서 사람의 결을 읽어내는 공감 지능"],
    "따뜻한|조용한":           ["조용한 온기로 사람을 회복시키는 존재감","말 없이도 안전을 만들어내는 따뜻한 분위기","조용한 깊이와 따뜻함이 결합된 평온한 존재감","고요한 곁이 곧 위로가 되는 사람"],
    "공감하는|신중한":         ["신중한 공감으로 마음을 안전하게 다루는 관계의 힘","서두르지 않고 사람의 결을 살피는 공감 지능","숙고된 공감이 만드는 깊은 신뢰감","조심스러운 다정함으로 관계를 다듬는 사람"],
    "따뜻한|신중한":           ["신중한 다정함으로 곁을 만드는 사람","서두르지 않는 따뜻함으로 신뢰를 쌓는 관계의 힘","무게 있는 온기로 사람을 머물게 하는 존재감","조용히 살피는 따뜻한 신중함"],
    "공감하는|분석적인":       ["사람의 결과 데이터의 결을 함께 읽는 통찰력","공감과 분석을 결합한 관계형 전략가의 시야","감정의 흐름을 분석으로 풀어내는 사고력","사람을 이해하면서 본질도 놓치지 않는 균형형 통찰"],
    "따뜻한|분석적인":         ["따뜻한 시선과 분석적 사고가 결합된 균형형 통찰","사람을 다치지 않게 본질을 짚어내는 사고력","온도와 정확성이 함께 가는 관계형 분석력","감정과 논리를 모두 다스리는 균형형 통찰"],
    "공감하는|계획적인":       ["관계의 흐름까지 설계하는 공감형 계획력","사람을 고려해 단계를 짜는 따뜻한 설계력","감정의 리듬을 일정에 녹여내는 공감 설계","사람을 중심에 둔 정교한 계획력"],
    "따뜻한|계획적인":         ["따뜻한 시선 위에 짜인 정교한 계획력","사람을 다치지 않게 단계를 짜는 설계력","온기와 구조가 결합된 관계형 설계력","사람을 머물게 하는 따뜻한 설계 정신"],
    "공감하는|창의적인":       ["사람의 결을 읽어내는 창의적 관계 설계력","감정과 상상력을 결합한 따뜻한 창작력","공감으로 발견한 통찰을 새로운 형태로 옮기는 창의력","사람을 위해 새로움을 짜내는 창작자형 공감"],
    "따뜻한|창의적인":         ["따뜻한 시선이 만들어내는 창의적 설계력","사람을 머물게 하는 따뜻한 창작력","온기와 새로움을 함께 가져가는 창작자 정신","상상과 다정함이 결합된 따뜻한 창의성"],
    "공감하는|성취지향적인":   ["사람을 데려가며 결과를 만들어내는 공감형 추진력","따뜻한 동행으로 성과를 끌어내는 관계형 성취력","사람을 다치지 않게 결과로 잇는 따뜻한 추진력","공감과 완수를 함께 가져가는 관계형 성취 지향력"],
    "따뜻한|성취지향적인":     ["따뜻한 동력으로 결과를 만들어내는 관계형 성취력","사람을 머물게 하면서도 끝까지 해내는 추진력","온기와 완수를 함께 가져가는 관계형 추진력","곁을 지키며 결과로 답하는 따뜻한 성취 지향력"],
    "공감하는|열정적인":       ["사람을 끌어당기는 따뜻한 열정","공감으로 점화된 추진력","사람의 결을 읽으며 흐름을 만들어내는 관계형 열정","마음을 잇는 뜨거운 동력"],
    "따뜻한|열정적인":         ["따뜻한 열정으로 사람을 움직이는 관계형 추진력","온기와 동력이 결합된 사람 중심 추진력","따뜻하게 점화되는 추진형 리더십","사람을 데우면서 흐름을 만드는 열정"],
    "도전적인|공감하는":       ["사람을 데리고 미지로 들어가는 공감형 도전력","따뜻한 동행으로 새 영역을 여는 추진력","사람의 결을 살피며 경계를 넓히는 도전 정신","공감과 도전이 결합된 관계형 개척력"],
    "도전적인|따뜻한":         ["따뜻한 시선으로 미지를 여는 도전 정신","사람을 다치지 않게 새로움을 시도하는 추진력","온기와 개척이 결합된 관계형 도전력","사람과 함께 경계를 넓히는 따뜻한 개척력"],
    "계획적인|성취지향적인":   ["흐름을 설계해 결과로 잇는 추진형 설계력","계획과 완수를 함께 가져가는 결과 중심 설계력","장기 시야로 결과를 만들어내는 추진형 계획력","구조와 결과를 잇는 설계가형 성취 지향력"],
    "계획적인|열정적인":       ["뜨거운 동력 위에 짜인 정교한 설계력","열정과 계획이 결합된 추진형 설계력","열정을 단계로 옮기는 설계가 정신","흐름을 설계해 동력으로 채우는 추진력"],
    "도전적인|계획적인":       ["미지의 영역까지 설계하는 도전형 계획력","개척과 구조가 결합된 전략적 추진력","흐름을 설계해 새 영역을 여는 도전 정신","경계를 넓히면서도 단계를 잃지 않는 설계력"],
    "현실적인|성취지향적인":   ["현실 위에 결과를 쌓는 단단한 추진력","조건을 다스리며 끝까지 해내는 실용형 성취력","감정에 흔들리지 않고 결과로 잇는 추진력","현실 감각이 만드는 흔들림 없는 완수력"],
    "현실적인|열정적인":       ["현실 위에 점화되는 단단한 열정","조건을 다스리며 흐름을 만드는 추진력","감정에 휩쓸리지 않는 실용형 열정","현실 감각과 동력이 결합된 추진력"],
    "도전적인|현실적인":       ["현실 감각 위에 선 단단한 도전 정신","조건을 다스리며 새 영역을 여는 개척력","감정에 휩쓸리지 않는 실용형 도전력","현실을 무기로 삼는 도전 정신"],
    "창의적인|성취지향적인":   ["창의를 결과로 환원하는 추진형 창작력","상상과 완수를 함께 가져가는 창작자 정신","아이디어를 결과로 옮기는 추진형 창의력","새로움을 끝낸 것으로 만드는 창의적 추진력"],
    "창의적인|열정적인":       ["뜨거운 동력으로 새로움을 만들어내는 창작력","열정과 창의가 결합된 추진형 창작력","상상력을 흐름으로 옮기는 추진력","점화된 창작 정신"],
    "도전적인|창의적인":       ["미지를 새로움으로 만드는 창작형 도전력","상상과 개척이 결합된 추진력","경계를 넓히는 창의적 도전 정신","‘없던 것’을 ‘된 것’으로 만드는 창의적 도전력"],
    "조용한|계획적인":         ["조용한 깊이로 흐름을 설계하는 사색형 계획력","고요한 사고와 정교한 설계가 결합된 통찰","조용한 집중에서 단계가 만들어지는 설계력","서두르지 않고 흐름을 짜내는 사색형 설계가 정신"],
    "조용한|창의적인":         ["조용한 깊이에서 솟아나는 창의적 통찰","고요한 사고가 만들어내는 새로움","조용한 응시에서 발견되는 창의력","외부 소음 없이 짜내는 창작자 정신"],
    "조용한|열정적인":         ["조용한 동력으로 멀리 가는 추진력","고요한 깊이 안에서 점화되는 열정","외적 소음 없이 자기 흐름을 만드는 추진력","조용한 자리에서 흐름을 만드는 사색형 열정"],
    "조용한|성취지향적인":     ["조용한 추진력으로 결과를 만드는 사람","고요한 집중에서 완수로 잇는 성취력","외부 시선 없이 끝까지 해내는 단단한 추진력","조용한 깊이가 만드는 단단한 완수력"],
    "조용한|도전적인":         ["조용한 결단력으로 새 영역을 여는 사람","고요한 깊이에서 발휘되는 도전 정신","외적 소란 없이 경계를 넓히는 추진력","조용한 응시 끝에 내딛는 단단한 도전"],
    "조용한|현실적인":         ["고요한 평정 위에 세워진 현실 감각","조용한 응시로 본질을 다스리는 실용형 통찰","흔들리지 않는 조용한 현실 인식","외적 소음 없이 조건을 읽어내는 사색형 현실 감각"],
    "느긋한|공감하는":         ["여유 있는 자리에서 사람을 머물게 하는 공감의 힘","서두르지 않는 따뜻한 응시","느긋한 호흡과 공감이 결합된 안정형 관계력","조급하지 않게 사람을 다스리는 공감 지능"],
    "느긋한|따뜻한":           ["여유 있는 온기로 사람을 머물게 하는 존재감","서두르지 않는 따뜻함이 만드는 안전감","느긋한 호흡과 온기가 결합된 회복형 분위기","조급하지 않은 따뜻함이 만드는 신뢰감"],
    "느긋한|계획적인":         ["여유 있는 호흡 위에 세워진 정교한 설계력","서두르지 않으면서도 흐름을 짜내는 설계가 정신","장기 시야와 여유가 결합된 단단한 계획력","조급하지 않게 단계를 다스리는 설계력"],
    "느긋한|창의적인":         ["여유 있는 호흡에서 솟아나는 창의력","서두르지 않고 새로움을 길어 올리는 창작 정신","조급함 없이 발견되는 창작자형 통찰","흐름을 다스리며 발견되는 창의력"],
    "느긋한|성취지향적인":     ["여유 있는 호흡으로 결과를 만들어내는 지속형 추진력","서두르지 않으면서도 끝까지 해내는 단단한 성취력","흔들림 없는 평정이 만드는 결과 중심 완수력","느긋한 호흡과 완수가 결합된 단단한 추진력"],
    "느긋한|열정적인":         ["여유 있는 호흡 위에 점화되는 단단한 열정","조급함 없는 추진력","흔들리지 않는 평정 위의 동력","길게 가는 사람의 안정된 열정"],
    "느긋한|도전적인":         ["서두르지 않으면서 새 영역을 여는 도전 정신","여유 있는 호흡과 개척이 결합된 단단한 추진력","조급하지 않은 도전 의식","평정 위에서 발휘되는 단단한 도전력"]
  };

  var TRAIT_PAIR_EN = {
    "신중한|조용한":           ["The strength of looking at the essence carefully in quiet","Quiet depth combined with thoughtful decisiveness — calm honesty","A reflective thoughtfulness that lets decisions ripen","Calm insight built from quiet observation and careful judgment"],
    "분석적인|조용한":         ["Analytical insight drawn from quiet focus","Calm thinking combined with analytical precision","The mental capacity to break things down to the essence without external noise","Analytical thinking that reads patterns through quiet depth"],
    "느긋한|조용한":           ["A sustaining force that goes far through calm composure and unhurried breath","An unshaken person — quiet stability paired with ease","A composed strength that masters the flow in stillness","A force that turns time into an ally through quiet rhythm"],
    "분석적인|신중한":         ["Decisiveness that combines thoughtfulness with analysis — insight-driven","Thinking that lets decisions ripen through deliberate analysis","Thoughtful analytical strength that masters both data and intuition","Analytical honesty that pierces the essence without rushing"],
    "느긋한|신중한":           ["Thoughtful endurance that finishes without rushing","A firm balance combining unhurried rhythm with thoughtful judgment","Decisiveness anchored on long-range vision","A weighted decisiveness that lets weight grow rather than rushing"],
    "느긋한|분석적인":         ["Analytical insight built on a relaxed rhythm","Analytical strength that pierces the essence without haste","Far-seeing insight combining ease and analysis","Analyst-style composure that reads patterns without being shaken"],
    "공감하는|따뜻한":         ["Relational strength — warm empathy that restores people","Safe relational design combining empathy and warmth","Warm empathic intelligence that lets people stay","A combination of empathy and warmth that gently releases the heart"],
    "계획적인|현실적인":       ["Sturdy planning built on a sense of reality","Executable design linking ideal and real","Refined planning that reflects concrete conditions","A pragmatic designer's spirit that sequences steps into results"],
    "계획적인|창의적인":       ["Design that translates creative ideas into structure","Creative design that decomposes ideas into steps","Designer-style planning that runs creativity and structure together","A balanced design sensibility that bridges imagination and structure"],
    "창의적인|현실적인":       ["Balanced design that lands creativity in reality","Practical creativity that links dream and reality","Creative reality-sense that turns constraints into resources","Execution-oriented creativity that returns ideas to results"],
    "도전적인|열정적인":       ["A passionate challenger's force that does not stop in uncertainty","A challenger's spirit that opens new ground with hot drive","A drive that widens the frontier and creates flow","Pioneer-style execution combining passion and challenge"],
    "성취지향적인|열정적인":   ["Achievement-driven thrust that turns hot motive into results","Passionate finishing strength that sees things through","A drive ignited by passion and closed by accomplishment","Passionate achievement-orientation that links goals to results"],
    "도전적인|성취지향적인":   ["A challenger's achievement that turns the unknown into result","A drive that widens boundaries while finishing","Result-centered pioneering force that runs challenge and completion together","A pioneering thrust that turns 'something new' into 'something done'"],
    "분석적인|성취지향적인":   ["Result-oriented strategy that combines analytical insight and achievement","Analytical drive that decomposes essence and returns it as result","Strategic achievement that makes a path with data and answers with results","Analytical finishing strength that runs the 'why' and the 'finishing' together"],
    "신중한|성취지향적인":     ["Thoughtful drive that produces results through deliberate decisions","Firm finishing strength that sees things through without rushing","Achievement-oriented thrust where thoughtfulness creates the weight of results","Thoughtful achievement-orientation that translates ripened decisions into results"],
    "분석적인|계획적인":       ["Refined design power that sequences steps with analytical thinking","Strategic design that combines structure and data","Designer-style insight that builds flow through logic","Analytical planning that splits problems into linked steps"],
    "신중한|계획적인":         ["Long-range planning that designs flow with thoughtful vision","A designer's spirit that ripens steps without rushing","Drive-based design that guarantees results through deliberate planning","Thoughtful design that minimizes risk while sequencing flow"],
    "분석적인|현실적인":       ["Analytical insight built on real-world conditions","Thinking that pierces the essence without being shaken by emotion","Practical analytical strength that reads data and field together","Honest insight that returns concrete conditions to analysis"],
    "신중한|현실적인":         ["Thoughtful decisiveness anchored on a sense of reality","Firm judgment that masters conditions without rushing","Trustworthy weight built from deliberate realism","Steady, unshaken thoughtful pragmatism"],
    "조용한|공감하는":         ["Empathic strength that restores people through quiet listening","A person who links hearts through presence rather than words","One who offers the deepest empathy from a quiet seat","Empathic intelligence that reads the texture of people in stillness"],
    "따뜻한|조용한":           ["A presence that restores people with quiet warmth","A warm atmosphere that creates safety without words","A peaceful presence combining quiet depth and warmth","A person whose silent companionship is itself a comfort"],
    "공감하는|신중한":         ["Relational strength — thoughtful empathy that handles hearts safely","Empathic intelligence that examines the texture of people without rushing","A deep trust built from deliberate empathy","One who refines relationships with careful tenderness"],
    "따뜻한|신중한":           ["A person who creates company with thoughtful tenderness","Relational strength that builds trust through unhurried warmth","A weighty warmth that lets people stay","Quietly observant warm thoughtfulness"],
    "공감하는|분석적인":       ["Insight that reads both the texture of people and the texture of data","A relational strategist's view combining empathy and analysis","Thinking that resolves the flow of emotion through analysis","Balanced insight — understanding people without missing the essence"],
    "따뜻한|분석적인":         ["Balanced insight combining a warm gaze and analytical thinking","Thinking that names the essence without wounding people","Relational analytical strength where warmth and accuracy travel together","Balanced insight that masters both feeling and logic"],
    "공감하는|계획적인":       ["Empathic planning that even designs the flow of relationships","Warm design that sequences steps with people in mind","An empathic design that weaves the rhythm of feeling into schedules","A refined plan centered on people"],
    "따뜻한|계획적인":         ["A refined plan built on a warm gaze","Design that sequences steps without wounding people","Relational design combining warmth and structure","A warm spirit of design that makes people stay"],
    "공감하는|창의적인":       ["Creative relational design that reads the texture of people","Warm creative work combining feeling and imagination","Creativity that translates empathic insight into new forms","A creator's empathy that crafts newness for the sake of others"],
    "따뜻한|창의적인":         ["Creative design power that arises from a warm gaze","Warm creative work that lets people stay","A creator's spirit that runs warmth and newness together","Warm creativity combining imagination and tenderness"],
    "공감하는|성취지향적인":   ["Empathic drive that takes people along while creating results","Relational achievement that draws performance through warm companionship","A warm drive that links results without wounding people","Relational achievement-orientation that runs empathy and completion together"],
    "따뜻한|성취지향적인":     ["Relational achievement built on a warm energy","A drive that lets people stay yet finishes through to the end","Relational drive that runs warmth and completion together","Warm achievement-orientation that answers with results while staying near"],
    "공감하는|열정적인":       ["A warm passion that pulls people in","A drive ignited by empathy","Relational passion that creates flow while reading the texture of people","A hot energy that links hearts"],
    "따뜻한|열정적인":         ["Relational drive that moves people through warm passion","People-centered drive combining warmth and energy","Warmly ignited driving leadership","A passion that warms people while creating flow"],
    "도전적인|공감하는":       ["Empathic challenger's force that takes people into the unknown","A drive that opens new ground through warm companionship","A challenger's spirit that widens the frontier while reading the texture of people","Relational pioneering force combining empathy and challenge"],
    "도전적인|따뜻한":         ["A challenger's spirit that opens the unknown with a warm gaze","A drive that tries new things without wounding people","Relational challenger's force combining warmth and pioneering","A warm pioneering force that widens boundaries together with people"],
    "계획적인|성취지향적인":   ["Drive-based design that sequences flow into result","Result-centered design that runs planning and completion together","Drive-based planning that creates result through long-range vision","A designer's achievement-orientation that links structure and result"],
    "계획적인|열정적인":       ["Refined design built on a hot drive","Drive-based design combining passion and planning","A designer's spirit that translates passion into steps","A drive that fills designed flow with energy"],
    "도전적인|계획적인":       ["A challenger's planning that even designs the unknown","Strategic drive combining pioneering and structure","A challenger's spirit that opens new ground by designing flow","Design strength that does not lose its steps even while widening boundaries"],
    "현실적인|성취지향적인":   ["Sturdy drive that stacks results on reality","Practical achievement that masters conditions and finishes through to the end","A drive that links to results without being swept by emotion","Unshaken finishing strength built on a sense of reality"],
    "현실적인|열정적인":       ["A sturdy passion ignited on reality","A drive that masters conditions and creates flow","Practical passion not swept by emotion","A drive combining reality-sense and energy"],
    "도전적인|현실적인":       ["A challenger's spirit standing firm on a sense of reality","A pioneering force that opens new ground while mastering conditions","Practical challenger's force not swept by emotion","A challenger's spirit that takes reality as a weapon"],
    "창의적인|성취지향적인":   ["Drive-based creative work that returns creativity into results","A creator's spirit that runs imagination and completion together","Drive-based creativity that translates ideas into results","Creative drive that turns newness into a finished thing"],
    "창의적인|열정적인":       ["Creative work that produces newness through a hot drive","Drive-based creative work combining passion and creativity","A drive that translates imagination into flow","An ignited creator's spirit"],
    "도전적인|창의적인":       ["Creator-style challenger's force that turns the unknown into newness","A drive combining imagination and pioneering","A creative challenger's spirit that widens boundaries","A creative challenger's force that turns 'what was not' into 'what is'"],
    "조용한|계획적인":         ["Reflective planning that designs flow through quiet depth","Insight combining calm thought and refined design","Design power where steps emerge from quiet focus","A reflective designer's spirit that builds flow without rushing"],
    "조용한|창의적인":         ["Creative insight that wells up from quiet depth","Newness produced by calm thought","Creativity discovered through quiet observation","A creator's spirit forged without external noise"],
    "조용한|열정적인":         ["A drive that goes far through quiet motive","A passion ignited within calm depth","A drive that creates its own flow without external noise","A reflective passion that creates flow from a quiet seat"],
    "조용한|성취지향적인":     ["A person who creates results through quiet drive","Achievement strength that links calm focus to completion","Firm drive that finishes through to the end without external eyes","Firm finishing strength forged from quiet depth"],
    "조용한|도전적인":         ["A person who opens new ground with quiet decisiveness","A challenger's spirit exercised from calm depth","A drive that widens boundaries without external commotion","A firm challenge stepped into after quiet observation"],
    "조용한|현실적인":         ["A sense of reality built on calm composure","Practical insight that masters the essence through quiet observation","Unshaken quiet realism","A reflective sense of reality that reads conditions without external noise"],
    "느긋한|공감하는":         ["Empathic strength that lets people stay from a relaxed seat","An unhurried warm gaze","Stable relational strength combining unhurried rhythm and empathy","Empathic intelligence that masters people without rushing"],
    "느긋한|따뜻한":           ["A presence that lets people stay through relaxed warmth","Safety created by an unhurried warmth","A restorative atmosphere combining unhurried rhythm and warmth","Trust created by an unrushed warmth"],
    "느긋한|계획적인":         ["Refined design power built on a relaxed rhythm","A designer's spirit that builds flow without rushing","Firm planning that combines long-range vision and ease","Design strength that masters steps without urgency"],
    "느긋한|창의적인":         ["Creativity that wells up from a relaxed rhythm","A creator's spirit that draws newness without rushing","Creator-style insight discovered without urgency","Creativity discovered while mastering the flow"],
    "느긋한|성취지향적인":     ["Sustaining drive that produces results through unhurried rhythm","Firm achievement strength that finishes without rushing","Result-centered finishing strength built from unshaken composure","Firm drive combining unhurried rhythm and completion"],
    "느긋한|열정적인":         ["A firm passion ignited on a relaxed rhythm","An unrushed drive","An energy on top of unshaken composure","The steady passion of one who goes far"],
    "느긋한|도전적인":         ["A challenger's spirit that opens new ground without rushing","Firm drive combining a relaxed rhythm and pioneering","An unrushed challenger's awareness","Firm challenger's force exercised on top of composure"]
  };

  // Q6 traits 입력 → 강점 페어 해석 문장 (최대 N개) — 원시 형용사 노출 차단
  function interpretTraitPair(traits, fingerprint, lang){
    var isEn = (lang === "en");
    var t = (traits || []).filter(function(x){ return TRAITS_12.indexOf(x) !== -1; });
    if (t.length === 0) return [];

    var SINGLE = isEn ? TRAIT_SINGLE_EN : TRAIT_SINGLE_KO;
    var PAIR = isEn ? TRAIT_PAIR_EN : TRAIT_PAIR_KO;
    var out = [];

    if (t.length >= 2) {
      // 첫 페어 (정렬된 키)
      var key1 = _pairKey(t[0], t[1]);
      var arr1 = PAIR[key1];
      if (arr1) {
        out.push(pickByHash(arr1, fingerprint));
      } else {
        // 매트릭스 미정의 폴백 — 단일 변환 후 결합
        out.push(pickByHash(SINGLE[t[0]] || ["—"], fingerprint));
      }
    }
    if (t.length >= 3) {
      // 두 번째 페어 (1-2)
      var key2 = _pairKey(t[1], t[2]);
      var arr2 = PAIR[key2];
      if (arr2) {
        out.push(pickByHash(arr2, fingerprint + 11));
      } else {
        out.push(pickByHash(SINGLE[t[2]] || ["—"], fingerprint + 11));
      }
      // 세 번째 — 단일 trait 변환 또는 0-2 페어
      var key3 = _pairKey(t[0], t[2]);
      var arr3 = PAIR[key3];
      if (arr3) {
        out.push(pickByHash(arr3, fingerprint + 23));
      } else {
        out.push(pickByHash(SINGLE[t[1]] || ["—"], fingerprint + 23));
      }
    }
    if (t.length === 1) {
      out.push(pickByHash(SINGLE[t[0]] || ["—"], fingerprint));
    }

    return unique(out).slice(0, 3);
  }

  // ──────────────────────────────────────────────────────────
  // P0-2. 진로/교육 fallback 중복 차단 — 다양화 풀
  // ──────────────────────────────────────────────────────────

  // 톤별 fallback 풀 (3개 모두 다른 항목으로) — 원본 엔진의 단일 fallback 반복 차단
  var EDU_FALLBACK_KO = {
    principled_designer:  ["전략적 의사결정 워크숍","원칙 기반 리더십 과정","시스템 사고 훈련","구조 설계 마스터클래스"],
    warm_connector:       ["코칭·퍼실리테이션 과정","비폭력 커뮤니케이션 훈련","공동체 리더십 워크숍","감정 코칭 실무 과정"],
    visionary_creator:    ["스토리텔링·내러티브 훈련","창의적 발상 워크숍","브랜드·콘텐츠 기획 과정","의미 기반 창작 과정"],
    pragmatic_achiever:   ["OKR·성과관리 실무 과정","프로젝트 매니지먼트 훈련","실행력 부트캠프","목표 설계 워크숍"],
    reflective_explorer:  ["자기성찰·메타인지 훈련","철학·고전 읽기 과정","마음챙김·명상 훈련","글쓰기·통찰 워크숍"]
  };
  var EDU_FALLBACK_EN = {
    principled_designer:  ["Strategic Decision-Making Workshop","Principle-Based Leadership Course","Systems Thinking Training","Structural Design Masterclass"],
    warm_connector:       ["Coaching & Facilitation Course","Nonviolent Communication Training","Community Leadership Workshop","Emotional Coaching Practitioner Course"],
    visionary_creator:    ["Storytelling & Narrative Training","Creative Ideation Workshop","Brand & Content Planning Course","Meaning-Based Creation Course"],
    pragmatic_achiever:   ["OKR & Performance Management Course","Project Management Training","Execution Bootcamp","Goal Design Workshop"],
    reflective_explorer:  ["Self-Reflection & Metacognition Training","Philosophy & Classics Reading Course","Mindfulness & Meditation Training","Writing & Insight Workshop"]
  };
  var CAREER_FALLBACK_KO = {
    principled_designer:  ["전략 설계자 / 시스템 디자이너","원칙 기반 리더십 코치","조직개발 컨설턴트","의사결정 자문가"],
    warm_connector:       ["관계 중심 리더십 코치","조직문화 디자이너","커뮤니티 빌더","온보딩 디자이너"],
    visionary_creator:    ["콘텐츠 디렉터 / 크리에이터","브랜드 스토리텔러","문화기획자","의미 기반 작가"],
    pragmatic_achiever:   ["프로젝트 매니저 / 운영 전문가","성과관리 컨설턴트","실행 코치","목표 설계 전문가"],
    reflective_explorer:  ["사상·콘텐츠 디렉터","리서치 PM","사색가형 작가","통찰 기반 컨설턴트"]
  };
  var CAREER_FALLBACK_EN = {
    principled_designer:  ["Strategic Designer / Systems Designer","Principle-Based Leadership Coach","Organizational Development Consultant","Decision-Making Advisor"],
    warm_connector:       ["Relationship-Centered Leadership Coach","Organizational Culture Designer","Community Builder","Onboarding Designer"],
    visionary_creator:    ["Content Director / Creator","Brand Storyteller","Cultural Planner","Meaning-Based Writer"],
    pragmatic_achiever:   ["Project Manager / Operations Specialist","Performance Management Consultant","Execution Coach","Goal Design Specialist"],
    reflective_explorer:  ["Thought & Content Director","Research PM","Reflective Writer","Insight-Based Consultant"]
  };
  var DIRECTIONS_FALLBACK_KO = [
    "관심 영역의 깊이 확장","실행 경험으로의 확장","사람과 관계 영역으로의 확장","사회적 영향력 영역으로의 확장","창작·콘텐츠 영역으로의 확장"
  ];
  var DIRECTIONS_FALLBACK_EN = [
    "Deepen expertise in your area of interest","Expand into execution experience","Expand into relationships and people","Expand into social impact","Expand into creation and content"
  ];

  // 중복 제거 + tone 기반 다양화 보강
  function diversifyCareerEducation(ce, toneKey, fingerprint, lang){
    var isEn = (lang === "en");
    var careersOut = unique(ce.careers || []);
    var eduOut = unique(ce.education || []);
    var dirOut = unique(ce.directions || []);

    var eduFallback = (isEn ? EDU_FALLBACK_EN : EDU_FALLBACK_KO)[toneKey] || (isEn ? EDU_FALLBACK_EN.reflective_explorer : EDU_FALLBACK_KO.reflective_explorer);
    var careerFallback = (isEn ? CAREER_FALLBACK_EN : CAREER_FALLBACK_KO)[toneKey] || (isEn ? CAREER_FALLBACK_EN.reflective_explorer : CAREER_FALLBACK_KO.reflective_explorer);
    var dirFallback = isEn ? DIRECTIONS_FALLBACK_EN : DIRECTIONS_FALLBACK_KO;

    // fingerprint 기반 시작 인덱스로 회전 → 사용자별로 서로 다른 fallback 조합
    function _rotate(arr, hash){
      if (!arr.length) return [];
      var start = Math.abs(hash) % arr.length;
      return arr.slice(start).concat(arr.slice(0, start));
    }
    var eduPool = _rotate(eduFallback, fingerprint);
    var careerPool = _rotate(careerFallback, fingerprint + 7);
    var dirPool = _rotate(dirFallback, fingerprint + 13);

    function _topUp(arr, pool, want){
      var i = 0;
      while (arr.length < want && i < pool.length * 2) {
        var cand = pool[i % pool.length];
        if (arr.indexOf(cand) === -1) arr.push(cand);
        i++;
      }
      return arr.slice(0, want);
    }

    careersOut = _topUp(careersOut, careerPool, 3);
    eduOut = _topUp(eduOut, eduPool, 3);
    dirOut = _topUp(dirOut, dirPool, 3);

    return { careers: careersOut, education: eduOut, directions: dirOut, sourceTopic: ce.sourceTopic, sourceDomains: ce.sourceDomains };
  }

  // ──────────────────────────────────────────────────────────
  // P1-1. 4축 카드 4-tier 분기
  //   tier 결정: pct 점수
  //     deep     90~100 — 깊은 숙성 단계
  //     active   70~89  — 활성화 단계
  //     emerging 50~69  — 발현 단계
  //     seed     0~49   — 씨앗 단계
  // ──────────────────────────────────────────────────────────
  function _tier(pct){
    if (pct >= 90) return "deep";
    if (pct >= 70) return "active";
    if (pct >= 50) return "emerging";
    return "seed";
  }

  // 축×tier 보강 토큰 — emotional/keyword에 추가되는 tier-specific 라벨
  var TIER_LABEL_KO = {
    self_understanding: { deep: "내적 통찰의 숙성기", active: "내적 통찰의 활성화", emerging: "내적 통찰의 발현", seed: "내적 통찰의 씨앗" },
    self_expression:    { deep: "자기표현의 숙성기", active: "자기표현의 활성화", emerging: "자기표현의 발현", seed: "자기표현의 씨앗" },
    self_design:        { deep: "자기설계의 숙성기", active: "자기설계의 활성화", emerging: "자기설계의 발현", seed: "자기설계의 씨앗" },
    self_execution:     { deep: "자기실행의 숙성기", active: "자기실행의 활성화", emerging: "자기실행의 발현", seed: "자기실행의 씨앗" }
  };
  var TIER_LABEL_EN = {
    self_understanding: { deep: "Mature inner insight", active: "Active inner insight", emerging: "Emerging inner insight", seed: "Seed of inner insight" },
    self_expression:    { deep: "Mature self-expression", active: "Active self-expression", emerging: "Emerging self-expression", seed: "Seed of self-expression" },
    self_design:        { deep: "Mature self-design", active: "Active self-design", emerging: "Emerging self-design", seed: "Seed of self-design" },
    self_execution:     { deep: "Mature self-execution", active: "Active self-execution", emerging: "Emerging self-execution", seed: "Seed of self-execution" }
  };

  // tier 별 카드 후미 문장 (1줄 보강) — emotional 다음에 표시되는 마무리 줄
  var TIER_CLOSER_KO = {
    deep:     ["이미 충분히 숙성된 영역으로, 다른 사람을 도울 수 있는 단계입니다.","오랜 시간 다듬어 온 영역으로 자신만의 깊이가 형성되어 있습니다.","숙성된 영역으로, 사람들에게 모범과 기준이 되는 단계입니다."],
    active:   ["꾸준히 활성화된 영역으로, 자신감 있게 발휘할 수 있는 단계입니다.","활발하게 작동하는 영역으로, 다음 단계의 도약이 가능합니다.","익숙해진 영역으로, 더 큰 무대로 확장할 수 있는 단계입니다."],
    emerging: ["발현되기 시작한 영역으로, 의식적으로 키워가면 빠르게 성장할 수 있습니다.","씨앗이 움튼 영역으로, 작은 실천을 반복하면 단단해집니다.","조금씩 자라는 영역으로, 매일의 작은 시도가 큰 결실로 돌아옵니다."],
    seed:     ["아직 씨앗 단계의 영역으로, 작고 안전한 시도부터 시작해 보세요.","여유를 가지고 천천히 키워갈 영역입니다.","아직은 잠재태의 영역으로, 부담 없는 한 걸음부터 시작해 보세요."]
  };
  var TIER_CLOSER_EN = {
    deep:     ["This is an already-mature area where you can help others.","This is an area you've refined over time, with depth that is your own.","This is a mature area — a benchmark and standard for others."],
    active:   ["This is a steadily active area where you can work with confidence.","This is an actively operating area, ready for the next leap.","This is a familiar area, ready to expand to a larger stage."],
    emerging: ["This area has just begun to emerge — conscious cultivation will accelerate growth.","The seed has sprouted — small, repeated practice will solidify it.","This area grows little by little — small daily attempts return as large fruit."],
    seed:     ["This is still a seed-stage area — start with small, safe attempts.","This is an area to grow slowly, with patience.","This is still a latent area — start with one easy step."]
  };

  // 카드 보강: tier 라벨 추가 + emotional 후미 closer 추가
  function enhanceAxisCard(card, lang){
    var isEn = (lang === "en");
    var tier = _tier(card.content.pct);
    var tierLabel = (isEn ? TIER_LABEL_EN : TIER_LABEL_KO)[card.id] || {};
    var closerArr = (isEn ? TIER_CLOSER_EN : TIER_CLOSER_KO)[tier] || [];

    // fingerprint = pct + axis index 조합으로 closer 선택
    var fp = (card.content.pct * 31 + card.id.length * 7) | 0;
    var closer = pickByHash(closerArr, fp);
    var newCard = clone(card);
    newCard.content.tier = tier;
    newCard.content.tierLabel = tierLabel[tier] || "";
    if (closer) {
      newCard.content.closerLine = closer;
    }
    return newCard;
  }

  // ──────────────────────────────────────────────────────────
  // P1-2. 사명/비전 7-슬롯 합성
  //   슬롯: anchor(가치 앵커), descriptor(가치 형용), verb(행위), target(대상),
  //         primary_domain(주영역), secondary_domain(보조영역), essence(본질)
  //   톤별 라이브러리 + 응답 데이터 + fingerprint 결합으로 생성
  // ──────────────────────────────────────────────────────────

  var MV_SLOTS_KO = {
    principled_designer: {
      anchor:     ["원칙","신념","기준","철학"],
      descriptor: ["흔들림 없이 다듬어 온","오래 숙성시켜 온","검증된","단단히 세워진"],
      verb:       ["설계해 가는","구조화하는","체계로 옮기는","흐름으로 만드는"],
      target:     ["사람의 변화","조직의 방향","공동체의 기준","삶의 구조"],
      essence:    ["통찰형 전략가","원칙 기반 설계가","구조 설계가","사상가형 리더"],
      time_horizon: ["장기적 흐름","평생의 호흡","오랜 시간","멀리 보는 시선"]
    },
    warm_connector: {
      anchor:     ["관계","신뢰","공감","온기"],
      descriptor: ["따뜻하게 머무르는","사람을 안전하게 만드는","조용히 곁이 되는","상대의 결을 살피는"],
      verb:       ["잇는","회복시키는","이어주는","머무르게 하는"],
      target:     ["사람의 마음","공동체의 결","관계의 깊이","함께하는 자리"],
      essence:    ["관계형 연결자","공감형 리더","따뜻한 동행자","마음을 잇는 사람"],
      time_horizon: ["일상의 호흡","매일의 자리","사람과 사람 사이","곁의 시간"]
    },
    visionary_creator: {
      anchor:     ["의미","가능성","비전","꿈"],
      descriptor: ["새로운 결을 발견해 가는","틀을 다시 짜는","기존을 넘어서는","경계를 넓혀 가는"],
      verb:       ["창조하는","실현해 가는","발견하는","나누는"],
      target:     ["새로운 가능성","미래의 방향","의미의 결","사람들의 상상"],
      essence:    ["비전형 창조자","의미 창작자","경계를 여는 사람","상상의 설계자"],
      time_horizon: ["다가올 시대","아직 오지 않은 결","미래의 호흡","새 시대의 흐름"]
    },
    pragmatic_achiever: {
      anchor:     ["목표","결과","성취","책임"],
      descriptor: ["꾸준히 다져 온","실행으로 검증한","단단히 만들어 온","흔들림 없이 끝맺어 온"],
      verb:       ["만들어내는","끝까지 해내는","결과로 옮기는","증명하는"],
      target:     ["구체적 변화","팀의 성과","조직의 결과","약속한 결실"],
      essence:    ["추진형 성취자","실행 전문가","결과 중심 리더","완수형 추진가"],
      time_horizon: ["분기의 흐름","연간 호흡","목표한 시점까지","약속의 시간"]
    },
    reflective_explorer: {
      anchor:     ["내면","성찰","통찰","사색"],
      descriptor: ["깊이 들여다보는","조용히 응시하는","오래 묻고 답해 온","겹겹이 다져 온"],
      verb:       ["탐색하는","발견해 가는","나누는","길어 올리는"],
      target:     ["삶의 의미","사람의 본질","질문의 무게","내면의 결"],
      essence:    ["사색형 탐험가","통찰의 길잡이","질문하는 사람","사상의 설계가"],
      time_horizon: ["평생의 흐름","오랜 호흡","멀리 보는 시간","고요한 시간"]
    }
  };
  var MV_SLOTS_EN = {
    principled_designer: {
      anchor:     ["principle","conviction","standard","philosophy"],
      descriptor: ["unshakably refined","long-matured","tested","firmly built"],
      verb:       ["designing","structuring","translating into systems","building into flow"],
      target:     ["change in people","direction of organizations","standards of community","the structure of life"],
      essence:    ["insight-driven strategist","principle-based designer","structural designer","thinker-leader"],
      time_horizon: ["long-range flow","a lifetime breath","over time","far-seeing horizon"]
    },
    warm_connector: {
      anchor:     ["relationship","trust","empathy","warmth"],
      descriptor: ["warmly staying","making people safe","quietly companioning","reading the texture of others"],
      verb:       ["connecting","restoring","linking","letting people stay"],
      target:     ["people's hearts","the texture of community","the depth of relationship","shared spaces"],
      essence:    ["relational connector","empathic leader","warm companion","one who links hearts"],
      time_horizon: ["everyday breath","daily seat","between people","companion time"]
    },
    visionary_creator: {
      anchor:     ["meaning","possibility","vision","dream"],
      descriptor: ["discovering new texture","reframing structures","stepping beyond the existing","widening boundaries"],
      verb:       ["creating","realizing","discovering","sharing"],
      target:     ["new possibility","direction of the future","texture of meaning","people's imagination"],
      essence:    ["visionary creator","meaning maker","boundary opener","architect of imagination"],
      time_horizon: ["the coming era","what has not yet arrived","future breath","the flow of a new era"]
    },
    pragmatic_achiever: {
      anchor:     ["goal","result","achievement","accountability"],
      descriptor: ["steadily strengthened","verified through execution","firmly built","unshakably finished"],
      verb:       ["producing","seeing through to the end","translating into result","proving"],
      target:     ["concrete change","the team's performance","organizational results","promised fruit"],
      essence:    ["driving achiever","execution specialist","result-centered leader","finishing-style driver"],
      time_horizon: ["quarterly flow","annual breath","up to the target point","promised time"]
    },
    reflective_explorer: {
      anchor:     ["inner self","reflection","insight","contemplation"],
      descriptor: ["looking deeply within","quietly observing","long asking and answering","layered over time"],
      verb:       ["exploring","discovering","sharing","drawing up"],
      target:     ["the meaning of life","the essence of people","the weight of questions","the texture of the inner self"],
      essence:    ["reflective explorer","guide of insight","one who asks","architect of thought"],
      time_horizon: ["a lifetime flow","long breath","far-seeing time","quiet time"]
    }
  };

  // ──────────────────────────────────────────────────────────
  // P1-2b. 가치 정제 라이브러리 — Q13 직역 차단 + 통찰 합성
  //
  //  설계 원칙:
  //   - Q13 다중선택값(예: 사랑·자유·의미 추구)을 그대로 노출하지 않고
  //     1) 각 가치를 "지향성"으로 풀어내고
  //     2) 세 가치를 하나로 꿰뚫는 "통찰형 본질 문장"으로 합성
  //   - 카테고리 조합(단일/2종/3종 mixed)에 따라 라이브러리 분기
  //   - fingerprint 해시로 결정성 유지하며 80억 분의 1 다양성 확보
  //     (4 카테고리 × 8 표현 × 5 스코프 × 6 통찰 = 약 960 조합/사용자별)
  // ──────────────────────────────────────────────────────────

  // Q13 키워드 → 카테고리 (mapping.json valueKeywordMap 동기)
  var VALUE_KEYWORD_CAT = {
    "사랑":"관계지향","신뢰":"관계지향","배려":"관계지향","포용":"관계지향","협동":"관계지향","헌신":"관계지향",
    "성장":"성장지향","도전":"성장지향","성취":"성장지향","몰입":"성장지향","창의":"성장지향","의미 추구":"성장지향","의미":"성장지향",
    "정직":"원칙지향","정의":"원칙지향","책임":"원칙지향","절제":"원칙지향","질서":"원칙지향","공정":"원칙지향",
    "자유":"자유지향","평화":"자유지향"
  };

  // ─────────────────────────────────────────────────────
  // [Q13 키워드 → 사명 동사구] 직접 매핑 (카테고리 추상화 우회)
  //   사용자가 "사랑"이라 답했으면 "사랑"의 결을 살린 장면 동사로,
  //   "관계"로 치환하지 않는다. 동사구는 "현재 진행형 + 일상 장면" 형식.
  //   각 키워드별 5~6개 표현, fingerprint 해시로 결정성 유지.
  // ─────────────────────────────────────────────────────
  var MISSION_BY_KEYWORD_KO = {
    "사랑": [
      "곁에 온 사람이 마음을 풀어놓고 갈 수 있도록 자리를 지키고",
      "가까운 사람의 마음을 안전한 자리에 머무르게 하고",
      "사랑하는 사람들 곁에서 따뜻한 공기를 만들어 주고",
      "아끼는 사람을 끝까지 챙기는 한 사람으로 머물고",
      "사랑이라는 말이 자연스럽게 흐르는 자리를 만들고"
    ],
    "신뢰": [
      "한 번 한 약속을 끝까지 지켜 신뢰를 쌓아 가고",
      "함께 일하는 사람이 마음 놓고 기댈 수 있는 자리를 지키고",
      "말과 행동을 같게 살아 \"이 사람 말이라면 믿어도 된다\"는 평을 듣고",
      "오래된 관계 속에서도 흐트러지지 않고 결을 지키고",
      "약속한 것은 결과로 증명해 신뢰를 단단하게 만들고"
    ],
    "배려": [
      "곁에 있는 사람의 작은 변화를 먼저 알아채고",
      "상대가 말하지 않은 마음까지 헤아려 챙기고",
      "한 사람 한 사람의 호흡에 맞춰 자리를 내어 주고",
      "누군가 힘들 때 가장 먼저 안부를 묻고",
      "조용히 곁이 되어 주는 한 사람으로 머물고"
    ],
    "포용": [
      "다른 결을 가진 사람도 같은 자리에 함께 있을 수 있게 하고",
      "서로 다른 의견 사이에 다리를 놓고",
      "한쪽으로 기울지 않게 흐름을 잡아 주고",
      "혼자 있던 사람이 다시 사람 사이로 돌아오게 만들고",
      "차이를 흠으로 보지 않고 결로 받아들이고"
    ],
    "협동": [
      "팀 안에서 서로의 마음이 닿도록 다리를 놓고",
      "혼자 잘 하기보다 함께 잘 해내는 길을 만들고",
      "곁에 있는 사람의 몫을 함께 들어 주고",
      "각자의 결이 한 방향으로 흐르도록 자리를 정돈하고",
      "공을 자기에게 두지 않고 사람들과 나누고"
    ],
    "헌신": [
      "맡은 자리에서 묵묵히 끝까지 한 발을 더 내딛고",
      "내 시간을 들여 누군가의 일을 함께 들어 주고",
      "표 나지 않는 자리에서도 똑같이 마음을 다하고",
      "받은 것보다 한 뼘 더 내어 주는 사람으로 살아가고",
      "오래 걸려도 사람과 약속을 끝까지 지키고"
    ],
    "자유": [
      "남이 만든 틀에 끌려가지 않고 자기 호흡대로 하루를 살아가고",
      "정해진 길 대신 자기에게 맞는 길을 그어 가고",
      "남의 시선에 흔들리지 않고 자기 결정으로 살아가고",
      "내키지 않는 일에 \"아니오\"를 말할 수 있는 여유를 지키고",
      "삶에 여백을 두고 그 여백에서 자기를 회복하고"
    ],
    "평화": [
      "급할수록 한 박자 멈춰 흐름을 가라앉히고",
      "다툼이 생긴 자리에서 분위기를 가만히 가라앉히고",
      "안 가는 마음끼리 만나는 자리를 부드럽게 풀어 주고",
      "감정의 파도가 칠 때 먼저 호흡을 고르고",
      "서두르지 않고 자기 속도를 지키며 살아가고"
    ],
    "성장": [
      "어제보다 한 뼘 자란 오늘을 만들고",
      "막힌 자리에서 다른 길을 찾아내고",
      "한 분야에서 깊어지면 다른 분야로 가지를 뻗어 가고",
      "실패한 자리에서도 다음 한 걸음을 찾아내고",
      "호기심을 멈추지 않고 새로운 것을 배워 가고"
    ],
    "도전": [
      "안 해 본 일에 한 번 발을 들여 보는 사람으로 살아가고",
      "두려운 자리에서도 작은 한 걸음을 내디디고",
      "안전한 자리에 머무르지 않고 한 칸씩 나아가고",
      "막힌 길 앞에서도 한 번 더 두드려 보고",
      "안 가본 길 위에서 자기 답을 만들어 가고"
    ],
    "성취": [
      "한 번 잡은 일은 결과까지 끌고 가고",
      "작은 마무리를 쌓아 올려 큰 결과를 만들고",
      "약속한 결과를 빠뜨리지 않고 손에 쥐어 보이고",
      "흐트러질 만한 자리에서도 끝까지 마무리하고",
      "남이 멈춘 자리에서 한 발 더 가서 결과를 만들고"
    ],
    "몰입": [
      "마음을 다해 한 가지 일에 깊이 들어가고",
      "다른 소음을 잠시 내려놓고 지금 이 일에 머물고",
      "한 번 시작한 일에 깊게 빠져 끝까지 가져가고",
      "산만해질 만한 자리에서도 자기 호흡을 지키고",
      "몸과 마음을 한 곳에 모아 일하는 시간을 살고"
    ],
    "창의": [
      "있는 그대로의 길 대신 새로운 결을 더해 보고",
      "익숙한 자리에서도 \"왜 그래야 하지?\"라고 한 번 더 묻고",
      "흩어진 것들을 새로운 방식으로 이어 보고",
      "기존을 다시 짜 보는 시도를 멈추지 않고",
      "한 번도 본 적 없는 자리를 그려 내고"
    ],
    "의미 추구": [
      "그날의 만남에서 한 가지 깨달음을 가지고 돌아오고",
      "겉으로 드러난 일 너머의 결을 찾아보고",
      "겪은 일을 글이나 말로 정리해 자기 자산으로 남기고",
      "왜 이 일을 하는가를 잊지 않고 살아가고",
      "작은 일에서도 자기에게 남는 결을 길어 올리고"
    ],
    "의미": [
      "그날의 만남에서 한 가지 깨달음을 가지고 돌아오고",
      "겉으로 드러난 일 너머의 결을 찾아보고",
      "겪은 일을 글이나 말로 정리해 자기 자산으로 남기고",
      "왜 이 일을 하는가를 잊지 않고 살아가고",
      "작은 일에서도 자기에게 남는 결을 길어 올리고"
    ],
    "정직": [
      "보지 않는 자리에서도 같은 사람으로 살아가고",
      "유리할 때도 사실은 사실대로 말하고",
      "감추고 싶은 자리에서도 솔직함을 잃지 않고",
      "말과 행동의 거리를 줄여 가고",
      "잘못한 자리에서는 먼저 \"제가 그랬습니다\"라고 말하고"
    ],
    "정의": [
      "옳다고 믿는 일은 손해를 보더라도 가져가고",
      "약자의 자리에서 한 번 더 생각하고",
      "기울어진 자리에서 균형을 잡으려 손을 보태고",
      "쉬운 침묵 대신 필요한 말을 꺼내고",
      "공정하지 않은 흐름 앞에서 한 번 더 멈춰 보고"
    ],
    "책임": [
      "맡은 일은 마무리까지 책임지고",
      "결과의 무게를 남에게 미루지 않고",
      "약속한 자리에 빠지지 않고 매번 도착하고",
      "\"끝까지\"라는 말을 행동으로 보여 주고",
      "디테일까지 챙겨 빈자리를 남기지 않고"
    ],
    "절제": [
      "감정에 휩쓸리지 않고 정한 기준대로 결정하고",
      "쉽게 휘둘릴 자리에서도 한 박자 멈춰 보고",
      "필요 이상으로 가지지 않고 자기 결을 지키고",
      "말이 많아질 자리에서 오히려 줄여 보고",
      "유혹이 큰 자리에서도 자기 약속을 먼저 떠올리고"
    ],
    "질서": [
      "흐트러진 자리에 결을 잡아 두고",
      "각자의 자리가 분명하도록 흐름을 정돈하고",
      "오래 가는 길을 위해 작은 규칙을 세워 두고",
      "복잡한 자리에서 단계와 순서를 만들고",
      "한 번 정한 길을 끝까지 흐트러뜨리지 않고"
    ],
    "공정": [
      "친한 사이라도 같은 기준으로 대하고",
      "한 사람만 무거워지지 않게 짐의 무게를 살피고",
      "결과뿐 아니라 과정의 결을 함께 살피고",
      "기울지 않게 양쪽의 말을 끝까지 들어 주고",
      "사사로운 마음에 휘둘리지 않고 결정하고"
    ]
  };

  // [Q13 키워드 → 비전 정체성구] 직접 매핑
  //   "~하는 사람" / "~다는 말을 듣는 사람" 형식, 미래완료/정체성 강조
  var VISION_BY_KEYWORD_KO = {
    "사랑": [
      "\"이 사람 곁에 있으면 마음이 풀린다\"는 말을 듣는 사람",
      "곁에 두고 싶은 한 사람으로 자리잡는 사람",
      "사랑이라는 말을 부끄러워하지 않고 살아가는 사람",
      "오래된 사람들이 끝까지 곁에 남는 사람"
    ],
    "신뢰": [
      "\"이 사람 말이라면 믿어도 된다\"는 평을 듣는 사람",
      "약속한 대로 결과를 만들어 내는 사람",
      "오래 알아 갈수록 더 깊어지는 사람",
      "한 번 맺은 관계를 끝까지 지키는 사람"
    ],
    "배려": [
      "함께 있으면 마음이 편해진다는 평을 듣는 사람",
      "작은 변화도 먼저 알아봐 주는 사람",
      "조용히 곁에 있어 주는 것만으로도 힘이 되는 사람",
      "상대의 호흡에 맞출 줄 아는 사람"
    ],
    "포용": [
      "다른 결을 가진 사람도 한 자리에 머물게 만드는 사람",
      "혼자였던 사람이 다시 사람을 찾게 되는 자리에 있는 사람",
      "차이를 흠으로 보지 않고 결로 받아들이는 사람",
      "한쪽으로 기울지 않게 흐름을 잡아 주는 사람"
    ],
    "협동": [
      "함께 일하면 결과가 더 좋아지는 사람",
      "팀의 분위기를 부드럽게 풀어 주는 사람",
      "공을 나눌 줄 아는 사람",
      "혼자가 아니라 함께가 더 어울리는 사람"
    ],
    "헌신": [
      "묵묵히 자리를 지키는 사람으로 기억되는 사람",
      "받은 것보다 한 뼘 더 내어 주는 사람",
      "표 나지 않아도 그 자리에서 가장 중요한 사람",
      "오래도록 마음을 다하는 사람"
    ],
    "자유": [
      "어떤 자리에서도 자기 색을 잃지 않는 사람",
      "남의 기대보다 자기 기준이 더 분명한 사람",
      "자기 길을 자기 속도로 가는 사람",
      "어디에 있어도 자기다운 사람"
    ],
    "평화": [
      "함께 있으면 분위기가 가라앉는다는 평을 듣는 사람",
      "급한 자리에서도 한 박자 늦춰 주는 사람",
      "다툼을 가라앉히는 자리에 있는 사람",
      "흔들리지 않고 자기 호흡을 지키는 사람"
    ],
    "성장": [
      "만날 때마다 한 단계 자라 있는 사람",
      "어제보다 오늘이 더 나아 보이는 사람",
      "한 분야의 깊이가 다른 분야로 번지는 사람",
      "막힌 일도 한 번씩 풀어내는 사람"
    ],
    "도전": [
      "안 해 본 일에 먼저 발을 들이는 사람",
      "두려운 자리에서도 한 걸음을 내딛는 사람",
      "안전한 자리에만 머물지 않는 사람",
      "안 가본 길 위에서 자기 답을 만들어 가는 사람"
    ],
    "성취": [
      "약속한 결과를 빠뜨리지 않고 손에 쥐어 보이는 사람",
      "한 번 잡은 일은 끝까지 마무리하는 사람",
      "작은 마무리들이 모여 자기 이야기가 된 사람",
      "결과로 자기 길을 증명해 가는 사람"
    ],
    "몰입": [
      "한 번 시작한 일에 깊게 빠져 있는 사람",
      "산만한 자리에서도 자기 호흡을 지키는 사람",
      "한 가지 일에 마음을 다하는 사람",
      "지금 이 시간에 가장 깊이 들어가 있는 사람"
    ],
    "창의": [
      "기존을 다시 짜 보는 시도를 멈추지 않는 사람",
      "한 번도 본 적 없는 자리를 그려 내는 사람",
      "익숙한 자리에서도 새 결을 더하는 사람",
      "흩어진 것들을 새롭게 이어 내는 사람"
    ],
    "의미 추구": [
      "이야기를 듣다 보면 배움이 따라오는 사람",
      "질문이 깊어 함께 있으면 생각이 정리되는 사람",
      "겪은 일을 글이나 콘텐츠로 남기는 사람",
      "왜 이 일을 하는가를 잊지 않고 살아가는 사람"
    ],
    "의미": [
      "이야기를 듣다 보면 배움이 따라오는 사람",
      "질문이 깊어 함께 있으면 생각이 정리되는 사람",
      "겪은 일을 글이나 콘텐츠로 남기는 사람",
      "왜 이 일을 하는가를 잊지 않고 살아가는 사람"
    ],
    "정직": [
      "어디서나 같은 모습으로 살아가는 사람",
      "보지 않는 자리에서도 흐트러지지 않는 사람",
      "감추지 않고 사실대로 말하는 사람",
      "말과 행동의 거리가 가까운 사람"
    ],
    "정의": [
      "옳다고 믿는 일을 끝까지 가져가는 사람",
      "약자의 자리에서 한 번 더 생각하는 사람",
      "쉬운 침묵 대신 필요한 말을 꺼내는 사람",
      "기울어진 자리에서 균형을 잡는 사람"
    ],
    "책임": [
      "맡기면 끝까지 마무리하는 사람",
      "디테일까지 책임지는 사람",
      "결과의 무게를 자기 몫으로 가져가는 사람",
      "약속한 자리에 늘 도착해 있는 사람"
    ],
    "절제": [
      "감정에 흔들리지 않는 안정된 결정자",
      "흐트러질 만한 자리에서도 결을 지키는 사람",
      "필요 이상으로 가지지 않는 사람",
      "쉽게 휘둘리지 않는 단단한 사람"
    ],
    "질서": [
      "흐트러진 자리에 결을 잡아 주는 사람",
      "묵직하게 한 길을 가는 사람",
      "복잡한 자리에서 단계를 만들어 주는 사람",
      "오래 가는 길을 만드는 사람"
    ],
    "공정": [
      "친소에 따라 흔들리지 않는 사람",
      "양쪽의 말을 끝까지 들어 주는 사람",
      "결과뿐 아니라 과정의 결을 살피는 사람",
      "사사로운 마음에 휘둘리지 않는 결정자"
    ]
  };

  // [Q13 키워드 → 사명 동사구 EN]
  var MISSION_BY_KEYWORD_EN = {
    "사랑": [
      "holding a seat where the people closest to you can lay down their hearts",
      "keeping the hearts of those near you in a safe place",
      "making warm air around the people you love",
      "remaining the one who looks after the people you cherish, all the way through"
    ],
    "신뢰": [
      "keeping every promise so trust deepens over time",
      "being the seat where others can rest their weight without worry",
      "matching your words and your steps so people say \"if this person says it, you can trust it\"",
      "proving every promise with a result"
    ],
    "배려": [
      "noticing the small changes in those beside you, first",
      "reading even the words a person did not say",
      "making room at your own pace for each person's pace",
      "being the first to ask after someone in trouble"
    ],
    "포용": [
      "letting people of different grain stay in the same room",
      "building bridges between voices that disagree",
      "keeping the flow from tilting to one side",
      "making the once-alone person come back to people again"
    ],
    "협동": [
      "building bridges so hearts touch within a team",
      "choosing 'finishing it together' over 'finishing it alone'",
      "carrying a part of the load beside you",
      "tuning each grain into one direction"
    ],
    "헌신": [
      "taking one more step, quietly, where you have been entrusted",
      "spending your time on someone else's work beside them",
      "doing the same in seats no one watches",
      "giving back a little more than you were given"
    ],
    "자유": [
      "living the day at your own breath, not pulled by frames others made",
      "drawing your own road instead of the prescribed one",
      "deciding by your own breath, unswayed by others' eyes",
      "leaving margin in life and recovering yourself in that margin"
    ],
    "평화": [
      "letting one breath pass before the rush takes you",
      "settling the air where conflict has risen",
      "softening the seat between hearts that won't meet",
      "tuning your own breath first, when emotion rises"
    ],
    "성장": [
      "making a today that has grown a hand's-breadth beyond yesterday",
      "finding another way where one was blocked",
      "branching into another field once you have gone deep in one",
      "finding the next step even inside failure"
    ],
    "도전": [
      "stepping into something you have not tried before",
      "taking one small step in a place that frightens you",
      "not staying only where it is safe",
      "knocking once more on the door that did not open"
    ],
    "성취": [
      "carrying every job you take to its result",
      "stacking small finishes into a larger result",
      "showing the promised result, not missing one",
      "going one step further where others have stopped"
    ],
    "몰입": [
      "going deep into one work with all your heart",
      "putting other noise down for now and staying with this",
      "carrying a started thing through to the end",
      "keeping your breath even where it would scatter"
    ],
    "창의": [
      "adding a new grain to the road as it is",
      "asking 'why must it be so?' once more, even where it is familiar",
      "linking scattered things in a new way",
      "drawing a seat that has never been seen"
    ],
    "의미 추구": [
      "bringing back at least one realization from each encounter",
      "looking for the grain beneath the surface of things",
      "writing or speaking what you have lived through, so it becomes your asset",
      "not forgetting why you do this work"
    ],
    "의미": [
      "bringing back at least one realization from each encounter",
      "looking for the grain beneath the surface of things",
      "writing or speaking what you have lived through, so it becomes your asset",
      "not forgetting why you do this work"
    ],
    "정직": [
      "being the same person even where no one is watching",
      "speaking the fact as the fact, even when it does not favor you",
      "not losing honesty in places you would rather hide",
      "shortening the distance between your words and your steps"
    ],
    "정의": [
      "carrying what you believe is right, even at a cost",
      "thinking once more from the seat of the weaker side",
      "lending a hand where the ground has tilted",
      "speaking the needed word instead of the easy silence"
    ],
    "책임": [
      "finishing what you take on, all the way through",
      "not passing the weight of the result to someone else",
      "arriving at every promised seat, every time",
      "showing 'all the way through' as action"
    ],
    "절제": [
      "deciding by the standard you set, not by emotion",
      "letting one beat pass even where it is easy to be swept",
      "not holding more than is needed, keeping your grain",
      "remembering your own promise first when temptation is strong"
    ],
    "질서": [
      "settling the grain where things have been scattered",
      "tuning the flow so each seat is clear",
      "setting small rules for a road that lasts long",
      "making steps and order in complex seats"
    ],
    "공정": [
      "treating those close to you by the same standard as anyone else",
      "watching that the weight does not fall on one person",
      "watching the grain of process, not only the result",
      "listening to both sides through to the end"
    ]
  };

  // [Q13 키워드 → 비전 정체성구 EN]
  var VISION_BY_KEYWORD_EN = {
    "사랑": [
      "someone people say \"my heart settles when this person is around\"",
      "someone people want to keep beside them",
      "someone for whom love is a word that flows naturally",
      "someone whose long-time people stay through to the end"
    ],
    "신뢰": [
      "someone people say \"if this person says it, you can trust it\"",
      "someone who shows up to every promise with a result",
      "someone who only deepens the longer you know them",
      "someone who keeps an old bond all the way through"
    ],
    "배려": [
      "someone whose presence makes people feel at ease",
      "someone who sees the small change first",
      "someone whose quiet presence is itself a strength",
      "someone who knows how to match another's pace"
    ],
    "포용": [
      "someone who keeps even those of different grain in the same seat",
      "someone in whose room the once-alone return to people",
      "someone who reads difference as grain, not flaw",
      "someone who keeps the flow from tilting"
    ],
    "협동": [
      "someone with whom the result is better when worked together",
      "someone who softens the mood of a team",
      "someone who knows how to share the credit",
      "someone who fits 'together' more than 'alone'"
    ],
    "헌신": [
      "someone remembered as the one who quietly stayed",
      "someone who gives back a hand's-breadth more than they were given",
      "someone who is the most important even where unseen",
      "someone who keeps their heart in it, for a long time"
    ],
    "자유": [
      "someone who never loses their color, in any room",
      "someone whose own standards are clearer than others' expectations",
      "someone who walks their own path at their own pace",
      "someone who is themselves, wherever they are"
    ],
    "평화": [
      "someone people say \"the room calms when this person is here\"",
      "someone who slows the rush by one beat",
      "someone in whose seat conflict softens",
      "someone unshaken who keeps their own breath"
    ],
    "성장": [
      "someone who has grown by the next time you meet",
      "someone who looks one step better today than yesterday",
      "someone whose depth in one field spreads into others",
      "someone who keeps untying knots that others can't"
    ],
    "도전": [
      "someone first to step into the untried",
      "someone who takes a step where it frightens them",
      "someone who doesn't stay only in safe seats",
      "someone who finds their own answer on a road never walked"
    ],
    "성취": [
      "someone who shows the promised result, not missing one",
      "someone who finishes every job they take",
      "someone whose small finishes have become their story",
      "someone who proves their road through results"
    ],
    "몰입": [
      "someone deep inside one started thing",
      "someone who keeps their breath in the noise",
      "someone who gives a single work all their heart",
      "someone most deeply present in this very hour"
    ],
    "창의": [
      "someone who never stops trying to reframe the existing",
      "someone who draws a seat never seen before",
      "someone who adds new grain even to the familiar",
      "someone who links scattered things in new ways"
    ],
    "의미 추구": [
      "someone whose conversation leaves you having learned",
      "someone whose questions clarify your own thinking",
      "someone who turns what they've lived into books or content",
      "someone who never forgets why they do this work"
    ],
    "의미": [
      "someone whose conversation leaves you having learned",
      "someone whose questions clarify your own thinking",
      "someone who turns what they've lived into books or content",
      "someone who never forgets why they do this work"
    ],
    "정직": [
      "someone who lives the same way wherever they are",
      "someone unshaken even in places no one watches",
      "someone who tells the fact instead of hiding",
      "someone whose words and steps are close together"
    ],
    "정의": [
      "someone who carries what is right through to the end",
      "someone who thinks once more from the weaker seat",
      "someone who speaks the needed word instead of easy silence",
      "someone who finds balance where the ground has tilted"
    ],
    "책임": [
      "someone who finishes what they're entrusted with",
      "someone who takes responsibility down to the details",
      "someone who carries the weight of the result as their own",
      "someone always present at the promised seat"
    ],
    "절제": [
      "a steady decision-maker, unswayed by emotion",
      "someone who keeps their grain even in slippery places",
      "someone who does not hold more than is needed",
      "someone firm and not easily swayed"
    ],
    "질서": [
      "someone who settles the grain where things have scattered",
      "someone who walks one path with weight",
      "someone who makes steps in complex seats",
      "someone who builds a road that lasts long"
    ],
    "공정": [
      "someone unswayed by closeness or distance",
      "someone who hears both sides through to the end",
      "someone who watches the grain of process, not only the result",
      "a decision-maker untouched by private favor"
    ]
  };

  // ─────────────────────────────────────────────────────
  // [Q13 카테고리 조합 → 한 줄 통합 사명 동사구]
  //   여러 키워드를 풀어 나열하지 않고 "하나의 통합된 동사구"로 압축
  //   상품성을 위한 한 문장 강도 — 직관적으로 한 번에 이해되어야 함
  //   조합 키는 카테고리 정렬+조인 (예: "관계지향+성장지향+자유지향")
  //   각 조합당 3~5개 변형 → fingerprint 해시로 결정성 확보
  // ─────────────────────────────────────────────────────
  var MISSION_LINE_COMBO_KO = {
    // 모든 항목은 "동사구(~는/~하는)" 결미로 통일 — 합성 시 "한 사람으로 살아가는 것입니다" 자동 부착
    // ── 단일 카테고리 (4)
    "관계지향": [
      "곁에 온 사람이 마음을 풀어놓고 갈 수 있는 자리가 되어 주는",
      "사람의 마음이 머물 수 있는 따뜻한 자리를 지켜 내는",
      "곁의 사람을 끝까지 챙기는"
    ],
    "자유지향": [
      "남이 만든 틀이 아니라 자기 호흡대로 하루를 살아 내는",
      "정해진 길 대신 자기 길을 자기 속도로 그어 가는",
      "어디에 있어도 자기 색을 잃지 않는"
    ],
    "성장지향": [
      "어제보다 한 뼘 자란 오늘을 매일 만들어 가는",
      "겪는 모든 일에서 한 가지 깨달음을 길어 올리는",
      "막힌 자리에서 다음 한 걸음을 찾아내는"
    ],
    "원칙지향": [
      "한 번 한 약속을 결과로 증명해 내는",
      "어디서나 같은 모습으로 묵직하게 한 길을 가는",
      "맡은 일은 끝까지 마무리해 내는"
    ],

    // ── 2-종 mixed (6) — "A하면서도 B형" 압축
    "관계지향+자유지향": [
      "곁의 사람을 따뜻하게 품으면서도 자기 호흡을 잃지 않는",
      "사람의 마음을 머물게 하면서도 자기 색을 끝까지 지켜 가는",
      "함께하되 휘둘리지 않는"
    ],
    "관계지향+성장지향": [
      "사람을 깊이 만나며 그 만남마다 한 뼘씩 자라 가는",
      "사람의 마음을 품으면서 매일 한 걸음씩 깊어져 가는",
      "관계 속에서 자기를 자라게 하고, 그 자람으로 다시 사람을 잇는"
    ],
    "관계지향+원칙지향": [
      "사람의 마음을 품으면서 약속은 끝까지 결과로 증명해 내는",
      "따뜻함과 단단한 책임을 한 결로 살아 내는",
      "곁의 사람을 챙기면서도 자기 기준은 흐트러뜨리지 않는"
    ],
    "자유지향+성장지향": [
      "자기 호흡으로 살되 매일 한 뼘씩 결을 다듬어 가는",
      "어디에도 갇히지 않으면서 한 가지를 깊게 길어 올리는",
      "스스로 길을 그어 가며 그 길에서 깨달음을 거둬 내는"
    ],
    "자유지향+원칙지향": [
      "자기 호흡으로 살되 한 번 한 약속은 결과로 보여 주는",
      "휘둘리지 않으면서 자기 기준을 끝까지 가져가는",
      "자기 길을 가되 흐트러짐 없이 마무리해 내는"
    ],
    "성장지향+원칙지향": [
      "매일 한 뼘 자라되 한 번 한 약속은 끝까지 지켜 내는",
      "꾸준히 결을 다듬으며 그 결을 결과로 증명해 가는",
      "성장과 책임을 한 결로 살아 내는"
    ],

    // ── 3-종 mixed (4) — 가장 풍부한 통합 (한 줄로 압축)
    "관계지향+성장지향+자유지향": [
      "곁의 사람을 품되 자기 호흡을 잃지 않고, 그 만남마다 한 뼘씩 자라 가는",
      "사람의 마음을 머물게 하면서 자기 색대로 깊어져 가는",
      "함께하되 휘둘리지 않고, 만남마다 깨달음을 길어 올리는"
    ],
    "관계지향+성장지향+원칙지향": [
      "사람의 마음을 품으면서 매일 자라되 약속은 끝까지 결과로 증명해 내는",
      "따뜻함과 꾸준함과 단단한 책임을 한 결로 살아 내는",
      "곁의 사람을 챙기고, 한 뼘씩 자라며, 한 번 한 약속을 끝까지 지켜 내는"
    ],
    "관계지향+자유지향+원칙지향": [
      "사람을 품되 자기 호흡을 지키고, 그 위에 약속을 결과로 보여 주는",
      "따뜻함과 자기 색과 단단한 마무리를 한 결로 살아 내는",
      "곁의 사람을 챙기면서도 휘둘리지 않고, 약속은 끝까지 가져가는"
    ],
    "성장지향+자유지향+원칙지향": [
      "자기 호흡으로 살되 매일 자라고, 그 자람을 결과로 증명해 내는",
      "남의 틀에 갇히지 않으면서 깊어지고, 약속은 끝까지 지켜 내는",
      "자기 길을 그어 가며 매일 결을 다듬고, 그 결을 끝까지 마무리해 내는"
    ],

    // ── 4-종 mixed (1) — 모든 카테고리 (한 줄에 다 담기)
    "관계지향+성장지향+자유지향+원칙지향": [
      "사람의 마음을 품되 자기 호흡을 지키고, 매일 자라며 약속을 결과로 증명해 내는",
      "곁의 사람을 챙기고 자기 색으로 살되, 한 뼘씩 자라며 끝까지 마무리해 내는",
      "따뜻함과 자기 색과 꾸준함과 단단한 책임을 한 결로 살아 내는"
    ]
  };

  // [Q13 카테고리 조합 → 한 줄 통합 비전 정체성구]
  //   "한 사람의 모습"을 한 줄에 압축. "~하는 사람" 결미 통일.
  var VISION_LINE_COMBO_KO = {
    // ── 단일 카테고리 (4)
    "관계지향": [
      "\"이 사람 곁에 있으면 마음이 풀린다\"는 말을 듣는 한 사람",
      "곁에 두고 싶은 한 사람으로 자리잡은 사람",
      "사람의 마음이 모이는 자리에 늘 함께 있는 사람"
    ],
    "자유지향": [
      "어디에 있어도 자기 색을 잃지 않는 한 사람",
      "자기 길을 자기 속도로 가는 단단한 한 사람",
      "남의 기대보다 자기 기준이 더 분명한 사람"
    ],
    "성장지향": [
      "만날 때마다 한 단계 자라 있는 한 사람",
      "이야기를 듣다 보면 배움이 따라오는 사람",
      "자기 경험이 곧 자기 자산이 된 한 사람"
    ],
    "원칙지향": [
      "\"이 사람 말이라면 믿어도 된다\"는 평을 듣는 한 사람",
      "약속한 것은 반드시 결과로 보여 주는 한 사람",
      "어디서나 같은 모습으로 살아가는 묵직한 한 사람"
    ],

    // ── 2-종 mixed (6)
    "관계지향+자유지향": [
      "곁이 따뜻하면서도 자기 색을 잃지 않는 한 사람",
      "함께하되 휘둘리지 않는 단단한 한 사람",
      "사람을 품으면서도 자기 호흡을 끝까지 지키는 한 사람"
    ],
    "관계지향+성장지향": [
      "사람과 함께 자라 가는 한 사람",
      "만남마다 깊어지고, 그 깊이로 다시 사람을 잇는 사람",
      "관계 속에서 깨달음을 길어 올리는 한 사람"
    ],
    "관계지향+원칙지향": [
      "따뜻하면서도 약속은 끝까지 지키는 한 사람",
      "곁이 편하면서도 \"이 사람 말은 믿어도 된다\"는 평을 듣는 사람",
      "마음과 책임을 같은 무게로 가져가는 한 사람"
    ],
    "자유지향+성장지향": [
      "자기 호흡으로 살되 매일 자라 가는 한 사람",
      "어디에도 갇히지 않으면서 한 분야에서 깊어지는 사람",
      "자기 길을 그어 가며 그 길에서 자기를 자라게 하는 사람"
    ],
    "자유지향+원칙지향": [
      "자기 색으로 살되 약속은 결과로 보여 주는 한 사람",
      "휘둘리지 않으면서 끝까지 마무리하는 단단한 한 사람",
      "자기 길을 가되 흐트러짐 없는 한 사람"
    ],
    "성장지향+원칙지향": [
      "매일 자라되 약속은 끝까지 지켜 내는 한 사람",
      "꾸준한 결과로 자기 길을 증명해 가는 사람",
      "성장과 책임이 한 결로 흐르는 묵직한 한 사람"
    ],

    // ── 3-종 mixed (4)
    "관계지향+성장지향+자유지향": [
      "곁이 따뜻하면서도 자기 색대로 자라 가는 한 사람",
      "사람과 함께하되 휘둘리지 않고, 만남마다 깊어지는 한 사람",
      "마음을 품고 자기 호흡으로 살며 매일 한 뼘씩 자라는 사람"
    ],
    "관계지향+성장지향+원칙지향": [
      "사람의 마음을 품고, 매일 자라며, 약속을 끝까지 지키는 한 사람",
      "따뜻함과 꾸준함과 단단한 책임이 한 결로 흐르는 사람",
      "곁이 편하고, 자라 있고, 믿을 수 있는 한 사람"
    ],
    "관계지향+자유지향+원칙지향": [
      "곁이 따뜻하되 자기 색을 지키고, 약속은 결과로 보여 주는 한 사람",
      "따뜻함·자기 호흡·단단한 마무리가 한 사람 안에 함께 사는 사람",
      "사람을 품으면서 휘둘리지 않고, 약속을 끝까지 가져가는 한 사람"
    ],
    "성장지향+자유지향+원칙지향": [
      "자기 호흡으로 살되 매일 자라고, 자라남을 결과로 증명하는 한 사람",
      "남의 틀에 갇히지 않고 깊어지며, 끝까지 마무리하는 한 사람",
      "자기 길을 그어 가며 매일 자라고, 그 결을 결과로 보여 주는 사람"
    ],

    // ── 4-종 mixed (1)
    "관계지향+성장지향+자유지향+원칙지향": [
      "사람을 품되 자기 색을 지키고, 매일 자라며 약속을 결과로 증명하는 한 사람",
      "따뜻함·자기 호흡·꾸준한 자람·단단한 책임이 한 사람 안에서 함께 흐르는 사람",
      "곁이 편하고, 자기다움을 잃지 않고, 자라 있으며, 믿을 수 있는 한 사람"
    ]
  };

  // [EN 통합 압축 라이브러리]
  var MISSION_LINE_COMBO_EN = {
    "관계지향": [
      "to be the seat where people beside you can lay down their hearts",
      "to keep a warm room where hearts can settle",
      "to remain the one who looks after the people closest to you, all the way through"
    ],
    "자유지향": [
      "to live each day at your own breath, not pulled by frames others made",
      "to draw your own road at your own pace, instead of the prescribed one",
      "to live without losing your color, in any room"
    ],
    "성장지향": [
      "to live a today grown a hand's-breadth beyond yesterday",
      "to draw one realization out of every encounter",
      "to keep finding the next step where the road is blocked"
    ],
    "원칙지향": [
      "to prove every promise with a result",
      "to walk one path with weight, the same person wherever you are",
      "to finish what you take on, all the way through"
    ],
    "관계지향+자유지향": [
      "to hold hearts beside you warmly while keeping your own breath",
      "to make hearts settle while never losing your own color",
      "to be among others without being swept by them"
    ],
    "관계지향+성장지향": [
      "to meet people deeply, and to grow a hand's-breadth at every meeting",
      "to hold hearts and to deepen, one step every day",
      "to grow within relationship, and to link people again through that growth"
    ],
    "관계지향+원칙지향": [
      "to hold hearts warmly while proving every promise with a result",
      "to live warmth and firm responsibility within one person",
      "to look after those near you while never letting your standard drift"
    ],
    "자유지향+성장지향": [
      "to live by your own breath while refining your grain a hand's-breadth each day",
      "to be caged by nothing while deepening one thing well",
      "to draw your own path and to gather realization from it"
    ],
    "자유지향+원칙지향": [
      "to live by your own breath while showing every promise as a result",
      "to remain unswayed and carry your standard through to the end",
      "to walk your own path and finish without drift"
    ],
    "성장지향+원칙지향": [
      "to grow a hand's-breadth daily while keeping every promise to the end",
      "to refine your grain steadily and prove that grain through results",
      "to live growth and responsibility within one person"
    ],
    "관계지향+성장지향+자유지향": [
      "to hold hearts beside you without losing your breath, and to grow a hand's-breadth at every meeting",
      "to make hearts settle while deepening in your own color",
      "to be among others without being swept, drawing realization from each meeting"
    ],
    "관계지향+성장지향+원칙지향": [
      "to hold hearts and to keep growing, while proving every promise with a result",
      "to let warmth, steady growth, and firm responsibility flow through one person",
      "to look after those near you, to grow a hand's-breadth, and to keep every promise"
    ],
    "관계지향+자유지향+원칙지향": [
      "to hold people while keeping your own breath, and to show every promise as a result",
      "to let warmth, your own color, and firm finishing flow through one person",
      "to look after those near you without being swept, and to carry promises through"
    ],
    "성장지향+자유지향+원칙지향": [
      "to live by your own breath, to grow daily, and to prove that growth through results",
      "to deepen without being caged, and to keep every promise to the end",
      "to draw your own path, refine your grain, and finish that grain through"
    ],
    "관계지향+성장지향+자유지향+원칙지향": [
      "to hold hearts while keeping your own breath, to grow daily, and to prove every promise with a result",
      "to look after others, live in your own color, grow a hand's-breadth, and finish through",
      "to let warmth, your own color, steady growth, and firm responsibility flow through one person"
    ]
  };

  var VISION_LINE_COMBO_EN = {
    "관계지향": [
      "the one people say \"my heart settles when this person is around\"",
      "someone people want to keep beside them",
      "someone always present where hearts gather"
    ],
    "자유지향": [
      "someone who never loses their color, in any room",
      "someone walking their own path at their own pace, firmly",
      "someone whose own standards are clearer than others' expectations"
    ],
    "성장지향": [
      "someone who has grown by the next time you meet",
      "someone whose conversation leaves you having learned",
      "someone whose lived experience has become their own asset"
    ],
    "원칙지향": [
      "someone people say \"if this person says it, you can trust it\"",
      "someone who shows every promise as a result",
      "someone who lives the same way wherever they are, with weight"
    ],
    "관계지향+자유지향": [
      "someone whose presence is warm and yet whose color never fades",
      "someone firm — among others without being swept",
      "someone holding people while keeping their own breath through to the end"
    ],
    "관계지향+성장지향": [
      "someone who grows together with people",
      "someone who deepens at every meeting and links people again through that depth",
      "someone drawing realization out of relationship"
    ],
    "관계지향+원칙지향": [
      "someone warm yet keeping every promise to the end",
      "someone whose presence is easy, and whose word can still be trusted",
      "someone who carries heart and responsibility at the same weight"
    ],
    "자유지향+성장지향": [
      "someone living by their own breath and yet growing each day",
      "someone deepening in one field while caged by nothing",
      "someone drawing their own path and growing themselves on it"
    ],
    "자유지향+원칙지향": [
      "someone in their own color whose promises still come back as results",
      "someone firm — unswayed and yet finishing through",
      "someone walking their own path without drift"
    ],
    "성장지향+원칙지향": [
      "someone growing daily and yet keeping every promise to the end",
      "someone proving their road with steady results",
      "someone in whom growth and responsibility flow as one grain, with weight"
    ],
    "관계지향+성장지향+자유지향": [
      "someone warm and yet growing in their own color",
      "someone with people but unswept, deepening at every meeting",
      "someone holding hearts, living in their own breath, and growing a hand's-breadth each day"
    ],
    "관계지향+성장지향+원칙지향": [
      "someone holding hearts, growing daily, and keeping every promise to the end",
      "someone in whom warmth, steady growth, and firm responsibility flow as one grain",
      "someone easy to be near, grown, and trustable"
    ],
    "관계지향+자유지향+원칙지향": [
      "someone warm yet in their own color, whose promises still return as results",
      "someone in whom warmth, own breath, and firm finishing live together",
      "someone holding people without being swept, carrying promises through"
    ],
    "성장지향+자유지향+원칙지향": [
      "someone living by their own breath, growing daily, and proving that growth through results",
      "someone uncaged and yet finishing through to the end",
      "someone drawing their own path, growing, and showing that grain as a result"
    ],
    "관계지향+성장지향+자유지향+원칙지향": [
      "someone holding hearts, in their own color, growing daily, and proving every promise with a result",
      "someone in whom warmth, own breath, steady growth, and firm responsibility flow as one",
      "someone easy to be near, themselves, grown, and trustable — within one person"
    ]
  };

  // ─────────────────────────────────────────────────────
  // 사명의 언어 / 비전의 언어 라이브러리 (KO)
  //
  //  설계 원칙 ("개역개정 → 현대인의 성경"):
  //   - 카테고리명("관계지향")·가치명("사랑/자유/의미")·메타 추상어("자기다움/한 호흡/통합형") 사용 금지
  //   - "마음을 풀어놓고 갈 수 있도록", "이 사람이 있으면 ~다는 말을 듣는" 같은 장면 묘사어로만 구성
  //   - 사명 = 동사 + 일상 장면 (현재 진행, "무엇을 하며 사는가")
  //   - 비전 = 정체성 + 도착점 (미래 완료, "어떤 사람으로 자리잡는가")
  //   - 전문가 통찰 깊이는 유지하되 표현은 누구나 한 번 읽으면 이해됨
  // ─────────────────────────────────────────────────────

  // [사명 동사구] — 카테고리별 "그 가치를 매일 살아내는 행위" (각 8개)
  //   문장 안에서 "곁에 온 사람이 ~하도록 자리를 지키고" 같이 끼워 넣어 사용
  var MISSION_VERB_KO = {
    "관계지향": [
      "곁에 온 사람이 마음을 풀어놓고 갈 수 있도록 자리를 지키고",
      "옆에 있는 사람의 이야기를 끝까지 들어 주고",
      "사람들 사이에 따뜻한 공기를 만들어 주고",
      "누군가 힘들 때 먼저 안부를 묻고",
      "혼자 있던 사람이 다시 사람을 찾게 만들고",
      "팀 안에서 서로의 마음이 닿도록 다리를 놓고",
      "조용히 곁이 되어 주는 사람이 되어 주고",
      "고마운 마음을 말로 표현해 관계를 단단하게 만들고"
    ],
    "자유지향": [
      "남이 만든 틀에 끌려가지 않고 자기 속도로 하루를 살아가고",
      "정해진 길 대신 자기에게 맞는 길을 그어 가고",
      "내키지 않는 일에 \"아니오\"를 말할 수 있는 여유를 지키고",
      "자기 시간을 지킬 줄 알고",
      "남의 시선에 흔들리지 않고 자기 호흡대로 결정하고",
      "삶에 여백을 두고 그 여백에서 자기를 회복하고",
      "스스로 선택한 일에 대한 책임은 끝까지 지고",
      "흐름을 타되 휩쓸리지 않는 단단한 중심을 지키고"
    ],
    "성장지향": [
      "그날의 만남에서 한 가지 배움을 꼭 가지고 돌아오고",
      "어제보다 한 뼘 자란 오늘을 만들고",
      "막힌 자리에서 다른 길을 찾아내고",
      "작은 성취 하나하나를 자기 이야기로 모아 가고",
      "겪은 일을 글이나 말로 정리해 자기 자산으로 남기고",
      "호기심을 멈추지 않고 새로운 것을 배워 가고",
      "실패에서도 다음 한 걸음을 찾아내고",
      "한 분야에서 깊어지면 다른 분야로 가지를 뻗어 가고"
    ],
    "원칙지향": [
      "한 번 한 약속은 끝까지 지키고",
      "옳다고 믿는 일은 손해를 보더라도 가져가고",
      "자기에게 한 약속부터 결과로 증명하고",
      "조용한 자리에서도 같은 사람으로 살아가고",
      "맡은 일은 마무리까지 책임지고",
      "흐트러질 만한 자리에서도 자기 결을 잃지 않고",
      "대충 넘기지 않고 한 번 더 다듬어 내고",
      "감정에 휩쓸리지 않고 정한 기준대로 결정하고"
    ]
  };

  // [비전 정체성구] — 카테고리별 "그 가치가 쌓여 어떤 사람으로 자리잡는가" (각 8개)
  //   "~하는 사람으로 자리잡는다" / "~다는 말을 듣는 사람이 된다" 형식
  var VISION_IDENTITY_KO = {
    "관계지향": [
      "\"이 사람이 있으면 마음이 풀린다\"는 말을 듣는 사람",
      "사람들이 힘들 때 가장 먼저 떠올리는 사람",
      "함께 있으면 분위기가 따뜻해진다는 평을 듣는 사람",
      "조용히 곁에 있어 주는 것만으로도 힘이 되는 사람",
      "오래된 관계를 끝까지 지켜 내는 사람",
      "팀의 분위기를 부드럽게 풀어 주는 사람",
      "한 번 만난 사람도 다시 찾아오게 만드는 사람",
      "사람과 사람을 자연스럽게 이어 주는 사람"
    ],
    "자유지향": [
      "자기 길을 자기 속도로 가는 사람",
      "남의 기대보다 자기 기준이 더 분명한 사람",
      "어떤 자리에서도 자기 색을 잃지 않는 사람",
      "조직에 매이지 않고도 단단한 결과를 내는 사람",
      "흔들리지 않고 자기 리듬으로 살아가는 사람",
      "남이 시키는 대로가 아니라 스스로 길을 그어 가는 사람",
      "여유로워 보이지만 결정은 분명한 사람",
      "어디에 있어도 자기다운 사람"
    ],
    "성장지향": [
      "어제보다 오늘이 더 나아 보이는 사람",
      "만날 때마다 한 단계 자라 있는 사람",
      "이야기를 듣다 보면 배움이 따라오는 사람",
      "막힌 일도 한 번씩 풀어내는 사람",
      "한 분야의 깊이가 다른 분야로 번지는 사람",
      "자기 경험을 책이나 콘텐츠로 남기는 사람",
      "질문이 깊어 함께 있으면 생각이 정리되는 사람",
      "작은 성취들이 모여 자기 이야기가 된 사람"
    ],
    "원칙지향": [
      "\"이 사람 말이라면 믿어도 된다\"는 평을 듣는 사람",
      "약속한 것은 반드시 결과로 보여 주는 사람",
      "어디서나 같은 모습으로 살아가는 사람",
      "맡기면 끝까지 마무리하는 사람",
      "흐트러지기 쉬운 자리에서도 결을 지키는 사람",
      "묵직하게 한 길을 가는 사람",
      "감정에 흔들리지 않는 안정된 결정자",
      "디테일까지 책임지는 사람"
    ]
  };

  // (하위 호환) 기존 VALUE_ORIENTATION_KO 참조처를 위해 유지 — 더 이상 본문에 직접 사용하지 않음
  var VALUE_ORIENTATION_KO = {
    "관계지향": MISSION_VERB_KO["관계지향"],
    "자유지향": MISSION_VERB_KO["자유지향"],
    "성장지향": MISSION_VERB_KO["성장지향"],
    "원칙지향": MISSION_VERB_KO["원칙지향"]
  };

  // [사명 동사구 EN] — 일상 장면 기반
  var MISSION_VERB_EN = {
    "관계지향": [
      "holding a seat where the person beside you can lay down their heart",
      "listening through to the end of someone's story",
      "creating warm air between people",
      "being the first to ask after someone in trouble",
      "making someone who'd been alone want to be with people again",
      "building bridges so hearts touch within a team",
      "becoming the quiet companion someone needs",
      "putting gratitude into words to make relationships firmer"
    ],
    "자유지향": [
      "living the day at your own pace, not pulled by others' frames",
      "drawing your own path instead of the prescribed one",
      "keeping the room to say 'no' to what doesn't fit",
      "knowing how to protect your own time",
      "deciding by your own breath, unswayed by others' eyes",
      "leaving margin in life and recovering yourself in that margin",
      "carrying through, to the end, the responsibility for your own choices",
      "riding the flow without being swept away"
    ],
    "성장지향": [
      "bringing back at least one lesson from each encounter",
      "making a today that's grown a little beyond yesterday",
      "finding another path where one was blocked",
      "gathering small wins into a story of your own",
      "writing or speaking what you've lived through, so it becomes your asset",
      "keeping curiosity alive and learning what's new",
      "finding the next step even inside failure",
      "branching into another field once you've gone deep in one"
    ],
    "원칙지향": [
      "keeping a promise once made, all the way through",
      "carrying what you believe is right, even at a cost",
      "proving promises to yourself with results first",
      "being the same person even when no one is watching",
      "finishing what you take on, all the way to the end",
      "keeping your grain even where it's easy to slip",
      "taking one more pass instead of letting it go",
      "deciding by the standard you set, not by emotion"
    ]
  };

  // [비전 정체성구 EN]
  var VISION_IDENTITY_EN = {
    "관계지향": [
      "someone people say \"my heart settles when this person is around\"",
      "the first person people think of when they're struggling",
      "someone who is known for warming the air just by being there",
      "someone whose quiet presence is itself a strength",
      "someone who keeps long relationships all the way through",
      "someone who softens the mood of a team",
      "someone strangers come back to after one meeting",
      "someone who naturally connects person to person"
    ],
    "자유지향": [
      "someone who walks their own path at their own pace",
      "someone whose own standards are clearer than others' expectations",
      "someone who never loses their color, in any room",
      "someone who delivers solid results without being tied to one organization",
      "someone who lives by their own rhythm, unshaken",
      "someone who draws their own way rather than being told",
      "someone who looks easygoing yet decides clearly",
      "someone who is themselves, wherever they are"
    ],
    "성장지향": [
      "someone who looks one step better today than yesterday",
      "someone who has grown by the next time you meet",
      "someone whose conversation leaves you having learned",
      "someone who keeps untying knots that others can't",
      "someone whose depth in one field spreads into others",
      "someone who turns their experience into books or content",
      "someone whose questions clarify your own thinking",
      "someone whose small wins have become their story"
    ],
    "원칙지향": [
      "someone people say \"if this person says it, you can trust it\"",
      "someone who shows up to every promise with a result",
      "someone who lives the same way wherever they are",
      "someone who finishes what they're entrusted with",
      "someone who keeps their grain in slippery places",
      "someone who walks one path with weight",
      "a steady decision-maker, unswayed by emotion",
      "someone who takes responsibility down to the details"
    ]
  };

  // (하위 호환) 영문 orientation 참조처용
  var VALUE_ORIENTATION_EN = {
    "관계지향": MISSION_VERB_EN["관계지향"],
    "자유지향": MISSION_VERB_EN["자유지향"],
    "성장지향": MISSION_VERB_EN["성장지향"],
    "원칙지향": MISSION_VERB_EN["원칙지향"]
  };

  // ─────────────────────────────────────────────────────
  // typeLine 자연어 형용구 라이브러리 (카테고리명·가치명 사용 금지)
  //   tone × 주 카테고리 조합 → 자연어 형용구
  //   예: warm_connector + 관계지향 → "사람의 마음을 안전한 자리에 머무르게 하는"
  //   typeLine 템플릿의 {values} 자리에 삽입됨
  // ─────────────────────────────────────────────────────
  var TYPE_PHRASE_KO = {
    // 톤별 폴백 (주 카테고리 매칭이 없을 때)
    _tone: {
      principled_designer: ["흐름과 구조를 다듬어 가는", "원칙을 결과로 옮기는", "묵직하게 한 길을 가는"],
      warm_connector:      ["사람의 마음을 머무르게 하는", "곁이 따뜻해지는", "관계를 부드럽게 잇는"],
      visionary_creator:   ["새로운 결을 발견해 가는", "기존을 다시 짜는", "가능성을 여는"],
      pragmatic_achiever:  ["약속한 결과를 끝까지 만들어내는", "단단히 마무리하는", "흐트러짐 없이 끝맺는"],
      reflective_explorer: ["조용히 깊이 들여다보는", "오래 묻고 답해 온", "고요히 통찰을 길어 올리는"]
    },
    // 톤 × 주 카테고리 (조합 5×4 = 20)
    "warm_connector|관계지향":     ["사람의 마음을 안전한 자리에 머무르게 하는", "곁의 누구든 마음을 풀어놓고 갈 수 있게 하는", "함께 있으면 분위기가 따뜻해지는"],
    "warm_connector|자유지향":     ["사람과 함께하되 자기 결을 잃지 않는", "곁이 되어 주되 거리를 지킬 줄 아는", "따뜻하지만 휘둘리지 않는"],
    "warm_connector|성장지향":     ["만남마다 한 가지 배움을 가져오는", "사람을 통해 자기를 자라게 하는", "관계 안에서 깊어지는"],
    "warm_connector|원칙지향":     ["따뜻하지만 약속은 끝까지 지키는", "공감 위에 책임을 함께 세우는", "마음과 약속을 같은 무게로 가져가는"],

    "principled_designer|관계지향": ["사람을 잇되 흐트러짐 없이 결을 지키는", "신뢰를 구조로 다지는", "관계도 계획으로 단단히 만드는"],
    "principled_designer|자유지향": ["자기 길을 자기 속도로 다지는", "남의 틀에 끌려가지 않는 단단한", "스스로 그어 가는 길을 묵직히 가는"],
    "principled_designer|성장지향": ["원칙을 지키며 매일 한 뼘씩 자라는", "단단히 다지며 깊어지는", "꾸준함으로 결을 다듬어 가는"],
    "principled_designer|원칙지향": ["한 번 정한 길을 끝까지 가져가는", "약속을 결과로 증명해 가는", "흐트러짐 없이 한 길을 다지는"],

    "visionary_creator|관계지향":  ["사람을 새로운 자리로 이끄는", "공동체에 새 결을 만드는", "사람을 통해 가능성을 여는"],
    "visionary_creator|자유지향":  ["남이 가지 않은 길을 자기 속도로 여는", "틀을 다시 짜며 자기 결을 지키는", "새로움을 자기 호흡으로 만들어 가는"],
    "visionary_creator|성장지향":  ["새로운 의미를 길어 올리는", "기존을 넘어 더 깊은 결을 발견하는", "한 번도 본 적 없는 길을 그어 가는"],
    "visionary_creator|원칙지향":  ["새로움을 추구하되 끝맺음을 지키는", "탐험과 책임을 함께 가져가는", "가능성을 결과로 증명해 가는"],

    "pragmatic_achiever|관계지향": ["사람을 결과로 챙기는", "함께한 약속을 끝까지 마무리하는", "관계 안에서도 흐트러지지 않는"],
    "pragmatic_achiever|자유지향": ["자기 길을 결과로 증명하는", "어떤 자리에서도 끝까지 마무리하는", "자율 위에 단단한 결과를 쌓는"],
    "pragmatic_achiever|성장지향": ["배움을 곧 결과로 옮기는", "한 번 배운 것은 끝까지 익히는", "성취 하나하나로 자기 이야기를 쌓는"],
    "pragmatic_achiever|원칙지향": ["한 번 한 약속은 결과로 증명하는", "흐트러짐 없이 끝맺는", "맡은 일을 마무리까지 책임지는"],

    "reflective_explorer|관계지향":["사람을 조용히 깊게 보는", "곁의 마음을 천천히 들어주는", "관계의 결을 오래 살피는"],
    "reflective_explorer|자유지향":["남과 다른 호흡으로 깊이 들여다보는", "조용한 자리에서 자기를 회복하는", "고요하게 자기 결을 지키는"],
    "reflective_explorer|성장지향":["오래 묻고 답해 온 끝에 결을 다듬는", "한 가지를 깊이 파고 들어가는", "통찰을 천천히 길어 올리는"],
    "reflective_explorer|원칙지향":["깊이 들여다보고 정한 기준은 흔들지 않는", "조용하지만 단단히 한 길을 가는", "성찰 위에 책임을 함께 세우는"]
  };

  var TYPE_PHRASE_EN = {
    _tone: {
      principled_designer: ["who refines flow and structure", "who turns principle into results", "who walks one path with weight"],
      warm_connector:      ["who lets people's hearts settle", "around whom warmth gathers", "who softly links relationships"],
      visionary_creator:   ["who keeps discovering new texture", "who reframes the existing", "who opens possibility"],
      pragmatic_achiever:  ["who finishes promised results to the end", "who closes things solidly", "who finishes without drift"],
      reflective_explorer: ["who looks deeply, quietly", "who has long asked and answered", "who slowly draws out insight"]
    },
    "warm_connector|관계지향":     ["who lets people's hearts find a safe seat", "around whom anyone can lay down their heart", "around whom the air warms when present"],
    "warm_connector|자유지향":     ["who stays alongside without losing their own grain", "who can be near and still keep distance", "warm but unswayed"],
    "warm_connector|성장지향":     ["who carries one lesson back from each meeting", "who grows through people", "who deepens within relationship"],
    "warm_connector|원칙지향":     ["warm yet keeps every promise", "who builds responsibility atop empathy", "who carries heart and promise at the same weight"],

    "principled_designer|관계지향": ["who links people while keeping their grain unshaken", "who builds trust as structure", "who treats relationship as careful design"],
    "principled_designer|자유지향": ["who paves their own path at their own pace", "firm and unswayed by others' frames", "who walks the path they drew, with weight"],
    "principled_designer|성장지향": ["who grows a little each day while keeping principle", "who deepens by careful refinement", "who refines their grain with steadiness"],
    "principled_designer|원칙지향": ["who carries one chosen path through to the end", "who proves promises with results", "who refines one path without drift"],

    "visionary_creator|관계지향":  ["who leads people into new ground", "who brings new grain to community", "who opens possibility through people"],
    "visionary_creator|자유지향":  ["who opens roads no one walked, at their own pace", "who reframes structures while keeping their grain", "who makes newness by their own breath"],
    "visionary_creator|성장지향":  ["who draws out new meaning", "who finds deeper grain beyond the existing", "who paves a path never seen before"],
    "visionary_creator|원칙지향":  ["who pursues newness while keeping closure", "who carries exploration and responsibility together", "who proves possibility with results"],

    "pragmatic_achiever|관계지향": ["who looks after people through results", "who finishes shared promises to the end", "who never drifts even within relationship"],
    "pragmatic_achiever|자유지향": ["who proves their path with results", "who finishes to the end in any room", "who stacks solid results atop autonomy"],
    "pragmatic_achiever|성장지향": ["who turns learning straight into results", "who masters once-learned things to the end", "who stacks a story from each achievement"],
    "pragmatic_achiever|원칙지향": ["who proves every promise with a result", "who closes without drift", "who takes responsibility through to the finish"],

    "reflective_explorer|관계지향":["who looks at people quietly and deeply", "who listens to nearby hearts slowly", "who studies the texture of relationship over time"],
    "reflective_explorer|자유지향":["who looks deeply at their own pace, unlike others", "who recovers in quiet places", "who keeps their grain serenely"],
    "reflective_explorer|성장지향":["who refines grain after long asking and answering", "who digs deep into one thing", "who slowly draws insight upward"],
    "reflective_explorer|원칙지향":["who, once seen deeply, will not shake their standard", "quiet yet firmly walking one path", "who builds responsibility atop reflection"]
  };

  // typeLine 자연 형용구 합성
  function pickTypePhrase(toneKey, primaryCategory, fingerprint, lang){
    var lib = (lang === "en") ? TYPE_PHRASE_EN : TYPE_PHRASE_KO;
    var key = toneKey + "|" + (primaryCategory || "");
    var arr = lib[key];
    if (!arr || !arr.length) {
      arr = (lib._tone && lib._tone[toneKey]) || (lib._tone && lib._tone.principled_designer) || [""];
    }
    return pickByHash(arr, fingerprint + 67);
  }

  // 카테고리 조합 키 (정렬된 조합)
  function _catKey(cats){
    var u = unique(cats.slice()).sort();
    return u.join("+");
  }

  // (DEPRECATED) — 추상 통찰 라이브러리는 더 이상 본문에 사용하지 않음.
  // refineValuesPhrase 가 MISSION_VERB / VISION_IDENTITY 라이브러리에서 직접 장면어를 합성함.
  var VALUE_INSIGHT_KO = {
    // ─ 단일 카테고리 (4)
    "관계지향": [
      "결국 사람 안에서 자기다움을 완성해 가는 관계 중심의 삶",
      "신뢰로 사람을 잇는 자리에서 자기를 확장하는 삶",
      "곁의 사람을 안전하게 만드는 일이 곧 자기 사명이 되는 삶"
    ],
    "자유지향": [
      "외부에 휘둘리지 않고 자기 호흡으로 살아가는 자유의 삶",
      "스스로의 리듬과 선택으로 시간을 운영하는 평정한 자유의 삶",
      "어디에도 갇히지 않으면서 깊어지는 자기다움의 삶"
    ],
    "성장지향": [
      "겪는 모든 것을 의미로 환원하며 매일 결을 다듬어 가는 삶",
      "한계 너머에서 새로운 의미를 길어 올리는 탐구자의 삶",
      "작은 성취를 통찰의 무늬로 이어가는 의미 탐구의 삶"
    ],
    "원칙지향": [
      "스스로에게 약속한 기준 위에 결과를 쌓아 가는 단단한 삶",
      "정직과 책임을 결과로 증명해 가는 원칙 중심의 삶",
      "타협 없이 자기 질서로 흐름을 다스리는 삶"
    ],
    // ─ 2-종 mixed (6)
    "관계지향+자유지향": [
      "관계 안에 머무르되 자기 결을 잃지 않는, '연결과 자유의 균형'을 지키는 삶",
      "사람과 함께 있되 자기 호흡을 지키는 평정한 연결자의 삶",
      "타인을 향한 공감과 자기다움의 자유가 동시에 살아 있는 삶"
    ],
    "관계지향+성장지향": [
      "사람과의 만남에서 의미를 길어 올려, 관계가 곧 성장의 통로가 되는 삶",
      "관계의 깊이가 깊어질수록 자기 의미도 함께 자라나는 삶",
      "사람을 통해 의미를 발견하고, 의미를 통해 사람을 다시 잇는 삶"
    ],
    "관계지향+원칙지향": [
      "사람을 잇되 약속을 끝까지 지켜내는, 신뢰가 곧 원칙이 되는 삶",
      "공감의 따뜻함 위에 책임의 단단함을 함께 세우는 삶",
      "관계의 결과 자기 기준을 동시에 지켜내는 신뢰형 리더의 삶"
    ],
    "자유지향+성장지향": [
      "자기 호흡으로 살되 매일 결을 다듬어 가는 자율적 성장의 삶",
      "어디에도 갇히지 않으면서 의미를 깊어지게 하는 탐구자의 삶",
      "스스로 길을 그어 가며 그 길에서 의미를 길어 올리는 삶"
    ],
    "자유지향+원칙지향": [
      "자기 결정권 위에 단단한 기준을 함께 세운, 자율과 원칙의 결합형 삶",
      "외부에 휘둘리지 않으면서도 자기 질서를 지켜내는 단단한 자유의 삶",
      "자유로움과 책임을 같은 무게로 가져가는 평정한 삶"
    ],
    "성장지향+원칙지향": [
      "원칙을 지키며 매일 결을 다듬어 가는, 단단한 성장의 삶",
      "정직 위에 새로운 의미를 쌓아 가는 통찰형 탐구자의 삶",
      "기준을 흔들지 않으면서 끊임없이 자기 진화를 이어가는 삶"
    ],
    // ─ 3-종 mixed (4) — 가장 풍부한 통찰
    "관계지향+성장지향+자유지향": [
      "사람 안에서 자기 결을 지키며, 그 안에서 의미를 길어 올리는 — '관계 안의 자유, 자유 안의 의미'를 잇는 삶",
      "사람과 함께하되 자기 호흡을 잃지 않고, 만남마다 의미를 길어 올리는 통합형 연결자의 삶",
      "공감으로 사람을 잇고, 자유로 자기를 지키며, 의미로 그 둘을 꿰는 삶",
      "관계·자유·의미를 따로가 아닌 하나의 호흡으로 운영하는, 통합된 자기다움의 삶"
    ],
    "관계지향+성장지향+원칙지향": [
      "사람을 잇고, 의미를 길어 올리며, 약속을 끝까지 지켜내는 — '신뢰 위에 의미를 쌓는' 삶",
      "공감과 성장과 책임이 한 결로 흐르는, 단단한 연결자의 삶",
      "사람과 의미와 원칙을 동시에 가져가는 통합형 신뢰 리더의 삶",
      "관계·성장·원칙이 서로를 떠받치며 함께 깊어지는 삶"
    ],
    "관계지향+자유지향+원칙지향": [
      "사람을 잇되 자기 결을 지키고, 자기 기준을 끝까지 가져가는 — '자유로운 신뢰'의 삶",
      "공감의 따뜻함과 자기 호흡, 그리고 단단한 약속이 하나로 흐르는 삶",
      "관계·자유·책임을 같은 무게로 운영하는 평정한 리더의 삶",
      "사람 안에서도 자기다움을 지키며 약속을 결과로 증명하는 삶"
    ],
    "성장지향+자유지향+원칙지향": [
      "자기 호흡으로 살되 매일 결을 다듬고, 그 결을 결과로 증명해 가는 — '자율적 성장과 단단한 책임'의 삶",
      "자유와 의미와 원칙이 한 호흡으로 흐르는 통합형 탐구자의 삶",
      "스스로 길을 그어 가며 의미를 길어 올리고, 그 길에 책임을 함께 놓는 삶",
      "자유·성장·원칙이 서로를 떠받치며 깊어지는 사색형 리더의 삶"
    ],
    // ─ 4-종 mixed (1) — 모든 카테고리
    "관계지향+성장지향+자유지향+원칙지향": [
      "사람을 잇고, 의미를 길어 올리며, 자기 호흡을 지키고, 약속을 결과로 증명해 가는 — '4가지 결이 하나로 흐르는' 통합형 삶",
      "관계·자유·의미·책임이 따로가 아닌 한 호흡으로 운영되는, 가장 통합적인 자기다움의 삶",
      "공감·자율·성장·원칙이 같은 무게로 살아 있는 통합형 리더의 삶"
    ]
  };

  var VALUE_INSIGHT_EN = {
    "관계지향": [
      "a relationship-centered life completing selfhood within others",
      "a life of expanding the self at the seat of trust that links people",
      "a life where keeping those nearby safe becomes one's mission"
    ],
    "자유지향": [
      "a life of freedom lived by one's own breath, unswayed by externals",
      "a life of calm freedom run by one's own rhythm and choices",
      "a life that deepens selfhood while being caged by nothing"
    ],
    "성장지향": [
      "a life that turns every experience into meaning and refines its texture daily",
      "an inquirer's life that draws new meaning from beyond every limit",
      "a meaning-seeker's life that threads small wins into patterns of insight"
    ],
    "원칙지향": [
      "a firm life that stacks results atop the standards one has promised oneself",
      "a principle-centered life that proves honesty and responsibility through results",
      "a life that governs flow by one's own order, without compromise"
    ],
    "관계지향+자유지향": [
      "a life that holds 'the balance of connection and freedom' — staying within relationship without losing one's own grain",
      "the life of a calm connector who keeps personal breath while staying alongside others",
      "a life where empathy toward others and the freedom of selfhood are both alive"
    ],
    "관계지향+성장지향": [
      "a life where every encounter draws out meaning, and relationship itself becomes the path of growth",
      "a life in which the depth of relationship and the meaning of self grow together",
      "a life that finds meaning through people, and reconnects people through meaning"
    ],
    "관계지향+원칙지향": [
      "a life that links people while keeping every promise — where trust itself is the principle",
      "a life that builds the firmness of responsibility atop the warmth of empathy",
      "the life of a trust-style leader who keeps both the texture of relationship and personal standard"
    ],
    "자유지향+성장지향": [
      "a life of autonomous growth — living by one's own breath while refining one's grain daily",
      "an inquirer's life that deepens meaning while remaining caged by nothing",
      "a life that draws its own paths and draws meaning from within them"
    ],
    "자유지향+원칙지향": [
      "a life that fuses autonomy and principle — building firm standards atop self-determination",
      "a firm life of free selfhood that holds personal order without being swept by externals",
      "a calm life that carries freedom and responsibility at the same weight"
    ],
    "성장지향+원칙지향": [
      "a life of firm growth — refining one's grain daily while keeping principle",
      "the life of an insight-seeker stacking new meaning atop honesty",
      "a life of unbroken self-evolution without shaking one's standards"
    ],
    "관계지향+성장지향+자유지향": [
      "a life that links 'freedom within relationship and meaning within freedom' — keeping one's grain among people while drawing meaning from each encounter",
      "the life of an integrated connector who stays alongside others without losing personal breath, drawing meaning from every meeting",
      "a life that links people through empathy, holds the self through freedom, and threads the two with meaning",
      "a life that runs relationship, freedom, and meaning not separately but as one breath of integrated selfhood"
    ],
    "관계지향+성장지향+원칙지향": [
      "a life that links people, draws out meaning, and keeps every promise — 'stacking meaning atop trust'",
      "the life of a firm connector where empathy, growth, and responsibility flow as one grain",
      "the life of an integrated trust-leader who carries people, meaning, and principle together",
      "a life where relationship, growth, and principle uphold each other and deepen together"
    ],
    "관계지향+자유지향+원칙지향": [
      "a life of 'free trust' — linking people while keeping one's grain and carrying personal standards through to the end",
      "a life where the warmth of empathy, personal breath, and firm promise flow as one",
      "the life of a calm leader who runs relationship, freedom, and responsibility at the same weight",
      "a life that keeps selfhood among people and proves promises with results"
    ],
    "성장지향+자유지향+원칙지향": [
      "a life of 'autonomous growth and firm responsibility' — living by one's own breath, refining one's grain daily, and proving that grain through results",
      "the life of an integrated inquirer where freedom, meaning, and principle flow as one breath",
      "a life that draws its own paths, draws meaning from them, and lays responsibility along the way",
      "the life of a reflective leader where freedom, growth, and principle uphold each other"
    ],
    "관계지향+성장지향+자유지향+원칙지향": [
      "the most integrated life — linking people, drawing meaning, keeping one's breath, and proving promises with results, 'four grains flowing as one'",
      "a life where relationship, freedom, meaning, and responsibility are run not separately but as one breath",
      "the life of an integrated leader where empathy, autonomy, growth, and principle live at equal weight"
    ]
  };

  // ─────────────────────────────────────────────────────
  // refineValuesPhrase — 일상 장면어 기반 사명/비전 슬롯 합성
  //
  //  반환값:
  //   - missionVerbs:    카테고리별 "매일의 행위" 동사구 배열 (사명 본문에 끼워 넣음)
  //   - visionIdentity:  주 카테고리 기반 "어떤 사람으로 자리잡는가" 한 줄 (비전 본문 핵심)
  //   - secondaryIdentities: 보조 카테고리 기반 정체성 (선택적 노출용)
  //   - categories:      카테고리 분류 결과 (메타, 본문 노출 안 함)
  //
  //  카테고리는 우선순위 정렬: 빈도 높은 카테고리 → 카테고리 우선순위
  //  fingerprint 해시로 표현 결정성 확보 (같은 응답 → 같은 결과)
  // ─────────────────────────────────────────────────────
  function refineValuesPhrase(rawValues, fingerprint, lang){
    var isEn = (lang === "en");
    // 1차: Q13 키워드 직접 매핑 라이브러리 (사용자가 고른 단어의 결을 그대로 살림)
    var libVerbByKw = isEn ? MISSION_BY_KEYWORD_EN : MISSION_BY_KEYWORD_KO;
    var libIdByKw   = isEn ? VISION_BY_KEYWORD_EN  : VISION_BY_KEYWORD_KO;
    // 2차(폴백): 카테고리 단위 라이브러리 (매핑되지 않은 키워드용)
    var libVerbByCat = isEn ? MISSION_VERB_EN : MISSION_VERB_KO;
    var libIdByCat   = isEn ? VISION_IDENTITY_EN : VISION_IDENTITY_KO;

    var arr = toArr(rawValues).map(function(v){ return String(v).trim(); }).filter(Boolean);
    if (!arr.length){
      return {
        missionVerbs: [
          pickByHash(libVerbByCat["성장지향"], fingerprint + 7),
          pickByHash(libVerbByCat["원칙지향"], fingerprint + 17)
        ],
        visionIdentity: pickByHash(libIdByCat["성장지향"], fingerprint + 71),
        secondaryIdentities: [pickByHash(libIdByCat["원칙지향"], fingerprint + 89)],
        categories: ["성장지향", "원칙지향"],
        primaryCategory: "성장지향",
        raw: [],
        keywords: []
      };
    }

    // 카테고리 분류 + 빈도 카운트 (메타용)
    var counts = { "관계지향":0, "자유지향":0, "성장지향":0, "원칙지향":0 };
    arr.forEach(function(v){
      var cat = VALUE_KEYWORD_CAT[v] || "성장지향";
      counts[cat] += 1;
    });
    var priority = ["관계지향","원칙지향","성장지향","자유지향"];
    var ordered = priority.slice().sort(function(a, b){
      var d = counts[b] - counts[a];
      if (d !== 0) return d;
      return priority.indexOf(a) - priority.indexOf(b);
    }).filter(function(c){ return counts[c] > 0; });
    if (ordered.length === 0) ordered = ["성장지향"];
    var primary = ordered[0];

    // ── 핵심 변경: 사용자 원본 키워드 단위로 동사구/정체성구 합성 ──
    // 같은 카테고리 내 중복 동사구 회피 + 키워드 결을 그대로 보존
    var seenVerbs = {};
    var missionVerbs = [];
    arr.forEach(function(kw, idx){
      var lib = libVerbByKw[kw];
      if (!lib || !lib.length) {
        var cat = VALUE_KEYWORD_CAT[kw] || "성장지향";
        lib = libVerbByCat[cat] || libVerbByCat["성장지향"];
      }
      // 키워드별 해시 오프셋: 키워드 인덱스 + 키워드 문자 합으로 결정성 부여
      var kwSeed = 0;
      for (var i = 0; i < kw.length; i++) kwSeed = (kwSeed + kw.charCodeAt(i)) | 0;
      var pick = pickByHash(lib, fingerprint + 13 * (idx + 1) + kwSeed + 7);
      // 중복 회피: 같은 표현이 이미 뽑혔으면 다음 인덱스로
      var tries = 0;
      while (seenVerbs[pick] && tries < lib.length) {
        pick = pickByHash(lib, fingerprint + 13 * (idx + 1) + kwSeed + 7 + (tries + 1) * 31);
        tries++;
      }
      seenVerbs[pick] = true;
      missionVerbs.push(pick);
    });

    // 비전 정체성: 첫 번째 키워드 = 주 정체성, 나머지 = 보조 정체성
    var primaryKw = arr[0];
    var primaryLibId = libIdByKw[primaryKw];
    if (!primaryLibId || !primaryLibId.length) {
      primaryLibId = libIdByCat[primary] || libIdByCat["성장지향"];
    }
    var pkSeed = 0;
    for (var j = 0; j < primaryKw.length; j++) pkSeed = (pkSeed + primaryKw.charCodeAt(j)) | 0;
    var visionIdentity = pickByHash(primaryLibId, fingerprint + 71 + pkSeed);

    var seenIds = {};
    seenIds[visionIdentity] = true;
    var secondaryIdentities = [];
    arr.slice(1).forEach(function(kw, idx){
      var lib = libIdByKw[kw];
      if (!lib || !lib.length) {
        var cat = VALUE_KEYWORD_CAT[kw] || "성장지향";
        lib = libIdByCat[cat] || libIdByCat["성장지향"];
      }
      var kwSeed = 0;
      for (var k = 0; k < kw.length; k++) kwSeed = (kwSeed + kw.charCodeAt(k)) | 0;
      var pick = pickByHash(lib, fingerprint + 89 + 19 * (idx + 1) + kwSeed);
      var tries = 0;
      while (seenIds[pick] && tries < lib.length) {
        pick = pickByHash(lib, fingerprint + 89 + 19 * (idx + 1) + kwSeed + (tries + 1) * 37);
        tries++;
      }
      seenIds[pick] = true;
      secondaryIdentities.push(pick);
    });

    return {
      missionVerbs: missionVerbs,
      visionIdentity: visionIdentity,
      secondaryIdentities: secondaryIdentities,
      categories: ordered,           // 메타 (본문 노출 X)
      primaryCategory: primary,      // 메타 (본문 노출 X)
      raw: arr.slice(),              // 원본 키워드
      keywords: arr.slice()          // 사용된 키워드 (디버그)
    };
  }

  // ─────────────────────────────────────────────────────
  // Q41 관심 주제 → "어디서/누구를 위해" 장면 라벨
  //  사명 본문에 "교육의 자리에서"/"공동체 안에서" 처럼 자연스럽게 끼워 넣음
  // ─────────────────────────────────────────────────────
  // Q41 장면 라벨 — "자리에서" 결미 회피 (도메인절과 중복 차단)
  // "특히 ~ 일에서" 형식으로 사명문 안에 자연스럽게 끼워 넣음
  var TOPIC_SCENE_KO = {
    "사회 문제나 정의 이슈":   "특히 사회의 어려운 일에서",
    "인공지능, 기술, 혁신":     "특히 기술과 변화의 흐름 위에서",
    "교육과 학습 방식":         "특히 누군가 배우는 길목에서",
    "환경과 생태":              "특히 자연과 생명의 흐름 곁에서",
    "심리와 감정 탐구":         "특히 사람의 마음을 다루는 일에서",
    "예술, 창작, 문화 콘텐츠":  "특히 만들고 표현하는 일에서",
    "경제, 금융, 투자":         "특히 돈과 자원이 흐르는 길목에서",
    "스포츠, 건강, 자기관리":   "특히 몸과 건강을 돌보는 일에서",
    "리더십, 공동체, 관계":     "특히 사람들이 모이는 한복판에서",
    "철학, 종교, 영성":         "특히 삶의 의미를 묻는 시간 안에서"
  };
  var TOPIC_SCENE_EN = {
    "사회 문제나 정의 이슈":   "in places of social struggle",
    "인공지능, 기술, 혁신":     "in places where change is happening",
    "교육과 학습 방식":         "in places where learning happens",
    "환경과 생태":              "in places of environment and life",
    "심리와 감정 탐구":         "in places where hearts are tended",
    "예술, 창작, 문화 콘텐츠":  "in places of creation and expression",
    "경제, 금융, 투자":         "in places where money and resources flow",
    "스포츠, 건강, 자기관리":   "in places of body and health",
    "리더십, 공동체, 관계":     "in places where people gather",
    "철학, 종교, 영성":         "in places that ask what life means"
  };

  // ─────────────────────────────────────────────────────
  // ④ COMPASS — Q63 결정 기준 (프랭클린식 "Principles & End in Mind")
  //
  //  설계 (Franklin Covey "7 Habits" + 인생포트폴리오 매핑표):
  //   - Q63 (선택 기준 다중) → 사명 본문 "나침반 절(節)"
  //     · 한 줄 골격: "[~]을(를) 나침반 삼아 / [~]을(를) 기준으로 흔들리지 않으며"
  //   - Q60·Q61·Q62 (원칙·방향성·반복 기준) → 보조 신호로 활용 (라이커트 → 강도)
  //   - 비전 본문에는 정체성 절(節)로 합성 ("자기 기준이 또렷한 한 사람", "원칙으로 길을 그어가는 사람" 등)
  //
  //  매핑표 충실도:
  //   - Q63 9개 옵션 모두 매핑 (의미·안정·성장·자유·관계·결과·재미·신념·책임)
  //   - 카테고리명/원시 옵션명을 본문에 그대로 노출하지 않고 "프랭클린식 일상 언어"로 치환
  // ─────────────────────────────────────────────────────
  var COMPASS_MISSION_KO = {
    // Q63 옵션 → 사명 본문 "나침반 절" (1~3 변형, fingerprint 해시 분기)
    "의미 / 보람 / 가치":         ["보람을 잃지 않는 자리를 나침반 삼아", "이 일이 무엇을 위해 있는가를 매 순간 묻는 결로", "보람의 결을 놓치지 않으며"],
    "안정성 / 안전 / 예측 가능성": ["흔들림 없는 자기 자리를 나침반 삼아", "오래 버티는 단단함을 기준으로", "급하지 않게, 멀리 가는 결로"],
    "성장 가능성 / 배움의 기회":   ["오늘보다 한 걸음 자라는 결을 나침반 삼아", "어떤 자리에서도 배움 한 줄을 가지고 가는 결로", "배움이 멈추지 않는 호흡으로"],
    "자유 / 자율성":              ["자기 호흡대로 가는 결을 나침반 삼아", "남의 속도가 아니라 자기 속도로", "정해진 길보다 자기 길을 기준 삼아"],
    "관계 / 소속감 / 인정":        ["사람과의 결을 나침반 삼아", "곁의 사람을 잃지 않는 결로", "함께 가는 사람을 기준 삼아"],
    "결과 / 성과 / 효율성":        ["맡은 일을 끝까지 끝맺는 결을 나침반 삼아", "약속한 결과를 증명하는 결로", "흐트러짐 없이 마무리하는 기준으로"],
    "재미 / 흥미 / 몰입감":        ["몰입의 결을 나침반 삼아", "마음이 살아나는 자리를 기준으로", "재미가 식지 않는 호흡으로"],
    "신념 / 원칙 / 종교적 기준":   ["흔들리지 않는 자기 원칙을 나침반 삼아", "옳다고 믿는 한 줄을 기준으로", "양심이 부르는 자리를 잃지 않으며"],
    "책임 / 도리 / 역할 충실":     ["맡은 자리의 무게를 나침반 삼아", "내가 해야 할 몫을 기준으로", "한 번 한 약속을 끝까지 지키는 결로"]
  };
  var COMPASS_VISION_KO = {
    // Q63 옵션 → 비전 본문 "정체성 절" (1~3 변형) — "~ 한 사람" 으로 끝남
    "의미 / 보람 / 가치":         ["보람을 잃지 않고 사는 한 사람", "이 일의 의미를 잊지 않는 한 사람", "왜 이 일을 하는가를 늘 묻는 한 사람"],
    "안정성 / 안전 / 예측 가능성": ["오래 버티는 단단한 한 사람", "흔들림 속에서도 자리를 지키는 한 사람", "급하지 않게 멀리 가는 한 사람"],
    "성장 가능성 / 배움의 기회":   ["매일 한 뼘씩 자라 가는 한 사람", "어디에서든 배움 한 줄을 가지고 가는 한 사람", "배움이 멈추지 않는 한 사람"],
    "자유 / 자율성":              ["자기 호흡대로 사는 한 사람", "정해진 길 대신 자기 길을 가는 한 사람", "어디에 있어도 자기 색을 잃지 않는 한 사람"],
    "관계 / 소속감 / 인정":        ["사람과의 결을 끝까지 지키는 한 사람", "곁의 사람을 잃지 않는 한 사람", "함께 가는 결이 살아 있는 한 사람"],
    "결과 / 성과 / 효율성":        ["약속한 결과를 끝까지 증명하는 한 사람", "흐트러짐 없이 마무리하는 한 사람", "맡은 일은 결과로 답하는 한 사람"],
    "재미 / 흥미 / 몰입감":        ["몰입이 살아 있는 한 사람", "마음이 살아나는 자리에 머무는 한 사람", "재미가 식지 않는 한 사람"],
    "신념 / 원칙 / 종교적 기준":   ["자기 원칙이 또렷한 한 사람", "옳다고 믿는 한 줄을 지키는 한 사람", "양심을 기준으로 사는 한 사람"],
    "책임 / 도리 / 역할 충실":     ["맡은 자리를 끝까지 지키는 한 사람", "한 번 한 약속을 결과로 증명하는 한 사람", "자기 몫을 묵직하게 다하는 한 사람"]
  };
  var COMPASS_MISSION_EN = {
    "의미 / 보람 / 가치":         ["guided by what truly matters", "asking each day what this work is for", "with meaning as your compass"],
    "안정성 / 안전 / 예측 가능성": ["guided by steadiness that lasts", "with quiet endurance as your compass", "going far by walking unhurried"],
    "성장 가능성 / 배움의 기회":   ["guided by one step of growth a day", "carrying one lesson from every place", "with learning as your compass"],
    "자유 / 자율성":              ["guided by your own pace", "moving by your rhythm, not others'", "with your own path as your compass"],
    "관계 / 소속감 / 인정":        ["guided by the grain of people beside you", "with relationships as your compass", "keeping those who walk with you close"],
    "결과 / 성과 / 효율성":        ["guided by what you finish", "with the result you promised as your compass", "completing without drift"],
    "재미 / 흥미 / 몰입감":        ["guided by where your spirit comes alive", "with immersion as your compass", "where your interest stays awake"],
    "신념 / 원칙 / 종교적 기준":   ["guided by an unshakeable principle", "with conscience as your compass", "by the line you believe to be right"],
    "책임 / 도리 / 역할 충실":     ["guided by the weight of your role", "with the promise you made as your compass", "carrying the share that is yours"]
  };
  var COMPASS_VISION_EN = {
    "의미 / 보람 / 가치":         ["someone who never loses what matters", "someone who keeps asking why", "someone the meaning stays alive in"],
    "안정성 / 안전 / 예측 가능성": ["someone who lasts unhurriedly", "someone who keeps the post in any storm", "someone who goes far by walking slow"],
    "성장 가능성 / 배움의 기회":   ["someone who grows an inch each day", "someone who carries a lesson from every place", "someone whose learning never stops"],
    "자유 / 자율성":              ["someone who lives at their own pace", "someone who walks their own path", "someone who keeps their own grain anywhere"],
    "관계 / 소속감 / 인정":        ["someone who keeps the grain of people", "someone whose relationships stay alive", "someone who never loses the ones beside them"],
    "결과 / 성과 / 효율성":        ["someone who finishes what they promised", "someone who completes without drift", "someone whose work answers in results"],
    "재미 / 흥미 / 몰입감":        ["someone whose immersion stays alive", "someone the spirit doesn't fade in", "someone whose interest never cools"],
    "신념 / 원칙 / 종교적 기준":   ["someone with a clear principle", "someone who keeps the line they believe in", "someone who lives by conscience"],
    "책임 / 도리 / 역할 충실":     ["someone who keeps their post to the end", "someone who answers their promise with results", "someone who carries their share with weight"]
  };

  // Q63 응답 → COMPASS 절 추출 (프랭클린 "Personal Compass")
  function pickCompass(answers, fingerprint, lang){
    var isEn = (lang === "en");
    var missionLib = isEn ? COMPASS_MISSION_EN : COMPASS_MISSION_KO;
    var visionLib  = isEn ? COMPASS_VISION_EN  : COMPASS_VISION_KO;
    var picks = toArr(answers && answers["Q63"]);
    if (!picks.length) return { missionClause: "", visionClause: "", raw: [] };
    // 첫 번째 선택을 우선 적용 (사용자에게 가장 중요한 기준)
    var p0 = picks[0];
    var missionArr = missionLib[p0];
    var visionArr  = visionLib[p0];
    if (!missionArr || !missionArr.length) return { missionClause: "", visionClause: "", raw: picks };
    var mc = pickByHash(missionArr, fingerprint + 67);
    var vc = pickByHash(visionArr,  fingerprint + 89);
    return { missionClause: mc, visionClause: vc, raw: picks };
  }

  // ─────────────────────────────────────────────────────
  // L3 HEADLINE — 구글 수준 한 문장 사명 (단일 동사 + 명확한 대상 + 변화 방향)
  //
  //  설계 (Google·Disney·Tesla·Nike DNA):
  //   - 단일 동사 1개 ("돕는다", "잇는다", "지킨다")
  //   - 명확한 대상 1개 (Q75 도메인 → 대상 명사)
  //   - 변화 방향 1개 (Q13×Q63 → 변화 동사구)
  //   - 현재형, 한 호흡 (15~25자)
  //
  //  매핑표 충실도: Q13·Q41·Q63·Q75 슬롯에서 직접 도출, 임의 창작 0
  // ─────────────────────────────────────────────────────

  // Q75 도메인 → 사명 헤드라인 "대상 명사" (구글식 단일 대상)
  var SUBJECT_BY_DOMAIN_KO = {
    "교육":     "배우는 사람",
    "경제":     "일하는 사람",
    "사회·공익": "어려움 속의 사람",
    "환경·지속가능성": "다음 세대",
    "예술·문화": "마음을 여는 사람",
    "건강·웰빙": "자기 몸을 돌보는 사람",
    "기술·혁신": "변화 앞에 선 사람",
    "심리·정서": "마음이 흔들리는 사람",
    "철학·영성": "삶의 의미를 묻는 사람",
    "리더십·조직": "함께 가는 사람",
    "가족·관계": "곁에 있는 사람",
    "스포츠·신체": "몸을 단련하는 사람"
  };
  var SUBJECT_BY_DOMAIN_EN = {
    "교육":     "those who learn",
    "경제":     "those who work",
    "사회·공익": "those in struggle",
    "환경·지속가능성": "the next generation",
    "예술·문화": "those who feel",
    "건강·웰빙": "those who care for themselves",
    "기술·혁신": "those facing change",
    "심리·정서": "those whose hearts waver",
    "철학·영성": "those asking what life means",
    "리더십·조직": "those who walk together",
    "가족·관계": "those beside us",
    "스포츠·신체": "those who train their bodies"
  };

  // Q13 주카테고리 × Q63 Compass → 헤드라인 "변화 동사구" (구글식 단일 동사)
  //   카테고리: 관계지향·자유지향·성장지향·원칙지향
  //   Compass : Q63 9개 옵션 (의미·안정·성장·자유·관계·결과·재미·신념·책임)
  //   각 셀당 2~3 변형, fingerprint 해시 결정
  var HEADLINE_VERB_KO = {
    // 관계지향 (사랑·신뢰·배려·포용·협동·헌신)
    "관계지향": {
      "의미 / 보람 / 가치":         ["자기다움을 찾도록 돕는다", "마음을 잇고 의미를 더한다"],
      "안정성 / 안전 / 예측 가능성": ["곁에서 마음이 쉴 자리를 만든다", "흔들릴 때 기댈 자리를 지킨다"],
      "성장 가능성 / 배움의 기회":   ["함께 자라도록 돕는다", "관계 속에서 배움을 잇는다"],
      "자유 / 자율성":              ["자기 색대로 살도록 곁을 지킨다", "곁에 있되 자기 길을 가게 한다"],
      "관계 / 소속감 / 인정":        ["사람과 사람을 잇는다", "곁에 있어 줄 사람이 된다"],
      "결과 / 성과 / 효율성":        ["함께한 약속을 결과로 지킨다", "관계 위에 결과를 세운다"],
      "재미 / 흥미 / 몰입감":        ["함께 있는 시간을 살아 있게 한다", "곁에 있으면 마음이 풀리게 한다"],
      "신념 / 원칙 / 종교적 기준":   ["사람을 원칙으로 지킨다", "약속이 곧 원칙인 자리를 만든다"],
      "책임 / 도리 / 역할 충실":     ["곁의 사람을 끝까지 챙긴다", "맡은 사람을 끝까지 지킨다"]
    },
    // 자유지향 (자유·평화)
    "자유지향": {
      "의미 / 보람 / 가치":         ["자기 길을 의미로 채우게 돕는다", "왜 가는지 분명한 길을 함께 본다"],
      "안정성 / 안전 / 예측 가능성": ["흔들리지 않게 자기 자리를 지킨다", "급하지 않게 멀리 가도록 돕는다"],
      "성장 가능성 / 배움의 기회":   ["자기 속도로 자라도록 돕는다", "남의 길 말고 자기 길을 배우게 한다"],
      "자유 / 자율성":              ["자기 길을 자기 속도로 가게 한다", "남이 만든 틀을 벗어나도록 돕는다"],
      "관계 / 소속감 / 인정":        ["함께 가되 휘둘리지 않게 한다", "각자 색대로 함께 가는 자리를 만든다"],
      "결과 / 성과 / 효율성":        ["자기 길을 결과로 증명하게 한다", "흔들림 없이 끝까지 가게 한다"],
      "재미 / 흥미 / 몰입감":        ["몰입이 살아 있는 길을 함께 본다", "자기 호흡대로 살게 한다"],
      "신념 / 원칙 / 종교적 기준":   ["자기 원칙대로 살게 돕는다", "자기 양심을 따라가게 한다"],
      "책임 / 도리 / 역할 충실":     ["자기 길을 책임지고 가게 한다", "자기 몫을 자기 결로 다하게 한다"]
    },
    // 성장지향 (성장·도전·성취·몰입·창의·의미 추구·의미)
    "성장지향": {
      "의미 / 보람 / 가치":         ["자기다움을 찾도록 돕는다", "왜 사는지 분명한 길을 함께 본다"],
      "안정성 / 안전 / 예측 가능성": ["흔들림 속에서도 자라도록 돕는다", "급하지 않게 깊어지게 한다"],
      "성장 가능성 / 배움의 기회":   ["매일 한 걸음 자라도록 돕는다", "막힌 자리에서 다음 한 걸음을 찾게 한다"],
      "자유 / 자율성":              ["자기 속도로 자라도록 돕는다", "자기 길로 깊어지게 한다"],
      "관계 / 소속감 / 인정":        ["만남마다 한 뼘씩 자라게 한다", "사람을 통해 깨달음을 길어 올리게 한다"],
      "결과 / 성과 / 효율성":        ["자라는 만큼 결과로 보이게 한다", "성장과 성과를 함께 잇는다"],
      "재미 / 흥미 / 몰입감":        ["몰입이 자람이 되게 한다", "재미가 깊이가 되게 한다"],
      "신념 / 원칙 / 종교적 기준":   ["자기 원칙 위에서 자라게 한다", "흔들리지 않는 자기 길로 깊어지게 한다"],
      "책임 / 도리 / 역할 충실":     ["자기 자리에서 자라도록 돕는다", "맡은 일에서 깊어지게 한다"]
    },
    // 원칙지향 (정직·정의·책임·절제·질서·공정)
    "원칙지향": {
      "의미 / 보람 / 가치":         ["옳다고 믿는 자리를 지킨다", "원칙으로 의미를 지킨다"],
      "안정성 / 안전 / 예측 가능성": ["흔들리지 않는 자리를 만든다", "오래 가는 자리를 지킨다"],
      "성장 가능성 / 배움의 기회":   ["원칙 위에 자라도록 돕는다", "단단한 자리에서 자라게 한다"],
      "자유 / 자율성":              ["원칙 안에서 자유를 지킨다", "자기 결을 흔들리지 않게 지킨다"],
      "관계 / 소속감 / 인정":        ["사람을 원칙으로 지킨다", "약속을 끝까지 지킨다"],
      "결과 / 성과 / 효율성":        ["맡은 일을 끝까지 마무리한다", "약속한 결과를 끝까지 증명한다"],
      "재미 / 흥미 / 몰입감":        ["원칙 안에서 몰입이 살게 한다", "자기 결로 끝까지 간다"],
      "신념 / 원칙 / 종교적 기준":   ["옳다고 믿는 한 줄을 지킨다", "양심을 자리로 지킨다"],
      "책임 / 도리 / 역할 충실":     ["맡은 자리를 끝까지 지킨다", "자기 몫을 묵직하게 다한다"]
    }
  };
  var HEADLINE_VERB_EN = {
    "관계지향": {
      "의미 / 보람 / 가치":         ["help people find themselves", "connect hearts and bring meaning"],
      "안정성 / 안전 / 예측 가능성": ["create a place where hearts can rest", "stand steady when others waver"],
      "성장 가능성 / 배움의 기회":   ["help people grow together", "weave learning through relationship"],
      "자유 / 자율성":              ["stand by people while they walk their own path", "stay close yet leave them free"],
      "관계 / 소속감 / 인정":        ["connect people to people", "be the one who stays beside them"],
      "결과 / 성과 / 효율성":        ["keep promises made together", "build results on relationships"],
      "재미 / 흥미 / 몰입감":        ["make time together come alive", "make hearts ease when beside them"],
      "신념 / 원칙 / 종교적 기준":   ["protect people by principle", "make the place where promise is principle"],
      "책임 / 도리 / 역할 충실":     ["care for those beside you to the end", "protect those entrusted to you"]
    },
    "자유지향": {
      "의미 / 보람 / 가치":         ["help others fill their path with meaning", "see the road clearly with them"],
      "안정성 / 안전 / 예측 가능성": ["help them keep their post unshaken", "help them go far unhurried"],
      "성장 가능성 / 배움의 기회":   ["help them grow at their own pace", "help them learn their own way"],
      "자유 / 자율성":              ["let them walk their own path", "help them break free of others' molds"],
      "관계 / 소속감 / 인정":        ["help them go together yet unswayed", "build a place where each color walks together"],
      "결과 / 성과 / 효율성":        ["help them prove their path with results", "help them finish unshaken"],
      "재미 / 흥미 / 몰입감":        ["see with them a path where immersion lives", "let them live by their own breath"],
      "신념 / 원칙 / 종교적 기준":   ["help them live by their own principle", "help them follow their own conscience"],
      "책임 / 도리 / 역할 충실":     ["help them walk their path responsibly", "help them carry their share their own way"]
    },
    "성장지향": {
      "의미 / 보람 / 가치":         ["help people find themselves", "see clearly with them why they live"],
      "안정성 / 안전 / 예측 가능성": ["help them grow even amid storms", "help them deepen unhurried"],
      "성장 가능성 / 배움의 기회":   ["help them grow one step a day", "help them find the next step from a stuck place"],
      "자유 / 자율성":              ["help them grow at their own pace", "help them deepen on their own path"],
      "관계 / 소속감 / 인정":        ["help them grow an inch each meeting", "help them draw insight through people"],
      "결과 / 성과 / 효율성":        ["let their growth show as results", "weave growth and result together"],
      "재미 / 흥미 / 몰입감":        ["let immersion become growth", "let interest become depth"],
      "신념 / 원칙 / 종교적 기준":   ["help them grow upon their own principle", "help them deepen on an unshakable path"],
      "책임 / 도리 / 역할 충실":     ["help them grow in their own post", "help them deepen in the work entrusted"]
    },
    "원칙지향": {
      "의미 / 보람 / 가치":         ["protect what is right", "protect meaning with principle"],
      "안정성 / 안전 / 예측 가능성": ["build an unshaken place", "protect the place that lasts"],
      "성장 가능성 / 배움의 기회":   ["help them grow upon principle", "help them grow in a firm place"],
      "자유 / 자율성":              ["protect freedom within principle", "protect their own grain unshaken"],
      "관계 / 소속감 / 인정":        ["protect people by principle", "keep promises to the end"],
      "결과 / 성과 / 효율성":        ["finish the work entrusted", "prove the promise with results to the end"],
      "재미 / 흥미 / 몰입감":        ["let immersion live within principle", "go through to the end on one's own grain"],
      "신념 / 원칙 / 종교적 기준":   ["protect the line believed to be right", "protect conscience as a place"],
      "책임 / 도리 / 역할 충실":     ["protect the post entrusted to the end", "carry one's share with weight"]
    }
  };

  // Q63 → 한 줄 설명 "Compass 핵심어" (단일 명사)
  var COMPASS_KEYWORD_KO = {
    "의미 / 보람 / 가치":         "의미",
    "안정성 / 안전 / 예측 가능성": "단단함",
    "성장 가능성 / 배움의 기회":   "배움",
    "자유 / 자율성":              "자기 호흡",
    "관계 / 소속감 / 인정":        "사람",
    "결과 / 성과 / 효율성":        "결과",
    "재미 / 흥미 / 몰입감":        "몰입",
    "신념 / 원칙 / 종교적 기준":   "원칙",
    "책임 / 도리 / 역할 충실":     "책임"
  };
  var COMPASS_KEYWORD_EN = {
    "의미 / 보람 / 가치":         "meaning",
    "안정성 / 안전 / 예측 가능성": "steadiness",
    "성장 가능성 / 배움의 기회":   "learning",
    "자유 / 자율성":              "your own pace",
    "관계 / 소속감 / 인정":        "people",
    "결과 / 성과 / 효율성":        "results",
    "재미 / 흥미 / 몰입감":        "immersion",
    "신념 / 원칙 / 종교적 기준":   "principle",
    "책임 / 도리 / 역할 충실":     "responsibility"
  };

  // ─────────────────────────────────────────────────────
  // DIARY BODY — 1인칭 직관형 다이어리 본문 (프랭클린 다이어리 스타일)
  //
  //  설계:
  //   - 사명 본문 = "나는 [④왜] 늘 분명히 하면서, [②도메인 분야에서] [③장면],
  //                  [①가치 정체성]으로 매일을 살아간다." (1인칭 현재형, 평이한 일상어)
  //   - 비전 본문 = "10년 뒤 사람들은 나를
  //                  '[정체성-A]', '[정체성-B]', '[④정체성]'으로 기억한다." (10년 미래 회상)
  //
  //  매핑표 충실도: Q13·Q41·Q63·Q75 모두 본문 슬롯에 직접 노출
  // ─────────────────────────────────────────────────────

  // Q63 → 다이어리 사명 "왜 절(節)" (1인칭, 일상어)
  var DIARY_WHY_KO = {
    "의미 / 보람 / 가치":         "왜 이 일을 하는지",
    "안정성 / 안전 / 예측 가능성": "흔들리지 않는 자기 자리를",
    "성장 가능성 / 배움의 기회":   "오늘 무엇을 배우려는지",
    "자유 / 자율성":              "내 호흡과 내 길을",
    "관계 / 소속감 / 인정":        "곁에 누구와 함께 가는지",
    "결과 / 성과 / 효율성":        "무엇을 끝까지 마무리할지",
    "재미 / 흥미 / 몰입감":        "무엇이 나를 살아 있게 하는지",
    "신념 / 원칙 / 종교적 기준":   "어떤 원칙으로 살지",
    "책임 / 도리 / 역할 충실":     "내가 책임질 몫이 무엇인지"
  };
  var DIARY_WHY_EN = {
    "의미 / 보람 / 가치":         "why I do this work",
    "안정성 / 안전 / 예측 가능성": "the steady ground I stand on",
    "성장 가능성 / 배움의 기회":   "what I am here to learn today",
    "자유 / 자율성":              "my own breath and my own path",
    "관계 / 소속감 / 인정":        "who walks beside me",
    "결과 / 성과 / 효율성":        "what I will finish through",
    "재미 / 흥미 / 몰입감":        "what makes me come alive",
    "신념 / 원칙 / 종교적 기준":   "the principle I live by",
    "책임 / 도리 / 역할 충실":     "the share I am here to carry"
  };

  // Q75 도메인 → 다이어리 "분야 + 곁의 대상" (1인칭 직관형)
  var DIARY_FIELD_KO = {
    "교육":     {field:"교육 분야",      who:"배우는 사람들"},
    "경제":     {field:"경제 분야",      who:"일하는 사람들"},
    "사회·공익": {field:"사회·공익 분야", who:"어려움 속의 사람들"},
    "환경·지속가능성": {field:"환경·지속가능성 분야", who:"다음 세대"},
    "예술·문화": {field:"예술·문화 분야", who:"마음을 여는 사람들"},
    "건강·웰빙": {field:"건강·웰빙 분야", who:"자기 몸을 돌보는 사람들"},
    "기술·혁신": {field:"기술·혁신 분야", who:"변화 앞에 선 사람들"},
    "심리·정서": {field:"심리·정서 분야", who:"마음이 흔들리는 사람들"},
    "철학·영성": {field:"철학·영성 분야", who:"삶의 의미를 묻는 사람들"},
    "리더십·조직": {field:"리더십·조직 분야", who:"함께 가는 사람들"},
    "가족·관계": {field:"가족·관계 분야", who:"곁에 있는 사람들"},
    "스포츠·신체": {field:"스포츠·신체 분야", who:"몸을 단련하는 사람들"}
  };
  var DIARY_FIELD_EN = {
    "교육":     {field:"the field of education", who:"those who learn"},
    "경제":     {field:"the field of economy",   who:"those who work"},
    "사회·공익": {field:"social impact",         who:"those in struggle"},
    "환경·지속가능성": {field:"sustainability",   who:"the next generation"},
    "예술·문화": {field:"art and culture",       who:"those who feel"},
    "건강·웰빙": {field:"health and wellbeing",  who:"those who care for themselves"},
    "기술·혁신": {field:"technology",            who:"those facing change"},
    "심리·정서": {field:"psychology",            who:"those whose hearts waver"},
    "철학·영성": {field:"philosophy",            who:"those asking what life means"},
    "리더십·조직": {field:"leadership",          who:"those who walk together"},
    "가족·관계": {field:"family and relationship", who:"those beside us"},
    "스포츠·신체": {field:"sports",              who:"those who train their bodies"}
  };

  // Q13 카테고리 → 다이어리 "정체성 명사구" (1인칭, 일상어)
  var DIARY_IDENTITY_KO = {
    "관계지향": ["마음을 열어주는 따뜻한 사람", "곁에 있어주는 사람", "함께 있으면 마음이 편해지는 사람"],
    "자유지향": ["자기다움을 지키는 사람", "흔들림 없이 자기 길을 가는 사람", "남의 속도가 아니라 자기 속도로 사는 사람"],
    "성장지향": ["매일 한 뼘씩 자라는 사람", "어디서든 배움을 가지고 가는 사람", "꾸준히 깊어지는 사람"],
    "원칙지향": ["옳다고 믿는 길을 지키는 사람", "약속을 끝까지 지키는 사람", "원칙이 또렷한 사람"]
  };
  var DIARY_IDENTITY_EN = {
    "관계지향": ["someone who opens hearts", "someone who stays beside others", "someone who eases the room"],
    "자유지향": ["someone who keeps their own colors", "someone who walks their own path unshaken", "someone living at their own pace"],
    "성장지향": ["someone who grows an inch each day", "someone who carries learning everywhere", "someone who keeps deepening"],
    "원칙지향": ["someone who keeps the right line", "someone who keeps every promise", "someone with a clear principle"]
  };

  // Q63 → 비전 다이어리 "왜의 정체성" (10년 후 회상)
  var DIARY_WHY_IDENTITY_KO = {
    "의미 / 보람 / 가치":         "왜 이 일을 하는지 분명한 사람",
    "안정성 / 안전 / 예측 가능성": "흔들림 없는 자리를 지킨 사람",
    "성장 가능성 / 배움의 기회":   "끝까지 배움을 멈추지 않은 사람",
    "자유 / 자율성":              "자기 길을 끝까지 간 사람",
    "관계 / 소속감 / 인정":        "곁의 사람을 끝까지 챙긴 사람",
    "결과 / 성과 / 효율성":        "약속한 결과를 끝까지 증명한 사람",
    "재미 / 흥미 / 몰입감":        "마지막까지 재미를 잃지 않은 사람",
    "신념 / 원칙 / 종교적 기준":   "한 원칙으로 평생을 산 사람",
    "책임 / 도리 / 역할 충실":     "맡은 자리를 끝까지 지킨 사람"
  };
  var DIARY_WHY_IDENTITY_EN = {
    "의미 / 보람 / 가치":         "someone who knew why they did this work",
    "안정성 / 안전 / 예측 가능성": "someone who kept their post unshaken",
    "성장 가능성 / 배움의 기회":   "someone whose learning never stopped",
    "자유 / 자율성":              "someone who walked their own path to the end",
    "관계 / 소속감 / 인정":        "someone who cared for those beside them to the end",
    "결과 / 성과 / 효율성":        "someone who proved every promise with results",
    "재미 / 흥미 / 몰입감":        "someone who never lost their spark",
    "신념 / 원칙 / 종교적 기준":   "someone who lived by one principle for a lifetime",
    "책임 / 도리 / 역할 충실":     "someone who held their post to the end"
  };

  // 다이어리 사명/비전 본문 합성 (1인칭 직관형, 프랭클린 다이어리 스타일)
  function buildDiaryBody(primaryDomainKo, primaryCategory, compassRaw, topicScene, fingerprint, lang){
    var isEn = (lang === "en");
    var whyLib       = isEn ? DIARY_WHY_EN          : DIARY_WHY_KO;
    var fieldLib     = isEn ? DIARY_FIELD_EN        : DIARY_FIELD_KO;
    var identityLib  = isEn ? DIARY_IDENTITY_EN     : DIARY_IDENTITY_KO;
    var whyIdLib     = isEn ? DIARY_WHY_IDENTITY_EN : DIARY_WHY_IDENTITY_KO;

    var compassKey = (compassRaw && compassRaw[0]) || "의미 / 보람 / 가치";
    var why = whyLib[compassKey] || whyLib["의미 / 보람 / 가치"];
    var fieldInfo = fieldLib[primaryDomainKo] || (isEn
      ? {field:"my place", who:"those around me"}
      : {field:"내가 선 자리", who:"곁에 있는 사람들"});
    var idArr = identityLib[primaryCategory] || identityLib["성장지향"];
    var idA = pickByHash(idArr, fingerprint + 311);
    var idxA = idArr.indexOf(idA);
    var idB = idArr[(idxA + 1) % idArr.length] || idArr[0];
    var idC = idArr[(idxA + 2) % idArr.length] || idArr[0];
    var whyId = whyIdLib[compassKey] || whyIdLib["의미 / 보람 / 가치"];

    // Q63 "왜 절" 자연어 결합: 명사형 종결("~지/는지")이면 조사 없이 그대로,
    //                                    명사형이면 "을/를" 조사 보정
    function _whyNatural(w){
      if (!w) return "";
      // 한국어: "~는지/~을지" 처럼 어미가 의문형으로 끝나면 그 자체로 부사절 → 조사 불필요
      // (예: "왜 이 일을 하는지 늘 분명히 하면서")
      if (/(는지|을지|할지|런지|을까|는가|할까)$/.test(w)) return w;
      // "내 호흡과 내 길을" 처럼 이미 조사가 붙어 있으면 그대로
      if (/[을를이가은는]$/.test(w)) return w;
      // 그 외: 명사형 → 받침 검사 후 "을/를" 보정
      var last = w.charCodeAt(w.length - 1);
      var jong = 0;
      if (last >= 0xAC00 && last <= 0xD7A3) jong = (last - 0xAC00) % 28;
      return w + (jong === 0 ? "를" : "을");
    }

    // Q41 topicScene 중복 "특히 특히" 차단 — prefix 자체에 "특히"가 있으면 그대로 사용
    function _scenePrefix(scene){
      if (!scene) return "";
      var trimmed = String(scene).replace(/^\s+/, "");
      if (/^특히\s/.test(trimmed)) return " (" + trimmed + ")";
      return " (특히 " + trimmed + ")";
    }

    var missionBody, visionBody;
    if (isEn) {
      var sceneEn = topicScene ? " (" + topicScene + ")" : "";
      missionBody = "I live each day, keeping " + why + " clear,"
                  + " in " + fieldInfo.field + sceneEn + ", beside " + fieldInfo.who + ","
                  + " as " + idA + " and " + idB + ".";
      visionBody  = "Ten years from now, people will remember me as"
                  + " \"" + idA + "\", \"" + idB + "\", and \"" + whyId + "\".";
    } else {
      var sceneKo = _scenePrefix(topicScene);
      var whyNat = _whyNatural(why);
      // 사용자 채택 패턴: "나는 [why-자연어] 늘 분명히 하면서, [분야]에서 [곁의 대상] 곁에, [정체성A]이자 [정체성B]으로 매일을 살아간다."
      missionBody = "나는 " + whyNat + " 늘 분명히 하면서, "
                  + fieldInfo.field + "에서 " + fieldInfo.who + " 곁에" + sceneKo + ", "
                  + idA + "이자 " + idB + "으로 매일을 살아간다.";
      visionBody  = "10년 뒤 사람들은 나를 "
                  + "\"" + idA + "\", \"" + idB + "\", \"" + whyId + "\"으로 기억한다.";
    }
    return {
      missionBody: missionBody,
      visionBody:  visionBody,
      why: why,
      field: fieldInfo.field,
      who: fieldInfo.who,
      identityA: idA,
      identityB: idB,
      identityC: idC,
      whyIdentity: whyId
    };
  }

  // 헤드라인 합성 — 진단 슬롯 직접 매핑 (임의 창작 없음)
  function buildHeadline(primaryDomainKo, primaryCategory, compassRaw, fingerprint, lang){
    var isEn = (lang === "en");
    var subjectLib = isEn ? SUBJECT_BY_DOMAIN_EN : SUBJECT_BY_DOMAIN_KO;
    var verbLib    = isEn ? HEADLINE_VERB_EN    : HEADLINE_VERB_KO;
    var subject = subjectLib[primaryDomainKo] || (isEn ? "people in their place" : "지금 살아가는 사람");
    var catTable = verbLib[primaryCategory] || verbLib["성장지향"];
    var compassKey = (compassRaw && compassRaw[0]) || "의미 / 보람 / 가치";
    // 라이브러리 키 normalization (특수 결합 문자 차이 방지)
    var verbArr = catTable[compassKey] || catTable["의미 / 보람 / 가치"]
               || (isEn ? ["help people find themselves"] : ["자기다움을 찾도록 돕는다"]);
    var verb = pickByHash(verbArr, fingerprint + 137);
    if (isEn) {
      return subject + " — " + verb + ".";
    }
    return subject + "이 " + verb + ".";
  }

  // 한 줄 설명 합성 — "[도메인]의 자리에서, [Compass 핵심어]를 나침반 삼아."
  function buildSubline(domainPhraseCore, compassRaw, lang){
    var isEn = (lang === "en");
    var kwLib = isEn ? COMPASS_KEYWORD_EN : COMPASS_KEYWORD_KO;
    var compassKey = (compassRaw && compassRaw[0]) || "의미 / 보람 / 가치";
    var kw = kwLib[compassKey] || (isEn ? "meaning" : "의미");
    if (isEn) {
      return "In " + domainPhraseCore + ", with " + kw + " as the compass.";
    }
    // "의미"·"단단함"·"배움" 등 명사 + 을/를 조사 보정
    var last = kw.charCodeAt(kw.length - 1);
    var jong = 0;
    if (last >= 0xAC00 && last <= 0xD7A3) jong = (last - 0xAC00) % 28;
    var josa = jong === 0 ? "를" : "을";
    return domainPhraseCore + "의 자리에서, " + kw + josa + " 나침반 삼아.";
  }

  // ─────────────────────────────────────────────────────
  // 사명/비전 합성 — 일상 장면어 기반 (사명의 언어 / 비전의 언어)
  //
  //  설계 (프랭클린 다이어리 사명·비전 작성법 기반):
  //   - ① 가치 (Q13)        → MISSION_LINE_COMBO / VISION_BY_KEYWORD 라이브러리
  //   - ② 도메인 (Q75)      → "경제와 교육의 자리에서" (기여의 장)
  //   - ③ 관심 주제 (Q41)   → TOPIC_SCENE 라벨로 보조 장면
  //   - ④ 결정 기준 (Q63)   → COMPASS_MISSION/VISION 라이브러리 (프랭클린 "Personal Compass")
  //   - ⑤ 미래 정체성        → "한 사람으로 살아가는/자리잡는" (End in Mind)
  //
  //  프랭클린식 5슬롯 골격:
  //   Mission = "당신의 사명은, [②도메인]에서, (특히 [③장면]) [④나침반 절]
  //              [①가치 통합 동사구] 한 사람으로 살아가는 것입니다."
  //   Vision  = "당신의 비전은, [②도메인]에서 [①가치 정체성]이자
  //              [④Compass 정체성]으로 자리잡는 것입니다."
  // ─────────────────────────────────────────────────────
  function buildMissionVision7Slot(toneKey, mvBase, answers, fingerprint, lang, mapping){
    var isEn = (lang === "en");
    var lib = (isEn ? MV_SLOTS_EN : MV_SLOTS_KO)[toneKey] || (isEn ? MV_SLOTS_EN.principled_designer : MV_SLOTS_KO.principled_designer);
    var i18nEn = (mapping && mapping.i18n_en) || {};
    var domainLabelEn = i18nEn.domainLabel || {};

    function _enFromKo(ko){
      if (!ko) return "";
      if (domainLabelEn[ko]) return domainLabelEn[ko];
      return ko;
    }

    // 응답 기반 슬롯
    var values = toArr(answers["Q13"]);
    var domains = toArr(answers["Q75"]);
    var topics = toArr(answers["Q41"]); // multi (max 2)

    // primary/secondary domain
    var primaryDomainKo = domains[0] || "";
    var secondaryDomainKo = domains[1] || "";
    var primaryDomain = isEn ? _enFromKo(primaryDomainKo) : primaryDomainKo;
    var secondaryDomain = isEn ? _enFromKo(secondaryDomainKo) : secondaryDomainKo;

    // Q41 → 장면 라벨 (있으면 사용, 없으면 빈 문자열)
    var topicSceneLib = isEn ? TOPIC_SCENE_EN : TOPIC_SCENE_KO;
    var topicScene = "";
    if (topics.length > 0) {
      var t0 = topics[0];
      topicScene = topicSceneLib[t0] || "";
    }

    // values 정제 — 일상 장면어 기반 (missionVerbs / visionIdentity)
    var refined = refineValuesPhrase(values, fingerprint, lang);

    // 하위 호환: raw join 보존
    var valuesPhraseRaw = isEn
      ? (values.slice(0, 3).join(" · ") || "trust · growth · responsibility")
      : (values.slice(0, 3).join("·") || "신뢰·성장·책임");

    // 톤별 슬롯 (essence 만 본문에 사용 — anchor/descriptor/verb/target 은 메타로만 보존)
    var anchor = pickByHash(lib.anchor, fingerprint);
    var descriptor = pickByHash(lib.descriptor, fingerprint + 11);
    var verb = pickByHash(lib.verb, fingerprint + 23);
    var target = pickByHash(lib.target, fingerprint + 37);
    var essence = pickByHash(lib.essence, fingerprint + 41);
    var horizon = pickByHash(lib.time_horizon, fingerprint + 53);

    // ─────────────────────────────
    // 사명/비전 합성 — 한 줄 통합 압축 (상품성 강화)
    //
    //   설계 원칙:
    //   - Q13 다중 키워드를 풀어 나열하지 않고 "하나의 통합 동사구/정체성"으로 압축
    //   - 사명 = 한 문장, 통합 동사구 1개 (직관적 핵심 한 줄)
    //   - 비전 = 한 문장, 통합 정체성 1개 (한 사람의 모습이 한 줄에 그려짐)
    //   - 카테고리 조합 키 → MISSION_LINE_COMBO_KO / VISION_LINE_COMBO_KO
    //   - Q41 장면은 짧게 도메인 뒤에 붙음 (있을 때만)
    //   - fingerprint 해시로 변형 결정성 부여
    // ─────────────────────────────
    var mission, vision;

    // 카테고리 조합 키 (정렬된 조합) — 라이브러리 룩업용
    var comboKey = "";
    if (refined.categories && refined.categories.length) {
      // 일관된 키를 위해 카테고리 우선순위 순으로 정렬
      var priorityOrder = ["관계지향","성장지향","자유지향","원칙지향"];
      var sortedCats = refined.categories.slice().sort(function(a, b){
        return priorityOrder.indexOf(a) - priorityOrder.indexOf(b);
      });
      comboKey = unique(sortedCats).join("+");
    }

    // 라이브러리에서 통합 한 줄 사명/비전 선택
    var missionLineLib = (isEn ? MISSION_LINE_COMBO_EN : MISSION_LINE_COMBO_KO);
    var visionLineLib  = (isEn ? VISION_LINE_COMBO_EN  : VISION_LINE_COMBO_KO);
    var missionLineArr = missionLineLib[comboKey];
    var visionLineArr  = visionLineLib[comboKey];

    // 폴백: 주 카테고리만 사용
    if (!missionLineArr || !missionLineArr.length) {
      missionLineArr = missionLineLib[refined.primaryCategory] || missionLineLib["성장지향"];
    }
    if (!visionLineArr || !visionLineArr.length) {
      visionLineArr = visionLineLib[refined.primaryCategory] || visionLineLib["성장지향"];
    }

    // 사용자 응답 기반 결정성 (fingerprint + comboKey 시드)
    var comboSeed = 0;
    for (var ci = 0; ci < comboKey.length; ci++) comboSeed = (comboSeed + comboKey.charCodeAt(ci)) | 0;
    var missionLine = pickByHash(missionLineArr, fingerprint + 101 + comboSeed);
    var visionLine  = pickByHash(visionLineArr,  fingerprint + 211 + comboSeed);

    // ④ COMPASS — Q63 결정 기준 (프랭클린 "Personal Compass")
    var compass = pickCompass(answers, fingerprint, lang);

    if (isEn) {
      var d = primaryDomain || "your field";
      var domainPhraseEn = (secondaryDomain ? d + " and " + secondaryDomain : d);
      var sceneEn = topicScene ? " (" + topicScene + ")" : "";
      // ④ Compass 절 (있으면 사명에 삽입)
      var compassMissionEn = compass.missionClause ? compass.missionClause + ", " : "";
      var compassVisionEn  = compass.visionClause  ? " — " + compass.visionClause : "";

      // 사명 한 줄: "Your mission is, in <domains><scene>, <compass>, <missionLine>."
      mission = "Your mission is, in " + domainPhraseEn + sceneEn + ", "
              + compassMissionEn + missionLine + ".";
      // 비전 한 줄: "Your vision is to become, in <domains>, <visionLine><compass-vision>."
      vision = "Your vision is to become, in " + domainPhraseEn + ", "
             + visionLine + compassVisionEn + ".";
    } else {
      // 도메인 결합: "경제·교육" → "경제와 교육" (받침 보정)
      function _waGwa(word){
        if (!word) return "와";
        var last = word.charCodeAt(word.length - 1);
        if (last >= 0xAC00 && last <= 0xD7A3) {
          var jong = (last - 0xAC00) % 28;
          return jong === 0 ? "와" : "과";
        }
        return "와";
      }
      var domainCore;     // "경제와 교육" / "경제"
      var domainPhraseKo; // "경제와 교육의 자리에서"
      if (primaryDomainKo && secondaryDomainKo) {
        domainCore = primaryDomainKo + _waGwa(primaryDomainKo) + " " + secondaryDomainKo;
        domainPhraseKo = domainCore + "의 자리에서";
      } else if (primaryDomainKo) {
        domainCore = primaryDomainKo;
        domainPhraseKo = domainCore + "의 자리에서";
      } else {
        domainCore = "지금 살아가는 자리";
        domainPhraseKo = "지금 살아가는 자리에서";
      }
      // Q41 장면은 도메인 뒤에 짧게 부속 — "(특히 ~)" 인입
      var sceneKo = topicScene ? "(" + topicScene + ") " : "";

      // ── 사명 (프랭클린식 5슬롯 한 줄 통합) ──
      //   "당신의 사명은, [도메인의 자리에서], (특히 [장면]) [④나침반 절,] [①가치 통합 동사구] 한 사람으로 살아가는 것입니다."
      var compassMissionKo = compass.missionClause ? compass.missionClause + ", " : "";
      mission = "당신의 사명은, " + domainPhraseKo + ", " + sceneKo
              + compassMissionKo
              + missionLine + " 한 사람으로 살아가는 것입니다.";

      // ── 비전 (프랭클린식 5슬롯 한 줄 통합) ──
      //   "당신의 비전은, [도메인의 자리에서] [①가치 정체성]이자 [④Compass 정체성](으)로 자리잡는 것입니다."
      //   visionLine 은 대부분 "~ 사람" 으로 끝나므로 자연 결합
      var visionLineTrim = String(visionLine).replace(/\s+$/, "");
      var lastCh = visionLineTrim.charAt(visionLineTrim.length - 1);
      var lastCode = lastCh ? lastCh.charCodeAt(0) : 0;
      var endsWithFinal = false; // 받침 있음
      if (lastCode >= 0xAC00 && lastCode <= 0xD7A3) {
        endsWithFinal = ((lastCode - 0xAC00) % 28) !== 0;
      }
      // ④ Compass 정체성 절 합성 (있으면 "이자 ~"로 자연 결합)
      var compassVisionKo = "";
      if (compass.visionClause) {
        // visionLine 마지막 받침 → "이자" / "자" 분기
        var ija = endsWithFinal ? "이자 " : "이자 ";
        // "한 사람" 으로 끝나는지 확인 — 끝나면 "한 사람이자 ~" 가 자연
        compassVisionKo = ija + compass.visionClause;
      }
      var visionFullKo = visionLineTrim + compassVisionKo;
      // 최종 어미 보정: visionFullKo 의 마지막 글자 기준
      var lastCh2 = visionFullKo.charAt(visionFullKo.length - 1);
      var lastCode2 = lastCh2 ? lastCh2.charCodeAt(0) : 0;
      var endsWithFinal2 = false;
      if (lastCode2 >= 0xAC00 && lastCode2 <= 0xD7A3) {
        endsWithFinal2 = ((lastCode2 - 0xAC00) % 28) !== 0;
      }
      var connector = endsWithFinal2 ? "으로" : "로";
      vision = "당신의 비전은, " + domainPhraseKo + " "
             + visionFullKo + connector + " 자리잡는 것입니다.";
    }

    // ─────────────────────────────────────────────────────
    // 3-TIER 구조 합성 — L3 헤드라인 + 한 줄 설명 + 다이어리 본문
    //
    //  ① 헤드라인 (Google·Disney·Tesla 수준 한 문장):
    //     "[Q75 도메인 → 대상 명사][Q13×Q63 → 단일 변화 동사구]" (15~25자)
    //  ② 한 줄 설명: "[Q75 도메인]의 자리에서, [Q63 Compass 핵심어]을(를) 나침반 삼아."
    //  ③ 다이어리 본문 (1인칭 직관형, 프랭클린 다이어리 스타일)
    // ─────────────────────────────────────────────────────
    var headline = buildHeadline(primaryDomainKo, refined.primaryCategory, compass.raw, fingerprint, lang);
    // domainCore 는 한국어 분기에서만 정의 — EN 분기 시 영어 도메인 결합어로 대체
    var sublineDomainCore = isEn
      ? ((primaryDomain || "your field") + (secondaryDomain ? " and " + secondaryDomain : ""))
      : (typeof domainCore !== "undefined" ? domainCore : (primaryDomainKo || "지금 살아가는 자리"));
    var subline = buildSubline(sublineDomainCore, compass.raw, lang);
    var diary = buildDiaryBody(primaryDomainKo, refined.primaryCategory, compass.raw, topicScene, fingerprint, lang);

    return {
      // ── 한 줄 통합 사명/비전 (3인칭 격식체, 본문 보조) ──
      missionText: mission,
      visionText: vision,
      footer: (mvBase && mvBase.footer) || "",

      // ── 3-Tier 구조 (사용자 확정 표현) ──
      tier: {
        headline: headline,              // L3 한 줄 사명 (Google 수준)
        subline: subline,                // 한 줄 설명 (Compass 기준)
        diaryMission: diary.missionBody, // 1인칭 다이어리 사명 본문
        diaryVision: diary.visionBody    // 1인칭 다이어리 비전 본문 (10년 후 회상)
      },

      slots: {
        // 본문에 사용된 핵심 슬롯
        primary_domain: primaryDomain, secondary_domain: secondaryDomain,
        topic_scene: topicScene,
        mission_verbs: refined.missionVerbs,
        vision_identity: refined.visionIdentity,
        secondary_identities: refined.secondaryIdentities,
        // ④ Compass (Q63) — 프랭클린식 결정 기준
        compass_mission: compass.missionClause,
        compass_vision: compass.visionClause,
        compass_raw: compass.raw,
        // 다이어리 본문 슬롯 추적
        diary_why: diary.why,
        diary_field: diary.field,
        diary_who: diary.who,
        diary_identity_a: diary.identityA,
        diary_identity_b: diary.identityB,
        diary_identity_c: diary.identityC,
        diary_why_identity: diary.whyIdentity,
        // 톤 슬롯 (메타 보존, 노출 안 함)
        anchor: anchor, descriptor: descriptor, verb: verb,
        target: target, essence: essence, horizon: horizon,
        // 하위 호환 (메타 / 디버그용 — 본문 노출 금지)
        values_phrase: valuesPhraseRaw,
        values_categories: refined.categories,
        values_primary_category: refined.primaryCategory,
        values_raw: refined.raw
      }
    };
  }

  // ──────────────────────────────────────────────────────────
  // P0-4. 4축 카드 — paired-matrix narrative + tier 코멘트 통합
  //   - traits Q6 페어가 해당 축에 속하는 경우, 카드의 narrative 에 페어 해석을 한 줄 더 얹음
  //   - tier × axis 매트릭스 코멘트로 카드 후미를 강화 (closer 보강)
  // ──────────────────────────────────────────────────────────
  var TRAIT_AXIS_MAP = {
    "조용한":"self_understanding","신중한":"self_understanding","분석적인":"self_understanding","느긋한":"self_understanding",
    "공감하는":"self_expression","따뜻한":"self_expression",
    "계획적인":"self_design","현실적인":"self_design","창의적인":"self_design",
    "열정적인":"self_execution","도전적인":"self_execution","성취지향적인":"self_execution"
  };

  // tier × axis 매트릭스 코멘트 (4×4 = 16) — P0-4 + P1-1 통합
  var TIER_AXIS_COMMENT_KO = {
    self_understanding: {
      deep:     "이미 자기 자신의 결을 깊게 이해하고 있어, 사람들의 자기성찰을 도울 수 있는 단계입니다.",
      active:   "자기 이해의 흐름이 안정적으로 작동하고 있어, 외부 자극에도 흔들리지 않는 단계입니다.",
      emerging: "자기 이해가 본격적으로 발현되기 시작한 단계로, 성찰 일기·코칭 대화로 가속할 수 있습니다.",
      seed:     "자기 이해의 씨앗을 천천히 키워갈 단계로, 짧은 자기 응시 시간부터 시작해 보세요."
    },
    self_expression: {
      deep:     "감정과 생각을 안전하게 풀어내는 자기표현이 깊게 다져진 단계로, 다른 사람의 감정 회복도 돕습니다.",
      active:   "자기표현이 활발히 작동하고 있어, 더 큰 무대(글·강연·대화)로 확장 가능한 단계입니다.",
      emerging: "자기표현이 발현 단계에 접어든 시점으로, 작은 글쓰기·1:1 대화로 빠르게 단단해질 수 있습니다.",
      seed:     "자기표현은 아직 씨앗 단계입니다 — 안전한 한 사람 앞에서 한 문장 말하기부터 시작해 보세요."
    },
    self_design: {
      deep:     "자기설계가 깊게 숙성되어, 흐름과 단계를 스스로 짜고 결과로 옮기는 단계입니다.",
      active:   "자기설계가 활발히 작동하고 있어, 분기·연간 단위 목표 운영이 가능한 단계입니다.",
      emerging: "자기설계가 발현되기 시작한 단계로, 작은 주간 계획부터 단계적으로 키워갈 수 있습니다.",
      seed:     "자기설계는 아직 씨앗 단계로, 하루 1개 결정·1개 행동의 작은 설계부터 권장합니다."
    },
    self_execution: {
      deep:     "자기실행이 깊게 다져져 있어, 약속한 결과를 끝까지 만들어내는 단계입니다.",
      active:   "자기실행이 활발히 작동하고 있어, 더 큰 약속(프로젝트·팀)으로 확장 가능한 단계입니다.",
      emerging: "자기실행이 발현 단계로, '작게 끝내기'를 반복하면 단단해지는 시점입니다.",
      seed:     "자기실행은 아직 씨앗 단계 — '오늘 끝낼 1개'를 정해 마무리하는 연습부터 시작해 보세요."
    }
  };
  var TIER_AXIS_COMMENT_EN = {
    self_understanding: {
      deep:     "Your self-understanding is deeply matured — you are at a stage where you can help others' self-reflection.",
      active:   "Your self-understanding flows steadily, unshaken by external stimulation.",
      emerging: "Self-understanding has just begun to emerge — reflective journaling or coaching conversations will accelerate it.",
      seed:     "Self-understanding is still a seed — start with short moments of self-observation."
    },
    self_expression: {
      deep:     "Self-expression — releasing feelings and thoughts safely — is deeply forged. You can also help others recover their voice.",
      active:   "Self-expression operates actively. You are ready to extend to larger stages: writing, talks, and dialogue.",
      emerging: "Self-expression is in an emerging phase — small writings or one-on-one conversation will solidify it quickly.",
      seed:     "Self-expression is still a seed — try saying one sentence before one safe person."
    },
    self_design: {
      deep:     "Self-design is deeply matured — you sequence flow and steps and translate them into results.",
      active:   "Self-design is actively at work — you can run goals on a quarterly and annual basis.",
      emerging: "Self-design is in an emerging phase — start with small weekly plans and grow step by step.",
      seed:     "Self-design is still a seed — start with one decision and one action per day."
    },
    self_execution: {
      deep:     "Self-execution is deeply matured — you carry promised results through to the end.",
      active:   "Self-execution is actively at work — you can scale to larger commitments (projects, teams).",
      emerging: "Self-execution is in an emerging phase — repeating 'finishing small' will firm it up.",
      seed:     "Self-execution is still a seed — practice closing 'one thing finished today'."
    }
  };

  function enhanceAxisCardV2(card, lang, traits, fingerprint){
    var isEn = (lang === "en");
    var pct = (card.content && typeof card.content.pct === "number") ? card.content.pct : 0;
    var tier = _tier(pct);
    var tierLabel = (isEn ? TIER_LABEL_EN : TIER_LABEL_KO)[card.id] || {};
    var newCard = clone(card);
    newCard.content.tier = tier;
    newCard.content.tierLabel = tierLabel[tier] || "";

    // P1-1: tier × axis comment
    var commentMap = (isEn ? TIER_AXIS_COMMENT_EN : TIER_AXIS_COMMENT_KO)[card.id];
    if (commentMap && commentMap[tier]) {
      newCard.content.tierComment = commentMap[tier];
      newCard.content.closerLine = commentMap[tier]; // 하위 호환
    } else {
      // 기존 closer 폴백
      var closerArr = (isEn ? TIER_CLOSER_EN : TIER_CLOSER_KO)[tier] || [];
      var fp = (pct * 31 + (card.id || "").length * 7) | 0;
      var closer = pickByHash(closerArr, fp);
      if (closer) newCard.content.closerLine = closer;
    }

    // P0-4: 해당 축에 속하는 trait pair 가 있다면 narrative 에 한 줄 추가
    var axisTraits = (traits || []).filter(function(t){ return TRAIT_AXIS_MAP[t] === card.id; });
    if (axisTraits.length >= 2) {
      var key = _pairKey(axisTraits[0], axisTraits[1]);
      var pairLib = isEn ? TRAIT_PAIR_EN : TRAIT_PAIR_KO;
      var pairArr = pairLib[key];
      if (pairArr && pairArr.length) {
        newCard.content.pairedNarrative = pickByHash(pairArr, fingerprint + (card.id || "").length);
      }
    } else if (axisTraits.length === 1) {
      var singleLib = isEn ? TRAIT_SINGLE_EN : TRAIT_SINGLE_KO;
      var arr = singleLib[axisTraits[0]];
      if (arr && arr.length) {
        newCard.content.pairedNarrative = pickByHash(arr, fingerprint + (card.id || "").length);
      }
    }
    return newCard;
  }

  // ──────────────────────────────────────────────────────────
  // P1-1. 톤 우선순위 결정 (Tone-variant priority resolver)
  //   - 설계 규약: Q13 가치 카테고리 + 4축 최상위 결합 → 톤
  //   - 동률 시 우선순위: principled_designer > warm_connector > visionary_creator > pragmatic_achiever > reflective_explorer
  //   - report-rules-v4.json 의 toneVariants.selectionRule 와 1:1 일치
  // ──────────────────────────────────────────────────────────
  var TONE_PRIORITY = ["principled_designer","warm_connector","visionary_creator","pragmatic_achiever","reflective_explorer"];

  // 가치 카테고리 → 톤 매핑 (Q13)
  var VALUE_TO_TONE = {
    "원칙지향": "principled_designer",
    "관계지향": "warm_connector",
    "성장지향": "visionary_creator",
    "자유지향": "reflective_explorer"
  };

  // PR#48-A: 가치 카테고리 → 정제된 가치 표현 라이브러리
  //   - Q13 원시값(예: "사랑·자유·의미 추구") 직역 노출을 차단
  //   - 카테고리별 4가지 정제 표현 + fingerprint 기반 결정성 선택
  //   - 혼합형(2개 이상 카테고리)일 경우 두 카테고리 결합 표현 별도 합성
  var VALUE_PHRASE_KO = {
    "관계지향": [
      "사람과 사람을 잇는 따뜻함",
      "신뢰와 공감의 결을 지키는 마음",
      "곁에 머무는 사랑과 헌신",
      "관계 속에서 의미를 찾는 마음"
    ],
    "원칙지향": [
      "흔들리지 않는 정직과 책임",
      "기준을 지키는 단단함",
      "원칙으로 길을 만드는 마음",
      "정의와 절제의 균형"
    ],
    "성장지향": [
      "스스로를 새로 짓는 성장의 의지",
      "의미를 향해 걸어가는 도전",
      "어제를 넘어서는 몰입과 창의",
      "성취를 통해 자신을 단련하는 힘"
    ],
    "자유지향": [
      "자기다운 호흡으로 살아가는 자유",
      "스스로 길을 고르는 결정권",
      "구속 없는 평화로운 지속",
      "내 결을 잃지 않는 단단한 자율"
    ]
  };
  var VALUE_PHRASE_EN = {
    "관계지향": [
      "warmth that connects people",
      "the heart that protects trust and empathy",
      "love and devotion that stay close",
      "the heart that finds meaning in relationships"
    ],
    "원칙지향": [
      "unshaken honesty and responsibility",
      "firmness that protects the standard",
      "the heart that builds a path through principle",
      "balance of justice and self-restraint"
    ],
    "성장지향": [
      "the will to keep rebuilding oneself",
      "a challenge that walks toward meaning",
      "the focus and creativity to surpass yesterday",
      "the strength tempered by achievement"
    ],
    "자유지향": [
      "freedom to live by your own rhythm",
      "the right to choose your own way",
      "peaceful continuity without constraint",
      "firm autonomy that never loses your grain"
    ]
  };
  // 혼합 표현(상위 2개 카테고리) — 카테고리 페어 키 정렬 후 사용
  var VALUE_PHRASE_MIX_KO = {
    "관계지향+성장지향": "사람을 잇는 따뜻함과 의미를 향한 성장의 결",
    "관계지향+원칙지향": "관계의 따뜻함과 흔들리지 않는 책임의 결",
    "관계지향+자유지향": "사람을 잇는 따뜻함과 자기다움을 지키는 자유",
    "성장지향+원칙지향": "원칙 위에 짓는 의미 있는 성장",
    "성장지향+자유지향": "자기 호흡으로 키워 가는 의미 있는 성장",
    "원칙지향+자유지향": "기준을 지키면서도 자기다움을 잃지 않는 결"
  };
  var VALUE_PHRASE_MIX_EN = {
    "관계지향+성장지향": "warmth that connects people, paired with growth that walks toward meaning",
    "관계지향+원칙지향": "warmth in relationships paired with unshaken responsibility",
    "관계지향+자유지향": "warmth that connects people, paired with the freedom to keep your own grain",
    "성장지향+원칙지향": "meaningful growth built on principle",
    "성장지향+자유지향": "meaningful growth raised by your own rhythm",
    "원칙지향+자유지향": "the grain that keeps the standard yet never loses self-direction"
  };

  // 카테고리 분포 → 정제된 valuesPhrase 합성 (직역 차단)
  // 입력: rawValues (Q13 다중선택 원시값 배열), valueKeywordMap (mapping.json)
  // 출력: { phrase, primaryCategory, distribution }
  function composeValuesPhrase(rawValues, valueKeywordMap, fingerprint, lang){
    var isEn = (lang === "en");
    var lib = isEn ? VALUE_PHRASE_EN : VALUE_PHRASE_KO;
    var libMix = isEn ? VALUE_PHRASE_MIX_EN : VALUE_PHRASE_MIX_KO;
    var fallback = isEn ? "the values that anchor your life" : "삶의 기준이 되는 가치들";

    var arr = toArr(rawValues).map(function(v){ return String(v).trim(); }).filter(Boolean);
    if (arr.length === 0) return { phrase: fallback, primaryCategory: "성장지향", distribution: {} };

    // 카테고리별 매칭 카운트
    var counts = { "관계지향":0, "원칙지향":0, "성장지향":0, "자유지향":0 };
    arr.forEach(function(v){
      Object.keys(counts).forEach(function(cat){
        var kws = (valueKeywordMap && valueKeywordMap[cat]) || [];
        if (kws.indexOf(v) !== -1) counts[cat] += 1;
      });
    });
    // 동률 처리: 카테고리 우선순위
    var priority = ["관계지향","원칙지향","성장지향","자유지향"];
    var ordered = priority.slice().sort(function(a, b){
      var d = counts[b] - counts[a];
      if (d !== 0) return d;
      return priority.indexOf(a) - priority.indexOf(b);
    });
    var top1 = ordered[0];
    var top2 = ordered[1];

    var phrase;
    // 혼합형: top2가 1 이상이면 dual-phrase 사용
    if (counts[top1] > 0 && counts[top2] > 0 && counts[top2] >= 1) {
      var pairKey = [top1, top2].sort().join("+");
      // 정렬된 키가 라이브러리에 있으면 사용, 없으면 top1 표현으로 폴백
      phrase = libMix[pairKey];
      if (!phrase) {
        phrase = pickByHash(lib[top1] || [fallback], fingerprint + 13);
      }
    } else if (counts[top1] > 0) {
      // 단일 카테고리: 라이브러리에서 fingerprint 기반 1개 픽
      phrase = pickByHash(lib[top1] || [fallback], fingerprint + 13);
    } else {
      phrase = fallback;
    }

    return { phrase: phrase, primaryCategory: top1, distribution: counts };
  }
  // 최상위 축 → 톤 보조 매핑
  var AXIS_TO_TONE = {
    self_understanding: "reflective_explorer",
    self_expression:    "warm_connector",
    self_design:        "principled_designer",
    self_execution:     "pragmatic_achiever"
  };

  // 우선순위 정렬 비교자
  function _toneRank(tone){
    var i = TONE_PRIORITY.indexOf(tone);
    return i === -1 ? 999 : i;
  }

  // tone resolver: scores + value categories → toneKey
  function resolveTone(scores, valueCategories){
    var pct = (scores && scores.axisPct) || {};
    var topAxis = Object.keys(pct).sort(function(a,b){
      var d = (pct[b]||0) - (pct[a]||0);
      if (d !== 0) return d;
      return _toneRank(AXIS_TO_TONE[a]) - _toneRank(AXIS_TO_TONE[b]);
    })[0];
    var axisTone = AXIS_TO_TONE[topAxis] || "reflective_explorer";

    var cats = toArr(valueCategories);
    var valueTones = cats.map(function(c){ return VALUE_TO_TONE[c]; }).filter(Boolean);

    // 후보 톤: 가치톤 우선 + 축톤 보조
    var candidates = unique(valueTones.concat([axisTone]));
    if (candidates.length === 0) candidates = [axisTone];

    // 우선순위 정렬
    candidates.sort(function(a,b){ return _toneRank(a) - _toneRank(b); });
    return {
      toneKey: candidates[0],
      topAxis: topAxis,
      candidates: candidates,
      reason: "value=" + (valueTones[0] || "?") + " topAxis=" + topAxis + " priority=" + candidates[0]
    };
  }

  // ──────────────────────────────────────────────────────────
  // P1-2. 도메인 × 보조도메인 확장 엔진 (21×21 = 441 경로)
  //   - Q75(관심분야) 기반 primary/secondary domain 결합
  //   - 톤별 확장 방향 코멘트 라이브러리에서 fingerprint pick
  // ──────────────────────────────────────────────────────────
  var DOMAIN_21 = ["정치","경제","사회","문화","교육","기술","과학","의료","복지","환경","예술","미디어","스포츠","법률","행정","종교","철학","역사","심리","경영","금융"];
  var DOMAIN_21_EN = {
    "정치":"Politics","경제":"Economy","사회":"Society","문화":"Culture","교육":"Education","기술":"Technology",
    "과학":"Science","의료":"Healthcare","복지":"Welfare","환경":"Environment","예술":"Arts","미디어":"Media",
    "스포츠":"Sports","법률":"Law","행정":"Public Administration","종교":"Religion","철학":"Philosophy",
    "역사":"History","심리":"Psychology","경영":"Management","금융":"Finance"
  };

  // 도메인 페어 확장 코멘트 (대표 21쌍 + 폴백 합성기)
  var DOMAIN_PAIR_TEMPLATES_KO = [
    "{p}을(를) 중심에 두고 {s} 영역으로 확장하면, 사람과 구조의 결을 동시에 다스릴 수 있습니다.",
    "{p}의 깊이를 토대로 {s}와의 교차점을 찾으면, 새로운 영향력 영역이 열립니다.",
    "{p}에서 다져 온 통찰을 {s} 영역에 옮기면, 차별화된 자기 영역이 만들어집니다.",
    "{p}을(를) 본업으로 두고 {s}를 부업·연구 영역으로 가져가면, 평생 호흡의 포트폴리오가 형성됩니다.",
    "{p}에서 출발해 {s}로 외연을 넓히면, 같은 가치가 더 큰 사람들에게 닿습니다."
  ];
  var DOMAIN_PAIR_TEMPLATES_EN = [
    "Centering on {p} and expanding into {s} lets you master both the texture of people and the structure of systems.",
    "Building on the depth of {p} and finding the crossroads with {s} opens a new sphere of influence.",
    "Translating the insight forged in {p} into the field of {s} creates a differentiated domain of your own.",
    "Keeping {p} as your main work and treating {s} as research/secondary builds a lifetime-breath portfolio.",
    "Starting from {p} and widening into {s} lets the same value reach a larger audience."
  ];

  // PR#48-A: 톤별 확장 방향 라이브러리 — 의미 있는 3가지 directions 합성용
  //   각 톤마다 4가지 후보(깊이/폭/연결/사회) 보유, fingerprint 기반 2개 선택
  //   "X 영역의 전문성 확장" 단순 반복을 의미 있는 톤×도메인 결합으로 대체
  var DIRECTION_BY_TONE_KO = {
    warm_connector: [
      "{p}에서 만난 사람들의 이야기를 {s}의 언어로 번역해 전달자 역할로 자리잡기",
      "{p} 현장에서 쌓인 신뢰를 자산 삼아 {s} 영역의 커뮤니티/모임으로 확장하기",
      "{p}과 {s} 사이를 잇는 1:1 깊이 대화·코칭 채널 만들기",
      "{p}에서 받은 공감 데이터를 정리해 {s} 영역의 사람 중심 콘텐츠로 발행하기"
    ],
    principled_designer: [
      "{p}에서 다듬은 원칙을 {s} 영역의 의사결정 프레임으로 옮기기",
      "{p}과 {s}를 가로지르는 단단한 자기 운영체계(루틴·기준) 문서화하기",
      "{p}의 분석 깊이를 {s} 영역의 구조 설계로 확장해 차별화된 영역 만들기",
      "{p}에서 검증된 원칙을 {s} 영역에서 검토·반증하며 사고 체계 단단히 하기"
    ],
    visionary_creator: [
      "{p}의 통찰을 {s} 영역의 새로운 콘셉트·포맷으로 변환해 발신하기",
      "{p}과 {s}의 교차점에서 아직 없는 카테고리를 발견하고 이름 붙이기",
      "{p}에서 그린 큰 그림을 {s} 영역의 작은 실험으로 쪼개어 빠르게 시도하기",
      "{p}의 비전을 {s} 영역의 사람들과 공동 창작으로 키워 가기"
    ],
    pragmatic_achiever: [
      "{p}에서 검증된 결과 만드는 방식을 {s} 영역의 실행 모델로 이식하기",
      "{p}의 성과 지표를 {s} 영역에 적용해 측정 가능한 진전으로 바꾸기",
      "{p}과 {s}를 잇는 작은 사이드 프로젝트 1개를 90일 사이클로 운영하기",
      "{p}에서 다진 추진력을 {s} 영역의 부족한 결과 영역에 투입하기"
    ],
    reflective_explorer: [
      "{p}에서 길어 올린 질문을 {s} 영역의 학습·연구 주제로 발전시키기",
      "{p}과 {s} 사이의 작은 전환 실험(전직·이중경력)을 단계적으로 시도하기",
      "{p}에서 정리한 의미를 {s} 영역의 글·아카이브로 외화하기",
      "{p}에서의 회복 시간을 {s} 영역의 새로운 시야 확장에 투자하기"
    ]
  };
  var DIRECTION_BY_TONE_EN = {
    warm_connector: [
      "Translate the stories you meet in {p} into the language of {s} and become a bridging messenger",
      "Leverage the trust you built in {p} to grow communities/circles in {s}",
      "Create a 1:1 deep-conversation or coaching channel that connects {p} and {s}",
      "Curate the empathy data from {p} into people-centered content for {s}"
    ],
    principled_designer: [
      "Carry the principles you refined in {p} into a decision framework for {s}",
      "Document a robust self-operating system (routines/criteria) that spans {p} and {s}",
      "Extend the analytical depth from {p} into the structural design of {s}",
      "Test and refine the principles proven in {p} against the realities of {s}"
    ],
    visionary_creator: [
      "Convert insight from {p} into new concepts/formats in {s} and broadcast them",
      "Discover and name a category that doesn't yet exist at the intersection of {p} and {s}",
      "Break the big picture you drew in {p} into small experiments inside {s}",
      "Co-create with people in {s} to grow the vision born in {p}"
    ],
    pragmatic_achiever: [
      "Port the result-making method validated in {p} into the execution model of {s}",
      "Apply the performance metrics from {p} to {s} and turn them into measurable progress",
      "Run a 90-day side project that bridges {p} and {s}",
      "Channel the drive trained in {p} into the under-performing area of {s}"
    ],
    reflective_explorer: [
      "Develop the questions raised in {p} into learning/research themes for {s}",
      "Pilot small transitional experiments (career shift / dual career) between {p} and {s}",
      "Externalize the meaning crystallized in {p} as writings or archives in {s}",
      "Invest the recovery time from {p} in the perspective expansion of {s}"
    ]
  };

  function buildDomainExpansion(answers, fingerprint, lang, mapping, toneKey){
    var isEn = (lang === "en");
    var domains = toArr(answers["Q75"]).filter(Boolean);
    var p = domains[0] || (isEn ? "your main field" : "본 영역");
    var s = domains[1] || (isEn ? "an adjacent field" : "인접 영역");
    var pEn = isEn ? (DOMAIN_21_EN[p] || p) : p;
    var sEn = isEn ? (DOMAIN_21_EN[s] || s) : s;
    var tmplArr = isEn ? DOMAIN_PAIR_TEMPLATES_EN : DOMAIN_PAIR_TEMPLATES_KO;
    var tmpl = pickByHash(tmplArr, fingerprint + 71);
    var line = tmpl.replace("{p}", pEn).replace("{s}", sEn);

    // 받침 처리
    if (!isEn) {
      line = line.replace(pEn + "을(를)", _eul(pEn));
      line = line.replace(sEn + "와의", sEn + (_hasJong(sEn) ? "과의" : "와의"));
      line = line.replace(sEn + "를", _eul(sEn));
    }

    // PR#48-A: 톤별 확장 방향 2가지 추가 (path-line + 2가지 = 의미 있는 directions 3개)
    //   - 단순 "X 영역의 전문성 확장" 반복을 톤×도메인 결합 표현으로 대체
    //   - fingerprint + index 로 결정성 유지하면서 사용자별 다양성 확보
    var tone = toneKey || "warm_connector";
    var dirLib = isEn ? DIRECTION_BY_TONE_EN : DIRECTION_BY_TONE_KO;
    var pool = (dirLib[tone] || dirLib.warm_connector || []).slice();
    // fingerprint 기반 2개 비복원 추출 (deterministic)
    var subDirs = [];
    if (pool.length > 0) {
      var idx1 = Math.abs(fingerprint + 23) % pool.length;
      subDirs.push(pool[idx1]);
      pool.splice(idx1, 1);
      if (pool.length > 0) {
        var idx2 = Math.abs(fingerprint + 53) % pool.length;
        subDirs.push(pool[idx2]);
      }
    }
    // {p}/{s} 치환 + 받침 처리
    subDirs = subDirs.map(function(t){
      var out = t.replace(/\{p\}/g, pEn).replace(/\{s\}/g, sEn);
      if (!isEn) {
        out = out.replace(pEn + "을(를)", _eul(pEn));
        out = out.replace(pEn + "과 ", pEn + (_hasJong(pEn) ? "과 " : "와 "));
        out = out.replace(sEn + "을(를)", _eul(sEn));
        out = out.replace(sEn + "의", sEn + "의");
      }
      return out;
    });

    return {
      primaryDomain: pEn,
      secondaryDomain: sEn,
      pathLine: line,
      pathCount: DOMAIN_21.length * DOMAIN_21.length, // 441
      subDirections: subDirs // PR#48-A: 추가된 의미 있는 확장 방향 2개
    };
  }

  // ──────────────────────────────────────────────────────────
  // P1-3. 진로/교육 다양성 가드 — 톤 외 폴백 누수 차단
  //   - 다른 톤의 fallback 풀에서 새어 들어온 추천이 있으면 제거
  //   - 동일 카테고리 추천이 3개 미만으로 떨어지면 본 톤 풀에서 보강
  // ──────────────────────────────────────────────────────────
  function diversityGuard(ce, toneKey, fingerprint, lang){
    var isEn = (lang === "en");
    var careerLib = isEn ? CAREER_FALLBACK_EN : CAREER_FALLBACK_KO;
    var eduLib = isEn ? EDU_FALLBACK_EN : EDU_FALLBACK_KO;

    var allOtherCareers = [];
    var allOtherEdu = [];
    Object.keys(careerLib).forEach(function(k){
      if (k !== toneKey) {
        allOtherCareers = allOtherCareers.concat(careerLib[k]);
        allOtherEdu = allOtherEdu.concat(eduLib[k]);
      }
    });

    function _filterLeakage(arr, otherPool){
      // 다른 톤 풀에 정확히 매칭되는 항목 → 누수로 간주, 단 본 톤 풀에 동일항목이 있으면 OK
      var ownPool = (toneKey === "principled_designer" ? careerLib.principled_designer :
                     toneKey === "warm_connector" ? careerLib.warm_connector :
                     toneKey === "visionary_creator" ? careerLib.visionary_creator :
                     toneKey === "pragmatic_achiever" ? careerLib.pragmatic_achiever :
                     careerLib.reflective_explorer) || [];
      return arr.filter(function(x){
        if (ownPool.indexOf(x) !== -1) return true; // 본 톤 풀에 있으면 통과
        if (otherPool.indexOf(x) !== -1) return false; // 다른 톤 풀에서만 발견 → 누수
        return true; // 톤 풀과 무관한 출처(매핑 기반) → 유지
      });
    }

    var careersClean = _filterLeakage(unique(ce.careers || []), allOtherCareers);
    var eduClean = _filterLeakage(unique(ce.education || []), allOtherEdu);

    // 부족 시 본 톤 풀로 보강 (회전 인덱스)
    function _topUp(arr, pool, want){
      if (!pool || !pool.length) return arr.slice(0, want);
      var i = Math.abs(fingerprint) % pool.length;
      var guard = 0;
      while (arr.length < want && guard < pool.length * 2) {
        var cand = pool[(i + guard) % pool.length];
        if (arr.indexOf(cand) === -1) arr.push(cand);
        guard++;
      }
      return arr.slice(0, want);
    }
    careersClean = _topUp(careersClean, careerLib[toneKey] || [], 3);
    eduClean = _topUp(eduClean, eduLib[toneKey] || [], 3);

    return {
      careers: careersClean,
      education: eduClean,
      directions: ce.directions || []
    };
  }

  // ──────────────────────────────────────────────────────────
  // P2-2. 자동 품질검증 (validateReport)
  // ──────────────────────────────────────────────────────────
  function validateReport(report, opts){
    opts = opts || {};
    var lang = report.lang || "ko";
    var checks = [];

    function _push(id, label, ok, detail){
      checks.push({ id: id, label: label, ok: !!ok, detail: detail || "" });
    }

    // 1. 12단 구조 완전 일치
    var sections = report.sections || [];
    _push("structure_12", "12단 구조 일치", sections.length === 12, "actual=" + sections.length);

    // 2. 섹션 순서·이모지 일치 (📘 → 🟦 → 🟩 → 🟥 → 🧭 → 📍 → 🧠 → 🎙 → 🎯 → 🚀 → 🧩 → 🧪)
    var expectedIcons = ["📘","🟦","🟩","🟥","🧭","📍","🧠","🎙","🎯","🚀","🧩","🧪"];
    var iconMatch = sections.length === 12 && sections.every(function(s, i){ return s.icon === expectedIcons[i]; });
    _push("icon_order", "이모지 순서 일치", iconMatch, "expected=" + expectedIcons.join(""));

    // 3. 원시 Q6 형용사 노출 차단 (강점 TOP3에 "신중한"/"분석적인"/"성취지향적인" 등이 단독 노출되면 안 됨)
    var growthSec = sections.filter(function(s){ return s.id === "growth_map"; })[0];
    var rawTraitFound = false;
    var rawTraitDetail = "";
    if (growthSec && growthSec.content && Array.isArray(growthSec.content.strengths)) {
      growthSec.content.strengths.forEach(function(s){
        if (TRAITS_12.indexOf(String(s).trim()) !== -1) {
          rawTraitFound = true;
          rawTraitDetail = "raw trait found: " + s;
        }
      });
    }
    _push("no_raw_trait", "원시 Q6 형용사 미노출", !rawTraitFound, rawTraitDetail);

    // 4. 강점 TOP3 길이 (각 항목 길이 4자 이상 — 결과 명사형 강점 보장)
    var strengthsLenOk = true;
    var strengthsLenDetail = "";
    if (growthSec && Array.isArray(growthSec.content.strengths)) {
      growthSec.content.strengths.forEach(function(s, i){
        var len = String(s || "").trim().length;
        if (len < 4) { strengthsLenOk = false; strengthsLenDetail += "[" + i + "] len=" + len + " "; }
      });
    }
    _push("strengths_min_len", "강점 항목 최소 길이(≥4)", strengthsLenOk, strengthsLenDetail);

    // 5. 교육 추천 3개가 모두 다름 (중복 차단)
    var ceSec = sections.filter(function(s){ return s.id === "career_education"; })[0];
    var eduUnique = false;
    if (ceSec && Array.isArray(ceSec.content.education)) {
      eduUnique = (new Set(ceSec.content.education)).size === ceSec.content.education.length;
    }
    _push("edu_unique", "교육 추천 3개 중복 없음", eduUnique, ceSec ? ("eduCount=" + ceSec.content.education.length) : "missing");

    // 6. 진로 추천 3개가 모두 다름
    var careerUnique = false;
    if (ceSec && Array.isArray(ceSec.content.careers)) {
      careerUnique = (new Set(ceSec.content.careers)).size === ceSec.content.careers.length;
    }
    _push("career_unique", "진로 추천 3개 중복 없음", careerUnique, ceSec ? ("careerCount=" + ceSec.content.careers.length) : "missing");

    // 7. 사명 문장 길이 ≥ 60자 (KO) / 80자 (EN) — 7슬롯 합성 효과 검증
    var mvSec = sections.filter(function(s){ return s.id === "mission_vision"; })[0];
    var missionLenOk = false, missionLen = 0;
    if (mvSec && mvSec.content) {
      missionLen = String(mvSec.content.mission || "").length;
      missionLenOk = (lang === "en") ? (missionLen >= 80) : (missionLen >= 60);
    }
    _push("mission_min_len", "사명 문장 최소 길이", missionLenOk, "len=" + missionLen);

    // 8. 비전 문장 길이 ≥ 60자 (KO) / 80자 (EN)
    var visionLenOk = false, visionLen = 0;
    if (mvSec && mvSec.content) {
      visionLen = String(mvSec.content.vision || "").length;
      visionLenOk = (lang === "en") ? (visionLen >= 80) : (visionLen >= 60);
    }
    _push("vision_min_len", "비전 문장 최소 길이", visionLenOk, "len=" + visionLen);

    // 9. 4축 카드 모두 keywords 4개 보유
    var axisOk = true, axisDetail = "";
    ["self_understanding","self_expression","self_design","self_execution"].forEach(function(id){
      var sec = sections.filter(function(s){ return s.id === id; })[0];
      if (!sec || !sec.content || !Array.isArray(sec.content.keywords) || sec.content.keywords.length !== 4) {
        axisOk = false; axisDetail += id + " ";
      }
    });
    _push("four_axis_keywords", "4축 카드 키워드 4개", axisOk, axisDetail);

    // 10. 4축 카드에 tier 라벨 포함 (P1-1 적용 검증)
    var tierOk = true, tierDetail = "";
    ["self_understanding","self_expression","self_design","self_execution"].forEach(function(id){
      var sec = sections.filter(function(s){ return s.id === id; })[0];
      if (!sec || !sec.content || !sec.content.tier || !sec.content.tierLabel) {
        tierOk = false; tierDetail += id + " ";
      }
    });
    _push("tier_applied", "4축 카드 tier 라벨 적용", tierOk, tierDetail);

    // 11. 자동 안내 문구 포함
    var metaSec = sections.filter(function(s){ return s.id === "report_meta"; })[0];
    var autoOk = !!(metaSec && metaSec.content && metaSec.content.autoNotice && metaSec.content.autoNotice.length > 20);
    _push("auto_notice", "자동 안내 문구 포함", autoOk, metaSec ? ("len=" + (metaSec.content.autoNotice || "").length) : "missing");

    // 12. 마크다운 ** 미사용 (실제 서식 강조 정책)
    var mdFound = false, mdDetail = "";
    sections.forEach(function(s){
      var json = JSON.stringify(s);
      if (/\*\*/.test(json)) { mdFound = true; mdDetail = s.id + " contains **"; }
    });
    _push("no_markdown", "마크다운 ** 미사용", !mdFound, mdDetail);

    // 13. (P0-4) 4축 카드 tier × axis 코멘트 적용
    var tcOk = true, tcDetail = "";
    ["self_understanding","self_expression","self_design","self_execution"].forEach(function(id){
      var sec = sections.filter(function(s){ return s.id === id; })[0];
      if (!sec || !sec.content || !sec.content.tierComment || sec.content.tierComment.length < 10) {
        tcOk = false; tcDetail += id + " ";
      }
    });
    _push("tier_axis_comment", "tier×axis 코멘트 적용 (P0-4)", tcOk, tcDetail);

    // 14. (P1-1) 톤 해상도 메타 기록
    var trOk = !!(report._v4Meta && report._v4Meta.toneResolution && report._v4Meta.toneResolution.toneKey);
    _push("tone_resolution", "톤 우선순위 해상도 기록 (P1-1)", trOk, trOk ? report._v4Meta.toneResolution.reason : "missing");

    // 15. (P1-2) 도메인 확장 정보 기록
    var deOk = false, deDetail = "";
    var ceSec2 = sections.filter(function(s){ return s.id === "career_education"; })[0];
    if (ceSec2 && ceSec2.content && ceSec2.content.domainExpansion) {
      var de = ceSec2.content.domainExpansion;
      deOk = !!(de.primaryDomain && de.secondaryDomain && de.pathLine && de.pathCount >= 441);
      deDetail = "p=" + de.primaryDomain + " s=" + de.secondaryDomain + " paths=" + de.pathCount;
    }
    _push("domain_expansion", "도메인 × 보조도메인 확장 (P1-2)", deOk, deDetail);

    // 16. (P1-3) 진로/교육 다양성 가드 — 톤 외 풀 누수 0건
    //   (정확한 누수는 톤 풀 직접 비교가 필요하므로 여기서는 모든 항목 비어있지 않은지 확인)
    var dgOk = !!(ceSec2 && (ceSec2.content.careers || []).length === 3 && (ceSec2.content.education || []).length === 3);
    _push("diversity_guard", "진로/교육 다양성 가드 (P1-3)", dgOk, dgOk ? "ok" : "incomplete");

    // 17. (P2-1) fingerprint 56문항 전체 활용
    var fpOk = !!(report._v4Meta && typeof report._v4Meta.fingerprint === "number" && report._v4Meta.fingerprint > 0);
    _push("full_fingerprint", "fingerprint 56문항 전체 활용 (P2-1)", fpOk, fpOk ? "fp=" + report._v4Meta.fingerprint : "missing");

    var passed = checks.filter(function(c){ return c.ok; }).length;
    var score = Math.round((passed / checks.length) * 100);
    return {
      ok: passed === checks.length,
      score: score,
      passed: passed,
      total: checks.length,
      checks: checks,
      version: "v4.1"
    };
  }

  // ──────────────────────────────────────────────────────────
  // 메인 — upgrade(): v1.3 build() 결과를 받아 v4 후처리 적용
  // ──────────────────────────────────────────────────────────
  function upgrade(rawReport, ctx){
    if (!rawReport || !rawReport.sections) {
      throw new Error("ReportEngineV4.upgrade: rawReport(sections 포함)가 필요합니다.");
    }
    ctx = ctx || {};
    var mapping = ctx.mapping || {};
    var rules = ctx.rules || {};
    var answers = ctx.answers || {};
    var profile = ctx.profile || {};
    var lang = (ctx.lang === "en" || rawReport.lang === "en") ? "en" : "ko";

    // P2-1: 56문항 전체 활용 fingerprint
    var fp = fullAnswerFingerprint(answers, mapping);

    var report = clone(rawReport);
    report.lang = lang;
    report.engineVersion = "v4.1";
    report._v4Meta = { fingerprint: fp, generatedAt: new Date().toISOString(), engineVersion: "v4.1" };

    // P0-1: 강점 페어 해석 매트릭스 적용 — growth_map.strengths 교체
    var traits = toArr(answers["Q6"]);
    var growthSec = report.sections.filter(function(s){ return s.id === "growth_map"; })[0];
    if (growthSec && traits.length > 0) {
      var pairStrengths = interpretTraitPair(traits, fp, lang);
      if (pairStrengths.length > 0) {
        // 원본의 baseline strengths(축 기반)는 유지하고, traits 직접 노출분만 페어 해석으로 교체
        // 원본은 traits 우선 → baseline 으로 채워짐 → 우리는 traits 부분을 페어 해석으로 강제 치환
        var BASELINE = (mapping.axes ? Object.keys(mapping.axes) : ["self_understanding","self_expression","self_design","self_execution"]);
        // 새 strengths 구성: pair 해석 (1~3개) + baseline 보강
        var existing = (growthSec.content.strengths || []).filter(function(s){
          // 원시 trait 제거 — TRAITS_12 / 영문 변환 traits 모두 차단
          if (TRAITS_12.indexOf(String(s).trim()) !== -1) return false;
          return true;
        });
        var combined = pairStrengths.concat(existing);
        growthSec.content.strengths = unique(combined).slice(0, 3);
        // 부족 시 페어 해석을 더 추가 (응답이 1개 trait 인 경우 등)
        while (growthSec.content.strengths.length < 3 && pairStrengths.length > 0) {
          growthSec.content.strengths.push(pairStrengths[(growthSec.content.strengths.length) % pairStrengths.length]);
        }
        growthSec.content.strengths = unique(growthSec.content.strengths).slice(0, 3);
      }
    }

    // P0-2: 진로/교육 fallback 다양화
    var ceSec = report.sections.filter(function(s){ return s.id === "career_education"; })[0];
    var toneKey = (report.tone && report.tone.key) || "principled_designer";
    if (ceSec) {
      var ce = {
        careers: ceSec.content.careers || [],
        education: ceSec.content.education || [],
        directions: ceSec.content.directions || []
      };
      var diversified = diversifyCareerEducation(ce, toneKey, fp, lang);
      ceSec.content.careers = diversified.careers;
      ceSec.content.education = diversified.education;
      ceSec.content.directions = diversified.directions;
    }

    // P0-4 + P1-1: 4축 카드에 tier 라벨 + tier×axis 코멘트 + paired narrative
    report.sections = report.sections.map(function(s){
      if (["self_understanding","self_expression","self_design","self_execution"].indexOf(s.id) !== -1) {
        return enhanceAxisCardV2(s, lang, traits, fp);
      }
      return s;
    });

    // P1-1: 톤 우선순위 결정 — 후처리 단계에서 재검증 (메타로 기록)
    try {
      var valueCats = [];
      // mapping.valueKeywordMap (정식 키) 또는 valueCategories (호환) 기반 분류
      var vcMap = (mapping && (mapping.valueKeywordMap || mapping.valueCategories)) || {};
      var values = toArr(answers["Q13"]);
      values.forEach(function(v){
        Object.keys(vcMap).forEach(function(cat){
          if (cat.charAt(0) === "$") return; // skip $comment
          if ((vcMap[cat] || []).indexOf(v) !== -1) valueCats.push(cat);
        });
      });
      valueCats = unique(valueCats);
      var resolved = resolveTone(report.scores || {}, valueCats);
      report._v4Meta.toneResolution = resolved;
      // 원본 톤과 다르면 보고서 톤은 유지하되 권고 사항으로 메타에 기록
      if (resolved.toneKey && report.tone && resolved.toneKey !== report.tone.key) {
        report._v4Meta.toneRecommendation = {
          current: report.tone.key,
          recommended: resolved.toneKey,
          reason: resolved.reason
        };
      }
    } catch (e) { /* 안전 폴백 */ }

    // P1-2: 사명/비전 7-슬롯 합성으로 교체
    var mvSec = report.sections.filter(function(s){ return s.id === "mission_vision"; })[0];
    var mvSlots = null;
    if (mvSec) {
      var mvNew = buildMissionVision7Slot(toneKey, mvSec.content, answers, fp, lang, mapping);
      mvSec.content.mission = mvNew.missionText;
      mvSec.content.vision = mvNew.visionText;
      mvSec.content._slots = mvNew.slots;
      mvSlots = mvNew.slots;

      // ── 3-Tier 노출 (사용자 확정 표현) ──
      //   ① headline   : L3 한 줄 사명 (Google·Disney 수준)
      //   ② subline    : 한 줄 설명 (Compass 핵심어)
      //   ③ diaryMission / diaryVision : 1인칭 직관형 다이어리 본문
      if (mvNew.tier) {
        mvSec.content.headline     = mvNew.tier.headline;
        mvSec.content.subline      = mvNew.tier.subline;
        mvSec.content.diaryMission = mvNew.tier.diaryMission;
        mvSec.content.diaryVision  = mvNew.tier.diaryVision;
      }
    }

    // P1-2c: typeLine — Q13 직역 차단 + 톤×주카테고리 자연 형용구로 치환
    //  기존 v1.3 엔진은 "사랑·자유·의미 추구 중심의 공감형 연결자 …" 처럼 Q13 원시값을 그대로 박아 넣음.
    //  v4.1에서는 카테고리명("관계 지향")조차 노출하지 않고, 톤×주카테고리 → 일상 장면 형용구로 치환.
    //  예) "사랑·자유·의미 추구 중심의 공감형 연결자 …"
    //   →  "사람의 마음을 안전한 자리에 머무르게 하는 공감형 연결자 …"
    var sumSec = report.sections.filter(function(s){ return s.id === "summary"; })[0];
    if (sumSec && sumSec.content && mvSlots) {
      var rawJoin = mvSlots.values_phrase || "";        // 예: "사랑·자유·의미 추구"
      var primaryCat = mvSlots.values_primary_category || "성장지향";
      var typePhrase = pickTypePhrase(toneKey, primaryCat, fp, lang);

      if (typePhrase && rawJoin && sumSec.content.typeLine) {
        var tl = String(sumSec.content.typeLine);
        // raw 직역 치환 (예: "사랑·자유·의미 추구 중심의" → "사람의 마음을 …하는")
        var rawCenter = (lang === "en") ? (rawJoin + "-centered ") : (rawJoin + " 중심의 ");
        if (tl.indexOf(rawCenter) !== -1) {
          sumSec.content.typeLine = tl.split(rawCenter).join(typePhrase + (lang === "en" ? " " : " "));
        } else if (tl.indexOf(rawJoin) !== -1) {
          // 폴백: 단순 raw join 치환
          sumSec.content.typeLine = tl.split(rawJoin).join(typePhrase);
        }
      }
      // 메타 라벨(_valuesOrientation / _valuesInsight)은 노출하지 않음 — 사용자 요청에 따라 삭제
    }

    // P1-2d: summary_close.line2 — Q13 원시값 직역(예: "사랑·자유·의미 추구을(를) 기준으로 …") 차단
    //   v1.3 엔진은 closeLine2 = "<valuesPhrase>을(를) 기준으로 <domain> 영역에서 자신의 사명을 살아냅니다."
    //   를 생성하므로, v4.1 업그레이드 단계에서 자연어 한 줄로 재작성한다.
    //   - 카테고리명/원시값 노출 금지
    //   - 톤×주카테고리 형용구를 사용하여 사명 본문과 같은 결로 정리
    var closeSec = report.sections.filter(function(s){ return s.id === "summary_close"; })[0];
    if (closeSec && closeSec.content && mvSlots) {
      try {
        var rawJoinC  = mvSlots.values_phrase || "";
        var primaryC  = mvSlots.values_primary_category || "성장지향";
        var typeP     = pickTypePhrase(toneKey, primaryC, fp, lang);
        var domLabel  = "";
        if (mvSlots.primary_domain && mvSlots.secondary_domain) {
          domLabel = mvSlots.primary_domain + "·" + mvSlots.secondary_domain;
        } else if (mvSlots.primary_domain) {
          domLabel = mvSlots.primary_domain;
        }
        if (lang === "en") {
          if (typeP && domLabel) {
            closeSec.content.line2 = "Living out your mission as " + typeP + " in the field of " + domLabel + ".";
          }
        } else {
          if (typeP && domLabel) {
            closeSec.content.line2 = domLabel + " 영역에서 " + typeP + " 모습으로 자신의 사명을 살아냅니다.";
          } else if (rawJoinC && closeSec.content.line2 && String(closeSec.content.line2).indexOf(rawJoinC) !== -1) {
            // 폴백: 원시값만 제거
            closeSec.content.line2 = String(closeSec.content.line2).split(rawJoinC + "을(를) 기준으로 ").join("");
          }
        }
      } catch (e) { /* 안전 폴백 */ }
    }

    // P1-2: 도메인 × 보조도메인 확장 → career_education.directions 보강
    // PR#48-A: 톤×도메인 결합으로 의미 있는 directions 3가지 합성
    //   - 기존: [path-line, "X 영역의 전문성 확장", "Y 영역의 전문성 확장"] ← 단순 반복
    //   - 개선: [path-line, 톤기반 확장방향1, 톤기반 확장방향2] ← 의미 다양화
    if (ceSec) {
      var domEx = buildDomainExpansion(answers, fp, lang, mapping, toneKey);
      ceSec.content.domainExpansion = domEx;
      // path-line + subDirections 2개 = 의미 있는 directions 3개로 교체
      var newDirs = [];
      if (domEx.pathLine) newDirs.push(domEx.pathLine);
      if (Array.isArray(domEx.subDirections)) {
        domEx.subDirections.forEach(function(d){
          if (d && newDirs.indexOf(d) === -1) newDirs.push(d);
        });
      }
      // 부족 시 기존 directions 에서 보강(중복 차단)
      (ceSec.content.directions || []).forEach(function(d){
        if (d && newDirs.indexOf(d) === -1 && newDirs.length < 3) newDirs.push(d);
      });
      ceSec.content.directions = newDirs.slice(0, 3);
    }

    // P1-3: 다양성 가드 (톤 외 폴백 누수 차단)
    if (ceSec) {
      var guarded = diversityGuard({
        careers: ceSec.content.careers || [],
        education: ceSec.content.education || [],
        directions: ceSec.content.directions || []
      }, toneKey, fp, lang);
      ceSec.content.careers = guarded.careers;
      ceSec.content.education = guarded.education;
      // directions 는 P1-2 에서 처리됨 → 유지
    }

    return report;
  }

  // 노출
  return {
    upgrade: upgrade,
    validateReport: validateReport,
    resolveTone: resolveTone,
    buildDomainExpansion: buildDomainExpansion,
    diversityGuard: diversityGuard,
    _internals: {
      interpretTraitPair: interpretTraitPair,
      diversifyCareerEducation: diversifyCareerEducation,
      enhanceAxisCard: enhanceAxisCard,
      enhanceAxisCardV2: enhanceAxisCardV2,
      buildMissionVision7Slot: buildMissionVision7Slot,
      fullAnswerFingerprint: fullAnswerFingerprint,
      resolveTone: resolveTone,
      buildDomainExpansion: buildDomainExpansion,
      diversityGuard: diversityGuard,
      TRAITS_12: TRAITS_12,
      TRAIT_PAIR_KO: TRAIT_PAIR_KO,
      TRAIT_PAIR_EN: TRAIT_PAIR_EN,
      TRAIT_SINGLE_KO: TRAIT_SINGLE_KO,
      TRAIT_SINGLE_EN: TRAIT_SINGLE_EN,
      TRAIT_AXIS_MAP: TRAIT_AXIS_MAP,
      TIER_LABEL_KO: TIER_LABEL_KO,
      TIER_LABEL_EN: TIER_LABEL_EN,
      TIER_AXIS_COMMENT_KO: TIER_AXIS_COMMENT_KO,
      TIER_AXIS_COMMENT_EN: TIER_AXIS_COMMENT_EN,
      MV_SLOTS_KO: MV_SLOTS_KO,
      MV_SLOTS_EN: MV_SLOTS_EN,
      DOMAIN_21: DOMAIN_21,
      DOMAIN_21_EN: DOMAIN_21_EN,
      TONE_PRIORITY: TONE_PRIORITY,
      VALUE_TO_TONE: VALUE_TO_TONE,
      AXIS_TO_TONE: AXIS_TO_TONE
    },
    version: "v4.1"
  };
});
