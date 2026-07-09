/**
 * mypage-curation.js — Life Portfolio (P0 마이페이지 큐레이션 위젯)
 * =============================================================================
 * 마이페이지 전용 큐레이션 위젯. 인사 스트립(#lp-ambient-slot) 바로 아래에
 * 큐레이션 카드 영역을 삽입한다.
 *
 * P0 사양(대표 확정 2026-07-10):
 *   - 배치: 인사 스트립 바로 아래 (여백 최소 40px)
 *   - 진단 완료 회원: 기존 curation.js 단일 제안(약축 콘텐츠 1개) 노출
 *   - 진단 미완료 회원: 4축 회색 뼈대(placeholder) + fallback 오버레이 문구
 *   - 섹션 타이틀: P0 미표시 (P1.5에서 확정)
 *
 * 데이터 흐름:
 *   mypage.html(module) 이 RTDB report 로드 완료 시점에 축을 파생하여
 *   localStorage(lp_weak_axis / lp_strong_axis)에 캐시하고,
 *   window.LP_MYPAGE_CURATION.render({ hasReport }) 를 호출한다.
 *   → 진단 데이터(약축)는 curation.js 의 weak_axis_first 규칙에 자동 반영.
 *
 * 노출: window.LP_MYPAGE_CURATION = {
 *   applyAxesFromReport(report),  // report → 축 파생 + localStorage 캐시
 *   render({ hasReport }),        // 위젯 렌더 (완료: 실제 제안 / 미완료: fallback)
 * }
 *
 * 비파괴: 신규 파일. 기존 mypage 로드/렌더 흐름 미변경(호출만 추가).
 */
(function (w, d) {
  'use strict';

  var SLOT_ID = 'lp-mypage-curation';
  var STYLE_ID = 'lp-mypage-curation-style';

  function t(key, fb) {
    try {
      if (w.LP_I18N && typeof w.LP_I18N.t === 'function') return w.LP_I18N.t(key, fb);
    } catch (e) {}
    return fb;
  }
  function lang() {
    try { return (w.LP_I18N && w.LP_I18N.lang) || 'ko'; } catch (e) { return 'ko'; }
  }

  function injectStyleOnce() {
    if (d.getElementById(STYLE_ID)) return;
    var css = [
      '#' + SLOT_ID + '{margin-top:40px;margin-bottom:8px}',
      '#' + SLOT_ID + ' .lp-mpc-fallback{position:relative;border-radius:14px;overflow:hidden}',
      '#' + SLOT_ID + ' .lp-mpc-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}',
      '@media (max-width:640px){#' + SLOT_ID + ' .lp-mpc-grid{grid-template-columns:repeat(2,1fr)}}',
      '#' + SLOT_ID + ' .lp-mpc-card{background:#EDEDED;border-radius:12px;padding:18px 14px;min-height:96px;display:flex;flex-direction:column;justify-content:space-between}',
      '#' + SLOT_ID + ' .lp-mpc-axis{font-size:13px;font-weight:700;color:#8a8f94}',
      '#' + SLOT_ID + ' .lp-mpc-dash{font-size:22px;font-weight:700;color:#c4c8cc;letter-spacing:2px}',
      '#' + SLOT_ID + ' .lp-mpc-overlay{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:rgba(247,248,249,.72);backdrop-filter:blur(1px);text-align:center;padding:16px}',
      '#' + SLOT_ID + ' .lp-mpc-overlay-text{font-size:15px;font-weight:600;color:#3a4650;line-height:1.5;max-width:340px}',
      '#' + SLOT_ID + ' .lp-mpc-overlay-cta{display:inline-block;padding:9px 18px;border-radius:10px;background:#17384c;color:#fff;font-size:14px;font-weight:600;text-decoration:none}'
    ].join('\n');
    var style = d.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    d.head.appendChild(style);
  }

  // 인사 스트립(#lp-ambient-slot) 바로 아래에 위젯 컨테이너를 확보(1회).
  function ensureSlot() {
    var existing = d.getElementById(SLOT_ID);
    if (existing) return existing;
    var host = d.createElement('section');
    host.id = SLOT_ID;
    host.setAttribute('aria-label', 'curation');
    var anchor = d.getElementById('lp-ambient-slot');
    if (anchor && anchor.parentNode) {
      // 인사 스트립 바로 다음 형제로 삽입
      if (anchor.nextSibling) anchor.parentNode.insertBefore(host, anchor.nextSibling);
      else anchor.parentNode.appendChild(host);
    } else {
      // 폴백: 컨테이너 상단
      var container = d.querySelector('.container') || d.body;
      container.insertBefore(host, container.firstChild);
    }
    return host;
  }

  // report → 약축/강축 파생 후 localStorage 캐시 (정본=RTDB, 캐시=로컬)
  function applyAxesFromReport(report) {
    if (!report || !w.LP_AXIS_CODE) return null;
    var weak = w.LP_AXIS_CODE.weakFromReport(report);
    var strong = w.LP_AXIS_CODE.strongFromReport(report);
    try {
      if (weak) w.localStorage.setItem('lp_weak_axis', weak);
      if (strong) w.localStorage.setItem('lp_strong_axis', strong);
    } catch (e) {}
    return { weak: weak, strong: strong };
  }

  var AXIS_KEYS = [
    'curation.axis_understanding',
    'curation.axis_expression',
    'curation.axis_design',
    'curation.axis_execution'
  ];
  var AXIS_FB = ['자기이해', '자기표현', '자기설계', '자기실행'];

  // 진단 미완료: 4축 회색 뼈대 + fallback 오버레이
  function renderFallback(host) {
    var dash = t('curation.axis_placeholder_dash', '—');
    var cards = '';
    for (var i = 0; i < 4; i++) {
      cards +=
        '<div class="lp-mpc-card">' +
          '<div class="lp-mpc-axis">' + escapeHtml(t(AXIS_KEYS[i], AXIS_FB[i])) + '</div>' +
          '<div class="lp-mpc-dash">' + escapeHtml(dash) + '</div>' +
        '</div>';
    }
    var msg = t('curation.fallback_locked', '진단을 완료하시면, 여기서부터 맞춤 큐레이션이 시작됩니다');
    var cta = t('curation.fallback_cta', '진단 시작하기');
    host.innerHTML =
      '<div class="lp-mpc-fallback">' +
        '<div class="lp-mpc-grid">' + cards + '</div>' +
        '<div class="lp-mpc-overlay">' +
          '<div class="lp-mpc-overlay-text">' + escapeHtml(msg) + '</div>' +
          '<a class="lp-mpc-overlay-cta" href="product">' + escapeHtml(cta) + '</a>' +
        '</div>' +
      '</div>';
    track('curation_fallback_impression', {});
  }

  // 진단 완료: 기존 curation.js 단일 제안 재사용 (data-lp-curation-slot 슬롯 위임)
  function renderActive(host) {
    host.innerHTML = '<div data-lp-curation-slot="mypage"></div>';
    if (!w.LP_CURATION || typeof w.LP_CURATION.render !== 'function') return;
    var doRender = function () {
      w.LP_CURATION.load().then(function () {
        var card = w.LP_CURATION.render({});
        // 제안이 없으면(풀 소진 등) 위젯 자체를 비워 빈 카드 방지
        if (!card) { host.innerHTML = ''; }
      }).catch(function () { host.innerHTML = ''; });
    };
    if (w.LP_I18N && typeof w.LP_I18N.onReady === 'function') w.LP_I18N.onReady(doRender);
    else doRender();
  }

  function render(opts) {
    opts = opts || {};
    injectStyleOnce();
    var host = ensureSlot();
    if (opts.hasReport) renderActive(host);
    else renderFallback(host);
    return host;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function track(ev, data) {
    try { if (w.LP && typeof w.LP.track === 'function') w.LP.track(ev, data || {}); } catch (e) {}
  }

  w.LP_MYPAGE_CURATION = {
    applyAxesFromReport: applyAxesFromReport,
    render: render
  };
})(window, document);
