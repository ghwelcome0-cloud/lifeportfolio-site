/* ============================================================
   lp-wait.js — 공통 대기 표시 (2026-09-08)
   ------------------------------------------------------------
   무엇 : ① data-lp-wait 가 붙은 요소에 회전 링을 붙이고, 문구가 "대기 문구"가
            아닌 것으로 바뀌면(로그인 확정·데이터 도착 등) 자동으로 링을 뗀다.
          ② 9초를 넘기면(NN/g 10초 한계) "조금 더 걸리고 있어요" 보조 문구를
            자동으로 덧붙인다 → 고객이 멈춤으로 오해하지 않게.
          ③ 내부 링크 클릭·폼 제출 시 화면 맨 위에 얇은 진행바(YouTube/GitHub 패턴).
   설계 : 링은 CSS ::before 로 그리므로 다른 스크립트가 textContent 를 바꿔도
          깨지지 않는다. DOM 삽입 0, 레이아웃 이동 0.
   안전 : 어떤 예외도 삼킨다(try/catch). 원래 페이지 로직에 관여하지 않는다.
   사용 : <span data-lp-wait>확인 중…</span>   (그 외 설정 불필요)
          window.LP_WAIT.nav()  — 수동으로 상단 진행바 켜기
          window.LP_WAIT.done(el) — 수동 종료
   ============================================================ */
(function (w, d) {
  "use strict";
  if (w.LP_WAIT) return;

  var WAIT_RE = /(확인\s*중|불러오|처리\s*중|생성\s*중|준비\s*중|펼치는\s*중|보내는\s*중|로그인\s*중|잠시만|기다려|verif|loading|checking|preparing|processing|creating|sending|please\s+wait|one\s+moment)/i;
  var SLOW_MS = 9000;
  var SLOW_TEXT = {
    ko: "조금 더 걸리고 있어요. 새로고침 없이 잠시만 기다려 주세요.",
    en: "This is taking a little longer than usual. Please wait a moment — no need to refresh."
  };

  function lang() {
    try {
      var q = (new URL(w.location.href).searchParams.get("lang") || "").toLowerCase();
      if (q === "en" || q === "ko") return q;
    } catch (_) {}
    try { return ((d.documentElement.getAttribute("lang") || "ko").toLowerCase().indexOf("en") === 0) ? "en" : "ko"; } catch (_) { return "ko"; }
  }

  function isWaitingText(el) {
    var t = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (!t) return false;
    return WAIT_RE.test(t);
  }

  function done(el) {
    try {
      if (!el || !el.hasAttribute) return;
      el.removeAttribute("data-lp-wait");
      el.removeAttribute("data-lp-wait-slow");
      if (el.getAttribute("aria-busy") === "true" && el.getAttribute("data-lp-wait-owned-busy") === "1") el.removeAttribute("aria-busy");
      el.removeAttribute("data-lp-wait-owned-busy");
      var tm = el.__lpWaitTimer; if (tm) { clearTimeout(tm); el.__lpWaitTimer = null; }
      var mo = el.__lpWaitMo; if (mo) { mo.disconnect(); el.__lpWaitMo = null; }
    } catch (_) {}
  }

  function mount(el) {
    try {
      if (!el || el.__lpWaitMo) return;
      if (!isWaitingText(el)) { el.removeAttribute("data-lp-wait"); return; }
      if (!el.hasAttribute("aria-busy")) { el.setAttribute("aria-busy", "true"); el.setAttribute("data-lp-wait-owned-busy", "1"); }

      // 상태가 바뀌면(문구가 대기형이 아니게 되면) 자동 해제. 대기형→대기형(번역 치환 등)은 유지.
      var mo = new MutationObserver(function () {
        try {
          if (!d.contains(el)) { done(el); return; }
          if (!isWaitingText(el)) done(el);
        } catch (_) {}
      });
      mo.observe(el, { childList: true, characterData: true, subtree: true });
      el.__lpWaitMo = mo;

      // 9초 초과 → 보조 문구(NN/g: 10초 넘기면 추가 정보 필요)
      el.__lpWaitTimer = setTimeout(function () {
        try {
          if (el.hasAttribute("data-lp-wait") && isWaitingText(el) && !el.hasAttribute("data-lp-wait-no-slow")) {
            el.setAttribute("data-lp-wait-slow", SLOW_TEXT[lang()] || SLOW_TEXT.ko);
          }
        } catch (_) {}
      }, SLOW_MS);
    } catch (_) {}
  }

  function scan(root) {
    try {
      var list = (root || d).querySelectorAll("[data-lp-wait]");
      for (var i = 0; i < list.length; i++) mount(list[i]);
    } catch (_) {}
  }

  /* ── 상단 진행바 ── */
  var bar = null, barTimer = null;
  function ensureBar() {
    if (bar) return bar;
    try {
      bar = d.createElement("div");
      bar.className = "lp-wait-topbar";
      bar.setAttribute("aria-hidden", "true");
      var fill = d.createElement("div"); fill.className = "lp-wait-topbar__fill";
      bar.appendChild(fill);
      (d.body || d.documentElement).appendChild(bar);
    } catch (_) {}
    return bar;
  }
  function nav() {
    try {
      var b = ensureBar(); if (!b) return;
      b.classList.remove("is-on");
      // reflow 로 애니메이션 재시작
      void b.offsetWidth;
      b.classList.add("is-on");
      if (barTimer) clearTimeout(barTimer);
      barTimer = setTimeout(navDone, 15000); // 이동이 취소된 경우 안전 종료
    } catch (_) {}
  }
  function navDone() { try { if (bar) bar.classList.remove("is-on"); } catch (_) {} }

  function isInternalNavLink(a) {
    try {
      if (!a || a.tagName !== "A") return false;
      var href = a.getAttribute("href") || "";
      if (!href || href.charAt(0) === "#") return false;
      if (/^(mailto:|tel:|javascript:|data:|blob:|sms:)/i.test(href)) return false;
      if (a.hasAttribute("download")) return false;
      var tgt = (a.getAttribute("target") || "").toLowerCase();
      if (tgt && tgt !== "_self") return false;
      var u = new URL(href, w.location.href);
      if (u.origin !== w.location.origin) return false;
      // 같은 문서 내 해시 이동만 다른 경우 제외
      if (u.pathname === w.location.pathname && u.search === w.location.search && u.hash) return false;
      return true;
    } catch (_) { return false; }
  }

  function bindNav() {
    try {
      d.addEventListener("click", function (e) {
        try {
          if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          var t = e.target, a = null;
          while (t && t !== d) { if (t.tagName === "A") { a = t; break; } t = t.parentNode; }
          if (!isInternalNavLink(a)) return;
          nav();
        } catch (_) {}
      }, false); // bubble: 페이지 핸들러의 preventDefault 를 존중
      d.addEventListener("submit", function (e) { try { if (!e.defaultPrevented) nav(); } catch (_) {} }, false);
      w.addEventListener("pageshow", navDone);   // bfcache 복귀 시 바 정리
      w.addEventListener("pagehide", navDone);
    } catch (_) {}
  }

  function boot() {
    scan();
    bindNav();
    // 늦게 추가되는 대기 요소(동적 렌더) 대응
    try {
      var rootMo = new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          var nodes = muts[i].addedNodes; if (!nodes) continue;
          for (var j = 0; j < nodes.length; j++) {
            var n = nodes[j]; if (!n || n.nodeType !== 1) continue;
            if (n.hasAttribute && n.hasAttribute("data-lp-wait")) mount(n);
            else if (n.querySelectorAll) scan(n);
          }
        }
      });
      rootMo.observe(d.documentElement, { childList: true, subtree: true });
    } catch (_) {}
  }

  w.LP_WAIT = { mount: mount, done: done, scan: scan, nav: nav, navDone: navDone };

  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})(window, document);
