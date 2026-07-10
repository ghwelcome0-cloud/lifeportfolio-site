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
      '#' + SLOT_ID + ' .lp-mpc-overlay-cta{display:inline-block;padding:9px 18px;border-radius:10px;background:#17384c;color:#fff;font-size:14px;font-weight:600;text-decoration:none}',
      // ─── B6-2 진단완료 4축 그리드 (배경/여백/tier 라벨) ───
      '#' + SLOT_ID + ' .lp-mpc-axis-card{gap:10px;background:#FAFAF7;box-shadow:var(--mpc-glow,none);transition:box-shadow .2s ease,transform .2s ease}',
      '#' + SLOT_ID + ' .lp-mpc-axis-card .lp-mpc-axis{color:#2C3E4F}',
      '#' + SLOT_ID + ' .lp-mpc-tier{font-size:13px;font-weight:700}',
      '#' + SLOT_ID + ' .lp-mpc-pct{font-weight:600;opacity:.7;font-size:12px;margin-left:2px}',
      '#' + SLOT_ID + ' .lp-mpc-card--empty{background:#EDEDED;border:1px solid #E3E3DE}'
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

  // ══════════════════════════════════════════════════════════════════════
  // B6-1 · tier 색 mapping 유틸 (신규 · report.html L1688 SSOT 재사용, 하드코딩 없음)
  //   tier 의미론 = "좋음/나쁨"이 아니라 "축의 시기"
  //     deep(숙성)=깊다 · active(활성)=살아있다 · emerging(발현)=나타난다 · seed(씨앗)=시작한다
  // ══════════════════════════════════════════════════════════════════════
  var TIER_COLOR = {
    deep:     '#0d9488', // teal-600 숙성 — 깊게 자리 잡은 축
    active:   '#f97316', // orange-500 활성 — 살아 움직이는 축
    emerging: '#4f46e5', // indigo-600 발현 — 지금 나타나는 축
    seed:     '#64748b'  // slate-500 씨앗 — 이제 시작인 축
  };
  var TIER_ORDER = { deep: 4, active: 3, emerging: 2, seed: 1 }; // 강도 서열(참고용)
  function tierColor(tier) {
    return TIER_COLOR[(tier || '').toString().toLowerCase()] || TIER_COLOR.seed;
  }
  // '#0d9488' + alpha(0~1) → rgba 문자열 (glow/tint 강도 통제용)
  function tierRgba(tier, alpha) {
    var hex = tierColor(tier).replace('#', '');
    var r = parseInt(hex.substring(0, 2), 16);
    var g = parseInt(hex.substring(2, 4), 16);
    var b = parseInt(hex.substring(4, 6), 16);
    var a = (typeof alpha === 'number') ? Math.max(0, Math.min(1, alpha)) : 1;
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  // report.sections → { 한글축명: {tier, pct} } 파생 (report.html extractAxisData 구조 동형)
  var _AXIS_IDS = ['self_understanding', 'self_expression', 'self_design', 'self_execution'];
  function axisTierMapFromReport(report) {
    if (!report || !Array.isArray(report.sections)) return null;
    var map = {};
    report.sections.forEach(function (s) {
      if (s && _AXIS_IDS.indexOf(s.id) !== -1 && s.content) {
        var ko = (w.LP_AXIS_CODE && w.LP_AXIS_CODE.toKo) ? w.LP_AXIS_CODE.toKo(s.id) : s.id;
        map[ko] = {
          tier: (s.content.tier || '').toString().toLowerCase(),
          pct: (typeof s.content.pct === 'number') ? s.content.pct : null
        };
      }
    });
    return Object.keys(map).length ? map : null;
  }

  // report → 약축/강축 파생 후 localStorage 캐시 (정본=RTDB, 캐시=로컬)
  // B6: 축별 tier/pct 맵 + 순위도 메모리 캐시(_axisState)하여 render 에서 재사용
  var _axisState = null;
  function applyAxesFromReport(report) {
    if (!report || !w.LP_AXIS_CODE) return null;
    var weak = w.LP_AXIS_CODE.weakFromReport(report);
    var strong = w.LP_AXIS_CODE.strongFromReport(report);
    try {
      if (weak) w.localStorage.setItem('lp_weak_axis', weak);
      if (strong) w.localStorage.setItem('lp_strong_axis', strong);
    } catch (e) {}
    // B6: 4축 그리드 렌더용 상태 캐시 (강→약 순위 + 축별 tier/pct)
    _axisState = {
      ranking: w.LP_AXIS_CODE.rankingFromReport(report), // 한글 배열 강→약
      tierMap: axisTierMapFromReport(report),            // { 축명: {tier,pct} }
      strong: strong,
      weak: weak
    };
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

  // ══════════════════════════════════════════════════════════════════════
  // B6-2 · 4축 그리드 (진단 완료 · renderActive 상단 · "인식" 층)
  //   axis 순서는 고정(이해→표현→설계→실행), 색은 각 축의 tier(상태) 색.
  //   강도(glow/tint/grow)는 B6-3에서 적용 — 이 단계는 카드 골격 + tier border-left.
  // ══════════════════════════════════════════════════════════════════════
  var _AXIS_KO_ORDER = ['자기이해', '자기표현', '자기설계', '자기실행'];

  // tier → 시기 어휘 (좋음/나쁨 아님)
  function tierWord(tier) {
    var k = (tier || '').toString().toLowerCase();
    var map = { deep: 'tier_deep', active: 'tier_active', emerging: 'tier_emerging', seed: 'tier_seed' };
    var fb = { deep: '깊다', active: '살아있다', emerging: '나타난다', seed: '시작한다' };
    return t('curation.' + (map[k] || 'tier_seed'), fb[k] || fb.seed);
  }

  // 축명(한글) → i18n 라벨 (없으면 원본)
  function axisLabel(ko) {
    var idx = _AXIS_KO_ORDER.indexOf(ko);
    if (idx >= 0) return t(AXIS_KEYS[idx], AXIS_FB[idx]);
    return ko;
  }

  // _axisState 기반 4축 그리드 HTML. 데이터 결손 축은 회색 fallback 카드로 개별 degrade.
  function buildAxisGridHtml() {
    if (!_axisState || !_axisState.tierMap) return '';
    var tm = _axisState.tierMap;
    var ranking = _axisState.ranking || [];
    var strong = _axisState.strong, weak = _axisState.weak;
    var cards = '';
    for (var i = 0; i < _AXIS_KO_ORDER.length; i++) {
      var ko = _AXIS_KO_ORDER[i];
      var info = tm[ko];
      var label = escapeHtml(axisLabel(ko));
      if (!info || !info.tier) {
        // 개별 degrade: tier 없음 → 회색 뼈대 카드 (fallback 시각과 동일 톤)
        cards +=
          '<div class="lp-mpc-card lp-mpc-card--empty">' +
            '<div class="lp-mpc-axis">' + label + '</div>' +
            '<div class="lp-mpc-dash">' + escapeHtml(t('curation.axis_placeholder_dash', '—')) + '</div>' +
          '</div>';
        continue;
      }
      var rank = ranking.indexOf(ko); // 0=강축 … last=약축
      var roleCls = (ko === strong) ? ' is-strong' : (ko === weak ? ' is-weak' : '');
      var color = tierColor(info.tier);
      var word = escapeHtml(tierWord(info.tier));
      var pctTxt = (typeof info.pct === 'number') ? (info.pct + '%') : '';
      // ── B6-3 위계 강도 (강도 차이 아닌 "역할 차이" · PM 완화) ──
      //   강축 glow 20% → 중간축 60% grow → 약축 최소(옅은 border + 미세 tint)
      //   glow 가 "성취"처럼 읽히지 않도록 alpha 상한 0.20 통제.
      var n = ranking.length; // 유효 축 수 (보통 4, 결손 시 <4)
      var strength; // 0(약)~1(강)
      if (rank < 0 || n <= 1) strength = 0.6;                 // 순위 불명 → 중립 60%
      else strength = 1 - (rank / (n - 1));                   // rank0→1, last→0
      var isStrong = (ko === strong);
      var isWeak = (ko === weak);
      // 강축: 20% glow, 약축: tint만(8%)+옅은 border, 중간: strength*0.6 비율
      var glowA = isStrong ? 0.20 : (isWeak ? 0 : (0.20 * strength * 0.6));
      var tintA = isWeak ? 0.06 : (0.02 + 0.05 * strength);   // 약축도 미세 tint 유지(회색 방지)
      var borderPx = isStrong ? 4 : (isWeak ? 3 : 4);
      var glowStr = glowA > 0 ? ('0 4px 18px ' + tierRgba(info.tier, glowA)) : 'none';
      var cardStyle =
        'border-left:' + borderPx + 'px solid ' + tierRgba(info.tier, isWeak ? 0.55 : 1) + ';' +
        'background:' + tierRgba(info.tier, tintA) + ';' +
        '--mpc-glow:' + glowStr + ';' +
        '--mpc-tier:' + color + ';';
      cards +=
        '<div class="lp-mpc-card lp-mpc-axis-card' + roleCls + '"' +
          ' data-tier="' + escapeHtml((info.tier || '').toString().toLowerCase()) + '"' +
          ' data-rank="' + (rank >= 0 ? rank : '') + '"' +
          ' style="' + cardStyle + '">' +
          '<div class="lp-mpc-axis">' + label + '</div>' +
          '<div class="lp-mpc-tier" style="color:' + color + '">' + word +
            (pctTxt ? ' <span class="lp-mpc-pct">' + escapeHtml(pctTxt) + '</span>' : '') +
          '</div>' +
        '</div>';
    }
    return '<div class="lp-mpc-grid lp-mpc-grid--active">' + cards + '</div>';
  }

  // 진단 완료: 4축 그리드(신규 · 인식) + 기존 curation.js 단일 제안(행동) 재사용
  function renderActive(host) {
    var gridHtml = buildAxisGridHtml();
    host.innerHTML = gridHtml + '<div data-lp-curation-slot="mypage"></div>';
    if (gridHtml) track('curation_axisgrid_impression', {});
    if (!w.LP_CURATION || typeof w.LP_CURATION.render !== 'function') return;
    var slot = host.querySelector('[data-lp-curation-slot="mypage"]');
    var doRender = function () {
      w.LP_CURATION.load().then(function () {
        var card = w.LP_CURATION.render({});
        // 제안이 없으면(풀 소진 등) 단일 제안 슬롯만 비움 — 4축 그리드는 유지
        if (!card && slot) { slot.innerHTML = ''; }
      }).catch(function () { if (slot) slot.innerHTML = ''; });
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
