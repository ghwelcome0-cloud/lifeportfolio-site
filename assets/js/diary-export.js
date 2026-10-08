/* 인생포트폴리오 디지털 다이어리 — 내려받기 (PDF·인쇄 / 텍스트 파일).
 * 화면 엔진(diary-app.js)이 들고 있는 회원 본인의 기록만으로 만든다. 서버 호출·외부 전송 없음.
 *  - 회원이 쓴 쪽만 담는다(빈 양식은 넣지 않음 — 약관 제8조 ④: 양식만 떼어 배포하는 용도가 되지 않도록).
 *  - PDF는 브라우저 인쇄 창의 「PDF로 저장」을 쓴다(별도 라이브러리 없이 한글 글꼴이 그대로 나옴).
 *  - 앞표지는 리포트 표지처럼 제목 · Only One · 주인 이름만. 시작한 날 · 내려받은 날 · 담긴 기록은 2쪽 첫머리.
 *    화면 표지의 저작권 안내 줄은 앞표지에 넣지 않는다(대표 결정 2026-10-08). 뒤표지에 판권 한 줄(대표 피드백 2026-10-09).
 * Pure builders (buildModel / toText / toPrintHTML) are also loaded by scripts/test-diary-export.cjs. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.DiaryExport = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var WD = ["일", "월", "화", "수", "목", "금", "토"];
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  function wd(iso) { return new Date(iso + "T00:00:00Z").getUTCDay(); }
  function dot(iso) { return iso ? iso.replace(/-/g, ".") : ""; }
  function md(iso) { var p = iso.split("-"); return +p[1] + "." + p[2]; }
  function ymdKo(iso) { var p = iso.split("-"); return p[0] + "년 " + (+p[1]) + "월 " + (+p[2]) + "일"; }

  function show(f, v) {
    if (v == null || v === "" || (Array.isArray(v) && !v.length)) return null;
    if (f.type === "check") return v ? "✓ 했어요" : null;
    if (f.type === "score") return v + "점";
    if (f.type === "multi") return [].concat(v).join(", ");
    if (f.type === "date") return dot(String(v)) + " (" + WD[wd(String(v))] + ")";
    return String(v);
  }

  // 화면과 같은 질문 문구를 쓰되, 날짜가 정해진 쪽은 날짜를 붙인다.
  function labelFor(S, p, f, start) {
    if (p.tpl === "month_grid" && start) { var first = S.monthStart(start, p.idx), iso = first.slice(0, 8) + String(+f.key.slice(1)).padStart(2, "0"); return md(iso) + " (" + WD[wd(iso)] + ")"; }
    if (p.tpl === "week_l" && start && /^day\d$/.test(f.key)) { var iso2 = S.addDays(S.addDays(start, 7 * (p.idx - 1)), +f.key.slice(3) - 1); return md(iso2) + " (" + WD[wd(iso2)] + ") 일정"; }
    if (p.tpl === "year_pri" && start) { var m = S.monthStart(start, (p.idx - 1) * 12 + +f.key.slice(1)); return m.slice(0, 4) + "년 " + (+m.slice(5, 7)) + "월"; }
    if (p.tpl === "tracker") { var w = +f.key.slice(1, f.key.indexOf("_")); return "추적 " + ((p.idx - 1) * 7 + w) + "주 · " + f.label; }
    return f.label;
  }

  /**
   * @param {object} S  DiarySchema
   * @param {object} st { seed, meta, pages, logs }
   * @param {function} titleOf (page) => 화면에 쓰는 쪽 제목
   * @param {string} today YYYY-MM-DD
   */
  function buildModel(S, st, titleOf, today) {
    var start = st.meta && st.meta.startDate || null, pages = st.pages || {}, logs = (st.logs || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    var weekOfLog = function (l) { if (!start) return null; var w = S.weekOf(start, l.date); return w >= 1 && w <= 52 ? w : null; };
    var sections = [], usedLogs = {};
    S.PAGES.forEach(function (p) {
      if (!p) return;
      var fields = (S.TEMPLATES[p.tpl].fields || []), rec = pages[p.key] && pages[p.key].fields || {};
      var items = fields.map(function (f) { var v = show(f, rec[f.key]); return v == null ? null : { q: labelFor(S, p, f, start), a: v }; }).filter(Boolean);
      var wl = [];
      if (p.tpl === "week_r") logs.forEach(function (l, i) { if (weekOfLog(l) === p.idx) { wl.push(l); usedLogs[i] = 1; } });
      if (!items.length && !wl.length) return;
      var range = null;
      if (start && (p.tpl === "week_l" || p.tpl === "week_r")) { var a = S.addDays(start, 7 * (p.idx - 1)); range = md(a) + " – " + md(S.addDays(a, 6)); }
      sections.push({ no: p.no, key: p.key, title: titleOf(p), range: range, items: items, logs: wl.map(logView) });
    });
    var rest = logs.filter(function (_, i) { return !usedLogs[i]; });
    if (rest.length) sections.push({ no: null, key: "logs", title: "오늘 해 봤어요 · 기록", range: null, items: [], logs: rest.map(logView) });
    return { name: (st.seed && st.seed.name) || "", start: start, today: today, sections: sections, pagesWritten: sections.filter(function (s) { return s.no; }).length, logCount: logs.length };
    function logView(l) { return { date: dot(l.date) + " (" + WD[wd(l.date)] + ")", text: l.text, kept: l.kept || null }; }
  }

  function fileBase(m) { return "인생포트폴리오_다이어리_" + (m.name ? m.name.replace(/[\\/:*?"<>|\s]+/g, "") + "_" : "") + m.today.replace(/-/g, ""); }

  function toText(m) {
    var L = [];
    L.push("LIFE PORTFOLIO", "인생포트폴리오 맞춤형 다이어리", "Only One", "");
    if (m.name) L.push(m.name + " 님의 한 권", "");
    L.push("────────────────────────────────────────");
    if (m.start) L.push("시작한 날 · " + dot(m.start));
    L.push("내려받은 날 · " + dot(m.today), "담긴 기록 · 직접 쓰신 쪽 " + m.pagesWritten + "쪽 · 오늘 해 봤어요 " + m.logCount + "개", "");
    if (!m.sections.length) L.push("아직 적은 내용이 없어요.", "");
    m.sections.forEach(function (s) {
      L.push("────────────────────────────────────────");
      L.push((s.no ? "p. " + s.no + "  " : "") + s.title + (s.range ? "  (" + s.range + ")" : ""), "");
      s.items.forEach(function (it) { L.push("■ " + it.q); String(it.a).split(/\r?\n/).forEach(function (x) { L.push("  " + x); }); L.push(""); });
      if (s.logs.length) { L.push("■ 오늘 해 봤어요"); s.logs.forEach(function (l) { L.push("  · " + l.date + "  " + l.text); if (l.kept) L.push("    남긴 것 · " + l.kept); }); L.push(""); }
    });
    L.push("────────────────────────────────────────", colophon(m));
    return "\uFEFF" + L.join("\r\n") + "\r\n"; // BOM + CRLF: Windows 메모장에서도 한글·줄바꿈이 그대로 보이도록
  }

  function colophon(m) { return (m.name ? m.name + " 님이" : "회원님이") + " 직접 쓰신 기록입니다. 다이어리 양식 © 파이스 · 인생포트폴리오"; }

  // 앞표지(제목·주인만) → 2쪽 첫머리에 「이 한 권」 정보 → 기록 → 뒤표지(판권 한 줄). 대표 피드백 2026-10-09.
  function toPrintHTML(m) {
    var h = '<section class="xp-cover"><p class="xp-latin">LIFE PORTFOLIO</p><div class="xp-rule"></div><h1 class="xp-title">인생포트폴리오 맞춤형 다이어리</h1><p class="xp-only">Only One</p>' +
      (m.name ? '<p class="xp-owner"><b>' + esc(m.name) + "</b> 님의 한 권</p>" : "") + "</section>";
    h += '<section class="xp-info"><dl class="xp-meta">' + (m.start ? "<div><dt>시작한 날</dt><dd>" + esc(ymdKo(m.start)) + "</dd></div>" : "") + "<div><dt>내려받은 날</dt><dd>" + esc(ymdKo(m.today)) + "</dd></div>" +
      "<div><dt>담긴 기록</dt><dd>직접 쓰신 쪽 " + m.pagesWritten + "쪽 · 해 본 일 " + m.logCount + "개</dd></div></dl></section>";
    if (!m.sections.length) h += '<section class="xp-sec"><p class="xp-empty">아직 적은 내용이 없어요.</p></section>';
    m.sections.forEach(function (s) {
      h += '<section class="xp-sec"><header class="xp-h"><span class="xp-no">' + (s.no ? "p. " + s.no : "") + '</span><h2>' + esc(s.title) + "</h2>" + (s.range ? '<span class="xp-range">' + esc(s.range) + "</span>" : "") + "</header>";
      s.items.forEach(function (it) { h += '<div class="xp-it"><p class="xp-q">' + esc(it.q) + '</p><p class="xp-a">' + esc(it.a) + "</p></div>"; });
      if (s.logs.length) h += '<div class="xp-it"><p class="xp-q">오늘 해 봤어요</p><ul class="xp-logs">' + s.logs.map(function (l) { return "<li><b>" + esc(l.date) + "</b> " + esc(l.text) + (l.kept ? '<span class="xp-kept">남긴 것 · ' + esc(l.kept) + "</span>" : "") + "</li>"; }).join("") + "</ul></div>";
      h += "</section>";
    });
    h += '<section class="xp-back"><div class="xp-back-in"><p class="xp-latin">LIFE PORTFOLIO</p><div class="xp-rule"></div><p class="xp-only">Only One</p></div><p class="xp-colophon">' + esc(colophon(m)) + "</p></section>";
    return h;
  }

  var PRINT_CSS =
    "#dy-print{display:none}" +
    "@media print{" +
    "@page{size:A4;margin:16mm 15mm 18mm}" +
    "html,body{background:#fff!important;overflow:visible!important;height:auto!important}" +
    "body.dy-printing>*:not(#dy-print){display:none!important}" +
    "body.dy-printing #dy-print{display:block!important;color:#222;font-family:var(--sans,'Apple SD Gothic Neo','Malgun Gothic',sans-serif);word-break:keep-all;overflow-wrap:break-word;-webkit-print-color-adjust:exact;print-color-adjust:exact}" +
    "#dy-print .xp-cover{height:258mm;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;break-after:page;page-break-after:always;border:1.2pt solid #C9A04F;outline:5pt solid #0A3D2A;outline-offset:-9pt;box-sizing:border-box;padding:20mm}" +
    "#dy-print .xp-latin{margin:0;font-family:'Cormorant Garamond',Georgia,serif;letter-spacing:.32em;font-size:13pt;color:#7d5f22}" +
    "#dy-print .xp-rule{width:40mm;height:0;border-top:1pt solid #C9A04F;margin:6mm auto}" +
    "#dy-print .xp-title{margin:0;font-size:24pt;line-height:1.35;color:#0A3D2A;font-weight:700}" +
    "#dy-print .xp-only{margin:3mm 0 0;font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-size:16pt;color:#7d5f22}" +
    "#dy-print .xp-owner{margin:16mm 0 0;font-size:15pt;color:#222}" +
    "#dy-print .xp-info{margin:0 0 8mm;padding:4mm 5mm;border:.6pt solid #e3dccb;border-radius:2mm;background:#faf7f0;break-inside:avoid;page-break-inside:avoid}" +
    "#dy-print .xp-meta{margin:0;display:grid;gap:1.5mm;font-size:10pt;color:#454545}" +
    "#dy-print .xp-meta div{display:flex;gap:4mm}#dy-print .xp-meta dt{min-width:22mm;color:#7d5f22;font-weight:700}#dy-print .xp-meta dd{margin:0}" +
    "#dy-print .xp-sec{margin:0 0 7mm}" +
    "#dy-print .xp-h{display:flex;align-items:baseline;gap:3mm;border-bottom:1pt solid #C9A04F;padding:0 0 1.5mm;margin:0 0 3mm;break-after:avoid;page-break-after:avoid}" +
    "#dy-print .xp-h h2{margin:0;font-size:13pt;color:#0A3D2A}#dy-print .xp-no,#dy-print .xp-range{font-size:9pt;color:#7d5f22;white-space:nowrap}#dy-print .xp-range{margin-left:auto}" +
    "#dy-print .xp-it{margin:0 0 3mm;break-inside:avoid;page-break-inside:avoid}" +
    "#dy-print .xp-q{margin:0 0 .8mm;font-size:9pt;color:#666;font-weight:700}" +
    "#dy-print .xp-a{margin:0;font-size:11pt;line-height:1.65;white-space:pre-wrap}" +
    "#dy-print .xp-logs{margin:0;padding-left:5mm;font-size:10.5pt;line-height:1.6}#dy-print .xp-logs b{color:#0A3D2A;font-weight:700;margin-right:2mm}#dy-print .xp-kept{display:block;color:#666;font-size:9.5pt}" +
    "#dy-print .xp-empty{text-align:center;color:#666}" +
    "#dy-print .xp-back{height:258mm;display:flex;flex-direction:column;justify-content:space-between;align-items:center;text-align:center;break-before:page;page-break-before:always;break-inside:avoid;page-break-inside:avoid;background:#0A3D2A;border:1.2pt solid #C9A04F;outline:5pt solid #0A3D2A;outline-offset:-9pt;box-sizing:border-box;padding:20mm 16mm 14mm}" +
    "#dy-print .xp-back-in{flex:1;display:flex;flex-direction:column;justify-content:center}#dy-print .xp-back .xp-latin,#dy-print .xp-back .xp-only{color:#C9A04F}" +
    "#dy-print .xp-colophon{margin:0;font-size:8.5pt;line-height:1.6;color:rgba(255,253,248,.72)}" +
    "}";

  return { buildModel: buildModel, toText: toText, toPrintHTML: toPrintHTML, fileBase: fileBase, PRINT_CSS: PRINT_CSS };
});
