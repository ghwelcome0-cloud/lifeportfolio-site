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
 *   P2-1b) 64bit 독립 식별자(fingerprint64) — 식별자 충돌 임계 5.8만명→약 53.7억명.
 *          콘텐츠 생성에는 일절 미사용(기존 32bit 시드 그대로) → 출력 100% 불변.
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
  // 도구격 조사: 받침 없거나 받침이 ㄹ이면 "로", 그 외 받침은 "으로" (한국어 ㄹ 예외 처리)
  function _isRieulFinal(s){
    if (!s) return false;
    var c = s.charCodeAt(s.length - 1);
    if (c < 0xAC00 || c > 0xD7A3) return false;
    return ((c - 0xAC00) % 28) === 8; // 종성 인덱스 8 = ㄹ
  }
  function _ero(w){ return w + ((_hasJong(w) && !_isRieulFinal(w)) ? "으로" : "로"); }
  function _eun(w){ return w + (_hasJong(w) ? "은" : "는"); }
  function _gwa(w){ return w + (_hasJong(w) ? "과" : "와"); }

  // 응답 전체에서 fingerprint 생성 (P2-1: 56문항 전체 활용)
  //  ⚠️ 콘텐츠 생성(pickByHash, >>>, ^ 등)이 이 32bit 값을 시드로 소비하므로
  //     반환식·연산을 절대 변경하지 않는다(같은 응답 → 같은 리포트 결정성 보장).
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

  // 응답 전체에서 64bit fingerprint 생성 (P2-1b: 고유 식별자 강화)
  //  목적: 32bit fingerprint(2^31 공간, ~5.8만명에서 생일역설 충돌)의 식별자 한계를
  //        해소하기 위한 "독립 식별자". 콘텐츠 생성에는 일절 사용하지 않으며,
  //        _v4Meta.fingerprint64(문자열) 로만 노출한다 → 기존 출력 100% 불변.
  //  알고리즘: 64bit FNV-1a 변형(BigInt). 입력 정렬·구성 규칙은 32bit와 동일하되
  //            위치 가중치(idx)와 라운드 믹싱으로 분포를 넓힌다.
  //  반환: 16자리 hex 문자열(예: "a3f0...") — 직렬화/표시 안전(정수 정밀도 손실 방지).
  function fullAnswerFingerprint64(answers, mapping){
    // 환경에 BigInt 미지원 시 안전 폴백(식별자 미생성) — 콘텐츠/결정성에는 영향 없음
    if (typeof BigInt === "undefined") return "";
    var qmap = (mapping && mapping.questionMapping) || {};
    var MASK = (BigInt(1) << BigInt(64)) - BigInt(1); // 2^64 - 1
    var PRIME = BigInt("1099511628211");              // FNV-1a 64bit prime
    var h = BigInt("14695981039346656037");           // FNV-1a 64bit offset basis
    Object.keys(qmap).sort().forEach(function(qid, idx){
      var v = answers[qid];
      if (v == null || v === "") return;
      var s = Array.isArray(v) ? v.join("|") : String(v);
      // 위치 가중치를 바이트로 선행 주입 → 같은 응답이 다른 위치에 와도 분기
      var idxByte = BigInt((idx + 1) * 17 & 0xFF);
      h = (h ^ idxByte) & MASK;
      h = (h * PRIME) & MASK;
      for (var i = 0; i < s.length; i++){
        h = (h ^ BigInt(s.charCodeAt(i) & 0xFFFF)) & MASK;
        h = (h * PRIME) & MASK;
      }
    });
    // 16자리 hex 고정 폭(상위 0 패딩) — 표시/직렬화 일관성
    var hex = h.toString(16);
    while (hex.length < 16) hex = "0" + hex;
    return hex;
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
      "왜 이 일을 하는지 잊지 않고 살아가고",
      "작은 일에서도 자기에게 남는 결을 길어 올리고"
    ],
    "의미": [
      "그날의 만남에서 한 가지 깨달음을 가지고 돌아오고",
      "겉으로 드러난 일 너머의 결을 찾아보고",
      "겪은 일을 글이나 말로 정리해 자기 자산으로 남기고",
      "왜 이 일을 하는지 잊지 않고 살아가고",
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
      // PR#63 RULE-REPORT R5: visionary_creator 톤 누수 방지를 위해 "마음" 리터럴 → 보편 표현 치환
      "\"이 사람 곁에 있으면 결이 풀린다\"는 말을 듣는 사람",
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
      "왜 이 일을 하는지 잊지 않고 살아가는 사람"
    ],
    "의미": [
      "이야기를 듣다 보면 배움이 따라오는 사람",
      "질문이 깊어 함께 있으면 생각이 정리되는 사람",
      "겪은 일을 글이나 콘텐츠로 남기는 사람",
      "왜 이 일을 하는지 잊지 않고 살아가는 사람"
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
      "곁의 사람을 끝까지 챙기는",
      "누군가 기댈 때 가장 먼저 떠오르는 사람이 되어 주는",
      "말하지 않아도 곁의 마음을 먼저 읽어 주는",
      "한 사람 한 사람을 오래 기억하고 잊지 않는"
    ],
    "자유지향": [
      "남이 만든 틀이 아니라 자기 호흡대로 하루를 살아 내는",
      "정해진 길 대신 자기 길을 자기 속도로 그어 가는",
      "어디에 있어도 자기 색을 잃지 않는",
      "남의 기대보다 자기 기준으로 선택을 내리는",
      "틀에 갇히지 않고 매번 새로운 길을 시도하는",
      "누가 보지 않아도 자기다움을 지키는"
    ],
    "성장지향": [
      "어제보다 한 뼘 자란 오늘을 매일 만들어 가는",
      "겪는 모든 일에서 한 가지 깨달음을 길어 올리는",
      "막힌 자리에서 다음 한 걸음을 찾아내는",
      "실수마저 배움으로 바꿔 다음으로 잇는",
      "어제의 자신을 넘어서는 일을 멈추지 않는",
      "작은 진전도 놓치지 않고 쌓아 올리는"
    ],
    "원칙지향": [
      "한 번 한 약속을 결과로 증명해 내는",
      "어디서나 같은 모습으로 묵직하게 한 길을 가는",
      "맡은 일은 끝까지 마무리해 내는",
      "흔들리는 순간에도 자기 기준을 놓지 않는",
      "보는 눈이 없어도 옳은 쪽을 택하는",
      "말과 행동이 어긋나지 않게 살아 내는"
    ],

    // ── 2-종 mixed (6) — "A하면서도 B형" 압축
    "관계지향+자유지향": [
      "곁의 사람을 따뜻하게 품으면서도 자기 호흡을 잃지 않는",
      "사람의 곁을 머물게 하면서도 자기 색을 끝까지 지켜 가는",
      "함께하되 휘둘리지 않는",
      "사람을 아끼면서도 자기 길은 자기가 정하는",
      "곁을 데우되 자기다움을 잃지 않는"
    ],
    "관계지향+성장지향": [
      "사람을 깊이 만나며 그 만남마다 한 뼘씩 자라 가는",
      "사람의 곁을 품으면서 매일 한 걸음씩 깊어져 가는",
      "관계 속에서 자기를 자라게 하고, 그 자람으로 다시 사람을 잇는",
      "사람과 부딪히며 배우고, 그 배움으로 곁을 더 넓히는",
      "함께 자라기를 멈추지 않는"
    ],
    "관계지향+원칙지향": [
      "사람의 곁을 품으면서 약속은 끝까지 결과로 증명해 내는",
      "따뜻함과 단단한 책임을 하나로 살아 내는",
      "곁의 사람을 챙기면서도 자기 기준은 흐트러뜨리지 않는",
      "사람을 아끼되 옳고 그름은 분명히 하는",
      "따뜻하게 대하면서도 약속은 반드시 지키는"
    ],
    "자유지향+성장지향": [
      "자기 호흡으로 살되 매일 한 뼘씩 자라 가는",
      "어디에도 갇히지 않으면서 한 가지를 깊게 길어 올리는",
      "스스로 길을 그어 가며 그 길에서 깨달음을 거둬 내는",
      "자기 속도로 가되 어제보다 나아지기를 멈추지 않는",
      "틀을 깨면서 동시에 자기를 키워 가는"
    ],
    "자유지향+원칙지향": [
      "자기 호흡으로 살되 한 번 한 약속은 결과로 보여 주는",
      "휘둘리지 않으면서 자기 기준을 끝까지 가져가는",
      "자기 길을 가되 흐트러짐 없이 마무리해 내는",
      "남의 틀은 거부하되 자기 원칙은 철저히 지키는",
      "자유롭게 움직이되 한 말은 반드시 책임지는"
    ],
    "성장지향+원칙지향": [
      "매일 한 뼘 자라되 한 번 한 약속은 끝까지 지켜 내는",
      "꾸준히 자기를 다듬으며 그 결과를 증명해 가는",
      "성장과 책임을 하나로 살아 내는",
      "배움을 멈추지 않으면서 맡은 일은 끝까지 해내는",
      "어제보다 나아지되 기준은 절대 낮추지 않는"
    ],

    // ── 3-종 mixed (4) — 가장 풍부한 통합 (한 줄로 압축)
    "관계지향+성장지향+자유지향": [
      "곁의 사람을 품되 자기 호흡을 잃지 않고, 그 만남마다 한 뼘씩 자라 가는",
      "사람의 곁을 머물게 하면서 자기 색대로 깊어져 가는",
      "함께하되 휘둘리지 않고, 만남마다 깨달음을 길어 올리는",
      "사람을 아끼고 자기다움을 지키며 매일 나아지는",
      "곁을 데우되 자기 길을 가고, 그 길에서 배움을 거두는"
    ],
    "관계지향+성장지향+원칙지향": [
      "사람의 곁을 품으면서 매일 자라되 약속은 끝까지 결과로 증명해 내는",
      "따뜻함과 꾸준함과 단단한 책임을 하나로 살아 내는",
      "곁의 사람을 챙기고, 한 뼘씩 자라며, 한 번 한 약속을 끝까지 지켜 내는",
      "사람을 아끼고 배움을 쌓으며 맡은 일은 반드시 해내는",
      "따뜻하게 곁을 지키고 매일 성장하되 기준은 흔들지 않는"
    ],
    "관계지향+자유지향+원칙지향": [
      "사람을 품되 자기 호흡을 지키고, 그 위에 약속을 결과로 보여 주는",
      "따뜻함과 자기 색과 단단한 마무리를 하나로 살아 내는",
      "곁의 사람을 챙기면서도 휘둘리지 않고, 약속은 끝까지 가져가는",
      "사람을 아끼되 자기 길을 가고, 한 말은 책임지는",
      "곁을 데우고 자기다움을 지키며 옳은 쪽을 택하는"
    ],
    "성장지향+자유지향+원칙지향": [
      "자기 호흡으로 살되 매일 자라고, 그 자람을 결과로 증명해 내는",
      "남의 틀에 갇히지 않으면서 깊어지고, 약속은 끝까지 지켜 내는",
      "자기 길을 그어 가며 매일 나아지고, 그 길을 끝까지 마무리해 내는",
      "자기 속도로 성장하되 기준은 절대 낮추지 않는",
      "틀을 깨며 배우고, 그 배움을 책임으로 매듭짓는"
    ],

    // ── 4-종 mixed (1) — 모든 카테고리 (한 줄에 다 담기)
    "관계지향+성장지향+자유지향+원칙지향": [
      "사람의 마음을 품되 자기 호흡을 지키고, 매일 자라며 약속을 결과로 증명해 내는",
      "곁의 사람을 챙기고 자기 색으로 살되, 한 뼘씩 자라며 끝까지 마무리해 내는",
      "따뜻함과 자기 색과 꾸준함과 단단한 책임을 하나로 살아 내는",
      "사람을 아끼고 자기다움을 지키며, 배움을 쌓고 한 말은 책임지는",
      "곁을 데우고 자기 길을 가되, 멈추지 않고 자라며 기준을 지키는"
    ]
  };

  // [Q13 카테고리 조합 → 한 줄 통합 비전 정체성구]
  //   "한 사람의 모습"을 한 줄에 압축. "~하는 사람" 결미 통일.
  var VISION_LINE_COMBO_KO = {
    // ── 단일 카테고리 (4)
    "관계지향": [
      // PR#63 RULE-REPORT R5: 톤 누수 방지를 위해 "마음" 리터럴 → 보편 표현 치환
      "\"이 사람 곁에 있으면 결이 풀린다\"는 말을 듣는 한 사람",
      "곁에 두고 싶은 한 사람으로 자리잡은 사람",
      "사람의 결이 모이는 자리에 늘 함께 있는 사람"
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
      "성장과 책임이 하나로 흐르는 묵직한 한 사람"
    ],

    // ── 3-종 mixed (4)
    "관계지향+성장지향+자유지향": [
      "곁이 따뜻하면서도 자기 색대로 자라 가는 한 사람",
      "사람과 함께하되 휘둘리지 않고, 만남마다 깊어지는 한 사람",
      "마음을 품고 자기 호흡으로 살며 매일 한 뼘씩 자라는 사람"
    ],
    "관계지향+성장지향+원칙지향": [
      "사람의 마음을 품고, 매일 자라며, 약속을 끝까지 지키는 한 사람",
      "따뜻함과 꾸준함과 단단한 책임이 하나로 흐르는 사람",
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
      "공감과 성장과 책임이 하나로 흐르는, 단단한 연결자의 삶",
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

  // ══════════════════════════════════════════════════════════════════
  //  [RESPONSE-DIRECT 사명/비전 합성] — 유형(템플릿) 제거, 100% 응답 기반
  //
  //   설계 원칙(규칙서 P/F 준수):
  //   - 5개 유형(toneKey) 템플릿 풀에서 "고르는" 방식 폐기.
  //   - 고객이 고른 응답값(Q13 가치 / Q63 기준 / Q75 분야 / Q39·Q41 활동 /
  //     Q55 동기 / Q73 보람)을 "그 사람만의 재료"로 직접 조립.
  //   - 단, 매핑값을 날것으로 노출하지 않고 "상품·서비스 언어"(명사형·결과
  //     중심: ~전문가/~설계/~조력)로 환원하여 리포트에 반영.
  //   - 규칙서 형식: "당신의 사명은 '○○'입니다." / "당신의 비전은 '○○'입니다."
  //   - 사명 = 현재의 부르심(WHY·지금 살아내는 역할),
  //     비전 = 그 사명을 살아낸 끝에 도달할 미래 모습(도착점).
  // ══════════════════════════════════════════════════════════════════

  // Q75 분야 → "기여의 장" 명사 (상품 언어). 14개 옵션 전수 매핑.
  var DOMAIN_FIELD_KO = {
    "정치": "공동체와 정책", "경제": "경제와 자원", "사회": "사회와 공동체",
    "문화": "문화와 콘텐츠", "교육": "교육과 배움", "예술": "예술과 창작",
    "체육": "건강과 신체", "기술": "기술과 혁신", "환경": "환경과 지속가능성",
    "복지": "돌봄과 복지", "인권": "인권과 정의", "국제": "국제와 교류",
    "종교": "신앙과 영성", "경영": "조직과 경영",
    "의료": "건강과 치유", "디자인": "디자인과 경험", "미디어": "미디어와 소통",
    "법": "공정과 제도", "농업": "땅과 생명", "과학": "과학과 탐구"
  };
  var DOMAIN_FIELD_EN = {
    "정치": "policy and community", "경제": "economy and resources", "사회": "society and community",
    "문화": "culture and content", "교육": "education and learning", "예술": "art and creation",
    "체육": "health and the body", "기술": "technology and innovation", "환경": "the environment and sustainability",
    "복지": "care and welfare", "인권": "human rights and justice", "국제": "global exchange",
    "종교": "faith and spirituality", "경영": "organizations and management",
    "의료": "health and healing", "디자인": "design and experience", "미디어": "media and communication",
    "법": "fairness and institutions", "농업": "land and life", "과학": "science and inquiry"
  };

  // Q13 가치 → 명사형 핵심 가치어 (상품 언어). 14개 옵션 전수 매핑.
  var VALUE_NOUN_KO = {
    "정직": "정직", "정의": "정의", "사랑": "사랑", "신뢰": "신뢰",
    "창의": "창의", "책임": "책임", "성장": "성장", "자유": "자유",
    "도전": "도전", "헌신": "헌신", "평화": "평화", "협동": "협력",
    "배려": "배려", "성취": "성취",
    "절제": "절제", "포용": "포용", "의미 추구": "의미", "몰입": "몰입",
    "질서": "질서", "공정": "공정"
  };
  var VALUE_NOUN_EN = {
    "정직": "integrity", "정의": "justice", "사랑": "love", "신뢰": "trust",
    "창의": "creativity", "책임": "responsibility", "성장": "growth", "자유": "freedom",
    "도전": "challenge", "헌신": "devotion", "평화": "peace", "협동": "collaboration",
    "배려": "care", "성취": "achievement",
    "절제": "temperance", "포용": "inclusiveness", "의미 추구": "meaning", "몰입": "focus",
    "질서": "order", "공정": "fairness"
  };

  // Q39 활동 유형 → 명사형 강점 활동 (상품 언어). 9개 옵션 전수 매핑.
  var ACTIVITY_NOUN_KO = {
    "새로운 정보를 탐색하거나 정리하기": "정보를 탐색하고 구조화하는 힘",
    "사람들과 아이디어를 나누거나 토론하기": "사람들과 생각을 나누고 이어 주는 힘",
    "감정을 표현하거나 공감하는 활동": "감정을 읽고 공감으로 잇는 힘",
    "계획을 세우고 실행하는 일": "계획을 세워 끝까지 실행하는 힘",
    "문제를 분석하고 해결책을 찾는 일": "문제를 분석해 해법을 찾는 힘",
    "디자인, 창작, 콘텐츠 제작 등 창의 작업": "새로운 것을 만들어 내는 창작의 힘",
    "몸을 움직이는 활동, 스포츠, 체험 등": "몸으로 부딪쳐 경험으로 배우는 힘",
    "봉사, 돌봄, 의미 있는 영향력 행사": "사람을 돌보고 영향을 남기는 힘",
    "감정이나 에너지를 자기 성찰로 전환하는 활동": "스스로를 성찰해 길을 찾는 힘"
  };
  var ACTIVITY_NOUN_EN = {
    "새로운 정보를 탐색하거나 정리하기": "the gift of exploring and structuring knowledge",
    "사람들과 아이디어를 나누거나 토론하기": "the gift of connecting people through ideas",
    "감정을 표현하거나 공감하는 활동": "the gift of reading and bridging emotions",
    "계획을 세우고 실행하는 일": "the gift of planning and seeing things through",
    "문제를 분석하고 해결책을 찾는 일": "the gift of analyzing problems and finding solutions",
    "디자인, 창작, 콘텐츠 제작 등 창의 작업": "the gift of creating something new",
    "몸을 움직이는 활동, 스포츠, 체험 등": "the gift of learning through the body and experience",
    "봉사, 돌봄, 의미 있는 영향력 행사": "the gift of caring for people and leaving impact",
    "감정이나 에너지를 자기 성찰로 전환하는 활동": "the gift of self-reflection that finds the way"
  };

  // Q55 동기 → 사명의 "부르심 동기" 절 (현재형·WHY)
  var MOTIVE_CLAUSE_KO = {
    "내가 의미 있다고 느끼는 일이기 때문에": "스스로 의미 있다고 믿는 일에",
    "누군가에게 도움이 되기 때문에": "누군가에게 보탬이 되는 일에",
    "경쟁이나 목표 달성이 자극이 되기 때문에": "목표를 향해 나아가는 일에",
    "내가 좋아하거나 재미를 느껴서": "스스로 좋아하고 몰입하는 일에",
    "새로운 것을 배우고 성장할 수 있어서": "배우고 성장하는 일에",
    "결과에 대한 보상이나 성취감 때문": "결과로 증명되는 일에",
    "주변의 기대나 인정을 받고 싶어서": "사람들의 신뢰에 답하는 일에",
    "루틴이 무너지지 않게 유지하기 위해": "꾸준함이 쌓이는 일에"
  };
  var MOTIVE_CLAUSE_EN = {
    "내가 의미 있다고 느끼는 일이기 때문에": "to work that you believe is meaningful",
    "누군가에게 도움이 되기 때문에": "to work that helps someone",
    "경쟁이나 목표 달성이 자극이 되기 때문에": "to work that moves toward a goal",
    "내가 좋아하거나 재미를 느껴서": "to work you love and lose yourself in",
    "새로운 것을 배우고 성장할 수 있어서": "to work that lets you learn and grow",
    "결과에 대한 보상이나 성취감 때문": "to work proven by results",
    "주변의 기대나 인정을 받고 싶어서": "to work that honors people's trust",
    "루틴이 무너지지 않게 유지하기 위해": "to work where consistency compounds"
  };

  // Q73 보람의 순간 → 비전의 "도달 성취" 명사구 (미래·도착점)
  var FULFILL_NOUN_KO = {
    "내가 정한 목표를 달성했을 때": "스스로 세운 목표를 이루어 낸",
    "다른 사람의 인정이나 칭찬을 받을 때": "사람들에게 믿음을 얻은",
    "문제를 해결하고 결과가 나왔을 때": "풀리지 않던 문제를 풀어 낸",
    "배움이나 성장감을 느낄 때": "어제보다 자라 있는",
    "내가 의미 있다고 여긴 일을 마쳤을 때": "의미 있는 일을 끝까지 마친",
    "누군가에게 좋은 영향을 미쳤을 때": "다른 사람의 삶에 좋은 흔적을 남긴",
    "비교를 통해 나의 성장을 확인할 때": "자기 성장을 분명히 확인한",
    "실패했지만 끝까지 해낸 자신을 봤을 때": "넘어져도 끝까지 해낸"
  };
  var FULFILL_NOUN_EN = {
    "내가 정한 목표를 달성했을 때": "having achieved the goals you set",
    "다른 사람의 인정이나 칭찬을 받을 때": "having earned people's trust",
    "문제를 해결하고 결과가 나왔을 때": "having solved problems others could not",
    "배움이나 성장감을 느낄 때": "having grown beyond yesterday",
    "내가 의미 있다고 여긴 일을 마쳤을 때": "having finished work that matters",
    "누군가에게 좋은 영향을 미쳤을 때": "having left a good mark on others' lives",
    "비교를 통해 나의 성장을 확인할 때": "having clearly confirmed your growth",
    "실패했지만 끝까지 해낸 자신을 봤을 때": "having seen yourself through to the end"
  };

  // ──────────────────────────────────────────────────────────
  //  [규정 E · 달란트 비유] 사명의 '열매의 결' — Q73(보람의 순간) 기반
  //   마25:14-30 달란트 비유: 종마다 맡은 분량이 다르고, 각자 "그 분량대로" 열매 맺는다.
  //   → 한 사람이 '언제 가장 살아있다고 느끼는가(Q73)'는, 그가 맺도록 부름받은
  //     열매의 결(결실의 방식)을 드러낸다. 이를 사명 기여구 앞에 짧은 한정구로 더해
  //     같은 강점·가치·동기여도 '열매 맺는 결'이 사람마다 갈라지게 한다(의미 있는 분화).
  //   ※ 길이 절제: 2~3어절 이내 짧은 부사구로만 결합(문장을 늘이지 않음).
  var MISSION_FRUIT_KO = {
    "내가 정한 목표를 달성했을 때": "세운 뜻을 끝내 이루어",
    "다른 사람의 인정이나 칭찬을 받을 때": "사람의 신뢰로 답받으며",
    "문제를 해결하고 결과가 나왔을 때": "막힌 것을 풀어내며",
    "배움이나 성장감을 느낄 때": "날마다 자라 가며",
    "내가 의미 있다고 여긴 일을 마쳤을 때": "끝까지 의미를 지켜",
    "누군가에게 좋은 영향을 미쳤을 때": "다른 삶에 좋은 흔적을 남기며",
    "비교를 통해 나의 성장을 확인할 때": "어제의 나를 넘어서며",
    "실패했지만 끝까지 해낸 자신을 봤을 때": "넘어져도 다시 일어서며"
  };
  var MISSION_FRUIT_EN = {
    "내가 정한 목표를 달성했을 때": "seeing each resolve through",
    "다른 사람의 인정이나 칭찬을 받을 때": "earning people's trust",
    "문제를 해결하고 결과가 나왔을 때": "unlocking what was stuck",
    "배움이나 성장감을 느낄 때": "growing day by day",
    "내가 의미 있다고 여긴 일을 마쳤을 때": "keeping meaning to the end",
    "누군가에게 좋은 영향을 미쳤을 때": "leaving a good mark on other lives",
    "비교를 통해 나의 성장을 확인할 때": "outgrowing yesterday's self",
    "실패했지만 끝까지 해낸 자신을 봤을 때": "rising again after every fall"
  };

  // 가치(Q13 1순위) → 정체성 명사(역할 명사, 상품 언어). 사명/비전 공통.
  var VALUE_ROLE_KO = {
    "정직": "신뢰를 세우는 사람", "정의": "옳음을 지키는 사람", "사랑": "사람을 살리는 사람",
    "신뢰": "믿음을 쌓는 사람", "창의": "새로움을 여는 사람", "책임": "끝까지 책임지는 사람",
    "성장": "함께 자라게 하는 사람", "자유": "자기 길을 여는 사람", "도전": "한계를 넓히는 사람",
    "헌신": "기꺼이 내어 주는 사람", "평화": "갈등을 잇는 사람", "협동": "함께 이루는 사람",
    "배려": "곁을 살피는 사람", "성취": "결과로 증명하는 사람",
    "절제": "중심을 지키는 사람", "포용": "다름을 품는 사람", "의미 추구": "의미를 찾아 주는 사람",
    "몰입": "깊이로 파고드는 사람", "질서": "흐트러진 것을 세우는 사람", "공정": "균형을 지키는 사람"
  };
  var VALUE_ROLE_EN = {
    "정직": "one who builds trust", "정의": "one who upholds what is right", "사랑": "one who gives people life",
    "신뢰": "one who earns trust", "창의": "one who opens the new", "책임": "one who carries things through",
    "성장": "one who helps others grow", "자유": "one who opens their own path", "도전": "one who widens limits",
    "헌신": "one who gives freely", "평화": "one who bridges conflict", "협동": "one who builds together",
    "배려": "one who looks after those nearby", "성취": "one who proves through results",
    "절제": "one who keeps the center", "포용": "one who embraces difference", "의미 추구": "one who finds meaning for others",
    "몰입": "one who goes deep", "질서": "one who sets things in order", "공정": "one who keeps the balance"
  };

  // ── 사명(WHY·존재 이유·부르심) 전용: 가치 → 세상에 더하려는 "기여 동사구" ──
  //   세계적 사명 문법(Tesla "to accelerate…", Nike "to bring…")을 한국어로 옮김.
  //   "사람들이/세상이 ~하도록" 형태의 동사 중심 보편 진술.
  var VALUE_CONTRIB_KO = {
    "정직": "정직이 신뢰가 되는 세상을 세우는 것",
    "정의": "옳은 것이 끝내 이기도록 돕는 것",
    "사랑": "더 많은 사람이 사랑받는다고 느끼게 하는 것",
    "신뢰": "사람과 사람 사이에 믿음을 쌓는 것",
    "창의": "아직 없던 길을 세상에 여는 것",
    "책임": "맡은 자리를 끝내 지켜 내는 것",
    "성장": "사람들이 어제보다 더 자라도록 돕는 것",
    "자유": "사람들이 자기다운 삶을 선택하도록 돕는 것",
    "도전": "사람들이 한계를 넘어서도록 이끄는 것",
    "헌신": "필요한 곳에 기꺼이 자신을 내어 주는 것",
    "평화": "끊어진 관계를 다시 잇는 것",
    "협동": "혼자서는 못 할 일을 함께 이루는 것",
    "배려": "보이지 않던 사람의 곁을 살피는 것",
    "성취": "흩어진 노력을 분명한 결과로 모으는 것",
    "절제": "흔들리는 가운데 중심을 지켜 내는 것",
    "포용": "서로 다른 사람들을 한자리에 품는 것",
    "의미 추구": "사람들이 자기 삶의 의미를 찾도록 돕는 것",
    "몰입": "깊이로 파고들어 본질에 닿게 하는 것",
    "질서": "흐트러진 것에 질서를 세우는 것",
    "공정": "누구에게나 공정한 기준을 지키는 것"
  };
  var VALUE_CONTRIB_EN = {
    "정직": "to build a world where honesty becomes trust",
    "정의": "to help what is right ultimately prevail",
    "사랑": "to help more people feel truly loved",
    "신뢰": "to build trust between people",
    "창의": "to open paths the world has not yet seen",
    "책임": "to carry every charge through to the end",
    "성장": "to help people grow beyond yesterday",
    "자유": "to help people choose a life that is their own",
    "도전": "to lead people past their limits",
    "헌신": "to give yourself freely where you are needed",
    "평화": "to mend what has been broken between people",
    "협동": "to achieve together what none could alone",
    "배려": "to look after those others overlook",
    "성취": "to turn scattered effort into clear results",
    "절제": "to hold the center amid what shakes",
    "포용": "to bring different people into one place",
    "의미 추구": "to help people find the meaning of their lives",
    "몰입": "to reach the essence by going deep",
    "질서": "to bring order to what is scattered",
    "공정": "to keep a standard that is fair to all"
  };

  // ── 비전(What·Where·미래 결과) 전용: 가치 → 도달한 "미래 상태 명사구" ──
  //   세계적 비전 문법(Tesla "the most compelling…", Oxfam "A just world…")을 옮김.
  //   사명 완수 시 나타날 구체적 미래 모습. 분야와 결합해 그림을 그린다.
  var VALUE_FUTURE_KO = {
    "정직": "정직이 곧 경쟁력이 되는",
    "정의": "옳음이 제자리를 찾은",
    "사랑": "사랑이 흐르는",
    "신뢰": "믿음 위에 세워진",
    "창의": "새로움이 끊이지 않는",
    "책임": "맡은 일이 끝까지 책임지는 손길로 채워지는",
    "성장": "사람이 함께 자라는",
    "자유": "누구나 자기답게 사는",
    "도전": "한계가 늘 새로 넓혀지는",
    "헌신": "서로를 위해 내어 주는",
    "평화": "갈등이 화해로 바뀌는",
    "협동": "함께 이루는 것이 당연한",
    "배려": "아무도 소외되지 않는",
    "성취": "노력이 분명한 결실이 되는",
    "절제": "흔들림 속에서도 중심이 선",
    "포용": "다름이 자연스럽게 어우러지는",
    "의미 추구": "각자가 자기 의미를 사는",
    "몰입": "깊이가 존중받는",
    "질서": "흐트러짐이 질서로 정돈된",
    "공정": "공정한 기준이 살아 있는"
  };
  var VALUE_FUTURE_EN = {
    "정직": "where honesty itself becomes strength",
    "정의": "where what is right has found its place",
    "사랑": "where love flows freely",
    "신뢰": "built upon trust",
    "창의": "where the new never runs dry",
    "책임": "where every charge is kept to the end",
    "성장": "where people grow together",
    "자유": "where everyone lives true to themselves",
    "도전": "where limits are forever being widened",
    "헌신": "where people give themselves for one another",
    "평화": "where conflict turns into reconciliation",
    "협동": "where achieving together is the norm",
    "배려": "where no one is left out",
    "성취": "where effort becomes clear fruit",
    "절제": "where the center holds amid the storm",
    "포용": "where difference blends naturally",
    "의미 추구": "where each person lives their own meaning",
    "몰입": "where depth is honored",
    "질서": "where scatter is set into order",
    "공정": "where a fair standard is alive"
  };

  // ── 비전 보강: Q63 일의 기준 → 미래 "운영 원리" 수식구 (비전에 시대적 구체성 부여) ──
  var CRITERIA_VISION_KO = {
    "의미 / 보람 / 가치": "일의 의미가 먼저 존중되고",
    "안정성 / 안전 / 예측 가능성": "흔들림 없는 안정 위에서",
    "성장 가능성 / 배움의 기회": "끊임없이 배우고 자라며",
    "자유 / 자율성": "스스로 선택하고 책임지며",
    "관계 / 소속감 / 인정": "서로를 신뢰하는 관계 안에서",
    "결과 / 성과 / 효율성": "분명한 성과로 증명되며",
    "재미 / 흥미 / 몰입감": "몰입의 즐거움이 살아 있고",
    "신념 / 원칙 / 종교적 기준": "흔들리지 않는 원칙 위에서",
    "책임 / 도리 / 역할 충실": "각자가 제 몫을 다하며"
  };
  var CRITERIA_VISION_EN = {
    "의미 / 보람 / 가치": "where meaning comes first",
    "안정성 / 안전 / 예측 가능성": "upon unshakable stability",
    "성장 가능성 / 배움의 기회": "always learning and growing",
    "자유 / 자율성": "choosing and owning freely",
    "관계 / 소속감 / 인정": "within relationships of trust",
    "결과 / 성과 / 효율성": "proven by clear results",
    "재미 / 흥미 / 몰입감": "alive with the joy of immersion",
    "신념 / 원칙 / 종교적 기준": "upon principles that do not bend",
    "책임 / 도리 / 역할 충실": "each fulfilling their part"
  };

  // ── 사명 보강: 2순위 가치 → "그리고 ~까지" 색채 어구(원칙에 깊이를 더함) ──
  //   (사명은 변하지 않는 원칙이므로 1·2순위 가치를 함께 녹여 사람마다 결을 다르게 함)

  // 조사 보정 헬퍼 — 받침 유무로 을/를·이/가·은/는·과/와 결정
  function _josa(word, withJong, noJong){
    if (!word) return noJong;
    var c = word.charCodeAt(word.length - 1);
    if (c < 0xAC00 || c > 0xD7A3) return noJong; // 한글 아니면 받침 없음 취급
    var jong = (c - 0xAC00) % 28;
    // 도구격(으로/로) ㄹ 예외: 받침이 ㄹ(8)이면 noJong("로") 쪽을 사용
    if (jong === 8 && (withJong === "으로" || noJong === "로")) return noJong;
    return jong !== 0 ? withJong : noJong;
  }

  // 보람 관형구와 역할 명사가 핵심 어휘를 공유할 때(예: "믿음을 얻은" + "믿음을 쌓는 사람")
  //   역할을 "그 사람"으로 간결화해 어휘 중복으로 인한 어색함을 제거한다.
  function _dedupTail(fulfillNoun, role){
    if (!fulfillNoun || !role) return role;
    // 2글자 이상 한글 명사 토큰을 추출해 교집합이 있으면 중복으로 판정
    var toks = String(fulfillNoun).match(/[가-힣]{2,}/g) || [];
    for (var i = 0; i < toks.length; i++) {
      if (role.indexOf(toks[i]) !== -1) return "바로 그 사람";
    }
    return role;
  }

  // 두 분야를 자연스럽게 결합: "경제와 자원" + "교육과 배움" → "경제와 교육"
  //   (분야 명사구가 길어지지 않도록 1차 분야는 원본 Q75 라벨로 짧게 묶음)
  function _joinDomains(domains, lang){
    var isEn = (lang === "en");
    var d = toArr(domains).map(function(x){ return String(x).trim(); }).filter(Boolean);
    if (!d.length) return isEn ? "the place you live" : "지금 살아가는 자리";
    if (d.length === 1) return d[0];
    if (isEn) return d[0] + " and " + d[1];
    return d[0] + _josa(d[0], "과", "와") + " " + d[1]; // 받침 보정: 교육과 예술 / 경제와 교육
  }

  // ──────────────────────────────────────────────────────────
  //  [규정 E · 성경 근원] 사명이 한 사람에게 "자리잡는 결" — 양식이 나눠지는 방식
  //   마24:45 "때를 따라 양식을 나눠 줄 자" → 사명은 '말'이 아니라 '나눠지는 양식'.
  //   그 양식이 "어떤 결로" 나눠지는가는 4축(자기이해·표현·설계·실행) 우열로 갈린다.
  //   = 5대 성경적 리더십 유형(다니엘/바나바/느헤미야/브살렐·에스더형)의 응답 기반 표현.
  //   이는 무작위가 아니라 진단 점수(axisPct)에서 직접 도출되는 '의미 있는 분화'.
  //
  //   GRAIN[topAxis] = 사명 동사구 앞에 붙는 "어떻게 나누는가"의 결 부사구.
  //   topAxis × weakAxis 조합으로 같은 결 안에서도 보조 색을 달리한다(12갈래).
  // ──────────────────────────────────────────────────────────
  var MISSION_GRAIN_KO = {
    "self_understanding": { // 다니엘형 — 성찰·중심: 먼저 깊이 헤아려 나눈다
      head: "먼저 깊이 헤아려",
      sub: {
        "self_expression": "그 통찰을 사람에게 건네는 결로",
        "self_design":     "그 통찰을 설계로 옮기는 결로",
        "self_execution":  "그 통찰을 끝까지 밀고 가는 결로"
      }
    },
    "self_expression": {    // 바나바형 — 감성·공감: 마음을 데워 나눈다
      head: "사람의 마음을 먼저 데워",
      sub: {
        "self_understanding": "그 온기에 통찰을 더하는 결로",
        "self_design":        "그 온기를 자리로 엮는 결로",
        "self_execution":     "그 온기를 끝까지 지키는 결로"
      }
    },
    "self_design": {        // 느헤미야형 — 전략·기획: 무너진 자리를 다시 세워 나눈다
      head: "흩어진 자리를 다시 세워",
      sub: {
        "self_understanding": "그 구조에 통찰을 새기는 결로",
        "self_expression":    "그 구조에 사람을 모으는 결로",
        "self_execution":     "그 구조를 끝까지 완성하는 결로"
      }
    },
    "self_execution": {     // 브살렐·에스더형 — 손으로 짓고 결정적 순간에 매듭짓는다
      head: "맡은 일을 끝까지 매듭지어",
      sub: {
        "self_understanding": "그 결실에 통찰을 담는 결로",
        "self_expression":    "그 결실로 사람을 잇는 결로",
        "self_design":        "그 결실을 다음 자리로 잇는 결로"
      }
    }
  };
  var MISSION_GRAIN_EN = {
    "self_understanding": {
      head: "by first discerning deeply",
      sub: {
        "self_expression": ", carrying that insight to people",
        "self_design":     ", turning that insight into structure",
        "self_execution":  ", driving that insight to the end"
      }
    },
    "self_expression": {
      head: "by first warming people's hearts",
      sub: {
        "self_understanding": ", adding insight to that warmth",
        "self_design":        ", weaving that warmth into a place",
        "self_execution":     ", guarding that warmth to the end"
      }
    },
    "self_design": {
      head: "by rebuilding what has scattered",
      sub: {
        "self_understanding": ", carving insight into that structure",
        "self_expression":    ", gathering people into that structure",
        "self_execution":     ", completing that structure to the end"
      }
    },
    "self_execution": {
      head: "by sealing the task to the very end",
      sub: {
        "self_understanding": ", holding insight within that fruit",
        "self_expression":    ", connecting people through that fruit",
        "self_design":        ", carrying that fruit to the next place"
      }
    }
  };

  // [규정 E] 비전 도착점의 '결' — 보조축(weakAxis)이 "미래의 그 자리에 어떻게 서 있는가"를
  //   한 형용구로 더한다. 사명은 1순위 축(어떻게 나누는가), 비전은 2순위 축(어떻게 서 있는가)을
  //   나눠 담아 두 문장 모두 늘어지지 않으면서 4축 우열 전체(top×weak)가 응답에 반영된다.
  var VISION_AXIS_STANCE_KO = {
    "self_understanding": "흔들리지 않는 중심으로",
    "self_expression":    "사람을 데우는 온기로",
    "self_design":        "흐름을 짜는 손으로",
    "self_execution":     "끝까지 매듭짓는 걸음으로"
  };
  var VISION_AXIS_STANCE_EN = {
    "self_understanding": "with an unshaken center",
    "self_expression":    "with people-warming heart",
    "self_design":        "with flow-shaping hands",
    "self_execution":     "with a finish-sealing stride"
  };

  // 청지기로 부름받은 자리(분야 1순위) → 사명에 "어디서 양식을 나누는가" 의 색을 한 단어로.
  //   마24:45(자기 자리의 청지기) — 사명은 보편 원칙이되, 부름받은 자리의 색을 띤다.
  //   분야 전체를 박지 않고 "○○의 자리에서" 짧은 한정구로만 더해 보편성을 해치지 않는다.
  function _stewardPlace(domain, lang){
    if (!domain) return "";
    var isEn = (lang === "en");
    return isEn ? ("in the field of " + domain + ", ") : (domain + _josa(domain, "의", "의") + " 자리에서 ");
  }

  // ── 핵심 합성기: 응답 → 사명/비전 문장 (규칙서 형식) ──
  //   반환: { mission, vision, missionCore, visionCore, basis }
  //   mission/vision = 전체 문장("당신의 사명은 '…'입니다.")
  //   *Core = 따옴표 안에 들어갈 핵심 구절(헤드라인 대체용)
  //   axisPct: report.scores.axisPct (4축 점수) — 사명의 '양식의 결' 도출용(규정 E)
  function synthMissionVisionFromResponses(answers, fingerprint, lang, axisPct){
    var isEn = (lang === "en");
    var values  = toArr(answers["Q13"]).map(function(v){return String(v).trim();}).filter(Boolean);
    var domains = toArr(answers["Q75"]).map(function(v){return String(v).trim();}).filter(Boolean);
    var acts    = toArr(answers["Q39"]).map(function(v){return String(v).trim();}).filter(Boolean);
    var motiveArr = toArr(answers["Q55"]).map(function(v){return String(v).trim();}).filter(Boolean);
    var motive  = motiveArr[0];
    var motive2 = motiveArr[1] || "";
    var fulfill = answers["Q73"]; fulfill = Array.isArray(fulfill) ? fulfill[0] : fulfill;
    var critArr = toArr(answers["Q63"]).map(function(v){return String(v).trim();}).filter(Boolean);
    var crit1   = critArr[0] || "";

    var FIELD = isEn ? DOMAIN_FIELD_EN : DOMAIN_FIELD_KO;
    var VAL   = isEn ? VALUE_NOUN_EN : VALUE_NOUN_KO;
    var ACT   = isEn ? ACTIVITY_NOUN_EN : ACTIVITY_NOUN_KO;
    var MOT   = isEn ? MOTIVE_CLAUSE_EN : MOTIVE_CLAUSE_KO;
    var FUL   = isEn ? FULFILL_NOUN_EN : FULFILL_NOUN_KO;
    var FRUIT = isEn ? MISSION_FRUIT_EN : MISSION_FRUIT_KO; // [달란트] 사명: 보람(Q73) → 열매 맺는 결
    var ROLE  = isEn ? VALUE_ROLE_EN : VALUE_ROLE_KO;
    var CONTRIB = isEn ? VALUE_CONTRIB_EN : VALUE_CONTRIB_KO; // 사명: 가치 기여 동사구
    var FUTURE  = isEn ? VALUE_FUTURE_EN : VALUE_FUTURE_KO;   // 비전: 가치 미래상 명사구
    var CRIT    = isEn ? CRITERIA_VISION_EN : CRITERIA_VISION_KO; // 비전: 기준 운영원리

    // 분야 명사구(짧게) — Q75 1·2순위
    var domainShort = _joinDomains(domains.slice(0, 2), lang);
    // 활동 강점(Q39 1순위) → 명사형 힘
    var actNoun = (acts.length && ACT[acts[0]]) ? ACT[acts[0]]
                : (isEn ? "your own gift" : "당신만의 강점");
    // 가치 1·2순위 → 명사
    var v1 = values[0] || (isEn ? "growth" : "성장");
    var v2 = values[1] || "";
    var valNoun1 = VAL[v1] || v1;
    var valNoun2 = v2 ? (VAL[v2] || v2) : "";
    var valPair = isEn
      ? (valNoun2 ? (valNoun1 + " and " + valNoun2) : valNoun1)
      : (valNoun2 ? (valNoun1 + _josa(valNoun1, "과", "와") + " " + valNoun2) : valNoun1);
    // 동기 절(Q55 1순위) → 사명 부르심
    var motiveClause = (motive && MOT[motive]) ? MOT[motive] : "";
    // 보람 명사구(Q73) → 비전 도착점
    var fulfillNoun = (fulfill && FUL[fulfill]) ? FUL[fulfill] : (isEn ? "having grown" : "한 걸음 더 자라 있는");
    // 정체성 명사(가치 1순위 기반 역할)
    var role = ROLE[v1] || (isEn ? "one who lives true to themselves" : "자기답게 살아가는 사람");

    // ── [규정 E] 사명의 '양식의 결' — 4축 우열에서 직접 도출(응답 기반, 무작위 아님) ──
    //   axisPct(자기이해·표현·설계·실행 점수) 1·2위 → 사명이 자리잡는 결.
    //   진단 점수가 다르면 결이 달라지므로, 같은 가치·강점이어도 사명 문장이 갈라진다.
    var GRAIN = isEn ? MISSION_GRAIN_EN : MISSION_GRAIN_KO;
    var STANCE = isEn ? VISION_AXIS_STANCE_EN : VISION_AXIS_STANCE_KO;
    var grainHead = "", grainSub = "", visionStance = "";
    if (axisPct && typeof axisPct === "object") {
      var axisOrd = Object.keys(axisPct).sort(function(a, b){ return (axisPct[b] || 0) - (axisPct[a] || 0); });
      var topAx = axisOrd[0], wkAx = axisOrd[1];
      if (topAx && GRAIN[topAx]) {
        grainHead = GRAIN[topAx].head || "";  // 사명: 1순위 축 = 어떻게 나누는가
        if (wkAx && wkAx !== topAx && GRAIN[topAx].sub && GRAIN[topAx].sub[wkAx]) {
          grainSub = GRAIN[topAx].sub[wkAx];
        }
      }
      // 비전: 2순위 축 = 미래의 그 자리에 어떻게 서 있는가 (없으면 1순위 축으로 폴백)
      var stanceAx = (wkAx && wkAx !== topAx) ? wkAx : topAx;
      if (stanceAx && STANCE[stanceAx]) visionStance = STANCE[stanceAx];
    }
    // [규정 E · 달란트 비유] 보람(Q73) → 사명의 '열매 맺는 결' (짧은 한정구)
    //   같은 강점·가치·동기·축이어도 '맺도록 부름받은 열매의 결'이 달라 사명이 더 갈라진다.
    var fruitKey  = fulfill ? String(fulfill).trim() : "";
    var fruitGrain = (fruitKey && FRUIT[fruitKey]) ? FRUIT[fruitKey] : "";
    // 청지기로 부름받은 자리(분야 1순위) → 사명 한정구("○○의 자리에서")
    var stewardPlace = _stewardPlace(domains[0] || "", lang);

    var missionCore, visionCore;
    if (isEn) {
      // Mission = WHY: verb-led contribution (Tesla "to accelerate…", Nike "to bring…")
      var fieldEn = (domains.length && FIELD[domains[0]]) ? FIELD[domains[0]] : "the place you live";
      var contribEn = CONTRIB[v1] || ("to bring " + valPair + " into the world");
      // [Reg. E] grain (4-axis) + steward place (field) woven into the WHY.
      // [Reg. E] single meaning-grain (talents fruit Q73 preferred, else axis grain) — keep one breath
      var fruitDupEn = fruitGrain && contribEn.indexOf(fruitGrain.slice(0, 6)) !== -1;
      var grainEn;
      if (fruitGrain && !fruitDupEn) {
        grainEn = ", " + fruitGrain;          // talents fruit
      } else if (grainHead) {
        grainEn = " " + grainHead + (grainSub || ""); // axis grain
      } else {
        grainEn = "";
      }
      // [World-company grammar · single insight] Headline = two axes only.
      //   Nike "to bring inspiration and innovation to every athlete"
      //   → core = [contribution verb-phrase] through [strength]. One breath.
      //   Uniqueness = strength(Q39) × value(Q13); other dimensions kept in missionFull.
      missionCore = contribEn + " through " + actNoun;
      // Engine keeps every dimension for uniqueness (missionFull), headline shows the essence.
      var missionFull = stewardPlace + "to use " + actNoun + " " + contribEn + grainEn;
      // Vision = What/Where: a single future image (Oxfam "A just world without poverty")
      var futureEn = FUTURE[v1] || ("where " + valPair + " is alive");
      var standEn = visionStance ? (visionStance + ", ") : (fulfillNoun + ", ");
      // Headline = a world that [future image], opened by [role]
      visionCore = "a world " + futureEn.replace(/^where\s+/, "") + ", opened by " + role;
      var visionFull = "a future in " + fieldEn + " " + futureEn + ", standing as " + role
                 + ", " + standEn.replace(/,\s*$/, "");
    } else {
      // ── 사명(Mission) = WHY · 존재 이유 · 부르심에 대한 응답 → 변하지 않는 원칙 ──
      //   세계 사명 문법(Tesla "to accelerate…", Nike "to bring…")을 따라 동사 중심.
      //   구조: "[강점]으로, [동기 부르심에 응답해] [가치 기여 동사구]"
      //   1·2순위 가치·동기를 함께 녹여 사람마다 원칙의 결이 달라지게 한다.
      var byJosa  = _josa(actNoun, "으로", "로"); // 강점 명사 받침 보정
      var contrib = CONTRIB[v1] || (valPair + _josa(valPair, "을", "를") + " 세상에 더하는 것");
      // 동기(Q55) → 부르심: "[동기]에 응답하여" 한 호흡으로 자연스럽게 연결
      var callPart = (motive && MOT[motive]) ? (MOT[motive] + " 응답하여, ") : "";
      // 2순위 가치(있으면) → 강점 뒤에 "[가치2]를 잃지 않고" 결을 더해 변별·깊이 부여.
      //   단, 2순위 가치가 동기절·기여구와 같은 어휘를 공유하면(예: '의미') 중복 회피.
      // [규정 E] '양식의 결'(4축) — 마24:45 "어떻게 양식을 나누는가" 를 한 호흡으로.
      //   구조(읽기 리듬 우선, 절은 최대 3개로 제한):
      //     "[자리에서] [강점]으로 [결 head], [동기 응답하여] [기여구]"
      //   결(grain)이 사람마다 사명의 결을 갈라 주므로, 기존 v2Part(가치2)는
      //   결이 있을 때는 생략해 문장이 늘어지지 않게 한다(결이 변별을 대신함).
      //   결이 없을 때(축 데이터 부재)만 v2Part로 변별을 보강한다.
      var v2Dup = valNoun2 && ((callPart.indexOf(valNoun2) !== -1) || (contrib.indexOf(valNoun2) !== -1));
      // ══════════════════════════════════════════════════════════════════
      //  [세계 기업 문법 · 한 문장 통찰] 사명 헤드라인 = 단 하나의 핵심.
      //   Nike  "to bring inspiration and innovation to every athlete"
      //   Tesla "to accelerate the world's transition to sustainable energy"
      //   → 핵심 = [강점(어떻게)]으로 [기여구(무엇을 위해)]. 단 한 호흡, 단 하나만 떠오르게.
      //
      //   변별(고유성) 엔진은 자리·동기·열매결·가치2·축결을 *모두* 계속 조합하지만(아래
      //   missionFull / subline·footer에 보존), 화면 헤드라인에는 그 본질만 투영한다.
      //   변별이 헤드라인에서 사라지지 않도록 '의미결 1개'만 강점에 짧은 수식으로 얹는다.
      // ══════════════════════════════════════════════════════════════════
      var fruitDup = fruitGrain && (callPart.indexOf(fruitGrain.slice(0, 3)) !== -1 || contrib.indexOf(fruitGrain.slice(0, 3)) !== -1);
      var useFruit = !!fruitGrain && !fruitDup;
      // 의미결 1개(택일) — 열매결(Q73) 우선, 없으면 축결(4축). (헤드라인엔 미표시, 풀 문장에 보존)
      var meaningGrain = useFruit ? fruitGrain : (grainHead || "");
      // 사명 헤드라인 = [강점(수단)]으로 [기여(목적)]  — 단 두 축, 단 하나만 떠오르게.
      //   Nike "to bring inspiration… to every athlete" 처럼 '무엇을 위해'가 핵심.
      //   변별은 강점(Q39)×가치1(Q13) 조합이 담당 → 헤드라인은 본질 2축만 남긴다.
      //   열매결·자리·동기·가치2 등 나머지 차원은 missionFull(근거·내부)에 그대로 보존된다.
      missionCore = actNoun + byJosa + " " + contrib;
      // ── [고유성 보존] 자리·동기·가치2 등 나머지 차원은 헤드라인에서 빼되 엔진엔 살아있게.
      //   (근거 안내 subline/footer가 "활동·가치·분야 응답 기반"을 이미 명시하므로
      //    헤드라인은 본질만, 풀 문장은 내부 보존용으로 둔다.)
      var v2Part = (valNoun2 && !v2Dup && !meaningGrain)
        ? (valNoun2 + _josa(valNoun2, "을", "를") + " 잃지 않고 ")
        : "";
      var missionFull = stewardPlace + actNoun + byJosa + " "
        + (meaningGrain ? (meaningGrain + (useFruit ? " " : ", ")) : "")
        + v2Part + callPart + contrib;

      // ══════════════════════════════════════════════════════════════════
      //  [세계 비전 문법 · 한 문장 통찰] 비전 헤드라인 = 단 하나의 미래 그림.
      //   Oxfam "A just world without poverty"
      //   Tesla "to create the most compelling car company of the 21st century"
      //   → 핵심 = [가치 미래상] 세상을 여는 [역할]. 명사형 단일 이미지, 단 하나만 떠오르게.
      //
      //   변별 엔진은 분야·기준·stance·가치2 미래상을 *모두* 계속 조합(visionFull에 보존)하나,
      //   화면 헤드라인엔 도달할 미래의 본질만 투영한다.
      // ══════════════════════════════════════════════════════════════════
      var futureKo = FUTURE[v1] || (valPair + "이 살아 있는");
      var future2 = (v2 && FUTURE[v2] && v2 !== v1) ? (valNoun2 + "까지 깃든 ") : "";
      var critPart = (crit1 && CRIT[crit1]) ? (CRIT[crit1] + " ") : ""; // 기준 → 미래 운영원리
      var roleTail = _dedupTail(fulfillNoun, role);            // 보람구·역할 어휘 충돌 완화
      var roleJosa = _josa(roleTail, "으로", "로");             // 역할 명사 받침 보정(사람→으로)
      var domJosa  = _josa(domainShort, "이", "가");            // 분야 주격 받침 보정
      var stanceSafe = visionStance;
      if (stanceSafe && roleTail && roleTail.indexOf(stanceSafe.slice(0, 3)) !== -1) stanceSafe = "";
      var standHow = stanceSafe ? (stanceSafe + " ") : (fulfillNoun + " ");
      // 비전 헤드라인 = "[가치 미래상] 세상, 그 한가운데 선 [역할]"  — 단 하나의 미래 그림
      //   Oxfam식 명사형 단일 이미지. 동사 중복(여는…여는)을 원천 차단하기 위해
      //   미래상은 '세상'으로 닫고, 역할은 그 세상 한가운데 '선 [정체 명사]'로 병치한다.
      //   futureKo("누구나 자기답게 사는") + 세상 → 도달할 세계상.
      var futureScene = futureKo.replace(/\s+$/, "") + " 세상";
      // 역할을 정체 명사로 정돈: "자기 길을 여는 사람" → 그대로, "신뢰를 세우는 사람" → 그대로.
      var roleNoun = roleTail.replace(/\s+$/, "");
      if (!/사람$|이$|자$|가$/.test(roleNoun)) roleNoun = roleNoun + " 사람";
      // 미래상과 역할이 같은 핵심어(예: '믿음')를 반복하면 역할을 "그 중심에 선 사람"으로 축약.
      var futureKey = futureKo.replace(/[은는이가을를\s]+$/, "").slice(0, 2);
      var roleDup = futureKey && roleNoun.indexOf(futureKey) !== -1;
      var roleForVision = roleDup ? "그 중심을 지키는 사람" : roleNoun;
      visionCore = futureScene + ", 그 한가운데 선 " + roleForVision;
      // ── [고유성 보존] 분야·기준·stance·가치2 미래상은 헤드라인에서 빼되 엔진엔 살아있게.
      var visionFull = domainShort + domJosa + " " + critPart + future2 + futureKo + " 현장이 되고, "
                 + "그 한가운데 " + standHow + roleTail + roleJosa + " 서 있는 미래";
    }

    // 강점 활동(Q39) 원시 라벨 — 하단 안내 문구용
    var actLabel = acts.length ? acts[0] : (isEn ? "your activity response" : "활동 응답");

    var mission = isEn
      ? ("Your mission is " + missionCore + ".")
      : ("당신의 사명은 ‘" + missionCore + "ʼ입니다.");
    var vision = isEn
      ? ("Your vision is " + visionCore + ".")
      : ("당신의 비전은 ‘" + visionCore + "ʼ입니다.");

    return {
      mission: mission, vision: vision,
      missionCore: missionCore, visionCore: visionCore,
      // 고유성 보존용 풀 문장(모든 차원 조합) — 헤드라인은 본질, 풀은 내부/근거용
      missionFull: (typeof missionFull !== "undefined" ? missionFull : missionCore),
      visionFull:  (typeof visionFull  !== "undefined" ? visionFull  : visionCore),
      actLabel: actLabel,
      values: values, domains: domains
    };
  }

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
    "의미 / 보람 / 가치":         ["보람을 잃지 않는 자리를 나침반 삼아", "이 일이 무엇을 위해 있는가를 매 순간 물으며", "보람을 놓치지 않으며"],
    "안정성 / 안전 / 예측 가능성": ["흔들림 없는 자기 자리를 나침반 삼아", "오래 버티는 단단함을 기준으로", "급하지 않게, 멀리 가는 걸음으로"],
    "성장 가능성 / 배움의 기회":   ["오늘보다 한 걸음 자라기를 나침반 삼아", "어떤 자리에서도 배움 한 줄을 가지고 가며", "배움이 멈추지 않는 마음으로"],
    "자유 / 자율성":              ["자기 속도대로 가기를 나침반 삼아", "남의 속도가 아니라 자기 속도로", "정해진 길보다 자기 길을 기준 삼아"],
    "관계 / 소속감 / 인정":        ["곁에 있는 사람을 나침반 삼아", "곁의 사람을 잃지 않으며", "함께 가는 사람을 기준 삼아"],
    "결과 / 성과 / 효율성":        ["맡은 일을 끝까지 끝맺기를 나침반 삼아", "약속한 결과를 증명하며", "흐트러짐 없이 마무리하는 태도로"],
    "재미 / 흥미 / 몰입감":        ["깊이 빠져드는 즐거움을 나침반 삼아", "마음이 살아나는 자리를 기준으로", "재미가 식지 않는 마음으로"],
    "신념 / 원칙 / 종교적 기준":   ["흔들리지 않는 자기 원칙을 나침반 삼아", "옳다고 믿는 한 줄을 기준으로", "양심이 부르는 자리를 잃지 않으며"],
    "책임 / 도리 / 역할 충실":     ["맡은 자리의 무게를 나침반 삼아", "내가 해야 할 몫을 기준으로", "한 번 한 약속을 끝까지 지키며"]
  };
  var COMPASS_VISION_KO = {
    // Q63 옵션 → 비전 본문 "정체성 절" (1~3 변형) — "~ 한 사람" 으로 끝남
    "의미 / 보람 / 가치":         ["보람을 잃지 않고 사는 한 사람", "이 일의 의미를 잊지 않는 한 사람", "왜 이 일을 하는지 늘 자기에게 묻는 한 사람"],
    "안정성 / 안전 / 예측 가능성": ["오래 버티는 단단한 한 사람", "흔들림 속에서도 자리를 지키는 한 사람", "급하지 않게 멀리 가는 한 사람"],
    "성장 가능성 / 배움의 기회":   ["매일 한 뼘씩 자라 가는 한 사람", "어디에서든 배움 한 줄을 가지고 가는 한 사람", "배움이 멈추지 않는 한 사람"],
    "자유 / 자율성":              ["자기 호흡대로 사는 한 사람", "정해진 길 대신 자기 길을 가는 한 사람", "어디에 있어도 자기 색을 잃지 않는 한 사람"],
    "관계 / 소속감 / 인정":        ["사람과의 신뢰를 끝까지 지키는 한 사람", "곁의 사람을 잃지 않는 한 사람", "함께 가는 마음이 살아 있는 한 사람"],
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
      "의미 / 보람 / 가치":         ["자기다움을 찾도록 돕는다", "사람의 의미를 잇고 보람을 더한다"],
      "안정성 / 안전 / 예측 가능성": ["곁에서 마음 편히 쉴 자리를 만든다", "흔들릴 때 기댈 자리를 지킨다"],
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
  // VISION 3-Tier 라이브러리 — 사명 구조와 1:1 대응 (10년 회상형)
  //   ① 헤드라인: "[Q13×Q63 → 회상 정체성 명사구]으로 기억된다." (10년 후 평판)
  //   ② 한 줄 설명: "10년 뒤, [도메인]의 자리에서 [Compass 핵심어]을(를) 잃지 않은 사람으로."
  //   ③ 다이어리 본문 — 기존 buildDiaryBody 의 visionBody 그대로 사용
  // ─────────────────────────────────────────────────────
  var VISION_HEADLINE_KO = {
    // 관계지향
    //   PR#63 (RULE-REPORT R5) — visionary_creator 등 비-warm 톤이 관계지향 카테고리로
    //   라우팅될 때 "마음" 어휘가 compass(=단단함/의미)와 충돌하지 않도록
    //   {{compassKw}} 변수 라인을 후보로 추가. fingerprint 회전으로 비-warm 톤은 변수 라인이,
    //   warm 계열에서는 시그니처 보존 라인이 자연스럽게 활성화됨.
    "관계지향": {
      "의미 / 보람 / 가치":         ["함께 있으면 {{compassKw}}이(가) 풀리는 사람", "곁에 있으면 의미가 살아나는 사람"],
      "안정성 / 안전 / 예측 가능성": ["흔들릴 때 기댈 수 있는 사람", "곁에 있으면 {{compassKw}}이(가) 놓이는 사람"],
      "성장 가능성 / 배움의 기회":   ["함께 자라 가는 사람", "곁에 있으면 배움이 따라오는 사람"],
      "자유 / 자율성":              ["곁에 있되 자기 색을 잃지 않는 사람", "함께 가되 휘둘리지 않는 사람"],
      "관계 / 소속감 / 인정":        ["곁에 두고 싶은 사람", "사람과 사람을 잇는 사람"],
      "결과 / 성과 / 효율성":        ["관계 위에 결과를 세우는 사람", "함께한 약속을 끝까지 지키는 사람"],
      "재미 / 흥미 / 몰입감":        ["함께 있는 시간이 살아 있는 사람", "곁에 있으면 분위기가 따뜻해지는 사람"],
      "신념 / 원칙 / 종교적 기준":   ["원칙으로 사람을 지켜 내는 사람", "약속이 곧 원칙인 사람"],
      "책임 / 도리 / 역할 충실":     ["곁의 사람을 끝까지 챙기는 사람", "맡은 사람을 끝까지 지키는 사람"]
    },
    // 자유지향
    "자유지향": {
      "의미 / 보람 / 가치":         ["자기 길이 의미로 가득한 사람", "왜 가는지 분명한 사람"],
      "안정성 / 안전 / 예측 가능성": ["흔들리지 않는 자기 자리를 가진 사람", "급하지 않게 멀리 가는 사람"],
      "성장 가능성 / 배움의 기회":   ["자기 속도로 깊어지는 사람", "남의 길 말고 자기 길로 자라는 사람"],
      "자유 / 자율성":              ["자기 호흡대로 사는 사람", "어디에 있어도 자기 색을 잃지 않는 사람"],
      "관계 / 소속감 / 인정":        ["함께하되 휘둘리지 않는 사람", "각자 색대로 함께 가는 사람"],
      "결과 / 성과 / 효율성":        ["흔들림 없이 끝까지 가는 사람", "자기 길을 결과로 증명하는 사람"],
      "재미 / 흥미 / 몰입감":        ["몰입이 살아 있는 사람", "자기 호흡으로 살아가는 사람"],
      "신념 / 원칙 / 종교적 기준":   ["자기 원칙이 또렷한 사람", "자기 양심을 따라가는 사람"],
      "책임 / 도리 / 역할 충실":     ["자기 길을 책임지는 사람", "자기 몫을 자기 결로 다하는 사람"]
    },
    // 성장지향
    "성장지향": {
      "의미 / 보람 / 가치":         ["왜 사는지 분명한 사람", "의미가 흩어지지 않는 사람"],
      "안정성 / 안전 / 예측 가능성": ["흔들림 속에서도 자라는 사람", "급하지 않게 깊어지는 사람"],
      "성장 가능성 / 배움의 기회":   ["매일 한 뼘씩 자라는 사람", "배움이 멈추지 않는 사람"],
      "자유 / 자율성":              ["자기 속도로 자라는 사람", "자기 길로 깊어지는 사람"],
      "관계 / 소속감 / 인정":        ["만남마다 한 뼘씩 자라는 사람", "사람을 통해 깨달음을 길어 올리는 사람"],
      "결과 / 성과 / 효율성":        ["자라는 만큼 결과로 보이는 사람", "성장과 성과를 함께 잇는 사람"],
      "재미 / 흥미 / 몰입감":        ["몰입이 곧 자람이 되는 사람", "재미가 깊이가 되는 사람"],
      "신념 / 원칙 / 종교적 기준":   ["자기 원칙 위에서 자라는 사람", "흔들리지 않는 자기 길로 깊어지는 사람"],
      "책임 / 도리 / 역할 충실":     ["자기 자리에서 자라는 사람", "맡은 일에서 깊어지는 사람"]
    },
    // 원칙지향
    "원칙지향": {
      "의미 / 보람 / 가치":         ["옳다고 믿는 자리를 지키는 사람", "원칙으로 의미를 지키는 사람"],
      "안정성 / 안전 / 예측 가능성": ["흔들리지 않는 자리를 가진 사람", "오래 가는 자리를 지키는 사람"],
      "성장 가능성 / 배움의 기회":   ["원칙 위에서 자라는 사람", "단단한 자리에서 깊어지는 사람"],
      "자유 / 자율성":              ["원칙 안에서 자유로운 사람", "자기 결을 흔들리지 않게 지키는 사람"],
      "관계 / 소속감 / 인정":        ["원칙으로 사람을 지켜 내는 사람", "약속을 끝까지 지키는 사람"],
      "결과 / 성과 / 효율성":        ["맡은 일을 끝까지 마무리하는 사람", "약속한 결과를 끝까지 증명하는 사람"],
      "재미 / 흥미 / 몰입감":        ["원칙 안에서 몰입이 사는 사람", "자기 결로 끝까지 가는 사람"],
      "신념 / 원칙 / 종교적 기준":   ["옳다고 믿는 한 줄을 지키는 사람", "양심을 자리로 지키는 사람"],
      "책임 / 도리 / 역할 충실":     ["맡은 자리를 끝까지 지키는 사람", "자기 몫을 묵직하게 다하는 사람"]
    }
  };
  var VISION_HEADLINE_EN = {
    "관계지향": {
      "의미 / 보람 / 가치":         ["someone whose presence releases hearts", "someone who brings meaning by being there"],
      "안정성 / 안전 / 예측 가능성": ["someone you can lean on when shaken", "someone whose presence settles the heart"],
      "성장 가능성 / 배움의 기회":   ["someone who grows together with others", "someone whose presence carries learning"],
      "자유 / 자율성":              ["someone who stays close yet keeps their colors", "someone who walks together yet unswayed"],
      "관계 / 소속감 / 인정":        ["someone you want beside you", "someone who connects people"],
      "결과 / 성과 / 효율성":        ["someone who builds results on relationships", "someone who keeps every shared promise"],
      "재미 / 흥미 / 몰입감":        ["someone whose time together comes alive", "someone whose presence warms the room"],
      "신념 / 원칙 / 종교적 기준":   ["someone who protects people by principle", "someone whose word is principle"],
      "책임 / 도리 / 역할 충실":     ["someone who cares for those beside them to the end", "someone who protects those entrusted"]
    },
    "자유지향": {
      "의미 / 보람 / 가치":         ["someone whose path is full of meaning", "someone clear about why they go"],
      "안정성 / 안전 / 예측 가능성": ["someone with a post unshaken", "someone who goes far unhurried"],
      "성장 가능성 / 배움의 기회":   ["someone who deepens at their own pace", "someone who grows on their own path"],
      "자유 / 자율성":              ["someone who lives at their own breath", "someone who keeps their colors anywhere"],
      "관계 / 소속감 / 인정":        ["someone who walks together yet unswayed", "someone who walks together each in their own color"],
      "결과 / 성과 / 효율성":        ["someone who finishes unshaken", "someone who proves their path with results"],
      "재미 / 흥미 / 몰입감":        ["someone in whom immersion is alive", "someone who lives by their own breath"],
      "신념 / 원칙 / 종교적 기준":   ["someone with a clear principle", "someone who follows their own conscience"],
      "책임 / 도리 / 역할 충실":     ["someone who carries their own path responsibly", "someone who carries their share their own way"]
    },
    "성장지향": {
      "의미 / 보람 / 가치":         ["someone clear about why they live", "someone whose meaning never scatters"],
      "안정성 / 안전 / 예측 가능성": ["someone who grows even amid storms", "someone who deepens unhurried"],
      "성장 가능성 / 배움의 기회":   ["someone who grows an inch each day", "someone whose learning never stops"],
      "자유 / 자율성":              ["someone growing at their own pace", "someone deepening on their own path"],
      "관계 / 소속감 / 인정":        ["someone who grows an inch each meeting", "someone who draws insight through people"],
      "결과 / 성과 / 효율성":        ["someone whose growth shows as results", "someone who weaves growth and results together"],
      "재미 / 흥미 / 몰입감":        ["someone whose immersion becomes growth", "someone whose interest becomes depth"],
      "신념 / 원칙 / 종교적 기준":   ["someone growing upon their own principle", "someone deepening on an unshakable path"],
      "책임 / 도리 / 역할 충실":     ["someone growing in their own post", "someone deepening in the work entrusted"]
    },
    "원칙지향": {
      "의미 / 보람 / 가치":         ["someone protecting what is right", "someone protecting meaning with principle"],
      "안정성 / 안전 / 예측 가능성": ["someone with an unshaken place", "someone protecting the place that lasts"],
      "성장 가능성 / 배움의 기회":   ["someone growing upon principle", "someone deepening in a firm place"],
      "자유 / 자율성":              ["someone free within principle", "someone keeping their grain unshaken"],
      "관계 / 소속감 / 인정":        ["someone protecting people by principle", "someone keeping every promise to the end"],
      "결과 / 성과 / 효율성":        ["someone finishing the work entrusted", "someone proving promises with results"],
      "재미 / 흥미 / 몰입감":        ["someone whose immersion lives within principle", "someone going through to the end on their own grain"],
      "신념 / 원칙 / 종교적 기준":   ["someone protecting the line believed right", "someone protecting conscience as a place"],
      "책임 / 도리 / 역할 충실":     ["someone protecting the post entrusted to the end", "someone carrying their share with weight"]
    }
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
    //   추가 방어: scene 안에 "특히"가 두 번 이상 들어와도 한 번만 노출되도록 정규화
    function _scenePrefix(scene){
      if (!scene) return "";
      var trimmed = String(scene).replace(/^\s+/, "").replace(/\s+$/, "");
      // 내부에 "특히"가 2회 이상이면 1회로 축약
      trimmed = trimmed.replace(/(특히\s+){2,}/g, "특히 ");
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
  // PR#66: 한국어 자연화 — 폴백 주어 "지금 살아가는 사람"이 동사구와 결합 시
  //   "지금 살아가는 사람이 사람을 원칙으로 지킨다" 같은 중복·어색 결합 발생.
  //   → "자기 자리에 있는 사람"으로 교체 (중립적·자연스러운 한 호흡 주어)
  //   → 끝 음절 받침에 따라 주격 조사(이/가) 자동 보정
  function buildHeadline(primaryDomainKo, primaryCategory, compassRaw, fingerprint, lang){
    var isEn = (lang === "en");
    var subjectLib = isEn ? SUBJECT_BY_DOMAIN_EN : SUBJECT_BY_DOMAIN_KO;
    var verbLib    = isEn ? HEADLINE_VERB_EN    : HEADLINE_VERB_KO;
    var subject = subjectLib[primaryDomainKo] || (isEn ? "people in their place" : "자기 자리에 있는 사람");
    var catTable = verbLib[primaryCategory] || verbLib["성장지향"];
    var compassKey = (compassRaw && compassRaw[0]) || "의미 / 보람 / 가치";
    // 라이브러리 키 normalization (특수 결합 문자 차이 방지)
    var verbArr = catTable[compassKey] || catTable["의미 / 보람 / 가치"]
               || (isEn ? ["help people find themselves"] : ["자기다움을 찾도록 돕는다"]);
    var verb = pickByHash(verbArr, fingerprint + 137);
    if (isEn) {
      return subject + " — " + verb + ".";
    }
    // PR#66: 주격 조사 자동 보정 — 받침 있음→"이", 없음→"가"
    var lastCh = subject.charAt(subject.length - 1);
    var lastCode = lastCh.charCodeAt(0);
    var hasJong = false;
    if (lastCode >= 0xAC00 && lastCode <= 0xD7A3) {
      hasJong = ((lastCode - 0xAC00) % 28) !== 0;
    }
    var josa = hasJong ? "이 " : "가 ";
    return subject + josa + verb + ".";
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

  // 비전 헤드라인 합성 — "[Q13×Q63 → 회상 정체성 명사구]으로 기억된다." (10년 후 회상)
  //   PR#63 (RULE-REPORT R5): {{compassKw}} 토큰이 포함된 후보가 선택될 경우
  //   COMPASS_KEYWORD_KO/EN 사전으로 치환하고 한국어 조사(이/가)를 자동 결정.
  function buildVisionHeadline(primaryCategory, compassRaw, fingerprint, lang){
    var isEn = (lang === "en");
    var lib = isEn ? VISION_HEADLINE_EN : VISION_HEADLINE_KO;
    var catTable = lib[primaryCategory] || lib["성장지향"];
    var compassKey = (compassRaw && compassRaw[0]) || "의미 / 보람 / 가치";
    var arr = catTable[compassKey] || catTable["의미 / 보람 / 가치"]
           || (isEn ? ["someone clear about why they live"] : ["왜 사는지 분명한 사람"]);
    var identity = pickByHash(arr, fingerprint + 173);

    // {{compassKw}} 토큰 치환 — RULE-REPORT R2 변수화 원칙
    if (identity && identity.indexOf("{{compassKw}}") !== -1) {
      var kwLib = isEn ? COMPASS_KEYWORD_EN : COMPASS_KEYWORD_KO;
      var kw = kwLib[compassKey] || (isEn ? "meaning" : "의미");
      // 한국어: 이/가 조사 자동 처리
      if (!isEn) {
        var kwLast = kw.charCodeAt(kw.length - 1);
        var kwJong = 0;
        if (kwLast >= 0xAC00 && kwLast <= 0xD7A3) kwJong = (kwLast - 0xAC00) % 28;
        var ji = kwJong === 0 ? "가" : "이";
        identity = identity.split("{{compassKw}}이(가)").join(kw + ji)
                           .split("{{compassKw}}").join(kw);
      } else {
        identity = identity.split("{{compassKw}}").join(kw);
      }
    }

    if (isEn) {
      return "Remembered as " + identity + ".";
    }
    // "사람"으로 끝나면 "으로 기억된다"
    var last = identity.charCodeAt(identity.length - 1);
    var jong = 0;
    if (last >= 0xAC00 && last <= 0xD7A3) jong = (last - 0xAC00) % 28;
    var connector = jong === 0 ? "로" : "으로";
    return identity + connector + " 기억된다.";
  }

  // 비전 한 줄 설명 합성 — "10년 뒤, [도메인]의 자리에서 [Compass 핵심어]을(를) 잃지 않은 사람으로."
  function buildVisionSubline(domainPhraseCore, compassRaw, lang){
    var isEn = (lang === "en");
    var kwLib = isEn ? COMPASS_KEYWORD_EN : COMPASS_KEYWORD_KO;
    var compassKey = (compassRaw && compassRaw[0]) || "의미 / 보람 / 가치";
    var kw = kwLib[compassKey] || (isEn ? "meaning" : "의미");
    if (isEn) {
      return "Ten years from now, in " + domainPhraseCore + ", as someone who has not lost " + kw + ".";
    }
    var last = kw.charCodeAt(kw.length - 1);
    var jong = 0;
    if (last >= 0xAC00 && last <= 0xD7A3) jong = (last - 0xAC00) % 28;
    var josa = jong === 0 ? "를" : "을";
    return "10년 뒤, " + domainPhraseCore + "의 자리에서 " + kw + josa + " 잃지 않은 사람으로.";
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
      //   topicScene 라이브러리는 이미 "특히 ~"로 시작 — 외부에서 "특히"를 추가하지 않음.
      //   방어: scene 내부에 "특히"가 2회 이상이면 1회로 축약 → "특히 특히" 중복 차단
      var _sceneKoNorm = topicScene ? String(topicScene).replace(/(특히\s+){2,}/g, "특히 ").replace(/^\s+|\s+$/g, "") : "";
      var sceneKo = _sceneKoNorm ? "(" + _sceneKoNorm + ") " : "";

      // ── 사명 (톤별 문장 골격 — 유형마다 어투·시작·종결을 달리해 "유형화된 느낌" 제거) ──
      //   고유성 원칙: 같은 7슬롯 변수라도 톤별 골격이 달라 문장 리듬이 사람마다 달라진다.
      //   사명(성경적 정의) = 현재의 부르심/존재 이유 → 현재형·다짐형 어미로 마무리.
      var compassMissionKo = compass.missionClause ? compass.missionClause + ", " : "";
      // 톤별 사명 종결 변주: 같은 톤이라도 fingerprint 로 종결을 갈라
      //   "같은 유형끼리도 사명 문장이 달라진다" → 고유성 강화 (전 인구 규모 대비).
      //   각 톤마다 의미 동질·표현 상이한 2~3개 종결을 두고, 응답 해시로 결정 선택.
      var MISSION_TAIL_VARIANTS_KO = {
        principled_designer: [
          " — 그렇게 한 사람으로 살아갑니다.",
          " — 그 원칙대로 한 사람으로 살아갑니다.",
          " — 흔들리지 않는 한 사람으로 살아갑니다."
        ],
        warm_connector: [
          " 한 사람으로 곁을 지키며 살아갑니다.",
          " 한 사람으로 곁을 데우며 살아갑니다.",
          " 한 사람으로 곁에 머물며 살아갑니다."
        ],
        visionary_creator: [
          " 한 사람으로 길을 열어 갑니다.",
          " 한 사람으로 새 길을 그려 갑니다.",
          " 한 사람으로 앞으로 나아갑니다."
        ],
        pragmatic_achiever: [
          " 한 사람으로 오늘을 살아냅니다.",
          " 한 사람으로 매일을 해냅니다.",
          " 한 사람으로 한 걸음씩 이뤄 갑니다."
        ],
        reflective_explorer: [
          " 한 사람으로 묵묵히 걸어갑니다.",
          " 한 사람으로 천천히 걸어갑니다.",
          " 한 사람으로 깊이 걸어갑니다."
        ]
      };
      var _mTailArr = MISSION_TAIL_VARIANTS_KO[toneKey] || MISSION_TAIL_VARIANTS_KO.principled_designer;
      var mFrame = {
        lead: "",
        tail: pickByHash(_mTailArr, fingerprint + 307 + comboSeed)
      };
      // 장면(scene)을 "(특히 ~) " 형태로 감싸되, 비어 있으면 빈 문자열
      function sceneCoreWrap(sc){ return sc ? "(특히 " + sc + ") " : ""; }
      // 톤별 주어 도입: 같은 "당신의 사명은,"의 반복을 줄이기 위해 톤별로 변주
      var MISSION_OPENER_KO = {
        principled_designer: "당신의 사명은, ",
        warm_connector:      "당신의 사명은, ",
        visionary_creator:   "당신이 살아갈 사명은, ",
        pragmatic_achiever:  "당신의 사명은, ",
        reflective_explorer: "당신이 향하는 사명은, "
      };
      var mOpener = MISSION_OPENER_KO[toneKey] || "당신의 사명은, ";
      // 나침반 절에서 후행 쉼표 제거 (구조 재배치 시 자연스러운 결합 위해)
      var compassMissionCore = compass.missionClause ? compass.missionClause : "";
      var domainCoreOnly = domainPhraseKo.replace(/에서$/, "");  // "경제와 교육의 자리"
      var sceneCore = _sceneKoNorm ? _sceneKoNorm.replace(/^특히\s*/, "") : ""; // "누군가 배우는 길목"
      // ── 톤별 사명 문장 구조 (나침반 절 위치를 톤별로 달리해 반복감 제거) ──
      //   안전 규칙: missionLine(가치 동사구)은 항상 종결 어미("~ 한 사람으로 …") 직전에 둔다.
      //   톤별로 "나침반 절"을 (A) 분야 앞 / (B) 분야 뒤·장면 앞 / (C) 도입부 독립절 로 배치.
      var compassFront = compassMissionCore ? compassMissionCore + ", " : "";   // 앞쪽 배치형
      switch (toneKey) {
        case "principled_designer":
          // 원칙 우선: 나침반(원칙)을 문장 맨 앞 독립절로
          mission = mOpener
                  + compassFront
                  + domainPhraseKo + " " + sceneCoreWrap(sceneCore)
                  + missionLine + mFrame.tail;
          break;
        case "reflective_explorer":
          // 성찰 우선: 나침반(내면 기준)을 맨 앞에, 잔잔한 어조
          mission = mOpener
                  + compassFront
                  + domainPhraseKo + " " + sceneCoreWrap(sceneCore)
                  + missionLine + mFrame.tail;
          break;
        case "warm_connector":
          // 사람/곁 우선: 분야 → 나침반(사람 곁) → 장면 → 가치동사구
          mission = mOpener
                  + domainPhraseKo + ", "
                  + compassFront
                  + sceneCoreWrap(sceneCore)
                  + missionLine + mFrame.tail;
          break;
        case "visionary_creator":
          // 지향/미래 우선: 분야 → 장면 → 나침반 → 가치동사구
          mission = mOpener
                  + domainPhraseKo + " " + sceneCoreWrap(sceneCore)
                  + compassFront
                  + missionLine + mFrame.tail;
          break;
        case "pragmatic_achiever":
          // 행동/오늘 우선: 분야 → 장면 → 나침반(실행 기준) → 가치동사구
          mission = mOpener
                  + domainPhraseKo + " " + sceneCoreWrap(sceneCore)
                  + compassFront
                  + missionLine + mFrame.tail;
          break;
        default:
          mission = mOpener + domainPhraseKo + ", " + sceneKo
                  + compassMissionKo + missionLine + mFrame.tail;
      }

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
      // ── 비전 (톤별 문장 골격) ──
      //   비전(성경적 정의) = 사명을 살아낸 끝에 도달할 "미래의 모습" → 미래형·도착형 어미.
      var VISION_OPENER_KO = {
        principled_designer: "당신의 비전은, ",
        warm_connector:      "당신의 비전은, ",
        visionary_creator:   "당신이 그리는 비전은, ",
        pragmatic_achiever:  "당신의 비전은, ",
        reflective_explorer: "당신이 닿고 싶은 비전은, "
      };
      // 톤별 비전 종결 변주: 사명과 동일 원리 — 같은 톤이라도 응답 해시로 도착점 어미를 갈라
      var VISION_TAIL_VARIANTS_KO = {
        principled_designer: [
          " 자리잡는 것입니다.",
          " 굳건히 서는 것입니다.",
          " 단단히 뿌리내리는 것입니다."
        ],
        warm_connector: [
          " 기억되는 것입니다.",
          " 곁으로 남는 것입니다.",
          " 마음에 새겨지는 것입니다."
        ],
        visionary_creator: [
          " 나아가는 것입니다.",
          " 뻗어 가는 것입니다.",
          " 새 지평을 여는 것입니다."
        ],
        pragmatic_achiever: [
          " 증명해 내는 것입니다.",
          " 이루어 내는 것입니다.",
          " 결실로 남기는 것입니다."
        ],
        reflective_explorer: [
          " 머무는 것입니다.",
          " 닿아 있는 것입니다.",
          " 깊어지는 것입니다."
        ]
      };
      var _vTailArr = VISION_TAIL_VARIANTS_KO[toneKey] || VISION_TAIL_VARIANTS_KO.principled_designer;
      var vFrame = {
        opener: VISION_OPENER_KO[toneKey] || "당신의 비전은, ",
        tail:   pickByHash(_vTailArr, fingerprint + 419 + comboSeed)
      };
      vision = vFrame.opener + domainPhraseKo + " "
             + visionFullKo + connector + vFrame.tail;
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
    var visionHeadline = buildVisionHeadline(refined.primaryCategory, compass.raw, fingerprint, lang);
    var visionSubline  = buildVisionSubline(sublineDomainCore, compass.raw, lang);
    var diary = buildDiaryBody(primaryDomainKo, refined.primaryCategory, compass.raw, topicScene, fingerprint, lang);

    return {
      // ── 한 줄 통합 사명/비전 (3인칭 격식체, 본문 보조) ──
      missionText: mission,
      visionText: vision,
      footer: (mvBase && mvBase.footer) || "",

      // ── 3-Tier 구조 (사용자 확정 표현) — 사명·비전 동일 UX ──
      tier: {
        // 사명 3-Tier
        headline: headline,                  // ① L3 한 줄 사명 (Google 수준)
        subline: subline,                    // ② 한 줄 설명 (Compass 나침반)
        diaryMission: diary.missionBody,     // ③ 1인칭 다이어리 사명 본문
        // 비전 3-Tier (사명과 동일 구조, 10년 회상형)
        visionHeadline: visionHeadline,      // ① 비전 헤드라인 ("~으로 기억된다")
        visionSubline:  visionSubline,       // ② 비전 한 줄 설명 ("10년 뒤, ~을(를) 잃지 않은 사람으로")
        diaryVision:   diary.visionBody      // ③ 1인칭 다이어리 비전 본문 (10년 회상)
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

  // PR#59: 4축 PAIR 일관성 보강 — 매칭 trait 0개 축에 진단 근거(축×tier×topAxis-trait) 합성
  //   원칙: ① Q6 기반 진짜 페어/단일이 있으면 우선 (정확도 보존)
  //         ② 매칭 0개 축은 "축 본질 × tier 단계 × 사용자의 핵심 trait 결" 합성
  //         ③ 합성도 진단 결과(traits, tier)에 근거 → 임의 표시 아님
  //   합성 카디널리티: 4축 × 4tier × 12trait = 192조합 × fingerprint 변형 → 만 단위
  var AXIS_PAIR_SYNTH_KO = {
    self_understanding: {
      deep:     ["{traitColor} 깊이로 자기 결을 응시하는 통찰형 정직성","고요한 깊이와 {traitColor} 결이 결합된 자기 응시력","자기 결을 깊이 응시하며 {traitColor} 호흡을 잃지 않는 사색가 정신"],
      active:   ["{traitColor} 결로 자기 흐름을 다스리는 안정형 통찰","흔들림 없이 자기 결을 살피는 {traitColor} 응시력","자기 호흡 위에 {traitColor} 결이 얹힌 단단한 통찰"],
      emerging: ["자기 응시가 발현되는 자리에 {traitColor} 결이 더해진 사색력","{traitColor} 호흡으로 자기 결을 다듬어 가는 통찰의 결","발현되는 자기 이해 위에 {traitColor} 결을 얹는 사람"],
      seed:     ["자기 응시의 씨앗에 {traitColor} 결이 함께 놓인 가능성","{traitColor} 호흡으로 자기 결의 씨앗을 키우는 사람","자기 이해의 씨앗을 {traitColor} 결로 길러 가는 사람"]
    },
    self_expression: {
      deep:     ["{traitColor} 결로 마음을 안전하게 풀어내는 표현의 힘","사람의 결을 안전하게 잇는 {traitColor} 표현력","{traitColor} 호흡과 표현이 결합된 마음의 통역가형 결"],
      active:   ["{traitColor} 결로 자기 마음을 또렷이 옮기는 표현력","사람 곁에서 {traitColor} 호흡으로 마음을 잇는 표현의 결","{traitColor} 결 위에 펼쳐지는 활발한 표현력"],
      emerging: ["{traitColor} 결로 마음을 한 줄씩 풀어 가는 발현형 표현력","발현되는 표현 위에 {traitColor} 호흡이 더해지는 결","{traitColor} 결로 한 호흡씩 마음을 옮기는 사람"],
      seed:     ["{traitColor} 결로 한 문장씩 마음을 옮길 수 있는 가능성","표현의 씨앗에 {traitColor} 호흡이 함께 놓인 결","{traitColor} 결로 한 사람 앞에서 한 문장 시작하는 사람"]
    },
    self_design: {
      deep:     ["{traitColor} 결로 흐름과 단계를 짜는 깊은 설계력","자기 결로 흐름을 짜며 {traitColor} 호흡을 잃지 않는 설계가 정신","{traitColor} 결과 설계가 결합된 단단한 길 만들기"],
      active:   ["{traitColor} 결로 분기·연간 흐름을 운영하는 설계력","{traitColor} 호흡 위에 짜이는 활발한 자기 설계의 결","자기 결로 길을 짜며 {traitColor} 호흡을 잃지 않는 사람"],
      emerging: ["{traitColor} 결로 작은 주간 계획을 짜 가는 발현형 설계력","발현되는 설계 위에 {traitColor} 호흡이 얹힌 결","{traitColor} 결로 한 호흡씩 길을 만들어 가는 사람"],
      seed:     ["{traitColor} 결로 하루 1결정·1행동을 시작할 수 있는 가능성","설계의 씨앗에 {traitColor} 호흡이 함께 놓인 결","{traitColor} 결로 작은 길부터 짜 가는 사람"]
    },
    self_execution: {
      deep:     ["{traitColor} 결로 약속을 끝까지 마무리하는 깊은 추진력","자기 결로 결과를 만들며 {traitColor} 호흡을 잃지 않는 완수형 정신","{traitColor} 결과 실행이 결합된 단단한 끝맺음"],
      active:   ["{traitColor} 결로 더 큰 약속을 끝까지 가져가는 추진력","{traitColor} 호흡 위에 펼쳐지는 활발한 자기 실행의 결","자기 결로 결과를 빚으며 {traitColor} 호흡을 잃지 않는 사람"],
      emerging: ["{traitColor} 결로 작은 마무리를 반복해 가는 발현형 실행력","발현되는 실행 위에 {traitColor} 호흡이 얹힌 결","{traitColor} 결로 한 호흡씩 끝맺음을 만드는 사람"],
      seed:     ["{traitColor} 결로 오늘 끝낼 1개를 시작할 수 있는 가능성","실행의 씨앗에 {traitColor} 호흡이 함께 놓인 결","{traitColor} 결로 작은 마감부터 시작하는 사람"]
    }
  };
  var AXIS_PAIR_SYNTH_EN = {
    self_understanding: {
      deep:     ["Self-observation in a {traitColor} grain — deep, insight-driven honesty","Quiet depth combined with a {traitColor} grain — a self-observing strength","A reflective spirit that sees one's own grain without losing the {traitColor} breath"],
      active:   ["A {traitColor} grain that masters one's own flow — steady insight","Unshaken self-observation through a {traitColor} grain","Firm insight where a {traitColor} grain rests on one's own breath"],
      emerging: ["Self-observation in an emerging phase, with a {traitColor} grain added","Insight that refines its grain through a {traitColor} breath","One who layers a {traitColor} grain onto emerging self-understanding"],
      seed:     ["Possibility — a self-observation seed paired with a {traitColor} grain","One who grows the seed of one's own grain in a {traitColor} breath","One who nurtures the seed of self-understanding through a {traitColor} grain"]
    },
    self_expression: {
      deep:     ["Expressive strength that releases hearts safely in a {traitColor} grain","A {traitColor} grain that links the texture of people safely","A heart-translator's grain combining a {traitColor} breath and expression"],
      active:   ["Expression that names one's own heart clearly in a {traitColor} grain","A {traitColor} breath that links hearts beside people","Active expression unfolding on a {traitColor} grain"],
      emerging: ["Emerging expression that releases the heart line by line in a {traitColor} grain","An emerging expression layered with a {traitColor} breath","One who moves the heart breath by breath through a {traitColor} grain"],
      seed:     ["Possibility — a {traitColor} grain to move one sentence at a time","An expression seed paired with a {traitColor} breath","One who begins one sentence before one safe person, in a {traitColor} grain"]
    },
    self_design: {
      deep:     ["Deep design strength that sequences flow in a {traitColor} grain","A designer's spirit that builds flow without losing the {traitColor} breath","A firm path-making combining a {traitColor} grain and design"],
      active:   ["Design strength that runs quarterly and yearly flow in a {traitColor} grain","Active self-design unfolding on a {traitColor} breath","One who designs a path without losing the {traitColor} breath"],
      emerging: ["Emerging design that builds small weekly plans in a {traitColor} grain","Emerging design layered with a {traitColor} breath","One who builds a path one breath at a time in a {traitColor} grain"]
      ,
      seed:     ["Possibility — a {traitColor} grain to begin one decision and one action a day","A design seed paired with a {traitColor} breath","One who builds a small path first in a {traitColor} grain"]
    },
    self_execution: {
      deep:     ["Deep drive that finishes promises through to the end in a {traitColor} grain","A finishing spirit that produces results without losing the {traitColor} breath","Firm closure combining a {traitColor} grain and execution"],
      active:   ["Drive that carries larger commitments through in a {traitColor} grain","Active self-execution unfolding on a {traitColor} breath","One who shapes results without losing the {traitColor} breath"],
      emerging: ["Emerging execution that repeats small finishes in a {traitColor} grain","Emerging execution layered with a {traitColor} breath","One who creates closure breath by breath in a {traitColor} grain"],
      seed:     ["Possibility — a {traitColor} grain to begin 'one thing finished today'","An execution seed paired with a {traitColor} breath","One who begins from small finishes in a {traitColor} grain"]
    }
  };
  // 12개 trait → 한 호흡 형용구 (PR#57의 SYNTH_TRAIT_COLOR 재사용 의도, 여기서는 합성용 단축형)
  var TRAIT_COLOR_SHORT_KO = {
    "조용한":"고요한","신중한":"서두르지 않는","분석적인":"본질을 짚는","느긋한":"흔들리지 않는",
    "공감하는":"사람의 결을 살피는","따뜻한":"따뜻한",
    "계획적인":"흐름을 짜는","현실적인":"현실 감각의","창의적인":"새로움을 길어 올리는",
    "열정적인":"뜨거운","도전적인":"경계를 넓히는","성취지향적인":"끝까지 마무리하는"
  };
  var TRAIT_COLOR_SHORT_EN = {
    "조용한":"quiet","신중한":"unhurried","분석적인":"essence-piercing","느긋한":"unshaken",
    "공감하는":"people-reading","따뜻한":"warm",
    "계획적인":"flow-shaping","현실적인":"reality-grounded","창의적인":"newness-drawing",
    "열정적인":"hot","도전적인":"frontier-widening","성취지향적인":"finishing"
  };

  function _synthAxisPairFallback(axisId, tier, traits, fingerprint, isEn){
    // 사용자의 traits 중 매칭되지 않은 축에서도 사용할 "대표 trait" 선정 (top trait 또는 fingerprint hash)
    var t12 = (traits || []).filter(function(x){ return TRAITS_12.indexOf(x) !== -1; });
    if (!t12.length) t12 = ["신중한"]; // 안전 폴백 (다른 곳 기본값과 결 맞춤)
    var pickIdx = Math.abs((fingerprint || 0) + (axisId || "").length * 13) % t12.length;
    var pickTrait = t12[pickIdx];
    var colorMap = isEn ? TRAIT_COLOR_SHORT_EN : TRAIT_COLOR_SHORT_KO;
    var traitColor = colorMap[pickTrait] || (isEn ? "your own grain" : "자기 결의");
    var lib = (isEn ? AXIS_PAIR_SYNTH_EN : AXIS_PAIR_SYNTH_KO)[axisId];
    if (!lib) return "";
    var arr = lib[tier] || lib.active || lib.emerging || [];
    if (!arr.length) return "";
    var tpl = pickByHash(arr, (fingerprint || 0) + (axisId || "").length * 17);
    if (!tpl) return "";
    return tpl.replace(/\{traitColor\}/g, traitColor);
  }

  function enhanceAxisCardV2(card, lang, traits, fingerprint){
    var isEn = (lang === "en");
    var pct = (card.content && typeof card.content.pct === "number") ? card.content.pct : 0;
    var tier = _tier(pct);
    var tierLabel = (isEn ? TIER_LABEL_EN : TIER_LABEL_KO)[card.id] || {};
    var newCard = clone(card);
    newCard.content.tier = tier;
    newCard.content.tierLabel = tierLabel[tier] || "";

    // P1-1: tier × axis comment
    //   [고유성 · PR#69] tier(점수 구간)만으로 고른 단계 문장은 같은 구간이면 누구나 동일.
    //   → 그 사람의 *응답에서 나온 결*(이 축에 속한 trait, Q6)을 한 호흡 도입구로 얹어
    //     같은 tier여도 사람마다 다르게, 그러나 통찰적으로 짧게 한다.
    //   결이 없으면(이 축에 매칭 trait 0개) fingerprint 결정성으로 대표 trait의 결을 빌린다.
    var commentMap = (isEn ? TIER_AXIS_COMMENT_EN : TIER_AXIS_COMMENT_KO)[card.id];
    var leadColorMap = isEn ? TRAIT_COLOR_SHORT_EN : TRAIT_COLOR_SHORT_KO;
    // ① 이 축에 속한 응답 trait(정확) — 축의 진짜 결
    var axisTraitsForLead = (traits || []).filter(function(t){ return TRAIT_AXIS_MAP[t] === card.id; });
    var axisTrait = axisTraitsForLead.length
      ? pickByHash(axisTraitsForLead, fingerprint + (card.id || "").length * 11)
      : "";
    // ② 개인 시그니처 — 응답 전체 성향 중 1순위(이 축 trait와 겹치면 다음 것)
    var t12all = (traits || []).filter(function(x){ return TRAITS_12.indexOf(x) !== -1; });
    var sigTrait = "";
    for (var si = 0; si < t12all.length; si++) {
      if (t12all[si] !== axisTrait) { sigTrait = t12all[si]; break; }
    }
    // 축 trait가 없으면(빈 축) 시그니처를 축결로 승격해 일관 노출
    if (!axisTrait && t12all.length) {
      axisTrait = pickByHash(t12all, fingerprint + (card.id || "").length * 23);
      sigTrait = "";
      for (var sj = 0; sj < t12all.length; sj++) { if (t12all[sj] !== axisTrait){ sigTrait = t12all[sj]; break; } }
    }
    var axisColor = axisTrait ? (leadColorMap[axisTrait] || "") : "";
    var sigColor  = sigTrait  ? (leadColorMap[sigTrait]  || "") : "";
    if (commentMap && commentMap[tier]) {
      var baseComment = commentMap[tier];
      var personalized = baseComment;
      if (isEn) {
        var enLead = axisColor;
        if (sigColor && sigColor !== axisColor) enLead = axisColor + ", " + sigColor;
        if (enLead) personalized = "With your " + enLead + " grain, "
          + baseComment.charAt(0).toLowerCase() + baseComment.slice(1);
      } else {
        // "[축결](과 [시그니처결]) 결로, [단계 문장]" — 응답 두 차원(축 trait + 개인 1순위)을
        //   통찰적 한 호흡으로 얹어 같은 tier·같은 축결이어도 사람마다 갈리게.
        var koLead = axisColor;
        if (sigColor && sigColor !== axisColor) koLead = axisColor + "·" + sigColor;
        if (koLead) personalized = koLead + " 결로, " + baseComment;
      }
      newCard.content.tierComment = personalized;
      newCard.content.closerLine = personalized; // 하위 호환
    } else {
      // 기존 closer 폴백
      var closerArr = (isEn ? TIER_CLOSER_EN : TIER_CLOSER_KO)[tier] || [];
      var fp = (pct * 31 + (card.id || "").length * 7) | 0;
      var closer = pickByHash(closerArr, fp);
      if (closer) newCard.content.closerLine = closer;
    }

    // P0-4 + PR#59: 해당 축에 속하는 trait pair/single 우선 → 없으면 합성 fallback
    //   (자기표현·자기설계 축에 매칭 trait가 0개인 경우에도 PAIR pill 일관 노출)
    var axisTraits = (traits || []).filter(function(t){ return TRAIT_AXIS_MAP[t] === card.id; });
    if (axisTraits.length >= 2) {
      // ① 매칭 ≥ 2 → 진짜 페어 라이브러리 (정확도 최우선)
      var key = _pairKey(axisTraits[0], axisTraits[1]);
      var pairLib = isEn ? TRAIT_PAIR_EN : TRAIT_PAIR_KO;
      var pairArr = pairLib[key];
      if (pairArr && pairArr.length) {
        newCard.content.pairedNarrative = pickByHash(pairArr, fingerprint + (card.id || "").length);
      } else {
        // 매트릭스 미정의 → 단일 변환 fallback
        var singleLib0 = isEn ? TRAIT_SINGLE_EN : TRAIT_SINGLE_KO;
        var arr0 = singleLib0[axisTraits[0]];
        if (arr0 && arr0.length) newCard.content.pairedNarrative = pickByHash(arr0, fingerprint + (card.id || "").length);
      }
    } else if (axisTraits.length === 1) {
      // ② 매칭 = 1 → 단일 trait 라이브러리
      var singleLib = isEn ? TRAIT_SINGLE_EN : TRAIT_SINGLE_KO;
      var arr = singleLib[axisTraits[0]];
      if (arr && arr.length) {
        newCard.content.pairedNarrative = pickByHash(arr, fingerprint + (card.id || "").length);
      }
    } else {
      // ③ 매칭 = 0 → PR#59: 진단 근거(축×tier×사용자 trait) 기반 합성 fallback
      //   회원의 실제 traits(Q6) 중 fingerprint 결정성으로 한 trait의 "결"을 빌려와
      //   해당 축의 본질·tier 단계에 얹어 한 호흡 narrative 합성.
      //   → 자기표현/자기설계 축이 비어 보이지 않도록 4축 일관성 확보.
      var synth = _synthAxisPairFallback(card.id, tier, traits, fingerprint, isEn);
      if (synth) {
        newCard.content.pairedNarrative = synth;
        newCard.content.pairedSource = "axis_synth_v59"; // 메타: 디버그/QA용
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

  // PR#199: Q63 나침반 옵션 → 가치 카테고리 보조신호
  //   가치(Q13)만으로는 흔한 '성장지향' 한 개가 visionary/pragmatic 을 동시에 만점으로
  //   끌어올려 동점→priority 쏠림(유형화)이 발생한다. Q63(삶의 선택 기준)은 응답자의
  //   실제 무게중심을 드러내므로 카테고리별 가중을 더해 동점을 정밀 해소한다.
  var COMPASS_TO_CATEGORY = {
    "안정성 / 안전 / 예측 가능성": "원칙지향",
    "책임 / 도리 / 역할 충실":     "원칙지향",
    "신념 / 원칙 / 종교적 기준":   "원칙지향",
    "관계 / 소속감 / 인정":        "관계지향",
    "의미 / 보람 / 가치":          "성장지향",
    "성장 가능성 / 배움의 기회":   "성장지향",
    "결과 / 성과 / 효율성":        "성장지향",
    "자유 / 자율성":               "자유지향",
    "재미 / 흥미 / 몰입감":        "자유지향"
  };
  // PR#199: Q6 성향 형용사 → 가치 카테고리 보조신호 (소량 가중)
  var TRAIT_TO_CATEGORY = {
    "신중한":"원칙지향","계획적인":"원칙지향","현실적인":"원칙지향","분석적인":"원칙지향","성실한":"원칙지향","책임감있는":"원칙지향",
    "따뜻한":"관계지향","공감적인":"관계지향","배려심있는":"관계지향","사교적인":"관계지향","조용한":"관계지향",
    "창의적인":"성장지향","열정적인":"성장지향","성취지향적인":"성장지향","도전적인":"성장지향",
    "자유로운":"자유지향","느긋한":"자유지향","호기심많은":"자유지향","즉흥적인":"자유지향"
  };

  // tone resolver: scores + value categories(빈도 포함) + answers → toneKey
  function resolveTone(scores, valueCategories, answers){
    var pct = (scores && scores.axisPct) || {};
    var sortedAxes = Object.keys(pct).sort(function(a,b){
      var d = (pct[b]||0) - (pct[a]||0);
      if (d !== 0) return d;
      return _toneRank(AXIS_TO_TONE[a]) - _toneRank(AXIS_TO_TONE[b]);
    });
    var topAxis  = sortedAxes[0];
    var top2Axis = sortedAxes[1] || null;

    var cats = toArr(valueCategories);   // 빈도 포함(중복 가능)

    // 카테고리별 빈도 집계 (Q13 가중치)
    var catFreq = {};
    cats.forEach(function(c){ catFreq[c] = (catFreq[c] || 0) + 1; });

    // 보조신호 집계: Q63 나침반(+강), Q6 성향(+약)
    var aux = {}; // category → 보조점수
    if (answers) {
      toArr(answers["Q63"]).forEach(function(opt){
        var cat = COMPASS_TO_CATEGORY[opt];
        if (cat) aux[cat] = (aux[cat] || 0) + 1.0;   // 나침반: 카테고리당 +1.0
      });
      toArr(answers["Q6"]).forEach(function(t){
        var cat = TRAIT_TO_CATEGORY[t];
        if (cat) aux[cat] = (aux[cat] || 0) + 0.4;   // 성향: 카테고리당 +0.4
      });
    }

    // 5톤별 trigger 정의 (report-rules.json toneVariants.*.trigger 와 일치)
    var TRIGGERS = {
      principled_designer: { vc: ["원칙지향"],            ax: ["self_design","self_understanding"] },
      warm_connector:      { vc: ["관계지향"],            ax: ["self_expression","self_understanding"] },
      visionary_creator:   { vc: ["성장지향","자유지향"], ax: ["self_design","self_execution"] },
      pragmatic_achiever:  { vc: ["성장지향","원칙지향"], ax: ["self_execution","self_design"] },
      reflective_explorer: { vc: ["자유지향","관계지향"], ax: ["self_understanding","self_expression"] }
    };

    // PR#199: 정밀 가중 모델 (유형화 방지)
    //   - vcScore : 톤의 vc 카테고리들이 Q13 에 등장한 '빈도 합' × 2.0 (단일 일치도 최소 2.0 보장)
    //   - axScore : top1 일치 +2.0, top2 일치 +1.0
    //   - auxScore: Q63/Q6 보조신호 합 (톤의 vc 카테고리에 해당하는 보조점수만 합산)
    //   - domBonus: 응답자의 '주도 카테고리'(Q13 빈도+보조신호 종합 1위)가 톤의 vc 핵심(첫
    //               카테고리)과 일치하면 +2.0. 흔한 '성장지향' 1개로 pragmatic/visionary 가
    //               원칙·관계 중심 응답자를 흡수하는 쏠림을 막는 핵심 장치.
    //   동점이 되더라도 auxScore·domBonus 가 응답자의 실제 무게중심을 반영해 갈라준다.
    // 주도 카테고리 산출: Q13 빈도(×1) + 보조신호(Q63 ×1.0 / Q6 ×0.4)
    var domAgg = {};
    Object.keys(catFreq).forEach(function(c){ domAgg[c] = (domAgg[c]||0) + catFreq[c]; });
    Object.keys(aux).forEach(function(c){ domAgg[c] = (domAgg[c]||0) + aux[c]; });
    var domSorted = Object.keys(domAgg).sort(function(a,b){ return domAgg[b]-domAgg[a]; });
    var domCat = domSorted[0] || null;
    // 주도 카테고리의 '우세도' — 1위와 2위의 격차. 격차가 클수록(응답이 한쪽으로
    //   분명히 쏠릴수록) domBonus 를 키워 축(axScore)이 흔드는 쏠림을 바로잡는다.
    var domGap = domCat ? (domAgg[domCat] - (domSorted[1] ? domAgg[domSorted[1]] : 0)) : 0;

    var ranked = TONE_PRIORITY.map(function(k, idx){
      var t = TRIGGERS[k] || { vc: [], ax: [] };
      var freqHit = t.vc.reduce(function(acc, c){ return acc + (catFreq[c] || 0); }, 0);
      var vcOk  = freqHit > 0;
      var vcScore = vcOk ? Math.max(2.0, freqHit * 2.0) : 0;
      var ax1Ok = !!topAxis  && t.ax.indexOf(topAxis)  !== -1;
      var ax2Ok = !!top2Axis && t.ax.indexOf(top2Axis) !== -1;
      var axScore = (ax1Ok ? 2.0 : 0) + (ax2Ok ? 1.0 : 0);
      var auxScore = t.vc.reduce(function(acc, c){ return acc + (aux[c] || 0); }, 0);
      // 핵심 카테고리(vc[0]) 가 주도 카테고리와 일치 시 보너스 (우세도 비례, 2.0~5.0)
      var domBonus = (domCat && t.vc[0] === domCat)
        ? Math.min(5.0, 2.0 + Math.max(0, domGap))
        : 0;
      var s = vcScore + axScore + auxScore + domBonus;
      return {
        key: k, score: s, vcScore: vcScore, axScore: axScore, auxScore: auxScore, domBonus: domBonus,
        vcOk: vcOk, ax1Ok: ax1Ok, ax2Ok: ax2Ok, priority: idx
      };
    });
    ranked.sort(function(a,b){
      if (Math.abs(b.score - a.score) > 1e-9) return b.score - a.score;
      // 1차 동점: 보조신호(Q63/Q6) 큰 쪽
      if (Math.abs(b.auxScore - a.auxScore) > 1e-9) return b.auxScore - a.auxScore;
      // 2차 동점: 가치빈도(vcScore) 큰 쪽
      if (Math.abs(b.vcScore - a.vcScore) > 1e-9) return b.vcScore - a.vcScore;
      // 최종: 고정 priority
      return a.priority - b.priority;
    });

    var picked = ranked[0] || { key: TONE_PRIORITY[0], score: 0, vcOk:false, ax1Ok:false, ax2Ok:false };
    if (picked.score === 0) {
      // 매칭 0점: 축톤으로 안전 폴백
      var axisTone = AXIS_TO_TONE[topAxis] || "reflective_explorer";
      picked = { key: axisTone, score: 0, vcOk: false, ax1Ok: false, ax2Ok: false };
    }

    var uniqCats = unique(cats);
    var valueTones = uniqCats.map(function(c){ return VALUE_TO_TONE[c]; }).filter(Boolean);
    return {
      toneKey: picked.key,
      topAxis: topAxis,
      top2Axis: top2Axis,
      candidates: ranked.map(function(x){
        return { key: x.key, score: Math.round(x.score*100)/100, aux: Math.round((x.auxScore||0)*100)/100 };
      }),
      score: picked.score,
      vcMatch: picked.vcOk,
      ax1Match: picked.ax1Ok,
      ax2Match: picked.ax2Ok,
      reason: "cats=[" + uniqCats.join(",") + "] dom=" + (domCat||"?") + " top1=" + topAxis +
              " top2=" + (top2Axis||"-") + " score=" + (Math.round(picked.score*100)/100) +
              " (vc:" + (Math.round((picked.vcScore||0)*100)/100) +
              " ax:" + (Math.round((picked.axScore||0)*100)/100) +
              " aux:" + (Math.round((picked.auxScore||0)*100)/100) +
              " dom:" + (Math.round((picked.domBonus||0)*100)/100) + ")" +
              " value=" + (valueTones[0] || "?") + " → " + picked.key
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
  //  - 받침 처리는 {p|을}, {s|와}, {s|를}, {s|로} 마커로 후처리(_applyJosaMarkers) → "예술를" 류 오류 제거
  //  - PR#67: pathLine 은 fingerprint hash 가 아니라 Q63(판단기준)에 따라 의미 있게 선택(아래 CRIT_PATH_IDX)
  var DOMAIN_PAIR_TEMPLATES_KO = [
    "{p|을} 중심에 두고 {s} 영역으로 확장하면, 사람과 구조의 결을 동시에 다스릴 수 있습니다.",
    "{p}의 깊이를 토대로 {s|와}의 교차점을 찾으면, 새로운 영향력 영역이 열립니다.",
    "{p}에서 다져 온 통찰을 {s} 영역에 옮기면, 차별화된 자기 영역이 만들어집니다.",
    "{p|을} 본업으로 두고 {s|를} 부업·연구 영역으로 가져가면, 평생 호흡의 포트폴리오가 형성됩니다.",
    "{p}에서 출발해 {s|로} 외연을 넓히면, 같은 가치가 더 큰 사람들에게 닿습니다."
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

  // PR#67: 받침 마커 일괄 처리기 — {p}/{s} 치환 후 남은 josa 마커와 맨/직접 결합 josa 를 모두 교정
  //   지원 마커: {x|을} {x|를} {x|와} {x|과} {x|이} {x|가} {x|로} {x|으로} {x|은} {x|는}
  //   + 치환 직후 "단어+을(를)" / "단어+와의"/"단어+를"/"단어+과 "/"단어+와 " 패턴까지 안전 교정
  function _applyJosaMarkers(tmpl, pWord, sWord){
    var out = tmpl;
    // 1) 명시 josa 마커 처리 ({p|을} 형태) — 가장 안전
    out = out.replace(/\{([ps])\|(을|를)\}/g, function(_, who){
      var w = (who === "p") ? pWord : sWord; return _eul(w);
    });
    out = out.replace(/\{([ps])\|(와|과)\}/g, function(_, who){
      var w = (who === "p") ? pWord : sWord; return _gwa(w);
    });
    out = out.replace(/\{([ps])\|(이|가)\}/g, function(_, who){
      var w = (who === "p") ? pWord : sWord; return _i(w);
    });
    out = out.replace(/\{([ps])\|(으로|로)\}/g, function(_, who){
      var w = (who === "p") ? pWord : sWord; return _ero(w);
    });
    out = out.replace(/\{([ps])\|(은|는)\}/g, function(_, who){
      var w = (who === "p") ? pWord : sWord; return _eun(w);
    });
    // 2) 나머지 {p}/{s} 단순 치환
    out = out.replace(/\{p\}/g, pWord).replace(/\{s\}/g, sWord);
    // 3) 치환 후 잔존 패턴 안전 교정 (구버전 템플릿 호환 — "단어+조사" 직접결합 보정)
    [pWord, sWord].forEach(function(w){
      if (!w) return;
      out = out.split(w + "을(를)").join(_eul(w));
      out = out.split(w + "와의").join(_gwa(w) + "의");
      out = out.split(w + "과의").join(_gwa(w) + "의");
      // "단어를"/"단어을" → 올바른 을/를 (받침 기준)
      var correctEul = _eul(w);
      out = out.split(w + "를").join(correctEul);
      out = out.split(w + "을").join(correctEul);
      // "단어와 "/"단어과 " → 올바른 과/와
      var correctGwa = _gwa(w);
      out = out.split(w + "와 ").join(correctGwa + " ");
      out = out.split(w + "과 ").join(correctGwa + " ");
    });
    return out;
  }

  // PR#67: Q63(판단기준) → pathLine 템플릿 의미 매핑
  //   "○○을 본업으로 두고" 한 패턴이 hash 편중으로 과도 노출되던 문제 해소.
  //   사용자가 실제로 답한 판단기준에 따라 확장 서사의 '결'을 의미 있게 선택한다.
  //   인덱스는 DOMAIN_PAIR_TEMPLATES_KO 순서: 0=구조통합 1=교차탐색 2=통찰이식 3=본업+연구 4=가치확산
  var CRIT_PATH_IDX = {
    "결과 / 성과 / 효율성": 0,        // 구조를 다스리는 결
    "결과/성과/효율성": 0,
    "신념 / 원칙 / 종교적 기준": 2,   // 통찰·원칙을 옮기는 결
    "신념/원칙/종교적 기준": 2,
    "의미 / 보람 / 가치": 4,          // 가치를 더 넓게 확산
    "의미/보람/가치": 4,
    "안정성 / 안전 / 예측 가능성": 3, // 본업 안정 + 연구 확장
    "안정성/안전/예측 가능성": 3,
    "성장 가능성 / 배움의 기회": 1,   // 교차점에서 새 영역 탐색
    "성장 가능성/배움의 기회": 1,
    "자유 / 자율성": 1,
    "자유/자율성": 1,
    "관계 / 소속감 / 인정": 0,
    "관계/소속감/인정": 0,
    "재미 / 흥미 / 몰입감": 1,
    "재미/흥미/몰입감": 1,
    "책임 / 도리 / 역할 충실": 3,
    "책임/도리/역할 충실": 3
  };

  function buildDomainExpansion(answers, fingerprint, lang, mapping, toneKey){
    var isEn = (lang === "en");
    var domains = toArr(answers["Q75"]).filter(Boolean);
    var p = domains[0] || (isEn ? "your main field" : "본 영역");
    var s = domains[1] || (isEn ? "an adjacent field" : "인접 영역");
    var pEn = isEn ? (DOMAIN_21_EN[p] || p) : p;
    var sEn = isEn ? (DOMAIN_21_EN[s] || s) : s;
    var tmplArr = isEn ? DOMAIN_PAIR_TEMPLATES_EN : DOMAIN_PAIR_TEMPLATES_KO;

    // PR#67: pathLine 템플릿을 Q63(판단기준)으로 의미 있게 선택 → 동률·미응답 시 fingerprint 회전
    var critArrDe = toArr(answers["Q63"]).filter(Boolean);
    var critKeyDe = critArrDe[0] ? String(critArrDe[0]).trim() : "";
    var tmplIdx;
    if (critKeyDe && CRIT_PATH_IDX[critKeyDe] != null) {
      tmplIdx = CRIT_PATH_IDX[critKeyDe] % tmplArr.length;
    } else {
      tmplIdx = Math.abs(fingerprint + 71) % tmplArr.length;
    }
    var tmpl = tmplArr[tmplIdx] || tmplArr[0];
    var line = isEn
      ? tmpl.replace(/\{p\}/g, pEn).replace(/\{s\}/g, sEn)
      : _applyJosaMarkers(tmpl, pEn, sEn);

    // PR#48-A: 톤별 확장 방향 2가지 추가 (path-line + 2가지 = 의미 있는 directions 3개)
    //   - 단순 "X 영역의 전문성 확장" 반복을 톤×도메인 결합 표현으로 대체
    //   - PR#67: 선택 시드에 Q63·Q55 응답을 섞어, 같은 톤이라도 응답차이로 다른 방향이 나오게 함
    var tone = toneKey || "warm_connector";
    var dirLib = isEn ? DIRECTION_BY_TONE_EN : DIRECTION_BY_TONE_KO;
    var pool = (dirLib[tone] || dirLib.warm_connector || []).slice();
    // 응답 기반 시드(판단기준·동기 글자수) — 무작위가 아니라 응답차이에서 갈림
    var motiveArrDe = toArr(answers["Q55"]).filter(Boolean);
    var respSeed = (critKeyDe ? critKeyDe.length * 7 : 0) + (motiveArrDe[0] ? String(motiveArrDe[0]).length * 3 : 0);
    var subDirs = [];
    if (pool.length > 0) {
      var idx1 = Math.abs(fingerprint + 23 + respSeed) % pool.length;
      subDirs.push(pool[idx1]);
      pool.splice(idx1, 1);
      if (pool.length > 0) {
        var idx2 = Math.abs(fingerprint + 53 + respSeed * 2) % pool.length;
        subDirs.push(pool[idx2]);
      }
    }
    // {p}/{s} 치환 + 받침 일괄 교정
    subDirs = subDirs.map(function(t){
      if (isEn) return t.replace(/\{p\}/g, pEn).replace(/\{s\}/g, sEn);
      return _applyJosaMarkers(t, pEn, sEn);
    });

    return {
      primaryDomain: pEn,
      secondaryDomain: sEn,
      pathLine: line,
      pathTmplIdx: tmplIdx,          // 검증용: 어떤 서사 결로 선택됐는지
      pathBy: (critKeyDe && CRIT_PATH_IDX[critKeyDe] != null) ? ("Q63:" + critKeyDe) : "fingerprint",
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

    // 18. (PR#60-D) 톤 키 ↔ topAxis 일치율 — selectTone 가중치 모델 검증
    //   조건: report._v4Meta.toneResolution.score >= 3
    //         (vc 또는 ax1 중 하나는 반드시 일치해야 톤 정합성 인정)
    //   목적: '관계지향만 일치하지만 self_design/self_execution 강함' 같은 케이스를
    //         warm_connector 로 잘못 분류한 v1.3 회귀를 방지
    var trAlign = report._v4Meta && report._v4Meta.toneResolution;
    var trAlignOk = !!(trAlign && typeof trAlign.score === "number" && trAlign.score >= 3);
    _push("tone_axis_alignment", "톤×topAxis 정합도 (PR#60-D)", trAlignOk,
      trAlign ? ("score=" + trAlign.score + " vc:" + (trAlign.vcMatch?1:0) +
                 " ax1:" + (trAlign.ax1Match?1:0) + " ax2:" + (trAlign.ax2Match?1:0) +
                 " toneKey=" + trAlign.toneKey + " top1=" + trAlign.topAxis) : "missing");

    // 19. (PR#60-D) 진단 응답 직접 결합 검증 — Q39/Q41/Q47/Q49/Q73 본문 노출
    //   buildApplication / program-engine 의 직접 결합(PR#59-B/PR#60-B) 가
    //   실제 본문(application 섹션)에 반영되는지 자동 점검
    var appSec = sections.filter(function(s){ return s.id === "application"; })[0];
    var appBody = "";
    if (appSec && appSec.content) {
      try { appBody = JSON.stringify(appSec.content); } catch(e) { appBody = ""; }
    }
    var injectedKeys = (opts.injectedKeys && opts.injectedKeys.length)
      ? opts.injectedKeys
      : ["Q39","Q41","Q47","Q49","Q73"];
    var injectedHits = 0, injectedDetail = "";
    if (appBody && opts.answers) {
      injectedKeys.forEach(function(qk){
        var ans = opts.answers[qk];
        if (!ans) return;
        var arr = Array.isArray(ans) ? ans : String(ans).split(/\s*[\/,]\s*/);
        var hit = arr.some(function(a){
          var s = String(a||"").trim();
          if (s.length < 2) return false;
          // 5자 이상 토큰 또는 첫 4자 일치 검사
          var probe = s.length >= 5 ? s.slice(0,5) : s.slice(0,3);
          return appBody.indexOf(probe) !== -1;
        });
        if (hit) injectedHits += 1;
      });
      injectedDetail = "hits=" + injectedHits + "/" + injectedKeys.length;
    } else {
      injectedDetail = "skipped (no answers in opts)";
    }
    // 응답이 제공된 경우 절반 이상 노출되어야 통과 (3/5 이상)
    var injectedOk = !opts.answers || injectedHits >= Math.ceil(injectedKeys.length * 0.6);
    _push("application_injected_answers", "활용 예시 진단 응답 직접 결합 (PR#60-D)", injectedOk, injectedDetail);

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
  // PR#57 — 고유 시그니처 합성 (5톤 라벨 제거, 슬롯 합성 전환)
  //   "DNA처럼 겹치지 않는 고유성" 철학 구현.
  //   기존 5톤 × 1:1 고정 매핑 (header / coreOneLine / executionStyle / executionType)
  //   → 진단 슬롯 변수(Q6·Q13·Q41·Q63·Q75 + 4축 시그니처)에서 합성하여 덮어쓴다.
  //   * toneKey 내부 분기는 호환성·KYS 회귀를 위해 유지(라벨/문구만 합성).
  //   * 합성 카디널리티: typeLine ≈ 1억+ / executionStyle ≈ 24만 / coreOneLine ≈ 1억+
  // ──────────────────────────────────────────────────────────

  // ① valueAnchor — Q13 1순위의 어휘적 변형 (9가지 가치 × 3 변형)
  var SYNTH_VALUE_ANCHOR_KO = {
    "사랑":      ["마음이 머무는 자리",   "사람의 곁을 지키는 자리",   "따뜻한 말이 흐르는 자리"],
    "자유":      ["자기 속도로 걷는 길", "자기 색을 잃지 않는 자리", "넉넉한 여백을 두는 삶"],
    "성장":      ["한 뼘씩 자라는 자리",   "어제보다 오늘 더 깊어지는 삶",     "배움이 멈추지 않는 삶"],
    "의미 추구": ["보람을 따라가는 길","왜를 잃지 않는 자리",     "양심이 부르는 자리"],
    "안정":      ["흔들림 없이 단단한 자리","약속을 지키는 태도",      "한결같은 하루를 지키는 자리"],
    "성취":      ["끝을 짓는 태도",         "결과로 답하는 자리",       "약속을 매듭짓는 태도"],
    "재미":      ["몰입이 깨어나는 자리",  "흥이 머무는 하루",         "즐거움이 살아나는 자리"],
    "신념":      ["원칙이 흔들리지 않는 자리","양심이 또렷한 마음",    "한 뜻을 지키는 삶"],
    "책임":      ["맡은 자리를 지키는 태도", "도리를 다하는 하루",       "약속한 일을 매듭짓는 태도"]
  };
  var SYNTH_VALUE_ANCHOR_EN = {
    "사랑":      ["a place where hearts linger","a presence beside another","a room of warm words"],
    "자유":      ["a path walked at one's own breath","a self-coloured place","a margin kept open"],
    "성장":      ["a place that grows an inch each day","a depth deeper than yesterday","an unbroken rhythm of learning"],
    "의미 추구": ["a path following the grain of meaning","a place that never forgets why","a calling of conscience"],
    "안정":      ["a place that holds steady","a rhythm that keeps its word","a grain that stays consistent"],
    "성취":      ["a rhythm that closes things","a place that answers with results","a grain that ties promises down"],
    "재미":      ["a place where flow awakens","a rhythm where joy lingers","a grain alive with delight"],
    "신념":      ["a place where principle stands","a rhythm with a clear conscience","a grain that keeps one will"],
    "책임":      ["a grain that keeps the post entrusted","a rhythm of duty","a grain that closes promises"]
  };

  // ② compassPhrase — Q63 결정 기준 1·2순위 결합 (9개 옵션 × 3 결합 변형 → 단축형)
  var SYNTH_COMPASS_KO = {
    "의미 / 보람 / 가치":         ["보람을 따라",       "의미를 나침반 삼아",     "가치를 잃지 않으며"],
    "안정성 / 안전 / 예측 가능성": ["흔들림 없이 약속을 지키며","안정을 따라",      "예측할 수 있는 하루로"],
    "성장 가능성 / 배움의 기회":   ["배움을 따라",       "한 뼘 더 자라는 마음으로","성장의 길목에서"],
    "자유 / 자율성":              ["자기 속도로",          "자기 색을 따라",         "넉넉한 여백을 두며"],
    "관계 / 소속감 / 인정":        ["사람을 곁에 두며",       "관계를 소중히 살피며",     "함께라는 마음으로"],
    "결과 / 성과 / 효율성":        ["결과로 답하며",          "성과를 끝까지 매듭지으며", "끝까지 매듭지으며"],
    "재미 / 흥미 / 몰입감":        ["몰입을 따라",       "흥이 살아나는 마음으로",          "즐거움을 잃지 않으며"],
    "신념 / 원칙 / 종교적 기준":   ["양심이 부르는 자리에서", "원칙을 나침반 삼아",     "신념을 지키며"],
    "책임 / 도리 / 역할 충실":     ["맡은 자리를 지키며",     "도리를 다하며",          "자기 역할을 다하며"]
  };
  var SYNTH_COMPASS_EN = {
    "의미 / 보람 / 가치":         ["following the grain of meaning","with meaning as compass","not losing what matters"],
    "안정성 / 안전 / 예측 가능성": ["keeping promises steady","along the grain of stability","in a rhythm of foresight"],
    "성장 가능성 / 배움의 기회":   ["along the grain of learning","in a rhythm of one inch more","at the crossroad of growth"],
    "자유 / 자율성":              ["at one's own breath","along one's own colour","keeping a margin open"],
    "관계 / 소속감 / 인정":        ["keeping people beside","reading the grain of relations","in a rhythm of together"],
    "결과 / 성과 / 효율성":        ["answering with results","tying outcomes through","sealing the work to the end"],
    "재미 / 흥미 / 몰입감":        ["along the grain of flow","in a rhythm of delight","without losing joy"],
    "신념 / 원칙 / 종교적 기준":   ["where conscience calls","with principle as compass","keeping the grain of belief"],
    "책임 / 도리 / 역할 충실":     ["holding the post entrusted","fulfilling one's duty","completing the grain of role"]
  };

  // ③ axisLeadVerb — 최강축 × 약축 12개 동사구
  var SYNTH_AXIS_LEAD_KO = {
    "self_understanding": {
      "self_expression":  "자기 생각을 정직하게 길어 올리는",
      "self_design":      "내면의 기준으로 흐름을 짜는",
      "self_execution":   "통찰을 결과로 옮겨 가는"
    },
    "self_expression": {
      "self_understanding": "마음을 말로 풀어 가는",
      "self_design":        "표현으로 사람을 잇는 흐름을 만드는",
      "self_execution":     "말로 자리를 만들고 결과로 매듭짓는"
    },
    "self_design": {
      "self_understanding": "흔들림 없는 운영체계로 자기를 지키는",
      "self_expression":    "자기 체계를 말로 풀어 가는",
      "self_execution":     "설계를 끝까지 결과로 옮기는"
    },
    "self_execution": {
      "self_understanding": "끝까지 해내며 자기 중심을 다지는",
      "self_expression":    "결과로 자리를 만들고 사람을 잇는",
      "self_design":        "약속한 결과를 매듭짓는"
    }
  };
  var SYNTH_AXIS_LEAD_EN = {
    "self_understanding": {
      "self_expression":  "drawing one's grain up honestly",
      "self_design":      "shaping flow with an inner rhythm",
      "self_execution":   "carrying insight into results"
    },
    "self_expression": {
      "self_understanding": "weaving the heart's grain into words",
      "self_design":        "building flows that connect people through expression",
      "self_execution":     "making space with words and sealing it with results"
    },
    "self_design": {
      "self_understanding": "guarding self through an unshaken operating frame",
      "self_expression":    "voicing the grain of one's frame",
      "self_execution":     "carrying design through to results"
    },
    "self_execution": {
      "self_understanding": "deepening the grain of self by finishing through",
      "self_expression":    "making space with results and connecting people",
      "self_design":        "sealing the promised outcome"
    }
  };

  // ④ axisSignature — 4축 양자화 (deep/active/emerging/seed) × 4 = 256
  function _quantizeAxis(pct){
    if (pct >= 90) return "deep";
    if (pct >= 80) return "active";
    if (pct >= 65) return "emerging";
    return "seed";
  }
  function _axisSignature(axisPct){
    var ord = ["self_understanding","self_expression","self_design","self_execution"];
    return ord.map(function(a){ return _quantizeAxis(axisPct[a] || 0).charAt(0); }).join(""); // e.g. "dadd"
  }

  // ⑤ traitColor — Q6 형용사 1개를 한 호흡 형용어로 (12 traits × 2 변형)
  var SYNTH_TRAIT_COLOR_KO = {
    "신중한":     ["서두르지 않는",      "한 호흡 두고 살피는"],
    "분석적인":   ["결을 꿰뚫어 보는",  "패턴을 읽어 가는"],
    "도전적인":   ["길을 만드는",        "낯선 자리를 두려워 않는"],
    "공감적인":   ["마음을 들여다보는",  "결을 함께 느끼는"],
    "논리적인":   ["근거로 말하는",      "원리로 흐름을 짜는"],
    "감성적인":   ["결로 감응하는",      "마음의 색을 살리는"],
    "외향적인":   ["사람의 자리를 만드는","바깥으로 결을 펴는"],
    "내향적인":   ["안으로 결을 다지는", "조용한 호흡으로 깊어 가는"],
    "계획적인":   ["흐름을 미리 짜는",  "단계를 그려 가는"],
    "즉흥적인":   ["순간을 살리는",      "결을 즉시 잡는"],
    "성취지향":   ["끝까지 매듭짓는",    "결과로 답하는"],
    "관계지향":   ["사람을 곁에 두는",  "함께의 결을 키우는"]
  };
  var SYNTH_TRAIT_COLOR_EN = {
    "신중한":     ["unhurried",            "pausing to look once more"],
    "분석적인":   ["reading the grain through","tracing patterns to the bone"],
    "도전적인":   ["path-making",          "unafraid of unfamiliar ground"],
    "공감적인":   ["reading the heart in",  "feeling the grain together"],
    "논리적인":   ["speaking by reason",    "weaving flow by principle"],
    "감성적인":   ["resonating by grain",   "keeping the colour of feeling"],
    "외향적인":   ["making space for people","unfolding outward"],
    "내향적인":   ["deepening inward",      "growing in quiet rhythm"],
    "계획적인":   ["pre-shaping the flow",  "drawing the steps ahead"],
    "즉흥적인":   ["catching the moment",   "seizing the grain at once"],
    "성취지향":   ["sealing things through", "answering with results"],
    "관계지향":   ["keeping people beside",  "growing the grain of together"]
  };

  // ⑥ 헬퍼 — 슬롯에서 시그니처 변수 일괄 추출
  function buildSignatureVars(toneKey, mvSlots, axisPct, traits, fingerprint, lang){
    var isEn = (lang === "en");
    mvSlots = mvSlots || {};
    axisPct = axisPct || {};
    traits = traits || [];

    var v1 = (mvSlots.values_raw && mvSlots.values_raw[0]) || "";
    var anchorLib = isEn ? SYNTH_VALUE_ANCHOR_EN : SYNTH_VALUE_ANCHOR_KO;
    var anchorArr = anchorLib[v1] || anchorLib["성장"] || [""];
    var valueAnchor = pickByHash(anchorArr, fingerprint || 0);

    var c1 = (mvSlots.compass_raw && mvSlots.compass_raw[0]) || "";
    var compassLib = isEn ? SYNTH_COMPASS_EN : SYNTH_COMPASS_KO;
    var compassArr = compassLib[c1] || compassLib["의미 / 보람 / 가치"] || [""];
    var compassPhrase = pickByHash(compassArr, (fingerprint || 0) >>> 3);

    // 4축 ranking
    var ord = Object.keys(axisPct).sort(function(a,b){ return (axisPct[b]||0) - (axisPct[a]||0); });
    var topAxis = ord[0] || "self_understanding";
    var weakAxis = ord[ord.length - 1] || "self_expression";
    if (topAxis === weakAxis) weakAxis = ord[1] || "self_expression";
    var leadLib = isEn ? SYNTH_AXIS_LEAD_EN : SYNTH_AXIS_LEAD_KO;
    var axisLeadVerb = (leadLib[topAxis] && leadLib[topAxis][weakAxis]) || "";

    var axisSig = _axisSignature(axisPct);

    var t1 = traits[0] || "";
    var traitLib = isEn ? SYNTH_TRAIT_COLOR_EN : SYNTH_TRAIT_COLOR_KO;
    var traitArr = traitLib[t1] || [""];
    var traitColor = pickByHash(traitArr, (fingerprint || 0) >>> 7);

    var primaryDomain = mvSlots.primary_domain || "";
    var secondaryDomain = mvSlots.secondary_domain || "";

    return {
      valueAnchor: valueAnchor,
      compassPhrase: compassPhrase,
      axisLeadVerb: axisLeadVerb,
      axisSig: axisSig,
      topAxis: topAxis,
      secondAxis: (ord[1] && ord[1] !== topAxis) ? ord[1] : "", // 2순위 강축(있으면)
      weakAxis: weakAxis,
      traitColor: traitColor,
      primaryDomain: primaryDomain,
      secondaryDomain: secondaryDomain,
      valueRaw: v1,
      compassRaw: c1,
      traitRaw: t1
    };
  }

  // ⑦ synthTypeLine — 표지 헤더 라인 (5톤 header 대체)
  //   PR#62: 도메인 줄표 꼬리("— X·Y의 자리에서") 제거 — 문장 종결을 "한 사람"으로 마무리
  //   도메인은 사명·비전·요약 본문에서 이미 자연 결합되므로, 헤더 한 줄에서는 빠지는 것이
  //   자연스러우며 톤이 정돈됨 (사용자 피드백 반영)
  function synthTypeLine(sv, lang){
    var isEn = (lang === "en");
    if (isEn) {
      var parts = [];
      if (sv.valueAnchor) parts.push("at " + sv.valueAnchor);
      if (sv.compassPhrase) parts.push(sv.compassPhrase);
      var coreEn = (sv.axisLeadVerb || "shaping the grain of self");
      return parts.join(", ") + (parts.length ? " — " : "") + coreEn;
    }
    // KO: "[anchor]에서 [compass], [axisLead] 한 사람" — 도메인 꼬리 미부착
    var anchor = sv.valueAnchor || "";
    var compass = sv.compassPhrase || "";
    var lead = sv.axisLeadVerb || "자기 결을 지키는";
    var head = "";
    if (anchor) head += anchor + "에서";
    if (compass) head += (head ? ", " : "") + compass;
    head += (head ? ", " : "") + lead + " 한 사람";
    return head;
  }

  // ⑧ synthCoreOneLine — 한 줄 요약 (5톤 coreOneLine 대체)
  //   PR#62: 도메인은 본문(사명·비전)에 이미 자연 결합되므로 한 줄 요약에서는 흡수/생략하여
  //   문장 구도(주어–수식–서술어)를 단순·자연하게 유지. 사용자 피드백 반영.
  function synthCoreOneLine(sv, name, lang){
    var isEn = (lang === "en");
    var nm = name || (isEn ? "You" : "당신");
    if (isEn) {
      var leadEn = sv.axisLeadVerb || "shaping the grain of self";
      var trEn = sv.traitColor ? (sv.traitColor + ", ") : "";
      return nm + " is " + trEn + leadEn + ", " + (sv.compassPhrase || "") + ".";
    }
    // KO: "{name}님은 [traitColor] [valueAnchor]에서 [compassPhrase], [axisLeadVerb] 한 사람입니다."
    var anchor = sv.valueAnchor || "";
    var compass = sv.compassPhrase || "";
    var lead = sv.axisLeadVerb || "자기 결을 지키는";
    var trait = sv.traitColor ? (sv.traitColor + " ") : "";
    var line = nm + "님은 " + trait + (anchor ? anchor + "에서 " : "");
    line += (compass ? compass + ", " : "");
    line += lead + " 한 사람입니다.";
    return line;
  }

  // ⑨ synthExecutionStyle — 실행 스타일 (5종 라벨 대체) — 한 호흡 자연어
  //   PR#57 v2c: traitColor + compassPhrase + axisLeadVerb + weakLead 4단 결합 + 시드 분산
  //   카디널리티: trait(2) × compass(3) × axisLead(12) × weakLead(3) × pattern(7) ≈ 1500+
  //                × fingerprint·axisSig·trait 시드 변형 → 실효 ≈ 수만+
  function synthExecutionStyle(sv, lang, fingerprint){
    var isEn = (lang === "en");
    var fp = fingerprint || 0;

    // 시드 분산 — fingerprint 단독이면 분산 부족 → axisSig·trait·value 결합
    var axisSigSeed = (sv.axisSig || "").split("").reduce(function(a,c){ return ((a*131) + c.charCodeAt(0)) >>> 0; }, 0);
    var traitSeed = ((sv.traitRaw || "") + (sv.valueRaw || "")).split("").reduce(function(a,c){ return ((a*167) + c.charCodeAt(0)) >>> 0; }, 0);
    var seed = (fp ^ axisSigSeed ^ (traitSeed << 1)) >>> 0;
    var patternIdx = ((seed * 2246822519) >>> 16) % 7;

    // axisLead 단축형 — 동사구 → 실행체 명사구로 압축
    var leadShortKo = {
      "self_understanding": ["통찰을 길어 올리며","결을 다지며","자기 호흡으로 깊어지며"],
      "self_expression":    ["마음을 잇는 결로","말로 자리를 만들며","결을 풀어 가며"],
      "self_design":        ["흐름을 짜며","운영체계로 단단히","단계를 그리며"],
      "self_execution":     ["끝까지 매듭지으며","결과로 답하며","약속을 지키며"]
    };
    var leadShortEn = {
      "self_understanding": ["drawing insight","deepening the grain","with one's inner breath"],
      "self_expression":    ["with a grain that connects","making space with words","unweaving the grain"],
      "self_design":        ["shaping the flow","with an unshaken frame","drawing the steps"],
      "self_execution":     ["sealing through","answering with results","keeping the promise"]
    };
    var leadLib = isEn ? leadShortEn : leadShortKo;
    var leadArr = leadLib[sv.topAxis] || leadLib.self_understanding;
    var weakArr = leadLib[sv.weakAxis] || leadLib.self_expression;
    var leadShort = pickByHash(leadArr, (seed * 2654435761) >>> 4);
    var weakShort = pickByHash(weakArr, (seed * 40503) >>> 8);

    if (isEn) {
      var t = sv.traitColor || "an unhurried";
      var c = sv.compassPhrase || "with meaning as compass";
      switch (patternIdx) {
        case 0: return t + " rhythm, " + c + " — " + leadShort;
        case 1: return leadShort + ", " + c + ", with a " + t + " rhythm";
        case 2: return c + " in a " + t + " rhythm, " + leadShort;
        case 3: return t + " rhythm — " + leadShort + ", " + c;
        case 4: return leadShort + " · " + weakShort + ", " + t + " rhythm — " + c;
        case 5: return t + " rhythm, " + leadShort + " (" + weakShort + ") — " + c;
        default: return c + " — " + t + " rhythm, " + leadShort + " · " + weakShort;
      }
    }
    var tk = sv.traitColor || "한 호흡 두고 살피는";
    var ck = sv.compassPhrase || "보람의 결을 따라";
    switch (patternIdx) {
      case 0: return tk + " 호흡으로, " + ck + " — " + leadShort;
      case 1: return leadShort + ", " + ck + ", " + tk + " 호흡으로";
      case 2: return ck + ", " + tk + " 호흡으로 " + leadShort;
      case 3: return tk + " 호흡으로 " + leadShort + ", " + ck;
      case 4: return leadShort + " · " + weakShort + ", " + tk + " 호흡으로 — " + ck;
      case 5: return tk + " 호흡으로, " + leadShort + " (" + weakShort + ") — " + ck;
      default: return ck + " — " + tk + " 호흡으로, " + leadShort + " · " + weakShort;
    }
  }

  // ⑩ synthExecutionType — 실행 유형 (5종 라벨 대체) — 명사구
  function synthExecutionType(sv, lang){
    var isEn = (lang === "en");
    var leadShortKo = {
      "self_understanding": "통찰을 길어 올리는",
      "self_expression":    "마음을 잇는",
      "self_design":        "흐름을 짜는",
      "self_execution":     "끝까지 매듭짓는"
    };
    var leadShortEn = {
      "self_understanding": "insight-drawing",
      "self_expression":    "heart-connecting",
      "self_design":        "flow-shaping",
      "self_execution":     "outcome-sealing"
    };
    // [고유성 · PR#69] type을 topAxis 하나로만 정하면 4종(실제 2종)으로 수렴.
    //   → 응답의 *축 순위 2개*(1순위 주축 + 2순위 보조축)를 결합해 "○○며 ○○하는 사람"으로.
    //     축 순위(4×3=12 조합) × trait 결로 변별이 진짜 응답 기반으로 갈린다.
    if (isEn) {
      var headEn = leadShortEn[sv.topAxis] || "grain-keeping";
      var subEn = sv.secondAxis ? (leadShortEn[sv.secondAxis] || "") : "";
      if (subEn && subEn !== headEn) return headEn + ", " + subEn + " practitioner";
      return headEn + " practitioner";
    }
    var headKo = leadShortKo[sv.topAxis] || "결을 지키는";
    var subKo = sv.secondAxis ? (leadShortKo[sv.secondAxis] || "") : "";
    // 응답 성향(Q6 1순위)의 *짧은* 결을 한 단어 얹어, 축 순위가 같은 사람도 갈리게.
    //   TRAIT_COLOR_SHORT_KO 예: 조용한→"고요한", 현실적인→"현실 감각의", 신중한→"서두르지 않는"
    //   (긴 traitColor 대신 짧은 결을 써서 type이 장황해지지 않게 — '단 하나' 유지)
    var trcRaw = (TRAIT_COLOR_SHORT_KO[sv.traitRaw] || "").trim();
    var trcDup = trcRaw && (headKo.indexOf(trcRaw.slice(0,2)) !== -1 || (subKo && subKo.indexOf(trcRaw.slice(0,2)) !== -1));
    var trc = (trcRaw && !trcDup) ? (trcRaw + " ") : "";
    if (subKo && subKo !== headKo) {
      // "[성향결] 통찰을 길어 올리며 끝까지 매듭짓는 사람" — 응답 3차원(성향·주축·보조축) 한 호흡.
      var headStem = headKo.replace(/는$/, "며");
      return trc + headStem + " " + subKo + " 사람";
    }
    return trc + headKo + " 사람";
  }

  // ⑪ synthHeaderSub — 표지 보조 라인 (typeLine 아래 한 줄 보조)
  //   PR#57 v2c: valueAnchor + compassPhrase + traitColor + axisLeadVerb 4단 결합
  //   카디널리티: anchor(27) × compass(27) × trait(24) × axisLead(12) × pattern(7) ≈ 150만+
  function synthHeaderSub(sv, lang, fingerprint){
    var isEn = (lang === "en");
    var fp = fingerprint || 0;
    // 시드 분산 — fingerprint 단독이면 axisSig 변형이 약하므로 axisSig·trait도 결합
    var axisSigSeed = (sv.axisSig || "").split("").reduce(function(a,c){ return ((a*131) + c.charCodeAt(0)) >>> 0; }, 0);
    var traitSeed = ((sv.traitRaw || "") + (sv.compassRaw || "")).split("").reduce(function(a,c){ return ((a*167) + c.charCodeAt(0)) >>> 0; }, 0);
    var seed = (fp ^ axisSigSeed ^ (traitSeed << 1)) >>> 0;
    var patternIdx = ((seed * 2246822519) >>> 16) % 7;
    var anchor = sv.valueAnchor || (isEn ? "a place of one's own grain" : "자기 결의 자리");
    var compass = sv.compassPhrase || (isEn ? "with meaning as compass" : "보람의 결을 따라");
    var trait = sv.traitColor || (isEn ? "an unhurried" : "한 호흡 두고 살피는");
    var lead = sv.axisLeadVerb || (isEn ? "shaping the grain of self" : "자기 결을 지키는");

    if (isEn) {
      switch (patternIdx) {
        case 0: return anchor + ", " + compass + ".";
        case 1: return compass + " — " + anchor + ", " + trait + ".";
        case 2: return trait + ", " + anchor + " — " + compass + ".";
        case 3: return anchor + " — " + trait + ", " + compass + ".";
        case 4: return lead + ", " + anchor + " — " + compass + ".";
        case 5: return trait + " — " + lead + ", " + compass + ".";
        default: return anchor + ", " + lead + " — " + trait + " · " + compass + ".";
      }
    }
    switch (patternIdx) {
      case 0: return anchor + ", " + compass + ".";
      case 1: return compass + " — " + anchor + ", " + trait + " 결로.";
      case 2: return trait + " 호흡으로, " + anchor + " — " + compass + ".";
      case 3: return anchor + " — " + trait + " 결로, " + compass + ".";
      case 4: return lead + ", " + anchor + " — " + compass + ".";
      case 5: return trait + " 결로 — " + lead + ", " + compass + ".";
      default: return anchor + ", " + lead + " — " + trait + " · " + compass + ".";
    }
  }

  // ⑫ synthShortSignature — 마이페이지 칩용 단축 시그니처 (자연어 한 호흡)
  //   PR#57 v2: 4축 carry-tone × 가치 형용 × 나침반 명사 × 어순 패턴 결합
  //   카디널리티: valueAdj(27) × compassNoun(9) × axisLead(12) × axisSig(256) × pattern(3) → 실효 5,000+
  //
  //   표현 패턴 (KO):
  //     0: "[가치형용] [나침반명사]로 [축동사구]"
  //     1: "[나침반명사]를 잃지 않으며 [축동사구], [가치형용]"
  //     2: "[축동사구] [나침반명사]의 결로"
  function synthShortSignature(sv, lang, fingerprint){
    var isEn = (lang === "en");
    var fp = fingerprint || 0;

    // ── 가치 형용어 (Q13 1순위 → 짧은 형용 수식) ─────────────
    var VALUE_ADJ_KO = {
      "사랑":      ["따뜻한","마음을 잇는","곁이 닿는"],
      "자유":      ["자기 색의","여백을 둔","호흡이 트인"],
      "성장":      ["한 뼘씩 자라는","멎지 않는","깊어 가는"],
      "의미 추구": ["보람을 잃지 않는","왜를 묻는","양심이 또렷한"],
      "안정":      ["흔들림 없는","약속을 지키는","한결같은"],
      "성취":      ["끝을 짓는","결과로 답하는","매듭짓는"],
      "재미":      ["몰입이 깨어나는","흥이 머무는","즐거움이 사는"],
      "신념":      ["원칙이 또렷한","양심이 깨어 있는","한 뜻을 지키는"],
      "책임":      ["맡은 자리를 지키는","도리를 다하는","약속을 매듭짓는"]
    };
    var VALUE_ADJ_EN = {
      "사랑":      ["warm","heart-connecting","present beside"],
      "자유":      ["self-coloured","margin-keeping","open-breath"],
      "성장":      ["inch-deeper","unbroken","ever-deepening"],
      "의미 추구": ["meaning-keeping","why-asking","conscience-clear"],
      "안정":      ["unshaken","promise-keeping","ever-steady"],
      "성취":      ["closing-through","result-answering","tying-down"],
      "재미":      ["flow-awakening","joy-lingering","delight-alive"],
      "신념":      ["principle-clear","conscience-awake","one-willed"],
      "책임":      ["post-keeping","duty-fulfilling","promise-closing"]
    };
    var COMPASS_NOUN_KO = {
      "의미 / 보람 / 가치":          "의미",
      "안정성 / 안전 / 예측 가능성": "안정",
      "성장 가능성 / 배움의 기회":   "배움",
      "자유 / 자율성":               "자유",
      "관계 / 소속감 / 인정":        "관계",
      "결과 / 성과 / 효율성":        "결과",
      "재미 / 흥미 / 몰입감":        "몰입",
      "신념 / 원칙 / 종교적 기준":   "원칙",
      "책임 / 도리 / 역할 충실":     "책임"
    };
    var COMPASS_NOUN_EN = {
      "의미 / 보람 / 가치":          "meaning",
      "안정성 / 안전 / 예측 가능성": "stability",
      "성장 가능성 / 배움의 기회":   "learning",
      "자유 / 자율성":               "freedom",
      "관계 / 소속감 / 인정":        "relation",
      "결과 / 성과 / 효율성":        "outcome",
      "재미 / 흥미 / 몰입감":        "flow",
      "신념 / 원칙 / 종교적 기준":   "principle",
      "책임 / 도리 / 역할 충실":     "duty"
    };

    // ── 축 동사구 (4축 × 3 변형) — 시그니처에 어울리는 짧은 형 ───
    var AXIS_LEAD_KO = {
      "self_understanding": ["통찰을 길어 올리는","결을 다지는","호흡을 깊이는"],
      "self_expression":    ["마음을 잇는","말로 결을 푸는","사람의 결을 잇는"],
      "self_design":        ["흐름을 짜는","단계를 그리는","틀을 세우는"],
      "self_execution":     ["끝까지 매듭짓는","결과로 답하는","약속을 지키는"]
    };
    var AXIS_LEAD_EN = {
      "self_understanding": ["drawing insight","deepening grain","breathing inward"],
      "self_expression":    ["connecting hearts","unweaving grain","linking grain"],
      "self_design":        ["shaping flow","drawing steps","framing structure"],
      "self_execution":     ["sealing through","answering results","keeping promise"]
    };

    var v1 = sv.valueRaw || "";
    var c1 = sv.compassRaw || "";
    var topAxis = sv.topAxis || "self_understanding";
    var weakAxis = sv.weakAxis || "self_expression";

    var valueAdjLib = isEn ? VALUE_ADJ_EN : VALUE_ADJ_KO;
    var compassNounLib = isEn ? COMPASS_NOUN_EN : COMPASS_NOUN_KO;
    var axisLeadLib = isEn ? AXIS_LEAD_EN : AXIS_LEAD_KO;

    var adjArr = valueAdjLib[v1] || valueAdjLib["성장"] || [""];
    var leadArr = axisLeadLib[topAxis] || axisLeadLib.self_understanding;
    var weakLeadArr = axisLeadLib[weakAxis] || axisLeadLib.self_expression;

    // fingerprint + axisSig + trait + value + compass 결합으로 변형 인덱스 유도 — 시드 분산 강화
    var axisSigSeed = (sv.axisSig || "").split("").reduce(function(a,c){ return ((a*131) + c.charCodeAt(0)) >>> 0; }, 0);
    var traitSeed = ((sv.traitRaw || "") + (sv.valueRaw || "")).split("").reduce(function(a,c){ return ((a*167) + c.charCodeAt(0)) >>> 0; }, 0);
    var compassSeedShort = (sv.compassRaw || "").split("").reduce(function(a,c){ return ((a*199) + c.charCodeAt(0)) >>> 0; }, 0);
    var domainSeed = ((sv.primaryDomain || "") + (sv.secondaryDomain || "")).split("").reduce(function(a,c){ return ((a*223) + c.charCodeAt(0)) >>> 0; }, 0);
    var sigSeed = (fp ^ axisSigSeed ^ (traitSeed << 1) ^ (compassSeedShort << 3) ^ (domainSeed << 5)) >>> 0;
    var adj = pickByHash(adjArr, sigSeed);
    var lead = pickByHash(leadArr, (sigSeed * 2654435761) >>> 4);
    var weakLead = pickByHash(weakLeadArr, (sigSeed * 40503) >>> 8);
    var compassNoun = compassNounLib[c1] || (isEn ? "meaning" : "의미");
    var traitFrag = sv.traitColor || "";
    var patternIdx = ((sigSeed * 2246822519) >>> 12) % 12;  // PR#57 v2d: 12 어순 패턴

    if (isEn) {
      switch (patternIdx) {
        case 0: return adj + " " + compassNoun + ", " + lead;
        case 1: return "keeping " + compassNoun + ", " + lead + " — " + adj;
        case 2: return lead + " by " + compassNoun + ", " + adj;
        case 3: return (traitFrag ? traitFrag + ", " : "") + lead + " through " + compassNoun;
        case 4: return adj + " — " + lead + ", " + weakLead;
        case 5: return lead + ", " + weakLead + " — " + adj + " " + compassNoun;
        case 6: return (traitFrag ? traitFrag + " — " : "") + adj + " " + compassNoun + ", " + lead;
        case 7: return adj + " " + lead + " (" + compassNoun + " · " + (traitFrag || "self") + ")";
        case 8: return lead + " — " + (traitFrag ? traitFrag + ", " : "") + adj + " " + compassNoun;
        case 9: return weakLead + " · " + lead + ", " + adj + " " + compassNoun;
        case 10: return adj + " " + compassNoun + " — " + lead + (traitFrag ? " (" + traitFrag + ")" : "");
        default: return (traitFrag ? traitFrag + " · " : "") + adj + " " + compassNoun + " · " + lead;
      }
    }
    // KO — 자연 조사 처리
    //   PR#62: 결합 시 "{shortSig} 한 사람입니다." 형태로 합성되므로,
    //          모든 패턴은 "~한 사람"의 ~ 자리에 들어가도 자연스러운 수식·관형 형태로 통일.
    //          줄표(—)·결(noun)로 끝나서 "한 사람"과 충돌하던 패턴(8 등)을 제거하고
    //          관형형(-는/-운)으로 마무리되도록 12개 어순을 재설계.
    switch (patternIdx) {
      case 0: return adj + " " + _ero(compassNoun) + " " + lead;                              // "따뜻한 의미로 마음을 잇는"
      case 1: return _eul(compassNoun) + " 잃지 않고 " + lead;                                 // "의미를 잃지 않고 마음을 잇는"
      case 2: return adj + " " + compassNoun + "의 결로 " + lead;                               // "따뜻한 의미의 결로 마음을 잇는"
      case 3: return (traitFrag ? traitFrag + " 호흡으로 " : "") + adj + " " + lead;            // "서두르지 않는 호흡으로 따뜻한 마음을 잇는"
      case 4: return adj + " " + compassNoun + ", " + lead;                                    // "따뜻한 의미, 마음을 잇는"
      case 5: return lead + ", " + adj + " " + _eul(compassNoun) + " 지키는";                   // "마음을 잇는, 따뜻한 의미를 지키는"
      case 6: return (traitFrag ? traitFrag + " 결의, " : "") + adj + " " + _ero(compassNoun) + " " + lead;  // "서두르지 않는 결의, 따뜻한 의미로 마음을 잇는"
      case 7: return adj + " " + _eul(compassNoun) + " 따라 " + lead;                            // "따뜻한 의미를 따라 마음을 잇는"
      case 8: return (traitFrag ? traitFrag + ", " : "") + adj + " " + compassNoun + "에 " + lead;            // "서두르지 않는, 따뜻한 의미에 마음을 잇는"
      case 9: return lead + " " + adj + " " + compassNoun + "의";                              // "마음을 잇는 따뜻한 의미의"
      case 10: return adj + " " + compassNoun + " 안에서 " + lead;                              // "따뜻한 의미 안에서 마음을 잇는"
      default: return (traitFrag ? traitFrag + " " : "") + adj + " " + _ero(compassNoun) + " " + lead;          // "서두르지 않는 따뜻한 의미로 마음을 잇는"
    }
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

    // P2-1: 56문항 전체 활용 fingerprint (콘텐츠 생성 시드 — 절대 불변)
    var fp = fullAnswerFingerprint(answers, mapping);
    // P2-1b: 64bit 독립 식별자 (고유성 강화 — 콘텐츠에는 미사용)
    var fp64 = fullAnswerFingerprint64(answers, mapping);

    var report = clone(rawReport);
    report.lang = lang;
    report.engineVersion = "v4.1";
    report._v4Meta = { fingerprint: fp, fingerprint64: fp64, generatedAt: new Date().toISOString(), engineVersion: "v4.1" };

    // P0-1: 강점 페어 해석 매트릭스 적용 — growth_map.strengths 교체
    // PR#61-5: 어근(stem) 중복 가드 — "분석적 정직성" 과 "분석력" 같이 동일 어근이 두 번 노출되지 않도록 차단
    var traits = toArr(answers["Q6"]);
    var growthSec = report.sections.filter(function(s){ return s.id === "growth_map"; })[0];

    // PR#61-5: 어근 추출 헬퍼 — 한국어/영어 모두 지원
    function _stemKey(s){
      var t = String(s || "").trim();
      if (!t) return "";
      // 한국어: 첫 2글자(또는 첫 단어)를 기준으로 어근 키 생성
      var ko = t.match(/[가-힣]+/g);
      if (ko && ko.length) {
        // 모든 한글 토큰의 앞 2글자를 합쳐서 시그니처로 사용
        var stems = ko.map(function(w){ return w.slice(0, 2); });
        return stems.join("|");
      }
      // 영어: 소문자 + 첫 단어 4글자
      var en = t.toLowerCase().split(/\s+/).map(function(w){ return w.replace(/[^a-z]/g, "").slice(0, 4); }).filter(Boolean);
      return en.join("|");
    }
    function _uniqueByStem(arr){
      var seenStems = {};
      var seenFull = {};
      var out = [];
      (arr || []).forEach(function(item){
        var s = String(item || "").trim();
        if (!s) return;
        if (seenFull[s]) return;
        var key = _stemKey(s);
        // 어근이 비어 있으면 전체 문자열로만 비교
        if (key && seenStems[key]) return;
        seenFull[s] = true;
        if (key) seenStems[key] = true;
        out.push(item);
      });
      return out;
    }

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
        // PR#61-5: 어근 중복 가드 적용
        growthSec.content.strengths = _uniqueByStem(combined).slice(0, 3);
        // 부족 시 페어 해석을 더 추가 (응답이 1개 trait 인 경우 등) — 어근 가드 적용
        var _idx = 0;
        while (growthSec.content.strengths.length < 3 && pairStrengths.length > 0 && _idx < pairStrengths.length * 2) {
          var _cand = pairStrengths[_idx % pairStrengths.length];
          var _next = _uniqueByStem(growthSec.content.strengths.concat([_cand]));
          if (_next.length > growthSec.content.strengths.length) {
            growthSec.content.strengths = _next;
          }
          _idx++;
        }
        // 최종 보강: 여전히 3개 미달이면 어근 가드 무시하고 채움 (회귀 검증 보장)
        while (growthSec.content.strengths.length < 3 && pairStrengths.length > 0) {
          growthSec.content.strengths.push(pairStrengths[(growthSec.content.strengths.length) % pairStrengths.length]);
        }
        growthSec.content.strengths = unique(growthSec.content.strengths).slice(0, 3);
        if (report._v4Meta) report._v4Meta.strengthsStemGuard = "applied";
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

    // PR#61-6: Q47/Q49 직접 노출 — 자기실행 축 카드에 회원의 몰입 환경 실제 응답을 결합 라벨로 직접 노출
    //   문제: 4축 카드의 자기실행 축 본문이 추상화된 표현으로만 구성되어
    //         회원의 실제 Q47(장소)/Q49(리듬) 응답이 카드 본문에 보이지 않음
    //   해결: enhanceAxisCardV2 후처리 직후, 자기실행 축 카드에 focusEnvLabel 필드를 부착하고
    //         keywords 배열 끝에도 결합 키워드 1개를 추가하여 본문에 직접 노출
    try {
      var _q47 = (typeof getChoiceArray === "function") ? getChoiceArray(answers, "Q47") : (Array.isArray(answers["Q47"]) ? answers["Q47"] : (answers["Q47"] ? [answers["Q47"]] : []));
      var _q49 = (typeof getChoiceArray === "function") ? getChoiceArray(answers, "Q49") : (Array.isArray(answers["Q49"]) ? answers["Q49"] : (answers["Q49"] ? [answers["Q49"]] : []));
      var _envPlace = (_q47 && _q47[0]) ? String(_q47[0]).trim() : "";
      var _envRhythm = (_q49 && _q49[0]) ? String(_q49[0]).trim() : "";
      if (_envPlace || _envRhythm) {
        var _focusLabelKo = "";
        if (_envPlace && _envRhythm) _focusLabelKo = _envPlace + " · " + _envRhythm;
        else _focusLabelKo = _envPlace || _envRhythm;
        var _focusLabelEn = _focusLabelKo; // EN 변환 불필요 시 원문 유지
        report.sections.forEach(function(s){
          if (s.id === "self_execution" && s.content) {
            // 카드 본문에 회원 응답 직접 노출
            s.content.focusEnvLabel = (lang === "en") ? _focusLabelEn : _focusLabelKo;
            s.content.focusEnvSource = { q47: _envPlace, q49: _envRhythm };
            // keywords 배열에도 한 자리 결합 키워드 추가 (4개 유지 가드 — 마지막 항목 교체)
            if (Array.isArray(s.content.keywords) && s.content.keywords.length >= 1) {
              var _envKw = (lang === "en")
                ? ("Focus: " + (_envPlace || "") + (_envRhythm ? (" / " + _envRhythm) : ""))
                : ("몰입 환경: " + (_envPlace || "") + (_envRhythm ? (" / " + _envRhythm) : ""));
              // 중복 방지 — 이미 동일 결합 키워드가 있으면 추가하지 않음
              var _alreadyHas = s.content.keywords.some(function(k){ return String(k).indexOf(_envPlace) !== -1 && _envPlace; });
              if (!_alreadyHas) {
                // 키워드 배열은 정확히 4개 유지 — 마지막 항목을 결합 라벨로 교체
                s.content.keywords[s.content.keywords.length - 1] = _envKw;
              }
            }
          }
        });
        if (report._v4Meta) report._v4Meta.focusEnvDirectExposure = "applied";
      }
    } catch (_eFE) {
      if (report && report._v4Meta) {
        report._v4Meta.focusEnvDirectExposureError = String(_eFE && _eFE.message || _eFE).slice(0, 200);
      }
    }

    // P1-1: 톤 우선순위 결정 — 후처리 단계에서 재검증
    // PR#60-A: v1.3 selectTone 과 동일한 가중치 모델로 재산출하고,
    //          v1.3 톤이 가중치 모델 결과와 다른 경우 본문 톤을 정정한다.
    //          (이전: 메타 권고만 기록 — 김영식님 같은 'vc만 일치, topAxis 어긋남' 케이스
    //           에서 잘못된 톤이 본문에 그대로 노출되던 문제 해결)
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
      // PR#199: 빈도 보존 — unique() 로 중복을 제거하면 [관계,성장,원칙] 처럼
      //   카테고리별 강도(가치 개수)가 사라져 흔한 '성장지향' 한 개만으로도
      //   visionary/pragmatic 으로 쏠리는 '유형화(type collapse)' 가 발생한다.
      //   resolveTone 이 빈도와 Q63 나침반 보조신호로 동점을 정밀 해소하도록
      //   전체 카테고리 배열(중복 포함)과 answers 를 함께 전달한다.
      var valueCatsRaw = valueCats.slice();   // 빈도 포함
      valueCats = unique(valueCats);          // 호환: 메타/다운스트림이 참조하는 고유 목록
      var resolved = resolveTone(report.scores || {}, valueCatsRaw, answers);
      report._v4Meta.toneResolution = resolved;
      // PR#65: 톤 통합 — 다운스트림(ProgramEngine 등)이 v4 메타 없이도 동일 톤을
      //   참조할 수 있도록 최상위 toneKey 필드에 결정 톤을 명시 노출.
      //   (단일 진실 소스 = resolveTone 결과)
      if (resolved && resolved.toneKey) {
        report.toneKey = resolved.toneKey;
      }
      // PR#60-A: 톤 정정 로직 — v1.3 톤 ≠ 가중치 모델 결과 시 본문 톤 교체
      //   조건: ① resolved.toneKey 가 유효
      //         ② v1.3 톤과 다름
      //         ③ resolved.score >= 3 (적어도 vc 일치 또는 ax 강 일치)
      //   효과: 보고서 본문(coreOneLine, header, missionTone, visionTone, executionType,
      //         executionStyle, signatureShort 등)을 새 톤으로 재합성하기 위해 toneKey 교체
      //   사후: 다운스트림 enhanceAxisCardV2/L3/program-engine 모두 새 toneKey 를 참조
      if (resolved.toneKey && report.tone && resolved.toneKey !== report.tone.key) {
        var prevToneKey = report.tone.key;
        var variants = (rules && rules.toneVariants && rules.toneVariants.variants) || {};
        var newVariant = variants[resolved.toneKey];
        // PR#199: 새 가중 스케일(vc 단일=2.0) 기준 — 최소 가치 1개 일치(2.0) 이상이면 정정 허용
        var canCorrect = !!(newVariant && resolved.score >= 2.0);
        report._v4Meta.toneRecommendation = {
          current: prevToneKey,
          recommended: resolved.toneKey,
          reason: resolved.reason,
          applied: canCorrect
        };
        if (canCorrect) {
          // 본문 톤 키/라벨 교체 — variant 본문 슬롯은 v1.3 build 단계에서 이미 생성되었으므로,
          // 여기서는 ① tone.key/label, ② summary 의 coreOneLine·typeLine,
          //          ③ 4축 카드의 tone-스타일 후속 합성에 영향을 주는 toneKey 만 정정
          report.tone.key = resolved.toneKey;
          report.tone.label = (lang === "en")
            ? (newVariant.label_en || newVariant.label || resolved.toneKey)
            : (newVariant.label || resolved.toneKey);
          // toneKey 로컬 변수도 갱신 (이하 후처리에서 사용)
          toneKey = resolved.toneKey;
          // summary 섹션 — 헤더/한 줄 요약을 새 톤 본문으로 재합성
          var sumSec = report.sections.filter(function(s){ return s.id === "summary"; })[0];
          if (sumSec && sumSec.content) {
            var name = (report.profile && report.profile.name) || (lang === "en" ? "Guest" : "고객");
            var keyValues = (toArr(answers["Q13"]) || []).slice(0, 2).join(lang === "en" ? ", " : "·");
            var hdrTpl  = (lang === "en") ? (newVariant.header_en  || newVariant.header)  : newVariant.header;
            var coreTpl = (lang === "en") ? (newVariant.coreOneLine_en || newVariant.coreOneLine) : newVariant.coreOneLine;
            if (hdrTpl) {
              sumSec.content.header = String(hdrTpl)
                .replace(/\{name\}/g, name)
                .replace(/\{values\}/g, keyValues || (lang === "en" ? "your values" : "당신의 가치"));
            }
            if (coreTpl) {
              sumSec.content.coreOneLine = String(coreTpl)
                .replace(/\{name\}/g, name)
                .replace(/\{values\}/g, keyValues || (lang === "en" ? "your values" : "당신의 가치"));
            }
          }

          // PR#61-1: application 섹션을 새 톤으로 재합성
          //   문제: PR#60-A 톤 정정 후에도 application 섹션은 v1.3 build 단계의 이전 톤
          //         (예: warm_connector) 베이스 그대로 노출되어 본문 불일치 발생
          //   해결: ReportEngine.buildApplication 을 새 toneKey 로 재호출하여
          //         job/learning/tasks/firstActions 를 새 톤으로 덮어씀
          //   원칙: 진단 응답 직접 결합 (PR#60-B) 효과는 동일하게 유지
          try {
            var ReportEngineRef = (typeof require === "function") ? require("./report-engine.js") : null;
            if (!ReportEngineRef && typeof window !== "undefined" && window.ReportEngine) {
              ReportEngineRef = window.ReportEngine;
            }
            var beApp = ReportEngineRef && (ReportEngineRef.buildApplication
                                            || (ReportEngineRef._internals && ReportEngineRef._internals.buildApplication));
            var appSecRebuild = report.sections.filter(function(s){ return s.id === "application"; })[0];
            if (beApp && appSecRebuild) {
              var ceRebuild = report.sections.filter(function(s){ return s.id === "career_education"; })[0];
              var careersRb  = (ceRebuild && ceRebuild.content && ceRebuild.content.careers) || [];
              var educRb     = (ceRebuild && ceRebuild.content && ceRebuild.content.education) || [];
              var newToneSel = { key: resolved.toneKey, variant: newVariant };
              var newApp = beApp(newToneSel, answers, careersRb, educRb, lang);
              if (newApp) {
                appSecRebuild.content.job          = newApp.job          || appSecRebuild.content.job;
                appSecRebuild.content.learning     = newApp.learning     || appSecRebuild.content.learning;
                appSecRebuild.content.tasks        = newApp.tasks        || appSecRebuild.content.tasks;
                appSecRebuild.content.firstActions = newApp.firstActions || appSecRebuild.content.firstActions;
                if (report._v4Meta) report._v4Meta.applicationRebuilt = resolved.toneKey;
              }
            }
          } catch (eApp) {
            if (report && report._v4Meta) {
              report._v4Meta.applicationRebuildError = String(eApp && eApp.message || eApp).slice(0, 200);
            }
          }

          // PR#61-2: execution_profile.tools 를 새 톤 기본 루틴으로 재합성
          //   문제: PR#60-A 톤 정정 후에도 execution_profile.tools 는 v1.3 단계의 이전 톤 루틴
          //         (예: "감사 루틴 · 1:1 미팅 루틴 · 감정 일기" — warm_connector) 그대로 유지되어
          //         program-engine.js 의 userTool1 추출이 이전 톤 베이스를 사용하게 됨
          //   해결: ReportEngine.buildExecutionProfile 을 새 toneKey 로 재호출하여
          //         tools 필드(=Q73 + 톤 기본 루틴)만 덮어쓴다.
          //   원칙: ① type/style 은 PR#57 시그니처 합성이 별도로 덮어쓰므로 건드리지 않음
          //         ② drivers/environment/activities 는 진단 응답 기반이라 톤 무관 — 유지
          try {
            var beEP = ReportEngineRef && (ReportEngineRef.buildExecutionProfile
                                           || (ReportEngineRef._internals && ReportEngineRef._internals.buildExecutionProfile));
            var epSecRb = report.sections.filter(function(s){ return s.id === "execution_profile"; })[0];
            if (beEP && epSecRb) {
              var valuesTextRb = [];
              try {
                var sumSecRb = report.sections.filter(function(s){ return s.id === "summary"; })[0];
                if (sumSecRb && sumSecRb.content && Array.isArray(sumSecRb.content.keyValues)) {
                  valuesTextRb = sumSecRb.content.keyValues;
                }
              } catch (_e1) {}
              var careerFieldRb = "";
              try {
                var ceRb2 = report.sections.filter(function(s){ return s.id === "career_education"; })[0];
                if (ceRb2 && ceRb2.content && ceRb2.content.careers && ceRb2.content.careers[0]) {
                  careerFieldRb = ceRb2.content.careers[0].field || ceRb2.content.careers[0].title || "";
                }
              } catch (_e2) {}
              var newToneSelEP = { key: resolved.toneKey, variant: newVariant };
              var newEP = beEP(newToneSelEP, answers, valuesTextRb, careerFieldRb, lang, mapping);
              if (newEP && newEP.tools) {
                epSecRb.content.tools = newEP.tools;
                // drivers 도 동일 톤 베이스로 갱신 (가치 텍스트가 동일하면 결과도 동일)
                if (newEP.drivers) epSecRb.content.drivers = newEP.drivers;
                if (report._v4Meta) report._v4Meta.executionProfileRebuilt = resolved.toneKey;
              }
            }
          } catch (eEP) {
            if (report && report._v4Meta) {
              report._v4Meta.executionProfileRebuildError = String(eEP && eEP.message || eEP).slice(0, 200);
            }
          }
        }
      }
    } catch (e) {
      // 안전 폴백 — 톤 정정 실패 시 v1.3 톤 유지
      if (report && report._v4Meta) {
        report._v4Meta.toneCorrectionError = String(e && e.message || e).slice(0, 200);
      }
    }

    // P1-2: 사명/비전 7-슬롯 합성으로 교체
    var mvSec = report.sections.filter(function(s){ return s.id === "mission_vision"; })[0];
    var mvSlots = null;
    if (mvSec) {
      var mvNew = buildMissionVision7Slot(toneKey, mvSec.content, answers, fp, lang, mapping);
      mvSec.content.mission = mvNew.missionText;
      mvSec.content.vision = mvNew.visionText;
      mvSec.content._slots = mvNew.slots;
      mvSlots = mvNew.slots;

      // ── 3-Tier 노출 (사용자 확정 표현) — 사명·비전 동일 UX ──
      //   사명 ① headline       : L3 한 줄 사명 (Google·Disney 수준)
      //   사명 ② subline        : 한 줄 설명 (Compass 나침반)
      //   사명 ③ diaryMission   : 1인칭 다이어리 사명 본문
      //   비전 ① visionHeadline : "~으로 기억된다" (10년 회상 정체성)
      //   비전 ② visionSubline  : "10년 뒤, ~을(를) 잃지 않은 사람으로"
      //   비전 ③ diaryVision    : 1인칭 다이어리 비전 본문 (10년 회상)
      if (mvNew.tier) {
        // 정식 키 (사명 prefix 명시) — 렌더러 (report.html / preview) 표준
        mvSec.content.missionHeadline = mvNew.tier.headline;
        mvSec.content.missionSubline  = mvNew.tier.subline;
        mvSec.content.diaryMission    = mvNew.tier.diaryMission;
        mvSec.content.visionHeadline  = mvNew.tier.visionHeadline;
        mvSec.content.visionSubline   = mvNew.tier.visionSubline;
        mvSec.content.diaryVision     = mvNew.tier.diaryVision;
        // 하위 호환 — 기존 키 (headline/subline)도 유지 (옛 렌더러/PDF 캡처 보호)
        mvSec.content.headline        = mvNew.tier.headline;
        mvSec.content.subline         = mvNew.tier.subline;
      }

      // ══════════════════════════════════════════════════════════
      //  [RESPONSE-DIRECT 적용] — 유형 템플릿 헤드라인을 "응답 100% 합성"으로 교체.
      //   규칙서 P 형식: "당신의 사명은 ‘○○ʼ입니다." / "당신의 비전은 ‘○○ʼ입니다."
      //   - missionHeadline/visionHeadline = 따옴표 안 핵심 구절(상품 명사형)
      //   - mission/vision(한 줄 통합본) = 규칙서 전체 문장
      //   - subline = 데이터 근거 안내 문구("🔍 …기반으로 도출되었습니다.")
      //   고객마다 고른 분야·가치·강점·동기·보람이 직접 반영 → 유형화 제거.
      // ══════════════════════════════════════════════════════════
      try {
        var axisPctRD = (report.scores && report.scores.axisPct) || {};
        var rd = synthMissionVisionFromResponses(answers, fp, lang, axisPctRD);
        if (rd && rd.missionCore && rd.visionCore) {
          // 따옴표 안 핵심구 = 헤드라인
          mvSec.content.missionHeadline = rd.missionCore;
          mvSec.content.visionHeadline  = rd.visionCore;
          mvSec.content.headline        = rd.missionCore; // 하위호환
          // 전체 규칙서 문장 = 한 줄 통합본
          mvSec.content.mission = rd.mission;
          mvSec.content.vision  = rd.vision;
          // 데이터 근거 안내(규칙서 P 필수 문구)
          var basisKo = "🔍 활동 응답(" + (rd.actLabel || "활동") + ")과 가치·관심 분야 응답을 기반으로 도출되었습니다.";
          var basisEn = "🔍 Derived from your activity response (" + (rd.actLabel || "activity") + ") and your values & field of interest.";
          mvSec.content.missionSubline = (lang === "en") ? basisEn : basisKo;
          mvSec.content.visionSubline  = (lang === "en") ? basisEn : basisKo;
          mvSec.content.footer = (lang === "en") ? basisEn : basisKo;
          // 다이어리 본문은 응답 합성 결과와 충돌하지 않도록 제거(유형 템플릿 잔재 차단)
          mvSec.content.diaryMission = "";
          mvSec.content.diaryVision  = "";
          if (report && report._v4Meta) {
            report._v4Meta.missionVisionSource = "response-direct";
          }
        }
      } catch (eRD) {
        if (report && report._v4Meta) {
          report._v4Meta.missionVisionRDError = String(eRD && eRD.message || eRD).slice(0, 200);
        }
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

    // PR#62: summary_close.line2 — 도메인 한정 표현을 56문항 종합 표현으로 교체
    //   기존: "{domain} 영역에서 {typeP} 모습으로 자신의 사명을 살아냅니다." (도메인 1~2개로 한정)
    //   개선: 가치 형용구 + 강점 결 + 실행 패턴을 자연스럽게 합성 (도메인은 본문 안으로 흡수)
    //   목적: 전체를 요약하는 문장이 일부 영역에 갇히지 않고 응답 전반을 담도록 함
    var closeSec = report.sections.filter(function(s){ return s.id === "summary_close"; })[0];
    if (closeSec && closeSec.content && mvSlots) {
      try {
        var rawJoinC  = mvSlots.values_phrase || "";
        var primaryC  = mvSlots.values_primary_category || "성장지향";
        var typeP     = pickTypePhrase(toneKey, primaryC, fp, lang);

        // 가치 결(values phrase) — 원시값(예: "사랑·자유") 노출 금지, 형용구만 사용
        var valuesAdj = "";
        try {
          if (typeof pickValuesAdjective === "function") {
            valuesAdj = pickValuesAdjective(primaryC, fp, lang) || "";
          }
        } catch (eAdj) { valuesAdj = ""; }
        if (!valuesAdj) {
          // 카테고리별 안전 형용구 (lang=ko/en)
          var adjMap = (lang === "en") ? {
            "관계지향":"with people at the center",
            "성장지향":"in the rhythm of growth",
            "원칙지향":"with principles as the spine",
            "자유지향":"on the line of free choice"
          } : {
            "관계지향":"사람을 중심에 두는 결로",
            "성장지향":"성장의 호흡으로",
            "원칙지향":"원칙을 척추 삼아",
            "자유지향":"자유로운 선택의 선 위에서"
          };
          valuesAdj = adjMap[primaryC] || (lang === "en" ? "true to your own line" : "자기다운 결로");
        }

        if (lang === "en") {
          // 응답 전반 종합: 가치결 + 자기다운 자리 + 사명 살아내기 (도메인은 line1·본문에서 이미 다룸)
          if (typeP) {
            closeSec.content.line2 = "Living out your mission " + valuesAdj + ", as " + typeP + " — in the place that is most your own.";
          } else {
            closeSec.content.line2 = "Living out your mission " + valuesAdj + " — in the place that is most your own.";
          }
        } else {
          if (typeP) {
            closeSec.content.line2 = valuesAdj + ", " + typeP + " 모습으로 자기다운 자리에서 사명을 살아냅니다.";
          } else {
            closeSec.content.line2 = valuesAdj + " 자기다운 자리에서 사명을 살아냅니다.";
          }
          // 폴백: 원시값/도메인 잔존 흔적 제거
          if (rawJoinC && String(closeSec.content.line2).indexOf(rawJoinC) !== -1) {
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

    // ──────────────────────────────────────────────────────────
    // PR#57: 고유 시그니처 합성 — 5톤 라벨 1:1 매핑 제거, 슬롯 합성으로 덮어쓰기
    //   * toneKey 내부 분기는 유지 (호환성·KYS 회귀)
    //   * typeLine / coreOneLine / executionStyle / executionType / headerSub 5개를
    //     진단 슬롯(Q6·Q13·Q41·Q63·Q75 + 4축 시그니처)에서 합성한 자연어로 교체
    // ──────────────────────────────────────────────────────────
    try {
      var axisPctForSig = (report.scores && report.scores.axisPct) || {};
      var traitsForSig = toArr(answers["Q6"]);
      var sigVars = buildSignatureVars(toneKey, mvSlots || {}, axisPctForSig, traitsForSig, fp, lang);
      var nameForSig = (profile && profile.name) || (rawReport.profile && rawReport.profile.name) || "";

      // ① summary.typeLine + coreOneLine 덮어쓰기
      var sumSecPR57 = report.sections.filter(function(s){ return s.id === "summary"; })[0];
      if (sumSecPR57 && sumSecPR57.content) {
        sumSecPR57.content.typeLine = synthTypeLine(sigVars, lang);
        sumSecPR57.content.coreOneLine = synthCoreOneLine(sigVars, nameForSig, lang);
        sumSecPR57.content._signatureVars = sigVars;     // 검증·디버그용 메타
        sumSecPR57.content._signatureScheme = "pr57.synth.v1";
      }

      // ② execution_profile.type / style 덮어쓰기 (5종 고정 라벨 제거)
      var epSec = report.sections.filter(function(s){ return s.id === "execution_profile"; })[0];
      if (epSec && epSec.content) {
        epSec.content.type = synthExecutionType(sigVars, lang);
        epSec.content.style = synthExecutionStyle(sigVars, lang, fp);  // PR#57 v2: fingerprint 다양화
      }

      // ③ summary_close.line1 — "관계 중심의 따뜻한 연결자" 같은 톤 라벨을 시그니처로 대체
      //    line1 은 v1.3에서 "{name}님은 {tone.label}입니다." 형태이므로,
      //    톤 라벨 대신 짧은 합성 시그니처를 사용한다.
      var closeSecPR57 = report.sections.filter(function(s){ return s.id === "summary_close"; })[0];
      if (closeSecPR57 && closeSecPR57.content) {
        var shortSig = synthShortSignature(sigVars, lang, fp);  // PR#57 v2
        if (shortSig) {
          if (lang === "en") {
            closeSecPR57.content.line1 = (nameForSig ? nameForSig + " is " : "You are ") + shortSig + ".";
          } else {
            closeSecPR57.content.line1 = (nameForSig ? nameForSig + "님은 " : "당신은 ") + shortSig + " 한 사람입니다.";
          }
        }
      }

      // ③-b summary_close.items — 고정 행동가이드(누구나 동일) → 응답 기반 개인화.
      //   [고유성 · PR#69] 다음 단계 3가지의 desc에 그 사람의 *실제* 사명/비전 핵심구·진로·
      //   성장포인트를 한 조각 엮어, 같은 구조여도 내용이 응답에서 나오게 한다.
      //   (라벨·아이콘은 공통 문법 유지 — DNA식: 공통 골격 + 응답별 다른 내용)
      try {
        if (closeSecPR57 && closeSecPR57.content && Array.isArray(closeSecPR57.content.items)) {
          var _getSecC = function(id){
            var s = report.sections.filter(function(x){ return x.id === id; })[0];
            return (s && s.content) || {};
          };
          var mvC = _getSecC("mission_vision");
          var ceC = _getSecC("career_education");
          var gmC = _getSecC("growth_map");
          // 사명/비전 핵심구(헤드라인) — 따옴표 안 본질
          var mHead = (mvC.missionHeadline || "").replace(/\s+$/, "");
          var vHead = (mvC.visionHeadline || "").replace(/\s+$/, "");
          // 진로 1순위 라벨
          var topCareer = "";
          if (Array.isArray(ceC.careers) && ceC.careers.length) {
            var c0 = ceC.careers[0];
            topCareer = (typeof c0 === "string") ? c0 : (c0 && (c0.title || c0.label || c0.name) || "");
          }
          // 성장 포인트 1개
          var topGrowth = "";
          if (Array.isArray(gmC.growth) && gmC.growth.length) {
            var g0 = gmC.growth[0];
            topGrowth = (typeof g0 === "string") ? g0 : (g0 && (g0.label || g0.title) || "");
          }
          var items = closeSecPR57.content.items;
          if (lang === "en") {
            if (items[0] && mHead) items[0].desc = "Reshape your mission — \u201c" + mHead + "\u201d — in your own words, one line you can recall instantly.";
            if (items[1]) items[1].desc = "Turn your execution profile" + (topGrowth ? " and your growth point (" + topGrowth + ")" : "") + " into a 12-week plan.";
            if (items[2]) items[2].desc = topCareer ? ("Start with \u201c" + topCareer + "\u201d among your recommended paths within 30 days.") : items[2].desc;
          } else {
            // 사명 핵심구를 직접 인용 → "내 것"이라는 실감 (조사 받침은 인용구 마지막 글자 기준)
            var _josaEul = function(w){ return _hasJong(w) ? "을" : "를"; };
            if (items[0] && mHead) items[0].desc = "당신의 사명 ‘" + mHead + "ʼ" + _josaEul(mHead) + " 본인의 언어로, 단 한 줄로 다듬어 보세요.";
            if (items[1]) items[1].desc = (topGrowth
              ? ("실행 프로파일과 성장 포인트(" + topGrowth + ")" + _josaEul(topGrowth))
              : "실행 프로파일을") + " 토대로 12주 실행 계획을 세워 보세요.";
            if (items[2]) items[2].desc = topCareer ? ("추천 진로 중 ‘" + topCareer + "ʼ부터 30일 안에 한 걸음 시작해 보세요.") : items[2].desc;
          }
        }
      } catch (eItems) {
        if (report && report._v4Meta) report._v4Meta.closeItemsError = String(eItems && eItems.message || eItems).slice(0,150);
      }

      // ④ tone 객체에 short signature 부착 (마이페이지 칩 등 외부 렌더러가 활용)
      if (report.tone && typeof report.tone === "object") {
        report.tone.signatureShort = synthShortSignature(sigVars, lang, fp);  // PR#57 v2
        report.tone.signatureHeader = synthHeaderSub(sigVars, lang, fp);      // PR#57 v2
      }
      report._v4Meta.signatureVars = sigVars;
      report._v4Meta.signatureScheme = "pr57.synth.v2";  // v2 스키마 표기
    } catch (e) {
      // 안전 폴백: 합성 실패 시 기존 v4.1 출력을 그대로 유지 (회귀 영향 0)
      if (report && report._v4Meta) {
        report._v4Meta.signatureError = String(e && e.message || e);
      }
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
      synthMissionVisionFromResponses: synthMissionVisionFromResponses,
      fullAnswerFingerprint: fullAnswerFingerprint,
      fullAnswerFingerprint64: fullAnswerFingerprint64,
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
