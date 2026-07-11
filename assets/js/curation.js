/**
 * curation.js — Life Portfolio (P1 자비스급 UX/UI 스프린트, 4축 큐레이션 로직)
 * =============================================================================
 * curation-matrix-v1.json 을 기반으로 방문자 상태·축·depth 에 맞는
 * "다음 한 걸음" 콘텐츠 1개를 선정하여 슬롯에 조용히 렌더한다.
 *
 * 매트릭스 규칙 정합:
 *   - curation_logic.slot_principle.one_slot_one_suggestion : 슬롯당 제안 1개
 *   - curation_logic.slot_principle.no_selection_grid       : 나열 금지
 *   - visitor_state_rules[*].max_recommendations_per_slot=1  : 슬롯당 1개
 *   - exclusion_rules: ko/en unavailable, in_curation_pool=false, already_read
 *   - axis_matching / depth_matching / anchor_content
 *
 * 내부 3계층:
 *   Loader  : 매트릭스 fetch + 캐시 + LP_VISITOR.attachMatrix 연동
 *   Filter  : 방문자 상태 규칙으로 후보 풀 → 점수화 → best 1
 *   Slots   : data-lp-curation-slot 요소(또는 자동 앵커)에 카드 1개 렌더
 *
 * 비파괴: 기존 HTML/DOM 미수정. 슬롯 컨테이너가 있거나 자동 앵커가 있을 때만 렌더.
 * i18n 폴백 내장. 의존: 선택적 LP_VISITOR / LP_I18N / LP.track.
 *
 * 노출: window.LP_CURATION = { load, pick, render, mount }
 */
(function (w, d) {
  'use strict';

  var MATRIX_URL = '/assets/data/curation-matrix-v1.json';
  var LS_READ_KEY = 'lp_read_assets';   // 읽은 asset_id CSV (already_read 제외용)

  function t(key, fb) {
    try { if (w.LP_I18N && typeof w.LP_I18N.t === 'function') return w.LP_I18N.t(key, fb); } catch (e) {}
    return fb;
  }
  function track(ev, p) { try { if (w.LP && typeof w.LP.track === 'function') w.LP.track(ev, p || {}); } catch (e) {} }

  function lang() {
    // 페이지 언어 판단 원칙(홈/블로그 CTA와 동일):
    //   1) LP_I18N.lang (현재 페이지가 실제로 렌더 중인 언어 — 가장 신뢰)
    //   2) URL ?lang=en (명시적 영문 진입만 EN)
    //   3) <html lang> 속성
    //   4) 기본값 ko
    // ⚠️ localStorage.lp_lang 은 사용하지 않음 — 이전 영문 페이지 방문 이력이
    //    한글 페이지의 큐레이션 카드 링크를 영문(/blog/en·posts-en)으로 오염시키던
    //    회귀를 차단(2026-07-11).
    try {
      if (w.LP_I18N && w.LP_I18N.lang) return w.LP_I18N.lang;
    } catch (e) {}
    try {
      var q = (new w.URL(w.location.href).searchParams.get('lang') || '').toLowerCase();
      if (q === 'en') return 'en';
    } catch (e2) {}
    try {
      var hl = (d.documentElement.getAttribute('lang') || '').toLowerCase();
      if (hl.indexOf('en') === 0) return 'en';
    } catch (e3) {}
    return 'ko';
  }

  function visitorCtx() {
    try {
      if (w.LP_VISITOR && typeof w.LP_VISITOR.context === 'function') return w.LP_VISITOR.context();
    } catch (e) {}
    return { state: 'first_time_visitor', lastAxis: null, lang: lang() };
  }

  function rulesFor(state) {
    if (_matrix && Array.isArray(_matrix.visitor_state_rules)) {
      for (var i = 0; i < _matrix.visitor_state_rules.length; i++) {
        if (_matrix.visitor_state_rules[i].visitor_state === state) return _matrix.visitor_state_rules[i].rules || {};
      }
    }
    return {};
  }

  function readAssets() {
    try {
      var v = w.localStorage && w.localStorage.getItem(LS_READ_KEY);
      return v ? v.split(',').filter(Boolean) : [];
    } catch (e) { return []; }
  }
  function markRead(assetId) {
    if (!assetId) return;
    try {
      var arr = readAssets();
      if (arr.indexOf(assetId) < 0) { arr.push(assetId); w.localStorage.setItem(LS_READ_KEY, arr.slice(-50).join(',')); }
    } catch (e) {}
  }

  // ============================ Loader ======================================
  var _matrix = null;
  var _loading = null;

  function load() {
    if (_matrix) return Promise.resolve(_matrix);
    if (_loading) return _loading;
    _loading = fetch(MATRIX_URL, { credentials: 'same-origin' })
      .then(function (r) { if (!r.ok) throw new Error('matrix ' + r.status); return r.json(); })
      .then(function (json) {
        _matrix = json;
        try { if (w.LP_VISITOR && w.LP_VISITOR.attachMatrix) w.LP_VISITOR.attachMatrix(json); } catch (e) {}
        return json;
      })
      .catch(function (e) { _loading = null; throw e; });
    return _loading;
  }

  // ============================ Filter ======================================
  function assetLangOk(a, lng) {
    return lng === 'en' ? !!a.en_available : !!a.ko_available;
  }
  function assetUrl(a, lng) {
    return (lng === 'en' && a.url_en) ? a.url_en : a.url_ko;
  }
  function assetTitle(a, lng) {
    return (lng === 'en' && a.title_en) ? a.title_en : a.title_ko;
  }

  // 방문자 약한 축: 리포트 보유자는 lp_weak_axis(로컬), 없으면 lastAxis, 없으면 규칙 우선축
  function targetAxes(ctx, rules) {
    var axes = [];
    // report_holder: weak_axis_first
    var weak = null;
    try { weak = w.localStorage && w.localStorage.getItem('lp_weak_axis'); } catch (e) {}
    if (rules.primary_axis_priority === 'weak_axis_first' && weak) axes.push(weak);
    // 명시적 우선축 배열
    if (Array.isArray(rules.primary_axis_priority)) axes = axes.concat(rules.primary_axis_priority);
    // returning: last_visited_page_axis
    if (rules.context_source === 'last_visited_page_axis' && ctx.lastAxis) axes.push(ctx.lastAxis);
    // anchor_axis_for_first_screen
    if (rules.anchor_axis_for_first_screen) axes.push(rules.anchor_axis_for_first_screen);
    // 폴백: 첫 축
    if (!axes.length && _matrix && _matrix.meta && _matrix.meta.axes) axes.push(_matrix.meta.axes[0]);
    // 중복 제거
    return axes.filter(function (a, i) { return a && axes.indexOf(a) === i; });
  }

  function candidatePool(rules, lng) {
    if (!_matrix || !Array.isArray(_matrix.assets)) return [];
    var read = rules.exclude_already_read ? readAssets() : [];
    return _matrix.assets.filter(function (a) {
      if (!a.in_curation_pool) return false;                 // curation_pool_false
      if (!assetLangOk(a, lng)) return false;                // ko/en unavailable
      if (a.is_regenerate_reference && rules.exclude_regenerate_reference) return false;
      if (a.is_revisit_target && rules.exclude_revisit_targets) return false;
      if (read.indexOf(a.asset_id) >= 0) return false;       // already_read
      return true;
    });
  }

  function score(a, axes, preferredDepth, preferredStage) {
    var s = 0;
    // 축 매칭
    var ai = axes.indexOf(a.primary_axis);
    if (ai >= 0) s += (100 - ai * 10);                       // 우선순위 높을수록 가점
    if (Array.isArray(a.secondary_axes)) {
      for (var i = 0; i < axes.length; i++) if (a.secondary_axes.indexOf(axes[i]) >= 0) { s += 20; break; }
    }
    // depth 매칭
    if (preferredDepth && preferredDepth.length) {
      var di = preferredDepth.indexOf(a.depth);
      if (di >= 0) s += (40 - di * 8);
    }
    // asset_stage 매칭
    if (preferredStage && preferredStage.length) {
      for (var j = 0; j < preferredStage.length; j++) {
        if (a.asset_stage && a.asset_stage.indexOf(preferredStage[j]) >= 0) { s += 15; break; }
      }
    }
    // embedding_priority 가중
    if (a.embedding_priority === 'HIGH') s += 8;
    else if (a.embedding_priority === 'MEDIUM') s += 3;
    return s;
  }

  // 앵커 우선 반환 (anchor_content_first)
  function anchorAsset(axis) {
    if (!_matrix || !Array.isArray(_matrix.assets) || !axis) return null;
    for (var i = 0; i < _matrix.assets.length; i++) {
      var a = _matrix.assets[i];
      if (a.is_anchor_for === axis) return a;
    }
    return null;
  }

  // 특정 축 기준으로 콘텐츠 1개 선정 (ask-widget 키워드 매칭 재활용용).
  // 방문자 상태 규칙(depth/stage/already_read/lang)은 유지하되 축만 강제 지정.
  function pickByAxis(axis, opts) {
    opts = opts || {};
    if (!_matrix || !axis) return null;
    var ctx = opts.ctx || visitorCtx();
    var rules = rulesFor(ctx.state);
    var lng = opts.lang || ctx.lang || lang();
    var pool = candidatePool(rules, lng);
    if (!pool.length) return null;
    var axes = [axis];
    var pd = rules.preferred_depth || [];
    var ps = rules.preferred_asset_stage || [];
    var best = null, bestScore = -1;
    for (var i = 0; i < pool.length; i++) {
      // 해당 축(primary 또는 secondary)에 걸리는 자산만 후보
      var a = pool[i];
      var hit = (a.primary_axis === axis) || (Array.isArray(a.secondary_axes) && a.secondary_axes.indexOf(axis) >= 0);
      if (!hit) continue;
      var sc = score(a, axes, pd, ps);
      if (sc > bestScore) { bestScore = sc; best = a; }
    }
    if (!best) return null;
    return { asset: best, reason: 'axis', score: bestScore, axes: axes, lang: lng };
  }

  // best 1개 선정 (max_recommendations_per_slot=1)
  function pick(ctx) {
    ctx = ctx || visitorCtx();
    var rules = rulesFor(ctx.state);
    var lng = ctx.lang || lang();
    var axes = targetAxes(ctx, rules);

    // 앵커 우선 (first_time_visitor 등)
    if (rules.anchor_content_first && axes.length) {
      var anc = anchorAsset(axes[0]);
      if (anc && assetLangOk(anc, lng)) return { asset: anc, reason: 'anchor', axes: axes };
    }

    var pool = candidatePool(rules, lng);
    if (!pool.length) return null;

    var pd = rules.preferred_depth || [];
    var ps = rules.preferred_asset_stage || [];
    var best = null, bestScore = -1;
    for (var i = 0; i < pool.length; i++) {
      var sc = score(pool[i], axes, pd, ps);
      if (sc > bestScore) { bestScore = sc; best = pool[i]; }
    }
    if (!best) return null;
    return { asset: best, reason: 'scored', score: bestScore, axes: axes };
  }

  // ============================ Slots =======================================
  function injectStyleOnce() {
    if (d.getElementById('lp-curation-style')) return;
    var st = d.createElement('style'); st.id = 'lp-curation-style';
    st.textContent = [
      '.lp-curation{',
      '  display:block;max-width:640px;margin:16px auto;padding:16px 18px;',
      '  background:#fff;border:1px solid rgba(70,141,132,.18);border-radius:14px;',
      '  box-shadow:0 6px 20px rgba(15,95,87,.06);text-decoration:none;color:inherit;',
      '  transition:transform .18s ease,box-shadow .18s ease;',
      '}',
      '.lp-curation:hover{transform:translateY(-2px);box-shadow:0 12px 28px rgba(15,95,87,.1);}',
      '.lp-curation .lp-cur-eyebrow{font-size:12px;font-weight:700;color:#468D84;letter-spacing:.02em;margin-bottom:6px;}',
      '.lp-curation .lp-cur-title{font-size:16px;font-weight:700;color:#1F4A44;line-height:1.4;margin:0 0 6px;}',
      '.lp-curation .lp-cur-quote{font-size:13px;color:#2E5E57;line-height:1.55;margin:0;}',
      '.lp-curation .lp-cur-more{display:inline-block;margin-top:10px;font-size:13px;font-weight:600;color:#468D84;}',
      '@media (prefers-reduced-motion:reduce){.lp-curation{transition:none;}}'
    ].join('');
    (d.head || d.documentElement).appendChild(st);
  }

  function buildCard(result, lng) {
    var a = result.asset;
    var card = d.createElement('a');
    card.className = 'lp-curation';
    card.href = assetUrl(a, lng) || '#';
    card.setAttribute('data-asset-id', a.asset_id);
    card.setAttribute('data-curation-reason', result.reason);

    var eyebrow = d.createElement('div'); eyebrow.className = 'lp-cur-eyebrow';
    eyebrow.textContent = t('curation.eyebrow', '다음 한 걸음') + ' · ' + (a.primary_axis || '');

    var title = d.createElement('div'); title.className = 'lp-cur-title';
    title.textContent = assetTitle(a, lng);

    var quote = d.createElement('p'); quote.className = 'lp-cur-quote';
    quote.textContent = a.core_quote || a.summary || '';

    var more = d.createElement('span'); more.className = 'lp-cur-more';
    more.textContent = t('curation.more', '이어서 읽어보기 →');

    card.appendChild(eyebrow);
    card.appendChild(title);
    if (quote.textContent) card.appendChild(quote);
    card.appendChild(more);

    card.addEventListener('click', function () {
      markRead(a.asset_id);
      track('curation_click', { asset_id: a.asset_id, reason: result.reason, axis: a.primary_axis });
    });
    return card;
  }

  function findSlots() {
    var slots = [];
    var explicit = d.querySelectorAll('[data-lp-curation-slot]');
    if (explicit && explicit.length) {
      for (var i = 0; i < explicit.length; i++) slots.push(explicit[i]);
    }
    return slots;
  }

  function render(opts) {
    opts = opts || {};
    if (!_matrix) return null;
    var ctx = visitorCtx();
    var lng = ctx.lang || lang();
    var result = pick(ctx);
    if (!result) return null;

    injectStyleOnce();
    var slots = findSlots();
    if (!slots.length) {
      if (!opts.autoAnchor) return null;
      // 자동 앵커: main 하단(비파괴, 있을 때만)
      var main = d.querySelector('main');
      if (!main) return null;
      var holder = d.createElement('section');
      holder.setAttribute('data-lp-curation-slot', 'auto');
      main.appendChild(holder);
      slots = [holder];
    }

    var card = buildCard(result, lng);
    var first = slots[0];
    // 슬롯당 1개(slot_principle): 기존 내용 비우고 카드 1개만
    first.innerHTML = '';
    first.appendChild(card);
    track('curation_impression', { asset_id: result.asset.asset_id, reason: result.reason, state: ctx.state });
    return card;
  }

  function mount() {
    load().then(function () {
      var start = function () { render({ autoAnchor: false }); };
      if (w.LP_I18N && typeof w.LP_I18N.onReady === 'function') w.LP_I18N.onReady(start);
      else start();
    }).catch(function () { /* 매트릭스 로드 실패 시 조용히 무시(비파괴) */ });
  }

  w.LP_CURATION = {
    load: load, pick: pick, pickByAxis: pickByAxis, render: render, mount: mount, markRead: markRead,
    // ask-widget 등에서 asset 표시에 재사용
    assetUrl: assetUrl, assetTitle: assetTitle
  };

  function boot() {
    if (w.LP_VISITOR && typeof w.LP_VISITOR.onReady === 'function') w.LP_VISITOR.onReady(mount);
    else mount();
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(window, document);
