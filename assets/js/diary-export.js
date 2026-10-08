/* 인생포트폴리오 디지털 다이어리 — 내려받기 (PDF·인쇄 / 텍스트 파일).
 * 화면 엔진(diary-app.js)이 들고 있는 회원 본인의 기록만으로 만든다. 서버 호출·외부 전송 없음.
 *  - PDF는 브라우저 인쇄 창의 「PDF로 저장」을 쓴다(별도 라이브러리 없이 한글 글꼴이 그대로 나옴).
 *  - 앞표지는 리포트 표지처럼 제목 · Only One · 주인 이름만. 시작한 날 · 내려받은 날 · 담긴 기록은 2쪽 첫머리.
 *    화면 표지의 저작권 안내 줄은 앞표지에 넣지 않는다(대표 결정 2026-10-08). 뒤표지에 판권 한 줄(대표 피드백 2026-10-09).
 * PDF 본문은 다이어리 전체(256쪽 인쇄 지도 중 실제 쪽 250개)를 화면과 같은 모양으로 담는다 — 회원 본인의 한 권을
 *   개인적으로 인쇄·보관하는 용도(약관 제8조 ③). 텍스트 파일은 적은 내용만(빈 질문 수백 개는 읽을 수 없어서).
 * Pure builders (buildModel / toText / printFrame) are also loaded by scripts/test-diary-export.cjs. */
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

  // PDF 한 권의 틀: 앞표지 → p.2 「이 한 권」 정보 → (화면과 같은 모양의 본문 256쪽: 앱이 만들어 넣음) → 뒤표지.
  // 본문은 diary-app.js 가 화면 렌더러 그대로 만든 HTML(pagesHTML)을 받는다. 대표 피드백 2026-10-09:
  //   「기록한 쪽만이 아니라 전 페이지가, 웹 화면 양식과 동일하게」.
  function coverHTML(m) {
    return '<section class="xp-cover"><p class="xp-latin">LIFE PORTFOLIO</p><div class="xp-rule"></div><h1 class="xp-title">인생포트폴리오 맞춤형 다이어리</h1><p class="xp-only">Only One</p>' +
      (m.name ? '<p class="xp-owner"><b>' + esc(m.name) + "</b> 님의 한 권</p>" : "") + "</section>";
  }
  function infoHTML(m) {
    return '<section class="xp-page xp-infopage"><div class="xp-fit"><div class="xp-info"><p class="xp-info-k">이 한 권</p><dl class="xp-meta">' + (m.start ? "<div><dt>시작한 날</dt><dd>" + esc(ymdKo(m.start)) + "</dd></div>" : "") + "<div><dt>내려받은 날</dt><dd>" + esc(ymdKo(m.today)) + "</dd></div>" +
      "<div><dt>담긴 기록</dt><dd>직접 쓰신 쪽 " + m.pagesWritten + "쪽 · 해 본 일 " + m.logCount + "개</dd></div></dl></div>" +
      '<footer class="pg-foot"><span></span><span>p. 2</span></footer></div></section>';
  }
  function backHTML(m) {
    return '<section class="xp-back"><div class="xp-back-in"><p class="xp-latin">LIFE PORTFOLIO</p><div class="xp-rule"></div><p class="xp-only">Only One</p></div><p class="xp-colophon">' + esc(colophon(m)) + "</p></section>";
  }
  function printFrame(m, pagesHTML) { return coverHTML(m) + infoHTML(m) + (pagesHTML || "") + backHTML(m); }
  // 「지금 보는 쪽만」: 표지·뒤표지 없이 그 쪽만. 쪽 아래에 누구의 기록인지 한 줄 남긴다.
  function pageFrame(m, pagesHTML) {
    return (pagesHTML || "") + '<p class="xp-only-mark">인생포트폴리오 맞춤형 다이어리' + (m.name ? " · " + esc(m.name) + "님의 기록" : "") + " · " + esc(m.today.replace(/-/g, ".")) + " 내려받음</p>";
  }

  var PRINT_CSS =
    "#dy-print{display:none}" +
    /* 화면에서는 안 보이는 곳에 A4 본문 폭으로 펼쳐 각 쪽의 높이를 잰다(쪽 맞춤). */
    "#dy-print{color:#222;font-family:var(--sans,'Apple SD Gothic Neo','Malgun Gothic',sans-serif);word-break:keep-all;overflow-wrap:break-word;-webkit-print-color-adjust:exact;print-color-adjust:exact}" +
    "#dy-print.xp-measure{display:block;position:absolute;left:-99999px;top:0;width:180mm;visibility:hidden}" +
    "#dy-print .xp-cover{height:258mm;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;break-after:page;page-break-after:always;border:1.2pt solid #C9A04F;outline:5pt solid #0A3D2A;outline-offset:-9pt;box-sizing:border-box;padding:20mm}" +
    "#dy-print .xp-latin{margin:0;font-family:'Cormorant Garamond',Georgia,serif;letter-spacing:.32em;font-size:13pt;color:#7d5f22}" +
    "#dy-print .xp-rule{width:40mm;height:0;border-top:1pt solid #C9A04F;margin:6mm auto}" +
    "#dy-print .xp-title{margin:0;font-size:24pt;line-height:1.35;color:#0A3D2A;font-weight:700}" +
    "#dy-print .xp-only{margin:3mm 0 0;font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-size:16pt;color:#7d5f22}" +
    "#dy-print .xp-owner{margin:16mm 0 0;font-size:15pt;color:#222}" +
    "#dy-print .xp-infopage .xp-fit{justify-content:center}" +
    "#dy-print .xp-info{margin:auto 0;padding:8mm 10mm;border:.6pt solid #e3dccb;border-radius:2mm;background:#faf7f0}" +
    "#dy-print .xp-info-k{margin:0 0 4mm;font-family:'Cormorant Garamond',Georgia,serif;letter-spacing:.2em;font-size:12pt;color:#7d5f22}" +
    "#dy-print .xp-meta{margin:0;display:grid;gap:1.5mm;font-size:10pt;color:#454545}" +
    "#dy-print .xp-meta div{display:flex;gap:4mm}#dy-print .xp-meta dt{min-width:22mm;color:#7d5f22;font-weight:700}#dy-print .xp-meta dd{margin:0}" +
    "#dy-print .xp-sec{margin:0 0 7mm}" +
    "#dy-print .xp-h{display:flex;align-items:baseline;gap:3mm;border-bottom:1pt solid #C9A04F;padding:0 0 1.5mm;margin:0 0 3mm;break-after:avoid;page-break-after:avoid}" +
    "#dy-print .xp-h h2{margin:0;font-size:13pt;color:#0A3D2A}#dy-print .xp-no,#dy-print .xp-range{font-size:9pt;color:#7d5f22;white-space:nowrap}#dy-print .xp-range{margin-left:auto}" +
    "#dy-print .xp-it{margin:0 0 3mm;break-inside:avoid;page-break-inside:avoid}" +
    "#dy-print .xp-q{margin:0 0 .8mm;font-size:9pt;color:#666;font-weight:700}" +
    "#dy-print .xp-a{margin:0;font-size:11pt;line-height:1.65;white-space:pre-wrap}" +
    "#dy-print .xp-logs{margin:0;padding-left:5mm;font-size:10.5pt;line-height:1.6}#dy-print .xp-logs b{color:#0A3D2A;font-weight:700;margin-right:2mm}#dy-print .xp-kept{display:block;color:#666;font-size:9.5pt}" +
    /* 본문: 화면 렌더러가 만든 쪽을 A4 한 장씩. 입력칸은 줄 친 종이 모양의 글자로 바뀐다(diary-app.js staticize). */
    "#dy-print.xp-only .xp-page:first-child{break-before:auto;page-break-before:auto}#dy-print .xp-only-mark{margin:2mm 0 0;font-size:8pt;color:#8a8a8a;text-align:right}" +
    "#dy-print .xp-page{break-before:page;page-break-before:always;height:257mm;overflow:hidden;box-sizing:border-box;background:#fff}" +
    "#dy-print .xp-page.divider-pg,#dy-print .xp-page.cover{background:#0A3D2A;padding:10mm}" +
    "#dy-print .xp-ruled{font-family:var(--serif);font-size:11.5pt;line-height:8mm;min-height:16mm;white-space:pre-wrap;color:#222;padding:0 .5mm;background-image:linear-gradient(transparent 7.7mm,#e3dccb 7.7mm,#e3dccb 8mm);background-size:100% 8mm}" +
    "#dy-print .xp-ln{min-height:7.5mm;border-bottom:.3mm solid #e3dccb;font-family:var(--serif);font-size:11.5pt;color:#222;padding:1.2mm .5mm 0;white-space:pre-wrap}" +
    "#dy-print .xp-mark{display:inline-block;width:5mm;color:#0A3D2A;font-weight:700}" +
    "#dy-print .pill.on{border-color:#0A3D2A;background:#f1ece0;color:#0A3D2A;font-weight:700}" +
    "#dy-print .fld,#dy-print .seed,#dy-print .card,#dy-print .rank,#dy-print .domain-row,#dy-print .log,#dy-print .day{break-inside:avoid;page-break-inside:avoid}" +
    "#dy-print .cell .tx{display:block;-webkit-line-clamp:none;overflow:visible}" +
    "#dy-print .cell{min-height:16mm}" +
    "#dy-print .q-sec{margin:3mm 0 1.5mm}" +
    "#dy-print .q-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 6mm}#dy-print .q-col .fld{margin:0 0 6px}#dy-print .q-col .xp-ruled{min-height:16mm}" +
    "#dy-print .xp-empty{text-align:center;color:#666}" +
    "#dy-print .xp-back{height:258mm;display:flex;flex-direction:column;justify-content:space-between;align-items:center;text-align:center;break-before:page;page-break-before:always;break-inside:avoid;page-break-inside:avoid;background:#0A3D2A;border:1.2pt solid #C9A04F;outline:5pt solid #0A3D2A;outline-offset:-9pt;box-sizing:border-box;padding:20mm 16mm 14mm}" +
    "#dy-print .xp-back-in{flex:1;display:flex;flex-direction:column;justify-content:center}#dy-print .xp-back .xp-latin,#dy-print .xp-back .xp-only{color:#C9A04F}" +
    "#dy-print .xp-colophon{margin:0;font-size:8.5pt;line-height:1.6;color:rgba(255,253,248,.72)}" +
    "#dy-print .xp-fit{display:flex;flex-direction:column;min-height:255mm}" +
    "#dy-print .xp-fit>.pg{flex:1;overflow:visible!important;padding:0 0 4mm!important}" +
    "#dy-print .xp-fit>.pg-foot{margin-top:auto;padding:3mm 0 0}" +
    "@media print{" +
    "@page{size:A4;margin:16mm 15mm 18mm}" +
    "html,body{background:#fff!important;overflow:visible!important;height:auto!important}" +
    "body.dy-printing>*:not(#dy-print){display:none!important}" +

    "body.dy-printing #dy-print{display:block!important;position:static;visibility:visible;width:auto}" +
    "}";

  // 각 쪽을 A4 한 장에 맞춘다: 화면 모양 그대로 재고, 넘치는 쪽만 비율대로 줄인다(글자·칸 모양 유지).
  var FIT_MM = 255, MIN_ZOOM = 0.55;
  function fitPages(root) {
    var mm = root.getBoundingClientRect().width / 180; if (!mm) return 0;
    var fits = root.querySelectorAll(".xp-fit"), shrunk = 0;
    for (var i = 0; i < fits.length; i++) {
      var f = fits[i]; f.style.zoom = ""; f.style.minHeight = "0";
      var h = f.scrollHeight / mm;
      if (h > FIT_MM) { var z = Math.max(MIN_ZOOM, FIT_MM / h); f.style.zoom = String(z); f.style.minHeight = (FIT_MM / z) + "mm"; shrunk++; }
      else f.style.minHeight = FIT_MM + "mm";
    }
    return shrunk;
  }

  return { buildModel: buildModel, toText: toText, printFrame: printFrame, pageFrame: pageFrame, fitPages: fitPages, fileBase: fileBase, PRINT_CSS: PRINT_CSS };
});
