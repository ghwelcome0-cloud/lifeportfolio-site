"use strict";
/**
 * q90-retention — server-side generation boundary for new report/program instances.
 *
 * NOT exported from functions/index.js. NOT deployed. Default OFF.
 * Zero new dependencies: the caller injects the Admin SDK database handle and the
 * engine runner; tests inject an in-memory fake.
 *
 * Contract: Q90-LEGACY-PRESERVE-RC02 (P01-P19). See README.md in this directory.
 *
 * Hard invariants (enforced here, tested in test/):
 *   - never writes reports/, programs/, users/, payments/ (legacy nodes untouched)
 *   - uid always comes from the verified auth token, never from the request body
 *   - entitlement is fail-closed; payments/{uid}/paid alone is never sufficient
 *   - unknown / unverified legacy cohort -> refuse to generate (saved report keeps serving)
 *   - report + program are one instance set: built in staging, published atomically or not at all
 *   - same (uid, sid, targetBundle, consentEventId) -> same instanceId (idempotent)
 */

const crypto = require("crypto");

const PATHS = Object.freeze({
  reportInstances: "reportInstances",
  programInstances: "programInstances",
  generationConsents: "generationConsents",
  generationLocks: "generationLocks",
  generationStaging: "generationStaging",   // proposed to W, client read/write false
  q90Entitlements: "q90Entitlements",       // proposed to W, server-only allowlist
  // read-only legacy inputs
  responses: "responses",
  reports: "reports",
  payments: "payments",
  additionalPayments: "additionalPayments",
});

const LEGACY_BUNDLE = "legacy-b03e219";
const KNOWN_BUNDLES = Object.freeze([LEGACY_BUNDLE, "q90-input-and-wording-v2"]);
const LOCK_TTL_MS = 10 * 60 * 1000;

class RetentionError extends Error {
  constructor(code, message, details) {
    super(message || code);
    this.code = code;          // stable machine code; caller maps to HttpsError
    this.details = details || null;
  }
}

const sha256 = (s) => crypto.createHash("sha256").update(typeof s === "string" ? s : JSON.stringify(s)).digest("hex");
const isNonEmptyString = (v, max = 200) => typeof v === "string" && v.length > 0 && v.length <= max;
const idSafe = (v) => isNonEmptyString(v, 128) && /^[A-Za-z0-9_-]+$/.test(v);

function createRetention(deps) {
  if (!deps || !deps.db) throw new Error("createRetention: deps.db (Admin RTDB handle) is required");
  const db = deps.db;
  const now = deps.now || (() => Date.now());
  const runBundle = deps.runBundle || (() => { throw new RetentionError("BUNDLE_RUNNER_UNAVAILABLE", "engine runner not wired"); });
  const verifyProviderCapture = deps.verifyProviderCapture || (async () => ({ status: "unavailable" }));
  const featureEnabled = typeof deps.featureEnabled === "function" ? deps.featureEnabled : () => false; // default OFF
  const log = deps.logger || { info() {}, warn() {} };

  const read = async (path) => {
    const snap = await db.ref(path).once("value");
    return snap.exists() ? snap.val() : null;
  };

  // ───────────────────────── P16 consent ─────────────────────────
  async function recordConsent(uid, event) {
    assertUid(uid);
    if (!event || typeof event !== "object") throw new RetentionError("CONSENT_INVALID", "consent event object required");
    if (event.actorUid !== uid) throw new RetentionError("CONSENT_ACTOR_MISMATCH", "actorUid must equal the verified token uid");
    // boolean-only consent is not consent (P16) — checked before anything else so a bare
    // {consent:true} can never be reinterpreted as a versioned request
    if (event.consent !== undefined && !isNonEmptyString(event.disclosureVersion, 40)) throw new RetentionError("CONSENT_INVALID", "boolean consent without disclosure is rejected");
    if (!KNOWN_BUNDLES.includes(event.targetBundle)) throw new RetentionError("UNKNOWN_GENERATION_VERSION", "targetBundle not supported");
    if (!isNonEmptyString(event.disclosureVersion, 40)) throw new RetentionError("CONSENT_INVALID", "disclosureVersion required");
    if (event.locale !== "ko" && event.locale !== "en") throw new RetentionError("CONSENT_INVALID", "locale must be ko|en");
    if (!idSafe(event.sid)) throw new RetentionError("CONSENT_INVALID", "sid required");
    if (event.priorInstanceId != null && !idSafe(event.priorInstanceId)) throw new RetentionError("CONSENT_INVALID", "priorInstanceId malformed");
    if (event.coversReportAndProgram !== true) throw new RetentionError("CONSENT_INVALID", "consent must cover report and program together (P13/P16)");

    const consentEventId = sha256(`${uid}|${event.sid}|${event.targetBundle}|${event.disclosureVersion}|${event.priorInstanceId || ""}|${now()}`).slice(0, 32);
    const record = {
      actorUid: uid, sid: event.sid, targetBundle: event.targetBundle, priorInstanceId: event.priorInstanceId || null,
      disclosureVersion: event.disclosureVersion, locale: event.locale, coversReportAndProgram: true,
      serverTimestamp: now(),
    };
    await db.ref(`${PATHS.generationConsents}/${uid}/${consentEventId}`).set(record);
    return { consentEventId, record };
  }

  // ───────────────────────── P15 entitlement (fail closed) ─────────────────────────
  async function resolveEntitlement(uid) {
    assertUid(uid);
    // 1) server-only allowlist written by an approved migration (proposed path)
    const allow = await read(`${PATHS.q90Entitlements}/${uid}`);
    if (allow && allow.status === "verified" && isNonEmptyString(allow.source, 80)) {
      return { ok: true, source: "q90Entitlements", ref: `${PATHS.q90Entitlements}/${uid}`, evidence: allow.source };
    }
    // 2) additionalPayments is .write:false for clients -> server-only ledger
    const add = await read(`${PATHS.additionalPayments}/${uid}`);
    if (add && typeof add === "object") {
      const captured = Object.entries(add).find(([, v]) => v && v.status === "captured" && isNonEmptyString(v.captureID || v.orderID || v.token, 200));
      if (captured) return { ok: true, source: "additionalPayments", ref: `${PATHS.additionalPayments}/${uid}/${captured[0]}` };
    }
    // 3) payments/{uid}: client-writable first write -> only accepted after server-side provider re-verification
    const pay = await read(`${PATHS.payments}/${uid}`);
    if (pay && pay.paid === true) {
      const verdict = await verifyProviderCapture({ uid, provider: pay.provider || pay.source || null, orderID: pay.orderID || null, captureID: pay.captureID || null });
      if (verdict && verdict.status === "verified") {
        return { ok: true, source: "payments+providerVerified", ref: `${PATHS.payments}/${uid}`, evidence: verdict.reference || null };
      }
      return { ok: false, code: "ENTITLEMENT_UNVERIFIED", reason: "payments/paid present but not server-verifiable (client-writable first write); provider verifier " + (verdict && verdict.status || "unavailable") };
    }
    return { ok: false, code: "ENTITLEMENT_NONE", reason: "no server-verifiable entitlement evidence" };
  }

  // ───────────────────────── P02/P03/P05/P07 plan ─────────────────────────
  async function planGeneration(uid, req) {
    assertUid(uid);
    if (!req || !idSafe(req.sid)) throw new RetentionError("INVALID_REQUEST", "sid required");
    if (!KNOWN_BUNDLES.includes(req.targetBundle)) throw new RetentionError("UNKNOWN_GENERATION_VERSION", "targetBundle not supported");
    if (!featureEnabled(uid)) throw new RetentionError("FEATURE_DISABLED", "q90 generation is OFF");

    const session = await read(`${PATHS.responses}/${uid}/${req.sid}`);
    if (!session || session.status !== "submitted") throw new RetentionError("SESSION_NOT_SUBMITTED", "responses node missing or not submitted");

    // Origin cohort: what produced the currently saved legacy result. Never guessed from the engine SHA (P03/P18).
    const legacy = await read(`${PATHS.reports}/${uid}/${req.sid}`);
    let originBundle = null;
    if (legacy) {
      const cohort = await read(`${PATHS.q90Entitlements}/${uid}/cohorts/${req.sid}`); // server-written cohort record (proposed)
      if (cohort && KNOWN_BUNDLES.includes(cohort.bundle) && isNonEmptyString(cohort.entrypoint, 40)) originBundle = cohort.bundle;
      else throw new RetentionError("LEGACY_VERSION_UNRESOLVED", "saved report exists but its cohort is not server-recorded; generation held, saved report keeps serving");
    }
    const upgrade = originBundle !== null && originBundle !== req.targetBundle;
    if (upgrade) {
      if (!idSafe(req.consentEventId)) throw new RetentionError("EXPLICIT_UPGRADE_CONSENT_REQUIRED", "upgrade needs a recorded consent event");
      const consent = await read(`${PATHS.generationConsents}/${uid}/${req.consentEventId}`);
      if (!consent || consent.actorUid !== uid || consent.sid !== req.sid || consent.targetBundle !== req.targetBundle || consent.coversReportAndProgram !== true) {
        throw new RetentionError("EXPLICIT_UPGRADE_CONSENT_REQUIRED", "consent event missing or does not match (uid,sid,targetBundle)");
      }
    }
    const ent = await resolveEntitlement(uid);
    if (!ent.ok) throw new RetentionError(ent.code, ent.reason);

    const idempotencyKey = sha256(`${uid}|${req.sid}|${req.targetBundle}|${req.consentEventId || "-"}`).slice(0, 40);
    return {
      action: "generate_new_instance_pair",
      uid, sid: req.sid, targetBundle: req.targetBundle, originBundle, upgrade,
      consentEventId: req.consentEventId || null, entitlement: ent, idempotencyKey,
      mayOverwriteExisting: false, mayChangeLegacyCode: false, mayChangePaymentEntitlements: false,
    };
  }

  // ───────────────────────── P08/P13/P17 generate (atomic pair) ─────────────────────────
  async function generateInstancePair(uid, req) {
    const plan = await planGeneration(uid, req);
    const lockRef = db.ref(`${PATHS.generationLocks}/${plan.idempotencyKey}`);
    const t = now();

    // acquire or reuse
    const tx = await lockRef.transaction((cur) => {
      if (cur && cur.state === "complete") return; // abort: reuse
      if (cur && cur.state === "pending" && t - (cur.startedAt || 0) < LOCK_TTL_MS) return; // abort: in flight
      return { state: "pending", uid, sid: plan.sid, targetBundle: plan.targetBundle, consentEventId: plan.consentEventId, startedAt: t, attempt: ((cur && cur.attempt) || 0) + 1 };
    });
    const cur = tx.snapshot.exists() ? tx.snapshot.val() : null;
    if (!tx.committed) {
      if (cur && cur.state === "complete") return { reused: true, instanceId: cur.instanceId, lockKey: plan.idempotencyKey };
      throw new RetentionError("GENERATION_IN_PROGRESS", "another generation for this key is pending");
    }

    const instanceId = sha256(`${plan.idempotencyKey}|${cur.attempt}`).slice(0, 32);
    const staging = `${PATHS.generationStaging}/${plan.idempotencyKey}`;
    try {
      const session = await read(`${PATHS.responses}/${uid}/${plan.sid}`);
      const locale = (session && session.lang === "en") ? "en" : "ko";
      const out = await runBundle({ bundle: plan.targetBundle, entrypoint: "regeneration", answers: session.answers || {}, profile: { name: session.name || "", submittedAt: session.submittedAt || null }, locale });
      if (!out || !out.report || !out.program || !isNonEmptyString(out.bundleHash, 64) || !isNonEmptyString(out.entrypointHash, 64)) {
        throw new RetentionError("GENERATION_INCOMPLETE", "engine runner returned an incomplete pair");
      }
      const reportOutputHash = sha256(out.report);
      const programOutputHash = sha256(out.program);
      const common = { instanceId, uid, sid: plan.sid, bundleVersion: plan.targetBundle, bundleHash: out.bundleHash, entrypoint: "regeneration", entrypointHash: out.entrypointHash, locale, priorInstanceId: plan.consentEventId ? (req.priorInstanceId || null) : null, consentEventId: plan.consentEventId, entitlementSource: plan.entitlement.source, entitlementRef: plan.entitlement.ref, createdAt: t, state: "published" };
      const reportDoc = { ...common, kind: "report", outputHash: reportOutputHash, report: out.report };
      const programDoc = { ...common, kind: "program", outputHash: programOutputHash, sourceReportInstanceId: instanceId, reportBundleVersion: plan.targetBundle, reportOutputHash, program: out.program };

      // stage (client-invisible), then publish both + flip lock in ONE multi-location update
      await db.ref(staging).set({ report: reportDoc, program: programDoc, state: "staged", stagedAt: now() });
      const publish = {};
      publish[`${PATHS.reportInstances}/${uid}/${plan.sid}/${instanceId}`] = reportDoc;
      publish[`${PATHS.programInstances}/${uid}/${plan.sid}/${instanceId}`] = programDoc;
      publish[`${PATHS.generationLocks}/${plan.idempotencyKey}`] = { ...cur, state: "complete", instanceId, completedAt: now() };
      publish[staging] = null;
      await db.ref().update(publish);
      log.info("[q90] published instance pair", { uid, sid: plan.sid, instanceId, bundle: plan.targetBundle });
      return { reused: false, instanceId, lockKey: plan.idempotencyKey, reportOutputHash, programOutputHash };
    } catch (e) {
      // nothing under public nodes was written; mark failed, clear staging
      const fail = {};
      fail[`${PATHS.generationLocks}/${plan.idempotencyKey}`] = { ...cur, state: "failed", failedAt: now(), errorCode: (e && e.code) || "INTERNAL" };
      fail[staging] = null;
      await db.ref().update(fail);
      log.warn("[q90] generation failed, nothing published", { uid, sid: plan.sid, code: e && e.code });
      throw e instanceof RetentionError ? e : new RetentionError("GENERATION_FAILED", String(e && e.message || e));
    }
  }

  function assertUid(uid) {
    if (!isNonEmptyString(uid, 128)) throw new RetentionError("UNAUTHENTICATED", "verified uid required");
  }

  return { recordConsent, resolveEntitlement, planGeneration, generateInstancePair, PATHS, KNOWN_BUNDLES, LEGACY_BUNDLE };
}

module.exports = { createRetention, RetentionError, PATHS, KNOWN_BUNDLES, LEGACY_BUNDLE, LOCK_TTL_MS };
