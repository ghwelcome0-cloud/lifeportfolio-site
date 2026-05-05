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

  function pickTone(report){
    var t = (report && (report.tone || report.toneKey)) || "";
    if (KNOWN_TONES.indexOf(t) >= 0) return t;
    // tone 객체일 수도 있음
    if (report && report.tone && typeof report.tone === "object" && report.tone.key) {
      if (KNOWN_TONES.indexOf(report.tone.key) >= 0) return report.tone.key;
    }
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
    out.missionHeadline = c.headline       || "";
    out.missionSubline  = c.subline        || "";
    out.visionHeadline  = c.visionHeadline || "";
    out.visionSubline   = c.visionSubline  || "";
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

    // 사명·비전 주입 (사용자 확정 — 사명 직접 인용형 / 비전 헤드라인 재사용)
    //   리포트의 mission_vision 섹션이 있으면 3-Tier 슬롯을 vars 로 주입
    //   템플릿에서는 {{missionHeadline}}, {{missionSubline}}, {{visionHeadline}},
    //   {{visionSubline}}, {{primaryDomain}}, {{secondaryDomain}}, {{compassKw}},
    //   {{compassVerb}} 로 참조 가능
    var mvVars = extractMissionVisionVars(report, isEn);
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
      compassVerb:     mvVars.compassVerb
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

    // 사명 직접 인용형 인용문 (사용자 확정 — 이미지 1번 블록 개선)
    //   사명 헤드라인이 있으면 그대로 인용 → 매일의 루틴으로 옮기는 로드맵임을 명시
    //   폴백: 기존 essence 기반 인용문 유지 (사명 슬롯이 없는 구버전 리포트 호환)
    var quote;
    if (mvVars.missionHeadline) {
      if (isEn) {
        quote = "\u201CThis execution program is a roadmap that translates "
              + name + "'s mission \u2014 \u2018" + mvVars.missionHeadline + "\u2019 \u2014 "
              + "into a daily routine. "
              + "It is designed so that " + name + " can grow as someone who lives "
              + (mvVars.domainPhrase ? ("in " + mvVars.domainPhrase + ", ") : "")
              + "with " + (mvVars.compassKw || "meaning") + " as the compass.\u201D";
      } else {
        // 한국어 조사 자동 보정: tpl() 헬퍼 활용 — "{{compassKw}}을(를)" 패턴
        var quoteTpl = "\u201C이 실행 프로그램은 {{name}}님의 사명 \u2014 \u2018{{missionHeadline}}\u2019 \u2014 "
                     + "을 매일의 루틴으로 옮기는 로드맵입니다. "
                     + (mvVars.domainPhrase ? (mvVars.domainPhrase + "의 자리에서, ") : "")
                     + (mvVars.compassKw    ? "{{compassKw}}을(를) 나침반 삼아 " : "")
                     + "살아가는 한 사람으로 자라도록 설계되었습니다.\u201D";
        quote = tpl(quoteTpl, vars);
      }
    } else {
      // 폴백 (구버전 리포트)
      var quoteLead = isEn
        ? ("\u201CThis execution program is built on " + name + "'s Life Portfolio assessment results, optimized for ")
        : ("\u201C이 실행 프로그램은 " + name + "님의 인생포트폴리오 검사 결과를 기반으로, ");
      var quoteEss = ess || (isEn ? "the flow of self-discovery and meaningful action" : "자기다움의 결을 따라 길을 잇는 흐름");
      var quoteTail = isEn ? " \u2014 a roadmap for action.\u201D" : "에게 최적화된 실행 로드맵입니다.\u201D";
      quote = quoteLead + quoteEss + quoteTail;
    }

    var newPathsArr = (L(isEn, tonePack, "newPaths") || []);
    var newPathsJoin = newPathsArr.slice(0,4).join(" · ") || (isEn ? "1-person brand in your field / Side projects" : "관련 분야 1인 브랜드 / 사이드 프로젝트");

    // PR#48-A: 강점 표현을 점수 안내가 아닌 실제 paired-trait 강점 TOP3 로 명시
    //   - 리포트 growth_map.strengths(상위 3개)를 자연스러운 한 문장으로 합성
    //   - 폴백: paired 강점이 없을 경우에만 축 라벨 + 키워드 기반 표현 사용
    var reportStrengths = pickReportStrengths(report);
    var strongAxisLabel = axisLabel(sw.strong, isEn);
    var strongAxisPct = Math.round(axes[sw.strong]);
    var weakAxisLabel = axisLabel(sw.weak, isEn);
    var weakAxisPct = Math.round(axes[sw.weak]);

    var strengthsLine;
    if (reportStrengths.length >= 2) {
      // TOP3 강점이 있으면 (강점1, 강점2, 강점3) — 강축({pct}%)을 중심 동력으로 명시
      var top3Join = reportStrengths.slice(0, 3).join(isEn ? " · " : " · ");
      strengthsLine = isEn
        ? ("Strengths: " + top3Join + " — anchored by your " + strongAxisLabel + " axis (" + strongAxisPct + "%).")
        : ("강점: " + top3Join + " — " + strongAxisLabel + " 축(" + strongAxisPct + "%)이 이를 떠받칩니다.");
    } else {
      // 폴백 (구버전 리포트 호환)
      strengthsLine = isEn
        ? ("Strengths: " + strongAxisLabel + " axis (" + strongAxisPct + "%) anchors your distinctive self.")
        : ("강점: " + strongAxisLabel + " 축(" + strongAxisPct + "%) 중심의 자기다움이 또렷합니다.");
    }

    var summary;
    if (isEn) {
      summary = {
        traits:   "Type: " + toneLabel + " — " + (toneTagline || ""),
        strengths: strengthsLine,
        gaps:     "Areas to grow: strengthen the " + weakAxisLabel + " axis (" + weakAxisPct + "%) through small routines.",
        env:      "Suitable environment: " + envByTone(toneKey, isEn),
        newPaths: "New possibilities: " + newPathsJoin
      };
    } else {
      summary = {
        traits:   "성향: " + toneLabel + " — " + (toneTagline || ""),
        strengths: strengthsLine,
        gaps:     "보완점: " + weakAxisLabel + " 축(" + weakAxisPct + "%) 영역을 작은 루틴으로 강화합니다.",
        env:      "적합 환경: " + envByTone(toneKey, isEn),
        newPaths: "신규 가능성: " + newPathsJoin
      };
    }

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
    var weeks = (tonePack.weeks || []).map(function(w, i){
      return {
        week: i+1,
        title: L(isEn, w, "title"),
        guide:  guideOfWeek(toneKey, i, isEn),
        actions: tplArr(L(isEn, w, "actions") || [], vars),
        effects: effectsOfWeek(toneKey, i, isEn)   // 4 포인트 명사형
      };
    });

    var month3GoalsRaw = tonePack.month3Goals || [];
    var month3 = {
      guide: isEn
        ? "Define the three results that should actually take root this quarter."
        : "이번 분기 \u2018실제로 자리 잡혀야 하는 3가지 결과\u2019를 정합니다.",
      goals: month3GoalsRaw.map(function(g){
        return { title: L(isEn, g, "title"), criterion: L(isEn, g, "criterion") };
      }),
      effects: isEn
        ? ["Quarterly results made visible","Core routine established","Self-distinctiveness as an asset","Foothold for the next quarter"]
        : ["분기 결과 가시화", "핵심 루틴 정착", "자기다움 자산화", "다음 분기 발판 형성"]
    };

    var year1Pack = tonePack.year1 || {};
    var year1 = {
      guide: isEn
        ? "Capture next year's destination as one vision sentence and three milestones."
        : "1년 후 도달할 모습을 비전 한 문장과 마일스톤 3개로 묶어 둡니다.",
      vision: tplArr(L(isEn, year1Pack, "vision") || [], vars),
      milestones: tplArr(L(isEn, year1Pack, "milestones") || [], vars),
      effects: isEn
        ? ["Long-term vision in writing","Quarterly cycles completed","Trust & reputation as assets","New vision for the next year"]
        : ["장기 비전 명문화", "분기 사이클 완수", "신뢰·평판 자산화", "다음 1년 새 비전 도출"]
    };

    /* ------------------------------------------------------------------
     * §3 실행 모듈 카드 (TOP3 추천 모듈)
     *      구분: 강점 활용 / 보완 훈련 / 핵심 전략 / 추천 도구 2~3개
     * ------------------------------------------------------------------ */
    var TYPES_KO = ["강점 활용", "보완 훈련", "핵심 전략"];
    var TYPES_EN = ["Strength leverage", "Compensatory training", "Core strategy"];
    var modules = (tonePack.modules || []).map(function(m, i){
      var type = isEn ? (TYPES_EN[i] || TYPES_EN[2]) : (TYPES_KO[i] || TYPES_KO[2]);
      return {
        index: i+1,
        type: type,
        title: L(isEn, m, "title"),
        summary: L(isEn, m, "summary"),
        actions: L(isEn, m, "actions") || [],
        tools: toolsOfTone(toneKey, i, isEn)
      };
    });

    // 약축 부스터 1개를 보완 훈련에 보강
    var boosterAxis = sw.weak;
    var boosters = (rules.weakAxisBoosters || {});
    var boosterArr = isEn
      ? (boosters[boosterAxis + "_en"] || boosters[boosterAxis] || [])
      : (boosters[boosterAxis] || []);
    if (modules[1] && boosterArr.length){
      modules[1].booster = {
        targetAxis: axisLabel(boosterAxis, isEn),
        actions: boosterArr
      };
    }

    /* ------------------------------------------------------------------
     * §4 성과 추적 보드 (1주차 예시 + 월간 항목)
     *      열: 주차 / 실행 과제 / 완료(Y/N) / 성찰 메모
     * ------------------------------------------------------------------ */
    var trackWeekly = L(isEn, tonePack, "trackBoardWeekly") || [];
    var trackMonthly = L(isEn, tonePack, "trackBoardMonthly") || [];
    var board = {
      columns: isEn
        ? ["Week", "Action task", "Done (Y/N)", "Reflection notes"]
        : ["주차", "실행 과제", "완료(Y/N)", "성찰 메모"],
      rowsExample: trackWeekly.map(function(t){
        return { week: isEn ? "Week 1" : "1주차", task: t, done: "", memo: "" };
      }),
      monthly: trackMonthly,
      hint: isEn
        ? ("This table is a Week 1 example. " + name + " keeps the same record format weekly to complete the loop of \u2018record \u2192 reflect \u2192 next decision\u2019.")
        : ("이 표는 1주차 예시입니다. " + name + "님은 매주 동일한 방식으로 기록하며 \u2018기록 \u2192 회고 \u2192 다음 결정\u2019의 루프를 완성합니다.")
    };

    /* ------------------------------------------------------------------
     * §5 기대 효과 ✨ (4줄 + 신규 직업/사업 가능성 3~4개)
     * ------------------------------------------------------------------ */
    var teff = tonePack.effects || {};
    var effects = isEn ? {
      fitJob:    "Job fit: "          + (L(isEn, teff, "fitJob")    || "Stronger fit for roles in your field"),
      expansion: "Career expansion: " + (L(isEn, teff, "expansion") || "Self-distinctive 1-person brand / side-project expansion"),
      career:    "Career growth: "    + (L(isEn, teff, "career")    || "Self-assets accumulated as outcomes"),
      vision:    "Life vision: "      + (L(isEn, teff, "vision")    || "\u201CSomeone whose self-distinctiveness becomes influence\u201D"),
      newPaths:  newPathsArr.slice(0, 4)
    } : {
      fitJob:    "직무 적합성: "    + (teff.fitJob    || "관련 분야 직무 적합성 강화"),
      expansion: "직업 확장성: "    + (teff.expansion || "자기다움 기반 1인 브랜드 / 사이드 프로젝트 확장"),
      career:    "경력 성장: "      + (teff.career    || "자기 자산을 결과로 누적"),
      vision:    "인생 설계 비전: " + (teff.vision    || "\u201C자기다움이 곧 영향력이 되는 사람\u201D"),
      newPaths:  newPathsArr.slice(0, 4)
    };

    /* ------------------------------------------------------------------
     * §6 다음 단계 제안 (1개월 / 3개월 / 1년 — 시점 + 실행과제)
     * ------------------------------------------------------------------ */
    var nsPack = tonePack.nextSteps || {};
    var nextSteps = isEn ? [
      { when: "1 month later",  task: tpl(L(isEn, nsPack, "m1") || "Start one core routine", vars) },
      { when: "3 months later", task: tpl(L(isEn, nsPack, "m3") || "Secure one quarterly key result", vars) },
      { when: "1 year later",   task: tpl(L(isEn, nsPack, "y1") || "Reach a 1-year vision milestone", vars) }
    ] : [
      { when: "1개월 후",  task: tpl(nsPack.m1 || "핵심 루틴 1개 시작", vars) },
      { when: "3개월 후",  task: tpl(nsPack.m3 || "분기 핵심 결과 1개 확보", vars) },
      { when: "1년 후",    task: tpl(nsPack.y1 || "1년 비전 마일스톤 달성", vars) }
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
    var quarter = {
      icon: "\uD83E\uDDED",
      title: isEn ? "Quarterly theme" : "분기 테마",
      heading: L(isEn, tonePack, "quarterTheme") || (isEn ? "This quarter's theme" : "이번 분기 테마"),
      paragraphs: tplArr(L(isEn, tonePack, "quarterLeadParas") || [], vars)
    };

    /* ------------------------------------------------------------------
     * 최종 문서
     * ------------------------------------------------------------------ */
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
        lang: lang
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

  // 화살표 한 줄 — 사용자 확정 (사명/비전 결과 동기화)
  //   warm_connector: "마음 듣기 → 의미 새기기 → 신뢰로 잇기" (compass=의미 기준)
  //   다른 톤은 기존 어구 유지하되, mvVars.compassVerb 가 있으면 가운데 단계를
  //   Compass 동사구로 치환해 사명 결과 일관성을 확보
  function arrowByTone(t, isEn, compassVerb){
    if (isEn) {
      var mapEn = {
        principled_designer: "\u2018Putting philosophy into words \u2192 deep dialogue \u2192 real role experience\u2019",
        warm_connector:      "\u2018Listening to the heart \u2192 naming meaning \u2192 weaving trust\u2019",
        visionary_creator:   "\u2018Capturing ideas \u2192 publishing prototypes \u2192 refining the vision\u2019",
        pragmatic_achiever:  "\u2018Decide priority #1 \u2192 focused blocks \u2192 quarterly retrospective\u2019",
        reflective_explorer: "\u2018Refining the question \u2192 small experiments \u2192 quiet reflection\u2019"
      };
      if (t === "warm_connector" && compassVerb) {
        return "\u2018Listening to the heart \u2192 " + compassVerb + " \u2192 weaving trust\u2019";
      }
      return mapEn[t] || "\u2018Awareness \u2192 expression \u2192 execution\u2019";
    }
    var mapKo = {
      principled_designer: "\u2018철학 언어화 \u2192 깊은 대화 \u2192 실제 역할 경험\u2019",
      warm_connector:      "\u2018마음 듣기 \u2192 의미 새기기 \u2192 신뢰로 잇기\u2019",
      visionary_creator:   "\u2018아이디어 캡처 \u2192 프로토타입 발행 \u2192 비전 정련\u2019",
      pragmatic_achiever:  "\u20181순위 결정 \u2192 집중 블록 \u2192 분기 회고\u2019",
      reflective_explorer: "\u2018질문 다듬기 \u2192 작은 실험 \u2192 조용한 회고\u2019"
    };
    if (t === "warm_connector" && compassVerb) {
      return "\u2018마음 듣기 \u2192 " + compassVerb + " \u2192 신뢰로 잇기\u2019";
    }
    return mapKo[t] || "\u2018인식 \u2192 표현 \u2192 실행\u2019";
  }

  function guideOfWeek(t, i, isEn){
    var GKO = {
      principled_designer: [
        "내면의 기준을 한 문장으로 꺼내는 한 주",
        "관계 안에서 그 기준을 표현해 보는 한 주",
        "작은 완수로 기준을 행동에 연결하는 한 주"
      ],
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

  function effectsOfWeek(t, i, isEn){
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
    return (src[t] || src.principled_designer)[i] || (isEn
      ? ["Routine started","Records accumulated","Pattern recognition","Self-asset built"]
      : ["루틴 시작", "기록 누적", "패턴 인식", "자기 자산화"]);
  }

  function toolsOfTone(t, i, isEn){
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
    return (src[t] || src.principled_designer)[i] || (isEn ? ["Notebook","Calendar","Retro sheet"] : ["노트", "캘린더", "회고 시트"]);
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
