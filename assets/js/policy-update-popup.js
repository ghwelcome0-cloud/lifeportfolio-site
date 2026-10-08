/**
 * 이용약관 · 개인정보처리방침 개정 안내 — 작은 안내창 (2026-10-16 시행)
 * ---------------------------------------------------------------------
 * - 게시: 2026-10-09 00:00 ~ 2026-10-15 23:59:59 (KST, 만 7일). 기간 밖이면 아무것도 그리지 않고 자동 소멸.
 *   날짜·문구의 단일 출처: functions/emails/policy-update-2026-10-16.js (scripts/test-policy-notice.cjs 가 일치를 검사)
 * - 화면을 가리지 않는 작은 카드(오른쪽 아래, 휴대폰은 아래쪽). 배경을 막지 않는다.
 * - 「닫기」: 이번 방문 동안 숨김 / 「다시 보지 않기」: 이 기기에서 이 개정 안내를 다시 띄우지 않음.
 * - 미리보기: 주소 끝에 ?policy_notice=preview 를 붙이면 기간과 관계없이 보인다(운영자 확인용).
 */
(function () {
  "use strict";
  var START = Date.parse("2026-10-09T00:00:00+09:00");
  var END = Date.parse("2026-10-15T23:59:59+09:00");
  var KEY = "lp_policy_notice_2026_10_16";
  var preview = /[?&]policy_notice=preview\b/.test(location.search);
  var now = Date.now();
  if (!preview && (isNaN(START) || isNaN(END) || now < START || now > END)) return;
  try { if (!preview && (localStorage.getItem(KEY) === "hide" || sessionStorage.getItem(KEY) === "closed")) return; } catch (e) {}

  var lang = "ko";
  try { lang = ((window.LP_I18N && window.LP_I18N.lang) || document.documentElement.lang || "ko").toLowerCase(); } catch (e) {}
  var en = lang.indexOf("en") === 0;
  var T = en ? {
    title: "Updated Terms & Privacy Policy",
    body: "With the launch of My Diary, we updated our Terms and Privacy Policy. What you write in your Diary is yours; distributing the blank forms on their own is restricted.",
    eff: "Terms effective October 16, 2026 · Privacy Policy effective October 9, 2026",
    obj: "If you do not agree, tell us or withdraw before October 16, 2026; otherwise you are deemed to accept the revised Terms.",
    terms: "Terms", privacy: "Privacy Policy", close: "Close", hide: "Don't show again"
  } : {
    title: "이용약관 · 개인정보처리방침 개정 안내",
    body: "「나의 다이어리」 출시에 맞춰 이용약관과 개인정보처리방침을 개정합니다. 직접 쓰신 기록은 회원님의 것이며, 다이어리 양식만 따로 떼어 배포하는 것은 제한됩니다.",
    eff: "이용약관 2026년 10월 16일 시행 · 개인정보처리방침 2026년 10월 9일 시행",
    obj: "동의하지 않으시면 2026년 10월 16일 전까지 문의처로 알려 주시거나 탈퇴하실 수 있으며, 그때까지 거부 의사가 없으면 개정 약관에 동의하신 것으로 봅니다.",
    terms: "이용약관", privacy: "개인정보처리방침", close: "닫기", hide: "다시 보지 않기"
  };

  function render() {
    if (document.getElementById("lp-policy-notice")) return;
    var box = document.createElement("aside");
    box.id = "lp-policy-notice";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "false");
    box.setAttribute("aria-labelledby", "lp-policy-notice-t");
    box.innerHTML =
      '<p class="lpn-k">' + (en ? "NOTICE" : "알림") + '</p>' +
      '<h2 id="lp-policy-notice-t" class="lpn-t">' + T.title + "</h2>" +
      '<p class="lpn-b">' + T.body + "</p>" +
      '<p class="lpn-e">' + T.eff + "</p>" + '<p class="lpn-o">' + T.obj + "</p>" +
      '<p class="lpn-l"><a href="/terms">' + T.terms + ' ›</a><a href="/privacy">' + T.privacy + " ›</a></p>" +
      '<div class="lpn-f"><button type="button" class="lpn-hide">' + T.hide + '</button><button type="button" class="lpn-close">' + T.close + "</button></div>";
    var st = document.createElement("style");
    st.textContent =
      "#lp-policy-notice{position:fixed;right:16px;bottom:16px;z-index:2147482000;width:min(340px,calc(100vw - 32px));background:#fff;color:#222;border:1px solid #e3dccb;border-top:3px solid #0A3D2A;border-radius:14px;box-shadow:0 12px 36px rgba(0,0,0,.18);padding:16px 18px 12px;font-family:Pretendard,-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;word-break:keep-all;overflow-wrap:break-word;line-height:1.55;animation:lpn-in .2s ease-out}" +
      "@keyframes lpn-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}" +
      "@media (prefers-reduced-motion:reduce){#lp-policy-notice{animation:none}}" +
      "#lp-policy-notice .lpn-k{margin:0;font-size:11px;font-weight:800;letter-spacing:.12em;color:#7d5f22}" +
      "#lp-policy-notice .lpn-t{margin:4px 0 6px;font-size:15.5px;font-weight:800;color:#0A3D2A;text-wrap:balance}" +
      "#lp-policy-notice .lpn-b{margin:0 0 6px;font-size:13.5px;color:#454545;text-wrap:pretty}" +
      "#lp-policy-notice .lpn-e{margin:0 0 8px;font-size:13px;font-weight:700;color:#0A3D2A}" +
      "#lp-policy-notice .lpn-o{margin:0 0 8px;font-size:12px;color:#666;text-wrap:pretty}" +
      "#lp-policy-notice .lpn-l{margin:0 0 6px;display:flex;flex-wrap:wrap;gap:4px 14px}" +
      "#lp-policy-notice .lpn-l a{display:inline-flex;align-items:center;min-height:32px;font-size:13.5px;font-weight:700;color:#0A3D2A;text-decoration:underline;text-underline-offset:3px}" +
      "#lp-policy-notice .lpn-f{display:flex;justify-content:flex-end;gap:6px;border-top:1px solid #efe9dc;padding-top:8px}" +
      "#lp-policy-notice button{min-height:40px;padding:0 12px;border-radius:10px;font:inherit;font-size:13px;font-weight:700;cursor:pointer}" +
      "#lp-policy-notice .lpn-hide{background:transparent;border:0;color:#666}" +
      "#lp-policy-notice .lpn-close{background:#0A3D2A;border:0;color:#fff}" +
      "#lp-policy-notice button:focus-visible,#lp-policy-notice a:focus-visible{outline:3px solid #C9A04F;outline-offset:2px}" +
      "@media (max-width:520px){#lp-policy-notice{left:12px;right:12px;bottom:12px;width:auto;max-height:38vh;overflow-y:auto;padding:12px 14px 8px}#lp-policy-notice .lpn-t{font-size:14.5px}#lp-policy-notice .lpn-b{font-size:13px}#lp-policy-notice .lpn-f{position:sticky;bottom:-8px;background:#fff}}" +
      "@media print{#lp-policy-notice{display:none}}";
    document.head.appendChild(st);
    document.body.appendChild(box);
    function close(hide) {
      try { if (hide) localStorage.setItem(KEY, "hide"); else sessionStorage.setItem(KEY, "closed"); } catch (e) {}
      if (box.parentNode) box.parentNode.removeChild(box);
      document.removeEventListener("keydown", onKey);
    }
    function onKey(e) { if (e.key === "Escape") close(false); }
    box.querySelector(".lpn-close").addEventListener("click", function () { close(false); });
    box.querySelector(".lpn-hide").addEventListener("click", function () { close(true); });
    document.addEventListener("keydown", onKey);
  }
  // 분석 도구 동의 배너(#lpConsent, 화면 아래)가 떠 있으면 서로 겹치지 않도록 그 선택이 끝난 뒤 띄운다.
  function start() {
    setTimeout(function () {
      var c = document.getElementById("lpConsent");
      if (!c) return render();
      var done = false;
      var go = function () { if (done) return; done = true; setTimeout(render, 320); };
      document.addEventListener("lp:consentchange", go, { once: true });
      var mo = new MutationObserver(function () { if (!document.getElementById("lpConsent")) { mo.disconnect(); go(); } });
      mo.observe(document.body, { childList: true });
    }, 700);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
