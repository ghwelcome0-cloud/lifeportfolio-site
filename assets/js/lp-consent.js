/* ============================================================
   lp-consent.js — 분석 도구 동의(Consent Mode v2) 배너 (2026-09-08, 승인 ⑪)
   ------------------------------------------------------------
   무엇 : 분석(GA4/GTM) 저장소를 기본 '거부'로 두고, 이용자가 [동의] 를 누르면
          gtag('consent','update') 로 허용한다. 선택은 localStorage 'lp_consent_analytics'
          ('granted' | 'denied') 에 저장 — Microsoft Clarity 게이트(index.html)가 이미
          같은 키를 읽으므로 동의 1회로 두 도구가 함께 켜진다.
   순서 : 각 지면 <head> 의 gtag('js', …) 보다 먼저 실행돼야 한다(Consent Mode 규칙).
          → 각 지면의 첫 dataLayer 접근 직전에 인라인 1줄로 기본값을 밀어넣고,
            이 파일은 defer 로 배너/업데이트만 담당한다.
   법적 : 개인정보보호법 §15(동의 기반 수집) · GDPR Art.6(1)(a) · 개인정보처리방침 §10.
   안전 : 실패 시 아무 것도 하지 않음(기본 denied 유지). 필수 쿠키(로그인)는 무관.
   ============================================================ */
(function (w, d) {
  "use strict";
  if (w.LP_CONSENT) return;
  var KEY = "lp_consent_analytics";
  function gtag() { (w.dataLayer = w.dataLayer || []).push(arguments); }
  function read() { try { return localStorage.getItem(KEY); } catch (_) { return null; } }
  function write(v) { try { localStorage.setItem(KEY, v); } catch (_) {} }
  function lang() {
    try { var q = (new URL(w.location.href).searchParams.get("lang") || "").toLowerCase(); if (q === "en" || q === "ko") return q; } catch (_) {}
    try { return ((d.documentElement.getAttribute("lang") || "ko").toLowerCase().indexOf("en") === 0) ? "en" : "ko"; } catch (_) { return "ko"; }
  }
  var T = {
    ko: { body: "더 나은 서비스를 위해 익명 통계(방문·전환)를 수집해도 될까요? 동의하지 않아도 모든 기능을 그대로 쓸 수 있어요.", ok: "동의", no: "거부", more: "자세히", moreHref: "/privacy#s10" },
    en: { body: "May we collect anonymous usage statistics (visits, conversions) to improve the service? Everything works the same if you decline.", ok: "Allow", no: "Decline", more: "Details", moreHref: "/privacy?lang=en#s10" }
  };

  function apply(v) {
    var granted = (v === "granted");
    gtag("consent", "update", {
      analytics_storage: granted ? "granted" : "denied",
      ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied"
    });
    try { d.dispatchEvent(new CustomEvent("lp:consentchange", { detail: { analytics: granted } })); } catch (_) {}
  }

  function decide(v) {
    write(v); apply(v);
    var b = d.getElementById("lpConsent"); if (b) { b.setAttribute("data-out", "1"); setTimeout(function () { try { b.remove(); } catch (_) {} }, 260); }
  }

  function banner() {
    if (d.getElementById("lpConsent")) return;
    var t = T[lang()] || T.ko;
    var box = d.createElement("aside");
    box.id = "lpConsent"; box.className = "lp-consent"; box.setAttribute("role", "region"); box.setAttribute("aria-label", lang() === "en" ? "Analytics consent" : "분석 도구 동의");
    var p = d.createElement("p"); p.className = "lp-consent__text"; p.textContent = t.body + " ";
    var a = d.createElement("a"); a.href = t.moreHref; a.textContent = t.more; a.className = "lp-consent__more"; p.appendChild(a);
    var acts = d.createElement("div"); acts.className = "lp-consent__actions";
    var no = d.createElement("button"); no.type = "button"; no.className = "lp-consent__btn lp-consent__btn--ghost"; no.textContent = t.no; no.addEventListener("click", function () { decide("denied"); });
    var ok = d.createElement("button"); ok.type = "button"; ok.className = "lp-consent__btn lp-consent__btn--primary"; ok.textContent = t.ok; ok.addEventListener("click", function () { decide("granted"); });
    acts.appendChild(no); acts.appendChild(ok);
    box.appendChild(p); box.appendChild(acts);
    (d.body || d.documentElement).appendChild(box);
  }

  function boot() {
    var v = read();
    if (v === "granted" || v === "denied") { apply(v); return; } // 이미 선택 → 배너 없음
    banner();
  }

  w.LP_CONSENT = {
    get: read,
    set: function (v) { if (v === "granted" || v === "denied") decide(v); },
    reset: function () { try { localStorage.removeItem(KEY); } catch (_) {} banner(); }
  };

  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})(window, document);
