/* program-engine.js — 인생포트폴리오 → 맞춤 실행 프로그램 변환 엔진
 * 입력: { report (ReportEngine.build 결과), rules (program-rules.json), name, lang }
 * 출력: 맞춤 실행 프로그램 객체 (7섹션 + 분기 테마/주차 루틴/3개월 목표/1년 비전/모듈/추적/리스크)
 *
 * 규칙 근거:
 *   - 제작 규칙서(맞춤 실행 프로그램) V2.3
 *   - 김영식님 샘플 (warm_connector) 구조
 *
 * 다국어:
 *   - opts.lang === "en" 일 때 program-rules.json의 *_en 필드를 자동 선택
 *   - report.lang 도 폴백으로 참고
 */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.ProgramEngine = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var VERSION = "v1.1";

  function pad(n){ return n < 10 ? "0"+n : ""+n; }
  function fmtDate(d){
    if (!d) d = new Date();
    return d.getFullYear() + "." + pad(d.getMonth()+1) + "." + pad(d.getDate());
  }
  function safe(x, fb){ return (x === undefined || x === null || x === "") ? fb : x; }
  function clone(o){ try { return JSON.parse(JSON.stringify(o)); } catch(e) { return o; } }

  // EN 필드 선택 헬퍼: obj[key+"_en"] 가 있으면 그것을, 아니면 obj[key]를 사용
  function L(isEn, obj, key){
    if (!obj) return undefined;
    if (isEn) {
      var enKey = key + "_en";
      if (obj[enKey] !== undefined && obj[enKey] !== null && obj[enKey] !== "") return obj[enKey];
    }
    return obj[key];
  }

  // 5톤 매핑(기본값) — report.tone 또는 toneKey
  var TONE_FALLBACK = "principled_designer";
  var KNOWN_TONES = ["principled_designer","warm_connector","visionary_creator","pragmatic_achiever","reflective_explorer"];

  // PR#54: Q63 Compass(values_primary_category) → 톤 1순위 가중치
  //   사명·비전이 합성한 Compass(원칙/관계/성장/자유) 와 프로그램 톤이
  //   한 결로 흐르도록 보정. 리포트 내 mission_vision._slots 가 우선.
  //   원시 답안 → 톤 매핑 (제작 규칙서 V2.3):
  //     원칙지향 → principled_designer
  //     관계지향 → warm_connector
  //     성장지향 → reflective_explorer (사색·탐험)
  //     자유지향 → visionary_creator   (자기 호흡 · 비전 창조)
  //   * pragmatic_achiever 는 4축 self_execution 강세에서 별도로 도출
  var COMPASS_CAT_TO_TONE = {
    "원칙지향": "principled_designer",
    "관계지향": "warm_connector",
    "성장지향": "reflective_explorer",
    "자유지향": "visionary_creator"
  };
  // Q63 raw → category (report-engine-v4 와 동일 매핑)
  var Q63_RAW_TO_CAT = {
    "의미 / 보람 / 가치":         "성장지향",
    "안정성 / 안전 / 예측 가능성": "원칙지향",
    "성장 가능성 / 배움의 기회":   "성장지향",
    "자유 / 자율성":              "자유지향",
    "관계 / 소속감 / 인정":        "관계지향",
    "결과 / 성과 / 효율성":        "원칙지향",
    "재미 / 흥미 / 몰입감":        "자유지향",
    "신념 / 원칙 / 종교적 기준":   "원칙지향",
    "책임 / 도리 / 역할 충실":     "원칙지향"
  };

  function _pickToneFromMV(report){
    if (!report || !Array.isArray(report.sections)) return "";
    var mv = report.sections.filter(function(s){ return s.id === "mission_vision"; })[0];
    if (!mv || !mv.content) return "";
    var slots = mv.content._slots || {};
    // 1) values_primary_category 직접 사용
    var cat = slots.values_primary_category || "";
    if (cat && COMPASS_CAT_TO_TONE[cat]) return COMPASS_CAT_TO_TONE[cat];
    // 2) compass_raw[0] → category 매핑
    var raw = (slots.compass_raw && slots.compass_raw[0]) || "";
    if (raw && Q63_RAW_TO_CAT[raw] && COMPASS_CAT_TO_TONE[Q63_RAW_TO_CAT[raw]]) {
      return COMPASS_CAT_TO_TONE[Q63_RAW_TO_CAT[raw]];
    }
    return "";
  }

  // pragmatic_achiever 보정: self_execution 축이 압도적(>=92%) 이고
  //   strong axis 가 self_execution 일 때만 추진형으로 격상
  function _isPragmaticDominant(report){
    var ax = (report && (report.axes || (report.scores && report.scores.axisPct))) || {};
    function v(k){
      if (typeof ax[k] === "number") return ax[k];
      if (ax[k] && typeof ax[k].pct === "number") return ax[k].pct;
      return 0;
    }
    var se = v("self_execution");
    var su = v("self_understanding");
    var sx = v("self_expression");
    var sd = v("self_design");
    var maxOther = Math.max(su, sx, sd);
    return (se >= 92 && se >= maxOther + 3);
  }

  function pickTone(report){
    // PR#65: 톤 통합 — v4 layer 가 이미 가중치 합산 모델로 산출/정정한
    //   _v4Meta.toneResolution.toneKey 를 0순위로 신뢰한다.
    //   (이전: MV Compass 보정이 v4 정정 결과를 다시 뒤집어 Report ↔ Program
    //    톤 불일치가 발생하던 문제 — 김영식 케이스: report=principled_designer,
    //    program=visionary_creator — 를 단일 진실 소스로 일원화)
    if (report && report._v4Meta && report._v4Meta.toneResolution){
      var v4tone = report._v4Meta.toneResolution.toneKey;
      if (typeof v4tone === "string" && KNOWN_TONES.indexOf(v4tone) >= 0) {
        return v4tone;
      }
    }

    // 1순위: 리포트가 명시한 toneKey/tone (v4 미가용 시 폴백 경로)
    var t = (report && (report.tone || report.toneKey)) || "";
    if (typeof t === "string" && KNOWN_TONES.indexOf(t) >= 0) {
      // 단, MV Compass와 정합성 검사 — Compass 카테고리가 강하게 다른 톤을 가리키면 보정
      var mvTone = _pickToneFromMV(report);
      if (mvTone && mvTone !== t) {
        // pragmatic_achiever 만은 4축 우세로 보존
        if (t === "pragmatic_achiever" && _isPragmaticDominant(report)) return t;
        return mvTone; // PR#54: Compass 1순위 가중치 (v4 미가용 시에만 적용)
      }
      return t;
    }
    if (report && report.tone && typeof report.tone === "object" && report.tone.key) {
      if (KNOWN_TONES.indexOf(report.tone.key) >= 0) return report.tone.key;
    }
    // 2순위: MV Compass 카테고리
    var byMV = _pickToneFromMV(report);
    if (byMV) {
      if (_isPragmaticDominant(report)) return "pragmatic_achiever";
      return byMV;
    }
    // 3순위: pragmatic 우세
    if (_isPragmaticDominant(report)) return "pragmatic_achiever";
    return TONE_FALLBACK;
  }

  // 4축 점수 추출
  function pickAxes(report){
    var ax = (report && (report.axes || report.axisPct || (report.scores && report.scores.axisPct) || {})) || {};
    function v(k){
      if (typeof ax[k] === "number") return ax[k];
      if (ax[k] && typeof ax[k].pct === "number") return ax[k].pct;
      if (report && report[k] && typeof report[k].pct === "number") return report[k].pct;
      return 0;
    }
    return {
      self_understanding: v("self_understanding"),
      self_expression:    v("self_expression"),
      self_design:        v("self_design"),
      self_execution:     v("self_execution")
    };
  }

  // 키워드 모으기 (4축 카드 keywords 합치기)
  function pickAllKeywords(report){
    var out = [];
    var keys = ["self_understanding","self_expression","self_design","self_execution"];
    // report.sections 의 4축 카드(7~10단)를 우선
    if (report && Array.isArray(report.sections)) {
      report.sections.forEach(function(s){
        if (keys.indexOf(s.id) >= 0 && s.content && Array.isArray(s.content.keywords)) {
          out = out.concat(s.content.keywords);
        }
      });
    }
    for (var i = 0; i < keys.length; i++){
      var k = keys[i];
      var c = (report && report[k]) || (report && report.cards && report.cards[k]);
      if (c && Array.isArray(c.keywords)) out = out.concat(c.keywords);
    }
    return out;
  }

  // 강·약축 결정
  function findStrongWeak(axes){
    var keys = Object.keys(axes);
    keys.sort(function(a,b){ return axes[b]-axes[a]; });
    return { strong: keys[0], weak: keys[keys.length-1], ordered: keys };
  }

  // 리포트 growth_map 의 강점 TOP3(paired-trait 우선)를 추출
  // PR#48-A: cover.summary.strengths 가 점수 안내가 아닌 실제 강점 표현이 되도록 보강
  function pickReportStrengths(report){
    if (!report || !Array.isArray(report.sections)) return [];
    var gm = report.sections.filter(function(s){ return s.id === "growth_map"; })[0];
    if (!gm || !gm.content || !Array.isArray(gm.content.strengths)) return [];
    return gm.content.strengths.slice(0, 3);
  }

  // 본질(요약) 한 줄
  function essenceLine(report){
    var keys = ["self_understanding","self_expression","self_design","self_execution"];
    var parts = [];
    // report.sections 우선
    if (report && Array.isArray(report.sections)) {
      report.sections.forEach(function(s){
        if (keys.indexOf(s.id) >= 0 && s.content && s.content.core) {
          parts.push(String(s.content.core).split(/[.。]/)[0]);
        }
      });
    }
    if (parts.length === 0) {
      for (var i = 0; i < keys.length; i++){
        var c = (report && report[keys[i]]) || (report && report.cards && report.cards[keys[i]]);
        if (c && c.core) parts.push(String(c.core).split(/[.。]/)[0]);
      }
    }
    return parts.slice(0,2).join(" · ");
  }

  // 문자열 치환 — {{name}}, {{tone}}, {{missionHeadline}}, {{visionHeadline}} 등
  //  + 한국어 조사 자동 보정: 변수 직후의 "을(를)/이(가)/은(는)/와(과)/으로(로)"
  //    또는 단일 "을/를/이/가/은/는/와/과" 가 따라오면 받침에 따라 정확히 치환
  //  + 인용 끝 마침표 제거: 사명·비전 헤드라인이 "...다." 처럼 마침표로 끝나면
  //    작은따옴표 안에서 자연스럽도록 마침표 한 개를 떼어 둠
  function _hangulJong(ch){
    if (!ch) return -1;
    var code = ch.charCodeAt(ch.length - 1);
    if (code < 0xAC00 || code > 0xD7A3) return -1;
    return (code - 0xAC00) % 28;
  }
  function _stripTrailingPunct(s){
    if (typeof s !== "string") return s;
    return s.replace(/[.。!?！？]+$/, "");
  }
  // 비전 헤드라인 종결부 정규화 — 인용("...") 안에서 명사구만 노출되도록 어미·종결 제거
  //   예) "곁에 있으면 의미가 살아나는 사람으로 기억된다." → "곁에 있으면 의미가 살아나는 사람"
  //   예) "Remembered as someone whose presence releases hearts." → "someone whose presence releases hearts"
  function _stripVisionHeadlineTail(s){
    if (typeof s !== "string") return s;
    var t = _stripTrailingPunct(s);
    // 한국어: "(으)로 기억된다" 종결 제거
    t = t.replace(/\s*(?:으로|로)\s*기억된다\s*$/, "");
    // 영어: "Remembered as " 접두 제거
    t = t.replace(/^\s*Remembered\s+as\s+/i, "");
    return t.trim();
  }
  // 헤드라인류(인용 안에 들어가는 문장)는 끝마침표 자동 제거
  var _STRIP_PUNCT_KEYS = { missionHeadline:1, visionHeadline:1, missionSubline:1, visionSubline:1 };
  // 비전 헤드라인은 인용 안에서 명사구만 노출되도록 종결부 추가 정리
  var _STRIP_VISION_TAIL_KEYS = { visionHeadline:1 };
  function tpl(s, vars){
    if (typeof s !== "string") return s;
    // 1차: 조사 결합 패턴 — {{var}}을(를) / {{var}}이(가) / {{var}}은(는) / {{var}}와(과) / {{var}}으로(로)
    s = s.replace(/\{\{(\w+)\}\}(을\(를\)|를\(을\)|이\(가\)|가\(이\)|은\(는\)|는\(은\)|와\(과\)|과\(와\)|으로\(로\)|로\(으로\))/g,
      function(_, k, josa){
        var v = (vars[k] != null) ? String(vars[k]) : "";
        if (_STRIP_VISION_TAIL_KEYS[k]) v = _stripVisionHeadlineTail(v);
        if (_STRIP_PUNCT_KEYS[k]) v = _stripTrailingPunct(v);
        if (!v) return "";
        var jong = _hangulJong(v);
        if (jong < 0) return v + josa; // 한글이 아니면 원문 유지
        var hasFinal = jong !== 0;
        var rieul = jong === 8; // ㄹ 받침
        if (/^을\(를\)|^를\(을\)/.test(josa)) return v + (hasFinal ? "을" : "를");
        if (/^이\(가\)|^가\(이\)/.test(josa)) return v + (hasFinal ? "이" : "가");
        if (/^은\(는\)|^는\(은\)/.test(josa)) return v + (hasFinal ? "은" : "는");
        if (/^와\(과\)|^과\(와\)/.test(josa)) return v + (hasFinal ? "과" : "와");
        if (/^으로\(로\)|^로\(으로\)/.test(josa)) return v + ((!hasFinal || rieul) ? "로" : "으로");
        return v + josa;
      });
    // 2차: "으로/로" 다중 글자 조사 — {{var}} 직후 (작은따옴표가 끼어 있어도 매칭)
    //   허용 구분자: 공백 / 단일·이중 작은따옴표·큰따옴표 닫기 (예: "{{var}}'으로", "{{var}}\u2019으로")
    s = s.replace(/\{\{(\w+)\}\}(['\u2019\u201D"]?)(으로|로)(?=[\s,.\u3002!?\uFF01\uFF1F]|$)/g,
      function(_, k, closer, josa){
        var v = (vars[k] != null) ? String(vars[k]) : "";
        if (_STRIP_VISION_TAIL_KEYS[k]) v = _stripVisionHeadlineTail(v);
        if (_STRIP_PUNCT_KEYS[k]) v = _stripTrailingPunct(v);
        if (!v) return "";
        var jong = _hangulJong(v);
        if (jong < 0) return v + closer + josa;
        var rieul = jong === 8;
        var picked = (jong === 0 || rieul) ? "로" : "으로";
        return v + closer + picked;
      });
    // 3차: 단일 조사 — {{var}} 직후 한 글자 조사 (작은따옴표 닫기 허용)
    s = s.replace(/\{\{(\w+)\}\}(['\u2019\u201D"]?)([을를이가은는와과])/g, function(_, k, closer, josa){
      var v = (vars[k] != null) ? String(vars[k]) : "";
      if (_STRIP_VISION_TAIL_KEYS[k]) v = _stripVisionHeadlineTail(v);
      if (_STRIP_PUNCT_KEYS[k]) v = _stripTrailingPunct(v);
      if (!v) return "";
      var jong = _hangulJong(v);
      if (jong < 0) return v + closer + josa;
      var hasFinal = jong !== 0;
      var picked = josa;
      switch (josa) {
        case "을": case "를": picked = hasFinal ? "을" : "를"; break;
        case "이": case "가": picked = hasFinal ? "이" : "가"; break;
        case "은": case "는": picked = hasFinal ? "은" : "는"; break;
        case "와": case "과": picked = hasFinal ? "과" : "와"; break;
      }
      return v + closer + picked;
    });
    // 3차: 일반 치환 (조사 결합이 없는 경우)
    return s.replace(/\{\{(\w+)\}\}/g, function(_, k){
      var v = (vars[k] != null) ? String(vars[k]) : "";
      if (_STRIP_VISION_TAIL_KEYS[k]) v = _stripVisionHeadlineTail(v);
      if (_STRIP_PUNCT_KEYS[k]) v = _stripTrailingPunct(v);
      return v;
    });
  }
  function tplArr(arr, vars){
    if (!Array.isArray(arr)) return [];
    return arr.map(function(s){ return tpl(s, vars); });
  }

  // 사명/비전 슬롯 추출 — report.sections[mission_vision].content 의 3-Tier 필드 사용
  //   (없으면 빈 문자열 폴백 → 템플릿에서 자연스럽게 사라짐)
  function extractMissionVisionVars(report, isEn){
    var out = {
      missionHeadline: "", missionSubline: "",
      visionHeadline:  "", visionSubline:  "",
      primaryDomain:   "", secondaryDomain: "",
      domainPhrase:    "",
      compassKw:       "", compassVerb: ""
    };
    if (!report || !Array.isArray(report.sections)) return out;
    var mv = report.sections.filter(function(s){ return s.id === "mission_vision"; })[0];
    if (!mv || !mv.content) return out;
    var c = mv.content;
    // PR#53: 정식 키 우선 (missionHeadline/missionSubline) → 하위 호환 (headline/subline)
    out.missionHeadline = c.missionHeadline || c.headline       || "";
    out.missionSubline  = c.missionSubline  || c.subline        || "";
    out.visionHeadline  = c.visionHeadline  || "";
    out.visionSubline   = c.visionSubline   || "";
    var slots = c._slots || {};
    out.primaryDomain   = slots.primary_domain   || "";
    out.secondaryDomain = slots.secondary_domain || "";
    // 도메인 결합 어구 — "경제와 교육" / "economy and education"
    //   받침 검사: 받침 있으면 "과", 없으면 "와" (예: "예술과 미디어", "철학과 인문학", "경제와 교육")
    if (out.primaryDomain && out.secondaryDomain) {
      if (isEn) {
        out.domainPhrase = out.primaryDomain + " and " + out.secondaryDomain;
      } else {
        var _jongPrim = _hangulJong(out.primaryDomain);
        var _waGwa = (_jongPrim > 0) ? "과 " : "와 "; // jong>0 받침 있음 → "과"
        out.domainPhrase = out.primaryDomain + _waGwa + out.secondaryDomain;
      }
    } else {
      out.domainPhrase = out.primaryDomain || (isEn ? "your field" : "지금 살아가는 자리");
    }
    // Q63 Compass 핵심어 + 동사구 (예: "의미" / "의미 새기기")
    var compassRaw = (slots.compass_raw && slots.compass_raw[0]) || "";
    var KW = isEn ? {
      "의미 / 보람 / 가치":         {kw:"meaning",        verb:"naming meaning"},
      "안정성 / 안전 / 예측 가능성": {kw:"steadiness",     verb:"holding steady"},
      "성장 가능성 / 배움의 기회":   {kw:"learning",       verb:"capturing learning"},
      "자유 / 자율성":              {kw:"your own pace",  verb:"keeping your own pace"},
      "관계 / 소속감 / 인정":        {kw:"people",         verb:"connecting people"},
      "결과 / 성과 / 효율성":        {kw:"results",        verb:"finishing through"},
      "재미 / 흥미 / 몰입감":        {kw:"immersion",      verb:"keeping immersion alive"},
      "신념 / 원칙 / 종교적 기준":   {kw:"principle",      verb:"keeping principle"},
      "책임 / 도리 / 역할 충실":     {kw:"responsibility", verb:"carrying your share"}
    } : {
      "의미 / 보람 / 가치":         {kw:"의미",     verb:"의미 새기기"},
      "안정성 / 안전 / 예측 가능성": {kw:"단단함",   verb:"단단함 지키기"},
      "성장 가능성 / 배움의 기회":   {kw:"배움",     verb:"배움 길어 올리기"},
      "자유 / 자율성":              {kw:"자기 호흡", verb:"자기 호흡대로 가기"},
      "관계 / 소속감 / 인정":        {kw:"사람",     verb:"마음 잇기"},
      "결과 / 성과 / 효율성":        {kw:"결과",     verb:"끝까지 마무리"},
      "재미 / 흥미 / 몰입감":        {kw:"몰입",     verb:"몰입 살리기"},
      "신념 / 원칙 / 종교적 기준":   {kw:"원칙",     verb:"원칙 지키기"},
      "책임 / 도리 / 역할 충실":     {kw:"책임",     verb:"맡은 자리 지키기"}
    };
    var kwInfo = KW[compassRaw] || (isEn ? {kw:"meaning", verb:"naming meaning"} : {kw:"의미", verb:"의미 새기기"});
    out.compassKw   = kwInfo.kw;
    out.compassVerb = kwInfo.verb;
    return out;
  }

  /* ========================================================================
   *  PR#54 — L3(Google) 수준 합성 라이브러리
   *    원칙: ① 진단 매핑 보존 (Q13/Q41/Q63/Q75 → 톤·도메인·Compass)
   *          ② 한 호흡 단문 (쉼표 최소화, 명사 나열 금지)
   *          ③ 답안 매핑 외 사족 추가 금지
   *  적용:  ① 표지 인용문   ② 6박스 본문   ③ 분기 테마/리드 3줄
   * ====================================================================== */

  // 톤 × Compass 카테고리 → 성향 한 호흡 형용구 (L3)
  //   매핑 결과를 자연어 한 줄로 합성. "성향: 따뜻한 연결자 — 공감과 신뢰…" 같은
  //   라벨 나열 대신 "사람의 결을 살피며 의미가 흐르도록 잇는다" 처럼 합성.
  var L3_TRAITS_KO = {
    principled_designer: {
      "원칙지향": "원칙을 자기 결로 새기며 흔들림 없이 한 길을 간다",
      "관계지향": "원칙으로 사람을 지켜 내며 곁에 한결같이 머문다",
      "성장지향": "원칙을 자기 결로 새기며 매일 한 뼘씩 깊어진다",
      "자유지향": "원칙을 자기 호흡으로 지키며 자기 길을 또렷이 그어 간다"
    },
    warm_connector: {
      // [옵션 A 확정 / RULE-REPORT R3 #1] warm_connector 시그니처 보존 라인.
      // "마음" 어휘는 warm_connector 톤의 핵심 시그니처로, Q63 compass와 충돌하지 않는 범위에서 보존.
      // (PR#63 / 2026-05-06)
      "원칙지향": "사람의 마음을 한결같이 지키며 신뢰를 결로 잇는다",
      "관계지향": "사람의 결을 살피며 마음이 머무는 자리를 만든다",
      "성장지향": "사람을 깊이 만나며 그 만남마다 한 뼘씩 자란다",
      "자유지향": "사람과 함께하되 휘둘리지 않고 자기 색으로 잇는다"
    },
    visionary_creator: {
      "원칙지향": "자기 색을 흩뜨리지 않고 상상한 결을 작품으로 옮긴다",
      "관계지향": "사람의 {{compassKw}}을(를) 끌어안으며 새로운 결을 작품으로 펼친다",
      "성장지향": "새로운 의미를 길어 올려 자기 색대로 작품을 빚는다",
      "자유지향": "정해진 길 대신 자기 호흡으로 새 길을 그어 간다"
    },
    pragmatic_achiever: {
      "원칙지향": "결정한 것을 끝까지 마무리하며 결과로 원칙을 증명한다",
      "관계지향": "함께한 약속을 끝까지 챙기며 결과로 신뢰를 쌓는다",
      "성장지향": "결과로 답하며 매 분기 한 단계씩 자라 간다",
      "자유지향": "자기 속도로 결정하고 흐트러짐 없이 마무리한다"
    },
    reflective_explorer: {
      "원칙지향": "조용한 깊이로 자기 기준을 다듬으며 한 길을 간다",
      "관계지향": "사람과의 결을 사색으로 길어 올려 자기 길로 잇는다",
      "성장지향": "질문을 작은 실험으로 옮기며 자기 답을 만든다",
      "자유지향": "조용한 사색으로 자기 호흡의 길을 또렷이 그어 간다"
    }
  };
  var L3_TRAITS_EN = {
    principled_designer: {
      "원칙지향": "carving principle into your own grain and walking one steady line",
      "관계지향": "guarding people through principle and staying steadily beside them",
      "성장지향": "carving principle into your own grain and deepening one step at a time",
      "자유지향": "keeping principle in your own breath and drawing your own line clearly"
    },
    warm_connector: {
      "원칙지향": "guarding hearts steadily and weaving trust into a single grain",
      "관계지향": "reading the grain of people and making space where hearts can rest",
      "성장지향": "meeting people deeply and growing a step with every encounter",
      "자유지향": "walking with people without being swayed and weaving in your own color"
    },
    visionary_creator: {
      "원칙지향": "keeping your color steady and turning what you imagined into work",
      "관계지향": "embracing hearts and unfolding a new grain into finished work",
      "성장지향": "drawing fresh meaning and shaping work in your own color",
      "자유지향": "drawing a new path in your own breath rather than the given road"
    },
    pragmatic_achiever: {
      "원칙지향": "finishing what you decided and proving principle through results",
      "관계지향": "carrying shared promises through and stacking trust through results",
      "성장지향": "answering with results and growing one step each quarter",
      "자유지향": "deciding at your own pace and finishing without drift"
    },
    reflective_explorer: {
      "원칙지향": "refining your standard through quiet depth and walking one line",
      "관계지향": "drawing the grain of people through reflection and weaving your path",
      "성장지향": "turning questions into small experiments and making your own answers",
      "자유지향": "drawing the path of your own breath through quiet reflection"
    }
  };

  // 톤 × Compass 카테고리 → 분기 테마(Heading) L3 합성
  var L3_QUARTER_HEADING_KO = {
    principled_designer: {
      "원칙지향": "원칙을 결로 새기는 분기",
      "관계지향": "원칙으로 사람을 지키는 분기",
      "성장지향": "원칙을 깊이로 잇는 분기",
      "자유지향": "원칙을 자기 호흡으로 그어 가는 분기"
    },
    warm_connector: {
      // [옵션 A 확정 / RULE-REPORT R3 #2] warm_connector 분기 헤딩 시그니처 보존.
      // (PR#63 / 2026-05-06)
      "원칙지향": "마음을 원칙으로 지키는 분기",
      "관계지향": "마음을 잇고 신뢰를 쌓는 분기",
      "성장지향": "사람을 만나며 자라 가는 분기",
      "자유지향": "함께하되 자기 색을 지키는 분기"
    },
    visionary_creator: {
      "원칙지향": "상상을 자기 결로 작품에 새기는 분기",
      "관계지향": "사람의 {{compassKw}}을(를) 작품으로 펼치는 분기",
      "성장지향": "비전을 작품으로 증명하는 분기",
      "자유지향": "자기 호흡으로 새 길을 여는 분기"
    },
    pragmatic_achiever: {
      "원칙지향": "원칙을 결과로 증명하는 분기",
      "관계지향": "약속을 결과로 챙기는 분기",
      "성장지향": "결과로 답하며 자라 가는 분기",
      "자유지향": "자기 속도로 결과를 빚는 분기"
    },
    reflective_explorer: {
      "원칙지향": "사색으로 원칙을 다듬는 분기",
      "관계지향": "사색을 사람의 길로 잇는 분기",
      "성장지향": "사색을 길로 잇는 분기",
      "자유지향": "조용한 호흡으로 자기 길을 그어 가는 분기"
    }
  };
  var L3_QUARTER_HEADING_EN = {
    principled_designer: { "원칙지향":"A quarter to carve principle into grain", "관계지향":"A quarter to guard people through principle", "성장지향":"A quarter to weave principle into depth", "자유지향":"A quarter to draw principle in your own breath" },
    warm_connector:      { "원칙지향":"A quarter to guard hearts through principle", "관계지향":"A quarter to connect hearts and build trust", "성장지향":"A quarter to grow through meeting people", "자유지향":"A quarter to walk together yet keep your color" },
    visionary_creator:   { "원칙지향":"A quarter to carve imagination into work in your own grain", "관계지향":"A quarter to unfold hearts into work", "성장지향":"A quarter to prove vision through finished work", "자유지향":"A quarter to open a new path in your own breath" },
    pragmatic_achiever:  { "원칙지향":"A quarter to prove principle through results", "관계지향":"A quarter to honor promises through results", "성장지향":"A quarter to answer with results and grow", "자유지향":"A quarter to shape results at your own pace" },
    reflective_explorer: { "원칙지향":"A quarter to refine principle through reflection", "관계지향":"A quarter to weave reflection into the path of people", "성장지향":"A quarter to weave reflection into a path", "자유지향":"A quarter to draw your own path in quiet breath" }
  };

  // mvSlots 의 values_primary_category 추출 (없으면 'fallback')
  function _pickPrimaryCategory(report){
    if (!report || !Array.isArray(report.sections)) return "";
    var mv = report.sections.filter(function(s){ return s.id === "mission_vision"; })[0];
    if (!mv || !mv.content) return "";
    var slots = mv.content._slots || {};
    return slots.values_primary_category || (Q63_RAW_TO_CAT[(slots.compass_raw||[])[0]] || "");
  }

  // 톤×Compass 한 호흡 형용구
  function l3TraitPhrase(toneKey, primaryCat, isEn){
    var lib = isEn ? L3_TRAITS_EN : L3_TRAITS_KO;
    var byTone = lib[toneKey] || lib.principled_designer;
    return byTone[primaryCat] || byTone["성장지향"] || (isEn ? "walking your own grain with steady breath" : "자기 결을 자기 호흡으로 또렷이 그어 간다");
  }
  // 톤×Compass 분기 테마 헤딩
  function l3QuarterHeading(toneKey, primaryCat, isEn){
    var lib = isEn ? L3_QUARTER_HEADING_EN : L3_QUARTER_HEADING_KO;
    var byTone = lib[toneKey] || lib.principled_designer;
    return byTone[primaryCat] || byTone["성장지향"] || (isEn ? "A quarter to walk your own grain" : "자기 결을 그어 가는 분기");
  }

  // 약축 → 한 호흡 보완점 합성 (점수·축% 노출 금지)
  var L3_GAP_KO = {
    self_understanding: "내면을 한 줄 언어로 꺼내는 결을 더한다",
    self_expression:    "느낀 것을 한 호흡 언어로 옮기는 결을 더한다",
    self_design:        "흩어진 길을 한 그림으로 묶는 결을 더한다",
    self_execution:     "결정한 것을 작은 마감으로 옮기는 결을 더한다"
  };
  var L3_GAP_EN = {
    self_understanding: "Add the grain of putting your inside into one line",
    self_expression:    "Add the grain of moving feeling into one breath of language",
    self_design:        "Add the grain of binding scattered paths into one picture",
    self_execution:     "Add the grain of moving decision into a small finish"
  };
  function l3GapPhrase(weakAxis, isEn){
    var lib = isEn ? L3_GAP_EN : L3_GAP_KO;
    return lib[weakAxis] || (isEn ? "Add a small grain that lets your distinctiveness unfold" : "자기다움이 펼쳐질 작은 결을 더한다");
  }

  // 톤×Compass → 적합 환경 한 호흡 (envByTone 의 L3 격상판)
  var L3_ENV_KO = {
    principled_designer: "원칙이 존중받고 자기 결로 사색할 자리가 있는 환경",
    warm_connector:      "사람 중심의 따뜻한 분위기, 1:1 깊은 대화가 가능한 자리",
    visionary_creator:   "발행과 실험이 빠르게 굴러가고 자율 창작 시간이 보장되는 자리",
    pragmatic_achiever:  "성과 지표가 또렷하고 실행 권한이 주어지는 자리",
    reflective_explorer: "조용한 사색과 작은 실험이 존중받는 자리"
  };
  function l3EnvPhrase(toneKey, primaryCat, isEn){
    if (isEn) return envByTone(toneKey, true);
    var base = L3_ENV_KO[toneKey] || L3_ENV_KO.principled_designer;
    // Compass 카테고리 보완 한 마디 ('사람의 결' / '자기 호흡' / '깊이' / '결과')
    var coda = ({
      "원칙지향": "원칙이 결로 흐르는 자리",
      "관계지향": "사람의 결이 흐르는 자리",
      "성장지향": "자라남이 일상이 되는 자리",
      "자유지향": "자기 호흡이 보장되는 자리"
    })[primaryCat] || "";
    return coda ? (base + " · " + coda) : base;
  }

  // 신규 가능성 한 호흡 — newPaths 4개 나열은 유지하되 도입어를 사명 결로 정리
  function l3NewPathsLine(newPathsArr, missionHeadlineRaw, isEn){
    var join = (newPathsArr || []).slice(0,4).join(isEn ? " · " : " · ");
    if (!join) return isEn ? "Paths to take this mission outward" : "이 사명을 바깥으로 가져갈 길";
    return join;
  }

  /* ------------------------------------------------------------------
   * PR#54 — 6박스 헤드라인 라이브러리 (Google L3: 헤드라인 + 한 호흡 본문)
   *   각 박스: { headline: 한 단어/짧은 구, body: 한 호흡 단문 }
   *   - 헤드라인은 톤×Compass 카테고리로 합성 (라벨 나열 금지)
   *   - 본문은 기존 l3* 함수 결과 재사용
   * ------------------------------------------------------------------ */
  // [옵션 A 확정 / RULE-REPORT R3 #3] L3_HEAD_TRAITS_KO warm_connector 라인 보존.
  //   warm_connector 시그니처("한결같이 지키는 마음", "마음이 머무는 자리")는 톤 정체성으로 유지.
  //   (PR#63 / 2026-05-06)
  var L3_HEAD_TRAITS_KO = {
    principled_designer: { "원칙지향":"흔들림 없는 한 길", "관계지향":"원칙으로 곁을 지키는 결", "성장지향":"매일 한 뼘 깊어지는 결", "자유지향":"자기 호흡으로 그어 가는 길" },
    warm_connector:      { "원칙지향":"한결같이 지키는 마음", "관계지향":"마음이 머무는 자리", "성장지향":"만남마다 자라는 결", "자유지향":"휘둘리지 않는 자기 색" },
    visionary_creator:   { "원칙지향":"색을 잃지 않는 작품", "관계지향":"{{compassKw}}을(를) 펼치는 작품", "성장지향":"자기 색의 새 작품", "자유지향":"자기 호흡의 새 길" },
    pragmatic_achiever:  { "원칙지향":"결과로 증명하는 원칙", "관계지향":"끝까지 챙기는 약속", "성장지향":"결과로 답하는 성장", "자유지향":"자기 속도의 마무리" },
    reflective_explorer: { "원칙지향":"조용한 깊이의 한 길", "관계지향":"사색을 사람의 길로", "성장지향":"질문이 답이 되는 길", "자유지향":"조용한 호흡의 길" }
  };
  var L3_HEAD_TRAITS_EN = {
    principled_designer: { "원칙지향":"One steady line", "관계지향":"Guarding by principle", "성장지향":"Deepening one step", "자유지향":"Drawing in your breath" },
    warm_connector:      { "원칙지향":"A steadfast heart", "관계지향":"A place where hearts rest", "성장지향":"Growing through people", "자유지향":"Color that stays" },
    visionary_creator:   { "원칙지향":"Work in your color", "관계지향":"Hearts unfolded into work", "성장지향":"New work in your color", "자유지향":"A new path in your breath" },
    pragmatic_achiever:  { "원칙지향":"Principle proven by results", "관계지향":"Promises carried through", "성장지향":"Growth that answers", "자유지향":"Finishing at your pace" },
    reflective_explorer: { "원칙지향":"Quiet depth, one line", "관계지향":"Reflection into a path", "성장지향":"Questions become answers", "자유지향":"A path in quiet breath" }
  };
  var L3_HEAD_STRENGTHS_KO = {
    principled_designer: "사명을 받쳐 주는 결", warm_connector: "사명을 받쳐 주는 결",
    visionary_creator: "사명을 받쳐 주는 결", pragmatic_achiever: "사명을 받쳐 주는 결",
    reflective_explorer: "사명을 받쳐 주는 결"
  };
  var L3_HEAD_GAP_KO = {
    self_understanding: "한 줄 언어의 결", self_expression: "한 호흡 표현의 결",
    self_design: "한 그림으로 묶는 결", self_execution: "작은 마감의 결"
  };
  var L3_HEAD_GAP_EN = {
    self_understanding: "Grain of one-line language", self_expression: "Grain of one breath",
    self_design: "Grain of one picture", self_execution: "Grain of small finish"
  };
  // [옵션 A 확정 / RULE-REPORT R3 #4] L3_HEAD_ENV_KO warm_connector 환경 시그니처 보존.
  //   (PR#63 / 2026-05-06)
  var L3_HEAD_ENV_KO = {
    principled_designer: "원칙이 결로 흐르는 자리", warm_connector: "마음이 머무는 자리",
    visionary_creator: "창작이 굴러가는 자리", pragmatic_achiever: "결과로 답하는 자리",
    reflective_explorer: "사색이 존중받는 자리"
  };
  var L3_HEAD_ENV_EN = {
    principled_designer: "Where principle flows as grain", warm_connector: "Where hearts can rest",
    visionary_creator: "Where creation rolls", pragmatic_achiever: "Where results answer",
    reflective_explorer: "Where reflection is honored"
  };
  function l3Head(libKo, libEn, toneKey, isEn){
    return (isEn ? libEn : libKo)[toneKey] || (isEn ? libEn.principled_designer : libKo.principled_designer);
  }
  function l3HeadByTone2(libKo, libEn, toneKey, primaryCat, isEn){
    var lib = (isEn ? libEn : libKo);
    var byTone = lib[toneKey] || lib.principled_designer;
    return byTone[primaryCat] || byTone["성장지향"];
  }


  /* ========================================================================
   *  PR#55 — L3(Google) 합성 엔진 라이브러리 (Custom Execution Program)
   *    문제: 동일 톤·동일 Compass 사용자는 weeks/month3/board/nextSteps/
   *          modules/quarterParas 가 픽셀 단위로 동일 출력됨.
   *    해결(옵션 B): 톤×Compass 매트릭스 템플릿 + tpl() 변수 주입으로 합성.
   *    원칙: ① Q13/Q41/Q63/Q75 매핑 보존
   *          ② 한 호흡 단문 (라벨 나열·점수 노출 금지)
   *          ③ tonePack 직접 참조 대신 합성 라이브러리 우선 (없으면 폴백)
   * ====================================================================== */

  // [1] 3주 × 3액션 — 톤 × Compass 매트릭스 (5톤 × 4Compass × 9문장)
  var L3_WEEK_ACTION_KO = {
    warm_connector: {
      "관계지향": [
        ["매일 아침, 오늘 만날 한 사람의 {{compassKw}}을(를) 한 줄 메모합니다.","대화 중 상대의 핵심 {{compassKw}} 단어를 1개씩 받아 적습니다.","하루 끝, 가장 {{compassKw}}이(가) 머문 한 장면을 3줄로 기록합니다."],
        ["주 3회, 한 사람에게 {{compassKw}}을(를) 담은 짧은 메시지를 보냅니다.","대화 중 내 {{compassKw}}도 한 문장 솔직하게 표현합니다.","{{primaryDomain}}에서 {{compassKw}}을(를) 가르쳐 준 3명에게 메시지 초안을 작성합니다."],
        ["{{compassKw}}이(가) 살아나는 한 사람과 30분 깊이 대화를 진행합니다.","내가 {{compassVerb}} 받았던 순간 3가지를 적고, 내가 함께 머물 1명을 정합니다.","지난 3주간 \u2018{{visionHeadline}}\u2019이(가) 떠오른 사람 3명을 다음 달 연결 우선순위로 정리합니다."]
      ],
      "원칙지향": [
        ["매일 아침, 오늘 지킬 한 가지 {{compassKw}}을(를) 한 줄 메모합니다.","대화 중 내가 흔들린 순간을 1개 받아 적고 {{compassKw}}을(를) 다시 새깁니다.","하루 끝, {{compassKw}}이(가) 지켜진 한 장면을 3줄로 기록합니다."],
        ["주 3회, 사람을 만나며 {{compassKw}}을(를) 어떻게 지켰는지 한 문장 적습니다.","{{primaryDomain}}의 결정 1개를 {{compassKw}} 기준으로 다시 들여다봅니다.","{{compassKw}}을(를) 함께 지키고 싶은 1명에게 한 문장 메시지를 보냅니다."],
        ["{{compassKw}}을(를) 함께 지켜 온 한 사람과 30분 깊이 대화를 진행합니다.","내가 {{compassKw}}을(를) 지킨 순간 3가지를 적고, 다음 한 달의 한 약속을 정합니다.","\u2018{{visionHeadline}}\u2019으로 자라기 위해 분기 동안 지킬 1원칙을 명문화합니다."]
      ],
      "성장지향": [
        ["매일 아침, 오늘 길어 올릴 한 가지 {{compassKw}}을(를) 한 줄 메모합니다.","대화·독서 중 새로 만난 {{compassKw}} 단어를 1개씩 받아 적습니다.","하루 끝, 오늘 가장 {{compassKw}}이(가) 자란 한 장면을 3줄로 기록합니다."],
        ["주 3회, 사람을 만나며 길어 올린 {{compassKw}}을(를) 한 문장으로 정리합니다.","{{primaryDomain}}에서 새로 시도한 작은 실험 1개를 매일 한 줄 기록합니다.","\u2018{{compassKw}}을(를) 함께 길어 올릴 사람 3명\u2019에게 한 문장 메시지를 초안합니다."],
        ["{{compassKw}}이(가) 살아나는 한 사람과 30분 깊이 대화를 진행합니다.","지난 3주간 누적된 {{compassKw}}을(를) 5줄 회고로 묶습니다.","\u2018{{visionHeadline}}\u2019으로 자라기 위해 다음 분기 한 실험을 정합니다."]
      ],
      "자유지향": [
        ["매일 아침, 오늘 지킬 한 가지 자기 {{compassKw}}을(를) 한 줄 메모합니다.","대화 중 내 {{compassKw}}이(가) 흔들렸는지 1개 받아 적습니다.","하루 끝, 내 {{compassKw}}대로 흐른 한 장면을 3줄로 기록합니다."],
        ["주 3회, 사람을 만나며 내 {{compassKw}}을(를) 한 문장으로 표현합니다.","{{primaryDomain}}의 일정 1개를 내 {{compassKw}} 기준으로 다시 짭니다.","내 {{compassKw}}을(를) 지지해 주는 1명에게 짧은 메시지를 보냅니다."],
        ["내 {{compassKw}}이(가) 살아나는 한 사람과 30분 깊이 대화를 진행합니다.","지난 3주간 내 {{compassKw}}이(가) 흐른 순간 3가지를 적고, 다음 달 한 호흡 약속을 정합니다.","\u2018{{visionHeadline}}\u2019으로 살기 위해 분기 자기 호흡 1개를 명문화합니다."]
      ]
    },
    principled_designer: {
      "원칙지향": [
        ["매일 아침, 오늘 지킬 한 가지 {{compassKw}}을(를) 한 줄로 새깁니다.","결정 직전, \u2018이것이 내 {{compassKw}}에 맞는가\u2019를 1줄 자문합니다.","하루 끝, {{compassKw}}이(가) 지켜진 한 장면을 3줄로 기록합니다."],
        ["주 3회, {{primaryDomain}}의 결정 1개를 {{compassKw}} 기준으로 다시 들여다봅니다.","내 {{compassKw}}을(를) 한 사람 앞에서 한 문장으로 명문화합니다.","\u2018{{missionHeadline}}\u2019이(가) 흔들렸던 순간 3가지를 적고 보완안을 1줄 정합니다."],
        ["{{compassKw}}을(를) 함께 지키는 한 사람과 30분 깊이 대화를 진행합니다.","지난 3주의 결정을 {{compassKw}} 기준으로 5줄 회고로 묶습니다.","\u2018{{visionHeadline}}\u2019으로 자라기 위한 분기 1원칙을 명문화합니다."]
      ],
      "관계지향": [
        ["매일 아침, 오늘 사람과 지킬 한 가지 {{compassKw}}을(를) 한 줄 메모합니다.","대화 중 내가 사람을 향해 {{compassKw}}을(를) 어떻게 지켰는지 1개 받아 적습니다.","하루 끝, 사람 곁에서 {{compassKw}}이(가) 지켜진 한 장면을 3줄로 기록합니다."],
        ["주 3회, 내 {{compassKw}}을(를) 한 사람에게 한 문장으로 표현합니다.","{{primaryDomain}}의 한 사람과의 약속을 {{compassKw}} 기준으로 점검합니다.","\u2018함께 지키고 싶은 {{compassKw}}\u2019을 가진 1명에게 짧은 메시지를 보냅니다."],
        ["{{compassKw}}을(를) 함께 지켜 온 한 사람과 30분 깊이 대화를 진행합니다.","지난 3주 사람 곁에서 지킨 {{compassKw}} 3가지를 적고 다음 달 한 약속을 정합니다.","\u2018{{visionHeadline}}\u2019으로 자라기 위해 곁의 1명과 분기 약속을 명문화합니다."]
      ],
      "성장지향": [
        ["매일 아침, 오늘 다듬을 한 가지 {{compassKw}}을(를) 한 줄 메모합니다.","결정 직전, 새로 길어 올린 {{compassKw}} 한 단어를 1개 받아 적습니다.","하루 끝, {{compassKw}}이(가) 한 뼘 자란 한 장면을 3줄로 기록합니다."],
        ["주 3회, {{primaryDomain}}에서 작은 실험 1개를 시도하고 한 문장 정리합니다.","내 {{compassKw}}을(를) 한 단계 깊게 만들어 줄 책·자료 1개를 매주 정합니다.","\u2018{{compassKw}}을(를) 함께 길어 올릴 1명\u2019에게 짧은 메시지를 보냅니다."],
        ["{{compassKw}}을(를) 함께 다듬는 한 사람과 30분 깊이 대화를 진행합니다.","지난 3주의 작은 실험을 {{compassKw}} 기준으로 5줄 회고로 묶습니다.","\u2018{{visionHeadline}}\u2019으로 자라기 위해 다음 분기 1실험을 명문화합니다."]
      ],
      "자유지향": [
        ["매일 아침, 오늘 지킬 한 가지 자기 {{compassKw}}을(를) 한 줄 메모합니다.","결정 직전, 내가 누구의 시선이 아니라 내 {{compassKw}}에 맞는가를 1줄 자문합니다.","하루 끝, 내 {{compassKw}}대로 흐른 한 장면을 3줄로 기록합니다."],
        ["주 3회, {{primaryDomain}}의 일정 1개를 내 {{compassKw}} 기준으로 다시 짭니다.","내 {{compassKw}}을(를) 한 사람 앞에서 한 문장으로 명문화합니다.","\u2018내 {{compassKw}}을(를) 지지해 주는 1명\u2019에게 짧은 메시지를 보냅니다."],
        ["내 {{compassKw}}이(가) 살아나는 한 사람과 30분 깊이 대화를 진행합니다.","지난 3주 내 {{compassKw}}이(가) 흐른 순간 3가지를 적고 다음 달 한 약속을 정합니다.","\u2018{{visionHeadline}}\u2019으로 살기 위해 분기 자기 호흡을 명문화합니다."]
      ]
    },
    visionary_creator: {
      "원칙지향": [
        ["매일 아침, 오늘 작품에 새길 한 가지 {{compassKw}}을(를) 한 줄 메모합니다.","착수 직전, \u2018이 작품이 내 {{compassKw}}에 맞는가\u2019를 1줄 자문합니다.","하루 끝, 작품에 {{compassKw}}이(가) 새겨진 한 장면을 3줄로 기록합니다."],
        ["주 3회, {{primaryDomain}}의 초안 1개를 {{compassKw}} 기준으로 한 호흡 다듬습니다.","내 {{compassKw}}을(를) 작품 한 줄 카피로 명문화합니다.","\u2018{{missionHeadline}}\u2019을(를) 함께 펼쳐 줄 1명에게 발행 초안을 공유합니다."],
        ["{{compassKw}}을(를) 함께 새기는 한 사람과 30분 깊이 대화를 진행합니다.","지난 3주 작품 결정을 {{compassKw}} 기준으로 5줄 회고로 묶습니다.","\u2018{{visionHeadline}}\u2019을(를) 향한 분기 작품 1개를 명문화합니다."]
      ],
      "관계지향": [
        ["매일 아침, 오늘 작품에 담을 한 사람의 {{compassKw}}을(를) 한 줄 메모합니다.","대화 중 사람의 {{compassKw}} 단어를 1개씩 받아 적어 작품 재료로 모읍니다.","하루 끝, 사람의 {{compassKw}}이(가) 작품에 스민 한 장면을 3줄로 기록합니다."],
        ["주 3회, {{primaryDomain}}의 초안을 한 사람에게 보여 주고 한 문장 피드백을 받습니다.","내가 만난 사람들의 {{compassKw}}을(를) 작품 카피 1줄로 묶습니다.","\u2018{{missionHeadline}}\u2019을(를) 함께 펼쳐 줄 3명에게 발행 초안을 공유합니다."],
        ["{{compassKw}}이(가) 살아나는 한 사람과 30분 깊이 대화를 진행합니다.","지난 3주 사람에게서 길어 올린 {{compassKw}}을(를) 5줄 회고로 묶습니다.","\u2018{{visionHeadline}}\u2019을(를) 향한 분기 작품을 사람 곁에서 명문화합니다."]
      ],
      "성장지향": [
        ["매일 아침, 오늘 작품에 길어 올릴 한 가지 {{compassKw}}을(를) 한 줄 메모합니다.","착수 직전, 새로 만난 {{compassKw}} 단어 1개를 받아 적습니다.","하루 끝, 작품에 {{compassKw}}이(가) 한 뼘 자란 한 장면을 3줄로 기록합니다."],
        ["주 3회, {{primaryDomain}}의 초안 1개를 빠르게 마감해 발행합니다.","내 {{compassKw}}을(를) 한 단계 깊게 만들어 줄 자료 1개를 매주 정합니다.","\u2018{{missionHeadline}}\u2019을(를) 함께 길어 올릴 1명에게 발행 초안을 공유합니다."],
        ["{{compassKw}}을(를) 함께 길어 올리는 한 사람과 30분 깊이 대화를 진행합니다.","지난 3주 발행을 {{compassKw}} 기준으로 5줄 회고로 묶습니다.","\u2018{{visionHeadline}}\u2019을(를) 향한 분기 발행 1개를 명문화합니다."]
      ],
      "자유지향": [
        ["매일 아침, 오늘 작품에 담을 자기 {{compassKw}}을(를) 한 줄 메모합니다.","착수 직전, 내가 시류가 아니라 내 {{compassKw}}에 맞는가를 1줄 자문합니다.","하루 끝, 내 {{compassKw}}대로 흐른 작품 한 장면을 3줄로 기록합니다."],
        ["주 3회, {{primaryDomain}}의 초안 1개를 내 {{compassKw}} 호흡대로 다듬습니다.","내 {{compassKw}}을(를) 작품 한 줄 카피로 명문화합니다.","\u2018{{missionHeadline}}\u2019을(를) 지지해 주는 1명에게 발행 초안을 공유합니다."],
        ["내 {{compassKw}}이(가) 살아나는 한 사람과 30분 깊이 대화를 진행합니다.","지난 3주 내 {{compassKw}}대로 흐른 작품 3가지를 적고 다음 달 한 발행을 정합니다.","\u2018{{visionHeadline}}\u2019으로 살기 위해 분기 자기 호흡 작품 1개를 명문화합니다."]
      ]
    },
    pragmatic_achiever: {
      "원칙지향": [
        ["매일 아침, 오늘 끝낼 1개의 {{compassKw}} 결과를 한 줄로 정합니다.","결정 직전, \u2018이 결과가 내 {{compassKw}}에 맞는가\u2019를 1줄 자문합니다.","하루 끝, {{compassKw}}대로 마무리된 한 장면을 3줄로 기록합니다."],
        ["주 3회, {{primaryDomain}}의 KPI 1개를 {{compassKw}} 기준으로 점검합니다.","내 {{compassKw}}을(를) 결과 한 줄 카피로 명문화합니다.","\u2018{{missionHeadline}}\u2019을(를) 함께 결과로 만들 1명에게 짧은 메시지를 보냅니다."],
        ["{{compassKw}}을(를) 함께 지키는 한 사람과 30분 깊이 대화를 진행합니다.","지난 3주의 결과를 {{compassKw}} 기준으로 5줄 회고로 묶습니다.","\u2018{{visionHeadline}}\u2019을(를) 향한 분기 핵심 결과 1개를 명문화합니다."]
      ],
      "관계지향": [
        ["매일 아침, 오늘 한 사람과 함께 끝낼 한 가지 {{compassKw}} 결과를 한 줄로 정합니다.","대화 중 사람과 합의한 {{compassKw}} 한 단어를 1개 받아 적습니다.","하루 끝, 사람과 함께 {{compassKw}}이(가) 마무리된 한 장면을 3줄로 기록합니다."],
        ["주 3회, {{primaryDomain}}의 한 사람과의 약속 1개를 끝까지 챙깁니다.","내 {{compassKw}}을(를) 한 사람 앞에서 결과 한 줄로 명문화합니다.","\u2018{{missionHeadline}}\u2019을(를) 함께 만들 3명에게 짧은 메시지를 보냅니다."],
        ["{{compassKw}}을(를) 함께 끝낸 한 사람과 30분 깊이 대화를 진행합니다.","지난 3주 사람과 함께 마무리한 {{compassKw}} 3가지를 적고 다음 달 약속 1개를 정합니다.","\u2018{{visionHeadline}}\u2019을(를) 향한 분기 약속을 사람 곁에서 명문화합니다."]
      ],
      "성장지향": [
        ["매일 아침, 오늘 끝낼 1개의 {{compassKw}} 실험을 한 줄로 정합니다.","결정 직전, 새로 길어 올린 {{compassKw}} 단어 1개를 받아 적습니다.","하루 끝, {{compassKw}}이(가) 한 뼘 자란 결과 한 장면을 3줄로 기록합니다."],
        ["주 3회, {{primaryDomain}}의 작은 실험 1개를 끝까지 마무리합니다.","내 {{compassKw}}을(를) 결과 한 줄로 명문화합니다.","\u2018{{missionHeadline}}\u2019을(를) 함께 길어 올릴 1명에게 짧은 메시지를 보냅니다."],
        ["{{compassKw}}을(를) 함께 마무리한 한 사람과 30분 깊이 대화를 진행합니다.","지난 3주의 실험을 {{compassKw}} 기준으로 5줄 회고로 묶습니다.","\u2018{{visionHeadline}}\u2019을(를) 향한 분기 핵심 실험 1개를 명문화합니다."]
      ],
      "자유지향": [
        ["매일 아침, 오늘 내 호흡으로 끝낼 1개의 {{compassKw}} 결과를 한 줄로 정합니다.","결정 직전, 내가 누구의 속도가 아니라 내 {{compassKw}}에 맞는가를 1줄 자문합니다.","하루 끝, 내 {{compassKw}}대로 마무리된 한 장면을 3줄로 기록합니다."],
        ["주 3회, {{primaryDomain}}의 일정 1개를 내 {{compassKw}} 기준으로 다시 짭니다.","내 {{compassKw}}을(를) 결과 한 줄로 명문화합니다.","\u2018{{missionHeadline}}\u2019을(를) 지지해 주는 1명에게 짧은 메시지를 보냅니다."],
        ["내 {{compassKw}}이(가) 살아나는 한 사람과 30분 깊이 대화를 진행합니다.","지난 3주 내 호흡대로 마무리된 결과 3가지를 적고 다음 달 약속을 정합니다.","\u2018{{visionHeadline}}\u2019으로 살기 위해 분기 자기 호흡 결과 1개를 명문화합니다."]
      ]
    },
    reflective_explorer: {
      "원칙지향": [
        ["매일 아침, 오늘 다듬을 한 가지 {{compassKw}} 질문을 한 줄로 정합니다.","사색 중 내 {{compassKw}} 기준이 흔들렸는지 1개 받아 적습니다.","하루 끝, {{compassKw}}이(가) 다듬어진 한 장면을 3줄로 기록합니다."],
        ["주 3회, {{primaryDomain}}의 작은 실험 1개를 {{compassKw}} 기준으로 정리합니다.","내 {{compassKw}}을(를) 한 줄 질문으로 명문화합니다.","\u2018{{missionHeadline}}\u2019을(를) 함께 다듬어 줄 1명에게 한 줄 질문을 보냅니다."],
        ["{{compassKw}}을(를) 함께 다듬는 한 사람과 30분 깊이 대화를 진행합니다.","지난 3주 사색을 {{compassKw}} 기준으로 5줄 회고로 묶습니다.","\u2018{{visionHeadline}}\u2019을(를) 향한 분기 한 질문을 명문화합니다."]
      ],
      "관계지향": [
        ["매일 아침, 오늘 한 사람의 {{compassKw}}을(를) 사색할 질문 한 줄을 정합니다.","대화 중 사람의 {{compassKw}} 단어를 1개씩 받아 적습니다.","하루 끝, 사람의 {{compassKw}}이(가) 머문 한 장면을 3줄로 기록합니다."],
        ["주 3회, {{primaryDomain}}의 한 사람과 작은 사색 메시지를 1개 주고받습니다.","내가 만난 사람들의 {{compassKw}}을(를) 한 줄 질문으로 묶습니다.","\u2018{{missionHeadline}}\u2019을(를) 함께 사색해 줄 3명에게 한 줄 질문을 보냅니다."],
        ["{{compassKw}}이(가) 살아나는 한 사람과 30분 깊이 대화를 진행합니다.","지난 3주 사람에게서 길어 올린 {{compassKw}}을(를) 5줄 회고로 묶습니다.","\u2018{{visionHeadline}}\u2019을(를) 향한 분기 한 질문을 사람 곁에서 명문화합니다."]
      ],
      "성장지향": [
        ["매일 아침, 오늘 길어 올릴 한 가지 {{compassKw}} 질문을 한 줄로 정합니다.","사색 중 새로 만난 {{compassKw}} 단어를 1개 받아 적습니다.","하루 끝, 오늘 가장 {{compassKw}}이(가) 자란 한 장면을 3줄로 기록합니다."],
        ["주 3회, {{primaryDomain}}의 작은 실험 1개를 끝까지 사색합니다.","내 {{compassKw}}을(를) 한 줄 질문으로 명문화합니다.","\u2018{{missionHeadline}}\u2019을(를) 함께 길어 올릴 1명에게 한 줄 질문을 보냅니다."],
        ["{{compassKw}}을(를) 함께 길어 올리는 한 사람과 30분 깊이 대화를 진행합니다.","지난 3주의 사색을 {{compassKw}} 기준으로 5줄 회고로 묶습니다.","\u2018{{visionHeadline}}\u2019을(를) 향한 분기 한 실험을 명문화합니다."]
      ],
      "자유지향": [
        ["매일 아침, 오늘 사색할 자기 {{compassKw}} 질문을 한 줄로 정합니다.","사색 중 내 {{compassKw}}이(가) 흔들렸는지 1개 받아 적습니다.","하루 끝, 내 {{compassKw}}대로 흐른 한 장면을 3줄로 기록합니다."],
        ["주 3회, {{primaryDomain}}의 일정 1개를 내 {{compassKw}} 기준으로 사색합니다.","내 {{compassKw}}을(를) 한 줄 질문으로 명문화합니다.","\u2018{{missionHeadline}}\u2019을(를) 지지해 주는 1명에게 한 줄 질문을 보냅니다."],
        ["내 {{compassKw}}이(가) 살아나는 한 사람과 30분 깊이 대화를 진행합니다.","지난 3주 내 호흡대로 흐른 사색 3가지를 적고 다음 달 한 질문을 정합니다.","\u2018{{visionHeadline}}\u2019으로 살기 위해 분기 자기 호흡 질문 1개를 명문화합니다."]
      ]
    }
  };

  // [2] 3개월 × 3목표 — 톤 × Compass
  var L3_MONTH3_GOAL_KO = {
    warm_connector: {
      "관계지향": [{title:"{{compassKw}} 루틴 정착",criterion:"주 3회 {{compassKw}} 메시지 + 월 1회 깊은 대화"},{title:"신뢰 네트워크 가시화",criterion:"{{primaryDomain}}의 {{compassKw}} 네트워크 1장 정리 (15명)"},{title:"감정 표현 안전지대 확장",criterion:"{{compassKw}} 일기 10건 이상 누적"}],
      "원칙지향": [{title:"{{compassKw}} 약속 정착",criterion:"주 3회 사람과의 {{compassKw}} 약속 1줄 기록"},{title:"신뢰 약속 가시화",criterion:"{{primaryDomain}}의 {{compassKw}} 약속 5건 명문화"},{title:"한결같음 자산화",criterion:"3개월 어긋나지 않은 {{compassKw}} 약속 10건"}],
      "성장지향": [{title:"{{compassKw}} 만남 루틴 정착",criterion:"주 3회 사람과 만나며 {{compassKw}} 한 줄 기록"},{title:"관계 기반 학습 가시화",criterion:"{{primaryDomain}}에서 길어 올린 {{compassKw}} 5건"},{title:"한 뼘 깊이 자산화",criterion:"3개월 {{compassKw}} 깊이 대화 12회"}],
      "자유지향": [{title:"내 {{compassKw}} 호흡 정착",criterion:"주 3회 사람을 만나며 내 {{compassKw}} 한 줄 표현"},{title:"자기 호흡 관계 가시화",criterion:"{{primaryDomain}}에서 내 {{compassKw}}이(가) 살아난 5건"},{title:"휘둘리지 않는 색 자산화",criterion:"3개월 내 {{compassKw}} 일기 30건"}]
    },
    principled_designer: {
      "원칙지향": [{title:"{{compassKw}} 1원칙 정착",criterion:"주 3회 결정 직전 {{compassKw}} 자문 기록"},{title:"의사결정 가시화",criterion:"{{primaryDomain}}의 {{compassKw}} 결정 5건 명문화"},{title:"한 길 자산화",criterion:"3개월 {{compassKw}} 회고 12건 누적"}],
      "관계지향": [{title:"사람과의 {{compassKw}} 약속 정착",criterion:"주 3회 한 사람 앞에서 {{compassKw}} 한 문장 기록"},{title:"곁의 신뢰 가시화",criterion:"{{primaryDomain}}의 {{compassKw}} 곁사람 5명 정리"},{title:"한결같음 자산화",criterion:"3개월 어긋나지 않은 약속 10건"}],
      "성장지향": [{title:"{{compassKw}} 다듬기 루틴 정착",criterion:"주 3회 새로 만난 {{compassKw}} 한 줄 기록"},{title:"기준 깊이 가시화",criterion:"{{primaryDomain}}의 작은 실험 5건 정리"},{title:"깊이 자산화",criterion:"3개월 {{compassKw}} 회고 12건 누적"}],
      "자유지향": [{title:"자기 {{compassKw}} 1원칙 정착",criterion:"주 3회 내 {{compassKw}} 자문 기록"},{title:"자기 호흡 결정 가시화",criterion:"{{primaryDomain}}에서 내 {{compassKw}}대로 한 결정 5건"},{title:"또렷한 자기 색 자산화",criterion:"3개월 자기 호흡 일기 30건"}]
    },
    visionary_creator: {
      "원칙지향": [{title:"{{compassKw}} 작품 카피 정착",criterion:"주 3회 작품 결정 직전 {{compassKw}} 자문"},{title:"{{primaryDomain}} 작품 가시화",criterion:"{{compassKw}} 기준 발행 5건"},{title:"색 잃지 않는 작품 자산화",criterion:"3개월 {{compassKw}} 회고 12건"}],
      "관계지향": [{title:"사람과 함께 펼치는 {{compassKw}} 정착",criterion:"주 3회 사람의 {{compassKw}} 단어 1개 수집"},{title:"{{compassKw}} 작품 가시화",criterion:"{{primaryDomain}} 발행 5건 (사람 카피)"},{title:"{{compassKw}}을(를) 펼친 작품 자산화",criterion:"3개월 사람 곁 발행 12건"}],
      "성장지향": [{title:"{{compassKw}} 길어 올리는 작품 정착",criterion:"주 3회 작품 한 호흡 다듬기 기록"},{title:"새 색 가시화",criterion:"{{primaryDomain}} 발행 5건 (실험 카피)"},{title:"자라는 작품 자산화",criterion:"3개월 작품 회고 12건"}],
      "자유지향": [{title:"자기 호흡 작품 정착",criterion:"주 3회 내 {{compassKw}} 호흡대로 다듬기 기록"},{title:"새 길 가시화",criterion:"{{primaryDomain}} 발행 5건 (자기 호흡 카피)"},{title:"자기 색 작품 자산화",criterion:"3개월 자기 호흡 발행 12건"}]
    },
    pragmatic_achiever: {
      "원칙지향": [{title:"{{compassKw}} 결과 1순위 정착",criterion:"주 3회 끝낼 결과 1줄 기록"},{title:"KPI 가시화",criterion:"{{primaryDomain}}의 {{compassKw}} KPI 5건 명문화"},{title:"끝맺음 자산화",criterion:"3개월 마감된 결과 10건"}],
      "관계지향": [{title:"사람과의 {{compassKw}} 결과 정착",criterion:"주 3회 사람과의 {{compassKw}} 약속 마감 기록"},{title:"신뢰 결과 가시화",criterion:"{{primaryDomain}}의 함께한 {{compassKw}} 결과 5건"},{title:"신뢰 결과 자산화",criterion:"3개월 사람과 마감한 결과 10건"}],
      "성장지향": [{title:"{{compassKw}} 실험 결과 정착",criterion:"주 3회 끝낸 실험 1줄 기록"},{title:"성장 결과 가시화",criterion:"{{primaryDomain}}의 {{compassKw}} 실험 결과 5건"},{title:"답하는 결과 자산화",criterion:"3개월 마감된 실험 10건"}],
      "자유지향": [{title:"자기 호흡 결과 정착",criterion:"주 3회 내 {{compassKw}}대로 끝낸 결과 1줄 기록"},{title:"내 속도 결과 가시화",criterion:"{{primaryDomain}}의 자기 호흡 결과 5건"},{title:"흐트러짐 없는 결과 자산화",criterion:"3개월 마감된 자기 호흡 결과 10건"}]
    },
    reflective_explorer: {
      "원칙지향": [{title:"{{compassKw}} 사색 루틴 정착",criterion:"주 3회 한 줄 질문 기록"},{title:"기준 깊이 가시화",criterion:"{{primaryDomain}}의 {{compassKw}} 사색 5건"},{title:"한 길 자산화",criterion:"3개월 사색 회고 12건"}],
      "관계지향": [{title:"사람과의 {{compassKw}} 사색 정착",criterion:"주 3회 사람의 {{compassKw}} 한 줄 질문"},{title:"곁의 사색 가시화",criterion:"{{primaryDomain}}의 사람 곁 사색 5건"},{title:"사람 길 자산화",criterion:"3개월 사람 곁 사색 12건"}],
      "성장지향": [{title:"{{compassKw}} 길어 올리는 사색 정착",criterion:"주 3회 한 줄 질문 기록"},{title:"새 길 가시화",criterion:"{{primaryDomain}}의 작은 실험 5건"},{title:"답이 되는 길 자산화",criterion:"3개월 사색 회고 12건"}],
      "자유지향": [{title:"자기 호흡 사색 정착",criterion:"주 3회 내 {{compassKw}} 한 줄 질문"},{title:"내 길 가시화",criterion:"{{primaryDomain}}의 자기 호흡 사색 5건"},{title:"또렷한 자기 길 자산화",criterion:"3개월 자기 호흡 사색 12건"}]
    }
  };

  // [3] 주간 점검 3항목 — 톤 × Compass
  var L3_TRACK_WEEKLY_KO = {
    warm_connector: {
      "관계지향": ["{{compassKw}} 메시지가 주 3회 이상이었는가","사람의 {{compassKw}} 단어를 받아 적었는가","마음이 머문 한 장면을 기록했는가"],
      "원칙지향": ["사람과의 {{compassKw}} 약속이 어긋나지 않았는가","흔들린 순간을 1개 적었는가","{{compassKw}}이(가) 지켜진 장면을 기록했는가"],
      "성장지향": ["사람에게서 길어 올린 {{compassKw}} 단어를 모았는가","작은 실험 1개를 시도했는가","한 뼘 자란 장면을 기록했는가"],
      "자유지향": ["내 {{compassKw}}을(를) 한 문장으로 표현했는가","사람 앞에서 휘둘리지 않았는가","내 호흡대로 흐른 장면을 기록했는가"]
    },
    principled_designer: {
      "원칙지향": ["결정 직전 {{compassKw}} 자문을 했는가","흔들린 순간을 1개 적었는가","{{compassKw}}이(가) 지켜진 장면을 기록했는가"],
      "관계지향": ["사람과의 {{compassKw}} 약속이 어긋나지 않았는가","곁의 한 사람에게 한 문장 표현했는가","한결같이 머문 장면을 기록했는가"],
      "성장지향": ["새 {{compassKw}} 단어를 1개 모았는가","작은 실험 1개를 시도했는가","한 뼘 자란 장면을 기록했는가"],
      "자유지향": ["내 {{compassKw}} 자문을 했는가","누구의 시선이 아니라 내 호흡으로 결정했는가","내 호흡대로 흐른 장면을 기록했는가"]
    },
    visionary_creator: {
      "원칙지향": ["작품 결정 직전 {{compassKw}} 자문을 했는가","초안을 한 호흡 다듬었는가","작품에 {{compassKw}}이(가) 새겨진 장면을 기록했는가"],
      "관계지향": ["사람의 {{compassKw}} 단어를 작품 재료로 모았는가","초안을 한 사람에게 보여 줬는가","작품에 {{compassKw}}이(가) 스민 장면을 기록했는가"],
      "성장지향": ["새 {{compassKw}} 단어를 작품에 시도했는가","빠르게 마감해 발행했는가","한 뼘 자란 작품 장면을 기록했는가"],
      "자유지향": ["내 {{compassKw}} 호흡대로 다듬었는가","시류가 아니라 내 색을 따랐는가","내 호흡대로 흐른 작품 장면을 기록했는가"]
    },
    pragmatic_achiever: {
      "원칙지향": ["오늘 끝낼 결과 1개를 정했는가","결정 직전 {{compassKw}} 자문을 했는가","{{compassKw}}대로 마무리된 장면을 기록했는가"],
      "관계지향": ["사람과의 {{compassKw}} 약속을 끝까지 챙겼는가","함께 마무리한 결과를 기록했는가","사람 곁에서 끝낸 장면을 기록했는가"],
      "성장지향": ["오늘 끝낼 실험 1개를 정했는가","새 {{compassKw}} 단어를 결과에 담았는가","한 뼘 자란 결과 장면을 기록했는가"],
      "자유지향": ["내 호흡으로 끝낼 결과 1개를 정했는가","누구의 속도가 아니라 내 {{compassKw}}을(를) 따랐는가","내 호흡대로 마무리된 장면을 기록했는가"]
    },
    reflective_explorer: {
      "원칙지향": ["오늘 다듬을 한 줄 질문을 정했는가","흔들린 기준을 1개 적었는가","사색이 다듬어진 장면을 기록했는가"],
      "관계지향": ["사람의 {{compassKw}} 단어를 받아 적었는가","사람과 사색 메시지를 1개 주고받았는가","사람의 {{compassKw}}이(가) 머문 장면을 기록했는가"],
      "성장지향": ["새 {{compassKw}} 단어를 1개 모았는가","작은 실험 1개를 끝까지 사색했는가","한 뼘 자란 사색 장면을 기록했는가"],
      "자유지향": ["내 {{compassKw}} 한 줄 질문을 정했는가","흔들린 호흡을 1개 적었는가","내 호흡대로 흐른 사색을 기록했는가"]
    }
  };

  // [4] 월간 점검 3항목 — 톤 × Compass
  var L3_TRACK_MONTHLY_KO = {
    warm_connector: {
      "관계지향": ["{{compassKw}} 깊이 대화를 1회 이상 진행했는가","신뢰 네트워크 노트가 갱신되고 있는가","{{compassKw}} 일기가 누적되고 있는가"],
      "원칙지향": ["사람과의 {{compassKw}} 약속이 누적되고 있는가","어긋나지 않은 약속이 늘고 있는가","한결같이 머문 장면이 누적되고 있는가"],
      "성장지향": ["{{compassKw}} 한 뼘 깊이 대화가 누적되고 있는가","길어 올린 {{compassKw}} 단어 노트가 갱신되고 있는가","작은 실험 노트가 쌓이고 있는가"],
      "자유지향": ["내 {{compassKw}}이(가) 살아난 장면이 누적되고 있는가","휘둘리지 않은 결정 노트가 갱신되고 있는가","자기 호흡 일기가 쌓이고 있는가"]
    },
    principled_designer: {
      "원칙지향": ["{{compassKw}} 결정 회고가 누적되고 있는가","원칙 노트가 갱신되고 있는가","한 길 일기가 쌓이고 있는가"],
      "관계지향": ["곁의 {{compassKw}} 약속 노트가 갱신되고 있는가","어긋나지 않은 약속이 누적되고 있는가","한결같음 일기가 쌓이고 있는가"],
      "성장지향": ["{{compassKw}} 깊이 회고가 누적되고 있는가","새로 만난 {{compassKw}} 단어 노트가 갱신되고 있는가","작은 실험 일기가 쌓이고 있는가"],
      "자유지향": ["내 {{compassKw}} 결정 회고가 누적되고 있는가","자기 호흡 노트가 갱신되고 있는가","또렷한 자기 색 일기가 쌓이고 있는가"]
    },
    visionary_creator: {
      "원칙지향": ["{{compassKw}} 작품 회고가 누적되고 있는가","발행 노트가 갱신되고 있는가","색 잃지 않은 작품 일기가 쌓이고 있는가"],
      "관계지향": ["사람의 {{compassKw}} 단어 모음이 갱신되고 있는가","사람 곁 발행 회고가 누적되고 있는가","{{compassKw}} 작품 일기가 쌓이고 있는가"],
      "성장지향": ["새 {{compassKw}} 작품 회고가 누적되고 있는가","빠른 마감 노트가 갱신되고 있는가","자라는 작품 일기가 쌓이고 있는가"],
      "자유지향": ["내 {{compassKw}} 호흡 작품 회고가 누적되고 있는가","자기 색 노트가 갱신되고 있는가","자기 호흡 작품 일기가 쌓이고 있는가"]
    },
    pragmatic_achiever: {
      "원칙지향": ["{{compassKw}} 결과 회고가 누적되고 있는가","KPI 노트가 갱신되고 있는가","끝맺음 일기가 쌓이고 있는가"],
      "관계지향": ["사람과 함께 마감한 결과가 누적되고 있는가","약속 노트가 갱신되고 있는가","신뢰 결과 일기가 쌓이고 있는가"],
      "성장지향": ["{{compassKw}} 실험 결과가 누적되고 있는가","실험 노트가 갱신되고 있는가","답하는 결과 일기가 쌓이고 있는가"],
      "자유지향": ["내 {{compassKw}}대로 마감된 결과가 누적되고 있는가","자기 속도 노트가 갱신되고 있는가","흐트러짐 없는 결과 일기가 쌓이고 있는가"]
    },
    reflective_explorer: {
      "원칙지향": ["{{compassKw}} 사색 회고가 누적되고 있는가","질문 노트가 갱신되고 있는가","한 길 사색 일기가 쌓이고 있는가"],
      "관계지향": ["사람의 {{compassKw}} 사색이 누적되고 있는가","사람 곁 질문 노트가 갱신되고 있는가","사람 길 사색 일기가 쌓이고 있는가"],
      "성장지향": ["새 {{compassKw}} 질문이 누적되고 있는가","작은 실험 사색 노트가 갱신되고 있는가","답이 되는 길 일기가 쌓이고 있는가"],
      "자유지향": ["내 {{compassKw}} 사색이 누적되고 있는가","자기 호흡 질문 노트가 갱신되고 있는가","또렷한 자기 길 일기가 쌓이고 있는가"]
    }
  };

  // [5] 다음 단계 (m1/m3/y1) — 톤별 (mission/vision 결합)
  var L3_NEXTSTEPS_KO = {
    warm_connector: { m1:"\u2018{{missionHeadline}}\u2019에 가까워지기 위해 {{compassKw}} 메시지 루틴 1개를 시작합니다.", m3:"{{primaryDomain}}에서 {{compassKw}} 깊이 대화 3건을 분기 결과로 확보합니다.", y1:"1년 뒤, \u2018{{visionHeadline}}\u2019으로 자리잡도록 {{compassKw}} 네트워크 1장을 완성합니다." },
    principled_designer: { m1:"\u2018{{missionHeadline}}\u2019에 가까워지기 위해 {{compassKw}} 1원칙 자문 루틴을 시작합니다.", m3:"{{primaryDomain}}의 {{compassKw}} 결정 5건을 분기 결과로 명문화합니다.", y1:"1년 뒤, \u2018{{visionHeadline}}\u2019으로 자리잡도록 한 길 회고집 1권을 완성합니다." },
    visionary_creator: { m1:"\u2018{{missionHeadline}}\u2019에 가까워지기 위해 {{compassKw}} 작품 한 줄 카피를 시작합니다.", m3:"{{primaryDomain}}의 {{compassKw}} 발행 3건을 분기 결과로 확보합니다.", y1:"1년 뒤, \u2018{{visionHeadline}}\u2019으로 자리잡도록 자기 색 작품집 1권을 완성합니다." },
    pragmatic_achiever: { m1:"\u2018{{missionHeadline}}\u2019에 가까워지기 위해 {{compassKw}} 결과 1순위 루틴을 시작합니다.", m3:"{{primaryDomain}}의 {{compassKw}} KPI 1개를 분기 결과로 마감합니다.", y1:"1년 뒤, \u2018{{visionHeadline}}\u2019으로 자리잡도록 결과 포트폴리오 1쪽을 완성합니다." },
    reflective_explorer: { m1:"\u2018{{missionHeadline}}\u2019에 가까워지기 위해 {{compassKw}} 한 줄 질문 루틴을 시작합니다.", m3:"{{primaryDomain}}의 {{compassKw}} 사색 회고 3건을 분기 결과로 확보합니다.", y1:"1년 뒤, \u2018{{visionHeadline}}\u2019으로 자리잡도록 자기 길 사색집 1권을 완성합니다." }
  };
  var L3_NEXTSTEPS_EN = {
    warm_connector: { m1:"Begin one routine of {{compassKw}} messages to move closer to \u2018{{missionHeadline}}\u2019.", m3:"Secure three {{compassKw}} deep conversations in {{primaryDomain}} as the quarter\u2019s result.", y1:"Complete a one-page {{compassKw}} network so that one year on you stand as \u2018{{visionHeadline}}\u2019." },
    principled_designer: { m1:"Begin a {{compassKw}} principle-question routine to move closer to \u2018{{missionHeadline}}\u2019.", m3:"Articulate five {{compassKw}} decisions in {{primaryDomain}} as the quarter\u2019s result.", y1:"Complete a one-volume retrospective on one steady line so that one year on you stand as \u2018{{visionHeadline}}\u2019." },
    visionary_creator: { m1:"Begin a {{compassKw}} one-line work copy to move closer to \u2018{{missionHeadline}}\u2019.", m3:"Ship three {{compassKw}} publications in {{primaryDomain}} as the quarter\u2019s result.", y1:"Complete a one-volume works index in your color so that one year on you stand as \u2018{{visionHeadline}}\u2019." },
    pragmatic_achiever: { m1:"Begin a {{compassKw}} result-first routine to move closer to \u2018{{missionHeadline}}\u2019.", m3:"Close one {{compassKw}} KPI in {{primaryDomain}} as the quarter\u2019s result.", y1:"Complete a one-page result portfolio so that one year on you stand as \u2018{{visionHeadline}}\u2019." },
    reflective_explorer: { m1:"Begin a {{compassKw}} one-line-question routine to move closer to \u2018{{missionHeadline}}\u2019.", m3:"Secure three {{compassKw}} reflection retrospectives in {{primaryDomain}} as the quarter\u2019s result.", y1:"Complete a one-volume reflection book on your own path so that one year on you stand as \u2018{{visionHeadline}}\u2019." }
  };

  // [6] 모듈 summary — 톤별 3개 (사명·비전 결로 재합성)
  var L3_MODULE_SUMMARY_KO = {
    warm_connector: ["\u2018{{missionHeadline}}\u2019의 결을 매주 한 호흡으로 옮기는 {{compassKw}} 장치입니다.","내 {{compassKw}}을(를) 안전하게 외화하는 첫 그릇입니다.","{{primaryDomain}}의 {{compassKw}}을(를) 분기 단위 자산으로 관리하는 구조입니다."],
    principled_designer: ["\u2018{{missionHeadline}}\u2019을(를) 한 길로 옮기는 {{compassKw}} 자문 장치입니다.","내 {{compassKw}}을(를) 결정 직전 다시 새기는 한 호흡 그릇입니다.","{{primaryDomain}}의 {{compassKw}}을(를) 분기 회고로 관리하는 구조입니다."],
    visionary_creator: ["\u2018{{missionHeadline}}\u2019을(를) 작품 한 줄 카피로 옮기는 {{compassKw}} 장치입니다.","내 {{compassKw}}을(를) 발행으로 외화하는 첫 그릇입니다.","{{primaryDomain}}의 {{compassKw}} 작품을 분기 인덱스로 관리하는 구조입니다."],
    pragmatic_achiever: ["\u2018{{missionHeadline}}\u2019을(를) 매주 결과로 옮기는 {{compassKw}} 1순위 장치입니다.","내 {{compassKw}}을(를) KPI로 외화하는 첫 그릇입니다.","{{primaryDomain}}의 {{compassKw}} 결과를 분기 포트폴리오로 관리하는 구조입니다."],
    reflective_explorer: ["\u2018{{missionHeadline}}\u2019을(를) 한 줄 질문으로 옮기는 {{compassKw}} 사색 장치입니다.","내 {{compassKw}}을(를) 작은 실험으로 외화하는 첫 그릇입니다.","{{primaryDomain}}의 {{compassKw}} 사색을 분기 회고로 관리하는 구조입니다."]
  };

  // [7] 분기 리드 3줄 — 톤 × Compass
  var L3_QUARTER_PARAS_KO = {
    warm_connector: {
      "관계지향": ["이미 {{name}}님은 사람을 향한 {{compassKw}}을(를) 충분히 품고 있습니다.","이번 분기는 그 {{compassKw}}을(를) \u2018듣기 → 표현 → 관계 자산화\u2019로 구조화하는 시간입니다.","{{primaryDomain}}에서 마음이 흐르는 자리에 작은 루틴 하나가 놓이면 신뢰는 다른 속도로 쌓입니다."],
      "원칙지향": ["이미 {{name}}님은 사람과의 {{compassKw}} 약속을 한결같이 지키고 있습니다.","이번 분기는 그 {{compassKw}}을(를) \u2018약속 → 한결같음 → 신뢰 자산화\u2019로 구조화하는 시간입니다.","{{primaryDomain}}에서 어긋나지 않는 약속이 한 칸씩 쌓일 때 신뢰는 한 길로 굳어집니다."],
      "성장지향": ["이미 {{name}}님은 만나는 사람마다 {{compassKw}}을(를) 한 뼘씩 길어 올리고 있습니다.","이번 분기는 그 {{compassKw}}을(를) \u2018만남 → 길어 올림 → 깊이 자산화\u2019로 구조화하는 시간입니다.","{{primaryDomain}}에서 한 사람과의 깊은 한 호흡이 분기마다 한 단계의 자라남을 만듭니다."],
      "자유지향": ["이미 {{name}}님은 사람 곁에서도 자기 {{compassKw}}을(를) 또렷이 지키고 있습니다.","이번 분기는 그 {{compassKw}}을(를) \u2018함께 → 호흡 지킴 → 자기 색 자산화\u2019로 구조화하는 시간입니다.","{{primaryDomain}}에서 휘둘리지 않는 한 호흡이 다른 결의 신뢰를 만듭니다."]
    },
    principled_designer: {
      "원칙지향": ["이미 {{name}}님은 결정 직전 {{compassKw}}을(를) 한 길로 새기고 있습니다.","이번 분기는 그 {{compassKw}}을(를) \u2018자문 → 결정 → 한 길 자산화\u2019로 구조화하는 시간입니다.","{{primaryDomain}}에서 흔들리지 않는 결정이 한 칸씩 쌓일 때 원칙은 자기 결로 흐릅니다."],
      "관계지향": ["이미 {{name}}님은 곁의 사람과 {{compassKw}}을(를) 한결같이 지키고 있습니다.","이번 분기는 그 {{compassKw}}을(를) \u2018곁의 약속 → 한결같음 → 신뢰 자산화\u2019로 구조화하는 시간입니다.","{{primaryDomain}}에서 사람 곁의 어긋나지 않는 약속이 한 길의 신뢰를 만듭니다."],
      "성장지향": ["이미 {{name}}님은 매일 새로 만난 {{compassKw}}을(를) 한 줄로 다듬고 있습니다.","이번 분기는 그 {{compassKw}}을(를) \u2018다듬기 → 깊이 → 자기 자산화\u2019로 구조화하는 시간입니다.","{{primaryDomain}}에서 한 작은 실험이 분기마다 한 단계 깊이를 만듭니다."],
      "자유지향": ["이미 {{name}}님은 누구의 시선이 아니라 자기 {{compassKw}}대로 결정하고 있습니다.","이번 분기는 그 {{compassKw}}을(를) \u2018자문 → 자기 호흡 → 자기 색 자산화\u2019로 구조화하는 시간입니다.","{{primaryDomain}}에서 또렷한 자기 호흡이 다른 결의 길을 만듭니다."]
    },
    visionary_creator: {
      "원칙지향": ["이미 {{name}}님은 작품 결정마다 {{compassKw}}을(를) 한 결로 새기고 있습니다.","이번 분기는 그 {{compassKw}}을(를) \u2018초안 → 한 결 다듬기 → 작품 자산화\u2019로 구조화하는 시간입니다.","{{primaryDomain}}에서 색을 잃지 않는 발행이 한 칸씩 쌓일 때 작품은 자기 결로 굳어집니다."],
      "관계지향": ["이미 {{name}}님은 사람의 {{compassKw}}을(를) 작품 결로 끌어안고 있습니다.","이번 분기는 그 {{compassKw}}을(를) \u2018사람 듣기 → 작품 펼치기 → {{compassKw}} 자산화\u2019로 구조화하는 시간입니다.","{{primaryDomain}}에서 한 사람의 {{compassKw}}이(가) 작품 한 줄로 옮겨질 때 새 결이 열립니다."],
      "성장지향": ["이미 {{name}}님은 작품마다 새 {{compassKw}}을(를) 길어 올리고 있습니다.","이번 분기는 그 {{compassKw}}을(를) \u2018초안 → 빠른 마감 → 자기 색 자산화\u2019로 구조화하는 시간입니다.","{{primaryDomain}}에서 한 발행이 분기마다 한 단계 자라는 작품을 만듭니다."],
      "자유지향": ["이미 {{name}}님은 시류가 아니라 자기 {{compassKw}} 호흡대로 작품을 다듬고 있습니다.","이번 분기는 그 {{compassKw}}을(를) \u2018초안 → 자기 호흡 → 새 길 자산화\u2019로 구조화하는 시간입니다.","{{primaryDomain}}에서 자기 색의 한 발행이 다른 결의 길을 엽니다."]
    },
    pragmatic_achiever: {
      "원칙지향": ["이미 {{name}}님은 결과 직전 {{compassKw}}을(를) 한 결로 새기고 있습니다.","이번 분기는 그 {{compassKw}}을(를) \u20181순위 → 마감 → 결과 자산화\u2019로 구조화하는 시간입니다.","{{primaryDomain}}에서 흐트러지지 않는 결과가 한 칸씩 쌓일 때 원칙은 결과로 증명됩니다."],
      "관계지향": ["이미 {{name}}님은 사람과의 {{compassKw}} 약속을 끝까지 챙기고 있습니다.","이번 분기는 그 {{compassKw}}을(를) \u2018약속 → 함께 마감 → 신뢰 자산화\u2019로 구조화하는 시간입니다.","{{primaryDomain}}에서 함께한 한 결과가 다음 약속을 가능하게 합니다."],
      "성장지향": ["이미 {{name}}님은 결과로 답하며 매 분기 한 단계씩 자라고 있습니다.","이번 분기는 그 {{compassKw}}을(를) \u2018실험 → 마감 → 답 자산화\u2019로 구조화하는 시간입니다.","{{primaryDomain}}에서 한 마감이 분기마다 한 단계 자란 결과를 만듭니다."],
      "자유지향": ["이미 {{name}}님은 누구의 속도가 아니라 자기 {{compassKw}}대로 결과를 마감하고 있습니다.","이번 분기는 그 {{compassKw}}을(를) \u20181순위 → 자기 호흡 → 자기 색 결과 자산화\u2019로 구조화하는 시간입니다.","{{primaryDomain}}에서 흐트러짐 없는 한 결과가 다른 결의 신뢰를 만듭니다."]
    },
    reflective_explorer: {
      "원칙지향": ["이미 {{name}}님은 매일 한 줄 질문으로 {{compassKw}}을(를) 다듬고 있습니다.","이번 분기는 그 {{compassKw}}을(를) \u2018질문 → 사색 → 한 길 자산화\u2019로 구조화하는 시간입니다.","{{primaryDomain}}에서 다듬어진 한 질문이 한 칸의 깊이를 만듭니다."],
      "관계지향": ["이미 {{name}}님은 사람의 {{compassKw}}을(를) 사색의 결로 길어 올리고 있습니다.","이번 분기는 그 {{compassKw}}을(를) \u2018듣기 → 사색 → 사람 길 자산화\u2019로 구조화하는 시간입니다.","{{primaryDomain}}에서 한 사람의 한 결이 사색을 한 길로 잇습니다."],
      "성장지향": ["이미 {{name}}님은 질문을 작은 실험으로 옮기며 {{compassKw}}을(를) 길어 올리고 있습니다.","이번 분기는 그 {{compassKw}}을(를) \u2018질문 → 작은 실험 → 답 자산화\u2019로 구조화하는 시간입니다.","{{primaryDomain}}에서 한 작은 실험이 분기마다 한 단계의 답을 만듭니다."],
      "자유지향": ["이미 {{name}}님은 자기 호흡으로 사색의 길을 또렷이 그어 가고 있습니다.","이번 분기는 그 {{compassKw}}을(를) \u2018질문 → 자기 호흡 → 자기 길 자산화\u2019로 구조화하는 시간입니다.","{{primaryDomain}}에서 한 호흡의 사색이 다른 결의 길을 엽니다."]
    }
  };

  // 합성 라이브러리 헬퍼 — 톤×Compass 매트릭스에서 안전 조회 (폴백 보장)
  function _l3MatrixGet(lib, toneKey, primaryCat){
    if (!lib) return null;
    var byTone = lib[toneKey] || lib.warm_connector || lib.principled_designer;
    if (!byTone) return null;
    return byTone[primaryCat] || byTone["성장지향"] || byTone["관계지향"] || byTone["원칙지향"] || byTone["자유지향"] || null;
  }

  /* ========================================================================
   *  메인 빌더
   * ====================================================================== */
  function build(opts) {
    opts = opts || {};
    var report = opts.report || {};
    var rules  = opts.rules  || {};
    var lang   = (opts.lang === "en") ? "en"
               : ((opts.lang === "ko") ? "ko"
               : ((report && report.lang === "en") ? "en" : "ko"));
    var isEn   = (lang === "en");
    var name   = safe(opts.name || (report.profile && report.profile.name) || report.name, isEn ? "Guest" : "고객");
    var publishedAt = opts.publishedAt || new Date();

    var toneKey = pickTone(report);
    var tonePack = (rules.tones && rules.tones[toneKey]) || (rules.tones && rules.tones[TONE_FALLBACK]) || {};
    var axes  = pickAxes(report);
    var sw    = findStrongWeak(axes);
    var allKw = pickAllKeywords(report);
    var ess   = essenceLine(report);
    var toneLabel = L(isEn, tonePack, "label") || toneKey;

    /* ──────────────────────────────────────────────────────────────────
     * [PR#193 고유성 복원 v2.0] fingerprint 기반 변주 시드
     *   배경: 동일 톤(예: visionary_creator) 사용자끼리 골격 텍스트가 71% 동일.
     *         진단 답안은 25%만 같은데 출력은 71% 같아 고유성(Only One) 훼손.
     *   해법: report-engine v4 가 이미 산출한 56문항 전체 fingerprint 를 받아
     *         "톤별 표현 변형 풀" 중 결정론적으로 1개를 선택 → 같은 사람은 항상
     *         같은 결과(재현성), 다른 사람은 다른 표현(고유성).
     *   원칙: ① 골격의 '의미'는 톤이 결정(서비스 방향 보존)
     *         ② 골격의 '표현'은 fingerprint 가 변주(고유성 회복)
     *         ③ fingerprint 미가용(구버전 캐시) 시 variantIndex=0 → 기존 출력과 동일
     * ────────────────────────────────────────────────────────────────── */
    var fingerprint = (report && report._v4Meta && typeof report._v4Meta.fingerprint === "number")
                      ? report._v4Meta.fingerprint : 0;
    var hasFingerprint = !!(report && report._v4Meta && typeof report._v4Meta.fingerprint === "number");
    /* 섹션별 salt 로 같은 fingerprint 라도 주차/효과/도구가 서로 다른 변형을 선택하도록 분산.
     *
     * [PR#193 v2.1 버그 수정] 이전 구현은
     *   ① 호출부가 poolLen=0 을 넘겨 항상 0 반환(변주 무력화),
     *   ② poolLen 으로 직접 나눠 fp ≡ 0 (mod 3) 인 사용자끼리 같은 variant 로 붕괴.
     * 해결:
     *   - poolLen 인자 제거 → 소비 함수가 각자 실제 풀 길이로 % 적용.
     *   - xorshift 비트믹싱으로 fp 의 '전체 비트'를 섞어 하위 비트 편향 제거.
     *     (1712356617·1874531880·1999975812 처럼 mod 3 이 같아도 믹싱 후엔 분산)
     *   - fingerprint 미가용(구버전 캐시) 시 항상 0 → 기존 출력과 100% 동일(회귀 안전).
     */
    function variantIdx(salt){
      if (!hasFingerprint) return 0;               // 구버전 캐시 → 변주 없음(회귀 안전)
      var h = (fingerprint ^ (salt * 0x9E3779B1)) >>> 0;   // 황금비 상수로 salt 분산
      // xorshift 32-bit 비트믹싱: 하위 비트 편향(mod 충돌) 제거
      h ^= h << 13; h >>>= 0;
      h ^= h >>> 17;
      h ^= h << 5;  h >>>= 0;
      return h >>> 0;                              // 부호 없는 32-bit 양의 정수
    }
    /* [PR#193 v2.1] 고정 효과 배열(분기/1년 effects)도 동일 동의어 사전 + 회전으로 변주.
     *   month3/year1 의 effects 는 진단축과 무관한 고정 텍스트라 동일 톤끼리 100% 겹쳤음.
     *   variant=0(구버전 캐시) → 원본 그대로(회귀 안전). */
    function varyEffects(arr, salt, en){
      if (!Array.isArray(arr) || !arr.length) return arr;
      var v = variantIdx(salt);
      if (!v) return arr;
      var synLib = en ? EFFECT_SYN_EN : EFFECT_SYN_KO;
      var out = arr.map(function(line, k){
        var pool = synLib[line];
        if (Array.isArray(pool) && pool.length){
          var vi = ((v + k * 101) % pool.length + pool.length) % pool.length;
          return pool[vi] || line;
        }
        return line;
      });
      var n = out.length;
      if (n > 1){
        var sh = ((v % n) + n) % n;
        if (sh) out = out.slice(sh).concat(out.slice(0, sh));
      }
      return out;
    }

    // 사명·비전 주입 (사용자 확정 — 사명 직접 인용형 / 비전 헤드라인 재사용)
    //   리포트의 mission_vision 섹션이 있으면 3-Tier 슬롯을 vars 로 주입
    //   템플릿에서는 {{missionHeadline}}, {{missionSubline}}, {{visionHeadline}},
    //   {{visionSubline}}, {{primaryDomain}}, {{secondaryDomain}}, {{compassKw}},
    //   {{compassVerb}} 로 참조 가능
    var mvVars = extractMissionVisionVars(report, isEn);

    // PR#59-B: 진단 응답 직접 주입 — execution_profile/growth_map 에서 추출
    //   원칙: ① 구조/디자인 변경 없음 (변수 주입만 확장)
    //         ② 동일 톤·동일 Compass 사용자도 Q6/Q39/Q41/Q47/Q49/Q73 응답이 다르면 결과 다름
    //         ③ 회원의 진단 응답이 자연스럽게 한 호흡 단문으로 결합
    //   추출 항목:
    //     - userTraitColor : Q6 첫 trait 의 색채 형용구 (예: "서두르지 않는")
    //     - userActivities : Q39+Q41 가공 결과 첫 1~2개 (예: "리더십, 공동체")
    //     - userActivity1  : 위에서 첫 1개 (예: "리더십")
    //     - userFocusEnv   : Q47+Q49 가공 결과 (예: "조용한 공간 / 아침형 루틴")
    //     - userTool1      : Q73 가공 결과 첫 1개 (예: "체크리스트로 시각화")
    //     - userTopStrength: growth_map.strengths[0] (예: "데이터와 직관을 함께 다스리는 신중한 분석력")
    //     - userWeakAxis   : 약축 한국어 라벨 (예: "자기표현")
    //     - userWeakGrain  : 약축 보완 한 호흡 (예: "한 호흡 언어로 옮기는 결")
    function _ep(report){
      if (!report || !Array.isArray(report.sections)) return {};
      var s = report.sections.filter(function(x){ return x.id === "execution_profile"; })[0];
      return (s && s.content) || {};
    }
    function _firstFromCsv(s, n){
      if (typeof s !== "string" || !s) return "";
      // "리더십, 공동체, 관계" → ["리더십","공동체","관계"]
      // "조용한 공간 (도서관) / 아침에 일찍" 같은 슬래시 구분도 허용
      var parts = s.split(/[,/·]/).map(function(x){ return x.trim(); }).filter(Boolean);
      return (n === 1) ? (parts[0] || "") : parts.slice(0, n || 2).join(isEn ? ", " : ", ");
    }
    var ep = _ep(report);
    var topStrengthList = pickReportStrengths(report);
    var firstTrait = (Array.isArray(report.traits) && report.traits[0])
                  || (Array.isArray(report.q6) && report.q6[0])
                  || ((report.answers && report.answers.Q6 && (Array.isArray(report.answers.Q6) ? report.answers.Q6[0] : report.answers.Q6)))
                  || "";
    var TRAIT_COLOR_PROG_KO = {
      "조용한":"고요한","신중한":"서두르지 않는","분석적인":"본질을 짚는","느긋한":"흔들리지 않는",
      "공감하는":"사람의 결을 살피는","따뜻한":"따뜻한",
      "계획적인":"흐름을 짜는","현실적인":"현실 감각의","창의적인":"새로움을 길어 올리는",
      "열정적인":"뜨거운","도전적인":"경계를 넓히는","성취지향적인":"끝까지 마무리하는"
    };
    var TRAIT_COLOR_PROG_EN = {
      "조용한":"quiet","신중한":"unhurried","분석적인":"essence-piercing","느긋한":"unshaken",
      "공감하는":"people-reading","따뜻한":"warm",
      "계획적인":"flow-shaping","현실적인":"reality-grounded","창의적인":"newness-drawing",
      "열정적인":"hot","도전적인":"frontier-widening","성취지향적인":"finishing"
    };
    var WEAK_AXIS_LABEL_KO = {
      self_understanding:"자기이해", self_expression:"자기표현",
      self_design:"자기설계", self_execution:"자기실행"
    };
    var WEAK_AXIS_LABEL_EN = {
      self_understanding:"Self-Understanding", self_expression:"Self-Expression",
      self_design:"Self-Design", self_execution:"Self-Execution"
    };
    var WEAK_GRAIN_KO = {
      self_understanding:"한 줄 언어로 자기 결을 꺼내는 결",
      self_expression:   "한 호흡 언어로 자기 {{compassKw}}을(를) 옮기는 결",
      self_design:       "흩어진 길을 한 그림으로 묶는 결",
      self_execution:    "결정한 것을 작은 마감으로 옮기는 결"
    };
    var WEAK_GRAIN_EN = {
      self_understanding:"the grain of putting your inside into one line",
      self_expression:   "the grain of moving feeling into one breath of language",
      self_design:       "the grain of binding scattered paths into one picture",
      self_execution:    "the grain of moving decision into a small finish"
    };
    var userTraitColor = (isEn ? TRAIT_COLOR_PROG_EN : TRAIT_COLOR_PROG_KO)[firstTrait]
                       || (isEn ? "your own grain" : "자기 결의");
    // Q39+Q41 가공 결과 (report-engine.js _buildExecutionProfile activities)
    //   예: "봉사, 돌봄, 의미 있는 영향력 행사, 계획을 세우고 실행하는 일, 리더십, 공동체, 관계"
    var userActivitiesAll = (typeof ep.activities === "string") ? ep.activities : "";
    var userActivities = _firstFromCsv(userActivitiesAll, 2) || (isEn ? "your chosen activities" : "관심 활동");
    var userActivity1  = _firstFromCsv(userActivitiesAll, 1) || (isEn ? "your chosen activity" : "관심 활동");
    // Q47+Q49 가공 결과 (몰입 환경)
    //   예: "조용한 공간 (도서관, 독서실 등), 정돈된 실내 / 아침에 일찍 시작..."
    var userFocusEnv = (typeof ep.environment === "string" && ep.environment) ? ep.environment
                       : (isEn ? "your chosen focus environment" : "회원님의 몰입 환경");
    // Q73 가공 결과 (성취 도구) — 톤 기본 루틴이 뒤에 붙어 있으므로 "·" 앞 첫 토막을 우선 사용
    //   예: "누군가에게 좋은 영향을 미쳤을 때 · 감사 루틴 · 1:1 미팅 루틴 · 감정 일기"
    var userToolsAll = (typeof ep.tools === "string") ? ep.tools : "";
    var userTool1 = _firstFromCsv(userToolsAll, 1) || (isEn ? "your chosen routine" : "회원님의 성취 도구");
    // growth_map TOP1 강점 (Q6 페어 합성 결과)
    var userTopStrength = (topStrengthList && topStrengthList[0])
                          || (isEn ? "your distinctive strength" : "회원님의 강점");
    // 약축 라벨 + 한 호흡 보완 결
    var userWeakAxis  = (isEn ? WEAK_AXIS_LABEL_EN : WEAK_AXIS_LABEL_KO)[sw.weak]
                       || (isEn ? "Weak axis" : "보완 축");
    var userWeakGrain = (isEn ? WEAK_GRAIN_EN : WEAK_GRAIN_KO)[sw.weak]
                       || (isEn ? "the grain to add" : "더할 한 호흡의 결");

    var vars = {
      name: name,
      tone: toneLabel,
      missionHeadline: mvVars.missionHeadline,
      missionSubline:  mvVars.missionSubline,
      visionHeadline:  mvVars.visionHeadline,
      visionSubline:   mvVars.visionSubline,
      primaryDomain:   mvVars.primaryDomain,
      secondaryDomain: mvVars.secondaryDomain,
      domainPhrase:    mvVars.domainPhrase,
      compassKw:       mvVars.compassKw,
      compassVerb:     mvVars.compassVerb,
      // PR#59-B: 진단 응답 직접 주입 변수
      userTraitColor:   userTraitColor,
      userActivities:   userActivities,
      userActivity1:    userActivity1,
      userFocusEnv:     userFocusEnv,
      userTool1:        userTool1,
      userTopStrength:  userTopStrength,
      userWeakAxis:     userWeakAxis,
      userWeakGrain:    userWeakGrain
    };

    /* ------------------------------------------------------------------
     * §1 표지 및 전체 요약
     * ------------------------------------------------------------------ */
    var fmt = rules.format || {};
    var coverTitle = L(isEn, fmt, "title") || (isEn ? "📘 Life Portfolio Custom Execution Program" : "📘 인생포트폴리오 맞춤 실행 프로그램");
    var coverSubtitleTpl = L(isEn, fmt, "subtitleTpl") || (isEn ? "A Growth & Execution Strategy Guide for {{name}}" : "{{name}}님을 위한 성장 & 실행 전략 안내서");
    var coverService = L(isEn, fmt, "service") || (isEn ? "Life Portfolio" : "인생포트폴리오");
    var toneTagline = L(isEn, tonePack, "tagline") || "";
    var typeLine = isEn
      ? (name + "'s type — " + toneLabel + (toneTagline ? (" · " + toneTagline) : ""))
      : (name + "님의 유형 — " + toneLabel + (toneTagline ? (" · " + toneTagline) : ""));

    // PR#54 — L3(Google) 표지 인용문 격상
    //   원칙: 사명 헤드라인 직접 인용 + 한 호흡 단문 (쉼표 최소, 사족 금지)
    //   구조: "이 프로그램은 {name}님의 사명 — '{missionHeadline}' — 을 매일 한 호흡으로 옮긴다."
    //   폴백 차단: missionHeadline 이 없으면 v4.1 미적용 캐시 — essence 폴백 대신
    //              사명·비전 자리표시자 인용으로 대체 (의미 흐림 방지)
    var quote;
    var mhRaw = mvVars.missionHeadline ? _stripTrailingPunct(mvVars.missionHeadline) : "";
    if (mhRaw) {
      if (isEn) {
        // 한 호흡 단문 (쉼표 1개 이내) — 사명 직접 인용
        quote = "\u201C" + name + "'s mission \u2014 \u2018" + mhRaw + "\u2019 \u2014 "
              + "moves into one breath of each day.\u201D";
      } else {
        // 한 호흡 단문 — 사명 직접 인용
        quote = "\u201C이 프로그램은 " + name + "님의 사명 \u2014 \u2018" + mhRaw + "\u2019 \u2014 "
              + "을 매일 한 호흡으로 옮깁니다.\u201D";
      }
    } else {
      // PR#54: essence 폴백 차단 — 사명·비전 자리표시 인용으로 대체
      //   v4.1 업그레이드가 안 된 옛 캐시는 의미 결을 흐리지 않도록
      //   '자기다움' 추상 표현으로만 묶고, 점수·기법 언급은 제거
      quote = isEn
        ? ("\u201CThis program moves " + name + "'s self-distinctive grain into one breath of each day.\u201D")
        : ("\u201C이 프로그램은 " + name + "님의 자기다움을 매일 한 호흡으로 옮깁니다.\u201D");
    }

    var newPathsArr = (L(isEn, tonePack, "newPaths") || []);
    var newPathsJoin = newPathsArr.slice(0,4).join(" · ") || (isEn ? "1-person brand in your field / Side projects" : "관련 분야 1인 브랜드 / 사이드 프로젝트");

    /* ------------------------------------------------------------------
     * PR#54 — L3(Google) 6박스 본문 격상
     *   원칙: ① 매핑 결과를 한 호흡 단문으로 합성
     *         ② 점수·축% 노출 금지 (자기다움의 결로 표현)
     *         ③ 톤×Compass 카테고리 매핑은 보존
     * ------------------------------------------------------------------ */
    var reportStrengths = pickReportStrengths(report);
    var primaryCat = _pickPrimaryCategory(report) || "성장지향";

    // ① 성향 — 톤×Compass 한 호흡 형용구 (라벨 나열 금지)
    var traitsLine = tpl(l3TraitPhrase(toneKey, primaryCat, isEn), vars);

    // ② 강점 — paired-trait TOP3 가 있으면 한 호흡으로 묶고, 없으면 톤 결로 합성
    var strengthsLine;
    if (reportStrengths.length >= 2) {
      var top3Join = reportStrengths.slice(0, 3).join(isEn ? " · " : " · ");
      strengthsLine = isEn
        ? (top3Join + " \u2014 the grain that carries this mission.")
        : (top3Join + " \u2014 이 사명을 받쳐 주는 결.");
    } else {
      // 톤×Compass 한 호흡 폴백 (점수·축% 노출 금지)
      strengthsLine = tpl(l3TraitPhrase(toneKey, primaryCat, isEn), vars);
    }

    // ③ 보완점 — 약축 → 한 호흡 (점수 노출 금지)
    var gapsLine = tpl(l3GapPhrase(sw.weak, isEn), vars);

    // ④ 적합 환경 — 톤×Compass 한 호흡
    var envLine = tpl(l3EnvPhrase(toneKey, primaryCat, isEn), vars);

    // ⑤ 신규 가능성 — newPaths 4개 (도입어 정리)
    var newPathsLine = tpl(l3NewPathsLine(newPathsArr, mvVars.missionHeadline, isEn), vars);

    // PR#54 — Google L3 헤드라인 + 한 호흡 본문 카드 구조
    //   각 박스: { headline, body }
    //   ▶ headline 은 톤×Compass 카테고리 합성 한 단어/짧은 구
    //   ▶ body 는 기존 한 호흡 단문 (점수·축% 노출 금지)
    var traitsHead   = tpl(l3HeadByTone2(L3_HEAD_TRAITS_KO, L3_HEAD_TRAITS_EN, toneKey, primaryCat, isEn), vars);
    var strengthsHead = isEn ? "The grain that carries this mission" : (L3_HEAD_STRENGTHS_KO[toneKey] || "사명을 받쳐 주는 결");
    var gapsHead      = (isEn ? L3_HEAD_GAP_EN : L3_HEAD_GAP_KO)[sw.weak] || (isEn ? "Grain to add" : "더할 결");
    var envHead       = (isEn ? L3_HEAD_ENV_EN : L3_HEAD_ENV_KO)[toneKey] || (isEn ? "Where you flow" : "결이 흐르는 자리");
    var newPathsHead  = isEn ? "Paths this mission opens" : "이 사명이 여는 길";

    var summary = {
      traits:   traitsLine,
      strengths: strengthsLine,
      gaps:     gapsLine,
      env:      envLine,
      newPaths: newPathsLine,
      // L3 헤드라인 (program.html 신규 카드 디자인용)
      traitsHead:    traitsHead,
      strengthsHead: strengthsHead,
      gapsHead:      gapsHead,
      envHead:       envHead,
      newPathsHead:  newPathsHead
    };

    var coverSummary = {
      title: coverTitle,
      subtitle: tpl(coverSubtitleTpl, vars),
      service: coverService,
      publishedAt: fmtDate(publishedAt),
      typeLine: typeLine,
      quote: quote,
      summary: summary,
      arrowLine: isEn
        ? ("\uD83D\uDC49 The execution program is designed around the routine: " + arrowByTone(toneKey, isEn, mvVars.compassVerb) + ".")
        : ("\uD83D\uDC49 실행 프로그램은 " + arrowByTone(toneKey, isEn, mvVars.compassVerb) + " 루틴으로 설계됩니다.")
    };

    /* ------------------------------------------------------------------
     * §2 맞춤 실행 프로그램 (3주 / 3개월 / 1년)
     *      각 단계: 실행 안내 / 실행 방법 / 실행 효과(4 포인트 명사형)
     * ------------------------------------------------------------------ */
    // PR#55 — L3 합성 엔진 (옵션 B): 톤×Compass 매트릭스 우선, tonePack 폴백
    //   원칙: ① Q13/Q41/Q63/Q75 매핑 보존
    //         ② 한 호흡 단문 (tonePack 내장 액션을 변수 주입으로 합성)
    //         ③ 동일 톤·동일 Compass 사용자도 사명/비전/도메인/약축이 다르면 결과가 달라짐
    var l3WeekActions = (!isEn) ? _l3MatrixGet(L3_WEEK_ACTION_KO, toneKey, primaryCat) : null;
    var weeksRaw = tonePack.weeks || [];
    // PR#59-B: 회원의 진단 응답 결합 — 주차별로 Q39/Q41(activities), Q47/Q49(focusEnv),
    //   Q73(tool), Q6(traitColor) 중 하나를 그 주차의 한 액션에 자연스럽게 결합.
    //   주차별 회전 (1주: 활동, 2주: 도구, 3주: 환경) → 매주 다른 진단 항목이 직접 노출.
    var WEEK_PERSONALIZE_KO = [
      // week 1: Q39/Q41 (관심 활동) 결합
      "관심 활동(" + userActivities + ") 중 1개를 이번 주에 한 번 자기 결로 시도합니다.",
      // week 2: Q73 (성취 도구) 결합
      "회원님 답안의 성취 조건(\u2018" + userTool1 + "\u2019)을 이번 주 한 번 의식적으로 적용합니다.",
      // week 3: Q47/Q49 (몰입 환경) 결합
      "몰입 환경(" + userFocusEnv + ")을 한 번 의도적으로 만들어 깊이 한 호흡을 갖습니다."
    ];
    var WEEK_PERSONALIZE_EN = [
      "Try one of your chosen activities (" + userActivities + ") once this week, in your own grain.",
      "Apply your achievement condition ('" + userTool1 + "') consciously once this week.",
      "Set up your focus environment (" + userFocusEnv + ") once and take one deep breath in it."
    ];
    var weeks = weeksRaw.map(function(w, i){
      var synthActions = (l3WeekActions && l3WeekActions[i]) ? tplArr(l3WeekActions[i], vars) : null;
      var baseActions = synthActions || tplArr(L(isEn, w, "actions") || [], vars);
      // PR#59-B: 회원 진단 응답을 마지막 액션으로 추가 (기존 3개 액션 보존, 1개 추가 → 총 4개)
      //   이로써 회원의 Q6/Q39/Q41/Q47/Q49/Q73 응답이 매주 직접 노출됨
      var personalizeLine = (isEn ? WEEK_PERSONALIZE_EN : WEEK_PERSONALIZE_KO)[i] || "";
      var actions = personalizeLine ? baseActions.concat([personalizeLine]) : baseActions;
      return {
        week: i+1,
        title: L(isEn, w, "title"),
        // [PR#193] fingerprint 변주: 주차 헤드라인/효과를 톤별 변형 풀에서 결정론적 선택
        guide:  guideOfWeek(toneKey, i, isEn, variantIdx(7 + i)),
        actions: actions,
        effects: effectsOfWeek(toneKey, i, isEn, variantIdx(13 + i))   // 4 포인트 명사형
      };
    });

    var l3Month3Goals = (!isEn) ? _l3MatrixGet(L3_MONTH3_GOAL_KO, toneKey, primaryCat) : null;
    var month3GoalsRaw = tonePack.month3Goals || [];
    // PR#60-C: 3개월 목표에 회원 진단 응답 직접 결합 — 4번째 목표로 'Q41 주제 × Q73 성취조건' 추가
    //   원칙: 기존 3개 목표 보존, 회원 응답 결합 1개 추가 → 총 4개
    //         (관심 주제 Q41 영역에서 본인의 성취 조건을 분기 결과로 자리잡게 함)
    var monthGoalCustom = isEn
      ? {
          title: "Take root in '" + (userActivities || "your chosen activities") + "' with your achievement condition",
          criterion: "Reach a quarter-end where '" + userTool1 + "' is visible 3 times in your chosen field"
        }
      : {
          title: "관심 주제(" + (userActivities || "관심 활동") + ") 에서 회원님의 성취 조건으로 결과 1건 자리 잡기",
          criterion: "분기 말 \u2018" + userTool1 + "\u2019 결과 3건이 관심 영역에서 가시화"
        };
    var month3GoalsBase = (l3Month3Goals && l3Month3Goals.length)
      ? l3Month3Goals.map(function(g){ return { title: tpl(g.title, vars), criterion: tpl(g.criterion, vars) }; })
      : month3GoalsRaw.map(function(g){ return { title: L(isEn, g, "title"), criterion: L(isEn, g, "criterion") }; });
    var month3 = {
      guide: isEn
        ? "Define the three results that should actually take root this quarter."
        : "이번 분기 \u2018실제로 자리 잡혀야 하는 3가지 결과\u2019를 정합니다.",
      goals: month3GoalsBase.concat([monthGoalCustom]),
      // [PR#193 v2.1] 고정 분기 효과도 fingerprint 변주(동의어+회전) → 동일 톤 간 중복 해소
      effects: varyEffects(isEn
        ? ["Quarterly results made visible","Core routine established","Self-distinctiveness as an asset","Foothold for the next quarter"]
        : ["분기 결과 가시화", "핵심 루틴 정착", "자기다움 자산화", "다음 분기 발판 형성"], 41, isEn)
    };

    var year1Pack = tonePack.year1 || {};
    // PR#60-C: 1년 비전에 회원 진단 응답 직접 결합 — milestones 마지막에 'Q41 × Q39 × Q47 환경' 결합 1줄 추가
    //   원칙: 기존 마일스톤 보존, 회원 진단 결합 1줄 덧붙임 → 회원의 환경/주제/활동이 1년 후 도달점에 직접 노출
    var milestonesBase = tplArr(L(isEn, year1Pack, "milestones") || [], vars);
    var milestoneCustom = isEn
      ? ("In your focus environment (" + userFocusEnv + "), turn '" + userActivities + "' into one signature piece of work")
      : ("회원님의 몰입 환경(" + userFocusEnv + ") 안에서 \u2018" + userActivities + "\u2019을 한 편의 시그니처 결과로 매듭짓기");
    var year1 = {
      guide: isEn
        ? "Capture next year's destination as one vision sentence and three milestones."
        : "1년 후 도달할 모습을 비전 한 문장과 마일스톤 3개로 묶어 둡니다.",
      vision: tplArr(L(isEn, year1Pack, "vision") || [], vars),
      milestones: milestonesBase.concat([milestoneCustom]),
      // [PR#193 v2.1] 고정 1년 효과도 fingerprint 변주
      effects: varyEffects(isEn
        ? ["Long-term vision in writing","Quarterly cycles completed","Trust & reputation as assets","New vision for the next year"]
        : ["장기 비전 명문화", "분기 사이클 완수", "신뢰·평판 자산화", "다음 1년 새 비전 도출"], 53, isEn)
    };

    /* ------------------------------------------------------------------
     * §3 실행 모듈 카드 (TOP3 추천 모듈)
     *      구분: 강점 활용 / 보완 훈련 / 핵심 전략 / 추천 도구 2~3개
     * ------------------------------------------------------------------ */
    var TYPES_KO = ["강점 활용", "보완 훈련", "핵심 전략"];
    var TYPES_EN = ["Strength leverage", "Compensatory training", "Core strategy"];
    // PR#55 — L3 모듈 summary 합성: 사명/비전 결로 재합성 (KO 전용, EN 폴백)
    var l3ModuleSummaries = (!isEn) ? (L3_MODULE_SUMMARY_KO[toneKey] || null) : null;
    var modules = (tonePack.modules || []).map(function(m, i){
      var type = isEn ? (TYPES_EN[i] || TYPES_EN[2]) : (TYPES_KO[i] || TYPES_KO[2]);
      var synthSummary = (l3ModuleSummaries && l3ModuleSummaries[i])
        ? tpl(l3ModuleSummaries[i], vars) : null;
      return {
        index: i+1,
        type: type,
        title: L(isEn, m, "title"),
        summary: synthSummary || L(isEn, m, "summary"),
        actions: tplArr(L(isEn, m, "actions") || [], vars),
        tools: toolsOfTone(toneKey, i, isEn, variantIdx(23 + i))
      };
    });

    // 약축 부스터 1개를 보완 훈련에 보강
    var boosterAxis = sw.weak;
    var boosters = (rules.weakAxisBoosters || {});
    var boosterArr = isEn
      ? (boosters[boosterAxis + "_en"] || boosters[boosterAxis] || [])
      : (boosters[boosterAxis] || []);
    // PR#59-B: 약축 부스터에 회원 진단 응답을 결합한 한 호흡 액션 1개 추가
    //   원칙: 기존 부스터 액션 보존, 마지막에 'userWeakGrain × userTool1' 결합 액션 1개 덧붙임
    //         (Q73 성취 도구가 약축 보완에 어떻게 쓰이는지를 한 호흡으로 결로 결합)
    var weakBoosterPersonalize = isEn
      ? ("Use your achievement condition ('" + userTool1 + "') as the doorway into " + tpl(userWeakGrain, vars) + ".")
      : ("회원님의 성취 조건(\u2018" + userTool1 + "\u2019)을 " + tpl(userWeakGrain, vars) + "로 들어가는 문으로 사용합니다.");
    var boosterArrPersonal = boosterArr.length
      ? boosterArr.concat([weakBoosterPersonalize])
      : [weakBoosterPersonalize];
    if (modules[1]){
      modules[1].booster = {
        targetAxis: axisLabel(boosterAxis, isEn),
        actions: boosterArrPersonal
      };
    }

    /* ------------------------------------------------------------------
     * §4 성과 추적 보드 (1주차 예시 + 월간 항목)
     *      열: 주차 / 실행 과제 / 완료(Y/N) / 성찰 메모
     * ------------------------------------------------------------------ */
    // PR#55 — 주간/월간 점검 합성 (KO 전용, EN 폴백)
    var l3Weekly = (!isEn) ? _l3MatrixGet(L3_TRACK_WEEKLY_KO, toneKey, primaryCat) : null;
    var l3Monthly = (!isEn) ? _l3MatrixGet(L3_TRACK_MONTHLY_KO, toneKey, primaryCat) : null;
    var trackWeekly = (l3Weekly && l3Weekly.length)
      ? tplArr(l3Weekly, vars)
      : (L(isEn, tonePack, "trackBoardWeekly") || []);
    var trackMonthly = (l3Monthly && l3Monthly.length)
      ? tplArr(l3Monthly, vars)
      : (L(isEn, tonePack, "trackBoardMonthly") || []);
    // PR#59-B: 보드 힌트에 회원 몰입 환경(Q47/Q49) 한 호흡 결합
    //   원칙: 기존 안내 문장 보존 + 회원의 환경 결을 한 호흡 단문으로 덧붙임
    //         (동일 톤·동일 Compass 사용자도 환경이 다르면 보드 힌트가 달라짐)
    var boardHintExtra = isEn
      ? (" Keep the record in your focus environment (" + userFocusEnv + ") so the loop holds its grain.")
      : (" 기록은 회원님의 몰입 환경(" + userFocusEnv + ") 안에서 유지해 루프의 결을 잃지 않습니다.");
    var board = {
      columns: isEn
        ? ["Week", "Action task", "Done (Y/N)", "Reflection notes"]
        : ["주차", "실행 과제", "완료(Y/N)", "성찰 메모"],
      rowsExample: trackWeekly.map(function(t){
        return { week: isEn ? "Week 1" : "1주차", task: t, done: "", memo: "" };
      }),
      monthly: trackMonthly,
      hint: (isEn
        ? ("This table is a Week 1 example. " + name + " keeps the same record format weekly to complete the loop of \u2018record \u2192 reflect \u2192 next decision\u2019.")
        : ("이 표는 1주차 예시입니다. " + name + "님은 매주 동일한 방식으로 기록하며 \u2018기록 \u2192 회고 \u2192 다음 결정\u2019의 루프를 완성합니다.")
      ) + boardHintExtra
    };

    /* ------------------------------------------------------------------
     * §5 기대 효과 ✨ (4줄 + 신규 직업/사업 가능성 3~4개)
     * PR#61-1: Q75 도메인 직접 노출 — fitJob/expansion/newPaths 에 회원의
     *          관심 분야(primaryDomain/secondaryDomain) 를 명시적으로 결합
     * ------------------------------------------------------------------ */
    var teff = tonePack.effects || {};
    // PR#61-1: Q75 기반 도메인 라벨 (회원 응답 직접 노출)
    var _pd = (vars.primaryDomain || "").trim();
    var _sd = (vars.secondaryDomain || "").trim();
    var _domainLabelKo = (_pd && _sd) ? (_pd + "·" + _sd) : (_pd || _sd || "");
    var _domainLabelEn = (_pd && _sd) ? (_pd + " & " + _sd) : (_pd || _sd || "");
    var effects = isEn ? {
      fitJob:    "Job fit: "          + (L(isEn, teff, "fitJob")    || "Stronger fit for roles in your field")
                                       + (_domainLabelEn ? (" — anchored in " + _domainLabelEn) : ""),
      expansion: "Career expansion: " + (L(isEn, teff, "expansion") || "Self-distinctive 1-person brand / side-project expansion")
                                       + (_domainLabelEn ? (" across " + _domainLabelEn) : ""),
      career:    "Career growth: "    + (L(isEn, teff, "career")    || "Self-assets accumulated as outcomes"),
      vision:    "Life vision: "      + (L(isEn, teff, "vision")    || "\u201CSomeone whose self-distinctiveness becomes influence\u201D"),
      newPaths:  (function(){
        var base = newPathsArr.slice(0, 4);
        // PR#61-1: 도메인 결합 한 줄을 newPaths 1순위에 붙여 직접 노출
        if (_domainLabelEn) base = [(_domainLabelEn + " — interest-domain combination paths")].concat(base).slice(0, 4);
        return base;
      })()
    } : {
      fitJob:    "직무 적합성: "    + (teff.fitJob    || "관련 분야 직무 적합성 강화")
                                    + (_domainLabelKo ? (" — " + _domainLabelKo + " 분야 결합") : ""),
      expansion: "직업 확장성: "    + (teff.expansion || "자기다움 기반 1인 브랜드 / 사이드 프로젝트 확장")
                                    + (_domainLabelKo ? (" — " + _domainLabelKo + " 영역으로 확장") : ""),
      career:    "경력 성장: "      + (teff.career    || "자기 자산을 결과로 누적"),
      vision:    "인생 설계 비전: " + (teff.vision    || "\u201C자기다움이 곧 영향력이 되는 사람\u201D"),
      newPaths:  (function(){
        var base = newPathsArr.slice(0, 4);
        // PR#61-1: 도메인 결합 한 줄을 newPaths 1순위에 붙여 직접 노출
        if (_domainLabelKo) base = [(_domainLabelKo + " 분야 결합 가능성")].concat(base).slice(0, 4);
        return base;
      })()
    };

    /* ------------------------------------------------------------------
     * §6 다음 단계 제안 (1개월 / 3개월 / 1년 — 시점 + 실행과제)
     * ------------------------------------------------------------------ */
    // PR#55 — Next Steps 합성: 사명/비전 직접 인용 + Compass 키워드 결합
    // PR#59-B — Next Steps 시점별 진단 응답 결합 (한 호흡 부가 단문)
    //   원칙: 기존 task 보존 + 시점별로 회원 진단 응답 1종을 한 호흡으로 덧붙임
    //         · 1개월: Q73 성취 도구 (userTool1) — 첫 루틴의 도입
    //         · 3개월: Q39/Q41 관심 활동 (userActivity1) — 분기 결과의 자리
    //         · 1년: 약축 결 (userWeakGrain) — 1년 비전을 받쳐 줄 결
    var nsPack = tonePack.nextSteps || {};
    var l3Ns = isEn ? (L3_NEXTSTEPS_EN[toneKey] || null) : (L3_NEXTSTEPS_KO[toneKey] || null);
    var nsExtraM1 = isEn
      ? (" — anchor it on your achievement condition ('" + userTool1 + "')")
      : (" — 회원님의 성취 조건(\u2018" + userTool1 + "\u2019)에 닻을 둡니다.");
    var nsExtraM3 = isEn
      ? (" — let it grow inside your chosen activity (" + userActivity1 + ")")
      : (" — 회원님의 관심 활동(" + userActivity1 + ") 안에서 자리 잡게 합니다.");
    var nsExtraY1 = isEn
      ? (" — held up by " + tpl(userWeakGrain, vars) + " as the missing grain")
      : (" — 채워질 결 \u2018" + tpl(userWeakGrain, vars) + "\u2019이 받쳐 줍니다.");
    var nextSteps = isEn ? [
      { when: "1 month later",  task: tpl((l3Ns && l3Ns.m1) || L(isEn, nsPack, "m1") || "Start one core routine", vars) + nsExtraM1 },
      { when: "3 months later", task: tpl((l3Ns && l3Ns.m3) || L(isEn, nsPack, "m3") || "Secure one quarterly key result", vars) + nsExtraM3 },
      { when: "1 year later",   task: tpl((l3Ns && l3Ns.y1) || L(isEn, nsPack, "y1") || "Reach a 1-year vision milestone", vars) + nsExtraY1 }
    ] : [
      { when: "1개월 후",  task: tpl((l3Ns && l3Ns.m1) || nsPack.m1 || "핵심 루틴 1개 시작", vars) + nsExtraM1 },
      { when: "3개월 후",  task: tpl((l3Ns && l3Ns.m3) || nsPack.m3 || "분기 핵심 결과 1개 확보", vars) + nsExtraM3 },
      { when: "1년 후",    task: tpl((l3Ns && l3Ns.y1) || nsPack.y1 || "1년 비전 마일스톤 달성", vars) + nsExtraY1 }
    ];

    /* ------------------------------------------------------------------
     * §7 안내 문구 + 마무리 문장 + 리스크/보완
     * ------------------------------------------------------------------ */
    var fn = rules.footerNotice || {};
    var footerLines = (L(isEn, fn, "lines") || []).map(function(s){ return tpl(s, vars); });
    var qualityChecklist = L(isEn, fn, "qualityChecklist") || [];

    // risks: 객체 배열의 각 아이템 안에 risk_en/mitigation_en 가 있으므로 아이템 단위로 EN 선택
    var risksRaw = tonePack.risks || [];
    var risks = risksRaw.map(function(r){
      if (!r || typeof r !== "object") return r;
      return {
        risk: L(isEn, r, "risk") || "",
        mitigation: L(isEn, r, "mitigation") || ""
      };
    });
    var closing = tplArr(L(isEn, tonePack, "closing") || [], vars);

    /* ------------------------------------------------------------------
     * 분기 테마(상단 인상) — 김영식 샘플의 첫 페이지 구성을 그대로 채용
     * ------------------------------------------------------------------ */
    // PR#54 — L3 분기 테마 (톤×Compass 카테고리 합성)
    //   기존: 톤별 고정 텍스트 ("마음을 잇고 신뢰를 쌓는 분기")
    //   격상: 톤×Compass 합성 ("원칙으로 사람을 지키는 분기" 등 36조합)
    //   리드 3줄은 톤별 본문 유지 (이미 L2 수준의 자연어로 정합)
    var l3QuarterHead = l3QuarterHeading(toneKey, primaryCat, isEn);
    var quarter = {
      icon: "\uD83E\uDDED",
      title: isEn ? "Quarterly theme" : "분기 테마",
      heading: tpl(l3QuarterHead || L(isEn, tonePack, "quarterTheme") || (isEn ? "This quarter's theme" : "이번 분기 테마"), vars),
      // PR#55 — 분기 리드 3줄 합성 (KO 전용, EN 폴백)
      paragraphs: (function(){
        var l3Paras = (!isEn) ? _l3MatrixGet(L3_QUARTER_PARAS_KO, toneKey, primaryCat) : null;
        if (l3Paras && l3Paras.length) return tplArr(l3Paras, vars);
        return tplArr(L(isEn, tonePack, "quarterLeadParas") || [], vars);
      })()
    };

    /* ------------------------------------------------------------------
     * 최종 문서
     * ------------------------------------------------------------------ */
    /* ====================================================================
     * [PR#194 장기 — 고유성(Only One) 가드 / self-check]
     *   목적: 동일 톤 사용자끼리 골격이 과도하게 겹치는 회귀를 '실시간으로' 잡는다.
     *   방법: 프로그램의 '비개인화 골격 라인'(주차 헤드라인/효과/도구/모듈)을
     *         정규화→정렬→해시하여 시그니처(uniqSig)로 남긴다.
     *         + 변주가 실제 적용됐는지(variantApplied) 자가검증 플래그.
     *   활용: 저장 측(program.html/서버)이 같은 톤의 기존 사용자 uniqSig 와 비교해
     *         동일하면(=충돌) 경고/재생성 트리거. 엔진은 판단 근거만 제공(부작용 없음).
     *   원칙: 출력 구조 불변(meta 에 메타데이터만 추가) → 기존 화면 100% 호환.
     * ==================================================================== */
    function _normLine(s){
      return String(s == null ? "" : s)
        .toLowerCase()
        .replace(/[\s\u00b7'"“”‘’(),.\-→/]+/g, "")  // 공백·구두점 제거
        .trim();
    }
    function _djb2(str){
      var h = 5381;
      for (var k = 0; k < str.length; k++){ h = ((h << 5) + h + str.charCodeAt(k)) >>> 0; }
      return h >>> 0;
    }
    // 비개인화 골격만 수집(개인화 라인은 어차피 사용자별로 다르므로 가드 대상에서 제외)
    var _skel = [];
    weeks.forEach(function(w){
      _skel.push(w.guide);
      if (Array.isArray(w.effects)) _skel = _skel.concat(w.effects);
    });
    if (month3 && Array.isArray(month3.effects)) _skel = _skel.concat(month3.effects);
    if (year1  && Array.isArray(year1.effects))  _skel = _skel.concat(year1.effects);
    modules.forEach(function(m){ if (Array.isArray(m.tools)) _skel = _skel.concat(m.tools); });
    var _skelNorm = _skel.map(_normLine).filter(Boolean).sort();
    var _uniqSig = _djb2(_skelNorm.join("|"));
    // 변주 실제 적용 여부: fingerprint 가용 + variantIdx 가 0이 아닌 값을 1개라도 산출
    var _variantApplied = hasFingerprint && (
      variantIdx(7) !== 0 || variantIdx(13) !== 0 || variantIdx(23) !== 0
    );

    return {
      meta: {
        engine: "ProgramEngine",
        version: VERSION,
        spec: L(isEn, rules, "spec") || (isEn ? "Custom Execution Program V2.3" : "맞춤 실행 프로그램 V2.3"),
        generatedAt: new Date().toISOString(),
        publishedAt: fmtDate(publishedAt),
        name: name,
        toneKey: toneKey,
        toneLabel: toneLabel,
        sourceReportSid: opts.sourceSid || null,
        axes: axes,
        strongAxis: sw.strong,
        weakAxis: sw.weak,
        keywords: dedupKeywords(allKw).slice(0, 8),
        lang: lang,
        // [PR#194] 고유성 가드 메타 — 저장/표시 측이 충돌 감지에 사용 (화면 영향 없음)
        _uniqGuard: {
          v: 2,
          fingerprint: hasFingerprint ? (fingerprint >>> 0) : null,
          uniqSig: _uniqSig,               // 비개인화 골격 시그니처
          skelLines: _skelNorm.length,
          variantApplied: _variantApplied  // 변주가 실제 적용됐는가(고유성 활성 여부)
        }
      },
      cover: coverSummary,
      quarter: quarter,
      program: {
        weeks: weeks,
        month3: month3,
        year1: year1
      },
      modules: modules,
      board: board,
      effects: effects,
      nextSteps: nextSteps,
      risks: risks,
      closing: closing,
      footer: {
        notice: footerLines,
        checklist: qualityChecklist
      },
      lang: lang
    };
  }

  /* ========================================================================
   *  helpers
   * ====================================================================== */
  function axisLabel(k, isEn){
    if (isEn) {
      return ({
        self_understanding: "Self-Understanding",
        self_expression:    "Self-Expression",
        self_design:        "Self-Design",
        self_execution:     "Self-Execution"
      })[k] || k;
    }
    return ({
      self_understanding: "자기이해",
      self_expression:    "자기표현",
      self_design:        "자기설계",
      self_execution:     "자기실행"
    })[k] || k;
  }

  function envByTone(t, isEn){
    if (isEn) {
      return ({
        principled_designer: "An environment that respects principles & standards, with autonomous time for thought and design",
        warm_connector:      "A warm, people-centered atmosphere with room for deep 1:1 conversations",
        visionary_creator:   "An environment where publishing & experiments move quickly, with guaranteed creative time",
        pragmatic_achiever:  "An environment with clear performance metrics and ownership of execution",
        reflective_explorer: "An environment for quiet exploration & learning, where reflection is respected"
      })[t] || "An environment where your self-distinctiveness can unfold";
    }
    return ({
      principled_designer: "원칙·기준이 존중받는 환경, 자율적 사색·설계 시간이 확보되는 자리",
      warm_connector:      "사람 중심의 따뜻한 분위기, 1:1 깊은 대화가 가능한 환경",
      visionary_creator:   "발행·실험이 빠르게 굴러가는 환경, 자율 창작 시간이 보장되는 자리",
      pragmatic_achiever:  "성과 지표가 분명하고 실행 권한이 주어지는 환경",
      reflective_explorer: "조용한 탐색·학습이 가능한 환경, 사색이 존중되는 자리"
    })[t] || "자기다움이 펼쳐질 수 있는 환경";
  }

  // 화살표 한 줄 — 사용자 확정 PR#53 일반화 (사명/비전 결과 동기화)
  //   각 톤은 [입력 단계] → [Compass 동사구] → [출력 단계] 3-step 구조로 재설계
  //   compassVerb가 있으면 가운데 단계를 Q63 Compass 동사구로 치환 (의미 새기기 / 단단함 지키기 / 배움 길어 올리기 / 자기 호흡대로 가기 / 마음 잇기 / 끝까지 마무리 / 몰입 살리기 / 원칙 지키기 / 맡은 자리 지키기)
  //   compassVerb가 없으면 톤별 기본 가운데 단계 사용 (구버전 리포트 호환)
  function arrowByTone(t, isEn, compassVerb){
    if (isEn) {
      // [입력 → 가운데(Compass) → 출력] 구조
      var enFrames = {
        principled_designer: ["Putting philosophy into words", "deep dialogue",      "real role experience"],
        warm_connector:      ["Listening to the heart",        "naming meaning",     "weaving trust"],
        visionary_creator:   ["Capturing ideas",               "publishing prototypes","refining the vision"],
        pragmatic_achiever:  ["Decide priority #1",            "focused blocks",     "quarterly retrospective"],
        reflective_explorer: ["Refining the question",         "small experiments",  "quiet reflection"]
      };
      var fr = enFrames[t] || ["Awareness", "expression", "execution"];
      var midEn = compassVerb || fr[1];
      return "\u2018" + fr[0] + " \u2192 " + midEn + " \u2192 " + fr[2] + "\u2019";
    }
    // [옵션 A 확정 / RULE-REPORT R3 #5] warm_connector 3단계 동사구 시그니처 보존.
    //   compassVerb가 있으면 가운데 단계가 자동 치환되므로 "마음 듣기"는 fallback 시에만 노출.
    //   (PR#63 / 2026-05-06)
    var koFrames = {
      principled_designer: ["철학 언어화", "깊은 대화",       "실제 역할 경험"],
      warm_connector:      ["마음 듣기",   "의미 새기기",     "신뢰로 잇기"],
      visionary_creator:   ["아이디어 캡처","프로토타입 발행","비전 정련"],
      pragmatic_achiever:  ["1순위 결정",  "집중 블록",       "분기 회고"],
      reflective_explorer: ["질문 다듬기", "작은 실험",       "조용한 회고"]
    };
    var krFr = koFrames[t] || ["인식", "표현", "실행"];
    var midKo = compassVerb || krFr[1];
    return "\u2018" + krFr[0] + " \u2192 " + midKo + " \u2192 " + krFr[2] + "\u2019";
  }

  /* [PR#193] 주차 헤드라인 변형 풀 — 톤×주차별 동의 변형 3종.
   *   variant=0 은 기존 GKO/GEN 과 동일(회귀 안전), 1·2 는 의미 보존 변형.
   *   fingerprint 가 variant 를 선택 → 같은 톤이라도 사용자별로 다른 헤드라인. */
  var GUIDE_VARIANTS_KO = {
    principled_designer: [
      ["내면의 기준을 한 문장으로 꺼내는 한 주", "마음속 원칙을 또렷한 언어로 옮기는 한 주", "내 안의 기준선을 글로 세우는 한 주"],
      ["관계 안에서 그 기준을 표현해 보는 한 주", "사람들 곁에서 내 원칙을 말로 꺼내는 한 주", "관계의 자리에서 기준을 나눠 보는 한 주"],
      ["작은 완수로 기준을 행동에 연결하는 한 주", "작은 마무리로 원칙을 실행에 잇는 한 주", "한 걸음 완수로 기준을 결과로 바꾸는 한 주"]
    ],
    warm_connector: [
      ["마음을 듣는 채널을 다시 여는 한 주", "사람의 마음에 귀를 다시 여는 한 주", "관계의 소리를 다시 듣기 시작하는 한 주"],
      ["감사·표현으로 관계를 데우는 한 주", "고마움을 건네 관계의 온도를 올리는 한 주", "따뜻한 표현으로 곁을 데우는 한 주"],
      ["관계를 자산으로 정리하는 한 주", "쌓인 신뢰를 자산으로 매듭짓는 한 주", "사람의 결을 관계 자산으로 묶는 한 주"]
    ],
    visionary_creator: [
      ["흩어진 아이디어를 밖으로 꺼내는 한 주", "머릿속 영감을 바깥으로 풀어내는 한 주", "떠도는 발상을 손에 잡히게 꺼내는 한 주"],
      ["초안을 빠르게 마감해 보는 한 주", "프로토타입을 속도감 있게 매듭짓는 한 주", "첫 버전을 빠르게 완성해 보는 한 주"],
      ["발행으로 다음 비전을 잇는 한 주", "세상에 내보내며 다음 그림을 여는 한 주", "공개로 다음 단계의 비전을 잇는 한 주"]
    ],
    pragmatic_achiever: [
      ["이번 분기 1순위를 분명히 하는 한 주", "분기의 핵심 목표를 또렷이 세우는 한 주", "가장 중요한 한 가지를 못 박는 한 주"],
      ["실행 보드를 매일 돌리는 한 주", "하루 단위로 실행을 굴리는 한 주", "매일 진척을 측정하며 실행하는 한 주"],
      ["회고로 다음 분기를 준비하는 한 주", "돌아보며 다음 분기 발판을 놓는 한 주", "성과를 정리해 다음 분기를 여는 한 주"]
    ],
    reflective_explorer: [
      ["질문을 또렷하게 다듬는 한 주", "내 안의 물음을 선명하게 벼리는 한 주", "핵심 질문 한 문장을 깎아 내는 한 주"],
      ["작은 실험으로 답에 다가가는 한 주", "가벼운 시도로 답의 윤곽을 찾는 한 주", "작은 실행으로 답을 더듬어 가는 한 주"],
      ["조용히 회고하며 다음 길을 잇는 한 주", "사색으로 다음 걸음을 잇는 한 주", "고요한 정리로 다음 방향을 여는 한 주"]
    ]
  };
  var GUIDE_VARIANTS_EN = {
    principled_designer: [
      ["A week to put your inner standard into one sentence", "A week to put your inner principle into clear words", "A week to write your inner baseline into one line"],
      ["A week to express that standard inside your relationships", "A week to voice your principle among people", "A week to share your standard within relationships"],
      ["A week to connect the standard to action through small completions", "A week to bridge your principle to action via small finishes", "A week to turn the standard into results step by step"]
    ],
    warm_connector: [
      ["A week to reopen the channel of listening to the heart", "A week to open your ears to people's hearts again", "A week to start hearing the sound of relationships again"],
      ["A week to warm up relationships through gratitude and expression", "A week to raise the warmth of bonds with thanks", "A week to warm those near you with kind expression"],
      ["A week to consolidate relationships as assets", "A week to settle built trust into an asset", "A week to bind people's grain into relational capital"]
    ],
    visionary_creator: [
      ["A week to bring scattered ideas out into the open", "A week to release inner inspiration outward", "A week to make drifting ideas tangible"],
      ["A week to wrap up the first draft quickly", "A week to finish the prototype with momentum", "A week to complete a first version fast"],
      ["A week to bridge to the next vision through publishing", "A week to open the next picture by shipping", "A week to link the next-stage vision via release"]
    ],
    pragmatic_achiever: [
      ["A week to clarify this quarter's #1 priority", "A week to set the quarter's core goal clearly", "A week to nail down the single most important thing"],
      ["A week to run the execution board every day", "A week to roll execution on a daily basis", "A week to execute while measuring daily progress"],
      ["A week to prepare the next quarter through retrospective", "A week to lay the next quarter's footing by reviewing", "A week to open the next quarter by consolidating results"]
    ],
    reflective_explorer: [
      ["A week to sharpen the question", "A week to hone your inner question clearly", "A week to carve out one core question"],
      ["A week to approach the answer through small experiments", "A week to find the answer's outline via light trials", "A week to feel toward the answer with small actions"],
      ["A week to reflect quietly and bridge to the next path", "A week to link the next step through contemplation", "A week to open the next direction with quiet ordering"]
    ]
  };

  function guideOfWeek(t, i, isEn, variant){
    // [PR#193] fingerprint 변주 우선 — 풀에서 variant 선택, 실패 시 기존 GKO/GEN 폴백
    var vlib = isEn ? GUIDE_VARIANTS_EN : GUIDE_VARIANTS_KO;
    var vpool = (vlib[t] || vlib.principled_designer)[i];
    if (Array.isArray(vpool) && vpool.length){
      var vi = ((variant || 0) % vpool.length + vpool.length) % vpool.length;
      if (vpool[vi]) return vpool[vi];
    }
    var GKO = {
      principled_designer: [
        "내면의 기준을 한 문장으로 꺼내는 한 주",
        "관계 안에서 그 기준을 표현해 보는 한 주",
        "작은 완수로 기준을 행동에 연결하는 한 주"
      ],
      // [옵션 A 확정 / RULE-REPORT R3 #6] warm_connector 1주차 헤드라인 시그니처 보존.
      //   (PR#63 / 2026-05-06)
      warm_connector: [
        "마음을 듣는 채널을 다시 여는 한 주",
        "감사·표현으로 관계를 데우는 한 주",
        "관계를 자산으로 정리하는 한 주"
      ],
      visionary_creator: [
        "흩어진 아이디어를 밖으로 꺼내는 한 주",
        "초안을 빠르게 마감해 보는 한 주",
        "발행으로 다음 비전을 잇는 한 주"
      ],
      pragmatic_achiever: [
        "이번 분기 1순위를 분명히 하는 한 주",
        "실행 보드를 매일 돌리는 한 주",
        "회고로 다음 분기를 준비하는 한 주"
      ],
      reflective_explorer: [
        "질문을 또렷하게 다듬는 한 주",
        "작은 실험으로 답에 다가가는 한 주",
        "조용히 회고하며 다음 길을 잇는 한 주"
      ]
    };
    var GEN = {
      principled_designer: [
        "A week to put your inner standard into one sentence",
        "A week to express that standard inside your relationships",
        "A week to connect the standard to action through small completions"
      ],
      warm_connector: [
        "A week to reopen the channel of listening to the heart",
        "A week to warm up relationships through gratitude and expression",
        "A week to consolidate relationships as assets"
      ],
      visionary_creator: [
        "A week to bring scattered ideas out into the open",
        "A week to wrap up the first draft quickly",
        "A week to bridge to the next vision through publishing"
      ],
      pragmatic_achiever: [
        "A week to clarify this quarter's #1 priority",
        "A week to run the execution board every day",
        "A week to prepare the next quarter through retrospective"
      ],
      reflective_explorer: [
        "A week to sharpen the question",
        "A week to approach the answer through small experiments",
        "A week to reflect quietly and bridge to the next path"
      ]
    };
    var src = isEn ? GEN : GKO;
    return (src[t] || src.principled_designer)[i] || (isEn ? "A week to organize the flow" : "한 주의 흐름을 정돈하는 한 주");
  }

  /* [PR#193 v2.1] 효과 포인트 동의어 변형 사전.
   *   원본 명사형 라인(키) → 의미 보존 변형 배열. 0번째는 원본과 동의(회귀 시 자연스러움).
   *   fingerprint 가 포인트별로 변형을 선택 → 같은 톤이라도 효과 '집합'이 사용자별로 상이.
   *   사전에 없는 라인은 원본 그대로 사용(안전 폴백). */
  var EFFECT_SYN_KO = {
    // visionary_creator (충돌 집중 톤) 전체 커버
    "아이디어 외화": ["아이디어 외화", "발상 끄집어내기", "착상 가시화"],
    "콘셉트 좁히기": ["콘셉트 좁히기", "콘셉트 선명화", "핵심 컨셉 압축"],
    "레퍼런스 정렬": ["레퍼런스 정렬", "참고자료 정돈", "레퍼런스 큐레이션"],
    "착수 가속": ["착수 가속", "첫발 빨리 떼기", "시작 속도 확보"],
    "프로토타입 마감": ["프로토타입 마감", "시제품 매듭", "초안 완결"],
    "피드백 수집": ["피드백 수집", "반응 모으기", "의견 수렴"],
    "덜어내기 결정": ["덜어내기 결정", "군더더기 제거", "핵심만 남기기"],
    "발행 임박": ["발행 임박", "출시 직전", "공개 준비 완료"],
    "외부 발행 1건": ["외부 발행 1건", "바깥세상 공개 1건", "퍼블리시 1건"],
    "반응 데이터 확보": ["반응 데이터 확보", "피드백 지표 수집", "반응 신호 포착"],
    "다음 비전 한 줄": ["다음 비전 한 줄", "차기 그림 한 문장", "다음 단계 비전 명문화"],
    "발행 자산화": ["발행 자산화", "공개물 자산화", "결과물 누적 자산"],
    // principled_designer
    "기준 언어화": ["기준 언어화", "원칙 문장화", "내면 기준 명문화"],
    "의도 명시": ["의도 명시", "의도 또렷화", "지향점 선언"],
    "사고 가시화": ["사고 가시화", "생각 드러내기", "사고 과정 노출"],
    "표현 시작": ["표현 시작", "첫 표현 착수", "발화 시작"],
    "감정 연결": ["감정 연결", "마음 잇기", "정서 연결"],
    "공감 표현": ["공감 표현", "공감 전달", "마음 표현"],
    "관계 데이터": ["관계 데이터", "관계 기록", "관계 신호 누적"],
    "패턴 인식": ["패턴 인식", "흐름 포착", "반복 패턴 발견"],
    "행동 완수": ["행동 완수", "실행 마무리", "한 걸음 완결"],
    "실행 패턴화": ["실행 패턴화", "실행 루틴화", "행동 습관화"],
    "다음 목표 연결": ["다음 목표 연결", "차기 목표 연결", "다음 단계 잇기"],
    "자기 자산화": ["자기 자산화", "자기다움 자산화", "고유성 누적"],
    // warm_connector
    "감정 인식": ["감정 인식", "마음 알아차림", "정서 자각"],
    "관계 온도 회복": ["관계 온도 회복", "관계 온기 되찾기", "사이 따뜻함 회복"],
    "기록 누적": ["기록 누적", "기록 쌓기", "흔적 축적"],
    "공감 채널 재가동": ["공감 채널 재가동", "공감 회로 재개", "마음 채널 재연결"],
    "감사 루틴 정착": ["감사 루틴 정착", "고마움 습관화", "감사 리듬 안착"],
    "표현 안전지대 확장": ["표현 안전지대 확장", "표현 여백 넓히기", "안전한 표현 공간 확대"],
    "관계 회복력 상승": ["관계 회복력 상승", "관계 탄력 강화", "사이 회복탄력 향상"],
    "긍정 데이터 누적": ["긍정 데이터 누적", "긍정 신호 축적", "좋은 경험 누적"],
    "깊이 대화 1건": ["깊이 대화 1건", "속 깊은 대화 1건", "진솔한 대화 1건"],
    "신뢰 네트워크 가시화": ["신뢰 네트워크 가시화", "신뢰 관계망 드러내기", "믿음의 연결 정리"],
    "다음 달 우선순위 확정": ["다음 달 우선순위 확정", "차월 1순위 결정", "다음 달 핵심 정하기"],
    "관계 자산화": ["관계 자산화", "관계를 자산으로", "사람 결을 자산으로"],
    // pragmatic_achiever
    "1순위 확정": ["1순위 확정", "최우선 결정", "핵심 한 가지 못 박기"],
    "KPI 가시화": ["KPI 가시화", "지표 드러내기", "측정 기준 명시"],
    "마일스톤 분해": ["마일스톤 분해", "단계 쪼개기", "이정표 세분화"],
    "캘린더 박아두기": ["캘린더 박아두기", "일정 고정", "달력에 못 박기"],
    "집중 블록 가동": ["집중 블록 가동", "몰입 시간 운영", "딥워크 블록 가동"],
    "임팩트 우선순위": ["임팩트 우선순위", "효과 중심 우선화", "영향력 기준 정렬"],
    "주간 진척 측정": ["주간 진척 측정", "한 주 진도 점검", "주간 성과 계측"],
    "방해 차단 정착": ["방해 차단 정착", "방해요소 차단 습관화", "집중 방해 제거 안착"],
    "분기 회고 완료": ["분기 회고 완료", "분기 돌아보기 완수", "한 분기 리뷰 마감"],
    "원인 → 보완 결정": ["원인 → 보완 결정", "원인 분석 후 보완안 결정", "근본원인→개선 도출"],
    "다음 분기 후보 도출": ["다음 분기 후보 도출", "차기 분기 과제 후보", "다음 분기 안건 추리기"],
    "결과 자산화": ["결과 자산화", "성과 자산화", "결과물 누적"],
    // reflective_explorer
    "질문 한 문장": ["질문 한 문장", "핵심 물음 한 줄", "질문 한 문장 정제"],
    "탐색 자료 정렬": ["탐색 자료 정렬", "탐구 재료 정돈", "참고 자료 큐레이션"],
    "사색 루틴 시작": ["사색 루틴 시작", "성찰 리듬 착수", "사유 습관 시작"],
    "실험 행동 12회": ["실험 행동 12회", "작은 실험 12회", "시도 12회 누적"],
    "한 줄 통찰 누적": ["한 줄 통찰 누적", "한 줄 깨달음 축적", "통찰 메모 쌓기"],
    "패턴 발견": ["패턴 발견", "흐름 발견", "반복 신호 포착"],
    "답의 윤곽": ["답의 윤곽", "해답의 실루엣", "답의 가닥"],
    "반복 키워드 표시": ["반복 키워드 표시", "재등장 단어 표시", "되풀이 키워드 마킹"],
    "‘작은 답’ 한 문단": ["‘작은 답’ 한 문단", "작은 결론 한 단락", "잠정 답 한 문단"],
    "다음 분기 질문": ["다음 분기 질문", "차기 분기 물음", "다음 분기 탐구 질문"],
    "사색 자산화": ["사색 자산화", "성찰 자산화", "사유 누적 자산"],
    // month3 / year1 고정 effects
    "분기 결과 가시화": ["분기 결과 가시화", "분기 성과 드러내기", "한 분기 결과 명료화"],
    "핵심 루틴 정착": ["핵심 루틴 정착", "핵심 습관 안착", "중심 리듬 정착"],
    "자기다움 자산화": ["자기다움 자산화", "고유성 자산화", "나다움 누적 자산"],
    "다음 분기 발판 형성": ["다음 분기 발판 형성", "차기 분기 디딤돌 마련", "다음 분기 기반 다지기"],
    "장기 비전 명문화": ["장기 비전 명문화", "장기 그림 문장화", "먼 목표 명문화"],
    "분기 사이클 완수": ["분기 사이클 완수", "분기 주기 완료", "한 분기 사이클 마감"],
    "신뢰·평판 자산화": ["신뢰·평판 자산화", "신뢰와 평판 누적", "믿음·명성 자산화"],
    "다음 1년 새 비전 도출": ["다음 1년 새 비전 도출", "내년 새 그림 도출", "차기 1년 비전 정립"]
  };
  var EFFECT_SYN_EN = {
    "Ideas externalized": ["Ideas externalized", "Ideas brought out", "Thoughts made tangible"],
    "Concept narrowed": ["Concept narrowed", "Concept sharpened", "Core concept compressed"],
    "References organized": ["References organized", "Reference material ordered", "References curated"],
    "Faster kickoff": ["Faster kickoff", "Quicker first step", "Momentum on start"],
    "Prototype shipped": ["Prototype shipped", "Prototype wrapped", "Draft completed"],
    "Feedback collected": ["Feedback collected", "Reactions gathered", "Opinions pooled"],
    "Cut-out decisions": ["Cut-out decisions", "Trimming decided", "Kept only the core"],
    "Publication imminent": ["Publication imminent", "Release at hand", "Ready to go public"],
    "One external publication": ["One external publication", "One public release", "One publish out"],
    "Response data secured": ["Response data secured", "Feedback metrics gathered", "Reaction signals captured"],
    "One-line next vision": ["One-line next vision", "Next picture in one line", "Next-stage vision stated"],
    "Publishing as asset": ["Publishing as asset", "Releases as assets", "Outputs accrued"],
    "Standards put into words": ["Standards put into words", "Principles written out", "Inner standard articulated"],
    "Intent made explicit": ["Intent made explicit", "Intent clarified", "Direction declared"],
    "Thinking made visible": ["Thinking made visible", "Thought surfaced", "Reasoning exposed"],
    "Expression begun": ["Expression begun", "First expression started", "Voice begun"],
    "Emotional connection": ["Emotional connection", "Hearts linked", "Affective bond"],
    "Empathic expression": ["Empathic expression", "Empathy conveyed", "Feelings expressed"],
    "Relationship data": ["Relationship data", "Relationship records", "Relational signals"],
    "Pattern recognition": ["Pattern recognition", "Flow noticed", "Recurring pattern found"],
    "Actions completed": ["Actions completed", "Execution finished", "Step concluded"],
    "Execution patterned": ["Execution patterned", "Execution routinized", "Behavior habituated"],
    "Next goal linked": ["Next goal linked", "Next target connected", "Bridge to next step"],
    "Self-asset built": ["Self-asset built", "Self-distinctiveness accrued", "Uniqueness accumulated"],
    "Quarterly results made visible": ["Quarterly results made visible", "Quarter outcomes surfaced", "Quarter results clarified"],
    "Core routine established": ["Core routine established", "Key habit settled", "Central rhythm set"],
    "Self-distinctiveness as an asset": ["Self-distinctiveness as an asset", "Uniqueness as an asset", "Your-own-ness accrued"],
    "Foothold for the next quarter": ["Foothold for the next quarter", "Stepping stone to next quarter", "Base for the next quarter"],
    "Long-term vision in writing": ["Long-term vision in writing", "Long-term picture written", "Far goal articulated"],
    "Quarterly cycles completed": ["Quarterly cycles completed", "Quarter cycle finished", "One quarter cycle closed"],
    "Trust & reputation as assets": ["Trust & reputation as assets", "Trust and reputation accrued", "Credibility & fame as assets"],
    "New vision for the next year": ["New vision for the next year", "Next year's new picture", "Vision set for the coming year"]
  };

  function effectsOfWeek(t, i, isEn, variant){
    // 4 포인트 명사형, 결과 중심 표현
    var EKO = {
      principled_designer: [
        ["기준 언어화", "의도 명시", "사고 가시화", "표현 시작"],
        ["감정 연결", "공감 표현", "관계 데이터", "패턴 인식"],
        ["행동 완수", "실행 패턴화", "다음 목표 연결", "자기 자산화"]
      ],
      warm_connector: [
        ["감정 인식", "관계 온도 회복", "기록 누적", "공감 채널 재가동"],
        ["감사 루틴 정착", "표현 안전지대 확장", "관계 회복력 상승", "긍정 데이터 누적"],
        ["깊이 대화 1건", "신뢰 네트워크 가시화", "다음 달 우선순위 확정", "관계 자산화"]
      ],
      visionary_creator: [
        ["아이디어 외화", "콘셉트 좁히기", "레퍼런스 정렬", "착수 가속"],
        ["프로토타입 마감", "피드백 수집", "덜어내기 결정", "발행 임박"],
        ["외부 발행 1건", "반응 데이터 확보", "다음 비전 한 줄", "발행 자산화"]
      ],
      pragmatic_achiever: [
        ["1순위 확정", "KPI 가시화", "마일스톤 분해", "캘린더 박아두기"],
        ["집중 블록 가동", "임팩트 우선순위", "주간 진척 측정", "방해 차단 정착"],
        ["분기 회고 완료", "원인 → 보완 결정", "다음 분기 후보 도출", "결과 자산화"]
      ],
      reflective_explorer: [
        ["질문 한 문장", "탐색 자료 정렬", "사색 루틴 시작", "기록 누적"],
        ["실험 행동 12회", "한 줄 통찰 누적", "패턴 발견", "답의 윤곽"],
        ["반복 키워드 표시", "‘작은 답’ 한 문단", "다음 분기 질문", "사색 자산화"]
      ]
    };
    var EEN = {
      principled_designer: [
        ["Standards put into words", "Intent made explicit", "Thinking made visible", "Expression begun"],
        ["Emotional connection", "Empathic expression", "Relationship data", "Pattern recognition"],
        ["Actions completed", "Execution patterned", "Next goal linked", "Self-asset built"]
      ],
      warm_connector: [
        ["Emotion noticed", "Relationship warmth restored", "Records accumulated", "Empathy channel reopened"],
        ["Gratitude routine settled", "Safe expression zone widened", "Relational resilience up", "Positive data accumulated"],
        ["One deep conversation", "Trust network visible", "Next month's priorities set", "Relationships as assets"]
      ],
      visionary_creator: [
        ["Ideas externalized", "Concept narrowed", "References organized", "Faster kickoff"],
        ["Prototype shipped", "Feedback collected", "Cut-out decisions", "Publication imminent"],
        ["One external publication", "Response data secured", "One-line next vision", "Publishing as asset"]
      ],
      pragmatic_achiever: [
        ["#1 priority set", "KPIs visible", "Milestones broken down", "Locked into the calendar"],
        ["Focus blocks running", "Impact prioritization", "Weekly progress measured", "Distraction-blocking habit"],
        ["Quarterly retro done", "Cause → fix decisions", "Next-quarter candidates", "Outcomes as assets"]
      ],
      reflective_explorer: [
        ["One-sentence question", "Research material ordered", "Reflection routine begun", "Records accumulated"],
        ["12 experimental actions", "One-line insights stored", "Pattern discovered", "Outline of an answer"],
        ["Repeating keywords flagged", "One paragraph 'small answer'", "Next-quarter question", "Reflection as asset"]
      ]
    };
    var src = isEn ? EEN : EKO;
    var base = (src[t] || src.principled_designer)[i] || (isEn
      ? ["Routine started","Records accumulated","Pattern recognition","Self-asset built"]
      : ["루틴 시작", "기록 누적", "패턴 인식", "자기 자산화"]);
    // [PR#193 v2.1] fingerprint 변주 — 2단계:
    //   ① 각 효과 포인트를 동의어 변형 사전(EFFECT_SYN)에서 결정론적 치환
    //      → 명사형 라인 '집합' 자체가 사용자별로 달라져 Set 유사도(고유성)가 실질 하락.
    //   ② 그 후 4개 포인트의 제시 순서를 회전.
    //   variant 0(=fingerprint 미가용) → 변형/회전 모두 없음(기존 출력과 100% 동일, 회귀 안전).
    if (variant && Array.isArray(base) && base.length){
      var synLib = isEn ? EFFECT_SYN_EN : EFFECT_SYN_KO;
      base = base.map(function(line, k){
        var pool = synLib[line];
        if (Array.isArray(pool) && pool.length){
          // 포인트마다 salt 를 달리(변주 분산), variant 자체가 이미 잘 섞인 큰 정수
          var vi = ((variant + k * 101) % pool.length + pool.length) % pool.length;
          return pool[vi] || line;
        }
        return line;
      });
    }
    if (variant && Array.isArray(base) && base.length > 1){
      var n = base.length;
      var sh = ((variant % n) + n) % n;
      if (sh) base = base.slice(sh).concat(base.slice(0, sh));
    }
    return base;
  }

  function toolsOfTone(t, i, isEn, variant){
    var TKO = {
      principled_designer: [["원칙 노트", "월간 회고 일지", "의사결정 프레임"],
                            ["깊은 대화 카드", "1:1 미팅 노트", "감정 단어 카드"],
                            ["커리어 나침반 시트", "분기 회고 보드", "철학 한 문장 시트"]],
      warm_connector:      [["감사 메시지 템플릿", "감정 일기 노트", "관계 캘린더"],
                            ["느낌 단어 카드", "1:1 대화 가이드", "회복 시간 캘린더"],
                            ["신뢰 네트워크 맵", "분기 관계 점검 시트", "감사 메시지 보관함"]],
      visionary_creator:   [["아이디어 캡처 노트", "레퍼런스 보드", "1주 프로토타입 시트"],
                            ["프로토타입 마감 보드", "피드백 노트", "덜어내기 체크리스트"],
                            ["발행 채널(블로그/SNS)", "비전 카피 시트", "분기 작품 인덱스"]],
      pragmatic_achiever:  [["KPI 시트", "분기 OKR 보드", "주간 1순위 카드"],
                            ["집중 블록 캘린더", "임팩트 매트릭스", "방해 차단 도구"],
                            ["분기 회고 보드", "원인 분석 5Why", "성과 포트폴리오 1쪽"]],
      reflective_explorer: [["사색 노트", "주간 통찰 카드", "독서 노트"],
                            ["작은 실험 시트", "한 줄 회고 노트", "월간 요약 1쪽"],
                            ["분기 질문 시트", "키워드 빈도 표", "‘작은 답’ 모음집"]]
    };
    var TEN = {
      principled_designer: [["Principles notebook", "Monthly retro journal", "Decision framework"],
                            ["Deep-conversation cards", "1:1 meeting notes", "Emotion-word cards"],
                            ["Career compass sheet", "Quarterly retro board", "One-sentence philosophy sheet"]],
      warm_connector:      [["Gratitude message template", "Emotion journal notebook", "Relationship calendar"],
                            ["Feeling-word cards", "1:1 conversation guide", "Recovery-time calendar"],
                            ["Trust network map", "Quarterly relationship review sheet", "Gratitude message archive"]],
      visionary_creator:   [["Idea-capture notebook", "Reference board", "1-week prototype sheet"],
                            ["Prototype shipping board", "Feedback notebook", "Cut-out checklist"],
                            ["Publishing channel (blog/SNS)", "Vision copy sheet", "Quarterly works index"]],
      pragmatic_achiever:  [["KPI sheet", "Quarterly OKR board", "Weekly #1 priority card"],
                            ["Focus block calendar", "Impact matrix", "Distraction-blocking tool"],
                            ["Quarterly retro board", "5-Why root-cause analysis", "1-page performance portfolio"]],
      reflective_explorer: [["Reflection notebook", "Weekly insight card", "Reading notebook"],
                            ["Small experiment sheet", "One-line retro notebook", "1-page monthly summary"],
                            ["Quarterly question sheet", "Keyword frequency chart", "'Small answers' collection"]]
    };
    var src = isEn ? TEN : TKO;
    var tbase = (src[t] || src.principled_designer)[i] || (isEn ? ["Notebook","Calendar","Retro sheet"] : ["노트", "캘린더", "회고 시트"]);
    // [PR#193] fingerprint 변주: 추천 도구 3종의 제시 순서를 결정론적 회전 (구성 보존, 순서만 차별화)
    if (variant && Array.isArray(tbase) && tbase.length > 1){
      var tn = tbase.length;
      var tsh = ((variant % tn) + tn) % tn;
      if (tsh) tbase = tbase.slice(tsh).concat(tbase.slice(0, tsh));
    }
    return tbase;
  }

  function dedupKeywords(arr){
    function root(s){
      return String(s||"")
        .replace(/적인$/, "").replace(/한$/, "").replace(/하는$/, "").replace(/스러운$/, "");
    }
    var seen = {}, out = [];
    for (var i = 0; i < arr.length; i++){
      var t = arr[i];
      if (!t) continue;
      var r = root(t) || String(t);
      if (seen[r]) continue;
      seen[r] = true;
      out.push(t);
    }
    return out;
  }

  return {
    version: VERSION,
    build: build,
    _internal: {
      pickTone: pickTone,
      pickAxes: pickAxes,
      axisLabel: axisLabel,
      dedupKeywords: dedupKeywords
    }
  };
});
