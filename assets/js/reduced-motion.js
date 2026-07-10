/* ============================================================
   reduced-motion.js — B7-1 Purposeful Motion 이중 방어 인프라 (JS)
   ------------------------------------------------------------
   목적 : CSS 미디어쿼리를 우회하는 JS 기반 모션(IntersectionObserver·
          requestAnimationFrame·setTimeout stagger 등)을 위한 공통 가드.
          B7-2~6 각 페이지 스크립트가 window.LP_MOTION.prefersReduced()로
          단일 진입점을 통해 감속 여부를 판정한다.
   근거 : index.html L2798 검증 패턴(window.matchMedia('(prefers-reduced-motion: reduce)'))
          을 SSOT 헬퍼로 승격. B8 이중 방어(CSS + JS) 재사용.
   원칙 : 방어막 선구축. 현 시점 모션 0건 → 어떤 요소도 조작하지 않음.
          부작용 없는 순수 판정 헬퍼만 노출(시각 변화 0).
   주의 : DOM 변경·스타일 주입 없음. 판정 결과만 반환.
   ============================================================ */
(function (w) {
  "use strict";
  if (w.LP_MOTION) return; // 중복 로드 방어

  function prefersReduced() {
    try {
      return !!(w.matchMedia && w.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch (_) {
      return false; // matchMedia 미지원 환경은 모션 허용(기존 index 정책 정합)
    }
  }

  /* 감속 상태 변화 구독(선택). B7-2~ 페이지에서 런타임 토글 대응이 필요할 때 사용.
     콜백에 boolean(reduce 여부)을 전달. 미지원 환경은 no-op. */
  function onChange(cb) {
    if (typeof cb !== "function") return function () {};
    try {
      var mq = w.matchMedia("(prefers-reduced-motion: reduce)");
      var handler = function (e) { cb(!!e.matches); };
      if (mq.addEventListener) { mq.addEventListener("change", handler); }
      else if (mq.addListener) { mq.addListener(handler); }
      return function () {
        if (mq.removeEventListener) { mq.removeEventListener("change", handler); }
        else if (mq.removeListener) { mq.removeListener(handler); }
      };
    } catch (_) {
      return function () {};
    }
  }

  w.LP_MOTION = {
    prefersReduced: prefersReduced,
    onChange: onChange
  };
})(window);
