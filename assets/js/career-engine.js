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

    // careers[0] = primaryDomain × subType (R3: 강점-진로 정렬 검증)
    var alignmentFlags = { "careers[0]": false, "careers[1]": false, "careers[2]": false };
    if (primaryDomain) {
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

    // careers[1] = primaryDomain × secondaryDomain (R4: 융합형 의무화)
    if (primaryDomain && secondaryDomain) {
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
    } else if (primaryDomain) {
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

    // careers[2] = primaryDomain × Q41 열정 (열정 결합형)
    if (primaryDomain && topic) {
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

    // 부족 분 보강 — 같은 primaryDomain 내 다른 subType으로 회전
    if (primaryDomain && (careers.length < 3 || education.length < 3)) {
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

    // directions: domain 기반 명사형
    if (primaryDomain) directions.push(primaryDomain + " 영역의 전문성 확장");
    if (secondaryDomain) directions.push(primaryDomain + "·" + secondaryDomain + " 융합 실험");
    if (topic) directions.push(topic + " 주제의 실행 경험으로 확장");
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
    version: "1.1.0",
    build: build,
    pickSubType: pickSubType,
    diversityCheck: diversityCheck,
    verifyStrengthAlignment: verifyStrengthAlignment,
    classifyEduDuration: classifyEduDuration,
    _internal: {
      rotate: rotate,
      pickByHash: pickByHash,
      normalizeDomain: normalizeDomain,
      Q1_JOB_HINT: Q1_JOB_HINT
    }
  };
}));
