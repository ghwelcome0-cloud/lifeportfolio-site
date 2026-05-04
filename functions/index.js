/**
 * LifePortfolio - Firebase Functions
 * ===================================
 * PayPal Smart Buttons (EN mode) 결제 흐름의 서버 사이드 검증을 담당합니다.
 *
 * Endpoints (HTTPS callable):
 *   - createPaypalOrder: PayPal 주문 생성(서버에서 amount 강제) → orderID 반환
 *   - capturePaypalOrder: PayPal 주문 캡처(결제 확정) → 검증 후 RTDB payments/{uid} 기록
 *
 * 보안 원칙:
 *   - 클라이언트는 절대 amount/currency를 결정할 수 없음 (서버에서 고정)
 *   - PayPal Secret은 functions.config()로만 주입 (코드에 절대 하드코딩 금지)
 *   - 모든 호출은 Firebase Auth 토큰 필수 (context.auth)
 *   - 캡처 시 PayPal API의 status === "COMPLETED" 확인 후에만 RTDB 기록
 *
 * 환경변수 설정 (CLI):
 *   firebase functions:config:set \
 *     paypal.env="sandbox" \
 *     paypal.client_id_sandbox="..." \
 *     paypal.secret_sandbox="..." \
 *     paypal.client_id_live="..." \
 *     paypal.secret_live="..." \
 *     paypal.price_usd="8.99"
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fetch = require("node-fetch");

admin.initializeApp();

// =====================================================================
// PayPal API 설정
// =====================================================================
const PAYPAL_API = {
  sandbox: "https://api-m.sandbox.paypal.com",
  live: "https://api-m.paypal.com",
};

function getPaypalConfig() {
  const cfg = functions.config().paypal || {};
  const env = (cfg.env || "sandbox").toLowerCase();
  const isLive = env === "live" || env === "production";

  return {
    env: isLive ? "live" : "sandbox",
    apiBase: isLive ? PAYPAL_API.live : PAYPAL_API.sandbox,
    clientId: isLive ? cfg.client_id_live : cfg.client_id_sandbox,
    secret: isLive ? cfg.secret_live : cfg.secret_sandbox,
    priceUSD: cfg.price_usd || "8.99",
    currency: "USD",
  };
}

/**
 * PayPal OAuth2 access token 획득
 */
async function getPaypalAccessToken() {
  const cfg = getPaypalConfig();
  if (!cfg.clientId || !cfg.secret) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "PayPal credentials are not configured. Run firebase functions:config:set."
    );
  }

  const auth = Buffer.from(`${cfg.clientId}:${cfg.secret}`).toString("base64");
  const res = await fetch(`${cfg.apiBase}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("PayPal token error:", res.status, text);
    throw new functions.https.HttpsError(
      "internal",
      "Failed to obtain PayPal access token."
    );
  }

  const data = await res.json();
  return data.access_token;
}

// =====================================================================
// Helper: 인증 검증
// =====================================================================
function requireAuth(context) {
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Authentication required."
    );
  }
  return context.auth.uid;
}

// =====================================================================
// 1) createPaypalOrder
//    - 클라이언트(EN 모드)가 PayPal 버튼 onCreateOrder 콜백에서 호출
//    - 서버에서 USD 금액 고정 후 PayPal에 주문 생성
//    - 반환: { orderID }
// =====================================================================
exports.createPaypalOrder = functions
  .region("asia-northeast3")
  .runWith({ timeoutSeconds: 30, memory: "256MB" })
  .https.onCall(async (data, context) => {
    const uid = requireAuth(context);
    const cfg = getPaypalConfig();

    // 이미 결제 완료된 사용자 차단
    const existingSnap = await admin
      .database()
      .ref(`payments/${uid}/paid`)
      .once("value");
    if (existingSnap.val() === true) {
      throw new functions.https.HttpsError(
        "already-exists",
        "Payment already completed for this account."
      );
    }

    const accessToken = await getPaypalAccessToken();

    // 서버에서 금액 결정 (클라이언트 입력 절대 신뢰하지 않음)
    const orderPayload = {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: `lp_${uid}_${Date.now()}`,
          description: "LifePortfolio - One-time diagnostic test & report",
          custom_id: uid,
          amount: {
            currency_code: cfg.currency,
            value: cfg.priceUSD,
          },
        },
      ],
      application_context: {
        brand_name: "LifePortfolio",
        landing_page: "NO_PREFERENCE",
        shipping_preference: "NO_SHIPPING",
        user_action: "PAY_NOW",
      },
    };

    const res = await fetch(`${cfg.apiBase}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": `lp_create_${uid}_${Date.now()}`,
      },
      body: JSON.stringify(orderPayload),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("PayPal create order error:", res.status, text);
      throw new functions.https.HttpsError(
        "internal",
        "Failed to create PayPal order."
      );
    }

    const order = await res.json();

    // 주문 생성 로그를 RTDB에 임시 기록(아직 paid=false)
    await admin.database().ref(`payments/${uid}/_pending`).set({
      provider: "paypal",
      env: cfg.env,
      orderID: order.id,
      amount: cfg.priceUSD,
      currency: cfg.currency,
      createdAt: admin.database.ServerValue.TIMESTAMP,
    });

    return { orderID: order.id };
  });

// =====================================================================
// 2) capturePaypalOrder
//    - 클라이언트가 PayPal onApprove 콜백에서 호출
//    - 서버에서 PayPal 주문 캡처 → status === COMPLETED 검증
//    - RTDB payments/{uid}에 paid=true, source=paypal, captureID 등 기록
// =====================================================================
exports.capturePaypalOrder = functions
  .region("asia-northeast3")
  .runWith({ timeoutSeconds: 30, memory: "256MB" })
  .https.onCall(async (data, context) => {
    const uid = requireAuth(context);
    const cfg = getPaypalConfig();
    const orderID = (data && data.orderID || "").toString().trim();

    if (!orderID || orderID.length > 80) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Valid orderID is required."
      );
    }

    // 중복 결제 차단
    const existingSnap = await admin
      .database()
      .ref(`payments/${uid}/paid`)
      .once("value");
    if (existingSnap.val() === true) {
      throw new functions.https.HttpsError(
        "already-exists",
        "Payment already completed."
      );
    }

    const accessToken = await getPaypalAccessToken();

    // PayPal 주문 캡처 호출
    const res = await fetch(
      `${cfg.apiBase}/v2/checkout/orders/${encodeURIComponent(orderID)}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "PayPal-Request-Id": `lp_capture_${uid}_${Date.now()}`,
        },
      }
    );

    const captureData = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("PayPal capture error:", res.status, captureData);
      throw new functions.https.HttpsError(
        "internal",
        "Failed to capture PayPal order."
      );
    }

    // 검증: status === COMPLETED 인지 확인
    const status = captureData.status;
    if (status !== "COMPLETED") {
      console.warn("PayPal capture not completed:", status, captureData);
      throw new functions.https.HttpsError(
        "failed-precondition",
        `Payment not completed (status=${status}).`
      );
    }

    // 캡처 정보 추출
    const pu = (captureData.purchase_units && captureData.purchase_units[0]) || {};
    const cap =
      (pu.payments && pu.payments.captures && pu.payments.captures[0]) || {};
    const captureID = cap.id || "";
    const amountValue = (cap.amount && cap.amount.value) || cfg.priceUSD;
    const amountCurrency = (cap.amount && cap.amount.currency_code) || cfg.currency;
    const customId = pu.custom_id || "";

    // 추가 검증: custom_id 가 본인 uid 와 일치해야 함
    if (customId && customId !== uid) {
      console.error("Custom ID mismatch:", customId, uid);
      throw new functions.https.HttpsError(
        "permission-denied",
        "Order owner mismatch."
      );
    }

    // 추가 검증: 금액이 서버 설정 가격과 일치해야 함
    if (amountCurrency !== cfg.currency || amountValue !== cfg.priceUSD) {
      console.warn("Amount mismatch:", amountValue, amountCurrency, "expected", cfg.priceUSD, cfg.currency);
      // 위변조 가능성 → 차단
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Payment amount/currency mismatch."
      );
    }

    // RTDB 기록 (paid=true)
    const nowIso = new Date().toISOString();
    await admin.database().ref(`payments/${uid}`).update({
      paid: true,
      createdAt: nowIso,
      source: "paypal",
      provider: "paypal",
      env: cfg.env,
      orderID: orderID,
      captureID: captureID,
      amount: amountValue,
      currency: amountCurrency,
      _pending: null,
    });

    return {
      ok: true,
      status,
      orderID,
      captureID,
      amount: amountValue,
      currency: amountCurrency,
    };
  });

// =====================================================================
// 3) (선택) healthCheck — 배포 확인용
// =====================================================================
exports.paypalHealthCheck = functions
  .region("asia-northeast3")
  .https.onCall(async (data, context) => {
    const cfg = getPaypalConfig();
    return {
      ok: true,
      env: cfg.env,
      hasClientId: !!cfg.clientId,
      hasSecret: !!cfg.secret,
      priceUSD: cfg.priceUSD,
      currency: cfg.currency,
    };
  });
