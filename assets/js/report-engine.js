/* =========================================================================
 * 인생포트폴리오 룰베이스 리포트 엔진 (v1.3)
 *
 * 입력:
 *   - questions  : data/questions.json (76문항, 11영역)
 *   - mapping    : data/mapping.json   (문항→축/섹션 매핑, 가치/진로/관심분야 맵)
 *   - rules      : data/report-rules.json (12단 구조, 5톤 변형, 작성규칙)
 *   - answers    : { Q3: 4, Q6: ["조용한","계획적인"], Q8: "기타…", … }
 *   - profile    : { name, email, recvMethod, submittedAt }
 *
 * 출력: 12 섹션 리포트 JSON (report.html에서 렌더, jsPDF 추출 대상)
 *
 * 정확도 설계 포인트:
 *  1) 축 정규화: 4축 가중합을 각 축의 max로 나눠 0~100% 정규화 → "최고 축" 선정 공정성 확보
 *  2) 톤 자동선택: Q13(핵심가치)→카테고리 + 최고축 결합. trigger 매칭 우선순위로 5종 중 1택
 *  3) 사명/비전: Q41(열정주제)·Q75(관심분야)·Q13(가치)·Q37(꿈)을 슬롯에 채워 결정
 *  4) 진로/교육: topicCareerMap(Q41)을 1차 + domainCareerMap(Q75)을 보강 (중복 제거)
 *  5) 강점 TOP3 / 성장 TOP2: 정규화 점수 상하위 + 키워드(Q6) 결합
 *  6) 키워드: 4축별로 응답에서 강세 키워드 자동 추출 (Q6, Q13, Q40, Q41, Q75 등)
 *
 * 외부 라이브러리 무의존(순수 JS), 브라우저/Node 양쪽 사용 가능.
 * ========================================================================= */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.ReportEngine = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ──────────────────────────────────────────────────────────
  // 0. 헬퍼
  // ──────────────────────────────────────────────────────────
  function toArr(v) { return Array.isArray(v) ? v : (v == null || v === "" ? [] : [v]); }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function unique(arr) { return [...new Set(arr)]; }
  function pad2(n){ n=String(n); return n.length<2?"0"+n:n; }
  function fmtDate(d){
    var dt = (d instanceof Date) ? d : (d ? new Date(d) : new Date());
    if (isNaN(dt.getTime())) dt = new Date();
    return dt.getFullYear()+"-"+pad2(dt.getMonth()+1)+"-"+pad2(dt.getDate());
  }

  // 리커트 점수: 1~5 (questions.json.likertScores 기준). reverse=true면 6-x로 반전.
  function getLikertScore(answers, qid, reverse, scaleMap) {
    var v = answers[qid];
    if (v == null || v === "") return null;
    var num = (typeof v === "number") ? v : (scaleMap && scaleMap[v] != null ? scaleMap[v] : Number(v));
    if (!isFinite(num)) return null;
    num = clamp(num, 1, 5);
    return reverse ? (6 - num) : num;
  }

  // 선택형(단일/다중) 응답을 배열로 통일
  function getChoiceArray(answers, qid){
    return toArr(answers[qid]).filter(function(x){ return x != null && x !== ""; });
  }

  // ──────────────────────────────────────────────────────────
  // 1. 축·섹션 점수 집계 + 정규화
  // ──────────────────────────────────────────────────────────
  function computeScores(questions, mapping, answers) {
    var scaleMap = questions.likertScores || {};
    var qmap = mapping.questionMapping || {};

    // 문항 타입 인덱스
    var qTypes = {};
    var qReverse = {};
    (questions.sections || []).forEach(function(sec){
      (sec.questions || []).forEach(function(q){
        qTypes[q.id] = q.type;
        qReverse[q.id] = !!q.reverse;
      });
    });

    var axisScore = { self_understanding:0, self_expression:0, self_design:0, self_execution:0 };
    var axisMax   = { self_understanding:0, self_expression:0, self_design:0, self_execution:0 };
    var secScore  = { summary:0, mission_vision:0, execution_profile:0, growth_map:0, career_education:0, application:0 };
    var secMax    = { summary:0, mission_vision:0, execution_profile:0, growth_map:0, career_education:0, application:0 };

    // 문항별 정규화 점수(0~1)도 보관 → 강점/성장 추출에 사용
    var perQ = {}; // { Qid: {raw, norm, type, axes, sections, weight} }

    Object.keys(qmap).forEach(function(qid){
      var info = qmap[qid] || {};
      var weight = info.weight != null ? info.weight : 1.0;
      var axes = info.axes || [];
      var secs = info.sections || [];
      var type = qTypes[qid] || "likert";

      var rawNorm = null; // 0~1 (응답 강도, 결측 시 null)
      if (type === "likert") {
        var lk = getLikertScore(answers, qid, qReverse[qid], scaleMap);
        if (lk != null) rawNorm = (lk - 1) / 4; // 1→0, 5→1
      } else if (type === "multi_choice" || type === "single_choice") {
        var arr = getChoiceArray(answers, qid);
        if (arr.length > 0) rawNorm = 1.0; // 선택했다 = 강한 의도(1.0)
      }

      perQ[qid] = { raw: rawNorm, type: type, axes: axes, sections: secs, weight: weight };

      if (rawNorm == null) {
        // 결측: max만 누적하지 않음(분모도 누락) → 응답률 편향 방지
        return;
      }

      // 점수 가산: 다축 매핑 시 가중치를 균등 분배
      if (axes.length > 0) {
        var perAxisW = weight / axes.length;
        axes.forEach(function(ax){
          if (axisScore[ax] != null) {
            axisScore[ax] += perAxisW * rawNorm;
            axisMax[ax]   += perAxisW * 1.0;
          }
        });
      }
      if (secs.length > 0) {
        var perSecW = weight / secs.length;
        secs.forEach(function(sc){
          if (secScore[sc] != null) {
            secScore[sc] += perSecW * rawNorm;
            secMax[sc]   += perSecW * 1.0;
          }
        });
      }
    });

    // 0~100 정규화
    function norm(score, max) { return max > 0 ? (score / max) * 100 : 0; }
    var axisPct = {
      self_understanding: norm(axisScore.self_understanding, axisMax.self_understanding),
      self_expression:    norm(axisScore.self_expression,    axisMax.self_expression),
      self_design:        norm(axisScore.self_design,        axisMax.self_design),
      self_execution:     norm(axisScore.self_execution,     axisMax.self_execution)
    };
    var secPct = {};
    Object.keys(secScore).forEach(function(k){ secPct[k] = norm(secScore[k], secMax[k]); });

    // 정렬된 축 리스트
    var axisRanking = Object.keys(axisPct)
      .map(function(k){ return { axis:k, pct: axisPct[k] }; })
      .sort(function(a,b){ return b.pct - a.pct; });

    return { axisPct: axisPct, sectionPct: secPct, axisRanking: axisRanking, perQ: perQ };
  }

  // ──────────────────────────────────────────────────────────
  // 2. 톤 자동 선택 (Q13 핵심가치 카테고리 × 최고 축)
  // ──────────────────────────────────────────────────────────
  function classifyValueCategory(values, valueKeywordMap) {
    // values: ["성장","책임","사랑"] 등 Q13 다중선택값
    // 카테고리별 키워드 일치 개수를 세고 최다 카테고리 반환 (동률 시 우선순위)
    var priority = ["원칙지향","관계지향","성장지향","자유지향"];
    var counts = { 원칙지향:0, 관계지향:0, 성장지향:0, 자유지향:0 };
    var arr = toArr(values).map(function(v){ return String(v).trim(); });
    Object.keys(counts).forEach(function(cat){
      var kws = valueKeywordMap[cat] || [];
      arr.forEach(function(v){
        if (kws.indexOf(v) !== -1) counts[cat] += 1;
      });
    });
    // best
    var best = null, bestCount = -1;
    priority.forEach(function(cat){
      if (counts[cat] > bestCount) { best = cat; bestCount = counts[cat]; }
    });
    if (bestCount <= 0) {
      // 매칭 0이면 첫 가치로 추정. 그래도 없으면 성장지향 기본
      return { category: "성장지향", matched: 0 };
    }
    return { category: best, matched: bestCount };
  }

  function selectTone(scores, answers, mapping, rules) {
    var values = getChoiceArray(answers, "Q13");
    var classified = classifyValueCategory(values, mapping.valueKeywordMap || {});
    var topAxis  = (scores.axisRanking[0] || {}).axis || "self_design";
    var top2Axis = (scores.axisRanking[1] || {}).axis || null;
    var variants = (rules.toneVariants && rules.toneVariants.variants) || {};
    var priority = ["principled_designer","warm_connector","visionary_creator","pragmatic_achiever","reflective_explorer"];

    // PR#60-A: 가중치 합산 방식 톤 선택 (이전 구현은 valueCategory만 만족하면 종료되어
    //          topAxis 결이 어긋나는 톤이 잡히는 문제가 있었음)
    //   가중치
    //     · valueCategory 정확 일치 → +3
    //     · topAxis 1위 정확 일치   → +2
    //     · topAxis 2위 정확 일치   → +1
    //   동률 시 priority 우선순위 순으로 결정
    //   v1.3 ↔ v4.1 일관성 확보: report-engine-v4.js 의 resolveTone 도 동일 모델 적용
    function _scoreVariant(vobj){
      var trig = (vobj && vobj.trigger) || {};
      var vcOk = !trig.valueCategory ||
                 (trig.valueCategory.indexOf(classified.category) !== -1);
      var ax1Ok = !trig.topAxis ||
                  (topAxis && trig.topAxis.indexOf(topAxis) !== -1);
      var ax2Ok = !!top2Axis && trig.topAxis &&
                  (trig.topAxis.indexOf(top2Axis) !== -1);
      var score = 0;
      if (vcOk)  score += 3;
      if (ax1Ok) score += 2;
      if (ax2Ok) score += 1;
      return { score: score, vcOk: vcOk, ax1Ok: ax1Ok, ax2Ok: ax2Ok };
    }

    var ranked = [];
    for (var i=0; i<priority.length; i++){
      var k = priority[i];
      var v = variants[k];
      if (!v) continue;
      var sc = _scoreVariant(v);
      ranked.push({ key: k, score: sc.score, parts: sc, priority: i });
    }
    ranked.sort(function(a,b){
      if (b.score !== a.score) return b.score - a.score;
      return a.priority - b.priority; // 동률 시 priority 순
    });

    var picked = (ranked[0] && ranked[0].score > 0) ? ranked[0].key : priority[0];
    var pickedParts = (ranked[0] && ranked[0].parts) || { vcOk:false, ax1Ok:false, ax2Ok:false };
    var pickedScore = (ranked[0] && ranked[0].score) || 0;

    return {
      key: picked,
      variant: variants[picked] || {},
      valueCategory: classified.category,
      topAxis: topAxis,
      top2Axis: top2Axis,
      // PR#60-A: 톤 선택 해상도 메타 (v4 검증 게이트에서 활용)
      resolution: {
        score: pickedScore,
        vcMatch: !!pickedParts.vcOk,
        ax1Match: !!pickedParts.ax1Ok,
        ax2Match: !!pickedParts.ax2Ok,
        ranking: ranked.map(function(x){ return { key: x.key, score: x.score }; }),
        reason: "vc=" + classified.category + " top1=" + topAxis +
                " top2=" + (top2Axis||"-") + " score=" + pickedScore +
                " (vc:" + (pickedParts.vcOk?1:0) +
                " ax1:" + (pickedParts.ax1Ok?1:0) +
                " ax2:" + (pickedParts.ax2Ok?1:0) + ")"
      }
    };
  }

  // ──────────────────────────────────────────────────────────
  // 3. 진로·교육 큐레이션
  // ──────────────────────────────────────────────────────────
  function pickCareerEducation(answers, mapping, count, lang) {
    var isEn = (lang === "en");
    count = count || 3;
    var topic = answers["Q41"]; // 단일 (열정 주제)
    var domains = getChoiceArray(answers, "Q75"); // 다중 (관심 분야)

    var careerPool = [];
    var educationPool = [];
    var directions = [];

    // 1차: Q41 topic
    var tcm = mapping.topicCareerMap || {};
    if (topic && tcm[topic]) {
      careerPool = careerPool.concat(tcm[topic].careers || []);
      educationPool = educationPool.concat(tcm[topic].education || []);
    }

    // 2차: Q75 domain (3개 분야 → 보강)
    var dcm = mapping.domainCareerMap || {};
    domains.forEach(function(d){
      if (dcm[d]) careerPool = careerPool.concat(dcm[d]);
    });

    // 확장 방향: domain 기반 명사형
    var i18nEn = mapping.i18n_en || {};
    var domainLabelEn = i18nEn.domainLabel || {};
    var careerLabelEn = i18nEn.careerLabel || {};
    var educationLabelEn = i18nEn.educationLabel || {};

    domains.slice(0, count).forEach(function(d){
      if (isEn) {
        var dEn = domainLabelEn[d] || d;
        directions.push("Deepen expertise in the field of " + dEn);
      } else {
        directions.push(d + " 영역의 전문성 확장");
      }
    });

    careerPool = unique(careerPool).slice(0, count);
    educationPool = unique(educationPool).slice(0, count);
    directions = unique(directions).slice(0, count);

    // 부족 시 합리적 폴백
    if (isEn) {
      while (careerPool.length < count) careerPool.push("Self-Design & Execution Specialist");
      while (educationPool.length < count) educationPool.push("Self-Growth & Leadership Workshop");
      while (directions.length < count) directions.push("Deepen expertise in your area of interest");
    } else {
      while (careerPool.length < count) careerPool.push("자기설계·실행 영역의 전문가");
      while (educationPool.length < count) educationPool.push("자기성장·리더십 워크숍");
      while (directions.length < count) directions.push("관심 영역의 깊이 확장");
    }

    // EN 모드: KO careers/education을 EN으로 변환 (사전 미스 시 원문 유지)
    if (isEn) {
      careerPool = careerPool.map(function(c){ return careerLabelEn[c] || c; });
      educationPool = educationPool.map(function(e){ return educationLabelEn[e] || e; });
    }

    return { careers: careerPool, education: educationPool, directions: directions, sourceTopic: topic || "", sourceDomains: domains };
  }

  // ──────────────────────────────────────────────────────────
  // 4. 4축별 키워드 / 핵심·감성·키워드 라인 생성
  //
  //   핵심 설계 원칙(2026-05 v1.2 업데이트):
  //   - 각 축은 자기 축에 매핑된 likert 평균 점수와 multi_choice 응답을 직접 사용
  //   - core(본질) / emotional(한 마디) 문장을 응답 강도(상/중/하) × 응답 토픽으로 동적 조합
  //   - keywords(4개)는 응답 선택지 → 축 키워드로 매핑된 결과를 우선, 부족 시 baseline 으로 보강
  //   - 결과적으로 모든 사용자가 다른 문장 / 다른 키워드를 보게 됨
  // ──────────────────────────────────────────────────────────

  // 4축 baseline (응답이 거의 없거나 폴백 필요할 때만 사용)
  var AXIS_BASELINE = {
    self_understanding: {
      strengths: ["자기 성찰","감정 인식","객관적 자기 관찰","내적 통찰","의미 부여","가치 명료화"],
      core: "자신의 감정·생각·신념을 정직하게 들여다보고 의미를 발견하는 힘",
      emotional: "‘나는 누구인가’라는 질문에 정직하게 응답하는 사람"
    },
    self_expression: {
      strengths: ["감정 표현","경청","공감 전달","관계 맺기","따뜻한 소통","신뢰 구축"],
      core: "자신의 마음과 생각을 사람들에게 진정성 있게 전달하는 힘",
      emotional: "‘나의 진심이 너에게 가닿기를’이라고 말하는 사람"
    },
    self_design: {
      strengths: ["원칙 기반 결단","구조 설계","루틴 운영","목표 명료화","우선순위 판단","장기적 시야"],
      core: "삶의 방향과 기준·루틴을 스스로 설계하는 힘",
      emotional: "‘이렇게 살고 싶다’를 명확히 그리는 사람"
    },
    self_execution: {
      strengths: ["꾸준한 실행","목표 달성","결과 책임","행동력","난관 극복","성취 경험"],
      core: "결정한 것을 실제 행동과 결과로 만들어내는 힘",
      emotional: "‘끝까지 해낸다’를 증명하는 사람"
    }
  };
  var AXIS_GROWTH = {
    self_understanding: ["감정 표현 확장","외부 피드백 수용","행동 전환 가속"],
    self_expression:    ["갈등 상황에서의 단단함","의견 단호한 표현","경계 설정"],
    self_design:        ["계획의 유연성","즉흥성 수용","감정 변수 고려"],
    self_execution:     ["회복 루틴","에너지 분배","과정의 즐거움 회복"]
  };

  // 응답 선택지 → 축 키워드 매핑 (multi_choice 답변에서 키워드 추출용)
  // 실제 질문(questions.json)의 옵션 텍스트를 짧은 명사형 키워드로 환원
  var CHOICE_KEYWORD_BY_AXIS = {
    self_understanding: {
      // Q6 성향
      "조용한":"조용한","신중한":"신중한","분석적인":"분석적","느긋한":"느긋한",
      // Q7 자기인식 트리거
      "혼자만의 시간을 보낼 때":"내적 시간","실패나 실수를 돌아볼 때":"실패 복기","갈등 상황에서 감정을 조절할 때":"감정 조절",
      // Q19 전환 경험
      "스스로에게 깊은 질문을 던졌던 시기":"내적 질문","우울감, 무기력, 번아웃 같은 감정의 경험":"감정 회복","독서, 영상, 강연 등의 콘텐츠로 인한 변화":"콘텐츠 학습",
      // Q21 회복 방식
      "혼자 있는 시간 갖기":"고독 회복","기도, 명상, 종교 활동":"명상 회복","감정을 글이나 그림으로 표현하기":"감정 기록","책, 영화, 음악에 몰입하기":"몰입 회복",
      // Q26 감정 다스림
      "조용히 혼자 있는 시간 갖기":"고요한 정리","생각을 글이나 그림으로 표현하기":"감정 기록","기도나 명상 등으로 마음을 정리하기":"명상 정리",
      // 가치(Q13)
      "의미 추구":"의미 추구","평화":"평화","자유":"자유"
    },
    self_expression: {
      // Q6 성향
      "공감하는":"공감","따뜻한":"따뜻함",
      // Q24/Q26: 감정·표현 likert는 별도 처리, 여기는 선택형
      "감정을 솔직하게 말하는 편이다":"솔직한 표현","표정이나 말투로 바로 티가 난다":"투명한 감정","감정을 다른 사람에게 쉽게 공감시킨다":"공감 전달","감정을 행동(표현/돌봄 등)으로 전달하는 편이다":"행동적 표현",
      // Q31 인상
      "편안함을 주는 사람":"편안한 분위기","공감해주는 사람":"공감 리더","조용히 들어주는 사람":"경청","갈등을 풀어주는 사람":"갈등 해소","사람들을 연결해주는 사람":"연결자","분위기를 띄우는 사람":"분위기 메이커",
      // Q33 관계 가치
      "신뢰":"신뢰","진정성":"진정성","공감":"공감","배려":"배려","따뜻함":"따뜻함","소통":"소통","경청":"경청","존중":"존중",
      // 가치(Q13)
      "사랑":"사랑","헌신":"헌신","포용":"포용","협동":"협동"
    },
    self_design: {
      // Q6 성향
      "계획적인":"계획성","현실적인":"현실 감각","창의적인":"창의 설계",
      // Q47 몰입 환경
      "조용한 공간 (도서관, 독서실 등)":"조용한 환경","정돈된 실내 (정리된 내 방, 사무 공간)":"정돈된 공간","자연 속 장소 (공원, 바다, 산 등)":"자연 환경",
      // Q49 하루 리듬
      "계획표에 따라 움직이는 하루":"계획 기반 리듬","아침에 일찍 시작하고 저녁에 일찍 마무리하는 루틴":"규칙적 루틴","몰입 시간과 휴식 시간을 명확히 나누는 하루":"몰입·회복 분리",
      // Q63 선택 기준
      "의미 / 보람 / 가치":"의미 기반 결단","안정성 / 안전 / 예측 가능성":"안정적 설계","신념 / 원칙 / 종교적 기준":"원칙 기반 결단","책임 / 도리 / 역할 충실":"책임 설계","자유 / 자율성":"자율 설계","성장 가능성 / 배움의 기회":"성장 설계",
      // 가치(Q13)
      "정직":"정직","책임":"책임","절제":"절제","질서":"질서","공정":"공정","창의":"창의"
    },
    self_execution: {
      // Q6 성향
      "열정적인":"열정","도전적인":"도전","성취지향적인":"성취지향",
      // Q39 활동 유형 (실행 스타일)
      "계획을 세우고 실행하는 일":"계획→실행","문제를 분석하고 해결책을 찾는 일":"문제 해결","몸을 움직이는 활동, 스포츠, 체험 등":"행동 우선","봉사, 돌봄, 의미 있는 영향력 행사":"의미 실행",
      // Q71 목표 달성 강점
      "구체적인 계획을 세우는 것":"구체적 계획","반복적인 실천으로 습관화하기":"습관화","기한을 정해놓고 마감 맞추기":"마감 추진력","강한 몰입으로 단기간에 끝내기":"단기 몰입","실수와 실패를 복기하며 개선하기":"개선 루프","주변 사람들의 협력을 잘 이끌어내기":"협력 추진","멀리 내다보며 흐름을 설계하기":"장기 추진",
      // Q73 성취 순간
      "내가 정한 목표를 달성했을 때":"목표 달성","문제를 해결하고 결과가 나왔을 때":"결과 책임","실패했지만 끝까지 해낸 자신을 봤을 때":"끝까지 해냄","누군가에게 좋은 영향을 미쳤을 때":"영향력 성취",
      // 가치(Q13)
      "성장":"성장","도전":"도전","성취":"성취","몰입":"몰입"
    }
  };

  // ──────────────────────────────────────────────────────────
  //  영문 사전 (EN counterpart) — opts.lang === "en" 분기에서 사용
  //  KO 정규형 저장본은 그대로 유지하면서, 동일 인덱스(레벨/variant)로 EN 출력
  // ──────────────────────────────────────────────────────────
  var AXIS_BASELINE_EN = {
    self_understanding: {
      strengths: ["Self-reflection","Emotional awareness","Objective self-observation","Inner insight","Meaning-making","Value clarification"],
      core: "The strength to look honestly at your own emotions, thoughts, and beliefs and discover meaning in them",
      emotional: "Someone who answers honestly to the question 'who am I'"
    },
    self_expression: {
      strengths: ["Emotional expression","Listening","Conveying empathy","Building relationships","Warm communication","Building trust"],
      core: "The strength to convey your heart and thoughts to people with authenticity",
      emotional: "Someone who says 'may my sincerity reach you'"
    },
    self_design: {
      strengths: ["Principle-based decisions","Structural design","Routine operation","Goal clarity","Priority judgment","Long-term perspective"],
      core: "The strength to design your life's direction, standards, and routines for yourself",
      emotional: "Someone who can clearly draw the picture of 'this is how I want to live'"
    },
    self_execution: {
      strengths: ["Steady execution","Goal achievement","Result accountability","Decisiveness","Overcoming obstacles","Achievement experience"],
      core: "The strength to turn what you decide into real action and results",
      emotional: "Someone who proves 'I will see it through to the end'"
    }
  };
  var AXIS_GROWTH_EN = {
    self_understanding: ["Expanding emotional expression","Receiving external feedback","Accelerating action conversion"],
    self_expression:    ["Steadiness in conflict","Firm articulation of opinion","Setting boundaries"],
    self_design:        ["Plan flexibility","Embracing spontaneity","Considering emotional variables"],
    self_execution:     ["Recovery routines","Energy distribution","Reclaiming joy in the process"]
  };

  // KO 응답 옵션 텍스트 → 영문 키워드 (CHOICE_KEYWORD_BY_AXIS 의 EN 대응)
  // 사용자 응답은 KO 옵션이 그대로 들어오므로, KO 키 그대로 두고 EN 값만 새로 정의
  var CHOICE_KEYWORD_BY_AXIS_EN = {
    self_understanding: {
      "조용한":"Quiet","신중한":"Thoughtful","분석적인":"Analytical","느긋한":"Easygoing",
      "혼자만의 시간을 보낼 때":"Solitary time","실패나 실수를 돌아볼 때":"Reviewing failures","갈등 상황에서 감정을 조절할 때":"Emotion regulation",
      "스스로에게 깊은 질문을 던졌던 시기":"Inner questioning","우울감, 무기력, 번아웃 같은 감정의 경험":"Emotional recovery","독서, 영상, 강연 등의 콘텐츠로 인한 변화":"Content learning",
      "혼자 있는 시간 갖기":"Solitary recovery","기도, 명상, 종교 활동":"Meditative recovery","감정을 글이나 그림으로 표현하기":"Emotional journaling","책, 영화, 음악에 몰입하기":"Immersive recovery",
      "조용히 혼자 있는 시간 갖기":"Quiet alone time","생각을 글이나 그림으로 표현하기":"Emotional journaling","기도나 명상 등으로 마음을 정리하기":"Meditative settling",
      "의미 추구":"Pursuit of meaning","평화":"Peace","자유":"Freedom"
    },
    self_expression: {
      "공감하는":"Empathic","따뜻한":"Warm",
      "감정을 솔직하게 말하는 편이다":"Honest expression","표정이나 말투로 바로 티가 난다":"Transparent emotion","감정을 다른 사람에게 쉽게 공감시킨다":"Conveying empathy","감정을 행동(표현/돌봄 등)으로 전달하는 편이다":"Action-based expression",
      "편안함을 주는 사람":"Comforting presence","공감해주는 사람":"Empathic leader","조용히 들어주는 사람":"Listener","갈등을 풀어주는 사람":"Conflict resolver","사람들을 연결해주는 사람":"Connector","분위기를 띄우는 사람":"Mood maker",
      "신뢰":"Trust","진정성":"Authenticity","공감":"Empathy","배려":"Consideration","따뜻함":"Warmth","소통":"Communication","경청":"Listening","존중":"Respect",
      "사랑":"Love","헌신":"Devotion","포용":"Inclusion","협동":"Cooperation"
    },
    self_design: {
      "계획적인":"Methodical","현실적인":"Pragmatic","창의적인":"Creative",
      "조용한 공간 (도서관, 독서실 등)":"Quiet environment","정돈된 실내 (정리된 내 방, 사무 공간)":"Tidy environment","자연 속 장소 (공원, 바다, 산 등)":"Natural environment",
      "계획표에 따라 움직이는 하루":"Plan-based rhythm","아침에 일찍 시작하고 저녁에 일찍 마무리하는 루틴":"Regular routine","몰입 시간과 휴식 시간을 명확히 나누는 하루":"Focus-recovery balance",
      "의미 / 보람 / 가치":"Meaning-based decisions","안정성 / 안전 / 예측 가능성":"Stable design","신념 / 원칙 / 종교적 기준":"Principle-based decisions","책임 / 도리 / 역할 충실":"Responsibility design","자유 / 자율성":"Autonomous design","성장 가능성 / 배움의 기회":"Growth design",
      "정직":"Honesty","책임":"Responsibility","절제":"Restraint","질서":"Order","공정":"Fairness","창의":"Creativity"
    },
    self_execution: {
      "열정적인":"Passionate","도전적인":"Challenging","성취지향적인":"Achievement-oriented",
      "계획을 세우고 실행하는 일":"Plan-and-execute","문제를 분석하고 해결책을 찾는 일":"Problem-solving","몸을 움직이는 활동, 스포츠, 체험 등":"Action-first","봉사, 돌봄, 의미 있는 영향력 행사":"Meaningful action",
      "구체적인 계획을 세우는 것":"Concrete planning","반복적인 실천으로 습관화하기":"Habit-forming","기한을 정해놓고 마감 맞추기":"Deadline-driven","강한 몰입으로 단기간에 끝내기":"Short-burst focus","실수와 실패를 복기하며 개선하기":"Improvement loop","주변 사람들의 협력을 잘 이끌어내기":"Cooperative drive","멀리 내다보며 흐름을 설계하기":"Long-term drive",
      "내가 정한 목표를 달성했을 때":"Goal achievement","문제를 해결하고 결과가 나왔을 때":"Result accountability","실패했지만 끝까지 해낸 자신을 봤을 때":"Seeing it through","누군가에게 좋은 영향을 미쳤을 때":"Impactful achievement",
      "성장":"Growth","도전":"Challenge","성취":"Achievement","몰입":"Immersion"
    }
  };

  // 4축 × 3 levels × 4 variants 영문 narrative 사전
  // KO V 사전과 동일한 인덱스(axisKey, lvl, vi)로 매칭됨 → 동일 응답이면 동일 의미의 EN 변형이 출력
  // k1, k2: 응답에서 추출한 영문 키워드 (CHOICE_KEYWORD_BY_AXIS_EN 매핑 후); tag1: trait 영문 형용사 (TRAIT_EN 매핑)
  var V_EN = {
    self_understanding: {
      high: [
        { core: function(k1,k2,tag1){ return k1 ? "The strength to look deeply within yourself, using '"+k1+"' as a clue" : "The strength to look deeply within yourself and discover meaning"; },
          emo:  function(k1,k2,tag1){ return tag1 ? "Someone who rediscovers the depth of '"+tag1+" me' every day" : "Someone who asks 'why did I feel that way' and finds the answer themselves"; } },
        { core: function(k1,k2,tag1){ return (k1 && k2) ? "The strength to read honestly the texture of your emotions and beliefs between '"+k1+"' and '"+k2+"'" : "The strength to read your emotions, thoughts, and beliefs honestly"; },
          emo:  function(){ return "The most diligent first reader of the text called 'me'"; } },
        { core: function(k1){ return k1 ? "The strength to keep redefining 'who am I' through '"+k1+"'" : "The strength to face the question 'who am I' without fear"; },
          emo:  function(){ return "Someone who has the deepest dialogue with themselves in quiet moments"; } },
        { core: function(){ return "The strength to draw your own meaning from emotional waves rather than letting them pass"; },
          emo:  function(k1){ return k1 ? "Someone who never lets a '"+k1+"' moment slip away" : "Someone who believes 'even small tremors carry meaning'"; } }
      ],
      mid: [
        { core: function(k1){ return k1 ? "The strength to gradually understand yourself through '"+k1+"'" : "The strength to slowly attend to your heart and discover meaning"; },
          emo:  function(){ return "Someone who quietly says 'I want to understand myself a bit more'"; } },
        { core: function(){ return "The strength to listen to your inner signals before external evaluation"; },
          emo:  function(tag1){ return tag1 ? "Someone who has begun accepting themselves as a '"+tag1+" person'" : "Someone who says 'I don't know everything yet, but I'm getting there'"; } },
        { core: function(k1,k2){ return (k1 && k2) ? "The strength to organize your emotions while moving between "+k1+" and "+k2 : "The strength to refine your standards by sorting emotions and thoughts"; },
          emo:  function(){ return "Someone who grows by comparing 'today's me' with 'yesterday's me'"; } },
        { core: function(){ return "The strength to revisit yourself through life's events rather than letting them pass"; },
          emo:  function(){ return "Someone who never forgets to ask 'what was this experience to me'"; } }
      ],
      low: [
        { core: function(){ return "The strength of someone gradually discovering themselves through action and relationships"; },
          emo:  function(){ return "Someone who says 'I learn who I am by living'"; } },
        { core: function(){ return "The strength to gather pieces of yourself through experience rather than rushing to answers"; },
          emo:  function(k1){ return k1 ? "Someone who builds themselves by gathering '"+k1+"' moments" : "Someone who believes 'answers are slowly discovered through living'"; } },
        { core: function(){ return "The extroverted strength of self-understanding where action and practice move first"; },
          emo:  function(){ return "Someone who says 'I know who I am only by trying things'"; } },
        { core: function(){ return "The strength to confirm yourself through the mirror of relationships with others"; },
          emo:  function(){ return "Someone who believes 'time spent together is itself a time of self-discovery'"; } }
      ]
    },
    self_expression: {
      high: [
        { core: function(k1){ return k1 ? "The strength to convey your heart clearly to people through '"+k1+"'" : "The strength to convey your heart to people with authenticity"; },
          emo:  function(){ return "Someone who naturally says 'may my sincerity reach you'"; } },
        { core: function(k1,k2){ return (k1 && k2) ? "The strength to release your emotions between people through '"+k1+"' and '"+k2+"'" : "The strength to naturally release your emotions in the space between people"; },
          emo:  function(tag1){ return tag1 ? "Someone who embraces people with a '"+tag1+"' texture" : "Someone whose words and expressions are equally sincere"; } },
        { core: function(){ return "The strength of warm expression — never hiding emotion, yet never wounding"; },
          emo:  function(){ return "Someone often told 'my heart unwinds when I'm with you'"; } },
        { core: function(k1){ return k1 ? "The strength to bridge people's hearts through '"+k1+"'" : "The strength to be a bridge between hearts"; },
          emo:  function(){ return "Someone who is the best at 'listening to your story all the way through'"; } }
      ],
      mid: [
        { core: function(k1){ return k1 ? "The strength to carefully reveal your emotions through '"+k1+"'" : "The strength to express your emotions and thoughts as the situation calls for"; },
          emo:  function(){ return "Someone who feels 'if there is someone to listen, I want to speak too'"; } },
        { core: function(){ return "The strength of careful expression — settling emotions first, then putting them in firm words"; },
          emo:  function(tag1){ return tag1 ? "Someone who carries deep messages in '"+tag1+" silence'" : "Someone who believes 'a single word can hold the heart'"; } },
        { core: function(k1,k2){ return (k1 && k2) ? "The strength to convey emotions in varied ways, moving between "+k1+" and "+k2 : "The strength to adapt how emotions are conveyed to the situation"; },
          emo:  function(){ return "Someone remembered as 'the warmest person at the right distance'"; } },
        { core: function(){ return "The strength of delicate expression — conveying not the loudest emotion but the precise texture"; },
          emo:  function(){ return "Someone who often says 'sincerity shows in the details'"; } }
      ],
      low: [
        { core: function(){ return "The strength of presence over expression — conveying the heart through action and silence"; },
          emo:  function(){ return "Someone who believes 'I convey it through time spent together rather than words'"; } },
        { core: function(){ return "The weighty expression of conveying the heart through care and practice rather than words"; },
          emo:  function(){ return "Someone who 'speaks little but whose presence reaches the heart'"; } },
        { core: function(k1){ return k1 ? "The non-verbal strength of conveying the heart through "+k1+" actions" : "The deep strength of conveying the heart through non-verbal signals"; },
          emo:  function(){ return "Someone whose 'hand reaches before the words'"; } },
        { core: function(){ return "The restrained strength of opening your mouth only at necessary moments"; },
          emo:  function(){ return "Someone whose 'few words carry different weight'"; } }
      ]
    },
    self_design: {
      high: [
        { core: function(k1){ return k1 ? "The strength to design life's direction and routines around '"+k1+"'" : "The strength to design life's direction, standards, and routines for yourself"; },
          emo:  function(){ return "Someone who can draw 'this is how I want to live' as a concrete picture"; } },
        { core: function(k1,k2){ return (k1 && k2) ? "The strength to weave your life's structure around the two axes of '"+k1+"' and '"+k2+"'" : "The strength to weave your life's structure by balancing multiple standards"; },
          emo:  function(tag1){ return tag1 ? "Someone who runs their time as a '"+tag1+" designer'" : "Someone whose 'daily rhythm is itself their philosophy'"; } },
        { core: function(){ return "The strength to build your own operating system that doesn't shake with emotional fluctuation"; },
          emo:  function(){ return "Someone who believes 'today's routine makes tomorrow's me'"; } },
        { core: function(k1){ return k1 ? "The strength to keep decisions consistent by anchoring them in '"+k1+"'" : "The strength to bear the weight of decisions through consistent principles"; },
          emo:  function(){ return "Someone who can say 'my standards do not waver'"; } }
      ],
      mid: [
        { core: function(k1){ return k1 ? "The strength to refine your own standards through '"+k1+"'" : "The strength to gradually articulate life's standards and routines in your own words"; },
          emo:  function(){ return "Someone who says 'I am building a path that fits me'"; } },
        { core: function(){ return "The strength to balance the big picture and small schedules at the same time"; },
          emo:  function(tag1){ return tag1 ? "Someone who pursues '"+tag1+" balance'" : "Someone who chooses 'consistency over perfection'"; } },
        { core: function(k1,k2){ return (k1 && k2) ? "The strength to experiment with your way of operating between "+k1+" and "+k2 : "The strength to try multiple approaches and find a structure that fits you"; },
          emo:  function(){ return "Someone who enjoys the 'process of refining over completion'"; } },
        { core: function(){ return "The strength of adaptive design — firm in principles, flexible in execution"; },
          emo:  function(){ return "Someone who believes 'standards are firm but the path can be many'"; } }
      ],
      low: [
        { core: function(){ return "The strength to choose flexibly and discover standards through experience"; },
          emo:  function(){ return "Someone who says 'I decide by living rather than by setting in advance'"; } },
        { core: function(k1){ return k1 ? "The strength to set direction in the moment from intuitive signals like '"+k1+"'" : "The strength to discover your direction through situation and intuition"; },
          emo:  function(){ return "Someone who trusts 'flow over plan'"; } },
        { core: function(){ return "The free, value-centered strength of design that prioritizes meaning over system"; },
          emo:  function(){ return "Someone who says 'I'm led by meaning, not framework'"; } },
        { core: function(){ return "The strength to make a path by living each moment fully rather than building structure"; },
          emo:  function(){ return "Someone who says 'today itself is my design'"; } }
      ]
    },
    self_execution: {
      high: [
        { core: function(k1){ return k1 ? "The strength to turn decisions into action and results through '"+k1+"'" : "The strength to turn what you decide into real action and results"; },
          emo:  function(){ return "Someone who proves 'I see it through' through action"; } },
        { core: function(k1,k2){ return (k1 && k2) ? "The driving force to own both starts and finishes through '"+k1+"' and '"+k2+"'" : "The driving strength of execution that takes responsibility for both starts and finishes"; },
          emo:  function(tag1){ return tag1 ? "Someone who 'creates results in a "+tag1+" way'" : "Someone who 'answers with results rather than words'"; } },
        { core: function(){ return "The resilient driving force that keeps producing results even in tough environments"; },
          emo:  function(){ return "Someone whose self-definition is 'fall down and still finish'"; } },
        { core: function(k1){ return k1 ? "The immersive strength of execution that pushes through using '"+k1+"' as fuel" : "The immersive strength of execution that pushes through to the end once started"; },
          emo:  function(){ return "Someone who is most themselves in the middle of immersion"; } }
      ],
      mid: [
        { core: function(k1){ return k1 ? "The strength to stack results step by step using '"+k1+"' as motive" : "The steady strength of closing the gap between decision and action"; },
          emo:  function(){ return "Someone moved by 'small but completed experiences'"; } },
        { core: function(){ return "The strength of execution that builds trust by repeating small completions over big leaps"; },
          emo:  function(tag1){ return tag1 ? "Someone who creates results through '"+tag1+" steadiness'" : "Someone who believes 'one step today is the greatest achievement'"; } },
        { core: function(k1,k2){ return (k1 && k2) ? "The strength to finish things by alternating between "+k1+" and "+k2 : "The strength to combine multiple methods to produce results"; },
          emo:  function(){ return "Someone who becomes 'a person who picks the right tool and finishes'"; } },
        { core: function(){ return "The balanced strength of execution — managing emotion and willpower together to the end"; },
          emo:  function(){ return "Someone who chooses 'completion over speed'"; } }
      ],
      low: [
        { core: function(){ return "The careful strength of execution that solidifies plans and meaning before moving"; },
          emo:  function(){ return "Someone who believes 'when ready, finish in one sitting'"; } },
        { core: function(){ return "The inner-motivation strength of execution — clarifying meaning and reasons before action"; },
          emo:  function(){ return "Someone who says 'my hands move only when the why is clear'"; } },
        { core: function(k1){ return k1 ? "The selective strength of execution that moves with great drive when '"+k1+"' is clear" : "The selective strength of execution that moves decisively when conditions are met"; },
          emo:  function(){ return "Someone who follows through 'not on anything, but on what matters'"; } },
        { core: function(){ return "The sustaining strength of execution that goes long while keeping your own pace"; },
          emo:  function(){ return "Someone who chooses 'long and firm over short and intense'"; } }
      ]
    }
  };

  // trait/value 토큰 → 영문 변환 (V_EN.tag1 슬롯에 사용)
  var TRAIT_VALUE_EN = {
    "조용한":"quiet","신중한":"thoughtful","분석적인":"analytical","느긋한":"easygoing",
    "공감하는":"empathic","따뜻한":"warm",
    "계획적인":"methodical","현실적인":"pragmatic","창의적인":"creative",
    "열정적인":"passionate","도전적인":"bold","성취지향적인":"achievement-oriented",
    "의미 추구":"meaning","평화":"peace","자유":"freedom",
    "사랑":"love","헌신":"devotion","포용":"inclusion","협동":"cooperation",
    "정직":"honesty","책임":"responsibility","절제":"restraint","질서":"order","공정":"fairness","창의":"creativity",
    "성장":"growth","도전":"challenge","성취":"achievement","몰입":"immersion",
    "신뢰":"trust","진정성":"authenticity","공감":"empathy","배려":"consideration","따뜻함":"warmth","소통":"communication","경청":"listening","존중":"respect"
  };

  // 각 축의 likert 문항 목록 (questions.json/mapping.json 기반)
  var AXIS_LIKERT_QS = {
    self_understanding: ["Q3","Q4","Q5","Q9","Q10","Q11","Q23","Q25"],
    self_expression:    ["Q24","Q28","Q30"],
    self_design:        ["Q12","Q43","Q44","Q45","Q46","Q59","Q60","Q61","Q62"],
    self_execution:     ["Q51","Q53","Q54","Q67","Q68","Q69","Q70"] // Q70 is reverse
  };

  // 각 축의 multi/single choice 문항 목록 (키워드 추출용)
  var AXIS_CHOICE_QS = {
    self_understanding: ["Q6","Q7","Q19","Q21","Q26","Q13"],
    self_expression:    ["Q6","Q28","Q31","Q33","Q13"],
    self_design:        ["Q6","Q47","Q49","Q63","Q13"],
    self_execution:     ["Q6","Q39","Q71","Q73","Q13"]
  };

  // 축 likert 평균(0~1) 계산 — reverse 문항 처리
  function axisLikertAvg(answers, qids, scaleMap, qReverse){
    var sum = 0, n = 0;
    qids.forEach(function(qid){
      var v = answers[qid];
      if (v == null || v === "") return;
      var num = (typeof v === "number") ? v : (scaleMap && scaleMap[v] != null ? scaleMap[v] : Number(v));
      if (!isFinite(num)) return;
      num = clamp(num, 1, 5);
      if (qReverse[qid]) num = 6 - num;
      sum += num; n += 1;
    });
    if (n === 0) return null;
    return ((sum / n) - 1) / 4; // 0~1
  }

  // ──────────────────────────────────────────────────────────
  // 본질 / 한 마디 동적 생성 (v1.3)
  //
  //  핵심 설계 변경:
  //   - 한 축당 4가지 sentence pattern을 준비 (응답 fingerprint로 선택)
  //   - keyword 1개가 아니라 keyword Top1 + Top2 + 축에 분배된 trait/value 까지 결합
  //   - fingerprint = 축 likert별 (1~5) 점수의 패턴 + 선택형 응답 인덱스 합 → 변형 인덱스 결정
  //   - 결과: 같은 강도(예: 100%)여도 응답 조합이 다르면 본질·한 마디가 다름
  // ──────────────────────────────────────────────────────────

  // 응답 fingerprint: 축의 likert 점수 + 첫 선택형 응답 인덱스로 정수 hash 생성
  function answerFingerprint(answers, qids, scaleMap, qReverse, choiceQids){
    var h = 0;
    (qids || []).forEach(function(qid, idx){
      var v = answers[qid];
      if (v == null || v === "") return;
      var num = (typeof v === "number") ? v : (scaleMap && scaleMap[v] != null ? scaleMap[v] : Number(v));
      if (!isFinite(num)) return;
      num = clamp(num, 1, 5);
      if (qReverse[qid]) num = 6 - num;
      // 위치 가중치 — 같은 평균이라도 패턴이 다르면 다른 hash
      h = (h * 31 + num * (idx + 1)) | 0;
    });
    (choiceQids || []).forEach(function(qid, ci){
      var arr = toArr(answers[qid]);
      arr.forEach(function(opt, oi){
        var s = String(opt || "").trim();
        for (var i=0; i<s.length; i++){
          h = (h * 33 + s.charCodeAt(i) + (ci+1)*7 + oi) | 0;
        }
      });
    });
    return Math.abs(h);
  }

  // 한국어 조사 처리: 받침 유무에 따라 을/를, 이/가, 으로/로 자동 선택
  function _hasJong(s){
    if (!s) return false;
    var ch = s.charAt(s.length - 1);
    var code = ch.charCodeAt(0);
    if (code < 0xAC00 || code > 0xD7A3) return false;
    return ((code - 0xAC00) % 28) !== 0;
  }
  function J(word, withJ, withoutJ){ return word + (_hasJong(word) ? withJ : withoutJ); }
  function Jeul(w){ return J(w, "을", "를"); }
  function Ji(w){ return J(w, "이", "가"); }
  function Jero(w){ return J(w, "으로", "로"); }
  // 조사만 반환 — 키워드를 따옴표 등으로 직접 쓸 때 사용 (이중 출력 방지)
  function P_eul(w){ return w ? (_hasJong(w) ? "을" : "를") : ""; }
  function P_i(w){ return w ? (_hasJong(w) ? "이" : "가") : ""; }
  function P_ero(w){ return w ? (_hasJong(w) ? "으로" : "로") : ""; }

  // 동적 본질(core) / 한마디(emotional) 문장 생성 — 4 variant × 3 level
  function buildAxisNarrative(axisKey, intensity, choiceKws, traits, values, fingerprint, lang){
    var isEn = (lang === "en");
    var lvl = intensity == null ? "mid" : (intensity >= 0.7 ? "high" : (intensity <= 0.4 ? "low" : "mid"));
    var k1 = choiceKws[0] || "";
    var k2 = choiceKws[1] || "";
    var k3 = choiceKws[2] || "";

    // 축에 분배된 trait/value 토큰 (개인성 강화)
    var tagsArr = (traits || []).concat(values || []);
    var tag1 = tagsArr[0] || "";
    var tag2 = tagsArr[1] || "";

    // EN 분기: 동일한 axisKey/lvl/vi 인덱스로 V_EN에서 EN 변형 선택 → 동적 개인화 유지
    if (isEn) {
      // 키워드/태그를 영문으로 변환
      var enMap = (CHOICE_KEYWORD_BY_AXIS_EN[axisKey] || {});
      // axisKey 매핑에 없으면 다른 4축에서도 검색
      function _toEnKw(ko){
        if (!ko) return "";
        if (enMap[ko]) return enMap[ko];
        var axes = ["self_understanding","self_expression","self_design","self_execution"];
        for (var i = 0; i < axes.length; i++){
          var m = CHOICE_KEYWORD_BY_AXIS_EN[axes[i]] || {};
          if (m[ko]) return m[ko];
        }
        return "";
      }
      var k1En = _toEnKw(k1);
      var k2En = _toEnKw(k2);
      var tag1En = TRAIT_VALUE_EN[tag1] || "";
      var AXIS_SALT_EN = { self_understanding: 0, self_expression: 1, self_design: 2, self_execution: 3 };
      var saltEn = AXIS_SALT_EN[axisKey] || 0;
      var viEn = (((fingerprint || 0) + saltEn * 7) % 4 + 4) % 4;
      var levelArrEn = (V_EN[axisKey] || {})[lvl] || (V_EN[axisKey] || {}).mid || [];
      var pickEn = levelArrEn[viEn % (levelArrEn.length || 1)] || {};
      var coreEn = (typeof pickEn.core === "function") ? pickEn.core(k1En, k2En, tag1En) : "";
      var emoEn  = (typeof pickEn.emo  === "function") ? pickEn.emo(k1En, k2En, tag1En)  : "";
      return {
        core: coreEn || (AXIS_BASELINE_EN[axisKey] || {}).core || "",
        emotional: emoEn || (AXIS_BASELINE_EN[axisKey] || {}).emotional || "",
        _variantIndex: viEn,
        _level: lvl
      };
    }

    // tag 활용형 추출 — 한 마디 템플릿에서 "X한 Y" / "X하게 Y" 자리에 쓰임
    // _adn(t): "X한" 자리에 들어갈 형태 (관형형). 예) 조용한→"조용한", 분석적인→"분석적인", 공감하는→"공감하는", 열정적인→"열정적인"
    // _adv(t): "X하게/X로" 자리에 들어갈 형태 (부사형). 예) 조용한→"조용하게", 분석적인→"분석적으로", 공감하는→"공감하며", 열정적인→"열정적으로"
    // 명사형(의미 추구, 사랑, 창의 등)인 경우 빈 문자열 반환 → emo 템플릿 fallback 유도
    function _adn(t){
      if (!t) return "";
      var s = String(t);
      if (/적인$/.test(s)) return s;                       // 분석적인, 열정적인 → 그대로
      if (/한$/.test(s))   return s;                       // 조용한 → 그대로
      if (/하는$/.test(s)) return s;                       // 공감하는 → 그대로
      return "";
    }
    function _adv(t){
      if (!t) return "";
      var s = String(t);
      if (/적인$/.test(s)) return s.replace(/인$/, "으로"); // 분석적인 → 분석적으로
      if (/한$/.test(s))   return s.replace(/한$/, "하게"); // 조용한 → 조용하게
      if (/하는$/.test(s)) return s.replace(/하는$/, "하며"); // 공감하는 → 공감하며
      return "";
    }
    var tAdn1 = _adn(tag1);
    var tAdn2 = _adn(tag2);
    var tAdv1 = _adv(tag1);
    var tAdv2 = _adv(tag2);
    // 하위 호환 별칭 (기존 코드가 tStem1/tStem2를 참조)
    var tStem1 = tAdn1;
    var tStem2 = tAdn2;

    // 축마다 다른 salt를 더해 같은 fingerprint도 축별로 다른 variant 선택
    var AXIS_SALT = { self_understanding: 0, self_expression: 1, self_design: 2, self_execution: 3 };
    var salt = AXIS_SALT[axisKey] || 0;
    var vi = (((fingerprint || 0) + salt * 7) % 4 + 4) % 4;

    var V = {
      self_understanding: {
        high: [
          { core: (k1 ? "‘"+k1+"’"+P_eul(k1)+" 단서로 자기 내면을 깊이 들여다보는 힘" : "자기 내면을 깊이 들여다보고 의미를 발견하는 힘"),
            emo:  (tAdn1 ? "‘"+tAdn1+" 나’의 깊이를 매일 다시 발견해 가는 사람" : "‘나는 왜 그렇게 느꼈을까’를 묻고 답을 스스로 찾는 사람") },
          { core: (k1 && k2 ? "‘"+k1+"’과 ‘"+k2+"’ 사이에서 자기 감정과 신념의 결을 정직하게 읽어내는 힘" : "자신의 감정·생각·신념을 정직하게 읽어내는 힘"),
            emo:  "‘나’라는 텍스트를 가장 성실하게 읽는 첫 번째 독자가 되는 사람" },
          { core: (k1 ? k1+P_eul(k1)+" 매개로 ‘나는 누구인가’를 끊임없이 다시 정의해 가는 힘" : "‘나는 누구인가’라는 질문을 두려워하지 않고 마주하는 힘"),
            emo:  "조용한 시간 속에서 자기 자신과 가장 깊이 대화하는 사람" },
          { core: "감정의 파동을 지나치지 않고, 그 안에서 자신만의 의미를 길어 올리는 힘",
            emo:  (k1 ? "‘"+k1+"’의 순간을 흘려보내지 않는 사람" : "‘작은 흔들림에도 의미가 있다’고 믿는 사람") }
        ],
        mid: [
          { core: (k1 ? k1+P_eul(k1)+" 통해 조금씩 자신을 이해해 가는 힘" : "자신의 마음을 천천히 살피며 의미를 발견하는 힘"),
            emo:  "‘조금 더 나를 이해하고 싶다’고 조용히 말하는 사람" },
          { core: "외부의 평가보다 내 안의 신호에 먼저 귀를 기울이는 힘",
            emo:  (tAdn1 ? "‘"+tAdn1+" 사람’으로 자신을 받아들이기 시작한 사람" : "‘아직 다 모르지만, 알아가는 중’이라고 말하는 사람") },
          { core: (k1 && k2 ? k1+"과 "+k2+" 사이를 오가며 자기 감정을 정리해 가는 힘" : "감정과 생각을 정리하며 자기 기준을 다듬는 힘"),
            emo:  "‘오늘의 나’와 ‘어제의 나’를 비교하며 성장하는 사람" },
          { core: "삶의 사건을 지나치지 않고, 거기서 자신을 다시 묻는 힘",
            emo:  "‘이 경험은 내게 무엇이었는가’를 잊지 않는 사람" }
        ],
        low: [
          { core: "행동과 관계 속에서 자기 자신을 점차 발견해 가는 단계의 힘",
            emo:  "‘내가 누구인지는 살아내며 알아간다’고 말하는 사람" },
          { core: "지금 당장 답을 내리기보다, 경험을 통해 자기 모습을 모아가는 힘",
            emo:  (k1 ? "‘"+k1+"’의 순간들을 모아 나를 만들어 가는 사람" : "‘답은 살면서 천천히 발견된다’고 믿는 사람") },
          { core: "자기 인식보다 행동·실천이 먼저 움직이는 외향적 자기이해의 힘",
            emo:  "‘부딪혀 봐야 내가 누구인지 안다’고 말하는 사람" },
          { core: "타인과의 관계 속 거울을 통해 자기 모습을 확인해 가는 힘",
            emo:  "‘함께 있는 시간이 곧 자기 발견의 시간’이라고 믿는 사람" }
        ]
      },
      self_expression: {
        high: [
          { core: (k1 ? "‘"+k1+"’"+P_ero(k1)+" 자신의 마음을 사람들에게 또렷하게 전달하는 힘" : "자신의 마음을 진정성 있게 전달하는 힘"),
            emo:  "‘나의 진심이 너에게 가닿기를’이라고 자연스럽게 말하는 사람" },
          { core: (k1 && k2 ? "‘"+k1+"’과 ‘"+k2+"’"+P_ero(k2)+" 자기 감정을 사람과 사람 사이에 풀어내는 힘" : "자기 감정을 사람과 사람 사이에 자연스럽게 풀어내는 힘"),
            emo:  (tAdn1 ? "‘"+tAdn1+"’ 결로 사람을 끌어안는 사람" : "‘말과 표정 모두 진심’인 사람") },
          { core: "감정을 숨기지 않으면서도 상대를 다치게 하지 않는, 따뜻한 표현의 힘",
            emo:  "‘함께 있으면 마음이 풀린다’는 말을 자주 듣는 사람" },
          { core: (k1 ? k1+P_eul(k1)+" 매개로 사람들의 마음을 잇는 힘" : "사람과 사람의 마음을 잇는 다리가 되는 힘"),
            emo:  "‘너의 이야기를 끝까지 듣는다’를 가장 잘하는 사람" }
        ],
        mid: [
          { core: (k1 ? k1+P_eul(k1)+" 매개로 자기 감정을 조심스럽게 드러내는 힘" : "자기 감정과 생각을 상황에 맞춰 표현하는 힘"),
            emo:  "‘들어주는 사람이 있다면 나도 말하고 싶다’고 느끼는 사람" },
          { core: "감정을 한 번 정리한 뒤 단단한 언어로 옮기는, 신중한 표현의 힘",
            emo:  (tAdn1 ? "‘"+tAdn1+" 침묵’ 안에 깊은 메시지를 담는 사람" : "‘말 한 마디에 마음을 담는다’고 믿는 사람") },
          { core: (k1 && k2 ? k1+"과 "+k2+P_eul(k2)+" 오가며 자기 감정을 다양하게 전달하는 힘" : "상황에 맞춰 감정 전달 방식을 바꾸는 힘"),
            emo:  "‘적절한 거리에서 가장 따뜻한 사람’으로 기억되는 사람" },
          { core: "큰 감정보다 작은 결을 정확히 전달하는 섬세한 표현의 힘",
            emo:  "‘디테일에서 진심이 보인다’고 자주 말하는 사람" }
        ],
        low: [
          { core: "행동과 침묵으로 마음을 전달하는, 표현보다 존재로 다가가는 힘",
            emo:  "‘말보다 함께 있는 시간으로 전한다’고 믿는 사람" },
          { core: "말 대신 돌봄·실천으로 자기 마음을 전하는 묵직한 표현의 힘",
            emo:  "‘안 한 말이 더 많은 사람’이지만 곁에 있으면 마음이 닿는 사람" },
          { core: (k1 ? k1+"의 행동으로 마음을 전하는 비언어적 표현의 힘" : "비언어적 신호로 마음을 전하는 깊은 표현의 힘"),
            emo:  "‘말보다 손길이 먼저 가는’ 사람" },
          { core: "꼭 필요한 순간에만 입을 여는, 절제된 표현의 힘",
            emo:  "‘말이 적어도 무게가 다른’ 사람" }
        ]
      },
      self_design: {
        high: [
          { core: (k1 ? "‘"+k1+"’"+P_eul(k1)+" 기준으로 삶의 방향과 루틴을 스스로 설계하는 힘" : "삶의 방향과 기준·루틴을 스스로 설계하는 힘"),
            emo:  "‘이렇게 살고 싶다’를 구체적인 그림으로 그릴 수 있는 사람" },
          { core: (k1 && k2 ? "‘"+k1+"’과 ‘"+k2+"’"+P_eul(k2)+" 두 축으로 자기 삶의 구조를 짜는 힘" : "여러 기준을 균형 있게 엮어 자기 삶의 구조를 짜는 힘"),
            emo:  (tAdn1 ? "‘"+tAdn1+" 설계자’로 자기 시간을 운영하는 사람" : "‘하루의 흐름이 곧 나의 철학’인 사람") },
          { core: "감정의 변동에도 흔들리지 않는 자기만의 운영체계를 만들어내는 힘",
            emo:  "‘오늘의 루틴이 내일의 나를 만든다’고 믿는 사람" },
          { core: (k1 ? k1+P_eul(k1)+" 핵심 원칙으로 삼아 결정의 일관성을 유지하는 힘" : "원칙의 일관성으로 결정의 무게를 떠받치는 힘"),
            emo:  "‘나의 기준은 흔들리지 않는다’고 말할 수 있는 사람" }
        ],
        mid: [
          { core: (k1 ? k1+P_eul(k1)+" 단서로 자기만의 기준을 다듬어 가는 힘" : "삶의 기준과 루틴을 점차 자기 언어로 정리해 가는 힘"),
            emo:  "‘나에게 맞는 길을 만들어 가는 중’이라고 말하는 사람" },
          { core: "큰 그림과 작은 일정을 동시에 살피며 균형을 맞춰가는 힘",
            emo:  (tAdn1 ? "‘"+tAdn1+" 균형’을 추구하는 사람" : "‘완벽보다 일관성’을 택하는 사람") },
          { core: (k1 && k2 ? k1+"과 "+k2+P_eul(k2)+" 오가며 자기 운영방식을 실험해 가는 힘" : "여러 방식을 시도하며 나에게 맞는 구조를 찾아가는 힘"),
            emo:  "‘완성보다 다듬어 가는 과정’을 즐기는 사람" },
          { core: "원칙은 단단하게, 실행은 유연하게 가져가는 적응형 설계의 힘",
            emo:  "‘기준은 있지만 길은 여러 개’라고 믿는 사람" }
        ],
        low: [
          { core: "유연하게 선택하며 경험을 통해 기준을 발견해 가는 힘",
            emo:  "‘정해두기보다 살아보며 정한다’고 말하는 사람" },
          { core: (k1 ? "‘"+k1+"’ 같은 직관적 신호로 그때그때 방향을 잡는 힘" : "상황과 직관으로 자기 방향을 발견해 가는 힘"),
            emo:  "‘계획보다 흐름’을 신뢰하는 사람" },
          { core: "체계보다 의미를 우선하는, 가치 중심의 자유로운 설계의 힘",
            emo:  "‘틀이 아니라 의미가 나를 이끈다’고 말하는 사람" },
          { core: "구조를 만들기보다 매 순간을 충실히 살아내며 길을 만드는 힘",
            emo:  "‘오늘 하루가 곧 나의 설계’라고 말하는 사람" }
        ]
      },
      self_execution: {
        high: [
          { core: (k1 ? "‘"+k1+"’"+P_ero(k1)+" 결정한 것을 행동과 결과로 만들어내는 힘" : "결정한 것을 실제 행동과 결과로 만들어내는 힘"),
            emo:  "‘끝까지 해낸다’를 행동으로 증명하는 사람" },
          { core: (k1 && k2 ? "‘"+k1+"’과 ‘"+k2+"’"+P_ero(k2)+" 시작과 마무리를 동시에 책임지는 추진력" : "시작과 마무리를 모두 책임지는 추진형 실행의 힘"),
            emo:  (tAdv1 ? "‘"+tAdv1+" 결과를 만들어내는’ 사람" : "‘말보다 결과로 답하는’ 사람") },
          { core: "어려운 환경에서도 멈추지 않고 결과를 끌어내는 회복형 추진력",
            emo:  "‘넘어져도 끝낸다’를 자기 정의로 삼는 사람" },
          { core: (k1 ? k1+P_eul(k1)+" 연료 삼아 한 번에 끝까지 밀어붙이는 몰입형 실행의 힘" : "한 번 시작하면 끝까지 밀고 가는 몰입형 실행의 힘"),
            emo:  "‘몰입의 한가운데서 가장 나다운 사람’이 되는 사람" }
        ],
        mid: [
          { core: (k1 ? k1+P_eul(k1)+" 동력으로 한 걸음씩 결과를 쌓아가는 힘" : "결정과 행동 사이의 거리를 좁혀 가는 꾸준함의 힘"),
            emo:  "‘작더라도 해낸 경험’이 자신을 움직이게 하는 사람" },
          { core: "큰 도약보다 작은 완수를 반복하며 신뢰를 쌓는 실행의 힘",
            emo:  (tAdn1 ? "‘"+tAdn1+" 꾸준함’으로 결과를 만드는 사람" : "‘오늘 한 걸음이 가장 큰 성과’라고 믿는 사람") },
          { core: (k1 && k2 ? k1+"과 "+k2+P_eul(k2)+" 번갈아 쓰며 일을 끝내가는 힘" : "여러 방식을 조합해 결과를 만들어 가는 힘"),
            emo:  "‘맞는 도구를 골라 끝내는 사람’이 되는 사람" },
          { core: "감정과 의지를 함께 다스리며 끝까지 가는 균형형 실행의 힘",
            emo:  "‘속도보다 완주’를 택하는 사람" }
        ],
        low: [
          { core: "구상과 의미를 충분히 다지고 움직이는 신중한 실행의 힘",
            emo:  "‘준비되면 한 번에 끝낸다’고 믿는 사람" },
          { core: "행동보다 의미·이유를 먼저 정리하는 내면 동기형 실행의 힘",
            emo:  "‘왜 하는가가 명확해야 손이 움직인다’는 사람" },
          { core: (k1 ? "‘"+k1+"’이 분명할 때 큰 추진력으로 움직이는 선택형 실행의 힘" : "조건이 갖춰질 때 결단력 있게 움직이는 선택형 실행의 힘"),
            emo:  "‘아무 일이나가 아니라 의미 있는 일을 끝까지’ 하는 사람" },
          { core: "자신의 페이스를 지키며 길게 가는 지속형 실행의 힘",
            emo:  "‘짧고 굵게보다 길고 단단하게’를 택하는 사람" }
        ]
      }
    };

    var levelArr = (V[axisKey] || {})[lvl] || (V[axisKey] || {}).mid || [];
    var pick = levelArr[vi % (levelArr.length || 1)] || {};
    return {
      core: pick.core || (AXIS_BASELINE[axisKey] || {}).core || "",
      emotional: pick.emo || (AXIS_BASELINE[axisKey] || {}).emotional || "",
      _variantIndex: vi,
      _level: lvl
    };
  }

  // 사용자의 응답에서 축별 키워드 추출
  function extractAxisKeywords(axisKey, answers){
    var map = CHOICE_KEYWORD_BY_AXIS[axisKey] || {};
    var qids = AXIS_CHOICE_QS[axisKey] || [];
    var found = [];
    qids.forEach(function(qid){
      var arr = toArr(answers[qid]).map(function(x){ return String(x || "").trim(); }).filter(Boolean);
      arr.forEach(function(opt){
        // 옵션 풀텍스트가 매핑에 있으면 키워드로 변환
        if (map[opt]) found.push(map[opt]);
      });
    });
    return unique(found);
  }

  function buildAxisCard(axisKey, axisPct, mapping, rules, traits, vibeTokens, tokenByAxis, answers, scaleMap, qReverse, lang) {
    var isEn = (lang === "en");
    var ax = (mapping.axes || {})[axisKey] || {};
    var baseline = isEn ? (AXIS_BASELINE_EN[axisKey] || {}) : (AXIS_BASELINE[axisKey] || {});

    // 1) 응답 강도 계산: 축 likert 평균(0~1)
    var likertAvg = axisLikertAvg(answers || {}, AXIS_LIKERT_QS[axisKey] || [], scaleMap || {}, qReverse || {});
    // 2) 응답 키워드 추출 (선택형 → 키워드) — 사용자 응답은 KO 텍스트가 들어오므로 매핑은 KO 기준
    var choiceKws = extractAxisKeywords(axisKey, answers || {});
    // 3) 응답 fingerprint — 같은 강도에서도 응답 패턴이 다르면 다른 변형이 선택되도록
    var fp = answerFingerprint(
      answers || {},
      AXIS_LIKERT_QS[axisKey] || [],
      scaleMap || {},
      qReverse || {},
      AXIS_CHOICE_QS[axisKey] || []
    );
    // 4) 축 분배된 trait/value 토큰 (자기다운 형용/가치 단어)
    var ownedTokens = (tokenByAxis && tokenByAxis[axisKey]) ? tokenByAxis[axisKey] : [];
    // 5) 본질 / 한 마디 — 강도 × 키워드 × fingerprint × tag 로 동적 생성 (4 variant × 3 level)
    var narrative = buildAxisNarrative(axisKey, likertAvg, choiceKws, ownedTokens, vibeTokens || [], fp, lang);

    // 4) 키워드 4개: 응답 키워드 우선, 부족 시 baseline.strengths 보강
    //    어간 동일(예: "열정" vs "열정적인", "공감" vs "공감하는")인 토큰은 한 개만 남김
    function _kwRoot(t){
      if (!t) return "";
      var s = String(t);
      return s.replace(/적인$/, "").replace(/한$/, "").replace(/하는$/, "").replace(/스러운$/, "");
    }
    function uniqByRoot(arr){
      var seen = {}, out = [];
      for (var i = 0; i < arr.length; i++) {
        var t = arr[i];
        if (!t) continue;
        var r = _kwRoot(t);
        if (!r) r = String(t);
        if (seen[r]) continue;
        seen[r] = true;
        out.push(t);
      }
      return out;
    }

    // EN 모드에서는 KO 응답 키워드/owned 토큰을 EN으로 변환 후 사용
    function _toEnKwAny(ko){
      if (!ko) return "";
      var axes = ["self_understanding","self_expression","self_design","self_execution"];
      for (var i = 0; i < axes.length; i++){
        var m = CHOICE_KEYWORD_BY_AXIS_EN[axes[i]] || {};
        if (m[ko]) return m[ko];
      }
      // trait/value 사전에서도 검색
      if (TRAIT_VALUE_EN[ko]) {
        var s = TRAIT_VALUE_EN[ko];
        return s.charAt(0).toUpperCase() + s.slice(1);
      }
      return "";
    }
    var owned = (tokenByAxis && tokenByAxis[axisKey]) ? tokenByAxis[axisKey] : [];
    var poolSrc;
    if (isEn) {
      var choiceKwsEn = (choiceKws || []).map(_toEnKwAny).filter(Boolean);
      var ownedEn = (owned || []).map(_toEnKwAny).filter(Boolean);
      poolSrc = [].concat(choiceKwsEn, ownedEn, baseline.strengths || []);
    } else {
      poolSrc = [].concat(choiceKws, owned, baseline.strengths || []);
    }
    var pool = uniqByRoot(poolSrc);
    var keywords = pool.slice(0, 4);
    while (keywords.length < 4) {
      var fb = (baseline.strengths || (isEn ? ["Self-reflection"] : ["성찰"]));
      keywords.push(fb[keywords.length % fb.length]);
    }
    keywords = uniqByRoot(keywords).slice(0, 4);
    while (keywords.length < 4) {
      var fb2 = (baseline.strengths || (isEn ? ["Self-reflection"] : ["성찰"]));
      keywords.push(fb2[(keywords.length+1) % fb2.length] + (isEn ? " (extended)" : "·확장"));
    }

    return {
      id: axisKey,
      icon: ax.icon || "",
      title: isEn ? (ax.english || ax.title || axisKey) : (ax.title || axisKey),
      english: ax.english || "",
      pct: Math.round(axisPct || 0),
      core: narrative.core,
      emotional: narrative.emotional,
      keywords: keywords,
      _debug: { likertAvg: likertAvg, choiceKws: choiceKws }
    };
  }

  // 응답 토큰을 4축에 분배: trait/value 키워드를 어떤 축에 배치할지 휴리스틱으로 결정
  function distributeTokensToAxes(tokens) {
    var byAxis = { self_understanding:[], self_expression:[], self_design:[], self_execution:[] };
    // 직관적 매핑: trait → 축
    var TRAIT_AXIS = {
      "조용한":"self_understanding","신중한":"self_understanding","분석적인":"self_understanding","공감하는":"self_expression",
      "따뜻한":"self_expression","열정적인":"self_execution","도전적인":"self_execution","성취지향적인":"self_execution",
      "계획적인":"self_design","현실적인":"self_design","창의적인":"self_design","느긋한":"self_understanding"
    };
    // value(Q13) → 축
    var VALUE_AXIS = {
      "정직":"self_design","책임":"self_design","절제":"self_design","질서":"self_design","공정":"self_design",
      "성장":"self_execution","도전":"self_execution","성취":"self_execution","몰입":"self_execution","창의":"self_design","의미 추구":"self_understanding",
      "사랑":"self_expression","신뢰":"self_expression","배려":"self_expression","포용":"self_expression","협동":"self_expression","헌신":"self_expression",
      "자유":"self_understanding","평화":"self_understanding"
    };
    (tokens || []).forEach(function(tk){
      var t = String(tk).trim();
      var ax = TRAIT_AXIS[t] || VALUE_AXIS[t];
      if (ax && byAxis[ax]) byAxis[ax].push(t);
    });
    return byAxis;
  }

  // ──────────────────────────────────────────────────────────
  // 5. 강점/성장 추출
  // ──────────────────────────────────────────────────────────
  function buildGrowthMap(scores, axisRanking, traits, lang) {
    var isEn = (lang === "en");
    var BASELINE = isEn ? AXIS_BASELINE_EN : AXIS_BASELINE;
    var GROWTH = isEn ? AXIS_GROWTH_EN : AXIS_GROWTH;

    // 강점 TOP3: 축 정규화 점수 상위 2축의 baseline.strengths + traits 조합
    var top2 = axisRanking.slice(0, 2).map(function(x){ return x.axis; });
    var strengths = [];
    top2.forEach(function(ax){
      var lib = BASELINE[ax] || {};
      strengths = strengths.concat(lib.strengths || []);
    });
    // EN 모드: traits(KO) → EN 변환
    var traitsForList = traits || [];
    if (isEn) {
      traitsForList = traitsForList.map(function(t){
        if (TRAIT_VALUE_EN[t]) {
          var s = TRAIT_VALUE_EN[t];
          return s.charAt(0).toUpperCase() + s.slice(1);
        }
        return "";
      }).filter(Boolean);
    }
    strengths = unique([].concat(traitsForList, strengths)).slice(0, 3);

    // 성장 포인트 TOP2: 하위 1축 AXIS_GROWTH + (필요 시 중간축)
    var bot = axisRanking[axisRanking.length - 1];
    var midGrowth = (axisRanking[axisRanking.length - 2] || {}).axis;
    var growth = [];
    if (bot) growth = growth.concat(GROWTH[bot.axis] || []);
    if (growth.length < 2 && midGrowth) growth = growth.concat(GROWTH[midGrowth] || []);
    growth = unique(growth).slice(0, 2);
    while (growth.length < 2) growth.push(isEn ? "Challenge in new territory and recovery routines" : "새로운 영역 도전과 회복 루틴");
    return { strengths: strengths, growth: growth };
  }

  // ──────────────────────────────────────────────────────────
  // 6. 실행 프로파일 카드
  //    Q47(몰입 장소·multi_choice) → environment
  //    Q39(활동 유형·multi_choice) + Q40(기타) + Q41(열정 주제·multi_choice) → activities
  //    Q49(하루 리듬·multi_choice) + Q73(성취 조건·single_choice) → tools/루틴
  //    likert(Q43,Q44,Q45)는 점수 산정용일 뿐, 카드 텍스트로 직접 쓰지 않음
  // ──────────────────────────────────────────────────────────
  function joinChoiceList(arr, fallback, sep){
    sep = sep || ", ";
    var clean = (arr || []).map(function(x){ return String(x || "").trim(); }).filter(Boolean);
    return clean.length ? clean.slice(0, 3).join(sep) : fallback;
  }
  function buildExecutionProfile(toneSel, answers, valuesText, careerField, lang, mapping) {
    var isEn = (lang === "en");
    var v = toneSel.variant || {};

    // mapping.i18n_en 사전 (있을 때만 사용)
    var i18nEn = (mapping && mapping.i18n_en) || {};
    var domainLabelEn = i18nEn.domainLabel || {};
    var topicLabelEn = i18nEn.topicLabel || {};
    var achievementEn = i18nEn.achievementMomentLabel || {};
    var rhythmEn = i18nEn.rhythmLabel || {};
    var placeEn = i18nEn.placeLabel || {};
    var activityEn = i18nEn.activityLabel || {};

    // EN 모드: KO 응답 텍스트를 영문 키워드로 변환 (도메인/토픽/장소/리듬/활동/성취/축키워드/trait 순)
    function _enFromAny(ko){
      if (!ko) return "";
      if (domainLabelEn[ko]) return domainLabelEn[ko];
      if (topicLabelEn[ko]) return topicLabelEn[ko];
      if (placeEn[ko]) return placeEn[ko];
      if (rhythmEn[ko]) return rhythmEn[ko];
      if (activityEn[ko]) return activityEn[ko];
      if (achievementEn[ko]) return achievementEn[ko];
      var axes = ["self_understanding","self_expression","self_design","self_execution"];
      for (var i = 0; i < axes.length; i++){
        var m = CHOICE_KEYWORD_BY_AXIS_EN[axes[i]] || {};
        if (m[ko]) return m[ko];
      }
      if (TRAIT_VALUE_EN[ko]) {
        var s = TRAIT_VALUE_EN[ko];
        return s.charAt(0).toUpperCase() + s.slice(1);
      }
      return "";
    }
    function _toEnList(arr){
      return (arr || []).map(function(x){
        return _enFromAny(String(x || "").trim());
      }).filter(Boolean);
    }

    var driversFallback = isEn ? "Trust, Growth, Responsibility" : "신뢰, 성장, 책임";
    var drivers = isEn
      ? joinChoiceList(_toEnList(valuesText), driversFallback)
      : joinChoiceList(valuesText, driversFallback);

    // 몰입 환경: Q47(장소) + Q49(리듬) 조합
    var placesKo = getChoiceArray(answers, "Q47");
    var rhythmsKo = getChoiceArray(answers, "Q49");
    var places = isEn ? _toEnList(placesKo) : placesKo;
    var rhythms = isEn ? _toEnList(rhythmsKo) : rhythmsKo;
    var envParts = [];
    if (places.length) envParts.push(places.slice(0, 2).join(", "));
    if (rhythms.length) envParts.push(rhythms.slice(0, 1).join(""));
    var envFallback = isEn
      ? "Quiet, focus-friendly environment with clear goals"
      : "조용하고 집중할 수 있는 환경, 명확한 목표";
    var environment = envParts.length ? envParts.join(" / ") : envFallback;

    // 잘 맞는 활동: Q39(활동 유형) + Q40(기타) + Q41(열정 주제)
    var actsKo = getChoiceArray(answers, "Q39");
    var actsExtraKo = (answers["Q40"] && typeof answers["Q40"] === "string") ? [answers["Q40"]] : [];
    var topicsKo = getChoiceArray(answers, "Q41");
    var actAllKo = unique([].concat(actsKo, actsExtraKo, topicsKo));
    var actsFallback = isEn ? "Planning · Design · Coaching" : "기획·설계·코칭";
    var actAll = isEn ? _toEnList(actAllKo) : actAllKo;
    var activities = actAll.length ? actAll.slice(0, 3).join(", ") : actsFallback;

    // 추천 도구/전략: Q73(성취 조건) + 톤별 기본 루틴
    var toneRoutine = {
      principled_designer: "주간 원칙 점검 · 분기 회고 일지 · 의사결정 프레임",
      warm_connector:     "감사 루틴 · 1:1 미팅 루틴 · 감정 일기",
      visionary_creator:  "아이디어 캡처 · 창작 루틴 · 발행 루틴",
      pragmatic_achiever: "주간 KPI 점검 · 실행 보드 · 회고 루틴",
      reflective_explorer:"성찰 일지 · 독서 루틴 · 명상 루틴"
    };
    var toneRoutineEn = {
      principled_designer: "Weekly principle review · Quarterly retrospective journal · Decision frameworks",
      warm_connector:     "Gratitude routine · 1:1 meeting routine · Emotional journal",
      visionary_creator:  "Idea capture · Creation routine · Publishing routine",
      pragmatic_achiever: "Weekly KPI review · Execution board · Retrospective routine",
      reflective_explorer:"Reflection journal · Reading routine · Meditation routine"
    };
    var baseTools = isEn
      ? (toneRoutineEn[toneSel.key] || "Gratitude routine · Retrospective routine · Review routine")
      : (toneRoutine[toneSel.key] || "감사 루틴 · 회고 루틴 · 점검 루틴");
    var q73Ko = (answers["Q73"] && typeof answers["Q73"] === "string") ? answers["Q73"] : "";
    var q73Used = isEn ? (q73Ko ? (_enFromAny(q73Ko) || q73Ko) : "") : q73Ko;
    var tools = q73Used ? (q73Used + " · " + baseTools) : baseTools;

    var typeFallback = isEn ? "Balanced practitioner" : "균형형 실행가";
    var styleFallback = isEn ? "Balance-centered" : "균형 중심형";
    return {
      type: (isEn ? (v.executionType_en || v.executionType) : v.executionType) || typeFallback,
      style: (isEn ? (v.executionStyle_en || v.executionStyle) : v.executionStyle) || styleFallback,
      drivers: drivers,
      environment: environment,
      activities: activities,
      tools: tools
    };
  }

  // ──────────────────────────────────────────────────────────
  // 7. 사명·비전 슬롯
  // ──────────────────────────────────────────────────────────
  function buildMissionVision(toneSel, name, answers, careerField, lang, mapping) {
    var isEn = (lang === "en");
    var v = toneSel.variant || {};
    var values = getChoiceArray(answers, "Q13");

    // mapping.i18n_en 사전 (있을 때만 사용)
    var i18nEn = (mapping && mapping.i18n_en) || {};
    var domainLabelEn = i18nEn.domainLabel || {};
    var topicLabelEn = i18nEn.topicLabel || {};

    // EN 변환 헬퍼: 우선 mapping.i18n_en (도메인/토픽), 그 다음 axis 키워드, 마지막 trait/value
    function _enFromAny(ko){
      if (!ko) return "";
      if (domainLabelEn[ko]) return domainLabelEn[ko];
      if (topicLabelEn[ko]) return topicLabelEn[ko];
      var axes = ["self_understanding","self_expression","self_design","self_execution"];
      for (var i = 0; i < axes.length; i++){
        var m = CHOICE_KEYWORD_BY_AXIS_EN[axes[i]] || {};
        if (m[ko]) return m[ko];
      }
      if (TRAIT_VALUE_EN[ko]) {
        var s = TRAIT_VALUE_EN[ko];
        return s.charAt(0).toUpperCase() + s.slice(1);
      }
      return "";
    }
    function _toEnList(arr){
      return (arr || []).map(function(x){
        return _enFromAny(String(x || "").trim());
      }).filter(Boolean);
    }

    var valuesEn = isEn ? _toEnList(values) : null;
    var valuesPhrase = isEn
      ? ((valuesEn && valuesEn.slice(0, 3).join(" · ")) || "Trust · Growth · Responsibility")
      : (values.slice(0, 3).join("·") || "신뢰·성장·책임");

    var topicKo = answers["Q41"] || "";
    var topicEn = topicKo ? (_enFromAny(topicKo) || topicKo) : "";
    var topic = isEn
      ? (topicEn || "Connecting people and meaning")
      : (topicKo || "사람과 의미를 잇는 일");

    var domainsKo = getChoiceArray(answers, "Q75");
    var domainsEn = isEn ? _toEnList(domainsKo) : null;
    var domain = isEn
      ? ((domainsEn && domainsEn.slice(0, 2).join(" · ")) || "Life and work")
      : (domainsKo.slice(0, 2).join("·") || "삶과 일");

    var dream = answers["Q37"] || ""; // 꿈/되고 싶은 모습

    var triggerKo = answers["Q41"] || answers["Q75"] || "";
    var triggerEn = triggerKo ? (_enFromAny(triggerKo) || triggerKo) : "";
    var trigger = isEn
      ? (triggerEn || "Topic of interest")
      : (triggerKo || "관심 주제");

    function fill(tpl){
      if (!tpl) return "";
      return tpl
        .replace(/{name}/g, name || (isEn ? "you" : "당신"))
        .replace(/{values}/g, valuesPhrase)
        .replace(/{domain}/g, domain)
        .replace(/{career_field}/g, careerField || domain)
        .replace(/{topic}/g, topic)
        .replace(/{trigger}/g, trigger);
    }

    var missionTpl = isEn
      ? (v.missionTone_en || "Your mission is to 'live out your values in life and create good influence on the people around you.'")
      : (v.missionTone || "당신의 사명은 '자신의 가치를 삶으로 살아내며 사람들에게 선한 영향력을 미치는 것' 입니다.");
    var visionTpl = isEn
      ? (v.visionTone_en || "Your vision is 'to grow into someone who creates meaningful change through your strengths and mission.'")
      : (v.visionTone || "당신의 비전은 '자신의 강점과 사명을 통해 의미 있는 변화를 만들어내는 사람으로 성장하는 것' 입니다.");

    var mission = fill(missionTpl);
    var vision  = fill(visionTpl);

    var footer = isEn
      ? ("🔍 Derived from your activity response (" + trigger + ") and self-reflection patterns.")
      : ("🔍 활동 응답(" + trigger + ")과 자기성찰 성향을 기반으로 도출되었습니다.");

    return {
      missionText: mission,
      visionText: vision,
      footer: footer,
      values: values,
      valuesPhrase: valuesPhrase,
      domain: domain,
      topic: topic,
      dream: dream
    };
  }

  // ──────────────────────────────────────────────────────────
  // 8. 활용 예시 + 첫 행동 3가지
  //   PR#60-B: 진단 응답 직접 결합
  //   - 톤 기본값을 베이스로 깔되, 사용자의 실제 응답(Q39/Q41/Q47/Q49/Q73)
  //     과 강점/약점 축을 본문에 직접 합성한다.
  //   - 직무(job)        ← Q39(흥미 활동) + Q41(주제) + 톤 베이스
  //   - 학습(learning)   ← Q41(관심 주제) + 톤 베이스
  //   - 실행 과제(tasks) ← Q73(성취 조건) + Q47/Q49(환경/루틴) + 톤 베이스
  //   - 첫 행동 3가지    ← [Q39 1줄, Q73 1줄, Q47/Q49 1줄] 합성
  //   목표: PR#60-D 검증 게이트 19번(application_injected_answers) 통과
  // ──────────────────────────────────────────────────────────
  function buildApplication(toneSel, answers, careers, education, lang) {
    var isEn = (lang === "en");
    // ── 톤 기본 베이스 (PR#59 이전 매핑 유지) ──
    var jobMap = {
      principled_designer: "원칙·구조 기반 전략 설계 / 멘토링",
      warm_connector:     "관계 중심 리더십 운영 / 코칭",
      visionary_creator:  "콘텐츠·기획을 통한 의미 창출",
      pragmatic_achiever: "목표·KPI 중심의 실행 운영",
      reflective_explorer:"통찰형 리서치·콘텐츠 제작"
    };
    var jobMapEn = {
      principled_designer: "Principle- and structure-based strategy design / Mentoring",
      warm_connector:     "Relationship-centered leadership / Coaching",
      visionary_creator:  "Meaning-making through content and planning",
      pragmatic_achiever: "Goal- and KPI-driven execution operations",
      reflective_explorer:"Insight-driven research and content creation"
    };
    var learnMap = {
      principled_designer: "전략·시스템 사고, 의사결정 프레임 학습",
      warm_connector:     "코칭·심리학·갈등관리 학습",
      visionary_creator:  "스토리텔링·창작·브랜딩 학습",
      pragmatic_achiever: "PM·운영·OKR 학습",
      reflective_explorer:"철학·인문·자기성찰 학습"
    };
    var learnMapEn = {
      principled_designer: "Strategy & systems thinking, decision-making frameworks",
      warm_connector:     "Coaching · Psychology · Conflict management",
      visionary_creator:  "Storytelling · Creation · Branding",
      pragmatic_achiever: "PM · Operations · OKR",
      reflective_explorer:"Philosophy · Humanities · Self-reflection"
    };
    var taskMap = {
      principled_designer: "주간 원칙 점검 / 분기 회고 / 의사결정 일지",
      warm_connector:     "감사 루틴 / 1:1 미팅 루틴 / 감정 일기",
      visionary_creator:  "아이디어 캡처 / 창작 루틴 / 발행 루틴",
      pragmatic_achiever: "주간 KPI 점검 / 실행 보드 / 회고 루틴",
      reflective_explorer:"성찰 일지 / 독서 루틴 / 명상 루틴"
    };
    var taskMapEn = {
      principled_designer: "Weekly principle review / Quarterly retrospective / Decision journal",
      warm_connector:     "Gratitude routine / 1:1 meeting routine / Emotional journal",
      visionary_creator:  "Idea capture / Creation routine / Publishing routine",
      pragmatic_achiever: "Weekly KPI review / Execution board / Retrospective routine",
      reflective_explorer:"Reflection journal / Reading routine / Meditation routine"
    };
    var first = {
      principled_designer: ["주 1회 의사결정 일지 시작하기","핵심 원칙 3개 문장으로 정의하기","멘티/동료에게 30분 코칭 제안하기"],
      warm_connector:     ["주 1회 감사 메시지 3명에게 보내기","월 1회 1:1 미팅 정례화","감정 일기 5분 시작하기"],
      visionary_creator:  ["아이디어 노트 매일 5분","주 1회 짧은 글/콘텐츠 발행","월 1회 새 영감 탐험"],
      pragmatic_achiever: ["월간 OKR 1개 설정","주 1회 회고 30분","실행 보드(칸반) 가동"],
      reflective_explorer:["하루 10분 성찰 일지","주 1권 독서 + 한 줄 정리","주 1회 침묵·명상 시간"]
    };
    var firstEn = {
      principled_designer: ["Start a weekly decision journal","Define 3 core principles in single sentences","Offer a 30-min coaching session to a mentee/colleague"],
      warm_connector:     ["Send gratitude messages to 3 people once a week","Hold a regular 1:1 meeting once a month","Begin a 5-minute emotional journal"],
      visionary_creator:  ["Spend 5 minutes a day on an idea note","Publish a short piece/content once a week","Explore new inspiration once a month"],
      pragmatic_achiever: ["Set 1 monthly OKR","Hold a 30-minute weekly retrospective","Run a Kanban execution board"],
      reflective_explorer:["10-minute daily reflection journal","Read 1 book per week + one-line summary","Take a weekly silence/meditation time"]
    };
    var key = toneSel.key || "principled_designer";

    // ── PR#60-B: 진단 응답 직접 합성 ──
    function _arr(qk){
      var v = answers && answers[qk];
      if (v == null) return [];
      if (Array.isArray(v)) return v.map(function(x){ return String(x).trim(); }).filter(Boolean);
      return String(v).split(/\s*[\/,]\s*/).map(function(x){ return x.trim(); }).filter(Boolean);
    }
    var q39 = _arr("Q39"); // 흥미 활동
    var q41 = _arr("Q41"); // 관심 주제
    var q47 = _arr("Q47"); // 몰입 환경 (공간)
    var q49 = _arr("Q49"); // 몰입 루틴 (시간)
    var q73 = _arr("Q73"); // 성취 조건

    var jobBase   = isEn ? jobMapEn[key]   : jobMap[key];
    var learnBase = isEn ? learnMapEn[key] : learnMap[key];
    var taskBase  = isEn ? taskMapEn[key]  : taskMap[key];
    var firstBase = (isEn ? firstEn[key] : first[key]).slice();

    // 직무: 톤 베이스 + Q39 1순위 + Q41 1순위
    var jobOut = jobBase;
    if (!isEn) {
      var jobAdd = [];
      if (q39[0]) jobAdd.push(q39[0]);
      if (q41[0]) jobAdd.push(q41[0]);
      if (jobAdd.length) {
        jobOut = jobBase + " · 응답 결합: " + jobAdd.join(" · ");
      }
    } else {
      var jobAddEn = [];
      if (q39[0]) jobAddEn.push(q39[0]);
      if (q41[0]) jobAddEn.push(q41[0]);
      if (jobAddEn.length) jobOut = jobBase + " · combined: " + jobAddEn.join(" · ");
    }

    // 학습: 톤 베이스 + Q41 (관심 주제) — 학습 연계
    var learnOut = learnBase;
    if (q41.length) {
      learnOut = isEn
        ? (learnBase + " · related to: " + q41.slice(0,2).join(", "))
        : (learnBase + " · 관심 주제 연계: " + q41.slice(0,2).join(" · "));
    }

    // 실행 과제: 톤 베이스 + Q73 1순위 (성취 조건) + Q47/Q49 환경
    var taskOut = taskBase;
    var taskAdd = [];
    if (q73[0]) taskAdd.push(q73[0]);
    if (q47[0] || q49[0]) {
      var env = (q47[0] || "") + (q49[0] ? (q47[0] ? " / " : "") + q49[0] : "");
      if (env) taskAdd.push(env);
    }
    if (taskAdd.length) {
      taskOut = isEn
        ? (taskBase + " · custom: " + taskAdd.join(" / "))
        : (taskBase + " · 맞춤 결합: " + taskAdd.join(" / "));
    }

    // 첫 행동 3가지: Q39/Q73/Q47·Q49 응답으로 1행씩 직접 생성, 부족분은 톤 베이스에서 채움
    var firstOut = [];
    if (q39[0]) {
      firstOut.push(isEn
        ? ("Spend 30 minutes weekly on '" + q39[0] + "'")
        : ("주 1회 30분, '" + q39[0] + "' 시도하기"));
    }
    if (q73[0]) {
      firstOut.push(isEn
        ? ("Apply your achievement condition '" + q73[0] + "' to one task this week")
        : ("이번 주 1건에 성취 조건 '" + q73[0] + "' 적용하기"));
    }
    if (q47[0] || q49[0]) {
      var envFirst = q47[0] ? q47[0] : q49[0];
      firstOut.push(isEn
        ? ("Set up your immersion environment: " + envFirst)
        : ("몰입 환경 셋업: " + envFirst));
    }
    // 부족분은 톤 베이스에서 보충 (총 3개)
    while (firstOut.length < 3) {
      var fb = firstBase.shift();
      if (!fb) break;
      firstOut.push(fb);
    }
    firstOut = firstOut.slice(0, 3);

    return {
      job: jobOut,
      learning: learnOut,
      tasks: taskOut,
      firstActions: firstOut,
      // PR#60-B: 디버그·검증용 메타 (UI 노출 안 함)
      _injected: {
        q39: q39.slice(0,2),
        q41: q41.slice(0,2),
        q47: q47.slice(0,1),
        q49: q49.slice(0,1),
        q73: q73.slice(0,1),
        toneKey: key
      }
    };
  }

  // ──────────────────────────────────────────────────────────
  // 9. 메인 빌더
  // ──────────────────────────────────────────────────────────
  function build(input) {
    var questions = input.questions;
    var mapping   = input.mapping;
    var rules     = input.rules;
    var answers   = input.answers || {};
    var profile   = input.profile || {};
    var lang      = (input.lang === "en") ? "en" : "ko";
    var isEn      = (lang === "en");

    if (!questions || !mapping || !rules) {
      throw new Error("ReportEngine.build: questions/mapping/rules 가 필요합니다.");
    }

    var name = (profile.name || answers.Q1 || (isEn ? "Guest" : "고객")).trim();
    var submittedAt = profile.submittedAt || new Date();
    var submittedDate = fmtDate(submittedAt);

    // 점수
    var scores = computeScores(questions, mapping, answers);

    // 톤
    var toneSel = selectTone(scores, answers, mapping, rules);

    // Traits (Q6 성향) / 가치 (Q13)
    var traits = getChoiceArray(answers, "Q6");
    var values = getChoiceArray(answers, "Q13");

    // 진로·교육
    var ce = pickCareerEducation(answers, mapping, (rules.writingRules && rules.writingRules.career_education && rules.writingRules.career_education.careersCount) || 3, lang);
    var careerFieldKo = (ce.sourceDomains && ce.sourceDomains[0]) || "삶과 일";
    var careerField = careerFieldKo;
    if (isEn) {
      // mapping.i18n_en 사전 우선, 그 다음 axis 키워드 사전
      var i18nEnRoot = (mapping && mapping.i18n_en) || {};
      var domainLabelEnRoot = i18nEnRoot.domainLabel || {};
      careerField = domainLabelEnRoot[careerFieldKo] || "";
      if (!careerField) {
        var _axes_cf = ["self_understanding","self_expression","self_design","self_execution"];
        var _foundCf = "";
        for (var _ai = 0; _ai < _axes_cf.length; _ai++){
          var _m_cf = CHOICE_KEYWORD_BY_AXIS_EN[_axes_cf[_ai]] || {};
          if (_m_cf[careerFieldKo]) { _foundCf = _m_cf[careerFieldKo]; break; }
        }
        careerField = _foundCf || (TRAIT_VALUE_EN[careerFieldKo]
          ? (TRAIT_VALUE_EN[careerFieldKo].charAt(0).toUpperCase() + TRAIT_VALUE_EN[careerFieldKo].slice(1))
          : "Life and work");
      }
    }

    // 사명/비전
    var mv = buildMissionVision(toneSel, name, answers, careerField, lang, mapping);

    // 실행 프로파일
    var ep = buildExecutionProfile(toneSel, answers, values, careerField, lang, mapping);

    // 강점/성장
    var gm = buildGrowthMap(scores, scores.axisRanking, traits, lang);

    // 활용
    var app = buildApplication(toneSel, answers, ce.careers, ce.education, lang);

    // 4축 카드 — 응답 likert 강도 + 선택형 키워드를 축별로 사용해 본질/한마디/키워드를 차별화
    var tokenByAxis = distributeTokensToAxes([].concat(traits, values));
    var scaleMap = (questions.likertScores) || {};
    var qReverseAll = {};
    (questions.sections || []).forEach(function(sec){
      (sec.questions || []).forEach(function(q){ qReverseAll[q.id] = !!q.reverse; });
    });
    var fourAxes = ["self_understanding","self_expression","self_design","self_execution"].map(function(ax){
      return buildAxisCard(ax, scores.axisPct[ax], mapping, rules, traits, values, tokenByAxis, answers, scaleMap, qReverseAll, lang);
    });

    // 헤더 / 요약 (1단)
    var v = toneSel.variant || {};
    function fillTokens(tpl){
      if (!tpl) return "";
      return tpl
        .replace(/{name}/g, name)
        .replace(/{values}/g, mv.valuesPhrase)
        .replace(/{domain}/g, mv.domain)
        .replace(/{career_field}/g, careerField);
    }
    var headerTpl = isEn
      ? ((rules.writingRules && rules.writingRules.summary && rules.writingRules.summary.headerTemplate_en) || "{name}'s Life Portfolio")
      : ((rules.writingRules && rules.writingRules.summary && rules.writingRules.summary.headerTemplate) || (name + "님의 인생포트폴리오"));
    var header = headerTpl.replace(/{name}/g, name);

    var labelLocal = isEn
      ? (v.label_en || v.label || "Balanced leader")
      : (v.label || "균형형 리더");
    var headerLine = isEn
      ? (v.header_en || ((mv.valuesPhrase) + "-centered " + labelLocal + " — someone who connects values to life"))
      : (v.header || ((mv.valuesPhrase) + " 중심의 " + labelLocal + " — 자신의 가치를 삶으로 연결하는 사람"));
    var coreOneLineTpl = isEn
      ? (v.coreOneLine_en || (name + " connects their values to life and creates meaningful change."))
      : (v.coreOneLine || (name + "님은 자신의 가치를 삶으로 연결해 의미 있는 변화를 만들어내는 사람입니다."));
    var typeLine = fillTokens(headerLine);
    var coreOneLine = fillTokens(coreOneLineTpl);

    // 자동 안내 / 메타 고정 문구 (rules.writingRules.report_meta / auto_notice)
    var metaFixed = isEn
      ? ((rules.writingRules && rules.writingRules.report_meta && (rules.writingRules.report_meta.fixedText_en || rules.writingRules.report_meta.fixedText)) || "")
      : ((rules.writingRules && rules.writingRules.report_meta && rules.writingRules.report_meta.fixedText) || "");
    var autoNotice = isEn
      ? ((rules.writingRules && rules.writingRules.auto_notice && (rules.writingRules.auto_notice.fixedText_en || rules.writingRules.auto_notice.fixedText)) || "")
      : ((rules.writingRules && rules.writingRules.auto_notice && rules.writingRules.auto_notice.fixedText) || "");

    // 섹션 제목 사전: rules.structure.order의 title_en 우선, 없으면 EN 폴백
    var orderArr = (rules.structure && rules.structure.order) || [];
    var orderById = {};
    orderArr.forEach(function(s){ orderById[s.id] = s; });
    var EN_SECTION_TITLES = {
      summary: "Overall Summary",
      mission_vision: "Mission & Vision",
      execution_profile: "Execution Profile",
      growth_map: "Growth Roadmap",
      career_education: "Career & Education Curation",
      application: "Application & Next Steps",
      self_understanding: "Self-Understanding",
      self_expression: "Self-Expression",
      self_design: "Self-Design",
      self_execution: "Self-Execution",
      summary_close: "In Summary",
      report_meta: "About this report"
    };
    function _secTitle(id, fallbackKo){
      if (isEn) {
        var ent = orderById[id] || {};
        return ent.title_en || EN_SECTION_TITLES[id] || fallbackKo;
      }
      return fallbackKo;
    }

    // ── 12 섹션 출력 빌드 (rules.structure.order 순서 유지)
    var sections = [];
    var iconByStep = {};
    orderArr.forEach(function(s){ iconByStep[s.id] = s.icon; });

    sections.push({
      step: 1, id: "summary", icon: iconByStep.summary || "📘", title: _secTitle("summary", "전체 요약 문장"),
      content: {
        header: header,
        submittedAt: submittedDate,
        typeLine: typeLine,
        coreOneLine: coreOneLine
      }
    });

    sections.push({
      step: 2, id: "mission_vision", icon: iconByStep.mission_vision || "🟦", title: _secTitle("mission_vision", "사명 & 비전 제안 문장"),
      content: {
        mission: mv.missionText,
        vision: mv.visionText,
        footer: mv.footer
      }
    });

    sections.push({
      step: 3, id: "execution_profile", icon: iconByStep.execution_profile || "🟩", title: _secTitle("execution_profile", "실행 프로파일 카드"),
      content: {
        type: ep.type,
        style: ep.style,
        drivers: ep.drivers,
        environment: ep.environment,
        activities: ep.activities,
        tools: ep.tools
      }
    });

    sections.push({
      step: 4, id: "growth_map", icon: iconByStep.growth_map || "🟥", title: _secTitle("growth_map", "성장 가이드맵 요약"),
      content: {
        strengthsLabel: isEn ? "TOP 3 Strengths" : "TOP3 강점",
        growthLabel: isEn ? "TOP 2 Growth Points" : "TOP2 성장 포인트",
        strengths: gm.strengths,
        growth: gm.growth
      }
    });

    sections.push({
      step: 5, id: "career_education", icon: iconByStep.career_education || "🧭", title: _secTitle("career_education", "진로·경력·교육 큐레이션"),
      content: {
        careers: ce.careers,
        education: ce.education,
        directions: ce.directions
      }
    });

    sections.push({
      step: 6, id: "application", icon: iconByStep.application || "📍", title: _secTitle("application", "활용 예시 및 다음 단계"),
      content: {
        job: app.job,
        learning: app.learning,
        tasks: app.tasks,
        firstActionsLabel: isEn ? "✅ 3 first actions to start now" : "✅ 바로 실행할 첫 행동 3가지",
        firstActions: app.firstActions
      }
    });

    // 7~10: 4축 카드 (fourAxes 순서: self_understanding → self_execution)
    var axisIcon = { self_understanding:"🧠", self_expression:"🎙", self_design:"🎯", self_execution:"🚀" };
    var axisStep = { self_understanding:7, self_expression:8, self_design:9, self_execution:10 };
    var axisIdMap = { self_understanding:"self_understanding", self_expression:"self_expression", self_design:"self_design", self_execution:"self_execution" };
    fourAxes.forEach(function(card){
      var titleStr = isEn
        ? (card.english || card.title)
        : (card.title + " ("+card.english+")");
      sections.push({
        step: axisStep[card.id], id: axisIdMap[card.id],
        icon: axisIcon[card.id], title: titleStr,
        content: {
          pct: card.pct,
          core: card.core,
          emotional: card.emotional,
          keywords: card.keywords
        }
      });
    });

    // 11: summary_close
    var closeLine1, closeLine2, closeItems;
    if (isEn) {
      closeLine1 = name + " is a " + ((v.label_en || v.label) || "leader who creates their own path") + ".";
      closeLine2 = "Anchored in " + mv.valuesPhrase + ", you live out your mission in the field of " + mv.domain + ".";
      closeItems = [
        { icon: "🎯", label: "Refining mission & vision", desc: "Use the mission and vision sentences in this report as a starting point and reshape them in your own words." },
        { icon: "🛠", label: "Designing execution strategy", desc: "Build a 12-week execution plan based on your execution profile and growth points." },
        { icon: "🎓", label: "Designing career & education", desc: "Pick the most attractive option among the recommended careers/education and start within 30 days." }
      ];
    } else {
      closeLine1 = name + "님은 " + (toneSel.variant.label || "자기다운 길을 만드는 리더") + "입니다.";
      closeLine2 = (mv.valuesPhrase) + "을(를) 기준으로 " + (mv.domain) + " 영역에서 자신의 사명을 살아냅니다.";
      closeItems = [
        { icon: "🎯", label: "사명·비전 정교화", desc: "이 리포트의 사명·비전 문장을 기반으로 본인의 언어로 다듬어 보세요." },
        { icon: "🛠", label: "실행 전략 설계", desc: "실행 프로파일과 성장 포인트를 토대로 12주 실행 계획을 세워 보세요." },
        { icon: "🎓", label: "진로·교육 설계", desc: "추천 진로/교육 중 가장 끌리는 1가지부터 30일 안에 시작해 보세요." }
      ];
    }
    sections.push({
      step: 11, id: "summary_close", icon: iconByStep.summary_close || "🧩", title: _secTitle("summary_close", "요약하자면"),
      content: {
        line1: closeLine1,
        line2: closeLine2,
        items: closeItems
      }
    });

    // 12: report_meta + auto_notice
    sections.push({
      step: 12, id: "report_meta", icon: iconByStep.report_meta || "🧪", title: _secTitle("report_meta", "이 리포트는…"),
      content: {
        fixedText: metaFixed.replace(/{name}/g, name),
        autoNotice: autoNotice
      }
    });

    // EN: profile.recvMethod / tone.valueCategory 를 사전 변환 (mapping.i18n_en 우선)
    var i18nEnRoot2 = (mapping && mapping.i18n_en) || {};
    var recvMethodEnMap = i18nEnRoot2.recvMethodLabel || {};
    var valueCategoryEnMap = i18nEnRoot2.valueCategoryLabel || {};
    var recvMethodKo = profile.recvMethod || answers.Q2 || "";
    var recvMethodOut = isEn
      ? (recvMethodEnMap[recvMethodKo] || recvMethodKo || "Email")
      : recvMethodKo;
    var valueCategoryKo = toneSel.valueCategory || "";
    var valueCategoryOut = isEn
      ? (valueCategoryEnMap[valueCategoryKo] || valueCategoryKo || "")
      : valueCategoryKo;

    return {
      version: rules.version || "v3.0",
      generatedAt: new Date().toISOString(),
      profile: {
        name: name,
        email: profile.email || answers._email || "",
        recvMethod: recvMethodOut,
        submittedAt: submittedDate
      },
      tone: {
        key: toneSel.key,
        label: isEn
          ? ((toneSel.variant && (toneSel.variant.label_en || toneSel.variant.label)) || "")
          : ((toneSel.variant && toneSel.variant.label) || ""),
        valueCategory: valueCategoryOut,
        topAxis: toneSel.topAxis
      },
      scores: {
        axisPct: scores.axisPct,
        axisRanking: scores.axisRanking,
        sectionPct: scores.sectionPct
      },
      lang: lang,
      pdfFilename: (function(){
        var pat = isEn
          ? (rules.pdfFilenamePattern_en || "LifePortfolio_{name}_{yyyy-mm-dd}.pdf")
          : (rules.pdfFilenamePattern || "인생포트폴리오_{name}_{yyyy-mm-dd}.pdf");
        return pat.replace("{name}", name).replace("{yyyy-mm-dd}", submittedDate);
      })(),
      sections: sections
    };
  }

  // 매뉴얼 덮어쓰기 HTML 우선 표시 (있을 경우)
  function applyManualOverride(report, manualHtml) {
    if (!manualHtml || typeof manualHtml !== "string" || !manualHtml.trim()) return report;
    return Object.assign({}, report, {
      manualOverrideHtml: manualHtml,
      isManualOverride: true
    });
  }

  return {
    build: build,
    computeScores: computeScores,
    selectTone: selectTone,
    pickCareerEducation: pickCareerEducation,
    applyManualOverride: applyManualOverride,
    _internals: {
      buildAxisCard: buildAxisCard,
      buildGrowthMap: buildGrowthMap,
      buildMissionVision: buildMissionVision,
      buildExecutionProfile: buildExecutionProfile,
      buildApplication: buildApplication,
      AXIS_BASELINE: AXIS_BASELINE,
      AXIS_GROWTH: AXIS_GROWTH,
      CHOICE_KEYWORD_BY_AXIS: CHOICE_KEYWORD_BY_AXIS,
      AXIS_LIKERT_QS: AXIS_LIKERT_QS,
      AXIS_CHOICE_QS: AXIS_CHOICE_QS,
      buildAxisNarrative: buildAxisNarrative,
      extractAxisKeywords: extractAxisKeywords,
      classifyValueCategory: classifyValueCategory
    }
  };
});
