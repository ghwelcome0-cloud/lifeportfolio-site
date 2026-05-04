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
  function resolveLang() {
    try {
      var url = new URL(window.location.href);
      var qs  = (url.searchParams.get('lang') || '').toLowerCase();
      if (SUPPORTED.indexOf(qs) >= 0) {
        try { localStorage.setItem(STORAGE_KEY, qs); } catch (_) {}
        return qs;
      }
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
  }

  function applyAll(root) {
    var scope = root || document;
    // Catch both data-i18n and data-i18n-html-only nodes
    var nodes = scope.querySelectorAll('[data-i18n], [data-i18n-html]');
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

  function setLang(lc) {
    if (SUPPORTED.indexOf(lc) < 0) return;
    state.lang = lc;
    try { localStorage.setItem(STORAGE_KEY, lc); } catch (_) {}
    applyAll();
    try {
      var ev = new CustomEvent('lp:langchange', { detail: { lang: lc } });
      document.dispatchEvent(ev);
    } catch (_) {}
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
  function boot() {
    // Apply <html lang> ASAP to reduce FOUC
    try { document.documentElement.setAttribute('lang', state.lang); } catch (_) {}

    loadDict().then(function (dict) {
      state.dict = dict;
      applyAll();
      // Wire any [data-i18n-toggle] buttons present at boot
      var toggles = document.querySelectorAll('[data-i18n-toggle]');
      for (var i = 0; i < toggles.length; i++) {
        toggles[i].addEventListener('click', function (e) {
          e.preventDefault();
          var lc = this.getAttribute('data-i18n-toggle');
          setLang(lc);
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
