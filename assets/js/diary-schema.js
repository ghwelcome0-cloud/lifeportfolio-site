/* 인생포트폴리오 디지털 다이어리 — page & field schema (shared by browser and server).
 * Source: manufacturer handoff v1.4.2 body_256p (print page numbers kept 1:1).
 * One template per unique print layout; repeated pages are generated from that template.
 * Pure data + pure functions. No network, no time, no randomness.
 * functions/_diary_schema.js must stay a byte copy of this file (checked by test). */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.DiarySchema = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var VERSION = "diary-schema-v1";

  // 13 life domains — unified to the list used by the quarterly review (p176-188)
  // and the domain guide (p217). The older p22 list is retired.
  var DOMAINS = [
    { key: "mission", name: "사명·비전", q: "나는 왜 살아가는가? 어디로 가고 싶은가?", service: "routes" },
    { key: "career", name: "직업·경력", q: "내가 가장 잘 기여할 수 있는 일은?", service: "practice" },
    { key: "finance", name: "재정·자산", q: "안전과 자유의 균형점은?", service: "collaboration" },
    { key: "family", name: "가족·관계", q: "가장 가까운 사람들에게 나는 어떤 존재인가?", service: null },
    { key: "health", name: "건강·체력", q: "몸과 마음의 회복 루틴은?", service: null },
    { key: "learning", name: "학습·성장", q: "올해 가장 배우고 싶은 것은?", service: "learning" },
    { key: "faith", name: "영성·신앙", q: "보이지 않는 것을 어떻게 마주하는가?", service: "organizations" },
    { key: "society", name: "사회·공헌", q: "내가 속한 공동체에 무엇을 줄 수 있는가?", service: "projects" },
    { key: "leisure", name: "취미·여가", q: "회복이 되는 활동은?", service: null },
    { key: "habit", name: "시간·습관", q: "내 24시간의 우선순위는?", service: "game" },
    { key: "emotion", name: "감정·정서", q: "내 감정의 패턴과 트리거는?", service: "mentor" },
    { key: "space", name: "환경·공간", q: "나를 살리는 공간은 어떤 곳인가?", service: null },
    { key: "legacy", name: "유산·기록", q: "내가 남기고 싶은 것은?", service: "archive" }
  ];

  // Upcoming services, worded exactly as the homepage promises (no dates, no guarantees).
  var SERVICES = {
    routes: { name: "고유성 기반 자산화 길찾기", line: "내 고유함이 일으키는 일곱 가지 변화 중 나의 것을 찾고, 처음 남길 것 하나부터 함께 정해요.", available: true },
    practice: { name: "자산화 실행 훈련", line: "작은 실행이 실제 결과물로 남도록, 해보고 돌아보고 다시 다듬어요. 12주 실행 설계와 90일 훈련을 준비해요." },
    game: { name: "인생 훈련 게임", line: "30일 미션으로 일상에서 해볼 작은 시도를 이어가요. 내 속도로 쉬고 다시 시작할 수 있어요." },
    community: { name: "함께 배우는 소그룹", line: "한 주 동안 해본 일을 나누고, 주간 회고와 동료 피드백으로 서로의 다음 시도를 도와요." },
    mentor: { name: "멘토와의 동행", line: "혼자 정리하기 어려운 고민을, 일대일 코칭·멘토링과 실행 피드백으로 다음 걸음에 옮겨요." },
    projects: { name: "현실 문제 해결 프로젝트", line: "교회·소상공인·비영리·지역의 실제 필요에서 출발해, 서로 다른 강점을 모아 변화를 만들어요." },
    archive: { name: "나의 자산 기록", line: "만든 것, 배운 점, 도움이 된 순간을 출처와 함께 보관해요. 비공개가 기본이고 공개 범위는 내가 정해요." },
    review: { name: "결과물 검토와 피드백", line: "무엇을 만들었고 어떻게 쓰였는지 근거를 살펴 다음 개선으로 이어요. 공인 자격이나 수익을 보증하는 인증은 아니에요." },
    collaboration: { name: "협업과 나눔의 마켓", line: "필요한 사람에게 내 결과물을 전하고 함께할 일을 만나요. 판매하지 않는 나눔도 소중히 다뤄요." },
    learning: { name: "삶을 잇는 평생학습", line: "자기이해부터 표현·실행·프로젝트까지 배움을 이어가요. 공인 학점·자격을 약속하지 않아요." },
    organizations: { name: "교회·학교·기관과 함께", line: "각 사람의 고유함이 공동체의 필요와 만나도록, 함께 배우고 실천하는 과정을 준비해요." },
    agents: { name: "AI 동행", line: "목표와 사용할 자료를 내가 정하고 계획을 확인한 뒤 도움을 받아요. AI는 하나님의 뜻을 대신 판단하지 않습니다." }
  };
  var COMING_NOTE = "출시 준비중 · 일정과 참여 방법은 준비가 끝나면 안내해 드릴게요.";

  // 자산화 길찾기의 일곱 가지 변화 (asset-map v1 · homepage #v6-routes). 이름은 저장값, line은 고객 문장.
  var ASSET_CHANGES = [
    { name: "밝힘", line: "모르던 것을 알게 해요" },
    { name: "지음", line: "없던 것을 만들어 내요" },
    { name: "펼침", line: "몸과 목소리로 보여 줘요" },
    { name: "돌봄", line: "사람과 생명을 살펴요" },
    { name: "이음", line: "사람과 사람을 이어요" },
    { name: "세움", line: "흩어진 것에 순서를 세워요" },
    { name: "지킴", line: "맡은 것을 잘 지켜요" }
  ];
  var ASSET_DIRECTIONS = ASSET_CHANGES.map(function (c) { return c.name; });
  // 2026-10-09 이전의 옛 6개 방향 저장값. 지우지 않고 보여 주며, 새 변화로 이어 볼 수 있게 한다(자동 변경 없음).
  var LEGACY_DIRECTIONS = { "지식과 통찰": ["밝힘"], "콘텐츠와 표현": ["펼침", "지음"], "경험과 프로젝트": [],
    "관계와 공동체": ["이음"], "시스템과 사업": ["세움"], "자원과 관리": ["지킴"] };

  // Evidence stages for "오늘 해 봤어요" records (AX v0.2). Not a person level, not certification.
  var STAGES = [
    { n: 0, label: "해 봤어요", hint: "내가 해 본 일을 적었어요" },
    { n: 1, label: "결과물을 남겼어요", hint: "메모·자료·사진처럼 남은 것이 있어요" },
    { n: 2, label: "동료 피드백", hint: "함께하는 사람에게 의견을 들었어요", service: "community" },
    { n: 3, label: "멘토와 확인", hint: "멘토와 함께 살펴봤어요", service: "mentor" },
    { n: 4, label: "실제 반응", hint: "쓴 사람·받은 사람의 반응을 들었어요", service: "review" },
    { n: 5, label: "다시 쓰였어요", hint: "다음에 다시 쓰거나 다른 사람에게 전해졌어요", service: "archive" }
  ];
  var STAGE_NOTE = "단계는 기록에 남은 근거를 보여 줄 뿐, 사람의 가치·능력이나 공식 인증을 뜻하지 않아요.";

  var MOODS = ["아주 좋음", "좋음", "보통", "지침", "힘듦"];
  var AXES = [
    { key: "self_understanding", name: "자기이해" },
    { key: "self_expression", name: "자기표현" },
    { key: "self_design", name: "자기설계" },
    { key: "self_execution", name: "자기실행" }
  ];
  var WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];

  function F(key, type, label, hint, extra) {
    var f = { key: key, type: type, label: label };
    if (hint) f.hint = hint;
    if (extra) for (var k in extra) f[k] = extra[k];
    return f;
  }
  function range(n, fn) { var a = []; for (var i = 1; i <= n; i++) a.push(fn(i)); return a; }

  // type: text(≤300) · long(≤2000) · score(1-10) · date(YYYY-MM-DD) · year · check · choice · multi
  var TEMPLATES = {
    title: { part: "표지", fields: [] },
    epigraph: { part: "표지", fields: [] },
    divider: { part: "", fields: [] },
    intro: { part: "PART 0", fields: [F("hope", "long", "이 1년, 가장 바라는 한 가지는 무엇인가요?", "한 문장이면 충분해요.")] },
    mission: { part: "PART 0", fields: [
      F("core", "long", "리포트의 사명을 내 말로 다시 써 보세요", "그대로 옮겨도 좋아요. 옮기는 순간 내 문장이 됩니다.", { seed: "mission" }),
      F("word", "text", "이 사명에서 가장 중요한 단어 하나", "예) 회복 · 다리 · 기록자"),
      F("feel", "long", "이 사명을 처음 마주한 오늘의 감정")] },
    vision: { part: "PART 0", fields: [
      F("core", "long", "리포트의 비전을 내 말로 다시 써 보세요", "사명이 '왜'라면 비전은 '어디로'예요.", { seed: "vision" }),
      F("scene", "long", "이 비전이 이뤄진 5년 뒤의 한 장면", "언제 · 어디서 · 누구와 · 무엇을 하고 있나요?"),
      F("year", "year", "이 비전을 이루고 싶은 해")] },
    axes_a: { part: "PART 0", axes: ["self_understanding", "self_expression"], fields: [
      F("self_understanding", "long", "자기이해 — 나의 세 줄 자평", "리포트의 돌아볼 질문에 답하듯 적어 보세요."),
      F("self_expression", "long", "자기표현 — 나의 세 줄 자평", "리포트의 돌아볼 질문에 답하듯 적어 보세요.")] },
    axes_b: { part: "PART 0", axes: ["self_design", "self_execution"], fields: [
      F("self_design", "long", "자기설계 — 나의 세 줄 자평", "리포트의 돌아볼 질문에 답하듯 적어 보세요."),
      F("self_execution", "long", "자기실행 — 나의 세 줄 자평", "리포트의 돌아볼 질문에 답하듯 적어 보세요."),
      F("gap", "long", "네 가지 중 가장 키우고 싶은 하나와 그 이유", "가장 강한 축과 가장 약한 축의 차이가 다음 1년의 힌트예요.")] },
    top3: { part: "PART 0", fields: [
      F("s1", "long", "첫 번째 강점을 가장 잘 쓴 순간", "", { seedIndex: 0 }),
      F("s2", "long", "두 번째 강점을 가장 잘 쓴 순간", "", { seedIndex: 1 }),
      F("s3", "long", "세 번째 강점을 가장 잘 쓴 순간", "", { seedIndex: 2 }),
      F("bundle", "long", "세 강점을 한 문장으로 묶으면")] },
    top2: { part: "PART 0", fields: [
      F("g1_if", "text", "첫 번째 성장 포인트 · 만약 이런 상황이 오면", "예) 준비가 덜 됐다고 느껴지면", { seedIndex: 0 }),
      F("g1_then", "text", "첫 번째 성장 포인트 · 그러면 나는", "예) 계획표에 적어 둔 시간을 먼저 잡는다", { seedIndex: 0 }),
      F("g2_if", "text", "두 번째 성장 포인트 · 만약 이런 상황이 오면", "", { seedIndex: 1 }),
      F("g2_then", "text", "두 번째 성장 포인트 · 그러면 나는", "", { seedIndex: 1 })] },
    profile: { part: "PART 0", fields: [
      F("surprise", "long", "여섯 가지 중 가장 의외였던 하나와 이유"),
      F("env", "long", "이 프로파일이 가장 잘 맞는 나의 환경 한 줄")] },
    career: { part: "PART 0", service: "routes", fields: [
      F("closest", "choice", "지금 하는 일과 가장 가까운 카드는?", "", { options: ["카드 1", "카드 2", "카드 3"] }),
      F("dirs", "multi", "내가 잘 일으키는 변화 (최대 2개)", "일곱 가지 변화 중 끌리는 것을 골라요. 한 가지에 가두지 않아요.", { options: ASSET_DIRECTIONS, legacyOptions: Object.keys(LEGACY_DIRECTIONS), max: 2 }),
      F("oneyear", "long", "1년 뒤 이 카드들이 어떤 모습이면 만족스러울까요?")] },
    outro: { part: "PART 0", fields: [F("feel", "long", "옮겨 적기를 마친 오늘의 한 줄 소감")] },
    lifemap_l: { part: "PART 1", fields: [
      F("top", "long", "가장 키우고 싶은 영역 3개 (우선순위대로)"),
      F("focus", "text", "올해 한 영역에만 집중한다면?")] },
    lifemap_r: { part: "PART 1", fields: [].concat.apply([], DOMAINS.map(function (d, i) {
      return [F("d" + (i + 1), "score", d.name + " · 지금 몇 점인가요?", "1~3 거의 비어 있음 · 4~6 보통 · 7~9 충실 · 10 만족", { domain: i }),
        F("d" + (i + 1) + "n", "text", d.name + " · 한 줄 메모", "", { domain: i })];
    })) },
    year_cal: { part: "YEARLY", fields: [] },
    year_pri: { part: "YEARLY", fields: range(12, function (i) { return F("m" + i, "long", i + "번째 달의 생일·기념일·이정표"); }) },
    annual: { part: "PART 2", fields: [
      F("word", "text", "올해의 한 단어"),
      F("dec31", "long", "1년 뒤 마지막 날, 나는 어떤 모습으로 한 해를 마감하고 싶나요?")] },
    ninety: { part: "PART 2", service: "practice", fields: [
      F("q1", "long", "1분기 (첫 90일) — 손에 남길 결과 하나"),
      F("q2", "long", "2분기 (180일까지)"),
      F("q3", "long", "3분기 (270일까지)"),
      F("q4", "long", "4분기 (365일까지) — 마무리와 다음 해 준비")] },
    milestone: { part: "PART 2", fields: [
      F("vision", "long", "올해의 핵심 한 문장"),
      F("q1", "long", "1분기 마일스톤 (90일)"), F("q2", "long", "2분기 마일스톤 (180일)"),
      F("q3", "long", "3분기 마일스톤 (270일)"), F("q4", "long", "4분기 마일스톤 (365일)")] },
    month_grid: { part: "MONTHLY", fields: range(31, function (i) { return F("c" + i, "text", i + "일의 일정·이정표"); }) },
    month_pri: { part: "MONTHLY", service: "community", fields: [
      F("mission", "text", "이번 달 사명 한 줄"),
      F("a1", "text", "A · 꼭 할 일 1"), F("a2", "text", "A · 꼭 할 일 2"),
      F("b1", "text", "B · 중요한 일 1"), F("b2", "text", "B · 중요한 일 2"),
      F("c1", "text", "C · 여유 있으면 할 일"),
      F("good", "text", "월말 회고 · 잘된 것"), F("learn", "text", "월말 회고 · 배운 것"), F("next", "text", "월말 회고 · 다음 달")] },
    week_l: { part: "WEEKLY", fields: [
      F("mission", "text", "이번 주 사명 한 줄"),
      F("a", "text", "A · 이번 주 꼭 할 일", "", { seed: "weekAction" }), F("b", "text", "B · 중요한 일"), F("c", "text", "C · 여유 있으면"),
      F("if1", "text", "만약 ___ 하면, 그러면 ___ 한다 (1)", "예) 출근길 지하철에 앉으면, 이번 주 할 일을 한 번 본다"),
      F("if2", "text", "만약 ___ 하면, 그러면 ___ 한다 (2)"), F("if3", "text", "만약 ___ 하면, 그러면 ___ 한다 (3)")
    ].concat(WEEKDAYS.map(function (d, i) { return F("day" + (i + 1), "text", d + "요일 일정"); })) },
    week_r: { part: "WEEKLY", service: "game", fields: [
      F("dd_date", "date", "이번 주 깊이 기록할 날"),
      F("dd_event", "long", "그날의 사건"), F("dd_feel", "long", "감정과 생각"), F("dd_mean", "text", "한 줄 의미"),
      F("memo", "long", "자유 메모"),
      F("good", "text", "이번 주 회고 · 잘된 것"), F("learn", "text", "이번 주 회고 · 배운 것"), F("next", "text", "이번 주 회고 · 다음 주", "여기 적은 한 줄이 다음 주 첫 장에 이어져요.")] },
    quarterly: { part: "PART 4", fields: [].concat.apply([], range(4, function (q) {
      return [F("q" + q + "_1", "long", q + "분기 · 이 영역에서 가장 중요했던 사건"), F("q" + q + "_2", "long", q + "분기 · 그때의 감정과 생각"),
        F("q" + q + "_3", "long", q + "분기 · 그것이 내게 의미하는 바"), F("q" + q + "_4", "long", q + "분기 · 다음 분기의 의도와 행동")];
    })) },
    blank_note: { part: "여백", fields: [F("note", "long", "여백 메모")] },
    gratitude: { part: "PART 5", fields: [
      F("g1", "text", "이번 달 감사 1"), F("g2", "text", "이번 달 감사 2"), F("g3", "text", "이번 달 감사 3"),
      F("surprise", "long", "예상하지 못했던 좋은 일"), F("next", "text", "다음 달에 기대하는 한 가지")] },
    tracker: { part: "PART 6", service: "mentor", weeksPerPage: 7, fields: [].concat.apply([], range(7, function (i) {
      return [F("w" + i + "_done", "check", "이 주의 A를 마쳤나요?"), F("w" + i + "_memo", "text", "성찰 메모")];
    })) },
    quotes: { part: "PART 7", fields: [].concat.apply([], range(5, function (i) {
      return [F("t" + i, "long", "마음에 남은 말씀·문장 " + i), F("by" + i, "text", "출처 " + i)];
    })) },
    guide13: { part: "PART 7", fields: [] },
    guide13_ans: { part: "PART 7", fields: DOMAINS.map(function (d, i) { return F("a" + (i + 1), "long", d.name + " — " + d.q, "", { domain: i }); }) },
    usage: { part: "PART 7", service: "agents", fields: [] },
    owner: { part: "OWNER", fields: [F("contact", "text", "이 다이어리에 남겨 둘 나의 한 줄 소개")] },
    daily: { part: "PART 7", fields: [
      F("date", "date", "날짜"), F("mood", "choice", "오늘의 마음", "", { options: MOODS }),
      F("note", "long", "기록하고 싶은 것", "매일이 아니어도 괜찮아요. 의미 있는 날만.")] },
    free: { part: "FREE NOTES", service: "archive", fields: [F("title", "text", "제목"), F("note", "long", "아이디어 · 인용구 · 즉흥 메모 · 미래의 나에게 보내는 편지")] }
  };

  var DIVIDERS = {
    8: { part: "PART 0", title: "리포트를 내 말로 옮기기", sub: "받은 것을 내 문장으로 다시 쓰면, 정보가 내 것이 됩니다." },
    20: { part: "PART 1", title: "13영역 인생 지도", sub: "인생은 한 가지 역할로 줄어들지 않아요. 지금의 균형을 살펴봅니다." },
    37: { part: "PART 2", title: "연간 비전 · 90일 마일스톤", sub: "1년의 끝을 먼저 그리고, 90일씩 나누어 걸어갑니다." },
    175: { part: "PART 4", title: "영역별 분기 회고", sub: "사실 → 감정 → 의미 → 의도 순서로 지난 분기를 돌아봅니다." }
  };

  // Print page map (1..256). Blank print sides are kept as null so spreads keep paper parity.
  function buildPages() {
    var pages = new Array(257).fill(null), put = function (no, tpl, key, idx, total, extra) {
      var p = { no: no, tpl: tpl, key: key, idx: idx || 1, total: total || 1 };
      if (extra) for (var k in extra) p[k] = extra[k];
      pages[no] = p;
    };
    put(3, "title", "title"); put(5, "epigraph", "epigraph");
    [8, 20, 37, 175].forEach(function (n) { put(n, "divider", "divider-" + n, 1, 1, DIVIDERS[n]); });
    put(9, "intro", "intro"); put(10, "mission", "mission"); put(11, "vision", "vision");
    put(12, "axes_a", "axes-a"); put(13, "axes_b", "axes-b"); put(14, "top3", "top3"); put(15, "top2", "top2");
    put(16, "profile", "profile"); put(17, "career", "career"); put(18, "outro", "outro");
    for (var i = 1; i <= 6; i++) { put(19 + i * 2, "lifemap_l", "lifemap-" + i + "-l", i, 6); put(20 + i * 2, "lifemap_r", "lifemap-" + i + "-r", i, 6); }
    put(33, "year_cal", "year-1-cal", 1, 2); put(34, "year_pri", "year-1-pri", 1, 2);
    put(35, "year_cal", "year-2-cal", 2, 2); put(36, "year_pri", "year-2-pri", 2, 2);
    put(38, "annual", "annual"); put(39, "ninety", "ninety");
    for (i = 1; i <= 7; i++) put(39 + i, "milestone", "milestone-" + i, i, 7);
    for (i = 1; i <= 12; i++) { put(45 + i * 2, "month_grid", "month-" + i + "-grid", i, 12); put(46 + i * 2, "month_pri", "month-" + i + "-pri", i, 12); }
    for (i = 1; i <= 52; i++) { put(69 + i * 2, "week_l", "week-" + i + "-l", i, 52); put(70 + i * 2, "week_r", "week-" + i + "-r", i, 52); }
    for (i = 1; i <= 13; i++) put(175 + i, "quarterly", "quarterly-" + i, i, 13, { domain: i - 1 });
    for (i = 1; i <= 4; i++) put(188 + i, "blank_note", "note-" + i, i, 4);
    for (i = 1; i <= 12; i++) put(192 + i, "gratitude", "gratitude-" + i, i, 12);
    for (i = 1; i <= 8; i++) put(204 + i, "tracker", "tracker-" + i, i, 8);
    for (i = 1; i <= 4; i++) put(212 + i, "quotes", "quotes-" + i, i, 4);
    put(217, "guide13", "guide13"); put(218, "guide13_ans", "guide13-ans");
    put(219, "usage", "usage"); put(220, "owner", "owner");
    for (i = 1; i <= 24; i++) put(220 + i, "daily", "daily-" + i, i, 24);
    for (i = 1; i <= 12; i++) put(244 + i, "free", "free-" + i, i, 12);
    return pages;
  }
  var PAGES = buildPages();
  var BY_KEY = {};
  PAGES.forEach(function (p) { if (p) BY_KEY[p.key] = p; });

  var LIMITS = { text: 300, long: 2000 };
  // Validates a field patch for a page. Returns { ok, clean } or { ok:false, error }.
  // Empty string / null clears a field.
  function validatePatch(pageKey, patch) {
    var page = BY_KEY[pageKey];
    if (!page) return { ok: false, error: "unknown-page" };
    var tpl = TEMPLATES[page.tpl], byField = {};
    tpl.fields.forEach(function (f) { byField[f.key] = f; });
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) return { ok: false, error: "bad-patch" };
    var keys = Object.keys(patch);
    if (!keys.length || keys.length > 64) return { ok: false, error: "bad-patch" };
    var clean = {};
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i], f = byField[k], v = patch[k];
      if (!f) return { ok: false, error: "unknown-field" };
      if (v === null || v === "") { clean[k] = null; continue; }
      switch (f.type) {
        case "text": case "long":
          if (typeof v !== "string") return { ok: false, error: "bad-value" };
          v = v.replace(/\r\n?/g, "\n");
          if (f.type === "text") v = v.replace(/\n/g, " ");
          if (v.length > LIMITS[f.type]) return { ok: false, error: "too-long" };
          if (!v.trim()) { clean[k] = null; continue; }
          break;
        case "score": if (!(Number.isInteger(v) && v >= 1 && v <= 10)) return { ok: false, error: "bad-value" }; break;
        case "date": if (typeof v !== "string" || !isDate(v)) return { ok: false, error: "bad-value" }; break;
        case "year": if (!(Number.isInteger(v) && v >= 1900 && v <= 2200)) return { ok: false, error: "bad-value" }; break;
        case "check": if (typeof v !== "boolean") return { ok: false, error: "bad-value" }; if (!v) { clean[k] = null; continue; } break;
        case "choice": if (f.options.indexOf(v) < 0) return { ok: false, error: "bad-value" }; break;
        case "multi":
          var allowed = f.options.concat(f.legacyOptions || []);
          if (!Array.isArray(v) || v.length > (f.max || f.options.length) || v.some(function (x) { return allowed.indexOf(x) < 0; }) || new Set(v).size !== v.length) return { ok: false, error: "bad-value" };
          if (!v.length) { clean[k] = null; continue; }
          v = allowed.filter(function (o) { return v.indexOf(o) >= 0; });
          break;
        default: return { ok: false, error: "bad-field" };
      }
      clean[k] = v;
    }
    return { ok: true, clean: clean };
  }
  function isDate(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var d = new Date(s + "T00:00:00Z");
    return !isNaN(d) && d.toISOString().slice(0, 10) === s;
  }
  // Quick record ("오늘 해 봤어요").
  function validateLog(log) {
    if (!log || typeof log !== "object") return { ok: false, error: "bad-log" };
    if (typeof log.date !== "string" || !isDate(log.date)) return { ok: false, error: "bad-date" };
    if (typeof log.text !== "string" || !log.text.trim() || log.text.length > 300) return { ok: false, error: "bad-text" };
    if (log.kept != null && (typeof log.kept !== "string" || log.kept.length > 300)) return { ok: false, error: "bad-kept" };
    var out = { date: log.date, text: log.text.replace(/\s+/g, " ").trim() };
    if (log.kept && log.kept.trim()) out.kept = log.kept.replace(/\s+/g, " ").trim();
    // X5 (2026-10-09): optional — which of my seven changes this record shows. Shown as my own trace, never scored.
    if (log.change != null) { if (ASSET_DIRECTIONS.indexOf(log.change) < 0) return { ok: false, error: "bad-change" }; out.change = log.change; }
    return { ok: true, clean: out };
  }
  // Calendar helpers for the undated diary: dates follow the owner's chosen start date.
  function addDays(iso, n) { var d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function daysBetween(a, b) { return Math.round((new Date(b + "T00:00:00Z") - new Date(a + "T00:00:00Z")) / 86400000); }
  function weekOf(start, iso) { var d = daysBetween(start, iso); return d < 0 ? 0 : Math.floor(d / 7) + 1; }
  function monthStart(start, i) { // i: 1..12 → first day of the i-th month counted from the start month
    var d = new Date(start + "T00:00:00Z"); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + i - 1);
    return d.toISOString().slice(0, 10);
  }
  return { VERSION: VERSION, DOMAINS: DOMAINS, SERVICES: SERVICES, COMING_NOTE: COMING_NOTE, ASSET_DIRECTIONS: ASSET_DIRECTIONS, ASSET_CHANGES: ASSET_CHANGES, LEGACY_DIRECTIONS: LEGACY_DIRECTIONS,
    STAGES: STAGES, STAGE_NOTE: STAGE_NOTE, MOODS: MOODS, AXES: AXES, WEEKDAYS: WEEKDAYS, TEMPLATES: TEMPLATES, PAGES: PAGES, BY_KEY: BY_KEY,
    LIMITS: LIMITS, validatePatch: validatePatch, validateLog: validateLog, isDate: isDate,
    addDays: addDays, daysBetween: daysBetween, weekOf: weekOf, monthStart: monthStart };
});
