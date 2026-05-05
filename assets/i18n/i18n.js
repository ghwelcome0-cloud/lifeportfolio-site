/* =========================================================
 * Life Portfolio i18n (lightweight, no dependencies)
 * ---------------------------------------------------------
 * - Reads ?lang=en|ko from URL (highest priority)
 * - Falls back to localStorage('lp_lang')
 * - Falls back to navigator.language (auto-detect)
 * - Default: 'ko'
 *
 * Usage in HTML:
 *   <span data-i18n="hero.title">한글 기본 텍스트</span>
 *   <input data-i18n-attr="placeholder" data-i18n="form.email_ph" placeholder="이메일">
 *   <meta data-i18n-attr="content" data-i18n="meta.description" content="...">
 *   <html lang="ko"> ← updated automatically
 *
 * Public API:
 *   window.LP_I18N.lang             // current lang
 *   window.LP_I18N.t('key.path')    // translate
 *   window.LP_I18N.setLang('en')    // switch lang + persist + re-render
 *   window.LP_I18N.onReady(cb)      // run cb after dictionary loaded
 *
 * Dictionary loading:
 *   - Inline dictionaries can be embedded via window.LP_I18N_DICT = { ko:{...}, en:{...} }
 *   - Or fetched from /assets/i18n/{ko,en}.json
 * ========================================================= */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'lp_lang';
  var SUPPORTED   = ['ko', 'en'];
  var DEFAULT     = 'ko';

  // ---------- Lang resolver ----------
  // PR#36: Single Source of Truth (SSOT) for language
  //   1) URL ?lang= (read-only — never write to localStorage from here)
  //   2) <html lang> attribute (explicit page-level lock)
  //   3) localStorage('lp_lang')  ← read-only fallback, kept for back-compat
  //   4) navigator.language
  //   5) DEFAULT ('ko')
  // Critical: PR#34/#35 회귀의 단일 원인은 resolveLang() 가 URL 값을 받자마자
  // localStorage 에 자동 write 했던 점이다 → KO 사용자가 한 번이라도 EN URL 로
  // 진입하면 그 후 모든 페이지가 EN 으로 굳어버렸다. write 를 완전히 제거한다.
  function resolveLang() {
    try {
      var url = new URL(window.location.href);
      var qs  = (url.searchParams.get('lang') || '').toLowerCase();
      if (SUPPORTED.indexOf(qs) >= 0) return qs;
    } catch (_) {}
    try {
      var hl = (document.documentElement.getAttribute('lang') || '').toLowerCase();
      if (hl.indexOf('en') === 0) return 'en';
      if (hl.indexOf('ko') === 0) return 'ko';
    } catch (_) {}
    try {
      var saved = (localStorage.getItem(STORAGE_KEY) || '').toLowerCase();
      if (SUPPORTED.indexOf(saved) >= 0) return saved;
    } catch (_) {}
    try {
      var nav = (navigator.language || navigator.userLanguage || '').toLowerCase();
      if (nav.indexOf('en') === 0) return 'en';
      if (nav.indexOf('ko') === 0) return 'ko';
    } catch (_) {}
    return DEFAULT;
  }

  // ---------- Dot-path lookup ----------
  function deepGet(obj, path) {
    if (!obj || !path) return undefined;
    var parts = String(path).split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  // ---------- Dictionary loader ----------
  function loadDict() {
    if (global.LP_I18N_DICT && typeof global.LP_I18N_DICT === 'object') {
      return Promise.resolve(global.LP_I18N_DICT);
    }
    // Fallback: fetch json files (relative to root)
    var base = '/assets/i18n/';
    function fetchOne(lc) {
      return fetch(base + lc + '.json', { cache: 'no-cache' })
        .then(function (r) { return r.ok ? r.json() : {}; })
        .catch(function () { return {}; });
    }
    return Promise.all([fetchOne('ko'), fetchOne('en')]).then(function (arr) {
      return { ko: arr[0] || {}, en: arr[1] || {} };
    });
  }

  // ---------- State ----------
  var state = {
    lang: resolveLang(),
    dict: null,
    readyCbs: []
  };

  function t(key, fallback) {
    if (!state.dict) return fallback != null ? fallback : key;
    var d = state.dict[state.lang] || {};
    var v = deepGet(d, key);
    if (v == null) {
      // fallback to ko
      v = deepGet(state.dict.ko || {}, key);
    }
    return v != null ? v : (fallback != null ? fallback : key);
  }

  // ---------- DOM apply ----------
  function applyToNode(node) {
    // Pattern A: data-i18n-html="key.path" → innerHTML (key carried by html attr)
    // Pattern B: data-i18n="key" + data-i18n-html="true" → innerHTML (legacy)
    // Pattern C: data-i18n="key" + data-i18n-attr="placeholder" → setAttribute
    // Pattern D: data-i18n="key" → textContent
    var htmlAttr = node.getAttribute('data-i18n-html');
    var key = node.getAttribute('data-i18n');

    // Pattern A: data-i18n-html holds a real key path (contains '.' or non-true)
    if (htmlAttr && htmlAttr !== 'true') {
      var hv = t(htmlAttr, null);
      if (hv != null) node.innerHTML = hv;
      // also handle data-i18n attr if present (rare, but allow)
      if (key && key !== htmlAttr) {
        var v2 = t(key, null);
        if (v2 != null) node.textContent = v2;
      }
      return;
    }

    if (!key) return;
    var val = t(key, null);
    if (val == null) return;

    var attr = node.getAttribute('data-i18n-attr');
    if (attr) {
      node.setAttribute(attr, val);
    } else {
      // Pattern B: legacy data-i18n-html="true"
      if (htmlAttr === 'true') {
        node.innerHTML = val;
      } else {
        node.textContent = val;
      }
    }

    // Pattern E (extension): data-i18n-title="key.path" applies to title attr
    // independently of the main data-i18n behavior. This lets a single button
    // render its visible label via data-i18n (textContent) and its tooltip
    // via data-i18n-title at the same time.
    var titleKey = node.getAttribute('data-i18n-title');
    if (titleKey) {
      var titleVal = t(titleKey, null);
      if (titleVal != null) node.setAttribute('title', titleVal);
    }
  }

  function applyAll(root) {
    var scope = root || document;
    // Catch both data-i18n and data-i18n-html-only nodes
    var nodes = scope.querySelectorAll('[data-i18n], [data-i18n-html], [data-i18n-title]');
    for (var i = 0; i < nodes.length; i++) applyToNode(nodes[i]);

    // Update <html lang="..">
    try {
      document.documentElement.setAttribute('lang', state.lang);
    } catch (_) {}

    // Update <title> if it has data-i18n
    var titleEl = document.querySelector('title[data-i18n]');
    if (titleEl) applyToNode(titleEl);

    // Toggle visibility of language-specific blocks
    // [data-lang-only="en"] visible only when lang=en, etc.
    var only = document.querySelectorAll('[data-lang-only]');
    for (var j = 0; j < only.length; j++) {
      var want = only[j].getAttribute('data-lang-only');
      only[j].style.display = (want === state.lang) ? '' : 'none';
    }

    // Sync language toggle button(s) UI
    var toggles = document.querySelectorAll('[data-i18n-toggle]');
    for (var k = 0; k < toggles.length; k++) {
      var tBtn = toggles[k];
      tBtn.setAttribute('aria-pressed', tBtn.getAttribute('data-i18n-toggle') === state.lang ? 'true' : 'false');
      if (tBtn.classList) {
        if (tBtn.getAttribute('data-i18n-toggle') === state.lang) tBtn.classList.add('is-active');
        else tBtn.classList.remove('is-active');
      }
    }
  }

  // PR#36: setLang 의 기본 동작을 persist=false 로 변경.
  //   - 호출자가 명시적으로 { persist: true } 를 넘긴 경우에만 localStorage 에 저장.
  //   - 토글 클릭은 URL navigation 으로 처리하므로 더 이상 localStorage 의존이 필요 없다.
  //   - opts.silent === true 인 경우 lp:langchange 이벤트도 발화하지 않는다.
  function setLang(lc, opts) {
    if (SUPPORTED.indexOf(lc) < 0) return;
    var persist = !!(opts && opts.persist === true); // 기본 false (PR#36 변경)
    var silent  = !!(opts && opts.silent === true);
    state.lang = lc;
    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, lc); } catch (_) {}
    }
    applyAll();
    if (!silent) {
      try {
        var ev = new CustomEvent('lp:langchange', { detail: { lang: lc, persist: persist } });
        document.dispatchEvent(ev);
      } catch (_) {}
    }
  }

  function onReady(cb) {
    if (typeof cb !== 'function') return;
    if (state.dict) cb();
    else state.readyCbs.push(cb);
  }

  // ---------- Public API ----------
  global.LP_I18N = {
    get lang() { return state.lang; },
    t: t,
    setLang: setLang,
    apply: applyAll,
    onReady: onReady,
    SUPPORTED: SUPPORTED.slice()
  };

  // ---------- Boot ----------
  // PR#36: 토글 클릭 정책을 "URL navigation" 으로 통일.
  //   기존: setLang(lc) → 페이지 내 텍스트만 갱신 (localStorage persist 부수효과)
  //   변경: ?lang=lc 로 URL 을 갱신해 페이지 자체를 다시 로드 → 새 페이지에서
  //          resolveLang() 이 URL 만 보고 결정하므로 끈적한 localStorage 영향이 사라진다.
  //   예외: data-lang-lock="1" 페이지(report/program 등)는 토글 클릭을 가로채
  //          페이지 자체에서 안내 alert 를 띄우는 책임을 가진다 (여기서는 navigation 만 막음).
  function _navigateToLang(lc) {
    try {
      var u = new URL(window.location.href);
      if (lc === 'ko') u.searchParams.delete('lang');
      else u.searchParams.set('lang', lc);
      window.location.assign(u.pathname + (u.search || '') + (u.hash || ''));
    } catch (_) {
      // 폴백: in-page 갱신
      setLang(lc);
    }
  }

  function boot() {
    // Apply <html lang> ASAP to reduce FOUC
    try { document.documentElement.setAttribute('lang', state.lang); } catch (_) {}

    loadDict().then(function (dict) {
      state.dict = dict;
      applyAll();
      // Wire any [data-i18n-toggle] buttons present at boot
      // PR#36: data-lang-lock="1" 페이지(report/program)는 페이지 측에서 안내 alert 를
      //        먼저 띄울 수 있도록 마이크로태스크 지연 후 navigation 을 수행한다.
      //        페이지 핸들러가 ev.preventDefault() 하지 않으면 안내 후 navigation 진행.
      var isLangLockPage = !!(document.body && document.body.getAttribute('data-lang-lock') === '1');
      var toggles = document.querySelectorAll('[data-i18n-toggle]');
      for (var i = 0; i < toggles.length; i++) {
        toggles[i].addEventListener('click', function (e) {
          var lc = this.getAttribute('data-i18n-toggle');
          if (lc === state.lang) { e.preventDefault(); return; }
          if (isLangLockPage) {
            // lang-lock 페이지: 페이지가 alert 안내를 띄우게 하고 navigation 은 막는다.
            e.preventDefault();
            return;
          }
          e.preventDefault();
          _navigateToLang(lc);
        });
      }
      while (state.readyCbs.length) {
        try { state.readyCbs.shift()(); } catch (_) {}
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})(window);
