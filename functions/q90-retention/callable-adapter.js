"use strict";
/**
 * q90-retention — authenticated callable boundary (adapter). Q90-R9-IMPL, G10/G11/G12.
 *
 * NOT exported from functions/index.js. NOT deployed. Nothing here is reachable until an owner-approved
 * export line is added (API-CONTRACT §3 R1–R8). Zero new dependencies: the Functions SDK pieces
 * (onCall factory, HttpsError class, logger) are INJECTED, so the same adapter runs under the real
 * `firebase-functions/v2/https`, the emulator, or a test double.
 *
 *   const { createQ90Callables } = require("./q90-retention/callable-adapter");
 *   const q90 = createQ90Callables({
 *     onCall, HttpsError, logger,                       // firebase-functions/v2/https + /logger
 *     retention: createRetention({ db, runBundle: createVendoredRunner().runBundle, featureEnabled, ledgerPolicy }),
 *     // or let the adapter assemble it:
 *     // assemble: { db: admin.database(), featureEnabled, ledgerPolicy, verifyProviderCapture? }
 *     callOptions: { region: "asia-northeast3", enforceAppCheck: false, ... },   // passed to onCall
 *   });
 *   // q90.recordConsent, q90.planGeneration, q90.generateInstancePair, q90.readInstancePair
 *
 * Contract (see API-CONTRACT.md §1, §7):
 *   - uid: ONLY `request.auth.uid`. A `uid` (or `actorUid`) field in the body is never read; if present and
 *     different from the token uid the call is rejected (invalid-argument) so a client cannot even *appear*
 *     to act for another uid. `recordConsent`'s `actorUid` is set by the adapter from the token.
 *   - unauthenticated / unsafe uid → `unauthenticated`. Body must be a plain object; sid / instanceId /
 *     consentEventId / priorInstanceId must be id-safe; targetBundle / locale / disclosureVersion must be
 *     strings from the module's allow-lists; unknown body keys are rejected (invalid-argument).
 *   - RetentionError.code → HttpsError via a closed allow-list (ERROR_MAP). Unknown codes and non-Retention
 *     errors become `internal` with a generic message. The HttpsError `details` carries ONLY
 *     `{ code, requestId }` — never messages, paths, answers, entitlement refs or payment fields.
 *   - Logging: structured, redacted. Only { requestId, fn, uidHash (sha256 prefix), sid, code, ms } — never
 *     request bodies, module error messages (they can contain paths/refs), answers, or ledger data.
 *   - Feature flag: injected `featureEnabled(uid)`; default OFF. `readInstancePair` is served regardless of
 *     the flag (saved instances keep serving) — that independence is a contract, kept here.
 *   - What this adapter does NOT do: no export, no provider payment call, no rules, no loader change, no
 *     automatic staging cleanup, no lock TTL re-opening. A stuck key (X's finding) surfaces through the
 *     module's own codes (`aborted` for SESSION_CHANGED, `data-loss` for inconsistent state) for the
 *     owner's policy decision.
 *
 * Atomicity limits (3868952 B — precise statement): the pre-publish re-validation of `responses` and
 * entitlement evidence and the multi-location publish are SEPARATE operations. There is no global atomicity
 * across them, and a change that lands in that window is NOT guaranteed to be detected later:
 * `readInstancePair` deliberately does not read current answers or entitlement, and once a pair is
 * published `settleComplete` reuses it. The published docs carry `inputSnapshotHash`/`entitlementEvidenceHash`
 * so a caller CAN compare them to current data if it chooses, but the module does not. Nothing in this
 * adapter adds atomicity or detection. Saved-read behaviour is unchanged on purpose.
 *
 * Runner lifecycle (3868952 A): with `assemble`, the vendored runner is verified lazily on the first
 * generation and cached; a missing/corrupt bundles/ blocks generation only (`BUNDLE_RUNNER_UNAVAILABLE`
 * → unavailable) — factory construction and `readInstancePair` never depend on it.
 */

const crypto = require("crypto");
const { createRetention, RetentionError, KNOWN_BUNDLES, KNOWN_DISCLOSURES } = require("./index.js");

// ───────────────────────── error mapping (closed allow-list) ─────────────────────────
// HttpsError codes are the FunctionsErrorCode set. Messages are fixed, client-safe strings.
const ERROR_MAP = Object.freeze({
  UNAUTHENTICATED:                   ["unauthenticated",    "Authentication required."],
  FEATURE_DISABLED:                  ["unavailable",        "Generation is not enabled."],
  INVALID_REQUEST:                   ["invalid-argument",   "Invalid request."],
  CONSENT_INVALID:                   ["invalid-argument",   "Invalid consent event."],
  CONSENT_ACTOR_MISMATCH:            ["permission-denied",  "Consent actor mismatch."],
  UNKNOWN_GENERATION_VERSION:        ["invalid-argument",   "Unknown generation version."],
  CONSENT_ID_COLLISION:              ["aborted",            "Consent could not be recorded; retry."],
  SESSION_NOT_SUBMITTED:             ["failed-precondition","Assessment not submitted."],
  LEGACY_VERSION_UNRESOLVED:         ["failed-precondition","Saved report version is not resolvable; saved report keeps serving."],
  EXPLICIT_UPGRADE_CONSENT_REQUIRED: ["failed-precondition","Explicit upgrade consent required."],
  ENTITLEMENT_NONE:                  ["permission-denied",  "No verifiable entitlement."],
  ENTITLEMENT_UNVERIFIED:            ["permission-denied",  "Entitlement could not be verified."],
  ENTITLEMENT_REVOKED:               ["permission-denied",  "Entitlement no longer holds; nothing published."],
  GENERATION_IN_PROGRESS:            ["aborted",            "Generation in progress; retry later."],
  GENERATION_SUPERSEDED:             ["aborted",            "Generation superseded; nothing published by this attempt."],
  SESSION_CHANGED:                   ["aborted",            "Responses changed during generation; nothing published."],
  GENERATION_INCOMPLETE:             ["internal",           "Generation failed."],
  GENERATION_FAILED:                 ["internal",           "Generation failed."],
  BUNDLE_RUNNER_UNAVAILABLE:         ["unavailable",        "Generation engine unavailable."],
  PAYLOAD_INVALID:                   ["internal",           "Generation failed."],
  STAGING_MISMATCH:                  ["data-loss",          "Stored generation state is inconsistent; manual review required."],
  LOCK_COMPLETE_WITHOUT_ARTIFACT:    ["data-loss",          "Stored generation state is inconsistent; manual review required."],
  PUBLISHED_PAIR_INCONSISTENT:       ["data-loss",          "Saved instance is inconsistent; manual review required."],
  SAVED_INSTANCE_NOT_FOUND:          ["not-found",          "Saved instance not found."],
});
const INTERNAL = Object.freeze(["internal", "Internal error."]);

// ───────────────────────── input validation (adapter-level, before the module) ─────────────────────────
const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
const isIdSafe = (v) => typeof v === "string" && v.length > 0 && v.length <= 128 && /^[A-Za-z0-9_-]+$/.test(v);
const isSafeUid = (v) => typeof v === "string" && v.length > 0 && v.length <= 128 && !/[.#$\[\]\/\u0000-\u001f\u007f]/.test(v);
const LOCALES = Object.freeze(["ko", "en"]);
const UID_LIKE_KEYS = Object.freeze(["uid", "actorUid", "userId", "user_id", "owner", "ownerUid"]);

class AdapterReject extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

// Field specs: key -> { required, check }. Any key not in the spec => reject (no silent pass-through).
const PLAN_FIELDS = {
  sid: { required: true, check: isIdSafe },
  targetBundle: { required: true, check: (v) => KNOWN_BUNDLES.includes(v) },
  consentEventId: { required: false, check: (v) => v === null || isIdSafe(v) },
  priorInstanceId: { required: false, check: (v) => v === null || isIdSafe(v) },
};
const FIELDS = Object.freeze({
  recordConsent: {
    sid: { required: true, check: isIdSafe },
    targetBundle: { required: true, check: (v) => KNOWN_BUNDLES.includes(v) },
    disclosureVersion: { required: true, check: (v) => KNOWN_DISCLOSURES.includes(v) },
    locale: { required: true, check: (v) => LOCALES.includes(v) },
    coversReportAndProgram: { required: true, check: (v) => v === true },
    priorInstanceId: { required: false, check: (v) => v === null || isIdSafe(v) },
  },
  planGeneration: PLAN_FIELDS,
  generateInstancePair: PLAN_FIELDS,
  readInstancePair: {
    sid: { required: true, check: isIdSafe },
    instanceId: { required: true, check: isIdSafe },
  },
});

function validateBody(fn, data, tokenUid) {
  if (!isPlainObject(data)) throw new AdapterReject("INVALID_REQUEST", "body must be an object");
  // body-uid contract: never read; if present it must equal the token uid, else reject.
  for (const k of UID_LIKE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(data, k)) {
      if (data[k] !== tokenUid) throw new AdapterReject("INVALID_REQUEST", `body.${k} is not accepted`);
    }
  }
  const spec = FIELDS[fn];
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    if (UID_LIKE_KEYS.includes(k)) continue; // ignored (equal to token uid, checked above)
    if (!spec[k]) throw new AdapterReject("INVALID_REQUEST", `unknown field ${k}`);
    if (v === undefined) continue;
    if (!spec[k].check(v)) throw new AdapterReject("INVALID_REQUEST", `invalid field ${k}`);
    out[k] = v;
  }
  for (const [k, s] of Object.entries(spec)) if (s.required && out[k] === undefined) throw new AdapterReject("INVALID_REQUEST", `missing field ${k}`);
  return out;
}

// ───────────────────────── redaction helpers ─────────────────────────
const uidHash = (uid) => crypto.createHash("sha256").update(String(uid)).digest("hex").slice(0, 16);
const newRequestId = () => crypto.randomBytes(8).toString("hex");

function toHttpsError(HttpsError, err, requestId) {
  let code = null;
  if (err instanceof RetentionError || err instanceof AdapterReject) code = err.code;
  const [httpsCode, message] = (code && ERROR_MAP[code]) || INTERNAL;
  // details: ONLY the stable module code (or "INTERNAL") and the request id. Never the message.
  return new HttpsError(httpsCode, message, { code: code && ERROR_MAP[code] ? code : "INTERNAL", requestId });
}

// ───────────────────────── response shaping (what the client may see) ─────────────────────────
// The plan contains inputSnapshot (raw answers), entitlement refs/evidence, idempotencyKey. None of that
// leaves the server. The preview is limited to what the consent UI needs.
function shapePlan(plan) {
  return {
    action: plan.action, sid: plan.sid, targetBundle: plan.targetBundle, entrypoint: plan.entrypoint,
    upgrade: plan.upgrade, originBundle: plan.originBundle, locale: plan.locale,
    consentEventId: plan.consentEventId, priorInstanceId: plan.priorInstanceId,
    entitlementSource: plan.entitlement && plan.entitlement.source ? plan.entitlement.source : null,
    inputSnapshotHash: plan.sessionHash,
  };
}
function shapeGenerate(res) {
  return { instanceId: res.instanceId, reused: !!res.reused, recovered: !!res.recovered, reportOutputHash: res.reportOutputHash, programOutputHash: res.programOutputHash };
}
function shapeRead(res) {
  return { instanceId: res.instanceId, bundleVersion: res.bundleVersion, reportOutputHash: res.reportOutputHash, programOutputHash: res.programOutputHash, report: res.report, program: res.program };
}
function shapeConsent(res) { return { consentEventId: res.consentEventId }; }

// ───────────────────────── factory ─────────────────────────
function createQ90Callables(deps) {
  if (!deps || typeof deps.onCall !== "function") throw new Error("createQ90Callables: deps.onCall (firebase-functions onCall factory) required");
  if (typeof deps.HttpsError !== "function") throw new Error("createQ90Callables: deps.HttpsError class required");
  const { onCall, HttpsError } = deps;
  const logger = deps.logger || { info() {}, warn() {}, error() {} };
  const safeLog = (level, obj) => { try { logger[level](obj); } catch (_) { /* logging never changes an outcome */ } };
  const clock = deps.now || (() => Date.now());

  let retention = deps.retention;
  // Lazily-verified vendored runner (3868952 A): the saved-read surface must exist and work even when bundles/
  // is missing or corrupt. Verification/loading happens on the FIRST generation attempt only, is cached on
  // success, and a failure blocks generation (BUNDLE_RUNNER_UNAVAILABLE) — never reading or construction.
  // readInstancePair never executes an engine, so it never touches the runner.
  let runnerState = null; // { runner } | { error }
  function lazyVendoredRunBundle(runnerOptions) {
    return async function runBundle(req) {
      if (!runnerState) {
        try { const { createVendoredRunner } = require("./runner.js"); runnerState = { runner: createVendoredRunner(runnerOptions) }; }
        catch (e) { runnerState = { error: e }; }
      }
      if (runnerState.error) {
        const err = new RetentionError("BUNDLE_RUNNER_UNAVAILABLE", "vendored engine bundle missing or failed verification");
        err.cause = runnerState.error; // kept server-side only; the adapter never forwards module messages/causes
        throw err;
      }
      return runnerState.runner.runBundle(req);
    };
  }
  if (!retention) {
    // Assembly: the only engine runner allowed at this boundary is the pinned vendored copy.
    const a = deps.assemble;
    if (!a || !a.db) throw new Error("createQ90Callables: deps.retention or deps.assemble.{db,...} required");
    retention = createRetention({
      db: a.db, runBundle: lazyVendoredRunBundle(a.runnerOptions),
      featureEnabled: typeof a.featureEnabled === "function" ? a.featureEnabled : () => false,   // default OFF
      ledgerPolicy: a.ledgerPolicy, verifyProviderCapture: a.verifyProviderCapture, logger: a.moduleLogger, now: a.now,
    });
  }
  for (const m of ["recordConsent", "planGeneration", "generateInstancePair", "readInstancePair"]) {
    if (typeof retention[m] !== "function") throw new Error(`createQ90Callables: retention.${m} missing`);
  }
  const callOptions = deps.callOptions || {};

  function handler(fn, run) {
    return async (request) => {
      const requestId = newRequestId();
      const t0 = clock();
      const auth = request && request.auth;
      const tokenUid = auth && auth.uid;
      const log = { requestId, fn, uidHash: tokenUid ? uidHash(tokenUid) : null, sid: null, code: null, ms: 0 };
      try {
        if (!tokenUid || !isSafeUid(tokenUid)) throw new AdapterReject("UNAUTHENTICATED", "no verified uid");
        const body = validateBody(fn, request.data, tokenUid);
        log.sid = body.sid || null;
        const result = await run(tokenUid, body);
        log.ms = clock() - t0; log.code = "OK";
        safeLog("info", { q90: log });
        return result;
      } catch (err) {
        const httpsErr = toHttpsError(HttpsError, err, requestId);
        log.ms = clock() - t0; log.code = httpsErr.details && httpsErr.details.code || "INTERNAL";
        // never log err.message for module errors (may contain paths/refs); for unexpected errors log
        // only the constructor name so an operator can find it by requestId in the runtime logs.
        if (log.code === "INTERNAL") log.errorType = err && err.constructor && err.constructor.name || typeof err;
        safeLog(log.code === "INTERNAL" ? "error" : "warn", { q90: log });
        throw httpsErr;
      }
    };
  }

  const handlers = {
    recordConsent: handler("recordConsent", async (uid, body) => shapeConsent(await retention.recordConsent(uid, { ...body, actorUid: uid, priorInstanceId: body.priorInstanceId === undefined ? null : body.priorInstanceId }))),
    planGeneration: handler("planGeneration", async (uid, body) => shapePlan(await retention.planGeneration(uid, body))),
    generateInstancePair: handler("generateInstancePair", async (uid, body) => shapeGenerate(await retention.generateInstancePair(uid, body))),
    // saved-read is intentionally NOT gated by featureEnabled (module contract); adapter adds nothing.
    readInstancePair: handler("readInstancePair", async (uid, body) => shapeRead(await retention.readInstancePair(uid, body.sid, body.instanceId))),
  };

  return {
    // callables (what a future `exports.q90RecordConsent = q90.recordConsent` line would export)
    recordConsent: onCall(callOptions, handlers.recordConsent),
    planGeneration: onCall(callOptions, handlers.planGeneration),
    generateInstancePair: onCall(callOptions, handlers.generateInstancePair),
    readInstancePair: onCall(callOptions, handlers.readInstancePair),
    // raw handlers for emulator/unit harnesses that call with a synthetic {auth, data} request
    handlers,
    ERROR_MAP,
  };
}

module.exports = { createQ90Callables, ERROR_MAP, validateBody, toHttpsError, shapePlan, AdapterReject, UID_LIKE_KEYS };
