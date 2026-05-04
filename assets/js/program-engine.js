/* program-engine.js — 인생포트폴리오 → 맞춤 실행 프로그램 변환 엔진
 * 입력: { report (ReportEngine.build 결과), rules (program-rules.json), name }
 * 출력: 맞춤 실행 프로그램 객체 (7섹션 + 분기 테마/주차 루틴/3개월 목표/1년 비전/모듈/추적/리스크)
 *
 * 규칙 근거:
 *   - 제작 규칙서(맞춤 실행 프로그램) V2.3
 *   - 김영식님 샘플 (warm_connector) 구조
 */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.ProgramEngine = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var VERSION = "v1.0";

  function pad(n){ return n < 10 ? "0"+n : ""+n; }
  function fmtDate(d){
    if (!d) d = new Date();
    return d.getFullYear() + "." + pad(d.getMonth()+1) + "." + pad(d.getDate());
  }
  function safe(x, fb){ return (x === undefined || x === null || x === "") ? fb : x; }
  function clone(o){ try { return JSON.parse(JSON.stringify(o)); } catch(e) { return o; } }

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
    var ax = (report && (report.axes || report.axisPct || {})) || {};
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

  // 본질(요약) 한 줄
  function essenceLine(report){
    var keys = ["self_understanding","self_expression","self_design","self_execution"];
    var parts = [];
    for (var i = 0; i < keys.length; i++){
      var c = (report && report[keys[i]]) || (report && report.cards && report.cards[keys[i]]);
      if (c && c.core) parts.push(String(c.core).split(/[.。]/)[0]);
    }
    return parts.slice(0,2).join(" · ");
  }

  // 문자열 치환 — {{name}}, {{tone}}
  function tpl(s, vars){
    if (typeof s !== "string") return s;
    return s.replace(/\{\{(\w+)\}\}/g, function(_, k){ return (vars[k] != null) ? vars[k] : ""; });
  }
  function tplArr(arr, vars){
    if (!Array.isArray(arr)) return [];
    return arr.map(function(s){ return tpl(s, vars); });
  }

  /* ========================================================================
   *  메인 빌더
   * ====================================================================== */
  function build(opts) {
    opts = opts || {};
    var report = opts.report || {};
    var rules  = opts.rules  || {};
    var name   = safe(opts.name || (report.profile && report.profile.name) || report.name, "고객");
    var publishedAt = opts.publishedAt || new Date();

    var toneKey = pickTone(report);
    var tonePack = (rules.tones && rules.tones[toneKey]) || (rules.tones && rules.tones[TONE_FALLBACK]) || {};
    var axes  = pickAxes(report);
    var sw    = findStrongWeak(axes);
    var allKw = pickAllKeywords(report);
    var ess   = essenceLine(report);
    var vars  = { name: name, tone: tonePack.label || toneKey };

    /* ------------------------------------------------------------------
     * §1 표지 및 전체 요약
     * ------------------------------------------------------------------ */
    var coverSummary = {
      title: (rules.format && rules.format.title) || "📘 인생포트폴리오 맞춤 실행 프로그램",
      subtitle: tpl((rules.format && rules.format.subtitleTpl) || "{{name}}님을 위한 성장 & 실행 전략 안내서", vars),
      service: (rules.format && rules.format.service) || "인생포트폴리오",
      publishedAt: fmtDate(publishedAt),
      typeLine: name + "님의 유형 — " + (tonePack.label || toneKey) + (tonePack.tagline ? (" · " + tonePack.tagline) : ""),
      quote: "“이 실행 프로그램은 " + name + "님의 인생포트폴리오 검사 결과를 기반으로, " +
             (ess || "자기다움의 결을 따라 길을 잇는 흐름") + "에게 최적화된 실행 로드맵입니다.”",
      summary: {
        traits:   "성향: " + (tonePack.label || toneKey) + " — " + (tonePack.tagline || ""),
        strengths:"강점: " + axisLabel(sw.strong) + " 축 (" + Math.round(axes[sw.strong]) + "%) 중심으로 자기다움이 또렷합니다.",
        gaps:     "보완점: " + axisLabel(sw.weak) + " 축 (" + Math.round(axes[sw.weak]) + "%) 영역을 작은 루틴으로 강화합니다.",
        env:      "적합 환경: " + envByTone(toneKey),
        newPaths: "신규 가능성: " + ((tonePack.newPaths || []).slice(0,4).join(" · ") || "관련 분야 1인 브랜드 / 사이드 프로젝트")
      },
      arrowLine: "👉 실행 프로그램은 " + arrowByTone(toneKey) + " 루틴으로 설계됩니다."
    };

    /* ------------------------------------------------------------------
     * §2 맞춤 실행 프로그램 (3주 / 3개월 / 1년)
     *      각 단계: 실행 안내 / 실행 방법 / 실행 효과(4 포인트 명사형)
     * ------------------------------------------------------------------ */
    var weeks = (tonePack.weeks || []).map(function(w, i){
      return {
        week: i+1,
        title: w.title,
        guide:  guideOfWeek(toneKey, i),
        actions: tplArr(w.actions || [], vars),
        effects: effectsOfWeek(toneKey, i)   // 4 포인트 명사형
      };
    });
    var month3 = {
      guide: "이번 분기 ‘실제로 자리 잡혀야 하는 3가지 결과’를 정합니다.",
      goals: (tonePack.month3Goals || []).map(function(g){ return { title: g.title, criterion: g.criterion }; }),
      effects: ["분기 결과 가시화", "핵심 루틴 정착", "자기다움 자산화", "다음 분기 발판 형성"]
    };
    var year1 = {
      guide: "1년 후 도달할 모습을 비전 한 문장과 마일스톤 3개로 묶어 둡니다.",
      vision: tplArr((tonePack.year1 && tonePack.year1.vision) || [], vars),
      milestones: tplArr((tonePack.year1 && tonePack.year1.milestones) || [], vars),
      effects: ["장기 비전 명문화", "분기 사이클 완수", "신뢰·평판 자산화", "다음 1년 새 비전 도출"]
    };

    /* ------------------------------------------------------------------
     * §3 실행 모듈 카드 (TOP3 추천 모듈)
     *      구분: 강점 활용 / 보완 훈련 / 핵심 전략 / 추천 도구 2~3개
     * ------------------------------------------------------------------ */
    var modules = (tonePack.modules || []).map(function(m, i){
      var type = (i === 0) ? "강점 활용" : (i === 1) ? "보완 훈련" : "핵심 전략";
      return {
        index: i+1,
        type: type,
        title: m.title,
        summary: m.summary,
        actions: m.actions || [],
        tools: toolsOfTone(toneKey, i)
      };
    });

    // 약축 부스터 1개를 보완 훈련에 보강
    var boosterAxis = sw.weak;
    var booster = (rules.weakAxisBoosters && rules.weakAxisBoosters[boosterAxis]) || [];
    if (modules[1] && booster.length){
      modules[1].booster = {
        targetAxis: axisLabel(boosterAxis),
        actions: booster
      };
    }

    /* ------------------------------------------------------------------
     * §4 성과 추적 보드 (1주차 예시 + 월간 항목)
     *      열: 주차 / 실행 과제 / 완료(Y/N) / 성찰 메모
     * ------------------------------------------------------------------ */
    var board = {
      columns: ["주차", "실행 과제", "완료(Y/N)", "성찰 메모"],
      rowsExample: (tonePack.trackBoardWeekly || []).map(function(t, i){
        return { week: "1주차", task: t, done: "", memo: "" };
      }),
      monthly: tonePack.trackBoardMonthly || [],
      hint: "이 표는 1주차 예시입니다. " + name + "님은 매주 동일한 방식으로 기록하며 ‘기록 → 회고 → 다음 결정’의 루프를 완성합니다."
    };

    /* ------------------------------------------------------------------
     * §5 기대 효과 ✨ (4줄 + 신규 직업/사업 가능성 3~4개)
     * ------------------------------------------------------------------ */
    var effects = {
      fitJob:    "직무 적합성: " + ((tonePack.effects && tonePack.effects.fitJob) || "관련 분야 직무 적합성 강화"),
      expansion: "직업 확장성: " + ((tonePack.effects && tonePack.effects.expansion) || "자기다움 기반 1인 브랜드 / 사이드 프로젝트 확장"),
      career:    "경력 성장: "   + ((tonePack.effects && tonePack.effects.career)    || "자기 자산을 결과로 누적"),
      vision:    "인생 설계 비전: " + ((tonePack.effects && tonePack.effects.vision)    || "“자기다움이 곧 영향력이 되는 사람”"),
      newPaths:  (tonePack.newPaths || []).slice(0, 4)
    };

    /* ------------------------------------------------------------------
     * §6 다음 단계 제안 (1개월 / 3개월 / 1년 — 시점 + 실행과제)
     * ------------------------------------------------------------------ */
    var nextSteps = [
      { when: "1개월 후",  task: tpl((tonePack.nextSteps && tonePack.nextSteps.m1) || "핵심 루틴 1개 시작", vars) },
      { when: "3개월 후",  task: tpl((tonePack.nextSteps && tonePack.nextSteps.m3) || "분기 핵심 결과 1개 확보", vars) },
      { when: "1년 후",    task: tpl((tonePack.nextSteps && tonePack.nextSteps.y1) || "1년 비전 마일스톤 달성", vars) }
    ];

    /* ------------------------------------------------------------------
     * §7 안내 문구 + 마무리 문장 + 리스크/보완
     * ------------------------------------------------------------------ */
    var footerLines = ((rules.footerNotice && rules.footerNotice.lines) || [])
      .map(function(s){ return tpl(s, vars); });
    var qualityChecklist = (rules.footerNotice && rules.footerNotice.qualityChecklist) || [];

    var risks = tonePack.risks || [];
    var closing = tplArr(tonePack.closing || [], vars);

    /* ------------------------------------------------------------------
     * 분기 테마(상단 인상) — 김영식 샘플의 첫 페이지 구성을 그대로 채용
     * ------------------------------------------------------------------ */
    var quarter = {
      icon: "🧭",
      title: "분기 테마",
      heading: tonePack.quarterTheme || "이번 분기 테마",
      paragraphs: tplArr(tonePack.quarterLeadParas || [], vars)
    };

    /* ------------------------------------------------------------------
     * 최종 문서
     * ------------------------------------------------------------------ */
    return {
      meta: {
        engine: "ProgramEngine",
        version: VERSION,
        spec: rules.spec || "맞춤 실행 프로그램 V2.3",
        generatedAt: new Date().toISOString(),
        publishedAt: fmtDate(publishedAt),
        name: name,
        toneKey: toneKey,
        toneLabel: tonePack.label || toneKey,
        sourceReportSid: opts.sourceSid || null,
        axes: axes,
        strongAxis: sw.strong,
        weakAxis: sw.weak,
        keywords: dedupKeywords(allKw).slice(0, 8)
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
      }
    };
  }

  /* ========================================================================
   *  helpers
   * ====================================================================== */
  function axisLabel(k){
    return ({
      self_understanding: "자기이해",
      self_expression:    "자기표현",
      self_design:        "자기설계",
      self_execution:     "자기실행"
    })[k] || k;
  }

  function envByTone(t){
    return ({
      principled_designer: "원칙·기준이 존중받는 환경, 자율적 사색·설계 시간이 확보되는 자리",
      warm_connector:      "사람 중심의 따뜻한 분위기, 1:1 깊은 대화가 가능한 환경",
      visionary_creator:   "발행·실험이 빠르게 굴러가는 환경, 자율 창작 시간이 보장되는 자리",
      pragmatic_achiever:  "성과 지표가 분명하고 실행 권한이 주어지는 환경",
      reflective_explorer: "조용한 탐색·학습이 가능한 환경, 사색이 존중되는 자리"
    })[t] || "자기다움이 펼쳐질 수 있는 환경";
  }

  function arrowByTone(t){
    return ({
      principled_designer: "‘철학 언어화 → 깊은 대화 → 실제 역할 경험’",
      warm_connector:      "‘마음 듣기 → 감사 표현 → 신뢰 자산화’",
      visionary_creator:   "‘아이디어 캡처 → 프로토타입 발행 → 비전 정련’",
      pragmatic_achiever:  "‘1순위 결정 → 집중 블록 → 분기 회고’",
      reflective_explorer: "‘질문 다듬기 → 작은 실험 → 조용한 회고’"
    })[t] || "‘인식 → 표현 → 실행’";
  }

  function guideOfWeek(t, i){
    var G = {
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
    return (G[t] || G.principled_designer)[i] || "한 주의 흐름을 정돈하는 한 주";
  }

  function effectsOfWeek(t, i){
    // 4 포인트 명사형, 결과 중심 표현
    var E = {
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
    return (E[t] || E.principled_designer)[i] || ["루틴 시작", "기록 누적", "패턴 인식", "자기 자산화"];
  }

  function toolsOfTone(t, i){
    var T = {
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
    return (T[t] || T.principled_designer)[i] || ["노트", "캘린더", "회고 시트"];
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
