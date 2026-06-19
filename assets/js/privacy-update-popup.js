/**
 * 개인정보처리방침 개정 고지 팝업 (Life Portfolio)
 * =====================================================================
 * - 법적 근거: 개인정보 보호법 제30조 — 처리방침 변경 시 변경 전·후를
 *   정보주체가 확인할 수 있도록 공개. 본 개정은 위탁 현황 정정·축소이므로
 *   일반(7일) 고지 룰 적용.
 * - 게시 기간: 공지 시작일 ~ 종료일(시작 + 7일) 사이에만 노출.
 *   종료일이 지나면 스크립트가 아무것도 렌더링하지 않고 자연 소멸한다.
 * - 언어: document.documentElement.lang ('en'이면 영문, 그 외 한글) 자동 분기.
 *   (한·영 서비스 동시 운영 대응)
 * - "오늘 하루 보지 않기" / "닫기": localStorage로 노출 제어.
 *   ※ 게시 기간 자체가 끝나면 localStorage와 무관하게 노출되지 않음.
 *
 * 적용: 각 페이지 </body> 직전에
 *   <script src="/assets/js/privacy-update-popup.js" defer></script>
 * 한 줄만 추가하면 자동 동작.
 */
(function () {
  'use strict';

  // ── 게시 기간 (법정 최소 고지기간 7일) ─────────────────────────────
  // 개인정보 보호법 제30조 / 본 서비스 약관(시행일 7일 전 공지)에 따른
  // 최소 고지기간을 충족하도록 "시행일(2026-06-19)부터 만 7일간" 게시한다.
  //   게시: 2026-06-19 00:00 ~ 2026-06-25 23:59:59 (KST) = 6/19,20,21,22,23,24,25 (7일)
  //   종료일이 지나면 스크립트가 아무것도 렌더링하지 않고 자연 소멸한다.
  // KST(UTC+9) 기준 시각을 UTC로 환산하여 비교.
  var START_UTC = Date.parse('2026-06-18T15:00:00Z'); // 2026-06-19 00:00:00 KST
  var END_UTC   = Date.parse('2026-06-25T14:59:59Z'); // 2026-06-25 23:59:59 KST

  var STORAGE_KEY = 'lp_privacy_notice_2026_06_19'; // "다시 보지 않기" 플래그
  var PRIVACY_URL = '/privacy.html';
  var B2B_PRIVACY_URL = '/b2b-privacy.html';

  // ── 1) 게시 기간 검증 (지나면 자연 소멸) ───────────────────────────
  var now = Date.now();
  if (isNaN(START_UTC) || isNaN(END_UTC) || now < START_UTC || now > END_UTC) {
    return; // 게시 기간 밖 → 아무것도 하지 않음
  }

  // ── 2) "다시 보지 않기" 확인 ───────────────────────────────────────
  try {
    var dismissedUntil = localStorage.getItem(STORAGE_KEY);
    if (dismissedUntil && now < parseInt(dismissedUntil, 10)) {
      return; // 사용자가 오늘 하루 보지 않기를 선택함
    }
  } catch (e) { /* private mode 등 — 무시하고 표시 */ }

  // ── 3) 언어 결정 ──────────────────────────────────────────────────
  // SSOT 우선순위: window.LP_I18N.lang(i18n.js의 단일 진실 공급원) →
  //   document.documentElement.lang(boot 시 ASAP 세팅) → 'ko' 폴백.
  // 본 사이트는 언어 전환을 URL navigation(?lang=)으로 처리하므로, 팝업이
  // 렌더되는 시점(DOM ready + 600ms)에는 위 값이 이미 확정되어 있다.
  function resolveLang() {
    try {
      if (window.LP_I18N && typeof window.LP_I18N.lang === 'string' && window.LP_I18N.lang) {
        return window.LP_I18N.lang.toLowerCase();
      }
    } catch (e) { /* 무시 */ }
    return (document.documentElement.lang || 'ko').toLowerCase();
  }
  var isEn = resolveLang().indexOf('en') === 0;

  // 언어별 문구
  var T = isEn ? {
    badge: 'PRIVACY POLICY UPDATE',
    title: 'Notice of Privacy Policy Update',
    intro: 'We have updated our Privacy Policy. Key changes are summarized below.',
    items: [
      'Web hosting processor corrected: GitHub Pages → Google LLC (Firebase Hosting).',
      'Survey collection (Google Forms) limited to emergency use only.',
      'Removed unused advertising tracking domains (Meta/Facebook Pixel).',
      '[B2B] Removed an unused processor and specified the privacy officer.'
    ],
    effective: 'Effective date: June 19, 2026',
    notice: 'This notice is posted for 7 days (June 19 – June 25, 2026) and will disappear automatically thereafter.',
    viewFull: 'View full Privacy Policy',
    viewB2B: 'B2B Privacy Policy',
    dontShow: "Don't show again today",
    close: 'Close'
  } : {
    badge: '개인정보처리방침 개정',
    title: '개인정보처리방침 개정 안내',
    intro: '개인정보처리방침이 아래와 같이 개정되었습니다. 주요 변경사항을 확인해 주세요.',
    items: [
      '웹 호스팅 수탁업체 정정: GitHub Pages → Google LLC (Firebase Hosting)',
      '설문 수집(Google Forms) 이용 범위를 긴급 시 한정으로 명확화',
      '미사용 광고 추적 도메인(Meta/Facebook 픽셀) 정리(삭제)',
      '[기업용] 미사용 위탁사 정리 및 개인정보 보호책임자 명시'
    ],
    effective: '시행일: 2026년 6월 19일',
    notice: '본 안내는 법정 고지기간인 7일간(2026년 6월 19일 ~ 6월 25일) 게시되며, 이후 자동으로 사라집니다.',
    viewFull: '개인정보처리방침 전문 보기',
    viewB2B: '기업용(B2B) 처리방침',
    dontShow: '오늘 하루 보지 않기',
    close: '닫기'
  };

  // ── 4) DOM 렌더링 ─────────────────────────────────────────────────
  function render() {
    if (document.getElementById('lp-privacy-notice-overlay')) return;

    var overlay = document.createElement('div');
    overlay.id = 'lp-privacy-notice-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'lp-privacy-notice-title');

    var itemsHtml = T.items.map(function (it) {
      return '<li style="margin:0 0 8px;padding-left:4px;">' + escapeHtml(it) + '</li>';
    }).join('');

    overlay.innerHTML = [
      '<div class="lp-pn-backdrop"></div>',
      '<div class="lp-pn-card" role="document">',
      '  <div class="lp-pn-head">',
      '    <div class="lp-pn-badge">' + escapeHtml(T.badge) + '</div>',
      '    <h2 id="lp-privacy-notice-title" class="lp-pn-title">' + escapeHtml(T.title) + '</h2>',
      '  </div>',
      '  <div class="lp-pn-body">',
      '    <p class="lp-pn-intro">' + escapeHtml(T.intro) + '</p>',
      '    <ul class="lp-pn-list">' + itemsHtml + '</ul>',
      '    <p class="lp-pn-eff">' + escapeHtml(T.effective) + '</p>',
      '    <p class="lp-pn-notice">' + escapeHtml(T.notice) + '</p>',
      '    <div class="lp-pn-links">',
      '      <a href="' + PRIVACY_URL + '" class="lp-pn-link">' + escapeHtml(T.viewFull) + '</a>',
      '      <a href="' + B2B_PRIVACY_URL + '" class="lp-pn-link lp-pn-link-sub">' + escapeHtml(T.viewB2B) + '</a>',
      '    </div>',
      '  </div>',
      '  <div class="lp-pn-foot">',
      '    <button type="button" class="lp-pn-btn lp-pn-btn-ghost" id="lp-pn-dontshow">' + escapeHtml(T.dontShow) + '</button>',
      '    <button type="button" class="lp-pn-btn lp-pn-btn-primary" id="lp-pn-close">' + escapeHtml(T.close) + '</button>',
      '  </div>',
      '</div>'
    ].join('');

    injectStyle();
    document.body.appendChild(overlay);

    // 이벤트
    function closePopup() {
      var el = document.getElementById('lp-privacy-notice-overlay');
      if (el && el.parentNode) el.parentNode.removeChild(el);
      document.removeEventListener('keydown', onKey);
    }
    function dontShowToday() {
      try {
        // 다음날 00:00 KST 까지 숨김
        var ms = 24 * 60 * 60 * 1000;
        localStorage.setItem(STORAGE_KEY, String(Date.now() + ms));
      } catch (e) { /* 무시 */ }
      closePopup();
    }
    function onKey(e) { if (e.key === 'Escape') closePopup(); }

    overlay.querySelector('.lp-pn-backdrop').addEventListener('click', closePopup);
    document.getElementById('lp-pn-close').addEventListener('click', closePopup);
    document.getElementById('lp-pn-dontshow').addEventListener('click', dontShowToday);
    document.addEventListener('keydown', onKey);

    // 포커스 이동(접근성)
    var firstBtn = document.getElementById('lp-pn-close');
    if (firstBtn) firstBtn.focus();
  }

  function escapeHtml(s) {
    return (s == null ? '' : String(s))
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function injectStyle() {
    if (document.getElementById('lp-privacy-notice-style')) return;
    var css = ''
      + '#lp-privacy-notice-overlay{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px;}'
      + '#lp-privacy-notice-overlay .lp-pn-backdrop{position:absolute;inset:0;background:rgba(15,23,42,.55);backdrop-filter:saturate(120%) blur(2px);}'
      + '#lp-privacy-notice-overlay .lp-pn-card{position:relative;width:100%;max-width:480px;max-height:88vh;overflow:auto;background:#fff;border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,.35);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;animation:lp-pn-in .22s ease-out;}'
      + '@keyframes lp-pn-in{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}'
      + '#lp-privacy-notice-overlay .lp-pn-head{background:#0f172a;border-radius:16px 16px 0 0;padding:22px 24px 18px;}'
      + '#lp-privacy-notice-overlay .lp-pn-badge{color:#93c5fd;font-size:11px;letter-spacing:1.5px;font-weight:800;}'
      + '#lp-privacy-notice-overlay .lp-pn-title{color:#fff;font-size:18px;font-weight:800;margin:8px 0 0;line-height:1.4;}'
      + '#lp-privacy-notice-overlay .lp-pn-body{padding:20px 24px 8px;}'
      + '#lp-privacy-notice-overlay .lp-pn-intro{color:#374151;font-size:14px;line-height:1.65;margin:0 0 14px;}'
      + '#lp-privacy-notice-overlay .lp-pn-list{margin:0 0 14px;padding-left:18px;color:#111827;font-size:14px;line-height:1.6;}'
      + '#lp-privacy-notice-overlay .lp-pn-eff{margin:0 0 6px;color:#2563eb;font-weight:700;font-size:13.5px;}'
      + '#lp-privacy-notice-overlay .lp-pn-notice{margin:0 0 14px;color:#6b7280;font-size:12px;line-height:1.55;}'
      + '#lp-privacy-notice-overlay .lp-pn-links{display:flex;flex-wrap:wrap;gap:8px 16px;margin:0 0 4px;}'
      + '#lp-privacy-notice-overlay .lp-pn-link{color:#2563eb;font-weight:700;font-size:13.5px;text-decoration:none;}'
      + '#lp-privacy-notice-overlay .lp-pn-link:hover{text-decoration:underline;}'
      + '#lp-privacy-notice-overlay .lp-pn-link-sub{color:#6b7280;font-weight:600;}'
      + '#lp-privacy-notice-overlay .lp-pn-foot{display:flex;gap:10px;padding:14px 24px 22px;}'
      + '#lp-privacy-notice-overlay .lp-pn-btn{flex:1;padding:12px 14px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;border:none;transition:opacity .15s;}'
      + '#lp-privacy-notice-overlay .lp-pn-btn:hover{opacity:.9;}'
      + '#lp-privacy-notice-overlay .lp-pn-btn-ghost{background:#f3f4f6;color:#374151;}'
      + '#lp-privacy-notice-overlay .lp-pn-btn-primary{background:#2563eb;color:#fff;}'
      + '@media (max-width:380px){#lp-privacy-notice-overlay .lp-pn-foot{flex-direction:column;}}';
    var style = document.createElement('style');
    style.id = 'lp-privacy-notice-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ── 5) 실행 (DOM ready 후 약간 지연 노출) ──────────────────────────
  function start() { setTimeout(render, 600); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
