/**
 * PR #18 — Analytics Helper (Life Portfolio)
 * ==========================================
 * GTM dataLayer 통합 래퍼.
 * - GA4(G-C8XKL4L9MZ)와 Meta Pixel은 GTM 컨테이너(GTM-WWNXZLZX)에서 관리.
 * - 본 파일은 dataLayer push만 담당 (페이지·페이지뷰 측정은 GTM 자동).
 *
 * 표준 이벤트 (GA4 enhanced ecommerce 호환):
 *   • view_item       — /product.html 진입
 *   • assessment_start— /suvey.html 첫 문항 노출
 *   • assessment_complete — 76문항 응답 완료 시점
 *   • begin_checkout  — 결제 버튼(페이플/PayPal) 클릭
 *   • purchase        — 결제 성공 (KRW 9,900 / USD 8.99)
 *   • report_view     — /report.html 도달
 *   • generate_lead   — 회원가입 완료
 *   • login           — 로그인 완료
 *
 * 사용:
 *   LP.track('begin_checkout', { method: 'payple', value: 9900, currency: 'KRW' });
 */
(function (w) {
  'use strict';

  w.dataLayer = w.dataLayer || [];

  // ===== PR#77: UTM Source Capture (sticky for session) =====
  // 첫 진입 시 URL의 utm_* 파라미터를 sessionStorage에 저장.
  // 이후 모든 GA4 이벤트(purchase/view_item)에 traffic_source/medium/campaign 부가.
  // 광고 → 결제 어트리뷰션을 이벤트 레벨에서 보존 (GA4 세션 어트리뷰션과 별개로).
  var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  var UTM_STORAGE_KEY = 'lp_utm_v1';

  function captureUtm() {
    try {
      var params = new URLSearchParams(w.location.search);
      var captured = {};
      var hasAny = false;
      for (var i = 0; i < UTM_KEYS.length; i++) {
        var k = UTM_KEYS[i];
        var v = params.get(k);
        if (v) { captured[k] = v.substring(0, 100); hasAny = true; } // length-cap 방어
      }
      if (hasAny) {
        // 첫 진입의 UTM이 우선 (덮어쓰기 방지) — 단, 새 UTM이 있으면 갱신 (광고 클릭 재방문 케이스)
        captured._captured_at = Date.now();
        captured._referrer = (document.referrer || '').substring(0, 200);
        try { sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(captured)); } catch (e) {}
      }
    } catch (e) { /* 측정 실패는 사일런트 */ }
  }

  function getUtm() {
    try {
      var raw = sessionStorage.getItem(UTM_STORAGE_KEY);
      if (!raw) return {};
      var obj = JSON.parse(raw);
      return {
        traffic_source: obj.utm_source || '(direct)',
        traffic_medium: obj.utm_medium || '(none)',
        traffic_campaign: obj.utm_campaign || '(none)',
        traffic_term: obj.utm_term || '',
        traffic_content: obj.utm_content || ''
      };
    } catch (e) { return {}; }
  }

  // 페이지 로드 시 즉시 캡처 (GTM/GA4 페이지뷰보다 먼저 실행되도록 동기)
  captureUtm();

  var LP = {
    /**
     * 표준 이벤트 push
     * @param {string} event - GA4 표준 이벤트명
     * @param {Object} [params] - 추가 파라미터
     */
    track: function (event, params) {
      try {
        var payload = Object.assign(
          { event: event, ts: Date.now() },
          params || {}
        );
        w.dataLayer.push(payload);
        if (w.LP_DEBUG) {
          // eslint-disable-next-line no-console
          console.log('[LP analytics]', payload);
        }
      } catch (e) {
        // 측정 실패가 결제 흐름을 막아서는 안 됨 — silent fail
      }
    },

    /** Enhanced Ecommerce: 결제 시작 (페이플/PayPal 공통) */
    beginCheckout: function (method, currency, value) {
      var utm = getUtm();
      this.track('begin_checkout', Object.assign({
        method: method,           // 'payple' | 'paypal'
        currency: currency,       // 'KRW' | 'USD'
        value: value,             // 9900 | 8.99
        items: [{
          item_id: 'LP-ONLYONE-001',
          item_name: 'Life Portfolio Only One Report',
          item_brand: '인생포트폴리오',
          price: value,
          quantity: 1
        }]
      }, utm));
    },

    /** Enhanced Ecommerce: 결제 완료 (전환 핵심 이벤트) */
    purchase: function (method, currency, value, transactionId) {
      var utm = getUtm();
      this.track('purchase', Object.assign({
        method: method,
        currency: currency,
        value: value,
        transaction_id: transactionId || ('lp_' + Date.now()),
        items: [{
          item_id: 'LP-ONLYONE-001',
          item_name: 'Life Portfolio Only One Report',
          item_brand: '인생포트폴리오',
          price: value,
          quantity: 1
        }]
      }, utm));
    },

    /** Enhanced Ecommerce: 상품 페이지 노출 (source dimension 포함) */
    viewItem: function (currency, value) {
      var utm = getUtm();
      this.track('view_item', Object.assign({
        currency: currency || 'KRW',
        value: (value == null) ? 9900 : value,
        items: [{
          item_id: 'LP-ONLYONE-001',
          item_name: 'Life Portfolio Only One Report',
          item_brand: '인생포트폴리오',
          price: (value == null) ? 9900 : value,
          quantity: 1
        }]
      }, utm));
    },

    /** 76문항 진단 시작 */
    assessmentStart: function () {
      this.track('assessment_start', { item_id: 'LP-ASSESSMENT-76Q' });
    },

    /** 76문항 응답 완료 */
    assessmentComplete: function (durationMs) {
      this.track('assessment_complete', {
        item_id: 'LP-ASSESSMENT-76Q',
        duration_ms: durationMs || null
      });
    },

    /** 리포트 열람 (전달 단계 전환) */
    reportView: function (lang) {
      this.track('report_view', {
        item_id: 'LP-ONLYONE-001',
        lang: lang || (document.documentElement.lang || 'ko')
      });
    },

    /** 회원가입 완료 */
    signup: function (provider) {
      this.track('sign_up', { method: provider || 'google' });
      this.track('generate_lead', { method: provider || 'google' }); // GA4 광고 최적화용
    },

    /** 로그인 완료 */
    login: function (provider) {
      this.track('login', { method: provider || 'google' });
    }
  };

  // 글로벌 노출
  w.LP = w.LP || {};
  w.LP.track = LP.track.bind(LP);
  w.LP.beginCheckout = LP.beginCheckout.bind(LP);
  w.LP.purchase = LP.purchase.bind(LP);
  w.LP.viewItem = LP.viewItem.bind(LP);
  // 디버그/테스트용 — 캡처된 UTM 조회 (운영 환경에서는 사용 안 함)
  w.LP._getUtm = getUtm;
  w.LP.assessmentStart = LP.assessmentStart.bind(LP);
  w.LP.assessmentComplete = LP.assessmentComplete.bind(LP);
  w.LP.reportView = LP.reportView.bind(LP);
  w.LP.signup = LP.signup.bind(LP);
  w.LP.login = LP.login.bind(LP);

  // 기본 page_view는 GTM이 자동 처리하므로 여기서 푸시하지 않음.
})(window);
