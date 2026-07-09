/**
 * axis-code-map.js — Life Portfolio (P1.5 축 코드 단일 소스)
 * =============================================================================
 * 리포트 엔진의 영문 축 코드(self_understanding 등)와 큐레이션 매트릭스의
 * 한글 축명(자기이해 등)을 잇는 단일 매핑 소스(single source of truth).
 *
 * 배경:
 *   - report-engine-v4 / RTDB 저장분: self_understanding / self_expression /
 *     self_design / self_execution (영문 코드)
 *   - curation-matrix-v1.json / axis-keywords: 자기이해 / 자기표현 / 자기설계 /
 *     자기실행 (한글 축명)
 *
 * 이 매핑은 mypage 큐레이션(진단 데이터 병합), P2 LLM 응답, blog 큐레이션,
 * 리포트 재발행 등 여러 곳에서 재사용되므로 한 파일로 유지한다(정합성).
 *
 * 노출: window.LP_AXIS_CODE = {
 *   MAP,            // { 영문코드: 한글축명 }
 *   MAP_REVERSE,    // { 한글축명: 영문코드 }
 *   toKo(code),     // 영문→한글 (미매칭 시 원본 반환)
 *   toCode(ko),     // 한글→영문 (미매칭 시 원본 반환)
 *   weakFromReport(report),   // report 객체에서 약축(한글) 파생
 *   strongFromReport(report), // report 객체에서 강축(한글) 파생
 *   rankingFromReport(report) // 4축 순위(한글 배열, 강→약) 파생
 * }
 */
(function (w) {
  'use strict';

  var MAP = {
    self_understanding: '자기이해',
    self_expression: '자기표현',
    self_design: '자기설계',
    self_execution: '자기실행'
  };

  var MAP_REVERSE = {};
  Object.keys(MAP).forEach(function (code) { MAP_REVERSE[MAP[code]] = code; });

  function toKo(code) {
    if (!code) return code;
    return MAP[code] || code;
  }

  function toCode(ko) {
    if (!ko) return ko;
    return MAP_REVERSE[ko] || ko;
  }

  // report.scores.axisRanking: [{axis, pct}, ...] 강→약 순으로 정렬되어 있음.
  // 없으면 _v4Meta.signatureVars.weakAxis 로 폴백.
  function rankingFromReport(report) {
    if (!report) return null;
    var r = report.scores && report.scores.axisRanking;
    if (Array.isArray(r) && r.length) {
      return r.map(function (item) {
        var code = (item && item.axis) || item;
        return toKo(code);
      });
    }
    // 폴백: signatureVars 만 있는 경우 강/약축 2개만이라도 구성
    var sv = report._v4Meta && report._v4Meta.signatureVars;
    if (sv) {
      var out = [];
      if (sv.topAxis) out.push(toKo(sv.topAxis));
      if (sv.secondAxis && out.indexOf(toKo(sv.secondAxis)) < 0) out.push(toKo(sv.secondAxis));
      if (sv.weakAxis && out.indexOf(toKo(sv.weakAxis)) < 0) out.push(toKo(sv.weakAxis));
      return out.length ? out : null;
    }
    return null;
  }

  function strongFromReport(report) {
    var rank = rankingFromReport(report);
    if (rank && rank.length) return rank[0];
    var sv = report && report._v4Meta && report._v4Meta.signatureVars;
    if (sv && sv.topAxis) return toKo(sv.topAxis);
    return null;
  }

  function weakFromReport(report) {
    var rank = rankingFromReport(report);
    if (rank && rank.length) return rank[rank.length - 1];
    var sv = report && report._v4Meta && report._v4Meta.signatureVars;
    if (sv && sv.weakAxis) return toKo(sv.weakAxis);
    return null;
  }

  w.LP_AXIS_CODE = {
    MAP: MAP,
    MAP_REVERSE: MAP_REVERSE,
    toKo: toKo,
    toCode: toCode,
    weakFromReport: weakFromReport,
    strongFromReport: strongFromReport,
    rankingFromReport: rankingFromReport
  };
})(window);
