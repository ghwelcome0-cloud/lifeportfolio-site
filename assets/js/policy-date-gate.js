/**
 * 약관·처리방침 날짜 장치 (2026-10-15, 대표 결정: 10-18 공지 시작 · 10-25 이용약관 시행)
 * - data-lp-from="ISO"  : 그 시각부터 보인다 (그 전에는 숨김)
 * - data-lp-until="ISO" : 그 시각부터 숨긴다 (그 전에는 보임)
 * - data-lp-lang="ko|en": 화면 언어와 같은 것만 보인다
 * - ?policy_notice=preview 를 붙이면 날짜와 관계없이 "가장 늦은 시점" 모습을 보여 준다(운영자 확인용).
 * 실패해도 기본 HTML(지금 시행 중인 조문)은 그대로 보인다. 날짜 단일 출처: functions/emails/policy-update-*.js
 */
(function () {
  "use strict";
  function lang() {
    try { var q = (new URLSearchParams(location.search).get("lang") || "").toLowerCase(); if (q === "en" || q === "ko") return q; } catch (e) {}
    try { if (window.LP_I18N && window.LP_I18N.lang) return String(window.LP_I18N.lang).toLowerCase().indexOf("en") === 0 ? "en" : "ko"; } catch (e) {}
    return (document.documentElement.lang || "ko").toLowerCase().indexOf("en") === 0 ? "en" : "ko";
  }
  function apply() {
    var preview = /[?&]policy_notice=/.test(location.search);
    var now = preview ? Infinity : Date.now(), L = lang();
    var els = document.querySelectorAll("[data-lp-from],[data-lp-until],[data-lp-lang]");
    for (var i = 0; i < els.length; i++) {
      var el = els[i], show = true;
      var f = el.getAttribute("data-lp-from"), u = el.getAttribute("data-lp-until"), g = el.getAttribute("data-lp-lang");
      if (f && !(now >= Date.parse(f))) show = false;
      if (u && now >= Date.parse(u)) show = false;
      if (g && g !== L) show = false;
      if (show) el.removeAttribute("hidden"); else el.setAttribute("hidden", "");
    }
  }
  window.LP_POLICY_DATE_GATE = apply;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply); else apply();
  window.addEventListener("load", function () { apply(); setTimeout(apply, 800); });
})();
