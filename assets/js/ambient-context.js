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

  // 시간대 기반 인사 (A2) — 사용자 로컬 시각 기준 (P1.5 계획서 v1.0 §5.2)
  //   아침 morning   05:00–10:59
  //   낮   afternoon 11:00–16:59
  //   저녁 evening   17:00–21:59
  //   밤   night     22:00–04:59
  // 시간 greet 는 상태별 greet 를 대체하고, ctx 라인은 상태별 그대로 유지한다.
  var TIME_GREET = {
    morning:   ['visitor.greeting_morning',   '좋은 아침입니다. 오늘의 첫 걸음은 어떤 모습이신가요?'],
    afternoon: ['visitor.greeting_afternoon', '낮의 흐름 중에 잠시 들르셨네요. 무엇을 살아내고 계신가요?'],
    evening:   ['visitor.greeting_evening',   '하루의 마무리에 오셨네요. 오늘 살아내신 순간이 있으신가요?'],
    night:     ['visitor.greeting_night',     '늦은 시간까지 오늘을 살아내고 계시네요. 조용히 함께합니다.']
  };

  // ══════════════════════════════════════════════════════════════════════════
  // B9 · 감정 인지 모드 — 시간대 × 방문자 상태 조합 인사 (12키 · 대표확정 v0.2)
  //   greet 결정 3중 폴백: ① 조합(GREET_COMBO) → ② 시간대(TIME_GREET)
  //     → ③ 상태(COPY[state].greet). 신규 12키는 부재 시 자동으로 하위 폴백.
  //   seasoned 는 밤만 신규 배정 → 그 외 시간대는 holder 로 폴백(문서 08 §2 확정).
  //   비파괴: 기존 TIME_GREET/COPY 무손상. 조합이 없으면 기존 흐름과 동일.
  // ══════════════════════════════════════════════════════════════════════════
  var GREET_COMBO = {
    morning: {
      first_time_visitor:  ['ambient.greet_morning_first',     '아침이네요. 오늘 하루를 여는 나는 어떤 사람일까요? 그 답을 함께 발견해요.'],
      returning_no_report: ['ambient.greet_morning_returning',  '다시 아침을 맞으셨네요. 아직 열어보지 못한 \u2018나에 대한 답\u2019이 여기 있어요.'],
      report_holder:       ['ambient.greet_morning_holder',     '좋은 아침이에요. 리포트가 비춰준 나의 강점, 오늘 하루에 살아내 봐요.'],
      seasoned_holder:     ['ambient.greet_morning_seasoned',   '아침이 밝았어요. 지금까지 쌓아온 당신의 여정이, 오늘 또 하나의 자산이 돼요.']
    },
    afternoon: {
      first_time_visitor:  ['ambient.greet_afternoon_first',     '한낮이네요. 지금 마음에 걸리는 그 한 가지가, 나를 아는 실마리예요.'],
      returning_no_report: ['ambient.greet_afternoon_returning',  '다시 오셨네요. 궁금했던 \u2018나의 모습\u2019, 오늘은 온전히 만나볼 수 있어요.'],
      report_holder:       ['ambient.greet_afternoon_holder',     '바쁜 하루 중이시네요. 리포트가 짚어준 한 걸음이 오늘을 다르게 만들어요.'],
      seasoned_holder:     ['ambient.greet_afternoon_seasoned',   '낮의 틈이네요. 당신이 살아낸 순간들이 이미 남길 만한 이야기가 되고 있어요.']
    },
    evening: {
      first_time_visitor:  ['ambient.greet_evening_first',     '저녁이 내려앉네요. 오늘 살아낸 하루, 나에게 어떤 의미였을까요? 함께 짚어봐요.'],
      returning_no_report: ['ambient.greet_evening_returning',  '하루의 끝자락이네요. 오늘의 나를 이해하고 나면, 내일이 조금 선명해져요.'],
      report_holder:       ['ambient.greet_evening_holder',     '저녁이에요. 오늘 살아낸 하루를, 남길 만한 나의 기록으로 담아봐요.'],
      seasoned_holder:     ['ambient.greet_evening_seasoned',   '하루를 마무리하며, 당신이 걸어온 길 위에 오늘의 성장을 더해요.']
    },
    night: {
      first_time_visitor:  ['ambient.greet_night_first',     '늦은 밤이네요. 오늘의 나를 이해하는 첫 걸음, 지금 여기서 시작돼요.'],
      returning_no_report: ['ambient.greet_night_returning',  '늦은 시간 다시 오셨네요. 미뤄둔 \u2018나에 대한 답\u2019, 오늘 밤 만나보시겠어요?'],
      report_holder:       ['ambient.greet_night_holder',     '밤이네요. 리포트가 비춰준 나를 곁에 두고, 내일의 한 걸음을 그려봐요.'],
      seasoned_holder:     ['ambient.greet_night_seasoned',   '깊은 밤이네요. 지금까지의 여정이 흩어지지 않도록, 오늘도 하나의 자산으로 남겨요.']
    }
  };

  // seasoned 는 밤 외 시간대 미매핑 → holder 로 폴백(대표확정 v0.2)
  var COMBO_STATE_FALLBACK = { seasoned_holder: 'report_holder' };

  // (band, state) → 조합 문구. 부재 시 null (호출부가 TIME_GREET 로 폴백).
  function comboGreet(band, state) {
    try {
      var byBand = GREET_COMBO[band];
      if (!byBand) return '';
      var entry = byBand[state] || byBand[COMBO_STATE_FALLBACK[state]];
      if (!entry) return '';
      return t(entry[0], entry[1]) || '';
    } catch (e) { return ''; }
  }

  function getTimeBand(now) {
    var h;
    try { h = (now instanceof Date ? now : new Date()).getHours(); }
    catch (e) { h = 12; }
    if (h >= 5 && h <= 10) return 'morning';
    if (h >= 11 && h <= 16) return 'afternoon';
    if (h >= 17 && h <= 21) return 'evening';
    return 'night'; // 22:00–04:59
  }

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
    // B9 greet 3중 폴백: ① 조합(band×state) → ② 시간대(TIME_GREET) → ③ 상태(COPY).
    //   조합이 비면(부재/i18n 실패) 기존 A2 흐름(시간대→상태)으로 자연 폴백 — 비파괴.
    var band = getTimeBand();
    var tg = TIME_GREET[band];
    var greet = comboGreet(band, ctx.state)
      || (tg ? t(tg[0], tg[1]) : '')
      || t(copy.greet[0], copy.greet[1]);
    var ctxLine = t(copy.ctx[0], copy.ctx[1]);

    // 시간대 앵커 부여 (B5 온기 컬러 레이어 · B9 감정인지모드 연동 준비)
    try {
      var root = d.documentElement;
      if (root && !root.getAttribute('data-lp-time')) root.setAttribute('data-lp-time', band);
    } catch (e) {}

    var box = d.createElement('div');
    box.className = 'lp-ambient';
    box.setAttribute('role', 'status');
    box.setAttribute('aria-live', 'polite');
    box.setAttribute('data-visitor-state', ctx.state);
    box.setAttribute('data-lp-time', band);

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

  w.LP_AMBIENT = { render: render, COPY: COPY, TIME_GREET: TIME_GREET, GREET_COMBO: GREET_COMBO, comboGreet: comboGreet, getTimeBand: getTimeBand };

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
