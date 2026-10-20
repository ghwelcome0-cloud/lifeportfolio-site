/* ============================================================
   lp-consent.js — 분석 도구 동의(Consent Mode v2) 배너 (2026-09-08, 승인 ⑪ / 2026-10-15 개선)
   ------------------------------------------------------------
   무엇 : 분석(GA4/GTM) 저장소를 기본 '거부'로 두고, 이용자가 [동의] 를 누르면
          gtag('consent','update') 로 허용한다. 선택은 localStorage 'lp_consent_analytics'
          ('granted' | 'denied') 에 저장 — Microsoft Clarity 게이트(index.html)가 이미
          같은 키를 읽으므로 동의 1회로 두 도구가 함께 켜진다.
   2026-10-15 개선 (대표 승인, 개인정보처리방침 10-4)
     ① 선택 날짜 'lp_consent_analytics_at' 저장 → 1년이 지나면 한 번 다시 묻는다.
     ② 버튼을 누를 때 서버에 "동의 1 / 거부 1" 개수만 보낸다(recordConsentChoice). 누가 골랐는지는 운영 화면에 없다.
     ③ 로그인한 회원은 선택을 계정에도 저장 → 다른 기기·브라우저에서 다시 묻지 않는다.
        (로그인 화면들이 LP_CONSENT.attachUser(getIdToken) 를 부른다)
     ④ 같은 사이트의 다른 주소(lifeporfolio.web.app / .firebaseapp.com)로 들어오면 정식 주소로 옮긴다.
        로그인 처리 주소(/__/…)와 미리보기 주소(…--채널.web.app)는 건드리지 않는다.
   순서 : 각 지면 <head> 의 gtag('js', …) 보다 먼저 실행돼야 한다(Consent Mode 규칙).
   안전 : 실패 시 아무 것도 하지 않음(기본 denied 유지). 필수 쿠키(로그인)는 무관.
   ============================================================ */
(function (w, d) {
  "use strict";
  if (w.LP_CONSENT) return;
  // ④ 정식 주소로 이동
  try {
    var h = w.location.hostname;
    if ((h === "lifeporfolio.web.app" || h === "lifeporfolio.firebaseapp.com") && w.location.pathname.indexOf("/__/") !== 0) {
      w.location.replace("https://lifeportfolio.co.kr" + w.location.pathname + w.location.search + w.location.hash);
      return;
    }
  } catch (_) {}
  var KEY = "lp_consent_analytics", KEY_AT = "lp_consent_analytics_at", KEY_SYNC = "lp_consent_synced_uid";
  var YEAR = 365 * 24 * 3600 * 1000;
  var FN = "https://asia-northeast3-lifeporfolio.cloudfunctions.net/";
  function gtag() { (w.dataLayer = w.dataLayer || []).push(arguments); }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (_) { return null; } }
  function read() {
    var v = ls(KEY); if (v !== "granted" && v !== "denied") return null;
    var at = parseInt(ls(KEY_AT) || "", 10);
    if (!at) { ls(KEY_AT, String(Date.now())); return v; }      // 개선 전 선택: 오늘부터 1년
    if (Date.now() - at > YEAR) { ls(KEY, null); ls(KEY_AT, null); return null; } // ① 1년 지남 → 다시 묻기
    return v;
  }
  function write(v, at) { ls(KEY, v); ls(KEY_AT, String(at || Date.now())); }
  function lang() {
    try { var q = (new URL(w.location.href).searchParams.get("lang") || "").toLowerCase(); if (q === "en" || q === "ko") return q; } catch (_) {}
    try { return ((d.documentElement.getAttribute("lang") || "ko").toLowerCase().indexOf("en") === 0) ? "en" : "ko"; } catch (_) { return "ko"; }
  }
  var T = {
    ko: { body: "더 나은 서비스를 위해 익명 통계(방문·전환)를 수집해도 될까요? 동의하지 않아도 모든 기능을 그대로 쓸 수 있어요.", ok: "동의", no: "거부", more: "자세히", moreHref: "/privacy#s10" },
    en: { body: "May we collect anonymous usage statistics (visits, conversions) to improve the service? Everything works the same if you decline.", ok: "Allow", no: "Decline", more: "Details", moreHref: "/privacy?lang=en#s10" }
  };
  var tokenFn = null;
  function call(name, data, withToken) {
    try {
      var go = function (tok) {
        var hd = { "Content-Type": "application/json" }; if (tok) hd.Authorization = "Bearer " + tok;
        return fetch(FN + name, { method: "POST", headers: hd, body: JSON.stringify({ data: data }), keepalive: true, credentials: "omit" })
          .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
      };
      if (withToken && tokenFn) return Promise.resolve(tokenFn()).then(go, function () { return go(null); });
      return go(null);
    } catch (_) { return Promise.resolve(null); }
  }

  function apply(v) {
    var granted = (v === "granted");
    gtag("consent", "update", {
      analytics_storage: granted ? "granted" : "denied",
      ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied"
    });
    try { d.dispatchEvent(new CustomEvent("lp:consentchange", { detail: { analytics: granted } })); } catch (_) {}
  }
  function removeBanner() { var b = d.getElementById("lpConsent"); if (b) { b.setAttribute("data-out", "1"); setTimeout(function () { try { b.remove(); } catch (_) {} }, 260); } }

  function decide(v) {
    var prev = ls(KEY);
    write(v); apply(v); removeBanner();
    call("recordConsentChoice", { choice: v, prev: prev === "granted" || prev === "denied" ? prev : null }, true); // ② 개수만 + ③ 회원이면 계정에도
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

  // ③ 로그인 화면이 부른다: 이 브라우저의 선택을 계정에 옮겨 적거나, 계정의 선택을 이 브라우저로 불러온다.
  function attachUser(getIdToken, uid) {
    if (typeof getIdToken !== "function") return;
    tokenFn = getIdToken;
    var v = read();
    if (v) {
      if (uid && ls(KEY_SYNC) === uid) return;
      call("recordConsentChoice", { choice: v, sync: true, at: parseInt(ls(KEY_AT) || "0", 10) || Date.now() }, true).then(function (r) { if (r && uid) ls(KEY_SYNC, uid); });
      return;
    }
    call("getMyConsent", {}, true).then(function (r) {
      var res = r && r.result;
      if (res && (res.choice === "granted" || res.choice === "denied") && !read()) { write(res.choice, res.at); apply(res.choice); removeBanner(); if (uid) ls(KEY_SYNC, uid); }
    });
  }

  w.LP_CONSENT = {
    get: read,
    set: function (v) { if (v === "granted" || v === "denied") decide(v); },
    reset: function () { ls(KEY, null); ls(KEY_AT, null); banner(); },
    attachUser: attachUser
  };

  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})(window, document);
