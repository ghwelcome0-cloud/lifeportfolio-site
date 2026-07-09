/**
 * ambient-context.js — Life Portfolio (P1 자비스급 UX/UI 스프린트)
 * =============================================================================
 * 작업 1(방문자 컨텍스트 UI) + 작업 3(재방문 인사) 통합 표현 레이어.
 *
 * 원칙:
 *   - 비파괴: 기존 HTML/DOM 을 수정하지 않고, JS 로 컨텍스트 스트립만 동적 삽입.
 *   - 은은함(여백·리듬): 톤은 조용한 안내. 강한 팝업/모달 아님.
 *   - i18n 우선, 폴백 내장: window.LP_I18N.t(k, fallback) 사용, 사전 미로드 시에도 동작.
 *   - 판별은 window.LP_VISITOR(visitor-context.js) 에 위임.
 *   - 1회성/과빈도 방지: 세션당 1회 노출, 닫으면 당분간 억제.
 *
 * 의존: visitor-context.js (window.LP_VISITOR), 선택적으로 i18n.js (window.LP_I18N)
 *
 * 노출: window.LP_AMBIENT.render(opts)  — 수동 렌더도 가능
 */
(function (w, d) {
  'use strict';

  var DISMISS_KEY = 'lp_ambient_dismissed_at';
  var SHOWN_SESSION_KEY = 'lp_ambient_shown';
  var DISMISS_SUPPRESS_MS = 24 * 60 * 60 * 1000; // 닫으면 24h 억제

  function LS() { try { return w.localStorage; } catch (e) { return null; } }
  function getLS(k) { var s = LS(); try { return s ? s.getItem(k) : null; } catch (e) { return null; } }
  function setLS(k, v) { var s = LS(); try { if (s) s.setItem(k, v); } catch (e) {} }
  function getSS(k) { try { return w.sessionStorage ? w.sessionStorage.getItem(k) : null; } catch (e) { return null; } }
  function setSS(k, v) { try { if (w.sessionStorage) w.sessionStorage.setItem(k, v); } catch (e) {} }

  function t(key, fb) {
    try {
      if (w.LP_I18N && typeof w.LP_I18N.t === 'function') return w.LP_I18N.t(key, fb);
    } catch (e) {}
    return fb;
  }

  // state -> {greetKey, ctxKey, fallbacks}
  var COPY = {
    first_time_visitor: {
      greet: ['ambient.greet_first', '처음 오셨네요. 천천히 둘러보셔도 좋습니다.'],
      ctx:   ['ambient.ctx_first', '발견 · 살아냄 · 남김 — 나를 이해하는 첫 걸음부터.']
    },
    returning_no_report: {
      greet: ['ambient.greet_returning', '다시 오셨네요. 이어서 살펴보실까요?'],
      ctx:   ['ambient.ctx_returning', '지난번 보시던 흐름을 이어서 안내해 드릴게요.']
    },
    report_holder: {
      greet: ['ambient.greet_holder', '돌아오신 걸 환영합니다. 리포트를 다시 펼쳐보실 수 있어요.'],
      ctx:   ['ambient.ctx_holder', '리포트를 바탕으로 다음 한 걸음을 함께 살펴봐요.']
    },
    seasoned_holder: {
      greet: ['ambient.greet_seasoned', '꾸준히 함께해 주셔서 고맙습니다. 오늘은 무엇을 이어가 볼까요?'],
      ctx:   ['ambient.ctx_seasoned', '지금까지의 여정 위에, 오늘의 한 걸음을 더해요.']
    }
  };

  function suppressed() {
    // 세션당 1회
    if (getSS(SHOWN_SESSION_KEY)) return true;
    // 닫음 억제창
    var at = parseInt(getLS(DISMISS_KEY) || '0', 10);
    if (!isNaN(at) && at > 0 && (Date.now() - at) < DISMISS_SUPPRESS_MS) return true;
    return false;
  }

  function injectStyleOnce() {
    if (d.getElementById('lp-ambient-style')) return;
    var st = d.createElement('style');
    st.id = 'lp-ambient-style';
    st.textContent = [
      '.lp-ambient{',
      '  display:flex;align-items:center;gap:12px;',
      '  max-width:960px;margin:14px auto 0;padding:10px 16px;',
      '  background:rgba(13,148,136,.06);border:1px solid rgba(13,148,136,.16);',
      '  border-radius:12px;font-size:14px;line-height:1.5;color:#0f5f57;',
      '  opacity:0;transform:translateY(-4px);transition:opacity .5s ease,transform .5s ease;',
      '}',
      '.lp-ambient.is-in{opacity:1;transform:translateY(0);}',
      '.lp-ambient .lp-ambient-dot{width:8px;height:8px;border-radius:50%;background:#0d9488;flex:0 0 auto;}',
      '.lp-ambient .lp-ambient-text{flex:1 1 auto;}',
      '.lp-ambient .lp-ambient-text b{font-weight:600;color:#0d9488;}',
      '.lp-ambient .lp-ambient-text span{color:#4b6b66;}',
      '.lp-ambient .lp-ambient-close{',
      '  flex:0 0 auto;background:none;border:none;color:#8aa6a1;cursor:pointer;',
      '  font-size:13px;padding:4px 6px;border-radius:6px;',
      '}',
      '.lp-ambient .lp-ambient-close:hover{background:rgba(13,148,136,.1);color:#0d9488;}',
      '@media (max-width:640px){.lp-ambient{margin:12px 14px 0;font-size:13px;}}',
      '@media (prefers-reduced-motion:reduce){.lp-ambient{transition:none;}}'
    ].join('');
    (d.head || d.documentElement).appendChild(st);
  }

  function pickAnchor() {
    // 우선순위: 명시 컨테이너 > 히어로 eyebrow 부모 > main 최상단 > body 최상단
    var byId = d.getElementById('lp-ambient-slot');
    if (byId) return { el: byId, mode: 'append' };
    var eyebrow = d.querySelector('.hero-eyebrow');
    if (eyebrow && eyebrow.parentNode) return { el: eyebrow, mode: 'before' };
    var main = d.querySelector('main');
    if (main) return { el: main.firstChild, mode: 'prepend', parent: main };
    return { el: d.body ? d.body.firstChild : null, mode: 'prepend', parent: d.body };
  }

  function build(ctx) {
    var copy = COPY[ctx.state] || COPY.first_time_visitor;
    var greet = t(copy.greet[0], copy.greet[1]);
    var ctxLine = t(copy.ctx[0], copy.ctx[1]);

    var box = d.createElement('div');
    box.className = 'lp-ambient';
    box.setAttribute('role', 'status');
    box.setAttribute('aria-live', 'polite');
    box.setAttribute('data-visitor-state', ctx.state);

    var dot = d.createElement('span'); dot.className = 'lp-ambient-dot';
    var txt = d.createElement('div'); txt.className = 'lp-ambient-text';
    var b = d.createElement('b'); b.textContent = greet;
    var s = d.createElement('span'); s.textContent = ' ' + ctxLine;
    txt.appendChild(b); txt.appendChild(s);

    var close = d.createElement('button');
    close.className = 'lp-ambient-close';
    close.type = 'button';
    close.setAttribute('aria-label', t('ambient.dismiss', '닫기'));
    close.textContent = '×';
    close.addEventListener('click', function () {
      setLS(DISMISS_KEY, String(Date.now()));
      box.classList.remove('is-in');
      setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 350);
    });

    box.appendChild(dot);
    box.appendChild(txt);
    box.appendChild(close);
    return box;
  }

  function render(opts) {
    opts = opts || {};
    if (!opts.force && suppressed()) return null;
    if (!w.LP_VISITOR) return null;

    var ctx = w.LP_VISITOR.context();
    injectStyleOnce();
    var box = build(ctx);

    var a = pickAnchor();
    if (!a || (!a.el && !a.parent)) return null;
    try {
      if (a.mode === 'append') a.el.appendChild(box);
      else if (a.mode === 'before') a.el.parentNode.insertBefore(box, a.el);
      else if (a.mode === 'prepend') (a.parent || a.el.parentNode).insertBefore(box, a.el);
    } catch (e) { return null; }

    setSS(SHOWN_SESSION_KEY, '1');
    // 진입 애니메이션
    (w.requestAnimationFrame || function (cb) { setTimeout(cb, 16); })(function () {
      box.classList.add('is-in');
    });
    return box;
  }

  w.LP_AMBIENT = { render: render, COPY: COPY };

  function boot() {
    var start = function () {
      // i18n 준비되면 그 후, 아니면 즉시
      if (w.LP_I18N && typeof w.LP_I18N.onReady === 'function') {
        w.LP_I18N.onReady(function () { render(); });
      } else {
        render();
      }
    };
    if (w.LP_VISITOR && typeof w.LP_VISITOR.onReady === 'function') {
      w.LP_VISITOR.onReady(function () { start(); });
    } else {
      start();
    }
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(window, document);
