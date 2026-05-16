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

const crypto = require("crypto");
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
    const db = admin.firestore();
    const oneDayAgo = admin.firestore.Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await db.collection("checkin21_responses")
      .where("email", "==", email)
      .where("purchase_date", "==", purchaseDateIso)
      .where("submitted_at", ">", oneDayAgo)
      .limit(4)
      .get();
    if (recent.size >= 3) {
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
      revision: recent.size + 1, // 첫 제출 = 1, 재제출 = 2, ...
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

// 테스트에서 재사용 가능하도록 노출
exports._checkinInternals = {
  buildCheckinLinkSignature,
  verifyCheckinLinkSignature,
  normalizeD22FormBaseUrl,
  buildCheckinFormUrlWithSig,
};

