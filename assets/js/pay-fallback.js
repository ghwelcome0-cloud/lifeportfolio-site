/**
 * 국내 결제(페이플)가 안 될 때 → PayPal로 부드럽게 이어가기 (2026-10-15 대표 확정 문구, 최종 기획안 v3 7.1)
 * 제휴 결제 페이지(partner.html)와 일반 결제 페이지(product-v2.html)가 함께 쓴다.
 *
 *   LP_PAY_FALLBACK.show({ mount, usdLabel, createOrder, onApprove, onRetry, supportHref })
 *     - mount      : 안내를 넣을 요소
 *     - usdLabel   : "$9.66" 처럼 버튼에 보일 금액
 *     - createOrder: () => Promise<orderID>  (서버가 금액을 정한다)
 *     - onApprove  : (orderID) => Promise<void>
 *   LP_PAY_FALLBACK.isUserCancel(authResult) : 고객이 스스로 닫은 경우인지 (이때는 안내를 띄우지 않는다)
 */
(function (w, d) {
  "use strict";
  var LIVE = "Aemkoc7ad-iB2AaUpeG_LfC4k-5tGyFbh9wsjwU5ZcezRL4sszFpr2dYlYSdFVQNRGrjTK_ysmFf7y7p";
  var SANDBOX = "AZdLWi-wTbZ_-Ji82KKgSJA6_rQpidRX01RVxBnjvxw5HoHE7FTnswIApVOLmnf0XuwRKJLPpBePszOA";
  function clientId() { return location.hostname === "lifeportfolio.co.kr" ? LIVE : SANDBOX; }
  var sdk = null;
  function loadSdk() {
    if (w.paypal && w.paypal.Buttons) return Promise.resolve();
    if (sdk) return sdk;
    sdk = new Promise(function (res, rej) {
      var s = d.createElement("script");
      s.src = "https://www.paypal.com/sdk/js?" + new URLSearchParams({ "client-id": clientId(), currency: "USD", intent: "capture", components: "buttons", "disable-funding": "credit,paylater", locale: "ko_KR" }).toString();
      s.async = true; s.onload = function () { res(); }; s.onerror = function () { sdk = null; rej(new Error("PayPal")); };
      d.head.appendChild(s);
    });
    return sdk;
  }
  function css() {
    if (d.getElementById("lp-fb-css")) return;
    var st = d.createElement("style"); st.id = "lp-fb-css";
    st.textContent = ".lp-fb{background:#eef6f4;border:1px solid #cfe3de;border-radius:14px;padding:18px 18px 14px;margin:14px 0;color:#21423c;word-break:keep-all;line-height:1.65}" +
      ".lp-fb h3{margin:0 0 6px;font-size:16px;font-weight:800;color:#2F5B54;display:flex;gap:8px;align-items:center}.lp-fb h3 span{display:inline-grid;place-items:center;width:22px;height:22px;border-radius:50%;background:#2F5B54;color:#fff;font-size:13px}" +
      ".lp-fb p{margin:0 0 8px;font-size:14px}.lp-fb .lp-fb-amt{font-weight:800;color:#2F5B54;margin:4px 0 8px}.lp-fb .lp-fb-small{font-size:12.5px;color:#4f6b65}" +
      ".lp-fb .lp-fb-links{display:flex;flex-wrap:wrap;gap:4px 16px;margin-top:8px}.lp-fb .lp-fb-links a,.lp-fb .lp-fb-links button{font:inherit;font-size:13.5px;color:#2F5B54;text-decoration:underline;background:none;border:0;padding:8px 0;min-height:44px;cursor:pointer}" +
      ".lp-fb .lp-fb-pp{min-height:48px;margin:6px 0}.lp-fb .lp-fb-msg{font-size:13px;min-height:1em}";
    d.head.appendChild(st);
  }
  function isUserCancel(r) {
    var rst = String((r && (r.PCD_PAY_RST || r.PCD_PAY_RESULT)) || "").toLowerCase();
    var msg = String((r && r.PCD_PAY_MSG) || "");
    return rst === "close" || /취소|닫/.test(msg) || /cancel/i.test(msg);
  }
  function show(o) {
    css();
    var m = o.mount; if (!m) return;
    m.hidden = false;
    m.innerHTML = '<section class="lp-fb" role="status" aria-live="polite">' +
      '<h3><span aria-hidden="true">i</span>다른 결제 방법으로 바로 이어갈 수 있어요</h3>' +
      '<p>지금 국내 결제창이 잠시 연결되지 않아요. 결제는 되지 않았으니 안심하세요.<br>PayPal로도 같은 ' + (o.partner ? '혜택가로' : '가격으로') + ' 바로 시작하실 수 있어요.</p>' +
      '<p class="lp-fb-amt">PayPal로 이어서 결제하기 · ' + o.usdLabel + '</p>' +
      '<div class="lp-fb-pp" id="lpFbPaypal"></div>' +
      '<p class="lp-fb-small">달러로 결제되며 카드사 환율과 해외 결제 수수료에 따라 청구액이 조금 다를 수 있어요.</p>' +
      '<p class="lp-fb-msg" id="lpFbMsg"></p>' +
      '<p class="lp-fb-links"><button type="button" id="lpFbRetry">국내 결제 다시 시도</button><a href="' + (o.supportHref || "mailto:faise@lifeportfolio.co.kr") + '">도움이 필요하면 고객지원</a></p></section>';
    var msg = d.getElementById("lpFbMsg");
    d.getElementById("lpFbRetry").addEventListener("click", function () { m.hidden = true; if (o.onRetry) o.onRetry(); });
    loadSdk().then(function () {
      w.paypal.Buttons({
        style: { layout: "vertical", color: "gold", shape: "rect", label: "paypal", height: 45 },
        onClick: function (data, actions) { if (o.beforeClick && o.beforeClick() === false) return actions.reject(); return actions.resolve(); },
        createOrder: function () { msg.textContent = "안전한 주문을 만드는 중…"; return o.createOrder().then(function (id) { msg.textContent = ""; return id; }, function (e) { msg.textContent = (e && e.message) || "결제를 시작하지 못했어요. 다시 시도해 주세요."; throw e; }); },
        onApprove: function (data) { msg.textContent = "결제를 확인하는 중…"; return o.onApprove(data.orderID).catch(function (e) { msg.textContent = (e && e.message) || "결제 확인에 실패했어요. 결제가 되었다면 고객지원으로 알려 주세요."; }); },
        onCancel: function () { msg.textContent = "결제를 취소했어요."; },
        onError: function () { msg.textContent = "PayPal 연결 중 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요."; }
      }).render("#lpFbPaypal");
    }, function () { msg.textContent = "PayPal을 불러오지 못했어요. 새로고침 후 다시 시도해 주세요."; });
    try { m.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (_) {}
  }
  w.LP_PAY_FALLBACK = { show: show, isUserCancel: isUserCancel, loadSdk: loadSdk };
})(window, document);
