/* 인생포트폴리오 디지털 다이어리 — screen engine.
 * Needs window.DiarySchema. Booted by diary.html with { call, lang, sid } after sign-in.
 * All storage goes through the owner-only server callable; nothing is written from the browser
 * directly. Customer screens never show internal ids (evidence question ids, axis keys, rules). */
(function () {
  "use strict";
  var S = window.DiarySchema, T = S.TEMPLATES;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var WD = ["일", "월", "화", "수", "목", "금", "토"];

  var st = { call: null, sid: null, seed: null, meta: null, pages: {}, logs: [], reportFound: false };
  var view = { mode: "single", idx: 0 };
  var printing = false; // PDF 본문을 만드는 동안만 true (분기 회고 네 분기를 모두 펼치는 등) // idx into SEQ (single) — spread derives its pair
  var SEQ = [{ key: "cover", tpl: "cover", no: 0 }].concat(S.PAGES.filter(Boolean));
  var POS = {}; SEQ.forEach(function (p, i) { POS[p.key] = i; });
  var SPREADS = (function () { // print pairs (odd = left, even = right); cover alone
    var out = [{ left: null, right: "cover" }];
    for (var n = 1; n <= 255; n += 2) {
      var l = S.PAGES[n], r = S.PAGES[n + 1];
      if (!l && !r) continue;
      out.push({ left: l ? l.key : null, right: r ? r.key : null, lno: n, rno: n + 1 });
    }
    return out;
  })();
  var SPREAD_OF = {}; SPREADS.forEach(function (s, i) { if (s.left) SPREAD_OF[s.left] = i; if (s.right) SPREAD_OF[s.right] = i; });

  // ---------------------------------------------------------------- helpers
  function todayISO() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function wd(iso) { return new Date(iso + "T00:00:00Z").getUTCDay(); }
  function md(iso) { var p = iso.split("-"); return +p[1] + "." + p[2]; }
  function ym(iso) { var p = iso.split("-"); return p[0] + "년 " + (+p[1]) + "월"; }
  function start() { return st.meta && st.meta.startDate; }
  function val(key, f) { var p = st.pages[key]; return p && p.fields ? p.fields[f] : undefined; }
  function seed() { return st.seed || {}; }
  function currentWeek() { if (!start()) return 1; var w = S.weekOf(start(), todayISO()); return Math.min(52, Math.max(1, w || 1)); }
  function weekRange(i) { var a = S.addDays(start(), 7 * (i - 1)); return [a, S.addDays(a, 6)]; }
  function logsIn(a, b) { return st.logs.filter(function (l) { return l.date >= a && l.date <= b; }); }
  function uid6() { var a = new Uint8Array(9); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (x) { return ("0" + x.toString(36)).slice(-2); }).join(""); }
  function pageTitle(p) {
    var t = p.tpl;
    var map = { cover: "표지", title: "속표지", epigraph: "여는 글", intro: "시작하는 날", mission: "사명", vision: "비전", axes_a: "자기이해 · 자기표현", axes_b: "자기설계 · 자기실행", top3: "강점 세 가지", top2: "성장 포인트 두 가지", profile: "실행 프로파일", career: "추천 진로 세 카드", outro: "다이어리가 시작되었어요", annual: "연간 비전", ninety: "90일 마일스톤", guide13: "13영역 핵심 질문", guide13_ans: "13영역 나의 답", usage: "사용 가이드", owner: "소유자" };
    if (map[t]) return map[t];
    if (t === "divider") return p.title;
    if (t === "lifemap_l" || t === "lifemap_r") return "13영역 인생 지도 · " + p.idx + "회차";
    if (t === "year_cal") return p.idx + "년차 달력";
    if (t === "year_pri") return p.idx + "년차 이정표";
    if (t === "milestone") return "분기 마일스톤 · " + p.idx;
    if (t === "month_grid") return monthLabel(p.idx) + " 달력";
    if (t === "month_pri") return monthLabel(p.idx) + " 우선순위";
    if (t === "week_l") return p.idx + "주차 · 계획";
    if (t === "week_r") return p.idx + "주차 · 기록과 회고";
    if (t === "quarterly") return "분기 회고 · " + S.DOMAINS[p.domain].name;
    if (t === "blank_note") return "여백 " + p.idx;
    if (t === "gratitude") return monthLabel(p.idx) + " 감사";
    if (t === "tracker") return "실행 추적 보드 · " + p.idx;
    if (t === "quotes") return "말씀 · 문장 모음 " + p.idx;
    if (t === "daily") return "데일리 저널 " + p.idx;
    if (t === "free") return "자유 메모 " + p.idx;
    return "";
  }
  function monthLabel(i) { return start() ? ym(S.monthStart(start(), i)) : i + "번째 달"; }
  function hasData(key) { var p = st.pages[key]; return !!(p && p.fields && Object.keys(p.fields).length); }

  // ---------------------------------------------------------------- help ("?" toggletips)
  var H = window.DiaryHelp || { PAGE: {}, SPOT: {}, FAQ: [] };
  var tipSeq = 0;
  function tip(kind, key, label) {
    var d = kind === "page" ? H.PAGE[key] : H.SPOT[key]; if (!d) return "";
    var id = "tip-" + (++tipSeq);
    var body = kind === "page"
      ? '<p class="tip-k">왜 쓰나요</p><p>' + esc(d.why) + '</p><p class="tip-k">이렇게 써요</p><p>' + esc(d.how) + "</p>" + (d.ex ? '<p class="tip-ex">' + esc(d.ex) + "</p>" : "")
      : '<p class="tip-k">' + esc(d.title) + "</p><p>" + esc(d.text) + "</p>";
    return '<span class="tip-wrap"><button type="button" class="tip-btn" aria-expanded="false" aria-controls="' + id + '" aria-label="' + esc(label || (kind === "page" ? "이 쪽 도움말" : d.title)) + '">?</button>' +
      '<span class="tip-pop" id="' + id + '" role="note" hidden>' + body + (kind === "page" ? '<a class="tip-more" href="/diary-guide.html#' + esc(key) + '" target="_blank" rel="noopener">해설서에서 자세히 보기 ↗</a>' : "") + "</span></span>";
  }
  var openTip = null, hoverT = null;
  // The popup is positioned against the viewport (position:fixed) from the button's rect, so the
  // page's scroll box (overflow:auto) can never clip it. Flips left/up to stay on screen.
  function placeTip(btn, pop) {
    var phone = window.innerWidth < 700, vw = document.documentElement.clientWidth, vh = window.innerHeight, m = 12;
    var foot = document.querySelector(".dy-foot"), bottomLimit = foot ? foot.getBoundingClientRect().top - 8 : vh - m;
    var topLimit = (document.querySelector(".dy-bar") || { getBoundingClientRect: function () { return { bottom: 0 }; } }).getBoundingClientRect().bottom + 8;
    pop.classList.remove("up", "left");
    pop.style.cssText = "";
    if (phone) { pop.classList.add("sheet-tip"); pop.style.maxHeight = Math.max(160, bottomLimit - topLimit) + "px"; pop.style.bottom = (vh - bottomLimit) + "px"; return; }
    pop.classList.remove("sheet-tip");
    var b = btn.getBoundingClientRect(), w = Math.min(320, vw - 2 * m);
    pop.style.width = w + "px";
    var left = Math.min(Math.max(m, b.left + b.width / 2 - 26), vw - w - m);
    var arrow = Math.min(Math.max(14, b.left + b.width / 2 - left - 6), w - 26);
    pop.style.left = left + "px"; pop.style.setProperty("--arrow", arrow + "px");
    var h = pop.offsetHeight, below = bottomLimit - b.bottom - 10, above = b.top - topLimit - 10;
    var room = Math.max(140, bottomLimit - topLimit), top, mh;
    if (h <= below || below >= above) { top = b.bottom + 10; mh = Math.max(140, below); }
    else { pop.classList.add("up"); mh = Math.max(140, above); top = b.top - 10 - Math.min(h, above); }
    mh = Math.min(mh, room);
    // never leave the visible band between the top bar and the page footer
    top = Math.max(topLimit, Math.min(top, bottomLimit - Math.min(h, mh)));
    pop.style.top = top + "px"; pop.style.maxHeight = mh + "px";
  }
  // A "?" reached by keyboard (Tab) can sit below the visible part of its scrolling page:
  // bring it into view first so the popup opens next to it, never off screen.
  function revealBtn(btn) {
    var br = btn.getBoundingClientRect(), pg = btn.closest(".pg"), pr = pg ? pg.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
    var foot = document.querySelector(".dy-foot"), bar = document.querySelector(".dy-bar");
    var lo = Math.max(pr.top, bar ? bar.getBoundingClientRect().bottom : 0), hi = Math.min(pr.bottom, foot ? foot.getBoundingClientRect().top : window.innerHeight);
    if (br.top < lo || br.bottom > hi) btn.scrollIntoView({ block: "center", inline: "nearest" });
  }
  function showTip(btn, pinned) {
    if (openTip && openTip !== btn) hideTip(openTip);
    var pop = document.getElementById(btn.getAttribute("aria-controls")); if (!pop) return;
    revealBtn(btn);
    pop.hidden = false; btn.setAttribute("aria-expanded", "true"); btn.dataset.pinned = pinned ? "1" : "";
    placeTip(btn, pop);
    openTip = btn;
  }
  function hideTip(btn) { var pop = btn && document.getElementById(btn.getAttribute("aria-controls")); if (pop) pop.hidden = true; if (btn) { btn.setAttribute("aria-expanded", "false"); btn.dataset.pinned = ""; } if (openTip === btn) openTip = null; }

  // ---------------------------------------------------------------- field renderers
  function fieldHTML(pk, f, opts) {
    opts = opts || {};
    var v = val(pk, f.key), id = "f-" + pk + "-" + f.key, label = opts.label || f.label, hint = opts.hint != null ? opts.hint : f.hint;
    var common = ' id="' + id + '" data-page="' + pk + '" data-field="' + f.key + '"';
    var h = '<div class="fld">';
    var labelHTML = '<label class="fld-q" for="' + id + '">' + esc(label) + "</label>" + (hint ? '<span class="fld-h" id="' + id + '-h">' + esc(hint) + "</span>" : "");
    var desc = hint ? ' aria-describedby="' + id + '-h"' : "";
    var ph = opts.placeholder ? ' placeholder="' + esc(opts.placeholder) + '"' : "";
    switch (f.type) {
      case "text": h += labelHTML + '<input class="ln" type="text" maxlength="300" autocomplete="off"' + common + desc + ph + ' value="' + esc(v || "") + '">'; break;
      case "long": h += labelHTML + '<textarea class="ruled" rows="2" maxlength="2000"' + common + desc + ph + ">" + esc(v || "") + "</textarea>"; break;
      case "date": h += labelHTML + '<input class="ln" type="date"' + common + desc + ' value="' + esc(v || "") + '">'; break;
      case "year": h += labelHTML + '<input class="ln" type="number" inputmode="numeric" min="1900" max="2200" placeholder="예) 2031"' + common + desc + ' value="' + esc(v || "") + '">'; break;
      case "score":
        h += labelHTML + '<select class="ln"' + common + desc + '><option value="">–</option>';
        for (var i = 1; i <= 10; i++) h += '<option value="' + i + '"' + (v === i ? " selected" : "") + ">" + i + "점</option>";
        h += "</select>"; break;
      case "check": h += '<label class="check"><input type="checkbox"' + common + (v ? " checked" : "") + "> " + esc(label) + "</label>"; break;
      case "choice": case "multi":
        h += '<fieldset style="border:0;margin:0;padding:0"' + desc + '><legend class="fld-q">' + esc(label) + "</legend>" + (hint ? '<span class="fld-h" id="' + id + '-h">' + esc(hint) + "</span>" : "") + '<div class="pills">';
        f.options.forEach(function (o, j) {
          var on = f.type === "choice" ? v === o : Array.isArray(v) && v.indexOf(o) >= 0;
          var tipLine = f.key === "dirs" && S.ASSET_CHANGES ? (S.ASSET_CHANGES.filter(function (c) { return c.name === o; })[0] || {}).line : "";
          h += '<label class="pill"' + (tipLine ? ' title="' + esc(tipLine) + '"' : "") + '><input type="' + (f.type === "choice" ? "radio" : "checkbox") + '" name="' + id + '" value="' + esc(o) + '" data-page="' + pk + '" data-field="' + f.key + '" data-kind="' + f.type + '"' + (on ? " checked" : "") + "><span>" + esc(o) + (tipLine ? ' <small class="pill-line">' + esc(tipLine) + "</small>" : "") + "</span></label>";
        });
        // Values saved before 2026-10-09 (old six directions) stay visible and checked; they can be unchecked but not newly picked.
        if (f.type === "multi" && f.legacyOptions && Array.isArray(v)) {
          v.filter(function (x) { return f.legacyOptions.indexOf(x) >= 0; }).forEach(function (o) {
            var to = (S.LEGACY_DIRECTIONS && S.LEGACY_DIRECTIONS[o]) || [];
            h += '<label class="pill pill-legacy"><input type="checkbox" name="' + id + '" value="' + esc(o) + '" data-page="' + pk + '" data-field="' + f.key + '" data-kind="multi" checked><span>' + esc(o) +
              ' <small class="pill-line">이전에 고른 방향' + (to.length ? " · 지금 이름: " + esc(to.join("·")) : "") + "</small></span></label>";
          });
        }
        h += "</div></fieldset>"; break;
    }
    return h + "</div>";
  }
  function fld(pk, key, opts) { var f = T[S.BY_KEY[pk].tpl].fields.filter(function (x) { return x.key === key; })[0]; return fieldHTML(pk, f, opts); }
  function seedCard(k, text, extra) {
    if (!text) return "";
    return '<div class="seed"><p class="seed-k">' + esc(k) + '</p><p class="seed-t">' + esc(text) + "</p>" + (extra || "") + "</div>";
  }
  function copyBtn(pk, field, text, label) {
    if (!text) return "";
    return '<span class="btn-row"><button type="button" class="copy-btn" data-copy-page="' + pk + '" data-copy-field="' + field + '" data-copy-text="' + esc(text) + '">' + esc(label || "내 칸에 옮겨 적기") + "</button>" + tip("spot", "copy") + "</span>";
  }
  function svcCard(key) {
    var s = S.SERVICES[key]; if (!s) return "";
    if (s.available) return '<aside class="svc svc-on" aria-label="이용 가능 서비스 ' + esc(s.name) + '"><div class="svc-top"><span class="badge on">이용 가능</span><span class="svc-n">' + esc(s.name) + '</span></div><p class="svc-l">' + esc(s.line) + '</p>' +
      (st.reportFound && st.sid ? '<button type="button" class="btn gold svc-go" data-path>내 변화 찾기</button>' : '<p class="svc-note">마이페이지의 리포트 카드에서 「📔 나의 다이어리」로 들어오면 내 리포트 응답으로 찾아 드려요.</p>') + "</aside>";
    return '<aside class="svc" aria-label="출시 준비중 서비스 ' + esc(s.name) + '"><div class="svc-top"><span class="badge">출시 준비중</span><span class="svc-n">' + esc(s.name) + '</span>' + tip("spot", "service") + '</div><p class="svc-l">' + esc(s.line) + '</p><p class="svc-note">' + esc(S.COMING_NOTE) + "</p></aside>";
  }
  function noReport() { return st.reportFound ? "" : '<p class="notice">리포트와 연결되지 않았어요. 마이페이지의 리포트 카드에서 「📔 나의 다이어리」로 들어오면 리포트 내용이 미리 채워져요.</p>'; }
  var curTpl = null;
  function head(kicker, title, sub) { return '<p class="pg-kicker">' + esc(kicker) + '</p><div class="pg-hrow"><h2 class="pg-h" tabindex="-1">' + title + "</h2>" + tip("page", curTpl) + "</div>" + (sub ? '<p class="pg-sub">' + esc(sub) + "</p>" : ""); }
  function src(t) { return '<p class="src">출처 · ' + esc(t) + "</p>"; }
  function stageChips(stage, withTip) {
    return '<div class="stages" aria-label="근거 단계 ' + stage + '">' + (withTip ? tip("spot", "stages") : "") + S.STAGES.map(function (s) {
      return '<span class="st' + (s.n <= stage ? " on" : "") + (s.n >= 2 ? " lock" : "") + '" title="' + esc(s.hint) + '">' + s.n + " " + esc(s.label) + "</span>";
    }).join("") + "</div>";
  }
  function logItem(l) {
    return '<li class="log"><span class="log-d">' + esc(md(l.date)) + " (" + WD[wd(l.date)] + ')</span><p class="log-t">' + esc(l.text) + "</p>" + (l.kept ? '<p class="log-k">남긴 것 · ' + esc(l.kept) + "</p>" : "") + stageChips(l.stage) +
      '<div class="log-a">' + (l.kept ? "" : '<button type="button" class="mini-btn" data-keep="' + esc(l.id) + '">남긴 것 적기</button>') + '<button type="button" class="mini-btn danger" data-del-log="' + esc(l.id) + '">지우기</button></div></li>';
  }

  // ---------------------------------------------------------------- page bodies
  var R = {};
  R.cover = function () {
    var name = seed().name, started = !!start();
    return '<div class="pg pg-center"><p class="cv-latin">LIFE PORTFOLIO</p><div class="rule-g"></div><h1 class="cv-ko pg-h" tabindex="-1">인생포트폴리오 맞춤형 다이어리</h1><p class="cv-only">Only One</p>' +
      (name ? '<p class="cv-owner"><b>' + esc(name) + "</b> 님의 한 권</p>" : "") +
      '<div class="cv-actions">' + (started
        ? '<button type="button" class="btn gold" data-go-week>이번 주 펼치기 · ' + currentWeek() + "주차</button>" + '<button type="button" class="btn ghost" data-go="intro">처음부터 보기</button>'
        : '<button type="button" class="btn gold" data-start>다이어리 시작하기</button><button type="button" class="btn ghost" data-go="intro">먼저 둘러보기</button>') +
      '</div><p class="cv-note">' + (started ? '<span class="mu">시작한 날 · ' + esc(start().replace(/-/g, ".")) + '</span><br><span class="mu">날짜가 정해져 있지 않은</span> <span class="mu">만년형이에요.</span>' : '<span class="mu">리포트를 받은 날,</span> <span class="mu">지금 이 순간이</span> <span class="mu">출발일이에요.</span><br><span class="mu">1월이 아니어도 괜찮아요.</span>') + "</p>" +
      '<p class="cv-rights"><span class="mu">양식 © 파이스 · 인생포트폴리오</span><br><span class="mu">직접 쓰신 글은 회원님의 것이에요</span></p></div>';
  };
  R.title = function () {
    return '<div class="pg pg-center title-pg"><p class="cv-latin">LIFE PORTFOLIO</p><div class="rule-g"></div><h2 class="cv-ko pg-h" tabindex="-1">인생포트폴리오 맞춤형 다이어리</h2><p class="cv-only" style="color:var(--gold-2)">Only One · Undated</p>' +
      '<p class="verse">“내가 너에게 명한 것이 아니냐 마음을 강하게 하고 담대히 하라”</p><p class="verse-by">여호수아 1:9</p></div>';
  };
  R.epigraph = function () { return '<div class="pg pg-center"><p class="epi pg-h" tabindex="-1">당신의 1년을<br>당신만의 방식으로<br>기록합니다.</p><p class="epi-only">Only One</p></div>'; };
  R.divider = function (p) { return '<div class="pg pg-center"><p class="part">' + esc(p.part) + '</p><h2 class="pg-h" tabindex="-1">' + esc(p.title) + '</h2><div class="rule-g"></div><p>' + esc(p.sub) + "</p></div>"; };
  R.intro = function (p) {
    var k = p.key;
    return '<div class="pg">' + head("PART 0 · INTRO", "나의 인생포트폴리오 1년이 <em>시작되는 날</em>", "이 다이어리는 만년형이에요. 신년이 아니라 내가 시작한 날부터 1년을 기록합니다.") +
      (start() ? '<span class="pg-range">시작한 날 · ' + esc(start().replace(/-/g, ".")) + " (" + WD[wd(start())] + ")</span> " : "") +
      '<button type="button" class="mini-btn" data-start>' + (start() ? "시작한 날 바꾸기" : "시작한 날 정하기") + "</button>" +
      '<div class="cards" style="margin-top:14px"><div class="card"><p class="card-k">다음 아홉 쪽</p><p class="card-t">사명 · 비전 → 네 가지 축(자기이해 · 자기표현 · 자기설계 · 자기실행) → 강점 셋 · 성장 포인트 둘 → 실행 프로파일 → 추천 진로</p><p class="card-s">' + (st.reportFound ? "리포트 내용이 각 쪽 위에 미리 놓여 있어요. 읽고, 내 말로 다시 써 보세요." : "리포트를 연결하면 각 쪽 위에 리포트 내용이 미리 놓여요.") + "</p></div></div>" +
      noReport() + fld(k, "hope") + '<p class="quote">“받은 것을 글로 옮길 때,<br>그것은 정보에서 자기 것이 된다.”</p></div>';
  };
  R.mission = function (p) { var s = seed().mission;
    return '<div class="pg">' + head("PART 0 · 01", "사명 <em>Mission</em>", "사명은 “왜 사는가”에 대한 나의 문장이에요.") + noReport() + seedCard("리포트의 사명", s, copyBtn(p.key, "core", s)) + fld(p.key, "core") + fld(p.key, "word") + fld(p.key, "feel") + "</div>"; };
  R.vision = function (p) { var s = seed().vision;
    return '<div class="pg">' + head("PART 0 · 02", "비전 <em>Vision</em>", "비전은 사명이 그려 내는 미래의 풍경이에요.") + seedCard("리포트의 비전", s, copyBtn(p.key, "core", s)) + fld(p.key, "core") + fld(p.key, "scene") + fld(p.key, "year") + "</div>"; };
  function axisBlock(pk, i) {
    var a = (seed().axes || [])[i] || { name: S.AXES[i].name }, f = S.AXES[i].key;
    var pct = a.pct != null ? a.pct : null;
    return '<section class="axis" aria-label="' + esc(a.name) + '"><div class="axis-head"><span class="axis-name">' + esc(a.name) + "</span>" + (pct != null ? '<span class="axis-pct">' + pct + "%" + tip("spot", "pct") + "</span>" : "") + "</div>" +
      (a.question ? '<span class="axis-q">' + esc(a.question) + "</span>" : "") + (pct != null ? '<div class="bar" role="img" aria-label="응답 강도 ' + pct + '퍼센트"><i style="width:' + pct + '%"></i></div>' : "") +
      (a.core ? seedCard("리포트가 읽은 나", a.core, a.keywords && a.keywords.length ? '<div class="seed-row">' + a.keywords.map(function (k) { return '<span class="chip">' + esc(k) + "</span>"; }).join("") + "</div>" : "") : "") +
      fld(pk, f, { label: esc(a.name) + " — 나의 세 줄 자평", hint: a.reflection ? "돌아볼 질문 · " + a.reflection : null }) + "</section>";
  }
  R.axes_a = function (p) { return '<div class="pg">' + head("PART 0 · 03", "네 가지 축 <em>1 / 2</em>", "알아차리고(자기이해) 전하는(자기표현) 두 축이에요. 퍼센트는 응답의 강도일 뿐, 사람의 가치나 능력의 점수가 아니에요.") + axisBlock(p.key, 0) + axisBlock(p.key, 1) + "</div>"; };
  R.axes_b = function (p) { return '<div class="pg">' + head("PART 0 · 03", "네 가지 축 <em>2 / 2</em>", "계획하고(자기설계) 해내는(자기실행) 두 축이에요.") + axisBlock(p.key, 2) + axisBlock(p.key, 3) + fld(p.key, "gap") + "</div>"; };
  R.top3 = function (p) { var s = seed().strengths || [];
    return '<div class="pg">' + head("PART 0 · 04", "강점 세 가지", "강점은 이미 잘하는 것이라기보다, 쓸수록 힘이 나며 자라는 자리예요.") +
      [0, 1, 2].map(function (i) { return '<div class="rank"><b>' + (i + 1) + "</b><div>" + (s[i] ? '<p class="rank-t">' + esc(s[i]) + "</p>" : "") + fld(p.key, "s" + (i + 1), { label: "이 강점을 가장 잘 쓴 순간 하나" }) + "</div></div>"; }).join("") + fld(p.key, "bundle") + "</div>"; };
  R.top2 = function (p) { var g = seed().growth || [];
    return '<div class="pg">' + head("PART 0 · 05", "성장 포인트 두 가지", "고쳐야 할 결점이 아니라, 강점이 더 멀리 가도록 받쳐 줄 다음 한 점이에요. 각각 ‘만약 ~하면, 그러면 ~한다’ 한 줄을 만들어 보세요.") +
      [0, 1].map(function (i) { var n = i + 1; return '<div class="rank"><b>' + n + "</b><div>" + (g[i] ? '<p class="rank-t">' + esc(g[i]) + "</p>" : "") + fld(p.key, "g" + n + "_if", { label: "만약 이런 상황이 오면" }) + fld(p.key, "g" + n + "_then", { label: "그러면 나는" }) + "</div></div>"; }).join("") +
      src("Gollwitzer, P. M., & Sheeran, P. (2006). Implementation intentions and goal achievement: A meta-analysis of effects and processes. Advances in Experimental Social Psychology, 38, 69–119.") + "</div>"; };
  R.profile = function (p) {
    var L = { type: "유형", style: "스타일", drivers: "추진력", environment: "몰입 환경", activities: "활동", tools: "도구" };
    var pr = seed().profile || [];
    return '<div class="pg">' + head("PART 0 · 06", "실행 프로파일", "어떻게 일할 때 가장 나다운지 알려 주는 여섯 좌표예요. 다이어리를 쓰는 내내 기준선이 됩니다.") +
      (pr.length ? '<div class="prof">' + pr.filter(function (x) { return x.text; }).map(function (x) { return '<div class="card"><p class="card-k">' + esc(L[x.key]) + '</p><p class="card-t">' + esc(x.text) + "</p></div>"; }).join("") + "</div>" : noReport()) +
      fld(p.key, "surprise") + fld(p.key, "env") + "</div>"; };
  R.career = function (p) { var s = seed(), c = s.careers || [], e = s.education || [], d = s.directions || [];
    return '<div class="pg">' + head("PART 0 · 07", "추천 진로 세 카드", "지금 당장 옮길 직업이 아니라, 사명·비전·강점을 합쳐 만든 가능성의 지도예요.") +
      (c.length ? '<div class="cards c3">' + [0, 1, 2].map(function (i) { return '<div class="card"><p class="card-k">Card ' + (i + 1) + '</p><p class="card-t">' + esc(c[i] || "") + "</p>" + (e[i] ? '<p class="card-s">배움 · ' + esc(e[i]) + "</p>" : "") + (d[i] ? '<p class="card-s">방향 · ' + esc(d[i]) + "</p>" : "") + "</div>"; }).join("") + "</div>" : noReport()) +
      (s.careerNote ? '<p class="pg-sub">' + esc(s.careerNote) + "</p>" : "") + fld(p.key, "closest") + fld(p.key, "dirs") + svcCard("routes") + fld(p.key, "oneyear") + "</div>"; };
  R.outro = function (p) { return '<div class="pg">' + head("PART 0 · OUTRO", "내 다이어리가 시작되었어요", "리포트가 내 문장으로 옮겨진, 세상에 하나뿐인 한 권이 되었어요. 이제부터 1년이에요.") + fld(p.key, "feel") +
    '<p class="quote">“다이어리는 비어 있을 때 가장 무겁고,<br>채워질 때 가장 가볍다.”</p>' + (start() ? '<button type="button" class="btn brg" data-go-week style="width:100%">이번 주 펼치기 · ' + currentWeek() + "주차</button>" : "") + "</div>"; };
  R.lifemap_l = function (p) {
    return '<div class="pg">' + head("PART 1 · LIFE MAP · " + p.idx + " / 6", "13영역 인생 지도", "인생은 한 가지 직업이나 역할로 줄어들지 않아요. 열세 영역의 균형을 점수로 살펴보고, 가장 약한 영역에 한 줄을 남겨 보세요.") +
      '<div class="card" style="margin:0 0 12px"><p class="card-k">점수 가이드' + tip("spot", "score") + '</p><p class="card-t" style="font-size:13.5px">1~3 거의 비어 있음 · 4~6 보통 · 7~9 충실 · 10 만족</p><p class="card-s">여섯 번까지 다시 점검할 수 있어요. 점수가 바뀌어 가는 것 자체가 나의 기록이에요.</p></div>' +
      fld(p.key, "top") + fld(p.key, "focus") + "</div>";
  };
  R.lifemap_r = function (p) {
    var prevKey = p.idx > 1 ? "lifemap-" + (p.idx - 1) + "-r" : null;
    var rows = S.DOMAINS.map(function (d, i) {
      var n = i + 1, pv = prevKey ? val(prevKey, "d" + n) : null;
      return '<div class="domain-row"><span class="no">' + n + '</span><label class="nm" for="f-' + p.key + "-d" + n + '">' + esc(d.name) + (pv ? ' <small style="color:var(--ink-3);font-weight:400">지난번 ' + pv + "점</small>" : "") + '</label><select class="ln" id="f-' + p.key + "-d" + n + '" data-page="' + p.key + '" data-field="d' + n + '"><option value="">–</option>' +
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (x) { return '<option value="' + x + '"' + (val(p.key, "d" + n) === x ? " selected" : "") + ">" + x + "</option>"; }).join("") + '</select><div class="memo"><label class="sr-only" for="f-' + p.key + "-d" + n + 'n">' + esc(d.name) + ' 한 줄 메모</label><input class="ln" type="text" maxlength="300" placeholder="한 줄 메모" id="f-' + p.key + "-d" + n + 'n" data-page="' + p.key + '" data-field="d' + n + 'n" value="' + esc(val(p.key, "d" + n + "n") || "") + '"></div></div>';
    }).join("");
    return '<div class="pg">' + head("PART 1 · DOMAIN SCORE · " + p.idx + " / 6", "13영역 점수표", "") + rows + '<div class="avg" data-avg="' + p.key + '"><span>평균 점수</span><b>' + avg(p.key) + "</b></div></div>";
  };
  function avg(pk) { var a = []; for (var i = 1; i <= 13; i++) { var x = val(pk, "d" + i); if (x) a.push(x); } return a.length ? (a.reduce(function (s, x) { return s + x; }, 0) / a.length).toFixed(1) + " / 10" : "— / 10"; }
  function miniMonth(firstISO) {
    var y = +firstISO.slice(0, 4), m = +firstISO.slice(5, 7), days = new Date(Date.UTC(y, m, 0)).getUTCDate(), off = (wd(firstISO) + 6) % 7, h = "";
    for (var i = 0; i < off; i++) h += "<span></span>";
    for (var d = 1; d <= days; d++) { var w = (off + d - 1) % 7; h += '<span class="d' + (w === 5 ? " sat" : w === 6 ? " sun" : "") + '">' + d + "</span>"; }
    return '<div class="mini"><h4>' + y + "." + m + '</h4><div class="cal">' + h + "</div></div>";
  }
  R.year_cal = function (p) {
    var body;
    if (start()) { body = '<div class="mini-year">'; for (var i = 1; i <= 12; i++) body += miniMonth(S.monthStart(start(), (p.idx - 1) * 12 + i)); body += "</div>"; }
    else body = '<div class="empty">시작한 날을 정하면 그 달부터 열두 달 달력이 펼쳐져요.<br><button type="button" class="copy-btn" data-start>시작한 날 정하기</button></div>';
    return '<div class="pg">' + head("YEARLY · " + p.idx + "년차", (p.idx === 1 ? "시작한 해" : "다음 해") + " 달력", "") + body + "</div>";
  };
  R.year_pri = function (p) {
    return '<div class="pg">' + head("YEARLY · PRIORITY", p.idx + "년차 이정표", "생일 · 기념일 · 중요한 이정표를 달마다 적어 두세요.") +
      T.year_pri.fields.map(function (f, i) { return fieldHTML(p.key, f, { label: start() ? ym(S.monthStart(start(), (p.idx - 1) * 12 + i + 1)) : (i + 1) + "번째 달" }); }).join("") + "</div>";
  };
  R.annual = function (p) { var pr = seed().program || {};
    return '<div class="pg">' + head("PART 2 · ANNUAL VISION", "연간 비전", "1년의 종착지를 먼저 그려 봅니다.") +
      seedCard("리포트의 비전", seed().vision) + seedCard("실행 프로그램 · 1년 뒤의 모습", pr.year1) + seedCard("실행 프로그램 · 분기 테마", pr.theme) + fld(p.key, "word") + fld(p.key, "dec31") + "</div>"; };
  R.ninety = function (p) { var g = (seed().program || {}).month3 || [];
    return '<div class="pg">' + head("PART 2 · 90 DAYS", "90일 마일스톤", "1년을 네 분기로 나누고, 분기 끝에 손에 남길 결과 하나씩을 적어요. 열두 달은 멀어도 90일은 손에 잡혀요.") +
      (g.length ? '<div class="seed"><p class="seed-k">실행 프로그램이 제안한 3개월 목표</p><ul style="margin:4px 0 0;padding-left:18px;font-size:14px;line-height:1.6">' + g.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></div>" : "") +
      fld(p.key, "q1") + fld(p.key, "q2") + fld(p.key, "q3") + fld(p.key, "q4") + svcCard("practice") + "</div>"; };
  R.milestone = function (p) { return '<div class="pg">' + head("PART 2 · " + p.idx + " / 7", "연간 비전 · 분기 마일스톤", "해마다, 또는 계획이 바뀔 때마다 새로 적을 수 있어요.") + T.milestone.fields.map(function (f) { return fieldHTML(p.key, f); }).join("") + "</div>"; };
  R.month_grid = function (p) {
    var first = start() ? S.monthStart(start(), p.idx) : null, h = '<div class="cal" role="grid" aria-label="' + esc(monthLabel(p.idx)) + ' 달력">';
    ["월", "화", "수", "목", "금", "토", "일"].forEach(function (d, i) { h += '<span class="wd' + (i === 5 ? " sat" : i === 6 ? " sun" : "") + '" role="columnheader">' + d + "</span>"; });
    var days = 31, off = 0, today = todayISO();
    if (first) { var y = +first.slice(0, 4), m = +first.slice(5, 7); days = new Date(Date.UTC(y, m, 0)).getUTCDate(); off = (wd(first) + 6) % 7; }
    for (var i = 0; i < off; i++) h += '<span class="cell blank" aria-hidden="true"></span>';
    for (var d = 1; d <= days; d++) {
      var w = (off + d - 1) % 7, iso = first ? first.slice(0, 8) + String(d).padStart(2, "0") : null, t = val(p.key, "c" + d) || "";
      h += '<button type="button" class="cell' + (w === 5 ? " sat" : w === 6 ? " sun" : "") + (iso === today ? " today" : "") + '" data-cell="' + p.key + '" data-day="' + d + '" aria-label="' + (iso ? md(iso) + " " + WD[wd(iso)] + "요일" : d + "일") + (t ? " · " + esc(t) : " · 비어 있음") + '"><span class="dn">' + d + '</span><span class="tx">' + esc(t) + "</span></button>";
    }
    h += "</div>";
    return '<div class="pg">' + head("MONTHLY · " + p.idx + " / 12", esc(monthLabel(p.idx)), first ? "날짜를 누르면 그날의 일정·이정표를 적을 수 있어요." : "시작한 날을 정하면 요일이 맞춰져요. 지금은 날짜만 있는 만년형 칸이에요.") + h + "</div>";
  };
  R.month_pri = function (p) {
    return '<div class="pg">' + head("MONTHLY · PRIORITY", esc(monthLabel(p.idx)) + " 우선순위", "A 꼭 할 일 · B 중요한 일 · C 여유 있으면 할 일. 13영역 어디에 쓰는 시간인지도 함께 떠올려 보세요.") +
      ["mission", "a1", "a2", "b1", "b2", "c1"].map(function (k) { return fld(p.key, k); }).join("") + '<p class="sec-k">월말 회고 세 줄</p>' + fld(p.key, "good") + fld(p.key, "learn") + fld(p.key, "next") + svcCard("community") + "</div>";
  };
  function weekAction(i) {
    var pr = seed().program; if (!pr) return null;
    var w = pr.weeks || [];
    if (i <= w.length) return { label: "맞춤 실행 프로그램 · " + i + "주차 활동", title: w[i - 1].title, action: w[i - 1].action, done: w[i - 1].doneWhen };
    if (pr.focus) return { label: "이번 주에도 이어 갈 활동", title: "", action: pr.focus.action, done: pr.focus.doneWhen, artifact: pr.focus.artifact };
    return null;
  }
  R.week_l = function (p) {
    var i = p.idx, wa = weekAction(i), rng = start() ? weekRange(i) : null, prevNext = i > 1 ? val("week-" + (i - 1) + "-r", "next") : null;
    var days = T.week_l.fields.filter(function (f) { return /^day/.test(f.key); }).map(function (f, k) {
      var iso = rng ? S.addDays(rng[0], k) : null, w = iso ? wd(iso) : (k + 1) % 7, cls = w === 6 ? "sat" : w === 0 ? "sun" : "";
      return '<div class="day"><b class="' + cls + '">' + (iso ? WD[w] : S.WEEKDAYS[k]) + "</b>" + fieldHTML(p.key, f, { label: iso ? md(iso) + " (" + WD[w] + ") 일정" : f.label, hint: "" }).replace('class="fld-q"', 'class="fld-q sr-only"') + "</div>";
    }).join("");
    return '<div class="pg">' + head("WEEK " + String(i).padStart(2, "0") + " · LEFT", i + "주차 <em>이번 주</em>", "") + (rng ? '<span class="pg-range">' + md(rng[0]) + " (" + WD[wd(rng[0])] + ") – " + md(rng[1]) + " (" + WD[wd(rng[1])] + ")</span>" : "") +
      (prevNext ? seedCard("지난주에 적은 ‘다음 주’", prevNext) : "") +
      (wa ? seedCard(wa.label, (wa.title ? wa.title + " — " : "") + wa.action, (wa.done ? '<p class="card-s">완료 기준 · ' + esc(wa.done) + "</p>" : "") + copyBtn(p.key, "a", wa.action, "A에 옮겨 적기")) : "") +
      fld(p.key, "mission") + '<p class="sec-k">A · B · C 우선순위</p>' + fld(p.key, "a") + fld(p.key, "b") + fld(p.key, "c") +
      '<p class="sec-k">만약 ~하면, 그러면 ~한다' + tip("spot", "ifthen") + '</p>' + fld(p.key, "if1") + fld(p.key, "if2", { hint: "" }) + fld(p.key, "if3", { hint: "" }) +
      '<p class="sec-k">요일별 일정</p><div class="days">' + days + "</div></div>";
  };
  R.week_r = function (p) {
    var i = p.idx, rng = start() ? weekRange(i) : null, logs = rng ? logsIn(rng[0], rng[1]) : [];
    var logsHTML = rng ? (logs.length ? '<ul class="logs">' + logs.map(logItem).join("") + "</ul>" : '<div class="empty">이번 주에 해 본 일이 아직 없어요.<br>작은 것 하나라도 해 봤다면 한 줄로 남겨 보세요.<br><button type="button" class="copy-btn" data-quick>오늘 해 봤어요</button></div>') : '<div class="empty">시작한 날을 정하면 이 주에 남긴 ‘오늘 해 봤어요’ 기록이 여기에 모여요.</div>';
    return '<div class="pg">' + head("WEEK " + String(i).padStart(2, "0") + " · RIGHT", "해 본 일과 회고", "") +
      '<p class="sec-k">오늘 해 봤어요 · 이번 주 기록 ' + logs.length + "개" + tip("spot", "quick") + "</p>" + logsHTML +
      '<p class="sec-k">이번 주 깊이 기록할 하루</p>' + fld(p.key, "dd_date") + fld(p.key, "dd_event") + fld(p.key, "dd_feel") + fld(p.key, "dd_mean") + fld(p.key, "memo") +
      '<p class="sec-k">이번 주 회고 세 줄</p>' + fld(p.key, "good") + fld(p.key, "learn") + fld(p.key, "next") + svcCard(i % 2 ? "game" : "community") + "</div>";
  };
  function qFields(p, q) { return [1, 2, 3, 4].map(function (n) { return fld(p.key, "q" + q + "_" + n, { label: ["가장 중요했던 사건", "그때의 감정과 생각", "그것이 내게 의미하는 바", "다음 분기의 의도와 행동"][n - 1] }); }).join(""); }
  R.quarterly = function (p) {
    var d = S.DOMAINS[p.domain], q = view.quarter || 1;
    var tabs = '<div class="tabs" role="tablist" aria-label="분기 선택">' + [1, 2, 3, 4].map(function (n) { return '<button type="button" class="tab" role="tab" aria-selected="' + (n === q) + '" data-quarter="' + n + '">' + n + "분기</button>"; }).join("") + "</div>";
    return '<div class="pg">' + head("PART 4 · QUARTERLY REVIEW · " + p.idx + " / 13", esc(d.name) + " · 분기 회고", "사실 → 감정 → 의미 → 의도 순서로, 지난 분기 이 영역에서 일어난 일을 정리해요.") +
      seedCard("이 영역의 핵심 질문", d.q) + (printing ? '<div class="q-grid">' + [1, 2, 3, 4].map(function (qq) { return '<div class="q-col"><p class="sec-k q-sec">' + qq + "분기</p>" + qFields(p, qq) + "</div>"; }).join("") + "</div>" : tabs + qFields(p, q)) +
      (d.service ? svcCard(d.service) : "") + src("Pennebaker, J. W., & Beall, S. K. (1986). Confronting a traumatic event: Toward an understanding of inhibition and disease. Journal of Abnormal Psychology, 95(3), 274–281.") + "</div>";
  };
  R.blank_note = function (p) { return '<div class="pg">' + head("NOTES", "여백 " + p.idx, "") + fld(p.key, "note", { label: "자유롭게", hint: "" }) + "</div>"; };
  R.gratitude = function (p) {
    return '<div class="pg">' + head("PART 5 · GRATITUDE · " + p.idx + " / 12", esc(monthLabel(p.idx)) + "의 감사", "") + fld(p.key, "g1") + fld(p.key, "g2") + fld(p.key, "g3") + fld(p.key, "surprise") + fld(p.key, "next") +
      src("Emmons, R. A., & McCullough, M. E. (2003). Counting blessings versus burdens: An experimental investigation of gratitude and subjective well-being in daily life. Journal of Personality and Social Psychology, 84(2), 377–389.") + "</div>";
  };
  R.tracker = function (p) {
    var rows = "";
    for (var k = 1; k <= 7; k++) {
      var w = (p.idx - 1) * 7 + k; if (w > 52) break;
      var a = val("week-" + w + "-l", "a") || "", n = start() ? logsIn.apply(null, weekRange(w)).length : 0;
      rows += '<tr><td class="wk">W' + String(w).padStart(2, "0") + '</td><td class="a">' + (a ? esc(a) : '<span style="color:var(--ink-3)">' + w + "주차 A가 비어 있어요</span>") + '<br><small style="color:var(--ink-3)">해 본 기록 ' + n + "개</small></td><td>" +
        fieldHTML(p.key, T.tracker.fields[(k - 1) * 2], { label: "마침" }) + "</td><td>" + fieldHTML(p.key, T.tracker.fields[(k - 1) * 2 + 1], { label: "성찰 메모", hint: "" }).replace('class="fld-q"', 'class="fld-q sr-only"') + "</td></tr>";
    }
    var ladder = p.idx === 1 ? '<p class="sec-k">기록이 쌓이는 단계' + tip("spot", "stages") + '</p><ol class="ladder">' + S.STAGES.map(function (s) { return '<li class="' + (s.n <= 1 ? "self" : "") + '"><b>' + s.n + "</b><span>" + esc(s.label) + "<small>" + esc(s.hint) + (s.service ? " · " + esc(S.SERVICES[s.service].name) + " (출시 준비중)" : " · 지금 다이어리에서 남길 수 있어요") + "</small></span></li>"; }).join("") + '</ol><p class="notice">' + esc(S.STAGE_NOTE) + "</p>" : "";
    return '<div class="pg">' + head("PART 6 · TRACKER · " + p.idx + " / 8", "실행 추적 보드", "주차별 A(꼭 할 일)가 주간 쪽에서 자동으로 옮겨 와요. 마쳤는지와 성찰 한 줄만 남기면 돼요.") + ladder +
      '<table class="trk"><thead><tr><th scope="col">주차</th><th scope="col">실행 과제</th><th scope="col">마침</th><th scope="col">성찰 메모</th></tr></thead><tbody>' + rows + "</tbody></table>" + (p.idx === 1 ? svcCard("mentor") + svcCard("review") : "") + "</div>";
  };
  R.quotes = function (p) { var h = ""; for (var i = 1; i <= 5; i++) h += fld(p.key, "t" + i, { label: "마음에 남은 말씀 · 문장", hint: "" }) + fld(p.key, "by" + i, { label: "출처" });
    return '<div class="pg">' + head("PART 7 · APPENDIX ① · " + p.idx + " / 4", "말씀 · 문장 모음", "한 주에 한 구절씩 옮겨 적어 보세요.") + h + "</div>"; };
  R.guide13 = function () {
    return '<div class="pg">' + head("PART 7 · APPENDIX ②", "13영역 핵심 질문", "영역마다 스스로 돌아보고 설계할 때 묻는 질문이에요.") + '<ol class="guide-list">' + S.DOMAINS.map(function (d, i) {
      return "<li><b>" + (i + 1) + '</b><span><span class="dn">' + esc(d.name) + "</span> — " + esc(d.q) + (d.service ? '<br><span class="sv">함께할 수 있는 서비스 · ' + esc(S.SERVICES[d.service].name) + " (출시 준비중)</span>" : "") + "</span></li>"; }).join("") + "</ol></div>";
  };
  R.guide13_ans = function (p) { return '<div class="pg">' + head("PART 7 · APPENDIX ②", "13영역 나의 답", "떠오르는 영역부터 답해도 괜찮아요.") + T.guide13_ans.fields.map(function (f) { return fieldHTML(p.key, f); }).join("") + "</div>"; };
  R.usage = function () {
    return '<div class="pg">' + head("PART 7 · APPENDIX ③", "사용 가이드", "완벽하게 쓰지 않아도 돼요. 매일 쓰지 않아도 돼요. 1년 뒤 다시 펼쳐 보세요.") +
      '<ol class="steps"><li><b>시작 · 30분</b><br>시작한 날을 정하고, PART 0에서 리포트를 내 말로 옮겨 적어요.</li><li><b>매주 · 10분</b><br>표지에서 「이번 주 펼치기」 → A·B·C와 만약~그러면을 적고, 해 본 날은 「오늘 해 봤어요」로 한 줄 남겨요.</li><li><b>매달 · 15분</b><br>월간 우선순위와 월말 회고 세 줄, 이달의 감사를 적어요.</li><li><b>분기 · 30분</b><br>13영역 분기 회고에서 떠오르는 영역부터 네 질문에 답해요.</li><li><b>1년 뒤</b><br>인생 지도 점수의 변화와 쌓인 기록을 돌아보고, 다음 한 권을 준비해요.</li></ol>' +
      '<a class="btn brg" href="/diary-guide.html" target="_blank" rel="noopener" style="width:100%;margin:0 0 12px">해설서 열기 ↗</a><div class="card"><p class="card-k">조작 방법</p><p class="card-s">휴대폰 · 좌우로 밀어 넘겨요. &nbsp;태블릿·PC · 펼친 두 쪽으로 보여요. 키보드 ← → 로 넘기고, Tab으로 칸을 옮겨 다녀요. 아래 가운데를 누르면 목차가 열려요.</p></div>' + svcCard("agents") +
      '<p class="sec-k">이 다이어리가 참고한 연구</p><p class="src" style="border:0;padding:0">Gollwitzer & Sheeran (2006) — 만약~그러면 계획<br>Emmons & McCullough (2003) — 감사 기록<br>Pennebaker & Beall (1986) — 표현적 글쓰기<br>연구 결과는 개인의 효과를 약속하지 않아요.</p></div>';
  };
  R.owner = function (p) {
    return '<div class="pg">' + head("OWNER", "소유자", "") + (seed().name ? seedCard("이 다이어리의 주인", seed().name + " 님") : "") + fld(p.key, "contact") +
      '<p class="notice">이 다이어리는 로그인한 본인만 볼 수 있어요. 리포트와 실행 프로그램은 바뀌지 않고, 디지털 다이어리는 지금 무료로 제공돼요.</p>' +
      '<p class="btn-row" style="margin:0 0 10px"><button type="button" class="mini-btn" data-export>내 다이어리 내려받기</button></p>' + '<button type="button" class="mini-btn danger" data-reset>다이어리 비우기</button></div>';
  };
  R.daily = function (p) { return '<div class="pg">' + head("PART 7 · DAILY JOURNAL · " + p.idx + " / 24", "데일리 저널", "기록하고 싶은 날만 자유롭게 — 매일이 아니라 의미 있는 날만.") + fld(p.key, "date") + fld(p.key, "mood") + fld(p.key, "note") + "</div>"; };
  R.free = function (p) {
    return '<div class="pg">' + head("FREE NOTES · " + p.idx + " / 12", "생각의 여백", "") + fld(p.key, "title") + fld(p.key, "note") +
      (p.idx === 1 ? '<p class="sec-k">내가 일으킬 수 있는 일곱 가지 변화</p><div class="seed-row" style="margin:0 0 10px">' + S.ASSET_CHANGES.map(function (c) { return '<span class="chip" title="' + esc(c.line) + '">' + esc(c.name) + " · " + esc(c.line) + "</span>"; }).join("") + "</div>" + svcCard("archive") + svcCard("collaboration") : "") + "</div>";
  };

  function pageEl(key, side) {
    var el = document.createElement("article");
    el.className = "dy-page" + (side ? " " + side : "");
    if (!key) { el.classList.add("dy-endpaper"); el.setAttribute("aria-hidden", "true"); return el; }
    var p = key === "cover" ? SEQ[0] : S.BY_KEY[key];
    el.dataset.key = key;
    el.setAttribute("aria-label", (p.no ? "p. " + p.no + " · " : "") + pageTitle(p));
    if (p.tpl === "cover") el.classList.add("cover");
    if (p.tpl === "divider") el.classList.add("divider-pg");
    var fields = (T[p.tpl] && T[p.tpl].fields) || [];
    var oneQ = fields.length >= 2 && ["month_grid", "lifemap_r", "tracker", "year_pri"].indexOf(p.tpl) < 0;
    curTpl = p.tpl;
    el.innerHTML = R[p.tpl](p) + (p.no ? '<footer class="pg-foot"><span>' + esc(pageTitle(p)) + "</span>" + (oneQ ? '<span class="btn-row"><button type="button" class="one-q" data-oneq="' + key + '">한 질문씩 쓰기</button>' + tip("spot", "oneq") + "</span>" : "") + "<span>p. " + p.no + "</span></footer>" : "");
    return el;
  }

  // ---------------------------------------------------------------- layout & turning
  var book, stage, live;
  function layout() {
    var w = stage.clientWidth - 28, h = stage.clientHeight - 28;
    var spread = window.innerWidth >= 1000 && w / h >= 1.15;
    view.mode = spread ? "spread" : "single";
    var ratio = 453.5 / 629.3, pw, ph;
    if (spread) { ph = Math.min(h, (w - 30) / 2 / ratio); pw = ph * ratio; }
    else { pw = Math.min(w, 600); ph = h; }
    document.documentElement.style.setProperty("--pw", Math.floor(pw) + "px");
    document.documentElement.style.setProperty("--ph", Math.floor(ph) + "px");
  }
  function currentKeys() {
    if (view.mode === "spread") { var s = SPREADS[SPREAD_OF[SEQ[view.idx].key]]; return [s.left, s.right]; }
    return [SEQ[view.idx].key];
  }
  function render(focus) {
    openTip = null;
    var keys = currentKeys();
    book.className = "dy-book " + view.mode;
    if (openTip) hideTip(openTip);
    book.innerHTML = "";
    if (view.mode === "spread") {
      if (keys[0] === null && keys[1] === "cover") { book.appendChild(pageEl("cover")); book.className = "dy-book single"; }
      else { book.appendChild(pageEl(keys[0], "left")); book.appendChild(pageEl(keys[1], "right")); var g = document.createElement("div"); g.className = "dy-gutter"; book.appendChild(g); }
    } else book.appendChild(pageEl(keys[0]));
    var frac = view.idx / (SEQ.length - 1);
    book.style.setProperty("--edgeL", (2 + frac * 12).toFixed(1) + "px"); book.style.setProperty("--edgeR", (2 + (1 - frac) * 12).toFixed(1) + "px");
    if (H.units) H.units(book);
    $$("textarea.ruled", book).forEach(autosize);
    updateFoot();
    if (focus) { var hd = $(".pg-h", book); if (hd) hd.focus({ preventScroll: true }); }
  }
  function updateFoot() {
    var keys = currentKeys().filter(Boolean), first = keys[0] === "cover" ? SEQ[0] : S.BY_KEY[keys[0]], last = keys[keys.length - 1] === "cover" ? SEQ[0] : S.BY_KEY[keys[keys.length - 1]];
    $("#where-t").textContent = first.no ? pageTitle(first) : "표지";
    $("#where-n").textContent = first.no ? "p. " + first.no + (last !== first && last.no ? "–" + last.no : "") + " / 256" : "Only One";
    $("#nav-prev").disabled = atStart(); $("#nav-next").disabled = atEnd();
    $(".prog").style.width = (100 * view.idx / (SEQ.length - 1)).toFixed(1) + "%";
    live.textContent = (first.no ? "p. " + first.no + " " : "") + pageTitle(first) + (last !== first ? ", " + pageTitle(last) : "");
  }
  function atStart() { return view.idx === 0; }
  function atEnd() { return view.mode === "spread" ? SPREAD_OF[SEQ[view.idx].key] === SPREADS.length - 1 : view.idx === SEQ.length - 1; }
  function idxForStep(dir) {
    if (view.mode === "spread") {
      var s = SPREAD_OF[SEQ[view.idx].key] + dir; if (s < 0 || s >= SPREADS.length) return null;
      var sp = SPREADS[s]; return POS[sp.left || sp.right];
    }
    var n = view.idx + dir; return n < 0 || n >= SEQ.length ? null : n;
  }
  var turning = false;
  function motionOK() { return !document.body.classList.contains("no-motion") && !window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
  function go(newIdx, dirHint) {
    if (newIdx == null || turning) return;
    flushAll();
    var dir = dirHint || (newIdx > view.idx ? 1 : -1);
    var oldPages = $$(".dy-page", book).map(function (p) { var c = p.cloneNode(true); c.removeAttribute("id"); $$("[id]", c).forEach(function (x) { x.removeAttribute("id"); }); c.setAttribute("aria-hidden", "true"); c.inert = true; return c; });
    var oldMode = book.className;
    view.idx = newIdx; view.quarter = 1;
    if (!motionOK() || !oldPages.length) { render(true); return; }
    render(false);
    var newPages = $$(".dy-page", book);
    var layer = document.createElement("div"); layer.className = "turn-layer"; layer.setAttribute("aria-hidden", "true");
    var w = book.getBoundingClientRect().width;
    var isSpread = /spread/.test(oldMode) && /spread/.test(book.className) && oldPages.length === 2 && newPages.length === 2;
    if (isSpread) {
      var half = w / 2;
      var still = oldPages[dir > 0 ? 0 : 1]; still.style.cssText = "position:absolute;top:0;left:" + (dir > 0 ? 0 : half) + "px;width:" + half + "px";
      var leaf = document.createElement("div"); leaf.className = "leaf " + (dir > 0 ? "next" : "prev"); leaf.style.cssText = "left:" + (dir > 0 ? half : 0) + "px;width:" + half + "px";
      var front = oldPages[dir > 0 ? 1 : 0], back = newPages[dir > 0 ? 0 : 1].cloneNode(true);
      $$("[id]", back).forEach(function (x) { x.removeAttribute("id"); });
      [front, back].forEach(function (f, i) { f.classList.add("face"); if (i) f.classList.add("back"); f.style.width = half + "px"; leaf.appendChild(f); });
      layer.appendChild(still); layer.appendChild(leaf);
    } else {
      var lf = document.createElement("div"), cw = Math.min(w, newPages[0].getBoundingClientRect().width || w);
      lf.style.cssText = "left:" + ((w - cw) / 2) + "px;width:" + cw + "px";
      if (dir > 0) { lf.className = "leaf s-out"; oldPages[0].classList.add("face"); oldPages[0].style.width = cw + "px"; lf.appendChild(oldPages[0]); }
      else { var under = oldPages[0]; under.style.cssText = "position:absolute;top:0;left:" + ((w - cw) / 2) + "px;width:" + cw + "px"; layer.appendChild(under);
        var nc = newPages[0].cloneNode(true); $$("[id]", nc).forEach(function (x) { x.removeAttribute("id"); }); nc.classList.add("face"); nc.style.width = cw + "px"; lf.className = "leaf s-in"; lf.appendChild(nc); }
      layer.appendChild(lf);
    }
    book.appendChild(layer); book.classList.add("turning"); turning = true;
    var done = function () { if (!turning) return; turning = false; layer.remove(); book.classList.remove("turning"); var a = document.activeElement, hd = $(".pg-h", book); if (hd && !(openTip || (a && a !== book && book.contains(a)))) hd.focus({ preventScroll: true }); };
    layer.addEventListener("animationend", function (e) { if (e.target.classList.contains("leaf")) done(); });
    setTimeout(done, 1200);
  }
  function goKey(key) { if (POS[key] != null) go(POS[key]); }
  function goWeek() { goKey("week-" + currentWeek() + "-l"); }
  function next() { go(idxForStep(1), 1); }
  function prev() { go(idxForStep(-1), -1); }

  // ---------------------------------------------------------------- saving
  var pending = {}, timers = {}, chains = {}, saveState = { n: 0, err: false };
  function setSave(t, err) { var el = $("#dy-save"); el.textContent = t; el.classList.toggle("err", !!err); }
  function queue(pk, field, value) {
    st.pages[pk] = st.pages[pk] || { fields: {}, rev: 0 };
    if (value === null || value === "" || (Array.isArray(value) && !value.length)) delete st.pages[pk].fields[field]; else st.pages[pk].fields[field] = value;
    pending[pk] = pending[pk] || {}; pending[pk][field] = value === "" || (Array.isArray(value) && !value.length) ? null : value;
    setSave("저장 중…");
    clearTimeout(timers[pk]); timers[pk] = setTimeout(function () { flush(pk); }, 700);
  }
  function flush(pk) {
    clearTimeout(timers[pk]);
    var patch = pending[pk]; if (!patch) return chains[pk] || Promise.resolve();
    delete pending[pk];
    var opId = "op_" + uid6();
    saveState.n++;
    var run = function () {
      return st.call({ action: "savePage", opId: opId, pageKey: pk, patch: patch }).then(function (r) {
        saveState.n--; if (r && r.page) st.pages[pk].rev = r.page.rev; if (!saveState.n && !Object.keys(pending).length) setSave("저장됨");
      }, function (e) {
        saveState.n--; pending[pk] = Object.assign({}, patch, pending[pk] || {});
        setSave("저장하지 못했어요", true); toast((e && e.message) || "저장하지 못했어요. 연결을 확인한 뒤 다시 시도할게요.");
        clearTimeout(timers[pk]); timers[pk] = setTimeout(function () { flush(pk); }, 4000);
      });
    };
    chains[pk] = (chains[pk] || Promise.resolve()).then(run, run);
    return chains[pk];
  }
  function flushAll() { return Promise.all(Object.keys(pending).map(flush)); }
  function readInput(el) {
    var kind = el.dataset.kind;
    if (kind === "multi") { var all = $$('input[name="' + el.name + '"]'); return all.filter(function (x) { return x.checked; }).map(function (x) { return x.value; }); }
    if (kind === "choice") return el.checked ? el.value : null;
    if (el.type === "checkbox") return el.checked;
    if (el.tagName === "SELECT") return el.value ? +el.value : null;
    if (el.type === "number") return el.value ? +el.value : null;
    return el.value;
  }
  function autosize(t) { t.style.height = "auto"; t.style.height = Math.max(66, t.scrollHeight) + "px"; }
  function fieldDef(pk, key) { return T[S.BY_KEY[pk].tpl].fields.filter(function (f) { return f.key === key; })[0]; }
  function onInput(e) {
    var el = e.target, pk = el.dataset && el.dataset.page, key = el.dataset && el.dataset.field; if (!pk || !key) return;
    if (el.tagName === "TEXTAREA") autosize(el);
    if (e.type === "input" && (el.type === "checkbox" || el.type === "radio" || el.tagName === "SELECT")) return;
    var v = readInput(el), f = fieldDef(pk, key);
    if (f.type === "multi" && v.length > (f.max || 99)) { el.checked = false; toast("최대 " + f.max + "개까지 고를 수 있어요."); return; }
    if (f.type === "year" && v != null && !(v >= 1900 && v <= 2200)) return;
    queue(pk, key, v);
    var a = $('[data-avg="' + pk + '"]'); if (a) a.lastElementChild.textContent = avg(pk);
  }

  // ---------------------------------------------------------------- sheets
  function sheet(id) { return document.getElementById(id); }
  function openSheet(d) { if (!d.open) d.showModal(); var h = $("h2", d); if (h) h.focus(); }
  function toast(t) { var el = $("#toast"); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { el.hidden = true; }, 3200); }

  // one question per screen — for any page
  var oq = { pk: null, i: 0, list: [] };
  function openOneQ(pk) {
    var tpl = S.BY_KEY[pk].tpl; oq.pk = pk; oq.i = 0;
    oq.list = T[tpl].fields.filter(function (f) { return f.type !== "check" && !(tpl === "quarterly" && f.key.charAt(1) !== String(view.quarter || 1)); });
    var firstEmpty = oq.list.findIndex(function (f) { return val(pk, f.key) == null; }); oq.i = firstEmpty < 0 ? 0 : firstEmpty;
    renderOneQ(); openSheet(sheet("sh-oneq"));
  }
  function renderOneQ() {
    var f = oq.list[oq.i], d = sheet("sh-oneq"), p = S.BY_KEY[oq.pk];
    $("h2", d).textContent = pageTitle(p);
    var body = $(".sh-body", d), labelOpt = {};
    if (p.tpl === "axes_a" || p.tpl === "axes_b") { var ai = S.AXES.findIndex(function (a) { return a.key === f.key; }); if (ai >= 0) { var a = (seed().axes || [])[ai]; labelOpt.hint = a && a.reflection ? "돌아볼 질문 · " + a.reflection : f.hint; } }
    if (p.tpl === "quarterly") labelOpt.label = S.DOMAINS[p.domain].name + " · " + f.label;
    body.innerHTML = '<p class="sh-step">' + (oq.i + 1) + " / " + oq.list.length + "</p>" + fieldHTML(oq.pk, f, labelOpt).replace(/id="f-/g, 'id="q-').replace(/for="f-/g, 'for="q-').replace(/"f-([^"]+)-h"/g, '"q-$1-h"').replace('class="fld-q"', 'class="fld-q sh-q"');
    if (H.units) H.units(body);
    $$("textarea.ruled", body).forEach(autosize);
    $("#oq-prev").disabled = oq.i === 0; $("#oq-next").textContent = oq.i === oq.list.length - 1 ? "마치기" : "다음";
    var inp = $("input:not([type=radio]):not([type=checkbox]),textarea,select", body) || $("input", body); if (inp) setTimeout(function () { inp.focus(); }, 30);
  }

  // quick record
  var qr = { step: 1, text: "", kept: "", date: null, logId: null };
  function openQuick() {
    if (!start()) { toast("먼저 다이어리를 시작해 주세요."); openStart(); return; }
    qr = { step: 1, text: "", kept: "", date: todayISO(), logId: "log_" + uid6() };
    renderQuick(); openSheet(sheet("sh-quick"));
  }
  function renderQuick() {
    var d = sheet("sh-quick"), body = $(".sh-body", d), w = currentWeek(), a = val("week-" + w + "-l", "a"), wa = weekAction(w);
    var sugg = [a, wa && wa.action].filter(Boolean).filter(function (x, i, arr) { return arr.indexOf(x) === i; }).slice(0, 2);
    if (qr.step === 1) {
      body.innerHTML = '<p class="sh-step">1 / 2</p><label class="sh-q" for="qr-text" style="display:block">오늘 무엇을 해 봤나요?</label><p class="sh-hint">한 줄이면 충분해요. 작게 해 본 것도 소중한 기록이에요.</p>' +
        '<div class="sh-meta"><label for="qr-date">날짜</label><input type="date" id="qr-date" value="' + qr.date + '" max="' + todayISO() + '"></div>' +
        '<textarea class="ruled" id="qr-text" maxlength="300" placeholder="예) 예상 결과를 먼저 적고, 동료와 같이 실행해 봤어요">' + esc(qr.text) + "</textarea>" +
        (sugg.length ? '<p class="fld-h" style="margin-top:8px">이번 주 할 일에서 고르기</p><div class="pills">' + sugg.map(function (s) { return '<button type="button" class="mini-btn" data-sugg="' + esc(s) + '">' + esc(s.length > 46 ? s.slice(0, 46) + "…" : s) + "</button>"; }).join("") + "</div>" : "");
      $("#qr-back").textContent = "닫기"; $("#qr-next").textContent = "다음"; $("#qr-next").hidden = false;
    } else if (qr.step === 2) {
      body.innerHTML = '<p class="sh-step">2 / 2 · 선택</p><label class="sh-q" for="qr-kept" style="display:block">해 보고 남은 것이 있나요?</label><p class="sh-hint">메모 · 자료 · 사진 · 대화처럼 남은 것의 이름만 적어요. 파일은 올리지 않아요. 없으면 건너뛰어도 돼요.</p>' +
        '<input class="ln" type="text" id="qr-kept" maxlength="300" placeholder="예) 예상·실제 비교 메모 한 장" value="' + esc(qr.kept) + '">';
      $("#qr-back").textContent = "이전"; $("#qr-next").textContent = qr.kept ? "저장" : "건너뛰고 저장";
    } else {
      var rng = weekRange(S.weekOf(start(), qr.date) || 1), n = logsIn(rng[0], rng[1]).length;
      body.innerHTML = '<div class="done-mark" aria-hidden="true">✓</div><p class="sh-q" style="text-align:center" tabindex="-1" id="qr-done">기록했어요</p><p class="sh-hint" style="text-align:center">이번 주 기록 ' + n + "개 · " + (qr.kept ? "결과물을 남긴 기록이에요 (1단계)." : "해 본 기록이에요 (0단계).") + "</p>" + stageChips(qr.kept ? 1 : 0) + '<p class="notice">' + esc(S.STAGE_NOTE) + " 2단계부터는 동료·멘토·사용자의 확인이 필요해서, 함께 배우는 소그룹·멘토와의 동행·결과물 검토 서비스가 준비되면 열려요 (출시 준비중).</p>";
      $("#qr-back").textContent = "닫기"; $("#qr-next").textContent = "이번 주 펼치기";
    }
    if (H.units) H.units(body);
    var f = $("textarea,input[type=text]", body) || $("#qr-done", body); if (f) setTimeout(function () { f.focus(); }, 30);
  }
  function quickNext() {
    if (qr.step === 1) {
      qr.text = $("#qr-text").value.trim(); qr.date = $("#qr-date").value || todayISO();
      if (!qr.text) { toast("해 본 일을 한 줄 적어 주세요."); $("#qr-text").focus(); return; }
      if (qr.date > todayISO() || !S.isDate(qr.date)) { toast("오늘이나 지난 날짜를 골라 주세요."); return; }
      qr.step = 2; renderQuick(); return;
    }
    if (qr.step === 2) {
      qr.kept = $("#qr-kept").value.trim();
      var btn = $("#qr-next"); btn.disabled = true;
      st.call({ action: "addLog", logId: qr.logId, log: { date: qr.date, text: qr.text, kept: qr.kept || null } }).then(function (r) {
        btn.disabled = false; st.logs = st.logs.filter(function (l) { return l.id !== r.log.id; }); st.logs.unshift({ id: r.log.id, date: r.log.date, text: r.log.text, kept: r.log.kept || null, stage: r.log.stage });
        st.logs.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
        qr.step = 3; renderQuick(); render(false);
      }, function (e) { btn.disabled = false; toast((e && e.message) || "저장하지 못했어요. 다시 눌러 주세요."); });
      return;
    }
    sheet("sh-quick").close(); var w = S.weekOf(start(), qr.date) || 1; goKey("week-" + Math.min(52, w) + "-r");
  }

  // start date
  function openStart() {
    var d = sheet("sh-start"); $("#start-date").value = start() || todayISO(); $("#start-done").hidden = true; $("#start-form").hidden = false;
    $("#start-save").hidden = false; $("#start-week").hidden = true; $("#start-intro").hidden = true; openSheet(d);
  }
  function saveStart() {
    var v = $("#start-date").value; if (!S.isDate(v)) { toast("날짜를 확인해 주세요."); return; }
    $("#start-save").disabled = true;
    st.call({ action: "start", startDate: v, reportSid: st.sid || (st.meta && st.meta.reportSid) || null }).then(function (r) {
      $("#start-save").disabled = false; st.meta = r.meta; $("#start-form").hidden = true; $("#start-done").hidden = false; $("#start-save").hidden = true; $("#start-week").hidden = false; $("#start-intro").hidden = false;
      $("#start-week").textContent = "이번 주 펼치기 · " + currentWeek() + "주차"; $("#start-done-h").focus(); render(false);
    }, function (e) { $("#start-save").disabled = false; toast((e && e.message) || "저장하지 못했어요."); });
  }

  // table of contents
  function openToc() {
    var d = sheet("sh-toc"), body = $(".sh-body", d), now = SEQ[view.idx].key;
    var link = function (k, label) { var p = S.BY_KEY[k]; return '<li><button type="button" data-go="' + k + '"><span>' + esc(label || pageTitle(p)) + "</span><small>p. " + p.no + "</small></button></li>"; };
    var grid = function (title, n, kf, lab) { var h = '<section class="toc-sec"><h3>' + title + '</h3><div class="toc-grid">'; for (var i = 1; i <= n; i++) { var k = kf(i); h += '<button type="button" data-go="' + k + '" class="' + (now === k || now === k.replace(/-l$/, "-r") || now === k.replace(/-grid$/, "-pri") ? "now " : "") + (hasData(k) || hasData(k.replace(/-l$/, "-r")) ? "has" : "") + '" aria-label="' + esc(lab(i)) + '">' + i + "</button>"; } return h + "</div></section>"; };
    body.innerHTML = (start() ? '<button type="button" class="btn brg" data-go-week style="width:100%;margin:0 0 10px">이번 주 펼치기 · ' + currentWeek() + "주차</button>" : "") +
      '<button type="button" class="btn line" data-export style="width:100%;margin:0 0 10px">내 다이어리 내려받기 (PDF · 텍스트)</button>' +
      '<a class="btn line" href="/diary-guide.html" target="_blank" rel="noopener" style="width:100%;margin:0 0 14px">해설서 전체 보기 ↗</a>' +
      '<section class="toc-sec"><h3>PART 0 · 리포트를 내 말로</h3><ul class="toc-list">' + ["intro", "mission", "vision", "axes-a", "axes-b", "top3", "top2", "profile", "career", "outro"].map(function (k) { return link(k); }).join("") + "</ul></section>" +
      '<section class="toc-sec"><h3>PART 1 · 인생 지도 · YEARLY · PART 2</h3><ul class="toc-list">' + link("lifemap-1-l", "13영역 인생 지도") + link("year-1-cal", "1년차 달력") + link("annual") + link("ninety") + "</ul></section>" +
      grid("MONTHLY · 월간", 12, function (i) { return "month-" + i + "-grid"; }, function (i) { return monthLabel(i); }) +
      grid("WEEKLY · 주간 (금색 밑줄 = 기록 있음)", 52, function (i) { return "week-" + i + "-l"; }, function (i) { return i + "주차"; }) +
      '<section class="toc-sec"><h3>PART 4 · 영역별 분기 회고</h3><ul class="toc-list">' + S.DOMAINS.map(function (dm, i) { return link("quarterly-" + (i + 1), dm.name); }).join("") + "</ul></section>" +
      '<section class="toc-sec"><h3>PART 5–7 · 감사 · 추적 · 부록 · 저널</h3><ul class="toc-list">' + link("gratitude-1", "감사 (열두 달)") + link("tracker-1", "실행 추적 보드") + link("quotes-1", "말씀 · 문장 모음") + link("guide13") + link("usage") + link("owner") + link("daily-1", "데일리 저널") + link("free-1", "자유 메모") + "</ul></section>" +
      '<section class="toc-sec"><h3>쪽 번호로 가기</h3><form id="toc-page-form" class="sh-meta"><label for="toc-page">p.</label><input id="toc-page" type="number" inputmode="numeric" min="3" max="256" style="width:90px"><button type="submit" class="mini-btn">가기</button></form></section>' +
      '<section class="toc-sec"><h3>설정</h3><label class="setting"><span>넘김 효과</span><input type="checkbox" id="motion-toggle"' + (motionOK() ? " checked" : "") + ' style="width:22px;height:22px;accent-color:var(--brg)"></label></section>';
    if (H.units) H.units(body);
    openSheet(d);
  }

  // ---------------------------------------------------------------- events
  function bind() {
    stage.addEventListener("input", onInput); stage.addEventListener("change", onInput);
    document.addEventListener("focusout", function (e) { var pk = e.target && e.target.dataset && e.target.dataset.page; if (pk) flush(pk); });
    $("#sh-oneq").addEventListener("input", onInput); $("#sh-oneq").addEventListener("change", onInput);
    document.addEventListener("click", function (e) {
      var tb = e.target.closest(".tip-btn");
      if (tb) { e.preventDefault(); if (tb.getAttribute("aria-expanded") === "true" && tb.dataset.pinned) hideTip(tb); else showTip(tb, true); return; }
      if (openTip && !e.target.closest(".tip-pop")) hideTip(openTip);
      var t = e.target.closest("button,a"); if (!t) return;
      if (t.matches("[data-go]")) { var k = t.dataset.go; $$("dialog[open]").forEach(function (d) { d.close(); }); goKey(k); }
      else if (t.matches("[data-go-week]")) { $$("dialog[open]").forEach(function (d) { d.close(); }); goWeek(); }
      else if (t.matches("[data-start]")) openStart();
      else if (t.matches("[data-quick]")) openQuick();
      else if (t.matches("[data-oneq]")) openOneQ(t.dataset.oneq);
      else if (t.matches("[data-copy-page]")) {
        var pk = t.dataset.copyPage, fk = t.dataset.copyField, cur = val(pk, fk);
        if (cur && !confirm("이미 적은 내용이 있어요. 리포트 문장으로 바꿀까요?")) return;
        queue(pk, fk, t.dataset.copyText); var el = document.getElementById("f-" + pk + "-" + fk); if (el) { el.value = t.dataset.copyText; if (el.tagName === "TEXTAREA") autosize(el); el.focus(); }
        toast("옮겨 적었어요. 내 말로 조금 바꿔 보세요.");
      }
      else if (t.matches("[data-quarter]")) { view.quarter = +t.dataset.quarter; flushAll(); render(false); var tb = $('[data-quarter="' + view.quarter + '"]', book); if (tb) tb.focus(); }
      else if (t.matches("[data-cell]")) { var c = t.dataset.cell, d = +t.dataset.day; cellEdit(c, d); }
      else if (t.matches("[data-sugg]")) { $("#qr-text").value = t.dataset.sugg; $("#qr-text").focus(); }
      else if (t.matches("[data-keep]")) keepLog(t.dataset.keep);
      else if (t.matches("[data-del-log]")) delLog(t.dataset.delLog);
      else if (t.matches("[data-reset]")) resetDiary();
      else if (t.matches("[data-path]")) openPath();
      else if (t.matches("[data-path-add]")) addPathDirs(t.dataset.pathAdd);
      else if (t.matches("[data-export]")) { $$("dialog[open]").forEach(function (d) { d.close(); }); openExport(); }
    });
    $("#nav-prev").onclick = prev; $("#nav-next").onclick = next; $("#where").onclick = openToc; $("#fab").onclick = openQuick; $("#bar-toc").onclick = openToc; $("#bar-dl").onclick = openExport;
    $("#xp-pdf").onclick = function () { runExport("pdf"); }; $("#xp-page").onclick = function () { runExport("page"); }; $("#xp-txt").onclick = function () { runExport("txt"); }; $("#xp-copy").onclick = function () { runExport("copy"); };
    window.addEventListener("afterprint", function () { document.body.classList.remove("dy-printing"); });
    $("#oq-prev").onclick = function () { flush(oq.pk); oq.i--; renderOneQ(); };
    $("#oq-next").onclick = function () { flush(oq.pk); if (oq.i === oq.list.length - 1) { sheet("sh-oneq").close(); render(false); return; } oq.i++; renderOneQ(); };
    $("#sh-oneq").addEventListener("close", function () { flush(oq.pk); render(false); });
    $("#qr-next").onclick = quickNext; $("#qr-back").onclick = function () { if (qr.step === 2) { qr.kept = $("#qr-kept").value; qr.step = 1; renderQuick(); } else sheet("sh-quick").close(); };
    $("#start-save").onclick = saveStart;
    $("#path-close").onclick = function () { sheet("sh-path").close(); }; $("#path-save").onclick = savePath;
    $("#sh-toc").addEventListener("submit", function (e) { e.preventDefault(); var n = +$("#toc-page").value, k = null; for (var i = n; i >= 3 && !k; i--) if (S.PAGES[i]) k = S.PAGES[i].key; if (k) { sheet("sh-toc").close(); goKey(k); } });
    $("#sh-toc").addEventListener("change", function (e) { if (e.target.id === "motion-toggle") { document.body.classList.toggle("no-motion", !e.target.checked); try { localStorage.setItem("lp_diary_motion", e.target.checked ? "1" : "0"); } catch (_) {} } });
    $$(".sh-x").forEach(function (b) { b.onclick = function () { b.closest("dialog").close(); }; });
    $$("dialog.sheet").forEach(function (d) { d.addEventListener("click", function (e) { if (e.target === d) d.close(); }); });
    document.addEventListener("pointerover", function (e) { if (e.pointerType !== "mouse") return; var tb = e.target.closest(".tip-btn"), inPop = e.target.closest(".tip-wrap");
      if (tb) { clearTimeout(hoverT); if (tb.getAttribute("aria-expanded") !== "true") showTip(tb, false); } else if (inPop) clearTimeout(hoverT); });
    document.addEventListener("pointerout", function (e) { if (e.pointerType !== "mouse" || !openTip || openTip.dataset.pinned) return; var w = e.target.closest(".tip-wrap"); if (!w || (e.relatedTarget && w.contains(e.relatedTarget))) return;
      var b = openTip; hoverT = setTimeout(function () { if (b && !b.dataset.pinned) hideTip(b); }, 250); });
    document.addEventListener("focusin", function (e) { var tb = e.target.closest && e.target.closest(".tip-btn"); if (openTip && !(e.target.closest && e.target.closest(".tip-wrap"))) hideTip(openTip); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && openTip) { var ob = openTip; hideTip(ob); ob.focus(); e.preventDefault(); return; }
      if (document.querySelector("dialog[open]")) return;
      var tg = e.target, editing = tg && (tg.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName));
      if (editing || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); prev(); }
      else if (e.key === "Home") { e.preventDefault(); go(0); }
      else if (e.key === "End") { e.preventDefault(); go(SEQ.length - 1); }
    });
    // touch / pen / mouse swipe (not when starting in a field or a scrolling gesture)
    var sx = 0, sy = 0, st0 = 0, track = false;
    var skip = function (t) { return t.closest("input,textarea,select,button,label,a,.cal,.tabs,.tip-pop"); };
    var begin = function (x, y, t) { track = !skip(t); sx = x; sy = y; st0 = Date.now(); };
    var end = function (x, y) { if (!track) return; track = false; var dx = x - sx, dy = y - sy; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4 && Date.now() - st0 < 900) { dx < 0 ? next() : prev(); } };
    // Touch: real touch events (a pointer stream is cancelled once the page starts scrolling).
    stage.addEventListener("touchstart", function (e) { if (e.touches.length !== 1) { track = false; return; } begin(e.touches[0].clientX, e.touches[0].clientY, e.target); }, { passive: true });
    stage.addEventListener("touchend", function (e) { var t = e.changedTouches[0]; if (t) end(t.clientX, t.clientY); }, { passive: true });
    stage.addEventListener("touchcancel", function () { track = false; }, { passive: true });
    // Mouse and pen drag.
    stage.addEventListener("pointerdown", function (e) { if (e.pointerType === "touch" || e.button) return; begin(e.clientX, e.clientY, e.target); });
    stage.addEventListener("pointerup", function (e) { if (e.pointerType === "touch") return; end(e.clientX, e.clientY); });
    var rz; window.addEventListener("resize", function () { if (openTip) hideTip(openTip); clearTimeout(rz); rz = setTimeout(function () { var a = document.activeElement, editing = a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && book.contains(a); var m = view.mode; layout(); if (m !== view.mode || !editing) render(false); }, 120); });
    window.addEventListener("pagehide", flushAll);
    document.addEventListener("scroll", function (e) { if (openTip && !(e.target.closest && e.target.closest(".tip-pop")) && window.innerWidth >= 700) { if (openTip.dataset.pinned) placeTip(openTip, document.getElementById(openTip.getAttribute("aria-controls"))); else hideTip(openTip); } }, true);
    document.addEventListener("visibilitychange", function () { if (document.hidden) flushAll(); });
  }
  function cellEdit(pk, d) {
    var p = S.BY_KEY[pk], first = start() ? S.monthStart(start(), p.idx) : null, iso = first ? first.slice(0, 8) + String(d).padStart(2, "0") : null;
    oq.pk = pk; oq.list = [T.month_grid.fields[d - 1]]; oq.i = 0; renderOneQ();
    $("h2", sheet("sh-oneq")).textContent = iso ? md(iso) + " (" + WD[wd(iso)] + ")" : d + "일";
    openSheet(sheet("sh-oneq"));
  }
  // ---------------------------------------------------------------- download (PDF · print / text)
  // 회원 본인의 기록만, 이 기기 안에서 만든다(서버로 보내지 않음). 저장 대기 중인 칸을 먼저 저장한 뒤 만든다.
  var X = window.DiaryExport;
  function exportModel() { return X.buildModel(S, st, pageTitle, todayISO()); }
  // 화면 렌더러 그대로 다이어리 전체(인쇄 지도 p.3–p.256의 실제 쪽 250개)를 A4 한 장씩 만든다.
  // 입력칸·버튼은 종이 모양으로 바꾼다: 글칸 → 줄 친 칸 + 적은 글, 선택 → 고른 것 표시, 버튼·도움말 → 없앰.
  function staticize(el) {
    $$(".tip-wrap,.btn-row,.copy-btn,.mini-btn,.one-q,.cv-actions,.log-a,[data-start],[data-go-week],[data-go],.tabs,a.btn,.cv-rights", el).forEach(function (x) { x.remove(); });
    $$("textarea", el).forEach(function (t) { var d = document.createElement("div"); d.className = "xp-ruled"; d.textContent = t.value; t.replaceWith(d); });
    $$("select", el).forEach(function (t) { var d = document.createElement("div"); d.className = "xp-ln"; var o = t.options[t.selectedIndex]; d.textContent = t.value ? o.textContent : ""; t.replaceWith(d); });
    $$("input", el).forEach(function (t) {
      if (t.type === "checkbox" || t.type === "radio") { var lab = t.closest(".pill,.check"); if (lab && t.checked) lab.classList.add("on"); var mk = document.createElement("span"); mk.className = "xp-mark"; mk.textContent = t.checked ? (t.type === "radio" ? "●" : "☑") : (t.type === "radio" ? "○" : "☐"); t.replaceWith(mk); return; }
      var d = document.createElement("div"); d.className = "xp-ln"; d.textContent = t.type === "date" && t.value ? t.value.replace(/-/g, ".") : t.value; t.replaceWith(d);
    });
    $$("button", el).forEach(function (b) { var d = document.createElement("div"); d.className = b.className; d.innerHTML = b.innerHTML; b.replaceWith(d); });
    $$("[id]", el).forEach(function (x) { x.removeAttribute("id"); });
    $$("label[for]", el).forEach(function (x) { x.removeAttribute("for"); });
  }
  function bookPagesHTML() { return pagesHTML(S.PAGES.filter(Boolean).map(function (p) { return p.key; })); }
  // 지금 화면에 펼친 쪽(한 쪽 또는 양면)만 — 휴대폰에서도 금방 열린다.
  function viewKeys() { return currentKeys().filter(function (k) { return k && k !== "cover"; }); }
  function pagesHTML(keys) {
    var out = [], hold = view.quarter; printing = true;
    try {
      keys.forEach(function (key) {
        var el = pageEl(key); staticize(el);
        out.push('<section class="xp-page ' + el.className.replace(/\bdy-page\b/, "").trim() + '"><div class="xp-fit">' + el.innerHTML + "</div></section>");
      });
    } finally { printing = false; view.quarter = hold; }
    return out.join("");
  }
  // 지금 펼친 쪽 중 회원이 직접 적은 쪽만 담는다(빈 쪽만 있는 경우 막음 — 빈 양식 사본 방지, 약관 제8조 ④).
  function writtenViewKeys(m) { var w = {}; m.sections.forEach(function (s) { w[s.key] = 1; }); return viewKeys().filter(function (k) { return w[k]; }); }
  function noLabel(keys) { var n = keys.map(function (k) { return S.BY_KEY[k].no; }); return n.length > 1 ? "p. " + n[0] + "–" + n[n.length - 1] : "p. " + n[0]; }
  function openExport() {
    var m = exportModel();
    // 아무것도 적지 않은 상태에서는 내려받기를 막는다 — 회원 기록 없는 빈 양식 사본이 되지 않도록(약관 제8조 ④).
    $("#xp-sum").textContent = m.sections.length ? "지금까지 직접 쓰신 쪽 " + m.pagesWritten + "쪽 · 해 본 일 " + m.logCount + "개" : "아직 적은 내용이 없어요. 몇 칸 적은 뒤에 내려받아 보세요.";
    ["#xp-pdf", "#xp-txt", "#xp-copy"].forEach(function (id) { $(id).disabled = !m.sections.length; });
    var vk = writtenViewKeys(m);
    $("#xp-page").disabled = !vk.length;
    $("#xp-page-t").textContent = vk.length ? noLabel(vk) + "만 A4로 바로 만들어요. 휴대폰에서도 금방 열려요." : "지금 펼친 쪽에 적은 내용이 없어요. 적은 쪽을 펼친 뒤 눌러 주세요.";
    openSheet(sheet("sh-export"));
  }
  // 무거운 작업 전에 「만드는 중」 안내를 먼저 화면에 그린다(두 프레임 기다림) — 휴대폰에서 멈춘 것처럼 보이지 않게.
  function busy(on, text) {
    var b = $("#xp-busy"); if (!b) return Promise.resolve();
    if (!on) { b.hidden = true; return Promise.resolve(); }
    $("#xp-busy-t").textContent = text; b.hidden = false;
    return new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(function () { setTimeout(r, 30); }); }); });
  }
  function runExport(kind) {
    var btns = ["#xp-pdf", "#xp-page", "#xp-txt", "#xp-copy"].map(function (id) { return $(id); });
    btns.forEach(function (b) { b.disabled = true; });
    flushAll().then(function () {
      var m = exportModel();
      btns.forEach(function (b) { b.disabled = false; });
      if (kind === "pdf" || kind === "page") {
        var only = kind === "page" ? writtenViewKeys(m) : null;
        if (only && !only.length) { toast("지금 펼친 쪽에 적은 내용이 없어요."); return; }
        sheet("sh-export").close();
        busy(true, only ? noLabel(only) + " PDF를 만드는 중이에요…" : "한 권 전체(253쪽) PDF를 만드는 중이에요… 휴대폰에서는 인쇄 창이 뜨기까지 몇 초에서 십여 초 걸릴 수 있어요. 화면을 닫지 말고 기다려 주세요.").then(function () {
        var pr = document.getElementById("dy-print");
        if (!pr) { pr = document.createElement("div"); pr.id = "dy-print"; pr.setAttribute("aria-hidden", "true"); document.body.appendChild(pr); var css = document.createElement("style"); css.textContent = X.PRINT_CSS; document.head.appendChild(css); }
        pr.innerHTML = only ? X.pageFrame(m, pagesHTML(only)) : X.printFrame(m, bookPagesHTML());
        pr.classList.toggle("xp-only", !!only);
        pr.classList.add("xp-measure"); X.fitPages(pr); pr.classList.remove("xp-measure");
        busy(false);
        document.body.classList.add("dy-printing");
        var oldTitle = document.title; document.title = X.fileBase(m) + (only ? "_" + noLabel(only).replace(/[^0-9–]/g, "").replace("–", "-") + "쪽" : ""); // 「PDF로 저장」 기본 파일 이름
        // 인쇄 모드는 시간이 아니라 「인쇄가 끝난 뒤」에 끈다(afterprint, 또는 그다음 첫 화면 조작).
        // iOS Safari 등은 print()가 기다려 주지 않아서, 시간으로 끄면 화면이 대신 인쇄될 수 있다.
        setTimeout(function () {
          window.print(); document.title = oldTitle;
          var off = function () { document.body.classList.remove("dy-printing"); document.removeEventListener("pointerdown", off, true); document.removeEventListener("keydown", off, true); };
          setTimeout(function () { document.addEventListener("pointerdown", off, true); document.addEventListener("keydown", off, true); }, 400);
        }, 60);
        });
      } else if (kind === "txt") {
        var blob = new Blob([X.toText(m)], { type: "text/plain;charset=utf-8" }), url = URL.createObjectURL(blob), a = document.createElement("a");
        a.href = url; a.download = X.fileBase(m) + ".txt"; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
        toast("텍스트 파일을 저장했어요. 내려받기 폴더를 확인해 주세요.");
      } else {
        var txt = X.toText(m).replace(/^\uFEFF/, "");
        var ok = function () { toast("복사했어요. 메모 앱에 붙여 넣으세요."); }, fail = function () { toast("복사하지 못했어요. 텍스트 파일로 저장해 주세요."); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, fail); else fail();
      }
    }, function () { btns.forEach(function (b) { b.disabled = false; }); toast("아직 저장되지 않은 칸이 있어요. 연결을 확인한 뒤 다시 눌러 주세요."); });
  }
  function keepLog(id) {
    var t = prompt("해 보고 남은 것의 이름을 한 줄로 적어 주세요. (예: 비교 메모 한 장)"); if (!t || !t.trim()) return;
    st.call({ action: "keepLog", logId: id, kept: t.trim() }).then(function (r) { st.logs.forEach(function (l) { if (l.id === id) { l.kept = r.log.kept; l.stage = r.log.stage; } }); render(false); toast("남긴 것을 적었어요 (1단계)."); }, function (e) { toast(e.message || "저장하지 못했어요."); });
  }
  function delLog(id) {
    if (!confirm("이 기록을 지울까요? 지운 기록은 되돌릴 수 없어요.")) return;
    st.call({ action: "deleteLog", logId: id, confirm: true }).then(function () { st.logs = st.logs.filter(function (l) { return l.id !== id; }); render(false); toast("지웠어요."); }, function (e) { toast(e.message || "지우지 못했어요."); });
  }
  function resetDiary() {
    var t = prompt("다이어리의 모든 기록을 지웁니다. 리포트와 실행 프로그램은 그대로예요.\n계속하려면 ‘다이어리 비우기’라고 적어 주세요."); if (t !== "다이어리 비우기") return;
    st.call({ action: "reset", confirm: t }).then(function () { st.pages = {}; st.logs = []; st.meta = null; go(0); toast("다이어리를 비웠어요."); }, function (e) { toast(e.message || "비우지 못했어요."); });
  }


  // ---------------------------------------------------------------- 고유성 기반 자산화 길찾기 (asset-map v1)
  // The server reads the owner's own answers and computes; the browser only shows names, sentences and the
  // person's own chosen answers. Optional-question answers are shown as "내가 말한 변화" and never scored.
  var path = { view: null, probes: {}, env: "" };
  function openPath() {
    var body = $("#path-body"); body.innerHTML = '<p class="sh-hint">내 리포트 응답을 읽는 중…</p>'; $("#path-save").hidden = true;
    openSheet(sheet("sh-path"));
    st.call({ action: "pathfind", reportSid: st.sid }).then(showPath, function (e) { body.innerHTML = '<p class="notice">' + esc(e.message || "길찾기 결과를 불러오지 못했어요.") + "</p>"; });
  }
  function showPath(r) {
    var body = $("#path-body");
    if (!r.found) { body.innerHTML = '<p class="notice">리포트를 찾지 못했어요. 마이페이지의 리포트 카드에서 다시 들어와 주세요.</p>'; return; }
    if (r.noAnswers) { body.innerHTML = '<p class="notice">이 리포트에는 원래 응답이 남아 있지 않아 찾을 수 없어요. 다이어리에서 직접 골라 주세요.</p>'; return; }
    path.view = r.view; path.probes = Object.assign({}, r.probes || {}); path.env = r.env || "";
    var v = r.view, h = "";
    if (v.insufficient) h += '<p class="notice">' + esc(v.insufficient) + "</p>";
    v.items.forEach(function (it) {
      h += '<section class="pf-item' + (it.first ? " pf-first" : "") + '"><p class="pf-k">' + (it.first ? "가장 먼저 보인 변화" : "함께 보인 변화") + '</p><h3 class="pf-n">' + esc(it.name) + ' <small>' + esc(it.line) + "</small></h3>" +
        (it.summary ? '<p class="pf-s">' + esc(it.summary) + "</p>" : "") + (it.focus ? '<p class="pf-f"><b>특히</b> ' + esc(it.focus) + "</p>" : "") +
        (it.firstStep ? '<p class="pf-step"><b>처음 남길 것 하나</b><br>' + esc(it.firstStep) + "</p>" : "") +
        (it.reasons.length ? '<details class="pf-why"><summary>이렇게 본 이유</summary><ul>' + it.reasons.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></details>" : "") + "</section>";
    });
    if (v.self.length) h += '<section class="pf-item pf-self"><p class="pf-k">' + esc(v.selfLabel) + "</p>" + v.self.map(function (x) { return '<h3 class="pf-n">' + esc(x.name) + " <small>" + esc(x.line) + "</small></h3>"; }).join("") + '<p class="pf-s">' + esc(v.selfNote) + "</p></section>";
    if (v.ask.length) {
      h += '<section class="pf-ask"><p class="pf-k">조금 더 여쭤볼게요 <small>(골라도 되고, 건너뛰어도 돼요)</small></p><p class="sh-hint">응답만으로는 잘 드러나지 않는 삶도 있어요. 답은 결과를 바꾸지 않고, “' + esc(v.selfLabel) + '”로 따로 보여 드려요.</p>';
      v.ask.forEach(function (q) {
        h += '<fieldset class="pf-q"><legend>' + esc(q.text) + '</legend><div class="pills">' + [["yes", "네"], ["no", "아니요"], ["skip", "건너뛰기"]].map(function (o) {
          return '<label class="pill"><input type="radio" name="pf-' + q.id + '" value="' + o[0] + '"' + (path.probes[q.id] === o[0] ? " checked" : "") + "><span>" + o[1] + "</span></label>"; }).join("") + "</div></fieldset>";
      });
      h += "</section>";
    }
    h += '<div class="fld"><label class="fld-q" for="pf-env">' + esc(v.env.text) + '</label><input class="ln" id="pf-env" maxlength="300" value="' + esc(path.env) + '"></div>';
    var names = v.items.map(function (x) { return x.name; }).concat(v.self.map(function (x) { return x.name; })).slice(0, 2);
    if (names.length) h += '<button type="button" class="btn line pf-add" data-path-add="' + esc(names.join(",")) + '">「' + esc(names.join(" · ")) + '」 다이어리 칸에 옮겨 적기</button>';
    h += '<p class="notice">' + esc(v.addMore) + "</p><p class=\"pf-fixed\">" + esc(v.fixedLine) + "</p>";
    $("#path-body").innerHTML = h; $("#path-save").hidden = false;
  }
  function savePath() {
    var probes = {}; (path.view ? path.view.ask : []).forEach(function (q) { var c = $('input[name="pf-' + q.id + '"]:checked'); if (c) probes[q.id] = c.value; });
    var env = ($("#pf-env") || {}).value || "";
    $("#path-save").disabled = true;
    st.call({ action: "pathfind", reportSid: st.sid, probes: probes, env: env }).then(function (r) { $("#path-save").disabled = false; showPath(r); toast("답을 저장했어요."); },
      function (e) { $("#path-save").disabled = false; toast(e.message || "저장하지 못했어요."); });
  }
  function addPathDirs(list) {
    var names = String(list || "").split(",").filter(function (n) { return S.ASSET_DIRECTIONS.indexOf(n) >= 0; }).slice(0, 2);
    var cur = val("career", "dirs");
    if (cur && cur.length && !confirm("이미 고른 변화가 있어요. 길찾기 결과로 바꿀까요?")) return;
    queue("career", "dirs", names); flush("career"); sheet("sh-path").close(); render(false); toast("다이어리 칸에 옮겨 적었어요. 언제든 바꿀 수 있어요.");
  }
  // ---------------------------------------------------------------- boot
  window.DiaryApp = {
    boot: function (opts) {
      st.call = opts.call; st.sid = opts.sid || null;
      var gl = document.getElementById("bar-guide"); if (gl && st.sid) gl.href = "/diary-guide.html?sid=" + encodeURIComponent(st.sid);
      book = $("#dy-book"); stage = $("#dy-stage"); live = $("#dy-live");
      try { if (localStorage.getItem("lp_diary_motion") === "0") document.body.classList.add("no-motion"); } catch (_) {}
      $("#dy-loading").hidden = false;
      return st.call({ action: "open", reportSid: st.sid }).then(function (r) {
        st.seed = r.seed; st.meta = r.meta; st.pages = r.pages || {}; st.logs = r.logs || []; st.reportFound = !!r.reportFound;
        if (!st.sid && st.meta) st.sid = st.meta.reportSid;
        $("#dy-loading").hidden = true; $("#dy-app").hidden = false;
        layout(); bind(); render(true); setSave(""); return r;
      });
    },
    _state: st, _view: view, go: goKey
  };
})();
