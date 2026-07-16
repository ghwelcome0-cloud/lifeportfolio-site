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

  // Zone 2: 네 개의 결 — 4축 수평 스택 바 (SVG). 스펙 §4 잠금.
  //   viewBox 400×160, 순서 고정(이해→표현→설계→실행), track 8px, 간격 32px,
  //   max width 260, fill=(v/100)*260, 색 #468D84, track #EFEBE0, % 기호 없음.
  var AXIS_ORDER = ["understanding", "expression", "design", "execution"];
  var AXIS_LABEL = {
    understanding: "자기이해", expression: "자기표현",
    design: "자기설계", execution: "자기실행"
  };
  var SVGNS = "http://www.w3.org/2000/svg";
  function _svg(tag, attrs) {
    var n = document.createElementNS(SVGNS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { if (attrs[k] != null) n.setAttribute(k, attrs[k]); });
    return n;
  }
  function renderAxesZone(axes) {
    var z = C.el("article", { "class": "lp-viz-zone lp-viz-zone--axes", "aria-label": "네 개의 결" });
    z.appendChild(C.el("p", { "class": "lp-viz-zone__eyebrow" }, "네 개의 결"));

    axes = axes || {};
    // 좌표 상수 (viewBox 400×160)
    var VB_W = 400, VB_H = 160;
    var LABEL_X = 0, LABEL_W = 96;           // 라벨 영역
    var TRACK_X = LABEL_W + 8;               // 트랙 시작 x
    var TRACK_MAX = 260;                     // 막대 최대 폭
    var VALUE_X = TRACK_X + TRACK_MAX + 8;   // 값 x
    var ROW_GAP = 32, TRACK_H = 8;
    var TOP = 16;                            // 첫 행 상단 여백

    // aria-label (색 외 정보 = 위치·수치)
    var ariaParts = AXIS_ORDER.map(function (k) {
      var v = axes[k];
      return AXIS_LABEL[k] + " " + ((typeof v === "number") ? Math.round(v) : "—");
    });
    var wrap = C.el("div", { "class": "lp-viz-axes", "role": "img", "aria-label": ariaParts.join(", ") });

    var svg = _svg("svg", {
      viewBox: "0 0 " + VB_W + " " + VB_H, width: "100%",
      preserveAspectRatio: "none", "aria-hidden": "true"
    });

    var reduced = C.prefersReducedMotion();
    var locked = C.isRenderLocked();
    var animate = !reduced && !locked;
    var pendingFills = [];

    AXIS_ORDER.forEach(function (k, i) {
      var cy = TOP + i * ROW_GAP;
      var v = axes[k];
      var hasVal = (typeof v === "number" && !isNaN(v));
      var val = hasVal ? Math.max(0, Math.min(100, Math.round(v))) : null;

      // 라벨
      var label = _svg("text", {
        x: LABEL_X, y: cy + TRACK_H, "font-size": 13, "font-weight": 500,
        fill: "#17212B", "font-family": "inherit"
      });
      label.textContent = AXIS_LABEL[k];
      svg.appendChild(label);

      // 트랙 배경
      svg.appendChild(_svg("rect", {
        x: TRACK_X, y: cy, width: TRACK_MAX, height: TRACK_H, rx: 4, fill: "#EFEBE0"
      }));

      // fill (결측 → 회색 #D9D6CE, 수치 미표시)
      var targetW = hasVal ? (val / 100) * TRACK_MAX : TRACK_MAX; // 결측은 전체 회색 트랙 대체
      var fill = _svg("rect", {
        x: TRACK_X, y: cy, height: TRACK_H, rx: 4,
        fill: hasVal ? "#468D84" : "#D9D6CE",
        width: (animate && hasVal) ? 0 : targetW
      });
      if (animate && hasVal) {
        fill.style.transition = "width 600ms ease-out";
        pendingFills.push({ el: fill, w: targetW });
      }
      svg.appendChild(fill);

      // 값 (정수, % 없음). 결측 시 미표시.
      if (hasVal) {
        var vtext = _svg("text", {
          x: VALUE_X, y: cy + TRACK_H, "font-size": 12, "font-weight": 400,
          fill: "#8A8478", "font-family": "inherit"
        });
        vtext.textContent = String(val);
        svg.appendChild(vtext);
      }
    });

    wrap.appendChild(svg);
    z.appendChild(wrap);

    // 애니메이션: 다음 프레임에 목표폭으로 전환 (0→target)
    if (pendingFills.length) {
      (window.requestAnimationFrame || function (f) { return setTimeout(f, 16); })(function () {
        pendingFills.forEach(function (p) { p.el.setAttribute("width", p.w); });
      });
    }
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
    // Zone 2 axes
    grid.appendChild(renderAxesZone(data.axes));
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
