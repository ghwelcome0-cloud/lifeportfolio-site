/* ============================================================================
 * lp-viz.core.js — 인생포트폴리오 시각화 공통 유틸 (Sprint V1)
 *   순수 유틸만. 리포트 엔진 함수 직접 호출 금지. window.lpDashboardData 외 전역 접근 금지.
 *   전역: window.LPVizCore
 * ==========================================================================*/
(function (global) {
  "use strict";

  /* ── HTML escape (XSS·깨짐 방지) ──────────────────────────────────────── */
  function escapeHtml(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* ── 요소 생성 헬퍼 ───────────────────────────────────────────────────── */
  function el(tag, attrs, html) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "class") node.className = attrs[k];
        else if (attrs[k] != null) node.setAttribute(k, attrs[k]);
      });
    }
    if (html != null) node.innerHTML = html;
    return node;
  }

  /* ── 안전 문자열/숫자 ─────────────────────────────────────────────────── */
  function str(v, fallback) {
    if (v == null) return fallback == null ? "" : fallback;
    var t = String(v).trim();
    return t.length ? t : (fallback == null ? "" : fallback);
  }
  function clampInt(v) {
    if (typeof v !== "number" || isNaN(v)) return null;
    var n = Math.round(v);
    return Math.max(0, Math.min(100, n));
  }

  /* ── 오늘 날짜 ISO (fallback 용) ──────────────────────────────────────── */
  function todayISO() {
    var d = new Date();
    var mm = ("0" + (d.getMonth() + 1)).slice(-2);
    var dd = ("0" + d.getDate()).slice(-2);
    return d.getFullYear() + "-" + mm + "-" + dd;
  }
  /* ISO → 표시용 "YYYY.MM.DD" (파싱 실패 시 원문 그대로) */
  function fmtDate(iso) {
    var s = str(iso);
    if (!s) return "";
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[1] + "." + m[2] + "." + m[3];
    return s;
  }

  /* ── render lock 감지 (스펙 §9-1) ─────────────────────────────────────
   *   window.__lp_render_lock 를 setter 로 감시. 이미 정의돼 있으면 중복 정의 회피.
   *   변경 시 등록된 콜백들에 통지. */
  var _lockCbs = [];
  function onRenderLock(cb) { if (typeof cb === "function") _lockCbs.push(cb); }
  function _notifyLock(v) {
    _lockCbs.forEach(function (cb) { try { cb(!!v); } catch (e) {} });
  }
  (function installLockWatcher() {
    try {
      var desc = Object.getOwnPropertyDescriptor(global, "__lp_render_lock");
      if (desc && desc.set) return; // 이미 설치됨
      var _val = !!global.__lp_render_lock;
      Object.defineProperty(global, "__lp_render_lock", {
        configurable: true,
        get: function () { return _val; },
        set: function (v) { _val = !!v; _notifyLock(_val); }
      });
    } catch (e) {
      /* defineProperty 실패 시(구형) — 폴백: 값만 유지, 감시는 dashboard 쪽 폴링 없음 */
    }
  })();

  /* ── reduced-motion 여부 ─────────────────────────────────────────────── */
  function prefersReducedMotion() {
    try {
      return global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) { return false; }
  }

  global.LPVizCore = {
    escapeHtml: escapeHtml,
    el: el,
    str: str,
    clampInt: clampInt,
    todayISO: todayISO,
    fmtDate: fmtDate,
    onRenderLock: onRenderLock,
    isRenderLocked: function () { return !!global.__lp_render_lock; },
    prefersReducedMotion: prefersReducedMotion
  };
})(window);
