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

// New Q90 instances only. The authoritative JSON string preserves nulls and empty
// containers that RTDB's object storage would erase. Legacy records are untouched.
const PAYLOAD_FORMAT = "q90-cjson-v1";
function canonicalJson(value) {
  function ordered(v) {
    if (v === null || typeof v === "string" || typeof v === "boolean") return v;
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (Array.isArray(v)) return v.map(ordered);
    if (!v || typeof v !== "object") throw new RetentionError("PAYLOAD_INVALID", "JSON values required");
    const out = Object.create(null);
    for (const key of Object.keys(v).sort()) out[key] = ordered(v[key]);
    return out;
  }
  return JSON.stringify(ordered(value));
}
// Compare the compatibility object as RTDB stores it: missing/null/empty nodes
// disappear, and arrays may be returned as index-keyed objects. This projection
// is NOT the authoritative payload and never replaces payloadJson.
function databaseProjection(v) {
  if (v == null) return null;
  if (typeof v !== "object") return v;
  const out = Object.create(null);
  for (const key of Object.keys(v).sort()) {
    const child = databaseProjection(v[key]);
    if (child !== null) out[key] = child;
  }
  return Object.keys(out).length ? out : null;
}
function encodePayload(value) {
  const payloadJson = canonicalJson(value);
  return { payloadFormat: PAYLOAD_FORMAT, payloadJson, outputHash: sha256(payloadJson) };
}
function decodePayload(doc, kind) {
  try {
    if (doc.payloadFormat !== PAYLOAD_FORMAT || typeof doc.payloadJson !== "string" || !isHex64(doc.outputHash)) throw Error("format");
    const payload = JSON.parse(doc.payloadJson);
    if (canonicalJson(payload) !== doc.payloadJson || sha256(doc.payloadJson) !== doc.outputHash) throw Error("hash");
    if (canonicalJson(databaseProjection(doc[kind])) !== canonicalJson(databaseProjection(payload))) throw Error("view");
    return payload;
  } catch (_) {
    throw new RetentionError("PUBLISHED_PAIR_INCONSISTENT", "payload JSON, hash or compatibility view mismatch");
  }
}

function createRetention(deps) {
  if (!deps || !deps.db) throw new Error("createRetention: deps.db (Admin RTDB handle) is required");
  const db = deps.db;
  const now = deps.now || (() => Date.now());
  const runBundle = deps.runBundle || (() => { throw new RetentionError("BUNDLE_RUNNER_UNAVAILABLE", "engine runner not wired"); });
  const verifyProviderCapture = deps.verifyProviderCapture || (async () => ({ status: "unavailable" }));
  const featureEnabled = typeof deps.featureEnabled === "function" ? deps.featureEnabled : () => false; // default OFF
  // C3: what a production ledger entry must look like. Injected by the deploying environment; the default
  // accepts NOTHING so a missing policy can never widen access. Field presence is never "verification".
  const ledgerPolicy = Object.freeze({
    acceptedEnvs: [], acceptedCurrencies: [], minAmount: null, acceptedPaypalMerchantIds: [], acceptedPaypleCstIds: [],
    ...(deps.ledgerPolicy || {}),
  });
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
  // Returns a reason string when the entry is NOT acceptable, null when it passes every check.
  // "Acceptable" means: written by a provider-confirming server writer AND matching the deployed
  // production ledger policy (env, currency, amount floor, merchant). It is not a provider re-check.
  function additionalEntryRejection(v) {
    if (!v || v.paid !== true) return "not_paid";
    if (!ledgerPolicy.acceptedEnvs.includes(v.env)) return "env_not_accepted";          // sandbox/test/missing -> closed
    if (!ledgerPolicy.acceptedCurrencies.includes(v.currency)) return "currency_not_accepted";
    const amt = Number(v.amount);
    if (!Number.isFinite(amt) || ledgerPolicy.minAmount == null || amt < ledgerPolicy.minAmount) return "amount_not_accepted";
    if (v.provider === "paypal") {
      if (!isNonEmptyString(v.captureID, 200) || !isNonEmptyString(v.orderID, 200)) return "paypal_missing_capture";
      if (ledgerPolicy.acceptedPaypalMerchantIds.length && !ledgerPolicy.acceptedPaypalMerchantIds.includes(v.merchantId)) return "paypal_merchant_not_accepted";
      return null;
    }
    if (v.provider === "payple") {
      if (v.source !== "payple-cpay") return "payple_source_not_server_confirmed"; // payple-link: client-trusted issuance
      if (!isNonEmptyString(v.oid, 200) || !isNonEmptyString(v.payerId, 200)) return "payple_missing_confirm_ids";
      if (ledgerPolicy.acceptedPaypleCstIds.length && !ledgerPolicy.acceptedPaypleCstIds.includes(v.cstId)) return "payple_merchant_not_accepted";
      return null;
    }
    return "provider_unknown";
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
        if (additionalEntryRejection(v) !== null) continue;
        if (v.status === "consumed" && sid && v.consumedBySid === sid) {
          return { ok: true, source: "additionalPayments", ref: `${PATHS.additionalPayments}/${uid}/${key}`, evidence: `${v.provider}:${v.captureID || v.oid}`, env: v.env };
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
    // C2 input policy: the instance is generated from THIS snapshot (immutable, carried in the plan and
    // stored with the instance as inputSnapshotHash). Right before publication the live responses node is
    // compared to the snapshot again; any change => SESSION_CHANGED and nothing is published. A customer
    // reading the instance can compare inputSnapshotHash with their current responses.
    const inputSnapshot = JSON.parse(JSON.stringify(session));
    const sessionHash = sha256(canonicalJson(inputSnapshot));

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
      entitlement: ent, idempotencyKey, sessionHash, inputSnapshot,
      mayOverwriteExisting: false, mayChangeLegacyCode: false, mayChangePaymentEntitlements: false,
    };
  }

  // ───────────────────────── P08/P13/P17 generate (fenced, atomic pair) ─────────────────────────
  //
  // Lock states: {state:"pending", attempt:n, startedAt} -> {state:"complete", attempt:n, instanceId} (immutable; = winner decided)
  //                                                        -> {state:"failed",   attempt:n, errorCode}
  // "complete" is NOT "published". Publication is a fact about the two public docs, checked by
  // assertPublishedPair before any success is returned (C1).
  // Fencing: every write that ends an attempt is a TRANSACTION on the lock that requires
  //   cur.state === "pending" && cur.attempt === myAttempt.
  // If that transaction aborts, this attempt lost the fence (another attempt took over after TTL, or
  // already completed). A loser NEVER writes to the public nodes and never touches the lock.
  // The publish itself is that transaction's *side effect*: the multi-location update containing
  // the two public docs is issued ONLY after the fence transaction has committed the lock to
  // complete with this attempt's instanceId. A crash between fence and publish leaves a "complete"
  // lock whose artifact is still in staging/{lockKey}/{attempt}; settleComplete re-publishes from
  // staging idempotently on the next call, or answers GENERATION_IN_PROGRESS — never a bare success.
  async function generateInstancePair(uid, req) {
    const plan = await planGeneration(uid, req);
    const lockPath = `${PATHS.generationLocks}/${plan.idempotencyKey}`;
    const lockRef = db.ref(lockPath);
    const t0 = now();

    // 0) a complete lock means "winner decided", not "published". Settle it: verified pair -> reuse;
    //    staged artifact -> publish now; neither -> the winner is between fence and publish (or lost its
    //    artifact) -> never claim success.
    const existing = await read(lockPath);
    if (existing && existing.state === "complete") return settleComplete(uid, plan, existing);

    // 1) acquire: pending -> mine (attempt+1), or take over a stale pending
    const acq = await lockRef.transaction((cur) => {
      if (cur && cur.state === "complete") return; // abort (handled above / by race)
      if (cur && cur.state === "pending" && t0 - (cur.startedAt || 0) < LOCK_TTL_MS) return; // abort: in flight
      return { state: "pending", uid, sid: plan.sid, targetBundle: plan.targetBundle, consentEventId: plan.consentEventId, startedAt: t0, attempt: ((cur && cur.attempt) || 0) + 1 };
    });
    if (!acq.committed) {
      const cur = acq.snapshot.exists() ? acq.snapshot.val() : null;
      if (cur && cur.state === "complete") return settleComplete(uid, plan, cur); // C1: never "reused" without the pair
      throw new RetentionError("GENERATION_IN_PROGRESS", "another generation for this key is pending");
    }
    const mine = acq.snapshot.val();
    const myAttempt = mine.attempt;
    const instanceId = sha256(`${plan.idempotencyKey}|${myAttempt}`).slice(0, 32);
    // staging is keyed by attempt: a superseded attempt writing late can never clobber the winner's artifact
    const stagingPath = `${PATHS.generationStaging}/${plan.idempotencyKey}/${myAttempt}`;

    // 2) build (no public writes). Any throw -> fenced fail.
    //    The engine consumes ONLY the plan's immutable snapshot, never a fresh read.
    let staged;
    try {
      const session = plan.inputSnapshot;
      const out = await runBundle({ bundle: plan.targetBundle, entrypoint: plan.entrypoint, answers: session.answers || {}, profile: { name: session.name || "", submittedAt: session.submittedAt || null }, locale: plan.locale, sid: plan.sid, publishedAt: new Date(t0).toISOString() });
      if (!out || !out.report || !out.program) throw new RetentionError("GENERATION_INCOMPLETE", "engine runner returned an incomplete pair");
      if (!isHex64(out.bundleHash) || !isHex64(out.entrypointHash)) throw new RetentionError("GENERATION_INCOMPLETE", "engine runner did not return 64-hex bundle/entrypoint hashes");
      if (out.bundleVersion !== plan.targetBundle || out.entrypoint !== plan.entrypoint) throw new RetentionError("GENERATION_INCOMPLETE", "engine runner echoed a different bundle/entrypoint than requested");
      const reportPayload = encodePayload(out.report);
      const programPayload = encodePayload(out.program);
      const reportOutputHash = reportPayload.outputHash;
      const programOutputHash = programPayload.outputHash;
      const common = { instanceId, attempt: myAttempt, uid, sid: plan.sid, bundleVersion: plan.targetBundle, bundleHash: out.bundleHash, entrypoint: plan.entrypoint, entrypointHash: out.entrypointHash, locale: plan.locale, priorInstanceId: plan.priorInstanceId, consentEventId: plan.consentEventId, entitlementSource: plan.entitlement.source, entitlementRef: plan.entitlement.ref, entitlementEvidenceHash: sha256(canonicalJson(plan.entitlement)), inputHashFormat: PAYLOAD_FORMAT, inputSnapshotHash: plan.sessionHash, inputSnapshotAt: t0, createdAt: t0, state: "published" };
      staged = {
        instanceId, attempt: myAttempt, stagedAt: now(),
        report: { ...common, kind: "report", ...reportPayload, report: out.report },
        program: { ...common, kind: "program", ...programPayload, sourceReportInstanceId: instanceId, reportBundleVersion: plan.targetBundle, reportOutputHash, program: out.program },
      };
      await db.ref(stagingPath).set(staged);
    } catch (e) {
      await fencedFail(lockRef, myAttempt, e, stagingPath);
      throw e instanceof RetentionError ? e : new RetentionError("GENERATION_FAILED", String(e && e.message || e));
    }

    // 2b) pre-publish re-validation (C2 change detection, P17 rights revocation). Still no public writes.
    try {
      const live = await read(`${PATHS.responses}/${uid}/${plan.sid}`);
      if (!live || sha256(canonicalJson(live)) !== plan.sessionHash) throw new RetentionError("SESSION_CHANGED", "responses changed while generating; nothing published");
      const ent2 = await resolveEntitlement(uid, plan.sid);
      if (!ent2.ok || ent2.source !== plan.entitlement.source || ent2.ref !== plan.entitlement.ref) throw new RetentionError("ENTITLEMENT_REVOKED", "entitlement no longer holds at publication time; nothing published");
    } catch (e) {
      await fencedFail(lockRef, myAttempt, e, stagingPath);
      throw e instanceof RetentionError ? e : new RetentionError("GENERATION_FAILED", String(e && e.message || e));
    }

    // 3) fence: pending(myAttempt) -> complete(myAttempt, instanceId) — "winner decided", NOT "published".
    //    Publication is proven only by both public docs existing (see assertPublishedPair).
    const completeLock = { ...mine, state: "complete", instanceId, completedAt: now() };
    // null may be the SDK's initial cache guess. Returning null requests a
    // server compare-and-swap, not an unconditional deletion. If the server
    // really has no lock, the null no-op must NOT be interpreted as ownership.
    const fence = await lockRef.transaction((cur) => cur === null ? null : (cur && cur.state === "pending" && cur.attempt === myAttempt) ? completeLock : undefined);
    if (!fence.committed || !fence.snapshot.exists() || fence.snapshot.val().instanceId !== instanceId) {
      const cur = fence.snapshot.exists() ? fence.snapshot.val() : null;
      try { await db.ref(stagingPath).set(null); } catch (_) { /* own attempt's staging only */ }
      safeLog("warn", "[q90] lost fence after build; not publishing", { uid, sid: plan.sid, myAttempt, lockState: cur && cur.state, lockAttempt: cur && cur.attempt });
      if (cur && cur.state === "complete") return settleComplete(uid, plan, cur); // C1
      throw new RetentionError("GENERATION_SUPERSEDED", "another attempt took over this generation; nothing was published by this attempt");
    }

    // 4) publish: one multi-location update (report + program + staging=null). Lock already complete.
    //    A failure here leaves lock=complete + staging present -> settled by step 0 on the next call.
    await publishFromStaging(uid, plan, completeLock, staged);
    const pair = await assertPublishedPair(uid, plan.sid, instanceId, plan.targetBundle);
    if (!pair) throw new RetentionError("GENERATION_IN_PROGRESS", "publication not visible; retry");
    return { reused: false, instanceId, lockKey: plan.idempotencyKey, reportOutputHash: pair.report.outputHash, programOutputHash: pair.program.outputHash };
  }

  // C1: success is only ever reported after BOTH public docs exist, belong to this uid/sid/instance, share
  // the bundle, and the program points at the report with the matching output hash.
  async function assertPublishedPair(uid, sid, instanceId, expectedBundle) {
    const report = await read(`${PATHS.reportInstances}/${uid}/${sid}/${instanceId}`);
    const program = await read(`${PATHS.programInstances}/${uid}/${sid}/${instanceId}`);
    if (!report && !program) return null;
    if (!report || !program) throw new RetentionError("PUBLISHED_PAIR_INCONSISTENT", "only one member of the pair exists; no overwrite attempted");
    return validatePair(report, program, uid, sid, instanceId, expectedBundle);
  }

  function validatePair(report, program, uid, sid, instanceId, expectedBundle) {
    decodePayload(report, "report");
    decodePayload(program, "program");
    const commonKeys = ["bundleHash", "entrypoint", "entrypointHash", "locale", "inputHashFormat", "inputSnapshotHash", "inputSnapshotAt", "entitlementSource", "entitlementRef", "entitlementEvidenceHash", "createdAt", "attempt"];
    const ok = commonKeys.every(key => report[key] !== undefined && report[key] === program[key])
      && ["consentEventId", "priorInstanceId"].every(key => (report[key] || null) === (program[key] || null))
      && report.kind === "report" && program.kind === "program"
      && KNOWN_ENTRYPOINTS.includes(report.entrypoint) && KNOWN_LOCALES.includes(report.locale)
      && report.inputHashFormat === PAYLOAD_FORMAT && isHex64(report.entrypointHash) && isHex64(report.inputSnapshotHash) && isHex64(report.entitlementEvidenceHash)
      && program.reportBundleVersion === expectedBundle && report.instanceId === instanceId && program.instanceId === instanceId
      && report.uid === uid && program.uid === uid && report.sid === sid && program.sid === sid
      && report.bundleVersion === expectedBundle && program.bundleVersion === expectedBundle
      && program.sourceReportInstanceId === instanceId && program.reportOutputHash === report.outputHash
      && isHex64(report.outputHash) && isHex64(program.outputHash) && isHex64(report.bundleHash) && report.bundleHash === program.bundleHash
      && report.state === "published" && program.state === "published";
    if (!ok) throw new RetentionError("PUBLISHED_PAIR_INCONSISTENT", "published report/program do not form a consistent instance set; manual review required");
    return { report, program };
  }

  async function settleComplete(uid, plan, lock) {
    const pair = await assertPublishedPair(uid, plan.sid, lock.instanceId, plan.targetBundle);
    if (pair) return { reused: true, instanceId: lock.instanceId, lockKey: plan.idempotencyKey, reportOutputHash: pair.report.outputHash, programOutputHash: pair.program.outputHash };
    const staged = await read(`${PATHS.generationStaging}/${plan.idempotencyKey}/${lock.attempt}`);
    if (staged && staged.instanceId === lock.instanceId) {
      await publishFromStaging(uid, plan, lock, staged);
      const pair2 = await assertPublishedPair(uid, plan.sid, lock.instanceId, plan.targetBundle);
      if (!pair2) throw new RetentionError("GENERATION_IN_PROGRESS", "publication in progress; retry");
      return { reused: true, recovered: true, instanceId: lock.instanceId, lockKey: plan.idempotencyKey, reportOutputHash: pair2.report.outputHash, programOutputHash: pair2.program.outputHash };
    }
    // Winner decided but its artifact is neither public nor staged: either the winner is between fence
    // and publish right now (staging exists only after build, so this is the fence->publish window
    // when staging was cleared by publish but the docs are not yet visible — impossible with a single
    // update, so in practice: winner crashed after clearing staging) or something external removed it.
    const winnerFresh = (now() - (lock.completedAt || 0)) < LOCK_TTL_MS;
    if (winnerFresh) throw new RetentionError("GENERATION_IN_PROGRESS", "winner decided, publication not yet visible; retry");
    throw new RetentionError("LOCK_COMPLETE_WITHOUT_ARTIFACT", "lock is complete but neither published pair nor staged artifact exists; manual review required");
  }

  async function publishFromStaging(uid, plan, lock, staged) {
    if (!staged || staged.instanceId !== lock.instanceId || staged.attempt !== lock.attempt || lock.uid !== uid || lock.sid !== plan.sid || lock.targetBundle !== plan.targetBundle || lock.state !== "complete") throw new RetentionError("STAGING_MISMATCH", "staged artifact does not belong to the completed lock");
    const pair = validatePair(staged.report, staged.program, uid, plan.sid, lock.instanceId, plan.targetBundle);
    // Re-use may keep already-published history, but recovery MUST validate
    // against the original staged snapshot, never only a newly made plan.
    if (pair.report.inputSnapshotHash !== plan.sessionHash || pair.report.locale !== plan.locale || pair.report.entrypoint !== plan.entrypoint || (pair.report.consentEventId || null) !== plan.consentEventId || (pair.report.priorInstanceId || null) !== plan.priorInstanceId) throw new RetentionError("SESSION_CHANGED", "recovery no longer matches the original generation request");
    const live = await read(`${PATHS.responses}/${uid}/${plan.sid}`);
    if (!live || sha256(canonicalJson(live)) !== pair.report.inputSnapshotHash) throw new RetentionError("SESSION_CHANGED", "original input changed before publication or recovery");
    const ent = await resolveEntitlement(uid, plan.sid);
    if (!ent.ok || sha256(canonicalJson(ent)) !== pair.report.entitlementEvidenceHash) throw new RetentionError("ENTITLEMENT_REVOKED", "original entitlement evidence changed before publication or recovery");
    if (!featureEnabled(uid)) throw new RetentionError("FEATURE_DISABLED", "generation disabled before publication");
    const existing = await assertPublishedPair(uid, plan.sid, lock.instanceId, plan.targetBundle);
    if (existing) {
      if (existing.report.payloadJson !== staged.report.payloadJson || existing.program.payloadJson !== staged.program.payloadJson) throw new RetentionError("PUBLISHED_PAIR_INCONSISTENT", "published content differs from staged content; no overwrite attempted");
      return;
    }
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
    const tx = await lockRef.transaction((cur) => cur === null ? null : (cur && cur.state === "pending" && cur.attempt === myAttempt) ? { ...cur, state: "failed", failedAt: now(), errorCode: code } : undefined);
    // own attempt's staging is ours to clear whether or not we still hold the fence
    try { await db.ref(stagingPath).set(null); } catch (_) { /* best effort; staging is server-only */ }
    if (tx.committed && tx.snapshot.exists() && tx.snapshot.val().state === "failed") safeLog("warn", "[q90] generation failed, nothing published", { code, attempt: myAttempt });
    else safeLog("warn", "[q90] generation failed after losing fence; lock untouched", { code, attempt: myAttempt });
  }

  // Read the exact saved JSON, independently of current answers, generation
  // feature flags and generation entitlement. Ownership is still token-uid scoped.
  async function readInstancePair(uid, sid, instanceId) {
    assertUid(uid);
    if (!idSafe(sid) || !idSafe(instanceId)) throw new RetentionError("INVALID_REQUEST", "safe sid and instanceId required");
    const saved = await read(`${PATHS.reportInstances}/${uid}/${sid}/${instanceId}`);
    if (!saved) throw new RetentionError("SAVED_INSTANCE_NOT_FOUND", "saved report instance not found");
    if (!KNOWN_BUNDLES.includes(saved.bundleVersion)) throw new RetentionError("PUBLISHED_PAIR_INCONSISTENT", "unknown saved bundle");
    const pair = await assertPublishedPair(uid, sid, instanceId, saved.bundleVersion);
    if (!pair) throw new RetentionError("SAVED_INSTANCE_NOT_FOUND", "saved pair not found");
    return { instanceId, bundleVersion: saved.bundleVersion,
      reportOutputHash: pair.report.outputHash, programOutputHash: pair.program.outputHash,
      report: decodePayload(pair.report, "report"), program: decodePayload(pair.program, "program") };
  }

  function assertUid(uid) {
    if (!isSafeUid(uid)) throw new RetentionError("UNAUTHENTICATED", "verified uid required");
  }

  return { recordConsent, resolveEntitlement, planGeneration, generateInstancePair, readInstancePair, PATHS, KNOWN_BUNDLES, KNOWN_ENTRYPOINTS, KNOWN_DISCLOSURES, LEGACY_BUNDLE };
}

module.exports = { createRetention, RetentionError, PATHS, KNOWN_BUNDLES, KNOWN_ENTRYPOINTS, KNOWN_DISCLOSURES, LEGACY_BUNDLE, LOCK_TTL_MS };
