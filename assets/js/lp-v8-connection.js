/* Homepage connection only. Never decides entitlements or reads customer records. */
(function (w, d) {
  'use strict';
  const state = { status: 'pending', user: null, auth: null, signingOut: false };
  const lang = () => new URL(w.location.href).searchParams.get('lang')?.toLowerCase() === 'en' ? 'en' : 'ko';
  function withLang(path) {
    const url = new URL(path, w.location.origin);
    if (url.origin !== w.location.origin) return path;
    if (lang() === 'en') url.searchParams.set('lang', 'en');
    return url.pathname + url.search + url.hash;
  }
  function destination(kind) {
    if (kind === 'product') return withLang(lang() === 'en' ? '/product' : '/product-v2');
    if (kind === 'report') return state.status === 'signed-in'
      ? withLang('/mypage')
      : withLang('/login?returnTo=' + encodeURIComponent(withLang('/mypage').slice(1)));
    if (kind === 'start') return state.status === 'signed-in' ? destination('product') : withLang('/login');
    return withLang('/' + kind);
  }
  function status(text) { const el = d.getElementById('lp-account-status'); if (el) el.textContent = text; }
  function link(label, kind) {
    const a = d.createElement('a'); a.textContent = label; a.dataset.lpRoute = kind; a.href = destination(kind); return a;
  }
  function render() {
    const nav = d.getElementById('authNav');
    if (!nav) return;
    const focus = nav.contains(d.activeElement) ? d.activeElement.dataset.lpRoute : null;
    nav.replaceChildren();
    if (state.status === 'signed-in') {
      const name = d.createElement('span'); name.className = 'lp-member-name';
      name.textContent = state.user.displayName || '회원';
      nav.append(name, link('마이페이지', 'report'));
      const out = d.createElement('button'); out.type = 'button'; out.textContent = state.signingOut ? '로그아웃 중…' : '로그아웃';
      out.disabled = state.signingOut; out.dataset.lpRoute = 'logout'; out.addEventListener('click', logout); nav.append(out);
    } else {
      nav.append(link('로그인', 'login'), link('회원가입', 'signup'));
    }
    if (focus) nav.querySelector('[data-lp-route="' + focus + '"]')?.focus();
    d.querySelectorAll('a[data-lp-route]').forEach(a => a.href = destination(a.dataset.lpRoute));
    d.documentElement.dataset.authStatus = state.status;
  }
  async function logout() {
    if (!state.auth || state.signingOut) return;
    state.signingOut = true; render(); status('로그아웃하고 있습니다.');
    try {
      await state.auth.signOut();
      state.status = 'signed-out'; state.user = null;
      status('로그아웃되었습니다.');
    } catch (_) {
      // Do not claim success, reload, or discard the current session on failure.
      status('로그아웃하지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.');
    } finally { state.signingOut = false; render(); }
  }
  function initializeAuth() {
    try {
      if (!w.firebase?.auth || !w.LP_V8_FIREBASE_CONFIG) throw new Error('SDK unavailable');
      const app = w.firebase.apps.length ? w.firebase.app() : w.firebase.initializeApp(w.LP_V8_FIREBASE_CONFIG);
      if (app.options.projectId !== w.LP_V8_FIREBASE_CONFIG.projectId) throw new Error('Project mismatch');
      state.auth = app.auth();
      // Homepage has no protected-resource calls; retain existing homepage App Check policy.
      state.auth.onAuthStateChanged(user => {
        if (state.status !== 'pending' && state.user?.uid !== user?.uid) d.dispatchEvent(new Event('lp:clear-temporary'));
        state.user = user || null; state.status = user ? 'signed-in' : 'signed-out';
        status(''); render();
      }, () => { state.status = 'unavailable'; state.user = null; status('로그인 상태를 확인하지 못했습니다. 로그인 페이지에서 확인해 주세요.'); render(); });
    } catch (_) {
      state.status = 'unavailable'; status('로그인 상태를 확인하지 못했습니다. 로그인 페이지에서 확인해 주세요.'); render();
    }
  }
  function markLinks(root) {
    root.querySelectorAll('a[href]').forEach(a => {
      if (a.dataset.lpRoute) { a.href = destination(a.dataset.lpRoute); return; }
      const raw = a.getAttribute('href'); if (!raw || raw.startsWith('#')) return;
      let url; try { url = new URL(raw, w.location.origin); } catch (_) { return; }
      if (url.origin !== w.location.origin) return;
      const path = url.pathname.replace(/\.html$/, '');
      if (['/product', '/product-v2'].includes(path)) a.dataset.lpRoute = 'product';
      else if (path === '/login' && /이미 받은|내 리포트|프로그램 열기/.test(a.textContent)) a.dataset.lpRoute = 'report';
      if (a.dataset.lpRoute) a.href = destination(a.dataset.lpRoute);
      else a.href = withLang(url.pathname + url.search + url.hash);
    });
  }
  function sampleHash(event) {
    const hash = event?.newURL ? new URL(event.newURL).hash : w.location.hash;
    if (hash !== '#sample' && hash !== '#ax-sample') return;
    w.showSpace('cover'); w.showPanel('sample');
  }
  function boot() {
    render(); markLinks(d);
    const body = d.getElementById('dialog-body');
    if (body) new MutationObserver(records => {
      if (records.some(r => r.type === 'childList')) markLinks(body);
    }).observe(body, { childList: true, subtree: true });
    d.addEventListener('click', event => {
      if (event.target.closest?.('[data-clear-temporary]') && w.confirm('이 페이지의 임시 글을 모두 지울까요? 필요하면 먼저 TXT로 내려받으세요. 기존 리포트와 구매권은 변경되지 않습니다.')) {
        d.dispatchEvent(new Event('lp:clear-temporary'));
        status('이 페이지의 임시 글을 모두 지웠습니다.');
      }
      const a = event.target.closest?.('a[data-lp-route]');
      if (a) a.href = destination(a.dataset.lpRoute);
    }, true);
    w.addEventListener('hashchange', sampleHash);
    w.addEventListener('popstate', () => {
      const hash = w.location.hash;
      if (hash === '#sample' || hash === '#ax-sample') queueMicrotask(() => { w.showSpace('cover'); w.showPanel('sample'); });
    }, true);
    if (['#sample', '#ax-sample'].includes(w.LP_V8_ENTRY_HASH)) { w.showSpace('cover'); w.showPanel('sample'); }
    else sampleHash();
    initializeAuth();
  }
  // Compatibility helpers, not authorization gates. Downstream pages remain authoritative.
  w._withLang = withLang;
  w._payPage = () => lang() === 'en' ? 'product.html' : 'product-v2.html';
  w.goFlow = e => { e?.preventDefault(); w.location.assign(destination('start')); return false; };
  w.logout = logout;
  w.LP_V8_CONNECTION = Object.freeze({ destination, withLang, getStatus: () => state.status });
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})(window, document);
