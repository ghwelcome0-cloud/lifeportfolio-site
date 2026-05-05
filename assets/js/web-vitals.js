/*!
 * PR #19 — Real User Monitoring (RUM) for Core Web Vitals
 * --------------------------------------------------------
 * Loads the Google web-vitals v4 library on idle and pushes 5 metrics
 * (LCP, INP, CLS, FCP, TTFB) into `window.dataLayer` so that GTM /
 * GA4 can capture them as a `web_vitals` event.
 *
 * Why a separate file?
 *   - Loaded with `defer` from every page, never blocks rendering.
 *   - Uses `requestIdleCallback` so it competes with NOTHING during LCP.
 *   - Falls back to setTimeout for Safari (no rIC support).
 *
 * GA4 setup:
 *   In GA4 → Admin → Custom definitions create:
 *     · Event-scoped param `metric_name` (string)
 *     · Event-scoped param `metric_value` (number)
 *     · Event-scoped param `metric_rating` (string)
 *     · Event-scoped param `metric_id` (string)
 *   Then explore in:  Reports → Engagement → Events → web_vitals
 */
(function () {
  "use strict";

  // Skip in non-browser / SSR / very old engines
  if (typeof window === "undefined" || !("performance" in window)) return;

  // Skip when the page is being prerendered or hidden — we want real user data
  if (document.prerendering) {
    document.addEventListener("prerenderingchange", boot, { once: true });
  } else {
    boot();
  }

  function boot() {
    var run = function () {
      // Library is fetched only once and cached via the HTTP layer.
      var src = "https://unpkg.com/web-vitals@4/dist/web-vitals.attribution.iife.js";
      var s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.crossOrigin = "anonymous";
      s.referrerPolicy = "no-referrer-when-downgrade";
      s.onload = wire;
      s.onerror = function () {
        // Fallback CDN
        var s2 = document.createElement("script");
        s2.src = "https://cdn.jsdelivr.net/npm/web-vitals@4/dist/web-vitals.attribution.iife.js";
        s2.async = true;
        s2.crossOrigin = "anonymous";
        s2.onload = wire;
        document.head.appendChild(s2);
      };
      document.head.appendChild(s);
    };

    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(run, { timeout: 4000 });
    } else {
      setTimeout(run, 1500);
    }
  }

  function wire() {
    var wv = window.webVitals;
    if (!wv) return;

    window.dataLayer = window.dataLayer || [];

    function send(metric) {
      try {
        // Round to integers for CLS×1000, ms otherwise — GA4 stores ints reliably
        var roundedValue = metric.name === "CLS"
          ? Math.round(metric.value * 1000)
          : Math.round(metric.value);

        window.dataLayer.push({
          event: "web_vitals",
          metric_name: metric.name,            // LCP | INP | CLS | FCP | TTFB
          metric_value: roundedValue,          // number
          metric_rating: metric.rating || "",  // good | needs-improvement | poor
          metric_id: metric.id,                // unique per metric per pageview
          metric_delta: Math.round(metric.delta * (metric.name === "CLS" ? 1000 : 1)),
          metric_navigation_type: metric.navigationType || "",
          page_path: location.pathname,
          page_lang: (document.documentElement.getAttribute("lang") || "ko").toLowerCase()
        });
      } catch (e) {
        // Silent — RUM must never break the page
        if (window.console && console.warn) {
          console.warn("[web-vitals] dispatch failed:", e && e.message);
        }
      }
    }

    // Each function fires when the metric is final (or page hidden, for CLS/INP)
    if (typeof wv.onLCP === "function") wv.onLCP(send);
    if (typeof wv.onINP === "function") wv.onINP(send);
    if (typeof wv.onCLS === "function") wv.onCLS(send);
    if (typeof wv.onFCP === "function") wv.onFCP(send);
    if (typeof wv.onTTFB === "function") wv.onTTFB(send);
  }
})();
