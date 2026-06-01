/**
 * 🛡️ Callable Function Rate Limit 공유 모듈
 * ─────────────────────────────────────────────────────────────
 *
 * 목적: 공개(미인증) Callable Functions 의 IP+UA 기반 throttling.
 *   - 봇 / 스크래퍼 / 무차별 폼 제출 방어
 *   - Firestore `rate_limits/{key}` 문서로 sliding window 카운터 유지
 *
 * 사용법 (callable 함수 본문 첫 줄):
 *   const { checkCallableRateLimit } = require("./_rate_limit");
 *   await checkCallableRateLimit(request, "submitB2BQuote", {
 *     perMinute: 3,
 *     perHour: 15,
 *   });
 *
 * 정책:
 *   - key = sha256(ip + "|" + uaHashPrefix + "|" + fnName + "|" + bucket).substr(0,40)
 *   - 분당/시간당 두 종 카운터 동시 유지 (TTL 자동 정리)
 *   - 한도 초과 시 HttpsError("resource-exhausted", ...) throw
 *   - Firestore 일시 장애 시 fail-open (서비스 가용성 우선)
 *
 * Firestore TTL Policy (Firebase Console > Firestore > TTL Policies):
 *   - rate_limits.expireAt → 활성화 필요 (분/시간 bucket 자동 정리)
 */

const crypto = require("crypto");
const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");
const { HttpsError } = require("firebase-functions/v2/https");

function _getClientFingerprint(request) {
  const req = (request && request.rawRequest) || {};
  const headers = req.headers || {};
  const xfwd = (headers["x-forwarded-for"] || "").toString().split(",")[0].trim();
  const ip = xfwd || req.ip || (req.connection && req.connection.remoteAddress) || "unknown";
  const ua = (headers["user-agent"] || "unknown").toString().slice(0, 256);
  const uaShort = crypto.createHash("sha1").update(ua).digest("hex").slice(0, 12);
  return { ip, ua, uaShort };
}

function _rlKey(ip, uaShort, fnName, bucket) {
  const raw = `${ip}|${uaShort}|${fnName}|${bucket}`;
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 40);
}

/**
 * Callable Function용 rate limit 검증.
 * @param {object} request - v2 onCall request 객체
 * @param {string} fnName  - 함수 식별자 (로그/키용)
 * @param {object} limits  - { perMinute, perHour }
 * @throws HttpsError("resource-exhausted") 한도 초과 시
 */
async function checkCallableRateLimit(request, fnName, limits = {}) {
  const perMinute = limits.perMinute || 10;
  const perHour = limits.perHour || 100;
  try {
    const { ip, uaShort } = _getClientFingerprint(request);
    // localhost (개발/에뮬레이터) 는 skip
    if (ip === "127.0.0.1" || ip === "::1" || ip === "unknown") return;

    const now = Date.now();
    const minuteBucket = Math.floor(now / 60000);
    const hourBucket = Math.floor(now / 3600000);
    const db = admin.firestore();

    const minKey = _rlKey(ip, uaShort, fnName, `m${minuteBucket}`);
    const hourKey = _rlKey(ip, uaShort, fnName, `h${hourBucket}`);

    const minRef = db.collection("rate_limits").doc(minKey);
    const hourRef = db.collection("rate_limits").doc(hourKey);

    const FieldValue = admin.firestore.FieldValue;

    await Promise.all([
      minRef.set({
        count: FieldValue.increment(1),
        fnName,
        ip,
        uaShort,
        window: "minute",
        bucket: minuteBucket,
        expireAt: admin.firestore.Timestamp.fromMillis(now + 2 * 60 * 1000),
      }, { merge: true }),
      hourRef.set({
        count: FieldValue.increment(1),
        fnName,
        ip,
        uaShort,
        window: "hour",
        bucket: hourBucket,
        expireAt: admin.firestore.Timestamp.fromMillis(now + 2 * 60 * 60 * 1000),
      }, { merge: true }),
    ]);

    const [minSnap, hourSnap] = await Promise.all([minRef.get(), hourRef.get()]);
    const minCount = (minSnap.exists && minSnap.data().count) || 0;
    const hourCount = (hourSnap.exists && hourSnap.data().count) || 0;

    if (minCount > perMinute) {
      logger.warn("[rate-limit] minute exceeded", { fnName, ip, uaShort, minCount, perMinute });
      throw new HttpsError(
        "resource-exhausted",
        "요청이 너무 잦습니다. 잠시 후 다시 시도해주세요. (1분 한도 초과)"
      );
    }
    if (hourCount > perHour) {
      logger.warn("[rate-limit] hour exceeded", { fnName, ip, uaShort, hourCount, perHour });
      throw new HttpsError(
        "resource-exhausted",
        "요청이 너무 많습니다. 한 시간 후 다시 시도해주세요."
      );
    }
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    logger.error("[rate-limit] check failed (fail-open)", { fnName, error: err && err.message });
  }
}

module.exports = { checkCallableRateLimit };
