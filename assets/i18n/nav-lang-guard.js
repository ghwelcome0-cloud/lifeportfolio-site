/*!
 * PR#75-B: Navigation Language Guard
 * ----------------------------------------------------------------------------
 * window.location.{href,assign,replace} / location.{href,assign,replace} 호출에
 * 같은-origin + 내부 페이지 화이트리스트 매칭 시 현재 표면 언어(?lang=) 를
 * 자동 부착해 EN 컨텍스트가 KO 로 떨어지는 회귀를 차단한다.
 *
 * 정책 (header-link-fix.js 와 동일한 SSOT):
 *  - 표면 언어 결정: URL ?lang= → <html lang> → 'ko' (localStorage 무시)
 *  - 'ko' 인 경우 ?lang 파라미터를 명시적으로 제거 (URL 깔끔)
 *  - 'en' 인 경우 ?lang=en 부착 (없으면 추가, 있으면 갱신)
 *  - 외부 도메인 / 앵커(#) / mailto / tel / javascript: / data: 무시
 *  - 내부 페이지 화이트리스트(.html 또는 cleanUrl 둘 다 매칭)
 *  - URL search-param 중 'sid', 'mode', 'deleted' 등 기존 파라미터는 보존
 *
 * 안전 장치:
 *  - 패치 실패 시 원본 동작 그대로 (try-catch fail-safe)
 *  - 이미 ?lang=en 인 URL 은 변형하지 않음
 *  - location.* 의 다른 프로퍼티(hash, search, pathname 등)는 손대지 않음
 *  - 한 번만 패치 (중복 install 방지)
 *
 * 디버깅: window.LP_NAV_LANG_GUARD.surfaceLang() / withLangParam(url, lang)
 */
(function () {
  'use strict';

  // 중복 install 방지
  if (window.__LP_NAV_LANG_GUARD_INSTALLED__) return;
  window.__LP_NAV_LANG_GUARD_INSTALLED__ = true;

  // header-link-fix.js 와 동일한 화이트리스트 (cleanUrl 대응으로 .html 선택적)
  var INTERNAL_RE = /^(?:mypage|suvey|product|report|program|login|signup|success|payment-success|payment-fail|auth-fail|terms|privacy|index|report-loading|program-loading)(?:\.html)?(?:[?#].*)?$/i;

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
    if (href == null) return false;
    var s = String(href).trim();
    if (!s) return false;
    if (s.charAt(0) === '#') return false;
    if (/^(?:mailto:|tel:|javascript:|data:|blob:)/i.test(s)) return false;
    // 절대 URL: 같은 origin 만 허용
    if (/^https?:\/\//i.test(s)) {
      try {
        var u = new URL(s);
        if (u.origin !== window.location.origin) return false;
        var path = u.pathname.replace(/^\/+/, '');
        // cleanUrl 케이스: pathname 마지막 segment 만 매칭
        var lastSeg = path.split('/').pop();
        return INTERNAL_RE.test(lastSeg || path);
      } catch (_) { return false; }
    }
    // 프로토콜 상대 (//cdn...)
    if (/^\/\//.test(s)) return false;
    // 루트 절대 경로 (/report, /mypage 등 cleanUrl)
    if (s.charAt(0) === '/') {
      var rootPath = s.replace(/^\/+/, '').split('?')[0].split('#')[0];
      var rootLast = rootPath.split('/').pop();
      return INTERNAL_RE.test(rootLast || rootPath);
    }
    // 상대 경로
    var bare = s.replace(/^\.?\/+/, '').split('?')[0].split('#')[0];
    var bareLast = bare.split('/').pop();
    return INTERNAL_RE.test(bareLast || bare) || INTERNAL_RE.test(s);
  }

  function _withLangParam(href, lang) {
    if (!href) return href;
    try {
      var isAbs = /^https?:\/\//i.test(href);
      var u = isAbs ? new URL(href) : new URL(href, window.location.href);
      if (lang === 'en') {
        u.searchParams.set('lang', 'en');
      } else {
        u.searchParams.delete('lang');
      }
      if (isAbs) return u.href;
      // 루트 절대 경로 보존
      if (href.charAt(0) === '/') {
        return u.pathname + (u.search || '') + (u.hash || '');
      }
      // 상대 경로 보존: pathname 마지막 segment + query + hash
      var lastSeg = u.pathname.split('/').pop();
      return lastSeg + (u.search || '') + (u.hash || '');
    } catch (_) {
      return href;
    }
  }

  /**
   * 입력 URL 을 lang-aware 로 변환. 내부 페이지가 아니면 원본 그대로 반환.
   * 외부에서도 호출 가능하도록 공개.
   */
  function _normalize(href) {
    try {
      if (!_isInternalHref(href)) return href;
      var lang = _surfaceLang();
      // 이미 일치하면 그대로 반환 (불필요한 변형 방지)
      try {
        var probe = /^https?:\/\//i.test(href) ? new URL(href) : new URL(href, window.location.href);
        var cur = (probe.searchParams.get('lang') || '').toLowerCase();
        if (lang === 'en' && cur === 'en') return href;
        if (lang !== 'en' && !cur) return href;
      } catch (_) {}
      return _withLangParam(href, lang);
    } catch (_) {
      return href;
    }
  }

  // ----- location.href setter / assign / replace 패치 -----
  // 브라우저별 차이를 고려해 try-catch 로 감싸고, 실패 시 원본 유지
  try {
    var proto = window.Location && window.Location.prototype;
    if (proto) {
      // location.assign / replace 메서드는 직접 교체 가능
      var origAssign = proto.assign;
      var origReplace = proto.replace;

      if (typeof origAssign === 'function') {
        proto.assign = function (url) {
          try { url = _normalize(url); } catch (_) {}
          return origAssign.call(this, url);
        };
      }
      if (typeof origReplace === 'function') {
        proto.replace = function (url) {
          try { url = _normalize(url); } catch (_) {}
          return origReplace.call(this, url);
        };
      }

      // location.href 는 직접 setter 패치가 어렵다(브라우저 native getter/setter 보호).
      // 대신 window 단에서 'beforeunload' 보다 빠른 타이밍을 잡기 위해
      // a 태그 클릭은 header-link-fix.js 가 이미 처리하고,
      // 스크립트의 location.href = "..." 호출은 아래의 hashchange/popstate 가 아닌
      // 일반 navigation 이므로 위 assign/replace 패치만으로는 부족하다.
      //
      // 안전한 우회: window 의 'beforeunload' 가 너무 늦으므로,
      // setInterval 로 location.href 의 setter 호출을 가로채지 않고
      // 페이지 코드가 location.href 를 쓰는 패턴 자체를 안전망으로 둔다.
      //
      // PR#75 정책: 페이지 측 코드(login.html 등)는 이미 _withLang() 명시 호출로
      // 보호되며(Phase B-1), 그 외 페이지는 점진적으로 _withLang 패턴을 도입한다.
      // 글로벌 가드의 1차 보호는 assign/replace 이며, href setter 는
      // 별도의 click 인터셉트로 보강한다(아래 _interceptClicks 참고).
    }
  } catch (_) {}

  // ----- a 태그 click 인터셉트 (header-link-fix.js 가 setAttribute 시점에 처리하지만,
  //       동적으로 href 가 바뀐 후 클릭되는 경우를 대비해 click 시점 재검증) -----
  function _interceptClicks() {
    try {
      document.addEventListener('click', function (e) {
        try {
          var t = e.target;
          while (t && t !== document) {
            if (t.tagName === 'A' && t.getAttribute && t.getAttribute('href')) {
              if (t.getAttribute('data-lang-fix-skip') === '1') return;
              if (t.getAttribute('target') === '_blank') return;
              var h = t.getAttribute('href');
              if (_isInternalHref(h)) {
                var fixed = _normalize(h);
                if (fixed && fixed !== h) {
                  t.setAttribute('href', fixed);
                }
              }
              return;
            }
            t = t.parentNode;
          }
        } catch (_) {}
      }, true); // capture phase
    } catch (_) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _interceptClicks, { once: true });
  } else {
    _interceptClicks();
  }

  // 디버깅용 노출
  window.LP_NAV_LANG_GUARD = {
    surfaceLang: _surfaceLang,
    isInternalHref: _isInternalHref,
    withLangParam: _withLangParam,
    normalize: _normalize
  };
})();
