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
 *   PAYPAL_PRICE_USD=8.99
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret, defineString } = require("firebase-functions/params");
const { setGlobalOptions } = require("firebase-functions/v2");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const fetch = require("node-fetch");

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

// =====================================================================
// 일반 환경변수 (functions/.env 파일에서 읽음)
// =====================================================================
const PAYPAL_ENV_PARAM = defineString("PAYPAL_ENV", { default: "sandbox" });
const PAYPAL_PRICE_USD_PARAM = defineString("PAYPAL_PRICE_USD", { default: "8.99" });

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
    priceUSD: PAYPAL_PRICE_USD_PARAM.value() || "8.99",
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
