/* 인생포트폴리오 — 「자산화 길 찾기」 지면 문장 조립기 (asset-path v1).
 * Input : the approved engine (AssetMap, asset-map-v1) + the person's stored answers + their own report.
 * Output: customer text only (no question numbers, no internal codes in text), saved once as
 *         report._assetPath when a report is created or explicitly regenerated (D3).
 * Pure and deterministic: same answers + same report + same version => same text. No network, no AI.
 * Uniqueness comes from the person's own report: strength #1, the scene they chose (Q41), the
 * engine's sub-change, the answers that were the reasons, and their mission headline.
 * Rules (owner): "자산화 유형" is a starting path, never a label of the person; result is a reference,
 * the person decides; no ranking. Money examples are management, not investment advice.
 */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.AssetPath = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var VERSION = "asset-path-v1";

  // What each change can leave behind — many kinds of assets, not only money. Shared with the diary guide.
  var ASSETS = {
    illuminate: { assets: [["지적 자산", "정리 노트 · 강의안 · 책 · 연구 기록"], ["경험 자산", "문제를 풀어 본 사례 모음"], ["관계 자산", "나에게 묻고 배우러 오는 사람들"]],
      jobs: ["교사 · 강사", "연구원", "상담 · 컨설턴트", "기자 · 에디터", "데이터 분석가"] },
    make: { assets: [["작품 자산", "글 · 그림 · 곡 · 영상 포트폴리오"], ["도구 · 기술 자산", "앱 · 양식 · 손기술 · 레시피"], ["지식재산", "디자인 · 저작권 · 특허"]],
      jobs: ["디자이너", "개발자", "작가 · 작곡가", "요리사 · 제빵사", "농부 · 목수 · 공예가"] },
    perform: { assets: [["몸 · 무대 자산", "경기 기록 · 공연 영상 · 대회 이력"], ["표현 자산", "강연 · 발표 영상 · 내 이야기 글"], ["관계 자산", "나를 보고 힘을 얻는 사람들"]],
      jobs: ["운동선수 · 코치", "연주자 · 배우", "강연자 · 아나운서", "크리에이터", "체육 · 예술 강사"] },
    care: { assets: [["관계 · 신뢰 자산", "오래 이어진 돌봄의 관계"], ["경험 자산", "돌본 방법과 사례 기록"], ["공간 · 환대 자산", "사람이 편히 머무는 자리"]],
      jobs: ["간호사 · 요양보호사", "사회복지사", "보육교사", "상담사", "숙박 · 환대 공간 운영자"] },
    connect: { assets: [["관계 · 공동체 자산", "모임 · 네트워크 · 협력 관계"], ["경험 자산", "갈등을 푼 사례 · 함께 일한 기록"], ["신뢰 자산", "내 소개를 믿고 맡기는 평판"]],
      jobs: ["커뮤니티 매니저", "코디네이터 · 중개", "인사 담당", "조정 · 중재가", "영업 · 제휴 담당"] },
    build: { assets: [["시스템 자산", "매뉴얼 · 체크리스트 · 운영표"], ["사업 자산", "반복해서 제공하는 서비스 · 작은 사업"], ["경험 자산", "이끌어 본 프로젝트 기록"]],
      jobs: ["기획자 · 프로젝트 매니저", "운영 관리자", "창업가", "행정 · 정책 담당", "팀장 · 리더"] },
    keep: { assets: [["금융 · 살림 자산", "예산표 · 비상금 · 잘 관리된 살림과 장비"], ["기록 자산", "이어 온 기록 · 잘 보관된 자료"], ["안전 · 자연 자산", "지켜 낸 환경 · 안전 규칙"]],
      jobs: ["회계 · 재무 담당", "기록관리사 · 사서", "안전관리자", "환경 · 생태 활동가", "시설 · 자산 관리자"] }
  };
  var ASSET_NOTE = "자산은 주식 · 부동산 같은 돈만이 아니에요. 아는 것(지적 자산), 해 본 일(경험 자산), 믿어 주는 사람(관계 자산), 만든 것(작품 · 도구 자산), 다시 쓰이는 틀(시스템 자산)도 자산이에요. 돈 자산은 투자 권유가 아니라 잘 관리하는 일을 뜻해요.";

  // Sub-change -> [what I do (adnominal, ends with "는"), what it is left as]
  var SUB = {
    "illuminate.inquire": ["궁금한 것을 끝까지 파고들어 답을 찾아 주는", "정리한 질문과 답"],
    "illuminate.interpret": ["겪은 일의 뜻을 풀어 다른 사람이 알게 하는", "배운 점 기록"],
    "illuminate.teach": ["아는 것을 쉽게 풀어 가르치는", "설명 자료"],
    "illuminate.discern": ["문제의 원인을 찾아 길을 밝혀 주는", "원인과 해결 순서"],
    "make.craft": ["손으로 정성껏 쓸모 있는 것을 만들어 내는", "만든 것과 만든 과정"],
    "make.create": ["없던 작품을 끝까지 지어내는", "완성한 작품"],
    "make.develop": ["일을 덜어 주는 도구를 만들어 내는", "도구와 양식"],
    "make.cultivate": ["생명과 일을 길러 열매 맺게 하는", "기른 과정의 기록"],
    "perform.athletic": ["몸으로 끝까지 해내며 사람들에게 힘을 주는", "활동 기록"],
    "perform.artistic": ["무대에서 보여 주어 사람들의 마음을 움직이는", "공연과 연주"],
    "perform.speak": ["말로 사람들의 마음을 움직이는", "이야기와 발표"],
    "perform.witness": ["내가 지나온 이야기를 들려주어 다른 사람에게 용기를 주는", "내 이야기 글"],
    "care.nurture": ["곁에서 사람이 자라도록 돕는", "자람의 기록"],
    "care.restore": ["힘든 사람 곁에 머물러 다시 일어서게 하는", "도운 방법"],
    "care.tend": ["사람들의 마음을 살펴 주는", "살핀 마음의 기록"],
    "care.host": ["사람들이 편히 머물 자리를 만드는", "맞이하는 자리의 준비 목록"],
    "connect.link": ["필요한 사람끼리 이어 주는", "연결한 사람들의 기록"],
    "connect.reconcile": ["엉킨 사이를 풀어 다시 함께하게 하는", "갈등을 푼 순서"],
    "connect.cooperate": ["여럿이 함께 일하게 만드는", "함께 해낸 일과 역할 기록"],
    "connect.gather": ["사람들이 모일 자리를 여는", "모임 기록"],
    "build.design": ["흩어진 일에 계획과 틀을 짜 주는", "체크리스트와 계획표"],
    "build.operate": ["일이 꾸준히 굴러가게 운영하는", "운영표"],
    "build.institute": ["모두가 지킬 약속을 세워 일을 바로 서게 하는", "함께 지킬 약속"],
    "build.lead": ["사람들과 정한 목표로 앞서 이끄는", "목표와 진행 기록"],
    "keep.steward": ["돈과 시간을 아껴 오래 쓰이게 하는", "돈 · 시간 쓰임표"],
    "keep.preserve": ["기록을 이어 소중한 것이 사라지지 않게 하는", "이어 온 기록"],
    "keep.protect": ["맡은 사람과 일을 안전하게 지키는", "확인 목록"],
    "keep.creation": ["자연과 생명을 지켜 다음에 물려주는", "지켜 낸 자연의 기록"]
  };
  var TYPE_NOTE = "자산화 유형은 나를 나누는 이름이 아니에요. 지금 내 고유함을 무엇으로 남기기 좋은지 보여 주는 출발점이에요. 사람은 어떤 유형보다 크고, 삶의 때에 따라 여러 변화를 함께 가질 수 있어요.";
  var CHECKS = ["내가 남긴 것이 다시 쓰였나요?", "누군가에게 실제로 도움이 됐나요?", "다른 사람도 쓸 수 있게 남았나요?"];
  var DECIDE = "결과는 참고예요. 고르는 건 내가 정해요. 다이어리 「추천 진로 세 카드」에서 내 변화를 0~2개 직접 고를 수 있어요.";
  var NEXT = "고른 변화는 앞으로 인생 훈련 게임 · 소그룹 · 멘토 · 현실 문제 해결 프로젝트에서 내 길을 정하는 기준이 돼요(출시 준비중).";

  function batchim(word) {
    var s = String(word || "").replace(/[\s\)\]」』"'”’.·]+$/, ""); if (!s) return null;
    var c = s.charCodeAt(s.length - 1); if (c < 0xac00 || c > 0xd7a3) return null;
    return (c - 0xac00) % 28; // 0 none, 8 = ㄹ
  }
  function ro(w) { var b = batchim(w); return w + (b === null || b === 0 || b === 8 ? "로" : "으로"); }
  function gwa(w) { var b = batchim(w); return b === null ? "과(와)" : (b === 0 ? "와" : "과"); }
  function sec(report, id) { var s = report && Array.isArray(report.sections) ? report.sections.filter(function (x) { return x && x.id === id; })[0] : null; return (s && s.content) || {}; }
  function clean(t) { return String(t == null ? "" : t).replace(/\s+/g, " ").trim(); }

  // AM = the AssetMap module (browser window.AssetMap / server require("./_asset_map.js")).
  function compose(AM, report, answers) {
    if (!AM || typeof AM.compute !== "function" || !report || !answers || typeof answers !== "object") return null;
    if (String(report.lang || "ko").toLowerCase().indexOf("en") === 0) return null; // Korean first; English later, all at once.
    var ranking = (report.scores && Array.isArray(report.scores.axisRanking)) ? report.scores.axisRanking : [];
    var res = AM.compute({ answers: answers, axisRanking: ranking, probes: {} });
    if (!res || res.insufficient || !res.actions || !res.actions.length) return null;
    var v = AM.view(res), top = res.actions[0], it = v.items[0];
    var key = top.code + "." + (top.sub || ""), sub = SUB[key], kit = ASSETS[top.code];
    if (!sub || !kit) return null;
    var mv = sec(report, "mission_vision"), slots = mv._slots || {}, gm = sec(report, "growth_map");
    var strength = clean((gm.strengths || [])[0]);
    var scene = clean(slots.topic_scene).replace(/^특히\s+/, "");
    var lead = strength ? "나는 " + ro(strength) + ", " : "나는 ";
    var sentence = lead + (scene ? scene + " " : "") + sub[0] + " 사람이에요. 그 일을 " + ro(sub[1]) + " 남겨, 다른 사람도 다시 쓸 수 있게 해요.";
    var mission = clean(mv.missionHeadline);
    var first = it.firstStep || "";
    return {
      version: VERSION, engine: res.version,
      codes: res.actions.map(function (a) { return a.code + "." + (a.sub || ""); }),
      type: { name: it.name, line: it.line, focus: it.focus || "" },
      also: v.items.slice(1).map(function (x) { return { name: x.name, line: x.line }; }),
      typeNote: TYPE_NOTE,
      sentence: sentence,
      basis: { strength: strength, scene: scene, focus: it.focus || "" },
      assets: kit.assets.map(function (a) { return { k: a[0], v: a[1] }; }), assetNote: ASSET_NOTE,
      jobs: kit.jobs.slice(),
      firstStep: first,
      days: [
        { k: "1주", v: first },
        { k: "2주", v: "결과물 하나로 남기기 (" + sub[1] + ")" },
        { k: "3주", v: "한 사람에게 보여 주고 의견 듣기" },
        { k: "4주", v: "고쳐서 다시 써 보기" }
      ],
      reasons: (it.reasons || []).slice(0, 3),
      missionAsk: mission ? "이 길은 내 사명 「" + mission + "」" + gwa(mission) + " 어떻게 이어질까요?" : "",
      checks: CHECKS.slice(), decide: DECIDE, next: NEXT
    };
  }
  var ORDER = ["illuminate", "make", "perform", "care", "connect", "build", "keep"];
  return { VERSION: VERSION, ORDER: ORDER, ASSETS: ASSETS, ASSET_NOTE: ASSET_NOTE, TYPE_NOTE: TYPE_NOTE, SUB: SUB, compose: compose, _josa: { ro: ro, gwa: gwa } };
});
