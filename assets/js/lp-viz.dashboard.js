/* ============================================================================
 * lp-viz.dashboard.js — 리포트 요약 대시보드 렌더러 (Sprint V1)
 *   소비 대상: window.lpDashboardData (엔진이 노출). 재계산·재렌더링·엔진 호출 금지.
 *   트리거: document 'lp:report-ready' 이벤트 수신 → render.
 *   실패 시 fail-silent (섹션 미노출, 리포트 본문 무영향).
 *   전역: window.LPVizDashboard
 * ==========================================================================*/
(function (global, doc) {
  "use strict";

  var C = global.LPVizCore;
  var MOUNT_ID = "summary-dashboard";

  /* ── 공개 API ─────────────────────────────────────────────────────────── */
  var LPVizDashboard = {
    render: function (mountEl, data) {
      try { return _render(mountEl, data); }
      catch (e) { _failSilent(mountEl, e); return false; }
    },
    destroy: function (mountEl) {
      try {
        var m = _resolveMount(mountEl);
        if (m) m.innerHTML = "";
      } catch (e) {}
    },
    onRenderLock: function () {
      try { _applyLock(true); } catch (e) {}
    }
  };

  /* ── 내부: mount 요소 확보 ────────────────────────────────────────────── */
  function _resolveMount(mountEl) {
    if (mountEl && mountEl.nodeType === 1) return mountEl;
    return doc.getElementById(MOUNT_ID);
  }

  /* ── 내부: fail-silent ────────────────────────────────────────────────── */
  function _failSilent(mountEl, err) {
    try {
      var m = _resolveMount(mountEl);
      if (m) m.style.display = "none";
      // 개발자 마커는 UI 미노출(스펙 §12). 콘솔로만.
      if (global.console && console.warn) console.warn("[lp-viz] dashboard skipped:", err && err.message);
    } catch (e) {}
  }

  /* ── 내부: render lock 반영 ───────────────────────────────────────────── */
  function _applyLock(locked) {
    var m = doc.getElementById(MOUNT_ID);
    if (!m) return;
    if (locked) m.classList.add("lp-viz-dashboard--locked");
    else m.classList.remove("lp-viz-dashboard--locked");
  }

  /* ── zone 렌더 함수 (스펙 §10 · 순수: data만 받아 요소 반환) ──────────── */

  // 헤더: 이름 · 발행일 · 사명 원문
  function renderHeader(user, mission) {
    var header = C.el("header", { "class": "lp-viz-dashboard__header" });
    var meta = C.el("div", { "class": "lp-viz-dashboard__meta" });
    meta.appendChild(C.el("span", {
      "class": "lp-viz-dashboard__name", "data-source-var": "user.name"
    }, C.escapeHtml(C.str(user && user.name, "회원님"))));
    var iso = C.str(user && user.issuedAt, C.todayISO());
    meta.appendChild(C.el("span", {
      "class": "lp-viz-dashboard__date", "data-source-var": "user.issuedAt"
    }, C.escapeHtml(C.fmtDate(iso))));
    header.appendChild(meta);

    var mtext = C.str(mission && mission.text, "");
    var p;
    if (mtext) {
      p = C.el("p", { "class": "lp-viz-dashboard__mission", "data-source-var": "mission" },
        C.escapeHtml(mtext));
    } else {
      // §2-3 방어(프로덕션 미발생): 회색 이탤릭
      p = C.el("p", { "class": "lp-viz-dashboard__mission lp-viz-dashboard__mission--empty", "data-source-var": "mission" },
        "아직 사명이 정리되지 않았습니다");
    }
    header.appendChild(p);
    return header;
  }

  // Zone 1: 지금의 나 (사명 lead + todayAction)
  function renderTodayZone(mission, todayAction) {
    var z = C.el("article", { "class": "lp-viz-zone lp-viz-zone--today", "aria-label": "오늘의 요약" });
    z.appendChild(C.el("p", { "class": "lp-viz-zone__eyebrow" }, "지금의 나"));
    var mtext = C.str(mission && mission.text, "");
    if (mtext) {
      z.appendChild(C.el("p", { "class": "lp-viz-zone__lead", "data-source-var": "mission" }, C.escapeHtml(mtext)));
    }
    var atext = todayAction && C.str(todayAction.text, "");
    if (atext) {
      z.appendChild(C.el("p", {
        "class": "lp-viz-zone__action",
        "data-source-var": "program.week1.ifthen[0].action"
      }, C.escapeHtml(atext)));
    }
    return z;
  }

  // Zone 5: 지금 해볼 한 가지 (훅). todayAction 결측 → null 반환(§2-3 카드 미렌더)
  function renderHookZone(todayAction) {
    var atext = todayAction && C.str(todayAction.text, "");
    if (!atext) return null;
    var z = C.el("article", { "class": "lp-viz-zone lp-viz-zone--hook", "aria-label": "지금 해볼 한 가지" });
    z.appendChild(C.el("p", { "class": "lp-viz-zone__eyebrow" }, "지금 해볼 한 가지"));
    z.appendChild(C.el("p", {
      "class": "lp-viz-zone__action-large",
      "data-source-var": "program.week1.ifthen[0].action"
    }, C.escapeHtml(atext)));
    var btn = C.el("button", {
      "class": "lp-viz-zone__cta nopdf", "type": "button", "data-target": "#sec-growth_map"
    }, "이번 주 실행 보기");
    btn.addEventListener("click", function () {
      var t = document.getElementById("sec-growth_map") || document.querySelector('[id^="sec-growth"]');
      if (t && t.scrollIntoView) t.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    z.appendChild(btn);
    return z;
  }

  /* ── 내부: 실제 렌더 (V1-2: header + today + hook. axes/strengths/keywords 자리) ── */
  function _render(mountEl, data) {
    if (!C) return false;
    var m = _resolveMount(mountEl);
    if (!m) return false;
    if (!data || typeof data !== "object") { _failSilent(m); return false; }

    m.style.display = "";
    m.innerHTML = "";
    m.className = "lp-viz-dashboard";
    m.setAttribute("aria-label", "리포트 요약");

    // 헤더
    m.appendChild(renderHeader(data.user, data.mission));

    // grid
    var grid = C.el("div", { "class": "lp-viz-dashboard__grid" });
    // Zone 1 today
    grid.appendChild(renderTodayZone(data.mission, data.todayAction));
    // Zone 2 axes (V1-3에서 채움) — 자리 유지
    grid.appendChild(_placeholderZone("axes", "네 개의 결", "네 개의 결"));
    // Zone 3 strengths (V1-4) — 자리 유지
    grid.appendChild(_placeholderZone("strengths", "강점", "강점"));
    // Zone 4 keywords (V1-4) — 자리 유지
    grid.appendChild(_placeholderZone("keywords", "지금의 결", "분야와 활동"));
    // Zone 5 hook (조건부)
    var hook = renderHookZone(data.todayAction);
    if (hook) grid.appendChild(hook);

    m.appendChild(grid);

    // render lock 상태면 즉시 잠금 클래스
    if (C.isRenderLocked()) _applyLock(true);
    return true;
  }

  // 후속 커밋에서 채울 zone 자리(eyebrow만). 순서·레이아웃 고정용.
  function _placeholderZone(kind, eyebrow, aria) {
    var z = C.el("article", { "class": "lp-viz-zone lp-viz-zone--" + kind, "aria-label": aria });
    z.appendChild(C.el("p", { "class": "lp-viz-zone__eyebrow" }, C.escapeHtml(eyebrow)));
    return z;
  }

  /* ── 이벤트 수신: lp:report-ready ─────────────────────────────────────── */
  function _boot() {
    var mount = doc.getElementById(MOUNT_ID);
    if (!mount) return; // 섹션 없으면 조용히 skip
    LPVizDashboard.render(mount, global.lpDashboardData);
  }

  doc.addEventListener("lp:report-ready", _boot);

  // render lock 콜백 등록 (core watcher → dashboard)
  if (C && C.onRenderLock) C.onRenderLock(function (locked) { _applyLock(locked); });

  global.LPVizDashboard = LPVizDashboard;
})(window, document);
