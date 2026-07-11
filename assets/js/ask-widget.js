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
        return { key: 'ask.reply_cta_report', fb: '리포트 만들기', href: '/suvey', event: 'ask_cta_report' };   /* hotfix: /survey(404)→/suvey(사이트 전역 정규 경로, HTTP 200). 파일명 suvey.html 컨벤션 준수. 링크 문자열만 수정. */
      case 'first_time_visitor':
      default:
        return { key: 'ask.reply_cta_report', fb: '리포트 만들기', href: '/suvey', event: 'ask_cta_report' };   /* hotfix: /survey(404)→/suvey(사이트 전역 정규 경로, HTTP 200). 파일명 suvey.html 컨벤션 준수. 링크 문자열만 수정. */
    }
  }

  // ---- 스타일 (teal 테마, ambient 와 톤 일치) -------------------------------
  function injectStyleOnce() {
    if (d.getElementById('lp-ask-style')) return;
    var st = d.createElement('style');
    st.id = 'lp-ask-style';
    st.textContent = [
      /* B8-1: 상시 대화 창구로서 시각 승격 (크기·패딩·shadow 상향) */
      '.lp-ask-launcher{',
      '  position:fixed;right:24px;bottom:24px;z-index:2147483000;',
      '  display:inline-flex;align-items:center;gap:9px;',
      '  padding:14px 20px;border:none;border-radius:999px;cursor:pointer;',
      '  background:#0d9488;color:#fff;font-size:15px;font-weight:600;letter-spacing:-0.01em;',
      '  box-shadow:0 8px 26px rgba(13,148,136,.32),0 2px 6px rgba(13,148,136,.18);',
      '  transition:transform .2s ease,box-shadow .2s ease,opacity .3s ease;',
      '}',
      /* B8-3: hover 확장은 hover 가능 기기(desktop)로 격리 (B7 원칙 선반영) */
      '@media (hover:hover){',
      '  .lp-ask-launcher:hover{transform:translateY(-2px);box-shadow:0 12px 32px rgba(13,148,136,.38),0 3px 8px rgba(13,148,136,.2);}',
      '  .lp-ask-launcher:hover .lp-ask-ic{background:rgba(255,255,255,.28);}',
      '}',
      /* B8-3: touch 기기(hover 불가)는 상시 강조 — 항상 존재감 있는 대화 창구 */
      '@media (hover:none){',
      '  .lp-ask-launcher{box-shadow:0 10px 30px rgba(13,148,136,.36),0 3px 8px rgba(13,148,136,.2);}',
      '  .lp-ask-launcher:active{transform:scale(.97);}',
      '}',
      /* B8-2: breathing motion 2.6s — 상시 대화 창구의 조용한 호흡 (shadow 미세 확장/수축) */
      '@keyframes lp-ask-breathe{',
      '  0%,100%{box-shadow:0 8px 26px rgba(13,148,136,.32),0 2px 6px rgba(13,148,136,.18);}',
      '  50%{box-shadow:0 12px 34px rgba(13,148,136,.42),0 3px 9px rgba(13,148,136,.24);}',
      '}',
      '.lp-ask-launcher.is-breathing{animation:lp-ask-breathe 2.6s ease-in-out infinite;}',
      /* 패널 열림/호버 시 호흡 정지 (의미 충돌 방지) */
      '.lp-ask-launcher.is-breathing:hover,.lp-ask-root.is-panel-open .lp-ask-launcher.is-breathing{animation:none;}',
      /* B8-1: 아이콘을 원형 배경으로 감싸 "대화 창구" 시각 명료화 */
      '.lp-ask-launcher .lp-ask-ic{',
      '  display:inline-flex;align-items:center;justify-content:center;',
      '  width:24px;height:24px;border-radius:50%;background:rgba(255,255,255,.18);',
      '  font-size:15px;font-weight:700;line-height:1;',
      '}',
      '.lp-ask-panel{',
      '  position:fixed;right:24px;bottom:88px;z-index:2147483000;',
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
      '.lp-ask-reply{margin-top:4px;font-size:13px;line-height:1.6;color:#3a5854;display:flex;flex-direction:column;align-items:flex-start;gap:8px;}',
      '.lp-ask-reply .lp-ask-note{color:#7d938f;font-size:12px;margin:0;}',
      '.lp-ask-reply .lp-ask-axisline{color:#0f5f57;font-weight:600;}',
      '.lp-ask-reply .lp-ask-content{',
      '  display:block;width:100%;box-sizing:border-box;text-decoration:none;',
      '  background:rgba(13,148,136,.06);border:1px solid rgba(13,148,136,.16);',
      '  border-radius:10px;padding:10px 12px;color:#153f3a;font-weight:600;line-height:1.4;',
      '}',
      '.lp-ask-reply .lp-ask-content:hover{background:rgba(13,148,136,.12);}',
      '.lp-ask-reply-cta{',
      '  display:inline-flex;align-items:center;gap:6px;',
      '  background:rgba(13,148,136,.1);color:#0d9488;text-decoration:none;',
      '  font-weight:600;padding:9px 16px;border-radius:999px;font-size:13px;',
      '}',
      '.lp-ask-reply-cta:hover{background:rgba(13,148,136,.18);}',
      /* B7-6: 답변(+CTA) 등장 시 미세 fade (선택 · opacity만 · display 무접촉).
         초기 은닉은 .is-revealing 게이트로만 활성 → JS 정상 조건에서만 부여
         (reduce·JS오류 시 미부여 → 즉시 표시). 기존 breathing/hover 와 무관. */
      '.lp-ask-reply.is-revealing{opacity:0;}',
      '.lp-ask-reply.is-revealing.is-shown{opacity:1;transition:opacity .28s ease-out;}',
      /* E그룹 P1.5: 대화 지속형 스레드 (chat-core 연동) */
      '.lp-ask-thread{display:flex;flex-direction:column;gap:12px;max-height:min(46vh,340px);overflow-y:auto;margin:0 0 12px;padding:2px 2px 4px;}',
      '.lp-ask-msg{max-width:92%;font-size:13.5px;line-height:1.6;border-radius:14px;padding:10px 13px;white-space:pre-wrap;word-break:break-word;}',
      '.lp-ask-msg.is-bot{align-self:flex-start;background:rgba(13,148,136,.07);border:1px solid rgba(13,148,136,.14);color:#22403c;border-bottom-left-radius:5px;}',
      '.lp-ask-msg.is-user{align-self:flex-end;background:#0d9488;color:#fff;border-bottom-right-radius:5px;}',
      '.lp-ask-msg.is-safety{background:#FFF6EC;border:1px solid #E7C79A;color:#6b4a1e;}',
      '.lp-ask-msg .lp-ask-reask{display:block;margin-top:7px;color:#0f5f57;font-weight:600;}',
      '.lp-ask-ctarow{display:flex;flex-wrap:wrap;gap:7px;align-self:flex-start;margin-top:-4px;}',
      '.lp-ask-ctarow a{display:inline-flex;align-items:center;gap:5px;background:rgba(13,148,136,.1);color:#0d9488;text-decoration:none;font-weight:600;padding:8px 14px;border-radius:999px;font-size:12.5px;border:1px solid rgba(13,148,136,.18);}',
      '.lp-ask-ctarow a:hover{background:rgba(13,148,136,.18);}',
      '.lp-ask-msg.is-enter{opacity:0;transform:translateY(6px);}',
      '.lp-ask-msg.is-enter.is-in{opacity:1;transform:none;transition:opacity .26s ease-out,transform .26s ease-out;}',
      /* E그룹 P1.6: 3층 곁의 자산 — 블로그 카드 / 말씀 카드 */
      '.lp-ask-enrich{align-self:flex-start;max-width:96%;display:flex;flex-direction:column;gap:8px;margin-top:-4px;}',
      '.lp-ask-blog{display:block;text-decoration:none;background:rgba(13,148,136,.06);border:1px solid rgba(13,148,136,.16);border-radius:12px;padding:11px 13px;}',
      '.lp-ask-blog:hover{background:rgba(13,148,136,.11);}',
      '.lp-ask-blog .lp-ask-blog-kicker{display:block;font-size:11px;font-weight:700;letter-spacing:.02em;color:#0d9488;margin-bottom:3px;}',
      '.lp-ask-blog .lp-ask-blog-title{display:block;font-size:13.5px;font-weight:700;color:#153f3a;line-height:1.4;}',
      '.lp-ask-blog .lp-ask-blog-quote{display:block;font-size:12px;color:#5a736e;line-height:1.5;margin-top:4px;}',
      '.lp-ask-verse{background:#FBF8F0;border:1px solid #E7DCC2;border-radius:12px;padding:11px 13px;}',
      '.lp-ask-verse .lp-ask-verse-kicker{display:block;font-size:11px;font-weight:700;color:#9a7b3a;letter-spacing:.02em;margin-bottom:4px;}',
      '.lp-ask-verse .lp-ask-verse-everyday{display:block;font-size:13px;color:#5a4a2a;line-height:1.6;}',
      '.lp-ask-verse .lp-ask-verse-source{display:block;font-size:12px;color:#7a6740;line-height:1.55;margin-top:6px;font-style:italic;}',
      '.lp-ask-verse .lp-ask-verse-ref{display:block;font-size:11px;color:#9a8657;margin-top:4px;text-align:right;}',
      '@media (prefers-reduced-motion:reduce){.lp-ask-msg.is-enter,.lp-ask-msg.is-enter.is-in{opacity:1!important;transform:none!important;transition:none!important;}}',
      '@media (max-width:640px){',
      '  .lp-ask-launcher{right:16px;bottom:16px;padding:13px 18px;font-size:14px;}',
      '  .lp-ask-panel{right:16px;bottom:78px;}',
      '}',
      '@media (prefers-reduced-motion:reduce){',
      '  .lp-ask-launcher,.lp-ask-panel{transition:none;}',
      '  .lp-ask-launcher.is-breathing{animation:none;}',  /* B8-2: 모션 민감 사용자 호흡 비활성 */
      '  .lp-ask-reply.is-revealing,.lp-ask-reply.is-revealing.is-shown{opacity:1!important;transition:none!important;}',  /* B7-6: 답변 fade 무력화 */
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

  // E그룹 P1.5: 스레드/입력 참조 (chat-core 연동)
  var THREAD = null;
  var GREETED = false;

  // E그룹 P1.6: 4층 코칭 엔진 대화 컨텍스트
  //   CHAT_THREAD  : respond()에 넘길 대화 히스토리(국면 진행 판정용)
  //   LAST_SIGNAL  : 직전 감지 신호(대화 지속 fallback·목격 반복 방지용)
  var CHAT_THREAD = [];
  var LAST_SIGNAL = null;

  // 언어 컨텍스트(EN/KO) — 큐레이션·말씀 렌더 언어 결정
  function currentLang() {
    try {
      if (typeof w._lpLang === 'function') return w._lpLang();
      if (w.LP_I18N && w.LP_I18N.lang) return w.LP_I18N.lang;
      var l = (d.documentElement.getAttribute('lang') || 'ko').toLowerCase();
      return l.indexOf('en') === 0 ? 'en' : 'ko';
    } catch (e) { return 'ko'; }
  }

  function buildPanel() {
    var state = visitorState();
    var panel = d.createElement('div');
    panel.className = 'lp-ask-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('aria-label', t('ask.panel_title', '함께 이야기하기'));

    var head = d.createElement('div'); head.className = 'lp-ask-head';
    var title = d.createElement('div'); title.className = 'lp-ask-title'; title.textContent = t('ask.panel_title', '함께 이야기하기');
    var close = d.createElement('button');
    close.type = 'button'; close.className = 'lp-ask-close';
    close.setAttribute('aria-label', t('ask.close_label', '닫기')); close.textContent = '×';
    close.addEventListener('click', closePanel);
    head.appendChild(title); head.appendChild(close);

    // 대화 스레드 (aria-live 로 스크린리더 낭독)
    var thread = d.createElement('div');
    thread.className = 'lp-ask-thread';
    thread.setAttribute('role', 'log');
    thread.setAttribute('aria-live', 'polite');
    thread.setAttribute('aria-label', t('ask.thread_aria', '대화 내용'));
    THREAD = thread;

    var form = d.createElement('form'); form.className = 'lp-ask-form';
    var input = d.createElement('textarea');
    input.className = 'lp-ask-input';
    input.setAttribute('rows', '2');
    input.setAttribute('placeholder', t('ask.input_placeholder', '지금 마음에 걸리는 한 가지를 적어 보세요'));
    input.setAttribute('aria-label', t('ask.panel_title', '함께 이야기하기'));
    var submit = d.createElement('button');
    submit.type = 'submit'; submit.className = 'lp-ask-submit';
    submit.textContent = t('ask.submit_label', '나누기');
    form.appendChild(input); form.appendChild(submit);

    // Enter 제출 / Shift+Enter 줄바꿈
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' && !ev.shiftKey) {
        ev.preventDefault();
        if (typeof form.requestSubmit === 'function') form.requestSubmit();
        else handleSubmit(input);
      }
    });
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      handleSubmit(input);
    });

    panel.appendChild(head);
    panel.appendChild(thread);
    panel.appendChild(form);
    return panel;
  }

  // ── 스레드 메시지 추가 헬퍼 ────────────────────────────────────────────────
  function scrollThread() {
    if (THREAD) { try { THREAD.scrollTop = THREAD.scrollHeight; } catch (e) {} }
  }
  function reduced() {
    try {
      if (w.LP_MOTION && typeof w.LP_MOTION.prefersReduced === 'function') return w.LP_MOTION.prefersReduced();
      return w.matchMedia && w.matchMedia('(prefers-reduced-motion:reduce)').matches;
    } catch (e) { return false; }
  }
  function enterAnim(el) {
    if (reduced()) return;
    el.classList.add('is-enter');
    (w.requestAnimationFrame || function (f) { return setTimeout(f, 16); })(function () { el.classList.add('is-in'); });
  }
  // 사용자 말풍선
  function pushUser(text) {
    if (!THREAD) return;
    var m = d.createElement('div'); m.className = 'lp-ask-msg is-user';
    m.textContent = text;
    THREAD.appendChild(m); enterAnim(m); scrollThread();
  }
  // 봇 응답 (lines[] + optional reask + optional ctas[]) — 모든 출력 sanitize 통과
  function pushBot(lines, opts) {
    if (!THREAD) return;
    opts = opts || {};
    var m = d.createElement('div');
    m.className = 'lp-ask-msg is-bot' + (opts.safety ? ' is-safety' : '');
    var san = (w.LP_CHAT && w.LP_CHAT.sanitize) ? w.LP_CHAT.sanitize : function (s) { return s; };
    (lines || []).forEach(function (ln, i) {
      if (i > 0) m.appendChild(d.createElement('br'));
      m.appendChild(d.createTextNode(san(ln)));
    });
    if (opts.reask) {
      var rk = d.createElement('span'); rk.className = 'lp-ask-reask';
      rk.textContent = san(opts.reask);
      m.appendChild(rk);
    }
    THREAD.appendChild(m); enterAnim(m);
    // CTA 행 (있을 때만)
    if (opts.ctas && opts.ctas.length) {
      var row = d.createElement('div'); row.className = 'lp-ask-ctarow';
      opts.ctas.forEach(function (c) {
        var a = d.createElement('a');
        a.href = c.href || '#';
        a.textContent = c.label;
        a.addEventListener('click', function () { track(c.event || 'chat_cta', { visitor_state: visitorState() }); });
        row.appendChild(a);
      });
      THREAD.appendChild(row); enterAnim(row);
    }
    scrollThread();
  }

  // 3층 보강 렌더 — 블로그 카드 1장 + (신앙 병행 시) 말씀 1구절.
  //   말씀 헌법: 일상어(everyday) 먼저, 원문·출처(source_text/reference) 함께.
  //   원문 없이 일상어만 단독 노출 금지 → source_text 없으면 말씀 카드 생략.
  function pushEnrich(enrich) {
    if (!THREAD || !enrich) return;
    if (!enrich.blog && !enrich.verse) return;
    var san = (w.LP_CHAT && w.LP_CHAT.sanitize) ? w.LP_CHAT.sanitize : function (s) { return s; };
    var box = d.createElement('div'); box.className = 'lp-ask-enrich';

    // 블로그 카드(곁의 자산 큐레이션)
    if (enrich.blog && enrich.blog.title) {
      var a = d.createElement('a');
      a.className = 'lp-ask-blog';
      a.href = enrich.blog.url || '#';
      var k = d.createElement('span'); k.className = 'lp-ask-blog-kicker'; k.textContent = t('ask.enrich_blog_kicker', '곁에 둘 이야기 한 편');
      var ti = d.createElement('span'); ti.className = 'lp-ask-blog-title'; ti.textContent = san(enrich.blog.title);
      a.appendChild(k); a.appendChild(ti);
      if (enrich.blog.quote) {
        var qu = d.createElement('span'); qu.className = 'lp-ask-blog-quote'; qu.textContent = san(enrich.blog.quote);
        a.appendChild(qu);
      }
      a.addEventListener('click', function () { track('chat_enrich_blog', { visitor_state: visitorState() }); });
      box.appendChild(a);
    }

    // 말씀 카드(신앙 병행 시에만, 원문·출처 보존)
    if (enrich.verse && enrich.verse.everyday && enrich.verse.source_text) {
      var vb = d.createElement('div'); vb.className = 'lp-ask-verse';
      var vk = d.createElement('span'); vk.className = 'lp-ask-verse-kicker'; vk.textContent = t('ask.enrich_verse_kicker', '함께 곁들이는 한 말씀');
      var ve = d.createElement('span'); ve.className = 'lp-ask-verse-everyday'; ve.textContent = san(enrich.verse.everyday);
      var vs = d.createElement('span'); vs.className = 'lp-ask-verse-source'; vs.textContent = '“' + san(enrich.verse.source_text) + '”';
      var vr = d.createElement('span'); vr.className = 'lp-ask-verse-ref';
      vr.textContent = san(enrich.verse.reference || '') + (enrich.verse.translation ? (' · ' + san(enrich.verse.translation)) : '');
      vb.appendChild(vk); vb.appendChild(ve); vb.appendChild(vs); vb.appendChild(vr);
      box.appendChild(vb);
    }

    if (box.childNodes.length) { THREAD.appendChild(box); enterAnim(box); scrollThread(); }
  }

  // ---- 입력 → 4축 매핑 (규칙 기반, 부분 문자열 매칭) -----------------------
  // 축별 매칭 점수를 세고, 동점이면 방문자 상태 우선 축으로 tie-break.
  // 어느 축에도 매칭 안 되면 null → fallback(상태별 CTA만).
  function detectAxis(text, state) {
    var dict = w.LP_AXIS_KEYWORDS;
    if (!dict || !dict.map || !text) return null;
    var q = String(text).toLowerCase();
    var scores = {};
    var anyHit = false;
    Object.keys(dict.map).forEach(function (axis) {
      var kws = dict.map[axis] || [];
      var s = 0;
      for (var i = 0; i < kws.length; i++) {
        if (q.indexOf(String(kws[i]).toLowerCase()) >= 0) s++;
      }
      scores[axis] = s;
      if (s > 0) anyHit = true;
    });
    if (!anyHit) return null;

    // 최고점 축(들) 추출
    var max = -1;
    Object.keys(scores).forEach(function (a) { if (scores[a] > max) max = scores[a]; });
    var top = Object.keys(scores).filter(function (a) { return scores[a] === max; });
    if (top.length === 1) return top[0];
    // 동점 tie-break: 상태 우선 축이 후보에 있으면 그것, 아니면 첫 후보
    var pref = dict.order && dict.order[state];
    if (pref && top.indexOf(pref) >= 0) return pref;
    return top[0];
  }

  // 축 라벨 → 안내 문구 (i18n)
  var AXIS_LABEL = {
    '자기이해': ['ask.axis_understanding', '자기이해'],
    '자기표현': ['ask.axis_expression', '자기표현'],
    '자기설계': ['ask.axis_design', '자기설계'],
    '자기실행': ['ask.axis_action', '자기실행']
  };

  // ---- 제출 처리 (E그룹 P1.5: chat-core 규칙 기반 대화 엔진 연동) -----------
  //   §3 위젯 = 대화 지속형. FAQ 응답기 아님. 매 응답 끝에 '결 있는 되물음' 우선.
  //   모든 출력은 chat-core.respond() 가 sanitize(§2.3 never_expose) 를 이미 통과.
  function handleSubmit(input) {
    var q = (input.value || '').trim();
    if (!q) { try { input.focus(); } catch (e) {} return; }

    pushUser(q);
    input.value = '';
    try { input.focus(); } catch (e) {}

    var state = visitorState();
    track('ask_submit', { visitor_state: state, len: q.length });

    // chat-core 미로드 시 우아한 실패 (§4.4) — 절대 조작하지 않음
    if (!w.LP_CHAT || typeof w.LP_CHAT.respond !== 'function') {
      pushBot(['지금은 이 부분까지 곁에서 함께 볼 수 있어요.']);
      return;
    }

    // 사용자 발화를 대화 히스토리에 기록(국면 진행 판정용).
    CHAT_THREAD.push({ role: 'user', text: q });

    // 4층 엔진 컨텍스트: 스레드 + 직전 신호 + 언어 + 3층 비동기 보강 콜백.
    var ctx = {
      state: state,
      thread: CHAT_THREAD.slice(),
      lastSignal: LAST_SIGNAL,
      lang: currentLang(),
      onEnrich: function (enrich) { pushEnrich(enrich); }
    };

    var r = w.LP_CHAT.respond(q, ctx);
    pushBot(r.lines, { safety: r.safety, reask: r.reask, ctas: r.ctas });

    // 봇 응답을 히스토리에 기록 + 감지 신호 기억(다음 턴 국면 진행/지속 fallback).
    CHAT_THREAD.push({ role: 'bot', text: (r.lines || []).join(' ') });
    if (r.signal) LAST_SIGNAL = r.signal;
  }

  // ---- 열기/닫기 -----------------------------------------------------------
  function openPanel() {
    if (!PANEL) return;
    OPEN = true;
    PANEL.classList.add('is-open');
    if (ROOT) ROOT.classList.add('is-panel-open');   // B8-2: 열림 시 호흡 정지 트리거
    if (LAUNCHER) LAUNCHER.setAttribute('aria-expanded', 'true');
    track('ask_open', { visitor_state: visitorState() });

    // E그룹 §5: 첫 인사(회원 3분기) — 1회만. chat-core.memberState() 실시간 판정.
    if (!GREETED && w.LP_CHAT && typeof w.LP_CHAT.memberState === 'function') {
      GREETED = true;
      w.LP_CHAT.memberState().then(function (state) {
        var g = w.LP_CHAT.greeting(state);
        pushBot(g.lines, { ctas: g.cta ? [g.cta] : [] });
        // 인사는 국면 진행에 세지 않는다(open 국면은 첫 사용자 발화부터).
      }).catch(function () {
        // memberState 실패 시에도 게스트 인사로 안전 착지
        try {
          var gg = w.LP_CHAT.greeting('guest');
          pushBot(gg.lines, { ctas: gg.cta ? [gg.cta] : [] });
        } catch (e) {}
      });
    }

    var inp = PANEL.querySelector('.lp-ask-input');
    if (inp) { try { inp.focus(); } catch (e) {} }
    d.addEventListener('keydown', onEsc);
  }

  function closePanel() {
    if (!PANEL) return;
    OPEN = false;
    PANEL.classList.remove('is-open');
    if (ROOT) ROOT.classList.remove('is-panel-open');  // B8-2: 닫힘 시 호흡 재개
    if (LAUNCHER) LAUNCHER.setAttribute('aria-expanded', 'false');
    d.removeEventListener('keydown', onEsc);
  }

  function onEsc(e) { if (e.key === 'Escape' || e.keyCode === 27) closePanel(); }

  function toggle() { OPEN ? closePanel() : openPanel(); }

  // ---- 마운트 --------------------------------------------------------------
  function mount() {
    if (MOUNTED) return;
    if (!d.body) return;
    // 큐레이션 매트릭스 미리 로드(제출 시 pickByAxis 즉시 응답 위해). 실패해도 무시.
    try { if (w.LP_CURATION && w.LP_CURATION.load) w.LP_CURATION.load(); } catch (e) {}
    injectStyleOnce();
    ROOT = d.createElement('div');
    ROOT.id = 'lp-ask-root';
    ROOT.className = 'lp-ask-root';   // B8-2: 호흡 정지 셀렉터(.lp-ask-root.is-panel-open) 매칭용
    LAUNCHER = buildLauncher();
    PANEL = buildPanel();
    ROOT.appendChild(PANEL);
    ROOT.appendChild(LAUNCHER);
    d.body.appendChild(ROOT);
    MOUNTED = true;
    // B8-2: breathing motion 활성 (reduced-motion 사용자는 JS 단에서도 제외 — 이중 방어)
    try {
      var reduce = w.matchMedia && w.matchMedia('(prefers-reduced-motion:reduce)').matches;
      if (!reduce && LAUNCHER) LAUNCHER.classList.add('is-breathing');
    } catch (e) {}
    // B8-4: 시간대 hook 사전 심기 — A2 getTimeBand() 재사용(신규 로직 없음).
    //       data-lp-time 속성만 부여하며 가시적 동작은 미변경(B9 톤 변주용 배선).
    applyTimeBand();
  }

  // B8-4: 시간대 밴드를 data-lp-time 속성으로 배선(B9 hook). 실패해도 위젯 정상 동작.
  function applyTimeBand() {
    try {
      var band = (w.LP_AMBIENT && typeof w.LP_AMBIENT.getTimeBand === 'function')
        ? w.LP_AMBIENT.getTimeBand()
        : null;
      if (!band) return;
      if (ROOT) ROOT.setAttribute('data-lp-time', band);
      if (LAUNCHER) LAUNCHER.setAttribute('data-lp-time', band);
    } catch (e) {}
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
