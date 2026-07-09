/**
 * ask-widget.js — Life Portfolio (P1 자비스급 UX/UI 스프린트, 작업 5)
 * =============================================================================
 * "무엇이든 물어보기" 조용한 안내 위젯.
 *
 * 설계 원칙 (curation-matrix-v1.json / curation_logic.slot_principle 정합):
 *   - one_slot_one_suggestion : 화면 한 지점에 하나의 진입점(플로팅 런처 1개)만 노출.
 *   - no_selection_grid       : 3~5개 질문 선택지 나열 금지. 열면 단일 자유입력 + 조용한 안내.
 *   - 비파괴: 기존 HTML/DOM 미수정, JS 로 위젯만 동적 삽입.
 *   - i18n 우선, 폴백 내장(window.LP_I18N.t(k, fb)). 사전 미로드 시에도 동작.
 *   - 방문자 상태(window.LP_VISITOR)에 따라 안내 톤/CTA 분기.
 *
 * P2 이연: 실제 LLM 대화는 아직 없음. 제출 입력은 방문자 상태 기반 "다음 한 걸음"
 *          컨텍스트 CTA 로 연결한다("더 깊은 대화는 곧 준비" 안내).
 *
 * 의존: 선택적 window.LP_VISITOR(visitor-context.js), window.LP_I18N(i18n.js),
 *       선택적 window.LP.track (analytics.js) — 있으면 계측.
 *
 * 노출: window.LP_ASK = { open, close, toggle, mount }
 */
(function (w, d) {
  'use strict';

  var MOUNTED = false;
  var OPEN = false;
  var ROOT = null;      // 위젯 루트
  var PANEL = null;     // 패널
  var LAUNCHER = null;  // 런처 버튼

  function t(key, fb) {
    try {
      if (w.LP_I18N && typeof w.LP_I18N.t === 'function') return w.LP_I18N.t(key, fb);
    } catch (e) {}
    return fb;
  }

  function track(event, params) {
    try { if (w.LP && typeof w.LP.track === 'function') w.LP.track(event, params || {}); } catch (e) {}
  }

  function visitorState() {
    try {
      if (w.LP_VISITOR && typeof w.LP_VISITOR.context === 'function') {
        return w.LP_VISITOR.context().state || 'first_time_visitor';
      }
    } catch (e) {}
    return 'first_time_visitor';
  }

  // ---- 방문자 상태별 안내 힌트 & 다음 걸음 CTA ------------------------------
  var HINT = {
    first_time_visitor:  ['ask.panel_hint_first', '궁금한 점을 편하게 적어보세요. 지금 흐름에서 다음 한 걸음을 함께 찾아드릴게요.'],
    returning_no_report: ['ask.panel_hint_returning', '이어서 살펴보고 싶은 게 있으신가요? 편하게 적어주세요.'],
    report_holder:       ['ask.panel_hint_holder', '리포트를 바탕으로 궁금한 점을 적어주세요. 다음 걸음을 안내해 드릴게요.'],
    seasoned_holder:     ['ask.panel_hint_seasoned', '지금까지의 여정 위에서, 오늘 이어가고 싶은 것을 적어주세요.']
  };

  // 상태별 대표 CTA 1개 (slot_principle: 하나의 다음 걸음)
  function primaryCTA(state) {
    switch (state) {
      case 'report_holder':
      case 'seasoned_holder':
        return { key: 'ask.reply_cta_resume', fb: '이어서 보기', href: '/mypage', event: 'ask_cta_resume' };
      case 'returning_no_report':
        return { key: 'ask.reply_cta_report', fb: '리포트 만들기', href: '/survey', event: 'ask_cta_report' };
      case 'first_time_visitor':
      default:
        return { key: 'ask.reply_cta_report', fb: '리포트 만들기', href: '/survey', event: 'ask_cta_report' };
    }
  }

  // ---- 스타일 (teal 테마, ambient 와 톤 일치) -------------------------------
  function injectStyleOnce() {
    if (d.getElementById('lp-ask-style')) return;
    var st = d.createElement('style');
    st.id = 'lp-ask-style';
    st.textContent = [
      '.lp-ask-launcher{',
      '  position:fixed;right:20px;bottom:20px;z-index:2147483000;',
      '  display:inline-flex;align-items:center;gap:8px;',
      '  padding:11px 16px;border:none;border-radius:999px;cursor:pointer;',
      '  background:#0d9488;color:#fff;font-size:14px;font-weight:600;',
      '  box-shadow:0 6px 20px rgba(13,148,136,.28);',
      '  transition:transform .18s ease,box-shadow .18s ease,opacity .3s ease;',
      '}',
      '.lp-ask-launcher:hover{transform:translateY(-2px);box-shadow:0 10px 26px rgba(13,148,136,.34);}',
      '.lp-ask-launcher .lp-ask-ic{font-size:16px;line-height:1;}',
      '.lp-ask-panel{',
      '  position:fixed;right:20px;bottom:78px;z-index:2147483000;',
      '  width:min(360px,calc(100vw - 40px));',
      '  background:#fff;border:1px solid rgba(13,148,136,.18);border-radius:16px;',
      '  box-shadow:0 18px 48px rgba(15,95,87,.18);',
      '  padding:18px;opacity:0;transform:translateY(8px);pointer-events:none;',
      '  transition:opacity .22s ease,transform .22s ease;',
      '}',
      '.lp-ask-panel.is-open{opacity:1;transform:translateY(0);pointer-events:auto;}',
      '.lp-ask-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;}',
      '.lp-ask-title{font-size:15px;font-weight:700;color:#0f5f57;}',
      '.lp-ask-close{background:none;border:none;color:#8aa6a1;cursor:pointer;font-size:18px;line-height:1;padding:2px 6px;border-radius:6px;}',
      '.lp-ask-close:hover{background:rgba(13,148,136,.1);color:#0d9488;}',
      '.lp-ask-hint{font-size:13px;line-height:1.55;color:#4b6b66;margin:0 0 12px;}',
      '.lp-ask-form{display:flex;flex-direction:column;gap:10px;}',
      '.lp-ask-input{',
      '  width:100%;box-sizing:border-box;resize:none;min-height:64px;',
      '  border:1px solid rgba(13,148,136,.22);border-radius:10px;padding:10px 12px;',
      '  font-size:14px;line-height:1.5;color:#22403c;font-family:inherit;',
      '}',
      '.lp-ask-input:focus{outline:none;border-color:#0d9488;box-shadow:0 0 0 3px rgba(13,148,136,.12);}',
      '.lp-ask-submit{',
      '  align-self:flex-end;border:none;border-radius:999px;cursor:pointer;',
      '  background:#0d9488;color:#fff;font-size:13px;font-weight:600;padding:9px 18px;',
      '}',
      '.lp-ask-submit:hover{background:#0b7d73;}',
      '.lp-ask-reply{margin-top:4px;font-size:13px;line-height:1.6;color:#3a5854;}',
      '.lp-ask-reply .lp-ask-note{color:#7d938f;font-size:12px;margin:6px 0 10px;}',
      '.lp-ask-reply-cta{',
      '  display:inline-flex;align-items:center;gap:6px;',
      '  background:rgba(13,148,136,.1);color:#0d9488;text-decoration:none;',
      '  font-weight:600;padding:9px 16px;border-radius:999px;font-size:13px;',
      '}',
      '.lp-ask-reply-cta:hover{background:rgba(13,148,136,.18);}',
      '@media (max-width:640px){',
      '  .lp-ask-launcher{right:14px;bottom:14px;}',
      '  .lp-ask-panel{right:14px;bottom:70px;}',
      '}',
      '@media (prefers-reduced-motion:reduce){',
      '  .lp-ask-launcher,.lp-ask-panel{transition:none;}',
      '}'
    ].join('');
    (d.head || d.documentElement).appendChild(st);
  }

  // ---- DOM 빌드 ------------------------------------------------------------
  function buildLauncher() {
    var btn = d.createElement('button');
    btn.type = 'button';
    btn.className = 'lp-ask-launcher';
    btn.setAttribute('aria-label', t('ask.launcher_aria', '안내 도우미 열기'));
    btn.setAttribute('aria-expanded', 'false');
    var ic = d.createElement('span'); ic.className = 'lp-ask-ic'; ic.setAttribute('aria-hidden', 'true'); ic.textContent = '?';
    var lb = d.createElement('span'); lb.textContent = t('ask.launcher_label', '무엇이든 물어보기');
    btn.appendChild(ic); btn.appendChild(lb);
    btn.addEventListener('click', toggle);
    return btn;
  }

  function buildPanel() {
    var state = visitorState();
    var panel = d.createElement('div');
    panel.className = 'lp-ask-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('aria-label', t('ask.panel_title', '무엇을 도와드릴까요?'));

    var head = d.createElement('div'); head.className = 'lp-ask-head';
    var title = d.createElement('div'); title.className = 'lp-ask-title'; title.textContent = t('ask.panel_title', '무엇을 도와드릴까요?');
    var close = d.createElement('button');
    close.type = 'button'; close.className = 'lp-ask-close';
    close.setAttribute('aria-label', t('ask.close_label', '닫기')); close.textContent = '×';
    close.addEventListener('click', closePanel);
    head.appendChild(title); head.appendChild(close);

    var hint = d.createElement('p'); hint.className = 'lp-ask-hint';
    var h = HINT[state] || HINT.first_time_visitor;
    hint.textContent = t(h[0], h[1]);

    var form = d.createElement('form'); form.className = 'lp-ask-form';
    var input = d.createElement('textarea');
    input.className = 'lp-ask-input';
    input.setAttribute('rows', '2');
    input.setAttribute('placeholder', t('ask.input_placeholder', '예: 나의 강점을 어떻게 살리면 좋을까요?'));
    input.setAttribute('aria-label', t('ask.panel_title', '무엇을 도와드릴까요?'));
    var submit = d.createElement('button');
    submit.type = 'submit'; submit.className = 'lp-ask-submit';
    submit.textContent = t('ask.submit_label', '안내 받기');
    form.appendChild(input); form.appendChild(submit);

    var reply = d.createElement('div'); reply.className = 'lp-ask-reply'; reply.style.display = 'none';

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      handleSubmit(input, reply, state);
    });

    panel.appendChild(head);
    panel.appendChild(hint);
    panel.appendChild(form);
    panel.appendChild(reply);
    return panel;
  }

  // ---- 제출 처리 (P2 이연: LLM 없이 컨텍스트 CTA 안내) ----------------------
  function handleSubmit(input, reply, state) {
    var q = (input.value || '').trim();
    if (!q) {
      reply.style.display = '';
      reply.textContent = t('ask.reply_empty', '한 줄만 적어주셔도 괜찮아요.');
      input.focus();
      return;
    }
    track('ask_submit', { visitor_state: state, len: q.length });

    var cta = primaryCTA(state);
    reply.innerHTML = '';
    reply.style.display = '';

    var intro = d.createElement('div');
    intro.textContent = t('ask.reply_intro', '이렇게 이어가 보시면 좋아요.');
    var note = d.createElement('div');
    note.className = 'lp-ask-note';
    note.textContent = t('ask.reply_note_soon', '더 깊은 대화 기능은 곧 준비됩니다. 지금은 아래 흐름을 권해드려요.');

    var a = d.createElement('a');
    a.className = 'lp-ask-reply-cta';
    a.href = cta.href;
    a.textContent = t(cta.key, cta.fb);
    a.addEventListener('click', function () { track(cta.event, { visitor_state: state }); });

    reply.appendChild(intro);
    reply.appendChild(note);
    reply.appendChild(a);
  }

  // ---- 열기/닫기 -----------------------------------------------------------
  function openPanel() {
    if (!PANEL) return;
    OPEN = true;
    PANEL.classList.add('is-open');
    if (LAUNCHER) LAUNCHER.setAttribute('aria-expanded', 'true');
    track('ask_open', { visitor_state: visitorState() });
    var inp = PANEL.querySelector('.lp-ask-input');
    if (inp) { try { inp.focus(); } catch (e) {} }
    d.addEventListener('keydown', onEsc);
  }

  function closePanel() {
    if (!PANEL) return;
    OPEN = false;
    PANEL.classList.remove('is-open');
    if (LAUNCHER) LAUNCHER.setAttribute('aria-expanded', 'false');
    d.removeEventListener('keydown', onEsc);
  }

  function onEsc(e) { if (e.key === 'Escape' || e.keyCode === 27) closePanel(); }

  function toggle() { OPEN ? closePanel() : openPanel(); }

  // ---- 마운트 --------------------------------------------------------------
  function mount() {
    if (MOUNTED) return;
    if (!d.body) return;
    injectStyleOnce();
    ROOT = d.createElement('div');
    ROOT.id = 'lp-ask-root';
    LAUNCHER = buildLauncher();
    PANEL = buildPanel();
    ROOT.appendChild(PANEL);
    ROOT.appendChild(LAUNCHER);
    d.body.appendChild(ROOT);
    MOUNTED = true;
  }

  w.LP_ASK = { open: openPanel, close: closePanel, toggle: toggle, mount: mount };

  function boot() {
    var start = function () {
      if (w.LP_I18N && typeof w.LP_I18N.onReady === 'function') {
        w.LP_I18N.onReady(mount);
      } else {
        mount();
      }
    };
    // 방문자 상태를 힌트/CTA 에 쓰므로 LP_VISITOR 준비를 기다린다(없으면 즉시).
    if (w.LP_VISITOR && typeof w.LP_VISITOR.onReady === 'function') {
      w.LP_VISITOR.onReady(start);
    } else {
      start();
    }
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(window, document);
