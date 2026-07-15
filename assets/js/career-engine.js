/*!
 * Career Engine v1.1 — RULE-CAREER v1.1 (R1~R5 적용)
 * --------------------------------------------------------------
 * 13대 영역 × 5종 subType 진로 풀 + 3축 결합 매트릭스.
 * Production Rules v1.1 / docs/PRODUCTION_RULES_v1.1.md 참조.
 *
 *   careers[0] = primaryDomain × subType  (Q3 강점 → 5종 중 1)
 *   careers[1] = primaryDomain × secondaryDomain (영역 융합)
 *   careers[2] = primaryDomain × Q41 열정 (열정 결합)
 *
 *   education[0] = subType별 전용 교육 풀 (실무 즉시 적용 / 3개월)
 *   education[1] = secondaryDomain 융합 (확장 / 6-12개월)
 *   education[2] = Q41 passion 깊이 (전문성 / 1년+)
 *
 * RULE-CAREER v1.1 신규 항목:
 *   R1: subType 5종 활성화 보장 (researcher 트리거 강화 — Q1·Q3·Q41)
 *   R2: 도메인 사각지대 방지 (subType별 별도 풀 호출)
 *   R3: 강점-진로 정렬 검증 (Q3 매칭 ≥1, fingerprint 회전)
 *   R4: 융합형 진로 의무화 (단일 도메인 연속 출력 차단)
 *   R5: 교육 트랙 차등화 (단기/중기/장기)
 *
 * 호출:
 *   var ce = CareerEngine.build(answers, mapping, careerRules, fingerprint, lang);
 *   → { careers:[3], education:[3], directions:[3], subType, sourceTopic, sourceDomains, sources:[] }
 * --------------------------------------------------------------
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.CareerEngine = factory();
  }
}(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ──────────────────────────────────────────────────────────
  // 유틸
  // ──────────────────────────────────────────────────────────
  function unique(arr) {
    var seen = {}, out = [];
    (arr || []).forEach(function (x) {
      var k = String(x || "").trim();
      if (!k || seen[k]) return;
      seen[k] = 1;
      out.push(x);
    });
    return out;
  }
  function pickByHash(arr, hash) {
    if (!arr || !arr.length) return null;
    var idx = Math.abs(hash | 0) % arr.length;
    return arr[idx];
  }
  function rotate(arr, hash) {
    if (!arr || !arr.length) return [];
    var start = Math.abs(hash | 0) % arr.length;
    return arr.slice(start).concat(arr.slice(0, start));
  }
  function pickArr(arr) { return Array.isArray(arr) ? arr : []; }

  // ══════════════════════════════════════════════════════════
  // [P23 · 대원칙-C] 융합 생성형 진로·교육 엔진
  //   문제(총괄 피드백): 기존 진로 큐레이션은 domainPools(현존 직업 사전)에서
  //     primaryDomain(1순위)만 반복 추출 → "종교 출판사 대표 / 종교 워크숍…"처럼
  //     한 분야에 갇히고, 2·3순위(교육·경영)가 사라졌다.
  //   철학: "현존 직업 프레임에 얽매이지 않는다. 고유성·맞춤화를 극한으로 밀면
  //     사람마다 다른 길이 나온다(= DNA 분석)." 진로/교육이 현존해도, 안 해도 무방.
  //   방법: report-engine의 fuseDomains(무게중심 복원)와 동일 원리를 이식.
  //     세 분야 속성을 역할(무엇을/어떻게/무엇으로)에 배정 → 하나의 융합 정체성 생성.
  //     그 정체성을 3가지 '관점(型)'으로 변주해 진로 3·교육 3을 만든다.
  //   §7: 산출 문장에 원분야 단어(종교·교육…) 미노출(속성어만 사용).
  //   두 엔진 일관성: report-engine과 동일 DOMAIN_ATTR_KO·동일 fingerprint → 동일 좌표.
  // ──────────────────────────────────────────────────────────
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
  // 자립형 조사 헬퍼 (report/program-engine과 결과 동일)
  function _feHasJong(w){
    var s = String(w||""); if (!s) return false;
    var ch = s.charCodeAt(s.length - 1);
    if (ch < 0xAC00 || ch > 0xD7A3) return false; // 비한글 → 받침 없음 취급
    return ((ch - 0xAC00) % 28) !== 0;
  }
  function _feIsRieul(w){
    var s = String(w||""); if (!s) return false;
    var ch = s.charCodeAt(s.length - 1);
    if (ch < 0xAC00 || ch > 0xD7A3) return false;
    return ((ch - 0xAC00) % 28) === 8; // ㄹ 받침
  }
  function _feEul(w){ return w + (_feHasJong(w) ? "을" : "를"); }
  function _feEro(w){ return w + ((_feHasJong(w) && !_feIsRieul(w)) ? "으로" : "로"); }
  function _feStripRo(s){ return s ? String(s).replace(/\s*(으로|로)\s*$/, "") : s; }
  function _fePick(arr, hash){ if (!arr || !arr.length) return ""; return arr[Math.abs(hash | 0) % arr.length]; }

  // 융합 좌표 산출 — report-engine.fuseDomains와 동일 역할 배정(1순위=무엇을,2순위=어떻게,3순위=무엇으로)
  function fuseCoords(domainsKo, fingerprint){
    var ds = (domainsKo || []).map(function(v){ return String(v).trim(); }).filter(Boolean);
    ds = ds.filter(function(d){ return !!DOMAIN_ATTR_KO[d]; });
    var n = ds.length;
    if (n === 0) return { core:"", act:"", fruitNoun:"", count:0 };
    var A0 = DOMAIN_ATTR_KO[ds[0]];
    var A1 = ds[1] ? DOMAIN_ATTR_KO[ds[1]] : null;
    var A2 = ds[2] ? DOMAIN_ATTR_KO[ds[2]] : null;
    var core = A0.core;
    var act  = (A1 ? A1.act : A0.act);
    var fruitNoun = A2 ? A2.core : (A1 ? _feStripRo(A1.fruit) : _feStripRo(A0.fruit));
    return { core:core, act:act, fruitNoun:fruitNoun, count:n };
  }

  // 융합 진로 3개 — 같은 좌표를 3가지 '관점(型)'으로 변주(현존 직업명 아님, 고유 정체성).
  //   ① 뿌리형(core 중심)  ② 융합형(전체)  ③ 결실형(fruit 중심)
  var _FE_ROOT_ROLE  = ["길잡이", "지킴이", "안내자", "청지기"];        // core를 세우는 사람
  var _FE_FUSE_CLOSER= ["키워 내는 사람", "일구는 사람", "세워 가는 사람", "이어 가는 사람"];
  var _FE_FRUIT_ROLE = ["개척자", "연결자", "설계자", "산파"];          // fruit를 여는 사람
  function buildFusionCareers(coords, fingerprint){
    var fp = fingerprint | 0;
    if (!coords || coords.count === 0) return [];
    var core = coords.core, act = coords.act, fruit = coords.fruitNoun;
    var out = [];
    // ① 뿌리형: "<core>을 세우는 <역할>"  예) "신념을 세우는 길잡이"
    out.push(_feEul(core) + " 세우는 " + _fePick(_FE_ROOT_ROLE, fp + 3));
    if (coords.count >= 2){
      // ② 융합형: "<core>을 <act> <fruit>(으)로 <closer>"  예) "신념을 가르쳐 조직으로 키워 내는 사람"
      out.push(_feEul(core) + " " + act + " " + _feEro(fruit) + " " + _fePick(_FE_FUSE_CLOSER, fp + 11));
      // ③ 결실형: "<fruit>(으)로 열매 맺게 하는 <역할>"  예) "조직으로 열매 맺게 하는 개척자"
      out.push(_feEro(fruit) + " 열매 맺게 하는 " + _fePick(_FE_FRUIT_ROLE, fp + 19));
    } else {
      // 1개 선택: 핵심만 변주 2형
      out.push(_feEul(core) + " 깊이 파고드는 " + _fePick(_FE_FRUIT_ROLE, fp + 11));
      out.push(_feEul(core) + " 지켜 내는 " + _fePick(_FE_ROOT_ROLE, fp + 19));
    }
    return unique(out).slice(0, 3);
  }
  // 융합 교육 3개 — 그 길에 필요한 배움(단기·중기·장기 감각 유지). 현존 과정명 아님.
  var _FE_EDU_SHORT = ["뿌리를 다지는 배움", "기초를 세우는 훈련", "첫 감각을 여는 과정"];
  var _FE_EDU_MID   = ["힘을 기르는 훈련", "다루는 법을 익히는 여정", "손에 익히는 실전"];
  // 장기: fruit(무엇으로)를 '무엇으로 잇는가'로 완결 — 앞 '잇는'과 중첩되지 않는 짧은 명사구
  var _FE_EDU_LONG  = ["멀리 보는 안목", "깊이 있는 통찰", "크게 보는 눈"];
  function buildFusionEducation(coords, fingerprint){
    var fp = fingerprint | 0;
    if (!coords || coords.count === 0) return [];
    var core = coords.core, act = coords.act, fruit = coords.fruitNoun;
    var out = [];
    // 단기: "<core>의 <뿌리 배움>"  예) "신념의 뿌리를 다지는 배움"
    out.push(core + "의 " + _fePick(_FE_EDU_SHORT, fp + 5));
    if (coords.count >= 2){
      // 중기: "<act> 잇는 <힘 훈련>"  예) "가르쳐 잇는 힘을 기르는 훈련"
      var actStem = String(act).replace(/\s+$/,"");
      out.push(actStem + " 잇는 힘을 " + _fePick(["기르는 훈련", "다지는 여정", "키우는 실전"], fp + 13));
      // 장기: "<fruit>(으)로 잇는 <안목>"  예) "성과로 잇는 멀리 보는 안목"
      out.push(_feEro(fruit) + " 잇는 " + _fePick(_FE_EDU_LONG, fp + 23));
    } else {
      out.push(_feEul(core) + " 다루는 " + _fePick(_FE_EDU_MID, fp + 13));
      out.push(_feEul(core) + " 향한 " + _fePick(_FE_EDU_LONG, fp + 23));
    }
    return unique(out).slice(0, 3);
  }
  // 융합 확장 방향 3개 — 원분야 노출 없이 세 좌표를 서로 다른 '축'으로.
  function buildFusionDirections(coords, fingerprint){
    var fp = fingerprint | 0;
    if (!coords || coords.count === 0) return [];
    var core = coords.core, act = coords.act, fruit = coords.fruitNoun;
    var out = [];
    out.push(core + "의 깊이를 더하는 방향");
    if (coords.count >= 2){
      var actStem = String(act).replace(/\s+$/,"");
      out.push(actStem + " 잇는 사람들과 넓히는 방향");
      out.push(_feEro(fruit) + " 열매 맺게 하는 방향");
    } else {
      out.push(_feEul(core) + " 실행 경험으로 옮기는 방향");
      out.push(_feEul(core) + " 사람들과 나누는 방향");
    }
    return unique(out).slice(0, 3);
  }

  // ──────────────────────────────────────────────────────────
  // 응답 추출 헬퍼
  // ──────────────────────────────────────────────────────────
  function asArr(v) { return Array.isArray(v) ? v : (v != null && v !== "" ? [v] : []); }

  function getQ(answers, key) {
    if (!answers) return [];
    return asArr(answers[key]);
  }

  function normalizeDomain(raw, aliases) {
    if (!raw) return null;
    var k = String(raw).trim();
    if (aliases && aliases[k]) return aliases[k];
    return k;
  }

  // ──────────────────────────────────────────────────────────
  // R1: Q1 직무 → subType 가중치 (researcher 트리거 강화)
  // ──────────────────────────────────────────────────────────
  var Q1_JOB_HINT = {
    // researcher 트리거 (가중치 1.5)
    "연구": ["researcher"],
    "연구원": ["researcher"],
    "학자": ["researcher"],
    "교수": ["researcher"],
    "박사": ["researcher"],
    "분석": ["researcher"],
    "데이터": ["researcher"],
    "리서치": ["researcher"],
    // practitioner
    "현장": ["practitioner"],
    "엔지니어": ["practitioner"],
    "기술자": ["practitioner"],
    "선수": ["practitioner"],
    "선생": ["practitioner"],
    "교사": ["practitioner"],
    "의사": ["practitioner"],
    "간호": ["practitioner"],
    // business
    "사업": ["business"],
    "창업": ["business"],
    "대표": ["business"],
    "CEO": ["business"],
    "기획": ["business", "media"],
    "마케팅": ["business", "media"],
    "영업": ["business"],
    "투자": ["business"],
    // media
    "기자": ["media"],
    "PD": ["media"],
    "작가": ["media"],
    "콘텐츠": ["media"],
    "크리에이터": ["media"],
    "디자이너": ["media"],
    "편집": ["media"],
    // policy
    "공무원": ["policy"],
    "행정": ["policy"],
    "정책": ["policy"],
    "공공": ["policy"]
  };

  // ──────────────────────────────────────────────────────────
  // subType 결정 (Q1 직무 + Q3 강점 + Q13 가치관 + Q41 열정 가중)
  // RULE-CAREER v1.1 R1: Q1 가중치 추가, researcher 보장 트리거
  // ──────────────────────────────────────────────────────────
  function pickSubType(answers, careerRules, fingerprint) {
    var kwMap = careerRules.subTypeKeywords || {};
    var valMap = careerRules.subTypeValues || {};
    var topicHint = careerRules.topicSubTypeHint || {};

    var score = {
      practitioner: 0, researcher: 0, business: 0, media: 0, policy: 0
    };
    var trace = []; // R3 검증용 — 어떤 응답이 어떤 subType에 기여했는지

    // R1: Q1 직무 (가중치 1.5 — 직무는 가장 강한 시그널)
    var jobs = getQ(answers, "Q1").concat(getQ(answers, "Q2"));
    jobs.forEach(function (j) {
      var key = String(j || "").trim();
      Object.keys(Q1_JOB_HINT).forEach(function (k) {
        if (key.indexOf(k) !== -1) {
          Q1_JOB_HINT[k].forEach(function (t) {
            score[t] = (score[t] || 0) + 1.5;
            trace.push({ q: "Q1", key: k, subType: t, weight: 1.5 });
          });
        }
      });
    });

    // Q3 강점 (가중치 1.0)
    var strengths = getQ(answers, "Q3").concat(getQ(answers, "Q4")).concat(getQ(answers, "Q5"));
    strengths.forEach(function (s) {
      var key = String(s || "").trim();
      var hit = kwMap[key];
      if (hit && hit.length) hit.forEach(function (t) {
        score[t] = (score[t] || 0) + 1.0;
        trace.push({ q: "Q3", key: key, subType: t, weight: 1.0 });
      });
      // 부분 매칭(부분 문자열 포함)
      if (!hit) {
        Object.keys(kwMap).forEach(function (k) {
          if (key.indexOf(k) !== -1) {
            kwMap[k].forEach(function (t) {
              score[t] = (score[t] || 0) + 0.7;
              trace.push({ q: "Q3", key: k, subType: t, weight: 0.7 });
            });
          }
        });
      }
    });

    // Q13 가치관 (가중치 0.5)
    var values = getQ(answers, "Q13");
    values.forEach(function (v) {
      var hit = valMap[String(v || "").trim()];
      if (hit && hit.length) hit.forEach(function (t) {
        score[t] = (score[t] || 0) + 0.5;
        trace.push({ q: "Q13", key: String(v), subType: t, weight: 0.5 });
      });
    });

    // Q41 열정 주제 (가중치 1.0 — 열정은 추진 방향)
    var topics = getQ(answers, "Q41");
    topics.forEach(function (t) {
      var hit = topicHint[String(t || "").trim()];
      if (hit && hit.length) hit.forEach(function (st) {
        score[st] = (score[st] || 0) + 1.0;
        trace.push({ q: "Q41", key: String(t), subType: st, weight: 1.0 });
      });
    });

    // 최고점 결정 (동점 시 fingerprint로 결정 → 고유성 보장)
    var maxScore = -1;
    var winners = [];
    Object.keys(score).forEach(function (k) {
      if (score[k] > maxScore) { maxScore = score[k]; winners = [k]; }
      else if (score[k] === maxScore) { winners.push(k); }
    });
    if (!winners.length || maxScore <= 0) {
      // 폴백: fingerprint 기반 회전
      var pool = ["practitioner", "researcher", "business", "media", "policy"];
      return { subType: pickByHash(pool, fingerprint || 0), score: score, source: "fallback", trace: trace };
    }
    var picked = pickByHash(winners, fingerprint || 0);
    return { subType: picked, score: score, source: "scored", trace: trace };
  }

  // ──────────────────────────────────────────────────────────
  // 영역 풀에서 subType별 careers/education 추출
  // ──────────────────────────────────────────────────────────
  function getDomainPool(careerRules, domainKey) {
    var pools = careerRules.domainPools || {};
    return pools[domainKey] || null;
  }

  function pickCareerFromPool(pool, subType, fingerprint, offset) {
    if (!pool || !pool[subType]) return null;
    var careers = pickArr(pool[subType].careers);
    if (!careers.length) return null;
    return pickByHash(careers, (fingerprint || 0) + (offset || 0));
  }
  function pickEducationFromPool(pool, subType, fingerprint, offset) {
    if (!pool || !pool[subType]) return null;
    var edu = pickArr(pool[subType].education);
    if (!edu.length) return null;
    return pickByHash(edu, (fingerprint || 0) + (offset || 0));
  }

  // ──────────────────────────────────────────────────────────
  // Q41 열정 → 결합형 careers (열정 + primaryDomain)
  // ──────────────────────────────────────────────────────────
  function passionFusionCareer(primaryDomain, topic, careerRules, fingerprint) {
    if (!topic) return null;
    var hint = (careerRules.topicSubTypeHint || {})[topic];
    if (!hint || !hint.length) return null;
    var st = pickByHash(hint, fingerprint + 17);
    var pool = getDomainPool(careerRules, primaryDomain);
    if (!pool) return null;
    return pickCareerFromPool(pool, st, fingerprint, 23);
  }
  function passionFusionEducation(primaryDomain, topic, careerRules, fingerprint) {
    if (!topic) return null;
    var hint = (careerRules.topicSubTypeHint || {})[topic];
    if (!hint || !hint.length) return null;
    var st = pickByHash(hint, fingerprint + 19);
    var pool = getDomainPool(careerRules, primaryDomain);
    if (!pool) return null;
    return pickEducationFromPool(pool, st, fingerprint, 29);
  }

  // ──────────────────────────────────────────────────────────
  // domain × secondaryDomain 융합형
  // ──────────────────────────────────────────────────────────
  function fusionCareer(primaryDomain, secondaryDomain, subType, careerRules, fingerprint) {
    if (!primaryDomain || !secondaryDomain || primaryDomain === secondaryDomain) return null;
    var poolP = getDomainPool(careerRules, primaryDomain);
    var poolS = getDomainPool(careerRules, secondaryDomain);
    if (!poolP || !poolS) return null;
    // primary subType + secondary 같은 subType의 careers를 결합한 신규 표현
    var primaryName = pickCareerFromPool(poolP, subType, fingerprint, 11);
    var secondaryName = pickCareerFromPool(poolS, subType, fingerprint, 13);
    if (!primaryName || !secondaryName) return primaryName || secondaryName;
    // "primaryDomain·secondaryDomain 융합형 — secondaryName"
    return primaryDomain + "·" + secondaryDomain + " 융합형 — " + secondaryName;
  }

  // ──────────────────────────────────────────────────────────
  // 폴백 풀 (RULE-REPORT R1: 응답 없을 때 톤 기반)
  // ──────────────────────────────────────────────────────────
  var TONE_FALLBACK_KO = {
    principled_designer: ["전략 설계자 / 시스템 디자이너", "원칙 기반 리더십 코치", "조직개발 컨설턴트"],
    warm_connector:      ["관계 중심 리더십 코치", "조직문화 디자이너", "커뮤니티 빌더"],
    visionary_creator:   ["콘텐츠 디렉터 / 크리에이터", "브랜드 스토리텔러", "문화기획자"],
    pragmatic_achiever:  ["프로젝트 매니저 / 운영 전문가", "성과관리 컨설턴트", "실행 코치"],
    reflective_explorer: ["사상·콘텐츠 디렉터", "리서치 PM", "사색가형 작가"]
  };
  var TONE_EDU_FALLBACK_KO = {
    principled_designer: ["전략적 의사결정 워크숍", "원칙 기반 리더십 과정", "시스템 사고 훈련"],
    warm_connector:      ["코칭·퍼실리테이션 과정", "비폭력 커뮤니케이션 훈련", "공동체 리더십 워크숍"],
    visionary_creator:   ["스토리텔링·내러티브 훈련", "창의적 발상 워크숍", "브랜드·콘텐츠 기획 과정"],
    pragmatic_achiever:  ["OKR·성과관리 실무 과정", "프로젝트 매니지먼트 훈련", "실행력 부트캠프"],
    reflective_explorer: ["자기성찰·메타인지 훈련", "철학·고전 읽기 과정", "마음챙김·명상 훈련"]
  };

  // ──────────────────────────────────────────────────────────
  // R3: 강점-진로 정렬 검증
  // ──────────────────────────────────────────────────────────
  function verifyStrengthAlignment(career, strengths, kwMap, subType) {
    if (!career || !strengths || !strengths.length) return false;
    var careerStr = String(career);
    // 직접 매칭: career 텍스트에 강점 키워드 포함
    for (var i = 0; i < strengths.length; i++) {
      var s = String(strengths[i] || "").trim();
      if (s && careerStr.indexOf(s) !== -1) return true;
    }
    // 간접 매칭: 강점이 같은 subType에 매핑되어 있는지
    for (var j = 0; j < strengths.length; j++) {
      var sk = String(strengths[j] || "").trim();
      if (kwMap[sk] && kwMap[sk].indexOf(subType) !== -1) return true;
    }
    return false;
  }

  // ──────────────────────────────────────────────────────────
  // R3: 정렬 실패 시 fingerprint 회전 (최대 3회 시도)
  // ──────────────────────────────────────────────────────────
  function pickAlignedCareer(pool, subType, fp, baseOffset, strengths, kwMap, exclude) {
    if (!pool || !pool[subType]) return null;
    var careers = pickArr(pool[subType].careers);
    if (!careers.length) return null;
    exclude = exclude || [];
    for (var attempt = 0; attempt < 3; attempt++) {
      var c = pickByHash(careers, fp + baseOffset + attempt * 7);
      if (!c) continue;
      if (exclude.indexOf(c) !== -1) continue;
      if (verifyStrengthAlignment(c, strengths, kwMap, subType)) return c;
      if (attempt === 2) return c; // 3회 실패 시 마지막 후보 반환
    }
    return careers[0];
  }

  // ──────────────────────────────────────────────────────────
  // R5: 교육 트랙 차등화 — 기간대 라벨링
  // ──────────────────────────────────────────────────────────
  var EDU_DURATION_HINT = {
    "워크숍": "단기",
    "부트캠프": "단기",
    "실무": "단기",
    "자격": "중기",
    "훈련": "중기",
    "과정": "중기",
    "대학원": "장기",
    "박사": "장기",
    "리서치": "장기"
  };
  function classifyEduDuration(edu) {
    if (!edu) return "중기";
    var s = String(edu);
    var hits = { "단기": 0, "중기": 0, "장기": 0 };
    Object.keys(EDU_DURATION_HINT).forEach(function (k) {
      if (s.indexOf(k) !== -1) hits[EDU_DURATION_HINT[k]] += 1;
    });
    if (hits["장기"] > 0) return "장기";
    if (hits["단기"] > 0 && hits["중기"] === 0) return "단기";
    if (hits["중기"] > 0) return "중기";
    return "중기";
  }
  function pickEduWithDuration(pool, subType, fp, offset, targetDuration, exclude) {
    if (!pool || !pool[subType]) return null;
    var edus = pickArr(pool[subType].education);
    if (!edus.length) return null;
    exclude = exclude || [];
    var matched = edus.filter(function (e) {
      return classifyEduDuration(e) === targetDuration && exclude.indexOf(e) === -1;
    });
    if (matched.length) return pickByHash(matched, fp + offset);
    // 미매칭 시 아무거나
    var rest = edus.filter(function (e) { return exclude.indexOf(e) === -1; });
    return rest.length ? pickByHash(rest, fp + offset) : null;
  }

  // ──────────────────────────────────────────────────────────
  // 메인: build()
  // ──────────────────────────────────────────────────────────
  function build(answers, mapping, careerRules, fingerprint, opts) {
    opts = opts || {};
    var lang = opts.lang || "ko";
    var toneKey = opts.toneKey || "reflective_explorer";
    var fp = (typeof fingerprint === "number") ? fingerprint : 0;

    careerRules = careerRules || {};
    var aliases = careerRules.domainAliases || {};
    var kwMap = careerRules.subTypeKeywords || {};

    // 응답 추출
    var domainsRaw = getQ(answers, "Q75");
    var domains = domainsRaw.map(function (d) { return normalizeDomain(d, aliases); }).filter(Boolean);
    domains = unique(domains);
    // [P23] 융합 전용: 정규화(13대 축소·경영→경제 등) 이전의 raw 분야를 그대로 사용.
    //   DOMAIN_ATTR_KO는 21개 분야를 모두 보유 → 경영/금융/기술/심리 등이 각자 고유 좌표 유지.
    //   (정규화하면 [종교,교육,경영]과 [종교,교육,경제]가 동일 결과가 되어 맞춤화가 훼손됨)
    var domainsForFusion = unique(
      domainsRaw
        .map(function (d) { return String(d == null ? "" : d).trim(); })
        .filter(function (d) { return !!DOMAIN_ATTR_KO[d]; })
    );

    var primaryDomain = domains[0] || null;
    var secondaryDomain = domains[1] || null;

    var topics = getQ(answers, "Q41");
    var topic = topics[0] || null;

    var strengths = getQ(answers, "Q3").concat(getQ(answers, "Q4")).concat(getQ(answers, "Q5"));

    // subType 결정 (R1: Q1 직무 가중치 포함)
    var subRes = pickSubType(answers, careerRules, fp);
    var subType = subRes.subType;

    // 3축 결합 결과 컨테이너
    var careers = [];
    var education = [];
    var directions = [];
    var sources = [];
    var alignmentFlags = { "careers[0]": false, "careers[1]": false, "careers[2]": false };

    // ══════════════════════════════════════════════════════════
    // [P23 · 대원칙-C] 융합 생성형 우선 경로 (KO)
    //   관심 분야(Q75)가 하나라도 있으면 → 현존 직업 사전 대신 '융합 정체성'을 생성.
    //   세 분야가 각각 역할을 맡아 하나로 합쳐진, 이 사람만의 고유한 진로/교육/확장축.
    //   (영문 리포트/응답부재 → 기존 사전 경로로 폴백)
    // ──────────────────────────────────────────────────────────
    var _fusionApplied = false;
    if (lang !== "en") {
      var _feCoords = fuseCoords(domainsForFusion, fp);
      if (_feCoords.count > 0) {
        careers   = buildFusionCareers(_feCoords, fp);
        education = buildFusionEducation(_feCoords, fp);
        directions = buildFusionDirections(_feCoords, fp);
        // 융합 정체성은 정의상 강점 정렬 인정(무게중심에 1순위 정체성 포함)
        alignmentFlags["careers[0]"] = true;
        alignmentFlags["careers[1]"] = (_feCoords.count >= 2);
        alignmentFlags["careers[2]"] = (_feCoords.count >= 2);
        careers.forEach(function (c, i) {
          sources.push({ slot: "careers[" + i + "]", value: c, source: "fusion", coords: _feCoords });
        });
        education.forEach(function (e, i) {
          sources.push({ slot: "education[" + i + "]", value: e, source: "fusion", coords: _feCoords });
        });
        _fusionApplied = (careers.length >= 1);
      }
    }

    // careers[0] = primaryDomain × subType (R3: 강점-진로 정렬 검증) — 융합 미적용 시에만
    if (!_fusionApplied && primaryDomain) {
      var pool0 = getDomainPool(careerRules, primaryDomain);
      var c0 = pickAlignedCareer(pool0, subType, fp, 0, strengths, kwMap, []);
      if (c0) {
        careers.push(c0);
        alignmentFlags["careers[0]"] = verifyStrengthAlignment(c0, strengths, kwMap, subType);
        sources.push({ slot: "careers[0]", value: c0, source: "domain×subType", domain: primaryDomain, subType: subType, aligned: alignmentFlags["careers[0]"] });
      }
      // R5: education[0] = 단기 (실무 즉시 적용)
      var e0 = pickEduWithDuration(pool0, subType, fp, 0, "단기", []);
      if (!e0) e0 = pickEducationFromPool(pool0, subType, fp, 0);
      if (e0) {
        education.push(e0);
        sources.push({ slot: "education[0]", value: e0, source: "domain×subType", domain: primaryDomain, subType: subType, duration: classifyEduDuration(e0) });
      }
    }

    // careers[1] = primaryDomain × secondaryDomain (R4: 융합형 의무화) — 융합 미적용 시에만
    if (!_fusionApplied && primaryDomain && secondaryDomain) {
      var c1 = fusionCareer(primaryDomain, secondaryDomain, subType, careerRules, fp);
      if (c1 && careers.indexOf(c1) === -1) {
        careers.push(c1);
        alignmentFlags["careers[1]"] = true; // 융합형은 정의상 정렬 인정
        sources.push({ slot: "careers[1]", value: c1, source: "domain×domain", primary: primaryDomain, secondary: secondaryDomain, subType: subType, aligned: true });
      }
      // R5: education[1] = 중기 (확장 융합)
      var poolS = getDomainPool(careerRules, secondaryDomain);
      var e1 = pickEduWithDuration(poolS, subType, fp, 7, "중기", education);
      if (!e1) e1 = pickEducationFromPool(poolS, subType, fp, 7);
      if (e1 && education.indexOf(e1) === -1) {
        education.push(e1);
        sources.push({ slot: "education[1]", value: e1, source: "secondaryDomain×subType", domain: secondaryDomain, subType: subType, duration: classifyEduDuration(e1) });
      }
    } else if (!_fusionApplied && primaryDomain) {
      // R4: secondaryDomain 없을 때 — 같은 도메인 내 다른 subType으로 융합 대체 (단일 도메인 연속 차단)
      var altSubTypes = ["practitioner", "researcher", "business", "media", "policy"].filter(function (s) { return s !== subType; });
      var altPick = pickByHash(altSubTypes, fp + 91);
      var altPool = getDomainPool(careerRules, primaryDomain);
      var c1Alt = pickCareerFromPool(altPool, altPick, fp, 11);
      if (c1Alt && careers.indexOf(c1Alt) === -1) {
        var fusionLabel = primaryDomain + "·" + altPick + " 결합형 — " + c1Alt;
        careers.push(fusionLabel);
        alignmentFlags["careers[1]"] = true;
        sources.push({ slot: "careers[1]", value: fusionLabel, source: "domain×altSubType_fusion", domain: primaryDomain, altSubType: altPick, aligned: true });
      }
    }

    // careers[2] = primaryDomain × Q41 열정 (열정 결합형) — 융합 미적용 시에만
    if (!_fusionApplied && primaryDomain && topic) {
      var c2 = passionFusionCareer(primaryDomain, topic, careerRules, fp);
      if (c2 && careers.indexOf(c2) === -1) {
        careers.push(c2);
        alignmentFlags["careers[2]"] = verifyStrengthAlignment(c2, strengths, kwMap, subType);
        sources.push({ slot: "careers[2]", value: c2, source: "domain×passion", domain: primaryDomain, topic: topic, aligned: alignmentFlags["careers[2]"] });
      }
      // R5: education[2] = 장기 (전문성 깊이)
      var pool2 = getDomainPool(careerRules, primaryDomain);
      var e2 = pickEduWithDuration(pool2, subType, fp, 13, "장기", education);
      if (!e2) e2 = passionFusionEducation(primaryDomain, topic, careerRules, fp);
      if (e2 && education.indexOf(e2) === -1) {
        education.push(e2);
        sources.push({ slot: "education[2]", value: e2, source: "domain×passion", domain: primaryDomain, topic: topic, duration: classifyEduDuration(e2) });
      }
    }

    // 부족 분 보강 — 같은 primaryDomain 내 다른 subType으로 회전 (융합 미적용 시에만)
    if (!_fusionApplied && primaryDomain && (careers.length < 3 || education.length < 3)) {
      var pool = getDomainPool(careerRules, primaryDomain);
      if (pool) {
        var subOrder = rotate(["practitioner", "researcher", "business", "media", "policy"], fp + 31)
          .filter(function (s) { return s !== subType; });
        for (var i = 0; i < subOrder.length && (careers.length < 3 || education.length < 3); i++) {
          var st = subOrder[i];
          if (careers.length < 3) {
            var cn = pickCareerFromPool(pool, st, fp, 41 + i);
            if (cn && careers.indexOf(cn) === -1) {
              careers.push(cn);
              sources.push({ slot: "careers[" + careers.length + "]", value: cn, source: "domain×altSubType", domain: primaryDomain, subType: st });
            }
          }
          if (education.length < 3) {
            var en = pickEducationFromPool(pool, st, fp, 53 + i);
            if (en && education.indexOf(en) === -1) {
              education.push(en);
              sources.push({ slot: "education[" + education.length + "]", value: en, source: "domain×altSubType", domain: primaryDomain, subType: st });
            }
          }
        }
      }
    }

    // 톤 기반 폴백 (응답 데이터 부족 시)
    if (careers.length < 3) {
      var tonePool = TONE_FALLBACK_KO[toneKey] || TONE_FALLBACK_KO.reflective_explorer;
      tonePool = rotate(tonePool, fp + 61);
      for (var j = 0; j < tonePool.length && careers.length < 3; j++) {
        if (careers.indexOf(tonePool[j]) === -1) {
          careers.push(tonePool[j]);
          sources.push({ slot: "careers[" + careers.length + "]", value: tonePool[j], source: "tone_fallback", tone: toneKey });
        }
      }
    }
    if (education.length < 3) {
      var toneEdu = TONE_EDU_FALLBACK_KO[toneKey] || TONE_EDU_FALLBACK_KO.reflective_explorer;
      toneEdu = rotate(toneEdu, fp + 67);
      for (var k = 0; k < toneEdu.length && education.length < 3; k++) {
        if (education.indexOf(toneEdu[k]) === -1) {
          education.push(toneEdu[k]);
          sources.push({ slot: "education[" + education.length + "]", value: toneEdu[k], source: "tone_fallback", tone: toneKey });
        }
      }
    }

    // directions: domain 기반 명사형 — 융합 미적용 시에만(융합 경로는 buildFusionDirections로 이미 채움)
    if (!_fusionApplied) {
      if (primaryDomain) directions.push(primaryDomain + " 영역의 전문성 확장");
      if (secondaryDomain) directions.push(primaryDomain + "·" + secondaryDomain + " 융합 실험");
      if (topic) directions.push(topic + " 주제의 실행 경험으로 확장");
    }
    while (directions.length < 3) {
      directions.push("관심 영역의 깊이 확장");
    }
    directions = unique(directions).slice(0, 3);

    // 결과 슬라이스 (정확히 3개)
    careers = careers.slice(0, 3);
    education = education.slice(0, 3);

    // R5 검증: education 기간대 분포 (단기/중기/장기 다양성)
    var eduDurations = education.map(classifyEduDuration);
    var eduDurationDistinct = unique(eduDurations).length;

    // R3 검증: 강점-진로 정렬률
    var alignedCount = 0;
    Object.keys(alignmentFlags).forEach(function (k) { if (alignmentFlags[k]) alignedCount += 1; });
    var alignmentRatio = careers.length > 0 ? alignedCount / careers.length : 0;

    return {
      careers: careers,
      education: education,
      directions: directions,
      subType: subType,
      subTypeScore: subRes.score,
      subTypeSource: subRes.source,
      subTypeTrace: subRes.trace || [],
      sourceTopic: topic || "",
      sourceDomains: domains,
      sources: sources,
      // R3/R5 검증 메타
      alignmentFlags: alignmentFlags,
      alignmentRatio: alignmentRatio,
      eduDurations: eduDurations,
      eduDurationDistinct: eduDurationDistinct
    };
  }

  // ──────────────────────────────────────────────────────────
  // 검증 헬퍼: 동일 응답 vs 다른 응답에서 careers 차이 측정
  // ──────────────────────────────────────────────────────────
  function diversityCheck(samples) {
    // samples: [{answers, fingerprint, careers}]
    var allCareers = {};
    samples.forEach(function (s) {
      (s.careers || []).forEach(function (c) {
        allCareers[c] = (allCareers[c] || 0) + 1;
      });
    });
    var distinct = Object.keys(allCareers).length;
    var total = samples.reduce(function (a, s) { return a + (s.careers || []).length; }, 0);
    return {
      distinctCount: distinct,
      totalCount: total,
      diversityRatio: total > 0 ? distinct / total : 0
    };
  }

  return {
    version: "1.2.0",
    build: build,
    pickSubType: pickSubType,
    diversityCheck: diversityCheck,
    verifyStrengthAlignment: verifyStrengthAlignment,
    classifyEduDuration: classifyEduDuration,
    // [P23] 융합 생성형 엔진 노출(교차검증/테스트용)
    fuseCoords: fuseCoords,
    buildFusionCareers: buildFusionCareers,
    buildFusionEducation: buildFusionEducation,
    buildFusionDirections: buildFusionDirections,
    _internal: {
      rotate: rotate,
      pickByHash: pickByHash,
      normalizeDomain: normalizeDomain,
      Q1_JOB_HINT: Q1_JOB_HINT,
      DOMAIN_ATTR_KO: DOMAIN_ATTR_KO
    }
  };
}));
