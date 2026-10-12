/* 인생포트폴리오 조판 v1 (typeset-v1, 2026-10-12 대표 지시: 어절 · 의미 단위 · 시각 안정).
 * 리포트 책 · 실행 프로그램 책 · 다이어리가 같이 쓰는 한 벌. 화면에 그리는 순간에만 적용하므로
 * 이미 저장된 리포트에도 똑같이 적용된다(저장된 글은 바꾸지 않는다).
 *
 * 1) 글 다듬기 fixText — 뜻은 그대로, 틀린 조판만 고친다.
 *    · 문장 끝 마침표 뒤 띄어쓰기 누락:  "대조합니다.특히" → "대조합니다. 특히"
 *    · 같은 어절이 바로 이어 두 번:      "결과로 결과로 답하는" → "결과로 답하는"
 *    · 닫는 따옴표 오기(U+02BC ʼ):        "‘…ʼ를" → "‘…’를"
 *    · 가운뎃점 짝 맞추기:                "관계· 신뢰" → "관계 · 신뢰"
 * 2) 의미 단위 붙이기 — 줄이 바뀌어도 한 덩어리로 읽히게 붙임 공백(U+00A0)을 쓴다.
 *    · 숫자 + 단위("12 주", "3 개") · "p. 15" · 날짜 "10.05 (월)" · 기호(·, →)는 앞 말에 붙는다(줄 첫머리에 오지 않음).
 * 3) 줄 모양 — 짧은 덩어리(제목 · 이름표 · 한두 줄 문장)는 줄 길이를 고르게(balance: 줄 수는 늘지 않는다),
 *    긴 문단은 마지막 줄에 한 어절만 남지 않게(pretty: 화면 리플로우에서만. A4 지면은 줄 수 예산이 있어 제외).
 * 순수 함수 + 읽기 전용 측정. 폼 입력칸 · 코드 · 스크립트는 건드리지 않는다. */
(function (root, factory) {
  var api = factory(); api.SRC = "(function(f){var a=f();self.LPTypeset=a;})(" + String(factory) + ");";
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.LPTypeset = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var VERSION = "typeset-v1";
  var NB = "\u00a0", WJ = "\u2060";
  var UNIT = "개월|개|주차|주|쪽|점|명|시간|분|초|일|년|월|칸|권|번|회|장|가지|단계|문항|%|퍼센트|살|세|배";
  // 단위 뒤에 올 수 있는 것: 끝 · 띄어쓰기 · 문장부호 · 조사/어미 한두 글자(을·를·이·가·은·는·의·에·과·와·로·으로·만·도·씩·째·차·째·동안 등)
  var AFTER = "(?=$|[\\s\\u00a0.,)·/~!?’”」]|(?:을|를|이|가|은|는|의|에|과|와|으로|로|만|도|씩|째|차|부터|까지|마다|동안|안|뒤|짜리|이에요|예요|입니다|이면|면)(?![가-힣])|(?:에서|에게|으로|이라|라)(?=[\\s.,]|$))";
  // 같은 어절 반복으로 쓰는 말(말맛이 있는 반복)은 그대로 둔다.
  var KEEP_REPEAT = /^(하나|조금|천천히|차근차근|가만|자꾸|점점|어서|빨리|정말|아주|또|더|꼭|잘)$/;
  function fixText(s) {
    if (typeof s !== "string" || !/[가-힣]/.test(s)) return s;
    var t = s;
    t = t.replace(/([가-힣][.?!])(?=[가-힣‘“「(])/g, "$1 ");
    t = t.replace(/(^|[\s(‘“「])([가-힣]{2,}[가-힣A-Za-z0-9]*)((?:\s|\u00a0)+)\2(?=[\s.,!?’”」)]|$)/g, function (m, a, w) { return KEEP_REPEAT.test(w) ? m : a + w; });
    if (t.indexOf("\u02bc") >= 0) t = t.replace(/\u02bc/g, "\u2019");
    t = t.replace(/([가-힣A-Za-z0-9)])· (?=[가-힣A-Za-z0-9(])/g, "$1 · ").replace(/([가-힣A-Za-z0-9)]) ·(?=[가-힣A-Za-z0-9(])/g, "$1 · ");
    return t;
  }
  var UNIT_RE = new RegExp("(\\d) (?=(?:" + UNIT + ")" + AFTER + ")", "g");
  function glue(s) {
    if (typeof s !== "string") return s;
    return s.replace(UNIT_RE, "$1" + NB)
      .replace(/\bp\. (\d)/g, "p." + NB + "$1")
      .replace(/(\d) \(/g, "$1" + NB + "(")
      .replace(/(\d) (\/) (\d)/g, "$1" + NB + "$2" + NB + "$3")
      .replace(/ (·|→|—)(?=\s|$)/g, NB + "$1")
      // 붙어 쓴 말 묶음(학습·연구)과 닫는 괄호 · 따옴표 뒤 조사(목표)를 · 봤어요」에)는 한 어절 — 그 안에서 줄을 바꾸지 않는다(U+2060).
      .replace(/(^|[\s(‘“「])([가-힣A-Za-z0-9]{1,4}(?:·[가-힣A-Za-z0-9]{1,4})+)(?=[가-힣]{0,3}(?:[\s.,)’”」]|$))/g, function (m, a, w) { return w.replace(/·/g, "").length <= 8 ? a + w.replace(/·/g, WJ + "·" + WJ) : m; })
      .replace(/([)’”」』])(?=[가-힣])/g, "$1" + WJ)
      .replace(/ (↗|›)(?=\s|$)/g, NB + "$1");
  }
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, SELECT: 1, OPTION: 1, CODE: 1, PRE: 1, SVG: 1, svg: 1, NOSCRIPT: 1 };
  var SHORT = 64; // 글자 수(공백 제외) ≤ 64 → 한두 줄짜리 덩어리로 보고 balance
  function apply(rootEl) {
    if (!rootEl || typeof document === "undefined") return 0;
    var doc = rootEl.ownerDocument || document, win = doc.defaultView || window, changed = 0;
    var w = doc.createTreeWalker(rootEl, 4, { acceptNode: function (n) {
      for (var e = n.parentNode; e && e !== rootEl.parentNode; e = e.parentNode) { if (SKIP[e.tagName] || (e.isContentEditable)) return 2; }
      return /[가-힣]/.test(n.nodeValue) ? 1 : 2; } });
    var list = []; while (w.nextNode()) list.push(w.currentNode);
    list.forEach(function (n) { var t = glue(fixText(n.nodeValue)); if (t !== n.nodeValue) { n.nodeValue = t; changed++; } });
    // line shape: mark the block that actually lays out the line (text-wrap works on block containers, not on <b>/<span>).
    // Class only — no inline styles, no layout writes. Length = that block's own text (spaces excluded).
    var seen = [];
    list.forEach(function (n) {
      var e = n.parentNode;
      while (e && e !== rootEl && win && win.getComputedStyle && /^inline/.test(win.getComputedStyle(e).display) && win.getComputedStyle(e).display !== "inline-block") e = e.parentNode;
      if (!e || e.nodeType !== 1 || SKIP[e.tagName] || seen.indexOf(e) >= 0) return;
      seen.push(e);
      if (e.classList.contains("ts-short") || e.classList.contains("ts-long")) return;
      var len = (e.textContent || "").replace(/\s/g, "").length;
      e.classList.add(len <= SHORT ? "ts-short" : "ts-long");
    });
    return changed;
  }
  // CSS: balance never adds lines (CSS Text 4); pretty may add one, so it is limited to fluid screens.
  // 붙여 둔 덩어리가 칸보다 길 때만 마지막 수단으로 그 안에서 나눈다(넘침 0이 먼저).
  var CSS_BOOK = ".ts-short,.ts-long{overflow-wrap:break-word;}.ts-short{text-wrap:balance;}" +
    "@media screen and (max-width:768px){.book.lb-mobile .ts-long{text-wrap:pretty;}" +
    // 목차 한 줄(장 번호 20mm + 제목 + 점선 8mm + 쪽)이 좁은 화면에서 제목 칸을 60px까지 줄였다 → 점선을 접고 장 번호를 줄여 제목에 폭을 준다.
    ".book.lb-mobile .toc__leader{display:none!important;}.book.lb-mobile .toc__ch{width:auto!important;flex:0 0 auto!important;min-width:2.2em;font-size:20px!important;}" +
    ".book.lb-mobile .toc__list li{gap:12px!important;}.book.lb-mobile .toc__pg{margin-left:auto;}}";
  var CSS_SCREEN = ".ts-short,.ts-long{overflow-wrap:break-word}.ts-short{text-wrap:balance}@media screen{.ts-long{text-wrap:pretty}}";
  return { VERSION: VERSION, fixText: fixText, glue: glue, apply: apply, CSS_BOOK: CSS_BOOK, CSS_SCREEN: CSS_SCREEN, SHORT: SHORT };
});
