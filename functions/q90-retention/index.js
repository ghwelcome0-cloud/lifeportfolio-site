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
 *   - entrypoint comes from the server cohort record and is validated, never assumed
 *   - report + program are one instance set: built in staging, published atomically or not at all
 *   - publication is fenced: only the lock holder for the *current attempt* can publish, and a
 *     complete lock is immutable (no later attempt, retry or failure path can alter it)
 *   - same (uid, sid, targetBundle, consentEventId) -> same instanceId (idempotent)
 *   - consent records are create-once (append-only), never overwritten
 */

const crypto = require("crypto");

const PATHS = Object.freeze({
  reportInstances: "reportInstances",
  programInstances: "programInstances",
  generationConsents: "generationConsents",
  generationLocks: "generationLocks",
  generationStaging: "generationStaging",   // accepted by W (rules v3), client read/write false
  q90Entitlements: "q90Entitlements",       // accepted by W (rules v3), client read/write false
  // read-only legacy inputs
  responses: "responses",
  reports: "reports",
  payments: "payments",
  additionalPayments: "additionalPayments",
});

const LEGACY_BUNDLE = "legacy-b03e219";
const KNOWN_BUNDLES = Object.freeze([LEGACY_BUNDLE, "q90-input-and-wording-v2"]);
const KNOWN_ENTRYPOINTS = Object.freeze(["initial-generation", "regeneration"]);
const KNOWN_LOCALES = Object.freeze(["ko", "en"]);
// disclosure texts the consent UI may cite; anything else is rejected (P16)
const KNOWN_DISCLOSURES = Object.freeze(["q90-disclosure-v1"]);
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
const isHex64 = (v) => typeof v === "string" && /^[0-9a-f]{64}$/.test(v);
// Firebase Auth uids are 1..128 chars; RTDB path segments must not contain . # $ [ ] / or control chars
const isSafeUid = (v) => isNonEmptyString(v, 128) && !/[.#$\[\]\/\u0000-\u001f\u007f]/.test(v);
const own = (o, k) => o != null && Object.prototype.hasOwnProperty.call(o, k);

function createRetention(deps) {
  if (!deps || !deps.db) throw new Error("createRetention: deps.db (Admin RTDB handle) is required");
  const db = deps.db;
  const now = deps.now || (() => Date.now());
  const runBundle = deps.runBundle || (() => { throw new RetentionError("BUNDLE_RUNNER_UNAVAILABLE", "engine runner not wired"); });
  const verifyProviderCapture = deps.verifyProviderCapture || (async () => ({ status: "unavailable" }));
  const featureEnabled = typeof deps.featureEnabled === "function" ? deps.featureEnabled : () => false; // default OFF
  const log = deps.logger || { info() {}, warn() {} };
  const safeLog = (level, msg, meta) => { try { log[level](msg, meta); } catch (_) { /* logging must never change outcome */ } };

  const read = async (path) => {
    const snap = await db.ref(path).once("value");
    return snap.exists() ? snap.val() : null;
  };

  // ───────────────────────── P16 consent (create-once) ─────────────────────────
  async function recordConsent(uid, event) {
    assertUid(uid);
    if (!featureEnabled(uid)) throw new RetentionError("FEATURE_DISABLED", "q90 generation is OFF");
    if (!event || typeof event !== "object") throw new RetentionError("CONSENT_INVALID", "consent event object required");
    if (event.actorUid !== uid) throw new RetentionError("CONSENT_ACTOR_MISMATCH", "actorUid must equal the verified token uid");
    // boolean-only consent is not consent (P16) — checked first so a bare {consent:true} is never reinterpreted
    if (event.consent !== undefined && !isNonEmptyString(event.disclosureVersion, 40)) throw new RetentionError("CONSENT_INVALID", "boolean consent without disclosure is rejected");
    if (!KNOWN_BUNDLES.includes(event.targetBundle)) throw new RetentionError("UNKNOWN_GENERATION_VERSION", "targetBundle not supported");
    if (!KNOWN_DISCLOSURES.includes(event.disclosureVersion)) throw new RetentionError("CONSENT_INVALID", "disclosureVersion not recognised");
    if (!KNOWN_LOCALES.includes(event.locale)) throw new RetentionError("CONSENT_INVALID", "locale must be ko|en");
    if (!idSafe(event.sid)) throw new RetentionError("CONSENT_INVALID", "sid required");
    if (event.priorInstanceId != null && !idSafe(event.priorInstanceId)) throw new RetentionError("CONSENT_INVALID", "priorInstanceId malformed");
    if (event.coversReportAndProgram !== true) throw new RetentionError("CONSENT_INVALID", "consent must cover report and program together (P13/P16)");

    const ts = now();
    const nonce = crypto.randomBytes(8).toString("hex");
    // id is content-addressed over everything the consent means, plus a nonce so two consents in the
    // same millisecond (e.g. ko then en) can never collide or overwrite each other
    const consentEventId = sha256(`${uid}|${event.sid}|${event.targetBundle}|${event.disclosureVersion}|${event.locale}|${event.priorInstanceId || ""}|${ts}|${nonce}`).slice(0, 32);
    const record = {
      actorUid: uid, sid: event.sid, targetBundle: event.targetBundle, priorInstanceId: event.priorInstanceId || null,
      disclosureVersion: event.disclosureVersion, locale: event.locale, coversReportAndProgram: true,
      serverTimestamp: ts,
    };
    // create-once: transaction aborts if anything already exists at this id
    const tx = await db.ref(`${PATHS.generationConsents}/${uid}/${consentEventId}`).transaction((cur) => (cur === null || cur === undefined) ? record : undefined);
    if (!tx.committed) throw new RetentionError("CONSENT_ID_COLLISION", "consent id already exists; retry");
    return { consentEventId, record };
  }

  // ───────────────────────── P15 entitlement (fail closed) ─────────────────────────
  // Real additionalPayments schema (functions/index.js): { paid:true, status:"unused"|"consumed", consumedBySid,
  // orderID, captureID, provider:"paypal"|"payple", source, ... }. There is NO "captured" status.
  // Provider-verified writers: captureAdditionalPaypalOrder (captureID non-empty, provider paypal),
  // confirmAdditionalPayplePayment (source payple-cpay, oid+payerId). issuePaypleAdditionalToken
  // (source payple-link) trusts client-writable payments/paid + intentTs -> NOT provider evidence.
  function additionalEntryIsProviderVerified(v) {
    if (!v || v.paid !== true) return false;
    if (v.provider === "paypal" && isNonEmptyString(v.captureID, 200) && isNonEmptyString(v.orderID, 200)) return true;
    if (v.provider === "payple" && v.source === "payple-cpay" && isNonEmptyString(v.oid, 200) && isNonEmptyString(v.payerId, 200)) return true;
    return false; // payple-link and anything unknown: closed
  }
  async function resolveEntitlement(uid, sid) {
    assertUid(uid);
    // 1) server-only allowlist written by an approved migration (no writer exists yet)
    const allow = await read(`${PATHS.q90Entitlements}/${uid}`);
    if (allow && allow.status === "verified" && isNonEmptyString(allow.source, 80)) {
      return { ok: true, source: "q90Entitlements", ref: `${PATHS.q90Entitlements}/${uid}`, evidence: allow.source };
    }
    // 2) additionalPayments: server-only ledger, but only provider-verified entries count, and the
    //    entry must be bound to THIS sid (consumed by it) — an unused token is a purchase for a future
    //    assessment, not evidence for regenerating this one; a token consumed by another sid is not ours.
    const add = await read(`${PATHS.additionalPayments}/${uid}`);
    if (add && typeof add === "object") {
      for (const key of Object.keys(add)) {
        const v = add[key];
        if (!additionalEntryIsProviderVerified(v)) continue;
        if (v.status === "consumed" && sid && v.consumedBySid === sid) {
          return { ok: true, source: "additionalPayments", ref: `${PATHS.additionalPayments}/${uid}/${key}`, evidence: `${v.provider}:${v.captureID || v.oid}` };
        }
      }
    }
    // 3) payments/{uid}: client-writable first write -> only after server-side provider re-verification
    const pay = await read(`${PATHS.payments}/${uid}`);
    if (pay && pay.paid === true) {
      const verdict = await verifyProviderCapture({ uid, provider: pay.provider || pay.source || null, orderID: pay.orderID || null, captureID: pay.captureID || null });
      if (verdict && verdict.status === "verified" && isNonEmptyString(verdict.reference, 200)) {
        return { ok: true, source: "payments+providerVerified", ref: `${PATHS.payments}/${uid}`, evidence: verdict.reference };
      }
      return { ok: false, code: "ENTITLEMENT_UNVERIFIED", reason: "payments/paid present but not server-verifiable (client-writable first write); provider verifier " + (verdict && verdict.status || "unavailable") };
    }
    return { ok: false, code: "ENTITLEMENT_NONE", reason: "no server-verifiable entitlement evidence for this uid/sid" };
  }

  // ───────────────────────── P02/P03/P05/P07 plan ─────────────────────────
  async function planGeneration(uid, req) {
    assertUid(uid);
    if (!req || !idSafe(req.sid)) throw new RetentionError("INVALID_REQUEST", "sid required");
    if (!KNOWN_BUNDLES.includes(req.targetBundle)) throw new RetentionError("UNKNOWN_GENERATION_VERSION", "targetBundle not supported");
    if (req.priorInstanceId != null && !idSafe(req.priorInstanceId)) throw new RetentionError("INVALID_REQUEST", "priorInstanceId malformed");
    if (!featureEnabled(uid)) throw new RetentionError("FEATURE_DISABLED", "q90 generation is OFF");

    const session = await read(`${PATHS.responses}/${uid}/${req.sid}`);
    if (!session || session.status !== "submitted") throw new RetentionError("SESSION_NOT_SUBMITTED", "responses node missing or not submitted");
    // freeze what we plan against; generate() re-checks this hash after the engine ran (TOCTOU)
    const sessionHash = sha256(session);

    // Origin cohort + entrypoint from the server record only. Never guessed from the engine SHA (P03/P18).
    const legacy = await read(`${PATHS.reports}/${uid}/${req.sid}`);
    let originBundle = null, originEntrypoint = null;
    if (legacy) {
      const cohort = await read(`${PATHS.q90Entitlements}/${uid}/cohorts/${req.sid}`);
      if (cohort && KNOWN_BUNDLES.includes(cohort.bundle) && KNOWN_ENTRYPOINTS.includes(cohort.entrypoint)) {
        originBundle = cohort.bundle; originEntrypoint = cohort.entrypoint;
      } else {
        throw new RetentionError("LEGACY_VERSION_UNRESOLVED", "saved report exists but its cohort/entrypoint is not server-recorded; generation held, saved report keeps serving");
      }
    }
    // Entrypoint for the NEW instance: same-bundle re-generation reproduces the origin entrypoint (so the
    // result is comparable to the saved one); an upgrade or first generation uses "regeneration"
    // (the only entrypoint whose full dependency set — career engine + rules — the bundle carries).
    const upgrade = originBundle !== null && originBundle !== req.targetBundle;
    const entrypoint = (!upgrade && originEntrypoint) ? originEntrypoint : "regeneration";

    let consent = null;
    if (upgrade) {
      if (!idSafe(req.consentEventId)) throw new RetentionError("EXPLICIT_UPGRADE_CONSENT_REQUIRED", "upgrade needs a recorded consent event");
      consent = await read(`${PATHS.generationConsents}/${uid}/${req.consentEventId}`);
      if (!consent || consent.actorUid !== uid || consent.sid !== req.sid || consent.targetBundle !== req.targetBundle || consent.coversReportAndProgram !== true) {
        throw new RetentionError("EXPLICIT_UPGRADE_CONSENT_REQUIRED", "consent event missing or does not match (uid,sid,targetBundle)");
      }
      // priorInstanceId is taken from the consent record, and the request may not contradict it
      if (req.priorInstanceId != null && req.priorInstanceId !== (consent.priorInstanceId || null)) {
        throw new RetentionError("EXPLICIT_UPGRADE_CONSENT_REQUIRED", "priorInstanceId does not match the consent record");
      }
    } else if (req.consentEventId != null) {
      throw new RetentionError("INVALID_REQUEST", "consentEventId supplied but no upgrade is being made");
    }
    const ent = await resolveEntitlement(uid, req.sid);
    if (!ent.ok) throw new RetentionError(ent.code, ent.reason);

    const idempotencyKey = sha256(`${uid}|${req.sid}|${req.targetBundle}|${req.consentEventId || "-"}`).slice(0, 40);
    return {
      action: "generate_new_instance_pair",
      uid, sid: req.sid, targetBundle: req.targetBundle, originBundle, originEntrypoint, entrypoint, upgrade,
      consentEventId: upgrade ? req.consentEventId : null, priorInstanceId: consent ? (consent.priorInstanceId || null) : null,
      locale: consent ? consent.locale : (session.lang === "en" ? "en" : "ko"),
      entitlement: ent, idempotencyKey, sessionHash,
      mayOverwriteExisting: false, mayChangeLegacyCode: false, mayChangePaymentEntitlements: false,
    };
  }

  // ───────────────────────── P08/P13/P17 generate (fenced, atomic pair) ─────────────────────────
  //
  // Lock states: {state:"pending", attempt:n, startedAt} -> {state:"complete", attempt:n, instanceId} (immutable)
  //                                                        -> {state:"failed",   attempt:n, errorCode}
  // Fencing: every write that ends an attempt is a TRANSACTION on the lock that requires
  //   cur.state === "pending" && cur.attempt === myAttempt.
  // If that transaction aborts, this attempt lost the fence (another attempt took over after TTL, or
  // already completed). A loser NEVER writes to the public nodes and never touches the lock.
  // The publish itself is that transaction's *side effect*: the multi-location update containing
  // the two public docs is issued ONLY after the fence transaction has committed the lock to
  // complete with this attempt's instanceId. A crash between fence and publish leaves a "complete"
  // lock whose artifact is still in staging/{lockKey}/{attempt}; the recovery path (step 0)
  // re-publishes from staging idempotently on the next call.
  async function generateInstancePair(uid, req) {
    const plan = await planGeneration(uid, req);
    const lockPath = `${PATHS.generationLocks}/${plan.idempotencyKey}`;
    const lockRef = db.ref(lockPath);
    const t0 = now();

    // 0) recovery: a complete lock whose docs are not published yet (crash between fence and publish)
    const existing = await read(lockPath);
    if (existing && existing.state === "complete") {
      const published = await read(`${PATHS.reportInstances}/${uid}/${plan.sid}/${existing.instanceId}`);
      if (published) return { reused: true, instanceId: existing.instanceId, lockKey: plan.idempotencyKey };
      const staged = await read(`${PATHS.generationStaging}/${plan.idempotencyKey}/${existing.attempt}`);
      if (staged && staged.instanceId === existing.instanceId) {
        await publishFromStaging(uid, plan, existing, staged);
        return { reused: true, recovered: true, instanceId: existing.instanceId, lockKey: plan.idempotencyKey };
      }
      throw new RetentionError("LOCK_COMPLETE_WITHOUT_ARTIFACT", "lock is complete but neither published nor staged artifact exists; manual review required");
    }

    // 1) acquire: pending -> mine (attempt+1), or take over a stale pending
    const acq = await lockRef.transaction((cur) => {
      if (cur && cur.state === "complete") return; // abort (handled above / by race)
      if (cur && cur.state === "pending" && t0 - (cur.startedAt || 0) < LOCK_TTL_MS) return; // abort: in flight
      return { state: "pending", uid, sid: plan.sid, targetBundle: plan.targetBundle, consentEventId: plan.consentEventId, startedAt: t0, attempt: ((cur && cur.attempt) || 0) + 1 };
    });
    if (!acq.committed) {
      const cur = acq.snapshot.exists() ? acq.snapshot.val() : null;
      if (cur && cur.state === "complete") return { reused: true, instanceId: cur.instanceId, lockKey: plan.idempotencyKey };
      throw new RetentionError("GENERATION_IN_PROGRESS", "another generation for this key is pending");
    }
    const mine = acq.snapshot.val();
    const myAttempt = mine.attempt;
    const instanceId = sha256(`${plan.idempotencyKey}|${myAttempt}`).slice(0, 32);
    // staging is keyed by attempt: a superseded attempt writing late can never clobber the winner's artifact
    const stagingPath = `${PATHS.generationStaging}/${plan.idempotencyKey}/${myAttempt}`;

    // 2) build (no public writes). Any throw -> fenced fail.
    let staged;
    try {
      const session = await read(`${PATHS.responses}/${uid}/${plan.sid}`);
      if (!session || sha256(session) !== plan.sessionHash) throw new RetentionError("SESSION_CHANGED", "responses changed between plan and generation");
      const out = await runBundle({ bundle: plan.targetBundle, entrypoint: plan.entrypoint, answers: session.answers || {}, profile: { name: session.name || "", submittedAt: session.submittedAt || null }, locale: plan.locale });
      if (!out || !out.report || !out.program) throw new RetentionError("GENERATION_INCOMPLETE", "engine runner returned an incomplete pair");
      if (!isHex64(out.bundleHash) || !isHex64(out.entrypointHash)) throw new RetentionError("GENERATION_INCOMPLETE", "engine runner did not return 64-hex bundle/entrypoint hashes");
      if (out.bundleVersion !== plan.targetBundle || out.entrypoint !== plan.entrypoint) throw new RetentionError("GENERATION_INCOMPLETE", "engine runner echoed a different bundle/entrypoint than requested");
      const reportOutputHash = sha256(out.report);
      const programOutputHash = sha256(out.program);
      const common = { instanceId, attempt: myAttempt, uid, sid: plan.sid, bundleVersion: plan.targetBundle, bundleHash: out.bundleHash, entrypoint: plan.entrypoint, entrypointHash: out.entrypointHash, locale: plan.locale, priorInstanceId: plan.priorInstanceId, consentEventId: plan.consentEventId, entitlementSource: plan.entitlement.source, entitlementRef: plan.entitlement.ref, sessionHash: plan.sessionHash, createdAt: t0, state: "published" };
      staged = {
        instanceId, attempt: myAttempt, stagedAt: now(),
        report: { ...common, kind: "report", outputHash: reportOutputHash, report: out.report },
        program: { ...common, kind: "program", outputHash: programOutputHash, sourceReportInstanceId: instanceId, reportBundleVersion: plan.targetBundle, reportOutputHash, program: out.program },
      };
      await db.ref(stagingPath).set(staged);
    } catch (e) {
      await fencedFail(lockRef, myAttempt, e, stagingPath);
      throw e instanceof RetentionError ? e : new RetentionError("GENERATION_FAILED", String(e && e.message || e));
    }

    // 3) fence: pending(myAttempt) -> complete(myAttempt, instanceId). Loser: nothing published, nothing touched.
    const completeLock = { ...mine, state: "complete", instanceId, completedAt: now() };
    const fence = await lockRef.transaction((cur) => (cur && cur.state === "pending" && cur.attempt === myAttempt) ? completeLock : undefined);
    if (!fence.committed) {
      const cur = fence.snapshot.exists() ? fence.snapshot.val() : null;
      try { await db.ref(stagingPath).set(null); } catch (_) { /* own attempt's staging only */ }
      safeLog("warn", "[q90] lost fence after build; not publishing", { uid, sid: plan.sid, myAttempt, lockState: cur && cur.state, lockAttempt: cur && cur.attempt });
      if (cur && cur.state === "complete") return { reused: true, instanceId: cur.instanceId, lockKey: plan.idempotencyKey };
      throw new RetentionError("GENERATION_SUPERSEDED", "another attempt took over this generation; nothing was published by this attempt");
    }

    // 4) publish: one multi-location update (report + program + staging=null). Lock already complete.
    //    A failure here leaves lock=complete + staging present -> recovered by step 0 on the next call.
    await publishFromStaging(uid, plan, completeLock, staged);
    return { reused: false, instanceId, lockKey: plan.idempotencyKey, reportOutputHash: staged.report.outputHash, programOutputHash: staged.program.outputHash };
  }

  async function publishFromStaging(uid, plan, lock, staged) {
    if (!staged || staged.instanceId !== lock.instanceId) throw new RetentionError("STAGING_MISMATCH", "staged artifact does not belong to the completed lock");
    const publish = {};
    publish[`${PATHS.reportInstances}/${uid}/${plan.sid}/${lock.instanceId}`] = staged.report;
    publish[`${PATHS.programInstances}/${uid}/${plan.sid}/${lock.instanceId}`] = staged.program;
    publish[`${PATHS.generationStaging}/${plan.idempotencyKey}`] = null; // all attempts; winner is final
    await db.ref().update(publish);
    // after this point the outcome is final; logging cannot change it
    safeLog("info", "[q90] published instance pair", { uid, sid: plan.sid, instanceId: lock.instanceId, bundle: plan.targetBundle, entrypoint: plan.entrypoint });
  }

  async function fencedFail(lockRef, myAttempt, err, stagingPath) {
    const code = (err && err.code) || "INTERNAL";
    const tx = await lockRef.transaction((cur) => (cur && cur.state === "pending" && cur.attempt === myAttempt) ? { ...cur, state: "failed", failedAt: now(), errorCode: code } : undefined);
    // own attempt's staging is ours to clear whether or not we still hold the fence
    try { await db.ref(stagingPath).set(null); } catch (_) { /* best effort; staging is server-only */ }
    if (tx.committed) safeLog("warn", "[q90] generation failed, nothing published", { code, attempt: myAttempt });
    else safeLog("warn", "[q90] generation failed after losing fence; lock untouched", { code, attempt: myAttempt });
  }

  function assertUid(uid) {
    if (!isSafeUid(uid)) throw new RetentionError("UNAUTHENTICATED", "verified uid required");
  }

  return { recordConsent, resolveEntitlement, planGeneration, generateInstancePair, PATHS, KNOWN_BUNDLES, KNOWN_ENTRYPOINTS, KNOWN_DISCLOSURES, LEGACY_BUNDLE };
}

module.exports = { createRetention, RetentionError, PATHS, KNOWN_BUNDLES, KNOWN_ENTRYPOINTS, KNOWN_DISCLOSURES, LEGACY_BUNDLE, LOCK_TTL_MS };
