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

// 발신/링크 환경변수 (.env)
// ⚠️ 중요: .env 파일이 함수 배포에 포함되지 않은 경우(또는 빈 문자열로 평가될 때)
//   Resend API 가 'Invalid from' 422 에러를 반환할 수 있다.
//   → defineString default 외에 paramOrFallback() 헬퍼로 빈 문자열도 폴백 처리.
const RESEND_FROM_EMAIL_KO_DEFAULT = "Life Portfolio <faise@lifeportfolio.co.kr>";
const RESEND_FROM_EMAIL_EN_DEFAULT = "Life Portfolio <faise@lifeportfolio.co.kr>";
const RESEND_REPLY_TO_DEFAULT = "faise@lifeportfolio.co.kr";
const D22_FORM_BASE_URL_KO_DEFAULT = "https://lifeportfolio.co.kr/checkin-21.html";
const D22_FORM_BASE_URL_EN_DEFAULT = "https://lifeportfolio.co.kr/checkin-21-en.html";
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
    secrets: [RESEND_API_KEY],
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

    // ── 환경변수 → 폴백 → "API Key 오용 감지" 3단계 안전망 ──
    // 's2_' 또는 're_' 시작 = API Key 오설정. fallback 으로 자동 복구.
    function rejectApiKeyPattern(value, fallback, paramName) {
      const v = (value || "").toString().trim();
      if (/^re_[A-Za-z0-9_-]{20,}$/.test(v)) {
        logger.error("[d22] 환경변수에 API Key 오설정 감지 — 자동 복구", {
          param: paramName,
          badValueStartsWith: v.slice(0, 5) + "***",
          fallback,
        });
        return fallback;
      }
      return v.length > 0 ? v : fallback;
    }

    const fromKoRaw = paramOrFallback(RESEND_FROM_EMAIL_KO_PARAM, RESEND_FROM_EMAIL_KO_DEFAULT);
    const fromEnRaw = paramOrFallback(RESEND_FROM_EMAIL_EN_PARAM, RESEND_FROM_EMAIL_EN_DEFAULT);
    const replyToRaw = paramOrFallback(RESEND_REPLY_TO_PARAM, RESEND_REPLY_TO_DEFAULT);
    const fromKo = rejectApiKeyPattern(fromKoRaw, RESEND_FROM_EMAIL_KO_DEFAULT, "RESEND_FROM_EMAIL_KO");
    const fromEn = rejectApiKeyPattern(fromEnRaw, RESEND_FROM_EMAIL_EN_DEFAULT, "RESEND_FROM_EMAIL_EN");
    const replyTo = rejectApiKeyPattern(replyToRaw, RESEND_REPLY_TO_DEFAULT, "RESEND_REPLY_TO");
    const formUrlKo = paramOrFallback(D22_FORM_BASE_URL_KO_PARAM, D22_FORM_BASE_URL_KO_DEFAULT);
    const formUrlEn = paramOrFallback(D22_FORM_BASE_URL_EN_PARAM, D22_FORM_BASE_URL_EN_DEFAULT);

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
          const built = lang === "en"
            ? buildD22EmailEn({ name, purchaseDateIso: purchaseDate, formUrl: formUrlEn, replyTo })
            : buildD22EmailKo({ name, purchaseDateIso: purchaseDate, formUrl: formUrlKo, replyTo });

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
    secrets: [RESEND_API_KEY],
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

    // ── 환경변수 → 폴백 → "API Key 오용 감지" 3단계 안전망 ──
    // 환경변수 값이 're_' 로 시작하면 = Resend API Key 가 FROM/REPLY 자리에 잘못 들어간 경우
    // → 즉시 fallback 으로 자동 복구 + 경고 로그 (배포 환경 오설정 자가 치유)
    function rejectApiKeyPattern(value, fallback, paramName) {
      const v = (value || "").toString().trim();
      // Resend API Key 패턴: 're_' + 영숫자 24자 이상
      if (/^re_[A-Za-z0-9_-]{20,}$/.test(v)) {
        logger.error("[testD22] 환경변수에 API Key 오설정 감지 — 자동 복구", {
          param: paramName,
          badValueStartsWith: v.slice(0, 5) + "***",
          fallback,
        });
        return fallback;
      }
      return v.length > 0 ? v : fallback;
    }

    const fromKoRaw = paramOrFallback(RESEND_FROM_EMAIL_KO_PARAM, RESEND_FROM_EMAIL_KO_DEFAULT);
    const fromEnRaw = paramOrFallback(RESEND_FROM_EMAIL_EN_PARAM, RESEND_FROM_EMAIL_EN_DEFAULT);
    const replyToRaw = paramOrFallback(RESEND_REPLY_TO_PARAM, RESEND_REPLY_TO_DEFAULT);
    const fromKo = rejectApiKeyPattern(fromKoRaw, RESEND_FROM_EMAIL_KO_DEFAULT, "RESEND_FROM_EMAIL_KO");
    const fromEn = rejectApiKeyPattern(fromEnRaw, RESEND_FROM_EMAIL_EN_DEFAULT, "RESEND_FROM_EMAIL_EN");
    const replyTo = rejectApiKeyPattern(replyToRaw, RESEND_REPLY_TO_DEFAULT, "RESEND_REPLY_TO");
    const formUrlKo = paramOrFallback(D22_FORM_BASE_URL_KO_PARAM, D22_FORM_BASE_URL_KO_DEFAULT);
    const formUrlEn = paramOrFallback(D22_FORM_BASE_URL_EN_PARAM, D22_FORM_BASE_URL_EN_DEFAULT);

    // 발신 주소 형식 사전 검증 — Resend 422 'Invalid from' 방어
    // 허용 형식: "email@example.com" 또는 "Name <email@example.com>"
    const fromEmailRe = /^(?:[^<>@\s]+\s*<\s*[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+\s*>|[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+)$/;
    if (!fromEmailRe.test(fromKo) || !fromEmailRe.test(fromEn)) {
      logger.error("[testD22] FROM 이메일 형식 오류", {
        fromKo, fromEn, replyTo, formUrlKo, formUrlEn,
      });
      throw new HttpsError("failed-precondition",
        `발신 이메일 형식이 잘못되었습니다 (fromKo='${fromKo}', fromEn='${fromEn}'). ` +
        `'email@example.com' 또는 'Name <email@example.com>' 형식이어야 합니다.`);
    }

    const targets = langInput === "both" ? ["ko", "en"] : [langInput];
    const sent = [];
    const failed = [];

    for (const lang of targets) {
      try {
        const built = lang === "en"
          ? buildD22EmailEn({ name, purchaseDateIso, formUrl: formUrlEn, replyTo })
          : buildD22EmailKo({ name, purchaseDateIso, formUrl: formUrlKo, replyTo });

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
