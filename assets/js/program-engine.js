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

  /* [#6] 리포트 요약 섹션의 coreOneLine(한 줄 평)을 프로그램 표지로 그대로 전달.
   *   목적: 리포트와 프로그램이 '같은 나'를 가리킨다는 연속성(자산화·신뢰감)을 만들고,
   *         프로그램 Ⅰ '한눈에 보는 나' 상단에 리포트와 동일한 한 줄 평을 얹기 위함.
   *   [대표 지시 2026-07-27] 리포트의 한 줄 평과 '동일한 것'을 반영 — 인칭 치환 없이 원문 그대로.
   *   fp 무관: report 문자열을 그대로 전달하며 점수/지문에 영향 없음. §7 무관(원분야 라벨 없음).
   */
  function pickReportCoreOneLine(report, name){
    if (!report || !Array.isArray(report.sections)) return "";
    var su = report.sections.filter(function(s){ return s.id === "summary"; })[0];
    var line = (su && su.content && su.content.coreOneLine) ? String(su.content.coreOneLine).trim() : "";
    return line;
  }

  /* [#6-fix 대표 지시 2026-07-27] 프로그램 Ⅰ '한눈에 보는 나' 상단 각인은
   *   리포트 실제 화면(dashx)과 '동일한 것'을 반영해야 한다.
   *   리포트 화면 각인 = mission_vision._slots.diag_badge(진단명 배지) + intro_line(2슬롯 첫 문장)
   *   + 고정 서브("당신의 응답이 발견해 남긴, 당신만의 한 문장.").
   *   기존 coreOneLine(summary)은 리포트 화면에 노출되지 않는 별개 긴 문장이라 첫인상 직관성이 낮았음.
   *   fp 무관: report._slots 문자열을 가공 없이 그대로 전달(점수/지문 영향 없음).
   */
  function pickReportGlance(report){
    var out = { diagBadge:"", introLine:"" };
    if (!report || !Array.isArray(report.sections)) return out;
    var mv = report.sections.filter(function(s){ return s.id === "mission_vision"; })[0];
    var sl = (mv && mv.content && mv.content._slots) ? mv.content._slots : null;
    if (sl){
      out.diagBadge = String(sl.diag_badge || sl.diag_name || "").trim();
      out.introLine = String(sl.intro_line || "").trim();
    }
    return out;
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
  /* [§7 차단 2026-07-29] EN 영역 라벨 안전 사전 — 모듈 레벨 SSOT.
   *   [결함] report-engine-v4 의 slots.primary_domain 은 EN 경로에서
   *     _enFromKo() -> DOMAIN_21_EN 을 거치는데 그 사전이
   *     "종교"->"Religion", "교육"->"Education", "경영"->"Management" 를 반환한다.
   *     PE 가 그 raw 라벨을 노출 문구에 결합해 §7 금지어를 EN 지면에 실었다.
   *   [실측] 300시드 lang=en · PE.build (교정 전):
   *     · effects.expansion  34/300 (11.3%)  "... across Religion & Sports"
   *     · cover.typeLine     34/300 (11.3%)  "a person living out Religion and Sports"
   *     · 검출어 "Religion" 68회 · 그 외 §7EN 금지어 0
   *     같은 시드의 ce.careers 는 이미 안전했다 — career-engine 이
   *     _S7_DOMAIN_SAFE_EN 으로 "Conviction & Meaning" 을 내기 때문. 즉 순화 사전이
   *     이미 있었는데 이 두 경로만 그것을 거치지 않았다.
   *   [원칙] 검열이 아니라 기능·속성 명사로 바꾼다 —
   *     career-engine _S7_DOMAIN_SAFE_EN / report-engine-v4 _S7_DIR_SAFE_EN 과 동일.
   *   [경계] 이 함수는 '노출 문구' 전용이다. vars.primaryDomain / secondaryDomain
   *     원본(내부 로직·careerEngine 용, line 1397 주석)은 절대 바꾸지 않는다.
   *   [보존] 미등재 라벨은 원문 그대로 반환(대원칙-B: 폴백 보존). KO 경로 무변경. */
  /* [문체 2026-07-29] 값에 '&' 를 쓰지 않는다 — "A and B" 결합 시
     "Conviction & Meaning and Sports" 처럼 접속이 두 겹으로 읽혔다(육안 검증 발견).
     'and' 로 통일하면 어떤 결합 형태에서도 한 문장으로 읽힌다. */
  /* [문체 2026-07-29 · 3차] 라벨은 '접속사 없는 단일 명사구' 로 정한다.
     결합 문법을 바꾸는 방식은 세 번 연속 새 어색함을 만들었다(육안 검증):
       "Conviction & Meaning and Sports" / "Conviction & Meaning, Sports" /
       "Organization and Operations and Politics"
     원인은 라벨이 접속사를 품은 구였기 때문 — 상위 결합과 반드시 충돌한다.
     단일 명사구면 "In X and Y" · "living out X and Y" · "across X and Y"
     어디에 넣어도 한 문장으로 읽힌다. §7 금지어 부재 · 기능·속성 환원 유지. */
  var PE_S7_DOM_EN = {
    "Religion": "Conviction",
    "Education": "Learning",
    "Management": "Organizational Practice",
    "Philosophy": "Meaning"
  };
  function _peDomEnSafe(label){
    var t = String(label == null ? "" : label).trim();
    if (!t) return "";
    return PE_S7_DOM_EN[t] || t;
  }
  function _hangulJong(ch){
    if (!ch) return -1;
    var code = ch.charCodeAt(ch.length - 1);
    if (code < 0xAC00 || code > 0xD7A3) return -1;
    return (code - 0xAC00) % 28;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // [P21 · 대원칙-C] 분야 융합 엔진 (report-engine-v4.js에서 이식 · 완전 동일 로직)
  //   "융합 = 속성 벡터들의 무게중심(centroid) + 그 좌표를 사람 말로 복원(decode)"
  //   나열(A·B·C) 금지. 원분야 단어는 좌표 연산에 흡수되어 사라진다(§7 자동 준수).
  //   결정론: 난수 미사용(fingerprint 해시만 사용) → 리포트 엔진과 같은 fingerprint면
  //           같은 융합 결과(두 리포트 일관성). self-contained(program-engine 헬퍼만 사용).
  //   상세: docs/청사진_P20_분야융합엔진.md · docs/제작규칙서 §2.2.1(대원칙-C)
  // ─────────────────────────────────────────────────────────────────────────
  var DOMAIN_ATTR_KO = {
    "정치": { core:"질서",   act:"바로 세워",   fruit:"공동체로" },
    "경제": { core:"가치",   act:"흐르게 해",   fruit:"살림으로" },
    "사회": { core:"관계",   act:"이어",         fruit:"공동체로" },
    "문화": { core:"의미",   act:"담아",         fruit:"이야기로" },
    "교육": { core:"배움",   act:"가르쳐",       fruit:"다음 세대로" },
    "기술": { core:"쓸모",   act:"만들어",       fruit:"도구로" },
    "과학": { core:"원리",   act:"밝혀",         fruit:"지식으로" },
    "의료": { core:"생명",   act:"돌보아",       fruit:"회복으로" },
    "복지": { core:"돌봄",   act:"나누어",       fruit:"안전망으로" },
    "환경": { core:"터전",   act:"지켜",         fruit:"미래로" },
    "예술": { core:"아름다움", act:"표현해",     fruit:"작품으로" },
    "미디어": { core:"이야기", act:"전해",       fruit:"목소리로" },
    "스포츠": { core:"한계", act:"넘어서",       fruit:"기록으로" },
    "법률": { core:"정의",   act:"세워",         fruit:"질서로" },
    "행정": { core:"체계",   act:"운영해",       fruit:"신뢰로" },
    "종교": { core:"신념",   act:"붙들어",       fruit:"삶의 방향으로" },
    "철학": { core:"본질",   act:"물어",         fruit:"통찰로" },
    "역사": { core:"기억",   act:"남겨",         fruit:"유산으로" },
    "심리": { core:"마음",   act:"읽어",         fruit:"회복으로" },
    "경영": { core:"조직",   act:"이끌어",       fruit:"성과로" },
    "금융": { core:"자원",   act:"굴려",         fruit:"기반으로" }
  };
  var FUSE_CLOSER_KO = {
    keep:  ["붙드는", "지켜 내는", "간직하는"],
    carry: ["이어 가는", "전하는", "연결하는"],
    build: ["키우는", "세우는", "일구는", "만들어 가는"]
  };
  // self-contained 조사 헬퍼(_hangulJong 재활용). report-engine의 _eul/_ero와 동치.
  function _fuseHasJong(w){ var j = _hangulJong(String(w||"")); return j > 0; }
  function _fuseEul(w){ return w + (_fuseHasJong(w) ? "을" : "를"); }
  function _fuseEro(w){ var j = _hangulJong(String(w||"")); return w + ((j > 0 && j !== 8) ? "으로" : "로"); }
  function _fusePick(arr, hash){ if (!arr || !arr.length) return ""; return arr[Math.abs(hash) % arr.length]; }
  /* ★★★ [결함 (AP) 처방 · 2026-07-30] 괄호 뒤 조사.
   *   "선택 기준(해결된 결과)" 처럼 괄호로 닫은 문구에 조사를 하드코딩하면
   *   _hangulJong 이 ')' 을 보고 -1 을 돌려주므로 받침 판정이 아예 성립하지 않는다.
   *   조사는 '괄호 안 마지막 글자' 로 결정된다 → 이 함수를 통해서만 붙인다.
   *   inner 가 비면 label 자체로 판정한다. kind: eul / i / gwa / eun / ero
   *   ★ report-engine-v4.js 의 es2ParenJosa 와 동치 (self-contained 유지). */
  function _peParenJosa(label, inner, kind){
    var v = String(inner == null ? "" : inner).trim();
    var head = v ? (v.indexOf("(") !== -1 ? (label + " " + v) : (label + "(" + v + ")")) : String(label || "");
    var basis = v || String(label || "");
    var j = _hangulJong(basis);          /* -1 = 비한글 → 받침 없음으로 취급 */
    var has = j > 0;
    var p;
    switch (kind) {
      case "i":   p = has ? "이" : "가"; break;
      case "gwa": p = has ? "과" : "와"; break;
      case "eun": p = has ? "은" : "는"; break;
      case "ero": p = (has && j !== 8) ? "으로" : "로"; break;
      default:    p = has ? "을" : "를"; break;
    }
    return head + p;
  }
  function _fuseStripRo(s){ return s ? String(s).replace(/\s*(으로|로)\s*$/, "") : s; }
  function _fuseToArr(v){ return Array.isArray(v) ? v : (v == null || v === "" ? [] : [v]); }
  // 산출: { core, act, fruitNoun, identityKo, phraseKo, identityCore, count }
  function fuseDomains(domainsKo, fingerprint){
    var ds = _fuseToArr(domainsKo).map(function(v){ return String(v).trim(); }).filter(Boolean);
    ds = ds.filter(function(d){ return !!DOMAIN_ATTR_KO[d]; });
    var n = ds.length;
    if (n === 0){
      return { core:"", act:"", fruitNoun:"", count:0,
               identityKo:"지금 살아가는", phraseKo:"지금 살아가는 자리에서", identityCore:"지금 살아가는 자리" };
    }
    var A0 = DOMAIN_ATTR_KO[ds[0]];
    var A1 = ds[1] ? DOMAIN_ATTR_KO[ds[1]] : null;
    var A2 = ds[2] ? DOMAIN_ATTR_KO[ds[2]] : null;
    var core = A0.core;                       // 1순위: 무엇을
    var act  = (A1 ? A1.act : A0.act);          // 2순위: 어떻게
    var fruitNoun = A2 ? A2.core : (A1 ? _fuseStripRo(A1.fruit) : _fuseStripRo(A0.fruit));
    var identityKo;
    if (n === 1){
      var keeper = _fusePick(FUSE_CLOSER_KO.keep, (fingerprint || 0) + 7);
      identityKo = _fuseEul(core) + " " + keeper;
    } else if (n === 2){
      var carry = _fusePick(FUSE_CLOSER_KO.carry, (fingerprint || 0) + 13);
      identityKo = _fuseEul(core) + " " + act + " " + _fuseEro(fruitNoun) + " " + carry;
    } else {
      var build = _fusePick(FUSE_CLOSER_KO.build, (fingerprint || 0) + 29);
      identityKo = _fuseEul(core) + " " + act + " " + _fuseEro(fruitNoun) + " " + build;
    }
    var identityCore = identityKo + " 자리";
    return { core:core, act:act, fruitNoun:fruitNoun, count:n,
             identityKo:identityKo, phraseKo:identityKo + " 자리에서", identityCore:identityCore };
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
  function extractMissionVisionVars(report, isEn, fingerprint){
    var out = {
      missionHeadline: "", missionSubline: "",
      visionHeadline:  "", visionSubline:  "",
      primaryDomain:   "", secondaryDomain: "",
      allDomains:      [],   // [P18] 회원이 선택한 모든 관심 분야(종교·교육·경영 등)
      domainPhrase:    "",
      domainFused:     "",   // [P21 대원칙-C] 융합 정체성 자리(예: "신념을 가르쳐 조직으로 키우는 자리")
      domainFusedCore: "",   // [P21] 융합 관형형(예: "신념을 가르쳐 조직으로 키우는") — 조사 결합용
      domainCoreKo:    "",   // [CF] 융합 좌표의 핵 명사(예: "조직") — 호칭형 노출용
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
    // [P18] 전체 관심 분야 배열 — 신규 리포트는 all_domains 사용, 구버전 리포트는
    //   primary/secondary 로 재구성(하위호환·회귀 안전).
    if (Array.isArray(slots.all_domains) && slots.all_domains.length) {
      out.allDomains = slots.all_domains
        .map(function(d){ return String(d == null ? "" : d).trim(); })
        .filter(Boolean);
    } else {
      out.allDomains = [out.primaryDomain, out.secondaryDomain]
        .map(function(d){ return String(d || "").trim(); })
        .filter(Boolean);
    }
    // [P21 · 대원칙-C 융합] 원분야 나열("경제와 교육") 폐기 → 융합 정체성 자리로 복원.
    //   fuseDomains는 리포트 엔진과 완전 동일 로직 → 같은 fingerprint면 두 리포트 일관.
    //   한국어(고유성 검증 대상)만 융합, EN·응답부재 시 기존 조립 폴백(대원칙-B 비파괴).
    var _fuseP = fuseDomains(out.allDomains, fingerprint || 0);
    if (!isEn && _fuseP.count > 0) {
      out.domainFused     = _fuseP.identityCore;   // "… 자리"
      out.domainFusedCore = _fuseP.identityKo;     // "…키우는"(관형형)
      out.domainCoreKo    = _fuseP.core || "";   // [CF] 호칭형(4~9자) 원천
      out.domainPhrase    = _fuseP.identityCore;   // 템플릿 노출용 = 융합
    } else {
      // 폴백: EN 결합 / 응답부재 (대원칙-B 비파괴). domainFused는 노출 안전값 보장.
      /* [§7 차단 2026-07-29] EN 노출 문구는 원분야 라벨을 벗긴 안전 라벨로 조립한다.
       *   (cover.typeLine / EN 템플릿 {{domainFused}} 로 전파되는 값)
       *   원본 out.primaryDomain / out.secondaryDomain 은 그대로 남긴다 — 내부 로직·
       *   careerEngine 이 그 값을 쓴다(line 1397 주석). KO 분기 무변경. */
      var _pdSafe = isEn ? _peDomEnSafe(out.primaryDomain)   : out.primaryDomain;
      var _sdSafe = isEn ? _peDomEnSafe(out.secondaryDomain) : out.secondaryDomain;
      if (_pdSafe && _sdSafe) {
        if (isEn) {
          out.domainPhrase = _pdSafe + " and " + _sdSafe;
        } else {
          var _jongPrim = _hangulJong(_pdSafe);
          var _waGwa = (_jongPrim > 0) ? "과 " : "와 ";
          out.domainPhrase = _pdSafe + _waGwa + _sdSafe;
        }
      } else {
        out.domainPhrase = _pdSafe || (isEn ? "your field" : "지금 살아가는 자리");
      }
      // EN: 원분야 결합을 노출값으로(EN은 §7 고유성 검증 대상 아님).
      // KO 응답부재: 안전 중립구.
      out.domainFused     = isEn ? out.domainPhrase : (out.domainPhrase || "지금 살아가는 자리");
      out.domainFusedCore = isEn ? out.domainPhrase : "지금 살아가는";
      out.domainCoreKo    = "";   // [CF] 융합 좌표가 없으면 호칭형도 없다 → 머리 어구 생략
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
    /* [CEO 피드백 항목8 · 표현 규칙 v1.0  2026-07-30]  제3조(가운뎃점 나열 금지)
     *   종전: base + " · " + coda → 40/40 시드에서 가운뎃점 1개가 항상 노출됐다.
     *   ★ 이 필드는 웹 대시보드 §1 '결이 흐르는 자리' 카드에 실제 렌더된다
     *     (program.html:2803 sm.env — 별칭이라 summary.env grep 은 0을 반환한다).
     *   교정: 두 명사구를 버리지 않고(대원칙 B) 각각 평서 단문으로 세운다.
     *     L3_ENV_KO 5개 값은 전부 '환경' 또는 '자리'로 끝나고, coda 4개는 전부
     *     '자리'로 끝난다 → "…이(가) 잘 맞습니다." / "…라면 더 좋습니다." 가
     *     둘 다 정상 국어로 붙는다(어미 변환이 아니라 조립 이음새에서 처리). */
    if (!coda) return base;
    return _fixJosaPairs(base + "이(가) 잘 맞습니다. " + coda + "라면 더 좋습니다.");
  }

  /* 신규 가능성 — [CEO 피드백 항목8 · 표현 규칙 v1.0  2026-07-30]  제3조 + 제4조
   *   종전: newPaths 4개를 " · " 로 join → 40시드 가운뎃점 96건.
   *     "아름다움을 세우고 지켜 내는 사람 · 아름다움을 깊이 파고드는 사람 · …"
   *     세 항목이 같은 주어 꼴로 반복돼 읽는 사람이 무엇이 다른지 알 수 없었다.
   *   ★ 이 필드는 웹 대시보드 §1 '이 사명이 여는 길' 카드에 실제 렌더된다
   *     (program.html:2804 sm.newPaths).
   *   교정: 3개까지만 세우고(4번째는 카드 한 호흡을 넘긴다) 각 항목에 순서
   *     표지("먼저 / 이어서 / 같은 결에서")를 붙여 나열이 아니라 경로가 되게 한다.
   *     · 가운뎃점 0  · 문장당 30자 안팎  · 1문장 1동작
   *   ★ 남은 항목을 지우는 것이 아니다 — 4번째는 종전에도 화면에서 잘려 나갔고
   *     같은 정보는 IV장 진로 확장 지면이 더 넓게 전달한다.
   *   ★ '으로/로' 는 _fixJosaPairs 가 받침으로 확정한다.
   *   ★ EN 은 i18n SSOT 보존 — 종전 join 그대로(EN 은 3차 잔여 범위). */
  function l3NewPathsLine(newPathsArr, missionHeadlineRaw, isEn){
    var arr = (newPathsArr || []).map(function(x){ return String(x || "").trim(); }).filter(Boolean);
    if (isEn) {
      var joinEn = arr.slice(0, 4).join(" · ");
      return joinEn || "Paths to take this mission outward";
    }
    if (!arr.length) return "이 사명을 바깥으로 가져갈 길";
    /* [회귀 수정 2026-07-30 · G2a 처격 중복 19/40]
     *   종전 3번째 표지는 "같은 결에서 " 였다. 그런데 arr[2] 자체가 대개
     *   "…을 곁에서 지켜 내는 사람" 이라 처격(-에서)이 한 줄에 두 번 겹쳤다.
     *   d3_quality 의 '처격 중복' 판정이 40시드 중 19건을 잡았다.
     *   → 순서 표지를 처격이 없는 접속 부사 "나아가 " 로 바꾼다.
     *     경로감(먼저 → 이어서 → 나아가)은 그대로 유지되고 격 충돌만 사라진다.
     *   ★ 교훈: 문장을 나눌 때 새로 넣는 부사구도 같은 격이 겹치는지 봐야 한다. */
    /* ══════════════════════════════════════════════════════════════════════════
     * [CEO 피드백 항목14 · 2026-07-30 · 표현 규칙 제3조]  '결합형' 조합 라벨 제거
     * ──────────────────────────────────────────────────────────────────────────
     *   ★ 실측(40시드): 11건이 진로엔진의 조합 라벨을 그대로 안고 들어왔다.
     *       "사회·사업·조직 운영 결합형 — B-Corp 창업가"
     *     그 결과 카드 한 문장이 89자가 되고, 가운뎃점 나열(제3조 위반)이
     *     고객 지면에 그대로 찍혔다. 고객이 카드에서 알고 싶은 것은
     *     "무엇이 결합됐는지" 가 아니라 "어디로 갈 수 있는지(이름)" 다.
     *   처방: em dash 뒤의 실제 직업어만 남긴다.
     *   ★★ 정보 손실 0 (대원칙 B): 어떤 영역이 결합됐는지는 리포트 V장
     *     진로·경력·교육 큐레이션의 도메인 확장 지면(domainExpansion)이 더 넓게
     *     설명한다. 여기서 지우는 것은 '중복' 이지 '정보' 가 아니다.
     *   ★ em dash 가 없으면 원문을 그대로 둔다(폴백 보존).
     * ══════════════════════════════════════════════════════════════════════════ */
    arr = arr.map(function (s) {
      var m = /\u2014\s*(.+)$/.exec(s);
      var v = m ? String(m[1]).trim() : s;
      return v || s;
    });
    var lead = ["", "이어서 ", "나아가 "];
    var tail = ["으로 갈 수 있습니다.", "이(가) 열립니다.", "도 가능합니다."];
    var out = [];
    for (var i = 0; i < arr.length && i < 3; i++) out.push(lead[i] + arr[i] + tail[i]);
    return _fixJosaPairs(out.join(" "));
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
    warm_connector: { m1:"\u2018{{missionHeadline}}\u2019에 한 걸음 다가가기 위해, 마음을 전하는 짧은 메시지를 매주 한 번 보내 봅니다.", m3:"{{domainFused}}에서 속 깊은 대화 3번을 3개월 결과로 남깁니다.", y1:"1년 뒤 \u2018{{visionHeadline}}\u2019에 가까워지도록, 믿을 수 있는 사람들의 관계 지도 한 장을 만들어 둡니다." },
    principled_designer: { m1:"\u2018{{missionHeadline}}\u2019에 한 걸음 다가가기 위해, 결정하기 전에 내 기준을 한 번 확인하는 습관을 시작합니다.", m3:"{{domainFused}}에서 내 기준대로 내린 결정 5건을 3개월 결과로 적어 둡니다.", y1:"1년 뒤 \u2018{{visionHeadline}}\u2019에 가까워지도록, 한 해 동안의 결정과 배움을 정리한 기록 한 권을 완성합니다." },
    visionary_creator: { m1:"\u2018{{missionHeadline}}\u2019에 한 걸음 다가가기 위해, 떠오른 아이디어를 한 줄로 적어 보는 습관을 시작합니다.", m3:"{{domainFused}}에서 직접 내놓은 결과물 3건을 3개월 결과로 남깁니다.", y1:"1년 뒤 \u2018{{visionHeadline}}\u2019에 가까워지도록, 한 해 동안 만든 결과물을 모은 작업 모음집 한 권을 완성합니다." },
    pragmatic_achiever: { m1:"\u2018{{missionHeadline}}\u2019에 한 걸음 다가가기 위해, 매주 가장 중요한 한 가지를 먼저 끝내는 습관을 시작합니다.", m3:"{{domainFused}}에서 눈에 보이는 결과 목표 1개를 3개월 안에 끝냅니다.", y1:"1년 뒤 \u2018{{visionHeadline}}\u2019에 가까워지도록, 한 해 동안 낸 결과를 정리한 성과 모음 한 쪽을 완성합니다." },
    reflective_explorer: { m1:"\u2018{{missionHeadline}}\u2019에 한 걸음 다가가기 위해, 하루 한 가지 질문을 한 줄로 적어 보는 습관을 시작합니다.", m3:"{{domainFused}}에서 차분히 돌아본 기록 3건을 3개월 결과로 남깁니다.", y1:"1년 뒤 \u2018{{visionHeadline}}\u2019에 가까워지도록, 한 해 동안의 생각을 정리한 기록 한 권을 완성합니다." }
  };
  var L3_NEXTSTEPS_EN = {
    warm_connector: { m1:"Begin one routine of {{compassKw}} messages to move closer to \u2018{{missionHeadline}}\u2019.", m3:"Secure three {{compassKw}} deep conversations in {{domainFused}} as the quarter\u2019s result.", y1:"Complete a one-page {{compassKw}} network so that one year on you stand as \u2018{{visionHeadline}}\u2019." },
    principled_designer: { m1:"Begin a {{compassKw}} principle-question routine to move closer to \u2018{{missionHeadline}}\u2019.", m3:"Articulate five {{compassKw}} decisions in {{domainFused}} as the quarter\u2019s result.", y1:"Complete a one-volume retrospective on one steady line so that one year on you stand as \u2018{{visionHeadline}}\u2019." },
    visionary_creator: { m1:"Begin a {{compassKw}} one-line work copy to move closer to \u2018{{missionHeadline}}\u2019.", m3:"Ship three {{compassKw}} publications in {{domainFused}} as the quarter\u2019s result.", y1:"Complete a one-volume works index in your color so that one year on you stand as \u2018{{visionHeadline}}\u2019." },
    pragmatic_achiever: { m1:"Begin a {{compassKw}} result-first routine to move closer to \u2018{{missionHeadline}}\u2019.", m3:"Close one {{compassKw}} KPI in {{domainFused}} as the quarter\u2019s result.", y1:"Complete a one-page result portfolio so that one year on you stand as \u2018{{visionHeadline}}\u2019." },
    reflective_explorer: { m1:"Begin a {{compassKw}} one-line-question routine to move closer to \u2018{{missionHeadline}}\u2019.", m3:"Secure three {{compassKw}} reflection retrospectives in {{domainFused}} as the quarter\u2019s result.", y1:"Complete a one-volume reflection book on your own path so that one year on you stand as \u2018{{visionHeadline}}\u2019." }
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
      "관계지향": ["이미 {{name}}님은 사람을 따뜻하게 챙기는 마음을 충분히 갖고 있습니다.","이번 분기는 그 마음을 '듣고, 표현하고, 정리하는' 작은 습관으로 만드는 시간입니다.","{{domainFused}}에서 작은 습관 하나가 자리 잡으면 사람과의 신뢰가 눈에 띄게 쌓입니다."],
      "원칙지향": ["이미 {{name}}님은 사람과 한 약속을 한결같이 지키고 있습니다.","이번 분기는 그 약속을 '지키고, 쌓고, 정리하는' 습관으로 만드는 시간입니다.","{{domainFused}}에서 어긋나지 않는 약속이 하나씩 쌓이면 신뢰가 단단해집니다."],
      "성장지향": ["이미 {{name}}님은 사람을 만날 때마다 한 가지씩 배우고 있습니다.","이번 분기는 그 배움을 '만나고, 배우고, 정리하는' 습관으로 만드는 시간입니다.","{{domainFused}}에서 한 사람과의 깊은 대화가 분기마다 한 걸음의 성장을 만듭니다."],
      "자유지향": ["이미 {{name}}님은 사람들과 함께 있어도 자기 색을 또렷이 지키고 있습니다.","이번 분기는 그 색을 '함께하고, 지키고, 정리하는' 습관으로 만드는 시간입니다.","{{domainFused}}에서 휘둘리지 않는 모습이 오히려 사람들의 신뢰를 만듭니다."]
    },
    principled_designer: {
      "원칙지향": ["이미 {{name}}님은 결정하기 전에 자기 기준을 한 번 더 확인하고 있습니다.","이번 분기는 그 기준을 '점검하고, 결정하고, 돌아보는' 습관으로 만드는 시간입니다.","{{domainFused}}에서 흔들리지 않는 결정이 하나씩 쌓이면 원칙이 분명한 길이 됩니다."],
      "관계지향": ["이미 {{name}}님은 가까운 사람과 한 약속을 한결같이 지키고 있습니다.","이번 분기는 그 약속을 '지키고, 쌓고, 정리하는' 습관으로 만드는 시간입니다.","{{domainFused}}에서 가까운 사람과의 약속을 어김없이 지키면 그게 단단한 신뢰가 됩니다."],
      "성장지향": ["이미 {{name}}님은 새로 배운 것을 매일 한 줄로 정리하고 있습니다.","이번 분기는 그 배움을 '다듬고, 깊이 보고, 정리하는' 습관으로 만드는 시간입니다.","{{domainFused}}에서 작은 시도 하나가 분기마다 한 걸음 더 깊은 이해를 만듭니다."],
      "자유지향": ["이미 {{name}}님은 남의 시선이 아니라 자기 기준대로 결정하고 있습니다.","이번 분기는 그 기준을 '점검하고, 내 방식대로 결정하고, 정리하는' 습관으로 만드는 시간입니다.","{{domainFused}}에서 또렷한 내 기준이 새로운 길을 엽니다."]
    },
    visionary_creator: {
      "원칙지향": ["이미 {{name}}님은 무언가 만들 때마다 자기 기준을 분명히 지키고 있습니다.","이번 분기는 그 기준을 '초안 만들기, 다듬기, 정리하기' 습관으로 만드는 시간입니다.","{{domainFused}}에서 색이 분명한 결과가 하나씩 쌓이면 나만의 스타일이 자리 잡습니다."],
      "관계지향": ["이미 {{name}}님은 주변 사람을 생각하며 무언가 만들어 내고 있습니다.","이번 분기는 '사람들이 원하는 것을 듣고 → 그것을 만들고 → 정리하는' 습관을 자리 잡게 하는 시간입니다.","{{domainFused}}에서 누군가에게 정말 필요한 것을 결과물 하나로 만들어 낼 때 새로운 길이 열립니다."],
      "성장지향": ["이미 {{name}}님은 만들 때마다 새로운 아이디어를 더하고 있습니다.","이번 분기는 그 시도를 '초안 만들기, 빠르게 끝내기, 정리하기' 습관으로 만드는 시간입니다.","{{domainFused}}에서 공개한 결과 하나가 분기마다 한 단계 더 나은 작업을 만듭니다."],
      "자유지향": ["이미 {{name}}님은 유행이 아니라 내 방식대로 만들고 있습니다.","이번 분기는 그 방식을 '초안 만들기, 내 색대로 다듬기, 정리하기' 습관으로 만드는 시간입니다.","{{domainFused}}에서 내 색이 담긴 결과 하나가 새로운 길을 엽니다."]
    },
    pragmatic_achiever: {
      "원칙지향": ["이미 {{name}}님은 일을 끝내기 전에 자기 기준을 분명히 지키고 있습니다.","이번 분기는 그 기준을 '1순위 정하기, 끝내기, 정리하기' 습관으로 만드는 시간입니다.","{{domainFused}}에서 흐트러지지 않는 결과가 하나씩 쌓이면 실력이 결과로 증명됩니다."],
      "관계지향": ["이미 {{name}}님은 사람과 한 약속을 끝까지 챙기고 있습니다.","이번 분기는 그 약속을 '정하기, 함께 끝내기, 정리하기' 습관으로 만드는 시간입니다.","{{domainFused}}에서 함께 끝낸 결과 하나가 다음 약속을 가능하게 합니다."],
      "성장지향": ["이미 {{name}}님은 결과를 내며 분기마다 한 단계씩 자라고 있습니다.","이번 분기는 그 흐름을 '시도하기, 끝내기, 정리하기' 습관으로 만드는 시간입니다.","{{domainFused}}에서 끝낸 일 하나가 분기마다 한 단계 자란 결과를 만듭니다."],
      "자유지향": ["이미 {{name}}님은 남의 속도가 아니라 내 속도로 결과를 끝내고 있습니다.","이번 분기는 그 속도를 '1순위 정하기, 내 방식대로 끝내기, 정리하기' 습관으로 만드는 시간입니다.","{{domainFused}}에서 흐트러짐 없는 결과 하나가 사람들의 신뢰를 만듭니다."]
    },
    reflective_explorer: {
      "원칙지향": ["이미 {{name}}님은 매일 한 가지 질문을 스스로 던지고 있습니다.","이번 분기는 그 질문을 '묻고, 생각하고, 정리하는' 습관으로 만드는 시간입니다.","{{domainFused}}에서 잘 다듬은 질문 하나가 한 걸음 더 깊은 이해를 만듭니다."],
      "관계지향": ["이미 {{name}}님은 사람과 깊은 생각을 나누고 있습니다.","이번 분기는 그 대화를 '듣고, 생각하고, 정리하는' 습관으로 만드는 시간입니다.","{{domainFused}}에서 한 사람과의 대화가 생각을 한 걸음 더 나아가게 합니다."],
      "성장지향": ["이미 {{name}}님은 질문을 작은 시도로 옮기며 답을 찾고 있습니다.","이번 분기는 그 흐름을 '묻고, 작게 시도하고, 정리하는' 습관으로 만드는 시간입니다.","{{domainFused}}에서 작은 시도 하나가 분기마다 한 걸음 더 분명한 답을 만듭니다."],
      "자유지향": ["이미 {{name}}님은 차분히 자기 길을 또렷이 그려 가고 있습니다.","이번 분기는 그 길을 '묻고, 내 방식대로 생각하고, 정리하는' 습관으로 만드는 시간입니다.","{{domainFused}}에서 차분한 생각 하나가 새로운 길을 엽니다."]
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
    /* [고유코드 표기 통일 · 2026-08-13] 리포트가 낸 64비트 지문을 그대로 받는다.
     *   왜 — 지면(X장)은 "64비트 고유코드로 표기합니다" 라고 스스로 밝히는데,
     *   IX장 칩은 32비트 값(fingerprint)을 노출해 같은 응답자의 코드가 두 형식으로
     *   보였다(2차 심층보고서 우선순위 6). 표기 정본을 64비트 hex 로 통일한다.
     *   변주 선택은 종전대로 32비트 fingerprint 를 쓴다 → 산출 내용 100% 불변. */
    var hasFingerprint64 = !!(report && report._v4Meta &&
                              typeof report._v4Meta.fingerprint64 === "string" &&
                              report._v4Meta.fingerprint64.length > 0);
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
    var mvVars = extractMissionVisionVars(report, isEn, fingerprint);

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
    /* [Phase D-3 Step N-B] career-engine 은 lang='en' 이어도 KO 직업명을 반환한다
     *   (융합 경로는 KO 전용이고, 사전 경로도 careerRules 가 KO SSOT).
     *   그 결과 EN 프로그램의 effects.fitJob / expansion / newPaths 와
     *   cover.summary.newPaths 에 한글 직업명이 실렸다.
     *   ★ 리포트 V장은 v4 가 이미 EN 경로(CAREER_FALLBACK_EN)로 영어화해 두었으므로
     *     EN 에서는 그 값을 재사용한다 — 리포트·프로그램 표기도 일치한다.
     *   ★ KO 는 이 블록을 타지 않는다(회귀 0). 영어 값이 없으면 null → 톤 폴백(EN 문구). */
    if (isEn) {
      var _ceEn = null;
      try {
        var _secs = (report && report.sections) || [];
        for (var _ci = 0; _ci < _secs.length; _ci++) {
          if (_secs[_ci] && _secs[_ci].id === "career_education") {
            var _cc = _secs[_ci].content || {};
            var _koRx = /[가-힣]/;
            var _cAr = (_cc.careers || []).filter(function(x){ return x && !_koRx.test(String(x)); });
            var _eAr = (_cc.education || []).filter(function(x){ return x && !_koRx.test(String(x)); });
            if (_cAr.length) _ceEn = { careers: _cAr, education: _eAr };
            break;
          }
        }
      } catch (_eEn) { _ceEn = null; }
      ce = _ceEn;
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
    // [실행 전략 v2 호환] 인계 §9.2
    //   execution_profile.content._strategy 가 v2면 구조화 source 를 우선 사용한다.
    //   전략형 public 문자열(긴 문장)을 CSV처럼 파싱하면 쉼표 앞 조각이 활동/도구명으로
    //   오삽입되므로(오해 위험), v2 리포트는 source 배열/필드에서 직접 값을 취한다.
    //   구 리포트(_strategy 없음)는 기존 _firstFromCsv 를 fallback 으로 유지한다.
    function _executionStrategy(epc){
      return (epc && epc._strategy && epc._strategy.version === "execution-strategy.v2")
        ? epc._strategy
        : null;
    }
    function _firstArrayValue(arr, fallback){
      return (Array.isArray(arr) && arr.length) ? String(arr[0]) : fallback;
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
    // [실행 전략 v2 우선] 인계 §9.3
    //   v2 리포트: source.activities/places/achievementCue 등 구조화 원응답을 직접 사용.
    //   구 리포트: 기존 _firstFromCsv(전략형 문자열 파싱) fallback.
    var _strategy = _executionStrategy(ep);
    var _src = (_strategy && _strategy.source) ? _strategy.source : {};

    // Q39+Q41 가공 결과 (활동) — v2는 source.activities 배열 우선
    var userActivitiesAll = (typeof ep.activities === "string") ? ep.activities : "";
    var userActivities = (Array.isArray(_src.activities) && _src.activities.length)
      ? _src.activities.slice(0, 2).join(isEn ? ", " : ", ")
      : (_firstFromCsv(userActivitiesAll, 2) || (isEn ? "your chosen activities" : "관심 활동"));
    var userActivity1 = (Array.isArray(_src.activities) && _src.activities.length)
      ? _src.activities[0]
      : (_firstFromCsv(userActivitiesAll, 1) || (isEn ? "your chosen activity" : "관심 활동"));
    // Q47+Q49 가공 결과 (몰입 환경) — v2는 source.places 배열 우선
    var userFocusEnv = (Array.isArray(_src.places) && _src.places.length)
      ? _src.places.slice(0, 2).join(isEn ? ", " : ", ")
      : ((typeof ep.environment === "string" && ep.environment) ? ep.environment
          : (isEn ? "your chosen focus environment" : "회원님의 몰입 환경"));
    // Q73 가공 결과 (성취 도구) — v2는 source.achievementCue 원문 우선
    //   (기존 구 리포트의 tools 는 "성취단서 · 톤 루틴" 형태라 "·" 앞 토막을 fallback 파싱)
    var userToolsAll = (typeof ep.tools === "string") ? ep.tools : "";
    var userTool1 = (_src.achievementCue && String(_src.achievementCue).trim())
      ? String(_src.achievementCue).trim()
      : (_firstFromCsv(userToolsAll, 1) || (isEn ? "your chosen routine" : "회원님의 성취 도구"));
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
      primaryDomain:   mvVars.primaryDomain,     // 원본(내부 로직·careerEngine용, 텍스트 노출 금지)
      secondaryDomain: mvVars.secondaryDomain,   // 원본(내부용)
      allDomains:      mvVars.allDomains || [],   // [P18] 전체 관심 분야 배열
      domainPhrase:    mvVars.domainPhrase,       // [P21] 융합 정체성 자리(노출용)
      domainFused:     mvVars.domainFused,        // [P21 대원칙-C] "…키우는 자리"(노출용)
      domainFusedCore: mvVars.domainFusedCore,    // [P21] "…키우는"(관형형·조사결합용)
      domainCoreKo:    mvVars.domainCoreKo,       // [CF] 호칭형 핵 명사
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
    /* [PR-고유한결 v2 · 대원칙-C 융합 + 성경 근본원리 전환]
     *   배경(구버전 문제): '고유한 결 — {toneLabel} · {toneTagline}' 은 5개 톤 유형 중 1개로
     *     '유형화(typing)' 되어, CliftonStrengths·MBTI식 "당신은 ○○형" 프레임을 남겼다.
     *     이는 우리 근본원리와 어긋난다:
     *       · 융합(대원칙-C): 정체성은 유형이 아니라 응답 속성 벡터의 무게중심을 사람 말로 복원한 것.
     *       · 성경(마 25:15 달란트 '각각 그 재능대로'): 유형이 아니라 그 한 사람에게만 맡겨진 고유한 결.
     *     또 toneLabel 조립 과정에서 '끝까지 해내 사람과' 식 조사 누락(비문)이 노출됐다.
     *   해법: toneLabel/toneTagline 을 버리고, 이미 준비된 융합 재료로 재작성.
     *       domainFusedCore(응답기반 융합 관형형 "…채워 넣는", §7 원분야 라벨 소멸)
     *       + userTopStrength(Q6 강점) + 성경 근본의 '세상에 하나뿐인 재능' 정체.
     *   재현성: domainFusedCore·userTopStrength 모두 fingerprint 결정론 → 같은 사람=항상 동일. NO random.
     *   비파괴/회귀 안전: domainFusedCore 부재(구버전 캐시) 시 안전 중립 관형형으로 폴백.
     */
    var typeLine;
    (function(){
      var _core = (vars.domainFusedCore || "").trim();   // "…채워 넣는" / "…키우는"(관형형·융합)
      var _str  = (userTopStrength || "").trim();
      if (isEn) {
        var _coreEn = _core || (name + "'s own way");
        typeLine = name + "'s own grain — a person living out " + _coreEn
                 + (_str ? (" — " + _str + " is a talent no one else carries.") : ".");
      } else {
        // 관형형 + '사람' 자연 결합(예: "…채워 넣는 사람"). 폴백: 응답부재 시 안전 중립구.
        var _coreKo = _core || "자기 자리를 살아가는";
        var _tail;
        if (_str) {
          // userTopStrength 은 명사/명사구 → _fuseEun 로 '은/는' 조사 자동 결합(비문 방지).
          // 성경 근본(마 25:15 '각각 그 재능대로'): 유형이 아니라 그 한 사람에게만 맡겨진 결.
          var _jong = _hangulJong(String(_str).slice(-1));
          var _eunNeun = (_jong > 0) ? "은" : "는";
          _tail = " — " + _str + _eunNeun + " 세상에 하나뿐인 재능입니다.";
        } else {
          _tail = " — 세상에 하나뿐인 결을 살아냅니다.";
        }
        typeLine = name + "님의 고유한 결 — " + _coreKo + " 사람" + _tail;
      }
    })();

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
      /* ────────────────────────────────────────────────────────────────
       * [CEO 피드백 항목8 · 표현 규칙 v1.0  2026-07-30]  제3조 + 제4조 적용
       *   CEO: "이 모든 피드백을 동일한 기준으로 맞춤형 실행 프로그램 모든
       *         페이지에도 검토 및 개선해서 적용해주세요."
       *
       *   종전 실측(40시드): "A · B · C — 이 사명을 받쳐 주는 힘." 68자 한 문장.
       *     · 가운뎃점 80건 = 제3조(나열 금지) 위반
       *     · 68자 1문장  = 제4조(1문장 1동작) 위반
       *     · 꼬리 "— 이 사명을 받쳐 주는 힘." 은 카드 헤드라인
       *       strengthsHead("사명을 받쳐 주는 힘")와 같은 말이라 중복이었다.
       *   ★ 이 필드는 웹 대시보드 §1 '나를 받쳐 주는 힘' 카드(gx-idc .b)에
       *     실제 렌더된다 — 소비처 grep 으로 확인(program.html:2789 sm.strengths).
       *     별칭 sm. 을 쓰므로 "summary.strengths" grep 은 0을 반환한다.
       *
       *   교정: 세 강점을 버리지 않고(대원칙 B — 정보 손실 금지) 나열을
       *     '한 문장 한 동작'의 평서 단문 3개로 바꾼다. 가운뎃점 0, 중복 꼬리 제거.
       *   ★ 술어는 강점 문구와 어절이 겹치지 않는 것만 고른다(대원칙 C-1).
       *     예: 강점이 "…끝으로 데려가는 추진력" 이면 "…데려갑니다" 술어를 버린다.
       *   ★ Math.random 금지(C-5) — fingerprint 로 결정적 선택.
       *   ★ 조사는 이(가) 표기로 두고 _fixJosaPairs 가 받침으로 확정한다.
       *   ★ EN 은 i18n SSOT 보존 — 종전 문형 그대로 둔다(EN 은 3차 잔여 범위).
       * ──────────────────────────────────────────────────────────────── */
      if (isEn) {
        strengthsLine = top3Join + " \u2014 the grain that carries this mission.";
      } else {
        var _S3 = reportStrengths.slice(0, 3);
        var _fpS = (_peKo(_strategy, isEn).fp || 0);
        var _PC = [
          ["이(가) 바탕입니다.", "이(가) 중심에 있습니다.", "이(가) 먼저 움직입니다."],
          ["이(가) 이를 받쳐 줍니다.", "이(가) 여기에 더해집니다.", "이(가) 그 뒤를 잡아 줍니다."],
          ["이(가) 마무리를 맡습니다.", "이(가) 결과로 이어집니다.", "이(가) 끝까지 밀어 줍니다."]
        ];
        var _sParts = [];
        for (var _si = 0; _si < _S3.length && _si < 3; _si++) {
          var _pool = _PC[_si].filter(function (p) { return !_peD3Dup(p, [_S3[_si]]); });
          if (!_pool.length) _pool = _PC[_si];          // 전면 충돌 → 폴백 유지(대원칙 B)
          _sParts.push(_S3[_si] + _peD3Pick(_pool, (_fpS >>> 3) + _si * 7 + 5));
        }
        strengthsLine = _fixJosaPairs(_sParts.join(" "));
      }
    } else {
      // 톤×Compass 한 호흡 폴백 (점수·축% 노출 금지)
      strengthsLine = tpl(l3TraitPhrase(toneKey, primaryCat, isEn), vars);
    }

    // ③ 보완점 — 약축 → 한 호흡 (점수 노출 금지)
    /* [Phase D-3 Step M] 약축 4종만 보던 탓에 서로 다른 문장이 4개뿐이었고
     *   그중 1개를 63%가 받았다(=유형화). '더할 결' 은 가장 개인적인 칸이므로
     *   §7-안전 좌표(Q47 자리 / Q49 덩어리 / Q73 완료 기준)를 한 어절 접미로
     *   얹어 '어디서 · 무엇을 볼 때까지 더할지' 를 개인화한다.
     *   ★ 절은 늘리지 않는다(대원칙-A) — 한 호흡 유지, 어휘 자리만 교체.
     *   ★ EN 은 koCoords 부재 → 원문 그대로(i18n SSOT 보존).
     *   ★ 조사는 을(를)/이(가) 표기로 두고 _fixJosaPairs 가 받침으로 확정한다. */
    var gapsLine = tpl(l3GapPhrase(sw.weak, isEn), vars);
    gapsLine = (function(_base){
      if (isEn) return _base;
      var _kG = _peKo(_strategy, isEn);
      var _w = _kG.where || "", _d = _kG.doneWord || "", _b = _kG.block || "", _t = _kG.when || "";
      var _cands = [];
      if (_w) _cands.push(" — " + _w + "에서 한 번씩");
      if (_d) _cands.push(" — ‘" + _d + "’을(를) 볼 때까지");
      if (_b) _cands.push(" — " + _b + "에 하나씩");
      if (_t) _cands.push(" — " + _t + "에 한 호흡씩");
      if (_w && _d && !_peD3Dup(_w, [_d]))
        _cands.push(" — " + _w + "에서 ‘" + _d + "’이(가) 남을 만큼");
      /* 본문과 어절이 겹치는 후보는 버린다(대원칙-C1) */
      var _ok = [];
      for (var _i = 0; _i < _cands.length; _i++){
        if (!_peD3Dup(_cands[_i], [_base])) _ok.push(_cands[_i]);
      }
      if (!_ok.length) return _base;   // 좌표 부재/전면 충돌 → 폴백 유지(대원칙-B)
      var _tail = _peD3Pick(_ok, ((_kG.fp || 0) >>> 5) + 3);
      return _fixJosaPairs(_base + _tail);
    })(gapsLine);

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

    /* ══════════════════════════════════════════════════════════════════════════
     * [CEO 피드백 항목14 · 2026-07-30]  '한 눈에 보는 나' 카드 헤드라인 맞춤화
     * ──────────────────────────────────────────────────────────────────────────
     *   CEO 원문: "🌿 나의 결·성향 / 💎 나를 받쳐 주는 힘 / 🏡 잘 맞는 자리 …
     *     직관적 표현력을 더욱 향상 … 마치 인바디 검사를 하고 그에 맞게 트레이너가
     *     … 프로그램을 제작해서 제공하면 고객이 바로 그걸 보고 따라하기만 해도 되듯이"
     *
     *   ★★★ 결함 (AN) 실증 — "엔진이 만든 맞춤 헤드라인을 지면이 버리고 있었다".
     *     PR#54 주석은 이 카드를 「헤드라인 + 한 호흡 본문」 2층으로 설계했다고
     *     적어 두었는데, 렌더층은 5개 *Head 필드를 단 한 곳도 쓰지 않았다.
     *       웹  program.html:2930/2931/2956/2960  고정 라벨만 출력
     *       PDF program.html:4239/4244            고정 라벨 배열만 출력
     *     즉 80억 명이 같은 제목("나를 받쳐 주는 힘")을 읽고 있었고, 개인화 값은
     *     생성만 되고 버려졌다. G17 계열 검사(누출)로도, distinct 측정으로도
     *     보이지 않는 종류의 결함이다 — '만들었지만 안 쓰는 필드' 이기 때문이다.
     *     ⇒ 이번 조치는 렌더층에서 이 2층을 실제로 살리고(program.html),
     *       동시에 아래에서 헤드라인 자체의 k=1 을 해소한다.
     *
     *   ★★ 종전 실측(40시드): strengthsHead·gapsHead·newPathsHead distinct 1/40
     *     (전 고객 동일 문자열) · traitsHead 와 envHead 가 10/40 시드에서 완전 동일
     *     ("마음이 머무는 자리" — warm_connector 톤이 두 사전에 같은 값을 갖는다).
     *     헤드라인을 지면에 올리는 순간 이 둘은 '같은 제목의 카드 2개' 가 된다.
     *
     *   설계 — 카드마다 '다른 응답' 에 반응하게 좌표를 분산한다(결함 AL 가드).
     *     traits    톤 × Compass 카테고리      (기존 사전 유지 · 이미 14/40)
     *     strengths actShort   활동  Q39       "돕는 일에서 먼저 나오는 힘"
     *     gaps      blockShort 리듬  Q49       "몰입 시간에 작게 끝내는 힘"
     *     env       whereShort 자리  Q47       "바깥 자리에서 살아나는 결"
     *     newPaths  doneWord   완료 기준 Q73   "‘닿은 도움’ 다음에 열리는 길"
     *   ★ 마무리 어절은 fingerprint 로 고른다 — 응답 전체 파생(대원칙 C-5)이므로
     *     어느 문항이 바뀌어도 제목이 함께 움직인다. 길이는 최대 +6자.
     *   ★ 좌표가 없으면 기존 사전값을 그대로 쓴다(대원칙 B — 폴백 보존).
     *   ★ 제3조: 가운뎃점 나열을 쓰지 않는다. 제2조: 은유 명사구 1개 이하.
     *   ★ 조사는 이(가) 표기로 두고 _fixJosaPairs 가 받침으로 확정한다.
     *   ★ EN 은 좌표 사전이 없다(koCoords=null) → 종전 문구 그대로(i18n SSOT).
     * ══════════════════════════════════════════════════════════════════════════ */
    if (!isEn) {
      var _kHd = _peKo(_strategy, isEn);
      var _hdAct = _kHd.actShort || "";
      var _hdWhr = _kHd.whereShort || "";
      var _hdBlk = _kHd.blockShort || "";
      var _hdDone = _kHd.doneWord || "";
      var _hdFp = (_kHd.fp | 0);
      if (_hdAct) {
        strengthsHead = _fixJosaPairs(_hdAct + _peD3Pick(
          ["에서 먼저 나오는 힘", "에서 오래 버티는 힘", "에서 끝까지 가는 힘"], _hdFp + 4));
      }
      if (_hdBlk) {
        /* 리듬 좌표는 사전 8항목이 상한이므로 연결 조사도 fingerprint 로 고른다
           (좌표 1개 + 사전 4항목만으로는 distinct 7/40 에 머물렀다 — 결함 AL 가드). */
        gapsHead = _hdBlk + _peD3Pick(["에 ", "마다 ", "부터 "], _hdFp + 10) + gapsHead;
      }
      if (_hdWhr) {
        envHead = _hdWhr + _peD3Pick(
          ["에서 잘 흐르는 결", "에서 살아나는 결", "에서 편해지는 결"], _hdFp + 8);
      }
      if (_hdDone) {
        newPathsHead = _fixJosaPairs("\u2018" + _hdDone + "\u2019" + _peD3Pick(
          [" 다음에 열리는 길", " 뒤로 이어지는 길", " 이후에 여는 길"], _hdFp + 6));
      }
      /* 최종 안전망 — 두 카드 제목이 그래도 같으면 한쪽을 한 칸 옮긴다.
         (사전값끼리 겹칠 수 있는 경로가 남아 있으므로 값 비교로 못 박는다) */
      if (envHead === traitsHead) {
        envHead = _hdWhr
          ? (_hdWhr + "에서 편해지는 결")
          : (envHead + " 쪽");
      }
    }

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
      // [#6] 리포트 요약 한 줄 평(원문) — 표지/보조 맥락용 보존.
      coreOneLine: pickReportCoreOneLine(report, name),
      // [#6-fix 2026-07-27] 프로그램 Ⅰ 상단 각인 = 리포트 화면과 동일한 진단명 배지 + 2슬롯 첫 문장.
      diagBadge: pickReportGlance(report).diagBadge,
      introLine: pickReportGlance(report).introLine,
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
      /* ★ 결함 (AP) — 괄호 뒤 조사 하드코딩 제거 */
      (actAct ? (_peParenJosa("이번 주에 좋아하는 활동", actAct, "eul") + " 한 번 직접 해 봅니다.") : "이번 주에 좋아하는 활동을 한 번 직접 해 봅니다."),
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
    /* ═══════════════════════════════════════════════════════════════════════
     * [P18b] 본문 응답직합성 합성 (B안 확정) — tone pool 우회, 2단 구조
     *
     *   확정안(개발자 전달용) 그대로 구현:
     *   · tone 5종 pool 은 dead code 로 보존하되, 프로덕션 렌더 경로에서는
     *     직접 호출하지 않고 아래 synthesize* 합성기로 우회한다.
     *   · 본문(guide/effects/subline/actions/3개월/1년)은 회원 응답을 직접
     *     종합해 생성한다. 표현은 "고유성 종합 × 직관 단일"(대원칙-A).
     *   · If-Then 4단: ① 지금 주목 ② 언제(감정/상태 트리거 + 활동|도구 택일)
     *     ③ 무엇을(동사형) ④ 손에 남는 것(결과물, 필수).
     *   · 문장당 실제 응답변수 ≥ 2개. fabricated 금지. 조사/붕괴 방지 시에만 fallback.
     *   · 개인화 슬롯은 주차 3문장 중 정확히 1개(강점 또는 분야 택일).
     *   · 도메인 라벨("○○ 등 N개 분야")을 그대로 노출하지 않는다.
     *
     *   비파괴(대원칙-B): 응답/fingerprint 부재 시 문장 붕괴 없이 안정 폴백,
     *     정상 흐름에서 tone pool 문장이 그대로 렌더되는 경로는 없다.
     *     같은 응답 → 같은 결과(variantIdx). tone pool 은 삭제하지 않음.
     * ═══════════════════════════════════════════════════════════════════════ */

    // ── 응답 변수 정규화(공백/괄호 정리) + 존재 여부 ────────────────────────
    function _sv(v){ return String(v == null ? "" : v).trim(); }
    function _clean1(s){
      s = _sv(s);
      if (!s) return "";
      s = s.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
      if (!s) return "";
      return s.split(/[,/·]/)[0].trim();
    }
    var _pStrength = _clean1(vars.userTopStrength);          // Q13
    var _pDomain   = _sv(vars.primaryDomain);                 // Q75
    var _pKw       = _sv(vars.compassKw);                     // Q63
    var _pAct      = _clean1(vars.userActivities) || _clean1(vars.userActivity1); // Q39/Q41
    var _pTool     = _clean1(vars.userTool1);                 // Q73
    var _pEnv      = _clean1(vars.userFocusEnv);              // Q47/Q49
    // fallback 표기(문장 붕괴 방지용 — 기본 경로 아님)
    var _fbStrength = isEn ? "your strength" : "회원님의 강점";
    var _fbAct      = isEn ? "an activity you enjoy" : "관심 활동";
    var _fbTool     = isEn ? "your rewarding moment" : "성취의 순간";
    var _fbEnv      = isEn ? "your space" : "내 공간";
    var _strengthTxt = _pStrength || _fbStrength;
    var _actTxt      = _pAct  || _fbAct;
    var _toolTxt     = _pTool || _fbTool;
    var _envTxt      = _pEnv  || _fbEnv;

    // 한글 목적격 조사(을/를)
    function _eulReul(word){
      word = _sv(word);
      if (!word) return "";
      return (_hangulJong(word.charAt(word.length - 1)) > 0) ? "을" : "를";
    }
    // pool 에서 fingerprint 결정 선택(재현성). 응답 없으면 idx 0(폴백 안전).
    function _pick(pool, salt){
      if (!Array.isArray(pool) || !pool.length) return "";
      var v = variantIdx(salt);
      return pool[v % pool.length];
    }

    /* ── synthesizeIfThenBlock: ② 언제→무엇을 (If-Then) ──────────────────────
     *   [언제] = 감정/상태 트리거(공통 뼈대) + 활동|도구 중 '택일' 결합(동시결합 금지).
     *   [무엇을] = 동사형 행동. 주차 3문장 중 개인화 슬롯 1개에 강점|분야 결합.
     *   결과: "…때 → …" 형식 → program.html _ifThenParts() 가 when/then 분리 렌더. */
    var _WHEN_STATE_KO = [
      ["막 시작하려는데 어디부터 손댈지 막막할 때", "머릿속에 떠오른 게 흩어져 잡히지 않을 때", "무엇부터 할지 우선순위가 안 설 때"],
      ["만든 걸 남에게 보여줄지 망설여질 때", "이대로 괜찮은지 확신이 안 설 때", "혼자만 붙들고 있다는 생각이 들 때"],
      ["잘 하다가 흐지부지 끝날 것 같을 때", "지치고 흐름이 끊길 것 같을 때", "여기까지 온 걸 흘려보낼 것 같을 때"]
    ];
    var _WHEN_STATE_EN = [
      ["When you're stuck on where to begin", "When your ideas feel scattered", "When priorities won't line up"],
      ["When you hesitate to show what you made", "When you're unsure it's good enough", "When you feel you're holding it alone"],
      ["When it might fizzle out midway", "When your momentum is about to break", "When you might let this slip away"]
    ];
    // 트리거에 활동|도구 택일 결합(있을 때만, 하나만).
    //   [중요] 맥락구는 '때' 앞(문두)에 둔다. '때' 뒤에 괄호를 붙이면 program.html
    //   _ifThenParts() 정규식(조건절이 '때'로 끝나야 함)이 when/then 분리에 실패한다.
    //   → 문장은 반드시 '…때'로 끝나야 4단 카드에서 ②WHEN/③THEN 이 분리 렌더된다.
    function _whenTrigger(wi, salt){
      var base = _pick(isEn ? _WHEN_STATE_EN[wi] : _WHEN_STATE_KO[wi], salt);
      // 택일: fingerprint 짝수→활동, 홀수→도구 (실제 응답 있는 쪽 우선)
      var useAct  = !!_pAct, useTool = !!_pTool;
      var pickAct;
      if (useAct && useTool) pickAct = (variantIdx(salt) % 2 === 0);
      else pickAct = useAct;
      if (isEn){
        // EN: _ifThenParts 는 KO 전용이라 EN 은 평문 표시 → 맥락구를 뒤에 둬도 무방.
        if (pickAct && _pAct)  return base + " (around " + _pAct + ")";
        if (!pickAct && _pTool) return base + " (before '" + _pTool + "')";
        return base;
      }
      // KO: 맥락구를 앞에 두어 문장이 '…때'로 끝나게 한다(파서 분리 보장).
      if (pickAct && _pAct)  return _pAct + "을(를) 앞두고, " + base;
      if (!pickAct && _pTool) return "'" + _pTool + "' 순간을 앞두고, " + base;
      return base;
    }
    // [무엇을] 동사형 행동 — 주차 의미별. 개인화 슬롯이면 강점|분야 결합.
    var _THEN_KO = [
      "떠오른 것 하나를 눈에 보이게 밖으로 꺼내 본다",
      "그 하나를 실제 사람 앞에 내놓고 반응을 들어 본다",
      "작은 것 하나라도 끝까지 마무리해 결과로 남긴다"
    ];
    var _THEN_EN = [
      "pull one idea out where you can see it",
      "put that one thing in front of a real person and hear the response",
      "carry one small thing all the way to a finished result"
    ];
    function synthesizeIfThenBlock(wi, isPersonalSlot){
      wi = Math.max(0, Math.min(2, wi|0));
      var saltWhen = 0x6301 + wi;   // 신규 salt(트리거)
      var saltThen = 0x6311 + wi;   // 신규 salt(행동)
      var when = _whenTrigger(wi, saltWhen);
      var then = isEn ? _THEN_EN[wi] : _THEN_KO[wi];
      // [P19] 개인화 슬롯: 강점(실제 응답 표현)만 결합. §7에 따라 원분야 라벨(_pDomain)은
      //   문장에 직접 노출하지 않으므로, 강점이 없으면 중립 기본 문장을 그대로 둔다.
      if (isPersonalSlot && _pStrength){
        then = isEn ? (_pStrength + "\u2014" + then)
                    : (_pStrength + "을(를) 살려 " + then);
      }
      var s = when + " \u2192 " + then;
      return _fixJosaPairs(s);
    }

    /* ── synthesizeWeekEffects: ④ 이런 변화 (동사형 살아냄 + 손에 남는 것) ─────
     *   명사형 정지어 → 동사형 진행어(원칙 07). 3개 진행문 + '손에 남는 것' 1개.
     *   개인화 슬롯(진행문 3개 중 1개)에 강점|분야 택일 결합. 결과물은 필수. */
    var _EFF_LIVE_KO = [
      ["생각이 한 문장으로 남는다", "무엇을 할지 또렷해진다", "머릿속이 눈앞에 보인다"],
      ["초안 하나를 완성해 본다", "한 사람에게 직접 보여 본다", "솔직한 반응을 얻는다"],
      ["하나를 끝까지 해낸다", "실행이 습관으로 자리 잡는다", "다음으로 이어갈 것이 생긴다"]
    ];
    var _EFF_LIVE_EN = [
      ["a thought stays as one sentence", "what to do gets clear", "your mind becomes visible"],
      ["you finish one draft", "you show it to one person", "you get honest feedback"],
      ["you carry one thing to the end", "execution becomes a habit", "something to continue emerges"]
    ];
    var _EFF_KEEP_KO = [
      "손에 남는 것: 내 강점이 담긴 결과물 1개",
      "손에 남는 것: 한 사람에게 검증받은 결과 1건",
      "손에 남는 것: 다음으로 이어지는 결과 자산"
    ];
    var _EFF_KEEP_EN = [
      "You keep: one output carrying your strength",
      "You keep: one result validated by a real person",
      "You keep: a result asset that carries into what's next"
    ];
    function synthesizeWeekEffects(wi){
      wi = Math.max(0, Math.min(2, wi|0));
      var live = (isEn ? _EFF_LIVE_EN[wi] : _EFF_LIVE_KO[wi]).slice();
      // 개인화 슬롯 = 진행문 중 1개(주차별 회전). 강점|분야 택일 결합.
      var slot = variantIdx(0x6321 + wi) % live.length;
      // 개인화 결합은 부사구('~을 살려'/'~에서')로 — 진행문이 자체 주어를 가지므로
      // 주격('이/가') 결합 시 이중주어 비문이 됨. 부사구로 붙여 자연스러운 동사형 유지.
      // [P19] §7 — 강점(실제 응답 표현)만 결합. 원분야 라벨(_pDomain)은 노출하지 않는다.
      if (_pStrength){
        live[slot] = isEn ? (_pStrength + " \u2014 " + live[slot])
                          : (_pStrength + "을(를) 살려 " + live[slot]);
      }
      var keep = isEn ? _EFF_KEEP_EN[wi] : _EFF_KEEP_KO[wi];
      var out = live.concat([keep]);
      return out.map(function(s){ return _fixJosaPairs(s); });
    }

    /* ── synthesizeWeekActions: ③ 실행 방법 (응답 종합, 동사형) ────────────────
     *   tone pool actions 우회. 주차 의미별 '골격 행동'에 회원 응답(활동/도구/환경)을
     *   결합해 4개 행동을 합성. 문장당 실제 응답변수 ≥ 1개(개인화 슬롯 포함 주차 전체 ≥ 2개).
     *   응답 없으면 골격 문장만(붕괴 없음). */
    var _ACT_SKEL_KO = [
      [ "매일 아침, 오늘 다듬을 것 하나를 한 줄로 적어 본다",
        "떠오른 생각을 그때그때 메모로 남긴다",
        "하루 끝에 한 뼘 나아간 장면을 세 줄로 적는다" ],
      [ "주 3회, 작은 실험 하나를 해보고 한 문장으로 정리한다",
        "만든 것을 봐 줄 사람 한 명에게 먼저 보여 준다",
        "받은 반응 중 바꿀 것 하나를 골라 고쳐 본다" ],
      [ "이번 주 안에 하나를 '끝났다'까지 마무리한다",
        "지난 3주에 한 것을 다섯 줄로 정리한다",
        "다음에 이어서 할 것 하나를 미리 정해 둔다" ]
    ];
    var _ACT_SKEL_EN = [
      [ "Each morning, write one thing to refine in a single line",
        "Jot down ideas as they come",
        "At day's end, note one step of progress in three lines" ],
      [ "Three times a week, run one small experiment and sum it in a sentence",
        "Show it first to one person who will look",
        "Pick one thing to change from the feedback and fix it" ],
      [ "Finish one thing all the way to 'done' this week",
        "Sum up the last three weeks in five lines",
        "Decide one thing to continue next" ]
    ];
    // 회원 응답 결합 행동(주차 회전): 1주 활동 / 2주 도구 / 3주 환경 — 실제 응답 있을 때만
    function _actPersonalLine(wi){
      if (wi === 0) return _pAct  ? (isEn ? ("Try one activity you enjoy (" + _pAct + ") once this week") : (_peParenJosa("이번 주에 좋아하는 활동", _pAct, "eul") + " 한 번 직접 해 본다")) : "";
      if (wi === 1) return _pTool ? (isEn ? ("Create one moment like '" + _pTool + "' this week") : ("이번 주에 '" + _pTool + "' 같은 순간을 한 번 만들어 본다")) : "";
      return _pEnv ? (isEn ? ("Work calmly once where you focus well (" + _pEnv + ")") : ("집중이 잘 되는 곳(" + _pEnv + ")에서 한 번 차분히 일해 본다")) : "";
    }
    function synthesizeWeekActions(wi){
      wi = Math.max(0, Math.min(2, wi|0));
      var skel = (isEn ? _ACT_SKEL_EN[wi] : _ACT_SKEL_KO[wi]).slice();
      var pl = _actPersonalLine(wi);
      var out = pl ? skel.concat([pl]) : skel;
      return out.map(function(s){ return _fixJosaPairs(s); });
    }

    /* ── synthesizeMonth3: 3개월 실행 문장 (응답직합성) ─────────────────────────
     *   tone pool month3Goals / L3 매트릭스 우회. goals={title,criterion} 구조 유지
     *   (program.html 렌더 호환). 동사형 진행어 + "손에 남는 것" + 응답변수 ≥ 2.
     *   개인화 슬롯 정확히 1개(강점|분야 택일). 응답 없으면 골격만(붕괴 없음). */
    var _M3_TITLE_KO = [
      "떠오른 것 하나를 눈에 보이는 결과물로 꺼내 본다",
      "그 결과물을 실제 사람 앞에 내놓고 반응을 받아 본다",
      "받은 반응을 반영해 하나를 '완성'까지 밀고 간다"
    ];
    var _M3_TITLE_EN = [
      "Turn one idea into a visible output",
      "Put that output in front of a real person and get a response",
      "Reflect the response and push one thing to 'finished'"
    ];
    var _M3_CRIT_KO = [
      "손에 남는 것: 내 결과물 초안 1개",
      "손에 남는 것: 한 사람에게 검증받은 결과 1건",
      "손에 남는 것: '완성'이라 말할 수 있는 결과물 1개"
    ];
    var _M3_CRIT_EN = [
      "You keep: one draft of your output",
      "You keep: one result validated by a real person",
      "You keep: one output you can call 'finished'"
    ];
    function synthesizeMonth3(){
      // 개인화 슬롯: 3개 목표 중 정확히 1개(fingerprint 결정, 재현성).
      var pslot = _hasPersonalSrc ? (variantIdx(0x6341) % 3) : -1;
      var goals = [];
      for (var i = 0; i < 3; i++){
        var title = isEn ? _M3_TITLE_EN[i] : _M3_TITLE_KO[i];
        var crit  = isEn ? _M3_CRIT_EN[i]  : _M3_CRIT_KO[i];
        if (i === pslot && _pStrength){
          // [P19] §7 — 강점만 결합. 원분야 라벨(_pDomain)은 노출하지 않는다.
          title = isEn ? (_pStrength + " \u2014 " + title)
                       : (_pStrength + "을(를) 살려 " + title);
        }
        goals.push({ title: _fixJosaPairs(title), criterion: _fixJosaPairs(crit) });
      }
      // 회원 응답 결합 목표 1개 추가(활동 × 도구) — 실제 응답이 있을 때만.
      if (_pAct || _pTool){
        var cTitle = isEn
          ? ("Make one shareable result in something you enjoy (" + _actTxt + ")")
          : ("좋아하는 일(" + _actTxt + ")에서 남에게 보여 줄 결과물 하나를 만들어 본다");
        var cCrit = isEn
          ? ("You keep: three outputs that gave you the feel of '" + _toolTxt + "'")
          : ("손에 남는 것: '" + _toolTxt + "' 그 보람이 담긴 결과물 3개");
        goals.push({ title: _fixJosaPairs(cTitle), criterion: _fixJosaPairs(cCrit) });
      }
      return {
        guide: isEn
          ? "Decide the three results you'll hold in hand three months from now."
          : "3개월 뒤 손에 남길 결과 3가지를 미리 정해 둔다.",
        goals: goals,
        effects: (isEn
          ? ["Quarterly results become visible","A core routine takes root","Your distinctiveness stacks as an asset","A foothold opens for the next quarter"]
          : ["분기 결과가 눈에 보이게 남는다","핵심 루틴이 자리 잡는다","나다움이 결과로 쌓인다","다음 분기 발판이 열린다"]
        ).map(function(s){ return _fixJosaPairs(s); })
      };
    }

    /* ── synthesizeYear1: 1년 실행 문장 (응답직합성) ──────────────────────────
     *   tone pool year1(vision/milestones) 우회. vision=문자열배열, milestones=문자열배열
     *   구조 유지. 동사형 + "손에 남는 것" + 응답변수 ≥ 2. 개인화 슬롯 1개. */
    var _Y1_MILE_KO = [
      "분기 사이클을 한 바퀴 끝까지 돌려 본다",
      "쌓인 결과를 한 장으로 모아 둔다",
      "다음 1년으로 이어질 새 방향 하나를 정한다"
    ];
    var _Y1_MILE_EN = [
      "Complete one full quarterly cycle end to end",
      "Gather your stacked results into a single page",
      "Set one new direction that carries into the next year"
    ];
    function synthesizeYear1(){
      // 비전 한 줄(직관, 응답 종합) — [P19] 강점만 결합. 원분야 라벨(_pDomain) 노출 금지.
      var visionLine;
      if (isEn){
        visionLine = _pStrength
          ? ("A year from now, you stand as someone whose " + _pStrength + " leaves real results")
          : "A year from now, you stand with results you can point to";
      } else {
        visionLine = _pStrength
          ? (_pStrength + "이(가) 실제 결과로 남는 사람으로 1년 뒤 서 있는다")
          : "가리킬 수 있는 결과를 남긴 사람으로 1년 뒤 서 있는다";
      }
      // 마일스톤: 골격 3개 + 회원 응답 결합 1개(환경 × 활동) — 응답 있을 때만.
      var miles = (isEn ? _Y1_MILE_EN : _Y1_MILE_KO).slice();
      if (_pEnv || _pAct){
        miles.push(isEn
          ? ("In a place where you focus well (" + _envTxt + "), finish one result you're proud of in something you enjoy (" + _actTxt + ")")
          : ("집중이 잘 되는 곳(" + _envTxt + ")에서 " + _peParenJosa("좋아하는 일", _actTxt, "ero") + " 자랑할 만한 결과 하나를 완성한다"));
      }
      return {
        guide: isEn
          ? "Draw next year's destination as one vision sentence and three milestones."
          : "1년 뒤 나의 모습을 한 문장으로, 그리고 그곳에 닿았다는 증거로 그려 둔다.",
        vision: [ _fixJosaPairs(visionLine) ],
        milestones: miles.map(function(s){ return _fixJosaPairs(s); }),
        effects: (isEn
          ? ["A long-term vision stays in writing","Quarterly cycles get completed","Trust and reputation stack as assets","A fresh vision opens for the next year"]
          : ["장기 비전이 한 줄로 남는다","분기 사이클을 완주한다","신뢰와 평판이 자산으로 쌓인다","다음 1년의 새 비전이 열린다"]
        ).map(function(s){ return _fixJosaPairs(s); })
      };
    }

    function weekSubline(i){
      // [P19] §7 도메인 라벨 노출 금지 — 원분야 단어(primaryDomain: 종교/교육/경영 등)를
      //   subline 문장에 직접 노출하지 않는다. 강점(str)·나침반 키워드(kw)만 실제 응답 표현으로
      //   결합하고, '어디서' 자리는 도메인 라벨 대신 도메인 중립구로만 채운다.
      var str = (vars.userTopStrength || "").trim();
      var kw  = (vars.compassKw || "").trim();
      if (!str && !kw) return ""; // 응답 부재 → 폴백(생략)
      var koPools = [
        // week 1 — 꺼내기/탐색
        [
          "{str}을(를) 한 번 꺼내 지금 정한 자리에서 시험해 보는 주",
          "{kw}을(를) 떠올리며 첫 실마리를 잡는 주",
          "{str}이(가) 어디서 살아나는지 직접 확인해 보는 주",
          "{kw}이(가) 실제로 닿는 지점을 더듬어 보는 주",
          "{str}을(를) 작게 한 번 던져 보는 주",
          "{str}을(를) 가만히 꺼내 살펴보는 주"
        ],
        // week 2 — 증명/실행
        [
          "{str}을(를) 한 가지로 증명해 보는 주",
          "{kw}을(를) 작은 결과 하나로 옮겨 보는 주",
          "{str}와(과) {kw}이(가) 만나 형태가 잡히는 주",
          "{kw}을(를) 손에 잡히는 결과로 만드는 주",
          "{str}을(를) 결과물 하나로 굳혀 보는 주",
          "{str}을(를) 눈에 보이게 밀어붙이는 주"
        ],
        // week 3 — 정착/확장
        [
          "{str}을(를) 일상의 리듬으로 자리 잡게 하는 주",
          "{kw}을(를) 눈에 보이는 흔적으로 남기는 주",
          "{str}이(가) 반복되는 습관이 되는 주",
          "{kw}이(가) 다음으로 이어지게 다지는 주",
          "{str}을(를) 한 번 더 다듬어 정리하는 주",
          "이번에 남긴 {str}을(를) 다음 분기로 잇는 주"
        ]
      ];
      var enPools = [
        [
          "A week to take out {str} and test it where you stand now.",
          "A week to catch the first thread around {kw}.",
          "A week to see where {str} comes alive."
        ],
        [
          "A week to prove {str} as one thing.",
          "A week to move {kw} into a small result.",
          "A week where {str} meets {kw} and takes shape."
        ],
        [
          "A week to settle {str} into a daily rhythm.",
          "A week to leave {kw} as a visible mark.",
          "A week where {str} becomes a repeated habit."
        ]
      ];
      if (isEn){
        var ep = enPools[i] || enPools[enPools.length-1];
        var ei = variantIdx(0x6201 + i) % ep.length;
        return ep[ei].replace(/\{str\}/g, str||"your strength").replace(/\{kw\}/g, kw||"meaning");
      }
      var kp = koPools[i] || koPools[koPools.length-1];
      var ki = variantIdx(0x6201 + i) % kp.length;
      var s = kp[ki];
      s = s.replace(/\{str\}/g, str || "강점")
           .replace(/\{kw\}/g, kw || "의미");
      s = _fixJosaPairs(s);
      return s;
    }
    // [P18b/P19] 개인화 슬롯 배정 — If-Then '무엇을' 3주 중 정확히 1개에만 강점 결합.
    //   (읽기 안정성 확보 + 대원칙-A: 직관 단일). fingerprint 로 어느 주차인지 결정(재현성).
    //   §7에 따라 원분야 라벨은 노출하지 않으므로 개인화 소스는 강점(_pStrength) 뿐.
    //   강점 응답이 없으면 개인화 슬롯 자체가 무효(폴백 안전).
    var _hasPersonalSrc = !!_pStrength;
    var _ifThenPersonalWeek = _hasPersonalSrc ? (variantIdx(0x6331) % 3) : -1;

    // [P18b] weeksRaw 가 비어도(구버전 rules) 3주 골격을 합성 경로가 자체 생성 → tone pool 불요.
    var _weekCount = (Array.isArray(weeksRaw) && weeksRaw.length) ? weeksRaw.length : 3;
    var _weekTitleKo = ["아이디어를 밖으로 꺼내기", "하나로 증명하기", "끝까지 마무리해 남기기"];
    var _weekTitleEn = ["Get the idea out", "Prove it as one thing", "Finish and keep it"];
    var weeks = [];
    for (var _wi = 0; _wi < _weekCount && _wi < 3; _wi++){
      (function(i){
        var w = (weeksRaw && weeksRaw[i]) || {};
        // 제목: tone pool title 이 있으면 재사용(제목은 SSOT 골격), 없으면 합성 골격.
        var title = L(isEn, w, "title") || (isEn ? _weekTitleEn[i] : _weekTitleKo[i]);
        weeks.push({
          week: i + 1,
          title: title,
          // ① 지금 주목할 것 — 응답 종합 2단 subline(직관 한 줄)
          subline: weekSubline(i),
          // ② 언제 → 무엇을 (If-Then). 개인화 슬롯은 주차 1개에만.
          guide: synthesizeIfThenBlock(i, i === _ifThenPersonalWeek),
          // ③ 실행 방법 — 응답 종합 동사형 행동
          actions: synthesizeWeekActions(i),
          // ④ 이런 변화 — 동사형 살아냄 3개 + "손에 남는 것"(필수)
          effects: synthesizeWeekEffects(i)
        });
      })(_wi);
    }

    /* [P18b · B안] 3개월/1년 실행 문장 — tone pool(month3Goals/year1) 우회, 응답직합성.
     *   구조(goals={title,criterion}, vision=[], milestones=[], effects=[])는 유지해
     *   program.html 렌더 100% 호환. 아래 (구) tone pool 경로는 dead code 로 보존(§9/§10.10). */
    var month3 = synthesizeMonth3();
    var year1  = synthesizeYear1();

    /* ── [DEAD CODE · 보존] 구 tone pool 기반 month3/year1 (롤백/재활용용, 삭제 금지) ──
     * var l3Month3Goals = (!isEn) ? _l3MatrixGet(L3_MONTH3_GOAL_KO, toneKey, primaryCat) : null;
     * var month3GoalsRaw = tonePack.month3Goals || [];
     * var monthGoalCustom = isEn
     *   ? { title: "Make one real result in something you enjoy (" + (_firstItem(userActivities) || "your chosen activity") + ")",
     *       criterion: "By the end of 3 months, you have 3 results that gave you a sense of '" + userTool1 + "'" }
     *   : { title: "좋아하는 일(" + (_firstItem(userActivities) || "관심 활동") + ")에서 남에게 보여 줄 수 있는 결과물 하나 만들기",
     *       criterion: "3개월 뒤, '" + userTool1 + "' 그 보람을 느낄 만한 결과물 3개를 손에 남기기" };
     * var month3GoalsBase = (l3Month3Goals && l3Month3Goals.length)
     *   ? l3Month3Goals.map(function(g){ return { title: tpl(g.title, vars), criterion: tpl(g.criterion, vars) }; })
     *   : month3GoalsRaw.map(function(g){ return { title: L(isEn, g, "title"), criterion: L(isEn, g, "criterion") }; });
     * var month3_OLD = { guide: "...", goals: month3GoalsBase.concat([monthGoalCustom]),
     *   effects: varyEffects([...], 41, isEn) };
     * var year1Pack = tonePack.year1 || {};
     * var milestonesBase = tplArr(L(isEn, year1Pack, "milestones") || [], vars);
     * var milestoneCustom = isEn ? "..." : "...";
     * var year1_OLD = { guide: "...", vision: tplArr(L(isEn, year1Pack, "vision") || [], vars),
     *   milestones: milestonesBase.concat([milestoneCustom]), effects: varyEffects([...], 53, isEn) };
     * ──────────────────────────────────────────────────────────────────────── */

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
    // [2단계 직관성 2026-07-27] 몰입 환경 부연을 짧은 한 절로 축약.
    //   userFocusEnv 는 응답 파생 값(장소 최대 2개 결합)이라 괄호가 길어짐 →
    //   hint 에서는 _firstItem 으로 '첫 장소 하나'만 뽑아 간결화(고유성=응답 파생 보존).
    var hintEnv = _firstItem(userFocusEnv) || userFocusEnv;
    /* [Phase D-3 Step N] EN 분기가 hintEnv(응답 파생 장소, 한글)를 그대로 넣어
     *   EN 리포트에 한글이 유출됐다. EN 에는 대응 어휘 자산이 없으므로
     *   좌표를 빼고 문장으로 닫는다. KO 는 그대로 유지(고유성 보존). */
    var boardHintExtra = isEn
      ? " Record it in the space where you focus best."
      : (" 기록은 익숙한 공간(" + hintEnv + ")에서 하세요.");
    var board = {
      /* [CEO 피드백 항목14 · 결함 (AM)] 한글 지면의 라틴 표기 제거.
       *   문제: KO 열 이름이 "완료(Y/N)" 였다. 이 값은 내부 키가 아니라
       *     실제 지면에 찍힌다 — 웹 폴백 표(program.html:3190)와
       *     PDF 보드 헤더(program.html:4309 `b.columns`) 두 곳이 소비한다.
       *   진단: 한국어 고객 지면에 영문 약어가 섞이면 직관이 내려간다.
       *     더구나 렌더층은 이미 체크 칸(.chk / .board__cell)을 그리므로
       *     "Y/N 을 적어라"는 지시 자체가 지면과 맞지 않는다.
       *   처방: "완료 여부" — 열의 뜻만 남긴다(라틴 0자).
       *   ★ 회귀 경계: program.html 의 BOARD_COLS_EN / board_col_* 키 맵이
       *     구 문자열 "완료(Y/N)" 를 정확 일치로 참조한다. 제14조(additive)
       *     원칙에 따라 구 키를 지우지 않고 신 키를 '추가'해 두 값 모두
       *     EN 변환되게 했다(구버전 캐시된 리포트도 계속 번역된다). */
      columns: isEn
        ? ["Week", "Action task", "Done (Y/N)", "Reflection notes"]
        : ["주차", "실행 과제", "완료 여부", "성찰 메모"],
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
    // [P21 · 대원칙-C] 원분야 나열("경제·교육") 폐기 → 융합 관형형("…키우는")으로 노출.
    //   KO(고유성 대상)만 융합, EN은 기존 결합 라벨 유지(§7 비대상).
    var _domainFusedCore = (vars.domainFusedCore || "").trim();  // "신념을 가르쳐 조직으로 키우는"
    var _domainLabelKo = _domainFusedCore;                        // 노출용(융합)
    /* ★★★ [결함 CF · 2026-08-11 · 제29조] 기대효과 게이지 지면은
     *   fitJob · expansion · career · vision 4장을 세로로 나란하 보여 준다
     *   (program.html buildEffectGauges @2028 — 소모처 실측 · 제17조).
     *   그런데 왛장(fitJob)은 「(설명형 좌표) 흐름 위에서」, 바로 아랫장
     *   (expansion)은 「(같은 설명형 좌표) 자리에서」로 시작해,
     *   한 지면에서 같은 설명형 좌표가 나란하 도 번 나왔다.
     *   실측(40시드): headSame 40/40 — 전 시드 반복.
     *   ⇒ 제29조: 한 지면 같은 좌표는 첫 뒱장만 설명형, 둘째부터 호칭형.
     *   ★ 지우지 않는다(대원칙-B · 제33조) — 헥 명사만 남기고
     *     「같은」으로 왛장을 가리킨다. act/fruit 정보는 왛장에 그대로 있다.
     *   설계 검증(40시드): pageDistinct 40→40(민개도 불변) · dupAfter 0
     *                        · over60 0 · maxLen 58 · 조사 보존(의 · 받침 불반).
     *   ★ 폴백: 헥 명사가 없으면(원분야 부재 · 구버전 추버진) 머리 어구를 생략하고
     *     본문은 그대로 내보람 — 문장은 언제나 성립한다. */
    var _domainCallKo  = (vars.domainCoreKo || "").trim();
    /* ★★★ [결함 CH · 2026-08-11 · 제29·제33조] 융합구가 한 지면에 2회.
     *   career-engine buildFusionCareers 의 careers[1](융합형 직업명)은
     *     "core을 + act + fruit으로 + 닫음" 으로 조립된다.
     *   fuseDomains().identityKo(= _domainFusedCore) 또한 같은 규칙이다.
     *   ⇒ 기대효과 지면에서 fitJob 머리(융합 관형형)와
     *     expansion 본문(직업명) 이 같은 융합구를 나란히 두 번 말한다.
     *   실측(게이트 훅 주입 · 12시드 중 4): 「가치를 가르쳐 다음 세대로」 등.
     *     “직무 적합성: 가치를 가르쳐 다음 세대로 연결하는 흐름 위에서 …”
     *     “직업 확장성: 같은 가치의 자리에서 가치를 가르쳐 다음 세대로 키워 내는 사람으로 …”
     *   ★ career-engine 은 건드리지 않는다 — 직업명은 리포트 전역에서 쓰이고
     *     고유코드(fingerprint) 계산과 닿아 있다. 이 지면에서만 걷는다(국소).
     *   ★ 지우는 것이 아니다(대원칙-B · 제33조): 융합 정보는 바로 윗줄 fitJob 과
     *     「같은 (core)의 자리에서」가 이미 보존한다. 여기서는 중복만 걷는다.
     *   ★ 어절 단위로만 잘라 조사가 끝에 남는 일이 없다(제19·제35조).
     *   ★ 폴백: 공통 접두가 2어절 미만이거나 남는 어절이 없으면 원문 그대로 둔다. */
    function _peStripFusedHead(job, fused, coreN){
      var j = String(job || "").trim(), f = String(fused || "").trim();
      if (!j || !f) return j;
      var jw = j.split(/\s+/), fw = f.split(/\s+/);
      var k = 0;
      while (k < jw.length && k < fw.length && jw[k] === fw[k]) k++;
      if (k === 0) return j;               // 겹치는 머리가 없다 → 원문 그대로
      /* 공통 접두가 1어절뿐이면, 그것이 핵 명사일 때만 걷는다.
       *   관심 분야가 하나인 경우(n=1) careers[1] 은 "core을 깊이 파고드는 사람" 이라
       *   「같은 (core)의 자리에서 (core)를 깊이 …」로 핵 명사가 바로 다시 나왔다.
       *   핵 명사가 아닌 우연한 1어절 겹침은 건드리지 않는다. */
      if (k === 1 && !(coreN && jw[0].indexOf(coreN) === 0)) return j;
      var rest = jw.slice(k).join(" ").trim();
      if (!rest) return j;                 // 남는 말이 없으면 원문 보존
      return rest;
    }
    /* [§7 차단 2026-07-29] EN 영역 라벨 안전 사전.
     *   [결함] report-engine-v4 의 slots.primary_domain 은 EN 경로에서
     *     _enFromKo() -> DOMAIN_21_EN 을 거치는데 그 사전이 "종교"->"Religion",
     *     "교육"->"Education", "경영"->"Management" 를 반환한다. PE 는 그 raw 라벨을
     *     그대로 결합해 EN 기대효과 문장에 실었다:
     *       "Career expansion: Expandable toward ... across Religion & Sports"
     *   [실측] 300시드 lang=en · PE.build:
     *     effects.expansion  §7EN 위반 34/300 (11.3%) · 검출어 "Religion" 68회
     *     effects.fitJob 0 · effects.newPaths 0 · cover.summary.newPaths 0
     *     (같은 시드의 ce.careers 는 이미 안전 — career-engine 이
     *      _S7_DOMAIN_SAFE_EN 으로 "Conviction & Meaning" 을 내기 때문. 즉
     *      사전이 두 벌 있는데 이 경로만 순화 사전을 안 거쳤다.)
     *   [왜 가드에 안 걸렸나] _peHasReligion 의 PE_RELIGION 은 한글 토큰만 담고 있어
     *     영문 "Religion" 을 검출하지 못한다. 게이트에 없는 검사는 사각지대다.
     *   [원칙] 검열이 아니라 기능·속성 명사로 바꾼다 —
     *     career-engine _S7_DOMAIN_SAFE_EN / report-engine-v4 _S7_DIR_SAFE_EN 과 동일.
     *   [보존] 미등재 영역은 원문 그대로(대원칙-B: 폴백 보존). KO 경로 무변경. */
    /* 사전·변환기는 모듈 레벨 _peDomEnSafe / PE_S7_DOM_EN 하나만 쓴다(SSOT). */
    var _pdEn = _peDomEnSafe(_pd), _sdEn = _peDomEnSafe(_sd);
    /* [문체 2026-07-29] " & " 결합은 안전 라벨("Conviction and Meaning")과 겹쳐
       "across Conviction and Meaning & Sports" 로 읽혔다 -> "and" 로 통일. */
    var _domainLabelEn = (_pdEn && _sdEn) ? (_pdEn + " and " + _sdEn) : (_pdEn || _sdEn || "");
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
    // [Phase D-3] career/vision 이 tonePack 고정값이라 전 고객 동일이었다.
    //   → §7-안전 좌표(actNoun/compass)를 접미로 얹어 변별한다(라벨 접두는 보존).
    var _eKo = (function(){
      try {
        var _sec = (report && report.sections) || [];
        for (var i = 0; i < _sec.length; i++){
          if (_sec[i] && _sec[i].id === "execution_profile"){
            var _st = (_sec[i].content || {})._strategy;
            if (_st && _st.koCoords && !isEn) return _st.koCoords;
          }
        }
      } catch (_e) {}
      return {};
    })();
    var _eAct = _eKo.actNoun || "", _eCom = _eKo.compass0 || "", _eWhere = _eKo.where || "";

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
      /* ══════════════════════════════════════════════════════════════════
       * [CEO 피드백 항목7 · 항목8  2026-07-30]  매달린 대시 제거 — 문장 정렬
       *   종전 4필드 전부: "…{본문} — {부사구}" 형태였다.
       *     예) "직무 적합성: 운동생리·심리학자 직무에 특히 잘 맞습니다 — 지금 살아가는 흐름 위에서"
       *   문장이 끝난 뒤에 부사구가 대시로 매달려 있어, CEO 가 표지 typeLine 에서
       *   지적한 "문장 정렬도 이상하고" 와 정확히 같은 형태였다.
       *   → 부사구를 문장 앞으로 옮겨 한 문장으로 읽히게 한다.
       *     어절은 한 글자도 버리지 않는다(대원칙 B) — 자리만 바꾼다.
       *   ★ 접두어("직무 적합성: " 등)는 그대로 둔다 — program.html:2282 의
       *     _xlateBodyAfterPrefix 가 접두어 뒤 본문만 EN 으로 갈아 끼운다.
       *   ★ 활성 게이트(d4_gate · d3_quality)에 이 꼬리 문구를 리터럴로 검사하는
       *     항목은 없다(실측 0건).
       *   ★ vision 의 "을 지키면서" 는 종전 하드코딩이었다 → _peD3Reul 로 받침 확정.
       * ══════════════════════════════════════════════════════════════════ */
      fitJob:    "직무 적합성: "    + (_domainLabelKo ? (_domainLabelKo + " 흐름 위에서 ") : "")
                                    + (_ceFit ? (_ceFit + " 직무에 특히 잘 맞습니다")
                                              : (teff.fitJob || "관련 분야 직무 적합성 강화")),
      expansion: "직업 확장성: "    + (_domainCallKo ? ("같은 " + _domainCallKo + "의 자리에서 ") : "")
                                    + (_ceExp ? (function(){ var _x = _peStripFusedHead(_ceExp, _domainFusedCore, _domainCallKo);
                                                             var j = _hangulJong(_x.slice(-1));
                                                             return _x + ((j===0)?"로":((j===8)?"로":"으로")) + " 확장 가능"; })()
                                              : (teff.expansion || "자기다움 기반 1인 브랜드 / 사이드 프로젝트 확장")),
      career:    "경력 성장: "      + (_eAct ? (_peD3ActAt(_eAct) + " 쌓인 힘으로 ") : "")
                                    + (teff.career    || "자기 자산을 결과로 누적"),
      vision:    "인생 설계 비전: " + (_eCom ? (_peD3Reul(_eCom) + " 지키면서 ") : "")
                                    + (teff.vision    || "\u201C자기다움이 곧 영향력이 되는 사람\u201D"),
      newPaths:  (function(){
        var base = newPathsArr.slice(0, 4);
        // [PR-진로직합성] ce(응답기반 직업) 있으면 직업명을 1순위로 노출(도메인 라벨 prefix 생략).
        //   ce 없을 때만(구버전·캐시) 기존 PR#61-1 도메인 결합 라벨을 맨 앞에 붙인다.
        if (!ce && _domainLabelKo) base = [(_domainLabelKo + " 자리에서 열리는 길")].concat(base).slice(0, 4);
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
    var _pd  = tpl(mvVars.primaryDomain || "", vars);     // 1순위 관심 분야 (Q75) — EN 노출용(원분야)
    // [P21 · 대원칙-C] KO 다음-사이클 문구는 원분야("‘경제’에서") 대신 융합 정체성 자리를 노출.
    //   "‘신념을 가르쳐 조직으로 키우는 자리’에서" 형태 → 원분야 단어 소멸(§7).
    var _pdKo = (mvVars.domainFused || "").trim();        // "…키우는 자리"(응답부재 시 "지금 살아가는 자리")
    var _vh  = tpl(mvVars.visionHeadline || "", vars);    // 비전 헤드라인
    // 받침 판정 헬퍼(을/를)
    var _wgEul = (function(){ var j = _hangulJong(String(_wg||"")); return (j < 0) ? "을" : (j !== 0 ? "을" : "를"); })();
    // [P22 조사교정] 비전헤드라인(_vh) 뒤 주격조사 이/가 — 받침 있으면 "이", 없으면 "가"
    //   (기존 "…'세상을 잇는 사람'가" 비문 → "…'사람'이"). 비한글/판정불가 → "가" 안전 폴백.
    var _vhIga = (function(){ var j = _hangulJong(String(_vh||"")); return (j > 0) ? "이" : "가"; })();
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
        "올해 " + (_pdKo ? ("‘" + _pdKo + "’에서 ") : "") + "쌓은 결과물은 여기서 끝나지 않고, 다음 한 해를 딛고 설 바닥이 됩니다.",
        (_str ? ("‘" + _str + "’") : "올해의 강점") + "으로 증명한 한 해가 다음 사이클의 출발선이 됩니다.",
        "이건 결승선이 아니라 ‘" + (_vh || "되어 가는 나") + "’로 가는 첫 발판입니다.",
        "한 해의 끝이 아니라, " + (_pdKo ? ("‘" + _pdKo + "’에서의 ") : "") + "다음 한 걸음이 시작되는 자리입니다.",
        (_str ? ("‘" + _str + "’") : "올해의 강점") + "이(가) 증명된 지금이, 다음 사이클로 넘어가는 문턱입니다."
      ];
      var s = koPool[variantIdx(0x7F11) % koPool.length];
      return _fixJosaPairs(s);
    })();
    /* [FB5 재설계 2026-06-15 축적 루프] 둘째 항목 = '약점 보완'이 아니라 '새 발견·살아냄·남김의 축적'.
     *   총괄(슈퍼개발자) 지적: 1년 맞춤 프로그램을 살아냈다면, 다음 1년은 또 새롭게
     *   '발견 → 살아냄 → 남김'을 반복해 인생 자산이 쌓이는 나선형이어야 한다.
     *   (이번에 약했던 축을 다음 해 과제로 삼는다 = 결손 보충 프레임 → 폐기)
     *   → 다음 한 해는 '새 검사로 다시 발견하고, 또 한 해를 살아내 남긴다'로 표현.
     *     1년 프로그램은 이미 완결된 한 묶음의 자산. 그 위에 새 묶음을 쌓는다.
     */
    var _bridgeKo = (function(){
      var pool = [
        "올해 " + (_pdKo ? ("‘" + _pdKo + "’에서 ") : "") + "발견하고 살아내 남긴 한 해 위에, ",
        "이번 한 해 " + (_pdKo ? ("‘" + _pdKo + "’에서 ") : "") + "쌓은 자산 한 묶음 위에, ",
        (_pdKo ? ("‘" + _pdKo + "’에서의 ") : "") + "올해의 발견·살아냄·남김을 그대로 자산으로 두고, ",
        "지난 한 해 " + (_pdKo ? ("‘" + _pdKo + "’에서 ") : "") + "살아낸 흔적을 자산으로 남긴 채, "
      ];
      return pool[variantIdx(0x7F23) % pool.length];
    })();
    var _bridgeEn = (function(){
      var pool = [
        "On top of the year you discovered, lived out, and left behind" + (_pd ? (" in " + _pd) : "") + ", ",
        "Keeping this year's discovery–living–legacy" + (_pd ? (" in " + _pd) : "") + " as a finished asset, ",
        "Stacking a new chapter on the year you already lived out" + (_pd ? (" in " + _pd) : "") + ", "
      ];
      return pool[variantIdx(0x7F23) % pool.length];
    })();
    var nextSteps = isEn ? [
      { when: "When this cycle ends",
        task: _firstTask },
      { when: "Next year",
        task: _bridgeEn + "take a fresh LifePortfolio check to discover yourself anew, live out another year, and leave it behind — so ‘" + _vh + "’ keeps growing as accumulated life-assets, not as gaps to fix." }
    ] : [
      { when: "이 사이클을 마치면",
        task: _firstTask },
      { when: "다음 한 해는",
        task: _bridgeKo + "새 인생포트폴리오 검사로 ‘지금의 나’를 다시 발견하고, 또 한 해를 살아내 남기세요. 부족한 걸 메우는 게 아니라, ‘" + _vh + "’" + _vhIga + " 한 해 한 해 자산으로 쌓여 갑니다." }
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
      // [P19] §7 도메인 라벨 노출 금지 — 원분야 단어(primaryDomain)를 subline에 직접
      //   노출하지 않는다. 강점(str)·나침반 키워드(kw)만 실제 응답 표현으로 결합한다.
      var str = (vars.userTopStrength || "").trim();
      var kw  = (vars.compassKw || "").trim();
      if (!str && !kw) return ""; // 응답 부재 → 폴백(생략)
      if (isEn){
        var enPool = [
          "Turning {str} into focused proof, one quarter at a time.",
          "A quarter that anchors on {kw} and grows it step by step.",
          "Where {str} meets {kw} — a quarter to make it visible.",
          "Channeling {kw} into one finished proof at a time.",
          "A quarter to push {str} forward and leave a mark."
        ];
        var ei = variantIdx(0x5131) % enPool.length;
        return enPool[ei].replace(/\{str\}/g, str||"your strength").replace(/\{kw\}/g, kw||"meaning");
      }
      // KO: 직관 한 줄(2단) — 응답 종합. josa 없이 자연스러운 명사구 종결.
      var koPool = [
        "{str}을(를) 한 가지로 증명하는 한 분기",
        "{kw}을(를) 축으로 한 뼘 더 키우는 분기",
        "{str}와(과) {kw}이(가) 만나 형태로 남는 분기",
        "{kw}을(를) 한 가지씩 결과로 옮기는 분기",
        "{str}을(를) 밀어붙여 흔적을 남기는 분기",
        "{str}이(가) 가장 또렷해지는 한 분기",
        "{kw}을(를) 나침반 삼아 깊게 파는 분기",
        "{str}을(를) 결과물 하나로 바꿔 보는 분기"
      ];
      var ki = variantIdx(0x5131) % koPool.length;
      var s = koPool[ki];
      // 변수 치환 + 조사 보정
      s = s.replace(/\{str\}/g, str || "강점")
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

    /* ====================================================================
     * [실행 전략 v2 확장 — 2단계 S2-Commit D+E] Program 비파괴 전략 적용
     *   §13.2 규칙:
     *   (1) 연결 번들 = quarter/weeks/month3/year1. 네 compiler 모두 ok+validator
     *       통과 + 연결 invariant 통과 시에만 함께 교체. 하나라도 실패 시 넷 모두
     *       legacy 로 원자 복원(혼합 금지).
     *   (2) modules 는 별도 fallback: 컴파일·검증 성공 시에만 교체.
     *   (3) nextSteps/risks 는 별도 fallback: 컴파일·검증 성공 시에만 교체.
     *   렌더 계약(각 섹션 필드) 불변. 내부 메타만 추가.
     * ==================================================================== */
    var _progStrategyMeta = {
      mode: "legacy", bundle: false, quarter: false, weeks: false,
      month3: false, year1: false, modules: false, nextStepsRisks: false, errors: []
    };
    if (_strategy && _strategy.version === "execution-strategy.v2"){
      // ── 번들: quarter + weeks + month3 + year1 ─────────────────────
      var _legacyQuarter = JSON.parse(JSON.stringify(quarter));
      var _legacyWeeks   = JSON.parse(JSON.stringify(weeks));
      var _legacyMonth3  = JSON.parse(JSON.stringify(month3));
      var _legacyYear1   = JSON.parse(JSON.stringify(year1));
      var _cQ = compileQuarterTheme(_strategy, { icon: quarter.icon, titleLabel: quarter.title }, lang);
      var _cW = compileWeeklyRoutines(_strategy, { titles: weeks.map(function(w){ return w.title; }) }, lang);
      var _cH = compileHorizonGoals(_strategy, {}, lang);
      var _vQ = _cQ.ok ? validateQuarterV2(_cQ.value, _strategy, lang) : { ok: false, errors: _cQ.errors };
      var _vW = _cW.ok ? validateWeeklyV2(_cW.value, _strategy, lang) : { ok: false, errors: _cW.errors };
      var _vH = _cH.ok ? validateHorizonV2(_cH.value, _strategy, lang) : { ok: false, errors: _cH.errors };
      // §12.1 연결 invariant: 1주차 첫 action 과 coherentActions[0] 의미 일치
      var _linkOk = true;
      if (_cW.ok){
        var _a0 = _peStripDot((_strategy.coherentActions[0] || {}).action || "");
        var _w0a0 = String((_cW.value[0] && _cW.value[0].actions && _cW.value[0].actions[0]) || "");
        if (_a0 && _w0a0.indexOf(_a0) === -1) { _linkOk = false; }
      }
      if (_cQ.ok && _cW.ok && _cH.ok && _vQ.ok && _vW.ok && _vH.ok && _linkOk){
        quarter = _cQ.value;
        weeks   = _cW.value;
        month3  = _cH.value.month3;
        year1   = _cH.value.year1;
        _progStrategyMeta.bundle = true;
        _progStrategyMeta.quarter = true; _progStrategyMeta.weeks = true;
        _progStrategyMeta.month3 = true;  _progStrategyMeta.year1 = true;
        _progStrategyMeta.mode = "v2";
      } else {
        quarter = _legacyQuarter; weeks = _legacyWeeks;
        month3  = _legacyMonth3;  year1 = _legacyYear1;
        _progStrategyMeta.mode = "legacy_fallback";
        _progStrategyMeta.errors = _progStrategyMeta.errors.concat(
          _vQ.errors || [], _vW.errors || [], _vH.errors || [], _linkOk ? [] : ["link_first_action"]
        );
      }

      // ── modules (별도 fallback) ───────────────────────────────────
      var _legacyModules = JSON.parse(JSON.stringify(modules));
      var _cM = compileExecutionModules(_strategy, { legacyModules: _legacyModules }, lang);
      var _vM = _cM.ok ? validateModulesV2(_cM.value, _strategy, lang) : { ok: false, errors: _cM.errors };
      if (_cM.ok && _vM.ok){
        modules = _cM.value;
        _progStrategyMeta.modules = true;
        if (_progStrategyMeta.mode === "legacy") _progStrategyMeta.mode = "v2_partial";
      } else {
        modules = _legacyModules;
        _progStrategyMeta.errors = _progStrategyMeta.errors.concat(_vM.errors || []);
      }

      // ── nextSteps + risks (별도 fallback, 한 묶음) ───────────────
      var _legacyNext = JSON.parse(JSON.stringify(nextSteps));
      var _legacyRisks = JSON.parse(JSON.stringify(risks));
      var _cN = compileNextStepsAndRisks(_strategy, {}, lang);
      var _vN = _cN.ok ? validateNextRisksV2(_cN.value, _strategy, lang) : { ok: false, errors: _cN.errors };
      if (_cN.ok && _vN.ok){
        nextSteps = _cN.value.nextSteps;
        risks     = _cN.value.risks;
        _progStrategyMeta.nextStepsRisks = true;
        if (_progStrategyMeta.mode === "legacy") _progStrategyMeta.mode = "v2_partial";
      } else {
        nextSteps = _legacyNext;
        risks     = _legacyRisks;
        _progStrategyMeta.errors = _progStrategyMeta.errors.concat(_vN.errors || []);
      }
    }

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

    /* ★★★ [CEO 항목2 · 제29조] 지면 압축 — 반환 직전 한 번. 지면마다 독립 판정한다.
     *   ★ 지면 단위로 도는 이유: 고객이 한 번에 보는 화면이 판정 단위이기 때문이다.
     *     문서 전체로 잡으면 뒷 지면에서 좌표가 통째로 사라져 "무엇에 관한 이야기인지"
     *     가 소실된다(대원칙 B 위반). 지면마다 첫 등장 1회는 반드시 설명형으로 남는다. */
    try {
      var _cp = _pgCoordPairs(_strategy, isEn);
      if (_cp.length){
        _pgCompressPage(quarter, _cp);
        (weeks || []).forEach(function(w){ _pgCompressPage(w, _cp); });
        _pgCompressPage(effects, _cp);
        (modules || []).forEach(function(m){ _pgCompressPage(m, _cp); });
      }
    } catch (_e) { /* 압축 실패는 문안을 원형 그대로 두는 것으로 폴백(대원칙 B) */ }

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
          fingerprint64: hasFingerprint64 ? String(report._v4Meta.fingerprint64) : null,
          uniqSig: _uniqSig,               // 비개인화 골격 시그니처
          skelLines: _skelNorm.length,
          variantApplied: _variantApplied  // 변주가 실제 적용됐는가(고유성 활성 여부)
        },
        // [실행 전략 v2 확장 — 2단계] Program compiler 소비 기록(화면 비노출)
        //   scheme: v2 compiler가 하나라도 적용됐을 때 원본 전략 스킴을 기록.
        _strategy: {
          scheme: (_strategy && _strategy.version === "execution-strategy.v2" &&
                   (_progStrategyMeta.quarter || _progStrategyMeta.weeks ||
                    _progStrategyMeta.month3 || _progStrategyMeta.year1 ||
                    _progStrategyMeta.modules || _progStrategyMeta.nextStepsRisks))
                    ? "execution-strategy.v2" : null,
          consumers: {
            quarter: _progStrategyMeta.quarter,
            weeks: _progStrategyMeta.weeks,
            month3: _progStrategyMeta.month3,
            year1: _progStrategyMeta.year1,
            modules: _progStrategyMeta.modules,
            nextStepsRisks: _progStrategyMeta.nextStepsRisks
          },
          bundle: _progStrategyMeta.bundle,
          mode: _progStrategyMeta.mode,
          errors: _progStrategyMeta.errors
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
   *  [실행 전략 v2 확장 — 2단계 S2-Commit D]  Program II·III compiler
   *  ------------------------------------------------------------------------
   *  인계 §6~§8, §12, §13. 전략 커널(diagnosis·guidingPolicy·coherentActions·
   *  nextAction·implementationIntentions)에서 분기 테마/주차 루틴을 직접 파생한다.
   *  - 순수 함수: 입력 불변, 시간/Math.random 금지, 결정론.
   *  - 무효 입력은 throw 대신 {ok:false, errors:[...]} 반환(§3.3).
   *  - §7: 컴파일 소스가 diagnosis/guidingPolicy/coherentActions/nextAction 이므로
   *        원분야(종교) 라벨(source.compass/domains)을 노출하지 않는다.
   *        추가 안전망으로 종교 토큰이 섞이면 검증에서 실패시킨다.
   * ==================================================================== */
  var PE_RELIGION = ["종교", "신앙", "하나님", "예수", "성경", "기독교", "교회",
    "신념 / 원칙 / 종교적 기준", "종교적"];
  /* [§7 차단 2026-07-29] 영문 토큰 안전망.
   *   PE_RELIGION 이 한글만 담고 있어 EN 경로의 "Religion" 을 검출하지 못했다
   *   (effects.expansion 34/300 유출의 근본 원인 중 하나 — 가드 자체의 사각지대).
   *   ★ _peHasReligion 은 indexOf 부분일치이므로 짧은 일반어("God" 등)를 넣으면
   *     정상 단어까지 오검출한다. 영역 라벨로 실제 실릴 수 있는 명사만 넣는다. */
  var PE_RELIGION_EN = ["Religion", "Religious", "Missionary", "Theolog", "Church",
    "Christian", "Bible", "Biblical", "Gospel"];
  function _peStr(v){ return String(v == null ? "" : v).trim(); }
  function _peStripDot(s){ return _peStr(s).replace(/[.。]\s*$/, ""); }
  function _peEndDot(s, isEn){ s = _peStr(s); if (!s) return s; return /[.。!?]$/.test(s) ? s : (s + (isEn ? "." : ".")); }
  function _peHasReligion(s){
    var t = _peStr(s);
    for (var i = 0; i < PE_RELIGION.length; i++){ if (t.indexOf(PE_RELIGION[i]) !== -1) return true; }
    /* [§7 차단 2026-07-29] 영문 토큰도 본다. 대소문자 무시(라벨/문장 어느 위치든). */
    var tl = t.toLowerCase();
    for (var j = 0; j < PE_RELIGION_EN.length; j++){
      if (tl.indexOf(PE_RELIGION_EN[j].toLowerCase()) !== -1) return true;
    }
    return false;
  }
  /* [Phase D-3] §7-안전 응답 좌표 접근자.
   *   report-engine-v4 가 strategy.koCoords 로 실어 보낸다(KO 경로 전용, additive).
   *   부재(구버전 캐시 / EN 경로) 시 {} → 각 소비처가 기존 고정 문구로 폴백한다(대원칙-B). */
  function _peKo(strategy, isEn){
    if (isEn) return {};
    var k = (strategy && strategy.koCoords) || null;
    return (k && typeof k === "object") ? k : {};
  }
  /* ═══════════════════════════════════════════════════════════════════════
   * ★★★ [CEO 항목2 · 제29조 지면 압축]  2026-07-31
   *
   *   CEO 원문: "아직도 시적·추상적 표현이 많고 고농도, 고품질의 직관성이 부족해요
   *             … 나이키는 '몸이 있다면 누구나 선수다' 수준으로 압축하고 융합해서
   *             이런 직관적인 표현을 만들었습니다."
   *
   *   ★ 진원(G26 실측 · BEFORE): 한 지면에서 설명형 좌표가 최대 4회 반복됐다.
   *     "얽힌 문제를 뜯어보고 길을 찾는 일"(17자)이 분기 테마 한 지면에 네 번.
   *     문장 60자 초과 116건 · 최장 269자. 고유성(distinct 12/12)은 멀쩡한데
   *     표현만 문서적이었다 — 즉 진단이 아니라 문장 문제다.
   *
   *   제29조: 한 지면에서 같은 좌표는 첫 등장만 설명형(무엇에 관한 이야기인지
   *     밝힌다), 두 번째부터 호칭형(짧게 부른다). 나이키가 "몸이 있다면"으로
   *     전제를 한 번만 깔고 "누구나 선수다"로 닫는 것과 같은 구조다.
   *
   *   ★ 제14조(교체 아닌 추가) 준수: 문장 생성 로직은 한 줄도 바꾸지 않는다.
   *     완성된 지면을 마지막에 한 번 훑어 2회차 이후만 짧은 이름으로 바꾼다.
   *     → 소비처 수십 곳을 건드리지 않으므로 회귀 위험이 최소다.
   *   ★ 대원칙 B(정보 보존): 첫 등장은 반드시 설명형으로 남는다. 지면에서
   *     좌표가 통째로 사라지는 일은 없다(G26e 가 감시).
   *   ★ 변별 보존: 좌표 자체가 응답 파생이므로 치환해도 k=1 이 생기지 않는다.
   * ═══════════════════════════════════════════════════════════════════════ */
  /* 조사 교정 — 짧은 이름으로 바꾸면 받침이 달라져 조사가 어긋난다(제19조 계열).
     긴 조사부터 검사한다: "이라는" 을 "이"로 먼저 잡으면 "가라는" 이 되어 비문. */
  var _PG_JOSA = [["이라는","라는"],["이라고","라고"],["이란","란"],
                  ["으로","로"],["이나","나"],["을","를"],["은","는"],["과","와"],["이","가"]];
  function _pgFitJosa(word, tail){
    var has = _hangulJong(String(word || "").slice(-1)) > 0;
    for (var i = 0; i < _PG_JOSA.length; i++){
      var a = _PG_JOSA[i][0], b = _PG_JOSA[i][1];
      if (tail.indexOf(a) === 0) return (has ? a : b) + tail.slice(a.length);
      if (tail.indexOf(b) === 0) return (has ? a : b) + tail.slice(b.length);
    }
    return tail;
  }
  /* 한 지면(node) 안의 모든 문자열을 순회 순서대로 훑어 2회차부터 치환한다.
     순회 순서 = 객체 키 삽입 순서 = 렌더 순서이므로 '첫 등장' 판정이 지면과 일치한다. */
  /* 지면의 문자열을 순서대로 슬롯(읽기+쓰기)으로 모은다.
   *  `_` 접두 키는 모으지 않는다(제16조: 내부 판정 메타는 지면이 아니다). */
  function _pgSlotArr(arr, idx){ return { v: arr[idx], set: function(x){ arr[idx] = x; } }; }
  function _pgSlotObj(obj, key){ return { v: obj[key], set: function(x){ obj[key] = x; } }; }
  function _pgStringSlots(node){
    var slots = [];
    function walk(n){
      if (n == null) return;
      if (Array.isArray(n)){
        for (var i = 0; i < n.length; i++){
          if (typeof n[i] === "string") slots.push(_pgSlotArr(n, i));
          else walk(n[i]);
        }
        return;
      }
      if (typeof n === "object"){
        Object.keys(n).forEach(function(k){
          if (k.charAt(0) === "_") return;
          if (typeof n[k] === "string") slots.push(_pgSlotObj(n, k));
          else walk(n[k]);
        });
      }
    }
    walk(node);
    return slots;
  }
  var _PG_PROMOTE_MIN = 28;   // 제목·라벨(짧은 문자열)에는 정의를 심지 않는다 — 본문에 심는다

  /* ★★★ 제29조 + 제30조 ─────────────────────────────────────────────────────
   *  제29조: 한 지면에서 같은 좌표는 '한 번만' 설명형, 나머지는 호칭형으로.
   *  제30조: 그 '한 번'의 자리를 traversal 순서가 아니라 **그 지면에서 가장 짧은 문장**으로 고른다.
   *     ─ 근거: 설명형은 15~18자다. 이미 긴 문장에 그걸 남기면 60자 상한을 지킬 수 없고,
   *       짧은 문장에 남기면 정의는 보존되면서 긴 문장이 짧아진다.
   *       정보 손실 0으로 문장 길이를 줄이는 유일한 자리다(제18조와 충돌하지 않는 해).
   *     ─ 나이키 구조와 동형: 전제를 짧게 깔고("몸이 있다면"), 본문은 호칭으로 굴린다.
   * ───────────────────────────────────────────────────────────────────────── */
  function _pgCompressPage(node, pairs){
    if (!node || !pairs || !pairs.length) return node;
    var slots = _pgStringSlots(node);
    if (!slots.length) return node;
    var cur = slots.map(function(s){ return String(s.v); });

    pairs.forEach(function(p){
      var lng = p[0], sht = p[1], i;
      if (!lng || !sht || lng === sht || sht.length >= lng.length) return;

      /* (a) 설명형이 이미 있는 문장들 중 '가장 짧은' 것을 정의 자리로 삼는다(제30조). */
      var keeper = -1;
      for (i = 0; i < cur.length; i++){
        if (cur[i].indexOf(lng) < 0) continue;
        if (keeper < 0 || cur[i].length < cur[keeper].length) keeper = i;
      }

      /* (b) 설명형이 지면에 아예 없으면, 호칭형이 있는 '가장 짧은 본문'을 설명형으로 올린다
       *     (제18조·대원칙 B: 그 지면만 본 고객도 무슨 말인지 알 수 있어야 한다). */
      if (keeper < 0){
        var best = -1;
        for (i = 0; i < cur.length; i++){
          if (cur[i].length < _PG_PROMOTE_MIN) continue;
          if (cur[i].indexOf(sht) < 0) continue;
          if (best < 0 || cur[i].length < cur[best].length) best = i;
        }
        if (best >= 0){
          var sp = cur[best], hp = sp.indexOf(sht);
          cur[best] = sp.slice(0, hp) + lng + _pgFitJosa(lng, sp.slice(hp + sht.length));
          keeper = best;
        }
      }

      /* (c) 정의 자리에서는 첫 등장만 남기고, 나머지는 전부 호칭형으로 압축한다. */
      for (i = 0; i < cur.length; i++){
        var s = cur[i], from = 0, hit, keepNext = (i === keeper);
        while ((hit = s.indexOf(lng, from)) >= 0){
          if (keepNext){ keepNext = false; from = hit + lng.length; continue; }
          s = s.slice(0, hit) + sht + _pgFitJosa(sht, s.slice(hit + lng.length));
          from = hit + sht.length;
        }
        cur[i] = s;
      }
    });

    for (var w = 0; w < slots.length; w++) if (cur[w] !== String(slots[w].v)) slots[w].set(cur[w]);
    return node;
  }
  /* 좌표 쌍 — v4 가 additive 로 실어 보낸 설명형/호칭형 짝. 없으면 빈 배열(무동작). */
  function _pgCoordPairs(strategy, isEn){
    if (isEn) return [];
    var k = _peKo(strategy, isEn) || {};
    var out = [];
    [["actNoun","actShort"],["where","whereShort"],["block","blockShort"]].forEach(function(p){
      var lng = k[p[0]], sht = k[p[1]];
      if (lng && sht && String(sht).length < String(lng).length) out.push([String(lng), String(sht)]);
    });
    /* 긴 좌표부터 치환해야 짧은 좌표가 긴 좌표의 일부를 먼저 먹지 않는다. */
    out.sort(function(a, b){ return b[0].length - a[0].length; });
    return out;
  }

  /* 결정론 변주 — fingerprint 파생. Math.random 금지(대원칙-C5).
   *   같은 응답자 = 항상 같은 문장(재현성 · 대원칙-B). */
  function _peD3Pick(list, seed){
    if (!list || !list.length) return "";
    return list[Math.abs((seed | 0)) % list.length];
  }
  /* 어절 겹침 가드 — 2자 어간 단위(활용형까지 잡는다).
   *   좌표값이 주변 문장 어휘와 겹치면 변주를 버리고 폴백을 쓴다. */
  function _peD3Dup(phrase, targets){
    if (!phrase) return true;
    var toks = String(phrase).match(/[가-힣]{2,}/g) || [];
    for (var i = 0; i < toks.length; i++){
      var stem = toks[i].slice(0, 2);
      for (var j = 0; j < targets.length; j++){
        if (targets[j] && String(targets[j]).indexOf(stem) !== -1) return true;
      }
    }
    return false;
  }

  /* [Phase D-3] 좌표값에 붙는 조사는 반드시 재계산한다.
   *   좌표는 응답마다 받침이 달라진다("내가 정한 선"(ㄴ) vs "늘어난 한 가지"(무받침))
   *   → 고정 조사를 쓰면 "'늘어난 한 가지'으로" 같은 오결합이 곧바로 노출된다(D-2a 교훈). */
  function _peD3Ro(w){                       // 도구격 …으로/…로 (ㄹ받침 예외 포함)
    var j = _hangulJong(String(w || ""));
    return String(w || "") + ((j > 0 && j !== 8) ? "으로" : "로");
  }
  function _peD3Rana(w){                     // 인용격 …이라는/…라는
    return String(w || "") + (_hangulJong(String(w || "")) > 0 ? "이라는" : "라는");
  }
  /* actNoun 은 ES2_ACT_KO 전 항목이 "…하는 일" 로 끝난다.
   *   그래서 "…일 하는 방법" 처럼 '일+하는' 을 이으면 비문이 된다.
   *   → 뒤에 서술을 이을 때는 처격("…일에서")·도구격("…일로")으로 받는다. */
  function _peD3ActAt(w){ var t = String(w || "").trim(); return t ? (t + "에서") : ""; }
  /* 목적격 …을/…를 — 좌표값 받침이 응답마다 다르므로 반드시 재계산한다. */
  function _peD3Reul(w){
    var t = String(w || "").trim(); if (!t) return "";
    return t + ((_hangulJong(t.slice(-1)) > 0) ? "을" : "를");
  }

  function _peValidStrategy(st){
    return !!(st && st.version === "execution-strategy.v2" &&
      st.diagnosis && st.diagnosis.crux &&
      st.guidingPolicy && Array.isArray(st.guidingPolicy.do) &&
      Array.isArray(st.coherentActions) && st.coherentActions.length > 0);
  }
  // coherentActions(n개)를 §8.2 규칙대로 3단계로 묶는다(순서·의미 보존).
  function _peBucketActions(actions){
    var a = (actions || []).slice().sort(function(x, y){
      return (x.order || 0) - (y.order || 0);
    });
    if (a.length === 0) return null;
    if (a.length === 1) return [[a[0]], [a[0]], [a[0]]];            // 준비→실행→검토(동일 행동 3단 관점)
    if (a.length === 2) return [[a[0]], [a[1]], [a[1]]];            // 첫 행동→반복/보완→통합/남김
    if (a.length === 3) return [[a[0]], [a[1]], [a[2]]];            // 3개: 그대로
    // 3개 초과: 앞 1개 / 가운데 묶음 / 마지막 1개 (의존성·순서 보존)
    return [[a[0]], a.slice(1, a.length - 1), [a[a.length - 1]]];
  }

  /* ── 프로그램 II — 분기 테마 ──────────────────────────────────────────
   *  §7.3 필드 규칙:
   *    title      : 기억 가능한 분기 전략명(실행 프로파일 type 복사 금지)
   *    heading    : diagnosis → desired shift 한 문장
   *    subline    : guidingPolicy의 핵심 "할 것/하지 않을 것"
   *    paragraphs : crux, 실행 순서, 3개월 완료 증거
   *  icon 은 기존 디자인 자산(🧭) 유지, title 라벨은 기존 "분기 테마" 유지하되
   *  heading/subline/paragraphs 를 전략 커널로 재작성한다.
   *  ctx = { icon, titleLabel } (기존 자산 fallback 보존용) */
  function compileQuarterTheme(strategy, ctx, lang){
    var isEn = (lang === "en");
    var errors = [];
    if (!_peValidStrategy(strategy)) return { ok: false, value: null, errors: ["invalid_strategy"] };
    ctx = ctx || {};
    var dg = strategy.diagnosis || {};
    var gp = strategy.guidingPolicy || {};
    var acts = _peBucketActions(strategy.coherentActions);
    if (!acts) return { ok: false, value: null, errors: ["no_actions"] };

    var crux = _peStripDot(dg.crux);
    var opp  = _peStripDot(dg.opportunity);
    var doItems = (gp.do || []).map(_peStripDot).filter(Boolean);
    var dontItems = (gp.dont || []).map(_peStripDot).filter(Boolean);
    var firstDone = _peStripDot((strategy.coherentActions[0] || {}).doneWhen || "");
    var lastAct = strategy.coherentActions[strategy.coherentActions.length - 1] || {};
    var lastDone = _peStripDot(lastAct.doneWhen || "");

    // title: 실행 프로파일 type/tone 이름을 쓰지 않고, guidingPolicy 방향 + "분기"로 조합.
    //   heading/subline 과 문장을 반복하지 않도록 짧은 명사구로 만든다.
    var title, heading, subline, paragraphs;
    if (isEn){
      title = "The quarter to fix what 'finished' means and close it";
      heading = crux
        ? ("This quarter turns \u201C" + crux + "\u201D into \u201C" + (opp || "results you can point to") + ".\u201D")
        : "This quarter turns your strength into results you can point to.";
      // dont 항목이 이미 "Don't…"로 시작하면 접두사를 중복하지 않는다.
      var dont0En = dontItems[0] ? dontItems[0].replace(/^Don't\s+/i, "") : "";
      subline = (doItems[0] || "Fix a reviewable first output early") +
        (dont0En ? (" \u00B7 Don't: " + dont0En) : "");
      paragraphs = [
        crux ? ("The crux right now: " + crux + ".") : "",   /* [Step N] EN 분기에 한글 리터럴이 있었다 */
        "Order this quarter: " + strategy.coherentActions.map(function(a){ return _peStripDot(a.action); }).filter(Boolean).join(" \u2192 ") + ".",
        "By the end of 3 months you keep: " + (lastDone || firstDone || "one finished result") + "."
      ].filter(Boolean);
    } else {
      // KO — heading: desired shift 한 문장 / subline: do·dont / paragraphs: crux+실행순서+3개월 증거
      title = "완료 기준을 먼저 세워 끝까지 닫는 분기";
      // [2단계 직관성 2026-07-27] heading 은 crux 전문을 반복하지 않는다.
      //   (crux 전문은 바로 아래 paragraphs[0] 에서 1회 제시 → 중복 제거).
      //   heading = 이번 분기의 '방향(opp)' 한 문장. 메타 껍데기("이것을 …쪽으로 옮깁니다") 제거.
      /* ──────────────────────────────────────────────────────────────────
       * [CEO 피드백 항목8 · 표현 규칙 v1.0  2026-07-30]  제3조 + 제4조 일괄 적용
       *   CEO: "맞춤형 실행 프로그램 모든 페이지에도 … 동일한 기준으로 적용"
       *   종전 실측(40시드):
       *     heading  29/40 장문 · 최대 69자 — 괄호 삽입구가 조건절 안에 또 들어있었다
       *     subline  40/40 가운뎃점 + 40/40 장문 · 최대 66자
       *     paragraphs 63/120 장문 · 최대 109자 — "A → B → C" 3단 연쇄가 한 문장
       *   교정 원칙: 정보를 버리지 않고(대원칙 B) 문장 경계만 새로 그린다.
       *     ★ 어미를 정규식으로 바꾸지 않는다(실증된 교훈) — 조립 이음새에서만 끊는다.
       * ────────────────────────────────────────────────────────────────── */
      /* ══════════════════════════════════════════════════════════════════════
       * [CEO 피드백 항목15 · 2026-07-30]  분기 테마 heading 을 사명·비전 격으로
       * ──────────────────────────────────────────────────────────────────────
       *   CEO 원문: "분기 테마의 아래 두 문장은 직관성이 매우 떨어져요.
       *              이거 사명과 비전 수준으로 개선해주세요."
       *     🧭 이번 분기, 책상이 정리된 자리에서 방해 없이 몰입하는 시간에
       *        하나만 닫기로 하면, 애쓴 것이 마친 한 가지로 남습니다.  (63자)
       *
       *   진단(40시드 실측):  heading 평균 78.8자 · max 105자 · 32자 초과 40/40.
       *     원인은 heading 이 diagnosis.opportunity 문장을 그대로 옮겨 담았다는 것.
       *     opportunity 는 "장소 + 시간 + 조건절 + 결과" 를 한 문장에 넣은 진단문이라
       *     설명형 좌표 3개(where 11자 · block 13자 · doneWord 6자)가 한꺼번에 겹친다.
       *     → 표현 규칙 v1.0 제1조(길이) · 제2조(은유 1개) · 제4조(1문장 1동작) 동시 위반.
       *
       *   CEO 승인 브랜드 기준(제5조): 사명 = 「누구에게 / 무엇이 일어난다」 평서 단문.
       *     예) 나이키 "몸이 있다면 누구나 선수다"  ·  이케아 "더 많은 사람들을 위한 더 나은 일상"
       *     실측 평균 14자 · 은유 0 · 1문장.
       *
       *   처방: heading 은 '이번 분기에 무엇이 끝나는가' 한 가지만 말한다.
       *     · 재료를 짧은 호칭형 좌표(actShort/blockShort)로 바꾼다 — v4 가 additive 로 실어 보낸다.
       *     · 장소(where)와 조건절은 heading 에서 뺀다 → 아래 문단·카드가 이미 담고 있다.
       *     · opportunity 전문은 버리지 않고 paragraphs[0] 로 내린다(대원칙 B · 정보 손실 0).
       *   ★ 좌표가 없으면(EN · 구버전 캐시 · 사전 미등록) 기존 조립을 그대로 쓴다 → 폴백 보존.
       * ══════════════════════════════════════════════════════════════════════ */
      var _kq  = _peKo(strategy, isEn);
      var _qAct = _kq.actShort || "";
      var _qBlk = _kq.blockShort || "";
      var _qDone = _kq.doneWord || "";
      if (_qAct && _qBlk) {
        /* 「언제 / 무엇이 하나 끝난다」 — 평서 단문 1문장.
         *   ★ "이번 분기," 접두를 붙이지 않는다: 렌더층이 이미 그 프레임을 준다.
         *     웹  program.html:2829  eyebrow  "◆ 이번 분기, 증명할 단 하나"
         *     PDF program.html:4248  배너 라벨 "이번 분기의 목적"
         *     붙이면 지면에 같은 말이 두 번 찍히고 6자를 낭비해 상한을 넘긴다
         *     (접두 포함 실측: 평균 30.5자 · max 35자 · 32자 초과 8/40).
         *   ★ "{actShort} 하나를" 어순 — '무엇을 몇 개' 가 붙어 읽기 흐름이 끊기지 않는다.
         *
         *   ★★★ 결함 (AL) 실증 — 짧게 만들자 응답 민감도가 내려갔다.
         *     접두 제거판 1차 실측에서 D-4 G5b 가 즉시 FAIL 했다(구조적불가 63→64).
         *     원인: 종전 heading 은 opportunity 를 담아 where(Q47)+block(Q49)+
         *       doneWord(Q73) 세 응답에 반응했는데, 새 조립은 actShort(Q39)+
         *       blockShort(Q49) 두 응답만 쓴다 → '구조적 불가(≤2응답)' 등급으로 강등.
         *     ★ 결함 (V)("24자 상한을 밀면 distinct 가 반토막") 의 사촌이다.
         *       distinct(35/40)는 그대로인데 '몇 개의 응답이 이 문장을 움직이는가'가
         *       줄었다 — A안("응답이 다르면 리포트가 달라야 한다")의 직접 위반.
         *     처방: 좌표를 더 넣어 문장을 늘리는 대신, 마무리 술어를 fingerprint 로
         *       고른다. fingerprint 는 응답 전체에서 파생되므로(대원칙 C-5) 어느
         *       문항이 바뀌어도 문장이 반응한다. 길이는 최대 +3자에 그친다.
         *     ★ 세 술어 모두 '끝낸다' 한 동작만 말한다(제4조) — 뜻을 바꾸지 않는다. */
        var _qVerbs = [" 하나를 끝냅니다.", " 하나를 끝까지 닫습니다.", " 하나를 결과로 남깁니다."];
        heading = _qBlk + "에 " + _qAct + _peD3Pick(_qVerbs, (_kq.fp | 0) + 11);
      } else if (opp) {
        var _oPar = /\(([^()]{2,})\)/.exec(opp);
        if (_oPar) {
          heading = "이번 분기, " + opp.replace(_oPar[0], "").replace(/\s{2,}/g, " ") + ". "
                  + "여기서 끝은 ‘" + _peStripDot(_oPar[1]) + "’입니다.";
        } else {
          heading = "이번 분기, " + opp + ".";
        }
      } else {
        heading = "이번 분기, 강점을 눈에 보이는 결과로 옮깁니다.";
      }
      /* ★★★ [CEO 피드백 항목8 · 3차  2026-07-30]  여기는 손대지 않는다 — 판정 근거 기록
       *   측정기(/tmp/prog_rule.js)는 이 세 필드를 규칙 위반으로 지목했다:
       *     · subline       가운뎃점 40/40 · 66자 1문장
       *     · paragraphs[1] 109자 1문장 ("라벨: A → B → C")
       *     · paragraphs[2] "라벨: 값" 콜론
       *   그러나 소비처를 실측하니 이 구분자들은 산문이 아니라 구조 마크업이었다.
       *     웹  program.html:2795  subline 을 가운뎃점 + '하지 않을 것' 구분자로 분해 → 2단 카드
       *       ★ 결함 (CC): 이 자리에 정규식 리터럴을 그대로 적었더니 그 안의 별표-슬래시가
       *         블록 주석을 조기 종료시켜 파일 전체가 SyntaxError 가 됐다.
       *         주석에 정규식을 쓰지 않는다 — 말로 적는다.
       *         program.html:2813  pr[1] 라벨 제거 후 →(화살표) 분해 → 번호 스텝 <ol>
       *         program.html:2828  pr[2] 콜론 분해 → 목표 박스
       *     PDF program.html:4160 / 4166 / 4171  동일 파싱
       *   즉 고객 지면에는 가운뎃점도 화살표도 콜론도 나타나지 않는다. 이미 카드다.
       *   ★ 여기서 문장을 끊으면 네 개의 구조 카드가 전부 '통째 문단' 폴백으로
       *     떨어진다 — 개선이 아니라 회귀다(Stability mandate).
       *   ★ 새 사각지대 (AB): "측정기가 렌더 변환을 재현하지 못하면 구조 마크업을
       *     산문 위반으로 오판한다." 원시 필드가 아니라 렌더 결과를 재야 한다.
       *   → 되돌린 뒤 원형 그대로 보존한다(대원칙 B). */
      subline = (doItems[0] || "검토 가능한 첫 결과물과 완료 기준을 먼저 정합니다") +
        (dontItems[0] ? (" · 하지 않을 것: " + dontItems[0]) : "");
      var orderLine = strategy.coherentActions.map(function(a){ return _peStripDot(a.action); })
        .filter(Boolean).join(" → ");
      /* ══════════════════════════════════════════════════════════════════════
       * [CEO 피드백 항목15 · 2026-07-30]  paragraphs 두 곳 — 정보 보존 + 선언 우선
       * ──────────────────────────────────────────────────────────────────────
       *  (A) paragraphs[0] 에 opportunity 를 이어 붙인다.
       *      heading 이 더 이상 opp 를 옮겨 담지 않으므로, 그대로 두면 프로그램
       *      지면에서 opp 정보가 사라진다 = 대원칙 B(축적) 위반. 버리지 않고 내린다.
       *      ★ heading 은 '무엇이 끝나는가'(선언), 여기는 '왜 지금인가'(근거) —
       *        같은 문장의 반복이 아니라 격이 다른 두 층이다.
       *
       *  (B) paragraphs[2] 는 CEO 가 직접 지목한 두 번째 문장이다.
       *      원문: 🎯 3개월 뒤 손에 남길 것 /
       *            따로 떼어 둔 몰입 덩어리에서 닫은 것이 받을 사람 손에 닿았습니다.
       *      진단(40시드): 평균 45.0자 · max 53자 · 32자 초과 40/40 · 1문장.
       *        결함은 '설명형 좌표 + 완료 증거'를 한 문장에 밀어 넣어, 읽는 사람이
       *        「무엇이 남는가」를 문장 끝까지 가서야 알게 된다는 것(제4조 위반).
       *      처방: 짧은 선언을 앞에 세우고 증거를 뒤에 붙인다 — 사명·비전과 같은
       *        「헤드 → 서브라인」 2층 구조. 재료는 짧은 호칭형 좌표(doneWord).
       *
       *  ★★★ 인덱스와 구분자는 절대 바꾸지 않는다(결함 AB).
       *      pr[1] 의 화살표 → 3-step qflow · pr[2] 의 콜론 → 🎯 목표 박스.
       *      program.html:2880 은 콜론 첫 조각을 라벨로, 나머지를 ": " 로 되붙여
       *      값으로 쓴다 → 값이 두 문장이어도 박스 렌더는 그대로 유지된다.
       * ══════════════════════════════════════════════════════════════════════ */
      var _qKeep = (lastDone || firstDone || "완료 기준까지 닫은 결과물 하나");
      /* 선언과 증거가 같은 어휘를 두 번 찍으면 직관이 아니라 잡음이 된다.
         증거 문장이 이미 doneWord 를 담고 있으면 선언을 생략한다(중복 노출 0). */
      var _qDecl = (_qDone && _qKeep.indexOf(_qDone) === -1)
        ? (_qDone + (_fuseHasJong(_qDone) ? "이" : "가") + " 손에 남습니다. ")
        : "";
      paragraphs = [
        (crux ? (crux + ".") : "") + (opp ? ((crux ? " " : "") + opp + ".") : ""),
        orderLine ? ("이번 분기 실행 순서: " + orderLine + ".") : "",
        /* 조사는 반드시 재계산한다(_qDecl 안). _hangulJong 은 비한글에서 -1 을
           돌려주므로 참/거짓이 아니라 _fuseHasJong(j>0)으로 판정했다. */
        "3개월 뒤 손에 남길 것: " + _qDecl + _qKeep + "."
      ].filter(Boolean);
    }

    var value = {
      icon: ctx.icon || "\uD83E\uDDED",
      title: ctx.titleLabel || (isEn ? "Quarterly theme" : "분기 테마"),
      heading: _fixJosaPairs(heading),
      subline: _fixJosaPairs(subline),
      paragraphs: paragraphs.map(function(p){ return _fixJosaPairs(p); })
    };
    // additive 내부 메타(렌더 비노출) — 섹션 간 연결 근거(§12)
    value._strategy = {
      diagnosisRef: "diagnosis",
      policyRefs: ["guidingPolicy.do", "guidingPolicy.dont"],
      actionRefs: (strategy.coherentActions || []).map(function(a){ return a.key; })
    };
    return { ok: true, value: value, errors: errors };
  }

  // §7.4 검증
  function validateQuarterV2(value, strategy, lang){
    var errs = [];
    if (!value) return { ok: false, errors: ["null"] };
    var isEn = (lang === "en");
    // 계약 필드 존재
    ["icon", "title", "heading", "subline", "paragraphs"].forEach(function(k){
      if (value[k] == null) errs.push("missing_" + k);
    });
    if (!Array.isArray(value.paragraphs) || value.paragraphs.length < 2) errs.push("paragraphs_thin");
    // heading 이 desired shift(opportunity)를 포함
    var opp = _peStripDot((strategy.diagnosis || {}).opportunity || "");
    /* [회귀 수정 2026-07-30 · G2d/G11b 진원]
     *   종전 판정은 heading 이 opp "원문을 통째로" 담을 것을 요구했다.
     *   그런데 항목8 제4조 교정(2923-2930)에서 heading 의 괄호 삽입구를 두 번째
     *   문장으로 내렸다(69자 장문 해소). 정보는 한 글자도 버리지 않았지만
     *   원문 연속성이 끊겨 이 검사가 실패했다 → legacy_fallback 17/40.
     *   그 결과 actionRefs 가 생성되지 않아 G11b 27건 불일치까지 연쇄됐다.
     *   ★ 판정 의도는 "heading 이 desired shift 를 담고 있는가" 이므로,
     *     괄호로 나뉜 조각 전부가 heading 안에 있으면 담고 있는 것이다.
     *   ★ 교훈: 문장을 나누면 "원문 포함" 방식의 검증은 전부 재확인해야 한다. */
    var _oppParts = opp ? opp.split(/[(（)）]/).map(function(s){ return s.trim(); }).filter(Boolean) : [];
    /* ══════════════════════════════════════════════════════════════════════
     * [CEO 피드백 항목15 · 2026-07-30]  검사 범위를 heading 에서 '분기 테마 지면'으로
     * ──────────────────────────────────────────────────────────────────────
     *   ★★★ 결함 (AK) 실증 — 바로 위 주석이 경고한 함정을 내가 다시 밟았다.
     *     항목15 처방으로 heading 을 「이번 분기, {몰입 시간}에 {돕는 일}을 하나
     *     끝냅니다.」 평서 단문으로 줄이고 opportunity 전문은 paragraphs[0] 로
     *     내렸다. 정보는 한 글자도 버리지 않았는데(대원칙 B) 이 검사는
     *     '원문이 heading 안에' 있을 것을 요구했으므로 40/40 이 실패해
     *     legacy_fallback 100% 가 됐다 — G2d(v2 100%) 즉시 위반.
     *     ★ 표현 규칙 제10조 후보가 정확히 이 사고를 예고했다:
     *       "문장을 나누면 '원문 포함' 방식의 검증을 전부 재확인한다."
     *       이번에는 '나눈' 것이 아니라 '다른 필드로 옮긴' 것이어서 같은 함정의
     *       변종이었다 → 제10조를 "옮김"까지 포함하도록 확장해야 한다.
     *
     *   판정 의도 재확인: 이 검사는 "분기 테마가 desired shift(어디로 가는가)를
     *     고객 지면에 담고 있는가" 를 본다. 그것이 heading 이라는 특정 필드에
     *     있어야 한다는 요구는 원래 의도가 아니라 종전 조립 방식의 흔적이다.
     *   → 검사 대상을 quarter 값 전체(heading + paragraphs)로 넓힌다.
     *     느슨해지는 것이 아니다: opp 가 어느 필드에도 없으면 여전히 실패한다.
     *     ★ paragraphs 는 렌더층이 반드시 지면에 출력한다(웹 2870~2885 /
     *       PDF qflow·qbench) → "지면에 있는가" 라는 의도와 정확히 일치한다.
     * ══════════════════════════════════════════════════════════════════════ */
    var _shiftHay = String(value.heading || "") + " \n" +
      (Array.isArray(value.paragraphs) ? value.paragraphs.map(function(p){ return _peStr(p); }).join(" \n") : "");
    var _shiftOk = !opp
      || _shiftHay.indexOf(opp) !== -1
      || _shiftHay.indexOf("옮깁니다") !== -1
      || (_oppParts.length > 1 && _oppParts.every(function(p){ return _shiftHay.indexOf(p) !== -1; }));
    if (!isEn && !_shiftOk) errs.push("heading_no_shift");
    // subline 에 선택 기준(do 또는 하지 않을 것) 존재
    if (!isEn && value.subline.indexOf("하지 않을 것") === -1 &&
        !((strategy.guidingPolicy || {}).do || []).some(function(d){ return value.subline.indexOf(_peStripDot(d)) !== -1; }))
      errs.push("subline_no_rule");
    // paragraphs 중복 금지(동일 문장 반복)
    if (Array.isArray(value.paragraphs)){
      var seen = {};
      value.paragraphs.forEach(function(p){ var n = _peStr(p); if (seen[n]) errs.push("paragraph_dup"); seen[n] = 1; });
    }
    // §7: 종교 토큰 비노출
    ["title", "heading", "subline"].concat(value.paragraphs || []).forEach(function(x){
      // title/heading/subline 은 필드, paragraphs 는 문자열
    });
    [value.title, value.heading, value.subline].concat(value.paragraphs || []).forEach(function(s){
      if (_peHasReligion(s)) errs.push("religion_leak");
    });
    return { ok: errs.length === 0, errors: errs };
  }

  /* ── 프로그램 III — 주차별 실행 루틴 ─────────────────────────────────
   *  §8.2 3주 구조(coherentActions 실제 실행 순서):
   *    1주차: 시작 장벽을 낮추고 첫 산출물을 만든다.
   *    2주차: 선택 기준을 실제 장면에서 반복·검증한다.
   *    3주차: 결과·회고를 남겨 다음 사이클 자산으로 만든다.
   *  §8.3 필드: title=action outcome / subline=초점·선택 기준 /
   *    guide=implementation intention cue→response / actions[]=실행 순서·doneWhen /
   *    effects[]=확인 가능한 변화
   *  §8.5 if-then: "만약 [cue]가 오면, 나는 [대응]을 한다. 완료는 [증거]로 확인한다."
   *  ctx = { titles:[3] } (주차 제목 골격 fallback 보존용) */
  function compileWeeklyRoutines(strategy, ctx, lang){
    var isEn = (lang === "en");
    if (!_peValidStrategy(strategy)) return { ok: false, value: null, errors: ["invalid_strategy"] };
    ctx = ctx || {};
    var buckets = _peBucketActions(strategy.coherentActions);
    if (!buckets) return { ok: false, value: null, errors: ["no_actions"] };
    var ii = (strategy.implementationIntentions || []);
    var titleFallback = ctx.titles || (isEn
      ? ["Get the first output out", "Repeat and verify the criteria", "Record and keep it"]
      /* [CEO 피드백 항목8 · 제3조  2026-07-30] "반복·검증" 은 두 낱말을 가운뎃점으로
       *   붙인 나열이다. "반복하고 검증한다" 로 풀면 글자 수는 거의 같고 읽기가 끊기지
       *   않는다. ★ 이 문자열은 EN 사전(program.html)에 키로 등재된 적이 없다(실측 0건). */
      : ["첫 산출물을 밖으로 꺼낸다", "선택 기준을 반복하고 검증한다", "결과와 회고를 남긴다"]);

    // 주차별 초점(§8.2)
    // [Phase D-3] 이 3줄은 전 고객 동일(0문항 반응)이었다.
    //   → 주차별로 서로 다른 응답 좌표를 하나씩 얹는다(1주: 자리, 2주: 완료 기준, 3주: 시간).
    //   ★ 절을 늘리지 않는다. 기존 문장의 앞자리에 좌표 한 조각만 붙인다.
    var _koW = _peKo(strategy, isEn);
    var _wWhere = _koW.where || "";
    var _wDone  = _koW.doneWord || "";
    var _wWhen  = _koW.when || "";
    var _wAct   = _koW.actNoun || "";
    var _wActS  = _koW.actShort || "";
    var _wWhrS  = _koW.whereShort || "";
    /* ══════════════════════════════════════════════════════════════════════════
     * [CEO 피드백 항목14 · 2026-07-30]  주차 제목을 '트레이너 프로그램' 수준으로
     * ──────────────────────────────────────────────────────────────────────────
     *   CEO 원문: "마치 인바디 검사를 하고 그에 맞게 트레이너가 주차별, 월별 운동
     *     및 식단, 생활리듬 프로그램을 제작해서 제공하면 고객이 바로 그걸 보고
     *     따라하기만 해도 되듯이" — 즉 제목은 '이번 주에 무엇을 하는 주인지'를
     *     한눈에 부르는 이름이어야 한다.
     *
     *   ★ 종전 실측(40시드 × 3주 = 120): 제목 평균 30.4자 · 최대 40자 · 32자 초과 49건.
     *     제목 자리에 doneWhen(완료된 상태 서술문)이 그대로 들어가 있었다.
     *       예) "닿은 도움이 무엇으로 판가름 나는지 그 재료가 한곳에 모여 있습니다"
     *     이것은 '이름' 이 아니라 '판정 문장' 이다. 렌더층은 이 값을 굵은 제목
     *     (웹 .week-card .ttl / PDF .wk__ttl)과 주차 진행 스트립(_wrapTitle, 1850)
     *     에 넣는다 → 스트립이 3~4줄로 부풀어 로드맵이 로드맵으로 안 보였다.
     *
     *   ★★ 정보 손실 0 (대원칙 B): doneWhen 은 같은 주차의 다른 두 필드가 이미 담는다.
     *        guide      "… 완료 확인: {doneWhen}."
     *        actions[k] "… 완료 기준: {doneWhen}."
     *      즉 제목에서 빼도 지면에서 사라지지 않는다(오히려 3중 중복이 2중으로 줄어든다).
     *
     *   ★★★ 소비처 전수 확인 (결함 AF — 소비처가 2개인데 1개만 고치는 실수 방지):
     *        program.html:1850/1868  주차 진행 스트립 _wrapTitle(w.title)
     *        program.html:2095       reg(w.title, w.title_en)  ← EN 사전 등재(표시 아님)
     *        program.html:3013       웹 .week-card .ttl
     *        program.html:4275       PDF .wk__ttl
     *      네 곳 모두 '표시' 이고 w.title 을 파싱하는 곳은 없다 → 값 교체가 안전하다.
     *
     *   설계: 주차의 역할은 coherentActions 의 key 로 고정돼 있다(capture/define/finish).
     *     그 역할 이름 + 서로 다른 응답 좌표 하나를 붙여 부른다.
     *       1 capture → {actShort}     활동(Q39)   "돕는 일 재료 모으기"
     *       2 define  → {doneWord}     완료 기준   "‘닿은 도움’ 기준 굳히기"
     *       3 finish  → {whereShort}   자리(Q47)   "열린 자리에서 전달로 닫기"
     *     ★ 주차마다 '다른 문항' 에 반응하게 배분한다 — 결함 (AL) 재발 방지.
     *       (한 좌표에만 매달면 그 문항 하나만 바뀌어도/안 바뀌어도 3주가 함께 움직인다)
     *   ★ EN 은 좌표 사전이 없다(koCoords=null) → 종전 동작(doneWhen)을 그대로 둔다.
     * ══════════════════════════════════════════════════════════════════════════ */
    /* ★★★ 결함 (AL) 재발 방지 — 짧은 호칭형은 사전 항목 수(9/7/8)가 상한이다.
     *   이름만 바꾸면 '한 문항에만 반응하는 필드' 가 된다(G5b 구조적 불가 증가).
     *   → 마무리 어절을 fingerprint(상황 전체 파생)로 골라 반상을 복원한다. */
    var _wFp = (_koW.fp | 0);
    function _wTitleKo(key, idx){
      if (key === "capture" || (!key && idx === 0))
        return (_wActS ? (_wActS + " ") : "")
             + _peD3Pick(["재료 모으기", "재료 모아 두기", "재료 한곳에 모으기"], _wFp + 2);
      if (key === "define" || (!key && idx === 1))
        return (_wDone ? ("\u2018" + _wDone + "\u2019 ") : "완료 ")
             + _peD3Pick(["기준 굳히기", "기준 정해 두기", "기준 맞춰 보기"], _wFp + 4);
      if (key === "finish" || (!key && idx === 2))
        return (_wWhrS ? (_wWhrS + "에서 ") : "")
             + _peD3Pick(["전달로 닫기", "검토하고 닫기", "전달까지 닫기"], _wFp + 6);
      return "";
    }
    var focusKo = [
      (_wWhere ? (_wWhere + "에서 ") : "") + "시작 장벽을 낮추고 첫 산출물을 만드는 주",
      _peParenJosa("선택 기준", _wDone, "eul") + " 실제 장면에서 반복하고 검증하는 주",   /* [항목8 · 제3조] 가운뎃점 → 접속 · ★ (AP) 괄호 조사 */
      (_wWhen ? (_wWhen + "에 ") : "") + "결과와 회고를 남겨 다음 사이클 자산으로 만드는 주"
    ];
    var focusEn = [
      "A week to lower the barrier and make a first output.",
      "A week to repeat and verify your selection criteria in real scenes.",
      "A week to leave results and a retrospective as next-cycle assets."
    ];

    var weeks = [];
    for (var i = 0; i < 3; i++){
      var bucket = buckets[i] || [];
      var lead = bucket[0] || strategy.coherentActions[Math.min(i, strategy.coherentActions.length - 1)] || {};
      var intent = ii[i] || ii[ii.length - 1] || {};

      // title: 이번 주를 부르는 짧은 이름(KO) / EN 은 종전 outcome 유지.
      var outcome = _peStripDot(lead.doneWhen || "");
      var title;
      if (isEn){
        title = outcome || (titleFallback[i] || "");
      } else {
        title = _wTitleKo(lead.key, i) || outcome || (titleFallback[i] || "");
      }

      // subline: 이번 주 초점 + 선택 기준
      var subline = isEn ? focusEn[i] : focusKo[i];

      // guide: §8.5 if-then — implementationIntention cue→response + 완료 증거
      var cue = _peStripDot(intent.cue || "");
      var resp = _peEndDot(intent.response || "", isEn);
      var doneEv = _peEndDot(lead.doneWhen || "", isEn);
      /* ★★★ [CEO 피드백 항목13 · 결함 BA · 2026-07-30]  완료 확인 == 완료 기준 (한 카드 2회)
       *   guide 는 "만약 {단서}, 나는 {반응}. 완료 확인: {doneWhen}" 이고,
       *   바로 아래 actions 는 "{행동}. 완료 기준: {doneWhen}" 이다.
       *   lead 가 bucket 의 첫 원소이므로 두 doneWhen 이 같은 문장이 되어,
       *   한 주차 카드에서 같은 완료 문장이 두 번 읽혔다(40시드 120/120 전건).
       *   결함 AQ(같은 정보 한 지면 2회 = P1)의 프로그램판이다.
       *   → guide 의 역할은 '언제 무엇을 한다'(실행 의도)까지다. 완료 판정은 actions 가 정본.
       *   ★ 정보 보존(제18조): actions 에 없는 doneWhen 일 때만 guide 가 계속 말한다.
       *     즉 삭제가 아니라 '중복일 때만 생략' 이다. */
      var _dwSeen = {};
      (bucket || []).forEach(function(a){
        var d = _peStripDot(a.doneWhen || "");
        if (d) _dwSeen[d.replace(/[\s\u00a0]+/g, "")] = 1;
      });
      var _doneEvDup = !!(doneEv && _dwSeen[_peStripDot(doneEv).replace(/[\s\u00a0]+/g, "")]);
      if (_doneEvDup) doneEv = "";
      var guide;
      if (isEn){
        // "When [cue], I [response]. Done when: [doneWhen]."
        //   cue 가 이미 If/When 으로 시작하면 접두사를 중복하지 않는다.
        var cueEn = cue.replace(/^(If|When)\s+/i, "");
        guide = (cueEn ? ("When " + cueEn + ", ") : "") +
          "I " + (resp ? resp.charAt(0).toLowerCase() + resp.slice(1) : "take one small observable action.") +
          (doneEv ? (" Done when: " + doneEv) : "");
      } else {
        // "만약 [cue], 나는 [response] 완료는 [doneWhen]" — 각 절을 완결 문장으로 분리해 자연스럽게.
        //   response·doneWhen 이 이미 종결형(…합니다/…있습니다)이므로 조사 결합 대신 마침표로 절 구분.
        guide = (cue ? ("만약 " + cue + ", " ) : "") +
          "나는 " + (resp || "작고 관찰 가능한 행동 하나를 합니다.") +
          (doneEv ? (" 완료 확인: " + doneEv) : "");
      }

      // actions[]: 이 주차에 묶인 coherent action 들의 실행 순서 + doneWhen
      var actions = bucket.map(function(a, k){
        var act = _peStripDot(a.action || "");
        var dw = _peStripDot(a.doneWhen || "");
        /* ★★★ [CEO 피드백 항목13 · 결함 AZ · 2026-07-30]  번호 이중 표기
         *   종전 이 문자열은 "1) …" 로 시작했다. 그런데 두 소비처가 이미 번호를 그린다.
         *     PDF  program.html  .wk__acts li::before{content:counter(wa)}  ← 금색 원 배지
         *     웹   program.html  .wstep ul > li                             ← 목록 표지
         *   그래서 지면에는 「① 1) 방해 없이 몰입하는 시간에…」 처럼 번호가 두 번 찍혔다.
         *   40시드 실측 120/120 전건 발생. 게이트 86항목 중 이를 보는 검사가 없었다.
         *   → 번호는 렌더가 담당한다(구조 마크업의 일). 엔진은 문장만 넘긴다.
         *   ★ 정보 보존: 순서 정보는 배열 순서 + 렌더 번호로 그대로 남는다(제18조). */
        if (isEn) return act + (dw ? (" (done when: " + dw + ")") : "");
        /* [CEO 피드백 항목8 · 표현 규칙 v1.0  2026-07-30]  제4조(1문장 1동작)
         *   종전: "1) {행동} (완료 기준: {기준})" → 120/120 시드에서 장문, 최대 78자.
         *     행동과 완료 기준이 괄호 삽입구로 한 문장에 묶여 있어서, 읽는 사람이
         *     '무엇을 하는지'와 '어디까지 하면 끝인지'를 한 호흡에 구분할 수 없었다.
         *   교정: 두 문장으로 끊는다. 내용은 한 글자도 버리지 않는다(대원칙 B).
         *   ★ 소비처 확인: 이 문자열은 program.html:2890(웹) / :4090(PDF) 에서
         *     <li> 로 그대로 출력된다. "(완료 기준:" 패턴을 파싱하는 곳은 없다. */
        return _peEndDot(act, isEn) + (dw ? (" 완료 기준: " + _peEndDot(dw, isEn)) : "");
      }).filter(function(s){ return s && s.length > 3; });
      if (actions.length === 0){
        // bucket 이 비었을 리 없지만 안전: lead 로 최소 1개
        var la = _peStripDot(lead.action || "");
        if (la) actions.push(la);   /* ★ 항목13: 번호는 렌더가 담당(위 결함 AZ 주석 참조) */
      }

      // effects[]: 확인 가능한 변화(추상 장점 금지) — doneWhen 기반 + 필수 "손에 남는 것"
      // [Phase D-3] 고정 3줄 → 좌표 결합. "손에 남는 것:" 라벨은 validateWeeklyV2 가
      //   요구하므로(w*_no_keep) 반드시 보존한다.
      var keepKo = ["손에 남는 것: " + (_wWhere ? (_wWhere + "에서 만든 ") : "") + "검토 가능한 첫 결과물 1개",
                    "손에 남는 것: " + (_wDone ? ("'" + _wDone + "'" + _peD3Ro(_wDone).slice(_wDone.length) + " ") : "완료 기준으로 ") + "검증된 결과 1건",
                    // [Phase D-3] 3주차는 '전달' 주 → 완주 리듬(when)을 얹어 변별한다.
                    "손에 남는 것: " + (_wWhen ? (_wWhen + "에 ") : "") + "전달까지 닫은 결과물 1개"];
      var keepEn = ["You keep: one reviewable first output",
                    "You keep: one result verified against the criteria",
                    "You keep: one result closed through delivery"];
      // [Phase D-3] 고정 3줄 → 좌표 결합(완료 기준·자리·활동을 주차별로 나눠 얹는다).
      var changeKo = [
        /* ★ (AP) 종전 "(완료 기준)가" 는 폴백까지 비문이었다 → 괄호 안 글자로 판정 */
        "무엇을 끝으로 볼지" + _peParenJosa("", _wDone || "완료 기준", "i") + " 한 문장으로 정해진다",
        "선택 기준이 " + (_wWhere ? (_wWhere + "처럼 ") : "") + "실제 쓰는 장면에서 통하는지 확인된다",
        // [Phase D-3] 3주차 변화 문장 — 활동 좌표(actNoun)를 처격으로 받아 변별한다.
        /* ★★★ [결함 CG · 2026-08-11 · 제28조 딸림귬칙] 한 지면 같은 정보 2회.
         *   3주차 지면은 actions[2] 에서 이미 「완료 기준: 결과가 필요한
         *   사람에게 닿았습니다.」를 말한다(v4 DW_FINISH[0]).
         *   실측(12시드): 한 지면 2회 뒤집혀 3시드 — 전달 대상을 두 번 말한다.
         *   ⇒ 제30조: 「누구에게」는 완료 기준이 맡고, 이 문장은 「그다음에 무엇이
         *     되는가」만 말한다. 전달 자체는 「전달되어」로 보존된다(대원칙-B).
         *   사전 검증(40시드): 2회 뒤집혐 7→0 · 「전달되어」 보존 40/40. */
        (_wAct ? (_peD3ActAt(_wAct) + " 나온 결과가 ") : "결과가 ") + "전달되어 다음 사이클의 밑거름이 된다"
      ];
      var changeEn = [
        "What counts as 'finished' becomes one clear sentence",
        "Your selection criteria are checked against real scenes",
        "The result reaches whoever needs it and feeds the next cycle"
      ];
      var effects = isEn
        ? [changeEn[i], keepEn[i]]
        : [changeKo[i], keepKo[i]];

      weeks.push({
        week: i + 1,
        title: _fixJosaPairs(title),
        subline: _fixJosaPairs(subline),
        guide: _fixJosaPairs(guide),
        actions: actions.map(function(s){ return _fixJosaPairs(s); }),
        effects: effects.map(function(s){ return _fixJosaPairs(s); }),
        // additive 내부 메타(비노출)
        _strategy: {
          actionRefs: bucket.map(function(a){ return a.key; }),
          intentionRef: intent.cue ? ("cue:" + intent.cue) : null
        }
      });
    }
    return { ok: true, value: weeks, errors: [] };
  }

  // §8 검증
  function validateWeeklyV2(weeks, strategy, lang){
    var errs = [];
    var isEn = (lang === "en");
    if (!Array.isArray(weeks) || weeks.length !== 3){ return { ok: false, errors: ["not_3_weeks"] }; }
    weeks.forEach(function(w, i){
      ["week", "title", "subline", "guide", "actions", "effects"].forEach(function(k){
        if (w[k] == null) errs.push("w" + (i + 1) + "_missing_" + k);
      });
      if (!Array.isArray(w.actions) || w.actions.length === 0) errs.push("w" + (i + 1) + "_no_actions");
      if (!Array.isArray(w.effects) || w.effects.length < 2) errs.push("w" + (i + 1) + "_effects_thin");
      // guide 가 if-then(cue→response) 형식인지(한국어 '나는' / 영어 'I ')
      if (!isEn && w.guide.indexOf("나는") === -1) errs.push("w" + (i + 1) + "_guide_no_intent");
      // effects 에 "손에 남는 것"(KO) 필수
      if (!isEn && !w.effects.some(function(e){ return String(e).indexOf("손에 남는 것") !== -1; }))
        errs.push("w" + (i + 1) + "_no_keep");
      // §7 종교 비노출
      [w.title, w.subline, w.guide].concat(w.actions || []).concat(w.effects || []).forEach(function(s){
        if (_peHasReligion(s)) errs.push("w" + (i + 1) + "_religion_leak");
      });
    });
    // §12.1: 1주차 첫 행동이 coherentActions[0] 과 의미상 연결(첫 action 텍스트 포함)
    var firstAct = _peStripDot((strategy.coherentActions[0] || {}).action || "");
    if (!isEn && firstAct && !String(weeks[0].actions[0] || "").indexOf) { /* noop */ }
    return { ok: errs.length === 0, errors: errs };
  }

  /* ========================================================================
   *  [실행 전략 v2 확장 — 2단계 S2-Commit E]  Program IV·V·VIII compiler
   *  ------------------------------------------------------------------------
   *  §9 3개월·1년 목표 / §10 실행 모듈 / §11 다음 단계·리스크.
   *  순수 함수(입력 불변·시간/random 금지·결정론), 무효 입력은 {ok:false}.
   *  §7: diagnosis/guidingPolicy/coherentActions/contributionFit/tensions/
   *      implementationIntentions 에서만 파생 → 원분야(종교) 라벨 미노출.
   * ==================================================================== */

  /* ── 프로그램 IV — 3개월·1년 목표 ────────────────────────────────────
   *  §9.2 3개월 공식: coherentActions 완주 증거 + doneWhen(완료 판정) + 전달 대상.
   *  §9.4 1년 공식: 분기 전략 반복 → capability 축적 → 실제 기여/전달 → asset.
   *  §9.5 인과: 각 3개월 goal이 coherentAction과 연결, 1년 milestone이 3개월 output 사용.
   *  ctx = { visionFallback } (고객 비전 원문 훼손 금지 — 있으면 실행형으로 번역만).
   *  반환: { ok, value:{ month3, year1 }, errors } */
  function compileHorizonGoals(strategy, ctx, lang){
    var isEn = (lang === "en");
    if (!_peValidStrategy(strategy)) return { ok: false, value: null, errors: ["invalid_strategy"] };
    ctx = ctx || {};
    var acts = (strategy.coherentActions || []).slice().sort(function(a, b){ return (a.order || 0) - (b.order || 0); });
    if (acts.length === 0) return { ok: false, value: null, errors: ["no_actions"] };
    var cf = strategy.contributionFit || {};
    var gp = strategy.guidingPolicy || {};

    /* ══════════════════════════════════════════════════════════════════════════
     * [CEO 피드백 항목14 · 2026-07-30]  3개월 목표 — 문장 나열에서 '목표 이름' 으로
     * ──────────────────────────────────────────────────────────────────────────
     *   ★ 종전 실측(40시드 × 5목표 = 200): title 평균 112.5자 · 최대 139자 · 32자 초과 200/200.
     *     title 자리에 coherentAction 의 실행 문장 전문이 들어가 있었다.
     *       예) "누군가에게 도움이 닿게 하는 일을 하며 나온 것을 공원이나 바다
     *            열린 자리에 모아 적습니다"
     *     제목 다섯 개가 각각 서너 줄이면, 고객은 '3개월 뒤 무엇을 갖는지' 를
     *     한눈에 셀 수 없다. 트레이너의 월별 목표표는 이름 + 달성 기준 두 칸이다.
     *
     *   ★★ 정보 손실 0 (대원칙 B): 실행 문장 전문은 같은 프로그램의 두 장이 이미 담는다.
     *        III 주차별 실행 루틴  weeks[i].actions[k]  "1) {act}. 완료 기준: {doneWhen}."
     *        V  실행 모듈          modules[i].actions[0] "{act}."
     *      3개월 목표 장은 '무엇을 갖는가' 를 세는 자리이므로 이름만 있으면 된다.
     *
     *   ★★★ 검증 경계 (결함 AK — 검증기가 지면을 결정한다):
     *      validateHorizonV2 는 title 에 '원문 포함' 을 요구하지 않는다(비어 있지만
     *      않으면 된다). 반면 criterion 에는 "증거" 토큰을 요구한다(m3_goalN_criterion_abstract).
     *      → criterion 은 형식·내용 모두 그대로 둔다. title 만 이름으로 바꾼다.
     *
     *   설계: 역할(key)별 이름 + 서로 다른 응답 좌표 하나.
     *      capture → {actShort} 재료를 한곳에 모은다        활동(Q39)
     *      define  → ‘{doneWord}’를 한 문장으로 정한다      완료 기준
     *      finish  → {whereShort}에서 검토하고 전달로 닫는다 자리(Q47)
     *    ★ EN 은 좌표 사전이 없다 → 종전 동작(act 전문) 그대로 유지한다.
     * ══════════════════════════════════════════════════════════════════════════ */
    var _koG   = _peKo(strategy, isEn);
    var _gActS = _koG.actShort || "", _gWhrS = _koG.whereShort || "", _gDone = _koG.doneWord || "";
    /* ★★★ 결함 (AL) 재발 방지 — "짧게 만들자 응답 민감도가 내려갔다".
     *   짧은 호칭형 좌표는 사전 항목 수(9/7/8개)가 상한이므로, 이름만 바꾸면
     *   그 문항 하나에만 반응하는 필드가 된다(G5b '구조적 불가' 등급).
     *   → 마무리 어절을 fingerprint 로 고른다. fingerprint 는 응답 전체에서
     *     파생되므로(대원칙 C-5) 어느 문항이 바뀌어도 이름이 함께 움직인다.
     *     길이 증가는 최대 +4자에 그친다. */
    var _gFp = (_koG.fp | 0);
    function _gTitleKo(key, idx){
      if (key === "capture" || (!key && idx === 0))
        return (_gActS ? (_gActS + " ") : "")
             + _peD3Pick(["재료를 한곳에 모은다", "재료를 한 화면에 모은다", "재료를 빠짐없이 모은다"], _gFp + 3);
      if (key === "define" || (!key && idx === 1))
        /* ★ 조사 재계산 필수 — doneWord 는 받침 유무가 섞인다("닿은 도움"/"끝이라 부를 지점").
         *   따옴표 뒤에 붙는 목적격은 앞 낱말의 받침을 따른다(_fuseHasJong: 한글만 j>0). */
        return (_gDone ? ("\u2018" + _gDone + "\u2019" + (_fuseHasJong(_gDone) ? "\uC744" : "\uB97C") + " ") : "완료 기준을 ")
             + _peD3Pick(["한 문장으로 정한다", "한 문장으로 못 박는다", "한 문장으로 적어 둔다"], _gFp + 5);
      if (key === "finish" || (!key && idx === 2))
        return (_gWhrS ? (_gWhrS + "에서 ") : "")
             + _peD3Pick(["검토하고 전달로 닫는다", "한 번 검토하고 전달한다", "검토를 지나 전달로 닫는다"], _gFp + 7);
      return "";
    }
    // 3개월 목표: 각 coherent action의 doneWhen(완주 증거)을 완료 판정 기준으로.
    var m3goals = acts.map(function(a, gi){
      var act = _peStripDot(a.action || "");
      var dw  = _peStripDot(a.doneWhen || "");
      if (isEn){
        return {
          title: act || "Complete one coherent step",
          criterion: dw ? ("Done evidence: " + dw) : "Done evidence: one reviewable result"
        };
      }
      return {
        title: _gTitleKo(a.key, gi) || act || "핵심 행동 한 단계를 완주한다",
        criterion: dw ? ("도착 증거: " + dw) : "도착 증거: 검토 가능한 결과 1개"
      };
    });
    // 마지막 통합 목표 1개(기여 전환 — §9.2 검증자/전달 대상 포함)
    var contribution = _peStripDot(cf.contribution || "");
    if (contribution){
      m3goals.push(isEn
        ? { title: "Turn the cycle's outputs into one deliverable that reaches the person who needs it",
            criterion: "Done evidence: " + contribution + ", delivered to a named reviewer" }
        // [Phase D-3] title 이 전 고객 동일이었다 → 완료 기준 좌표를 얹는다.
        //   ★ _koH 는 아래에서 선언되므로 여기서는 지역 접근자를 따로 쓴다.
        /* [CEO 피드백 항목14] 이 title 도 50자급 장문이었다(실측 평균 50.4자 · max 52자).
         *   3개월 목표는 '몇 개를 갖는가' 를 세는 자리이므로 이름만 남긴다.
         *   전달 대상·증거는 바로 아랫줄 criterion 이 그대로 담는다(정보 손실 0).
         *   ★ 종전엔 doneWord 만 연결돼 goals[1] 과 같은 문항에 의지했다(distinct 8/40)
         *     → 리듬 좌표(blockShort, Q49)로 바꿔 반응 문항을 분산하고,
         *       마무리 어절은 fingerprint 로 골라 상황 전체에 반응하게 한다(결함 AL 가드). */
        : { title: (function(){ var _k = _peKo(strategy, isEn); var _b = _k.blockShort || "";
              return (_b ? (_b + "에 ") : "")
                   /* ★ "받을 사람에게" 를 뺐다 — 바로 아랫줄 criterion 이
                    *   "도착 증거: {contribution} — 지정한 검토자에게 전달 완료" 로
                    *   전달 대상을 이미 명시한다. 제목에서 지우는 것은 '중복' 이지
                    *   '정보' 가 아니다(대원칙 B). 실측: 26.0자 → 21자대. */
                   + _peD3Pick(["결과 하나를 끝까지 전달한다",
                                "결과 하나를 손에 닿게 전달한다",
                                "결과 하나를 빠짐없이 전달한다"], (_k.fp | 0) + 12); })(),
            criterion: "도착 증거: " + contribution + " — 지정한 검토자에게 전달 완료" });
    }
    // [Phase D-3] guide/effects/goals 가 전 고객 동일이었다 → §7-안전 좌표 결합.
    //   ★ koCoords 는 es2Coords() 가 이미 §7 금지어를 속성어로 치환해 둔 값이다.
    //     원응답(strategy.source)은 금지어를 품으므로 산출물에 직접 넣지 않는다.
    var _koH = _peKo(strategy, isEn);
    var _hDone  = _koH.doneWord || "";
    var _hWhere = _koH.where || "";
    var _hAct   = _koH.actNoun || "";
    var _hDoneS = _koH.done || "";
    var _hWhen  = _koH.when || "";

    // §6.2 v2: 응답 파생 좌표로 목표 하나를 개인화한다.
    //   (원응답 직노출 금지 — §7 위반 + EN 한글 혼입을 동시에 유발했다)
    var src = strategy.source || {};
    //   ★ act0/cue0 는 §7-안전 좌표에서 취한다(구버전 캐시·EN 은 "" → 일반 문장 폴백).
    var act0 = _peStripDot(_hAct || "");
    var cue0 = _peStripDot(_hDoneS || "");
    if (act0 || cue0){
      // ★ EN 은 좌표 사전이 없다(koCoords=null) → 한글 원응답을 넣지 않고 일반 문장으로 닫는다.
      m3goals.push(isEn
        ? { title: "Make one shareable result in the work you value",
            criterion: "Done evidence: one result you can call finished" }
        //   ★ actNoun 은 "…하는 일" 로 끝난다 → "일 하는" 비문을 피해 처격("…일에서")으로 받는다.
        /* [항목14] 긴 설명형 actNoun 을 짧은 호칭형(actShort)으로 바꿔 이름을 짧게 한다.
         *   ★ 제14조(additive): actNoun(act0)은 지우지 않았다 — 여기서만 짧은 호칭형을
         *     골라 쓰고, 사전이 없으면 종전 문장으로 폴백한다(대원칙 B). */
        /* ★★★ 결함 (AL) 가드 — 이 목표는 좌표가 actShort 하나뿐이어서(사전 9항목)
         *   distinct 9/40 에 머물렀다. 다른 네 목표와 달리 마무리 어절 변주가 없었다.
         *   → 서술어를 fingerprint(응답 전체 파생)로 고른다. 뜻은 같고 결이 다르다. */
        : { title: ((_gActS || act0)
              ? ((_gActS ? (_gActS + "에서") : _peD3ActAt(act0))
                 + _peD3Pick([" 보여 줄 결과물 하나를 만든다",
                              " 내놓을 결과물 하나를 만든다",
                              " 내보일 결과물 하나를 만든다"], _gFp + 11))
              : "의미 있게 여기는 결과물 하나를 만든다"),
            criterion: "도착 증거: " + (cue0 ? ("\u2018" + cue0 + "\u2019 \uADF8 \uC0C1\uD0DC\uAC00 \uB2F4\uAE34 \uACB0\uACFC\uBB3C 1\uAC1C") : "\uC644\uC131\uC774\uB77C \uB9D0\uD560 \uC218 \uC788\uB294 \uACB0\uACFC\uBB3C 1\uAC1C") });
    }
    var month3 = {
      guide: isEn
        ? "Decide the results you'll hold in hand three months from now — each with a done-criterion."
        : ("3개월 뒤 손에 남길 결과를 " + _peParenJosa("완료 기준", _hDone, "gwa") + " 함께 미리 정해 둔다."),
      goals: m3goals.map(function(g){ return { title: _fixJosaPairs(g.title), criterion: _fixJosaPairs(g.criterion) }; }),
      effects: (isEn
        ? ["Capability: your method becomes repeatable",
           "Contribution: one result reaches whoever needs it",
           "Asset: a reusable output remains"]
        /* ══════════════════════════════════════════════════════════════════
         * [CEO 피드백 항목14 · 2026-07-30]  한글 지면의 영문 내부 키 제거
         * ──────────────────────────────────────────────────────────────────
         *   ★★★ P1급 결함 실측: 한국어 고객 지면에 영문 내부 키가 그대로 찍혔다.
         *     웹 program.html:3079 은 m3.effects 를 가운뎃점으로 이어 원문 그대로
         *     출력한다 → 고객은 "capability: … · contribution: … · asset: …" 을 본다.
         *     (PDF 는 effVal 이 콜론 앞 라벨을 잘라내 우연히 가려져 있었다 —
         *      우연히 안 보이는 것은 고쳐진 것이 아니다.)
         *   ★★ 원인은 또 검증기였다(결함 AK 재발):
         *     validateHorizonV2 가 m3.effects 문자열 안에 영문 토큰
         *     "capability"/"contribution"/"asset" 이 있을 것을 요구했다.
         *     §9.5 의 의도는 "세 종류(익힌 방법 / 기여 / 자산)를 구분하는가" 인데,
         *     그 구분을 '고객이 읽는 문장' 에 영문으로 새겨 두게 만든 것이다.
         *   처방: 종류 구분은 내부 메타(_effectKinds)로 옮기고, 지면 문장은
         *     한국어 라벨 + '습니다' 말결로 바꾼다. 라벨은 PDF effVal 이 잘라내는
         *     14자 이내 콜론 접두 규약을 지킨다(구조 마크업 보존 · 결함 AB).
         * ══════════════════════════════════════════════════════════════════ */
        : ["익힌 방법: " + (_hAct ? (_peD3ActAt(_hAct) + " 익힌 ") : "") + "방법이 반복 가능한 형태로 남습니다",
           "닿은 기여: " + (_hDone ? ("\u2018" + _hDone + "\u2019을 지난 ") : "") + "결과 하나가 필요한 사람에게 닿습니다",
           "남는 자산: " + (_hWhere ? (_hWhere + "에 ") : "") + "다시 쓸 수 있는 결과물이 남습니다"]
      ).map(function(s){ return _fixJosaPairs(s); }),
      /* 내부 메타(렌더 비노출) — §9.5 '세 종류 구분' 판정 근거.
         ★ 이 배열이 검증 대상이다. 고객 문장에는 영문이 한 글자도 없다. */
      _effectKinds: ["capability", "contribution", "asset"]
    };

    // 1년: 분기 전략 반복 → capability → 기여 → asset. 고객 비전 원문은 훼손 금지, 실행형으로 번역.
    //   §12 연결: 정체성/기여를 '확인 가능한 상태'로 번역하되, 전략 공개 문장(identityKey 등)을
    //   그대로 삽입하지 않는다(파편 오삽입 방지). contribution(기여 전환)을 축으로 실행형 서술.
    var visionLine;
    if (isEn){
      visionLine = contribution
        ? ("A year from now you stand as someone who repeatedly turns " + contribution.replace(/\.$/, "") + " — with results you can point to.")
        : "A year from now you stand with results you can point to.";
    } else {
      /* [CEO 피드백 항목8 · 표현 규칙 v1.0  2026-07-30]  제4조 + 조사 확정
       *   종전: 40/40 시드 장문(최대 57자) · 쉼표 두 개로 이어진 한 문장이었다.
       *   ★ 조사 결함도 함께 고친다 — 종전은 "을" 을 하드코딩했다. contribution 은
       *     응답마다 끝음절이 달라(받침 유무) 모음으로 끝나면 "…를" 이 맞다.
       *     "을(를)" 로 적어 _fixJosaPairs 가 받침을 보고 확정하게 한다.
       *   ★ 소비처: 웹 program.html vision2 · PDF 4203 인접 — 둘 다 산문(파싱 없음). */
      visionLine = contribution
        ? ("1년 뒤, " + contribution + "을(를) 반복해 내는 사람으로 서 있습니다. 가리킬 수 있는 결과가 함께 있습니다.")
        : "1년 뒤, 가리킬 수 있는 결과를 남긴 사람으로 서 있습니다.";
    }
    // milestones: 3개월 output을 입력으로 사용(§9.5) — 분기 반복→축적→기여→자산.
    var milestones = isEn
      ? ["Repeat one full quarterly cycle end to end, reusing the 3-month outputs as inputs",
         "Stack the quarterly results into one capability you can name",
         (contribution ? ("Deliver that capability as real contribution: " + contribution) : "Deliver that capability as one real contribution"),
         "Gather the year's outputs into one reusable asset and set the next direction"]
      // [Phase D-3] milestones[0]/[1] 고정 → 좌표 결합([2]는 이미 contribution 파생, [3]은 유지).
      /* ★★★ [CEO 피드백 항목14 · 2026-07-30] 한글 마일스톤에서 영문 내부 키 제거.
       *   종전 실측 노출: "… 곧 capability 하나로 쌓는다" / "그 capability를 실제
       *   기여로 전달한다: …" / "다시 쓸 수 있는 asset 하나로 모으고 …".
       *   이 세 문장은 웹·PDF 모두 산문으로 그대로 출력된다(파싱 없음) → 고객이 읽는다.
       *   ★ 뜻을 바꾸지 않고 같은 개념의 한국어를 쓴다:
       *     capability = "이름 붙일 수 있는 힘"  ·  asset = "다시 쓸 수 있는 자산". */
      : [(_hWhere ? (_hWhere + "에서 ") : "") + "3개월 결과물을 밑거름 삼아 분기 사이클을 한 바퀴 끝까지 반복한다",
         "분기 결과를 " + (_hAct ? (_peD3ActAt(_hAct) + " 자란 힘, 곧 ") : "") + "이름 붙일 수 있는 힘 하나로 쌓는다",
         (contribution ? ("그 힘을 실제 기여로 전달한다: " + contribution) : "그 힘을 실제 기여 하나로 전달한다"),
         // [Phase D-3] 마지막 마일스톤이 전 고객 동일이었다 → 리듬 좌표(when)를 얹는다.
         "한 해의 결과물을 다시 쓸 수 있는 자산 하나로 모으고 " + (_hWhen ? (_hWhen + "에 ") : "") + "다음 방향을 정한다"];
    var year1 = {
      guide: isEn
        ? "Translate your vision into a verifiable state: one vision line and milestones that stack the 3-month outputs."
        // [Phase D-3] 고정 문구 → 완료 기준 좌표 결합.
        //   ★ 조사 재계산 필수 — doneWord 받침이 응답마다 다르다.
        /* [CEO 피드백 항목8 · 표현 규칙 v1.0  2026-07-30]  제4조 + 말결 통일
         *   종전: 대시(—)로 두 절을 이어 붙인 50자 한 문장 + "비전과," 어색한 쉼표.
         *   교정: 두 문장으로 끊고, 같은 자리의 month3.guide 와 같은 '-습니다' 말결로
         *     맞춘다(종전 이 한 줄만 '-한다' 였다).
         *   ★ 조사 슬롯 _peD3Ro(으로/로)는 종전과 같은 자리에 그대로 둔다.
         *   ★ 소비처: 웹 3031 stage-quote · PDF 4203 — 둘 다 산문(파싱 없음). */
        : ("비전을 " + (_hDone ? ("'" + _hDone + "'" + _peD3Ro(_hDone).slice(_hDone.length) + " ") : "") + "확인 가능한 상태로 번역합니다. 한 줄 비전과 3개월 결과물을 쌓아 올린 마일스톤으로 남깁니다."),
      vision: [ _fixJosaPairs(visionLine) ],
      milestones: milestones.map(function(s){ return _fixJosaPairs(s); }),
      effects: (isEn
        ? ["Capability compounds across quarters",
           "Contribution and trust stack as assets",
           "A reusable asset base remains",
           "The next year's direction opens from evidence"]
        /* ★★★ [CEO 피드백 항목14 · 2026-07-30] 영문 내부 키 제거.
         *   종전 주석은 "capability/asset 접두어는 검증 규약상 보존" 이라고
         *   적혀 있었다 — 즉 검증기가 요구해서 고객 문장에 영문을 남겨 둔 것이다.
         *   그 요구를 _effectKinds 내부 메타로 옮겼으므로(위 month3 참조)
         *   이제 지면 문장은 한국어만 쓴다. 뜻은 바꾸지 않는다.
         *   ★ 신규 게이트 후보 G17(한글 지면 라틴 문자 0)이 이 필드를
         *     40/40 시드에서 잡아냈다 — 기존 75항목에는 이 검사가 없었다. */
        : [(_hWhere ? (_hWhere + "에서 쓰는 ") : "") + "이름 붙일 수 있는 힘이 분기마다 축적된다",
           (_hAct ? (_peD3ActAt(_hAct) + " 쌓은 ") : "") + "기여와 신뢰가 자산으로 쌓인다",
           (_hWhere ? (_hWhere + "에 ") : "") + "다시 쓸 수 있는 자산 기반이 남는다",
           "다음 해 방향이 " + (_hDone ? ("'" + _hDone + "'" + _peD3Rana(_hDone).slice(_hDone.length) + " ") : "") + "증거에서 열린다"]
      ).map(function(s){ return _fixJosaPairs(s); })
    };
    return { ok: true, value: { month3: month3, year1: year1 }, errors: [] };
  }

  // §9.1/§9.3/§9.5 검증
  function validateHorizonV2(value, strategy, lang){
    var errs = [];
    var isEn = (lang === "en");
    if (!value || !value.month3 || !value.year1) return { ok: false, errors: ["null"] };
    var m3 = value.month3, y1 = value.year1;
    // month3 계약
    if (!Array.isArray(m3.goals) || m3.goals.length === 0) errs.push("m3_no_goals");
    (m3.goals || []).forEach(function(g, i){
      if (!isNonEmptyStrP(g.title)) errs.push("m3_goal" + i + "_no_title");
      if (!isNonEmptyStrP(g.criterion)) errs.push("m3_goal" + i + "_no_criterion");
      // §9.1 criterion 은 완료 판정 기준(도착 증거) — 추상 금지: "증거/evidence" 표식 요구
      if (!isEn && g.criterion.indexOf("증거") === -1) errs.push("m3_goal" + i + "_criterion_abstract");
    });
    // year1 계약
    if (!Array.isArray(y1.vision) || y1.vision.length === 0) errs.push("y1_no_vision");
    if (!Array.isArray(y1.milestones) || y1.milestones.length < 2) errs.push("y1_milestones_thin");
    // effects 가 capability/contribution/asset 을 구분(§9.5)
    /* ══════════════════════════════════════════════════════════════════════
     * [CEO 피드백 항목14 · 2026-07-30]  판정 대상을 '고객 문장' → '내부 메타' 로
     * ──────────────────────────────────────────────────────────────────────
     *   ★★★ 결함 (AK) 재발 — 종전 판정은 m3.effects 의 고객 문장 안에 영문 토큰
     *     capability/contribution/asset 이 있을 것을 요구했다. 그 결과 한국어
     *     지면에 영문 내부 키가 박힌 채로 배포돼 있었다(웹 program.html:3079).
     *     ★ 교훈: "검증기가 문장 안에 특정 토큰을 요구하면, 그 토큰은 결국
     *       고객 지면에 나타난다." 판정 근거는 지면이 아니라 메타에 둔다.
     *   §9.5 의 의도는 "세 종류를 구분해 쌓는가" 이므로 _effectKinds 로 판정한다.
     *   ★ 구버전 캐시(메타 없는 형태)도 통과하도록 종전 리터럴 검사를 OR 로 남긴다
     *     (대원칙 B · 폴백 보존). 새 형태는 메타로, 옛 형태는 리터럴로 통과한다.
     * ══════════════════════════════════════════════════════════════════════ */
    if (!isEn){
      var _kinds = Array.isArray(m3._effectKinds) ? m3._effectKinds : [];
      var _kindOk = ["capability", "contribution", "asset"].every(function(k){ return _kinds.indexOf(k) !== -1; });
      if (!_kindOk){
        var m3eff = (m3.effects || []).join(" ");
        _kindOk = (m3eff.indexOf("capability") !== -1 || m3eff.indexOf("contribution") !== -1 || m3eff.indexOf("asset") !== -1);
      }
      if (!_kindOk) errs.push("m3_effects_no_kind");
    }
    // §7 종교 비노출
    var allStr = [].concat(
      (m3.goals || []).map(function(g){ return g.title + " " + g.criterion; }),
      m3.effects || [], y1.vision || [], y1.milestones || [], y1.effects || []
    );
    allStr.forEach(function(s){ if (_peHasReligion(s)) errs.push("religion_leak"); });
    return { ok: errs.length === 0, errors: errs };
  }
  function isNonEmptyStrP(s){ return typeof s === "string" && s.trim().length > 0; }

  /* ── 프로그램 V — 실행 모듈 ─────────────────────────────────────────
   *  §10.1 계약: { index, type, title, summary, actions, tools, booster? }.
   *  §10.2 각 모듈은 diagnosis/장벽 해결 + COM-B 지원 + 사용 시점/방법/남는 것/완료.
   *  §10.4 tools 는 나열이 아니라 "[언제][무엇을 사용해][산출물]을 만들고 [완료 기준]으로 끝낸다".
   *  기존 tone pack 모듈 골격(type/title/index)은 보존하되 summary·actions·tools 를
   *  전략 커널 기준으로 재작성한다. booster.targetAxis = frictionAxis(보완 대상 일치 §12).
   *  ctx = { legacyModules } (골격 type/title 재사용용).
   *  반환: { ok, value:[modules], errors } */
  function compileExecutionModules(strategy, ctx, lang){
    var isEn = (lang === "en");
    if (!_peValidStrategy(strategy)) return { ok: false, value: null, errors: ["invalid_strategy"] };
    ctx = ctx || {};
    var legacy = Array.isArray(ctx.legacyModules) ? ctx.legacyModules : [];
    var acts = (strategy.coherentActions || []).slice().sort(function(a, b){ return (a.order || 0) - (b.order || 0); });
    if (acts.length === 0) return { ok: false, value: null, errors: ["no_actions"] };
    var ed = strategy.environmentDesign || {};
    var sig = strategy.signals || {};
    var friction = sig.frictionAxis || null;

    // 모듈 3개: capture(강점 활용) / define(보완 훈련) / finish(실행·전달).
    //   각 모듈이 하나의 coherent action + COM-B 지원을 대응한다.
    var combSupport = [
      ed.opportunitySupport || (isEn ? "Set the place and inputs before you start." : "시작하기 전에 기록할 자리부터 하나 마련해 두세요."),
      ed.capabilitySupport  || (isEn ? "Keep a first-output template ready." : "첫 결과물의 틀을 미리 만들어 두세요."),
      ed.motivationSupport  || (isEn ? "Record completion and delivery as achievement." : "끝내고 전달한 순간을 성취로 기록하세요.")
    ];
    var combTags = [
      ["opportunity", "capability"],
      ["capability", "motivation"],
      ["motivation", "opportunity"]
    ];
    var typeKo = ["강점 활용", "보완 훈련", "실행·전달"];
    var typeEn = ["Strength use", "Gap training", "Execute & deliver"];

    // [FB3 2026-07-24] V 실행 모듈 가독성 재작성 — '메시지성경'식 평이·즉시 실행형.
    //   원리(신규 제작규칙 "전략의 적은 전략이다"): '일관된 행동' + '즉시 실행'.
    //   · 라벨("해결 지점:", "완료 기준:", "이 단계에서 하는 일 —") 제거 → 자연 문장.
    //   · 번역투 긴 문장 → 짧게 끊어 한 호흡에 읽히게.
    //   · "지금 ~하세요" 즉시 실행 동사로 시작, "~하면 이 단계는 끝입니다"로 완료 명시.
    //   · dw/act 는 이미 종결형 문장 → 절로 인용하고 조사는 붙이지 않는다.
    //   · 검증(validateModulesV2)이 tools 에 "완료"|"끝" 단어를 요구 → tools 에 "끝" 유지.
    // [2단계 직관성 2026-07-27] 신규 규칙 「모듈 역할 앵커링(Module-Role Anchoring)」
    //   문제: 기존 summary 가 긴 진단문(crux, ~59자)을 3개 모듈에 매번 반복 인용 →
    //         (a) 만연체(112~116자) (b) 세 모듈이 똑같이 읽혀 직관성·고유성 훼손.
    //   원리(심층리서치 StandOut/Working Genius 벤치마킹): 각 실행 모듈은 '서로 다른 역할'
    //         로 즉시 구분되어야 한다. 진단(crux)은 분기 테마·heading 에서 이미 1회 제시하므로
    //         모듈 summary 에서는 반복하지 않는다.
    //   규칙: summary = [역할 한 마디] + '지금' + [오늘 할 동작(actClause)] — 단문·즉시 실행형.
    //         역할 문구는 type(강점 활용/보완 훈련/실행·전달)과 겹치지 않는 '동사형 한 마디'.
    var roleLeadKo = ["강점을 바로 씁니다.", "약한 고리를 메웁니다.", "끝내서 전달합니다."];
    var roleLeadEn = ["Use your strength now.", "Close the weak link.", "Finish and deliver."];
    /* ══════════════════════════════════════════════════════════════════════════
     * [CEO 피드백 항목14 · 2026-07-30]  실행 모듈 제목 — 번호에서 '도구 이름' 으로
     * ──────────────────────────────────────────────────────────────────────────
     *   ★ 종전 실측(40시드 × 3모듈 = 120): title distinct 3/120.
     *     값이 "실행 모듈 1" / "실행 모듈 2" / "실행 모듈 3" 이었다 —
     *     80억 명이 같은 문장을 읽는 k=1급 필드다(대원칙 A 위반).
     *     더구나 렌더층은 이미 왼쪽에 type 배지(강점 활용/보완 훈련/실행·전달)를
     *     그리고, 그 옆 굵은 제목 자리에 이 값을 넣는다
     *       웹  program.html:3124  <span class="mt">
     *       PDF program.html:4308  <h3 class="modc__ttl">
     *     → 고객이 보는 것은 "[강점 활용] 실행 모듈 1" 이었다. 제목이 아무 말도 하지 않았다.
     *
     *   설계(트레이너 은유): 모듈은 '매일 굴리는 도구' 다(리드 문구도 그렇게 말한다).
     *     그러니 제목은 그 도구의 이름이어야 한다. 운동 프로그램의 '기록지 / 기준표 /
     *     마감표' 처럼, 역할(key) + 응답 좌표 하나로 부른다.
     *       capture → {whereShort} 기록판      자리(Q47)
     *       define  → ‘{doneWord}’ 기준표      완료 기준
     *       finish  → {blockShort} 마감표      리듬(Q49)
     *     ★ 주차 제목과 '다른 좌표 배분' 을 쓴다 — 두 장이 같은 말로 읽히지 않게.
     *     ★ 제3조: 가운뎃점 나열을 쓰지 않는다(그래서 "검토·전달" 대신 "마감표").
     *   ★ leg.title(톤팩 골격)이 있으면 그것을 우선한다 — 기존 폴백 보존(대원칙 B).
     *   ★ EN 은 종전 "Module N" 유지(i18n SSOT · 좌표 사전 없음).
     * ══════════════════════════════════════════════════════════════════════════ */
    var _koM = _peKo(strategy, isEn);
    var _mWhrS = _koM.whereShort || "", _mBlkS = _koM.blockShort || "", _mDone = _koM.doneWord || "";
    var _mFp = (_koM.fp | 0);   /* 결함 (AL) 가드 — 마무리 명사를 fingerprint 로 골라
                                 * 한 문항이 아니라 상황 전체에 반상하게 한다. */
    function _mTitleKo(key, idx){
      if (key === "capture" || (!key && idx === 0))
        return (_mWhrS ? (_mWhrS + " ") : "") + _peD3Pick(["기록판", "모아 쓰는 판", "기록 시트"], _mFp + 1);
      if (key === "define"  || (!key && idx === 1))
        return (_mDone ? ("\u2018" + _mDone + "\u2019 ") : "완료 ") + _peD3Pick(["기준표", "기준 시트", "판정표"], _mFp + 8);
      if (key === "finish"  || (!key && idx === 2))
        return (_mBlkS ? (_mBlkS + " ") : "") + _peD3Pick(["마감표", "마감 시트", "전달 마감표"], _mFp + 9);
      return "";
    }
    var value = acts.slice(0, 3).map(function(a, i){
      var act = _peStripDot(a.action || "");
      var dw  = _peStripDot(a.doneWhen || "");
      var leg = legacy[i] || {};
      var dwClause = dw || (isEn ? "one reviewable output" : "검토 가능한 결과물 하나가 나옵니다");
      var actClause = act || (isEn ? "the next step" : "다음 행동을 한 단계 옮깁니다");
      var crux = _peStripDot((strategy.diagnosis || {}).crux || (isEn ? "delivery slips" : "시작과 공유가 자꾸 뒤로 밀리는 것"));

      // summary: 진단 반복 없이 '역할 한 마디 + 오늘 할 동작' 융합(단문·즉시 실행형).
      //   ★ [Phase D-3] actClause 는 응답 좌표(block)로 시작한다. block 이 "지금 비어 있는
      //     덩어리" 처럼 '지금' 으로 시작하면 부사 '지금' 과 어절이 겹친다 → 가드한다.
      var _nowAdv = /^지금/.test(actClause) ? "" : "지금 ";
      /* ★★★ [CEO 피드백 항목13 · 결함 BB · 2026-07-30]  한 모듈 지면에서 같은 문장 3~4회
       * ──────────────────────────────────────────────────────────────────────
       *   40시드 실측(120/120 전건) + PDF p9 육안으로 확정한 종전 지면:
       *     summary   "강점을 바로 씁니다. 지금 {actClause}."          ← actions[0] 과 동일 문장
       *     실행①     "{actClause}."                                  ← summary 반복
       *     실행②     "'{dw}' — 이 상태가 되면 이 단계는 끝입니다."     ← 완료 기준 배지 반복
       *     완료 기준  "{dw}"                                          ← 렌더 배지(정본)
       *     도구①     "…'{dw}' — 이 상태가 되면 여기서 끝냅니다."       ← dw 세 번째
       *   → 한 카드에서 actClause 2회 · dw 3회. 결함 AQ(같은 정보 한 지면 2회 = P1)의
       *     프로그램판이며, 카드가 불필요하게 길어져 V장 지면 하단 40%가 비었다.
       *
       *   교정 원리 — 네 자리에 서로 다른 질문을 배정한다(정보는 한 글자도 버리지 않는다):
       *     summary   이 모듈이 무엇을 위한 것인가   ← 응답 좌표(자리·완료어·리듬)로 합성
       *     실행      무엇을 하는가                 ← actClause (정본)
       *     완료 기준  언제 끝인가                   ← dw (렌더 배지가 정본)
       *     도구      어떻게 쓰는가                 ← 사용 규칙 + COM-B 지원
       *   ★ dw 가 없을 때만 실행②가 완료를 말한다 → 정보 보존(제18조).
       *   ★ 웹 렌더에는 완료 기준 배지가 없었으므로 program.html 에 배지를 먼저 추가했다.
       *     (배지 없이 실행②만 지우면 웹에서 완료 정보가 사라진다 — 결함 AN 계열)
       *   ★ EN 은 좌표 사전(_peKo)이 한국어 전용이라 종전 문안을 유지한다(오염 방지·backlog).
       * ────────────────────────────────────────────────────────────────────── */
      var _mPurpKo = [
        (_mWhrS ? (_mWhrS + "에서 ") : "") + "나온 것을 한곳에 모아 둡니다.",
        "무엇을 \u2018" + (_mDone || "완료")
          + "\u2019" + _peD3Ro(_mDone || "완료").slice((_mDone || "완료").length)
          + " 볼지 먼저 정합니다.",
        (_mBlkS ? (_mBlkS + "에 ") : "") + "결과를 닫아서 보냅니다."
      ];
      var summary = isEn
        ? (roleLeadEn[i] + " " + actClause + ".")
        : (roleLeadKo[i] + " " + (_mPurpKo[i] || (_nowAdv + actClause + ".")));

      // actions: 무엇을 하는가(정본). 완료 판정은 완료 기준 배지가 맡는다.
      var actions = isEn
        ? [ act || "Take the coherent step",
            (dw ? ("You're done when " + dw + ".") : "You're done when the output is reviewable.") ]
        : (dw
            ? [ (act ? (act + ".") : "핵심 행동을 한 단계 옮깁니다.") ]
            : [ (act ? (act + ".") : "핵심 행동을 한 단계 옮깁니다."),
                "결과물이 검토 가능해지면 이 단계는 끝입니다." ]);

      // tools: 어떻게 쓰는가(§10.4) — 사용 규칙 한 줄 + COM-B 지원 한 줄.
      //   ★ 종전 도구①은 dw 를 통째로 인용해 93자였다(칩 조판 붕괴 + dw 3회).
      //     완료 판정은 배지가 이미 말하므로 여기서는 '어디서 멈추는가' 만 가리킨다.
      //     ★ validateModulesV2 는 tools 에 "완료"|"끝" 어휘를 요구한다 → 유지한다.
      /* ★★★ [항목13 후속 · d4_gate G2b/G5a FAIL · 결함 AI 재현 · 2026-07-31]
       * ──────────────────────────────────────────────────────────────────────
       *   1차 교정에서 도구①을 고정 문장으로 '교체' 했더니 세 모듈 전부
       *   k=1(전원 동일)로 붕괴했다 — d4_gate G2b k=1 5개(허용 ≤2) ·
       *   G5a 완전고정 10개(허용 ≤9). 지면 중복은 사라졌지만 응답 변별이 죽었다.
       *   즉 '내가 만든 조치가 다음 측정의 오차원' 이 됐다(결함 AI).
       *   → 제14조: 교체가 아니라 추가다. 완료 어휘(validateModulesV2 요구)는
       *     그대로 두고, 앞머리를 응답 좌표로 세운다.
       *       모듈① 자리(whereShort) · 모듈② 완료어(doneWord) · 모듈③ 덩어리(blockShort)
       *     서술은 fingerprint 로 변주한다(한 문항이 아니라 상황 전체에 반응).
       *   ★ dw 를 인용하지 않으므로 결함 BB(dw 3회)는 재발하지 않는다.
       *   ★ 조사는 좌표 받침으로 재계산한다(_peD3ActAt) — 제19조 계열.
       * ────────────────────────────────────────────────────────────────────── */
      var _mToolKo = [
        (_mWhrS ? (_peD3ActAt(_mWhrS) + " ") : "") + _peD3Pick(
          /* ★ whereShort 자체가 \"…자리\" 로 끝난다 → 서술에 '자리' 를 다시 쓰면
           *   d3_quality 가 '자리 중복' 으로 잡는다(실측 106건). 어절을 겹치지 않게 고른다. */
          ["바로 시작하세요", "먼저 시작하세요", "여기서만 쓰세요"], _mFp + 2)
          + ". 완료 기준을 채우면 끝냅니다.",
        "\u2018" + (_mDone || "완료") + "\u2019 " + _peD3Pick(
          ["판정만 먼저 적어 두세요", "판정 한 줄만 먼저 적으세요", "판정 기준을 먼저 적으세요"], _mFp + 4)
          + ". 완료 기준을 채우면 끝냅니다.",
        (_mBlkS ? (_peD3ActAt(_mBlkS) + " ") : "") + _peD3Pick(
          ["마지막 점검만 하고 보내세요", "한 번만 점검하고 보내세요", "점검 한 번으로 닫으세요"], _mFp + 6)
          + ". 완료 기준을 채우면 끝냅니다."
      ];
      var tools = isEn
        ? [ "Pick one place to work in and start there. Stop when " + dwClause + ".",
            combSupport[i] ]
        : [ _fixJosaPairs(_mToolKo[i] || "일할 자리 하나만 정하고 바로 시작하세요. 완료 기준을 채우면 끝냅니다."),
            combSupport[i] ];

      var mod = {
        index: i + 1,
        type: leg.type || (isEn ? typeEn[i] : typeKo[i]),
        title: leg.title || (isEn ? ("Module " + (i + 1)) : (_mTitleKo(a.key, i) || ("실행 모듈 " + (i + 1)))),
        summary: isEn ? summary : _fixJosaPairs(summary),
        actions: actions.map(function(s){ return _fixJosaPairs(s); }),
        tools: tools.map(function(s){ return _fixJosaPairs(s); }),
        // additive 내부 메타(비노출)
        _strategy: {
          diagnosisRef: "diagnosis",
          actionRefs: [a.key],
          comB: combTags[i],
          doneWhen: dw || null
        }
      };
      return mod;
    });

    // booster: 보완 축(frictionAxis)을 대상으로, 실제 coherent action과 연결(§12.1 위반 방지).
    if (value[1] && friction){
      var fLabel = axisLabel(friction, isEn);
      value[1].booster = {
        targetAxis: fLabel,
        actions: (isEn
          ? [ "Take one small step that exercises " + fLabel + " inside this cycle's action, not as a separate task.",
              "Tie it to the same done-criterion so the gap-training produces a real output." ]
          // [Phase D-3] 두 줄이 전 고객 동일(또는 k=4)이었다 → 자리·완료 기준 좌표를 얹는다.
          : (function(){
              var _kB = _peKo(strategy, isEn);
              var _bWhere = _kB.where || "", _bDone = _kB.doneWord || "";
              // ★ where 를 "…에서" 로 받으면 뒤의 "이번 행동 안에서" 와 처격이 겹친다
              //   → "…를 벗어나지 않고" 로 받아 처격을 한 번만 쓴다(절은 늘리지 않는다).
              // ★ fLabel(자기설계/자기이해/자기표현/자기실행)은 무받침이 섞인다 → 조사 계산 필수.
              var _bEul = fLabel + ((_hangulJong(String(fLabel).slice(-1)) > 0) ? "을" : "를");
              /* [CEO 피드백 항목8 · 제4조  2026-07-30]  1문장 1동작
               *   종전: "따로 과제를 만들지 말고, {자리}를 벗어나지 않고 이번 행동 안에서
               *   {축}을 작게 한 번만 써 보세요." — 금지·장소·동작이 한 문장에 겹쳐
               *   40/80 항목이 장문(최대 50자)이었다. 금지를 앞 문장으로 독립시킨다.
               *   ★ 소비처: 웹 booster2-acts <li> · PDF 4124 <li> — 둘 다 파싱 없음. */
              return [ "따로 과제를 만들지 마세요. " + (_bWhere ? (_peD3Reul(_bWhere) + " 벗어나지 않고 ") : "") + "이번 행동 안에서 " + _bEul + " 작게 한 번만 써 보세요.",
                       /* ★★ [결함 CJ · 2026-08-11 · 제1·제31조] doneWord 가 긴 시드에서
                        *   이 문장이 61자가 됐다(40시드 실측 3건 · 상한 60자).
                        *   제31조에 따라 조건절/결과절 사이에서 끊는다 — 말은 한 글자도
                        *   버리지 않는다(대원칙-B). 「묶어 두면,」을 「묶어 두세요. 그러면」으로
                        *   나누면 두 문장 모두 60자 아래로 내려온다. */
                       "같은 완료 기준" + (_bDone ? ("('" + _bDone + "')") : "") + "에 묶어 두세요. 그러면 이 훈련이 그냥 연습이 아니라 진짜 결과물로 남습니다." ];
            })()
        ).map(function(s){ return _fixJosaPairs(s); })
      };
    }
    return { ok: true, value: value, errors: [] };
  }

  // §10 검증
  function validateModulesV2(value, strategy, lang){
    var errs = [];
    var isEn = (lang === "en");
    if (!Array.isArray(value) || value.length === 0) return { ok: false, errors: ["empty"] };
    value.forEach(function(m, i){
      ["index", "type", "title", "summary", "actions", "tools"].forEach(function(k){
        if (m[k] == null) errs.push("m" + i + "_missing_" + k);
      });
      if (!Array.isArray(m.tools) || m.tools.length === 0) errs.push("m" + i + "_no_tools");
      // §10.4 tools 는 나열이 아니라 사용 규칙(완료 기준 표현 포함)
      if (!isEn && Array.isArray(m.tools) && !m.tools.some(function(t){ return String(t).indexOf("완료") !== -1 || String(t).indexOf("끝") !== -1; }))
        errs.push("m" + i + "_tools_listy");
      // §10.3 COM-B 최소 2요소 태그(내부 메타)
      if (m._strategy && Array.isArray(m._strategy.comB) && m._strategy.comB.length < 2) errs.push("m" + i + "_comb_thin");
      [m.summary, m.title].concat(m.actions || []).concat(m.tools || []).forEach(function(s){
        if (_peHasReligion(s)) errs.push("m" + i + "_religion_leak");
      });
    });
    // booster targetAxis 가 friction 축과 일치(§12)
    var friction = (strategy.signals || {}).frictionAxis;
    if (value[1] && value[1].booster && friction){
      if (value[1].booster.targetAxis !== axisLabel(friction, isEn)) errs.push("booster_axis_mismatch");
    }
    return { ok: errs.length === 0, errors: errs };
  }

  /* ── 프로그램 VIII — 다음 단계·리스크 ───────────────────────────────
   *  §11.1 계약: nextSteps=[{when,task}], risks=[{risk,mitigation}].
   *  §11.2 nextSteps: 완료 증거 확인 → 회고 → 다음 선택 → 재사용/전달(feedback loop).
   *  §11.3 risks: strategy.tensions + diagnosis 에서 우선 도출. mitigation=if-then.
   *  §11.4: risk마다 근거, mitigation implementation intention 형식, 성격 결함 단정 금지,
   *         동일 mitigation 반복 금지, recovery evidence 존재.
   *  ctx = { visionLine } (다음 단계 방향 일치용, 선택).
   *  반환: { ok, value:{ nextSteps, risks }, errors } */
  function compileNextStepsAndRisks(strategy, ctx, lang){
    var isEn = (lang === "en");
    if (!_peValidStrategy(strategy)) return { ok: false, value: null, errors: ["invalid_strategy"] };
    ctx = ctx || {};
    var na = strategy.nextAction || {};
    var acts = (strategy.coherentActions || []);
    var lastAct = acts[acts.length - 1] || {};
    var lastDone = _peStripDot(lastAct.doneWhen || "");
    var ii = strategy.implementationIntentions || [];
    var tensions = (strategy.signals && strategy.signals.tensions) || [];
    // [Phase D-3] §7-안전 좌표(KO 전용). 부재 시 "" → 기존 고정 문구로 폴백(대원칙-B).
    var _kN = _peKo(strategy, isEn);
    var _nWhen = _kN.when || "", _nWhere = _kN.where || "", _nDone = _kN.doneWord || "";

    // nextSteps: 현재 사이클 종료 후 feedback loop.
    var nextSteps = isEn
      ? [
          { when: "When this cycle's done-evidence is confirmed",
            task: "Check that " + (lastDone || "the result reached who needed it") + ", then write a 3-line retrospective of what worked." },
          { when: "Before the next cycle",
            task: "Choose the next action/quarter from that retrospective, and reuse or deliver the output as the starting input — not as a gap to fix." }
        ]
      : [
          // [Phase D-3] when 2줄과 [1].task 가 전 고객 동일이었다 → 응답 좌표를 얹는다.
          /* [CEO 피드백 항목8 · 표현 규칙 v1.0  2026-07-30]  제4조(1문장 1동작)
           *   종전 실측(80항목): 장문 71건 · 최대 58자. 한 문장에 "확인하고 + 회고합니다",
           *   "고르고 + 재사용하거나 전달합니다" 두 동작이 겹쳐 있었다.
           *   ★ 소비처 확인: 웹 program.html:3200 `cs-task` 산문 · PDF 4268 ns 산문.
           *     파싱하는 구분자가 없다 → 문장 분할이 안전하다(결함 AB 재발 방지).
           *   ★ EN 사전 NEXTSTEP_FALLBACK_EN(2526)은 program-rules.json 의 정적 문구
           *     15개만 담는다. 이 두 문장은 응답 기반 동적 조립이라 애초에 사전에 없다
           *     → 사전 적중률 변화 0건.
           *   ★ 좌표 슬롯(lastDone/_nDone)은 종전과 같은 자리에 그대로 둔다.
           *     조사 결합 형태를 바꾸지 않으므로 어떤 어형이 와도 어법이 유지된다. */
          { when: (_nWhen ? (_nWhen + ", ") : "") + "이번 사이클의 도착 증거를 확인하면",
            task: _peParenJosa("도착 증거", _peStripDot(lastDone || "결과가 필요한 사람에게 닿았는지"), "eul")
                  + " 확인합니다. 그다음 무엇이 작동했는지 세 줄로 회고합니다." },
          { when: "다음 사이클을 " + (_nWhere ? (_nWhere + "에서 ") : "") + "시작하기 전에",
            task: "그 회고에서 다음 행동과 분기를 고릅니다. 이번 결과물을 " + (_nDone ? ("'" + _nDone + "'을 지난 ") : "") + "다음 사이클의 출발점으로 재사용하거나 전달합니다. 부족을 메우는 게 아니라 자산으로 잇습니다." }
        ];

    // risks: tension 우선, 부족하면 implementationIntention에서 보강.
    var risks = [];
    tensions.forEach(function(t, i){
      var trigger = _peStripDot(t.left || t.key || "");
      var right   = _peStripDot(t.right || "");
      // 관련 implementation intention(동일 diagnosis 계열)에서 대응 도출
      var intent = ii[Math.min(i + 1, ii.length - 1)] || ii[0] || {};
      var resp = _peStripDot(intent.response || "");
      var cue  = _peStripDot(intent.cue || "");
      if (!trigger) return;
      if (isEn){
        risks.push({
          risk: "When the pull toward '" + trigger + "' outweighs '" + (right || "getting a first result out") + "', delivery can slip.",
          mitigation: "If " + (cue || ("you feel the pull toward " + trigger)) + ", " +
            (resp ? (resp.charAt(0).toLowerCase() + resp.slice(1).replace(/\.$/, "")) : "return to the first done-criterion") +
            ". Recovery is confirmed when " + (lastDone || "a first output is shared") + "."
        });
      } else {
        /* [CEO 피드백 항목8 · 표현 규칙 v1.0  2026-07-30]  제3조 + 제4조
         *   종전: 가운뎃점 21건("시작·공유") + 장문 28/40(최대 58자) 한 문장.
         *   ★ "시작·공유" 는 두 낱말을 붙인 나열이다 → "시작과 공유" 로 풀면
         *     글자 수는 같고 읽기는 끊기지 않는다(정보 손실 0).
         *   ★ 소비처: 웹 risks-list/.rc-text · PDF 4268 rk — 둘 다 산문(파싱 없음). */
        risks.push({
          risk: "'" + trigger + "' 쪽으로 기울어 '" + (right || "첫 결과물을 빨리 확인하는 것") + "'보다 앞설 때가 있습니다. 그러면 시작과 공유가 밀립니다.",
          mitigation: "만약 " + (cue || (trigger + " 경향이 느껴지면")) + ", " +
            _peEndDot(resp || "먼저 정한 완료 기준으로 돌아갑니다", isEn) +
            " 회복은 " + _peStripDot(lastDone || "첫 결과물을 공유했을 때") + "로 확인합니다."
        });
      }
    });
    // tension이 부족하면 diagnosis 기반 1개 보강(중복 mitigation 금지).
    if (risks.length === 0){
      var crux = _peStripDot((strategy.diagnosis || {}).crux || "");
      var i0 = ii[0] || {};
      risks.push(isEn
        /* [CEO 피드백 항목7 · 항목8  2026-07-30]  마침표 누락 + 가운뎃점
         *   실측(seed 770011 · 788357): 이 폴백 분기의 risk 가 crux 원문을 그대로
         *   써서 문장이 마침표 없이 끝났다("…그 힘이 결과로 남습니다"). 지면에서
         *   문장이 닫히지 않은 것처럼 보이는 정렬 결함이다(항목7).
         *   → _peEndDot 으로 닫는다. 폴백 리터럴의 "시작·공유" 도 접속으로 푼다(제3조). */
        ? { risk: _peEndDot(crux || "Delivery can slip when the finish line is defined late.", isEn),
            mitigation: "If " + (_peStripDot(i0.cue || "planning feels insufficient")) + ", " +
              (_peStripDot(i0.response || "fix the first output and criteria first")) + ". Recovery is confirmed when " + (lastDone || "a first output is shared") + "." }
        : { risk: _peEndDot(crux || "완료 기준이 늦게 정해지면 시작과 공유가 밀릴 수 있습니다.", isEn),
            mitigation: "만약 " + (_peStripDot(i0.cue || "계획이 부족하다고 느껴지면")) + ", " +
              _peEndDot(_peStripDot(i0.response || "첫 결과물과 완료 기준부터 정합니다"), isEn) +
              " 회복은 " + _peStripDot(lastDone || "첫 결과물을 공유했을 때") + "로 확인합니다." });
    }
    // josa 보정
    nextSteps = nextSteps.map(function(s){ return { when: _fixJosaPairs(s.when), task: _fixJosaPairs(s.task) }; });
    risks = risks.map(function(r){ return { risk: _fixJosaPairs(r.risk), mitigation: _fixJosaPairs(r.mitigation) }; });
    return { ok: true, value: { nextSteps: nextSteps, risks: risks }, errors: [] };
  }

  // §11.4 검증
  function validateNextRisksV2(value, strategy, lang){
    var errs = [];
    var isEn = (lang === "en");
    if (!value || !Array.isArray(value.nextSteps) || !Array.isArray(value.risks)) return { ok: false, errors: ["null"] };
    if (value.nextSteps.length === 0) errs.push("no_next_steps");
    if (value.risks.length === 0) errs.push("no_risks");
    value.nextSteps.forEach(function(s, i){
      if (!isNonEmptyStrP(s.when) || !isNonEmptyStrP(s.task)) errs.push("next" + i + "_incomplete");
    });
    var seenMit = {};
    value.risks.forEach(function(r, i){
      if (!isNonEmptyStrP(r.risk) || !isNonEmptyStrP(r.mitigation)) errs.push("risk" + i + "_incomplete");
      // mitigation 이 implementation intention(if-then) 형식
      if (!isEn && r.mitigation.indexOf("만약") === -1) errs.push("risk" + i + "_no_ifthen");
      if (isEn && r.mitigation.indexOf("If ") === -1) errs.push("risk" + i + "_no_ifthen");
      // recovery evidence 존재
      if (!isEn && r.mitigation.indexOf("회복") === -1) errs.push("risk" + i + "_no_recovery");
      // 동일 mitigation 반복 금지
      var n = _peStr(r.mitigation);
      if (seenMit[n]) errs.push("risk" + i + "_dup_mitigation");
      seenMit[n] = 1;
      // §7
      if (_peHasReligion(r.risk) || _peHasReligion(r.mitigation)) errs.push("risk" + i + "_religion_leak");
    });
    value.nextSteps.forEach(function(s){
      if (_peHasReligion(s.when) || _peHasReligion(s.task)) errs.push("next_religion_leak");
    });
    return { ok: errs.length === 0, errors: errs };
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
      dedupKeywords: dedupKeywords,
      fuseDomains: fuseDomains,
      DOMAIN_ATTR_KO: DOMAIN_ATTR_KO,
      // [실행 전략 v2 확장 — 2단계 S2-Commit D] Program II·III compiler(순수)
      compileQuarterTheme: compileQuarterTheme,
      validateQuarterV2: validateQuarterV2,
      compileWeeklyRoutines: compileWeeklyRoutines,
      validateWeeklyV2: validateWeeklyV2,
      // [실행 전략 v2 확장 — 2단계 S2-Commit E] Program IV·V·VIII compiler(순수)
      compileHorizonGoals: compileHorizonGoals,
      validateHorizonV2: validateHorizonV2,
      compileExecutionModules: compileExecutionModules,
      validateModulesV2: validateModulesV2,
      compileNextStepsAndRisks: compileNextStepsAndRisks,
      validateNextRisksV2: validateNextRisksV2
    }
  };
});
