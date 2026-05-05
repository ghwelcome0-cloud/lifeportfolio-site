/*!
 * PR#37: Header Internal Link Language Fixer
 * ----------------------------------------------------------------------------
 * 모든 페이지의 내부 이동 링크에 현재 표면 언어(?lang=)를 자동 부착해
 * "EN 페이지에서 My Page 클릭 시 KO 마이페이지로 떨어지는" 회귀를 차단한다.
 *
 * 정책:
 *  - 표면 언어 결정: URL ?lang= → <html lang> → 'ko' (localStorage 무시)
 *  - 'ko' 인 경우 ?lang 파라미터를 명시적으로 제거 (URL 깔끔)
 *  - 'en' 인 경우 ?lang=en 부착 (없으면 추가, 있으면 갱신)
 *  - 동적으로 추가되는 노드에도 적용 (MutationObserver)
 *  - 외부 도메인 / 앵커(#) / mailto / tel / javascript: / 절대 경로 외부 URL 무시
 *  - 내부 페이지 화이트리스트: mypage|suvey|product|report|program|login|signup|
 *                              success|payment-success|payment-fail|auth-fail|
 *                              terms|privacy|index|report-loading|program-loading
 */
(function () {
  'use strict';

  var INTERNAL_RE = /^(?:mypage|suvey|product|report|program|login|signup|success|payment-success|payment-fail|auth-fail|terms|privacy|index|report-loading|program-loading)\.html(?:[?#].*)?$/i;

  function _surfaceLang() {
    try {
      var u = new URL(window.location.href);
      var qs = (u.searchParams.get('lang') || '').toLowerCase();
      if (qs === 'ko' || qs === 'en') return qs;
    } catch (_) {}
    try {
      var hl = (document.documentElement.getAttribute('lang') || '').toLowerCase();
      if (hl.indexOf('en') === 0) return 'en';
      if (hl.indexOf('ko') === 0) return 'ko';
    } catch (_) {}
    return 'ko';
  }

  function _isInternalHref(href) {
    if (!href) return false;
    var s = String(href).trim();
    if (!s) return false;
    if (s.charAt(0) === '#') return false;
    if (/^(?:mailto:|tel:|javascript:|data:)/i.test(s)) return false;
    // 절대 URL: 같은 origin 만 허용
    if (/^https?:\/\//i.test(s)) {
      try {
        var u = new URL(s);
        if (u.origin !== window.location.origin) return false;
        // 같은 origin 의 절대 URL은 path 만 추출해 검사
        var path = u.pathname.replace(/^\/+/, '');
        return INTERNAL_RE.test(path);
      } catch (_) { return false; }
    }
    // 상대 경로
    var bare = s.replace(/^\.?\/+/, '').split('?')[0].split('#')[0];
    return INTERNAL_RE.test(bare) || INTERNAL_RE.test(s);
  }

  function _withLangParam(href, lang) {
    try {
      var isAbs = /^https?:\/\//i.test(href);
      var u = isAbs ? new URL(href) : new URL(href, window.location.href);
      if (lang === 'en') {
        u.searchParams.set('lang', 'en');
      } else {
        u.searchParams.delete('lang');
      }
      if (isAbs) {
        return u.href;
      }
      // 상대 경로 보존: pathname 마지막 segment + query + hash
      var lastSeg = u.pathname.split('/').pop();
      return lastSeg + (u.search || '') + (u.hash || '');
    } catch (_) {
      return href;
    }
  }

  function _fixAnchor(a, lang) {
    if (!a || !a.getAttribute) return;
    if (a.getAttribute('data-lang-fix-skip') === '1') return;
    var href = a.getAttribute('href');
    if (!_isInternalHref(href)) return;
    var fixed = _withLangParam(href, lang);
    if (fixed && fixed !== href) {
      a.setAttribute('href', fixed);
    }
  }

  function _fixAll() {
    var lang = _surfaceLang();
    var anchors = document.querySelectorAll('a[href]');
    for (var i = 0; i < anchors.length; i++) {
      _fixAnchor(anchors[i], lang);
    }
  }

  // 초기 적용
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _fixAll);
  } else {
    _fixAll();
  }

  // 동적 추가 노드 대응
  try {
    var mo = new MutationObserver(function (muts) {
      var lang = _surfaceLang();
      for (var i = 0; i < muts.length; i++) {
        var nodes = muts[i].addedNodes;
        if (!nodes) continue;
        for (var j = 0; j < nodes.length; j++) {
          var n = nodes[j];
          if (!n || n.nodeType !== 1) continue;
          if (n.tagName === 'A') {
            _fixAnchor(n, lang);
          } else if (n.querySelectorAll) {
            var inner = n.querySelectorAll('a[href]');
            for (var k = 0; k < inner.length; k++) _fixAnchor(inner[k], lang);
          }
        }
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  } catch (_) {}

  // 언어 토글로 페이지 내부에서 lang 이 바뀐 경우(드물지만) 재적용
  try {
    document.addEventListener('lp:langchange', _fixAll);
  } catch (_) {}

  // 디버깅용 노출
  window.LP_HEADER_LINK_FIX = {
    surfaceLang: _surfaceLang,
    fixAll: _fixAll,
    withLangParam: _withLangParam
  };
})();
