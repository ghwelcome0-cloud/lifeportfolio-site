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
      this.track('begin_checkout', {
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
      });
    },

    /** Enhanced Ecommerce: 결제 완료 (전환 핵심 이벤트) */
    purchase: function (method, currency, value, transactionId) {
      this.track('purchase', {
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
      });
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
  w.LP.assessmentStart = LP.assessmentStart.bind(LP);
  w.LP.assessmentComplete = LP.assessmentComplete.bind(LP);
  w.LP.reportView = LP.reportView.bind(LP);
  w.LP.signup = LP.signup.bind(LP);
  w.LP.login = LP.login.bind(LP);

  // 기본 page_view는 GTM이 자동 처리하므로 여기서 푸시하지 않음.
})(window);
