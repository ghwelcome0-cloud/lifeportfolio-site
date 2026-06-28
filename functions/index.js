/**
 * LifePortfolio - Firebase Functions (v2 + Secret Manager)
 * =========================================================
 * PayPal Smart Buttons (EN mode) 결제 흐름의 서버 사이드 검증을 담당합니다.
 *
 * Endpoints (HTTPS callable):
 *   - createPaypalOrder: PayPal 주문 생성(서버에서 amount 강제) → orderID 반환
 *   - capturePaypalOrder: PayPal 주문 캡처(결제 확정) → 검증 후 RTDB payments/{uid} 기록
 *   - paypalHealthCheck: 환경 점검용
 *
 * 보안 원칙:
 *   - 클라이언트는 절대 amount/currency를 결정할 수 없음 (서버에서 고정)
 *   - PayPal Secret/Client ID는 Google Secret Manager에 저장 (defineSecret)
 *   - 모든 호출은 Firebase Auth 토큰 필수 (request.auth)
 *   - 캡처 시 PayPal API의 status === "COMPLETED" 확인 후에만 RTDB 기록
 *
 * 시크릿 등록 (CLI):
 *   firebase functions:secrets:set PAYPAL_CLIENT_ID_SANDBOX
 *   firebase functions:secrets:set PAYPAL_SECRET_SANDBOX
 *   firebase functions:secrets:set PAYPAL_CLIENT_ID_LIVE      (Live 인증 후)
 *   firebase functions:secrets:set PAYPAL_SECRET_LIVE         (Live 인증 후)
 *
 * 일반 환경변수 (functions/.env 파일 — gitignore 처리됨):
 *   PAYPAL_ENV=sandbox          (또는 live)
 *   PAYPAL_PRICE_USD=14.99
 */

const { onCall, HttpsError, onRequest } = require("firebase-functions/v2/https");
const { defineSecret, defineString } = require("firebase-functions/params");
const { setGlobalOptions } = require("firebase-functions/v2");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const fetch = require("node-fetch");
const crypto = require("crypto");

admin.initializeApp();

// =====================================================================
// 글로벌 옵션 (모든 함수에 적용)
// =====================================================================
setGlobalOptions({
  region: "asia-northeast3",
  maxInstances: 10,
});

// =====================================================================
// Secret Manager 정의 (Google Secret Manager에 저장)
// =====================================================================
const PAYPAL_CLIENT_ID_SANDBOX = defineSecret("PAYPAL_CLIENT_ID_SANDBOX");
const PAYPAL_SECRET_SANDBOX = defineSecret("PAYPAL_SECRET_SANDBOX");
const PAYPAL_CLIENT_ID_LIVE = defineSecret("PAYPAL_CLIENT_ID_LIVE");
const PAYPAL_SECRET_LIVE = defineSecret("PAYPAL_SECRET_LIVE");

// ─────────────────────────────────────────────────────────────────────
// 페이플(Payple) 결제창 직접연동 (A2) — 서버측 최종승인 + uid 검증
//   PAYPLE_CST_ID    : 가맹점 ID (결제창 + 서버승인 공용)
//   PAYPLE_CUST_KEY  : 서버 전용 키 (절대 클라이언트 노출 금지)
//   PAYPLE_CLIENT_KEY: 결제창 호출용 클라이언트 키 (클라 전달 가능)
// ※ 환불 Key는 본 단계 미사용 (환불 자동화 시 추가)
// ─────────────────────────────────────────────────────────────────────
const PAYPLE_CST_ID = defineSecret("PAYPLE_CST_ID");
const PAYPLE_CUST_KEY = defineSecret("PAYPLE_CUST_KEY");
const PAYPLE_CLIENT_KEY = defineSecret("PAYPLE_CLIENT_KEY");

// =====================================================================
// 일반 환경변수 (functions/.env 파일에서 읽음)
// =====================================================================
const PAYPAL_ENV_PARAM = defineString("PAYPAL_ENV", { default: "sandbox" });
const PAYPAL_PRICE_USD_PARAM = defineString("PAYPAL_PRICE_USD", { default: "14.99" });

// =====================================================================
// PayPal API 베이스
// =====================================================================
const PAYPAL_API = {
  sandbox: "https://api-m.sandbox.paypal.com",
  live: "https://api-m.paypal.com",
};

/**
 * 현재 PayPal 설정 조회 (런타임)
 * 시크릿은 함수 내부에서만 .value() 호출 가능 (Secret Manager 보안)
 */
function getPaypalConfig() {
  const envRaw = (PAYPAL_ENV_PARAM.value() || "sandbox").toLowerCase();
  const isLive = envRaw === "live" || envRaw === "production";

  const clientId = isLive
    ? safeSecretValue(PAYPAL_CLIENT_ID_LIVE)
    : safeSecretValue(PAYPAL_CLIENT_ID_SANDBOX);
  const secret = isLive
    ? safeSecretValue(PAYPAL_SECRET_LIVE)
    : safeSecretValue(PAYPAL_SECRET_SANDBOX);

  return {
    env: isLive ? "live" : "sandbox",
    apiBase: isLive ? PAYPAL_API.live : PAYPAL_API.sandbox,
    clientId,
    secret,
    priceUSD: PAYPAL_PRICE_USD_PARAM.value() || "14.99",
    currency: "USD",
  };
}

/**
 * Secret 값 안전 조회 (미등록 시 빈 문자열 반환, 예외 던지지 않음)
 */
function safeSecretValue(sec) {
  try {
    return sec.value() || "";
  } catch (e) {
    return "";
  }
}

/**
 * PayPal OAuth2 access token 획득
 */
async function getPaypalAccessToken(cfg) {
  if (!cfg.clientId || !cfg.secret) {
    throw new HttpsError(
      "failed-precondition",
      "PayPal credentials are not configured. Run firebase functions:secrets:set."
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
    logger.error("PayPal token error:", { status: res.status, body: text });
    throw new HttpsError("internal", "Failed to obtain PayPal access token.");
  }

  const data = await res.json();
  return data.access_token;
}

/**
 * 인증 검증 헬퍼 (v2 callable의 request.auth 기반)
 */
function requireAuth(request) {
  const uid = request && request.auth && request.auth.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  return uid;
}

// ═════════════════════════════════════════════════════════════════════
// 🛡️ Rate Limit 공유 헬퍼 (공개 Cloud Functions 보호)
// ═════════════════════════════════════════════════════════════════════
// 공통 모듈 _rate_limit.js 에서 import — index.js / _b2b_group_module.js 양쪽이 동일 헬퍼 사용.
const { checkCallableRateLimit } = require("./_rate_limit");

// =====================================================================
// 1) createPaypalOrder
//    - 클라이언트(EN 모드)가 PayPal 버튼 createOrder 콜백에서 호출
//    - 서버에서 USD 금액 고정 후 PayPal에 주문 생성
//    - 반환: { orderID }
// =====================================================================
exports.createPaypalOrder = onCall(
  {
    secrets: [
      PAYPAL_CLIENT_ID_SANDBOX,
      PAYPAL_SECRET_SANDBOX,
      PAYPAL_CLIENT_ID_LIVE,
      PAYPAL_SECRET_LIVE,
    ],
    timeoutSeconds: 30,
    memory: "256MiB",
    cors: true,
  },
  async (request) => {
    const uid = requireAuth(request);
    const cfg = getPaypalConfig();

    // 이미 결제 완료된 사용자 차단
    const existingSnap = await admin
      .database()
      .ref(`payments/${uid}/paid`)
      .once("value");
    if (existingSnap.val() === true) {
      throw new HttpsError(
        "already-exists",
        "Payment already completed for this account."
      );
    }

    const accessToken = await getPaypalAccessToken(cfg);

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
      logger.error("PayPal create order error:", { status: res.status, body: text });
      throw new HttpsError("internal", "Failed to create PayPal order.");
    }

    const order = await res.json();

    // 주문 생성 로그를 RTDB에 임시 기록 (아직 paid=false)
    await admin.database().ref(`payments/${uid}/_pending`).set({
      provider: "paypal",
      env: cfg.env,
      orderID: order.id,
      amount: cfg.priceUSD,
      currency: cfg.currency,
      createdAt: admin.database.ServerValue.TIMESTAMP,
    });

    return { orderID: order.id };
  }
);

// =====================================================================
// 2) capturePaypalOrder
//    - 클라이언트가 PayPal onApprove 콜백에서 호출
//    - 서버에서 PayPal 주문 캡처 → status === COMPLETED 검증
//    - RTDB payments/{uid}에 paid=true, source=paypal, captureID 등 기록
// =====================================================================
exports.capturePaypalOrder = onCall(
  {
    secrets: [
      PAYPAL_CLIENT_ID_SANDBOX,
      PAYPAL_SECRET_SANDBOX,
      PAYPAL_CLIENT_ID_LIVE,
      PAYPAL_SECRET_LIVE,
    ],
    timeoutSeconds: 30,
    memory: "256MiB",
    cors: true,
  },
  async (request) => {
    const uid = requireAuth(request);
    const cfg = getPaypalConfig();
    const data = request.data || {};
    const orderID = (data.orderID || "").toString().trim();

    if (!orderID || orderID.length > 80) {
      throw new HttpsError("invalid-argument", "Valid orderID is required.");
    }

    // 중복 결제 차단
    const existingSnap = await admin
      .database()
      .ref(`payments/${uid}/paid`)
      .once("value");
    if (existingSnap.val() === true) {
      throw new HttpsError("already-exists", "Payment already completed.");
    }

    const accessToken = await getPaypalAccessToken(cfg);

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
      logger.error("PayPal capture error:", { status: res.status, body: captureData });
      throw new HttpsError("internal", "Failed to capture PayPal order.");
    }

    // 검증: status === COMPLETED 인지 확인
    const status = captureData.status;
    if (status !== "COMPLETED") {
      logger.warn("PayPal capture not completed:", { status, captureData });
      throw new HttpsError(
        "failed-precondition",
        `Payment not completed (status=${status}).`
      );
    }

    // 캡처 정보 추출
    const pu =
      (captureData.purchase_units && captureData.purchase_units[0]) || {};
    const cap =
      (pu.payments && pu.payments.captures && pu.payments.captures[0]) || {};
    const captureID = cap.id || "";
    const amountValue = (cap.amount && cap.amount.value) || cfg.priceUSD;
    const amountCurrency =
      (cap.amount && cap.amount.currency_code) || cfg.currency;
    const customId = pu.custom_id || "";

    // 추가 검증: custom_id 가 본인 uid 와 일치해야 함
    if (customId && customId !== uid) {
      logger.error("Custom ID mismatch:", { customId, uid });
      throw new HttpsError("permission-denied", "Order owner mismatch.");
    }

    // 추가 검증: 금액이 서버 설정 가격과 일치해야 함
    if (amountCurrency !== cfg.currency || amountValue !== cfg.priceUSD) {
      logger.warn("Amount mismatch:", {
        amountValue,
        amountCurrency,
        expected: { value: cfg.priceUSD, currency: cfg.currency },
      });
      // 위변조 가능성 → 차단
      throw new HttpsError(
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
  }
);

// =====================================================================
// 3) paypalHealthCheck — 배포 확인용 (시크릿 값은 노출하지 않음)
// =====================================================================
exports.paypalHealthCheck = onCall(
  {
    secrets: [
      PAYPAL_CLIENT_ID_SANDBOX,
      PAYPAL_SECRET_SANDBOX,
      PAYPAL_CLIENT_ID_LIVE,
      PAYPAL_SECRET_LIVE,
    ],
    timeoutSeconds: 10,
    memory: "256MiB",
    cors: true,
  },
  async (request) => {
    // 인증된 사용자만 헬스 체크 결과 확인 가능
    requireAuth(request);
    const cfg = getPaypalConfig();
    return {
      ok: true,
      env: cfg.env,
      hasClientId: !!cfg.clientId,
      hasSecret: !!cfg.secret,
      priceUSD: cfg.priceUSD,
      currency: cfg.currency,
    };
  }
);

// =====================================================================
// PR#102 추가 결제 (Additional Test Payment) — PayPal 자동화
// =====================================================================
// 설계 요지:
//   - 기존 payments/{uid} 노드는 절대 건드리지 않음 (라이브 결제 무손상)
//   - 별도 노드 additionalPayments/{uid}/{orderId} 사용
//   - 각 추가 결제는 1회용 토큰 (status: unused → consumed)
//   - 검사 진입 시 token 검증 + 트랜잭션 소진
//   - 리포트는 sid별 자동 분리 저장 (기존 시스템 그대로 활용)
//
// 신뢰 모델:
//   - 첫 결제(payments/{uid}/paid)와 동일한 신뢰 모델
//   - PayPal 서버 검증(capture)으로 paid 기록 → 위변조 방지
//   - 사용자 인증(uid) 필수, custom_id로 결제자 검증
//   - 금액·통화 서버 고정 (cfg.priceUSD)
// =====================================================================

// 4) createAdditionalPaypalOrder
//    - 결제 완료자(payments/{uid}/paid===true)만 호출 가능
//    - 기존 createPaypalOrder와 거의 동일한 패턴, 단 다른 분기로 흐름
//    - 반환: { orderID }
// =====================================================================
exports.createAdditionalPaypalOrder = onCall(
  {
    secrets: [
      PAYPAL_CLIENT_ID_SANDBOX,
      PAYPAL_SECRET_SANDBOX,
      PAYPAL_CLIENT_ID_LIVE,
      PAYPAL_SECRET_LIVE,
    ],
    timeoutSeconds: 30,
    memory: "256MiB",
    cors: true,
  },
  async (request) => {
    const uid = requireAuth(request);
    const cfg = getPaypalConfig();

    // 가드: 첫 결제가 완료된 사용자만 추가 결제 가능
    //   - 첫 결제 미완료자가 호출하면 "선결제 필요" 안내
    //   - 추가 결제는 첫 결제의 부가 기능이므로 정책 일관성 유지
    const firstPaidSnap = await admin
      .database()
      .ref(`payments/${uid}/paid`)
      .once("value");
    if (firstPaidSnap.val() !== true) {
      throw new HttpsError(
        "failed-precondition",
        "First payment is required before requesting an additional test."
      );
    }

    const accessToken = await getPaypalAccessToken(cfg);

    // 추가 결제 식별용 reference_id (lp_add_{uid}_{ts})
    const refId = `lp_add_${uid}_${Date.now()}`;

    const orderPayload = {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: refId,
          description: "LifePortfolio - Additional diagnostic test & report",
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
        "PayPal-Request-Id": `lp_add_create_${uid}_${Date.now()}`,
      },
      body: JSON.stringify(orderPayload),
    });

    if (!res.ok) {
      const text = await res.text();
      logger.error("[AddPay] PayPal create order error:", { status: res.status, body: text });
      throw new HttpsError("internal", "Failed to create PayPal order for additional test.");
    }

    const order = await res.json();
    logger.info("[AddPay] order created", { uid, orderID: order.id, env: cfg.env });

    return { orderID: order.id };
  }
);

// =====================================================================
// 5) captureAdditionalPaypalOrder
//    - PayPal 추가 결제 onApprove → 서버 캡처 → status===COMPLETED 검증
//    - additionalPayments/{uid}/{orderId} 노드에 paid=true, status=unused 기록
//    - 반환: { ok, orderID, captureID, amount, currency, token }
//    - token = orderId (검사 진입 시 suvey.html?token=... 형태로 사용)
// =====================================================================
exports.captureAdditionalPaypalOrder = onCall(
  {
    secrets: [
      PAYPAL_CLIENT_ID_SANDBOX,
      PAYPAL_SECRET_SANDBOX,
      PAYPAL_CLIENT_ID_LIVE,
      PAYPAL_SECRET_LIVE,
    ],
    timeoutSeconds: 30,
    memory: "256MiB",
    cors: true,
  },
  async (request) => {
    const uid = requireAuth(request);
    const cfg = getPaypalConfig();
    const data = request.data || {};
    const orderID = (data.orderID || "").toString().trim();

    if (!orderID || orderID.length > 80) {
      throw new HttpsError("invalid-argument", "Valid orderID is required.");
    }

    // 가드: 첫 결제 완료 검증 (createAdditionalPaypalOrder와 일관성)
    const firstPaidSnap = await admin
      .database()
      .ref(`payments/${uid}/paid`)
      .once("value");
    if (firstPaidSnap.val() !== true) {
      throw new HttpsError(
        "failed-precondition",
        "First payment is required."
      );
    }

    // 중복 캡처 방지: 동일 orderID로 이미 처리된 적이 있는지 확인
    const dupSnap = await admin
      .database()
      .ref(`additionalPayments/${uid}/${orderID}/paid`)
      .once("value");
    if (dupSnap.val() === true) {
      // 멱등성 — 이미 처리됨, 동일 응답 반환
      const existing = await admin
        .database()
        .ref(`additionalPayments/${uid}/${orderID}`)
        .once("value");
      const val = existing.val() || {};
      logger.info("[AddPay] duplicate capture (idempotent)", { uid, orderID });
      return {
        ok: true,
        idempotent: true,
        orderID,
        captureID: val.captureID || "",
        amount: val.amount || cfg.priceUSD,
        currency: val.currency || cfg.currency,
        token: orderID,
      };
    }

    const accessToken = await getPaypalAccessToken(cfg);

    // PayPal 주문 캡처
    const res = await fetch(
      `${cfg.apiBase}/v2/checkout/orders/${encodeURIComponent(orderID)}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "PayPal-Request-Id": `lp_add_capture_${uid}_${Date.now()}`,
        },
      }
    );

    const captureData = await res.json().catch(() => ({}));

    if (!res.ok) {
      logger.error("[AddPay] PayPal capture error:", { status: res.status, body: captureData });
      throw new HttpsError("internal", "Failed to capture PayPal order.");
    }

    const status = captureData.status;
    if (status !== "COMPLETED") {
      logger.warn("[AddPay] PayPal capture not completed:", { status, captureData });
      throw new HttpsError(
        "failed-precondition",
        `Payment not completed (status=${status}).`
      );
    }

    const pu =
      (captureData.purchase_units && captureData.purchase_units[0]) || {};
    const cap =
      (pu.payments && pu.payments.captures && pu.payments.captures[0]) || {};
    const captureID = cap.id || "";
    const amountValue = (cap.amount && cap.amount.value) || cfg.priceUSD;
    const amountCurrency =
      (cap.amount && cap.amount.currency_code) || cfg.currency;
    const customId = pu.custom_id || "";

    // 검증: custom_id === uid (결제자 무결성)
    if (customId && customId !== uid) {
      logger.error("[AddPay] Custom ID mismatch:", { customId, uid });
      throw new HttpsError("permission-denied", "Order owner mismatch.");
    }

    // 검증: 금액/통화 일치
    if (amountCurrency !== cfg.currency || amountValue !== cfg.priceUSD) {
      logger.warn("[AddPay] Amount mismatch:", {
        amountValue, amountCurrency,
        expected: { value: cfg.priceUSD, currency: cfg.currency },
      });
      throw new HttpsError(
        "failed-precondition",
        "Payment amount/currency mismatch."
      );
    }

    // additionalPayments/{uid}/{orderID} 노드 기록
    const nowIso = new Date().toISOString();
    await admin.database().ref(`additionalPayments/${uid}/${orderID}`).set({
      paid: true,
      status: "unused",  // unused → consumed (검사 시작 시 트랜잭션으로 소진)
      consumedBySid: null,
      consumedAt: null,
      orderID: orderID,
      captureID: captureID,
      amount: amountValue,
      currency: amountCurrency,
      source: "paypal",
      provider: "paypal",
      env: cfg.env,
      createdAt: nowIso,
    });

    logger.info("[AddPay] captured & token issued", {
      uid, orderID, captureID, amount: amountValue, env: cfg.env
    });

    return {
      ok: true,
      idempotent: false,
      orderID,
      captureID,
      amount: amountValue,
      currency: amountCurrency,
      token: orderID,
    };
  }
);

// =====================================================================
// 6) consumeAdditionalToken
//    - 검사 시작(suvey.html) 시 호출
//    - additionalPayments/{uid}/{token}/status를 unused→consumed 트랜잭션
//    - 동시 요청 race-condition 안전 보장
//    - 페이플 결제로 발급된 토큰도 동일 패턴 (token=ts_{timestamp})
// =====================================================================
exports.consumeAdditionalToken = onCall(
  {
    timeoutSeconds: 15,
    memory: "256MiB",
    cors: true,
  },
  async (request) => {
    const uid = requireAuth(request);
    const data = request.data || {};
    const token = (data.token || "").toString().trim();
    const sid = (data.sid || "").toString().trim();

    if (!token || token.length > 80) {
      throw new HttpsError("invalid-argument", "Valid token is required.");
    }
    if (!sid || sid.length > 80) {
      throw new HttpsError("invalid-argument", "Valid sid is required.");
    }

    const refNode = admin.database().ref(`additionalPayments/${uid}/${token}`);

    // 트랜잭션: unused → consumed 원자적 갱신
    const result = await refNode.transaction((current) => {
      if (!current) {
        return undefined;
      }
      if (current.paid !== true) {
        return undefined;
      }
      if (current.status === "consumed") {
        // 멱등 처리: 같은 sid면 통과, 다른 sid면 거부
        if (current.consumedBySid === sid) {
          return current;
        }
        return undefined;
      }
      if (current.status !== "unused") {
        return undefined;
      }
      current.status = "consumed";
      current.consumedBySid = sid;
      current.consumedAt = new Date().toISOString();
      return current;
    });

    if (!result.committed) {
      const snap = await refNode.once("value");
      const val = snap.val();
      if (!val) {
        throw new HttpsError("not-found", "Token not found.");
      }
      if (val.status === "consumed" && val.consumedBySid !== sid) {
        throw new HttpsError("already-exists", "Token already consumed by another session.");
      }
      throw new HttpsError("failed-precondition", "Token cannot be consumed.");
    }

    logger.info("[AddTokenConsume] success", { uid, token, sid });
    return { ok: true, sid, token };
  }
);

// =====================================================================
// 7) issuePaypleAdditionalToken
//    - 페이플 추가 결제 후 payment-success.html에서 호출
//    - 페이플은 서버 webhook 없으므로 첫 결제와 동일한 신뢰 모델 사용
//      (sessionStorage intent → 클라이언트가 토큰 발급 요청)
//    - 보호장치:
//      ① 첫 결제 완료(payments/{uid}/paid===true) 필수
//      ② intent.ts 검증 (30분 이내, 미래 시각 거부)
//      ③ 동일 ts로 이미 발급된 토큰이 있으면 멱등 처리
//      ④ 모든 발급은 logger.info → 운영 대조 가능
// =====================================================================
exports.issuePaypleAdditionalToken = onCall(
  {
    timeoutSeconds: 15,
    memory: "256MiB",
    cors: true,
  },
  async (request) => {
    const uid = requireAuth(request);
    const data = request.data || {};
    const intentTs = Number(data.intentTs || 0);

    if (!Number.isFinite(intentTs) || intentTs <= 0) {
      throw new HttpsError("invalid-argument", "Valid intentTs is required.");
    }

    // intent 시간 검증: 미래 거부, 30분 초과 거부
    const now = Date.now();
    if (intentTs > now + 60_000) {
      throw new HttpsError("invalid-argument", "intentTs is in the future.");
    }
    if (now - intentTs > 30 * 60 * 1000) {
      throw new HttpsError("deadline-exceeded", "Payment intent expired (>30min).");
    }

    // 첫 결제 완료 필수
    const firstPaidSnap = await admin
      .database()
      .ref(`payments/${uid}/paid`)
      .once("value");
    if (firstPaidSnap.val() !== true) {
      throw new HttpsError(
        "failed-precondition",
        "First payment is required."
      );
    }

    // 토큰 ID: pp_{intentTs} (Payple 식별 prefix)
    const tokenId = `pp_${intentTs}`;
    const refNode = admin.database().ref(`additionalPayments/${uid}/${tokenId}`);

    // 멱등 처리: 이미 발급되었으면 동일 응답
    const existing = await refNode.once("value");
    if (existing.exists()) {
      const val = existing.val();
      logger.info("[AddPay-Payple] token already issued (idempotent)", { uid, tokenId });
      return { ok: true, idempotent: true, token: tokenId, status: val.status };
    }

    const nowIso = new Date().toISOString();
    await refNode.set({
      paid: true,
      status: "unused",
      consumedBySid: null,
      consumedAt: null,
      orderID: tokenId,
      captureID: "",
      amount: "19900",
      currency: "KRW",
      source: "payple-link",
      provider: "payple",
      env: "live",
      createdAt: nowIso,
      intentTs: intentTs,
    });

    logger.info("[AddPay-Payple] token issued", { uid, tokenId, intentTs });

    return { ok: true, idempotent: false, token: tokenId, status: "unused" };
  }
);


// =====================================================================
// PR#38 [이슈 4] 30일 경과 탈퇴 데이터 자동 완전 파기 스케줄러
// =====================================================================
// - withdrawn_logs/{logId}.purgeAt < 현재시각 → 해당 로그 완전 삭제 (status='purged' 후 1일 내 제거)
// - payments_anonymized/{anonId}._retainUntilTs < 현재시각 → 5년 경과 결제 익명화 노드 완전 삭제
// 매일 03:30 KST(=18:30 UTC)에 1회 실행
// =====================================================================
const { onSchedule } = require("firebase-functions/v2/scheduler");

exports.purgeExpiredWithdrawnData = onSchedule(
  {
    schedule: "30 18 * * *",   // 매일 18:30 UTC (= 03:30 KST)
    timeZone: "Asia/Seoul",
    region: "asia-northeast3",
    memory: "256MiB",
    timeoutSeconds: 300,
  },
  async () => {
    const db = admin.database();
    const now = Date.now();
    let purgedLogs = 0, purgedPayments = 0, errors = 0;

    // 1) withdrawn_logs: purgeAt 경과한 로그 완전 삭제 (개인정보보호법 30일 요건)
    try {
      const snap = await db.ref("withdrawn_logs").once("value");
      if (snap.exists()) {
        const updates = {};
        snap.forEach((child) => {
          const v = child.val() || {};
          if (typeof v.purgeAt === "number" && v.purgeAt < now) {
            // status='purged' 기록을 1일 보존 후 다음 사이클에 완전 삭제
            if (v.status === "purged" && typeof v.purgedAt === "number" && (now - v.purgedAt) > 24 * 3600 * 1000) {
              updates[`withdrawn_logs/${child.key}`] = null;
              purgedLogs++;
            } else if (v.status !== "purged") {
              updates[`withdrawn_logs/${child.key}/status`]   = "purged";
              updates[`withdrawn_logs/${child.key}/purgedAt`] = now;
              purgedLogs++;
            }
          }
        });
        if (Object.keys(updates).length > 0) {
          await db.ref().update(updates);
        }
      }
    } catch (e) {
      logger.error("[purge] withdrawn_logs error:", e && e.message);
      errors++;
    }

    // 2) payments_anonymized: 5년 경과 결제 익명 데이터 완전 삭제 (전자상거래법 5년 후 파기)
    try {
      const snap = await db.ref("payments_anonymized").once("value");
      if (snap.exists()) {
        const updates = {};
        snap.forEach((child) => {
          const v = child.val() || {};
          if (typeof v._retainUntilTs === "number" && v._retainUntilTs < now) {
            updates[`payments_anonymized/${child.key}`] = null;
            purgedPayments++;
          }
        });
        if (Object.keys(updates).length > 0) {
          await db.ref().update(updates);
        }
      }
    } catch (e) {
      logger.error("[purge] payments_anonymized error:", e && e.message);
      errors++;
    }

    logger.info("[purge] 일일 자동 파기 완료", { purgedLogs, purgedPayments, errors, ranAt: new Date(now).toISOString() });
    return { purgedLogs, purgedPayments, errors };
  }
);

// =====================================================================
// Sprint Week 2 [21일 점검 동행] D22 자동 이메일 스케줄러
// =====================================================================
// - 매일 09:00 KST 1회 실행
// - 대상: Firestore `checkin21_preorders` 컬렉션의 사전 신청자 중
//        purchase_date + 21일 == 오늘 (KST 기준)
//        AND status == 'pending'
//        AND d22_email_sent != true
//        AND purchase_date 가 D22_LOOKBACK_DAYS_MAX 이내 (안전망)
// - 발송: Resend API (Asia/Tokyo region) — KO/EN 템플릿 분기
// - 발송 후: d22_email_sent=true, d22_email_sent_at=서버타임 기록 (멱등성)
// =====================================================================
const { buildD22EmailKo } = require("./emails/d22-ko");
const { buildD22EmailEn } = require("./emails/d22-en");

// Resend 시크릿 (Secret Manager)
const RESEND_API_KEY = defineSecret("RESEND_API_KEY");

// Sprint Week 3 · 체크인 폼 링크 HMAC 서명 키 (Secret Manager)
//   ※ 최초 배포 전: firebase functions:secrets:set CHECKIN_LINK_SECRET
//                   (랜덤 64+자 문자열 입력)
const CHECKIN_LINK_SECRET = defineSecret("CHECKIN_LINK_SECRET");

// 발신/링크 환경변수 (.env)
// ⚠️ 중요: .env 파일이 함수 배포에 포함되지 않은 경우(또는 빈 문자열로 평가될 때)
//   Resend API 가 'Invalid from' 422 에러를 반환할 수 있다.
//   → defineString default 외에 paramOrFallback() 헬퍼로 빈 문자열도 폴백 처리.
const RESEND_FROM_EMAIL_KO_DEFAULT = "Life Portfolio <faise@lifeportfolio.co.kr>";
const RESEND_FROM_EMAIL_EN_DEFAULT = "Life Portfolio <faise@lifeportfolio.co.kr>";
const RESEND_REPLY_TO_DEFAULT = "faise@lifeportfolio.co.kr";
// PR #91 — 사전 진단 후 코치(운영자)에게 escalation 알림 메일을 보낼 주소.
//   기본값은 reply-to 와 동일한 코치 메일. .env 로 override 가능.
const OPERATOR_NOTIFICATION_EMAIL_DEFAULT = "faise@lifeportfolio.co.kr";
// Sprint Week 3: 자가 점검 폼 페이지가 활성화되었으므로 폼 URL 로 직접 연결.
//   ※ checkin-21.html (사전 신청) ≠ checkin-21-form.html (12문항 자가 점검)
const D22_FORM_BASE_URL_KO_DEFAULT = "https://lifeportfolio.co.kr/checkin-21-form.html";
const D22_FORM_BASE_URL_EN_DEFAULT = "https://lifeportfolio.co.kr/checkin-21-form-en.html";
const D22_LOOKBACK_DAYS_MAX_DEFAULT = "60";

const RESEND_FROM_EMAIL_KO_PARAM = defineString("RESEND_FROM_EMAIL_KO", {
  default: RESEND_FROM_EMAIL_KO_DEFAULT,
});
const RESEND_FROM_EMAIL_EN_PARAM = defineString("RESEND_FROM_EMAIL_EN", {
  default: RESEND_FROM_EMAIL_EN_DEFAULT,
});
const RESEND_REPLY_TO_PARAM = defineString("RESEND_REPLY_TO", {
  default: RESEND_REPLY_TO_DEFAULT,
});
// PR #91 — 코치 1:1 통화 예약 escalation 시 알림을 받는 운영자 이메일.
const OPERATOR_NOTIFICATION_EMAIL_PARAM = defineString("OPERATOR_NOTIFICATION_EMAIL", {
  default: OPERATOR_NOTIFICATION_EMAIL_DEFAULT,
});
const D22_FORM_BASE_URL_KO_PARAM = defineString("D22_FORM_BASE_URL_KO", {
  default: D22_FORM_BASE_URL_KO_DEFAULT,
});
const D22_FORM_BASE_URL_EN_PARAM = defineString("D22_FORM_BASE_URL_EN", {
  default: D22_FORM_BASE_URL_EN_DEFAULT,
});
const D22_LOOKBACK_DAYS_MAX_PARAM = defineString("D22_LOOKBACK_DAYS_MAX", {
  default: D22_LOOKBACK_DAYS_MAX_DEFAULT,
});

/**
 * defineString 값이 빈 문자열/undefined 일 경우 fallback 값으로 대체.
 * Firebase Functions v2 에서 .env 파일 없이 배포된 경우, default 가 무시되고
 * 빈 문자열이 반환되는 케이스가 있어 명시적 폴백이 필요하다.
 */
function paramOrFallback(param, fallback) {
  try {
    const v = (param.value() || "").toString().trim();
    return v.length > 0 ? v : fallback;
  } catch (e) {
    return fallback;
  }
}

/**
 * D22 이메일에 들어갈 폼 링크 URL 에 ?email=&pd=&sig= 쿼리 추가.
 * 서명은 submitCheckinResponse 가 검증 시 재계산할 수 있도록 동일한 HMAC 방식 사용.
 *
 * @param {string} baseUrl       - 기본 폼 URL (예: https://lifeportfolio.co.kr/checkin-21-form.html)
 * @param {string} email         - 수신자 이메일
 * @param {string} purchaseDateIso - YYYY-MM-DD
 * @param {string} secret        - CHECKIN_LINK_SECRET 값 (없으면 서명 생략)
 * @returns {string} 쿼리스트링 포함된 최종 URL
 */
function buildCheckinFormUrlWithSig(baseUrl, email, purchaseDateIso, secret) {
  const base = (baseUrl || "").toString();
  if (!base) return base;
  const params = new URLSearchParams();
  params.set("email", (email || "").toString().toLowerCase().trim());
  params.set("pd", (purchaseDateIso || "").toString().trim());
  if (secret && secret.length >= 16) {
    const sig = buildCheckinLinkSignature(email, purchaseDateIso, secret);
    params.set("sig", sig);
  }
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}${params.toString()}`;
}

/**
 * defineString 값이 유효한 이메일 형식인지 검증하고, 아니면 fallback 사용.
 * Firebase Functions v2 defineString 의 default 값에 콤마/콜론/특수문자가 있으면
 * 일부가 잘려서 환경변수에 전달되는 알려진 케이스 방어.
 *
 * 허용 형식:
 *   1) "email@domain.tld"
 *   2) "Display Name <email@domain.tld>"
 */
// 첫 분기: "Display Name <email@domain.tld>" — display name 부분에 공백 허용 ([^<>@]+)
// 둘째 분기: 단일 "email@domain.tld"
const VALID_FROM_RE = /^(?:[^<>@]+<\s*[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+\s*>|[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+)$/;
function validFromOrFallback(value, fallback, paramName, logFn) {
  const v = (value || "").toString().trim();
  // Resend API Key 패턴 차단
  if (/^re_[A-Za-z0-9_-]{20,}$/.test(v)) {
    if (logFn) logFn("[email-config] API Key 오설정 감지 → fallback", {
      param: paramName, badValueStartsWith: v.slice(0, 5) + "***",
    });
    return fallback;
  }
  // 빈 값 → fallback
  if (v.length === 0) return fallback;
  // 유효한 이메일 형식 → 그대로 사용
  if (VALID_FROM_RE.test(v)) return v;
  // 그 외 (잘림/오설정) → fallback + 경고 로그
  if (logFn) logFn("[email-config] 잘못된 FROM 형식 감지 → fallback", {
    param: paramName, badValue: v, fallback,
  });
  return fallback;
}

/**
 * URL 값이 유효한 http(s) URL 인지 검증하고, 아니면 fallback 사용.
 */
function validUrlOrFallback(value, fallback, paramName, logFn) {
  const v = (value || "").toString().trim();
  if (v.length === 0) return fallback;
  try {
    const u = new URL(v);
    if (u.protocol === "http:" || u.protocol === "https:") return v;
  } catch (e) { /* fallthrough */ }
  if (logFn) logFn("[email-config] 잘못된 URL 형식 감지 → fallback", {
    param: paramName, badValue: v, fallback,
  });
  return fallback;
}

/**
 * D22 이메일에 첨부되는 폼 URL 자가치유.
 *
 * 운영진이 환경변수에 사전신청(결제) 페이지 URL 을 실수로 박아넣어도,
 * 자동으로 12문항 자가 점검 폼 URL(-form 접미사) 로 교정한다.
 *
 *   /checkin-21.html        → /checkin-21-form.html         (KO)
 *   /checkin-21-en.html     → /checkin-21-form-en.html      (EN, en 접미사 보존)
 *   /checkin-21             → /checkin-21-form              (확장자 생략 케이스, KO)
 *   /checkin-21-en          → /checkin-21-form-en           (확장자 생략 케이스, EN)
 *   /checkin-21-form.html   → 그대로 유지                    (이미 올바름)
 *
 * Sprint Week 3 회고: 코드 default 는 -form 으로 두었으나
 *   .env.<projectId> 파일에 옛 URL 이 남아있어 그쪽이 우선 적용된 케이스가 실제 발견됨.
 *   자가치유 + .env.example 가이드 갱신 + 로그 경고 3중 방어로 재발 차단.
 *
 * @param {string} url      - 입력 URL (환경변수 또는 default)
 * @param {string} lang     - "ko" | "en" (en 일 때 -en 접미사 보존)
 * @param {Function} logFn  - 경고 로그 함수 (선택)
 * @returns {string} 교정된 URL
 */
function normalizeD22FormBaseUrl(url, lang, logFn) {
  const original = (url || "").toString().trim();
  if (!original) return original;
  let u;
  try {
    u = new URL(original);
  } catch (e) {
    return original; // URL 파싱 실패 시 validUrlOrFallback 이 이미 처리했을 것
  }
  const path = u.pathname;
  // 이미 -form 이 포함되어 있으면 그대로 (가장 빠른 경로)
  if (/\/checkin-21-form(-en)?(\.html)?$/.test(path)) return original;

  // 사전신청 페이지 패턴 감지 → -form 으로 교정
  // 매칭: /checkin-21        /checkin-21.html        /checkin-21-en        /checkin-21-en.html
  const m = /^(.*)\/checkin-21(-en)?(\.html)?$/.exec(path);
  if (!m) return original; // checkin-21 계열이 아니면 손대지 않음 (커스텀 경로 존중)

  const prefix = m[1];           // 예: "" 또는 "/some/path"
  const enSuffix = m[2] || "";   // "-en" 또는 ""
  const htmlExt = m[3] || "";    // ".html" 또는 ""
  const correctedPath = `${prefix}/checkin-21-form${enSuffix}${htmlExt}`;
  u.pathname = correctedPath;
  const corrected = u.toString();

  if (logFn) {
    logFn("[d22-url] 사전신청 페이지 URL 감지 → 자가 점검 폼 URL 로 자동 교정", {
      lang: lang || "?",
      original,
      corrected,
      hint: ".env.<projectId> 의 D22_FORM_BASE_URL_* 값을 -form 버전으로 갱신 권장",
    });
  }
  return corrected;
}

/**
 * KST 기준 오늘 날짜를 'YYYY-MM-DD' 문자열로 반환
 * - Asia/Seoul 기준 자정~24시 사이를 "오늘"로 정의
 */
function todayKstIsoDate(now) {
  // KST = UTC+9. UTC 시각에 9시간 더한 뒤 UTC 날짜 컴포넌트를 사용하면 KST 날짜와 일치.
  const ms = (now instanceof Date ? now : new Date()).getTime() + 9 * 3600 * 1000;
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

/**
 * PR #91 r2 — KST 기준 "YYYY-MM-DD (요일) HH:MM" 포맷
 *   예: formatKstDateTime(new Date("2026-05-20T01:00:00Z")) -> "2026-05-20 (수) 10:00"
 *   코치 메일에서 예약 시각을 일관된 KST 표기로 보여주기 위함.
 */
function formatKstDateTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  const kstMs = d.getTime() + 9 * 3600 * 1000;
  const k = new Date(kstMs);
  const y = k.getUTCFullYear();
  const mo = String(k.getUTCMonth() + 1).padStart(2, "0");
  const da = String(k.getUTCDate()).padStart(2, "0");
  const hh = String(k.getUTCHours()).padStart(2, "0");
  const mm = String(k.getUTCMinutes()).padStart(2, "0");
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const wd = dayNames[k.getUTCDay()];
  return `${y}-${mo}-${da} (${wd}) ${hh}:${mm}`;
}

/**
 * ISO 날짜(YYYY-MM-DD)에 일수 차이를 더해 'YYYY-MM-DD' 반환
 *   addDaysIso('2026-04-25', 21) -> '2026-05-16'
 * UTC 정오 기준으로 계산하여 DST/타임존 이슈 회피
 */
function addDaysIso(iso, days) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso || "").toString());
  if (!m) return null;
  const baseUtc = Date.UTC(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10), 12, 0, 0);
  const target = new Date(baseUtc + days * 86400000);
  const y = target.getUTCFullYear();
  const mo = String(target.getUTCMonth() + 1).padStart(2, "0");
  const da = String(target.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

/**
 * ISO 날짜의 일수 차이를 계산 (today - then), 음수면 미래
 *   daysDiff('2026-05-16', '2026-04-25') -> 21
 */
function daysDiffIso(todayIso, thenIso) {
  const t = /^(\d{4})-(\d{2})-(\d{2})$/.exec((todayIso || "").toString());
  const h = /^(\d{4})-(\d{2})-(\d{2})$/.exec((thenIso || "").toString());
  if (!t || !h) return NaN;
  const tUtc = Date.UTC(parseInt(t[1], 10), parseInt(t[2], 10) - 1, parseInt(t[3], 10), 12, 0, 0);
  const hUtc = Date.UTC(parseInt(h[1], 10), parseInt(h[2], 10) - 1, parseInt(h[3], 10), 12, 0, 0);
  return Math.round((tUtc - hUtc) / 86400000);
}

/**
 * 이메일 형식 간단 검증 (서버측 sanity check — Resend에서도 검증함)
 */
function isLikelyEmail(s) {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim()) && s.length <= 254;
}

/**
 * Resend API 호출 (단일 메일 발송)
 * - node-fetch 사용 (이미 PayPal 흐름에서 사용 중인 의존성)
 * - 실패 시 throw → 호출자에서 errorRecords 카운트
 */
async function sendViaResend({ apiKey, from, to, replyTo, subject, html, text, tag }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: replyTo,
      subject,
      html,
      text,
      tags: tag ? [{ name: "campaign", value: tag }] : undefined,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`Resend API failed: status=${res.status} body=${body.slice(0, 500)}`);
    err.status = res.status;
    throw err;
  }
  return res.json().catch(() => ({}));
}

exports.sendD22ReminderEmails = onSchedule(
  {
    // 매일 09:00 KST 1회 발송 (= 00:00 UTC)
    schedule: "0 9 * * *",
    timeZone: "Asia/Seoul",
    region: "asia-northeast3",
    memory: "256MiB",
    timeoutSeconds: 540,
    secrets: [RESEND_API_KEY, CHECKIN_LINK_SECRET],
  },
  async () => {
    const startedAt = Date.now();
    const todayIso = todayKstIsoDate(new Date());
    const lookbackDays = Math.max(21, parseInt(D22_LOOKBACK_DAYS_MAX_PARAM.value() || "60", 10) || 60);

    // 발송 대상 purchase_date 윈도우: today-lookback ~ today-21
    // (today-21 보다 더 최근 데이터는 아직 D22 미도래라 발송 X)
    const upperPurchaseDate = addDaysIso(todayIso, -21); // 정확히 D22 인 사람
    const lowerPurchaseDate = addDaysIso(todayIso, -lookbackDays); // 너무 오래된 데이터 차단

    if (!upperPurchaseDate || !lowerPurchaseDate) {
      logger.error("[d22] 날짜 계산 실패", { todayIso });
      return { ok: false, reason: "date_calc_failed" };
    }

    const apiKey = (() => {
      try { return RESEND_API_KEY.value() || ""; } catch (e) { return ""; }
    })();
    if (!apiKey) {
      logger.error("[d22] RESEND_API_KEY 미설정 — 발송 스킵");
      return { ok: false, reason: "missing_resend_key" };
    }

    // ── 환경변수 검증 + 자동 복구 ────────────────────────────
    // defineString default 값이 콤마/콜론 포함 시 일부만 전달되는 v2 버그 방어.
    // 유효한 이메일/URL 형식이 아니면 fallback 강제.
    const logFn = (msg, payload) => logger.error("[d22] " + msg, payload);
    const fromKoRaw = paramOrFallback(RESEND_FROM_EMAIL_KO_PARAM, RESEND_FROM_EMAIL_KO_DEFAULT);
    const fromEnRaw = paramOrFallback(RESEND_FROM_EMAIL_EN_PARAM, RESEND_FROM_EMAIL_EN_DEFAULT);
    const replyToRaw = paramOrFallback(RESEND_REPLY_TO_PARAM, RESEND_REPLY_TO_DEFAULT);
    const fromKo = validFromOrFallback(fromKoRaw, RESEND_FROM_EMAIL_KO_DEFAULT, "RESEND_FROM_EMAIL_KO", logFn);
    const fromEn = validFromOrFallback(fromEnRaw, RESEND_FROM_EMAIL_EN_DEFAULT, "RESEND_FROM_EMAIL_EN", logFn);
    const replyTo = validFromOrFallback(replyToRaw, RESEND_REPLY_TO_DEFAULT, "RESEND_REPLY_TO", logFn);
    const formUrlKoRaw = validUrlOrFallback(
      paramOrFallback(D22_FORM_BASE_URL_KO_PARAM, D22_FORM_BASE_URL_KO_DEFAULT),
      D22_FORM_BASE_URL_KO_DEFAULT, "D22_FORM_BASE_URL_KO", logFn);
    const formUrlEnRaw = validUrlOrFallback(
      paramOrFallback(D22_FORM_BASE_URL_EN_PARAM, D22_FORM_BASE_URL_EN_DEFAULT),
      D22_FORM_BASE_URL_EN_DEFAULT, "D22_FORM_BASE_URL_EN", logFn);
    // 자가치유: 운영진이 .env 에 사전신청 페이지 URL을 넣어도 -form 으로 자동 교정
    const formUrlKo = normalizeD22FormBaseUrl(formUrlKoRaw, "ko", logFn);
    const formUrlEn = normalizeD22FormBaseUrl(formUrlEnRaw, "en", logFn);

    const db = admin.firestore();
    let scanned = 0, sent = 0, skipped = 0, errors = 0;
    const errorDetails = [];

    try {
      // 인덱스 부담 최소화: purchase_date 범위만으로 좁히고 (lower~upper, 양끝 포함)
      // status/email_sent 는 클라이언트 측 필터 (소규모 N 가정 — KGI 1000건/월)
      const snap = await db.collection("checkin21_preorders")
        .where("purchase_date", ">=", lowerPurchaseDate)
        .where("purchase_date", "<=", upperPurchaseDate)
        .get();

      for (const doc of snap.docs) {
        scanned++;
        const v = doc.data() || {};
        const purchaseDate = (v.purchase_date || "").toString();
        const status = (v.status || "").toString();
        const alreadySent = v.d22_email_sent === true;
        const email = (v.email || "").toString();
        const lang = (v.lang || "ko").toString().toLowerCase().startsWith("en") ? "en" : "ko";
        const name = (v.name || "").toString();

        // 정확히 D22 인 사람만 (purchase_date + 21 === todayIso)
        if (daysDiffIso(todayIso, purchaseDate) !== 21) { skipped++; continue; }
        if (status !== "pending") { skipped++; continue; }
        if (alreadySent) { skipped++; continue; }
        if (!isLikelyEmail(email)) {
          skipped++;
          errorDetails.push({ id: doc.id, reason: "invalid_email" });
          continue;
        }

        try {
          // 폼 링크에 HMAC 서명 추가 (Week 3 — submitCheckinResponse 가 검증)
          const checkinSecret = safeSecretValue(CHECKIN_LINK_SECRET);
          const signedFormUrlKo = buildCheckinFormUrlWithSig(formUrlKo, email, purchaseDate, checkinSecret);
          const signedFormUrlEn = buildCheckinFormUrlWithSig(formUrlEn, email, purchaseDate, checkinSecret);

          const built = lang === "en"
            ? buildD22EmailEn({ name, purchaseDateIso: purchaseDate, formUrl: signedFormUrlEn, replyTo })
            : buildD22EmailKo({ name, purchaseDateIso: purchaseDate, formUrl: signedFormUrlKo, replyTo });

          await sendViaResend({
            apiKey,
            from: lang === "en" ? fromEn : fromKo,
            to: email,
            replyTo,
            subject: built.subject,
            html: built.html,
            text: built.text,
            tag: `d22_${lang}`,
          });

          // 멱등성 확보: 발송 성공 즉시 플래그 기록
          await doc.ref.update({
            d22_email_sent: true,
            d22_email_sent_at: admin.firestore.FieldValue.serverTimestamp(),
            d22_email_lang: lang,
          });

          sent++;
        } catch (e) {
          errors++;
          errorDetails.push({ id: doc.id, reason: (e && e.message || "send_failed").slice(0, 200) });
          logger.warn("[d22] 발송 실패", { id: doc.id, err: e && e.message });
          // 한 건 실패가 전체를 막지 않도록 continue
        }
      }
    } catch (e) {
      logger.error("[d22] 쿼리/루프 오류", e && e.message);
      errors++;
    }

    const elapsedMs = Date.now() - startedAt;
    const summary = {
      ranAt: new Date().toISOString(),
      todayIso,
      targetPurchaseDateRange: [lowerPurchaseDate, upperPurchaseDate],
      scanned, sent, skipped, errors,
      elapsedMs,
    };
    logger.info("[d22] 일일 D22 발송 완료", summary);
    if (errorDetails.length > 0) {
      logger.warn("[d22] 발송 오류 상세 (최대 20건)", { errorDetails: errorDetails.slice(0, 20) });
    }
    return summary;
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 🧪 testD22EmailSend — D22 이메일 라이브 미리보기 발송 (Callable)
// ─────────────────────────────────────────────────────────────────────────────
// 목적:
//   - 21일 기다리지 않고도 실제 Resend 발송 결과 + 받은편지함 렌더링을 검증
//   - 본인(또는 운영진) 이메일로 KO/EN 1통씩 즉시 발송
//
// 안전 장치:
//   1) 운영 컬렉션(checkin21_preorders) 절대 건드리지 않음
//   2) _test_email_log 별도 컬렉션에 발송 로그 기록 (rate limit 추적)
//   3) Rate limit: 같은 이메일 1분 1회, 1시간 10회 (스팸/오남용 방지)
//   4) 허용된 이메일 도메인 화이트리스트 (운영진 도메인만 — 무단 발송 차단)
//   5) 받는 이메일 형식 검증 + 길이 제한
//   6) 24시간 후 자동 삭제 대상이 되도록 expiresAt 기록 (purgeExpiredWithdrawnData 와 별개)
//
// 입력:
//   - to: string (받는 이메일)
//   - lang: 'ko' | 'en' | 'both'  (기본 'both')
//   - name: string (선택, 기본 '테스터')
//   - purchaseDateIso: string (선택, 기본 오늘-21일)
//
// 반환:
//   - { ok: true, sent: [{ lang, messageId, to }], skipped: [], elapsedMs }
// ─────────────────────────────────────────────────────────────────────────────
const TEST_D22_ALLOWED_DOMAINS_PARAM = defineString("TEST_D22_ALLOWED_DOMAINS", {
  // 콤마 구분. 빈 문자열이면 모두 차단(안전 기본값).
  // 운영 배포 시 firebase functions:config 또는 .env 로 설정 권장.
  default: "lifeportfolio.co.kr,gmail.com",
});

exports.testD22EmailSend = onCall(
  {
    region: "asia-northeast3",
    memory: "256MiB",
    timeoutSeconds: 60,
    secrets: [RESEND_API_KEY, CHECKIN_LINK_SECRET],
    enforceAppCheck: false, // 운영진 사내 도구이므로 App Check 강제 X (도메인 화이트리스트로 통제)
  },
  async (request) => {
    const startedAt = Date.now();

    // ── 1) 입력 검증 ─────────────────────────────────────────
    const data = request.data || {};
    const to = (data.to || "").toString().trim().toLowerCase();
    const langInput = (data.lang || "both").toString().toLowerCase();
    const name = (data.name || "테스터").toString().trim().slice(0, 80) || "테스터";
    const purchaseDateIso = (data.purchaseDateIso || addDaysIso(todayKstIsoDate(new Date()), -21) || "").toString();

    if (!isLikelyEmail(to) || to.length > 254) {
      throw new HttpsError("invalid-argument", "to 가 유효한 이메일 형식이 아닙니다.");
    }
    if (!["ko", "en", "both"].includes(langInput)) {
      throw new HttpsError("invalid-argument", "lang 은 'ko' | 'en' | 'both' 중 하나여야 합니다.");
    }
    if (purchaseDateIso && !/^\d{4}-\d{2}-\d{2}$/.test(purchaseDateIso)) {
      throw new HttpsError("invalid-argument", "purchaseDateIso 는 YYYY-MM-DD 형식이어야 합니다.");
    }

    // ── 2) 도메인 화이트리스트 ─────────────────────────────────
    const allowedDomains = (TEST_D22_ALLOWED_DOMAINS_PARAM.value() || "")
      .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (allowedDomains.length === 0) {
      throw new HttpsError("failed-precondition",
        "TEST_D22_ALLOWED_DOMAINS 가 설정되지 않아 테스트 발송이 차단되었습니다.");
    }
    const toDomain = to.split("@")[1] || "";
    if (!allowedDomains.includes(toDomain)) {
      throw new HttpsError("permission-denied",
        `허용되지 않은 도메인입니다: ${toDomain} (허용: ${allowedDomains.join(", ")})`);
    }

    // ── 3) Rate limit (Firestore _test_email_log 기반) ─────────
    const db = admin.firestore();
    const nowMs = Date.now();
    const oneMinuteAgo = new Date(nowMs - 60 * 1000);
    const oneHourAgo = new Date(nowMs - 60 * 60 * 1000);

    try {
      const recentMinute = await db.collection("_test_email_log")
        .where("to", "==", to)
        .where("createdAt", ">=", oneMinuteAgo)
        .limit(1)
        .get();
      if (!recentMinute.empty) {
        throw new HttpsError("resource-exhausted",
          "같은 이메일로 최근 1분 이내 발송 기록이 있습니다. 잠시 후 재시도하세요.");
      }

      const recentHour = await db.collection("_test_email_log")
        .where("to", "==", to)
        .where("createdAt", ">=", oneHourAgo)
        .get();
      if (recentHour.size >= 10) {
        throw new HttpsError("resource-exhausted",
          "같은 이메일 1시간당 10회 발송 한도를 초과했습니다.");
      }
    } catch (e) {
      // HttpsError 는 그대로 throw
      if (e instanceof HttpsError) throw e;
      // 인덱스 미생성 등 쿼리 실패 시 rate limit 만 비활성화 (발송은 진행 + 경고 로그)
      logger.warn("[testD22] rate limit 쿼리 실패, 발송 진행", { err: e && e.message });
    }

    // ── 4) Resend 발송 ──────────────────────────────────────────
    const apiKey = (() => {
      try { return RESEND_API_KEY.value() || ""; } catch (e) { return ""; }
    })();
    if (!apiKey) {
      throw new HttpsError("failed-precondition", "RESEND_API_KEY 가 설정되지 않았습니다.");
    }

    // ── 환경변수 검증 + 자동 복구 ────────────────────────────
    // defineString default 값이 콤마/콜론 포함 시 일부만 전달되는 v2 버그 방어.
    // validFromOrFallback 이 모든 케이스 (빈값/짧음/콤마잘림/API키 오설정) 처리.
    const logFn = (msg, payload) => logger.error("[testD22] " + msg, payload);
    const fromKoRaw = paramOrFallback(RESEND_FROM_EMAIL_KO_PARAM, RESEND_FROM_EMAIL_KO_DEFAULT);
    const fromEnRaw = paramOrFallback(RESEND_FROM_EMAIL_EN_PARAM, RESEND_FROM_EMAIL_EN_DEFAULT);
    const replyToRaw = paramOrFallback(RESEND_REPLY_TO_PARAM, RESEND_REPLY_TO_DEFAULT);
    const fromKo = validFromOrFallback(fromKoRaw, RESEND_FROM_EMAIL_KO_DEFAULT, "RESEND_FROM_EMAIL_KO", logFn);
    const fromEn = validFromOrFallback(fromEnRaw, RESEND_FROM_EMAIL_EN_DEFAULT, "RESEND_FROM_EMAIL_EN", logFn);
    const replyTo = validFromOrFallback(replyToRaw, RESEND_REPLY_TO_DEFAULT, "RESEND_REPLY_TO", logFn);
    const formUrlKoRaw = validUrlOrFallback(
      paramOrFallback(D22_FORM_BASE_URL_KO_PARAM, D22_FORM_BASE_URL_KO_DEFAULT),
      D22_FORM_BASE_URL_KO_DEFAULT, "D22_FORM_BASE_URL_KO", logFn);
    const formUrlEnRaw = validUrlOrFallback(
      paramOrFallback(D22_FORM_BASE_URL_EN_PARAM, D22_FORM_BASE_URL_EN_DEFAULT),
      D22_FORM_BASE_URL_EN_DEFAULT, "D22_FORM_BASE_URL_EN", logFn);
    // 자가치유: .env 에 사전신청 페이지 URL 박혀있어도 -form 으로 자동 교정
    const formUrlKo = normalizeD22FormBaseUrl(formUrlKoRaw, "ko", logFn);
    const formUrlEn = normalizeD22FormBaseUrl(formUrlEnRaw, "en", logFn);

    // validFromOrFallback 가 항상 유효한 값을 보장하므로 사후 검증은 안전망 (이론상 throw 안 됨).
    if (!VALID_FROM_RE.test(fromKo) || !VALID_FROM_RE.test(fromEn)) {
      logger.error("[testD22] FROM 이메일 형식 오류 (예기치 못한 fallback 실패)", {
        fromKo, fromEn, replyTo, formUrlKo, formUrlEn,
      });
      throw new HttpsError("internal",
        "발신 이메일 형식 검증에 예기치 못한 오류가 발생했습니다. 관리자에게 문의하세요.");
    }

    const targets = langInput === "both" ? ["ko", "en"] : [langInput];
    const sent = [];
    const failed = [];

    // 폼 링크에 HMAC 서명 추가 (Week 3 — submitCheckinResponse 가 검증)
    const checkinSecret = safeSecretValue(CHECKIN_LINK_SECRET);
    const signedFormUrlKo = buildCheckinFormUrlWithSig(formUrlKo, to, purchaseDateIso, checkinSecret);
    const signedFormUrlEn = buildCheckinFormUrlWithSig(formUrlEn, to, purchaseDateIso, checkinSecret);

    for (const lang of targets) {
      try {
        const built = lang === "en"
          ? buildD22EmailEn({ name, purchaseDateIso, formUrl: signedFormUrlEn, replyTo })
          : buildD22EmailKo({ name, purchaseDateIso, formUrl: signedFormUrlKo, replyTo });

        const resendResp = await sendViaResend({
          apiKey,
          from: lang === "en" ? fromEn : fromKo,
          to,
          replyTo,
          subject: `[TEST] ${built.subject}`,
          html: built.html,
          text: built.text,
          tag: `test_d22_${lang}`,
        });

        sent.push({ lang, to, messageId: resendResp && resendResp.id || null });
      } catch (e) {
        failed.push({ lang, to, reason: (e && e.message || "send_failed").slice(0, 300) });
        logger.warn("[testD22] 발송 실패", { lang, to, err: e && e.message });
      }
    }

    // ── 5) 로그 기록 (rate limit + 감사 추적용) ──────────────────
    try {
      await db.collection("_test_email_log").add({
        to,
        langs: targets,
        sentCount: sent.length,
        failedCount: failed.length,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        // 24시간 후 정리 대상 (선택적 cleanup 함수로 처리 — 현재는 수동)
        expiresAt: new Date(nowMs + 24 * 60 * 60 * 1000),
        callerUid: (request.auth && request.auth.uid) || null,
        callerIp: (request.rawRequest && request.rawRequest.ip) || null,
      });
    } catch (e) {
      logger.warn("[testD22] 로그 기록 실패 (발송은 성공)", { err: e && e.message });
    }

    const elapsedMs = Date.now() - startedAt;
    if (sent.length === 0) {
      throw new HttpsError("internal", "모든 발송이 실패했습니다.", { failed, elapsedMs });
    }

    logger.info("[testD22] 테스트 발송 완료", {
      to, langs: targets, sentCount: sent.length, failedCount: failed.length, elapsedMs,
    });

    return {
      ok: true,
      sent,
      failed,
      elapsedMs,
      previewPurchaseDate: purchaseDateIso,
      previewName: name,
    };
  }
);


// ═══════════════════════════════════════════════════════════════════════════
// Sprint Week 3 · 12문항 자가 점검 응답 수집 (submitCheckinResponse)
// ═══════════════════════════════════════════════════════════════════════════
//
// 흐름:
//   1) D22 이메일 → 폼 링크에 ?email=...&pd=YYYY-MM-DD&sig=<HMAC앞16자>
//   2) 사용자가 폼 페이지에서 12문항 응답 후 제출
//   3) submitCheckinResponse Callable 이 sig 재계산하여 검증
//   4) 검증 통과 시 checkin21_responses 컬렉션에 저장 (멱등성: email+pd 유일키)
//
// 보안:
//   - CHECKIN_LINK_SECRET (Google Secret Manager) 로 HMAC-SHA256 서명
//   - 서명 검증 실패 → permission-denied (UI 는 친절 메시지로 변환)
//   - 같은 email+pd 에 대해 24시간 내 최대 3회 제출 허용 (수정 여유)

// (crypto 는 파일 상단에서 이미 require)
const {
  validateAnswers: validateCheckinAnswers,
} = require("./data/checkin-questions");

/**
 * 체크인 폼 링크 서명 생성 — HMAC-SHA256(email + "|" + purchaseDate, SECRET) 의 hex 앞 16자.
 *
 * @param {string} email          - 정규화된 소문자 이메일
 * @param {string} purchaseDateIso - YYYY-MM-DD
 * @param {string} secret         - HMAC 비밀키 (32자 이상 권장)
 * @returns {string} 16자 hex 서명
 */
function buildCheckinLinkSignature(email, purchaseDateIso, secret) {
  const normalizedEmail = (email || "").toString().trim().toLowerCase();
  const normalizedDate = (purchaseDateIso || "").toString().trim();
  const payload = `${normalizedEmail}|${normalizedDate}`;
  return crypto
    .createHmac("sha256", secret)
    .update(payload, "utf8")
    .digest("hex")
    .slice(0, 16);
}

/**
 * 서명 검증 — timing-safe 비교.
 * 길이가 다르면 즉시 false (timingSafeEqual 은 같은 길이만 받음).
 */
function verifyCheckinLinkSignature(email, purchaseDateIso, providedSig, secret) {
  const expected = buildCheckinLinkSignature(email, purchaseDateIso, secret);
  const provided = (providedSig || "").toString().toLowerCase();
  if (expected.length !== provided.length) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "utf8"),
      Buffer.from(provided, "utf8"),
    );
  } catch (e) {
    return false;
  }
}

exports.submitCheckinResponse = onCall(
  {
    region: "asia-northeast3",
    secrets: [CHECKIN_LINK_SECRET],
    cors: true,
    maxInstances: 20,
  },
  async (request) => {
    const data = request.data || {};
    const email = (data.email || "").toString().trim().toLowerCase();
    const purchaseDateIso = (data.purchaseDate || "").toString().trim();
    const sig = (data.sig || "").toString().trim();
    const lang = (data.lang || "ko").toString().trim();
    const answers = data.answers || {};

    // ── 1) 입력 형식 검증 ────────────────────────────────────────
    if (!isLikelyEmail(email)) {
      throw new HttpsError("invalid-argument", "이메일 형식이 올바르지 않습니다.");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(purchaseDateIso)) {
      throw new HttpsError("invalid-argument", "구매일 형식이 올바르지 않습니다 (YYYY-MM-DD).");
    }
    if (!["ko", "en"].includes(lang)) {
      throw new HttpsError("invalid-argument", "lang 은 'ko' 또는 'en' 만 허용됩니다.");
    }

    // ── 2) HMAC 서명 검증 ──────────────────────────────────────
    const secretValue = safeSecretValue(CHECKIN_LINK_SECRET);
    if (!secretValue || secretValue.length < 16) {
      logger.error("[submitCheckin] CHECKIN_LINK_SECRET 미설정 또는 너무 짧음");
      throw new HttpsError("failed-precondition", "서버 설정 오류 (관리자 문의)");
    }
    if (!verifyCheckinLinkSignature(email, purchaseDateIso, sig, secretValue)) {
      logger.warn("[submitCheckin] 서명 검증 실패", {
        emailMasked: email.slice(0, 3) + "***",
        purchaseDateIso,
        sigLen: sig.length,
      });
      throw new HttpsError(
        "permission-denied",
        "링크가 유효하지 않습니다. 이메일과 구매일을 다시 확인해주세요.",
      );
    }

    // ── 3) 응답 데이터 검증 (12문항 화이트리스트) ────────────────
    const validation = validateCheckinAnswers(answers);
    if (!validation.ok) {
      throw new HttpsError("invalid-argument", validation.error);
    }

    // ── 4) Rate limit — 24시간 내 동일 email+pd 최대 3회 ──────
    //
    // ⚠️ Composite index 회피: 3개 필드 (email + purchase_date + submitted_at)
    //   동시 쿼리는 Firestore composite index 가 필요한데, 인덱스 없으면
    //   FAILED_PRECONDITION 일반 Error 가 throw → onCall 이 INTERNAL 로 변환됨.
    //   (PR #88 배포 직후 실제로 발생한 500 INTERNAL 에러의 원인)
    //
    // 해결: 2개 필드 (email + purchase_date) 만 쿼리 + submitted_at 은 메모리 필터링.
    //   동일 사용자가 24시간 내 응답해봤자 최대 3-5건 수준이라 메모리 필터 부담 거의 0.
    //   기존 답변 doc 전수도 100건 이하로 가정 (KGI 월 1,000건 × 동일인 재제출 희박).
    const db = admin.firestore();
    const oneDayAgoMs = Date.now() - 24 * 60 * 60 * 1000;
    const recent = await db.collection("checkin21_responses")
      .where("email", "==", email)
      .where("purchase_date", "==", purchaseDateIso)
      .limit(20) // 동일 (email, pd) 조합 최대치 — 정상 사용자라면 0~3건
      .get();
    // submitted_at > oneDayAgo 메모리 필터링
    let recentCount = 0;
    recent.forEach((d) => {
      const ts = d.get("submitted_at");
      const ms = ts && typeof ts.toMillis === "function" ? ts.toMillis() : 0;
      if (ms > oneDayAgoMs) recentCount++;
    });
    if (recentCount >= 3) {
      throw new HttpsError(
        "resource-exhausted",
        "24시간 내 최대 3회까지 제출 가능합니다.",
      );
    }

    // ── 5) Firestore 저장 ───────────────────────────────────────
    const doc = {
      email,
      purchase_date: purchaseDateIso,
      lang,
      answers, // 화이트리스트 통과한 객체
      source: "checkin21_form",
      submitted_at: admin.firestore.FieldValue.serverTimestamp(),
      revision: recentCount + 1, // 첫 제출 = 1, 재제출 = 2, ...
    };
    const ref = await db.collection("checkin21_responses").add(doc);

    logger.info("[submitCheckin] 응답 저장 완료", {
      docId: ref.id,
      emailMasked: email.slice(0, 3) + "***",
      purchaseDateIso,
      lang,
      revision: doc.revision,
      answerKeys: Object.keys(answers),
    });

    return {
      ok: true,
      docId: ref.id,
      revision: doc.revision,
    };
  }
);

// ─────────────────────────────────────────────────────────────────────────
// Sprint Week 3 · PR #90 — 채팅 30분 (Scripted, A안 동행자 톤)
// ─────────────────────────────────────────────────────────────────────────
//
// 흐름:
//   1) 사용자가 폼 제출 완료 후 "다음 단계 — 실시간 채팅 30분" 카드의 링크 클릭
//   2) checkin-21-chat.html 로 이동 (?email=&pd=&sig= 동일 시그 사용)
//   3) 클라이언트가 fetch /assets/checkin/chat-script-{lang}.json + 사용자 응답
//   4) 노드별로 진행, 각 turn 마다 submitChatTurn 호출 (로그 저장)
//   5) 마지막 노드에서 [운영진에게 연결] 버튼 → requestEscalation
//
// 보안 재사용:
//   - HMAC sig 검증은 submitCheckinResponse 와 동일한 buildCheckinLinkSignature
//   - 폼 응답 doc 존재 여부도 검증 (응답 없이 채팅 진입 차단)

const {
  CHAT_SCRIPT_VERSION,
  NODE_MAP: CHAT_NODE_MAP,
  ENTRY_NODE_ID: CHAT_ENTRY_NODE_ID,
  ALLOWED_OPTION_IDS: CHAT_ALLOWED_OPTION_IDS,
  ALLOWED_NODE_IDS: CHAT_ALLOWED_NODE_IDS,
  FREE_INPUT_NODE_IDS: CHAT_FREE_INPUT_NODE_IDS,
  getNextNodeId: chatGetNextNodeId,
} = require("./data/checkin-chat-script");

const CHAT_FREE_TEXT_MAX = 500;
const CHAT_TURN_MAX_PER_SESSION = 80; // 52 노드 + 안전 마진

/**
 * 채팅 1턴 처리 — 사용자 입력 검증 + 로그 저장 + 다음 노드 결정.
 *
 * 입력:
 *   email, purchaseDate, sig    — HMAC 인증
 *   lang                          — 'ko' | 'en'
 *   sessionId                     — 채팅 세션 ID (클라이언트가 생성, 32자 hex)
 *   currentNodeId                 — 사용자가 마지막으로 본 노드 ID
 *   userInput                     — 사용자 입력 (choose 면 option_id, free 면 자유서술, say/branch 면 null)
 *   turnIndex                     — 클라이언트 카운터 (0부터, rate limit + 안전망)
 *
 * 출력:
 *   { ok: true, nextNodeId, isEnd, savedTurnIndex }
 */
exports.submitChatTurn = onCall(
  {
    region: "asia-northeast3",
    secrets: [CHECKIN_LINK_SECRET],
    cors: true,
    maxInstances: 20,
  },
  async (request) => {
    const data = request.data || {};
    const email = (data.email || "").toString().trim().toLowerCase();
    // PR #91 (PR #90 hotfix #1 재포함): 클라이언트 key 별칭 자가치유
    //   클라이언트는 'pd' / 'nodeId' 로 보내는 경우가 있으니 양쪽 모두 허용.
    const purchaseDateIso = (data.purchaseDate || data.pd || "").toString().trim();
    const sig = (data.sig || "").toString().trim();
    const lang = (data.lang || "ko").toString().trim();
    const sessionId = (data.sessionId || "").toString().trim();
    const currentNodeId = (data.currentNodeId || data.nodeId || "").toString().trim();
    const userInput = data.userInput == null ? null : data.userInput;
    const turnIndex = Number.isInteger(data.turnIndex) ? data.turnIndex : -1;

    // ── 1) 입력 형식 검증 ────────────────────────────────────────
    if (!isLikelyEmail(email)) {
      throw new HttpsError("invalid-argument", "이메일 형식이 올바르지 않습니다.");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(purchaseDateIso)) {
      throw new HttpsError("invalid-argument", "구매일 형식이 올바르지 않습니다 (YYYY-MM-DD).");
    }
    if (!["ko", "en"].includes(lang)) {
      throw new HttpsError("invalid-argument", "lang 은 'ko' 또는 'en' 만 허용됩니다.");
    }
    if (!/^[a-f0-9]{16,64}$/.test(sessionId)) {
      throw new HttpsError("invalid-argument", "sessionId 형식이 올바르지 않습니다 (16~64자 hex).");
    }
    if (!CHAT_ALLOWED_NODE_IDS.has(currentNodeId)) {
      throw new HttpsError("invalid-argument", "허용되지 않은 노드 ID 입니다.");
    }
    if (turnIndex < 0 || turnIndex >= CHAT_TURN_MAX_PER_SESSION) {
      throw new HttpsError("invalid-argument", `turnIndex 범위 오류 (0~${CHAT_TURN_MAX_PER_SESSION - 1}).`);
    }

    // ── 2) HMAC 서명 검증 (submitCheckinResponse 와 동일) ────────
    const secretValue = safeSecretValue(CHECKIN_LINK_SECRET);
    if (!secretValue || secretValue.length < 16) {
      logger.error("[chatTurn] CHECKIN_LINK_SECRET 미설정");
      throw new HttpsError("failed-precondition", "서버 설정 오류 (관리자 문의)");
    }
    if (!verifyCheckinLinkSignature(email, purchaseDateIso, sig, secretValue)) {
      logger.warn("[chatTurn] 서명 검증 실패", { emailMasked: email.slice(0, 3) + "***" });
      throw new HttpsError("permission-denied", "링크가 유효하지 않습니다.");
    }

    // ── 3) 폼 응답 존재 검증 (채팅은 응답한 사용자만) ─────────────
    const db = admin.firestore();
    const respSnap = await db.collection("checkin21_responses")
      .where("email", "==", email)
      .where("purchase_date", "==", purchaseDateIso)
      .limit(1)
      .get();
    if (respSnap.empty) {
      throw new HttpsError(
        "failed-precondition",
        "12문항 응답이 먼저 필요합니다. 폼 페이지로 돌아가 응답해주세요.",
      );
    }
    const userAnswers = respSnap.docs[0].get("answers") || {};

    // ── 4) 사용자 입력 검증 (노드 종류별) ─────────────────────────
    const node = CHAT_NODE_MAP[currentNodeId];
    if (!node) {
      throw new HttpsError("invalid-argument", "노드를 찾을 수 없습니다.");
    }
    let savedUserInput = null;
    if (node.kind === "choose") {
      const choiceId = (userInput || "").toString().trim();
      if (!CHAT_ALLOWED_OPTION_IDS.has(choiceId)) {
        throw new HttpsError("invalid-argument", "허용되지 않은 옵션 ID 입니다.");
      }
      // 노드의 옵션 목록에 실제로 속한 옵션인지 검증
      const optExists = (node.options || []).some((o) => o.id === choiceId);
      if (!optExists) {
        throw new HttpsError("invalid-argument", "이 노드에서 허용되지 않은 옵션입니다.");
      }
      savedUserInput = choiceId;
    } else if (node.kind === "free") {
      const free = (userInput || "").toString();
      if (free.length > CHAT_FREE_TEXT_MAX) {
        throw new HttpsError("invalid-argument", `자유 입력은 최대 ${CHAT_FREE_TEXT_MAX}자입니다.`);
      }
      savedUserInput = free;
    }
    // say / branch / end → userInput 무시 (null 저장)

    // ── 5) Rate limit (세션당 turnIndex 단조 증가 검증) ──────────
    //   동일 sessionId 의 마지막 turnIndex 와 비교 — 1턴씩 증가해야 정상
    const sessionTurns = await db.collection("checkin21_chat_logs")
      .where("session_id", "==", sessionId)
      .limit(CHAT_TURN_MAX_PER_SESSION)
      .get();
    if (sessionTurns.size >= CHAT_TURN_MAX_PER_SESSION) {
      throw new HttpsError("resource-exhausted", "세션 turn 최대치 초과.");
    }
    // 중복 turnIndex 방지 (재전송 공격 방지)
    let dupTurn = false;
    sessionTurns.forEach((d) => {
      if (d.get("turn_index") === turnIndex) dupTurn = true;
    });
    if (dupTurn) {
      throw new HttpsError("already-exists", "이미 처리된 turnIndex 입니다.");
    }

    // ── 6) 다음 노드 결정 ────────────────────────────────────────
    const chosenOptionId = node.kind === "choose" ? savedUserInput : null;
    const nextNodeId = chatGetNextNodeId(node, userAnswers, chosenOptionId);

    // ── 7) Firestore 저장 ───────────────────────────────────────
    const logDoc = {
      session_id: sessionId,
      email,
      purchase_date: purchaseDateIso,
      lang,
      script_version: CHAT_SCRIPT_VERSION,
      node_id: currentNodeId,
      node_kind: node.kind,
      user_input: savedUserInput, // null | string
      next_node_id: nextNodeId, // null = end
      turn_index: turnIndex,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    };
    await db.collection("checkin21_chat_logs").add(logDoc);

    logger.info("[chatTurn] 저장 완료", {
      sessionId: sessionId.slice(0, 8) + "***",
      nodeId: currentNodeId,
      nextNodeId,
      turnIndex,
    });

    return {
      ok: true,
      nextNodeId,
      isEnd: nextNodeId === null,
      savedTurnIndex: turnIndex,
    };
  },
);

/**
 * 운영진 연결 요청 — 채팅 마지막 노드(end)의 [운영진에게 연결] 버튼.
 *
 * 입력: email, purchaseDate, sig, lang, sessionId, note? (자유서술 500자)
 * 출력: { ok: true, escalationId }
 */
exports.requestEscalation = onCall(
  {
    region: "asia-northeast3",
    // PR #91: 코치 알림 메일 발송을 위해 RESEND_API_KEY 추가.
    //   API key 미설정 시에도 Firestore 저장은 정상 진행 (graceful degradation).
    secrets: [CHECKIN_LINK_SECRET, RESEND_API_KEY],
    cors: true,
    maxInstances: 10,
  },
  async (request) => {
    const data = request.data || {};
    const email = (data.email || "").toString().trim().toLowerCase();
    // PR #91: 클라이언트 key 별칭 자가치유 (purchaseDate || pd)
    const purchaseDateIso = (data.purchaseDate || data.pd || "").toString().trim();
    const sig = (data.sig || "").toString().trim();
    const lang = (data.lang || "ko").toString().trim();
    const sessionId = (data.sessionId || "").toString().trim();
    const note = (data.note || "").toString().slice(0, 500);
    // PR #91 r2 — 코치 가능 시간 슬롯 선택 ID (선택 사항).
    //   고객이 운영자가 사전 설정한 가능 시간 중 하나를 선택했을 경우 ID 전달.
    //   슬롯이 없거나 사용자가 선택하지 않은 경우 빈 문자열.
    const selectedSlotId = (data.selectedSlotId || "").toString().trim().slice(0, 64);

    // ── 1) 입력 형식 검증 ────────────────────────────────────────
    if (!isLikelyEmail(email)) {
      throw new HttpsError("invalid-argument", "이메일 형식이 올바르지 않습니다.");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(purchaseDateIso)) {
      throw new HttpsError("invalid-argument", "구매일 형식이 올바르지 않습니다.");
    }
    if (!["ko", "en"].includes(lang)) {
      throw new HttpsError("invalid-argument", "lang 은 'ko' 또는 'en' 만 허용됩니다.");
    }
    if (!/^[a-f0-9]{16,64}$/.test(sessionId)) {
      throw new HttpsError("invalid-argument", "sessionId 형식이 올바르지 않습니다.");
    }

    // ── 2) HMAC 서명 검증 ────────────────────────────────────────
    const secretValue = safeSecretValue(CHECKIN_LINK_SECRET);
    if (!secretValue || secretValue.length < 16) {
      throw new HttpsError("failed-precondition", "서버 설정 오류");
    }
    if (!verifyCheckinLinkSignature(email, purchaseDateIso, sig, secretValue)) {
      throw new HttpsError("permission-denied", "링크가 유효하지 않습니다.");
    }

    // ── 3) Rate limit — 동일 email+pd 24h 내 최대 3회 ────────────
    const db = admin.firestore();
    const oneDayAgoMs = Date.now() - 24 * 60 * 60 * 1000;
    const recent = await db.collection("checkin21_chat_escalations")
      .where("email", "==", email)
      .where("purchase_date", "==", purchaseDateIso)
      .limit(10)
      .get();
    let recentCount = 0;
    recent.forEach((d) => {
      const ts = d.get("created_at");
      const ms = ts && typeof ts.toMillis === "function" ? ts.toMillis() : 0;
      if (ms > oneDayAgoMs) recentCount++;
    });
    if (recentCount >= 3) {
      throw new HttpsError(
        "resource-exhausted",
        "24시간 내 최대 3회까지 운영진 연결 요청 가능합니다. 곧 연락드릴게요.",
      );
    }

    // ── 4) PR #91: 세션의 free 입력 4개 수집 (코치 사전 자료) ────
    //   세션 채팅 로그에서 kind='free' 노드의 user_input 을 모아
    //   { axis_A_free: "사용자 한 줄", axis_B_free: "...", ... } 형태로 정리.
    //   세션이 비어있거나 사용자가 모두 빈 칸으로 두면 빈 객체.
    const freeInputs = await collectFreeInputsForSession(db, sessionId);

    // ── 5) 12문항 응답 + 사전 진단지 메타 동봉 (코치 메일용) ────
    //   email + purchase_date 로 응답 1건 조회 (없을 수도 — 그러면 비어있는 채로)
    let userAnswers = {};
    let userName = "";
    try {
      const respSnap = await db.collection("checkin21_responses")
        .where("email", "==", email)
        .where("purchase_date", "==", purchaseDateIso)
        .limit(1)
        .get();
      if (!respSnap.empty) {
        userAnswers = respSnap.docs[0].get("answers") || {};
        userName = respSnap.docs[0].get("name") || "";
      }
    } catch (e) {
      logger.warn("[escalation] 응답 조회 실패 (무시하고 진행)", { err: e && e.message });
    }

    // ── 6) PR #91 r2 — 코치 가능 시간 슬롯 예약 (선택, atomic) ───
    //   사용자가 슬롯 ID 를 선택했다면, transaction 으로 atomic 예약 처리.
    //   슬롯이 이미 매진/비활성/존재하지 않으면 friendly 에러 반환.
    //   슬롯 미선택 시 (selectedSlotId 빈 문자열) 이 단계 스킵 → 기존 흐름.
    let bookedSlotInfo = null; // { slotId, slotAtIso, slotAtMs, durationMin }
    if (selectedSlotId) {
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(selectedSlotId)) {
        throw new HttpsError("invalid-argument", "선택하신 예약 시간 ID 형식이 올바르지 않습니다.");
      }
      const slotRef = db.collection("coach_availability").doc(selectedSlotId);
      try {
        bookedSlotInfo = await db.runTransaction(async (tx) => {
          const slotDoc = await tx.get(slotRef);
          if (!slotDoc.exists) {
            throw new HttpsError("not-found", "선택하신 시간이 더 이상 존재하지 않습니다. 다른 시간을 선택해주세요.");
          }
          const sd = slotDoc.data() || {};
          if (sd.active !== true) {
            throw new HttpsError("failed-precondition", "선택하신 시간이 비활성화되었습니다. 다른 시간을 선택해주세요.");
          }
          const slotAt = sd.slot_at;
          const slotAtMs = (slotAt && typeof slotAt.toMillis === "function") ? slotAt.toMillis() : 0;
          if (slotAtMs <= Date.now()) {
            throw new HttpsError("failed-precondition", "선택하신 시간이 이미 지났습니다. 다른 시간을 선택해주세요.");
          }
          const capacity = typeof sd.capacity === "number" ? sd.capacity : 1;
          const bookedCount = typeof sd.booked_count === "number" ? sd.booked_count : 0;
          if (bookedCount >= capacity) {
            throw new HttpsError("resource-exhausted", "방금 다른 분이 같은 시간을 예약하셨습니다. 다른 시간을 선택해주세요.");
          }
          tx.update(slotRef, {
            booked_count: bookedCount + 1,
            last_booked_at: admin.firestore.FieldValue.serverTimestamp(),
          });
          return {
            slotId: selectedSlotId,
            slotAtIso: new Date(slotAtMs).toISOString(),
            slotAtMs,
            durationMin: typeof sd.duration_min === "number" ? sd.duration_min : 30,
          };
        });
      } catch (e) {
        if (e instanceof HttpsError) throw e;
        logger.warn("[escalation] slot booking transaction 실패", { selectedSlotId, err: e && e.message });
        throw new HttpsError("internal", "예약 시간 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      }
    }

    // ── 7) Firestore 저장 (free_inputs + 슬롯 정보 포함) ──────────
    const doc = {
      email,
      purchase_date: purchaseDateIso,
      lang,
      session_id: sessionId,
      note,
      free_inputs: freeInputs, // PR #91 신규
      script_version: CHAT_SCRIPT_VERSION, // 코치 대시보드 호환성
      // PR #91 r2 — 슬롯 예약 정보 (선택 시에만 채워짐)
      selected_slot_id: bookedSlotInfo ? bookedSlotInfo.slotId : "",
      selected_slot_at: bookedSlotInfo
        ? admin.firestore.Timestamp.fromMillis(bookedSlotInfo.slotAtMs)
        : null,
      selected_slot_duration_min: bookedSlotInfo ? bookedSlotInfo.durationMin : null,
      status: bookedSlotInfo ? "scheduled" : "pending", // 슬롯 있으면 scheduled, 없으면 pending
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    };
    const ref = await db.collection("checkin21_chat_escalations").add(doc);

    logger.info("[escalation] 코치 1:1 통화 예약 요청 접수", {
      escalationId: ref.id,
      emailMasked: email.slice(0, 3) + "***",
      noteLen: note.length,
      freeInputKeys: Object.keys(freeInputs),
      slotBooked: !!bookedSlotInfo,
      slotAtIso: bookedSlotInfo ? bookedSlotInfo.slotAtIso : null,
    });

    // ── 8) 운영자(코치) 이메일 알림 발송 — graceful degradation ──
    //   RESEND_API_KEY 미설정 / 발송 실패 시에도 escalation 자체는 성공 처리.
    //   (사용자 UX 가 망가지지 않게 — 알림은 곧 운영자가 Firebase Console 로 확인 가능)
    try {
      await sendEscalationNotificationToOperator({
        escalationId: ref.id,
        email,
        purchaseDateIso,
        lang,
        sessionId,
        note,
        freeInputs,
        userAnswers,
        userName,
        bookedSlotInfo, // PR #91 r2
      });
    } catch (e) {
      // 발송 실패는 무시 (escalation 자체는 이미 Firestore 저장됨)
      logger.warn("[escalation] 운영자 메일 발송 실패 — 저장은 성공", {
        escalationId: ref.id,
        err: e && e.message,
      });
    }

    return {
      ok: true,
      escalationId: ref.id,
      slotBooked: !!bookedSlotInfo,
      slotAtIso: bookedSlotInfo ? bookedSlotInfo.slotAtIso : null,
    };
  },
);

// =====================================================================
// PR #91 r2 — getCoachAvailability Callable (사용자에게 예약 가능 슬롯 노출)
// =====================================================================
// 흐름:
//   1) 클라이언트가 사전 진단 종료 후, 예약 슬롯 카드를 그리기 위해 이 함수 호출
//   2) HMAC 서명 검증 (사전 진단 링크와 동일)
//   3) coach_availability 컬렉션에서 active=true, slot_at>now,
//      booked_count<capacity 인 슬롯을 최대 20개, ASC 정렬로 반환
//   4) 클라이언트는 응답을 받아 예약 가능 시간 목록 UI 렌더
//
// 운영자(코치) 슬롯 생성 방법 (PR #91 r2 — 운영 대시보드 전 임시):
//   Firebase Console → Firestore → coach_availability 컬렉션
//   각 문서 필드:
//     - slot_at (Timestamp)              : 예약 가능 시각 (UTC 기준 저장)
//     - duration_min (number, 기본 30)
//     - capacity (number, 기본 1)        : 동시 예약 가능 인원
//     - booked_count (number, 기본 0)    : 현재까지 예약된 인원
//     - active (bool, 기본 true)
//     - notes (string, optional)         : 운영자 메모 (코치 본인 참고용)
//     - created_at (Timestamp, optional)
//
// 향후 운영 대시보드 (PR #92+) 에서 이 컬렉션을 admin UI 로 관리하도록 확장.
// =====================================================================
exports.getCoachAvailability = onCall(
  {
    region: "asia-northeast3",
    secrets: [CHECKIN_LINK_SECRET],
    cors: true,
    maxInstances: 10,
  },
  async (request) => {
    const data = request.data || {};
    const email = (data.email || "").toString().trim().toLowerCase();
    const purchaseDateIso = (data.purchaseDate || data.pd || "").toString().trim();
    const sig = (data.sig || "").toString().trim();
    const lang = (data.lang || "ko").toString().trim();

    // ── 1) 입력 검증 ───────────────────────────────────────────
    if (!isLikelyEmail(email)) {
      throw new HttpsError("invalid-argument", "이메일 형식이 올바르지 않습니다.");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(purchaseDateIso)) {
      throw new HttpsError("invalid-argument", "구매일 형식이 올바르지 않습니다.");
    }
    if (!["ko", "en"].includes(lang)) {
      throw new HttpsError("invalid-argument", "lang 은 'ko' 또는 'en' 만 허용됩니다.");
    }

    // ── 2) HMAC 서명 검증 ──────────────────────────────────────
    const secretValue = safeSecretValue(CHECKIN_LINK_SECRET);
    if (!secretValue || secretValue.length < 16) {
      throw new HttpsError("failed-precondition", "서버 설정 오류");
    }
    if (!verifyCheckinLinkSignature(email, purchaseDateIso, sig, secretValue)) {
      throw new HttpsError("permission-denied", "링크가 유효하지 않습니다.");
    }

    // ── 3) 가능 슬롯 조회 ──────────────────────────────────────
    //   현재 시각 이후, active=true 인 슬롯만. Composite index 회피 위해
    //   active=true 조건만 서버 쿼리로, slot_at/booked_count 는 메모리 필터.
    const db = admin.firestore();
    const nowMs = Date.now();
    const slots = [];
    try {
      const snap = await db.collection("coach_availability")
        .where("active", "==", true)
        .limit(100)
        .get();
      snap.forEach((d) => {
        const sd = d.data() || {};
        const slotAt = sd.slot_at;
        const slotAtMs = (slotAt && typeof slotAt.toMillis === "function") ? slotAt.toMillis() : 0;
        if (slotAtMs <= nowMs) return; // 과거 슬롯 제외
        const capacity = typeof sd.capacity === "number" ? sd.capacity : 1;
        const bookedCount = typeof sd.booked_count === "number" ? sd.booked_count : 0;
        if (bookedCount >= capacity) return; // 매진 슬롯 제외
        slots.push({
          id: d.id,
          slotAtMs,
          slotAtIso: new Date(slotAtMs).toISOString(),
          durationMin: typeof sd.duration_min === "number" ? sd.duration_min : 30,
          remaining: capacity - bookedCount,
        });
      });
    } catch (e) {
      logger.warn("[availability] 슬롯 조회 실패", { err: e && e.message });
      // 빈 배열로 진행 — 사용자는 graceful 폴백 UI 를 보게 됨
    }

    // 시간순 정렬 후 상위 20개
    slots.sort((a, b) => a.slotAtMs - b.slotAtMs);
    const top = slots.slice(0, 20);

    return {
      ok: true,
      slots: top,
      // 운영자가 슬롯을 아직 등록하지 않은 경우의 graceful 플래그
      isEmpty: top.length === 0,
    };
  },
);

/**
 * PR #91 — 세션의 모든 'free' 노드 user_input 을 수집한다.
 *   사용자가 axis_A_free, axis_B_free, axis_C_free, axis_D_free 4개 자유 메모를
 *   적었다면 그 4개를 노드 ID 키로 매핑하여 반환.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} sessionId
 * @returns {Promise<Object>} { axis_A_free: "...", axis_B_free: "...", ... }
 */
async function collectFreeInputsForSession(db, sessionId) {
  const out = {};
  if (!sessionId) return out;
  try {
    const snap = await db.collection("checkin21_chat_logs")
      .where("session_id", "==", sessionId)
      .limit(CHAT_TURN_MAX_PER_SESSION)
      .get();
    snap.forEach((d) => {
      const nodeKind = d.get("node_kind");
      const nodeId = d.get("node_id");
      const userInput = d.get("user_input");
      if (nodeKind === "free" && typeof nodeId === "string" && typeof userInput === "string") {
        // 같은 노드에 여러 turn 이 있으면 마지막 것 사용
        out[nodeId] = userInput;
      }
    });
  } catch (e) {
    logger.warn("[escalation] free_inputs 조회 실패 — 빈 객체로 진행", { err: e && e.message });
  }
  return out;
}

/**
 * PR #91 — 코치(운영자)에게 1:1 통화 예약 사전 진단 메일 발송.
 *   Resend 사용 (D22 reminder 와 동일한 sendViaResend 헬퍼).
 *   메일 본문에는 사용자 12문항 응답 + 4개 자유 메모 + 코치 메모(note) 가 모두 포함된다.
 *   → 코치는 통화 전에 이 한 통의 메일만 읽으면 충분.
 *
 * @param {Object} args
 * @returns {Promise<void>}
 */
async function sendEscalationNotificationToOperator(args) {
  const { escalationId, email, purchaseDateIso, lang, sessionId, note,
    freeInputs, userAnswers, userName, bookedSlotInfo } = args;

  const apiKey = (() => {
    try { return RESEND_API_KEY.value() || ""; } catch (e) { return ""; }
  })();
  if (!apiKey) {
    logger.warn("[escalation-mail] RESEND_API_KEY 미설정 — 발송 스킵");
    return;
  }

  const logFn = (msg, payload) => logger.warn("[escalation-mail] " + msg, payload);
  const fromKoRaw = paramOrFallback(RESEND_FROM_EMAIL_KO_PARAM, RESEND_FROM_EMAIL_KO_DEFAULT);
  const from = validFromOrFallback(fromKoRaw, RESEND_FROM_EMAIL_KO_DEFAULT, "RESEND_FROM_EMAIL_KO", logFn);
  const replyToRaw = paramOrFallback(RESEND_REPLY_TO_PARAM, RESEND_REPLY_TO_DEFAULT);
  const replyTo = validFromOrFallback(replyToRaw, RESEND_REPLY_TO_DEFAULT, "RESEND_REPLY_TO", logFn);
  const operatorRaw = paramOrFallback(OPERATOR_NOTIFICATION_EMAIL_PARAM, OPERATOR_NOTIFICATION_EMAIL_DEFAULT);
  const operatorEmail = isLikelyEmail(operatorRaw.trim()) ? operatorRaw.trim() : OPERATOR_NOTIFICATION_EMAIL_DEFAULT;

  const built = buildEscalationEmailKo({
    escalationId, email, purchaseDateIso, lang, sessionId, note,
    freeInputs, userAnswers, userName, bookedSlotInfo,
  });

  await sendViaResend({
    apiKey,
    from,
    to: operatorEmail,
    replyTo: email, // 코치가 메일 답장 시 사용자에게 직접 회신
    subject: built.subject,
    html: built.html,
    text: built.text,
    tag: "escalation_to_operator",
  });

  logger.info("[escalation-mail] 코치 알림 메일 발송 완료", {
    escalationId,
    operatorEmail,
    emailMasked: email.slice(0, 3) + "***",
  });
}

/**
 * PR #91 — 코치에게 보낼 메일 본문 구성 (한국어 고정 — 운영자 메일).
 *   사용자 12문항 응답 + 4개 자유 메모 + 1:1 통화 메모(note) 를 한 통에 정리.
 *
 * 디자인 원칙:
 *   - 코치가 30초 안에 통화 흐름을 그릴 수 있도록 정보 압축.
 *   - 자유 메모 4개는 가장 위쪽 (가장 중요한 사전 자료).
 *   - 12문항은 표 형식 (스캔 가능하게).
 *   - HTML + text 양쪽 다 제공.
 */
function buildEscalationEmailKo(args) {
  const { escalationId, email, purchaseDateIso, lang, sessionId, note,
    freeInputs, userAnswers, userName, bookedSlotInfo } = args;

  const esc = (s) => String(s || "").replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
  }[c]));

  const truncate = (s, n) => {
    const t = String(s || "").trim();
    return t.length > n ? t.slice(0, n) + "…" : t;
  };

  const nameLine = userName ? `${userName} (${email})` : email;
  const langLabel = lang === "en" ? "EN" : "KO";

  // PR #91 r2 — 예약 시각을 KST 로 포맷 (코치 메일은 한국어 고정이므로 KST 표시)
  const slotBlockHtml = (() => {
    if (!bookedSlotInfo || !bookedSlotInfo.slotAtMs) {
      return `<div style="margin:14px 0;padding:12px 14px;background:#fef3c7;border-left:3px solid #d97706;color:#78350f;font-size:14px;line-height:1.65"><b>예약 시간 미선택</b><br>고객이 가능 시간 슬롯을 선택하지 않았거나, 사용 가능한 슬롯이 없었습니다. 직접 시간을 조율해 회신해주세요.</div>`;
    }
    const d = new Date(bookedSlotInfo.slotAtMs);
    const kstStr = formatKstDateTime(d);
    return `<div style="margin:14px 0;padding:14px 16px;background:#ecfdf5;border-left:4px solid #059669;color:#064e3b;font-size:15px;line-height:1.7"><b style="font-size:13px;letter-spacing:.05em;color:#047857">📅 SCHEDULED · 고객 선택 시간 (KST)</b><br><b style="font-size:17px">${esc(kstStr)}</b><br><span style="font-size:12.5px;color:#065f46">통화 ${esc(String(bookedSlotInfo.durationMin || 30))}분 · slotId: ${esc(bookedSlotInfo.slotId)}</span></div>`;
  })();
  const slotBlockText = (() => {
    if (!bookedSlotInfo || !bookedSlotInfo.slotAtMs) {
      return `[예약 시간] 미선택 — 직접 시간 조율 후 회신 필요`;
    }
    const d = new Date(bookedSlotInfo.slotAtMs);
    return `[예약 시간 (KST)] ${formatKstDateTime(d)} · ${bookedSlotInfo.durationMin || 30}분 · slotId=${bookedSlotInfo.slotId}`;
  })();

  // 자유 메모 4개 — 가장 위
  const freeAxes = [
    { id: "axis_A_free", label: "축 A · 사명" },
    { id: "axis_B_free", label: "축 B · 행동" },
    { id: "axis_C_free", label: "축 C · 다음 3주" },
    { id: "axis_D_free", label: "축 D · 자산화 ⭐" },
  ];
  const freeBlocksHtml = freeAxes.map((ax) => {
    const v = (freeInputs && freeInputs[ax.id]) || "";
    if (!v.trim()) {
      return `<div style="margin:8px 0;padding:10px 12px;background:#f8fafc;border-left:3px solid #cbd5e1;color:#64748b;font-size:13px"><b>${esc(ax.label)}</b> <span style="color:#94a3b8">— (빈 칸으로 두심)</span></div>`;
    }
    return `<div style="margin:8px 0;padding:10px 12px;background:#fffbf0;border-left:3px solid #C8A24A;color:#0F172A;font-size:14px;line-height:1.65;white-space:pre-wrap"><b style="color:#5B4814">${esc(ax.label)}</b><br>${esc(truncate(v, 500)).replace(/\n/g, "<br>")}</div>`;
  }).join("");

  const freeBlocksText = freeAxes.map((ax) => {
    const v = (freeInputs && freeInputs[ax.id]) || "";
    return `[${ax.label}]\n${v.trim() || "(빈 칸으로 두심)"}`;
  }).join("\n\n");

  // 12문항 응답 — 표 형식
  const qids = ["q1","q2","q3","q4","q5","q6","q7","q8","q9","q10","q11","q12"];
  const qLabel = {
    q1: "사명 의식 빈도", q2: "(자유 메모)", q3: "사명 또렷했던 한 가지",
    q4: "첫 행동 실행률", q5: "(자유 메모)", q6: "가장 어려웠던 순간",
    q7: "다음 3주 명확도", q8: "한 문장 설명 가능?", q9: "다음 3주 한 문장",
    q10: "자산화 수준", q11: "전체 한 문장 가능?", q12: "전체 한 문장 ⭐",
  };
  const rowsHtml = qids.map((q) => {
    const v = (userAnswers && userAnswers[q] != null) ? String(userAnswers[q]) : "";
    return `<tr><td style="padding:6px 8px;background:#f8fafc;font-weight:600;font-size:12.5px;color:#334155;border:1px solid #e2e8f0;width:36%;vertical-align:top">${esc(q)} · ${esc(qLabel[q])}</td><td style="padding:6px 10px;font-size:13.5px;color:#0F172A;border:1px solid #e2e8f0;white-space:pre-wrap;vertical-align:top">${esc(truncate(v, 400))}</td></tr>`;
  }).join("");

  const rowsText = qids.map((q) => {
    const v = (userAnswers && userAnswers[q] != null) ? String(userAnswers[q]) : "";
    return `${q} (${qLabel[q]}): ${truncate(v, 400)}`;
  }).join("\n");

  const noteBlockHtml = note && note.trim() ?
    `<div style="margin:14px 0;padding:12px 14px;background:#eff6ff;border-left:3px solid #1E40AF;color:#1E3A8A;font-size:14px;white-space:pre-wrap">${esc(note)}</div>` :
    `<div style="margin:14px 0;padding:10px 12px;color:#94a3b8;font-size:13px">(예약 시 추가 메모 없음)</div>`;

  const subject = `[Life Portfolio] 1:1 코칭 예약 요청 — ${nameLine} (${purchaseDateIso}, ${langLabel})`;

  const html = `<!doctype html><html><body style="font-family:-apple-system,'Segoe UI','Noto Sans KR',sans-serif;background:#f1f5f9;margin:0;padding:24px"><div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">
<div style="background:#0F2A44;color:#fff;padding:18px 24px"><div style="font-size:13px;letter-spacing:.04em;opacity:.7">LIFE PORTFOLIO · COACH PREP</div><div style="font-size:18px;font-weight:700;margin-top:4px">사전 진단 → 1:1 코칭 예약 요청</div></div>
<div style="padding:20px 24px;color:#0F172A;line-height:1.7">
<div style="margin-bottom:14px;padding:10px 14px;background:#f8fafc;border-radius:8px;font-size:13.5px;color:#334155">
<b>${esc(nameLine)}</b><br>구매일: <b>${esc(purchaseDateIso)}</b> · 언어: <b>${esc(langLabel)}</b><br>세션: ${esc(sessionId.slice(0,12))}*** · escalationId: ${esc(escalationId)}
</div>
${slotBlockHtml}
<h3 style="margin:18px 0 8px;font-size:15.5px;color:#0F2A44">⬛ 코치에게 직접 전한 4개 메모 (가장 중요)</h3>
${freeBlocksHtml}
<h3 style="margin:18px 0 8px;font-size:15.5px;color:#0F2A44">📝 예약 시 추가 메모</h3>
${noteBlockHtml}
<h3 style="margin:18px 0 8px;font-size:15.5px;color:#0F2A44">📋 12문항 응답</h3>
<table style="width:100%;border-collapse:collapse;font-size:13px">${rowsHtml}</table>
<div style="margin-top:24px;padding:12px 14px;background:#fffbf0;border-left:3px solid #C8A24A;color:#5B4814;font-size:13.5px;line-height:1.7">
<b>다음 단계</b><br>1) 이 메일의 회신 버튼을 누르면 사용자(${esc(email)})에게 직접 메일이 갑니다.<br>2) 통화 일정을 안내해주세요.<br>3) 통화 완료 후 Firebase Console (checkin21_chat_escalations / id=${esc(escalationId)}) 에서 status 를 'completed' 로 변경해주세요.
</div>
</div></div></body></html>`;

  const text = [
    `[Life Portfolio] 사전 진단 → 1:1 코칭 예약 요청`,
    ``,
    `사용자: ${nameLine}`,
    `구매일: ${purchaseDateIso}`,
    `언어: ${langLabel}`,
    `escalationId: ${escalationId}`,
    `sessionId: ${sessionId.slice(0,12)}***`,
    ``,
    slotBlockText,
    ``,
    `── 코치에게 직접 전한 4개 메모 (가장 중요) ──`,
    ``,
    freeBlocksText,
    ``,
    `── 예약 시 추가 메모 ──`,
    (note && note.trim()) ? note : "(없음)",
    ``,
    `── 12문항 응답 ──`,
    rowsText,
    ``,
    `[다음 단계] 이 메일에 답장하면 사용자(${email})에게 직접 회신됩니다. 통화 일정을 안내해주시고, 통화 후 Firebase Console 에서 status 를 'completed' 로 변경해주세요.`,
  ].join("\n");

  return { subject, html, text };
}

// ═════════════════════════════════════════════════════════════════════
// PR #94 — submitCheckin21Preorder Callable
//   "21일 점검 동행" 사전 신청 게이트 (₩19,900 결제자 + 리포트 완료자만)
//
// 게이트 검증 순서 (서버):
//   1) request.auth.uid 존재 (Firebase Auth 로그인 필수)
//   2) RTDB payments/{uid}/paid === true (₩19,900 Only One Report 결제)
//   3) RTDB reports/{uid} 노드 존재 (76문항 진단 완료, 리포트 1개 이상)
//   4) checkin21_preorders 에 동일 uid 신청 없음 (1 uid = 1 신청, 중복 차단)
//
// 클라이언트(checkin-21.html / -en.html)는 같은 4단계를 UX 가드로 미리 검증하지만,
// 보안 경계는 이 서버 Callable. firestore.rules 에서 create 익명 차단 = if false.
//
// 성공 시 Firestore checkin21_preorders 컬렉션에 다음 스키마로 저장:
//   { uid, name, email, purchase_date, lang, note, source, utm,
//     submitted_at: serverTimestamp,
//     status: 'pending', payment_status: 'paid_pre_offer',
//     d22_email_sent: false }
//
//   payment_status 가 PR #94 부터 'paid_pre_offer' (₩19,900 사전 신청 단계).
//   향후 본 결제 오픈 시 'invoiced' / 'paid_full' 로 갱신.
// ═════════════════════════════════════════════════════════════════════
exports.submitCheckin21Preorder = onCall(
  { region: "asia-northeast3", cors: true },
  async (request) => {
    // ── 1) 인증 필수 ──────────────────────────────────────
    const uid = request.auth && request.auth.uid;
    if (!uid) {
      throw new HttpsError(
        "unauthenticated",
        "로그인이 필요합니다. 먼저 ₩19,900 Only One Report 구매에 사용하신 계정으로 로그인해주세요."
      );
    }

    // ── 2) 입력 데이터 정제 + 검증 ────────────────────────
    const data = request.data || {};
    const name = (data.name || "").toString().trim();
    const email = (data.email || "").toString().trim().toLowerCase();
    const purchaseDate = (data.purchase_date || "").toString().trim();
    const lang = (data.lang || "ko").toString().trim();
    const note = (data.note || "").toString().trim();
    const source = (data.source || "checkin-21.html").toString().slice(0, 80);
    const utm = (data.utm || "").toString().slice(0, 1000);

    if (!name || name.length < 1 || name.length > 80) {
      throw new HttpsError("invalid-argument", "이름은 1~80자 사이로 입력해주세요.");
    }
    if (!email || email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new HttpsError("invalid-argument", "올바른 이메일 형식이 아닙니다.");
    }
    if (purchaseDate && !/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)) {
      throw new HttpsError("invalid-argument", "리포트 받은 날짜는 YYYY-MM-DD 형식이어야 합니다.");
    }
    if (!["ko", "en"].includes(lang)) {
      throw new HttpsError("invalid-argument", "언어는 'ko' 또는 'en' 만 허용됩니다.");
    }
    if (note.length > 500) {
      throw new HttpsError("invalid-argument", "남기실 한 줄은 500자 이하로 입력해주세요.");
    }

    // ── 3) RTDB 결제 검증 (payments/{uid}/paid === true) ──
    const rtdb = admin.database();
    let paidVal = null;
    try {
      const paidSnap = await rtdb.ref(`payments/${uid}/paid`).get();
      paidVal = paidSnap.exists() ? paidSnap.val() : null;
    } catch (e) {
      logger.error("[preorder] RTDB payments 조회 실패", { uid, err: e && e.message });
      throw new HttpsError("internal", "결제 정보 조회 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    }
    if (paidVal !== true) {
      throw new HttpsError(
        "failed-precondition",
        "₩19,900 Only One Report 결제 내역이 확인되지 않습니다. 사전 신청은 결제 후 가능합니다."
      );
    }

    // ── 4) RTDB 리포트 검증 (reports/{uid} 노드 존재) ────
    let hasReport = false;
    try {
      const reportsSnap = await rtdb.ref(`reports/${uid}`).get();
      hasReport = reportsSnap.exists() && reportsSnap.val() != null;
    } catch (e) {
      logger.error("[preorder] RTDB reports 조회 실패", { uid, err: e && e.message });
      throw new HttpsError("internal", "리포트 정보 조회 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    }
    if (!hasReport) {
      throw new HttpsError(
        "failed-precondition",
        "76문항 진단이 아직 완료되지 않았습니다. 먼저 진단을 끝내신 뒤 사전 신청을 진행해주세요."
      );
    }

    // ── 5) 중복 신청 차단 (1 uid = 1 신청) ─────────────────
    // Firestore composite index 회피 — uid 단일 필드 == 검색만 사용.
    const db = admin.firestore();
    const dupSnap = await db.collection("checkin21_preorders")
      .where("uid", "==", uid)
      .limit(1)
      .get();
    if (!dupSnap.empty) {
      const existing = dupSnap.docs[0].data() || {};
      // 다국어 안전 처리: lang 파라미터 기준으로 메시지 결정
      const msg = lang === "en"
        ? "You have already submitted a pre-registration. Each account can register only once."
        : "이미 사전 신청이 완료된 계정입니다. 한 계정당 한 번만 신청 가능합니다.";
      throw new HttpsError("already-exists", msg, {
        existingSubmittedAt: existing.submitted_at && existing.submitted_at.toMillis
          ? existing.submitted_at.toMillis()
          : null,
      });
    }

    // ── 6) Firestore write ────────────────────────────────
    const docData = {
      uid, // PR #94 신규 — 게이트 검증 추적용
      name,
      email,
      purchase_date: purchaseDate || null,
      lang,
      note: note || null,
      source,
      utm: utm || null,
      submitted_at: admin.firestore.FieldValue.serverTimestamp(),
      status: "pending",
      payment_status: "paid_pre_offer", // PR #94 — ₩19,900 결제 + 리포트 확인된 사전 신청자
      d22_email_sent: false,
    };

    try {
      const docRef = await db.collection("checkin21_preorders").add(docData);
      logger.info("[preorder] 사전 신청 접수", { uid, docId: docRef.id, lang });
      return {
        ok: true,
        preorderId: docRef.id,
        message: lang === "en"
          ? "Pre-registration received. We will send you the launch invitation with a ₩5,000 additional discount."
          : "사전 신청이 접수되었습니다. 출시 시 이메일로 우선 안내드리며 ₩5,000 추가 할인이 자동 적용됩니다.",
      };
    } catch (e) {
      logger.error("[preorder] Firestore write 실패", { uid, err: e && e.message });
      throw new HttpsError("internal", "신청 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    }
  }
);

// ═════════════════════════════════════════════════════════════════════
// 운영자 전용 — getCheckin21Preorders Callable
//   21일 점검 동행 사전 신청자 목록을 운영자(admin claim)에게 반환.
//   checkin-admin.html 대시보드 + CSV/엑셀 내보내기의 데이터 소스.
//
//   보안:
//     - request.auth.token.admin === true 인 운영자만 호출 가능
//     - firestore.rules 에서 checkin21_preorders read: if false 이므로
//       클라이언트 직접 조회 불가 → 반드시 이 Admin SDK Callable 경유
//
//   반환:
//     { ok, summary:{ total, byStatus, byLang, last7d }, preorders:[ ... ] }
//   각 preorder 는 클라이언트가 표/CSV 로 바로 쓸 수 있도록 평탄화(ms 타임스탬프).
// ═════════════════════════════════════════════════════════════════════
exports.getCheckin21Preorders = onCall(
  { region: "asia-northeast3", cors: true },
  async (request) => {
    // ── 1) 운영자 권한 검증 ────────────────────────────────
    const isAdmin = !!(request.auth && request.auth.token && request.auth.token.admin === true);
    if (!isAdmin) {
      throw new HttpsError(
        "permission-denied",
        "운영자 권한이 필요합니다. 관리자 계정으로 로그인해주세요."
      );
    }

    // ── 2) Firestore 조회 (최신순) ─────────────────────────
    const db = admin.firestore();
    let snap;
    try {
      snap = await db.collection("checkin21_preorders")
        .orderBy("submitted_at", "desc")
        .limit(2000)
        .get();
    } catch (e) {
      // submitted_at 정렬 실패(인덱스/누락) 시 정렬 없이 재시도
      logger.warn("[checkin-admin] orderBy 실패, 무정렬 재조회", { err: e && e.message });
      snap = await db.collection("checkin21_preorders").limit(2000).get();
    }

    // ── 3) 평탄화 + 집계 ───────────────────────────────────
    const now = Date.now();
    const WEEK = 7 * 24 * 60 * 60 * 1000;
    const byStatus = {};
    const byLang = {};
    let last7d = 0;

    const preorders = snap.docs.map((doc) => {
      const d = doc.data() || {};
      const submittedMs = d.submitted_at && d.submitted_at.toMillis
        ? d.submitted_at.toMillis()
        : null;
      const status = d.status || "pending";
      const lang = d.lang || "ko";
      byStatus[status] = (byStatus[status] || 0) + 1;
      byLang[lang] = (byLang[lang] || 0) + 1;
      if (submittedMs && (now - submittedMs) <= WEEK) last7d++;
      return {
        id: doc.id,
        name: d.name || "",
        email: d.email || "",
        purchase_date: d.purchase_date || null,
        lang,
        note: d.note || "",
        admin_note: d.admin_note || "",
        source: d.source || "",
        utm: d.utm || "",
        status,
        payment_status: d.payment_status || "",
        d22_email_sent: d.d22_email_sent === true,
        submitted_ms: submittedMs,
        uid: d.uid || "",
      };
    });

    logger.info("[checkin-admin] 사전신청 조회", {
      admin: request.auth.token.email || request.auth.uid,
      count: preorders.length,
    });

    return {
      ok: true,
      summary: {
        total: preorders.length,
        byStatus,
        byLang,
        last7d,
      },
      preorders,
    };
  }
);

// ═════════════════════════════════════════════════════════════════════
// 운영자 전용 — updateCheckin21Status Callable
//   사전 신청자의 동행 진행 상태(status)를 운영자가 갱신.
//   허용 status: pending → invited → self_done → chat_done → completed → cancelled
//   (D22~D28 동행 워크플로를 내부적으로 추적하기 위한 단계 라벨)
// ═════════════════════════════════════════════════════════════════════
exports.updateCheckin21Status = onCall(
  { region: "asia-northeast3", cors: true },
  async (request) => {
    const isAdmin = !!(request.auth && request.auth.token && request.auth.token.admin === true);
    if (!isAdmin) {
      throw new HttpsError("permission-denied", "운영자 권한이 필요합니다.");
    }
    const data = request.data || {};
    const id = (data.id || "").toString().trim();
    const status = (data.status || "").toString().trim();
    const ALLOWED = ["pending", "invited", "self_done", "chat_done", "completed", "cancelled"];
    if (!id) throw new HttpsError("invalid-argument", "문서 id가 필요합니다.");
    if (!ALLOWED.includes(status)) {
      throw new HttpsError("invalid-argument", `허용되지 않은 status: ${status}`);
    }
    const db = admin.firestore();
    const ref = db.collection("checkin21_preorders").doc(id);
    const cur = await ref.get();
    if (!cur.exists) throw new HttpsError("not-found", "해당 사전 신청을 찾을 수 없습니다.");
    await ref.update({
      status,
      status_updated_at: admin.firestore.FieldValue.serverTimestamp(),
      status_updated_by: request.auth.token.email || request.auth.uid,
    });
    logger.info("[checkin-admin] status 갱신", { id, status, by: request.auth.token.email });
    return { ok: true, id, status };
  }
);

// ═════════════════════════════════════════════════════════════════════
// 2026-06 운영 — getCheckin21CustomerDetail Callable (관리자 전용)
//   코치 워크플로우 통합 상세뷰: 한 고객(email)의 21일 여정 전체를
//   한 화면에 모아 반환한다.
//     1) checkin21_preorders   — 사전신청 메타 + 상태 + 운영 메모
//     2) checkin21_responses   — 12문항 사전 답변 (고객의 고백)
//     3) checkin21_chat_logs   — 비대면 채팅 상담 로그 (turn 순서)
//   연결키: email (+ purchase_date 보조). uid 가 아님에 유의.
//   글로벌 코칭 CRM 벤치마크(startbuddi/coaching.com)의
//   "centralized client view (intake + session notes)" 패턴 반영.
// ═════════════════════════════════════════════════════════════════════
exports.getCheckin21CustomerDetail = onCall(
  { region: "asia-northeast3", cors: true },
  async (request) => {
    const isAdmin = !!(request.auth && request.auth.token && request.auth.token.admin === true);
    if (!isAdmin) {
      throw new HttpsError("permission-denied", "운영자 권한이 필요합니다.");
    }
    const data = request.data || {};
    const email = (data.email || "").toString().trim().toLowerCase();
    if (!email) throw new HttpsError("invalid-argument", "email 이 필요합니다.");

    const db = admin.firestore();

    // 1) 사전신청 (해당 email 의 모든 신청 — 보통 1건)
    let preSnap;
    try {
      preSnap = await db.collection("checkin21_preorders")
        .where("email", "==", email).limit(20).get();
    } catch (e) {
      logger.warn("[checkin-detail] preorder 조회 실패", { err: e && e.message });
      preSnap = { docs: [] };
    }
    const preorders = (preSnap.docs || []).map((doc) => {
      const d = doc.data() || {};
      const ms = d.submitted_at && d.submitted_at.toMillis ? d.submitted_at.toMillis() : null;
      return {
        id: doc.id, name: d.name || "", email: d.email || "",
        purchase_date: d.purchase_date || null, lang: d.lang || "ko",
        note: d.note || "", admin_note: d.admin_note || "",
        status: d.status || "pending", payment_status: d.payment_status || "",
        d22_email_sent: d.d22_email_sent === true, submitted_ms: ms, uid: d.uid || "",
      };
    }).sort((a, b) => (b.submitted_ms || 0) - (a.submitted_ms || 0));

    // 2) 12문항 사전 답변 (revision 순)
    let respSnap;
    try {
      respSnap = await db.collection("checkin21_responses")
        .where("email", "==", email).limit(50).get();
    } catch (e) {
      logger.warn("[checkin-detail] responses 조회 실패", { err: e && e.message });
      respSnap = { docs: [] };
    }
    const responses = (respSnap.docs || []).map((doc) => {
      const d = doc.data() || {};
      const ms = d.submitted_at && d.submitted_at.toMillis ? d.submitted_at.toMillis() : null;
      return {
        id: doc.id, purchase_date: d.purchase_date || null, lang: d.lang || "ko",
        answers: d.answers || {}, revision: d.revision || 1, submitted_ms: ms,
      };
    }).sort((a, b) => (a.submitted_ms || 0) - (b.submitted_ms || 0));

    // 3) 채팅 로그 (turn_index 순)
    let chatSnap;
    try {
      chatSnap = await db.collection("checkin21_chat_logs")
        .where("email", "==", email).limit(500).get();
    } catch (e) {
      logger.warn("[checkin-detail] chat_logs 조회 실패", { err: e && e.message });
      chatSnap = { docs: [] };
    }
    const chatLogs = (chatSnap.docs || []).map((doc) => {
      const d = doc.data() || {};
      const ms = d.created_at && d.created_at.toMillis ? d.created_at.toMillis() : null;
      return {
        id: doc.id, session_id: d.session_id || "", node_id: d.node_id || "",
        node_kind: d.node_kind || "", user_input: d.user_input || null,
        next_node_id: d.next_node_id || null, turn_index: d.turn_index || 0,
        created_ms: ms,
      };
    }).sort((a, b) => {
      if (a.session_id !== b.session_id) return (a.created_ms || 0) - (b.created_ms || 0);
      return (a.turn_index || 0) - (b.turn_index || 0);
    });

    return {
      ok: true,
      email,
      preorders,
      responses,
      chatLogs,
      summary: {
        preorder_count: preorders.length,
        response_count: responses.length,
        chat_turn_count: chatLogs.length,
        latest_status: preorders[0] ? preorders[0].status : null,
      },
    };
  }
);

// ═════════════════════════════════════════════════════════════════════
// 2026-06 운영 — updateCheckin21Note Callable (관리자 전용)
//   코치가 고객별 내부 메모(admin_note)를 남긴다.
//   글로벌 CRM 공통 핵심 "client notes" 패턴 반영.
// ═════════════════════════════════════════════════════════════════════
exports.updateCheckin21Note = onCall(
  { region: "asia-northeast3", cors: true },
  async (request) => {
    const isAdmin = !!(request.auth && request.auth.token && request.auth.token.admin === true);
    if (!isAdmin) {
      throw new HttpsError("permission-denied", "운영자 권한이 필요합니다.");
    }
    const data = request.data || {};
    const id = (data.id || "").toString().trim();
    const note = (data.admin_note || "").toString().slice(0, 4000);
    if (!id) throw new HttpsError("invalid-argument", "문서 id가 필요합니다.");
    const db = admin.firestore();
    const ref = db.collection("checkin21_preorders").doc(id);
    const cur = await ref.get();
    if (!cur.exists) throw new HttpsError("not-found", "해당 사전 신청을 찾을 수 없습니다.");
    await ref.update({
      admin_note: note,
      admin_note_updated_at: admin.firestore.FieldValue.serverTimestamp(),
      admin_note_updated_by: request.auth.token.email || request.auth.uid,
    });
    logger.info("[checkin-admin] 메모 갱신", { id, by: request.auth.token.email });
    return { ok: true, id };
  }
);

// ═════════════════════════════════════════════════════════════════════
// 2026-05 Marketing — submitLeadCapture Callable
//   /lead.html 무료 21일 사명선언문 워크북 이메일 캡처
//
//   ⚠️ 2026-06-01 운영 상태:
//     - /lead.html 페이지는 현재 어느 마케팅 채널에서도 노출 안 됨
//     - 코드/함수는 그대로 보존 (재가동 시 즉시 사용 가능)
//     - lead.html 상단 코멘트에 외부 차단 4중 안전망 명시
//     - rate limit (3/min, 10/hr) 적용으로 외부 발견 시도 자동 방어
//
//   기능:
//     1) 이메일/이름 입력 → Firestore lead_captures 컬렉션 저장
//     2) 동일 이메일 중복 시 already-exists 반환 (클라이언트는 성공으로 처리)
//     3) Resend 로 사용자에게 워크북 다운로드 링크 메일 발송
//     4) 운영자(faise@lifeportfolio.co.kr) 에게 신규 리드 알림 메일 발송
//
//   인증: 불필요 (공개 폼) — IP/UA rate limit 은 추후 추가
//   PIPA: 동의 체크박스 클라이언트에서 강제 + 서버에서 agreed_marketing=true 검증
// ═════════════════════════════════════════════════════════════════════
exports.submitLeadCapture = onCall(
  {
    region: "asia-northeast3",
    cors: true,
    secrets: [RESEND_API_KEY],
    memory: "256MiB",
    timeoutSeconds: 30,
  },
  async (request) => {
    // ── 0) Rate limit (IP+UA 기반) — 봇/스팸 방어 ──────────
    await checkCallableRateLimit(request, "submitLeadCapture", {
      perMinute: 3,   // 정상 사용자는 분당 1회 미만
      perHour: 10,    // 시간당 10회면 충분
    });

    // ── 1) 입력 데이터 정제 + 검증 ────────────────────────
    const data = request.data || {};
    const email = (data.email || "").toString().trim().toLowerCase();
    const name = (data.name || "").toString().trim();
    const source = (data.source || "lead.html").toString().slice(0, 80);
    const campaign = (data.campaign || "21day_workbook").toString().slice(0, 80);
    const agreed = data.agreed_marketing === true;
    const lang = (data.lang || "ko").toString().trim();
    const pageUrl = (data.page_url || "").toString().slice(0, 500);
    const referrer = (data.referrer || "").toString().slice(0, 500);
    const utm = data.utm && typeof data.utm === "object" ? data.utm : {};

    if (!email || email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new HttpsError("invalid-argument", "올바른 이메일 형식이 아닙니다.");
    }
    if (name && name.length > 80) {
      throw new HttpsError("invalid-argument", "이름은 80자 이하로 입력해주세요.");
    }
    if (!agreed) {
      throw new HttpsError("invalid-argument", "개인정보 수집·이용 동의가 필요합니다.");
    }
    if (!["ko", "en"].includes(lang)) {
      throw new HttpsError("invalid-argument", "언어는 'ko' 또는 'en' 만 허용됩니다.");
    }

    // ── 2) Firestore 중복 검사 ─────────────────────────────
    const db = admin.firestore();
    let isReturning = false;
    try {
      const dupSnap = await db.collection("lead_captures")
        .where("email", "==", email)
        .where("campaign", "==", campaign)
        .limit(1)
        .get();
      if (!dupSnap.empty) {
        isReturning = true;
      }
    } catch (e) {
      logger.error("[lead] Firestore 중복 검사 실패", { email, err: e && e.message });
      // 중복 검사 실패해도 진행 (사용자 경험 우선)
    }

    // ── 3) Firestore write (idempotent: 신규만 추가) ───────
    const utmSafe = {};
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach((k) => {
      const v = utm[k];
      if (typeof v === "string" && v.length > 0 && v.length <= 120) {
        utmSafe[k] = v;
      }
    });

    if (!isReturning) {
      const docData = {
        email,
        name: name || null,
        source,
        campaign,
        agreed_marketing: true,
        lang,
        page_url: pageUrl || null,
        referrer: referrer || null,
        utm: Object.keys(utmSafe).length ? utmSafe : null,
        submitted_at: admin.firestore.FieldValue.serverTimestamp(),
        status: "captured",
        email_sent: false,
      };
      try {
        await db.collection("lead_captures").add(docData);
      } catch (e) {
        logger.error("[lead] Firestore write 실패", { email, err: e && e.message });
        // 메일은 시도 → 사용자가 다운로드라도 받을 수 있게
      }
    } else {
      logger.info("[lead] 중복 리드 (이미 등록된 이메일)", { email, campaign });
    }

    // ── 4) Resend 메일 발송 (사용자 + 운영자) ──────────────
    const apiKey = (() => {
      try { return RESEND_API_KEY.value() || ""; } catch (e) { return ""; }
    })();
    if (!apiKey) {
      logger.error("[lead] RESEND_API_KEY 미설정 — 메일 발송 스킵");
      // 메일 못 보내도 다운로드는 클라이언트가 직접 함 → 성공 반환
      return {
        ok: true,
        is_returning: isReturning,
        email_sent: false,
        message: "이메일이 등록되었습니다. 아래 다운로드 버튼을 눌러 워크북을 받으세요.",
      };
    }

    const logFn = (msg, payload) => logger.error("[lead] " + msg, payload);
    const fromKoRaw = paramOrFallback(RESEND_FROM_EMAIL_KO_PARAM, RESEND_FROM_EMAIL_KO_DEFAULT);
    const from = validFromOrFallback(fromKoRaw, RESEND_FROM_EMAIL_KO_DEFAULT, "RESEND_FROM_EMAIL_KO", logFn);
    const replyToRaw = paramOrFallback(RESEND_REPLY_TO_PARAM, RESEND_REPLY_TO_DEFAULT);
    const replyTo = validFromOrFallback(replyToRaw, RESEND_REPLY_TO_DEFAULT, "RESEND_REPLY_TO", logFn);

    const downloadUrl = "https://lifeportfolio.co.kr/assets/lead/lifeportfolio-21day-workbook.pdf";
    const greetName = name ? `${name}님` : "안녕하세요";

    // ── 4-1) 사용자에게 다운로드 안내 메일 ────────────────
    const userSubject = "[인생포트폴리오] 21일 사명선언문 워크북이 도착했습니다 📕";
    const userHtml = `<!doctype html>
<html lang="ko">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:'Pretendard',-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#0F172A;line-height:1.7;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#F8FAFC;padding:40px 16px;">
  <tr><td align="center">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 8px 32px -16px rgba(15,23,42,0.16);">
      <tr><td style="background:linear-gradient(135deg,#0F2A44 0%,#1D4ED8 100%);padding:36px 32px;color:#fff;">
        <div style="font-size:13px;font-weight:700;color:#FDE68A;letter-spacing:0.5px;margin-bottom:8px;">21일 사명선언문 워크북</div>
        <h1 style="margin:0;font-size:22px;line-height:1.4;font-weight:800;letter-spacing:-0.3px;">${escapeHtmlSafe(greetName)},<br>워크북이 준비되었습니다.</h1>
      </td></tr>
      <tr><td style="padding:32px;">
        <p style="margin:0 0 16px;font-size:15px;color:#334155;">신청해 주셔서 감사합니다. 아래 버튼을 누르면 <strong style="color:#0F172A;">30페이지 A4 PDF</strong>를 바로 받으실 수 있습니다.</p>
        <p style="margin:0 0 24px;text-align:center;">
          <a href="${downloadUrl}" style="display:inline-block;background:#2563EB;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;font-size:15px;">📕 워크북 PDF 다운로드</a>
        </p>
        <p style="margin:0 0 8px;font-size:14px;color:#334155;"><strong style="color:#0F172A;">사용법</strong></p>
        <ul style="margin:0 0 20px;padding-left:20px;font-size:14px;color:#475569;line-height:1.8;">
          <li>인쇄하시거나 태블릿에서 직접 적으셔도 됩니다.</li>
          <li>하루 5~10분씩 한 페이지씩 답해 나가는 구조입니다.</li>
          <li>21일 뒤 마지막 페이지에서 <strong>한 줄 사명선언문</strong>이 완성됩니다.</li>
        </ul>
        <div style="border-top:1px solid #E2E8F0;padding-top:20px;margin-top:20px;">
          <p style="margin:0 0 8px;font-size:14px;color:#334155;"><strong style="color:#0F172A;">더 깊이 정리하고 싶으시다면</strong></p>
          <p style="margin:0;font-size:14px;color:#475569;line-height:1.7;">19,900원 <a href="https://lifeportfolio.co.kr/product.html" style="color:#2563EB;font-weight:600;text-decoration:none;">인생포트폴리오 Only One Report</a> 는 76문항 진단을 통해 사명·비전·강점·첫 행동을 자동으로 한 권에 담아 드립니다.</p>
        </div>
      </td></tr>
      <tr><td style="background:#F8FAFC;padding:20px 32px;border-top:1px solid #E2E8F0;">
        <p style="margin:0;font-size:12px;color:#64748B;line-height:1.6;">
          이 메일은 워크북 다운로드를 신청하신 분에게만 발송됩니다.<br>
          21일 가이드 메일은 주 1회 발송되며, 언제든 답장으로 구독을 해지하실 수 있습니다.<br>
          문의: <a href="mailto:faise@lifeportfolio.co.kr" style="color:#2563EB;">faise@lifeportfolio.co.kr</a> · <a href="https://lifeportfolio.co.kr/" style="color:#2563EB;">lifeportfolio.co.kr</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
    const userText = [
      `${greetName}, 21일 사명선언문 워크북이 준비되었습니다.`,
      ``,
      `다운로드: ${downloadUrl}`,
      ``,
      `사용법:`,
      `- 인쇄하시거나 태블릿에서 직접 적으셔도 됩니다.`,
      `- 하루 5~10분씩 한 페이지씩 답해 나가는 구조입니다.`,
      `- 21일 뒤 마지막 페이지에서 한 줄 사명선언문이 완성됩니다.`,
      ``,
      `더 깊이 정리하고 싶으시다면 19,900원 Only One Report 를 추천드립니다:`,
      `https://lifeportfolio.co.kr/product.html`,
      ``,
      `문의: faise@lifeportfolio.co.kr`,
    ].join("\n");

    let emailSent = false;
    try {
      await sendViaResend({
        apiKey,
        from,
        to: email,
        replyTo,
        subject: userSubject,
        html: userHtml,
        text: userText,
        tag: "lead_workbook_21day",
      });
      emailSent = true;
    } catch (e) {
      logger.error("[lead] 사용자 메일 발송 실패", { email, err: e && e.message, status: e && e.status });
    }

    // ── 4-2) 운영자 알림 메일 (신규 리드만, best-effort) ──
    if (!isReturning) {
      try {
        const adminSubject = `[리드 알림] 신규 워크북 다운로드: ${email}`;
        const utmStr = Object.keys(utmSafe).length
          ? Object.entries(utmSafe).map(([k, v]) => `  ${k}: ${v}`).join("\n")
          : "  (없음)";
        const adminText = [
          `신규 워크북 리드가 등록되었습니다.`,
          ``,
          `이메일: ${email}`,
          `이름: ${name || "(미입력)"}`,
          `캠페인: ${campaign}`,
          `소스: ${source}`,
          `페이지 URL: ${pageUrl || "(없음)"}`,
          `리퍼러: ${referrer || "(없음)"}`,
          `UTM:`,
          utmStr,
          ``,
          `Firebase Console > Firestore > lead_captures 컬렉션에서 확인할 수 있습니다.`,
        ].join("\n");
        const adminHtml = `<pre style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;line-height:1.7;background:#F8FAFC;padding:20px;border-radius:8px;">${escapeHtmlSafe(adminText)}</pre>`;
        await sendViaResend({
          apiKey,
          from,
          to: "faise@lifeportfolio.co.kr",
          replyTo: email, // 답장하면 사용자에게 회신
          subject: adminSubject,
          html: adminHtml,
          text: adminText,
          tag: "lead_admin_notify",
        });
      } catch (e) {
        logger.error("[lead] 운영자 알림 메일 발송 실패", { email, err: e && e.message });
      }
    }

    // ── 5) 응답 ───────────────────────────────────────────
    logger.info("[lead] 처리 완료", { email, isReturning, emailSent });
    return {
      ok: true,
      is_returning: isReturning,
      email_sent: emailSent,
      message: isReturning
        ? "이미 등록된 이메일입니다. 워크북 다운로드 링크를 다시 발송했습니다."
        : "이메일이 등록되었습니다. 아래 다운로드 버튼을 눌러 워크북을 받으세요.",
    };
  }
);

// ═════════════════════════════════════════════════════════════════════
// 2026-05 Marketing — submitB2BInquiry Callable
//   /b2b.html 기업 도입 문의 폼
//
//   기능:
//     1) 회사명/이름/이메일/관심패키지/메시지 → Firestore b2b_inquiries
//     2) 운영자(faise@lifeportfolio.co.kr) 에게 즉시 알림 메일 (reply_to=문의자)
//     3) 문의자에게 접수 확인 메일 발송
//     4) 동일 이메일 24시간 내 재문의 차단 (스팸·중복 방지)
//
//   인증: 불필요 (공개 폼)
// ═════════════════════════════════════════════════════════════════════
exports.submitB2BInquiry = onCall(
  {
    region: "asia-northeast3",
    cors: true,
    secrets: [RESEND_API_KEY],
    memory: "256MiB",
    timeoutSeconds: 30,
  },
  async (request) => {
    // ── 0) Rate limit (IP+UA 기반) — 봇/스팸 방어 ──────────
    await checkCallableRateLimit(request, "submitB2BInquiry", {
      perMinute: 2,   // B2B 문의는 분당 1회 미만이 정상
      perHour: 8,
    });

    // ── 1) 입력 검증 ──────────────────────────────────────
    const data = request.data || {};
    const name = (data.name || "").toString().trim();
    const role = (data.role || "").toString().trim();
    const company = (data.company || "").toString().trim();
    const companySize = (data.company_size || "").toString().trim();
    const email = (data.email || "").toString().trim().toLowerCase();
    const phone = (data.phone || "").toString().trim();
    const pkg = (data.package || "").toString().trim();
    const message = (data.message || "").toString().trim();
    const agreed = data.agreed === true;
    const source = (data.source || "b2b.html").toString().slice(0, 80);
    const lang = (data.lang || "ko").toString().trim();
    const pageUrl = (data.page_url || "").toString().slice(0, 500);
    const referrer = (data.referrer || "").toString().slice(0, 500);
    const utm = data.utm && typeof data.utm === "object" ? data.utm : {};

    if (!name || name.length < 1 || name.length > 40) {
      throw new HttpsError("invalid-argument", "담당자 이름은 1~40자 사이로 입력해주세요.");
    }
    if (!company || company.length < 1 || company.length > 80) {
      throw new HttpsError("invalid-argument", "회사명은 1~80자 사이로 입력해주세요.");
    }
    if (role && role.length > 60) {
      throw new HttpsError("invalid-argument", "직책은 60자 이하로 입력해주세요.");
    }
    if (!email || email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new HttpsError("invalid-argument", "올바른 업무 이메일 형식이 아닙니다.");
    }
    if (phone && phone.length > 40) {
      throw new HttpsError("invalid-argument", "연락처는 40자 이하로 입력해주세요.");
    }
    if (message && message.length > 1500) {
      throw new HttpsError("invalid-argument", "메시지는 1,500자 이하로 입력해주세요.");
    }
    if (!agreed) {
      throw new HttpsError("invalid-argument", "개인정보 수집·이용 동의가 필요합니다.");
    }
    const allowedSizes = ["", "1-50", "51-200", "201-1000", "1001+"];
    if (!allowedSizes.includes(companySize)) {
      throw new HttpsError("invalid-argument", "조직 규모 값이 올바르지 않습니다.");
    }
    const allowedPkgs = ["", "team_diagnosis", "workshop", "annual_license", "other"];
    if (!allowedPkgs.includes(pkg)) {
      throw new HttpsError("invalid-argument", "관심 패키지 값이 올바르지 않습니다.");
    }

    // ── 2) 24시간 내 동일 이메일 재문의 차단 (스팸 방지) ──
    const db = admin.firestore();
    try {
      const since = admin.firestore.Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);
      const dupSnap = await db.collection("b2b_inquiries")
        .where("email", "==", email)
        .where("submitted_at", ">=", since)
        .limit(1)
        .get();
      if (!dupSnap.empty) {
        throw new HttpsError(
          "already-exists",
          "최근 24시간 내 동일한 이메일로 문의가 접수되었습니다. 회신을 기다려 주시거나 faise@lifeportfolio.co.kr 로 직접 연락 주세요."
        );
      }
    } catch (e) {
      if (e && e.code === "already-exists") throw e;
      // 인덱스 미존재 등은 무시하고 진행 (composite index 필요할 수 있음)
      logger.warn("[b2b] 중복 검사 실패 (무시하고 진행)", { email, err: e && e.message });
    }

    // ── 3) Firestore write ────────────────────────────────
    const utmSafe = {};
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach((k) => {
      const v = utm[k];
      if (typeof v === "string" && v.length > 0 && v.length <= 120) utmSafe[k] = v;
    });

    const docData = {
      name,
      role: role || null,
      company,
      company_size: companySize || null,
      email,
      phone: phone || null,
      package: pkg || null,
      message: message || null,
      agreed: true,
      source,
      lang,
      page_url: pageUrl || null,
      referrer: referrer || null,
      utm: Object.keys(utmSafe).length ? utmSafe : null,
      submitted_at: admin.firestore.FieldValue.serverTimestamp(),
      status: "new", // new → contacted → meeting → quoted → won/lost
      admin_email_sent: false,
      user_email_sent: false,
    };

    let docRef;
    try {
      docRef = await db.collection("b2b_inquiries").add(docData);
    } catch (e) {
      logger.error("[b2b] Firestore write 실패", { email, company, err: e && e.message });
      throw new HttpsError("internal", "문의 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    }
    const inquiryId = docRef.id;

    // ── 4) Resend 메일 발송 ───────────────────────────────
    const apiKey = (() => {
      try { return RESEND_API_KEY.value() || ""; } catch (e) { return ""; }
    })();
    if (!apiKey) {
      logger.error("[b2b] RESEND_API_KEY 미설정 — 메일 발송 스킵", { inquiryId });
      return {
        ok: true,
        inquiryId,
        message: "문의가 접수되었습니다. 영업일 1일 내 회신드리겠습니다.",
      };
    }

    const logFn = (msg, payload) => logger.error("[b2b] " + msg, payload);
    const fromKoRaw = paramOrFallback(RESEND_FROM_EMAIL_KO_PARAM, RESEND_FROM_EMAIL_KO_DEFAULT);
    const from = validFromOrFallback(fromKoRaw, RESEND_FROM_EMAIL_KO_DEFAULT, "RESEND_FROM_EMAIL_KO", logFn);

    const pkgLabelMap = {
      team_diagnosis: "Tier 1 — 팀 진단 패키지",
      workshop: "Tier 2 — 사내 워크숍",
      annual_license: "Tier 3 — 연간 라이선스",
      other: "기타",
      "": "(미선택, 사전 미팅에서 추천)",
    };
    const sizeLabelMap = {
      "1-50": "1~50명",
      "51-200": "51~200명",
      "201-1000": "201~1,000명",
      "1001+": "1,001명 이상",
      "": "(미선택)",
    };

    // ── 4-1) 운영자 알림 (즉시 회신용, reply_to=문의자) ──
    const utmStr = Object.keys(utmSafe).length
      ? Object.entries(utmSafe).map(([k, v]) => `  ${k}: ${v}`).join("\n")
      : "  (없음)";
    const adminSubject = `[B2B 문의] ${company} · ${name}님 (${pkgLabelMap[pkg] || pkg})`;
    const adminText = [
      `신규 B2B 도입 문의가 접수되었습니다.`,
      ``,
      `■ 회사: ${company}`,
      `■ 담당자: ${name}${role ? ` (${role})` : ""}`,
      `■ 이메일: ${email}`,
      `■ 연락처: ${phone || "(미입력)"}`,
      `■ 조직 규모: ${sizeLabelMap[companySize] || companySize || "(미입력)"}`,
      `■ 관심 패키지: ${pkgLabelMap[pkg] || pkg || "(미선택)"}`,
      ``,
      `■ 메시지:`,
      message || "(없음)",
      ``,
      `─────────────────────────────────`,
      `■ 페이지: ${pageUrl || "(없음)"}`,
      `■ 리퍼러: ${referrer || "(없음)"}`,
      `■ UTM:`,
      utmStr,
      `■ Firestore Doc ID: ${inquiryId}`,
      ``,
      `[다음 단계] 이 메일에 답장하시면 ${email} 로 직접 회신됩니다. 영업일 1일 내 회신 권장.`,
    ].join("\n");
    const adminHtml = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:'Pretendard',-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#0F172A;line-height:1.65;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#F8FAFC;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="640" style="max-width:640px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 8px 24px -12px rgba(15,23,42,0.16);">
      <tr><td style="background:#0F2A44;padding:20px 28px;color:#fff;">
        <div style="font-size:11px;font-weight:700;color:#FDE68A;letter-spacing:1px;margin-bottom:4px;">B2B INQUIRY · NEW</div>
        <h2 style="margin:0;font-size:18px;font-weight:800;letter-spacing:-0.2px;">${escapeHtmlSafe(company)} · ${escapeHtmlSafe(name)}님</h2>
      </td></tr>
      <tr><td style="padding:24px 28px;">
        <table cellspacing="0" cellpadding="0" border="0" width="100%" style="font-size:14px;">
          <tr><td style="padding:6px 0;color:#64748B;width:110px;">회사</td><td style="padding:6px 0;color:#0F172A;font-weight:600;">${escapeHtmlSafe(company)}</td></tr>
          <tr><td style="padding:6px 0;color:#64748B;">담당자</td><td style="padding:6px 0;color:#0F172A;font-weight:600;">${escapeHtmlSafe(name)}${role ? ` (${escapeHtmlSafe(role)})` : ""}</td></tr>
          <tr><td style="padding:6px 0;color:#64748B;">이메일</td><td style="padding:6px 0;"><a href="mailto:${escapeHtmlSafe(email)}" style="color:#2563EB;text-decoration:none;font-weight:600;">${escapeHtmlSafe(email)}</a></td></tr>
          <tr><td style="padding:6px 0;color:#64748B;">연락처</td><td style="padding:6px 0;color:#0F172A;">${escapeHtmlSafe(phone || "(미입력)")}</td></tr>
          <tr><td style="padding:6px 0;color:#64748B;">조직 규모</td><td style="padding:6px 0;color:#0F172A;">${escapeHtmlSafe(sizeLabelMap[companySize] || companySize || "(미입력)")}</td></tr>
          <tr><td style="padding:6px 0;color:#64748B;">관심 패키지</td><td style="padding:6px 0;color:#0F172A;font-weight:600;">${escapeHtmlSafe(pkgLabelMap[pkg] || pkg || "(미선택)")}</td></tr>
        </table>
        <div style="margin-top:18px;padding:14px 16px;background:#F8FAFC;border-left:3px solid #2563EB;border-radius:0 6px 6px 0;">
          <div style="font-size:12px;color:#64748B;font-weight:700;letter-spacing:0.4px;margin-bottom:6px;">메시지</div>
          <div style="font-size:14px;color:#334155;white-space:pre-wrap;line-height:1.7;">${escapeHtmlSafe(message || "(없음)")}</div>
        </div>
        <div style="margin-top:18px;font-size:12px;color:#64748B;line-height:1.65;">
          페이지: ${escapeHtmlSafe(pageUrl || "(없음)")}<br>
          리퍼러: ${escapeHtmlSafe(referrer || "(없음)")}<br>
          UTM:<br><pre style="margin:4px 0 0;font-family:ui-monospace,Menlo,monospace;font-size:11px;background:#F1F5F9;padding:8px;border-radius:6px;">${escapeHtmlSafe(utmStr)}</pre>
          Firestore Doc ID: <code style="background:#F1F5F9;padding:1px 5px;border-radius:4px;">${escapeHtmlSafe(inquiryId)}</code>
        </div>
        <p style="margin:18px 0 0;font-size:13px;color:#475569;padding:12px 14px;background:#FEF3C7;border-radius:8px;line-height:1.6;">
          <strong style="color:#92400E;">[다음 단계]</strong> 이 메일에 답장하시면 <strong style="color:#0F172A;">${escapeHtmlSafe(email)}</strong> 로 직접 회신됩니다. 영업일 1일 내 회신 권장.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

    let adminSent = false;
    try {
      await sendViaResend({
        apiKey,
        from,
        to: "faise@lifeportfolio.co.kr",
        replyTo: email, // 운영자가 답장 → 문의자에게 회신
        subject: adminSubject,
        html: adminHtml,
        text: adminText,
        tag: "b2b_admin_inquiry",
      });
      adminSent = true;
    } catch (e) {
      logger.error("[b2b] 운영자 알림 메일 발송 실패", { inquiryId, err: e && e.message });
    }

    // ── 4-2) 문의자에게 접수 확인 메일 ────────────────────
    const userSubject = "[인생포트폴리오] B2B 도입 문의가 접수되었습니다";
    const userText = [
      `${name}님, 인생포트폴리오 B2B 도입 문의를 보내주셔서 감사합니다.`,
      ``,
      `■ 접수 내용`,
      `- 회사: ${company}`,
      `- 관심 패키지: ${pkgLabelMap[pkg] || pkg || "(미선택, 사전 미팅에서 추천)"}`,
      ``,
      `영업일 기준 1일 내 회신드리며, 30분 무료 사전 미팅 일정을 함께 안내해드립니다.`,
      `긴급 도입이 필요하신 경우 답장으로 알려주시면 우선 처리해드립니다.`,
      ``,
      `─────────────────────────────────`,
      `참고 자료:`,
      `· 1페이지 회사소개서: https://lifeportfolio.co.kr/assets/lead/lifeportfolio-b2b-onepager.pdf`,
      `· B2B 도입 페이지: https://lifeportfolio.co.kr/b2b.html`,
      `· 무료 워크북: https://lifeportfolio.co.kr/lead.html`,
      ``,
      `회신이 늦어지면 faise@lifeportfolio.co.kr 로 직접 답장 주세요.`,
      ``,
      `인생포트폴리오 / Life Portfolio`,
      `https://lifeportfolio.co.kr/`,
    ].join("\n");
    const userHtml = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:'Pretendard',-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#0F172A;line-height:1.7;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#F8FAFC;padding:40px 16px;">
  <tr><td align="center">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 8px 32px -16px rgba(15,23,42,0.16);">
      <tr><td style="background:linear-gradient(135deg,#0F2A44 0%,#1D4ED8 100%);padding:32px;color:#fff;">
        <div style="font-size:12px;font-weight:700;color:#FDE68A;letter-spacing:0.5px;margin-bottom:8px;">B2B 도입 문의 · 접수 완료</div>
        <h1 style="margin:0;font-size:20px;line-height:1.4;font-weight:800;letter-spacing:-0.3px;">${escapeHtmlSafe(name)}님, 문의가 접수되었습니다.</h1>
      </td></tr>
      <tr><td style="padding:28px 32px;">
        <p style="margin:0 0 16px;font-size:15px;color:#334155;">인생포트폴리오 B2B 도입 문의를 보내주셔서 감사합니다.</p>
        <table cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#F8FAFC;border-radius:8px;padding:14px;margin:0 0 18px;">
          <tr><td>
            <div style="font-size:12px;color:#64748B;font-weight:700;letter-spacing:0.5px;margin-bottom:6px;">접수 내용</div>
            <div style="font-size:14px;color:#334155;line-height:1.85;">
              · 회사: <strong style="color:#0F172A;">${escapeHtmlSafe(company)}</strong><br>
              · 관심 패키지: <strong style="color:#0F172A;">${escapeHtmlSafe(pkgLabelMap[pkg] || pkg || "(미선택, 사전 미팅에서 추천)")}</strong>
            </div>
          </td></tr>
        </table>
        <p style="margin:0 0 14px;font-size:14.5px;color:#334155;line-height:1.75;">영업일 기준 <strong style="color:#0F172A;">1일 내</strong> 회신드리며, 30분 무료 사전 미팅 일정을 함께 안내해드립니다.</p>
        <p style="margin:0 0 22px;font-size:14px;color:#475569;">긴급 도입이 필요하신 경우 답장으로 알려주시면 우선 처리해드립니다.</p>
        <div style="border-top:1px solid #E2E8F0;padding-top:18px;">
          <p style="margin:0 0 10px;font-size:13px;color:#0F172A;font-weight:700;">참고 자료</p>
          <ul style="margin:0;padding-left:18px;font-size:13.5px;color:#475569;line-height:1.85;">
            <li><a href="https://lifeportfolio.co.kr/assets/lead/lifeportfolio-b2b-onepager.pdf" style="color:#2563EB;text-decoration:none;font-weight:600;">1페이지 회사소개서 PDF</a></li>
            <li><a href="https://lifeportfolio.co.kr/b2b.html" style="color:#2563EB;text-decoration:none;font-weight:600;">B2B 도입 페이지</a></li>
            <li><a href="https://lifeportfolio.co.kr/lead.html" style="color:#2563EB;text-decoration:none;font-weight:600;">무료 21일 사명선언문 워크북</a></li>
          </ul>
        </div>
      </td></tr>
      <tr><td style="background:#F8FAFC;padding:18px 32px;border-top:1px solid #E2E8F0;">
        <p style="margin:0;font-size:12px;color:#64748B;line-height:1.65;">
          회신이 늦어지면 <a href="mailto:faise@lifeportfolio.co.kr" style="color:#2563EB;">faise@lifeportfolio.co.kr</a> 로 직접 답장 주세요.<br>
          인생포트폴리오 / Life Portfolio · <a href="https://lifeportfolio.co.kr/" style="color:#2563EB;">lifeportfolio.co.kr</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

    let userSent = false;
    try {
      await sendViaResend({
        apiKey,
        from,
        to: email,
        replyTo: "faise@lifeportfolio.co.kr",
        subject: userSubject,
        html: userHtml,
        text: userText,
        tag: "b2b_user_ack",
      });
      userSent = true;
    } catch (e) {
      logger.error("[b2b] 문의자 확인 메일 발송 실패", { inquiryId, email, err: e && e.message });
    }

    // ── 5) email_sent 플래그 업데이트 (best-effort) ────────
    if (adminSent || userSent) {
      try {
        await docRef.update({
          admin_email_sent: adminSent,
          user_email_sent: userSent,
        });
      } catch (e) {
        logger.warn("[b2b] email_sent 플래그 업데이트 실패", { inquiryId, err: e && e.message });
      }
    }

    logger.info("[b2b] 문의 접수 완료", { inquiryId, email, company, package: pkg, adminSent, userSent });
    return {
      ok: true,
      inquiryId,
      message: "문의가 접수되었습니다. 영업일 기준 1일 내 회신드리겠습니다.",
    };
  }
);

/**
 * HTML escape helper — submitLeadCapture / submitB2BInquiry 메일 본문 안전화용.
 * 사용자 입력(이름·회사·메시지)이 HTML 메일에 들어가므로 XSS·메일 깨짐 방지.
 */
function escapeHtmlSafe(s) {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// 테스트에서 재사용 가능하도록 노출
exports._checkinInternals = {
  buildCheckinLinkSignature,
  verifyCheckinLinkSignature,
  normalizeD22FormBaseUrl,
  buildCheckinFormUrlWithSig,
};

// =====================================================================
// 🏢 B2B 그룹 계약 모듈 (2026-05-28) — _b2b_group_module.js
// =====================================================================
//   submitB2BQuote   : 견적 요청 폼 (Callable)
//   reportB2BPayment : 입금 완료 신고 (Callable)
//   approveB2BOrder  : 관리자 승인 + 코드 발급 (Callable, admin claim)
//   verifyB2BCode    : 임직원 코드 검증 (Callable)
//   getB2BAdminData  : 운영자 대시보드 조회 (Callable, admin claim)
//   getB2BOrderCodes : 주문별 코드 목록 (Callable, admin claim)
//   getB2BPriceQuote : 가격표 미리보기 (Callable, 인증 불필요)
//
//   Firestore 컬렉션: b2b_orders / b2b_codes / b2b_user_links
//   가격: 부가세 별도, 10/30/50/100/200/500 단가표
//   결제: 카카오뱅크 무통장 (3333-31-6566369, 파이스)
// =====================================================================
const b2bGroup = require("./_b2b_group_module.js");
exports.submitB2BQuote     = b2bGroup.submitB2BQuote;
exports.reportB2BPayment   = b2bGroup.reportB2BPayment;
exports.approveB2BOrder    = b2bGroup.approveB2BOrder;
exports.verifyB2BCode      = b2bGroup.verifyB2BCode;
exports.getB2BAdminData    = b2bGroup.getB2BAdminData;
exports.getB2BOrderCodes   = b2bGroup.getB2BOrderCodes;
exports.resendB2BCodesEmail = b2bGroup.resendB2BCodesEmail; // 운영자 전용 — 담당자에게 코드 메일 재발송
exports.getB2BCodesEmailDraft = b2bGroup.getB2BCodesEmailDraft; // 운영자 전용 — 수동 발송용 메일 초안(제목/본문/엑셀) 생성
exports.getB2BPriceQuote   = b2bGroup.getB2BPriceQuote;
exports.lookupB2BOrder     = b2bGroup.lookupB2BOrder;     // 고객 진행 현황 조회 (공개)
exports.cancelB2BOrder     = b2bGroup.cancelB2BOrder;     // 운영자 전용
exports.refundB2BOrder     = b2bGroup.refundB2BOrder;     // 운영자 전용
exports.regenerateB2BAccessCode = b2bGroup.regenerateB2BAccessCode; // 운영자 전용
exports.bootstrapAdmin     = b2bGroup.bootstrapAdmin; // 1회용 — 화이트리스트 이메일만

// ═════════════════════════════════════════════════════════════════════
// 🛡️ cspReport — Content-Security-Policy 위반 리포트 수집 (onRequest)
// ═════════════════════════════════════════════════════════════════════
//
//   브라우저가 CSP Report-Only / report-uri 디렉티브를 만나면
//   위반 발생 시 이 엔드포인트로 자동 POST 합니다 (XHR 아닌 native).
//
//   특징:
//     - onRequest (HTTP) — Callable SDK 안 씀, 브라우저가 직접 호출
//     - Content-Type: application/csp-report (구식) 또는 application/reports+json (신식)
//     - 인증 불필요 (브라우저가 anonymous 로 보냄)
//     - IP+위반시그너처 기반 sampling/throttling 으로 로그 스팸 차단
//     - Firestore csp_reports 에 7일 TTL 로 저장
//
//   배포 후 Firebase Console > Firestore > TTL Policies 에서
//   csp_reports.expireAt 필드를 TTL 필드로 등록할 것 (1회 수동 설정).
//
//   호출 URL (firebase.json report-uri 와 일치해야 함):
//     https://asia-northeast3-lifeporfolio.cloudfunctions.net/cspReport
// ═════════════════════════════════════════════════════════════════════
exports.cspReport = onRequest(
  {
    region: "asia-northeast3",
    cors: false,
    memory: "128MiB",
    timeoutSeconds: 10,
    maxInstances: 5,
    invoker: "public",
  },
  async (req, res) => {
    // ─────────────────────────────────────────────────────────
    // 🛡️ 절대 5xx 응답 금지 원칙
    //   - 브라우저는 5xx 받으면 재시도 spam 가능
    //   - 가장 바깥쪽 try 로 모든 코드 감싸기
    //   - res 가 이미 전송된 경우 추가 send 금지 (Express ERR_HTTP_HEADERS_SENT 회피)
    // ─────────────────────────────────────────────────────────
    const safeSend = (status) => {
      try {
        if (!res.headersSent) {
          res.status(status).send("");
        }
      } catch (_) { /* 응답 실패는 무시 */ }
    };

    try {
      // CORS 헤더
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      res.set("Access-Control-Max-Age", "86400");

      if (req.method === "OPTIONS") {
        return safeSend(204);
      }
      if (req.method !== "POST") {
        // 잘못된 method 도 그냥 204 — 봇 시그널 노출 안 함
        return safeSend(204);
      }

      // ── 1) IP / UA 추출 ──────────────────────────────────
      let ip = "unknown";
      let ua = "unknown";
      let uaShort = "unknown";
      try {
        const xfwd = (req.headers["x-forwarded-for"] || "").toString().split(",")[0].trim();
        ip = xfwd || req.ip || "unknown";
        ua = (req.headers["user-agent"] || "unknown").toString().slice(0, 256);
        uaShort = crypto.createHash("sha1").update(ua).digest("hex").slice(0, 12);
      } catch (_) { /* defaults */ }

      // ── 2) body 파싱 (구식 + 신식 포맷 모두 지원) ──────────
      let body = req.body;
      try {
        if (Buffer.isBuffer(body)) {
          body = JSON.parse(body.toString("utf8"));
        } else if (typeof body === "string") {
          body = JSON.parse(body);
        }
      } catch (_) { body = null; }

      if (!body || typeof body !== "object") {
        return safeSend(204);
      }

      // 포맷 정규화
      let reports = [];
      try {
        if (Array.isArray(body)) {
          reports = body
            .filter((r) => r && (r.type === "csp-violation" || r.type === "csp" || r.body))
            .map((r) => r.body || r);
        } else if (body["csp-report"]) {
          reports = [body["csp-report"]];
        } else if (body["blocked-uri"] || body["violated-directive"] || body["effective-directive"] || body["effectiveDirective"]) {
          reports = [body];
        }
      } catch (_) { reports = []; }

      if (reports.length === 0) {
        return safeSend(204);
      }

      // ── 3) 응답을 먼저 보내기 (fire-and-forget) ─────────────
      // Firestore 쓰기 실패가 브라우저로 전달되지 않도록 즉시 204 응답
      res.status(204).send("");

      // ── 4) Firestore 저장 (비동기, 실패는 logger 만) ────────
      try {
        const db = admin.firestore();
        const now = Date.now();
        const FieldValue = admin.firestore.FieldValue;
        const expireAt = admin.firestore.Timestamp.fromMillis(now + 7 * 24 * 60 * 60 * 1000);
        const minuteBucket = Math.floor(now / 60000);

        // 한 요청에 최대 5건만 처리
        const limited = reports.slice(0, 5);
        const writes = [];

        for (const r of limited) {
          try {
            const violated = (r["violated-directive"] || r["effective-directive"] || r.effectiveDirective || "unknown").toString().slice(0, 120);
            const blocked = (r["blocked-uri"] || r.blockedURL || r.blockedURI || "unknown").toString().slice(0, 500);
            const docUri = (r["document-uri"] || r.documentURL || r.documentURI || "unknown").toString().slice(0, 500);
            const sample = (r["script-sample"] || r.sample || "").toString().slice(0, 200);
            const sourceFile = (r["source-file"] || r.sourceFile || "").toString().slice(0, 500);
            const lineNumber = parseInt(r["line-number"] || r.lineNumber || 0, 10) || 0;

            let blockedOrigin = blocked;
            try {
              if (blocked && blocked.startsWith("http")) {
                blockedOrigin = new URL(blocked).origin;
              }
            } catch (_) { /* keep raw */ }

            const sigRaw = `${violated}|${blockedOrigin}|${ip}|${uaShort}`;
            const sigHash = crypto.createHash("sha256").update(sigRaw).digest("hex").slice(0, 40);

            // 카운터 increment (sampling 결정용, race condition 없는 fire-and-forget)
            try {
              await db.collection("csp_report_counters").doc(`${sigHash}_${minuteBucket}`).set({
                count: FieldValue.increment(1),
                sigHash,
                violated,
                expireAt: admin.firestore.Timestamp.fromMillis(now + 2 * 60 * 1000),
              }, { merge: true });
            } catch (counterErr) {
              logger.warn("[csp-report] counter increment failed", { error: counterErr && counterErr.message });
            }

            // 리포트 자체는 일단 모두 저장 (sampling 은 일별 집계 시 분석으로 처리)
            // 이렇게 단순화하면 race condition 없고, 분당 5건 한도는 위 reports.slice(0,5) 가 이미 보장
            writes.push({
              createdAt: FieldValue.serverTimestamp(),
              violated,
              blocked,
              blockedOrigin,
              documentUri: docUri,
              sourceFile,
              lineNumber,
              sample,
              ip,
              uaShort,
              userAgent: ua,
              sigHash,
              expireAt,
            });
          } catch (itemErr) {
            logger.warn("[csp-report] item parse failed", { error: itemErr && itemErr.message });
          }
        }

        if (writes.length > 0) {
          const batch = db.batch();
          const col = db.collection("csp_reports");
          for (const w of writes) {
            batch.set(col.doc(), w);
          }
          await batch.commit();
          logger.info("[csp-report] saved", {
            count: writes.length,
            directives: writes.map((w) => w.violated),
            ip,
          });
        }
      } catch (storeErr) {
        // Firestore 쓰기 실패해도 이미 204 응답한 상태 → 브라우저엔 영향 없음
        logger.error("[csp-report] firestore write failed", {
          error: storeErr && storeErr.message,
          stack: storeErr && storeErr.stack,
        });
      }
    } catch (outerErr) {
      // 가장 바깥쪽 catch — 어떤 상황에서도 200대 응답 보장
      try {
        logger.error("[csp-report] outer handler error", {
          error: outerErr && outerErr.message,
          stack: outerErr && outerErr.stack,
        });
      } catch (_) { /* logger 도 실패하면 포기 */ }
      safeSend(204);
    }
  }
);


// =====================================================================
// [개인정보처리방침 개정 고지] 가입 회원 일괄 이메일 발송
// ---------------------------------------------------------------------
// - 대상: Firebase Authentication 가입 회원 전체 (이메일 보유자)
//         ※ 본 서비스의 lead/checkin 신청자도 Auth 가입으로 수렴
// - 발송: Resend API (KO/EN 병기 단일 템플릿)
// - 안전장치:
//     1) request.auth.token.admin === true 운영자만 호출 가능
//     2) 분할 발송(배치) — Resend 순간 부하/한도 완화 (배치당 대기)
//     3) 멱등성 로그 — privacy_notice_log 에 발송 성공 uid 기록,
//        재호출 시 이미 보낸 회원은 건너뜀(중복 발송 방지)
//     4) dryRun=true 면 실제 발송 없이 대상 수만 집계(미리보기)
// =====================================================================
const { buildPrivacyUpdateEmail } = require("./emails/privacy-update-2026-06-19");

// 개정 고지 캠페인 식별자 (멱등성 키 prefix)
const PRIVACY_NOTICE_CAMPAIGN = "privacy-update-2026-06-19";

exports.sendPrivacyUpdateNotice = onCall(
  {
    region: "asia-northeast3",
    memory: "512MiB",
    timeoutSeconds: 540, // 대량 발송 대비 최대
    secrets: [RESEND_API_KEY],
  },
  async (request) => {
    // ── 1) 운영자 권한 확인 ──────────────────────────────────────────
    const isAdmin = !!(request.auth && request.auth.token && request.auth.token.admin === true);
    if (!isAdmin) {
      throw new HttpsError("permission-denied", "관리자 권한이 필요합니다.");
    }

    const data = request.data || {};
    const dryRun = data.dryRun === true;
    const batchSize = Math.min(Math.max(parseInt(data.batchSize, 10) || 50, 1), 100);

    // ── Resend rate limit 대응 ──────────────────────────────────────────
    //   Resend 무료/기본 플랜은 "초당 2건" 제한(429 rate_limit_exceeded).
    //   건당 발송 사이에 간격을 두어 제한을 넘지 않도록 한다.
    //   기본 700ms(초당 약 1.4건) — 여유 있게 설정. data.sendIntervalMs 로 조정 가능(300~3000ms).
    const sendIntervalMs = Math.min(Math.max(parseInt(data.sendIntervalMs, 10) || 700, 300), 3000);
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    const apiKey = process.env.RESEND_API_KEY || RESEND_API_KEY.value();
    if (!apiKey && !dryRun) {
      throw new HttpsError("failed-precondition", "RESEND_API_KEY가 설정되지 않았습니다.");
    }

    const db = admin.firestore();
    const { subject, html, text } = buildPrivacyUpdateEmail({
      privacyUrl: "https://lifeportfolio.co.kr/privacy.html",
      b2bPrivacyUrl: "https://lifeportfolio.co.kr/b2b-privacy.html",
      contactEmail: "faise@lifeportfolio.co.kr",
    });

    let totalUsers = 0;
    let eligible = 0;     // 이메일 보유 + 미발송
    let alreadySent = 0;  // 이미 발송됨(멱등성 스킵)
    let sent = 0;
    let failed = 0;
    const failures = [];
    const eligibleSamples = []; // 발송 대상 이메일 샘플(크로스체크용, 최대 50)

    // ── 2) Firebase Auth 전체 회원 순회 (페이지네이션) ──────────────────
    let nextPageToken = undefined;
    let batch = [];

    // 한 명 발송 처리 (멱등성 체크 + Resend)
    async function deliverOne(user) {
      const email = (user.email || "").toString().trim().toLowerCase();
      if (!email) return; // 이메일 없는 계정(전화 가입 등) 스킵

      const logId = `${PRIVACY_NOTICE_CAMPAIGN}__${user.uid}`;
      const logRef = db.collection("privacy_notice_log").doc(logId);

      // 멱등성: 이미 성공 기록이 있으면 스킵
      try {
        const snap = await logRef.get();
        if (snap.exists && snap.data() && snap.data().status === "sent") {
          alreadySent++;
          return;
        }
      } catch (_) { /* 로그 조회 실패해도 발송 진행 */ }

      eligible++;
      if (eligibleSamples.length < 50) eligibleSamples.push(email); // 크로스체크용 샘플
      if (dryRun) return; // 미리보기: 실제 발송 안 함

      // Resend 속도 제한(초당 2건) 회피: 실제 발송 전 간격 대기
      await sleep(sendIntervalMs);

      try {
        // 429(rate_limit) 발생 시 백오프 후 최대 2회 재시도
        let lastErr = null;
        const maxAttempts = 3; // 최초 1회 + 재시도 2회
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            await sendViaResend({
              apiKey,
              from: "Life Portfolio <faise@lifeportfolio.co.kr>",
              to: email,
              replyTo: "faise@lifeportfolio.co.kr",
              subject,
              html,
              text,
              tag: PRIVACY_NOTICE_CAMPAIGN,
            });
            lastErr = null;
            break; // 성공
          } catch (err) {
            lastErr = err;
            // 429(속도 제한)일 때만 백오프 후 재시도, 그 외 오류는 즉시 실패
            if (err && err.status === 429 && attempt < maxAttempts) {
              await sleep(sendIntervalMs * (attempt + 1)); // 1400ms → 2100ms 점증
              continue;
            }
            throw err;
          }
        }
        if (lastErr) throw lastErr;
        sent++;
        try {
          await logRef.set({
            campaign: PRIVACY_NOTICE_CAMPAIGN,
            uid: user.uid,
            email,
            status: "sent",
            sent_at: admin.firestore.FieldValue.serverTimestamp(),
          });
        } catch (_) { /* 로그 쓰기 실패는 발송 자체엔 영향 없음 */ }
      } catch (e) {
        failed++;
        if (failures.length < 20) failures.push({ email, error: (e && e.message || String(e)).slice(0, 200) });
        try {
          await logRef.set({
            campaign: PRIVACY_NOTICE_CAMPAIGN,
            uid: user.uid,
            email,
            status: "failed",
            error: (e && e.message || String(e)).slice(0, 500),
            failed_at: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });
        } catch (_) { /* 무시 */ }
      }
    }

    // 배치 단위로 순차 발송 (Resend 부하 완화)
    async function flushBatch() {
      for (const u of batch) {
        await deliverOne(u);
        // 발송 간격(throttle)은 deliverOne 내부에서 처리 (Resend 초당 2건 제한 대응)
      }
      batch = [];
    }

    try {
      do {
        const result = await admin.auth().listUsers(1000, nextPageToken);
        for (const u of result.users) {
          totalUsers++;
          batch.push(u);
          if (batch.length >= batchSize) {
            await flushBatch();
          }
        }
        nextPageToken = result.pageToken;
      } while (nextPageToken);

      if (batch.length > 0) {
        await flushBatch();
      }
    } catch (e) {
      logger.error("[privacy-notice] listUsers/발송 예외", { err: String(e), stack: e && e.stack });
      throw new HttpsError("internal", `발송 처리 중 오류: ${(e && e.message) || String(e)}`);
    }

    logger.info("[privacy-notice] 발송 완료", { dryRun, totalUsers, eligible, alreadySent, sent, failed });

    return {
      ok: true,
      dryRun,
      campaign: PRIVACY_NOTICE_CAMPAIGN,
      totalUsers,        // Auth 전체 계정 수
      eligible,          // 이메일 보유 + 미발송(이번에 보낼/보낸 대상)
      alreadySent,       // 이미 발송돼 스킵
      sent,              // 이번에 실제 발송 성공
      failed,            // 발송 실패
      failures,          // 실패 샘플(최대 20)
      eligibleSamples,   // 발송 대상 이메일 샘플(최대 50) — 크로스체크용

      // ── 발송 내용 미리보기(크로스체크용) ──────────────────────────────
      //   dryRun/실발송 무관하게 "실제로 발송되는 그 내용"을 그대로 반환.
      //   관리자 페이지에서 제목·발신정보·본문(HTML/TEXT)을 직접 확인 가능.
      preview: {
        from: "Life Portfolio <faise@lifeportfolio.co.kr>",
        replyTo: "faise@lifeportfolio.co.kr",
        subject,           // 실제 발송 제목
        html,              // 실제 발송 본문(HTML) — iframe 미리보기용
        text,              // 실제 발송 본문(텍스트)
      },
    };
  }
);

// ═════════════════════════════════════════════════════════════════════
//   후기(Reviews) 운영 함수 — 운영 허브 / review-admin 전용
//   - 모두 request.auth.token.admin === true 운영자만 호출 가능
//   - 데이터 경로:
//       reviews/$id            : 사용자 제출 원본 (status: pending|approved|rejected)
//       reviews_published/$id  : 홈 공개 노출용 (공개 read, 클라 write 차단)
//   - 승인 = 원본 status=approved 로 갱신 + reviews_published 에 공개본 생성
//   - 비파괴: 결제/리포트/체크인 등 기존 로직과 완전 분리
// ═════════════════════════════════════════════════════════════════════
function _assertReviewAdmin(request) {
  const isAdmin = !!(request.auth && request.auth.token && request.auth.token.admin === true);
  if (!isAdmin) {
    throw new HttpsError(
      "permission-denied",
      "운영자 권한이 필요합니다. 관리자 계정으로 로그인해주세요."
    );
  }
}

// 1) 목록 조회: pending 원본 + 현재 공개본
exports.getReviewsAdminData = onCall(
  { region: "asia-northeast3", cors: true },
  async (request) => {
    _assertReviewAdmin(request);
    const db = admin.database();

    // 원본 후기 (최신 createdAt 위주, 최대 300건)
    let reviewsSnap;
    try {
      reviewsSnap = await db.ref("reviews").limitToLast(300).get();
    } catch (e) {
      logger.warn("[review-admin] reviews 조회 실패", { err: e && e.message });
      reviewsSnap = null;
    }
    const reviews = [];
    if (reviewsSnap && reviewsSnap.exists()) {
      const val = reviewsSnap.val() || {};
      Object.keys(val).forEach((id) => {
        const r = val[id] || {};
        reviews.push({
          id,
          uid: r.uid || null,
          text: typeof r.text === "string" ? r.text : "",
          initial: r.initial || "",
          status: r.status || "pending",
          createdAt: typeof r.createdAt === "number" ? r.createdAt : null,
          updatedAt: typeof r.updatedAt === "number" ? r.updatedAt : null,
          sid: r.sid || null,
          toneKey: r.toneKey || null,
          lang: r.lang || "ko",
          publishedId: r.publishedId || null, // 승인 시 연결된 공개본 키
        });
      });
    }
    // 최신순 정렬 (createdAt 내림차순, null 은 뒤로)
    reviews.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    // 현재 공개본
    let pubSnap;
    try {
      pubSnap = await db.ref("reviews_published").get();
    } catch (e) {
      logger.warn("[review-admin] reviews_published 조회 실패", { err: e && e.message });
      pubSnap = null;
    }
    const published = [];
    if (pubSnap && pubSnap.exists()) {
      const val = pubSnap.val() || {};
      Object.keys(val).forEach((id) => {
        const p = val[id] || {};
        published.push({
          id,
          text: typeof p.text === "string" ? p.text : "",
          initial: p.initial || "",
          order: typeof p.order === "number" ? p.order : 0,
          lang: p.lang || "ko",
          toneKey: p.toneKey || null,
          sourceId: p.sourceId || null, // 원본 reviews 키
          publishedAt: typeof p.publishedAt === "number" ? p.publishedAt : null,
        });
      });
    }
    published.sort((a, b) => (b.order || 0) - (a.order || 0));

    // 집계
    const byStatus = {};
    reviews.forEach((r) => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });

    return {
      ok: true,
      summary: {
        total: reviews.length,
        pending: byStatus.pending || 0,
        approved: byStatus.approved || 0,
        rejected: byStatus.rejected || 0,
        publishedCount: published.length,
      },
      reviews,
      published,
    };
  }
);

// 2) 승인·게시: 원본 status=approved + reviews_published 공개본 생성/갱신
exports.approveReview = onCall(
  { region: "asia-northeast3", cors: true },
  async (request) => {
    _assertReviewAdmin(request);
    const db = admin.database();
    const reviewId = (request.data && request.data.reviewId || "").toString().trim();
    // 관리자가 게시 시 다듬은 내용(선택). 없으면 원본 text 사용.
    const editedText = (request.data && typeof request.data.text === "string") ? request.data.text : null;
    const editedInitial = (request.data && typeof request.data.initial === "string") ? request.data.initial : null;
    if (!reviewId) throw new HttpsError("invalid-argument", "reviewId 가 필요합니다.");

    const srcRef = db.ref("reviews/" + reviewId);
    const srcSnap = await srcRef.get();
    if (!srcSnap.exists()) throw new HttpsError("not-found", "후기를 찾을 수 없습니다.");
    const src = srcSnap.val() || {};

    const text = (editedText != null ? editedText : (src.text || "")).toString().trim().slice(0, 200);
    if (text.length < 1) throw new HttpsError("invalid-argument", "후기 내용이 비어 있습니다.");
    const initial = ((editedInitial != null ? editedInitial : (src.initial || "익명")).toString().trim().slice(0, 12)) || "익명";

    // order: 현재 최대 order + 1 (최신이 위로)
    let maxOrder = 0;
    try {
      const pubSnap = await db.ref("reviews_published").get();
      if (pubSnap.exists()) {
        const val = pubSnap.val() || {};
        Object.keys(val).forEach((k) => {
          const o = val[k] && typeof val[k].order === "number" ? val[k].order : 0;
          if (o > maxOrder) maxOrder = o;
        });
      }
    } catch (_) {}
    const order = maxOrder + 1;

    // 이미 공개본이 연결돼 있으면 그 키 재사용(중복 게시 방지), 없으면 새 키
    let pubId = src.publishedId || null;
    if (!pubId) {
      pubId = db.ref("reviews_published").push().key;
    }

    const publishedAt = admin.database.ServerValue.TIMESTAMP;
    const pubPayload = {
      text,
      initial,
      order,
      lang: src.lang || "ko",
      toneKey: src.toneKey || null,
      sourceId: reviewId,
      publishedAt,
    };

    // 멀티 경로 원자적 업데이트
    const updates = {};
    updates["reviews_published/" + pubId] = pubPayload;
    updates["reviews/" + reviewId + "/status"] = "approved";
    updates["reviews/" + reviewId + "/publishedId"] = pubId;
    updates["reviews/" + reviewId + "/approvedAt"] = publishedAt;
    if (editedText != null) updates["reviews/" + reviewId + "/text"] = text;
    if (editedInitial != null) updates["reviews/" + reviewId + "/initial"] = initial;

    await db.ref().update(updates);
    logger.info("[review-admin] approveReview 완료", { reviewId, pubId, order });
    return { ok: true, reviewId, publishedId: pubId, order };
  }
);

// 3) 게시 취소(공개본 내리기) — 원본은 보존, status=pending 으로 되돌림
exports.unpublishReview = onCall(
  { region: "asia-northeast3", cors: true },
  async (request) => {
    _assertReviewAdmin(request);
    const db = admin.database();
    const reviewId = (request.data && request.data.reviewId || "").toString().trim();
    if (!reviewId) throw new HttpsError("invalid-argument", "reviewId 가 필요합니다.");

    const srcRef = db.ref("reviews/" + reviewId);
    const srcSnap = await srcRef.get();
    if (!srcSnap.exists()) throw new HttpsError("not-found", "후기를 찾을 수 없습니다.");
    const src = srcSnap.val() || {};
    const pubId = src.publishedId || null;

    const updates = {};
    if (pubId) updates["reviews_published/" + pubId] = null; // 공개본 삭제
    updates["reviews/" + reviewId + "/status"] = "pending";
    updates["reviews/" + reviewId + "/publishedId"] = null;
    await db.ref().update(updates);
    logger.info("[review-admin] unpublishReview 완료", { reviewId, pubId });
    return { ok: true, reviewId };
  }
);

// 4) 숨김/거부 — 공개본 있으면 내리고, 원본 status=rejected (목록 정리용)
exports.rejectReview = onCall(
  { region: "asia-northeast3", cors: true },
  async (request) => {
    _assertReviewAdmin(request);
    const db = admin.database();
    const reviewId = (request.data && request.data.reviewId || "").toString().trim();
    if (!reviewId) throw new HttpsError("invalid-argument", "reviewId 가 필요합니다.");

    const srcRef = db.ref("reviews/" + reviewId);
    const srcSnap = await srcRef.get();
    if (!srcSnap.exists()) throw new HttpsError("not-found", "후기를 찾을 수 없습니다.");
    const src = srcSnap.val() || {};
    const pubId = src.publishedId || null;

    const updates = {};
    if (pubId) updates["reviews_published/" + pubId] = null;
    updates["reviews/" + reviewId + "/status"] = "rejected";
    updates["reviews/" + reviewId + "/publishedId"] = null;
    updates["reviews/" + reviewId + "/rejectedAt"] = admin.database.ServerValue.TIMESTAMP;
    await db.ref().update(updates);
    logger.info("[review-admin] rejectReview 완료", { reviewId, pubId });
    return { ok: true, reviewId };
  }
);

// ═════════════════════════════════════════════════════════════════════
// PR#188(비상): 결제 복구 — 운영자 전용 도구
//   [배경] 페이플(Payple) 첫 결제는 클라이언트(payment-success.html)가 RTDB
//          payments/{uid}/paid:true 를 직접 기록한다. 인앱웹뷰 storage 격리/
//          새로고침 타이밍으로 이 기록이 누락되면, 결제했음에도 검사 게이트를
//          통과하지 못하는 사고가 발생한다(이번 6377590@naver.com 사례).
//   [목적] 운영자가 이메일로 사용자를 찾아 (1) 현재 결제/검사 상태를 조회하고
//          (2) 필요 시 paid:true 를 안전하게 부여(복구)한다.
//   [안전] · request.auth.token.admin === true 운영자만 호출 가능
//          · 이미 paid===true 면 중복 기록하지 않음(멱등)
//          · 복구 기록에 source/recoveredBy/recoveredAt 감사 로그 남김
//          · 기존 결제/리포트/체크인 로직과 완전 분리(비파괴)
// ═════════════════════════════════════════════════════════════════════
function _assertAdmin(request) {
  const isAdmin = !!(request.auth && request.auth.token && request.auth.token.admin === true);
  if (!isAdmin) {
    throw new HttpsError(
      "permission-denied",
      "운영자 권한이 필요합니다. 관리자 계정으로 로그인해주세요."
    );
  }
}

function _normalizeEmail(raw) {
  return (raw || "").toString().trim().toLowerCase();
}

// 1) 조회: 이메일 → uid + 결제(payments) + 검사(responses) 상태 (읽기 전용)
exports.lookupPaymentByEmail = onCall(
  { region: "asia-northeast3", cors: true },
  async (request) => {
    _assertAdmin(request);
    const email = _normalizeEmail(request.data && request.data.email);
    if (!email) throw new HttpsError("invalid-argument", "email 이 필요합니다.");

    // Firebase Auth 에서 이메일로 사용자 조회
    let userRec;
    try {
      userRec = await admin.auth().getUserByEmail(email);
    } catch (e) {
      throw new HttpsError("not-found", "해당 이메일의 계정을 찾을 수 없습니다: " + email);
    }
    const uid = userRec.uid;
    const db = admin.database();

    // 결제 상태
    let payment = null;
    try {
      const ps = await db.ref("payments/" + uid).get();
      payment = ps.exists() ? ps.val() : null;
    } catch (_) {}

    // 검사 세션 요약
    let responses = null, activeSid = null;
    try {
      const rs = await db.ref("responses/" + uid).get();
      if (rs.exists()) {
        const val = rs.val() || {};
        activeSid = val._active || null;
        responses = {};
        Object.keys(val).forEach((k) => {
          if (k === "_active") return;
          const s = val[k] || {};
          responses[k] = {
            status: s.status || null,
            answered: (s.meta && s.meta.answered) || (s.answers ? Object.keys(s.answers).length : 0),
            submittedAt: s.submittedAt || null,
            startedAt: s.startedAt || null
          };
        });
      }
    } catch (_) {}

    return {
      ok: true,
      uid,
      email: userRec.email || email,
      displayName: userRec.displayName || null,
      createdAt: (userRec.metadata && userRec.metadata.creationTime) || null,
      lastSignIn: (userRec.metadata && userRec.metadata.lastSignInTime) || null,
      paid: !!(payment && payment.paid === true),
      payment,
      activeSid,
      responses
    };
  }
);

// 2) 복구: 이메일 → paid:true 부여 (이미 paid 면 멱등 스킵)
exports.grantPaidByEmail = onCall(
  { region: "asia-northeast3", cors: true },
  async (request) => {
    _assertAdmin(request);
    const email = _normalizeEmail(request.data && request.data.email);
    const note = (request.data && request.data.note || "").toString().slice(0, 200);
    if (!email) throw new HttpsError("invalid-argument", "email 이 필요합니다.");

    let userRec;
    try {
      userRec = await admin.auth().getUserByEmail(email);
    } catch (e) {
      throw new HttpsError("not-found", "해당 이메일의 계정을 찾을 수 없습니다: " + email);
    }
    const uid = userRec.uid;
    const db = admin.database();
    const node = db.ref("payments/" + uid);

    // 이미 결제 기록이 있으면 멱등 처리
    const snap = await node.get();
    if (snap.exists() && snap.val() && snap.val().paid === true) {
      logger.info("[grantPaidByEmail] 이미 paid===true (스킵)", { uid, email });
      return { ok: true, alreadyPaid: true, uid, email };
    }

    const adminUid = (request.auth && request.auth.uid) || "unknown";
    const adminEmail = (request.auth && request.auth.token && request.auth.token.email) || "unknown";
    const payload = {
      paid: true,
      createdAt: new Date().toISOString(),
      source: "admin-recovery",          // 복구 출처 명시 (정상 결제와 구분)
      provider: "payple",                // 이번 사고는 페이플 누락 케이스
      recoveredBy: adminEmail,
      recoveredByUid: adminUid,
      recoveredAt: new Date().toISOString(),
      recoveryNote: note || "payple paid record missing — manual recovery (PR#188)"
    };
    await node.update(payload);
    logger.info("[grantPaidByEmail] paid 복구 완료", { uid, email, by: adminEmail, note });

    return { ok: true, alreadyPaid: false, uid, email, granted: payload };
  }
);

// ═════════════════════════════════════════════════════════════════════
// 💳 페이플(Payple) 결제창 직접연동 (A2) — 서버측 최종승인 + uid 3중검증
// ═════════════════════════════════════════════════════════════════════
//   [배경] 기존 고정 결제링크는 "결제 사실"을 서버가 검증하지 않고 고객
//          브라우저(클라이언트)에만 의존 → 인앱웹뷰 storage 유실 시 paid 누락,
//          uid↔결제 연결도 없어 이메일 불일치 사고 발생.
//   [해법] 페이플 결제창(PaypleCpayAuthCheck)에 회원 uid 를 사용자정의
//          파라미터로 주입 → 인증 결과를 이 함수가 받아 PCD_CUST_KEY 로
//          페이플 서버에 직접 "최종 승인(실제 결제 확정)" 요청 → 응답을
//          금액(19,900)·uid·상태(결제완료) 3중 검증 후에만 paid:true 기록.
//          ⇒ 인앱웹뷰 유실/이메일 불일치와 무관, 100% 회원매칭.
//   [공통] 카드(PCD_PAY_TYPE=card)·계좌(transfer) 모두 동일 함수로 처리.
//          한도가 카드/계좌로 분리되어 있어 두 수단 모두 지원해야 함.
//   [보안] · request.auth 필수(회원만 호출)
//          · 주입 uid === request.auth.uid 강제일치 (도용 차단)
//          · 금액 === 19900 강제검증 (위변조 차단)
//          · 이미 paid===true 면 멱등 차단 (중복결제 방지)
//          · PCD_CUST_KEY 는 시크릿(서버전용), 절대 클라 노출 안 함
// ─────────────────────────────────────────────────────────────────────

// 결제 금액(원) — 서버 강제 검증값. 클라이언트가 결정할 수 없음.
const PAYPLE_PRICE_KRW = 19900;

// 페이플 환경별 엔드포인트 (문서 대조 완료)
//  · 카드 최종승인: 인증응답의 PCD_PAY_COFURL 을 그대로 사용(권장).
//    폴백용 베이스: (테스트) demo-api-v2 / (라이브) api-v2.payple.kr
//  · 계좌 최종승인: PayConfirmAct.php?ACT_=PAYM
function _getPaypleEndpoints(isTest) {
  if (isTest) {
    return {
      bankConfirm: "https://democpay.payple.kr/php/PayConfirmAct.php?ACT_=PAYM",
      cardConfirmFallback:
        "https://demo-api-v2.payple.kr/api/v1/payments/cards/approval/confirm",
    };
  }
  return {
    bankConfirm: "https://cpay.payple.kr/php/PayConfirmAct.php?ACT_=PAYM",
    cardConfirmFallback:
      "https://api-v2.payple.kr/api/v1/payments/cards/approval/confirm",
  };
}

/**
 * confirmPayplePayment
 *  - 클라이언트(product-v2.html)의 페이플 callbackFunction 에서 호출
 *  - request.data: 페이플 인증결과(PCD_* 필드) + 주입한 uid
 *  - 서버에서 페이플에 최종승인 요청 → 검증 → RTDB payments/{uid} 기록
 *  - 반환: { ok, paid, payType, oid, amount }
 */
exports.confirmPayplePayment = onCall(
  {
    secrets: [PAYPLE_CST_ID, PAYPLE_CUST_KEY, PAYPLE_CLIENT_KEY],
    timeoutSeconds: 30,
    memory: "256MiB",
    cors: true,
  },
  async (request) => {
    const uid = requireAuth(request);
    const d = request.data || {};

    // ── 0) 입력 파싱 ────────────────────────────────────────────────
    // 클라이언트가 페이플 인증결과(auth response)를 그대로 넘겨준다.
    const auth = d.auth || d; // {auth:{...}} 또는 평면 둘 다 허용
    const payType = (auth.PCD_PAY_TYPE || "").toString().trim();      // "card" | "transfer"
    const authKey = (auth.PCD_AUTH_KEY || "").toString().trim();      // 인증 키
    const payReqKey = (auth.PCD_PAY_REQKEY || "").toString().trim();  // 결제 요청 키
    const cofUrl = (auth.PCD_PAY_COFURL || "").toString().trim();     // 카드 최종승인 URL(응답제공)
    // ★ 주입한 회원 uid: 가맹점 자유필드(PCD_USER_DEFINE1) 또는 클라이언트가 직접 보낸 d.uid 로만 신뢰.
    //   PCD_PAYER_NO 는 페이플이 "결제수단 회원번호"로 자체 발급/덮어쓰기 하므로 uid 검증에 사용하면 안 됨
    //   (특히 계좌 간편결제). PCD_PAYER_NO 는 결제수단 식별자로만 저장에 사용한다.
    const injectedUid = (auth.PCD_USER_DEFINE1 || d.uid || "").toString().trim(); // 주입한 회원 uid
    const oid = (auth.PCD_PAY_OID || "").toString().trim();           // 주문번호
    // isTest: 클라이언트가 명시적으로 보낸 값만 신뢰(테스트 전환 제어).
    const useTest = d.isTest === true;

    // 페이플 인증 단계 성공 여부(callback): PCD_PAY_RST === "success"
    const authRst = (auth.PCD_PAY_RST || "").toString().trim().toLowerCase();
    if (authRst && authRst !== "success") {
      logger.warn("[confirmPayplePayment] auth not success", {
        authRst, msg: auth.PCD_PAY_MSG,
      });
      throw new HttpsError("failed-precondition",
        `결제 인증 실패: ${auth.PCD_PAY_MSG || authRst}`);
    }

    if (payType !== "card" && payType !== "transfer") {
      throw new HttpsError("invalid-argument", "PCD_PAY_TYPE(card|transfer)이 필요합니다.");
    }
    if (!authKey) {
      throw new HttpsError("invalid-argument", "PCD_AUTH_KEY 가 필요합니다.");
    }

    // ── 1) 도용 차단: 주입 uid 가 로그인 uid 와 반드시 일치 ──────────
    if (injectedUid && injectedUid !== uid) {
      logger.error("[confirmPayplePayment] uid mismatch", { injectedUid, uid });
      throw new HttpsError("permission-denied", "결제자와 로그인 회원이 일치하지 않습니다.");
    }

    // ── 2) 중복 결제 차단 (멱등) ─────────────────────────────────────
    const paidSnap = await admin.database().ref(`payments/${uid}/paid`).once("value");
    if (paidSnap.val() === true) {
      throw new HttpsError("already-exists", "이미 결제가 완료된 계정입니다.");
    }

    // ── 3) 페이플 서버측 최종승인 요청 ───────────────────────────────
    const ep = _getPaypleEndpoints(useTest);
    const cstId = PAYPLE_CST_ID.value();
    const custKey = PAYPLE_CUST_KEY.value();

    // 카드: 인증응답의 PCD_PAY_COFURL 을 그대로 사용(권장). 없으면 폴백 URL.
    // 계좌: PayConfirmAct.php?ACT_=PAYM (응답에 COFURL 이 와도 계좌는 PHP 승인 사용)
    const confirmUrl =
      payType === "card"
        ? (cofUrl || ep.cardConfirmFallback)
        : ep.bankConfirm;

    const confirmBody = {
      PCD_CST_ID: cstId,
      PCD_CUST_KEY: custKey,
      PCD_AUTH_KEY: authKey,
      PCD_PAY_REQKEY: payReqKey,
      PCD_PAYER_ID: (auth.PCD_PAYER_ID || "").toString(),
    };

    let confirmRes, confirmData;
    try {
      confirmRes = await fetch(confirmUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // 페이플은 등록 도메인 Referer 검증(AUTH0004 방지)
          "Referer": "https://lifeportfolio.co.kr",
        },
        body: JSON.stringify(confirmBody),
      });
      confirmData = await confirmRes.json().catch(() => ({}));
    } catch (e) {
      logger.error("[confirmPayplePayment] confirm fetch fail", { err: String(e), confirmUrl });
      throw new HttpsError("internal", "페이플 승인 요청에 실패했습니다.");
    }

    if (!confirmRes.ok) {
      logger.error("[confirmPayplePayment] confirm http error", {
        status: confirmRes.status, body: confirmData,
      });
      throw new HttpsError("internal", "페이플 승인 응답 오류.");
    }

    // ── 4) 응답 검증 ────────────────────────────────────────────────
    // 페이플 성공: PCD_PAY_RST === "success" (일부 응답은 결제완료 문자열)
    const rst = (confirmData.PCD_PAY_RST || "").toString().toLowerCase();
    const payMsg = (confirmData.PCD_PAY_MSG || "").toString();
    if (rst !== "success") {
      logger.warn("[confirmPayplePayment] not success", { rst, payMsg, confirmData });
      throw new HttpsError("failed-precondition", `결제 승인 실패: ${payMsg || rst}`);
    }

    // 금액 검증 (서버 강제값 19,900)
    const paidTotalRaw = (confirmData.PCD_PAY_TOTAL || auth.PCD_PAY_TOTAL || "").toString();
    const paidTotal = parseInt(paidTotalRaw.replace(/[^0-9]/g, ""), 10);
    if (!paidTotal || paidTotal !== PAYPLE_PRICE_KRW) {
      logger.error("[confirmPayplePayment] amount mismatch", {
        paidTotal, expected: PAYPLE_PRICE_KRW,
      });
      throw new HttpsError("failed-precondition", "결제 금액이 일치하지 않습니다.");
    }

    // 응답측 회원 uid(주입값)도 재확인 (이중 안전).
    //   ※ PCD_PAYER_NO(결제수단 명의/회원번호)가 아니라 PCD_USER_DEFINE1(우리가 주입한 회원 uid)로 검증.
    //   결제수단 명의(부모 카드/타인 계좌 등)는 로그인 회원과 달라도 허용 — 검증 대상이 아님.
    const respUid = (confirmData.PCD_USER_DEFINE1 || injectedUid || "").toString().trim();
    if (respUid && respUid !== uid) {
      logger.error("[confirmPayplePayment] resp uid mismatch", { respUid, uid });
      throw new HttpsError("permission-denied", "결제자와 회원이 일치하지 않습니다.");
    }

    // ── 5) RTDB 기록 (paid=true) ─────────────────────────────────────
    const nowIso = new Date().toISOString();
    const payerId = (confirmData.PCD_PAYER_ID || auth.PCD_PAYER_ID || "").toString();
    // 결제수단 회원번호(페이플 자체 발급) — 명의 식별/디버깅용 참고값(검증엔 사용 안 함)
    const payerNo = (confirmData.PCD_PAYER_NO || auth.PCD_PAYER_NO || "").toString();
    await admin.database().ref(`payments/${uid}`).update({
      paid: true,
      createdAt: nowIso,
      source: "payple-cpay",          // A2 직접연동 결제(정상)
      provider: "payple",
      payType,                         // "card" | "transfer"
      env: useTest ? "test" : "live",
      oid: oid || (confirmData.PCD_PAY_OID || ""),
      payerId,                         // 계좌 빌링키(재결제용) / 카드 식별
      payerNo,                         // 결제수단 회원번호(참고용, 명의가 회원과 달라도 됨)
      amount: paidTotal,
      currency: "KRW",
      _pending: null,
    });

    logger.info("[confirmPayplePayment] paid 확정", {
      uid, payType, oid, amount: paidTotal, env: useTest ? "test" : "live",
    });

    return {
      ok: true,
      paid: true,
      payType,
      oid: oid || (confirmData.PCD_PAY_OID || ""),
      amount: paidTotal,
    };
  }
);

// =====================================================================
// [옵션 A] A2 결제창 기반 "추가 검사" 결제 승인
//   confirmPayplePayment 의 형제 함수. 차이점은 3가지뿐:
//     (1) 첫 결제(payments/{uid}/paid===true)를 "차단"이 아니라 "필수 요구"
//     (2) payments/{uid} 가 아니라 additionalPayments/{uid}/{token} 에 기록
//     (3) 반환값으로 token 을 돌려줘 suvey?token=... 로 검사 1회 소비 가능
//   ※ 같은 계정이 여러 번 호출하면 매번 다른 oid → 다른 token 이 쌓여 무제한 추가검사 가능.
//   ※ 기존 confirmPayplePayment / payments 흐름은 전혀 건드리지 않음(비파괴).
// =====================================================================
exports.confirmAdditionalPayplePayment = onCall(
  {
    secrets: [PAYPLE_CST_ID, PAYPLE_CUST_KEY, PAYPLE_CLIENT_KEY],
    timeoutSeconds: 30,
    memory: "256MiB",
    cors: true,
  },
  async (request) => {
    const uid = requireAuth(request);
    const d = request.data || {};

    // ── 0) 입력 파싱 (confirmPayplePayment 와 동일) ──────────────────
    const auth = d.auth || d;
    const payType = (auth.PCD_PAY_TYPE || "").toString().trim();      // "card" | "transfer"
    const authKey = (auth.PCD_AUTH_KEY || "").toString().trim();
    const payReqKey = (auth.PCD_PAY_REQKEY || "").toString().trim();
    const cofUrl = (auth.PCD_PAY_COFURL || "").toString().trim();
    const injectedUid = (auth.PCD_USER_DEFINE1 || d.uid || "").toString().trim();
    const oid = (auth.PCD_PAY_OID || "").toString().trim();
    const useTest = d.isTest === true;

    const authRst = (auth.PCD_PAY_RST || "").toString().trim().toLowerCase();
    if (authRst && authRst !== "success") {
      logger.warn("[confirmAdditionalPayplePayment] auth not success", {
        authRst, msg: auth.PCD_PAY_MSG,
      });
      throw new HttpsError("failed-precondition",
        `결제 인증 실패: ${auth.PCD_PAY_MSG || authRst}`);
    }

    if (payType !== "card" && payType !== "transfer") {
      throw new HttpsError("invalid-argument", "PCD_PAY_TYPE(card|transfer)이 필요합니다.");
    }
    if (!authKey) {
      throw new HttpsError("invalid-argument", "PCD_AUTH_KEY 가 필요합니다.");
    }
    if (!oid) {
      throw new HttpsError("invalid-argument", "PCD_PAY_OID(주문번호)가 필요합니다.");
    }

    // ── 1) 도용 차단: 주입 uid 가 로그인 uid 와 반드시 일치 ──────────
    if (injectedUid && injectedUid !== uid) {
      logger.error("[confirmAdditionalPayplePayment] uid mismatch", { injectedUid, uid });
      throw new HttpsError("permission-denied", "결제자와 로그인 회원이 일치하지 않습니다.");
    }

    // ── 2) ★첫 결제 "필수" (추가결제는 첫 결제가 있어야만 허용) ───────
    //   confirmPayplePayment 는 여기서 paid===true 면 "차단"하지만,
    //   추가결제는 반대로 paid===true 가 "필수 조건"이다.
    const firstPaidSnap = await admin.database().ref(`payments/${uid}/paid`).once("value");
    if (firstPaidSnap.val() !== true) {
      throw new HttpsError("failed-precondition",
        "추가 검사 결제는 첫 결제 완료 후에만 가능합니다.");
    }

    // ── 2-1) 토큰 ID 결정 + 멱등 처리 ───────────────────────────────
    //   oid(매 결제마다 고유)를 토큰 식별자로 사용 → 같은 결제 재호출은 멱등.
    const tokenId = `cpay_${oid}`;
    const refNode = admin.database().ref(`additionalPayments/${uid}/${tokenId}`);
    const existing = await refNode.once("value");
    if (existing.exists()) {
      const val = existing.val();
      logger.info("[confirmAdditionalPayplePayment] token already issued (idempotent)", {
        uid, tokenId, status: val && val.status,
      });
      return { ok: true, idempotent: true, token: tokenId, status: val && val.status };
    }

    // ── 3) 페이플 서버측 최종승인 요청 (confirmPayplePayment 와 동일) ─
    const ep = _getPaypleEndpoints(useTest);
    const cstId = PAYPLE_CST_ID.value();
    const custKey = PAYPLE_CUST_KEY.value();

    const confirmUrl =
      payType === "card"
        ? (cofUrl || ep.cardConfirmFallback)
        : ep.bankConfirm;

    const confirmBody = {
      PCD_CST_ID: cstId,
      PCD_CUST_KEY: custKey,
      PCD_AUTH_KEY: authKey,
      PCD_PAY_REQKEY: payReqKey,
      PCD_PAYER_ID: (auth.PCD_PAYER_ID || "").toString(),
    };

    let confirmRes, confirmData;
    try {
      confirmRes = await fetch(confirmUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Referer": "https://lifeportfolio.co.kr",
        },
        body: JSON.stringify(confirmBody),
      });
      confirmData = await confirmRes.json().catch(() => ({}));
    } catch (e) {
      logger.error("[confirmAdditionalPayplePayment] confirm fetch fail", { err: String(e), confirmUrl });
      throw new HttpsError("internal", "페이플 승인 요청에 실패했습니다.");
    }

    if (!confirmRes.ok) {
      logger.error("[confirmAdditionalPayplePayment] confirm http error", {
        status: confirmRes.status, body: confirmData,
      });
      throw new HttpsError("internal", "페이플 승인 응답 오류.");
    }

    // ── 4) 응답 검증 (성공 여부 + 금액 + uid) ───────────────────────
    const rst = (confirmData.PCD_PAY_RST || "").toString().toLowerCase();
    const payMsg = (confirmData.PCD_PAY_MSG || "").toString();
    if (rst !== "success") {
      logger.warn("[confirmAdditionalPayplePayment] not success", { rst, payMsg, confirmData });
      throw new HttpsError("failed-precondition", `결제 승인 실패: ${payMsg || rst}`);
    }

    const paidTotalRaw = (confirmData.PCD_PAY_TOTAL || auth.PCD_PAY_TOTAL || "").toString();
    const paidTotal = parseInt(paidTotalRaw.replace(/[^0-9]/g, ""), 10);
    if (!paidTotal || paidTotal !== PAYPLE_PRICE_KRW) {
      logger.error("[confirmAdditionalPayplePayment] amount mismatch", {
        paidTotal, expected: PAYPLE_PRICE_KRW,
      });
      throw new HttpsError("failed-precondition", "결제 금액이 일치하지 않습니다.");
    }

    const respUid = (confirmData.PCD_USER_DEFINE1 || injectedUid || "").toString().trim();
    if (respUid && respUid !== uid) {
      logger.error("[confirmAdditionalPayplePayment] resp uid mismatch", { respUid, uid });
      throw new HttpsError("permission-denied", "결제자와 회원이 일치하지 않습니다.");
    }

    // ── 5) ★additionalPayments/{uid}/{token} 기록 (소비 가능한 토큰) ─
    //   issuePaypleAdditionalToken 의 스키마와 동일한 형태 — suvey 의
    //   _verifyAddPayToken / consumeAdditionalToken 이 그대로 인식한다.
    const nowIso = new Date().toISOString();
    const payerId = (confirmData.PCD_PAYER_ID || auth.PCD_PAYER_ID || "").toString();
    const payerNo = (confirmData.PCD_PAYER_NO || auth.PCD_PAYER_NO || "").toString();
    await refNode.set({
      paid: true,
      status: "unused",                         // suvey 에서 consume 시 "consumed" 로 전환
      consumedBySid: null,
      consumedAt: null,
      orderID: tokenId,
      captureID: "",
      amount: String(paidTotal),
      currency: "KRW",
      source: "payple-cpay",                    // A2 결제창 추가결제(정상)
      provider: "payple",
      payType,                                  // "card" | "transfer"
      env: useTest ? "test" : "live",
      oid,
      payerId,
      payerNo,
      createdAt: nowIso,
    });

    logger.info("[confirmAdditionalPayplePayment] 추가검사 토큰 확정", {
      uid, tokenId, payType, oid, amount: paidTotal, env: useTest ? "test" : "live",
    });

    return {
      ok: true,
      idempotent: false,
      token: tokenId,
      status: "unused",
      payType,
      oid,
      amount: paidTotal,
    };
  }
);

// ─────────────────────────────────────────────────────────────────────
// 페이플 결제창 호출용 클라이언트 키 제공 (CLIENT_KEY 만 노출, CUST_KEY 는 절대 X)
//   product-v2.html 이 결제창을 띄우기 직전 호출하여 clientKey/cstId 를 받음.
//   회원만 호출 가능(uid 확인), 민감키(CUST_KEY)는 절대 반환하지 않음.
// ─────────────────────────────────────────────────────────────────────
exports.getPaypleClientConfig = onCall(
  {
    secrets: [PAYPLE_CST_ID, PAYPLE_CLIENT_KEY],
    cors: true,
  },
  async (request) => {
    const uid = requireAuth(request);
    return {
      ok: true,
      uid,
      cstId: PAYPLE_CST_ID.value(),
      clientKey: PAYPLE_CLIENT_KEY.value(),
      priceKrw: PAYPLE_PRICE_KRW,
    };
  }
);
