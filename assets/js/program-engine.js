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
  if (typeof module !== "undefined" && module.exports) module.exports = factory(root);
  else root.ProgramEngine = factory(root);
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  var VERSION = "v1.2"; // PR-진로직합성: CareerEngine 연결로 응답기반 직업 매칭

  // CareerEngine 참조 — 브라우저(전역) / Node(require) 양쪽 지원.
  //   응답 기반 직업 매칭에 사용. 미가용 시 ce=null → 톤 폴백(회귀 안전).
  var CareerEngine = (root && root.CareerEngine) ? root.CareerEngine : null;
  if (!CareerEngine && typeof require !== "undefined") {
    try { CareerEngine = require("./career-engine.js"); } catch (_e) { CareerEngine = null; }
  }

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
  //   하나로 흐르도록 보정. 리포트 내 mission_vision._slots 가 우선.
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
  /* [v1.4] 조사 병기형(을(를)/와(과)/이(가)/으로) → 앞 글자 받침에 맞는 단일 조사로 정리.
   *   예) "강점을(를)" → 받침O면 "강점을", 받침X면 "강점를"
   *   '으로'는 받침 없거나 ㄹ받침이면 "로", 그 외 "으로".
   */
  function _fixJosaPairs(s){
    if (typeof s !== "string") return s;
    // 조사 앞 받침 판정용 — 닫는 따옴표/괄호 등 마감 부호는 건너뛰고
    //   그 앞의 '가장 가까운 한글 음절'로 받침을 판정한다.
    //   예) "‘통찰력’으로" → 직전 char 가 ’(비한글)이지만 '력'(받침O)으로 판정.
    var _CLOSERS = "’'\"”’)〕】』」]｝}";  // 무시할 마감 부호
    function _jongBefore(full, idx){
      // full[idx] 가 조사 직전 char. 비한글이면 앞으로 거슬러 올라가 한글을 찾는다.
      var k = idx;
      while (k >= 0){
        var c = full.charAt(k);
        var j = _hangulJong(c);
        if (j !== -1) return j;               // 한글 음절 발견 → 받침값 반환
        if (_CLOSERS.indexOf(c) === -1) return -1; // 마감 부호가 아닌 비한글 → 비한글 처리
        k--;                                   // 마감 부호면 한 칸 더 앞으로
      }
      return -1;
    }
    // 을(를) / 와(과) / 이(가) / 은(는) 형태
    //   콜백 인자: (전체매치, 그룹1=ch, 그룹2=pair, offset, full)
    s = s.replace(/(.)(을\(를\)|를\(을\)|와\(과\)|과\(와\)|이\(가\)|가\(이\)|은\(는\)|는\(은\))/g, function(_m, ch, pair, off, full){
      var j = _jongBefore(full, off);   // off = ch 의 위치 → ch(또는 그 앞 한글)로 받침 판정
      var hasJong = (j > 0);          // 받침 있음
      // 비한글(-1) 또는 받침 없음(0) → 받침 없는 형
      if (pair.indexOf("을") === 0 || pair.indexOf("를") === 0) return ch + (hasJong ? "을" : "를");
      if (pair.indexOf("와") === 0 || pair.indexOf("과") === 0) return ch + (hasJong ? "과" : "와");
      if (pair.indexOf("이") === 0 || pair.indexOf("가") === 0) return ch + (hasJong ? "이" : "가");
      if (pair.indexOf("은") === 0 || pair.indexOf("는") === 0) return ch + (hasJong ? "은" : "는");
      return ch + pair;
    });
    // 으로 / 로 : "단어으로" 패턴을 받침에 맞게 (따옴표 건너뛰기 포함)
    //   콜백 인자: (전체매치, 그룹1=ch, offset, full)
    s = s.replace(/(.)으로/g, function(_m, ch, off, full){
      var j = _jongBefore(full, off);   // off = ch 의 위치
      // 받침 없음(0) 또는 ㄹ받침(8) 또는 비한글(-1) → "로", 그 외 받침 → "으로"
      if (j === 0 || j === 8 || j === -1) return ch + "로";
      return ch + "으로";
    });
    return s;
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
    // [PR-직관화] compassKw 명사를 다른 명사에 직접 붙이면 비문이 됨("사람 듣기", "결과 단어").
    //   → 점검/기록 문장에서 자연스럽게 풀어 쓸 일상어 명사구를 compass별로 매핑.
    //   80억 명 누구에게나 동일 규칙으로 적용 (9개 compass 중 1개로 결정론적 치환).
    var COMPASS_PLAIN_KO = {
      "의미":      "내가 의미 있다고 느낀 것",
      "단단함":    "마음이 단단해진 순간",
      "배움":      "새로 배운 것",
      "자기 호흡": "내 속도대로 한 일",
      "사람":      "사람들이 진짜 원하는 것",
      "결과":      "눈에 보이는 결과",
      "몰입":      "푹 빠져서 한 일",
      "원칙":      "내가 지키려는 기준",
      "책임":      "내가 맡은 몫"
    };
    var COMPASS_PLAIN_EN = {
      "meaning":"what felt meaningful","steadiness":"a moment you felt steady","learning":"something you newly learned",
      "your own pace":"what you did at your own pace","people":"what people truly want","results":"a visible result",
      "immersion":"what you got absorbed in","principle":"the standard you keep","responsibility":"the part you carry"
    };
    out.compassPlain = (isEn ? COMPASS_PLAIN_EN[kwInfo.kw] : COMPASS_PLAIN_KO[kwInfo.kw])
                       || (isEn ? "what matters to you" : "내가 중요하게 여기는 것");
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
  //   라벨 나열 대신 "사람의 마음을 살피며 의미가 흐르도록 잇는다" 처럼 합성.
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
      "관계지향": "사람의 마음을 살피며 마음이 머무는 자리를 만든다",
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
      "원칙지향": "정한 원칙을 끝까지 지키는 3개월",
      "관계지향": "약속을 지켜 신뢰를 쌓는 3개월",
      "성장지향": "원칙대로 한 걸음씩 나아가는 3개월",
      "자유지향": "내 기준을 지키며 자유롭게 가는 3개월"
    },
    warm_connector: {
      "원칙지향": "사람과 한 약속을 지켜 가는 3개월",
      "관계지향": "사람을 챙기며 신뢰를 쌓는 3개월",
      "성장지향": "사람을 만나며 함께 성장하는 3개월",
      "자유지향": "함께하면서도 내 색을 지키는 3개월"
    },
    visionary_creator: {
      "원칙지향": "떠오른 아이디어를 하나씩 완성하는 3개월",
      "관계지향": "사람을 생각하며 무언가 만들어 내는 3개월",
      "성장지향": "그리던 그림을 실제 결과로 만드는 3개월",
      "자유지향": "내 방식으로 새로운 것을 시도하는 3개월"
    },
    pragmatic_achiever: {
      "원칙지향": "정한 원칙대로 결과를 만드는 3개월",
      "관계지향": "사람과 한 약속을 결과로 챙기는 3개월",
      "성장지향": "결과를 내며 한 단계씩 자라는 3개월",
      "자유지향": "내 속도로 끝까지 결과를 내는 3개월"
    },
    reflective_explorer: {
      "원칙지향": "차분히 따져 보며 기준을 다듬는 3개월",
      "관계지향": "깊이 생각한 것을 사람과 나누는 3개월",
      "성장지향": "생각을 정리해 길을 찾아 가는 3개월",
      "자유지향": "조용히 내 길을 하나씩 그려 가는 3개월"
    }
  };
  var L3_QUARTER_HEADING_EN = {
    principled_designer: { "원칙지향":"3 months to keep the principles you set", "관계지향":"3 months to keep promises and build trust", "성장지향":"3 months to move forward step by step on principle", "자유지향":"3 months to go freely while keeping your standards" },
    warm_connector:      { "원칙지향":"3 months to keep your promises to people", "관계지향":"3 months to care for people and build trust", "성장지향":"3 months to grow together by meeting people", "자유지향":"3 months to stay together yet keep your own color" },
    visionary_creator:   { "원칙지향":"3 months to finish your ideas one by one", "관계지향":"3 months to make something with people in mind", "성장지향":"3 months to turn your vision into real results", "자유지향":"3 months to try new things in your own way" },
    pragmatic_achiever:  { "원칙지향":"3 months to deliver results on your principles", "관계지향":"3 months to keep promises and deliver results", "성장지향":"3 months to deliver results and grow step by step", "자유지향":"3 months to finish results at your own pace" },
    reflective_explorer: { "원칙지향":"3 months to think it through and refine your standards", "관계지향":"3 months to share what you thought deeply with people", "성장지향":"3 months to organize your thoughts and find your path", "자유지향":"3 months to quietly draw your own path step by step" }
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

  // 약축 → 보완점 합성 (점수·축% 노출 금지, 일상어로)
  var L3_GAP_KO = {
    self_understanding: "내 생각을 한 줄로 적어 보는 연습을 더한다",
    self_expression:    "느낀 것을 짧게 말이나 글로 표현해 보는 연습을 더한다",
    self_design:        "흩어진 할 일을 하나로 정리해 보는 연습을 더한다",
    self_execution:     "정한 것을 작게라도 끝내 보는 연습을 더한다"
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
    principled_designer: "원칙이 존중받고 자기 기준으로 사색할 자리가 있는 환경",
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
      "원칙지향": "원칙이 자연스럽게 지켜지는 자리",
      "관계지향": "사람들과 마음이 잘 통하는 자리",
      "성장지향": "날마다 조금씩 자라는 자리",
      "자유지향": "내 속도가 존중받는 자리"
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
    principled_designer: { "원칙지향":"흔들림 없는 한 길", "관계지향":"원칙으로 곁을 지키는 힘", "성장지향":"매일 한 뼘 깊어지는 힘", "자유지향":"자기 호흡으로 그어 가는 길" },
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
    principled_designer: "사명을 받쳐 주는 힘", warm_connector: "사명을 받쳐 주는 힘",
    visionary_creator: "사명을 받쳐 주는 힘", pragmatic_achiever: "사명을 받쳐 주는 힘",
    reflective_explorer: "사명을 받쳐 주는 힘"
  };
  var L3_HEAD_GAP_KO = {
    self_understanding: "한 줄로 적어 보는 힘", self_expression: "짧게 표현해 보는 힘",
    self_design: "하나로 정리하는 힘", self_execution: "작게 끝내는 힘"
  };
  var L3_HEAD_GAP_EN = {
    self_understanding: "Grain of one-line language", self_expression: "Grain of one breath",
    self_design: "Grain of one picture", self_execution: "Grain of small finish"
  };
  // [옵션 A 확정 / RULE-REPORT R3 #4] L3_HEAD_ENV_KO warm_connector 환경 시그니처 보존.
  //   (PR#63 / 2026-05-06)
  var L3_HEAD_ENV_KO = {
    principled_designer: "원칙이 자연스럽게 흐르는 자리", warm_connector: "마음이 머무는 자리",
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
  //   [개선 1 · PR#72] 직관·평이 전면 재작성 — 사명/비전/실행프로파일 개선과 동일 기준:
  //     ① 한 번에 읽히는 쉬운 행동(누가 봐도 바로 실행). 비유어("작품 재료/사람의 결과") 폐기.
  //     ② {{compassKw}}는 '오늘 지킬 ○○ 하나'처럼 자연스럽게만. '결과 결과' 식 중복 금지.
  //     ③ 사명/비전 전문({{missionHeadline}}/{{visionHeadline}}) 통째 삽입 폐기 → 짧은 참조로.
  //     ④ {{primaryDomain}} 어색 결합("경제의 초안") 폐기 → '내가 정한 분야' 등 평이어.
  //   주차 골격: 1주=눈에 보이게 시작, 2주=실제로 해 보고 나누기, 3주=정리하고 다음으로 잇기.
  var L3_WEEK_ACTION_KO = {
    warm_connector: {
      "관계지향": [
        ["매일 아침, 오늘 챙길 사람 한 명과 할 일 하나를 적어 둡니다.","대화에서 상대가 진짜 원하는 게 뭔지 한 가지 메모합니다.","하루 끝에, 오늘 사람과 좋았던 한 장면을 세 줄로 적습니다."],
        ["주 3회, 고마운 사람 한 명에게 짧은 안부 메시지를 보냅니다.","내가 먼저 솔직한 마음 한 문장을 표현해 봅니다.","함께 가고 싶은 사람 3명에게 내 계획을 한 줄로 공유합니다."],
        ["가까운 사람 한 명과 30분 깊은 대화를 나눕니다.","지난 3주 동안 고마웠던 사람 3명을 적어 봅니다.","다음 달에 더 가까워지고 싶은 사람 1명을 정합니다."]
      ],
      "원칙지향": [
        ["매일 아침, 오늘 꼭 지킬 기준 하나를 한 줄로 적습니다.","하루 중 그 기준이 흔들린 순간을 한 번 메모합니다.","하루 끝에, 기준을 지켜 낸 한 장면을 세 줄로 적습니다."],
        ["주 3회, 그날 내 기준을 잘 지켰는지 한 문장으로 돌아봅니다.","중요한 결정 하나를 내 기준에 비춰 다시 봅니다.","같은 기준을 나누고 싶은 사람 1명에게 메시지를 보냅니다."],
        ["나와 가치관이 맞는 사람과 30분 깊은 대화를 나눕니다.","지난 3주 동안 기준을 지킨 순간 3가지를 적습니다.","다음 분기 동안 지킬 핵심 원칙 하나를 정해 둡니다."]
      ],
      "성장지향": [
        ["매일 아침, 오늘 배우고 싶은 것 하나를 한 줄로 정합니다.","대화나 책에서 새로 알게 된 것 하나를 메모합니다.","하루 끝에, 오늘 한 뼘 자란 한 장면을 세 줄로 적습니다."],
        ["주 3회, 새로 배운 것을 한 문장으로 정리해 둡니다.","작은 실험 하나를 직접 해 보고 결과를 기록합니다.","함께 성장하고 싶은 사람 1명에게 메시지를 보냅니다."],
        ["배움을 나눌 수 있는 사람과 30분 깊은 대화를 나눕니다.","지난 3주 동안 배운 것을 다섯 줄로 정리합니다.","다음 분기에 도전할 실험 하나를 정해 둡니다."]
      ],
      "자유지향": [
        ["매일 아침, 오늘 내 방식대로 해 볼 일 하나를 정합니다.","남의 시선 때문에 망설인 순간을 한 번 메모합니다.","하루 끝에, 내 뜻대로 잘 흘러간 한 장면을 세 줄로 적습니다."],
        ["주 3회, 내 생각을 한 문장으로 솔직하게 표현합니다.","일정 하나를 내가 편한 방식으로 다시 짜 봅니다.","나를 응원해 주는 사람 1명에게 짧은 메시지를 보냅니다."],
        ["나를 있는 그대로 봐 주는 사람과 30분 대화를 나눕니다.","지난 3주 동안 내 뜻대로 한 일 3가지를 적습니다.","다음 달에 지킬 나만의 리듬 하나를 정해 둡니다."]
      ]
    },
    principled_designer: {
      "원칙지향": [
        ["매일 아침, 오늘 지킬 기준 하나를 한 줄로 적습니다.","결정하기 전에 '이게 내 기준에 맞나?'를 한 번 따져 봅니다.","하루 끝에, 기준을 지켜 낸 한 장면을 세 줄로 적습니다."],
        ["주 3회, 내가 정한 분야의 결정 하나를 기준에 비춰 다시 봅니다.","내 기준을 한 사람 앞에서 한 문장으로 설명해 봅니다.","흔들렸던 순간 3가지를 적고 보완할 점 하나를 정합니다."],
        ["같은 기준을 지키려는 사람과 30분 깊은 대화를 나눕니다.","지난 3주의 결정을 돌아보며 다섯 줄로 정리합니다.","다음 분기에 지킬 핵심 원칙 하나를 정해 둡니다."]
      ],
      "관계지향": [
        ["매일 아침, 오늘 사람과 지킬 약속 하나를 한 줄로 적습니다.","사람을 대할 때 내 기준을 잘 지켰는지 한 번 메모합니다.","하루 끝에, 가까운 사람과의 약속을 지킨 한 장면을 세 줄로 적습니다."],
        ["주 3회, 내가 중요하게 여기는 것을 한 사람에게 말해 봅니다.","가까운 사람과의 약속 하나를 점검합니다.","같은 마음을 가진 사람 1명에게 짧은 메시지를 보냅니다."],
        ["오래 함께한 사람과 30분 깊은 대화를 나눕니다.","지난 3주 가까운 사람과의 약속을 지킨 일 3가지를 적습니다.","다음 달에 함께 지킬 약속 하나를 정해 둡니다."]
      ],
      "성장지향": [
        ["매일 아침, 오늘 다듬을 것 하나를 한 줄로 적습니다.","새로 알게 된 것 하나를 메모해 둡니다.","하루 끝에, 한 뼘 나아진 한 장면을 세 줄로 적습니다."],
        ["주 3회, 작은 실험 하나를 해 보고 한 문장으로 정리합니다.","나를 한 단계 키워 줄 책이나 자료 하나를 매주 정합니다.","함께 배우고 싶은 사람 1명에게 메시지를 보냅니다."],
        ["같이 성장하는 사람과 30분 깊은 대화를 나눕니다.","지난 3주의 실험을 다섯 줄로 정리합니다.","다음 분기에 해 볼 실험 하나를 정해 둡니다."]
      ],
      "자유지향": [
        ["매일 아침, 오늘 내 방식대로 해 볼 일 하나를 정합니다.","결정하기 전에 '남 눈치가 아니라 내 기준인가?'를 따져 봅니다.","하루 끝에, 내 뜻대로 잘 흘러간 한 장면을 세 줄로 적습니다."],
        ["주 3회, 일정 하나를 내가 편한 방식으로 다시 짭니다.","내 생각을 한 사람 앞에서 한 문장으로 말해 봅니다.","나를 지지해 주는 사람 1명에게 짧은 메시지를 보냅니다."],
        ["나를 있는 그대로 봐 주는 사람과 30분 대화를 나눕니다.","지난 3주 내 뜻대로 한 일 3가지를 적습니다.","다음 달에 지킬 나만의 리듬 하나를 정해 둡니다."]
      ]
    },
    visionary_creator: {
      "원칙지향": [
        ["매일 아침, 오늘 만들 것 하나에 담을 기준을 한 줄로 적습니다.","시작하기 전에 '이게 내 기준에 맞나?'를 한 번 따져 봅니다.","하루 끝에, 만든 것에 기준이 담긴 한 장면을 세 줄로 적습니다."],
        ["주 3회, 초안 하나를 골라 기준에 맞게 한 번 다듬습니다.","내가 만들고 싶은 것을 한 줄 문구로 정리합니다.","내 계획을 함께해 줄 사람 1명에게 초안을 공유합니다."],
        ["같은 기준을 가진 사람과 30분 깊은 대화를 나눕니다.","지난 3주 만든 것을 돌아보며 다섯 줄로 정리합니다.","다음 분기에 완성할 작업 하나를 정해 둡니다."]
      ],
      "관계지향": [
        ["매일 아침, 오늘 만들 것이 누구에게 도움이 될지 한 사람을 떠올려 적습니다.","대화에서 사람들이 진짜 원하는 것 하나를 메모합니다.","하루 끝에, 누군가에게 도움이 된 순간 하나를 세 줄로 적습니다."],
        ["주 3회, 만든 초안을 한 사람에게 보여 주고 의견을 받습니다.","사람들에게 들은 이야기를 한 줄 문구로 묶어 봅니다.","함께할 사람 3명에게 내 계획을 한 줄로 공유합니다."],
        ["마음이 통하는 사람과 30분 깊은 대화를 나눕니다.","지난 3주 사람들에게 들은 것을 다섯 줄로 정리합니다.","다음 분기에 사람들과 함께 만들 것 하나를 정해 둡니다."]
      ],
      "성장지향": [
        ["매일 아침, 오늘 만들 것에 더할 새 아이디어 하나를 적습니다.","시작하기 전에 새로 떠오른 생각 하나를 메모합니다.","하루 끝에, 만든 것이 한 뼘 나아진 장면을 세 줄로 적습니다."],
        ["주 3회, 초안 하나를 빠르게 끝내 세상에 내놓습니다.","나를 키워 줄 자료 하나를 매주 골라 봅니다.","함께 만들 사람 1명에게 초안을 공유합니다."],
        ["같이 만드는 사람과 30분 깊은 대화를 나눕니다.","지난 3주 내놓은 것을 돌아보며 다섯 줄로 정리합니다.","다음 분기에 내놓을 것 하나를 정해 둡니다."]
      ],
      "자유지향": [
        ["매일 아침, 오늘 내 방식대로 만들 것 하나를 정합니다.","시작하기 전에 '남 따라가는 게 아니라 내 뜻인가?'를 따져 봅니다.","하루 끝에, 내 뜻대로 잘 만든 한 장면을 세 줄로 적습니다."],
        ["주 3회, 초안 하나를 내가 편한 방식으로 다듬습니다.","내가 만들고 싶은 것을 한 줄 문구로 정리합니다.","나를 지지해 주는 사람 1명에게 초안을 공유합니다."],
        ["나를 있는 그대로 봐 주는 사람과 30분 대화를 나눕니다.","지난 3주 내 뜻대로 만든 것 3가지를 적습니다.","다음 달에 내놓을 것 하나를 정해 둡니다."]
      ]
    },
    pragmatic_achiever: {
      "원칙지향": [
        ["매일 아침, 오늘 꼭 끝낼 일 하나를 한 줄로 정합니다.","시작하기 전에 '이게 정말 중요한 일인가?'를 한 번 따져 봅니다.","하루 끝에, 끝까지 마무리한 한 장면을 세 줄로 적습니다."],
        ["주 3회, 내가 정한 목표 하나의 진행 상황을 점검합니다.","이번 주에 낸 결과 하나를 한 줄로 정리합니다.","함께 해낼 사람 1명에게 짧은 메시지를 보냅니다."],
        ["같이 목표를 향하는 사람과 30분 깊은 대화를 나눕니다.","지난 3주의 결과를 돌아보며 다섯 줄로 정리합니다.","다음 분기에 꼭 이룰 핵심 결과 하나를 정해 둡니다."]
      ],
      "관계지향": [
        ["매일 아침, 오늘 사람과 함께 끝낼 일 하나를 한 줄로 정합니다.","대화에서 함께 정한 것 하나를 메모해 둡니다.","하루 끝에, 사람과 함께 마무리한 한 장면을 세 줄로 적습니다."],
        ["주 3회, 사람과 한 약속 하나를 끝까지 챙깁니다.","내가 낸 결과 하나를 한 사람에게 한 줄로 공유합니다.","함께 해낼 사람 3명에게 짧은 메시지를 보냅니다."],
        ["함께 일을 끝낸 사람과 30분 깊은 대화를 나눕니다.","지난 3주 함께 마무리한 일 3가지를 적습니다.","다음 달에 함께할 약속 하나를 정해 둡니다."]
      ],
      "성장지향": [
        ["매일 아침, 오늘 끝낼 작은 실험 하나를 한 줄로 정합니다.","새로 알게 된 것 하나를 메모해 둡니다.","하루 끝에, 한 뼘 나아간 결과 한 장면을 세 줄로 적습니다."],
        ["주 3회, 작은 실험 하나를 끝까지 마무리합니다.","이번 주에 낸 결과 하나를 한 줄로 정리합니다.","함께 도전할 사람 1명에게 짧은 메시지를 보냅니다."],
        ["같이 도전하는 사람과 30분 깊은 대화를 나눕니다.","지난 3주의 실험을 돌아보며 다섯 줄로 정리합니다.","다음 분기에 해 볼 핵심 실험 하나를 정해 둡니다."]
      ],
      "자유지향": [
        ["매일 아침, 오늘 내 방식대로 끝낼 일 하나를 정합니다.","시작하기 전에 '남 속도가 아니라 내 속도인가?'를 따져 봅니다.","하루 끝에, 내 뜻대로 마무리한 한 장면을 세 줄로 적습니다."],
        ["주 3회, 일정 하나를 내가 편한 방식으로 다시 짭니다.","이번 주에 낸 결과 하나를 한 줄로 정리합니다.","나를 지지해 주는 사람 1명에게 짧은 메시지를 보냅니다."],
        ["나를 있는 그대로 봐 주는 사람과 30분 대화를 나눕니다.","지난 3주 내 뜻대로 끝낸 일 3가지를 적습니다.","다음 달에 이룰 결과 하나를 정해 둡니다."]
      ]
    },
    reflective_explorer: {
      "원칙지향": [
        ["매일 아침, 오늘 곱씹어 볼 질문 하나를 한 줄로 정합니다.","하루 중 내 기준이 흔들린 순간을 한 번 메모합니다.","하루 끝에, 생각이 또렷해진 한 장면을 세 줄로 적습니다."],
        ["주 3회, 떠오른 생각 하나를 한 줄로 정리해 둡니다.","내가 품은 질문 하나를 한 문장으로 적어 봅니다.","같이 고민해 줄 사람 1명에게 질문을 보냅니다."],
        ["깊은 이야기를 나눌 사람과 30분 대화를 나눕니다.","지난 3주의 생각을 돌아보며 다섯 줄로 정리합니다.","다음 분기에 풀어 볼 질문 하나를 정해 둡니다."]
      ],
      "관계지향": [
        ["매일 아침, 오늘 사람에 대해 곱씹어 볼 질문 하나를 정합니다.","대화에서 마음에 남은 말 하나를 메모해 둡니다.","하루 끝에, 사람과의 한 장면을 세 줄로 적습니다."],
        ["주 3회, 한 사람과 짧은 생각을 주고받습니다.","사람들에게 들은 이야기를 한 줄 질문으로 묶어 봅니다.","같이 고민해 줄 사람 3명에게 질문을 보냅니다."],
        ["마음이 통하는 사람과 30분 깊은 대화를 나눕니다.","지난 3주 사람에게서 얻은 생각을 다섯 줄로 정리합니다.","다음 분기에 함께 풀어 볼 질문 하나를 정해 둡니다."]
      ],
      "성장지향": [
        ["매일 아침, 오늘 알아보고 싶은 질문 하나를 한 줄로 정합니다.","새로 알게 된 것 하나를 메모해 둡니다.","하루 끝에, 생각이 한 뼘 자란 한 장면을 세 줄로 적습니다."],
        ["주 3회, 작은 탐구 하나를 끝까지 해 봅니다.","품고 있는 질문 하나를 한 문장으로 적어 봅니다.","같이 알아갈 사람 1명에게 질문을 보냅니다."],
        ["같이 탐구하는 사람과 30분 깊은 대화를 나눕니다.","지난 3주의 탐구를 돌아보며 다섯 줄로 정리합니다.","다음 분기에 알아볼 것 하나를 정해 둡니다."]
      ],
      "자유지향": [
        ["매일 아침, 오늘 내 식대로 곱씹어 볼 질문 하나를 정합니다.","하루 중 생각이 흔들린 순간을 한 번 메모합니다.","하루 끝에, 내 뜻대로 흘러간 한 장면을 세 줄로 적습니다."],
        ["주 3회, 일정 하나를 내가 편한 방식으로 곱씹어 봅니다.","품은 질문 하나를 한 문장으로 적어 봅니다.","나를 지지해 주는 사람 1명에게 질문을 보냅니다."],
        ["나를 있는 그대로 봐 주는 사람과 30분 대화를 나눕니다.","지난 3주 내 뜻대로 흘러간 생각 3가지를 적습니다.","다음 달에 풀어 볼 질문 하나를 정해 둡니다."]
      ]
    }
  };

  // [2] 3개월 × 3목표 — 톤 × Compass
  // [PR#73 평이화] 3개월 목표 — 3단 구조(① 습관 만들기 ② 결과 쌓기 ③ 정리해 두기)를
  //   비유어(자산화/길어 올리는/한 호흡/카피/그릇/외화) 없이 일상 행동·숫자로만 표현.
  //   {{compassKw}} 단독 중복(예: '결과 결과') 방지를 위해 합성 시 같은 단어 반복을 피함.
  var L3_MONTH3_GOAL_KO = {
    warm_connector: {
      "관계지향": [{title:"사람을 챙기는 습관 만들기",criterion:"주 3회 안부 메시지 + 월 1회 깊은 대화 나누기"},{title:"신뢰한 사람 정리해 보기",criterion:"믿고 지내는 사람 15명을 한 장에 정리"},{title:"마음을 표현한 기록 쌓기",criterion:"3개월간 고마움·마음을 적은 기록 10건 모으기"}],
      "원칙지향": [{title:"사람과 한 약속 지키는 습관 만들기",criterion:"주 3회 사람과 한 약속 하나를 한 줄로 기록"},{title:"지킨 약속 눈에 보이게 하기",criterion:"끝까지 지킨 약속 5건 적어 두기"},{title:"한결같음 정리해 두기",criterion:"3개월간 어긋나지 않은 약속 10건 모으기"}],
      "성장지향": [{title:"사람을 만나며 배우는 습관 만들기",criterion:"주 3회 사람을 만나 배운 점 한 줄 기록"},{title:"배운 것 눈에 보이게 하기",criterion:"사람에게서 배운 것 5건 정리"},{title:"깊은 대화 쌓기",criterion:"3개월간 속 깊은 대화 12회 나누기"}],
      "자유지향": [{title:"내 색을 표현하는 습관 만들기",criterion:"주 3회 사람을 만나며 내 생각을 한 줄로 표현"},{title:"내 색이 살아난 순간 모으기",criterion:"휘둘리지 않고 내 색을 지킨 순간 5건"},{title:"내 생각 기록 쌓기",criterion:"3개월간 내 생각을 적은 기록 30건 모으기"}]
    },
    principled_designer: {
      "원칙지향": [{title:"기준대로 결정하는 습관 만들기",criterion:"주 3회 결정 직전 '내 기준에 맞나' 한 번 점검"},{title:"내 결정 눈에 보이게 하기",criterion:"기준대로 내린 결정 5건 적어 두기"},{title:"돌아본 기록 쌓기",criterion:"3개월간 결정을 돌아본 기록 12건 모으기"}],
      "관계지향": [{title:"사람 앞에서 기준 지키는 습관 만들기",criterion:"주 3회 한 사람 앞에서 내 기준을 한 문장으로 표현"},{title:"곁의 사람 정리해 보기",criterion:"믿고 지내는 가까운 사람 5명 정리"},{title:"한결같음 정리해 두기",criterion:"3개월간 어긋나지 않은 약속 10건 모으기"}],
      "성장지향": [{title:"기준을 다듬는 습관 만들기",criterion:"주 3회 새로 배운 점을 한 줄로 기록"},{title:"작은 시도 정리해 보기",criterion:"이번 분기에 해 본 작은 시도 5건 정리"},{title:"돌아본 기록 쌓기",criterion:"3개월간 돌아본 기록 12건 모으기"}],
      "자유지향": [{title:"내 기준대로 결정하는 습관 만들기",criterion:"주 3회 '내 기준에 맞나'를 스스로 묻고 기록"},{title:"내 기준대로 한 결정 모으기",criterion:"내 기준대로 내린 결정 5건"},{title:"내 색 기록 쌓기",criterion:"3개월간 내 생각을 적은 기록 30건 모으기"}]
    },
    visionary_creator: {
      "원칙지향": [{title:"기준대로 만드는 습관 만들기",criterion:"주 3회 만들기 전 '내 기준에 맞나' 한 번 점검"},{title:"만든 것 공개하기",criterion:"내 기준대로 만든 작업물 5개를 사람들에게 공개"},{title:"만든 작업물 한곳에 모으기",criterion:"3개월간 공개한 작업물 12개를 한 폴더에 모아 두기"}],
      "관계지향": [{title:"사람을 생각하며 만드는 습관 만들기",criterion:"주 3회, 사람들이 진짜 원하는 것 하나를 메모"},{title:"만든 것 공개하기",criterion:"사람들에게 도움이 될 작업물 5개를 만들어 공개"},{title:"만든 작업물 한곳에 모으기",criterion:"3개월간 공개한 작업물 12개를 한 폴더에 모아 두기"}],
      "성장지향": [{title:"새 아이디어로 만드는 습관 만들기",criterion:"주 3회, 만든 것을 한 번씩 더 다듬어 기록"},{title:"새 시도 공개하기",criterion:"새 아이디어를 담은 작업물 5개를 만들어 공개"},{title:"만든 작업물 한곳에 모으기",criterion:"3개월간 만든 작업물 12개를 한 폴더에 모아 두기"}],
      "자유지향": [{title:"내 방식대로 만드는 습관 만들기",criterion:"주 3회, 내 방식대로 만든 것을 기록"},{title:"새로운 시도 공개하기",criterion:"내 색이 담긴 작업물 5개를 만들어 공개"},{title:"만든 작업물 한곳에 모으기",criterion:"3개월간 공개한 작업물 12개를 한 폴더에 모아 두기"}]
    },
    pragmatic_achiever: {
      "원칙지향": [{title:"가장 중요한 일부터 끝내는 습관 만들기",criterion:"주 3회 오늘 끝낼 일 하나를 한 줄로 정하기"},{title:"목표를 숫자로 정하기",criterion:"이번 분기 핵심 목표(숫자) 5건 적어 두기"},{title:"끝낸 일 정리해 두기",criterion:"3개월간 끝까지 마무리한 일 10건 모으기"}],
      "관계지향": [{title:"사람과 한 약속을 끝내는 습관 만들기",criterion:"주 3회 사람과 한 약속 하나를 끝까지 챙기기"},{title:"함께 끝낸 일 눈에 보이게 하기",criterion:"사람과 함께 끝낸 일 5건을 한 줄씩 적어 두기"},{title:"함께한 일 정리해 두기",criterion:"3개월간 사람과 끝낸 일 10건 모으기"}],
      "성장지향": [{title:"작은 시도를 끝내는 습관 만들기",criterion:"주 3회 끝낸 작은 시도 하나를 한 줄로 기록"},{title:"시도 결과 눈에 보이게 하기",criterion:"이번 분기에 끝낸 시도 5건 정리"},{title:"끝낸 시도 정리해 두기",criterion:"3개월간 마무리한 시도 10건 모으기"}],
      "자유지향": [{title:"내 속도로 끝내는 습관 만들기",criterion:"주 3회 내 방식대로 끝낸 일 하나를 한 줄로 기록"},{title:"내가 끝낸 일 눈에 보이게 하기",criterion:"내 속도로 끝낸 일 5건을 한 줄씩 적어 두기"},{title:"끝낸 일 정리해 두기",criterion:"3개월간 마무리한 일 10건 모으기"}]
    },
    reflective_explorer: {
      "원칙지향": [{title:"매일 한 질문 던지는 습관 만들기",criterion:"주 3회 오늘의 질문 하나를 한 줄로 기록"},{title:"생각 깊이 정리해 보기",criterion:"이번 분기에 깊이 생각한 주제 5건 정리"},{title:"돌아본 기록 쌓기",criterion:"3개월간 돌아본 기록 12건 모으기"}],
      "관계지향": [{title:"사람과 생각 나누는 습관 만들기",criterion:"주 3회 사람과 나눈 생각 하나를 한 줄로 기록"},{title:"나눈 생각 정리해 보기",criterion:"사람과 깊이 나눈 주제 5건 정리"},{title:"나눈 기록 쌓기",criterion:"3개월간 사람과 나눈 생각 12건 모으기"}],
      "성장지향": [{title:"매일 한 질문 던지는 습관 만들기",criterion:"주 3회 오늘의 질문 하나를 한 줄로 기록"},{title:"작은 시도 정리해 보기",criterion:"이번 분기에 해 본 작은 시도 5건 정리"},{title:"찾은 답 쌓기",criterion:"3개월간 돌아본 기록 12건 모으기"}],
      "자유지향": [{title:"내 질문을 던지는 습관 만들기",criterion:"주 3회 내 질문 하나를 한 줄로 기록"},{title:"내 생각 정리해 보기",criterion:"내 방식으로 깊이 생각한 주제 5건 정리"},{title:"내 길 기록 쌓기",criterion:"3개월간 돌아본 기록 12건 모으기"}]
    }
  };

  // [3] 주간 점검 3항목 — 톤 × Compass [PR-직관화: 비문 제거, 일상 행동 점검문]
  //   원칙: '{{compassKw}} 단어/약속/회고' 식 명사 직접결합 금지.
  //         → {{compassPlain}}(자연어 명사구) + 실제로 할 수 있는 행동을 '~했는가'로.
  var L3_TRACK_WEEKLY_KO = {
    warm_connector: {
      "관계지향": ["마음을 전하는 메시지를 주 3회 이상 보냈는가","{{compassPlain}}을 한 가지 메모했는가","사람과의 대화에서 인상 깊었던 한 장면을 적었는가"],
      "원칙지향": ["사람과 한 약속을 지켰는가","마음이 흔들린 순간을 1개 적었는가","약속을 지킨 한 장면을 기록했는가"],
      "성장지향": ["사람에게서 배운 것을 한 가지 적었는가","작은 시도를 1개 해 봤는가","한 뼘 자란 순간을 기록했는가"],
      "자유지향": ["{{compassPlain}}을 한 문장으로 적어 봤는가","남에게 휘둘리지 않고 내 뜻대로 했는가","내 속도대로 흘러간 하루를 기록했는가"]
    },
    principled_designer: {
      "원칙지향": ["결정하기 전에 내 기준을 한 번 확인했는가","기준이 흔들린 순간을 1개 적었는가","기준을 지킨 한 장면을 기록했는가"],
      "관계지향": ["가까운 사람과 한 약속을 지켰는가","곁의 한 사람에게 마음을 한 문장 전했는가","한결같이 곁을 지킨 장면을 기록했는가"],
      "성장지향": ["새로 배운 것을 한 가지 적었는가","작은 시도를 1개 해 봤는가","한 뼘 자란 순간을 기록했는가"],
      "자유지향": ["결정하기 전에 내 기준을 한 번 확인했는가","남의 시선이 아니라 내 뜻대로 결정했는가","내 속도대로 흘러간 하루를 기록했는가"]
    },
    visionary_creator: {
      "원칙지향": ["무언가 만들기 전에 내 기준을 한 번 확인했는가","초안을 한 번 더 다듬었는가","내 기준이 담긴 결과물 한 장면을 기록했는가"],
      "관계지향": ["{{compassPlain}}을 만들 거리로 한 가지 메모했는가","초안을 한 사람에게 보여 줬는가","사람을 생각하며 만든 결과물 한 장면을 기록했는가"],
      "성장지향": ["새 아이디어를 만든 것에 한 번 적용해 봤는가","빠르게 끝내서 한 번 공개했는가","한 단계 나아진 결과물 한 장면을 기록했는가"],
      "자유지향": ["내 색대로 한 번 다듬었는가","유행이 아니라 내 색을 따랐는가","내 색이 담긴 결과물 한 장면을 기록했는가"]
    },
    pragmatic_achiever: {
      "원칙지향": ["오늘 끝낼 결과 1개를 정했는가","결정하기 전에 내 기준을 한 번 확인했는가","기준대로 마무리한 한 장면을 기록했는가"],
      "관계지향": ["사람과 한 약속을 끝까지 챙겼는가","함께 마무리한 결과를 적었는가","사람과 함께 끝낸 한 장면을 기록했는가"],
      "성장지향": ["오늘 끝낼 시도 1개를 정했는가","{{compassPlain}}을 결과에 한 가지 담았는가","한 단계 나아진 결과 한 장면을 기록했는가"],
      "자유지향": ["내 속도로 끝낼 결과 1개를 정했는가","남의 속도가 아니라 내 속도를 따랐는가","내 속도대로 마무리한 한 장면을 기록했는가"]
    },
    reflective_explorer: {
      "원칙지향": ["오늘 다듬을 질문 한 줄을 정했는가","기준이 흔들린 순간을 1개 적었는가","생각이 정리된 한 장면을 기록했는가"],
      "관계지향": ["{{compassPlain}}을 한 가지 적어 봤는가","사람과 생각을 한 번 주고받았는가","대화에서 마음이 머문 한 장면을 기록했는가"],
      "성장지향": ["새로 배운 것을 한 가지 적었는가","작은 시도 1개를 끝까지 생각해 봤는가","한 뼘 자란 생각 한 장면을 기록했는가"],
      "자유지향": ["내 질문 한 줄을 정했는가","마음이 흔들린 순간을 1개 적었는가","내 속도대로 흘러간 생각을 기록했는가"]
    }
  };

  // [4] 월간 점검 3항목 — 톤 × Compass [PR-직관화: '노트/일기 갱신' 추상어 → 한 달 단위 눈에 보이는 점검]
  var L3_TRACK_MONTHLY_KO = {
    warm_connector: {
      "관계지향": ["이번 달 속 깊은 대화를 1번 이상 나눴는가","믿을 수 있는 사람이 한 명 더 늘었는가","사람과 나눈 좋은 기억이 쌓이고 있는가"],
      "원칙지향": ["사람과 한 약속을 이번 달에도 지켰는가","어긋나지 않은 약속이 늘고 있는가","한결같이 곁을 지킨 기록이 쌓이고 있는가"],
      "성장지향": ["사람을 만나며 배운 것이 한 가지라도 늘었는가","이번 달 작은 시도가 쌓이고 있는가","한 뼘 자란 기록이 쌓이고 있는가"],
      "자유지향": ["내 뜻대로 살아난 순간이 이번 달에 있었는가","남에게 휘둘리지 않은 결정이 늘고 있는가","내 속도대로 산 기록이 쌓이고 있는가"]
    },
    principled_designer: {
      "원칙지향": ["내 기준대로 내린 결정이 이번 달에 쌓였는가","돌아본 결정 기록이 늘고 있는가","한 길로 걸어온 기록이 쌓이고 있는가"],
      "관계지향": ["가까운 사람과 한 약속을 이번 달에도 지켰는가","어긋나지 않은 약속이 쌓이고 있는가","한결같이 곁을 지킨 기록이 쌓이고 있는가"],
      "성장지향": ["이번 달 새로 배운 것이 쌓였는가","새로 만난 배움 기록이 늘고 있는가","작은 시도 기록이 쌓이고 있는가"],
      "자유지향": ["내 기준대로 내린 결정이 이번 달에 쌓였는가","내 뜻대로 한 기록이 늘고 있는가","또렷한 내 색이 담긴 기록이 쌓이고 있는가"]
    },
    visionary_creator: {
      "원칙지향": ["만든 결과물을 돌아본 기록이 쌓였는가","공개한 결과 기록이 늘고 있는가","내 색이 분명한 결과물이 쌓이고 있는가"],
      "관계지향": ["사람들이 원하는 것을 모은 기록이 늘고 있는가","사람을 생각하며 공개한 결과가 쌓였는가","사람을 위해 만든 결과물이 쌓이고 있는가"],
      "성장지향": ["새로 만든 결과를 돌아본 기록이 쌓였는가","빠르게 끝낸 기록이 늘고 있는가","점점 나아지는 결과물이 쌓이고 있는가"],
      "자유지향": ["내 색대로 만든 결과를 돌아봤는가","내 색이 담긴 기록이 늘고 있는가","내 속도대로 만든 결과물이 쌓이고 있는가"]
    },
    pragmatic_achiever: {
      "원칙지향": ["이번 달 낸 결과를 돌아본 기록이 쌓였는가","결과 점검 기록이 늘고 있는가","끝맺은 일 기록이 쌓이고 있는가"],
      "관계지향": ["사람과 함께 끝낸 결과가 이번 달에 쌓였는가","함께한 약속 기록이 늘고 있는가","함께 만든 결과 기록이 쌓이고 있는가"],
      "성장지향": ["이번 달 시도해 본 결과가 쌓였는가","시도 기록이 늘고 있는가","답이 보이는 결과 기록이 쌓이고 있는가"],
      "자유지향": ["내 속도대로 끝낸 결과가 이번 달에 쌓였는가","내 속도 기록이 늘고 있는가","흐트러짐 없는 결과 기록이 쌓이고 있는가"]
    },
    reflective_explorer: {
      "원칙지향": ["차분히 돌아본 기록이 이번 달에 쌓였는가","던진 질문 기록이 늘고 있는가","한 길로 깊어진 기록이 쌓이고 있는가"],
      "관계지향": ["사람과 나눈 생각이 이번 달에 쌓였는가","사람과 주고받은 질문 기록이 늘고 있는가","대화에서 얻은 생각이 쌓이고 있는가"],
      "성장지향": ["이번 달 새로 떠오른 질문이 쌓였는가","작은 시도 기록이 늘고 있는가","답이 되어 가는 기록이 쌓이고 있는가"],
      "자유지향": ["내 방식대로 돌아본 생각이 이번 달에 쌓였는가","내 질문 기록이 늘고 있는가","또렷한 내 길 기록이 쌓이고 있는가"]
    }
  };

  // [5] 다음 단계 (m1/m3/y1) — 톤별 (mission/vision 결합)
  var L3_NEXTSTEPS_KO = {
    warm_connector: { m1:"\u2018{{missionHeadline}}\u2019에 한 걸음 다가가기 위해, 마음을 전하는 짧은 메시지를 매주 한 번 보내 봅니다.", m3:"{{primaryDomain}}에서 속 깊은 대화 3번을 3개월 결과로 남깁니다.", y1:"1년 뒤 \u2018{{visionHeadline}}\u2019에 가까워지도록, 믿을 수 있는 사람들의 관계 지도 한 장을 만들어 둡니다." },
    principled_designer: { m1:"\u2018{{missionHeadline}}\u2019에 한 걸음 다가가기 위해, 결정하기 전에 내 기준을 한 번 확인하는 습관을 시작합니다.", m3:"{{primaryDomain}}에서 내 기준대로 내린 결정 5건을 3개월 결과로 적어 둡니다.", y1:"1년 뒤 \u2018{{visionHeadline}}\u2019에 가까워지도록, 한 해 동안의 결정과 배움을 정리한 기록 한 권을 완성합니다." },
    visionary_creator: { m1:"\u2018{{missionHeadline}}\u2019에 한 걸음 다가가기 위해, 떠오른 아이디어를 한 줄로 적어 보는 습관을 시작합니다.", m3:"{{primaryDomain}}에서 직접 내놓은 결과물 3건을 3개월 결과로 남깁니다.", y1:"1년 뒤 \u2018{{visionHeadline}}\u2019에 가까워지도록, 한 해 동안 만든 결과물을 모은 작업 모음집 한 권을 완성합니다." },
    pragmatic_achiever: { m1:"\u2018{{missionHeadline}}\u2019에 한 걸음 다가가기 위해, 매주 가장 중요한 한 가지를 먼저 끝내는 습관을 시작합니다.", m3:"{{primaryDomain}}에서 눈에 보이는 결과 목표 1개를 3개월 안에 끝냅니다.", y1:"1년 뒤 \u2018{{visionHeadline}}\u2019에 가까워지도록, 한 해 동안 낸 결과를 정리한 성과 모음 한 쪽을 완성합니다." },
    reflective_explorer: { m1:"\u2018{{missionHeadline}}\u2019에 한 걸음 다가가기 위해, 하루 한 가지 질문을 한 줄로 적어 보는 습관을 시작합니다.", m3:"{{primaryDomain}}에서 차분히 돌아본 기록 3건을 3개월 결과로 남깁니다.", y1:"1년 뒤 \u2018{{visionHeadline}}\u2019에 가까워지도록, 한 해 동안의 생각을 정리한 기록 한 권을 완성합니다." }
  };
  var L3_NEXTSTEPS_EN = {
    warm_connector: { m1:"Begin one routine of {{compassKw}} messages to move closer to \u2018{{missionHeadline}}\u2019.", m3:"Secure three {{compassKw}} deep conversations in {{primaryDomain}} as the quarter\u2019s result.", y1:"Complete a one-page {{compassKw}} network so that one year on you stand as \u2018{{visionHeadline}}\u2019." },
    principled_designer: { m1:"Begin a {{compassKw}} principle-question routine to move closer to \u2018{{missionHeadline}}\u2019.", m3:"Articulate five {{compassKw}} decisions in {{primaryDomain}} as the quarter\u2019s result.", y1:"Complete a one-volume retrospective on one steady line so that one year on you stand as \u2018{{visionHeadline}}\u2019." },
    visionary_creator: { m1:"Begin a {{compassKw}} one-line work copy to move closer to \u2018{{missionHeadline}}\u2019.", m3:"Ship three {{compassKw}} publications in {{primaryDomain}} as the quarter\u2019s result.", y1:"Complete a one-volume works index in your color so that one year on you stand as \u2018{{visionHeadline}}\u2019." },
    pragmatic_achiever: { m1:"Begin a {{compassKw}} result-first routine to move closer to \u2018{{missionHeadline}}\u2019.", m3:"Close one {{compassKw}} KPI in {{primaryDomain}} as the quarter\u2019s result.", y1:"Complete a one-page result portfolio so that one year on you stand as \u2018{{visionHeadline}}\u2019." },
    reflective_explorer: { m1:"Begin a {{compassKw}} one-line-question routine to move closer to \u2018{{missionHeadline}}\u2019.", m3:"Secure three {{compassKw}} reflection retrospectives in {{primaryDomain}} as the quarter\u2019s result.", y1:"Complete a one-volume reflection book on your own path so that one year on you stand as \u2018{{visionHeadline}}\u2019." }
  };

  // [6] 모듈 summary — 톤별 3개 [PR#73 평이화]
  //   원칙: 사명/비전 직접 인용 + 조사 결합(을/를)이 깨지지 않도록 인용 뒤에 조사를 붙이지 않음.
  //         비유어(외화/그릇/카피/한 호흡/자산) 제거 → "무엇을 돕는 도구인지"를 평이하게 설명.
  var L3_MODULE_SUMMARY_KO = {
    warm_connector: ["내 사명(\u2018{{missionHeadline}}\u2019)에 매주 한 걸음 다가가도록 돕는 도구입니다.","내 마음을 부담 없이 표현해 보는 첫 연습 공간입니다.","쌓인 신뢰를 분기마다 한 번씩 정리해 두는 방법입니다."],
    principled_designer: ["내 사명(\u2018{{missionHeadline}}\u2019)대로 결정하도록 돕는 점검 도구입니다.","결정하기 전에 내 기준을 한 번 더 확인하는 습관 장치입니다.","내 결정을 분기마다 돌아보며 정리해 두는 방법입니다."],
    visionary_creator: ["내 사명(\u2018{{missionHeadline}}\u2019)을 짧은 한 줄로 옮겨 보도록 돕는 도구입니다.","머릿속 아이디어를 실제로 내놓아 보는 첫 연습 공간입니다.","만든 결과를 분기마다 한곳에 모아 정리해 두는 방법입니다."],
    pragmatic_achiever: ["내 사명(\u2018{{missionHeadline}}\u2019)을 매주 결과로 옮기도록 돕는 우선순위 도구입니다.","내가 낼 결과를 분명한 숫자 목표로 적어 두는 장치입니다.","낸 결과를 분기마다 한곳에 모아 정리해 두는 방법입니다."],
    reflective_explorer: ["내 사명(\u2018{{missionHeadline}}\u2019)을 매일 한 질문으로 옮겨 보도록 돕는 도구입니다.","떠오른 생각을 작게 시험해 보는 첫 연습 공간입니다.","생각의 흐름을 분기마다 돌아보며 정리해 두는 방법입니다."]
  };

  // [7] 분기 리드 3줄 — 톤 × Compass
  var L3_QUARTER_PARAS_KO = {
    warm_connector: {
      "관계지향": ["이미 {{name}}님은 사람을 따뜻하게 챙기는 마음을 충분히 갖고 있습니다.","이번 분기는 그 마음을 '듣고, 표현하고, 정리하는' 작은 습관으로 만드는 시간입니다.","{{primaryDomain}}에서 작은 습관 하나가 자리 잡으면 사람과의 신뢰가 눈에 띄게 쌓입니다."],
      "원칙지향": ["이미 {{name}}님은 사람과 한 약속을 한결같이 지키고 있습니다.","이번 분기는 그 약속을 '지키고, 쌓고, 정리하는' 습관으로 만드는 시간입니다.","{{primaryDomain}}에서 어긋나지 않는 약속이 하나씩 쌓이면 신뢰가 단단해집니다."],
      "성장지향": ["이미 {{name}}님은 사람을 만날 때마다 한 가지씩 배우고 있습니다.","이번 분기는 그 배움을 '만나고, 배우고, 정리하는' 습관으로 만드는 시간입니다.","{{primaryDomain}}에서 한 사람과의 깊은 대화가 분기마다 한 걸음의 성장을 만듭니다."],
      "자유지향": ["이미 {{name}}님은 사람들과 함께 있어도 자기 색을 또렷이 지키고 있습니다.","이번 분기는 그 색을 '함께하고, 지키고, 정리하는' 습관으로 만드는 시간입니다.","{{primaryDomain}}에서 휘둘리지 않는 모습이 오히려 사람들의 신뢰를 만듭니다."]
    },
    principled_designer: {
      "원칙지향": ["이미 {{name}}님은 결정하기 전에 자기 기준을 한 번 더 확인하고 있습니다.","이번 분기는 그 기준을 '점검하고, 결정하고, 돌아보는' 습관으로 만드는 시간입니다.","{{primaryDomain}}에서 흔들리지 않는 결정이 하나씩 쌓이면 원칙이 분명한 길이 됩니다."],
      "관계지향": ["이미 {{name}}님은 가까운 사람과 한 약속을 한결같이 지키고 있습니다.","이번 분기는 그 약속을 '지키고, 쌓고, 정리하는' 습관으로 만드는 시간입니다.","{{primaryDomain}}에서 가까운 사람과의 약속을 어김없이 지키면 그게 단단한 신뢰가 됩니다."],
      "성장지향": ["이미 {{name}}님은 새로 배운 것을 매일 한 줄로 정리하고 있습니다.","이번 분기는 그 배움을 '다듬고, 깊이 보고, 정리하는' 습관으로 만드는 시간입니다.","{{primaryDomain}}에서 작은 시도 하나가 분기마다 한 걸음 더 깊은 이해를 만듭니다."],
      "자유지향": ["이미 {{name}}님은 남의 시선이 아니라 자기 기준대로 결정하고 있습니다.","이번 분기는 그 기준을 '점검하고, 내 방식대로 결정하고, 정리하는' 습관으로 만드는 시간입니다.","{{primaryDomain}}에서 또렷한 내 기준이 새로운 길을 엽니다."]
    },
    visionary_creator: {
      "원칙지향": ["이미 {{name}}님은 무언가 만들 때마다 자기 기준을 분명히 지키고 있습니다.","이번 분기는 그 기준을 '초안 만들기, 다듬기, 정리하기' 습관으로 만드는 시간입니다.","{{primaryDomain}}에서 색이 분명한 결과가 하나씩 쌓이면 나만의 스타일이 자리 잡습니다."],
      "관계지향": ["이미 {{name}}님은 주변 사람을 생각하며 무언가 만들어 내고 있습니다.","이번 분기는 '사람들이 원하는 것을 듣고 → 그것을 만들고 → 정리하는' 습관을 자리 잡게 하는 시간입니다.","{{primaryDomain}}에서 누군가에게 정말 필요한 것을 결과물 하나로 만들어 낼 때 새로운 길이 열립니다."],
      "성장지향": ["이미 {{name}}님은 만들 때마다 새로운 아이디어를 더하고 있습니다.","이번 분기는 그 시도를 '초안 만들기, 빠르게 끝내기, 정리하기' 습관으로 만드는 시간입니다.","{{primaryDomain}}에서 공개한 결과 하나가 분기마다 한 단계 더 나은 작업을 만듭니다."],
      "자유지향": ["이미 {{name}}님은 유행이 아니라 내 방식대로 만들고 있습니다.","이번 분기는 그 방식을 '초안 만들기, 내 색대로 다듬기, 정리하기' 습관으로 만드는 시간입니다.","{{primaryDomain}}에서 내 색이 담긴 결과 하나가 새로운 길을 엽니다."]
    },
    pragmatic_achiever: {
      "원칙지향": ["이미 {{name}}님은 일을 끝내기 전에 자기 기준을 분명히 지키고 있습니다.","이번 분기는 그 기준을 '1순위 정하기, 끝내기, 정리하기' 습관으로 만드는 시간입니다.","{{primaryDomain}}에서 흐트러지지 않는 결과가 하나씩 쌓이면 실력이 결과로 증명됩니다."],
      "관계지향": ["이미 {{name}}님은 사람과 한 약속을 끝까지 챙기고 있습니다.","이번 분기는 그 약속을 '정하기, 함께 끝내기, 정리하기' 습관으로 만드는 시간입니다.","{{primaryDomain}}에서 함께 끝낸 결과 하나가 다음 약속을 가능하게 합니다."],
      "성장지향": ["이미 {{name}}님은 결과를 내며 분기마다 한 단계씩 자라고 있습니다.","이번 분기는 그 흐름을 '시도하기, 끝내기, 정리하기' 습관으로 만드는 시간입니다.","{{primaryDomain}}에서 끝낸 일 하나가 분기마다 한 단계 자란 결과를 만듭니다."],
      "자유지향": ["이미 {{name}}님은 남의 속도가 아니라 내 속도로 결과를 끝내고 있습니다.","이번 분기는 그 속도를 '1순위 정하기, 내 방식대로 끝내기, 정리하기' 습관으로 만드는 시간입니다.","{{primaryDomain}}에서 흐트러짐 없는 결과 하나가 사람들의 신뢰를 만듭니다."]
    },
    reflective_explorer: {
      "원칙지향": ["이미 {{name}}님은 매일 한 가지 질문을 스스로 던지고 있습니다.","이번 분기는 그 질문을 '묻고, 생각하고, 정리하는' 습관으로 만드는 시간입니다.","{{primaryDomain}}에서 잘 다듬은 질문 하나가 한 걸음 더 깊은 이해를 만듭니다."],
      "관계지향": ["이미 {{name}}님은 사람과 깊은 생각을 나누고 있습니다.","이번 분기는 그 대화를 '듣고, 생각하고, 정리하는' 습관으로 만드는 시간입니다.","{{primaryDomain}}에서 한 사람과의 대화가 생각을 한 걸음 더 나아가게 합니다."],
      "성장지향": ["이미 {{name}}님은 질문을 작은 시도로 옮기며 답을 찾고 있습니다.","이번 분기는 그 흐름을 '묻고, 작게 시도하고, 정리하는' 습관으로 만드는 시간입니다.","{{primaryDomain}}에서 작은 시도 하나가 분기마다 한 걸음 더 분명한 답을 만듭니다."],
      "자유지향": ["이미 {{name}}님은 차분히 자기 길을 또렷이 그려 가고 있습니다.","이번 분기는 그 길을 '묻고, 내 방식대로 생각하고, 정리하는' 습관으로 만드는 시간입니다.","{{primaryDomain}}에서 차분한 생각 하나가 새로운 길을 엽니다."]
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
    // PR#199: 유형 라벨 일관성 — 같은 사람의 '리포트'와 '실행프로그램'이 서로 다른
    //   유형 명칭을 보이던 문제(고유성/일관성 결함) 해결. 리포트가 이미 확정한
    //   유형 라벨(report.tone.label)을 단일 진실 소스로 계승한다.
    //   (리포트 라벨 부재 시에만 program-rules.json tones[].label 로 폴백)
    var reportToneLabel = (report && report.tone && typeof report.tone === "object" && report.tone.label) ? report.tone.label : "";
    var toneLabel = reportToneLabel || L(isEn, tonePack, "label") || toneKey;

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

    // ══════════════════════════════════════════════════════════════════
    //  [PR-진로직합성 2026-06-15] CareerEngine 연결 — 응답 기반 직업 매칭.
    //   배경: 기존 newPaths/fitJob/expansion 은 tonePack 고정값이라 같은 톤이면
    //         직업이 항상 동일("새로고침해도 같다"의 근본 원인). 어떤 응답자는
    //         운동선수, 어떤 응답자는 배우/사업가/연구자가 나와야 하는데 변별이 없었음.
    //   해법: report.answers(56문항) + careerRules(13영역×5subType 풀)로 CareerEngine
    //         을 실제 호출 → primaryDomain×subType, 융합형, 열정결합형 직업을 산출.
    //   안전: careerRules/CareerEngine/answers 중 하나라도 없으면 ce=null → 기존
    //         톤 폴백 그대로(회귀 안전). 캐시된 옛 프로그램은 영향 없음.
    // ══════════════════════════════════════════════════════════════════
    var ce = null;
    try {
      var _careerRules = opts.careerRules || rules.careerRules || null;
      var _CE = (typeof CareerEngine !== "undefined") ? CareerEngine
              : (typeof root !== "undefined" && root.CareerEngine) ? root.CareerEngine
              : (typeof window !== "undefined" && window.CareerEngine) ? window.CareerEngine
              : null;
      var _answers = report.answers || (report.profile && report.profile.answers) || null;
      if (_CE && _careerRules && _answers) {
        ce = _CE.build(_answers, opts.mapping || rules.mapping || {}, _careerRules, fingerprint, {
          lang: lang, toneKey: toneKey
        });
      }
    } catch (eCE) {
      ce = null; // 진로엔진 실패는 비치명적 — 톤 폴백 사용
    }

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
    //     - userWeakGrain  : 약축 보완 한 호흡 (예: "한 호흡 언어로 옮기는 힘")
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
      "공감하는":"사람의 마음을 살피는","따뜻한":"따뜻한",
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
      self_understanding:"내 생각을 한 줄로 적어 보는 힘",
      self_expression:   "느낀 것을 짧게 표현해 보는 힘",
      self_design:       "흩어진 할 일을 하나로 정리하는 힘",
      self_execution:    "정한 것을 작게라도 끝내 보는 힘"
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
                       || (isEn ? "the grain to add" : "더 채워 가면 좋은 힘");

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
      compassPlain:    mvVars.compassPlain,
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
    /* [PR-고유한결] toneTagline 응답기반 변주
     *   배경: '고유한 결 — {toneLabel} · {toneTagline}' 중 toneLabel 은 응답기반(OK)이나
     *         toneTagline 은 톤 고정값이라 같은 톤 사용자끼리 100% 동일 → 고유성 훼손.
     *   해법: tones[tone].taglinePool(의미 보존 변주 8개) 중 fingerprint 로 1개 결정 선택.
     *         같은 사람=항상 같은 결과(재현성), 다른 사람=다른 표현(고유성).
     *   축적/회귀 안전: 풀 부재(구버전 데이터) 또는 fingerprint 미가용 시 기존 tagline 폴백.
     */
    var toneTagline;
    (function(){
      var _pool = L(isEn, tonePack, "taglinePool");
      var _base = L(isEn, tonePack, "tagline") || "";
      if (Array.isArray(_pool) && _pool.length) {
        var _v = variantIdx(0x7A6C); // 'tagline' salt
        var _i = (_v % _pool.length + _pool.length) % _pool.length;
        toneTagline = _pool[_i] || _base;
      } else {
        toneTagline = _base;
      }
    })();
    var typeLine = isEn
      ? (name + "'s own grain — " + toneLabel + (toneTagline ? (" · " + toneTagline) : ""))
      : (name + "님의 고유한 결 — " + toneLabel + (toneTagline ? (" · " + toneTagline) : ""));

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
        // 평이체 단문 — 사명 직접 인용
        quote = "\u201C이 프로그램은 " + name + "님의 사명 \u2014 \u2018" + mhRaw + "\u2019 \u2014 "
              + "을 하루하루 실천으로 옮겨 갑니다.\u201D";
      }
    } else {
      // PR#54: essence 폴백 차단 — 사명·비전 자리표시 인용으로 대체
      //   v4.1 업그레이드가 안 된 옛 캐시는 의미 결을 흐리지 않도록
      //   '자기다움' 추상 표현으로만 묶고, 점수·기법 언급은 제거
      quote = isEn
        ? ("\u201CThis program moves " + name + "'s self-distinctive grain into one breath of each day.\u201D")
        : ("\u201C이 프로그램은 " + name + "님의 자기다움을 하루하루 실천으로 옮겨 갑니다.\u201D");
    }

    // [PR-진로직합성 2026-06-15] '이 사명이 여는 길' = 응답 기반 직업(CareerEngine) 우선.
    //   ce.careers = [primaryDomain×subType, 융합형, 열정결합형] — 응답자마다 다른 직업.
    //   → 어떤 응답자는 '운동 코치·스포츠 트레이너', 어떤 응답자는 '배우·연출가',
    //     또 다른 응답자는 '창업가·신사업 기획자'가 나옴(변별 확보).
    //   ce 미가용(캐시·구버전) 시에만 tonePack.newPaths 고정 폴백.
    var newPathsArr;
    if (ce && Array.isArray(ce.careers) && ce.careers.length) {
      // 융합형 라벨("경제·교육 융합형 — X")은 화면에서 'X'만 노출하도록 정리.
      newPathsArr = ce.careers.map(function (c) {
        var s = String(c || "").trim();
        var m = s.match(/융합형\s*[—-]\s*(.+)$/);
        return m ? m[1].trim() : s;
      }).filter(Boolean);
      // 중복 제거(같은 직업 반복 방지). education 직업까지 응답 기반으로 보충.
      newPathsArr = newPathsArr.filter(function (x, i) { return newPathsArr.indexOf(x) === i; });
      if (newPathsArr.length < 3 && ce.education && ce.education.length) {
        ce.education.forEach(function (e) {
          var es = String(e || "").trim();
          if (es && newPathsArr.indexOf(es) === -1 && newPathsArr.length < 3) newPathsArr.push(es);
        });
      }
      // ce 응답 기반 직업만 노출(톤 고정 폴백 혼입 금지 — 응답 변별 보존). 최대 4개.
      newPathsArr = newPathsArr.slice(0, 4);
    } else {
      newPathsArr = (L(isEn, tonePack, "newPaths") || []);
    }
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
        : (top3Join + " \u2014 이 사명을 받쳐 주는 힘.");
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
    var strengthsHead = isEn ? "The strength that carries this mission" : (L3_HEAD_STRENGTHS_KO[toneKey] || "사명을 받쳐 주는 힘");
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
    // PR#72 평이화: 회원 응답을 짧게 결합하되, 비유어("한 호흡"/"자기 방식으로"/"의식적으로") 제거.
    //   원칙: 회원이 적은 응답 중 '첫 항목 하나'만 골라 짧고 실행 가능한 행동으로 제시.
    var _firstItem = function(s){ s = (s || "").trim(); if (!s) return ""; s = s.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim(); if (!s) return ""; return s.split(/[,/]/)[0].trim(); };
    var actAct = _firstItem(userActivities);
    var envAct = _firstItem(userFocusEnv);
    var WEEK_PERSONALIZE_KO = [
      // week 1: Q39/Q41 (관심 활동) 결합 — 좋아하는 활동 하나를 실제로 해 본다
      (actAct ? ("이번 주에 좋아하는 활동(" + actAct + ")을 한 번 직접 해 봅니다.") : "이번 주에 좋아하는 활동을 한 번 직접 해 봅니다."),
      // week 2: Q73 (성취 도구) 결합 — 내가 보람을 느끼는 순간을 한 번 만든다
      (userTool1 ? ("이번 주에 '" + userTool1 + "' 같은 순간을 한 번 만들어 봅니다.") : "이번 주에 내가 보람을 느끼는 순간을 한 번 만들어 봅니다."),
      // week 3: Q47/Q49 (몰입 환경) 결합 — 집중이 잘 되는 곳에서 한 번 일해 본다
      (envAct ? ("집중이 잘 되는 곳(" + envAct + ")에서 한 번 차분히 일해 봅니다.") : "집중이 잘 되는 곳에서 한 번 차분히 일해 봅니다.")
    ];
    var WEEK_PERSONALIZE_EN = [
      (actAct ? ("This week, try one activity you enjoy (" + actAct + ") once.") : "This week, try one activity you enjoy once."),
      (userTool1 ? ("This week, create one moment like '" + userTool1 + "'.") : "This week, create one moment that feels rewarding to you."),
      (envAct ? ("Work calmly once in a place where you focus well (" + envAct + ").") : "Work calmly once in a place where you focus well.")
    ];
    /* [PR-주차고유성 v1.4] 3주 루틴 2단 구조 — 대원칙-A(고유성×직관 동시) 적용
     *   문제: 주차 title/guide/actions 는 톤×Compass 고정이라 같은 톤·카테고리면
     *         거의 동일(고유성 0.3%). personalizeLine 한 줄만 응답 노출.
     *   해법: 주차별 의미(1주=꺼내기, 2주=증명, 3주=정착)에 맞춰 응답 변수
     *         (userTopStrength·primaryDomain·compassKw)를 종합한 '직관 한 줄' subline 을
     *         fingerprint 변주 풀에서 선택해 각 주차에 덧붙인다.
     *   축적(대원칙-B): 응답 변수 부재 시 subline 생략 → 기존 출력 보존(회귀 안전).
     */
    function weekSubline(i){
      var dom = (vars.primaryDomain || "").trim();
      var str = (vars.userTopStrength || "").trim();
      var kw  = (vars.compassKw || "").trim();
      if (!dom && !str && !kw) return ""; // 응답 부재 → 폴백(생략)
      var koPools = [
        // week 1 — 꺼내기/탐색
        [
          "{str}을(를) 한 번 꺼내 {dom}에서 시험해 보는 주",
          "{kw}을(를) 떠올리며 {dom}의 첫 실마리를 잡는 주",
          "{str}이(가) 어디서 살아나는지 {dom}에서 확인하는 주",
          "{dom}에서 {kw}이(가) 닿는 지점을 더듬어 보는 주",
          "{str}을(를) 작게 한 번 {dom}에 던져 보는 주",
          "{dom}의 입구에서 {str}을(를) 가만히 살펴보는 주"
        ],
        // week 2 — 증명/실행
        [
          "{str}을(를) {dom} 안에서 한 가지로 증명하는 주",
          "{kw}을(를) {dom}의 작은 결과로 옮겨 보는 주",
          "{str}와(과) {dom}이(가) 만나 형태가 잡히는 주",
          "{dom}에서 {kw}을(를) 손에 잡히는 결과로 만드는 주",
          "{str}을(를) {dom}의 결과물 하나로 굳혀 보는 주",
          "{dom}에서 {str}을(를) 눈에 보이게 밀어붙이는 주"
        ],
        // week 3 — 정착/확장
        [
          "{str}을(를) {dom}의 리듬으로 자리 잡게 하는 주",
          "{kw}을(를) {dom}에 흔적으로 남기는 주",
          "{str}이(가) {dom}에서 반복되는 습관이 되는 주",
          "{dom}에서 {kw}이(가) 다음으로 이어지게 다지는 주",
          "{str}을(를) {dom}에서 한 번 더 다듬어 정리하는 주",
          "{dom}에 남긴 {str}을(를) 다음 분기로 잇는 주"
        ]
      ];
      var enPools = [
        [
          "A week to take out {str} and test it in {dom}.",
          "A week to catch the first thread of {dom} around {kw}.",
          "A week to see where {str} comes alive in {dom}."
        ],
        [
          "A week to prove {str} as one thing inside {dom}.",
          "A week to move {kw} into a small result in {dom}.",
          "A week where {str} meets {dom} and takes shape."
        ],
        [
          "A week to settle {str} into the rhythm of {dom}.",
          "A week to leave {kw} as a mark on {dom}.",
          "A week where {str} becomes a repeated habit in {dom}."
        ]
      ];
      if (isEn){
        var ep = enPools[i] || enPools[enPools.length-1];
        var ei = variantIdx(0x6201 + i) % ep.length;
        return ep[ei].replace(/\{str\}/g, str||"your strength").replace(/\{dom\}/g, dom||"your field").replace(/\{kw\}/g, kw||"meaning");
      }
      var kp = koPools[i] || koPools[koPools.length-1];
      var ki = variantIdx(0x6201 + i) % kp.length;
      var s = kp[ki];
      s = s.replace(/\{str\}/g, str || "강점")
           .replace(/\{dom\}/g, dom || "내 분야")
           .replace(/\{kw\}/g, kw || "의미");
      s = _fixJosaPairs(s);
      return s;
    }
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
        // [v1.4 대원칙-A] 응답 종합 2단 subline(직관 한 줄) — 주차 의미별 변주
        subline: weekSubline(i),
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
          title: "Make one real result in something you enjoy (" + (_firstItem(userActivities) || "your chosen activity") + ")",
          criterion: "By the end of 3 months, you have 3 results that gave you a sense of '" + userTool1 + "'"
        }
      : {
          title: "좋아하는 일(" + (_firstItem(userActivities) || "관심 활동") + ")에서 남에게 보여 줄 수 있는 결과물 하나 만들기",
          // [PR-직관화 · #2] '○○ 같은 보람을 느낀 결과' → 결과물이 손에 그려지는 표현으로.
          //   userTool1(Q73 성취조건, 예: "문제를 해결하고 결과가 나왔을 때")은 '~할 때' 보람 순간이므로
          //   '그 보람을 느낄 만한' 으로 자연스럽게 풀어 '때…그때' 중복을 없애고, '눈에 보이는 결과물 3개'로 손에 그려지게.
          criterion: "3개월 뒤, '" + userTool1 + "' 그 보람을 느낄 만한 결과물 3개를 손에 남기기"
        };
    var month3GoalsBase = (l3Month3Goals && l3Month3Goals.length)
      ? l3Month3Goals.map(function(g){ return { title: tpl(g.title, vars), criterion: tpl(g.criterion, vars) }; })
      : month3GoalsRaw.map(function(g){ return { title: L(isEn, g, "title"), criterion: L(isEn, g, "criterion") }; });
    var month3 = {
      guide: isEn
        ? "Define the three results that should actually take root this quarter."
        : "3개월 뒤 손에 남길 결과 3가지를 미리 정해 둡니다.",
      goals: month3GoalsBase.concat([monthGoalCustom]),
      // [PR#193 v2.1] 고정 분기 효과도 fingerprint 변주(동의어+회전) → 동일 톤 간 중복 해소
      effects: varyEffects(isEn
        ? ["Quarterly results made visible","Core routine established","Self-distinctiveness as an asset","Foothold for the next quarter"]
        : ["분기 결과 가시화", "핵심 루틴 정착", "나다운 결과 쌓기", "다음 분기 발판 형성"], 41, isEn)
    };

    var year1Pack = tonePack.year1 || {};
    // PR#60-C: 1년 비전에 회원 진단 응답 직접 결합 — milestones 마지막에 'Q41 × Q39 × Q47 환경' 결합 1줄 추가
    //   원칙: 기존 마일스톤 보존, 회원 진단 결합 1줄 덧붙임 → 회원의 환경/주제/활동이 1년 후 도달점에 직접 노출
    var milestonesBase = tplArr(L(isEn, year1Pack, "milestones") || [], vars);
    var milestoneCustom = isEn
      ? ("In a place where you focus well (" + (_firstItem(userFocusEnv) || "your space") + "), finish one result you're proud of in something you enjoy (" + (_firstItem(userActivities) || "your activity") + ")")
      : ("집중이 잘 되는 곳(" + (_firstItem(userFocusEnv) || "내 공간") + ")에서 좋아하는 일(" + (_firstItem(userActivities) || "관심 활동") + ")로 내가 자랑할 만한 결과 하나 완성하기");
    var year1 = {
      guide: isEn
        ? "Capture next year's destination as one vision sentence and three milestones."
        : "1년 뒤 나의 모습을 한 문장으로, 그리고 그곳에 닿았다는 증거 세 가지로 그려 둡니다.",
      vision: tplArr(L(isEn, year1Pack, "vision") || [], vars),
      milestones: milestonesBase.concat([milestoneCustom]),
      // [PR#193 v2.1] 고정 1년 효과도 fingerprint 변주
      effects: varyEffects(isEn
        ? ["Long-term vision in writing","Quarterly cycles completed","Trust & reputation as assets","New vision for the next year"]
        : ["장기 비전 한 줄로 적기", "분기 사이클 완수", "신뢰와 평판 쌓기", "다음 1년 새 비전 도출"], 53, isEn)
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
      ? ("Use your achievement condition ('" + userTool1 + "') as the doorway to build " + tpl(userWeakGrain, vars) + ".")
      : ("\u2018" + userTool1 + "\u2019 같은 순간을 계기로, " + tpl(userWeakGrain, vars) + "을 조금씩 키워 갑니다.");
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
      : (" 기록은 회원님의 몰입 환경(" + userFocusEnv + ") 안에서 유지해 흐름을 잃지 않습니다.");
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
    // [PR-진로직합성 2026-06-15] 직무 적합성/직업 확장성에 '응답 기반 실제 직업명' 결합.
    //   ce.careers[0] = 1순위 분야×강점subType 직업(가장 잘 맞는 직무),
    //   ce.careers[1] = 융합형(확장 직업) — 응답자마다 달라짐.
    //   직무 적합성: "[1순위 직업] 직무에 특히 잘 맞습니다" 형태로 직관화.
    var _cleanCareer = function (c) {
      var s = String(c || "").trim();
      var m = s.match(/융합형\s*[—-]\s*(.+)$/);
      return m ? m[1].trim() : s;
    };
    var _ceFit = (ce && ce.careers && ce.careers[0]) ? _cleanCareer(ce.careers[0]) : "";
    var _ceExp = (ce && ce.careers && ce.careers[1]) ? _cleanCareer(ce.careers[1])
               : ((ce && ce.careers && ce.careers[2]) ? _cleanCareer(ce.careers[2]) : "");
    var effects = isEn ? {
      fitJob:    "Job fit: "          + (_ceFit ? (_ceFit + " — a strong match for your strengths")
                                                : ((L(isEn, teff, "fitJob") || "Stronger fit for roles in your field")
                                                   + (_domainLabelEn ? (" — anchored in " + _domainLabelEn) : ""))),
      expansion: "Career expansion: " + (_ceExp ? ("Expandable toward " + _ceExp + (_domainLabelEn ? (" across " + _domainLabelEn) : ""))
                                                : ((L(isEn, teff, "expansion") || "Self-distinctive 1-person brand / side-project expansion")
                                                   + (_domainLabelEn ? (" across " + _domainLabelEn) : ""))),
      career:    "Career growth: "    + (L(isEn, teff, "career")    || "Self-assets accumulated as outcomes"),
      vision:    "Life vision: "      + (L(isEn, teff, "vision")    || "\u201CSomeone whose self-distinctiveness becomes influence\u201D"),
      newPaths:  (function(){
        var base = newPathsArr.slice(0, 4);
        // [PR-진로직합성] ce 있으면 직업 우선; 없을 때만 도메인 라벨 prefix.
        if (!ce && _domainLabelEn) base = [(_domainLabelEn + " — interest-domain combination paths")].concat(base).slice(0, 4);
        return base;
      })()
    } : {
      // [PR-진로직합성] 응답 기반 직업명을 직무 적합성/확장성에 직접 노출 → 응답자마다 다른 직업.
      fitJob:    "직무 적합성: "    + (_ceFit ? (_ceFit + " 직무에 특히 잘 맞습니다"
                                                + (_domainLabelKo ? (" — " + _domainLabelKo + " 분야 기반") : ""))
                                              : ((teff.fitJob || "관련 분야 직무 적합성 강화")
                                                 + (_domainLabelKo ? (" — " + _domainLabelKo + " 분야 결합") : ""))),
      expansion: "직업 확장성: "    + (_ceExp ? (_ceExp + (function(){ var j=_hangulJong(_ceExp.slice(-1)); return (j===0)?"로":((j===8)?"로":"으로"); })() + " 확장 가능"
                                                + (_domainLabelKo ? (" — " + _domainLabelKo + " 영역으로") : ""))
                                              : ((teff.expansion || "자기다움 기반 1인 브랜드 / 사이드 프로젝트 확장")
                                                 + (_domainLabelKo ? (" — " + _domainLabelKo + " 영역으로 확장") : ""))),
      career:    "경력 성장: "      + (teff.career    || "자기 자산을 결과로 누적"),
      vision:    "인생 설계 비전: " + (teff.vision    || "\u201C자기다움이 곧 영향력이 되는 사람\u201D"),
      newPaths:  (function(){
        var base = newPathsArr.slice(0, 4);
        // [PR-진로직합성] ce(응답기반 직업) 있으면 직업명을 1순위로 노출(도메인 라벨 prefix 생략).
        //   ce 없을 때만(구버전·캐시) 기존 PR#61-1 도메인 결합 라벨을 맨 앞에 붙인다.
        if (!ce && _domainLabelKo) base = [(_domainLabelKo + " 분야 결합 가능성")].concat(base).slice(0, 4);
        return base;
      })()
    };

    /* ------------------------------------------------------------------
     * §6 다음 단계 제안 (1년 사이클 완주 이후 가이드)
     * ------------------------------------------------------------------ */
    // [PR-#5 재설계] 이 섹션을 둔 이유:
    //   프로그램(3주 → 3개월 → 1년)은 닫힌 설계가 아니라, 한 사이클을 마치면
    //   그 결과물이 다음 사이클의 출발점이 되는 '나선형 성장'이다.
    //   "이 프로그램은 끝이 아니라 시작"임을 보여 주는 자리.
    //   (이전 구현은 1개월/3개월/1년 = 본문 타임라인을 그대로 반복해 의미가 없었음 → 폐기)
    // 새 원칙:
    //   · 본문 타임라인(3주/3개월/1년)을 다시 풀어쓰지 않는다.
    //   · 오직 '1년 사이클을 마친 뒤' 한 지점만 가리킨다 — 다음 한 해를 어떻게 이어 갈지.
    //   · 고유성: 회원 응답으로 합성 — primaryDomain(Q75), userWeakGrain(약축 결), visionHeadline.
    //     → 80억 명 누구나 자기 응답 기반의 고유한 '다음 사이클 가이드'를 받는다.
    var _wg  = tpl(userWeakGrain, vars);                  // 약축 결 (이번 사이클에서 약했던 힘)
    var _pd  = tpl(mvVars.primaryDomain || "", vars);     // 1순위 관심 분야 (Q75)
    var _vh  = tpl(mvVars.visionHeadline || "", vars);    // 비전 헤드라인
    // 받침 판정 헬퍼(을/를)
    var _wgEul = (function(){ var j = _hangulJong(String(_wg||"")); return (j < 0) ? "을" : (j !== 0 ? "을" : "를"); })();
    /* [PR-다음단계고유성 v1.4] 다음 단계 2단/응답종합 — 대원칙-A(고유성×직관 동시) 적용
     *   문제: ① 첫 항목("이 사이클을 마치면")이 완전 고정 → 모든 사용자 동일(고유성 0%).
     *         ② 둘째 항목은 이미 응답 합성(P7)이나 표현이 한 가지 틀로만 전개.
     *   해법: ① 첫 항목 task 를 강점·도메인·비전 종합 변주 풀에서 선택(직관 한 줄).
     *         ② 둘째 항목 도입 문구를 변주 풀에서 선택해 표현력 다양화(의미는 보존).
     *   축적(대원칙-B): 응답 변수 부재 시 기존 고정 문장으로 폴백(회귀 안전).
     */
    var _str = (vars.userTopStrength || "").trim();
    var _firstTask = (function(){
      if (isEn){
        var base = "The results you build over this one year become the starting point for the next — this program is a beginning, not an end.";
        if (!_pd && !_str && !_vh) return base;
        var pool = [
          "What you build" + (_pd ? (" in " + _pd) : "") + " this year doesn't end here — it becomes the floor you stand on next year.",
          "A year of proof" + (_str ? (" around " + _str) : "") + " turns into the starting line for the cycle that follows.",
          "This isn't a finish line; it's the first foothold toward ‘" + (_vh || "the person you're becoming") + "’.",
          base
        ];
        return pool[variantIdx(0x7F11) % pool.length];
      }
      var baseKo = "1년 동안 쌓은 결과물이 그대로 다음 출발점이 됩니다. 이 프로그램은 끝이 아니라 다음 사이클의 시작입니다.";
      if (!_pd && !_str && !_vh) return baseKo;
      var koPool = [
        baseKo,
        "올해 " + (_pd ? ("‘" + _pd + "’에서 ") : "") + "쌓은 결과물은 여기서 끝나지 않고, 다음 한 해를 딛고 설 바닥이 됩니다.",
        (_str ? ("‘" + _str + "’") : "올해의 강점") + "으로 증명한 한 해가 다음 사이클의 출발선이 됩니다.",
        "이건 결승선이 아니라 ‘" + (_vh || "되어 가는 나") + "’로 가는 첫 발판입니다.",
        "한 해의 끝이 아니라, " + (_pd ? ("‘" + _pd + "’에서의 ") : "") + "다음 한 걸음이 시작되는 자리입니다.",
        (_str ? ("‘" + _str + "’") : "올해의 강점") + "이(가) 증명된 지금이, 다음 사이클로 넘어가는 문턱입니다."
      ];
      var s = koPool[variantIdx(0x7F11) % koPool.length];
      return _fixJosaPairs(s);
    })();
    // 둘째 항목 도입 문구 변주 (의미 보존, 표현만 다양화)
    var _bridgeKo = (function(){
      var pool = [
        "이번에 " + (_pd ? ("‘" + _pd + "’에서 ") : "") + "만든 결과물을 토대로, ",
        "올해 " + (_pd ? ("‘" + _pd + "’에서 ") : "") + "남긴 것을 발판 삼아, ",
        (_pd ? ("‘" + _pd + "’에서 ") : "") + "쌓아 온 결과 위에서, ",
        "지난 한 해 " + (_pd ? ("‘" + _pd + "’에서 ") : "") + "다진 것을 딛고, "
      ];
      return pool[variantIdx(0x7F23) % pool.length];
    })();
    var _bridgeEn = (function(){
      var pool = [
        "Building on what you made" + (_pd ? (" in " + _pd) : "") + ", ",
        "Standing on what you left" + (_pd ? (" in " + _pd) : "") + " this year, ",
        "On top of the results you stacked" + (_pd ? (" in " + _pd) : "") + ", "
      ];
      return pool[variantIdx(0x7F23) % pool.length];
    })();
    var nextSteps = isEn ? [
      { when: "When this cycle ends",
        task: _firstTask },
      { when: "For the next cycle",
        task: _bridgeEn + "make ‘" + _wg + "’ — the part that stayed weak this time — the center of next year, and you move one step closer to ‘" + _vh + "’." }
    ] : [
      { when: "이 사이클을 마치면",
        task: _firstTask },
      { when: "다음 사이클은 이렇게",
        task: _bridgeKo + "이번엔 약했던 ‘" + _wg + "’" + _wgEul + " 다음 한 해의 중심 과제로 삼으면 ‘" + _vh + "’에 한 발 더 다가섭니다." }
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
    /* [PR-분기고유성 v1.4] 분기 테마 2단 구조 — 대원칙-A(고유성×직관 동시) 적용
     *   문제: heading(톤×Compass 36조합)·paragraphs(톤×Compass)는 같은 톤·카테고리면 동일
     *         → 응답이 달라도 분기 테마가 안 변함(고유성 4%).
     *   해법: 응답 변수(primaryDomain·userTopStrength·compassKw·missionHeadline)를 종합한
     *         '직관 한 줄' subline 을 fingerprint 변주 풀에서 선택해 덧붙인다.
     *   축적(대원칙-B): 응답 변수 부재 시 subline 생략 → 기존 출력 보존(회귀 안전).
     */
    var quarterSub = (function(){
      var dom = (vars.primaryDomain || "").trim();
      var str = (vars.userTopStrength || "").trim();
      var kw  = (vars.compassKw || "").trim();
      if (!dom && !str && !kw) return ""; // 응답 부재 → 폴백(생략)
      if (isEn){
        var enPool = [
          "Turning {str} toward {dom}, one quarter of focused proof.",
          "A quarter that anchors on {kw} and grows {dom} step by step.",
          "Where {str} meets {dom} — a quarter to make it visible.",
          "Channeling {kw} into {dom}, one finished proof at a time.",
          "A quarter to push {str} into {dom} and leave a mark."
        ];
        var ei = variantIdx(0x5131) % enPool.length;
        return enPool[ei].replace("{str}", str||"your strength").replace("{dom}", dom||"your field").replace("{kw}", kw||"meaning");
      }
      // KO: 직관 한 줄(2단) — 응답 종합. josa 없이 자연스러운 명사구 종결.
      var koPool = [
        "{str}을(를) {dom} 안에서 증명하는 한 분기",
        "{kw}을(를) 축으로 {dom}을(를) 한 뼘 키우는 분기",
        "{str}와(과) {dom}이(가) 만나 형태로 남는 분기",
        "{kw}을(를) {dom}으로 옮겨 한 가지씩 증명하는 분기",
        "{str}을(를) {dom}에 밀어 넣어 흔적을 남기는 분기",
        "{dom}에서 {str}이(가) 가장 또렷해지는 한 분기",
        "{kw}을(를) 나침반 삼아 {dom}을(를) 깊게 파는 분기",
        "{str}을(를) {dom}의 결과물 하나로 바꿔 보는 분기"
      ];
      var ki = variantIdx(0x5131) % koPool.length;
      var s = koPool[ki];
      // 변수 치환 + 조사 보정
      s = s.replace(/\{str\}/g, str || "강점")
           .replace(/\{dom\}/g, dom || "내 분야")
           .replace(/\{kw\}/g, kw || "의미");
      // 간단 조사 보정: '을(를)' 등 병기형을 받침에 맞게 정리
      s = _fixJosaPairs(s);
      return s;
    })();
    var quarter = {
      icon: "\uD83E\uDDED",
      title: isEn ? "Quarterly theme" : "분기 테마",
      heading: tpl(l3QuarterHead || L(isEn, tonePack, "quarterTheme") || (isEn ? "This quarter's theme" : "이번 분기 테마"), vars),
      subline: quarterSub,  // [v1.4] 응답 종합 2단(직관 한 줄)
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

  /* [PR#193→PR#195] 주차 헤드라인 변형 풀 — 톤×주차별 동의 변형 6종.
   *   variant=0 은 기존 GKO/GEN 과 동일(회귀 안전), 1~5 는 의미 보존 변형.
   *   fingerprint 가 variant 를 선택 → 같은 톤이라도 사용자별로 다른 헤드라인.
   *   [PR#195] 충돌 확률 1/3 → 1/6 으로 낮추기 위해 변형을 3→6 종으로 확장. */
  var GUIDE_VARIANTS_KO = {
    principled_designer: [
      ["내 기준을 한 문장으로 적어 보는 한 주", "지키고 싶은 원칙을 글로 정리하는 한 주", "내가 중요하게 여기는 것을 한 줄로 적는 한 주",
       "막연하던 기준을 분명한 한 줄로 정하는 한 주", "내 판단 기준을 문장으로 적어 두는 한 주", "기준이 될 한 문장을 정해 보는 한 주"],
      ["그 기준을 사람들에게 말로 표현해 보는 한 주", "사람들 앞에서 내 원칙을 말해 보는 한 주", "관계 속에서 내 기준을 나눠 보는 한 주",
       "사람들에게 내 기준을 한 번 보여 주는 한 주", "곁의 사람에게 내 원칙을 말로 전하는 한 주", "내 기준을 행동으로 보여 주는 한 주"],
      ["작은 일을 끝까지 해내 기준을 지키는 한 주", "작은 마무리로 원칙을 실천으로 옮기는 한 주", "한 걸음씩 끝내며 기준을 결과로 만드는 한 주",
       "작은 일을 매듭지어 기준을 확인하는 한 주", "한 번의 완수로 원칙대로 해냈음을 남기는 한 주", "작은 실행으로 기준대로 했음을 확인하는 한 주"]
    ],
    warm_connector: [
      ["사람의 이야기에 다시 귀 기울이는 한 주", "사람의 마음에 다시 관심을 두는 한 주", "주변 사람의 이야기를 다시 듣기 시작하는 한 주",
       "멀어졌던 사람에게 다시 다가가는 한 주", "사람의 속마음을 다시 들어 보는 한 주", "주변 사람을 다시 살피는 한 주"],
      ["고마움을 표현해 관계를 따뜻하게 하는 한 주", "고맙다는 말을 건네 사이를 가깝게 하는 한 주", "따뜻한 말로 곁의 사람을 챙기는 한 주",
       "감사 한마디로 관계를 더 좋게 만드는 한 주", "마음을 표현해 사이를 따뜻하게 하는 한 주", "고마움을 전해 관계를 다지는 한 주"],
      ["쌓인 신뢰를 한 번 정리해 보는 한 주", "그동안 쌓은 신뢰를 돌아보는 한 주", "사람들과의 관계를 정리해 보는 한 주",
       "그동안의 신뢰를 차분히 정리하는 한 주", "관계의 결실을 돌아보는 한 주", "사람들과 쌓은 신뢰를 확인하는 한 주"]
    ],
    visionary_creator: [
      ["떠오른 아이디어를 밖으로 꺼내 보는 한 주", "머릿속 생각을 글이나 그림으로 옮기는 한 주", "떠도는 생각을 형태로 만들어 보는 한 주",
       "쌓아 둔 아이디어를 하나씩 꺼내는 한 주", "맴돌던 생각을 눈에 보이게 만드는 한 주", "흩어진 생각을 한자리에 모아 보는 한 주"],
      ["초안을 빠르게 완성해 보는 한 주", "시제품을 속도감 있게 끝내 보는 한 주", "첫 버전을 빠르게 만들어 보는 한 주",
       "거친 초안이라도 끝까지 만들어 보는 한 주", "속도를 내어 시제품을 끝내는 한 주", "완벽보다 완성을 택해 마무리하는 한 주"],
      ["만든 것을 공개하고 다음 계획을 잡는 한 주", "결과물을 내놓고 다음 그림을 그리는 한 주", "공개하며 다음 단계를 정하는 한 주",
       "결과물을 세상에 내고 다음을 정하는 한 주", "하나를 마무리하고 다음을 계획하는 한 주", "공개한 경험을 다음 계획으로 잇는 한 주"]
    ],
    pragmatic_achiever: [
      ["이번 분기 1순위 목표를 정하는 한 주", "분기의 핵심 목표를 분명히 세우는 한 주", "가장 중요한 한 가지를 정하는 한 주",
       "이번 분기에 집중할 한 가지를 정하는 한 주", "여러 목표 중 1순위를 가려내는 한 주", "이번 분기의 중심 목표를 확정하는 한 주"],
      ["할 일 진행 상황을 매일 점검하는 한 주", "하루 단위로 실행을 챙기는 한 주", "매일 진행 상황을 확인하며 실행하는 한 주",
       "매일 같은 리듬으로 실행을 이어 가는 한 주", "하루치 진도를 꾸준히 쌓는 한 주", "실행 현황을 날마다 점검하는 한 주"],
      ["돌아보며 다음 분기를 준비하는 한 주", "결과를 정리해 다음 분기 발판을 놓는 한 주", "성과를 정리해 다음 분기를 여는 한 주",
       "이번 분기를 정리하고 다음을 계획하는 한 주", "결과를 돌아보며 다음 분기를 준비하는 한 주", "회고로 다음 분기 디딤돌을 놓는 한 주"]
    ],
    reflective_explorer: [
      ["내가 풀고 싶은 질문을 분명히 하는 한 주", "마음속 물음을 또렷하게 정리하는 한 주", "핵심 질문 하나를 분명히 정하는 한 주",
       "막연한 물음을 분명한 질문으로 만드는 한 주", "마음속 질문 하나를 또렷이 세우는 한 주", "탐구할 한 문장을 정리하는 한 주"],
      ["작은 시도로 답을 찾아 가는 한 주", "가볍게 해 보며 답의 윤곽을 찾는 한 주", "작은 실행으로 답에 다가가는 한 주",
       "작게 시도하며 답의 가닥을 잡는 한 주", "가벼운 실험으로 단서를 모으는 한 주", "한 걸음 실행으로 답에 다가서는 한 주"],
      ["차분히 돌아보며 다음 길을 정하는 한 주", "생각을 정리해 다음 걸음을 잇는 한 주", "차분한 정리로 다음 방향을 여는 한 주",
       "차분히 돌아보며 다음 길을 여는 한 주", "지난 시간을 차분히 정리하는 한 주", "조용히 돌아보며 다음 방향을 잡는 한 주"]
    ]
  };
  var GUIDE_VARIANTS_EN = {
    principled_designer: [
      ["A week to put your inner standard into one sentence", "A week to put your inner principle into clear words", "A week to write your inner baseline into one line",
       "A week to forge a blurry standard into one clear line", "A week to capture your inner measure in a sentence", "A week to draw out the one sentence that anchors you"],
      ["A week to express that standard inside your relationships", "A week to voice your principle among people", "A week to share your standard within relationships",
       "A week to reveal your standard once among people", "A week to speak your principle to those near you", "A week to show your standard through action in relationships"],
      ["A week to connect the standard to action through small completions", "A week to bridge your principle to action via small finishes", "A week to turn the standard into results step by step",
       "A week to make the standard tangible through a small knot", "A week to engrave the principle into a result with one completion", "A week to prove the standard through small execution"]
    ],
    warm_connector: [
      ["A week to reopen the channel of listening to the heart", "A week to open your ears to people's hearts again", "A week to start hearing the sound of relationships again",
       "A week to reopen the closed passage of the heart", "A week to listen again to people's inner thoughts", "A week to feel out the grain of relationships again"],
      ["A week to warm up relationships through gratitude and expression", "A week to raise the warmth of bonds with thanks", "A week to warm those near you with kind expression",
       "A week to add warmth to relationships with a word of thanks", "A week to warm the bond by expressing your heart", "A week to warm relationships by conveying gratitude"],
      ["A week to consolidate relationships as assets", "A week to settle built trust into an asset", "A week to bind people's grain into relational capital",
       "A week to gather your built trust into an asset", "A week to organize the fruit of relationships into an asset", "A week to engrave trust with people as an asset"]
    ],
    visionary_creator: [
      ["A week to bring scattered ideas out into the open", "A week to release inner inspiration outward", "A week to make drifting ideas tangible",
       "A week to bring pooled ideas out into the world", "A week to shape circling inspiration into form", "A week to gather scattered ideas in one place and bring them out"],
      ["A week to wrap up the first draft quickly", "A week to finish the prototype with momentum", "A week to complete a first version fast",
       "A week to push even a rough draft to the end", "A week to close the prototype with speed", "A week to choose completion over perfection and finish"],
      ["A week to bridge to the next vision through publishing", "A week to open the next picture by shipping", "A week to link the next-stage vision via release",
       "A week to ship the result and open what's next", "A week to tie one knot by publishing and sketch the next", "A week to link the experience of releasing to the next vision"]
    ],
    pragmatic_achiever: [
      ["A week to clarify this quarter's #1 priority", "A week to set the quarter's core goal clearly", "A week to nail down the single most important thing",
       "A week to decide the one thing to bet the quarter on", "A week to pick the #1 from scattered goals", "A week to confirm this quarter's central goal"],
      ["A week to run the execution board every day", "A week to roll execution on a daily basis", "A week to execute while measuring daily progress",
       "A week to run execution in the same daily rhythm", "A week to steadily stack a day's worth of progress", "A week to check execution status every day"],
      ["A week to prepare the next quarter through retrospective", "A week to lay the next quarter's footing by reviewing", "A week to open the next quarter by consolidating results",
       "A week to settle this quarter and design the next", "A week to look back at results and sharpen the next quarter", "A week to lay the next quarter's stepping stone through review"]
    ],
    reflective_explorer: [
      ["A week to sharpen the question", "A week to hone your inner question clearly", "A week to carve out one core question",
       "A week to shape a blurry query into a clear question", "A week to set up one question in your mind clearly", "A week to refine the one sentence worth exploring"],
      ["A week to approach the answer through small experiments", "A week to find the answer's outline via light trials", "A week to feel toward the answer with small actions",
       "A week to grasp the thread of the answer by trying small", "A week to gather clues through light experiments", "A week to step closer to the answer through action"],
      ["A week to reflect quietly and bridge to the next path", "A week to link the next step through contemplation", "A week to open the next direction with quiet ordering",
       "A week to look back calmly and open the next path", "A week to wrap up the past through contemplation", "A week to set the next direction through quiet reflection"]
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
        "내 기준을 한 문장으로 적어 보는 한 주",
        "그 기준을 사람들에게 말로 표현해 보는 한 주",
        "작은 일을 끝까지 해내 기준을 지키는 한 주"
      ],
      warm_connector: [
        "사람의 이야기에 다시 귀 기울이는 한 주",
        "고마움을 표현해 관계를 따뜻하게 하는 한 주",
        "쌓인 신뢰를 한 번 정리해 보는 한 주"
      ],
      visionary_creator: [
        "떠오른 아이디어를 밖으로 꺼내 보는 한 주",
        "초안을 빠르게 완성해 보는 한 주",
        "만든 것을 공개하고 다음 계획을 잡는 한 주"
      ],
      pragmatic_achiever: [
        "이번 분기 1순위 목표를 정하는 한 주",
        "할 일 진행 상황을 매일 점검하는 한 주",
        "돌아보며 다음 분기를 준비하는 한 주"
      ],
      reflective_explorer: [
        "내가 풀고 싶은 질문을 분명히 하는 한 주",
        "작은 시도로 답을 찾아 가는 한 주",
        "차분히 돌아보며 다음 길을 정하는 한 주"
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
    "다음 비전 한 줄": ["다음 비전 한 줄", "다음 목표 한 문장", "다음 단계 한 줄로 적기"],
    "발행한 것 쌓기": ["발행한 것 쌓기", "공개한 결과 모으기", "결과물 차곡차곡 모으기"],
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
    "나다운 결과 쌓기": ["나다운 결과 쌓기", "내 강점 모으기", "나만의 것 차곡차곡 모으기"],
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
    "쌓인 관계 모으기": ["쌓인 관계 모으기", "신뢰 관계 차곡차곡 쌓기", "좋은 인연 남기기"],
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
    "성과 차곡차곡 쌓기": ["성과 차곡차곡 쌓기", "결과물 모으기", "만든 결과 남기기"],
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
    "생각 차곡차곡 모으기": ["생각 차곡차곡 모으기", "돌아본 기록 쌓기", "떠오른 생각 남기기"],
    // month3 / year1 고정 effects
    "분기 결과 가시화": ["분기 결과 가시화", "분기 성과 드러내기", "한 분기 결과 명료화"],
    "핵심 루틴 정착": ["핵심 루틴 정착", "핵심 습관 안착", "중심 리듬 정착"],
    "나다운 결과 쌓기": ["나다운 결과 쌓기", "나만의 것 모으기", "나다움 차곡차곡 남기기"],
    "다음 분기 발판 형성": ["다음 분기 발판 형성", "차기 분기 디딤돌 마련", "다음 분기 기반 다지기"],
    "장기 비전 한 줄로 적기": ["장기 비전 한 줄로 적기", "먼 목표 한 문장으로", "먼 목표 분명히 적기"],
    "분기 사이클 완수": ["분기 사이클 완수", "분기 주기 완료", "한 분기 사이클 마감"],
    "신뢰와 평판 쌓기": ["신뢰와 평판 쌓기", "믿음·평판 차곡차곡 모으기", "좋은 평판 남기기"],
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
        ["행동 완수", "실행 패턴화", "다음 목표 연결", "나다운 결과 쌓기"]
      ],
      warm_connector: [
        ["감정 인식", "관계 온도 회복", "기록 누적", "공감 채널 재가동"],
        ["감사 루틴 정착", "표현 안전지대 확장", "관계 회복력 상승", "긍정 데이터 누적"],
        ["깊이 대화 1건", "신뢰 네트워크 가시화", "다음 달 우선순위 확정", "쌓인 관계 모으기"]
      ],
      visionary_creator: [
        ["아이디어 외화", "콘셉트 좁히기", "레퍼런스 정렬", "착수 가속"],
        ["프로토타입 마감", "피드백 수집", "덜어내기 결정", "발행 임박"],
        ["외부 발행 1건", "반응 데이터 확보", "다음 비전 한 줄", "발행한 것 쌓기"]
      ],
      pragmatic_achiever: [
        ["1순위 확정", "KPI 가시화", "마일스톤 분해", "캘린더 박아두기"],
        ["집중 블록 가동", "임팩트 우선순위", "주간 진척 측정", "방해 차단 정착"],
        ["분기 회고 완료", "원인 → 보완 결정", "다음 분기 후보 도출", "성과 차곡차곡 쌓기"]
      ],
      reflective_explorer: [
        ["질문 한 문장", "탐색 자료 정렬", "사색 루틴 시작", "기록 누적"],
        ["실험 행동 12회", "한 줄 통찰 누적", "패턴 발견", "답의 윤곽"],
        ["반복 키워드 표시", "‘작은 답’ 한 문단", "다음 분기 질문", "생각 차곡차곡 모으기"]
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
      : ["루틴 시작", "기록 누적", "패턴 인식", "나다운 결과 쌓기"]);
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
                            ["발행 채널(블로그/SNS)", "비전 한 줄 시트", "분기 작품 목록"]],
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
